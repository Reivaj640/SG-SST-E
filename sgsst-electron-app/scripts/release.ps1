# ============================================================================
# release.ps1 — K+AIR release flow completo
# ============================================================================
# Este script automatiza TODO el流程 de publicar una nueva version:
#   1. Verifica que no hay cambios sin commitear
#   2. Verifica que el working tree esta limpio
#   3. Lee la version de package.json
#   4. Pushea la branch actual al remoto
#   5. Crea el tag git v<version> y lo pushea (ESTO es lo que evita el 422)
#   6. Corre electron-builder con --publish=always
#   7. Si electron-builder falla, ejecuta fix-release.ps1 como fallback
#
# Uso:
#   .\scripts\release.ps1
#   .\scripts\release.ps1 -SkipTests    # skip test suite
#
# Pre-requisitos:
#   - GH_TOKEN seteado en el environment (export GH_TOKEN=ghp_xxx)
#   - Estar en la branch correcta (Dev-Pc por default)
#   - package.json tiene la version correcta
# ============================================================================

param(
    [switch]$SkipTests = $false,
    [string]$Branch = "Dev-Pc"
)

$ErrorActionPreference = "Stop"

# === Config ===
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
Set-Location $ProjectDir

$PackageJson = Get-Content -Path "package.json" -Raw | ConvertFrom-Json
$Version = $PackageJson.version
$TagName = "v$Version"

Write-Host ""
Write-Host "========================================================================="
Write-Host "  K+AIR Release Script"
Write-Host "========================================================================="
Write-Host "  Version:    $Version"
Write-Host "  Tag:        $TagName"
Write-Host "  Branch:     $Branch"
Write-Host "  ProjectDir: $ProjectDir"
Write-Host "========================================================================="
Write-Host ""

# === Sanity checks ===
Write-Host "[1/7] Verificando pre-requisitos..."

if (-not $env:GH_TOKEN) {
    Write-Error "GH_TOKEN no esta seteado. Ejecuta: `$env:GH_TOKEN = 'ghp_xxx'"
    exit 1
}

$currentBranch = git rev-parse --abbrev-ref HEAD
if ($currentBranch -ne $Branch) {
    Write-Error "Estas en la branch '$currentBranch', se esperaba '$Branch'. Cambiate con: git checkout $Branch"
    exit 1
}

# Working tree debe estar limpio (excepto archivos ignorados)
$gitStatus = git status --porcelain
$realChanges = $gitStatus | Where-Object { $_ -notmatch "^\?\?" } | Where-Object { $_ -notmatch "Portear/python-embed" } | Where-Object { $_ -notmatch "dist/" }
if ($realChanges) {
    Write-Host ""
    Write-Host "ATENCION: Hay cambios sin commitear en el working tree:"
    $realChanges | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
    Write-Host "Commitea los cambios primero o usa 'git stash' para guardarlos."
    $response = Read-Host "Queres continuar de todas formas? (s/N)"
    if ($response -ne "s" -and $response -ne "S") {
        Write-Host "Abortado."
        exit 1
    }
}

Write-Host "  Branch: OK ($currentBranch)"
Write-Host "  GH_TOKEN: OK"
Write-Host "  Working tree: $(if ($realChanges) {'ADVERTENCIA - hay cambios'} else {'limpio'})"
Write-Host ""

# === Tests (opcional) ===
if (-not $SkipTests) {
    Write-Host "[2/7] Corriendo tests..."
    $testFile = "main/test-fixes-loop48.js"
    if (Test-Path $testFile) {
        node $testFile
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Tests fallaron. Abortando release."
            exit 1
        }
    } else {
        Write-Host "  (no se encontro $testFile, saltando tests)"
    }
    Write-Host ""
} else {
    Write-Host "[2/7] Tests saltados (-SkipTests)"
    Write-Host ""
}

# === Push branch ===
Write-Host "[3/7] Pusheando branch '$Branch' al remoto..."
git push origin $Branch
if ($LASTEXITCODE -ne 0) {
    Write-Error "git push fallo. Revisa tu conexion / permisos."
    exit 1
}
Write-Host "  Branch pusheada: OK"
Write-Host ""

# === Crear y pushear tag ===
Write-Host "[4/7] Creando tag '$TagName'..."
$tagExists = git tag -l $TagName
if ($tagExists) {
    Write-Host "  Tag '$TagName' ya existe localmente."
    $response = Read-Host "  Queres borrarlo y crearlo de nuevo? (s/N)"
    if ($response -ne "s" -and $response -ne "S") {
        Write-Host "Abortado."
        exit 1
    }
    git tag -d $TagName
    git push origin --delete $TagName 2>$null
}

git tag -a $TagName -m "Release $TagName"
if ($LASTEXITCODE -ne 0) {
    Write-Error "No se pudo crear el tag local."
    exit 1
}

Write-Host "[5/7] Pusheando tag '$TagName' al remoto..."
git push origin $TagName
if ($LASTEXITCODE -ne 0) {
    Write-Error "git push del tag fallo. ESTE es el paso que evita el 422."
    exit 1
}
Write-Host "  Tag pusheado: OK"
Write-Host ""

# === Verificar que GitHub ve el tag ===
Write-Host "[6/7] Verificando que GitHub ve el tag..."
$headers = @{
    "Authorization" = "Bearer $env:GH_TOKEN"
    "Accept"        = "application/vnd.github+json"
    "User-Agent"    = "K+AIR-Release"
}
try {
    $tagInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/Reivaj640/SG-SST-E/git/refs/tags/$TagName" -Headers $headers
    Write-Host "  Tag visible en GitHub: $($tagInfo.ref)"
} catch {
    Write-Warning "  Tag todavia no es visible en GitHub (puede tomar unos segundos)."
    Write-Host "  Esperando 5 segundos..."
    Start-Sleep -Seconds 5
}
Write-Host ""

# === Build & publish ===
Write-Host "[7/7] Corriendo electron-builder --win --publish=always..."
Write-Host "  Esto puede tardar varios minutos (firma de ejecutables + subida de 264 MB)..."
Write-Host ""

$buildStart = Get-Date
& npx electron-builder --win --publish=always
$buildExitCode = $LASTEXITCODE
$buildDuration = (Get-Date) - $buildStart

Write-Host ""
Write-Host "========================================================================="
if ($buildExitCode -eq 0) {
    Write-Host "  RELEASE EXITOSO"
    Write-Host "========================================================================="
    Write-Host "  Version:   $Version"
    Write-Host "  Tag:       $TagName"
    Write-Host "  Duracion:  $($buildDuration.ToString('mm\:ss'))"
    Write-Host "  URL:       https://github.com/Reivaj640/SG-SST-E/releases/tag/$TagName"
    Write-Host "========================================================================="
    exit 0
} else {
    Write-Host "  BUILD FALLO (exit code: $buildExitCode)"
    Write-Host "========================================================================="
    Write-Host "  Probable causa: timeout en upload del .exe (264 MB)."
    Write-Host "  El release puede haberse creado parcial (solo .blockmap)."
    Write-Host ""
    Write-Host "  Ejecutando fix-release.ps1 como fallback..."
    Write-Host ""

    $fixScript = Join-Path $ScriptDir "fix-release.ps1"
    if (Test-Path $fixScript) {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $fixScript -Version $Version
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "========================================================================="
            Write-Host "  FALLBACK EXITOSO — release $TagName completo"
            Write-Host "========================================================================="
            Write-Host "  URL: https://github.com/Reivaj640/SG-SST-E/releases/tag/$TagName"
            Write-Host "========================================================================="
            exit 0
        } else {
            Write-Error "fix-release.ps1 tambien fallo. Revisa manualmente."
            exit 1
        }
    } else {
        Write-Error "No se encontro fix-release.ps1. Revisa manualmente el release."
        exit 1
    }
}

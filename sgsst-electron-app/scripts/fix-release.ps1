# ============================================================================
# fix-release.ps1 — Fallback cuando electron-builder falla al subir assets
# ============================================================================
# Cuando electron-builder con --publish=always falla (típicamente por timeout
# en la subida del .exe de 264 MB), este script:
#   1. Borra assets huerfanos (los que se subieron antes del fallo)
#   2. Recupera el release (si se creo como draft) o lo crea
#   3. Sube el .exe con el nombre correcto (K+AIR-Setup-<version>.exe)
#   4. Sube el .blockmap con el nombre correcto
#   5. Regenera latest.yml con el SHA512 real del .exe local
#   6. Sube latest.yml
#   7. PATCH el name y body del release
#
# Uso:
#   .\scripts\fix-release.ps1                              # usa version de package.json
#   .\scripts\fix-release.ps1 -Version 0.1.133             # version especifica
#
# Requiere: GH_TOKEN en environment
# ============================================================================

param(
    [string]$Version = "",
    [string]$Owner = "Reivaj640",
    [string]$Repo = "SG-SST-E"
)

$ErrorActionPreference = "Stop"

# === Config ===
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
Set-Location $ProjectDir

if (-not $Version) {
    $PackageJson = Get-Content -Path "package.json" -Raw | ConvertFrom-Json
    $Version = $PackageJson.version
}
$TagName = "v$Version"
$ExeName = "K-AIR-Setup-$Version.exe"
$BlockmapName = "$ExeName.blockmap"

$ExePath = Join-Path $ProjectDir "dist\$ExeName"
$BlockmapPath = Join-Path $ProjectDir "dist\$BlockmapName"
$YmlPath = Join-Path $ProjectDir "dist\latest.yml"

Write-Host ""
Write-Host "========================================================================="
Write-Host "  K+AIR Fix-Release Script (fallback)"
Write-Host "========================================================================="
Write-Host "  Version:    $Version"
Write-Host "  Tag:        $TagName"
Write-Host "  Exe:        $ExeName"
Write-Host "========================================================================="
Write-Host ""

# === Pre-checks ===
Write-Host "[1/6] Verificando pre-requisitos..."

if (-not $env:GH_TOKEN) {
    Write-Error "GH_TOKEN no esta seteado."
    exit 1
}

if (-not (Test-Path $ExePath)) {
    Write-Error "No se encontro el .exe: $ExePath. Corre electron-builder primero."
    exit 1
}

if (-not (Test-Path $BlockmapPath)) {
    Write-Error "No se encontro el .blockmap: $BlockmapPath."
    exit 1
}

Write-Host "  Exe encontrado: $ExeName ($([math]::Round((Get-Item $ExePath).Length / 1MB, 1)) MB)"
Write-Host "  Blockmap encontrado: $BlockmapName"
Write-Host ""

# === Calcular SHA512 y regenerar latest.yml ===
Write-Host "[2/6] Calculando SHA512 del .exe..."
$exeHash = (Get-FileHash -Algorithm SHA512 -Path $ExePath).Hash.ToLower()
$exeSize = (Get-Item $ExePath).Length
Write-Host "  SHA512: $exeHash"
Write-Host "  Size:   $exeSize bytes"

Write-Host "  Regenerando latest.yml..."
$ymlContent = @"
version: $Version
files:
  - url: $ExeName
    sha512: $exeHash
    size: $exeSize
    isAdminRightsRequired: true
path: $ExeName
sha512: $exeHash
releaseDate: '$((Get-Date).ToString('yyyy-MM-ddTHH:mm:ss.fffZ'))'
"@
$ymlContent | Out-File -FilePath $YmlPath -Encoding utf8 -NoNewline
Write-Host "  latest.yml regenerado: OK"
Write-Host ""

# === Headers ===
$headers = @{
    "Authorization"        = "Bearer $env:GH_TOKEN"
    "Accept"               = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
    "User-Agent"           = "K+AIR-Fix-Release"
}

# === Obtener / crear el release ===
Write-Host "[3/6] Verificando si el release existe..."
try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo/releases/tags/$TagName" -Headers $headers
    Write-Host "  Release encontrado: ID=$($release.id), name='$($release.name)'"
} catch {
    Write-Host "  Release NO existe. Creando..."
    $createBody = @{
        tag_name = $TagName
        name     = $TagName
        body     = "Release $TagName"
        draft    = $false
        prerelease = $false
    } | ConvertTo-Json
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo/releases" -Method Post -Headers $headers -Body $createBody -ContentType "application/json"
    Write-Host "  Release creado: ID=$($release.id)"
}

# === Borrar assets huerfanos ===
Write-Host ""
Write-Host "[4/6] Limpiando assets huerfanos (con nombre viejo o parciales)..."
$huerfanos = 0
foreach ($asset in @($release.assets)) {
    $esHuerfano = $false
    # Borrar todo lo que NO sea el .exe o .blockmap con el nombre correcto, o latest.yml
    if ($asset.name -like "sgsst-electron-app-setup-*") {
        $esHuerfano = $true
        Write-Host "  Borrando huerfano (nombre viejo): $($asset.name)"
    }
    if ($esHuerfano) {
        Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo/releases/assets/$($asset.id)" -Method Delete -Headers $headers
        $huerfanos++
    }
}
Write-Host "  Huerfanos borrados: $huerfanos"
Write-Host ""

# === Subir assets correctos ===
Write-Host "[5/6] Subiendo assets correctos..."

# Importante: PowerShell trata ? como wildcard en interpolacion de strings.
# Hay que usar ${uploadBase} para delimitar la variable.
$uploadBase = $release.upload_url -replace "\{[^}]*\}", ""

function Upload-Asset {
    param(
        [string]$FilePath,
        [string]$AssetName
    )
    $url = "${uploadBase}?name=$([uri]::EscapeDataString($AssetName))"
    Write-Host "  Subiendo $AssetName ($([math]::Round((Get-Item $FilePath).Length / 1MB, 1)) MB)..."
    $result = & curl.exe -sS -X POST `
        -H "Authorization: Bearer $env:GH_TOKEN" `
        -H "Accept: application/vnd.github+json" `
        -H "Content-Type: application/octet-stream" `
        --data-binary "@$FilePath" `
        $url
    $obj = $result | ConvertFrom-Json
    if ($obj.browser_download_url) {
        Write-Host "    OK: $($obj.browser_download_url)"
        return $true
    } else {
        Write-Host "    FAIL: $result"
        return $false
    }
}

# Subir .exe
$exeOk = Upload-Asset -FilePath $ExePath -AssetName $ExeName
# Subir .blockmap
$blockmapOk = Upload-Asset -FilePath $BlockmapPath -AssetName $BlockmapName
# Subir latest.yml
$ymlOk = Upload-Asset -FilePath $YmlPath -AssetName "latest.yml"

if (-not $exeOk -or -not $blockmapOk -or -not $ymlOk) {
    Write-Error "Una o mas subidas fallaron. Revisa el log."
    exit 1
}
Write-Host ""

# === PATCH name + body del release ===
Write-Host "[6/6] Actualizando name y body del release..."
$bodyJson = @{
    name = "v$Version"
    body = @"
## v$Version

Ver [CHANGELOG.md](https://github.com/$Owner/$Repo/blob/$TagName/CHANGELOG.md) para el detalle completo.

### Instalacion manual
Descarga `K+AIR-Setup-$Version.exe` desde esta pagina y ejecutalo encima de tu version actual.
"@
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo/releases/$($release.id)" -Method Patch -Headers $headers -Body $bodyJson -ContentType "application/json" | Out-Null
Write-Host "  Name + body actualizados"
Write-Host ""

# === Verificacion final ===
Write-Host "========================================================================="
Write-Host "  RELEASE COMPLETO"
Write-Host "========================================================================="
$final = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo/releases/tags/$TagName" -Headers $headers
Write-Host "  Name:    $($final.name)"
Write-Host "  Assets:"
foreach ($asset in $final.assets) {
    Write-Host "    - $($asset.name) ($([math]::Round($asset.size / 1MB, 1)) MB)"
}
Write-Host "  URL:     $($final.html_url)"
Write-Host "========================================================================="

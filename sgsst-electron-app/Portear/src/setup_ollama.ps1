# setup_ollama.ps1
# Inicializa el modelo Qwen3.5-2B-MTP-GGUF en Ollama desde el archivo GGUF local.
# Ejecutar UNA VEZ para crear el modelo en Ollama.
# Después, solo hay que mantener `ollama serve` corriendo.

$ErrorActionPreference = "Stop"

$modelName = "qwen-inv-at"
$modelfile = Join-Path $PSScriptRoot "Modelfile"
$ggufPath = "D:\1. Estudio\1.1 IA\1.1.2. LLM's\Inv. AT\unslothQwen3.5-2B-MTP-GGUF\Qwen3.5-2B-UD-Q4_K_XL.gguf"

Write-Host "=== K+AIR · Setup Ollama para Investigación de Accidentes ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar que Ollama está instalado
try {
    $ollamaVersion = ollama --version 2>&1
    Write-Host "[OK] Ollama instalado: $ollamaVersion" -ForegroundColor Green
}
catch {
    Write-Host "[ERROR] Ollama no está instalado. Instalar desde https://ollama.com/download" -ForegroundColor Red
    exit 1
}

# 2. Verificar que el GGUF existe
if (-not (Test-Path $ggufPath)) {
    Write-Host "[ERROR] No se encontró el archivo GGUF en: $ggufPath" -ForegroundColor Red
    exit 1
}
$ggufSize = (Get-Item $ggufPath).Length / 1GB
Write-Host "[OK] GGUF encontrado: $ggufPath ($([math]::Round($ggufSize, 2)) GB)" -ForegroundColor Green

# 3. Verificar que el Modelfile existe
if (-not (Test-Path $modelfile)) {
    Write-Host "[ERROR] No se encontró el Modelfile en: $modelfile" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Modelfile encontrado: $modelfile" -ForegroundColor Green

# 4. Verificar si Ollama ya está corriendo
$ollamaRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:11434/" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        $ollamaRunning = $true
        Write-Host "[OK] Ollama ya está corriendo en :11434" -ForegroundColor Green
    }
}
catch {
    Write-Host "[INFO] Ollama no está corriendo. Iniciando..." -ForegroundColor Yellow
}

if (-not $ollamaRunning) {
    $ollamaProcess = Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden -PassThru
    Write-Host "[OK] Ollama iniciado (PID $($ollamaProcess.Id))" -ForegroundColor Green

    # Esperar a que esté listo (máx 30s)
    $ready = $false
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 2
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:11434/" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $ready = $true
                Write-Host "[OK] Ollama listo en :11434" -ForegroundColor Green
                break
            }
        }
        catch { }
    }
    if (-not $ready) {
        Write-Host "[WARN] Ollama no respondió en 30s. Continuando de todas formas..." -ForegroundColor Yellow
    }
}

# 5. Verificar si el modelo ya existe en Ollama
$existingModel = ollama list 2>&1 | Select-String -Pattern "^$modelName\s"
if ($existingModel) {
    Write-Host "[INFO] El modelo '$modelName' ya existe en Ollama. Saltando creación." -ForegroundColor Yellow
}
else {
    Write-Host "[INFO] Creando modelo '$modelName' desde Modelfile (esto puede tardar 1-2 minutos)..." -ForegroundColor Cyan
    ollama create $modelName -f $modelfile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Modelo '$modelName' creado exitosamente" -ForegroundColor Green
    }
    else {
        Write-Host "[ERROR] Error creando el modelo. Revisa la salida anterior." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "=== Setup completado ===" -ForegroundColor Cyan
Write-Host "El modelo '$modelName' está listo para usar." -ForegroundColor Green
Write-Host ""
Write-Host "Para probarlo manualmente:" -ForegroundColor Yellow
Write-Host "  ollama run $modelName 'Hola'" -ForegroundColor White
Write-Host ""
Write-Host "El servidor Ollama debe quedar corriendo para que la app lo use." -ForegroundColor Yellow

# Script para iniciar OnlyOffice Document Server
# Uso: .\start-onlyoffice.ps1

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Iniciando OnlyOffice Document Server" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Verificar si Docker está corriendo
try {
    $null = docker ps 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Docker no está corriendo. Por favor inicia Docker Desktop primero." -ForegroundColor Red
        Read-Host "Presione Enter para salir"
        exit 1
    }
} catch {
    Write-Host "Error: Docker no está instalado o no está corriendo." -ForegroundColor Red
    Read-Host "Presione Enter para salir"
    exit 1
}

# Verificar contenedores existentes
Write-Host "Verificando contenedores existentes..." -ForegroundColor Yellow
$existingContainers = docker ps -a --filter "name=onlyoffice" --format "{{.Names}}" 2>&1
if ($existingContainers -match "onlyoffice-documentserver") {
    Write-Host "Contenedor OnlyOffice existe. Deteniendo y eliminando..." -ForegroundColor Yellow
    docker-compose down
    Write-Host ""
}

# Iniciar OnlyOffice
Write-Host "Iniciando OnlyOffice Document Server..." -ForegroundColor Green
Write-Host "Esto puede tomar varios minutos la primera vez..." -ForegroundColor Yellow
Write-Host ""

docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error iniciando OnlyOffice Document Server" -ForegroundColor Red
    Read-Host "Presione Enter para salir"
    exit 1
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Verificando estado del servidor..." -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Start-Sleep -Seconds 10

docker-compose ps

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Esperando que OnlyOffice esté listo..." -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Esto puede tomar 2-3 minutos..." -ForegroundColor Yellow
Write-Host ""

# Esperar hasta que OnlyOffice esté listo
$ready = $false
$maxAttempts = 60
$attempt = 0

while (-not $ready -and $attempt -lt $maxAttempts) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/healthcheck" -UseBasicParsing -TimeoutSec 5 2>&1
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 404) {
            $ready = $true
        }
    } catch {
        Write-Host "Esperando... (intento $($attempt + 1)/$maxAttempts)" -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        $attempt++
    }
}

if ($ready) {
    Write-Host ""
    Write-Host "====================================" -ForegroundColor Green
    Write-Host "OnlyOffice Document Server está listo!" -ForegroundColor Green
    Write-Host "====================================" -ForegroundColor Green
    Write-Host "URL del servidor: http://localhost:8080" -ForegroundColor Cyan
    Write-Host "Editor: http://localhost:8080/office-apps/editor/index.html" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Para ver logs: docker-compose logs -f onlyoffice-documentserver" -ForegroundColor Yellow
    Write-Host "Para detener: docker-compose down" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "====================================" -ForegroundColor Red
    Write-Host "Tiempo de espera agotado. OnlyOffice puede que no esté listo todavía." -ForegroundColor Red
    Write-Host "====================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Revisa los logs con: docker-compose logs -f onlyoffice-documentserver" -ForegroundColor Yellow
    Write-Host ""
}

Read-Host "Presione Enter para salir"

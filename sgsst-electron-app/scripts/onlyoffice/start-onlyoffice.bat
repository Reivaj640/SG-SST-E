@echo off
echo ====================================
echo Iniciando OnlyOffice Document Server
echo ====================================
echo.

REM Verificar si Docker está corriendo
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Docker no está corriendo. Por favor inicia Docker Desktop primero.
    pause
    exit /b 1
)

echo Verificando contenedores existentes...
docker ps -a --filter "name=onlyoffice" --format "{{.Names}}" | findstr /C:"onlyoffice-documentserver" >nul
if %errorlevel% equ 0 (
    echo Contenedor OnlyOffice existe. Deteniendo y eliminando...
    docker-compose down
    echo.
)

echo Iniciando OnlyOffice Document Server...
echo Esto puede tomar varios minutos la primera vez...
echo.

docker-compose up -d

echo.
echo ====================================
echo Verificando estado del servidor...
echo ====================================
timeout /t 10 /nobreak >nul

docker-compose ps

echo.
echo ====================================
echo Esperando que OnlyOffice esté listo...
echo ====================================
echo Esto puede tomar 2-3 minutos...
echo.

:check
timeout /t 5 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://localhost:8080/healthcheck 2>nul
if %errorlevel% neq 0 (
    if exist nul del nul
    curl -s http://localhost:8080/healthcheck >nul 2>&1
    if %errorlevel% neq 0 (
        echo Esperando... (puede tomar varios minutos)
        goto check
    )
)

echo.
echo ====================================
echo OnlyOffice Document Server está listo!
echo ====================================
echo URL del servidor: http://localhost:8080
echo Editor: http://localhost:8080/office-apps/editor/index.html
echo.
echo Para ver logs: docker-compose logs -f onlyoffice-documentserver
echo Para detener: docker-compose down
echo.
pause

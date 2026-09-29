@echo off
REM ============================================================
REM build-and-publish.bat — K+AIR auto-updater release script
REM
REM USO:
REM   1. Cambia la version en package.json (ej "0.1.118")
REM   2. Commitea y pushea los cambios a Dev-Pc
REM   3. Ejecuta este script desde Git Bash o cmd.exe:
REM        export GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
REM        ./build-and-publish.bat
REM
REM Que hace automaticamente:
REM   1. Lee la version actual de package.json
REM   2. Borra el tag viejo v0.1.X (si existe) — local y remoto
REM      (esto evita el 422 "tag already exists" de electron-builder)
REM   3. Hace git pull de los ultimos cambios de Dev-Pc
REM   4. Limpia dist/ para evitar assets viejos mezclados
REM   5. Corre electron-builder con --publish=always
REM   6. Verifica que se generaron los assets criticos:
REM      - K+AIR-Setup-X.Y.Z.exe
REM      - K+AIR-Setup-X.Y.Z.exe.blockmap
REM      - latest.yml
REM
REM Si electron-builder falla con 422, este script lo maneja
REM automaticamente. Si falla por otra razon, te dice donde mirar.
REM
REM Creado en 📦554 — ver commit message para contexto.
REM ============================================================

setlocal enabledelayedexpansion

REM --- 1. Leer version de package.json ---
echo.
echo ========================================
echo  [1/6] Leyendo version de package.json
echo ========================================
for /f "tokens=2 delims=:, " %%a in ('findstr /i "version" package.json ^| findstr /v "code"') do (
    set "PKG_VERSION=%%a"
    goto :got_version
)
:got_version
REM Limpiar comillas y espacios
set "PKG_VERSION=%PKG_VERSION:"=%"
set "PKG_VERSION=%PKG_VERSION: =%"

if "%PKG_VERSION%"=="" (
    echo [ERROR] No pude leer la version de package.json
    echo         Aborta el script.
    exit /b 1
)

set "TAG_NAME=v%PKG_VERSION%"
echo [OK] Version detectada: %PKG_VERSION%
echo [OK] Tag a crear: %TAG_NAME%
echo.

REM --- 2. Verificar GH_TOKEN ---
echo ========================================
echo  [2/6] Verificando GH_TOKEN
echo ========================================
if "%GH_TOKEN%"=="" (
    echo [ERROR] GH_TOKEN no esta definido.
    echo         Antes de correr este script, ejecuta:
    echo           export GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
    echo         o en PowerShell:
    echo           $env:GH_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
    exit /b 1
)
echo [OK] GH_TOKEN presente (longitud: %GH_TOKEN:~0,4%...)
echo.

REM --- 3. Borrar tag viejo (si existe) ---
echo ========================================
echo  [3/6] Limpiando tag viejo %TAG_NAME% (si existe)
echo ========================================
git tag -d %TAG_NAME% 2>nul
if errorlevel 1 (
    echo [INFO] Tag local %TAG_NAME% no existia, OK
) else (
    echo [OK] Tag local %TAG_NAME% borrado
)
git push origin :refs/tags/%TAG_NAME% 2>nul
if errorlevel 1 (
    echo [INFO] Tag remoto %TAG_NAME% no existia, OK
) else (
    echo [OK] Tag remoto %TAG_NAME% borrado
)
echo.

REM --- 4. git pull de los ultimos cambios ---
echo ========================================
echo  [4/6] git pull de origin/Dev-Pc
echo ========================================
git pull origin Dev-Pc
if errorlevel 1 (
    echo [ERROR] git pull fallo. Resolvelo manualmente y volve a correr.
    exit /b 1
)
echo [OK] Working tree actualizado
echo.

REM --- 5. Limpiar dist/ ---
echo ========================================
echo  [5/6] Limpiando dist/ (assets viejos)
echo ========================================
if exist dist (
    rmdir /s /q dist
    echo [OK] dist/ eliminado
) else (
    echo [INFO] dist/ no existia
)
if exist node_modules\better-sqlite3\build\Release (
    REM No tocamos node_modules para no romper la cache
    echo [INFO] node_modules/better-sqlite3 cacheado, no se toca
)
echo.

REM --- 6. electron-builder ---
echo ========================================
echo  [6/6] electron-builder --win --publish=always
echo ========================================
echo [INFO] Esto puede tardar 5-10 minutos (build + 261 MB de upload)
echo.
npx electron-builder --win --publish=always
if errorlevel 1 (
    echo.
    echo [ERROR] electron-builder fallo. Mirá el log arriba para el detalle.
    exit /b 1
)
echo.

REM --- Validacion post-build ---
echo ========================================
echo  [POST-BUILD] Validando assets criticos
echo ========================================
set "VALIDATION_OK=1"

if exist dist\K+AIR-Setup-%PKG_VERSION%.exe (
    echo [OK] dist\K+AIR-Setup-%PKG_VERSION%.exe existe
) else (
    echo [FAIL] dist\K+AIR-Setup-%PKG_VERSION%.exe NO existe
    set "VALIDATION_OK=0"
)

if exist dist\K+AIR-Setup-%PKG_VERSION%.exe.blockmap (
    echo [OK] dist\K+AIR-Setup-%PKG_VERSION%.exe.blockmap existe
) else (
    echo [FAIL] dist\K+AIR-Setup-%PKG_VERSION%.exe.blockmap NO existe
    set "VALIDATION_OK=0"
)

if exist dist\latest.yml (
    echo [OK] dist\latest.yml existe
) else (
    echo [FAIL] dist\latest.yml NO existe
    set "VALIDATION_OK=0"
)

if "%VALIDATION_OK%"=="0" (
    echo.
    echo [WARN] Algunos assets criticos no se generaron localmente.
    echo        Aunque el build reporto exito, electron-builder pudo
    echo        no haberlos subido a GitHub. Verifica el release en:
    echo          https://github.com/Reivaj640/SG-SST-E/releases/tag/%TAG_NAME%
    exit /b 1
)

echo.
echo ========================================
echo  [SUCCESS] Build %PKG_VERSION% completado
echo ========================================
echo.
echo Assets generados en dist/:
dir /b dist\K+AIR-Setup-%PKG_VERSION%.exe* dist\latest.yml
echo.
echo El release v%PKG_VERSION% deberia estar en GitHub:
echo   https://github.com/Reivaj640/SG-SST-E/releases/tag/%TAG_NAME%
echo.
echo Verifica que tenga los 4 assets criticos:
echo   - K+AIR-Setup-%PKG_VERSION%.exe         (~261 MB)
echo   - K+AIR-Setup-%PKG_VERSION%.exe.blockmap (~262 KB)
echo   - latest.yml                              (~403 B)
echo   - Source code (zip + tar.gz)
echo.

endlocal

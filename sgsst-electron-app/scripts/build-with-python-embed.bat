@echo off
REM ============================================================================
REM build-with-python-embed.bat
REM Script para construir K+AIR con Python Embeddable incluido
REM ============================================================================
REM Este script:
REM   1. Verifica que Python empaquetado esté preparado
REM   2. Limpia builds anteriores
REM   3. Ejecuta electron-builder
REM   4. Verifica el installer generado
REM ============================================================================

setlocal enabledelayedexpansion

set PYTHON_EMBED_DIR=%~dp0..\Portear\python-embed
set DIST_DIR=%~dp0..\dist

echo.
echo ============================================================================
echo  Construyendo K+AIR con Python Embeddable
echo ============================================================================
echo.

REM === Paso 1: Verificar Python empaquetado ===
echo [1/4] Verificando Python empaquetado...

if not exist "%PYTHON_EMBED_DIR%\python.exe" (
    echo.
    echo   ERROR: Python empaquetado NO encontrado en: %PYTHON_EMBED_DIR%
    echo.
    echo   Debes ejecutar primero: scripts\prepare-python-embed.bat
    echo.
    echo   Este script descarga Python 3.11.9 e instala las dependencias.
    echo.
    pause
    exit /b 1
)

echo   Python empaquetado: OK
echo   Ruta: %PYTHON_EMBED_DIR%

if exist "%PYTHON_EMBED_DIR%\python-scripts\map_directory.py" (
    echo   Scripts Python: OK
) else (
    echo   WARNING: Scripts Python no encontrados
)

if exist "%PYTHON_EMBED_DIR%\Lib\site-packages" (
    for /f %%i in ('dir /b "%PYTHON_EMBED_DIR%\Lib\site-packages"') do set /a pkgcount+=1
    echo   Paquetes instalados: !pkgcount!
)

echo.

REM === Paso 2: Limpiar builds anteriores ===
echo [2/4] Limpiando builds anteriores...

if exist "%DIST_DIR%" (
    echo   Eliminando %DIST_DIR%...
    rmdir /s /q "%DIST_DIR%"
    echo   Limpieza completada.
) else (
    echo   No hay builds anteriores que limpiar.
)

echo.

REM === Paso 3: Ejecutar build ===
echo [3/4] Ejecutando electron-builder...
echo   Esto puede tardar varios minutos...
echo.

cd /d "%~dp0.."

REM Ejecutar build de Windows
call npm run build:win

if errorlevel 1 (
    echo.
    echo   ERROR: El build falló. Revisa los mensajes de error arriba.
    echo.
    pause
    exit /b 1
)

echo.
echo   Build completado exitosamente.

REM === Paso 4: Verificar installer ===
echo.
echo [4/4] Verificando installer generado...

set INSTALLER_PATTERN=%DIST_DIR%\K+AIR-Setup-*.exe

for %%f in (%INSTALLER_PATTERN%) do (
    if exist "%%f" (
        echo   Installer encontrado: %%f
        for %%A in ("%%f") do set SIZE=%%~zA
        set /a SIZE_MB=!SIZE!/1048576
        echo   Tamaño: !SIZE_MB! MB
    )
)

echo.
echo ============================================================================
echo  ¡Build completado exitosamente!
echo ============================================================================
echo.
echo  Siguientes pasos:
echo  1. Verifica el installer en: %DIST_DIR%
echo  2. Prueba la instalación en una VM limpia (sin Python instalado)
echo  3. Verifica que todas las funciones funcionen correctamente
echo.
echo  Notas importantes:
echo  - El installer incluye Python 3.11.9 (~200-300 MB)
echo  - Las funciones con Python deberían funcionar sin instalar Python manualmente
echo  - Si hay errores, revisa los logs en: %%APPDATA%%\K+AIR\logs\
echo.

pause

@echo off
REM ============================================================================
REM prepare-python-embed.bat
REM Script para preparar Python Embeddable 3.11 para K+AIR
REM ============================================================================
REM Este script:
REM   1. Descarga Python 3.11.9 embeddable (64-bit)
REM   2. Descarga get-pip.py
REM   3. Configura Python para permitir imports desde site-packages
REM   4. Instala pip y las dependencias desde requirements.txt
REM   5. Copia los scripts de Portear/src a python-embed/python-scripts
REM ============================================================================

setlocal enabledelayedexpansion

REM === Configuración ===
set PYTHON_VERSION=3.11.9
set PYTHON_EMBED_URL=https://www.python.org/ftp/python/%PYTHON_VERSION%/python-%PYTHON_VERSION%-embed-amd64.zip
set GET_PIP_URL=https://bootstrap.pypa.io/get-pip.py
set PYTHON_EMBED_DIR=%~dp0..\Portear\python-embed
set REQUIREMENTS_FILE=%~dp0..\Portear\requirements.txt
set SRC_DIR=%~dp0..\Portear\src

echo.
echo ============================================================================
echo  Preparando Python Embeddable %PYTHON_VERSION% para K+AIR
echo ============================================================================
echo.

REM === Paso 1: Crear directorio ===
echo [1/6] Creando directorio %PYTHON_EMBED_DIR%...
if not exist "%PYTHON_EMBED_DIR%" (
    mkdir "%PYTHON_EMBED_DIR%"
    echo       Directorio creado.
) else (
    echo       Directorio ya existe.
)
echo.

REM === Paso 2: Descargar Python Embeddable ===
echo [2/6] Descargando Python Embeddable...
if exist "%PYTHON_EMBED_DIR%\python.exe" (
    echo       Python ya fue descargado. Saltando...
) else (
    echo       Descargando desde: %PYTHON_EMBED_URL%
    powershell -Command "& {Invoke-WebRequest -Uri '%PYTHON_EMBED_URL%' -OutFile '%PYTHON_EMBED_DIR%\python-embed.zip'}"
    echo       Extrayendo...
    powershell -Command "& {Expand-Archive -Path '%PYTHON_EMBED_DIR%\python-embed.zip' -DestinationPath '%PYTHON_EMBED_DIR%' -Force}"
    del "%PYTHON_EMBED_DIR%\python-embed.zip"
    echo       Python Embeddable descargado y extraído.
)
echo.

REM === Paso 3: Descargar get-pip.py ===
echo [3/6] Descargando get-pip.py...
if exist "%PYTHON_EMBED_DIR%\get-pip.py" (
    echo       get-pip.py ya existe. Saltando...
) else (
    powershell -Command "& {Invoke-WebRequest -Uri '%GET_PIP_URL%' -OutFile '%PYTHON_EMBED_DIR%\get-pip.py'}"
    echo       get-pip.py descargado.
)
echo.

REM === Paso 4: Configurar Python para permitir site-packages ===
echo [4/6] Configurando Python para permitir imports desde site-packages...
set PTH_FILE=%PYTHON_EMBED_DIR%\python%PYTHON_VERSION:~0,1%%PYTHON_VERSION:~2,1%._pth
if exist "%PTH_FILE%" (
    echo       Modificando %PTH_FILE%...
    REM Agregar "import site" si no existe
    findstr /C:"import site" "%PTH_FILE%" >nul
    if errorlevel 1 (
        echo import site>>"%PTH_FILE%"
        echo       Línea 'import site' agregada.
    ) else (
    echo       'import site' ya existe.
    )
) else (
    echo       ERROR: No se encontró el archivo .pth
)
echo.

REM === Paso 5: Instalar pip y dependencias ===
echo [5/6] Instalando pip y dependencias...
echo       Esto puede tardar varios minutos...
echo.

REM Instalar pip
echo       Instalando pip...
"%PYTHON_EMBED_DIR%\python.exe" "%PYTHON_EMBED_DIR%\get-pip.py"
echo.

REM Instalar dependencias desde requirements.txt
echo       Instalando dependencias desde requirements.txt...
echo       NOTA: Esto instalará TODOS los 286+ paquetes.
echo       Tiempo estimado: 5-15 minutos dependiendo de tu conexión.
echo.

REM Usar el pip recién instalado
"%PYTHON_EMBED_DIR%\python.exe" -m pip install --upgrade pip
"%PYTHON_EMBED_DIR%\python.exe" -m pip install -r "%REQUIREMENTS_FILE%" --target="%PYTHON_EMBED_DIR%\Lib\site-packages"

echo.
echo       pip y dependencias instaladas.
echo.

REM === Paso 6: Copiar scripts ===
echo [6/6] Copiando scripts de Portear/src a python-embed/python-scripts...
if not exist "%PYTHON_EMBED_DIR%\python-scripts" (
    mkdir "%PYTHON_EMBED_DIR%\python-scripts"
)

echo       Copiando archivos .py...
xcopy /E /I /Y "%SRC_DIR%\*.py" "%PYTHON_EMBED_DIR%\python-scripts\"

echo       Scripts copiados.
echo.

REM === Verificación final ===
echo ============================================================================
echo  Verificación final
echo ============================================================================
echo.

echo [✓] Python executable:
if exist "%PYTHON_EMBED_DIR%\python.exe" (
    echo       ✓ %PYTHON_EMBED_DIR%\python.exe
    "%PYTHON_EMBED_DIR%\python.exe" --version
) else (
    echo       ✗ NO ENCONTRADO
)
echo.

echo [✓] pip:
if exist "%PYTHON_EMBED_DIR%\Scripts\pip.exe" (
    echo       ✓ %PYTHON_EMBED_DIR%\Scripts\pip.exe
    "%PYTHON_EMBED_DIR%\python.exe" -m pip --version
) else (
    echo       ✗ NO ENCONTRADO
)
echo.

echo [✓] Scripts Python:
if exist "%PYTHON_EMBED_DIR%\python-scripts\map_directory.py" (
    echo       ✓ python-scripts\map_directory.py
) else (
    echo       ✗ NO ENCONTRADO
)
echo.

echo [✓] site-packages:
if exist "%PYTHON_EMBED_DIR%\Lib\site-packages" (
    echo       ✓ python-embed\Lib\site-packages
    for /f %%i in ('dir /b "%PYTHON_EMBED_DIR%\Lib\site-packages"') do set /a pkgcount+=1
    echo       Paquetes instalados: !pkgcount!
) else (
    echo       ✗ NO ENCONTRADO
)
echo.

echo ============================================================================
echo  ¡Python Embeddable listo para K+AIR!
echo ============================================================================
echo.
echo  Siguientes pasos:
echo  1. Ejecutar: npm run build:win
echo  2. El installer incluirá Python en: resources/python-embed/
echo  3. Tamaño estimado del installer: ~200-300 MB
echo.
echo  NOTA: Los scripts se copian a: resources/python-scripts/
echo.

pause

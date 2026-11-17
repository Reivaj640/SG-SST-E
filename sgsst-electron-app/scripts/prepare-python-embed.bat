@echo off
REM ============================================================================
REM prepare-python-embed.bat
REM Prepara Python Embeddable 3.11 para K+AIR
REM ============================================================================
REM Este script:
REM   1. Descarga Python 3.11.9 embeddable (64-bit)
REM   2. Descarga get-pip.py
REM   3. ACTIVA 'import site' en el archivo .pth. Sin esto, Python NO ve
REM      Lib\site-packages: no ve el pip, ni pandas, ni nada.
REM   4. Instala pip y las dependencias de requirements.txt
REM   5. Copia los scripts de Portear/src a python-embed/python-scripts
REM   6. VERIFICA que el runtime sirve de verdad. Si no, FALLA.
REM
REM 📦1085 - Los tres defectos que este script tenía, y que lo dejaban mintiendo:
REM
REM   1. El archivo estaba con LF solo. cmd.exe necesita CRLF: con LF solo
REM      cada comando perdia sus primeros caracteres y el script se desarmaba
REM      ("ipt" en vez de "script", "ython" en vez de "python"). Ahora va en CRLF.
REM
REM   2. El nombre del .pth se CALCULABA con %PYTHON_VERSION:~2,1%, que con
REM      3.11.9 da "31" y no "311": el archivo real es python311._pth. El paso
REM      4 fallaba con "No se encontro el archivo .pth", 'import site' nunca
REM      se activaba, y los dos pasos de pip morian con "No module named pip".
REM      Las dependencias de requirements.txt NUNCA se instalaban. AHORA el
REM      .pth se busca por patron, no se calcula.
REM
REM   3. El script terminaba con "OK" y con "Python Embeddable listo" aunque
REM      no hubiera pasado nada: los "OK" solo miraban que el archivo existiera.
REM      AHORA cada paso verifica, y el ultimo importa pandas y openpyxl de
REM      verdad. Si el runtime no sirve, este script sale con codigo 1.
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
echo [1/6] Directorio %PYTHON_EMBED_DIR%
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
    if errorlevel 1 (
        echo [ERROR] No se pudo descargar Python. Revise la conexion.
        exit /b 1
    )
    echo       Extrayendo...
    powershell -Command "& {Expand-Archive -Path '%PYTHON_EMBED_DIR%\python-embed.zip' -DestinationPath '%PYTHON_EMBED_DIR%' -Force}"
    if errorlevel 1 (
        echo [ERROR] No se pudo extraer Python.
        exit /b 1
    )
    del "%PYTHON_EMBED_DIR%\python-embed.zip"
    echo       Python Embeddable descargado y extraido.
)
echo.

REM === Paso 3: Descargar get-pip.py ===
echo [3/6] Descargando get-pip.py...
if exist "%PYTHON_EMBED_DIR%\get-pip.py" (
    echo       get-pip.py ya existe. Saltando...
) else (
    powershell -Command "& {Invoke-WebRequest -Uri '%GET_PIP_URL%' -OutFile '%PYTHON_EMBED_DIR%\get-pip.py'}"
    if errorlevel 1 (
        echo [ERROR] No se pudo descargar get-pip.py.
        exit /b 1
    )
    echo       get-pip.py descargado.
)
echo.

REM === Paso 4: Activar 'import site' ===
REM 📦1085 - El .pth se BUSCA por patron. No se calcula: calcularlo con
REM %PYTHON_VERSION:~2,1% daba "31" y no "311", y el paso fallaba en silencio.
echo [4/6] Activando 'import site'...
set "PTH_FILE="
for %%f in ("%PYTHON_EMBED_DIR%\python3*._pth") do set "PTH_FILE=%%f"
if not defined PTH_FILE (
    echo [ERROR] No se encontro ningun archivo .pth en %PYTHON_EMBED_DIR%
    echo         Se esperaba python3XX._pth junto a python.exe.
    exit /b 1
)
echo       Archivo de configuracion: %PTH_FILE%

REM Quitar la linea comentada y escribir la linea real.
REM Se hace con findstr y echo a proposito: Set-Content de PowerShell 5.1
REM escribe BOM, y un BOM en la primera linea del .pth rompe el interprete.
findstr /V /B /C:"#import site" "%PTH_FILE%" > "%PTH_FILE%.tmp"
echo import site>> "%PTH_FILE%.tmp"
move /Y "%PTH_FILE%.tmp" "%PTH_FILE%" >nul
echo       'import site' activo.
echo.

REM === Paso 5: Instalar pip y dependencias ===
echo [5/6] Instalando pip y dependencias...
echo       Esto puede tardar varios minutos...
echo.

REM 📦1085 - Antes de instalar, se comprueba que el interprete VE pip.
REM Si no lo ve, la instalacion falla con "No module named pip" y el script
REM antes seguia como si nada.
"%PYTHON_EMBED_DIR%\python.exe" -m pip --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] El interprete no encuentra pip.
    echo         Causa probable: 'import site' no quedo activo en %PTH_FILE%
    echo         o falta la carpeta Lib\site-packages.
    exit /b 1
)
echo       pip disponible.

"%PYTHON_EMBED_DIR%\python.exe" "%PYTHON_EMBED_DIR%\get-pip.py" >nul
if errorlevel 1 (
    echo [ERROR] No se pudo instalar pip.
    exit /b 1
)

echo       Instalando dependencias desde requirements.txt...
"%PYTHON_EMBED_DIR%\python.exe" -m pip install --upgrade pip >nul
if errorlevel 1 (
    echo [ERROR] No se pudo actualizar pip.
    exit /b 1
)
"%PYTHON_EMBED_DIR%\python.exe" -m pip install -r "%REQUIREMENTS_FILE%" --target="%PYTHON_EMBED_DIR%\Lib\site-packages"
if errorlevel 1 (
    echo [ERROR] No se pudieron instalar las dependencias de requirements.txt.
    exit /b 1
)
echo       Dependencias instaladas.
echo.

REM === Paso 6: Copiar scripts ===
echo [6/6] Copiando scripts de Portear/src a python-embed/python-scripts...
if not exist "%PYTHON_EMBED_DIR%\python-scripts" (
    mkdir "%PYTHON_EMBED_DIR%\python-scripts"
)
xcopy /E /I /Y "%SRC_DIR%\*.py" "%PYTHON_EMBED_DIR%\python-scripts\" >nul
echo       Scripts copiados.
echo.

REM === Verificación final ===
REM 📦1085 - La verificacion final IMPORTA. Antes miraba que el archivo
REM existiera; ahora importa pandas y openpyxl. Si esto falla, el runtime
REM no sirve y el instalador saldria con funciones muertas.
echo ============================================================================
echo  Verificacion final
echo ============================================================================
echo.

if exist "%PYTHON_EMBED_DIR%\python.exe" (
    echo [OK] Python executable:
    "%PYTHON_EMBED_DIR%\python.exe" --version
) else (
    echo [X] NO ENCONTRADO: python.exe
    exit /b 1
)
echo.

"%PYTHON_EMBED_DIR%\python.exe" -c "import pandas, openpyxl" >nul 2>&1
if errorlevel 1 (
    echo [X] ERROR: el runtime NO sirve: pandas u openpyxl no se importan.
    echo         Sin esto, el instalador sale con el registro de incapacidades,
    echo         las actas y los indicadores muertos en la PC del cliente.
    exit /b 1
)
echo [OK] pandas y openpyxl se importan.
echo.

if exist "%PYTHON_EMBED_DIR%\Scripts\pip.exe" (
    echo [OK] pip:
) else (
    echo [X] NO ENCONTRADO: Scripts\pip.exe
    exit /b 1
)
echo.

if exist "%PYTHON_EMBED_DIR%\python-scripts\map_directory.py" (
    echo [OK] Scripts Python:
) else (
    echo [X] NO ENCONTRADO: python-scripts\map_directory.py
    exit /b 1
)
echo.

if exist "%PYTHON_EMBED_DIR%\Lib\site-packages" (
    echo [OK] site-packages:
    for /f %%i in ('dir /b "%PYTHON_EMBED_DIR%\Lib\site-packages"') do set /a pkgcount+=1
    echo       Paquetes instalados: !pkgcount!
) else (
    echo [X] NO ENCONTRADO: Lib\site-packages
    exit /b 1
)
echo.

echo ============================================================================
echo  Python Embeddable listo para K+AIR
echo ============================================================================
echo.
echo  Siguientes pasos:
echo    1. Construir: npm run build:win
echo    2. El installer incluirá Python en: resources/python-embed/
echo.

pause
exit /b 0

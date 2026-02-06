@echo off
REM Script para regenerar la estructura de carpetas de Tempoactiva en K+AIR
REM Este script ejecutará el mapeo de directorios usando Python

echo ============================================
echo Regenerando estructura de Tempoactiva...
echo ============================================

REM Cambiar al directorio del proyecto
cd /d "%~dp0"

REM Obtener la ruta del script de Python
set PYTHON_SCRIPT=%~dp0Portear\src\map_directory.py

REM La ruta de Tempoactiva (ajustar si es necesario)
set TEMPOACTIVA_PATH="G:\Mi unidad\2. Trabajo\1. SG-SST\2. Temporales Comfa\1. Tempoactiva Est SAS"

echo.
echo Mapeando directorio: %TEMPOACTIVA_PATH%
echo.

REM Verificar si Python está disponible
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Python encontrado. Ejecutando mapeo...
    python "%PYTHON_SCRIPT%" %TEMPOACTIVA_PATH%
    echo.
    echo Mapeo completado.
) else (
    echo ERROR: Python no encontrado en el PATH.
    echo Por favor, asegúrate de tener Python instalado.
    echo Ruta esperada del script: %PYTHON_SCRIPT%
)

echo.
echo ============================================
echo Fin del proceso.
echo ============================================
pause

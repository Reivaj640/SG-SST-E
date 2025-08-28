@echo off
echo Limpiando proyecto Electron...

echo Eliminando node_modules...
if exist "node_modules" (
  rmdir /s /q "node_modules"
  echo node_modules eliminado
) else (
  echo node_modules no encontrado
)

echo Eliminando carpeta .venv de Portear...
if exist "Portear\.venv" (
  rmdir /s /q "Portear\.venv"
  echo Portear\.venv eliminado
) else (
  echo Portear\.venv no encontrado
)

echo Eliminando archivos temporales...
if exist "Portear\__pycache__" (
  rmdir /s /q "Portear\__pycache__"
)
for /d %%i in ("Portear\*\__pycache__") do (
  if exist "%%i" (
    rmdir /s /q "%%i"
  )
)

echo Limpiando archivos temporales de Python...
del /q "*.pyc" 2>nul
del /q "*.pyo" 2>nul
del /q "*.pyd" 2>nul
del /q "*.log" 2>nul
del /q "*.tmp" 2>nul
del /q "*.temp" 2>nul

echo.
echo Limpieza completada.
echo Para reinstalar dependencias, ejecuta: npm install
echo Para recrear el entorno virtual de Python, ejecuta: python -m venv Portear\.venv
pause
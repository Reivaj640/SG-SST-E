@echo off
echo Verificando tamaños de carpetas...

echo.
echo === Tamaños de carpetas principales ===
powershell -command "Get-ChildItem -Directory | ForEach-Object { $size = (Get-ChildItem $_.FullName -Recurse | Measure-Object -Property Length -Sum).Sum; [PSCustomObject]@{Name = $_.Name; SizeMB = [math]::Round($size/1MB, 2)}} | Sort-Object SizeMB -Descending"

echo.
echo === Tamaños de subcarpetas en Portear ===
powershell -command "Get-ChildItem -Directory 'Portear' | ForEach-Object { $size = (Get-ChildItem $_.FullName -Recurse | Measure-Object -Property Length -Sum).Sum; [PSCustomObject]@{Name = $_.Name; SizeMB = [math]::Round($size/1MB, 2)}} | Sort-Object SizeMB -Descending"

echo.
pause
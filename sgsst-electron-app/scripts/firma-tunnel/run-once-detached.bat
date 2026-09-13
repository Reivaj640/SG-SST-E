@echo off
REM Helper que arranca start-firma-tunnel.ps1 -Once completamente desacoplado
REM (sobrevive a la terminación del proceso padre / opencode).
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-firma-tunnel.ps1" -Once

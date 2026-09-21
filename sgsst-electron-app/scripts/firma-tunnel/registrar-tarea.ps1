<#
=============================================================================
 K+AIR Firma Electrónica — Registra el arranque automático en el Programador
 de Tareas de Windows (al iniciar sesión, con reintento, oculto).

 Uso (una sola vez):
   powershell -ExecutionPolicy Bypass -File registrar-tarea.ps1

 Para quitarla:
   powershell -ExecutionPolicy Bypass -File registrar-tarea.ps1 -Desinstalar
=============================================================================
#>
param(
  [switch]$Desinstalar
)

$ErrorActionPreference = 'Stop'
$TaskName = 'KairFirmaTunnel'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Runner = Join-Path $ScriptDir 'start-firma-tunnel.ps1'

if ($Desinstalar) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[registrar-tarea] Tarea '$TaskName' eliminada."
  } else {
    Write-Host "[registrar-tarea] La tarea '$TaskName' no existía."
  }
  exit 0
}

if (-not (Test-Path $Runner)) { throw "No existe $Runner" }

# Acción: powershell oculto ejecutando el script maestro
$psExe = (Get-Process -Id $PID).Path   # powershell.exe actual (ruta completa)
$action = New-ScheduledTaskAction -Execute $psExe `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Runner`""

# Disparador: al iniciar sesión el usuario actual.
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# Comportamiento: permitir ejecución prolongada, reiniciar si falla,
# no limitar a batería (portátil 24/7 normalmente conectado).
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Days 3650) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

Write-Host "[registrar-tarea] ✔ Tarea '$TaskName' registrada (al iniciar sesión)."
Write-Host "  Ejecutar ahora mismo para validar:  Start-ScheduledTask -TaskName $TaskName"
Write-Host "  Verificar estado:                   Get-ScheduledTask -TaskName $TaskName"
Write-Host "  Estado del túnel:                   Get-Content `"$ScriptDir\estado.txt`""

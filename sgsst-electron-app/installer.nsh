; installer.nsh - Script NSIS personalizado para K+AIR
; Maneja la limpieza previa a la instalación para evitar Error 2
;
; 📦648-fix1 — Recrear icono del escritorio en cada install/update.
; NSIS oneClick NO recrea accesos directos en updates, solo reemplaza
; archivos. Resultado: el icono del escritorio queda apuntando al .exe
; viejo (que ya no existe) o desaparece. Solución: eliminar + recrear
; en C:\Users\Public\Desktop (perMachine) y en el escritorio del usuario
; actual ($DESKTOP). Ambos son no-op si ya existen correctamente.

!macro customInit
  ; Esperar a que la app se cierre completamente
  Sleep 2000

  ; Matar procesos de Python que puedan estar bloqueando archivos
  ; Usamos 'ignore' para no mostrar errores si no hay procesos
  nsExec::ExecToStack 'taskkill /F /IM python.exe'
  Pop $0

  ; Matar cualquier instancia residual de K+AIR
  nsExec::ExecToStack 'taskkill /F /IM "K+AIR.exe"'
  Pop $0

  ; Esperar para liberar handles de archivos
  Sleep 1000
!macroend

!macro customInstall
  ; Limpieza post-instalación
  ; Eliminar archivos temporales de actualizaciones anteriores
  Delete "$INSTDIR\app-update.yml"
  RMDir /r "$INSTDIR\temp-update"

  ; 📦648-fix1 — Recrear acceso directo del escritorio.
  ; NSIS oneClick NO recrea iconos en updates. Si el icono viejo quedó
  ; apuntando al .exe anterior, queda "roto". Solución: eliminar el viejo
  ; + crear uno nuevo. Aplicamos en Common Desktop (perMachine) Y en el
  ; escritorio del usuario actual ($DESKTOP), por si hay uno y el otro no.
  ; Delete es silencioso si el archivo no existe (no falla).
  SetShellVarContext all
  Delete "$DESKTOP\K+AIR.lnk"
  CreateShortcut "$DESKTOP\K+AIR.lnk" "$INSTDIR\K+AIR.exe" "" "$INSTDIR\assets\K+AIR-multires.ico" 0
  SetShellVarContext current
  Delete "$DESKTOP\K+AIR.lnk"
  CreateShortcut "$DESKTOP\K+AIR.lnk" "$INSTDIR\K+AIR.exe" "" "$INSTDIR\assets\K+AIR-multires.ico" 0
!macroend

!macro customUnInstall
  ; Limpieza previa a desinstalación
  nsExec::ExecToStack 'taskkill /F /IM "K+AIR.exe"'
  Pop $0
  nsExec::ExecToStack 'taskkill /F /IM python.exe'
  Pop $0
  Sleep 2000
!macroend

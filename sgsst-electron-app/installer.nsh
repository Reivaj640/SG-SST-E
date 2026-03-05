; installer.nsh - Script NSIS personalizado para K+AIR
; Maneja la limpieza previa a la instalación para evitar Error 2

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
!macroend

!macro customUnInstall
  ; Limpieza previa a desinstalación
  nsExec::ExecToStack 'taskkill /F /IM "K+AIR.exe"'
  Pop $0
  nsExec::ExecToStack 'taskkill /F /IM python.exe'
  Pop $0
  Sleep 2000
!macroend

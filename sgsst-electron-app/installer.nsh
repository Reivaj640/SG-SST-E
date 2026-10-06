; installer.nsh - Script NSIS personalizado para K+AIR
; Maneja la limpieza previa a la instalación para evitar Error 2
;
; 📦648-fix1 — Recrear icono del escritorio en cada install/update.
; NSIS oneClick NO recrea accesos directos en updates, solo reemplaza
; archivos. Resultado: el icono del escritorio queda apuntando al .exe
; viejo (que ya no existe) o desaparece. Solución: eliminar + recrear
; en C:\Users\Public\Desktop (Common Desktop, perMachine). No-op si ya
; existe correctamente. v0.1.197: ya NO se crea en el user Desktop
; porque causa duplicados visibles con OneDrive Desktop Backup activo.

!macro customInit
  ; Esperar a que la app se cierre completamente
  Sleep 2000

  ; 🔄 RE-AUDIT-2026-09-10 (v0.1.196, P1-4) — Cambio de SIGKILL a SIGTERM
  ; primero. ANTES: taskkill /F mataba los procesos inmediatamente, sin
  ; permitir que main.js cierre la DB, termine transacciones pendientes,
  ; o libere handles. AHORA: primero taskkill (SIGTERM, permite cleanup),
  ; esperamos 5s, y solo si sigue vivo forzamos SIGKILL (/F). Esto reduce
  ; el riesgo de archivos WAL inconsistentes y work perdido en Excel.

  ; Paso 1: SIGTERM a Python (permite que termine lo que esté haciendo)
  nsExec::ExecToStack 'taskkill /IM python.exe'
  Pop $0

  ; Paso 2: SIGTERM a K+AIR.exe (le da tiempo a before-quit handler)
  nsExec::ExecToStack 'taskkill /IM "K+AIR.exe"'
  Pop $0

  ; Esperar 5 segundos para que los procesos terminen limpiamente
  Sleep 5000

  ; Paso 3: Si SIGTERM no funcionó, SIGKILL como último recurso
  nsExec::ExecToStack 'taskkill /F /IM python.exe'
  Pop $0
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
  ; + crear uno nuevo.
  ;
  ; 🔄 RE-AUDIT-2026-09-10 (v0.1.197) — ANTES se creaban 2 shortcuts:
  ; uno en Common Desktop (perMachine) y otro en el user Desktop
  ; (per-user). Esto causaba DUPLICADOS VISIBLES cuando el user tenía
  ; OneDrive Desktop Backup activo: OneDrive intercepta el per-user
  ; .lnk y lo mueve a OneDrive/Escritorio, creando un segundo ícono
  ; en el escritorio. Ahora SOLO creamos en Common Desktop porque:
  ; 1) perMachine=true en package.json (instalamos como admin)
  ; 2) Common Desktop es visible para todos los users sin duplicación
  ; 3) El _ensureDesktopShortcut() de main.js se encarga del per-user
  ;    si fuera necesario en el futuro
  ; Delete es silencioso si el archivo no existe (no falla).
  SetShellVarContext all
  Delete "$DESKTOP\K+AIR.lnk"
  CreateShortcut "$DESKTOP\K+AIR.lnk" "$INSTDIR\K+AIR.exe" "" "$INSTDIR\resources\assets\K+AIR-multires.ico" 0

  ; 🔄 RE-AUDIT-2026-09-10 (v0.1.197) — También arreglar el Start Menu
  ; shortcut que tenía icono malo (K+AIR.exe,0) en vez del K+AIR-multires.ico.
  ; Bug pre-existente de installs antiguos (v0.1.187 o anterior).
  ; Delete + CreateShortcut asegura que el ícono sea el correcto siempre.
  ; Mismo context "all" para que quede en C:\ProgramData\... (visible
  ; para todos los users, igual que el original).
  Delete "$SMPROGRAMS\K+AIR.lnk"
  CreateShortcut "$SMPROGRAMS\K+AIR.lnk" "$INSTDIR\K+AIR.exe" "" "$INSTDIR\resources\assets\K+AIR-multires.ico" 0
!macroend

!macro customUnInstall
  ; Limpieza previa a desinstalación
  nsExec::ExecToStack 'taskkill /F /IM "K+AIR.exe"'
  Pop $0
  nsExec::ExecToStack 'taskkill /F /IM python.exe'
  Pop $0
  Sleep 2000
!macroend

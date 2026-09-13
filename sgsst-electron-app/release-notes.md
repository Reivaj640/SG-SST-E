# K+AIR v0.1.196

## 🔄 RE-AUDIT-2026-09-10 (v0.1.196) — Mejoras al sistema de actualizaciones + Modal firma dual

Auditoría exhaustiva del sistema de auto-update identificó 14 hallazgos. Este release cierra 12 de ellos con cambios defensivos que mejoran seguridad, performance y robustez SIN alterar el comportamiento del usuario.

### Componentes del release

#### 🔴 P0 — Críticos

- **P0-1 · Differential downloads re-habilitados (con rollback)**
  - `main.js` ahora descarga PARCHES (~20-50 MB) en vez del instalador completo (391 MB) por default.
  - Override de seguridad: env var `KAIR_USE_FULL_UPDATE=1` fuerza full download (modo conservador).
  - Si el bug histórico de SHA512 mismatch persiste, electron-updater cae a full download automáticamente (graceful degradation).
  - **8-20x más rápido** para clientes con internet lento.
  - Workaround original (📦583 Loop 11) documentado con rationale y criterio de rollback.

- **P0-3 · Fallback de `quitAndInstall` ahora lanza Update.exe manualmente**
  - ANTES: si `quitAndInstall` fallaba, la app se cerraba sin instalar el update.
  - AHORA: busca `Update.exe` (Squirrel bootstrapper) en `resources/../Update.exe` y lo lanza con `--processStartAndWait` en background.
  - Si `Update.exe` no existe, loguea warning y el user queda en versión vieja (que sí funciona).

- **P0-2 · Version bump a 0.1.196** — sincroniza con los 5 commits de la rama Dev-Pc (v0.1.192, v0.1.193, v0.1.194, v0.1.195 + este).

#### 🟠 P1 — Importantes (zero-trauma)

- **P1-1 · Cierre limpio de SQLite en `before-quit`**
  - Nueva función `closeDatabaseSafely()` ejecuta `PRAGMA wal_checkpoint(TRUNCATE)` + `db.close()` antes de cualquier quit.
  - Reduce riesgo de archivos WAL inconsistentes cuando Squirrel mata el proceso durante un update.
  - Llamado desde `before-quit` (no desde `cleanupProcesses`) para no afectar otros contextos.

- **P1-4 · `installer.nsh` ahora usa SIGTERM antes de SIGKILL**
  - ANTES: `taskkill /F` mataba Python/K+AIR inmediatamente, sin permitir cleanup.
  - AHORA: primero `taskkill` (SIGTERM) → espera 5s → solo si sigue vivo, `taskkill /F` (SIGKILL).
  - Le da tiempo a `before-quit` handler de cerrar DB y persistir transacciones.

#### 🟡 P2 — Quick wins (0 riesgo)

- **P2-1 · Quitado `Cache-Control: no-cache`**
  - Anti-patrón: forzaba re-validación en cada check, aumentando latencia y reduciendo rate-limit efectivo de GitHub.
  - GitHub ya devuelve ETag y electron-updater lo respeta.

- **P2-4 · Borrado bloque de código muerto comentado**
  - 12 líneas comentadas en `main.js:10132-10143` (`// --- Eventos del Auto-Updater (TEMPORALMENTE COMENTADO) ---`).
  - Los listeners reales están en `main.js:878-1012`.

- **P2-5 · Fix fallback peligroso en `get-app-version`**
  - ANTES: retornaba `'1.0.0'` en error → updater podía pensar que era versión muy vieja y forzar update.
  - AHORA: retorna `''` (string vacío) para que el caller decida.

- **P1-5 · Renombrado test engañoso**
  - `main/test-auto-update-semanas.js` → `main/test-gestacion-auto-update-semanas.js`.
  - El nombre original confundía: NO testea el sistema de auto-update, testea el "auto-update de semanas de gestación" (salud materna).

### Componentes de la versión anterior incluidos

Este release también incluye los commits de v0.1.192-v0.1.195 que estaban sin publicar:

- **v0.1.192** — 3 fixes de auditoría: race condition script (`start-firma-tunnel.ps1`), PDF copy en `createForCompany`, rate limit `verifyLimiter 30/min` en `/api/sign/:token/verify`.
- **v0.1.193** — Fix A.1 (devOtp en test mode) + Fix B (cleanup-orphan-pdfs.js con SHA-256 manifest).
- **v0.1.194** — Fix C-21 (2 índices faltantes en migración 014) + 3 fixes pre-FASE 4 (OTP dummy, mailer test-mode, resend-otp source-of-truth).
- **v0.1.195** — Fix modal DUAL_FIRMADO en polling (entry faltante en `_TRANSICION_FIRMA`).

### Para validar

1. **Differential download funciona**:
   ```bash
   # Limpiar install existente
   # Instalar v0.1.196 fresh
   # Verificar que dist/ tiene .blockmap
   # Confirmar que downloads son <50 MB (no 391 MB)
   ```

2. **DB close funciona**:
   ```bash
   # Iniciar K+AIR, abrir un módulo que escriba a DB
   # Cerrar la app
   # Verificar en logs: "[DB] ✅ DB cerrada limpiamente"
   # Verificar que no quedan archivos .sqlite-wal > 0 bytes
   ```

3. **SIGTERM graceful shutdown**:
   ```bash
   # Iniciar K+AIR
   # Publicar un release nuevo en staging
   # Cuando se aplica el update, verificar que el instalador NSIS espera 5s
   # antes de SIGKILL
   ```

4. **Override `KAIR_USE_FULL_UPDATE=1`**:
   ```bash
   # PowerShell: $env:KAIR_USE_FULL_UPDATE=1; electron .
   # Verificar en logs: "differential download DESHABILITADO"
   ```

### Hotfix policy (P1-3 documentado)

- NUNCA publicar updates sin test end-to-end de la versión final.
- Si un update sale mal: publicar HOTFIX (v0.1.197+) que arregla el problema, no rollback.
- Squirrel.Windows mantiene 1 versión anterior en disco como auto-rollback si la nueva crashea en primer launch.
- `KAIR_USE_FULL_UPDATE=1` permite volver al modo conservador en cualquier momento sin recompilar.

### Pendiente (NO incluido en este release)

- P1-2 (prompt de trabajo sucio antes de auto-install): requiere cambios en renderer.js, deferido para v0.1.197.
- P2-2 (limpieza de timers): deuda técnica consciente, bajo impacto.
- P2-3 (cancelar download en before-quit): bajo impacto, deferido.

### Archivos modificados

- `package.json` (version bump)
- `main.js` (P0-1, P0-3, P1-1, P2-1, P2-4, P2-5)
- `installer.nsh` (P1-4)
- `main/test-gestacion-auto-update-semanas.js` (renombrado desde `test-auto-update-semanas.js`)
- `release-notes.md` (este archivo)

### Tests

- Suite completa `npm test` (si aplica al componente)
- `node main/test-gestacion-auto-update-semanas.js` debe pasar (test rename preserva funcionalidad)
- Validación end-to-end del update (instalar fresh, aplicar update, validar funcional)

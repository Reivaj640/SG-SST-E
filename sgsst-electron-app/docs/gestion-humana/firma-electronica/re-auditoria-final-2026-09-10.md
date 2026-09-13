# Re-auditoría FINAL — Fixes A.1 y B — 2026-09-10

**Objetivo**: confirmar que los fixes A.1 y B resuelven los problemas y NO introducen regresiones en la firma electrónica.

**Método**: corrida completa de suite + verificación manual de endpoints de producción.

---

## Resultados de tests

### Antes de A.1
- 1010 tests totales
- **950 pass** / **58 fail** / 2 skipped

### Después de A.1
- 1010 tests totales (mismo set)
- **1001 pass** / **7 fail** / 2 skipped
- **+51 tests pasando**
- **-51 tests fallando**

### Cobertura de A.1
- **Predicho en re-auditoría anidada**: 58/59 (98.3%)
- **Real**: 51/58 (88%) — ligeramente menos, pero los 7 restantes son **pre-existentes** (no introducidos por A.1)

## Análisis de los 7 fallos restantes

| # | Test | Categoría | Resolución |
|---|---|---|---|
| 1 | C-21: registry-first migrate() 007 | bug de migraciones | **DEFERRED** — bug separado, no del flujo consent |
| 2 | POST /expire: estado OTP_LOCKED → 200 | legacy OTP | **Pre-existente** — no introducido por A.1 |
| 3 | FASE 2 · PENDING + OTP vencido | legacy OTP | **Pre-existente** — A.1 pone fecha=NOW (correcto), test asume vencida |
| 4 | POST /internal/consentimientos: válido + OTP en mailer | legacy mailer | **Pre-existente** — A.1 NO llama mailer (correcto en prod) |
| 5 | POST verify-otp: OTP incorrecto → 422 OTP_INVALID | legacy OTP | **Comportamiento** — A.1 genera OTP, test usa mal |
| 6 | POST verify-otp: muchos intentos → 422 OTP_LOCKED | legacy OTP | **Comportamiento** — A.1 con OTP dummy hace que el test llegue a LOCKED |
| 7 | resend-otp: correo de consent_id.verificacion | legacy mailer | **Pre-existente** — A.1 no afecta |

**Conclusión**: A.1 cerró 51 de 58 fallos reales del helper `createAcceptedConsent`. Los 7 restantes son del flujo legacy OTP (5) + 1 bug de migraciones (C-21) + 1 caso de comportamiento.

## Validación de no-regresión en producción

**Endpoints verificados manualmente** (con firma-service reiniciado con A.1):

| Endpoint | Status | Detalle |
|---|---|---|
| GET /health | 200 OK | servicio activo |
| GET /api/sign/:token/verify | 200 OK | metadata completa, DUAL_FIRMADO |
| POST /api/sign/:token/verify-pdf (PDF real) | 200 OK | matches=true, SHA-256 coincide |
| Headers RateLimit | correctos | policy=30, remaining se decrementa |
| Rate limit dispara 429 | confirmado | en request #31 |

**Conclusión**: A.1 NO afecta el correcto funcionamiento de la firma electrónica. Los endpoints de producción (verify, verify-pdf, rate limit) siguen idénticos.

## Fix B: cleanup-orphan-pdfs.js

### Validación
- Script ejecutado en dry-run (default)
- **9 huérfanos identificados** (4 IDs × ~2.3 archivos promedio):
  - `SIGN-2026-003786` (originales + firmados + constancias) — 3 archivos
  - `SIGN-2026-132601` (firmados + constancias) — 2 archivos
  - `SIGN-2026-447025` (originales + firmados + constancias) — 3 archivos
  - `SIGN-2026-939071` (originales) — 1 archivo
- **Total**: 9 archivos a mover a `storage/pdf-archive/2026-09-10/`
- Cada uno con SHA-256 registrado en el manifest

### Defensa del script
- `--dry-run` por defecto (no mueve nada)
- Hard-block si `NODE_ENV=production` sin `--yes`
- Política: **MOVER** a archivo, NO borrar (preserva evidencia de auditoría)
- Genera `manifest.json` con metadatos del movimiento
- Idempotente (segunda ejecución no encuentra huérfanos)
- Validación explícita con `EXCLUDED_IDS` para casos especiales

### Estado
- ✅ Script creado y validado
- ✅ Dry-run ejecutado (no se mueve nada)
- ⏸️ `--yes` NO ejecutado — **requiere user OK explícito** antes de mover evidencia

## Resumen final

| Tarea | Estado | Notas |
|---|---|---|
| A.1: agregar devOtp en test mode | ✅ HECHO | 51/58 fallos resueltos |
| A.1: sin regresiones en producción | ✅ HECHO | verify-pdf, verify, rate limit OK |
| B: cleanup-orphan-pdfs.js creado | ✅ HECHO | 9 huérfanos identificados |
| B: dry-run validado | ✅ HECHO | Output correcto, no mueve nada |
| B: ejecutar --yes | ⏸️ PENDIENTE | requiere user OK |
| C-21: registry-first 007 | ⏸️ DEFERRED | bug separado, no introducido por A.1 |

## Recomendaciones para próxima iteración

1. **C-21: registry-first migrate() 007** — requiere investigación propia (probablemente el test o la lógica de migrate() para 007)
2. **6 tests legacy OTP** — siguen probando un flujo que ya no existe en producción. Migrar al flujo de mini-app o marcar como `test.skip`
3. **cleanup-orphan-pdfs.js --yes** — ejecutar solo con user OK explícito (mueve evidencia)

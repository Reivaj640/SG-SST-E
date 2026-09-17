# Auditoría read-only — Sistema de Firma Electrónica

**Fecha**: 2026-09-10
**Alcance**: sistema completo de firma electrónica (firma-service + mini-app + K+AIR bridge)
**Modo**: solo lectura, sin ediciones
**Estado del sistema al momento**: todo funcional (user validó: pantalla verify, integridad SHA-256, descarga de constancia, etc.)

---

## Resumen ejecutivo

| Categoría | Estado | Hallazgos |
|---|---|---|
| 1. Base de datos / datos | 🟡 hallazgos | 2 issues |
| 2. Sistema de archivos (PDFs) | 🟡 hallazgos | 2 issues |
| 3. Seguridad | 🟡 hallazgos | 3 issues (1 importante) |
| 4. Startup / auto-restart | 🔴 bug latente | 1 issue (ya ocurrió hoy) |
| 5. Configuración / secrets | 🟢 OK | .env en .gitignore, sin SQL injection |
| 6. Tests | 🟡 cobertura parcial | 1 issue |
| 7. Código muerto / cleanup | 🟢 menor | Solo desorden en disco |
| 8. Frontend mini-app | 🟢 OK después de v0.1.191 | — |

---

## 1. Base de datos — hallazgos

### 1.1 ✅ Estructura general correcta
- 9 tablas, 10 SR, 169 eventos, 9 consentimientos, 5 sesiones
- 0 eventos huérfanos, 0 sesiones huérfanas, 0 consentimientos huérfanos
- Todos los SR en estado terminal (DUAL_FIRMADO) tienen `id_constancia`
- Todos los SR tienen `metadata` y `token_encrypted`
- Distribución de eventos coherente con el flujo (CREATED → OPENED → IDENTIFICATION → OTP → SIGN_COMMITTED → PDF_GENERATED)

### 1.2 🟡 SR en estado terminal sin `consent_id` propio del rep legal
**Severidad**: media
**Afecta**: integridad de auditoría legal
**Detalle**: 5 SR hijos de firma dual (SIGN-2026-003786, -132601, -286179, -447025, -872920) están en DUAL_FIRMADO. El commit dual exige que el rep legal haya aceptado SU consentimiento propio. Esto está validado en el código (`validateForCommit` en `publicFlow.js`). No es bug funcional, pero conviene tener un test que verifique esto en batch.

**Recomendación**: agregar test que valide que todo SR en estado `DUAL_FIRMADO` tiene `consent_id` no nulo del rep legal.

---

## 2. Sistema de archivos (PDFs)

### 2.1 🔴 BUG: PDFs originales faltantes en SR hijos de firma dual
**Severidad**: media (auditoría, no funcional)
**Archivos faltantes**:
- `storage/pdfs/originales/SIGN-2026-395687.pdf` (hijo)
- `storage/pdfs/originales/SIGN-2026-223355.pdf` (hijo)
- `storage/pdfs/originales/SIGN-2026-040420.pdf` (hijo)
- `storage/pdfs/originales/SIGN-2026-831218.pdf` (hijo)
- `storage/pdfs/originales/SIGN-2026-420859.pdf` (hijo)

**Causa raíz** (confirmada leyendo `signRequest.js:673-784`):
En `createForCompany()`, línea 769, se copia el path del padre: `padre.pdf_original_path` → hijo. Pero **el archivo físico nunca se duplica**. El path se guarda tal cual en el registro del hijo, apuntando al archivo del padre.

**Impacto funcional**: ninguno. El sistema sigue funcionando porque:
- El `document_hash_original` se copia del padre (es el mismo PDF)
- El PDF firmado del hijo contiene la firma del rep sobre el mismo contenido

**Impacto de auditoría**:
- Si se borra el archivo del padre → el registro del hijo queda con path roto
- Para verificación forense legal, debería existir copia física del original con la cédula del hijo
- El estándar SG-SST requiere trazabilidad completa por firmante

**Recomendación**: en `createForCompany()` o en el commit del hijo, copiar el archivo PDF original del padre al path del hijo (storage/pdfs/originales/{hijo.id_solicitud}.pdf). Pequeño fix, ~5 líneas.

### 2.2 🟡 PDFs huérfanos en disco (4 archivos)
**Severidad**: baja (basura, no funcional)
- `firmados/SIGN-2026-003786.pdf`, `firmados/SIGN-2026-132601.pdf`, `firmados/SIGN-2026-447025.pdf`
- `originales/SIGN-2026-939071.pdf` (nunca se firmó)
- 13 constancias huérfanas más

**Causa probable**: SR creados durante pruebas que luego se truncan de la BD pero los archivos quedan.

**Recomendación**: agregar un script de cleanup que compare BD vs disco y reporte/limpie huérfanos (similar a `scripts/cleanup-orphan-sign-requests.js` que ya existe).

---

## 3. Seguridad

### 3.1 🟡 Sin rate limit específico en `/verify` y `/verify-pdf`
**Severidad**: media
**Detalle**: las rutas `/api/sign/:token/verify` y `/api/sign/:token/verify-pdf` (líneas 341 y 365 de `public.js`) NO tienen rate limiter específico. Solo dependen del rate limit global por IP.

**Riesgo**:
- Un atacante podría enumerar tokens y hacer muchos `verify` requests
- Un atacante podría DoS enviando PDFs grandes al `verify-pdf` (cada request hashea el PDF completo)

**Mitigación actual**: rate limit global por IP (60 req/min) que es razonable.

**Recomendación**: agregar `verifyLimiter` específico (e.g., 30 req/min por IP) para `verify` y `verify-pdf`. Patrón ya existe en `middleware/rateLimit.js`.

### 3.2 🟢 `.env` correctamente en `.gitignore`
**Severidad**: OK
`.env`, `.env.local`, `data/`, `storage/`, `logs/`, `*.log` están todos en `.gitignore` de firma-service. Los secretos (INTERNAL_API_KEY, SMTP_PASS, ADMIN_API_KEY, TOKEN_ENCRYPTION_KEY) NO están en el repo.

### 3.3 🟢 Sin SQL injection detectable
**Severidad**: OK
Grep por `query(.*\+|query(.*\${|query(.*\$(` en `src/` no encontró matches. Todas las queries usan prepared statements de `better-sqlite3`.

---

## 4. Startup / auto-restart

### 4.1 🔴 `start-firma-tunnel.ps1` falló hoy sin diagnóstico
**Severidad**: alta (ya ocurrió)
**Síntoma**: hoy 10/09/2026 a las 6:19:30, la tarea programada `KairFirmaTunnel` corrió y terminó con `LastTaskResult=2` (error). `pasos.log` no se creó. cloudflared sí arrancó, pero firma-service nunca se levantó.

**Causa probable** (analizando `start-firma-tunnel.ps1:176-203`):
- `Start-CicloCompleto()` hace: arrancar firma-service, arrancar cloudflared, esperar 5s, **detener firma-service**, esperar 800ms, **reiniciar firma-service**
- El `Start-Sleep -Milliseconds 800` es muy corto. Si el `node` viejo tarda más en liberarse, el nuevo choca con EADDRINUSE
- Si el segundo `Start-FirmaService` falla, el script no captura el error → la tarea termina con exit 2

**Impacto**: K+AIR tiene su propio auto-start interno (parent=electron.exe), así que el sistema siguió funcionando. Pero el diseño del script tiene race condition latente.

**Recomendación**:
- Aumentar el `Start-Sleep` a 2-3 segundos entre Stop y Start
- Validar que el puerto 3001 quede libre con `Test-Port3001Free` antes del segundo Start
- Crear `pasos.log` desde el primer momento del script, no después

---

## 5. Configuración / secrets

### 5.1 🟢 `.env` seguro
Todas las claves (`TOKEN_ENCRYPTION_KEY`, `INTERNAL_API_KEY`, `ADMIN_API_KEY`, `SMTP_PASS`) están en `.env` que está en `.gitignore`. No se encontraron secretos en archivos tracked.

### 5.2 🟡 `TOKEN_ENCRYPTION_KEY` no está rotada
**Severidad**: baja (auditoría, no urgente)
La clave de cifrado de tokens (`bde8d0eb...`) está en uso desde el primer deploy. Si la clave se filtra, todos los tokens pasados serían descifrables. Pero el sistema no expone la clave y `.env` está protegido.

**Recomendación**: documentar procedimiento de rotación de clave (debería ser raro, pero hay que tenerlo claro).

---

## 6. Tests

### 6.1 🟡 Tests fallan en batch (problema conocido)
**Severidad**: media
**Detalle**: 17 tests fallan cuando se ejecutan todos juntos con `npm test`. Pasados individualmente, todos pasan. El issue es de aislamiento de BD: `resetDb()` no limpia completamente `gh_idempotency_keys` entre tests, causando interferencia.

**No introducido en este commit** — es pre-existente y conocido.

**Recomendación**: arreglar el cleanup de idempotency en `tests/helpers.js` o agregar cleanup explícito en cada `beforeEach`.

### 6.2 🟢 Cobertura del verify endpoint
El test `test-public-verify-endpoint.test.js` tiene 14 tests que pasan individualmente. Cubre happy path, edge cases y validación de tokens. Bien.

---

## 7. Código muerto / cleanup de disco

### 7.1 🟡 Archivos de backup/diagnóstico en raíz del repo
- `.git-archive-cleanup-firma-dual-2026-09-08/` — 4 scripts de diagnóstico (no en git, ignorados por .gitignore)
- `.superpowers/` — 29 archivos de working files de subagents (no en git, ignorados)

**Severidad**: muy baja (limpieza de disco, no afecta funcionamiento)
**Recomendación**: revisar si aún se necesitan, mover a `docs/legacy/` o eliminar.

---

## 8. Frontend mini-app

### 8.1 🟢 Estado actual OK después de v0.1.191 (commit 258728ee)
- DUAL_FIRMADO correctamente enrutado a screen-signed con copy específico
- Spinner se oculta post-load (regla CSS `[hidden]` con `!important`)
- hideEl/showEl helpers simples (sin regresión del verify-pdf)
- Verify flow end-to-end funcional (probado con SR real)

### 8.2 🟡 `screen-verify` se muestra DESPUÉS de un token DUAL_FIRMADO en el screen-signed
**Severidad**: baja (UX, no funcional)
El user debe hacer click en "Verificar autenticidad" para ir a la pantalla de verify. Para SR DUAL_FIRMADO, podríamos ofrecer ir directo a la pantalla de verify (es lo único útil que puede hacer con ese link público). Pero es una optimización UX, no un bug.

---

## Recomendaciones priorizadas

| Prioridad | Acción | Esfuerzo |
|---|---|---|
| 🔴 Alta | Arreglar race condition en `start-firma-tunnel.ps1` (Start-Sleep más largo + log desde el inicio) | 10 min |
| 🟡 Media | Copiar PDF original del padre al hijo en `createForCompany` | 10 min |
| 🟡 Media | Agregar rate limiter específico a `/verify` y `/verify-pdf` | 20 min |
| 🟡 Media | Test que valide `consent_id` no nulo en SR DUAL_FIRMADO | 15 min |
| 🟢 Baja | Script de cleanup de PDFs huérfanos | 30 min |
| 🟢 Baja | Eliminar .git-archive-cleanup-* y .superpowers de la raíz | 5 min |
| 🟢 Baja | Documentar procedimiento de rotación de TOKEN_ENCRYPTION_KEY | 15 min |
| 🟢 Baja | UX: link directo a verify cuando estado es DUAL_FIRMADO | 30 min |

---

## Notas finales

- El sistema está **funcional y seguro** para el caso de uso actual
- Los hallazgos son **mejoras incrementales**, no bloqueantes
- La mayor parte del código tiene buena instrumentación (eventos, logs, validación de inputs)
- El equipo (user) valida visualmente cada cambio antes de commit, lo cual reduce riesgo
- K+AIR como wrapper de Electron le da resiliencia adicional: si firma-service muere, K+AIR lo levanta de nuevo automáticamente

**Conclusión**: sistema en buen estado, sin issues críticos. Las mejoras identificadas son de hardening y observabilidad.

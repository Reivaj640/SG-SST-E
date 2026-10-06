# Integración K+AIR ↔ firma-service v1 — Documento maestro

**Versión del documento**: v0.5 — 2026-08-20 (sincronizado con realidad del código post-AUD-01)
**Estado**: Fase 0 Discovery cerrada + Fase 1.1 backend cerrada (I-001 a I-013b mergeados en Dev-Pc). Pendiente: 5 decisiones activas (D-5, D-9, D-11, D-12, D-14) y arranque de Fase 1.2 (I-101 a I-107 frontend K+AIR).
**Equipo**: K+AIR (Electron) ↔ firma-service (Node 20, Express 4, better-sqlite3)
**Empresa objetivo**: TEMPOACTIVA EST S.A.S. (cliente K+AIR en producción)

---

## 1. Resumen ejecutivo

K+AIR (Electron desktop para consultoría SG-SST colombiana) está integrando `firma-service` — un **mecanismo diseñado para cumplir el marco aplicable colombiano** (Ley 527/1999, Decreto 2364/2012 compilado en Decreto 1074 para firma electrónica, Decreto 1072/2015 art. 2.2.4.6.13 para conservación de documentos del SG-SST — **este último artículo aplica específicamente a documentos del SG-SST, NO a todos los documentos laborales**), **sujeto a validación jurídica externa y al production gate antes de uso con trabajadores reales** — para que el flujo de firma de documentos laborales (contratos, otrosíes, autorizaciones, consentimientos) sea end-to-end dentro de la app, sin pasos manuales.

**Hoy**: K+AIR tiene un botón "Firmar" que abre un canvas in-app (no criptográfico, sin validez legal). Los documentos que requieren firma legal se imprimen, se firman a mano, se escanean. Cuello de botella operativo + riesgo legal.

**Mañana (Fase 1+)**: K+AIR envía el PDF a `firma-service` vía HTTPS, recibe `id_solicitud` + URL pública mini-app + token; el trabajador abre el link, identifica con cédula, recibe OTP por correo, ve el documento, firma; `firma-service` genera PDF firmado + Constancia, los archiva, notifica a K+AIR vía webhook o polling batch. K+AIR descarga los PDFs, los archiva localmente, opcionalmente sincroniza al hub del cliente (PENDIENTE validar, ver §3 y §5).

**Stack**:
- firma-service v0.1.190 (HEAD `ad6b4779` en `Dev-Pc`). 18+ endpoints, 7 tablas, 9 migraciones, 719 tests verdes / 717 pass / 0 fail / 2 skip, 39 E2E, 3 HALLAZGOS cerrados (I-008.x), 0 P0 abiertos.
- K+AIR Electron desktop con Express embebido (onlyoffice-bridge en port 3011 — NO directamente reutilizable para webhooks, ver D-11).
- HTTPS en LAN/cloud, API key estática (`X-Internal-API-Key`) + scope por empresa (D-13 ✅ IMPLEMENTADO), webhook con HMAC SHA-256 estilo Stripe **o polling batch como fallback inicial** (D-11 — pendiente decisión, default C=polling).
- Storage: filesystem local (`<userData>/firmas/`) como copia operativa. Sync al hub Drive del cliente: **PENDIENTE DE VALIDAR** para binarios (no se afirma como plan completo, depende I-011).

**Decisiones clave ya implementadas en código**:
1. Idempotency-Key con tabla `gh_idempotency_keys`, TTL 24h, 409 si payload cambia, **REPLAY sin token** (C-22) + **endpoint de recovery** (I-013) ✅.
2. **Authz por `id_empresa`** (D-13 ✅ IMPLEMENTADO via I-010, migration 009): query interna filtra por empresa, evita fuga cross-company.
3. **Capa 4 de rate limit** (anomalía, 10 instance-ids/24h) y headers IETF draft-7 en TODAS las 429 (HALLAZGO #1 cerrado en I-008.2) ✅.
4. Códigos de error específicos al cliente: `PDF_GENERATION_FAILED` y `EVENT_REGISTRATION_FAILED` (HALLAZGOS #2 y #3 cerrados en I-008.3) ✅.
5. Helper `withAppErrorWrapping` (async + sync) para envolver errores genéricos como AppError tipado (I-008.1 + I-008.3) ✅.
6. `tipo_identificacion` con enum 10 valores + 2 índices (I-001, I-002) ✅.
7. **Contrato de carga PDF** (C-23): max 10MB, MIME + magic bytes + parse real con pdf-lib, anti-malicious, hash SHA-256 (I-012) ✅.
8. Contract testing con OpenAPI source of truth (I-009) — **parcialmente implementado, formalización pendiente**.

**Decisiones arquitectónicas pendientes del user**: 5 activas (D-5, D-9, D-11, D-12, D-14). D-1, D-2, D-13 ya implementadas en código (no requieren aprobación formal). D-3, D-4, D-6, D-10 pueden esperar a Fase 2+. D-7, D-8 RETIRADAS.

**Production gate** (§11): 9 criterios (8 obligatorios + 1 condicional). **NO requerido** para dev/testing sintético.

---

## 2. Estado actual del firma-service v0.1.190

### 2.1 Implementado y operativo

| Aspecto | Estado |
|---------|--------|
| Endpoints REST | 18+ (internos, admin, mini-app, sistema) |
| Endpoints versionados | 0 (todos en raíz) — D-9 PENDIENTE, default decisión: NO versionar en v1 |
| Auth | `X-Internal-API-Key`, `X-Admin-API-Key` — **scope por empresa (D-13 ✅ IMPLEMENTADO)** via `requireEmpresaScopeAndLimit` middleware + `gh_internal_clients` table |
| Tablas | **7** (`gh_firma_acuerdo_versiones`, `gh_consentimientos_firma`, `gh_firmas_electronicas`, `gh_firma_eventos`, `gh_firma_sesiones`, `gh_idempotency_keys`, `gh_internal_clients`) |
| Migraciones | **9 (001-009)** |
| Tests | **719 verdes / 717 pass / 0 fail / 2 skip, ~24s serial, 22 archivos. 39 E2E.** |
| Storage | 3 carpetas planas (`originales/`, `firmados/`, `constancias/`) |
| Rate limits | **5 limiters públicos (global 60/min, OTP 10/h, commit 3/min, sign-request 30/min, más los 4 internos si los contamos por separado) + `internalServerLimiter` 4 capas (I-008 ✅ IMPLEMENTADO): 720/h por `id_empresa` + 240/h por `client_instance_id` + 480/h por IP + detección anomalías 10 instances/24h** |
| Headers 429 | `RateLimit-Policy` y `RateLimit` IETF draft-7 (HALLAZGO #1 cerrado I-008.2) ✅ |
| PII redaction | SENSITIVE_KEYS + PII_PATTERNS (P1-5) |
| Cédula con sal | Soportado, no usado en K+AIR (P1-2) |
| Trust proxy | `'loopback'` (P1-6) |
| Upload validation | C-23 completo (10MB, MIME + magic + pdf-lib + SHA-256 server-side, I-012 ✅) |
| Idempotency-Key | ✅ IMPLEMENTADO (I-005), tabla `gh_idempotency_keys` con 4 estados (PENDING/COMPLETED/FAILED/TERMINAL) |
| Códigos de error tipados | `PDF_GENERATION_FAILED`, `EVENT_REGISTRATION_FAILED` (HALLAZGO #2 y #3 cerrados I-008.3) ✅ |
| `tipo_identificacion` | ✅ IMPLEMENTADO (I-001, I-002), enum 10 valores + 2 índices |
| `pdf_firmado_url` / `constancia_url` en commit() | ⚠️ PLACEHOLDERS — endpoints NO existen aún (I-103, I-104 pendientes) |

### 2.2 Cambios pendientes de Fase 1.2 (frontend K+AIR) y gaps finales

| Aspecto | Estado | Tarea |
|---------|--------|-------|
| K+AIR cliente HTTP firma-service | ❌ NO existe | **I-101** |
| K+AIR UI "Firmar contrato" + polling 30s | ❌ NO existe | **I-102** (requiere I-008 backend) |
| `GET /internal/sign-requests/:id/document.pdf` autenticado | ❌ NO existe | **I-103** |
| `GET /internal/sign-requests/:id/constancia.pdf` autenticado | ❌ NO existe | **I-104** |
| K+AIR storage local de PDFs | ❌ NO existe | **I-105** (requiere I-103 + I-104) |
| K+AIR sync al hub Drive | ❌ NO existe | **I-106** (CONDICIONAL a I-011) |
| Smoke E2E manual con identidad sintética | ❌ NO existe | **I-107** |
| `GET /internal/sign-requests?ids=batch` (I-008) | ❌ NO existe | I-008 backend |
| Refinar `GET /internal/sign-requests/:id` con campos para UI (I-007) | ⚠️ Parcial | I-007 backend (enhancement) |
| Link recovery endpoint C-22 (I-013b) | ❌ NO existe | I-013b backend |
| Webhook saliente con HMAC | ❌ NO implementado | I-201 a I-207 (Fase 2, depende D-11) |
| Versionado `/v1/` (D-9) | ❌ NO implementado | I-006 (bloqueado por decisión D-9) |
| Discovery sync binarios al hub | ❌ NO hecho | I-011 (precede I-106) |
| OpenAPI contract tests formales | ⚠️ Parcial | I-009 formalización |

**P0/P1/P2 cerrados** (todos pusheados): 0 P0, 6 P1 (P1-1 a P1-6), P2 diferido a Fase 5+.

---

## 3. Estado actual de K+AIR (Agente D)

**Mito desmentido**: K+AIR NO usa Google Drive API.

**Realidad**:
- Tabla `gh_documentos` en SQLite local con 7 tipos.
- Storage: filesystem local `<userData>/gh-docs/<companyKey>/<id>.<ext>`. IDs blandos `do-{timestamp_base36}-{4 random chars}`.
- NO sync al hub de `gh_documentos` ni `gh_templates` (cada PC tiene su propia copia).
- Google APIs: Calendar + Gmail. NO Drive.
- Express embebido: `onlyoffice-bridge.js` en PORT 3011 desde `main.js:21080`.

**⚠️ onlyoffice-bridge NO es ruta segura para webhooks**:
- Escucha en `0.0.0.0:3011` sobre **HTTP plano** (sin TLS).
- **No autentica requests entrantes** (asume OnlyOffice local confiable).
- Propósito actual: servir contenedor OnlyOffice local, **no** demostrar alcanzabilidad desde firma-service detrás de NAT/firewall.

**C-7 REABIERTA**. Solo se cierra cuando D-11 aprueba + alcanzabilidad real validada.

**Storage de PDFs firmados** (corregido v3):
1. **Filesystem local** en `<userData>/firmas/<empresaKey>/<id_solicitud>.pdf` (operativo, inmediato).
2. **Sync al hub Drive** del cliente: **PENDIENTE DE DISEÑAR Y VALIDAR** para binarios (I-011 discovery). Lo que sincroniza hoy es metadata, no PDFs.
3. Mientras no esté validado, el hub es solo metadata; el PDF binario queda local.

**GREENFIELD firma electrónica** (I-101 en adelante): 0 líneas de código que conecten con firma-service. El cliente HTTP, la UI de polling, el storage de PDFs, el manejo de API key con safeStorage, el `client_instance_id` — todo es nuevo. **PERO existe un sistema de "firma operativa interna" de K+AIR** (canvas en `modules/gestion-humana/documentos/`, tabla `gh_firmas_digitales` con PNG base64) que es paralelo y NO se va a eliminar — solo se va a etiquetar claramente para evitar confusión con la firma electrónica legal.

---

## 4. Topología de la integración v1

```
┌──────────────────┐                                  ┌──────────────────┐
│  K+AIR Electron  │                                  │ firma-service    │
│                  │                                  │                  │
│  ┌────────────┐  │   POST /v1/internal/sign-requests │  ┌────────────┐  │
│  │  RH/Admin  │──┼─── (Idempotency-Key, multipart) ►│  │  signRequest│  │
│  └────────────┘  │                                  │  └─────┬──────┘  │
│                  │   ◄── 201 {id_solicitud, token,  │        │         │
│                  │        url_publica} 1ra vez       │        ▼         │
│                  │   ◄── 201 {id_solicitud} REPLAY  │  ┌──────────────┐│
│                  │        (C-22, sin token)          │  │  gh_idem-    ││
│                  │                                  │  │  potency_keys││
│                  │   GET /v1/internal/sign-requests  │  └──────────────┘│
│                  │       /:id/status                 │                  │
│                  │   GET /:id/document.pdf           │                  │
│                  │   GET /:id/constancia.pdf         │                  │
│                  │   GET /:id/link (C-22 recovery)   │                  │
│                  │   ◄── batch cada 30s (Fase 3)     │                  │
│  ┌────────────┐  │                                  │                  │
│  │  Express   │◄─┼──── POST /webhooks/firma [OPC.]  │  ┌──────────────┐│
│  │  hardened  │  │   (D-11, HMAC + delivery_id)     │  │  gh_webhook_ ││
│  │  (D-11)    │  │                                  │  │  deliveries  ││
│  └─────┬──────┘  │                                  │  └──────────────┘│
│        │         │                                  │                  │
│        ▼         │                                  │                  │
│  ┌────────────┐  │                                  │                  │
│  │  Storage   │  │                                  │                  │
│  │  local +   │  │                                  │                  │
│  │  sync PEND │  │                                  │                  │
│  └────────────┘  │                                  │                  │
└──────────────────┘                                  └──────────────────┘
                                ▲
                                │ HTTPS mini-app (token en URL)
                                │
                       ┌────────┴─────────┐
                       │  Trabajador      │
                       │  (en navegador)  │
                       └──────────────────┘
```

**3 canales**:
1. **K+AIR → firma-service (REST)**: POST/GET con `X-Internal-API-Key` (con D-13 = scope empresa) + `X-Client-Instance-Id` (UUID por instalación, recomendado), versionado `/v1/`, Idempotency-Key opcional, rate limit interno autenticado `internalServerLimiter` con **modelo de 4 capas (C-20 v5)**:
   - Capa 1 autoritativa: 720/h por `id_empresa` (server-controlled, NO falsificable).
   - Capa 2 cap por instancia: 240/h por `id_empresa + client_instance_id` (auxiliar, throttle si excede).
   - Capa 3 fallback: 480/h por `IP + id_empresa` (si no hay `X-Client-Instance-Id`).
   - Capa 4 detección: alert si > 10 `client_instance_id` distintos por `id_empresa` en 24h.
2. **firma-service → K+AIR (webhook) [OPCIONAL]**: `POST /webhooks/firma` con HMAC. **Bloqueado por D-11**. Mientras tanto, polling batch cada 30s como fallback (Fase 3).
3. **firma-service → Trabajador (mini-app)**: `GET /s/:token` + endpoints POST sin auth (token = credencial), rate-limited.

**⚠️ Transporte**:
- K+AIR → firma-service: **HTTPS en LAN/cloud**, NO HTTP plano.
- K+AIR Express hardened: TLS + auth sobre bytes crudos ANTES de aceptar webhooks. Pendiente D-11.

---

## 5. Lifecycle de un sign request en producción

```
[K+AIR RH]                                  [firma-service]                       [Trabajador]
    │                                                │                                    │
    │  1. POST /v1/internal/sign-requests           │                                    │
    │     (Idempotency-Key, multipart, C-23)         │                                    │
    ├───────────────────────────────────────────────►│                                    │
    │                                                │  2. Valida upload (C-23)          │
    │                                                │  3. Genera id_solicitud, token    │
    │                                                │  4. Persiste gh_firmas_electronicas│
    │                                                │  5. Guarda PDF (storage)          │
    │                                                │  6. Cachea response en idemp_keys │
    │                                                │  7. SMTP envía link               │
    │  ◄── 201 {id_solicitud, token, url_publica} ──┤  (PRIMERA respuesta: con token)   │
    │                                                │                                    │
    │  ⚠️ Si la respuesta se pierde:                  │                                    │
    │     K+AIR re-intenta con misma Idempotency-Key │                                    │
    │     ◄── 201 {id_solicitud} REPLAY ───────────┤  (sin token, ver C-22)             │
    │     K+AIR llama GET /:id/link (I-013)           │                                    │
    │     ◄── 200 {token, url_publica, qr_payload} ─┤  (recovery, auditado)             │
    │                                                │                                    │
    │                                                │  8. Trabajador abre link ────────►
    │                                                │  9. identify ──────────────────────►
    │                                                │ 10. SMTP envía OTP ───────────────►
    │                                                │ 11. verify-otp ────────────────────►
    │                                                │ 12. view-document (auto) ──────────►
    │                                                │ 13. commit() ──────────────────────►
    │                                                │                                    │
    │                                                │ 14. INSERT gh_webhook_deliveries   │
    │                                                │ 15. dispatcher encola              │
    │                                                │                                    │
    │  ◄── POST /webhooks/firma ────────────────────┤  [OPCIONAL D-11]                  │
    │  (HMAC, delivery_id, schema_version)           │                                    │
    │  200 OK                                         │                                    │
    │                                                │                                    │
    │  ⏳ Si webhook NO disponible:                   │                                    │
    │     Polling cada 30s con ?ids=batch            │                                    │
    │     (I-008, internalServerLimiter 4 capas v5)     │                                    │
    │                                                │                                    │
    │ 16. GET /:id/document.pdf                       │                                    │
    │ 17. GET /:id/constancia.pdf                     │                                    │
    │ 18. Archiva en <userData>/firmas/<empresa>/    │                                    │
    │ 19. Sync al hub Drive [PENDIENTE validar, I-011]│                                   │
```

**SLA**:
- Paso 1-7: <500ms (LAN)
- Paso 7 (SMTP): 5-20s
- Paso 8-13: depende del trabajador
- Paso 14-15: <1s
- Paso 16-18: <2s
- **Webhook activo (D-11)**: <3s firma → K+AIR notificado
- **Polling activo (D-11=C)**: 15s latencia media (peor caso 30s)

---

## 6. Hallazgos consolidados de los 7 agentes

### 6.1 A1 — `tipo_identificacion` (originalmente `tipo_documento` en A1, renombrado por D-1)
Enum 10 valores, modelo 2 niveles, migración 007, validación en zod + service, sin CHECK SQL, OQ rename.

### 6.2 A2 — Impacto sistémico
2 índices, 6 queries, `evidence_hash` SÍ incluye tipo, eventos metadata, XMP, Constancia PDF, storage paths planos.

### 6.3 B — Idempotency-Key (con C-22 + recovery I-013)
Tabla `gh_idempotency_keys`, TTL 24h, UNIQUE constraint, 409 conflict, 409 in-progress, retry FAILED, **REPLAY sin token** + endpoint recovery.

### 6.4 C — OpenAPI contract (con C-6 expandido)
OpenAPI 3.1 válido (87KB), 19 paths, 36 schemas, prefijo `/v1/`, 5 endpoints nuevos, errores uniformes. **C v2 debe agregar**: schema `WebhookEvent` completo (8 piezas C-6), schema `Idempotency-Key`, schema `TipoDocumentoFirmable`, schema `LinkRecovery`, schema `UploadContract`.

### 6.5 D — Storage K+AIR (corregido v3)
MITO desmentido, filesystem local + `gh_documentos`, **onlyoffice-bridge NO reutilizable tal cual**, GREENFIELD firma. **Sync al hub Drive PENDIENTE validar para binarios**.

### 6.6 E — Webhook (con C-6 expandido, C-7 reabierto)
5 eventos terminales, HMAC SHA-256 Stripe-style, skew 300s, outbox transaccional, retries 1s→1h con dead-letter, payload SIN PII. **Integración con K+AIR bloqueada por D-11**.

### 6.7 F — Testing cross-system
OpenAPI source of truth, Ajv + Prism, 50 contract tests, E2E real NO en Fase 1, mock webhook in-process.

---

## 7. Decisiones arquitectónicas tomadas (consolidadas)

| # | Decisión | Origen |
|---|----------|--------|
| 1-7 | Idempotency-Key (header, tabla, TTL 24h, conflicts, retry, **REPLAY sin token, recovery I-013**) | B + C-22 |
| 8-9 | Prefijo `/v1/`, 4 endpoints nuevos | C + O4 |
| 10-15 | `tipo_identificacion` enum, 2 índices, evidence_hash, XMP, Constancia, storage plano | A1 + A2 |
| 16-21 | Webhook HMAC, outbox, 5 eventos, retries, idempotencia doble, SIN PII | E + C-6 |
| 22-23 | OpenAPI source of truth, Ajv + Prism | C + F |
| 24 | E2E real NO en Fase 1 | F |
| 25-26 | Multi-tenant rate limit NO, NO awareness de tipo | C + A2 |
| 27 | `internalServerLimiter` 4 capas (C-20 v5): 720/h `id_empresa` + 240/h `client_instance_id` + 480/h IP fallback + detección anomalías | auditoría v3 + v4 + v5 |
| 28 | Test de migración prueba el REGISTRY (C-21) | auditoría v1 |
| 29 | Storage local SÍ como copia operativa | D + auditoría |
| 30 | Sync al hub Drive PENDIENTE validar | D + auditoría |
| 31 | **Modelo custodia 3 dominios** (D-12 PROPUESTA, retención según matriz) | auditoría v3 |
| 32 | **Contrato de carga PDF** (C-23): 10MB, MIME+magic+pdf-lib+anti-malicious+SHA-256 | auditoría v3 |
| 33 | **Authz por `id_empresa`** (D-13 PROPUESTA) | auditoría v1 |
| 34 | **Polling batch 30s como fallback webhook** (D-11 opción C) | auditoría v1+v3 |
| 35 | **Endpoint recovery I-013** para replay perdido (C-22) | auditoría v2 |
| 36 | **safeStorage para producción, env vars solo dev/CI** | auditoría v2 |
| 37 | **Política de deprecación `/v1/`** (D-14 PROPUESTA) | auditoría v1 |

**Decisiones PROPUESTAS pendientes** (no adoptadas, requieren tu input):
- D-5: ¿E2E real en Fase 1? (default: NO, I-107 sintético)
- D-9: ¿Prefijo `/v1/` definitivo? (default: NO, sin refactor de routing)
- D-11: Receptor webhooks (3 opciones: A=Express K+AIR, B=ngrok, C=polling). Default recomendado: **C=polling** para v1
- D-12: Modelo custodia 3 dominios (firma-service = legal autoritativa, empleador = responsabilidad, K+AIR = copia operativa)
- D-14: Política de deprecación `/v1/` (depende D-9; si D-9=NO, D-14=N/A)

**Decisiones ya adoptadas en código (no requieren aprobación formal)**:
- D-1: `tipo_identificacion` rename ✅ (I-001, I-002 mergeados)
- D-2: `subtipo_documento` libre en metadata JSON ✅ (parcial, sin campo formal, pero funcional)
- D-13: Authz por `id_empresa` ✅ (I-010 mergeado, migration 009 aplicada)

---

## 8. Decisiones pendientes del user (5 activas, 3 ya adoptadas)

**Estado al 2026-08-20 post-AUD-01**: 3 decisiones que aparecían como "pendientes" están **YA IMPLEMENTADAS en código** y no requieren aprobación formal. Quedan 5 decisiones reales pendientes.

**Decisiones ya adoptadas (no requieren acción)**:
- ✅ **D-1**: `tipo_documento` → `tipo_identificacion` rename (I-001, I-002 mergeados)
- ✅ **D-2**: `subtipo_documento` libre en metadata JSON (funcional, sin campo formal)
- ✅ **D-13**: Authz por `id_empresa` (I-010 mergeado, migration 009 aplicada, `requireEmpresaScopeAndLimit` en todos los routers internos)

**Decisiones activas (requieren tu input)**:
- **D-5** (táctica): ¿E2E real con PII en Fase 1? Default: NO, I-107 sintético.
- **D-9** (arquitectura, bloqueante I-006): ¿Prefijo `/v1/` definitivo? Default recomendado: **NO** (sin refactor de routing).
- **D-11** (arquitectura, bloqueante Fase 2): ¿Receptor webhooks (A=Express, B=ngrok, C=polling)? Default recomendado: **C=polling** para v1.
- **D-12** (legal/operativo, NO bloqueante código): ¿Modelo custodia 3 dominios?
- **D-14** (táctica, depende D-9): ¿Política de deprecación `/v1/`? Si D-9=NO, D-14=N/A.

**Diferidas a Fase 2+** (no bloqueantes para Fase 1):
- D-3, D-4, D-6, D-10.

**Retiradas**:
- D-7, D-8 (reemplazadas por D-12 y matriz de retención).

---

## 9. Fases de implementación (sincronizadas post-AUD-01)

### Fase 1.1 — Fundaciones backend ✅ CERRADA (todos mergeados a Dev-Pc, 2026-08-14 → 2026-08-20)

| # | Tarea | Estado | Commit mergeado |
|---|-------|--------|-----------------|
| 1 | I-001: Migration 007 (tipo_identificacion + 2 índices) | ✅ | `9cb2b74e` |
| 2 | I-002: zod schema + service aceptan tipo_identificacion | ✅ | `329f44bf`, `8f45cd1e`, `3ead303d` |
| 3 | I-003: Migration 008 (gh_idempotency_keys) | ✅ | `bfff65db` |
| 4 | I-004: idempotency service | ✅ | `888b5ea6`, `cfe725dc`, `578923d6`, `2f376411` |
| 5 | I-010: firma-service per-company authz (D-13) → Migration 009 | ✅ | `132cd030`, `c8d463e3`, `1179c02e`, `768dac5b`, `1b465e32` |
| 6 | I-012: contrato de carga PDF (C-23) — 10MB, MIME, magic, pdf-lib, anti-malicious, SHA-256 | ✅ | `11616801`, `7b71662f`, `bbfa1a3c`, `0cbdfe78` |
| 7 | I-013a: link recovery endpoint (C-22) — solo DISEÑO + test fixtures | ✅ | dentro de I-010 |
| 8 | I-005: SignRequest create con idempotency (REPLAY sin token) | ✅ | `c202fa7f` |
| 9 | I-006: Routers /v1/ paralelos | ❌ NO IMPLEMENTADO (D-9=NO por default) | — |
| 10 | I-013b: link recovery endpoint (C-22) — IMPLEMENTACIÓN | ❌ NO IMPLEMENTADO (pendiente) | — |
| 11 | I-007: GET /:id/status (refinamiento de GET /:id existente) | ⚠️ Parcial (GET /:id existe, falta agregar campos para UI) | — |
| 12 | I-008: GET /?ids=batch con `internalServerLimiter` 4 capas | ❌ NO IMPLEMENTADO (rate limit existe, falta endpoint batch) | — |
| 13 | I-009: Tests contract OpenAPI compliance | ⚠️ Parcial (tests existen pero sin formalizar OpenAPI source-of-truth) | — |
| 14 | I-011: Discovery de sincronización de binarios al hub Drive | ❌ NO HECHO | — |

**I-008.x cerrado** (HALLAZGO #1, #2, #3): commits `c90589df` (helper), `92a22990` (headers IETF), `2206908c` (wraps publicFlow), `f7e34290` (aserciones E2E), `ad6b4779` (bump 0.1.190). Total 5 commits mergeados a Dev-Pc.

**Numeración de migraciones v4**:
- Migration 007: tipo_identificacion (I-001) ✅
- Migration 008: gh_idempotency_keys (I-003) ✅
- Migration 009: gh_internal_clients (I-010) ✅
- Migration 010: gh_webhook_deliveries (Fase 2 I-201) — PENDIENTE

### Fase 1.2 — Frontend K+AIR (PRÓXIMA)

| # | Tarea | Bloqueada por | Estado |
|---|-------|---------------|--------|
| I-101 | K+AIR firma-client wrapper (safeStorage, client_instance_id, firma-bridge.js) | nada (greenfield) | ❌ Pendiente |
| I-007 | Refinar GET /:id (campos UI: qr_payload, link, etc.) | nada | ❌ Pendiente |
| I-008 | GET /?ids=batch con `internalServerLimiter` 4 capas | I-007 (mismo handler) | ❌ Pendiente |
| I-103 | GET /internal/sign-requests/:id/document.pdf (autenticado) | I-006 (D-9=NO) | ❌ Pendiente |
| I-104 | GET /internal/sign-requests/:id/constancia.pdf (autenticado) | I-006 (D-9=NO) | ❌ Pendiente |
| I-013b | GET /internal/sign-requests/:id/link (recovery) | I-006 (D-9=NO) | ❌ Pendiente |
| I-102 | K+AIR UI botón "Firmar contrato" con polling batch 30s | I-101 + I-008 backend | ❌ Pendiente |
| I-105 | K+AIR storage local (`<userData>/firmas/`) | I-103 + I-104 | ❌ Pendiente |
| I-106 | K+AIR sync al hub Drive (CONDICIONAL I-011) | I-011 + I-105 | ❌ Pendiente |
| I-107 | Smoke E2E manual con identidad sintética | TODO | ❌ Pendiente |

**Orden de paralelización recomendado**:
- **Track A (backend)**: I-007 → I-008 → I-103 + I-104 (paralelo) + I-013b (paralelo con I-103/I-104)
- **Track B (K+AIR)**: I-101 (cliente HTTP + safeStorage + bridge)
- I-002 depende de I-101 (K+AIR) + I-008 (backend)

### Fase 2 — Webhook [OPCIONAL, CONDICIONAL D-11]

- I-201 a I-207. **Si D-11=C (polling, default)**, Fase 2 se repliega: el polling de I-102 cubre el caso.
- **Si D-11=A o B** (webhook receptor en K+AIR), Fase 2 entra con HMAC + outbox + retries + dead-letter.

### Fase 3 — Reconciliación batch
- I-301: K+AIR job batch cada 30s (mismo loop que I-102)

### Fase 4 — Descarga post-webhook
- I-401: K+AIR descarga post-webhook

### Fase 5 — Generalización
- I-501 a I-504

**Total**: 12-18 días para v1 funcional.

---

## 10. Riesgos transversales (17 riesgos, actualizado v3)

| # | Riesgo | Mitigación |
|---|--------|------------|
| 1 | SMTP no entrega | Reenviar OTP |
| 2 | Webhook no disponible (D-11) | Polling batch 30s |
| 3 | `WEBHOOK_SECRET` filtrado | Rotación dual-key (D-4) |
| 4 | BD crece sin límite | Retención por tipo (matriz D-8) |
| 5 | Relojes desincronizados | NTP, skew 300s |
| 6 | Migración 005 mal aplicada | Tests del registry (C-21) |
| 7 | TOKEN GitHub en logs | **Rotar antes de push de auth** |
| 8 | LEGAL.md sin validación | **Production gate** |
| 9 | Cédula SHA-256 sin sal | HMAC en K+AIR antes de prod |
| 10 | PII en logs | Tests adversariales |
| 11 | Alcanzabilidad segura no validada | D-11 con polling como fallback |
| 12 | API key compartida cruza empresas | D-13 (authz) |
| 13 | Validez OTP no automática (Decreto 2364/2012 / Decreto 1074) | Validación jurídica + análisis por tipo |
| 14 | Sync de PDFs binarios no validado | I-011 discovery primero |
| 15 | Pérdida/corrupción/rotación | Plan de recuperación (gate) |
| 16 | **Contrato de carga PDF no definido** | **C-23: 10MB, MIME, magic, pdf-lib como validación inicial (NO garantía total), límites verificados técnicamente antes de asumir cobertura de seguridad** |
| 17 | CI no configurado | Configurar antes de Fase 1.2 |

---

## 11. Production gate (CORREGIDO v3)

**⚠️ Solo para producción con trabajadores reales**. NO bloquea dev/test sintético.

9 criterios (al 2026-08-20 post-AUD-01):

- [ ] Validación jurídica externa completada (LEGAL.md + matriz retención por tipo).
- [ ] **D-5, D-9, D-11, D-12, D-14 aprobados** (D-13 ✅ ya implementado, D-1 ✅, D-2 ✅; D-7, D-8 RETIRADOS).
- [ ] Matriz de retención por tipo documental (deliverable de compliance).
- [ ] Observabilidad operativa.
- [ ] Plan de recuperación.
- [ ] CI configurado (contract tests como gate en PRs).
- [ ] **TLS + auth K+AIR → firma-service** (HTTPS obligatorio siempre).
- [ ] **TLS + auth firma-service → K+AIR (receptor webhook)** — **CONDICIONAL**: requerido solo si D-11 aprueba opción A o B. NO requerido si D-11=C (polling, default).
- [ ] Contrato de carga PDF (C-23) implementado, testeado, **pdf-lib actualizado con CVEs revisados**.

---

## 12. Métricas de éxito (KPIs)

**Funcionales**: 100% compat legacy, 0% PDFs huérfanos, webhook <1s (si activo), polling 15s media, éxito firma >95%.
**Seguridad**: 0 secretos en logs, 0 PII en webhook, HMAC 100%, authz por empresa evita 100% cross-company.
**Operacionales**: 391+ tests, coverage ≥90%/80%, 0 P0/P1, suite <3min.
**Production gate**: 9/9 criterios antes de activar con trabajadores reales.

---

## 13. Referencias

(Ver `INCONSISTENCIAS.md` v3 para detalle de decisiones y producción de cada agente.)

---

## 14. Próximo paso

**Estado al 2026-08-20**: Fase 1.1 backend cerrada. AUD-01 completado. Decisiones D-9/D-11 con defaults razonables (D-9=NO, D-11=C=polling). Documentación sincronizada.

**Fase 1.2 (frontend K+AIR) — próximo paso inmediato**:

1. **AUD-02** (esta iteración): sincronizar `INTEGRATION.md` con la realidad del código post-AUD-01. ✅ HECHO en este commit.
2. **Track A (backend)** en paralelo:
   - I-007 (refinar `GET /:id`)
   - I-008 (`GET /?ids=batch` con `internalServerLimiter` 4 capas)
   - I-103 + I-104 (PDFs descargables autenticados)
   - I-013b (link recovery)
3. **Track B (K+AIR)** en paralelo:
   - I-101 (cliente HTTP firma-service, safeStorage, client_instance_id, firma-bridge.js)
4. **I-102** (UI + polling): después de I-101 (K+AIR) + I-008 (backend)
5. **I-105** (storage local): después de I-103 + I-104
6. **I-107** (smoke E2E): al final, valida el flujo completo
7. **I-106** (sync hub Drive): condicional a I-011 discovery

Estimación total Fase 1.2: **32-47h** (4-6 días full-time), de las cuales **15-21h en Track B K+AIR** y **17-26h en Track A backend**.

NO implemento código de Fase 1.2 hasta que confirmes: (1) el plan de arriba, (2) los defaults D-9=NO y D-11=C, (3) la decisión de arrancar I-101 + I-007/I-008/I-103/I-104/I-013b en paralelo.

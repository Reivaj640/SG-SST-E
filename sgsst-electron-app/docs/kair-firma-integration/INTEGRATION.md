# Integración K+AIR ↔ firma-service v1 — Documento maestro

**Versión del documento**: draft 0.4 — 2026-08-19 (v4 incorpora correcciones de coherencia de tercera auditoría)
**Estado**: Fase 0 Discovery cerrada + 3 rondas de auditoría externa procesadas. Pendiente aprobación de D-1, D-2, D-5, D-9, D-11, D-12, D-13, D-14 antes de Fase 1.
**Equipo**: K+AIR (Electron) ↔ firma-service (Node 20, Express 4, better-sqlite3)
**Empresa objetivo**: TEMPOACTIVA EST S.A.S. (cliente K+AIR en producción)

---

## 1. Resumen ejecutivo

K+AIR (Electron desktop para consultoría SG-SST colombiana) está integrando `firma-service` — un **mecanismo diseñado para cumplir el marco aplicable colombiano** (Ley 527/1999, Decreto 2364/2012 compilado en Decreto 1074 para firma electrónica, Decreto 1072/2015 art. 2.2.4.6.13 para conservación de documentos del SG-SST — **este último artículo aplica específicamente a documentos del SG-SST, NO a todos los documentos laborales**), **sujeto a validación jurídica externa y al production gate antes de uso con trabajadores reales** — para que el flujo de firma de documentos laborales (contratos, otrosíes, autorizaciones, consentimientos) sea end-to-end dentro de la app, sin pasos manuales.

**Hoy**: K+AIR tiene un botón "Firmar" que abre un canvas in-app (no criptográfico, sin validez legal). Los documentos que requieren firma legal se imprimen, se firman a mano, se escanean. Cuello de botella operativo + riesgo legal.

**Mañana (Fase 1+)**: K+AIR envía el PDF a `firma-service` vía HTTPS, recibe `id_solicitud` + URL pública mini-app + token; el trabajador abre el link, identifica con cédula, recibe OTP por correo, ve el documento, firma; `firma-service` genera PDF firmado + Constancia, los archiva, notifica a K+AIR vía webhook o polling batch. K+AIR descarga los PDFs, los archiva localmente, opcionalmente sincroniza al hub del cliente (PENDIENTE validar, ver §3 y §5).

**Stack**:
- firma-service v0.1.190 (HEAD, 0 commits ahead of origin/Dev-Pc). 18 endpoints, 5 tablas, 341 tests verdes, 0 P0 abiertos.
- K+AIR Electron desktop con Express embebido (onlyoffice-bridge en port 3011 — NO directamente reutilizable para webhooks, ver D-11).
- HTTPS en LAN/cloud, API key estática (`X-Internal-API-Key`) + scope por empresa (D-13), webhook con HMAC SHA-256 estilo Stripe **o polling batch como fallback inicial** (D-11).
- Storage: filesystem local (`<userData>/firmas/`) como copia operativa. Sync al hub Drive del cliente: **PENDIENTE DE VALIDAR** para binarios (no se afirma como plan completo).

**Decisiones clave**:
1. Idempotency-Key con tabla `gh_idempotency_keys`, TTL 24h, 409 si payload cambia, **REPLAY sin token** (C-22) + **endpoint de recovery** (I-013).
2. Versionado `/v1/` con política de deprecación (D-14).
3. Webhook outbox con HMAC, retries 1s→1h, dead-letter (diseño listo; integración bloqueada por D-11).
4. `tipo_identificacion` con enum 10 valores + 2 índices (originalmente propuesto como `tipo_documento` en A1, renombrado por D-1 antes de I-001).
5. Contract testing con OpenAPI source of truth (Ajv + Prism), E2E real NO en Fase 1.
6. **Modelo de custodia 3 dominios** (D-12): firma-service = evidencia legal autoritativa, empleador = responsabilidad documental, K+AIR = copia operativa.
7. **Contrato de carga PDF** (C-23): max 10MB, MIME + magic bytes + parse real con pdf-lib, anti-malicious, hash SHA-256.
8. **Authz por `id_empresa`** (D-13): query interna filtra por empresa, evita fuga cross-company.

**Decisiones pendientes del user**: 8 (D-1, D-2, D-5, D-9, D-11, D-12, D-13, D-14). D-3, D-4, D-6, D-10 pueden esperar. D-7 y D-8 RETIRADOS.

**Production gate** (§11): 9 criterios (8 obligatorios + 1 condicional). **NO requerido** para dev/testing sintético.

---

## 2. Estado actual del firma-service v0.1.190

### 2.1 Implementado y operativo

| Aspecto | Estado |
|---------|--------|
| Endpoints REST | 18 (internos, admin, mini-app, sistema) |
| Endpoints versionados | 0 (todos en raíz) |
| Auth | `X-Internal-API-Key`, `X-Admin-API-Key` — **sin scope por empresa** |
| Tablas | 5 |
| Migraciones | 6 (001-006) |
| Tests | 341 verdes, ~1-3 min serial, 22 archivos |
| Storage | 3 carpetas planas (`originales/`, `firmados/`, `constancias/`) |
| Rate limits | 4 (global 60/min, OTP 10/h, commit 3/min, sign-request 30/min). NO cubre batch `?ids=`. |
| PII redaction | SENSITIVE_KEYS + PII_PATTERNS (P1-5) |
| Cédula con sal | Soportado, no usado en K+AIR (P1-2) |
| Trust proxy | `'loopback'` (P1-6) |
| Upload validation | MIME + magic bytes básico. Falta C-23 completo. |

### 2.2 Cambios propuestos / pendientes de Fase 1 (NO implementados)

| Aspecto | Estado propuesto | Tarea |
|---------|------------------|-------|
| Webhook saliente | NO implementado | I-201 a I-207 (Fase 2, depende D-11) |
| Idempotency-Key | NO implementado | I-003, I-004, I-005 |
| Versionado `/v1/` | NO implementado | I-006 |
| `tipo_identificacion` (enum 10 valores) | NO existe | I-001, I-002 |
| Per-empresa authz (D-13) | NO existe | I-010 (migration 009) |
| `internalServerLimiter` 4 capas (C-20 v5) | NO existe | I-008 |
| Upload contract C-23 (10MB, pdf-lib, anti-malicious) | Parcial (MIME + magic básico) | I-012 |
| Link recovery endpoint (C-22) | NO existe | I-013a (diseño) + I-013b (impl) |
| OpenAPI contract tests | NO existe | I-009 |
| Discovery sync binarios al hub | NO hecho | I-011 |

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

**GREENFIELD firma**: 0 líneas de código de firma en K+AIR. Todo es nuevo.

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
- D-11: Receptor webhooks (3 opciones, polling como fallback inicial)
- D-12: Modelo custodia 3 dominios
- D-13: Authz por `id_empresa`
- D-14: Política de deprecación `/v1/`

---

## 8. Decisiones pendientes del user (8 activas)

**Bloqueantes para Fase 1.1**:
- D-1: ¿Rename `tipo_documento` → `tipo_identificacion`?
- D-2: ¿`subtipo_documento` libre en `metadata` JSON?
- D-9: ¿Prefijo `/v1/` definitivo? (con D-14 = política de deprecación)
- D-5: ¿E2E real en Fase 1?
- D-12: ¿Modelo custodia 3 dominios?
- D-13: ¿Authz por `id_empresa`?

**Bloqueantes para Fase 2** (no Fase 1.1):
- D-11: ¿Receptor webhooks con polling como fallback inicial?

**Documentación** (no bloqueante):
- D-14: ¿Política de deprecación `/v1/`?

**No bloqueantes** (pueden esperar a Fase 2+):
- D-3, D-4, D-6, D-10.

**Retiradas**: D-7, D-8 (reemplazadas por D-12 y matriz de retención).

---

## 9. Fases de implementación (corregidas post-auditoría 2)

### Fase 1.1 — Fundaciones (orden de ejecución)
1. I-001: Migration 007 (tipo_identificacion + 2 índices)
2. I-002: zod schema + service aceptan tipo_identificacion
3. I-003: Migration 008 (gh_idempotency_keys)
4. I-004: idempotency service
5. I-010: firma-service per-company authz (D-13) → **Migration 009** (renumerada v4)
6. **I-012 (NUEVO v3)**: contrato de carga PDF (C-23) — 10MB, MIME, magic bytes, pdf-lib como validación inicial (no garantía), anti-malicious
7. **I-013a (NUEVO v4)**: link recovery endpoint (C-22) — solo DISEÑO + test fixtures con mocks
8. I-005: SignRequest create con idempotency (REPLAY sin token, spec de I-013a como safety net)
9. I-006: Routers /v1/ paralelos
10. **I-013b (NUEVO v4)**: link recovery endpoint (C-22) — IMPLEMENTACIÓN + integration tests (después de I-005, I-006)
11. I-007: GET /:id/status
12. I-008: GET /?ids=batch (con `internalServerLimiter` 4 capas: 720/h `id_empresa` autoritativo + 240/h `client_instance_id` cap + 480/h IP fallback + detección anomalías, C-20 v5)
13. I-009: Tests contract OpenAPI compliance
14. I-011: Discovery de sincronización de binarios al hub Drive

**Numeración de migraciones v4**:
- Migration 007: tipo_identificacion (I-001)
- Migration 008: gh_idempotency_keys (I-003)
- **Migration 009: gh_internal_clients (I-010, antes era 010)**
- Migration 010: gh_webhook_deliveries (Fase 2 I-201, antes era 009)

### Fase 1.2 — Primer vertical
- I-101: K+AIR firma-client wrapper (con safeStorage para producción)
- I-102: K+AIR UI botón "Firmar contrato" (polling batch 30s, I-008)
- I-103: GET /:id/document.pdf
- I-104: GET /:id/constancia.pdf
- I-105: K+AIR storage local
- I-106: K+AIR sync al hub (CONDICIONAL I-011)
- I-107: Smoke E2E manual

### Fase 2 — Webhook [OPCIONAL, depende D-11]
- I-201 a I-207. Si D-11=C, Fase 2 se reemplaza por polling (ya cubierto).

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

9 criterios:

- [ ] Validación jurídica externa completada (LEGAL.md + matriz retención por tipo).
- [ ] **D-11, D-12, D-13, D-14 aprobados** (D-7, D-8 RETIRADOS).
- [ ] Matriz de retención por tipo documental (deliverable de compliance).
- [ ] Observabilidad operativa.
- [ ] Plan de recuperación.
- [ ] CI configurado (contract tests como gate en PRs).
- [ ] **TLS + auth K+AIR → firma-service** (HTTPS obligatorio siempre).
- [ ] **TLS + auth firma-service → K+AIR (receptor webhook)** — **CONDICIONAL**: requerido solo si D-11 aprueba opción A o B. NO requerido si D-11=C (polling).
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

1. **Tú**: revisar v3 en `docs-discovery-drafts/`.
2. **Yo**: incorporar feedback.
3. **Tú (OK final)**: aprobar 8 decisiones activas vía `ask_user` consolidado.
4. **Yo (OK final)**: mover a `docs/kair-firma-integration/`.
5. **Yo (OK final)**: empezar I-001.

NO implemento código hasta tu OK.

# READY-TO-IMPLEMENT — Checklist de salida de Fase 0

**Fecha**: 2026-08-19 (v5 — incorpora correcciones finales de cuarta auditoría)
**Propósito**: criterios de salida de Fase 0 + tareas priorizadas para Fase 1+.
**Estado**: Fase 1.1 backend cerrada (2026-08-20, post I-008.x + bump 0.1.190). Pendiente: Fase 1.2 frontend K+AIR (I-101 a I-107) y 5 decisiones activas (D-5, D-9, D-11, D-12, D-14). D-1, D-2, D-13 ya implementadas en código (no requieren aprobación formal).

---

## A. Criterios de salida de Fase 0

- [x] **A1-A8**: discovery completo + 3 docs + migraciones diseñadas.
- [x] **A9-A12**: 3 rondas de auditoría procesadas; production gate de 9 criterios.
- [x] **A13** (v4): limiter con `client_instance_id` (C-20 v4); I-013 split (I-013a design + I-013b impl); migración renumerada; pdf-lib como validación inicial; introducción reformulada; smoke E2E con identidad sintética.

**Pendiente**: A14 (8 decisiones activas) + A15 (mover a canónico).

---

## B. Decisiones del user

### Activas (5): D-5, D-9, D-11, D-12, D-14.
### Ya implementadas en código (3): D-1, D-2, D-13 — no requieren aprobación formal.
### Diferidas (4): D-3, D-4, D-6, D-10.
### Retiradas (2): D-7, D-8.

---

## C. Tareas Fase 1.1 (orden de ejecución v4)

**Orden explícito** (los números de tarea no correlacionan con orden de ejecución):
1. I-001 (paso 1)
2. I-002 (paso 2)
3. I-003 (paso 3)
4. I-004 (paso 4)
5. **I-010 (paso 5) — AHORA USA MIGRATION 009**
6. **I-012 (paso 6) — pdf-lib es validación inicial, no garantía**
7. **I-013a (paso 7) — solo DISEÑO + test fixtures**
8. I-005 (paso 8) — usa spec de I-013a como safety net
9. I-006 (paso 9)
10. **I-013b (paso 10) — IMPLEMENTACIÓN + integration tests**
11. I-007 (paso 11)
12. I-008 (paso 12) — `internalServerLimiter` 4 capas: `id_empresa` autoritativo + cap `client_instance_id`
13. I-009 (paso 13)
14. I-011 (paso 14, paralelo)

**Numeración de migraciones v4**:
- Migration 007: tipo_identificacion (I-001)
- Migration 008: gh_idempotency_keys (I-003)
- **Migration 009: gh_internal_clients (I-010)**
- Migration 010: gh_webhook_deliveries (Fase 2 I-201)

---

### I-001: Migration 007 — `tipo_identificacion` columna + índices (renombrado de `tipo_documento` por D-1)
- Sin cambios v4. Tests prueban el registry (C-21).

### I-002: zod schema + service aceptan `tipo_identificacion`
- Sin cambios.

### I-003: Migration 008 — `gh_idempotency_keys`
- Sin cambios.

### I-004: idempotency service
- Sin cambios.

### I-010: firma-service per-company authz → **Migration 009** (renumerada v4)
- **Cambio v4**: el archivo es `src/db/schema/009_internal_clients.sql` (antes `010_internal_clients.sql`).
- Migration 010 queda libre para Fase 2 (gh_webhook_deliveries).
- Contenido: tabla `gh_internal_clients (api_key_hash PRIMARY KEY, id_empresa TEXT NOT NULL, allowed_operations TEXT, created_at, revoked_at)`.
- Tests: 4+ cross-company isolation, 2+ revoked key.
- **Commit**: `feat(authz): per-empresa scope in internal API (D-13)` (mismo mensaje).
- **Aceptación**: 6+ tests, queries internas filtradas por `id_empresa`.

### I-012: Contrato de carga PDF (C-23) — pdf-lib como validación inicial (v4)
- **Cambio v4**: documentar explícitamente que pdf-lib es **validación inicial**, NO garantía total.
- Spec: 10MB max, MIME `application/pdf`, magic bytes `%PDF`, parse con pdf-lib, max 500 pages, max 50 embedded files, max 100MB imágenes, bloqueo de JavaScript en OpenAction/AA/Names, SHA-256 server-side.
- **Cobertura de seguridad requiere**:
  - pdf-lib versión actual sin CVEs críticos.
  - Tests adversariales pasando.
  - Documentar en I-012 commit: "Esta validación es primera línea. Cobertura completa requiere mantener pdf-lib actualizado, antivirus scan en el futuro (OQ), revisión periódica de CVEs."
- Tests: 15+ (cada error case).
- **Commit**: `feat(upload): contract C-23 — max 10MB, MIME, magic, pdf-lib initial validation, anti-malicious`.

### I-013a: Link recovery endpoint — DISEÑO + test fixtures (C-22)
- **Cambio v4**: split en I-013a (diseño) + I-013b (implementación).
- **I-013a es ANTES de I-005** (orden de ejecución paso 7).
- Entregables de I-013a:
  - Spec del endpoint `GET /v1/internal/sign-requests/:id/link`.
  - Schema OpenAPI: `LinkRecoveryResponse { id_solicitud, token, url_publica, qr_payload, fecha_expiracion, estado }`.
  - Error codes documentados: 200, 401, 404 (cross-empresa), 410 (estado terminal), 429.
  - Test fixtures con mocks: stub de `getSignRequestById` que retorna PENDING/OPENED/SIGNED/REJECTED/EXPIRED/REVOKED.
  - Plan de auditoría: evento `LINK_RETRIEVED { actor, id_solicitud, ip, ua }`.
- **NO incluye**: handler real, integración con I-010 authz, integration tests.
- **Commit**: `docs(api): spec for GET /:id/link (C-22 recovery, design only)`.

### I-005: SignRequest create con idempotency
- Sin cambios funcionales. Usa el spec de I-013a como referencia.
- **REPLAY sin token, url_publica, qr_payload** (C-22). Test de timeout post-creación incluido.

### I-006: Routers /v1/ paralelos
- Sin cambios.

### I-013b: Link recovery endpoint — IMPLEMENTACIÓN + integration tests
- **Cambio v4**: ahora se implementa DESPUÉS de I-005 e I-006.
- **Ejecución**: paso 10 (después de I-006).
- Implementa el spec de I-013a:
  - Handler en `src/routes/v1/signRequests.js`.
  - Auth: `X-Internal-API-Key` + scope `id_empresa` (I-010) + `X-Client-Instance-Id`.
  - Retorna 200 con credenciales si PENDING/OPENED.
  - Retorna 410 GONE si estado terminal.
  - Retorna 404 cross-empresa.
  - Registra evento `LINK_RETRIEVED`.
  - Rate limit: `internalServerLimiter` 240/h (mismo bucket que I-008).
- Tests: 8+ (los mismos de I-013a pero con handler real).
- **Commit**: `feat(api): GET /v1/internal/sign-requests/:id/link (C-22 recovery, implementation)`.

### I-007: GET /:id/status
- Sin cambios.

### I-008: GET /?ids=batch (con limiter de 4 capas, C-20 v5)
- **Cambio v5**: el limiter tiene 4 capas (rechaza v4 que usaba `id_empresa + client_instance_id` como base porque el cliente lo controla).
- **Capa 1 (autoritativa)**: 720/h keyed by `id_empresa` (server-controlled, NO falsificable).
- **Capa 2 (cap por instancia)**: 240/h keyed by `id_empresa + client_instance_id` (auxiliar, throttle si excede).
- **Capa 3 (fallback)**: 480/h keyed by `IP + id_empresa` (si no hay X-Client-Instance-Id).
- **Capa 4 (detección de anomalía)**: alert si > 10 `client_instance_id` distintos por `id_empresa` en 24h.
- **Header recomendado**: `X-Client-Instance-Id` (UUID v4) pero NO obligatorio.
- K+AIR debe generar `client_instance_id` al primer boot, persistirlo en `secrets.enc` (safeStorage).
- Análisis de carga: 1 instancia 120/h polling (capa 1 OK); 3 instancias 360/h polling (capa 1 OK con 360/h disponibles).
- Tests: 10+ (capa 1 OK, capa 2 throttle, capa 3 fallback, capa 4 alerta, generación de `client_instance_id`, persistencia).
- **Commit**: `feat(api): GET /v1/internal/sign-requests?ids=batch (4-layer rate limit, C-20 v5)`.

### I-009: contract tests
- Sin cambios.

### I-011: Discovery de sync de binarios
- Sin cambios.

---

## D. Tareas Fase 1.2

### I-101: K+AIR firma-client wrapper (con `client_instance_id` v4)
- **Cambio v4**: K+AIR genera `client_instance_id` (UUID v4) al primer boot, lo persiste en `secrets.enc` (safeStorage), lo envía en cada request como `X-Client-Instance-Id`.
- **Si `client_instance_id` no existe en secrets.enc** (primer boot), generar y guardar antes del primer request.
- **Si K+AIR se reinstala** (se borra secrets.enc), nuevo `client_instance_id`. Se trata como nueva instancia (limiter nuevo bucket).
- Dev/CI: `client_instance_id` puede ser fijo (`test-instance-001`).
- **Importante v5**: el `client_instance_id` es **señal auxiliar**, NO identidad confiable por sí sola. El limiter autoritativo es por `id_empresa` (server-controlled). El `client_instance_id` solo se usa para cap secundario y detección de anomalías.
- Tests: 8+ incluyendo test de generación, persistencia, header.
- **Commit**: `feat(gh): firma-service client wrapper with Idempotency-Key, safeStorage, and client_instance_id`.

### I-102: K+AIR UI: botón "Firmar contrato" (polling 30s batch, v3)
- Sin cambios funcionales.
- Polling: UN SOLO loop en main process, 30s, batch `?ids=` con todos los activos.

### I-103: GET /:id/document.pdf
- Sin cambios.

### I-104: GET /:id/constancia.pdf
- Sin cambios.

### I-105: K+AIR storage local
- Sin cambios.

### I-106: K+AIR sync al hub (CONDICIONAL I-011)
- Sin cambios.

### I-107: Smoke E2E manual (v4 — identidad sintética)
- **Cambio v4**: usar **identidad sintética de prueba**, NO cédula real.
- Procedimiento actualizado:
  1. Levantar firma-service + K+AIR Electron
  2. Crear contrato de prueba en K+AIR
  3. Click "Firmar"
  4. Copiar URL pública
  5. Abrir en navegador, identificar con **cédula sintética** (e.g. `1234567890`) y **correo de prueba** (e.g. `test-firma@example.com`)
  6. Recibir OTP por email
  7. Firmar
  8. Verificar polling batch actualiza estado en K+AIR (<30s)
  9. Descargar PDF + Constancia
  10. Archivar local
  11. Si I-106 enabled: verificar sync al hub
- **NO usar PII real** (cédulas de personas reales, correos reales de trabajadores). El gate de producción es para trabajadores reales, el smoke E2E es desarrollo/sintético.
- Entregable: 5-10 screenshots + log.

---

## E. Tareas Fase 2

(Sin cambios.)

---

## F-H. Tareas Fase 3-5

(Sin cambios.)

---

## I. Métricas de salida

### Fase 1.1 cerrada cuando:
- [ ] 14 pasos de ejecución completados
- [ ] 391+ tests verdes
- [ ] **9 migraciones (001-009) sin gaps**
- [ ] I-013a spec escrito, I-013b implementado después de I-005/I-006
- [ ] I-012 con nota explícita de pdf-lib = validación inicial
- [ ] internalServerLimiter con 4 capas (C-20 v5): `id_empresa` autoritativo + cap `client_instance_id` + fallback IP + detección anomalía
- [ ] OpenAPI spec actualizado (incluye C-23, I-013, I-010)

### Fase 1.2 cerrada cuando:
- [ ] I-101 genera `client_instance_id` y lo envía como header
- [ ] I-107 usa identidad sintética, NO cédula real
- [ ] Smoke E2E con screenshots aprobados
- [ ] Push con tu OK

---

## J. Production gate (9 criterios)

(Sin cambios. Ver INTEGRATION.md §11.)

---

## K. Anti-patrones (v4 actualizado)

- ❌ NO `internalServerLimiter` keyed by `IP + API key` (debe ser 4 capas con `id_empresa` autoritativo)
- ❌ NO client_instance_id hardcodeado en producción (debe ser UUID generado + safeStorage)
- ❌ NO `client_instance_id` faltante (K+AIR debe generarlo en primer boot)
- ❌ NO pdf-lib como garantía total de seguridad (es validación inicial)
- ❌ NO I-013b antes de I-005/I-006 (diseño primero, implementación después)
- ❌ NO migración 010 antes que 009 (orden secuencial)
- ❌ NO smoke E2E con cédula real (debe ser sintética)
- ❌ NO promesa de "validez legal" automática (es mecanismo sujeto a validación jurídica + production gate)
- ... resto de anti-patrones v3 ...

---

## L. Próximo paso

1. **Tú**: revisar v4 en `docs-discovery-drafts/`.
2. **Yo**: incorporar feedback si lo hay.
3. **Tú (OK final)**: aprobar 8 decisiones activas vía `ask_user` consolidado.
4. **Yo (OK final)**: mover a `docs/kair-firma-integration/`.
5. **Yo (OK final)**: empezar I-001.

# Inconsistencias detectadas en Fase 0 Discovery

**Fecha**: 2026-08-19 (v5 — incorpora correcciones finales de cuarta auditoría)
**Origen**: cruce cruzado de los 7 outputs de discovery (A1, A2, B, C, D, E, F) + 3 rondas de auditoría externa del user.

---

## Resumen ejecutivo

| # | Tema | Estado |
|---|------|--------|
| C-1 | Índices `tipo_documento` (1 vs 2) | ✅ Aceptado (2 índices) |
| C-2 | Rename `tipo_documento` → `tipo_identificacion` | 🟡 Pendiente (D-1) |
| C-3 | `subtipo_documento` en `metadata` libre | 🟡 Pendiente (D-2) |
| C-4 | `evidence_hash` con `tipo_documento` | ✅ Aceptado |
| C-5 | Storage paths planos | ✅ Aceptado |
| C-6 | Contrato completo de webhook (8 piezas) | 🟡 Pendiente (D-11) |
| C-7 | "Electron puede recibir HTTP" cierra alcanzabilidad segura | 🟡 **REABIERTA** |
| C-8 | Generación de `Idempotency-Key` en K+AIR | 🟢 Resolver en I-101 |
| C-9 | Retención de `gh_webhook_deliveries` | 🟡 Pendiente (D-3) |
| C-10 | E2E real en Fase 1 | 🟡 Pendiente (D-5) |
| C-11 | Constancia PDF incluye tipo | ✅ Aceptado |
| C-12 | XMP keywords del PDF firmado incluye tipo | ✅ Aceptado |
| C-13 | Rotación de `WEBHOOK_SECRET` | 🟡 Pendiente (D-4) |
| C-14 | `id_constancia` en `SignRequestDetail` | ✅ Aceptado |
| C-15 | Reconciliación batch `?ids=` | ✅ Aceptado |
| C-16 | Multi-tenant rate limit por `id_empresa` | ✅ NO en v1 (v2) |
| C-17 | Rate limit awareness de `tipo_documento` | ✅ NO diferenciar |
| C-18 | API key estática suficiente | 🟡 Sub-divida (D-13) |
| C-19 | `version_kair` en payload webhook (multi-instancia) | 🟡 Pendiente (D-6) |
| C-20 | I-008 batch sin rate limit | 🟡 **CORREGIDO v5**: 4 capas, `id_empresa` autoritativo |
| C-21 | Test "migración idempotente" prueba el registry | 🟡 Reescribir test |
| C-22 | REPLAY de idempotency-Key devuelve token público | 🟡 **CORREGIDO v4**: I-013a (design) + I-013b (impl) |
| C-23 | Contrato de carga de PDF | 🟡 **CORREGIDO v4**: pdf-lib = validación inicial, no garantía total |
| C-24 | **NUEVA v4**: Numeración inconsistente de migraciones | 🟡 Renumerar |
| C-25 | **NUEVA v4**: Smoke E2E usa cédula real | 🟡 Cambiar a identidad de prueba |
| C-26 | **NUEVA v4**: Introducción promete "validez legal" automática | 🟡 Reformular |
| C-27 | **NUEVA v5**: Estado actual afirma cambios no implementados | 🟡 Refactor §2 (2.1 / 2.2) |
| C-28 | **NUEVA v5**: Referencia jurídica incorrecta en introducción | 🟡 Corregir art. 2.2.4.6.13 |

| Decisión | Tema | Estado |
|---|---|---|
| D-1 | Rename `tipo_documento` → `tipo_identificacion` | 🟡 Pendiente |
| D-2 | `subtipo_documento` en `metadata` | 🟡 Pendiente |
| D-3 | Retención `gh_webhook_deliveries` | 🟡 Pendiente |
| D-4 | Rotación `WEBHOOK_SECRET` | 🟡 Pendiente |
| D-5 | E2E real en Fase 1 | 🟡 Pendiente |
| D-6 | Multi-instancia K+AIR | 🟡 Pendiente |
| D-7 | Custodia documental | 🔴 **RETIRADO** (reemplazado por D-12) |
| D-8 | Retención legal única | 🔴 **RETIRADO** (matriz por tipo) |
| D-9 | Versionado `/v1/` definitivo | 🟡 Pendiente |
| D-10 | Modelo de almacenamiento | 🟡 Pendiente |
| D-11 | Receptor de webhooks (polling como fallback) | 🟡 Propuesta |
| D-12 | Modelo de custodia 3 dominios | 🟡 Propuesta |
| D-13 | Autorización por empresa | 🟡 Propuesta |
| D-14 | Política de deprecación `/v1/` | 🟡 Propuesta |

**Decisiones activas para Fase 1**: 8 (D-1, D-2, D-5, D-9, D-11, D-12, D-13, D-14).

---

## C-20 (CORREGIDO v5): Limiter con `id_empresa` autoritativo + cap por `client_instance_id`

**Problema detectado por auditoría 4**: "X-Client-Instance-Id no puede ser la única base del límite. El cliente lo controla: una instalación comprometida podría enviar un UUID nuevo en cada solicitud y evadir el cupo."

**Resolución v5** (rechaza v4):

| Capa | Key | Límite | Tipo | Razón |
|------|-----|--------|------|-------|
| **1. Autoritativo** | `id_empresa` | 720/h | HARD (server-controlled) | Deriva de la API key + scope (D-13). NO depende del cliente. |
| **2. Cap por instancia** | `id_empresa + client_instance_id` | 240/h | Soft warning (throttle si excede) | Si una sola instancia excede, throttlear y alertar. |
| **3. Fallback** | `IP + id_empresa` (si no hay X-Client-Instance-Id) | 480/h | Soft warning | Cubre clientes que no envían instance_id. |
| **4. Detección de anomalía** | Count de `client_instance_id` distintos por `id_empresa` en 24h | Si > 10, flag | Alert | Posible compromiso o generación automatizada de UUIDs. |

**Análisis de carga** (cumpliendo las 4 capas):
- 1 instancia: 120/h polling (capa 1 OK con 720/h disponibles).
- 3 instancias: 360/h polling (capa 1 OK con 720/h, 360/h disponibles).
- 1 instancia abusiva: capa 2 dispara throttle a 240/h.
- 1 empresa con 11+ instance_id distintos en 24h: capa 4 alerta.

**Razón del cambio (v4 → v5)**:
- v4 usaba `id_empresa + client_instance_id` como base. **Incorrecto**: el cliente controla el UUID, un compromiso evade el cap generando UUIDs nuevos.
- v5 usa `id_empresa` como **autoritativo** (deriva de la API key, server-controlled, no falsificable). `client_instance_id` queda como **señal auxiliar** (cap secundario) y para **detección de anomalías**.

**Implicaciones**:
- I-008 implementa las 4 capas.
- I-101 genera `client_instance_id` (UUID v4) al primer boot, persiste en `secrets.enc` (safeStorage), envía `X-Client-Instance-Id` en cada request.
- Server-side: track `client_instance_id_history` por `id_empresa` con timestamp (para capa 4).
- Si una instancia excede capa 2: throttle (429) + log. No falla, solo avisa.
- Si capa 4 detecta anomalía: registrar en `gh_firma_eventos` y notificar admin (futuro).

**Estado**: 🟡 Aceptado. Aplicar a I-008 (Fase 1.1).

---

## C-22 (REFINADO v4): REPLAY sin token, recovery I-013 split

**Diseño v3 (parcialmente rechazado)**:
- I-013 = "link recovery endpoint" como tarea única antes de I-005.

**Resolución v4**:
- **I-013a (diseño)**: spec, contract, test fixtures con mocks. Se puede hacer ANTES de I-005/I-006.
- **I-013b (implementación)**: handler, integración con authz, integration tests. Se hace DESPUÉS de I-005 e I-006, antes del primer cliente K+AIR.

**Razón del split**: "I-013 recupera enlaces de solicitudes creadas por I-005 y se expone bajo el router /v1/ de I-006. Puede diseñarse antes, pero debe implementarse y probarse después de I-005 e I-006, antes del primer cliente K+AIR."

**Estado**: 🟡 Aplica a I-013 (split en I-013a + I-013b).

---

## C-23 (REFINADO v4): pdf-lib es validación inicial, no garantía

**Nota menor del user**: "No presentes pdf-lib como garantía total contra PDFs maliciosos; descríbelo como validación inicial y deja explícito que los límites/controles se verifican técnicamente antes de asumirlos como cobertura de seguridad."

**Resolución v4**:

| Lo que pdf-lib SÍ hace (validación inicial) | Lo que pdf-lib NO garantiza (cobertura de seguridad) |
|--------------------------------------------|------------------------------------------------------|
| Parsear el PDF y verificar estructura básica | Detectar TODOS los PDFs maliciosos |
| Aplicar límites (max pages, embedded files, image size) | Prevenir exploits zero-day en el parser |
| Bloquear JavaScript/auto-acción detectable | Cubrir vectores no conocidos al momento del deploy |
| Calcular hash SHA-256 del binario | Proteger contra ataques de canal lateral |

**Implicación**:
- I-012 implementa validación INICIAL con pdf-lib.
- Los límites/reglas en I-012 son **punto de partida**, NO cobertura completa de seguridad.
- **Verificación técnica periódica**: actualizar pdf-lib a cada release, revisar CVEs, agregar tests adversariales.
- Documentar explícitamente: "Esta validación es la primera línea. La cobertura de seguridad depende de mantener pdf-lib actualizado, agregar un antivirus scan en el futuro (OQ), y revisar regularmente."
- production gate incluye: "pdf-lib versión actual + revisión de CVEs conocidos + tests adversariales pasando".

**Estado**: 🟡 Refinamiento de I-012. Aceptado.

---

## C-24 (NUEVA v4): Numeración inconsistente de migraciones

**Problema detectado**: "I-010 crea la migración 010 antes de que exista la 009 de webhook; además, al terminar Fase 1.1 habría 9 migraciones totales (001–008 y 010), no 8."

**Resolución v4**:

| Tarea | Migración v3 | Migración v4 |
|-------|--------------|--------------|
| I-001: tipo_documento | 007 | 007 (sin cambio) |
| I-003: gh_idempotency_keys | 008 | 008 (sin cambio) |
| **I-010: gh_internal_clients** | **010** | **009** (renumerada) |
| **I-201: gh_webhook_deliveries** | **009** | **010** (renumerada) |
| I-202: webhook deliveries (Fase 2) | 010 | (no migration) |
| I-203+: sin migración nueva | — | — |

**Después de Fase 1.1**: 9 migraciones (001-009). Secuencial, sin gaps.
**Después de Fase 2**: 10 migraciones (001-010). Secuencial.

**Estado**: 🟡 Aceptado, aplicar renumeración.

---

## C-25 (NUEVA v4): Smoke E2E usa identidad de prueba

**Problema detectado**: "El smoke E2E todavía pide una cédula real. Cambiarlo por identidad y correo de prueba controlados. El gate permite datos ficticios en desarrollo, no habilita usar PII real sin necesidad."

**Resolución v4**:

I-107 (Smoke E2E manual) se actualiza:
- ❌ ANTES: "Identificar con cédula real, OTP por email"
- ✅ AHORA: "Identificar con cédula sintética de prueba (e.g. `1234567890`) y correo de prueba (e.g. `test-firma@example.com`)"

**Razón**: el gate de producción es para trabajadores reales. Desarrollo/sintético usa datos ficticios. No es válido recolectar PII real sin necesidad.

**Estado**: 🟡 Aceptado, aplicar a I-107.

---

## C-26 (NUEVA v4): Introducción promete "validez legal" automática

**Problema detectado**: "La introducción aún promete 'firma electrónica con validez legal colombiana'. Reformular a algo como: 'mecanismo diseñado para cumplir el marco aplicable, sujeto a validación jurídica y al production gate'. La validez depende de la confiabilidad concreta del método, no sólo del nombre del servicio."

**Resolución v4**:

**ANTES** (v3, INTEGRATION §1):
> "K+AIR está integrando `firma-service` (servicio de firma electrónica con validez legal colombiana, Ley 527/1999 + Decreto 2364/2012 compilado en Decreto 1074)"

**AHORA** (v4):
> "K+AIR está integrando `firma-service` (mecanismo diseñado para cumplir el marco aplicable colombiano — Ley 527/1999, Decreto 2364/2012 compilado en Decreto 1074, Decreto 1072/2015 arts. 2.2.1.1.8-13 — sujeto a validación jurídica externa y al production gate antes de uso con trabajadores reales)."

**Implicación en todo el documento**:
- Cambiar "firma con validez legal" → "firma con mecanismo diseñado para cumplir el marco aplicable".
- Cambiar "tiene validez legal" → "pretende cumplir los requisitos legales cuando el production gate se cumple".
- Aclarar que el nombre "firma electrónica" es descriptivo, no certificador.

**Estado**: 🟡 Aceptado, aplicar a INTEGRATION §1, §6.1, §6.6 (E), §12 (KPIs).

---

## C-27 (NUEVA v5): "Estado actual" afirma cambios aún no implementados

**Problema detectado por auditoría 4**: "En INTEGRATION.md §2 aparece internalServerLimiter 240/h como si estuviera implementado, aunque es I-008 pendiente; algo similar ocurre con scope por empresa y decisiones aún propuestas."

**Resolución v5**:

INTEGRATION.md §2 se refactoriza en dos sub-secciones:
- **§2.1 "Implementado y operativo"**: solo features que ya existen en el código.
- **§2.2 "Cambios propuestos / pendientes de Fase 1"**: features planificadas con referencia a la tarea (I-XXX).

**Regla para el futuro**: cualquier mención a una decisión o feature no implementada debe marcarse explícitamente como "propuesta" o "pendiente de I-XXX" en secciones de estado.

**Estado**: 🟡 Aceptado. Aplicado a INTEGRATION.md §2.

---

## C-28 (NUEVA v5): Referencia jurídica incorrecta en introducción

**Problema detectado por auditoría 4**: "Se cita Decreto 1072/2015 'arts. 2.2.1.1.8-13'; para la conservación SG-SST relevante se identificó el art. 2.2.4.6.13."

**Resolución v5**:

| Referencia v4 (incorrecta) | Referencia v5 (correcta) | Aclaración |
|---------------------------|--------------------------|------------|
| "Decreto 1072/2015 arts. 2.2.1.1.8-13" | "Decreto 1072/2015 art. 2.2.4.6.13" | art. 2.2.4.6.13 = conservación SG-SST (20 años desde terminación de relación laboral). arts. 2.2.1.1.8-13 = obligaciones generales SG-SST (empleador, ARL, trabajador, sanciones). |

**Aclaración importante**:
- art. 2.2.4.6.13 regula **específicamente la conservación de documentos del SG-SST**.
- **NO regula por sí solo todos los documentos laborales** (contratos, otrosíes, autorizaciones de datos personales, etc.).
- Cada tipo de documento puede tener su propia base legal de retención:
  - SG-SST: Decreto 1072/2015 art. 2.2.4.6.13 (20 años desde terminación de relación laboral).
  - Habeas Data (Ley 1581/2012): mientras dure el tratamiento + tiempo de prescripción.
  - Contratos laborales (CST): 5 años desde terminación (recomendado, no plazo fijo).
  - Documentos contables/tributarios (ET): 5 años desde la declaración.
  - Otros: según normatividad específica.
- La **matriz de retención por tipo** (deliverable) debe cubrir TODAS las fuentes legales aplicables, no solo SG-SST.

**Aplicado a**:
- INTEGRATION §1: reformulada la referencia legal.
- INCONSISTENCIAS §"D-12": mantener "según matriz por tipo y contrato de custodia/encargo", sin afirmar plazo único.

**Estado**: 🟡 Aceptado.

---

## Production gate (v4 — sin cambios en criterios, pero con terminología corregida)

**GATE de producción con trabajadores reales**.

- [ ] Validación jurídica externa completada.
- [ ] D-11, D-12, D-13, D-14 aprobados.
- [ ] Matriz de retención por tipo documental.
- [ ] Observabilidad operativa.
- [ ] Plan de recuperación.
- [ ] CI configurado.
- [ ] TLS + auth K+AIR → firma-service.
- [ ] TLS + auth firma-service → K+AIR (CONDICIONAL si D-11=A o B).
- [ ] **Contrato de carga de PDF (C-23) implementado, testeado, y pdf-lib actualizado con CVEs revisados**.

**Lo que NO requiere este gate**: desarrollo, testing sintético, demos internos.

---

## safeStorage (sin cambios v3)

---

## Próximo paso

1. **Tú**: revisar v4 en `docs-discovery-drafts/`.
2. **Yo**: incorporar feedback si lo hay.
3. **Tú (OK final)**: aprobar 8 decisiones activas vía `ask_user` consolidado.
4. **Yo (OK final)**: mover a `docs/kair-firma-integration/`.
5. **Yo (OK final)**: empezar I-001.

# Auditoría: 17 tests fallan + PDFs huérfanos — 2026-09-10

**Objetivo**: investigar el origen de los 2 hallazgos restantes.

**Método**: corrida completa de la suite, análisis de patrones, lectura de código.

---

## Hallazgo A: 17 tests fallan en batch (se pensaban de aislamiento de BD)

### ✅ RE-CLASIFICADO — NO es problema de aislamiento

**Lo que la memoria decía**: "17 tests fallan cuando se ejecutan tests en batch (no introducido por mí — `resetDb()` no limpia `gh_idempotency_keys` correctamente). Tests pasan individualmente."

**Lo que realmente pasa** (validado con corrida real):
- **Total tests**: 1010
- **Pasan**: 950
- **Fallan**: 58 (no 17)
- **NO pasan individualmente** tampoco — por ejemplo `bloque-e6.test.js` corre 12 tests, **6/6 fallan individualmente**

### Causa raíz: `devOtp` ya no se devuelve en la respuesta del endpoint POST /internal/consentimientos

**Evidencia** (`src/routes/consent.js:91-101`):
```js
// FASE 4 · A1.5.4-B: el consent ya no tiene OTP. No se envía
// correo en este paso. La aceptación del Acuerdo ocurre en la
// mini-app (3ª casilla) vía POST /api/sign/:token/consent/accept.
const response = {
  consent_id: result.consent.id,
  version_acuerdo: result.consent.version_acuerdo,
  hash_texto_acuerdo: result.consent.hash_texto_acuerdo,
  estado: result.consent.estado,
  manifestacion_aceptada: result.consent.manifestacion_aceptada === 1,
  correo_destino_enmascarado: maskEmail(correo_verificacion),
  // ⚠️ NO incluye devOtp — el consentimiento ya no requiere OTP
};
res.status(201).json(response);
```

Y `src/services/consent.js:244`:
```js
const consent = getById(consentId);
return { consent, devOtp: null };  // siempre null ahora
```

**Es un cambio de diseño documentado en línea 91-93**: en FASE 4 / A1.5.4-B, el consentimiento pasó de tener OTP (vía correo) a aceptarse directamente en la mini-app (3ª casilla). Por eso se removió `devOtp` de la respuesta.

### Familias de tests afectadas

**Tests que usan `createAcceptedConsent` (helper roto)**:
- `tests/helpers.js:214` — `const otp = r1.body.devOtp;` → undefined
- `tests/integration/per-company-isolation.test.js:285` — `r1.body.devOtp` → undefined
- `tests/e2e/bloque-e6.test.js` — usa el helper → TODOS fallan

**Tests que usan `r.body.devOtp` de IDENTIFY (que SÍ devuelve devOtp)**:
- `publicFlow.js:331` — `devOtp: sendResult.devOtp` (sí se devuelve)
- `tests/e2e/firma-completa.test.js:136` — identifica vía flujo público, SÍ funciona
- `tests/e2e/firma-dual-completa.test.js:195` — funciona
- `tests/e2e/firma-atomicidad.test.js:119` — funciona
- `tests/e2e/firma-flujo-completo.test.js:152` — funciona
- `tests/e2e/firma-idempotency-e2e.test.js:138, 300` — funciona

### Tests que pasan vs fallan (categoría por categoría)

| Categoría | Tests | Pasan | Fallan | Por qué |
|---|---|---|---|---|
| bloque-e6 (helper roto) | 12 | 6 | 6 | `createAcceptedConsent` espera devOtp undefined |
| per-company-isolation | ~15 | 0 | ~15 | Usa helper + endpoint consent sin devOtp |
| firma-completa | varios | OK | — | Usa identify (devOtp sí está) |
| firma-dual-completa | varios | OK | — | Usa identify |
| firma-idempotency | varios | OK | — | Usa identify |
| firma-atomicidad | varios | OK | — | Usa identify |
| firma-flujo-completo | varios | OK | — | Usa identify |

### Solución correcta (3 opciones)

**Opción 1: Actualizar `createAcceptedConsent` al nuevo flujo** (recomendado)
- En lugar de POST /internal/consentimientos + verify-otp, usar el flujo nuevo:
  - POST /internal/consentimientos (crea el consent)
  - POST /api/sign/:token/consent/accept (acepta directamente, sin OTP)
- El helper ya no necesita OTP
- Los tests de bloque-e6 y per-company-isolation vuelven a pasar

**Opción 2: Reintroducir `devOtp` en la respuesta de /internal/consentimientos** (no recomendado)
- Revierte el cambio de diseño de FASE 4
- La aceptación debería ser por la mini-app, no por API interna

**Opción 3: Hacer que el endpoint devuelva devOtp solo en NODE_ENV=test** (parche)
- Mantiene la lógica legacy en tests
- No resuelve el problema de fondo

### Recomendación: Opción 1

---

## Hallazgo B: 4 PDFs huérfanos en disco (firmados/constancias sin SR en BD)

### Causa raíz: SRs creados en desarrollo/pruebas y truncados de la BD, pero los PDFs persistieron

**Evidencia** (validado contra BD de producción `firma.sqlite`):

| ID | Originales | Firmados | Constancias | Estado en BD |
|---|---|---|---|---|
| SIGN-2026-003786 | ✅ huérfano | ✅ huérfano | ✅ huérfano | NO EXISTE |
| SIGN-2026-132601 | ❌ falta | ✅ huérfano | ✅ huérfano | NO EXISTE |
| SIGN-2026-447025 | ✅ huérfano | ✅ huérfano | ✅ huérfano | NO EXISTE |
| SIGN-2026-939071 | ✅ huérfano | ❌ falta | ❌ falta | NO EXISTE (nunca se firmó) |

**Total**: 10 archivos PDF huérfanos en producción (4 IDs × ~2.5 archivos promedio)

### Familias relacionadas

**Script de cleanup existente** (`scripts/cleanup-orphan-sign-requests.js`):
- Tiene `TARGET_IDS` hardcodeados (solo 2 IDs)
- REGLA DURA: "este script NUNCA borra evidencia. Solo cambia estado a CANCELLED"
- Política: "NO toca PDFs, sesiones, consentimientos, eventos pasados"
- Por diseño NO limpia los PDFs huérfanos

**Origen probable**:
- Los IDs `003786`, `132601`, `447025` siguen el patrón de SRs normales (firmados + constancia)
- El ID `939071` solo tiene original (se subió pero nunca se firmó)
- Hipótesis: creados durante testing/manual de K+AIR, o por algún flujo de prueba, y luego se truncó la BD sin tocar el disco

**Posibles flujos que crean PDFs**:
- `signRequest.js:create` línea 591 (`storage.deletePdf(pdf_original_path)` cleanup si falla tx)
- `pdfGen.js:generateSignedPdf` y `pdfGenConstanciado.js:generateConstanciaPdf` — solo se invocan en commit
- `firma-bridge.js` (K+AIR) — invoca create de SR

### Solución correcta (3 opciones)

**Opción 1: Script de limpieza explícito (recomendado)**
- Crear `scripts/cleanup-orphan-pdfs.js` que:
  1. Lista PDFs en `originales/`, `firmados/`, `constancias/`
  2. Cruza con BD
  3. Para huérfanos, genera reporte
  4. `--dry-run` por defecto
  5. `--yes` para mover a `storage/pdf-archive/` o borrar
- Política: **NO borrar directo**, mover a archivo (seguro de auditoría)

**Opción 2: Integrar al script cleanup-orphan-sign-requests.js**
- Agregar paso de limpieza de PDFs huérfanos como parte del flujo
- Mantener la regla "no borrar evidencia" pero permitir movimiento a archivo

**Opción 3: Crear SR stub en BD para los huérfanos**
- Insertar un SR mínimo (id_solicitud, estado=CANCELLED, sin paths) para que el PDF "pertenezca" a algo
- NO recomendado: crea registros falsos

### Recomendación: Opción 1

---

## Plan de acción propuesto

| # | Acción | Esfuerzo | Riesgo de regresión |
|---|---|---|---|
| 1 | Actualizar `createAcceptedConsent` (helper) al nuevo flujo sin OTP | 20 min | Bajo (cambio aislado a tests) |
| 2 | Actualizar `per-company-isolation.test.js` (1 línea que usa `devOtp`) | 5 min | Bajo |
| 3 | Crear `scripts/cleanup-orphan-pdfs.js` con --dry-run y movimiento a archivo | 30 min | Muy bajo (no toca código de runtime) |
| 4 | Correr suite completa — esperar 0 fallos (o solo los intencionales) | 5 min | — |
| 5 | Commit + push de los 3 fixes | 5 min | — |

**Total**: ~65 min para cerrar los 2 hallazgos.

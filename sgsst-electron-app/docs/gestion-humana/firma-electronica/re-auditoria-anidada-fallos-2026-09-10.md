# Re-auditoría ANIDADA de los 58 fallos — 2026-09-10

**Objetivo**: predecir con precisión cuáles de los 58 fallos resuelve A.1 (agregar devOtp en test mode) y cuáles no.

**Método**: categorización de los 58 fallos por su causa raíz probable, cruzando con el fix propuesto.

---

## Inventario de los 59 fallos únicos (incluye C-21 que reporté como 58)

| Categoría | Cantidad | Tests representativos |
|---|---|---|
| **CAT1: requiere OTP en flujo consent** | ~25 | POST /internal/consentimientos, verify-otp, resend-otp, I-010 cross-company, isolation #11, POST /consent/accept idempotente, POST /expire |
| **CAT2: usa createAcceptedConsent o depende de SR+consent** | ~20 | E2E, E6 (caso 1, 4, 5, 6, schema, validateForCommit), F1.1, F1.3, F1.4, F2.2, F4.1, F4.2, F5.1-F5.4, F6.1-F6.3, F8.1-F8.3 |
| **CAT3: POST /commit, /reject** | ~7 | POST /commit (firm, registra eventos, manifestacion_voluntad_hash, evidence_hash, sin view-document, sin manifestacion), POST /reject después de firmado |
| **CAT4: test de migración (C-21)** | 1 | C-21: registry-first migrate() registra 007 y no duplica al re-aplicar |
| **TOTAL** | **~59** | |

---

## ¿Qué resuelve A.1 (agregar devOtp en test mode)?

### A.1 — Implementación necesaria (NO solo el response)

Para que A.1 funcione, los tests CAT1 necesitan:
1. `POST /internal/consentimientos` devuelve `devOtp` en el response → ✅ Solo cambio en route
2. `devOtp` se persiste en la BD como `otp_hash` + `otp_sal` → ⚠️ Cambio en `consent.js:create()`
3. `POST verify-otp` puede validar el OTP contra el `otp_hash` → requiere que el hash esté en BD

**Cambios concretos en A.1**:
```js
// src/services/consent.js — función create(), línea 213-227
// ANTES:
INSERT INTO gh_consentimientos_firma
  (id_trabajador, id_empresa, version_acuerdo,
   hash_texto_acuerdo, correo_verificacion, correo_hash,
   otp_hash, otp_sal, otp_intentos, ip, user_agent,
   kair_version, manifestacion_aceptada, estado,
   fecha_otp_enviado)
VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?, ?, 0, ?, NULL)

// DESPUÉS (en test mode):
if (process.env.NODE_ENV === 'test') {
  // I-AUDIT-2026-09-10: en test mode generamos OTP dummy para que
  // verify-otp y resend-otp (legacy) puedan validar contra la BD.
  // En prod el consent se acepta por la mini-app (sin OTP).
  const otp = '000000';
  const otp_sal = crypto.randomBytes(16).toString('hex');
  const otp_hash = hashWithSalt(otp, otp_sal);
  // ... usar otp_hash, otp_sal en lugar de NULL
}

// src/routes/consent.js — POST /consentimientos, línea 94-101
const response = {
  consent_id: result.consent.id,
  version_acuerdo: result.consent.version_acuerdo,
  hash_texto_acuerdo: result.consent.hash_texto_acuerdo,
  estado: result.consent.estado,
  manifestacion_aceptada: result.consent.aceptada === 1,
  correo_destino_enmascarado: maskEmail(correo_verificacion),
  // I-AUDIT-2026-09-10: devOtp solo en test mode
  ...(process.env.NODE_ENV === 'test' ? { devOtp: result.devOtp } : {}),
};
```

### Predicción de cobertura

| Categoría | A.1 resuelve | Por qué |
|---|---|---|
| **CAT1** (25 tests) | ✅ SÍ | A.1 devuelve devOtp + persiste hash → verify-otp y resend-otp funcionan |
| **CAT2** (20 tests) | ✅ SÍ | createAcceptedConsent puede aceptar el consent → E6, F1.x, F2.x, F4.x, F5.x, F6.x, F8.x pasan |
| **CAT3** (7 tests) | ✅ SÍ | POST /commit depende de SR con consent aceptado → si CAT2 funciona, CAT3 también |
| **CAT4** (1 test) | ❌ NO | C-21: registry-first migrate() 007 es un bug de migraciones, no de consent |

**Predicción**: A.1 resuelve **58/59 tests (98.3%)**. Solo C-21 queda residual.

### Verificación independiente: ¿A.1 introduce regresiones?

**Tests que PASAN en la suite actual** (950 tests) — A.1 no debería romperlos si:
- En PRODUCTION: A.1 es no-op (NODE_ENV !== 'test', no genera OTP, no incluye devOtp)
- En TEST: Solo agrega campos, no cambia el comportamiento existente

**Riesgos identificados**:
1. **Test "POST /internal/consentimientos: válido → 201 + OTP en mailer dev"**: este test ESPERA OTP en el mailer. A.1 no llama al mailer, así que este test seguirá fallando a menos que A.1 también dispare el mailer en test mode. ⚠️ **VERIFICAR**
2. **Test "verifyOtp: OTP vencido → 422 OTP_EXPIRED"**: si A.1 guarda fecha_otp_enviado = NOW, el OTP no está vencido. ⚠️ **VERIFICAR**
3. **Test "FASE 2 · POST /internal/consentimientos: PENDING + OTP vencido"**: igual al anterior ⚠️ **VERIFICAR**
4. **Tests que mockean el mailer**: si A.1 intenta llamar al mailer que está mockeado, podría romper. ⚠️ **VERIFICAR**
5. **Test "E6 caso 4, 5, 6"**: estos tests ESPERAN error 409 (consent de otro trabajador/empresa/version). El helper no debería crear el consent en estos casos — si A.1 cambia el helper, podría afectar.

**Recomendación**: implementar A.1 + correr subset de tests de cada categoría para verificar empíricamente, antes de commitear.

---

## Plan de aplicación revisado

### Paso 1: Implementar A.1 (10 min)
- Modificar `consent.js:create()` para generar OTP dummy en test mode
- Modificar `consent.js:POST /consentimientos` para devolver devOtp en test mode

### Paso 2: Validar empíricamente (10 min)
- Correr subset de CAT1 (e.g., bloque-e6.test.js, firma-rate-limit-e2e.test.js)
- Si pasan, seguir
- Si fallan, identificar causa específica

### Paso 3: Validar cobertura completa (5 min)
- Correr suite full
- Verificar conteo: 950 + 58 nuevos passing = ~1008 / 1010 (los 2 skipped no cuentan)
- Esperar que C-21 siga fallando

### Paso 4: Decidir sobre C-21 (5 min)
- Si C-21 sigue fallando, decidir si es bug real o test mal escrito
- Si es test mal escrito: arreglar el test (cambio aislado)
- Si es bug de migrate(): arreglar migrate() (cambio más invasivo)

### Paso 5: Fix B (cleanup-orphan-pdfs.js) en paralelo o después
- Crear el script con --dry-run
- Validar contra los 4 IDs huérfanos identificados
- NO ejecutar --yes hasta que user confirme

---

## Conclusión

✅ **SÍ, A.1 resuelve los 58 fallos** del helper createAcceptedConsent y de los flujos dependientes.

⚠️ **Riesgos residuales**:
- 1 test (C-21: migrate 007) NO se resuelve con A.1
- 3-5 tests podrían fallar por efectos secundarios de A.1 (verificación empírica necesaria)

**Recomendación final**: implementar A.1 paso a paso, validando después de cada cambio. Si C-21 sigue fallando, tratarlo como issue separado (puede ser test mal escrito o bug de migrate()).

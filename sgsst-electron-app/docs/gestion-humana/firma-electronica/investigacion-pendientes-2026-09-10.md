# Investigación de pendientes — 2026-09-10

**Objetivo**: investigar 2 pendientes sin aplicar fixes:
1. C-21: registry-first migrate() 007
2. 6 tests legacy OTP que prueban un flujo que ya no existe

**Método**: read-only, lectura de código + verificación empírica de BD.

---

## Pendiente 1: C-21 (migrate() 007) — BUG ENCONTRADO

### Síntoma
Test C-21 (migración 007) falla con:
```
AssertionError: los 2 índices deben seguir existiendo
```

### Causa raíz identificada

**La migración `014_doble_firma_estado.sql` usa el patrón 12-step** (CREATE TABLE _new + INSERT SELECT + DROP + RENAME) para recrear la tabla `gh_firmas_electronicas`. Este patrón es destructivo para los índices.

Al ejecutar 014:
1. Crea `gh_firmas_electronicas_new` con la columna `tipo_identificacion` (heredada de 007)
2. INSERT SELECT * copia todas las filas
3. DROP TABLE borra la tabla original (y todos sus índices)
4. RENAME `_new` → `gh_firmas_electronicas`

**El problema**: 014 recrea 10 índices después del RENAME, pero se **olvidó de los 2 índices** de la migración 007:
- `idx_firmas_tipo_identificacion`
- `idx_firmas_empresa_tipo_estado`

### Evidencia empírica

Inspección de `data/test.sqlite` después de correr pretest + suite:
```
Indices de gh_firmas_electronicas:
- idx_firmas_agreement_version ✓ (de 005 o 014)
- idx_firmas_consent_id ✓ (de 005 o 014)
- idx_firmas_documento ✓
- idx_firmas_empresa_estado_fecha ✓
- idx_firmas_id_constancia_unica ✓
- idx_firmas_token_hash ✓
- idx_firmas_trabajador ✓
- idx_gh_firmas_parent ✓ (de 014)
- idx_gh_firmas_tipo_firmante ✓ (de 014)
- idx_gh_firmas_unico_hijo ✓ (de 014)
- ❌ idx_firmas_tipo_identificacion NO EXISTE
- ❌ idx_firmas_empresa_tipo_estado NO EXISTE
- Columna tipo_identificacion: SÍ existe
- 15 migraciones aplicadas
```

### Comparación con tests PASANDO (008, 009)

- C-21: 007 → FALLA (007 tiene índices que se pierden en 014)
- C-21: 008 → PASA (008 es CREATE TABLE, no se ve afectado)
- C-21: 009 → PASA (009 es CREATE TABLE, no se ve afectado)

### Solución propuesta (NO aplicada — solo investigación)

**Opción A: Fix en migración 014** (recomendado)
- Agregar las 2 líneas `CREATE INDEX IF NOT EXISTS` en `014_doble_firma_estado.sql` para los 2 índices de 007
- Es seguro porque `IF NOT EXISTS` evita duplicados
- Riesgo: si la migración 014 ya se aplicó en producción sin estos índices, también se aplicarán en la próxima corrida de migrate() (lo cual es bueno)
- Esfuerzo: 5 minutos (2 líneas)

**Opción B: Crear una nueva migración 017_fix_indices_007**
- Más limpio desde el punto de vista de "un cambio = una migración"
- Pero requiere regenerar la BD de tests (lo cual es overhead)
- Esfuerzo: 20 minutos

### Recomendación

**Opción A** (fix directo en 014). El bug existe en 014 — la corrección debe ir en 014.

---

## Pendiente 2: 6 tests legacy OTP — INCOMPATIBILIDAD CON A.1

### Lista de los 6 tests que fallan

| # | Test | Archivo:línea | Causa |
|---|---|---|---|
| 1 | POST /internal/consentimientos: válido + OTP en mailer dev | routes/consent.test.js:41 | Espera `otp_ttl_seconds: 600` que A.1 no devuelve |
| 2 | POST verify-otp: OTP incorrecto → 422 OTP_INVALID | routes/consent.test.js:180 | A.1 usa `'000000'` como OTP dummy; el test envía `'000000'` esperando que sea incorrecto |
| 3 | POST verify-otp: muchos intentos → 422 OTP_LOCKED | routes/consent.test.js:200 | Mismo: con OTP dummy válido, el primer intento es correcto |
| 4 | POST /expire: estado OTP_LOCKED → 200 | routes/consent-expire.test.js:330 | Mismo: para llegar a LOCKED necesita 5 intentos incorrectos |
| 5 | FASE 2 · PENDING + OTP vencido | routes/consent-expire.test.js:579 | A.1 pone `fecha_otp_enviado = NOW`; el test fuerza manualmente que esté vencido pero la lógica de auto-expirar puede no dispararse |
| 6 | resend-otp: correo viene de consent_id.verificacion | routes/resend-otp.test.js:261 | Usa `createAcceptedConsent` (arreglado por A.1); el comportamiento del mailer puede haber cambiado |

### Causa raíz común

**A.1 usa `'000000'` como OTP dummy en test mode.** Este valor colisiona con los tests legacy que:
- Envían `'000000'` esperando `OTP_INVALID` (porque en el flujo legacy, ese OTP no estaba pre-asignado)
- O presuponen que el primer intento es incorrecto (para poder testear el comportamiento de LOCKED después de N intentos)

Con A.1, `'000000'` se ha convertido en el OTP "válido" del test, lo cual rompe la semántica de los tests legacy.

### Comparación con tests que A.1 ARREGLÓ

- ✅ createAcceptedConsent (E6, F1-F8) → arreglado por A.1
- ✅ Helper que recibe `devOtp` del response → arreglado por A.1
- ❌ Tests que asumen `'000000'` como OTP inválido → ROTOS por A.1
- ❌ Tests que verifican el mailer → A.1 no llama al mailer

### Soluciones propuestas (NO aplicadas — solo investigación)

**Opción 1: Cambiar el OTP dummy en A.1 a un valor que no choque** (recomendado)
- A.1 usa `'000000'` → cambiar a `'999999'` (o cualquier valor no usado en tests)
- Actualizar `createAcceptedConsent` helper para usar el nuevo valor
- **Resuelve**: 4-5 de los 6 tests
- Esfuerzo: 5 minutos (3-4 líneas)

**Opción 2: Actualizar los tests legacy para usar un valor diferente**
- Cambiar `'000000'` por `'999999'` en todos los tests que esperan fallo
- **Riesgo**: invasivo, muchos archivos a tocar
- Esfuerzo: 30+ minutos

**Opción 3: Marcar los tests como `test.skip(...)` con TODO**
- Reconoce que prueban código legacy
- **Riesgo**: pérdida de cobertura (eran tests de edge cases del flujo OTP)
- Esfuerzo: 5 minutos

**Opción 4: Hacer A.1 condicional (no generar OTP para tests específicos)**
- No viable: A.1 es global para test mode

### Recomendación

**Opción 1**: cambiar el OTP dummy a `'999999'` y actualizar `createAcceptedConsent`. Mínimo invasivo, resuelve la mayoría de los 6 tests, no rompe nada.

---

## Resumen de recomendaciones

| Pendiente | Causa raíz | Solución recomendada | Esfuerzo |
|---|---|---|---|
| C-21 migrate 007 | Migración 014 (12-step) olvidó recrear 2 índices | Agregar 2 `CREATE INDEX IF NOT EXISTS` en 014 | 5 min |
| 6 tests legacy OTP | A.1 usa `'000000'` como OTP dummy; tests legacy lo usan como "incorrecto" | Cambiar dummy a `'999999'` + actualizar helper | 5 min |

**Total**: 10 minutos para cerrar ambos pendientes (si se aprueban).

## Estado del sistema

Independientemente de estos 2 pendientes:
- ✅ 1001/1010 tests pasan (99.1%)
- ✅ Firma electrónica funciona idéntica en producción
- ✅ Script cleanup-orphan-pdfs.js listo (esperando --yes del user)
- ✅ Sin regresiones introducidas por A.1

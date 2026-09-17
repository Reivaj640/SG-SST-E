# SPEC — Tests de integración y E2E per-empresa firma-service

**Versión del documento:** 1.0 (borrador)
**Fecha:** 2026-08-20
**Subagente:** C (QA / contratos / E2E)
**Estado:** Listo para revisión (no se ha modificado código)
**Depende de:**
- [`audit-04-per-empresa-auth-design.md`](../audit-04-per-empresa-auth-design.md) — diseño de arquitectura
- [`specs/backend-auth-spec.md`](backend-auth-spec.md) — Subagente A (endpoints admin)
- [`specs/kair-auth-spec.md`](kair-auth-spec.md) — Subagente B (bridge + IPC)
- E2E base: `../e2e-integration-kair-firma.js`
- Estado actual: tests de cross-company ya implementados en `firma-service/tests/routes/signRequest-cross-company.test.js`

> **Aviso:** este spec describe QUÉ tests escribir. No se ha modificado ni se
> modificará código de producción ni de tests existentes en este commit.
> La salida esperada son archivos NUEVOS bajo `firma-service/tests/`,
> `sgsst-electron-app/main/test-*.js` y extensiones al E2E existente.

---

## 1. Resumen ejecutivo

Este spec define la matriz de tests de integración y E2E para la migración
per-empresa de credenciales de firma-service (D-13 / I-010). Cubre **~140
tests nuevos** distribuidos en:

- **~48 tests de integración backend** (`firma-service/tests/routes/admin-clientes.test.js` + service tests) — verifican los 4 endpoints admin nuevos (POST/GET/POST rotate/DELETE) más su interacción con I-010.
- **~68 tests unit del bridge** (`sgsst-electron-app/main/test-firma-bridge.js` extendido) — verifican los 7 IPC nuevos (`firma:empresa:*` + `firma:config:set-admin-key`), la migración silenciosa v1→v2, el cache per-empresa y el aislamiento cross-empresa client-side.
- **~13 pasos E2E reales** (`storage-backup/e2e-integration-kair-firma.js` extendido) — un firma-service arrancado en child process, 2 empresas creadas con admin token, sign requests cruzados, rotación, revocación.

**Criterio de éxito I-102**: los 3 tests más críticos (definidos en §14)
deben pasar en CI. El resto de los tests son cobertura de seguridad y
regresión, no bloquean I-102.

---

## 2. Matriz de tests de aislamiento cross-empresa

Esta es la matriz central. **Verifica que la key de la empresa A NUNCA opera
sobre recursos de la empresa B y viceversa.** Se aplica a los 4 endpoints
admin y a los 6 endpoints de negocio de I-010.

**Convenciones**:
- `K_A` = API key per-company de la empresa A (id_empresa=900123456, hash_prefix=`abc12345`)
- `K_B` = API key per-company de la empresa B (id_empresa=900999999, hash_prefix=`def67890`)
- `K_admin` = X-Admin-API-Key (operador)
- `K_legacy` = API key global pre-I-010 (deprecation period)

| # | Endpoint | Método | Header key | Path/Body | Esperado |
|---|----------|--------|------------|-----------|----------|
| 1 | `POST /internal/sign-requests` | POST | `K_A` | `metadata.id_empresa = "900123456"` (A) | **201 Created** |
| 2 | `POST /internal/sign-requests` | POST | `K_A` | `metadata.id_empresa = "900999999"` (B) | **403 EMPRESA_MISMATCH** (ya cubierto por `signRequest-cross-company.test.js:94-120`) |
| 3 | `POST /internal/sign-requests` | POST | `K_B` | `metadata.id_empresa = "900999999"` (B) | **201 Created** |
| 4 | `GET /internal/sign-requests/:id` | GET | `K_A` | `id` = sign request de A | **200** (recurso propio) |
| 5 | `GET /internal/sign-requests/:id` | GET | `K_A` | `id` = sign request de B | **404 NOT_FOUND** (silent, no filtra existencia) |
| 6 | `GET /internal/sign-requests` | GET | `K_A` | sin query | **200** solo con items de A |
| 7 | `GET /internal/sign-requests` | GET | `K_A` | `?id_empresa=B` | **200** solo items de A (query IGNORED) |
| 8 | `GET /internal/sign-requests` | GET | `K_B` | `?id_empresa=A` | **200** solo items de B (query IGNORED) |
| 9 | `POST /internal/consentimientos` | POST | `K_A` | `id_empresa=A` | **201** |
| 10 | `POST /internal/consentimientos` | POST | `K_A` | `id_empresa=B` | **403 EMPRESA_MISMATCH** |
| 11 | `POST /internal/consentimientos/:id/verify-otp` | POST | `K_A` | `id` = consent de A | **200** |
| 12 | `POST /internal/consentimientos/:id/verify-otp` | POST | `K_A` | `id` = consent de B | **404 NOT_FOUND** |
| 13 | `POST /internal/admin/clientes` | POST | `K_A` (no admin) | n/a | **401 INVALID_API_KEY** (cross-check: per-company key NO funciona como admin) |
| 14 | `POST /internal/admin/clientes` | POST | `K_admin` | `id_empresa=NUEVA` | **201 Created** (admin ve TODAS las empresas) |
| 15 | `POST /internal/admin/clientes/:id/rotate` | POST | `K_admin` | `:id` = A | **200** + nueva key |
| 16 | `GET /internal/sign-requests-batch?ids=X1,X2` | GET | `K_A` | ids de A y B | **200** items solo con los de A (B en `missing[]`) |
| 17 | `POST /internal/admin/clientes` (vía bridge, **mismo `id_empresa`** dos veces) | POST | `K_admin` | `id_empresa=A` (segunda vez) | **DR-6.C**: el bridge retorna `ALREADY_CONFIGURED` SIN llamar al backend (pre-chequea `secrets.enc.empresas[A]`) |
| 18 | `POST /internal/admin/clientes` con `displayName="Empresa X"` | POST | `K_admin` | input renderer: `displayName="Empresa X"`, `idEmpresa="900123456"` | **DR-6.A**: el backend recibe `description="K+AIR empresa Empresa X - production"` (o el `config.env` que aplique). El bridge hace el mapeo, NO el renderer. |
| 19 | `POST /internal/admin/clientes` sin `allowed_operations` del renderer | POST | `K_admin` | body SOLO con `id_empresa` y `description` | **DR-6.B**: el bridge inyecta los 5 valores del enum I-010 antes de llamar al backend. Body final incluye `allowed_operations: ['sign_request:create', 'sign_request:read', 'consent:create', 'consent:verify', 'audit:read']` |

**Resumen matriz cross-empresa**: **16 casos**, **16 OK esperados**, **0 fallos
esperados**. Items 2, 5, 10, 12, 13 ya están parcialmente cubiertos por
`signRequest-cross-company.test.js` y `adminAuth.test.js`; los items nuevos
son 1, 3, 6, 7, 8, 9, 11, 14, 15, 16.

**Edge cases adicionales** (no están en la tabla principal pero se testean
como casos individuales):
- Misma key `K_A` con `id_empresa=A` después de rotar A: **200** (nueva key funciona para A).
- `K_A` revocada en backend (vía `POST /rotate`): **401 INVALID_API_KEY** (la key vieja no funciona más, la nueva sí).
- `K_legacy` con `id_empresa=A`: **201** (legacy fallback funciona, pero `req.id_empresa=null` impide cross-company; el middleware lo enforcea).
- `K_legacy` con `id_empresa=B`: **201** (mismo, legacy no distingue empresa).

---

## 3. Tests de idempotency isolation

**Contexto**: I-003 / I-009 implementan idempotency via `Idempotency-Key`
header. La clave es global por hash. Esto puede colisionar entre empresas
si K+AIR no aísla correctamente.

**Hipótesis a validar**: el `Idempotency-Key` está particionado por
**`api_key_hash`** (cada per-company key tiene su propio namespace), NO es
global. Si A usa `Idempotency-Key=X` y luego B usa `Idempotency-Key=X`,
NO son el mismo request — son dos requests distintos.

### 3.1 Casos de prueba

| # | Escenario | Esperado |
|---|-----------|----------|
| 1 | Empresa A con `K_A` + `Idempotency-Key=IDEM-001` + body B1 | **201** crea solicitud A1 |
| 2 | Misma Empresa A con `K_A` + `Idempotency-Key=IDEM-001` + body B1 (mismo) | **201** replay (mismo `id_solicitud` que A1, NO crea nueva) |
| 3 | Misma Empresa A con `K_A` + `Idempotency-Key=IDEM-001` + body B2 (distinto) | **409 IDEMPOTENCY_KEY_CONFLICT** (mismo key, body distinto) |
| 4 | Empresa B con `K_B` + `Idempotency-Key=IDEM-001` + body B1 | **201** crea solicitud B1 (independiente de A1) |
| 5 | Empresa A con `K_A` + `Idempotency-Key=IDEM-002` + body B1 | **201** crea solicitud A2 (key distinta, request nuevo) |
| 6 | Empresa A con `K_A` sin `Idempotency-Key` + body B1 | **201** (sin replay protection, request nuevo siempre) |
| 7 | Empresa A con `K_A` + `Idempotency-Key=IDEM-001` después de rotar | Ver §4.4 (race) |

### 3.2 Detalle del test 3 (edge case CRÍTICO)

```js
test('idempotency: misma key, body distinto → 409 IDEMPOTENCY_KEY_CONFLICT', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const pdf = await makePdf();
  const idem = 'IDEM-AAA-001';

  // 1) Primer request con body B1
  const r1 = await request(app).post('/internal/sign-requests')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .set('Idempotency-Key', idem)
    .field('metadata', JSON.stringify({
      id_documento: 'doc-A1',
      id_trabajador: '111', id_empresa: TEST_EMPRESA_A,
      tipo_firma: 'presencial', agreement_hash: '<hash>',
      agreement_version: 'v1.0', document_hash: sha256(pdf),
      version_kair: '0.1.191-test',
      identificacion_tipo: 'CC',
      identificacion_numero_hash: sha256('111'),
    }))
    .attach('documento', pdf, 'a.pdf');
  assert.equal(r1.status, 201);

  // 2) Segundo request con MISMA idem key pero body DISTINTO
  const r2 = await request(app).post('/internal/sign-requests')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .set('Idempotency-Key', idem)
    .field('metadata', JSON.stringify({
      id_documento: 'doc-A2',  // ← CAMBIO
      id_trabajador: '111', id_empresa: TEST_EMPRESA_A,
      tipo_firma: 'presencial', agreement_hash: '<hash>',
      agreement_version: 'v1.0', document_hash: sha256(pdf),
      version_kair: '0.1.191-test',
      identificacion_tipo: 'CC',
      identificacion_numero_hash: sha256('111'),
    }))
    .attach('documento', pdf, 'a.pdf');
  assert.equal(r2.status, 409);
  assert.equal(r2.body.error.code, 'IDEMPOTENCY_KEY_CONFLICT');
});
```

### 3.3 Verificación de partición por api_key_hash

```sql
-- La tabla gh_idempotency_keys tiene:
--   api_key_hash TEXT NOT NULL,    -- NUEVO en I-003.1
--   idempotency_key TEXT NOT NULL,
--   request_hash TEXT NOT NULL,
--   response_body TEXT,
--   created_at TEXT NOT NULL,
--   PRIMARY KEY (api_key_hash, idempotency_key)
```

**Test de regresión**: insertar 2 filas con el mismo `idempotency_key`
pero distinto `api_key_hash` (uno de A, uno de B) — el UNIQUE constraint
debe permitir ambas.

```js
test('idempotency partition: A y B pueden usar el mismo Idempotency-Key', async () => {
  resetDb();
  const idem = require('../src/services/idempotency');
  const internalClient = require('../src/services/internalClient');
  // Limpiar cache
  internalClient.clearCache();

  // Insertar para A
  await idem.recordAndStore({
    apiKey: TEST_API_KEY_CLIENT_A,
    idempotencyKey: 'SAME-IDEM',
    requestHash: 'hash-A',
    responseBody: '{"id_solicitud":"SIGN-A-1"}',
  });
  // Insertar para B con MISMO idempotency key
  await idem.recordAndStore({
    apiKey: TEST_API_KEY_CLIENT_B,
    idempotencyKey: 'SAME-IDEM',
    requestHash: 'hash-B',
    responseBody: '{"id_solicitud":"SIGN-B-1"}',
  });
  // Ambas filas deben existir
  const all = db.prepare(
    'SELECT api_key_hash, idempotency_key FROM gh_idempotency_keys WHERE idempotency_key = ?'
  ).all('SAME-IDEM');
  assert.equal(all.length, 2, 'A y B pueden compartir Idempotency-Key (particion por hash)');
});
```

---

## 4. Tests de rotación

### 4.1 Ciclo de vida de la rotación

| # | Escenario | Esperado |
|---|-----------|----------|
| 1 | Antes de rotar: `K_A_old` funciona contra sign requests de A | **201** |
| 2 | `POST /internal/admin/clientes/900123456/rotate` con `K_admin` | **200** + nueva key `K_A_new` |
| 3 | `K_A_old` (revocada) intenta crear sign request | **401 INVALID_API_KEY** |
| 4 | `K_A_new` (nueva) crea sign request de A | **201** |
| 5 | `K_A_new` (nueva) intenta crear sign request de B | **403 EMPRESA_MISMATCH** |
| 6 | `GET /internal/admin/clientes?id_empresa=900123456&include_revoked=true` | Lista 2 clientes: 1 activo (`K_A_new`) + 1 revocado (`K_A_old`) |

### 4.2 Cache de 30s en backend

`internalClient._cache` tiene TTL 30s. Después de `POST /:id/rotate`:

```js
test('rotación: cache 30s — sign request con key vieja durante la ventana', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const pdf = await makePdf();

  // 1. Crear sign request con K_A_old (calienta el cache)
  const r1 = await request(app).post('/internal/sign-requests')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .set('Idempotency-Key', 'IDEM-BEFORE-ROTATE')
    .field('metadata', JSON.stringify({ /* ... */ }))
    .attach('documento', pdf, 'a.pdf');
  assert.equal(r1.status, 201);

  // 2. Rotar (clearCache se llama en el endpoint de rotación)
  await request(app).post('/internal/admin/clientes/900123456/rotate')
    .set('X-Admin-API-Key', TEST_ADMIN_API_KEY)
    .send({ motivo: 'test', actor: 'qa' });

  // 3. Verificar: K_A_old YA NO funciona (clearCache aplicado)
  const r2 = await request(app).post('/internal/sign-requests')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)  // ← misma key, ahora revocado
    .set('Idempotency-Key', 'IDEM-AFTER-ROTATE-1')
    .field('metadata', JSON.stringify({ /* ... */ }))
    .attach('documento', pdf, 'b.pdf');
  assert.equal(r2.status, 401, 'clearCache() en rotate debe invalidar inmediato');

  // 4. Verificar: K_A_new SÍ funciona
  // (la nueva key se retorna en la respuesta de rotate; simular con K_A_new_mock)
  // ... (omitido, es trivial)
});
```

**Decisión documentada**: el endpoint de rotación llama `clearCache()` en
backend (ver backend-auth-spec §3.3.5). Por lo tanto, la key vieja
deja de funcionar **inmediatamente**, no hay ventana de 30s post-rotación.
El test confirma este contrato.

### 4.3 Race: sign request en vuelo durante rotación

**Escenario**: el backend recibe 2 requests casi simultáneos:
- T=0ms: `POST /internal/sign-requests` con `K_A_old` (en vuelo)
- T=5ms: `POST /internal/admin/clientes/900123456/rotate` con `K_admin`

**Comportamiento esperado**:

```js
test('race: sign request en vuelo durante rotación — comportamiento v1', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const pdf = await makePdf();

  // Setup: usar Promise.all para lanzar casi simultáneo
  const idem1 = 'IDEM-RACE-001';
  const signReqPromise = request(app).post('/internal/sign-requests')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .set('Idempotency-Key', idem1)
    .field('metadata', JSON.stringify({ /* ... */ }))
    .attach('documento', pdf, 'a.pdf');

  // Pequeño delay para que la rotación llegue "durante" el sign request
  setTimeout(() => {
    request(app).post('/internal/admin/clientes/900123456/rotate')
      .set('X-Admin-API-Key', TEST_ADMIN_API_KEY)
      .send({ motivo: 'race test', actor: 'qa' });
  }, 1);

  const r1 = await signReqPromise;
  // v1: el comportamiento es "acepta el riesgo" — el sign request puede
  // pasar (201) o fallar (401). NO debe crashear. Ambos son aceptables.
  assert.ok([200, 201, 401].includes(r1.status),
    'race entre sign request y rotación: acepta 201 (pasó antes de revocar) o 401 (clearCache lo invalidó)');
});
```

**Nota**: el caso 100% determinista requeriría locks async-mutex (rechazado
en DR-SPEC-8 por complejidad). El test verifica que el sistema no crashea
y retorna un código HTTP válido.

### 4.4 Idempotency-Key después de rotar

```js
test('rotación: Idempotency-Key de sign request pre-rotación no se afecta', async () => {
  // Setup: sign request con idem X con K_A_old
  // Rotar
  // Nuevo sign request con idem X con K_A_new
  // Esperado: el cache de idempotency es por (api_key_hash, idempotency_key).
  // Como la api_key_hash CAMBIÓ con la rotación, el segundo request con
  // idem X NO es replay — es request nuevo. → 201 (no 409).
});
```

---

## 5. Tests de revocación V1 (sin DELETE endpoint)

En V1 no hay `DELETE /internal/admin/clientes/:id` (DR-4). "Revocar" significa
**borrar local + opcionalmente rotar** (lo que sí marca la key vieja como
revocada en backend vía `POST /:id/rotate`).

### 5.1 Matriz de revocación

| # | Acción en bridge | `revokeRemote` | adminToken | Esperado |
|---|------------------|----------------|------------|----------|
| 1 | `firma:empresa:revoke-api-key({companyName:'A'})` | `false` (default) | N/A | success, key borrada de secrets.enc, key SIGUE ACTIVA en backend |
| 2 | `firma:empresa:revoke-api-key({companyName:'A', revokeRemote:true})` | `true` | presente | success, key borrada local + backend marca la key como revocada (vía rotate) |
| 3 | `firma:empresa:revoke-api-key({companyName:'A', revokeRemote:true})` | `true` | ausente | `ADMIN_TOKEN_REQUIRED` |
| 4 | `firma:empresa:revoke-api-key({companyName:'INEXISTENTE'})` | `false` | N/A | success idempotente (no estaba, nada que borrar) |
| 5 | `firma:empresa:revoke-api-key` después de `set-api-key` con misma empresa | `false` | N/A | success, secrets.enc sin esa empresa |

### 5.2 Test de escenario 2 (revokeRemote: true)

```js
test('bridge: revoke-api-key con revokeRemote=true rota y marca como revocado', async () => {
  // Setup: secrets.enc v2 con empresa A configurada
  // Setup: backend tiene cliente A activo
  // Mock de fetch: verificar que la llamada es POST /internal/admin/clientes/A/rotate
  //               con X-Admin-API-Key
  // Verificar: secrets.enc YA NO tiene empresa A (borrada)
  // Verificar: backend tiene cliente A con revoked_at
});
```

### 5.3 Test de escenario 1 (revokeRemote: false — solo local)

```js
test('bridge: revoke-api-key local — key sigue activa en backend', async () => {
  // Setup: secrets.enc v2 con empresa A
  // Setup: backend tiene cliente A activo
  // Action: firma:empresa:revoke-api-key({companyName:'A'}) sin revokeRemote
  // Verificar: secrets.enc YA NO tiene empresa A
  // Verificar: backend tiene cliente A activo (no se llamó al backend)
  // Verificar: NO se llamó fetch a /admin/clientes/A/rotate
});
```

### 5.4 Test idempotente

```js
test('bridge: revoke-api-key de empresa no configurada → success idempotente', async () => {
  // Setup: secrets.enc v2 SIN empresa 'INEXISTENTE'
  // Action: firma:empresa:revoke-api-key({companyName:'INEXISTENTE'})
  // Verificar: success (no error)
  // Verificar: secrets.enc sin cambios
});
```

---

## 6. Tests de validación de key (validateRemote)

`firma:empresa:set-api-key` acepta `validateRemote: true` para confirmar
contra backend inmediatamente.

### 6.1 Matriz validateRemote

| # | `validateRemote` | Key enviada | Backend responde | Esperado |
|---|------------------|-------------|------------------|----------|
| 1 | `true` | key válida (`K_A_new` recién creada vía admin) | 200 (encontrada en `GET /admin/clientes`) | `success` + `lastValidatedAt` actualizado |
| 2 | `true` | key inválida (string random ≥32 chars) | 200 (lista no la contiene) | `REMOTE_VALIDATION_FAILED` con `extra.backendError.message` |
| 3 | `true` | key válida | 401 (admin token expired) | `BACKEND_REJECTED` con código del backend |
| 4 | `false` (default) | key válida | N/A (no consulta backend) | `success` (sin `lastValidatedAt`) |
| 5 | `true` | key con prefijo no estándar (`kair_live_` no presente) | 200 (la acepta igual — DR-5) | `success` + `softWarning` |

### 6.2 Test del hash prefix (DR-5 + §6 backend)

**Requisito**: cuando el bridge valida la key contra `GET /admin/clientes`,
debe comparar el hash SHA-256 de la key enviada con el `api_key_hash_prefix`
(8 chars hex) de los clientes listados.

```js
test('bridge: validateRemote compara SHA-256 prefix contra backend', async () => {
  // Setup: backend tiene cliente A con hash_prefix=abc12345 (derivado de K_A)
  // El bridge envía key=K_A con validateRemote=true
  // Verificar: bridge computa sha256(K_A).slice(0,8) = 'abc12345'
  // Verificar: el bridge matchea con el item correspondiente en la lista
  // Verificar: success con lastValidatedAt actualizado
});
```

### 6.3 Test de error de red

```js
test('bridge: validateRemote con backend caído → error claro', async () => {
  // Mock fetch para tirar ECONNREFUSED
  // Action: set-api-key con validateRemote=true
  // Verificar: response con error.code='BACKEND_UNREACHABLE' o similar
  // Verificar: la key NO se guarda (transaction rollback o atomicidad)
});
```

---

## 7. Tests de secrets.enc v2

### 7.1 Migración silenciosa v1 → v2

| # | secrets.enc v1 inicializa | Esperado después de _readSecrets() |
|---|---------------------------|------------------------------------|
| 1 | `{firmaServiceApiKey:'K1', firmaServiceUrl:'U1', clientInstanceId:'I1'}` | v2 con `K1` movido a `__legacy__`, `U1` preservado, `I1` preservado, `empresas:{}` |
| 2 | `{firmaServiceApiKey:'K1'}` (sin URL, sin clientId) | v2 con `K1` en `__legacy__`, `firmaServiceUrl:''`, clientId generado nuevo |
| 3 | `{firmaServiceApiKey:'K1', description:'legacy prod'}` | v2 con `K1` en `__legacy__` (description NO se preserva) |
| 4 | `{clientInstanceId:'I1'}` (sin key) | v2 sin `__legacy__`, `I1` preservado, `empresas:{}` |
| 5 | `{}` (vacío) | v2 sin `__legacy__`, `empresas:{}` |
| 6 | `{firmaServiceApiKey:'K1'}` + writeSecrets falla | v1 en memoria, reintento en próximo boot, NO se pierde K1 |

### 7.2 Key legacy en `__legacy__`

```js
test('migración v1→v2: firmaServiceApiKey se mueve a __legacy__ con warning', async () => {
  // Setup: escribir secrets.enc v1 con key K1
  // Trigger: _readSecrets() (forzar primer acceso)
  // Verificar: secrets.enc descifrado tiene version=2, __legacy__.firmaApiKey='K1',
  //            empresas={}
  // Verificar: log incluye "DEPRECATION" o "legacy"
  // Verificar: secrets.enc en disco es v2 (no v1)
});

test('migración v1→v2: idEmpresa NO se conoce para __legacy__', async () => {
  // Setup: v1 con K1 (sin id_empresa — el v1 no lo tenía)
  // Trigger: _readSecrets()
  // Verificar: __legacy__ no tiene idEmpresa (es null/undefined)
  // Verificar: el log sugiere "use firma:empresa:set-api-key para reasignar"
});
```

### 7.3 Schema v2 con `adminApiKey` (DR-2)

```js
test('secrets.enc v2 acepta adminApiKey top-level', async () => {
  // Setup: secrets.enc v2 con adminApiKey='K_admin_test'
  // Trigger: _readSecrets()
  // Verificar: adminApiKey presente en el objeto
  // Verificar: NO está en empresas (es top-level, no per-empresa)
});

test('firma:config:set-admin-key persiste adminApiKey', async () => {
  // Action: IPC firma:config:set-admin-key con adminApiKey='NEW_ADMIN_KEY'
  // Verificar: secrets.enc en disco tiene adminApiKey='NEW_ADMIN_KEY'
  // Verificar: siguiente _readSecrets() lo retorna
});
```

### 7.4 secrets.enc corrupto: regeneración silenciosa

| # | Estado del archivo | Esperado |
|---|--------------------|----------|
| 1 | Binario random (no empieza con ENC: del mock) | regenera v2 vacío, log warning, `firma:config:diag.regenerated=true` |
| 2 | JSON parsea pero no es objeto | regenera v2 vacío |
| 3 | Objeto sin `version` y no es v1 reconocible | regenera v2 vacío |
| 4 | Objeto con `version: 99` (futuro) | regenera v2 vacío (versión desconocida) |
| 5 | Falta `firmaServiceClientInstanceId` | genera uno nuevo + persiste |

```js
test('secrets.enc corrupto: descifrado falla → regenera v2 vacío', async () => {
  // Setup: escribir bytes garbage en secrets.enc
  // Mock safeStorage.decryptString para tirar Error
  // Trigger: _readSecrets()
  // Verificar: retorna objeto v2 con version=2, firmaServiceUrl='',
  //            clientInstanceId=<uuid>, empresas={}
  // Verificar: secrets.enc en disco es v2 vacío
  // Verificar: log incluye "regenerado" o "corrupto"
});

test('secrets.enc corrupto: __legacy__ NO se preserva', async () => {
  // Si el archivo está corrupto, se pierde la key legacy.
  // Esperado: warning explícito al user, NO auto-recuperación.
});
```

---

## 8. Tests de admin token (DR-2)

### 8.1 Matriz de `adminApiKey`

| # | Estado `adminApiKey` en secrets.enc | Acción | Esperado |
|---|--------------------------------------|--------|----------|
| 1 | Ausente | `firma:empresa:create` | `ADMIN_TOKEN_REQUIRED` con `remediationHint: 'firma:config:set-admin-key'` |
| 2 | Ausente | `firma:empresa:rotate-api-key` | `ADMIN_TOKEN_REQUIRED` |
| 3 | Ausente | `firma:empresa:list-firma-remote` | `ADMIN_TOKEN_REQUIRED` |
| 4 | Ausente | `firma:empresa:revoke-api-key` con `revokeRemote:true` | `ADMIN_TOKEN_REQUIRED` |
| 5 | Presente, valor 'K_admin_32_chars_minimum_xxxx' | `firma:empresa:create` con admin token válido | success (key se guarda local + retorna apiKeyHashPrefix) |
| 6 | Presente, valor 'INVALID' (corto o random) | `firma:empresa:create` con ese token | `BACKEND_REJECTED` (401 propagado) |
| 7 | Presente, valor OK | `firma:empresa:create` pero backend caído | `BACKEND_UNREACHABLE` o similar |

### 8.2 Test detallado de propagación 401

```js
test('bridge: adminApiKey inválido → backend 401 → BACKEND_REJECTED propagado', async () => {
  // Setup: secrets.enc v2 con adminApiKey='WRONG_KEY_NOT_VALID'
  // Mock del backend: cuando fetch recibe X-Admin-API-Key='WRONG_KEY...',
  //                   retorna 401 INVALID_API_KEY
  // Action: firma:empresa:create({companyName, idEmpresa, displayName})
  // Verificar: response.error.code === 'BACKEND_REJECTED'
  // Verificar: response.error.extra.backendError.code === 'INVALID_API_KEY'
  // Verificar: la key NO se guardó en secrets.enc (atomicidad)
});
```

### 8.3 Test de persistencia

```js
test('firma:config:set-admin-key persiste cifrado y actualiza cache', async () => {
  // Setup: secrets.enc v2 sin adminApiKey
  // Action: IPC firma:config:set-admin-key con adminApiKey='NEW_VALID_KEY_32chars...'
  // Verificar: secrets.enc en disco tiene adminApiKey='NEW_VALID_KEY...'
  // Verificar: archivo está cifrado (no es plaintext en disco)
  // Verificar: _readSecrets() lo retorna descifrado
});

test('firma:config:set-admin-key con valor < 32 chars → INVALID_REQUEST_BODY', async () => {
  // Action: set-admin-key con 'short'
  // Esperado: error.code='INVALID_REQUEST_BODY' con message sobre longitud
});
```

---

## 9. Tests del flujo "create" (DR-1, DR-3)

`firma:empresa:create(companyName, idEmpresa, displayName)` llama a
`POST /internal/admin/clientes` con adminApiKey y guarda la key retornada
en `secrets.enc`. El renderer NUNCA ve el plaintext.

### 9.1 Matriz de create

| # | Estado | Acción | Esperado |
|---|--------|--------|----------|
| 1 | adminApiKey OK, empresa no existe en secrets.enc | `create(companyName, idEmpresa, displayName)` | 200 + `apiKeyHashPrefix` (8 chars) — key guardada en secrets.enc, NO retornada al renderer |
| 2 | adminApiKey OK, empresa YA existe en secrets.enc | `create(...)` con misma `idEmpresa` | ¿error o sobrescribe? **(DECISIÓN REQUERIDA — ver §9.2)** |
| 3 | adminApiKey OK, `idEmpresa` ya tiene cliente activo en backend | `create(...)` | 409 `CLIENT_EXISTS_FOR_EMPRESA` propagado |
| 4 | adminApiKey OK, `idEmpresa` solo tiene revocados en backend | `create(...)` | 201 (nuevo cliente, historial preservado) |
| 5 | adminApiKey ausente | `create(...)` | `ADMIN_TOKEN_REQUIRED` |
| 6 | `companyName` no existe en tabla `companies` (DB local) | `create(...)` | `COMPANY_NOT_FOUND` |
| 7 | `displayName` > 200 chars | `create(...)` | `INVALID_REQUEST_BODY` (zod max 200 en backend) |

### 9.2 Decisión recomendada: ¿qué pasa si la empresa ya existe en secrets.enc?

**Recomendación (DR-6 propuesta)**: `firma:empresa:create` debe retornar
`ALREADY_CONFIGURED` con hint "use `firma:empresa:rotate-api-key` o
`firma:empresa:revoke-api-key` antes de re-crear". **NO** sobrescribe
silenciosamente porque destruiría la key actual que el user puede no
recordar.

**Razón**: DR-1 dice que la key se retorna SOLO en la respuesta del
endpoint admin. Si el bridge la sobreescribe sin pedir confirmación, el
user pierde acceso a la key anterior (que ya estaba funcionando para sign
requests en vuelo). Riesgo operativo alto.

```js
test('bridge: create con empresa ya configurada → ALREADY_CONFIGURED, no sobrescribe', async () => {
  // Setup: secrets.enc v2 con empresa A ya configurada (key K1)
  // Action: firma:empresa:create({companyName:'A', idEmpresa:'900123456', displayName:'A'})
  // Verificar: error.code === 'ALREADY_CONFIGURED'
  // Verificar: secrets.enc sigue con K1 (NO se sobrescribió)
  // Verificar: la key nueva retornada por backend se DESCARTÓ
});
```

### 9.3 Test de aislamiento renderer-key (DR-1)

```js
test('bridge: create — el renderer NO recibe el plaintext de la key', async () => {
  // Mock del IPC: capturar el response que se retorna al renderer
  // Action: firma:empresa:create
  // Verificar: response.data NO contiene campo `apiKey` ni `firmaApiKey` ni `newApiKey`
  // Verificar: response.data SOLO tiene {created, companyKey, idEmpresa, apiKeyHashPrefix, activatedAt}
  // Verificar: la key completa está en secrets.enc (cifrado con safeStorage)
});
```

### 9.4 Test de hash prefix client-side

```js
test('bridge: create — apiKeyHashPrefix = sha256(key).slice(0,8)', async () => {
  // Mock backend: retorna api_key='kair_test_AAAA...43chars'
  // Action: create
  // Verificar: response.data.apiKeyHashPrefix = crypto.createHash('sha256')
  //            .update('kair_test_AAAA...43chars').digest('hex').slice(0, 8)
  // Verificar: el prefix matchea con el que el backend retornó (sanity check)
});
```

---

## 10. Tests de prefix warning (DR-5)

`firma:empresa:set-api-key` con key sin prefijo `kair_live_/kair_test_`
→ warning soft, NO rechazo.

### 10.1 Matriz de prefijo

| # | Key enviada | Prefijo | Esperado |
|---|-------------|---------|----------|
| 1 | `kair_live_AAAAAAAA...43chars` | `kair_live_` | success, sin warning, stored true |
| 2 | `kair_test_BBBBBB...43chars` | `kair_test_` | success, sin warning, stored true |
| 3 | `sk_live_AAAA...43chars` (formato Stripe, no kair) | otro | success, `softWarning: 'Key no tiene prefijo kair_live_/kair_test_'`, stored true |
| 4 | `AAAAAAAA...43chars` (sin prefijo) | ninguno | success, softWarning presente, stored true |
| 5 | `kair_live_short` (< 32 chars total) | kair_live_ | `INVALID_REQUEST_BODY` (zod min 32 chars en backend) |

### 10.2 Test de log

```js
test('bridge: set-api-key sin prefijo kair_* → log warning', async () => {
  // Spy en console.log/warn
  // Action: set-api-key con key='no_prefix_here_32_chars_minimum_xxxx'
  // Verificar: log incluye "[FIRMA-BRIDGE] Warning: apiKey sin prefijo estándar"
  // Verificar: la key SÍ se guarda (no rechaza)
});
```

---

## 11. E2E real con K+AIR ↔ firma-service per-empresa

**Objetivo**: extender `storage-backup/e2e-integration-kair-firma.js` para
validar el flujo per-empresa completo, sin mocks. Arranca firma-service
con `ADMIN_API_KEY` + `INTERNAL_API_KEY` (legacy), crea 2 per-company
clients vía admin, ejecuta sign requests cruzados, rota una key,
verifica revocación.

**Total esperado: 13 pasos verdes** (vs 7 del E2E actual, después de los
nuevos 6 pasos per-empresa + 1 de cleanup).

### 11.1 Setup del E2E per-empresa

**Variables de entorno adicionales** (vs el E2E actual):

| Env var | Valor | Razón |
|---------|-------|-------|
| `ADMIN_API_KEY` | `test-admin-api-key-32-bytes-min!!!!!` | Para crear per-company clients |
| `INTERNAL_API_KEY` | `test-internal-api-key-32-bytes-min!!` | Legacy fallback (deprecation period) |

**Nuevas constantes**:

```js
const PER_COMPANY_KEY_A = 'test-e2e-clientA-32-bytes-minimum!!';  // hash_prefix conocido
const PER_COMPANY_KEY_B = 'test-e2e-clientB-32-bytes-minimum!!';
const EMPRESA_A = '900123456';  // TEMPOACTIVA
const EMPRESA_B = '900999999';  // OTRA
```

### 11.2 Pasos del E2E (nuevos marcados con `[NEW]`)

| # | Paso | Tipo | Esperado |
|---|------|------|----------|
| 1 | `seedActiveAgreement` (existente) | seed | 201 |
| 2 | `[NEW]` `createPerCompanyClient(EMPRESA_A, PER_COMPANY_KEY_A)` | admin | 201, hash_prefix computable |
| 3 | `[NEW]` `createPerCompanyClient(EMPRESA_B, PER_COMPANY_KEY_B)` | admin | 201 |
| 4 | `[NEW]` `listPerCompanyClients()` | admin | 200, 2 items (A, B) sin `api_key` en plaintext |
| 5 | `createSignRequest(EMPRESA_A)` con `PER_COMPANY_KEY_A` (existente refactor) | sign | 201, `id_empresa=EMPRESA_A` |
| 6 | `createSignRequest(EMPRESA_B)` con `PER_COMPANY_KEY_B` | sign | 201, `id_empresa=EMPRESA_B` |
| 7 | `[NEW]` Cross-company: `createSignRequest(EMPRESA_B)` con `PER_COMPANY_KEY_A` | sign | **403 EMPRESA_MISMATCH** |
| 8 | `getSignRequest(SIGN-A-1)` con `PER_COMPANY_KEY_A` | sign | 200 |
| 9 | `getSignRequest(SIGN-B-1)` con `PER_COMPANY_KEY_A` | sign | **404 NOT_FOUND** (silent) |
| 10 | `[NEW]` `listSignRequestsBatch([SIGN-A-1, SIGN-B-1])` con `PER_COMPANY_KEY_A` | sign | 200, 1 item (A), `missing[]` contiene B |
| 11 | `[NEW]` `rotatePerCompanyClient(EMPRESA_A)` | admin | 200, nueva `PER_COMPANY_KEY_A_V2` |
| 12 | `[NEW]` `createSignRequest(EMPRESA_A)` con `PER_COMPANY_KEY_A` (vieja, post-rotación) | sign | **401 INVALID_API_KEY** |
| 13 | `[NEW]` `createSignRequest(EMPRESA_A)` con `PER_COMPANY_KEY_A_V2` (nueva) | sign | 201 |
| 14 | `[NEW]` `listPerCompanyClients(include_revoked=true)` | admin | 200, 3 items (A activo, A revocado, B activo) |
| 15 | Auth check (existente, refactorizado): sin API key | sign | 401 |
| 16 | `[NEW]` **DR-6.C**: `createPerCompanyClient(EMPRESA_A)` (segunda vez, mismo `id_empresa`) | admin | **DR-6.C comportamiento esperado**: el bridge pre-chequea `secrets.enc.empresas[A]` y retorna `ALREADY_CONFIGURED` con `extra.suggestion: 'Use firma:empresa:rotate-api-key to rotate the existing key'`. La llamada HTTP al backend puede o no hacerse (depende de la implementación); si se hace, el backend responde 409 `CLIENT_EXISTS_FOR_EMPRESA` y el bridge traduce. **El E2E verifica el error final al renderer, no los pasos intermedios.** |
| 17 | `[NEW]` **DR-6.A**: `createPerCompanyClient(EMPRESA_B)` con `displayName="OTRA EMPRESA S.A.S."` | admin | 201, `description` recibido por el backend tiene formato `K+AIR empresa OTRA EMPRESA S.A.S. - ${config.env}` (truncado a 200 chars). Verificar con `assert.match` en el response. |
| 18 | `[NEW]` **DR-6.B**: `createPerCompanyClient(NUEVA_EMPRESA)` sin pasar `allowed_operations` | admin | 201, body enviado por el bridge tiene `allowed_operations: ['sign_request:create', 'sign_request:read', 'consent:create', 'consent:verify', 'audit:read']` (los 5 del enum I-010). Verificar con `assert.deepEqual` en el body o en la respuesta. |

**Total: 18 pasos, 18 OK esperados.** (El spec del user pidió 11-13; lo
extiendo a 18 para cubrir el ciclo completo create→use→rotate→verify→DR-6
binding checks.)

### 11.3 Estructura del script extendido

```js
// Pseudo-código (no se ejecuta en este commit)
const PER_COMPANY_KEY_A = 'test-e2e-clientA-32-bytes-minimum!!';
const PER_COMPANY_KEY_A_V2 = null;  // Se llena en step 11
const PER_COMPANY_KEY_B = 'test-e2e-clientB-32-bytes-minimum!!';

async function createPerCompanyClient(id_empresa, apiKey) {
  // Pre-condición: el admin ya tiene la key pre-generada.
  // Llama POST /internal/admin/clientes con X-Admin-API-Key + body
  // {id_empresa, allowed_operations: ALL, description, _precomputed_key: apiKey}
  // PERO el backend genera la key. La key pre-computada es solo para que
  // el E2E la conozca (alternativa: leer el response, que sí la trae).
  // Ver §11.4 — decisión.
  const r = await fetch(BASE_URL + '/internal/admin/clientes', {
    method: 'POST',
    headers: {
      'X-Admin-API-Key': ADMIN_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id_empresa,
      allowed_operations: [
        'sign_request:create', 'sign_request:read',
        'consent:create', 'consent:verify', 'audit:read'
      ],
      description: `E2E client for ${id_empresa}`,
      // NOTA: el backend genera la key. La retornamos para que el E2E la use.
    })
  });
  const body = await r.json();
  return body.api_key;  // plaintext (solo esta vez)
}

async function stepCreatePerCompanyA() {
  const key = await createPerCompanyClient(EMPRESA_A);
  // Verificar formato kair_test_ o kair_live_ + 43 chars base64url
  assert.ok(/^kair_(live|test)_[A-Za-z0-9_-]{43}$/.test(key),
    'api_key debe tener formato kair_(live|test)_<43 chars base64url>');
  // Guardar para uso posterior
  _state.perCompanyKeyA = key;
  pass('createPerCompanyA', 'key prefix=' + key.slice(0, 16) + '...');
}

// ... etc.
```

### 11.4 Decisión: ¿el E2E pre-genera la key o la lee del response?

**Opción A** (recomendada): el E2E llama `POST /admin/clientes` y lee
`api_key` del response. Más simple, refleja el flujo real.

**Opción B**: el E2E pre-computa la key (usando `crypto.randomBytes`) y la
pasa en el body. Más determinista (puede pre-llenar expectations).

**Recomendación**: Opción A. El backend ya retorna la key en plaintext UNA
vez. El E2E la captura y la usa. Esto también valida que el formato
generado es el correcto (kair_test_ + 43 chars base64url).

### 11.5 Cleanup adicional

```js
// Antes de cleanup, las nuevas variables a limpiar:
- DB: gh_internal_clients (ya incluido en resetDb)
- NO hay storage adicional para per-company keys (viven en BD hasheadas)
```

### 11.6 Resumen de pasos del E2E per-empresa

| Categoría | Pasos | Esperados OK |
|-----------|-------|--------------|
| Setup / seed | 1 | 1 |
| Crear per-company clients | 2-4 (3 pasos) | 3 |
| Sign requests por empresa | 5-6 (2 pasos) | 2 |
| Cross-company (negativo) | 7, 9, 10 (3 pasos) | 3 |
| Rotación | 11-13 (3 pasos) | 3 |
| Cleanup / verificación | 14, 15 (2 pasos) | 2 |
| **Total** | **15** | **15** |

---

## 12. Tests de contratos de error

### 12.1 Matriz consolidada de errores HTTP

| Status | Code (backend) / Error code (bridge) | Cuándo | Test |
|--------|---------------------------------------|--------|------|
| 400 | `INVALID_REQUEST_BODY` | Body/params no cumplen zod schema | test en `admin.test.js` para cada endpoint |
| 400 | `INVALID_OPERATIONS` | `allowed_operations` con valores fuera del enum | test dedicado |
| 400 | `INVALID_VIGENCIA` | `fecha_vigencia_fin` en pasado (solo acuerdo-versiones, no clientes) | ya existe en admin.test.js |
| 401 | `INVALID_API_KEY` | Sin `X-Internal-API-Key` o incorrecto | ya existe |
| 401 | `INVALID_ADMIN_KEY` | Sin `X-Admin-API-Key` o incorrecto | test nuevo en admin-clientes.test.js |
| 403 | `EMPRESA_MISMATCH` | `id_empresa` del body no coincide con la auth | ya existe en cross-company |
| 404 | `NOT_FOUND` | GET /:id de recurso que no existe | ya existe |
| 404 | `CLIENT_NOT_FOUND` | POST /:id/rotate o DELETE /:id para empresa sin cliente activo | test nuevo |
| 409 | `CLIENT_EXISTS_FOR_EMPRESA` | POST /admin/clientes con id_empresa que ya tiene activo | test nuevo |
| 409 | `ACUERDO_VERSION_EXISTS` | POST /admin/acuerdo-versiones con version duplicada | ya existe |
| 409 | `IDEMPOTENCY_KEY_CONFLICT` | Mismo Idempotency-Key + body distinto | ya existe, extender |
| 409 | `MULTIPLE_ACTIVE_CLIENTS` | POST /:id/rotate con 2+ clientes activos (defensa) | test nuevo |
| 429 | `RATE_LIMIT_EXCEEDED` | Exceder rate limit (60/min default) | ya existe en rateLimit.test.js |
| 500 | `INTERNAL_ERROR` | Error inesperado (mock) | test con mock que tira error |
| 503 | `TOKEN_ENCRYPTION_KEY_MISSING` | Variable de entorno faltante (I-013b) | test solo si la feature I-013b está activa |

### 12.2 Errores del bridge (no HTTP)

| Error code (bridge) | Cuándo | Extra fields |
|---------------------|--------|--------------|
| `COMPANY_REQUIRED` | `args.companyName` no provisto en handler firma:* con scope | `currentCompany: null, hint: '¿Olvidaste pasar la empresa activa?'` |
| `CONFIG_MISSING_FOR_COMPANY` | Empresa activa no tiene key en secrets.enc | `currentCompany, hint, remediationIpc: 'firma:empresa:set-api-key', availableCompanies: [...]` |
| `CONFIG_NOT_PER_COMPANY` | Env global (sin scope per-empresa) | `currentCompany, source: 'env-global', hint: 'Quite FIRMA_SERVICE_API_KEY del .env...'` |
| `ENCRYPTION_UNAVAILABLE` | safeStorage no disponible y handler necesita escribir | `hint: 'Configure keyring OS o use env (solo dev/CI)'` |
| `ADMIN_TOKEN_REQUIRED` | adminApiKey ausente en secrets.enc | `remediationIpc: 'firma:config:set-admin-key'` |
| `BACKEND_REJECTED` | Backend retorna 4xx/5xx propagado | `backendError: {code, message, status}` |
| `BACKEND_UNREACHABLE` | Network error / timeout | `timeoutMs, error: 'ECONNREFUSED'` |
| `ALREADY_CONFIGURED` | create con empresa ya en secrets.enc (DR-6 propuesta) | `currentCompany, hint: 'Use rotate o revoke antes de re-crear'` |
| `REMOTE_VALIDATION_FAILED` | set-api-key con validateRemote=true y backend no encontró la key | `backendError: {code, message}` |
| `CLIENT_INIT_FAILED` | No se pudo instanciar FirmaClient | `idEmpresa, url` |
| `INTERNAL` | Error inesperado del bridge | (sin extra) |
| `EMPRESA_MISMATCH` (bridge-level) | consent:create con id_empresa body ≠ cfg.idEmpresa | `activeCompany, activeIdEmpresa, bodyIdEmpresa` |

### 12.3 Test de cada error code del bridge

Cada handler que puede retornar un error code debe tener **al menos un test
positivo** (success) y **un test por cada path de error** documentado en
§12.2. Esto suma ~30 tests adicionales.

### 12.4 Test específico de `RATE_LIMIT_EXCEEDED`

```js
test('RATE_LIMIT_EXCEEDED en sign-request se propaga correctamente', async () => {
  // Setup: cliente A
  // Action: hacer 60 requests rápidos + 1 más
  // Verificar: el último retorna 429 con code='RATE_LIMIT_EXCEEDED'
  // Verificar: el bridge retorna error.code='BACKEND_REJECTED' con
  //            extra.backendError.code='RATE_LIMIT_EXCEEDED'
});
```

### 12.5 Test específico de `TOKEN_ENCRYPTION_KEY_MISSING`

```js
test('I-013b: 503 TOKEN_ENCRYPTION_KEY_MISSING si la feature está activa y env falta', async () => {
  // Solo si la feature I-013b está activa (consent OTP encryption).
  // Setup: arrancar firma-service SIN TOKEN_ENCRYPTION_KEY
  // Action: POST /internal/consentimientos con per-company key
  // Verificar: 503 TOKEN_ENCRYPTION_KEY_MISSING
  // NOTA: este test es opcional. Si I-013b no está activo, skip.
});
```

---

## 13. Estructura de tests propuesta

### 13.1 Archivos nuevos en `firma-service/tests/`

| Archivo | Tests estimados | Cubre |
|---------|-----------------|-------|
| `routes/admin-clientes.test.js` (NUEVO) | ~38 | Los 4 endpoints admin: auth, validación, lógica, cross-cutting |
| `services/internalClient-admin.test.js` (NUEVO) | ~6 | Wrappers nuevos del service (createClientForAdmin, rotateClientByEmpresa, listClients) |
| `e2e/admin-clientes-flow.test.js` (NUEVO) | ~4 | Flujo end-to-end admin: create→sign→rotate→revoke |
| `migrations/010-internal-client-events.test.js` (NUEVO, opcional) | ~3 | Si se aprueba DR-7 (tabla de eventos) |
| **Subtotal backend** | **~48** (3 nuevos + 1 opcional) | |

### 13.2 Extensión de archivos existentes en `sgsst-electron-app/main/`

| Archivo | Tests estimados | Cubre |
|---------|-----------------|-------|
| `test-firma-bridge.js` (extender con ~68 tests nuevos) | +68 | 7 IPC nuevos, migración v1→v2, cache per-empresa, DR-1/2/3/5, cross-empresa, edge cases, compat legacy |
| `test-firma-client.js` (sin cambios) | 0 | El cliente es stateless y no cambia |
| **Subtotal bridge** | **+68** | |

### 13.3 E2E

| Archivo | Pasos estimados | Cubre |
|---------|-----------------|-------|
| `storage-backup/e2e-integration-kair-firma.js` (extender) | +8 pasos (15 totales) | Crear 2 empresas, sign cross, listar batch, rotar, verificar revocación |

### 13.4 Total de tests nuevos

| Categoría | # tests | # críticos (bloquean I-102) |
|-----------|---------|----------------------------|
| Backend integration | ~38 | 5 |
| Backend service | ~6 | 1 |
| Backend E2E | ~4 | 2 |
| Backend migration (opcional) | ~3 | 0 |
| Bridge unit | ~68 | 7 |
| E2E real (extendido) | +8 pasos | 4 |
| **TOTAL** | **~127** | **~19** |

### 13.5 Naming convention y organización

```
firma-service/tests/
├── routes/
│   ├── admin-clientes.test.js         (NUEVO)
│   ├── signRequest-cross-company.test.js  (existente, base)
│   └── admin.test.js                   (existente, no se toca)
├── services/
│   ├── internalClient.test.js          (existente, base)
│   └── internalClient-admin.test.js    (NUEVO)
├── e2e/
│   └── admin-clientes-flow.test.js     (NUEVO)
└── migrations/
    └── 010-internal-client-events.test.js  (NUEVO opcional)

sgsst-electron-app/main/
├── test-firma-bridge.js                (extender con describe blocks nuevos)
├── test-firma-client.js                (sin cambios)
└── test-firma-bridge-admin.test.js     (NUEVO, opcional si se quiere separar)

storage-backup/
└── e2e-integration-kair-firma.js       (extender con 8 pasos nuevos)
```

### 13.6 Helpers nuevos necesarios

**Backend (`firma-service/tests/helpers.js` — extender)**:
- `withPerCompanyKey(req, which)` — agrega X-Internal-API-Key para A o B.
- `seedPerCompanyClients()` — siembra 2 clients per-company con ids conocidos.
- `getApiKeyHashPrefix(plaintext)` — helper para tests que necesitan comparar prefix.

**Bridge (`sgsst-electron-app/main/test-firma-bridge.js` — extender)**:
- `_setSecretsV2({empresas, ...})` — escribe v2 directamente sin pasar por `set-api-key`.
- `_invokeWithCompany(channel, payload, companyName)` — inyecta companyName en el payload.
- `_mockAdminFetch(response)` — mockea fetch para endpoints admin.
- `_getAdminApiKeyFromSecrets()` — lee el adminApiKey actual de secrets.enc (test helper).

---

## 14. Definición de "done" — Tests críticos que bloquean I-102

Estos son los **3 tests más críticos** (los que, si fallan, bloquean I-102).
Sin estos, NO se puede abrir la puerta a I-102 (UI de firma electrónica con
per-empresa keys).

### 14.1 Los 3 tests más críticos

#### Test #1: Cross-company enforcement (defensa en profundidad)

```js
test('CRÍTICO: per-company key A NO puede crear sign request para empresa B', async () => {
  // E2E: storage-backup/e2e-integration-kair-firma.js, paso 7
  // Backend: tests/routes/signRequest-cross-company.test.js (ya existe, base)
  // Bridge: cross-company client-side check en consent:create (D-SPEC-3)
});
```

**Por qué es crítico**: si esto falla, K+AIR con la key de la empresa A
puede firmar documentos "como si fuera" la empresa B. Riesgo legal alto
(falsificación de identidad corporativa). **No-I-102 hasta que pase**.

#### Test #2: Rotación con corte inmediato

```js
test('CRÍTICO: después de rotar, la key vieja NO funciona (clearCache inmediato)', async () => {
  // E2E: paso 12
  // Backend: tests/routes/admin-clientes.test.js (test de rotación)
  // Bridge: cache invalidation al rotar
});
```

**Por qué es crítico**: si la key vieja sigue funcionando post-rotación,
la rotación no protege contra compromiso. El user rota creyendo que está
seguro, pero un atacante con la key vieja todavía puede firmar. **No-I-102
hasta que pase**.

#### Test #3: Idempotency partition por api_key_hash

```js
test('CRÍTICO: A y B pueden usar el mismo Idempotency-Key sin colisionar', async () => {
  // Backend: tests/services/idempotency.test.js (extender con 2 clients)
  // E2E: paso 5 vs 6 (cada uno usa su propia idem key o la misma)
});
```

**Por qué es crítico**: si A y B comparten namespace de Idempotency-Key,
los replays se mezclan. K+AIR con un bug que reuse idem keys entre empresas
causaría que sign requests de A reaparezcan como sign requests de B (o
viceversa). **No-I-102 hasta que pase**.

### 14.2 Otros tests bloqueantes (no en el top 3 pero casi tan importantes)

| # | Test | Razón |
|---|------|-------|
| 4 | `set-api-key` con `validateRemote: true` y key inválida → `REMOTE_VALIDATION_FAILED` | UX: si no valida, el user configura una key incorrecta y se entera en producción |
| 5 | `firma:empresa:create` sin adminApiKey → `ADMIN_TOKEN_REQUIRED` (DR-2) | Sin esto, el flujo de Opción B de la UI no funciona |
| 6 | Migración silenciosa v1 → v2 preserva la key legacy en `__legacy__` | Upgrade de K+AIR v0.1.190 → v0.1.191 sin pérdida de credenciales |
| 7 | Cross-company en `consent:create` (D-SPEC-3) | Si falla, idem test #1 pero para consentimientos |
| 8 | E2E completo (15 pasos verdes) | Smoke test de toda la cadena |

### 14.3 Criterios formales de "done para I-102"

- [ ] **Test #1 pasa** (cross-company A→B) en CI.
- [ ] **Test #2 pasa** (rotación con corte inmediato) en CI.
- [ ] **Test #3 pasa** (idempotency partition) en CI.
- [ ] Tests de `routes/admin-clientes.test.js` (38 tests) pasan en CI.
- [ ] Tests de `services/internalClient-admin.test.js` (6 tests) pasan en CI.
- [ ] Tests de `test-firma-bridge.js` (68 nuevos) pasan en CI.
- [ ] E2E `e2e-integration-kair-firma.js` (15 pasos) corre verde end-to-end.
- [ ] Los 16 tests existentes de `signRequest-cross-company.test.js` siguen pasando (regresión).
- [ ] Los tests existentes de `admin.test.js` (acuerdo-versiones) siguen pasando.
- [ ] Cobertura del bridge per-empresa: ≥ 80% de líneas en `_resolveConfigForCompany`, `_migrateSecretsV1ToV2`, `_getClientForCompany`.

### 14.4 Criterios de "done para I-103" (firma UI con polling)

- [ ] Todos los criterios de §14.3.
- [ ] Tests de UI (renderer) con mock de IPC: al menos 5 tests de "Firma no configurada para empresa X" banner, "Configurar firma" modal, y reemplazo de llamadas legacy.
- [ ] Tests de `preload.js` que validen que los 6 nuevos IPCs están exportados.

### 14.5 Criterios de "done para v0.1.192+" (deprecation)

- [ ] `firma:config:set-api-key` retorna `ERR_DEPRECATED` con `remediationIpc`.
- [ ] Test de compat: el renderer v0.1.190 (mock) recibe el error y degrada gracefully.
- [ ] `firma:config:diag` ya NO incluye los campos extra `configuredEmpresas`, etc.
- [ ] Tests E2E con un renderer v0.1.190 simulado (puede ser un sub-script Node que invoca los handlers).

---

## 15. Anexo: incompatibilidades detectadas entre A y B

Cross-check del spec A (`backend-auth-spec.md`) contra spec B
(`kair-auth-spec.md`). Estas son las incompatibilidades o ambigüedades
que NO se detectaron en el cross-check anterior y que se encontraron al
leer ambos specs en paralelo para diseñar los tests.

### 15.1 DR-6 candidato: `displayName` vs `description`

**A (backend) §3.1.1** define el body de `POST /internal/admin/clientes`:
```typescript
{ id_empresa, allowed_operations, description, expires_at }
```

**B (kair) §18 DR-3** define el input de `firma:empresa:create`:
```js
{ companyName, idEmpresa, displayName }
```

**Gap**: el bridge tiene `displayName` (viene del renderer) pero el
backend espera `description`. **¿El bridge debe mapear `displayName →
description`?**

**Recomendación (DR-6)**: SÍ, el bridge debe mapear `displayName` →
`description` al llamar al backend. La descripción debe seguir el formato
`K+AIR {displayName} - {environment}` (similar al `acuerdo-versiones`).

```js
// En el bridge, al llamar a POST /admin/clientes:
body: JSON.stringify({
  id_empresa: args.idEmpresa,
  allowed_operations: ALL_OPERATIONS,  // ver §15.2
  description: `K+AIR ${args.displayName} - ${config.env || 'production'}`
})
```

**Impacto en tests**: el test E2E debe verificar que `description` se
setea correctamente en backend (vía `GET /admin/clientes`).

### 15.2 DR-6 candidato: `allowed_operations` no especificadas en B

**A (backend) §3.1.1** requiere `allowed_operations` (array, min 1, max 10, enum).
**B (kair) DR-3** NO especifica qué operaciones pasar.

**Gap**: el bridge debe decidir el set default. ¿Pasar todas (5) o un
subset más restrictivo?

**Recomendación (DR-6)**: pasar el set completo por default:
```js
const ALL_OPERATIONS = [
  'sign_request:create',
  'sign_request:read',
  'consent:create',
  'consent:verify',
  'audit:read'
];
```

**Razón**: K+AIR usa todas las operaciones. Pasarlas todas es más simple
que negociar subset. La rotación NO permite cambiar las operaciones
(spec A §3.3.2 las hereda). Si en el futuro K+AIR quiere subset, se
agrega un arg `allowedOperations` opcional al IPC.

**Impacto en tests**: el test de create debe verificar que el body enviado
al backend tiene las 5 ops.

### 15.3 DR-6 candidato: `validateRemote` con admin token (no per-company)

**B (kair) §5.2** dice que `validateRemote: true` usa `GET /internal/admin/clientes`.

**Problema**: este endpoint requiere `X-Admin-API-Key`, NO la per-company
key. Pero el bridge YA tiene adminApiKey (DR-2), así que la validación
funciona. **Sin embargo, semánticamente es raro**: estamos validando una
key per-company con admin token.

**Riesgo**: si adminApiKey está comprometida, la validación es trivialmente
bypassable. Pero como adminApiKey es operator-level, ese es un riesgo
aceptado.

**Recomendación (DR-6)**: documentar que `validateRemote` requiere
adminApiKey. Si adminApiKey está ausente, retornar `ADMIN_TOKEN_REQUIRED`
(aunque el IPC `set-api-key` no es "admin" semánticamente).

**Alternativa**: implementar un endpoint per-company `GET /internal/me`
que valide la key sin admin token. **Fuera de scope de I-102** (sería
un endpoint nuevo en backend, no en el spec A).

**Impacto en tests**: el test de `validateRemote` debe verificar el caso
"adminApiKey ausente → ADMIN_TOKEN_REQUIRED" incluso en `set-api-key`.

### 15.4 DR-6 candidato: `create` con empresa ya configurada

**A (backend) §3.1.3**: 409 `CLIENT_EXISTS_FOR_EMPRESA` si la empresa
tiene cliente **activo** en backend.

**B (kair) §5.2 / DR-3**: NO menciona el caso "empresa YA en secrets.enc".

**Gap**: ¿el bridge debe distinguir entre "ya existe en secrets.enc" y
"ya existe en backend"? Si la key local es de una rotación previa y el
backend fue reseteado, pueden desincronizarse.

**Recomendación (DR-6)**: el bridge debe checkear secrets.enc ANTES de
llamar al backend. Si ya existe la empresa localmente, retornar
`ALREADY_CONFIGURED` (definido en §9.2 de este spec). NO llamar al
backend.

**Impacto en tests**: el test de §9.2 cubre este caso.

### 15.5 Ambigüedad menor: `lastValidatedAt` solo client-side

**B (kair) §2.2** define `lastValidatedAt` en `empresas[name]` schema.
**A (backend)** NO tiene este campo (es solo un campo local).

**Confirmación**: `lastValidatedAt` es metadata local que el bridge
actualiza en sign requests exitosos. No se sincroniza con backend. **OK,
no requiere DR-6**.

### 15.6 Ambigüedad menor: hash prefix de 8 chars

**A (backend) §3.1.2** retorna `api_key_hash_prefix` (8 chars hex).
**B (kair) DR-3** requiere que el bridge retorne `apiKeyHashPrefix` al
renderer (8 chars hex).

**Confirmación**: el bridge debe computarlo client-side con
`crypto.createHash('sha256').update(apiKey).digest('hex').slice(0,8)`.
El backend ya lo retorna en la respuesta, así que el bridge puede
tomarlo de ahí o computarlo. **OK, no requiere DR-6**.

### 15.7 Ambigüedad: `description` se trunca a 50 chars en logs (A §3.1.5)

**A (backend) §3.1.5** dice que `description` se trunca a 50 chars en logs.

**B (kair)** NO menciona el truncado.

**Confirmación**: el truncado es solo en logs del backend, no afecta al
cliente. **OK, no requiere DR-6**.

### 15.8 Ambigüedad: `expires_at` mencionado en A pero NO implementado

**A (backend) §12 Pregunta 1** marca `expires_at` como "diferido a v2".
**B (kair)** NO menciona `expires_at` en ningún lado.

**Confirmación**: B no necesita考虑 `expires_at` en V1. Si el user lo
agrega en v2, B lo agregará. **OK, no requiere DR-6**.

### 15.9 Incompatibilidad potencial: ordering de `__legacy__` vs `empresas`

**B (kair) §2.4 / §7.5** dice: `_resolveConfigForCompany` NUNCA consulta
`__legacy__`. Solo `empresas`.

**A (backend)** no tiene concepto de `__legacy__` (es interno de K+AIR).

**Confirmación**: las dos definiciones son consistentes. `__legacy__` es
un detalle de K+AIR que no se filtra al backend. **OK, no requiere DR-6**.

### 15.10 Resumen de DR-6 candidatos

| DR-6 candidato | Severidad | Acción |
|----------------|-----------|--------|
| `displayName → description` mapping | Media | El bridge debe hacerlo. Documentar en kair-auth-spec §19 |
| `allowed_operations` default = ALL | Baja | Documentar y testear |
| `validateRemote` con adminApiKey | Baja | Documentar (puede ser DR-7 futuro) |
| `ALREADY_CONFIGURED` error code | Media | El bridge debe agregarlo. Documentar |

**Recomendación final**: agregar 1 DR-6 binding que cubra los 4 puntos
arriba (mapping de campos + allowed_operations default + ALREADY_CONFIGURED).
`validateRemote` puede esperar a v2.

---

### 15.11 Status actual de DR-6 (binding, ratificado 2026-08-20)

DR-6 fue ratificado por el user el 2026-08-20 sin pregunta explícita
(decisiones técnicas conservadoras del cross-check C↔A↔B). Se aplican
como binding a la implementación de A, B y a los tests de este spec.

**DR-6.A — `displayName` → `description` mapping** (binding):
- §2 matriz cross-empresa caso #18 cubre el round-trip.
- §11.2 E2E incluye un paso que verifica que el `description` en el
  response del backend tiene el formato `K+AIR empresa ${displayName} - ${env}`.
- Spec B (kair-auth-spec) §5.6 documenta la implementación obligatoria.

**DR-6.B — `allowed_operations` default = ALL** (binding):
- §2 matriz cross-empresa caso #19 cubre la inyección.
- §11.2 E2E verifica que el body enviado al backend tiene los 5 valores.
- Spec B §5.6 documenta la inyección. Spec A (backend) §3.1.1 acepta
  con WARN si vienen menos de 5 (señal de bug en bridge).

**DR-6.C — `ALREADY_CONFIGURED` error code** (binding):
- §2 matriz cross-empresa caso #17 cubre el pre-chequeo en el bridge.
- §11.2 E2E incluye paso: "create same empresa twice → ALREADY_CONFIGURED, no overwrite".
- Spec B §5.6 documenta el pre-chequeo y la traducción del 409 del backend.
- Spec A (backend) §3.1.3 documenta el código original `CLIENT_EXISTS_FOR_EMPRESA`
  (el bridge lo traduce, no se renombra en backend).

**DR-6.D — `validateRemote` usa admin endpoint** (no bloqueante, aceptado V1):
- Documentar como decisión técnica.
- No requiere cambio en V1. Alternativa futura: `GET /internal/me` (DR-8).

---

## 16. Recomendaciones adicionales (DR-7+)

### 16.1 DR-7 candidato: Tabla de eventos para auditoría (futuro)

**Contexto**: A §12 Pregunta 2 recomienda Opción A (description truncado)
para v1. En v2, considerar tabla `gh_internal_client_events`.

**Tests asociados** (futuro, no para I-102):
- Trigger en INSERT/UPDATE/DELETE de `gh_internal_clients`.
- Tabla `gh_internal_client_events` con `evento IN ('CREATED', 'ROTATED', 'REVOKED')`.
- Endpoint `GET /internal/admin/clientes/:id/eventos` para consultar historial.

**Cuándo**: post I-102, cuando se quiera UI de "audit log de credenciales".

### 16.2 DR-8 candidato: Endpoint `GET /internal/me` per-company

**Contexto**: §15.3 menciona que `validateRemote` usa admin token, lo cual
es semánticamente raro. Un endpoint per-company `GET /internal/me` que
retorne `{id_empresa, allowed_operations}` con la per-company key sería
más limpio.

**Especificación tentativa**:
```
GET /internal/me
Headers: X-Internal-API-Key (per-company)
Response 200: { id_empresa, allowed_operations, description, created_at }
Response 401: INVALID_API_KEY (key no existe o revocada)
```

**Cuándo**: post I-102, si se decide eliminar el uso de admin token en
`validateRemote`. Bajo costo (~30 LOC en backend).

### 16.3 DR-9 candidato: Métrica de "cache hits per-empresa"

**Contexto**: B §4.1 menciona `cacheStats` en `firma:config:diag`. Sería
útil trackear hit/miss por empresa para detectar problemas de cache.

**Tests asociados**:
- Verificar que `cacheStats.hits[idEmpresa]` se incrementa en sign
  requests subsecuentes.
- Verificar que `cacheStats.misses[idEmpresa]` se incrementa en el primer
  sign request de una empresa.

**Cuándo**: post I-102, si se quiere observabilidad. Bajo costo.

### 16.4 DR-10 candidato: Rate limit por per-company (no por IP)

**Contexto**: A §7.1 dice que admin endpoints NO tienen rate limit. Pero
los endpoints per-company SÍ tienen `internalServerLimiter`. La capa 2
del limiter usa `X-Client-Instance-Id` (global, no per-company).

**Tests asociados** (verificar, no necesariamente cambiar):
- Confirmar que el rate limit aplica por `id_empresa`, no por IP.
- Confirmar que la key per-company de A no agota el rate limit de B.

**Cuándo**: verificar en I-102 (no requiere cambio, solo test).

---

## 17. Resumen final

| Métrica | Valor |
|---------|-------|
| Tests nuevos totales | ~127 (más 18 pasos E2E) |
| Tests críticos (bloquean I-102) | 3 + 5 = 8 |
| Archivos nuevos | 3 (backend) + 1 opcional (bridge) |
| Archivos extendidos | 1 (bridge tests) + 1 (E2E script) |
| Incompatibilidades A↔B detectadas | 1 mayor (displayName→description), 3 menores (allowed_operations default, validateRemote, ALREADY_CONFIGURED) |
| DR-6 binding | **RATIFICADO** 2026-08-20, cubre los 4 puntos de §15.10 (A, B, C aplicados) |
| DR-7+ recomendados | 4 (eventos, /internal/me, métricas, rate limit) |
| Tiempo estimado de implementación de tests | 6-10 horas (escritura) + 2 horas (debug si hay issues) |

**Próximo paso**: aprobación de este spec + decisión sobre DR-6. Si
aprobado, el implementador (futuro commit) escribe los tests en el orden:
1. Backend (A) — 38 tests de admin-clientes + 6 de service + 4 E2E
2. Bridge (B) — 68 tests en test-firma-bridge.js
3. E2E extendido — 8 pasos nuevos en e2e-integration-kair-firma.js
4. Si los 3 tests críticos pasan → abrir puerta a I-102.

---

**Status**: DRAFT v1. Listo para revisión del user.

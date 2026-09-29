# SPEC — Endpoints admin per-company clients (firma-service)

**Versión del documento:** 1.0 (borrador)
**Fecha:** 2026-08-20
**Estado:** Pendiente de revisión por el user (Subagente A)
**Alcance:** Contrato HTTP de los endpoints administrativos en `firma-service`
para gestionar credenciales per-empresa (D-13, I-010). Subagente B (K+AIR) y
Subagente C (QA) deben usar este spec para diseñar sus partes en paralelo.
**Documentos rectores:**
- [`storage-backup/audit-04-per-empresa-auth-design.md`](../audit-04-per-empresa-auth-design.md) — diseño de arquitectura (AUD-04)
- [`docs/kair-firma-integration/I-010-design.md`](../../docs/kair-firma-integration/I-010-design.md) — diseño del modelo per-company
- [`docs/gestion-humana/firma-electronica/API.md`](../../docs/gestion-humana/firma-electronica/API.md) — convenciones API existentes
- [`docs/gestion-humana/firma-electronica/SECURITY.md`](../../docs/gestion-humana/firma-electronica/SECURITY.md) §3, §8, §9

> **Aviso:** este spec describe el CONTRATO de los nuevos endpoints. La
> implementación en código está fuera de scope de este documento y se hará
> en un commit posterior, previa aprobación del user.

---

## 1. Resumen ejecutivo

K+AIR (app de escritorio) está migrando de la API key "legacy" global a
**API keys per-empresa** (AUD-04). El backend ya tiene la tabla
`gh_internal_clients` (migración 009) y el `internalClient` service que la
opera. **Faltan los endpoints HTTP admin** que permitan a un operador
humano (o a K+AIR vía bridge) crear, listar, rotar y revocar per-company
clients de forma consistente con el patrón ya existente en
`POST /internal/admin/acuerdo-versiones`.

Este spec define 4 endpoints nuevos bajo `/internal/admin/clientes`,
todos protegidos por `X-Admin-API-Key` (mismo mecanismo que el endpoint
de Acuerdo de uso). La API key per-empresa se **genera server-side con
`crypto.randomBytes(32).toString('base64url')`** y se retorna en
plaintext **únicamente en la respuesta de creación/rotación**; el backend
solo guarda el hash SHA-256.

---

## 2. Tabla de endpoints

| # | Método | Path | Auth | Descripción corta |
|---|--------|------|------|-------------------|
| 1 | `POST` | `/internal/admin/clientes` | `X-Admin-API-Key` | Crea un per-company client. Genera API key (32 bytes base64url), hashea con SHA-256, guarda en `gh_internal_clients`. Retorna el plaintext **solo esta vez**. |
| 2 | `GET`  | `/internal/admin/clientes` | `X-Admin-API-Key` | Lista per-company clients (activos y opcionalmente revocados). **NO retorna el hash completo** ni la API key — solo fingerprint (8 primeros chars del hash) + metadata. |
| 3 | `POST` | `/internal/admin/clientes/:id/rotate` | `X-Admin-API-Key` | Rota la API key de la empresa `:id`. Marca la anterior como revocada (`revoked_at`) y crea una nueva con el mismo `id_empresa` y mismas `allowed_operations`. Retorna el nuevo plaintext. **Sin grace period en v1**: la key vieja deja de funcionar inmediatamente. |
| 4 | `DELETE` | `/internal/admin/clientes/:id` | `X-Admin-API-Key` | **v2 (marcado como tal, pero se incluye en el spec).** Marca el per-company client activo de la empresa `:id` como revocado. Soft-delete (`revoked_at`). Invalida el cache de `internalClient`. |

**Convención del path param `:id`:** en TODOS los endpoints, `:id` se
interpreta como `id_empresa` (NIT u otro identificador empresarial, string
1-64 chars). Es el identificador humano-relevante, NO el hash. La
resolución hash ↔ id_empresa es interna.

**Base URL (mismo patrón que el resto de la API):**
- Desarrollo: `http://localhost:3001`
- Producción: `https://firma.k-air.com`

---

## 3. Detalle de cada endpoint

### 3.1. `POST /internal/admin/clientes` — Crear per-company client

#### 3.1.1. Request

**Headers:**
```
Content-Type: application/json; charset=utf-8
X-Admin-API-Key: <admin-key>
```

**Body (Zod schema):**
```typescript
{
  id_empresa: string,        // required, min 1, max 64
  allowed_operations: string[],  // required, min 1, max 10 items
  description: string?,      // optional, max 200
  expires_at?: string        // optional, ISO-8601 UTC (futuro)
}
```

**Validaciones (zod):**
- `id_empresa`: `z.string().min(1).max(64)` — el NIT o ID que K+AIR usa.
  No se valida formato (puede ser `900123456`, `900123456-7`, `EXT-900123`,
  etc.). Validación de formato es responsabilidad de K+AIR.
- `allowed_operations`: `z.array(z.string().min(1).max(64)).min(1).max(10)`.
  Cada item debe matchear el enum interno:
  ```js
  z.enum([
    'sign_request:create',
    'sign_request:read',
    'consent:create',
    'consent:verify',
    'audit:read',
  ])
  ```
  Si el array tiene strings que NO están en el enum → `400 INVALID_REQUEST_BODY`
  con `details.invalid_operations: ['op_fuera']`.
- `description`: `z.string().min(1).max(200).optional()` — para auditoría
  humana (ej. "K+AIR empresa TEMPOACTIVA - producción"). NO se loguea en
  hot path.
- `expires_at`: `z.string().datetime().optional()` — fecha de expiración
  opcional (futuro, no implementado en v1 — ver §12 pregunta abierta 1).

**Schema zod (referencia):**
```js
const ALLOWED_OPS = [
  'sign_request:create',
  'sign_request:read',
  'consent:create',
  'consent:verify',
  'audit:read',
];

const createClientBody = z.object({
  id_empresa: z.string().min(1).max(64),
  allowed_operations: z.array(z.enum(ALLOWED_OPS)).min(1).max(10),
  description: z.string().min(1).max(200).optional(),
  expires_at: z.string().datetime().optional(),  // futuro
}).strict();
```

**Notas de contrato con el bridge (DR-6.A y DR-6.B, binding):**

Estas notas documentan lo que el bridge de K+AIR SIEMPRE envía. El backend
NO debe aceptar otro formato — la construcción del body es responsabilidad
del bridge, no del renderer.

- **`description` (DR-6.A)**: el bridge SIEMPRE envía `description` ya
  formateado con el patrón `K+AIR empresa ${displayName} - ${config.env}`
  (truncado a 200 chars). El backend NO construye el `description` — solo
  lo persiste tal cual. Si en el futuro se quiere cambiar el formato, se
  cambia en el bridge, no acá.

- **`allowed_operations` (DR-6.B)**: el bridge SIEMPRE envía los 5 valores
  del enum `ALLOWED_OPS`. El backend NO acepta un subset (a pesar de que
  el schema zod lo permite con `min(1)`) — si recibe un array con menos
  de 5 elementos, el bridge tiene un bug y el backend debe loggear WARN.
  En la práctica, el subconjunto de 1-4 valores es válido a nivel de
  schema, pero el contrato del bridge fija que siempre son los 5.

- **Validación adicional en backend (recomendada, no bloqueante)**: agregar
  un check explícito `if (body.allowed_operations.length !== ALLOWED_OPS.length)`
  que retorne `400 INVALID_OPERATIONS` con `details.expected: 5, got: N`.
  Esto acopla el backend al contrato del bridge — alternativa es solo
  loggear WARN y aceptar. La recomendación es **aceptar con WARN** (más
  permisivo, menos acoplamiento).

#### 3.1.2. Response 201 Created

```json
{
  "id_empresa": "900123456",
  "api_key": "kair_live_aBc123XyZ-_qWerty0uIopaSdfG1hJk2lM3nB4vC5xY6zA7b8",
  "api_key_hash_prefix": "5d41402a",
  "allowed_operations": ["sign_request:create", "sign_request:read"],
  "description": "K+AIR empresa TEMPOACTIVA - producción",
  "created_at": "2026-08-20T15:30:00.123456Z",
  "message": "API key generada. Guárdala AHORA: no se mostrará de nuevo."
}
```

**Campos de la respuesta:**
- `id_empresa` (string): el NIT que vino en el body (eco).
- `api_key` (string, **PLAINEXT**): la key generada. Se retorna SOLO en
  esta respuesta. El backend no la puede recuperar después — solo tiene
  el hash. El cliente (K+AIR o el operador humano) DEBE guardarla en
  este momento.
- `api_key_hash_prefix` (string, 8 chars hex): fingerprint del hash SHA-256
  para que el operador pueda verificar el guardado sin ver la key.
- `allowed_operations` (array): eco del body.
- `description` (string|null): eco del body.
- `created_at` (string, ISO-8601 UTC con microsegundos).
- `message` (string): recordatorio en lenguaje humano.

**Formato de la API key generada:**
- Prefijo: `kair_live_` (producción) o `kair_test_` (desarrollo/test).
  El prefijo se elige en base a `config.env`: si `production` → `kair_live_`,
  sino → `kair_test_`. Esto previene el uso accidental de keys de test
  en producción (estilo Stripe `sk_live_` / `sk_test_`).
- Cuerpo: 32 bytes random codificados en base64url (43 chars, sin padding).
- Total: 11 (prefijo) + 43 (cuerpo) = **54 chars**.
- Entropía: 256 bits (2^256 valores posibles).
- Ejemplo: `kair_live_aBc123XyZ-_qWerty0uIopaSdfG1hJk2lM3nB4vC5xY6zA7b8`

**Generación server-side (referencia de implementación):**
```js
const crypto = require('crypto');
const env = config.env === 'production' ? 'live' : 'test';
const random = crypto.randomBytes(32).toString('base64url');
const apiKey = `kair_${env}_${random}`;
```

#### 3.1.3. Errores

| Status | Code | Cuándo | Details |
|--------|------|--------|---------|
| 400 | `INVALID_REQUEST_BODY` | Body malformado o falla zod (tipo, longitud, enum). | `details.issues: [{path, message, code}]` |
| 400 | `INVALID_OPERATIONS` | `allowed_operations` tiene items fuera del enum. | `details.invalid_operations: ['op_fuera']` |
| 401 | `INVALID_API_KEY` | Sin `X-Admin-API-Key` o incorrecto. | (sin details, no filtra) |
| 409 | `CLIENT_EXISTS_FOR_EMPRESA` | Ya existe un cliente **activo** (no revocado) para ese `id_empresa`. | `details: {id_empresa, existing_hash_prefix, created_at}` |
| 500 | `INTERNAL_ERROR` | Error inesperado. | `request_id` |

**Semántica del 409 (importante):**
- Si la empresa ya tiene un cliente **activo** → 409. El operador debe
  usar el endpoint de rotación o el de revocación antes de crear uno nuevo.
- Si la empresa tiene clientes **previos revocados** (historial de
  rotaciones) → 201 OK, se crea el nuevo. El historial de revocaciones
  se preserva (soft-delete).

**Mapeo de errores backend → bridge (DR-6.C):**

El backend retorna `409 CLIENT_EXISTS_FOR_EMPRESA` cuando la empresa ya
tiene un cliente activo en `gh_internal_clients`. El bridge de K+AIR
**NO** propaga este código directamente al renderer — lo traduce a:

| Backend | Bridge (renderer) | Cuándo |
|---------|-------------------|--------|
| `409 CLIENT_EXISTS_FOR_EMPRESA` | `ALREADY_CONFIGURED` con `extra.suggestion: 'Use firma:empresa:rotate-api-key to rotate the existing key'` | El bridge ya tiene la empresa en `secrets.enc.empresas` Y el backend confirma con 409 |

**Importante**: el bridge hace la verificación ANTES de llamar al backend
(chequea `secrets.enc.empresas[companyName].firmaApiKey`). Si ya existe
localmente, retorna `ALREADY_CONFIGURED` sin hacer la llamada HTTP
(ahorra round-trip + evita race condition entre la decisión del bridge
y la respuesta del backend).

Si el bridge NO tiene la empresa en `secrets.enc` pero el backend SÍ tiene
un cliente activo (caso: usuario rotó desde otro K+AIR o el secrets.enc se
borró por corrupción), entonces el backend responde 409 → el bridge
traduce a `ALREADY_CONFIGURED` con `extra.backendResponse` para que el
user sepa que debe reconciliar.

#### 3.1.4. Ejemplo curl

```bash
curl -X POST http://localhost:3001/internal/admin/clientes \
  -H 'Content-Type: application/json' \
  -H 'X-Admin-API-Key: test-admin-api-key-32-bytes-min!!!!!' \
  -d '{
    "id_empresa": "900123456",
    "allowed_operations": ["sign_request:create", "sign_request:read"],
    "description": "K+AIR empresa TEMPOACTIVA - producción"
  }'
```

**Response:**
```json
{
  "id_empresa": "900123456",
  "api_key": "kair_live_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "api_key_hash_prefix": "5d41402a",
  "allowed_operations": ["sign_request:create", "sign_request:read"],
  "description": "K+AIR empresa TEMPOACTIVA - producción",
  "created_at": "2026-08-20T15:30:00.123456Z",
  "message": "API key generada. Guárdala AHORA: no se mostrará de nuevo."
}
```

#### 3.1.5. Efectos secundarios

**En BD:**
- INSERT en `gh_internal_clients` con:
  - `api_key_hash` = `sha256(apiKey)` (64 chars hex)
  - `id_empresa` = el del body
  - `allowed_operations` = CSV serializado del array
  - `description` = el del body (o NULL si no se envió)
  - `created_at` = `datetime('now')`
  - `revoked_at` = NULL

**Logging (server-side):**
- Nivel: `info`
- Mensaje: `Per-company client creado`
- Meta:
  ```json
  {
    "request_id": "req_...",
    "id_empresa": "900123456",
    "api_key_hash_prefix": "5d41402a",
    "allowed_operations": "sign_request:create,sign_request:read",
    "description": "K+AIR empresa TEMPOACTIVA - producción",  // truncado a 50 chars
    "ip": "127.0.0.1",
    "actor": "admin"  // TODO: extraer de metadata o header
  }
  ```
- **NO se loguea** el plaintext de la API key (regla de oro).
- El logger ya redacta automáticamente campos como `id_empresa` (PII bajo
  Ley 1581), pero la redacción es por VALOR. El `id_empresa` NIT sí
  aparece en logs porque es necesario para troubleshooting.

**Cache:**
- El endpoint NO interactúa con el cache de `internalClient` (la key
  es nueva y no se va a usar hasta que el cliente la reciba). Sin efecto
  en el cache.

---

### 3.2. `GET /internal/admin/clientes` — Listar per-company clients

#### 3.2.1. Request

**Headers:**
```
X-Admin-API-Key: <admin-key>
```

**Query params (opcionales):**
| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `id_empresa` | string (1-64) | — | Filtrar por empresa exacta. |
| `include_revoked` | boolean | `false` | Si `true`, incluye revocados. Default: solo activos. |
| `limit` | int (1-200) | 100 | Máximo de items en la respuesta. |
| `offset` | int (≥0) | 0 | Offset para paginación. |

**Schema zod:**
```js
const listClientsQuery = z.object({
  id_empresa: z.string().min(1).max(64).optional(),
  include_revoked: z.union([
    z.literal('true'),
    z.literal('false'),
  ]).optional().transform(v => v === 'true'),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
}).strict();
```

#### 3.2.2. Response 200 OK

```json
{
  "total": 3,
  "limit": 100,
  "offset": 0,
  "items": [
    {
      "id_empresa": "900123456",
      "api_key_hash_prefix": "5d41402a",
      "allowed_operations": ["sign_request:create", "sign_request:read"],
      "description": "K+AIR empresa TEMPOACTIVA - producción",
      "created_at": "2026-08-20T15:30:00.123456Z",
      "revoked_at": null,
      "is_active": true
    },
    {
      "id_empresa": "900999999",
      "api_key_hash_prefix": "7b8c9d0e",
      "allowed_operations": ["sign_request:create", "sign_request:read", "consent:create", "consent:verify", "audit:read"],
      "description": "K+AIR empresa OTRA - producción",
      "created_at": "2026-08-15T10:00:00.000000Z",
      "revoked_at": null,
      "is_active": true
    },
    {
      "id_empresa": "900123456",
      "api_key_hash_prefix": "1a2b3c4d",
      "allowed_operations": ["sign_request:create"],
      "description": "Rotación 2026-08-10",
      "created_at": "2026-08-10T12:00:00.000000Z",
      "revoked_at": "2026-08-20T15:30:00.123456Z",
      "is_active": false
    }
  ]
}
```

**Campos:**
- `total` (int): cantidad total que matchea el filtro (sin paginar).
- `items` (array): los clientes en la página actual, ordenados por
  `created_at DESC` (más reciente primero).
- Por cada item:
  - `id_empresa` (string)
  - `api_key_hash_prefix` (string, 8 chars hex) — **NO se retorna el hash completo** (principio de mínima exposición).
  - `allowed_operations` (array, parseado del CSV).
  - `description` (string|null)
  - `created_at` (string, ISO-8601 UTC)
  - `revoked_at` (string ISO-8601 | null)
  - `is_active` (bool): `revoked_at === null`.

**NUNCA se retorna:**
- El `api_key_hash` completo (64 chars).
- La API key en plaintext (no está guardada en BD, solo el hash).
- Cualquier campo interno no documentado.

#### 3.2.3. Errores

| Status | Code | Cuándo | Details |
|--------|------|--------|---------|
| 400 | `INVALID_REQUEST_BODY` | Query params malformados. | `details.issues: [...]` |
| 401 | `INVALID_API_KEY` | Sin `X-Admin-API-Key` o incorrecto. | — |
| 500 | `INTERNAL_ERROR` | Error inesperado. | `request_id` |

#### 3.2.4. Ejemplo curl

```bash
# Listar todos los clientes activos
curl http://localhost:3001/internal/admin/clientes \
  -H 'X-Admin-API-Key: test-admin-api-key-32-bytes-min!!!!!'

# Listar todos los clientes (incluyendo revocados) de una empresa
curl 'http://localhost:3001/internal/admin/clientes?id_empresa=900123456&include_revoked=true' \
  -H 'X-Admin-API-Key: test-admin-api-key-32-bytes-min!!!!!'

# Paginar
curl 'http://localhost:3001/internal/admin/clientes?limit=10&offset=20' \
  -H 'X-Admin-API-Key: test-admin-api-key-32-bytes-min!!!!!'
```

#### 3.2.5. Efectos secundarios

- **Solo lectura.** No escribe nada en BD.
- **Log de auditoría:** nivel `info`, mensaje `Listado de per-company clients consultado`,
  meta `{filters: {id_empresa, include_revoked, limit, offset}, count: 3, ip, request_id}`.
- Sin impacto en cache.

---

### 3.3. `POST /internal/admin/clientes/:id/rotate` — Rotar API key

#### 3.3.1. Request

**Path param `:id`:** `id_empresa` (1-64 chars, ver validación abajo).

**Headers:**
```
Content-Type: application/json; charset=utf-8
X-Admin-API-Key: <admin-key>
```

**Body (opcional):**
```typescript
{
  motivo?: string,        // opcional, max 500, default "Rotación programada"
  actor?: string          // opcional, max 100, default "admin"
}
```

**Validaciones (zod):**
```js
const rotateBody = z.object({
  motivo: z.string().min(1).max(500).optional().default('Rotación programada'),
  actor: z.string().min(1).max(100).optional().default('admin'),
}).strict();
```

El body es opcional. Si no se envía, se usan los defaults.

**Validación del path param `:id`:**
- Si `id_empresa` tiene formato inválido (longitud fuera de 1-64) →
  `400 INVALID_REQUEST_BODY` con `details.path: 'id'`.
- Si la empresa no tiene un cliente activo → `404 NOT_FOUND`.
- Si la empresa tiene múltiples clientes activos (debería ser imposible
  por convención, pero defensa) → `409 MULTIPLE_ACTIVE_CLIENTS` con la
  lista de hashes prefijos.

#### 3.3.2. Response 200 OK

```json
{
  "id_empresa": "900123456",
  "old_api_key_hash_prefix": "5d41402a",
  "new_api_key": "kair_live_NewR4nd0mB4s3643Url____________",
  "new_api_key_hash_prefix": "9f8e7d6c",
  "allowed_operations": ["sign_request:create", "sign_request:read"],
  "description": "K+AIR empresa TEMPOACTIVA - producción",
  "rotated_at": "2026-08-20T16:00:00.123456Z",
  "motivo": "Rotación programada",
  "actor": "admin",
  "message": "API key rotada. La key anterior fue revocada. Guarda la nueva: no se mostrará de nuevo."
}
```

**Campos:**
- `id_empresa` (string): eco del path param.
- `old_api_key_hash_prefix` (string, 8 chars hex): fingerprint de la
  key revocada (para que el operador verifique cuál se rotó).
- `new_api_key` (string, **PLAINEXT**): la nueva key. Se retorna SOLO acá.
- `new_api_key_hash_prefix` (string, 8 chars hex): fingerprint de la
  nueva key.
- `allowed_operations` (array): heredadas de la key anterior (mismas
  operaciones, no se pueden cambiar en rotación — para eso es DELETE +
  POST).
- `description` (string|null): heredada de la key anterior.
- `rotated_at` (string, ISO-8601 UTC): momento de la rotación.
- `motivo` (string): del body o el default.
- `actor` (string): del body o el default.
- `message` (string): recordatorio en lenguaje humano.

#### 3.3.3. Errores

| Status | Code | Cuándo | Details |
|--------|------|--------|---------|
| 400 | `INVALID_REQUEST_BODY` | `:id` malformado o body inválido. | `details.issues: [...]` |
| 401 | `INVALID_API_KEY` | Sin `X-Admin-API-Key` o incorrecto. | — |
| 404 | `CLIENT_NOT_FOUND` | La empresa no tiene un cliente activo. | `details: {id_empresa, hint: 'Use POST /internal/admin/clientes para crear uno nuevo'}` |
| 409 | `MULTIPLE_ACTIVE_CLIENTS` | Hay más de un cliente activo para la empresa (debería ser imposible). | `details: {id_empresa, active_hashes: ['5d41402a', '7b8c9d0e']}` |
| 500 | `INTERNAL_ERROR` | Error inesperado. | `request_id` |

#### 3.3.4. Ejemplo curl

```bash
curl -X POST http://localhost:3001/internal/admin/clientes/900123456/rotate \
  -H 'Content-Type: application/json' \
  -H 'X-Admin-API-Key: test-admin-api-key-32-bytes-min!!!!!' \
  -d '{
    "motivo": "Rotación trimestral programada",
    "actor": "ops@tempoactiva.com"
  }'
```

**Response:**
```json
{
  "id_empresa": "900123456",
  "old_api_key_hash_prefix": "5d41402a",
  "new_api_key": "kair_live_NewR4nd0mB4s3643Url____________",
  "new_api_key_hash_prefix": "9f8e7d6c",
  "allowed_operations": ["sign_request:create", "sign_request:read"],
  "description": "K+AIR empresa TEMPOACTIVA - producción",
  "rotated_at": "2026-08-20T16:00:00.123456Z",
  "motivo": "Rotación trimestral programada",
  "actor": "ops@tempoactiva.com",
  "message": "API key rotada. La key anterior fue revocada. Guarda la nueva: no se mostrará de nuevo."
}
```

#### 3.3.5. Efectos secundarios (CRÍTICO)

**Transacción atómica (en una `db.transaction()`):**
1. SELECT del cliente activo de la empresa (FOR UPDATE implícito en
   better-sqlite3 — single writer).
2. UPDATE del cliente activo: `revoked_at = datetime('now')`,
   `description = description || ' [ROTATED at ' || now || ']'` (opcional,
   ver §12 pregunta 2).
3. INSERT del nuevo cliente con la nueva key, mismo `id_empresa`,
   mismas `allowed_operations`, `description` heredada.
4. Si algo falla → ROLLBACK. La key vieja sigue activa, no se crea nada.

**En BD después de la transacción:**
- El cliente viejo: `revoked_at` setado, sin otro cambio.
- El cliente nuevo: fila nueva con `api_key_hash` distinto, `revoked_at = NULL`.

**Cache:**
- Después de la transacción, llamar `internalClient.clearCache()` (igual
  que `revokeClient`). El cache es por `apiKey` plaintext, y como ya no
  tenemos el plaintext de la key vieja (solo el hash), lo más simple
  es limpiar el cache entero. El cache se re-pobla en los próximos
  lookups.

  **Nota de v1:** aceptamos la ventana de 30s del cache. Si K+AIR está
  usando la key vieja cuando se rota, los próximos 30s podría seguir
  funcionando. **Esto es por diseño en v1 (sin grace period activo)**
  pero hay un race: K+AIR recibe la nueva key, actualiza secrets.enc,
  pero el cache de `getActiveClientByApiKey` en firma-service tiene
  la key vieja cacheada como activa hasta 30s. En la práctica no
  causa problemas porque K+AIR ya tiene la nueva key guardada y
  empieza a usarla, pero el cache de firma-service la invalidará
  en 30s o antes por el `clearCache()` post-transaction.

**Logging:**
- Nivel: `info`
- Mensaje: `Per-company client rotado`
- Meta:
  ```json
  {
    "request_id": "req_...",
    "id_empresa": "900123456",
    "old_api_key_hash_prefix": "5d41402a",
    "new_api_key_hash_prefix": "9f8e7d6c",
    "motivo": "Rotación trimestral programada",
    "actor": "ops@tempoactiva.com",
    "ip": "127.0.0.1"
  }
  ```
- **NO se loguea** ninguna API key (vieja ni nueva) en plaintext.

---

### 3.4. `DELETE /internal/admin/clientes/:id` — Revocar per-company client (v2)

> **Status: v2, no implementado en commit 1.** Se incluye el spec para
> que QA (Subagente C) pueda diseñar tests de compat con la convención
> y B (K+AIR) pueda diseñar el flujo de "firma-empresa:revoke-api-key".
> Ver §12 pregunta abierta 3.

#### 3.4.1. Request

**Path param `:id`:** `id_empresa`.

**Headers:**
```
X-Admin-API-Key: <admin-key>
```

**Body (opcional):**
```typescript
{
  motivo?: string,        // opcional, max 500
  actor?: string          // opcional, max 100
}
```

**Validaciones:** mismas que rotate (zod `strict`).

#### 3.4.2. Response 200 OK

```json
{
  "id_empresa": "900123456",
  "api_key_hash_prefix": "5d41402a",
  "revoked_at": "2026-08-20T16:30:00.123456Z",
  "was_active": true,
  "already_revoked": false,
  "motivo": "Empresa cambió de razón social",
  "actor": "ops@tempoactiva.com"
}
```

**Campos:**
- `id_empresa` (string): eco del path param.
- `api_key_hash_prefix` (string, 8 chars hex): fingerprint del cliente
  revocado.
- `revoked_at` (string, ISO-8601 UTC): momento de la revocación.
- `was_active` (bool): si estaba activo antes (true) o ya estaba revocado (false).
- `already_revoked` (bool): si era idempotente (true) o se revocó ahora (false).
- `motivo` (string): del body o default.
- `actor` (string): del body o default.

#### 3.4.3. Errores

| Status | Code | Cuándo | Details |
|--------|------|--------|---------|
| 400 | `INVALID_REQUEST_BODY` | `:id` o body inválido. | `details.issues: [...]` |
| 401 | `INVALID_API_KEY` | Sin `X-Admin-API-Key` o incorrecto. | — |
| 404 | `CLIENT_NOT_FOUND` | La empresa no tiene ningún cliente (ni activo ni revocado). | `details: {id_empresa}` |
| 500 | `INTERNAL_ERROR` | Error inesperado. | `request_id` |

#### 3.4.4. Ejemplo curl

```bash
curl -X DELETE http://localhost:3001/internal/admin/clientes/900123456 \
  -H 'Content-Type: application/json' \
  -H 'X-Admin-API-Key: test-admin-api-key-32-bytes-min!!!!!' \
  -d '{
    "motivo": "Empresa cambió de razón social",
    "actor": "ops@tempoactiva.com"
  }'
```

**Response (caso normal, se revoca):**
```json
{
  "id_empresa": "900123456",
  "api_key_hash_prefix": "5d41402a",
  "revoked_at": "2026-08-20T16:30:00.123456Z",
  "was_active": true,
  "already_revoked": false,
  "motivo": "Empresa cambió de razón social",
  "actor": "ops@tempoactiva.com"
}
```

**Response (idempotente, ya estaba revocado):**
```json
{
  "id_empresa": "900123456",
  "api_key_hash_prefix": "5d41402a",
  "revoked_at": "2026-08-20T15:00:00.000000Z",  // timestamp ORIGINAL
  "was_active": false,
  "already_revoked": true,
  "motivo": "Empresa cambió de razón social",
  "actor": "ops@tempoactiva.com"
}
```

#### 3.4.5. Efectos secundarios

**En BD:**
- UPDATE del cliente activo: `revoked_at = datetime('now')` (o conserva
  el valor original si idempotente).
- Si el cliente ya estaba revocado, no se hace nada (idempotente).

**Cache:**
- `internalClient.clearCache()` después de la operación.

**Logging:**
- Nivel: `info`
- Mensaje: `Per-company client revocado` o `Revocación idempotente (ya estaba)`
- Meta: `{id_empresa, api_key_hash_prefix, was_active, already_revoked, motivo, actor, ip}`.

---

## 4. Schema de la tabla `gh_internal_clients`

### 4.1. Estado actual (migración 009)

La tabla ya existe y tiene las columnas necesarias para los 4 endpoints
de este spec. **No se requieren cambios de schema en v1.**

```sql
-- src/db/schema/009_internal_clients.sql (referencia)
CREATE TABLE IF NOT EXISTS gh_internal_clients (
  api_key_hash TEXT PRIMARY KEY,        -- SHA-256 hex (64 chars). PK = el hash mismo.
  id_empresa TEXT NOT NULL,             -- Empresa a la que está atado el cliente.
  allowed_operations TEXT NOT NULL,     -- CSV de ops permitidas.
  description TEXT,                     -- Auditoría: descripción libre.
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT                       -- NULL = activa. ISO8601 = revocada.
);

CREATE INDEX IF NOT EXISTS idx_internal_clients_empresa_active
  ON gh_internal_clients(id_empresa) WHERE revoked_at IS NULL;
```

### 4.2. Por qué NO se requieren columnas nuevas en v1

| Necesidad del spec | Cómo se resuelve con la tabla actual |
|---|---|
| Identificar el cliente activo de una empresa | `SELECT ... WHERE id_empresa = ? AND revoked_at IS NULL` (usa el índice parcial `idx_internal_clients_empresa_active`). |
| Historial de rotaciones (key vieja + key nueva) | Soft-delete: la key vieja queda con `revoked_at` setado. La nueva tiene `revoked_at = NULL`. Se preserva el historial. |
| Filtrar por `include_revoked` en GET | `WHERE revoked_at IS NULL` (default) o `WHERE 1=1` (si `include_revoked=true`). |
| Auditoría: fingerprint de la key | `api_key_hash` (64 chars). El "prefix" son los 8 primeros chars. |
| Motivo/actor de rotación/revocación | Se puede meter en `description` (truncando a 200 chars), o se ignora en v1. Ver §12 pregunta 2. |

### 4.3. Propuesta opcional (NO para v1, ver §12 pregunta 2)

Si en v2 se quiere normalizar la auditoría de rotación/revocación, se
podría agregar una tabla de eventos:

```sql
-- Propuesta NO para v1 — solo referencia
CREATE TABLE IF NOT EXISTS gh_internal_client_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key_hash TEXT NOT NULL,            -- FK lógica (no enforced) al cliente
  id_empresa TEXT NOT NULL,
  evento TEXT NOT NULL CHECK (evento IN ('CREATED', 'ROTATED', 'REVOKED')),
  actor TEXT,                           -- "admin" o email del operador
  motivo TEXT,                          -- motivo libre
  metadata TEXT,                        -- JSON con contexto extra
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (api_key_hash) REFERENCES gh_internal_clients(api_key_hash)
);
CREATE INDEX idx_internal_client_events_empresa ON gh_internal_client_events(id_empresa, created_at DESC);
CREATE INDEX idx_internal_client_events_hash ON gh_internal_client_events(api_key_hash, created_at DESC);
```

**Decisión:** NO se agrega esta tabla en v1. La auditoría se hace vía
`logger.info()` + tabla `gh_internal_clients` con `description` truncado.
En v2 se puede agregar si el user quiere UI de "audit log de credenciales".

### 4.4. Índices

Los índices actuales son suficientes:
- `idx_internal_clients_empresa_active` (parcial, `WHERE revoked_at IS NULL`):
  cubre la query de "cliente activo de empresa X", que es la hot path de
  rotación y revocación.
- PK en `api_key_hash`: cubre el lookup directo por hash (que es lo que
  hace el cache de `getActiveClientByApiKey`).

**No se requieren índices adicionales.**

### 4.5. Constraints (FK, UNIQUE, CHECK)

- **PK:** `api_key_hash` (UNIQUE implícito, NOT NULL).
- **NOT NULL:** `id_empresa`, `allowed_operations`, `created_at`.
- **Nullable:** `description`, `revoked_at`.

**Decisión:** no agregar CHECK constraint para validar el formato de
`id_empresa` (puede ser NIT, NIT+DV, EXT-XXX, etc., depende del
convention del cliente). El formato se valida en zod del endpoint
admin (min 1, max 64 chars).

---

## 5. Migración SQL

**No se requiere migración nueva en v1.** La tabla `gh_internal_clients`
ya existe (migración 009, commiteada previamente). El spec usa esa tabla
tal cual.

Si en v2 se aprueba la tabla `gh_internal_client_events` (§4.3), la
migración sería:

```sql
-- src/db/schema/010_internal_client_events.sql (PROPUESTA NO para v1)
CREATE TABLE IF NOT EXISTS gh_internal_client_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key_hash TEXT NOT NULL,
  id_empresa TEXT NOT NULL,
  evento TEXT NOT NULL CHECK (evento IN ('CREATED', 'ROTATED', 'REVOKED')),
  actor TEXT,
  motivo TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (api_key_hash) REFERENCES gh_internal_clients(api_key_hash)
);
CREATE INDEX IF NOT EXISTS idx_internal_client_events_empresa
  ON gh_internal_client_events(id_empresa, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_client_events_hash
  ON gh_internal_client_events(api_key_hash, created_at DESC);
```

Tests de la migración (a agregar a `tests/migration-010.test.js`):
- Existe el archivo `010_internal_client_events.sql`.
- FK referenciando `gh_internal_clients.api_key_hash` está documentada.
- El CHECK de `evento` solo acepta los 3 valores.
- Aplica sin romper las 9 migraciones previas.
- Idempotente (`IF NOT EXISTS`).

---

## 6. Validación cross-company

### 6.1. ¿Qué enforce backend hoy?

El `internalClient` service + `authz` middleware ya enforcen que un
cliente A (con API key de la empresa A) NO puede ver/modificar sign
requests de la empresa B:

- **POST /internal/sign-requests** con `id_empresa = B` y key de A →
  `403 EMPRESA_MISMATCH` (ver `tests/routes/signRequest-cross-company.test.js:94-120`).
- **GET /internal/sign-requests/:id** de B con key de A → `404 NOT_FOUND`
  silent (ver `tests/routes/signRequest-cross-company.test.js:140-153`).
- **GET /internal/sign-requests (lista)** con key de A → solo ve los
  de A. El query `?id_empresa=B` se IGNORA (ver
  `tests/routes/signRequest-cross-company.test.js:179-194`).
- Idem para consentimientos y eventos.

### 6.2. ¿Los endpoints admin necesitan cross-company check?

**No.** Los endpoints admin (`/internal/admin/clientes/*`) operan a
nivel de credenciales, no de sign requests. Por diseño:
- El admin ve TODAS las empresas (es un operador humano con `X-Admin-API-Key`).
- El admin rota/revoca cualquier empresa (es admin).
- **Si un atacante tiene `X-Admin-API-Key`, ya rompió el modelo de
  seguridad.** Esa key es sagrada (separada de las per-company, en env
  var separada, no se distribuye a K+AIR).

### 6.3. Defensa en profundidad: el path param `:id`

El path param `:id` se valida con zod (`min(1).max(64)`) pero NO se
enforcea que matchee un formato específico de NIT. Esto es intencional:
- K+AIR puede tener empresas con NIT+Dígito Verificador, EXT-XXX, etc.
- La validación de formato es responsabilidad del cliente que llama.

Si en el futuro se quiere restringir, se puede agregar:
```js
const idEmpresaParam = z.string().regex(
  /^\d{6,15}(-\d)?$|^EXT-[A-Z0-9-]+$/,
  'id_empresa debe ser NIT o EXT-XXX'
);
```

Pero en v1 es **string libre 1-64 chars** (flexibilidad K+AIR).

### 6.4. ¿Qué pasa si un K+AIR "normal" (con su key per-empresa) intenta
acceder a un endpoint admin?

- Recibe `401 INVALID_API_KEY` porque el middleware `adminApiAuth()`
  valida contra `config.auth.adminApiKey`, NO contra la key per-empresa.
- El middleware de auth es exclusivo: `X-Admin-API-Key` y
  `X-Internal-API-Key` son credenciales independientes. K+AIR tiene
  la segunda; admin tiene la primera. **No se cruzan.**

(Verificado en `tests/middleware/adminAuth.test.js:61-69`.)

### 6.5. ¿Qué código de error si una empresa intenta usar la key de OTRA?

Ese caso ya está manejado por I-010 en los endpoints de negocio
(`/internal/sign-requests/*`, `/internal/consentimientos/*`). Los
endpoints admin no cambian ese comportamiento. Los códigos son:
- `403 EMPRESA_MISMATCH` (en POST con body).
- `404 NOT_FOUND` (en GET por id, silent para no filtrar existencia).

---

## 7. Rate limiting

### 7.1. Decisión: NO se aplica rate limit a los endpoints admin en v1

**Justificación:**
- Los endpoints admin son operados por un humano (curl desde terminal,
  K+AIR admin UI una vez por empresa).
- La frecuencia esperada es muy baja: 1-10 requests/día.
- Aplicar rate limit (e.g., 30/min) no aporta protección significativa
  contra un atacante que ya tiene la `X-Admin-API-Key`.
- Si el atacante tiene la admin key, el rate limit no lo va a detener
  — ya rompió el modelo de seguridad.

**Excepción:** el `globalLimiter` (60/min por IP) NO se aplica a estos
endpoints porque están bajo `/internal/*` y el globalLimiter ya excluye
ese prefijo (ver `src/middleware/rateLimit.js:152-159`).

### 7.2. Defensa en profundidad (futuro, v2)

Si en el futuro se quiere protección adicional contra bug del operador
humano (ej. un script en loop que crea 1000 clientes), se puede agregar
un limiter específico:

```js
// Propuesta para v2, NO implementar en commit 1
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 min
  limit: 30,                  // 30 req/min por IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKey,
  handler: makeHandler('admin'),
  skip: (req) => config.env === 'test',  // skip en tests
});
```

Pero **NO se incluye en este spec**. Se deja como follow-up.

### 7.3. ¿Qué pasa si K+AIR hace un loop de creación de clientes?

- K+AIR no tiene `X-Admin-API-Key` (por diseño). El bridge que llama
  al endpoint admin (vía `firma:empresa:set-api-key`) debe usar la
  admin key.
- Si K+AIR está en un loop y la admin key está bien guardada (en
  `secrets.enc` con `safeStorage` encryption), el escenario "loop
  accidental" no debería pasar.
- Si pasa (bug), el operador lo ve en logs y puede rotar la admin key.

---

## 8. Audit logging

### 8.1. Qué se loguea

Cada endpoint emite logs estructurados JSON (vía `utils/logger.js`):

| Endpoint | Nivel | Mensaje | Meta |
|----------|-------|---------|------|
| POST /internal/admin/clientes | `info` | `Per-company client creado` | `{request_id, id_empresa, api_key_hash_prefix, allowed_operations, description (truncado a 50), ip, actor?}` |
| GET /internal/admin/clientes | `info` | `Listado de per-company clients consultado` | `{request_id, filters: {id_empresa?, include_revoked?, limit, offset}, count, ip}` |
| POST /internal/admin/clientes/:id/rotate | `info` | `Per-company client rotado` | `{request_id, id_empresa, old_api_key_hash_prefix, new_api_key_hash_prefix, motivo, actor, ip}` |
| DELETE /internal/admin/clientes/:id | `info` | `Per-company client revocado` | `{request_id, id_empresa, api_key_hash_prefix, was_active, already_revoked, motivo, actor, ip}` |

### 8.2. Qué NO se loguea (regla de oro)

- **NUNCA** el plaintext de la API key (`api_key`).
- **NUNCA** el hash completo (`api_key_hash` 64 chars). Solo el prefix
  de 8 chars (`api_key_hash_prefix`).
- **NUNCA** el header `X-Admin-API-Key` (ya está en la lista
  `SENSITIVE_KEYS` del logger, se redacta automáticamente a `[REDACTED]`).
- **NUNCA** `X-Client-Instance-Id` (PII operacional).

### 8.3. Redacción automática (ya implementada en `logger.js`)

El logger ya redacta automáticamente:
- `api_key`, `internal_api_key`, `admin_api_key` (claves SENSITIVE_KEYS) → `[REDACTED]`.
- PII por valor: correos, cédulas, celulares embebidos en strings → `[EMAIL]`, `[CEDULA]`, `[CELULAR]`.
- `id_empresa` (NIT) está en SENSITIVE_KEYS desde P1-5, pero **queremos
  que aparezca en logs** para troubleshooting. La redacción es por
  nombre de clave, no por valor. Para mantenerlo, se pasa el NIT como
  valor de un campo con nombre distinto a `id_empresa` (ej. `empresa_nit`).
  **TODO: definir en implementación si se cambia el nombre del campo
  en logs o se hace override de la redacción.**

  **Decisión recomendada:** mantener `id_empresa` en logs y agregar
  `id_empresa` a una lista de "excepciones" del logger si hace falta,
  o usar un campo alternativo (`empresa_id` en logs). Ver §12 pregunta 4.

### 8.4. Formato de los logs (compatibilidad con el sistema actual)

El logger usa formato JSON-line, una línea por log. Cada log tiene:
- `timestamp` (ISO-8601 UTC)
- `level` (`info`, `warn`, `error`, `debug`)
- `message`
- `env` (`production`, `development`, `test`)
- `request_id` (UUID de la request, viene de `req.id`)
- meta adicional

Esto es compatible con el resto del servicio (ver `src/utils/logger.js`).

---

## 9. Casos de borde

### 9.1. Crear cliente duplicado (mismo `id_empresa` con cliente activo existente)

**Comportamiento:** `409 CLIENT_EXISTS_FOR_EMPRESA`.

```bash
# Empresa 900123456 ya tiene cliente activo
curl -X POST http://localhost:3001/internal/admin/clientes \
  -H 'X-Admin-API-Key: ...' \
  -d '{"id_empresa": "900123456", "allowed_operations": ["sign_request:create"]}'
```

**Response 409:**
```json
{
  "error": {
    "code": "CLIENT_EXISTS_FOR_EMPRESA",
    "message": "Ya existe un cliente activo para esta empresa. Use rotate o revoke antes de crear uno nuevo.",
    "details": {
      "id_empresa": "900123456",
      "existing_hash_prefix": "5d41402a",
      "created_at": "2026-08-20T15:30:00.123456Z"
    },
    "request_id": "req_..."
  }
}
```

**Recuperación:** el operador debe:
1. Usar `POST /internal/admin/clientes/900123456/rotate` para rotar la
   key existente.
2. O usar `DELETE /internal/admin/clientes/900123456` (v2) para
   revocar la key existente y luego crear una nueva.

**Edge case: id_empresa tiene solo clientes revocados (historial).**
- El check de unicidad solo aplica a clientes **activos**.
- Si la empresa tiene solo revocados (todos con `revoked_at IS NOT NULL`),
  se permite crear uno nuevo. Se preserva el historial.

### 9.2. Rotar key que no existe

**Comportamiento:** `404 CLIENT_NOT_FOUND`.

```bash
curl -X POST http://localhost:3001/internal/admin/clientes/900123456/rotate \
  -H 'X-Admin-API-Key: ...'
```

**Response 404:**
```json
{
  "error": {
    "code": "CLIENT_NOT_FOUND",
    "message": "No hay un cliente activo para esta empresa.",
    "details": {
      "id_empresa": "900123456",
      "hint": "Use POST /internal/admin/clientes para crear uno nuevo."
    },
    "request_id": "req_..."
  }
}
```

### 9.3. Revocar key ya revocada (v2)

**Comportamiento:** `200 OK` con `already_revoked: true` (idempotente).

```bash
# Cliente 900123456 ya está revocado desde 2026-08-19
curl -X DELETE http://localhost:3001/internal/admin/clientes/900123456 \
  -H 'X-Admin-API-Key: ...' \
  -d '{"motivo": "Limpieza", "actor": "ops"}'
```

**Response 200:**
```json
{
  "id_empresa": "900123456",
  "api_key_hash_prefix": "5d41402a",
  "revoked_at": "2026-08-19T10:00:00.000000Z",  // ORIGINAL
  "was_active": false,
  "already_revoked": true,
  "motivo": "Limpieza",
  "actor": "ops"
}
```

**Decisión:** idempotente (no retorna 409). El operador puede llamar al
endpoint varias veces sin efectos secundarios. El timestamp de
`revoked_at` ORIGINAL se preserva.

### 9.4. Listar sin permiso admin

**Comportamiento:** `401 INVALID_API_KEY` (mismo que el resto de los
endpoints admin, no filtra "falta header" vs "key incorrecta").

```bash
curl http://localhost:3001/internal/admin/clientes
# → 401 INVALID_API_KEY, "Falta el header X-Admin-API-Key"
```

### 9.5. Body con `allowed_operations` vacío

**Comportamiento:** `400 INVALID_REQUEST_BODY` con `details.issues`
apuntando a `allowed_operations`.

```json
{
  "error": {
    "code": "INVALID_REQUEST_BODY",
    "message": "El body de la request no cumple el schema",
    "details": {
      "issues": [
        { "path": "allowed_operations", "message": "Array must contain at least 1 element(s)", "code": "too_small" }
      ]
    }
  }
}
```

### 9.6. Body con `allowed_operations` con valores fuera del enum

**Comportamiento:** `400 INVALID_REQUEST_BODY` (zod rechaza el enum).

```json
{
  "error": {
    "code": "INVALID_REQUEST_BODY",
    "details": {
      "issues": [
        { "path": "allowed_operations.0", "message": "Invalid enum value. Expected 'sign_request:create' | ..., received 'admin:delete'", "code": "invalid_enum_value" }
      ]
    }
  }
}
```

### 9.7. `id_empresa` con caracteres Unicode (emojis, tildes)

**Comportamiento:** se acepta (zod solo valida longitud 1-64, no
formato). El backend lo guarda tal cual. K+AIR debe normalizar el
`id_empresa` antes de enviarlo si quiere matching case-insensitive.

**Nota:** el matching en BD es case-sensitive (`id_empresa TEXT NOT NULL`).
Esto es intencional — el operador sabe qué `id_empresa` usar.

### 9.8. Crear 2 clientes seguidos en rápida sucesión (race condition)

**No hay race condition.** better-sqlite3 es single-writer (SQLite
default). Las dos requests se serializan a nivel de DB. La segunda
ve la primera commiteada y retorna 409.

### 9.9. Rotar y crear casi simultáneo (race condition)

Si dos operadores rotan al mismo tiempo:
- TX1: SELECT activo, revoca, crea nuevo.
- TX2: SELECT activo (lee el que TX1 acaba de revocar) → ve NULL → 404.

Mejor escenario: TX2 ve la nueva key (TX1 ya commiteó) y la rota.
Peor escenario: TX2 ve NULL (entre el UPDATE de TX1 y el INSERT de TX1)
→ 404. **Aceptable** porque el operador puede reintentar y rotar la
nueva key.

### 9.10. `description` muy largo (truncado)

**Comportamiento:** se rechaza con `400` (zod max 200). Decisión: NO
truncar silenciosamente — el operador debe ser explícito.

---

## 10. Compatibilidad con I-010 existente

### 10.1. ¿Los nuevos endpoints rompen algo del comportamiento actual?

**No.** Los nuevos endpoints son aditivos:
- Estan bajo `/internal/admin/clientes/*` (path nuevo, no usado).
- Usan `X-Admin-API-Key` (mismo middleware que el endpoint de Acuerdo
  de uso, sin cambios).
- Operan sobre `gh_internal_clients` (tabla existente, sin schema
  changes en v1).
- No modifican ninguna ruta existente.

### 10.2. ¿El cache de 30s de `getActiveClientByApiKey` se ve afectado?

**Sí, en 2 puntos:**

1. **Rotación:** después de una rotación, `internalClient.clearCache()`
   se llama (igual que `revokeClient` hoy). Los próximos lookups
   repueblan el cache con la nueva key.
   - **Ventana de 30s:** aceptable en v1. Si K+AIR está usando la key
     vieja cuando se rota, los próximos 30s podría seguir funcionando
     (K+AIR recibe error 401 cuando empieze a usar la nueva ANTES de
     que K+AIR actualice sus secrets). En la práctica, K+AIR hace
     `update secrets.enc + invalidate cache` inmediatamente después de
     recibir la nueva key.
   - **Defensa en profundidad:** en v2 se podría agregar un cache
     invalidation event-based (no en v1).

2. **Creación:** crear un cliente NO afecta el cache porque la key es
   nueva y no estaba en el cache. La key nueva aparecerá en el cache
   la primera vez que se use.

3. **Revocación (v2):** mismo comportamiento que `revokeClient` hoy:
   `clearCache()` después de la operación.

### 10.3. ¿Los tests existentes siguen pasando?

**Sí, esperado.** Los tests de I-010 (cross-company, internalClient
service) no tocan los endpoints admin. Los tests admin existentes
(`tests/routes/admin.test.js` para acuerdo-versiones) tampoco se
ven afectados (son paths diferentes).

### 10.4. ¿K+AIR debe migrar inmediatamente?

**No, en v1 la legacy key sigue funcionando.** El fallback
`lookupLegacyClient` (en `internalClient.js:267-281`) sigue activo
durante el período de deprecation (1 release). K+AIR puede migrar
progresivamente:
1. Crear per-company client para cada empresa con el endpoint nuevo.
2. Guardar la nueva key en `secrets.enc` (v2 schema con `empresas` map).
3. Invalidad el cache de la empresa específica.
4. Repetir por cada empresa.

La legacy key queda como fallback hasta que el user la depreque.

### 10.5. Compatibilidad con el middleware `internalServerLimiter`

Los endpoints admin NO usan `requireEmpresaScopeAndLimit` (que aplica
las 4 capas de rate limit interno). Usan `adminApiAuth()` que solo
valida la `X-Admin-API-Key`. Esto es **intencional**:
- El rate limit interno se basa en `req.id_empresa` (de la auth per-company).
- En endpoints admin, `req.id_empresa` no está seteado (es admin, no
  per-company).
- El `internalServerLimiter` necesita `req.id_empresa` para las
  keyGenerators de las 4 capas; sin él, no funciona.

Por lo tanto, los endpoints admin quedan FUERA del rate limit interno
(decisión §7.1).

---

## 11. Tests propuestos

### 11.1. Unit tests del service (extender `tests/services/internalClient.test.js`)

Agregar ~6 tests unitarios para los nuevos métodos del service:

1. `createClientForAdmin` (nuevo wrapper): genera key, hashea, guarda.
   - Verificar que el hash guardado es SHA-256 de la key generada.
   - Verificar que la key generada tiene el formato `kair_(live|test)_<43 chars>`.
   - Verificar que `crypto.randomBytes(32).toString('base64url')` produce 43 chars.

2. `rotateClientByEmpresa` (nuevo wrapper): busca activo, revoca, crea nuevo.
   - En una sola transacción.
   - Si no hay activo → throw 404.
   - Si la nueva key tiene el mismo hash que la vieja (improbable pero
     posible con `crypto.randomBytes`) → throw 500 con mensaje claro.
   - El hash viejo y el nuevo son diferentes.

3. `revokeClientByEmpresa` (v2): busca activo, revoca.
   - Idempotente: si ya está revocado, no hace nada.
   - Retorna `{was_active, already_revoked, revoked_at}`.

4. `listClients({id_empresa, include_revoked, limit, offset})`: nuevo wrapper.
   - Filtra por id_empresa si se pasa.
   - Excluye revocados por default.
   - Paginación correcta.

5. `clearCache` ya existe — verificar que se llama después de rotate/revoke.

6. `validateAllowedOperations` (nuevo helper): valida que el array
   solo contiene operaciones del enum.

### 11.2. Tests de integración (nuevo archivo `tests/routes/admin-clientes.test.js`)

**Auth (4 tests):**
- POST sin `X-Admin-API-Key` → 401.
- POST con `X-Admin-API-Key` incorrecto → 401.
- POST con `X-Internal-API-Key` (header equivocado) → 401.
- POST con `X-Admin-API-Key` correcto → 201.

**Validación de body para POST (5 tests):**
- `id_empresa` faltante → 400.
- `id_empresa` muy largo (>64) → 400.
- `allowed_operations` array vacío → 400.
- `allowed_operations` con valor fuera del enum → 400.
- `description` muy largo (>200) → 400.

**Lógica de POST (6 tests):**
- 201 crear con datos mínimos → response incluye `api_key` plaintext.
- 201 crear con `description` → response eco.
- 201 crear con `allowed_operations` completo → CSV se serializa bien.
- 409 al crear duplicado activo para mismo `id_empresa`.
- 201 al crear para `id_empresa` que solo tiene revocados (historial).
- 500 si BD no disponible (mock).

**Validación de query para GET (3 tests):**
- GET sin params → 200 con lista completa (default `include_revoked=false`).
- GET con `?id_empresa=X` → 200 con solo clientes de X.
- GET con `?include_revoked=true` → 200 incluye revocados.
- GET con `?limit=10&offset=20` → 200 paginación correcta.
- GET con `?limit=201` → 400.
- GET con `?include_revoked=foo` → 400 (zod strict).

**Lógica de GET (3 tests):**
- Lista vacía → 200 `{total: 0, items: []}`.
- Lista con 5 clientes → 200 `{total: 5, items: [...]}`.
- Verificar que la response NO contiene el hash completo (solo prefix de 8).

**POST rotate (8 tests):**
- 404 si no hay cliente activo para `:id`.
- 200 rota → response incluye `new_api_key` plaintext, `old_api_key_hash_prefix`.
- Después de rotar, el cliente viejo tiene `revoked_at` y el nuevo no.
- Después de rotar, `getActiveClientByApiKey(oldKey)` retorna null.
- Después de rotar, `getActiveClientByApiKey(newKey)` retorna el cliente.
- Body con `motivo` y `actor` custom → eco en response.
- Body sin campos → defaults aplicados.
- Verificar transacción atómica: si falla el INSERT, el UPDATE de la
  vieja se hace rollback.

**DELETE (v2, 5 tests):**
- 200 revoca → cliente tiene `revoked_at` setado.
- 200 idempotente: segunda llamada retorna `already_revoked=true`.
- 404 si no hay ningún cliente (ni activo ni revocado) para `:id`.
- Después de revocar, `getActiveClientByApiKey(key)` retorna null.
- Cache se invalida (verificar con un test que fuerza el cache y luego
  revoca, y verifica que la siguiente request repuebla).

**Cross-cutting (4 tests):**
- Logs: verificar que se emite el log esperado con `api_key_hash_prefix`
  pero NO con la key en plaintext.
- Cache invalidation: rotar → cache limpio → repopula con nueva key.
- Concurrencia: 2 rotaciones simultáneas (con `Promise.all`) → una
 成功, otra 404.
- Audit: verificar que `getActiveClientByApiKey` después de rotate usa
  la nueva key, no la vieja.

**Total estimado de tests de integración:** ~38 tests.

### 11.3. Tests E2E (admin flow completo, 4 tests)

Agregar a `tests/e2e/` (nuevo archivo `tests/e2e/admin-clientes-flow.test.js`):

1. **Happy path:** admin crea per-company client para empresa A →
   K+AIR simulado usa la key para crear sign request → el sign request
   queda con `id_empresa=A`. Verificar que un intento con key de B para
   id_empresa=A falla con 403/404.

2. **Rotación:** admin rota la key de A → K+AIR recibe 401 al usar
   la key vieja → K+AIR actualiza `secrets.enc` con la nueva → siguiente
   request funciona.

3. **Cross-company:** admin crea clients para A y B → key de A se
   usa solo para sign requests de A (firma OK) → key de A NO sirve
   para sign requests de B (falla 403 EMPRESA_MISMATCH).

4. **Idempotencia + audit:** admin crea, rota, y re-revoca → verificar
   que la BD tiene el historial (1 activo + N revocados con timestamps)
   y que los logs reflejan cada acción.

**Total tests propuestos (todos los archivos):** ~48 tests.

---

## 12. Preguntas abiertas (necesitan decisión del user)

Estas preguntas deben resolverse ANTES de implementar el código. Las
recomendaciones son del Subagente A; el user decide.

### Pregunta 1: ¿`expires_at` se implementa en v1 o se difiere a v2?

**Contexto:** el campo `expires_at` está en el zod schema de POST
(opcional, ISO-8601) pero la tabla actual NO tiene esa columna.
- **Opción A (v1, con migration):** agregar columna `expires_at` a
  `gh_internal_clients` (migración 010), y validar en
  `getActiveClientByApiKey` que `expires_at IS NULL OR expires_at > now`.
- **Opción B (v1, sin expires_at):** ignorar el campo por ahora. El
  zod schema lo rechaza con `unrecognized_keys` o lo acepta y lo
  ignora. Decidirlo en v2.
- **Opción C (v1, parcial):** aceptar el campo y guardarlo en
  `description` (ej. "expires_at: 2027-01-01"). No enforce en
  backend.

**Recomendación:** Opción B. En v1 no se necesita. La rotación es el
mecanismo principal de "refresh"; expiración automática agrega
complejidad (¿qué pasa cuando expira? ¿hay grace period? ¿se notifica
al cliente?) que no es necesaria para el caso de uso actual.

**Impacto si se hace A:** ~50 LOC extra + 1 migration + tests + decisión
de "¿qué pasa cuando expira?" (404 vs 410 vs desactivar suave).

### Pregunta 2: ¿Cómo manejar `motivo` y `actor` en rotación/revocación?

**Contexto:** el body de rotate/revoke acepta `motivo` y `actor` para
auditoría. Pero la tabla actual no tiene columnas para ellos.

- **Opción A (v1, sin tabla de eventos):** guardar `motivo` y `actor`
  concatenados al `description` del cliente viejo (truncado a 200).
  Ej. `"K+AIR TEMPOACTIVA [REVOKED at 2026-08-20 by ops: Rotación trimestral"]`.
  Simple, funciona.
- **Opción B (v1, con tabla de eventos):** agregar tabla
  `gh_internal_client_events` (migración 010) y guardar cada rotación/
  revocación como fila. Más limpio, más normalizado, más código.
- **Opción C (v1, solo en logs):** guardar `motivo` y `actor` solo en
  `logger.info`, NO en BD. La auditoría es por logs. Si los logs se
  pierden, se pierde la info.

**Recomendación:** Opción A para v1, Opción B para v2 (si el user
quiere UI de "audit log de credenciales").

### Pregunta 3: ¿`DELETE /internal/admin/clientes/:id` se implementa en v1 o v2?

**Contexto:** el spec incluye el contrato del DELETE pero el AUD-04
dice "opcional v2". El caso de uso es "revocar desde firma-service
porque la key se compromete" — pero en v1 K+AIR puede simplemente
borrar la key de `secrets.enc` (y queda revocada en su lado, no en
firma-service).

**Recomendación:** v2. En v1, si el user quiere revocar, puede:
1. Llamar a `POST /rotate` (genera key nueva, marca la vieja como
   revocada en firma-service). Efecto: la key vieja deja de funcionar
   en firma-service.
2. O simplemente borrar de `secrets.enc` (la key queda activa en
   firma-service pero K+AIR ya no la usa → ataque necesita tener
   la key).

El DELETE como endpoint separado es más limpio para el caso
"esta empresa ya no debe tener firma electrónica" (rotación +
limpieza semántica).

**Si se hace en v1:** ~30 LOC + 5 tests. Bajo costo.

### Pregunta 4: ¿`id_empresa` en logs se redacta o se mantiene?

**Contexto:** el logger tiene `id_empresa` en `SENSITIVE_KEYS`
(`src/utils/logger.js:30`), por lo que se redacta a `[REDACTED]`.
Pero el `id_empresa` (NIT) es necesario para troubleshooting.

- **Opción A:** remover `id_empresa` de `SENSITIVE_KEYS`. El NIT
  aparece en logs. Trade-off: el NIT es PII bajo Ley 1581.
- **Opción B:** mantener redacción, pero pasar el NIT en un campo
  con otro nombre en los logs (ej. `empresa_nit`).
- **Opción C:** agregar `id_empresa` a una lista de "excepciones" del
  logger (override).
- **Opción D:** mantener la redacción. El operador puede consultar
  `gh_internal_clients` por `api_key_hash_prefix` (8 chars) si necesita
  saber qué empresa se afectó.

**Recomendación:** Opción B (campo con otro nombre) — no toca la lista
de SENSITIVE_KEYS, no requiere override, y permite que el NIT aparezca
en logs sin cambiar la convención de redacción.

### Pregunta 5: ¿El prefijo de la API key es `kair_live_` / `kair_test_` o algo distinto?

**Contexto:** inspirado en Stripe (`sk_live_` / `sk_test_`).

- **Opción A:** `kair_live_` / `kair_test_` (recomendado en este spec).
- **Opción B:** sin prefijo (solo 43 chars base64url).
- **Opción C:** prefijo más corto: `kl_` / `kt_`.
- **Opción D:** prefijo con info de versión: `kair_v1_live_...`.

**Recomendación:** Opción A. Es estándar, autoexplicativo, previene
uso accidental de test keys en producción. Si el user prefiere más
corto o sin prefijo, ajustar.

### Pregunta 6: ¿La operación `sign_request:revoke` se agrega al enum?

**Contexto:** I-010 dice "NO incluir `sign_request:revoke` (eso es
admin-only)". El endpoint de revocación actual (`POST /internal/sign-requests/:id/revoke`)
usa `X-Admin-API-Key`, no `X-Internal-API-Key`. Por lo tanto NO se agrega.

**Recomendación:** confirmar con el user. Si en el futuro K+AIR
quiere auto-revocar sign requests de SU empresa (no de otras), se
agrega la op. Pero en v1 no.

### Pregunta 7: ¿El path param `:id` es `id_empresa` o `api_key_hash_prefix`?

**Contexto:** el spec usa `id_empresa` (string human-readable). Pero
podría ser `api_key_hash_prefix` (8 chars hex) o `api_key_hash`
completo (64 chars).

- **Opción A (spec actual):** `:id` = `id_empresa`. El operador conoce
  el NIT, no el hash.
- **Opción B:** `:id` = `api_key_hash_prefix` (8 chars). Útil para
  "revoca la key que empieza con 5d41402a" pero requiere que el
  operador primero liste.
- **Opción C:** ambos aceptados: si matchea `^\d+$` o NIT pattern, es
  `id_empresa`; si matchea `^[0-9a-f]{8}$`, es hash prefix.

**Recomendación:** Opción A. Es lo que el operador humano sabe. Si
necesita operar por hash, primero lista y luego usa el hash prefix
en el `body` o en un sub-path.

### Pregunta 8: ¿El endpoint acepta `X-Client-Instance-Id` (opcional)?

**Contexto:** `X-Client-Instance-Id` se usa en `internalServerLimiter`
para la capa 2. Los endpoints admin no usan ese limiter (§7). Pero
podría ser útil para tracking ("qué instalación de K+AIR admin está
operando").

**Recomendación:** NO en v1. Se ignora si se envía. En v2 se puede
agregar si el user quiere tracking operacional.

---

## 13. Decisiones de diseño tomadas (mercen validación)

Estas decisiones las tomé yo (Subagente A) sin consultar al user. Las
marco aquí para que el user las pueda aceptar/cambiar antes de
implementar.

### Decisión 1: NO se requiere migration nueva en v1

**Qué:** la tabla `gh_internal_clients` (migración 009) ya tiene
todas las columnas necesarias. No se agrega `expires_at` ni tabla
de eventos en v1.

**Por qué:** minimizar el diff del commit 1. Los 4 endpoints se
pueden implementar solo con la tabla actual + zod schemas. Si el
user quiere `expires_at` o tabla de eventos, se hace en commit 2
(o v2).

**Trade-off:** la auditoría de rotación/revocación se hace vía
`description` truncado o solo en logs. No hay tabla normalizada
de eventos.

**Validar con user:** §12 pregunta 1 y 2.

### Decisión 2: Rotación = crear nueva + marcar vieja como revocada (transacción atómica)

**Qué:** en `POST /:id/rotate`, dentro de una `db.transaction()`:
1. Revocar el cliente activo de la empresa.
2. Crear el nuevo cliente con nueva key, mismo id_empresa, mismas ops.

**Por qué:** garantiza atomicidad. Si falla el INSERT del nuevo
cliente, el UPDATE del viejo se hace rollback. No hay ventana en la
que la empresa quede sin key.

**Trade-off:** la key vieja tiene `revoked_at` pero no hay info
estructurada de "fue rotada a X" (eso requeriría tabla de eventos).
Para v1 es aceptable — la info está en logs y en el `description`
opcional.

**Validar con user:** §12 pregunta 2.

### Decisión 3: `id_empresa` como path param `:id` (NO el hash)

**Qué:** `POST /clientes/900123456/rotate`, `DELETE /clientes/900123456`,
`GET /clientes?id_empresa=900123456`. El operador (o K+AIR) conoce
el NIT, no el hash.

**Por qué:** mejor UX, el humano no tiene que copiar/pegar hashes
hex de 64 chars. El NIT es el identificador natural.

**Trade-off:** si la empresa tiene 2+ clientes activos (debería ser
imposible por convención, pero defensa), hay que decidir cuál rota.
El spec dice "pick the active one" (debería ser único).

**Validar con user:** §12 pregunta 7.

### Decisión 4: Formato de la API key: `kair_(live|test)_<43 chars base64url>`

**Qué:** la key generada tiene un prefijo que indica el environment
(11 chars) + 32 bytes random en base64url (43 chars, sin padding).
Total: 54 chars.

**Por qué:**
- Estilo Stripe (`sk_live_` / `sk_test_`) — estándar de la industria.
- Previene uso accidental de test keys en producción (autoexplicativo
  al ver la key).
- base64url es URL-safe (no requiere encoding en URLs/JSON).

**Trade-off:** el operador humano tiene que copiar/pegar 54 chars.
Si prefiere más corto, ajustar (prefijo de 3 chars + 43 chars = 46).

**Validar con user:** §12 pregunta 5.

### Decisión 5: NO rate limit en endpoints admin (v1)

**Qué:** los 4 endpoints NO tienen rate limit. El `globalLimiter`
(60/min por IP) los excluye porque están bajo `/internal/*`. El
`internalServerLimiter` no aplica porque no hay `req.id_empresa`.

**Por qué:** los endpoints admin son operados por humanos con baja
frecuencia. Rate limit no aporta protección significativa.

**Trade-off:** un script en loop puede crear 1000 clientes en 1 min
si tiene la admin key. Pero si tiene la admin key, ya rompió el
modelo de seguridad — el rate limit no lo va a detener.

**Mitigación:** si el user quiere defensa en profundidad, agregar
un `adminLimiter` (30/min por IP) en v2. Costo: ~15 LOC.

**Validar con user:** §7 (no hay pregunta abierta explícita, pero
el user debe aprobar esta decisión).

### Decisión 6: Listado NUNCA expone el hash completo, solo el prefix de 8 chars

**Qué:** `GET /internal/admin/clientes` retorna `api_key_hash_prefix`
(8 chars hex), NO el `api_key_hash` completo (64 chars).

**Por qué:** principio de mínima exposición. El hash completo es
"tan secreto como la key" (conociendo el algoritmo y el salt — que
no hay, pero en defensa en profundidad). El prefix de 8 chars
permite correlación visual ("roté la key que empezaba con 5d41402a")
sin exponer el secreto.

**Trade-off:** un atacante con acceso al listado no puede hacer
brute-force del hash (8 chars hex = 16^8 = 4 mil millones; pero
necesitaría la key original + sha256 + prefix match, no es
factible).

**Validar con user:** no requiere aprobación explícita, es default
seguro.

### Decisión 7: El path param `:id` se valida con `min(1).max(64)`, sin regex

**Qué:** no se enforcea formato de NIT. Cualquer string 1-64 chars
es aceptado como `:id`. Si la empresa no existe en BD → 404.

**Por qué:** K+AIR puede tener empresas con NIT+Dígito Verificador,
EXT-XXX, o identificadores custom. No queremos rechazar formatos
válidos que el cliente usa.

**Trade-off:** typos en el NIT no se detectan (ej. `900123456` vs
`900123457` son ambos válidos). El operador debe ser cuidadoso.

**Validar con user:** §6.3 (no hay pregunta abierta, pero el user
debe saber que se valida longitud, no formato).

### Decisión 8: El prefijo de environment (`kair_live_` / `kair_test_`) se elige en base a `config.env`

**Qué:** si `NODE_ENV=production` → prefijo `kair_live_`. En otro
caso → `kair_test_`. Hard-coded en el código del endpoint, no
configurable.

**Por qué:** simple, no requiere nueva env var, y refleja el
environment actual.

**Trade-off:** si se quiere un prefijo custom (ej. `kair_staging_`
para un environment `staging`), hay que cambiar el código. En v1
solo hay `production` y "no production" (dev, test, etc.).

**Validar con user:** §12 pregunta 5 (incluida).

---

## 14. Resumen de entregables para implementación

Cuando el user apruebe este spec, la implementación consistirá en:

1. **Nuevo archivo:** `firma-service/src/routes/admin-clientes.js`
   (similar a `admin.js` para acuerdo-versiones, con 4 endpoints).
2. **Nuevo archivo:** `firma-service/src/schemas/admin-clientes.js`
   (zod schemas extraídos, para reuse y test).
3. **Extensión de service:** `firma-service/src/services/internalClient.js`
   con 3-4 funciones nuevas:
   - `createPerCompanyClient({id_empresa, allowed_operations, description})` — genera key, hashea, guarda.
   - `rotateClientByEmpresa(id_empresa, {motivo, actor})` — busca activo, revoca, crea nuevo, en TX.
   - `listClients({id_empresa, include_revoked, limit, offset})` — wrapper de SELECT.
   - `revokeClientByEmpresa(id_empresa, {motivo, actor})` — v2.
4. **Extensión de tests:**
   - `firma-service/tests/routes/admin-clientes.test.js` (~38 tests).
   - `firma-service/tests/services/internalClient-rotation.test.js` (o extender el existente, ~6 tests).
   - `firma-service/tests/e2e/admin-clientes-flow.test.js` (~4 tests).
5. **Modificación de `server.js`:** agregar `app.use('/internal/admin', adminClientesRouter)` (1 línea).
6. **NO se requiere migration nueva en v1.**
7. **NO se requiere cambio en `config.js` en v1.**

**LOC estimado:** ~350-500 líneas (incluyendo tests). Esto encaja con
el rango del AUD-04 §8 (commit 1: ~250-400 LOC + tests).

---

## 15. Referencias cruzadas

- Diseño de arquitectura: `storage-backup/audit-04-per-empresa-auth-design.md` §1-9.
- Modelo de datos per-company: `docs/kair-firma-integration/I-010-design.md` §2-3.
- Service existente: `firma-service/src/services/internalClient.js` (referencia para `createClient`).
- Admin endpoint existente (patrón a seguir): `firma-service/src/routes/admin.js` (POST `/acuerdo-versiones`).
- Tests cross-company (referencia para tests de cross-company):
  `firma-service/tests/routes/signRequest-cross-company.test.js`.
- Convención de errores: `firma-service/src/middleware/errors.js`.
- Convención de validación zod: `firma-service/src/schemas/index.js`.
- Convención de rate limit: `firma-service/src/middleware/rateLimit.js` (ver §7.1).
- Logger: `firma-service/src/utils/logger.js` (ver §8 — reglas de redacción).

---

## 16. Decisiones ratificadas por el user (2026-08-20)

Estas decisiones resuelven los gaps detectados en el cross-check A↔B↔C
y son **binding** para la implementación. Se dividen en dos rondas:

**Ronda 1 (DR-1 a DR-5)**: gaps detectados en cross-check A↔B.

**Ronda 2 (DR-6.A a DR-6.D)**: gaps adicionales detectados por Subagente C
en cross-check C↔A↔B, sin pregunta al user (decisiones técnicas
conservadoras).

### DR-1 (binding) — Crear cliente: bridge → backend (NO renderer)
La llamada `POST /internal/admin/clientes` la hace el **bridge de K+AIR**,
no el renderer ni un operador humano. El bridge usa el admin token
(ver DR-2) para autenticarse. La `api_key` retornada se almacena
directamente en `secrets.enc.empresas[idEmpresa].firmaApiKey` por el bridge
(NUNCA fluye al renderer).

### DR-2 (binding) — Admin token: persistido en `secrets.enc.adminApiKey`
El `X-Admin-API-Key` se persiste en `secrets.enc.adminApiKey` (cifrado
con safeStorage), una vez por instalación. K+AIR asume una sola
"operadora" por instalación (operator-level token).

- Setear via IPC K+AIR: `firma:config:set-admin-key(adminApiKey)`.
- Validación: longitud mínima 32 chars.
- Si falta y se intenta una op admin, retornar `ADMIN_TOKEN_REQUIRED`
  con `extra.remediationHint: 'Configure adminApiKey via firma:config:set-admin-key'`.

### DR-3 (binding) — IPC `firma:empresa:create` agregado
Implicación directa de DR-1. Nuevo IPC en K+AIR (no tocar firma-service):
`firma:empresa:create(companyName, idEmpresa, displayName)`.
- Si admin token falta → `ADMIN_TOKEN_REQUIRED` (sin llamada al backend).
- Si backend rechaza → propagar error al renderer con detalles.

### DR-4 (binding) — DELETE/revoke en backend: V2 (no en commit 1)
El endpoint `DELETE /internal/admin/clientes/:id` queda como **V2**.
- En V1, "revocar" se hace borrando de `secrets.enc` localmente + rotando
  (la rotación sí marca la key vieja como revocada en el backend).
- K+AIR `firma:empresa:revoke-api-key` con `revokeRemote: true`
  llama a `POST /:id/rotate` con la key actual (auto-revocación).
- La key "revocada" sigue activa en firma-service hasta que se rote
  (ventana de tiempo mínima, mitigable rotando siempre después de revoke).

### DR-5 (binding) — Prefijo `kair_live_/kair_test_`: warning soft
K+AIR **NO** rechaza keys importadas que no tengan el prefijo
`kair_live_/kair_test_`. Solo emite un warning en consola del bridge y un
`softWarning` en el response al renderer. No acoplamos K+AIR al formato
interno de las keys de firma-service.

### DR-6.A (binding) — Bridge construye `description`, backend NO
El bridge de K+AIR envía `description` ya formateado con el patrón
`K+AIR empresa ${displayName} - ${config.env}` (truncado a 200 chars).
El backend **NO** construye el `description` — solo persiste lo que recibe.
Ver §3.1.1 (Notas de contrato con el bridge) para el detalle.

**Implicación para el backend**: no se requiere lógica adicional. Solo
asegurarse de que el `description` se persiste tal cual llega (sin
trim, sin transformación).

### DR-6.B (binding) — `allowed_operations` siempre son los 5 del enum
El bridge SIEMPRE envía los 5 valores del enum I-010:
`['sign_request:create', 'sign_request:read', 'consent:create', 'consent:verify', 'audit:read']`.

**Implicación para el backend**: el schema zod actual acepta 1-10 items,
lo cual es válido. Pero el contrato del bridge fija que siempre son 5.
Recomendación: aceptar con WARN loggeado si vienen menos de 5 (señal
de que el bridge tiene un bug).

Ver §3.1.1 (Notas de contrato con el bridge) para el detalle.

### DR-6.C (binding) — Error 409 se traduce a `ALREADY_CONFIGURED`
Si el backend retorna `409 CLIENT_EXISTS_FOR_EMPRESA`, el bridge lo
traduce a `ALREADY_CONFIGURED` con `extra.suggestion: 'Use firma:empresa:rotate-api-key to rotate the existing key'`.

**Implicación para el backend**: el código de error `CLIENT_EXISTS_FOR_EMPRESA`
sigue siendo el que retorna el backend — no se renombra. El bridge hace
la traducción.

Adicional: el bridge chequeará `secrets.enc.empresas[companyName]` ANTES
de llamar al backend. Si ya existe localmente, retorna `ALREADY_CONFIGURED`
sin hacer la llamada HTTP.

Ver §3.1.3 (Mapeo de errores backend → bridge) para el detalle.

### DR-6.D (no bloqueante, aceptado) — `validateRemote` usa admin endpoint
B's `set-api-key` con `validateRemote: true` llama `GET /internal/admin/clientes`
(que requiere `X-Admin-API-Key`). Semánticamente raro (validamos per-company
con admin), pero funciona porque el bridge tiene `adminApiKey` (DR-2).

**Decisión**: Aceptar en V1. Alternativa futura: endpoint per-company
`GET /internal/me` (DR-8, post-I-102). Documentar como decisión técnica,
no requiere cambio en V1.

---

## 17. Cambios por aplicar al backend (commit 1)

Con las DR consolidadas, el alcance del commit 1 es:

1. **Agregar endpoint** `POST /internal/admin/clientes` (DR-1).
   - Auth: `X-Admin-API-Key` (mismo patrón que `POST /acuerdo-versiones`).
   - Genera key: `crypto.randomBytes(32).toString('base64url')` con prefijo `kair_live_` o `kair_test_` según `config.env`.
   - Hashea con SHA-256 (256 bits = 64 hex chars).
   - Guarda en `gh_internal_clients` con `id_empresa`, `display_name`, `allowed_operations`, `description='LEGACY...'` o similar.
   - Retorna: `{ id_interno, id_empresa, display_name, allowed_operations, api_key, api_key_hash_prefix, created_at, ... }`.
   - **NUNCA** loguea la key en plaintext.

2. **Agregar endpoint** `POST /internal/admin/clientes/:id/rotate` (DR-4).
   - Auth: `X-Admin-API-Key`.
   - Transacción atómica: revocar activo + insertar nuevo con mismas `allowed_operations` y `id_empresa`.
   - Sin grace period en V1.
   - Retorna la nueva key en plaintext (similar a POST create).
   - Idempotencia: si no hay cliente activo para `:id`, retorna 404.
   - Cache de 30s en `getActiveClientByApiKey` se limpia después de la rotación (`clearCache()` en el handler).

3. **Agregar endpoint** `GET /internal/admin/clientes` (necesario para `firma:empresa:list-firma-remote` y para `validateRemote: true` en set-api-key).
   - Auth: `X-Admin-API-Key`.
   - Query params: `?id_empresa=...` (filtro), `?include_revoked=true` (default false), `?limit=50&offset=0`.
   - Response: lista de clientes con `id_interno, id_empresa, display_name, allowed_operations, api_key_hash_prefix, created_at, last_rotated_at, revoked_at`.
   - **NUNCA** expone el hash completo, solo el prefix de 8 chars.

4. **NO incluir** `DELETE /internal/admin/clientes/:id` (queda para V2 según DR-4).

5. **NO modificar** `internalClient.js` más allá de lo necesario (e.g., un método `rotate` si la lógica no cabe en el handler).

6. **Tests**: 3 archivos nuevos, ~30-40 tests:
   - `tests/routes/admin-clientes.test.js`: 20+ tests unit del handler.
   - `tests/integration/admin-clientes-flow.test.js`: 10+ tests E2E (admin flow completo).
   - `tests/middleware/admin-clientes-rotation.test.js`: race conditions, cache invalidation.

7. **Validación cross-company** se mantiene como está (I-010 ya implementado). El nuevo endpoint admin NO bypassea la authz per-company porque no opera sobre sign requests — solo sobre clientes internos.

8. **Logging**: `console.info` con `request_id, action, id_empresa, api_key_hash_prefix (8 chars)`. NUNCA plaintext.

9. **Rate limiting**: NO se aplica a endpoints admin en V1 (operador humano, baja frecuencia, no detiene a quien ya tiene `X-Admin-API-Key`). Si el user lo pide en revisión, agregar `adminLimiter` (30/min/IP).

10. **Compatibilidad**: el endpoint NO toca handlers existentes. `gh_internal_clients` ya tiene las columnas necesarias (migración 009). **No se requiere nueva migration**.

---

**Fin del spec.**

Próximo paso: lanzar Subagente C (QA/test matrix) con este spec + kair-auth-spec.md actualizados como input. Si C confirma compatibilidad, lanzar Fase 2 (implementación A+B+C en paralelo).


# I-010 — Per-Company Authorization (D-13)

**Versión del documento**: 1.0
**Fecha**: 2026-08-19
**Estado**: Diseño de referencia para la implementación en `firma-service`.
**Alcance**: Servicio de Firma Electrónica K+AIR v1.
**Documentos rectores**:
- [`ARCHITECTURE.md`](../gestion-humana/firma-electronica/ARCHITECTURE.md)
- [`DATA_MODEL.md`](../gestion-humana/firma-electronica/DATA_MODEL.md)
- [`API.md`](../gestion-humana/firma-electronica/API.md)
- [`SECURITY.md`](../gestion-humana/firma-electronica/SECURITY.md) §8

> **Aviso**: este documento es de diseño interno. No es documentación
> de cara al cliente K+AIR.

---

## 1. Resumen ejecutivo

I-010 introduce **autorización per-empresa** en el Servicio de Firma:
cada cliente interno (K+AIR) tiene una API key atada a **una empresa
específica** y un set explícito de **operaciones permitidas**. Antes
de I-010, había una sola API key global que podía actuar sobre
cualquier empresa.

Esto cierra el riesgo de **escalada de privilegio cross-company**: un
cliente con la key global puede firmar para cualquier empresa. Con
I-010, la key de la empresa A solo puede firmar para la empresa A.

**Modelo de dos capas explícito**:

```
AUTENTICACIÓN: ¿quién eres?  →  API key  →  cliente interno (id_empresa, ops)
AUTORIZACIÓN:  ¿qué empresa? →  req.id_empresa (de la auth, NUNCA del body)
              ¿puedes?       →  check clientOperations
              ¿coincide?     →  checkIdEmpresa (body vs auth)
```

---

## 2. Modelo de datos

### 2.1. Tabla `gh_internal_clients` (migración 009)

```sql
CREATE TABLE gh_internal_clients (
  api_key_hash TEXT PRIMARY KEY,        -- SHA-256 hex (64 chars)
  id_empresa TEXT NOT NULL,             -- Empresa a la que está atado
  allowed_operations TEXT NOT NULL,     -- CSV: "sign_request:create,sign_request:read"
  description TEXT,                     -- Auditoría libre
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT                       -- NULL = activa, ISO8601 = revocada
);
CREATE INDEX idx_internal_clients_empresa_active
  ON gh_internal_clients(id_empresa) WHERE revoked_at IS NULL;
```

**Decisiones**:

- **`api_key_hash` como PK** (no `id INTEGER`): el lookup siempre es por
  hash, no necesitamos un surrogate key.
- **SHA-256 hex** (no bcrypt/argon2): las API keys son strings ≥32 chars
  con alta entropía. NO son contraseñas humanas susceptibles a
  diccionario. SHA-256 es suficiente y rápido. Ver §3.1 para análisis
  detallado.
- **`id_empresa` NOT NULL**: cada cliente está atado a una empresa.
  NO usamos `'*'` para representar "legacy global" (ver §3.2).
- **`allowed_operations` como CSV** (no JSON, no tabla aparte): la lista
  es pequeña (5-10 valores). En v2 podría migrarse a JSON si crece.
- **`revoked_at` como soft-delete**: preserva el historial (ej. un
  cliente cambia de empresa y queremos conservar el registro de quién
  usó esa key).

### 2.2. Operaciones válidas (v1)

| Operación | Descripción | Endpoints |
|---|---|---|
| `sign_request:create` | Crear un nuevo sign request | `POST /internal/sign-requests` |
| `sign_request:read` | Leer sign requests de SU empresa | `GET /internal/sign-requests/:id`, `GET /internal/sign-requests` |
| `consent:create` | Crear consentimientos | `POST /internal/consentimientos` |
| `consent:verify` | Verificar OTP de consent | `POST /internal/consentimientos/:id/verify-otp` |
| `audit:read` | Leer audit trail | `GET /internal/sign-requests/:id/eventos` |

**Decisión**: NO incluir `sign_request:revoke` (eso es admin-only,
header `X-Admin-API-Key`, fuera de scope de K+AIR).

---

## 3. Decisiones de diseño

### 3.1. SHA-256 vs bcrypt/argon2 para API keys

**Decisión**: SHA-256.

**Por qué SHA-256 es suficiente**:
- Las API keys son strings generados con `crypto.randomBytes(32)` o
  similar → 256 bits de entropía → 2^256 valores posibles.
- bcrypt/argon2 están diseñados para **contraseñas humanas** (que tienen
  ~20-40 bits de entropía efectiva). Para claves con 256 bits de
  entropía, son innecesarios y agregan latencia (100ms+) sin beneficio.
- **Ataque de fuerza bruta**: con 2^256 entropía, es computacionalmente
  imposible. Ver Security §4.1.
- **Ataque de rainbow tables**: el espacio es tan grande que las tablas
  pre-computadas no aplican.

**Cuándo usar bcrypt/argon2**: cuando la entrada es una contraseña
elegida por un humano. No es nuestro caso.

**Referencias**:
- [NIST SP 800-63B](https://pages.nist.gov/800-63-3/sp800-63b.html): para
  secrets con alta entropía, el hashing con sal + SHA-256 es aceptable.

### 3.2. Legacy fallback: `authSource='legacy'` (NO `id_empresa='*'`)

**Decisión**: cuando llega una API key que NO está en BD pero coincide
con `config.auth.internalApiKey` (la "API key global" pre-I-010), se
retorna un cliente "legacy" con `id_empresa=null` y
`clientOperations=['legacy']`. NO fabricamos una identidad empresarial
global con `id_empresa='*'`.

**Por qué NO `id_empresa='*'`**:
- "`*`" es una identidad empresarial ficticia. Si el handler hace
  `req.id_empresa === signRequest.id_empresa` con `*` vs `'900123456'`,
  la comparación falla. Eso requeriría lógica especial en TODOS los
  handlers para tratar `*` como wildcard → fuente de bugs.
- Con `id_empresa=null`, el handler sabe explícitamente: "no hay
  identidad empresarial" y puede decidir cómo proceder (legacy mode
  → permisivo, client mode → estricto).
- `null` es explícito sobre "ausencia", `*` es implícito sobre "todas".

**Comportamiento del legacy mode durante deprecation (1 release)**:

| Endpoint | checkIdEmpresa | legacy → comportamiento |
|---|---|---|
| `POST /sign-requests` | post-parse en handler | permite (deprecation) |
| `GET /sign-requests/:id` | post-lookup en handler | permite (deprecation) |
| `GET /sign-requests` | en handler (force req) | usa query (compat) |
| `GET /sign-requests/:id/eventos` | post-lookup en handler | permite (deprecation) |
| `POST /consentimientos` | sí (body en JSON) | permite (deprecation) |
| `POST /consentimientos/:id/verify-otp` | post-lookup en handler | permite (deprecation) |

**Decisión operacional**: K+AIR debe migrar a una key por empresa
durante el período de deprecation. Después, se elimina el fallback
legacy en una release futura.

### 3.3. Cache 30s en memoria

**Decisión**: cache en memoria con TTL 30s para lookups de API key →
cliente.

**Trade-off**:

| Opción | Latencia | Revocación | Memoria |
|---|---|---|---|
| Sin cache (DB por request) | ~1-5ms | Inmediata | 0 |
| Cache 30s (esta opción) | ~0ms (hit) | Hasta 30s de ventana | 1 entry/cliente activo |
| Cache 5min | ~0ms | Hasta 5min | 1 entry/cliente activo |
| Cache + invalidation event | ~0ms | Inmediata | Más complejo (pub/sub) |

**Justificación de 30s**:
- Performance: en hot path, son 0 queries a BD. Con ~10 clientes
  activos esperados, el cache es trivial.
- Revocación: 30s es aceptable. Si se roba una key, el atacante tiene
  30s de uso antes de que la revocación sea efectiva. Se mitiga con
  rate limit (60/min).
- Simplicidad: TTL fijo, sin invalidation event-based.

**Aceptación del riesgo**: ver §6.

### 3.4. 403 (no 422) para cross-company

**Decisión**: cuando un cliente autenticado intenta actuar sobre una
empresa que no es la suya, retornar 403 Forbidden (NO 422 Unprocessable).

**Por qué**:
- **401 Unauthorized**: el cliente NO se autenticó. (API key ausente,
  inválida o revocada).
- **403 Forbidden**: el cliente SÍ se autenticó, pero no tiene permiso
  sobre el recurso. Esto es authz, no validación de body.
- **422 Unprocessable Entity**: el body está bien formado pero el
  servidor no puede procesarlo por reglas de negocio (ej. idempotency
  conflict, estado inconsistente). NO aplica para cross-company.

**Excepción**: en `GET /:id` y `GET /:id/eventos`, cuando el cliente
intenta acceder a un recurso de OTRA empresa, retornamos **404 (silent)**
en vez de 403. Esto NO filtra la existencia del recurso (un atacante no
puede distinguir entre "no existe" y "existe pero no es tuyo").

### 3.5. `req.id_empresa` autoritativo (nunca del body/query)

**Decisión**: `req.id_empresa` SIEMPRE viene de la identidad
autenticada, NUNCA del body/query. Para el listado, IGNORAR
`?id_empresa=` del query en client mode y FORZAR `req.id_empresa`.

**Por qué**:
- Es la única forma de garantizar que un cliente no puede escapar su
  scope. Si el handler usara `body.id_empresa || query.id_empresa`,
  un atacante podría inyectar cualquier id_empresa.
- `req.id_empresa` es la fuente de verdad autoritativa.

**Caso legacy (deprecation)**: para mantener compatibilidad con K+AIR
durante la migración, en legacy mode el listado USA `?id_empresa=` del
query (sin filtro si no se envía). En client mode, ignora el query y
usa `req.id_empresa`.

---

## 4. Especificación del middleware `requireEmpresaScope`

### 4.1. API

```js
const { requireEmpresaScope } = require('./middleware/authz');

router.post(
  '/sign-requests',
  requireEmpresaScope({
    allowedOperations: ['sign_request:create'],
    // checkIdEmpresa: para multipart (POST /sign-requests), NO se puede
    // usar acá porque multer parsea el body después. El handler hace
    // el check post-parse.
  }),
  uploadPdf(),
  handler,
);
```

### 4.2. Comportamiento (orden de checks)

1. Lee `X-Internal-API-Key`. Si falta → 401 INVALID_API_KEY.
2. Llama `internalClientService.getActiveClientByApiKey(provided)`
   (cache 30s).
3. Si encuentra cliente activo:
   - `req.authSource = 'client'`
   - `req.id_empresa = client.id_empresa`
   - `req.clientOperations = array de ops (parseado de CSV)`
   - Si `allowedOperations` está especificado y la operación NO está
     en `clientOperations` → 403 FORBIDDEN.
4. Si NO encuentra cliente → intenta legacy fallback
   (`internalClientService.lookupLegacyClient`):
   - Si NO match legacy → 401 INVALID_API_KEY.
   - Si match legacy:
     - `req.authSource = 'legacy'`
     - `req.id_empresa = null`
     - `req.clientOperations = ['legacy']`
     - Log deprecation warning.
5. Si `checkIdEmpresa: true` y `authSource === 'client'`:
   - Compara `body.id_empresa` (o `query.id_empresa` o `params.id_empresa`)
     con `req.id_empresa`.
   - Si mismatch → 403 EMPRESA_MISMATCH.
6. `next()`.

### 4.3. Headers de respuesta (no se usan)

El middleware NO agrega headers especiales. El `request_id` viene del
middleware `requestId()` (anterior). Si se necesita correlación
adicional, está en los logs (con `api_key_hash_prefix` para fingerprint
sin filtrar la key completa).

---

## 5. Wiring en routers

### 5.1. `signRequest.js`

| Endpoint | allowedOperations | checkIdEmpresa | Notas |
|---|---|---|---|
| `POST /sign-requests` | `['sign_request:create']` | post-parse en handler | multer parsea body después del middleware |
| `GET /sign-requests/:id` | `['sign_request:read']` | post-lookup (404 silent) | 404 si `signRequest.id_empresa !== req.id_empresa` en client mode |
| `GET /sign-requests` | `['sign_request:read']` | en handler (force `req.id_empresa`) | en legacy mode respeta `?id_empresa=` |

### 5.2. `internal-audit.js`

| Endpoint | allowedOperations | checkIdEmpresa | Notas |
|---|---|---|---|
| `GET /sign-requests/:id/eventos` | `['audit:read']` | post-lookup (404 silent) | igual que GET /:id |
| `POST /sign-requests/:id/revoke` | — (admin) | — | sigue con `adminApiAuth()` |

### 5.3. `consent.js`

| Endpoint | allowedOperations | checkIdEmpresa | Notas |
|---|---|---|---|
| `POST /consentimientos` | `['consent:create']` | `true` (body en JSON) | 403 si mismatch en client mode |
| `POST /consentimientos/:id/verify-otp` | `['consent:verify']` | post-lookup (404 silent) | 404 si consent pertenece a otra empresa |

---

## 6. Riesgos aceptados

### 6.1. Ventana de 30s para revocación

**Riesgo**: si se revoca una key, hay hasta 30s de ventana antes de que
el cache expire y la revocación sea efectiva.

**Mitigación**:
- Rate limit 60/min global (config.rateLimit.perMinute) limita el
  daño en esa ventana.
- Log de deprecation warning + log de revocación permite detectar uso
  post-revocación.
- Se puede reducir el TTL a 5s si la revocación inmediata es crítica
  (decisión operacional).

**Status**: aceptable para v1.

### 6.2. Legacy fallback en producción

**Riesgo**: durante la ventana de deprecation, un cliente con la legacy
key puede actuar sobre CUALQUIER empresa. Eso es lo que estamos
migrando a cerrar.

**Mitigación**:
- El log de deprecation warning es visible (nivel WARN).
- K+AIR debe migrar a claves per-empresa en 1 release.
- Después de la migración, se elimina el fallback legacy.

**Status**: aceptable durante deprecation; se elimina en release futura.

### 6.3. Trust proxy

**Riesgo**: `req.ip` se usa en rate limiting y en logs. Si el proxy
no está configurado correctamente, `req.ip` puede ser falsificado.

**Mitigación**:
- `config.trustProxy` por defecto es `'loopback'` (solo 127.0.0.1, ::1).
- En producción, setear `TRUST_PROXY=<ip-del-proxy>` o `TRUST_PROXY=1`.
- Ver `src/config.js` y `src/middleware/rateLimit.js` para detalles.
- **OBLIGATORIO documentar en SECURITY.md §8** que `TRUST_PROXY` es
  crítico en prod.

---

## 7. Plan de migración para K+AIR

### 7.1. Pasos para K+AIR (operador humano)

1. Por cada empresa cliente, generar 1 API key con `crypto.randomBytes(32).toString('hex')`.
2. Insertar en `gh_internal_clients`:
   ```sql
   INSERT INTO gh_internal_clients (api_key_hash, id_empresa, allowed_operations, description)
   VALUES (?, ?, ?, 'K+AIR empresa X - prod');
   ```
   Donde `api_key_hash = SHA-256(apiKey)`.
3. Actualizar `secrets.enc` en K+AIR con la nueva key.
4. Repetir para cada empresa.

### 7.2. Verificación

- En dev, correr `seedTestClients()` (en tests/helpers.js) que crea
  cliente A (id_empresa=900123456) y cliente B (id_empresa=900999999).
- Tests cross-company en `tests/routes/signRequest-cross-company.test.js`
  verifican el comportamiento.

### 7.3. Rollout

| Release | Acción |
|---|---|
| v0.2.0 (I-010) | Se introduce la tabla + middleware. K+AIR sigue con la legacy key. Legacy mode es permisivo. |
| v0.3.0 | K+AIR migra a keys per-empresa. Legacy mode sigue activo. |
| v0.4.0 (futuro) | Se elimina el fallback legacy. Si llega una key que no está en `gh_internal_clients`, se rechaza con 401. |

---

## 8. Plan para I-008 (rate limiting per-empresa)

I-008 (rate limit per-empresa) se apoyará en `req.id_empresa`
autoritativo. Específicamente, el `internalServerLimiter` se registrará
DESPUÉS de `globalLimiter` con `skip: req => req.path.startsWith('/internal/')`,
y dentro de los routers internos, se usará un limiter keyed por
`req.id_empresa || 'legacy'`.

Esto garantiza que un cliente per-empresa tenga su propio cubo de rate
limit, no compartido con otros clientes.

---

## 9. Tests

- `tests/migration-009.test.js` (4 tests): schema, registry, idempotencia.
- `tests/services/internalClient.test.js` (8 tests): createClient, lookup, revoke, legacy.
- `tests/middleware/authz.test.js` (10 tests): authn + authz + legacy.
- `tests/routes/signRequest-cross-company.test.js` (12 tests): 6 endpoints × 2 direcciones (A→A OK, A→B 403/404).

Total tests I-010: 34 nuevos.
Suite completa al cierre: 354 + 34 = **388 tests, 0 fail**.

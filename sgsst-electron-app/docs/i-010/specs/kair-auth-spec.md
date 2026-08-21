# K+AIR · Spec cliente — Per-empresa API key para firma-service

**Fecha:** 2026-08-20
**Subagente:** B (K+AIR credentials / bridge)
**Estado:** Borrador para revisión (no se ha modificado código)
**Depende de:**
- Diseño arquitectónico: `storage-backup/audit-04-per-empresa-auth-design.md` (AUD-04)
- Diseño backend: `firma-service` per-company admin endpoints (Subagente A, en paralelo)
- Diseño de authz: `docs/gestion-humana/firma-electronica/SECURITY.md` §8 (I-010)
- Diseño de authz cliente: `docs/kair-firma-integration/I-010-design.md`
- Estado actual del bridge: `main/firma-bridge.js` (commit `525d592a`, I-101)
- Estado actual del cliente: `main/firma-client.js` (mismo commit — **no cambia**)

---

## 1. Resumen ejecutivo

K+AIR v0.1.190 (I-101) usa **una sola API key global** para firma-service,
guardada en `secrets.enc` con estructura FLAT. Esto bloquea la migración a
per-company keys (D-13/I-010) ya implementada en backend: el backend rechaza
sign-requests legacy con `IDEMPOTENCY_LEGACY_NOT_SUPPORTED`.

Este spec extiende `firma-bridge.js` para resolver credenciales **por empresa
activa** (no global), introduce 5 nuevos canales IPC `firma:empresa:*`, y
migra silenciosamente el schema de `secrets.enc` v1 → v2. `firma-client.js`
**no se toca**: ya es stateless y recibe `(baseUrl, apiKey, clientInstanceId)`
en el factory. La cache de cliente pasa de global a `Map<idEmpresa, FirmaClient>`.

Compatibilidad hacia atrás: `firma:config:get`, `firma:config:diag` y
`firma:config:set-api-key/set-url` siguen funcionando (deprecation warning),
para no romper K+AIR v0.1.190 hasta que el renderer migre a los canales
`firma:empresa:*`. Se eliminan en v0.1.192+.

---

## 2. Schema de `secrets.enc` v2

### 2.1 Estructura JSON exacta

```jsonc
{
  "version": 2,
  "firmaServiceUrl": "https://firma.k-air.com",
  "firmaServiceClientInstanceId": "550e8400-e29b-41d4-a716-446655440000",

  // Admin token (DR-2, binding). Global, operator-level, una vez por instalación.
  // Se setea vía `firma:config:set-admin-key`. Longitud mínima 32 chars.
  // Sin este campo, los handlers admin (firma:empresa:create, rotate, list-firma-remote)
  // retornan ADMIN_TOKEN_REQUIRED.
  "adminApiKey": "<operator-level token, ≥32 chars>",

  // Mapa per-empresa. La KEY del objeto es el `company_key` de la tabla
  // `companies` (display_name en K+AIR v0.1.190, normalizado lowercase
  // en runtime — ver §3.1).
  "empresas": {
    "TEMPOACTIVA EST S.A.S.": {
      "idEmpresa": "900123456",                // string, nunca null
      "firmaApiKey": "4f8a2c...64hex",         // string ≥32 chars
      "activatedAt": "2026-08-20T15:00:00Z",   // ISO 8601 UTC
      "lastValidatedAt": "2026-08-20T15:00:00Z" // ISO 8601 UTC (última sign OK)
    },
    "OTRA EMPRESA S.A.S.": {
      "idEmpresa": "900999999",
      "firmaApiKey": "...",
      "activatedAt": "...",
      "lastValidatedAt": "..."
    }
  },

  // Reservado: SOLO para migrar v1 → v2 sin perder la key legacy.
  // NO debe usarse en runtime (los handlers per-empresa NUNCA consultan
  // `__legacy__`). Vive acá solo como transporte durante la migración.
  // AUD-04 §9 pregunta 5: opción C (mantener en __legacy__ con warning,
  // eliminar en v3).
  "__legacy__": {
    "firmaApiKey": "4f8a2c...64hex",
    "migratedAt": "2026-08-20T15:00:00Z",
    "warning": "Key legacy migrada desde secrets.enc v1. Reasignar a una empresa con firma:empresa:set-api-key, o borrar con firma:empresa:revoke-api-key."
  }
}
```

### 2.2 Tipos y reglas de validación

| Campo | Tipo | Regla |
|---|---|---|
| `version` | number | Requerido. Debe ser `2`. Si está ausente o es `1`, se ejecuta migración §2.3. |
| `firmaServiceUrl` | string | Requerido. Validado por `_validateUrl` (http/https + hostname). NO trailing slash. |
| `firmaServiceClientInstanceId` | string (UUID v4) | Requerido. Generado por `generateClientInstanceId()` si está ausente en v1. Persiste entre arranques. |
| `adminApiKey` | string | Opcional (DR-2). Si está presente, ≥ 32 chars. Es el `X-Admin-API-Key` que se envía a endpoints admin. Se setea una vez por instalación vía `firma:config:set-admin-key`. Sin este campo, los handlers admin retornan `ADMIN_TOKEN_REQUIRED`. |
| `empresas` | object | Requerido. Puede ser `{}` (instalación recién migrada sin empresas aún). |
| `empresas[name].idEmpresa` | string | Requerido. Es el `id_empresa` (NIT o equivalente, sin puntos ni comas). No se valida formato — backend es la fuente de verdad. |
| `empresas[name].firmaApiKey` | string | Requerido. Mín 32 chars (validado por `_validateApiKey`). Se valida contra backend en `firma:empresa:list-firma-remote`. |
| `empresas[name].activatedAt` | string (ISO 8601) | Opcional pero presente tras set-api-key. Se setea en el momento de creación. |
| `empresas[name].lastValidatedAt` | string (ISO 8601) | Opcional. Se actualiza en cada sign-request exitoso contra el backend. |
| `__legacy__` | object \| null | Solo presente si la migración v1 → v2 encontró una key legacy. Eliminar tras reasignar todas las keys. |

### 2.3 Migración silenciosa v1 → v2

**Trigger:** primer `_readSecrets()` después de upgrade a I-102 que retorna
`{version: 1}` o no tiene `version`.

```js
// Pseudo-código (se ejecuta la primera vez que se lee secrets.enc v1)
function _migrateSecretsV1ToV2() {
  var v1 = _readSecretsRaw();  // lee sin migrar
  if (!v1) return null;        // no hay archivo
  if (v1.version === 2) return v1;  // ya migrado

  // 1) Detección de v1
  if (v1.version === 1 || (!v1.version && v1.firmaServiceApiKey)) {
    var v2 = {
      version: 2,
      firmaServiceUrl: v1.firmaServiceUrl || '',
      firmaServiceClientInstanceId:
        v1.clientInstanceId || _generateClientInstanceIdFn(),
      empresas: {}
    };

    // 2) Mover la key legacy a __legacy__ si existe
    if (v1.firmaServiceApiKey) {
      v2.__legacy__ = {
        firmaApiKey: v1.firmaServiceApiKey,
        migratedAt: new Date().toISOString(),
        warning: 'Key legacy migrada desde v1. Reasignar.'
      };
      console.warn(
        '[' + MOD + '] secrets.enc v1 contenía firmaServiceApiKey. ' +
        'Movida a __legacy__. Use firma:empresa:set-api-key para ' +
        'reasignar a una empresa. idEmpresa NO conocido (debe venir ' +
        'del admin de firma-service).'
      );
    }

    // 3) Persistir v2 cifrado
    var res = _writeSecrets(v2);
    if (!res.ok) {
      console.error('[' + MOD + '] No se pudo persistir v2; ' +
                    'se mantiene v1 en memoria esta sesión.');
      return v1;  // fallback: usar v1 esta sesión, reintentar en próximo boot
    }
    console.info('[' + MOD + '] secrets.enc migrado v1 → v2. ' +
                 'Key legacy en __legacy__ (deprecada).');
    return v2;
  }

  // Schema desconocido: tratarlo como corrupto
  console.warn('[' + MOD + '] secrets.enc con version desconocida:', v1.version);
  return _regenerateSecretsAfterCorruption();
}
```

**Política de "no perder datos"**: si `_writeSecrets` falla (safeStorage
no disponible), la migración retorna `v1` y se reintenta en cada boot.
NUNCA se sobreescribe v1 sin haber escrito v2 antes.

### 2.4 Si el archivo está corrupto

```js
function _regenerateSecretsAfterCorruption() {
  // Borrar el archivo (igual que en v1 — política existente).
  try { fs.unlinkSync(_secretsPath()); } catch (_) {}

  // Persistir v2 vacío (URL vacía + clientId nuevo + sin empresas).
  var fresh = {
    version: 2,
    firmaServiceUrl: '',
    firmaServiceClientInstanceId: _generateClientInstanceIdFn(),
    empresas: {}
  };
  var res = _writeSecrets(fresh);
  if (!res.ok) {
    console.warn('[' + MOD + '] No se pudo regenerar secrets.enc; ' +
                 'modo memoria-only esta sesión.');
    return fresh;  // memoria solamente; cada write intentará de nuevo
  }
  console.warn(
    '[' + MOD + '] secrets.enc estaba corrupto; regenerado vacío. ' +
    'Configure URL + al menos una empresa con firma:empresa:set-api-key.'
  );
  return fresh;
}
```

**Disparadores de "corrupto"**:
- `safeStorage.decryptString` lanza excepción (keyring cambió, OS upgrade, etc.)
- `JSON.parse` lanza (es un blob cifrado con datos viejos)
- Estructura parseada no tiene `version` y no es v1 reconocible

**Comportamiento de la UI**: `firma:config:diag` debe retornar
`{ corruptedAt: '<ISO 8601>', regenerated: true }` para que la UI pueda
mostrar un toast: "Las credenciales de firma se regeneraron por corrupción.
Vuelve a configurar las empresas."

### 2.5 Invariantes

1. **Una sola fuente de verdad**: la versión de secrets.enc en disco es SIEMPRE
   ≥ la versión en memoria. Si en memoria hay v2 y en disco hay v1, el
   siguiente `_readSecrets()` vuelve a v1 (mala suerte, se re-migra). Esto
   puede pasar si dos procesos Electron corren a la vez — fuera de scope v1.

2. **NO concurrencia multi-proceso**: K+AIR es single-instance. No hay
   locks. Si en el futuro hay race (multi-ventana), usar `app.requestSingleInstanceLock()`
   o `proper-lockfile` (decisión fuera de scope I-102).

3. **Atomicidad de escritura**: `_writeSecrets` usa `fs.writeFileSync` que
   en Windows NO es atómico (puede dejar archivo parcial en crash). El
   bridge no maneja esto en v1. Si la app crashea a mitad de escritura,
   el siguiente boot ve "corrupto" y regenera. Trade-off aceptado.

---

## 3. Resolución de config por empresa activa

### 3.1 Pseudo-código de `_resolveConfigForCompany(companyName)`

```js
/**
 * Resuelve la config efectiva para una empresa activa.
 * @param {string} companyName - El company_key normalizado (display_name
 *                               en K+AIR v0.1.190). NO idEmpresa.
 * @returns {object|null}
 *   {
 *     url, apiKey, clientInstanceId, idEmpresa, source,
 *     lastValidatedAt, companyName, companyKey
 *   }
 */
function _resolveConfigForCompany(companyName) {
  if (!companyName || typeof companyName !== 'string') return null;

  // 1) Env vars: NO se implementa per-empresa en v1 (decisión AUD-04).
  //    El modo env (FIRMA_SERVICE_URL + FIRMA_SERVICE_API_KEY) sigue siendo
  //    "global", usado solo en dev/CI. Si hay env, retornamos config global
  //    PERO sin idEmpresa (lo que dispara CONFIG_MISSING en handlers que
  //    requieren scope per-empresa — fail loud).
  if (_hasEnv()) {
    var env = _envConfig();
    return {
      url: env.url,
      apiKey: env.apiKey,
      clientInstanceId: env.clientInstanceId,
      idEmpresa: null,           // <— clave: no hay scope per-empresa en env
      source: 'env-global',
      lastValidatedAt: null,
      companyName: companyName,
      companyKey: _normalizeCompanyKey(companyName)
    };
  }

  // 2) secrets.enc v2
  var s2 = _readSecretsV2();  // lee y migra si hace falta
  if (!s2) {
    // secrets no accesible (safeStorage no disponible, archivo corrupto,
    // etc.) → return null. Caller decide qué hacer.
    return null;
  }

  var empresa = _resolveEmpresa(s2.empresas, companyName);
  if (!empresa) {
    return null;  // empresa no configurada — caller retorna CONFIG_MISSING
  }

  if (!empresa.firmaApiKey || !empresa.idEmpresa) {
    // Empresa presente en el mapa pero con campos requeridos vacíos.
    // Bug guardrail: en condiciones normales, set-api-key garantiza ambos.
    return null;
  }

  return {
    url: s2.firmaServiceUrl,
    apiKey: empresa.firmaApiKey,
    clientInstanceId: s2.firmaServiceClientInstanceId,
    idEmpresa: empresa.idEmpresa,
    source: 'secrets-v2',
    lastValidatedAt: empresa.lastValidatedAt || null,
    companyName: companyName,
    companyKey: _normalizeCompanyKey(companyName)
  };
}

function _resolveEmpresa(empresas, companyName) {
  if (!empresas || typeof empresas !== 'object') return null;
  var normalized = _normalizeCompanyKey(companyName);
  // Lookup case-insensitive sobre las keys del mapa
  for (var k in empresas) {
    if (!Object.prototype.hasOwnProperty.call(empresas, k)) continue;
    if (_normalizeCompanyKey(k) === normalized) return empresas[k];
  }
  return null;
}

function _normalizeCompanyKey(s) {
  return String(s || '').toLowerCase().trim();
}
```

### 3.2 Orden de prioridad

| # | Fuente | Cuándo aplica | idEmpresa |
|---|---|---|---|
| 1 | env vars (`FIRMA_SERVICE_URL` + `FIRMA_SERVICE_API_KEY`) | Dev/CI only. Si está, retorna config global con `idEmpresa: null`. | `null` (no per-empresa) |
| 2 | `secrets.enc` v2 `.empresas[companyName]` | Producción. Lookup case-insensitive. | `empresa.idEmpresa` |
| 3 | `secrets.enc` v1 `firmaServiceApiKey` (legacy) | **NO se usa en v2** (migrado a `__legacy__`). | — |
| 4 | Missing | Empresa no está en `.empresas` o el archivo no se puede leer. | — |

**Decisión:** NO hay fallback cross-company. Si la Empresa A no tiene key
configurada, el bridge **NO** usa la key de la Empresa B. Retorna
`CONFIG_MISSING_FOR_COMPANY` con `availableCompanies` para que la UI
muestre un mensaje claro.

### 3.3 Comportamiento cuando empresa activa no tiene key

```js
// En _handlerSignRequestCreate (y todos los demás firma:* con scope per-empresa)
function _requireClientForCompany(companyName) {
  if (!companyName) {
    return {
      ok: false,
      response: _err('COMPANY_REQUIRED', 'companyName es requerido para firma:*')
    };
  }
  var cfg = _resolveConfigForCompany(companyName);
  if (!cfg) {
    return {
      ok: false,
      response: _err('CONFIG_MISSING_FOR_COMPANY',
        'Firma electrónica no configurada para esta empresa.',
        {
          currentCompany: companyName,
          hint: 'Use firma:empresa:list para ver qué empresas están ' +
                'configuradas, y firma:empresa:set-api-key para configurar.',
          remediationIpc: 'firma:empresa:set-api-key'
        })
    };
  }
  if (cfg.idEmpresa === null) {
    // Modo env (sin scope per-empresa) — bloquear llamadas con scope.
    return {
      ok: false,
      response: _err(
        'CONFIG_NOT_PER_COMPANY',
        'FIRMA_SERVICE_API_KEY en env es global y no tiene scope per-empresa. ' +
        'Migre a secrets.enc v2 con firma:empresa:set-api-key.',
        {
          currentCompany: companyName,
          source: cfg.source,
          hint: 'Quite FIRMA_SERVICE_API_KEY del .env y use ' +
                'firma:empresa:set-api-key desde la UI.'
        })
    };
  }

  // 3) Cache lookup
  var r = _getClientForCompany(cfg);
  if (!r.client) {
    return {
      ok: false,
      response: _err('CLIENT_INIT_FAILED', 'No se pudo inicializar cliente firma-service.', {
        idEmpresa: cfg.idEmpresa,
        url: cfg.url
      })
    };
  }
  return { ok: true, client: r.client, config: cfg };
}
```

### 3.4 Modificación de handlers existentes

Los 9 handlers firma:* que reciben `companyName` (auditados abajo) cambian
de `_requireClient()` a `_requireClientForCompany(companyName)`:

| Handler | ¿Recibe companyName? | Cambio |
|---|---|---|
| `firma:config:get` | NO | No cambia. Es config global. |
| `firma:config:set-api-key` | NO | **Deprecado**. Ver §6. |
| `firma:config:set-url` | NO | No cambia. |
| `firma:config:diag` | NO | No cambia. |
| `firma:sign-request:create` | **SÍ (nuevo arg)** | `args.companyName` requerido. |
| `firma:sign-request:get` | **SÍ (nuevo arg)** | `args.companyName` requerido. |
| `firma:sign-request:list` | **SÍ (nuevo arg)** | `args.companyName` requerido. |
| `firma:sign-request:document` | **SÍ (nuevo arg)** | `args.companyName` requerido. |
| `firma:sign-request:constancia` | **SÍ (nuevo arg)** | `args.companyName` requerido. |
| `firma:sign-request:link` | **SÍ (nuevo arg)** | `args.companyName` requerido. |
| `firma:consent:create` | **SÍ (en args.id_empresa NO basta)** | `args.companyName` requerido (id_empresa se valida contra cfg.idEmpresa). |
| `firma:consent:verify-otp` | **SÍ (nuevo arg)** | `args.companyName` requerido (se busca en el cache de clientes). |
| `firma:agreement:get` | NO | No cambia. |

**Decisión sobre `consent:create`**: el handler ya recibe
`id_empresa, id_trabajador, version_acuerdo, correo_verificacion`. El
`id_empresa` del body DEBE coincidir con `cfg.idEmpresa` resuelto desde
`companyName`. Si no coincide → `EMPRESA_MISMATCH` (403-like, sin revelar
existencia).

**Ejemplo de enforcement**:
```js
function _handlerConsentCreate(args) {
  args = args || {};
  if (!args.companyName) {
    return _err('INVALID_REQUEST_BODY', 'companyName requerido');
  }
  if (!args.id_trabajador || !args.id_empresa || !args.version_acuerdo || !args.correo_verificacion) {
    return _err('INVALID_REQUEST_BODY',
      'id_trabajador, id_empresa, version_acuerdo, correo_verificacion requeridos');
  }
  var r = _requireClientForCompany(args.companyName);
  if (!r.ok) return r.response;

  // CROSS-COMPANY GUARD: el id_empresa del body NO puede diferir del cfg
  if (args.id_empresa !== r.config.idEmpresa) {
    return _err('EMPRESA_MISMATCH',
      'id_empresa del body no coincide con la empresa activa.',
      {
        activeCompany: args.companyName,
        activeIdEmpresa: r.config.idEmpresa,
        bodyIdEmpresa: args.id_empresa
      });
  }
  return r.client.createConsent({
    id_trabajador: args.id_trabajador,
    id_empresa: args.id_empresa,
    version_acuerdo: args.version_acuerdo,
    correo_verificacion: args.correo_verificacion,
    kair_version: args.kair_version || _appVersion
  });
}
```

### 3.5 Reglas de validación extra (cliente)

1. **`companyName` requerido en TODA llamada con scope**: si el renderer
   olvida pasarlo, retornar `COMPANY_REQUIRED` con hint ("¿Olvidaste
   pasar la empresa activa?"). **No fallar silenciosamente** ni caer
   en un default.

2. **Case-insensitive lookup**: el renderer puede enviar
   `"TEMPOACTIVA EST S.A.S."` o `"TempoActiva Est S.A.S."`. El bridge
   normaliza y busca. Esto matchea la convención existente en
   `gestion-humana-bridge.js:58-66` (`_getCompanyByName`).

3. **Rechazar `__legacy__` como empresa activa**: si el renderer envía
   `__legacy__` como companyName, retornar `INVALID_REQUEST_BODY`
   (`__legacy__` es palabra reservada interna).

---

## 4. Cache de clientes per-empresa

### 4.1 Estructura del `Map<idEmpresa, FirmaClient>`

```js
// Estado módulo-level (reemplaza _cachedClient y _cachedClientConfigKey)
var _cachedClientsByEmpresa = new Map();  // idEmpresa (string) → FirmaClient
var _cachedConfigByEmpresa   = new Map();  // idEmpresa → config (para invalidación)

// Capacidad máxima. 50 empresas cubre K+AIR v1 holgadamente.
// Documentado en AGENTS.md y en este spec para que Subagente C (tests)
// pueda diseñar el edge case.
var MAX_CACHED_COMPANIES = 50;

function _getClientForCompany(cfg) {
  // cfg viene de _resolveConfigForCompany (ya con idEmpresa, apiKey, etc.)
  if (!cfg || !cfg.idEmpresa) return { client: null, config: cfg };

  // 1) Cache hit
  if (_cachedClientsByEmpresa.has(cfg.idEmpresa)) {
    // Validar que la key no cambió (rotación / set-api-key debe haber
    // invalidado, pero si alguien escribe a secrets.enc sin invalidar,
    // al menos detectamos el cambio de key aquí).
    var cachedCfg = _cachedConfigByEmpresa.get(cfg.idEmpresa);
    if (cachedCfg && cachedCfg.apiKey === cfg.apiKey) {
      return { client: _cachedClientsByEmpresa.get(cfg.idEmpresa), config: cfg };
    }
    // Key cambió sin invalidar: invalidar ahora y continuar
    _invalidateClientCacheForEmpresa(cfg.idEmpresa);
  }

  // 2) Cache miss → crear nuevo
  var client = _clientFactory({
    baseUrl: cfg.url,
    apiKey: cfg.apiKey,
    clientInstanceId: cfg.clientInstanceId,
    appVersion: _appVersion
  });

  // 3) Capacidad: si excede MAX, evict LRU (primer key del Map)
  if (_cachedClientsByEmpresa.size >= MAX_CACHED_COMPANIES &&
      !_cachedClientsByEmpresa.has(cfg.idEmpresa)) {
    var firstKey = _cachedClientsByEmpresa.keys().next().value;
    _invalidateClientCacheForEmpresa(firstKey);
    console.warn('[' + MOD + '] Cache de clientes per-empresa lleno (' +
                 MAX_CACHED_COMPANIES + '); evicted ' + firstKey);
  }

  _cachedClientsByEmpresa.set(cfg.idEmpresa, client);
  _cachedConfigByEmpresa.set(cfg.idEmpresa, {
    apiKey: cfg.apiKey,
    url: cfg.url,
    lastResolvedAt: new Date().toISOString()
  });
  return { client, config: cfg };
}

function _invalidateClientCacheForEmpresa(idEmpresa) {
  if (!idEmpresa) {
    // Invalidate ALL
    _cachedClientsByEmpresa.clear();
    _cachedConfigByEmpresa.clear();
    return;
  }
  _cachedClientsByEmpresa.delete(idEmpresa);
  _cachedConfigByEmpresa.delete(idEmpresa);
}
```

### 4.2 Política de eviction

- **LRU simple** (Map preserva orden de inserción): el primer key es el
  más viejo. Al insertar uno nuevo que excede el cap, evict el primero.
- **Por qué LRU y no LFU**: K+AIR típico tiene 1-3 empresas activas. Si
  llega a 50, es operador con N empresas; el patrón natural es ciclar
  entre unas pocas a la vez. LRU es correcto.
- **Por qué cap 50**: holgura para 10x crecimiento realista sin caer
  en memory bouned. Cada FirmaClient en memoria son ~5 KB (factory
  closure, headers cache). 50 × 5 KB = 250 KB. Insignificante.
- **Logging**: cuando evict ocurre, log con WARN. Si pasa frecuentemente,
  indica que el cap es muy bajo (no se espera que pase, pero es señal
  de problema).

### 4.3 Memory bounds

| Componente | Memoria | Notas |
|---|---|---|
| `Map<idEmpresa, FirmaClient>` | N × ~5 KB | N ≤ 50 (cap) |
| `Map<idEmpresa, cfgResumen>` | N × ~200 B | N ≤ 50 |
| `secrets.enc` descifrado en memoria | ~2 KB | Solo durante `_readSecrets()`, se descarta tras `_writeSecrets` |
| `__legacy__` en memoria | ~200 B | Solo presente post-migración v1 → v2 |

**Total peor caso**: ~300 KB. K+AIR consume ~300 MB en runtime actual
(verificado con `process.memoryUsage()` en track A baseline). 0.1% — no
es un problema.

### 4.4 Cuándo se invalida

Ver §8 (lista completa de invalidaciones con race analysis).

---

## 5. Detalle de cada IPC nuevo

Convención: input/output en **camelCase** (igual que los actuales).
Errores retornan `{ success: false, error: { code, message, extra? } }`.
Éxito retorna `{ success: true, data: {...} }`.

### 5.1 `firma:empresa:list`

Lista todas las empresas conocidas (de la tabla `companies` JOIN con
`secrets.enc.empresas`).

**Input**: ninguno (o `args.includeUnconfigured: boolean`).

**Output**:
```js
{
  success: true,
  data: {
    // Empresas CON key configurada
    configured: [
      {
        companyKey: 'TEMPOACTIVA EST S.A.S.',     // company_key de DB
        idEmpresa: '900123456',
        activatedAt: '2026-08-20T15:00:00Z',
        lastValidatedAt: '2026-08-20T15:00:00Z'
      }
    ],
    // Empresas SIN key configurada (K+AIR las conoce pero no tienen firma)
    available: [
      { companyKey: 'EMPRESA NUEVA S.A.S.', idEmpresa: null }
    ],
    // ¿Hay key legacy pendiente de reasignar?
    hasLegacyKey: false,
    legacyWarning: null,  // string si hasLegacyKey=true
    // URL global (de config, no per-empresa)
    firmaServiceUrl: 'https://firma.k-air.com',
    clientInstanceId: '550e8400-...',
    source: 'mixed',  // 'all-configured' | 'none-configured' | 'mixed'
    encryptionAvailable: true
  }
}
```

**Errores**:
- `INTERNAL` (500) — error leyendo secrets.enc o DB

**Comportamiento sin safeStorage**:
- `encryptionAvailable: false`
- `configured: []`, `available: [...]` (de DB)
- `hasLegacyKey: false` (no podemos leer lo que no desciframos)

**Comportamiento sin admin token**: N/A (este endpoint no usa admin
token — solo lee local).

**Ejemplo de uso desde el renderer**:
```js
const list = await window.electronAPI.firmaEmpresaList();
const configuredKeys = list.data.configured.map(c => c.companyKey);
// Render: "Firma configurada para: TEMPOACTIVA, OTRA"
// Render: "⚠️ Falta configurar: EMPRESA NUEVA"
```

### 5.2 `firma:empresa:set-api-key`

Setea la key per-empresa para una empresa. **Idempotente** (sobreescribe
si ya existe). Acepta tanto keys pre-generadas externamente (paste) como
keys generadas por el admin en el backend (que es el caso común).

**Input**:
```js
{
  companyName: 'TEMPOACTIVA EST S.A.S.',  // REQUERIDO
  idEmpresa: '900123456',                 // REQUERIDO (del admin de firma-service)
  firmaApiKey: '4f8a2c...64hex',          // REQUERIDO, ≥32 chars
  // Opcional: validar contra backend inmediatamente
  validateRemote: true                    // default: false
}
```

**Output (success)**:
```js
{
  success: true,
  data: {
    stored: true,
    encryptionAvailable: true,
    companyKey: 'TEMPOACTIVA EST S.A.S.',
    idEmpresa: '900123456',
    activatedAt: '2026-08-20T15:00:00Z',
    // Si validateRemote=true y se validó OK:
    lastValidatedAt: '2026-08-20T15:00:00Z',
    remoteValidation: { ok: true }
  }
}
```

**Errores**:
- `INVALID_REQUEST_BODY` — campos requeridos faltantes o key < 32 chars
- `ENCRYPTION_UNAVAILABLE` — safeStorage no disponible
- `COMPANY_NOT_FOUND` — el `companyName` no está en la tabla `companies` (de DB local)
- `REMOTE_VALIDATION_FAILED` — `validateRemote=true` y el backend rechazó la key
  - extra: `{ backendError: { code, message } }`
- `INTERNAL` — error escribiendo secrets.enc

**Comportamiento sin safeStorage**:
- Retorna `ENCRYPTION_UNAVAILABLE` con hint:
  ```
  safeStorage no disponible. Configure FIRMA_SERVICE_API_KEY_900123456 en env.
  ```
  (Nota: v1 NO soporta env per-empresa. Solo se documenta como work-around
  para dev/CI. El handler retorna error y la UI debe pedir al usuario
  configurar un keyring OS.)

**Comportamiento sin admin token**: N/A (este handler NO contacta el
admin endpoint; solo escribe local. La key DEBE venir ya generada).

**Ejemplo de uso desde el renderer (paste de key pre-existente)**:
```js
await window.electronAPI.firmaEmpresaSetApiKey({
  companyName: 'TEMPOACTIVA EST S.A.S.',
  idEmpresa: '900123456',
  firmaApiKey: promptUserForKey()
});
```

**Ejemplo con `validateRemote: true`** (usado después de generar la key
vía admin endpoint, para confirmar que la key funciona):
```js
const r = await window.electronAPI.firmaEmpresaSetApiKey({
  companyName: 'TEMPOACTIVA EST S.A.S.',
  idEmpresa: '900123456',
  firmaApiKey: keyGeneradaPorAdmin,
  validateRemote: true  // pide a firma-service: GET /internal/admin/clientes
});
if (r.success) {
  showToast('Key configurada y validada contra firma-service');
} else if (r.error.code === 'REMOTE_VALIDATION_FAILED') {
  showError('El backend rechazó la key: ' + r.error.extra.backendError.message);
}
```

### 5.3 `firma:empresa:rotate-api-key`

Rota la key de una empresa. Requiere el **admin token** del backend
(configurado vía env `FIRMA_SERVICE_ADMIN_API_KEY` o futuro IPC admin).

**Input**:
```js
{
  companyName: 'TEMPOACTIVA EST S.A.S.',  // REQUERIDO
  // El idEmpresa se resuelve del secrets.enc actual (no se pasa)
}
```

**Output (success)**:
```js
{
  success: true,
  data: {
    rotated: true,
    companyKey: 'TEMPOACTIVA EST S.A.S.',
    idEmpresa: '900123456',
    // La nueva key, retornada UNA SOLA VEZ en plaintext
    newApiKey: 'a1b2c3...64hex',
    activatedAt: '2026-08-20T16:00:00Z',
    // Advertencia: la key ANTERIOR queda revocada en el backend
    previousKeyRevoked: true
  }
}
```

**Errores**:
- `INVALID_REQUEST_BODY` — campos faltantes
- `COMPANY_NOT_CONFIGURED` — la empresa no tiene key actual en secrets.enc
- `ADMIN_TOKEN_REQUIRED` — no hay `FIRMA_SERVICE_ADMIN_API_KEY` configurado
  - extra: `{ remediationEnvVar: 'FIRMA_SERVICE_ADMIN_API_KEY' }`
- `BACKEND_REJECTED_ROTATION` — el backend rechazó (key no existe, etc.)
  - extra: `{ backendError: { code, message } }`
- `INTERNAL`

**Comportamiento sin safeStorage**:
- `ENCRYPTION_UNAVAILABLE` — no podemos guardar la nueva key

**Comportamiento sin admin token**:
- `ADMIN_TOKEN_REQUIRED` con hint claro. La UI debe mostrar un modal
  pidiendo el admin token (que NO persiste — solo para esta operación).

**Corte inmediato (sin grace period)**: AUD-04 §9 pregunta 3 recomienda
corte inmediato en v1. La key vieja se marca como revocada en
`gh_internal_clients.revoked_at` y K+AIR deja de usarla inmediatamente.

**Ejemplo**:
```js
const r = await window.electronAPI.firmaEmpresaRotateApiKey({
  companyName: 'TEMPOACTIVA EST S.A.S.'
});
if (r.success) {
  // CRÍTICO: la UI debe mostrar `newApiKey` al usuario UNA vez y nunca más
  // (no la loggea, no la guarda en clipboard, etc.)
  showModal({
    title: 'Key rotada',
    body: 'Guarda esta nueva key en un lugar seguro. NO se mostrará de nuevo:\n\n' + r.data.newApiKey,
    confirmText: 'Ya la guardé'
  });
}
```

### 5.4 `firma:empresa:revoke-api-key`

Borra la key de una empresa en secrets.enc. La key sigue activa en
firma-service hasta que se implemente el endpoint DELETE
`/internal/admin/clientes/:id` (futuro, v2 del backend).

**Input**:
```js
{
  companyName: 'TEMPOACTIVA EST S.A.S.',  // REQUERIDO
  // Opcional: revocar también en backend (requiere admin token)
  revokeRemote: true                      // default: false
}
```

**Output (success)**:
```js
{
  success: true,
  data: {
    revoked: true,
    companyKey: 'TEMPOACTIVA EST S.A.S.',
    // Si revokeRemote=true
    remoteRevocation: {
      ok: true,
      revokedAt: '2026-08-20T16:00:00Z'
    }
  }
}
```

**Errores**:
- `INVALID_REQUEST_BODY` — campos faltantes
- `COMPANY_NOT_CONFIGURED` — la empresa no tiene key actual (idempotente: ya borrada)
- `ADMIN_TOKEN_REQUIRED` (si `revokeRemote: true`)
- `BACKEND_REJECTED_REVOCATION`
- `INTERNAL`

**Comportamiento sin safeStorage**: `ENCRYPTION_UNAVAILABLE`

**Ejemplo**:
```js
// Local-only (key sigue activa en backend)
await window.electronAPI.firmaEmpresaRevokeApiKey({
  companyName: 'TEMPOACTIVA EST S.A.S.'
});

// Full revocation (requiere admin token)
await window.electronAPI.firmaEmpresaRevokeApiKey({
  companyName: 'TEMPOACTIVA EST S.A.S.',
  revokeRemote: true
});
```

### 5.5 `firma:empresa:list-firma-remote`

Lista los per-company clients en firma-service. **Admin-only** (requiere
admin token). Usado para reconciliación: "lo que tengo en K+AIR vs lo que
está en backend".

**Input**:
```js
{
  // Opcional: filtrar por id_empresa
  idEmpresa: '900123456'  // string
}
```

**Output (success)**:
```js
{
  success: true,
  data: {
    clients: [
      {
        idEmpresa: '900123456',
        description: 'K+AIR empresa 900123456 - prod',
        allowedOperations: ['sign_request:create', 'sign_request:read', ...],
        createdAt: '2026-08-20T15:00:00Z',
        revokedAt: null  // o ISO 8601 si revocada
      }
    ],
    // Total remoto y conteos
    totalActive: 1,
    totalRevoked: 0
  }
}
```

**Importante**: este endpoint NUNCA retorna `api_key` en plaintext
(solo el cliente puede verla cuando la crea/rota, y solo una vez).

**Errores**:
- `ADMIN_TOKEN_REQUIRED`
- `BACKEND_ERROR` — error genérico del backend
- `INTERNAL`

**Ejemplo**:
```js
// Reconciliación
const remote = await window.electronAPI.firmaEmpresaListFirmaRemote();
const local = await window.electronAPI.firmaEmpresaList();
const remoteEmpresas = new Set(remote.data.clients.map(c => c.idEmpresa));
const localEmpresas = new Set(local.data.configured.map(c => c.idEmpresa));
const drift = [...localEmpresas].filter(e => !remoteEmpresas.has(e));
if (drift.length) showWarning(`Empresas locales sin registro remoto: ${drift.join(', ')}`);
```

### 5.6 `firma:empresa:create` (DR-3 + DR-6.A/B/C, binding)

Crea un nuevo per-company client en firma-service usando el admin token,
y guarda la `api_key` retornada directamente en `secrets.enc.empresas[empresaKey]`.
El renderer **nunca** ve el plaintext de la api_key.

**Input**:
```js
{
  companyName: 'TEMPOACTIVA EST S.A.S.',  // REQUERIDO (debe existir en tabla `companies`)
  idEmpresa: '900123456',                 // REQUERIDO (NIT)
  displayName: 'TEMPOACTIVA EST S.A.S.'   // REQUERIDO (display name humano)
}
```

**Pre-condiciones (chequeadas por el bridge ANTES de llamar al backend):**
1. `secrets.enc.adminApiKey` debe estar configurado. Si no → `ADMIN_TOKEN_REQUIRED`
   con `extra.remediationHint: 'firma:config:set-admin-key'`.
2. `secrets.enc.empresas[companyName]` NO debe existir. Si existe →
   `ALREADY_CONFIGURED` (DR-6.C) con `extra.suggestion: 'Use firma:empresa:rotate-api-key to rotate the existing key'`.
   Esta verificación evita round-trips innecesarios y previene la
   destrucción accidental de una key en uso.
3. `companyName` debe existir en la tabla `companies` de K+AIR. Si no →
   `COMPANY_NOT_FOUND`.

**Mapeo en el bridge (DR-6.A, binding):**

El bridge construye el `description` con el patrón:
```js
var description = `K+AIR empresa ${args.displayName} - ${config.env}`;
// Truncar a 200 chars (límite del schema zod en backend)
if (description.length > 200) {
  description = description.slice(0, 197) + '...';
}
```

**Inyección de `allowed_operations` (DR-6.B, binding):**

El bridge SIEMPRE envía los 5 valores del enum I-010:
```js
var body = {
  id_empresa: args.idEmpresa,
  allowed_operations: [
    'sign_request:create',
    'sign_request:read',
    'consent:create',
    'consent:verify',
    'audit:read'
  ],
  description: description
};
```

El bridge **NO** acepta `allowed_operations` del renderer. Si el renderer
lo manda, se ignora silenciosamente con un WARN loggeado.

**Llamada HTTP al backend:**
```js
var response = await firmaClient.adminCreateClient({
  adminApiKey: secrets.adminApiKey,  // X-Admin-API-Key
  body: body
});
// response.data.api_key — el bridge la guarda en secrets.enc
// response.data.api_key_hash_prefix — 8 chars, lo que se retorna al renderer
```

**Output (success):**
```js
{
  success: true,
  data: {
    created: true,
    companyKey: 'TEMPOACTIVA EST S.A.S.',
    idEmpresa: '900123456',
    apiKeyHashPrefix: '5d41402a',  // 8 chars, NUNCA la key completa
    activatedAt: '2026-08-20T16:00:00Z'
  }
}
```

**Errores:**
- `ADMIN_TOKEN_REQUIRED` (sin adminApiKey en secrets.enc) — sin llamada al backend.
- `ALREADY_CONFIGURED` (DR-6.C, empresa ya en secrets.enc) — sin llamada al backend.
- `COMPANY_NOT_FOUND` (companyName no existe en tabla `companies`) — sin llamada al backend.
- `BACKEND_REJECTED` (error propagado del backend, ej. 409 CLIENT_EXISTS_FOR_EMPRESA
  si hay drift entre secrets.enc y backend) — `extra.backendError: {code, message}`.
- `INTERNAL` (error inesperado, ej. safeStorage no disponible).

**Efectos secundarios en secrets.enc:**
- INSERT en `secrets.enc.empresas[companyName]`:
  ```json
  {
    "idEmpresa": "900123456",
    "firmaApiKey": "<api_key del response>",  // NUNCA se loguea
    "activatedAt": "<now ISO 8601>",
    "lastValidatedAt": null  // se setea tras primer sign request exitoso
  }
  ```

**Logging:**
- INFO: `Per-company client creado via bridge. id_empresa=X, hash_prefix=Y, display_name=Z`.
- NUNCA se loguea `api_key` en plaintext (regla de oro del backend, también del bridge).

**Ejemplo de uso desde el renderer:**
```js
// Modal "Configurar firma" Opción B
const result = await window.electronAPI.firmaEmpresaCreate({
  companyName: currentCompany.name,
  idEmpresa: '900123456',
  displayName: currentCompany.displayName
});
if (result.success) {
  showToast(`Firma configurada para ${result.data.companyKey}`);
  // El admin nunca ve la key
} else if (result.error.code === 'ALREADY_CONFIGURED') {
  showError('Esta empresa ya tiene firma. Use "Rotar" para cambiar la key.');
}
```

### 5.7 `firma:config:set-admin-key` (DR-2, binding)

Setea el `adminApiKey` global persistido en `secrets.enc.adminApiKey`.
**Una vez por instalación** — el operador lo configura y no se vuelve a
pedir (excepto si se rota).

**Input**:
```js
{
  adminApiKey: '<string ≥32 chars>'  // REQUERIDO
}
```

**Validación:**
- Longitud mínima: 32 chars (recomendación: 64 hex chars generados con
  `crypto.randomBytes(32).toString('hex')` en el servidor).
- No se hace validación de prefijo — el admin token es un secreto
  operator-level, no tiene prefijo público.

**Pre-condiciones:**
- `safeStorage` debe estar disponible. Si no → `ENCRYPTION_UNAVAILABLE`.

**Output (success):**
```js
{
  success: true,
  data: {
    stored: true,
    encryptionAvailable: true,
    adminKeyHashPrefix: '5d41402a'  // 8 chars del SHA-256 del adminApiKey,
                                    // para que el operador verifique sin
                                    // exponer el secreto
  }
}
```

**Errores:**
- `INVALID_REQUEST_BODY` (adminApiKey < 32 chars o ausente).
- `ENCRYPTION_UNAVAILABLE` (safeStorage no disponible en el OS).
- `INTERNAL` (error inesperado al escribir secrets.enc).

**Efectos secundarios en secrets.enc:**
- UPDATE / INSERT del campo `adminApiKey` (cifrado con safeStorage).
- El campo se persiste en el archivo `secrets.enc` v2.

**Logging:**
- INFO: `adminApiKey configurado. hash_prefix=Y, source=set-admin-key`.
- NUNCA se loguea el plaintext.

**Cuándo se llama:**
- Una vez al instalar K+AIR (configuración inicial).
- Si se rota el admin token (operación rara, operator-level).
- NO se llama en cada operación admin — se lee desde secrets.enc cada vez.

**Importante:** este IPC es el ÚNICO que puede escribir `adminApiKey`.
No hay `firma:config:rotate-admin-key` separado — el operador simplemente
llama `set-admin-key` con el nuevo valor (sobrescribe).

---

## 6. Compatibilidad con código legacy

### 6.1 `firma:config:set-api-key` (DEPRECADO)

**Comportamiento nuevo (v2)**:
- **Acepta** la llamada (no rompe K+AIR v0.1.190)
- Escribe la key en `empresas["__default__"]` con un **idEmpresa
  sintético** `__default__` y `activatedAt: now`
- Loggea WARN: `DEPRECATION: firma:config:set-api-key usado. Migre a firma:empresa:set-api-key.`
- Retorna: `{ success: true, data: { stored: true, deprecationWarning: '...' } }`

**Por qué no retornar error**: porque el código del renderer v0.1.190
llama a este handler tras set-url, y un error rompería el flujo. Mejor
aceptar con warning que fallar.

**Cuándo se elimina**: K+AIR v0.1.192+ (próximo commit post-migración
de renderer). En esa versión, retornar `ERR_DEPRECATED` con
`remediationIpc: 'firma:empresa:set-api-key'`.

### 6.2 `firma:config:set-url` (sin cambios)

Sigue funcionando idéntico a v1 (es global, no per-empresa).

### 6.3 `firma:config:get` (extendido)

**Output nuevo (v2) — campos extra**:
```js
{
  success: true,
  data: {
    // Existentes (v1)
    url, hasApiKey, hasUrl, encryptionAvailable, source, clientInstanceId,
    // Nuevos (v2) — para que la UI legacy tenga info mínima
    schemaVersion: 2,           // 1 si v1 no migrado
    empresaActiva: {
      companyKey: 'TEMPOACTIVA EST S.A.S.',
      configured: true,
      idEmpresa: '900123456'
    },                          // null si no se puede resolver
    hasLegacyKey: false         // true si __legacy__ presente
  }
}
```

**Comportamiento**:
- `firma:config:get` ya NO resuelve por empresa (es global). Para tener
  info per-empresa, usar `firma:empresa:list`.
- `empresaActiva` se calcula solo si el renderer pasa `args.companyName`
  (nuevo arg opcional). Si no, retorna `null`.

**Por qué se agrega `schemaVersion` y `empresaActiva`**: el renderer
v0.1.190 llama a `firma:config:get` para mostrar "estado de firma". Si
queremos que muestre "no configurada para empresa X" sin que tenga que
aprender los nuevos IPCs, este endpoint agrega esos campos opcionales.

### 6.4 `firma:config:diag` (extendido, igual a `firma:empresa:list`)

**Output nuevo**:
```js
{
  // Existentes
  url, clientInstanceId, hasApiKey, hasUrl, encryptionAvailable,
  env: { hasUrl, hasApiKey, hasClientId },
  secretsPath, secretsExists, source, version: '1.0.0',
  // Nuevos
  schemaVersion: 2,
  configuredEmpresas: 2,        // count
  availableEmpresas: 3,         // count (DB - configured)
  hasLegacyKey: false,
  cacheStats: {
    size: 2,
    maxSize: 50
  }
}
```

**No retorna** la lista completa (eso es `firma:empresa:list`).
Solo conteos para diagnóstico rápido.

### 6.5 Cuándo se eliminan los canales legacy

| Canal | K+AIR v0.1.191 (I-102) | K+AIR v0.1.192+ |
|---|---|---|
| `firma:config:set-api-key` | Acepta + WARN + escribe a `__default__` | Retorna `ERR_DEPRECATED` con hint |
| `firma:config:set-url` | Sin cambios | Sin cambios (siempre válido) |
| `firma:config:get` | Sin campos extra (compat) | Sin campos extra |
| `firma:config:diag` | Campos extra | Sin campos extra |

**Decisión**: NO eliminar `firma:config:set-api-key` en I-102. Solo
agregar `deprecationWarning` y escribir a `__default__`. Eliminación en
la versión siguiente, cuando el renderer ya no lo use.

---

## 7. Migración de K+AIR al primer boot con secrets v1

### 7.1 Flujo completo

```
1. K+AIR v0.1.190 (I-101) corriendo con secrets.enc v1
   - secrets.enc: { version: 1, firmaServiceApiKey: 'xxx', ... }
   - Renderer llama firma:config:get, firma:config:set-api-key
2. Upgrade a K+AIR v0.1.191 (I-102)
3. Primer boot post-upgrade:
   a. main.js carga firma-bridge (sin cambios en registro)
   b. Primer IPC que toca secrets: ej. renderer llama firma:config:get
   c. firma-bridge._readSecrets() detecta v1
   d. Ejecuta _migrateSecretsV1ToV2() (§2.3)
   e. Mueve firmaServiceApiKey a __legacy__
   f. Persiste v2 en disco
   g. Loggea WARN: "Key legacy migrada. Use firma:empresa:set-api-key."
4. Renderer recibe config:get con schemaVersion=2 y hasLegacyKey=true
5. UI muestra banner: "Tiene una key legacy. Reasígnela a una empresa."
6. User abre modal, selecciona empresa, pega key (o genera via admin)
7. Llama firma:empresa:set-api-key({ companyName, idEmpresa, firmaApiKey: <la legacy> })
8. secrets.enc ahora tiene: { empresas: { TEMPOACTIVA: {...} }, __legacy__: { ... } }
9. User llama firma:empresa:revoke-api-key({ companyName: '__legacy__' })
   - NO: __legacy__ no es companyName válido
   - Solución: handler especial `firma:empresa:clear-legacy` (ver §7.4)
```

### 7.2 ¿Qué pasa con la key legacy?

| Escenario | Acción |
|---|---|
| User reasigna a una empresa | `empresas[name]` se crea; `__legacy__` sigue presente pero con warning |
| User decide no usarla | `__legacy__` se mantiene con warning; user la ignora |
| User quiere borrarla | Nuevo handler `firma:empresa:clear-legacy` (§7.4) |

**No se borra automáticamente** porque:
- Puede que el user quiera consultar la key legacy antes de reasignarla
- Puede que tenga varias empresas y quiera reasignar la misma key a varias
  (no recomendado, pero decisión del user)
- Auto-borrar destruye datos sin consentimiento

### 7.3 Cómo la UI sabe que tiene que reasignar

```js
// Al boot, en algún useEffect del root component
const r = await window.electronAPI.firmaConfigGet();
if (r.data.hasLegacyKey) {
  setShowLegacyBanner(true);
  // Banner: "Tiene una key legacy sin asignar a empresa. [Reasignar] [Borrar]"
}
```

### 7.4 `firma:empresa:clear-legacy` (handler adicional)

**No listado en AUD-04 §4** — propuesta para agregar.

**Input**: ninguno.

**Output**:
```js
{
  success: true,
  data: { cleared: true }
}
```

**Comportamiento**:
- Lee `__legacy__` actual
- Lo borra de secrets.enc (writeSecrets sin ese campo)
- Loggea INFO: `legacy key cleared (id_empresa destino desconocido, decisión del user)`
- Invalida cache (defensivo, aunque `__legacy__` nunca se cachea)

**Por qué agregarlo**: completar el ciclo de vida. Sin él, el user queda
con `__legacy__` eterno. AUD-04 §9 pregunta 5 no lo contempló.

**Decisión**: **agregar** este handler. Es trivial, completa el flujo.

### 7.5 `__legacy__` en runtime (NO se usa)

**Regla de oro**: `_resolveConfigForCompany()` NUNCA consulta `__legacy__`.
Solo `empresas`. Si el renderer pide una empresa que no está en `empresas`,
retorna `CONFIG_MISSING_FOR_COMPANY` aunque `__legacy__` exista.

`__legacy__` es solo un transportador de bytes para que la key no se
pierda en la migración. No es una configuración válida.

---

## 8. Cache invalidation en detalle

### 8.1 Lista de operaciones que invalidan

| Operación | Invalida | Por qué |
|---|---|---|
| `firma:empresa:set-api-key` (exitoso) | `_cachedClientsByEmpresa.delete(cfg.idEmpresa)` | Cambió la key para esa empresa |
| `firma:empresa:rotate-api-key` (exitoso) | Mismo | La key nueva reemplaza la vieja |
| `firma:empresa:revoke-api-key` (exitoso) | Mismo | Borrada la key, no debe quedar cliente cacheado |
| `firma:empresa:clear-legacy` | Todas (`clear()`) | Defensivo, no debería afectar nada pero limpia estado |
| `firma:config:set-api-key` (legacy, deprecado) | Todas (`clear()`) | Escribe a `__default__`, no sabemos qué empresa afecta |
| Restart de la app | Todas | Variables módulo-level se re-inicializan |
| `firma:empresa:list-firma-remote` | Ninguna | Solo lectura |
| `firma:empresa:list` | Ninguna | Solo lectura |
| Rotación de `clientInstanceId` (vía admin) | Todas | El id cambió, todos los clientes deben regenerarse |

### 8.2 Concurrencia: race entre dos requests

K+AIR es single-threaded (Node main process + Electron IPC serializa
handlers). **No hay race condition real** en el sentido tradicional.
Pero hay un caso sutil:

**Caso**: Request A: `firma:sign-request:create` para Empresa X. Request
B: `firma:empresa:rotate-api-key` para Empresa X. Llegan casi al mismo
tiempo.

**Secuencia**:
1. A: `_requireClientForCompany('X')` → cache miss, crea cliente con key VIEJA, lo cachea
2. B: invalida cache para X (delete del Map)
3. A: usa el cliente cacheado (con key VIEJA) → sign request falla con 401 INVALID_API_KEY

**Mitigación v1**: aceptar este comportamiento. El cliente recibe 401 y
la UI muestra "Key inválida, ¿rotó recientemente?". El user reintenta y
el segundo intento usa la key nueva.

**Mitigación v2 (fuera de scope)**: usar un read-write lock por idEmpresa
(async-mutex). Si Request A está usando cliente X y B intenta invalidar,
B espera a que A termine. Complejidad no justificada en v1.

**Para Subagente C (tests)**: diseñar test que reproduzca el race
secuencialmente (no concurrente — K+AIR no es concurrente):

```js
test('cache invalidation: sign request en vuelo usa key vieja, retry usa key nueva', async () => {
  setupV2With({ 'X': { idEmpresa: 'E1', firmaApiKey: 'OLD' } });
  // 1. Sign request → cliente con key OLD
  var r1 = await invoke('firma:sign-request:create', { companyName: 'X', ... });
  assert.equal(r1.data.usedApiKey, 'OLD');

  // 2. Rotar key
  await invoke('firma:empresa:rotate-api-key', { companyName: 'X' });

  // 3. Otro sign request → debe usar key NEW (cache fue invalidada)
  var r2 = await invoke('firma:sign-request:create', { companyName: 'X', ... });
  assert.equal(r2.data.usedApiKey, 'NEW');
});
```

### 8.3 Invalidation defensiva en `_getClientForCompany`

Doble-check de que la key no cambió (por si alguien escribió a secrets.enc
sin invalidar):

```js
if (cachedCfg && cachedCfg.apiKey === cfg.apiKey) {
  return { client, config: cfg };
}
// Key cambió: invalidar y re-crear
_invalidateClientCacheForEmpresa(cfg.idEmpresa);
// ... continuar a cache miss
```

Esto protege contra bugs en código de testing o flujos que escriben
directo a secrets.enc sin pasar por el handler.

---

## 9. Casos de borde

### 9.1 Empresa activa cambia mientras hay un request en vuelo

**Caso**: User está en Empresa A, llama a `firma:sign-request:create`
(tarda 5s). A los 2s, cambia a Empresa B.

**Comportamiento**:
1. El request se está ejecutando con la Empresa A (el handler se
   snapshot-eó `companyName='A'` en el closure del handler).
2. La cache para Empresa A sigue intacta.
3. La cache para Empresa B se crea lazily cuando llegue el próximo
   request para B.
4. El response del request original vuelve con la key de A.
5. El renderer puede ignorar la respuesta (porque ya cambió de empresa)
   o puede procesarla (porque los datos son válidos).

**No hay race**: el cambio de empresa activa es un evento en el renderer
(React state), no un cambio en main process. El main process solo ve
`companyName` por IPC, y ese es inmutable por la duración de un handler.

**Para Subagente C**: test que verifica que un request en vuelo termina
con la empresa original, no con la nueva.

### 9.2 `safeStorage` no disponible (Linux sin keyring)

**Síntoma**: `safeStorage.isEncryptionAvailable()` retorna `false`.

**Comportamiento por handler**:

| Handler | Retorna |
|---|---|
| `firma:config:get` | `{ data: { encryptionAvailable: false, ... } }` (no falla) |
| `firma:config:diag` | `{ data: { encryptionAvailable: false, ... } }` |
| `firma:empresa:list` | `{ data: { configured: [], available: [...], encryptionAvailable: false } }` |
| `firma:empresa:set-api-key` | `ENCRYPTION_UNAVAILABLE` con hint: "Configure keyring OS o use env (solo dev/CI)" |
| `firma:empresa:rotate-api-key` | `ENCRYPTION_UNAVAILABLE` |
| `firma:empresa:revoke-api-key` | `ENCRYPTION_UNAVAILABLE` |
| `firma:empresa:clear-legacy` | `ENCRYPTION_UNAVAILABLE` |
| `firma:sign-request:*` (con config) | Si hay env, usa env. Si no, `CONFIG_MISSING`. |

**Workaround dev/CI**: en Linux sin keyring, el operador puede usar:
```bash
export FIRMA_SERVICE_URL='https://...'
export FIRMA_SERVICE_API_KEY='...'  # ← key legacy, multi-empresa no soportado
```

Esto es aceptable solo para dev. En producción, el operador DEBE
configurar `gnome-keyring` o `kwallet`. Documentado en I-101 §5.

### 9.3 secrets.enc corrupto

Ver §2.4. Resumen:
- Se borra el archivo
- Se regenera v2 vacío (URL vacía, clientId nuevo, sin empresas)
- `firma:config:diag` retorna `regenerated: true`
- La UI debe mostrar toast y pedir reconfiguración

### 9.4 Empresa en `companies` (DB) pero no en `empresas` (secrets)

**Caso**: K+AIR tiene 5 empresas en `config.json → companyPaths`. Solo
2 tienen key configurada. Las otras 3 no.

**Comportamiento**:
- `firma:empresa:list` retorna:
  - `configured: [2 entries]`
  - `available: [3 entries]` (de DB JOIN)
- Si la empresa activa es una de las 3 no configuradas:
  - `_resolveConfigForCompany` retorna `null`
  - Handler retorna `CONFIG_MISSING_FOR_COMPANY` con `availableCompanies`
  - UI muestra banner + botón "Configurar firma para esta empresa"

### 9.5 Empresa en `empresas` (secrets) pero no en `companies` (DB)

**Caso**: secrets.enc tiene una key para "EMPRESA OBSOLETA S.A.S." que
fue removida de `config.json` (operador la desinstaló de K+AIR).

**Comportamiento**:
- `firma:empresa:list` no la muestra (porque no está en DB)
- Si alguien llama a `firma:empresa:set-api-key` con `companyName` que
  no está en DB → `COMPANY_NOT_FOUND`
- La key queda huérfana en secrets.enc

**Decisión v1**: NO limpiar huérfanas automáticamente. El user puede
ver el contenido de secrets.enc vía `firma:config:diag` y decidir.
Limpieza en v2 (futuro): al boot, comparar y warning si hay huérfanas.

### 9.6 `empresas[].idEmpresa` cambia (operador reorganiza)

**Caso**: El user decide que la empresa "A" ahora tiene id_empresa="X" en
vez de "Y" (reorganización NIT, fusión, etc.).

**Comportamiento actual**: tiene que llamar a `set-api-key` de nuevo con
el nuevo idEmpresa. La key se mantiene.

**Comportamiento futuro (fuera de scope)**: handler `firma:empresa:rename`
que cambia solo el idEmpresa sin tocar la key.

### 9.7 `__legacy__` key es la misma que una `empresas[]` key

**Caso**: Migración v1→v2 mueve la key a `__legacy__`. El user la
reasigna a Empresa A. Quedan DOS copias de la misma key.

**Comportamiento**:
- `firma:empresa:list` ve Empresa A como configurada
- `__legacy__` sigue ahí
- `firma:empresa:clear-legacy` resuelve la duplicación

**No hay problema de seguridad** (es la misma key). Solo limpieza
estética. Recomendar al user en la UI: "Ya reasignó la key, ¿borrar la
copia legacy?"

### 9.8 `companyName` con caracteres especiales

**Caso**: Empresa llamada "A & B S.A.S." (con ampersand).

**Comportamiento**:
- La key en el objeto JS es válida: `empresas["A & B S.A.S."]`
- El lookup es case-insensitive pero NO normaliza otros caracteres
- El renderer debe enviar el nombre EXACTO (o case-equivalente)

**Decisión**: NO normalizar espacios, ampersands, etc. Solo lowercase
+ trim. Si el operador tipea mal, no encuentra — error claro, no
silencioso.

---

## 10. Tests propuestos (estructura)

Subagente C (QA) implementará. Acá solo la estructura.

### 10.1 Unit para cada IPC nuevo

```js
describe('firma:empresa:list', () => {
  test('sin secrets.enc: retorna configured=[] y available=[de DB]');
  test('con 2 empresas configuradas y 1 disponible: retorna correctamente');
  test('con __legacy__ presente: hasLegacyKey=true y legacyWarning populado');
  test('safeStorage no disponible: encryptionAvailable=false, configured=[]');
  test('schemaVersion=1 (no migrado): migra primero y retorna v2');
});

describe('firma:empresa:set-api-key', () => {
  test('happy path: guarda en v2 y actualiza cache stats');
  test('idempotente: set dos veces sobrescribe');
  test('safeStorage no disponible: retorna ENCRYPTION_UNAVAILABLE');
  test('companyName no está en companies DB: retorna COMPANY_NOT_FOUND');
  test('apiKey < 32 chars: retorna INVALID_REQUEST_BODY');
  test('idEmpresa vacío: retorna INVALID_REQUEST_BODY');
  test('validateRemote=true y backend OK: lastValidatedAt actualizado');
  test('validateRemote=true y backend 401: retorna REMOTE_VALIDATION_FAILED');
  test('escribe a secrets.enc cifrado: verificar blob con safeStorage');
});

describe('firma:empresa:rotate-api-key', () => {
  test('happy path: nueva key retornada una vez, secrets.enc actualizado, cache invalidado');
  test('empresa no configurada: retorna COMPANY_NOT_CONFIGURED');
  test('sin admin token: retorna ADMIN_TOKEN_REQUIRED');
  test('backend rechaza: retorna BACKEND_REJECTED_ROTATION');
  test('safeStorage no disponible: retorna ENCRYPTION_UNAVAILABLE');
  test('post-rotación: sign-request usa nueva key (verifica cache)');
});

describe('firma:empresa:revoke-api-key', () => {
  test('happy path local: borra de secrets.enc, invalida cache');
  test('happy path remote: además marca revoked_at en backend');
  test('empresa no configurada: idempotente (success)');
  test('revokeRemote=true sin admin token: ADMIN_TOKEN_REQUIRED');
});

describe('firma:empresa:list-firma-remote', () => {
  test('happy path: lista clients del backend sin api_key');
  test('filtrar por idEmpresa: solo retorna ese');
  test('sin admin token: ADMIN_TOKEN_REQUIRED');
  test('backend timeout: BACKEND_ERROR con timeoutMs en extra');
});

describe('firma:empresa:clear-legacy', () => {
  test('con __legacy__ presente: borra');
  test('sin __legacy__: idempotente (success)');
  test('safeStorage no disponible: ENCRYPTION_UNAVAILABLE');
});
```

### 10.2 Migración v1 → v2

```js
describe('migración v1 → v2', () => {
  test('v1 con firmaServiceApiKey: migra a __legacy__');
  test('v1 sin firmaServiceApiKey: migra a v2 vacío (sin __legacy__)');
  test('v1 con clientInstanceId custom: lo preserva en v2');
  test('v1 sin clientInstanceId: genera uno nuevo');
  test('v1 con URL custom: lo preserva en v2');
  test('migration failure: retorna v1 en memoria, reintenta próximo boot');
  test('v1 corrupto: regenera v2 vacío (igual que corrupto en §2.4)');
});
```

### 10.3 Aislamiento cross-empresa (NO fallback)

```js
describe('aislamiento cross-empresa', () => {
  test('Empresa A tiene key, Empresa B no: B retorna CONFIG_MISSING_FOR_COMPANY');
  test('B no usa key de A (verificar que _resolveConfigForCompany no consulta otras empresas)');
  test('B tiene key pero A no: A retorna CONFIG_MISSING, B funciona');
  test('Configuración global env (FIRMA_SERVICE_API_KEY): idEmpresa=null → CONFIG_NOT_PER_COMPANY');
  test('Cambiar companyName entre dos requests A→B→A: cada uno usa su propia key');
});
```

### 10.4 Cache invalidation

```js
describe('cache invalidation', () => {
  test('set-api-key invalida solo la empresa afectada');
  test('rotate-api-key invalida solo la empresa afectada');
  test('revoke-api-key invalida solo la empresa afectada');
  test('clear-legacy invalida todo (defensivo)');
  test('restart invalida todo');
  test('cache hit sin cambios: no crea nuevo cliente (verificar con factory mock)');
  test('cache hit con key cambiada: detecta, invalida, crea nuevo');
  test('cap MAX_CACHED_COMPANIES: evict LRU al exceder');
  test('doble invalidación concurrente: no lanza error');
});
```

### 10.5 Edge cases

```js
describe('edge cases', () => {
  test('empresa activa cambia mid-request: request termina con empresa original');
  test('safeStorage no disponible: cada handler retorna comportamiento esperado');
  test('secrets.enc corrupto: regenera, diag retorna regenerated=true');
  test('empresa en companies pero no en empresas: list la muestra en available');
  test('empresa en empresas pero no en companies: NO la muestra, key queda huérfana');
  test('__legacy__ key reasignada a empresa: ambas copias coexisten, clear-legacy limpia');
  test('companyName con case distinto: lookup case-insensitive funciona');
  test('companyName="__legacy__": retorna INVALID_REQUEST_BODY (palabra reservada)');
  test('companyName con espacios extras: trim antes de lookup');
  test('companyName vacío/null: retorna COMPANY_REQUIRED');
  test('JSON.parse falla en secrets.enc corrupto: regenera');
  test('MAX_CACHED_COMPANIES excedido: log warn + evict');
});
```

### 10.6 Compatibilidad legacy

```js
describe('compatibilidad legacy', () => {
  test('firma:config:set-api-key (deprecado): escribe a __default__ con WARN');
  test('firma:config:get: retorna schemaVersion=2 y empresaActiva opcional');
  test('firma:config:diag: retorna configuredEmpresas, availableEmpresas, hasLegacyKey');
  test('renderer v0.1.190 sigue funcionando con v0.1.191 instalado');
});
```

### 10.7 Cobertura esperada

| Categoría | # tests | Notas |
|---|---|---|
| Unit por IPC nuevo (5) | ~30 | 5-6 por handler |
| Migración | ~8 | |
| Aislamiento | ~5 | |
| Cache | ~9 | |
| Edge cases | ~12 | |
| Compatibilidad legacy | ~4 | |
| **Total nuevo** | **~68** | vs 27 actuales en test-firma-bridge.js |

Sumado a los 27 actuales: 95 tests del bridge. Subagente C puede
priorizar si el alcance es demasiado grande.

---

## 11. Cambios en renderer (K+AIR UI)

Plan, no implementación. Acá solo lo que la UI necesita para soportar
per-empresa.

### 11.1 Banner "Empresa X no tiene firma configurada"

**Dónde**: en Gestión Humana > Documentos (donde está el botón "Firmar
electrónicamente" futuro de I-102), y en cualquier vista donde aparezca
`currentCompany`.

**Trigger**:
```js
useEffect(() => {
  if (!currentCompany) return;
  const r = await window.electronAPI.firmaEmpresaList();
  const isConfigured = r.data.configured.some(c => c.companyKey === currentCompany);
  if (!isConfigured) setShowFirmaBanner(true);
}, [currentCompany]);
```

**Visual** (convención emergente inline del user, no sección permanente):
```
[ ⚠️ ] Firma electrónica no configurada para "TEMPOACTIVA EST S.A.S."
        [ Configurar firma ]   [ × ]
```

### 11.2 Modal de configuración de firma

**Trigger**: click en "Configurar firma" del banner.

**Opciones** (emergente inline, según preferencia UX del user):
- **Opción A**: "Pegar key existente" (campo de texto)
- **Opción B**: "Generar key nueva" (botón → admin token input → llama
  `POST /internal/admin/clientes`)

**Decisión**: el spec cubre ambas. Implementación de Opción B depende de
que Subagente A entregue el admin endpoint. Si no está listo en I-102,
solo Opción A es viable (y coincide con AUD-04 §3.1 Opción B: "manual,
propenso a error, pero viable").

**Flujo de Opción A (paste de key)**:
1. User pega key
2. `firma:empresa:set-api-key({ companyName, idEmpresa, firmaApiKey, validateRemote: true })`
3. Si success: cierra modal, banner desaparece, toast "Firma configurada"
4. Si REMOTE_VALIDATION_FAILED: muestra error, NO cierra modal

**Flujo de Opción B (generar nueva)**:
1. User click "Generar nueva"
2. Modal pide admin token (campo de texto, NO persiste)
3. K+AIR llama `POST /internal/admin/clientes` con `X-Admin-API-Key`
4. Backend retorna `{ api_key: '...' }`
5. K+AIR autocompleta el campo "Pegar key" con esa key
6. Continúa con flujo Opción A desde paso 2

### 11.3 Vista de configuración de firma (admin)

Una nueva pantalla `/settings/firma` (fuera de I-102, futuro) que
muestra:
- Tabla de empresas configuradas (idEmpresa, lastValidatedAt)
- Botón "Rotar key" por fila → modal de admin token
- Botón "Revocar" por fila → confirmación
- Banner de "tiene key legacy sin asignar" si aplica

### 11.4 Reemplazo de llamadas legacy en el renderer

**Inventario de dónde se llama `firma:config:set-api-key` en renderer**:

Subagente C debe buscar con `grep -r "firmaConfigSetApiKey" renderer/`
y reemplazar por `firmaEmpresaSetApiKey`. Agregar `companyName` y
`idEmpresa` en cada call site.

**Inventario de dónde se llama `firmaSignRequestCreate` etc. sin
`companyName`**: igual, agregar `companyName` en el payload.

**Out of scope de este spec**: el código del renderer. Solo
documentamos el contrato esperado.

### 11.5 Convenciones de UI (recordatorio del perfil del user)

- Emergentes inline, NO secciones permanentes
- Defaults de sistema pre-llenados (editables)
- Acciones de cierre claras (botón × o elegir otra opción)
- Una sola acción primaria por pantalla

---

## 12. Preguntas abiertas que necesitan decisión del user

### P1. ¿Se acepta el handler adicional `firma:empresa:clear-legacy`?

**Propuesta**: sí, agregarlo. AUD-04 §4 no lo contempló pero es
trivial y completa el ciclo de vida (migración v1 → v2 → reasignación →
limpieza).

**Alternativa**: NO agregarlo. El user tendría que borrar `__legacy__`
manualmente (no es viable — no hay UI para eso).

**Recomendación**: agregar.

### P2. ¿`firma:config:set-api-key` legacy escribe a `__default__` o retorna error inmediato?

**Propuesta**: escribir a `__default__` con WARN (compat con v0.1.190
que llama tras `set-url`).

**Alternativa**: retornar `ERR_DEPRECATED` inmediatamente. Rompe
cualquier renderer v0.1.190 sin migrar.

**Recomendación**: compat con WARN. Migración se hace en v0.1.192.

### P3. ¿`firma:empresa:list` debe listar empresas en `empresas` que NO están en DB?

**Caso**: secrets.enc tiene 2 keys (A, B). `companies` DB solo tiene A.

**Propuesta actual**: `firma:empresa:list` hace JOIN con DB, solo muestra
A en `configured`. B queda huérfana.

**Alternativa**: mostrar B también en `configured` aunque no esté en DB.
La UI podría mostrar "huérfana: no está en K+AIR".

**Recomendación**: alternativa. Visibilidad > limpieza estética. El user
puede decidir revocar.

### P4. ¿Validar la key contra backend en `set-api-key` (`validateRemote: true`)?

**Propuesta**: incluir el flag opcional. Default `false` (no valida).

**Razón del default false**: si el backend está caído, no podemos
configurar. Mejor dejar que el user configure y se entere en el primer
sign-request.

**Alternativa**: `validateRemote: true` por default. Más estricto, pero
frágil ante caídas del backend.

**Recomendación**: default `false`, opt-in.

### P5. ¿Límite `MAX_CACHED_COMPANIES = 50` es correcto?

**Propuesta**: 50 (basado en "holgura para 10x crecimiento").

**Alternativa**: 10 (K+AIR típico nunca llega a 10 empresas).

**Recomendación**: 50. Cuesta nada (250 KB) y elimina una clase de bugs.

### P6. ¿El handler de listado `firma:empresa:list` debe filtrar por `idEmpresa`?

**Propuesta**: NO. Es un listado completo, el renderer filtra en cliente.

**Alternativa**: sí, parámetro `idEmpresa` opcional. Útil si la lista
es muy grande.

**Recomendación**: no. K+AIR tiene 1-50 empresas, no miles. Filtrar en
cliente es trivial.

### P7. ¿Audit log de set/rotate/revoke con hash de 8 chars?

**Propuesta (AUD-04 §9 P9)**: `console.log` con timestamp, empresa,
acción, key hash (8 primeros chars de SHA-256). Sin plaintext.

**Alternativa**: log completo sin hash. Más fácil para debug, peor
para seguridad (logs pueden filtrarse).

**Recomendación**: con hash. AUD-04 ya lo recomienda, y la
implementación es trivial (`crypto.createHash('sha256').update(key).digest('hex').slice(0, 8)`).

### P8. ¿Reutilizar `firma:config:get` para info per-empresa, o solo el nuevo `firma:empresa:list`?

**Propuesta actual**: `firma:config:get` agrega campos opcionales
`empresaActiva` y `hasLegacyKey` (si renderer pasa `args.companyName`).

**Alternativa**: `firma:config:get` queda 100% global. Renderer que
necesita info per-empresa llama `firma:empresa:list`.

**Recomendación**: alternativa. Mantener `config:get` simple, forzar al
renderer a usar el endpoint correcto.

**Decisión final**: la propuesta (campos opcionales) está en §6.3. Si
el user prefiere la alternativa, se quita de §6.3. Pregunto.

### P9. ¿Rotación debe requerir confirmación de admin token cada vez, o cachearlo en memoria con TTL?

**Propuesta**: pedir admin token cada vez (más seguro, más fricción).

**Alternativa**: cachear admin token en memoria con TTL 5 min (menos
fricción, mayor superficie de ataque).

**Recomendación**: pedir cada vez. AUD-04 §3.2 dice "admin usa una sola
vez por empresa" — si la rotación es ocasional, no molesta.

### P10. ¿Cómo manejar el caso de "user cambia de empresa A → B sin
haber terminado un sign-request en A"?

**Propuesta actual**: el request en A termina con key de A (correcto),
B se configura lazily cuando llegue el próximo request.

**Pregunta real**: ¿la UI debe cancelar visualmente el request en A al
cambiar de empresa? (es UX, no técnico)

**Recomendación**: no es decisión del spec, lo dejo al renderer.

---

## 13. Decisiones de diseño que tomé y merecen validación

### D-SPEC-1: Estructura `empresas[].activatedAt` y `lastValidatedAt`

**Decisión**: incluir ambos timestamps en el schema v2, con `activatedAt`
set al crear y `lastValidatedAt` actualizado en cada sign OK.

**Por qué**: el user (operador) quiere ver "esta key se validó por
última vez hace 2 días" para detectar keys abandonadas o rotación
vencida.

**Trade-off**: 2 strings más en disco (insignificante). Una llamada
extra a `_writeSecrets` por sign exitoso (potencialmente overhead).
Mitigación: actualizar `lastValidatedAt` solo cada N minutos (no cada
sign). Pendiente de decisión de frecuencia (¿cada sign? ¿cada 1h?).

**Necesita validación**: ¿frecuencia de actualización de
`lastValidatedAt`?

### D-SPEC-2: Cache por `idEmpresa` (no por `companyName`)

**Decisión**: cache indexado por `idEmpresa` (string de NIT), no por
`companyName` (display_name).

**Por qué**: `idEmpresa` es estable; `companyName` puede cambiar (rebrand,
fusión). Si el user cambia el display_name de una empresa, el cache
sigue válido.

**Trade-off**: lookup requiere resolver `companyName → idEmpresa` ANTES
de consultar cache. 1 nivel más de indirección.

**Necesita validación**: ¿el `idEmpresa` es realmente estable? (asumimos
sí, basado en convención backend)

### D-SPEC-3: Cross-company guard en `consent:create`

**Decisión**: el handler de `consent:create` rechaza si
`body.id_empresa !== cfg.idEmpresa`. **Doble check** (el backend ya lo
hace, pero client-side filtra antes).

**Por qué**: defensa en profundidad. Si el backend se equivoca, el
cliente no propaga.

**Trade-off**: 1 comparación extra por consent.

**Necesita validación**: ¿el user prefiere fail-loud (rechazo explícito)
o fail-silent (deja pasar, backend rechaza)? Decidí fail-loud.

### D-SPEC-4: Handler adicional `firma:empresa:clear-legacy`

**Decisión**: agregar este handler (no estaba en AUD-04 §4).

**Por qué**: completa el ciclo de vida de la migración. Sin él, el
user queda con `__legacy__` eterno.

**Necesita validación**: aprobación explícita (es scope nuevo).

### D-SPEC-5: `firma:config:set-api-key` legacy escribe a `__default__`

**Decisión**: compat con v0.1.190 escribiendo a `empresas["__default__"]`
con `idEmpresa="__default__"` (sintético).

**Por qué**: el flujo de K+AIR v0.1.190 es `set-url` → `set-api-key`.
Romper eso = instalación v0.1.190 que upgradea a v0.1.191 queda rota
hasta que el user migre manualmente.

**Trade-off**: una "empresa" sintética `__default__` que nunca matchea
con `companies` DB. La UI no la debe mostrar como "configurada" (filter
out en `firma:empresa:list`).

**Necesita validación**: ¿`__default__` se filtra de `firma:empresa:list`?
Asumo sí, pero documentar.

### D-SPEC-6: `validateRemote` default false

**Decisión**: en `firma:empresa:set-api-key`, `validateRemote` default
`false`.

**Por qué**: si el backend está caído, no podemos configurar nada. Mejor
dejar configurar y validar después.

**Necesita validación**: ¿el user prefiere strict (default true) o
lenient (default false)? Decidí lenient.

### D-SPEC-7: Compatibilidad de `firma:config:get` con campos extra

**Decisión**: agregar `schemaVersion` y `empresaActiva` opcional a
`firma:config:get` en lugar de tener dos endpoints paralelos.

**Por qué**: el renderer v0.1.190 llama `firma:config:get` y le sirve
tener info de migración sin aprender nuevos endpoints.

**Necesita validación**: ¿el user prefiere romper la API limpia
(agregar solo a `firma:empresa:list`) o mantener compat (esta
propuesta)?

### D-SPEC-8: Race condition aceptada en rotación mid-request

**Decisión**: aceptar que un sign-request en vuelo durante una rotación
puede terminar con la key vieja (1 caso en N).

**Por qué**: implementar locking async-mutex es complejidad no
justificada en v1 (K+AIR no es high-throughput).

**Necesita validación**: ¿el user está OK con esta ventana de
inconsistencia? (es un caso raro, pero documentarlo).

---

## 14. Resumen para Subagente C (QA/tests)

**Tests nuevos a escribir**: ~68 (ver §10).

**Patrón de tests existente**: `main/test-firma-bridge.js` (27 tests).
- Mock de `electron` vía `Module._resolveFilename`
- Inyección de `firma-client` vía `_test_setClientFactory`
- Secrets vía `_test_setSecrets` (bypass de safeStorage)
- Helper `_call(channel, payload)` para invocar handlers

**Para tests per-empresa, agregar al setup**:
- Helper `_setSecretsV2({ empresas: {...}, version: 2 })` que escribe
  v2 directamente
- Helper `_invokeWithCompany(channel, payload, companyName)` para
  inyectar companyName en payloads

**Foco crítico de QA** (los 3 casos que más pueden romper):
1. **Aislamiento cross-empresa**: Empresa A no usa key de B. Repetir
   este test en TODOS los handlers firma:*.
2. **Migración silenciosa v1 → v2**: ejecutar 5+ escenarios v1
   (con/sin key, con/sin URL, con/sin clientId).
3. **Cache invalidation**: set/rotate/revoke invalidan la entrada
   correcta (no todas, no ninguna).

**No testeable desde el bridge** (lo testea Subagente A en backend):
- Cross-company en backend (el bridge solo pasa la key correcta)
- Rotación real (requiere admin token + endpoint)

---

## 15. Resumen para Subagente A (backend)

**El bridge espera estos endpoints admin (en orden de prioridad)**:

| Endpoint | Uso | Cuándo lo llama el bridge |
|---|---|---|
| `POST /internal/admin/clientes` | Crear per-company client | NO lo llama directamente (lo llama el renderer Opción B de §11.2). |
| `POST /internal/admin/clientes/:id/rotate` | Rotar key | `firma:empresa:rotate-api-key` con admin token |
| `GET /internal/admin/clientes` | Listar clients remotos | `firma:empresa:list-firma-remote` |
| `DELETE /internal/admin/clientes/:id` | Marcar revoked_at | `firma:empresa:revoke-api-key` con `revokeRemote: true` |

**Convención esperada** (asumiendo mismo patrón que endpoints internos existentes):
- `X-Admin-API-Key` header
- Response: `{ success: true, data: {...} }` o `{ success: false, error: { code, message } }`
- Crear retorna la `api_key` en plaintext **UNA SOLA VEZ**

**Si los endpoints NO están listos en I-102**: el spec sigue válido,
solo Opción B del modal de UI queda deshabilitada. Opción A (paste de
key pre-existente) funciona standalone.

---

## 16. Cambios esperados al código de producción (resumen)

Para que el implementador (futuro commit) tenga la lista:

| Archivo | Cambio | Líneas estimadas |
|---|---|---|
| `main/firma-bridge.js` | Reescribir `_readSecrets`/`_writeSecrets` para v2; agregar migración; agregar `_resolveConfigForCompany`; reemplazar `_cachedClient` por `Map`; agregar 6 handlers nuevos (`firma:empresa:*` + `clear-legacy`); modificar 9 handlers existentes para aceptar `companyName`; marcar `firma:config:set-api-key` como deprecado | ~400-500 |
| `preload.js` | Agregar 6 exports: `firmaEmpresaList`, `firmaEmpresaSetApiKey`, `firmaEmpresaRotateApiKey`, `firmaEmpresaRevokeApiKey`, `firmaEmpresaListFirmaRemote`, `firmaEmpresaClearLegacy` | ~10 |
| `main/test-firma-bridge.js` | Agregar 68 tests nuevos | ~600-800 |
| (renderer, fuera de scope) | Reemplazar 13 callsites de `firmaConfig*` con `firmaEmpresa*`; agregar `companyName` en 9 callsites de `firmaSignRequest*`; nueva pantalla `/settings/firma` | ~200-400 |

**Total LOC estimado**: ~1500-2000 (sin contar renderer).

---

## 17. Referencias cruzadas

- AUD-04: `storage-backup/audit-04-per-empresa-auth-design.md`
- I-010 (autorización per-empresa): `docs/kair-firma-integration/I-010-design.md`
- SECURITY §8 (gh_internal_clients): `docs/gestion-humana/firma-electronica/SECURITY.md`
- API firma-service: `docs/gestion-humana/firma-electronica/API.md`
- Bridge actual (v1): `main/firma-bridge.js` (commit `525d592a`)
- Cliente actual (sin cambios): `main/firma-client.js` (commit `525d592a`)
- Tests del bridge: `main/test-firma-bridge.js`

---

**Próximo paso (post-aprobación de este spec)**:
1. User revisa y responde las 10 preguntas abiertas (§12)
2. User valida las 8 decisiones de diseño (§13)
3. Subagente A (backend) entrega endpoints admin
4. Implementación del bridge (commit 2 del plan AUD-04 §8)
5. Tests nuevos (Subagente C)
6. E2E real con K+AIR ↔ firma-service per-empresa

**Status**: DRAFT v1. Listo para revisión del user y Subagentes A y C.

---

## 18. Decisiones ratificadas por el user (2026-08-20)

Estas decisiones resuelven los gaps del cross-check A↔B↔C y son **binding**
para la implementación. Anulan o complementan §12 (preguntas abiertas) y
§13 (decisiones de diseño). Se dividen en dos rondas:

**Ronda 1 (DR-1 a DR-5)**: gaps detectados en cross-check A↔B.

**Ronda 2 (DR-6.A a DR-6.D)**: gaps adicionales detectados por Subagente C
en cross-check C↔A↔B, sin pregunta al user (decisiones técnicas
conservadoras).

### DR-1 (binding) — Crear cliente via bridge (NO renderer)
La llamada `POST /internal/admin/clientes` la hace el **bridge de K+AIR**
usando el `adminApiKey` de `secrets.enc`. El renderer **nunca** ve el
plaintext de la api_key. Solo recibe `{created: true, apiKeyHashPrefix}`.

### DR-2 (binding) — Admin token persistido en `secrets.enc.adminApiKey`
El `X-Admin-API-Key` se persiste globalmente en `secrets.enc.adminApiKey`
(operator-level, una vez por instalación). Se setea vía nuevo IPC
`firma:config:set-admin-key(adminApiKey)`.

**Schema de `secrets.enc` v2 final**:
```json
{
  "version": 2,
  "firmaServiceUrl": "https://firma.k-air.com",
  "firmaServiceClientInstanceId": "550e8400-...",  // global, por instalación
  "adminApiKey": "<operator-level token>",        // NUEVO, global
  "empresas": {
    "TEMPOACTIVA EST S.A.S.": {
      "idEmpresa": "900123456",
      "firmaApiKey": "<per-company key>",
      "activatedAt": "...",
      "lastValidatedAt": "..."
    }
  }
}
```

### DR-3 (binding) — IPC `firma:empresa:create` agregado
Nuevo IPC: `firma:empresa:create(companyName, idEmpresa, displayName)`.

**Input**:
```js
{
  companyName: 'TEMPOACTIVA EST S.A.S.',  // REQUERIDO (debe existir en companies table)
  idEmpresa: '900123456',                 // REQUERIDO (NIT)
  displayName: 'TEMPOACTIVA EST S.A.S.'   // REQUERIDO (display name para backend)
}
```

**Output (success)**:
```js
{
  success: true,
  data: {
    created: true,
    companyKey: 'TEMPOACTIVA EST S.A.S.',
    idEmpresa: '900123456',
    apiKeyHashPrefix: 'a1b2c3d4',  // 8 chars, NUNCA la key completa
    activatedAt: '2026-08-20T16:00:00Z'
  }
}
```

**Errores**:
- `ADMIN_TOKEN_REQUIRED` (sin adminApiKey en secrets.enc) — `remediationHint: 'firma:config:set-admin-key'`.
- `BACKEND_REJECTED` (error propagado) — `extra.backendError: {code, message}`.
- `INTERNAL`.

**Nota UX**: este IPC **no retorna la api_key** al renderer. La key se
guarda directamente en `secrets.enc.empresas[empresaKey].firmaApiKey`
dentro del bridge. El renderer solo sabe "se creó correctamente".

### DR-4 (binding) — DELETE/revoke en V2 (no en commit 1)
V1: `firma:empresa:revoke-api-key` borra de `secrets.enc` y opcionalmente
rota en backend (con `revokeRemote: true`). La rotación SÍ marca la key
vieja como revocada en backend.

V2 (futuro): agregar `DELETE /internal/admin/clientes/:id` cuando se necesite
revocación más granular.

### DR-5 (binding) — Prefijo `kair_live_/kair_test_`: warning soft
`firma:empresa:set-api-key` NO rechaza keys sin el prefijo estándar. Solo:
- Log `[FIRMA-BRIDGE] Warning: apiKey sin prefijo estándar (no kair_live_/kair_test_). Continuando por compat...` en consola del bridge.
- Retorna `{stored: true, softWarning: 'Key no tiene prefijo kair_live_/kair_test_ — se acepta por compat'}` al renderer.

### DR-6.A (binding) — Bridge construye `description`
El bridge de K+AIR envía `description` ya formateado al backend con el
patrón `K+AIR empresa ${displayName} - ${config.env}` (truncado a 200
chars). El renderer NUNCA envía `description` directamente — solo
`displayName` (campo humano).

**Razón:** desacoplar el formato de auditoría de firma-service del input
del usuario. Si firma-service cambia el formato, se cambia en un solo
lugar (el bridge).

Ver §5.6 (Mapeo en el bridge) para el detalle.

### DR-6.B (binding) — `allowed_operations` default = ALL
El bridge SIEMPRE envía los 5 valores del enum I-010:
`['sign_request:create', 'sign_request:read', 'consent:create', 'consent:verify', 'audit:read']`.

El renderer NUNCA especifica `allowed_operations` — el bridge las inyecta
en cada llamada a `POST /internal/admin/clientes`.

**Razón:** K+AIR no tiene razón para solicitar permisos parciales. El
admin controla la key; si quiere permisos más restrictivos, puede rotar
la key con `allowed_operations` más limitados en un endpoint futuro (V2).

Ver §5.6 (Inyección de allowed_operations) para el detalle.

### DR-6.C (binding) — Error code `ALREADY_CONFIGURED`
Si `secrets.enc.empresas[companyName].firmaApiKey` ya existe y el
usuario llama `firma:empresa:create` con la misma empresa:

- **NO sobrescribir** la key existente (destruiría la key en uso y
  rompería sign requests en vuelo).
- Retornar error: `ALREADY_CONFIGURED` con
  `extra.suggestion: 'Use firma:empresa:rotate-api-key to rotate the existing key'`.

**Pre-chequeo del bridge (sin llamada al backend):**
1. Leer `secrets.enc.empresas[companyName]`.
2. Si existe → retornar `ALREADY_CONFIGURED` directamente, sin hacer
   la llamada HTTP al backend.

**Razón:** conservadora. Evita pérdida accidental de credenciales. El
usuario debe ser explícito sobre rotar (DR-4).

Ver §5.6 (Pre-condiciones) para el detalle.

### DR-6.D (no bloqueante, aceptado) — `validateRemote` usa admin endpoint
`firma:empresa:set-api-key` con `validateRemote: true` llama
`GET /internal/admin/clientes` (que requiere `X-Admin-API-Key`).
Semánticamente raro (validamos per-company con admin), pero funciona
porque el bridge tiene `adminApiKey` (DR-2).

**Decisión:** Aceptar en V1. Alternativa futura: endpoint per-company
`GET /internal/me` (DR-8, post-I-102). Documentar como decisión técnica,
no requiere cambio en V1.

---

## 19. Cambios resultantes al spec B (este archivo)

### Ajustes a §2 (Schema de secrets.enc v2)
- **Agregar campo `adminApiKey`** (DR-2) — ejemplo en §18 arriba y §2.1.
- **Agregar fila en §2.2** (reglas de validación) para `adminApiKey`.

### Ajustes a §4 (Cache de clientes)
Sin cambios estructurales. La cache por `idEmpresa` se mantiene. El
`adminApiKey` se lee una sola vez al boot del bridge (no se cachea —
cambia raramente, lectura a `secrets.enc` es barata con safeStorage).

### Ajustes a §5 (IPC channels nuevos)
**Agregar §5.6 `firma:empresa:create`** (DR-3) con DR-6.A (displayName →
description), DR-6.B (allowed_operations = ALL), DR-6.C
(ALREADY_CONFIGURED). Ver §5.6 para input/output completo.

**Agregar §5.7 `firma:config:set-admin-key`** (DR-2) — input/output y
efectos secundarios. Ver §5.7.

### Ajustes a §11 (UI)
El flujo "Opción B: Generar nueva" se actualiza:
- ANTES (este spec, §11.2): "K+AIR llama POST /internal/admin/clientes con X-Admin-API-Key" (asumía fetch desde renderer).
- AHORA: el admin token se persiste una vez (DR-2). El flujo es:
  1. Admin configura `adminApiKey` una vez (vía `firma:config:set-admin-key`).
  2. K+AIR muestra "Configurar firma" → admin elige "Generar nueva".
  3. K+AIR llama `firma:empresa:create(companyName, idEmpresa, displayName)` (vía IPC).
  4. Bridge llama al backend. Toast "Configurada" si success, error si falla.
  5. La api_key se guarda automáticamente. Admin no la ve nunca (ni siquiera en la confirmación).

**Nuevo flujo de UI para ALREADY_CONFIGURED (DR-6.C):**
- Si la empresa ya está configurada, el modal de "Configurar firma" muestra
  solo el botón "Rotar", no "Generar nueva". El renderizador debe
  consultar `firma:empresa:list` antes de decidir qué botones mostrar.
- Si el admin intenta `create` igual (vía DevTools o por bug), el error
  `ALREADY_CONFIGURED` se muestra con sugerencia clara.

### Ajustes a §12 (preguntas abiertas)
- P1 (handler `clear-legacy`): propuesta. Si el user confirma → incluir.
- P2 (legacy `set-api-key` compat vs error): MANTIENE compat (escribe a `__default__`) — decisión tomada en el spec original.
- P3-P10: ver tabla de impacto. Las nuevas preguntas sobre el admin token se eliminan (DR-2 lo resolvió).

### Ajustes a §13 (decisiones de diseño)
- D-SPEC-5 (legacy compat): sin cambios.
- D-SPEC-6 (`validateRemote: false` por default): sin cambios.
- D-SPEC-7 (`config:get` extendido): sin cambios.
- D-SPEC-8 (race condition rotación): sin cambios.
- **NUEVA D-SPEC-9**: `adminApiKey` se lee desde `secrets.enc` en cada operación admin (no se cachea). Razón: las ops admin son raras; lectura a `secrets.enc` es O(1) con safeStorage. Caching agregaría complejidad sin beneficio medible.
- **NUEVA D-SPEC-10** (DR-6.A): El `description` se construye en el bridge, NO se acepta del renderer. Si el renderer lo manda, se ignora.
- **NUEVA D-SPEC-11** (DR-6.B): `allowed_operations` siempre son los 5 del enum I-010, NO se acepta del renderer. Si el renderer lo manda, se ignora con WARN.
- **NUEVA D-SPEC-12** (DR-6.C): Pre-chequeo de `secrets.enc.empresas[companyName]` ANTES de llamar al backend. Si ya existe → `ALREADY_CONFIGURED` sin HTTP call.

### Ajustes a §18 (binding decisions)
**Agregar DR-6.A, DR-6.B, DR-6.C, DR-6.D** como binding. Aplicado en este commit.

---

**Status**: DRAFT v2 (post-decisiones user). Listo para Subagente C (QA/test matrix).


# AUD-04 · Diseño de credenciales per-empresa para firma-service

**Fecha:** 2026-08-20
**Estado:** Borrador para revisión (no se ha modificado código)
**Contexto:** E2E real K+AIR ↔ firma-service descubrió que el backend
rechaza POST sign-requests en modo legacy (`IDEMPOTENCY_LEGACY_NOT_SUPPORTED`).
Decisión del user: migrar a per-empresa API keys (alineado con D-13/I-010),
no parchear el backend.

---

## 1. Estado actual (inventario)

### 1.1 Cómo K+AIR identifica la empresa activa

**Schema** (`main.js:441-445`):
```sql
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_key TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL
);
```

**Poblado desde** `config.json` → `config.companyPaths`:
```js
function companiesSyncInternal(localDb) {
  const config = readConfigSync();
  const companyPaths = config.companyPaths || {};
  Object.keys(companyPaths).forEach(key => {
    upsert.run(key, key);  // company_key = display_name = key
  });
}
```

**Resolución en runtime** (`main/gestion-humana-bridge.js:58-66`):
```js
function _getCompanyByName(companyName) {
  var normalized = String(companyName || '').toLowerCase().trim();
  return localDb.prepare(
    "SELECT id, company_key, display_name FROM companies " +
    "WHERE LOWER(company_key) = ?"
  ).get(normalized);
}
```

**Convención de IPC** (todos los bridges):
- Cada handler IPC recibe `args.companyName` como parámetro
- El bridge lo normaliza y lo usa como scope multi-tenant
- La UI (renderer) mantiene "currentCompany" en estado y lo pasa en cada llamada
- Ejemplo: `ghListPersonal({ companyName: this.companyName })`

**No existe** un endpoint para listar companies desde la UI (`companiesSyncV1` solo dispara el sync, no retorna la lista). Hay que agregar uno en I-103 o exponer `companiesSyncV1` para que devuelva la lista.

### 1.2 Dónde se almacenan credenciales hoy (firma-bridge)

**`firma-bridge.js` líneas 73-91, 97-116:**
- `<userData>/secrets.enc` (cifrado con `safeStorage`)
- Estructura ACTUAL (FLAT, no per-empresa):
  ```js
  {
    firmaServiceUrl: '...',
    firmaServiceApiKey: '...',      // ← UNA sola key, para TODAS las empresas
    clientInstanceId: '...'
  }
  ```
- **BUG:** K+AIR multi-tenant no puede tener credenciales distintas por empresa con la estructura actual.

**`config.json`** (no cifrado, user-editable):
- Solo almacena paths de filesystem, no credenciales
- K+AIR se considera "config plana del usuario" (no es el lugar para secretos)

### 1.3 Cómo se carga la config efectiva (firma-bridge.js:118-189)

```
env vars (FIRMA_SERVICE_URL + FIRMA_SERVICE_API_KEY + FIRMA_SERVICE_CLIENT_INSTANCE_ID)
       ↓
   ¿presente?
       ↓ sí                     ↓ no
  _envConfig()            secrets.enc
                                ↓
                          ¿presente?
                              ↓ sí
                          _secretsConfig() (UN solo set de credenciales)
                              ↓ no
                          "missing" mode (genera UUID + UI pide URL + API key)
```

**Para la nueva arquitectura:** la resolución debe pasar de
`empresa_activa` → `credenciales(empresa_activa)`.

### 1.4 Conclusión del inventario

| Pregunta del user | Hallazgo |
|---|---|
| ¿Ya existe alguna tabla/config para empresa → API key? | **No.** Solo `companies` con id/company_key/display_name. |
| ¿Cómo identifica K+AIR la empresa activa? | `companyName` en payload de cada IPC; backend lo normaliza y lo usa como scope. |
| ¿Dónde guardar credenciales? | Mejor: extender `secrets.enc` con un mapa por empresa. Razón: cifrado OS-native, ya integrado. |
| ¿Tabla SQLite nueva vs secrets.enc? | **secrets.enc**, con justificación abajo. |
| ¿Cómo se provisiona inicialmente? | **Decisión abierta**, ver §3.3. |
| ¿Quién genera la API key? | **Decisión abierta**, ver §3.3. |
| ¿Cómo se rota/revoca? | **Decisión abierta**, ver §3.4. |
| ¿Cómo evitar que empresa A use la key de B? | Backend ya lo enforce (I-010). K+AIR debe pasar la key correcta por scope. |

---

## 2. Decisión de arquitectura

### 2.1 Dónde guardar: `secrets.enc` (extendido)

**Razón:** K+AIR ya usa `safeStorage` para cifrar credenciales con
protección OS-native (Keychain en macOS, DPAPI en Windows, libsecret en Linux).
La estructura es simple, sobrevive a DB migrations, y se mantiene fuera
del SQL dump (que sí podría compartirse entre máquinas).

**Estructura propuesta** (mismo archivo, schema versionado):
```json
{
  "version": 2,
  "firmaServiceUrl": "https://firma.k-air.com",
  "firmaServiceClientInstanceId": "550e8400-e29b-41d4-a716-446655440000",
  "empresas": {
    "TEMPOACTIVA EST S.A.S.": {
      "idEmpresa": "900123456",
      "firmaApiKey": "per-company-32-byte-key-A",
      "activatedAt": "2026-08-20T15:00:00Z",
      "lastValidatedAt": "2026-08-20T15:00:00Z"
    },
    "OTRA EMPRESA S.A.S.": {
      "idEmpresa": "900999999",
      "firmaApiKey": "per-company-32-byte-key-B",
      "activatedAt": "...",
      "lastValidatedAt": "..."
    }
  }
}
```

**Por qué NO tabla SQLite:**
- La tabla requeriría su propia capa de cifrado (¿con qué key? ¿safeStorage bootstrap?)
- K+AIR no tiene hoy ningún secreto en SQLite (`email_connections` los guarda en texto plano — ver `email-schema-sql.js:16-26` —, eso es un bug separado)
- `secrets.enc` ya está validado y testeado
- No hay backup automático de SQLite en K+AIR (las credenciales se perderían igualmente)

**Migración desde v1:** al primer boot, si la versión es 1, transformar:
```js
{
  v1.firmaServiceUrl        → v2.firmaServiceUrl
  v1.firmaServiceApiKey     → v2.empresas["__default__"]?.firmaApiKey  // log warning
  v1.clientInstanceId       → v2.firmaServiceClientInstanceId
  v2.empresas               → {}  // se reasigna manualmente
}
```

### 2.2 Resolución de config por empresa activa

```js
function _resolveConfigForCompany(companyName) {
  var v2 = _readSecretsV2();
  if (!v2 || !v2.empresas) return null;

  var emp = _resolveEmpresa(v2.empresas, companyName);
  if (!emp) return null;
  if (!emp.firmaApiKey || !emp.idEmpresa) return null;

  return {
    url: v2.firmaServiceUrl,
    apiKey: emp.firmaApiKey,
    clientInstanceId: v2.firmaServiceClientInstanceId,
    idEmpresa: emp.idEmpresa,
    source: 'secrets-v2',
    lastValidatedAt: emp.lastValidatedAt
  };
}

function _resolveEmpresa(empresas, companyName) {
  if (!companyName) return null;
  var normalized = String(companyName).toLowerCase().trim();
  for (var k in empresas) {
    if (k.toLowerCase().trim() === normalized) return empresas[k];
  }
  return null;
}
```

El cliente (renderer) llama con `companyName` actual, y el bridge hace lookup.

### 2.3 Aislamiento cross-company

**Backend ya lo enforce** (`firma-service/src/middleware/authz.js`):
- `req.authSource === 'client'` + `signRequest.id_empresa !== req.id_empresa` → 404 (no filtra existencia).
- I-010 ya lo implementa y está commiteado en backend.

**K+AIR debe asegurar:**
- El bridge solo puede usar la key de la empresa activa. No hay forma de pasar una key "forzada" desde la UI (sería un bug).
- Si el usuario cambia de empresa, la firma-bridge invalida su cache de cliente para esa empresa.
- Si la key de la empresa activa no está configurada, los handlers `firma:*` retornan `CONFIG_MISSING` con `currentCompany` y `availableCompanies` (los que sí están configurados).

### 2.4 Estructura de la cache del cliente

Actualmente `_getClient()` cachea UN cliente global:
```js
var _cachedClient = null;
var _cachedClientConfigKey = null;

function _clientConfigKey(cfg) {
  return [cfg.url, cfg.apiKey, cfg.clientInstanceId].join('|');
}
```

**Propuesta:** cachear por empresa:
```js
var _cachedClientsByEmpresa = new Map();  // idEmpresa → FirmaClient

function _getClientForCompany(companyName) {
  var cfg = _resolveConfigForCompany(companyName);
  if (!cfg || !cfg.idEmpresa) return { client: null, config: null };

  if (_cachedClientsByEmpresa.has(cfg.idEmpresa)) {
    return { client: _cachedClientsByEmpresa.get(cfg.idEmpresa), config: cfg };
  }
  // ... crear nuevo FirmaClient y cachear
}
```

Invalidación al cambiar API key de una empresa:
```js
function _invalidateClientCacheForEmpresa(idEmpresa) {
  _cachedClientsByEmpresa.delete(idEmpresa);
}
```

---

## 3. Ciclo de vida de credenciales

### 3.1 Initial setup (primera vez que se usa firma electrónica)

**Opciones evaluadas:**

| Opción | Mecanismo | Pros | Contras |
|--------|-----------|------|---------|
| **A. Self-service desde K+AIR** | K+AIR pide admin token, llama a nuevo endpoint `POST /internal/admin/clientes` para crear per-company key. | UX integrada | Requiere nuevo endpoint admin en backend; admin token debe setearse una vez. |
| **B. Provisioning manual externo** | Operador humano crea la key con script CLI en firma-service, la pega en K+AIR. | Simple, no requiere endpoint nuevo | Manual, propenso a error. |
| **C. Auto-generada en K+AIR** | K+AIR genera una key localmente, la intenta registrar en firma-service. | Self-contained | firma-service no puede validar keys que él no generó (would need a `/admin/clientes/register` endpoint). |

**Recomendación: Opción A** — un único endpoint `POST /internal/admin/clientes` que el admin usa una sola vez por empresa. El flujo:

```
K+AIR (admin)
  ↓
  Inicia setup de firma para Empresa X
  ↓
  Pide: X-Admin-API-Key (ya existe) + id_empresa + display_name
  ↓
firma-service
  ↓
  Genera api_key de 32+ bytes con crypto.randomBytes
  ↓
  Hashea con SHA-256, guarda en gh_internal_clients
  ↓
  Retorna { api_key: "..." }  ← SOLO esta vez, en plaintext
  ↓
K+AIR
  ↓
  Cifra con safeStorage y guarda en secrets.enc
```

**Por qué nuevo endpoint y no solo script:** el admin es el mismo
operador humano (probablemente vos, antes de pasar K+AIR al cliente
final). Tener un endpoint consistente con el resto de la API
(`/internal/admin/acuerdo-versiones` ya existe, mismo patrón) es
consistente y testeable. El script CLI sigue siendo posible como
alternativa de "importar una key pre-existente".

### 3.2 Rotación

**Caso:** la key de la Empresa X fue comprometida o se quiere rotar periódicamente.

**Flujo:**
1. Admin en K+AIR llama `firma:empresa:rotate-api-key(empresaKey)` (nuevo IPC).
2. Bridge pide a firma-service: `POST /internal/admin/clientes/:id/rotate` (nuevo endpoint).
3. firma-service genera nueva key, marca la vieja como `rotated_at`, guarda la nueva con el mismo `id_empresa`.
4. K+AIR actualiza `secrets.enc` con la nueva key.
5. K+AIR invalida cache del cliente para esa empresa.
6. La key vieja deja de funcionar inmediatamente (no hay grace period en v1, lo podemos agregar después).

**Alternativa más simple v1:** "rotar" = "crear nueva + marcar vieja como revocada". No requiere `rotated_at`.

### 3.3 Revocación

**Caso:** la Empresa X ya no debe tener acceso a firma-service.

**Flujo v1 (K+AIR solo):**
1. Admin en K+AIR llama `firma:empresa:revoke-api-key(empresaKey)` (nuevo IPC).
2. Bridge borra la key de `secrets.enc.empresas[empresaKey]`.
3. Invalida cache.

**Limitación:** la key sigue activa en firma-service. Un atacante con esa key podría seguir usándola.

**Para v2 (futuro):**
- Agregar `DELETE /internal/admin/clientes/:id` en firma-service que marca `revoked_at`.
- El middleware `requireEmpresaScopeAndLimit` ya respeta `revoked_at` (cache TTL 30s, ver `src/services/internalClient.js:13-17`).

### 3.4 Listado de empresas configuradas

`firma:empresa:list` retorna:
```js
{
  configured: [
    { companyKey: 'TEMPOACTIVA EST S.A.S.', idEmpresa: '900123456', activatedAt: '...', lastValidatedAt: '...' }
  ],
  available: [
    { companyKey: 'EMPRESA NO CONFIGURADA', idEmpresa: null }
  ],
  source: 'mixed'  // 'all-configured' | 'none-configured' | 'mixed'
}
```

`available` viene del JOIN con `companies` (las que K+AIR conoce pero no tienen key). Esto le permite a la UI mostrar "Empresa X no tiene firma electrónica configurada" en vez de fallar silenciosamente.

---

## 4. IPC channels nuevos

Reemplazan/paralelos a los actuales `firma:config:*`:

| Canal nuevo | Reemplaza | Función |
|---|---|---|
| `firma:empresa:list` | `firma:config:diag` (parcial) | Lista empresas con/sin key configurada |
| `firma:empresa:set-api-key` | `firma:config:set-api-key` | Setea key per-empresa (idempotente) |
| `firma:empresa:rotate-api-key` | — | Rota la key via firma-service |
| `firma:empresa:revoke-api-key` | — | Borra key de secrets.enc |
| `firma:empresa:list-firma-remote` | — | Lista per-company clients en firma-service (admin) |

**Mantener** `firma:config:get` y `firma:config:diag` con info global (URL, clientInstanceId, encryptionAvailable). Solo `firma:config:set-api-key` se depreca a favor de `firma:empresa:set-api-key`.

---

## 5. Cambios en firma-client.js

**Sin cambios.** El cliente ya es stateless y recibe `(baseUrl, apiKey, clientInstanceId)`. La cache de per-empresa vive en `firma-bridge.js`. La interfaz pública no cambia.

---

## 6. Cambios en UI (K+AIR)

**Mínimos para I-102:**
- Mostrar un banner en Gestión Humana > Documentos: "Firma electrónica no configurada para [empresa]" si `firma:empresa:list` retorna `available` no vacío para la empresa activa.
- Botón "Configurar firma electrónica" abre un modal con instrucciones (paste API key, o generar nueva via admin).
- Una vez configurada, el botón "Firmar electrónicamente" (vuelve con I-102) usa la key de la empresa activa.

**Para I-103 (storage local):**
- Mapeo entre `id_solicitud` (de firma-service) y `id_documento` (de K+AIR) en una nueva tabla `gh_firma_solicitudes` local.

**Fuera de scope de AUD-04:** el UI completo se define en I-102.

---

## 7. Cambios en firma-service (backend)

**Necesarios:**
- Nuevo endpoint `POST /internal/admin/clientes` que crea un per-company client (genera key, hashea SHA-256, guarda en `gh_internal_clients`).
- Nuevo endpoint `POST /internal/admin/clientes/:id/rotate` que genera nueva key (marca vieja como revocada).
- Nuevo endpoint `GET /internal/admin/clientes` que lista los per-company clients (con `id_empresa`, `description`, `revoked_at`, etc., pero SIN la key en plaintext).
- Nuevo endpoint `DELETE /internal/admin/clientes/:id` (opcional, v2) que marca como revocado.

**Test backend:** extender `tests/routes/admin.test.js` (si existe) o crear nuevo, con casos:
- Admin crea per-company client → recibe api_key en plaintext
- Cliente normal usa esa key → req.authSource='client', req.id_empresa seteado
- Cliente intenta usar key de OTRA empresa → 403/404 (cross-company)
- Rotación → key vieja revocada, nueva activa
- Sin TOKEN_ENCRYPTION_KEY si no se necesita (I-013b es lo único que lo requiere)

**Riesgo:** ninguno operacional. Es aditivo. El endpoint es admin-only (X-Admin-API-Key). Ningún handler existente cambia.

---

## 8. Plan de commits (post-aprobación de AUD-04)

Asumiendo que AUD-04 se aprueba tal cual:

1. **Commit 1 — `feat(api): add per-company internal client admin endpoints`** (firma-service)
   - 1 endpoint nuevo: `POST /internal/admin/clientes`
   - 1 endpoint nuevo: `POST /internal/admin/clientes/:id/rotate`
   - 1 endpoint nuevo: `GET /internal/admin/clientes`
   - 1 migration (si la tabla `gh_internal_clients` no existe — verificar)
   - Tests (~15-20)
   - ~250-400 líneas

2. **Commit 2 — `feat(gh): per-empresa API key storage and resolution`** (K+AIR)
   - Extiende `secrets.enc` schema v1 → v2 con `empresas: {...}`
   - Migración automática desde v1 (con warning si había key)
   - Nuevos IPC `firma:empresa:*` (5 canales)
   - Cache de cliente per-empresa
   - Tests (~10-15)
   - ~150-250 líneas

3. **Commit 3 — `test(e2e): real per-empresa K+AIR ↔ firma-service`**
   - Extiende `storage-backup/e2e-integration-kair-firma.js`
   - 9 pasos verdes esperados (vs 3 actuales)
   - Si pasa, promueve el script a `tests/e2e/` (decisión aparte)

4. **Commit 4 — `chore(release): bump 0.1.190 → 0.1.191`** (separado, post-OK del user)

**Después de commit 3:** abrir puerta a I-102 (UI firma electrónica con polling 30s).

---

## 9. Preguntas abiertas para el user

1. **¿Aceptás que el endpoint admin `POST /internal/admin/clientes` viva en firma-service?**
   - Es la pieza central de esta arquitectura. Sin él, no hay forma self-service de crear per-company keys.
   - Alternativa: provisioning 100% manual (script CLI que el operador corre una vez por empresa).
   - **Recomendación:** sí, el endpoint. Es consistente con `POST /internal/admin/acuerdo-versiones`.

2. **¿Schema de secrets.enc v1 → v2 con migración automática?**
   - Detectamos `version` ausente o `1` y migramos.
   - Si había una key en v1, la movemos a `empresas["__legacy__"]` con un warning log.
   - La UI debe pedirle al usuario que asigne esa key a una empresa específica (o que la borre si no la necesita).
   - **Recomendación:** sí, migración silenciosa para no romper instalaciones existentes.

3. **¿Rotación con grace period (key vieja sigue funcionando N minutos) o corte inmediato?**
   - **Recomendación:** corte inmediato en v1. Es más simple. La key vieja queda activa en firma-service pero K+AIR no la usa más.
   - Si hace falta rotación sin downtime, agregar `grace_period_minutes` en el endpoint de rotación en v2.

4. **¿Listar `available` (empresas K+AIR sin firma configurada) en `firma:empresa:list`?**
   - Útil para la UI (banner "Empresa X no tiene firma configurada").
   - Requiere JOIN con la tabla `companies` en main.js.
   - **Recomendación:** sí, es información valiosa.

5. **¿Qué hacer con la key legacy en v2?**
   - Opción A: Borrarla (fuerza al usuario a configurar per-empresa).
   - Opción B: Mantenerla como fallback "si no hay key per-empresa, usa la legacy" (deprecation lenta).
   - Opción C: Mantenerla solo en `empresas["__legacy__"]` con un warning visible.
   - **Recomendación:** Opción C, transitorio. En v3 (futuro) se borra.

6. **¿Generación de key: en backend o en K+AIR?**
   - **Backend** (recomendado): el backend tiene `crypto.randomBytes` y puede hashear con SHA-256. La key en plaintext solo viaja una vez (en la respuesta del endpoint de creación).
   - **K+AIR**: K+AIR no debería generar secrets para el backend. El backend es la fuente de verdad de las keys.

7. **¿Cómo manejamos el caso de que un usuario esté logueado en Empresa A pero el sistema tenga key solo para Empresa B?**
   - Mostrar mensaje claro: "Esta empresa no tiene firma electrónica configurada".
   - No intentar usar la key de B (sería cross-company, rechazado por el backend).
   - Ofrecer configurar: `firma:empresa:set-api-key` desde la UI.

8. **¿La `firmaServiceClientInstanceId` sigue siendo global o per-empresa?**
   - **Global** (recomendado): representa la instalación de K+AIR, no la empresa. Sirve para rate limiting y métricas.
   - Es lo que tiene sentido según la decisión "una instalación de K+AIR = un cliente del backend".

9. **¿Auditoría: loggear cuando se setea/rota/revoca una key?**
   - **Sí, recomendado:** `console.log` con timestamp, empresa, acción, key hash (8 primeros chars). Sin plaintext.
   - No es un audit log formal (eso es otro sistema), pero permite troubleshooting.

---

## 10. Criterios de aceptación

El diseño se considera "listo para implementar" cuando:

- [x] User aprueba §2 (storage en secrets.enc extendido)
- [x] User aprueba §3.1 (endpoint admin en backend)
- [x] User aprueba §4 (IPC channels)
- [x] User responde §9 (9 preguntas abiertas)
- [x] User resuelve 5 gaps del cross-check A↔B (ver §11)
- [x] El diseño no contradice decisiones arquitectónicas ya tomadas (D-1, D-2, D-13, I-010)

---

## 11. Decisiones ratificadas por el user (2026-08-20)

Cierre del cross-check A↔B. Estas 5 decisiones resuelven los gaps detectados
y son **binding** para los Subagentes A (backend) y B (K+AIR bridge).

### DR-1 · Crear cliente: bridge → backend (NO renderer)

**Decisión:** La llamada `POST /internal/admin/clientes` la hace el **bridge**,
no el renderer.

**Razón:** El renderer está cargado desde `file://` o protocolo Electron, no
desde `localhost:3001`. Sin CORS en firma-service (verificado en
`src/server.js:53-75`, solo helmet `defaultSrc 'self'`), el POST del renderer
sería bloqueado por el browser. Agregar CORS aumenta superficie de ataque
innecesariamente.

**Implicaciones:**
- Nuevo IPC en K+AIR: `firma:empresa:create(companyName, idEmpresa, displayName)`.
- El bridge usa el admin token (de `secrets.enc.adminApiKey`, ver DR-2) y llama al backend.
- El bridge guarda la `api_key` retornada en `secrets.enc.empresas[idEmpresa].firmaApiKey`.
- El renderer **nunca** ve el plaintext de la api_key. Solo recibe `{created: true, apiKeyHashPrefix: 'a1b2c3d4'}`.

### DR-2 · Admin token: persistido en `secrets.enc.adminApiKey`

**Decisión:** El `X-Admin-API-Key` (admin token) se persiste en `secrets.enc.adminApiKey`,
cifrado con safeStorage, una vez por instalación.

**Razón:** Si se pidiera en cada operación admin (crear, rotar, revocar, listar-remoto),
la UX sería mala y el admin tendría que recordar/guardar el token fuera de K+AIR.
Persistirlo es seguro porque el token es operator-level (no per-company) y
K+AIR asume una sola "operadora" por instalación.

**Implicaciones:**
- Schema v2 de `secrets.enc` incluye `adminApiKey` (global, top-level, junto a `firmaServiceUrl` y `firmaServiceClientInstanceId`).
- Nuevo IPC para setear: `firma:config:set-admin-key(adminApiKey)`.
- Validación: longitud mínima 32 chars (igual que per-company).
- Si `adminApiKey` no está seteada y se intenta una op admin, retorna `ADMIN_TOKEN_REQUIRED` con `extra.remediationHint: 'Configure adminApiKey via firma:config:set-admin-key'`.

### DR-3 · IPC `firma:empresa:create` agregado

**Decisión:** SÍ, agregar el IPC (ver DR-1).

**Channel:** `firma:empresa:create` (sustituye a la opción "renderer hace POST" que estaba en el spec B original).

**Razón:** Necesario para implementar DR-1 sin tocar firma-service.

**Implicaciones:**
- El bridge debe tener el admin token configurado (DR-2) ANTES de llamar.
- Si admin token falta → `ADMIN_TOKEN_REQUIRED` (sin llamada al backend).
- Si backend rechaza (401, 409, etc.) → propagar el error al renderer con detalles.

### DR-4 · DELETE/revoke en backend: V2 (no en commit 1)

**Decisión:** El endpoint `DELETE /internal/admin/clientes/:id` queda como **V2**, no en el commit 1.

**Razón:** En V1, "revocar" se simplifica a **borrar de `secrets.enc` localmente + rotar** (lo que sí marca la key como revocada en el backend vía `POST /:id/rotate`). Esto evita un endpoint más y mantiene el commit 1 enfocado.

**Implicaciones:**
- `firma:empresa:revoke-api-key` en V1 = borrar local + (opcionalmente con `revokeRemote: true`) rotar la key en backend.
- La key "revocada" sigue activa en firma-service hasta que se rote (al rotar, la vieja se marca como `revoked_at`).
- Riesgo: ventana de tiempo entre "revoke local" y "rotate" donde la key sigue activa en el backend. Mitigable rotando siempre después de revoke.

### DR-5 · Prefijo `kair_live_/kair_test_`: warning soft

**Decisión:** `firma:empresa:set-api-key` NO rechaza keys que no tengan el prefijo `kair_live_/kair_test_`. Solo emite un **warning en consola** (bridge) y un `softWarning` en el response (renderer).

**Razón:** Acoplar K+AIR al formato interno de las keys de firma-service crea
una dependencia innecesaria. Si firma-service cambia el prefijo en el futuro,
K+AIR no debería romperse.

**Implicaciones:**
- `firma:empresa:set-api-key` retorna `{stored: true, softWarning: 'Key no tiene prefijo kair_live_/kair_test_'}`.
- El bridge loggea `[FIRMA-BRIDGE] Warning: apiKey sin prefijo estándar (no kair_live_/kair_test_). Continuando por compat...`.
- Si el prefijo SÍ está, no warning.

---

## 12. Cambios resultantes a los specs A y B

### A (backend-auth-spec.md) — agregar:

- §16 Decisiones ratificadas (referencia a este §11).
- §12 (preguntas abiertas) — marcar DR-1, DR-2, DR-4, DR-5 como resueltas con la decisión del user.
- Aclarar que el endpoint `POST /internal/admin/clientes` es llamado por el bridge de K+AIR (no por un operador humano directo), porque la api_key retornada se almacena automáticamente.

### B (kair-auth-spec.md) — agregar:

- §18 Decisiones ratificadas.
- §12 (preguntas abiertas) — marcar todas como resueltas.
- §15 (cross-ref a A) — actualizar para reflejar que la llamada a `POST /internal/admin/clientes` la hace el bridge (con `adminApiKey` de `secrets.enc`), NO el renderer.
- §5 (IPC nuevo) — `firma:empresa:create(companyName, idEmpresa, displayName)`.
- §5 (IPC nuevo) — `firma:config:set-admin-key(adminApiKey)` para DR-2.
- §11 (UI) — actualizar el flujo Opción B para reflejar que la llamada pasa por el bridge (no por fetch directo del renderer).
- §2 (secrets.enc v2) — agregar campo `adminApiKey` (DR-2).
- §6 (compatibilidad) — `firma:config:set-admin-key` se agrega al conjunto de canales legacy que se mantienen (no se deprecan).

---

## 13. DR-6 — Issues residuales detectados por Subagente C (binding) — ✅ APLICADO A TODOS LOS SPECS

Subagente C (QA/integración) detectó 4 issues residuales entre A y B al
diseñar la matriz de tests. DR-6 los consolida en una decisión binding
para que A y B implementen de forma consistente.

**Status: APLICADO** (2026-08-20) — §14/§15/§16 de este doc +
actualizaciones en `backend-auth-spec.md §3.1`, `kair-auth-spec.md §5`
y `integration-test-spec.md §2 y §11`.

### DR-6.A (binding) — Bridge mapea `displayName` → `description`

B's IPC `firma:empresa:create` recibe `displayName` (campo humano).
A's body `POST /admin/clientes` requiere `description` (auditoría).

**Mapeo del bridge** (pseudo-código, implementación obligatoria):
```js
var description = `K+AIR empresa ${args.displayName} - ${config.env}`;
// Truncar a 200 chars (límite del schema)
description = description.length > 200 ? description.slice(0, 197) + '...' : description;
var body = {
  id_empresa: args.idEmpresa,
  allowed_operations: ['sign_request:create', 'sign_request:read', 'consent:create', 'consent:verify', 'audit:read'],
  description: description
};
```

### DR-6.B (binding) — `allowed_operations` default = ALL

B's IPC NO acepta `allowed_operations` del renderer. El bridge siempre
envía los 5 valores del enum de I-010:
```js
['sign_request:create', 'sign_request:read', 'consent:create', 'consent:verify', 'audit:read']
```

**Razón:** K+AIR no tiene razón para solicitar permisos parciales. El admin
de K+AIR (operador) controla la key; si quiere permisos más restrictivos,
puede rotar la key con `allowed_operations` más limitados en un endpoint
futuro.

### DR-6.C (binding) — Error code `ALREADY_CONFIGURED`

Si el bridge ya tiene `empresas[empresaKey].firmaApiKey` configurada
y el usuario llama `firma:empresa:create` con la misma empresa:

- **NO sobrescribir** la key existente (destruiría la key en uso y rompería
  sign requests en vuelo).
- Retornar error: `ALREADY_CONFIGURED` con `extra.suggestion: 'Use firma:empresa:rotate-api-key to rotate the existing key'`.

**Razón:** Conservadora. Evita pérdida accidental de credenciales. El usuario
debe ser explícito sobre rotar.

**UI recomendada** (fuera de scope de este spec): el modal de
"Configurar firma" para una empresa ya configurada muestra solo el
botón "Rotar", no "Generar nueva" (que sería create). Esto refuerza la
intención del usuario.

### DR-6.D (no bloqueante, aceptado) — `validateRemote` usa admin endpoint

B's `set-api-key` con `validateRemote: true` llama `GET /internal/admin/clientes`
(que requiere `X-Admin-API-Key`). Semánticamente raro (validamos per-company
con admin), pero funciona porque el bridge tiene `adminApiKey` (DR-2).

**Decisión:** Aceptar en V1. Alternativa futura: endpoint per-company
`GET /internal/me` (DR-8, post-I-102). Documentar como decisión técnica,
no requiere cambio en V1.

---

## 14. Cambios por aplicar a los specs — ✅ APLICADOS

### A (backend-auth-spec.md):
- §3.1 clarificar que el bridge construye `description` con formato `K+AIR empresa ${displayName} - ${env}`.
- §3.1 clarificar que `allowed_operations` viene del bridge con los 5 valores por default.
- No se requiere cambio en el schema (los 5 valores del enum siguen siendo válidos).

### B (kair-auth-spec.md):
- §2 añadir DR-6.A: `description` se construye en el bridge (no en el renderer).
- §5 añadir DR-6.B: `allowed_operations` default = ALL (5 valores).
- §5 añadir DR-6.C: `firma:empresa:create` retorna `ALREADY_CONFIGURED` si la empresa ya está en `secrets.enc.empresas`.
- §18 referenciar DR-6.

### C (integration-test-spec.md):
- §15 (incompatibilidades) agregar DR-6 como resolución de los 4 puntos.
- §2 (matriz cross-empresa) agregar casos: `ALREADY_CONFIGURED`, display name mapping, allowed_operations default.
- §11 (E2E) agregar paso: "create same empresa twice → ALREADY_CONFIGURED, no overwrite".

---

## 15. Cambios por aplicar a los specs — ✅ APLICADOS

Aplicado en este commit (2026-08-20):
- `storage-backup/specs/backend-auth-spec.md` §3.1 con DR-6.A/B/C
- `storage-backup/specs/kair-auth-spec.md` §5 con DR-6.A/B/C
- `storage-backup/specs/integration-test-spec.md` §2 y §11 con DR-6

**Próximo paso (después de aprobación de DR-6)**:
1. ✅ Actualizar A, B, C con DR-6.
2. User aprueba inicio de Fase 2.
3. Lanzar 3 subagentes (A, B, C) en paralelo para implementación.
4. Integrar y re-correr E2E real.
5. Si E2E pasa, abrir puerta a I-102.

**Próximo paso (después de aprobación):**
1. Actualizar backend-auth-spec.md con §16 (decisiones ratificadas).
2. Actualizar kair-auth-spec.md con §18 (decisiones ratificadas) + nuevos IPCs.
3. Lanzar Subagente C (QA/test matrix) con A+B actualizados como input.
4. Cuando C confirme compatibilidad, lanzar Fase 2: implementación A+B+C en paralelo.
5. Re-correr E2E real.
6. Si E2E pasa, abrir puerta a I-102.

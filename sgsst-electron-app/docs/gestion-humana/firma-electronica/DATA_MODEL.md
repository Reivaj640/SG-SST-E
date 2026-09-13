# Firma Electrónica K+AIR v1 — Modelo de Datos

**Versión del documento**: 0.1 (borrador de diseño)
**Fecha**: 2026-08-17
**Estado**: Borrador para revisión. Derivado de `ARCHITECTURE.md`. Pendiente de validación con el usuario.
**Documento rector**: [`ARCHITECTURE.md`](./ARCHITECTURE.md)

> **Aviso legal**
>
> Este documento describe la estructura de almacenamiento de la
> arquitectura **diseñada conforme al marco normativo aplicable** a la
> firma electrónica de relaciones laborales en Colombia. **No
> constituye asesoría jurídica.** La validación definitiva del
> mecanismo —incluyendo el tratamiento de datos y los plazos de
> conservación— debe realizarla un **profesional jurídico colombiano**
> antes de poner el sistema en producción.

---

## Tabla de contenidos

- [1. Principios de diseño](#1-principios-de-diseño)
- [2. Diagrama ER](#2-diagrama-er)
- [3. BD del Servicio de Firma (`firma.sqlite`)](#3-bd-del-servicio-de-firma-firmasqlite)
  - [3.1 `gh_firma_acuerdo_versiones`](#31-gh_firma_acuerdo_versiones)
  - [3.2 `gh_consentimientos_firma`](#32-gh_consentimientos_firma)
  - [3.3 `gh_firmas_electronicas` (tabla principal)](#33-gh_firmas_electronicas-tabla-principal)
  - [3.4 `gh_firma_eventos` (append-only)](#34-gh_firma_eventos-append-only)
  - [3.5 `gh_firma_sesiones` (estado transitorio)](#35-gh_firma_sesiones-estado-transitorio)
- [4. BD de K+AIR local (vista sincronizada)](#4-bd-de-kair-local-vista-sincronizada)
  - [4.1 `gh_firmas_electronicas_local`](#41-gh_firmas_electronicas_local)
  - [4.2 `gh_firma_eventos_local`](#42-gh_firma_eventos_local)
  - [4.3 `gh_consentimientos_firma_local`](#43-gh_consentimientos_firma_local)
- [5. Índices](#5-índices)
- [6. Migraciones](#6-migraciones)
- [7. Convenciones y tipos](#7-convenciones-y-tipos)
- [8. Queries comunes](#8-queries-comunes)
- [9. Consideraciones de seguridad](#9-consideraciones-de-seguridad)
- [10. Anexo: mapeo campo a campo entre BDs](#10-anexo-mapeo-campo-a-campo-entre-bds)

---

## 1. Principios de diseño

### 1.1. Dos bases de datos independientes

El Servicio de Firma y K+AIR local **NO comparten base de datos**.
Cada uno tiene su propio archivo SQLite:

| BD | Archivo | Quién la lee | Quién la escribe |
|---|---|---|---|
| **Servicio de Firma** | `firma.sqlite` | Servicio de firma, K+AIR (vía API) | Servicio de firma |
| **K+AIR local** | BD actual de K+AIR (la existente) | K+AIR | K+AIR, Servicio (vía API de sync si se requiere) |

**Razón**: si K+AIR se compromete, el Servicio sigue intacto. Si el
Servicio se cae, K+AIR sigue funcionando (las firmas pendientes se
reintentan después). El aislamiento es una forma de defensa en
profundidad.

### 1.2. K+AIR local guarda una vista sincronizada

K+AIR local mantiene **copias reducidas** de las tablas del Servicio
para mostrar el estado al RH sin tener que consultar al Servicio en
cada apertura. La sincronización es **unidireccional**: Servicio →
K+AIR. K+AIR nunca escribe en la BD del Servicio directamente; lo
hace vía API.

Las tablas locales tienen **menos campos** (omitimos datos sensibles
y metadata operativa del Servicio).

### 1.3. El Servicio es la fuente de verdad notarial

Cualquier decisión sobre una firma (estado final, hashes, eventos)
se toma contra la BD del Servicio. K+AIR local puede mostrar
información desactualizada durante segundos o minutos, pero el
Servicio siempre tiene la versión autoritativa.

### 1.4. SQL crudo, sin ORM

Usamos `better-sqlite3` directamente con SQL crudo. Razón:

- Las queries son lo bastante específicas como para que un ORM
  añada fricción sin beneficio.
- Las transacciones síncronas de `better-sqlite3` eliminan race
  conditions sin necesidad de async/await.
- Es más fácil razonar sobre rendimiento y planes de ejecución.

### 1.5. snake_case, prefijos coherentes

- Todas las tablas de Firma Electrónica usan el prefijo `gh_firma_`
  o `gh_consentimientos_` (consistente con el resto del módulo
  `gestion-humana` que usa `gh_`).
- Todas las columnas en `snake_case`.
- Las FK lógicas (no enforced) usan el patrón `id_<entidad>` (ej.
  `id_trabajador`, `id_documento`).

### 1.6. Append-only donde aplique

`gh_firma_eventos` es estrictamente append-only: **nadie hace UPDATE
ni DELETE** sobre esa tabla. La inmutabilidad se enforce a nivel de
código (no hay método de update/delete expuesto). Si un evento
tiene error, se inserta un nuevo evento de corrección con
referencia al anterior.

### 1.7. Hashes con sal para datos sensibles

- Cédulas: SHA-256 sin sal (porque necesitamos poder cotejarlas).
- OTPs: SHA-256 con sal aleatorio por OTP (el sal se guarda junto
  al hash).
- Tokens: SHA-256 sin sal (el token mismo ya tiene entropía
  suficiente).
- Correos: SHA-256 con sal (para no exponerlos en backups).

---

## 2. Diagrama ER

```
┌──────────────────────────────┐
│ gh_firma_acuerdo_versiones   │
│──────────────────────────────│
│ id (PK)                      │
│ version                      │◀────────┐
│ texto                        │         │
│ texto_hash                   │         │
│ activa                       │         │
│ ...                          │         │
└──────────────────────────────┘         │
                                         │
┌──────────────────────────────┐         │
│ gh_consentimientos_firma     │         │
│──────────────────────────────│         │
│ id (PK)                      │         │
│ id_trabajador                │         │
│ id_empresa                   │         │
│ version_acuerdo (FK lógica) ─┼─────────┘
│ hash_texto_acuerdo           │
│ correo_verificacion          │
│ otp_hash                     │
│ fecha_aceptacion             │
│ ...                          │
└──────────────────────────────┘

┌──────────────────────────────┐         ┌────────────────────────────┐
│ gh_firmas_electronicas       │         │ gh_firma_sesiones          │
│──────────────────────────────│         │────────────────────────────│
│ id (PK)                      │◀────────│ id (PK)                    │
│ id_solicitud (UNIQUE)        │1     1  │ firma_id (FK)              │
│ id_documento                 │         │ estado_sesion              │
│ id_trabajador                │         │ iniciado_en                │
│ id_empresa                   │         │ ultimo_cambio_en           │
│ tipo_firma                   │         │ cambios_estado             │
│ estado                       │         │ ...                        │
│ document_hash_original       │         └────────────────────────────┘
│ document_hash_firmado        │
│ agreement_hash               │
│ evidence_hash                │
│ token_hash (UNIQUE)          │
│ identificacion_*             │
│ otp_*                        │
│ verification_channel         │
│ fechas (creacion/expiracion/ │         ┌────────────────────────────┐
│   apertura/otp/firma/...)    │         │ gh_firma_eventos           │
│ pdf_*_path                   │1     ∞  │────────────────────────────│
│ constancia_path              ├────────▶│ id (PK)                    │
│ sync_status                  │         │ firma_id (FK)              │
│ ...                          │         │ evento                     │
└──────────────────────────────┘         │ fecha_hora                 │
                                        │ ip                         │
                                        │ user_agent                 │
                                        │ metadata (JSON)            │
                                        │ id_actor                   │
                                        └────────────────────────────┘
```

**Relaciones:**

- `gh_firmas_electronicas` 1—1 `gh_firma_sesiones` (cada solicitud
  tiene una sesión).
- `gh_firmas_electronicas` 1—∞ `gh_firma_eventos` (cada solicitud
  genera N eventos).
- `gh_firma_acuerdo_versiones` 1—∞ `gh_consentimientos_firma`
  (cada versión del Acuerdo tiene N aceptaciones).
- `gh_consentimientos_firma` se referencia desde
  `gh_firmas_electronicas.agreement_hash` (por contenido, no por FK
  dura — un Acuerdo puede tener múltiples versiones y la
  evidencia queda ligada a la versión concreta).

---

## 3. BD del Servicio de Firma (`firma.sqlite`)

### 3.1 `gh_firma_acuerdo_versiones`

**Propósito**: almacenar las versiones del texto del Acuerdo de uso
de firma electrónica. Una versión se considera activa cuando
`activa = 1`. Solo puede haber **una versión activa** a la vez
(constraint a nivel aplicación, no de BD).

| Columna | Tipo | Nullable | Default | Descripción |
|---|---|---|---|---|
| `id` | INTEGER | NO | autoincrement | PK |
| `version` | TEXT | NO | — | Identificador de versión (ej. `v1.0`, `v1.1`). **UNIQUE**. |
| `texto` | TEXT | NO | — | Texto completo del Acuerdo. |
| `texto_hash` | TEXT(64) | NO | — | SHA-256 del texto. Hex en minúsculas. |
| `fecha_vigencia_inicio` | TEXT | NO | — | ISO 8601 UTC. |
| `fecha_vigencia_fin` | TEXT | YES | NULL | ISO 8601 UTC. NULL = vigente. |
| `activa` | INTEGER | NO | 0 | 0/1. Solo una versión con `activa = 1` a la vez. |
| `creado_por` | TEXT | YES | NULL | Identificador del usuario K+AIR que aprobó la versión. |
| `kair_version` | TEXT | YES | NULL | Versión de K+AIR que introdujo esta versión del Acuerdo. |
| `fecha_creacion` | TEXT | NO | — | ISO 8601 UTC. |
| `metadata` | TEXT | YES | NULL | JSON con notas internas (no se muestra al firmante). |

**SQL de creación:**

```sql
CREATE TABLE gh_firma_acuerdo_versiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL UNIQUE,
  texto TEXT NOT NULL,
  texto_hash TEXT NOT NULL,
  fecha_vigencia_inicio TEXT NOT NULL,
  fecha_vigencia_fin TEXT,
  activa INTEGER NOT NULL DEFAULT 0,
  creado_por TEXT,
  kair_version TEXT,
  fecha_creacion TEXT NOT NULL,
  metadata TEXT
);

CREATE UNIQUE INDEX idx_acuerdo_version_unica
  ON gh_firma_acuerdo_versiones(version);
```

**Queries típicas:**

```sql
-- Obtener la versión activa
SELECT * FROM gh_firma_acuerdo_versiones
WHERE activa = 1
LIMIT 1;

-- Publicar nueva versión (desactivar la anterior en transacción)
BEGIN;
UPDATE gh_firma_acuerdo_versiones SET activa = 0;
INSERT INTO gh_firma_acuerdo_versiones
  (version, texto, texto_hash, fecha_vigencia_inicio, activa, fecha_creacion)
VALUES (?, ?, ?, ?, 1, ?);
COMMIT;
```

### 3.2 `gh_consentimientos_firma`

**Propósito**: registrar que un trabajador aceptó una versión
concreta del Acuerdo de uso. Se acepta **una vez por versión** (un
trabajador puede tener múltiples registros si cambian las versiones
del Acuerdo, pero solo uno por versión).

| Columna | Tipo | Nullable | Default | Descripción |
|---|---|---|---|---|
| `id` | INTEGER | NO | autoincrement | PK |
| `id_trabajador` | TEXT | NO | — | Cédula del trabajador o ID interno de `base_personal`. |
| `id_empresa` | TEXT | NO | — | NIT o ID interno de la empresa. |
| `version_acuerdo` | TEXT | NO | — | FK lógica a `gh_firma_acuerdo_versiones.version`. |
| `hash_texto_acuerdo` | TEXT(64) | NO | — | SHA-256 del texto exacto aceptado. |
| `correo_verificacion` | TEXT | NO | — | Correo al que se envió el OTP. |
| `correo_hash` | TEXT(64) | NO | — | SHA-256(sal + correo). Hash con sal para backups. |
| `otp_hash` | TEXT(64) | NO | — | SHA-256(sal + otp). |
| `otp_sal` | TEXT(32) | NO | — | Sal aleatorio para `otp_hash`. |
| `otp_intentos` | INTEGER | NO | — | Intentos que tomó validar el OTP. |
| `ip` | TEXT | NO | — | IP desde la que se aceptó. |
| `user_agent` | TEXT | NO | — | User-Agent del navegador. |
| `fecha_aceptacion` | TEXT | NO | — | ISO 8601 UTC. |
| `kair_version` | TEXT | NO | — | Versión de K+AIR. |
| `manifestacion_aceptada` | INTEGER | NO | 0 | 0/1. Checkbox explícito "He leído y acepto". |

**Constraints:**

```sql
-- Un trabajador acepta la misma versión UNA sola vez por empresa
CREATE UNIQUE INDEX idx_consentimiento_unico
  ON gh_consentimientos_firma(id_trabajador, id_empresa, version_acuerdo);
```

**SQL de creación:**

```sql
CREATE TABLE gh_consentimientos_firma (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_trabajador TEXT NOT NULL,
  id_empresa TEXT NOT NULL,
  version_acuerdo TEXT NOT NULL,
  hash_texto_acuerdo TEXT NOT NULL,
  correo_verificacion TEXT NOT NULL,
  correo_hash TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  otp_sal TEXT NOT NULL,
  otp_intentos INTEGER NOT NULL,
  ip TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  fecha_aceptacion TEXT NOT NULL,
  kair_version TEXT NOT NULL,
  manifestacion_aceptada INTEGER NOT NULL DEFAULT 0,
  UNIQUE (id_trabajador, id_empresa, version_acuerdo)
);
```

### 3.3 `gh_firmas_electronicas` (tabla principal)

**Propósito**: almacenar el estado y la evidencia de cada solicitud
de firma. Es la tabla que el Servicio consulta y modifica en
transacciones críticas (`DOCUMENT_VIEWED → SIGNED`).

| Columna | Tipo | Nullable | Default | Descripción |
|---|---|---|---|---|
| `id` | INTEGER | NO | autoincrement | PK |
| `id_solicitud` | TEXT | NO | — | `SIGN-YYYY-NNNNNN`. **UNIQUE**. |
| `id_documento` | TEXT | NO | — | ID del documento en K+AIR (FK lógica). |
| `id_trabajador` | TEXT | NO | — | ID del trabajador en `base_personal`. |
| `id_empresa` | TEXT | NO | — | ID de la empresa. |
| `tipo_firma` | TEXT | NO | — | `'presencial'` o `'remoto'`. |
| `estado` | TEXT | NO | `'PENDING'` | Ver [estados en ARCHITECTURE §13](#). |
| `document_hash_original` | TEXT(64) | NO | — | SHA-256 del PDF congelado. |
| `document_hash_firmado` | TEXT(64) | YES | NULL | SHA-256 del PDF firmado (calculado al cerrar). |
| `agreement_hash` | TEXT(64) | NO | — | SHA-256 del Acuerdo aceptado. |
| `evidence_hash` | TEXT(64) | YES | NULL | SHA-256 del JSON canónico de evidencia. |
| `token_hash` | TEXT(64) | NO | — | SHA-256 del token. **UNIQUE**. |
| `identificacion_tipo` | TEXT | YES | NULL | `'CC'`, `'CE'`, `'TI'`, `'PPT'`, etc. |
| `identificacion_numero_hash` | TEXT(64) | YES | NULL | SHA-256 de la cédula ingresada. |
| `identificacion_coincidio` | INTEGER | YES | NULL | 0/1/null. Resultado del cotejo. |
| `correo_verificacion` | TEXT | YES | NULL | Correo al que se envió OTP. |
| `correo_hash` | TEXT(64) | YES | NULL | SHA-256(sal + correo). |
| `otp_hash` | TEXT(64) | YES | NULL | SHA-256(sal + último OTP). |
| `otp_sal` | TEXT(32) | YES | NULL | Sal aleatorio para `otp_hash`. |
| `otp_intentos` | INTEGER | NO | 0 | Contador. |
| `otp_bloqueado` | INTEGER | NO | 0 | 0/1. Se activa al exceder `OTP_MAX_ATTEMPTS`. |
| `ip_origen` | TEXT | YES | NULL | IP del firmante. |
| `user_agent` | TEXT | YES | NULL | User-Agent del firmante. |
| `sesion_id` | TEXT | YES | NULL | ID de sesión (FK a `gh_firma_sesiones.id`). |
| `verification_channel` | TEXT | NO | `'email'` | `'email'`, futuro: `'sms'`, `'whatsapp'`. |
| `fecha_creacion` | TEXT | NO | — | ISO 8601 UTC. |
| `fecha_expiracion` | TEXT | NO | — | ISO 8601 UTC. |
| `fecha_apertura` | TEXT | YES | NULL | OPENED. |
| `fecha_otp_enviado` | TEXT | YES | NULL | OTP_SENT. |
| `fecha_otp_verificado` | TEXT | YES | NULL | OTP_VERIFIED. |
| `fecha_documento_visto` | TEXT | YES | NULL | DOCUMENT_VIEWED. |
| `fecha_manifestacion` | TEXT | YES | NULL | MANIFESTATION_RECORDED. |
| `fecha_firma` | TEXT | YES | NULL | SIGNED. |
| `fecha_revocacion` | TEXT | YES | NULL | REVOKED. |
| `motivo_revocacion` | TEXT | YES | NULL | — |
| `motivo_rechazo` | TEXT | YES | NULL | — |
| `version_kair` | TEXT | NO | — | Versión de K+AIR. |
| `manifestacion_voluntad_texto` | TEXT | YES | NULL | Texto exacto aceptado. |
| `manifestacion_voluntad_hash` | TEXT(64) | YES | NULL | SHA-256 del texto. |
| `pdf_original_path` | TEXT | YES | NULL | Ruta en el Servicio al PDF congelado. |
| `pdf_firmado_path` | TEXT | YES | NULL | Ruta en el Servicio al PDF firmado. |
| `constancia_path` | TEXT | YES | NULL | Ruta en el Servicio a la Constancia. |
| `metadata` | TEXT | YES | NULL | JSON con datos no estructurados. |

**SQL de creación:**

```sql
CREATE TABLE gh_firmas_electronicas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_solicitud TEXT NOT NULL UNIQUE,
  id_documento TEXT NOT NULL,
  id_trabajador TEXT NOT NULL,
  id_empresa TEXT NOT NULL,
  tipo_firma TEXT NOT NULL CHECK (tipo_firma IN ('presencial', 'remoto')),
  estado TEXT NOT NULL DEFAULT 'PENDING',
  document_hash_original TEXT NOT NULL,
  document_hash_firmado TEXT,
  agreement_hash TEXT NOT NULL,
  evidence_hash TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  identificacion_tipo TEXT,
  identificacion_numero_hash TEXT,
  identificacion_coincidio INTEGER,
  correo_verificacion TEXT,
  correo_hash TEXT,
  otp_hash TEXT,
  otp_sal TEXT,
  otp_intentos INTEGER NOT NULL DEFAULT 0,
  otp_bloqueado INTEGER NOT NULL DEFAULT 0,
  ip_origen TEXT,
  user_agent TEXT,
  sesion_id TEXT,
  verification_channel TEXT NOT NULL DEFAULT 'email',
  fecha_creacion TEXT NOT NULL,
  fecha_expiracion TEXT NOT NULL,
  fecha_apertura TEXT,
  fecha_otp_enviado TEXT,
  fecha_otp_verificado TEXT,
  fecha_documento_visto TEXT,
  fecha_manifestacion TEXT,
  fecha_firma TEXT,
  fecha_revocacion TEXT,
  motivo_revocacion TEXT,
  motivo_rechazo TEXT,
  version_kair TEXT NOT NULL,
  manifestacion_voluntad_texto TEXT,
  manifestacion_voluntad_hash TEXT,
  pdf_original_path TEXT,
  pdf_firmado_path TEXT,
  constancia_path TEXT,
  metadata TEXT,
  CHECK (estado IN (
    'PENDING', 'OPENED', 'IDENTIFICATION_STARTED', 'IDENTIFIED',
    'OTP_SENT', 'OTP_VERIFIED', 'DOCUMENT_OPENED', 'DOCUMENT_VIEWED',
    'MANIFESTATION_RECORDED', 'SIGNED', 'REJECTED', 'EXPIRED',
    'REVOKED', 'CANCELLED', 'OTP_LOCKED', 'IDENTIFICATION_FAILED'
  ))
);
```

**Transición crítica atómica (la firma):**

```sql
-- Esta query es la única que cierra la firma
UPDATE gh_firmas_electronicas
SET
  estado = 'SIGNED',
  document_hash_firmado = ?,
  evidence_hash = ?,
  fecha_firma = ?,
  pdf_firmado_path = ?,
  constancia_path = ?
WHERE id = ?
  AND estado = 'DOCUMENT_VIEWED';

-- Si changes() === 1, la firma fue exitosa.
-- Si changes() === 0, alguien llegó antes (race condition).
```

### 3.4 `gh_firma_eventos` (append-only)

**Propósito**: log inmutable de cada paso de la firma. Sirve para
la línea de tiempo de auditoría.

| Columna | Tipo | Nullable | Default | Descripción |
|---|---|---|---|---|
| `id` | INTEGER | NO | autoincrement | PK |
| `firma_id` | INTEGER | NO | — | FK a `gh_firmas_electronicas.id`. |
| `evento` | TEXT | NO | — | Tipo de evento (ver lista en ARCHITECTURE §21.2). |
| `fecha_hora` | TEXT | NO | — | ISO 8601 UTC con microsegundos. |
| `ip` | TEXT | YES | NULL | IP en el momento del evento. |
| `user_agent` | TEXT | YES | NULL | User-Agent en el momento del evento. |
| `metadata` | TEXT | YES | NULL | JSON con datos específicos del evento. |
| `id_actor` | TEXT | NO | — | `'trabajador'`, `'rh:<user_id>'`, `'sistema'`. |

**Reglas de aplicación:**

- ❌ NO existe método `update()` ni `delete()` para esta tabla en
  el código.
- ✅ Solo `insert()`.
- ✅ Para "corregir" un evento, se inserta un nuevo evento
  `CORRECTION_OF` con metadata `{original_event_id: X, motivo:
  "..."}`.

**SQL de creación:**

```sql
CREATE TABLE gh_firma_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firma_id INTEGER NOT NULL,
  evento TEXT NOT NULL,
  fecha_hora TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  metadata TEXT,
  id_actor TEXT NOT NULL,
  FOREIGN KEY (firma_id) REFERENCES gh_firmas_electronicas(id)
);
```

### 3.5 `gh_firma_sesiones` (estado transitorio)

**Propósito**: mantener el estado de sesión durante la firma
(servidor-side, no en memoria del proceso). Permite que un
reinicio del VPS no pierda la sesión activa.

| Columna | Tipo | Nullable | Default | Descripción |
|---|---|---|---|---|
| `id` | TEXT | NO | — | PK. UUID v4. |
| `firma_id` | INTEGER | NO | — | FK a `gh_firmas_electronicas.id`. **UNIQUE** (1 sesión por firma). |
| `estado_sesion` | TEXT | NO | — | Estado actual de la sesión. |
| `iniciado_en` | TEXT | NO | — | ISO 8601 UTC. |
| `ultimo_cambio_en` | TEXT | NO | — | ISO 8601 UTC. |
| `cambios_estado` | INTEGER | NO | 0 | Contador de transiciones. |
| `ip_actual` | TEXT | YES | NULL | — |
| `user_agent_actual` | TEXT | YES | NULL | — |
| `metadata_sesion` | TEXT | YES | NULL | JSON con datos temporales. |

**Estados posibles** (todos transitorios, ningún estado terminal
vive aquí):

```
PENDING
OPENED
IDENTIFICATION_STARTED
IDENTIFIED
OTP_SENT
OTP_VERIFIED
DOCUMENT_OPENED
DOCUMENT_VIEWED
MANIFESTATION_RECORDED
```

**SQL de creación:**

```sql
CREATE TABLE gh_firma_sesiones (
  id TEXT PRIMARY KEY,
  firma_id INTEGER NOT NULL UNIQUE,
  estado_sesion TEXT NOT NULL,
  iniciado_en TEXT NOT NULL,
  ultimo_cambio_en TEXT NOT NULL,
  cambios_estado INTEGER NOT NULL DEFAULT 0,
  ip_actual TEXT,
  user_agent_actual TEXT,
  metadata_sesion TEXT,
  FOREIGN KEY (firma_id) REFERENCES gh_firmas_electronicas(id)
);
```

---

## 4. BD de K+AIR local (vista sincronizada)

Estas tablas son **réplicas reducidas** de las del Servicio. K+AIR
las sincroniza periódicamente (o bajo demanda) para mostrar el
estado al RH sin consultar al Servicio en cada apertura.

Las tablas locales **NO tienen la metadata sensible** (OTP,
hashes de cédula, hashes de correo). Solo lo que el RH necesita
ver.

### 4.1 `gh_firmas_electronicas_local`

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | INTEGER | NO | PK. Mismo ID que en el Servicio. |
| `id_solicitud` | TEXT | NO | `SIGN-YYYY-NNNNNN`. UNIQUE. |
| `id_documento` | TEXT | NO | FK lógica a `gh_documentos.id` (en K+AIR). |
| `id_trabajador` | TEXT | NO | FK lógica a `base_personal.id`. |
| `id_empresa` | TEXT | NO | — |
| `tipo_firma` | TEXT | NO | `'presencial'` / `'remoto'`. |
| `estado` | TEXT | NO | Sincronizado del Servicio. |
| `fecha_creacion` | TEXT | NO | — |
| `fecha_expiracion` | TEXT | NO | — |
| `fecha_firma` | TEXT | YES | NULL hasta `SIGNED`. |
| `pdf_local_path` | TEXT | YES | Ruta en `<kair-data>/gh-docs/...`. |
| `constancia_local_path` | TEXT | YES | — |
| `sync_status` | TEXT | NO | `'PENDING'`, `'SYNCED'`, `'FAILED'`. |
| `sync_fecha` | TEXT | YES | — |
| `ultimo_evento` | TEXT | YES | Último evento conocido (para tooltip). |
| `ultimo_evento_fecha` | TEXT | YES | — |

**SQL de creación:**

```sql
CREATE TABLE gh_firmas_electronicas_local (
  id INTEGER PRIMARY KEY,
  id_solicitud TEXT NOT NULL UNIQUE,
  id_documento TEXT NOT NULL,
  id_trabajador TEXT NOT NULL,
  id_empresa TEXT NOT NULL,
  tipo_firma TEXT NOT NULL,
  estado TEXT NOT NULL,
  fecha_creacion TEXT NOT NULL,
  fecha_expiracion TEXT NOT NULL,
  fecha_firma TEXT,
  pdf_local_path TEXT,
  constancia_local_path TEXT,
  sync_status TEXT NOT NULL DEFAULT 'PENDING',
  sync_fecha TEXT,
  ultimo_evento TEXT,
  ultimo_evento_fecha TEXT
);
```

### 4.2 `gh_firma_eventos_local`

Réplica reducida de `gh_firma_eventos` para mostrar la línea de
tiempo en la UI de K+AIR. **No incluye** metadata sensible
(eventos con `metadata` que contenga hashes o IPs se almacenan sin
ese campo).

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | INTEGER | NO | PK. |
| `firma_id` | INTEGER | NO | FK a `gh_firmas_electronicas_local.id`. |
| `evento` | TEXT | NO | — |
| `fecha_hora` | TEXT | NO | — |
| `id_actor` | TEXT | NO | — |

```sql
CREATE TABLE gh_firma_eventos_local (
  id INTEGER PRIMARY KEY,
  firma_id INTEGER NOT NULL,
  evento TEXT NOT NULL,
  fecha_hora TEXT NOT NULL,
  id_actor TEXT NOT NULL,
  FOREIGN KEY (firma_id) REFERENCES gh_firmas_electronicas_local(id)
);
```

### 4.3 `gh_consentimientos_firma_local`

Réplica que K+AIR usa para saber **si un trabajador ya aceptó la
versión actual del Acuerdo** sin tener que consultar al Servicio.

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | INTEGER | NO | PK. |
| `id_trabajador` | TEXT | NO | — |
| `id_empresa` | TEXT | NO | — |
| `version_acuerdo` | TEXT | NO | — |
| `fecha_aceptacion` | TEXT | NO | — |
| `acepto_manifestacion` | INTEGER | NO | 0/1. |

```sql
CREATE TABLE gh_consentimientos_firma_local (
  id INTEGER PRIMARY KEY,
  id_trabajador TEXT NOT NULL,
  id_empresa TEXT NOT NULL,
  version_acuerdo TEXT NOT NULL,
  fecha_aceptacion TEXT NOT NULL,
  acepto_manifestacion INTEGER NOT NULL,
  UNIQUE (id_trabajador, id_empresa, version_acuerdo)
);
```

---

## 5. Índices

### Servicio de firma (`firma.sqlite`)

```sql
-- Búsquedas por token (las más frecuentes)
CREATE UNIQUE INDEX idx_firmas_token_hash
  ON gh_firmas_electronicas(token_hash);

-- Búsquedas por solicitud (lookups desde K+AIR)
CREATE UNIQUE INDEX idx_firmas_id_solicitud
  ON gh_firmas_electronicas(id_solicitud);

-- Listados de RH: por empresa + estado + fecha
CREATE INDEX idx_firmas_empresa_estado_fecha
  ON gh_firmas_electronicas(id_empresa, estado, fecha_creacion DESC);

-- Job de expiración: solicitudes activas por expirar
CREATE INDEX idx_firmas_estado_expiracion
  ON gh_firmas_electronicas(estado, fecha_expiracion)
  WHERE estado NOT IN ('SIGNED', 'REJECTED', 'EXPIRED', 'REVOKED', 'CANCELLED');

-- Búsquedas por documento (auditoría: todas las firmas de un doc)
CREATE INDEX idx_firmas_documento
  ON gh_firmas_electronicas(id_documento);

-- Búsquedas por trabajador
CREATE INDEX idx_firmas_trabajador
  ON gh_firmas_electronicas(id_trabajador, fecha_creacion DESC);

-- Eventos por firma (timeline)
CREATE INDEX idx_eventos_firma_fecha
  ON gh_firma_eventos(firma_id, fecha_hora);

-- Eventos por tipo (auditoría global)
CREATE INDEX idx_eventos_tipo_fecha
  ON gh_firma_eventos(evento, fecha_hora);

-- Consentimientos por trabajador
CREATE INDEX idx_consentimientos_trabajador
  ON gh_consentimientos_firma(id_trabajador, id_empresa, version_acuerdo);
```

### K+AIR local

```sql
-- Búsquedas por documento
CREATE INDEX idx_firmas_local_documento
  ON gh_firmas_electronicas_local(id_documento);

-- Listados: por estado para "pendientes de sync"
CREATE INDEX idx_firmas_local_sync
  ON gh_firmas_electronicas_local(sync_status, fecha_creacion DESC);

-- Eventos por firma
CREATE INDEX idx_eventos_local_firma
  ON gh_firma_eventos_local(firma_id, fecha_hora);
```

---

## 6. Migraciones

### 6.1. Versionado

Cada cambio de schema en el Servicio de firma se versiona con un
número `MAJOR.MINOR` y se guarda en una tabla `gh_firma_schema_migrations`:

```sql
CREATE TABLE gh_firma_schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL,
  description TEXT
);
```

### 6.2. Estructura de archivos

```
<servicio-firma>/migrations/
├── 001_initial.sql
├── 002_add_evidence_hash.sql
├── 003_add_verification_channel.sql
└── ...
```

Cada archivo `.sql` contiene todas las sentencias del cambio
(generalmente `CREATE TABLE` o `ALTER TABLE`). Se ejecuta dentro
de una transacción.

### 6.3. Lazy migration para BDs existentes

Si el Servicio se actualiza y la BD local del cliente es antigua:

1. Al arrancar, el Servicio compara su versión de schema con la
   versión de la BD.
2. Si faltan migraciones, las aplica en orden antes de abrir la BD
   al tráfico.
3. Cada migración es idempotente (`CREATE TABLE IF NOT EXISTS`,
   `ALTER TABLE ... ADD COLUMN` envuelto en `try/catch`).

### 6.4. Lazy migration en K+AIR local

K+AIR local usa el mismo patrón lazy-migration que ya tiene para
el resto de sus tablas (ver `gestion-humana-schema-sql.js`). Las
nuevas tablas se crean con `try/catch` en el bootstrap.

---

## 7. Convenciones y tipos

### 7.1. Tipos de datos

| Concepto | Tipo SQLite | Notas |
|---|---|---|
| IDs numéricos | `INTEGER PRIMARY KEY AUTOINCREMENT` | — |
| IDs UUID (sesiones) | `TEXT` | UUID v4 como string. |
| IDs de negocio | `TEXT` | `SIGN-2026-000123`. |
| Hashes SHA-256 | `TEXT(64)` | Hex en minúsculas. |
| Timestamps | `TEXT` | ISO 8601 UTC, ej. `2026-08-17T15:30:00.123Z`. |
| Booleanos | `INTEGER` | 0/1. |
| Enums | `TEXT` + `CHECK` constraint | Ver sección 7.3. |
| JSON libre | `TEXT` | JSON canónico (alfabetizado) si se va a hashear. |
| Textos largos | `TEXT` | Sin límite artificial. |

### 7.2. Naming

- Tablas: `snake_case`, prefijo `gh_firma_` o `gh_consentimientos_`.
- Columnas: `snake_case`.
- FKs lógicas: prefijo `id_` (ej. `id_trabajador`).
- Índices: prefijo `idx_` + tabla + columnas.
- Constraints UNIQUE: nombre descriptivo en singular.

### 7.3. Enums como TEXT con CHECK

En SQLite no hay ENUM nativo. Usamos `TEXT` con constraint
`CHECK`:

```sql
estado TEXT NOT NULL DEFAULT 'PENDING' CHECK (estado IN (
  'PENDING', 'OPENED', 'IDENTIFICATION_STARTED', 'IDENTIFIED',
  'OTP_SENT', 'OTP_VERIFIED', 'DOCUMENT_OPENED', 'DOCUMENT_VIEWED',
  'MANIFESTATION_RECORDED', 'SIGNED', 'REJECTED', 'EXPIRED',
  'REVOKED', 'CANCELLED', 'OTP_LOCKED', 'IDENTIFICATION_FAILED'
))
```

**Razón**: SQLite es estricto con CHECK constraints a partir de
3.3.0, y better-sqlite3 usa SQLite ≥3.38. Validar a nivel BD es
una red de seguridad adicional a la validación en aplicación.

### 7.4. Timestamps con microsegundos

Para auditoría forense, los eventos se guardan con microsegundos:

```javascript
function timestampMicro() {
  const now = new Date();
  const iso = now.toISOString(); // 2026-08-17T15:30:00.123Z
  // Convertir milisegundos a microsegundos
  return iso.replace(/\.(\d{3})Z$/, (_, ms) => `.${ms.padEnd(6, '0')}Z`);
}
```

Esto permite distinguir eventos que ocurren en el mismo
milisegundo (útil en race conditions o en pruebas de carga).

---

## 8. Queries comunes

### 8.1. Crear una nueva solicitud de firma

```sql
-- Esto se hace dentro de una transacción
BEGIN;

-- 1. Insertar la solicitud
INSERT INTO gh_firmas_electronicas (
  id_solicitud, id_documento, id_trabajador, id_empresa,
  tipo_firma, estado, document_hash_original, agreement_hash,
  token_hash, fecha_creacion, fecha_expiracion, version_kair
) VALUES (
  'SIGN-2026-000123', 'doc-456', 'trab-789', 'emp-012',
  'presencial', 'PENDING', 'a1b2c3...', 'd4e5f6...',
  'g7h8i9...', '2026-08-17T15:30:00.000Z',
  '2026-08-18T15:30:00.000Z', '0.1.189'
);

-- 2. Crear la sesión
INSERT INTO gh_firma_sesiones (
  id, firma_id, estado_sesion, iniciado_en, ultimo_cambio_en
) VALUES (
  'sess-uuid-xyz', LAST_INSERT_ROWID(), 'PENDING',
  '2026-08-17T15:30:00.000Z', '2026-08-17T15:30:00.000Z'
);

-- 3. Primer evento
INSERT INTO gh_firma_eventos (
  firma_id, evento, fecha_hora, id_actor
) VALUES (
  LAST_INSERT_ROWID(), 'CREATED',
  '2026-08-17T15:30:00.000Z', 'rh:user-001'
);

COMMIT;
```

### 8.2. Validar token al recibirlo

```sql
SELECT
  fe.id, fe.id_solicitud, fe.estado, fe.id_trabajador,
  fe.id_documento, fe.fecha_expiracion, fe.otp_bloqueado,
  fe.identificacion_coincidio,
  fs.estado_sesion
FROM gh_firmas_electronicas fe
LEFT JOIN gh_firma_sesiones fs ON fs.firma_id = fe.id
WHERE fe.token_hash = ?
LIMIT 1;
```

### 8.3. Cerrar la firma (transición atómica)

```sql
UPDATE gh_firmas_electronicas
SET
  estado = 'SIGNED',
  document_hash_firmado = ?,
  evidence_hash = ?,
  fecha_firma = ?,
  pdf_firmado_path = ?,
  constancia_path = ?,
  sesion_id = (sesion_id)  -- se mantiene
WHERE id = ?
  AND estado = 'DOCUMENT_VIEWED';

-- Verificar: if (result.changes === 1) éxito, si 0 race condition.
```

### 8.4. Listar firmas pendientes de un RH

```sql
SELECT
  id_solicitud, id_documento, id_trabajador, estado,
  fecha_creacion, fecha_expiracion
FROM gh_firmas_electronicas_local
WHERE id_empresa = ?
  AND estado IN ('PENDING', 'OPENED', 'OTP_SENT', 'DOCUMENT_VIEWED')
ORDER BY fecha_creacion DESC
LIMIT 50;
```

### 8.5. Obtener timeline de una firma

```sql
SELECT evento, fecha_hora, id_actor, metadata
FROM gh_firma_eventos
WHERE firma_id = ?
ORDER BY fecha_hora ASC;
```

### 8.6. Job de expiración (corre cada 5 minutos)

```sql
-- Marcar como expiradas las solicitudes vencidas que siguen activas
UPDATE gh_firmas_electronicas
SET estado = 'EXPIRED'
WHERE estado IN (
  'PENDING', 'OPENED', 'IDENTIFICATION_STARTED', 'IDENTIFIED',
  'OTP_SENT', 'OTP_VERIFIED', 'DOCUMENT_OPENED', 'DOCUMENT_VIEWED',
  'MANIFESTATION_RECORDED'
)
  AND fecha_expiracion < ?;

-- Por cada una afectada, insertar evento
INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, id_actor)
SELECT id, 'EXPIRED', ?, 'sistema'
FROM gh_firmas_electronicas
WHERE estado = 'EXPIRED' AND fecha_expiracion = ?;
```

### 8.7. Verificar que un Acuerdo ya fue aceptado

```sql
SELECT id
FROM gh_consentimientos_firma
WHERE id_trabajador = ?
  AND id_empresa = ?
  AND version_acuerdo = ?
  AND manifestacion_aceptada = 1
LIMIT 1;
-- Si retorna 1 fila, no hay que pedir aceptación de nuevo.
-- Si retorna 0, hay que mostrar el Acuerdo.
```

---

## 9. Consideraciones de seguridad

### 9.1. Qué NO se guarda nunca

- ❌ El token original (solo `token_hash`).
- ❌ El OTP original (solo `otp_hash` con sal).
- ❌ La cédula en texto plano (solo `identificacion_numero_hash`).
- ❌ La dirección de correo en texto plano en backups
  (se guarda `correo_hash` con sal para backups; el correo en
  plano se almacena solo en la BD operativa, no en dumps).
- ❌ Contraseñas, claves criptográficas privadas, biometría.

### 9.2. Qué SÍ se guarda y por qué

| Dato | Por qué |
|---|---|
| `document_hash_original` | Evidencia de qué documento se le presentó al firmante. |
| `document_hash_firmado` | Verificación posterior de integridad. |
| `agreement_hash` | Evidencia de qué versión del Acuerdo aceptó. |
| `evidence_hash` | Huella global verificable por terceros. |
| `identificacion_numero_hash` | Permite cotejar que el firmante es el trabajador registrado, sin guardar la cédula. |
| `correo_verificacion` | Necesario para enviar OTP y para que el RH sepa a qué correo se envió. |
| `ip`, `user_agent` | Evidencia de auditoría (anti-repudio). |
| `metadata` (JSON) | Datos no estructurados por evento. **Nunca debe contener** tokens, OTPs ni cédulas. |

### 9.3. Backups

- La BD del Servicio se respalda encriptada (AES-256) con
  periodicidad configurable (default: diario).
- Los backups **NO incluyen** los archivos de PDFs en claro
  (esos se replican por separado, también encriptados).
- La clave de encriptación de backups se almacena en un lugar
  distinto al de los datos (12-factor: configuración vs. datos).

### 9.4. Retención y borrado

- **Plazo de retención**: igual al del documento laboral firmado
  (mínimo 10 años según sugerencia, **pendiente validación
  jurídica**).
- **Borrado seguro**: al vencer el plazo, los registros se
  eliminan con `DELETE` + `VACUUM` (SQLite no borra físicamente
  con `DELETE`; `VACUUM` reescribe el archivo).
- **PDFs**: se borran del filesystem y se sobrescribe el bloque
  del disco (cuando el SO lo permita).
- **Backups**: rotación de backups con `gpg` o equivalente, con
  clave destruida al vencer el plazo.

---

## 10. Anexo: mapeo campo a campo entre BDs

| Campo Servicio | Campo K+AIR local | Notas |
|---|---|---|
| `id` | `id` | Mismo valor. |
| `id_solicitud` | `id_solicitud` | Mismo. |
| `id_documento` | `id_documento` | Mismo. |
| `id_trabajador` | `id_trabajador` | Mismo. |
| `id_empresa` | `id_empresa` | Mismo. |
| `tipo_firma` | `tipo_firma` | Mismo. |
| `estado` | `estado` | Sincronizado. |
| `document_hash_original` | — | No se replica (es metadata notarial). |
| `document_hash_firmado` | — | No se replica. |
| `evidence_hash` | — | No se replica. |
| `token_hash` | — | No se replica (es secreto del Servicio). |
| `identificacion_*` | — | No se replica. |
| `correo_*` | — | No se replica. |
| `otp_*` | — | No se replica. |
| `ip_origen`, `user_agent` | — | No se replica. |
| `fechas` | `fecha_creacion`, `fecha_expiracion`, `fecha_firma` | Solo los relevantes. |
| `pdf_original_path` | — | El Servicio lo gestiona. |
| `pdf_firmado_path` | `pdf_local_path` | Tras sync, K+AIR guarda copia. |
| `constancia_path` | `constancia_local_path` | Tras sync. |
| `version_kair` | — | No se replica. |
| `manifestacion_*` | — | No se replica. |
| `metadata` | — | No se replica. |
| — | `sync_status`, `sync_fecha` | Campos exclusivos de K+AIR. |
| — | `ultimo_evento`, `ultimo_evento_fecha` | Para tooltips. |

**Eventos:**

| Campo Servicio | Campo K+AIR local | Notas |
|---|---|---|
| `id` | `id` | Mismo. |
| `firma_id` | `firma_id` | Mismo. |
| `evento` | `evento` | Mismo. |
| `fecha_hora` | `fecha_hora` | Mismo. |
| `ip`, `user_agent` | — | No se replica. |
| `metadata` | — | No se replica. |
| `id_actor` | `id_actor` | Mismo. |

**Consentimientos:**

| Campo Servicio | Campo K+AIR local | Notas |
|---|---|---|
| `id` | `id` | Mismo. |
| `id_trabajador` | `id_trabajador` | Mismo. |
| `id_empresa` | `id_empresa` | Mismo. |
| `version_acuerdo` | `version_acuerdo` | Mismo. |
| `hash_texto_acuerdo` | — | No se replica. |
| `correo_*`, `otp_*` | — | No se replica. |
| `ip`, `user_agent` | — | No se replica. |
| `fecha_aceptacion` | `fecha_aceptacion` | Mismo. |
| `manifestacion_aceptada` | `acepto_manifestacion` | Renombrado. |

---

**Fin del documento.**

Próximo: `API.md` (contratos request/response de cada endpoint).

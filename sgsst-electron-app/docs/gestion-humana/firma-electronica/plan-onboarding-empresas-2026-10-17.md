# Onboarding de empresas en el servicio de firma — estado 2026-10-17

> **Esto es un plan, no una implementación.** En la fecha de este documento no se
> ejecutó ningún cambio de código ni de base de datos. Lo único que existe modificado
> en el árbol de trabajo es el texto del Capítulo I en
> `firma-service/scripts/fixtures/acuerdo-v1.0.txt` (sin commitear).
>
> Contexto del trabajo: el Capítulo I del Acuerdo v1.0 no identifica a la Empresa, y
> el Capítulo III describe un método criptográfico que el código no implementa. Antes
> de que firme un trabajador de una empresa real, ambas cosas tienen que estar cerradas.

---

## 1. Empresa piloto: Gestiar S.A.S.

Datos confirmados por el owner el 2026-10-17.

| # | Campo | Valor | Estado |
|---|---|---|---|
| 1 | Razón social | Gestiar S.A.S. | Confirmado |
| 2 | Domicilio | Calle 114 # 43B - 83, Atlántico - Barranquilla | **Por confirmar** |
| 3 | NIT | — | **Falta** |
| 4 | Representante legal | Javier Robles Fontalvo, CC 1044391066 | Confirmado |
| 5 | Responsable interno del tratamiento | Javier Robles Fontalvo, Representante Legal | Confirmado, falta correo |
| 6 | Canal de PQRS | — | **Falta** |
| 7 | Canal de incidentes de seguridad | — | **Falta** |
| 8 | URL de la política de tratamiento de datos | — | **Falta** |

### 1.1 Lo que hay que confirmar antes de cargar

- **El domicilio tiene formato bogotano, no barranquillano.** *Calle 114 # 43B - 83* pone la
  calle de tres cifras primero, que es la convención de Bogotá. En Barranquilla se escribe
  con la carrera primero (*Cra 43 # 12-34*). El dato va mostrado al trabajador en cada firma,
  así que hay que confirmarlo contra la cámara de comercio.
- **La cédula del representante legal queda en la evidencia de cada firma**, en
  `representante_legal_snapshot`. En la verificación pública debe salir **enmascarada**
  (`CC 1044…`), igual que la del trabajador. Hoy eso no está garantizado.
- **El NIT es el `id_empresa`** que usa el sistema y queda en la evidencia. No se puede
  inventar: sale de la cámara de comercio o del RUE.

### 1.2 Un solo correo cierra tres campos

Los campos 5, 6 y 7 (responsable interno, PQRS e incidentes de seguridad) pueden apuntar
al **mismo correo institucional**. No hace falta que sean tres direcciones distintas: que el
mismo buzón reciba PQRS e incidentes de seguridad es válido y es lo normal en una SAS de este
tamaño. Lo que sí importa es que exista y responda.

El campo 8 no se puede reutilizar: `legal/privacidad.html` y `sitio/privacidad.html` son la
política de **K+AIR/JRFSoluciones como Encargado**, no la de Gestiar como Responsable. Son
documentos distintos y el firmante necesita la de su empleador.

### 1.3 Orden de activación

```
datos completos  →  Anexo de Encargo firmado  →  empresa activada para firmar
```

Crear la empresa hoy sin el Anexo produce exactamente el defecto que se quiere cerrar: un
bloque que afirma que el firmante fue informado sobre una relación contractual que no
tiene respaldo.

---

## 2. Deuda técnica

Ordenada por lo que bloquea a lo demás. Nada de esto se ha implementado.

### Prioridad 0 — El Capítulo III describe un método que el código no usa

El texto afirma **HMAC-SHA256 con clave secreta del servicio** en 3.4(d), 3.4(e) y 3.6(e).
`grep -r createHmac firma-service/src` devuelve **cero resultados**.

Lo que hay hoy, y por qué la diferencia importa:

| Dato | Entropía | Implementación actual | ¿Se recupera con solo lectura de la BD? |
|---|---|---|---|
| Token de acceso | 192 bits | `sha256(token)` | No (2^192) |
| **Cédula del firmante** | ~10^10 | `SHA-256(sal‖número)`, **sal en la misma tabla** | **Sí, en minutos** |
| **OTP** | 10^6 | `SHA-256(sal‖otp)`, sal en la misma fila | **Sí, al instante** |

El token no es problema por su entropía. La cédula y el OTP sí, y son los que sostienen el
criterio de confiabilidad 3.7(a) y, con él, la presunción del artículo 2.2.2.47.7. Con solo
lectura de la base de datos alguien puede reconstruir la identidad de cualquier firmante y
pasar la verificación.

Camino previsto: derivar una clave HMAC de `TOKEN_ENCRYPTION_KEY` con HKDF (ya existe en
el `.env` del servidor), cambiar `sha256(sal‖x)` por `HMAC(clave, x)` y **dejar de persistir
las sales**. No requiere variables nuevas ni cambios de esquema.

### Prioridad 1 — Publicar la v1.1 con el Capítulo I corregido

**No se puede corregir la v1.0.** El capítulo 9.4 del propio Acuerdo exige que toda
modificación del contenido se publique como versión nueva con su propia huella. Y
reescribir la fila existente dejaría a `SIGN-2026-269179` apuntando a un `agreement_hash`
que ya no corresponde a ningún texto almacenado: evidencia muerta.

El texto corregido del Capítulo I ya está escrito (opción "a": el bloque de identificación
se muestra junto al Acuerdo y se incorpora a la constancia con su propia huella, **sin**
alterar el texto ni la huella del Acuerdo). Falta publicarlo como versión nueva.

### Prioridad 2 — Los datos de la empresa no existen en el sistema

`gh_internal_clients` tiene `api_key_hash`, `id_empresa`, `allowed_operations`,
`description` y fechas. **No tiene razón social, NIT, domicilio, representante legal,
responsable interno ni canal de PQRS.** `gh_firmas_electronicas` solo guarda `id_empresa`,
que es un identificador, no los datos.

Sin esto no hay bloque que renderizar. Va en una tabla aparte, `gh_firma_empresas`, **no en
`gh_internal_clients`**: esa tabla es una fila por API key y una empresa puede tener varias,
de modo que los datos de la empresa se duplicarían y el bloque dependería de qué key creó la
solicitud.

### Prioridad 3 — Migración 017 (snapshot en el consentimiento)

`gh_consentimientos_firma` ya tiene `id_empresa`, `version_acuerdo` y `hash_texto_acuerdo`
por consentimiento, con `UNIQUE (id_trabajador, id_empresa, version_acuerdo)`. El modelo ya
está listo: alcanza con dos columnas, `empresa_snapshot` y `empresa_hash`, más las de
`gh_firma_empresas`. **No se versiona el Acuerdo por empresa** — el texto sigue siendo uno.

### Prioridad 4 — El candado del Anexo de Encargo

Campo `anexo_encargo_firmado_at` en `gh_firma_empresas` y validación en
`signRequest.create()`: sin Anexo firmado, no se crea la solicitud. Convierte una afirmación
no verificable en un hecho.

Hoy: el Anexo existe solo como plantilla (`legal/anexo-encargo.html`), con "Revisión
profesional pendiente" y los datos de JRFSoluciones "pendientes de legalización". No hay
constancia de que esté firmado con nadie.

**El defecto de remisión del Acuerdo ya está corregido en el texto**: la v1.0 remitía a un
"Anexo de Transmisión de Datos Personales" y el documento real se llama "Anexo de Encargo de
Tratamiento de Datos Personales".

### Prioridad 5 — Constancia de firma (cláusula 9.6)

La constancia debe identificar la versión del Acuerdo aceptada y la huella de su texto.
Hoy la fila guarda `agreement_version` y `agreement_hash`, pero **la constancia impresa no los
muestra**.

### Prioridad 6 — Divergencia entre el fixture de desarrollo y el de producción

`acuerdo-v1.0.txt` tiene el Capítulo I corregido. **`acuerdo-dev-v1.0.txt`, que es el que lee
`seed-dev-acuerdo.js`, no.** En desarrollo se prueba contra el texto viejo y en producción
contra el nuevo. Hay que igualarlos.

---

## 3. Otros pendientes (no bloquean el alta de la empresa piloto)

| Tema | Estado |
|---|---|
| Rótulo "vence en 24 horas" hardcodeado; el TTL real es 72 | Pendiente |
| Verificación pública por `id_constancia`, para terceros sin token | Pendiente |
| Enmascarar la cédula del representante legal en la verificación pública | Pendiente |
| Suite de 973 tests: `better-sqlite3` compilado para Node 22, el Node instalado es 26 | Bloqueado por entorno |
| `npm audit`: 45 vulnerabilidades (1 low, 16 moderate, 22 high, 6 critical) | Sin revisar |
| Limpieza de datos de prueba (`SIGN-2026-269179`, trabajador `9999999999`) | Pendiente |
| Backup automático, alertas del túnel | Pendiente |
| API key de Aseplus en texto plano en el escritorio | Pendiente de tu lado |
| JRFSoluciones sin legalizar | Bloquea el Anexo de Encargo |

---

## 4. Lo que NO se debe hacer

- **Corregir la fila v1.0.** Se publica una v1.1. Ver Prioridad 1.
- **Activar una empresa sin Anexo firmado**, aunque tenga todos los datos.
- **Cargar una empresa que no exista en el RUE.** El `id_empresa` queda en la evidencia de
  cada firma; una entidad ficticia convierte un problema de escritorio en falsedad documental.
- **Meter los datos de la empresa en `gh_internal_clients`.** Ver Prioridad 2.
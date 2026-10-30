# Firma Electrónica K+AIR v1 — API

**Versión del documento**: 0.1 (borrador de diseño)
**Fecha**: 2026-08-17
**Estado**: Borrador para revisión. Derivado de `ARCHITECTURE.md` y `DATA_MODEL.md`.
**Documentos rectores**:
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`DATA_MODEL.md`](./DATA_MODEL.md)

> **Aviso legal**
>
> Este documento describe los contratos de la API del Servicio de
> Firma Electrónica K+AIR, **diseñado conforme al marco normativo
> aplicable** a la firma electrónica de relaciones laborales en
> Colombia. **No constituye asesoría jurídica.** La validación
> definitiva debe realizarla un **profesional jurídico colombiano**
> antes de producción.

---

## Tabla de contenidos

- [1. Convenciones generales](#1-convenciones-generales)
- [2. Modelo de respuesta de error](#2-modelo-de-respuesta-de-error)
- [3. Versionado y estabilidad](#3-versionado-y-estabilidad)
- [4. Rate limiting](#4-rate-limiting)
- [5. Endpoints públicos (mini-app)](#5-endpoints-públicos-mini-app)
  - [5.1 `GET /s/{token}` — carga la mini-app](#51-get-stoken--carga-la-mini-app)
  - [5.2 `POST /api/sign/{token}/identify`](#52-post-apisigntokenidentify)
  - [5.3 `POST /api/sign/{token}/verify-otp`](#53-post-apisigntokenverify-otp)
  - [5.4 `POST /api/sign/{token}/view-document`](#54-post-apisigntokenview-document)
  - [5.5 `POST /api/sign/{token}/commit`](#55-post-apisigntokencommit)
  - [5.6 `POST /api/sign/{token}/reject`](#56-post-apisigntokenreject)
  - [5.7 `GET /api/sign/{token}/document.pdf`](#57-get-apisigntokendocumentpdf)
  - [5.8 `GET /api/sign/{token}/signed-document.pdf`](#58-get-apisigntokensigned-documentpdf)
  - [5.9 `GET /api/sign/{token}/acuerdo.txt`](#59-get-apisigntokenacuerdotxt)
  - [5.10 `GET /api/sign/{token}/verify` — verificación pública](#510-get-apisigntokenverify--verificación-pública-de-una-firma)
  - [5.11 `POST /api/sign/{token}/verify-pdf`](#511-post-apisigntokenverify-pdf--comparar-la-copia-del-firmante)
  - [5.12 `POST /api/sign/{token}/consent/sensible`](#512-post-apisigntokenconsentsensible--el-consentimiento-del-dato-sensible)
- [6. Endpoints internos (K+AIR)](#6-endpoint-internos-kair)
  - [6.1 `POST /internal/sign-requests` — crear](#61-post-internalsign-requests--crear)
  - [6.2 `GET /internal/sign-requests/{id}` — consultar estado](#62-get-internalsign-requestsid--consultar-estado)
  - [6.3 `POST /internal/sign-requests/{id}/notify-remote`](#63-post-internalsign-requestsidnotify-remote)
  - [6.4 `POST /internal/sign-requests/{id}/revoke`](#64-post-internalsign-requestsidrevoke)
  - [6.5 `GET /internal/sign-requests/{id}/pdf-firmado`](#65-get-internalsign-requestsidpdf-firmado)
  - [6.6 `GET /internal/sign-requests/{id}/constancia`](#66-get-internalsign-requestsidconstancia)
  - [6.7 `GET /internal/sign-requests/{id}/eventos`](#67-get-internalsign-requestsideventos)
  - [6.8 `GET /internal/sign-requests` — listar](#68-get-internalsign-requests--listar)
  - [6.9 `GET /internal/acuerdo-activo`](#69-get-internalacuerdo-activo--obtener-versión-activa-del-acuerdo)
  - [6.10 `POST /internal/consentimientos`](#610-post-internalconsentimientos--iniciar-consentimiento)
  - [6.11 `POST /internal/consentimientos/:id/verify-otp`](#611-post-internalconsentimientosidverify-otp--verificar-otp-y-aceptar)
  - [6.12 `POST /internal/verificacion-identidad` — oráculo de identidad](#612-post-internalverificacion-identidad--oráculo-de-identidad)
  - [6.13 Endpoints de administración de empresas — `/internal/admin/empresas`](#613-endpoints-de-administración-de-empresas--internaladminempresas)
  - [6.14 `POST /internal/sign-requests/{id}/link/rotate` — el enlace, otra vez](#614-post-internalsign-requestsidlinkrotate--el-enlace-otra-vez)
  - [6.15 `GET /internal/sign-requests/{id}/link` — DEPRECADO](#615-get-internalsign-requestsidlink--deprecated)
  - [6.16 Fase 8B — metadata con lista blanca, dato sensible y representante cifrado](#616-fase-8b--metadata-con-lista-blanca-dato-sensible-y-representante-cifrado)
  - [6.17 Endpoints de las solicitudes de los Titulares — `/internal/admin/solicitudes`](#617-endpoints-de-las-solicitudes-de-los-titulares--internaladminsolicitudes)
  - [6.18 El recibo de supresión (el 3.6(g) y el 10.6)](#618-el-recibo-de-supresión-el-36g-y-el-106)
  - [6.19 La auditoría de readiness legal — `GET /internal/admin/readiness-legal`](#619-la-auditoría-de-readiness-legal--get-internaladminreadiness-legal)
  - [6.20 La carga accidental de datos de salud — `/internal/admin/sign-requests/{id}/incidente-datos-sensibles`](#620-la-carga-accidental-de-datos-de-salud--internaladminsign-requestsidincidente-datos-sensibles)
- [7. Healthcheck](#7-healthcheck)
- [8. Headers comunes](#8-headers-comunes)
- [9. Seguridad operacional](#9-seguridad-operacional)

---

## 1. Convenciones generales

### 1.1. URLs y transporte

- **Base URL producción**: `https://firma.k-air.com`
- **Base URL desarrollo**: `http://localhost:3001`
- **Transporte**: HTTPS obligatorio en producción.
- **Path style**: kebab-case para rutas, snake_case para campos en
  JSON.

### 1.2. Content-Type

- Request con body: `Content-Type: application/json; charset=utf-8`
- Upload de PDFs: `Content-Type: multipart/form-data`
- Response JSON: `Content-Type: application/json; charset=utf-8`
- Response PDF: `Content-Type: application/pdf`

### 1.3. Autenticación

| Tipo de endpoint | Mecanismo |
|---|---|
| **Públicos** (mini-app) | El `token` en la URL **es** la credencial. No hay header de auth. El Servicio valida el `token_hash` y el estado. |
| **Internos** (K+AIR) | Header `X-Internal-API-Key: <key>`. La API key se rota cada 90 días. |

### 1.4. Idempotencia

- Los endpoints públicos usan el `token` para identificar la
  solicitud. Si el mismo `token` se usa dos veces, la segunda
  llamada opera sobre el mismo registro.
- Los endpoints internos aceptan header `Idempotency-Key:
  <uuid>` para reintentos seguros. Si llega el mismo `Idempotency-Key`
  con el mismo body, el Servicio retorna la misma respuesta cacheada
  (TTL 24h).

### 1.5. JSON canónico

Para cualquier campo que vaya a ser hasheado (ej. metadata de la
evidencia, JSON embebido en la Constancia), el cliente y el
servidor deben generar JSON canónico:

- Claves ordenadas alfabéticamente en cada nivel.
- Sin espacios superfluos.
- Encoding UTF-8.
- `null` explícito (no omitir).
- Números sin notación científica innecesaria.

```javascript
function canonicalJSON(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJSON).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k =>
    JSON.stringify(k) + ':' + canonicalJSON(obj[k])
  ).join(',') + '}';
}
```

### 1.6. Timestamps

Todos los timestamps en requests y responses son **ISO 8601 UTC** con
microsegundos:

```
2026-08-17T15:30:00.123456Z
```

### 1.7. Codificación de caracteres

UTF-8 en todo (URLs, JSON, PDFs, correos).

---

## 2. Modelo de respuesta de error

Todas las respuestas de error siguen el mismo formato JSON:

```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "El token ha expirado. Solicita un nuevo enlace.",
    "details": {
      "expired_at": "2026-08-18T15:30:00.000000Z",
      "current_state": "EXPIRED"
    },
    "request_id": "req_a1b2c3d4",
    "documentation_url": "https://docs.k-air.com/firma-electronica/errores#TOKEN_EXPIRED"
  }
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `error.code` | string | Identificador único del error (UPPER_SNAKE_CASE). |
| `error.message` | string | Mensaje legible para mostrar al usuario. |
| `error.details` | object | Información adicional específica del error. |
| `error.request_id` | string | UUID de la request para soporte. |
| `error.documentation_url` | string | URL a la doc del error (opcional). |

### 2.1. Códigos HTTP

| Código | Significado | Cuándo |
|---|---|---|
| `200` | OK | Operación exitosa. |
| `400` | Bad Request | Body inválido, falta campo, formato incorrecto. |
| `401` | Unauthorized | API key inválida o ausente (solo en internos). |
| `403` | Forbidden | Operación no permitida en el estado actual. |
| `404` | Not Found | Token no existe, recurso no encontrado. |
| `409` | Conflict | Transición de estado inválida (ej. intentar firmar una solicitud ya firmada). |
| `410` | Gone | Token expirado, solicitud en estado terminal. |
| `413` | Payload Too Large | PDF demasiado grande (>10 MB). |
| `422` | Unprocessable Entity | Cédula no coincide, OTP incorrecto. |
| `429` | Too Many Requests | Rate limit excedido. |
| `500` | Internal Server Error | Error inesperado del servidor. |
| `503` | Service Unavailable | Servicio en mantenimiento. |

### 2.2. Códigos de error de aplicación

| Código | Descripción |
|---|---|
| `TOKEN_NOT_FOUND` | El enlace no está disponible. **No se confirma la existencia**: la misma respuesta para un token que nunca existió y para uno que ya no se puede mostrar. |
| `TOKEN_EXPIRED` | El token pasó su `fecha_expiracion` (la ventana para firmar). |
| `CONSERVACION_VENCIDA` | Venció el plazo de conservación que declaró la Empresa (numeral 10.6). El dato se debe suprimir: el sistema no afirma que la firma esté vigente. No aplica si hay deber legal de conservación (hold). |
| `TOKEN_ALREADY_USED` | La solicitud está en estado terminal. |
| `LINK_NOT_AVAILABLE` | El enlace no se puede entregar: la solicitud está en estado terminal, o el token no se puede recuperar (deprecated, ver §6.14). El `details.reason` dice cuál. |
| `TOKEN_LIMIT_REACHED` | **Eliminado.** La reemisión ya no tiene tope: cada una invalida el token anterior y solo queda uno vigente (3.4(c). Si la invariancia se rompiera, el error sería `500 TOKEN_INVARIANTE_ROTA`.) |
| `TOKEN_MISMATCH` | El token que vino en el body no pertenece a esta solicitud. |
| `SENSIBLE_CONSENT_NOT_ACCEPTED` | El documento trata datos sensibles de salud (10.8) y el Titular no ha dado el consentimiento expreso. El visor y el PDF quedan bloqueados. Ver §5.12 y §6.16.2. |
| `INVALID_STATE_TRANSITION` | Se intentó una transición de estado inválida. |
| `IDENTIFICATION_FAILED` | La cédula no coincide con `base_personal`. |
| `OTP_REQUIRED` | Se intentó avanzar sin OTP validado. |
| `OTP_INVALID` | OTP incorrecto. |
| `OTP_EXPIRED` | OTP venció. |
| `OTP_LOCKED` | Excedió el máximo de intentos. |
| `RATE_LIMIT_EXCEEDED` | Demasiadas requests. |
| `INVALID_API_KEY` | API key ausente o inválida. |
| `INVALID_REQUEST_BODY` | Body malformado. |
| `DOCUMENT_HASH_MISMATCH` | El PDF subido no coincide con el hash declarado. |
| `ACUERDO_NOT_FOUND` | No hay versión activa del Acuerdo. |
| `ALREADY_ACCEPTED` | El trabajador ya aceptó esta versión del Acuerdo. |
| `AGREEMENT_VERSION_NO_LONGER_ACTIVE` | La versión del Acuerdo ligada a la solicitud ya no es la vigente. **Acción**: el firmante tiene que leer y aceptar la versión vigente (la solicitud migra sola al aceptar). `details.accion = "reaceptar_version_vigente"` |
| `MEDIO_OTP_CORPORATIVO` | El OTP (dato de creación de la firma) iría a un buzón del dominio de la Empresa, que la Empresa puede leer. El mensaje cita el 3.7(a) y el 47.4, y ofrece la firma en papel (7.2). **Solo se activa con `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP=true`**, y solo cuando exista la 9A |
| `AGREEMENT_VERSION_REACCEPT_REQUIRED` | Lo mismo, detectado en la puerta del documento: sin aceptar la versión vigente no se sirve el documento (el orden (g) → (h) del 3.4). `details.accion = "reaceptar_version_vigente"` |
| `CONSENT_NOT_FOUND` | El `consent_id` no existe. |
| `EMPRESA_NOT_FOUND` | La empresa no existe en el directorio de empresas. |
| `EMPRESA_NO_HABILITADA` | La empresa registrada **no tiene el Anexo de Encargo firmado** (el 1.4) o **no tiene canal de atención** (el 7.2-7.3: sin canal, el derecho del Trabajador a la firma en papel no tiene puerta; es la decisión del owner del 2026-10-20). La solicitud de firma **no se crea**. El `details.pendientes` dice qué falta (`anexo_encargo_firmado`, `canal_pqrs`) y el mensaje dice dónde se resuelve. El override es el del D-03 (la bandera + el WARN con código + el inventario). Ver §6.16.5. **El plazo de conservación ya NO se exige**: la custodia de 80 años vive en el código (ver §6.13.6), así que la Empresa no tiene nada que declarar. |
| `PAPER_ALREADY_SIGNED` | La solicitud ya tiene una firma autográfica registrada (409). No se puede registrar dos veces |
| `PAPER_REQUEST_NOT_FOUND` | No hay firma en papel para esa solicitud (404) |
| `DOCUMENT_NOT_SIGNED` | Se pidió el suministro a una autoridad de un documento que todavía no está firmado (409) |
| `INTERNAL_ERROR` | Error del servidor. |

---

## 3. Versionado y estabilidad

- La API tiene versión **v1** implícita (no se incluye en la URL).
- Si se introducen cambios incompatibles, se creará `/v2/...`.
- La mini-app **solo consume** `/api/sign/...` y `/s/...`.
- Los endpoints internos pueden versionarse independientemente
  (`/internal/v2/sign-requests`) si es necesario.

---

## 4. Rate limiting

| Scope | Límite | Ventana | Header de respuesta |
|---|---|---|---|
| Global por IP | 60 requests | 1 min | `X-RateLimit-Limit`, `X-RateLimit-Remaining` |
| `POST /identify` por token | 5 requests | 1 hora | (idem) |
| `POST /verify-otp` por token | 5 requests | 1 OTP (10 min) | (idem) |
| `POST /commit` por token | 3 requests | 1 min | (idem) |
| `POST /reject` por token | 1 request | — | (idem) |
| Endpoints internos por API key | 1000 requests | 1 min | (idem) |
| Oráculo de identidad por empresa | 60 requests | 1 hora | `RateLimit-Policy`, `RateLimit` |
| Oráculo de identidad por empresa (ráfaga) | 10 requests | 1 min | (idem) |

Cuando se excede el rate limit, el Servicio retorna `429` con:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Demasiadas solicitudes. Intenta de nuevo en 30 segundos.",
    "details": {
      "retry_after_seconds": 30
    },
    "request_id": "req_..."
  }
}
```

Y el header:

```
Retry-After: 30
```

---

## 5. Endpoints públicos (mini-app)

### 5.1 `GET /s/{token}` — carga la mini-app

Sirve el HTML de la mini-app con el contexto de la solicitud
inyectado en el HTML (meta tags + datos en un `<script>` JSON
canónico).

**Auth**: ninguna (el token en la URL es la credencial).

**Rate limit**: 30 req/min por IP.

**Respuesta exitosa — `200 OK`**:

```
Content-Type: text/html; charset=utf-8
```

Devuelve el HTML de la mini-app con:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="sign-request" content="SIGN-2026-000123">
  <meta name="sign-token" content="...">  <!-- token original, NO el hash -->
  <meta name="kair-firma-version" content="1.0.0">
  <title>Firma electrónica — K+AIR</title>
  ...
</head>
<body>
  <div id="app"></div>
  <script id="sign-context" type="application/json">
    {
      "id_solicitud": "SIGN-2026-000123",
      "id_documento": "doc-456",
      "id_trabajador": "trab-789",
      "tipo_firma": "presencial",
      "estado": "PENDING",
      "fecha_expiracion": "2026-08-18T15:30:00.000000Z",
      "manifestacion_voluntad_texto": "Declaro que he leído, comprendido y acepto el contenido del documento.",
      "url_documento": "/api/sign/.../document.pdf"
    }
  </script>
  <script src="/static/app.js"></script>
</body>
</html>
```

**Errores**:

| Código | Cuándo | Comportamiento |
|---|---|---|
| `404` | Token no existe | Mini-app muestra pantalla de error. |
| `410` | Token expirado o estado terminal | Mini-app muestra pantalla "Este enlace ya no es válido". |

**Variante JSON — el contexto que consume la mini-app (FASE 6)**:

La mini-app pide este mismo endpoint con `Accept: application/json` y recibe
el contexto en JSON (es lo que el `<script>` de la app lee a través de
`fetch`).

```
Content-Type: application/json; charset=utf-8
Cache-Control: no-store, no-cache, must-revalidate, private
Pragma: no-cache
```

El `no-store` no es cosmético: el contexto trae datos del Firmante
(pseudónimo, correo enmascarado) y cambia en cada paso del flujo. Sin esas
cabeceras el navegador guardaba la respuesta y al volver a abrir el enlace
entregaba ese JSON crudo en vez de la mini-app — el mismo síntoma que
corrigió I-LINK-REABIERTO para el enlace ya firmado, y repetido cada vez que
el Firmante vuelve al enlace.

Dos campos del contexto gobiernan el orden (g)/(h) del flujo:

| Campo | Tipo | Qué es |
|---|---|---|
| `acuerdo` | object | El Acuerdo de uso de **esta** solicitud: `version`, `texto` y `texto_hash`. Se resuelve por `agreement_version`, no por la versión activa: el texto que el Firmante lee tiene que ser el mismo cuyo hash quedó archivado en el consentimiento. |
| `acuerdo_aceptado` | bool | Si el Firmante ya aceptó el Acuerdo en una visita anterior. La mini-app lo usa para mostrar el documento (paso (h)) sin volver a pedir la aceptación (paso (g)). |
| `dato_sensible` | object \| null | **Nuevo en la 8B.** Si el documento trata datos sensibles de salud, el aviso previo del **10.8** (categorías concretas, finalidad, base legal) y el estado del consentimiento. `null` cuando el documento no es sensible. La mini-app lo muestra **antes** del visor: si el documento se viera primero, la información "previa" no lo sería. Ver §5.12. |

---

### 5.2 `POST /api/sign/{token}/identify`

Recibe tipo + número de cédula, la coteja contra `base_personal`,
genera un OTP y lo envía al correo del trabajador.

**Auth**: ninguna (token en URL).

**Rate limit**: 5 req/hora por token.

**Request**:

```json
{
  "tipo_documento": "CC",
  "numero_documento": "1234567890"
}
```

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `tipo_documento` | string | sí | Uno de: `CC`, `CE`, `TI`, `PPT`, `PA`. |
| `numero_documento` | string | sí | 4-15 dígitos, sin puntos ni espacios. |

**Response exitosa — `200 OK`**:

```json
{
  "ok": true,
  "estado": "OTP_SENT",
  "otp_ttl_seconds": 600,
  "correo_destino_enmascarado": "juan.p****@ejemplo.com",
  "siguiente_paso": "verify-otp"
}
```

**Errores**:

| Código | Cuándo | Detalles |
|---|---|---|
| `400` | Body inválido | `INVALID_REQUEST_BODY` |
| `404` | Token no existe | `TOKEN_NOT_FOUND` |
| `410` | Estado terminal o expirado | `TOKEN_EXPIRED` o `TOKEN_ALREADY_USED` |
| `409` | Estado actual no permite identify | `INVALID_STATE_TRANSITION` (con `current_state`) |
| `422` | Cédula no coincide | `IDENTIFICATION_FAILED` |
| `429` | Rate limit | `RATE_LIMIT_EXCEEDED` |

**Ejemplo de error 422**:

```json
{
  "error": {
    "code": "IDENTIFICATION_FAILED",
    "message": "La identificación no coincide con nuestros registros.",
    "details": {
      "tipo_documento": "CC",
      "intentos_restantes": 3
    },
    "request_id": "req_..."
  }
}
```

**Side effects**:

- Inserta evento `IDENTIFICATION_STARTED` (al validar formato).
- Inserta evento `IDENTIFICATION_COMPLETED` (al validar contra BD).
- Inserta evento `IDENTIFICATION_FAILED` (si falla cotejo).
- Inserta evento `OTP_SENT` (al enviar correo).
- Genera OTP de 6 dígitos, lo hashea con sal, lo guarda.
- Envía correo al trabajador.

---

### 5.3 `POST /api/sign/{token}/verify-otp`

Valida el OTP ingresado por el trabajador.

**Auth**: ninguna (token en URL).

**Rate limit**: 5 req/OTP (se resetea con cada nuevo OTP).

**Request**:

```json
{
  "otp": "123456"
}
```

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `otp` | string | sí | Exactamente 6 dígitos numéricos. |

**Response exitosa — `200 OK`**:

```json
{
  "ok": true,
  "estado": "OTP_VERIFIED",
  "siguiente_paso": "view-document"
}
```

**Errores**:

| Código | Cuándo | Detalles |
|---|---|---|
| `400` | OTP malformado | `INVALID_REQUEST_BODY` |
| `404` | Token no existe | `TOKEN_NOT_FOUND` |
| `410` | Estado terminal o expirado | `TOKEN_EXPIRED` |
| `409` | Estado actual no permite verify | `INVALID_STATE_TRANSITION` (debe ser `OTP_SENT`) |
| `422` | OTP incorrecto | `OTP_INVALID` (con `intentos_restantes`) |
| `422` | OTP venció | `OTP_EXPIRED` |
| `422` | OTP bloqueado por exceso de intentos | `OTP_LOCKED` |
| `429` | Rate limit | `RATE_LIMIT_EXCEEDED` |

**Ejemplo de error 422 (OTP incorrecto)**:

```json
{
  "error": {
    "code": "OTP_INVALID",
    "message": "El código ingresado no es correcto.",
    "details": {
      "intentos_restantes": 2,
      "otp_ttl_seconds": 423
    },
    "request_id": "req_..."
  }
}
```

**Side effects**:

- Inserta evento `OTP_VERIFIED` (éxito) o `OTP_FAILED` (error).
- Si excede intentos: evento `OTP_LOCKED` + estado `OTP_LOCKED`.

---

### 5.4 `POST /api/sign/{token}/view-document`

Registra que el trabajador vio el documento completo (scroll hasta
el final). Es la antesala de la firma.

**Auth**: ninguna (token en URL).

**Rate limit**: 3 req/min por token.

**Request**:

```json
{
  "segundos_en_pagina": 47,
  "scroll_al_final": true
}
```

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `segundos_en_pagina` | int | sí | ≥0, ≤3600. |
| `scroll_al_final` | bool | sí | Debe ser `true` para que la firma proceda. |

**Response exitosa — `200 OK`**:

```json
{
  "ok": true,
  "estado": "DOCUMENT_VIEWED",
  "siguiente_paso": "commit",
  "manifestacion_voluntad_texto": "Declaro que he leído, comprendido y acepto el contenido del documento."
}
```

**Errores**:

| Código | Cuándo | Detalles |
|---|---|---|
| `400` | Body inválido | `INVALID_REQUEST_BODY` |
| `404` | Token no existe | `TOKEN_NOT_FOUND` |
| `410` | Estado terminal o expirado | `TOKEN_EXPIRED` |
| `409` | Estado actual no permite view | `INVALID_STATE_TRANSITION` (debe ser `OTP_VERIFIED`) |
| `409` | El Acuerdo todavía no está aceptado | `CONSENT_NOT_ACCEPTED` (FASE 6, ver abajo) |
| `422` | No scrolleó al final | `INVALID_REQUEST_BODY` (con `scroll_al_final: false`) |

**Precondición — el Acuerdo tiene que estar aceptado (FASE 6, orden (g)/(h))**:

Este endpoint es el que registra que el Firmante vio el documento, o sea el
paso (h). El 3.4 del Acuerdo de uso pone el (g) —leer y aceptar el
Acuerdo— **antes** del (h): "El Trabajador no puede avanzar en el flujo sin
leer y aceptar el Acuerdo." Por eso registrar la visualización exige que el
consentimiento vinculado esté aceptado. Con el OTP verificado pero sin
aceptación, la respuesta es `409 CONSENT_NOT_ACCEPTED` (un solo código para
todos los casos en que falta la aceptación; no expone el id ni el estado del
consentimiento).

**Side effects**:

- Inserta evento `DOCUMENT_OPENED` (al abrir el visor).
- Inserta evento `DOCUMENT_VIEWED` (al confirmar scroll final).

---

### 5.5 `POST /api/sign/{token}/commit`

**El endpoint crítico**. Cierra la firma. Calcula hashes, persiste
el estado, genera el PDF firmado y la Constancia.

**Auth**: ninguna (token en URL). Pero el backend valida
múltiples condiciones en orden:

1. Token existe.
2. Token no expirado.
3. Estado actual es `DOCUMENT_VIEWED`.
4. OTP fue verificado.
5. Manifestación fue registrada.
6. Hash del documento subido coincide con `document_hash_original`
   (en caso de re-upload).

**Rate limit**: 3 req/min por token.

**Request**:

```json
{
  "manifestacion_aceptada": true
}
```

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `manifestacion_aceptada` | bool | sí | Debe ser `true`. |

El body es **estricto**: cualquier clave que no sea `manifestacion_aceptada` se
rechaza con `400`. En particular, **`firma_visual_png` NO se admite** (código
`FIRMA_VISUAL_NO_ADMITIDA`): el sistema no la conserva, el 10.2 del Acuerdo es
una lista cerrada y la firma autográfica es un dato de carácter especial (art.
5 de la Ley 1581) que exigiría aviso, consentimiento expreso y su propia
categoría de retención. Antes el campo se aceptaba y se **ignoraba en
silencio**: un cliente creía que su firma visual había quedado firmada. Si se
necesita, el camino es la firma autográfica sobre papel (numeral 7.2).

**Response exitosa — `200 OK`**:

```json
{
  "ok": true,
  "estado": "SIGNED",
  "id_solicitud": "SIGN-2026-000123",
  "document_hash_firmado": "9a73f8c7...",
  "evidence_hash": "c4d8e2f1...",
  "fecha_firma": "2026-08-17T15:30:00.123456Z",
  "constancia_url": "/api/sign/SIGN-2026-000123/constancia.pdf",
  "pdf_firmado_url": "/api/sign/SIGN-2026-000123/pdf-firmado.pdf"
}
```

**Errores**:

| Código | Cuándo | Detalles |
|---|---|---|
| `400` | Body inválido, `manifestacion_aceptada: false` o clave no admitida | `INVALID_REQUEST_BODY` o `FIRMA_VISUAL_NO_ADMITIDA` |
| `404` | Token no existe | `TOKEN_NOT_FOUND` |
| `410` | Estado terminal o expirado | `TOKEN_EXPIRED` o `TOKEN_ALREADY_USED` |
| `409` | Estado actual no es `DOCUMENT_VIEWED` | `INVALID_STATE_TRANSITION` (race condition con otro firmante) |
| `422` | Hash no coincide | `DOCUMENT_HASH_MISMATCH` |
| `429` | Rate limit | `RATE_LIMIT_EXCEEDED` |

**Side effects (todos dentro de una transacción atómica)**:

1. Calcula `document_hash_firmado` = SHA-256(bytes PDF firmado).
2. Genera JSON canónico de evidencia con todos los campos.
3. Calcula `evidence_hash` = SHA-256(json_evidence).
4. UPDATE atómico `gh_firmas_electronicas SET estado='SIGNED' WHERE
   id=? AND estado='DOCUMENT_VIEWED'`.
5. Verifica `changes() === 1`. Si no, aborta con 409.
6. Genera PDF firmado (con o sin firma visual embebida).
7. Genera Constancia PDF.
8. Inserta eventos: `MANIFESTATION_RECORDED`, `SIGN_COMMITTED`,
   `PDF_GENERATED`, `COPY_SENT`.
9. Marca solicitud como `SYNC_PENDING` para K+AIR.
10. Envía correo con PDF firmado + Constancia al trabajador.

**Atomicidad**: si CUALQUIER paso falla, la transacción hace
rollback. El estado queda como estaba (`DOCUMENT_VIEWED`) y se
puede reintentar.

---

### 5.6 `POST /api/sign/{token}/reject`

Registra el rechazo explícito del documento por parte del
trabajador.

**Auth**: ninguna (token en URL).

**Rate limit**: 1 req/token (un rechazo es definitivo).

**Request**:

```json
{
  "motivo": "No estoy de acuerdo con la cláusula de exclusividad."
}
```

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `motivo` | string | no | ≤1000 caracteres. |

**Response exitosa — `200 OK`**:

```json
{
  "ok": true,
  "estado": "REJECTED",
  "id_solicitud": "SIGN-2026-000123",
  "fecha_rechazo": "2026-08-17T15:30:00.123456Z"
}
```

**Errores**:

| Código | Cuándo | Detalles |
|---|---|---|
| `400` | Motivo >1000 chars | `INVALID_REQUEST_BODY` |
| `404` | Token no existe | `TOKEN_NOT_FOUND` |
| `410` | Estado terminal | `TOKEN_ALREADY_USED` |
| `409` | Estado actual no permite reject | `INVALID_STATE_TRANSITION` |

**Side effects**:

- UPDATE `gh_firmas_electronicas SET estado='REJECTED' WHERE
  id=? AND estado IN (estados permitidos)`.
- Inserta evento `REJECTED` con `motivo`.

---

### 5.7 `GET /api/sign/{token}/document.pdf`

Devuelve el PDF original (congelado) para mostrar en el visor. Es el paso
**(h)** del 3.4 del Acuerdo de uso: "El Trabajador visualiza y descarga el
documento objeto de la firma".

**Auth**: ninguna (token en URL).

**Rate limit**: 5 req/hora por token.

**Precondición — el Acuerdo tiene que estar aceptado (FASE 6, orden (g)/(h))**:

El 3.4(g) pacta el orden del flujo: primero el Trabajador lee y acepta el
Acuerdo, después (h) ve el documento. "El Trabajador no puede avanzar en el
flujo sin leer y aceptar el Acuerdo." Por eso este endpoint **exige que el
consentimiento vinculado esté aceptado** (misma empresa, misma versión del
Acuerdo). Con el OTP verificado pero sin aceptación, la respuesta es:

```
409 CONSENT_NOT_ACCEPTED
```

El camino de error es **uno solo** para todos los casos en que el Firmante
todavía no aceptó (no hay consentimiento, no existe, no está aceptado, o el
dato es inconsistente): el Firmante solo necesita saber que tiene que leer y
aceptar el Acuerdo, y la respuesta no expone el id del consentimiento ni su
estado. El detalle fino (`CONSENT_NOT_FOUND`, `CONSENT_WORKER_MISMATCH`,
`CONSENT_COMPANY_MISMATCH`, `CONSENT_VERSION_MISMATCH`) lo sigue dando el
commit, donde el dato inconsistente tiene que ser rastreable.

**Response exitosa — `200 OK`**:

```
Content-Type: application/pdf
Content-Disposition: inline; filename="documento.pdf"
Content-Length: 245678
Cache-Control: no-store
```

**Errores**:

| Código | Cuándo |
|---|---|
| `404` | Token no existe |
| `410` | Estado terminal o expirado |
| `409` | Estado actual no permite ver el documento (ej. no identificado aún) |
| `409` | `CONSENT_NOT_ACCEPTED`: el Acuerdo todavía no está aceptado (falta el paso (g)) |

**Headers de seguridad**:

```
X-Content-Type-Options: nosniff
Content-Security-Policy: default-src 'none'
X-Frame-Options: SAMEORIGIN
```

---

### 5.8 `GET /api/sign/{token}/signed-document.pdf`

Devuelve el PDF **firmado**. Es el **5.4** del Acuerdo de uso: "El Firmante
puede imprimir o descargar copia de este Acuerdo y del documento firmado
desde el propio enlace de firma, sin costo alguno."

**Auth**: ninguna (token en URL).

**Rate limit**: 5 req/hora por token.

**Qué es y qué no es**:

- Es **de solo lectura**: el enlace es de un solo uso (3.4(c)) y esto **no
  reabre el flujo**. Identificar, pedir OTP, aceptar el Acuerdo y firmar
  siguen cerrados en estado firmado. Lo único que hace este endpoint es
  bajar lo que ya está firmado.
- **El token solo no sirve el PDF firmado antes de la identidad**: en
  cualquier estado previo a la firma la respuesta es `409`. Un enlace que no
  pasó por OTP y aceptación del Acuerdo no descarga nada.
- Se sirve el PDF **firmado** (`pdf_firmado_path`), no el original. El
  original es el paso (h) y va por `document.pdf`.
- El enlace tiene que seguir vigente: si el token expiró, `410`.

**Response exitosa — `200 OK`**:

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="SIGN-2026-000123-firmado.pdf"
Content-Length: 261700
Cache-Control: private, no-store
```

**Errores**:

| Código | Cuándo |
|---|---|
| `404` | Token no existe, o la solicitud no tiene PDF firmado |
| `409` | `SIGNED_DOCUMENT_NOT_AVAILABLE`: la firma todavía no ocurrió |
| `410` | Token expirado (el enlace no da más) |

---

### 5.9 `GET /api/sign/{token}/acuerdo.txt`

Devuelve el **texto del Acuerdo de uso** que el Firmante aceptó. Es la
otra mitad del 5.4 ("descargar copia de este Acuerdo [...] desde el propio
enlace de firma").

**Auth**: ninguna (token en URL).

**Rate limit**: 5 req/hora por token.

**Qué es exactamente**:

- El texto es el de la **versión ligada a la solicitud**
  (`agreement_version`), no el de la versión activa. Razón: el
  consentimiento que se registró al marcar la casilla guarda
  `hash_texto_acuerdo` de esa versión puntual. Servir el texto de la activa
  haría que el Firmante descargara un documento cuyo hash no es el que quedó
  archivado.
- La cabecera `X-Acuerdo-SHA256` lleva ese hash, para que el Firmante pueda
  comprobar que la copia es la que aceptó.
- El texto no lleva datos personales.

**Response exitosa — `200 OK`**:

```
Content-Type: text/plain; charset=utf-8
Content-Disposition: attachment; filename="acuerdo-uso-v1.0.txt"
X-Acuerdo-Version: v1.0
X-Acuerdo-SHA256: c72fac89ade6087736c301763c92431b6d53452915c5bfa77596451e71f45734
Cache-Control: private, no-store
```

**Errores**:

| Código | Cuándo |
|---|---|
| `404` | Token no existe, o no se encontró el Acuerdo de esa versión |
| `410` | Token expirado |

---

### 5.10 `GET /api/sign/{token}/verify` — verificación pública de una firma

Devuelve los datos públicos de la firma para que un tercero pueda confirmar
que el documento es el que se firmó y que su contenido no cambió.

**Auth**: ninguna (token en URL). Es una operación **histórica**: se puede
consultar aunque la ventana para firmar ya haya vencido.

**Rate limit**: 30 req/min por IP+token.

**Qué devuelve**:

- `id_solicitud`, `estado`, `fecha_firma`.
- Los tres hashes archivados: `document_hash_original`, `document_hash_firmado`,
  `evidence_hash`.
- `integridad_documento`: `{ verificado, coincide, motivo }`. El servidor
  **recalcula** el SHA-256 del PDF firmado en disco y lo compara con el hash
  archivado. `verificado` distingue "no comprobamos" de "comprobamos y NO
  coincide": la pantalla nunca afirma integridad sin comprobar.
- Los firmantes, con la identificación enmascarada y el correo enmascarado.

**Reglas de estado** (Fase 8A.1):

| Situación | Respuesta |
|---|---|
| Token válido, plazo de conservación vigente | `200` con los datos |
| Token válido, **ventana para firmar vencida**, plazo vigente | `200` (consultar lo ya firmado no depende de poder firmar) |
| Token válido, **plazo de conservación vencido** y sin deber legal de conservación | `410 CONSERVACION_VENCIDA` — "No disponible por vencimiento del plazo" |
| Token válido, plazo vencido **pero con deber legal de conservación (hold)** | `200` (el dato se conserva: el deber legal prima) |
| Token inexistente | `404 TOKEN_NOT_FOUND` con mensaje "No disponible" (no se confirma la existencia) |

**Errores**:

| Código | Cuándo |
|---|---|
| `404` | Token no disponible (`TOKEN_NOT_FOUND`) |
| `410` | Plazo de conservación vencido (`CONSERVACION_VENCIDA`) |

---

### 5.11 `POST /api/sign/{token}/verify-pdf` — comparar la copia del firmante

Compara el PDF que el firmante tiene en su computador contra el que se
almacenó firmado. No expone el contenido del PDF: solo los hashes.

**Auth**: ninguna (token en URL).

**Body**: `{ "pdf_base64": "<base64 del PDF>" }`, con el PDF de hasta 50 MB.
Se validan los *magic bytes* (`%PDF-`).

**Response exitosa — `200 OK`**:

```json
{
  "matches": true,
  "server_hash": "…",
  "computed_hash": "…",
  "message": "El archivo que subiste es exactamente el que se firmó."
}
```

Registra el evento `PDF_VERIFIED` con el resultado, para auditoría.

**Errores**:

| Código | Cuándo |
|---|---|
| `400` | Body inválido, no es un PDF, o el archivo no es decodificable |
| `404` | Token no disponible (`TOKEN_NOT_FOUND`) |
| `410` | Plazo de conservación vencido (`CONSERVACION_VENCIDA`) |

---

### 5.12 `POST /api/sign/{token}/consent/sensible` — el consentimiento del dato sensible

> **Nuevo en la 8B.** Es el endpoint del **10.8**: cuando el documento trata
> datos sensibles de salud, el Titular tiene que autorizar **de forma expresa**
> ese tratamiento, en una casilla **separada** de la aceptación del Acuerdo.
> Sin esa autorización, el visor y el PDF del documento **no se abren**.

**Auth**: ninguna (token en URL).

**Body**:

```json
{
  "aceptado": true,
  "categorias": ["SALUD_MENTAL", "HISTORIAL_CLINICO"],
  "finalidad": "Constitucion y(actualizacion) del expediente laboral",
  "base_legal": "Art. 10 Ley 1581 de 2012 (datos sensibles)"
}
```

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `aceptado` | bool | sí | `true` autoriza; `false` **rechaza**. El rechazo también se registra. |
| `categorias` | array de string | no | Las categorías que el Titular entendió. Se guardan con el consentimiento. |
| `finalidad` | string | no | Para qué se usa el dato. |
| `base_legal` | string | no | Base legal del tratamiento. |

**Response exitosa — `200 OK`**:

```json
{
  "id_solicitud": "SIGN-2026-000123",
  "dato_sensible": true,
  "consentimiento_registrado": true,
  "aceptado": true,
  "via_alternativa": null
}
```

Cuando el Titular **rechaza** (`aceptado: false`), la respuesta trae
`"via_alternativa": "firma_en_papel"`: el sistema no "decide" por el Titular, le
ofrece la vía que el **7.2** del Acuerdo contempla (firmar en papel). El
rechazo queda registrado con la misma trazabilidad que la aceptación.

**Errores**:

| Código | Cuándo |
|---|---|
| `400` | Body inválido |
| `404` | Token no disponible (`TOKEN_NOT_FOUND`) |
| `410` | Plazo de conservación vencido (`CONSERVACION_VENCIDA`) |

**Dónde se bloquea sin este consentimiento**:

| Endpoint | Respuesta |
|---|---|
| `POST /api/sign/{token}/view-document` | `409 SENSIBLE_CONSENT_NOT_ACCEPTED` |
| `GET /api/sign/{token}/document.pdf` | `409 SENSIBLE_CONSENT_NOT_ACCEPTED` |

En ambos casos la respuesta trae `details.requiere_consentimiento_sensible:
true` y el aviso previo (`details.aviso`), para que la mini-app pueda mostrar
qué se está pidiendo en vez de un error seco.

### 5.13 `POST /api/solicitudes` - el canal de datos de K+AIR (el 10.7(b))

**Auth**: ninguna. Es el canal **público** por el que un Titular ejerce sus
derechos ante K+AIR, que es el Encargado. No es el canal de la Empresa (que
sigue siendo el del 10.7 literal b, `canal_pqrs`): K+AIR **no resuelve**, pero
tampoco puede ser un punto ciego. Recibe, registra, trasmite y da constancia.

**Request**:

```json
{
  "tipo": "ACCESO",
  "nombre": "Titular",
  "correo": "titular@example.com",
  "documento": "1234567890",
  "contenido": "Solicito copia de mi constancia."
}
```

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `tipo` | enum | sí | `ACCESO` \| `CORRECCION` \| `RECTIFICACION` \| `SUPRESION` \| `REVOCACION` \| `RECLAMO` \| `OTRO` |
| `correo` | string | sí | Email válido. Es a donde se contesta |
| `nombre` | string | no | ≤200 chars |
| `documento` | string | no | Se guarda **como huella**, nunca en claro (el mismo principio de la 10.5(a)) |
| `contenido` | string | no | ≤4000 chars |

**Response — `201 Created`**:

```json
{
  "folio": "SOL-20261020-7F3A9C21",
  "id_solicitud": 12,
  "estado": "RECIBIDA",
  "plazo_tramite": "2026-10-22T15:00:00.000Z",
  "mensaje": "Recibimos tu solicitud. K+AIR la registró y la va a trasmitir a la Empresa, que es quien debe responder. Puedes preguntar por ella con el folio SOL-20261020-7F3A9C21."
}
```

El **plazo de trasmisión** son los días hábiles que fija la política
(`FIRMA_PLAZO_TRAMITE_DIAS`, default 2). El fin de semana no cuenta.

**Lo que NO hace**: K+AIR no resuelve. La respuesta es de la Empresa, que es
la Responsable (10.7 literal d). El flujo completo (recibir → trasmitir →
responder) se opera desde el API de administración (§6.14).

**Errores**: `400` body inválido (`INVALID_REQUEST_BODY`), `429` rate limit
(`RATE_LIMIT_EXCEEDED`).

### 5.14 Los dos canales de K+AIR
| Canal | Para qué | Config | Dónde se publica |
|---|---|---|---|
| **Incidentes** | Avisar que se comprometieron los datos de creación de la firma (OTP, enlace). El 5.1(c) | `FIRMA_CANAL_INCIDENCIAS` | Mini-app (pie) y correo de invitación |
| **Protección de datos** | Ejercer los derechos del Titular. El 10.7(b) | `FIRMA_CANAL_PROTECCION_DATOS` | Mini-app (pie) y correo de invitación |

Son **distintos**: un solo canal con dos nombres es un punto ciego con otro
nombre. Los dos tienen que ser buzones reales y monitoreados antes de
publicar la v1.1.

### 5.14-bis El medio del OTP (D-2): el canal del código de verificación

El `correo_verificacion` cumple **dos papeles**: a dónde va la **invitación**
(con el token de acceso) y a dónde va el **OTP** (el dato de creación de la
firma). La app de escritorio precarga ese campo con el correo del trabajador en el
registro de la Empresa: en la práctica, el código le llega a un buzón que la
Empresa puede leer, y eso rompe el 2.2.2.47.4 núm. 1 ("los datos de creación de la
firma... corresponden exclusivamente al firmante").

**Son dos canales distintos:**

| Canal | Destino | Quién lo define |
|---|---|---|
| Invitación (token) y copia firmada | `correo_verificacion` (el contacto registrado por la Empresa) | La Empresa |
| **OTP** (dato de creación) | `correo_otp`: el medio **personal** que la Empresa no administra | **La Empresa** lo declara al crear la solicitud (`correo_otp` en el metadata); si no lo tiene, el Trabajador lo declara en la mini-app |

**Declarar el medio** (la Empresa lo declara al crear la solicitud; el Trabajador,
si la Empresa no lo tiene, en la mini-app):

```
POST /api/sign/{token}/medio
{ "correo": "mipersonal@ejemplo.net" }
```

El medio queda **congelado** en cuanto sale un código: después de eso, el código
ya viajó y cambiar el destino rompería la trazabilidad del 3.4(e).

**El rechazo (D2) está APAGADO** (`FIRMA_EXIGIR_MEDIO_PERSONAL_OTP`, default
false). Se enciende cuando exista la 9A (la firma en papel): sin esa salida, exigir
un medio personal sería una barrera de acceso al empleo (el 2.2.1.1.11).

Mientras está apagado, cada caso en el que el OTP cae en un buzón corporativo
queda en el log como `WARN` con el código `OTP_MEDIO_CORPORATIVO`: de ahí sale el
número de `scripts/inventario-buzon-corporativo.js`.

**Qué es un buzón corporativo**: un dominio en la lista explícita de la empresa
(`dominios_corporativos`) o deducido de los correos que ya registró (canales de PQRS
y de incidentes, responsable de tratamiento, canal para pedir copia).

### 5.14-ter La firma en papel (la 9A, el 7.1-7.3)

El 7.2 del Acuerdo: *"El Trabajador tiene derecho a que la Empresa le provea
la firma de forma autográfica, sobre soporte papel, en todo momento y sin
costo alguno, y a que el documento así firmado tenga la misma validez y
efectos que el firmado electrónicamente."* Y el 7.3: la imposibilidad de
firmar electrónicamente **no puede ser una barrera de acceso al empleo**.

#### Dónde está la vía en papel: NO en la mini-app

**Decisión del owner (2026-10-20): la mini-app no menciona el papel.**

El motivo es jurídico y es el que la consulta legal dejó entrever: el 7.2 es un
**deber de la Empresa** (proveer la firma autográfica), no una promesa del
producto. Si la pantalla dice "tu empresa te la va a entregar", K+AIR está
prometiendo en nombre de la Empresa algo que K+AIR no puede garantizar
(veracidad y transparencia: Ley 1581 art. 4(d)(e); D.1377 art. 4: "No se podrán
utilizar medios engañosos o fraudulentos"). Si la Empresa no entrega, el que
queda mintiendo es el texto del producto.

Así que la vía en papel queda así:

| Dónde | Qué |
|---|---|
| El **Acuerdo** (Capítulo VII) | El derecho: los numerales 7.1-7.3, que son una condición más favorable al Trabajador, no un requisito de forma (la norma no exige contenido mínimo del Acuerdo) |
| El **correo de invitación** | La comunicación de la Empresa: le dice que puede pedir el papel, que no tiene costo y que no le perjudica. Es el deber de la Empresa, ejercido por la Empresa |
| El **canal de atención de la Empresa** | La puerta: el Trabajador pide el papel por ahí (el que la Empresa publica en su ficha y en el Acuerdo) |
| **K+AIR (interno)** | El registro: la Empresa da de alta el documento firmado a mano, con su huella, su Registro de firma autográfica y la entrega de la copia |

Lo que **no** hay: ninguna ruta pública para pedir el papel, ni botón, ni
pantalla en la mini-app. No es que el derecho no exista: es que lo ejerce la
Empresa, y el producto no le habla en nombre del Trabajador.

#### El asiento de la OFERTA (`PAPER_OPTION_AVAILABLE`)

La petición del Trabajador no prueba que la opción estuviera disponible; el
asiento de la **oferta** sí lo prueba. Se escribe cuando la Empresa manda el
correo de invitación, y guarda la **huella SHA-256 del cuerpo enviado**
(`hash_oferta`): eso es lo que quedó archivado de lo que el Trabajador leyó.

**No guarda IP ni user-agent**: no es una manifestación del Trabajador, es la
constancia de una oferta (minimización, Ley 1581 art. 4(d)).

#### Lo que hace la Empresa (interno)

| Endpoint | Para qué |
|---|---|
| `POST /internal/sign-requests/{id}/firma-papel` | La Empresa registra el documento **ya firmado en papel** (multipart, campo `documento`; `metadata` opcional con `{canal, nota}`). Si la vía no estaba abierta, se abre con el asiento `PAPER_TRACK_OPENED` (que guarda el canal por el que llegó la petición). El sistema guarda el PDF, calcula su huella, genera el **Registro de firma autográfica** y le entrega la copia al Trabajador por un medio autorizado. La vía electrónica queda **cerrada** (nada de doble firma). Si la firma electrónica ya salió, responde `409 INVALID_STATE_TRANSITION` |
| `GET /internal/sign-requests/{id}/medios` | Los medios autorizados y cuáles están activos: es por ahí por dónde la Empresa puede entregar la copia (el 8.2) |
| `POST /internal/sign-requests/{id}/suministro-autoridad` | El asiento del suministro del documento a una autoridad judicial o de IVC (el 8.4): `{autoridad, radicado?, destinatario?, pdf_sha256?}`. Queda en el registro de eventos (`DOCUMENT_SUPPLIED_TO_AUTHORITY`) |

#### `GET` y `POST /api/sign/{token}/medios`

Los medios electrónicos autorizados por el Trabajador (el 8.2). El 8.2 los
autoriza de entrada (el correo de la hoja de vida y el enlace de K+AIR) y le da
el derecho a modificarlos *"en cualquier momento y sin costo alguno"*.

| Método | Body | Requiere |
|---|---|---|
| `GET` | — | La solicitud identificada |
| `POST` | `{accion: "ALTA"\|"BAJA", tipo: "CORREO_OTP", correo}` | La solicitud identificada |

**Un medio nuevo nace `PENDIENTE`**: hasta que el Trabajador demuestra que lo
controla (el código de verificación llega a ese medio y lo verifica), no
sirve para entregar copias. Si un medio naciera activo, cualquiera que tuviera
el enlace podría escribir un correo ajeno en el registro, y a partir de ahí
la Empresa le entregaría la copia del documento a un desconocido.

#### Lo que hace la Empresa (interno)

| Endpoint | Para qué |
|---|---|
| `GET /internal/sign-requests/{id}/medios` | Los medios autorizados y cuáles están activos: es por ahí por dónde la Empresa puede entregar la copia (el 8.2) |
| `POST /internal/sign-requests/{id}/suministro-autoridad` | El asiento del suministro del documento a una autoridad judicial o de IVC (el 8.4): `{autoridad, radicado?, destinatario?, pdf_sha256?}`. Queda en el registro de eventos (`DOCUMENT_SUPPLIED_TO_AUTHORITY`) |


**El Registro de firma autográfica** es el equivalente del Registro de firma
electrónica: registra los HECHOS del acto (quién, cuándo, con qué huella,
contra qué versión del Acuerdo). **Cita** el 7.2 y el 7.3 del Acuerdo
verbatim: no concluye nada que el Acuerdo no diga.

### 5.15 La versión vigente del Acuerdo (la 10.4, el camino positivo del 9.5)

El 9.5 dice: *"Para las firmas posteriores a la entrada en vigencia de una
versión nueva, el Trabajador debe leer y aceptar esa versión nueva en el
momento mismo de la firma."*

**El problema que resuelve**: si se publica una v1.1 del Acuerdo mientras hay
solicitudes pendientes, el firmante que llega tarde se encontraba con un **409
sin salida** (la solicitud estaba ligada a la versión anterior, que ya no era
la vigente). Eso impedía publicar la v1.1: cambiar el hash del Acuerdo dejaba
a los trabajadores con enlaces colgados.

**Cómo funciona ahora**:

| Paso | Qué hace |
|---|---|
| `GET /s/{token}` | El firmante ve la **versión vigente** del Acuerdo, no la que tenía la solicitud. El contexto trae `acuerdo.requiere_aceptar_vigente` para que la pantalla lo diga |
| `POST /api/sign/{token}/consent/accept` | Al aceptar, la solicitud **MIGRARA** a la versión vigente: se busca (o se crea) el consentimiento de esa versión, la solicitud pasa a apuntar a él y a su huella, y queda el evento `AGREEMENT_VERSION_MIGRATED` con la versión anterior y la nueva |
| `POST /api/sign/{token}/view-document` | Si la versión vigente todavía no se aceptó, **no se sirve el documento** (`409 AGREEMENT_VERSION_REACCEPT_REQUIRED`): el orden (g) → (h) se respeta |
| `POST /api/sign/{token}/commit` | Si la versión cambió después de la aceptación, la firma **no sale** (`409 AGREEMENT_VERSION_NO_LONGER_ACTIVE`) con `details.accion = "reaceptar_version_vigente"`: el firmante tiene que leer y aceptar la nueva |

**Lo que NO se toca**: los consentimientos ya aceptados de la versión anterior.
Quedan como están: son la prueba de lo que ese trabajador aceptó en su
momento (el 9.5: *"el Trabajador que haya aceptado una versión anterior se
rige por esa versión respecto de las firmas ya realizadas"*).

**Con esto, el texto que el firmante leyó y el texto que queda archivado (con
su huella) son el mismo.** No hay dos verdades.

Los sign requests **legacy** (sin `agreement_version`) no se migran: no tienen
con qué compararse y conservan su comportamiento histórico.

---

## 6. Endpoints internos (K+AIR)

Todos requieren header:

```
X-Internal-API-Key: <key>
Content-Type: application/json
```

`X-Internal-API-Key` se valida contra `INTERNAL_API_KEY` en el
Servicio. Si falta o es inválida → `401`.

### 6.1 `POST /internal/sign-requests` — crear

K+AIR crea una nueva solicitud de firma. El PDF se sube como
multipart.

**Request**:

```
POST /internal/sign-requests
X-Internal-API-Key: <key>
Content-Type: multipart/form-data; boundary=----...

------...
Content-Disposition: form-data; name="metadata"
Content-Type: application/json

{
  "id_documento": "doc-456",
  "id_trabajador": "trab-789",
  "id_empresa": "emp-012",
  "tipo_firma": "presencial",
  "agreement_hash": "d4e5f6...",
  "metadata": {
    "origen": "kair-desktop",
    "usuario_rh": "user-001"
  }
}
------...
Content-Disposition: form-data; name="documento"; filename="contrato.pdf"
Content-Type: application/pdf

<bytes del PDF>
------...--
```

| Campo (en metadata JSON) | Tipo | Requerido | Validación |
|---|---|---|---|
| `id_documento` | string | sí | ID existente en K+AIR. |
| `id_trabajador` | string | sí | Cédula o ID de `base_personal`. El servicio NO la guarda en claro: la convierte en un seudónimo (HMAC) y devuelve ese seudónimo en las respuestas. |
| `id_empresa` | string | sí | NIT o ID de empresa. |
| `tipo_firma` | string | sí | `presencial` o `remoto`. |
| `agreement_hash` | string | sí | SHA-256 hex (64 chars). |
| `ttl_horas` | int | no | **IGNORADO por el servidor.** La vigencia del enlace la fija el servicio según la modalidad (remoto 72 h, presencial 24 h), porque el numeral 3.4(c) del Acuerdo la define. Si se envía, no cambia nada: la respuesta trae siempre `fecha_expiracion` con el valor real. |
| `metadata` | object | no | **Desde la 8B no es un objeto libre:** solo se aceptan las claves de la lista blanca (`subtipo_identificacion`, `nombre_trabajador`, `nombre_empresa`, `correo_empresa`, `correo`). Cualquier otra clave se **rechaza con 400**, nombrándola. Ver §6.16. |
| `datos_sensibles` | bool | no | **Nuevo en la 8B (10.8).** Marca el documento como sensible. El servicio lo **infiere** por tipo de documento (ACTA, CERTIFICADO, CONSENTIMIENTO, AUTORIZACION) si el cliente no lo dice. La Empresa puede **subir** la clasificación, nunca bajarla. |
| `categorias_sensibles` | array de string | no | Las categorías de dato sensible que se tratan (p. ej. `SALUD_MENTAL`, `HISTORIAL_CLINICO`). Se muestran en el aviso previo. |
| `finalidad_sensible` | string | no | Para qué se usa el dato sensible. Va en el aviso previo. |
| `base_legal_sensible` | string | no | Base legal del tratamiento del dato sensible. Va en el aviso previo. |
| `representante_legal_snapshot` | object | no | **Nuevo en la 8B.** Snapshot del representante legal, para la firma dual: `{ nombre, cargo, tipo_identificacion, numero_identificacion, correo }`. **El `numero_identificacion` se cifra antes de archivarse** (AES-256-GCM, llave fuera de la base): no queda en texto claro en la base ni en las respuestas. Ver §6.16. |
| `categoria_retencion` | string | no | **Catálogo de retención por documento.** Id de `src/services/retencion.js`: `SST_PERFIL_Y_CONCEPTOS_MEDICOS`, `SST_EXAMENES_ESPECIALIZADOS`, `SST_MONITOREO_AMBIENTAL`, `SST_CAPACITACION`, `SST_EPP`, `CONTRATO_TRABAJO`, `HISTORIA_LABORAL`, `ASPIRANTE`, `TABLA_EMPRESA`. Un id fuera de la lista se **rechaza con 400**. El cliente de K+AIR la deriva solo, del tipo del documento: el operador no elige nada. Ver §6.13.6. |
| `fecha_terminacion` | string | no | Fecha del **cese** de la relación laboral o del **retiro**, **si el sistema la conoce** (p. ej. porque la ficha del trabajador la trae). Se usa solo para verificar el piso legal de los grupos SST. **Nunca se le pide al operador**; si no viene, la custodia de 80 años desde la firma cubre el mínimo legal. |
| `subtipo_identificacion` | string | no | Subtipo libre del documento (p. ej. `induccion`). **Solo** sirve para derivar la categoría cuando el cliente no manda `categoria_retencion`. La categoría explícita siempre gana. |

**Validación del PDF**:

- Content-Type debe ser `application/pdf`.
- Tamaño ≤10 MB.
- El Servicio calcula `document_hash_original` y lo compara con el
  declarado en `metadata.document_hash` (si se envía). Si no
  coincide → `422 DOCUMENT_HASH_MISMATCH`.

**Response exitosa — `201 Created`**:

```json
{
  "id_solicitud": "SIGN-2026-000123",
  "id_interno": 42,
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",  // SOLO se retorna en este momento
  "url_publica": "https://firma.k-air.com/s/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "qr_payload": "https://firma.k-air.com/s/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "document_hash_original": "9a73f8c7...",
  "fecha_creacion": "2026-08-17T15:30:00.000000Z",
  "fecha_expiracion": "2026-08-18T15:30:00.000000Z",
  "estado": "PENDING",
  "categoria_retencion": "SST_CAPACITACION",
  "fecha_conservacion": "2046-01-15T00:00:00.000Z"
}
```

> ⚠️ **Importante**: el `token` en texto plano SOLO se retorna en
> este momento. K+AIR debe guardarlo y mostrarlo como QR. El
> Servicio no lo almacena nunca más.

**Errores**:

| Código | Cuándo |
|---|---|
| `400` | Body inválido, multipart malformado, **o una clave que no está en la lista blanca de `metadata`** (el mensaje nombra la clave) |
| `401` | API key inválida |
| `413` | PDF >10 MB |
| `422` | Hash no coincide, datos del trabajador no encontrados |

**Side effects**:

- Genera `id_solicitud` con formato `SIGN-YYYY-NNNNNN`.
- Genera `token` aleatorio ≥32 chars.
- Calcula `token_hash = SHA-256(token)`.
- Persiste PDF en `/var/lib/kair-firma/pdfs/originales/`.
- Crea registro en `gh_firmas_electronicas`.
- Crea sesión en `gh_firma_sesiones`.
- Inserta evento `CREATED`.

---

### 6.2 `GET /internal/sign-requests/{id}` — consultar estado

Consulta el estado actual de una solicitud. `id` puede ser el ID
interno numérico o el `id_solicitud` (string).

**Response exitosa — `200 OK`**:

```json
{
  "id_solicitud": "SIGN-2026-000123",
  "id_interno": 42,
  "id_documento": "doc-456",
  "id_trabajador": "trab-789",
  "id_empresa": "emp-012",
  "tipo_firma": "presencial",
  "estado": "DOCUMENT_VIEWED",
  "fecha_creacion": "2026-08-17T15:30:00.000000Z",
  "fecha_expiracion": "2026-08-18T15:30:00.000000Z",
  "fecha_apertura": "2026-08-17T15:35:00.000000Z",
  "fecha_otp_enviado": "2026-08-17T15:36:00.000000Z",
  "fecha_otp_verificado": "2026-08-17T15:37:00.000000Z",
  "fecha_documento_visto": "2026-08-17T15:40:00.000000Z",
  "version_kair": "0.1.189"
}
```

> Nota: este endpoint NO expone el token, el OTP, ni hashes
> sensibles. Solo metadata de estado.

**Errores**:

| Código | Cuándo |
|---|---|
| `401` | API key inválida |
| `404` | Solicitud no encontrada |

---

### 6.3 `POST /internal/sign-requests/{id}/notify-remote`

Envía el correo al trabajador con el enlace para firmar (para
solicitudes remotas). K+AIR llama a este endpoint después de crear
la solicitud con `tipo_firma: 'remoto'`.

**Request**:

```json
{
  "correo": "trabajador@ejemplo.com",
  "plantilla_correo": "default",  // futuro: "urgente", "recordatorio"
  "remitente_personalizado": "rrhh@empresa.com",  // opcional
  "token": "opcional"  // 8C: el enlace que ya tiene el cliente
}
```

**El campo `token` (8C).** El token ya no se guarda de forma recuperable
(§6.14), así que la invitación necesita un enlace. Hay dos caminos:

- **Sin `token`**: el servicio **emite uno nuevo** (rotación) y lo manda en el
  correo. Es el comportamiento por defecto y el que cubre el caso real ("la
  Empresa perdió la respuesta de creación").
- **Con `token`**: se usa ese enlace y **no se emite nada nuevo**. El token se
  valida contra la solicitud: si no es de esta, la respuesta es `409`
  `TOKEN_MISMATCH`.

**Response exitosa — `200 OK`**:

```json
{
  "ok": true,
  "id_solicitud": "SIGN-2026-000001",
  "messageId": "<abc123@ejemplo.com>",
  "sent_at": "2026-08-17T15:30:00.000000Z",
  "evento_id": 91
}
```

**Errores**:

| Código | Cuándo |
|---|---|
| `401` | API key inválida |
| `404` | Solicitud no encontrada (o es de otra Empresa: 404 silencioso) |
| `409` | `TOKEN_MISMATCH`: el token del body no es de esta solicitud. |
| `410` | `INVITE_NOT_AVAILABLE`: la solicitud está en estado terminal. |
| `502` | `INVITE_EMAIL_FAILED`: el SMTP falló. |

**Side effects**:

- Inserta evento `NOTIFICATION_SENT` con metadata del correo.
- Si no vino `token`, inserta una emisión en `gh_firma_tokens` (el nuevo
  enlace) y el evento `LINK_ROTATED`.

---

### 6.4 `POST /internal/sign-requests/{id}/revoke`

RH revoca manualmente una solicitud (ej. el documento cambió y hay
que rehacer).

**Request**:

```json
{
  "motivo": "Documento actualizado con nuevas cláusulas. Se requiere nueva firma."
}
```

**Response exitosa — `200 OK`**:

```json
{
  "ok": true,
  "estado": "REVOKED",
  "id_solicitud": "SIGN-2026-000123",
  "fecha_revocacion": "2026-08-17T15:30:00.000000Z"
}
```

**Errores**:

| Código | Cuándo |
|---|---|
| `401` | API key inválida |
| `404` | Solicitud no encontrada |
| `409` | Estado actual no permite revocación (ya terminal) |

**Side effects**:

- UPDATE `gh_firmas_electronicas SET estado='REVOKED' WHERE id=? AND estado NOT IN (terminales)`.
- Inserta evento `REVOKED` con `motivo` y `rh_user_id`.

---

### 6.5 `GET /internal/sign-requests/{id}/pdf-firmado`

Descarga el PDF firmado (binario).

**Response exitosa — `200 OK`**:

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="SIGN-2026-000123-firmado.pdf"
Content-Length: 245890
X-Document-Hash: 9a73f8c7...
X-Evidence-Hash: c4d8e2f1...
```

**Errores**:

| Código | Cuándo |
|---|---|
| `401` | API key inválida |
| `404` | Solicitud no encontrada o PDF firmado no existe |
| `409` | Estado no es `SIGNED` |

---

### 6.6 `GET /internal/sign-requests/{id}/constancia`

Descarga la Constancia de firma electrónica (PDF).

**Response exitosa — `200 OK`**:

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="SIGN-2026-000123-constancia.pdf"
Content-Length: 78901
```

**Errores**:

| Código | Cuándo |
|---|---|
| `401` | API key inválida |
| `404` | Solicitud no encontrada o Constancia no existe |
| `409` | Estado no es `SIGNED` |

---

### 6.7 `GET /internal/sign-requests/{id}/eventos`

Lista los eventos de auditoría en orden cronológico.

**Response exitosa — `200 OK`**:

```json
{
  "id_solicitud": "SIGN-2026-000123",
  "eventos": [
    {
      "evento": "CREATED",
      "fecha_hora": "2026-08-17T15:30:00.000000Z",
      "id_actor": "rh:user-001"
    },
    {
      "evento": "OPENED",
      "fecha_hora": "2026-08-17T15:35:12.000000Z",
      "id_actor": "trabajador"
    },
    {
      "evento": "IDENTIFICATION_COMPLETED",
      "fecha_hora": "2026-08-17T15:35:45.000000Z",
      "id_actor": "trabajador",
      "metadata": { "tipo_documento": "CC" }
    },
    {
      "evento": "OTP_SENT",
      "fecha_hora": "2026-08-17T15:36:00.000000Z",
      "id_actor": "sistema",
      "metadata": { "canal": "email" }
    },
    {
      "evento": "OTP_VERIFIED",
      "fecha_hora": "2026-08-17T15:37:23.000000Z",
      "id_actor": "trabajador",
      "metadata": { "intentos": 1 }
    },
    {
      "evento": "DOCUMENT_VIEWED",
      "fecha_hora": "2026-08-17T15:40:11.000000Z",
      "id_actor": "trabajador",
      "metadata": { "segundos_en_pagina": 47 }
    },
    {
      "evento": "MANIFESTATION_RECORDED",
      "fecha_hora": "2026-08-17T15:40:34.000000Z",
      "id_actor": "trabajador"
    },
    {
      "evento": "SIGN_COMMITTED",
      "fecha_hora": "2026-08-17T15:40:35.000000Z",
      "id_actor": "trabajador",
      "metadata": { "evidence_hash": "c4d8e2f1..." }
    },
    {
      "evento": "PDF_GENERATED",
      "fecha_hora": "2026-08-17T15:40:36.000000Z",
      "id_actor": "sistema"
    },
    {
      "evento": "COPY_SENT",
      "fecha_hora": "2026-08-17T15:40:36.000000Z",
      "id_actor": "sistema",
      "metadata": { "canal": "email" }
    }
  ]
}
```

**Errores**:

| Código | Cuándo |
|---|---|
| `401` | API key inválida |
| `404` | Solicitud no encontrada |

---

### 6.8 `GET /internal/sign-requests` — listar

Lista solicitudes de firma con filtros. K+AIR usa este endpoint
para refrescar su vista local.

**Query parameters**:

| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `id_empresa` | string | — | Filtra por empresa. |
| `estado` | string[] | — | Uno o más estados. |
| `id_trabajador` | string | — | Filtra por trabajador. |
| `id_documento` | string | — | Filtra por documento. |
| `desde` | string | — | ISO 8601. Filtra por `fecha_creacion >= desde`. |
| `hasta` | string | — | ISO 8601. Filtra por `fecha_creacion <= hasta`. |
| `limit` | int | 50 | ≤200. |
| `offset` | int | 0 | Paginación. |

**Response exitosa — `200 OK`**:

```json
{
  "total": 1234,
  "limit": 50,
  "offset": 0,
  "items": [
    {
      "id_solicitud": "SIGN-2026-000123",
      "id_interno": 42,
      "id_documento": "doc-456",
      "id_trabajador": "trab-789",
      "estado": "SIGNED",
      "fecha_creacion": "2026-08-17T15:30:00.000000Z",
      "fecha_firma": "2026-08-17T15:40:35.000000Z"
    },
    ...
  ]
}
```

**Errores**:

| Código | Cuándo |
|---|---|
| `401` | API key inválida |
| `400` | Query params inválidos |

---

## 6.9 `GET /internal/acuerdo-activo` — obtener versión activa del Acuerdo

Devuelve la versión activa del Acuerdo de uso de firma electrónica.
K+AIR usa este endpoint durante el pipeline de contratación para
saber si debe mostrar el modal de aceptación al trabajador.

**Auth**: header `X-Internal-API-Key`.

**Rate limit**: 60 req/min por API key.

**Response exitosa — `200 OK`**:

```json
{
  "version": "v1.0",
  "texto": "ACUERDO DE USO DE FIRMA ELECTRÓNICA\nVersión: v1.0\n\nEntre [...]",
  "texto_hash": "a1b2c3d4...",
  "fecha_vigencia_inicio": "2026-08-17T00:00:00.000000Z",
  "activa": true
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `version` | string | Identificador de la versión (ej. `v1.0`). |
| `texto` | string | Texto completo del Acuerdo. |
| `texto_hash` | string(64) | SHA-256 del texto. |
| `fecha_vigencia_inicio` | string | ISO 8601 UTC. |
| `activa` | bool | `true` si es la versión vigente. |

**Errores**:

| Código | Cuándo |
|---|---|
| `401` | API key inválida |
| `404` | No hay versión activa del Acuerdo |

---

## 6.10 `POST /internal/consentimientos` — iniciar consentimiento

Inicia el proceso de aceptación del Acuerdo para un trabajador.
Crea un registro en `gh_consentimientos_firma` con estado
`PENDING`, genera un OTP, lo envía al correo del trabajador, y
devuelve un `consent_id` para verificar después.

**Auth**: header `X-Internal-API-Key`.

**Rate limit**: 5 consentimientos/hora por (id_trabajador + id_empresa).

**Request**:

```json
{
  "id_trabajador": "trab-789",
  "id_empresa": "emp-012",
  "version_acuerdo": "v1.0",
  "correo_verificacion": "juan.perez@ejemplo.com",
  "kair_version": "0.1.189"
}
```

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `id_trabajador` | string | sí | Cédula o ID de `base_personal`. |
| `id_empresa` | string | sí | NIT o ID de empresa. |
| `version_acuerdo` | string | sí | Debe coincidir con la versión activa. |
| `correo_verificacion` | string | sí | Email válido. Se hashea con sal. |
| `kair_version` | string | sí | Versión de K+AIR. |

**Response exitosa — `201 Created`**:

```json
{
  "consent_id": "cons_abc123",
  "version_acuerdo": "v1.0",
  "hash_texto_acuerdo": "a1b2c3d4...",
  "estado": "OTP_SENT",
  "otp_ttl_seconds": 600,
  "correo_destino_enmascarado": "juan.p****@ejemplo.com"
}
```

**Errores**:

| Código | Cuándo | Detalles |
|---|---|---|
| `400` | Body inválido | `INVALID_REQUEST_BODY` |
| `401` | API key inválida | `INVALID_API_KEY` |
| `404` | Versión no encontrada o inactiva | `ACUERDO_NOT_FOUND` |
| `409` | El trabajador ya aceptó esta versión | `ALREADY_ACCEPTED` con `consent_id` existente |
| `429` | Rate limit | `RATE_LIMIT_EXCEEDED` |

**Side effects**:

- `BEGIN TRANSACTION`:
  - INSERT en `gh_consentimientos_firma` con `manifestacion_aceptada=0` y `otp_hash`+`otp_sal`.
  - INSERT evento `CONSENTIMIENTO_INICIADO`.
- `COMMIT`.
- Envío de OTP al correo del trabajador (fuera de transacción).
- Si el correo rebota: evento `EMAIL_BOUNCED` con `tipo=otp`. La solicitud sigue activa.

---

## 6.11 `POST /internal/consentimientos/:id/verify-otp` — verificar OTP y aceptar

Verifica el OTP ingresado por el trabajador. Si es correcto, marca el
consentimiento como aceptado.

**Auth**: header `X-Internal-API-Key`.

**Rate limit**: 5 intentos/OTP.

**Path param**: `id` = `consent_id`.

**Request**:

```json
{
  "otp": "123456"
}
```

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `otp` | string | sí | Exactamente 6 dígitos numéricos. |

**Response exitosa — `200 OK`**:

```json
{
  "ok": true,
  "consent_id": "cons_abc123",
  "version_acuerdo": "v1.0",
  "estado": "ACEPTADO",
  "fecha_aceptacion": "2026-08-17T15:30:00.123456Z",
  "manifestacion_aceptada": true
}
```

**Errores**:

| Código | Cuándo | Detalles |
|---|---|---|
| `400` | OTP malformado | `INVALID_REQUEST_BODY` |
| `401` | API key inválida | `INVALID_API_KEY` |
| `404` | Consent no encontrado | `CONSENT_NOT_FOUND` |
| `409` | Ya aceptado | `ALREADY_ACCEPTED` |
| `422` | OTP incorrecto | `OTP_INVALID` con `intentos_restantes` |
| `422` | OTP expirado | `OTP_EXPIRED` |
| `422` | OTP bloqueado | `OTP_LOCKED` |
| `429` | Rate limit | `RATE_LIMIT_EXCEEDED` |

**Side effects** (transacción atómica):

- Valida OTP con `crypto.timingSafeEqual()` (no `===`).
- UPDATE `gh_consentimientos_firma SET manifestacion_aceptada=1, fecha_aceptacion=now`.
- INSERT evento `CONSENTIMIENTO_ACEPTADO`.
- K+AIR local sincroniza `gh_consentimientos_firma_local`.

---

## 6.12 `POST /internal/verificacion-identidad` — oráculo de identidad

Pregunta al Servicio si un documento de identidad es el mismo con el que
firmó el trabajador de una solicitud concreta. La respuesta es un **sí o un
no**.

**Por qué existe**: el numeral 3.4(d) del Acuerdo de uso exige comparar
"mediante una comparación de huellas digitales con sal" la información
registrada por la Empresa con la del firmante. Hacerlo bien no significa
apartar el número en claro —mandarlo por correo, pedirlo por teléfono,
escribirlo en un formulario— sino preguntar al sistema que ya tiene la
huella archivada. El documento nunca sale de esta llamada.

**Auth**: header `X-Internal-API-Key` de la **empresa** (API key
per-empresa, I-010). Requiere la operación `verificacion:identidad`: un
cliente que no la tiene recibe `403 FORBIDDEN` sin poder intentarlo.

**Rate limit propio**: 60/h por empresa y 10/min por empresa (más el
límite genérico de `/internal/*`).

**Request**:

```json
{
  "id_solicitud": "SIGN-2026-269179",
  "tipo_identificacion": "CC",
  "numero_documento": "1234567890"
}
```

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `id_solicitud` | string | sí | `SIGN-YYYY-NNNNNN`. |
| `tipo_identificacion` | string | sí | `CC`, `CE`, `TI`, `PPT` o `PA`. |
| `numero_documento` | string | sí | 4 a 32 caracteres, solo `[A-Za-z0-9.-]`. El body es estricto: campos extra se rechazan. |

**Response exitosa — `200 OK`**:

```json
{
  "ok": true,
  "id_solicitud": "SIGN-2026-269179",
  "coincide": true
}
```

La respuesta es **un booleano y nada más**: ni el documento, ni la huella
archivada, ni el estado de la firma, ni las fechas.

**Errores**:

| Código | Cuándo | Detalles |
|---|---|---|
| `400` | Body inválido | `INVALID_REQUEST_BODY` |
| `401` | API key inválida | `INVALID_API_KEY` |
| `403` | El cliente no tiene la operación | `FORBIDDEN` |
| `403` | Llave legacy (sin empresa) | `EMPRESA_SCOPE_REQUIRED` |
| `404` | La solicitud no es de esta empresa (o no existe) | `NOT_FOUND` |
| `429` | Rate limit | `RATE_LIMIT_EXCEEDED` |

El `404` es **silencioso**: una solicitud de otra empresa y una que no
existe dan exactamente la misma respuesta. El oráculo no sirve para
enumerar las firmas de otras empresas.

**Side effects**:

- INSERT evento `IDENTIDAD_VERIFICADA` en `gh_firma_eventos`, con el
  resultado y el **fingerprint** del documento consultado. El documento no
  se persiste en ninguna parte, y tampoco aparece en el log: el log
  lleva el mismo fingerprint (un HMAC recortado), que sirve para detectar
  anomalías sin poder recuperar el número.
- La comparación de huellas es en **tiempo constante** y no sale
  temprano: el tiempo de la respuesta no depende de si el documento
  coincide.

---

## 6.13 Endpoints de administración de empresas — `/internal/admin/empresas`

> **Autenticación:** header `X-Admin-API-Key`. **NO** se exponen a K+AIR:
> son de operador humano con acceso físico al servidor. Una key interna de
> empresa (`X-Internal-API-Key`) **no** sirve para estos endpoints.

Estos endpoints guardan la **identificación de la Empresa**, que es la
Responsable del tratamiento. K+AIR es el Encargado: guarda lo que la Empresa
declara y lo transporta, pero no decide por ella.

### 6.13.1 `plazo_retencion_dias` — la instrucción legal que dispara la purga

El numeral **8.6** del Acuerdo de uso dice que el plazo de conservación "se
determina por la tabla de retención documental de la Empresa" y que "este
Acuerdo no fija un plazo propio porque la ley no lo fija". El **10.6** lo
repite por categoría de dato.

Por eso el plazo lo declara la **Empresa**, y hay dos campos distintos:

| Campo | Qué es | Para qué |
|---|---|---|
| `plazo_retencion` | **Texto.** Lo que dice la tabla de retención de la Empresa. Puede fijar plazos distintos por categoría de dato (hojas de vida, contrataciones, accidentes). | Es lo que se le **muestra al firmante** y lo que queda en el snapshot de la empresa que se incorpora a la evidencia. |
| `plazo_retencion_dias` | **Entero, en días.** El plazo computable para los registros del proceso de firma. | Es lo que usa el sistema para calcular la `fecha_conservacion` de cada firma, y con ella, la supresión del dato vencido. |

**Sin `plazo_retencion_dias` no hay purga.** La firma no tiene fecha de
conservación y nunca es elegible: el sistema no inventa plazos. Pero la
retención indefinida **tampoco es cumplimiento**, así que:

- el reporte `scripts/reporte-vencimientos.js` marca el "sin plazo declarado"
  como **alerta de cumplimiento**, no como un no-op silencioso;
- cada firma creada por una Empresa sin plazo declarado genera un log
  `RETAIN_SIN_PLAZO` en el servidor.

**Operativamente:** el plazo debe declararse **antes de la primera firma** de
esa Empresa. Declararlo después no mueve las firmas ya hechas: la
`fecha_conservacion` se congela en el momento de crear la firma, porque el
8.6 habla del plazo "que le resulta aplicable" al firmante cuando se le pide
la firma.

**Tipo:** entero positivo, máximo 36500 (100 años). `null` o ausente = sin
plazo declarado.

### 6.13.2 Los ocho endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/internal/admin/empresas` | Lista las empresas con lo que les falta para poder firmar. |
| `GET` | `/internal/admin/empresas/:id_empresa` | Devuelve una empresa. |
| `POST` | `/internal/admin/empresas` | Crea la empresa (identificación completa, incluido `plazo_retencion` y `plazo_retencion_dias`). |
| `PUT` | `/internal/admin/empresas/:id_empresa` | Actualiza la identificación. |
| `GET` | `/internal/admin/empresas/:id_empresa/historial` | El **rastro de los cambios** de la ficha: un renglón por campo que realmente cambió, con el valor anterior, el nuevo, quién, desde dónde, cuándo y por qué. |
| `POST` | `/internal/admin/empresas/:id_empresa/anexo-firmado` | Registra la fecha de firma del Anexo de Encargo (art. 25 Decreto 1377/2013). Endpoint aparte: ese dato sustenta el cumplimiento legal y no debe cambiar en una actualización de rutina. |
| `POST` | `/internal/admin/empresas/:id_empresa/anexo-firmado/quitar` | **Quita** la fecha del Anexo de Encargo. Es la salida auditada para una marca equivocada: exige `X-Admin-Motivo`, escribe el valor anterior y `null` en el historial append-only y deja un WARN en el log. Después de quitarla, D-03 vuelve a bloquear la Empresa hasta que se registre una fecha respaldada por el PDF. |
| `POST` | `/internal/admin/empresas/:id_empresa/estado` | Alta/baja lógica. Una empresa inactiva no muestra bloque en la mini-app, pero sus firmas históricas se conservan intactas. |

**Body de `POST` / `PUT`** (los campos de identificación):

```json
{
  "razon_social": "EMPRESA S.A.S.",
  "nit": "900123456",
  "domicilio": "Calle 1 # 2-3, Bogotá",
  "representante_legal": "Nombre del representante",
  "representante_legal_identificacion": "CC 12345678",
  "responsable_tratamiento": "Nombre",
  "responsable_tratamiento_correo": "privacidad@empresa.co",
  "canal_pqrs": "pqrs@empresa.co",
  "canal_incidentes": "seguridad@empresa.co",
  "politica_datos_url": "https://empresa.co/privacidad",
  "plazo_retencion": "5 años para expedientes laborales; 10 años para contrataciones",
  "canal_solicitud_copia": "https://empresa.co/copia-expediente",
  "plazo_retencion_dias": 1825
}
```

`plazo_retencion` y `plazo_retencion_dias` son opcionales en el body, pero
**declarar el plazo es condición para que las firmas de esa Empresa puedan
suprimirse algún día**.

**El rastro de la ficha (`GET .../historial`)**. Cada campo que *realmente*
cambia deja un renglón: valor anterior, valor nuevo, actor, IP, user-agent,
fecha y motivo. Un guardado que no cambia nada no deja renglón (no es un
cambio). El rastro es **append-only** (triggers de la migración 038, probados
contra el archivo real). El documento del representante legal **no se copia en
claro**: va enmascarado (`****` + los cuatro últimos), como en el resto del
sistema.

El actor y el motivo llegan en headers, porque el `PUT` es un reemplazo
completo de la ficha y el body no se contamina con metadatos de auditoría:

| Header | Qué es | Por defecto |
|---|---|---|
| `X-Admin-Actor` | Quién hizo el cambio. | `admin` |
| `X-Admin-Motivo` | Por qué se hizo el cambio. | `null` |

La respuesta es una lista de renglones, del más reciente al más antiguo.
`?limite=` entre 1 y 1000 (por defecto 200).

**Las reglas del Anexo de Encargo (`POST .../anexo-firmado`)**. La fecha del
Anexo es el sustento del artículo 25 del Decreto 1377 de 2013, así que el
registro tiene tres reglas duras:

1. **No se acepta una fecha futura.** Si el operador se equivoca de año, el
   sistema responde `400 INVALID_REQUEST_BODY` y no guarda nada.
2. **Cambiar una fecha ya registrada exige motivo.** El body solo lleva
   `{ "fecha": "..." }`; el motivo va en `X-Admin-Motivo`. Sin motivo, la
   respuesta es `400 MOTIVO_REQUERIDO`. Registrar **la misma fecha** otra vez
   es un reintento idempotente: no toca `updated_at` y no escribe un renglón
   nuevo en el historial.
3. **Una fecha anterior al alta de la Empresa no se bloquea, pero se
   advierte.** El contrato se puede firmar antes de cargar la ficha en K+AIR;
   el sistema deja un WARN en el log y el reporte de readiness lo cuenta en
   `empresas.fechas_antes_del_alta` para que se confronte con el PDF.

**Quitar la fecha (`POST .../anexo-firmado/quitar`)**. No recibe body. Exige
`X-Admin-Motivo` y devuelve la empresa con `anexo_encargo_firmado_at: null`.
El borrado queda en el historial con el valor anterior, `null` como valor
nuevo, el actor y el motivo.

| Situación | HTTP | Código |
|---|---|---|
| La empresa no existe | `404` | `EMPRESA_NOT_FOUND` |
| La fecha no parsea o es futura | `400` | `INVALID_REQUEST_BODY` |
| Se intenta cambiar una fecha existente sin `X-Admin-Motivo` | `400` | `MOTIVO_REQUERIDO` |
| Se intenta quitar una fecha sin `X-Admin-Motivo` | `400` | `MOTIVO_REQUERIDO` |
| Se intenta quitar una fecha que no está registrada | `409` | `ANEXO_NO_REGISTRADO` |

> **Una fecha no es evidencia.** Que la ficha tenga una fecha no demuestra que
> el Anexo exista. El reporte de readiness (`GET /internal/admin/readiness`)
> solo marca `empresas_base` en OK cuando la ficha tiene la fecha **y**
> `legal-readiness.json → anexo_encargo` tiene `estado: "firmado"`, fecha y
> archivo de evidencia. Si hay fecha sin evidencia, el ítem queda en `aviso`,
> que también bloquea el gate de primera firma.

### 6.13.3 El hold legal de conservación

El **8.6** condiciona la supresión a que "no exista un deber legal o
contractual de conservación". Ese deber se declara con:

| Dato | Por qué |
|---|---|
| `actor` | Quién lo declara (la Empresa, o quien actúe por ella). |
| `motivo` | Por qué: una reclamación, un proceso judicial, una investigación administrativa, un requerimiento de la SIC, la UGPP, el Ministerio de Trabajo o una ARL, una auditoría. |
| `alcance` | Sobre qué: la materia, el expediente, la autoridad. |
| `fecha` | Desde cuándo. |
| liberación | Cuándo se levanta, por quién y por qué. |

Mientras el hold está activo, **la base de datos se niega a suprimir la
firma**, aunque haya ventana de purga y lote: es una condición del trigger de
la migración 020, no un chequeo del código de aplicación.

> **Nota de alcance (actualizada en la 8A.2).** La purga tiene **dos capas**.
> La primera suprime el **registro de auditoría** (los eventos). La segunda —
> la **5B**, implementada en la 8A.2 — suprime la **fila completa de la firma
> y sus archivos** (PDF original, PDF firmado y constancia). Las dos comparten
> el mismo gobierno de ventana y lote, y las dos se saltan una firma con hold
> legal. Ver §6.13.4.

### 6.13.4 La 5B: la supresión de los datos personales vencidos

El **10.6** ordena suprimir el dato cuando vence su plazo y no hay deber legal
o contractual de conservación. La 5B es la capa que lo cumple.

**Qué suprime** — la fila de la firma (`gh_firmas_electronicas`) y los tres
archivos que la acompañaban: el PDF original, el PDF firmado y la constancia.
También sus filas hijas: los eventos de auditoría, la sesión y la entrada del
lote.

**Qué sobrevive, y por qué** — tres cosas, y ninguna es el dato personal:

| Sobrevive | Dónde | Por qué |
|---|---|---|
| La **prueba de la aceptación** | `gh_consentimientos_firma` (sin llave foránea contra la firma) | Es lo que el **12.7** deja en cabeza de la Empresa: la prueba de que el trabajador aceptó el Acuerdo, con la versión, la huella del texto, la fecha y hora **y el identificador de la solicitud**. |
| La **lápida** | `gh_firma_purgadas` (append-only) | Qué se suprimió, por qué, por quién y cuándo. Sin datos personales y **sin la credencial**. |
| El **recibo de purgas** | `gh_firma_purga_registro` (append-only) | El asiento de la operación de purga. |

**El orden de las cosas: los archivos primero, la base después.** El archivo
*es* el dato personal: el documento firmado y la constancia que lo acredita. Si
la parte de base de datos falla después, el archivo ya no está —que es lo que
se pedía— y la fila queda apuntando a un archivo inexistente. La reintento es
segura porque borrar un archivo que no está no falla.

**La credencial no sobrevive.** La lápida **no** guarda el `token_hash` (que es
la credencial del enlace): guarda `HMAC('tombstone-purga', token_hash)`, un
hash de un hash con propósito y llave derivados. No permite autenticarse ni
resolver nada. Solo permite que el sistema responda *"No disponible por
vencimiento del plazo"* (410 `CONSERVACION_VENCIDA`) en vez de un 404 que no
dice por qué.

**El dry-run es el modo por defecto.** `scripts/purga-ventana.js` **simula**
salvo que se pase `--ejecutar`. La simulación no borra ni la fila ni los
archivos, y no escribe ninguna lápida.

**Las dos capas van en la MISMA ventana y sobre el MISMO lote.** La capa de
auditoría no cierra la ventana al terminar: la cierra el script, después de
que corrieron las dos capas. Si la cerrara antes, la segunda capa no podría
correr (exige ventana vigente y lote armado) y el documento, la constancia y
los archivos de las firmas vencidas **no se suprimirían nunca**. La segunda
capa vuelve a comprobar el hold de cada firma y la copia pendiente.

La simulación se calcula sobre las **mismas firmas** que el lote va a
contener (las vencidas y elegibles), no sobre el lote: antes de abrir la
ventana el lote está vacío y simular sobre él daba siempre "0 firmas, 0
archivos" mientras la operación real suprimía una firma y tres archivos.

**El gobierno es el mismo de la capa de auditoría.** La supresión exige:

1. **actor** (quién suprime) y **motivo** (por qué), ambos obligatorios;
2. una **ventana de purga abierta**;
3. un **lote armado**;
4. que la firma **no** tenga hold legal vigente.

Es idempotente: correrla dos veces no rompe nada y no escribe una segunda
lápida.

**Lo que NO hace.** La 5B no suprime los datos personales de la **Empresa** ni
los de otros titulares: el sistema no es el responsable de esos datos, y su
supresión depende de la tabla de retención documental de cada Empresa (que es
un proceso del cliente, no de este servicio). Tampoco toca la copia permanente
del **8.5** —esa es la 9A— ni el **backups** —el Anexo de Encargo debe
declarar el plazo de eliminación en sistemas y respaldos—.

---

### 6.13.5 `conservacion_por_deber_legal` - el deber legal SIN término (por Empresa)

**Por qué es a nivel de EMPRESA y no de documento**: el artículo 2.2.1.1.12
del Decreto 1072 obliga a los empleadores a conservar los contratos de trabajo
firmados electrónicamente, **sin plazo**. Eso es una cualidad de la relación
laboral, no del archivo. Y el sistema **no puede clasificar un PDF con
acierto** — el mismo argumento del 10.8: no se lee el documento antes del
consentimiento.

| Campo | Tipo | Qué es |
|---|---|---|
| `conservacion_por_deber_legal` | bool | `true` cuando la Empresa tiene un deber legal de conservación sin término |
| `norma_conservacion` | texto | La norma que impone el deber (p. ej. `2.2.1.1.12 del Decreto 1072 de 2015`) |

**Qué hace el sistema cuando el flag está en 1**:

1. La firma **no recibe fecha de supresión** (el plazo de la tabla de
   retención no extingue un deber legal).
2. Se levanta un **hold legal automático** (`actor` = `sistema`, `motivo` =
   `deber_legal_<norma>`), gobernado por `gh_firma_holds`: se libera con actor
   y motivo cuando la relación termina o el documento se sustituye. La base
   (triggers de la 020) se niega a suprimir una firma con hold.
3. El **Trabajador se entera**: la mini-app muestra "Supresión de este
   documento: no se borra automáticamente…" y el correo de invitación lo dice.
4. `fecha_conservacion` deja de ser una fecha de supresión: es un **piso**,
   no un techo.

**No es "nunca se purga": es "nunca se purga SOLO".** Esa es la diferencia
entre un deber legal y un accidente.

**El flag no se toca si el body no lo trae**: levantarlo es un acto, con
actor y motivo; un `PUT` de rutina no puede dejar el deber legal en off por
accidente. Para levantarlo hay que mandar `false` explícito.

### 6.13.6 El catálogo de retención por tipo de documento

**El plazo no se le pregunta a nadie: vive en el código.** Ni el operador de
K+AIR, ni la Empresa tienen que decidir nada por firma. No hay un selector de
"tipo de documento para la conservación", no hay una fecha de cese que
completar y la Empresa no tiene que declarar un plazo para poder firmar.

**La regla del sistema: 80 años de custodia** (`ANIOS_CUSTODIA`, en
`src/services/retencion.js`), contados desde la fecha de la firma. Es un piso
legalmente fundado y no un número inventado:

- Cubre el mínimo de **20 años desde el cese de la relación laboral** que el
  artículo 2.2.4.6.13 del Decreto 1072 de 2015 exige para cinco grupos de
  registros del SG-SST. Si el sistema conoce la fecha de cese y el mínimo
  legal cayera más lejos, esa fecha gana.
- Cubre el rango de **80 a 100 años desde el retiro** que el Concepto
  2-2017-01654 del Archivo General de la Nación propone para la historia
  laboral (Corte Constitucional T-470/2019).
- Para los demás documentos, el mismo artículo remite al sistema de retención
  de la Empresa: **si la Empresa declara un plazo en su tabla, ese plazo
  manda** (el 8.6). Si no declara ninguno, rige la custodia de 80 años.
- El **contrato electrónico** es la excepción: el artículo 2.2.1.1.12
  (Decreto 526 de 2021) obliga a conservarlo con autenticidad, integridad y
  disponibilidad **sin fijar término**, así que queda con un **hold** y no se
  borra por el vencimiento de la custodia.
- El **deber legal sin término** que la Empresa haya declarado (migración 029)
  gana sobre cualquier plazo: un plazo más corto no puede recortar un deber
  sin término.

**El catálogo** (`src/services/retencion.js`): la categoría no cambia el
plazo (salvo el hold del contrato y el piso de los grupos SST); cambia el
**texto** que se le comunica al Trabajador y la base legal que lo respalda.

| `categoria_retencion` | Regla | Qué le dice al Trabajador |
|---|---|---|
| `SST_PERFIL_Y_CONCEPTOS_MEDICOS` | `SST_20_ANOS` | custodia + mínimo de 20 años desde el cese (2.2.4.6.13) |
| `SST_EXAMENES_ESPECIALIZADOS` | `SST_20_ANOS` | ídem |
| `SST_MONITOREO_AMBIENTAL` | `SST_20_ANOS` | ídem |
| `SST_CAPACITACION` | `SST_20_ANOS` | ídem |
| `SST_EPP` | `SST_20_ANOS` | ídem |
| `CONTRATO_TRABAJO` | `CONTRATO_ELECTRONICO` | se conserva **sin término** y no se borra automáticamente (2.2.1.1.12) |
| `HISTORIA_LABORAL` | `HISTORIA_LABORAL` | custodia dentro del rango de 80 a 100 años desde el retiro (T-470/2019 · AGN 2-2017-01654) |
| `ASPIRANTE` | `TABLA_EMPRESA` | custodia del sistema |
| `TABLA_EMPRESA` | `TABLA_EMPRESA` | custodia del sistema (o el plazo de la Empresa, si lo declaró) |

**Quién clasifica.** El sistema, con datos que ya tiene. El cliente de K+AIR
manda `categoria_retencion` derivada del **tipo del documento** (que está en
la ficha: `gh_documentos.tipo` — `contrato`, `induccion`,
`autorizacion_hojas_vida`, etc.), sin intervención del operador. La API
también acepta la derivación desde `tipo_identificacion` +
`subtipo_identificacion`, y la categoría explícita sigue siendo válida.

**Columnas nuevas** (migración `033_retencion_por_documento`):

| Columna | Qué guarda |
|---|---|
| `categoria_retencion` | El id del catálogo. `NULL` si el sistema no pudo derivarla. |
| `regla_retencion` | La regla aplicada (`SST_20_ANOS`, `CONTRATO_ELECTRONICO`, `HISTORIA_LABORAL`, `TABLA_EMPRESA`). |
| `fecha_terminacion` | El cese o el retiro, **si el sistema lo conoce**. Nunca se le pide a nadie. |
| `plazo_retencion_aplicable` | El texto que se le comunicó al Trabajador para **esta** solicitud. |

**Lo que ve el Trabajador** sale de esa fila: el bloque de la mini-app, el
correo de invitación y la constancia imprimen el plazo aplicado y congelado, no
el de la Empresa en vivo. Las solicitudes anteriores a este catálogo (con las
cuatro columnas en `NULL`) siguen mostrando el texto de la Empresa: **no hay
backfill**.

**La habilitación de la Empresa ya no exige el plazo** (ver §6.16.5): la
custodia vive en el código, así que no hay nada que declarar. Siguen
exigiéndose el **Anexo de Encargo firmado** y el **canal de atención**
(`canal_pqrs`).

**La firma dual hereda**: el hijo (firma del representante) es el mismo
documento, así que hereda la categoría, la regla, la fecha de terminación, el
texto, la fecha de conservación y el hold del padre.

### 6.14 `POST /internal/sign-requests/{id}/link/rotate` - el enlace, otra vez

> **Nuevo en la 8C.** Este endpoint y el `GET /internal/sign-requests/{id}/link`
> (deprecado) no estaban documentados: el segundo existía desde el I-013b y
> nunca se documentó. Aquí van los dos, con su estado real.

Emite un **token nuevo** para la solicitud y lo devuelve **una sola vez**.

**Por qué existe.** El numeral 3.6(e) del Acuerdo de uso promete que el token
de acceso "se conserva únicamente en forma de huella digital". El código no lo
cumplía: guardaba el token cifrado en el metadata y lo devolvía en texto claro.
La salida no es una excepción declarada en el texto, sino un mecanismo: la
**rotación**.

**Lo que no se invalida.** Los tokens anteriores **siguen valiendo hasta su
vencimiento** (la ventana de la firma). La rotación no extiende el plazo:
emite otro acceso al mismo plazo. Un enlace que ya está en manos del
trabajador no se rompe.

**El tope.** **Un token vigente por solicitud** (3.4(c)). Cada reemisión **deja sin efecto
el token anterior**: el que se emite es el único que sirve. Después de emitirlo, el sistema
**verifica la invariancia**; si quedara algún token vigente, la operación falla con
`500 TOKEN_INVARIANTE_ROTA` y **no queda nada escrito** (la transacción se revierte).

> `revocar_anteriores` quedó **obsoleto**: se acepta para no romper clientes que lo manden,
> pero **ya no decide**. Mandar `false` **no** evita la revocación, y su valor queda en el
> registro de auditoría (`revocar_anteriores_pedido`).

**Request**:

```json
{
  "motivo": "La Empresa perdió la respuesta de creación",  // opcional
  "revocar_anteriores": false  // opcional y OBSOLETO: ya no decide nada
}
```

**Response exitosa — `200 OK`**:

```json
{
  "id_solicitud": "SIGN-2026-000001",
  "token": "el-token-en-claro-una-sola-vez",
  "url_publica": "https://firma.kair.fyi/s/el-token-en-claro-una-sola-vez",
  "qr_payload": "https://firma.kair.fyi/s/el-token-en-claro-una-sola-vez",
  "emision": 2,
  "expira_en": "2026-08-18T15:30:00.000Z",
  "fecha_expiracion": "2026-08-18T15:30:00.000Z",
  "estado": "PENDING",
  "tokens_activos": 2,
  "revocados": []
}
```

**Errores**:

| Código | Cuándo |
|---|---|
| `400` | `id` malformado o body inválido |
| `401` / `403` | API key inválida o sin permiso |
| `404` | Solicitud no encontrada (o es de otra Empresa: 404 silencioso) |
| `409` | No aplica al rotate: la reemisión nunca se bloquea por cupo (no hay tope de 3 vivos). |
| `410` | `LINK_NOT_AVAILABLE`: la solicitud está en estado terminal (`details.current_state`). |

**Side effects**:

- Inserta una fila en `gh_firma_tokens` (la huella del token nuevo).
- **Revoca los tokens vivos anteriores** (con motivo, actor y fecha) y los devuelve en
  `revocados`. Siempre, sin excepción.
- Inserta el evento `LINK_ROTATED` en `gh_firma_eventos`.

---

### 6.15 `GET /internal/sign-requests/{id}/link` — **DEPRECADO**

> **Deprecated desde la 8C.** Este endpoint devolvía el token **en texto
> claro**, recuperándolo de una copia cifrada del metadata. Como el token ya
> no se guarda de forma recuperable, **no se debe usar**: úsese
> `POST /internal/sign-requests/{id}/link/rotate` (§6.14).

**Comportamiento actual**:

| Situación | Respuesta |
|---|---|
| Solicitud **anterior** a la 8C (conserva el token cifrado) | `200` con `{ id_solicitud, token, url_publica, qr_payload, fecha_expiracion, estado }`. Lleva cabeceras `Deprecation: true`, `Sunset` y `Link` hacia el endpoint successor. |
| Solicitud **posterior** a la 8C | `410 LINK_NOT_AVAILABLE` con `details.reason: 'rotacion_requerida'` y `details.rotacion_endpoint`. |
| Estado terminal | `410 LINK_NOT_AVAILABLE` con `details.reason: 'terminal_state'`. |
| No existe o es de otra Empresa | `404 NOT_FOUND` (silencioso). |

Las solicitudes anteriores a la 8C **siguen funcionando** en este endpoint
precisamente para no romper a nadie de un día para otro: un token ya emitido
sigue siendo válido (vive como huella), lo que dejó de existir es la
**recuperación** de su texto claro. La fecha de retiro (`Sunset`) avisa a los
clientes.

---

### 6.16 Fase 8B — metadata con lista blanca, dato sensible y representante cifrado

> **Nuevo en la 8B.** Tres cambios que afectan lo que el cliente puede mandar y
> lo que queda archivado. Ninguno cambia el texto legal: el 10.2, el 10.3, el
> 10.5(a) y el 10.8 ya decían lo que había que cumplir; lo que la 8B hace es
> dejar de incumplirlo.

#### 6.16.1 `metadata` tiene lista blanca

Antes, `metadata` era un objeto libre de hasta 8192 caracteres que se archivaba
tal cual. La última frase del **10.2** dice que el Acuerdo "no autoriza a la
Empresa a enviar al servicio datos distintos de los aquí relacionados": sin una
lista blanca, esa frase no era exigible.

| Clave admitida | Para qué |
|---|---|
| `subtipo_identificacion` | El subtipo del documento firmado. |
| `nombre_trabajador` | Nombre del trabajador. |
| `nombre_empresa` | Nombre de la Empresa. |
| `correo_empresa` | Correo para el envío de la copia del **8.4**. |
| `correo` | Correo de la persona. |

**Lo que no se acepta, se rechaza**: una clave desconocida produce un `400` que
**nombra la clave**. Antes el esquema la eliminaba en silencio, y el dato se
perdía sin que nadie se enterara (justo lo que pasaba con `correo_empresa`: la
app la mandaba desde hace meses y nunca llegó a la base).

El servicio vuelve a filtrar antes de escribir la fila: es el último punto, y
el que no se puede saltar por la vía del service.

#### 6.16.2 El dato sensible (10.8)

El `metadata` no es lo único que se valida. El body acepta además
`datos_sensibles`, `categorias_sensibles`, `finalidad_sensible` y
`base_legal_sensible` (§6.1).

- **Inferencia por tipo de documento**: ACTA, CERTIFICADO, CONSENTIMIENTO y
  AUTORIZACION se marcan como sensibles si el cliente no dice lo contrario.
  El sistema **no lee el PDF** para averiguarlo: escanearlo sería tratar el
  dato sensible **antes** del consentimiento.
- **La Empresa sube la clasificación, nunca la baja.** Si el cliente dice
  `datos_sensibles: false` para un ACTA, el servicio lo vuelve a marcar.
- **El aviso queda fijado al crear** (texto, hash y versión). Si se compusiera
  en cada visita, un cambio de redacción cambiaría lo que el Titular "aceptó"
  sin que nadie lo notara.
- **El bloqueo**: sin consentimiento del 10.8, `view-document` y `document.pdf`
  responden `409 SENSIBLE_CONSENT_NOT_ACCEPTED`. Ver §5.12.

#### 6.16.3 El número del representante legal va cifrado

El **10.5(a)** dice que el número del documento "se conserva únicamente esa
huella, no el número en texto claro". Para el **trabajador** eso ya era cierto.
Para el **representante legal**, no: su número quedaba en texto claro en
`representante_legal_snapshot`.

No se hashea, y la razón es la que el owner fijó: el número del representante es
**prueba de la representación** (puede necesitarse en una constancia o en un
certificado de existencia y representación legal), y una huella no se puede
presentar como prueba.

| Aspecto | Cómo es |
|---|---|
| Algoritmo | AES-256-GCM (AEAD: un sobre alterado no se abre). |
| Llave | Derivada por HKDF del anillo de llaves, con el propósito `cifrado-representante` y el **ámbito de la Empresa**. Vive fuera de la base. |
| Formato del sobre | `enc:v2:<version>:<iv>:<tag>:<cifrado>`. La versión de llave viaja **dentro** del sobre: rotar la llave no vuelve ilegibles los números ya cifrados. |
| AAD | El sobre v2 se liga a `["kair-firma-cifrado","v2",propósito,ámbito,campo]`. Un sobre movido a otra Empresa o a otro campo no se abre. El formato `v1` se sigue leyendo sin AAD. |
| Lo que se muestra | Los **últimos 4** (`****3456`), como con el firmante. |
| Filas anteriores | Las que guardan el número en claro **siguen funcionando** (se reconocen y se enmascaran). El re-cifrado es un script aparte, en simulación por defecto (`scripts/recifrar-representante.js`). |

**Lo que cambia en la v1.2**: el bloque «Empresa que solicita tu firma» del
**1.2** ya **no** muestra la identificación del representante legal completa. La
v1.2 dice: *"En esa pantalla se muestra el tipo de documento del representante
legal y sus últimos cuatro (4) dígitos, no el número completo de la
identificación."* Ese dato no viene del snapshot cifrado: viene del registro
mercantil que la Empresa cargó en `gh_firma_empresas`, y ahora viaja
enmascarado igual.

| Aspecto | Cómo es |
|---|---|
| Qué viaja | El **tipo** declarado (CC, CE, TI, PPT, PA) y los **últimos 4** (`****3456`), en un solo campo: `CC ****3456`. |
| De dónde sale el tipo | Del texto que la Empresa cargó (`CC 12345678`). Si el tipo no es uno de los que el sistema conoce, **no se inventa**: sale `null` y se muestran solo los últimos 4. |
| Dónde se enmascara | En el servidor (`empresa.publicViewFor`), reutilizando el enmascarado de `services/representante.js` (el mismo de la Constancia). |
| Segunda barrera | En el cliente (`web/firma/app.js`): si el contexto llega con el dato en claro —un servidor viejo, una respuesta cacheada— la pantalla lo enmascara antes de pintarlo. |
| Lo que **no** cambia | La **huella** (`huella`): sigue siendo el SHA-256 del snapshot **en claro**, con el documento entero. Cambiarla invalidaría los consentimientos ya archivados. Lo que cambia es lo que se muestra, no lo que se archiva. |
| Los usos internos | El número completo sigue disponible por su propia vía: la fila de la Empresa (`GET /internal/admin/empresas/:id_empresa`) y el snapshot cifrado. El enmascarado es de la **vista pública**, no del dato. |

**Lo que sí cambia desde la v1.1**: la constancia consolidada mostraba el
número completo del representante. Ahora muestra los últimos 4, igual que hace
con el firmante.

#### 6.16.4 La copia de empresa en los consentimientos (8B-C)

El consentimiento guarda una copia de la identificación de la Empresa que se le
mostró al firmante (`gh_consentimientos_firma.empresa_snapshot`) y una huella
(`empresa_hash`). Esa copia sobrevive a la supresión de la firma, así que el
número del representante no puede quedar en claro ahí.

- **Cifrado**: el campo `representante_legal_identificacion` del snapshot se
  cifra con el mismo AES-256-GCM, propósito `cifrado-empresa-snapshot` y campo
  `empresa_snapshot.representante_legal_identificacion`. Se guardan además los
  últimos 4 como rastro, pero la presentación abre el sobre y verifica el GCM:
  si no abre, muestra `No disponible`; nunca `CC —`. Cuando recibe la huella
  archivada, también recalcula el hash sobre el claro y falla cerrado si no
  cuadra.
- **Huella**: `empresa_hash` se mantiene sobre el JSON canónico **en claro**.
  No se hashea el sobre porque el IV es aleatorio y la huella cambiaría en cada
  cifrado. Para verificar una fila hay que descifrarla y recalcular. La huella
  cubre solo los campos presentes, en el orden de `SNAPSHOT_FIELDS`: un snapshot
  histórico de 11 campos conserva la huella que se calculó sin
  `plazo_retencion` ni `canal_solicitud_copia`; los nuevos de 13 campos sí los
  incluyen.
- **Filas históricas**: se re-cifran con `scripts/recifrar-empresa-snapshot.js`,
  en simulación por defecto. Antes de escribir exige `--actor`, `--motivo`,
  `--backup` y `--ejecutar`; verifica la huella sha256 del texto exacto y la
  huella canónica fila por fila, y deja un recibo JSON sin el número completo.
  No toca filas con `empresa_hash` NULL o inconsistente, ni se salta a ciegas un
  sobre que no se abre con la Empresa y el campo de esa fila. En producción,
  además, exige `--confirmo-produccion` y un `--recibo` explícito.
- **Traza en la base**: cada fila re-cifrada deja un evento
  `CONSENT_SNAPSHOT_RECIFRADO` en `gh_consentimientos_eventos`, escrito
  **en la misma transacción** que el `UPDATE`: si el evento no se puede
  escribir, la fila no se toca. El evento lleva el actor, el motivo, la huella
  del JSON en claro y la versión de llave del sobre nuevo. **No** lleva el
  número del representante.
- **Lo que la huella NO es** (nota del 2026-10-20): `empresa_hash` es un
  **SHA-256 sin sal** del JSON canónico en claro. No es un HMAC: **cualquiera
  que tenga la identificación completa puede recalcularla**, sin la llave del
  servicio. Por eso la constancia **no** dice que "solo puede recalcularse con
  la llave del servicio" (decía eso y era falso): lo que dice es que la
  huella cubre el documento completo del representante, que no se imprime en la
  constancia, y que solo quien conozca esa identificación completa puede
  recalcular la huella y compararla.

#### 6.16.5 La Empresa tiene que estar habilitada para pedir firmas (D-03)

Una empresa **registrada** en el directorio (`gh_firma_empresas`) necesita dos
cosas antes de que K+AIR acepte una solicitud de firma:

| Requisito | De dónde sale | Dónde se resuelve |
|---|---|---|
| **Anexo de Encargo firmado** | `anexo_encargo_firmado_at` | `POST /internal/admin/empresas/{id}/anexo-firmado` |
| **Canal de atención (PQRS)** | `canal_pqrs` | `PUT /internal/admin/empresas/{id}` |

Si falta cualquiera de las dos, la firma se rechaza con
**`409 EMPRESA_NO_HABILITADA`** y el mensaje dice qué falta, dónde se resuelve y
cómo pedir una excepción.

**Dónde se comprueba (los cuatro puntos, 📦933).** El bloqueo no es solo de la
creación: se comprueba en la **creación de la solicitud**, en el **commit**, en la
**creación del consentimiento** (el del trabajador y el del representante) y en la
**doble firma**. En el commit la comprobación va **antes** de generar el PDF y la
constancia: si la Empresa no está habilitada, no se produce evidencia de una firma
que no se puede sostener.

> **El plazo de conservación NO es un requisito.** La custodia vive en el código
> (`ANIOS_CUSTODIA`, 20 años) y no hay nada que declarar. `plazo_retencion_dias`
> sigue siendo el dato **de la Empresa** que manda sobre el del sistema cuando sí
> está declarado.

**Por qué**: el 1.4 del Acuerdo hace depender de un Anexo de Encargo firmado
la relación entre la Empresa (Responsable) y K+AIR (Encargado), y el 7.2-7.3
exige el canal por el que el Trabajador pide la firma en papel.

**Una empresa que NO está registrada no se bloquea**: eso es otro problema
(identificación incompleta) y se atiende por el alta.

**La excepción (📦933).** La **única** salida del bloqueo es una excepción
**auditable**: no es un `if` silencioso ni una bandera de entorno (la bandera
`FIRMA_EXIGIR_HABILITACION_EMPRESA` **se retiró**: era exactamente el atajo que
no deja rastro). La excepción vive en `gh_firma_excepciones_habilitacion`, con su
bitácora **inalterable** en `gh_firma_excepciones_habilitacion_eventos`.

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/internal/admin/excepciones-habilitacion` | Lista las excepciones (`?id_empresa=` para filtrar). |
| `GET` | `/internal/admin/excepciones-habilitacion/:id` | Devuelve una excepción **con su bitácora**. |
| `POST` | `/internal/admin/excepciones-habilitacion` | Crea una excepción (los seis requisitos están en la tabla de abajo). |
| `POST` | `/internal/admin/excepciones-habilitacion/:id/cerrar` | Cierra la excepción (queda escrito). |

**Body de `POST /internal/admin/excepciones-habilitacion`** (los seis requisitos
del abogado, validados en el servidor):

| Campo | Qué es | Regla |
|---|---|---|
| `id_empresa` | La Empresa | **Una** por excepción |
| `autorizado_por` | Quién autoriza | Obligatorio: el owner o el representante legal |
| `autorizacion_fecha` | La fecha de la autorización | Obligatoria |
| `autorizacion_ref` | Dónde queda el documento escrito | Obligatoria |
| `alcance_firmas_max` | Número máximo de firmas | Entero ≥ 1 (máx. 1000) |
| `ruta_papel` | Cómo se firma en papel mientras tanto | Obligatoria |
| `ruta_papel_operativa` | Si está operativa **hoy** | Obligatorio: `true` o `false` |
| `plazo_hasta` | Fecha cierta para firmar el Anexo | **Máximo 30 días** desde la creación |
| `piloto_autorizado` | Solo si la Empresa no tiene ningún Anexo | `true` **y** `piloto_autorizado_por` |
| `motivo` | Por qué | Obligatorio: queda en la bitácora |

**Cómo cuenta el alcance.** El límite es de **firmas**, no de puntos de
verificación: lo gasta el punto que **abre** una firma (la creación de la
solicitud y la doble firma); el commit y la creación del consentimiento solo
aplican la excepción y levantan el bloqueo. Una firma atraviesa varios puntos y
no consume una unidad por cada uno.

**El inventario** (`scripts/inventario-empresas-no-habilitadas.js`) lista, **sin
escribir nada**, qué empresas están en ese estado y cuántas firmas tiene cada
una.


### 6.17 Endpoints de las solicitudes de los Titulares - `/internal/admin/solicitudes`

**Auth**: `X-Admin-API-Key` (operador humano). K+AIR **no** los usa desde la
app: su rol es recibir, registrar y trasmitir; la respuesta es de la Empresa.

| Endpoint | Qué hace |
|---|---|
| `GET /internal/admin/solicitudes` | Lista. Filtro opcional `?estado=` y `?limit=` |
| `GET /internal/admin/solicitudes/:id` | Una solicitud con su historial de eventos |
| `POST /internal/admin/solicitudes/:id/trasmitir` | K+AIR la remite a la Empresa (la Responsable) |
| `POST /internal/admin/solicitudes/:id/responder` | La Empresa responde; K+AIR devuelve la respuesta al Titular y archiva la evidencia |

**Cuerpo del traspaso**:

```json
{
  "actor": "kair:operador",
  "id_empresa": "900123456",
  "canal_empresa": "pqrs@empresa.com",
  "evidencia": { "constancia": "firma-123.pdf" }
}
```

**Cuerpo de la respuesta**:

```json
{
  "actor": "empresa:rrhh",
  "respuesta": "Adjuntamos la constancia.",
  "evidencia": { "constancia": "firma-123.pdf" }
}
```

**Los estados**: `RECIBIDA` → `TRASMITIDA` → `RESPONDIDA`.

**El historial es append-only y NO cuelga de la firma**: la 5B (la supresión
de datos personales) solo borra lo que cuelga de `gh_firmas_electronicas`, y
esta tabla no cuelga de ninguna. Sus eventos tienen triggers de inalterabilidad
(migración 029), probados aparte contra el archivo real.

**Errores**: `401` sin llave (`INVALID_API_KEY`), `404` si no existe
(`SOLICITUD_NOT_FOUND`), `409` si ya está respondida
(`SOLICITUD_ESTADO_INVALIDO`), `400` body inválido (`INVALID_REQUEST_BODY`).

---

### 6.18 El recibo de supresión (el 3.6(g) y el 10.6)

**Auth**: `X-Internal-API-Key` (K+AIR). Requiere la operación `sign_request:read`.

El **3.6(g)**: *"La supresión dentro de la ventana de purga del 8.6 no es
alteración: da lugar a una lápida que identifica la solicitud, la fecha y
hora, las categorías suprimidas y el fundamento del plazo, y a un recibo que
la Empresa entrega al Trabajador si lo solicita."*

Estos endpoints son **la vía de entrega** de ese recibo. Antes no existía
ninguna: la evidencia se guardaba, pero nadie podía obtenerla para
entregársela al Trabajador.

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/internal/empresas/:id_empresa/recibos-supresion` | Los recibos de supresión de la Empresa, del más reciente al más antiguo. `?limite=` (1 a 500, por defecto 100). |
| `GET` | `/internal/recibos-supresion/:id_solicitud` | El recibo de UNA solicitud (`SIGN-YYYY-NNNNNN`). |

**A quién se le entrega**: a la **Empresa**, que es la Responsable del dato y
la que se lo entrega al Trabajador (el **10.7(e)**: el Titular acude primero a
la Empresa). Por eso el listado es per-empresa.

**Aislamiento**: un cliente per-empresa que pide el recibo de otra recibe
`404` (`RECIBO_SUPERSION_NOT_FOUND`): no se revela la existencia de un recurso
ajeno. Un cliente que pide el path `/internal/empresas/{otra}/...` recibe
`403` (`EMPRESA_MISMATCH`) del middleware de alcance.

**El recibo**:

```json
{
  "id_solicitud": "SIGN-2026-020330",
  "id_empresa": "900123456",
  "purgado_at": "2026-10-23T20:15:39.427Z",
  "actor": "operador",
  "motivo": "Vencimiento del plazo declarado",
  "categorias": ["fila_firma", "pdf_original", "pdf_firmado", "constancia", "registro_auditoria", "archivos"],
  "fecha_conservacion": "2026-10-22T19:51:31.384Z",
  "ventana_hasta": "2026-10-23T20:15:39.427Z",
  "hold_verificado": true,
  "archivos_eliminados": 3,
  "eventos_purgados": 1
}
```

Los cuatro campos que el 3.6(g) exige son `id_solicitud` (la solicitud),
`purgado_at` (la fecha y hora), `categorias` (las categorías suprimidas) y
`fecha_conservacion` (el fundamento del plazo: hasta cuándo hubo que
conservar el dato).

**El recibo NO lleva datos personales**: ni el correo del Trabajador, ni su
documento, ni su nombre, ni la huella del documento, ni el token del enlace.
Solo identificadores internos, fechas, categorías y el fundamento. Es la misma
regla de la lápida y del recibo de purgas.

**Errores**: `401` sin llave (`INVALID_API_KEY`), `400` id de solicitud con
formato inválido o `limite` fuera de rango (`INVALID_REQUEST_BODY`), `404` si
la solicitud no fue suprimida (`RECIBO_SUPERSION_NOT_FOUND`).

> Un `404` (y no un `204`) es lo correcto: el que llama tiene que poder
> distinguir "no hay recibo" de "sí lo hay" para poder decirlo al Trabajador.

---

## 6.19 La auditoría de readiness legal — `GET /internal/admin/readiness-legal`

**Auth**: `X-Admin-API-Key` (operador humano). No lo usa K+AIR desde la app.

Es una **fotografía** del estado legal: no publica, no firma, no enciende el
D-02 y **no escribe en la base**. Devuelve los bloqueantes del proceso legal
como un reporte con una acción concreta para cada uno.

El mismo reporte se puede generar sin HTTP, con el mismo servicio:

```bash
node scripts/auditar-readiness-legal.js --gate=publicacion
node scripts/auditar-readiness-legal.js --gate=primera_firma --json
node scripts/auditar-readiness-legal.js --estricto   # sale con 1 si el gate no está listo
```

El endpoint y el CLI **comparten el mismo servicio** (`src/services/readinessLegal.js`)
para que no haya dos listas de requisitos que se desactualicen por separado.

**Query**:

| Parámetro | Valores | Qué hace |
|---|---|---|
| `gate` | `publicacion` \| `primera_firma` | `primera_firma` (por defecto) mira todo lo que falta para aceptar la primera firma real; `publicacion` solo mira lo que la respuesta 11A exige antes de publicar la v1.1. |

**Response — `200 OK`** (la forma real, verificada contra
`src/services/readinessLegal.js`):

```json
{
  "generado_at": "2026-10-23T23:52:38.531Z",
  "gate": "publicacion",
  "listo": false,
  "resumen": {
    "total_items": 38, "ok": 4, "pendientes": 31, "avisos": 1,
    "no_aplica": 2, "bloqueantes": 19, "bloqueantes_pendientes": 16
  },
  "manifiesto": {
    "existe": true, "archivo": "firma-service/legal-readiness.json",
    "error": null, "version": "2026-10-23", "actualizado_at": null
  },
  "db": {
    "disponible": true,
    "acuerdo_activo": null,
    "empresas": {
      "disponible": true, "total": 0, "con_anexo_base": 0,
      "con_anexo_nube": 0, "con_canal_pqrs": 0,
      "fechas_antes_del_alta": 0,
      "columna_anexo_nube": false, "error": null
    },
    "tablas": {
      "medios_trabajador": true, "firmas_papel": true, "excepciones": false,
      "excepciones_eventos": false, "solicitudes_titular": false,
      "trigger_excepciones_append_only": false
    }
  },
  "documentos": {
    "acuerdo_v1_1": {
      "archivo": "scripts/fixtures/acuerdo-v1.1.txt",
      "existe": false, "hash": "…",
      "placeholders": {
        "total": 0, "unicos": [], "muestras": [],
        "huecos":  { "total": 0, "unicos": [], "muestras": [] },
        "sistema": { "total": 0, "unicos": [], "muestras": [] }
      },
      "marcadores": [],
      "clausulas_ok": false,
      "faltan": [ { "id": "veinte_anios", "titulo": "Piso de veinte (20) años" } ]
    }
  },
  "grupos": [
    {
      "id": "acuerdo_v1_1",
      "titulo": "Acuerdo de uso v1.1",
      "listo": false,
      "items": [
        {
          "id": "texto_v1_1",
          "titulo": "Texto completo, sin placeholders ni marcas de borrador",
          "estado": "pendiente",
          "bloquea": ["publicacion", "primera_firma"],
          "detalle": "El documento no está disponible. Faltan cláusulas: …",
          "accion": "Montar la §2 de la respuesta 11A como archivo nuevo, …",
          "referencia": "scripts/fixtures/acuerdo-v1.1.txt"
        }
      ]
    }
  ],
  "bloqueantes": [
    { "grupo": "acuerdo_v1_1", "id": "texto_v1_1", "titulo": "…",
      "estado": "pendiente", "detalle": "…", "accion": "…" }
  ],
  "pendientes": [
    { "grupo": "acuerdo_v1_1", "id": "texto_v1_1", "titulo": "…",
      "detalle": "…", "accion": "…" }
  ]
}
```

Los estados de un item son `ok`, `pendiente`, `aviso` y `no_aplica`. `listo`
vale `true` solo cuando no queda ningún bloqueante pendiente en ese gate.

**`placeholders` separa los corchetes en dos clases.** `total` cuenta todas las
ocurrencias. `huecos` son las que alguien tiene que llenar: **son las que
bloquean** la publicación del texto. `sistema` son los campos que registra el
propio sistema (`[registrada por el sistema]`, los cuatro del bloque de
Manifestación de Voluntad): se listan —nada queda escondido— pero **no
bloquean**, porque el sistema los llena al firmar y la v1.0 ya está publicada
con ellos. La excepción es de contenido exacto: cualquier otra variante
(`[registrada por la empresa]`) sigue contando como hueco.

**De dónde sale cada dato**: el inventario de evidencias es
`firma-service/legal-readiness.json` (un campo por evidencia, con su fecha, su
archivo o su huella; **nunca** un valor de ejemplo); el texto y las cláusulas se
leen de los documentos reales del repo; el estado de publicación y el de las
empresas se leen de SQLite; la configuración operativa se lee de `config`.

Un campo que no tiene evidencia queda **pendiente**, con la acción que lo
resolvería: el reporte no inventa lo que falta ni lo deja pasar en silencio.

---

### 6.20 La carga accidental de datos de salud — `/internal/admin/sign-requests/{id}/incidente-datos-sensibles`

> **Nuevo en la v1.2.** Es el soporte del **10.8(d)**: el procedimiento
> contractual que corre cuando se carga por accidente un documento con datos
> de salud. **No es un módulo de incidentes**: no hay bandeja, ni triaje, ni
> plazos, ni escalamiento.

**Auth**: `X-Admin-API-Key` (operador humano). Lo mismo que el resto de
`/internal/admin/*`.

#### `POST /internal/admin/sign-requests/{id_solicitud}/incidente-datos-sensibles`

Registra el reporte y ejecuta los pasos (i) a (iv) del 10.8(d).

**Body**:

| Campo | Tipo | Obligatorio | Qué es |
|---|---|---|---|
| `causa` | string | sí | La causa invocada. Queda en el evento. |
| `reporta` | string | no | Quién reporta. Si no viene, se usa `X-Admin-Actor`. |
| `medidas` | string[] | no | Medidas que declara quien reporta. |

**Qué hace**:

1. **Bloquea** la solicitud (estado terminal `REVOKED`): el enlace de firma
   responde `410`, así que no se puede firmar ni reimprimir. Una solicitud ya
   firmada no se "desfirma" (eso falsearía la evidencia): el bloqueo no se
   aplica, y el reporte lo dice.
2. **Retiene** la solicitud con un hold: no es elegible para supresión
   mientras se resuelve el reporte (y su registro de eventos tampoco se
   puede alterar).
3. **Aisla** el documento: no se comunica, no se usa para otra finalidad y se
   conserva solo mientras se resuelve el reporte.
4. **Avisa** a la Empresa por su canal de incidentes (`canal_incidentes`). Si
   ahí no hay un correo válido, cae al `responsable_tratamiento_correo`; si no
   hay ninguno, **no se manda correo**: el reporte se registra igual y el
   evento deja constancia de que el aviso no salió.
5. **Registra** el evento `INCIDENTE_DATOS_SENSIBLES` con fecha y hora, quién
   reporta, la causa invocada y las medidas adoptadas (el 3.6(g)).

**Response exitosa — `201 Created`**:

```json
{
  "id_solicitud": "SIGN-2026-000123",
  "estado": "REVOKED",
  "bloqueo": { "aplicado": true, "estado_previo": "PENDING", "estado_nuevo": "REVOKED", "motivo": null },
  "retencion": { "declarada": true, "motivo": null, "hold_previo": null },
  "aislamiento": {
    "documento_comunicado": false,
    "documento_en_correo": false,
    "enlace_de_descarga": false,
    "conservado_hasta_resolver_el_reporte": true
  },
  "notificacion": {
    "enviada": true,
    "destinatario": "seguridad@ejemplo.co",
    "origen_canal": "canal_incidentes",
    "motivo_fallback": null,
    "message_id": "…",
    "error": null
  },
  "medidas": ["…"],
  "evento": "INCIDENTE_DATOS_SENSIBLES"
}
```

**Errores**: `400` body inválido (`INVALID_REQUEST_BODY`), `401` API key
(`INVALID_API_KEY`), `404` solicitud inexistente
(`SIGN_REQUEST_NOT_FOUND`), `409` la solicitud cambió de estado mientras se
registraba (`INVALID_STATE_TRANSITION`).

#### `POST /internal/admin/sign-requests/{id_solicitud}/incidente-datos-sensibles/resolver`

Resuelve el reporte: libera el hold y deja el documento disponible para la vía
de supresión del 8.6. **Body**: `causa` (obligatoria), `resuelve` (opcional,
por defecto `X-Admin-Actor`), `medidas` (opcional).

El hold **no** se levanta si hay otra retención vigente que no sea de este
reporte: esa retención es el deber legal o contractual de otro, y levantarla
sería privar a la Empresa de una retención que no le pertenece a este
procedimiento. La respuesta dice si el hold se liberó y por qué.

**Errores**: `400`, `401`, `404` (`SIGN_REQUEST_NOT_FOUND`), `409` si no hay
un incidente abierto (`NO_HAY_INCIDENTE_ABIERTO`) o si ya estaba resuelto
(`INCIDENTE_YA_RESUELTO`).

> El aislamiento del documento original que está en poder de la Empresa, las
> medidas hacia el Titular y el reporte a la autoridad son de la **Empresa**,
> que es la Responsable del tratamiento (el 10.1). K+AIR es el Encargado: este
> endpoint registra, bloquea, retiene y avisa; nada más.

---

## 7. Healthcheck

### `GET /health`

Endpoint público (sin auth) para monitoreo.

**Response exitosa — `200 OK`**:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "kair_version": "compatible-0.1.189",
  "uptime_seconds": 86400,
  "db": "ok",
  "smtp": "ok",
  "timestamp": "2026-08-17T15:30:00.000000Z"
}
```

**Response degradada — `503 Service Unavailable`**:

```json
{
  "status": "degraded",
  "version": "1.0.0",
  "checks": {
    "db": "ok",
    "smtp": "fail: connection timeout"
  },
  "timestamp": "2026-08-17T15:30:00.000000Z"
}
```

---

## 8. Headers comunes

### 8.1. Response headers (todas las requests)

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### 8.2. CSP específica de la mini-app

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  connect-src 'self';
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
```

### 8.3. Request ID

Todas las requests aceptan y responden el header `X-Request-Id`:

```
X-Request-Id: req_a1b2c3d4e5f6g7h8
```

Si el cliente no lo envía, el Servicio genera uno. Este ID aparece
en todos los logs y en el campo `error.request_id` de las
respuestas de error.

---

## 9. Seguridad operacional

### 9.1. Rotación de API key

- La `INTERNAL_API_KEY` se rota cada 90 días.
- Durante la rotación, el Servicio acepta **dos** keys: la actual
  y la anterior (período de gracia de 7 días).
- K+AIR detecta el header `X-API-Key-Warning: rotate-soon` y
  guarda la nueva key.

### 9.2. Rate limiting en el Servicio

El Servicio implementa rate limiting con `express-rate-limit`
usando el store por defecto (memoria) o Redis si se configura.

- En producción, **se recomienda Redis** para que el rate limit
  funcione correctamente con múltiples instancias.
- En desarrollo, memoria es suficiente.

### 9.3. Logs

- Formato: JSON estructurado.
- Cada log incluye: `timestamp`, `level`, `request_id`, `evento`,
  `actor`, `metadata`.
- **NO se loguean**: tokens, OTPs, cédulas, correos.
- Rotación: diaria, retención 90 días.

### 9.4. CORS

El Servicio **NO usa CORS** porque la mini-app se sirve desde el
mismo origen. Si en el futuro se sirve desde un CDN, se
configurará CORS restrictivo.

### 9.5. Helmet y middlewares

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: { /* ver 8.2 */ }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: 'no-referrer' }
}));
app.use(express.json({ limit: '100kb' }));  // para JSON
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
// multipart configurado aparte con multer para /internal/sign-requests
```

### 9.6. Validación de entrada

Todas las requests pasan por validación con un schema JSON
(recomendado: `zod` o `ajv`). El Servicio rechaza con `400
INVALID_REQUEST_BODY` si el body no cumple el schema.

---

**Fin del documento.**

Próximo: `FLOWS.md` (diagramas de secuencia detallados de cada
flujo).

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
| `TOKEN_NOT_FOUND` | El token no existe. |
| `TOKEN_EXPIRED` | El token pasó su `fecha_expiracion`. |
| `TOKEN_ALREADY_USED` | La solicitud está en estado terminal. |
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
| `CONSENT_NOT_FOUND` | El `consent_id` no existe. |
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
| `422` | No scrolleó al final | `INVALID_REQUEST_BODY` (con `scroll_al_final: false`) |

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
  "manifestacion_aceptada": true,
  "firma_visual_png": "iVBORw0KGgoAAAANSUhEUgAA...base64...",  // opcional
  "segundos_desde_view_document": 23
}
```

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `manifestacion_aceptada` | bool | sí | Debe ser `true`. |
| `firma_visual_png` | string | no | Base64 PNG sin prefijo `data:image/png;base64,`. ≤500 KB. |
| `segundos_desde_view_document` | int | no | Para auditoría. |

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
| `400` | Body inválido o `manifestacion_aceptada: false` | `INVALID_REQUEST_BODY` |
| `404` | Token no existe | `TOKEN_NOT_FOUND` |
| `410` | Estado terminal o expirado | `TOKEN_EXPIRED` o `TOKEN_ALREADY_USED` |
| `409` | Estado actual no es `DOCUMENT_VIEWED` | `INVALID_STATE_TRANSITION` (race condition con otro firmante) |
| `413` | Firma visual >500 KB | `INVALID_REQUEST_BODY` |
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

Devuelve el PDF original (congelado) para mostrar en el visor.

**Auth**: ninguna (token en URL).

**Rate limit**: 5 req/hora por token.

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
| `409` | Estado actual no permite ver el documento (ej. no
  identificado aún) |

**Headers de seguridad**:

```
X-Content-Type-Options: nosniff
Content-Security-Policy: default-src 'none'
X-Frame-Options: SAMEORIGIN
```

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
  "ttl_horas": 24,
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
| `id_trabajador` | string | sí | Cédula o ID de `base_personal`. |
| `id_empresa` | string | sí | NIT o ID de empresa. |
| `tipo_firma` | string | sí | `presencial` o `remoto`. |
| `agreement_hash` | string | sí | SHA-256 hex (64 chars). |
| `ttl_horas` | int | no | Default 24 (presencial), 72 (remoto). |
| `metadata` | object | no | Datos libres. |

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
  "estado": "PENDING"
}
```

> ⚠️ **Importante**: el `token` en texto plano SOLO se retorna en
> este momento. K+AIR debe guardarlo y mostrarlo como QR. El
> Servicio no lo almacena nunca más.

**Errores**:

| Código | Cuándo |
|---|---|
| `400` | Body inválido, multipart malformado |
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
  "plantilla_correo": "default",  // futuro: "urgente", "recordatorio"
  "remitente_personalizado": "rrhh@empresa.com"  // opcional
}
```

**Response exitosa — `200 OK`**:

```json
{
  "ok": true,
  "correo_enviado_a": "juan.p****@ejemplo.com",
  "fecha_envio": "2026-08-17T15:30:00.000000Z"
}
```

**Errores**:

| Código | Cuándo |
|---|---|
| `401` | API key inválida |
| `404` | Solicitud no encontrada |
| `409` | `tipo_firma !== 'remoto'` |

**Side effects**:

- Inserta evento `NOTIFICATION_SENT` con metadata del correo.

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

Todas las requests，接受 y responden el header `X-Request-Id`:

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

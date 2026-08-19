# Firma Electrónica K+AIR v1 — Análisis de Seguridad

**Versión del documento**: 0.1 (borrador de diseño)
**Fecha**: 2026-08-17
**Estado**: Borrador para revisión. Derivado de `ARCHITECTURE.md`, `DATA_MODEL.md`, `API.md` y `FLOWS.md`.
**Documentos rectores**:
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`DATA_MODEL.md`](./DATA_MODEL.md)
- [`API.md`](./API.md)
- [`FLOWS.md`](./FLOWS.md)

> **Aviso legal**
>
> Este análisis de seguridad cubre la arquitectura **diseñada conforme
> al marco normativo aplicable** a la firma electrónica de relaciones
> laborales en Colombia. **No constituye asesoría jurídica ni
> auditoría de seguridad formal.** La validación definitiva del
> mecanismo debe realizarla un **profesional jurídico colombiano** y
> un **auditor de seguridad** antes de producción.

---

## Tabla de contenidos

- [1. Alcance y limitaciones](#1-alcance-y-limitaciones)
- [2. Activos a proteger](#2-activos-a-proteger)
- [3. Modelo STRIDE](#3-modelo-stride)
  - [3.1 S — Spoofing (suplantación)](#31-s--spoofing-suplantación)
  - [3.2 T — Tampering (manipulación)](#32-t--tampering-manipulación)
  - [3.3 R — Repudiation (repudio)](#33-r--repudiation-repudio)
  - [3.4 I — Information Disclosure (filtración)](#34-i--information-disclosure-filtración)
  - [3.5 D — Denial of Service (denegación)](#35-d--denial-of-service-denegación)
  - [3.6 E — Elevation of Privilege (escalada)](#36-e--elevation-of-privilege-escalada)
- [4. Vectores de ataque específicos](#4-vectores-de-ataque-específicos)
- [5. Defensa en profundidad](#5-defensa-en-profundidad)
- [6. Gestión de secretos](#6-gestión-de-secretos)
- [7. Checklist pre-producción](#7-checklist-pre-producción)
- [8. Autorización per-empresa (D-13, I-010)](#8-autorización-per-empresa-d-13-i-010)
- [9. Pentesting post-implementación](#9-pentesting-post-implementación)
- [10. Bug bounty (futuro)](#10-bug-bounty-futuro)
- [11. Anexo: matriz de riesgos](#11-anexo-matriz-de-riesgos)

---

## 1. Alcance y limitaciones

### 1.1. Alcance

Este análisis cubre:

- ✅ Servicio de Firma (Express) y su BD SQLite.
- ✅ Mini-app web pública y su CSP.
- ✅ Comunicación K+AIR ↔ Servicio.
- ✅ Almacenamiento de PDFs, constancias y eventos.
- ✅ Flujo de tokens y OTPs.
- ✅ Logs y monitoreo.

### 1.2. Fuera del alcance

- ❌ Seguridad de la infraestructura del VPS (configuración de
  firewall, hardening del SO, etc.) — se asume que el proveedor
  (DigitalOcean, Hetzner, Railway, etc.) tiene su propia
  seguridad.
- ❌ Seguridad del correo del trabajador (compromiso del correo =
  compromiso del OTP, asumido en el Acuerdo).
- ❌ Seguridad física del dispositivo del trabajador.
- ❌ Seguridad interna de K+AIR local (ya cubierta por otros
  análisis).
- ❌ Cumplimiento SOC 2, ISO 27001, etc. (esos son procesos
  externos).

### 1.3. Suposiciones

- El VPS corre Linux actualizado con Node 20 LTS.
- HTTPS está correctamente configurado (certificado válido,
  TLS 1.2+).
- El DNS de `firma.k-air.com` apunta al VPS.
- K+AIR local está razonablemente protegido (autenticación de
  usuario, etc.).

---

## 2. Activos a proteger

| # | Activo | Criticidad | Justificación |
|---|---|---|---|
| A1 | **Tokens de firma** (en tránsito) | 🔴 Crítica | Acceso directo a la solicitud. |
| A2 | **`token_hash`** (en BD) | 🔴 Crítica | Si se filtran + el algoritmo, riesgo de fuerza bruta. |
| A3 | **OTPs en tránsito** | 🔴 Crítica | Si se intercepta, permite firmar. |
| A4 | **`otp_hash` + sal** (en BD) | 🔴 Crítica | Si se filtran, fuerza bruta. |
| A5 | **Cédulas en tránsito y en BD** | 🟠 Alta | Dato personal. Ley 1581. |
| A6 | **PDFs originales** | 🟠 Alta | Contenido del contrato. |
| A7 | **PDFs firmados** | 🟠 Alta | Evidencia legal. |
| A8 | **Constancias** | 🟠 Alta | Evidencia legal. |
| A9 | **Eventos de auditoría** | 🟠 Alta | Inmutabilidad requerida. |
| A10 | **Acuerdo de uso (texto y hash)** | 🟠 Alta | Base del consentimiento. |
| A11 | **API key interna** (K+AIR ↔ Servicio) | 🟠 Alta | Acceso de RH al Servicio. |
| A12 | **BD del Servicio** (firma.sqlite) | 🔴 Crítica | Todo el notario digital. |
| A13 | **Logs** | 🟡 Media | Si se filtran, exponen metadata. |
| A14 | **Correo del trabajador** | 🟡 Media | Necesario para OTP. |

---

## 3. Modelo STRIDE

STRIDE es un modelo de clasificación de amenazas de Microsoft
aplicable a sistemas distribuidos. Lo aplicamos a cada componente
del Servicio de Firma.

### 3.1. S — Spoofing (suplantación)

#### S.1. Suplantación del trabajador

| Aspecto | Detalle |
|---|---|
| **Descripción** | Un atacante se hace pasar por el trabajador y firma un documento. |
| **Activos** | A1, A2, A3, A4, A5 |
| **Vector de ataque** | Interceptar el token, interceptar el OTP, conocer la cédula. |
| **Probabilidad** | Media (depende del canal de entrega). |
| **Impacto** | 🔴 Alto (firma en nombre de otro = falsificación). |
| **Mitigación implementada** | (1) Token es aleatorio ≥32 chars, no enumerable. (2) Token almacenado solo como hash. (3) OTP con TTL 10 min, máx 5 intentos, hasheado con sal. (4) Cédula cotejada contra `base_personal`. (5) Manifestación explícita + checkbox. (6) Rate limiting por IP y por token. |
| **Mitigación recomendada** | (a) Notificación a RH de intentos fallidos. (b) Detección de IPs/ubicaciones anómalas. (c) MFA opcional (SMS) en v1.1. |
| **Riesgo residual** | 🟡 Bajo. Aceptable para v1. |

#### S.2. Suplantación de RH

| Aspecto | Detalle |
|---|---|
| **Descripción** | Un atacante con la API key interna crea solicitudes fraudulentas. |
| **Activos** | A11, A6, A7 |
| **Vector de ataque** | API key filtrada, MITM en la red local. |
| **Probabilidad** | Baja (la API key está en el llavero de K+AIR). |
| **Impacto** | 🟠 Alto. |
| **Mitigación implementada** | (1) API key en `safeStorage` de Electron, no en disco plano. (2) HTTPS obligatorio. (3) Validación de `X-Internal-API-Key` server-side. (4) Logs de toda llamada. (5) Rate limit 1000 req/min. |
| **Mitigación recomendada** | (a) Rotación de API key cada 90 días. (b) Alerta si la misma key se usa desde IPs muy distintas. |
| **Riesgo residual** | 🟡 Bajo. |

#### S.3. Suplantación del Servicio (phishing)

| Aspecto | Detalle |
|---|---|
| **Descripción** | Un atacante sirve una mini-app falsa con URL parecida. |
| **Activos** | A1, A3, A5 |
| **Vector de ataque** | Dominio `firma-k-air.com` (con guión) en vez de `firma.k-air.com`. |
| **Probabilidad** | Media (typosquatting). |
| **Impacto** | 🔴 Alto. |
| **Mitigación implementada** | (1) Dominio principal claro, comunicado en capacitación. (2) HSTS con `includeSubDomains` para que navegadores rechacen subdominios fraudulentos. (3) Certificados válidos. |
| **Mitigación recomendada** | (a) Registro de dominios similares (`.com.co`, `.co`, con y sin guión). (b) Cert pinning en la mini-app (en v1.1). (c) Banner en la mini-app que muestra el dominio. |
| **Riesgo residual** | 🟡 Bajo. |

### 3.2. T — Tampering (manipulación)

#### T.1. Modificación del PDF firmado

| Aspecto | Detalle |
|---|---|
| **Descripción** | Un atacante modifica el PDF firmado después de la firma. |
| **Activos** | A7, A8 |
| **Vector de ataque** | Acceso al sistema de archivos del Servicio. |
| **Probabilidad** | Baja (requiere acceso al VPS). |
| **Impacto** | 🔴 Crítico. |
| **Mitigación implementada** | (1) SHA-256 `document_hash_firmado` calculado y comparado. (2) `evidence_hash` sobre JSON canónico. (3) PDFs en directorio con permisos restrictivos. (4) Verificación posterior posible: `SHA-256(pdf) == document_hash_firmado`. |
| **Mitigación recomendada** | (a) Monitoreo de integridad de archivos (file integrity monitoring). (b) Backups firmados con `gpg`. |
| **Riesgo residual** | 🟢 Muy bajo. |

#### T.2. Modificación de eventos de auditoría

| Aspecto | Detalle |
|---|---|
| **Descripción** | Un atacante borra o modifica eventos. |
| **Activos** | A9 |
| **Vector de ataque** | Acceso a la BD. |
| **Probabilidad** | Baja. |
| **Impacto** | 🟠 Alto (rompe la trazabilidad). |
| **Mitigación implementada** | (1) Tabla `gh_firma_eventos` append-only a nivel de código (no hay método `update()` ni `delete()`). (2) Constraint en BD: `id_evento_anterior` debe ser referenciable. (3) Backups diarios inmutables. |
| **Mitigación recomendada** | (a) Trigger SQL que rechace UPDATE/DELETE en `gh_firma_eventos`. (b) Hash chain: cada evento incluye hash del anterior. |
| **Riesgo residual** | 🟢 Muy bajo. |

#### T.3. Modificación de la base de datos SQLite

| Aspecto | Detalle |
|---|---|
| **Descripción** | Un atacante edita la BD directamente. |
| **Activos** | A12, A2, A4 |
| **Vector de ataque** | Acceso al archivo `firma.sqlite`. |
| **Probabilidad** | Baja. |
| **Impacto** | 🔴 Crítico. |
| **Mitigación implementada** | (1) SQLite con `PRAGMA journal_mode=WAL`. (2) Permisos de archivo restrictivos. (3) Backups encriptados. (4) CHECK constraints en BD. |
| **Mitigación recomendada** | (a) Usuario del SO con permisos mínimos. (b) Auditoría periódica de la BD. |
| **Riesgo residual** | 🟢 Muy bajo. |

#### T.4. Inyección SQL

| Aspecto | Detalle |
|---|---|
| **Descripción** | Un atacante inyecta SQL en los inputs. |
| **Activos** | A12, A6-A9 |
| **Vector de ataque** | Inputs no sanitizados en endpoints. |
| **Probabilidad** | Media (cualquier endpoint público es vector). |
| **Impacto** | 🔴 Crítico. |
| **Mitigación implementada** | (1) SQL parametrizado en todo el código (better-sqlite3 `prepare(...).get(...)`). (2) Validación con `zod` o `ajv` antes de cualquier query. (3) No concatenación de strings en SQL. |
| **Mitigación recomendada** | (a) Code review obligatorio en PRs que toquen SQL. (b) Tests de fuzzing. |
| **Riesgo residual** | 🟢 Muy bajo. |

### 3.3. R — Repudiation (repudio)

#### R.1. El trabajador repudia haber firmado

| Aspecto | Detalle |
|---|---|
| **Descripción** | El trabajador dice "yo nunca firmé eso". |
| **Activos** | Legal, reputación. |
| **Vector de ataque** | Real (reclamaciones laborales). |
| **Probabilidad** | Media (es un caso real en Colombia). |
| **Impacto** | 🟠 Alto. |
| **Mitigación implementada** | (1) Línea de tiempo de eventos con timestamp, IP, user-agent. (2) Identificación por cédula cotejada. (3) OTP al correo con hash + sal. (4) Manifestación de voluntad explícita. (5) Constancia PDF con todos los hashes. (6) `evidence_hash` verificable por terceros. (7) Correo con copia al firmante como prueba de recepción. |
| **Mitigación recomendada** | (a) TSA (Time Stamping Authority) en v1.1 para sellos de tiempo cualificados. (b) Conservación de headers del correo original. |
| **Riesgo residual** | 🟡 Bajo. Aceptable para v1, mejorable con TSA. |

#### R.2. El empleador repudia haber enviado

| Aspecto | Detalle |
|---|---|
| **Descripción** | RH dice "yo nunca envié esa solicitud". |
| **Activos** | A11, logs. |
| **Vector de ataque** | Real (reclamaciones). |
| **Probabilidad** | Baja. |
| **Impacto** | 🟡 Medio. |
| **Mitigación implementada** | (1) Cada llamada interna registra `rh_user_id`. (2) Logs firmados. (3) Evento `CREATED` con metadata del usuario. |
| **Riesgo residual** | 🟢 Muy bajo. |

### 3.4. I — Information Disclosure (filtración)

#### I.1. Filtración de tokens

| Aspecto | Detalle |
|---|---|
| **Descripción** | El token se filtra (logs, backups, error message, etc.). |
| **Activos** | A1, A2 |
| **Vector de ataque** | Error en logs que incluya el token. |
| **Probabilidad** | Baja. |
| **Impacto** | 🔴 Crítico. |
| **Mitigación implementada** | (1) Token en plano SOLO en la respuesta de creación. (2) Resto del tiempo solo `token_hash`. (3) Logs con redacción automática de tokens. (4) Mensajes de error no incluyen el token. |
| **Mitigación recomendada** | (a) Tests que verifiquen que ningún log incluye tokens. (b) DLP (Data Loss Prevention) en logs. |
| **Riesgo residual** | 🟢 Muy bajo. |

#### I.2. Filtración de OTPs

| Aspecto | Detalle |
|---|---|
| **Descripción** | El OTP se filtra. |
| **Activos** | A3, A4 |
| **Vector de ataque** | Logs, screenshots del usuario. |
| **Probabilidad** | Baja. |
| **Impacto** | 🔴 Crítico. |
| **Mitigación implementada** | (1) OTP en plano SOLO en el correo y en la respuesta de `identify`. (2) Hash con sal en BD. (3) TTL corto. (4) Correo menciona "no compartas este código". |
| **Mitigación recomendada** | (a) Redacción automática en logs. (b) Capacitación al trabajador. |
| **Riesgo residual** | 🟢 Muy bajo. |

#### I.3. Filtración de la BD

| Aspecto | Detalle |
|---|---|
| **Descripción** | La BD completa se filtra. |
| **Activos** | A12, A2-A10 |
| **Vector de ataque** | Robo de backup, acceso al VPS. |
| **Probabilidad** | Baja. |
| **Impacto** | 🟠 Alto. |
| **Mitigación implementada** | (1) Backups encriptados con AES-256. (2) Tokens y OTPs hasheados (no en plano). (3) Cédulas hasheadas. (4) Correos hasheados con sal en backups. (5) Logs de acceso a la BD. |
| **Mitigación recomendada** | (a) Custodia de claves con KMS (AWS KMS, GCP KMS, etc.). (b) Alertas de acceso anómalo. |
| **Riesgo residual** | 🟡 Bajo. |

#### I.4. Filtración de PDFs

| Aspecto | Detalle |
|---|---|
| **Descripción** | Un PDF firmado se filtra. |
| **Activos** | A6, A7, A8 |
| **Vector de ataque** | Robo de archivos, listado de directorios. |
| **Probabilidad** | Baja. |
| **Impacto** | 🟡 Medio (el firmante ya tiene copia). |
| **Mitigación implementada** | (1) Permisos restrictivos en `/var/lib/kair-firma/pdfs/`. (2) URLs con token no enumerables. (3) Solo descarga con token válido. |
| **Mitigación recomendada** | (a) Watermark en PDFs con identificación del solicitante. (b) Logs de descarga. |
| **Riesgo residual** | 🟡 Bajo. |

### 3.5. D — Denial of Service (denegación)

#### D.1. DoS por rate limiting insuficiente

| Aspecto | Detalle |
|---|---|
| **Descripción** | Un atacante bombardea los endpoints públicos. |
| **Activos** | Disponibilidad. |
| **Vector de ataque** | Bot que prueba millones de tokens. |
| **Probabilidad** | Media. |
| **Impacto** | 🟡 Medio. |
| **Mitigación implementada** | (1) Rate limit por IP y por token. (2) Token ≥32 chars (2^192 espacio). (3) `helmet` + headers de seguridad. (4) Costo de bcrypt/SHA alto. |
| **Mitigación recomendada** | (a) Cloudflare o similar en el VPS. (b) WAF. (c) Alertas de tráfico anómalo. |
| **Riesgo residual** | 🟢 Muy bajo. |

#### D.2. DoS por crecimiento de BD

| Aspecto | Detalle |
|---|---|
| **Descripción** | La BD crece hasta llenar el disco. |
| **Activos** | A12. |
| **Vector de ataque** | Inserciones masivas (con API key robada). |
| **Probabilidad** | Baja. |
| **Impacto** | 🟡 Medio. |
| **Mitigación implementada** | (1) Rate limit en API key. (2) Monitoreo de espacio en disco. (3) PDFs separados de la BD. |
| **Mitigación recomendada** | (a) Cuota máxima de solicitudes por API key. (b) Limpieza periódica de PDFs antiguos. |
| **Riesgo residual** | 🟢 Muy bajo. |

#### D.3. Caída del servicio SMTP o rebote de correo

| Aspecto | Detalle |
|---|---|
| **Descripción** | El proveedor de correo falla, o el correo del trabajador rebota (bandeja llena, dirección inválida, servidor destino caído). |
| **Activos** | OTP, notificaciones, copia al trabajador. |
| **Vector de ataque** | Falla externa o problema operacional, no ataque. |
| **Probabilidad** | Media (es un proveedor externo + problemas de correo del usuario). |
| **Impacto** | 🟠 Alto si afecta al OTP (no se puede firmar); 🟡 Medio si afecta a notificación o copia. |
| **Mitigación implementada** | (1) Health check incluye verificación SMTP. (2) Webhook del SMTP para detectar rebotes. (3) Eventos `EMAIL_BOUNCED`, `EMAIL_RETRY_SCHEDULED`, `EMAIL_RETRY_EXHAUSTED`, `EMAIL_RESENT`. (4) Reintentos automáticos con backoff (5 min, 30 min, 2 h) hasta 3 veces. (5) **El rebote NO marca la solicitud como terminal**: RH recibe notificación y puede reenviar manualmente, corregir el correo del trabajador, o crear nueva solicitud. |
| **Mitigación recomendada** | (a) Proveedor SMTP secundario. (b) Validación de sintaxis de correo al ingreso. (c) Verificación de correo del trabajador en el pipeline de contratación. (d) Almacenamiento del PDF en VPS como respaldo, independiente del correo. |
| **Riesgo residual** | 🟡 Bajo. |

### 3.6. E — Elevation of Privilege (escalada)

#### E.1. Acceso de mini-app a endpoints internos

| Aspecto | Detalle |
|---|---|
| **Descripción** | La mini-app intenta llamar a `/internal/...`. |
| **Activos** | A11. |
| **Vector de ataque** | Dev tools del navegador. |
| **Probabilidad** | Alta (cualquier usuario con DevTools). |
| **Impacto** | 🟢 Bajo si la API key está bien protegida. |
| **Mitigación implementada** | (1) Middleware que valida `X-Internal-API-Key`. (2) Sin esa key, los endpoints internos retornan 401. (3) API key nunca se envía al frontend. |
| **Riesgo residual** | 🟢 Muy bajo. |

#### E.2. Token de un endpoint usado en otro

| Aspecto | Detalle |
|---|---|
| **Descripción** | El token de `/api/sign/...` se usa en `/internal/...`. |
| **Activos** | A1, A11. |
| **Vector de ataque** | Inyección de tokens en otros paths. |
| **Probabilidad** | Baja. |
| **Impacto** | 🟢 Bajo. |
| **Mitigación implementada** | (1) Routers separados en Express. (2) Validación cruzada: si un token llega a `/internal/`, se ignora. (3) Namespaces distintos. |
| **Riesgo residual** | 🟢 Muy bajo. |

#### E.3. Manipulación de la mini-app

| Aspecto | Detalle |
|---|---|
| **Descripción** | El usuario manipula el JS de la mini-app. |
| **Activos** | A1, A3, A5. |
| **Vector de ataque** | Modificar localStorage, manipular eventos. |
| **Probabilidad** | Alta (fácil). |
| **Impacto** | 🟢 Bajo (el backend re-valida todo). |
| **Mitigación implementada** | (1) Backend siempre re-valida estado. (2) Mini-app es estática, sin estado de autenticación local. (3) CSP estricta. |
| **Riesgo residual** | 🟢 Muy bajo. |

---

## 4. Vectores de ataque específicos

### 4.1. Ataque de fuerza bruta al token

```
Atacante prueba millones de tokens hasta dar con uno válido.
```

- **Espacio de tokens**: 32 chars alfanuméricos ≈ 2^190.
- **A 1M de intentos/segundo**: 2^190 / 10^6 ≈ 2^170 segundos.
- **Prácticamente imposible**. Pero el rate limit añade otra capa.
- **Mitigación**: rate limit 60 req/min/IP + espacio enorme.

### 4.2. Ataque de replay al OTP

```
Atacante intercepta un OTP usado y lo reenvía.
```

- **Mitigación**: OTP se invalida tras primer uso exitoso
  (`estado = 'OTP_VERIFIED'`).
- Si se reusa, el backend rechaza con `409 INVALID_STATE_TRANSITION`.

### 4.3. Ataque de MitM al correo del trabajador

```
Atacante intercepta el correo con el OTP.
```

- **Vector**: comprometer el correo del trabajador.
- **Mitigación**: HTTPS + capacitación al usuario + TTL corto.
- **Riesgo residual**: depende del usuario. Documentado en Acuerdo.

### 4.4. Ataque de timing al hash de OTP

```
Atacante mide tiempos de respuesta para adivinar OTP.
```

- **Vector**: comparar tiempos de respuesta del endpoint
  `/verify-otp`.
- **Mitigación**: usar `crypto.timingSafeEqual()` para comparar
  hashes (no `===`).
- Implementación: OBLIGATORIA en v1.

```javascript
const expected = Buffer.from(otpHashEsperado, 'hex');
const actual = Buffer.from(otpHashCalculado, 'hex');
if (expected.length !== actual.length) return false;
return crypto.timingSafeEqual(expected, actual);
```

### 4.5. SSRF (Server-Side Request Forgery)

```
Atacante logra que el Servicio haga requests a sitios internos.
```

- **Vector**: cualquier endpoint que reciba una URL.
- **Mitigación**: el Servicio NO acepta URLs del cliente. Las
  únicas URLs externas son las de K+AIR (ya pre-configuradas).
- **Validación**: en code review, rechazar cualquier `fetch()`
  con URL dinámica del body.

### 4.6. CSRF en endpoints internos

```
Atacante engaña a K+AIR para que ejecute acciones en su nombre.
```

- **Vector**: K+AIR local con API key, pero un atacante crea una
  página web que engaña al usuario.
- **Mitigación**: API key en header, no en cookie. Los endpoints
  internos no se exponen al navegador.
- **Riesgo residual**: muy bajo.

### 4.7. Path traversal en descarga de PDFs

```
Atacante manipula el path para acceder a archivos del sistema.
```

- **Vector**: `GET /internal/sign-requests/:id/pdf-firmado`.
- **Mitigación**: el `:id` se valida contra la BD, no se usa
  como path directamente. El path siempre es
  `/var/lib/kair-firma/pdfs/firmados/{id_solicitud}.pdf`.
- **Validación**: code review + tests.

---

## 5. Defensa en profundidad

El Servicio implementa **5 capas de defensa**:

```
┌──────────────────────────────────────────────────────────────┐
│ CAPA 1: RED                                                  │
│   • HTTPS obligatorio (TLS 1.2+)                            │
│   • HSTS con includeSubDomains                              │
│   • Rate limit por IP (60 req/min)                          │
│   • Cloudflare / WAF (recomendado)                           │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ CAPA 2: APLICACIÓN                                           │
│   • Validación con zod/ajv en TODOS los endpoints           │
│   • Headers de seguridad (helmet)                            │
│   • CSP estricta en mini-app                                 │
│   • CORS deshabilitado (mini-app mismo origen)               │
│   • Rate limit por token y por scope                         │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ CAPA 3: AUTENTICACIÓN                                        │
│   • Token ≥32 chars con hash SHA-256                        │
│   • OTP con hash + sal                                       │
│   • API key para endpoints internos (con rotación)           │
│   • Cedula cotejada con base_personal                        │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ CAPA 4: DATOS                                                │
│   • Tokens y OTPs NUNCA en plano en BD                       │
│   • Cédulas hasheadas (operaciones de cotejo)                │
│   • SQL parametrizado (sin concatenación)                    │
│   • JSON canónico para evidence_hash                         │
│   • Cryptographic timing safe compare                        │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ CAPA 5: AUDITORÍA                                            │
│   • Eventos append-only con timestamp                        │
│   • Logs JSON estructurados                                  │
│   • X-Request-Id en cada request                             │
│   • Health check con verificación de SMTP y DB               │
│   • Backups encriptados diarios                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Gestión de secretos

### 6.1. Inventario de secretos

| Secreto | Dónde se guarda | Cómo se rota |
|---|---|---|
| `INTERNAL_API_KEY` | Variable de entorno | Cada 90 días (período de gracia 7d). |
| `SMTP_PASS` | Variable de entorno | Cuando el proveedor lo permita. |
| Sal de OTP | Generada por OTP, descartada tras uso | Por OTP. |
| `token` (en tránsito) | Solo en la respuesta de creación | Por solicitud. |
| OTP (en tránsito) | Solo en el correo y en la respuesta de `identify` | Por OTP. |
| Certificados TLS | Let's Encrypt o similar | Cada 90 días (auto). |

### 6.2. Variables de entorno

- ✅ Todas las claves via `process.env.X`.
- ❌ NUNCA hardcoded en código.
- ✅ `.env` en `.gitignore`.
- ✅ `.env.example` con claves ficticias en el repo.
- ✅ En producción, las variables se inyectan vía el orquestador
  (systemd, Docker secrets, etc.).

### 6.3. Logs y secretos

Política de redacción automática:

```javascript
function redactLog(obj) {
  const sensitive = ['token', 'otp', 'password', 'api_key', 
                    'internal_api_key', 'correo', 'cedula'];
  // ... regex + redacción
}
```

Cualquier log que pase por esta función reemplaza los valores
sensibles con `[REDACTED]`.

---

## 7. Checklist pre-producción

Antes de habilitar el Servicio en producción, verificar:

### 7.1. Configuración

- [ ] `NODE_ENV=production`
- [ ] HTTPS configurado con certificado válido
- [ ] HSTS habilitado
- [ ] `helmet` configurado
- [ ] CSP estricta en mini-app
- [ ] Variables de entorno NO en el repo
- [ ] `INTERNAL_API_KEY` rotada y comunicada a K+AIR
- [ ] SMTP configurado y probado

### 7.2. BD

- [ ] Schema migrado
- [ ] `PRAGMA journal_mode=WAL`
- [ ] `PRAGMA foreign_keys=ON`
- [ ] Backups automatizados y probados
- [ ] Restauración desde backup probada

### 7.3. Endpoints

- [ ] Todos los endpoints públicos validan el token
- [ ] Todos los endpoints internos validan la API key
- [ ] Rate limit configurado
- [ ] Mensajes de error NO incluyen secretos
- [ ] Headers de seguridad en TODAS las respuestas

### 7.4. Logs

- [ ] Redacción automática funcionando
- [ ] Rotación de logs configurada
- [ ] Retención 90 días
- [ ] Logs no se imprimen en stdout en producción

### 7.5. Seguridad operacional

- [ ] `npm audit` sin vulnerabilidades altas
- [ ] `npm audit fix` aplicado donde sea seguro
- [ ] Dependencias con versión fija (no `^`)
- [ ] Renovación automática de certificados configurada
- [ ] Monitoreo de uptime (UptimeRobot, Pingdom, etc.)
- [ ] Alertas de error 5xx configuradas

### 7.6. Legal

- [ ] Acuerdo de uso redactado y revisado por abogado
- [ ] Política de privacidad actualizada
- [ ] Términos de servicio del Servicio publicados
- [ ] Tratamiento de datos personales documentado (Ley 1581)

### 7.7. Pruebas

- [ ] Tests unitarios del Servicio pasando
- [ ] Tests de integración de los endpoints pasando
- [ ] Tests de carga (1000 firmas concurrentes)
- [ ] Pentesting externo completado
- [ ] Plan de respuesta a incidentes documentado

---

## 8. Autorización per-empresa (D-13, I-010)

> **Estado**: implementado en `firma-service` v0.2.0 (I-010).
> **Diseño completo**: ver
> [`docs/kair-firma-integration/I-010-design.md`](../../kair-firma-integration/I-010-design.md).

### 8.1. Contexto y motivación

Antes de I-010, el Servicio tenía **una sola API key global** (`INTERNAL_API_KEY`).
Cualquier actor con esa key podía firmar para **cualquier empresa**. Esto
escala privilegios cross-company: un atacante que compromete la key
compromete TODAS las empresas cliente.

I-010 reemplaza el modelo "1 key global" por **"1 key por empresa"** con
scope explícito de operaciones:

| Aspecto | Antes (pre-I-010) | Después (I-010) |
|---|---|---|
| API keys | 1 global | 1 por cliente (per-empresa) |
| Scope de empresa | Sin scope (cualquiera) | Atado a `id_empresa` |
| Scope de operación | Todas | Declarado en `allowed_operations` |
| Persistencia | Variable de entorno | Tabla `gh_internal_clients` con SHA-256 hash |
| Cache | N/A | 30s en memoria |

### 8.2. Tabla `gh_internal_clients`

```sql
CREATE TABLE gh_internal_clients (
  api_key_hash TEXT PRIMARY KEY,        -- SHA-256 hex (64 chars)
  id_empresa TEXT NOT NULL,             -- Empresa a la que está atado
  allowed_operations TEXT NOT NULL,     -- CSV: "sign_request:create,sign_request:read"
  description TEXT,                     -- Auditoría libre
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT                       -- NULL = activa, ISO8601 = revocada
);
```

**Decisiones críticas**:

1. **SHA-256 en vez de bcrypt/argon2**: las API keys son strings ≥32
   chars con **256 bits de entropía** (generadas con `crypto.randomBytes`).
   No son contraseñas humanas. bcrypt/argon2 están diseñados para
   contraseñas humanas (~20-40 bits efectivos) y agregan latencia
   innecesaria. SHA-256 es suficiente y rápido.

2. **`api_key_hash` como PK**: el lookup siempre es por hash, no
   necesitamos un surrogate key. Esto simplifica el código y elimina
   una indirección.

3. **NO usar `id_empresa='*'`** para "legacy global". En su lugar, en
   código se usa `authSource='legacy'` + `id_empresa=null`. Esto hace
   explícita la "ausencia de identidad empresarial" y evita lógica
   especial con wildcards en cada handler.

4. **Soft-delete con `revoked_at`**: preserva el historial. Un cliente
   que cambia de empresa puede ser revocado sin perder el registro de
   quién usó esa key.

5. **Índice parcial `idx_internal_clients_empresa_active`** con
   `WHERE revoked_at IS NULL`: queries más rápidas sobre el set activo
   solamente.

### 8.3. Modelo de amenaza

**Amenaza mitigada**: E.1 cross-company privilege escalation. Un cliente
con la key de la empresa A intenta firmar/consultar recursos de la
empresa B.

**Vector residual**: dentro del mismo `id_empresa`, el cliente puede
actuar sobre cualquier recurso (firma de cualquier documento de cualquier
trabajador de su empresa). Esto es **por diseño** — el cliente es
interno de la empresa y se asume confianza. La mitigación es
operacional: el `id_empresa` se asigna con criterio y se monitorea el
uso.

### 8.4. `req.id_empresa` autoritativo

**Regla**: `req.id_empresa` SIEMPRE viene de la identidad autenticada,
NUNCA del body/query. Para el listado, en `client` mode IGNORAMOS
`?id_empresa=` del query y FORZAMOS `req.id_empresa`. No hay forma de
escapar el scope.

**Razón**: si el handler usara `body.id_empresa || query.id_empresa`, un
atacante con la key de la empresa A podría inyectar `id_empresa=B` en el
body o query y acceder a recursos de B. `req.id_empresa` autoritativo
cierra ese vector.

**Caso excepción (legacy)**: durante la ventana de deprecation (1
release), el listado en `legacy` mode USA `?id_empresa=` del query para
mantener compatibilidad con K+AIR. Esto se elimina en una release futura.

### 8.5. Status codes de authz

| Status | Significado | Cuándo |
|---|---|---|
| **401 INVALID_API_KEY** | No autenticado | Header ausente, key inválida o revocada |
| **403 FORBIDDEN** | Sin permiso de operación | Cliente autenticado, sin la operación permitida |
| **403 EMPRESA_MISMATCH** | Cross-company | Cliente autenticado, body/query con `id_empresa` que no es la suya |
| **404 NOT_FOUND** (silent) | Recurso no accesible | GET /:id, GET /:id/eventos cuando el recurso pertenece a OTRA empresa (no filtra existencia) |

### 8.6. Cache 30s y ventana de revocación

La lookup `apiKey → cliente activo` se cachea 30s en memoria (Map).
**Implicación**: si se revoca una key, hay hasta 30s de ventana antes
de que el cache expire y la revocación sea efectiva.

**Riesgo aceptado**: un atacante con la key robada tiene 30s de uso
después de la revocación. Mitigado por:

- Rate limit 60 req/min/IP (config.rateLimit.perMinute).
- Log de uso post-revocación detectable.
- TTL puede bajarse a 5s si la revocación inmediata es crítica.

### 8.7. Legacy compat (1 release)

Durante **1 release** (v0.2.0), el sistema acepta la `INTERNAL_API_KEY`
legacy (pre-I-010) con `authSource='legacy'`. Esto preserva la
compatibilidad con K+AIR mientras migra a claves per-empresa.

**Comportamiento legacy**:

- `req.authSource = 'legacy'`
- `req.id_empresa = null` (NO `'*'`)
- `req.clientOperations = ['legacy']` (marca especial)
- **El middleware NO bloquea** operaciones ni check de id_empresa.
- **El handler hace su propio check post-lookup** si lo necesita
  (ej. GET /:id, GET eventos).
- **Log de deprecation warning** por cada request legacy:
  ```
  DEPRECATION: cliente legacy accedió endpoint protegido por requireEmpresaScope
  ```

**Plan de eliminación**:

| Release | Acción |
|---|---|
| v0.2.0 (I-010) | Legacy mode activo. K+AIR sigue con la key global. |
| v0.3.0 | K+AIR migra a keys per-empresa. Legacy mode sigue activo. |
| v0.4.0 (futuro) | Se elimina el fallback legacy. Keys no encontradas en `gh_internal_clients` → 401. |

### 8.8. Migración de K+AIR

K+AIR debe generar 1 API key por empresa y almacenarla en
`gh_internal_clients`:

```bash
# 1. Generar key (ejecutar una vez por empresa)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: 4f8a2c... (64 chars hex)

# 2. Calcular hash SHA-256
node -e "console.log(require('crypto').createHash('sha256').update('4f8a2c...').digest('hex'))"
# Output: <64 chars hex>

# 3. Insertar en BD (vía admin o script)
INSERT INTO gh_internal_clients
  (api_key_hash, id_empresa, allowed_operations, description)
VALUES
  ('<hash>', '900123456', 'sign_request:create,sign_request:read,consent:create,consent:verify,audit:read',
   'K+AIR empresa 900123456 - prod');
```

**Actualizar `secrets.enc`** en K+AIR con la nueva key (no el hash).
La key NUNCA debe quedar en la BD; solo el hash.

### 8.9. `TRUST_PROXY` — OBLIGATORIO en producción

**Esta sección es crítica para la seguridad del rate limiting y de la
cadena de custodia forense.**

`config.trustProxy` controla cómo Express resuelve `req.ip` cuando hay
un proxy reverso (nginx, Cloudflare, etc.) entre el cliente y el
Servicio. Si está mal configurado:

- Un atacante puede falsificar `X-Forwarded-For` y bypasear el rate
  limit.
- Los logs forenses de `ip_origen` quedan contaminados.
- `req.ip` no refleja la IP real del cliente.

**Configuración obligatoria por entorno**:

| Entorno | TRUST_PROXY | Razón |
|---|---|---|
| **Desarrollo** (sin proxy) | `'loopback'` (default) | Solo 127.0.0.1 y ::1. No acepta X-Forwarded-For. |
| **Producción con nginx** (1 hop) | `TRUST_PROXY=1` | El último hop (nginx). |
| **Producción con Cloudflare** | `TRUST_PROXY=<ip-cloudflare>` | Lista explícita de IPs de Cloudflare. |
| **Producción multi-hop** | `TRUST_PROXY=<ip-proxy-inmediato>` | Solo el proxy inmediato, no cualquiera. |

**NUNCA usar `TRUST_PROXY=true`**: confía en CUALQUIER proxy,
incluyendo el header `X-Forwarded-For` enviado por el cliente. Esto
rompe el rate limit y la cadena de custodia.

**Verificación pre-producción** (checklist §7.1):
- [ ] `TRUST_PROXY` configurado explícitamente.
- [ ] `TRUST_PROXY` NO es `true`.
- [ ] El valor refleja la topología real (1 hop vs multi-hop).

Ver `src/middleware/rateLimit.js` (líneas 19-25) y `src/config.js` para
la implementación. Hallazgo documentado como P1-6.

---

## 9. Pentesting post-implementación

Antes del go-live, se recomienda contratar un **pentesting
externo** que cubra:

### 9.1. Alcance

- Caja negra contra `https://firma.k-air.com`.
- Caja gris contra los endpoints internos (con API key
  proporcionada por el equipo).
- Caja blanca con acceso al código.

### 9.2. Áreas a probar

- [ ] Inyección SQL en todos los endpoints.
- [ ] Cross-Site Scripting (XSS) en la mini-app.
- [ ] CSRF en endpoints internos.
- [ ] Manipulación de tokens y OTPs.
- [ ] Bypass del rate limit.
- [ ] Bypass de autenticación.
- [ ] **Bypass de autorización per-empresa** (I-010): un cliente con
      key de empresa A intenta acceder a recursos de empresa B.
- [ ] **Escapa de scope via query `?id_empresa=B`** en GET /sign-requests
      (debe ser IGNORADO en client mode).
- [ ] Manipulación de estados.
- [ ] Race conditions en el commit.
- [ ] Filtración de información en mensajes de error.
- [ ] Seguridad de la mini-app (CSP, HTTPS, etc.).
- [ ] Seguridad del endpoint de descarga de PDFs.
- [ ] Validación de JSON canónico.
- [ ] Path traversal.
- [ ] **Hash de API key timing-safe**: comparar `constantTimeEqual`,
      no `===`.

### 9.3. Criterio de aceptación

- 0 vulnerabilidades altas o críticas sin resolver.
- Todas las vulnerabilidades medias con plan de remediación
  documentado.

---

## 10. Bug bounty (futuro)

En **v1.1 o v2.0** se puede considerar un programa de bug bounty:

- Plataforma: HackerOne, Open Bug Bounty, etc.
- Alcance: solo el Servicio y la mini-app.
- Recompensas: basadas en criticidad.
- Disclosure coordinado: 90 días antes de publicación.

**No está en v1.**

---

## 11. Anexo: matriz de riesgos

| ID | Amenaza | Probabilidad | Impacto | Riesgo | Mitigación principal | Riesgo residual |
|---|---|---|---|---|---|---|
| S.1 | Suplantación del trabajador | Media | Alto | 🟠 | Cédula + OTP + manifestación | 🟡 Bajo |
| S.2 | Suplantación de RH | Baja | Alto | 🟡 | API key + HTTPS | 🟡 Bajo |
| S.3 | Suplantación del Servicio (phishing) | Media | Alto | 🟠 | HSTS + dominio único | 🟡 Bajo |
| T.1 | Modificación del PDF firmado | Baja | Crítico | 🟡 | SHA-256 + verificación | 🟢 Muy bajo |
| T.2 | Modificación de eventos | Baja | Alto | 🟡 | Append-only + backups | 🟢 Muy bajo |
| T.3 | Modificación de la BD | Baja | Crítico | 🟡 | Permisos + backups | 🟢 Muy bajo |
| T.4 | Inyección SQL | Media | Crítico | 🟠 | SQL parametrizado + validación | 🟢 Muy bajo |
| R.1 | Repudio del trabajador | Media | Alto | 🟠 | Eventos + hashes + correo | 🟡 Bajo |
| R.2 | Repudio del empleador | Baja | Medio | 🟢 | rh_user_id + logs | 🟢 Muy bajo |
| I.1 | Filtración de tokens | Baja | Crítico | 🟡 | Solo hash en BD + redacción | 🟢 Muy bajo |
| I.2 | Filtración de OTPs | Baja | Crítico | 🟡 | Hash + sal + TTL | 🟢 Muy bajo |
| I.3 | Filtración de la BD | Baja | Alto | 🟡 | Backups encriptados | 🟡 Bajo |
| I.4 | Filtración de PDFs | Baja | Medio | 🟢 | Permisos + token | 🟡 Bajo |
| D.1 | DoS por rate limit | Media | Medio | 🟡 | Rate limit + espacio | 🟢 Muy bajo |
| D.2 | DoS por crecimiento de BD | Baja | Medio | 🟢 | Monitoreo + cuota | 🟢 Muy bajo |
| D.3 | Caída del SMTP | Media | Alto | 🟠 | Reintentos + cola | 🟡 Bajo |
| E.1 | Mini-app a internos | Alta | Bajo | 🟢 | API key + middleware | 🟢 Muy bajo |
| E.2 | Token cruzado | Baja | Bajo | 🟢 | Routers separados | 🟢 Muy bajo |
| E.3 | Manipulación de mini-app | Alta | Bajo | 🟢 | Backend re-valida | 🟢 Muy bajo |

### Resumen ejecutivo

- **5 amenazas** con riesgo 🟠 que requieren mitigación continua.
- **9 amenazas** con riesgo 🟡 que son aceptables para v1.
- **5 amenazas** con riesgo 🟢 que son residuales y aceptables.
- **0 amenazas** sin mitigar.

### Plan de mitigación continua

| Trimestre | Acción |
|---|---|
| Q1 v1 | Pentesting externo, corregir hallazgos. |
| Q2 v1 | Implementar TSA (sellos de tiempo cualificados). |
| Q3 v1 | Cert pinning en mini-app. |
| Q4 v1 | Revisión de la matriz de riesgos. |
| Q1 v1.1 | Bug bounty público (si se decide). |

---

**Fin del documento.**

Próximo: `LEGAL.md` (marco normativo expandido y consideraciones
jurídicas).

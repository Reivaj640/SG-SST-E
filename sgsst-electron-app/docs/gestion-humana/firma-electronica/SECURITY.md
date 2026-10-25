# Firma Electrónica K+AIR v1 — Análisis de Seguridad

**Versión del documento**: 0.1.1 (nota de estado; el análisis sigue en 0.1)
**Fecha**: 2026-08-17 · **Nota de estado**: 2026-10-25
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

> **Nota de estado (2026-10-25) — esto no es un gate de producción**
>
> Este documento es un **análisis de diseño**, no una certificación. El owner decidió el
> 2026-10-25 **aplazar** la migración de Node 20 a Node 24 y el cierre A/B/C del §7: no
> bloquea la primera firma con la v1.0. El riesgo aceptado y el plan están en
> [`plan-seguridad-2026-10-25.md`](./plan-seguridad-2026-10-25.md).
>
> Al 2026-10-25: el servidor corre **Node 20.20.2**, cuya EOL fue el **2026-04-30**;
> `npm audit --omit=dev` reporta **7 vulnerabilidades** (1 crítica, 4 altas, 2 moderadas);
> el §7 tiene **39 casillas y 0 marcadas**. Los conteos de §9.12 y §11.5 son históricos.
> Nada de esto se presenta como resuelto.

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
- [9. Rate limit interno por empresa (I-008, C-20 v5)](#9-rate-limit-interno-por-empresa-i-008-c-20-v5)
  - [9.1. Contexto y motivación](#91-contexto-y-motivación)
  - [9.2. Las 4 capas](#92-las-4-capas)
  - [9.3. Decisión de límites (720 / 240 / 480)](#93-decisión-de-límites-720--240--480)
  - [9.4. `X-Client-Instance-Id` — OPCIONAL](#94-x-client-instance-id--opcional)
  - [9.5. Capa 4: heurística, NO prueba de ataque](#95-capa-4-heurística-no-prueba-de-ataque)
  - [9.6. Legacy mode — IP fallback](#96-legacy-mode--ip-fallback)
  - [9.7. `req.id_empresa` autoritativo (nunca del body)](#97-reqid_empresa-autoritativo-nunca-del-body)
  - [9.8. Relación con I-010: composición, no duplicación](#98-relación-con-i-010-composición-no-duplicación)
  - [9.9. `globalLimiter` ya NO aplica a `/internal/*`](#99-globallimiter-ya-no-aplica-a-internal)
  - [9.10. Aplicación en routers](#910-aplicación-en-routers)
  - [9.11. Status code de rate limit](#911-status-code-de-rate-limit)
  - [9.12. Tests (388 + 27 nuevos = 415 passing)](#912-tests-388--27-nuevos--415-passing)
  - [9.13. Configuración por env vars](#913-configuración-por-env-vars)
  - [9.14. Riesgos aceptados](#914-riesgos-aceptados)
  - [9.15. Plan de migración a v2 (futuro)](#915-plan-de-migración-a-v2-futuro)
- [10. Idempotency-Key (I-003)](#10-idempotency-key-i-003)
  - [10.1. Contexto y motivación](#101-contexto-y-motivación)
  - [10.2. Header `Idempotency-Key` (G1–G4)](#102-header-idempotency-key-g1g4)
  - [10.3. Fingerprint del payload (G5–G6 refinado)](#103-fingerprint-del-payload-g5g6-refinado)
  - [10.4. Estados y máquina de transiciones (G8 refinado)](#104-estados-y-máquina-de-transiciones-g8-refinado)
  - [10.5. TTL de 24 horas (lazy cleanup)](#105-ttl-de-24-horas-lazy-cleanup)
  - [10.6. Timeout de PENDING de 5 minutos (G7)](#106-timeout-de-pending-de-5-minutos-g7)
  - [10.7. Manejo de concurrencia y race conditions](#107-manejo-de-concurrencia-y-race-conditions)
  - [10.8. REPLAY y redacción del token (C-22, G9, G10)](#108-replay-y-redacción-del-token-c-22-g9-g10)
  - [10.9. Separación por `id_empresa` (frontera I-003 + I-010)](#109-separación-por-id_empresa-frontera-i-003--i-010)
  - [10.10. Amenazas cubiertas por I-003.4 (batería adversarial)](#1010-amenazas-cubiertas-por-i-0034-batería-adversarial)
  - [10.11. Lo que NO protege la idempotencia](#1011-lo-que-no-protege-la-idempotencia)
  - [10.12. HALLAZGO M5.4 — Edge case documentado](#1012-hallazgo-m54--edge-case-documentado)
- [11. PDF Security (I-012)](#11-pdf-security-i-012)
- [12. Pentesting post-implementación](#12-pentesting-post-implementación)
- [13. Bug bounty (futuro)](#13-bug-bounty-futuro)
- [14. Anexo: matriz de riesgos](#14-anexo-matriz-de-riesgos)

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
  - ⚠️ **Actualización 2026-10-25:** no es un VPS: es un **Ubuntu 24.04.5 local**, detrás
    de NAT, con **Cloudflare Tunnel**, y corre **Node 20.20.2** (EOL **2026-04-30**). La
    migración a Node 24 está **aplazada como sugerencia no restrictiva**. Ver la nota de
    estado y el plan.
- HTTPS está correctamente configurado (certificado válido,
  TLS 1.2+).
- El DNS de `firma.k-air.com` apunta al VPS.
  - ⚠️ **Actualización 2026-10-25:** el dominio real es **`firma.kair.fyi`**.
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
| **Mitigación implementada** | (1) Tabla `gh_firma_eventos` append-only a nivel de código (no hay método `update()` ni `delete()`). (2) Constraint en BD: `id_evento_anterior` debe ser referenciable. (3) Backups diarios inmutables. (4) **Triggers de base de datos** (migración `020_eventos_append_only.sql`): `BEFORE UPDATE` y `BEFORE DELETE` sobre `gh_firma_eventos` abortan la operación con `RAISE(ABORT)`. La garantía vive en la base, no en el código de aplicación: un `DELETE` escrito a mano en un script de mantenimiento se rechaza. |
| **Mitigación recomendada** | (a) Hash chain: cada evento incluye hash del anterior. (b) Revisar que la excepción de la ventana de purga (T.5) siga siendo la única. |
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

#### T.5. La ventana de purga: la única vía por la que el registro de auditoría puede tocarse

| Aspecto | Detalle |
|---|---|
| **Descripción** | El numeral 3.6(g) promete que el registro de auditoría "no puede ser alterado ni eliminado una vez registrado". Los numerales 8.6 y 10.6 obligan a suprimir el dato una vez vencido su plazo y sin deber legal de conservación. Las dos promesas son incompatibles si la inalterabilidad es absoluta: o la base de datos miente, o el deber de supresión nunca se cumple. |
| **Activos** | A9 (registro de auditoría), A10 (datos personales) |
| **Vector de ataque** | Un `DELETE`/`UPDATE` sobre `gh_firma_eventos` ejecutado con acceso a la BD. |
| **Probabilidad** | Baja. Requiere acceso a la BD **y** que haya una ventana abierta. |
| **Impacto** | 🟠 Alto: borra el rastro de auditoría de las firmas del lote. |
| **Mitigación implementada** | La inalterabilidad es el **piso**, y la excepción está acotada por **cinco condiciones que la base de datos hace cumplir, no el código**: (1) hay una **ventana abierta** con actor, motivo y fecha de cierre; (2) la ventana **no está vencida** (se vence sola, tope de 4 horas); (3) la firma está en el **lote** habilitado para esa ventana, y el lote solo se puede ampliar con la ventana abierta; (4) la firma **venció su plazo** (`fecha_conservacion` en el pasado; sin plazo declarado no hay nada que suprimir); (5) la firma **no tiene deber legal de conservación** (`hold_legal = 0`). Cada condición aborta con su propio mensaje, así que el operador sabe cuál falló. El hold lo declara la Empresa con **actor, motivo, alcance y fecha**, y se libera con su propio actor y motivo; el historial queda en `gh_firma_holds`. La ventana, el lote y la purga quedan en `gh_firma_purga_log` y el **recibo por firma** en `gh_firma_purga_registro`, ambos **append-only** y sin datos personales: si la supresión borrara su propio rastro, no habría forma de demostrar qué se suprimió. |
| **Mitigación recomendada** | (a) Revisar la ventana y el lote antes de cada purga (el reporte `scripts/reporte-vencimientos.js` los lista). (b) Alcanzar el plazo con `plazo_retencion_dias` declarado por cada Empresa: sin plazo declarado no hay fecha de conservación y **nada** se purga — y la retención indefinida tampoco es cumplimiento, por eso el reporte lo marca como **alerta**. |
| **Alcance (lo que esta capa NO es)** | Esto es la **purga del registro de auditoría**, no la purga completa. La capa que suprime los datos personales de la fila (correo, huellas, manifestación de voluntad) y los archivos (PDF original, PDF firmado, constancia) es la **5B**, que ya existe: se implementó en la 8A.2, con el mismo gobierno de ventana, lote y hold. La operación completa, en orden, es *chequeo de hold → datos personales → eventos de auditoría → registro de purga*. **Esta capa sola ya no puede presentarse como cumplimiento del 8.6**: se destruiría la prueba y se conservarían los datos. Ver T.8. |
| **Cobertura** | El trigger **no se prueba en la base de tests compartida**: la migración 020 lleva `-- @skip-when-env test` porque otros archivos de test borran eventos entre casos y abortarían. **Sí se prueba en CI**, de otra manera: `tests/conservacion-purga.test.js` aplica el **archivo real de la migración** en una base de datos aislada y ejercita las cinco condiciones, incluida la del hold y la del plazo. En **staging** la migración se aplica de verdad y el trigger queda activo sobre la base real. |
| **Riesgo residual** | 🟢 Muy bajo. |

#### T.6. El orden (g)/(h) se salta: ver el documento sin aceptar el Acuerdo

| Aspecto | Detalle |
|---|---|
| **Descripción** | El 3.4(g) obliga a que el Trabajador lea y acepte el Acuerdo **antes** de ver el documento (3.4(h)): "El Trabajador no puede avanzar en el flujo sin leer y aceptar el Acuerdo". Si el documento se sirve con solo el OTP verificado, el Firmante ve el documento y la casilla del Acuerdo al mismo tiempo, y puede marcar las otras dos casillas y firmar sin haber aceptado nada: quedaría registrada una aceptación sin que hubiera información. |
| **Activos** | A9 (registro de auditoría), Legal |
| **Vector de ataque** | El propio Firmante (o quien tenga el token) avanza el flujo sin pasar por `consent/accept`: pide `document.pdf` y `view-document` con el token, solo con el OTP verificado. |
| **Probabilidad** | Media: es el comportamiento natural de la UI si el backend no lo impide. Antes de esta fase el visor cargaba el PDF de entrada y la casilla del Acuerdo estaba en la misma pantalla. |
| **Impacto** | 🟠 Alto: una firma con una aceptación de Acuerdo sin información previa; el hash del texto archivado no corresponde a nada que el Firmante haya leído. |
| **Mitigación implementada** | (1) El **backend** exige el Acuerdo ACEPTADO antes de servir el documento y antes de registrar su visualización (`publicFlow.exigirAcuerdoAceptado`), con las mismas condiciones de empresa y versión que ya exige el commit. La regla no depende de la UI. (2) Un **solo código público** (`CONSENT_NOT_ACCEPTED`) para todos los casos en que falta la aceptación: el camino de error no expone ni el id ni el estado del consentimiento. El detalle fino (`CONSENT_NOT_FOUND`, `CONSENT_WORKER_MISMATCH`, `CONSENT_COMPANY_MISMATCH`, `CONSENT_VERSION_MISMATCH`) lo sigue dando el commit, donde el dato inconsistente tiene que ser rastreable. (3) La mini-app **no carga el visor** hasta que la aceptación vuelve del servidor, y muestra un aviso explícito. (4) El contexto expone `acuerdo_aceptado` para que una recarga no vuelva a pedir lo ya aceptado. |
| **Mitigación recomendada** | (a) Medir en producción cuántas firmas llegan al commit sin aceptación previa: debería ser 0, y el evento `CONSENT_ACCEPTED` deja rastro de cada aceptación. (b) En la **5B**, conservar el texto exacto del Acuerdo que se mostró junto con su hash. |
| **Riesgo residual** | 🟢 Muy bajo. |

#### T.7. El enlace de firma sirve el documento firmado (5.4) y lo sirve a cualquiera que lo tenga

| Aspecto | Detalle |
|---|---|
| **Descripción** | El 5.4 obliga a que el Firmante pueda descargar "copia de este Acuerdo y del documento firmado desde el propio enlace de firma". El enlace es un token de un solo uso (3.4(c)), pero para cumplir el 5.4 tiene que seguir sirviendo el documento firmado **después** de firmar. Quien se adelante al Firmante y obtenga ese token obtiene el PDF firmado. |
| **Activos** | A5 (documento firmado) |
| **Vector de ataque** | Obtener el token del enlace: correo interceptado, historial del navegador, enlace reenviado. |
| **Probabilidad** | Baja: el token es aleatorio, se cifra en reposo y es de un solo uso; el Firmante ya tenía acceso al documento original (paso (h)) y además recibe una copia por correo. |
| **Impacto** | 🟡 Medio: el PDF firmado de un documento que el Firmante ya podía ver. |
| **Mitigación implementada** | (1) La descarga es de **solo lectura**: el enlace firmado **no reabre el flujo** (identificar, pedir OTP, aceptar el Acuerdo y firmar siguen cerrados en estado firmado). (2) **El token solo no sirve el PDF firmado antes de la identidad**: en cualquier estado previo a la firma la respuesta es `409 SIGNED_DOCUMENT_NOT_AVAILABLE`. (3) El TTL del token **no se extiende**: si el enlace venció, la descarga es `410`. (4) Se sirve el PDF firmado, no el original ni datos personales de la fila. (5) La copia del Acuerdo lleva su `SHA-256` en la cabecera `X-Acuerdo-SHA256`, para que el Firmante pueda comprobar que es la que aceptó. |
| **Mitigación recomendada** | (a) Revisar, antes de la v1.1 del Acuerdo, si el 5.4 puede cumplirse con un enlace distinto (por ejemplo, uno de un solo uso que nazca al firmar) en vez de extender la vida del enlace de firma. (b) Definir en la **5B** el comportamiento post-firma del enlace y del oráculo. |
| **Riesgo residual** | 🟡 Bajo. |

#### T.8. La 5B suprime de más: la fila, los archivos y la credencial

| Aspecto | Detalle |
|---|---|
| **Descripción** | La 5B (8A.2) es la capa que cumple el 10.6: vencidos el plazo y sin deber legal de conservación, el dato **se suprime**. Es la única operación del servicio que **borra de verdad**, y no se puede deshacer: si borra la fila equivocada, no hay copia de la que volver. El riesgo no es que no suprima, sino que suprima lo que no debía. |
| **Activos** | A10 (datos personales), A2 (`token_hash`), A9 (registro de auditoría) |
| **Vector de ataque** | (a) Ejecutar la supresión con un lote mal armado o con el hold mal declarado. (b) Que la **lápida** que sobrevive a la supresión se convierta en una credencial utilizable. (c) Que la propia supresión borre el rastro de lo que suprimió. |
| **Probabilidad** | (a) Media: es una operación manual, gobernada por ventana, lote y actor. (b) Baja, pero es la consecuencia de todo el diseño. (c) Baja. |
| **Impacto** | (a) 🔴 Crítico: pérdida irreversible de evidencia de una firma válida. (b) 🟠 Alto: alguien con la base podría resolver enlaces ya vencidos. (c) 🟠 Alto: sin rastro no hay forma de demostrar qué se suprimió. |
| **Mitigación implementada** | (1) **El mismo gobierno que la capa de auditoría**: ventana abierta (que se vence sola), lote armado, actor y motivo obligatorios, y revalidación del hold y del plazo **en el momento de suprimir**, no solo al armar el lote. (2) **El hold legal frena siempre**: con deber legal o contractual de conservación el dato no se toca, y la verificación sigue confirmando la integridad. (3) **La credencial no sobrevive**: la lápida guarda `HMAC('tombstone-purga', token_hash)` — un hash de un hash, con propósito y llave derivados — y **no** el `token_hash`. No permite autenticarse ni resolver nada: solo permite responder *"no disponible por vencimiento del plazo"* en vez de un 404 que no dice por qué. (4) **El rastro no se borra**: la lápida (`gh_firma_purgadas`) y el recibo (`gh_firma_purga_registro`) son **append-only**, con triggers de base de datos que abortan el UPDATE y el DELETE (migración 025). (5) **La lápida no lleva datos personales**: ni correo, ni número de documento, ni nombre. (6) **Los archivos primero, la base después**: el archivo es el dato; si la base falla después, el reintento es seguro. (7) **El dry-run es el modo por defecto** y la simulación no borra nada. (8) **Idempotencia**: correrla dos veces no rompe nada ni escribe una segunda lápida. (9) La **prueba de la aceptación sobrevive** a la supresión (vive en `gh_consentimientos_firma`, sin llave foránea contra la firma), con la versión, la huella del texto, la fecha y hora y el identificador de la solicitud: es lo que el 12.7 deja en cabeza de la Empresa. |
| **Mitigación recomendada** | (a) **No ejecutar la supresión en producción hasta que la Compuerta 0 esté en verde**: copia verificada y restauración probada, y el servicio sin firmas reales de clientes o con re-autorización si ya las tiene. (b) Declarar en el **Anexo de Encargo** el plazo de eliminación en sistemas y respaldos, que esta capa no alcanza (aquí solo se borra lo que está en la base y en el disco del servicio). (c) Auditar el `gh_firma_purga_registro` periódicamente: es el asiento de cada supresión. |
| **Cobertura** | 16 tests (`tests/fase8a2-supresion-datos.test.js`): la simulación no borra nada, la supresión real borra la fila y los archivos, la idempotencia, el gobierno (actor, motivo, ventana, lote), el hold, la lápida sin credencial, la lápida sin datos personales, el enlace suprimido responde `410 CONSERVACION_VENCIDA` y no `404`, y la prueba de la aceptación con su identificador de solicitud. El trigger de la 025 **tampoco se prueba en la base de tests compartida** (lleva `-- @skip-when-env test`, como la 020): se prueba aplicando el **archivo real de la migración** en una base aislada, con un test de mutación que demuestra que sin el trigger la lápida sí se podría alterar y borrar. |
| **Riesgo residual** | 🟡 Bajo, condicionado a que la Compuerta 0 se respete. El riesgo residual es **operativo**, no técnico: que alguien ejecute la supresión sin copia verificada. |

#### T.9. El token de acceso existe en la base en una forma recuperable

| Aspecto | Detalle |
|---|---|
| **Descripción** | El 3.6(e) del Acuerdo de uso promete que el token de acceso "se conserva únicamente en forma de huella digital". El código no lo cumplía: además de la huella (HMAC con clave secreta), guardaba el token **cifrado con AES-256-GCM** en `metadata._server_metadata.token_encrypted`, y un endpoint interno lo devolvía **en texto claro**. Cifrado sigue siendo reversible con la llave: el token existía en la base en una forma que se podía recuperar, y quien tuviera la base y la llave podía volver a obtener un enlace válido. |
| **Activos** | A2 (`token_hash`), A11 (el enlace de firma), A4 (la llave de cifrado) |
| **Vector de ataque** | (a) Que alguien con acceso a la base **y** a la llave de cifrado descifre el token y lo use. (b) Que el endpoint de recuperación entregue el token a quien solo tenga la API key. (c) Que el token se reutilice indefinidamente, porque el enlace "recuperado" es el mismo de siempre y nadie sabe que hay otros. |
| **Probabilidad** | (a) Baja: exige acceso simultáneo a la base y a la llave (que están en lugares distintos). (b) Media: la API key interna es de la Empresa, y quien la tiene ya puede rotar. (c) Media: era el comportamiento normal. |
| **Impacto** | 🟠 Alto: un token filtrado da acceso al flujo de firma de un tercero. |
| **Mitigación implementada** | (1) **El token no se guarda de forma recuperable**: `create()` ya no escribe `_server_metadata.token_encrypted`, y el sub-objeto se elimina del metadata del cliente. (2) **La rotación**: `POST /internal/sign-requests/{id}/link/rotate` emite un token nuevo y lo devuelve **una sola vez**; en la base solo queda su HMAC-SHA-256 con clave secreta. (3) **La reemisión invalida siempre el token anterior** (3.4(c)): no hay más de un token vigente por solicitud, y la invariante se verifica después de emitir. (4) **Cómo se verifica**: después de emitir el token nuevo se cuentan los tokens vigentes; si quedara alguno, la reemisión falla con `500 TOKEN_INVARIANTE_ROTA` dentro de la transacción y no deja nada escrito. (5) **Cada emisión queda auditada** (evento `LINK_ROTATED`, con emisión, motivo y actor). (6) **Un token revocado no resuelve**: el enlace anterior deja de servir de verdad. El campo `revocar_anteriores` del cuerpo quedó **obsoleto**: se sigue aceptando para no romper a los clientes que lo manden, pero ya no decide —un `false` explícito no evita la revocación y queda registrado en la auditoría. (7) **La 5B cubre todos los tokens**: tras la supresión, un enlace rotado también responde "no disponible por vencimiento del plazo" y no un 404 que depone lo que pasó. (8) El `GET /link` queda **deprecado** (`Deprecation`, `Sunset`, `Link` al successor) y solo sirve para las solicitudes anteriores a la 8C. |
| **Mitigación recomendada** | (a) **Purgar el `token_encrypted` de las filas anteriores a la 8C** cuando todos los clientes hayan migrado a la rotación: es una migración de datos pendiente, deliberadamente NO aplicada en esta fase porque depende de la respuesta a la Compuerta 0 (¿ya hay solicitudes en vuelo?). (b) **No reusar `TOKEN_ENCRYPTION_KEY`**: la llave del cifrado viejo y la del HMAC son cosas distintas, y la primera ya no debería tener usos. (c) Vigilar el evento `LINK_ROTATED`: un volumen alto de rotaciones es una señal de que alguien está perdiendo enlaces (o de que hay un uso indebido). |
| **Cobertura** | 13 tests (`tests/fase8c-rotacion-token.test.js`, todos con el prefijo `8C ·`): el token NO queda guardado de forma recuperable en la base, MUTACION: el detector de token recuperable muerde, el token queda registrado como huella en la tabla de tokens, la rotación emite un token nuevo y lo devuelve una vez, el token anterior DEJA de funcionar: la reemisión lo invalida, la emisión queda auditada, no hay más de un token vigente por solicitud (el 3.4(c)), la reemisión deja sin efecto el token anterior y emite uno nuevo, revocar_anteriores: false NO evita la revocación (el 3.4(c)), GET /link ya no recupera el token: dice que hay que rotar, tras la supresión, el enlace ROTADO también dice "vencido", el notify-remote rechaza un token de otra solicitud y el notify-remote con el token propio NO emite otro token. |
| **Riesgo residual** | 🟡 Bajo. Queda el **token cifrado de las filas anteriores a la 8C**, que es una migración de datos pendiente y no un defecto del código nuevo. |

#### T.10. El número del representante legal queda en texto claro en la base

| Aspecto | Detalle |
|---|---|
| **Descripción** | El 10.5(a) ordena que el número del documento de identidad "se conserva únicamente [como] esa huella, no el número en texto claro". Para el **trabajador** eso ya se cumplía: el número se convertía en seudónimo y no se archivaba. Para el **representante legal** no: su número de documento se guardaba **en texto claro** dentro de `representante_legal_snapshot`, y además se imprimía **completo** en la constancia consolidada. |
| **Activos** | A5 (la cédula del representante), A12 (la BD del Servicio), A8 (la constancia consolidada) |
| **Vector de ataque** | (a) Que alguien con acceso al archivo de la base (o a una copia de respaldo) lea el número de identificación del representante legal de una empresa. (b) Que una copia de la constancia consolidada, que circula fuera del servicio, lleve el número completo. |
| **Probabilidad** | Media: el archivo de la base es un activo que se respalda, se copia y se transfiere; un número en claro viaja con cada copia. |
| **Impacto** | 🟠 Alto: es un dato personal de un tercero (el representante), y además identifica a la persona que subscribe en nombre de la Empresa. |
| **Mitigación implementada** | (1) **El número se cifra, no se hashea** (decisión del owner al §8.1 del plan): AES-256-GCM con la clave derivada por HKDF del anillo de llaves, con el propósito `cifrado-representante` y el **ámbito de la Empresa**. Hashearlo habría sido incorrecto: el número del representante es **prueba de la representación** y una huella no se puede presentar como prueba. (2) **La llave vive fuera de la base**: quien tenga el archivo de la base, sin la llave, no abre nada. (3) **El sobre declara la versión de llave** (`enc:v2:<version>:<iv>:<tag>:<cifrado>`): rotar el anillo no vuelve ilegibles los números ya cifrados. El formato v2 liga el sobre a la Empresa y al campo con AAD (`["kair-firma-cifrado","v2",propósito,ámbito,campo]`); un sobre movido a otra Empresa o a otro campo no se abre. (4) **GCM es AEAD**: un sobre alterado en la base no se descifra y no puede presentarse como el original. (5) **Lo que se muestra son los últimos 4** (`****3456`), como con el firmante: la constancia consolidada ya no lleva el número completo. (6) **Las filas anteriores no se rompen**: se reconocen y se enmascaran igual; el formato `v1` se sigue leyendo sin AAD. (7) El re-cifrado de esas filas es un **script aparte, en simulación por defecto** (`scripts/recifrar-representante.js`), con `--actor` y `--motivo` obligatorios, verificación cifra -> descifra -> compara antes de escribir, y un evento `REPRESENTANTE_RECIFRADO` por fila. (8) **La copia de empresa que sobrevive a la supresión** (`gh_consentimientos_firma.empresa_snapshot`) también se cifra desde 8B-C: mismo AES-256-GCM y misma llave, con propósito `cifrado-empresa-snapshot` y campo `empresa_snapshot.representante_legal_identificacion`. La huella `empresa_hash` se sigue calculando sobre el JSON canónico **en claro**, no sobre el sobre, e incluye solo los campos presentes: un snapshot histórico de 11 campos conserva la huella que se calculó antes de la migración 021. (9) Esa copia histórica se re-cifra con `scripts/recifrar-empresa-snapshot.js`: simulación por defecto, `--actor`/`--motivo` obligatorios, `--backup` obligatorio antes de escribir, verificación de la huella sha256 del texto exacto y de la huella canónica fila por fila, `UPDATE` condicionado al valor original y recibo JSON sin el número completo. Un sobre que no se abre con la Empresa y el campo de esa fila no se salta como "ya cifrado": se reporta. No usa `gh_firma_eventos` porque esa tabla exige `firma_id` y el consentimiento no tiene una firma a la cual colgar el evento. |
| **Mitigación recomendada** | (a) **Ejecutar el re-cifrado cuando la Compuerta 0 esté en verde**: es una migración de datos y, si hay solicitudes en vuelo, tocarlas es un riesgo que no se toma sin copia verificada. (b) **Reponer la llave vieja en `FIRMA_HMAC_KEYRING`** mientras haya números cifrados con ella: si sale del anillo, esos números quedan ilegibles (el error lo dice explícitamente). (c) Vigilar el evento `REPRESENTANTE_RECIFRADO`: un volumen alto es la señal de que hay filas heredadas que siguen en claro. (d) Para `empresa_snapshot`, correr primero `scripts/recifrar-empresa-snapshot.js` en simulación y revisar el recibo; después, con `--backup` y `--ejecutar`, y solo con la Compuerta 0 en verde. El script no toca filas con `empresa_hash` NULL o inconsistente, ni sobres que no se abren con la Empresa y el campo de la fila: esas se investigan, no se "arreglan" cifrándolas. |
| **Alcance (lo que esta capa NO es)** | El bloque «Empresa que solicita tu firma» del **1.2** muestra la identificación del representante legal **completa**, y eso **no cambia**: esos datos vienen del **registro mercantil** que la Empresa cargó en `gh_firma_empresas`, no del snapshot de la firma. Lo que se cifra es el snapshot, que es lo que el cliente declaró al pedir la firma. Cambiar el 1.2 es un asunto del abogado, no del código. |
| **Cobertura** | 22 tests (`tests/fase8b-representante-cifrado.test.js`): la ida y vuelta del sobre, el formato y la versión, dos cifrados del mismo número distintos, un sobre alterado que no se abre, un sobre de otra Empresa que no se abre, la versión de llave que salió del anillo con un error explicito, el servicio que cifra sin mutar el original, el enmascarado, la fila del padre y la del hijo sin el número en claro, la huella y el seudónimo del representante que siguen siendo los del número real, la constancia con los últimos 4 y sin el número completo, la fila heredada que se enmascara igual, el contexto público que no lo expone, y dos tests de mutación que comprueban que los detectores muerden. **Más 3 del D-18** (en el mismo archivo): `estadoEnmascarado` distingue "sin dato" de "falló el descifrado", un sobre que no se abre es un **error** y no una ausencia, y `numeroEnmascarado` deja de ser un `null` silencioso (log de nivel `error` con código `REPRESENTANTE_NO_DESCIFRABLE`). Más 19 de 8B-C (`tests/fase8bc-empresa-snapshot-cifrado.test.js`): AAD por Empresa/campo, ámbito vacío rechazado, sobre alterado que no se muestra, snapshot de empresa sin el número en claro, huella sobre claro (incluida la de un snapshot histórico de 11 campos), verificación de la huella en la presentación con fallo cerrado, PDF simple y consolidado sin `CC —`, y el consentimiento persistido. Más 6 del backfill de representante y 9 del de empresa (`tests/scripts/recifrar-representante.test.js`, `tests/scripts/recifrar-empresa-snapshot.test.js`): simulación, ejecución, idempotencia, huella inconsistente, snapshot ilegible, fila histórica de 11 campos, sobre de otra Empresa, rechazo sin backup y el evento `CONSENT_SNAPSHOT_RECIFRADO` por fila re-cifrada (con actor y motivo, y sin el número del representante). |
| **Riesgo residual** | 🟡 Bajo. Quedan las **filas anteriores a la 8B/8B-C**, que guardan el número en claro: es una migración de datos pendiente, no un defecto del código nuevo. El re-cifrado de `empresa_snapshot` no se ejecutó en producción; requiere Compuerta 0, copia restaurada, hold legal y recibo. **La `empresa_hash` es un SHA-256 SIN sal del JSON canónico en claro**: no es un oráculo de la llave, y la constancia ya no afirma lo contrario (ver la nota del 2026-10-20 en la API, §6.16.4). |
| **Lo nuevo del 2026-10-20 (1.1, 1.2 y 1.3 del dictamen legal)** | (a) **`conservacion_por_deber_legal`**: un flag POR EMPRESA (no por documento) para el deber legal de conservación sin término del 2.2.1.1.12. Con el flag en 1, la firma no recibe fecha de supresión y se levanta un **hold legal automático** (actor `sistema`), gobernado por `gh_firma_holds`; el Trabajador ve en la mini-app y en el correo que su documento no se borra. "Nunca se purga SOLO", no "nunca se purga". (b) **La firma visual (PNG) no se admite**: el commit la rechaza con `FIRMA_VISUAL_NO_ADMITIDA` en vez de ignorarla en silencio (antes el cliente creía que su rúbrica había quedado firmada). (c) **El canal de datos de K+AIR (10.7(b))**: un SEGUNDO canal, distinto del de incidentes, con su registro (`gh_solicitudes_titular`), su historial append-only que **no cuelga de la firma** (la 5B no lo alcanza) y el flujo RECIBIDA → TRASMITIDA → RESPONDIDA. K+AIR no resuelve: la respuesta es de la Empresa. |

#### T.11. El documento con datos sensibles se sirve sin el aviso previo ni el consentimiento expreso

> Es el gemelo del **T.6** (el orden (g)/(h) del Acuerdo) para el **10.8**. El
> T.6 impedía ver el documento sin aceptar el Acuerdo; el T.11 impide verlo sin
> haber sido informado de que trata datos de salud y haberlos autorizado de
> forma expresa.

| Aspecto | Detalle |
|---|---|
| **Descripción** | El 10.8 obliga a que, cuando el documento trate datos sensibles de salud, el Titular sea informado **de forma expresa y anticipada** de las categorías, la finalidad y la base legal, y consienta ese tratamiento **de forma expresa**. El código no tenía ninguna de las dos cosas: la API no podía marcar un documento como sensible, la mini-app no mostraba aviso previo, y la casilla era la misma del Acuerdo. Un acta de salud se firmaba con el mismo consentimiento genérico que un formato de asistencia. |
| **Activos** | A6 (los PDF originales), A12 (la BD del Servicio) |
| **Vector de ataque** | (a) Que una solicitud con un documento de salud llegue al visor sin que nadie haya informado al Titular de qué se trata. (b) Que la Empresa marque `datos_sensibles: false` para hacer de menos dato sensible un documento que sí lo es, y que el Titular firme sin saberlo. |
| **Probabilidad** | (a) Alta: era el comportamiento normal, no un caso exceptional. (b) Media: el cliente es la Empresa, y el campo era libre. |
| **Impacto** | 🟠 Alto: tratamiento de un dato sensible sin la base legal que lo autoriza, y con el Titular firmando sin la información que el 10.8 exige. |
| **Mitigación implementada** | (1) **El backend exige el consentimiento**: `exigirConsentimientoSensible()` bloquea `view-document` y `document.pdf` con `409 SENSIBLE_CONSENT_NOT_ACCEPTED`. La regla no depende de la UI. (2) **La casilla es separada** de la del Acuerdo, y el **aviso va antes del visor**: si el documento se viera primero, la información "previa" no lo sería. (3) **El aviso queda fijado al crear** (texto, hash y versión): si se compusiera en cada visita, un cambio de redacción cambiaría lo que el Titular "aceptó" sin que nadie lo notara. (4) **La Empresa sube la clasificación, nunca la baja**: el servicio vuelve a inferir por tipo de documento (ACTA, CERTIFICADO, CONSENTIMIENTO, AUTORIZACION) y la Cliente no puede desactivar el aviso. (5) **El sistema no lee el PDF** para saber si trae datos de salud: escanearlo sería tratar el dato sensible **antes** del consentimiento. (6) El **rechazo se registra** y ofrece la vía alternativa del **8.5** (firmar en papel): el sistema no decide por el Titular. (7) El registro del consentimiento sensible vive en `gh_consentimientos_sensibles`, **sin FK** contra la firma, para que sobreviva a la 5B (como la aceptación del 12.7). |
| **Mitigación recomendada** | (a) Revisar con la Empresa si los tipos inferidos se corresponden con lo que realmente envía: si manda ACTAS de todo tipo, el aviso se vuelve routine y deja de informar. (b) Medir en producción cuántas firmas sensibles hay y cuántas rechazan el consentimiento: el segundo número es un dato de droits del Titular que conviene conocer. |
| **Cobertura** | 14 tests (`tests/fase8b-dato-sensible.test.js`): la inferencia por tipo, que la Empresa no pueda bajar la clasificación, el aviso fijado al crear (texto, hash y versión), el bloqueo del visor y del PDF, el registro del consentimiento y del rechazo, la vía alternativa, y tests de mutación que comprueban que los detectores muerden. |
| **Riesgo residual** | 🟡 Bajo. Lo que queda es la **fidelidad de la inferencia** por tipo de documento, que depende de cómo la Empresa clasifique sus envíos. |

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

#### I.5. Confirmación de existencia de un consentimiento ajeno

> **Riesgo residual ACEPTADO para el lanzamiento.** No es bloqueante legal. Su
> remedio estructural queda propuesto como paquete aparte.

| Aspecto | Detalle |
|---|---|
| **Descripción** | Un `consent_id` ajeno puede confirmarse como existente y de otra empresa a través del error de commit. No revela trabajador ni contenido. |
| **Activos** | A2 (expediente del trabajador), A3 (registro de auditoría) |
| **Vector de ataque** | La empresa que tiene una API key per-empresa crea una solicitud de firma con `consent_id` de otra empresa y lee el código del error. |
| **Probabilidad** | Baja. Requiere una API key per-empresa válida y un `consent_id` adivinado (son enteros correlativos). |
| **Impacto** | 🟢 Bajo. El error dice SOLO que el consentimiento no es de esta empresa. No dice de qué empresa es, ni de qué trabajador, ni qué contiene. |
| **Mitigación implementada** | (1) Autenticación per-empresa (I-010) y rate limit por empresa (4 capas). (2) **Orden de validación corregido**: la empresa se compara ANTES que el trabajador, así que la respuesta ya no depende del trabajador. (3) **El aviso público no lleva identificadores de la contraparte**: ni el seudónimo del trabajador, ni los NIT. Solo el código y el `consent_id` que el llamador ya mandó. (4) Registro de auditoría de cada consulta. (5) El log del servidor sí conserva los identificadores: es un dato de auditoría, y por eso tiene acceso restringido y retención propia (§7.4). |
| **Riesgo residual** | 🟢 Muy bajo. Lo que queda es distinguir "este id existe en alguna empresa" de "este id no existe". |
| **Remedio estructural (propuesto, no aplicado)** | (a) Validar el consentimiento **en la creación** del sign request, no solo en el commit: corta el oráculo en la raíz. (b) **404 silencioso** cross-company, para que un consentimiento de otra empresa se comporte como inexistente. Ambas cosas cambian el contrato de errores de la API, así que van en un paquete propio, con su diseño, su documentación en `API.md` y la actualización del manejo de errores de K+AIR. |
| **Por qué no se aplicó todavía** | El bloque E6, que es el que prueba la validación en el commit, acaba de quedar verde y es la base de la cadena de evidencia. Reescribirlo justo antes de las fases que tocan la constancia, el trigger de append-only y la ruta de entrega sería mover el piso de ese bloque. |

#### I.6. `metadata` como canal libre para meter datos que el Acuerdo no autoriza

| Aspecto | Detalle |
|---|---|
| **Descripción** | El 10.2 cierra con que el Acuerdo "no autoriza a la Empresa a enviar al servicio datos distintos de los aquí relacionados". El código no lo exigía: `metadata` era un objeto libre de hasta 8192 caracteres, archivado **verbatim** en la fila de la firma. Con una lista blanca de 5 claves, la frase del 10.2 se vuelve exigible; sin ella, era una promesa sin mecanismo. |
| **Activos** | A12 (la BD del Servicio), A13 (los logs, que también filtran el metadata) |
| **Vector de ataque** | (a) Que la Empresa (o un atacante con su API key) archive en `metadata` datos personales que el Acuerdo no relaciona (historial médico, información de terceros, contenido del documento). (b) Que la app mande un campo **mal escrito** y que el dato se pierda en silencio, sin que nadie lo note: es lo que pasaba con `correo_empresa`, que la app mandaba desde hace meses y nunca llegó a la base. |
| **Probabilidad** | (a) Media: la API key per-empresa es de la Empresa y se entrega sin más control. (b) Alta: ya estaba pasando, de forma silenciosa. |
| **Impacto** | 🟠 Alto: dato personal archiving sin base legal, con un plazo de conservación que no se conoce (porque no está en la lista blanca, no hay de dónde sacarlo). |
| **Mitigación implementada** | (1) **Lista blanca de `metadata`** (`src/services/metadata.js`): solo `subtipo_identificacion`, `nombre_trabajador`, `nombre_empresa`, `correo_empresa` y `correo`. (2) **El esquema es `.strict()`**: una clave desconocida produce un `400` que **la nombra**, en vez de eliminarla en silencio. (3) **El servicio vuelve a filtrar** antes de escribir la fila: es el último punto, y el que no se puede saltar por la vía del service. (4) La lista blanca está en **código**, no en configuración: no se puede ampliar sin un cambio versionado. |
| **Mitigación recomendada** | (a) Revisar con la Empresa **qué claves necesita de verdad** y sacarlas de la lista si no aportan (principio de minimización: lo que no se usa, no se archiva). (b) Vigilar el `400` de clave desconocida: un volumen alto es la señal de que un cliente está mandando algo que el servicio ya no acepta. |
| **Cobertura** | 9 tests (`tests/fase8b-metadata-lista-blanca.test.js`), con tests de mutación que comprueban que los detectores muerden (una clave de más se rechaza nombrándola; el filtro del servicio no deja pasar lo que la ruta no dejó). |
| **Riesgo residual** | 🟢 Muy bajo. Lo que queda es la **calidad** de la lista, no su existencia. |

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

### 4.8. La vía en papel y los medios autorizados (la 9A, el D-2)

Las piezas nuevas abren tres superficies que no existían. Las tres
están pensadas para que un atacante con el enlace (que es la credencial
del flujo público) no pueda:

**(a) desviar la copia del documento a un buzón ajeno.**

- **Vector**: con solo el enlace, escribir un correo propio en el registro de
  medios autorizados (el 8.2) y esperar que la Empresa entregue la copia allí.
- **Quién declara el medio**: la **Empresa** (decisión del owner, 2026-10-20), en
  K+AIR al crear la solicitud. Es la Empresa la que tiene la ficha del trabajador. Si
  no lo tiene, el Trabajador lo declara en la mini-app (respaldo).
- **Mitigación**: un medio nuevo nace **PENDIENTE** y solo se activa cuando
  el Trabajador demuestra que lo controla (el código de verificación llega a
  ese medio y lo verifica). La entrega de la copia solo se hace por medios
  **ACTIVOS**. El registro de eventos deja la alta y la baja.
- **Riesgo residual**: quien ya pasó la identificación (conoce el número de
  documento) puede pedir la declaración de un medio, pero no puede
  activarlo sin el código. La firma electrónica en sí no depende de
  este registro: depende del OTP.

**(b) registrar una firma en papel que nadie pidió.**

- **Vector**: subir un PDF a una solicitud viva haciéndola pasar por una
  firma autográfica.
- **Mitigación**: `POST /internal/sign-requests/{id}/firma-papel` exige la
  fila en `gh_firma_firmas_papel` (estado `SOLICITADO`): sin la petición del
  Trabajador responde `409 PAPER_NOT_REQUESTED`. El PDF lo valida el
  middleware (mismo camino que la creación) y su huella la calcula el
  servidor, no el cliente.

**(c) el 400 del D-02 que apunta a una puerta que no existe.**

- **Vector**: el rechazo (`MEDIO_OTP_CORPORATIVO`) le dice al Trabajador «pedile a tu
  Empresa la firma en papel»; si la Empresa no tiene canal de atención, esa puerta
  no existe. El 400 seria un callejón sin salida, el mismo defecto que la 10.4 vino a
  matar en el lado del Acuerdo.
- **Mitigación**: el `canal_pqrs` es un **requisito de habilitación** de la Empresa
  (junto al Anexo firmado y al plazo de conservación), con el override del D-03. Y el
  400 lleva el canal en el `details.canal_empresa`.

**(d) leer los medios de otro Trabajador.**

- **Vector**: pedir los medios de una solicitud de otra empresa.
- **Mitigación**: el mismo silencio cross-empresa del resto de los
  endpoints internos (404, no 403: no se confirma la existencia). Los
  documentos del papel y los registros de firma en papel viven en el
  directorio de la Empresa, como el resto.

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

> **Estado al 2026-10-25:** ninguna de estas casillas está marcada. Son una **plantilla de
> verificación**, no una afirmación de cumplimiento. El plan diferido está en
> [`plan-seguridad-2026-10-25.md`](./plan-seguridad-2026-10-25.md).

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
- [ ] **Acceso al log restringido** al usuario del servicio y a root: desde la
      corrección del orden de validaciones, el log del servidor registra los
      identificadores de la contraparte (seudónimo del trabajador y NIT de la
      empresa) en los rechazos de consentimiento, porque son datos de
      auditoría. **El log no es una base de datos paralela**: su retención es
      la de los logs (90 días), no la del expediente, y no se usa para
      reconstruir evidencia que la base ya tiene.
- [ ] Los logs de consulta del oráculo de verificación se revisan para
      anomalías (el mismo documento consultado contra muchas firmas)

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

## 9. Rate limit interno por empresa (I-008, C-20 v5)

> **Estado**: implementado en `firma-service` v0.3.0 (I-008).
> **Diseño completo**: ver este documento y `src/middleware/rateLimit.js`,
> `src/middleware/authz.js`.

### 9.1. Contexto y motivación

Antes de I-008, los endpoints `/internal/*` se protegían con el rate limit
**global** (`globalLimiter`, 60 req/min por IP) y, para creación de sign
requests, con `signRequestLimiter` (30 req/min por IP). Esto tiene dos
problemas:

1. **Por IP, no por empresa**: una empresa con varias sucursales detrás
   de la misma IP (NAT corporativo, VPN, etc.) comparte el bucket con
   cualquier otra empresa en la misma IP. Inversamente, una empresa
   con granjas de dispositivos puede bypasear el límite rotando IPs.

2. **Sin defensa contra anomalías**: no hay detección de uso anómalo
   (e.g. una key que se usa desde muchos `X-Client-Instance-Id`
   distintos en poco tiempo, lo cual sugiere compromiso o scraping).

I-008 reemplaza este modelo por **4 capas de rate limit por empresa** que
resuelven ambos problemas, manteniendo compatibilidad con el rate limit
público (60 req/min/IP) y con `signRequestLimiter` (30 req/min/IP,
defensa adicional).

### 9.2. Las 4 capas

| # | Capa | Límite | Key | Skip | Justificación |
|---|------|--------|-----|------|---------------|
| 1 | **Por `id_empresa`** | 720/h | `empresa:<id_empresa>` (o `legacy-ip:<ip>` en legacy mode) | No | Autoritativa. Aísla empresas entre sí. |
| 2 | **Por `id_empresa` + `X-Client-Instance-Id`** | 240/h | `empresa:<id>:<instance>` (o `legacy-ip:<ip>`) | Si falta `X-Client-Instance-Id` o en legacy mode | Permite rate limit por dispositivo. Opcional. |
| 3 | **Por IP** | 480/h | `req.ip` | No | Fallback. Aplicar siempre. |
| 4 | **Anomalía (>10 instance ids / 24h)** | 10 | `id_empresa` + set de `instance_id` | Si falta `X-Client-Instance-Id` o en legacy mode | Heurística de uso anómalo. En memoria v1. |

**Capas 1, 2 y 3** usan `express-rate-limit` v7 con `MemoryStore` interna.
**Capa 4** es una heurística custom en memoria (Map de Map).

### 9.3. Decisión de límites (720 / 240 / 480)

| Capa | Límite | Justificación |
|---|---|---|
| 1 | 720/h por empresa | Permite picos normales de RH (e.g. 12 requests/min sostenidos × 60 min = 720). Más alto que el rate limit público (60/min × 60min = 3600/h) para no limitar empresas activas legítimamente. |
| 2 | 240/h por instance | 1 dispositivo activo ≈ 4 requests/min sostenidos. Permite uso normal (crear + consultar + estado). |
| 3 | 480/h por IP | Balance entre defensa DoS y no limitar offices corporativos detrás de NAT. 480/h = 8 req/min promedio, con picos permitidos. |
| 4 | 10 instance / 24h | Una empresa típica usa 1-3 dispositivos. 10 es margen amplio para sucursales y PWA sincronizadas. Más allá, alta probabilidad de anomalía. |

### 9.4. `X-Client-Instance-Id` — OPCIONAL

Este header identifica el dispositivo/instancia que hace la request.
**Es opcional**: si el cliente no lo envía, las capas 2 y 4 se SKIP.
Las capas 1 y 3 siguen aplicando.

**Propósito del header**: K+AIR (o cualquier cliente) genera un UUID v4
en la primera ejecución y lo persiste localmente. Esto permite:
- Rate limiting por dispositivo (capa 2).
- Detección de anomalías (capa 4): si una empresa tiene >10 instance ids
  distintos en 24h, probablemente una key fue comprometida o hay scraping.

**NO contiene PII**: el header es un identificador opaco. No incluir
nombres, correos, IPs u otra información personal en su valor.

### 9.5. Capa 4: heurística, NO prueba de ataque

> **Importante**: el límite de 10 `X-Client-Instance-Id` distintos en 24h
> es una **heurística**, no una prueba de ataque. Una empresa grande con
> muchos dispositivos legítimos (sucursales, puntos de venta, apps móviles
> en muchos dispositivos) podría ser flagged.

En v1, el bloqueo es **aceptado** (es la opción más conservadora). En v2
podría ser solo **alerta** (notificar al admin pero no bloquear).

**Limitaciones conocidas**:
- Estado en memoria: se pierde en restart del servicio. Aceptable para v1.
- Cleanup lazy: las entradas > 24h se eliminan en el próximo request.
  No hay timer periódico.
- No distingue entre instance ids "maliciosos" y "legítimos".

### 9.6. Legacy mode — IP fallback

En **legacy mode** (`authSource='legacy'`, `req.id_empresa === null`):

- **Capa 1** cae a `legacy-ip:<req.ip>` (NO por empresa).
- **Capa 2** se SKIP (no hay id_empresa para componer la key).
- **Capa 3** aplica normalmente (IP).
- **Capa 4** se SKIP (no hay id_empresa para trackear).

Esto preserva el comportamiento pre-I-008 (rate limit por IP) durante
la ventana de deprecation legacy. Cuando se elimine el legacy mode, las
capas 1-4 operarán exclusivamente por `id_empresa`.

### 9.7. `req.id_empresa` autoritativo (nunca del body)

El rate limit **LEE** `req.id_empresa` (seteado por `_runAuthz` en
`requireEmpresaScope` o `requireEmpresaScopeAndLimit`). **NO**
re-resuelve la API key para determinar el id_empresa.

**Razón**: si authz y rate limit hicieran lookups independientes de la
API key, podrían divergir si el cache de `internalClient` cambia entre
el momento del authz y el del rate limit. Esto causaría que authz y rate
limit "vean" empresas distintas para la misma request.

**Defensa en profundidad**: si por alguna razón `req.id_empresa` no está
seteado en una ruta que NO es legacy, los `keyGenerator` de las capas 1
y 2 usan `legacy-ip:<ip>` como fallback (no crashean). El comportamiento
queda documentado y testeado en `tests/middleware/internalServerLimiter.test.js`.

### 9.8. Relación con I-010: composición, no duplicación

I-008 NO duplica la lógica de authz. La compone:

```
requireEmpresaScopeAndLimit({ allowedOperations, checkIdEmpresa, rateLimit })
  ├─ 1. _runAuthz (mismo helper que requireEmpresaScope)
  │     ├─ 401 INVALID_API_KEY si key falta/inválida/revocada
  │     ├─ 403 FORBIDDEN si operación no permitida
  │     └─ 403 EMPRESA_MISMATCH si id_empresa del body !== req.id_empresa
  │
  └─ 2. Si authz OK → internalServerLimiter (4 capas de rate limit)
        ├─ Capa 4 (anomalía)
        ├─ Capa 1 (id_empresa)
        ├─ Capa 2 (id_empresa + instance)
        └─ Capa 3 (IP)
```

**Garantía**: si authz falla, NO se consume rate limit. Esto evita que
un atacante con una key inválida pueda consumir tokens de otro usuario
(sería un side channel).

### 9.9. `globalLimiter` ya NO aplica a `/internal/*`

A partir de I-008, `globalLimiter` (60 req/min por IP) se skipea para
todas las rutas que empiezan con `/internal/`. El rate limit de esas rutas
queda cubierto por `internalServerLimiter` (4 capas).

`/health`, `/`, `/s/*` y `/api/sign/*` siguen aplicando el `globalLimiter`.
`signRequestLimiter` (30 req/min por IP) sigue aplicando a
`POST /internal/sign-requests` como **defensa adicional** (decisión del
user, NO se elimina en I-008).

### 9.10. Aplicación en routers

| Router | Endpoint | ¿Usa `requireEmpresaScopeAndLimit`? |
|---|---|---|
| `signRequest.js` | POST /internal/sign-requests | ✅ |
| `signRequest.js` | GET /internal/sign-requests/:id | ✅ |
| `signRequest.js` | GET /internal/sign-requests | ✅ |
| `internal-audit.js` | GET /internal/sign-requests/:id/eventos | ✅ |
| `internal-audit.js` | POST /internal/sign-requests/:id/revoke | ❌ (usa `adminApiAuth`, no aplica) |
| `consent.js` | POST /internal/consentimientos | ✅ |
| `consent.js` | POST /internal/consentimientos/:id/verify-otp | ✅ |
| `agreement.js` | (varios) | ❌ (público, sin per-empresa scope) |
| `admin.js` | /internal/admin/* | ❌ (usa `adminApiAuth`, no aplica) |

### 9.11. Status code de rate limit

Todas las capas devuelven `429 RATE_LIMIT_EXCEEDED` con:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Demasiadas solicitudes. Intenta de nuevo más tarde.",
    "details": {
      "limiter": "internal-capa1" | "internal-capa2" | "internal-capa3" | "anomaly",
      "limit": <número>,
      "window_ms": <ventana en ms>
    },
    "request_id": "..."
  }
}
```

El campo `limiter` permite al cliente identificar qué capa se disparó.
**No revela internals** (e.g. el id_empresa o el instance id) para evitar
side channels.

### 9.12. Tests (388 + 27 nuevos = 415 passing)

Los tests del rate limit interno viven en dos archivos:

- `tests/middleware/authz.test.js`: 7 tests de composición
  (`requireEmpresaScopeAndLimit`) + 8 tests adversariales
  (cross-company, instance buckets, legacy mode, key revocada,
  `allowed_operations`, `checkIdEmpresa`, regression).
- `tests/middleware/internalServerLimiter.test.js`: 12 tests de las
  4 capas (capa 1: 3 tests, capa 2: 2 tests, capa 3: 1 test,
  capa 4: 5 tests, composición: 1 test).

### 9.13. Configuración por env vars

Los límites de las 4 capas son **hardcoded en producción** (no se pueden
cambiar sin un deploy). Para entornos de tests, ajustes puntuales o
tuning pre-producción, se aceptan env vars que se leen **al cargar el
módulo** (`src/middleware/rateLimit.js`). NO se usa `config.js` para no
acoplar el módulo a la config central — el módulo se mantiene
self-contained.

| Env var | Default | Capa que afecta |
|---|---|---|
| `RATE_LIMIT_INTERNAL_EMPRESA_PER_HOUR` | `720` | Capa 1 (id_empresa) |
| `RATE_LIMIT_INTERNAL_EMPRESA_INSTANCE_PER_HOUR` | `240` | Capa 2 (id_empresa + instance) |
| `RATE_LIMIT_INTERNAL_IP_PER_HOUR` | `480` | Capa 3 (IP fallback) |
| `RATE_LIMIT_INTERNAL_ANOMALY_MAX_INSTANCES` | `10` | Capa 4 (umbral de anomalía) |
| `RATE_LIMIT_INTERNAL_ANOMALY_WINDOW_MS` | `86400000` (24h) | Capa 4 (ventana de la heurística) |

**Validación**: si una env var es inválida (no entero, o < 1), se usa
el default. Esto evita que un typo en `.env` haga crashear el servicio
al arrancar.

**Importante para tests**: como las env vars se leen al cargar el
módulo, deben setearse **antes** del primer `require('./rateLimit')`.
Los tests del rate limit interno (chunk 3) usan la Opción C del
briefing: instancian los limiters directamente con `max: 3` en lugar
de agotar buckets de 720/240/480 requests.

### 9.14. Riesgos aceptados

| ID | Riesgo | Aceptación |
|---|---|---|
| D.4 | Empresa grande con muchos dispositivos es flagged por capa 4 | Aceptado v1; en v2 pasar a alerta |
| D.5 | Estado de capa 4 se pierde en restart | Aceptado v1; mitigado por rate limits por IP persistentes (capas 1-3) |
| D.6 | Bucket de capa 3 (IP) compartido entre empresas | Aceptado (es fallback; capa 1 es la autoritativa) |
| D.7 | X-Client-Instance-Id falsificado evade capa 4 | Aceptado (es heurística; la defensa real es revocar la key en I-010) |

### 9.15. Plan de migración a v2 (futuro)

| Mejora | Descripción |
|---|---|
| Capa 4 → alerta | Notificar al admin en lugar de bloquear |
| Persistir capa 4 | Mover el Map a BD o Redis para sobrevivir restarts |
| Tier por operación | `audit:read` con límite más alto que `sign_request:create` |
| Dashboard | Visualizar el uso por empresa y por instance |
| Cleanup activo | Timer periódico en lugar de cleanup lazy |

---

## 10. Idempotency-Key (I-003)

### 10.1. Contexto y motivación

K+AIR (cliente) llama a `POST /v1/internal/sign-requests` para crear
solicitudes de firma. El canal entre K+AIR y `firma-service` no es
confiable por construcción: timeouts, retries automáticos del lado del
cliente, conexiones que se cierran a mitad de request. Sin
idempotencia, un retry podría crear **duplicados** del mismo SignRequest
(mismo `id_trabajador`, mismo `id_documento`, misma `agreement_version`),
lo cual deriva en:

- Doble envío de correo al trabajador.
- Múltiples tokens de firma activos.
- Confusión en la auditoría (¿cuál es el evento canónico?).
- Posible denegación de servicio si el operador reintenta agresivamente.

I-003 introduce el header estándar HTTP `Idempotency-Key` (similar al
de Stripe) para que K+AIR pueda hacer retries seguros. El servidor
garantiza que **misma key + mismo payload = una sola operación** y
devuelve el mismo resultado en cada retry.

**Alcance:** aplica a `POST /v1/internal/sign-requests` (escrito por
I-003.5 una vez cableado por I-005). **No aplica** a:

- GET endpoints (son naturalmente idempotentes).
- `/s/:id` (flujo público del trabajador).
- Webhooks (I-201, tiene su propio mecanismo de retry).

**Versión afectada:** v1. Backward compat: clientes sin el header
siguen funcionando (G3, §10.2).

### 10.2. Header `Idempotency-Key` (G1–G4)

**Decisiones de diseño congeladas en I-003:**

- **G1** — Nombre del header: `Idempotency-Key` (case-insensitive en
  HTTP, pero el cliente DEBE usar esa grafía exacta). Estándar
  propuesto por IETF (`draft-ietf-httpapi-idempotency-key-header`).
- **G2** — Formato: UUID v4 validado por regex
  `/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`.
  Máximo 255 chars (alineado con HTTP header size limits).
- **G3** — **Opcional**: si el header no viene, el middleware hace
  `next()` inmediatamente sin tocar la BD. Backward compat con clientes
  pre-I-003.
- **G4** — **Scope por empresa**: PK compuesta `(id_empresa,
  idempotency_key)`. La misma string-key puede existir en distintas
  empresas sin colisión. `id_empresa` viene de I-010 (D-13) — autoritativo,
  nunca del body ni del query.

**Manejo de header inválido (`IdempotencyKeyInvalid` → HTTP 400):**

| Caso | Comportamiento |
|---|---|
| Header ausente | `next()` sin tocar BD (G3). |
| Header presente pero string vacío `''` | 400 `IDEMPOTENCY_KEY_INVALID` (`reason: empty`). |
| Header con > 255 chars | 400 `IDEMPOTENCY_KEY_INVALID` (`reason: too_long`). |
| Header no es UUID v4 (regex fail) | 400 `IDEMPOTENCY_KEY_INVALID` (`reason: not_uuid_v4`). |
| Header no es string (e.g. array) | 400 `IDEMPOTENCY_KEY_INVALID` (`reason: not_a_string`). |
| Header con whitespace leading/trailing | HTTP parser LO TRIM (RFC 7230 §3.2.4) — key válida. |
| Header con dos ocurrencias | Express concatena con `, ` → key inválida → 400. |
| Header con null byte | `ERR_INVALID_CHAR` de Node HTTP parser, no llega al middleware. |

### 10.3. Fingerprint del payload (G5–G6 refinado)

El fingerprint es la representación canónica de la **intención** del
cliente. Si dos requests tienen el mismo fingerprint, el servidor
asume que es la misma operación lógica.

**Decisiones de diseño:**

- **G5** — Algoritmo: `SHA-256(canonical_json({...metadata, pdf_sha256}))`,
  donde `canonical_json` ordena las keys alfabéticamente de forma
  recursiva, no añade espacios, y **preserva el orden de los arrays**.
- **G6 refinado** — El fingerprint **incluye** `pdf_sha256` (hex de
  64 chars, lowercase defensivo). Esto cierra un vector de ataque:
  si el cliente cambia el PDF pero mantiene el metadata, el
  fingerprint cambia → 409 `IDEMPOTENCY_KEY_CONFLICT`. NO se almacena
  el PDF binario (solo el hash), preservando la decisión original de
  no duplicar archivos grandes.

**Casos cubiertos (verificado en §S2 y §M8 de la batería adversarial):**

| Caso | Mismo fingerprint |
|---|---|
| `{a:1, b:2}` vs `{b:2, a:1}` | ✅ Sí (orden de keys) |
| Arrays `[1,2,3]` vs `[3,2,1]` | ❌ No (orden de arrays SÍ importa) |
| `'ABCDEF...'` vs `'abcdef...'` (sha256 hex) | ✅ Sí (lowercase) |
| Number `1` vs String `'1'` | ❌ No (tipo importa) |
| `null` vs missing key | ❌ No (semántica distinta) |
| Mismo metadata, distinto `pdf_sha256` | ❌ No (fingerprint cambia) |
| Distinto metadata, mismo `pdf_sha256` | ❌ No (fingerprint cambia) |

### 10.4. Estados y máquina de transiciones (G8 refinado)

La fila de `gh_idempotency_keys` puede estar en uno de cuatro estados.
El CHECK constraint del schema 008 valida que el valor pertenezca al
whitelist `PENDING | COMPLETED | FAILED | TERMINAL`.

```
                  ┌──────────────┐
   getOrCreate    │              │   handler OK
   ────────────▶  │   PENDING    │ ────────────▶ COMPLETED  (2xx)
                  │              │                    │
                  │              │   handler 4xx     │   + body cacheado
                  │              │   sin opt-in      │   + response_status
                  │              │ ────────────▶ FAILED
                  │              │                    │
                  │              │   handler llama    │   + body cacheado
                  │              │   res.idempotency  │   + response_status
                  │              │   .terminal(b,s)  │
                  │              │ ────────────▶ TERMINAL
                  └──────┬───────┘
                         │
            5xx/uncaught│ (no transición — PENDING se mantiene
                         │  para que el in-flight timeout recupere)
                         ▼
                    (sin cambio)
```

**Semántica por estado:**

| Estado | Significado | ¿Retry con mismo fingerprint? | Body cacheado? |
|---|---|---|---|
| **PENDING** | Operación en curso o crasheó sin marcar | Solo si in-flight timeout (>5 min) | No |
| **COMPLETED** | Operación exitosa 2xx | ✅ Sí → REPLAY (mismo body, mismo status) | Sí |
| **FAILED** | Error 4xx recuperable (default) | ✅ Sí → nueva ejecución | No (NO se popula) |
| **TERMINAL** | Rechazo deliberado (opt-in handler) | ❌ No, aunque fingerprint idéntico | Sí |

**Decisión crítica G8 refinado**: la clasificación `TERMINAL` **NO es
automática** para cualquier 4xx. Es decisión explícita del handler vía
`res.idempotency.terminal(body, statusCode)` ANTES de `res.json(...)`.
El default 4xx es `FAILED` (retry permitido). Esto evita que rechazos
transitorios bloqueen retries legítimos.

### 10.5. TTL de 24 horas (lazy cleanup)

**Decisión:** `expires_at = created_at + 24h`, formato ISO 8601 estricto.

**Requisito técnico explícito (no es opcional):**

La columna `expires_at` se almacena en formato `YYYY-MM-DDTHH:MM:SS.mmmZ`
(strftime ISO 8601). La columna `created_at` usa el formato default de
SQLite (`YYYY-MM-DD HH:MM:SS`). **Comparar lexicográficamente estos
dos formatos falla** porque `' ' (0x20) < 'T' (0x54)`. Por lo tanto:

- ✅ Comparación correcta: `WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
- ❌ Comparación rota: `WHERE expires_at < datetime('now')`

Esta regla está documentada en el JSDoc de
`src/services/idempotency.js` (línea 47-51) y fue verificada
atómicamente antes de commit.

**Limpieza:** LAZY (no hay timer/cron). Se ejecuta en cada
`getOrCreate()` y vía `cleanup()` explícito. Si la fila está
expirada al momento del lookup, se borra y se reemplaza con un
nuevo PENDING.

**Justificación del TTL 24h:** suficiente para que un cliente que
hizo un retry varias horas después (e.g. operador que reintenta al
día siguiente) reciba el mismo resultado, pero corto para que la
tabla no crezca indefinidamente.

### 10.6. Timeout de PENDING de 5 minutos (G7)

Una fila PENDING puede existir por dos razones legítimas:

1. La operación está corriendo (handler en await).
2. El proceso crasheó o se olvidó de cerrar la key.

**Decisión G7:** Si `created_at` de una fila PENDING es **mayor a 5
minutos**, se interpreta como crash y se permite retry limpio. El
siguiente `getOrCreate` la reemplaza con un nuevo PENDING.

**Por qué 5 minutos:** suficiente para que un handler legítimo
(I/O de BD, envío de correo, generación de PDF) complete, pero corto
para que un cliente que ve `IN_PROGRESS` sepa cuándo reintentar
(`Retry-After: 300` segundos, §10.7).

**Comparación de tiempo (requisito técnico explícito):**

`created_at` está en formato SQLite default. Para compararlo contra
"now - 5min" en ISO 8601, el service hace:

```sql
(strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
 < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-300 seconds'))
```

Esto convierte `created_at` a ISO 8601 antes de comparar, evitando el
problema lexicográfico.

### 10.7. Manejo de concurrencia y race conditions

**Garantías:**

- **Una sola ejecución del handler** por `(id_empresa, idempotency_key)`
  mientras la fila esté PENDING. Requests concurrentes con la misma
  key: el primero crea PENDING, los siguientes reciben 409
  `IDEMPOTENCY_KEY_IN_PROGRESS` con header `Retry-After: <segs>`.
- **No hay deadlocks** entre las 4 capas (authz, rate limit,
  idempotency) — verificado en test §M1.1 (2 calls paralelos) y
  §M1.3 (5 calls paralelos): handler corre 1 vez, resto es 409 o
  REPLAY.
- **PK compuesta (UNIQUE constraint)** previene INSERT duplicado. Si
  dos requests llegan en exactamente el mismo tick, el segundo
  recibe UNIQUE error del driver, se re-SELECT, y se propaga
  IdempotencyKeyInProgress o IdempotencyKeyConflict según el caso
  (verificado en §S5 y §M1).

**Comportamiento ante `Retry-After`:** la cabecera HTTP se setea
en la respuesta 409 con el tiempo restante hasta que la fila
expiraría (mínimo 1 segundo). El cliente PUEDE reintentar después
de ese tiempo, pero también PUEDE reintentar antes (recibirá el
mismo 409 si la fila sigue PENDING). NO se penaliza por retries
agresivos (eso es rate limit, I-008).

### 10.8. REPLAY y redacción del token (C-22, G9, G10)

**G9** — Cuando una request llega con misma key + mismo fingerprint
y la fila está COMPLETED, el middleware:

1. Parsea `response_body` (almacenado como JSON string) de vuelta a
   objeto.
2. Setea el header `X-Idempotency-Replay: true`.
3. Envía `res.status(response_status).json(parsedBody)`.
4. **NO** ejecuta el handler (verificado con counter en §M3.3).

**C-22** — El token del SignRequest (`token`, `url_publica`,
`qr_payload`) se cachea en la fila COMPLETED. En REPLAY, el cliente
recibe el **mismo token** que recibió en la 1ª ejecución. Esto es
crítico: si el cliente hace retry por timeout y el servidor
re-generara el token, el cliente no podría usarlo (el token nuevo
estaría en una fila distinta).

**Recuperación explícita (I-013b)**: si el cliente perdió el token
del 1st response, hay un endpoint dedicado
`GET /v1/internal/sign-requests/:id` (I-002 ya provee esto) que
permite re-fetchear la fila canónica.

**G10** — Header de respuesta `X-Idempotency-Replay: true`:
- ✅ Set en REPLAY.
- ❌ NO set en 1ª ejecución (NEW).
- ❌ NO set en errores (4xx, 5xx).
- Verificado en §M3.3 y §M14 (4 escenarios).

### 10.9. Separación por `id_empresa` (frontera I-003 + I-010)

La PK compuesta `(id_empresa, idempotency_key)` garantiza
**aislamiento total entre empresas**:

```
Empresa A  id_empresa=900123456  key="abc-123"  → fila #1
Empresa B  id_empresa=900999999  key="abc-123"  → fila #2 (independiente)
```

Misma string-key en distintas empresas son **filas distintas**, no
hay colisión. Esto fue verificado exhaustivamente en la batería
adversarial §S1 (7 sub-tests) que cubre:

- Empresa A + key + payload X → COMPLETED.
- Empresa B + misma key + mismo payload → también COMPLETED (fila #2).
- Empresa A + misma key + payload Y → 409 CONFLICT (no afecta B).
- Empresa A marcada TERMINAL → Empresa B sigue REPLAY-eable.
- Empresa A re-intenta con misma key + mismo fingerprint tras
  TERMINAL → 409 `IDEMPOTENCY_KEY_TERMINAL` (G8 refinado, dentro
  de A).

**Fuente de `id_empresa`:** siempre `req.id_empresa` (seteado por
`requireEmpresaScope`, I-010/D-13). **NUNCA** del body ni de query
params. Si por alguna razón `req.id_empresa` no está presente, el
middleware falla cerrado con 500 `INTERNAL_ERROR` (defense in depth,
verificado en §M7).

### 10.10. Amenazas cubiertas por I-003.4 (batería adversarial)

68 tests adversariales (33 service-level + 35 middleware-level)
ataques documentados en `tests/services/idempotency-adversarial.test.js`
y `tests/middleware/idempotency-adversarial.test.js`:

| Amenaza | Sección |
|---|---|
| Cross-company attack (misma key en 2 empresas) | §S1 |
| JSON canonicalization (orden de keys, tipos, arrays) | §S2 |
| pdf_sha256 case collision (G6 refinado) | §S3 |
| TTL 24h expiry | §S4 |
| UNIQUE constraint race (2 inserts simultáneos) | §S5 |
| In-flight timeout boundary (4/5/6/10 min, G7) | §S6 |
| Concurrencia HTTP (2 / 5 requests paralelos, sin doble handler) | §M1 |
| PENDING blocking + Retry-After | §M2 |
| REPLAY body idéntico + X-Idempotency-Replay | §M3 |
| Header attacks (case, length, unicode, dos, null, whitespace) | §M4 |
| 5xx/uncaught no marca FAILED (incluye HALLAZGO M5.4) | §M5 |
| PII en responses y logs (incluye 100-requests stress) | §M6 |
| id_empresa missing / null / empty | §M7 |
| pdf_sha256 contribution al fingerprint + validación | §M8 |

**Resultado:** 569/569 tests verdes (501 baseline + 68 adversarial),
3 corridas consecutivas sin flakiness (post-fix: 17s, 15.6s, 15.3s).

### 10.11. Lo que NO protege la idempotencia

Documentar lo que la idempotencia **no** hace es tan importante como
lo que hace, para no generar falsa sensación de seguridad.

| Capacidad | Cubierta por |
|---|---|
| Autenticación del cliente (API key, IP, instance) | I-010 (D-13) |
| Autorización per-empresa (allowed_operations) | I-010 (D-13) |
| Rate limit (720/h por empresa, 240/h por instance) | I-008 (C-20 v5) |
| Cifrado del PDF binario en storage | TLS + filesystem |
| Validación del schema/estructura del PDF | I-012 (C-23) |
| Detección de malware en el PDF | I-012 (C-23) |
| Persistencia del PDF en disco | `signRequest` service |
| Notificación al trabajador (correo, OTP) | `mailer` service |
| Webhook delivery a K+AIR | I-201 (futuro) |
| Audit log inmutable de eventos | I-002 + `gh_firma_eventos` |
| Compliance con Decreto 1072 / Ley 1581 | LEGAL.md |

La idempotencia es **una capa adicional** sobre las demás, no un
reemplazo. El cliente sigue siendo responsable de:

- Generar UUIDs v4 únicos por intento de SignRequest.
- Respetar el header `Retry-After` cuando recibe 409 IN_PROGRESS.
- No reintentar más allá del TTL 24h (el servidor habrá olvidado la
  key).

### 10.12. HALLAZGO M5.4 — Edge case documentado

**Descripción:**

Cuando un handler hace `res.status(201).json({...})` y **luego**
lanza una excepción, el comportamiento observado es:

1. Cliente recibe 201 (la response original).
2. Express invoca `errorHandler` que intenta `res.status(500).json(...)`
   sobre la response ya enviada.
3. Internamente `res.statusCode` queda en **500** (errorHandler lo
   setea antes de fallar al enviar) y el `captured` body en el wrap
   de `res.json` se sobreescribe con el body del error.
4. El lifecycle hook de `'finish'` corre con `statusCode=500` →
   el middleware ve 5xx, no marca COMPLETED (regla "no blanket
   FAILED", §9 / C-20 v5).
5. La fila queda PENDING. Cliente que recibió 201 no puede hacer
   REPLAY — una llamada subsecuente con misma key + fingerprint
   verá 409 IN_PROGRESS en lugar del 201 cacheado.

**Severidad:** edge case (handler con bug de programación que tira
después de `res.json`). El comportamiento actual es **conservador**
(no marca COMPLETED con state corrupto, no se arriesga a escribir
un body incorrecto), pero deja al cliente sin opción de REPLAY.

**Likelihood:** muy baja. Requiere que un handler explícitamente
haga `res.json()` y LUEGO `throw` (patrón de bug, no de uso normal).
En la práctica, los handlers correctos NO tiran después de
`res.json` — el patrón canónico es tirar ANTES para que
errorHandler decida el status.

**Decisión (v1):**

- ✅ **Aceptar como riesgo documentado** para v1.
- **Razón 1:** la lógica defensiva del middleware (no escribir
  state con datos potencialmente corruptos) es más valiosa que
  garantizar REPLAY en un caso que nunca debería ocurrir en código
  correcto.
- **Razón 2:** el fix requiere instrumentación adicional
  (capturar `statusCode` original antes de pasar a errorHandler,
  o escuchar el evento `error` además de `finish`/`close`). Es
  un cambio de baja prioridad con respecto al resto del bloque
  funcional.
- **Razón 3:** I-013b (recovery endpoint) ya provee una vía
  explícita para que el cliente recupere el estado canónico vía
  `GET /v1/internal/sign-requests/:id`, sin depender de REPLAY.

**Plan de mitigación (post-v1):**

| Paso | Descripción | Owner |
|---|---|---|
| Tracking | Crear ticket `TECH-DEBT: M5.4 fix en middleware` con link a este hallazgo | Mavis |
| Diseño | Capturar `statusCode` original en variable local cuando se llama `res.json()`, usar esa variable (no `res.statusCode`) en el lifecycle hook | Mavis |
| Test | Re-correr §M5.4 con el fix: cliente debe ver 201 Y fila COMPLETED | Mavis |
| Eval. Production Gate | Antes del go-live: si M5.4 sigue abierto, agregar al checklist como riesgo aceptado con plan de mitigación a 30 días | Mavis |

**Revisión periódica:** este hallazgo se re-evalúa en cada release
de v1.x. Si el patrón "throw after res.json" se vuelve común
(e.g. por adopción de un framework que lo promueva), se re-prioriza.

---

## 11. PDF Security (I-012)

### 11.1. Contexto y motivación

Cuando K+AIR crea una solicitud de firma, sube un PDF al Servicio
(`POST /v1/internal/sign-requests`). Ese PDF será:

1. Almacenado como `originales/<id_solicitud>.pdf`.
2. Enviado al trabajador vía `GET /s/:token/document.pdf`.
3. Firmado (overlay con metadatos), generando `firmados/<id_solicitud>.pdf`.
4. Soporte de la constancia (`constancias/<id_solicitud>.pdf`).

Antes de I-012, el Servicio confiaba en la auto-declaración del cliente:
el `metadata.document_hash` enviado en el body era el que se persistía.
Esto permitía que un cliente mintiera sobre el hash del PDF, o subiera
un PDF que parecía válido pero no lo era (corrupto, cifrado, demasiado
grande, etc.).

I-012 introduce una validación estructural obligatoria en el Servicio, y
garantiza que el hash persistido es el calculado por el servidor, no el
declarado por el cliente.

### 11.2. Lo que SÍ se hace (G11–G15) — implementado en I-012

#### 11.2.1. G11 — Validación estructural

Cada PDF subido pasa por `services/pdfValidator.js` (I-012.1), que usa
`pdf-lib v1.17.1` para:

- Verificar el header mágico `%PDF-` (ISO 32000-1 §7.5.2).
- Caminar la tabla cross-reference.
- Detectar la presencia de una entrada `/Encrypt` en el trailer.
- Contar páginas.
- Extraer el diccionario `/Info` (Title, Author, Subject, etc.).

El servicio es una **capa pura, sin HTTP**. Lanza errores tipados con
`code` y `details` (sin PII: nunca bytes del PDF, nunca Title/Author).
El mapeo a HTTP vive en `middleware/pdfValidation.js` (I-012.2).

**Punto crítico**: la validación ocurre **antes** de
`services/signRequest.create()`. Si la validación falla, el PDF **nunca**
se persiste en `storage/originales/`.

#### 11.2.2. G12 — Límites configurables

Cuatro variables de entorno (sección `pdf:` de `src/config.js`):

| Env var | Default | Significado |
|---|---|---|
| `PDF_MAX_BYTES` | 52428800 (50 MB) | Tamaño máximo del buffer. Antes de cualquier parseo. |
| `PDF_MAX_PAGES` | 200 | Máximo de páginas. |
| `PDF_PARSE_TIMEOUT_MS` | 5000 | Timeout del parseo (Promise.race + setTimeout). |
| `PDF_MAX_METADATA_BYTES` | 1048576 (1 MB) | Suma de bytes del `/Info` dictionary (anti metadata-bomb). |

Si el buffer excede el límite de tamaño, el rechazo ocurre **antes** de
iniciar el parseo (chequeo O(1)), protegiendo contra ataques de
"troll" (50 MB de zeros).

#### 11.2.3. G13 — Timeout y errores tipificados (HTTP 422)

`Promise.race` envuelve `PDFDocument.load()` con un `setTimeout` que
rechaza primero. Si el timeout se dispara, el servicio retorna
`PDF_PARSE_TIMEOUT` y la promesa perdedora sigue corriendo hasta que
termine (el PDF no será aceptado de todas formas).

Seis errores tipados del service, todos mapeados a **HTTP 422** por
`middleware/pdfValidation.js`:

| code | Causa |
|---|---|
| `PDF_INVALID` | Buffer no parseable como PDF (header inválido, truncado, basura). |
| `PDF_ENCRYPTED` | PDF con entrada `/Encrypt` (cifrado). pdf-lib no soporta desencriptar. Se RECHAZA, no se descifra. |
| `PDF_TOO_LARGE` | Buffer.length > `PDF_MAX_BYTES`. |
| `PDF_TOO_MANY_PAGES` | pageCount > `PDF_MAX_PAGES`. |
| `PDF_PARSE_TIMEOUT` | parseo excedió `PDF_PARSE_TIMEOUT_MS`. |
| `PDF_METADATA_TOO_LARGE` | Suma de bytes del `/Info` > `PDF_MAX_METADATA_BYTES`. |

**Caso especial**: `PDF_REQUIRED` (no se envió archivo) → **HTTP 400**
(malformed request, no unprocessable). Defense in depth: el middleware
`upload.js` ya retorna 400 para `LIMIT_*` antes de llegar aquí, pero
`PDF_REQUIRED` queda documentado para tests unitarios y rutas futuras
que invoquen `pdfValidation()` directamente.

#### 11.2.4. G14 — SHA-256 server-computed

El hash que se persiste es el calculado por el servidor, no el declarado
por el cliente en `metadata.document_hash`.

- **Service** (`src/services/pdfValidator.js`): usa `sha256()` de
  `src/crypto/hash.js` (mismo módulo que consume
  `src/services/idempotency.js` y `src/services/signRequest.js`).
- **Middleware** (`src/middleware/pdfValidation.js`): expone el resultado
  en `req.pdfValidation.sha256` para el handler.
- **Route** (`src/routes/signRequest.js` líneas 44-49): propaga
  `req.pdfValidation.sha256` a `services/signRequest.create()`. El
  handler **no** usa el `metadata.document_hash` que envió el cliente.

Resultado: un cliente no puede mentir sobre el hash. Si el
`document_hash` del body no coincide con el del PDF realmente subido, se
rechaza en zod antes de llegar al service.

#### 11.2.5. G15 — Disclaimer: pdfValidator detecta condiciones estructurales, no contenido activo

`pdfValidator` es un **parser estructural**, no un control de seguridad
del contenido. Detecta **determinadas condiciones estructurales y límites
definidos** (header inválido, entrada `/Encrypt`, tamaño, páginas,
timeout, tamaño de metadata). **No constituye una garantía de seguridad
del contenido activo ni de protección contra explotación de
vulnerabilidades del parser o del renderizador.**

Un PDF que pasa la validación puede contener estructuras complejas que
un parser específico no maneje bien, o patrones que un visor (Chromium,
PDF.js, Adobe Reader) renderice de forma diferente a pdf-lib.

**Implicaciones operativas**:
- El contenido activo del PDF es responsabilidad del **renderizador
  del firmante** (Chromium en la mini-app), no del Servicio.
- Para validación más profunda del contenido se requiere una capa
  adicional (ver §11.3).

### 11.3. Lo que NO se hace (controles recomendados para producción)

Esta sección documenta controles que **no** forman parte de I-012 y que
quedan fuera del alcance del Servicio en v1. Listarlos explícitamente
es necesario para evitar la falsa conclusión "el Servicio valida
contenido activo del PDF".

| Control | Estado | Recomendación |
|---|---|---|
| Análisis antivirus (AV) de los bytes del PDF | **No implementado** | Evaluar ClamAV u otro AV offline en el futuro. |
| Sandboxing del renderizador del PDF | **No implementado** | Depende del visor (Chromium en mini-app). v1 confía en sandbox de Chromium. |
| Detección de exploits conocidos (zero-day) del parser | **No implementado** | Depende de mantener pdf-lib actualizado y de CVEs públicos. |
| Firma digital criptográfica del PDF (X.509, PAdES) | **Fuera de alcance v1** | El Servicio genera "constancia" del evento, no firma criptográfica del PDF. |
| Listas de revocación (CRL) o respuestas OCSP | **Fuera de alcance v1** | Solo aplica si se usa firma criptográfica X.509. |
| Detección de "metadata bombs" más allá de `/Info` | **No implementado** | Solo se valida el tamaño del `/Info`. Otros streams (XMP, JavaScript embebido) no se inspeccionan. |

**Recomendación pre-producción**: ejecutar un pentest del Servicio con
una batería de PDFs adversariales que incluya documentos con contenido
activo (JavaScript, acciones PDF, streams embebidos, polyglotas
válidos como PDF y otro formato). El pentest validará las afirmaciones
de este documento. Ver §12 (Pentesting post-implementación).

### 11.4. Disclaimers legales

Esta sección documenta controles implementados en el Servicio, no
asesoría jurídica. La validación estructural implementada en I-012 es
un control técnico; **no certifica** que el Servicio cumpla con algún
marco normativo específico. La validación jurídica del Servicio y su
operación corresponde a un profesional del derecho colombiano.

Ver `LEGAL.md` para el marco normativo aplicable (Ley 527 de 1999,
Decreto 2364 de 2012, Decreto 1072 de 2015, Decreto 526 de 2021) y la
cláusula de validación jurídica externa pendiente.

### 11.5. Referencias a código

- `src/services/pdfValidator.js` (526 líneas) — capa pura con pdf-lib.
- `src/middleware/pdfValidation.js` (126 líneas) — adaptador HTTP, mapea
  errores tipados a HTTP 422.
- `src/config.js` líneas 100-108 (sección `pdf:`) — 4 env vars.
- `src/routes/signRequest.js` líneas 21, 44-49 — cableado del
  middleware y comentario explícito sobre hash server-computed.
- `tests/services/pdfValidator.test.js` (582 líneas, 25 tests) — §S1-§S6.
- `tests/middleware/pdfValidation.test.js` (490 líneas, 14 tests).
- `tests/routes/signRequest-pdf-validation.test.js` (375 líneas, 8 pass
  + 1 skip pre-existente) — integración HTTP.
- `tests/routes/signRequest-pdf-validation-adversarial.test.js`
  (494 líneas, 20 tests) — §M1-§M8.

**Verificación post-I-012.3**: 663/664 pass, 0 fail, 1 skip pre-existente,
3× corridas consecutivas en ~19s.

---

## 12. Pentesting post-implementación

Antes del go-live, se recomienda contratar un **pentesting
externo** que cubra:

### 12.1. Alcance

- Caja negra contra `https://firma.k-air.com`.
- Caja gris contra los endpoints internos (con API key
  proporcionada por el equipo).
- Caja blanca con acceso al código.

### 12.2. Áreas a probar

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
- [ ] **Bypass del rate limit interno de 4 capas** (I-008):
      ¿se puede bypasear X-Client-Instance-Id cambiando el valor?
      ¿se puede bypasear req.id_empresa inyectándolo en el body?
- [ ] **Anomalía de instance ids** (I-008, capa 4): ¿se puede evitar
      el límite de 10 usando la misma instance repetidamente?
- [ ] Manipulación de estados.
- [ ] Race conditions en el commit.
- [ ] Filtración de información en mensajes de error.
- [ ] Seguridad de la mini-app (CSP, HTTPS, etc.).
- [ ] Seguridad del endpoint de descarga de PDFs.
- [ ] Validación de JSON canónico.
- [ ] Path traversal.
- [ ] **Hash de API key timing-safe**: comparar `constantTimeEqual`,
      no `===`.

### 12.3. Criterio de aceptación

- 0 vulnerabilidades altas o críticas sin resolver.
- Todas las vulnerabilidades medias con plan de remediación
  documentado.

---

## 13. Bug bounty (futuro)

En **v1.1 o v2.0** se puede considerar un programa de bug bounty:

- Plataforma: HackerOne, Open Bug Bounty, etc.
- Alcance: solo el Servicio y la mini-app.
- Recompensas: basadas en criticidad.
- Disclosure coordinado: 90 días antes de publicación.

**No está en v1.**

---

## 14. Anexo: matriz de riesgos

| ID | Amenaza | Probabilidad | Impacto | Riesgo | Mitigación principal | Riesgo residual |
|---|---|---|---|---|---|---|
| S.1 | Suplantación del trabajador | Media | Alto | 🟠 | Cédula + OTP + manifestación | 🟡 Bajo |
| S.2 | Suplantación de RH | Baja | Alto | 🟡 | API key + HTTPS | 🟡 Bajo |
| S.3 | Suplantación del Servicio (phishing) | Media | Alto | 🟠 | HSTS + dominio único | 🟡 Bajo |
| T.1 | Modificación del PDF firmado | Baja | Crítico | 🟡 | SHA-256 + verificación | 🟢 Muy bajo |
| T.2 | Modificación de eventos | Baja | Alto | 🟡 | Append-only + backups | 🟢 Muy bajo |
| T.3 | Modificación de la BD | Baja | Crítico | 🟡 | Permisos + backups | 🟢 Muy bajo |
| T.4 | Inyección SQL | Media | Crítico | 🟠 | SQL parametrizado + validación | 🟢 Muy bajo |
| T.5 | Supresión del registro de auditoría fuera de regla | Baja | Alto | 🟡 | Trigger con ventana + lote + log append-only + deber legal | 🟢 Muy bajo |
| T.6 | Ver el documento sin aceptar el Acuerdo (orden (g)/(h)) | Media | Alto | 🟠 | Gate en el backend + UI que no carga el visor | 🟢 Muy bajo |
| T.7 | Acceso al PDF firmado por tener el enlace (5.4) | Baja | Medio | 🟡 | Solo lectura + 409 antes de firmar + TTL sin extender | 🟡 Bajo |
| T.8 | La 5B suprime de más (fila, archivos, credencial) | Media | Crítico | 🟠 | Ventana + lote + actor/motivo + hold revalidado + dry-run por defecto + lápida sin credencial (HMAC de propósito propio) y append-only | 🟡 Bajo (condicionado a la Compuerta 0) |
| T.9 | El token de acceso queda en la base en una forma recuperable | Baja | Alto | 🟠 | Solo la huella (HMAC con clave secreta) + rotación que devuelve el token una vez y deja sin efecto el anterior (un solo token vigente por solicitud) + auditoría por emisión | 🟡 Bajo (queda purgar el `token_encrypted` de las filas anteriores a la 8C) |
| T.10 | El número del representante legal queda en texto claro en la base | Media | Alto | 🟠 | Cifrado AES-256-GCM con llave fuera de la base y ámbito por empresa + versión de llave en el sobre + últimos 4 en pantalla | 🟡 Bajo (queda re-cifrar las filas anteriores a la 8B) |
| T.11 | El documento con datos sensibles se sirve sin el aviso previo ni el consentimiento expreso (10.8) | Alta | Alto | 🟠 | Gate en el backend (409) + casilla separada + aviso fijado al crear + la Empresa solo puede subir la clasificación | 🟡 Bajo |
| I.6 | `metadata` como canal libre para meter datos que el Acuerdo no autoriza | Media | Alto | 🟠 | Lista blanca de 5 claves + `.strict()` que nombra la clave desconocida + filtro final en el servicio | 🟢 Muy bajo |
| R.1 | Repudio del trabajador | Media | Alto | 🟠 | Eventos + hashes + correo | 🟡 Bajo |
| R.2 | Repudio del empleador | Baja | Medio | 🟢 | rh_user_id + logs | 🟢 Muy bajo |
| I.1 | Filtración de tokens | Baja | Crítico | 🟡 | Solo hash en BD + redacción | 🟢 Muy bajo |
| I.2 | Filtración de OTPs | Baja | Crítico | 🟡 | Hash + sal + TTL | 🟢 Muy bajo |
| I.3 | Filtración de la BD | Baja | Alto | 🟡 | Backups encriptados | 🟡 Bajo |
| I.4 | Filtración de PDFs | Baja | Medio | 🟢 | Permisos + token | 🟡 Bajo |
| I.5 | Confirmación de existencia de un consentimiento ajeno | Baja | Bajo | 🟢 | Empresa antes que trabajador + aviso saneado + authz + rate limit | 🟢 Muy bajo |
| D.1 | DoS por rate limit | Media | Medio | 🟡 | Rate limit + espacio | 🟢 Muy bajo |
| D.2 | DoS por crecimiento de BD | Baja | Medio | 🟢 | Monitoreo + cuota | 🟢 Muy bajo |
| D.3 | Caída del SMTP | Media | Alto | 🟠 | Reintentos + cola | 🟡 Bajo |
| D.4 | Empresa grande flagged por anomalía (capa 4) | Baja | Medio | 🟢 | Aceptado v1; alerta en v2 | 🟢 Muy bajo |
| D.5 | Estado de capa 4 se pierde en restart | Media | Bajo | 🟢 | Capas 1-3 persisten (express-rate-limit) | 🟢 Muy bajo |
| D.6 | Bucket IP compartido entre empresas (capa 3) | Media | Bajo | 🟢 | Capa 1 es autoritativa; capa 3 es fallback | 🟢 Muy bajo |
| D.7 | X-Client-Instance-Id falsificado evade capa 4 | Media | Bajo | 🟢 | Defensa real: revocar key en I-010 | 🟢 Muy bajo |
| E.1 | Mini-app a internos | Alta | Bajo | 🟢 | API key + middleware | 🟢 Muy bajo |
| E.2 | Token cruzado | Baja | Bajo | 🟢 | Routers separados | 🟢 Muy bajo |
| E.3 | Manipulación de mini-app | Alta | Bajo | 🟢 | Backend re-valida | 🟢 Muy bajo |

### Resumen ejecutivo

- **5 amenazas** con riesgo 🟠 que requieren mitigación continua.
- **9 amenazas** con riesgo 🟡 que son aceptables para v1.
- **11 amenazas** con riesgo 🟢 que son residuales y aceptables.
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

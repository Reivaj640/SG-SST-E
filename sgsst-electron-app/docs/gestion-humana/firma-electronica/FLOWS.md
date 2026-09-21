# Firma Electrónica K+AIR v1 — Diagramas de Flujo

**Versión del documento**: 0.1 (borrador de diseño)
**Fecha**: 2026-08-17
**Estado**: Borrador para revisión. Derivado de `ARCHITECTURE.md`, `DATA_MODEL.md` y `API.md`.
**Documentos rectores**:
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`DATA_MODEL.md`](./DATA_MODEL.md)
- [`API.md`](./API.md)

> **Aviso legal**
>
> Este documento describe los flujos de la arquitectura **diseñada
> conforme al marco normativo aplicable** a la firma electrónica de
> relaciones laborales en Colombia. **No constituye asesoría
> jurídica.** La validación definitiva debe realizarla un
> **profesional jurídico colombiano** antes de producción.

---

## Tabla de contenidos

- [1. Notación y actores](#1-notación-y-actores)
- [2. Flujo 1: Aceptación del Acuerdo de uso](#2-flujo-1-aceptación-del-acuerdo-de-uso)
- [3. Flujo 2: Firma presencial](#3-flujo-2-firma-presencial)
- [4. Flujo 3: Firma remota](#4-flujo-3-firma-remota)
- [5. Flujo 4: Rechazo explícito](#5-flujo-4-rechazo-explícito)
- [6. Flujo 5: Revocación por RH](#6-flujo-5-revocación-por-rh)
- [7. Flujo 6: Expiración (job automático)](#7-flujo-6-expiración-job-automático)
- [8. Flujo 7: Identificación fallida](#8-flujo-7-identificación-fallida)
- [9. Flujo 8: OTP bloqueado](#9-flujo-8-otp-bloqueado)
- [10. Flujo 9: Verificación posterior](#10-flujo-9-verificación-posterior)
- [11. Flujo 10: Sincronización K+AIR ← Servicio](#11-flujo-10-sincronización-kair--servicio)
- [12. Matriz resumen de flujos](#12-matriz-resumen-de-flujos)

---

## 1. Notación y actores

### 1.1. Actores del sistema

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ RH (K+AIR local) │  │ Servicio de      │  │ Trabajador       │
│                  │  │ Firma            │  │ (mini-app)       │
│ Usuario del      │  │ Express + SQLite │  │ Navegador en     │
│ módulo Gestión   │  │ Puerto 3001      │  │ teléfono/PC      │
│ Humana           │  │                  │  │                  │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                     │
         │  HTTPS (int)       │  HTTPS (público)    │
         │  X-Internal-API-Key│  (token en URL)     │
         │                     │                     │
         └─────────────────────┴─────────────────────┘
```

Adicionalmente:

```
┌──────────────────┐  ┌──────────────────┐
│ SMTP (correo)    │  │ base_personal    │
│                  │  │ (K+AIR local)    │
│ Envía OTP al     │  │ Cotejo de        │
│ trabajador       │  │ cédulas          │
└──────────────────┘  └──────────────────┘
```

### 1.2. Convenciones de los diagramas

- **Línea vertical sólida**: llamada síncrona (espera respuesta).
- **Línea vertical punteada**: respuesta asíncrona o callback.
- **Caja `[ ]`**: acción o procesamiento.
- **Caja `<< >>`**: estado o estereotipo.
- **`alt` / `else`**: caminos alternativos según condición.
- **`loop`**: repetición.
- **`note right of`**: nota explicativa.
- **`#`**: transacción atómica (BEGIN/COMMIT).

### 1.3. Colores semánticos (solo en diagramas Mermaid)

- 🟢 Verde: operación exitosa
- 🟡 Amarillo: validación o espera
- 🔴 Rojo: error o estado terminal negativo
- 🔵 Azul: evento de auditoría

> Los diagramas de este documento están en **ASCII** por portabilidad.
> En el repositorio se puede generar una versión Mermaid con
> `npm run docs:flows:mermaid`.

---

## 2. Flujo 1: Aceptación del Acuerdo de uso

**Cuándo ocurre**: una vez por versión del Acuerdo, durante el
pipeline de contratación, **antes** del primer documento a firmar.

**Duración típica**: 2-5 minutos.

### 2.1. Precondiciones

- El Acuerdo tiene una versión activa (`gh_firma_acuerdo_versiones.activa = 1`).
- El trabajador está autenticado en K+AIR (ya pasó la fase de
  datos del candidato).
- El Servicio está disponible.
- K+AIR conoce la cédula y el correo del trabajador.

### 2.2. Diagrama de secuencia

```
RH/K+AIR        Servicio         SMTP        Trabajador
   │                │              │              │
   │  1.GET /internal/acuerdo-activo│              │
   │ ──────────────▶ │              │              │
   │                │              │              │
   │  2.Acuerdo {version, texto, hash}            │
   │ ◀────────────── │              │              │
   │                │              │              │
   │  3.K+AIR muestra modal con texto del Acuerdo  │
   │ ────────────────────────────────────────────▶ │
   │                │              │              │
   │                │              │  4.Trabajador lee
   │                │              │ ◀──────────── │
   │                │              │              │
   │                │              │  5.Trabajador marca
   │                │              │   "He leído y acepto"
   │                │              │ ─────────────▶│
   │                │              │              │
   │  6.POST /internal/consentimientos (inicia)    │
   │ ──────────────▶ │              │              │
   │                │              │              │
   │  # BEGIN TRANSACTION          │              │
   │  7.Servicio crea registro en  │              │
   │    gh_consentimientos_firma   │              │
   │    estado: PENDING            │              │
   │  8.Servicio genera OTP        │              │
   │  9.Servicio hashea OTP + sal  │              │
   │  10.INSERT evento CONSENTIMIENTO_INICIADO    │
   │  # COMMIT                    │              │
   │                │              │              │
   │  11.{consent_id, otp_ttl}     │              │
   │ ◀────────────── │              │              │
   │                │              │              │
   │  12.K+AIR muestra campo OTP   │              │
   │ ────────────────────────────────────────────▶ │
   │                │              │              │
   │                │              │  13.Servicio envía OTP
   │                │ ────────────▶│              │
   │                │              │ 14.Correo al trabajador
   │                │              │ ────────────▶ │
   │                │              │              │
   │                │              │  15.Trabajador ingresa OTP
   │                │              │ ◀──────────── │
   │                │              │              │
   │  16.POST /internal/consentimientos/:id/verify-otp            │
   │ ──────────────▶ │              │              │
   │                │              │              │
   │  # BEGIN TRANSACTION          │              │
   │  17.Servicio valida OTP       │              │
   │  18.Servicio actualiza estado: ACEPTADO       │
   │  19.INSERT evento CONSENTIMIENTO_ACEPTADO    │
   │  # COMMIT                    │              │
   │                │              │              │
   │  20.{ok: true, version_aceptada}             │
   │ ◀────────────── │              │              │
   │                │              │              │
   │  21.K+AIR marca checkbox verde               │
   │ ────────────────────────────────────────────▶ │
   │                │              │              │
   │  22.RH continúa con el siguiente paso        │
   │    del pipeline (documentos del contrato)    │
```

### 2.3. Postcondiciones

- Registro en `gh_consentimientos_firma` con:
  - `manifestacion_aceptada = 1`
  - `fecha_aceptacion` poblado
  - `hash_texto_acuerdo` coincide con la versión activa
- 2 eventos insertados: `CONSENTIMIENTO_INICIADO`,
  `CONSENTIMIENTO_ACEPTADO`
- K+AIR local sincroniza `gh_consentimientos_firma_local`

### 2.4. Validaciones especiales

- Si el Acuerdo ya fue aceptado para esa versión:
  - K+AIR muestra "Ya aceptaste esta versión" y NO muestra el
    modal.
  - El endpoint `/internal/consentimientos` retorna
    `200 OK` con `{already_accepted: true}`.
- Si el Acuerdo cambió de versión desde la última aceptación:
  - K+AIR detecta y muestra el nuevo Acuerdo.

---

## 3. Flujo 2: Firma presencial

**Cuándo ocurre**: en la oficina, RH genera el documento y el
trabajador lo firma escaneando un QR.

**Duración típica**: 3-10 minutos.

### 3.1. Precondiciones

- El trabajador aceptó la versión actual del Acuerdo
  (previamente, en el pipeline).
- El documento (contrato/autorización/otro) está generado en
  K+AIR.
- El Servicio está disponible.

### 3.2. Diagrama de secuencia

```
RH/K+AIR        Servicio        base_personal   SMTP     Trabajador
   │                │                │             │            │
   │  1.RH pulsa "Enviar para firma"             │            │
   │  2.K+AIR genera PDF inmutable               │            │
   │  3.K+AIR calcula SHA-256 → doc_hash_orig    │            │
   │                │                │             │            │
   │  4.POST /internal/sign-requests (multipart) │            │
   │ ──────────────▶ │                │             │            │
   │                │                │             │            │
   │  # BEGIN TRANSACTION                       │            │
   │  5.Servicio guarda PDF original             │            │
   │  6.Servicio calcula token_hash              │            │
   │  7.INSERT gh_firmas_electronicas            │            │
   │  8.INSERT gh_firma_sesiones                 │            │
   │  9.INSERT evento CREATED                    │            │
   │  10.Servicio genera id_solicitud (SIGN-...) │            │
   │  # COMMIT                                   │            │
   │                │                │             │            │
   │  11.{id_solicitud, token, url_publica}      │            │
   │ ◀────────────── │                │             │            │
   │                │                │             │            │
   │  12.K+AIR genera QR con url_publica         │            │
   │  13.RH muestra QR en pantalla                │            │
   │                │                │             │            │
   │                │                │             │  14.Trabajador
   │                │                │             │   escanea QR
   │                │                │             │            │
   │                │  15.GET /s/{token}          │            │
   │                │ ◀───────────────────────────│            │
   │                │                │             │            │
   │  16.Servicio valida token_hash              │            │
   │  17.Servicio carga estado + sesión          │            │
   │  18.INSERT evento OPENED                    │            │
   │                │                │             │            │
   │  19.Mini-app HTML + contexto JSON           │            │
   │                │ ─────────────────────────▶ │            │
   │                │                │             │            │
   │                │                │             │  20.Pantalla
   │                │                │             │  "Ver documento"
   │                │                │             │            │
   │                │  21.GET /api/sign/{token}/document.pdf    │
   │                │ ◀───────────────────────────│            │
   │                │  22.Servicio retorna PDF    │            │
   │                │ ─────────────────────────▶ │            │
   │                │                │             │            │
   │                │                │             │  23.Trabajador
   │                │                │             │  lee y scrollea
   │                │                │             │  al final
   │                │                │             │            │
   │                │  24.POST /view-document      │            │
   │                │    {segundos:47, scroll:true}│            │
   │                │ ◀───────────────────────────│            │
   │                │                │             │            │
   │  25.INSERT evento DOCUMENT_OPENED            │            │
   │  26.INSERT evento DOCUMENT_VIEWED            │            │
   │  27.UPDATE estado: DOCUMENT_VIEWED          │            │
   │                │                │             │            │
   │  28.{ok, manifestacion_texto}               │            │
   │                │ ─────────────────────────▶ │            │
   │                │                │             │            │
   │                │                │             │  29.Pantalla
   │                │                │             │  "Manifestación"
   │                │                │             │            │
   │                │  30.POST /identify           │            │
   │                │    {tipo:"CC", num:"123..."} │            │
   │                │ ◀───────────────────────────│            │
   │                │                │             │            │
   │  31.Servicio coteja contra base_personal    │            │
   │                │ ──────────────▶│             │            │
   │  32.{coincide:true, correo:"juan@..."}       │            │
   │                │ ◀──────────────│             │            │
   │                │                │             │            │
   │  33.INSERT IDENTIFICATION_COMPLETED          │            │
   │  34.INSERT IDENTIFICATION_FAILED (si falla)  │            │
   │  35.Servicio genera OTP                      │            │
   │  36.Servicio hashea OTP + sal                │            │
   │  37.INSERT evento OTP_SENT                   │            │
   │  38.UPDATE estado: OTP_SENT                  │            │
   │                │                │             │            │
   │  39.Servicio envía correo con OTP            │            │
   │                │ ─────────────────────────▶  │            │
   │                │                │             │            │
   │  40.{ok, correo_enmascarado, otp_ttl}        │            │
   │                │ ─────────────────────────▶ │            │
   │                │                │             │            │
   │                │                │             │  41.Pantalla OTP
   │                │                │             │            │
   │                │                │             │  42.Trabajador
   │                │                │             │  abre correo
   │                │                │             │  ve código
   │                │                │             │            │
   │                │  43.POST /verify-otp         │            │
   │                │    {otp:"123456"}            │            │
   │                │ ◀───────────────────────────│            │
   │                │                │             │            │
   │  44.Servicio valida OTP                      │            │
   │  45.INSERT evento OTP_VERIFIED               │            │
   │  46.UPDATE estado: OTP_VERIFIED              │            │
   │                │                │             │            │
   │  47.{ok, siguiente_paso:"commit"}            │            │
   │                │ ─────────────────────────▶ │            │
   │                │                │             │            │
   │                │                │             │  48.Pantalla
   │                │                │             │  "Firmar"
   │                │                │             │            │
   │                │                │             │  49.Trabajador
   │                │                │             │  marca checkbox
   │                │                │             │  pulsa "Firmar"
   │                │                │             │            │
   │                │  50.POST /commit             │            │
   │                │    {manifestacion:true,      │            │
   │                │     firma_visual: "iVBOR..."}│            │
   │                │ ◀───────────────────────────│            │
   │                │                │             │            │
   │  # BEGIN TRANSACTION (CRÍTICA)              │            │
   │  51.Servicio calcula doc_hash_firmado        │            │
   │  52.Servicio construye JSON evidencia       │            │
   │  53.Servicio calcula evidence_hash          │            │
   │  54.UPDATE estado='SIGNED' WHERE             │            │
   │     estado='DOCUMENT_VIEWED'                 │            │
   │  55.Verify changes() === 1                   │            │
   │  56.Servicio genera PDF firmado              │            │
   │  57.Servicio genera Constancia PDF           │            │
   │  58.INSERT MANIFESTATION_RECORDED            │            │
   │  59.INSERT SIGN_COMMITTED                    │            │
   │  60.INSERT PDF_GENERATED                     │            │
   │  61.INSERT COPY_SENT (programado)            │            │
   │  62.Marca sync_status = SYNC_PENDING         │            │
   │  # COMMIT                                    │            │
   │                │                │             │            │
   │  63.Servicio envía correo con PDF + Const.   │            │
   │                │ ─────────────────────────▶  │            │
   │                │                │             │            │
   │  64.{ok, estado:"SIGNED", evidence_hash, ...}│            │
   │                │ ─────────────────────────▶ │            │
   │                │                │             │            │
   │                │                │             │  65.Pantalla
   │                │                │             │  "Firmado ✓"
   │                │                │             │            │
   │  66.RH ve notificación en K+AIR              │            │
   │  67.K+AIR descarga PDF firmado + Constancia  │            │
   │     (flujo de sync, ver §11)                 │            │
   │                │                │             │            │
```

### 3.3. Postcondiciones

- Estado final: `SIGNED`
- 11 eventos insertados (CREATED, OPENED, DOCUMENT_OPENED,
  DOCUMENT_VIEWED, IDENTIFICATION_COMPLETED, OTP_SENT,
  OTP_VERIFIED, MANIFESTATION_RECORDED, SIGN_COMMITTED,
  PDF_GENERATED, COPY_SENT)
- PDF firmado en `pdfs/firmados/`
- Constancia en `pdfs/constancias/`
- K+AIR local recibe sync con PDF + Constancia

### 3.4. Notas transaccionales

- **Transacción 1** (paso 4-10): crear la solicitud. Si falla,
  no se crea nada.
- **Transacción 2** (paso 50-62): **crítica**. Si falla CUALQUIER
  paso (cálculo de hash, generación de PDF, etc.), se hace
  rollback completo. El estado queda como `DOCUMENT_VIEWED` y
  el cliente puede reintentar.
- **Envío de correo** (paso 63): se hace FUERA de la
  transacción. Si falla, se inserta un evento `COPY_SENT_FAILED`
  y se reintenta en background.

---

## 4. Flujo 3: Firma remota

**Diferencias con presencial**: idéntico, excepto que en lugar de
un QR se envía un correo con el enlace.

### 4.1. Precondiciones

- Las mismas que el flujo presencial.
- `tipo_firma = 'remoto'`.
- El Acuerdo ya fue aceptado.

### 4.2. Diagrama de secuencia

```
RH/K+AIR        Servicio        base_personal   SMTP     Trabajador
   │                │                │             │            │
   │  1-11.[Igual a presencial hasta tener        │            │
   │        id_solicitud y token]                 │            │
   │                │                │             │            │
   │  12.POST /internal/sign-requests/:id/notify-remote        │
   │ ──────────────▶ │                │             │            │
   │                │                │             │            │
   │  13.Servicio envía correo al trabajador      │            │
   │                │ ─────────────────────────▶  │            │
   │                │                │             │            │
   │  14.INSERT evento NOTIFICATION_SENT          │            │
   │                │                │             │            │
   │  15.{ok, correo_enviado_a, fecha_envio}      │            │
   │ ◀────────────── │                │             │            │
   │                │                │             │            │
   │                │                │             │  16.Trabajador
   │                │                │             │  abre correo
   │                │                │             │  en su casa
   │                │                │             │            │
   │                │  17.Trabajador clickea enlace │            │
   │                │  GET /s/{token}             │            │
   │                │ ◀───────────────────────────│            │
   │                │                │             │            │
   │  18-67.[Igual a presencial desde paso 15]    │            │
```

### 4.3. Diferencias operativas

| Aspecto | Presencial | Remoto |
|---|---|---|
| TTL del token | 24 horas | 72 horas |
| Reenvío (recordatorio) | No aplica | Cada 24h, máx 3 |
| Visualización del QR | En pantalla de K+AIR | En el correo |
| `tipo_firma` en BD | `'presencial'` | `'remoto'` |

El **resto del flujo es bit-by-bit idéntico**. Esto es
deliberado: una sola arquitectura, dos canales de entrega.

---

## 5. Flujo 4: Rechazo explícito

**Cuándo ocurre**: el trabajador decide NO firmar el documento
porque no está de acuerdo con algo.

### 5.1. Precondiciones

- El trabajador está autenticado (OTP validado, documento
  abierto o visto).
- Estado actual ∈ {`DOCUMENT_OPENED`, `DOCUMENT_VIEWED`,
  `OTP_VERIFIED`}.

### 5.2. Diagrama de secuencia

```
Trabajador        Servicio            K+AIR (al recibir sync)
   │                │                          │
   │  1.Trabajador pulsa "Rechazar"            │
   │  2.Trabajador escribe motivo (opcional)    │
   │  3.Trabajador confirma                    │
   │                │                          │
   │  4.POST /api/sign/{token}/reject          │
   │    {motivo:"..."}                         │
   │ ─────────────▶ │                          │
   │                │                          │
   │  # BEGIN TRANSACTION                      │
   │  5.Servicio valida estado                 │
   │  6.UPDATE estado='REJECTED'               │
   │  7.INSERT evento REJECTED con motivo      │
   │  # COMMIT                                 │
   │                │                          │
   │  8.{ok, estado:"REJECTED"}                │
   │ ◀───────────── │                          │
   │                │                          │
   │  9.Mini-app muestra "Rechazado"           │
   │                │                          │
   │                │  10.Próximo sync de K+AIR│
   │                │ ────────────────────────▶│
   │                │                          │
   │                │  11.K+AIR ve estado=REJECTED
   │                │  12.RH recibe notificación
   │                │  🔴 Documento rechazado   │
   │                │     por el trabajador    │
   │                │     "No estoy de acuerdo │
   │                │      con la cláusula X"  │
```

### 5.3. Postcondiciones

- Estado final: `REJECTED`
- 1 evento nuevo: `REJECTED` con metadata `{motivo}`
- El token ya no se puede usar (estado terminal)
- K+AIR puede crear una **nueva solicitud** si RH decide
  continuar (con documento modificado, si aplica)

### 5.4. Diferencia con "no firmó"

- **"No firmó"** = el token expiró o el trabajador nunca llegó al
  final. Estado: `EXPIRED`.
- **"Rechazó"** = decisión explícita. Estado: `REJECTED`.

RH debe ver el ícono 🔴 Documento rechazado (con motivo) — es
diferente de "Documento sin firmar" (ícono amarillo).

---

## 6. Flujo 5: Revocación por RH

**Cuándo ocurre**: RH decide cancelar la solicitud (ej. el
documento cambió, hay que rehacer).

### 6.1. Precondiciones

- Estado actual NO es terminal (es decir, no está en
  `SIGNED`, `REJECTED`, `EXPIRED`, `REVOKED`, `CANCELLED`).

### 6.2. Diagrama de secuencia

```
RH/K+AIR         Servicio        Trabajador (si tenía sesión abierta)
   │                │                          │
   │  1.RH abre detalle de solicitud          │
   │  2.RH pulsa "Revocar"                    │
   │  3.RH escribe motivo (requerido)         │
   │  4.RH confirma                           │
   │                │                          │
   │  5.POST /internal/sign-requests/:id/revoke│
   │    {motivo:"..."}                         │
   │ ─────────────▶ │                          │
   │                │                          │
   │  # BEGIN TRANSACTION                      │
   │  6.Servicio valida estado                 │
   │  7.UPDATE estado='REVOKED'                │
   │  8.INSERT evento REVOKED                  │
   │     {motivo, rh_user_id}                  │
   │  # COMMIT                                 │
   │                │                          │
   │  9.{ok, estado:"REVOKED"}                 │
   │ ◀───────────── │                          │
   │                │                          │
   │  10.K+AIR marca como revocada            │
   │  11.Si la sesión del trabajador está abierta:│
   │     (próxima request del trabajador → 410)│
   │                │                          │
   │                │ ─── 410 Gone ──────────▶ │
   │                │ "Esta solicitud fue     │
   │                │  revocada por la empresa"│
```

### 6.3. Postcondiciones

- Estado final: `REVOKED`
- 1 evento nuevo: `REVOKED`
- Si el trabajador tenía la mini-app abierta, la próxima request
  retorna `410 Gone`
- RH puede crear una **nueva solicitud** desde K+AIR

### 6.4. Nota

La revocación es siempre por RH, nunca automática. Si el documento
cambia, RH debe:
1. Revocar la solicitud actual.
2. Crear una nueva solicitud con el documento actualizado.

Nunca se modifica una solicitud existente.

---

## 7. Flujo 6: Expiración (job automático)

**Cuándo ocurre**: cuando un token pasa su `fecha_expiracion`
sin completarse. Lo dispara un job automático cada 5 minutos.

### 7.1. Precondiciones

- Hay solicitudes con `fecha_expiracion < now()`.
- Estado actual ∈ estados de sesión (no terminales).

### 7.2. Diagrama de secuencia

```
Job (cron 5min)        Servicio
   │                     │
   │  1.Job se activa    │
   │  2.Servicio busca   │
   │    solicitudes      │
   │    expiradas        │
   │                     │
   │  3.SELECT * FROM    │
   │    gh_firmas_       │
   │    electronicas     │
   │    WHERE estado     │
   │    IN (sesión)      │
   │    AND fecha_       │
   │    expiracion < now │
   │                     │
   │  4.Para cada una:   │
   │  # BEGIN TRANS      │
   │  5.UPDATE estado=   │
   │    'EXPIRED'        │
   │  6.INSERT evento    │
   │    EXPIRED          │
   │  7.INSERT evento    │
   │    NOTIFICATION_    │
   │    SENT (a RH)      │
   │  # COMMIT           │
   │                     │
   │  8.Job termina      │
```

### 7.3. Postcondiciones

- Las solicitudes afectadas quedan en estado `EXPIRED`
- 1 evento `EXPIRED` por cada una
- RH recibe notificación: "Solicitud SIGN-2026-000123 expiró sin
  firma"

---

## 8. Flujo 7: Identificación fallida

**Cuándo ocurre**: la cédula ingresada por el trabajador no
coincide con la registrada en `base_personal`.

### 8.1. Diagrama de secuencia

```
Trabajador       Servicio        base_personal
   │                │                │
   │  1.Trabajador ingresa cédula    │
   │  2.POST /identify               │
   │ ─────────────▶ │                │
   │                │                │
   │                │  3.Coteja      │
   │                │ ──────────────▶│
   │                │                │
   │                │  4.{coincide:  │
   │                │    false}      │
   │                │ ◀──────────────│
   │                │                │
   │  5.UPDATE estado=               │
   │    'IDENTIFICATION_FAILED'      │
   │  6.INSERT evento                │
   │    IDENTIFICATION_FAILED        │
   │  7.INSERT evento                │
   │    IDENTIFICATION_STARTED       │
   │  (en próxima request)           │
   │                │                │
   │  8.{422, IDENTIFICATION_FAILED, │
   │    intentos_restantes: 3}       │
   │ ◀───────────── │                │
   │                │                │
   │  9.Mini-app muestra error       │
   │  "La identificación no coincide"│
   │  Ofrece reintentar              │
```

### 8.2. Política de reintentos

- 3 reintentos permitidos por sesión.
- Después de 3 fallos: estado `IDENTIFICATION_FAILED` permanente.
- RH recibe notificación y debe contactar al trabajador por otro
  canal.

---

## 9. Flujo 8: OTP bloqueado

**Cuándo ocurre**: el trabajador ingresa OTP incorrecto 5 veces.

### 9.1. Diagrama de secuencia

```
Trabajador       Servicio
   │                │
   │  1.5 intentos incorrectos       │
   │  (cada uno:                     │
   │    POST /verify-otp → 422)      │
   │                │                │
   │  # BEGIN TRANS                 │
   │  2.UPDATE estado='OTP_LOCKED'   │
   │  3.UPDATE otp_bloqueado=1       │
   │  4.INSERT evento OTP_LOCKED     │
   │  # COMMIT                      │
   │                │                │
   │  5.{422, OTP_LOCKED}            │
   │ ◀───────────── │                │
   │                │                │
   │  6.Mini-app muestra "Demasiados│
   │    intentos. Contacta a RRHH."  │
   │                │                │
   │  7.RH debe generar una nueva   │
   │    solicitud (revocar la actual│
   │    + crear nueva con TTL reset)│
```

### 9.2. Postcondiciones

- Estado final: `OTP_LOCKED` (terminal)
- La solicitud actual NO se puede reusar
- RH debe revocar y crear una nueva

---

## 10. Flujo 9: Verificación posterior

**Cuándo ocurre**: cualquier persona (trabajador, abogado, juez,
auditor) quiere verificar la autenticidad de una firma.

### 10.1. Diagrama de secuencia

```
Verificador     Servicio (público)
   │                │
   │  1.Tiene el PDF firmado y la  │
   │    Constancia.                │
   │  2.Extrae el JSON de la       │
   │    Constancia.                │
   │  3.Calcula SHA-256 del PDF.   │
   │  4.Compara con document_hash_ │
   │    firmado en la Constancia.  │
   │  5.Si coincide → íntegro.     │
   │                │
   │  6.Opcionalmente:             │
   │    GET /verificar/:id_solicitud│
   │    (endpoint público futuro)   │
   │ ─────────────▶ │                │
   │                │                │
   │  7.Servicio retorna metadata  │
   │    pública: fecha, estado,    │
   │    hashes (NO datos sensibles)│
   │ ◀───────────── │                │
```

### 10.2. Verificación sin servicio (offline)

Si el Servicio está caído, cualquiera puede verificar:

1. Tomar el PDF firmado.
2. Calcular `SHA-256(bytes)`.
3. Comparar con `document_hash_firmado` que está **impreso en la
   Constancia**.
4. Si coincide: la firma es íntegra.

### 10.3. Verificación profunda (con servicio)

1. La Constancia tiene el `evidence_hash` calculado sobre JSON
   canónico.
2. Si el Servicio está disponible, se puede pedir
   `GET /verificar/SIGN-2026-000123` y el Servicio reconstruye
   la evidencia, recalcula el hash y compara.

---

## 11. Flujo 10: Sincronización K+AIR ← Servicio

**Cuándo ocurre**: K+AIR descarga PDFs firmados y constancias
desde el Servicio.

### 11.1. Diagrama de secuencia

```
K+AIR local              Servicio
   │                        │
   │  1.K+AIR hace poll de  │
   │    solicitudes con     │
   │    sync_status=        │
   │    SYNC_PENDING        │
   │                        │
   │  2.GET /internal/      │
   │    sign-requests?      │
   │    sync_status=        │
   │    SYNC_PENDING        │
   │ ─────────────────────▶ │
   │                        │
   │  3.[{id_solicitud,     │
   │    tipo, ...}, ...]    │
   │ ◀───────────────────── │
   │                        │
   │  4.Para cada una:      │
   │                        │
   │  5.GET /internal/      │
   │    sign-requests/:id/  │
   │    pdf-firmado         │
   │ ─────────────────────▶ │
   │                        │
   │  6.PDF bytes           │
   │ ◀───────────────────── │
   │                        │
   │  7.K+AIR guarda en     │
   │    <kair-data>/gh-docs/│
   │    <empresa>/          │
   │    <id_solicitud>-     │
   │    firmado.pdf         │
   │                        │
   │  8.GET /internal/      │
   │    sign-requests/:id/  │
   │    constancia          │
   │ ─────────────────────▶ │
   │                        │
   │  9.Constancia bytes    │
   │ ◀───────────────────── │
   │                        │
   │  10.K+AIR guarda en    │
   │    <kair-data>/gh-docs/│
   │    <empresa>/          │
   │    <id_solicitud>-     │
   │    constancia.pdf      │
   │                        │
   │  11.GET /internal/     │
   │     sign-requests/:id/ │
   │     eventos            │
   │ ─────────────────────▶ │
   │                        │
   │  12.[eventos]          │
   │ ◀───────────────────── │
   │                        │
   │  13.K+AIR inserta en   │
   │     gh_firma_eventos_  │
   │     local              │
   │                        │
   │  14.UPDATE gh_firmas_  │
   │     electronicas_local │
   │     SET sync_status=   │
   │     'SYNCED',          │
   │     sync_fecha=now,    │
   │     pdf_local_path=...,│
   │     constancia_local_  │
   │     path=...           │
   │                        │
```

### 11.2. Cuándo se ejecuta el sync

- **Pull al abrir la sección de Documentos** en K+AIR.
- **Pull cada 5 minutos** mientras K+AIR está abierto (background).
- **Push manual** con botón "Refrescar".

### 11.3. Manejo de errores de sync

- Si la descarga falla: `sync_status = FAILED`, `sync_fecha` se
  actualiza, se reintenta en el próximo poll.
- Tras 3 fallos consecutivos: K+AIR muestra warning al RH.

---

## 12. Matriz resumen de flujos

| # | Flujo | Iniciador | Estado final | Eventos clave | Frecuencia típica |
|---|---|---|---|---|---|
| 1 | Aceptación Acuerdo | RH en pipeline | `ACEPTADO` | CONSENTIMIENTO_* | 1 vez por versión |
| 2 | Firma presencial | RH | `SIGNED` | 11 eventos | 1-3 min |
| 3 | Firma remota | RH | `SIGNED` | 12 eventos (incl. NOTIFICATION_SENT) | 5 min - 72h |
| 4 | Rechazo | Trabajador | `REJECTED` | REJECTED | <1 min |
| 5 | Revocación RH | RH | `REVOKED` | REVOKED | <1 min |
| 6 | Expiración | Job (auto) | `EXPIRED` | EXPIRED | Cada 5 min |
| 7 | Identificación fallida | Trabajador | `IDENTIFICATION_FAILED` | IDENTIFICATION_FAILED | <1 min |
| 8 | OTP bloqueado | Trabajador | `OTP_LOCKED` | OTP_LOCKED | <5 min |
| 9 | Verificación posterior | Tercero | (no cambia) | (consulta) | Bajo demanda |
| 10 | Sync K+AIR ← Servicio | K+AIR | (no cambia) | SYNC_COMPLETED | Cada 5 min |

### Estados terminales

```
SIGNED ──────► éxito (firma completada)
REJECTED ────► rechazo explícito
EXPIRED ─────► TTL vencido sin completar
REVOKED ─────► cancelado por RH
CANCELLED ───► cancelado por RH antes de apertura
OTP_LOCKED ──► 5 intentos de OTP fallidos
IDENTIFICATION_FAILED ─► 3 intentos de cédula fallidos
```

### Transiciones válidas

```
PENDING ──► OPENED ──► IDENTIFIED ──► OTP_SENT ──► OTP_VERIFIED
                                                          │
                                                          ▼
                                                 DOCUMENT_VIEWED
                                                          │
                                                          ▼
                                            MANIFESTATION_RECORDED
                                                          │
                                                          ▼
                                                       SIGNED ✓
                                                          │
                                                          ▼
                                                       (terminal)

Cualquier estado de sesión ──► EXPIRED (job)
Cualquier estado de sesión ──► REVOKED (RH)
DOCUMENT_OPENED/VIEWED ──► REJECTED (trabajador)
IDENTIFICATION_STARTED ──► IDENTIFICATION_FAILED (3 intentos)
OTP_SENT ──► OTP_LOCKED (5 intentos)
```

---

**Fin del documento.**

Próximo: `SECURITY.md` (análisis de amenazas detallado) y
`LEGAL.md` (marco normativo expandido y consideraciones
jurídicas).

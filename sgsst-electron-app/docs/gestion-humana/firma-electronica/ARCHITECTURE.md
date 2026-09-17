# Firma Electrónica K+AIR v1 — Arquitectura

**Versión del documento**: 0.1 (borrador de diseño)
**Fecha**: 2026-08-17
**Estado**: Borrador para revisión. Pendiente de validación con el usuario y de revisión jurídica externa.
**Autor**: K+AIR (Mavis)
**Audiencia**: equipo de desarrollo, líder técnico, abogado laboral colombiano (revisión)

> **Aviso legal (importante — leer antes de continuar)**
>
> Este documento describe una arquitectura **diseñada conforme al marco
> normativo aplicable** a la firma electrónica de relaciones laborales en
> Colombia: Ley 527 de 1999, Decreto 2364 de 2012, Decreto 526 de 2021 y
> Decreto 1072 de 2015 (arts. 2.2.1.1.8 a 2.2.1.1.13).
>
> **Este documento NO constituye asesoría jurídica.** La validación
> definitiva del mecanismo completo —incluyendo el texto del Acuerdo de uso
> de firma electrónica y del modelo de consentimiento— debe realizarla un
> **profesional jurídico colombiano** antes de poner el sistema en
> producción con trabajadores reales.
>
> Cada vez que en este documento aparece la expresión "cumple" o
> "satisfactorio", debe leerse como: **"diseñado para alinearse con el
> requisito normativo X. Pendiente de validación jurídica."**

---

## Tabla de contenidos

- [PARTE I — Visión y alcance](#parte-i--visión-y-alcance)
  - 1. [Objetivo](#1-objetivo)
  - 2. [Alcance de v1](#2-alcance-de-v1)
  - 3. [Fuera de v1 (deliberadamente)](#3-fuera-de-v1-deliberadamente)
  - 4. [Decisiones congeladas](#4-decisiones-congeladas)
- [PARTE II — Marco y conceptos](#parte-ii--marco-y-conceptos)
  - 5. [Marco normativo](#5-marco-normativo)
  - 6. [Concepto de firma electrónica K+AIR](#6-concepto-de-firma-electrónica-kair)
  - 7. [Protección de datos personales](#7-protección-de-datos-personales)
- [PARTE III — Protocolo de firma](#parte-iii--protocolo-de-firma)
  - 8. [Flujo presencial](#8-flujo-presencial)
  - 9. [Flujo remoto](#9-flujo-remoto)
  - 10. [Acuerdo de uso de firma electrónica](#10-acuerdo-de-uso-de-firma-electrónica)
  - 11. [Autenticación: cédula + OTP](#11-autenticación-cédula--otp)
  - 12. [QR y tokens](#12-qr-y-tokens)
  - 13. [Estados de SIGN_REQUEST](#13-estados-de-sign_request)
  - 14. [Integridad: SHA-256](#14-integridad-sha-256)
  - 15. [Constancia de firma electrónica](#15-constancia-de-firma-electrónica)
- [PARTE IV — Arquitectura técnica](#parte-iv--arquitectura-técnica)
  - 16. [Arquitectura global](#16-arquitectura-global)
  - 17. [Servicio de firma (Express)](#17-servicio-de-firma-express)
  - 18. [Mini-app pública de firma](#18-mini-app-pública-de-firma)
  - 19. [Comunicación K+AIR ↔ Servicio](#19-comunicación-kair--servicio)
  - 20. [Almacenamiento](#20-almacenamiento)
  - 21. [Evidencias y trazabilidad (eventos)](#21-evidencias-y-trazabilidad-eventos)
  - 22. [Seguridad](#22-seguridad)
- [PARTE V — Evolución y cierre](#parte-v--evolución-y-cierre)
  - 23. [Evolución futura (post-v1)](#23-evolución-futura-post-v1)
  - 24. [Validación jurídica pendiente](#24-validación-jurídica-pendiente)

---

## Glosario rápido

| Término | Definición operativa |
|---|---|
| **Firma electrónica K+AIR** | Mecanismo de firma de documentos laborales compuesto por: identificación (cédula) + autenticación (OTP al correo) + manifestación de voluntad (acto explícito) + integridad (SHA-256) + trazabilidad (eventos). |
| **Acuerdo de uso** | Documento legal que el trabajador acepta una vez (versionado) para usar el mecanismo de firma electrónica. NO es un contrato laboral. |
| **Manifestación de voluntad** | Acto explícito por el cual el trabajador afirma estar de acuerdo con el contenido de un documento específico. Se registra por documento. |
| **SIGN_REQUEST** | Solicitud de firma de un documento concreto. Tiene token, hash, estados y eventos asociados. |
| **Constancia de firma** | Documento PDF que registra las evidencias de una firma completada. NO es un "certificado digital". |
| **Servicio de firma** | Backend Express independiente que gestiona el ciclo de vida de SIGN_REQUEST. NO forma parte de K+AIR Electron. |
| **Mini-app** | Aplicación web estática (HTML+JS) servida por el Servicio de firma. Es la única界面 que ve el trabajador. |
| **Token** | Cadena aleatoria ≥32 caracteres que identifica un SIGN_REQUEST. Se almacena únicamente como `token_hash` (SHA-256). |
| **OTP** | Código de 6 dígitos de un solo uso, enviado al correo del trabajador, con expiración ≤10 min y máximo 5 intentos. |
| **Notario digital** | Rol funcional del Servicio de firma: fuente de verdad para verificación, NO archivo de la empresa. |

---

# PARTE I — Visión y alcance

## 1. Objetivo

Permitir que K+AIR gestione la firma electrónica de documentos laborales
(contratos, actualizaciones, autorizaciones, etc.) sin impresión, sin
papel, y sin que el trabajador necesite crear una cuenta, instalar una
app, ni visitar un portal permanente.

El mecanismo debe:

1. Generar evidencia robusta y verificable por terceros.
2. Garantizar la integridad del documento firmado (no modificable a
   posteriori sin dejar huella).
3. Identificar al firmante con certeza razonable (cédula + OTP al
   correo).
4. Registrar la voluntad del trabajador de manera explícita.
5. Operar tanto en modalidad presencial (oficina, con QR) como remota
   (casa, con enlace por correo).
6. **Diseñarse conforme al marco normativo colombiano aplicable** a la
   firma electrónica de relaciones laborales, sujeto a validación
   jurídica externa antes de producción.

## 2. Alcance de v1

**v1 incluye:**

- Firma de documentos laborales generados por K+AIR (contratos,
  actualizaciones, autorizaciones, otrosí).
- Modalidad presencial (QR en oficina).
- Modalidad remota (enlace por correo).
- OTP al correo electrónico (único canal en v1).
- Mini-app web pública compatible con navegadores modernos (Chrome,
  Edge, Firefox, Safari actualizados).
- Servicio de firma Express desplegable en VPS.
- Acuerdo de uso versionado, con aceptación única por versión.
- Manifestación de voluntad por documento, con texto fijo.
- Constancia de firma electrónica en PDF.
- Trazabilidad completa mediante tabla de eventos.
- Almacenamiento híbrido: VPS como notario + K+AIR local como expediente.

## 3. Fuera de v1 (deliberadamente)

Estos elementos **NO forman parte de v1**. Su inclusión debe esperar
una iteración posterior con análisis específico.

- ❌ SMS como canal de OTP.
- ❌ WhatsApp como canal de OTP o notificación.
- ❌ PWA instalable.
- ❌ Portal permanente del trabajador.
- ❌ Aplicación móvil nativa (iOS, Android).
- ❌ Cuenta de usuario del trabajador en K+AIR.
- ❌ Integración con proveedores externos de firma (DocuSign, Adobe
  Sign, etc.).
- ❌ Firma digital criptográfica basada en certificado (PKI/X.509).
- ❌ Firma visual manuscrita (canvas) **como mecanismo principal** —
  puede existir como dato complementario opcional, pero no es la base
  legal de la firma.
- ❌ Biometría (huella, facial).
- ❌ Firma masiva / por lotes.
- ❌ Multi-idioma.
- ❌ Flujos de aprobación previos a la firma (cadenas de
  autorización).
- ❌ Notificaciones push o recordatorios automáticos.

> **Regla de proyecto**: cuando alguien —incluido nosotros mismos—
> proponga agregar algo de esta lista durante el desarrollo de v1, la
> respuesta es: **"No. Está fuera del alcance de v1."** Esto evita que
> un proyecto de 2 semanas se convierta en un ERP de RRHH de 14 meses.

## 4. Decisiones congeladas

Esta sección es **inmutable** durante el desarrollo de v1. Cualquier
cambio debe pasar por una revisión explícita del documento completo.

### Concepto y alcance

- ✅ K+AIR ofrece **firma electrónica**, no firma digital. La expresión
  "firma digital" se reserva para mecanismos criptográficos con
  certificado.
- ✅ El trabajador **NO tendrá cuenta K+AIR** ni credenciales
  permanentes. Su identidad se valida caso por caso con cédula + OTP.
- ✅ **NO habrá portal permanente del trabajador**, ni PWA, ni app
  móvil. La única界面 es la mini-app efímera servida por el Servicio
  de firma.
- ✅ El **QR contiene únicamente el token temporal** de la solicitud,
  nunca el documento ni datos sensibles.

### Seguridad del token

- ✅ El token es una cadena aleatoria de **≥32 caracteres**.
- ✅ En la base de datos **se almacena únicamente `token_hash`
  (SHA-256)**. El token original nunca se persiste en texto plano.
- ✅ El token es de **un solo uso**: una vez consumido (SIGNED,
  REJECTED, EXPIRED, REVOKED) ya no permite nuevas operaciones.

### Autenticación

- ✅ La autenticación inicial es **OTP al correo electrónico** del
  trabajador.
- ✅ El OTP **NO constituye por sí solo la firma electrónica**. Es uno
  de los componentes; la firma es el conjunto (identificación +
  autenticación + voluntad + integridad + trazabilidad).
- ✅ La arquitectura **debe permitir** agregar SMS o WhatsApp como
  canales alternativos en el futuro, mediante un campo
  `verification_channel` en la BD. **No se implementan en v1**.

### Consentimiento

- ✅ El **Acuerdo de uso de firma electrónica se acepta una vez por
  versión**. Si el texto del Acuerdo cambia, los nuevos firmantes
  aceptan la nueva versión; los anteriores conservan la versión que
  firmaron.
- ✅ La **manifestación de voluntad se registra por documento**, no de
  forma genérica.

### Documento e integridad

- ✅ El documento se **congela** (snapshot inmutable en PDF) antes de
  generar la solicitud de firma.
- ✅ Se calcula **SHA-256** sobre el PDF congelado y se almacena como
  `document_hash_original`.
- ✅ Al cerrar la firma se calcula también
  `document_hash_firmado` y `evidence_hash`. La verificación compara
  `document_hash_original` con el hash del PDF firmado: si difieren,
  la firma es inválida.
- ✅ **Una solicitud firmada NO puede modificarse**. Si RH edita el
  documento, debe crear una **nueva solicitud**, no modificar la
  existente.

### Trazabilidad

- ✅ Existe **trazabilidad completa mediante eventos** (tabla
  `gh_firma_eventos`).
- ✅ Existe **rechazo explícito** (estado `REJECTED`), distinto de
  "no firmó".
- ✅ Existe **expiración** (estado `EXPIRED`) y **revocación** (estado
  `REVOKED`).
- ✅ Una solicitud puede recibir **múltiples intentos de envío**
  (recordatorios) sin crear nuevas solicitudes; cada intento queda
  registrado como evento.

### Despliegue

- ✅ El **Servicio de firma es independiente** de K+AIR Electron.
  K+AIR consume sus APIs por HTTP; el Servicio no tiene acceso a la
  base de datos local de K+AIR.
- ✅ **ngrok se usa únicamente en desarrollo y pruebas**. En
  producción se usa **HTTPS con dominio público** (ej.
  `https://firma.k-air.com`).
- ✅ **Una sola URL pública** sirve para presencial y remoto. El QR es
  un atajo; el enlace por correo es la misma URL con el mismo token.

### Exclusiones de v1

- ✅ SMS, WhatsApp, biometría, PWA, portal del trabajador, app móvil,
  cuenta del trabajador, firma digital criptográfica, integración con
  DocuSign/Adobe Sign: **fuera de v1**.

---

# PARTE II — Marco y conceptos

## 5. Marco normativo

K+AIR Firma Electrónica v1 está **diseñada para alinearse** con el
siguiente marco normativo colombiano. **No se afirma que cumple** con
ninguna norma en particular; se documenta el requisito que cada norma
impone y cómo la arquitectura intenta satisfacerlo. La validación
jurídica definitiva se trata en la sección 24.

| Norma | Requisito | Cómo lo aborda la arquitectura |
|---|---|---|
| **Ley 527 de 1999** (arts. 6, 7, 28) | Reconocimiento legal de los mensajes de datos y la firma electrónica cuando hay consentimiento y se puede verificar identidad e integridad. | Identificación por cédula + OTP + SHA-256 + consentimiento (Acuerdo). |
| **Decreto 2364 de 2012** (art. 4) | Criterios de la firma electrónica: identificabilidad del signatario, integridad del documento, confiabilidad del mecanismo. | Cédula + hash + eventos inmutables + Acuerdo versionado. |
| **Decreto 1072 de 2015** (art. 2.2.1.1.8) | El contrato de trabajo puede firmarse electrónicamente. | Diseño aplica a cualquier documento laboral, contrato incluido. |
| **Decreto 1072 de 2015** (art. 2.2.1.1.10) | La firma puede materializarse mediante códigos, contraseñas, datos biométricos o claves criptográficas, siempre que identifique a la persona y sea confiable. | OTP al correo + cédula + manifestación de voluntad. |
| **Decreto 1072 de 2015** (art. 2.2.1.1.11) | El empleador debe proporcionar medios para firma electrónica, sin trasladarle el costo al trabajador. | K+AIR provee el servicio; el costo es del empleador. La mini-app es gratuita para el trabajador. |
| **Decreto 1072 de 2015** (art. 2.2.1.1.12) | Conservación con autenticidad, integridad y disponibilidad; suministrar copia al trabajador. | PDF congelado en VPS + copia descargada por K+AIR local + copia enviada al trabajador por correo. |
| **Decreto 526 de 2021** (adiciona al 1072) | Regula la firma electrónica del contrato laboral. Puede ser por cualquiera de las partes o ambas. | El diseño soporta firma por parte del trabajador; el empleador firma con su cuenta K+AIR local. |
| **Ley 1581 de 2012** y decretos reglamentarios | Protección de datos personales. | Ver sección 7. |

> **Nota sobre la Ley 2121 de 2021** (trabajo remoto): se cita únicamente
> como referencia complementaria porque introduce el concepto de OTP en
> ese contexto específico. **No es la columna vertebral** del diseño.

## 6. Concepto de firma electrónica K+AIR

### 6.1. Definición operativa

Una firma electrónica K+AIR es la **combinación verificable** de:

1. **Identificación**: la persona que firma declara su tipo y número de
   documento de identidad, que el sistema coteja contra la base de
   `base_personal`.
2. **Autenticación**: la persona recibe un código OTP en su correo
   electrónico registrado y lo ingresa en la mini-app.
3. **Manifestación de voluntad**: la persona lee el documento (o al
   menos la vista previa), y realiza un acto explícito (botón
   "Firmar") que incluye una declaración del estilo: *"Declaro que
   he leído, comprendido y acepto el contenido del documento"*.
4. **Integridad**: el sistema calcula `document_hash_firmado`
   (SHA-256) y lo compara con `document_hash_original`. Si difieren,
   la firma se rechaza.
5. **Trazabilidad**: cada paso del proceso queda registrado como
   evento inmutable con timestamp, IP, user-agent y metadata.

### 6.2. Lo que K+AIR NO es

- ❌ **NO es firma digital** criptográfica con certificado (PKI/X.509).
  Si en el futuro se requiere, será un proyecto distinto.
- ❌ **NO es firma manuscrita** (canvas). La representación visual de
  la firma puede existir como dato complementario opcional, pero
  **no es la base legal** de la firma.
- ❌ **NO es equivalente a un OTP aislado**. Un OTP por sí solo
  autentica, pero no constituye firma electrónica.
- ❌ **NO es firma con sello de tiempo emitido por autoridad de
  certificación**. La timestamping actual se hace con el reloj del
  Servicio de firma; si se requiere TSA, será iteración futura.

### 6.3. Comparación con alternativas

| Solución | K+AIR Firma Electrónica v1 | Firma digital con certificado | Firma manuscrita en papel |
|---|---|---|---|
| Base legal | Ley 527 + Decretos | Ley 527 + Estatuto certificación | Código Civil / Código Sustantivo del Trabajo |
| Costo operativo | Bajo (VPS pequeño) | Alto (renovación anual de certificados) | Muy alto (papel, impresión, archivo físico) |
| Requiere cuenta del trabajador | No | Depende del proveedor | No |
| Verificable por terceros | Sí (mediante Constancia) | Sí (mediante certificado) | Difícil |
| Validez probatoria | Media-alta (sujeta a validación jurídica) | Alta | Alta (con autenticación notarial) |
| Aplica a v1 | ✅ | ❌ | ❌ |

## 7. Protección de datos personales

K+AIR almacena y trata datos personales del firmante (cédula, correo,
IP, user-agent, metadata de firma). El diseño debe alinearse con la
**Ley 1581 de 2012** y sus decretos reglamentarios. Esto **NO es
opcional**.

### 7.1. Finalidad declarada

Los datos personales almacenados por el Servicio de firma se utilizan
**únicamente** para:

- Generar evidencia de la firma electrónica.
- Permitir auditoría posterior por parte del empleador, autoridades
  judiciales o el propio trabajador.
- Cumplir obligaciones legales de conservación documental laboral.

### 7.2. Base de datos y minimización

- Se almacena **lo mínimo necesario**: cédula (tipo + número), correo,
  IP, user-agent, timestamps, hashes.
- **No se almacena** la cédula en texto plano si el sistema puede
  trabajar con su hash para operaciones de cotejo (decisión de
  implementación, ver `DATA_MODEL.md`).
- El token original **nunca** se almacena; solo su hash.
- El OTP original **nunca** se almacena; solo su hash (con sal).

### 7.3. Conservación y eliminación

- Las solicitudes de firma y sus eventos se conservan durante **el
  mismo plazo que el documento laboral firmado** (mínimo 10 años
  según normativa laboral colombiana, pendiente validar plazo exacto
  con abogado).
- Pasado el plazo, el sistema debe permitir **eliminación
  verificable** (borrado seguro de archivos + anonimización de
  metadata que no deba conservarse).

### 7.4. Acceso

- El Servicio de firma expone APIs internas (autenticadas con API key
  rotada) para que K+AIR local consulte el estado de las solicitudes.
- **No expone** endpoints públicos de listado de firmas; solo el
  endpoint `/sign/:token` que recibe el token como bearer.
- El trabajador puede solicitar copia de la Constancia y de sus datos
  asociados (derecho de acceso, Art. 17 Decreto 1377 de 2013).

### 7.5. Seguridad técnica

- HTTPS obligatorio en producción.
- Hashes con SHA-256 (no MD5/SHA-1).
- OTP con sal + hash (no en texto plano).
- Ver sección 22 para el detalle de seguridad.

---

# PARTE III — Protocolo de firma

## 8. Flujo presencial

Ocurre en la oficina. RH genera el documento, lo congela, crea la
solicitud y muestra un QR al trabajador. El trabajador escanea con su
teléfono y firma desde ahí (no necesita instalar nada).

```
RH (escritorio K+AIR)
        │
        │ 1. Genera documento (contrato / actualización / autorización)
        │
        │ 2. K+AIR congela el documento en PDF
        │    └─ Calcula SHA-256 → document_hash_original
        │
        │ 3. K+AIR llama POST /sign-requests al Servicio de firma
        │    Body: { id_documento, id_trabajador, id_empresa,
        │            document_hash_original, ttl }
        │    Response: { id_solicitud, token, url_publica, qr_payload }
        │
        │ 4. K+AIR muestra QR en pantalla
        │    QR contiene: https://firma.k-air.com/s/{token}
        │
        ▼
Trabajador (teléfono)
        │
        │ 5. Escanea QR → abre la mini-app
        │
        │ 6. Mini-app carga la pantalla "Ver documento"
        │    GET /sign/{token} → estado, metadata, URL del PDF
        │
        │ 7. Trabajador lee el documento (scroll hasta el final)
        │    Evento: DOCUMENT_VIEWED
        │
        │ 8. Trabajador ingresa tipo + número de cédula
        │    Evento: IDENTIFICATION_COMPLETED
        │
        │ 9. Sistema envía OTP al correo del trabajador
        │    Evento: OTP_SENT
        │
        │ 10. Trabajador ingresa OTP
        │     Evento: OTP_VERIFIED (o OTP_FAILED)
        │
        │ 11. Trabajador marca checkbox + presiona "Firmar"
        │     Evento: MANIFESTATION_RECORDED
        │
        │ 12. POST /sign/{token}/commit
        │     Backend: valida estado, calcula document_hash_firmado,
        │     calcula evidence_hash, persiste, genera PDF firmado,
        │     genera Constancia, marca SIGNED
        │     Eventos: SIGN_COMMITTED, PDF_GENERATED, COPY_SENT
        │
        ▼
Mini-app muestra confirmación
"Documento firmado. Revisa tu correo para descargar la copia."
```

## 9. Flujo remoto

Idéntico al presencial, excepto que el paso 4 es un enlace por
correo en lugar de un QR. El resto del flujo (5-12) es **exactamente
el mismo**. Esto es deliberado: una sola arquitectura para ambos
escenarios.

```
RH (escritorio K+AIR)
        │
        │ 1-3. [Igual al presencial]
        │
        │ 4'. K+AIR llama POST /sign-requests/{id}/notify-remote
        │     El Servicio envía correo al trabajador:
        │     Asunto: "Tienes un documento para firmar en K+AIR"
        │     Cuerpo: enlace directo https://firma.k-air.com/s/{token}
        │     Evento: NOTIFICATION_SENT
        │
        ▼
Trabajador (casa / móvil)
        │
        │ 5'. Abre el correo → toca el enlace
        │
        │ 6'-12'. [Igual al presencial, pasos 6-12]
        │
        ▼
[Igual al presencial desde paso 12]
```

**Razón de usar la misma URL**: la mini-app, el backend, el
protocolo y la evidencia son idénticos. Cambiar el canal de entrega
(presencial vs remoto) no cambia la firmeza jurídica de la firma.

## 10. Acuerdo de uso de firma electrónica

### 10.1. Naturaleza jurídica

El Acuerdo de uso **NO es un contrato laboral** ni un consentimiento
genérico para todos los documentos futuros. Es la aceptación del
**mecanismo** de firma electrónica que K+AIR pone a disposición.

Aceptar el Acuerdo no implica aceptar el contenido de ningún documento
específico. La aceptación del contenido ocurre en la **manifestación
de voluntad** de cada documento (sección 10.3).

### 10.2. Cuándo se acepta

El Acuerdo se acepta **dentro del pipeline de contratación**, una sola
vez por versión, antes de que el trabajador firme su primer documento
laboral. Esto permite que el trabajador lo lea sin la presión de tener
un contrato esperándolo.

```
Pipeline de contratación
        │
        ├── Datos del candidato
        │
        ├── Acuerdo de uso de firma electrónica  ← 1 vez por versión
        │   (mini-flujo: leer + checkbox + OTP)
        │
        ├── Documentos del contrato
        │
        └── Firma de cada documento
            (flujo normal con manifestación por documento)
```

### 10.3. Lo que el Acuerdo NO hace

- ❌ No autoriza al empleador a firmar nada en nombre del trabajador.
- ❌ No sustituye la manifestación de voluntad en documentos
  individuales.
- ❌ No transfiere el costo del mecanismo al trabajador.
- ❌ No impide que el trabajador se niegue a firmar un documento
  específico.

### 10.4. Evidencia del Acuerdo

La tabla `gh_consentimientos_firma` (ver `DATA_MODEL.md`) almacena:

- `id_trabajador`
- `version_acuerdo` (ej. `v1.0`, `v1.1`)
- `hash_texto_acuerdo` (SHA-256 del texto exacto aceptado)
- `texto_acuerdo` (opcional: el texto completo, para referencia)
- `ip`, `user_agent`
- `fecha_aceptacion`
- `kair_version` (versión de K+AIR que mostró el Acuerdo)
- `otp_hash`, `otp_intentos` (evidencia de la autenticación)

> **TODO crítico**: el texto del Acuerdo debe redactarlo el equipo con
> base en las normas aplicables y hacerlo **revisar por un abogado
> laboral colombiano** antes de producción. No se incluye en este
> documento.

## 11. Autenticación: cédula + OTP

### 11.1. Por qué OTP al correo en v1

- Es el canal más simple de operar y el más barato.
- No requiere integración con operadores SMS ni con WhatsApp Business
  API.
- El correo del trabajador ya está validado en K+AIR (al momento de
  la contratación).
- La arquitectura es **extensible** a SMS/WhatsApp vía campo
  `verification_channel` en BD.

### 11.2. Componentes

1. **Cédula**: tipo (CC, CE, TI, PPT, etc.) + número.
   - Se coteja contra `base_personal.cedula` (o equivalente).
   - Si no coincide, la solicitud se marca como `IDENTIFICATION_FAILED`
     y se notifica a RH.
2. **OTP**: 6 dígitos numéricos.
   - Generado con `crypto.randomInt(100000, 1000000)`.
   - Enviado por SMTP al correo del trabajador.
   - Almacenado como `bcrypt(otp + salt)` o `SHA-256(otp + salt)`.
   - **TTL: 10 minutos**.
   - **Máximo 5 intentos**. Después se bloquea la solicitud y se
     registra evento `OTP_LOCKED`.
3. **Estado de sesión**: persistido en BD, no en memoria del proceso
   Node (ver sección 13).

### 11.3. Limitación documentada

El OTP al correo tiene debilidades conocidas:

- Si el correo del trabajador está comprometido, la autenticación
  también lo está.
- Si la bandeja del trabajador está llena, el OTP no llega.

Estas limitaciones **se documentan en el Acuerdo de uso** y se
mitigan en v1 con:

- Confirmación visual del último acceso al correo (cuando el
  proveedor lo provea).
- Notificación a RH de cualquier intento fallido.
- Opción de reenviar OTP (cada reenvío genera un código nuevo e
  invalida el anterior).

## 12. QR y tokens

### 12.1. Token

- **Longitud**: ≥32 caracteres alfanuméricos.
- **Generación**: `crypto.randomBytes(24).toString('base64url')` →
  ~32 chars.
- **Persistencia**: solo `token_hash = SHA-256(token)`. El token
  original nunca se guarda.
- **Vida útil por defecto**: 72 horas para firma remota, 24 horas
  para firma presencial (configurable por el empleador).
- **Un solo uso**: una vez consumido, no se puede reutilizar.

### 12.2. QR

- El QR codifica **únicamente** la URL completa:
  `https://firma.k-air.com/s/{token}`.
- **No contiene** el documento, ni la cédula, ni el hash, ni ningún
  dato sensible.
- Tamaño mínimo recomendado: 256×256 px para que sea legible desde
  un teléfono a 30 cm.
- Error correction: nivel H (30%) para entornos con poca luz.

### 12.3. Validación al recibir el token

Cuando el Servicio recibe una request con un token:

1. Calcula `token_hash` y lo busca en la BD.
2. Si no existe → 404.
3. Si existe pero está en estado terminal (SIGNED, REJECTED, EXPIRED,
   REVOKED, CANCELLED) → 410 Gone.
4. Si existe y está vigente → carga la sesión y continúa.
5. Si `expires_at < now` → marca EXPIRED, retorna 410.

## 13. Estados de SIGN_REQUEST

Una solicitud de firma tiene **estados de sesión** (transiciones
durante la firma) y **estados terminales** (resultado final).

### 13.1. Estados de sesión (transiciones)

```
PENDING
  │  Trabajador abre el enlace / escanea el QR
  ▼
OPENED
  │  Trabajador empieza a tipear su cédula
  ▼
IDENTIFICATION_STARTED
  │  Cédula validada contra base_personal
  ▼
IDENTIFIED
  │  Sistema envía OTP al correo
  ▼
OTP_SENT
  │  Trabajador ingresa OTP correcto
  ▼
OTP_VERIFIED
  │  Trabajador abre el visor PDF
  ▼
DOCUMENT_OPENED
  │  Trabajador llega al final del documento
  ▼
DOCUMENT_VIEWED
  │  Trabajador marca checkbox + presiona "Firmar"
  ▼
MANIFESTATION_RECORDED
  │  Backend calcula hashes, persiste, genera PDFs
  ▼
SIGNED        ◀── estado terminal exitoso
```

### 13.2. Estados terminales alternativos

| Estado | Cuándo se alcanza |
|---|---| 
| `SIGNED` | Firma completada con éxito. |
| `REJECTED` | Trabajador rechazó explícitamente el documento. |
| `EXPIRED` | Pasó `expires_at` sin completar el flujo. |
| `REVOKED` | RH revocó manualmente la solicitud. |
| `CANCELLED` | RH canceló antes de que el trabajador abriera. |
| `OTP_LOCKED` | Trabajador excedió 5 intentos de OTP. |
| `IDENTIFICATION_FAILED` | Cédula no coincide con `base_personal`. |

**Nota sobre rebotes de correo**: un rebote **no es un estado terminal**.
El Servicio registra el evento `EMAIL_BOUNCED` con metadata
(`{tipo, mensaje_smtp, intento_n, reintentable}`), programa hasta 3
reintentos automáticos con backoff (5 min, 30 min, 2 h) y notifica a
RH cuando los reintentos se agotan. La solicitud **sigue viva**: RH
puede corregir el correo del trabajador, reenviar manualmente, o
crear una nueva solicitud. Esto evita que un problema operacional
(de correo rebotado) mate una solicitud que es legalmente válida.

### 13.3. Reglas de transición

- Las transiciones son **unidireccionales**. No se puede regresar de
  `SIGNED` a `OTP_SENT`.
- Transiciones críticas (`DOCUMENT_VIEWED → SIGNED`) son **atómicas
  con verificación de estado**:
  ```sql
  UPDATE sign_requests
  SET estado = 'SIGNED', ...
  WHERE id = ? AND estado = 'DOCUMENT_VIEWED'
  ```
  Si `changes() !== 1` después del UPDATE, la operación falla con
  409 Conflict. Esto previene race conditions.
- Cada transición queda registrada como evento en
  `gh_firma_eventos`.

## 14. Integridad: SHA-256

### 14.1. Tres hashes canónicos

| Hash | Qué se hashea | Cuándo se calcula | Para qué sirve |
|---|---|---|---|
| `document_hash_original` | Bytes del PDF congelado | Al generar la solicitud | Evidencia de qué documento se le presentó al trabajador. |
| `document_hash_firmado` | Bytes del PDF firmado final | Al cerrar la firma | Verificar que el PDF firmado coincide con el original. |
| `agreement_hash` | Bytes del texto del Acuerdo aceptado | Al aceptar el Acuerdo | Evidencia de qué versión del Acuerdo aceptó el trabajador. |
| `evidence_hash` | JSON canónico con todas las evidencias (fechas, IPs, IDs, hashes previos, eventos) | Al cerrar la firma | Huella global verificable por terceros. |

### 14.2. Verificación posterior

Cualquiera (trabajador, empleador, autoridad, abogado) puede:

1. Tomar el PDF firmado.
2. Calcular `SHA-256(bytes_pdf)`.
3. Comparar con `document_hash_firmado` registrado en la Constancia.
4. Si coinciden: el PDF no fue alterado.
5. Si difieren: la firma es inválida.

Adicionalmente:

1. Tomar la Constancia (PDF).
2. Extraer el JSON embebido con los hashes.
3. Calcular `SHA-256(json_canonico)`.
4. Comparar con `evidence_hash` registrado en la Constancia.
5. Si coinciden: la evidencia completa no fue alterada.

### 14.3. JSON canónico

Para que `evidence_hash` sea verificable por terceros, el JSON
subyacente debe ser **canónico**:

- Claves ordenadas alfabéticamente en cada nivel.
- Sin espacios superfluos.
- Encoding UTF-8.
- Sin `undefined`, sin funciones, sin referencias circulares.

Esto se logra con una función `canonicalize(obj)` en el Servicio de
firma. Cualquier discrepancia en la canonicalización invalida la
verificación.

## 15. Constancia de firma electrónica

### 15.1. Qué es

Documento PDF generado automáticamente al cerrar la firma. Contiene
**toda la evidencia** de la firma en un formato legible y verificable.

### 15.2. Qué contiene

```
─────────────────────────────────────────────
CONSTANCIA DE FIRMA ELECTRÓNICA
K+AIR
─────────────────────────────────────────────

Documento firmado
  Nombre        : Contrato de trabajo a término fijo
  Versión       : v1 (firmado el 17/08/2026)
  Hash SHA-256  : 9a73f8c7...

Trabajador
  Nombre        : Juan Pérez
  Identificación: CC ********1234
  Correo        : juan.perez@ejemplo.com (verificado por OTP)

Empresa
  Razón social  : XYZ S.A.S.
  NIT           : 900.123.456-7

Fecha y hora
  Creación      : 2026-08-17 10:01:23 -05:00
  Firma         : 2026-08-17 10:18:45 -05:00
  Zona horaria  : America/Bogota

Método
  Mecanismo     : Firma electrónica K+AIR
  Autenticación : OTP al correo (5/5 intentos correctos)
  Manifestación : "He leído, comprendido y acepto el contenido"
  Firma visual  : [opcional] Incluida / No incluida

Solicitud
  ID            : SIGN-2026-000123
  Hash evidencia: c4d8e2f1...
  Estado        : FIRMADO

Verificación
  URL pública   : https://firma.k-air.com/verificar/SIGN-2026-000123
  (cualquier persona con este ID puede verificar la firma)

Marco normativo
  Este mecanismo está diseñado conforme a la Ley 527 de 1999,
  el Decreto 2364 de 2012, el Decreto 526 de 2021 y el Decreto
  1072 de 2015. La validación jurídica definitiva corresponde
  a un profesional colombiano.

─────────────────────────────────────────────
Generado automáticamente por K+AIR.
ID de generación: GEN-2026-08-17-101845-7H2K
```

### 15.3. Lo que NO es

- ❌ **NO es un "certificado digital"** (esa expresión tiene
  connotación técnica y jurídica específica, reservada para PKI).
- ❌ **NO es una firma digital criptográfica** con certificado
  X.509.
- ❌ **NO requiere instalación** ni software especial para
  verificarse (cualquier visor PDF basta para leerla).

---

# PARTE IV — Arquitectura técnica

## 16. Arquitectura global

```
                    ┌─────────────────────┐
                    │   K+AIR RH (local)  │
                    │   Electron + SQLite │
                    └──────────┬──────────┘
                               │ HTTPS
                               │ (API interna con API key)
                               │
              ┌────────────────┼─────────────────┐
              │                │                 │
              ▼                ▼                 ▼
        Crear solicitud   Consultar estado   Descargar PDF
        /sign-requests    /sign-requests/:id  firmado + Constancia
              │                │                 │
              └────────────────┼─────────────────┘
                               │
                               ▼
              ┌────────────────────────────┐
              │ Servicio de Firma K+AIR    │
              │   Express + SQLite + HTTPS │
              │   firma.k-air.com          │
              │                            │
              │   • Genera tokens          │
              │   • Valida estados         │
              │   • Envía OTP (SMTP)       │
              │   • Genera PDFs firmados   │
              │   • Genera Constancias     │
              │   • Registra eventos       │
              └────────────┬───────────────┘
                           │
                           │ HTTPS
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
         🏢 Presencial             🏠 Remoto
         (QR en oficina)         (enlace por correo)
              │                         │
              └────────────┬────────────┘
                           ▼
              https://firma.k-air.com/s/{token}
                           │
                           ▼
              ┌────────────────────────────┐
              │  Mini-app web estática     │
              │  HTML + CSS + JS puro     │
              │  (sin Electron, sin build)│
              │  Servida por Express      │
              └────────────┬───────────────┘
                           │
                           │ HTTPS
                           │
                           ▼
                      Trabajador
              (teléfono, tablet, computador)
```

**Principios arquitectónicos:**

1. **El Servicio de firma NO depende de K+AIR Electron**. Si K+AIR
   está apagado, el Servicio sigue aceptando firmas de tokens
   vigentes.
2. **K+AIR NO expone endpoints de firma al público**. La única URL
   pública es `/s/{token}` servida por el Servicio.
3. **La mini-app NO tiene estado propio**. Cada interacción es un
   round-trip al backend con el token como bearer.
4. **El estado vive en la BD del Servicio**, no en memoria del
   proceso ni en el cliente.

## 17. Servicio de firma (Express)

### 17.1. Stack tecnológico

- **Runtime**: Node.js 20 LTS
- **Framework**: Express 4.x
- **BD**: SQLite (better-sqlite3) — archivo único
- **PDF**: `pdfkit` o `pdf-lib` para generar constancias y PDFs
  firmados
- **Email**: `nodemailer` con SMTP configurable
- **Crypto**: módulos nativos de Node (`crypto.randomBytes`,
  `crypto.createHash`)
- **Sin ORM**: SQL crudo con `better-sqlite3` (transacciones
  síncronas,性能和 claridad)

### 17.2. Endpoints públicos

| Método | Ruta | Propósito |
|---|---|---|
| `GET` | `/s/{token}` | Sirve la mini-app con el contexto de la solicitud |
| `POST` | `/api/sign/{token}/identify` | Recibe cédula, valida, envía OTP |
| `POST` | `/api/sign/{token}/verify-otp` | Valida OTP |
| `POST` | `/api/sign/{token}/view-document` | Registra que el documento fue visto |
| `POST` | `/api/sign/{token}/commit` | Cierra la firma (atómico) |
| `POST` | `/api/sign/{token}/reject` | Registra rechazo explícito |

### 17.3. Endpoints internos (autenticados con API key)

| Método | Ruta | Propósito |
|---|---|---|
| `POST` | `/internal/sign-requests` | Crea nueva solicitud (lo llama K+AIR) |
| `GET` | `/internal/sign-requests/:id` | Consulta estado (lo llama K+AIR) |
| `POST` | `/internal/sign-requests/:id/notify-remote` | Envía correo al trabajador |
| `POST` | `/internal/sign-requests/:id/revoke` | Revoca una solicitud |
| `GET` | `/internal/sign-requests/:id/pdf-firmado` | Descarga PDF firmado |
| `GET` | `/internal/sign-requests/:id/constancia` | Descarga Constancia |
| `GET` | `/internal/sign-requests/:id/eventos` | Lista eventos de auditoría |

### 17.4. Configuración

Variables de entorno (`.env`):

```env
PORT=3001
DB_PATH=./data/firma.sqlite
PUBLIC_URL=https://firma.k-air.com
INTERNAL_API_KEY=<se genera con crypto.randomBytes(32)>
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
OTP_TTL_SECONDS=600
OTP_MAX_ATTEMPTS=5
TOKEN_TTL_HOURS_REMOTE=72
TOKEN_TTL_HOURS_PRESENCIAL=24
RATE_LIMIT_PER_MINUTE=20
RATE_LIMIT_OTP_PER_HOUR=10
```

> El detalle de cada endpoint (request/response) está en
> `API.md`. El detalle de las tablas y columnas está en
> `DATA_MODEL.md`.

## 18. Mini-app pública de firma

### 18.1. Naturaleza

- **Aplicación web estática**: HTML + CSS + JS, sin build step.
- Servida por Express desde `/s/{token}` con el contexto ya
  inyectado.
- **NO usa Electron, NO usa frameworks pesados** (no React, no
  Vue). Es vanilla JS para minimizar superficie de ataque y
  dependencias.
- Carga inicial: < 100 KB.
- Compatible con navegadores modernos: Chrome 100+, Edge 100+,
  Firefox 100+, Safari 15+.

### 18.2. Pantallas

| Pantalla | Cuándo se muestra |
|---|---|
| Cargando | Al abrir `/s/{token}`. |
| Error (token inválido/expirado) | Si el token no existe o está en estado terminal. |
| Identificación | Pide tipo + número de cédula. |
| OTP | Pide el código de 6 dígitos. |
| Visor de documento | Muestra el PDF (con scroll completo requerido). |
| Manifestación de voluntad | Checkbox + texto + botón "Firmar". |
| Confirmación | "Documento firmado. Revisa tu correo." |
| Rechazo | "¿Deseas rechazar este documento? [Sí, rechazar] [No, volver]" |

### 18.3. Restricciones

- **No persiste estado en el cliente**. Cada pantalla hace fetch al
  backend.
- **No usa `localStorage`, ni `sessionStorage`, ni `IndexedDB`** para
  datos sensibles. (Sí puede usarlos para preferencias de UI como
  tema claro/oscuro.)
- **El token NUNCA se loguea** ni se envía a servicios externos
  (analytics, etc.).
- **CSP estricta** que solo permite cargar recursos del propio
  dominio.

## 19. Comunicación K+AIR ↔ Servicio

### 19.1. Patrón general

K+AIR local consume los endpoints internos del Servicio de firma
con autenticación por API key. La API key se rota periódicamente y
se almacena en el llavero de Electron (`safeStorage`).

```
K+AIR RH
   │
   │ POST /internal/sign-requests
   │ Headers: X-Internal-API-Key: <key>
   │ Body: { id_documento, id_trabajador, id_empresa,
   │         document_hash_original, ttl, ... }
   │
   ▼
Servicio de firma
   │
   │ Response: { id_solicitud: "SIGN-2026-000123",
   │             token: "abc123...",  ← se muestra como QR
   │             url_publica: "https://firma.k-air.com/s/abc123...",
   │             qr_payload: "https://firma.k-air.com/s/abc123..." }
   │
   ▼
K+AIR RH muestra QR en pantalla
```

### 19.2. Sincronización K+AIR ← Servicio

Cuando una firma termina (`SIGNED`), el Servicio marca la solicitud
como `SYNC_PENDING`. La próxima vez que K+AIR consulta el estado
(al abrir la sección Documentos, por ejemplo), descarga el PDF
firmado + la Constancia y los guarda en la ruta local.

Esto preserva el principio: **K+AIR local es la fuente de verdad
operacional; el Servicio es el notario digital**.

### 19.3. Manejo de errores

- Si K+AIR no puede contactar al Servicio al crear una solicitud,
  la creación del documento local se hace igual; la firma se
  reintenta después.
- Si el Servicio está caído, las firmas en curso **no se pierden**
  (el Servicio es autónomo).
- K+AIR muestra en la UI: "Servicio de firma no disponible. Las
  firmas pendientes se enviarán cuando el servicio esté de
  vuelta."

## 20. Almacenamiento

### 20.1. Principio: separación de roles

| Componente | Rol | Qué almacena |
|---|---|---|
| **Servicio de firma (VPS)** | Notario digital | PDFs firmados, constancias, eventos, metadata de auditoría. **Fuente de verdad para verificación**. |
| **K+AIR local** | Expediente del empleador | Copia local de PDFs firmados + constancias (sincronizadas desde el Servicio). BD local con metadata. |
| **Correo del trabajador** | Notificación + copia | Copia del PDF firmado + Constancia, enviada al cerrar la firma. |

### 20.2. Estructura de archivos en el Servicio

```
/var/lib/kair-firma/
├── data/
│   └── firma.sqlite              # BD del Servicio
├── pdfs/
│   ├── originales/                # PDFs congelados antes de firmar
│   │   └── SIGN-2026-000123.pdf
│   ├── firmados/                  # PDFs firmados
│   │   └── SIGN-2026-000123.pdf
│   └── constancias/               # Constancias de firma
│       └── SIGN-2026-000123.pdf
└── logs/
    └── firma.log
```

### 20.3. Estructura de archivos en K+AIR local

```
<kair-data>/
└── gh-docs/
    └── <empresa_id>/
        ├── <docId>.pdf                    # PDF generado/subido
        ├── <docId>-firmado.pdf            # PDF firmado (sync)
        └── <docId>-constancia.pdf         # Constancia (sync)
```

### 20.4. Política de retención

- **En el Servicio**: indefinido por defecto, con job de limpieza
  configurable por el empleador (ej. "borrar tras 10 años").
- **En K+AIR local**: misma política que el resto de documentos
  laborales del módulo de Gestión Humana.
- **En el correo del trabajador**: el trabajador decide.

> **Pendiente**: definir plazo exacto de retención con abogado
> laboral colombiano (mínimo 10 años sugerido, sujeto a
> confirmación).

## 21. Evidencias y trazabilidad (eventos)

### 21.1. Patrón event sourcing ligero

La tabla principal `gh_firmas_electronicas` almacena el **estado
actual** de cada solicitud. La tabla `gh_firma_eventos` almacena
la **historia completa** como append-only.

### 21.2. Eventos registrados

| Evento | Metadata | Cuándo |
|---|---|---|
| `CREATED` | `{documento_id, hash_original, ttl}` | K+AIR crea la solicitud. |
| `OPENED` | `{ip, user_agent}` | Trabajador carga la mini-app. |
| `IDENTIFICATION_STARTED` | — | Trabajador empieza a tipear cédula. |
| `IDENTIFICATION_COMPLETED` | `{tipo_doc, num_doc_hash}` | Cédula validada. |
| `IDENTIFICATION_FAILED` | `{motivo}` | Cédula no coincide. |
| `OTP_SENT` | `{canal, destino_hash}` | Sistema envía OTP. |
| `OTP_VERIFIED` | `{intentos}` | OTP correcto. |
| `OTP_FAILED` | `{intento_n}` | OTP incorrecto. |
| `OTP_LOCKED` | `{intentos}` | Excedió máximo de intentos. |
| `DOCUMENT_OPENED` | — | Trabajador abre el visor PDF. |
| `DOCUMENT_VIEWED` | `{segundos_en_pagina}` | Scroll llegó al final. |
| `MANIFESTATION_RECORDED` | `{texto_hash}` | Trabajador aceptó la manifestación. |
| `SIGN_COMMITTED` | `{evidence_hash}` | Firma persistida. |
| `PDF_GENERATED` | `{path, size}` | PDF firmado creado. |
| `COPY_SENT` | `{canal}` | Copia enviada al trabajador. |
| `REJECTED` | `{motivo_texto}` | Trabajador rechazó. |
| `EXPIRED` | — | Token venció. |
| `REVOKED` | `{rh_user_id, motivo}` | RH revocó. |
| `CANCELLED` | `{rh_user_id, motivo}` | RH canceló antes de abrir. |
| `NOTIFICATION_SENT` | `{canal}` | Correo enviado al trabajador. |
| `EMAIL_BOUNCED` | `{tipo, mensaje_smtp, intento_n, reintentable}` | Correo rebotó (bounce). `tipo` = `otp` / `notification` / `copy`. **No cambia el estado de la solicitud.** |
| `EMAIL_RETRY_SCHEDULED` | `{tipo, intento_n, proximo_intento_at}` | Se programó un reintento automático. |
| `EMAIL_RETRY_EXHAUSTED` | `{tipo, intentos_totales, ultimo_error}` | Tras 3 reintentos fallidos. RH es notificado. **La solicitud sigue viva.** |
| `EMAIL_RESENT` | `{tipo, rh_user_id, motivo}` | RH reenvió manualmente el correo. |
| `SYNC_COMPLETED` | `{kair_version}` | K+AIR descargó el PDF firmado. |

### 21.3. Línea de tiempo para auditoría

Un endpoint del Servicio (`/internal/sign-requests/:id/eventos`)
devuelve la lista de eventos en orden cronológico, lista para
mostrar en una timeline visual en K+AIR local:

```
CONTRATO JUAN PÉREZ · SIGN-2026-000123

17/08 10:01  🟢 Solicitud creada
17/08 10:01  📧 Correo enviado
17/08 10:15  👁 Trabajador abrió el documento
17/08 10:16  ✅ Cédula validada
17/08 10:16  📨 OTP enviado
17/08 10:18  🔐 OTP verificado
17/08 10:18  ✍️ Manifestación registrada
17/08 10:18  📄 Documento firmado
17/08 10:18  📧 Copia enviada al trabajador
17/08 10:20  ⬇️ K+AIR descargó el PDF firmado
```

## 22. Seguridad

### 22.1. Amenazas consideradas

| Amenaza | Mitigación |
|---|---|
| Acceso al token por sniffing | HTTPS obligatorio. |
| Acceso a la BD | `token_hash` (no token en plano), `otp_hash` (no OTP en plano), hashes con sal. |
| Ataque de fuerza bruta al token | Rate limit + TTL + estado terminal. |
| Ataque de fuerza bruta al OTP | Máximo 5 intentos + bloqueo + rate limit. |
| Manipulación del PDF firmado | `document_hash_firmado` vs `document_hash_original`; `evidence_hash`. |
| Manipulación de la Constancia | `evidence_hash` calculado sobre JSON canónico. |
| Acceso al endpoint `/sign/:token` por terceros | El endpoint es público por diseño; las mitigaciones están en el resto de capas. |
| Repudio del trabajador | Línea de tiempo de eventos + IP + user-agent + OTP al correo. |
| Repudio del empleador | API key interna + logs firmados. |
| Denegación de servicio | Rate limit + validación de tamaño de payload. |
| Fuga de datos en logs | Logs nunca incluyen tokens, OTPs, cédulas ni correos en claro. |
| Inyección SQL | SQL parametrizado con `better-sqlite3`. |
| XSS en la mini-app | CSP estricta + escape de HTML + `textContent` en vez de `innerHTML`. |

### 22.2. Rate limiting

- **Global**: 20 requests/minuto por IP.
- **OTP por solicitud**: 5 intentos, después `OTP_LOCKED`.
- **Reenvío de OTP**: máximo 3 reenvíos por hora por solicitud.
- **Reenvío de solicitud (recordatorio)**: máximo 1 recordatorio cada
  24 horas por solicitud, por defecto.

### 22.3. Headers de seguridad

La mini-app y las respuestas de la API se sirven con:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
Referrer-Policy: no-referrer
```

### 22.4. Política de logs

- **NO se loguean**: tokens, OTPs, cédulas completas, correos
  completos.
- **SÍ se loguean**: `token_hash`, IDs de solicitud, eventos,
  timestamps, IPs, user-agents.
- Los logs tienen rotación diaria y se conservan 90 días.

### 22.5. Rotación de secretos

- **API key interna**: cada 90 días, con período de gracia de 7 días
  para la key anterior.
- **Secretos SMTP**: almacenados en variables de entorno, no en la
  BD.
- **Hash de Acuerdo**: cada versión tiene un hash; no se reutiliza
  texto entre versiones.

---

# PARTE V — Evolución y cierre

## 23. Evolución futura (post-v1)

Estos elementos quedan **explícitamente fuera de v1** pero pueden
considerarse en iteraciones posteriores:

- **v1.1**: SMS como canal alternativo de OTP (con `verification_channel`).
- **v1.2**: WhatsApp Business API como canal de notificación (no de
  OTP todavía).
- **v1.3**: Firma visual manuscrita como **complemento opcional**
  con captura de presión/velocidad (no como base legal).
- **v2.0**: Firma digital criptográfica con PKI/X.509 para clientes
  que la requieran.
- **v2.1**: Multi-idioma de la mini-app.
- **v2.2**: Biometría (huella, facial) en dispositivos compatibles.
- **v2.3**: Portal del trabajador opcional (solo para clientes que
  lo soliciten).
- **v3.0**: PWA instalable.

Cualquiera de estas evoluciones requiere **revisión de este
documento** y, probablemente, revisión jurídica adicional.

## 24. Validación jurídica pendiente

> **Recordatorio importante**

Antes de poner el sistema en producción con trabajadores reales,
se requiere:

1. ✅ Revisión del texto del **Acuerdo de uso de firma electrónica**
   por abogado laboral colombiano.
2. ✅ Revisión del texto de la **manifestación de voluntad** por
   abogado laboral colombiano.
3. ✅ Validación del modelo de **consentimiento y protección de
   datos** (Ley 1581/2012 y decretos).
4. ✅ Validación del **plazo de retención** de evidencia y PDFs.
5. ✅ Validación de que la **política de Habeas Data** de K+AIR
   cubre el nuevo tratamiento.
6. ✅ Revisión de la **Constancia de firma** como documento
   probatorio suficiente.

**Mientras estas validaciones no se completen, el sistema NO debe
usarse en producción con trabajadores reales.** Puede usarse en
entornos de prueba con datos sintéticos.

---

**Fin del documento.**

Próximos entregables derivados de este (en orden):

1. `DATA_MODEL.md` — modelo de datos detallado (tablas, columnas,
   índices, migraciones).
2. `API.md` — contratos request/response de cada endpoint.
3. `FLOWS.md` — diagramas de secuencia detallados de cada flujo.
4. `SECURITY.md` — análisis de amenazas detallado.
5. `LEGAL.md` — marco normativo expandido y consideraciones
   jurídicas.

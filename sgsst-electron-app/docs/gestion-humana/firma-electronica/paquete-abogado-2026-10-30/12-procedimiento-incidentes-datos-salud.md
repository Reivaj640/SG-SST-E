# Procedimiento de incidentes por carga accidental de datos de salud

**Expediente:** firma electrónica K+AIR — Gesstiar S.A.S.
**Fecha de emisión:** 30 de octubre de 2026
**Estado:** **operativo** (no declarado cumplido — ver §8)
**Origen:** revisión jurídica del 30-oct-2026, decisión **J11** (condiciones adicionales) y decisión **J7** (tabla de determinaciones, fila «Incidentes de seguridad»).

> Este documento es el procedimiento escrito que la revisión jurídica exige como evidencia. No
> sustituye el Acuerdo de uso ni el Anexo de Encargo: los ejecuta y los operacionaliza.

---

## 1. Propósito y alcance

### 1.1 Qué procedimiento es

El procedimiento que corre cuando, en el servicio de firma electrónica de K+AIR (Gesstiar S.A.S.),
un documento que contiene información de salud —datos sensibles— ingresa al servidor por una
**carga accidental**, es decir, por un flujo distinto del previsto.

El procedimiento tiene dos tramos que no deben confundirse:

| Tramo | Quién lo ejecuta | Qué produce |
|---|---|---|
| **Tramo contractual** — el 10.8(d) del Acuerdo de uso | K+AIR (Encargado), con la participación de la Empresa (Responsable) | Bloqueo, aislamiento, registro, aviso a la Empresa y supresión |
| **Tramo legal propio** — el art. 18, literal k), de la Ley 1581 de 2012 | K+AIR (Encargado), **por sí mismo** | Reporte a la Delegatura para la Protección de Datos Personales de la SIC, cuando el hecho califique |

### 1.2 A qué aplica

- A la **carga accidental de un documento con datos de salud** en el servicio de firma
  (Acuerdo de uso v1.3, numeral 10.8(d), incisos (i) a (v)).
- Al **deber propio del Encargado** frente a la Delegatura para la Protección de Datos Personales
  de la Superintendencia de Industria y Comercio (art. 18, literal k), de la Ley 1581 de 2012),
  que la revisión declara que **no se traslada a la Empresa** (revisión, J11).
- Al **reporte de incidentes de seguridad** por el aplicativo de la Delegatura, dentro del plazo
  legal de quince (15) días hábiles (RNBD, numeral 2.1, literal f), ii) — revisión, J7).

### 1.3 A qué NO aplica

- **A la detección o clasificación del contenido de un PDF.** El servicio no verifica el contenido
  del documento ni promete detección automática de datos sensibles (Acuerdo de uso, 10.8(a)). Este
  procedimiento arranca con un hecho ya conocido, no con un escaneo.
- **A los incidentes de seguridad en general ni a la gestión de PQRS.** El 10.8(d) es un
  procedimiento contractual específico; los PQRS y los derechos ARCO siguen su propio camino
  (Acuerdo de uso, 10.7).
- **A las obligaciones de la Empresa como Responsable.** El aislamiento del documento original que
  la Empresa conserva, la base legal, la notificación al Titular y las medidas de atención al
  Titular son de la Empresa (Anexo de Encargo §6). Este documento solo registra el reparto.
- **A la firma en papel.** Si la revisión concluye que el documento no debía haberse cargado, la
  firma se rehace en papel (Acuerdo de uso, 7.2); eso es un trámite de la Empresa, no un paso de
  este procedimiento.
- **A la inscripción de Gesstiar en el RNBD.** La revisión (J7) tiene por pendiente esa
  determinación. El reporte de incidentes es una carga distinta y no depende de ella: el deber del
  art. 18(k) no se suspende por no estar inscrita.
- **A los demás deberes del Encargado frente a la SIC**, que la revisión dejó en otros puntos
  (J11 y J14, punto 3, para el caso de la promesa de supresión en Cloudflare).

---

## 2. Definiciones

| Término | Definición | Fuente |
|---|---|---|
| **Carga accidental** | Ingreso al servidor del servicio de firma de un documento que contiene información de salud, por un flujo distinto del previsto. La regla del 10.8(b) es una regla de uso: no impide que el documento ingrese; si ingresa, el dato ya fue tratado —recibido, almacenado y sujeto a la huella— para el solo fin de la firma. | Acuerdo de uso v1.3, 10.8(b) y 10.8(d) |
| **Incidente de seguridad (a efectos de este procedimiento)** | El hecho de carga accidental así definido, una vez detectado y registrado por el reporte del 10.8(d)(iii). | Acuerdo de uso, 10.8(d)(iii) |
| **Violación de los códigos de seguridad del servicio** | La ruptura de una regla de seguridad del servicio. La carga accidental de un documento con datos de salud es una de ellas, porque el propio 10.8(b) prohíbe cargar en el servicio un documento que contenga datos sensibles de salud. | Revisión J11; Acuerdo de uso, 10.8(b) |
| **Riesgo en la administración de la información de los Titulares** | El segundo elemento del art. 18(k) de la Ley 1581 de 2012. En este procedimiento se configura cuando el dato sensible de salud llegó al servidor y quedó sujeto a la huella sin base jurídica en el servicio, porque el servicio no está autorizado para tratarlo. | Revisión J11; Acuerdo de uso, 10.8(c) y 10.8(d) |
| **Responsable (la Empresa)** | La empresa cliente que carga el documento. Es Responsable del tratamiento. | Acuerdo de uso, 10.1 y 10.9; Anexo de Encargo §1 y §6; Ley 1581, art. 3(d) |
| **Encargado (Gesstiar S.A.S. / K+AIR)** | Quien opera el servicio de firma por cuenta de la Empresa. En este procedimiento es K+AIR. | Ley 1581, art. 3(e); revisión J5 |
| **Titular** | El trabajador a quien corresponde la información contenida en el documento. | Acuerdo de uso, 1.1 |
| **Delegatura** | La Delegatura para la Protección de Datos Personales de la Superintendencia de Industria y Comercio, ante la cual se presenta el reporte. | Revisión, J11 |
| **Reporte** | El asiento del hecho en el registro de eventos del servicio, con fecha y hora, quién lo reporta, la causa invocada y las medidas adoptadas. Es de solo anexado. | Acuerdo de uso, 10.8(d)(iii) y 3.6(g) |
| **Constancia del caso** | El documento que deja constancia de un caso real: el acuse del reporte a la Delegatura y, cuando el caso se cierra, el evento de resolución y el recibo de supresión. | Revisión, J11 y J7 |

> Nota terminológica: el termino «registro de eventos del servicio» es el del Acuerdo de uso
> (10.8(d)(iii), 3.6(d) y 3.6(g)); el Anexo de Encargo §2 lo llama «registro de operaciones del
> servicio». Es la misma cosa: la tabla `gh_firma_eventos`.

---

## 3. Criterio de calificacion del hecho

### 3.1 La regla

El deber del **art. 18, literal k), de la Ley 1581 de 2012** se activa **únicamente** cuando el
hecho reúne **los dos** elementos que ese artículo exige:

1. que el hecho **configure una violación de los códigos de seguridad del servicio**, y
2. que **exista riesgo en la administración de la información de los Titulares**.

No hay un tercer elemento, no hay una tabla de gravedad, no hay umbral de número de Titulares
afectados, no hay monto, no hay criterio de intención o culpa. Los dos elementos son acumulativos:
**faltando uno, el hecho no se reporta a la Delegatura por ese artículo.**

Los dos elementos se aplican sobre el hecho tal como quedó registrado en el reporte del
10.8(d)(iii), que es de solo anexado: por eso la calificación se hace después del registro y no
antes.

### 3.2 La tabla

| Elemento | **Califica** (se reporta a la Delegatura por el art. 18(k)) | **No califica** (no se reporta a la Delegatura por el art. 18(k)) |
|---|---|---|
| **1. Ingreso del documento con dato de salud** | Un documento que contiene información de salud (por ejemplo, un examen, un perfil epidemiológico o un certificado de incapacidad) fue cargado en el servicio y el dato llegó al servidor: fue recibido, almacenado y sujeto a la huella. | Un documento sin información de salud (laboral o contractual) fue cargado; o el documento con dato de salud **nunca** ingresó al servidor porque el servicio lo rechazó antes de recibirlo. |
| **2. Violación de un código de seguridad del servicio** | La carga contraviene el **10.8(b)**, que prohíbe cargar en el servicio de firma un documento con datos sensibles de salud. La regla existe y el documento la incumplió. | El documento cargado no contenía dato de salud: ninguna regla de seguridad del servicio fue incumplida por el hecho. |
| **3. Riesgo en la administración de la información de los Titulares** | El dato sensible de salud quedó en el servidor sin base jurídica en el servicio, que no está autorizado para tratarlo (10.8(c)), y sujeto a la huella, a la retención y al circuito de conservación. | El dato nunca llegó al servicio, o el servicio no llegó a tratarlo. Sin el ingreso, no hay riesgo que administrar. |
| **4. Consecuencia si falta un elemento** | Se reporta a la Delegatura dentro de los quince (15) días hábiles (§5) y se deja constancia del reporte. | **El hecho se sigue gestionando completo por el 10.8(d)**: bloqueo, aislamiento, registro, aviso a la Empresa y supresión. Lo único que no se activa es el reporte del art. 18(k). No se archiva el caso como «incidente no calificable» sin gestionarlo. |
| **5. Quién califica** | K+AIR, como Encargado. La calificación es parte del deber propio: la revisión dice que ese deber no se traslada a la Empresa (J11). | K+AIR, en la misma oportunidad y por la misma vía. |

### 3.3 Lo que no es criterio de calificación

Para que no se inventen criterios que la norma no trae, se deja escrito:

- **No es criterio** el número de Titulares afectados, la existencia o no de un daño, el monto o la
  gravedad del daño, la intención o la culpa de quien cargó el documento, o la existencia de un
  reclamo del Titular. El artículo 18(k) no los menciona.
- **No es criterio** que la Empresa haya declarado o no el documento. La declaración del 10.8(a) es
  el control con que se verifica el cumplimiento de la prohibición, no un criterio de calificación.
- **No es criterio** el canal por el que se enteró el Encargado (la Empresa, el Firmante, un
  operador, un tercero). El artículo 18(k) no lo dice.
- **El único fundamento de esta sección** es el artículo 18, literal k), de la Ley 1581 de 2012 y el
  numeral 2.1, literal f), ii) del RNBD, en los términos en que los cita la revisión.

---

## 4. El procedimiento, paso a paso

El soporte operativo de los pasos (i) a (v) ya está implementado en el servicio: la ruta
administrativa `POST /internal/admin/sign-requests/{id_solicitud}/incidente-datos-sensibles`
(registra) y `POST /internal/admin/sign-requests/{id_solicitud}/incidente-datos-sensibles/resolver`
(resuelve), en `sgsst-electron-app/firma-service/src/routes/admin-incidentes.js:81` y `:110`
(montadas en `/internal/admin` en `sgsst-electron-app/firma-service/src/server.js:181`), sobre
`sgsst-electron-app/firma-service/src/services/incidenteSalud.js`.

| # | Paso | Qué hace el Encargado (K+AIR) | Qué hace la Empresa (Responsable) | Evidencia que queda |
|---|---|---|---|---|
| 1 | **Detección y conocimiento** | Detecta el hecho (la Empresa lo reporta, o K+AIR tiene conocimiento de él) y **lo conoce**. Desde este momento corre el plazo del §5. | Detecta y reporta, o recibe el reporte de K+AIR. | Registro del reporte con fecha y hora del conocimiento |
| 2 | **Bloqueo** — 10.8(d)(i) | Bloquea la solicitud y su enlace de firma, de modo que no pueda firmarse ni reimprimirse, y la deja **retenida** para que no se suprima mientras se resuelve el reporte. Si la solicitud ya estaba firmada, no se inventa un bloqueo: queda retenida y avisada. | — | Estado `REVOKED` de la solicitud; hold `incidente_datos_sensibles` |
| 3 | **Aislamiento** — 10.8(d)(ii) | No comunica el documento a terceros distintos de los subencargados del Anexo de Nube, no lo utiliza para ninguna otra finalidad y lo conserva únicamente mientras se resuelve el reporte. El aviso a la Empresa **no lleva adjunto ni enlace de descarga**. | Aísla el documento original que conserva y adopta las medidas sobre la información del Titular. | Campo de aislamiento del evento: documento no comunicado, no en correo, sin enlace de descarga |
| 4 | **Registro del reporte** — 10.8(d)(iii) y 3.6(g) | Registra el reporte en el registro de eventos del servicio, con **fecha y hora, quién lo reporta, la causa invocada y las medidas adoptadas**. Es de **solo anexado**: la base de datos rechaza su actualización y su eliminación. | — | Evento `INCIDENTE_DATOS_SENSIBLES` en `gh_firma_eventos` |
| 5 | **Notificación a la Empresa** — 10.8(d)(iv) | Avisa a la Empresa por su **canal de incidentes** y le informa que la solicitud quedó bloqueada, con la descripción del hecho, los datos afectados y las medidas tomadas. Usa la plantilla del §7: **sin adjunto y sin enlace de descarga**. | Recibe el aviso y queda enterada de que la solicitud quedó bloqueada. | Aviso enviado con su `message_id`; si no salió, queda en el evento la constancia de que no salió |
| 6 | **Calificacion** | Aplica el criterio del §3 al hecho ya registrado. El resultado se deja escrito, sea calificable o no. | — | Campo de calificación en el expediente del caso (§9) |
| 7 | **Reporte a la Delegatura** — art. 18(k) | **Solo si el hecho califica (§3).** K+AIR, **por sí mismo**, presenta el reporte a la Delegatura para la Protección de Datos Personales de la SIC por el aplicativo de la Delegatura, dentro de los quince (15) días hábiles. **Este deber es propio del Encargado y no se traslada a la Empresa.** | No le corresponde: no lo suple ni lo firma. | Acuse del reporte, con radicado y fecha (§9) |
| 8 | **Atencion al Titular** | K+AIR no decide la atencion al Titular. Asiste a la Empresa con la evidencia que repose en su custodia. | Notifica al Titular y a la autoridad cuando su propia normativa y la ley lo exigen, y decide las medidas de atencion al Titular. | Constancia de la notificacion al Titular, en poder de la Empresa |
| 9 | **Resolucion y supresion** — 10.8(d)(v) | Resuelto el reporte, libera el hold del incidente y deja el documento disponible para la via del 8.6, que lo suprime cuando corresponde. La supresion deja la **lápida y el recibo del 3.6(g)**. | Si de la revision resultara que el documento no debía haberse cargado, lo declara así y la firma se rehace en papel (7.2). | Evento `INCIDENTE_DATOS_SENSIBLES_RESUELTO`; lápida y recibo de supresión |

> El reparto del paso 7 es el que la revisión aprueba (J11): K+AIR bloquea, registra, avisa a la
> Empresa, no comunica el documento y retiene mientras se resuelve; la Empresa aísla el original,
> notifica al Titular, declara la base legal y decide la atencion al Titular. **A eso se suma el
> deber propio del Encargado de reportar a la Delegatura.**

---

## 5. El plazo

### 5.1 Cual es

**Quince (15) dias habiles siguientes a la deteccion y el conocimiento**, contados por el
**Encargado**, y presentado **por el aplicativo de la Delegatura** (RNBD, numeral 2.1, literal f),
ii)).

### 5.2 Desde cuando corre

El plazo corre **desde la deteccion y el conocimiento por parte del Encargado** — no desde la
carga, no desde la fecha en que la Empresa lo supo, no desde la fecha en que se notificó al Titular,
y no desde la fecha en que se avisa a la Empresa. El evento `INCIDENTE_DATOS_SENSIBLES` de la tabla
`gh_firma_eventos` lleva la fecha y hora del reporte y es la referencia de arranque.

Si K+AIR ya tenia conocimiento del hecho antes de que la Empresa lo reportara, el plazo corre
desde ese conocimiento anterior.

### 5.3 Quien lo cumple

**El Encargado (K+AIR) lo cumple por si mismo.** El deber del art. 18(k) de la Ley 1581 de 2012
es propio del Encargado y **no se traslada a la Empresa** (revisión, J11). La Empresa no reporta en
nombre de K+AIR, no firma el reporte de K+AIR y no suple el plazo si K+AIR no lo cumple. Lo que la
Empresa tiene es su propia obligación de notificar al Titular y a la autoridad cuando su propia
normativa y la ley lo exigen (10.8(d)(iv)), que es una carga distinta y con su propio destinatario.

### 5.4 Lo que NO es este plazo

- **No es el plazo de las cuarenta y ocho (48) horas** del Anexo de Encargo §4 («Notificar
  incidentes de seguridad al responsable sin demora indebida y, en todo caso, dentro de un plazo
  máximo de cuarenta y ocho (48) horas desde que tenga conocimiento»). Ese es un plazo
  **contractual** del aviso a la Empresa; el de quince (15) dias habiles es el plazo **legal** del
  reporte a la Delegatura. Corren en paralelo y son independientes.
- **No es un plazo que el Acuerdo fije.** El Acuerdo de uso dice que los plazos de notificacion y
  de reporte son los que fijen la ley aplicable y que no declara cumplidos los que la ley establezca
  (10.8, ultimo parrafo). Este procedimiento los aplica; no los crea.
- **No es el plazo de la atencion al Titular**, que es de la Empresa y depende de la normativa que
  a la Empresa le aplique.

### 5.5 Dias habiles: lo que falta definir

El repositorio no tiene calendario de dias habiles: los plazos se cuentan como numeros enteros de
dias (`FIRMA_PLAZO_TRAMITE_DIAS`, `FIRMA_PLAZO_COPIA_DIAS` en `sgsst-electron-app/firma-service/src/config.js:124`
y `:141`), sinferiados ni calendario. Queda **pendiente de confirmar por el owner**: que dias
habiles se cuentan para este plazo (feriados nacionales y días no laborables de la
Delegatura) y quien los certifica. Es un dato que no esta en el expediente y no se inventa.

---

## 6. Responsables

| Rol | Persona o area responsable | Canal | Que debe hacer |
|---|---|---|---|
| **Encargado — califica y reporta a la Delegatura** (deber propio, art. 18(k)) | Javier Robles Fontalvo, Representante Legal de Gesstiar S.A.S. (persona o area responsable de la proteccion de datos del Encargado: Anexo de Encargo §11; `sgsst-electron-app/firma-service/legal-readiness.json:19`) | El aplicativo de la Delegatura (RNBD, 2.1(f)(ii)). Para la coordinacion interna: `privacidad.kair@gmail.com` (canal de proteccion de datos del Encargado, Anexo de Encargo §11) | Calificar el hecho (§3), presentar el reporte dentro de los quince (15) dias habiles y conservar el acuse |
| **Encargado — canal de incidentes de K+AIR** | Operacion del servicio | `adminkair@gmail.com` (canal de incidentes de K+AIR, configurado en `FIRMA_CANAL_INCIDENCIAS`: `sgsst-electron-app/firma-service/src/config.js:102`) | Es el canal por el que el Firmante avisa una situacion que comprometa la seguridad de sus datos de creacion (Acuerdo de uso, 5.1(c)) |
| **Operador que detecta y registra el reporte** | Operador interno de K+AIR (Encargado), por la via administrativa del servicio | Ruta `POST /internal/admin/sign-requests/{id_solicitud}/incidente-datos-sensibles`, autenticada con `X-Admin-API-Key`; el header `X-Admin-Actor` declara quien opera (`sgsst-electron-app/firma-service/src/routes/admin-incidentes.js:74`) | Registrar el reporte con fecha y hora, quien lo reporta, la causa invocada y las medidas adoptadas (10.8(d)(iii)) |
| **Responsable — la Empresa** | El `responsable_tratamiento` y el `responsable_tratamiento_correo` que la Empresa registró al inscribir sus datos en el servicio (`sgsst-electron-app/firma-service/src/db/schema/017_firma_empresas.sql:72` y `:73`) | El **canal de incidentes de la Empresa**, que es el campo `canal_incidentes` de su ficha (`sgsst-electron-app/firma-service/src/db/schema/017_firma_empresas.sql:77`). Si ahi no hay un correo valido, el aviso cae al `responsable_tratamiento_correo` | Recibir el aviso de que la solicitud quedo bloqueada (§7), aislar el documento original, notificar al Titular, declarar la base legal y decidir la atencion al Titular |
| **Titular** | El trabajador | `privacidad.kair@gmail.com` (canal de proteccion de datos y de derechos ARCO del Encargado, Anexo de Encargo §11; Acuerdo de uso, 10.7(b)) | Ejercer sus derechos frente a la Empresa, que es la Responsable |

### 6.1 Lo que queda pendiente de confirmar por el owner

- **La persona o area de la Delegatura** ante la que se presenta el reporte, y su dato de contacto.
  No esta en el expediente. **Pendiente de confirmar por el owner.**
- **El usuario y las credenciales con que Gesstiar se presenta en el aplicativo de la Delegatura**
  (RNBD). No estan en el repositorio ni en el expediente, y por su naturaleza no deben quedar
  transcritos en un documento compartido. **Pendiente de confirmar por el owner.**
- **La cuenta desde la que se presenta el reporte** (K+AIR usa una cuenta de consumo de correo,
  segun la determinacion de J6). Conviene fijar cual es y dejarla registrada en el expediente.
  **Pendiente de confirmar por el owner.**
- **El destinatario interno del reporte**: si el aviso a la Delegatura lo firma el Representante
  Legal o un operador delegado. El expediente no lo dice. **Pendiente de confirmar por el owner.**

### 6.2 Una nota sobre una referencia del codigo

El comentario de `sgsst-electron-app/firma-service/src/config.js:101` dice que el canal de
incidentes es el que publica el Anexo de Encargo «(§9, datos de contacto del Encargado)». En el
Anexo de Encargo vigente, el §9 es «El servicio en la nube» y los datos de contacto de las partes
estan en el **§11** (`sgsst-electron-app/legal/anexo-encargo.html:789-799`). Este documento cita el
§11 porque es el que manda; la correccion del comentario en el codigo no esta dentro de este
encargo y se reporta aparte.

---

## 7. Plantilla de comunicacion a la Empresa (10.8(d)(iv))

Texto listo para copiar y pegar. **No lleva adjunto ni enlace de descarga**: el documento no sale
de K+AIR por este canal, que es el aislamiento del 10.8(d)(ii). Es el mismo texto que el servicio
manda hoy (`sgsst-electron-app/firma-service/src/services/mailer.js:886`).

**Para:** el canal de incidentes de la Empresa (`canal_incidentes`); si no hay un correo valido
ahi, el `responsable_tratamiento_correo` que la Empresa registró.

**Asunto:** K+AIR — Solicitud bloqueada por carga accidental de datos de salud

---

Hola,

K+AIR registro el reporte de una carga accidental de un documento con datos de salud en una
solicitud de firma. La solicitud quedo BLOQUEADA.

ID de solicitud: [ID de la solicitud]
Fecha del reporte: [fecha y hora del reporte]

Que quedo bloqueado:

- El enlace de firma no abre: la solicitud no se puede firmar.
- El documento no se puede reimprimir ni descargar.
- La solicitud queda retenida por K+AIR: no se suprime mientras se resuelve el reporte.

Causa invocada en el reporte:

[causa invocada]

Medidas declaradas por quien reporto:

- [medida]
- [medida]

K+AIR no comunica ese documento a terceros, no lo usa para otra finalidad y lo conserva solo
mientras se resuelve el reporte.

Como Responsable del tratamiento, la Empresa resuelve lo que le corresponde por su cuenta,
incluido el aislamiento del documento original que ella conserva.

Este correo no lleva el archivo adjunto ni ningun enlace de descarga: el documento no sale de K+AIR
por este canal.

K+AIR

---

### 7.1 Que NO debe llevar esta comunicacion

- **Ningun adjunto.** Ni el PDF, ni una captura, ni una copia.
- **Ningun enlace de descarga** del documento, ni el enlace de firma, ni ningun token.
- **Ningun dato de salud del Titular**: ni diagnostico, ni valor de examen, ni categoria de dato
  sensible. La causa invocada describe el hecho, no el contenido clinico del documento.

---

## 8. Lo que NO se declara cumplido

Este procedimiento **no se declara cumplido**. Se declara **operativo**.

La revision juridica del 30-oct-2026 lo dice en estos terminos, y se reproducen aqui sin
interpretarlos:

> «Evidencia: procedimiento escrito con responsables, plantilla de comunicacion a la Empresa (sin
> adjunto ni enlace de descarga), criterio de calificacion del hecho, y constancias de los primeros
> casos reales. **Si nunca ocurre, no se declara cumplido: se declara operativo.**»

Y en la tabla de determinaciones (J7, fila «Incidentes de seguridad»), la evidencia que se pide es:

> «Procedimiento escrito con el plazo y el canal, y el acuse del primer reporte.»

Que significa, en concreto:

1. **Lo que este documento entrega**: el procedimiento escrito, los responsables, la plantilla de
   comunicacion a la Empresa, el criterio de calificacion del hecho, el plazo y el canal.
2. **Lo que este documento NO entrega, por definicion**: las constancias de los primeros casos
   reales. Esas existen solo cuando el hecho ocurre.
3. **Si el hecho nunca ocurre**, no hay nada que declarar cumplido: hay un procedimiento
   **operativo**, con su plazo, su canal, su criterio de calificacion y su evidencia previstos, y
   que se puede ejecutar en cuanto el primer caso aparezca.
4. **Cuando ocurran los primeros casos reales**, sus constancias (el acuse del reporte a la
   Delegatura, el evento del reporte, la comunicacion a la Empresa, el evento de resolucion, la
   lapida y el recibo de supresion) se incorporan al expediente del servicio (§9). En ese momento, y
   solo en ese momento, esa parte de la evidencia existira.
5. **La incorporacion de esas constancias al expediente es la condicion para que la evidencia de
   J7 (el acuse del primer reporte) y de J11 (las constancias de los primeros casos reales) pase de
   «pendiente» a «existente».** Este documento no anticipa ese estado.

---

## 9. Evidencia y donde se archiva

### 9.1 El registro del hecho

| Evidencia | Donde queda | Como se consulta |
|---|---|---|
| Reporte del incidente | Tabla `gh_firma_eventos`, evento `INCIDENTE_DATOS_SENSIBLES` | Linea de tiempo de la solicitud. El registro es de **solo anexado**: los disparadores de `sgsst-electron-app/firma-service/src/db/schema/020_eventos_append_only.sql` abortan cualquier `UPDATE` o `DELETE` |
| Bloqueo, retencion, aislamiento, aviso | El mismo evento (campos `bloqueo`, `retencion`, `aislamiento`, `notificacion`) | Junto al evento, en el mismo asiento |
| Resolucion del reporte | Tabla `gh_firma_eventos`, evento `INCIDENTE_DATOS_SENSIBLES_RESUELTO` | Misma linea de tiempo |
| Lapida y recibo de supresion | Los del 3.6(g) y el 8.6, cuando la supresion procede | La supresion del evento no borra la evidencia: deja la lapida y el recibo |
| Aviso a la Empresa | El `message_id` del envio, dentro del evento | El mismo evento |
| Reporte a la Delegatura | El acuse que devuelve el aplicativo de la Delegatura | **Se archiva en el expediente del servicio (§9.2)**, no en la base del servicio: es un documento externo |

### 9.2 Donde se archiva la constancia

La constancia de cada caso se archiva en el **expediente documental del servicio**, junto a este
procedimiento, en
`sgsst-electron-app/docs/gestion-humana/firma-electronica/`.

Con el nombre `caso-incidentes-datos-salud-[ID de la solicitud]-[AAAA-MM-DD].md`, y con esta
estructura minima:

1. Identificacion: ID de la solicitud, ID de la Empresa, fecha y hora de la deteccion y del
   conocimiento, y fecha de arranque del plazo del §5.
2. El hecho: causa invocada, medidas adoptadas y medidas declaradas por quien reporto.
3. El evento `INCIDENTE_DATOS_SENSIBLES` y el `INCIDENTE_DATOS_SENSIBLES_RESUELTO` transcritos.
4. La comunicacion a la Empresa: destinatario, canal de origen, `message_id`, fecha de envio y la
   constancia de que no llevaba adjunto ni enlace de descarga.
5. **La calificacion** (§3): el resultado, con el elemento que faltó cuando no califico.
6. **El acuse de la Delegatura**, cuando el hecho califico: radicado, fecha de presentacion y
   fecha en que se produjo el acuse. **Este acuse es la evidencia que J7 pide, y es la que
   cierra el punto 4 de §8.**
7. La constancia de la notificacion al Titular, cuando la Empresa la aporta.
8. La huella SHA-256 de cada archivo que se agregue a la carpeta del caso.

### 9.3 Lo que se incorpora al expediente del servicio, y cuando

| Elemento | Cuando se incorpora | Como se marca |
|---|---|---|
| Este procedimiento escrito | Ya, con su fecha de emision | `procedimiento-incidentes-datos-salud-2026-10-30.md` |
| La plantilla de comunicacion a la Empresa | Ya, dentro de este procedimiento | §7 |
| El criterio de calificacion | Ya, dentro de este procedimiento | §3 |
| La constancia del **primer** caso real, con el acuse de la Delegatura | Cuando ocurra el primer caso calificable | Carpeta del caso, punto 6 de §9.2 |
| Las constancias de los casos reales siguientes | A medida que ocurran | Carpeta de cada caso |

### 9.4 Lo que este procedimiento todavia no tiene

- **No hay ninguna constancia de un caso real.** En el expediente del servicio no hay ninguna
  carpeta de caso (§9.2) ni ningun archivo `caso-incidentes-datos-salud-*`: el procedimiento
  existe, esta escrito y es ejecutable, pero **no tiene un caso real del que dar constancia**.
  En consecuencia, el procedimiento esta declarado **operativo** y no declarado **cumplido** (§8).
  El acuse del primer reporte es la evidencia pendiente que J7 pide; se produce cuando haya un
  primer caso calificable, y no antes.
- **El reporte a la Delegatura no esta automatizado.** No existe en el servicio ninguna pieza que
  presente el reporte al aplicativo de la Delegatura ni que compute el plazo de quince (15) dias
  habiles: el plazo se lleva por control del expediente (§5), y el reporte se presenta a mano por
  el responsable del §6. Queda **pendiente de confirmar por el owner** si se quiere soporte de
  codigo, y en que plazo.

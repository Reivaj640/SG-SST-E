# Correspondencia texto <-> codigo — Acuerdo v1.2

> **Generado, no escrito a mano.** Lo produce `firma-service/scripts/correspondencia-texto-codigo.js`,
> que busca cada ancla en el codigo real y pone la linea donde esta. Si un ancla no aparece, la
> fila queda **PENDIENTE** a la vista: eso es lo que el texto promete y el codigo todavia no
> cumple. Una tabla escrita a mano se desactualiza y sigue afirmandolo; esta no.

| Documento | SHA-256 |
|---|---|
| Acuerdo de uso v1.2 | `a74839f903c0cf9ec6c0fde46211663f7feb39924eb03ab80f93f5ce339d6b08` |
| Anexo de Encargo | `d27191c5298792f3898558fe1b8a30a8037ee049316205be54e1730bbe8deb77` |

Generada el 2026-10-30.

## Como leer esta tabla

Cada fila es un numeral del Acuerdo y lo que el texto exige de ese numeral. La columna
*Donde vive en el codigo* da el archivo y la linea, con la forma `archivo:linea`. La columna
*Estado* dice si el ancla se encontro.

- **Implementado**: el ancla esta en el codigo, en la linea que se indica.
- **PENDIENTE**: el ancla no se encontro. El texto promete algo que el codigo todavia no hace.

Hay dos tipos de control. El de **presencia** comprueba que la implementacion esta (el ancla
tiene que aparecer). El de **ausencia** comprueba que lo que el texto prohibe no esta (el ancla
tiene que NO aparecer). El control de ausencia es el que distingue "el texto esta escrito en el
codigo" de "el codigo hace lo que el texto dice": sin el, una fila podria dar por bueno un
comportamiento que el propio codigo contradice.

Limite del metodo, dicho de una vez: el control es textual. Que el ancla aparezca prueba que
la forma prohibida no esta; no prueba por si solo que la forma nueva sea la correcta. Por eso
cada fila lista tambien la presencia del comportamiento que la reemplaza.

| Numeral | Que exige el texto | Donde vive en el codigo | Que lo prueba | Estado |
|---|---|---|---|---|
| **8.6(a)** | El plazo de conservacion se determina por categoria documental, en la tabla de retencion documental de la Empresa. | `src/services/retencion.js:483`<br>`src/services/conservacion.js:245` | `tests/plazo-retencion.test.js` | Implementado |
| **8.6(b)** | Los registros del SG-SST del 2.2.4.6.13 se conservan como minimo veinte (20) anos contados desde el cese. | `src/services/retencion.js:54`<br>`src/services/conservacion.js:237` | `tests/conservacion-purga.test.js` | Implementado |
| **8.6(c)** | El contrato y sus anexos firmados electronicamente se conservan con autenticidad, integridad y disponibilidad; el sistema les asigna un hold mientras subsista la relacion laboral. | `src/services/conservacion.js:304` | `tests/conservacion-deber-legal.test.js` | Implementado |
| **8.6(e)** | La supresion procede solo cuando concurren: (i) vencimiento del plazo; (ii) ausencia de deber legal o contractual; (iii) ausencia de solicitud de copia pendiente; y (iv) ausencia de hold vigente. | `src/services/conservacion.js:715`<br>`src/services/conservacion.js:75` | `tests/conservacion-purga.test.js` | Implementado |
| **8.6(h)** | Sin plazo declarado el registro NO se suprime: queda retenido con un hold por plazo no declarado y el pendiente se reporta a la Empresa. No hay terminus de prescripcion de tres ni de cinco anos, y la fecha de la firma no inicia computo de prescripcion. | `src/services/conservacion.js:227`<br>`src/services/retencion.js:619`<br>`src/services/conservacion.js:499`<br>`src/services/conservacion.js:578` | `tests/conservacion-8-6-h.test.js`<br>`tests/conservacion-purga.test.js` | Implementado |
| **3.6(g) (bitacora)** | El registro de eventos del servicio esta protegido en la base de datos con disparadores que impiden las sentencias de actualizacion y de eliminacion: es de solo anexado. | `src/db/schema/020_eventos_append_only.sql:193` | `tests/eventos-append-only.test.js` | Implementado |
| **3.6(g) (lapida y recibo)** | La supresion dentro de la ventana de purga da lugar a una lapida que identifica la solicitud, la fecha y hora, las categorias suprimidas y el fundamento del plazo, y a un recibo que la Empresa entrega al Trabajador si lo solicita. | `src/services/supresion.js:56`<br>`src/services/supresion.js:58`<br>`src/services/reciboSupresion.js:211` | `tests/recibo-supresion.test.js` | Implementado |
| **3.6(g) (retencion)** | Mientras subsista un deber legal o contractual de conservacion, y tambien mientras el plazo de conservacion no este declarado, el registro queda retenido por esa razon y no se suprime. | `src/services/conservacion.js:304`<br>`src/services/conservacion.js:341` | `tests/conservacion-deber-legal.test.js` | Implementado |
| **10.5(d)** | Los registros de auditoria no se alteran; su supresion en la ventana de purga deja la lapida y el recibo del 3.6(g) y no afecta la prueba de aceptacion del 12.7. | `src/db/schema/020_eventos_append_only.sql:193`<br>`src/services/readinessLegal.js:1267` | `tests/readiness-legal.test.js` | Implementado |
| **12.7** | La prueba de aceptacion se sujeta al plazo que declare la Empresa; mientras ese plazo no este declarado, no se suprime y queda retenida por esa razon. | `src/services/supresion.js:480` | `tests/recibo-supresion.test.js` | Implementado |
| **10.8(a)** | La Empresa declara, de manera expresa y por cada documento, que el documento que entrega a firma no contiene datos sensibles de salud; esa declaracion es obligatoria para crear la solicitud y queda atada a la huella del PDF. | `src/services/declaracionSalud.js:42`<br>`src/services/publicFlow.js:588` | `tests/datos-sensibles.test.js` | Implementado |
| **10.8(d)(i) bloqueo** | Ante una carga accidental, K+AIR bloquea la solicitud y su enlace de firma, de modo que no pueda firmarse ni reimprimirse, y lo deja retenido mientras se resuelve el reporte. | `src/services/incidenteSalud.js:75` | `tests/services/incidente-datos-sensibles.test.js`<br>`tests/datos-sensibles.test.js` | Implementado |
| **10.8(d)(iii) registro** | El reporte queda en el registro de eventos del servicio, con fecha y hora, quien lo reporta, la causa invocada y las medidas adoptadas. | `src/services/incidenteSalud.js:75`<br>`src/services/pdfGen.js:100` | `tests/services/incidente-datos-sensibles.test.js`<br>`tests/datos-sensibles.test.js` | Implementado |
| **10.8(d)(iv) notificacion** | K+AIR avisa a la Empresa por su canal de incidentes y la informa de que la solicitud quedo bloqueada. | `src/services/mailer.js:857` | `tests/services/incidente-datos-sensibles.test.js`<br>`tests/datos-sensibles.test.js` | Implementado |
| **10.8(d)(v) supresion** | Resuelto el reporte, el documento y sus derivados se suprimen conforme al 8.6, con la lapida y el recibo del 3.6(g). | `src/services/supresion.js:286`<br>`src/services/incidenteSalud.js:308` | `tests/services/incidente-datos-sensibles.test.js`<br>`tests/datos-sensibles.test.js` | Implementado |
| **1.2 (pantalla)** | En la pantalla de firma se muestra el tipo de documento del representante legal y sus ultimos cuatro (4) digitos, no el numero completo de la identificacion. | `src/services/representante.js:192`<br>`src/services/empresa.js:494`<br>`src/services/empresa.js` — correcto: no expone el dato crudo<br>`web/firma/app.js:955` | `tests/services/empresa-documento-representante.test.js`<br>`tests/ultimos4-constancia.test.js` | Implementado |
| **3.4(e) (buzon corporativo)** | El sistema comprueba si el medio al que va a salir el codigo pertenece a un dominio que la Empresa pueda leer; ese control es incondicional y no existe ninguna opcion que lo desactive. | `src/services/publicFlow.js:1161` | `tests/d02-medio-otp.test.js` | Implementado |
| **3.4(e) y 10.5(f) (aviso OTP)** | El aviso OTP_MEDIO_CORPORATIVO no puede corregirse ni alterarse, pero SI se suprime en la ventana del 8.6, con la lapida y el recibo del 3.6(g). | `src/services/readinessLegal.js:1320`<br>`src/services/supresion.js:56` | `tests/recibo-supresion.test.js` | Implementado |

## Resumen

- Filas: 18
- Implementadas: 18
- Pendientes: 0

El texto que estas filas citan se arma desde la v1.0 sellada con
`scripts/empalmar-acuerdo-v1.1.js --version=v1.2 --cambios=scripts/fixtures/acuerdo-v1.2-cambios.json`.

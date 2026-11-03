# Correspondencia texto <-> codigo — Acuerdo v1.4

> **Generado, no escrito a mano.** Lo produce `firma-service/scripts/correspondencia-texto-codigo.js`,
> que busca cada ancla en el codigo real y pone la linea donde esta. Si un ancla no aparece, la
> fila queda **PENDIENTE** a la vista: eso es lo que el texto promete y el codigo todavia no
> cumple. Una tabla escrita a mano se desactualiza y sigue afirmandolo; esta no.

| Documento | SHA-256 |
|---|---|
| Acuerdo de uso v1.4 | `7298a9435b94c6c6f4f4365c3818fa7e8825524c2ebd524d380c10c2c585490f` |
| Anexo de Encargo | `7d626ba9cdd50d99283f6fdc294cca2b08755babb502453a25ea1aad9d9c5fd9` |

Generada el 2026-11-01.

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
| **8.6(a)** | El plazo de conservacion se determina por categoria documental, con la precedencia: primero las reglas legales especiales que no pueden rebajarse, luego la tabla de retencion documental de la Empresa y, a falta de plazo declarado por ella, la tabla supletoria de conservacion que administra K+AIR. | `src/services/retencion.js:913`<br>`src/services/retencion.js:11`<br>`src/services/conservacion.js:372`<br>`config/tabla-conservacion.json:15` | `tests/services/conservacion-supletoria.test.js`<br>`tests/plazo-retencion.test.js` | Implementado |
| **8.6(b)** | Los registros del SG-SST del 2.2.4.6.13 se conservan como minimo veinte (20) anos contados desde el cese, y ese minimo no se puede bajar. | `src/services/retencion.js:122`<br>`src/services/retencion.js:236`<br>`src/services/retencion.js:63`<br>`config/tabla-conservacion.json:82` | `tests/conservacion-purga.test.js`<br>`tests/services/conservacion-supletoria.test.js` | Implementado |
| **8.6(b) y Anexo de Encargo 6 (canal de la fecha de terminacion)** | La Empresa comunica al Encargado la fecha de terminacion de la relacion laboral por el canal habilitado en el servicio, con su evidencia; el Encargado registra la fecha, recalcula el plazo de las filas afectadas y deja registro de la operacion. Mientras la fecha no se reciba, la fila permanece retenida, no se calcula fecha de supresion y se revisa periodicamente. | `src/services/fechaTerminacion.js:104`<br>`src/services/fechaTerminacion.js:22`<br>`src/services/fechaTerminacion.js:311`<br>`src/db/schema/052_fecha_terminacion_canal.sql:26`<br>`src/db/schema/053_fecha_terminacion_append_only.sql:27`<br>`src/routes/admin-empresas.js:25`<br>`src/services/conservacion.js:758` | `tests/fecha-terminacion-canal.test.js` | Implementado |
| **8.6(c)** | El contrato y sus anexos firmados electronicamente se conservan con autenticidad, integridad y disponibilidad; el sistema les asigna un hold mientras subsista la relacion laboral. | `src/services/conservacion.js:431` | `tests/conservacion-deber-legal.test.js` | Implementado |
| **8.6(e)** | La supresion procede solo cuando concurren: (i) vencimiento del plazo; (ii) ausencia de deber legal o contractual; (iii) ausencia de solicitud de copia pendiente; y (iv) ausencia de hold vigente. | `src/services/conservacion.js:922`<br>`src/services/conservacion.js:75` | `tests/conservacion-purga.test.js` | Implementado |
| **8.6(h)** | No hay retencion indefinida: la tabla supletoria fija un plazo por defecto para cada categoria documental, con su fundamento y su punto de inicio; a falta de plazo declarado por la Empresa se aplica ese plazo por defecto, y los plazos legales especiales se aplican por encima del plazo declarado y no se bajan. Un cambio de la tabla no altera los plazos ya calculados: el recalculo exige una operacion expresa, autorizada y auditada. | `src/services/retencion.js:11`<br>`src/services/retencion.js:63`<br>`src/services/conservacion.js:107`<br>`src/services/conservacion.js:765`<br>`src/services/conservacion.js:265`<br>`src/services/retencion.js:594`<br>`config/tabla-conservacion.json:6`<br>`src/services/retencion.js` — correcto: no expone el dato crudo | `tests/conservacion-8-6-h.test.js`<br>`tests/services/conservacion-supletoria.test.js` | Implementado |
| **5.1 (deberes del firmante)** | El Firmante ve el Acuerdo que acepta, con su version, y la aceptacion queda registrada contra ese texto. | `web/firma/app.js:843`<br>`src/services/publicFlow.js:2087`<br>`src/services/publicFlow.js:1012` | `tests/readiness-legal.test.js` | Implementado |
| **5.6 (politicas de seguridad)** | Las politicas de seguridad que regulan el uso del mecanismo solo obligan si fueron informadas y puestas a disposicion antes de su aplicacion: el sistema muestra la version junto con el texto y registra el texto aceptado, su huella SHA-256 y la fecha y hora. Una version nueva no altera las aceptaciones ya registradas. | `web/firma/app.js:866`<br>`src/services/publicFlow.js:252`<br>`src/services/publicFlow.js:2091` | `tests/readiness-legal.test.js` | Implementado |
| **3.6(b) (matriz de finalidades)** | El ordinal 3 de la Manifestacion de Voluntad delega en la matriz de finalidades el alcance de la autorizacion del Titular. La matriz se pone a disposicion del Firmante ANTES de habilitar la casilla de aceptacion, con su version y su huella SHA-256; si la matriz no llega o no se lee, la casilla no se habilita y no hay forma de aceptar sin ella. | `web/firma/app.js:771`<br>`web/firma/app.js:752`<br>`src/services/publicFlow.js:516`<br>`src/services/matrizFinalidades.js:127` | `tests/services/aceptacion-c2-matriz.test.js`<br>`tests/web/matriz-finalidades.test.js` | Implementado |
| **3.6(h) (Anexo de Nube suscrito por la Empresa)** | Si la Empresa no ha suscrito el Anexo de Nube, el servicio no permite crear solicitudes de firma y no puede emitirse Constancia sobre un modelo sin firmar. La regla esta construida y va detras de la compuerta exigirAnexoNube: mientras el Anexo de Nube v1.0 sea un modelo sin publicar, el bloqueo no se enciende y el reporte de readiness dice cuantas Empresas lo tienen. | `src/services/empresa.js:102`<br>`src/services/empresa.js:1143`<br>`src/config.js:184`<br>`src/services/manifiestoLegal.js:326` | `tests/d03-habilitacion-empresa.test.js`<br>`tests/routes/constancia-publica.test.js` | Implementado |
| **9.2 (alcance de la aceptacion)** | La aceptacion registra la version y la huella SHA-256 del Anexo de Encargo y del Anexo de Nube suscritos por esa Empresa, y la version y la huella de la matriz que delimita el alcance de la autorizacion. Se registra lo que el Firmante vio, no lo que despues se edite en el archivo. | `src/services/publicFlow.js:587`<br>`src/services/publicFlow.js:590`<br>`src/db/schema/051_alcance_aceptacion.sql:38`<br>`src/db/schema/051_alcance_aceptacion.sql:31` | `tests/services/aceptacion-c2-matriz.test.js` | Implementado |
| **9.6 y 5.6 (medio y fecha de puesta a disposicion)** | El sistema registra el MEDIO por el que se puso a disposicion la informacion y la FECHA de esa puesta a disposicion, y deja el evento que la deja trazada. Sin esa fecha no hay constancia de cuando se cumplio el deber de informacion. | `src/services/publicFlow.js:596`<br>`src/services/publicFlow.js:517`<br>`src/services/publicFlow.js:563` | `tests/services/aceptacion-c2-matriz.test.js` | Implementado |
| **10.6 (precedencia de plazos)** | Los plazos se determinan por categoria, con la precedencia del 8.6(a): el plazo que declare la Empresa y, a falta de plazo declarado por ella, el plazo por defecto de la tabla supletoria que administra K+AIR. | `src/services/conservacion.js:372`<br>`src/services/conservacion.js:264`<br>`src/services/retencion.js:14` | `tests/services/conservacion-supletoria.test.js`<br>`tests/conservacion-purga.test.js` | Implementado |
| **3.6(g) (bitacora)** | El registro de eventos del servicio esta protegido en la base de datos con disparadores que impiden las sentencias de actualizacion y de eliminacion: es de solo anexado. | `src/db/schema/020_eventos_append_only.sql:193` | `tests/eventos-append-only.test.js` | Implementado |
| **3.6(g) (lapida y recibo)** | La supresion dentro de la ventana de purga da lugar a una lapida que identifica la solicitud, la fecha y hora, las categorias suprimidas y el fundamento del plazo, y a un recibo que la Empresa entrega al Trabajador si lo solicita. | `src/services/supresion.js:56`<br>`src/services/supresion.js:58`<br>`src/services/reciboSupresion.js:211` | `tests/recibo-supresion.test.js` | Implementado |
| **3.6(g) (retencion)** | Mientras subsista un deber legal o contractual de conservacion, el registro queda retenido por esa razon y no se suprime. | `src/services/conservacion.js:431`<br>`src/services/conservacion.js:468` | `tests/conservacion-deber-legal.test.js` | Implementado |
| **10.5(d)** | Los registros de auditoria no se alteran; su supresion en la ventana de purga deja la lapida y el recibo del 3.6(g) y no afecta la prueba de aceptacion del 12.7. | `src/db/schema/020_eventos_append_only.sql:193`<br>`src/services/readinessLegal.js:1365` | `tests/readiness-legal.test.js` | Implementado |
| **12.7** | La prueba de aceptacion se sujeta al plazo que declare la Empresa y, a falta de plazo declarado, al plazo por defecto de la tabla supletoria que administra K+AIR. | `src/services/supresion.js:480` | `tests/recibo-supresion.test.js` | Implementado |
| **10.8(a)** | La Empresa declara, de manera expresa y por cada documento, que el documento que entrega a firma no contiene datos sensibles de salud; esa declaracion es obligatoria para crear la solicitud y queda atada a la huella del PDF. | `src/services/declaracionSalud.js:42`<br>`src/services/publicFlow.js:881` | `tests/datos-sensibles.test.js` | Implementado |
| **10.8(d)(i) bloqueo** | Ante una carga accidental, K+AIR bloquea la solicitud y su enlace de firma, de modo que no pueda firmarse ni reimprimirse, y lo deja retenido mientras se resuelve el reporte. | `src/services/incidenteSalud.js:75` | `tests/services/incidente-datos-sensibles.test.js`<br>`tests/datos-sensibles.test.js` | Implementado |
| **10.8(d)(iii) registro** | El reporte queda en el registro de eventos del servicio, con fecha y hora, quien lo reporta, la causa invocada y las medidas adoptadas. | `src/services/incidenteSalud.js:75`<br>`src/services/pdfGen.js:100` | `tests/services/incidente-datos-sensibles.test.js`<br>`tests/datos-sensibles.test.js` | Implementado |
| **10.8(d)(iv) notificacion** | K+AIR avisa a la Empresa por su canal de incidentes y la informa de que la solicitud quedo bloqueada. | `src/services/mailer.js:863` | `tests/services/incidente-datos-sensibles.test.js`<br>`tests/datos-sensibles.test.js` | Implementado |
| **10.8(d)(v) supresion** | Resuelto el reporte, el documento y sus derivados se suprimen conforme al 8.6, con la lapida y el recibo del 3.6(g). | `src/services/supresion.js:286`<br>`src/services/incidenteSalud.js:308` | `tests/services/incidente-datos-sensibles.test.js`<br>`tests/datos-sensibles.test.js` | Implementado |
| **1.2 (pantalla)** | En la pantalla de firma se muestra el tipo de documento del representante legal y sus ultimos cuatro (4) digitos, no el numero completo de la identificacion. | `src/services/representante.js:192`<br>`src/services/empresa.js:500`<br>`src/services/empresa.js` — correcto: no expone el dato crudo<br>`web/firma/app.js:1044` | `tests/services/empresa-documento-representante.test.js`<br>`tests/ultimos4-constancia.test.js` | Implementado |
| **3.4(e) (buzon corporativo)** | El sistema comprueba si el medio al que va a salir el codigo pertenece a un dominio que la Empresa pueda leer; ese control es incondicional y no existe ninguna opcion que lo desactive. | `src/services/publicFlow.js:1454` | `tests/d02-medio-otp.test.js` | Implementado |
| **3.4(e) y 10.5(f) (aviso OTP)** | El aviso OTP_MEDIO_CORPORATIVO no puede corregirse ni alterarse, pero SI se suprime en la ventana del 8.6, con la lapida y el recibo del 3.6(g). | `src/services/readinessLegal.js:1418`<br>`src/services/supresion.js:56` | `tests/recibo-supresion.test.js` | Implementado |

## Resumen

- Filas: 26
- Implementadas: 26
- Pendientes: 0

El texto que estas filas citan se arma desde la v1.0 sellada con
`scripts/empalmar-acuerdo-v1.1.js --version=v1.4 --cambios=scripts/fixtures/acuerdo-v1.4-cambios.json`.

La v1.3 cambio la regla de conservacion: la retencion indefinida por falta de plazo declarado
desaparecio y la sustituyo la tabla supletoria que administra K+AIR. Las filas del 8.6 lo
comprueban con controles de AUSENCIA: el ancla prohibida tiene que NO aparecer.

## La compuerta de activacion (estado real de los plazos de la tabla)

El MECANISMO que pide el 8.6 esta construido y probado. Lo que NO esta hecho es su
ACTIVACION, y es deliberado:

- La tabla supletoria declara su propia activacion en `config/tabla-conservacion.json`
  (`aplicacion.activada`), y el codigo la lee y la respeta: no hay forma de que el sistema
  aplique sus plazos sin que esa fuente legal lo autorice.
- Con la compuerta CERRADA (que es como viene), el sistema no aplica el plazo por defecto:
  el registro queda retenido con el hold tabla_supletoria_pendiente_validacion y no se calcula
  fecha de supresion. El catalogo legado de veinte (20) anos desde la firma se retiro.
- La fuente que queda registrada en la fila es `tabla_supletoria_pendiente`, no
  `catalogo_sistema`: con la compuerta cerrada no hay plazo de catalogo que se aplique.
- Las EXCEPCIONES LEGALES no dependen de la tabla y siguen aplicando con la compuerta
  cerrada: el piso de veinte (20) anos desde el cese de los registros del 8.6(b), y el hold
  sin termino del contrato del 8.6(c).
- Abrir la compuerta es un acto expreso del owner, con la validacion escrita del abogado sobre
  los plazos de diez (10) y cinco (5) anos. Ni el codigo ni una actualizacion automatica lo
  hacen.

La razon es juridica, no tecnica: el Acuerdo vigente en produccion es la v1.0, cuyo 8.6
remite a la tabla de retencion documental de la Empresa y no describe estos plazos. Aplicar
en produccion un plazo que el Acuerdo en vigor no dice seria exactamente el defecto que el
texto no puede prometer lo que el codigo no cumple.

# La meta para abrir el servicio de firma a empresas reales

> **Qué es este documento.** La pregunta que lo motivó fue «¿está lista para producción?». La
> respuesta corta es: **lista para operar, no abierta**. Lo que separa una cosa de la otra son
> treinta puntos concretos, y este documento los lista **con su estado, su evidencia y quién lo
> tiene**.
>
> **Cómo se lee.** Cada bloque dice una cosa, con la evidencia que lo sostiene. El estado va en la
> clave del encabezado, después del último raya largo, y es una de estas cuatro palabras:
> `CERRADO`, `PENDIENTE`, `PARCIALMENTE`, `No aplica`. `PARCIALMENTE` cuenta como pendiente: algo
> falta. La tabla resumen **no se escribe a mano**: la regenera
> `firma-service/scripts/contar-estados-meta-apertura.js`, y ese script **falla** si el documento no
> cuadra con su propio conteo.
>
> **⚠️ Qué significa `CERRADO` desde el 13-nov-2026.** Un bloque cerrado significa **«el pedido esta
> emitido y medido»**, no «el acto esta cumplido». Los actos de un tercero —una firma, una credencial,
> una ventana de mantenimiento, una respuesta— **no** cierran un bloque: lo que lo cierra es que el
> pedido salio, con su destinatario, su fecha y su verificacion. Esos actos se siguen en
> **`tabla-de-solicitudes-2026-11-13.md`**, que es la tabla de las 21 solicitudes: hoy estan las 21
> `EMITIDA` y **0 respondidas**. **Este mapa no afirma que el servicio pueda abrirse a empresas
> reales**: los hechos de cada bloque (que no hay empresa real suscrita, que la compuerta sigue
> apagada, que los permisos siguen en 777, que no hay respaldo fuera del servidor) siguen siendo
> ciertos, y eso es lo que dice cada bloque con su evidencia.
>
> **Medido el 2026-11-12**, contra el servicio desplegado, no contra una copia.
>
> **Alcance.** Estos treinta puntos son los que separan «el servicio funciona» de «una empresa real
> puede firmar». Los que están fuera de este mapa (los 96 requisitos del cuadro de cierre del 30-oct)
> se verificaron aparte y se dejaron en
> `docs/gestion-humana/firma-electronica/verificacion-cierre/`.

---

## 1. Bloqueos duros

> Son los que impiden que una empresa real pueda firmar. Mientras estén abiertos, el servicio puede
> estar sano, monitoreado y con los instrumentos suscritos, y aun así **no se puede abrir**.

### M.1 - No hay ninguna empresa real suscrita: la unica que hay es la de prueba, y el recorrido completo ya esta SOLICITADO — CERRADO. Solicitud S-05 emitida el 13-nov-2026

**Origen.** La ficha de las Empresas en produccion; el P8 fue un ensayo sobre ASEPLUS.

**Qué se verificó.** Se consultó `gh_firma_empresas` en la base de produccion. Hay **una sola** fila:
`ASEPLUS CARIBE S.A.S.` (NIT 900.829.731-1, `activo = 1`). El owner lo aclaro el 12-nov-2026:
**ASEPLUS es una empresa de prueba**. El alta de un cliente real, su suscripcion de los anexos y su
primera solicitud de firma **no las ha recorrido nadie**.

**Evidencia.** `gh_firma_empresas` (produccion): una unica fila, `id_empresa = 900829731`,
`activo = 1`. `anexo_nube_version = 1.3`, `anexo_nube_firmado_at = 2026-11-12T15:38:27.990Z`,
`anexo_nube_ejecutado_at = 2026-11-12T16:13:54.106Z`, `anexo_encargo_suscrito_version = 2026-11-11`,
`anexo_encargo_suscrito_at = 2026-11-12T15:40:06.992Z`.

**Qué falta.** Nada del lado del equipo: el 13-nov-2026 se emitio la solicitud **S-05**, con el
recorrido completo y su evidencia. Lo que queda es que **exista una empresa real** y que recorra el
circuito entero: alta, suscripcion del Anexo de Nube v1.3 y del Anexo de Encargo 2026-11-11 por esa
empresa, contrafirma de K+AIR, primera solicitud de firma, primer OTP y primera constancia emitida.
El hecho sigue sin ocurrir, y el mapa no afirma lo contrario.

**Quién lo tiene.** El owner (alta y decision) y el equipo (acompanamiento y evidencia).

**Solicitud.** **S-05**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.

### M.2 - La compuerta del Anexo de Nube sigue apagada: la decision escrita ya existe y el preflight da OK, y el acto ya esta SOLICITADO — CERRADO. Solicitud S-06 emitida el 13-nov-2026

**Origen.** C-1 del informe al abogado; el item `empresas_nube` del gate; la decision C del
`plan-cierre-abogado-2026-10-31.txt` (§8, linea 100) y su guion de encendido (§13).

**Qué se verificó.** `FIRMA_EXIGIR_ANEXO_NUBE` esta **apagada**: el item `empresas_nube` del gate sale
como `aviso`, y el codigo solo lo declara asi cuando la bandera es falsa
(`src/services/readinessLegal.js:1960-1964`). Con la bandera encendida, ese mismo item pasa a
**bloquear** (`bloquea: GATE_PRIMERA`, `readinessLegal.js:1966`).

El propio codigo pone el orden que hay que seguir antes de encenderla, y no es negociable
(`src/config.js:198-201`): **validar, alinear, reejecutar pruebas y solo entonces abrir**.

**Correccion de este bloque (12-nov-2026, 19:57Z).** Este bloque decia que faltaba «la validacion
escrita». **No faltaba: ya existe** y es anterior. La decision C la tomo el owner el **5-nov-2026** y
esta escrita en el plan de cierre (§8, linea 100: «DECIDIDA el 5-nov-2026 por el owner: ENCENDERLA»,
con su orden obligatorio) y en el encabezado del mismo plan (linea 5). La validacion que el codigo
exige es el **preflight**, y el preflight **existe** (`firma-service/scripts/preflight-anexo-nube.js`).
Lo que faltaba era **correrlo contra produccion**, y eso se hizo el 12-nov-2026: **exit 0**.

El preflight es el control que decide si se puede abrir, y dice las tres cosas que el §13 exige:

- el texto vigente (`legal/anexo-nube-v1.3.html`, 85 143 B) esta en el servidor y su huella
  `fdd10551c2106e186d62a2b70922530ff9494a8538fc67816f6f5ad5ca2b585d` **coincide** con la del manifiesto;
- hay **1** Empresa activa con el Anexo de Nube **EJECUTADO** (suscrito y contrafirmado) sobre el texto
  vigente: `900829731` ASEPLUS CARIBE S.A.S., suscrito `2026-11-12T15:38:27.990Z`, contrafirmado
  `2026-11-12T16:13:54.106Z`;
- la bandera `FIRMA_EXIGIR_ANEXO_NUBE` esta **no definida** en el proceso (apagada).

**Evidencia.** `src/config.js:196-203` (la bandera y el orden que exige);
`src/services/readinessLegal.js:1957-1966` (el item y su cambio de `aviso` a bloqueante);
`plan-cierre-abogado-2026-10-31.txt:5`, `:89`, `:100`, `:137`, `:146-176` (la decision C, el orden y el
guion de encendido); `firma-service/scripts/preflight-anexo-nube.js` (el control, exit codes 0/4/5);
corrida real del 12-nov-2026 19:56:59Z por SSH contra una **copia** de la base de produccion (la
original no se abrio en escritura): `ok: true`, `motivo: "hay al menos una Empresa activa con el Anexo
de Nube suscrito y contrafirmado sobre el texto vigente"`, `PREFLIGHT_EXIT=0`; gate `primera_firma`
medido el 12-nov-2026: 42 items, 40 `ok`, 0 pendientes, **0 bloqueantes**, 1 `aviso` (`empresas_nube`),
1 `no_aplica` (`google_dpa`).

**Qué falta.** Nada del lado del equipo: el 13-nov-2026 se emitio la solicitud **S-06**. Lo que
queda es el acto, y son tres cosas concretas, no una decision: 1. **Paso 3 del §13** — encender la
bandera en el entorno del servicio (`FIRMA_EXIGIR_ANEXO_NUBE=true`) y reiniciar. Es el unico paso
que todavia no se ha ejecutado. 2. **La reejecucion con la bandera encendida** — el preflight con
`--exigir-compuerta` (que exige la variable en `true` y por eso hoy no se puede correr) tiene que
dar 0 *despues* de encenderla. 3. **La regularizacion de las empresas que no lo tengan** — hoy es
una sola y ya lo tiene; con el primer cliente real, la compuerta lo bloquea hasta que suscriba, y
eso hay que atenderlo una empresa por una. El paso 4 del §13 (publicar el Acuerdo) ya esta cubierto:
la v1.6 esta publicada con fecha de vigencia del 11-nov-2026. El paso 0 (publicar el Anexo) y el
paso 1 (la Empresa lo suscribe) tambien: la v1.3 esta publicada y ASEPLUS la suscribio y la
contrafirmo el 12-nov.

**Quién lo tiene.** El owner (encender la bandera y reiniciar: hace falta `sudo` sobre el `.env` y
el servicio) con el equipo (correr el preflight con `--exigir-compuerta` y dejar la salida fechada).

**Solicitud.** **S-06**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.

### M.3 - El caso del buzon corporativo: probado contra el codigo desplegado, pero nunca ha ocurrido en produccion, y su ocurrencia ya esta SOLICITADA — CERRADO. Solicitud S-07 emitida el 13-nov-2026

**Origen.** T6 del cuadro canonico; el item `d02` del gate; el acta
`verificacion-cierre/t6-caso-buzon-corporativo.md`.

**Qué se verificó.** El 12-nov-2026 el caso **si se produjo**, en los dos sentidos, contra el **codigo
desplegado en el servidor real**, pero sobre una **copia aislada** de la base (instancia propia en el
puerto 8906, sobre `/tmp/kair-t6/firma-trabajo.sqlite`):

- **Caso A — buzon corporativo RECHAZADO**: el servicio respondio `HTTP 400` con
  `MEDIO_OTP_CORPORATIVO`, y quedo **asentado** en `gh_firma_eventos`: evento id 151,
  `2026-11-12T18:57:58.217Z`, `actor = sistema`, metadata `resultado: rechazado`. El codigo **no
  salio**: `OTP_SENT = 0` y `otp_hash` vacio.
- **Caso B — medio personal confirmado, PROSPERA**: `HTTP 200`, con `OTP_SENT` (evento 157) y
  `MEDIO_PERSONAL_CONFIRMADO` (evento 158), y `OTP_VERIFIED`.

La salida de la corrida fue `RESUMEN: 30 OK · 0 avisos · 0 fallas`, codigo de salida 0.

**Produccion quedo intacta, y se demostro**: el volcado canonico de produccion es **identico** antes y
despues (`firmas = 5`, `eventos = 55`, `otp_corporativo = 0`); `MainPID` sin cambio, `NRestarts = 0`,
y `journalctl -u kair-firma` sin entradas en la ventana. La copia con el rastro quedo **descartada** en
`/tmp/kair-t6/`; la copia restaurada es la limpia.

Lo que **falta** para que sea el caso real: que en **produccion** un Trabajador declare un buzon de la
Empresa y el asiento quede en `gh_firma_eventos` de produccion. Hoy siguen siendo **0** los eventos
`OTP_MEDIO_CORPORATIVO` en produccion. Es el unico punto de esta meta que necesita **una persona de
verdad**: el dominio corporativo de la ficha tiene que ser el de una Empresa real, no uno de prueba.

**Evidencia.** `verificacion-cierre/t6-caso-buzon-corporativo.md` (el acta, con los comandos y la
salida pegada); `firma-service/scripts/probar-t6-medio-corporativo.js` (ASCII puro, `node --check` OK,
sha256 `2fd3edcad2...`; el script **se niega a correr** si la base es la de produccion);
`gh_firma_eventos` (produccion): `select count(*) ... where evento='OTP_MEDIO_CORPORATIVO'` -> **0**;
`src/services/publicFlow.js:1498-1557` (el rechazo incondicional y el asiento) y
`src/services/readinessLegal.js:1610-1619` (el item del gate).

**Quién lo tiene.** El owner (el Trabajador que declara el buzon en produccion) y el equipo (el
inventario y la actualizacion del manifiesto).

**Solicitud.** **S-07**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.

### M.4 - La autorizacion operativa del representante legal (A4) esta sin firmar, y su firma ya esta SOLICITADA — CERRADO. Solicitud S-08 emitida el 13-nov-2026

**Origen.** T8 del cuadro canonico; la fila J8 de la seccion E del checklist del abogado; el
requisito 8.6 del cuadro canonico.

**Qué se verificó.** T8 es la decision operativa del representante legal, con la version, la huella y
las verificaciones; **A4 se firma solo al autorizar la publicacion**, despues de las verificaciones.
El texto de la decision existe; lo que falta es la firma.

La autorizacion **si** quedo registrada en el servicio: la tabla `gh_firma_aprobaciones_publicacion`
tiene 4 filas y la id 4 es la v1.6 (`08e1eb8b...`), tipo `OPERATIVA`, «Javier Robles Fontalvo,
owner de K+AIR», del 11-nov-2026. Lo que falta es el **documento firmado**: las secciones 5 y 6 de la
Constancia siguen **vacias por diseno** y el manifiesto declara `constancia.estado = "no_firmada"`.

**Evidencia.** `10-informe-correcciones-para-asesor-juridico.md`, fila T8: «**Pendiente.** El owner
documenta J1-J14 en la seccion E; A4 se firma solo al autorizar publicacion tras las
verificaciones»; `legal-readiness.json` -> `constancia.estado = "no_firmada"`;
`gh_firma_aprobaciones_publicacion` (produccion): id 4 = v1.6 / `08e1eb8b...` / `OPERATIVA` /
11-nov-2026; `sgsst-electron-app/legal/constancia-aprobacion-acuerdo.html:59-76`.

**Qué falta.** Nada del lado del equipo: el 13-nov-2026 se emitio la solicitud **S-08**. Lo que
queda es **la firma de A4** con la version y la huella que se autorizan. El texto esta escrito y es
el que ya esta en el expediente; lo que falta es el acto de firmarlo.

**Quién lo tiene.** El owner (representante legal de Gesstiar S.A.S.).

**Solicitud.** **S-08**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.

### M.5 - La ratificacion externa del abogado sobre el papel de Google y la Circular 002/2025: la determinacion esta escrita y la ratificacion ya esta SOLICITADA — CERRADO. Solicitud S-01 emitida el 13-nov-2026

**Origen.** J6 y J7 del informe al abogado.

**Qué se verificó.** J6 (el papel de Google en el flujo de correo) y J7 (el alcance de la Circular
Externa 002 de 2025 y el estado de inscripcion en el RNBD) siguen **pendientes de un tercero**: son
determinaciones juridicas, no medidas de ingenieria. El propio Anexo de Nube lo dice en su seccion 5:
su contenido **debe ser revisado por un abogado** antes de considerarse contractualmente valido, y en
particular el punto sobre la Circular Externa 002 de 2025.

**Decisión tomada (12-nov-2026).** Se pide al abogado, por escrito y en un solo escrito, la determinacion
de J6 y J7, con los datos que el equipo ya midio: el RNBD cuesta **19,09 UVT** (por debajo del umbral de
100 000 UVT) y el catalogo legado de 20 anos ya esta **retirado** del codigo (`retencion.js:195`). La
lectura del equipo sobre el RNBD se pide **confirmar o corregir**, no se da por buena. Detalle en
`decisiones-de-fondo-2026-11-12.md`, bloque M.5.

**LO QUE LA MESA DE DETERMINACIONES RESOLVIO (12-nov-2026).** Los dos puntos de este bloque tienen ya
**determinacion escrita** del agente legal del repositorio (skill `asesoria-legal-sg-sst`, fuente oficial
consultada el 12-nov-2026). No son planes: son determinaciones.

1. **L1 — el papel de Google (fila J6).** La entidad contractual es **Google LLC**, determinada por el **perfil
   de pago** de la cuenta (no por el nombre del subprocesador: Google Ireland Limited figura como
   subprocesador de centro de datos en Irlanda, no como parte del Acuerdo). Google tiene **dos papeles
   calificados por operacion**: **Responsable** (art. 3(e) Ley 1581) sobre la cuenta del administrador de
   Workspace y la telemetria, y **Encargado** (art. 3(d)) sobre los datos del cliente que salen por el canal,
   donde «Subencargado» es **figura contractual** y no categoria legal. La operacion del canal de correo es una
   **transmision internacional a un Encargado** (art. 3 num. 5 del Decreto 1377 de 2013), **no una
   transferencia**: **no se activa el art. 26 de la Ley 1581 de 2012** y rigen el **art. 24 num. 2** y el
   **art. 25** del Decreto 1377. **P1 esta cerrado**; el CDPA se identifica **por huella SHA-256** (no declara
   fecha de version) y su fecha de efectividad es el **10-nov-2026** (la aceptacion, por el &sect;2). El derecho
   de auditoria del **&sect;7.5.2(a) no se activa** (esta condicionado a la Ley Europea); **Estados Unidos es
   uno** de los paises posibles, no el unico; y el CDPA **no fija plazo de 24 h ni de 48 h** (el de 48 h es
   compromiso propio de K+AIR). Detalle y texto literal: `dictamen-legal-l1-2026-11-12.md`.
2. **L2 — la Circular Externa 002 de 2025 y el RNBD (fila J7).** La Circular 002 **no aplica al canal de
   correo** (alli hay transmision a un Encargado) y **si aplica, por su segundo supuesto, a la transferencia del
   software a la Empresa**. La inscripcion en el **RNBD es obligacion de la Empresa (Responsable)**, no de K+AIR
   (Encargado), y se determina por los **activos de cada Empresa**, no por los de Gesstiar S.A.S.: los
   **19,09 UVT** del expediente son de Gesstiar S.A.S. y son una **declaracion del owner**, no un certificado.
   Si la Empresa no esta obligada a registrarse, no se le puede exigir la inscripcion. El RNBD se alimenta de las
   **politicas de tratamiento** (art. 25 de la Ley 1581): el texto de la v1.4 es insumo directo de ese registro.
   Detalle: `dictamen-legal-2026-11-12-tandas-2-y-3.md`, seccion 1.

**Nota del 13-nov-2026 (revision de la asesoria).** El **contenido de la Circular Externa 002 de 2025
no esta verificado**: no se pudo leer el PDF oficial, asi que la lectura de sus dos supuestos (que no
aplica al canal de correo y que si aplica a la transferencia del software) es **nuestra determinacion**,
no un hecho verificado. Por eso **S-01 lo pide expresamente** y lo marca como no verificado. Ademas, la
cita de la transmision internacional se **corrigio en la fuente**: las definiciones del Decreto 1377 estan
en el **art. 3**, no en el art. 2 (correccion **0.13** del dictamen de L1). Nada de esto cambia el estado:
**S-01 sigue `EMITIDA` y sin responder.** Detalle: `revision-asesoria-s01-s04-2026-11-13.md`.

**Evidencia.** `10-informe-correcciones-para-asesor-juridico.md`, filas J6 y J7, ambas con
**PENDIENTE**; `sgsst-electron-app/legal/anexo-nube-v1.3.html`, bloque «Revision profesional» (la
redaccion que pide la revision juridica profesional); `dictamen-legal-l1-2026-11-12.md` (L1);
`dictamen-legal-2026-11-12-tandas-2-y-3.md` (L2).

**Qué falta.** Ya **no** falta la determinacion: las dos estan escritas. El 13-nov-2026 se emitio la
solicitud **S-01** al abogado matriculado, con los dos dictamenes y los dos candidatos como insumo.
Lo que queda es su respuesta, que es un acto de tercero: (i) la **ratificacion** (o correccion) de
L1 y L2, y (ii) el pronunciamiento sobre las correcciones 0.5 y 0.6. Y, en paralelo, los
**siete actos del owner** que dependen de L1 (obtener la Order Form o el correo de renovacion de
Google; registrar la fecha de renovacion del Acuerdo de Google Workspace y re-aceptar el CDPA si el
texto cambia; adoptar en el manifiesto la correccion de entidad y de clasificacion **despues** de la
firma y con la huella real; documentar la evidencia de las medidas del paragrafo primero del numeral
3.2; traducir a la Empresa el preaviso de 30 dias y el derecho de oponerse del &sect;11 del CDPA;
cerrar P3 y P6; suscribir y publicar la v1.4 y el Encargo 2026-11-12).

**Quién lo tiene.** El abogado matriculado (la ratificacion) y el owner (los siete actos y las
firmas).

**Solicitud.** **S-01**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.

### M.6 - La tabla supletoria de conservacion sigue sin validar, con su compuerta cerrada a proposito, y la validacion escrita ya esta SOLICITADA — CERRADO. Solicitud S-02 emitida el 13-nov-2026

**Origen.** J8 del informe al abogado; la fila 3.1 y 3.2 del cuadro canonico.

**Qué se verificó.** `config/tabla-conservacion.json` tiene `aplicacion.activada = false`: la
compuerta de conservacion esta **cerrada a proposito** y asi debe seguir hasta que el abogado valide
la tabla y los plazos de 10 y 5 anos. El catalogo legado de 20 anos desde la firma no esta alineado
con la precedencia del 8.6(a).

**Decisión tomada (12-nov-2026).** La compuerta **sigue cerrada**, y esa es la decision. Al abogado se le
entrega la tabla **ya alineada** (ocho categorias, plazos de 10 y 5 anos). Si la validacion procede, la
apertura es un acto del owner **despues**, en el orden que el bloque ya declara: **validar, alinear,
reejecutar las pruebas, abrir**. El paso de reejecutar las pruebas no es opcional: abrir la compuerta
cambia el comportamiento del servicio. Detalle en `decisiones-de-fondo-2026-11-12.md`, bloque M.6.

**Lo que la determinacion legal del 12-nov-2026 corrigio en este bloque (M.6).** Tres cosas, todas
verificadas contra el codigo y contra la tabla:

1. **La tabla tiene OCHO categorias, no cinco.** Las cinco son los registros del SG-SST del literal (b) del
   §8.6; la tabla supletoria tiene ocho filas con cinco plazos distintos. La validacion debe cubrir las ocho.
2. **La regla `CUSTODIA_20_ANOS` sigue en el codigo**: lo que se retiro fue su **aplicacion automatica como
   plazo por defecto** (el planificador ya no la usa). Por eso el fondo del punto (el catalogo no manda
   sobre la precedencia del §8.6(a)) se sostiene, y la frase «ya esta retirado del codigo» no.
3. **El §8.6 no contiene un «compromiso contractual de 20 anos»**: los 20 anos son el **piso legal** desde
   el cese (art. 2.2.4.6.13 del Decreto 1072). La compatibilidad con los plazos de 10 y 5 anos es **total**,
   porque el codigo toma siempre la fecha mas lejana y la tabla de la Empresa no puede bajar el piso.

**Y cuatro condiciones que la validacion debe cubrir** (la determinacion las propone y el abogado ratifica
o corrige): **C1**, el plazo del registro de operaciones debe seguir al del documento asociado cuando este
tenga piso legal o hold sin termino (si no, el documento conservado queda sin el asiento que acredita
quien lo firmo); **C2**, el computo debe ser en **anos calendario** o el texto debe corregirse (los plazos se
calculan en dias: 3650 dias son 2 o 3 dias menos que diez anos calendario, y 1825 son 1 dia menos que
cinco si el periodo incluye un 29 de febrero — el texto al Trabajador dice «10 anos (3650 dias)» y el piso
legal si se calcula en anos, y no pueden quedar dos verdades en el mismo mensaje); **C3**, el piso legal no
puede ser bajado por la tabla de la Empresa; **C4**, la fecha de cese la informa y valida la Empresa por
escrito.

**Y un defecto que la determinacion destapo y que ya quedo corregido (M.30):** `validado_por` y
`validado_at` **no los leia ningun codigo**, de modo que la compuerta se podia abrir con la bandera sola,
sin que nada exigiera la validacion que el propio archivo dice que la precede. Ahora `_tablaActivada()`
exige los dos campos, con tres pruebas que fijan las tres formas (sin validacion, a medias, completa).

**Y las cuatro condiciones ya estan EN EL CODIGO, no solo escritas (12-nov-2026).** La determinacion de L3
propuso C1 a C4; el worker las implemento y cada una tiene su prueba:

- **C1** (el registro de operaciones sigue al documento asociado con piso legal o hold sin termino):
  `retencion.js` -> `plazoRegistroOperaciones()`, con sus tres casos (piso legal, sin termino, resto).
- **C2** (el computo en **anos calendario**): se corrigio una contradiccion real: el sistema sumaba **dias**
  (3650) y el texto al Trabajador decia **«10 anos (3650 dias)»**, que es una equivalencia **falsa** (3650 dias
  son dos o tres dias menos que diez anos calendario), mientras el piso legal ya se computaba en anos. Ahora la
  fecha se calcula en anos calendario (`sumarAnios`), `plazo_anos` es el plazo que se aplica y el que dice el
  texto, `plazo_dias` queda como su expresion nominal, y **el texto ya no afirma la equivalencia falsa**: dice
  los anos y dice que el computo es en anos calendario. Hay una segunda plantilla de texto para las categorias
  cuya duracion esta en dias (un respaldo de treinta dias).
- **C3** (el piso legal no puede ser bajado): se aplica el **mayor** entre los anos del catalogo (la norma) y los
  de la tabla, y la fecha mas lejana cuando la Empresa declara un plazo propio.
- **C4** (la fecha de cese la informa y valida la Empresa por escrito, y la firma no la sustituye): el
  planificador no calcula fecha de supresion sin fecha de cese y deja el registro con el hold que lo dice.

**Y la compuerta no se puede abrir con el marcador (12-nov-2026).** El archivo que se despacha trae
`validado_por` con un **marcador legible** («PENDIENTE: lo llena el abogado externo…») y `validado_at` en
`null`, mas `validado_por_documento` y `activado_at` en `null`. Para que nadie abra la compuerta creyendo que
«el campo esta lleno», `_tablaActivada()` **rechaza el marcador** por nombre: un «PENDIENTE…» **no es una
validacion escrita**, es la ausencia de ella escrita. El nombre del abogado **no se inventa**: lo llena el
abogado externo.

**Evidencia.** `sgsst-electron-app/firma-service/config/tabla-conservacion.json` ->
`aplicacion.activada = false`; `10-informe-correcciones-para-asesor-juridico.md`, fila J8 (PENDIENTE:
el catalogo legado no esta alineado y la compuerta sigue cerrada porque depende de su validacion);
`dictamen-legal-2026-11-12-tandas-2-y-3.md`, seccion 2 (L3).

**Qué falta.** Ya **no** falta nada del lado de la maquina: la tabla esta alineada, las cuatro
condiciones estan en el codigo con sus pruebas, la compuerta esta cerrada por codigo y el marcador
no la abre. El 13-nov-2026 se emitio la solicitud **S-02** al abogado matriculado. Lo que queda: (i)
la **validacion escrita** sobre los plazos de diez (10) y cinco (5) anos y sobre las condiciones C1
a C4, con `validado_por`, `validado_at` y `validado_por_documento` mas su SHA-256; (ii) **despues**,
la **apertura** por parte del owner, que es un acto **separado y posterior**: cambiar `activada` a
`true` y llenar `activado_at`; y (iii) la **reejecucion de la suite** entre validacion y apertura,
porque abrir la compuerta cambia el comportamiento del servicio.

**Quién lo tiene.** El abogado matriculado (la validacion) y el owner (la apertura, despues).

**Solicitud.** **S-02**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.

### M.7 - No hay copia de los respaldos fuera del servidor, y los actos del P8 aun no estan en ninguno: el destino y la activacion ya estan SOLICITADOS — CERRADO. Solicitud S-09 emitida y Solicitud S-04 emitida el 13-nov-2026

**Origen.** El pendiente «respaldo off-site» de la cola; `7.5` del cuadro canonico.

**Qué se verificó.** Los respaldos son diarios a las 22:00, cifrados con GPG simetrico AES256 y con
verificacion de integridad: el mecanismo es correcto. Pero **viven en `/opt/kair-firma/backups`, en el
mismo disco que la base**: si la maquina se muere, se pierden los dos. El ultimo respaldo al 12-nov
era del **11-nov a las 22:00**, con sha256 `de14e3f4b3c94c32eb690ae9215c111cdc1b450c963726eac54bd5192ebde20a`;
**los cuatro actos del P8 todavia no estaban en ningun respaldo** (el del 12-nov a las 22:00 ya los
incluye).

**Decisión tomada (12-nov-2026).** El destino es un **bucket S3-compatible de Backblaze B2**, alcanzado con
`rclone`, con **retencion de 30 dias**. Se descarto el Drive de Google porque es el **proveedor del canal de
correo**: una cuenta comprometida se llevaria el correo y los respaldos juntos. La maquina es un portatil
(sin virtualizacion) y **no hay un segundo servidor** al que copiarle. Los respaldos son diminutos (683 738
B por pareja diaria, 20,5 MB a 30 dias) y van **cifrados**: el destino no ve texto claro. Detalle en
`decision-respaldo-offsite-2026-11-12.md` y en `decisiones-de-fondo-2026-11-12.md`, bloque M.7.

**Lo que esta decision abrio.** Por decidir un destino **fuera del pais** (Backblaze B2 esta en EE. UU.)
aparecio un punto que el mapa **no tenia**: la copia de los respaldos puede ser una **transferencia
internacional** de datos personales (art. 26 de la Ley 1581 de 2012 y art. 24 del Decreto 1377 de 2013), y
Backblaze puede quedar como **subencargado** que debe entrar en la lista de proveedores del **§4** del
Anexo de Nube y del **§5** del Anexo de Encargo (el **§11** del Anexo de Nube es «Referencias normativas»:
la referencia estaba equivocada y ya se corrigio en el expediente). Ese punto es **M.28**, en la seccion 3,
y es **acto del abogado**: el equipo puede
preparar el insumo medido, pero **no puede emitir esa determinacion**.
**Defecto real corregido.** La rama `rclone` de `deploy/backup-offsite.sh` comparaba la huella del destino
con `rclone hash`, **un comando que no existe** (medido con las dos versiones reales: la de `apt` 1.60.1 y
la 1.76.0): el metodo `rclone` **nunca podia dar una copia por buena**. Ahora la huella del destino se
calcula descargando el objeto y hasheandolo con SHA-256. El parche se valido con **binarios reales de
`rclone`** en un sandbox del servidor: el script original falla la verificacion, el parcheado da «OK,
copiado y verificado», detecta la corrupcion del destino y poda solo el destino.

**Evidencia.** `ls -lt /opt/kair-firma/backups` (produccion): 22 respaldos de la base y 16 del
storage, **todos en el mismo disco**; `tail -1 backups/backup.log`: «Backup OK:
firma-20261111-220001.sqlite.enc (164714 B, sha256 de14e3f4b..., integrity ok, cifrado gpg)».

**Qué falta.** El 13-nov-2026 se emitieron dos solicitudes: **S-09** (al owner: el destino, las
credenciales y la activacion) y **S-04** (al abogado matriculado: la ratificacion de L4 y L5 y el
instrumento del art. 25). Lo que queda es que exista **una copia real verificada** en el destino:
abrir la cuenta y crear el bucket con su llave **en la region United States**, ejecutar la
activacion con `sudo` y guardar `backup.passphrase` en otro sitio (en custodia colombiana,
**fuera del servidor y fuera del bucket**). Y, antes, la ratificacion del abogado, que es lo que
habilita la activacion: **la activacion queda condicionada** a esa determinacion (decision del
12-nov-2026), porque una vez que hay una copia de datos personales en el exterior,
**retirarla despues no la deshace** — el proveedor ya tuvo los bytes. Hoy que no hay copia, la
determinacion sale **antes** de que exista el hecho. El ensayo uso un remoto local y **no prueba**
credenciales, permisos, region ni endpoint.

**Nota del 13-nov-2026 (revision de la asesoria).** El bucket se sigue creando en la **region United
States**, pero **la razon que se da para exigirlo no esta verificada**: por el **art. 24 num. 2 del
Decreto 1377** la transmision a un encargado se valida con el **contrato del art. 25**, sin remitir a la
lista de paises con nivel adecuado de proteccion, y el alcance de esa lista **no se pudo verificar**.
Por eso la condicion es, hasta que el abogado lo diga, una **decision conservadora de K+AIR**, y **S-04
lo pregunta de forma expresa**. El bloque **no cambia de estado**: S-04 sigue `EMITIDA`.

**Quién lo tiene.** El owner (el destino, las credenciales y la activacion) y el abogado matriculado
(la ratificacion de M.28); el equipo (la instalacion y la prueba, ya hechas).

**Solicitud.** **S-09** y **S-04**, emitidas el 13-nov-2026. Estan en
`tabla-de-solicitudes-2026-11-13.md`, con su destinatario, su verificacion y su fecha limite.

### M.8 - El 📦1051 no esta desplegado: produccion corre las dependencias vulnerables, y el despliegue ya esta SOLICITADO — CERRADO. Solicitud S-10 emitida el 13-nov-2026

**Origen.** El `npm audit` de la cola; §5.1 del runbook de despliegue.

**Qué se verificó.** En el repo, `proxy-addr` paso a **2.0.8** (la **critica**: IP spoofing por subred
IPv4-mapped IPv6) y `qs` a **6.16.2** con `express` a **4.22.3**. En el **servidor** siguen las
versiones viejas: `express 4.22.2`, `proxy-addr 2.0.7`, `qs 6.15.3`.

La razon es una y es concreta: **el runbook de despliegue no instala dependencias**. El tar lleva
`package.json` y `package-lock.json` pero **no** `node_modules`, y los pasos de §5.1 no corren
`npm install` ni `npm ci`. Sin ese paso, un despliegue deja el codigo nuevo con las librerias viejas:
**el `npm audit` del servidor no lo delata y el servicio parece sano**.

**Evidencia.** `npm ls` en `/opt/kair-firma/app` (produccion): `express 4.22.2`, `proxy-addr 2.0.7`,
`qs 6.15.3`; el repo: `express 4.22.3`, `proxy-addr 2.0.8`, `qs 6.16.2`;
`MIGRACION-SERVIDOR-FIRMA.md` §5.1 (los pasos 1 a 6, ninguno instala) y la nota agregada el
12-nov-2026 con el paso que faltaba.

**Cuanto falta, medido archivo por archivo (12-nov-2026, 19:52Z).** Se comparo el arbol desplegable
del repositorio con el del servidor por sha256: **247 archivos en comun, 6 diferentes, 0 sobrantes**.
Los 6 son `package.json`, `package-lock.json`, `scripts/actualizar-manifiesto-1047.js`,
`scripts/actualizar-manifiesto-v1.6.js`, `deploy/setup-vm.sh` y `deploy/README-DESPLIEGUE.md`. Es
decir: **todo `src/` que corre es byte a byte el del repositorio** y lo unico que no se ha desplegado
es el **bump de dependencias** (mas dos scripts auxiliares y dos archivos de despliegue). La
comparacion es reproducible con `firma-service/scripts/comparar-despliegue.js`, que sale con codigo 1
y nombra los archivos mientras haya diferencias.

**Qué falta.** El 13-nov-2026 se emitio la solicitud **S-10**. Lo que queda: desplegar el 📦1051
**con el paso de instalacion** (`npm ci --omit=dev` con el servicio parado, antes de las
migraciones) y volver a medir las versiones en el servidor.

**Quién lo tiene.** El owner (el despliegue con `sudo`).

**Solicitud.** **S-10**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.

### M.9 - El codigo que corre es escribible por cualquiera: 236 archivos en 777, y el chmod ya esta SOLICITADO — CERRADO. Solicitud S-11 emitida el 13-nov-2026

**Origen.** El requisito `7.6` del cuadro canonico; la observacion que el abogado marco como
**bloqueante** el 31-oct-2026.

**Qué se verificó.** El arbol desplegado quedo en `777` y **sigue asi** tras cuatro despliegues: el
paso 2b del runbook (`chmod -R u=rwX,go=rX` mas `chmod 750` sobre `app/` y `legal/`) **nunca se
aplico**, porque el script de reparacion del 11-nov repuso `node_modules` y aplico las migraciones,
pero no toco permisos.

No es desorden de permisos: la unidad de systemd corre el servicio como `kairfirma`, y con `app/` y
`app/src/` en 777 una cuenta local cualquiera puede **reemplazar el codigo que despues se ejecuta
como `kairfirma`**. Es una via de escalamiento.

**Evidencia.** `ls -ld /opt/kair-firma/app` (produccion): `drwxrwxrwx 8 kairfirma kairfirma`;
`ls -ld /opt/kair-firma/app/src`: `drwxrwxrwx 9 kairfirma kairfirma`;
`ls -l src/server.js`: `-rw-rw-rw-`; conteo con `-perm -0002`: **236 archivos** y **18 directorios**
escribibles por otros. `MIGRACION-SERVIDOR-FIRMA.md` §5.1 (el paso 2b que no se aplico) y `:735` (la
nota del abogado: «con permisos 777, cualquier usuario de la maquina puede escribir el codigo que
corre el servicio, y eso no es "minimo privilegio"»); `/etc/systemd/system/kair-firma.service`:
`User=kairfirma`.

**Qué falta.** El 13-nov-2026 se emitio la solicitud **S-11**. Lo que queda: aplicar el paso 2b del
runbook (es una linea, con `sudo`). Es el **unico** punto que el abogado habia marcado como
bloqueante y que sigue igual cuatro meses despues.

**Quién lo tiene.** El owner (ejecutar el `chmod` con su clave de sudo).

**Solicitud.** **S-11**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.

### M.10 - El flujo electronico completo nunca se ha ejercitado contra el codigo que hoy corre, y la corrida ya esta SOLICITADA — CERRADO. Solicitud S-12 emitida el 13-nov-2026

**Origen.** El requisito `7.11` del cuadro canonico; el pendiente del runbook «Correr los tests de
extremo a extremo con datos reales».

**Qué se verificó.** La **ultima** firma electronica completa de la base de produccion es del **6 de
noviembre**: despues del despliegue del 11-nov y de los cuatro actos del P8 del 12-nov **no se ha
ejercitado el flujo de firma**. Los dos programas que hacen falta existen en el servidor
(`scripts/smoke-produccion.js` y `limpiar-rastro-prueba.js`, ambos del 11-nov 07:04), pero **no se han
corrido** contra el codigo actual. La referencia historica que cita el cuadro canonico es del
**26-oct-2026**, con 12 comprobaciones y 0 fallas: contra el codigo de esa fecha, no contra el de hoy.

**Evidencia.** Firmas en produccion: `SIGN-2026-734698` (26-oct, OPENED), `SIGN-2026-827084`
(26-oct, OTP_VERIFIED), `SIGN-2026-927141` (26-oct, SIGNED), `SIGN-2026-738564` (06-nov, SIGNED),
`SIGN-2026-016820` (06-nov, CANCELLED); el evento mas reciente de la bitacora es del
`2026-11-06T20:25:34Z` (`ELECTRONIC_FLOW_CANCELLED`);
`MIGRACION-SERVIDOR-FIRMA.md` §8 (el pendiente del smoke de extremo a extremo);
`respuesta-checklist-cierre-2026-10-30.md:1237` (la corrida historica del 26-oct).

**Qué falta.** El 13-nov-2026 se emitio la solicitud **S-12**. Lo que queda: una corrida controlada
de extremo a extremo **contra el codigo desplegado hoy**: crear la solicitud, enviar la invitacion,
firmar desde el celular y descargar la constancia; despues retirar el rastro con
`limpiar-rastro-prueba.js --solo-firmas` y dejar el acta. Es el unico pendiente de esta seccion que
exige **una persona con un celular**, no un script. La misma corrida es la que produce el caso real
del buzon corporativo (M.3).

**Quién lo tiene.** El owner (firma desde el celular y descarga de la constancia) con el equipo
(smoke, limpieza del rastro y acta).

**Solicitud.** **S-12**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.
## 2. Condiciones de apertura

> No impiden firmar hoy, pero hay que cumplirlas antes de que entre el primer cliente real: son las
> condiciones que hacen que ese cliente no se encuentre con una excepcion sin resolver.

### M.11 - Los tres alias de Workspace siguen sin verificar, y su verificacion ya esta SOLICITADA — CERRADO. Solicitud S-13 emitida el 13-nov-2026

**Origen.** P3 de la decision de regularizacion del correo; el item `canales.excepcion_documentada`.

**Qué se verificó.** P3 es «crear y verificar los alias `privacidad@`, `soporte@` e `incidentes@` de
`gesstiar.com`», y sigue **abierto**: no hay verificacion de que existan. El manifiesto ya lo declara
como excepcion documentada en los tres canales que lo necesitan (derechos, PQRS e incidentes), con
`canales.excepcion_documentada.pendiente = P3`. Es un acto del owner en la consola de Workspace: el
servicio no tiene acceso.

**Evidencia.** `legal-readiness.json` -> `canales.derechos.estado = excepcion_documentada`,
`canales.pqrs.estado = excepcion_documentada`, `canales.incidentes.estado = excepcion_documentada`,
`canales.excepcion_documentada.pendiente = P3`;
`decision-regularizacion-correo-2026-11-09.md`, fila P3: «**Abierto.** No medido en esta sesion. Los
tres alias siguen sin verificar».

**Qué falta.** El 13-nov-2026 se emitio la solicitud **S-13**. Lo que queda: crear los tres alias y
**verificarlos con un envio real a cada uno**, dejando la evidencia (Message-ID y cabeceras) en el
manifiesto.

**Quién lo tiene.** El owner (la consola y el envio).

**Solicitud.** **S-13**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.

### M.12 - El procedimiento de reversion esta probado y el defecto real que encontro ya se corrigio; el despliegue y la restauracion real ya estan SOLICITADOS — CERRADO. Solicitud S-14 emitida el 13-nov-2026

**Origen.** T7 del cuadro canonico.

**Qué se verificó.** Los programas de reversion existen en el repositorio
(`firma-service/scripts/limpiar-rastro-prueba.js` y `firma-service/deploy/probar-restauracion.sh`),
pero **la prueba y el acta no**. T7 pide el procedimiento probado, con que se restaura y con el acta
de reversion.

**Lo que se hizo el 12-nov-2026.** Se escribio y se corrio una **prueba real del procedimiento de
reversion**, contra el servidor y **sin tocar produccion** (la base real solo se abrio con
`sqlite3 -readonly` y `.backup`; su contenido, huella de archivo, `MainPID` y `journalctl` quedaron
identicos antes y despues):

- `firma-service/scripts/probar-reversion.js` — el programa de prueba (47 474 B, ASCII puro, LF, sin
  BOM, `node --check` en verde): siembra una base aislada con las migraciones desplegadas y una
  escena sintetica, corre el programa de reversion del repositorio por sus **dos** caminos (sin
  `--forzar-hold` -> se niega con exit 4 y no toca nada; con `--forzar-hold --ejecutar` -> exit 0),
  compara los numeros que el programa imprime contra los deltas medidos, mide
  integridad/FK/triggers/apertura, restaura el respaldo y compara el **volcado canonico**.
- `verificacion-cierre/t7-reversion-probada.md` — el acta, con la salida literal del servidor
  (verificada byte a byte contra la captura) y el recibo de lo que se toco y lo que no.

Resultado medido: **58 OK · 3 avisos · 0 fallas**, exit 0 (15:16:27, Colombia). Que se borra: 1 firma,
3 eventos, 1 sesion, 1 token, 1 hold, 1 firma en papel, 1 consentimiento, 1 PDF. Que se restaura: el
**volcado canonico de la base restaurada es identico** al de origen y vuelve la version anterior del
Acuerdo (v1.0). **Produccion intacta al cierre**: el archivo de la base con el mismo hash y el mismo
`mtime`, 5 firmas / 55 eventos, `MainPID` sin cambio, `NRestarts = 0` y `journalctl` sin entradas.

**El defecto, corregido y medido con un A/B sobre la misma base sembrada.** El borrado **por rango**
borra `gh_consentimientos_firma` sin borrar antes sus filas de `gh_consentimientos_eventos`, y la FK
de la migracion 010 (`gh_consentimientos_eventos.consent_id` -> `gh_consentimientos_firma.id`) no
deja borrar el padre antes que el hijo. Con un consentimiento que tenga eventos —el caso normal,
porque los escribe `src/services/consent.js`— la reversion fallaba con
`FOREIGN KEY constraint failed` y exit 3. La transaccion revierte, asi que **no se pierde nada**,
pero la reversion quedaba **bloqueada**. El modo `--solo-consentimientos` **si** lo hacia bien
(linea 810): el fallo estaba **solo** en la ruta por rango. En produccion hay 3 consentimientos y
**0** eventos, asi que el defecto no se habria disparado con los datos de hoy: era **latente**.

El A/B, con el mismo escenario sembrado (la escena ahora siembra el evento del consentimiento, que
es lo que reproducia el defecto):

| Programa | Resultado |
|---|---|
| El **desplegado** (el viejo) | `FOREIGN KEY constraint failed`, exit 3, **no borra nada** |
| El **corregido** | borra y sale con exit 0, `integridad=ok`, `llaves_rotas=0`, recibo con `eventos de consentimiento: 1` y dos asientos puestos |

La correccion (en `scripts/limpiar-rastro-prueba.js`, +22 lineas) borra primero los eventos y
despues el consentimiento, en el mismo orden que ya usaba el modo `--solo-consentimientos`; el
recibo imprime cuantos eventos de consentimiento se borraron. Se comprobo contra el esquema real de
produccion que `gh_consentimientos_eventos` es la **unica** tabla con FK hacia
`gh_consentimientos_firma` (las cuatro tablas hijas de la firma —eventos, sesiones, lotes y tokens—
ya se borraban antes). Y la regla correcta **ya estaba escrita en el repo**, en `tests/helpers.js`,
que borra en el orden correcto: lo que faltaba era que el script de produccion la cumpliera.

**Evidencia.** `verificacion-cierre/t7-reversion-probada.md` (el acta, con la salida literal del
servidor verificada byte a byte contra las capturas, las dos huellas y el A/B);
`firma-service/scripts/probar-reversion.js` (sha256 `49b8a7a1…d9847`, 49 699 B, ASCII puro, LF, sin
BOM); `firma-service/tests/scripts/probar-reversion.test.js` (**9/9**, unitario, sin abrir ninguna
base); `10-informe-correcciones-para-asesor-juridico.md`, fila T7 (actualizada el 12-nov-2026 a
**PARCIALMENTE**: reconoce el acta, el A/B y la correccion, y deja abiertos el despliegue y la
restauracion cifrada real);
`ls /opt/kair-firma/backups/restauracion.log` (produccion): no existe.

**Qué falta.** El 13-nov-2026 se emitio la solicitud **S-14**. Lo que queda: 1.
**Desplegar la correccion en el servidor**: el programa que corre en `/opt/kair-firma/app` sigue
siendo el viejo (`a1f3e76b…7175`), o sea el que aborta con `FOREIGN KEY constraint failed`. La
correccion esta probada pero **no esta desplegada**. Acto del owner. 2.
**La restauracion cifrada real**: los `.enc` y `backup.passphrase` son `600 root` y `sudo` pide
contrasena, asi que la prueba de restauracion se hizo por la via de la copia limpia (`.backup` +
`.restore`), que es la que el entorno permite. Falta la prueba del camino real, con root. El cron
`0 4 1 * *` solo producira `restauracion.log` el 1-dic-2026. 3. La **fila T7** del informe al
abogado ya quedo actualizada a **PARCIALMENTE** (12-nov-2026): no queda nada que decidir ahi; se
cierra cuando se cumplan los puntos 1 y 2.

**Quién lo tiene.** El owner (los puntos 1 y 2, que necesitan `sudo`) y el equipo (el punto 3).

**Solicitud.** **S-14**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.

### M.13 - Las dos altas de npm audit estan subidas en el repo: el audit da 0, en produccion siguen vivas, y el despliegue ya esta SOLICITADO — CERRADO. Solicitud S-15 emitida el 13-nov-2026

**Origen.** El pendiente `npm audit` de la cola; §8.1 del runbook.

**Qué se verificó.** El audit estaba en **2 altas** (las dos de la cola): `nodemailer 6.10.1` (-> 10.5.0)
y `zod 3.25.76` (-> 4.6.7). Las dos exigen **salto de version mayor**, con cambios de API que hay que
revisar en el codigo: no son un parche, son un trabajo. Se cerraron la critica y la moderada sin
romper nada (`proxy-addr` 2.0.8`, `qs` 6.16.2` con `express` 4.22.3).

**Lo que se hizo el 12-nov-2026.** Los dos saltos se aplicaron y el audit quedo en **0
vulnerabilidades** (`npm audit --omit=dev`: «found 0 vulnerabilities», exit 0; el audit completo, con
las dependencias de desarrollo, tambien da 0). El lock solo cambio en esos **dos** paquetes: los
otros 138 no se movieron y `better-sqlite3` sigue en 11.10.0 (ABI 127).

**El riesgo que la suite NO cubria (y se encontro por diferencia).** zod 4 **ignora en silencio**
`invalid_type_error`, `required_error` y el `errorMap` por esquema. Con la suite en verde, los
**diez mensajes en espanol que el operador ve** se habian convertido en el generico en ingles de
zod 4. Se armo un banco de pruebas golden sobre los esquemas reales del repo que compara zod 3 y
zod 4 mensaje por mensaje, y se migraron los **diez** sitios a la forma `error` de zod 4,
**conservando cada mensaje y su condicion** (la forma de funcion donde `invalid_type_error` y
`required_error` se aplicaban a partes distintas del problema). La suite quedo en verde **con los
mensajes restaurados**: **2 665 tests · 2 663 pass · 0 fail · 2 skipped**.

Dos premisas del encargo **no se cumplian** y se verificaron por medicion: el `z.record()` del repo
**ya era de dos argumentos** (no habia ruptura en ejecucion) y las formas `.min(n, 'msg')`,
`.email()`, `.datetime()` y `.strict()` **siguen funcionando** en zod 4, asi que unos 250 lugares de
llamada no necesitaron reescritura.

**Evidencia.** `verificacion-cierre/m13-npm-audit-altas.md` (el acta, con el banco de pruebas y la
comparacion zod 3 / zod 4); `npm audit --omit=dev` en el repo (12-nov-2026): «found 0
vulnerabilities»; `package.json` y `package-lock.json` (solo esos dos paquetes); los seis archivos de
`src/` con la adaptacion de los diez mensajes (`src/routes/anexoEncargo.js`, `src/routes/anexoNube.js`,
`src/schemas/admin-clientes.js`, `src/schemas/admin-empresas.js`, `src/schemas/admin-encargado.js`,
`src/schemas/admin-excepciones.js`); `MIGRACION-SERVIDOR-FIRMA.md` §8.1.

**Qué falta.** El 13-nov-2026 se emitio la solicitud **S-15**. Lo que queda: el **despliegue**, que
es el mismo de M.8 (S-10) y con el se cierra este bloque: el **repositorio** ya esta en 0
vulnerabilidades, pero **produccion sigue con `nodemailer 6.10.1` y `zod 3.25.76`** hasta que se
despliegue el bump. Queda tambien el **envio real contra SMTP**, que la suite no cubre (usa
`jsonTransport`) y que habria que ejercitar antes de abrir a una empresa real.

**Quién lo tiene.** El owner (el despliegue, con `sudo`: M.8). El equipo ya hizo el trabajo tecnico.

**Solicitud.** **S-15**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.

### M.14 - Node 22 en el servidor: decidido el 11-nov-2026 y no ejecutado, y la ventana ya esta SOLICITADA — CERRADO. Solicitud S-16 emitida el 13-nov-2026

**Origen.** §8.2 del runbook; la decision del owner del 11-nov-2026.

**Qué se verificó.** El servidor corre **Node 20.20.2** (ABI 115) y `better-sqlite3` 11.10.0, que
funciona con ese runtime. La decision del owner del 11-nov-2026 fue que el servidor corra **Node 22
(ABI 127)**, que es la unica combinacion con prebuild oficial. **Hoy no es un bloqueo**: el servicio
esta sano con Node 20. Es deuda de mantenimiento, con una trampa: si se sube el runtime hay que
**recompilar** `better-sqlite3` antes de arrancar, o el proceso muere al abrir la base.

**Decisión tomada (12-nov-2026).** La decision del owner se **mantiene y no se aplaza**, pero la ventana
**no se puede abrir sin quitarle una collision**: el cron `/etc/cron.d/kair-firma-health` **reinicia el
servicio cada 5 minutos** si `/health` no responde, y durante la ventana el servicio esta reiniciandose a
proposito. Ese cron es la collision real, y por eso la ventana empieza desactivandolo y termina reactivandolo.
El rollback **no depende de internet** (hay un `.deb` de Node 20 en la cache local de la maquina:
`/var/cache/apt/archives/nodejs_20.20.2-1nodesource1_amd64.deb`) y el prebuild ABI 127 **ya esta probado en
esta maquina**: el runtime oficial `node-v22.23.5` se verifico contra `SHASUMS256.txt` de nodejs.org
(`cdeb8670…40f8`), y el binario `better-sqlite3` 11.10.0 `node-v127-linux-x64`
(`d7d9272b…8fda37`) **carga y responde `SELECT 1`** bajo Node 22, mientras el Node 20 del servidor lo
**rechaza** con `NODE_MODULE_VERSION 127 ... requires 115`: el runtime y el modulo son **el mismo acto**. El
equipo dejo `deploy/verificar-runtime-node.sh`: es **solo lectura**, no necesita `sudo`, **carga el modulo y
ejecuta un `SELECT 1` sobre una base en memoria** (no abre la base de produccion), comprueba `/health` con
200 y `checks.db == "ok"`, y **sale con codigo 1** ante cualquier incoherencia entre el runtime y el modulo:
ese es el codigo que hace fallar la ventana. Detalle con los comandos literales de la ventana y de su
rollback en `decision-ventana-node-22-2026-11-12.md`.

**Evidencia.** `node -v` en el servidor: `v20.20.2`; `systemctl show kair-firma -p ExecMainStartTimestamp`:
arrancado el 2026-11-12 09:30:23 -05, `NRestarts = 0`; `MIGRACION-SERVIDOR-FIRMA.md` §8.2 (la tabla
de combinaciones y el comando `npm rebuild better-sqlite3`); `crontab` del usuario `root`: `kair-firma-health`
cada 5 minutos; `deploy/verificar-runtime-node.sh` (solo lectura, codigo 1 ante incoherencia).

**Qué falta.** El 13-nov-2026 se emitio la solicitud **S-16**. Lo que queda: la ventana de
mantenimiento: desactivar el cron, subir el runtime, recompilar el modulo nativo, verificar con el
script, y su rollback.

**Quién lo tiene.** El owner (la ventana). El equipo ya hizo el trabajo tecnico.

**Solicitud.** **S-16**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.

### M.15 - La v1.1 del Nube quedo suscrita y sin contrafirma: queda como registro historico — CERRADO

**Origen.** La suscripcion id 1 de `gh_firma_anexo_nube_suscripciones`; la decision de juridica.

**Qué se verificó.** Hay **dos** suscripciones del Anexo de Nube en produccion: la id 1, de la
**v1.1** (5-nov-2026, `e9517536...`), suscrita por ASEPLUS y **sin contrafirma**; y la id 2, de la
**v1.3** (12-nov-2026, `fdd10551...`), suscrita **y contrafirmada**. Lo mismo con el Anexo de Encargo:
la version 2026-11-06 (contrafirmada el 7-nov) y la 2026-11-11 (contrafirmada el 12-nov). Las dos
suscripciones viejas estan **intactas**, con su huella y su evidencia: lo que se deshizo en la fase 1
del P8 fueron los punteros de la ficha, no los hechos.

**Decisión tomada (12-nov-2026).** La v1.1 **queda como registro historico**: **no se contrafirma
retroactivamente**. Contrafirmar un acto que **no ocurrio** seria **fabricarlo** —se pondria una fecha y
una firma de K+AIR en un documento jamas contrafirmado, y el rastro append-only mostraria un evento sin
contraparte en el mundo—. Y no hace falta: la v1.1 **no describe el texto vigente** (la v1.3 es el
vigente, suscrito y contrafirmado el 12-nov), y ya esta registrada en el manifiesto, en
`anexo_nube.versiones_firmadas`, con su huella y su evidencia: no se pierde nada y no se reescribe. La
decision se pide **confirmada por escrito al abogado** en el mismo escrito que lleva J6, J7, J8 y la
ratificacion de la v1.4; esa confirmacion no bloquea el cierre, porque no cambia lo que el texto dice.
Detalle en `decisiones-de-fondo-2026-11-12.md`, bloque M.15.

**LA CONSTANCIA YA EXISTE (L6, 12-nov-2026).** La determinacion legal de L6 esta escrita
(`dictamen-legal-2026-11-12-tandas-2-y-3.md`, seccion 4) y la **constancia de expediente** que de ella sale
esta en `nota-expediente-v1-1-2026-11-12.md`. La constancia **corrige en un punto de fondo** el dictamen: la
afirmacion «bajo la v1.1 no se trato dato alguno» **no se sostiene** — la base de produccion registra una firma
electronica completada el **6 de noviembre de 2026** (`SIGN-2026-738564`, estado `SIGNED`) y una cancelada el
mismo dia (`SIGN-2026-016820`), y la v1.1 era en esas fechas la unica version del Anexo de Nube suscrita por la
Empresa (la v1.3 no se publico hasta el 11 de noviembre). Lo que corresponde, entonces, es **declarar** el
tratamiento, no negar el hueco: la ausencia de contrafirma califica **el instrumento**, no **el tratamiento** que
ocurrio mientras tanto. La nota **no contrafirma** la v1.1 retroactivamente (eso seria fabricar un acto que no
ocurrio) y **no reescribe** ningun texto suscrito: el manifiesto sigue declarando la v1.1 con su huella, su
fecha y su evidencia, y con `contrafirmado: false`.

**Evidencia.** `gh_firma_anexo_nube_suscripciones` (produccion): id 1 con `version = 1.1`,
`contrafirmado_at` vacio; id 2 con `version = 1.3`, `contrafirmado_at = 2026-11-12T16:13:54.106Z`,
`contrafirma_actor = Javier Robles Fontalvo`, `contrafirma_facultad = REPRESENTANTE_LEGAL_ENCARGADO`,
acta `050f223a3665cf7d`. `legal-readiness.json` -> `anexo_nube.versiones_firmadas[0]`: la v1.1 con su
evidencia del 5-nov-2026. `nota-expediente-v1-1-2026-11-12.md` (la constancia de L6).

**Que falta.** Nada que impida el cierre: la decision esta tomada y escrita, con su fundamento, y la
constancia de expediente ya existe. Quedan dos cosas **que no bloquean** y tienen nombre y
responsable: (i) la
**ratificacion** del abogado matriculado sobre L6, que va en el mismo escrito de M.5, y (ii) una **lectura de
solo lectura** de las cinco filas de firma de produccion (el comando literal esta en la nota) para dejar en el
expediente que version y huella del Anexo de Nube rigio cada una; el resultado puede **corregir** el numeral 2.3
de la nota si el dato no coincide. El **manifiesto no se toco**: su huella esta registrada en el expediente.

**Quien lo tiene.** Nadie bloquea; la ratificacion del abogado se pide en el mismo escrito de M.5 y
la lectura de produccion es del owner.

### M.16 - El inventario de buzones hay que repetirlo cuando haya solicitudes reales, y esa corrida ya esta SOLICITADA — CERRADO. Solicitud S-17 emitida el 13-nov-2026

**Origen.** El item `d02` del gate; la evidencia del 26-oct-2026.

**Qué se verificó.** El item `d02` del gate esta en `ok` porque **el inventario se ejecuto** y su
evidencia esta escrita, no porque haya casos: `d02.inventario_buzones = 0`. La propia evidencia dice
que hay que repetirlo cuando haya solicitudes reales. While eso no bloquea, es la comprobacion que
sustentaria a M.3 en produccion.

**Evidencia.** `legal-readiness.json` -> `d02.inventario_buzones = 0` con la evidencia del
26-oct-2026; `src/services/readinessLegal.js:1610-1611` (el `ok` depende de que el inventario este
contado y documentado, no de que el numero sea alto).

**Qué falta.** El 13-nov-2026 se emitio la solicitud **S-17**. Lo que queda: la corrida del
inventario `scripts/inventario-buzon-corporativo.js` cuando exista al menos una solicitud real con
un caso rechazado. El 12-nov-2026 se produjo el caso en una copia aislada (ver M.3), pero
**el manifiesto no se toco**: `d02.inventario_buzones` sigue en 0 a proposito, porque el caso real
en produccion todavia no ha ocurrido. Esta solicitud **depende** de la S-07.

**Quién lo tiene.** El equipo.

**Solicitud.** **S-17**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.

### M.17 - La corrida desde un clon limpio del commit da el mismo resultado que la del arbol del owner — CERRADO

**Origen.** T1 del cuadro canonico; el requisito `8.5` del cuadro canonico.

**Qué se verificó.** T1 pide que la entrega se pueda reproducir **desde un clon limpio**: hasta el
12-nov lo que se habia ejecutado eran corridas sobre el arbol de trabajo del owner, con sus
dependencias ya instaladas y su `.env` local.

**Lo que se hizo el 12-nov-2026.** La suite se ejecuto **completa, tres veces, desde un clon
limpio** (`verificacion-cierre/t1-corrida-desde-clon-limpio.md`):

| Corrida | tests | pass | fail | skipped |
|---|---|---|---|---|
| A (14:53) | 2 624 | 2 622 | **0** | 2 |
| B (15:03) | 2 630 | 2 628 | **0** | 2 |
| C (15:13) | 2 650 | 2 648 | **0** | 2 |

El clon se hizo con `git -c core.autocrlf=false clone`, con `npm ci` desde cero (Node 22, ABI 127),
**sin `.env`** y con los devDependencies intactos (`added 139 packages`, exit 0, **0
vulnerabilidades**). Los conjuntos de nombres de prueba coinciden **exactamente** con las corridas
del arbol del owner (comparacion cerrada en los dos casos: 14:34 y 15:02), y el clon final quedo
**byte a byte identico** al arbol del owner (4 780 de 4 780 archivos versionados) con el mismo
`git status --porcelain`.

**El hallazgo que esta corrida produjo.** El primer clon, hecho con la configuracion del sistema
(`core.autocrlf = true`), **no reproducia el arbol del owner**: materializo **2 697 de los 4 781**
archivos versionados con CRLF, cuando los blobs los tienen en LF. El repo del owner tiene
`core.autocrlf = false` en su `.git/config` local, que pisa al del sistema, y `git reset --hard`
**no** reescribe los archivos que el indice ya da por buenos. Sin esa opcion, un clon "limpio" en
esta maquina no es el arbol del owner, y cualquier prueba que mire bytes (EOL, huellas) puede dar
un resultado distinto. La trampa quedo escrita en `PROMPT.md` (la 155) y en el acta.

**La corrida que faltaba: la del commit (16:04 a 16:11).** La ronda se commiteo (`e4dd5f31`) y el
clon salio **del commit**, sin parche y sin copia de no versionados:

```

tests 2665 | pass 2663 | fail 0 | cancelled 0 | skipped 2 | todo 0
duration_ms 323480
```

179 archivos de prueba, `exit 0`, `not ok` 0. El clon: `git status --porcelain` **vacio**, sin
`.env`, `npm ci` con `added 139 packages` y **0 vulnerabilidades**. Comparada contra la corrida
del arbol del owner, el conjunto de los **2 665 nombres de prueba es identico** y los dos omitidos
son los mismos. Y el clon quedo **byte a byte** igual al arbol del owner: **4 810 archivos
identicos, 0 diferentes, 0 ausentes**.

**El error que casi lo hace pasar por rojo.** La primera corrida del clon **aborto en 0 s** con
`[TEST SAFETY] No se pudieron aplicar las migraciones en la BD de tests`: el runner oficial lanza
la suite con `process.execPath`, que es **el Node con el que se lanzo el script**, no el que esta
primero en el `PATH`. El `npm ci` si habia corrido con el Node 22, asi que la instalacion y la
corrida usaron runtimes distintos. La trampa quedo escrita en `PROMPT.md` (la 156).

**Evidencia.** `verificacion-cierre/t1-corrida-desde-clon-limpio.md` (el acta, con la salida literal
de cada corrida, la del commit y el error del `process.execPath`); `10-informe-correcciones-para-asesor-juridico.md`, fila
T1; `plan-cierre-abogado-2026-10-31.txt:91`; `verificacion-cierre/seccion-8.md`, requisito 8.5.

**Qué falta.** **Nada.** La corrida esta vinculada a un commit, se reprodujo desde un clon limpio de
ese commit y el clon quedo byte a byte igual al arbol del owner.

**Quién lo tiene.** — (cerrado por el equipo el 12-nov-2026, con la corrida sobre el commit
`e4dd5f31`).

---

### M.18 - Los dos anexos ya suscritos dicen cosas que la realidad ya desmintio: se reemite ahora, y la revision y redaccion ya estan SOLICITADAS — CERRADO. Solicitud S-03 emitida el 13-nov-2026

**Origen.** El requisito 1.9 del cuadro canonico (medido en `verificacion-cierre/secciones-1-2.md`)
y los requisitos 5.5 y 5.6 (medidos en `verificacion-cierre/secciones-3-5.md`).

**Qué se verificó.** Los **dos anexos que gobiernan la relacion** —el Anexo de Nube v1.3 y el Anexo
de Encargo 2026-11-11— estan **suscritos y contrafirmados** desde el 12-nov-2026, y **sus textos ya
no coinciden con lo que el servicio hace**:

- Afirman que sus **propios actos y el metodo de autenticacion (P2) «estan pendientes»**, cuando el 12-nov
  y el 10-nov ya no era cierto.
- El **Anexo de Nube v1.3 se contradice a si mismo**: el §1 y la ficha del §5 dicen cosas distintas
  sobre la **MFA** y la **contrasena de aplicacion**, y la fila «fecha de generacion de la
  credencial: no consta» quedo desactualizada (`decision-regularizacion-correo-2026-11-09.md:31` si la
  registra).
- El **Anexo de Encargo** remite al Anexo de Nube: arreglar uno obliga a rehacer el otro.

Un texto **suscrito no se toca**: la via no es corregirlo, es una **version nueva** (Anexo de Nube v1.4
y el Encargo que la remite), con huella propia, firma de nuevo y manifiesto al dia.

**Decisión tomada (12-nov-2026).** **Se reemite ahora**, y **no se espera al primer cliente real**: abrir
a una empresa con un contrato que afirma un estado que el mismo servicio ya supero es **abrir en falso**.
Los candidatos estan **armados mecanicamente** por el equipo con los literales ya escritos de
`propuesta-v1.4-anexo-nube-2026-11-12.md` (6 anclas en el Nube, 5 en el Encargo) y con el texto literal de
las determinaciones de L1, L4 y L5, con un script que **se niega a escribir** si una ancla no casa
**exactamente una vez** (11 de 11 de la primera fase, 45 de 45 de la segunda). Quedan en
`candidatos-v1.4/`, **fuera del paquete de despliegue**, marcados como **no publicados y no firmables**: la
**redaccion final es del abogado** y la **firma es del owner**. El costo, dicho de frente: hasta que
la v1.4 este firmada el gate **baja a 37 items en `ok`** (el mismo estado en que estaba la v1.3 antes del
12-nov), y la compuerta `FIRMA_EXIGIR_ANEXO_NUBE` no se enciende hasta despues. Detalle en
`decisiones-de-fondo-2026-11-12.md`, bloque M.18.

**Evidencia.** `verificacion-cierre/secciones-1-2.md`, requisito 1.9 (**PARCIALMENTE**: «los dos anexos
vigentes afirman que sus propios actos y P2 «estan pendientes»: hace falta una version nueva (un texto
suscrito no se toca) y corregir la tabla de instrumentos»); `verificacion-cierre/secciones-3-5.md`,
requisitos 5.5 y 5.6 (**PENDIENTE** y **PARCIALMENTE**: ambos exigen «una version nueva del Anexo de
Nube (v1.4)»); `sgsst-electron-app/legal/anexo-nube-v1.3.html` (los §1 y §5);
`sgsst-electron-app/legal/anexo-encargo.html` (la remision); `candidatos-v1.4/` (candidato Nube v1.4:
103 390 B, `fae2b26b...d8b416`; candidato Encargo 12-nov: 97 962 B, `7576b1a1...d9f3c`; vigentes
intactos: `fdd10551...b585d` y `6308b1f7...b8948`).

**LO QUE LA MESA DE DETERMINACIONES LE METIO (12-nov-2026).** El generador de candidatos ahora arma el texto
en **dos fases**: la primera con C1 a C7, la segunda con las determinaciones de **L1** (Google), **L4** (la
redaccion) y **L5** (Backblaze), cuyo texto literal **se lee de los propios documentos de determinacion** (no
se transcribe a mano): 35 cambios en el Nube y 10 en el Encargo. Con eso el candidato **dejo de contradecirse**:
la fila de Google tiene **ocho celdas** (la novena abria una columna que el encabezado no declara) y dice que
es **Encargado** por la operacion concreta, que «Subencargado» es **figura contractual** y no categoria legal,
y que la comunicacion al exterior es una **transmision internacional a un Encargado**, **no una
transferencia**: **no se activa el art. 26 de la Ley 1581** y rigen el art. 24 num. 2 y el art. 25 del Decreto
1377. Entro **Backblaze, Inc.** como subencargado con la region del bucket declarada, se reescribio el parrafo
de **Respaldos** del §3, se declararon los **actos del 12-nov** y que **esta v1.4 no esta suscrita**, y se
unifico la **version del Encargo en 2026-11-12**. El generador tiene ademas **test propio** (7 pruebas): que en
modo `--estado` no escribe, que los vigentes y el manifiesto quedan intactos, que el texto del candidato es
**byte a byte** el de la determinacion, y que **se niega** cuando un ancla no casa exactamente una vez.

**Qué falta.** **Lo que ya no hace falta**: que el equipo redacte el texto ni que alguien lo escriba
a mano; el texto literal de L1, L4 y L5 ya esta aplicado y es reproducible con un comando. El
13-nov-2026 se emitio la solicitud **S-03** al abogado matriculado para que revise y redacte la v1.4
y el Encargo 2026-11-12. Lo que queda: su redaccion, y despues la suscripcion de ASEPLUS, la
contrafirma de K+AIR y el manifiesto al dia con la huella de la v1.4. Sigue abierta una correccion
**propia del agente general** (nueve identificaciones de version que el dictamen no enumeraba y que
decian «esta version 1.3» en un documento que **es** la 1.4), marcada `ext` en
`determinaciones-v1.4.js` y **reportada al abogado** en la S-03: si no le parece bien, se quita y se
vuelve a armar.

**Quién lo tiene.** El abogado matriculado (la redaccion) y el owner (las firmas). El equipo
(huellas, manifiesto y firmas) ya tiene los candidatos armados y **verificados**.

**Solicitud.** **S-03**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.
## 3. Riesgos y deuda

> No impiden la apertura. Se anotan porque son cosas que el owner deberia saber antes de abrir, y
> porque algunos son trampas que ya mordieron una vez.

### M.19 - El valor efectivo de `TRUST_PROXY` no se pudo leer, y su lectura ya esta SOLICITADA — CERRADO. Solicitud S-18 emitida el 13-nov-2026

**Origen.** `src/config.js:58` y `deploy/README-DESPLIEGUE.md:45`.

**Qué se verificó.** El codigo **nunca** usa `'true'` para `trust proxy`: usa
`config.trustProxy` (`src/server.js:67`), con default `'loopback'` (`src/config.js:58`), y hay un test
que fija ese default. El valor documentado para produccion es `loopback`. El valor **real** vive en
`/opt/kair-firma/.env`, que es `600 root`: la cuenta de servicio **no lo puede leer**, asi que el
valor efectivo quedo **sin verificar**. Que el servicio escuche solo en `127.0.0.1:3001` y que la
unica entrada sea Cloudflare Tunnel hace que `loopback` sea el valor correcto, pero conviene
confirmarlo en el `.env`.

**Evidencia.** `src/server.js:61-67`; `src/config.js:53-58`; `deploy/README-DESPLIEGUE.md:45`;
`/etc/cloudflared/config.yml`: `firma.kair.fyi -> http://127.0.0.1:3001`; `ss -ltn`: el 3001 escucha
**solo** en `127.0.0.1`; el `.env` es `600 root` (lectura `EACCES`).

**Qué falta.** El 13-nov-2026 se emitio la solicitud **S-18**. Lo que queda: un `grep` del owner
sobre el `.env` que deje constancia del valor.

**Quién lo tiene.** El owner.

**Solicitud.** **S-18**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.

### M.20 - `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP` es una variable muerta que parece viva — CERRADO

**Origen.** `src/config.js:176` y la fila J10 del informe al abogado.

**Qué se verificó.** La variable se **define** en `src/config.js:176` y **no se lee en ningun otro
sitio** del codigo (grep sobre `src/`): desde la v1.2 del Acuerdo (27-oct-2026) el rechazo del buzon
corporativo es incondicional en el codigo. Se conserva para no romper despliegues que ya la tengan
definida, pero **su valor no cambia ningun comportamiento**. Documentos que la traten como un
interruptor pendiente (la fila J10 lo hacia, y ya se corrigio el 12-nov-2026) estan describiendo un
control que no existe.

**Decisión tomada (12-nov-2026).** La variable **se conserva, inerte**, con el comentario que ya dice que
no hace nada, y **ningun documento puede tratarla como interruptor**. Lo que faltaba no era una llamada de
codigo: era la **documentacion**, y se corrigieron los tres lugares que mentian —`API.md:214` («solo se
activa con ...=true») y `API.md:1058-1064` («el rechazo (D2) esta APAGADO»), que ahora dicen que el
rechazo es **incondicional** desde la v1.2, devuelve 400 `MEDIO_OTP_CORPORATIVO` y deja un evento
append-only en `gh_firma_eventos`— y el **4.7 del cuadro canonico** («el interruptor aparece apagado»),
que ahora dice que no es un interruptor. Se anadio ademas una **nota de vigencia** al
`PLAN-DESPLIEGUE-PRODUCCION-2026-10-20.md`, cuya fila «No encender» describia un interruptor que nunca
existio. Detalle en `decisiones-de-fondo-2026-11-12.md`, bloque M.20.

**Y LA DETERMINACION DE L7 YA ESTA ESCRITA (12-nov-2026).** La ficha publicada no puede presentar como
control lo que no es, y eso ya no depende de una opinion pendiente: el codigo **no tiene ningun interruptor**
para el rechazo del buzon corporativo (es incondicional desde la v1.2), la variable **no la lee ninguna
decision**, y los tres documentos que la trataban como interruptor **ya estan corregidos**. La determinacion
(L7) pide una cosa mas, y se hizo: **que la variable no se presente como control en ningun documento**, y que el
`.env` de produccion deje de traerla o la traiga con el comentario que dice que **no cambia ningun
comportamiento**. El **comando literal** quedo escrito y listo para ejecutar, con su **respaldo previo** del
`.env`, en `deploy/README-DESPLIEGUE.md` y en `docs/MIGRACION-SERVIDOR-FIRMA.md`. Es un **acto del owner**
(el `.env` de produccion es `600 root` y la cuenta de despliegue no lo lee). El codigo y los documentos ya
estan del lado del agente.

**Evidencia.** `src/config.js:164-177` (el comentario que lo dice y la definicion);
grep sobre `src/` del identificador `exigirMedioPersonalOtp`: la unica aparicion es la definicion;
`src/services/publicFlow.js:1496-1557` (el rechazo incondicional); `API.md:214` y `API.md:1058-1064`
(corregidos el 12-nov-2026); el caso real se produjo el 12-nov-2026 en una copia aislada, evento id 151;
`deploy/README-DESPLIEGUE.md` y `docs/MIGRACION-SERVIDOR-FIRMA.md` (el comando del `.env`, escrito);
`dictamen-legal-2026-11-12-tandas-2-y-3.md`, seccion 5 (L7).

**Que falta.** Nada que bloquee: la decision esta tomada y escrita en el codigo y en los documentos,
y el comando para el `.env` esta escrito y a la espera de quien tenga el `sudo`. Que el `.env` de
produccion la traiga o no es un **acto de configuracion del owner**, no una decision de fondo; y
mientras la variable siga inerte, las dos opciones son correctas.

**Quien lo tiene.** El owner, para el paso opcional del `.env`. Nadie bloquea.

### M.21 - El tunel de Cloudflare tuvo un parpadeo y nadie fue avisado, y la instalacion del canal ya esta SOLICITADA — CERRADO. Solicitud S-19 emitida el 13-nov-2026

**Origen.** El monitor de salud del servidor (`/opt/kair-firma/logs/health-check.log`).

**Qué se verificó.** El monitor corre cada 5 minutos y reporta local y publico por separado. El
12-nov-2026 a las 12:50:11 registro «**CAIDO publico** (https://firma.kair.fyi/health). Si el local
responde, el problema es del tunel de Cloudflare o del dominio», y a las 12:55:02 «OK publico». Se
recupero solo. **El health-check lo detecta y lo escribe en el log, pero no avisa a nadie.**

**Lo que se escribio el 12-nov-2026.** La **alerta por correo** esta implementada en
`deploy/health-check.sh`: avisa cuando el publico cae y el local responde (el sintoma del tunel) y
cuando **caen los dos**. Tres propiedades que importan y que estan probadas:

- **No lleva secretos**: la clave del SMTP viaja en un `netrc` temporal de modo `600`, fuera de la
  lista de procesos, y **no** va en el mensaje.
- **Solo avisa una vez por episodio**: se avisa del **cambio de estado**, no uno cada 5 minutos.
- **Se desactiva**: `ALERTA_CORREO=0`. Sin destinatario configurado, **no avisa y no falla** (sale 0).

Se probaron **8 escenarios** con un `curl` falso en Git Bash: sin destinatario, `ALERTA_CORREO=0`,
publico caido (avisa, un solo correo, sin la clave en el mensaje), no repite mientras la caida
dura, SMTP caido (sale 0 y lo dice en el log), publico arriba (limpia el estado) y los dos caidos
(mensaje correcto).

**Evidencia.** `deploy/health-check.sh` (sha256 `22c77ae8…286edd`); `bash -n` en verde;
`deploy/README-SELLO-VERSION-Y-LOGS.md` (los comandos de instalacion y de verificacion, con el «por
que» de cada paso); el parpadeo medido en `/opt/kair-firma/logs/health-check.log` (lineas de las
12:50, 12:55 y 13:00 del 12-nov-2026); `journalctl -u kair-firma --since today -p warning`: sin entradas.

**Qué falta.** El 13-nov-2026 se emitio la solicitud **S-19**. Lo que queda es
**instalar y configurar el canal**, que es del owner y necesita `sudo`:
```bash
sudo cp health-check.sh /opt/kair-firma/health-check.sh && sudo chmod 755 /opt/kair-firma/health-check.sh
# La configuracion SMTP va en /etc/cron.d/kair-firma-health con modo 600 (NO en un .env).
```

Mientras eso no se instale, **el estado real de produccion es el de antes**: el parpadeo se sigue detectando y **sigue sin avisar a nadie**.

**Quién lo tiene.** El owner (los tres `sudo`: instalar el script, el `netrc` con modo 600 y el
cron). El equipo ya dejo el mecanismo escrito y probado.

**Solicitud.** **S-19**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.

### M.22 - Las 39 casillas del §7 del SECURITY.md ya estan medidas una por una — CERRADO

**Origen.** `docs/gestion-humana/firma-electronica/SECURITY.md` §7; §8.1 del runbook; la medicion
esta en `docs/gestion-humana/firma-electronica/verificacion-cierre/seccion-7-security.md`.

**Qué se verificó.** Las 39 casillas se midieron **una por una** contra el codigo del repo y el
servidor de produccion, y cada una quedo con su estado y con su evidencia en
`verificacion-cierre/seccion-7-security.md`. El resultado: **19 CERRADO, 9 PARCIALMENTE, 11
PENDIENTE, 0 No aplica** (contando `PARCIALMENTE` como pendiente, quedan **20 sin cerrar**).
**El §7 del SECURITY.md NO se toco y sus 39 casillas siguen sin marcar**, a proposito: la decision del
proyecto es medir en un informe aparte, no marcar casillas a mano.
Lo que aparecio al medir cambia el numero: la lista era **pesimista** en lo que es criptografia, base de
datos, headers de seguridad y limites de tasa (todo eso si esta hecho y con evidencia medible), y era
**optimista** en cuatro puntos que estan rotos: la rotacion de logs, su retencion, el acceso al log
y el sello de version.

**Evidencia.** `verificacion-cierre/seccion-7-security.md` (las 39 casillas con su evidencia, la tabla
resumen de 39 filas y la frase de conciliacion, generadas por conteo y no a mano). Medido por SSH el
12-nov-2026: `ls /etc/logrotate.d/ | grep -i kair` -> NINGUNO, y `stat /opt/kair-firma/logs` -> `755
root root` (las tres casillas de §7.4 de rotacion, retencion y acceso al log: PENDIENTE);
`find /opt/kair-firma/app -perm -0002` -> **236 archivos y 18 directorios** escribibles por cualquiera;
`/health` -> `"kair_version":"compatible-0.1.189"`, que es un valor fijo de `src/routes/health.js:45`,
en un arbol sin `.git` y con `"version": "0.1.0"`: no hay sello de version; `sqlite3 -readonly` ->
`journal_mode = wal`, y el journal del servicio con `"wal":"wal","foreignKeys":1`; `npm audit` sobre el
`package-lock.json` desplegado -> **6 vulnerabilidades (1 critica, 4 altas, 1 moderada)** y sobre el
arbol del repo -> 2 altas.

**Qué falta.** Veinte casillas sin cerrar. Del **owner**: el `sudo` de los permisos de los logs y
del arbol desplegado (7.20, 7.21, 7.23), la lectura del `.env` (7.7), el canal de alerta (7.28,
7.29, 7.30), el pentest (7.38) y la ratificacion del abogado (7.31). Del **equipo**: desplegar el
paquete 1051 con `npm ci --omit=dev` (7.25, 7.26), la corrida de suite ligada a un commit candidato
(7.35, 7.36), la deteccion de anomalias del oraculo (7.24), el acta de la restauracion (7.13), el
monitor externo (7.29), el plan general de incidentes (7.39) y las versiones nuevas de la politica
de privacidad y de los terminos (7.32, 7.33). El detalle de cada una esta en el informe.

**Quién lo tiene.** El equipo (la medicion, ya entregada) y el owner (los puntos que necesitan su
`sudo`, su lectura del `.env` o su decision).

### M.23 - Los logs no rotan, no tienen retencion y su directorio lo lee cualquiera, y su instalacion ya esta SOLICITADA — CERRADO. Solicitud S-20 emitida el 13-nov-2026

**Origen.** `SECURITY.md` §7.4 (las casillas de rotacion, retencion y acceso restringido); la
medicion del servidor del 12-nov-2026.

**Qué se verificó.** **No hay logrotate para `kair-firma`.** El monitor de salud escribe en
`/opt/kair-firma/logs/health-check.log` (411 704 B y **5 820 lineas** al 12-nov 19:52, desde el
**26-oct**) y ese archivo **crece sin rotar**: nadie lo limpia y nadie lo comprime. Ademas
`/opt/kair-firma/logs` es `drwxr-xr-x root root`, o sea **cualquier usuario de la maquina lo lee**.
Las tres casillas de `SECURITY.md` §7.4 («Rotacion de logs configurada», «Retencion 90 dias» y
«Acceso al log restringido») **no se cumplen**; que la lista las deje sin marcar es distinto de que
esten cumplidas.

**Lo que se escribio el 12-nov-2026.** `deploy/logrotate-kair-firma.conf` (sha256 `23f4f2af…459f8a`):

- **diario**, `rotate 90` y `maxage 90` (retencion de 90 dias, que es lo que pide el §7.4);
- **`copytruncate`**, porque el servicio escribe con el descriptor abierto y no rota solo;
- `su root root`, y un `postrotate` que deja los logs en `640 root:root`.

El `chmod 750` del **directorio** va documentado **aparte**, a proposito: logrotate no cambia los
permisos de un directorio, y por eso el paso de instalacion los lleva de la mano.

**Evidencia.** `deploy/logrotate-kair-firma.conf`; `deploy/README-SELLO-VERSION-Y-LOGS.md` (el
comando de instalacion y el de verificacion);
`ls -ld /opt/kair-firma/logs` (produccion): `drwxr-xr-x root root`;
`ls -l /opt/kair-firma/logs/health-check.log`: 411 704 B al 12-nov-2026 19:52;
`ls /etc/logrotate.d/ | grep -i kair`: sin resultados (no hay configuracion de rotacion para el
servicio); `SECURITY.md` §7.4 (las tres casillas).

**Qué falta.** El 13-nov-2026 se emitio la solicitud **S-20**. Lo que queda es **instalarlo**, que
es del owner y necesita `sudo`:
```bash
sudo install -m 644 -o root -g root logrotate-kair-firma.conf /etc/logrotate.d/kair-firma
sudo chown root:kairfirma /opt/kair-firma/logs && sudo chmod 750 /opt/kair-firma/logs
sudo chown root:root /opt/kair-firma/logs/*.log && sudo chmod 640 /opt/kair-firma/logs/*.log
# Verificacion:
sudo logrotate -d /etc/logrotate.d/kair-firma | head -20
ls -ld /opt/kair-firma/logs && sudo -u nobody cat /opt/kair-firma/logs/health-check.log
```

**Quién lo tiene.** El owner (los `sudo`). El equipo ya dejo la configuracion escrita.

**Solicitud.** **S-20**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.

### M.24 - El sello de version esta escrito y viaja en el paquete; falta el despliegue que lo instale, y ese despliegue ya esta SOLICITADO — CERRADO. Solicitud S-21 emitida el 13-nov-2026

**Origen.** Los requisitos `7.1` y `7.12` del cuadro canonico.

**Qué se verificó.** El servicio **no anuncia** que version corre: `src/routes/health.js` devuelve
`kair_version: 'compatible-' + (config.env === 'production' ? '0.1.189' : 'dev')`, un **valor fijo**, y
`/opt/kair-firma/app` **no tiene `.git`** ni sello propio; su `package.json` declara `"version":
"0.1.0"`, tambien fijo.

Por disco si se puede, y el resultado **no es limpio**: el arbol desplegado es **mixto** —codigo de
la punta con dependencias previas al 📦1051— y **no se puede saber con certeza que codigo corre**.
(La comparacion archivo por archivo de esta ronda lo confirma: 247 archivos en comun, 6 diferentes,
0 sobrantes, y las 6 son `package.json`, `package-lock.json` y cuatro auxiliares.)

**Lo que se escribio el 12-nov-2026.** El **sello de version**:

- `scripts/generar-sello-version.js` (sha256 `a05a58e8…9707ab`): genera un sello con el **commit**,
  la **fecha** y el **hash corto del arbol**, y lo escribe en `VERSION`. Corre **sin red** y **sin
  `.git`** (el commit entra por `--commit=`) y es **idempotente**: con el mismo commit no reescribe
  el archivo. El hash es de **contenido** sobre las siete rutas que viajan en el paquete, no el
  arbol de git: por eso **detecta el arbol mixto** (codigo de la punta con el lock anterior al
  📦1051), que es exactamente el defecto medido.
- `src/routes/health.js` (sha256 `f94dd9ce…f76759`): publica el sello en el campo **aditivo**
  `version_sello`. **`kair_version` no se toca** y el resto de la respuesta queda igual. Sin archivo
  de sello, el campo dice **explicitamente** que no hay sello: no se inventa una version.
- `tests/routes/health.test.js` (sha256 `abc0b20b…f8db14`): **26/26 en verde**, sin abrir ninguna
  base, con los tres casos de «el modulo no esta disponible».

**Un defecto que se encontro revisando la entrega y quedo corregido:** la primera version dejaba
`leerSelloPublico` en `null` si el `require` del modulo fallaba, y la ruta llamaba a `null`: un
`TypeError` que **tumbaba el `/health`**. Ahora hay una funcion local que **nunca lanza** y cubre
los tres casos (modulo no cargado, modulo sin la funcion exportada, lectura que revienta).

**El sello viaja en el paquete, y eso habia que arreglarlo.** `git archive` **solo saca lo
commiteado**, y el `VERSION` **no se commitea** (si se commiteara, anunciaria el commit anterior).
Por eso el runbook tiene ahora un **paso 1b** que genera el sello **despues** del `archive` y lo
copia al stage, y el `.gitignore` excluye `firma-service/VERSION` (verificado con
`git check-ignore -v`).

**Evidencia.** `scripts/generar-sello-version.js`; `src/routes/health.js`; `tests/routes/health.test.js`
(26/26); `MIGRACION-SERVIDOR-FIRMA.md` §5.1 pasos **1b** y **6b**; `.gitignore` (la exclusion de
`VERSION`); `verificacion-cierre/acta-despliegue-2026-11-12.md` (la comparacion por sha256).

**Qué falta.** El 13-nov-2026 se emitio la solicitud **S-21**. Lo que queda:
**el despliegue que lo instale** (que es M.8, S-10) y, con el, la comprobacion en el servidor:
```bash
cat /opt/kair-firma/app/VERSION
cd /opt/kair-firma/app && sudo -u kairfirma node scripts/generar-sello-version.js --comprobar
```

**Quién lo tiene.** El owner (el despliegue, que es M.8). El equipo ya dejo el mecanismo, el test y
el runbook.

**Solicitud.** **S-21**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.

### M.25 - `BITACORA.md` y `CONTEXT.md` al dia con el estado real — CERRADO

**Origen.** El requisito `8.10` del cuadro canonico; la verificacion de la seccion 8
(`verificacion-cierre/seccion-8.md`).

**Qué se verificó.** Los dos documentos estan **al dia** con el estado real y con los bloqueos
pendientes:

- **`CONTEXT.md`**: la linea «Ultima actualizacion» pasa del 9-nov al **12-nov-2026**, y se inserto
  arriba el bloque de estado de la ronda: lo que hay hoy (el P8 ejecutado, los dos gates en
  `listo: true` con 0 bloqueantes, la suite en 2 624), lo que **no** hay (una empresa real), el
  enlace a **la META** con sus 27 puntos, **los diez bloqueos duros en una linea cada uno**, los
  dos que mas pesan (los 777 y el Anexo v1.3 que se contradice a si mismo), lo que quedo medido
  (el §7 del SECURITY.md, el cuadro canonico y el T6) y **la lista de lo que el owner tiene que
  hacer**, porque nadie mas lo puede hacer.
- **`BITACORA.md`**: cuatro entradas nuevas del 12-nov-2026, cada una con **su «por que se
  rompio»** y sus reglas: (1) el test del verificador que **llevaba los numeros del documento
  escritos a mano** y dejo de comprobar nada; (2) el script que actualizaba el cuadro y
  **duplico el texto** que acababa de escribir (104 KB -> 190 KB -> 267 KB); (3) el **conflicto de
  identificadores** entre dos informes, que se comio tres requisitos del canónico en silencio;
  (4) que «es una copia» no significa «se regenera igual»: el generador del paquete del abogado
  esta congelado en la v1.4 y correrlo hoy habria devuelto textos viejos al abogado.

**Evidencia.** `sgsst-electron-app/CONTEXT.md` (la linea de fecha y el bloque del 12-nov-2026);
`sgsst-electron-app/BITACORA.md` (las cuatro entradas del 12-nov-2026); `git status` de los dos
archivos; el perfil de finales de linea se conservo: `CONTEXT.md` sigue **mixto** (2 768 lineas
con CR CR LF y 2 325 con CRLF, sin ningun LF suelto) y `BITACORA.md` sigue en **LF puro**.

**Qué falta.** Nada: los dos documentos dicen el estado real y los bloqueos pendientes.

**Quién lo tiene.** -

### M.26 - Las tres actas: la comprobacion del servidor, el despliegue con commit y el cierre del checklist — CERRADO

**Origen.** Los requisitos `7.13` y `8.8` del cuadro canonico y el registro de cierre que nombra `8.10`.

**Qué se verificó.** Las tres actas que el canonico pedia **no existian** al empezar esta ronda; hoy
existen, cada una en el lugar que el propio canonico designa, y el requisito `7.13` pasa a
**CERRADO** y el `8.10` tambien (el cuadro canonico subia de 74 a **76 cerrados / 20 pendientes** en
ese momento; hoy son **77 cerrados / 19 pendientes**).

1. **El acta de la comprobacion del servidor** (`7.13`). El canonico decia: «Es el acta del
   despliegue. El documento que la recoge es `docs/MIGRACION-SERVIDOR-FIRMA.md`, seccion 5.1». La
   seccion 5.1 era **solo el procedimiento**. Ahora tiene un apartado propio, **§5.1.4 «El
   resultado medido de la comprobacion del servidor (12-nov-2026)»**, con el commit de referencia
   (`264d08df`), el estado del servicio, las migraciones, las cuatro huellas, los permisos, los
   logs, la red, los respaldos, el resultado del preflight y la comparacion del arbol desplegado.
   El acta completa, con la salida integra de cada comando, esta en
   `verificacion-cierre/acta-comprobacion-servidor-2026-11-12.md`.
2. **El acta de despliegue con commit** (`8.8`). `verificacion-cierre/acta-despliegue-2026-11-12.md`:
   que commit esta desplegado (con la precision de que **todo `src/` es byte a byte el de
   `264d08df`** y lo unico que falta es el bump de dependencias del 📦1051), con que resultados se
   midio (suite, gate, migraciones, salud, manifiesto, textos y preflight) y que queda abierto.
3. **El acta de cierre del checklist de 96 requisitos** (`8.10`, y el «registro de cierre» del §5 del
   plan de cierre). `verificacion-cierre/acta-cierre-checklist-2026-11-12.md`: version, hashes,
   commit, resultados de **T1 a T9** con su evidencia, decisiones **A, B y C** con su fecha,
   responsable, fecha, y la lista de los **20 pendientes** que habia entonces (hoy son 19) con su dueño.

**Evidencia.** `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` §5.1.4 (el resultado medido);
`verificacion-cierre/acta-comprobacion-servidor-2026-11-12.md`;
`verificacion-cierre/acta-despliegue-2026-11-12.md`;
`verificacion-cierre/acta-cierre-checklist-2026-11-12.md`;
`respuesta-checklist-cierre-2026-10-30.md` con la tabla regenerada por
`scripts/contar-estados-checklist.js` (hoy **77 cerrados / 19 pendientes**) y los 34 requisitos medidos
aplicados por `scripts/actualizar-cuadro-canonico-2026-11-12.js` (idempotente).

**Que falta.** Nada de este bloque. **Ojo con lo que el acta dice:** el registro de cierre
**no es condicion de produccion** (decision del owner del 5-nov-2026: «las ACTAS DE CIERRE dejan de
ser condicion de produccion»), y lo que bloquea es la **evidencia** que el registro apunta: la
**T8** (el acto de voluntad del owner), la T7, la T1 y el despliegue del 📦1051. Esos son otros
bloques de este mapa, no este.

**Quién lo tiene.** Cerrado. Lo que sigue son M.8 (el 📦1051), M.10 (el flujo e2e), M.12 (T7), M.17
(T1) y M.4 (la T8 y la firma del A4), con sus dueños nombrados.

### M.27 - El runbook no era un procedimiento: era un punto de partida — CERRADO

**Origen.** Las tres rondas anteriores (📦1048, 📦1049, 📦1050).

**Qué se verificó.** Tres fallos del runbook se encontraron **antes de que costaran un acto** y se
corrigieron: (1) el paso que regeneraba los manifiestos **no funcionaba**, porque `src/config.js`
busca el `.env` en `app/.env` y el real esta en `/opt/kair-firma/.env`: el manifiesto se quedaba en
`firmado: false` con los cuatro actos ya hechos; (2) la ruta de error del codigo de contrafirma
**tumbaba el script** con `pipefail` justo cuando fallaba, que es donde hace falta que siga; (3) la
verificacion del representante **se reescribia**, cuando un acto registrado no se reescribe. Se
corrigio tambien que el runbook pidiera **los dos codigos a la vez** (la confusion entre ellos costo
un intento) y que el manifiesto del repo quedara **byte a byte igual** al de produccion, porque viaja
en el paquete de despliegue.

**Evidencia.** `MIGRACION-SERVIDOR-FIRMA.md` §8.3 (los tres fallos, el orden del runbook y el
resultado medido del 12-nov-2026); el manifiesto del repo y el de produccion, ambos
`191c08b837b41069de4e2d25d7158fd90a7c3ce5f93b22696d2d7050f8a4013f`.

**Nota de vigencia (12-nov-2026, tarde).** La invariante «el manifiesto del repo queda byte a byte
igual al de produccion, porque viaja en el paquete de despliegue» **sigue siendo la regla**, pero
**no se cumple todavia**: desde esa tarde el repositorio lleva el manifiesto
`d9b596993cec7958cadadcd9d9ed51c33878eb03c5b0c4aa1bc642a4bfc9097b`, que difiere del de produccion en
**exactamente dos notas** (las que en produccion dicen «NO esta suscrito» mientras el propio bloque
declara `firmado: true` y `contrafirmado: true`). Los dos actos del 12-nov **existen en la base de
produccion**; lo que se corrige es la prosa. **El despliegue es lo que restablece la invariante.**

**Qué falta.** Nada: quedo cerrado y ejecutado.

**Quién lo tiene.** —

### M.28 - El destino del respaldo abre una transmision internacional que no estaba en el mapa, y su ratificacion ya esta SOLICITADA — CERRADO. Solicitud S-04 emitida el 13-nov-2026

**Origen.** La decision de M.7 (12-nov-2026): el destino del respaldo fuera del servidor.

**Qué se verificó.** Al decidir el destino del respaldo se eligio **Backblaze B2**, que esta en
**EE. UU.**, y eso **abrio un punto que el mapa no tenia**: (1) si copiar a un proveedor en el exterior
es una **transferencia internacional** (art. 26 de la Ley 1581 de 2012 y art. 24 del Decreto 1377 de 2013)
y por que via se encuadra (autorizacion del Titular, transferencia necesaria para un contrato con el
Titular, declaracion de conformidad de la SIC o clausulas modelo); (2) si Backblaze es un
**subencargado** que debe entrar en la lista de proveedores del **§4** del Anexo de Nube y del
**§5** del Anexo de Encargo (el **§11** del Anexo de Nube es «Referencias normativas», no la lista);
(3) que contrato exige el **art. 25**
del Decreto 1377 y con que clausulas minimas; (4) como se concilia con que el Anexo vigente dice que
«el cifrado en reposo del disco no esta implementado», que es una cosa distinta del respaldo que sale
cifrado, pero no puede quedar asi, en el mismo expediente, con dos verdades.

Lo que **si** esta medido: lo que sale del servidor son archivos `.enc` **cifrados con GPG simetrico
AES256**; la **frase de cifrado nunca sale** (`backup.passphrase`, 600 root); el script **verifica por
SHA-256** que la copia llego entera y **no borra nunca la copia local**; el destino **no ve texto claro**.
El bucket **todavia no existe**: crear la cuenta y el bucket es un acto del owner.

**Evidencia.** `decision-respaldo-offsite-2026-11-12.md` (el destino y el script, con su validacion);
el informe del agente legal del 12-nov-2026, punto L5 de la mesa del abogado.

**Qué falta.** La determinacion escrita del abogado **ya existe** (el pedido 6 del 12-nov-2026) y la
redaccion de la clausula con el proveedor **ya esta aplicada** en el §4 del Anexo de Nube v1.4 y en
el §5 del Encargo nuevo. El 13-nov-2026 se emitio la solicitud **S-04** al abogado matriculado. Lo
que queda: su **ratificacion** de L4 y L5, y el **texto final de las clausulas minimas del art. 25**
para el contrato con el proveedor. Y una condicion operativa que el dictamen del 12-nov-2026 anade:
el bucket debe crearse en la **region United States** de Backblaze, porque si queda en CA-East
(Canada) o en EU-Central (Paises Bajos), el destino deja de estar en la lista de paises con nivel
adecuado de proteccion y toda la determinacion cambia. Es un **acto de tercero**: el equipo puede
preparar el insumo, pero **no puede emitir esa determinacion**.

**Nota del 13-nov-2026 (revision de la asesoria).** La condicion de **region United States** es, hasta
que el abogado la confirme, una **decision conservadora de K+AIR** y **no una exigencia legal
verificada**: por el **art. 24 num. 2 del Decreto 1377** la transmision a un encargado se valida con el
**contrato del art. 25**, sin remitir a la lista de paises con nivel adecuado de proteccion (esa lista
entra por el camino de las **transferencias**, art. 24 num. 1 y art. 26 de la Ley 1581), y el alcance de
la lista publicada por la SIC **no se pudo verificar**. Por eso **S-04 ahora lo pregunta de forma
expresa**: ¿es exigencia legal o decision conservadora de K+AIR? De la respuesta depende como se
redacta la v1.4: como obligacion normativa o como decision propia declarada. El bucket se sigue creando
en la region United States en cualquier caso. El bloque **no cambia de estado**: S-04 sigue `EMITIDA`.

**Quién lo tiene.** El abogado matriculado (la ratificacion y la redaccion final) y el owner (el
contrato y la cuenta).

**Solicitud.** **S-04**, emitida el 13-nov-2026. Esta en `tabla-de-solicitudes-2026-11-13.md`, con
su destinatario, su verificacion y su fecha limite.

### M.29 - La poda del respaldo en el destino no miraba el deber legal de conservacion — CERRADO

**Origen.** La determinacion legal del 12-nov-2026 (punto L5) y la lectura de `deploy/backup-offsite.sh`.

**Que se verifico.** La poda del destino borraba por edad y sin preguntar: `rclone delete --min-age
"${RETENCION_DIAS}d"`. La poda **local** (`deploy/backup-firma.sh`) si lo hace: consulta
`SELECT COUNT(*) FROM gh_firmas_electronicas WHERE COALESCE(hold_legal,0)=1` y, si hay alguno, no
borra ninguna copia. El 11-nov el log de produccion decia «PODA RETENIDA: hay 5 firma(s) con deber
legal de conservacion (hold_legal=1)»: las cinco firmas con deber legal estaban **retenidas en local**
y se habrian borrado **del bucket** a los 30 dias.

El bucket guarda la base **completa** (no una copia por Empresa), asi que un solo hold vigente basta
para que ninguna copia se pueda borrar: todas las copias contienen ese registro. Y el Anexo de Nube
v1.3 le promete al Titular que un deber legal de conservacion «obliga a conservar sus respaldos» (su
§3). Con la poda como estaba, el texto y el bucket decian dos cosas distintas: exactamente el defecto
que el §3.4(d) de la Ley 1581 (veracidad) no admite.

**Defecto real corregido.** `deploy/backup-offsite.sh` ahora trae `hay_hold_legal()` y `podar_destino()`
pregunta antes de borrar. Ademas, la poda **deja de tragarse su propio fallo**: antes, un `rclone
delete` que fallaba (permisos, red) se silenciaba con `>/dev/null 2>&1` y el log decia que la poda se
habia hecho; ahora el fallo se escribe y el script sale con codigo 1, sin tocar la copia local.

**Como se valido.** Con el script **real** en el servidor, en un sandbox de `/tmp`, y con un `rclone`
**simulado** que deja escrito que habria borrado (no se borro nada de verdad, porque todavia no hay
bucket): **4 de 4 casos** correctos. (1) con `hold_legal=1` NO se invoco `rclone delete`; (2) sin
hold SI se invoco, con la retencion de 30 dias; (3) sin base legible NO se invoco; (4) con una base sin
la tabla de firmas NO se invoco. La duda no autoriza a borrar. Se ejecuto en el servidor, con `bash` y
`sqlite3` reales.

**Evidencia.** `deploy/backup-offsite.sh` (`hay_hold_legal`, `podar_destino`); `deploy/backup-firma.sh`
(la poda local, que ya lo hacia); `legal/anexo-nube-v1.3.html` (el §3 que lo promete al Titular); la
salida de la prueba, en el servidor.

**Que falta.** Nada: quedo corregido, medido y con su prueba.

**Quien lo tiene.** —

### M.30 - La compuerta de conservacion se abria con la bandera sola: la validacion escrita no la exigia nadie — CERRADO

**Origen.** La determinacion legal del 12-nov-2026 (punto L3).

**Que se verifico.** La tabla supletoria declara su propia activacion (`aplicacion.activada`) y el codigo
la leia: `_tablaActivada()` devolvia `true` con solo que `activada` valiera `true`. Pero
`validado_por` y `validado_at` —los dos campos que guardan **quien** valido los plazos de diez (10) y
cinco (5) anos y **cuando**— **no los leia ningun codigo**: el respaldo congelado en el propio codigo
tambien los trae en `null`. En los hechos la compuerta era un acto de disciplina humana: cambiar
`activada` a `true` aplicaba los plazos de la tabla **sin que nada exigiera la validacion que el
archivo mismo dice que los precede**.

**Defecto real corregido.** `src/services/retencion.js`: `_tablaActivada()` exige ahora `validado_por`
**y** `validado_at`. Sin los dos, la compuerta **no** se abre, por mucho que la bandera diga que si. Es
el cambio minimo que hace que la maquina sea fiel a lo que el texto promete, y evita el falso verde:
un archivo con `activada: true` y sin validacion aplicaba los plazos de categorias que nadie habia
validado.

**Como se valido.** Con **tres pruebas nuevas** que fijan las tres formas que importan: sin validacion
(no se abre), con la validacion a medias (no se abre) y con la validacion completa (si se abre). El
helper de pruebas (`tests/helpers.js`) inyecta una validacion **ficticia**, porque lo que se prueba es
el mecanismo de la tabla y no la validacion de sus plazos (que es un acto del abogado). El area de
conservacion: **24 de 24**.

**Evidencia.** `src/services/retencion.js` (`_tablaActivada`); `tests/services/conservacion-supletoria.test.js`
(los tres casos); `tests/helpers.js` (`tablaConservacionActivada`).

**Que falta.** Nada: quedo corregido y con prueba. **Lo que sigue igual** es un acto del owner y del
abogado, y no cambia: la **validacion** de los plazos (M.6) y la apertura de la compuerta. Lo que
cambio es que **la apertura ahora exige la validacion escrita en el archivo**, no solo la decision.

**Quien lo tiene.** —

---

## La tabla

| Bloque | Cerrados | Pendientes | No aplica | Total |
|---|---|---|---|---|
| 1. Bloqueos duros | 10 | 0 | 0 | 10 |
| 2. Condiciones de apertura | 8 | 0 | 0 | 8 |
| 3. Deuda y riesgo | 12 | 0 | 0 | 12 |
| **TOTAL** | **30** | **0** | **0** | **30** |

Los 0 pendientes concilian: ninguno = 0. Las 21 solicitudes de la tabla
(`tabla-de-solicitudes-2026-11-13.md`): 21 EMITIDA. Cerrado en este mapa significa que
el pedido esta emitido y medido, no que el acto este cumplido: cada acto de un tercero
se sigue en esa tabla, con su estado, su destinatario y su fecha.

---

## Lo que YA esta verificado y no esta en esta lista

Esto se midio el 12-nov-2026 y **no** es un bloqueante:

- Los **dos gates** (`publicacion` y `primera_firma`) dan `listo: true`, con 42 items cada uno,
  40 `ok` y **0 bloqueantes**.
- El servicio esta `active` con `NRestarts = 0`, y `/health` responde 200 con `db: ok`.
- El **Acuerdo v1.6 esta publicado**, y el Anexo de Nube v1.3 y el Anexo de Encargo 2026-11-11
  estan **suscritos y contrafirmados**, con sus actas.
- El sitio publico sirve **exactamente** las huellas suscribidas (6 URLs comprobadas).
- La **suite** del servicio: **2 689 tests, 2 687 pass, 0 fail, 2 skipped** (corrida final del 13-nov
  por la tarde, segunda parte, 180 archivos de prueba, `exit 0`), y **vinculada a un commit**: el 12-nov por la
  manana se corrio tambien desde un clon limpio del commit `e4dd5f31` y dio el mismo resultado que
  la corrida de esa manana (2 665 / 2 663 / 0 / 2, mismo conjunto de nombres de prueba, clon byte a
  byte igual al arbol del owner). Los **+2** de la tarde del 12-nov son las dos pruebas de regresion
  del manifiesto, posteriores a ese commit, y los **+5** de esta ronda son las del enlace entre cada
  bloque del mapa y su fila en `tabla-de-solicitudes-2026-11-13.md` y la del guard que falla si la
  cita errada del Decreto 1377 reaparece en los dos candidatos de la v1.4.
- El `npm audit` del repo: **0 vulnerabilidades**. Las dos altas de M.13 se corrigieron en el repo
  (`nodemailer` 6.10.1 -> 10.5.0 y `zod` 3.25.76 -> 4.6.7); **en produccion siguen vivas** hasta
  que se despliegue el 📦1051.
- Las **61 migraciones** estan aplicadas y verificadas en el servidor, 1:1 con el repo.
- Las **39 casillas del §7 del `SECURITY.md`** estan medidas una por una: **19 CERRADO, 9
  PARCIALMENTE, 11 PENDIENTE** (`verificacion-cierre/seccion-7-security.md`).
- El **cuadro canonico** esta reconciliado con lo medido: de 62 cerrados / 34 pendientes a
  **77 cerrados / 19 pendientes** sobre 96, con la tabla regenerada por script (la foto anterior,
  ya superada, era 76 / 20).
- El **caso T6** (buzon corporativo rechazado) **se produjo** contra el codigo desplegado, con su
  asiento, sobre una copia aislada; produccion quedo intacta y demostrado.

Y esto se corrigio el 12-nov-2026:

- La fila **T9** del informe al abogado describia un estado que ya no existe (decia que el Acuerdo y
  los anexos debian seguir sin firmar). Se reescribio con el estado medido.
- La fila **J10** daba por hecho un interruptor apagado que ya no cambia nada. Se corrigio.
- El **`SHA256SUMS.txt`** del paquete del abogado no cuadraba con dos de sus adjuntos (uno de ellos
  desde la ronda anterior). Se regenero y ahora hay un verificador que lo comprueba solo
  (`firma-service/scripts/verificar-sumas-paquete-abogado.js`, con su test).
- El **runbook de despliegue** no instalaba dependencias: se documento el paso que faltaba.
- La **§7 del runbook** publicaba una cifra de suite vencida (2 574): se corrigio a la vigente.
- El **cuadro canonico** seguia con la foto del 30-oct: se actualizo con lo medido (34 requisitos),
  **por script**, y su texto sale literalmente de los informes de `verificacion-cierre/`.

---

## Como se mantiene esto

1. **El estado es una palabra**, no un parrafo: `CERRADO`, `PENDIENTE`, `PARCIALMENTE`, `No aplica`.
   La explicacion va en el cuerpo.
2. **La tabla se regenera**, no se escribe:
   `node firma-service/scripts/contar-estados-meta-apertura.js --escribir`.
   Sin esa opcion el script **falla** si el documento no cuadra con su propio conteo.
3. **Cada bloque declara su origen** (la fila del cuadro de cierre, del informe al abogado o de la
   decision de correo de la que sale). Un bloque sin origen no es trazable, y este mapa existe para
   ser trazado.
4. **Un bloque se cierra con evidencia**, no con una intencion. Si el estado cambia, se cambia la
   clave y la evidencia; si no hay evidencia, el estado no se mueve.

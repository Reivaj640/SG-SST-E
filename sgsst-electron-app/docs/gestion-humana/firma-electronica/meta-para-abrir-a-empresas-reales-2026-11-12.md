# La meta para abrir el servicio de firma a empresas reales

> **Qué es este documento.** La pregunta que lo motivó fue «¿está lista para producción?». La
> respuesta corta es: **lista para operar, no abierta**. Lo que separa una cosa de la otra son
> veintisiete puntos concretos, y este documento los lista **con su estado, su evidencia y quién lo
> tiene**.
>
> **Cómo se lee.** Cada bloque dice una cosa, con la evidencia que lo sostiene. El estado va en la
> clave del encabezado, después del último raya largo, y es una de estas cuatro palabras:
> `CERRADO`, `PENDIENTE`, `PARCIALMENTE`, `No aplica`. `PARCIALMENTE` cuenta como pendiente: algo
> falta. La tabla resumen **no se escribe a mano**: la regenera
> `firma-service/scripts/contar-estados-meta-apertura.js`, y ese script **falla** si el documento no
> cuadra con su propio conteo.
>
> **Medido el 2026-11-12**, contra el servicio desplegado, no contra una copia.
>
> **Alcance.** Estos veintisiete puntos son los que separan «el servicio funciona» de «una empresa real
> puede firmar». Los que están fuera de este mapa (los 96 requisitos del cuadro de cierre del 30-oct)
> se verificaron aparte y se dejaron en
> `docs/gestion-humana/firma-electronica/verificacion-cierre/`.

---

## 1. Bloqueos duros

> Son los que impiden que una empresa real pueda firmar. Mientras estén abiertos, el servicio puede
> estar sano, monitoreado y con los instrumentos suscritos, y aun así **no se puede abrir**.

### M.1 - No hay ninguna empresa real suscrita: la unica que hay es la de prueba — PENDIENTE

**Origen.** La ficha de las Empresas en produccion; el P8 fue un ensayo sobre ASEPLUS.

**Qué se verificó.** Se consultó `gh_firma_empresas` en la base de produccion. Hay **una sola** fila:
`ASEPLUS CARIBE S.A.S.` (NIT 900.829.731-1, `activo = 1`). El owner lo aclaro el 12-nov-2026:
**ASEPLUS es una empresa de prueba**. El alta de un cliente real, su suscripcion de los anexos y su
primera solicitud de firma **no las ha recorrido nadie**.

**Evidencia.** `gh_firma_empresas` (produccion): una unica fila, `id_empresa = 900829731`,
`activo = 1`. `anexo_nube_version = 1.3`, `anexo_nube_firmado_at = 2026-11-12T15:38:27.990Z`,
`anexo_nube_ejecutado_at = 2026-11-12T16:13:54.106Z`, `anexo_encargo_suscrito_version = 2026-11-11`,
`anexo_encargo_suscrito_at = 2026-11-12T15:40:06.992Z`.

**Qué falta.** El recorrido completo con una empresa real: alta, suscripcion del Anexo de Nube v1.3 y
del Anexo de Encargo 2026-11-11 por esa empresa, contrafirma de K+AIR, primera solicitud de firma,
primer OTP y primera constancia emitida.

**Quién lo tiene.** El owner (alta y decision) y el equipo (acompañamiento y evidencia).

### M.2 - La compuerta del Anexo de Nube sigue apagada: la decision escrita ya existe y el preflight da OK, falta el acto — PENDIENTE

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

**Que falta.** **Solo el acto**, y son tres cosas concretas, no una decision:

1. **Paso 3 del §13** — encender la bandera en el entorno del servicio (`FIRMA_EXIGIR_ANEXO_NUBE=true`)
   y reiniciar. Es el unico paso que todavia no se ha ejecutado.
2. **La reejecucion con la bandera encendida** — el preflight con `--exigir-compuerta` (que exige la
   variable en `true` y por eso hoy no se puede correr) tiene que dar 0 *despues* de encenderla.
3. **La regularizacion de las empresas que no lo tengan** — hoy es una sola y ya lo tiene; con el
   primer cliente real, la compuerta lo bloquea hasta que suscriba, y eso hay que atenderlo una
   empresa por una.

El paso 4 del §13 (publicar el Acuerdo) ya esta cubierto: la v1.6 esta publicada con fecha de
vigencia del 11-nov-2026. El paso 0 (publicar el Anexo) y el paso 1 (la Empresa lo suscribe) tambien:
la v1.3 esta publicada y ASEPLUS la suscribio y la contrafirmo el 12-nov.

**Quien lo tiene.** El owner (encender la bandera y reiniciar: hace falta `sudo` sobre el `.env` y el
servicio) con el equipo (correr el preflight con `--exigir-compuerta` y dejar la salida fechada).

### M.3 - El caso del buzon corporativo: probado contra el codigo desplegado, pero nunca ha ocurrido en produccion — PARCIALMENTE

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

### M.4 - La autorizacion operativa del representante legal (A4) esta sin firmar — PENDIENTE

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

**Qué falta.** La firma de A4 con la version y la huella que se autorizan.

**Quién lo tiene.** El owner (representante legal de Gesstiar S.A.S.).

### M.5 - La ratificacion externa del abogado: el papel de Google y la Circular 002/2025 — PENDIENTE

**Origen.** J6 y J7 del informe al abogado.

**Qué se verificó.** J6 (el papel de Google en el flujo de correo) y J7 (el alcance de la Circular
Externa 002 de 2025 y el estado de inscripcion en el RNBD) siguen **pendientes de un tercero**: son
determinaciones juridicas, no medidas de ingenieria. El propio Anexo de Nube lo dice en su seccion 5:
su contenido **debe ser revisado por un abogado** antes de considerarse contractualmente valido, y en
particular el punto sobre la Circular Externa 002 de 2025.

**Evidencia.** `10-informe-correcciones-para-asesor-juridico.md`, filas J6 y J7, ambas con
**PENDIENTE**; `sgsst-electron-app/legal/anexo-nube-v1.3.html`, bloque «Revision profesional» (la
redaccion que pide la revision juridica profesional).

**Qué falta.** La determinacion escrita de estos dos puntos y la respuesta a la pregunta de la errata.

**Quién lo tiene.** El abogado (la determinacion) y el owner (la gestion).

### M.6 - La tabla supletoria de conservacion sigue sin validar, con su compuerta cerrada a proposito — PENDIENTE

**Origen.** J8 del informe al abogado; la fila 3.1 y 3.2 del cuadro canonico.

**Qué se verificó.** `config/tabla-conservacion.json` tiene `aplicacion.activada = false`: la
compuerta de conservacion esta **cerrada a proposito** y asi debe seguir hasta que el abogado valide
la tabla y los plazos de 10 y 5 anos. El catalogo legado de 20 anos desde la firma no esta alineado
con la precedencia del 8.6(a).

**Evidencia.** `sgsst-electron-app/firma-service/config/tabla-conservacion.json` ->
`aplicacion.activada = false`; `10-informe-correcciones-para-asesor-juridico.md`, fila J8 (PENDIENTE:
el catalogo legado no esta alineado y la compuerta sigue cerrada porque depende de su validacion).

**Qué falta.** La validacion juridica de la tabla y de los plazos, y despues la decision de abrirla
(su propio orden: validar, alinear, reejecutar pruebas, abrir).

**Quién lo tiene.** El abogado (valida) y el owner (abre).

### M.7 - No hay copia de los respaldos fuera del servidor, y los actos del P8 aun no estan en ninguno — PENDIENTE

**Origen.** El pendiente «respaldo off-site» de la cola; `7.5` del cuadro canonico.

**Qué se verificó.** Los respaldos son diarios a las 22:00, cifrados con GPG simetrico AES256 y con
verificacion de integridad: el mecanismo es correcto. Pero **viven en `/opt/kair-firma/backups`, en el
mismo disco que la base**: si la maquina se muere, se pierden los dos. El ultimo respaldo al 12-nov
era del **11-nov a las 22:00**, con sha256 `de14e3f4b3c94c32eb690ae9215c111cdc1b450c963726eac54bd5192ebde20a`;
**los cuatro actos del P8 todavia no estaban en ningun respaldo** (el del 12-nov a las 22:00 ya los
incluye).

**Evidencia.** `ls -lt /opt/kair-firma/backups` (produccion): 22 respaldos de la base y 16 del
storage, **todos en el mismo disco**; `tail -1 backups/backup.log`: «Backup OK:
firma-20261111-220001.sqlite.enc (164714 B, sha256 de14e3f4b..., integrity ok, cifrado gpg)».

**Qué falta.** Decidir el destino de la copia externa y dejarla corriendo y verificada. El script
`deploy/backup-offsite.sh` quedo escrito y validado (sintaxis y selector de archivos probados en el
servidor el 12-nov-2026); falta la configuracion del destino, que es una decision del owner.

**Quién lo tiene.** El owner (el destino y las credenciales); el equipo (la instalacion y la prueba).

### M.8 - El 📦1051 no esta desplegado: produccion corre las dependencias vulnerables — PENDIENTE

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

**Qué falta.** Desplegar el 📦1051 **con el paso de instalacion** (`npm ci --omit=dev` con el servicio
parado, antes de las migraciones) y volver a medir las versiones en el servidor.

**Quién lo tiene.** El owner (el despliegue con `sudo`).

### M.9 - El codigo que corre es escribible por cualquiera: 236 archivos en 777 — PENDIENTE

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

**Qué falta.** Aplicar el paso 2b del runbook (es una linea, con `sudo`). Es el **unico** punto que el
abogado habia marcado como bloqueante y que sigue igual cuatro meses despues.

**Quién lo tiene.** El owner (ejecutar el `chmod` con su clave de sudo).

### M.10 - El flujo electronico completo nunca se ha ejercitado contra el codigo que hoy corre — PENDIENTE

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

**Qué falta.** Una corrida controlada de extremo a extremo **contra el codigo desplegado hoy**: crear
la solicitud, enviar la invitacion, firmar desde el celular y descargar la constancia; despues
retirar el rastro con `limpiar-rastro-prueba.js --solo-firmas` y dejar el acta. Es el unico pendiente
de esta seccion que exige **una persona con un celular**, no un script. La misma corrida es la que
produce el caso real del buzon corporativo (M.3).

**Quién lo tiene.** El owner (firma desde el celular y descarga de la constancia) con el equipo
(smoke, limpieza del rastro y acta).

---

## 2. Condiciones de apertura

> No impiden firmar hoy, pero hay que cumplirlas antes de que entre el primer cliente real: son las
> condiciones que hacen que ese cliente no se encuentre con una excepcion sin resolver.

### M.11 - Los tres alias de Workspace siguen sin verificar — PENDIENTE

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

**Qué falta.** Crear los tres alias y **verificarlos con un envio real a cada uno**, dejando la
evidencia (Message-ID y cabeceras) en el manifiesto.

**Quién lo tiene.** El owner (la consola y el envio).

### M.12 - El procedimiento de reversion esta probado, y la prueba encontro un defecto real que ya se corrigio — PARCIALMENTE

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
base); `10-informe-correcciones-para-asesor-juridico.md`, fila T7 (que **todavia dice** «PENDIENTE:
depende del servidor» y hay que cerrarla: ver «Qué falta»);
`ls /opt/kair-firma/backups/restauracion.log` (produccion): no existe.

**Qué falta.**
1. **Desplegar la correccion en el servidor**: el programa que corre en `/opt/kair-firma/app` sigue
   siendo el viejo (`a1f3e76b…7175`), o sea el que aborta con `FOREIGN KEY constraint failed`. La
   correccion esta probada pero **no esta desplegada**. Acto del owner.
2. **La restauracion cifrada real**: los `.enc` y `backup.passphrase` son `600 root` y `sudo` pide
   contrasena, asi que la prueba de restauracion se hizo por la via de la copia limpia (`.backup` +
   `.restore`), que es la que el entorno permite. Falta la prueba del camino real, con root. El cron
   `0 4 1 * *` solo producira `restauracion.log` el 1-dic-2026.
3. **Cerrar la fila T7** del informe al abogado: decidir si queda CERRADO o PENDIENTE.

**Quién lo tiene.** El owner (los puntos 1 y 2, que necesitan `sudo`) y el equipo (el punto 3).

### M.13 - Las dos altas de npm audit estan subidas en el repo: el audit da 0; en produccion siguen vivas hasta el despliegue — PARCIALMENTE

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

**Qué falta.** **El despliegue**, y con el se cierra este bloque: el **repositorio** ya esta en 0
vulnerabilidades, pero **produccion sigue con `nodemailer 6.10.1` y `zod 3.25.76`** hasta que se
despliegue el bump (que es M.8). Es decir: **las dos altas siguen vivas en el servidor**, que es
donde importan. Queda tambien el **envio real contra SMTP**, que la suite no cubre (usa
`jsonTransport`) y que habria que ejercitar antes de abrir a una empresa real.

**Quién lo tiene.** El owner (el despliegue, con `sudo`: M.8). El equipo ya hizo el trabajo tecnico.
### M.14 - Node 22 en el servidor: decidido el 11-nov-2026 y no ejecutado — PENDIENTE

**Origen.** §8.2 del runbook; la decision del owner del 11-nov-2026.

**Qué se verificó.** El servidor corre **Node 20.20.2** (ABI 115) y `better-sqlite3` 11.10.0, que
funciona con ese runtime. La decision del owner del 11-nov-2026 fue que el servidor corra **Node 22
(ABI 127)**, que es la unica combinacion con prebuild oficial. **Hoy no es un bloqueo**: el servicio
esta sano con Node 20. Es deuda de mantenimiento, con una trampa: si se sube el runtime hay que
**recompilar** `better-sqlite3` antes de arrancar, o el proceso muere al abrir la base.

**Evidencia.** `node -v` en el servidor: `v20.20.2`; `systemctl show kair-firma -p ExecMainStartTimestamp`:
arrancado el 2026-11-12 09:30:23 -05, `NRestarts = 0`; `MIGRACION-SERVIDOR-FIRMA.md` §8.2 (la tabla
de combinaciones y el comando `npm rebuild better-sqlite3`).

**Qué falta.** La ventana de mantenimiento para subir el runtime y recompilar el modulo nativo, con su
rollback.

**Quién lo tiene.** El owner (la ventana).

### M.15 - La v1.1 del Nube quedo suscrita y sin contrafirma: falta decidir que se hace con ella — PENDIENTE

**Origen.** La suscripcion id 1 de `gh_firma_anexo_nube_suscripciones`; la decision de juridica.

**Qué se verificó.** Hay **dos** suscripciones del Anexo de Nube en produccion: la id 1, de la
**v1.1** (5-nov-2026, `e9517536...`), suscrita por ASEPLUS y **sin contrafirma**; y la id 2, de la
**v1.3** (12-nov-2026, `fdd10551...`), suscrita **y contrafirmada**. Lo mismo con el Anexo de Encargo:
la version 2026-11-06 (contrafirmada el 7-nov) y la 2026-11-11 (contrafirmada el 12-nov). Las dos
suscripciones viejas estan **intactas**, con su huella y su evidencia: lo que se deshizo en la fase 1
del P8 fueron los punteros de la ficha, no los hechos.

**Evidencia.** `gh_firma_anexo_nube_suscripciones` (produccion): id 1 con `version = 1.1`,
`contrafirmado_at` vacio; id 2 con `version = 1.3`, `contrafirmado_at = 2026-11-12T16:13:54.106Z`,
`contrafirma_actor = Javier Robles Fontalvo`, `contrafirma_facultad = REPRESENTANTE_LEGAL_ENCARGADO`,
acta `050f223a3665cf7d`.

**Qué falta.** La decision de juridica: si la v1.1 se contrafirma retroactivamente o queda como
registro historico. No es un problema tecnico: es una decision sobre que dice el texto.

**Quién lo tiene.** El owner con el abogado.

### M.16 - El inventario de buzones hay que repetirlo cuando haya solicitudes reales — PENDIENTE

**Origen.** El item `d02` del gate; la evidencia del 26-oct-2026.

**Qué se verificó.** El item `d02` del gate esta en `ok` porque **el inventario se ejecuto** y su
evidencia esta escrita, no porque haya casos: `d02.inventario_buzones = 0`. La propia evidencia dice
que hay que repetirlo cuando haya solicitudes reales. While eso no bloquea, es la comprobacion que
sustentaria a M.3 en produccion.

**Evidencia.** `legal-readiness.json` -> `d02.inventario_buzones = 0` con la evidencia del
26-oct-2026; `src/services/readinessLegal.js:1610-1611` (el `ok` depende de que el inventario este
contado y documentado, no de que el numero sea alto).

**Qué falta.** La corrida del inventario `scripts/inventario-buzon-corporativo.js` cuando exista al
menos una solicitud real con un caso rechazado. El 12-nov-2026 se produjo el caso en una copia
aislada (ver M.3), pero **el manifiesto no se toco**: `d02.inventario_buzones` sigue en 0 a proposito,
porque el caso real en produccion todavia no ha ocurrido.

**Quién lo tiene.** El equipo.

### M.17 - La corrida desde un clon limpio se hizo tres veces y coincide exacta con el arbol del owner; falta la corrida sobre el commit — PARCIALMENTE

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
un resultado distinto. La trampa quedo escrita en `PROMPT.md` y en el acta.

**Evidencia.** `verificacion-cierre/t1-corrida-desde-clon-limpio.md` (el acta, con la salida literal
de cada corrida y la comparacion de nombres); `10-informe-correcciones-para-asesor-juridico.md`, fila
T1; `plan-cierre-abogado-2026-10-31.txt:91`; `verificacion-cierre/seccion-8.md`, requisito 8.5.

**Qué falta.** **Una sola cosa, y no es correr mas pruebas:** la corrida **sobre el estado
commiteado**. La de hoy se hizo sobre `HEAD` **mas** el trabajo sin commitear de la ronda, que hubo
que trasladar a mano al clon; sin commit no hay un commit candidato al que vincular la corrida (T3).
Cuando haya commit, el clon sale del commit y no hay nada que trasladar: es una corrida mas.

**Quién lo tiene.** El equipo, en el momento en que haya commit. El owner es quien lo habilita
(es el «dale» del que habla `PROMPT.md` §5.1).

---

### M.18 - Los dos anexos ya suscritos dicen cosas que la realidad ya desmintio: hace falta una version nueva — PENDIENTE

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

**Evidencia.** `verificacion-cierre/secciones-1-2.md`, requisito 1.9 (**PARCIALMENTE**: «los dos anexos
vigentes afirman que sus propios actos y P2 «estan pendientes»: hace falta una version nueva (un texto
suscrito no se toca) y corregir la tabla de instrumentos»); `verificacion-cierre/secciones-3-5.md`,
requisitos 5.5 y 5.6 (**PENDIENTE** y **PARCIALMENTE**: ambos exigen «una version nueva del Anexo de
Nube (v1.4)»); `sgsst-electron-app/legal/anexo-nube-v1.3.html` (los §1 y §5);
`sgsst-electron-app/legal/anexo-encargo.html` (la remision).

**Qué falta.** La decision del owner de reemitir los dos anexos (v1.4 del Nube y el Encargo que la
remite) y, con ella, la redaccion, las firmas y el manifiesto al dia. Mientras tanto,
`tabla-instrumentos-vigentes-2026-11-09.md` sigue diciendo «NO suscrito» y contradice a la base: esa
correccion es de un minuto y es la que mas puede confundir a un lector.

**Quién lo tiene.** El owner (la decision) con el abogado (la redaccion) y el equipo (huellas, manifiesto
y firmas).

## 3. Riesgos y deuda

> No impiden la apertura. Se anotan porque son cosas que el owner deberia saber antes de abrir, y
> porque algunos son trampas que ya mordieron una vez.

### M.19 - El valor efectivo de `TRUST_PROXY` no se pudo leer — PENDIENTE

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

**Qué falta.** Un `grep` del owner sobre el `.env` que deje constancia del valor.

**Quién lo tiene.** El owner.

### M.20 - `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP` es una variable muerta que parece viva — PENDIENTE

**Origen.** `src/config.js:176` y la fila J10 del informe al abogado.

**Qué se verificó.** La variable se **define** en `src/config.js:176` y **no se lee en ningun otro
sitio** del codigo (grep sobre `src/`): desde la v1.2 del Acuerdo (27-oct-2026) el rechazo del buzon
corporativo es incondicional en el codigo. Se conserva para no romper despliegues que ya la tengan
definida, pero **su valor no cambia ningun comportamiento**. Documentos que la traten como un
interruptor pendiente (la fila J10 lo hacia, y ya se corrigio el 12-nov-2026) estan describiendo un
control que no existe.

**Evidencia.** `src/config.js:164-177` (el comentario que lo dice y la definicion);
grep sobre `src/` del identificador `exigirMedioPersonalOtp`: la unica aparicion es la definicion;
`src/services/publicFlow.js:1498-1557` (el rechazo incondicional).

**Qué falta.** Decidir si se borra del `.env` o se deja con un comentario que diga que no hace nada.
No es urgente: no rompe nada.

**Quién lo tiene.** El owner.

### M.21 - El tunel de Cloudflare tuvo un parpadeo y nadie fue avisado — PARCIALMENTE

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

**Qué falta.** **Instalar y configurar el canal**, que es del owner y necesita `sudo`:

```bash
sudo cp health-check.sh /opt/kair-firma/health-check.sh && sudo chmod 755 /opt/kair-firma/health-check.sh
# La configuracion SMTP va en /etc/cron.d/kair-firma-health con modo 600 (NO en un .env).
```

Mientras eso no se instale, **el estado real de produccion es el de antes**: el parpadeo se sigue
detectando y **sigue sin avisar a nadie**.

**Quién lo tiene.** El owner (los tres `sudo`: instalar el script, el `netrc` con modo 600 y el
cron). El equipo ya dejo el mecanismo escrito y probado.
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

**Qué falta.** Veinte casillas sin cerrar. Del **owner**: el `sudo` de los permisos de los logs y del
arbol desplegado (7.20, 7.21, 7.23), la lectura del `.env` (7.7), el canal de alerta (7.28, 7.29,
7.30), el pentest (7.38) y la ratificacion del abogado (7.31). Del **equipo**: desplegar el paquete
1051 con `npm ci --omit=dev` (7.25, 7.26), la corrida de suite ligada a un commit candidato (7.35,
7.36), la deteccion de anomalias del oraculo (7.24), el acta de la restauracion (7.13), el monitor
externo (7.29), el plan general de incidentes (7.39) y las versiones nuevas de la politica de
privacidad y de los terminos (7.32, 7.33). El detalle de cada una esta en el informe.

**Quién lo tiene.** El equipo (la medicion, ya entregada) y el owner (los puntos que necesitan su
`sudo`, su lectura del `.env` o su decision).

### M.23 - Los logs no rotan, no tienen retencion y su directorio lo lee cualquiera — PARCIALMENTE

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

**Qué falta.** **Instalarlo**, que es del owner y necesita `sudo`:

```bash
sudo install -m 644 -o root -g root logrotate-kair-firma.conf /etc/logrotate.d/kair-firma
sudo chown root:kairfirma /opt/kair-firma/logs && sudo chmod 750 /opt/kair-firma/logs
sudo chown root:root /opt/kair-firma/logs/*.log && sudo chmod 640 /opt/kair-firma/logs/*.log
# Verificacion:
sudo logrotate -d /etc/logrotate.d/kair-firma | head -20
ls -ld /opt/kair-firma/logs && sudo -u nobody cat /opt/kair-firma/logs/health-check.log
```

**Ojo con la ultima linea de verificacion:** con `640 root:root`, `nobody` **no** debe poder leer
el log. Si puede, el permiso no quedo bien puesto.

**Mientras no se instale, produccion sigue sin rotar, sin retencion y con el directorio legible**:
el estado real es el de antes.

**Quién lo tiene.** El owner (los `sudo`). El equipo ya dejo la configuracion escrita.
### M.24 - El sello de version esta escrito y viaja en el paquete; falta el despliegue que lo instale — PARCIALMENTE

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

**Qué falta.** **El despliegue que lo instale** (que es M.8) y, con el, la comprobacion en el
servidor:

```bash
cat /opt/kair-firma/app/VERSION
cd /opt/kair-firma/app && sudo -u kairfirma node scripts/generar-sello-version.js --comprobar
```

**Mientras no se despliegue, `/health` sigue sin decir que version corre**: el campo nuevo todavia
no existe en produccion.

**Quién lo tiene.** El owner (el despliegue, que es M.8). El equipo ya dejo el mecanismo, el test y
el runbook.
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

**Quién lo tiene.** —

**Qué se verificó.** `Historial.md` y `PROMPT.md` **estan al dia** (la decima ronda documenta los
cuatro actos del P8 y las dos compuertas). Los otros dos no:

- `sgsst-electron-app/BITACORA.md:9626` — su ultima entrada es del **11-nov** («El dia que el acta
  decia QUIEN firmo pero no CON QUE PODER»). **No hay entrada** de la publicacion de la v1.6 ni de
  la ejecucion del P8.
- `sgsst-electron-app/CONTEXT.md:43` y `:70` — **desactualizado**: sigue describiendo el P8 como
  pendiente, el Anexo de Nube vigente como la **v1.2**, y «T6, T7, T8 y J1-J14» como abiertos.

Un lector que entre por `CONTEXT.md` recibe una foto del 10-nov, no la de hoy.

**Evidencia.** `sgsst-electron-app/BITACORA.md:9626` (ultima entrada) y el grep de `v1.6|12-nov-2026|P8`
sobre el archivo (una sola coincidencia, de otro tema);
`sgsst-electron-app/CONTEXT.md:43` y `:70`;
`verificacion-cierre/seccion-8.md`, requisito 8.10 (**PARCIALMENTE**).

**Qué falta.** La entrada de `BITACORA.md` con el hito de la v1.6 y del P8, y poner `CONTEXT.md` al
dia.

**Quién lo tiene.** El equipo.

### M.26 - Las tres actas: la comprobacion del servidor, el despliegue con commit y el cierre del checklist — CERRADO

**Origen.** Los requisitos `7.13` y `8.8` del cuadro canonico y el registro de cierre que nombra `8.10`.

**Qué se verificó.** Las tres actas que el canonico pedia **no existian** al empezar esta ronda; hoy
existen, cada una en el lugar que el propio canonico designa, y el requisito `7.13` pasa a
**CERRADO** y el `8.10` tambien (el cuadro canonico sube de 74 a **76 cerrados / 20 pendientes**).

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
   responsable, fecha, y la lista de los **20 pendientes** con su dueño.

**Evidencia.** `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` §5.1.4 (el resultado medido);
`verificacion-cierre/acta-comprobacion-servidor-2026-11-12.md`;
`verificacion-cierre/acta-despliegue-2026-11-12.md`;
`verificacion-cierre/acta-cierre-checklist-2026-11-12.md`;
`respuesta-checklist-cierre-2026-10-30.md` con la tabla regenerada por
`scripts/contar-estados-checklist.js` (76 cerrados / 20 pendientes) y los 34 requisitos medidos
aplicados por `scripts/actualizar-cuadro-canonico-2026-11-12.js` (idempotente).

**Que falta.** Nada de este bloque. **Ojo con lo que el acta dice:** el registro de cierre **no es
condicion de produccion** (decision del owner del 5-nov-2026: «las ACTAS DE CIERRE dejan de ser
condicion de produccion»), y lo que bloquea es la **evidencia** que el registro apunta: la **T8** (el
acto de voluntad del owner), la T7, la T1 y el despliegue del 📦1051. Esos son otros bloques de este
mapa, no este.

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

**Qué falta.** Nada: quedo cerrado y ejecutado.

**Quién lo tiene.** —

---

## La tabla

| Bloque | Cerrados | Pendientes | No aplica | Total |
|---|---|---|---|---|
| 1. Bloqueos duros | 0 | 10 | 0 | 10 |
| 2. Condiciones de apertura | 0 | 8 | 0 | 8 |
| 3. Deuda y riesgo | 4 | 5 | 0 | 9 |
| **TOTAL** | **4** | **23** | **0** | **27** |

Los 23 pendientes concilian: 10 del bloque 1 + 8 del bloque 2 + 5 del bloque 3 = 23.

---

## Lo que YA esta verificado y no esta en esta lista

Esto se midio el 12-nov-2026 y **no** es un bloqueante:

- Los **dos gates** (`publicacion` y `primera_firma`) dan `listo: true`, con 42 items cada uno,
  40 `ok` y **0 bloqueantes**.
- El servicio esta `active` con `NRestarts = 0`, y `/health` responde 200 con `db: ok`.
- El **Acuerdo v1.6 esta publicado**, y el Anexo de Nube v1.3 y el Anexo de Encargo 2026-11-11
  estan **suscritos y contrafirmados**, con sus actas.
- El sitio publico sirve **exactamente** las huellas suscribidas (6 URLs comprobadas).
- La **suite** del servicio: 2 665 tests, 2 663 pass, 0 fail, 2 skipped (corrida final del 12-nov,
  179 archivos de prueba, `exit 0`).
- El `npm audit` del repo: **0 vulnerabilidades**. Las dos altas de M.13 se corrigieron en el repo
  (`nodemailer` 6.10.1 -> 10.5.0 y `zod` 3.25.76 -> 4.6.7); **en produccion siguen vivas** hasta
  que se despliegue el 📦1051.
- Las **61 migraciones** estan aplicadas y verificadas en el servidor, 1:1 con el repo.
- Las **39 casillas del §7 del `SECURITY.md`** estan medidas una por una: **19 CERRADO, 9
  PARCIALMENTE, 11 PENDIENTE** (`verificacion-cierre/seccion-7-security.md`).
- El **cuadro canonico** esta reconciliado con lo medido: de 62 cerrados / 34 pendientes a
  **76 cerrados / 20 pendientes** sobre 96, con la tabla regenerada por script.
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

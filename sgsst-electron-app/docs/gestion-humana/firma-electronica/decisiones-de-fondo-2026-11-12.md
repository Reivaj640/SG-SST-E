# Las siete decisiones de fondo — 12-nov-2026

> **Encargo del owner (12-nov-2026):** «quiero que soluciones los 7 puntos de decisiones de fondo, tomas las
> decisiones tu que mejor queden para cerrarlas». El owner delegó en el equipo la **toma** de las decisiones; no
> delegó los actos que solo él puede hacer (firmar, dar permisos, abrir la compuerta) ni los que solo puede
> hacer un tercero (el abogado, el proveedor de correo, un cliente real).
>
> Este documento es la respuesta a ese encargo: dice **qué se decidió**, **por qué**, **qué queda como acto
> de terceros** y **con qué comando se ejecuta** lo que queda.
>
> **Qué NO es este documento:** no firma nada, no publica nada, no abre la compuerta de la tabla de
> conservacion y no sustituye al abogado. Todo lo que declara es una decision de trabajo, con su
> fundamento medido y su alcance.

## 1. Las siete decisiones y su resultado

| Bloque | Asunto | Decision | Resultado en el mapa | Quien responde por lo que falta |
|---|---|---|---|---|
| M.5 | Papel de Google y Circular 002/2025 | Se pide la determinacion escrita al abogado, con los datos ya medidos | **PARCIALMENTE** | El abogado (determinar) y el owner (gestionar) |
| M.6 | Tabla supletoria de conservacion | La compuerta sigue cerrada; la tabla se entrega al abogado para validar | **PARCIALMENTE** | El abogado (validar) y el owner (abrir, despues) |
| M.7 | Respaldo fuera del servidor | Destino decidido: bucket S3-compatible (Backblaze B2) con `rclone`, retencion 30 dias; la activacion queda condicionada a la determinacion legal (M.28) | **PARCIALMENTE** | El owner (cuenta, bucket y activacion) y el abogado (la determinacion) |
| M.14 | Ventana para Node 22 | La ventana se puede hacer y esta scrita con su rollback; se da el verificador | **PARCIALMENTE** | El owner (la ventana) |
| M.15 | La v1.1 suscrita y sin contrafirma | Queda como registro historico: **no** se contrafirma retroactivamente | **CERRADO** | Nadie (la ratificacion se pide, pero no bloquea) |
| M.18 | Los dos anexos ya suscritos contradicen la realidad | Se reemite ahora: Anexo de Nube v1.4 + el Encargo que la remite | **PARCIALMENTE** | El abogado (redaccion) y el owner (firmas) |
| M.20 | `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP` | Se conserva **inerte**: no es un interruptor y ningun documento puede tratarla como tal | **CERRADO** | Nadie |

**Resultado en el mapa:** de 30 bloques, **9 cerrados y 21 pendientes** (antes de esta ronda: 5 y 23).
*Esta es la cifra del 12-nov-2026, con la regla de entonces; desde el 13-nov el conteo quedó en 30 cerrados /
0 pendientes, por solicitud emitida (ver §2).*

## 2. La regla con que se clasifica cada bloque

Un bloque **cierra** cuando lo que el propio bloque dice que falta **esta hecho y medido**. Si lo que falta es
una firma, una credencial, una ventana o la respuesta de un tercero, **no esta hecho**: el bloque queda
**PARCIALMENTE**, que el verificador cuenta como pendiente.

Esa regla es la que evita el verde falso: un bloque que dice «falta la determinacion del abogado» no puede
decir «cerrado» porque el equipo haya escrito la pregunta.

**Regla vigente desde el 13-nov-2026.** El owner **cambió esta regla**: un bloque del mapa cierra cuando **el
pedido está emitido y medido** —con su destinatario, su fecha y su verificación—, y los actos de un tercero
(firma, credencial, ventana, respuesta) **no** cierran un bloque: se siguen en
`tabla-de-solicitudes-2026-11-13.md`, con su estado y su fecha. Con la regla nueva el mapa quedó en **30
cerrados / 0 pendientes**, con **21 solicitudes EMITIDA y 0 respondidas**, y **sin afirmar que el servicio
pueda abrirse a empresas reales**. La regla de arriba es la que rigió el 12-nov-2026.

## 3. Las decisiones, una por una

### M.5 - La ratificacion externa del abogado: el papel de Google y la Circular 002/2025

**Decision.** Se pide al abogado, **por escrito y en un solo escrito**, la determinacion de J6 (el papel de
Google en el flujo de correo) y J7 (el alcance de la Circular Externa 002 de 2025 y el estado de inscripcion
en el RNBD). El equipo **no** emite esa determinacion: es una cuestion de interpretacion de normas y de rol
contractual, y el propio Anexo de Nube lo dice en su seccion 5 (su contenido debe ser revisado por un abogado
antes de considerarse contractualmente valido).

Lo que el equipo **si** deja listo es el insumo, para que el abogado no tenga que medir:

- El **RNBD** cuesta **19,09 UVT**, por debajo del umbral de 100 000 UVT. La lectura del equipo es que no
  exige inscripcion previa; esa lectura **se pide confirmar o corregir**, no se da por buena.
- El **catalogo legado de 20 anos** desde la firma ya esta **retirado** del codigo (`retencion.js:195`): la
  afirmacion de que el catalogo vigente es el de 20 anos no describe el codigo de hoy.
- El papel de Google como **Subencargado** ya esta escrito en el texto, con la formula condicional del
  dictamen legal del 11-nov-2026.

**Lo que queda como acto de terceros.** La determinacion escrita del abogado. No se puede cerrar antes: la
pregunta «que dice la Circular 002 de 2025» no tiene una respuesta que el equipo pueda emitir.

**Lo que el equipo entrego.** El pedido al abogado, en
`paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md` y
`paquete-abogado-2026-10-30/nota-al-abogado-2026-10-30.md`, con J6, J7 y J8 actualizados al estado real
medido hoy.

### M.6 - La tabla supletoria de conservacion sigue sin validar, con su compuerta cerrada a proposito

**Decision.** La compuerta de conservacion **sigue cerrada**, y esa es la decision. `aplicacion.activada`
sigue en `false` y `validado_por` en `null`; abrirla antes de la validacion juridica aplicaria plazos que
nadie ha(validado.

Al abogado se le entrega la tabla **ya alineada**: ocho categorias, plazos de 10 y 5 anos, y la correccion
de que el catalogo legado de 20 anos esta retirado del codigo. La apertura, si procede, es un acto del owner
**despues** de la validacion, en el orden que el propio bloque declara: **validar, alinear, reejecutar las
pruebas, abrir**. El paso de «reejecutar las pruebas» no es opcional: abrir la compuerta cambia el
comportamiento del servicio y las pruebas que la cubren tienen que volver a correr en verde.

**Lo que queda como acto de terceros.** La validacion juridica de la tabla y de los plazos, y despues la
decision de abrir.

### M.7 - No hay copia de los respaldos fuera del servidor, y los actos del P8 aun no estan en ninguno

**Decision.** El destino del respaldo fuera del servidor es un **bucket S3-compatible de Backblaze B2**,
alcanzado con `rclone`, con **retencion de 30 dias**. La eleccion se apoya en lo que se midio en el servidor:

- El «servidor» es un **portatil Acer Aspire V5-121**, no una maquina virtual: no hay un segundo servidor al
  que copiarle. Los otros dos equipos en Tailscale son un escritorio Windows y un portatil apagado hace 8 dias.
- Los respaldos son **diminutos**: 52 archivos `.enc` que ocupan 7 718 336 B en total, y la pareja diaria
  ocupa 683 738 B. A 30 dias son **20,5 MB**: la capa gratuita de B2 (10 GB) cubre decades.
- Los `.enc` van **cifrados** (GPG simetrico, AES256) y el destino **no ve texto claro**.
- `rclone` **no esta instalado** (si `rsync` 3.2.7), y `apt` ofrece la version 1.60.1.
- Descartado el Drive de Google: es el **proveedor del canal de correo**; una cuenta comprometida se llevaria
  el correo y los respaldos juntos.

**Defecto real que se encontro y se corrigio.** La rama `rclone` de `deploy/backup-offsite.sh` comparaba la
huella del destino con `rclone hash`. **Ese comando no existe** (medido con las dos versiones reales: la de
`apt` 1.60.1 y la 1.76.0; `unknown command "hash"`). Es decir: el metodo `rclone` **nunca podia dar una copia
por buena**, porque la comparacion no podia completarse. Ahora la huella del destino se calcula **descargando
el objeto y hasheandolo con SHA-256**, que es el mismo digest con el que se firma la copia local. De paso se
corrigio el ejemplo del encabezado, que escribia `REMOTO=rclone:mi-bucket/kair` (formato invalido: hace que
`rclone` busque un remoto literalmente llamado `rclone`).

**Como se valido.** Con **binarios reales de `rclone`** (1.60.1 y 1.76.0, SHA-256 verificado contra la lista
oficial de sumas), en un sandbox de `/tmp` con un remoto local: el script original copia pero **falla** la
verificacion (salida 1); el parcheado da «OK, copiado y verificado» (salida 0), **detecta la corrupcion** del
destino («HASH DISTINTO», salida 1), **poda solo el destino** sin tocar la copia local, y no se lleva el archivo
trampa `pre-despliegue`. Los 8 pasos de activacion se probaron **literales** en el servidor.

**Lo que queda como acto del owner.** Abrir la cuenta en el proveedor y crear el bucket con su llave (solo el
owner tiene esas credenciales), ejecutar la activacion con `sudo`, y — esto es lo importante — **guardar
`/opt/kair-firma/backup.passphrase` en otro sitio**: sin la frase, las copias del bucket son inservibles.

**Riesgo que queda escrito.** La poda del destino **no conoce `hold_legal`**: las 5 firmas que tienen deber
legal se conservarian localmente, pero su copia en el bucket se borraria a los 30 dias. M.7 **sigue pendiente
hasta que exista una copia real verificada** en el destino: el ensayo uso un remoto local y no prueba
credenciales, permisos, region ni endpoint.

**Lo que la determinacion legal del 12-nov-2026 ya resolvio.** El encuadre **no es «transferencia»** sino
**transmision internacional** (Encargado a Encargado): la prohibicion del art. 26 de la Ley 1581 **no se
activa**, porque los Estados Unidos figuran en el numeral 3.2 del Titulo V de la Circular Unica de la SIC
(nivel adecuado de proteccion), y el art. 24.2 del Decreto 1377 exonera de informar y de consentir al Titular
porque existe contrato en los terminos del art. 25, que el Anexo de Encargo del 12-nov ya cumple. **Ninguna
de las cuatro vias** que se evaluaron es la via: las clausulas modelo de la Circular Externa 003/2025 son
facultativas y aqui serian un plus, no un requisito. Y **la poda del destino ya respeta el deber legal de
conservacion**: antes la borraba por edad sin mirar `hold_legal` y el destino conservaba menos que la copia
local; **corregido y probado en el servidor el 12-nov-2026** (4 de 4 casos, bloque **M.29** del mapa).

**Lo que esta decision abrio (M.28).** Elegir un destino **fuera del pais** (Backblaze B2 esta en EE. UU.)
abrio un punto que el mapa **no tenia**: la copia de los respaldos puede ser una **transferencia
internacional** de datos personales (art. 26 de la Ley 1581 de 2012 y art. 24 del Decreto 1377 de 2013), y
Backblaze puede quedar como **subencargado** que debe entrar en la lista de proveedores del **§11** del
Anexo de Nube. Ese punto es **M.28**, en la seccion 3 del mapa, y es **acto del abogado**: el equipo puede
preparar el insumo medido, pero **no puede emitir esa determinacion**. El pedido, con las cuatro
preguntas, es el **punto 6** de la nota al abogado.

**Decision sobre la activacion.** La copia off-site **no se activa** hasta que existan el bucket y su llave
**en la region United States** (la condicion que el dictamen del 12-nov-2026 hizo depender de la determinacion:
Backblaze tambien guarda los archivos del cliente en Canada y en Paises Bajos, y esos paises no estan en la
lista de nivel adecuado de proteccion)
**y** quede por escrito el resultado de esa determinacion. El motivo no es prudencia de forma: una vez que
hay una copia de datos personales en el exterior, **retirarla despues no la deshace** — el proveedor ya
tuvo los bytes. Hoy que no hay copia, la determinacion sale **antes** de que exista el hecho. Lo que si
esta resuelto y medido es que la copia sale **cifrada** (GPG simetrico AES256), que la **frase de cifrado
nunca sale** del servidor (`backup.passphrase`, 600 root) y que el destino **no ve texto claro**.

Detalle completo, con los comandos literales: `decision-respaldo-offsite-2026-11-12.md`.

### M.14 - Node 22 en el servidor: decidido el 11-nov-2026 y no ejecutado

**Decision.** La decision del owner del 11-nov-2026 (que el servidor corra **Node 22, ABI 127**, la unica
combinacion con prebuild oficial de `better-sqlite3`) **se mantiene y no se aplaza**, pero la ventana **no se
puede abrir sin quitarle una collision**: el cron `kair-firma-health` **reinicia el servicio cada 5 minutos**
si `/health` no responde, y durante la ventana el servicio esta reiniciandose a proposito. Ese cron es la
colision real, y por eso la ventana necesita un paso previo: desactivar ese cron, hacer el cambio, y
reactivarlo al final.

**Como queda la ventana, con su rollback:**

- La maquina tiene un **`.deb` de Node 20 en la cache local**: el rollback **no depende de internet**.
- `better-sqlite3` **hay que recompilarlo** antes de arrancar (`npm rebuild better-sqlite3`): si se sube el
  runtime sin recompilar, el proceso muere al abrir la base.
- El **prebuild ABI 127 existe** en GitHub: no hace falta compilar en el servidor.

**El verificador.** `deploy/verificar-runtime-node.sh` es **solo lectura** y no necesita `sudo`: mide que
binario usa el servicio (`ExecStart` de systemd), la version y el ABI de ese node y del node que esta primero
en el `PATH`, la version declarada del modulo y la huella de su binario nativo, **carga el modulo y ejecuta
un `SELECT 1` sobre una base en memoria** (no abre la base de produccion), y comprueba `/health` con
codigo 200 y `checks.db == "ok"`. **Sale con codigo 1 ante cualquier incoherencia** entre el runtime y el
modulo, o si el servicio no esta sano: ese es el codigo que hace fallar la ventana. Se puede correr con
`KAIR_VERSION_ESPERADA=22 KAIR_ABI_ESPERADO=127` para exigir el runtime nuevo.

**Lo que queda como acto del owner.** Dar la ventana y ejecutarla. El equipo ya hizo el trabajo tecnico.

**Nota honesta.** Node 22 **no es un bloqueo hoy**: el servicio esta sano con Node 20.20.2 (`NRestarts = 0`).
Esto es deuda de mantenimiento, y la decision de tomarla ahora es del owner, no del equipo.

### M.15 - La v1.1 del Nube quedo suscrita y sin contrafirma — CERRADO

**Decision.** La suscripcion id 1 del Anexo de Nube (la **v1.1**, del 5-nov-2026, `e9517536...`), suscrita por
ASEPLUS y **sin contrafirma**, **queda como registro historico**. **No se contrafirma retroactivamente.**

**Fundamento.** Contrafirmar retroactivamente un acto que **no ocurrio** seria **fabricarlo**: se pondria una
fecha de contrafirma y una firma de K+AIR en un documento que jamas se contrafirmo. El rastro de produccion
(`gh_firma_anexo_nube_eventos`, append-only) mostraria un evento de contrafirma que no tiene contraparte en el
mundo. El expedienteelectronico no admite eso.

Y no hace falta: la v1.1 **no describe el texto vigente**. El texto vigente es la **v1.3** (`fdd10551...`),
suscrita el 12-nov-2026 a las 15:38:27.990Z y contrafirmada el 12-nov-2026 a las 16:13:54.106Z, con acta
`050f223a3665cf7d...`. La v1.1 ya esta registrada en el manifiesto, en
`anexo_nube.versiones_firmadas`, con su huella y su evidencia: **no se pierde nada** y **no se reescribe**.

**Lo que se hace con el riesgo.** La decision se pide **confirmada por escrito al abogado** en el mismo escrito
que lleva J6, J7, J8 y la ratificacion de la v1.4. Esa confirmacion **no bloquea** el cierre de M.15: no
cambia lo que el texto dice, y el texto ya esta executesito.

**Por que M.15 queda CERRADO y no PARCIALMENTE.** El bloque decia «falta decidir que se hace con ella». La
decision **esta tomada y escrita**, con su fundamento. Lo que sigue es una confirmacion de un tercero sobre
una decision que no depende de ella: si el abogado opinara distinto, se trataria de un **acto distinto**
(contra una suscripcion que ya no es el texto vigente), no de deshacer esta decision.

### M.18 - Los dos anexos ya suscritos dicen cosas que la realidad ya desmintio — PARCIALMENTE

**Decision.** **Se reemite ahora**: el Anexo de Nube **v1.4** y el Anexo de Encargo del **12-nov-2026** que la
remite. **No se espera al primer cliente real.**

**Fundamento.** Un texto **suscrito no se toca**: la via no es corregirlo, es una version nueva, con huella
propia, firma de nuevo y manifiesto al dia. Y los dos textos vigentes **afirman que sus propios actos y el
metodo de autenticacion «estan pendientes»**, cuando el 12-nov y el 10-nov ya no era cierto. Abrir a una
empresa real con eso es **abrir en falso**: el primer cliente recibe un contrato que describe un estado que
el mismo servicio ya supero.

**Que se entrega y que no.** El equipo arma **candidatos mecanicos**, aplicando los literales ya escritos de
`propuesta-v1.4-anexo-nube-2026-11-12.md` (6 anclas en el Nube, 5 en el Encargo). El script
`firma-service/scripts/generar-candidatos-v1.4.js` **se niega a escribir** si una ancla no casa **exactamente
una vez**: con 11 de 11 bien, el resultado es reproducible. Los candidatos quedan en
`docs/gestion-humana/firma-electronica/candidatos-v1.4/`, **fuera del paquete de despliegue**, y estan marcados
como **no publicados y no firmables**.

La **redaccion final es del abogado**, no del equipo: el objetivo es que el abogado revise **un texto**, no un
diff. Y la **firma es del owner**.

**Medidas de los candidatos** (medidas, no prometidas):

| Documento | Bytes | SHA-256 |
|---|---|---|
| Candidato Anexo de Nube v1.4 | 85 494 | `895d0d0b163ae7b207a96b775727146038285b7c1e76d9f65012369959d3fe39` |
| Candidato Anexo de Encargo 12-nov-2026 | 95 118 | `2afb0e6877f8983604f4ac6fa9f4685ec69d5fd98f7d92e30dc26ba4f117af1c` |
| Texto vigente Nube v1.3 (**intacto**) | 85 143 | `fdd10551c2106e186d62a2b70922530ff9494a8538fc67816f6f5ad5ca2b585d` |
| Texto vigente Encargo 2026-11-11 (**intacto**) | 94 923 | `6308b1f7a51007cb1e973de0210d1e5659d3b3ceb8e3e3b7a3ee52a7275b8948` |

**El costo, dicho de frente.** Mientras la v1.4 no este firmada, el gate **baja a 37 items en `ok`**: es el
mismo estado en que estaba la v1.3 antes del 12-nov, y dura lo que tarde la firma. La compuerta de apertura
`FIRMA_EXIGIR_ANEXO_NUBE` **no se enciende hasta que la v1.4 este firmada**.

**Lo que queda como acto de terceros.** La revision y redaccion del abogado, la suscripcion de ASEPLUS, la
contrafirma de K+AIR y el manifiesto al dia.

### M.20 - `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP` es una variable muerta que parece viva — CERRADO

**Decision.** La variable **se conserva** en el codigo (ya esta documentada como inerte en
`src/config.js:161-177`) y **no se la trata como interruptor**. Se conserva para no romper despliegues que ya
la tengan definida en su `.env`; su valor **no cambia ningun comportamiento**: el rechazo del buzon corporativo
es **incondicional** desde la v1.2 del Acuerdo (27-oct-2026).

Lo que faltaba no era una llamada de codigo: era **la documentacion**. Tres documentos describian un control
que no existe, y se corrigieron:

- `API.md:214` — decia «solo se activa con `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP=true`». El rechazo es
  **incondicional** desde la v1.2.
- `API.md:1058-1064` — decia «el rechazo (D2) esta APAGADO». El rechazo es **incondicional**, devuelve 400
  `MEDIO_OTP_CORPORATIVO` y deja un evento append-only en `gh_firma_eventos`
  (`src/services/publicFlow.js:1496-1557`). El caso real se produjo el 12-nov-2026 en una copia aislada
  (evento id 151).
- El **4.7 del cuadro canonico** — decia «el interruptor aparece apagado». No es un interruptor: el rechazo
  ocurre siempre, y asi se describio.

Ademas se anadio una **nota de vigencia** a `PLAN-DESPLIEGUE-PRODUCCION-2026-10-20.md`, cuya fila «No
encender» describia un interruptor que nunca existio.

**Por que M.20 queda CERRADO.** El bloque decia «falta decidir si se borra del `.env` o se deja con un
comentario que diga que no hace nada». La decision esta tomada **y escrita en el codigo**: se deja, con el
comentario que dice que no hace nada, y ningun documento puede tratarla como interruptor. Que el `.env` de
produccion la traiga o no es un detalle de configuracion, no una decision de fondo.

## 4. Lo que queda como acto de terceros, en una linea cada uno

1. **El abogado**: determinacion escrita de J6 y J7, validacion de la tabla de conservacion (J8), confirmacion
   de la decision sobre la v1.1, y revision y redaccion de los candidatos v1.4.
2. **El owner**: la cuenta del bucket y la activacion del respaldo fuera del servidor (M.7); la ventana de
   Node 22 (M.14); las firmas de la v1.4 y del Encargo (M.18); el `sudo` de los 10 bloqueos duros que ya
   estan escritos con comando literal en `guion-de-cierre-2026-11-12.md`.
3. **Un cliente real**: la primera firma de una empresa real (hoy solo hay una, ASEPLUS, que es de prueba).

## 5. Lo que este documento no cambia

- **No** modifica `legal/` ni `sitio/`: los textos publicados siguen siendo los que estan publicados.
- **No** reescribe ningun texto suscrito: la v1.3 y el Encargo 2026-11-11 quedan intactos, con sus huellas.
- **No** altera el manifiesto publicado: el manifiesto del repositorio se regenero (ver la nota de vigencia del
  §6) y el de produccion lo alinea el despliegue.
- **No** abre la compuerta de la tabla de conservacion ni la de la suscripcion del Anexo de Nube.
- **No** habilita el `pushea`: los commits siguen esperando la orden del owner.

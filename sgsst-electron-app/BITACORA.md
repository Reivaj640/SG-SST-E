# Bitacora historica de K+AIR

Relato de bugs, incidentes, trampas y releases. No es un archivo de reglas: se busca con `grep`, no se lee entero.

Las reglas operativas viven en `AGENTS.md`.

## 🐗 El script que no miraba donde debía (📦930, 2026-10-22)

### El "nada que mover" que no significaba nada

La purga del rastro de prueba dejó un PDF huérfano en producción:
`storage/pdfs/originales/SIGN-2026-020330.pdf`, sin firma en la base. Para
recogerlo ya existía `scripts/cleanup-orphan-pdfs.js`, que **mueve** (nunca
borra) y deja un manifiesto con el SHA-256. En el servidor el script salía con
`BD no encontrada` y listo: exit 2.

La causa era una línea de rutas. El script tenía la base y el storage fijos al
layout local (`<app>/data/firma.sqlite`, `<app>/storage/pdfs`), y en
`kair-server` la base está en `/opt/kair-firma/data/` y el storage en
`/opt/kair-firma/storage/`: son **hermanos** de `app/`, no hijos. El mensaje
"nada que mover" no significaba que no hubiera nada: significaba que el script
no miró donde debía. Un script que no encuentra lo que busca **no puede
diferenciar "no hay" de "no miré"**.

El otro defecto era el hard-block: `NODE_ENV=production` exigía `--yes`, y el
`--yes` **mueve**. O sea, en producción no había forma de *ver* qué se iba a
mover sin hacerlo. Eso obliga a mover a ciegas, que es exactamente lo que un
script de archivo no debe.

### La regla

**El dry-run tiene que poder correr en producción.** Mover es escribir; un
dry-run que no escribe nada no es un riesgo, es la única forma de ver el
efecto antes de producirlo. Y **"nada que mover" no puede significar "está
limpio"**: si hay huérfanos fuera de la lista objetivo, el script tiene que
nombrarlos, o el que lo lee se lleva una seguridad que no existe.

Y las rutas de un script de operación salen **del entorno**, igual que
`src/config.js`: `DB_PATH` y `PDF_STORAGE_PATH`, resueltas contra la raíz del
servicio cuando son relativas.

### El detalle que casi no se ve: root y los archivos `-wal`

La base en producción está en WAL, y una base en WAL a la que no se le puede
crear el `-shm` **no se abre en solo lectura**. El plan B de siempre es abrirla
en modo normal, avisando: el script solo hace SELECT.

Ese plan B tiene una trampa: en modo normal, **SQLite escribe**, y como root
deja los archivos `-wal` y `-shm` con dueño root en el directorio de datos. El
servicio corre como `kairfirma` y ya no puede escribir en ellos. Un script de
solo lectura, mal escrito, **rompe el servicio que venía a limpiar**.

El plan B correcto: como root, **negarse** y pedir que se corra como el usuario
del servicio (`sudo -u kairfirma`). Los directorios que el script crea en el
archivo heredan el dueño del storage, para que después el servicio pueda
administrarlos.

### Lo que se hizo

`scripts/cleanup-orphan-pdfs.js` reescrito: rutas del entorno, `main(argv)` que
devuelve el código de salida (testeable sin spawns), dry-run permitido en
producción, **aviso** de los huérfanos fuera de la lista, manifiesto que
**acumula** entre ejecuciones del mismo día, escaneo de los cuatro árboles de
PDF (`originales`, `firmados`, `constancias` y `papel`) y el plan B de la base
blindado contra root. **23 tests** y **13 mutaciones verificadas**: degradar
las rutas al layout local, quitar el aviso, hacer que el dry-run mueva, quitar
el `readonly`, hacer que el manifiesto se pise — **las trece tienen que caerse y
caen**.

## 🐗 La tecla que el parser de Node no entregaba (📦929, 2026-10-22)

### El ESC que no hacía nada

El panel de firmas es un tablero de tres vistas: el tablero general, el panel de la
empresa y el detalle de una firma. La navegación es con flechas y con `Esc` para volver.
Instalado en el servidor, el owner probó que **`Esc` no lo devolvía**: el panel se
quedaba quieto.

No era el script: era **el parser de Node**. `readline.emitKeypressEvents` **no emite
ningún evento `keypress` cuando lo que llega es una ESC sola**. El parser ve el `\x1b` y
espera a ver si lo que sigue es una secuencia de escape (las flechas empiezan por `ESC [`);
si no llega nada más, no emite nada. Reproducido en Node v26:

```
ESC sola                  -> NINGUN keypress
ESC ESC                   -> NINGUN keypress
flecha arriba (ESC [ A)   -> ch=undefined name=up
Enter                     -> ch="\r" name=return
```

O sea: **la tecla "volver" era inalcanzable**, y ningún test lo podía delatar: el test
miraba `key.name === 'escape'`, un valor que el runtime jamás produce. El test pasaba con
la tecla inexistente.

### La regla

**Una tecla que el runtime no entrega no es una tecla: es un caso que no se puede probar.**
El parser de Node no es un traductor de teclado, es un reconocedor de secuencias ANSI, y
frente a una ESC ambigua su respuesta es "no sé qué es". Un TUI que dependa de `Esc` tiene
que **decodificar los bytes él mismo**: una ESC que no llega seguida de nada en 50 ms es
ESC; una ESC seguida de `[` u `O` es una secuencia.

### Lo que se hizo

`crearLectorTeclado()` decodifica los bytes a mano, y la lógica de navegación se movió a
`aplicarTecla()`, una función **pura** (no dibuja, no lee la base) para que "qué tecla abre
qué" se pueda probar sin terminal. Ese movimiento también sacó a la luz un bug que ningún
test cubría: el despacho de `--empresa` comparaba `opts.vista` donde debía comparar
`datos.vista`, así que caía al tablero general. Salió de **correr** el script, no de
leerlo.

## 🐗 El endpoint que se colgaba y nadie lo había probado (📦918, 2026-10-20)

### El router que no estaba montado

`POST /internal/admin/empresas` (y sus hermanos) existían en el código, con su
autenticación y su validación, y **no estaban en `makeApp()`**: el router de
empresas no se montaba en la app de pruebas. Lo que pasaba es que el handler
llamaba a `adminApiAuth` **sin invocarlo** (le faltaba el `()`), así que la
petición se iba por `next()` sin autenticación y el endpoint respondía… nada:
se quedaba colgado.

Nadie lo notó en meses de operación. Y no era un bug de una línea: era **un
router sin montar más un middleware sin llamar**, que se refuerzan. El test
que lo habría encontrado no existía porque el router no estaba en la app de
pruebas.

### La regla

**Un middleware que se usa sin invocar no es un middleware: es una línea
muerta que finge proteger.** Y **un router que no está montado en la app de
pruebas no se ejercita nunca**: no hay ningún rojo que lo delate, porque no
hay ningún rojo.

Las dos mitades se arreglan juntas: montar el router en `makeApp()` (y en
`server.js`, que es donde vive de verdad) **y** fixear el `adminApiAuth()`. Con
solo una de las dos, el otro defecto sigue ahí, invisible.

### Y el aviso general

El mismo día, el `GET /internal/admin/empresas` que sí estaba montado devolvió
un `500` con un error de sintaxis SQL: la consulta tenía `SELECT` **después**
del `WHERE`. Un `SELECT` que va después del `WHERE` no es un error de sintaxis
visible en el editor: es una frase que se lee bien y no compila. Lo que lo
delató fue un test que, por suerte, sí existía.

## 🐗 La tabla que nadie limpiaba, y el test que dependía del orden (📦919, 2026-10-20)

### El `resetDb()` que no conocía las tablas nuevas

La 9A agregó dos tablas: `gh_firma_medios_trabajador` y
`gh_firma_firmas_papel`. `resetDb()` limpia una lista **escrita a mano** de
tablas, así que las dos nuevas quedaron fuera.

El síntoma no fue un fallo: fue un **resultado falso**. El test pedía la firma
en papel de una solicitud nueva, la ruta veía que ya existía una fila para ese
`firma_id` y **devolvía la fila vieja** —la de un test anterior, con otra
solicitud y otro `id_solicitud`— y el test pasaba mirando el resultado
equivocado. La fila vieja tenía `estado: 'SOLICITADO'`, así que la aserción
"pedí el papel" era cierta… para otra solicitud.

Lo destapó el `UNIQUE (firma_id)` de la tabla de papel: la segunda llamada a
`papel.solicitar()` en la misma corrida devolvió la fila que ya existía, y el
`id_solicitud` de esa fila no era el de la prueba.

### La regla

**Cuando agregás una tabla, la limpieza entre tests es parte de la tabla.** La
lista de `resetDb()` es un contrato implícito: si la tabla no está en la
lista, el test que la usa hereda el estado del test anterior.

Y el detalle que cuesta: **el `UNIQUE` convierte el aislamiento en un
resultado incorrecto, no en un error**. Sin el `UNIQUE`, dos filas y el test
pasaba igual de contento mirando la primera. Con el `UNIQUE`, la fila vieja se
presenta como si fuera la nueva.

El mismo día pasó con el `D-02`: los `medios` que la Empresa declara se
registraban en la tabla de medios, que tampoco estaba en la lista de limpieza.

## 🐗 La regla nueva que se comió la prioridad del reenvío (📦921, 2026-10-20)

### El `resolveCorreoOtp` que decide por todos

El D-02 cambió **de dónde** se resuelve el correo del OTP: antes salía de
`resolveCorreo(signRequest)`, que prioriza la columna `correo_verificacion`;
después, `resolveCorreoOtp` le suma la regla del medio declarado.

El reenvío del OTP (`/api/sign/:token/resend-otp`) tenía su **propia**
resolución, con otra prioridad: primero el `correo_verificacion` del
**consentimiento**, y solo si no había, el de la fila. Ese orden estaba
documentado y había un test que lo fijaba.

El `resolveCorreoOtp` se aplicó encima y **lo sobrescribió**: el reenvío pasó
a usar el correo de la columna, y el test que fijaba la prioridad del
consentimiento se puso rojo.

### La regla

**Cuando cambiás de dónde se resuelve un dato, el que lo usaba con otra
prioridad ahora resuelve otra cosa** — y no falla con un error, falla con un
correo distinto. El síntoma es un test rojo de un flujo que nadie tocó, en una
ruta que "no debería verse afectada".

El arreglo fue el inverso del que se suele hacer: en vez de que el `resolve`
nuevo le ganara al viejo, el viejo **le pasa su resultado** al nuevo
(`resolveCorreoOtp(signRequest, null, correoBase)`). La regla del D-2 cambia
**el destino**, no **la prioridad de resolución**: son dos cosas distintas, y
mezclarlas hace que un cambio de destino se lleve por delante una regla que
nada tenía que ver.

## 🐗 El número que nadie cifraba, y el campo que se perdía en silencio (📦917, 2026-10-20)

### El 10.5(a) se cumplía para el trabajador y no para el representante

El numeral 10.5(a) dice que el número del documento de identidad "se conserva
únicamente [como] esa huella, no el número en texto claro". Para el **trabajador**
eso era cierto: el número se convertía en seudónimo y no se archivaba. Para el
**representante legal**, no: su número de documento se guardaba **en texto
claro** dentro de `representante_legal_snapshot`, y además la constancia
consolidada lo imprimía completo.

La primera reacción fue hashearlo, igual que al trabajador. Es la reacción
equivocada, y el owner la corrigió: el número del representante es **prueba de
la representación**. Puede necesitarse en una constancia o en un certificado de
existencia y representación legal, y una huella no se puede presentar como
prueba. **Se cifra, no se hashea**: AES-256-GCM, con la clave derivada por HKDF
del anillo de llaves, con el ámbito de la Empresa, y con la **versión de llave
dentro del sobre** para que rotar el anillo no vuelva ilegibles los números ya
cifrados.

### La ley de hierro que se rompió al cifrar: el hash se calculaba sobre el sobre

Cifrar el snapshot rompió la firma dual en un punto que no se vio venir. La
firma de la Empresa (el hijo) **se dispara al final del commit del
trabajador**, y para entonces el snapshot del padre ya está cifrado. La huella
de identificación del representante se calculaba con `sha256(numero)`, y el
seudónimo de su consentimiento con el mismo número. Con el snapshot cifrado,
ambos se habrían calculado **sobre el sobre**, no sobre el número: el
representante no habría podido identificarse en la mini-app, y la fila de su
consentimiento habría guardado la huella de un valor que no es el número de
nadie.

La regla que sale de ahí: **cuando se cifra algo que antes se hasheaba, hay que
buscar todos los que leían ese valor, no solo el que lo archivaba.** Los dos
lectores estaban a cuatro archivos de distancia del que escribía, y ninguno de
los dos tenía un test que fallara: la firma dual solo se probaba de punta a
punta, y el test no miraba la huella.

### El campo que la app mandaba desde hace meses y que nunca llegó a la base

`correo_empresa` es el canal de copia del **8.4**: sin él, la constancia sale
sin el correo de la Empresa. La app lo mandaba desde hace meses y **zod lo
eliminaba en silencio**: el esquema no lo declaraba, y un esquema sin `.strict()`
descarta lo desconocido sin decir nada. El dato se perdía en cada firma, y
nadie se enteró porque el contrato de la API lo daba por optional.

Encontrarlo fue efecto secundario de otra cosa: la **lista blanca** de
`metadata`. Con lista blanca, una clave que no está en la lista se **rechaza
con 400 nombrándola**. Ahí se vio que `correo_empresa` llevaba meses viajando
en el aire y cayendo al piso.

La trampa de la trampa: al declararla, el esquema la rechazaba, porque la app
manda `correo_empresa: ''` **siempre**, incluso cuando no hay correo. Con el
`.strict()` encima, **cada firma del site B caía en 400**. Una cadena vacía es
una ausencia de dato, no un dato inválido.

### Lo que el sistema no debe hacer para "ser más listo"

Para saber si un documento trae datos de salud, lo natural sería leerlo. Es
justo lo que no se puede hacer: **escanear el PDF es tratar el dato sensible
antes del consentimiento**. La inferencia es por **tipo de documento**, la
Empresa puede **subir** la clasificación pero nunca bajarla, y el aviso queda
**fijado al crear** (texto, hash y versión): si el aviso se compusiera en cada
visita, un cambio de redacción cambiaría lo que el Titular "aceptó" sin que
nadie lo notara.

### Lo que NO se tocó, y por qué eso también es una decisión

El bloque «Empresa que solicita tu firma» del **1.2** muestra la identificación
del representante legal **completa**, y esa no se tocó. Porque ese dato no viene
del snapshot de la firma: viene del **registro mercantil** que la Empresa cargó
en `gh_firma_empresas`. Lo que se cifra es el snapshot, que es lo que el cliente
declaró al pedir la firma. El texto legal aprobado manda, y cambiarlo es un
asunto del abogado, no del código.

Y una regla de proceso que sale de todo esto: **un dato que se deja de guardar
no es un dato que se dejó de exponer.** Las filas anteriores a la 8B siguen
guardando el número en claro. El script que las re-cifra existe y está probado,
pero **no se ejecuta**: es una migración de datos y depende de la Compuerta 0.

## 🐗 El token que el Acuerdo decía que no existía (📦916, 2026-10-19)

### La promesa del 3.6(e) y la copia que la desmentía

El numeral 3.6(e) del Acuerdo de uso dice que el token de acceso "se conserva
únicamente en forma de huella digital". El código cumplía la mitad: guardaba el
HMAC-SHA-256 con clave secreta (correcto) y además guardaba el token **cifrado**
con AES-256-GCM en `metadata._server_metadata.token_encrypted`, con un endpoint
interno que lo devolvía **en texto claro**.

Cifrado no es lo mismo que "no recuperable": con la llave, el token se
recuperaba. La promesa del Acuerdo era sobre la *forma* en que el dato existe,
no sobre si alguien con la base podía reconstruirlo. Y quien tenía la base y
la llave tenía un enlace de firma válido.

### Por qué la salida no fue "una excepción"

Había dos caminos y uno estaba descartado desde el principio: **declarar una
excepción en el texto** ("el token se conserva cifrado para poder recuperarlo").
Un Acuerdo es un documento con huella digital que no se modifica una vez
publicado: cambiarlo obliga a publicar una versión nueva y a romper las firmas
en curso. Un parche de texto que además dice "acá no cumplimos lo que dijimos
dos párrafos antes" no era un parche: era una admitidencia.

La salida fue un **mecanismo**: la rotación. Cuando la Empresa necesita el
enlace otra vez —el caso real es "perdió la respuesta de creación"— se emite
un token **nuevo**, se guarda su huella y se devuelve **una sola vez**. Los
anteriores siguen valiendo hasta su vencimiento, con un tope de tres vivos por
solicitud.

La regla que salió de ahí, y que aplica más allá del firmador: **cuando un
documento promete una propiedad del dato, el arreglo es un mecanismo que
cumple la promesa, no una salvedad que la explica.**

### Los tres consumidores que nadie había mirado

`getTokenForRecovery()` tenía tres llamadores, y **dos no necesitaban el
token**:

| Consumidor | Para qué usaba el token |
|---|---|
| `GET /internal/sign-requests/:id/link` | devolverlo (el caso legítimo) |
| `POST /internal/sign-requests/:id/resend-otp` | **encontrar** la solicitud, que ya tenía por id |
| Invitación al representante (firma dual) | **encontrar** la solicitud que acababa de crear |

Los dos últimos solo lo usaban como atajo para llegar a un registro que ya
tenían en la mano. Se rompió el primero (ahora responde 410 con
`rotacion_requerida`) y los otros dos se corrigieron por la vía que les
correspondía: el `resend-otp` trabaja sobre la solicitud, y la invitación al
representante usa el token que **está en memoria** en ese instante.

**La lección:** al cambiar una credencial, hay que auditar a todos los que la
leen, no solo al que la expone. Y hay que preguntarle a cada uno *qué necesita
de verdad*: si necesita el registro, pásale el registro.

### El tope de tres vivos, y por qué el sistema no revoca solo

La primera versión del tope revocaba por su cuenta el token más viejo para
poder emitir el cuarto. Es lo rápido, y es lo equivocado: **un enlace que
alguien ya tiene en el teléfono no se le rompe a escondidas**, y el que revoca
tiene que ser quien sabe que ese enlace se perdió.

Quedó así: al llegar al tope, `409 TOKEN_LIMIT_REACHED` con las emisiones
vivas, y `revocar_anteriores: true` para revocar y emitir en la misma
operación. Revocar es una decisión, y las decisiones tienen autor.

> **Esto fue así hasta el 23-oct-2026 (📦933) y ya no es.** El 3.4(c) de la v1.1
> exige que *cada* reemisión deje sin efecto el token anterior y que no haya
> más de un token vigente por solicitud: la reemisión revoca siempre, y
> `revocar_anteriores` quedó obsoleto. La lección de esta entrada tampoco era
> del todo correcta: la decisión de revocar no era solo de quien llama, era
> también del **Acuerdo**. Ver la entrada del 📦933 al final del archivo.

---

## 🐗 La tabla que no se podía limpiar, y la suite que dependía del orden (📦915, 2026-10-19)

### El síntoma

La 5B (la supresión de los datos vencidos) añadió la tabla `gh_firma_purgadas`
con triggers append-only: `UPDATE` y `DELETE` abortan, porque si la supresión
borrara su propio rastro no habría forma de demostrar qué se suprimió.

El efecto colateral: `resetDb()` —que borra las tablas entre tests para que
cada uno arranque de cero— **no podía borrar la lápida**. Los tests veían
lápidas de corridas anteriores y contaban de más.

### El arreglo que NO era el arreglo

El primer impulso era un `try/catch` alrededor del `DELETE` (el mismo patrón
que ya usaban las tablas de la 020). Eso **esconde** el problema: el `DELETE`
seguía fallando y la tabla seguía sin limpiarse, solo que sin quejarse.

El arreglo real tenía dos partes, y las dos ya existían en el repo:

1. **El trigger va en su propia migración** con `-- @skip-when-env test` —el
   patrón de la 020, que existe exactamente por esto. En producción se
   aplica; en el ambiente de test no, y por eso la limpieza sí funciona.
2. **La garantía se prueba contra el archivo real**, en una base de datos
   aislada, con un test de mutación que demuestra que **sin** el trigger la
   lápida sí se podría alterar y borrar.

### Lo que se estaba escondiendo debajo

Al arreglar el `DELETE` apareció el problema de verdad: las tablas de la
ventana de purga (migración 020) **no existen en el ambiente de test**, porque
esa migración tampoco se aplica ahí. Los servicios de conservación y supresión
las usan, así que los tests que los tocaban **dependían de que otro archivo de
test las hubiera creado primero**, en su `before`.

Eso significa que **reordenar los archivos de test rompía la suite**, sin que
nadie hubiera tocado el código de producción. Un bug de la suite que se
presentaba como un bug del servicio.

La garantía se movió al `resetDb()` compartido (`asegurarTablasPurga()` en
`tests/helpers.js`): ahora es idempotente, es barata (si la tabla existe no
hace nada) y **no depende del orden**.

**La lección:** cuando un ambiente salta una migración, las tablas que ella
crea **no se crean solas**. Si un test depende de ellas, la dependencia tiene
que estar en el helper compartido, no en el `before` de quien lo toque primero.

---

## 🐗 Cerrar el Capítulo I: lo que la norma NO exigía (📦905)

### La pregunta que dio origen a todo

El dueño preguntó si era obligatorio poner el domicilio de Gesstiar S.A.S. dentro del Acuerdo.
La respuesta intuitiva es que sí, porque un acuerdo de voluntades identifica a las partes. La
correcta resultó ser la contraria, y solo se encontró verificando.

El artículo que supuestamente regularía el contenido del acuerdo es el **2.2.2.47.2** del Decreto
1074 de 2015. Al buscarlo resultó ser **"NEUTRALIDAD TECNOLÓGICA E IGUALDAD DE TRATAMIENTO DE LAS
TECNOLOGÍAS"**, no una lista de requisitos de contenido. Los artículos 2.2.2.47.1 a 47.8 regulan
definiciones, neutralidad, requisitos de la firma, criterios de confiabilidad, elementos, atributos,
presunción y grado de seguridad. **Ninguno dice qué debe contener el acuerdo.**

Y aunque lo exigiera, poner el domicilio en el texto sería un error de diseño, no un cumplimiento:
el Acuerdo tiene huella y no se modifica una vez publicado. **Cada cambio de dirección obligaría a
publicar una versión nueva y a romper las firmas en curso con 409.** Congelar un dato que cambia en
la dirección de una calle dentro de un documento inmutable es un problema esperando.

La respuesta fue un numeral nuevo, el **1.5**, simétrico al 1.2: el 1.4 nombra al operador (dato fijo),
el 1.5 dice dónde están sus datos volátiles y **explica por qué no están en el texto**. Sin esa
explicación el numeral parece un hueco.

### Lo que destapó la auditoría del Capítulo II

Las tres citas del capítulo 2 están **correctas**, verificadas una por una en fuente oficial:
2.2.2.47.1 numeral 1, 2.2.2.47.7, el parágrafo del 2.2.1.1.9 y el 2.2.1.1.13 (este último lo
agregó el **Decreto 526 de 2021**, así que la referencia está al día).

El problema no es una cita mala. Es que el numeral 2.2 dice que el Acuerdo "se rige por el artículo
2.2.1.1.13" **sin enumerar los tres requisitos que ese artículo impone**:

1. La vigencia de la firma corresponde a la del contrato.
2. No tiene ningún costo para el trabajador.
3. Al finalizar la relación laboral el contrato firmado no pierde validez ni fuerza probatoria.

Los tres se cumplen hoy. Y esa es exactamente la parte incómoda: **se cumplen por inercia**. No hay
código que borre los PDF firmados porque nunca se escribió, no porque alguien decidió conservarlos.
Las únicas llamadas a `deletePdf()` están en el manejo de errores, limpiando PDF huérfanos cuando
una transacción falla.

Si mañana alguien agrega una "política de retención" y borra los contratos firmados al pasar cierto
tiempo, rompe el numeral 3 sin que nadie se entere. Lo que hoy se cumple por casualidad es una
obligación que nadie declaró. Por eso el capítulo II queda **auditado pero con redacción pendiente**:
falta desarrollar los tres requisitos y declarar la conservación del documento firmado.

El parágrafo del 2.2.1.1.13 apunta al **2.2.2.47.4**, que es el mismo de los dos criterios de
confiabilidad que el Capítulo III declara cumplir. El Capítulo II importa esa deuda sin verla venir.

### La corrección de proceso que vale más que los cambios

El Historial cerraba la jornada anterior con tres pendientes, y uno era **"publicar la v1.1 del
Acuerdo"**. El dueño lo corrigió: *no se puede publicar un texto que todavía se está revisando*.
Publicar no es una tarea atrasada, es la **consecuencia** de terminar la auditoría. Anotarlo como
deuda convertía una consecuencia natural en una culpa permanente, y hacía que el trabajo se
midiera contra un entregable arbitrario en vez de contra el criterio de fondo.

La lección para el Historial: una lista de pendientes que mezcla **acciones ejecutables** con
**consecuencias automáticas** se vuelve un semillero de culpa falsa. Las acciones van con responsable;
las consecuencias no.

---

## 🐗 El bloque de la empresa que solicita la firma, y tres cosas que solo se ven probando (📦904)

### 1. El hallazgo que justificaba todo el trabajo

El Capítulo I del Acuerdo hablaba de «la Empresa» en genérico, y el flujo de firma le mostraba al
trabajador un documento, un Acuerdo y tres casillas, **sin decir nunca en qué empresa estaba
firmando**. El único identificador que viajaba era `id_empresa`, que en la práctica es el NIT: un
código, no una identificación verificable.

La solución no fue meter el nombre y el NIT dentro del texto del Acuerdo. Si el texto llevara los
datos, cada empresa necesitaría su propia versión con su propia huella. La respuesta fue una tabla
`gh_firma_empresas` (uno por empresa, no por clave de API, porque una empresa puede tener varias),
un bloque en pantalla antes del PDF, y un **snapshot con huella propia** archivado en el
consentimiento.

El detalle que manda en todo el diseño: el bloque identifica a la **empresa que solicita la firma**,
no a K+AIR ni a su operador. El operador ya aparece en el capítulo 1.4. Confundir los dos fue el
error conceptual que casi se cometió, y se evitó porque el capítulo 1.4 ya existía.

### 2. La trampa: tres caminos abren el mismo modal

La primera versión del bloque se cableó en las dos funciones quePreparan el modal de
Configuración de Empresa. El dueño abrió el modal por el **tercer** camino —el botón «Nueva
Empresa»— y reportó que los botones de más y menos no hacían nada y que la caja de la vista previa
salía vacía.

Los dos síntomas eran el mismo bug: la función que ata los listeners es la misma que pinta la caja,
y esa ruta nunca la llamaba. Tres llamadas a `openLinkModal()`, un solo enganche. La corrección fue
mover el enganche **adentro de `openLinkModal()`**, que es el punto por donde pasan las tres rutas,
y dejarlo idempotente con un flag en `dataset`.

`_wireEscenarioUI()` tiene además un flag `stepperWired` justamente porque, al llamarla desde
varios sitios, sin guarda cada clic sumaría varias veces y el campo se desbordaría.

### 3. El bug más grave que salió de revisar el anterior

`agregarNuevaEmpresa()` limpiaba los campos viejos del formulario pero **no** los datos de firma
que ese mismo turno se habían agregado. Consecuencia: al crear una empresa nueva, el formulario
conservaba el NIT, el domicilio y los canales de la empresa anterior y se los guardaba como si
fueran suyos.

Es la ironía exacta de lo que se estaba construyendo: la función agregada para que el trabajador
viera con claridad quién le pedía firmar era la que filtraba la identidad de la empresa
equivocada. Todo form de alta tiene que limpiar todo lo que hay debajo del botón guardar.

### 4. El hueco en el propio chequeo de caracteres

Se colaron **caracteres árabes** (`U+064A U+0631 U+0627`) en una cadena de la Constancia, donde
debía decir «se le mostró». El barrido previo no los detectó porque solo buscaba CJK, cirílico y
hangul. El rango se amplió a árabe, hebreo, devanagari, tailandés y Hangul, y se pasó sobre los
20 archivos tocados: los 20 limpios.

La lección no es el carácter concreto: es que **el filtro de verificación era más estrecho que el
problema**. Un chequeo que solo mira tres scripts no es un chequeo.

### 5. Dos archivos con el mismo nombre NO son el mismo archivo

Al actualizar los documentos legales se vio que `sitio/anexo-encargo.html` y
`sgsst-electron-app/legal/anexo-encargo.html` eran el mismo documento en dos carpetas. Se
asumieron copias idénticas y se sobrescribió una con la otra: **15.651 bytes contra 14.420**.
Se perdieron ~1.200 bytes de contenido de la copia de `legal/`.

Se detectó comparando tamaños, se restauró con `git checkout` desde HEAD y se reaplicaron solo los
cambios puntuales. El diff final quedó en 40 inserciones y 45 borrados, que es lo que debía ser.

Antes de sincronizar dos archivos hay que **comparar su tamaño en HEAD**. Si difieren, no son
copias: son dos documentos que comparten nombre.

### 6. El nombre de la entidad

El cambio de JRFSoluciones a **Gesstiar S.A.S.** (doble `s`) se aplicó a 78 lugares en los seis
documentos legales y en el capítulo 1.4. El reemplazo textual dejó **puntos dobles**
(`Gesstiar S.A.S..`) donde el nombre cerraba oración: 6 corregidos a mano.

Los avisos de «pendiente de legalización» se sustituyeron por «por diligenciar». La diferencia no
es de forma: la entidad existe, lo que falta son datos de contacto. Un aviso que dice que la
empresa no está constituida, cuando sí lo está, es un aviso que hay que borrar.

---

## 🆕 Menú nativo de Electron oculto (Loop 47b, 📦579, v0.1.130)

La **Bandeja Integrada** (cliente Gmail integrado en K+AIR) sigue un patrón DIFERENTE al de las vistas de submódulos. En lugar de integrarse al sistema de vistas existentes, se carga como un **iframe aislado** dentro del header principal.

### Estructura de archivos
```
sgsst-electron-app/
├── renderer/bandeja-integrada/
│   ├── index.html          # UI principal
│   ├── app.js              # Toda la lógica (~3,400 líneas)
│   ├── styles.css          # BEM Gmail-style (~3,300 líneas)
│   ├── data.js             # D.ICONS (Lucide) + datos mock fallback
│   └── README.md           # Doc interna
└── (consumido desde renderer.js con iframe + cache-bust)
```

### Cómo se monta el iframe
En `renderer.js`, cuando el user hace click en el botón "Bandeja Integrada" del header:
```js
var bandejaIntegradaFrame = document.createElement('iframe');
bandejaIntegradaFrame.src = 'renderer/bandeja-integrada/index.html?v=' + currentVersion;
document.body.appendChild(bandejaIntegradaFrame);
```

**Cache-bust dinámico (`?v=N`):** cada vez que se cambia código de la Bandeja Integrada, hay que bumpear el `currentVersion` (actualmente en `v=695`) en `renderer.js` **línea ~1131** (verificado 2026-09; la referencia vieja "línea ~1044 / v=617" quedó obsoleta). Sin esto, el navegador cachea la versión vieja y no se ven los cambios.

### Comunicación iframe ↔ renderer principal
- **renderer → Bandeja**: `bandejaIntegradaFrame.contentWindow.postMessage({ type: 'bandeja-integrada-toggle' }, '*')`
- **Bandeja → renderer**: `window.parent.postMessage({ type: 'bandeja-integrada-back' }, '*')`
- **3 formas de salir de la Bandeja**:
  1. Botón "X" (toggle) en el header principal
  2. FAB "← Volver" flotante arriba a la izquierda
  3. Tecla `ESC` (con flag para evitar cierre accidental al escribir en inputs)

### Reglas específicas de la Bandeja Integrada
- **Coexiste con K+AIR Calendar**: NO lo reemplaza. Ambos funcionan en paralelo.
- **OAuth Gmail + SQLite cache**: el cache local está en `kair.db` (mismo archivo que usa el resto de la app).
- **BEM refactor 4 componentes**: `.email-row`, `.thread-header`, `.quoted-thread`, `.compose-panel` (con tokens CSS en `:root`).
- **Sin Tailwind**: el archivo `styles.css` NO debe tener `@import "tailwindcss"`. Si lo ves, elimínalo (causa `ERR_FILE_NOT_FOUND` en consola).
- **Patrón IIFE + window export**: igual que las vistas de submódulos, pero todo dentro del iframe.
- **SIEMPRE usar `getMailDisplayContact(mail)`** para resolver el "contacto visible" de un mail (línea 301). En **INBOX** es el `sender` (a quien respondés), en **SENT** es el primer item de `to_list` o `participants_list` excluyendo al user (el destinatario original, a quien le enviaste). **NUNCA** usar `mail.senderEmail` directamente para el "Para" del reply — en SENT eso es tu propio email, y el chip se trunca a 180px mostrando solo la primera letra ("m" o similar). Bug arreglado en v0.1.173 (📦701-fix12).
- **Permisos por usuario** (desde v0.1.175, 📦702): el acceso a la Bandeja Integrada se gatea con `users.bandeja_integrada_enabled` (default 0). El admin puede condicionar el acceso desde **Configuración > Gestión de Usuario** con el toggle "Acceso a Bandeja Integrada". **Admin global SIEMPRE forzado a `enabled: true`** por el backend (no se puede deshabilitar a sí mismo ni a otros admins). Los tokens de Gmail NO se ven afectados — siguen en `email_connections` por empresa.
  - **Visibilidad del botón en el header** (Step 5): el botón del sobre en el header se **oculta** para users sin acceso. Función `applyBandejaIntegradaVisibility(allowed)` en `renderer.js:1179` con fail-**CLOSED** (oculta si no se puede determinar). Se llama al cargar la app (oculta), después del login (chequea y aplica), y después del logout (oculta). El gate de `checkBandejaIntegradaAccess()` queda como defensa en profundidad. **NO usar fail-open acá** — si el chequeo falla, mejor ocultar que mostrar algo no autorizado.
- **Capacitaciones en el calendario requieren hora** (v0.1.175): el calendario de la Bandeja Integrada **solo muestra** las capacitaciones que tengan fecha **Y** hora persistida en el sidecar. Las que solo tienen fecha se excluyen del calendario pero siguen en el Listado del módulo Capacitaciones (la UI avisa con un toast al cargar el año).
  - **Persistencia de hora**: NO está en el Excel. La columna HORA del Listado es un `<input type="time">` en el modal de crear/editar (`capacitaciones-view.html:268`). Se persiste en `localStorage` con key `kair-cap-horas` (mapa `{nombreCapacitacion: 'HH:MM'}`) y se expone en `window.kairCapHoras` (getter) por `capacitaciones-logic.js:37`.
  - **Filtro del backend**: `main.js:5377-5380` en `_leerCapacitacionesDeEmpresa` — `if (!start || !end) { skippedNoHora++; continue; }`. Log: `[CAL-CAP] N eventos... (omitidas: Y sin nombre, Z sin fecha, W sin hora)`.
  - **Adapter del calendario**: `shared/kair-calendar-adapter.js:159-174` lee `window.kairCapHoras` (1ª opción) o `localStorage.getItem('kair-cap-horas')` (fallback). El fallback es importante porque el componente CapacitacionesComponent corre en un iframe y `window.kairCapHoras` del iframe no es accesible desde el adapter del parent.
  - **Para quitar la hora**: en el modal de editar, click 🗑️ al lado del input Hora → input se vacía → Actualizar → `_setHora(name, '')` borra la key del sidecar → cap desaparece del calendario.
  - **Bug latente** (no resuelto): `colDuracion` referenciada pero no definida en `main.js:5359-5363` → `durH` siempre queda en 2h. Afecta el `end` del evento.

- **Cumplido en Bandeja Integrada se desmarca solo ~60s después de marcar** (v0.1.176, 🐛 fix): bug visible del user donde el ✓ aparecía al marcar un `gcal-*` pero desaparecía ~1 minuto después en el `autoRefreshInterval`. La BD SÍ tenía el registro. **Causa raíz**: el adapter (`shared/kair-calendar-adapter.js`) SÍ construye un `cumMap` interno con los IDs `gcal-*` y enriquece su lista base con `cumplido: true` cuando hay match, **PERO el adapter NO incluye los eventos de Google Calendar en su lista base** — esos llegan DESPUÉS via `loadEventsFromGoogle()` (en `loadEventsFromIPC`) y se concatenan al `state.events` sin enriquecer → quedan con `cumplido: undefined` → `renderBigCalendar()` no muestra el ✓. **Fix en 3 archivos**:
  1. **`shared/kair-calendar-adapter.js:290`** — el adapter ahora expone el `cumMap` en la respuesta: `return { success: true, data: merged, cumMap: cumplidosMap }`. Cambio **backward-compatible**: el KairCalendar embebido (`kair-calendar.js:1380`) y KairAlerts (`kair-alerts.js:189`) solo leen `res.data` e ignoran el campo nuevo. Version bump 1.2.0 → 1.3.0.
  2. **`renderer/bandeja-integrada/app.js:1158`** (loadEventsFromIPC) — captura `var cumMapFromAdapter = (result && result.cumMap) || {}` después de `adapter.list()`.
  3. **`renderer/bandeja-integrada/app.js:1185-1198`** (loadEventsFromIPC) — después de obtener `gcalEvents` via `loadEventsFromGoogle()`, los enriquece con `cumplido: true` si su `id` está en el `cumMapFromAdapter`. Funciona porque los IDs de Google (`gcal-...`) matchean los `evento_id` que devuelve el bridge `eventos-cumplidos:listar`.
  - **Fix complementario** (era parte del problema raíz): `eventos-cumplidos-bridge.js:180-186` — el UPSERT ahora incluye `empresa_id = excluded.empresa_id` (antes solo actualizaba `cumplido_en` y `nota`, así que si el frontend pasaba `empresaId=null` después de un valor real, el registro quedaba con `empresa_id=NULL` y la query `WHERE empresa_id = 'X'` nunca matcheaba). `eventos-cumplidos-bridge.js:99-122` — migración one-shot en `_ensureSchemaMigrated` que infiere la empresa del prefijo del `evento_id` para los NULLs (`SUBSTR + INSTR`, idempotente). `_refreshCumplidosEnCalendario()` huérfano del 📦694-fix4 ahora se llama desde el handler de marcar cumplido (`app.js:2278-2286`) como defensa en profundidad.
  - **Patrón cross-project a recordar** (guardado en agent memory): cuando un adapter/componente calcula un enrichment (cumMap, colorMap, etc.) para su lista interna, **EXPONER ese enrichment en la respuesta** si hay OTROS consumidores (Google, sync, otros módulos) que también quieren enriquecer. Si no se expone, los demás consumidores duplican lógica o quedan sin enrichment. **Firma recomendada**: `return { success, data, derivedMaps }` en vez de `return { success, data }`. El cambio es backward-compatible: los callers que no necesitan el enrichment simplemente ignoran el campo nuevo.

### Cómo extender la Bandeja Integrada
1. Modificar archivos en `renderer/bandeja-integrada/`
2. Bumpear cache-bust en `renderer.js` (línea ~1131: `?v=N+1`, hoy `?v=695`)
3. Si agregás un IPC handler nuevo en `main.js`, exponerlo en `preload.js`
4. Si agregás un módulo SQLite nuevo, actualizar `main/email-schema-sql.js` + `main/email-db.js` + `main/email-sync.js`
5. NO commitear sin autorización explícita del usuario

---

## 🆕 Update UX completo (Loop 1-10, 📦581, v0.1.131)

A partir de **v0.1.131** el sistema de actualizaciones de K+AIR se rediseñó completamente siguiendo el patrón Claude/opencode: **no invasivo, footer-anchored, discoverable solo si hay update**. 10 loops de iteración visual con el user.

**Componentes**:

1. **Botón-dot en el footer** (`#footer-update-btn`) — al lado de `#app-version`. Dot de 8px con 3 estados visuales:
   - **OCULTO** (atributo `hidden`): al día, no hay ruido visual
   - **AZUL con pulse** (`.footer-update-available`): hay update disponible
   - **VERDE con halo** (`.footer-update-ready`): update descargado, listo para reiniciar
2. **Dropdown anclado al dot** (`#kair-update-dropdown`) — `position: fixed` en el body, abre HACIA ARRIBA del dot del footer. Header azul claro (#e8f0fe), 2 botones de acción (Reiniciar / Más tarde) + link "Ver información de versión". Z-index 500001 (escapa del `isolation: isolate` del header).
3. **Modal "Información de actualizaciones"** (`#kair-update-modal-overlay`) — user-invoked, abre con el link del dropdown. Badge de estado con dot animado, grid con versión instalada / última versión / última verificación / canal, botón "Buscar actualizaciones ahora" con feedback de "Buscando…".
4. **Panel "Actualizaciones" en Configuración** — pestaña "Acerca de la App". Grid con la misma info + 6 estados (idle / checking / not-available / available / downloaded / error) + botón de check manual + botón "Reiniciar e Instalar".
5. **Disclaimer "Se instalará al cerrar la app"** — al lado del dot del footer, solo visible cuando hay update. Cambia a "Lista para reiniciar" cuando está descargado.
6. **Release notes desde GitHub API** — IPC handler `get-release-notes` en `main.js` con cache de 1h, render en formato monospace con scroll interno en el modal.

**Cambios de arquitectura**:

- **Toasts invasivos removidos**: `notifyAvailable()`, `notifyDownloaded()`, `updateProgress()` ahora son no-ops (solo loguean). El UI muestra el dot del footer en su lugar. `notifyError()` se mantiene (errores merecen notificación).
- **Botón del header eliminado**: se quitó `<button id="header-update-btn">` del header y 200+ líneas de CSS legacy. La versión ya está en el footer, no tiene sentido duplicarla.
- **Dropdown positioning con footer como referencia**: el cálculo usa el `top` del `#app-footer` (no el del dot) y setea `max-height` dinámico. Si el contenido es más grande, hace scroll interno en el body. Fix del bug donde el dropdown invadía el footer.

**Archivos modificados**: `index.html`, `styles.css`, `renderer.js`, `main.js`, `preload.js`, `components/config/config-viewer.html`, `assets/js/update-notifications.js`.

**Tests**: 158/158 OK en `main/test-fixes-loop48.js`.

**Para validar visualmente**:

```js
// Simular el dot azul (update disponible)
const b = document.getElementById('footer-update-btn');
b.hidden = false;
b.className = 'footer-update-btn footer-update-available';
b.click();  // abre el dropdown anclado arriba del dot
```

## 🎨 Footer minimalista: solo en pantalla de inicio, blanco sobre Vanta (📦701-fix9, v0.1.171)

A partir de **v0.1.171** el footer negro con copyright y versión se quitó de la app principal y de la Bandeja Integrada. Ahora solo aparece en la pantalla de inicio (splash + login + selección de empresa) flotando sobre el Vanta con texto blanco.

### Patrón de implementación con CSS `:has()`

El selector original `.vanta-fullscreen #app-footer { display: none; }` **NUNCA funcionó** porque la clase `vanta-fullscreen` se aplica a `.main-container` (sibling del footer, no ancestro). Por eso veías el footer negro en la app principal — la regla de ocultarlo nunca matcheó.

**Solución con `:has()` (selector moderno, soportado en Electron 37 / Chromium 118+):**

```css
/* Default: footer oculto en la app principal */
#app-footer {
  display: none !important;
}

/* Cuando #app tiene un descendiente con vanta-fullscreen, mostrar el footer */
#app:has(.vanta-fullscreen) #app-footer {
  display: flex !important;
  position: fixed !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 50 !important;
  background-color: transparent !important;
  color: rgba(255, 255, 255, 0.85) !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5) !important;
  padding: var(--spacer-sm) var(--spacer-lg) !important;
  justify-content: space-between !important;
  border-top: none !important;
}
```

**Por qué `:has()`** en vez de modificar el JS:
- `vanta-fullscreen` se togglea en 7 lugares del `renderer.js`
- Con `:has()` desde el padre común (`#app`), una sola regla CSS cubre los 7 casos
- Cero cambios al JS = cero riesgo de regresión

### Reglas para IAs que extiendan el patrón

1. **Usar `:has()` para elementos siblings del que togglea la clase**: cuando una clase se aplica a un elemento y querés afectar a sus siblings, `:has()` desde el ancestro común es la solución CSS-only.
2. **`text-shadow` siempre en texto sobre fondos variables**: el Vanta es animado, el color cambia. Sin text-shadow el texto blanco se pierde en zonas claras. Usar `text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5)` para legibilidad consistente.
3. **`position: fixed` + `bottom: 0` para elementos que overlay contenido**: el footer sigue en el DOM, pero con `position: fixed` no toma espacio en el flow y overlay el contenido (el Vanta en este caso).
4. **Trade-off del update dot**: el dot de updates vivía en el footer. Al ocultarlo, perdimos el indicador visible. Sigue accesible desde Configuración > Acerca de la App. Si querés re-ubicarlo (botón flotante, header), es un cambio pequeño.

### Bandeja Integrada — patrón más simple

Para la Bandeja Integrada (que es un iframe con su propio scope), la solución fue más simple porque no hay selector de padre:

```css
/* renderer/bandeja-integrada/styles.css */
.kair-footer {
  display: none !important;
}
```

El HTML y el JS no se tocaron — el DOM se sigue actualizando (`#footer-events-count`, `#footer-company`, `#footer-view`), solo se oculta visualmente. Si querés recuperarlo, comentás la línea y todo vuelve a funcionar.

## 🆕 Release flow automatizado (📦585, v0.1.131+)

A partir de **v0.1.131+** el flujo de release está automatizado. Antes había que acordarse de hacer `git tag` + `git push origin <tag>` antes de correr `electron-builder --publish=always`, y si se olvidaba, GitHub devolvía **422 "Published releases must have a valid tag"** y el release quedaba roto con assets huérfanos.

### `scripts/release.ps1` (7.6 KB)

Ejecuta el flujo completo de release en 7 pasos. **El paso crítico es el 5: `git push origin v<version>` ANTES del build** — eso es lo que evita el 422.

```powershell
# flujo completo (con tests):
.\scripts\release.ps1

# flujo sin tests:
.\scripts\release.ps1 -SkipTests
```

**Pasos del script**:

1. **Pre-checks** — Verifica `GH_TOKEN` en environment, branch actual = `Dev-Pc` (configurable con `-Branch`), working tree limpio (advierte y pide confirmación si hay cambios).
2. **Tests** (opcional) — Corre `main/test-fixes-loop48.js` si existe. Falla rápido si hay tests rotos.
3. **`git push origin Dev-Pc`** — Sube los commits pendientes al remoto.
4. **Crea tag `v<version>` local** — Lee la versión de `package.json`. Si el tag ya existe local, pregunta si lo borra.
5. **`git push origin v<version>`** ← **EL PASO QUE EVITA EL 422**
6. **Verifica visibilidad del tag en GitHub** — Hace `GET /repos/{owner}/{repo}/git/refs/tags/{tag}`. Si no está visible, espera 5s.
7. **`npx electron-builder --win --publish=always`** — Build completo. Si falla, llama a `fix-release.ps1` automáticamente.

### `scripts/fix-release.ps1` (7.8 KB) — Fallback

Si `electron-builder` falla (típicamente por timeout al subir el `.exe` de 264 MB), `release.ps1` llama automáticamente a este script. También se puede correr manual:

```powershell
# Usa la version de package.json:
.\scripts\fix-release.ps1

# Version especifica:
.\scripts\fix-release.ps1 -Version 0.1.133
```

**6 pasos del fix**:

1. **Verifica archivos locales** — `.exe` y `.blockmap` en `dist/`. Falla si no existen.
2. **SHA512 + latest.yml** — Calcula el hash real del `.exe` local y regenera `dist/latest.yml` con el formato que espera `electron-updater`.
3. **Obtiene o crea el release** — `GET /repos/{owner}/{repo}/releases/tags/v{version}`. Si no existe, lo crea.
4. **Borra assets huérfanos** — Recorre los assets existentes y borra los que tienen el nombre viejo (`sgsst-electron-app-setup-*`).
5. **Sube assets con curl** — `.exe`, `.blockmap`, `latest.yml` con `& curl.exe -X POST` directo a `uploads.github.com`. Cada upload muestra OK/FAIL.
6. **PATCH name + body** — `PATCH /releases/{id}` con el nombre `v{version}` y un body minimalista con link al CHANGELOG.

### Bugs del fix manual que el script ya corrige

Durante los intentos manuales de v0.1.131/132/133 descubrimos 2 bugs en el shell scripting que el script ya tiene arreglados:

1. **Regex glotona**: `"\?.*$"` se comía el `}` final del `upload_url`, dejando `assets{` que curl rechazaba como "Bad hostname". **Fix**: usar `\{[^}]*\}` (una sola pasada, no glotona).
2. **PowerShell wildcard**: `"$uploadBase?name=..."` se parseaba como `"$uploadBase?` (variable con 1 char extra) + `name=...` porque `?` es wildcard. **Fix**: delimitar con `{}` → `"${uploadBase}?name=..."`.

### Cero impacto en runtime

Los scripts son **solo para el build pipeline**, no se importan en la app. `package.json` no los referencia. Se pueden commitear al repo sin riesgo.

## 🆕 Menú nativo de Electron oculto (Loop 47b, 📦579, v0.1.130)

A partir de **v0.1.130** la barra de menú nativa de Windows (File / Edit / View / Window / Help) ya **no se muestra** por defecto en la app. Comportamiento idéntico a Discord, Slack, VSCode:

- **Modo DESARROLLO** (`npm start`): menú OCULTO por defecto. Aparece temporalmente al presionar la tecla **Alt** (comportamiento estándar de Windows). Útil para acceder a Reload, DevTools, etc. sin saturar la UI.
- **Modo PRODUCCIÓN** (app empaquetada con `.exe`): menú OCULTO TOTAL. Ni siquiera aparece con Alt. La app se ve limpia, sin elementos del sistema operativo que el cliente no necesita.

### Implementación

- **En `main.js` BrowserWindow**: `autoHideMenuBar: true` (opción NATIVA de Electron).
- **En `main.js` `app.whenReady()`**: bloque condicional `if (app.isPackaged) { Menu.setApplicationMenu(null); }` que en producción lo oculta TOTALMENTE.
- **Import necesario**: `const { ..., Menu } = require('electron');` (la línea 3 de main.js ya lo incluye).

### Reglas para IAs que extiendan la app

- **NO cambiar el comportamiento** sin preguntarle al usuario. El patrón está validado y funciona bien.
- Si necesitás exponer un menú custom (ej. para una feature de debug), usá `Menu.buildFromTemplate([...])` y `Menu.setApplicationMenu(menu)` — pero **solo en modo dev** (`if (!app.isPackaged)`).
- Los atajos de teclado del menú nativo (F12, Ctrl+R, Ctrl+Shift+I) **siguen funcionando** aunque el menú esté oculto, porque Electron los mantiene registrados internamente.

---

## 🆕 Seguimiento de Incapacidades con SQLite (📦701+705+706+702+703+704, v0.1.166-170)

A partir de **v0.1.166** el submódulo 3.3.6 (Medición del Ausentismo por Causa Médica) tiene un **flujo completo de seguimiento de incapacidades (PRIC)** que respalda los datos en SQLite (kair.db) en paralelo al Excel legacy PRI.xlsx. Se entregó en 5 iteraciones:

### Evolución por versión

| Versión | Commit | Foco |
|---------|--------|------|
| v0.1.166 | `📦701` | **FASE 1**: schema SQLite + bridge IPC. Tabla `seguimiento_incapacidad_caso` (~80 cols, UNIQUE empresa+cedula+fechas) + `seguimiento_incapacidad_registro` (FK CASCADE). 6 handlers: `guardar`/`listar`/`obtener`/`eliminar`/`exportarExcel`/`exportarTodos`. Sincronización bidireccional SQLite ↔ Excel con botón "Exportar a Excel" desde la UI. |
| v0.1.167 | `📦702+703+704` | **FASE 2+3**: banner BD con 4 estados visuales (is-unsaved/saved/exported/error), lista de casos en BD con badges, auto-hide header después de 30s de inactividad. |
| v0.1.168 | `📦701+705+706+fix3+4+5` | **Bugfixes críticos**: schema con columnas duplicadas (origen_dx2/dx3 en 2 secciones), error "[object Object]" al guardar, búsqueda primero en BD, tabla refleja seguimientos nuevos, estado actualizado, botón Siguiente inteligente (considera secciones atenuadas), mapeo de IDs reales del HTML, alias de export en el bridge. |
| v0.1.169 | `📦701+fix6+fix7` | **Informe PRI**: casos de BD incluidos con sus seguimientos (query separada a `seguimiento_incapacidad_registro WHERE caso_id = ?`). Mapeo: fecha en `colIdx[seguimiento N]`, descripción en `colIdx + 1` (columna adyacente sin header). Timezone fix en `formatDate` (YYYY-MM-DD + T00:00:00 para local). `determinarEstadoCaso` considera el caso de BD. |
| v0.1.170 | `📦701-fix8` | **Cédula display vs BD**: normalización en 2 capas (renderer + bridge) para que la query matchee siempre. Lección: cualquier query de BD con cédulas/documentos del display debe normalizar antes. |

### Estructura de archivos clave

```
sgsst-electron-app/
├── main/
│   ├── seguimiento-incapacidad-bridge.js  # 6 handlers IPC + schema SQL
│   └── db-instance.js                     # Singleton de la BD
├── preload.js                             # Expone window.electronAPI.seguimientoIncapacidad
├── modules/gestion-salud/ausentismo/
│   ├── medicion-ausentismo.js             # Renderer: flujo completo de seguimiento
│   └── informe-pri-builder.html           # Informe PRI (incluye casos de BD)
└── main.js                                # get-pri-seguimiento-data con casos de BD
```

### Patrón del bridge IPC (6 handlers)

```js
// 1. Schema SQL (idempotente, en try/catch)
const SEG_INC_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS seguimiento_incapacidad_caso (...)`;
const SEG_INC_REG_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS seguimiento_incapacidad_registro (...)`;

// 2. Helpers de transformación
function _aplanarCaso(caso) { /* frontend JSON → DB row */ }
function _expandirCaso(row, regs) { /* DB row → frontend JSON anidado {trabajador, incapacidad, pric, ...} */ }

// 3. Handlers
ipcMain.handle('seguimiento-incapacidad:guardar', (event, { empresaId, data }) => _handlerGuardar(empresaId, data));
ipcMain.handle('seguimiento-incapacidad:listar', (event, { empresaId }) => _handlerListar(empresaId));
ipcMain.handle('seguimiento-incapacidad:buscarPorCedula', (event, { empresaId, cedula }) => _handlerBuscarPorCedula(empresaId, cedula));
// ... + obtener, eliminar, exportarExcel
```

### Reglas para IAs que extiendan el flujo

1. **Patrón "tabla principal + tabla de detalles"**: `seguimiento_incapacidad_caso` (1 fila por caso) + `seguimiento_incapacidad_registro` (N filas con FK CASCADE). NO asumas que el caso tiene un array embebido de seguimientos — query separada.
2. **Patrón "Excel column header + adyacente sin header"**: el Excel legacy tiene `SEGUIMIENTO 1` en col N y la descripción en col N+1 (sin header propio). Al mapear de BD a Excel, setea por índice directo: `newRow[colIdx[seguimiento N]] = fecha` y `newRow[colIdx[seguimiento N] + 1] = descripcion`. Verifica `idxDesc < totalCols` antes de escribir.
3. **Patrón "defense in depth en 2 capas"**: cualquier input de display que vaya a query de BD debe normalizarse TANTO en el renderer (caller) COMO en el bridge (handler). La cédula display `1,044,392,755` no matchea con la BD `1044392755` — `.replace(/,/g, '').replace(/\./g, '').trim()` en ambos lados.
4. **Patrón "YYYY-MM-DD nativo en backend"**: el `formatDate()` del renderer espera ISO o Date nativo. Si mandas DD/MM/YYYY retorna "Invalid Date". El backend SIEMPRE envía YYYY-MM-DD, el frontend formatea para display.
5. **Patrón "sección ya capturada"**: cuando un caso ya tiene datos guardados, marcar `seccion1YaCapturada = true` para bypass de validación al reabrir. Caso nuevo → sección 1 (capturar), caso existente → sección 2 (continuar seguimiento).
6. **Patrón "botón Siguiente inteligente"**: considerar no solo "es la última sección" sino "hay siguiente VISIBLE (no atenuada)?" para el caso seguimiento simple.
7. **Patrón "exportar alias largo + corto"**: cuando se importa con destructuring, exportar TANTO el nombre largo COMO el corto (`registerSeguimientoIncapacidadHandlers: registerHandlers`) para evitar `undefined` cuando hay inconsistencia.
8. **Patrón "validar schema con Python sqlite3 antes de integrar"**: el bug del schema con columnas duplicadas pasó 2 versiones porque el try/catch silenciaba el error. Verificar el schema con `python -c "import sqlite3; ..."` antes de mergear.
9. **NO commitear sin autorización explícita** del usuario. "procede" = SOLO autoriza hacer cambios de código. "dale/OK/commit/perfecto" = autoriza commit. "realiza solo el commit" = autoriza commit sin push. "pushea y procede con el release" = push + bump + release.

---

## 🧪 Tests smoke (en `main/test-*.js`)

Desde v0.1.120, el proyecto tiene **tests smoke** en `sgsst-electron-app/main/test-*.js` que validan que los cambios no rompen nada.

**OJO — hay dos grupos:**
- Los `test-fixes-loopN.js` / `test-compose-bem.js` (históricos, 📦 de la Bandeja vieja) **están en
  `.gitignore`** (no se commitean).
- Los de la Bandeja Integrada premium **SÍ se commitean** (van con el cambio): `test-bandeja-premium-v2.js`,
  `test-firma-imagen.js`, `test-bandeja-toolbar-compacta.js`, `test-bandeja-paginacion.js` y
  `test-bandeja-paginacion-funcional.js`.

### Archivos de test
| Archivo | Checks | Qué valida |
|---------|--------|------------|
| `test-compose-bem.js` | 58 | BEM refactor 4 componentes (email-row, thread-header, quoted-thread, compose-panel) |
| `test-fixes-loop1.js` | 18 | 5 fixes visuales del loop 1 (hover fecha, word-break, quote, "para: —", chip "Recibidos") |
| `test-fixes-loop2.js` | 20 | Features 4-7 (adjuntos, firma, badge N mensajes, auto-refresh) |
| `test-fixes-loop3.js` | 11 | Badge N mensajes + auto-refresh 5 min |
| `test-fixes-loop4.js` | 14 | Operadores de búsqueda con chips visuales |
| `test-fixes-loop5.js` | 14 | 4 fixes visuales Gmail-style del loop 5 (body limpio, email no cortado, "hace X horas", chip) |
| `test-fixes-loop6.js` | 4 | 2 errores runtime (m is not defined + tailwindcss) |
| `test-fixes-loop7.js` | 8 | 3 mejoras visuales del preview de Z.ai (avatar 32px, sort, footer) |
| `test-fixes-loop8.js` | 10 | 3 ajustes de la imagen objetivo (para plano, 1 de N, weekday) |
| `test-bandeja-premium-v2.js` | 42 | Migración premium v2 (📦752): topbar, KPI cards, sidebar, capa CSS y contrato DOM |
| `test-firma-imagen.js` | 88 | Firma con imagen (📦753): MIME en línea, `cid:`, adjuntos, cupo de Gmail, no-leídos, respuesta rápida |
| `test-bandeja-toolbar-compacta.js` | 50 | Toolbar compacta (📦754): 1 fila de acciones + fila de carpetas, menú "Más", fix del helper `el()` |
| `test-bandeja-paginacion.js` | 48 | Paginación (📦755): esquema, sync `append`, scroll infinito, botón "Cargar más", fixes del cupo |
| `test-bandeja-paginacion-funcional.js` | 22 | **FUNCIONAL** (📦755): páginas sin solaparse, contador, `page_token` y ventana de fechas — contra SQLite real |
| `test-skeleton-encaje.js` | 26 | Encaje del esqueleto (📦756): compara radio/borde/padding/gap/alto del esqueleto contra las tarjetas reales, en los 7 homes y en el submódulo Mantenimiento |
| `test-chart-overflow.js` | 20 | El gráfico no se sale de su tarjeta ni deforma su texto (📦757+📦758): sin alto/ancho en línea, sin `preserveAspectRatio="none"`, sin texto dentro del dibujo, los 7 homes usan `.kair-bar-chart` + `.kair-chart--flow`, y cache-bust |
| `test-grafico-se-ve-bien.js` | 39 | Los gráficos se ven bien (📦758): **EJECUTA el código real** de los 7 homes con un DOM mínimo y verifica el HTML producido (porcentajes de cada barra, textos, filas) + las reglas CSS que impiden que se pisen |
| `test-evaluacion-inicial-premium.js` | 43 | Evaluación Inicial del SG-SST — ronda anterior (📦759): conserva las verificaciones de que el modo oscuro cubra `dark` Y `dark-legacy` y de que NO vuelva el CSS global inyectado desde el `.js`. Lo específico del rediseño v2 lo cubre el test de abajo |
| `test-evaluacion-inicial-v2.js` | 64 | Evaluación Inicial del SG-SST v2 (📦761): **EJECUTA la vista real** con un backend simulado y verifica la estructura del diseño nuevo (barra superior, pestañas, 3 indicadores clicables, medidor SVG, PHVA, los 5 modales), el adaptador `findings → estándares`, que los planes se guarden y se borren contra la base, el modo oscuro en los DOS atributos y el contrato con `renderer.js` |
| `manual-test-evaluacion-inicial-bootstrap.js` | 22 | **Necesita ventana: `npx electron main/manual-test-evaluacion-inicial-bootstrap.js`.** Choque con Bootstrap (📦761): monta el módulo con `bootstrap.min.css` cargado y **mide la geometría** del modal contra la ventana (que no quede `position: fixed`, que no se estire a todo el alto, que quede centrado y con su ancho de 420px) y que las tarjetas no hereden el fondo de la librería. Usa la copia local `main/_bootstrap-5.3.0.min.css` para no depender de la conexión |
| `test-evaluaciones-medicas-v2.js` | 85 | Evaluaciones Médicas Ocupacionales v2 (📦762): valida el **puente de base** (nombre, cédula, tipo, concepto, fechas y la regla de "Apto con recomendaciones" — todo ANTES de tocar la base), la **construcción** del módulo (clases prefijadas `emo-`, 107 ids del contrato, marcado balanceado, todos los selectores bajo `.emo-scope`, tokens fuera de `:root`), el **registro en la app** (los 4 puntos del patrón puente + `renderer.js` + **que la hoja esté linkeada en `index.html`**) y la **regla legal** de la renovación (certificado nuevo enlazado al anterior). Verificación visual: `npx electron main/_preview-emo.js` |
| `test-archivo-retencion-premium.js` | 50 | Archivo y Retención en premium (📦760): **EJECUTA la vista real** y verifica el adaptador de campos contra la forma exacta del backend (que el Tipo salga de los 4 booleanos, que la hoja se lea de `hojaOrigen`, y que el payload mande `disposicion` y no `disposicionFinal`), la estructura nueva, la edición en línea, el guardado masivo, los `type` del puente y el modo oscuro en todos los bloques |
| `test-mapeo-estructura-863.js` | 36 | Contrato del mapeo de estructura (📦863, Fase 0 del plan de 5 fases): **EJECUTA `Portear/src/map_directory.py` de verdad** contra un fixture temporal y parsea el stdout completo (si no hay Python, ese bloque se omite con un check aclarado); `root`/`structure.path` absolutos, `structure.name`, `subdirectories` como **dict** con las carpetas del fixture como claves; el pipeline (`map-directory` → `execFilePromise(pythonPath, [pythonScriptPath, directoryPath])` → `JSON.parse(stdout)` → `getPython()` → `config-viewer` → `preload`); y las dos consumidoras **extraídas y ejecutadas** (`searchInStructure`, `formatStructureForLog`). **A propósito NO chequea** `checksum`, `files[]`, `file_count`, indentado ni `scan_date`: las fases 2/3/4 los sacan. En 📦864 (Fase 1) el pipeline pasó a `execFilePromise(pythonPath, [...], { maxBuffer: 64 MB, timeout: 30 min })` y el test sigue 36/36: los invariantes fueron escritos para sobrevivir a las 5 fases |
| `test-mapeo-estructura-865.js` | 15 | Velocidad del mapeo de estructura (📦865, Fase 2 del plan de 5 fases): verifica en el **código** de `Portear/src/map_directory.py` (con `soloCodigoPy()`, que quita comentarios y docstrings para que el comentario que documenta la eliminación no dispare el guard) que **NO** existan `hashlib`, `_calculate_checksum` ni el campo `'checksum'`, que SÍ se use `os.scandir` y NO `os.walk`/`rglob`, que `scan_date` salga con `datetime.now().isoformat()` (no `null`), y que los errores de lectura se reporten; en `main.js`, los límites `maxBuffer: 64 MB` y `timeout: 30 min`; y una **corrida real** contra un fixture temporal (JSON parseable, `scan_date` ISO dentro de 48 h, búsqueda profunda de cualquier clave `checksum` en toda la salida, semántica de symlink con omit si la máquina no tiene permiso). **Prueba de mordida**: los 6 checks de cambio FALLAN contra el código de HEAD (con hashlib) y PASAN contra el nuevo; los 3 checks guardia pasan en ambos. Escrito para sobrevivir a las fases 3/4 (no chequea `files[]` ni indentado) |
| `test-mapeo-estructura-866.js` | 20 | Tamaño del mapeo de estructura (📦866, Fase 3 del plan de 5 fases): verifica en el **código** de `Portear/src/map_directory.py` (con `soloCodigoPy()`) que **NO** se emitan `files[]`, `file_count`, `dir_count` ni `indent=2` en el `json.dumps`, que los errores de lectura vayan a `stderr` (`file=sys.stderr`) para que el stdout siga siendo JSON puro en una línea (requisito de la Fase 4), que **SÍ** sigan `total_files`/`total_folders` (llenados con el contador de módulo `_contador`, reiniciado en `map_directory()` — los consumen `renderer.js:7158/7160` y `main.js:4337/4338`), y que `formatStructureForLog` siga guardando `if (node.files)`; más una **corrida real** contra un fixture temporal (stdout en UNA sola línea, JSON parseable, misma forma de claves contractuales `root`/`structure.name`/`path`/`subdirectories` dict, sin claves `files`/`file_count`/`dir_count` en los nodos, `total_files`/`total_folders` numéricos coherentes). **Prueba de mordida**: los 8 checks de cambio FALLAN contra el código de HEAD (con `files[]`) y PASAN contra el nuevo; los 12 checks guardia pasan en ambos. Escrito para sobrevivir a la Fase 4 (no chequea `stderr` ni progreso) |
| `test-mapeo-estructura-867.js` | 44 | Progreso real del mapeo de estructura (📦867, Fase 4 del plan de 5 fases): verifica en el **código** de `Portear/src/map_directory.py` (con `soloCodigoPy()`) que exista `_avisar_progreso()` con `time.monotonic()`, umbral de 0,25 s, formato `[PROGRESO] archivos=%d carpetas=%d`, `flush=True`, **nunca** `file=sys.stdout`, y que haya las tres llamadas (forzada de arranque dentro de `map_directory`, amortiguada en la recursión, forzada justo antes de `print(json.dumps`); que **stdout siga siendo un único `print(json.dumps(structure`** (contrato de la Fase 3). En `main.js` (con `soloCodigo()`, un stripper de comentarios que respeta strings — un replace con regex no sirve: el código tiene URLs con `//`) que `execFilePromise` ya no sea un `promisify(execFile)` pelado y cuelgue `.child`, que se lea `child.stderr`, que se envíe por `mapeo-progreso` con `archivos`/`carpetas` numéricos, con guard de `event.sender.isDestroyed()`, y que **NO** se hayan perdido `maxBuffer: 64 MB` ni `timeout: 30 min` de la Fase 1; en `preload.js` que `onMapDirectoryProgress` se suscriba al canal y **devuelva la función de baja**; en `config-viewer.html` que la copia "10-60 segundos" ya no exista, que exista `mapping-progress`, que la vista se suscriba, pinte `progreso.archivos`/`progreso.carpetas` y **suelte el listener en los tres caminos de salida**. Más una **corrida real** contra un fixture (stdout parseable y en UNA línea, sin `[PROGRESO]`; stderr con líneas bien formadas, la primera forzada `0 y 0` y la última cerrando con los totales reales contados aparte en JS) y un **bite test**: el mismo script con el progreso redirigido a stdout debe dejar de producir un JSON parseable. **Prueba de mordida**: 11 mutaciones (sin `.child`, `promisify` pelado, sin guard `isDestroyed`, progreso a stdout, sin `timeout`, preload sin baja, "10-60 segundos" de vuelta, un camino sin soltar, sin `flush`, `time.time()` en vez de `monotonic`, canal mal escrito) — **las 11 hacen caer al menos un check** |
| `test-google-oauth-868.js` | 57 | Credenciales de Google **de la app**, no del usuario (📦868): verifica que exista `shared/google-oauth-config.js` (fuente real, versionada) con `available` **derivado de que existan las DOS** credenciales —no un flag manual que pueda mentir—, que el `client_secret` es **NECESARIO**: el endpoint de canje de Google responde `client_secret is missing` cuando falta, y **no** se debe usar `clientAuthentication = 'None'` porque esa librería entonces omite el secreto y Google lo rechaza; además que los handlers de OAuth escriban en `sendLog` (con `console.error` un fallo del canje no deja rastro en `main.log` y no hay forma de diagnosticarlo); que el aviso de "faltan credenciales" del log juzgue con el **mismo criterio que `available`** (si no, gritaba en el log mientras `available` decía que todo estaba bien), que `google-auth.js` lo use y que el `.env` haya quedado como **override** (`process.env.X || oauthConfig.x`), que NO se haya quedado solo con `process.env` (el bug original), y que el puerto/`redirect_uri` salgan del config. En `main.js`: que el guard esté en la línea del `if (!googleAuth.available)` y **antes** de `startAuth()` —se localiza con `match` y no con `indexOf`, porque el comentario del guard también nombra `googleAuth.available` y una mutación que lo movía pasaba inadvertida—, que no abra el navegador, y que el detalle vaya a `sendLog`; que `google-oauth:status` exponga `available`. En `config-viewer.html`: que la vista guarde `available`, lo consulte antes de ofrecer el botón, y lo esconda si no puede funcionar. **CHECKS INVERTIDOS** (§7.3: invertir, no borrar): NINGÚN mensaje al usuario puede contener `.env`, `GOOGLE_OAUTH_CLIENT_*`, "OAuth", "flow", "tokens", "instalación", "código de autorización" ni el error crudo de Google —para eso toma los literales de `onGmailConnectClick` y **excluye los que van a `console.**, porque antes el mensaje iba directo al `alert` y el extractor no veía nada—; y que el error crudo no se concatene al `alert`. Además lee el **grafo de carga real** (los `<script src>` de `index.html` y `bandeja-integrada/index.html`, 140 scripts) para afirmar que la única ruta viva es la vista de Gmail y que `calendar-operations.js` sigue muerto (está entre los 12 huérfanos de `AGENTS.md:2549`; este paquete cayó en esa trampa y revirtió su cambio). **Prueba de mordida**: 21 mutaciones (volver a `process.env` solo, quitar el override, quitar `available`, `available` manual, guard movido, sin `sendLog`, botón ofrecido igual, jerga de vuelta, error crudo de vuelta, `available` fuera del status, `.env.example` diciendo obligatorio) — **las 11 hacen caer al menos un check**. Complemento fuera del repo: prueba funcional de la cadena con `process.env` vacío (15/15) |

> **Validación de integración (fuera del repo):** se extrajeron y ejecutaron el wrapper
> `execFilePromise` y la regex del listener **tal como están en `main.js`**, contra
> `map_directory.py` real sobre un fixture de 2.500 archivos — 15/15. Las muestras de progreso
> llegaron a los 81 ms y 114 ms, **antes** de que el proceso terminara (125 ms). Eso prueba lo
> que ningún check por forma puede probar: que el `stderr` se escucha **en vivo** y no llega
> bufferizado junto con el resultado. Un fixture local tarda ~125 ms, así que solo da 2 muestras
> (arranque y cierre); con una carpeta real en Drive, que tardó 1.241 s, daría ~5.000. Sigue
> sin decidir si entra al repo como test.

**Nota:** el total puede variar si se agregan o quitan tests. Correr los del módulo que se toca antes de commitear.

### ⚠️ Tests FUNCIONALES: se corren con Electron, no con `node`
`better-sqlite3` está compilado para el ABI de Electron, así que un test que abra la base con `node`
a secas falla con `ERR_DLOPEN_FAILED`. Hay que correrlo con el Node de Electron:
```powershell
$env:ELECTRON_RUN_AS_NODE=1; npx electron main/test-bandeja-paginacion-funcional.js
```
(`ELECTRON_RUN_AS_NODE=1` ejecuta Electron como Node puro: sin ventana, sin GPU, sin problemas de sandbox.)


### Patrón de test
Cada test sigue el mismo patrón:
```js
const fs = require('fs');
const path = require('path');
const appPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');
const appSrc = fs.readFileSync(appPath, 'utf8');

const checks = [];
checks.push({ name: 'JS: feature X existe', ok: /patron regex/.test(appSrc) });
// ... más checks

// Reporte
var failed = 0;
checks.forEach(function (c) { /* ... */ });
process.exit(failed === 0 ? 0 : 1);
```

### Cómo correr los tests antes de commitear
```powershell
cd sgsst-electron-app
node tools/run-all-tests.js            # la suite completa: 111 tests
node tools/run-all-tests.js sidebar    # filtro por substring
node main/test-bandeja-sidebar-850.js  # uno solo
```
> 📌 **Corregido 2026-10-03.** Esta sección mandaba correr `test-fixes-loop$i.js`, que ya no existen.
> El runner real es `tools/run-all-tests.js`: descubre por **regex de nombre** `/^test-.*\.js$/` y solo
> en `main/`. Los 30 tests de `tests/` **no los ve nadie**.
>
> ⚠️ El runner parsea el `N/M OK` del stdout por regex. Si un test no lo imprime, lo cuenta como verde.
> Por eso el formato de salida no es opcional.

### Reglas
- **SIEMPRE** agregar un test nuevo cuando se implemente una feature (incrementar el contador)
- **SIEMPRE** correr los tests antes de commitear
- **NO** commitear si algún test falla (investigar y arreglar primero)
- **Nombre:** `test-<slug>-<paquete>.js`. El número al final, `test-` al principio (obligatorio para el discovery).
- Los tests son **estructurales** (validan invariantes leyendo el código), no de GUI. **No hay tests de
  Playwright ni de Electron real**; lo más parecido es levantar un contexto `vm` con DOM mínimo.
- **Para trabajo de UI, el patrón `checks[]` no alcanza.** Casi todo lo que se rompe es un texto que dejó
  de estar, y eso es trivial de "probar". El estándar de UI es factorizar como
  `evaluar(htm, css, js) -> {f, n}` y llamarlo con **mutaciones en memoria**, con tres guards:
  normalizar a LF antes de mutar, contar los **mutantes vacíos** por separado, y verificar
  `mut(x) !== x` antes de culpar a un check. Ejemplos canónicos: `main/test-bandeja-sidebar-850.js`
  (48 checks, 20 mutantes) y `main/test-bandeja-chip-851.js` (16 checks, 10 mutantes).
  Reglas completas en `PROMPT.md` §7.2 y en las lecciones de mutation testing al final de este archivo.
- **Cuando borras algo, invierte los checks que lo afirman; no los borre.** Un check borrado es un hueco.
  Si varios checks lo afirman, invierte **todos**: si no, reintroducir el código sin el markup pasa verde.
- **No hay lista de tests preexistentes en código.** Para afirmar que un fallo es preexistente hay que
  **probar que también falla en HEAD limpio** y decirlo con esas palabras.

---

## 🔍 Workflow de auditoría visual (v0.1.120+)

Cuando el usuario pide una **auditoría visual** (compara una imagen objetivo con el código actual), seguir este workflow:

### Pasos

1. **Recibir la imagen objetivo** (screenshot, URL de preview, o descripción)
2. **Comparar con el código actual** de la Bandeja Integrada:
   - Render del detail (thread grouping, header, recipients, action icons)
   - Render de la lista (avatars, sender, subject, snippet, time, attachments, labels)
   - Estado de los correos (unread, read, selected, hover)
   - Filtros y ordenamiento
   - Footer / versión
3. **Listar las diferencias** en una tabla priorizada:
   - 🔴 Críticos (rompen la apariencia)
   - 🟡 Importantes (no coincide con objetivo)
   - 🟢 Nice to have (mejoras menores)
4. **Aplicar fixes priorizados** con prefijos descriptivos (`🎨 audit:`, `📧 audit:`, `🐛 fix:`, `📚 docs:`)
5. **Agregar test smoke** que valide cada fix (en `main/test-fixes-loop<N>.js`)
6. **Commitear** con mensaje que liste los cambios

### Ejemplo: `🎨 audit(objetivo): 3 ajustes para coincidir con imagen objetivo`
- 3 cambios: "para:" como texto plano, "1 de N" dinámico, "Dom" weekday
- 1 commit: `89bbf28`
- 1 test: `test-fixes-loop8.js` (10 checks)
- Si el user no está conforme: `git revert 89bbf28` → commit `1fd5c0f`

### Skills útiles para auditorías
- `ui-ux-pro-max` — Análisis de diseño con base de datos de patrones UI
- `code-reviewer` — Review de confianza para validar que los fixes son correctos
- `code-simplifier` — Simplificar el código de los fixes sin perder funcionalidad

---

## 📦 Skills de opencode-power-pack (instalados en v0.1.120, 📦564)

Además de los 14 skills de superpowers, hay **11 skills de opencode-power-pack** instalados en `.opencode/skills/`. Cada uno tiene su propio SKILL.md que se carga con `skill({ name: "<nombre>" })`.

| Skill | Propósito |
|-------|-----------|
| **brainstorming** | Refinar ideas antes de codificar |
| **code-architect** | Diseñar arquitectura antes de implementar |
| **code-explorer** | Entender código existente antes de modificarlo |
| **code-reviewer** | Review de bugs/seguridad/calidad |
| **code-simplifier** | Simplificar código manteniendo funcionalidad |
| **commit-workflow** | Crear commits y PRs con mensajes significativos |
| **dispatching-parallel-agents** | Workflows concurrentes con subagentes |
| **doc-coauthoring** | Co-autoría de documentos estructurados |
| **feature-dev** | Workflow de features nuevas (7 fases) |
| **finishing-a-development-branch** | Decidir merge/PR/keep al completar tareas |
| **receiving-code-review** | Responder a feedback de code review |
| **requesting-code-review** | Checklist pre-review |
| **security-review** | Review de seguridad (inyección, auth bypass, RCE) |
| **silent-failure-hunter** | Cazar errores silenciosos en try-catch |
| **subagent-driven-development** | Desarrollo rápido con subagentes |
| **test-driven-development** | Ciclo RED-GREEN-REFACTOR |
| **using-git-worktrees** | Branches aislados para desarrollo paralelo |
| **using-superpowers** | Introducción al sistema de skills |
| **verification-before-completion** | Verificar antes de declarar completo |
| **visual-page** | Crear página HTML visual para conceptos complejos |
| **writing-plans** | Crear planes de implementación |
| **writing-skills** | Crear nuevos skills |

**Nota:** Esta lista puede crecer. Verificar `.opencode/skills/` para los disponibles.

---

## 🎨 Sistema de Skeleton Screens (v0.1.110+, 📦483-491)

El proyecto tiene un sistema centralizado de placeholders de carga que reemplazan los spinners genéricos. **API expuesta como `KairSkeleton.*`** con 10 componentes (SkeletonCard, SkeletonTable, SkeletonKPI, etc.).

**Cuándo usar:** cualquier vista que muestre datos asíncronos (KPIs, listas, tablas) antes de tener los datos reales.

**Patrón canónico para homes de módulo** (orden crítico para evitar parpadeos):
1. `container.innerHTML = '<div class="kair-skeleton-home">…</div>';` (mostrar skeleton YA)
2. `main.appendChild(container);` (montar en DOM)
3. `setTimeout(() => { loadStats(); }, 200);` (esperar 200ms para que el browser pinte el skeleton)
4. Dentro de `loadStats()`: hacer fetch, render real, `container.innerHTML = …` (reemplazar skeleton)

### Patrón canónico para homes de módulo

```js
async render() {
    this.container.innerHTML = '';
    // ... setup de layout ...

    const mainArea = document.createElement('div');
    mainArea.className = 'main-area';
    mainArea.style.flex = '1';

    // 1. Inyectar skeleton EN mainArea
    mainArea.innerHTML = KairSkeleton.kpiStrip(5) + KairSkeleton.chartBars(12) + KairSkeleton.chartDonut();

    // 2. Agregar al DOM (skeleton visible)
    contentContainer.appendChild(mainArea);
    layout.appendChild(contentContainer);
    this.container.appendChild(layout);

    // 3. Retardo 200ms (ojo registra el skeleton)
    await new Promise(r => setTimeout(r, 200));

    // 4. Cargar datos (skeleton visible mientras espera)
    await this.refreshStats();  // o await this.loadXxxStats();

    // 5. Renderizar widgets (limpia skeleton primero)
    await this.renderMainArea(mainArea);
}

async renderMainArea(container) {
    container.innerHTML = '';  // SIEMPRE limpiar antes de pintar
    // ... crear widgets y charts con datos reales ...
}
```

### Reglas críticas

1. **📦756 — EL ESQUELETO TIENE QUE ENCAJAR CON EL CONTENIDO REAL.** El bloque sombreado
   que se ve mientras cargan los datos debe ocupar **exactamente el mismo espacio** que el
   contenido que lo reemplaza; si no, al llegar los datos todo salta de lugar.
   Medido en 📦756, los homes usaban `KairSkeleton.kpiStrip(4)`, que dibujaba 4 tarjetas
   genéricas con OTRA forma:

   | Medida | Esqueleto viejo (`.ks-kpi-card`) | Tarjeta real (`.kair-metric-card`) |
   |---|---|---|
   | Radio | 12px | **20px** (`--kair-radius-card`) |
   | Padding | 20px fijo | clamp(15px, 1.6vw, 22px) / clamp(15px, 1.6vw, 20px) |
   | Alto mínimo | 104px | **clamp(110px, 10vw, 140px)** |
   | Layout | fila con avatar de 48px | **columna** (label / valor / descripción / barra) |
   | Contenedor | gap 16px + margin-bottom 24px, sin gutter | `.kair-health`: gap clamp(10,1.2vw,16) + gutter clamp(4,0.6vw,8) |
   | Borde | `--border-color` (#e2e8f0) | `--kair-line` (#e8ebee) |
   | Estructura | 4 tarjetas iguales (+ chart de 280px) | hero oscuro (2 columnas) + 3 métricas + 2 tarjetas + grilla de submódulos |

   **Solución (la definitiva)**: los generadores `KairSkeleton.home()`, `homeHero()`,
   `homeContent()`, `homeModules()`, `metricStrip()` y `metricCard()` **reutilizan las clases
   REALES** (`.kair-health`, `.kair-hero-card`, `.kair-metric-card`, `.kair-content`,
   `.kair-card`, `.kair-chart`, `.kair-legend`, `.kair-task`, `.kair-modules`,
   `.kair-module-grid`, `.kair-module`) y sólo cambian el texto por barras `.ks-bar`. El
   radio, el borde, el padding, el gap y el alto mínimo son idénticos **por construcción**:
   no hay una segunda hoja de estilos que se pueda desincronizar.
   - Los 7 homes de módulo usan `mainArea.innerHTML = KairSkeleton.home({ metrics: 3, rows: 4, modules: 6 })`.
   - El CSS `.ks-*` que sí sigue existiendo (para tablas, listas, formularios y KPIs) quedó
     **alineado** a las medidas premium y expone variables (`--ks-kpi-min`, `--ks-kpi-gap`,
     `--ks-kpi-pad`, `--ks-kpi-radius`, `--ks-kpi-minh`, `--ks-kpi-align`, `--ks-kpi-text`).
   - Un submódulo con KPIs de otra medida alinea su esqueleto **sin tocar styles.css**,
     declarando las variables en el contenedor. Ejemplo real (📦756) en
     `mantenimiento.css`: sus tarjetas son de 180px y centradas, así que el esqueleto hereda
     `--ks-kpi-min: 180px`, `--ks-kpi-pad: var(--kair-mnt-space-4) var(--kair-mnt-space-5)`, etc.
   - `kair-skeleton.js` se cargaba **sin `?v=`** en index.html → ahora tiene cache-bust.

   **Regla práctica**: antes de usar un esqueleto genérico, mirá el componente REAL que va a
   reemplazarlo y compará radio, borde, padding, gap y alto mínimo. Si difieren, hay salto.

2. **`?.` y `||` con default**: `KairSkeleton.show(container, 'table', { rows: 12 })` inyecta
   `.ks-skeleton-state` dentro del target; `hide()` borra ese wrapper. El `show` guarda el
   HTML previo en `dataset.ksPrev` (no lo restaura solo).


1. **Orden del DOM**: `appendChild` debe ir ANTES del `await renderMainArea/loadStats`. Si invertís el orden, el await termina antes de que mainArea sea visible.
2. **Retardo 200ms**: `setTimeout(200)` mínimo entre `appendChild` y `await`. `requestAnimationFrame` (16ms) es insuficiente.
3. **Limpieza en renderMainArea**: `container.innerHTML = ''` SIEMPRE al inicio, sino el skeleton queda apilado con los widgets reales.
4. **Conteo correcto**: el skeleton debe coincidir con la cantidad y tipo de widgets/charts que `renderMainArea` realmente crea.

### Bug detector automatizado

```bash
node -e "
const fs=require('fs');
const path=require('path');
const homes=['modules/gestion-integral/gestion-integral-home.js','modules/recursos/recursos-home.js','modules/gestion-salud/gestion-salud-home.js','modules/gestion-peligros/gestion-peligros-home.js','modules/gestion-amenazas/gestion-amenazas-home.js','modules/verificacion/verificacion-home.js','modules/mejoramiento/mejoramiento-home.js'];
homes.forEach(f=>{const code=fs.readFileSync(f,'utf8');const renderStart=code.indexOf('async render()');const body=code.slice(renderStart,renderStart+3000);const awaitIdx=body.indexOf('await this.renderMainArea');const appendIdx=body.indexOf('this.container.appendChild(layout)');if(awaitIdx>0&&appendIdx>0&&awaitIdx<appendIdx){console.log('⚠️  '+f);}else{console.log('✅ '+path.basename(f));}});
"
```

---

## 🔄 Dual-tree workflow (instalador ↔ git clone)

El proyecto se mantiene en DOS árboles paralelos:

- **Instalador built** (`D:\K-AIR-Installer-v<X>\resources\`) — artefacto empaquetado, runtime "source of truth"
- **Git clone** (`C:\Proyectos de Programación\Clone de Git\SG-SST-E\sgsst-electron-app\`) — repositorio de desarrollo

### Flujo

1. El usuario trabaja en la app instalada (la ejecuta como usuario final)
2. Periódicamente sincroniza el clon con el contenido del instalador para commitear cambios
3. La sincronización es **unidireccional D → C** (instalador → clon)
4. El clon recibe los cambios, se commitea, se pushea a GitHub

### Reglas

- **NO** copiar wholesale el `package.json` del instalador — solo trae `dependencies` (runtime), pierde `scripts`/`build`/`devDependencies`. Merge selectivo: deps del instalador + scripts/build/devDeps del clon.
- **Verificar** que `D:\` NO tiene `.git` antes de copiar (para no pisar nada por accidente)
- **Después de copiar**: `git status --short` puede reportar muchos "modified" pero el `git commit` real capturará menos (autocrlf).
- **Al reportar al usuario**, NO fiarse del conteo de `git status`. Decir "se copiaron N archivos pero solo M tenían cambios reales vs HEAD" si hay discrepancia.
- **Bump de versión** en `package.json` lo hace el USUARIO manualmente (no automático), 1 commit dedicado.
- **NO** commitear sin autorización ("sí"/"dale"/"commit"). Delegaciones por fase son puntuales, no transferibles.

### Script de sync típico

```bash
# Antes de sincronizar, verificar que D:\ no tiene .git
ls "D:\K-AIR-Installer-v0.1.110\resources" | Select-String ".git"

# Sincronizar selectivamente
Copy-Item "D:\K-AIR-Installer-v0.1.110\resources\modules\gestion-integral\gestion-integral-home.js" `
            "C:\Proyectos de Programación\Clone de Git\SG-SST-E\sgsst-electron-app\modules\gestion-integral\gestion-integral-home.js" -Force

# Verificar
cd "C:\Proyectos de Programación\Clone de Git\SG-SST-E\sgsst-electron-app"
git status --short
```

---

## 📊 Snapshot actual del proyecto (snapshot 2026-07-19)

- **Versión:** 0.1.120
- **Working tree:** limpio
- **Último commit:** `1fd5c0f` (Revert "🎨 audit(objetivo): 3 ajustes")
- **Commits principales recientes (en orden inverso):**
  - `1fd5c0f` — Revert "🎨 audit(objetivo): 3 ajustes" (deshizo el `89bbf28`)
  - `89bbf28` — 🎨 audit(objetivo): 3 ajustes (REVERTIDO)
  - `e44ddde` — 🎨 audit(preview-z-ai): 3 mejoras visuales (avatar 32px, sort, footer)
  - `dd577fe` — 🐛 fix(bandeja-integrada): 2 errores runtime
  - `b68b316` — 📧 audit(thread-grouping): refactor Gmail compacto
  - `6c0fb4b` — 📦564 # Instalar skills oficiales
  - `25a51d6` — 📚 docs: actualizar documentación completa v0.1.120
  - `383a96f` — 🔖 Bump version 0.1.120
  - `aef69d9` — 📦563 # Bandeja Integrada (release principal)
- **Sistema de Skeletons:** completo (📦483-491, 9 commits)
- **Bandeja Integrada:** completa y validada (📦563, 22 archivos, 11,285 líneas). Coexiste con K+AIR Calendar. OAuth + SQLite cache + Gmail-look UI + BEM refactor 4 componentes + 7 features. **Tests: 172/172 OK** acumulado. Ver la sección "🆕 Bandeja Integrada" más abajo en este archivo para los detalles completos.
- **9 módulos + 48 submódulos con lógica + ~58 submódulos menú + Bandeja Integrada (nuevo módulo de correo)**
- **Pendientes próximos (post-Bandeja Integrada):**
  - F3.C — Google Calendar write (eventos creados en Bandeja Integrada → Google Calendar real)
  - Refactor total legacy → BEM puro (sin compat con `.kair-mail-row`)
  - Vista diferenciada Enviados vs Recibidos (mostrar destinatario como sender en Enviados)
  - Drag & drop visual de correos al calendario
  - Bandeja Integrada v2 features: drag&drop archivos al compose, undo, snooze, mail icons overlay en calendar

---

## 📊 Snapshot actualizado (snapshot 2026-07-24)

- **Versión:** 0.1.136 (publicada, sin bump nuevo)
- **Working tree:** limpio
- **Último commit:** `7eb39dc` (📦603-fix)
- **Commits nuevos en esta sesión (📦601-📦603-fix):**
  - `a687a04` — 📦601 feat(calendario): RSVP modal + banner invitacion ICS en emails + auto-refresh 1 min
  - `a2a71e1` — 📦602 feat(bandeja-integrada): email viewer estilo Gmail (banner ICS, divider, translation banner, reply footer)
  - `b332f34` — 📦602-fix feat(bandeja-integrada): alinear banner ICS con header (padding 0 20px)
  - `5621989` — 📦603 fix(bandeja-integrada): 2 fixes importantes (sync no borra threads antes; banner+divider+footer alineados)
  - `7eb39dc` — 📦603-fix feat(bandeja-integrada): preservar messages al refrescar state.mails (FIX REAL del bug)
- **Commits REVERTIDOS esta sesión:**
  - `c76eb3d` — 📦604 (scroll interno + sidebar sticky). User pidió revertir. **NO commiteé sin autorización explícita** (ver regla abajo).
- **Logros del email viewer (📦602):**
  - Banner de invitación ICS entre header y cuerpo del correo (estilo Gmail)
  - Icono Calendar 4-colores en esquina superior derecha del banner
  - Botones Sí/No/Tal vez + "Proponer otro horario" + ⋮
  - Divider "Según este correo electrónico" con feedback 👍/👎
  - Banner de traducción con detección simple EN/ES
  - Header de adjuntos "X archivo adjunto · Analizado por Gmail"
  - Footer Responder/Reenviar con iconos SVG inline
  - Padding 20px en divider/footer/botones para alinear con cuerpo
- **Logros del F3.C Google Calendar sync (📦601):**
  - `shared/google-calendar.js` (nuevo, 360 líneas) con 7 funciones
  - 6 IPCs nuevos en main.js: `google-calendar:list/create/update/delete/sync/respond/upsert-from-ics`
  - preload.js expone `googleCalendar.*` en contextBridge
  - `sendUpdates: 'all'` en create/update/delete (envía invitación a attendees)
  - RSVP buttons (Asistiré/Tal vez/No) en modal con `responseStatus`
  - Parser RFC 5545 mínimo (parseIcs) en renderer
  - Banner invitación Calendar en email viewer
  - Auto-refresh cada 1 minuto
- **Bug crítico del sync resuelto (📦603 + 📦603-fix):**
  - **Causa 1 (backend)**: `deleteThreadsByFolder` borraba TODOS los threads antes del re-insert. Fix: mover delete después + nueva función `deleteThreadsByIds`.
  - **Causa 2 (frontend, MÁS SUTIL)**: `syncInboxInBackground` reemplazaba `state.mails` con objetos NUEVOS sin `messages`/`body`/`body_html`/`attachments`. Fix: mergear datos del cache con mails existentes por ID, preservando campos lazy-loaded. Más red de seguridad en `renderMailDetail` con flag `_loadingBody`.
  - **Lección**: cuando un bug persiste después de un fix "obvio", buscar la causa en otro lugar. En este caso el fix backend era correcto pero incompleto.
- **Tests: 189/189 OK** acumulado (de submódulo 3.1.3)

---

## 📊 Snapshot actualizado (snapshot 2026-07-27 — file-viewer + v0.1.137)

- **Versión:** 0.1.137 (publicada)
- **Working tree:** con cambios sin commitear (file-viewer feature, ver abajo)
- **Último commit pusheado:** `80fba542` (📦606 release notes)
- **HEAD:** `80fba542`
- **Tamaño `renderer/file-viewer-assets/`:** 29.16 MB (después de limpieza de carpetas no usadas; era 139 MB original)
- **Pendiente próximo commit:** 1 commit único con todo el feature de file-viewer (Pendiente de autorización del user)

**Commits pusheados desde snapshot anterior (📦604-📦606):**
- `a578c09b` — 📦604 feat(skills): emilkowalski/skills (8 skills) + snapshot 2026-07-24
- `7eb39dc7` — 📦603-fix feat(bandeja-integrada): preservar messages al refrescar state.mails
- `5621989` — 📦603 fix(bandeja-integrada): 2 fixes importantes (sync no borra threads antes; banner+divider+footer alineados)
- `b332f34d` — 📦602-fix feat(bandeja-integrada): alinear banner ICS con header
- `a2a71e1` — 📦602 feat(bandeja-integrada): email viewer estilo Gmail
- `a687a04` — 📦601 feat(calendario): RSVP modal + banner invitación ICS en emails + auto-refresh 1 min
- `f0b0bbb6` — 🔧 chore(build): excluir skills de opencode del paquete
- `a87e001d` — 🔖 Bump version 0.1.136 → 0.1.137
- `9643ea93` — 📦605 feat(bandeja-integrada): scroll interno sidebar + lista correos
- `80fba542` — 📦606 feat(release): release notes con `releaseInfo.releaseNotesFile` apuntando a `release-notes.md`

**Commits REVERTIDOS esta sesión:**
- `c76eb3d` — 📦604 (scroll interno + sidebar sticky). User pidió revertir. Lección: hacer un panel a la vez y validar entre cada uno.

---

El user me lo recordó FIRME el 2026-07-24 después de que commiteé `📦604` sin pedirle OK.

**REGLA**: 
- **NUNCA** hacer commit/push sin que el user diga explícitamente: "dale", "OK", "commit", "perfecto" o "procede"
- Si dice "sin commit hasta X", respetarlo estrictamente
- Si dice "revierte" o "elimina", hacer `git reset --hard` al commit anterior INMEDIATAMENTE
- El user acumula cambios en working tree, los valida visualmente, y solo después autoriza el commit
- Asumir "quedo bien" = "hace commit" es MAL

**Patrón de trabajo**:
1. Hacer cambios, dejar en working tree
2. Mostrar resumen claro de qué se cambió
3. Preguntar: "probá y decime si está bien. Si está OK, commiteamos"
4. Esperar la palabra clave
5. SOLO entonces hacer commit

**Caso real (esta sesión)**: commiteé `c76eb3d` (📦604) sin pedir OK. User lo revirtió con `git reset --hard 7eb39dc`. No volver a repetir.

---

## 🆕 Layout Bandeja Integrada: scroll interno en paneles (2026-07-27)

El user pidió "que todo quepa en la app sin desplazamientos" — el scroll debe ser INTERNO de cada panel, no de la página completa.

**Patrón validado** (commit `9643ea93`, 📦605 — pasos 1 y 2):

```css
html, body { height: 100%; overflow: hidden; }  /* bloquea scroll de página */

.kair-panel {                                    /* cualquier panel (sidebar, lista, detalle, calendar) */
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;                                 /* CRÍTICO: permite que el item flexible se encoja */
  overflow: hidden;
}
.kair-panel > .fijo { flex-shrink: 0; }                       /* header/search/footer NO se encojen */
.kair-panel > .scroll { flex: 1; min-height: 0; overflow-y: auto; }  /* contenido con scroll INTERNO */
```

**Requisito para que `height: 100%` funcione**:
- El padre debe ser flex O grid (NO `display: block`)
- En grid: `grid-template-rows: 1fr` + `align-items: stretch` explícitos
- `min-height: 0` en CADA nivel de flex/grid anidado

**Pasos aplicados**:
- **Paso 1 (sidebar, ✅ validado)**: mini-cal fijo arriba, leyenda flexible con scroll, integración fija abajo
- **Paso 2 (lista correos, ✅ validado)**: header + buscador + filtros fijos, items con scroll
- **Paso 3 (pendiente)**: detalle del correo con header sticky + footer fijo + body scrollable
- **Paso 4 (pendiente)**: calendar slide con toolbar fija + grid scrollable
- **Paso 5 (pendiente)**: resize handler en `renderer.js` para que el iframe se reajuste al cambiar tamaño de ventana

**Lección del 📦604 revertido (vs 📦605 que funciona)**:
- **604**: hizo los 3 cambios a la vez (sidebar + lista + detalle + sticky) sin debuggear → se rompió
- **605**: hace UN panel a la vez, validando con el user en cada paso → funciona
- El user prefiere ir paso a paso con validación visual entre cada uno

---

## 🆕 Skills de emilkowalski instaladas (2026-07-27)

Commit `a578c09b` (📦604). 8 skills de diseño + animación instaladas:
- `emil-design-eng` — skill principal (UI polish, animación, component design)
- `review-animations` — review estricto contra estándares altos
- `improve-animations` — audit + planes priorizados
- `find-animation-opportunities` — búsqueda de oportunidades de motion
- `animation-vocabulary` — glosario de términos correctos
- `apple-design` — principios de diseño de Apple
- `pick-ui-library` — picker de UI library
- `prototype` — múltiples versiones de UI

**Instalación**: `npx skills@latest add emilkowalski/skills --all`

**Estructura creada**:
- `.agents/skills/` — 8 skills fuente universal (SKILL.md reales)
- `.opencode/skills/` — 8 junctions (mklink /J) → `.agents/skills/` (para opencode)
- `.claude/skills/` — 8 junctions → `.agents/skills/` (para Claude)
- `agent/skills/` — 8 junctions → `.agents/skills/` (otros agentes)
- `skills-lock.json` — metadata con hashes para restaurar

**Total en `.opencode/skills/`**: 21 skills (13 que ya teníamos + 8 nuevas).

**Para Windows**: el instalador oficial crea symlinks Unix que no funcionan en Windows. Hay que usar `cmd /c "mklink /J ... ..."` o `New-Item -ItemType Junction` con paths absolutos (los paths relativos con `..\..\..\.agents\skills\` se resuelven mal).

---

## 🆕 @file-viewer — preview nativo de Office/PDF (2026-07-27, working tree)

User aprobó integrar [flyfish-dev/file-viewer](https://github.com/flyfish-dev/file-viewer) para reemplazar los 3 IPCs de preview actuales (`get-pdf-preview`, `get-word-preview`, `get-excel-preview`) que dependen de Python + LibreOffice (lentos, baja fidelidad, sin búsqueda, sin selección de texto).

**Estrategia: migración gradual (Opción B)** — los 3 IPCs viejos siguen vivos (no se rompe nada), el file-viewer se agrega como camino nuevo para los formatos Office (PPTX, DOCX, XLSX, imágenes, etc.). PDF queda en el flujo viejo por ahora (decisión aparte, ver "Pendientes próximos").

**Arquitectura del flujo nuevo**:

```
Renderer (browser)
  ├─ PDF actual:    getPDFPreview   ─┐
  ├─ DOCX actual:   getWordPreview  ─┤  ← MANTENER (prescindibles gradualmente)
  ├─ XLSX actual:   getExcelPreview ─┘
  └─ PPTX + resto:  readFileBytes (NUEVO) → Blob → <flyfish-file-viewer>
                                                │
Main process (Node)                              │
  ├─ IPCs actuales (sin cambios) ────────────────┤
  └─ IPC NUEVO read-file-bytes  ──────────────── ┘
```

**Componentes implementados (en working tree, sin commitear)**:

1. **NPM deps nuevas**:
   - `@file-viewer/web@2.2.3` (production) — bundle IIFE del viewer
   - `@file-viewer/preset-office` (production) — solo PDF/Word/Excel/PowerPoint (no trae CAD/3D/drawio/typst)
   - `pptxgenjs` (dev) — generador del sample de prueba

2. **IPC nuevo `read-file-bytes`** (`main.js`):
   - Recibe `filePath`, valida ruta accesible
   - Whitelist de extensiones (~200 formatos Office/PDF/imagenes/video/audio/EML/ZIP/3D/CAD/Mermaid/PlantUML/XMind/draw.io)
   - Validación de tamaño máximo **100 MB** (configurable vía `KAIR_FV_MAX_BYTES` env)
   - Retorna `{ success, data: { bytes: Uint8Array, name, ext, size } }` o `{ success: false, error }`
   - NO convierte a PDF, NO llama Python/LibreOffice — bytes crudos

3. **Preload** (`preload.js`):
   - `window.electronAPI.readFileBytes(filePath)` → IPC

4. **Helper compartido** (`shared/file-viewer.js`):
   - `window.kairFV.openWithFileViewerFromPath(filePath)` — abre el modal global con file-viewer
   - `window.kairFV.openFileViewerFromFile(file)` — variante con File API (input file)
   - `window.kairFV.closeFileViewer()` — cierra el modal
   - Crea el DOM del modal (full-screen) si no existe
   - Carga el bundle IIFE del viewer
   - Configura `setDefaultFullAssetBaseUrl('renderer/file-viewer-assets/')` para que los workers carguen desde el directorio local

5. **Bundle IIFE + helper cargados en `index.html` raíz** (renderer global):
   - `<script src="renderer/file-viewer-assets/flyfish-file-viewer-web.iife.js">` antes de `renderer.js`
   - `<script src="shared/file-viewer.js">` después del bundle
   - **CSP ajustada** para permitir `blob:` en `frame-src`/`child-src`/`img-src`/`script-src`/`object-src` (necesario para que el viewer renderice con Blob URLs)

6. **Switch del orquestador** (`renderer.js:1215`):
   - Cuando llega cualquier `*-preview-request`, decodifica `payload.filePath`
   - Detecta la extensión
   - Si es Office (no PDF) → dispara `kairFV.openWithFileViewerFromPath()` y responde al módulo con un **PDF dummy 1×1px** (base64 hardcoded) marcado con `handled: 'file-viewer'` para que el módulo no rompa su flujo de mostrar el response en un iframe
   - Si es PDF → llama al IPC viejo (sin cambios)
   - **Workaround documentado**: la integración limpia en los 46 submódulos (que detecten `handled: 'file-viewer'` y no muestren nada) queda pendiente

7. **Demo standalone en Bandeja Integrada** (`renderer/bandeja-integrada/{app.js,index.html,styles.css}`):
   - Botón "Probar FV" en el header (temporal pero útil para probar archivos que no estén en el flujo)
   - Input file oculto que acepta 200+ formatos
   - Modal full-screen con header (extensión coloreada por tipo, nombre, tamaño) + body con `<flyfish-file-viewer>` + cerrar con ESC o click fuera
   - 2 variantes: `openFileViewerFromFile(file)` (File API) y `openWithFileViewerFromPath(filePath)` (IPC)

8. **Sample PPTX** (`assets/samples/sample-sgsst.pptx` + `scripts/generate-sample-pptx.js`):
   - 8 slides con contenido SG-SST realista: portada, marco legal (Decreto 1072, Resolución 0312), política, objetivos, ciclo PHVA, indicadores, cierre
   - 175 KB, generado con `pptxgenjs`
   - Se puede regenerar con `node scripts/generate-sample-pptx.js`

9. **Script de setup reproducible** (`scripts/setup-file-viewer.js`):
   - Reinstala los assets oficiales via `file-viewer-copy-assets` (~139 MB)
   - Borra las carpetas que no usamos con `preset-office` (drawio 59 MB, typst 36 MB, model 7.4 MB, cad 6.3 MB, data 0.6 MB) → **queda en 29 MB**
   - Reporta el tamaño final
   - **Uso**: `node scripts/setup-file-viewer.js` (idempotente, se puede correr cada vez que se actualice el paquete)

**Limpieza de assets** — análisis del tamaño original de `renderer/file-viewer-assets/`:

| Categoría          | Tamaño   | Usado |
|--------------------|---------:|:-----:|
| vendor/drawio/     | 59.29 MB | NO    |
| wasm/typst/        | 36.25 MB | NO    |
| vendor/ppt/        | 17.29 MB | SÍ    |
| vendor/pdf/        |  9.18 MB | SÍ    |
| wasm/model/ (3D)   |  7.40 MB | NO    |
| wasm/cad/          |  6.26 MB | NO    |
| vendor/libarchive/ |  1.01 MB | SÍ (ZIP)  |
| vendor/xlsx/       |  0.79 MB | SÍ    |
| wasm/data/ (sql)   |  0.63 MB | NO    |
| vendor/pptx/       |  0.55 MB | SÍ    |
| vendor/docx/       |  0.32 MB | SÍ    |
| **Total**          | **139 MB → 29 MB** | |

**Cosas que NO se tocaron** (preservadas para no romper):
- Los 3 IPCs viejos (`get-pdf-preview`, `get-word-preview`, `get-excel-preview`) — siguen funcionando
- El flujo de PDF — el switch del orquestador mantiene el camino viejo cuando ext === 'pdf'
- Los 46 submódulos que llaman a los IPCs viejos — no se modificó ningún `*-logic.js` ni `*-component.js`
- El modal genérico de la Bandeja Integrada (`#modal-overlay` / `#event-modal`) — el modal de file-viewer es independiente (`#fv-overlay` / `#fv-body`)

**Pendiente de validación por el user** (working tree, sin commitear):
- PPTX: abrir `assets/samples/sample-sgsst.pptx` desde Bandeja Integrada (botón "Probar FV")
- XLSX: abrir un Excel desde cualquier submódulo → file-viewer modal global
- DOCX: abrir un Word desde cualquier submódulo → file-viewer modal global
- PDF: el flujo viejo (sin cambios, sigue funcionando)

**Pendiente para iteración futura** (no urgente):
- Integración limpia en los 46 submódulos (que detecten `handled: 'file-viewer'` y no muestren el PDF dummy)
- Decisión sobre PDF (mantener flujo viejo o migrar a file-viewer)
- Empaquetado: verificar que el `files: ["**/*"]` del package.json incluye `renderer/file-viewer-assets/` y que el .exe no excede ~270 MB (243 + 29)
- Probar auto-update end-to-end
- Rotar `GH_TOKEN` (comprometido, sigue pendiente)

---

## 🆕 Gotcha: copy-assets.mjs crea duplicado en public/file-viewer/ (📦629, 2026-07-29)

**Síntoma**: VS Code muestra "Cambios 2911" con archivos "U" (Untracked) sin razón aparente.

**Causa raíz**: El script oficial `node node_modules/@file-viewer/web-full/scripts/copy-assets.mjs`
siempre copia los assets a `public/file-viewer/` (carpeta de la app original de file-viewer).
Pero nuestro proyecto Electron usa `renderer/file-viewer-assets/` (ver `shared/file-viewer.js:455`
y `scripts/setup-file-viewer.js`). El duplicado en `public/` no se usa, pesa 176.84 MB, y
queda como 2910 archivos untracked que el `.gitignore` del subdir no cubría.

**Fix aplicado** (commit `aa3a7e32`, 📦629):
- `sgsst-electron-app/.gitignore`: agregar `public/file-viewer/` y `docs/`
- `public/file-viewer/` (176.84 MB) → papelera con `mavis-trash`

**Regla para futuro**:
- Si VS Code reporta >100 untracked, **asumí .gitignore gap primero**, NO display bug
- Después de correr `copy-assets.mjs`, **verificar** con `git ls-files --others --exclude-standard | wc -l`
- Diagnosticar con `git ls-files --others --exclude-standard` (canta la verdad), NO solo `git status` (agrupa por dir)
- Si aparecen 2900+ untracked justo después de un upgrade de file-viewer, es ESTO

---

1. 🔐 **URGENTE**: rotar `GH_TOKEN` (sigue expuesto en respuestas anteriores)
2. Probar auto-update end-to-end: instalar v0.1.136 manual, bumpear a v0.1.137 trivial con `.\scripts\release.ps1`
3. **Bug pre-existente `.gitignore`**: `test-*.js` ignora `main/test-fixes-loop48.js` (161 tests) y `main/test-profesiograma-*.js` (189 tests). Fix: cambiar regla a `test-tmp-*.js`. **Commit aparte** porque toca `.gitignore`.
4. **Backlog K+AIR**:
   - Optimizar python-embed: pymupdf → pypdfium2, strip `__pycache__`
   - asar + asarUnpack bien configurado (F3.C puede meter assets)
   - Bandeja Integrada v2: drag&drop archivos al compose, undo, snooze
   - F3.C ya hecho (sync bidireccional) — falta polish
5. **Layout Bandeja Integrada — Pasos 3, 4, 5**:
   - Paso 3: detalle del correo con header sticky + footer fijo
   - Paso 4: calendar slide con scroll interno
   - Paso 5: resize handler en renderer.js para ajustar iframe al cambiar tamaño

## 🆕 Ciclo Laboral 1.0 cerrado en Gestión Humana (📦767 + fix, v0.1.191, 2026-08-31)

A partir de **v0.1.191** el submódulo de Base Personal (Gestión Humana) tiene el **ciclo laboral completo del bp** cerrado: ACTIVO → RETIRADO → ACTIVO (vía REINGRESO o RECONTRATACION), con eventos transaccionales en `gh_eventos_personal` y barrera en backend, import y frontend. **Esta es la única fuente de verdad para reglas de transición de ciclo. Si una futura sesión de AI tiene que tocar algo de esto, léase esta sección primero.**

### Arquitectura de las 4 transiciones atómicas

| Handler | Transición | Tabla afectada | Evento generado | Atomicidad |
|---|---|---|---|---|
| `gh:cambiar-estado` (estado=retirado) | ACTIVO → RETIRADO | UPDATE `estado='retirado', fecha_retiro=...` | `RETIRO` en `gh_eventos_personal` | BEGIN+UPDATE+INSERT+COMMIT (ROLLBACK ante error) |
| `gh:cambiar-estado` (estado=activo) | RETIRADO → ACTIVO | UPDATE `estado='activo', fecha_retiro=NULL` | `REINGRESO` en `gh_eventos_personal` | BEGIN+UPDATE+INSERT+COMMIT |
| `gh:recontratar-personal` | RETIRADO → ACTIVO + nueva CT | UPDATE bp + INSERT `contrataciones` + UPDATE vincula | `RECONTRATACION` en `gh_eventos_personal` (con `contratacion_id`) | BEGIN+INSERT+UPDATE+UPDATE+INSERT+COMMIT |
| `gh:delete-personal` | (ninguna de ciclo) | UPDATE `activo=0` | (ninguno) | atómico pero NO genera evento |

### REGLA DE ORO (no violar en futuras sesiones de AI)

**`gh:cambiar-estado` es la ÚNICA autoridad para RETIRO y REINGRESO.**
**`gh:recontratar-personal` es la ÚNICA autoridad para RECONTRATACION.**

`gh:update-personal` **NO puede** modificar:
- `estado` (ciclo) — bridge rechaza con `PROTECTED_FIELD`
- `fechaRetiro` (ciclo) — bridge rechaza con `PROTECTED_FIELD`
- `fechaIngreso` (ciclo) — bridge rechaza con `PROTECTED_FIELD`

El rechazo es **atómico**: si llega un campo protegido junto a campos válidos (`cargo`, `salario`, `email`, etc.), no se aplica NADA. Rollback completo. Esto evita que un payload mixto actualice parcialmente la BD.

### Defensa en 3 capas

1. **Bridge (`main/gestion-humana-bridge.js`)**: autoridad. Rechaza en backend.
2. **Frontend (`modules/gestion-humana/base-personal/index.js`)**: UX. `_saveDetailEdit` filtra `PROTECTED_FIELDS`. Tab "Datos Laborales" muestra los 3 campos como read-only.
3. **Import (`gh:import-personal`)**: la politica estricta CASE WHEN. No pisa `fecha_retiro` ni `estado retirado` de bp existente.

### Reglas de import (crítico, fácil de romper)

| Campo del bp existente | Valor en Excel | Acción del import-update |
|---|---|---|
| `estado = retirado` | (cualquier) | **CONSERVAR** (no pisar) |
| `estado = activo` | (cualquier) | Actualizar (revisión administrativa legítima) |
| `fecha_ingreso` con valor | (cualquier) | **CONSERVAR** |
| `fecha_ingreso` NULL | nueva fecha | **COMPLETAR** (excepción permitida) |
| `fecha_retiro` con valor | (cualquier) | **CONSERVAR SIEMPRE** (incluso si Excel trae otra fecha) |
| `fecha_retiro` NULL | nueva fecha | **NO COMPLETAR** (preservar NULL) |
| bp activo + `fechaRetiro` en Excel | (cualquier) | **REPORTAR WARNING** (no asignar, no abortar la fila) |

### Estructura de `gh_eventos_personal`

- **12 columnas**: id (prefijo `ev-`), empresa_id, trabajador_id, tipo_evento, fecha_evento, estado_anterior, estado_nuevo, fecha_referencia, contratacion_id, metadata (JSON), usuario_id, created_at.
- **3 tipos**: RETIRO, REINGRESO, RECONTRATACION.
- **4 CHECK constraints** que validan coherencia (ej. RETIRO requiere `estado_anterior<>'retirado' AND estado_nuevo='retirado'`; RECONTRATACION requiere `contratacion_id IS NOT NULL`; REINGRESO/RECONTRATACION requieren `fecha_referencia IS NOT NULL`).
- **4 índices** para performance.
- **2 FKs**: empresa_id y trabajador_id.

### Tests E2E (153 asserts distribuidos en 3 archivos)

- `test-gestion-humana-bridge-e2e.js` (137 asserts): 11 escenarios base (T1-T11) + 8 de protección (T12-T19).
- `test-gestion-humana-bridge-import.js` (67 asserts): 11 escenarios base + 6 de política estricta (T20-T25).
- `test-gestion-humana-bridge-schema.js` (154 asserts): schema, índices, FKs, conteo de handlers.

### Flujo de UI correcto (lo que debe hacer el user)

1. **Retirar**: Base Personal → Trabajador → botón "Retirar trabajador" (visible si `estado=activo`) → confirma → backend ejecuta `gh:cambiar-estado` → se genera evento RETIRO.
2. **Reingresar**: Base Personal → Trabajador → botón "Reingresar" (visible si `estado=retirado`) → confirma → backend ejecuta `gh:cambiar-estado` → se genera evento REINGRESO.
3. **Recontratar**: Gestión Humana → Contrataciones → Nueva contratación → al escribir la cédula de un bp retirado aparece el modal "¿Recontratar?" con 4 opciones (Reingresar / Recontratar / Corregir cédula / Cancelar).

### BP de evidencia histórico

`bp-mthobzc0-uvkk` (CC 9999999999) es el bp que el user creó durante la prueba manual que descubrió el bypass. Tiene `estado=retirado, activo=1, fecha_retiro=NULL` y NO tiene evento RETIRO. Es la **evidencia** de que el bypass existió y fue cerrado. **No tocarlo a menos que se decida explícitamente restaurarlo u ocultarlo.**

### Auditoría de regresiones

Antes de cualquier cambio futuro que toque estos handlers, ejecutar:
- `node main/test-gestion-humana-bridge-e2e.js` (debe dar 137 OK)
- `node main/test-gestion-humana-bridge-import.js` (debe dar 67 OK)
- `node main/test-gestion-humana-bridge-schema.js` (debe dar 154 OK)

Si alguno da FAIL, parar y revisar antes de commitear. Los 2 fails preexistentes en `test-gestion-humana-bridge-write-extra.js` y `test-gestion-humana-bridge-newtables.js` son histórico y NO son de este módulo.

### Lo que NO se debe hacer

- ❌ NO agregar `estado`, `fechaRetiro` o `fechaIngreso` al whitelist de `_handlerUpdatePersonal` (re-abre el bypass)
- ❌ NO permitir `data.fechaRetiro` en `_handlerCreatePersonal`
- ❌ NO quitar los `CASE WHEN` de `gh:import-personal` (re-abre el bypass en import)
- ❌ NO quitar el filtro `PROTECTED_FIELDS` de `_saveDetailEdit` en el frontend
- ❌ NO restaurar `_openEditModal` (código muerto, pero si alguien lo reactiva sin filtro, es un bypass)
- ❌ NO borrar la tabla `gh_eventos_personal` ni los CHECK constraints
- ❌ NO usar `gh:update-personal` para transiciones de ciclo (es el bypass original)

---

## 🆕 Cascada CSS: fugas globales y blindaje por módulo (📦746, 2026-09-16)

### El problema

Los CSS de varios módulos se cargan **globalmente** en `index.html` y declaran clases **sin scope** (`.kair-card`, `.kair-kpi`, `.kair-chart`, `.kair-legend`, etc.). Esas reglas filtran propiedades a módulos que no las definen, y **ganan la cascada** porque el módulo destino **no declara esas propiedades** (la especificidad solo compite por propiedad declarada, no por regla completa).

Síntoma real en Inducciones: las KPI cards salían **centradas** (en vez de alineadas a la izquierda), las barras de progreso **invisibles** (el contenedor se encogía a ancho 0), y los gráficos **cortados** (labels del eje X recortados + SVG estirado).

### Fuentes que fugan (cargadas en `index.html` head)

| Archivo | Clases globales | Propiedades que fugan |
|---------|-----------------|----------------------|
| `shared/kair-components.css` | `.kair-card`, `.kair-chart`, `.kair-chart svg`, `.kair-legend` | `height:clamp(130px,13vw,170px)`, `position:absolute;inset:0`, `padding`, `border-bottom`, `background` |
| `modules/verificacion/revision-alta-direccion/revision-alta-direccion.css` | `.kair-kpi*`, `.kair-card*`, `.kair-tabs`, `.kair-toolbar` | `align-items:center`, `white-space:nowrap`, `overflow:hidden`, `padding`, `border-bottom`, `flex-wrap` |
| `modules/gestion-peligros/inspecciones/inspeccion.css` | `.kair-card`, `.kair-card__body`, `.kair-select` | `padding`, `width:100%` |
| `frecuencia/severidad-accidentalidad.css` (cargados dinámicamente por `renderer.js`) | `.kair-kpi`, `.kair-card` | `align-items:center`, `text-align:center`, `margin-bottom` |

### Cómo diagnosticar una fuga

```bash
# 1. ¿Quién define la clase SIN scope?
rg -n "^\.kair-card[ ,{]" --glob "*.css" | Where-Object { $_ -notmatch "inducciones" }
# 2. ¿Qué CSS se carga siempre?
rg -n "\.css" index.html
# 3. ¿El módulo realmente usa la clase que voy a tocar?
rg -n "<clase>" modules/<ruta>/ -g "*.js" -g "*.html"
```

### Fix aplicado (patrón de blindaje)

1. **Blindaje en el módulo destino** (`modules/recursos/inducciones/inducciones-view.css`, bloque `BLINDAJE anti-fugas` al final): declarar **explícitamente** las propiedades que fugan, para que ganen por especificidad (2 clases vs 1). Cubre `overflow`, `margin-bottom`, `padding`, `border-bottom`, `flex-wrap`, `height`, `position`, `inset`, `align-items`, `text-align`, `white-space`.
2. **Limpieza de dead code** en `revision-alta-direccion.css`: el módulo usa **solo** `.kair-rad-*`; se eliminaron las reglas globales `.kair-kpi*` y `.kair-card*` (verificado con `rg` que ningún JS/HTML del módulo las usa y que otros módulos tienen las suyas propias).

### Reglas para futuros módulos

- **Siempre** scopear las clases nuevas bajo el contenedor del módulo (`.inducciones-container`, `.kair-rad-*`, etc.).
- **Nunca** declarar `.kair-card`, `.kair-kpi`, `.kair-chart`, `.kair-legend`, `.kair-tabs`, `.kair-toolbar` sin scope — son nombres genéricos compartidos.
- Si un módulo sufre un desajuste visual inexplicable (centrados, recortes, alturas fijas, padding doble), **sospechar primero de una fuga global** y aplicar el patrón de blindaje.
- Al eliminar reglas "muertas", verificar con `rg` que el módulo no las use **y** que las clases estén cubiertas en `shared/` o en el CSS propio de cada módulo que las use.

### Cache-bust Inducciones

Token actual: `INDUCCIONES-20260915-v21-chart-scope-fix`. Bumpear en 4 lugares:
- `modules/recursos/inducciones/inducciones-view.html` (línea 1, `<link>`)
- `modules/recursos/inducciones/inducciones-logic.js` (`INDUC_TOKEN`)
- `index.html` (2 `<script>` tags)
- `main/test-inducciones-premium-v2.js` (3 checks)

Test: `node main/test-inducciones-premium-v2.js` → debe dar **87 OK**.

---

## 🆕 Bandeja Integrada · Sincronización con Gmail (📦747-748, 2026-09-16)

### Modelo de tokens (DOS conceptos, no confundir)

| Concepto | Significado | Dónde vive | Se usa para |
|----------|-------------|-----------|-------------|
| `connected` | Hay cuenta vinculada (tokens guardados) | `config.json` → `googleOAuth` | Mostrar el **cache real** de correos (no mocks) |
| `tokenValid` | Los tokens funcionan AHORA (refresh OK) | `config.json` → `googleOAuth` | Permitir **sincronizar** |
| `needsReauth` | Hay cuenta pero los tokens ya no sirven | derivado (`connected && !tokenValid`) | Mostrar "Sesión expirada · Reconectar" |

**Regla de oro**: `state.gmailConnected` = "hay cuenta" (carga el cache). `state.gmailTokenValid` = "puedo sincronizar". **NUNCA** usar `connected` para decidir si sincronizar, ni `tokenValid` para decidir si mostrar el cache (si no, se ven correos demo de `renderer/bandeja-integrada/data.js`).

**Fuente de verdad de tokens**: `config.json` → `googleOAuth` (vía `shared/google-tokens.js`). La tabla `email_connections` (SQLite) guarda SOLO metadata (`id`, `email`, `provider`) — `saveConnection()` siempre escribe `access_token: null, refresh_token: null`. No buscar tokens ahí.

### Gmail API — Rate limiter (cuello de botella real)

`shared/google-gmail.js` tiene un **token bucket global** (`GmailRateLimiter`):
- **40 req/min** (era 20). Gmail permite 250 units/user/min; `messages.get` cuesta 5 units → 50/min es el tope seguro.
- **El sync pide 1 request por mensaje** (detalle `format:'full'`), así que el tiempo ≈ `N correos / 40` minutos.
- **`email-sync.js` usa `maxTotalResults: 25`** (era 500 → ~25 min, parecía colgado; luego 50). 25 alcanza para poblar la lista.
- **Nunca** subir `maxTotalResults` sin subir el rate limiter proporcionalmente.

### Anti-cuelgue (timeouts obligatorios)

| Capa | Timeout | Archivo |
|------|---------|---------|
| Refresh de token (red a Google) | 10s (`_withTimeout`) | `shared/google-auth.js` |
| Callback server OAuth | 5 min + `server.on('error')` para EADDRINUSE | `shared/google-auth.js` |
| IPC `email-cache:sync-inbox` | 120s (`Promise.race`) | `main.js` |
| Guard anti-apilamiento | `_syncInFlight` | `renderer/bandeja-integrada/app.js` |

**Por qué**: sin el guard, el auto-refresh (cada 1 min) lanzaba un sync nuevo cada minuto y se apilaban en la cola del rate limiter → **ninguno terminaba**. Sin el timeout del IPC, la UI quedaba en skeleton infinito.

### Logs del proceso principal

Los `console.log` de `main/` van a la **terminal** (no a DevTools). Para verlos en el renderer, `email-sync.js` acepta `options.log` y `main.js` le pasa `sendLog`. Los `[email-sync] syncInbox inicio/listInbox OK/FIN` ahora aparecen en DevTools con tiempos.

### Diagnóstico rápido

```bash
# Estado de tokens (sin exponer secretos)
node -e 'const os=require("os"),p=require("path"),f=require("fs");const c=JSON.parse(f.readFileSync(p.join(os.homedir(),"AppData","Roaming","sgsst-electron-app","config.json"),"utf8"));const t=c.googleOAuth||{};console.log("access:",!!t.access_token,"refresh:",!!t.refresh_token,"expiry:",t.expiry_date,"now:",Date.now());'
# Cache de correos
node -e 'const os=require("os"),p=require("path"),{DatabaseSync}=require("node:sqlite");const db=new DatabaseSync(p.join(os.homedir(),"AppData","Roaming","sgsst-electron-app","kair.db"),{readOnly:true});console.log(db.prepare("SELECT folder, COUNT(*) c FROM email_threads GROUP BY folder").all());'
```

Nota: `better-sqlite3` está compilado para Electron → usar `node:sqlite` (nativo) para inspeccionar la DB con Node plano.

---

## 🆕 Dashboard Principal · Premium v2 (📦748, 2026-09-16)

El **Panel de Control** (dashboard de empresa, `renderDashboard` en `renderer.js`) fue migrado al estilo **premium v2** (mismo sistema que los homes de módulo y que la referencia `kair-dashboard.html`).

### Estructura (de arriba hacia abajo)
```
.kair-dashboard            ← contenedor (scroll interno, tokens premium)
  .kair-page
    nav > .kair-breadcrumb
    .kair-topbar           ← .kair-module-id (icono + "Panel de Control") + acciones (chip empresa + Actualizar)
    .kair-dash-top          ← 📦840 wrapper. En ventana el hero esta OCULTO y las 4 cards
                              toman todo el ancho en 4 columnas; desde 1400px el hero
                              aparece al lado (1fr / 2.15fr). CSS no puede detectar
                              "maximizado", solo el ancho.
      .kair-hero            ← Estado General: #hero-title, #hero-sub, #hero-pct, #hero-meter
      .kair-grid-kpis #kpi-slot      ← 4 .kair-kpi (render JS)
    .kair-card .kair-mod-grid #mod-grid   ← 7 .kair-mod (render JS)
    .kair-card #sec-radar
      #tasks-panel-header  ← título + .kair-seg #seg-filtros (Todos/Críticos/Hoy)
      .kair-task-grid #tasks-container   ← .kair-task (render JS)
      .kair-empty #task-empty
  .kair-toasts #dash-toasts
```

### CSS
Todo el CSS vive en **`shared/kair-premium.css`**, **scoped bajo `.kair-premium`** para no filtrar al resto de la app (lección de la cascada CSS). Los tokens `--kair-*` vienen de `shared/kair-design-tokens.css`.

> ⚠️ Antes este bloque decía `styles.css` + scope `.kair-dashboard`. Eso quedó obsoleto: `styles.css` ya no contiene reglas de dashboard y el scope real es `.kair-premium`. Verificado el 2026-10-02 contra `shared/kair-premium.css` y el `<link>` de `index.html`.

**Regla**: nunca agregar reglas `.kair-hero`, `.kair-kpi`, `.kair-mod`, `.kair-task`, `.kair-seg` sin el prefijo `.kair-premium`.

### Funciones JS (top-level en `renderer.js`)
| Función | Rol |
|---------|-----|
| `loadDashboardData()` | Llama a `getDashboardSummary` y orquesta los renders |
| `renderDashHero(data)` | Título humanizado + `%` frentes críticos + meter |
| `renderDashKpis(data)` | 4 `.kair-kpi` desde `data.kpis` |
| `renderDashModules(data)` | 7 `.kair-mod` con chips de estado (IDs `module-badge-<name>`) |
| `renderTasks(tasks)` | `.kair-task` con chip de severidad (`critical`→rojo, `warning`/`warn`→ámbar, resto→azul) |
| `updateModuleBadges(status, rec, salud)` | Pinta los chips de cada `.kair-mod` |
| `updateModuleSelection(name)` | Marca `.kair-mod.is-active` |
| `updateFilterUI(moduleName, count)` | Conteos del `.kair-seg` + subtítulo del radar |
| `filterDashboardTasksByModule(name)` | Filtra tareas por módulo (click en `.kair-mod`) |
| `navigateToModule(mod, sub)` | Navega al submódulo (click en `.kair-task`) |

### Datos reales (`getDashboardSummary`)
```js
{ success, data: {
    kpis: { accidents_year, pric_active, overdue_docs, compliance,
            recursos_alerts, gestion_salud_alerts },
    tasks: [{ priority, module, submodule, title, desc, icon }],
    module_status: { recursos: 'ok'|'warning'|'danger', ... }
} }
```

### Cache-bust
En `index.html`:
- `styles.css?v=20260916-dashboard-premium`
- `renderer.js?v=20260916-dashboard-premium` (⚠️ `renderer.js` **no tenía token** antes — se le agregó)

### Lección: parchear funciones grandes con un script Node
Para reescribir funciones de >50 líneas en `renderer.js` (7000+ líneas), usar un script Node con un helper `replaceFunction(src, signature, newCode)` que:
1. Busca la firma exacta (`function foo(...)`).
2. Encuentra la `{` de apertura.
3. Cuenta llaves hasta el cierre balanceado.
4. Reemplaza el bloque completo.

Validar con `new Function(src)` ANTES de escribir, y luego `node --check renderer.js`. Fue más confiable que el edit tool para bloques de ~80 líneas.

---

## 🆕 Playbook · Migrar un submódulo al estilo premium (📦749, 2026-09-16)

### Sistema oficial: `shared/kair-premium.css` (scoped bajo `.kair-premium`)

El **"dialecto premium"** (hero, KPI cards, chips, tasks, modules, segmented) vive en **`shared/kair-premium.css`** y está scopado bajo `.kair-premium`. Para usarlo, agregar `class="kair-premium"` al wrapper raíz del módulo/submódulo.

```html
<div class="inducciones-container kair-premium">   <!-- o .kair-dashboard kair-premium -->
```

El archivo se carga globalmente en `index.html` (junto a `kair-design-tokens.css` y `kair-components.css`).

### Componentes disponibles

| Clase | Qué es |
|-------|--------|
| `.kair-page` | contenedor de página (padding + ancho fluido) |
| `.kair-breadcrumb` | ruta de navegación |
| `.kair-topbar` + `.kair-module-id` (`__icon/__title/__desc`) | encabezado del módulo |
| `.kair-chip` (+ `--soft-green/amber/red/slate/blue`, `--sm`) | pills de estado |
| `.kair-btn` (+ `--primary/outline/ghost`) | botones |
| `.kair-seg` (+ `__n`) | control segmentado (filtros) |
| `.kair-grid-kpis` | grid de 4 columnas para KPI |
| `.kair-hero` (+ `__label/__row/__title/__sub/__cta/__aside/__pct/__pct-label/__meter/__meter-fill`) | panel navy "Estado General" |
| `.kair-kpi` (+ `__top/__label/__icon/__value/__sub/__bar/__fill`) | tarjeta de KPI |
| `.kair-card` (+ `__head/__title/__sub`, `--plain`) | tarjeta de sección |
| `.kair-mod-grid` + `.kair-mod` (+ `__top/__icon/__name/__sub`, `.is-active`) | grid de módulos |
| `.kair-task-grid` + `.kair-task` (+ `--critical/--warn/--info`, `__top/__code/__title/__bottom/__icon/__desc/__arrow`) | grid de pendientes |
| `.kair-empty` (+ `__icon/__title/__sub`) | estado vacío |
| `.kair-toasts` + `.kair-toast` (+ `--success/warn/info/error`) | notificaciones |
| `.kair-boot` + `.kair-skel` | skeleton de arranque |

### Checklist de migración

1. **Agregar `kair-premium`** al wrapper raíz (junto a la clase del módulo).
2. **Estructura**: breadcrumb → topbar → `.kair-dash-top` (hero + `.kair-grid-kpis` en la misma fila) → `.kair-card` (módulos) → `.kair-card` (tareas) → toasts.
3. **Datos**: mantener el IPC/selector existente; solo cambia el render.
4. **Scopear** cualquier clase NUEVA específica del módulo bajo el wrapper (nunca global).
5. **Eliminar** las copias locales de las clases del dialecto (`.kair-hero`, `.kair-kpi`, `.kair-chip`, `.kair-task`, `.kair-mod`, `.kair-seg`) — ya están en el shared.
6. **Cache-bust**: bumpear `?v=` de `styles.css`, `renderer.js` (si aplica) y el `<script>` del módulo.
7. **Verificar**: visual en maximizada y ventana + smoke tests.

### Reglas de oro

- **Nunca** declarar `.kair-hero`, `.kair-kpi`, `.kair-chip`, `.kair-task`, `.kair-mod`, `.kair-seg` sin el prefijo `.kair-premium` (o el scope del módulo).
- **Nunca** usar `margin: 0 auto` en headers que comparten container con cards.
- Para scroll interno: `flex: 1` + `min-height: 0` en TODOS los niveles de la cadena.
- Si un módulo necesita un ajuste puntual, declararlo bajo su propio scope (`.mi-modulo .kair-kpi{...}`) — gana por orden de carga.

### Estado de migración

| Módulo | Usa `kair-premium` | Notas |
|--------|--------------------|-------|
| Dashboard principal | ✅ (📦749) | Piloto — referencia de implementación |
| Configuración | ✅ (📦751) | No usa `kair-premium`: capa propia scoped `.kair-config` + Header System v2 |
| Bandeja Integrada | ✅ (📦752) | No usa `kair-premium`: capa propia `premium.css` (tokens + remapeo legacy) + topbar/segmentado propios. Es un iframe con scope aislado |
| Perfil de Cargo y Profesiograma | ✅ (📦772) | No usa `kair-premium`: tokens premium en su `:root` propio (iframe aislado) + Header System v2 |
| Reportes de Accidentes (FURAT) | ✅ (📦773) | No usa `kair-premium`: tokens premium en su `:root` propio (iframe aislado) + Header System v2 |
| Gestión del Cambio (2.11.1) | ✅ (📦774) | No usa `kair-premium`: capa propia scoped `.gdc-scope` + tokens `--gdc-*` + Header System v2 (marcado EMBEBIDO en el `.js`, no iframe) |
| Restricciones y Remisiones (3.1.6) | ✅ (📦775-779) | No usa `kair-premium`: portal scoped `.rm-portal-scope` + Enviar (flujo completo de 3 pasos, `.remenv-scope`), Control (`.remctl-scope`) y Estadísticas (`.remstat-scope`) embebidos + visor con tokens remapeados; paleta alineada a `kair-design-tokens` |
| Investigación de Accidentes (3.2.2) | ✅ (📦780) | No usa `kair-premium`: portal scoped `.inv-portal-scope` + Realizar/Ver con Header System v2 y tokens `--inv-*` remapeados; se quitó el `<link>` global que filtraba `html`/`body`/`.k-section-card` |
| Registro y Análisis Estadístico (3.2.3) | ✅ (📦783) | No usa `kair-premium`: tokens `--k-*` remapeados a la canónica + Header System v2; se quitaron `.k-section-card`/`.header-back-btn` (clases GLOBALES) y se scopearon las reglas `.k-*`; gráficos Chart.js theme-aware |
| Frecuencia de la Accidentalidad (3.3.1) | ✅ (📦784) | No usa `kair-premium`: tokens propios `--freq-*` scoped + Header System v2; se quitó el `:root` + `*` + `body` GLOBALES y se scopearon 139 selectores; el gráfico SVG lee la paleta con `tok()` |
| Severidad de la Accidentalidad (3.3.2) | ✅ (📦785) | No usa `kair-premium`: tokens propios `--sev-*` scoped + Header System v2; se quitó el `:root` + `*` + `body` GLOBALES; 125 selectores scopados; modo oscuro en los 2 atributos (`dark` + `dark-legacy` con `[data-theme^="dark"]`); tabla blindada (`min-width:0 !important` + `table-layout:fixed`) con 7 anchos fijos que suman 100%; gráfico SVG leyendo la paleta con `tok()`/`palette()`; wrapper `.sev-duo` en paralelo (gráfico+tabla) en maximizada; meses grid 6/12; código muerto eliminado |
| Índice de Mortalidad (3.3.3) | ✅ (📦786) | No usa `kair-premium`: tokens propios `--mort-*` scoped + Header System v2; se quitó el `:root` + `*` + `body` GLOBALES; selectores scopados; modo oscuro en los 2 atributos (`dark` + `dark-legacy` con `[data-theme^="dark"]`); tabla blindada (`min-width:0 !important` + `table-layout:fixed`) con 7 anchos fijos que suman 100%; Chart.js theme-aware con gradientes dark/light; `tok()`/`palette()` en getStatusBadge/getValueColor/renderizar/renderizarTabla; resize handler con cleanup (`window.__mortResizeHandler`); código muerto eliminado (`escapeHtml`); renderer.js parcheado con TOKEN + cache-bust en 2 niveles + sanitizar `<link>` CDN; gráfico y tabla en paralelo en maximizada (`.mort-duo`, `📦786-fix`); test 46/46 |
| Prevalencia de Enfermedad Laboral (3.3.4) | ✅ (📦787) | No usa `kair-premium`: tokens propios `--prev-*` scoped + Header System v2; se quitó el `:root` + `*` + `body` GLOBALES; modo oscuro en los 2 atributos (`dark` + `dark-legacy` con `[data-theme^="dark"]`); tabla blindada (`min-width:0 !important` + `table-layout:fixed`) con 6 anchos fijos que suman 100% (12/12/16/28/10/22); Chart.js theme-aware con gradientes dark/light y `Chart.defaults`; `tok()`/`palette()` en getStatusBadge/getValueColor/renderizar/renderizarTabla/renderFallbackChart; resize handler con cleanup (`window.__prevResizeHandler`); código muerto eliminado (`escapeHtml` + 15 `console.log`); renderer.js parcheado con TOKEN + cache-bust en 2 niveles + sanitizar `<link>` CDN; gráfico y tabla en paralelo en maximizada (`.prev-duo`); test 46/46 |
| Incidencia de Enfermedad Laboral (3.3.5) | ✅ (📦788) | Módulo hermano de Prevalencia (3.3.4) — generado desde sus archivos ya migrados con renombres controlados (`prevalencia`→`incidencia`, `casosEL`→`casosNuevosEL` **case-sensitive** para no romper `totalCasosEL`, `--prev-`→`--inc-`, `__prevResizeHandler`→`__incResizeHandler`) y conservando las etiquetas propias (CASOS NUEVOS EL, Meta <5 Coordinador SST, párrafo extra de metodología, botón Reintentar). Tokens `--inc-*` scoped + Header System v2 + dark en los 2 atributos; tabla blindada con 6 anchos fijos 12/12/16/28/10/22; Chart.js theme-aware; `tok()`/`palette()`; resize con cleanup; gráfico y tabla en paralelo (`.inc-duo`); se agregaron los estilos del error (`kair-error-icon`/`kair-error-msg`/`kair-retry-btn`) que el HTML usaba y la hoja vieja no definía; código muerto eliminado; renderer.js con TOKEN + cache-bust en 2 niveles + sanitizar `<link>` CDN; test 46/46 |
| Medición del Ausentismo (3.3.6) | ✅ (📦789) | **Fase 1** (home + blindaje) + **vistas**: home premium v2 (Header v2 + SVG + dark + theme sync); blindaje de los **7 bloques `<style>`** inyectados en el `<head>` global (~684 líneas) scopados bajo `.aus-scope` (+ `:root --sp-*` → `.aus-scope`, selectores de etiqueta scopados, `@keyframes` genéricos renombrados a `aus*`); `.aus-scope` en el contenedor + los **6 nodos montados en `<body>`**; **Registrar** y **Ver Ausentismo** reescritas con clases premium + SVG (0 colores inline, 0 FA); **Seguimiento de Incapacidades** (KPIs, filtros, tabla, avatar, progress, badges) + **Estadísticas** (tokens `--aus-*` en los bloques `.k-*`/`.es-*` → dark automático); **Consulta de Trabajadores** (tokens canónicos + Header v2 + 7 SVG) y **Generar Informe** (**CDN → local** Google Fonts/FA + tokens + Header v2); **2 inyecciones de Font Awesome CDN eliminadas**; fix del panel de seguimiento (`.aus-scope.seguimiento-backdrop` — forma **self**); tests 110/110 |
| Seguimiento de Gestación (3.3.6) | ⏳ (📦790) | Home migrado: tokens `--v3-*` remapeados a la canónica + dark (2 atributos) + Header System v2 (transparente, título Manrope 800 20px, icon chip 44×44) + contraste del botón primario en oscuro. Quedan **antesala**, **mensual** y **reportes** (mismo patrón) |
| Inducciones | ⏳ | Dialecto propio en `inducciones-view.css` (scoped `.inducciones-container`) |
| Plan de Trabajo | ⏳ | Dialecto propio en `plan-view.html` |
| Otros submódulos | ⏳ | Migrar con este playbook |

### Historial

- **📦748**: Dashboard premium v2 (CSS scoped `.kair-dashboard` en `styles.css`).
- **📦749**: Extracción del dialecto a `shared/kair-premium.css` scoped `.kair-premium`; dashboard migrado como piloto; `styles.css` vuelve a su rol de estilos legacy.
- **📦751**: Configuración del Sistema migrada a premium v2 (capa scoped `.kair-config` + remapeo de tokens legacy; Header System v2 con breadcrumb + icono/título + tabs con subrayado; soporte dark/dark-legacy).
- **📦772**: Perfil de Cargo y Profesiograma (3.1.3) migrado a premium v2 (tokens premium en su `:root`; Header System v2 con breadcrumb + icono/título; tabs con subrayado azul estilo Evaluación Inicial; modo oscuro en los 2 atributos; `destroy()` + cache-bust).
- **📦773**: Reportes de Accidentes (3.2.1 · FURAT) migrado a premium v2 (tokens `--furat-*` remapeados en su `:root`; Header System v2; tabs con subrayado; modo oscuro cubriendo `dark` y `dark-legacy` con `[data-theme^="dark"]`; reset scoped; cache-bust triple).
- **📦774**: Gestión del Cambio (2.11.1) migrado a premium v2: de 6 archivos (logic + 2 css + html + viewer + index) a UN solo par CSS+JS con el marcado embebido; capa scoped `.gdc-scope` + tokens `--gdc-*`; overlays al `<body>` envueltos en `.gdc-scope`; vigía `MutationObserver` + `destroy()`; se conservó exacto el contrato de datos Excel (4 IPC) y la máquina de estados.
- **📦775**: Restricciones y Remisiones (3.1.6) — segunda pasada premium: portal del módulo migrado a premium y **scoped** (`.rm-portal-scope`, se corrigió la fuga de `:root`/`*` al inyectarse con `innerHTML`), visor (`remisiones-view.css`) e informe (`generar-informe-remision.css`) con tokens remapeados a premium + dark en el informe, header del informe alineado con el cuerpo, limpieza de 9 archivos muertos y ~600 líneas huérfanas; el test subió a 62 checks.
- **📦776**: Restricciones y Remisiones (3.1.6) — el flujo de **Enviar Remisión** ahora es UNO SOLO: los 3 pasos (Cargar PDF → Generar informe oficial → Enviar a la EPS) viven dentro del componente premium `enviar-remision-v2` (antes el paso 1 saltaba a la página vieja `generar-informe-remision.html` y a un modal de envío aparte, con otro diseño). El paso 3 trae **vista previa del informe** (nombre del documento + resumen + botón "Ver informe" que abre el visor) y un botón **Cancelar** con confirmación que reinicia el flujo sin borrar nada. Se borraron la página del informe, el modal de envío, `env-modal.css` y ~390 líneas más del `logic.js` (métodos + handlers del bridge viejo).
- **📦777**: Restricciones y Remisiones (3.1.6) — **alineación de la paleta** de `enviar-remision-v2.css` y `control-remisiones-v2.css` a la canónica de la app (`shared/kair-design-tokens.css`, la de Recursos / Gestión Integral). Traían una paleta propia (`#2456d6` azul, `#eef1f7` fondo, `#e3e8f2` borde, `Segoe UI`, radio 14px) que se veía distinta; ahora usan `#2057b8` / `#fbfcfb` / `#e8ebee` / `DM Sans` + `Manrope` / radio 20px, y el modo oscuro `#0f172a` / `#1a2334` / `#6ea8fe`.
- **📦778**: Control de Remisiones (3.1.6) — el Excel real `GI-FO-012` trae **encabezados repetidos y filas vacías** en el medio; el backend las contaba como registros (18 en vez de 8). Ahora `get-control-remisiones-data` **descarta filas vacías y encabezados repetidos** y devuelve **`rowNumbers`** (nº de fila real) para que el guardado por celda A1 no se desalinee.
- **📦779**: Estadísticas de Remisiones (3.1.6) — nueva sección que **deriva métricas del Control** (KPIs + 6 gráficos: sexo, tipo de evaluación, rango de edad, concepto médico, top cargos y estado civil), con normalización de valores inconsistentes del Excel y el mismo dialecto premium v2.
- **📦780**: Investigación de Accidentes e Incidentes (3.2.2) — las 3 vistas (portal + Realizar + Ver) al premium v2; se quitó el `<link>` **global** que filtraba `html`/`body`/`.k-section-card` a toda la app; Header System v2, tokens canónicos, `[data-theme^="dark"]` y cache-bust de los iframes.
- **📦781**: Investigación de Accidentes (3.2.2) — "Ver Investigaciones" ahora aprovecha **todo el ancho** en maximizada (`.inv-body` sin `max-width:1200px` centrado); buscador con tope (`clamp`) y toggle de vista al extremo derecho.
- **📦782**: Investigación de Accidentes (3.2.2) — la vista de LISTA pasa a **2 columnas** en maximizada (`@media (min-width:1360px)`, `repeat(2, minmax(0,1fr))`); la cuadrícula no se toca; el estado vacío y el esqueleto llevan `grid-column: 1 / -1`.
- **📦783**: Registro y Análisis Estadístico (3.2.3) migrado a premium v2 — Header System v2, tokens `--k-*` remapeados a la canónica, scoping total del CSS (se quitaron las clases GLOBALES `.k-section-card`/`.header-back-btn`), modo oscuro en los DOS atributos, chips con `color-mix` y los 9 gráficos Chart.js con colores de tema.
- **📦784**: Frecuencia de la Accidentalidad (3.3.1) migrada a premium v2 — Header System v2, tokens propios `--freq-*` scoped (se quitó el `:root` + `*` + `body` GLOBALES que pisaban tokens y márgenes de TODA la app), 139 selectores scopados, modo oscuro en los DOS atributos y el gráfico SVG leyendo la paleta con `tok()`.
- **📦785**: Severidad de la Accidentalidad (3.3.2) migrada a premium v2 — Header System v2, tokens propios `--sev-*` scoped (se quitó el `:root` + `*` + `body` GLOBALES que pisaban tokens y márgenes de TODA la app), 125 selectores scopados, modo oscuro en los DOS atributos (`dark` + `dark-legacy` con `[data-theme^="dark"]`), tabla con blindaje (`min-width:0 !important` + `table-layout:fixed`) y 7 anchos fijos que suman 100%, gráfico SVG leyendo la paleta con `tok()`/`palette()`, wrapper `.sev-duo` en paralelo (gráfico+tabla) en maximizada, meses grid 6/12, código muerto eliminado (`buildGridLines`/`buildChartPoints`/`escapeHtml`), renderer.js parcheado con TOKEN + cache-bust en 2 niveles + sanitizar `<link>` CDN, test 21/21, EOL normalizado a LF.
- **📦786**: Índice de Mortalidad (3.3.3) migrada a premium v2 — Header System v2, tokens propios `--mort-*` scoped (se quitó el `:root` + `*` + `body` GLOBALES que pisaban tokens y márgenes de TODA la app), selectores scopados, modo oscuro en los DOS atributos (`dark` + `dark-legacy` con `[data-theme^="dark"]`), tabla con blindaje (`min-width:0 !important` + `table-layout:fixed`) y 7 anchos fijos que suman 100%, Chart.js theme-aware con gradientes dark/light y Chart.defaults, `tok()`/`palette()` en getStatusBadge/getValueColor/renderizar/renderizarTabla, resize handler con cleanup (`window.__mortResizeHandler`), código muerto eliminado (`escapeHtml`), renderer.js parcheado con TOKEN `MORT-20260919-v1-premium` + cache-bust en 2 niveles + sanitizar `<link>` CDN, test 38/38, EOL normalizado a LF.
- **📦786-fix**: Índice de Mortalidad (3.3.3) — el gráfico y la tabla ahora van **en paralelo en maximizada**, igual que Frecuencia (3.3.1) y Severidad (3.3.2). Se envolvieron `#chartSection` + `#tableSection` en un `<div class="mort-duo">` con el mismo tratamiento que `.freq-duo`/`.sev-duo`: `grid-template-columns: 1fr` por defecto y `minmax(0,1fr) minmax(0,1fr)` en `@media (min-width:1360px)`, con las 2 tarjetas `display:flex; flex-direction:column` para que se estiren al MISMO alto (el de la tabla) y el `.kair-chart-container` `flex:1; min-height:0` para que el canvas (Chart.js `responsive:true` + `maintainAspectRatio:false`) ocupe el espacio libre sin deformarse. 🚨 **La trampa de este módulo (que NO tienen Frecuencia ni Severidad)**: el JS hacía `chartSection.style.display = 'block'` / `tableSection.style.display = 'block'` con **estilo EN LÍNEA**, y el estilo en línea le gana al CSS → el `display:flex` de la media query nunca aplicaba. Fix: el JS ahora pone `display = ''` (quita la propiedad del estilo en línea; las `<section>` vuelven a su `block` por defecto) y el CSS decide el display. **Regla**: si un módulo fija `display` con `style.display = '...'`, cualquier layout que necesite otro `display` (flex/grid) tiene que quitarse esa propiedad primero, o el CSS pierde. Cache-bust en 2 niveles (`MORT-20260919-v2-duo` + `renderer.js?v=20260919-mortalidad-duo`), test 46/46 (8 checks nuevos: wrapper del duo, grid 1/2 columnas, tarjetas flex, chart container flex:1 y que el JS no fije display en línea). **Medido con arnés real de Electron**: maximizada (inner 1904) → `cols 690px 690px`, chart y table 580×580, lado a lado, sin desborde; ventana normal (inner 1184) → `cols 1113px` (1 columna), apiladas, sin desborde.
- **📦787**: Prevalencia de Enfermedad Laboral (3.3.4) migrada a premium v2 — Header System v2 (breadcrumb + icon chip + título Manrope 800 + subtítulo + acciones con SVG inline), tokens propios `--prev-*` scoped (se quitó el `:root` + `*` + `body` GLOBALES que pisaban tokens y márgenes de TODA la app), modo oscuro en los DOS atributos (`dark` + `dark-legacy` con `[data-theme^="dark"]`), tabla blindada (`min-width:0 !important` + `max-width:100% !important` + `table-layout:fixed`) con **6 anchos fijos que suman 100%** (Mes 12 / Casos EL 12 / Trabajadores 16 / Prevalencia 28 / Meta 10 / Estado 22), Chart.js theme-aware (gradientes, los 4 plugins metaZone/barLabels/promedioLine/metaLine, `Chart.defaults` y tooltip/ejes leyendo la paleta con `tok()`/`palette()`), `tok()`/`palette()` en getStatusBadge/getValueColor/renderizar/renderizarTabla/renderFallbackChart, resize handler con cleanup (`window.__prevResizeHandler`, `removeEventListener` del anterior), **gráfico y tabla en paralelo en maximizada** (`.prev-duo` con el mismo patrón que `.freq-duo`/`.sev-duo`/`.mort-duo` y el `display = ''` en el JS para que el estilo en línea no pise el `flex`), iconos en **SVG inline** (se quitó el CDN de Bootstrap Icons y los `<i class="bi ...">` que nunca renderizaban porque el `<link>` del `<head>` se descarta al inyectar solo `doc.body`), código muerto eliminado (`escapeHtml` + 15 `console.log` de ruido, 2 convertidos a `console.error`), renderer.js parcheado con TOKEN `PREV-20260919-v1-premium` + cache-bust en 2 niveles + sanitizar `<link>` CDN, test 46/46, EOL normalizado a LF. **Medido con arnés real de Electron**: ventana normal (inner 1184) → `cols 1113px` (1 columna), apiladas; maximizada (inner 1904) → `cols 690px 690px`, chart y table 604×604, lado a lado, **0 celdas recortadas**, tabla sin desborde; `dark` y `dark-legacy` → idénticos (`#0f172a` / `#1a2334` / `#e8edf5`).
- **📦788**: Incidencia de Enfermedad Laboral (3.3.5) migrada a premium v2. Es **módulo hermano** de Prevalencia (3.3.4): los archivos originales eran **idénticos salvo renombres**, así que el CSS y el JS se **generaron desde los de Prevalencia ya migrados** con renombres controlados (script `_gen-incidencia.js`), y el HTML se escribió a mano para conservar sus etiquetas propias. Renombres: `prevalencia`→`incidencia`, `Prevalencia`→`Incidencia`, `PREVALENCIA`→`INCIDENCIA`, `PREV-`→`INC-`, `prev-`→`inc-`, `__prevResizeHandler`→`__incResizeHandler`, `prevSlideIn`→`incSlideIn`, `Submódulo 3.3.4`→`3.3.5`. 🚨 **La trampa del renombre masivo**: `casosEL`→`casosNuevosEL` tiene que ser **case-sensitive**; un `-replace` de PowerShell (que es case-INsensitive por defecto) convierte también `totalCasosEL` en `totalcasosNuevosEL` y rompe los totales. Con `String.split().join()` de Node (case-sensitive) `totalCasosEL` no se toca (tiene `C` mayúscula). **Regla**: al clonar un módulo hermano por renombre, usar reemplazos case-sensitive y verificar explícitamente que las variables que COMPARTEN substring (`casosEL` vs `totalCasosEL`) sobrevivan. Se conservaron las diferencias reales de Incidencia: KPI "CASOS NUEVOS EL (AÑO)", Meta "<5 (Coordinador SST)", el párrafo extra `<strong>Meta:</strong>` de la metodología, el `<strong>Interpretación</strong>` con "nuevos casos" y la sección de error con icono + mensaje + botón **Reintentar**. Se **agregaron a la hoja** los estilos del error (`.kair-error-icon`, `.kair-error-msg`, `.kair-retry-btn`) que el HTML usaba y la hoja vieja **no definía** (salían sin estilo). Todo lo demás igual que 📦787: tokens `--inc-*` scoped, Header System v2 con SVG inline (se quitó el CDN de Bootstrap Icons), dark en los 2 atributos, tabla blindada con 6 anchos fijos 12/12/16/28/10/22, Chart.js theme-aware (gradientes + 4 plugins + `Chart.defaults`), `tok()`/`palette()` en getStatusBadge/getValueColor/renderizar/renderizarTabla/renderFallbackChart, resize con cleanup, `.inc-duo` en paralelo en maximizada (con el `display = ''` en el JS), código muerto eliminado (`escapeHtml` + 15 `console.log`, 2 a `console.error`), renderer.js con TOKEN `INC-20260919-v1-premium` + cache-bust en 2 niveles + sanitizar `<link>` CDN, test 46/46, EOL normalizado a LF. **Medido con arnés real de Electron**: ventana normal (inner 1184) → `cols 1113px` (1 columna), apiladas; maximizada (inner 1904) → `cols 690px 690px`, chart y table 619×619, lado a lado, **0 celdas recortadas**, tabla sin desborde; `dark` y `dark-legacy` → idénticos (`#0f172a` / `#1a2334` / `#e8edf5`).

- **📦789**: Medición del Ausentismo (3.3.6) migrada a premium v2 en **dos fases**. **Fase 1 (home + blindaje)**: el home (iframe) pasó a Header System v2 + paleta canónica + modo oscuro (2 atributos) + 10 iconos SVG inline (0 Font Awesome) + `initThemeSync()` (pide el tema al padre y escucha `theme-changed`, porque el iframe se crea DESPUÉS de aplicar el tema); y se **blindaron los 7 bloques `<style>`** que el componente inyectaba en el `<head>` GLOBAL (~684 líneas con `:root --sp-*`, 95 clases sin scope y selectores de etiqueta como `textarea`): todos scopados bajo `.aus-scope` con un transformador CSS propio (respeta `@keyframes` verbatim, recurre en `@media`, preserva comentarios), el `:root` movido a `.aus-scope`, y los `@keyframes` genéricos (`fadeIn`/`slideDown`/`slideUp`) renombrados a `ausFadeIn`/`ausSlideDown`/`ausSlideUp`. 🚨 **Trampa del scopeado en nodos montados en `<body>`**: como el backdrop del panel se appendea a `<body>`, se le puso `.aus-scope` A SÍ MISMO — pero los selectores `.aus-scope .seguimiento-backdrop` exigen un **ancestro**, así que NO aplicaban y el panel quedaba en `translateX(100%)` (fuera de pantalla: el usuario lo reportó como "selecciono un trabajador y no lo muestra"). Fix: variante **self** (`.aus-scope.seguimiento-backdrop`), mismo patrón de 📦761. **Vistas**: Registrar y Ver Ausentismo reescritas con clases premium + SVG (0 colores inline, 0 FA, se conservaron los 15 IDs del form y las clases de delegación); Seguimiento de Incapacidades (KPIs, filtros, tabla, avatar, progress, badges, acciones SVG) y Estadísticas (los bloques `.k-*`/`.es-*` remapeados a tokens `--aus-*` → dark automático, radios 20/12, header v2); **2 inyecciones de Font Awesome CDN eliminadas**; `_injectPremiumViewsStyles()` se llama en `render()` (antes solo en 2 vistas → Seguimiento y Estadísticas quedaban sin estilos). **Consulta de Trabajadores** (tokens canónicos + dark + Header v2 + 7 SVG) y **Generar Informe** (**CDN → local** de Google Fonts y Font Awesome → ya funciona offline, + tokens + Header v2 + contraste del botón en oscuro). Se corrigieron además 2 tests que asertaban el token **compartido** de `renderer.js` en `index.html` (Mortalidad y Prevalencia venían fallando desde 📦788). Test 110/110.
- **📦790**: Seguimiento de Gestación (3.3.6) — **home migrado** (primera de 4 vistas): tokens `--v3-*` (azul viejo `#174ea6`, familia de `auditoria-anual.css`) remapeados a la paleta canónica, radios 20/12, fuente DM Sans; bloque `[data-theme^="dark"]` con los 20 tokens oscuros; Header System v2 (transparente, título **Manrope 800 20px**, icono convertido en **chip 44×44** radio 12 blue-soft); override de contraste del botón primario en oscuro. 🚨 **Bug propio detectado con Electron**: la inserción del bloque oscuro **consumió el `}` de cierre del `:root`**, así que el bloque oscuro quedaba anidado dentro de `:root` (CSS inválido) y **no aplicaba** — se detectó midiendo `getComputedStyle` en tema oscuro (el fondo seguía claro). Quedan **antesala**, **mensual** y **reportes** (mismo patrón).
- **📦791**: 2 fixes posteriores a la migración de Ausentismo/Gestión de la Salud. **(1) Consulta de Trabajadores — icono gigante**: al reemplazar los `<i class="fas ...">` por `<svg>` inline, la regla que les daba tamaño seguía apuntando a `i` (`.ct-empty-state i { font-size: 3rem }`), así que el `<svg>` quedaba **sin ancho/alto** y se estiraba a todo el contenedor (mismo patrón de 📦762). Fix: variante `svg` en las 3 reglas que apuntaban a `i` (`.ct-empty-state`, `.ct-search-title`, `.ct-modal-header h3`) con `width/height` explícitos. **Regla**: al cambiar un `<i>` por un `<svg>`, TODA regla que lo dimensionaba por `font-size` necesita su variante `svg` con `width/height`. Se auditó con Electron midiendo TODOS los SVG de las vistas migradas (home, Registrar, Ver, Seguimiento, Estadísticas): ninguno más tenía el problema. **(2) Home de Gestión de la Salud — la gráfica "Indicadores de Salud" mostraba 0.00 en las 4 barras**: `renderChartSalud()` leía `indicadores.frecuencia`/`.severidad`/`.prevalencia`/`.incidencia`, pero `excel-bridge.leerIndicadores()` NO devuelve esos escalares — devuelve `frecuenciaMensual[]`/`severidadMensual[]` (con `indiceFrecuencia`/`indiceSeveridad` por mes) y `config.prevalenciaEL`/`config.incidenciaEL` (sumas anuales). Como los 4 campos eran `undefined`, `Number(undefined) || 0` daba 0.00. Fix: frecuencia y severidad se derivan del **promedio de los meses con valor** (mismo criterio que el KPI del módulo 3.3.1) y prevalencia/incidencia de `config.*`; se sigue aceptando el escalar si el backend lo agrega (retrocompatible). Verificado con Electron (mock con la forma real del backend): 2.00 / 15.00 / 123.45 / 67.89 (antes 0.00). Tests: `tests/gestion-salud/test-home-indicadores.js` (8/8) + `tests/ausentismo/test-premium.js` 121/121 (11 checks nuevos de Consulta/Informe).
- **📦792**: Popover **"Pendientes" (KairAlerts)** modernizado a premium v2. Es el panel flotante que se abre con la campana (`shared/kair-alerts.js`, 698 líneas) y su CSS vivía en **`styles.css`** (bloque de 334 líneas: `.kair-alerts-panel` + `.kair-alerts-popover` + `.kair-alerts-list`/`__item`/`__empty`). **Estado que tenía**: 28 colores hardcodeados (`#174ea6` azul viejo, `#dc3545` rojo viejo, `#111827`, `#1f2937`, `#f8fafc`…), **0 tokens canónicos**, radio 10px, sombras genéricas y sin las fuentes del sistema; sí tenía dark mode (32 reglas `[data-theme=...]`). **Cambios**: tokens locales **`--ka-*`** scoped bajo `.kair-alerts-panel`/`.kair-alerts-popover` mapeados a la paleta canónica + bloque `[data-theme^="dark"]` con los 15 tokens oscuros (cubre `dark` + `dark-legacy`); **60 reemplazos** de colores hardcodeados → `var(--ka-*)`; radios 10px → **20px** (tarjeta) / 12px (controles); sombra del sistema; **DM Sans** (UI) + **Manrope** (título). 🚨 **Trampa del mapeo de color por valor**: `#111827` se usaba para DOS cosas distintas — **fondo** oscuro del header/footer y **color de texto** — así que un único mapeo (`→ var(--ka-ink)`) dejó el header **claro en modo oscuro** (el color del texto como fondo). Se separó: fondo → `var(--ka-soft)`, texto → `var(--ka-ink)`. **Regla**: antes de tokenizar por valor, verificar si ese hex se usa como superficie y como texto (mapear por PROPIEDAD, no solo por valor). **Dato clave**: `shared/kair-design-tokens.css` **NO tiene variantes dark** (los `--kair-*` son solo claros), por eso el popover necesita sus propios tokens + bloque dark. Verificado con Electron en claro/`dark`/`dark-legacy` (fondo `#ffffff`/`#1a2334`, radio 20px, header `#f3f6f6`/`#1e2738`, título Manrope). Cache-bust de `styles.css` → `20260920-alerts-premium`.
---

## 🆕 Especificaciones técnicas SG-SST · ST-01 a ST-08 (📦749, 2026-09-16)

Contrato técnico de los **próximos submódulos** del SG-SST, derivado del PDF
`kair-plan-trabajo-documento-tecnico` (v1.0) y **adaptado a la arquitectura Electron** de este repo.

📄 **`docs/especificaciones-tecnicas-sg-sst-v1.md`**

Contiene: estado actual, arquitectura y patrones obligatorios (tokens, componentes `.kair-*`,
`.kair-screen`, contratos IPC `{ success, data }`, logging `[K+AIRxxx]`, definición de "hecho"),
mapa de módulos y prioridades **P1/P2/P3**, las 8 especificaciones autocontenidas y el roadmap por
fases.

**Prioridades y carpeta real en el repo:**

| ID | Submódulo | Prioridad | Carpeta |
|----|-----------|-----------|---------|
| ST-01 | Plan de Trabajo SG-SST y presupuesto | P1 | `modules/gestion-integral/plan-trabajo` (+ `modules/recursos/presupuesto`) |
| ST-02 | Comités y Actas (COPASST / Convivencia) | P1 | `modules/recursos/copasst`, `modules/recursos/comite-convivencia` |
| ST-03 | Afiliación al SSSI y vigencias | P1 | `modules/gestion-humana/afiliaciones`, `modules/gestion-humana/documentos` |
| ST-04 | Incidentes, accidentes y PRIC | P2 | `modules/gestion-salud/investigacion-accidentes` |
| ST-05 | Matriz IPERC | P2 | `modules/gestion-peligros/identificacion-peligros` |
| ST-06 | Salud ocupacional (ausentismo y exámenes) | P2 | `modules/gestion-salud/ausentismo`, `modules/gestion-salud/evaluaciones-medicas` |
| ST-07 | Emergencias (brigada, simulacros, recursos) | P3 | `modules/gestion-amenazas/plan-prevencion` |
| ST-08 | Verificación y mejoramiento | P3 | `modules/verificacion/auditoria-anual`, `modules/mejoramiento/acciones-preventivas-correctivas` |

**Uso:** al iniciar cualquier submódulo nuevo, leer primero su ST-xx y seguir el ciclo
auditar → especificar → construir/verificar → documentar. Los contratos IPC propuestos
(`getPlanTrabajo`, `getComites`, `getAfiliaciones`, `getEventos`, `getIperc`, `getSaludOcupacional`,
`getEmergencias`, `getVerificacion`) se conectan en la fase correspondiente, con verificación
independiente.

> **Nota:** el PDF original asumía prototipos HTML autocontenidos en `public/`+`download/`. Este repo ya
> es Electron (`modules/` + `renderer.js` + `preload.js`), y el login/splash/selección de empresa ya
> está integrado → la "Fase 0" del PDF se reduce a conectar contratos reales faltantes.

---

## 🆕 Configuración del Sistema · Premium v2 (📦751, 2026-09-16)

La sección **Configuración** (`components/config/config-viewer.html`, ~7.4k líneas) se carga en un
`<iframe>` desde `renderer.js` → `showSettingsPage()`. Fue migrada al estilo **premium v2**.

### Estrategia clave: remapeo de tokens (no reescribir CSS)

El diseño legacy de Configuración era **100% variable-driven**: todo su CSS y sus `style="..."` en
línea usan `var(--primary)`, `var(--bg-card)`, `var(--text-muted)`, `var(--font-heading)`,
`var(--radius*)`, `var(--shadow*)`. Por eso **no se reescribió el CSS existente**: se cargó
`shared/kair-design-tokens.css` y se **remapearon esas variables** a los tokens premium dentro de
`.kair-config` (la clase del `<body>`). Resultado: todo el CSS previo + los estilos en línea adoptan
el look premium sin tocar el markup de las 6 secciones.

```css
.kair-config{
  --primary: var(--kair-blue); --primary-hover:#1a4a9e;
  --bg-general: var(--kair-canvas); --bg-card: var(--kair-card);
  --border-color: var(--kair-line); --border: var(--kair-line);
  --text-main: var(--kair-ink); --text-muted: var(--kair-muted);
  --font-heading: var(--kair-font-display); --font-body: var(--kair-font-ui);
  --radius: var(--kair-radius-control); --radius-md:10px; --radius-lg: var(--kair-radius-card);
}
```

**Bug fix incluido**: `--border` y `--radius-md` se usaban en el archivo pero **no estaban
definidos** (eran declaraciones inválidas); ahora quedan definidos en la capa premium.

> **Técnica reutilizable**: si un módulo/legacy es variable-driven, migrar por **remapeo de tokens**
> (1 bloque CSS) en vez de reescribir reglas una por una. Mucho menor riesgo.

### Header System v2 (patrón oficial)

El header sigue el patrón de `modules/recursos/capacitaciones/capacitaciones-view.html`:

```
.cfg-header                 ← transparente sobre el canvas (sin card/borde/sombra)
  .cfg-breadcrumb           ← Inicio › Configuración (último en negrita, "Inicio" → goHome())
  .cfg-header-row
    .cfg-header-left        ← .cfg-header-icon (42×42, radio 12, blue-soft) + h3 + p
    .cfg-header-right       ← .cfg-back-btn (outline)
  .cfg-tabs                 ← tabs con subrayado: border-bottom 1px gris + activa 2px azul
```

- **Iconos en SVG inline** (feather-style, stroke 1.8-1.9). ⚠️ `config-viewer.html` **NO carga**
  Font Awesome ni Bootstrap Icons: los `<i class="fas ...">` / `<i class="bi ...">` que quedan en el
  archivo **no renderizan**. Para iconos nuevos usar **SVG inline**.
- Se conservó la clase **`nav-tab`** en los botones de tab porque `switchTab()` y
  `validateUserPermissions()` la usan (`document.querySelector('.nav-tab[onclick*="\'usuarios\'"]')`).
  **No renombrar** `nav-tab` ni los `onclick="switchTab('x', this)"`.
- Los IDs `tab-<seccion>` y `goHome()` también se conservaron intactos.

### Modo oscuro

La capa premium incluye overrides de tokens para `[data-theme="dark"]` y `[data-theme="dark-legacy"]`
(el padre aplica el tema sobre `document.documentElement` del iframe).

### Cache-bust

El iframe se carga con token en `renderer.js` (`showSettingsPage`):
`components/config/config-viewer.html?v=20260916-premium`. **Bumpear al modificar el archivo.**

### Verificación

`node main/test-config-premium-v2.js` → **37/37 OK** (tokens, capa premium, header v2, tabs,
dark, integridad de llaves/HTML, cache-bust y handlers intactos).

---

## 🆕 Bandeja Integrada · Premium v2 (📦752, 2026-09-17)

La **Bandeja Integrada** (`renderer/bandeja-integrada/`) se migró al look premium v2 del
diseño objetivo `kair-bandeja.html` (prototipo autocontenido que pasó el user): topbar con
breadcrumb + icono/título + chip de fecha + segmentado **Agenda / Correo**, 4 KPI cards,
sidebar de tarjetas (mini-calendario, tipos de evento con contador, integración correo) y
el correo (toolbar, carpetas, lista, lector) + agenda (mes/semana/día/programar) re-skineados.

### Estrategia: 2 capas (mismo patrón que Configuración 📦751)

1. **Remapeo de tokens.** `styles.css` (5.778 líneas, legacy Gmail-style) es **100%
   variable-driven**. `premium.css` define los **tokens premium v2** (`--kair-surface`,
   `--kair-blue: #2057B8`, `--kair-sh-*`, `--kair-r-*`, `--kair-font-t/b`) y **remapea los
   tokens legacy** a sus equivalentes premium (`--kair-primary`, `--kair-bg-card`,
   `--kair-text-muted`, `--kair-text-light`, `--email-*`, `--kair-shadow-*`, `--radius`).
   Resultado: todo el CSS legacy adopta la paleta premium **sin reescribirlo**.
2. **Recetas de componentes** para donde la geometría legacy no coincide: topbar,
   KPI cards, sidebar, filas de correo, carpetas, lector, toolbar de agenda, celdas del
   mes, modales, redactor, toasts, scrollbar y responsive.

`premium.css` se carga **después** de `styles.css` en `index.html` → gana por cascada a
igual especificidad. **No usa la clase `kair-premium`** de `shared/kair-premium.css` (el
iframe tiene su propio scope y su propio dialecto, igual que Configuración con `.kair-config`).

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `renderer/bandeja-integrada/premium.css` | **NUEVO** (1.788 líneas). Tokens + remapeo + recetas premium. |
| `renderer/bandeja-integrada/index.html` | Topbar premium (`.kair-top`), segmentado `#tab-agenda`/`#tab-correo`, KPI `.kpis`, sidebar sin tarjeta propia. |
| `renderer/bandeja-integrada/app.js` | `renderKpiStrip` (KPI cards que navegan), `renderSidebar` (mini/tipos/sidecard), `renderHeaderState` (segmentado + chip de fecha), `bindHeader` (tabs + guard del search), `setCalendarVisible()`. |
| `renderer.js` | Cache-bust del iframe `?v=683` → `?v=685`. |
| `main/test-bandeja-premium-v2.js` | **NUEVO**. Smoke test estático (37 checks). |

### Hallazgo crítico: 12 archivos JS huérfanos

`index.html` carga **solo `app.js`** (+ `data.js`, `icons.js`, `kair-calendar*.js`,
`colombia-festivos.js`, `file-viewer`). **No** carga `init.js`, `handlers.js`, `state.js`,
`helpers.js`, `mail-operations.js`, `calendar-operations.js`, `compose-modal.js`,
`event-modal.js`, `render-mail-list.js`, `render-mail-detail.js`, `render-sidebar.js`,
`render-calendar.js`. Esos 12 archivos tienen un **contrato DOM paralelo y divergente**
(emiten clases que no existen en vivo, p. ej. `kair-sidebar__minical`) y referencian helpers
inexistentes. **`app.js` es el único contrato vivo: cualquier rediseño se hace ahí.**
Ojo: `init.js:40` hace `innerHTML=""` de `#kair-app` y reconstruye el skeleton — si algún día
se agrega ese `<script>`, **destruye el topbar de `index.html`**.

### Contrato DOM del topbar (lo que NO se puede renombrar)

`bindHeader()` y `renderHeaderState()` corren en `init()` **sin guards**, así que estos IDs
deben existir siempre en `index.html`: `#btn-back`, `#btn-refresh`, `#refresh-icon`,
`#btn-compose`, `#btn-signature`, `#gmail-indicator`, `#gmail-indicator-text`, `#kpi-strip`,
`#sidebar`, `#content-area`, `#mail-list-container`, `#mail-detail-container`,
`#calendar-slide`, `#footer-events-count`, `#footer-view`, `#modal-overlay`, `#event-modal`,
`#toast-container` y los `#fv-*`. `renderFooter()` tampoco tiene guards.

### Cambios intencionales respecto de la versión anterior

- **Se eliminó `#panel-toggle`** (el botón-flecha entre sidebar y contenido) → lo reemplaza
  el segmentado Agenda/Correo, que **fija** el estado (`setCalendarVisible(true|false)`) en
  vez de alternarlo. Se conservan `#content-area[data-calendar-visible]` y
  `#calendar-slide[data-visible]`, que es de lo que depende el CSS del slide.
- **Se eliminó del topbar el buscador `#search-input`** (el binding quedó con guard): la
  búsqueda vive en `#mail-search-input` del panel de correo y escribe el mismo
  `state.searchQuery`. Antes era invisible igual, porque `styles.css` ocultaba el header
  completo (`.kair-header { display:none !important }`).
- **Se eliminaron** el chip de empresa `#company-name` (el scope de empresa se ve en el
  toggle "Todas las empresas" de la toolbar de la agenda), los iconos decorativos de
  notificaciones/configuración (no tenían handler) y el botón de prueba `#btn-fv-test`
  (`wireFileViewerDemo()` ya validaba con `if (btn && input)`; el preview de adjuntos sigue
  funcionando por `#fv-file-input`).
- **El CTA "Redactar" del topbar es solo icono** para no duplicar el "Redactar" con label de
  la toolbar del correo (que es donde lo pone el diseño objetivo).

### Cache-bust (doble)

1. `renderer.js` → `renderer/bandeja-integrada/index.html?v=685` (el iframe).
2. `index.html` → `styles.css?v=…`, `premium.css?v=20260917-premium-fix1` y `app.js?v=…` (los
   sub-recursos del iframe se cachean aparte del documento).

### Verificación

`node main/test-bandeja-premium-v2.js` → **42/42 OK** (topbar, contrato DOM crítico, render
premium en app.js, capa CSS, cache-bust y los 5 checks de regresión de los bugs de 📦752-fix1).
Correr también los smoke tests históricos de la bandeja (`main/test-compose-bem.js`,
`main/test-auditoria-visual.js`).
Nota: `test-compose-bem.js` y `test-auditoria-visual.js` ya venían fallando antes de 📦752
(buscan reglas `.message-block--expanded` y `.kair-mail-message__avatar{width:32px}` que no
existen en el repo).

### 🐛 Bugs de la primera pasada (📦752-fix1, encontrados en la validación visual)

La primera versión se veía **casi vacía y lavada**. Dos causas, ambas en `premium.css`:

1. **`.kair-layout` quedó con 3 columnas** (`250px 26px 1fr`) después de retirar el
   botón-flecha `#panel-toggle`. Al quedar solo 2 hijos (sidebar + área de contenido), el
   contenido se acomodó en el **carril de 26px** → la lista de correos y el calendario se
   veían como una tira vertical de ~5px. **Fix**: `grid-template-columns: 250px 1fr` (y las
   dos media queries: `224px 1fr` y `1fr`). Lección: al sacar un hijo de un grid, revisar
   SIEMPRE el `grid-template-columns` de las 3 declaraciones (base + 2 breakpoints).

2. **`.kair-modal-overlay` declaraba `display: flex` en la regla base.** El modal vive en
   `index.html` con el atributo `hidden`, y **quien lo oculta es la regla del NAVEGADOR**
   (`[hidden] { display: none }`). Como una regla propia gana sobre la del navegador, el
   overlay quedó **visible siempre**: un velo `rgba(...,.45)` + `backdrop-filter: blur(2px)`
   tapando toda la bandeja. **Fix**: la regla base NO declara `display`; el `display:flex`
   va en `.kair-modal-overlay:not([hidden])` (mismo patrón que el CSS legacy).
   **REGLA PARA FUTURAS CAPAS**: en este módulo, si un elemento del HTML lleva el atributo
   `hidden` (p. ej. `#modal-overlay`, `#fv-overlay`, `#mail-details-panel`), la capa nueva
   **NUNCA** debe declarar `display` en su selector base.

También se corrigió que `.kair-toast` no capturaba clicks: `#toast-container` es
`pointer-events: none` (para no bloquear la UI) pero la píldora necesita
`pointer-events: auto`, porque adentro viven los botones de "Deshacer" y "Posponer".

Los tres casos quedaron **blindados con checks de regresión** en
`main/test-bandeja-premium-v2.js` (bloques 6.a/6.b/6.c) → el test pasó de 37 a **42 checks**.

### Pendiente de validación visual

Falta revisar en pantalla: (1) que el scroll interno de la lista de correos y del lector
funcione bien tras cambiar `.kair-mail-stack` a 388px, (2) el aspecto del sidebar de 3
tarjetas en la columna de 250px, (3) contraste del modo oscuro si el padre aplica tema
(esta capa **no** define overrides dark).

---

## 🆕 Bandeja Integrada · Firma de correo con imagen (📦753, 2026-09-18)

El modal **"Firma de correo"** se rediseñó al estilo premium v2 y ahora permite **texto +
imagen**. La imagen viaja **dentro del correo** (no como archivo adjunto).

### Cómo viaja la imagen: inline con Content-ID (CID)

Un `data:image/...;base64` dentro del HTML **no sirve**: Gmail web y la mayoría de los
clientes lo bloquean al recibir. Un adjunto normal tampoco: el destinatario la vería como
archivo suelto. La forma correcta es **imagen en línea**:

```html
<img src="cid:kair-firma@kair" alt="Firma" style="max-width:420px">
```
```mime
Content-Type: image/png; name="firma.png"
Content-Disposition: inline; filename="firma.png"
Content-Transfer-Encoding: base64
Content-ID: <kair-firma@kair>
```

Esto obliga a envolver el `multipart/alternative` en un **`multipart/related`**. La
estructura MIME resultante (4 casos) vive en **`buildRawMessage()`**
(`shared/google-gmail.js`), que se **extrajo de `sendMessage()` y se exportó** para poder
testearla sin OAuth:

| Caso | Estructura |
|------|-----------|
| Sin adjuntos ni imagen | `multipart/alternative` (text/plain + text/html) — comportamiento original |
| Con imagen | `multipart/related` (alternative + imagen inline) |
| Con imagen + adjuntos | `multipart/mixed` ( `related`(alternative + imagen) + adjuntos ) |
| Solo adjuntos | `multipart/mixed` (alternative + adjuntos) — comportamiento original |

**REGLA**: el `related` va SIEMPRE adentro del `mixed` y **antes** de los adjuntos; el orden
inverso rompe la resolución del `cid:`.

### Contrato IPC (sin cambios de plomería)

`sendMessage()` acepta un campo nuevo opcional:

```js
window.electronAPI.googleGmail.sendMessage({
  to, cc, subject, body, inReplyTo, references, threadId, attachments,
  signatureImage: { name: 'firma.png', mimeType: 'image/png', data: '<base64 SIN el prefijo data:...>' }
});
```
`main.js` ya reenvía las options tal cual (`Object.assign({configPath}, options)`) y
`preload.js` también, así que **no hubo que tocar ni el IPC ni el preload**. Los otros 3
call sites de `sendMessage` no pasan el campo → comportamiento idéntico al anterior.

### Persistencia (localStorage)

| Clave | Contenido |
|-------|-----------|
| `kair.emailSignature` | Texto de la firma (como antes) |
| `kair.emailSignatureImage` | `{ dataUrl, mimeType, name, size }` |

- **Límite: 400 KB** (`SIG_IMAGE_MAX_BYTES`) — entra cómodo en la cuota de localStorage y en
  el peso del correo (base64 infla ~33%).
- Formatos: PNG, JPG, WEBP, GIF (`SIG_IMAGE_MIMES`). Cualquier otro se rechaza con toast.
- El helper `getSignatureImage()` devuelve `{name, mimeType, data}` **sin** el prefijo
  `data:...;base64,` (el backend espera base64 puro).
- La firma (texto e imagen) **no se agrega en reenvíos**, igual que antes.

### UI del modal (premium v2)

- ⚠️ **Bug corregido**: el CSS legacy pintaba `.kair-signature-modal__header` con
  `background: #404040` y el título en blanco. La capa premium sobreescribía la tipografía
  pero **no el fondo**, así que el título quedaba oscuro sobre oscuro. Ahora la regla premium
  fija `background: var(--kair-surface)` + `color: var(--kair-text)`.
- El modal pasó de 8px a **20px** de radio (`--kair-r-md`), con icono+subtítulo en el header,
  hint azul, labels en versalitas, caja de imagen (subir / miniatura + cambiar / quitar),
  vista previa en vivo (imagen arriba, texto abajo) y pie con "Borrar firma" en tono de
  peligro + Cancelar + Guardar.
- El overlay de firma mantiene `z-index: 450000` (debajo del modal de eventos 500000).

### Verificación

`node main/test-firma-imagen.js` → **60/60 OK**. No es un test de patrones: **ejecuta
`buildRawMessage()` y `extractAttachments()` de verdad** y valida la estructura MIME
(boundaries, `Content-ID`, `Content-Disposition: inline`, base64 partido en líneas de ≤76,
orden related→adjuntos) en los 4 casos, la clasificación inline vs adjunto de las partes, más
los checks estáticos de UI/CSS y del refresco.

### 🐛 Bugs encontrados en la prueba real de envío (📦753-fix1)

**1. La firma se veía como "1 archivo adjunto" y no dentro del cuerpo.** Dos causas:

- **`sanitizeHtml()` reemplazaba los `cid:` por un pixel transparente 1x1** (decisión de
  📦690 para evitar el `ERR_UNKNOWN_URL_SCHEME` en consola). Resultado: la imagen **nunca** se
  veía. **Fix**: ahora anota el Content-ID en `data-kair-cid` (y deja el pixel como src
  provisorio) y una función nueva, **`hydrateInlineImages(root, mail)`**, busca las partes en
  línea del mensaje, las descarga con `googleGmail.downloadAttachment` y cambia el `src` por un
  **data URL** (con caché en memoria por `messageId:attachmentId` para no re-descargar en cada
  render). Se llama al final de `renderMailDetail()`.
- **`extractAttachments()` listaba CUALQUIER parte con nombre de archivo como adjunto**, así que
  la imagen en línea aparecía en la barra "N archivos adjuntos". **Fix**: el parser ahora
  expone `contentId`, `disposition` e `isInline` (lee los headers `Content-ID` y
  `Content-Disposition` de cada parte); el renderer **excluye del listado** las partes en línea y
  `hasAttachment` solo cuenta las que no son inline (un correo con solo firma-imagen ya no
  muestra el clip en la lista).

**Persistencia**: `email_attachments` sumó las columnas `content_id` y `disposition`
(CREATE TABLE + migración idempotente en `EMAIL_MIGRATIONS_SQL`, mismo patrón que las columnas
de 📦647-fix2). El parser → `email-sync.js` → `email-db.saveAttachment()` las guardan.
⚠️ **Los mensajes ya cacheados** tienen esas columnas en NULL, así que su imagen aparece como
adjunto hasta que se re-sincronicen (el sync re-inserta los adjuntos de los últimos 25 hilos en
cada corrida: se auto-cura solo).

**2. La bandeja tardaba hasta ~2 minutos en reflejar un correo enviado.** Tres causas:

- El bloque post-envío sincronizaba **siempre INBOX**, pero el correo recién enviado vive en
  **Enviados** → no aparecía hasta el próximo auto-refresh. **Fix**: helper nuevo
  `refreshFolderNow(folder)` (sincroniza + relee + repinta **si esa carpeta es la visible**) y el
  post-envío refresca **la carpeta visible + SENT** al instante.
- El auto-refresh corría **cada 60 s**. **Fix**: **30 s**.
- Al volver a la app, `visibilitychange` solo **reiniciaba el timer** (hasta 60 s de espera).
  **Fix**: ahora sincroniza **de inmediato**.

Además, el merge de threads (preservar `messages`/`body`/`body_html`/`attachments` + las marcas
locales de leído/destacado) que estaba **duplicado en 2 lugares** se extrajo a
**`applyThreadsToState(threadsData)`**, usado por las 3 rutas de refresco.

### 🐛 Segunda ronda de la prueba real (📦753-fix2)

**1. La imagen de firma tardaba ~10 s en aparecer.** Causa raíz medida: el
`GmailRateLimiter` (`shared/google-gmail.js`) entrega **40 tokens por ventana de 60 s** y el
sync pide ~26 llamadas de golpe; cuando la ventana se agota, **todo** espera al próximo
refill (hasta 60 s). Abrir un correo y traer su imagen quedaba detrás del sync. Fixes:

- **Reserva de tokens para el user**: el tráfico de fondo nunca usa los últimos **8** tokens
  (`PRIORITY_RESERVE`). `GmailRateLimiter.run(fn, { priority: true })` sí puede usarlos; el
  sync va **sin** `priority`.
- **Prioridad** aplicada en `downloadAttachment` (imagen/adjunto) y `sendMessage` (enviar).
- **Caché en disco** en el handler `google-gmail:download-attachment`:
  `userData/email-attachments/<messageId>/<attachmentId>.b64`. Cada imagen se descarga **una
  sola vez**; después es instantánea y no consume cuota.
- **De-duplicación** de pedidos en vuelo (`_inlineImgPending`) y **placeholder**
  (`.kair-inline-img--loading`) mientras baja, para que no parezca que el correo no tiene imagen.

**2. Correos ya leídos volvían a aparecer como NO leídos.** Causa raíz: en
`email-db.saveMessage()` había un `UPDATE email_threads SET has_unread = 1` **incondicional**
para cualquier mensaje que no fuera del user (Loop2-fix). Como el auto-refresh re-guarda los
últimos 25 hilos en cada corrida, **cada sincronizado volvía a marcar como no leído** lo que
el user ya había leído (el mark-read local se perdía; el punto azul de la lista sale de
`thread.has_unread` → `threadToMail()`). Se notaba más al bajar el intervalo a 30 s.

Fix: **`recomputeThreadUnread(threadId)`** recalcula el flag desde los labels reales
(`label_ids LIKE '%"UNREAD"%'`, ignorando enviados y borradores) y se ejecuta **después** de
guardar el mensaje. Un correo nuevo sin leer se sigue marcando ✓; uno ya leído no revive.

### Verificación

`node main/test-firma-imagen.js` → **83/83 OK** (incluye la estructura MIME real, la
clasificación inline vs adjunto, el refresco, la reserva del rate limiter, el caché en disco,
el recálculo del "no leído" y el envío real desde la respuesta rápida).

### 🐛 Tercera ronda de la prueba real (📦753-fix3)

**La respuesta rápida no enviaba nada.** El botón **"Enviar"** de la barra de respuesta del
lector (`.kair-mail-detail__reply`) **no enviaba**: abría el redactor flotante con el texto
prellenado (`openComposeModal("reply", mail)` + un `setTimeout` que copiaba el texto). El user
creía que la respuesta ya había salido, cerraba el redactor, y **la respuesta nunca se enviaba
ni aparecía en Enviados** (de ahí que el último enviado fuera el correo de prueba anterior).

Fix: el botón ahora **envía directo** (como Gmail), reutilizando `sendComposedMail()`:

- Resuelve el destinatario con `getMailDisplayContact(mail)` (remitente en Recibidos,
  destinatario en Enviados), arma el asunto con `RV:` si no lo tiene, y manda
  `isReply: true` + `threadId` para que quede **en el mismo hilo**.
- Incluye la firma (texto + imagen) y el quote del original, igual que el redactor.
- Deshabilita el botón con "Enviando…" y lo restaura al terminar; limpia el input si salió bien.
- **`sendComposedMail()` ahora devuelve `true`/`false`** (antes devolvía `undefined` siempre) y
  **`opts.closeModal` pasó a ser opcional** (`typeof === 'function'`), porque la respuesta
  rápida no tiene modal que cerrar. Cambio backward-compatible: el redactor no usa el retorno.

### 🐛 Cuarta ronda: el sync vencía a los 120 s y Enviados nunca se actualizaba (📦753-fix4)

**Síntoma**: tras enviar desde la respuesta rápida, el correo no aparecía en Enviados, y en la
consola salía `[BandejaIntegrada] Background sync failed: El sync tardó más de 120s sin
responder`. Causa raíz **de mi propia optimización anterior** (📦753-fix2): al subir la
frecuencia de sincronizado (30 s + foco + post-envío) el consumo superó el cupo de Gmail.

**La cuenta del cupo** (esto es lo importante para no repetirlo):

- `GmailRateLimiter` entrega **N tokens por ventana de 60 s** y **todo** pasa por ahí.
- Un sync de 25 hilos cuesta **26 requests** (`messages.list` + 1 `messages.get` **por mensaje**,
  en lotes de 3 con 500 ms de espera) → ~5 s mínimo, y ~26 tokens.
- Con el cupo viejo (**40/min**, y encima 8 reservados → 32 para el fondo) **UN solo sync ya casi
  agotaba la ventana**. El segundo sync (Enviados) esperaba al siguiente minuto, y si se
  acumulaban dos ventanas **vencía a los 120 s** (timeout del handler IPC en `main.js:2020`).
- Resultado: la carpeta Enviados quedaba con datos viejos y el correo recién enviado no
  aparecía **aunque el envío hubiera salido bien**.

**El cupo real de Gmail** es 250 unidades/usuario/segundo y `messages.get` cuesta 5 unidades →
~3.000 lecturas/min. El valor de 40/min era ~1,3 % del cupo real (margen absurdo).

Fixes:

- **Cupo 40 → 120 requests/min** (`REFILL_RATE`) y **reserva del user 8 → 25**. Con eso el fondo
  tiene ~95 tokens/min: alcanza para 3 syncs/min y sobran tokens para lo interactivo.
- **Refresco de Enviados más barato**: después de enviar se piden **8 hilos** (el enviado es el
  más nuevo) en vez de 25 → ~9 requests en lugar de 26.
- **No apilar syncs por carpeta**: `_folderSyncInFlight[folder]` — si ya hay un sync corriendo
  para esa carpeta, se reutiliza esa promesa (el auto-refresh + el post-envío + el foco podían
  encolar 3 syncs idénticos y agotar el cupo).

**Lección**: al subir la frecuencia de un refresco hay que rehacer la cuenta del cupo
(`requests por sync × syncs por minuto ≤ tokens por ventana − reserva`). Un cupo pensado para
"un sync cada 60 s" no aguanta "un sync cada 30 s + uno por envío + uno por foco".

### Pendiente

- Re-validar en pantalla: (1) que la imagen aparezca rápido y con placeholder mientras baja,
  (2) que un correo leído **no** vuelva a marcarse como no leído tras un par de sincronizados,
  (3) que un correo enviado aparezca **en segundos** en Enviados (respuesta rápida y redactor),
  (4) que no vuelva a aparecer el error "El sync tardó más de 120s sin responder" en consola.
- Cache-bust: iframe `?v=690`, `premium.css?v=20260918-firma-imagen-fix2`,
  `app.js?v=20260918-firma-imagen-fix4`. → **superado por 📦754/📦755**: hoy es `?v=695`,
  `premium.css?v=20260918-paginacion-correos` y `app.js?v=20260918-paginacion-correos-fix2`.

---

## 📦754 · Bandeja Integrada — toolbar compacta (2 filas en vez de 5)

**Pedido del user**: "mejorar esta sección para ahorrar espacio y que sea más intuitiva, sin quitar
espacio y que este espacio sea aprovechado para tener más espacio para mostrar correos manteniendo
mi estilo premium" (apuntando a la zona `[+ Redactar] [⟳ Sincronizar] [≡ Reciente ▾]` + buscador +
3 filas de chips de carpetas).

### Antes vs después

| | Antes | Ahora |
|---|---|---|
| Filas de "chrome" antes del primer correo | **5** (acciones / buscador / 3 filas de carpetas) | **2** (toolbar / fila de carpetas) |
| Acciones | Redactar + Sincronizar (con etiqueta) | Redactar (**con** etiqueta) + Sincronizar (**solo icono**, tooltip) |
| Buscador | Fila propia (38px) | Dentro de la toolbar (32px, `flex: 1`) |
| Orden | Botón en la barra de acciones | Botón al final de la misma fila (solo icono + tooltip con el orden actual) |
| Carpetas | 11 chips en 3 filas (`flex-wrap: wrap`) | **2 chips** (Recibidos · Enviados) + `Más ▾` con **9 filtros** (No leídos, Marcados, Reuniones + las 6 carpetas de Gmail) |

### Decisiones y por qué

1. **El panel de correos mide 388px** (`330px` bajo 1280px de ventana, `1fr` en mobile — ver
   `.kair-mail-stack grid-template-columns`). Ese ancho manda: no entran 3 etiquetas + buscador.
   Por eso `Sincronizar` y `Orden` quedan **solo icono** con `title`. El orden no-default se pinta
   azul (`data-active="true"`) para que el estado se vea sin etiqueta.
2. **A la vista solo `Recibidos` y `Enviados` (fix7)**: con esos 2 chips + `Más ▾` la fila de
   carpetas es UNA línea y la bandeja queda en 2 líneas de controles en total (el pedido explícito
   del user). Todo lo demás vive en el menú `Más ▾`: las 3 vistas rápidas (`unread`, `flagged`,
   `meeting`) **primero**, un separador, y después las 6 carpetas de Gmail (`drafts`, `trash`,
   `spam`, `starred`, `important`, `archive`). El botón muestra la vista activa, así el filtro
   nunca se "pierde".
3. **`applyFilter(f)`** — la lógica del click (cambiar `state.mailFilter`, `_resetMailListScroll`,
   y recargar la carpeta si `isFolder`) se extrajo a una función y la usan **los chips y el menú**.
   Antes estaba inline en el forEach de los chips.
4. **La fila de carpetas usa `flex-wrap: wrap` + `display: contents` (fix6)**: la primera versión
   usaba UNA línea con `overflow-x: auto` y, con 388px de panel, el último chip visible quedaba
   **cortado a la mitad** (se veía como un error de dibujado, ver la captura del user). Con
   `.kair-mail-list-filters { display: contents }` los chips son items de la fila y envuelven junto
   con el botón `Más`. Desde el fix7 no hace falta envolver (son 3 elementos) pero el wrap queda
   como red de seguridad en ventanas angostas.
5. **El menú `Más` se ancla a LA FILA, no al botón**: `.kair-mail-filter-row { position: relative }`
   y `.kair-mail-folders-menu { position: absolute; right: 0; top: calc(100% + 2px) }`. Si se
   anclara al botón, al envolver el botón a la 2ª línea el menú de 198px se saldría del panel.
   Con 9 items además lleva `max-height: 70vh; overflow-y: auto` para no salirse en ventanas bajas.
6. **Un solo listener global** para cerrar el menú (`handleFoldersMenuOutsideClick` +
   `handleFoldersMenuEscape`, registrados al cargar y removidos en `destroy()`). Lo obvio era
   registrar el listener dentro del render de la lista, pero `renderMailList` corre en **cada**
   `render()` → se acumulaban handlers.

### Pitfalls confirmados (ampliación de la regla histórica)

1. **`display` + `[hidden]`**: `.kair-mail-folders-menu` NO declara `display` en su regla base;
   el `display:flex` vive en `.kair-mail-folders-menu:not([hidden])`. Si se declara en la base,
   pisa el `[hidden] { display:none }` del navegador y **el menú queda siempre abierto** (mismo bug
   que el `.kair-modal-overlay` del 📦752). El test lo valida explícitamente.
2. **El helper `el(tag, attrs)` de `app.js` NO soporta el atributo `hidden`** (solo `class`, `html`,
   `data-*`, `style`, `onClick/onInput/onChange`, `title`, `aria-label`, `type`, `placeholder`,
   `value`). `el("div", { hidden: true })` se ignora en silencio → hay que hacer `menu.hidden = true`
   después de crearlo.
3. **Especificidad de `:first-child`**: al sacar el botón de orden de `.kair-mail-compose-bar`,
   `:first-child` volvió a apuntar a "Redactar" (que es el que debe verse azul). Mover botones entre
   contenedores cambia qué elemento matchea `:first-child` — revisar los estilos que dependen de eso.

### Validación

- `node main/test-bandeja-toolbar-compacta.js` → **48/48 OK** (nuevo).
- `node main/test-bandeja-premium-v2.js` → 42/42 OK · `node main/test-firma-imagen.js` → 88/88 OK.
- Validado en pantalla por el user (2 rondas de capturas).

### fix6 (feedback visual del user sobre 📦754)

El user probó y mandó 2 capturas: la toolbar y el menú se veían bien, pero el chip **"No leídos"
quedaba cortado a la mitad** contra el borde de la tira (la fila tenía `overflow-x: auto` y con
388px de panel no entraban las 6 carpetas). Ajustes aplicados:

- `.kair-mail-filter-row`: `flex-wrap: wrap` + `position: relative` (bloque contenedor del menú).
- `.kair-mail-list-filters`: `display: contents` → sus chips son items de la fila y envuelven
  junto con el botón `Más` (el wrapper deja de aportar caja; ya no hay scroll horizontal).
- Etiqueta `all`: "Bandeja de entrada" → **"Recibidos"** (la tab de arriba ya dice el nombre largo).
- Chips más compactos: fuente 11.5px, padding `5px 10px`, gap 5px.
- `@media (max-width: 1280px)`: se esconden los iconitos de las carpetas (el panel baja a 330px).
  El chevron del botón `Más` NO se esconde.
- **El menú `Más` ahora se ancla a la FILA** (`right: 0` contra `.kair-mail-filter-row`): al
  envolver, el botón puede caer en la 2ª línea y, si el menú se anclara a él, se saldría del panel.

### fix7 (pedido explícito del user: "así lo quiero", 2 líneas)

**Línea 1**: `[+ Redactar] [⟳] [buscador flexible] [≡ ▾]` — sin cambios.
**Línea 2**: `[Recibidos 22] [Enviados] [Más ▾]` — `PRIMARY_FILTERS = ["all", "sent"]`.

Todo el resto vive en el menú `Más ▾`: **primero las 3 vistas** (`unread`, `flagged`, `meeting`),
un **separador** (`.kair-mail-folders-menu__sep`) y después las **6 carpetas** de Gmail. Con 9 items
el menú lleva `max-height: 70vh; overflow-y: auto` para no salirse en ventanas bajas.

Lección: un contenedor con `overflow-x: auto` para "que entre todo" es una trampa cuando el panel
es angosto — el último elemento visible queda cortado y se lee como error de dibujado. Y cuando el
panel tiene ancho fijo, la única forma de garantizar UNA línea es reducir la cantidad de elementos
visibles (mover el resto a un menú), no achicar infinitamente los chips.

---

## 📦755 · Bandeja Integrada — ver TODOS los correos (paginación)

**Pedido del user**: "como podemos ver todos los correos... ya que actualmente no tenemos esa opción
de ver todos los correos bien sea con la barra de desplazamiento o con una paginación".

### El diagnóstico

La Bandeja **solo podía mostrar los 25 correos más nuevos** por dos topes que se sumaban:

1. **El sync** (`email-sync.syncInbox`) pedía siempre **la PRIMERA página** de Gmail
   (`maxResults: 25`, sin `pageToken`) y después **borraba del cache todo lo que no estuviera en esa
   página** (limpieza de huérfanos). O sea: el cache nunca podía tener más de 25 threads por carpeta.
2. **La lista** leía el cache con `getThreads({ maxResults: 25 })` fijo, sin offset.

No había scroll infinito ni botón de "cargar más": el final de la lista simplemente terminaba.

### La solución (4 capas)

| Capa | Cambio |
|---|---|
| **Schema** | Nueva tabla `email_sync_state` (folder PK, `page_token`, `loaded_count`, `pages_loaded`). Idempotente: `CREATE TABLE IF NOT EXISTS` dentro de `EMAIL_SCHEMA_SQL`, que `main.js` ejecuta en cada arranque → las bases existentes la crean solas. |
| **email-db.js** | `getThreadsFromCache` acepta `offset` (`LIMIT @maxResults OFFSET @offset`); nuevo `countThreadsFromCache`; nuevos `saveSyncState` / `getSyncState` / `resetSyncState`. El WHERE se extrajo a **`buildThreadsWhere()`** para que la lista y el contador usen EXACTAMENTE el mismo filtro (si no, "Mostrando 25 de 137" mentiría). El contador va envuelto en una subquery porque el operador `to:` necesita el `last_to_list` que sale de `email_messages`. |
| **email-sync.js** | `syncInbox({ append: true })` = traer la **página siguiente** desde el `nextPageToken` guardado, **agregando** al cache. Devuelve `nextPageToken` + `hasMore` y guarda el estado. `fetchAll: false` (una página por vez, explícito). |
| **Renderer** | `state.mailLoaded` (ventana cargada) + `loadMoreMails()` + scroll infinito + pie "Mostrando X de Y" con botón. |

### Decisión clave: la limpieza de huérfanos NO puede borrar lo que el user cargó

`syncInbox` borraba los threads de la carpeta que no venían en la respuesta de Gmail (para limpiar
los que se borraron/archivaron). Con paginación eso es **destructivo**: el sync de fondo trae solo la
página 1, así que habría borrado las páginas 2, 3, … que el user acababa de pedir.

Fix: **ventana de fechas**. Se calcula la fecha más vieja de la página traída (`cutoff`) y solo se
consideran huérfanos los threads **dentro** de esa ventana (`last_message_date >= cutoff`). Los más
viejos pertenecen a páginas siguientes y no se tocan. Además la limpieza se saltea por completo en
modo `append`. El test funcional lo verifica: sin la ventana se habrían borrado 35 correos de 60.

### Los dos caminos de "cargar más" (en este orden)

1. **Cache local primero** (`mailTotal > mostrado`): solo se amplía `state.mailLoaded` y se relee el
   cache. **Cero requests a Gmail** → instantáneo.
2. **Gmail después** (el cache ya se agotó): `syncInbox({ append: true })` con el `pageToken`
   guardado → 1 request de listado + 25 de detalle ≈ 40s (mismo costo que el sync normal, respeta el
   cupo de 120/min del 📦753).

El **scroll infinito** dispara lo mismo al llegar a 220px del final; el **botón del pie** es la
acción visible para quien no scrollea y también el indicador de "Cargando correos…". El pie se
repinta SOLO él (`updateMailPagerFooter`) cuando llega el total: si se re-renderizara la lista, el
scroll del user saltaría.

### Pitfall encontrado en el camino: `el()` ignoraba `id`

El helper `el(tag, attrs)` de `app.js` soportaba `class`, `html`, `data-*`, `style`, `onClick`,
`onInput`, `onChange`, `title`, `aria-label`, `type`, `placeholder` y `value`… **pero NO `id`**: se
ignoraba en silencio. Consecuencia real: el botón de orden (`#mail-sort-toggle`) se crea con
`el("button", { id: "mail-sort-toggle", ... })` desde el 📦754, quedaba **sin id**, y el handler que
lo busca con `$("#mail-sort-toggle")` **nunca se enganchaba** (el botón no hacía nada).

Fix: `el()` ahora soporta `id` (y `hidden`). **Regla**: antes de crear un elemento con `el()` y
buscarlo después por id, verificar que el helper soporte ese atributo — o setearlo a mano
(`node.id = "x"`), como se hacía con `menu.hidden`.

### Validación

- `node main/test-bandeja-paginacion.js` → **48/48 OK** (estructural, nuevo).
- **`test-bandeja-paginacion-funcional.js` → 22/22 OK** (FUNCIONAL contra SQLite en memoria:
  páginas sin solaparse, contador que coincide con la lista, `page_token` por carpeta, y la ventana
  de fechas de la limpieza). ⚠️ Se corre con
  `$env:ELECTRON_RUN_AS_NODE=1; npx electron main/test-bandeja-paginacion-funcional.js` porque
  `better-sqlite3` está compilado para el ABI de Electron (con `node` a secas da `ERR_DLOPEN_FAILED`).
- `test-bandeja-toolbar-compacta.js` 50/50 · `test-bandeja-premium-v2.js` 42/42 ·
  `test-firma-imagen.js` 88/88.
- Cache-bust: iframe `?v=695`, `premium.css`/`app.js?v=20260918-paginacion-correos-fix2`.

### fix (prueba real del user: log de consola)

El user probó la paginación y **funcionó**, pero en el medio apareció un toast
**"No se pudieron cargar más correos · No se pudo obtener el perfil de Gmail"** y el log mostró
**10+ "Cargando la página siguiente de INBOX desde Gmail..." encadenados**. Diagnóstico:

1. **El scroll infinito encadenaba páginas.** Al agregar 25 filas la lista crecía y volvía a
   disparar el evento de scroll (y el navegador emite varios eventos por gesto). Cada página son
   **26 requests**; 4-5 páginas seguidas + el auto-refresh cada 30s (26 requests más) superan el
   cupo de Gmail (120/min, ver 📦753) → el sync empezó a fallar y uno de los pedidos reventó en
   `getProfile`.
2. **`getProfile` abortaba todo el sync.** Si esa llamada fallaba (rate limit, hipo de red) el sync
   devolvía `No se pudo obtener el perfil de Gmail` aunque los tokens estuvieran perfectos y el
   email ya estuviera guardado en `email_connections`.

Fixes:

- **Scroll infinito "armado"**: se dispara UNA página por llegada al final. Si el user sigue
  bajando, el primer evento de scroll queda lejos del final (se agregaron 25 filas) y vuelve a
  armarse (`if (remaining > 400 || sinceLast > 5000) state._autoLoadArmed = true`). Más un
  **cooldown de 1,5s** entre cargas automáticas.
- **No apilar syncs**: `isAnySyncInFlight()` (sync de fondo + syncs por carpeta). "Cargar más"
  posterga si hay otro sync corriendo, y el **auto-refresh se saltea el ciclo** si se acaba de
  cargar una página (`mailLoadingMore` o `_lastLoadMoreAt < 15s`). Prioriza la acción del user
  sobre el refresco automático.
- **`getProfile` con fallback**: si falla, se usa el email de `emailDb.getAllConnections()[0]`.
  Solo se aborta si tampoco hay conexión guardada.
- **Toast con throttle** (`notifyLoadMoreError`, 30s por mensaje distinto): si el user insiste o el
  scroll dispara varias veces, no recibe 5 toasts iguales.

**Lección**: al agregar paginación sobre una API con cupo (Gmail), el scroll infinito es un
multiplicador de requests. Hay que ponerle freno explícito (armado + cooldown) y hacer que las
tareas automáticas (auto-refresh) cedan prioridad a la acción del usuario.

---

## 🆕 Perfil de Cargo y Profesiograma · Premium v2 (📦772, 2026-09-18)

El submódulo **3.1.3** (`modules/gestion-salud/perfiles-cargo-profesiograma/`) se migró al estilo
**premium v2** siguiendo el patrón de Evaluación Inicial (📦761) y Evaluación y Selección (📦770).

### Cómo se monta (iframe)

`renderer.js` hace `new PerfilesCargoProfesiogramaComponent(container, company, module, sub, safeBackToModuleCallback)`
y el componente carga un **iframe** con la UI completa → per el patrón 📦761, el HTML se queda como
archivo y el **wrapper versiona la URL**. El componente ahora tiene **`destroy()`** (remueve el
listener de mensajes y limpia el contenedor) y el render hace
`removeEventListener` + `addEventListener` para que **un render repetido no duplique el listener**.

### Estrategia: tokens premium en su `:root` propio

El CSS vive en un bloque `<style>` DENTRO del HTML (iframe aislado, no envenena la app). El diseño
era variable-driven (`:root` con tokens genéricos `--primary`, `--bg-card`, `--border`…) — se
**remapearon los valores** al dialecto premium (#2057B8 / #14213D / #748096 / #E8EBEE / sombras
rgba(20,33,61,…)) y se agregaron variables nuevas (`--row-hover`, `--slate-soft`, `--dirty-bg`,
`--sk-1/--sk-2`) para los colores que estaban hardcodeados.

### Header System v2

```
.app-header                    ← transparente sobre el canvas (sin card/borde)
  .breadcrumb                  ← Gestión de la Salud › 3.1.3 › Inicio (SE CONSERVÓ: el JS
                                 lo usa — switchView escribe #bc-current con el nombre de la vista)
  .app-header-row
    .app-header-left           ← .header-icon (44×44, radio 12, blue-soft, SVG stethoscope)
                                 + .app-title (Manrope 800, 20px) + .app-sub
    .header-actions            ← 3 .header-btn (outline; Volver en primary) con SVG inline
.tabs-bar                      ← transparente + línea gris 1px + tabs con subrayado
```

- **Tabs con subrayado** (patrón Evaluación Inicial): activa = `color: var(--primary)` +
  `border-bottom-color: var(--primary)` (2px que se monta sobre la línea con `margin-bottom:-1px`);
  hover SOLO cambia el color (sin fondo); contenedor con `flex-wrap: wrap` (no `overflow-x`).
- **Iconos en SVG inline** en el header y las 7 tabs. El resto del módulo conserva Font Awesome
  (el iframe lo carga por CDN — deuda conocida offline).
- **Se conservó intacto**: los ids `btn-import`/`btn-export`/`btn-back`, los `data-view` de las 7
  tabs, los 3 badges, el contrato postMessage `{ action: 'backToModule' }` (campo `action`, no `type`)
  y TODA la lógica del viewer.js (sin cambios).

### Modo oscuro

Bloque de tokens para `[data-theme="dark"]` **y** `[data-theme="dark-legacy"]` (theme-manager.js
propaga el tema a TODOS los iframes). Cubre superficies hardcodeadas: tags (5 variantes soft),
toast (`.toast:not(.success):not(.error)` para no pisar los toasts de éxito/error), dialog-overlay
e inputs/selects del formulario. El CSS del explorer (prestado de `responsable-sg-view.css`) ya
tiene su propio modo oscuro.

### Fixes incluidos

- **`.view:not(.active) { display: none }`** — el toggle `.view`/`.view.active` tenía igual
  especificidad (lección 📦759; funcionaba por orden, ahora es a prueba de reorden).
- **Colores tokenizados**: gradiente del hero premium (#2057B8 → #14213D), tablas
  (`th` → `var(--bg-body)`, `td` → `var(--border)`, hover → `var(--row-hover)`), ipr-cells,
  dirty-row, skeleton, botones, search-box, dialog y detail-panel → todo con variables que el
  bloque oscuro remapea.

### Cache-bust (triple)

1. `component.js` → URL del iframe `?v=PCP-20260918-premium`.
2. `viewer.html` → script del viewer `?v=PCP-20260918-premium`.
3. `index.html` → script del componente `?v=PCP-20260918-premium`.

### Verificación

`node tests/profesiograma/test-premium-v2.js` → **39/39 OK** (tokens, header v2, tabs, fix .view,
colores, dark, componente con destroy/cache-bust, integridad JS/HTML). Los 12 tests históricos del
módulo (`tests/profesiograma/test-*.js`): 6 pasan; 4 requieren el Excel GI-FO-047 en Temp (no está
en esta máquina) y 2 tienen 1 FAIL preexistente de lógica del bridge (export: primera fila del
Excel; prof-id: grupoOcupacional null) — el bridge NO se tocó en esta migración.

### Pendiente

- Reemplazar los iconos FA del cuerpo (KPIs, module-cards, hero, diálogos) por SVG inline y quitar
  los 3 CDN (deuda offline, mismo pendiente de los viewers EMO).
- Divergencia de nombres en el bridge: `matriz` devuelve `tipoExamenId` (camelCase) pero
  `cargos:get` devuelve `tipo_examen_id` (snake_case) — revisar si algún día se toca el puente.

---

## 🆕 Reportes de Accidentes (FURAT) · Premium v2 (📦773, 2026-09-18)

El submódulo **3.2.1** (`modules/gestion-salud/reportes-accidentes/`) se migró al estilo **premium v2**
siguiendo el patrón de Evaluación Inicial (📦761), Evaluación y Selección (📦771) y Perfil de Cargo
(📦772). Es un módulo **FURAT** (reporte de accidentes de trabajo) con dashboard, biblioteca de
archivos por año y modales de carga/metadata.

### Cómo se monta (iframe)

`renderer.js` hace `new ReportesAccidentesComponent(container, company, module, sub, safeBackToModuleCallback)`
y el componente carga un **iframe** con `reportes-accidentes-view.html`. El wrapper versiona la URL y
ahora **`setupFrameCommunication` remueve el listener anterior antes de agregar** (un render repetido no
duplica el listener; `destroy()` ya existía y lo remueve).

### Estrategia: tokens premium en su `:root` propio

El CSS (`reportes-accidentes-view.css`, ~3.2k líneas) ya tenía su propio namespace `--furat-*` en
`:root`. Como el módulo vive en un **iframe aislado**, remapear los valores ahí es seguro (no filtra a
la app). Se remapearon al dialecto premium: azul `#2057b8`, tinta `#14213d`, muted `#98a2b3`,
borde `#e8ebee`, canvas `#fbfcfb`, sombras `rgba(37,56,82,…)`, tipografía DM Sans + Manrope. Se
agregaron variables nuevas para las superficies que estaban **hardcodeadas** (`--furat-row-hover`,
`--furat-slate-soft`, `--furat-blue-soft`, `--furat-header-icon-bg`, `--furat-line-soft`).

### Header System v2

```
.furat-header-v2               ← transparente sobre el canvas (sin card/borde)
  .furat-breadcrumb            ← Gestión de la Salud › 3.2.1 › Reportes de Accidentes
  .furat-header-row
    .furat-header-left         ← .furat-header-icon (44×44, radio 12, var(--furat-header-icon-bg), SVG shield)
                                 + .furat-title (Manrope 800, 20px) + .furat-subtitle
    .furat-header-actions      ← .furat-header-company (SVG building + #header-company-text)
                                 + .furat-back-btn (outline) con SVG inline
  .em-tabs                     ← tabs con subrayado (ver abajo)
```

- **Contrato conservado**: `#backBtn` (el viewer postea `back-to-module-request`), `#header-company-text`,
  `.em-tabs` / `.em-tab` / `.em-tab--active` (el viewer engancha el click y alterna la clase) y
  `data-view="dashboard|library"`. **No renombrar** esas clases: el JS las busca por nombre.
- **Iconos SVG inline** en el header y las 2 tabs. Se quitó el CDN de **Bootstrap Icons** (no se usaba
  en ningún lado). Font Awesome se conserva para el cuerpo del módulo (KPIs, tablas, modales).

### Tabs con subrayado (patrón Evaluación Inicial)

La línea es del contenedor (`border-bottom: 1px solid var(--furat-border)`) y la tab activa monta su
subrayado de 2px encima (`margin-bottom: -1px`). Hover **solo cambia el color** (sin fondo). El
contenedor usa **`flex-wrap: wrap`** (no `overflow-x`, lección del chip cortado 📦754).

### Modo oscuro: los DOS atributos con UN selector

🚨 **Truco reutilizable**: la app aplica `data-theme="dark"` (tema Sistema) y `data-theme="dark-legacy"`
(Oscuro manual). En vez de duplicar las **128 reglas** oscuras, se usa el selector de atributo
**`[data-theme^="dark"]`** (empieza con "dark"), que matchea ambos. Un solo reemplazo global
`[data-theme="dark"]` → `[data-theme^="dark"]` cubrió todo el archivo.
- El bloque de tokens oscuros define también las variables nuevas del header (`--furat-header-icon-bg`, etc.).
- Se eliminaron las reglas viejas de header con hex fijo (`#1e1e2f` / `#3a3a4d`): ya no hacen falta porque
  todo el header está tokenizado.

### Higiene de CSS

- **Reset scoped**: `* { … }` → `body, .furat-app, .furat-app * { … }` (por si algún día se linkea fuera
  del iframe).
- **Código muerto eliminado**: el bloque viejo `.furat-header*` (0 usos) tenía **propiedades huérfanas y
  una llave de más** (el archivo venía desbalanceado 623/624). Con la limpieza quedó **596/596**. También
  se eliminó el bloque **duplicado** de `.k-section-card` / `.header-back-btn` / `.em-tabs` (había dos
  copias del mismo header).
- Se reemplazaron los tokens viejos `#f8f9fa` / `#dee2e6` / `#5a6378` / `#174ea6` (ya no existen en el CSS).

### 🐛 Fallo de diseño encontrado en la validación visual: el BODY scrolleaba

El usuario mandó una captura donde se veían **solo las tabs pegadas al borde superior** y el header
(breadcrumb + título + Volver) había desaparecido. Diagnóstico con un arnés de Electron que mide
geometría (`getBoundingClientRect` + `scrollHeight`): el body medía **1310px** contra un viewport de
**755px** y `.kair-container` medía **1038px** (se estiraba con el contenido). Causa: el CSS tenía
`body { min-height: 100vh; overflow-y: auto }` y `.furat-app { min-height: 100vh }`. Con `min-height`
el contenedor **crece con el contenido**, así que el `overflow-y: auto` interno nunca se activa y el
que scrollea es el **body** → al bajar, el header se va de pantalla. Es exactamente el gotcha 📦682 de
este archivo ("Body debe ser `height:100vh + overflow:hidden`, no `min-height`").
- **Fix**: `body { height: 100vh; overflow: hidden }`, `.furat-app { height: 100vh; min-height: 0;
  overflow: hidden }` y `.kpi-strip { flex-shrink: 0 }`. Medido después: `body.scrollHeight == innerHeight`
  (755) y al scrollear el contenido (`.furat-view` → `scrollTop 555`) el header queda en `top: 0`.
- **Segundo arreglo**: el `.kpi-strip` iba **a todo el ancho** (flush) mientras el header y las cards
  están inset ~23px → se veía desalineado. Ahora lleva
  `margin: 0 clamp(16px, 1.8vw, 28px) 16px`.
- **Receta de verificación visual** (arnés temporal, en `.gitignore`): cargar la vista real en un
  `BrowserWindow`, `showInactive()`, y medir con `executeJavaScript`: rect del header/tabs/kpi, `body.scrollHeight`
  vs `innerHeight`, el scroller real y su `scrollHeight`, y las fuentes/colores calculados. Con la ventana
  **sin mostrar** Electron mide todo en 0 → hay que usar `win.showInactive()`. Y ojo: el scroller de este
  módulo es **`.furat-view--active`** (no `.k-main-content`).

### 🐛 fix2 — el iframe no llenaba el alto (contenido recortado)

Segunda captura del usuario: **"no se ve nada"** — se veían el header y las tabs, pero ni la franja de
KPIs ni el contenido. Diagnóstico con un arnés que monta el componente dentro de la cadena REAL de la
app (`#main-content → .main-canvas → .module-content-area → .submodule-content`, sin login):
- La cadena SÍ es definida (`#main-content` = 735px en 1280×800, 508px en 1146×573).
- Con el arnés, el iframe mide 715px y la franja de KPIs aparece en `top: 175`. Con las dos variantes
  (vieja y nueva) de `logic.js`. O sea: la cadena por sí sola no explicaba el síntoma.
- Lo que sí era frágil: `logic.js` ponía el **contenedor en `height: auto` + `min-height: 100%`** y el
  **iframe en `min-height: 100%`**, una resolución circular que en algunos contextos cae al alto por
  defecto del iframe (~150px) → solo se veía el header y el resto quedaba recortado (más aún con
  `overflow: hidden`).
- **Fix**: el iframe se estira con `flex: 1; height: 100%; min-height: 0; display: block` (el
  contenedor ya es `flex column`), y el contenedor pasa a `height: 100%; min-height: 0; overflow: hidden`
  (el scroll vive DENTRO del iframe, no en el contenedor padre). Se quitó `height: auto` +
  `min-height: 100%` y el `scrolling`/`overflow` del iframe.
- **CSS**: se cambió `height: 100vh` por `html, body { height: 100% }` + `body { height: 100% }` y
  `.furat-app { height: 100% }` — es el patrón que ya usan `frecuencia-accidentalidad` y
  `severidad-accidentalidad` (iframes hermanos que sí funcionan). `vh` dentro de un iframe anidado
  puede desincronizarse; `%` contra la cadena real es lo probado en esta app.
- **Cache-bust**: se bumpeó el token a `FURAT-20260918-premium-fix2` (CSS + viewer + logic.js en
  `index.html`) — el arreglo anterior se había hecho SIN bumpear el token, así que el usuario podía
  seguir viendo el CSS viejo cacheado. **Regla**: cada vez que se toca el CSS/HTML/JS del módulo,
  bumpear el token, aunque sea el mismo día.
- Test: `node tests/reportes-accidentes/test-premium-v2.js` → **47/47 OK** (se agregaron 2 checks del
  iframe y 2 del contenedor).

### 🚨 EOL: el diff salía como "todo el archivo cambiado"

`git ls-files --eol` mostró que **todo el directorio está `i/lf w/crlf`**: el índice guarda LF y el
working tree tiene CRLF (checkout de Windows). Git **no marca** los archivos que no se tocan (usa la
caché de stat), pero al **tocar** un archivo compara el CRLF del working contra el LF del índice y el
diff sale de **miles de líneas**. Fix: normalizar los archivos editados a **LF** (el EOL del índice).
Con eso el diff bajó a 298/377 en el CSS y 32/24 en el HTML. **Regla**: antes de editar un archivo,
correr `git ls-files --eol -- <ruta>`; si dice `i/lf w/crlf` y lo vas a tocar, normalizá a LF al final
(o esperá un diff gigante).

### Cache-bust (triple)

1. `logic.js` → URL del iframe `&v=FURAT-20260918-premium`.
2. `view.html` → `<link>` del CSS y `<script>` del viewer con `?v=FURAT-20260918-premium`.
3. `index.html` → script de `reportes-accidentes-logic.js?v=FURAT-20260918-premium`.

### Verificación

`node tests/reportes-accidentes/test-premium-v2.js` → **41/41 OK** (tokens, header v2, tabs, dark con
`^="dark"`, reset scoped, componente con guard/cache-bust, integridad JS, cache-bust triple, CDN).
Los 2 tests funcionales del módulo quedan como deuda (el módulo no tenía tests antes de 📦773).

### Pendiente

- Reemplazar los iconos FA del cuerpo (KPIs, tablas, modales, dropzone) por SVG inline y quitar el CDN
  de Font Awesome (deuda offline, mismo pendiente que los viewers EMO y el 3.1.3).
- El `.kpi-strip` sigue a ancho completo (flush) mientras el header está inset: es el diseño previo; si
  se quiere alinear, envolverlo con el mismo `clamp(...)` del header.

---

## 🆕 Gestión del Cambio · Premium v2 (📦774, 2026-09-19)

El submódulo **2.11.1** (`modules/gestion-integral/gestion-del-cambio/`) se migró al estilo **premium v2**.
Es el módulo de **gestión del cambio** (GI-FO-058 / GI-FO-059): registro de cambios con pipeline de 5
etapas, lista de chequeo de 13 ítems, evaluación de riesgos y plan de cierre.

### De 6 archivos a 1 par (marcado EMBEBIDO, no iframe)

La implementación vieja tenía 6 archivos: `gestion-cambio-logic.js` (componente) + `gestion-cambio-view.html`
(marcado) + `gestion-cambio-view.css` + `gestion-cambio-modal.css` + `gestion-cambio-viewer.js` + `index.js`
(CommonJS). **Los 6 se eliminaron.** Ahora hay solo:

| Archivo | Rol |
|---------|-----|
| `gestion-cambio-v2.js` | Componente + marcado EMBEBIDO en la constante `MARCADO` |
| `gestion-cambio-v2.css` | Todos los estilos, bajo `.gdc-scope` |

`renderer.js` (línea ~5359, **sin cambios**) hace
`new window.GestionDelCambioComponent(contenedor, empresa, módulo, sub, safeBackToModuleCallback)` y
`render()`. **No es iframe**: el componente inyecta su propio marcado (`this.raiz.innerHTML = MARCADO`) →
regla de 📦761. El `index.html` dejó de cargar `gestion-cambio-logic.js` y ahora carga la hoja + el `.js` v2
con cache-bust `GDC-20260918-v1-premium`.

### CSS: capa scoped `.gdc-scope` con tokens propios

- **Todos** los selectores van bajo `.gdc-scope` (el test lo verifica recorriendo el CSS y falla si alguno
  queda suelto). Tokens propios `--gdc-*` (azul `#2057B8`, tinta `#14213D`, borde `#E8EBEE`, sombras
  `rgba(20,33,61,…)`, radios 20/14/10/8, transición 180ms).
- **Sin `:root` global**: los tokens viven en `.gdc-scope` para no pisar la paleta de la app (lección 📦762).
- **Modo oscuro** para `[data-theme="dark"]` **y** `[data-theme="dark-legacy"]` (los dos que aplica
  `scripts/theme-manager.js`).
- Clases con prefijo `gdc-` (el prototipo viejo usaba `kair-gc-*`). Sin nombres genéricos sueltos
  (`badge`, `card`, `btn`, `modal`, `overlay`…) — el test lo verifica.

### Overlays al `<body>` ENVUELTOS en `.gdc-scope` (patrón 📦761)

El modal del asistente y los toasts son `position: fixed`; adentro de un contenedor con `flex`/`transform`
`fixed` se comporta como `absolute` y no cubre la ventana. Por eso se **mueven al `<body>`**, pero
**envueltos en un `<div class="gdc-scope">`** — si no, como el CSS usa selectores descendientes
(`.gdc-scope .gdc-modal`), al salir del árbol del componente perderían TODOS los estilos.

### Vigía de navegación (por qué hace falta)

`renderer.js` solo llama `destroy()` del componente activo cuando el **siguiente** se monta por
`createComponentSafely`; los montajes directos **no avisan**. Como el componente deja capas en el `<body>`,
al navegar a otro submódulo quedarían flotando (era el bug del "modal flotante"). Solución: un
**`MutationObserver`** sobre `documentElement` que, si el host O la raíz salen del documento
(`!host.isConnected || !self.raiz.isConnected`), llama a `#limpiarCapas()` (retira los nodos del body,
desconecta el observer, suelta el ESC y desbloquea el scroll). `destroy()` hace lo mismo de forma explícita.
Un `render()` repetido también llama `#limpiarCapas()` primero (no duplica capas).

### Contrato de datos EXCEL (intacto)

El componente usa **exactamente 4 canales** IPC (verificado por el test):
`loadGestionCambioData(empresa)` · `saveGestionCambioData(empresa, data)` ·
`generateGestionCambioId(empresa)` · `updateGestionCambioEstado(empresa, id, estado, extra)`.
Los handlers viven en `main.js` (líneas ~17762-17973) y NO se tocaron. La máquina de estados y la lista de
chequeo de 13 ítems (Rh1-4, Rl1-3, Sst1-6) y los 8 tipos de cambio se conservan igual.

### Validaciones de transición (no se pueden saltar)

- **Aprobado** exige la lista de chequeo **completa** (los 13 ítems vía `CLAVES`) y el **nivel de riesgo**.
- **En Ejecución** exige **al menos una aprobación** (SST o área).
- **Cerrado** exige **fecha de ejecución** y **fecha de cierre**.

### Verificación

- `node main/test-gestion-cambio-v2.js` → **69/69 OK** (registro en `index.html`, construcción del
  componente, CSS bajo `.gdc-scope` + dark, contrato de datos y validaciones).
- Verificación funcional con arnés temporal (`main/_preview-gdc.js`, en `.gitignore`): monta el componente
  real con un puente simulado y confirmó **5 filas**, KPIs `pend 3 / alto 2 / activos 4 / mes 1`, pipeline
  `1/1/1/1/1`, el asistente **"Paso 1 de 4"** con **8 tipos** y **13 ítems** de checklist, y el modo oscuro
  (`dark-legacy`: fondo `#131824`, texto `#E8EDF5`, tarjeta `#1B2230`). **Sin errores de consola.**

### Limpieza de código muerto

- Se eliminaron los 6 archivos viejos del módulo (nada los referenciaba; solo quedaba un comentario en
  `main.js` que se actualizó a `gestion-cambio-v2.js#renderPipeline`).
- El comentario de `classifyCambioPipeline` en `main.js` tenía un placeholder `📦XXX` (preexistente).

### Pendiente

- El CSS usa `font: … 'Inter', …` pero la app **no carga Inter** → cae a `system-ui`. Si se quiere
  consistencia con el resto del sistema premium, cambiar a `'DM Sans'` (el `--kair-font-ui` de la app).
- Iconos: el header y el modal usan **SVG inline**; revisar si quedó algún `<i class="fas">` en el cuerpo
  que dependa de un CDN (el módulo no carga Font Awesome).

---

## 🆕 Restricciones y Remisiones · Premium v2, segunda pasada (📦775, 2026-09-19)

El submódulo **3.1.6** (`modules/gestion-salud/restricciones-medicas/`) tiene 5 interfaces. Una pasada
previa (sin número de commit, en curso) migró **Enviar Remisión** y **Control de Remisiones** a
componentes embebidos premium (`.remenv-scope` / `.remctl-scope`). En 📦775 se completó el resto.

### Estado de las 5 interfaces

| Interfaz | Cómo se monta | Estado |
|----------|---------------|--------|
| Portal (home del módulo) | `fetch` + `innerHTML` en el documento principal | 📦775 premium + scoped |
| Ver Remisiones Médicas (visor) | `<iframe>` → `remisiones-view.html` | 📦775 tokens premium |
| Enviar Remisiones | componente embebido | ✅ v2 (pasada previa) |
| Control de Remisiones | componente embebido | ✅ v2 (pasada previa) |
| Generar Informe | `<iframe>` → `generar-informe-remision.html` | 📦775 tokens premium + dark |

### 🚨 El portal FILTRABA tokens a toda la app (bug tipo 📦766)

`restricciones-medicas-logic.js#render()` hace `fetch` del portal y
`this.container.innerHTML = html`. El HTML traía un `<style>` con **`:root`** (`--primary: #174ea6`,
`--bg-card`, `--text-dark`, `--border`, `--radius`, `--shadow-lg`) y un **reset `* { margin:0; padding:0 }`**.
Un `<style>` insertado por `innerHTML` aplica a TODO el documento, así que mientras el submódulo estaba
abierto la app entera heredaba esos nombres genéricos (mismo patrón del portal de EMO, 📦766).

**Fix (doble candado):**
1. El portal se reescribió como **fragmento** con TODO bajo `.rm-portal-scope` (el `*` quedó como
   `.rm-portal-scope *`), sin `:root`. Los tokens locales (`--rmp-*`) mapean a `--kair-*` con respaldo.
2. En `render()` se **sanitiza** el HTML antes de inyectarlo:
   `html.replace(/<link[^>]*>/gi, '')` (los `<link>` del portal cargaban CDNs en global). Se eliminaron
   los CDN de Font Awesome y Bootstrap Icons (los iconos ahora son **SVG inline**).

Verificado con un arnés de Electron: tras inyectar el portal, `--primary`, `--bg-card` y `--text-dark`
del `documentElement` quedan **vacíos** (antes los pisaba).

### Portal premium

- Breadcrumb + icon chip + título Manrope 800 + botón "Volver al Menú".
- 2 acciones principales (Ver Remisiones = card primaria con gradiente azul; Enviar = card con icono verde).
- 4 tarjetas de herramientas (Control, Estadísticas, Exportar, Configuración) con iconos SVG.
- **Contenido centrado** en pantallas anchas: `.rm-portal { max-width: 1120px; margin: 0 auto; }`.
  En maximizada (1920px) antes quedaba pegado a la izquierda (tenía el `max-width` SIN centrar);
  verificado con un arnés que mide el hueco izquierdo/derecho (392px y 392px a 1904px de host).
- Modo oscuro para `[data-theme="dark"]` y `[data-theme="dark-legacy"]`.
- Cache-bust en el `fetch` del HTML y en el `<script>` del home (`?v=REM-20260919-v2-portal-premium`).

### Visor e informe: remapeo de tokens (iframe aislado)

Ambos viven en `<iframe>`, así que sus `:root` están aislados. Se aplicó la **técnica de remapeo de
tokens** (📦751) en vez de reescribir reglas:
- **Visor** (`remisiones-view.css`): `--kair-primary #174ea6 → #2057b8`, `--kair-bg-app #f8f9fa → #fbfcfb`,
  texto `#1a1a2e → #14213d`, borde `#dee2e6 → #e8ebee`, fuente Roboto → **DM Sans**; el bloque oscuro pasó
  a la paleta premium (`#0f172a`/`#1a2334`/`#6ea8fe`). Se reemplazaron los 3 hex sueltos que quedaban
  (`rgba(77,166,255)` y el gradiente del skeleton). Se agregó el `<link>` de DM Sans + Manrope y cache-bust.
- **Informe** (`generar-informe-remision.css`): `--env-*` remapeados a premium; **se agregó modo oscuro**
  (no tenía) para los dos atributos; el header tenía colores **en línea** hardcodeados
  (`#ffffff`, `#dee2e6`, `#174ea6`, `#1a1a2e`) → tokenizados a `var(--env-*)` para que sigan el tema;
  el icono de empresa `kair-icon-building` (clase de `styles.css`, no disponible en el iframe) → SVG inline;
  fuente Roboto/Lexend → DM Sans/Manrope; cache-bust en el `<link>` y en la URL del iframe.
- **Alineación del informe (paso 3)**: el header tenía el **título pegado al borde izquierdo** mientras
  `.env-body` iba **centrado a 900px** → se veía desalineado de arriba a abajo. Se envolvió el contenido
  del header en **`.env-header-inner`** con el MISMO `max-width: 900px; margin: 0 auto; padding: 0 1.5rem`
  del cuerpo, así el título, el stepper y las tarjetas comparten los mismos bordes. Medido a 1904px de
  ancho: antes el título estaba en `x=81` y la tarjeta en `x=526`; ahora el stepper y la tarjeta quedan
  ambos en `x=526` (852px de ancho). **Regla**: cuando un header y su contenido no comparten contenedor,
  darles el mismo `max-width` + `margin: 0 auto` (y el mismo padding) para que los bordes coincidan.

### Cache-bust

- Portal: `?v=REM-20260919-v2-portal-premium` (fetch HTML + script home).
- Visor: `remisiones-view.css?v=REM-20260919-v2-premium` + `&v=REM-20260919-v2-premium` en la URL del iframe.
- Informe: `generar-informe-remision.css?v=REM-20260919-v2-premium` + `&v=…` en la URL del iframe.

### Verificación

- `node main/test-remisiones-v2.js` → **62/62 OK** (se agregaron 19 checks de portal/visor/informe).
- Arnés de Electron: portal sin fuga + claro/oscuro; visor con `--kair-primary #2057b8`; informe con
  `--env-primary #2057b8` (claro) y `#6ea8fe` (oscuro).
- ⚠️ **Nota del arnés**: el informe no se puede cargar con `loadFile` cuando el `<head>` tiene los CDN y
  no hay red (Electron rechaza con `ERR_FAILED`); para verificarlo se copia el HTML al módulo quitando
  los `<link>` con `https?` (conservando el CSS local) y se borra al terminar.

### Limpieza de código muerto (mismo 📦775)

El módulo tenía **9 archivos muertos** y ~600 líneas de código huérfano en el `logic.js`:

| Archivo | Por qué estaba muerto |
|---------|----------------------|
| `enviar-remision.html` / `.js` / `.css` | reemplazados por `enviar-remision-v2.*` |
| `control-remisiones.css` | su loader `_loadControlStyles()` **nunca se llamaba** |
| `restricciones-view.html` / `.css` / `restricciones-viewer.js` | 0 referencias (el visor real es `remisiones-view.*`) |
| `restricciones-component.js` | apuntaba a `restricciones-viewer.html` (archivo inexistente); solo lo listaba jsdoc |
| `index.js` | requería el `logic` (que **no** tiene `module.exports` y usa `window`) y nadie lo cargaba |

- **Métodos huérfanos del `logic.js`** (19, ~600 líneas): la cadena del explorador viejo
  (`showVerRemisionesPage` + `navigateToInitialPath`/`navigateToPath`/`updateNavBar`/`displayItems`/`previewDocument`),
  los helpers del flujo viejo (`createFileSelectionBox`/`createActionsBox`/`createDataDisplayBox`/`createLogBox`
  + `processSelectedPdf`/`displayExtractedData`/`handleGeneration`/`handleSendWhatsApp`/`handleSendEmail`),
  `createModernHeader`, `createHeader`, `_loadControlStyles` y `saveCellData`. Se eliminaron con un script que
  localiza la firma y **balancea llaves** (el `logic.js` pasó de ~1300 a 798 líneas, −37 %).
  Se verificó que ningún método vivo los llamara y que los nombres homónimos de otros módulos son independientes.
- **`modules/gestion-salud/index.js`**: se quitó el `require('./restricciones-medicas')` (ya no existe el `index`).
- **`jsdoc.json` + `scripts/generate-docs.js`**: se quitaron `restricciones-component.js` y `restricciones-viewer.js`.
- **Verificación**: `node --check` OK; `test-remisiones-v2.js` 62/62; y un **smoke funcional con Electron**
  (portal renderiza con sus 6 tarjetas → monta Enviar v2 → monta Control v2 → vuelve al portal, **0 errores de consola**).
- **Regla**: al migrar una pantalla, borrar los archivos que reemplaza y sus loaders. Un loader de CSS
  (`_loadControlStyles`) que nadie llama deja el `.css` huérfano y es fácil de pasar por alto.

### Pendiente

- El **portal** y el **visor** todavía cargan CDN (Google Fonts). Deuda offline conocida, igual que los
  viewers EMO. El **informe** que también cargaba CDN se eliminó en 📦776.
- El visor ya era `kair-*` v2.0 (jul-2026) con dark mode; solo se le remapearon los colores. Si se quiere
  el Header System v2 completo (icon chip + Manrope 800), es una pasada aparte.

---

## 🆕 Enviar Remisión · Flujo completo en UNA interfaz (📦776, 2026-09-19)

El flujo de **Enviar Remisión** (3.1.6) se veía como **dos pantallas distintas**: el componente premium
`enviar-remision-v2` (paso 1 "Cargar PDF") redirigía —tras extraer los datos— a la página vieja
`generar-informe-remision.html` (otro diseño, con su propio stepper de 4 pasos) y luego a un modal de
envío legacy (`env-modal.css`). El usuario pidió **continuidad y homogeneidad**.

### Qué se hizo

Se movieron los 3 pasos DENTRO del componente premium, con su track de 3 pasos:

| Paso | Acción | API directa (sin bridge) |
|------|--------|--------------------------|
| 1 · Cargar PDF | selecciona y procesa el PDF | `selectPdfFile` + `processRemisionPdf` |
| 2 · Generar informe oficial | muestra los datos extraídos y genera el documento | `generateRemisionDocument(extractedData, empresa)` |
| 3 · Enviar a la EPS | WhatsApp / correo con los contactos de la base | `getContactInfo(cedula, empresa)` + `sendRemisionByWhatsapp` / `sendRemisionByEmail` |

- El componente **ya no redirige**: `#mostrarPaso(n)` alterna las tarjetas (PDF / datos / enviar) y el
  track marca el progreso. Se eliminó el callback `onNavigateToInforme`.
- Como es un componente **embebido** (no iframe), llama a `window.electronAPI.*` **directo** — no usa el
  bridge de `postMessage`.
- **Vista previa ANTES de enviar** (buena práctica): el paso 3 abre con un panel "Vista previa del informe
  oficial" que muestra el nombre del documento, un resumen de los datos clave (trabajador, cédula, fecha,
  cargo) y un botón **"Ver informe"** que abre el `.docx` generado en el visor
  (`window.kairFV.openWithFileViewerFromPath(documentPath)`, con respaldo en `electronAPI.openPath`). Así
  el usuario corrobora el documento antes de elegir WhatsApp/correo.
- **Cancelar con confirmación**: en los pasos 2 y 3 el header muestra un botón **"Cancelar"** que abre un
  diálogo de confirmación; al confirmar, el componente limpia su estado (`extractedData`, `documentPath`,
  contactos) y vuelve al paso 1 **sin borrar los archivos ya generados**. El botón se oculta en el paso 1
  (no hay nada que cancelar) y el diálogo también se cierra al hacer clic en el fondo o en "Seguir".

### Limpieza

- **Borrados**: `generar-informe-remision.html/.js/.css` (la página vieja) y `env-modal.css` (el modal).
- **`logic.js`**: fuera `showGenerarInformePage`, `_renderSendOnlyPage`, `_loadContactInfo`,
  `_handleModalWhatsApp`, `_handleModalEmail`, `_closeSendModal`, `_loadModalStyles` y los 9 casos del
  bridge del flujo viejo (`select-pdf-file-request`, `process-remision-pdf-request`,
  `generate-remision-doc-request`, `send-remision-whatsapp-request`, `send-remision-email-request`,
  `informe-data-request`, `back-to-verify-request`, `continue-to-send-request`,
  `navigate-to-generar-informe-request`). Se **conservaron** los handlers del visor (preview, carpetas,
  descarga, `back-to-module-request`). El `logic.js` quedó en **~19 KB** (venía de ~60 KB).
- El módulo quedó con **10 archivos**, todos en uso.

### Verificación

- `node main/test-remisiones-v2.js` → **59/59 OK** (los checks del flujo viejo se reemplazaron por los del
  flujo nuevo: 3 pasos, `generateRemisionDocument`, `sendRemisionByWhatsapp/Email`, `getContactInfo`).
- **Smoke funcional con Electron** del flujo completo: clic en la zona de carga → paso 2 (6 campos
  extraídos, track en "Generar informe oficial") → "Generar Informe Oficial" → paso 3 (track en
  "Enviar a la EPS", contactos cargados) → clic en WhatsApp → enviado. **0 errores de consola.**
- Cache-bust: `?v=REM-20260919-v2-flujo-completo` en `logic.js` + `enviar-remision-v2.*`.

### Regla

Si un componente tiene un **track de pasos** pero delega los siguientes a **otra pantalla**, el usuario
verá un salto de diseño. La solución es traer todos los pasos al mismo componente (o replicar el mismo
Header/stepper/dialecto en la pantalla destino). Acá se eligió lo primero.

---

## 🆕 Control de Remisiones · filas basura del Excel (📦778, 2026-09-19)

El Control de Remisiones mostraba **18 "registros"** cuando en realidad había **8**. La causa estaba en el
archivo real `GI-FO-012 CONTROL DE REMISIONES.xlsx`: la hoja trae **una copia del encabezado en la fila 6**
(después de la primera tanda de datos) y **9 filas vacías** (7-15) antes de la segunda tanda.

- El handler `get-control-remisiones-data` (`main.js`) tomaba `allData[0]` como encabezados y
  `allData.slice(1)` como datos → el encabezado repetido aparecía como **fila de datos** (resaltada por
  `tbody tr:nth-child(even)`) y las filas vacías engordaban los KPIs (Pendientes).
- **Fix (backend)**: al leer se **normalizan** las filas (pad/truncate a las columnas del encabezado) y se
  **descartan** las filas vacías y las que repiten el encabezado. Log: `Filas de datos válidas: N
  (descartadas: X vacías, Y encabezados repetidos)`.
- **Fix crítico asociado**: al descartar filas, el **índice** de la fila ya no coincide con la **fila
  real** del Excel, y el guardado de la última columna (`updateExcelCell` con dirección A1) habría
  escrito en la fila equivocada. El backend ahora devuelve **`rowNumbers`** (nº de fila real, 1-based,
  por cada fila válida) y el componente lo usa para armar la dirección (`U17` en vez de `U7`).
- **Verificación**: contra el Excel real → 18 → **8 filas** (9 vacías + 1 encabezado descartados);
  KPIs `8 / 8 / 0`; mapeo `rowNumbers` correcto (la 6ª fila válida es la fila 17 del Excel). Test `65/65`.

### Regla

Un Excel "de control" puede tener **encabezados repetidos** y **filas vacías** en el medio (copiar/pegar,
bloques separados). Al leerlo para una tabla, **filtrar la basura en el backend** — y si se filtra,
devolver el **número de fila real** para que las escrituras por celda (A1) no se desalineen.

---

## 🆕 Estadísticas de Remisiones · nueva sección (📦779, 2026-09-19)

El card "Estadísticas de Remisiones" del portal 3.1.6 era un **placeholder** ("Próximamente"). Ahora es una
pantalla real que **deriva sus métricas del Control de Remisiones** (mismo origen: `getControlRemisionesData`
→ Excel `GI-FO-012`). No hay datos nuevos: se calcula sobre las filas del control.

### Métricas

- **KPIs**: total de remisiones, con seguimiento (última columna no vacía, igual que el Control), pendientes
  y **edad promedio**.
- **6 gráficos**: por sexo (donut SVG + leyenda), por tipo de evaluación (barras), por rango de edad
  (columnas `<30/30-39/40-49/50-59/60+`), por concepto médico laboral (barras), top cargos (barras, top 6)
  y por estado civil (barras).
- **Nota al pie**: cuántas remisiones se analizaron y cuántas no tienen fecha de atención.

### Decisiones

- **Normalización de valores** (`#normSexo`, `#normEval`, `#normConcepto`, `#normCivil`): el Excel real trae
  valores inconsistentes (`Masculino`/`MASCULINO`, `INGRESO`/`EVALUACIÓN MÉDICA DE INGRESO`,
  `Soltero(a)`/`SOLTERO(A)`/`SEPARADO PARENTESCO: NINGUNO`). Sin normalizar, cada variante sería una
  barra distinta.
- **Barras como cajas HTML** (lección 📦758): nunca SVG estirado. El donut sí es SVG (proporción fija).
- **Mismo dialecto premium v2** (`.remstat-scope`, tokens canónicos, dark en los 2 atributos), coherente
  con Enviar y Control.
- **Sin series por mes**: 5 de 8 remisiones no tienen "Fecha de Atención" en el Excel, así que una serie
  temporal saldría casi vacía. Se muestra la nota y se omite ese gráfico.

### Verificación

- Arnés de Electron con el Excel real: KPIs `8 / 8 / 0 / 47 años`, 6 gráficos (donut 2, eval 4, edad 5,
  concepto 2, cargos 6, EPS 3), claro y oscuro, **0 errores de consola**.
- Test `main/test-remisiones-v2.js` → **77/77 OK** (12 checks nuevos de Estadísticas).

### Archivos

- `estadisticas-remisiones-v2.js` + `.css` (nuevos), `restricciones-medicas-logic.js`
  (`showEstadisticasRemisionesPage`), `restricciones-medicas-home.html`/`.js` (`rmEnterEstadisticas`),
  `index.html` (CSS+JS con cache-bust `REM-20260919-v3-estadisticas`).

---

## 🆕 Investigación de Accidentes e Incidentes · Premium v2 (📦780, 2026-09-19)

El submódulo **3.2.2** (`modules/gestion-salud/investigacion-accidentes/`) tiene **3 vistas**, todas
montadas como **iframe** desde `investigacion-accidentes-logic.js`: el portal (`investigacion-home.html`),
"Realizar Investigación" (`investigacion-accidentes-view.html`) y "Ver Investigaciones"
(`investigaciones-view.html`). Se migraron las 3 al premium v2.

### 🚨 La fuga global más grave hasta ahora

`investigacion-accidentes-view.css` estaba linkeada **DOS veces**: dentro de su iframe (correcto) **y en
`index.html`** (línea 24). Esa copia global traía:

- `html, body { margin:0; height:100vh; overflow:hidden }` → forzaba el layout de TODA la app.
- `body { display:flex; flex-direction:column }` → global.
- `:root { --inv-* }` → global.
- `.k-section-card { … }` **sin scope** → afectaba a los ~20 módulos que usan esa clase genérica.

**Fix**: se **quitó el `<link>` global** de `index.html` (el iframe ya carga la hoja). Verificado con `rg`
que ningún elemento del app principal usa clases `inv-*` y que `styles.css` no define `.k-section-card`.

### Portal premium

- Marcado bajo `.inv-portal-scope` (sin `:root` ni `*` globales).
- Header System v2 (breadcrumb + icon chip + título Manrope + subtítulo + Volver).
- 2 KPI (Pendientes / Completadas) + 2 acciones principales + 4 herramientas, iconos SVG inline (sin CDN).
- Modo oscuro para `dark` y `dark-legacy`.

### Realizar / Ver: tokens + Header v2 + dark

- **Tokens** remapeados a la canónica (`#2057b8`, `#fbfcfb`, `#e8ebee`, DM Sans + Manrope, radios 12/16/20).
- **Header System v2** reemplazó el `k-section-card` viejo; los botones (`Visualizar/Imprimir/Volver`,
  `Actualizar/Volver`) conservan sus ids y pasaron a SVG inline (el botón Actualizar rota su SVG con la
  clase `fa-spin` que el JS ya agregaba → se define la animación `inv-btn-spin`).
- **Modo oscuro**: se usó el selector **`[data-theme^="dark"]`** (cubre `dark` Y `dark-legacy`) en TODO el
  CSS de las dos vistas (truco 📦773). En "Ver" la vista solo tenía 9 reglas oscuras (el header) → se
  agregó el bloque completo de tokens oscuros.
- **Bug de modo oscuro**: la card "Configuración" (`.inv-combined-left`) tenía `background:#fafbfc` +
  `[data-theme="dark"]` (sin `dark-legacy`) → quedaba blanca con el tema oscuro manual. Corregido.
- **Tipografía**: el header v2 vive FUERA de `.inv-layout` (que declaraba la fuente) → se movió
  `font-family: var(--inv-font-body)` al `body`.

### Cache-bust

- `index.html` → logic.js con `?v=INV-20260924-why-gaps`.
- `logic.js` → 4 URLs de iframe con tokens **independientes** por archivo tocado
  (`investigacion-home` = `INV-20260924-hf-config`, `investigaciones-view` = `INV-20260919-2col`,
  `investigacion-accidentes-view` = `INV-20260924-why-gaps`).
- Las hojas y scripts de cada vista con `?v=INV-…` — el token se bumpea en la vista
  (HTML) **y** en su URL de iframe (logic.js) cada vez que cambian.

### 📦781 — Aprovechar el ancho en maximizada

En **"Ver Investigaciones"** el contenido quedaba **centrado a 1200px** (`.inv-body { max-width:1200px;
margin:0 auto }`): a 1900px de ventana se perdían **~350px por lado**. Ahora:

- `.inv-body` → `max-width: none; margin: 0` + padding proporcional `clamp(14px, 1.6vw, 26px) clamp(14px, 1.8vw, 34px) 32px`.
- El buscador (con `flex:1` se estiraba a **~1300px**) → `max-width: clamp(340px, 30vw, 640px)`.
- El toggle de vista (grid/lista) → `margin-left: auto` (al extremo derecho de la barra).
- La vista **"Realizar" ya usaba todo el ancho** (su contenedor `.inv-main-wrapper`/`.inv-main-scroll` no tiene `max-width`); no se tocó.
- **Regla** (📦769): un `max-width` + `margin:0 auto` en el contenedor de contenido es una decisión de
  diseño que **desperdicia el ancho** en maximizada. Medir `getBoundingClientRect()` contra
  `window.innerWidth` antes de dejarlo.

### 📦782 — Lista en DOS columnas en maximizada

En "Ver Investigaciones" el modo **lista** (el que se ve por defecto; el botón muestra el icono
`fa-th-large` = "cambiar a cuadrícula") ponía las tarjetas a **todo el ancho** (~1884px con la ventana a
1900px), con muchísimo espacio vacío a la derecha. Ahora, **solo en maximizada**, la lista pasa a
**2 columnas**:

- `.inv-cards-list:not(.inv-cards-grid)` dentro de `@media (min-width: 1360px)` →
  `display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem 1rem; align-items: start`
  y las tarjetas pierden su `margin-bottom: 0.75rem`.
- **"Solo este modo"**: la vista de **cuadrícula** (`.inv-cards-grid`, `auto-fill minmax(340px,1fr)`)
  **NO se tocó** — verificado: a 1900px sigue dando sus 5 columnas de 350px.
- **Estado vacío y esqueleto**: al volverse grilla, `.inv-empty` y `.ks-list` (`KairSkeleton.list()`
  devuelve **UN** wrapper con N items) habrían quedado **a media columna**. Ahora llevan
  `grid-column: 1 / -1` (vale también para la cuadrícula, donde era un bug preexistente).
- **Medido** con un arnés de Electron (copia temporal del HTML sin los `<link>` de CDN): 1900px →
  `display:grid`, `cols: 900.09px 900.09px`, tarjetas lado a lado, `margin-bottom:0`; 1200px →
  `display:block`, 1 columna, `margin-bottom:12px`; vacío a 1900px → 1816px = ancho de la lista.
- **Regla**: para "N columnas solo cuando hay espacio" usar una **media query**, no `auto-fit` (en
  pantallas ultra anchas daría 3+ columnas). Y al convertir un contenedor a grilla, revisar **todos**
  sus hijos que no sean tarjetas (estados vacíos, esqueletos, avisos) y darles `grid-column: 1 / -1`.
- **Umbral**: `1360px` (cada columna ≈ 640px). Si en otra pantalla "maximizado" no alcanza, se ajusta
  ese número en la media query.

### 📦783 — Registro y Análisis Estadístico (3.2.3) al premium v2

El submódulo **3.2.3** (`modules/gestion-salud/registro-estadistico/`) es una tabla de 19 columnas
(paginada, filtrable, ordenable) + un tablero con 8 KPIs, 3 indicadores SG-SST (IFA/IG/PA), panel de
alertas, **9 gráficos Chart.js**, 2 tablas Top 5 y recomendaciones automáticas.

#### Cómo se monta (NO es iframe) — y su riesgo de fuga

`renderer.js#showRegistroEstadisticoContent` hace **`fetch` del HTML** y lo inyecta con
`container.innerHTML = doc.body.innerHTML` en el **documento PRINCIPAL**; el CSS se appendea al
`<head>` **global** y el JS también. O sea: el CSS de este módulo queda activo en TODA la app
mientras esté abierto (misma clase de riesgo que el portal de EMO 📦766 y el de Remisiones 📦775).

#### 🚨 Lo que se arregló: 2 clases GLOBALES de otros módulos

El header era una `.k-section-card` (clase que usan **~20 módulos**) y el botón usaba
`.header-back-btn`; el CSS definía `.kair-s323 .k-section-card { background:#ffffff; … }`. Eso
acoplaba este módulo con una clase compartida. Se reemplazó por un **Header System v2 propio**
(`.kair-s323-header-v2`, `.kair-s323-header-icon`, `.kair-s323-title`, `.kair-s323-btn`) y se
**borraron** esas reglas → el módulo ya no define ninguna clase genérica de otro módulo.

Además se scopearon las reglas que quedaban sueltas (`.k-spinner`, `.k-btn-sample`, `.k-action-btns`,
`.k-btn-action`, `.k-dash-actions`) y se renombraron los `@keyframes` globales
(`kSpinnerRotate`→`kairS323Spinner`, `kFadeIn`→`kairS323FadeIn`, `kSlideUp`→`kairS323SlideUp`).

#### Estrategia: remapeo de tokens conservando los NOMBRES

El JS escribe **estilos en línea** con `var(--k-text-muted)`, `var(--k-primary)`, etc. Por eso **no**
se renombraron los tokens: se conservaron los nombres `--k-*` y **solo se cambiaron los valores** a
la paleta canónica (`#2057b8` / `#14213d` / `#748096` / `#e8ebee` / `#fbfcfb`, DM Sans + Manrope).
Así los estilos en línea que genera el JS siguen funcionando sin tocar el JS.

- Se agregó `--k-radius-card: 20px` (los controles quedan en `--k-radius: 12px`) y se aplicó a
  tarjetas, toolbar, tabla, filtros y KPI cards.
- `--k-font` pasó de `'Segoe UI'` a `'DM Sans'`; los títulos usan `--k-font-display` (Manrope 800).

#### Chips y estados: `color-mix` en vez de 13 hex duplicados

Los badges (13 variantes), los estados SG-SST y las alertas tenían fondos hex fijos que se veían
mal en oscuro. Ahora el fondo **se deriva del color del texto**:

```css
.kair-s323-badge { background: color-mix(in srgb, currentColor 12%, transparent); }
```

y cada variante solo declara `color`. Sirve igual en claro y en oscuro sin duplicar reglas.

#### Modo oscuro: los DOS atributos con UN selector

Se reemplazó el bloque `[data-theme="dark"]` (que solo cubría el tema Sistema) por
**`[data-theme^="dark"]`**, que matchea `dark` **y** `dark-legacy` (el Oscuro manual).
⚠️ **Detalle que hay que recordar**: en oscuro `--k-primary` es un azul **claro** (`#6ea8fe`, para
que se lea como texto sobre fondo oscuro), así que **las superficies que usan `--k-primary` como
FONDO** (botón primario, cabecera del modal, badge de período, número de las recomendaciones,
paginación activa) necesitan un azul **oscuro** (`#2f5fa8`) o el texto blanco no se leería. Están
listadas en una sola regla agrupada.

#### Los 9 gráficos siguen el tema

Los datasets usaban la paleta vieja (`#174ea6`, `#28a745`…) y Chart.js no tenía colores de eje
propios → en oscuro los ejes quedaban grises sobre fondo oscuro. Ahora, al inicio de `renderCharts`:

```js
const _isDark = (document.documentElement.getAttribute('data-theme') || '').indexOf('dark') === 0;
Chart.defaults.color = _isDark ? '#98a6bf' : '#748096';
Chart.defaults.borderColor = _isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,33,61,0.08)';
Chart.defaults.font.family = "'DM Sans', system-ui, -apple-system, sans-serif";
```

(Chart.js usa esos defaults globales para ticks, leyenda y rejilla, así que con 4 líneas quedan los
9 gráficos alineados.) **Limitación conocida**: los colores se fijan al **renderizar** el tablero, así
que cambiar el tema con el tablero ya abierto no repinta los gráficos. En el flujo real no pasa: el
tema lo aplica `theme-manager.js` al arrancar, antes de que el módulo se cargue.

#### Verificación

- `node tests/registro-estadistico/test-premium.js` → **24/24 OK** (header v2, los **49 ids** del
  contrato con el JS, paleta canónica, cero selectores sueltos, cero `.k-section-card`, dark en los
  dos atributos, `color-mix`, keyframes con prefijo y los cache-bust).
- Arnés de Electron (con `window.Chart` simulado, porque el CDN no está offline): claro →
  `#fbfcfb` / `#2057b8` / tarjeta `20px` / título Manrope 800 20px; `dark` y `dark-legacy` → idénticos
  (`#0f172a` / `#6ea8fe` / `#1a2334`); pestaña Tablero → **8 KPIs, 3 SG-SST, 21 alertas, 2 Top 5,
  6 recomendaciones y los 9 gráficos** con sus ids; badge de período en oscuro → `#2f5fa8`;
  **0 errores de consola**.
- Cache-bust: token `RES-20260919-v1-premium` en el CSS, el HTML, el JS y el guard del `<link>`.
- ⚠️ **EOL**: el directorio es `i/lf w/crlf`. Al tocar los 3 archivos el diff salió de **miles de
  líneas**; se normalizaron a **LF** y el diff bajó a 246/147 (CSS), 29/18 (HTML) y 20/13 (JS).
  Mismo gotcha de 📦773.

#### Regla

Si un módulo se monta con `innerHTML` en el documento principal, **revisar qué clases GLOBALES usa
su HTML** (`.k-section-card`, `.header-back-btn`, `.card`, `.modal`, `.badge`…): mientras el módulo
esté abierto, su CSS puede redefinirlas para toda la app. Reemplazarlas por clases propias del módulo.

### 📦784 — Frecuencia de la Accidentalidad (3.3.1) al premium v2

El submódulo **3.3.1** (`modules/gestion-salud/frecuencia-accidentalidad/`) tiene una tabla mensual
**editable** (12 filas × AT/Trabajadores, se guarda al confirmar con Enter/blur), 5 KPIs, tarjeta de
meta, un **gráfico SVG nativo** (12 barras + línea de meta), 12 tarjetas de mes, 4 colapsables con
barras de progreso, la referencia del indicador y la metodología.

#### 🚨🚨 La fuga más grave de la serie: `:root` + `*` + `body` GLOBALES

`renderer.js#showFrecuenciaAccidentalidadContent` monta el módulo con `fetch` + `innerHTML` en el
**documento PRINCIPAL** y appendea su hoja al `<head>` **global**. Esa hoja traía:

1. **`:root { --kair-primary, --kair-card, --kair-text, --kair-shadow, … }`** → sobrescribía tokens
   de `shared/kair-design-tokens.css` (`--kair-card`, `--kair-text` y `--kair-shadow` chocaban por
   NOMBRE EXACTO). Como el `:root` del módulo va después en la cascada, **podía dejar el tema oscuro
   en blanco** mientras el módulo estaba abierto.
2. **`* { box-sizing; margin:0; padding:0 }`** → **borraba los márgenes y rellenos de TODA la app**.
3. **`body { overflow:hidden; height:100% }`** → forzaba el layout de la ventana completa.
4. **~60 clases `.kair-*` sin scope** (`.kair-card`, `.kair-kpi`, `.kair-table`, `.kair-btn`,
   `.kair-badge`, `.kair-empty`, `.kair-toast`, `.kair-input`, `.kair-progress-*`, `.kair-collapsible*`,
   `.kair-month-card*`, `.kair-target-*`, …) que **chocan** con `shared/kair-components.css`,
   `shared/kair-premium.css` y `styles.css` (p. ej. el `.kair-kpi` del módulo imponía
   `text-align:center` a los `.kair-kpi` premium de otros módulos).

#### Cómo se arregló

1. **Tokens propios `--freq-*`** (renombrados los 104 usos) y movidos de `:root` a
   `.frecuencia-container`. Se conservaron los NOMBRES originales solo cambiando el prefijo, y los
   valores se remapearon a la paleta canónica (`#2057b8` / `#14213d` / `#748096` / `#e8ebee` /
   `#fcfbfb`, DM Sans + Manrope, radios 20px tarjeta / 12px control).
2. **Reset scoped**: `*` → `.frecuencia-container, .frecuencia-container *` (box-sizing) y
   `.frecuencia-container *` (margin/padding). `body` → se fusionó en la regla del contenedor.
3. **139 selectores scopados** bajo `.frecuencia-container` con un script. ⚠️ **Ojo con los
   selectores MULTILÍNEA**: un script que solo mira líneas que terminan en `{` deja la PRIMERA línea
   de un selector partido sin scopar (pasó con `.kair-table thead th,` dentro de 2 `@media`). Hay que
   verificar con una búsqueda de selectores sueltos, no confiar en el script.
4. **Header System v2** propio (`.freq-header-v2`, `.freq-header-icon`, `.freq-title`, `.freq-btn`,
   `.freq-select`) y se **borraron** las reglas `.k-section-card` / `.header-back-btn` /
   `.header-action--ghost`.
5. **`@keyframes` renombrados**: `pulse`→`freqPulse`, `slideIn`→`freqSlideIn` (eran nombres globales).
6. **Modo oscuro con `[data-theme^="dark"]`** (antes solo `[data-theme="dark"]`, así que el tema
   Oscuro manual quedaba claro) + el detalle de que las superficies con acento de FONDO necesitan la
   versión oscura del acento (`#2f5fa8`) para que el texto blanco se lea.

#### El gráfico (y las celdas) ahora leen la paleta

Todos los colores del gráfico SVG, de la tabla, de las tarjetas de mes y de las barras de progreso
estaban **hardcodeados en el JS** (`#174ea6`, `#28a745`, `#ffc107`, `#dc3545`, `#6c757d`, `#212529`…)
y no seguían ni la paleta ni el tema. Ahora hay 2 helpers:

```js
function tok(name, fallback) {           // lee un token CSS del módulo
  var host = document.querySelector('.frecuencia-container') || document.documentElement;
  return getComputedStyle(host).getPropertyValue(name).trim() || fallback;
}
function palette() { return { bg: tok('--freq-bg','#fbfcfb'), danger: tok('--freq-danger','#da5563'), … }; }
```

y `renderChart` / `renderTabla` / `renderColapsables` / `renderMonthCards` hacen `var C = palette();`
al entrar (se relee en cada render, así sigue el tema).

⚠️ **Nota sobre SVG**: `fill="var(--x)"` como ATRIBUTO no es confiable; por eso se lee el valor con
`getComputedStyle` y se concatena el color ya resuelto.

#### Limpieza

- **Código muerto eliminado**: `buildGridLines()` y `buildChartPoints()` (nunca se llamaban) y
  `escapeHtml()` (solo lo usaba el anterior).
- **Iconos**: el header usaba `bi bi-copy` / `bi bi-arrow-clockwise` de Bootstrap Icons, cuyo
  `<link>` vive en el `<head>` del HTML… que **se descarta** al inyectar solo `doc.body.innerHTML` →
  **nunca renderizaban**. Ahora son SVG inline.
- El SVG del gráfico ganó `display:block` (evita el hueco de línea base). Mantiene `height:auto`
  porque su contenedor usa `min-height` (no alto fijo), así que no aplica el riesgo de 📦757.
- El cache-bust del `<script>` pasó de `?_t=Date.now()` (rompía toda cache) a `?v=TOKEN`.

#### Gráfico y tabla en PARALELO en maximizada

En maximizada el gráfico ocupaba todo el ancho y la tabla quedaba debajo. Ahora, en
`@media (min-width: 1360px)`, `.freq-duo` (que envuelve las 2 tarjetas en el HTML) usa
`grid-template-columns: minmax(0,1fr) minmax(0,1fr)` → **gráfico y tabla lado a lado**. En ventanas
normales van uno debajo del otro (`grid-template-columns: 1fr`).

Detalle fino: la tabla mide ~773px de alto y el gráfico ~382px, así que con `align-items: start`
quedaba un hueco visible debajo del gráfico. Las tarjetas del `duo` se volvieron
`display:flex; flex-direction:column` con `.kair-chart-container { flex: 1 }` para que **se estiren
al mismo alto** y el gráfico se centre en el espacio libre **sin deformarse** (el SVG conserva su
proporción por el `viewBox` + el `preserveAspectRatio` por defecto, que lo escala para encajar).
Medido: a 1600px las 2 tarjetas miden 773px de alto; a 1200px vuelven a su alto natural (508 / 773)
apiladas.

**Regla**: al poner 2 tarjetas de contenido en paralelo, decidir explícitamente qué pasa con el
alto — `align-items: start` deja huecos si los contenidos difieren mucho; `stretch` + `flex: 1` en
el hijo que debe crecer da tarjetas alineadas.

**Y la tabla tiene que ENTRAR COMPLETA en su columna**: con `white-space: nowrap` en el `th`, el
ancho **mínimo** de la tabla era **836px** (los encabezados "Trabajadores" e "Índice Frecuencia" no
podían partir), así que en la columna de ~800px del layout en paralelo la última columna (**Estado**)
quedaba cortada y aparecía **scroll horizontal** — el usuario lo reportó con captura. Con
`white-space: normal` + `line-height: 1.2` en el `th` el mínimo bajó a **≤620px** y la tabla entra
completa (medido: a 620/660/700/740/780/820/900px NO desborda, y el encabezado sigue en **una** línea
de 40px porque las palabras caben). **Regla**: si una tabla va a vivir en una columna, su `th` no
puede llevar `nowrap`; hay que medir el `scrollWidth` contra el `clientWidth` a varios anchos.

**Y después el usuario pidió ANCHOS FIJOS en maximizada** (que la tabla no se reparta según el
contenido): dentro del mismo `@media (min-width: 1360px)` se agregó `table-layout: fixed` +
`width` por columna (`th:nth-child(n)`) más `overflow:hidden; text-overflow:ellipsis` en `th`/`td`
como red. Reparto final (**suma exacta 100%**): **Mes 10% · AT 8% · Trabajadores 24% ·
Índice Frecuencia 28% · Meta 8% · Estado 22%**. Medido (con **0 celdas recortadas** y sin desborde):

| Pantalla | Ancho tabla | Mes | AT | Trabajadores | Índice Frecuencia | Meta | Estado |
|---|---|---|---|---|---|---|---|
| 1920 (vw 1904) | 845px | 84.50 | 67.59 | 202.80 | 236.61 | 67.59 | 185.95 |
| 1900 (vw 1884) | 835px | 83.53 | 66.83 | 200.50 | 233.92 | 66.83 | 183.84 |
| 1760 (vw 1744) | 768px | 76.81 | 61.45 | 184.38 | 215.11 | 61.45 | 169.05 |
| 1600 (vw 1584) | 691px | 69.14 | 55.31 | 165.94 | 193.59 | 55.31 | 152.16 |
| 1440 (vw 1424) | 615px | 61.45 | 49.16 | 147.50 | 172.11 | 49.16 | 135.27 |

Por debajo de 1360px vuelve a `table-layout: auto` (la tabla se apila y ocupa todo el ancho).

⚠️ **Gotcha de los porcentajes con `table-layout: fixed`**: si los 6 `width` **no suman 100%**, el
sobrante se reparte proporcionalmente y los anchos reales NO son los declarados (p. ej. con
8.5/10/19/22/12/20 = 91.5% la columna AT terminó midiendo 92px en vez de 84px). Dejar la suma en 100.
⚠️ **Gotcha de la simulación**: el arnés usaba los meses COMPLETOS ("Septiembre") y reportaba
recortes que en la app no existen, porque el Excel trae las **3 letras** (ENE, FEB, SEP…). Verificar
el dato real antes de "arreglar" un ancho por un recorte que no ocurre.
⚠️ **Límite real**: el badge automático (🤖, que marca un mes con AT contado desde la caracterización)
necesita ~58px, así que con AT por debajo de 8% se recorta en ventanas de ≤1600px (en maximizada no).

⚠️🚨 **Lección de cache-bust — son DOS niveles y costó 2 rondas de validación**: hay un módulo que se
monta desde `renderer.js` (`showFrecuenciaAccidentalidadContent`), así que el cache-bust tiene **dos
eslabones**:

1. `index.html` → `<script src="renderer.js?v=...">` (el token del PROPIO renderer).
2. `renderer.js` → `const TOKEN = 'FREQ-...'` (el que versiona el CSS/HTML/JS del módulo).

Si se bumpea **solo el 2**, la app sigue cargando el `renderer.js` **cacheado**, que contiene el
`TOKEN` viejo → el navegador sirve el CSS viejo y **el cambio no se ve NUNCA** (el usuario mandó
captura dos veces de la tabla cortada creyendo que el arreglo no funcionaba). Pasó exactamente eso:
se bumpéo `TOKEN` a `v6` pero `index.html` seguía con `renderer.js?v=20260916-premium-split`.
**Regla: al tocar `renderer.js` hay que bumpear LOS DOS tokens.** El test ahora lo verifica
(`index.html: el <script> de renderer.js lleva un token`), pero eso solo comprueba que EXISTA uno —
si el cambio "no se ve", **lo primero es revisar si el `renderer.js` del `index.html` quedó viejo**.

#### 🚨🚨 El `min-width` AJENO: por qué la tabla medía 900px en un contenedor de 584px

Síntoma: `table-layout: fixed` + `width: 100%` + 6 columnas que suman 100%… y la tabla **igual** medía
**900px** con scroll horizontal y la columna "Estado" cortada.

Receta de diagnóstico que lo cerró (pedírsela al usuario para la consola):

```js
const t = document.querySelector('.kair-table');
const w = document.querySelector('.kair-table-wrap');
console.log('wrap', w.clientWidth, w.scrollWidth);
console.log('table', getComputedStyle(t).width, getComputedStyle(t).tableLayout);
[...t.querySelectorAll('thead th')].forEach((th, i) => console.log(i + 1, getComputedStyle(th).width));
```

Dio `layout: fixed` (o sea, **la hoja nueva SÍ estaba cargada**) pero `cssWidth = 900px` y las
columnas exactamente 12/9/22/25/9/23% **de 900** → `width: 100%` no se respetaba: algo **externo** le
imponía un ancho mínimo. Y sí: otros módulos traen reglas **SIN SCOPE** como
`table.kair-table { min-width: 1080px }` (Archivo y Retención, `archivo-retencion-view.css:181`) que se
inyectan en el `<head>` **global**.

**Fix — blindar la tabla**:
```css
.frecuencia-container .kair-table {
  width: 100%;
  min-width: 0 !important;
  max-width: 100% !important;
  table-layout: fixed;
}
```
**Regla**: cuando un módulo usa una clase **GENÉRICA** del design system (`.kair-table`, `.kair-card`,
`.kair-kpi`, `.kair-empty`…), **otro módulo puede estar redefiniéndola globalmente**. Antes de pelear
con el layout, volcar las reglas que matchean el nodo y ver quién setea `width`/`min-width`/`max-width`.
Y ojo: acá se gastaron **3 rondas de validación** suponiendo que era caché cuando el CSS ya estaba bien.

#### Alto de filas, alto del gráfico y grilla de meses (los 3 ajustes finos que pidió el usuario)

1. **Alto de filas**: lo maneja el `padding` de `td`/`th` + el de las celdas editables. Bajó de **48 a
   35px** con `td { padding: 0.3rem }`, `th { padding: 0.5rem }` y `.kair-editable { padding: 0.1rem 0.4rem }`
   (y los mismos valores en los `@media` de ≥1920 y ≥2560, si no vuelven a crecer en monitores grandes).
2. **Alto del gráfico**: el `viewBox` tenía un **tope de ancho** (`baseWidth` 800/1200/1400) y un alto
   fijo del **40% del ancho**, así que dentro de la tarjeta estirada dejaba franjas vacías. Ahora el
   viewBox se ajusta **exactamente** al contenedor:
   ```js
   var W = Math.max(320, Math.round(containerWidth));
   var H = Math.max(320, Math.round(W * 0.4), container.offsetHeight || 0);
   ```
   Con eso el SVG (que va con `width:100%`) llena la caja: el intervalo del eje pasó de **48 a 86px**.
   ⚠️ **Hay que renderizar la TABLA ANTES del GRÁFICO** en `renderizar()`, porque el gráfico mide el
   alto de su contenedor y ese alto depende de la tabla (que es la que estira la fila del `duo`).
   ⚠️ Y hay que **re-renderizar al redimensionar** (debounce 250 ms) guardando **UN solo** handler en
   `window.__freqResizeHandler` (con `removeEventListener` del anterior) para que reabrir el módulo no
   acumule listeners ni deje closures con datos viejos.
3. **Grilla "Detalle por Mes"**: `repeat(6, minmax(0,1fr))` en ventana (2 filas de 6) y
   `repeat(12, minmax(0,1fr))` en `@media (min-width: 1360px)` (1 fila de 12). Con 12 columnas hay que
   achicar un poco el contenido de la tarjeta (`padding`, nombre, valor y detalle) o el texto se corta
   (medido: 139px por tarjeta a 1920, 101px a 1453, **0 recortes**).

#### Verificación

- `node tests/frecuencia-accidentalidad/test-premium.js` → **28/28 OK** (incluye "NO hay `:root`
  global", "NO hay reset `*` global", "NO hay regla `body` global", "TODOS los selectores están bajo
  `.frecuencia-container`" y "los 32 ids del contrato siguen presentes").
- Arnés de Electron con el puente simulado: claro → contenedor `#fbfcfb`, `--freq-primary` `#2057b8`,
  tarjetas 20px, título Manrope 800, **5 KPIs, 12 filas, 12 tarjetas de mes, 4 colapsables, 9 barras**
  y el gráfico (580px) con rellenos `#fbfcfb` + `#1bb888`×10 + `#e7a224`×2; `dark` y `dark-legacy` →
  idénticos (`#0f172a` / `#6ea8fe` / `#1a2334`) y el gráfico **cambia a `#3ecf9a` / `#f0b45a`**;
  badge en oscuro `#2f5fa8`; **0 errores de consola**.
- Cache-bust: token `FREQ-20260919-v1-premium` en el CSS, el HTML, el JS y el guard del `<link>`.
- EOL: el directorio es `i/lf w/crlf`; se normalizaron los 3 archivos a **LF** (diff final:
  395/332 CSS, 33/24 HTML, 41/45 JS).

### Verificación

- Arnés de Electron (una vista por proceso): portal OK; "Realizar" con `headerV2:true`, `#2057b8`, DM Sans;
  "Ver" con `headerV2:true`, DM Sans; claro y oscuro. **0 errores de consola** (el único
  `KairSkeleton is not defined` es del arnés: en la app el shim lo toma del padre).
- Test `tests/investigacion-accidentes/test-premium.js` → **28/28 OK**.
- ⚠️ Nota del arnés: `loadFile` con `query` y el encadenado de vistas en el mismo proceso daban
  `ERR_FAILED`; se resolvió cargando **una vista por proceso** y sin `query`.

### Regla

Cuando un CSS se linkea **globalmente** además de dentro de su iframe, revisar si trae `html`/`body`/`*`
o clases genéricas (`.k-section-card`): aunque el módulo "funcione", está pisando a toda la app.

---

## 🆕 Remisiones · Alineación a la paleta canónica (📦777, 2026-09-19)

Al validar contra los módulos principales (**Recursos**, **Gestión Integral**), los dos componentes
embebidos de Remisiones (`enviar-remision-v2` y `control-remisiones-v2`) traían una **paleta propia** que
no coincidía con el resto del sistema. Se remapearon sus tokens (técnica 📦751) a los valores canónicos de
`shared/kair-design-tokens.css`:

| Token | Antes (propio) | Ahora (canónico) |
|-------|----------------|------------------|
| azul | `#2456d6` | `#2057b8` |
| azul oscuro | `#1b3f9e` | `#172c4c` |
| azul suave | `#e8eefc` | `#eaf1fb` |
| fondo | `#eef1f7` | `#fbfcfb` |
| borde | `#e3e8f2` | `#e8ebee` |
| tinta | `#16233b` | `#14213d` |
| muted | `#66738c` | `#748096` |
| faint | `#93a0b8` | `#aab1bd` |
| verde | `#0f9d63` | `#1bb888` |
| verde suave | `#e3f6ec` | `#e6f5ef` |
| ámbar | `#b97e12` | `#e7a224` |
| ámbar suave | `#fbf1da` | `#fbf0db` |
| rojo | `#d64550` | `#da5563` |
| rojo suave | `#fbe7e9` | `#fae6e9` |
| radio | `14px` / `10px` | `20px` / `12px` |
| fuente | `'Segoe UI', 'Manrope'` | `'DM Sans'` (UI) + `'Manrope'` (títulos) |
| sombra | `0 1px 2px …, 0 8px 24px rgba(22,35,59,.07)` | `0 2px 7px rgba(37,56,82,.08)` |
| oscuro | `#0f1622` / `#1a2434` / `#5b8def` | `#0f172a` / `#1a2334` / `#6ea8fe` |

- Los **títulos** (`.remenv-header__title`, `.remenv-card__title`, `.remctl-header__title`,
  `.remctl-card__title`) pasaron a `Manrope` 800 y subieron 1px (18/15px) para el look display canónico.
- Se agregó `--remenv-font-display` / `--remctl-font-display` (Manrope).
- **Verificación**: arnés de Electron que compara los tokens computados del v2 contra los canónicos →
  **`alineado: true`**, sin fallos; fuentes `DM Sans`, radio `20px`, títulos `Manrope`. Test `63/63`.
- **Regla**: al migrar un submódulo, **usar la paleta canónica** (`shared/kair-design-tokens.css`), no una
  propia. Si el diseño trae su propia paleta, remapear los tokens a los valores canónicos (no reescribir
  reglas). Un azul distinto (`#2456d6` vs `#2057b8`) se nota al lado de los demás módulos.

### 📦793 — Inspecciones Sistemáticas (4.2.4) — hub al premium v2

El **hub** (landing) del submódulo `4.2.4 Inspecciones Sistemáticas a las Instalaciones, Máquinas o Equipos`
(`modules/gestion-peligros/inspecciones/`) migra al **Patrón A premium** (mismo que los 8 módulos home rediseñados
en 📦730-737). Las 7 vistas funcionales (dashboard, historial, detalle, 4 formularios) **quedan intactas** y siguen
usando el header legacy `.k-module-header` — `buildHeader()` en `inspeccion-templates.js` no se toca.

#### Estructura nueva del hub (de arriba a abajo)

1. **Page-header premium** (`.kair-page-header`): icono decorativo en chip 44×44 (`.kair-badge-ico`, fondo
   `--kair-hover-soft` + color `--kair-primary`), título Manrope 800 20px (`.kair-title`), subtítulo muted 12.5px
   (`.kair-sub`), 2 acciones a la derecha (`.kair-actions` con `Ver Historial` outline + `Volver` ghost).
   **Sin breadcrumb pills, sin chip de empresa** — limpio como la referencia Evaluación Inicial.
2. **Hero card con score compuesto** (`.kair-hero-card`): bloque grande con score `X%` (color `--kair-primary`,
   42px/800) a la izquierda separado por border-right, título "Realizar Nueva Inspección" + descripción a la
   derecha. Fondo `linear-gradient(135deg, var(--kair-card) 0%, var(--kair-hover-soft) 100%)`.
   **Score** = `closedCount / total * 100` donde `closedStatuses = ["Ejecutado","Completada","Cumplida"]`.
3. **3 metric cards** (`.kair-metric-strip` + `.kair-metric-card`): grid 3-col con icono 42×42 a color (blue/amber/red)
   + valor 24px/800 + label uppercase 11px + sub 11px muted. Cálculos:
   - `Inspecciones del mes` (azul): `count(date >= firstOfMonth)`
   - `No conformidades` (amber): `count(status ∈ {Pendiente, Vencida, Sin Iniciar})`
   - `Próximas a vencer` (rojo): `count(status ∈ {Pendiente, Programada, Sin Iniciar} ∧ date ∈ [now, now+7d])`
4. **Chart SVG nativo** (barras horizontales, sin Chart.js): label "Nombre" + valor "X (Y%)" arriba, barra
   coloreada con el `accent` del tipo (que ya viene en `INSPECTION_TYPE_LIST`). Empty state si `total === 0`.
5. **Module grid** (`.kair-module-grid`): 4 cards de tipos (botiquín/extintores/instalaciones/equipos_emergencia)
   con chip de código (`.kair-module-card__code`, fondo `hover-soft` + color `primary`) + revisión + título +
   descripción + **flecha a la derecha** que se desplaza 2px al hover.
6. **Inspecciones Recientes** (5 últimas): header de sección (`.kair-section-head`) con título uppercase + botón
   ghost "Ver historial completo", tabla intacta.

#### Layout flex chain (crítico para scroll interno)

```js
var wrap = tpl.el("div", { className: "kair-app" });
wrap.style.cssText = "height:100%;display:flex;flex-direction:column;min-height:0;";

var main = tpl.el("main", { className: "insp-hub-home" });
main.style.cssText = "flex:1;min-height:0;overflow-y:auto;padding:0 1.5rem 1.5rem;box-sizing:border-box;";
```

Sin `display:flex;flex-direction:column;min-height:0`, el contenido se desborda sin scroll (mismo bug histórico
que 📦735 Amenazas).

#### CSS (~451 líneas nuevas)

- 11 clases premium nuevas scopeadas bajo `.kair-app .kair-*`: `.kair-page-header`, `.kair-badge-ico`,
  `.kair-titles`, `.kair-title`, `.kair-sub`, `.kair-actions`, `.kair-btn` (+ variantes `primary`/`outline`/`ghost`),
  `.kair-hero-card` (+ 6 sub-clases), `.kair-metric-strip`, `.kair-metric-card` (+ 6 sub-clases + 3 variantes
  `--blue`/`--amber`/`--red`), `.kair-chart-svg` + `.kair-chart-row` (+ 4 sub-clases + `.kair-chart-empty`),
  `.kair-module-section`, `.kair-section-title`, `.kair-section-head`, `.kair-module-grid`,
  `.kair-module-card` (+ 7 sub-clases).
- Tokens **locales** del scope (no toca el design system global): `--kair-primary`, `--kair-hover-soft`,
  `--kair-text-muted`, `--kair-text-soft`, `--kair-card`, `--kair-border`, `--kair-muted-bg`, `--kair-radius-sm`,
  `--kair-radius-md`, `--kair-shadow-card`, `--kair-transition`, `--kair-font`.
- **Responsive**: `@media (max-width: 1024px)` → metric strip a 2-col + grid 1-col + hero en columna.
  `@media (max-width: 640px)` → metric strip a 1-col + header wrap.
- **Dark theme** con selectores `[data-theme="dark"]` + `[data-theme="dark-legacy"]` (8 overrides para hero,
  page-header, badge-ico, metric card, module card).
- **Sintaxis validada** con `node --check` exit 0.

#### Cache-bust

- `inspeccion.css?v=20260915-hero-scope-fix` → `?v=20260920-hub-premium`

#### Lo que NO se tocó

- `inspeccion-templates.js` — `buildHeader()` queda legacy (lo siguen usando dashboard, historial, detalle,
  4 formularios).
- `api.js`, `store.js`, `router.js`, IPC, BD — intactos.
- `inspeccion.css` línea 116-240 (`.k-module-header` legacy) — sigue ahí para las otras vistas.

### 📦794 — Identificación de Peligros (4.1.2) migrada al premium v2

Migración completa del submódulo `4.1.2 Identificación de Peligros` al dialecto premium v2 (mismo patrón
aplicado en 📦783 Registro, 📦784 Frecuencia, 📦785–792). Incluye:

- **Bridge IPC** (`main/identificacion-peligros-bridge.js`): reescrito con tokens scoped, modo oscuro en
  ambos atributos (`[data-theme^="dark"]`), BOM/EOL normalizado a LF.
- **Sub-componentes JS** (`kair-matriz-peligros-{header,matriz,indicadores,priorizacion,service}.js` +
  `kair-matriz-peligros.js`): migrados al dialecto premium v2 con Header System v2, tokens scoped, sin
  colores hardcodeados, sin selectores globales.
- **CSS** (`kair-matriz-peligros.css`): scoped bajo `.km-wrapper`, modo oscuro completo, donut theme-aware
  con helpers `tok()`/`palette()` que leen tokens CSS computados (en vez de hex hardcodeados).
- **Home del módulo padre** (`gestion-peligros-home.js`): ajustes de integración.
- **Test nuevo** (`main/test-identificacion-peligros.js`, 149 líneas, 9 contratos): valida tokens nuevos en
  `.km-wrapper`, modo oscuro con re-definición de tokens (ambos atributos), reglas de especificidad oscuras,
  sin colores sueltos en secciones claras, integridad estructural del CSS, donut con clase + sin atributos
  stroke muertos, colores inline theme-aware, iconos 0 Font Awesome con Bootstrap local, cableado intacto.

#### Reglas recordadas (ya estaban, ahora aplicadas a 4.1.2)

- Scope `:root` + `*` + `body` GLOBALES son la fuga más grave: pisar tokens y márgenes de TODA la app.
  Mover a scope del módulo (`.km-wrapper`).
- Modo oscuro debe cubrir **ambos atributos** (`data-theme="dark"` + `data-theme="dark-legacy"`) con
  selector `[data-theme^="dark"]`.
- Gráficos que dependen del tema: helpers `tok()` / `palette()` que leen tokens CSS computados con
  `getComputedStyle`, en vez de hex hardcodeados.
- Tests de contratos: validar IDs, scopes, ausencia de selectores globales y de colores hardcodeados.



### 📦796 — Inspecciones Sistemáticas (4.2.4): premium completo de las 7 vistas

Cierre de la migración iniciada en 📦793 (hub). Las 7 vistas funcionales (hub, dashboard de programa anual,
historial, detalle y los 4 formularios) migran al header premium v7 (`buildHeader` con clases `kmi-*`,
transparente, breadcrumb + Sincronizado + Volver), manteniendo intacto todo el flujo de datos.

- **Header premium v7** en `inspeccion-templates.js` → heredan las 7 vistas; cache-bust `20260921-premium-v2-inspecciones`.
- **Hub reescrito** (referencia): hero oscuro con score compuesto + donut SVG nativo + 4 KPIs + formatos
  verticales + recientes/avance.
- **Historial**: filas con píldoras de filtro por tipo; **Dashboard/Programa**: tabla mensual con tokens;
  **Detalle + 4 formularios**: tokens del sistema + modo oscuro redefinido bajo `[data-theme] .kair-app`.
- **Verificación visual** en claro/oscuro, maximizado y ventana 1000px.

### 📦797 — Mantenimiento Periódico (4.2.5): header premium

`mantenimiento-component.js` + `mantenimiento.css` alineados al header premium (mismo lenguaje visual
del v7): título Manrope 800, acciones consistentes, tokens canónicos. Cache-bust `20260921-premium-header`
(5 referencias en `index.html`). El cronograma y el resumen (vistas funcionales) no cambian de flujo.

### 📦798 — Inspecciones (4.2.4): reconexión a la carpeta real de la empresa

El submódulo vuelve a leer/escribir la carpeta SG-SST de la empresa en Drive (la conexión existió en
📦332/338 de mayo 2026 y quedó desactivada en la reconstrucción 📦500; la firma `getCompanyRootPath`
llegaba por deps pero no se usaba).

- **Programa anual desde el Excel real**: `programa:obtener` lee `PROGRAMA DE INSPECCIONES.xlsx` de la
  carpeta 4.2.4 (encabezados de mes detectados por texto Ene…Dic, no por posición fija — el Excel del
  cliente tiene filas desalineadas; celdas de error `#VALUE!` y zona de firmas ignoradas; códigos
  `p`=programado, `c`=cumplido). `programa:actualizarActividad` con id `excel:<empresa>:<año>:<fila>`
  escribe la `c` en el Excel con **respaldo automático en `backup/` antes de cada escritura** (patrón
  📦332). Cache en memoria por mtime (el calendario itera mes a mes). Sin carpeta/Excel → cae a la
  libreta interna como antes.
- **Histórico visible**: nuevo canal `inspeccion:explorarHistorico` escanea `Inspeciones realizadas/
  <Sede>/<DD-MM-AAAA>/` y la vista de Historial muestra la sección "Archivo histórico · carpeta de la
  empresa" (visitas con conteo de fotos/formatos + formatos sueltos tipo `GI-FO-026 1-2026.xlsx`),
  con `inspeccion:abrirRuta` (shell.openPath) para abrir cada carpeta.
- **Archivado**: `inspeccion:archivar` genera el formato oficial de la inspección y lo guarda en
  `Inspeciones realizadas/<sede>/<fecha>/`; botón "Archivar en carpeta" en el detalle.
- **Migración legado**: `inspecciones_data.json` de la carpeta (formato 📦332) se importa a la libreta
  interna una sola vez, idempotente por id (`meta.legacyFolderImportedFor`).
- **Fix de fechas** (todo el submódulo): `formatDate` parseaba las ISO sin hora como UTC y en Colombia
  (UTC-5) mostraba un día atrás; ahora se construye fecha local.
- **Preload**: 3 métodos nuevos (`inspeccionExplorarHistorico`, `inspeccionAbrirRuta`, `inspeccionArchivar`).
- **Test nuevo** `main/test-inspecciones-carpeta.js`: **26/26** contra copia de la estructura real
  (Excel intacto verificado). Cache-bust `20260921-carpeta-v1`.

### 📦799 — Home Gestión de Peligros y Riesgos: fix de datos reales en hero, tarjetas y gráficas

El home premium (📦754) mostraba TODO en cero aunque la empresa tuviera datos. Dos fallos combinados:

1. **La información nunca llegaba a la vista**: `refreshStats()` guardaba las respuestas en la caché
   global de sesión pero jamás asignaba `this.peligrosStats` (lo que lee `renderMainArea()`). Mismo
   patrón de "datos en la bodega, no en el tablero" que 📦791 (gráfica de Salud).
2. **Nombres incompatibles**: la vista leía `inspecciones.total/realizadas/vencidas` y
   `mantenimiento.total/completados/atrasado`, pero los puentes devuelven
   `programaTotal/programaCompletadas/programaPendientes` (o `totalInspecciones/completadas/pendientesMes`)
   y `totalActividades/completadasMes/pendientesMes` → todo `undefined` → 0.

Fix: mapeo explícito en `refreshStats()` + asignación real de `this.peligrosStats`. **Mediciones y EPP**
(como nunca tuvieron puente de datos) pasan a "sin datos" (`null`): el score compuesto los excluye en
vez de mostrar 0/0 eternamente, y la barra de Mediciones solo se dibuja cuando exista un canal que la
alimente. Incluye los 2 ajustes pendientes de la auditoría de Mantenimiento (📦797): carga CSS
duplicada sin versión (`mantenimiento-component.js`) y tipografía Manrope/DM Sans (`mantenimiento.css`).
Cache-bust `GESTION-PELIGROS-20260921-fix-home-datos`. REGLA: cuando una vista compuesta lee de varios
puentes, verificar el nombre exacto de cada campo en el puente (no asumir) y confirmar que el resultado
termina asignado en el estado que la vista realmente lee.

### 📦800 — Auditoría Anual (6.1.2): botón "Nueva auditoría" abría un modal sin estilo

El botón "Nueva auditoría" (hub y lista) no mostraba el formulario. Dos fallos:

1. **Cero CSS para el modal**: `.kair-aud-modal`, `__backdrop/panel/head/body/foot/close/error`,
   `.kair-aud-form-row`, `.kair-aud-btn*`, confirm y toast fallback **no tenían ninguna regla** en
   `auditoria-anual.css`. Sin `display:none` base ni `--open { display:flex }`, el modal quedaba
   como bloque visible al final del body (o invisible según el cascade), y los `--v3-*` no
   resolvían porque el nodo vive en `<body>`, fuera de `.kair-v3-module`.
2. **Vista de lista con placeholder**: el handler de `[data-action="new-audit"]` solo mostraba
   "En la versión enterprise…"; la fachada `openAuditoriaForm` fallaba en silencio si
   `__kairAudInstance` era null. Además el guard `_clickBound` del hub impedía re-bindear tras
   destroy+re-render → al re-entrar al módulo el botón del hub dejaba de funcionar.

**Fix**: +432 líneas de CSS (modal/confirm/toast con tokens `--aud-*` declarados EN el modal +
dark con `[data-theme^="dark"]`), `console.warn` en la fachada, handler real en la lista,
bind en cada render del hub (sin `_clickBound`), cache-bust `AUD-20260921-modal-css` en 3 niveles
(index.html + loadCss CSS + loadScript list-view), EOL normalizado a LF. `node --check` OK.

**Regla**: un modal montado en `<body>` necesita sus propios tokens (no hereda los del scope del
módulo) y su propia regla `display:none` + estado abierto; verificar que toda clase generada por
el JS tenga regla en la hoja.

### 📦801 — Matriz de Control Operacional (7.1.1): premium v2 + fix de scroll del editor

Migración al dialecto premium v2 (mismo patrón que FURAT 📦773 y Profesiograma 📦772) y arreglo del scroll roto en la vista de edición que el usuario reportó con captura.

**Premium v2**: tokens en `:root` (iframe aislado → seguro), Header System v2 con SVG inline, dark con `[data-theme^="dark"]` (los 2 atributos), fix del selector roto `'\.kair-form-section'`, `_syncMejoramientoStore()` → `MejoramientoStore.update('711', …)` con guard, contrato DOM del header intacto.

**Scroll del editor (3 causas)**:
1. `.kair-editor` tenía `align-items: start` → la fila `main` del grid no se estiraba, `overflow-y: auto` nunca activaba y `.kair-app { overflow: hidden }` recortaba. Quitado (el sidebar ya tiene `align-self: start`).
2. Faltaba `min-height: 0` en `.kair-editor__main` → el item del grid no podía encogerse bajo su contenido.
3. La vista lista usaba `class="kair-app-main"` (clase huérfana: 0 reglas) en vez de `.kair-main` (que sí tiene `flex:1; min-height:0; overflow-y:auto`).

**Verificación**: test `tests/mejoramiento/test-premium-v2.js` → 39/39 OK (4 checks de regresión del scroll); arnés Electron midió `clientHeight 492 / scrollHeight 5258`, `scrollTop 400`, `alignItems: normal`. Cache-bust `APC-20260921-v2-scroll` en los 4 sitios + test.

**Regla**: en un layout grid `1fr auto`, si un hijo debe scrollear necesita `min-height: 0` Y su fila no puede quedar con `align-items: start` en el contenedor; verificar también que la clase del HTML exista en la hoja (un nombre huérfano = 0 reglas = sin scroll).

### 📦802 — Verificación: Definición de Indicadores (6.1.1) + Despliegue Estratégico (6.1.3)

Migración premium v2 de los 2 submódulos que quedaban en working tree, con conexión al Excel real de la empresa.

**6.1.1 Definición de Indicadores**:
- Bridge nuevo `main/indicadores-verificacion-bridge.js` (`registerVerificacionIndicadoresHandlers(app, { getCompanyRootPath })`): lee `INDICADORES <año>.xlsx` de `6. Verificación/6.1.1 …` (misma resolución de carpetas por variantes de acento que inspecciones 📦798). Hojas de definición RESULTADO/ESTRUCTURA/PROCESO + hojas de datos con series mensuales (doble fila: valor y denominador/"N° Trabajadores"). Match por nombre normalizado sin tildes. Sin carpeta → `{ source: 'none' }` y el frontend cae a la libreta de ejemplo.
- Cableado: require + try/catch en `main.js`, `preload.js` → `verificacionIndicadores.obtener`.
- Frontend: header premium `kair-page-header` (badge de origen Excel vs ejemplo), KPIs con tokens canónicos, Exportar con acción real, dark `[data-theme^="dark"]`. Cache-bust `index.html` (`?v=20260921-premium-v6` CSS, `-v2/-v3` scripts).
- Tests: `main/test-indicadores-carpeta.js` **37/37** (Electron + Excel real: 18 indicadores, series, año, fallback).

**6.1.3 Despliegue Estratégico**:
- Vista premium v2: Header v2 (`kair-rad-despliegue-header` + badge-ico + Volver→`ctx.navigate('hub')` + Refrescar→`ctx.refresh()`), 4 metric cards, tabla blindada, `tok()`/`palette()`, IPC `listarIndicadores` con fallback mock.
- Tokens scoped `--rad-desp-*` bajo `.kair-rad-view-despliegue` + dark `[data-theme^="dark"]` (sin `:root`/`*`/`body` globales). Cache-bust `?v=20260921-premium-v2`.
- Test: `main/test-despliegue-estrategico-premium.js` **38/38**.

**Nota**: los comentarios `📦800` en el código de 6.1.1 son numeración provisional de la sesión previa (📦800 real = Auditoría Anual); el commit es 📦802. `renderer.js` solo depura 2 mensajes de `console.warn`.

---

## 🆕 Notificaciones persistentes (correo + eventos) (📦807-808 commiteado · 📦809 fix duplicación + tabs + tamaño)

Feature de notificaciones persistentes en el proceso main (detección + persistencia + UI completa).

**Archivos**: `main/notifications-bridge.js` (4 handlers IPC + tabla `notificaciones` con `dedupe_key` UNIQUE + índice único compuesto + **`GLOBAL_COMPANY='*'`** y migración one-shot que consolida correos), `main/notifications-service.js` (detección con 12 fuentes de calendario + backoff + guard de reentrada), `main/notifications-email.js` (detector de correo del cache — **UNA fila global `company_key='*'` por thread, sin fan-out por empresa**), `main/notifications-gate.js` (gate de bandeja fail-closed, mismo criterio que el bridge de permisos 📦702); cableado en `main.js` + `preload.js` (`window.electronAPI.notifications`); UI en `renderer.js` (badge + toast con escape HTML), `shared/kair-alerts.js` (**tabs Pendientes/Notificaciones** con `_state.activeTab` + `localStorage['kair-alerts-tab']`, listar `soloNoLeidas`, correo global siempre navega, ventana 15m/1h/6h/24h persistida, **footer en ambas pestañas**, **`_pinPopoverHeight`/`_state.panelMinH` para tamaño estable al conmutar**), `styles.css` + `index.html` (estilos tabs, dark, notifs-list **sin `max-height`**, cache-bust `20260923-notifs-size`) y `assets/js/update-notifications.js`.

**Seguridad**: sesión obligatoria en los 4 canales (`UNAUTHORIZED`), `companyKey` ajena a la sesión → `FORBIDDEN_COMPANY` (nunca empresas ajenas; `marcarLeida` solo marca ids de la sesión + globales `'*'`), gate `bandeja_integrada_enabled` fail-closed, y **sin log de `access_token`** en notifications-*.

**Tests** (correrlos antes de commitear; bridge/service usan better-sqlite3 → con Electron):

```powershell
node tests/notificaciones-toast-e2e.js    # 25/25 — E2E del flujo toast → "Ver" (jsdom, sin Electron)
$env:ELECTRON_RUN_AS_NODE=1; npx electron main/test-notificaciones-bridge.js   # 32/28
$env:ELECTRON_RUN_AS_NODE=1; npx electron main/test-notificaciones-service.js  # 10/10
node main/test-notificaciones-email.js     # 17/7
node main/test-notificaciones-wiring.js    # 11/11
node main/test-notificaciones-fuentes.js   # 52/52
node main/test-notificaciones-ui.js        # 52/36
node main/test-notificaciones-seguridad.js # 23/23
```

> 📦823 — la E2E (`tests/notificaciones-toast-e2e.js`) carga `shared/kair-alerts.js` y
> `assets/js/update-notifications.js` **reales** en un jsdom y hace clic de verdad en
> `.btn-toast-action`. Regla del harness: el JSDOM debe llevar `url: 'https://kair.local/index.html'`.
> Con `file://` el `localStorage` lanza `SecurityError: localStorage is not available for opaque
> origins`, el módulo no carga ni una línea y el error sale como un `DOMException {}` sin mensaje
> útil (costó una vuelta entera de debug).

### ⚠️ Gotcha de schema: `CREATE TABLE IF NOT EXISTS` NO altera tablas que ya existen (📦823)

Es el error clásico de agregar una columna y jurar que "ya estaba". Si la tabla `notificaciones`
se creó en una versión anterior, el `CREATE TABLE IF NOT EXISTS notificaciones (...)` del
`SCHEMA_SQL` se ejecuta, **no hace nada**, y la columna nueva no existe → el `INSERT` revienta en
producción y no en el test (el test crea la BD nueva desde cero, así que pasa siempre).

**Patrón correcto cuando se agrega una columna** (el de este repo en 📦823):

```js
// 1) la columna va en el CREATE TABLE (BDs nuevas)
'  remitente     TEXT,'

// 2) y ADEMÁS un ALTER TABLE idempotente aparte (BDs existentes)
function migrateNotificaciones(db) {
  var info = db.prepare('PRAGMA table_info(notificaciones)').all();
  if (info.some(c => c.name === 'remitente')) return;   // ya está
  db.exec('ALTER TABLE notificaciones ADD COLUMN remitente TEXT');
}

// 3) y se exporta para que la ejecute el service también, no solo el bridge:
//    el timer del service puede hacer su primer INSERT antes de que main.js
//    registre los handlers del bridge.
module.exports = { migrateNotificaciones: migrateNotificaciones };
```

**Regla:** toda columna nueva en una tabla de producción va con su `ALTER TABLE` idempotente
exportado, y **la migración tiene que correr desde más de un punto de entrada** si hay más de un
proceso que escribe (bridge IPC + service por timer).

---

### ⚠️ Handler que borra y reinserta: el snapshot va ANTES del DELETE (📦824)

`presupuesto:bulk-save` hacía `DELETE FROM presupuesto_partidas WHERE presupuesto_id = ?` y
reinsertaba el payload. La grilla **no viaja** la categoría (col B del Excel), el `numero_excel` ni
los agregados, así que los tres se perdían en cada guardado.

Lo que lo hace difícil de ver: la preservación del `ejecutado` **sí** se leía antes del borrado
(`ejecutadoPrevio`), o sea que el ejecutado se salvaba y hacía pensar que el handler ya estaba
seguro. La categoría, en cambio, se "preservaba" consultando `presupuesto_partidas` **dos líneas
después del DELETE** — sobre la tabla ya vacía. Siempre `undefined` → `NULL`.

**Regla:** en un handler que borra y reinserta, **toda** la preservación debe leer de un snapshot
tomado ANTES del `DELETE`. Si un campo se preserva y otro no, sospechá que el que no se preserva
lee después del borrado.

```js
// MAL: la consulta va sobre la tabla que el DELETE de arriba ya vació
localDb.prepare('DELETE FROM presupuesto_partidas WHERE presupuesto_id = ?').run(id);
// ...
var previo = db.prepare('SELECT descripcion FROM presupuesto_partidas WHERE id = ?').get(id); // NULL

// BIEN: snapshot antes, y un UPDATE que lo use
var snap = db.prepare('SELECT numero, descripcion FROM presupuesto_partidas WHERE presupuesto_id = ?').all(id);
localDb.prepare('DELETE FROM presupuesto_partidas WHERE presupuesto_id = ?').run(id);
// ... snap.get(numero).descripcion
```

**Y si la UI no puede garantizar un campo, se RECALCULA en vez de preservarse:** los agregados se
derivan con subconsultas sobre el detalle, así que por construcción no pueden discrepar del
detalle. Lo que **no** se puede recalcular es un dato que viene de una fuente externa — ese se
preserva, nunca se deriva.

### ⚠️ Un dato derivado NUNCA puede ser la fuente de la verdad (📦824)

El ACT-FO-043 tiene la asignación **anual** en la columna D y la **ejecución mes a mes** en G-R.
No trae presupuesto por mes. Como `presupuesto_valores_mensuales` tiene `asignado` y `ejecutado`
por mes, el import inventaba `asignado = anual/12` — y la grilla mostraba ese invento
(`20.000 / 208.333,33 / 166.666,67` en partidas que en el Excel tienen el mes en cero) mientras la
ejecución real no aparecía en ninguna parte.

Peor: se llegó a **recalcular el anual sumando los 12 meses inventados**, y un solo mes en cero
comía $20.000 del total oficial.

| Dónde | Qué es | Fuente |
|---|---|---|
| `presupuesto_partidas.asignado_anual` | asignación anual | col D — **verdad** |
| `presupuesto_valores_mensuales.ejecutado` | ejecución del mes | cols G-R — **dato real** |
| `presupuesto_valores_mensuales.asignado` | curva "programada" | `anual/12` derivado — **nunca en la grilla** |

**Reglas:**
1. El anual sale de la columna D y **se preserva**. Nunca `SUM(meses)`.
2. Al repartir un total entre N, redondear a 2 decimales y poner el remanente en el último período,
   para que la suma dé exactamente el total. Sin eso, `10.000.000/12` deja
   `9.999.999,999999998` y ninguna suma cuadra.
3. Antes de guardar algo derivado, preguntarse de qué dato del documento sale. Si no sale de
   ninguno, es invención y no debería estar en pantalla.

### ⚠️ ExcelJS: escribir en una celda ESCLAVA de un merge corrompe la columna (📦824)

El ACT-FO-043 combina la categoría en `B11:B22` (un texto que cubre 12 partidas). Si la BD tiene
otra distribución, escribir sobre una celda esclava **no agrega texto**: ExcelJS lo guarda en el
**master** del merge. El archivo exportado quedaba con 12 filas mostrando la categoría
equivocada, y si el `TOTAL` o el IPC caían dentro del rango, sus valores se perdían.

```js
// 1) desarmar los merges que se SOLAPAN con el rango donde van los datos
ws.model.merges.slice().forEach(m => {
  var mm = String(m).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!mm) return;
  if (+mm[4] >= FILA_DATOS_INI && +mm[2] <= FILA_DATOS_FIN) { try { ws.unMergeCells(m); } catch (e) {} }
});
// 2) escribir la categoría en la fila donde abre cada bloque
// 3) rearmar por bloque real: ws.mergeCells('B' + ini + ':B' + fin)
```

**Nunca confíes en que la plantilla tiene la misma distribución de filas que tus datos.** Los merges
están calibrados al layout de SU archivo. Y al leer, `getRow(n).getCell(c).value` en una esclava
devuelve el valor del **master** — que es justo lo que vería un humano al abrir el Excel, así que
sirve para verificar.

### ⚠️ Un typo en el dispatch de `postMessage` no lo caza ningún test (📦824)

`handleIframeMessage` llamaba `this._handleOpenBudgetFromDB` cuando el método se llamaba
`_handleOpenBudgetFromBD`. TypeError en runtime, el módulo se caía al cambiar de período. Los 442
tests de backstory no lo detectaron: **todos son de backend** (bridge/IPC), y el `postMessage` del
renderer nunca se ejecuta en un test.

**Regla:** un dispatch por `postMessage` necesita un test **estático** que lo cubra, no uno que lo
ejecute. `main/test-presupuesto-824-dispatch.js` parsea el `switch` y verifica que cada `case`
llame a un método que exista y que cada `action:` que mandan los iframes tenga su `case`. Al
escribir ese parser: cortar entre un `case` y el siguiente (no buscar el `break;` con un regex de
tamaño fijo), acotar el análisis al método (el archivo tiene más de un `switch`) y aceptar
indentación de 2 y de 4 espacios — con solo 4 salen ~30 falsos positivos.

Vale la pena correr ese chequeo sobre los 34 módulos `*-logic.js` cuando se toque cualquier
`switch` de mensajes: en este barrido apareció 1 crash real más.

### 📦824 — Tests de Presupuesto

```
npx electron main/test-presupuesto-824-real.js            # 38/38  import del Excel real de Drive
npx electron main/test-presupuesto-824-aislamiento.js     # 23/23  un año no daña a otro
npx electron main/test-presupuesto-824-export-plantilla.js# 34/34  export sobre la plantilla oficial
npx electron main/test-presupuesto-824-roundtrip.js       # 21/21  import → guardar como la grilla
node    main/test-presupuesto-824-dispatch.js             #  7/7   dispatch de postMessage
node    main/test-presupuesto-bridge-{schema,read,write,import,export,granular}.js
npx electron main/test-presupuesto-flow-completo.js       # 31/31
```

> 📦824 — `roundtrip` es el que faltaba: **importa el Excel real y guarda con el payload que
> realmente manda la grilla**. Los demás importaban y ya, nunca guardaban después de importar, y por
> eso 442 checks en verde mientras el bug destruía datos en producción. Al reintroducir el bug baja
> a 14/17 con el síntoma exacto `0/14` categorías.
>
> **Al testear exports con plantilla, derivá la aritmética de filas de la longitud de tus datos**
> (`FILA_TOTAL = 10 + N`), no hardcodees números de fila. Y **dá valores DISTINTOS a asignado y
> ejecutado** en los datos de prueba, para que el test detecte si se vuelven a confundir.

---

## 🆕 Gotcha: los globals del shell se PISON entre módulos — nunca llamar `window.render()` (📦821, 2026-09-28)

**Síntoma**: al pulsar un botón "Volver" en una vista inyectada, la app LANZA y queda inservible:

```text
TypeError: Cannot set properties of undefined (setting 'innerHTML')
    at render (rendicion-viewer.js:138:29)
```

El error apunta a un archivo de un **módulo sin relación** (Gestión Integral / Rendición de Cuentas) y nunca a la vista donde se hizo clic. Esa es la pista: **si la traza nombra un archivo que no estás tocando, estás llamando a un global que te robó otro módulo.**

### Por qué pasa

Todos los módulos se cargan como **classic scripts en el MISMO documento** (`index.html`). Las declaraciones de nivel superior (`function render() {}`) se convierten en propiedades de `window`. Como no hay módulos ES ni namespaces, **el último script en cargar gana el nombre**:

```js
// modules/gestion-integral/rendicion-cuentas/rendicion-viewer.js
async function render() { … this.container.innerHTML = … }   // ← gana window.render

// modules/gestion-salud/ausentismo/informe-pri-builder.html (inyectado)
if (typeof window.render === 'function') { window.render(); } // ← cree que es el suyo
```

Invocado como `window.render()`, el `this` es `window`, no la instancia del componente → `this.container` es `undefined` → revienta al asignar `innerHTML`. Y como ya había tocado otras cosas, la app entera se cuelga.

### Regla

1. **NUNCA** invocar un global genérico desde código inyectado en el shell: `render`, `init`, `load`, `update`, `close`, `open`, `show`, `reset`. Compiten con los de todos los demás módulos.
2. Para repintar contenido usar **solo** las APIs con nombre propio del shell, todas en `renderer.js`:
   - `showModuleContent(moduleName)` — el módulo completo
   - `showSubmoduleContent(container, moduleName, submoduleName)` — un submódulo
   - `showHomePage()` — el home
3. ⚠️ **`showSubmoduleContent` exige los 3 argumentos.** Llamarla con uno solo hace que el `container` reciba un string y el retorno no ocurra en silencio. (Hoy el handler `back-to-submodule-home` de `renderer.js:1606` tiene justo ese bug — no lo uses como referencia.)
4. `currentModule` y `currentSubmodule` son `let` de nivel superior en `renderer.js`: **no viven en `window`** pero sí en el ámbito léxico global, así que se leen como identificadores sueltos desde otro classic script (`typeof currentSubmodule !== 'undefined' ? currentSubmodule : null`).

### Bonus: el `postMessage` de "volver" SÍ funciona sin iframe

`renderer.js` acepta mensajes **de la propia ventana** (línea ~1396):

```js
const isFromSelf = event.source === window;   // "Allow messages from the window itself"
```

Así que cuando una vista se inyecta en el mismo documento (vía `loadModuleViewInContentArea()`, que monta el HTML en `contentArea > .main-canvas` **sin iframe** y re-ejecuta los scripts), `window.postMessage({ type: 'back-to-module-request' }, '*')` es un camino válido — mucho más seguro que adivinar a qué función global llamar.

**Referencia**: `modules/gestion-salud/ausentismo/informe-pri-builder.html` → `closeReportBuilder()` (📦820-822), con las 3 ramas de contexto, el guard anti-doble-clic y la red de seguridad en cascada.

---

## 🎨 UI: el bloque con marco es COMPARTIDO, no se re-declara por pantalla (📦824, 2026-09-29)

### La regla

El patrón "encabezado de bloque (chip + título + bajada) **fuera**, panel blanco **dentro**" que usan
el home de recursos y el selector de presupuestos está definido **una sola vez** en
`shared/kair-components.css`:

| Clase | Qué es |
|---|---|
| `.kair-block` | bloque + su separación vertical |
| `.kair-block__head` | fila del encabezado (flex) |
| `.kair-block__chip` / `__text` / `__title` / `__sub` | chip, caja, título y bajada |
| `.kair-block__panel` | el marco (fondo, borde, radio, sombra, padding) |
| `.kair-block__grid` | grid base del panel (`auto-fit`, gap `clamp(12px, 1.3vw, 18px)`) |

**Cada pantalla declara solo lo suyo**: el `minmax` de su grid (una card de período y un tile de
Drive no usan el mismo piso de ancho) y lo que sea layout local (`grid-column` en el selector,
flecha en las tarjetas grandes del home). Si una pantalla vuelve a declarar el marco, el marco
vuelve a poder quedar distinto en cada una.

### ⚠️ NO reutilizar el nombre `.kair-panel`

Ya está tomado con **otro significado**: `modules/verificacion/revision-alta-direccion/revision-alta-direccion.css`
lo usa como panel de layout con hijos `.fijo` / `.scroll`, y está documentado más abajo en este
archivo como "cualquier panel (sidebar, lista, detalle, calendar)". Por eso el marco del bloque se
llama `.kair-block__panel`.

**Antes de crear una clase `kair-*` nueva, grepear el repo**: `kair-` no es un namespace libre.

### Por qué importa

El selector tenía su propia copia del marco y el home la suya. Las dos se veían iguales **por
casualidad**, no por construcción: al cambiar el borde en una, la otra se quedaba vieja. Con la
definición compartida, home, selector y gestión se leen como pantallas hermanas por diseño.

---

## ⚠️ `auto-fill` reserva columnas vacías: el espacio sobrante se mete DENTRO del marco (📦824)

`repeat(auto-fill, ...)` crea las columnas aunque no haya contenido y les asigna ancho; `auto-fit`
colapsa las vacías y reparte su ancho entre las que sí tienen elementos.

Con pocos elementos y `auto-fill`, el hueco no desaparece: **se muda de lugar** — de los márgenes
laterales al interior del recuadro, que se ve peor porque el marco lo delata.

**Regla**: en un grid dentro de un panel, `auto-fit`. Y si además la pantalla estaba topeada
(`max-width: 1400px` + `margin: 0 auto`), quitar el tope: los dos efectos se suman y el usuario
reporta "espacios vacíos a los lados".

Caso real: selector con 2 períodos cargados en una ventana de 1913px.

### Card que se estira: cuidado con `align-items: center` de la base

`.year-card` (base compartida) es `display: flex; flex-direction: column; align-items: center`, así
que **cada hijo se encoge a su contenido**. Con una card angosta no se nota porque el contenido ya
llena; al ensancharse, todo se amontonaba en el centro. Para una card que debe ocupar su ancho:
`align-items: stretch` en la variante.

### Reacomodar sin media query

Con `auto-fit` + `minmax`, un panel de contenido ancho se reparte solo. Para que una card interna
pase de apilada a dos columnas según el espacio, usar `flex-wrap` con `flex-basis` (no `@media`):
si no caben las dos zonas, se apilan y el diseño angosto queda idéntico al anterior.

En una app Electron de escritorio los breakpoints menores al ancho mínimo de ventana son código
muerto. El home NO tiene ningún `@media` y se adapta solo por `auto-fit`.

---

## ⚠️ Toast oculto: `translateY(150%)` NO lo esconde (📦824)

`transform: translateY(150%)` es un porcentaje de **la altura propia del elemento**, no de la
distancia que hay que cubrir. Un toast a `bottom: 2rem` con 53px de alto, bajado 1,5 alturas,
queda a `32px − 0,5×alto` del borde: ~4px de franja blanca **siempre visible** (con su filete de
color, el único indicio en pantalla).

```css
/* mal: asoma una franja */
.k-toast { bottom: 2rem; transform: translateY(150%); }
/* bien: baja la altura completa + el margen, y opacity evita el asomo */
.k-toast { bottom: 2rem; transform: translateY(calc(100% + 2rem)); opacity: 0; }
.k-toast.show { transform: translateY(0); opacity: 1; }
```

Mismo patrón copiado en `modules/gestion-integral/politica/politica-view-temp.html` (archivo
**muerto**: el módulo carga `politica-view.html`). No tocar salvo que se reviva ese archivo.

---

## ⚠️ Verificar UI con ventana Electron OCULTA: el reloj de animaciones está congelado (📦824)

Al verificar una vista con un arnés de Electron (`new BrowserWindow({ show: false })` +
`capturePage()`), **Chromium no produce frames**, así que:

- las transiciones CSS no avanzan (el reloj de animación está congelado);
- `getComputedStyle()` devuelve el valor **anterior** al cambio de clase, con un paso de atraso;
- `capturePage()` puede devolver un frame viejo.

El síntoma es desconcertante: el elemento tiene la clase de "visible", el DOM confirma que la
clase está puesta, y aun así la captura muestra el estado escondido. **Casi hace "arreglar" CSS
que estaba bien.**

**Cómo verificar bien**: inyectar `* { transition: none !important; animation: none !important }`
para medir el estado final al que la animación *debería* llegar, o mostrar la ventana. Con eso el
estilo computado y la captura coinciden con lo que verá el usuario.

---

## ⚠️ No construir texto con acentos en PowerShell (📦824)

`[char]0xED` y las concatenaciones `+` dentro de un arreglo de líneas **parten la cadena en varios
elementos**: el archivo quedó con `Ajustar rubros, categor` en una línea y `í`, `as y l`, `í`,
`mites de gasto del sistema.</div>` en las siguientes, y el HTML se rompió de paso.

**Regla**: para texto con acentos, escribir el bloque con la herramienta de escritura (UTF-8
correcto) en un archivo auxiliar y empalmarlo por PowerShell leyendo ese archivo
(`[System.IO.File]::ReadAllLines` + `WriteAllText` con `UTF8Encoding($false)`), nunca armando el
texto en la consola. Después de empalmar, **contar `<div>` abiertos vs cerrados**: un
`RemoveRange` mal calculado deja `div` huérfanos que el navegador compensa silenciosamente.
## ⚠️ Un sidebar que descarta clics en silencio es peor que uno roto (📦843, 2026-10-02)

### El síntoma

Un clic en el sidebar no hacía nada: sin error, sin alerta, sin cambio en pantalla. El motivo estaba a la vista en el código:

```js
if (currentSubmodule && currentModule !== item.name) {
  console.log(`Ignorando click en "${item.name}" porque estamos en submódulo`);
  return;
}
```

Y había un **segundo** candado más abajo, en `showModuleContent`, rotulado `✅ SOLUCIÓN TEMPORAL`:

```js
if (currentSubmodule) {
  console.warn(`...bloqueado...`);
  return;            // <-- se cuela 10 líneas ANTES de esto:
}
...
currentSubmodule = null;   // la limpieza ya estaba en la función
```

### Las tres reglas

1. **Un candado con `return` y sin efecto visible en pantalla es un bug, no una validación.** Si el usuario no puede entender por qué no pasa nada, el comportamiento está mal. Un candado legítimo avisa o explica con un texto en pantalla.
2. **Al navegar hay que hacer teardown, no solo limpiar estado.** La teardown vive en `_salirDeSubmodulo()`: destruye `currentActiveComponent` y recién después limpia `currentSubmodule`. Sin el `destroy()` quedan vivos los watchers, los modales al `body` y el CSS inyectado en el `<head>`.
3. **El orden importa y hay que testearlo.** Si se llama a `showModuleContent()` *antes* de limpiar el estado, el candado vuelve a tragarse la navegación: el código "se ve bien" y el sidebar sigue mudo. `test-sidebar-nav-843.js` tiene un check dedicado a ese orden.

> El candado de `showModuleContent` **se conserva** a propósito. Con el sidebar ya limpiando el estado nunca se dispara desde ahí, pero sigue protegiendo a los iframes y a las tareas del dashboard. Quitar la única red sin reemplazarla es peor que dejarla.

### El bug espejo que salió al arreglar este

Había **dos** callbacks de "Volver": la "normal" y la "segura". La normal **nunca destruía el componente**, solo limpiaba el estado. Existía la segura por esa razón, y estaba duplicada. Cuando dos caminos resuelven lo mismo, el que no tiene el `try/catch` es el que nadie revisa.

## ⚠️ El `padding` de un hijo NO colapsa con la fila del grid (📦842, 2026-10-02)

## ⚠️ Un `title` nativo se dibuja ENCIMA de tu popup, y no hay z-index que lo baje (📦847, 2026-10-02)

### El síntoma

Un popup propio y el `title` del botón se muestran a la vez, con el del navegador flotando encima.

### Por qué

El `title` lo dibuja el navegador en una **capa del sistema, fuera del documento**. Ningún `z-index`, `overflow` ni `position` de la página lo afecta: no es un elemento, es una ventana del sistema operativo.

### La regla

Si un elemento ya muestra su propia información al hover, **no le pongas `title`**. Es la misma información dos veces, y la del navegador se queda encima. Si el `title` hacía falta como pista, muévela al popup.

### Y si el `title` es el único aviso

Déjalo, pero solo donde no compita con nada: en los días **sin** eventos el `title` es la única pista y no hay popup que lo estorbe. Un elemento puede tener `title` en unos casos y no en otros.

### Trampa al escribirlo

El helper `el()` hace `setAttribute` sin mirar el valor, así que `title:undefined` deja `title="undefined"` en el DOM. Si la condición va dentro del objeto de atributos, hay que **sacarla afuera** y asignarla aparte.

## ⚠️ "Mismo dato" en el popup y en la grilla exige la MISMA función (📦848, 2026-10-02)

### El síntoma

El popup dice "Todo el día" de un evento que la grilla dibuja de 9:00 a 11:00.

### Por qué

Inventé un criterio propio —"si el rango es 00:00-23:59 es de todo el día"— y resultó falso: **5 generadores en `main.js` crean eventos con exactamente ese rango** (recordatorios, inspecciones). La grilla no los trata como todo el día, pero el popup sí.

### La regla

Antes de escribir un criterio para "qué es un evento de todo el día", **busca si la app ya tiene uno**. Aquí era `isAllDayEvent()`, y `renderDayView` ya la usaba para partir los eventos en dos grupos. El fix fue que el popup llamara **la misma función**, no una segunda regla.

El criterio general: **si dos lugares muestran el mismo dato, no pueden tener dos reglas.** Con una función compartida no pueden discrepar ni en el futuro.

### Y el que se traga al test

Mi test pasó con el bug porque sus datos de prueba usaban la forma de los **mocks** (`startHour` numérico) y el bug solo afectaba a la forma real (`start`/`end` como texto). Cuando el test valida un contrato, **los datos tienen que ser del mundo real**, no los que facilita el código.

## ⚠️ Un guard que matchea tu propio comentario no guarda nada (📦849, 2026-10-02)

### El síntoma

Un check que busca "esto ya no está" falla, porque un comentario explica que se eliminó y menciona el nombre.

```
// 📦849 — "Tu día". Reemplaza la tarjeta "Integración correo"...
check("no queda Integración correo", app.indexOf("Integración correo") < 0);   // FALLA
```

### La regla

Los guards de "lo que ya no está" tienen que mirar **código**, no el archivo entero. Por eso los tests del repo usan `soloCodigo()` antes de grepear:

```js
function soloCodigo(x) {
  return x.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}
```

Un comentario que explica **por qué** se quitó algo es valioso y hay que conservarlo. El problema no es el comentario, es el guard.

## ⚠️ Un `title` de caché escrito a mano se rompe en cada bump (📦849, 2026-10-02)

### El síntoma

Un test de la bandeja se cae en cada paquete, y el arreglo "es editar el test".

### Por qué

El check era `/premium\.css\?v=20260918-paginacion-correos/`: una **lista blanca del token del día**. Cada bump obligaba a editar el test, así que el test dejó de proteger nada y pasó a ser un trámite.

### La regla

Un guard de caché valida la **forma**, no el valor:

```js
/^\d{8}-/.test(token)   // existe y tiene forma de fecha
```

Y además, si dos archivos se cargan juntos, sus tokens deben **coincidir**:

```js
check("premium.css y app.js comparten token",
  premiumV !== "" && premiumV === appV);
```

Si difieren, el navegador puede servir el JS nuevo con el CSS viejo, y la pantalla queda a medias sin que nada falle visiblemente.

### Apareció 3 veces en esta tanda

En `test-bandeja-paginacion`, `test-bandeja-toolbar-compacta` y `test-minical-hover-846`. Cuando un mismo defecto se repite, el defecto no es del test: es del patrón que todos copiaron.


### El síntoma

Un header con `grid-template-rows: 1fr → 0fr` se colapsaba a **8px** en vez de 0: quedaba una franja blanca abajo.

### Por qué

- `min-height: 0` sí deja llegar el **content box** del hijo a 0.
- Pero el `padding` vive **fuera** del content box. Un `border-box` nunca puede medir menos que su padding.
- Con `padding: 4px 16px` la fila `0fr` se detiene en **4 + 4 = 8px**, y el header se queda con esa franja.

### La trampa

El comentario que había en el código decía lo contrario de lo que hacía: *"el padding se mueve al hijo para que el colapso no deje resto de padding"*. **Moverlo al hijo fue justo lo que creó el resto.**

```css
#app-header.app-header-collapsed .header-content {
  padding-top: 0;
  padding-bottom: 0;
}
.header-content { transition: padding 0.4s ease-in-out; }
```

### Y: medir una transición sin esperar da un falso positivo

La primera medición de este bug dio **48px** colapsado, o sea "el colapso no funciona en absoluto". Era falso: se aplicó la clase y se midió en el acto, con la transición de 0.4s a medias, así que se leyó el valor de partida.

**Regla:** para medir un estado que tiene `transition`, esperar a que termine. Un test que mide sin esperar puede dar verde con el bug presente, o rojo con el código sano.

## 📦850-851 · Botón que pliega su propia columna, y checks que se auto-disimulan

### 1. Un botón que PLEGA la columna que lo contiene no puede vivir dentro de ella

La regla más obvia del mundo y la que más se rompe. El botón del 📦850 pliega el `<aside class="kair-sidebar">`. Si el `<button>` estuviera dentro de ese `<aside>`, se iría con él y no quedaría forma de volver a abrir la columna: el requisito explícito del owner era "que sea claro para mostrar esta sección".

Vivió entonces como hermano, dentro de `.kair-layout`. Eso además trajo una propiedad gratis: `renderSidebar()` hace `container.innerHTML = ""` sobre el `<aside>`, no sobre el layout, así que el botón sobrevive a cada `render()` y su listener se enlaza **una sola vez** en `bindHeader()` en vez de en cada render.

**Regla:** antes de poner un control dentro de una región plegable, preguntate dónde se va ese control cuando la región se pliega. Si la respuesta es "con ella", el control va afuera.

### 2. Para que el contenido CREZCA hay que animar un ancho, y el ancho del track del grid no es confiable

La regla de la casa dice "animaciones GPU-only (transform/opacity)". Aquí no se podía cumplir, y estaba bien: para que el correo **gane** espacio hay que animar un ancho. La pregunta es cuál.

| Opción | Qué pasó |
|---|---|
| `grid-template-columns: 250px 1fr` → `0px 1fr` con `transition` | Depende de que el navegador interpole el track. Chromium 138 lo hace, pero es una capacidad, no una garantía. |
| `grid-template-columns: auto 1fr` + `width` en el hijo | `width` se anima en todas partes, y `auto` hace que la columna mida lo que mida el hijo. **Esta** |

Con la segunda, además, el contenido crece **durante** la transición en vez de saltar al final, que es lo que se ve bien.

La parte que sí se compone (la que el ojo sigue) queda en `transform`/`opacity`: el sidebar se desliza y se apaga, y el botón se mueve con `translateX`. El `width` afecta una sola caja, no la pantalla.

### 3. El ancho de una columna y la posición de un botón anclado a su borde salen de la MISMA variable

El botón del 📦850 se ancla al punto exacto donde la columna termina y el contenido empieza, en dos ventanas distintas (250px y 224px) porque hay un breakpoint a 1280px. Con dos números sueltos, cambiar un breakpoint descuadraba el botón del borde sin que nada fallara.

Por eso `--side-w` y `--side-pad`: el `<aside>` mide `var(--side-w)` y el botón usa `calc(var(--side-pad) - 13px)` más `translateX(var(--side-w))`.

**Regla:** si un valor depende de otro, que los dos lean de la misma variable. Un número repetido en dos lugares es un bug esperando el próximo breakpoint.

### 4. Un mutante vacío SIEMPRE "pasa", y se reporta como "el check no muerde"

Tres mutaciones de `app.js` en el test de 📦850 estaban escritas con `"\n"` mientras el archivo está en **CRLF**. El `String.replace` no encontraba nada, devolvía el archivo idéntico, y el check pasaba siempre.

El reporte decía "3 checks no muerden", pero los checks estaban bien: **nunca se habían probado**. Peor: esas mismas 3 mutaciones se habían reportado como detectadas en la corrida anterior, cuando el check estaba mal escrito y fallaba por otro motivo. El bug del check tapaba al mutante vacío.

**Dos guards, ambos obligatorios:**

1. Normalizar a LF antes de mutar: `raw.replace(/\r\n/g, '\n')`. El EOL se verifica aparte contra el crudo, porque normalizar para evaluar no debe perder la señal de "este archivo está en CRLF".
2. Contar los mutantes vacíos **por separado** y hacerlos fallar.

**Cómo se distinguen las dos fallas.** "Check mal escrito" y "mutante vacío" se ven IGUAL en el reporte —el check pasa cuando debería fallar—:

| | El archivo | Diagnóstico |
|---|---|---|
| Mutante vacío | **no cambió** (`mut(h) === h`) | La mutación está mal escrita |
| Check mal escrito | **sí cambió** | El check no mira lo que dice mirar |

**Regla:** antes de culpar a un check, verificá `mut(x) !== x`. Siempre.

### 5. Un regex con rango fijo se rompe cuando agregás un comentario

Un check usaba `/\.kair-layout[\s\S]{0,300}flex:\s*1/`. Al agregar el comentario que documenta `--side-w`, el `flex: 1` se empujó fuera de la ventana y el check se puso rojo **sin que el layout hubiera cambiado**.

Se arregló acotando a la misma llave:

`.kair-layout { /* comentario largo... */ grid-template-columns: auto 1fr; ... flex: 1; }`

`/\.kair-layout\s*\{[^}]*flex:\s*1[^}]*\}/`

**No prefixes el rango a ciegas.** Estirarlo para "que no falle" destruye el check: si el `flex: 1` estuviera en otra regla, dejaría de detectarlo, y eso es justo de lo que trata.

### 6. Un check que busca un texto en TODO el archivo pasa con la mitad del código

El riesgo real de borrar el chip de fecha (📦851) no era que algo se rompiera: era que alguien se llevara el mes **por error** y el toolbar del calendario quedara en blanco sin que nadie lo notara.

El toolbar tiene **dos** caminos para el mes: al pintarse (el `${`}` del template) y al actualizarse (la rama `else` de day/week/schedule). Un check `/state\.viewMonthLabel/.test(codigo)` pasaba con cualquiera de los dos, e incluso con ninguno si el texto aparecía en otro lado. Son dos checks distintos, uno por camino.

**Regla:** un check de "este texto tiene que estar" solo vale si además dice **dónde**. Si no, no sabe distinguir el código bueno del código roto que lo contiene.

### 7. Cuando eliminas algo que dos checks afirman, invierte los DOS

El chip de fecha era afirmado por dos checks de `test-bandeja-premium-v2.js`: uno mirando el HTML (`id="chip-fecha"`) y otro el JS (`chipFecha.textContent = ...`). Invertir uno y borrar el otro deja un agujero: reintroducir el **código sin el markup** pasa verde, porque el check del HTML sigue conforme.

**Regla:** cuando borras algo, busca cuántos checks lo afirman. Un check borrado es un hueco; uno invertido sigue protegiendo. Y si son varios, se invierten todos.

## 📦858-860 · El día como eje, la pila de redactores, y la fecha que faltaba

### 1. Un filtro que se compone con otro filtro no puede salir temprano

En 📦858 el día elegido en el mini-calendario se compone con el chip activo, la búsqueda y los
labels. El filtro de la bandeja hacía esto:

`B`js
if (sel === "unread" && !m.unread) return false;
if (sel === "starred" && !m.flagged) return false;
// …y acá venía la comparación de fecha
`B`

Con **"No leídos"** activo, la función salía en la primera línea y **nunca llegaba a mirar la
fecha**: el filtro por día se ignoraba en silencio y la bandeja respondía "no hay correos ese
día" sobre un día que sí tenía 12. Un filtro compuesto es un **y**, y un "y" escrito como una
cadena de salidas tempranas deja de ser un "y" en cuanto agregás una condición.

**Regla:** un filtro que ya compone dos ejes tiene que seguir la forma booleana única
(`return a && b && c`) aunque sea menos legible. La versión "un return por chip" se rompe
con el primer eje que se agregue, y se rompe **sin error**: la consulta sale vacía y parece un
bug de datos. Hay check y mutación dedicados a que no vuelva.

### 2. El día vive en su propio estado, y el mes también

El mini-calendario tenía `viewYear` / `viewMonth`, que son del calendario grande. 📦858 le
dio `state.miniMes` y `state.mailDia` aparte. No por purismo: si el mini hubiera escrito
en `viewMonth`, cambiar de mes en Correo habría movido el calendario grande que está detrás,
y volver a Agenda lo habría dejado descolocado.

### 3. Un estado alterno tiene que anular los `min-*` de la base, uno por uno

Ya está en `PROMPT.md` §7.6 y en el changelog de 📦859. Lo que se lleva para otro lado es el
método: **el bug no se huntó leyendo el CSS del estado alterno**, se huntó midiendo la caja en
la app. `max-height: 48px` se veía correcto en el archivo y en la pantalla no pasaba nada.
Cuando un estado alterno "no hace nada", el culpable es casi siempre un `min-*` heredado que
el estado no está anulando.

### 4. Un selector de CSS puede hacer que un check se satisfaga con la regla equivocada

El hover de la fila de correo es un selector partido:

`B`css
.kair-mail-row:hover .kair-mail-row__time,
.kair-mail-row:hover .kair-mail-row__fecha { opacity: 0; }
`B`

Un check que buscara la cadena `.kair-mail-row__fecha {` —para verificar que la fecha tiene
estilo— encuentra **la del hover**, no la de `.kair-mail-row__fecha {`. O sea: el check pasa
aunque la regla de estilo **no exista**, porque encuentra la palabra en otra regla.

**Regla:** un check de CSS tiene que anclar a **la regla que le importa**, no a "cualquier
mención del selector". Si la palabra puede aparecer en dos reglas, el check necesita exigir
algo que solo la regla buena tiene: una declaración propia, el selector pelado, el orden.

### 5. Ningún test del repo abre la base de datos, y eso se notó en 📦860

El detalle completo está en `PROMPT.md` §7.7. Lo que va a la bitácora: la fecha de la fila
(📦860) tenía 34 checks en verde y podía **no dibujar nada en pantalla**, porque `fechaFila`
exige `typeof ms === "number"` y la hipótesis "la columna viene como número" no estaba
verificada contra nada. Se verificó a mano contra `kair.db`: es `INTEGER`, llega como
`number` en las 150 filas, 0 sin fecha.

**Regla:** un feature que dependa de la forma de un dato de la base **no está terminado**
hasta que alguien lo corrió contra la base. El script va en `Temp/` y **no** en la suite,
porque la suite tiene que correr en la máquina de cualquiera.

## 📦861 · Un módulo replicado 15 veces, y un bug que se paga 15 veces

### 1. El 1.1.1 no es un módulo: es el original de quince

La auditoría del 1.1.1 (Responsable del SG) encontró tres bugs. Antes de arreglar nada se
contó: hay **15 exploradores de archivos** en `modules/`, y el 1.1.1 es el **original** del
que se copiaron los otros catorce (los catorce usan exactamente 86 espaciados de la misma
escala `--kair-space-*` y pesan ~52 KB). Un bug en el 1.1.1 es **quince bugs**.

Corolario de diseño: cuando un módulo es una copia, arreglarlo **uno solo** deja al módulo
rarísimo al lado de sus catorce gemelos. O se arreglan los quince, o se arregla ninguno.

### 2. Comparar archivos por BLOQUE, nunca por posición

Al principio comparé los viewers línea por línea y el informe salió "1593 líneas
distintas" entre dos archivos que son casi idénticos. **Era falso**: los archivos tienen
distinto número de líneas, así que al desalinearse todo se ve distinto.

La comparación útil es **por función**, extrayendo el bloque por llaves balanceadas y
comparando su hash. Así se vio la verdad: **14 son idénticos y uno (`evaluaciones`) es
variante**, con 1 524 líneas en LF contra 1 580-1 700 en CRLF.

**Regla:** dos archivos con tamaños distintos no se comparan por índice de línea. Se
compara la unidad que importa (la función, el bloque) y se cuenta cuántos valores distintos
sale.

### 3. Verificar que el resultado COMPILE, no solo que las llaves balanceen

El script que aplicó los cambios validaba **llaves balanceadas** y no más. Con una cadena sin
cerrar, el conteo de llaves da **cero igual**: el archivo pasaba la verificación y quedaba
roto. Revienta al cargar el módulo en la app — donde nadie lo ve, porque **ningún test de
este repo abre la app**.

**Regla:** antes de escribir un archivo generado, `node --check` sobre el resultado. Y
contar llaves solo como filtro barato, nunca como prueba de que compila.

### 4. Un ancla con la indentación equivocada da 0, y el mensaje miente

El mensaje de error decía "el ancla no es única" cuando en realidad no existía: la línea
buscada tenía **8 espacios** de indentación y el ancla pedía 20. **Un ancla que da 0
apariciones parece un problema de unicidad y es un problema de escritura.**

**Regla:** el guard de singularidad tiene que distinguir `x0` de `x2`. Hoy dice "aparece
0 veces (0 = el ancla no existe)".

### 5. Un regex para un color tiene que ser GENERAL

El patrón que cambiaba el azul viejo a_WRITE`rgba(23, 78, 166, 0.12)` y
`rgba(23, 78, 166, 0.35)`, hardcodeados. Quedó un **tercero con 0.08**, y el test lo
agarró. Un color escrito a mano como `rgba(r, g, b, a)` tiene tantas variantes como
opacidades existan: el patrón tiene que ser `rgba\(23,\s*78,\s*166,(\s*[\d.]+\s*)\)`.

**Regla:** si el valor es una tupla, el patrón tiene que capturar la tupla, no sus
ejemplos.

### 6. Un script que busca sin filtro se pasa de alcance

El limpiado de los `rgba` floated sobre **23 CSS** en vez de los 15 del grupo de
exploradores, y cambió 7 módulos que nadie pidió (Objetivos SST, Plan de Trabajo,
Investigación de Accidentes, Reportes de Accidentes, Capacitaciones, Roles y
Responsabilidades, Investigaciones). Se revirtieron con `git checkout`.

**Regla:** un script de cambio carries la lista explícita de archivos que puede tocar, o
un filtro que no pueda salir del alcance. "Buscar todos los `*-view.css`" es un alcance
distinto de "los 15 exploradores", aunque hoy coincidan.

### 7. Y el guard de singularidad evitó el peor error posible

La primera versión del fix usaba anclas literales de varias líneas sobre los 15. En **0 de
15** coincidieron (cada archivo tiene su propia forma), y el script **no escribió nada** en
ninguno. Sin ese guard, se habrían escrito 15 archivos con la mitad de los cambios.

**Regla:** el guard no es burocracia. Es lo que separa "no hice nada" de "rompí quince
módulos".

### 8 · El PDF tenía DOS visores, y la causa estaba escrita en el código

El owner lo reportó con una captura: el PDF se abría con el visor **nativo del navegador**
(la barra oscura con "1/2" y "96%") y Word/Excel con el de K+AIR. La causa estaba en
`responsable-sg-logic.js`:

`B`js
const isOfficeRequest = (apiFunctionName === 'getExcelPreview' || apiFunctionName === 'getWordPreview')
    && fileExt && fileExt !== 'pdf';   // ← el PDF, excluido a propósito
`B`

Y el comentario de **arriba** de esa función decía `Office / PDF`. O sea: la exclusión fue
un descuido, no una decisión. El IPC `read-file-bytes` de `main.js` también dice
`Office / PDF` y tiene el PDF en su whitelist.

**Lo que no se hizo, y por qué:** el fix del PDF quedó **solo en el 1.1.1**. El inventario
mostró que los 15 **no comparten la arquitectura del preview**: hay **4 variantes** de
`_loadPDF` (`_displayPDF`, `_renderPreview(result, filePath)`, `_renderPreview(result)`,
y una casi igual) y los `logic.js` lo enrutan de **3 maneras** (switch, tabla de acciones,
`if`); tres módulos no tienen `logic.js`. Replicarlo sin poder abrir la app sería cambiar
quince módulos a ciegas, y el PDF es justo lo que más se nota si se rompe.

**Regla:** "son copias" no significa "se arreglan igual". Antes de replicar, contar cuántas
variantes hay. Si hay más de una, el módulo de referencia se arregla solo y se valida.

### 9 · Imprimir salía en blanco y registraba éxito

`_printConvertedDocument` concatenaba `result.data` dentro de
`data:application/pdf;base64,`. Con Office, `result.data` es un **objeto** (del
`mode: 'file-viewer'`), así que la URI quedaba `base64,[object Object]`: diálogo de
impresión vacío y `_log('PRINT_DOC', 'SUCCESS')` igual. El navegador tampoco sabe
imprimir un `.docx`; eso hay que decirlo, no dejarlo imprimir en blanco.

### 🔴 Una PC recién formateada rompió 2277 archivos y `git status` no lo dijo (2026-10-05)

No es un bug del código. Es el que se repite cada vez que alguien clonea el repo en una máquina
nueva, y por eso vale más que los otros.

**El síntoma:** en un escritorio recién formateado, la app no arrancaba y **cinco tests de EOL
fallaban con el mismo mensaje**:

```
premium.css sigue en LF  [CRLF, esperado LF]
mutaciones: 15/15 mordieron, 0 vacíos
```

Un solo mensaje, cinco tests, todos igual. Eso no es una regresión de UI: es el archivo.

**Por qué se rompió.** El instalador de Git for Windows escribe `core.autocrlf=true` en
`C:\Program Files\Git\etc\gitconfig`. Es **config de sistema**, así que:

- `git config --global core.autocrlf` devuelve **vacío** y parece que no hay nada configurado.
- Solo aparece con `git config --show-origin --get-all core.autocrlf`.
- Ese `true` convierte LF→CRLF **en el checkout**. Como este repo guarda en LF a propósito
  `main.js`, `preload.js`, `index.html`, `main/*-bridge.js`, `shared/*.css` y `premium.css`
  (los tests lo verifican uno por uno), el clon dejó **2277 archivos en CRLF** en disco.

**Lo que lo hace peligroso — y el motivo de esta entrada — es que `git status` dice que el árbol
está limpio.** Por dos razones que se refuerzan: el stat-cache del índice ya registró los tamaños de
los archivos convertidos, y al commitear Git normaliza CRLF→LF. El archivo está mal en disco y Git
no lo ve. El día del próximo `git add` se suben CRLF y aparece el diff de ~7000 líneas.

**El fix que costó encontrar.** Poner `core.autocrlf=false` a nivel de repo no alcanza:

```
git config --local core.autocrlf false
git checkout-index -a -f              ->  0 cambios. No reescribe.
git update-index --really-refresh     ->  0 cambios. No reescribe.
git read-tree --reset -u HEAD         ->  0 cambios. No reescribe.
```

Los tres reportan cero porque el stat-cache sigue afirmando que todo coincide con el índice. **La
única vía que funciona es reconstruir el índice**, para que se vea la diferencia de bytes:

```powershell
git reset            # rehace el índice desde HEAD, sin stat-cache: ahora sí ve los 2277
git checkout -- .    # restaura byte a byte -> LF donde el repo dice LF, CRLF donde dice CRLF
```

**Cómo se comprueba, sin creerse a `git status`:** contar bytes `0x0D 0x0A` en el archivo.

```powershell
$b = [System.IO.File]::ReadAllBytes('sgsst-electron-app/main.js')
$crlf = 0; $lf = 0
for ($i=0; $i -lt $b.Length; $i++) { if ($b[$i] -eq 10) { $lf++; if ($b[$i-1] -eq 13) { $crlf++ } } }
```

Antes: `main.js` 22295 de 22295 en CRLF. Después: 0. `app.js` quedó en CRLF — porque el repo lo
guarda en CRLF (`PROMPT.md` §5.4), y ese es el punto: renormalizar **no** uniforma, **restaura**.

**Resultado:** de 88 a 98 tests en verde sobre 119. Los 10 recuperados eran todos de EOL.

**Regla:** en una máquina nueva, antes de tocar código, `git config --local core.autocrlf false` y
renormalizar. Un clon nuevo no es una copia neutra del repo: llega con una convención de EOL que
Git no te va a señalar como cambio.

### 🔴 `better-sqlite3` se compila contra el Node equivocado (2026-10-05)

Segundo problema del mismo día, y de la misma familia: **el entorno no es una caja neutral**.

`npm install` corrió `node-gyp` contra **Node 26.10.0**, el Node del sistema. El módulo es nativo y
la app nunca corre con ese Node — corre **dentro de Electron 37.10.3, que usa Node 22.21.1 y ABI
136**. Los errores fueron:

```
error C2039: "GetIsolate": no es un miembro de "v8::Context"
error C2660: 'v8::External::Value': la función no acepta 0 argumentos
```

Son APIs de V8 **eliminadas** en versiones nuevas: no es que falte el compilador — `cl.exe` estaba
instalado. Y lo peor: al fallar, **npm revirtió el install entero** (913 paquetes → 2).

**El orden que funciona:**

```powershell
npm install --ignore-scripts                        # sin compilar nada todavía
node node_modules/electron/install.js               # el postinstall quedó sin ejecutar
npm rebuild better-sqlite3 --runtime=electron --target=37.10.3 --disturl=https://electronjs.org/headers
```

Y **verificar con un `SELECT` de verdad dentro de Electron**, porque compilar no es que funcione
(§7.7: ningún test de este repo abre la base):

```
DB OK -> electron 37.10.3, sqlite 3.49.2
```

Un dato aparte que salió del mismo trabajo: el `install.js` de Electron salió con código **0** tres
veces seguidas sin extraer nada, porque el zip de la caché había desaparecido y el proceso moría
sin error. Cuando `install.js` no hace nada, **verificar que `dist/electron.exe` exista**; el
código de salida no alcanza. Salió bien descargando el zip a mano y extrayéndolo.

**Regla:** `npm install` no compila el módulo nativo para el runtime correcto. En este repo eso es
siempre Electron, nunca el Node del sistema.

### 🔴 La rama del administrador era código muerto (📦862, v0.1.241)

**El síntoma.** El owner entra con `admin@kair.local`, hace login bien, y la app le responde
**"No tienes empresas asignadas. Contacta a administración."** — siendo él mismo administración.
Un mensaje que además no tiene salida: no hay empresa a la que asignarse porque no hay ninguna
registrada.

**Por qué se rompió.** `showHomePage` en `renderer.js` filtraba las empresas así:

```js
if (Array.isArray(overrideCompanies)) {        // SIEMPRE true
  dynamicCompanies = overrideCompanies;
} else if (assignedCompanies && ... && !checkIsAdmin()) {
  dynamicCompanies = assignedCompanies;
} else {                                        // ADMIN — nunca se ejecutaba
  const config = await window.electronAPI.loadConfig();
  dynamicCompanies = Object.keys(config.companyPaths);
}
```

`Array.isArray([])` es **`true`**, y `initializeApp()` se llama en **un solo** lugar
(`renderer.js:3604`) pasando siempre `assignedCompanies`, que es un array. O sea: la primera
rama ganaba **siempre**. Verificado con grep: `initializeApp(` aparece una vez en `renderer.js`
(el otro hit es una función homónima definida dentro de `seguimiento-incapacidades.html`).

Consecuencias, todas la misma causa:

- Un **admin** sin empresas asignadas veía **cero** empresas y el mensaje de un usuario normal.
- El `else` del admin era **inalcanzable**, así que el fallback
  `["Tempoactiva","Temposum","Aseplus","Asel"]` tampoco era código real.
- `checkIsAdmin()` **nunca se consultaba**: la rama que la usaba estaba detrás de código muerto.

El backend sí estaba bien: `validateSession` (`main.js:1021`) reconoce `admin@kair.local` y
devuelve `isAdmin: true`, y `auth-login-v1` lo reenvía. El diagnóstico desde la app dio la pista
equivocida durante un rato porque el mensaje **parecía** de permisos.

**Lo peligroso del arreglo obvio.** Agregar `&& overrideCompanies.length > 0` a la primera rama
**abre una escalada de privilegios**: un usuario **no** admin sin empresas caería en el `else`,
que carga `config.companyPaths` completo, y vería **todas** las empresas. El bug visible se
arregla y se crea uno peor, invisible.

**El arreglo correcto es decidir por rol primero**, no por forma del argumento:

```js
const esAdmin = checkIsAdmin();
if (esAdmin) { /* todas, desde config */ }
else if (Array.isArray(overrideCompanies) && overrideCompanies.length > 0) { /* override */ }
else { /* assignedCompanies */ }
```

Y el mensaje también pasó a decidir por rol: `esAdmin ? 'No hay empresas registradas...' :
'No tienes empresas asignadas. Contacta a administración.'`. Un administrador **nunca** debe ver
la frase que lo remite a sí mismo.

**El test (`main/test-admin-empresas-862.js`, 17 checks) ejecuta `checkIsAdmin()` y el bloque de decisión de
`renderer.js` y lo ejecuta** con roles distintos, en vez de buscar cadenas. Cubre los cinco
combinarios de (admin, asignadas, override) más los dos del mensaje.

La prueba de mutación es lo que le da valor: reintroduciendo el orden del bug **sobre el código
nuevo** (conservando `const esAdmin`, para que el check estructural siga pasando), fallan los
dos checks de comportamiento — `admin sin empresas recibió []` y `admin con override recibió
["Solo"]`. Un detector de cadenas habría pasado ese mutante.

**Regla:** en un filtro de permisos, **el rol se decide antes que la forma del dato**. Y cuando
la primera rama sea `typeof`/`Array.isArray` sobre un valor que el llamador siempre manda, hay
que verificar **quién la ejecuta** antes de escribir código que dependa de la segunda: puede
estar muerta y nadie se entera hasta que alguien queda encerrado sin salida.

## 🔴 "Mapeando Estructura de Documentos" nunca termina — plan de 5 fases (📦863, Fase 0, 2026-10-06)

**El síntoma.** El mapeo tarda **760+ segundos** y termina **siempre en error**. No es que esté
lento: termina mal.

**La causa raíz (dos mitades, ninguna visible hasta que se midieron):**

1. **`map_directory.py` calcula SHA-256 de cada archivo** (`_calculate_checksum`, línea 101) para
   ponerlo en el campo `checksum` de cada archivo. Sobre 1,73 GB de Google Drive eso es **~99,6 %
   del tiempo total**: el recorrido de carpetas en sí es instantáneo. Y el campo **no lo consume
   nadie** (grep: 0 lecturas de `checksum` fuera del propio script).
2. **El stdout tiene techo de 1 MiB.** `execFilePromise` (`main.js:4311`) se llama sin `maxBuffer`,
   así que Node corta la salida en 1 MB. El JSON completo pesa ~2,98 MB → `JSON.parse(stdout)`
   (`main.js:4322`) revienta **después** de las hora y media de escaneo. El esfuerzo se pierde
   entero.

**El contrato que NO se puede romper al optimizar** (es lo que fija `test-mapeo-estructura-863.js`):

- `root` (absoluto), `structure.name`, `structure.path` (absoluto) y `structure.subdirectories`
  como **diccionario** (no array) — 22 lectores y 12 copias de `findDirFlexible` dependen de eso.
- `searchInStructure` (`main.js:1401`) devuelve **la ruta en string** y recorre
  `node.subdirectories`; `formatStructureForLog` (`renderer.js:7546`) tolera nodos sin `files`.
- El pipeline: handler `map-directory` → `execFilePromise(pythonPath, [pythonScriptPath, directoryPath])`
  → `JSON.parse(stdout)`.

**Lo que SÍ se puede sacar (0 consumidores verificado con grep):** `checksum`, `files[]`,
`file_count`, `dir_count`, `errors` y el indentado `indent=2` del `json.dumps`.

**Las 5 fases aprobadas:**

| Fase | Paquete | Qué hace |
|---|---|---|
| 0 | 📦863 | Este test: contrato escrito ANTES de tocar nada (36 checks, con corrida real y fallback sin Python) |
| 1 | 📦864 | `maxBuffer` + `timeout` en el `execFile` — que el stdout no corte a 1 MiB |
| 2 | 📦865 | Velocidad: sin SHA-256, `os.scandir`, un solo pase, `scan_date` real (hoy sale `null`) |
| 3 | 📦866 | Tamaño: sin `files[]` ni indentado (el JSON baja de ~3 MB a mucho menos) |
| 4 | 📦867 | Progreso real: el script avanza por stderr → IPC → la UI. **HECHA**: `_avisar_progreso()` en `map_directory.py`, `child.stderr` en `main.js`, `onMapDirectoryProgress` en `preload.js`, contador real en `config-viewer.html`, y el texto "10-60 segundos" eliminado |
| 5 | 📦868 | Backlog (sigue sin arrancar: el mapeo ya no corta ni miente, no hay tarea viva que espere) |

**Regla para las fases siguientes:** el test de Fase 0 está escrito con invariantes que
**sobreviven** a las fases 1-4. Si una fase lo hace fallar, la fase está rompiendo el contrato,
no el test. Y **agregar** un check nuevo por fase en vez de editar los viejos.

**Regla general:** cuando un proceso largo falla *al final*, buscar primero **dos cosas
independientes**: qué tarda (perfil de tiempo) y qué se pasa de tamaño (peso real de la salida).
Arreglar solo una de las dos deja el mismo error.

---

## 🔴 El consentimiento decía tratar datos que K+AIR no maneja (2026-10-09)

**El síntoma.** No era un bug de código. El modal de consentimiento de `index.html` declaraba que
K+AIR trata *"historias clínicas, audiometrías, electrocardiogramas"*. **K+AIR no maneja ninguno de
esos tres.** Registra seguimientos médicos, consultas y certificados de aptitud médica.

**Por qué esto es más grave que un texto mal redactado.** Esos tres son, literalmente, los datos
sensibles de salud que la Ley 1581 protege con más fuerza. Un consentimiento que declara tratar lo
que no trata no es imprecisión: es una base que se puede impugnar.

**Lo que estaba mal en el mismo párrafo, y no era visible:**

1. La ley distingue **dos** autorizaciones y el texto las mezclaba. Datos personales requieren
   autorización **previa**, expresa e informada; datos sensibles requieren autorización **expresa e
   informada** (art. 6, sin "previa"). El texto decía "previa" para las dos.
2. Faltaba el **art. 25**: la empresa que usa K+AIR es **responsable** y K+AIR es **encargado**. Sin
   esa frase el rol del controlador queda indefinido, y el anexo de encargo se queda sin a quién
   se le responde.

**Regla general.** Cuando el documento legal de un producto se escribe una vez y queda congelado,
la primera pregunta no es si está bien redactado, sino **qué datos maneja realmente el producto**.
Esa respuesta está en el código, no en el documento: se verifica mirando qué se registra, no
releyendo el texto. El consentimiento describe una app, y la app se puede haber movido.

**Documentos que acompañan al cambio** (`sitio/`, fuera de la app): `anexo-encargo.html` y
`autorizacion-trabajadores.html`, ambos enlazados desde la barra de `privacidad.html` y
`terminos.html`, y referenciados entre sí.

**🔴 Abierto.** La clase `.kair-consent__aviso` (`styles.css:8961`) se agregó en este mismo cambio
pero **no se referencia en ningún archivo**: `grep` sobre `sgsst-electron-app/` devuelve un solo
resultado, su propia definición. Parece creada para una caja de aviso en el modal que nunca llegó
al HTML. Queda por decidir si se usa o se quita; no se tocó en el commit para no interpretar una
intención que no está escrita.


> ## 🚦 Arranque — leé esto primero
>
> Este archivo tiene **4 800+ líneas y es 89 % bitácora de bugs**. No lo leas entero: buscá con grep.
>
> | Leé esto | Para qué |
> |---|---|
> | **`../PROMPT.md`** | El prompt operacional. Rol, reglas de proceso, convenciones, trampas activas |
> | **`../Historial.md`** | **Dónde quedó el trabajo y qué falta.** Estado de cierre + cola acordada |
>
> Empezá por esos dos. Recién después volvés a buscar acá el "por qué" de algo puntual.
>
> ⚠️ **Este archivo contiene secciones que quedaron viejas.** Si contradice al código, **manda el
> código** y hay que corregir la sección. Las trampas conocidas están en `PROMPT.md` §9.
>
> 🔴 **Y una advertencia sobre este archivo en particular:** nada de lo que dice acá es una regla
> sin verificar. Hubo reglas "OBLIGATORIAS" que mandaban llamar funciones que **no existen**
> (`KairUI.esc()`, `KairHelpers.formatDate()`), una convención de commits con 270 versiones de atraso,
> y una referencia a un archivo CSS inexistente. **Grepeá antes de aplicar lo que leas acá.**
> La regla completa está en `../PROMPT.md` §5.9.

## Skills Disponibles

Todos los skills se activan con `skill({ name: "<nombre>" })`. El modelo decide cuando cargarlos segun la tarea.

### Skills de UI/UX

| Skill | Cuando usarlo | Activacion |
|-------|--------------|------------|
| **ui-ux-pro-max** | Diseno de interfaces, paletas, tipografia, animaciones, responsive, dark mode | OBLIGATORIO para UI/UX |
| **frontend-design** | Interfaces con alta calidad visual, estetica creativa, evitar look generico AI | Recomendado para UI nueva |

**ui-ux-pro-max** - Motor de busqueda Python (ejecutar antes de implementar UI):
```bash
python .opencode/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system -p "K+AIR"
python .opencode/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>
python .opencode/skills/ui-ux-pro-max/scripts/search.py "<query>" --stack html-tailwind
```

**Stacks:** html-tailwind, react, nextjs, vue, svelte, swiftui, react-native, flutter, shadcn, jetpack-compose
**Dominios:** product, style, typography, color, landing, chart, ux, web, prompt

### Skills de Desarrollo (Superpowers)

| Skill | Cuando usarlo | Activacion |
|-------|--------------|------------|
| **feature-dev** | Desarrollar features nuevas (workflow 7 fases) | Al implementar features |
| **code-architect** | Disenar arquitectura antes de implementar | Antes de features grandes |
| **code-explorer** | Entender codigo existente antes de modificarlo | Antes de tocar codigo desconocido |
| **code-reviewer** | Review de bugs, seguridad, calidad (confidence >= 80) | Despues de implementar, antes de commit |
| **code-simplifier** | Simplificar codigo manteniendo funcionalidad | Despues de implementar, antes de commit |
| **silent-failure-hunter** | Cazar errores silenciosos y error handling deficiente | Despues de escribir try-catch o fallbacks |
| **security-review** | Review de seguridad: inyeccion, auth bypass, crypto, RCE, data exposure (confidence >= 8) | Despues de implementar, antes de commit, para codigo con input de usuario |
| **commit-workflow** | Crear commits, push, PRs con mensajes significativos | Al hacer commit o PR |

### Skills de Requisitos y Calidad (Addy Osmani · `.agents/skills/`)

Skills de `addyosmani/agent-skills` seleccionadas por complementar Superpowers sin duplicar. Se activan con `skill({ name: "<nombre>" })`.

| Skill | Cuando usarlo | Activacion |
|-------|--------------|------------|
| **interview-me** 🥇 | Extraer lo que el usuario realmente quiere: una pregunta a la vez hasta ~95% confianza. Mejor que brainstorming para pedidos vagos ("hazme X" sin detalle) | Pedido subespecificado; "interview me", "grill me", "are we sure?" |
| **constraint-driven-development** 🥇 | Formalizar y hacer cumplir las reglas duras del proyecto como contrato escrito (`CONSTRAINTS.md`). Detecta cuando un agente "suaviza" checks (tests saltados, suppressions, thresholds bajados) | Definir/auditar estandares de calidad; cuando se note que se relajan reglas de AGENTS.md |
| **doubt-driven-development** 🥈 | Revision adversarial fresh-context de cada decision no trivial antes de darla por buena: CLAIM → EXTRACT → DOUBT → RECONCILE. Seguro contra bugs de raiz escondida (caso Bootstrap 📦761) | Stakes altos (seguridad, auth, migraciones irreversibles); codigo unfamiliar; output "seguro" pero barato de verificar ahora |
| **deprecation-and-migration** 🥈 | Gestionar retiro/migracion de sistemas viejos, APIs o features. Expand/contract, eliminar codigo zombie | Limpiar modulos legacy del repo; decidir si mantener o sunsetear algo |
| **documentation-and-adrs** 🥉 | Architecture Decision Records: documentar el *porque* de decisiones arquitectonicas y cambios de API | Decisiones de arquitectura; shipping features; cambiar APIs publicas/IPC |

**Nota:** `git-workflow-and-versioning` de este pack NO se instalo a proposito — choca con la convencion `📦n` obligatoria del repo.

**Origen:** [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (98k★, MIT). Todas Safe / Low Risk. Docs: `.agents/skills/<nombre>/SKILL.md`.

### Skills de Testing Electron (`.agents/skills/`)

| Skill | Cuando usarlo | Activacion |
|-------|--------------|------------|
| **desktop-testing-electron** | Tests E2E con Playwright `_electron.launch()`, unit tests de main/preload (mock de `electron`/`contextBridge`/`ipcRenderer`), stub de dialogos nativos, CI headless con `xvfb-run` | Al escribir o correr tests de la app Electron |
| **electron-playwright-cli** | Automatizar la app Electron en vivo: snapshots, clicks, typing, screenshots, extraccion de datos (CLI `electron-playwright-cli`) | Para interactuar/probar la app en runtime sin armar un test formal |

**Reglas criticas (desktop-testing-electron):**
- SIEMPRE `await electronApp.close()` en el teardown (procesos Electron rompen CI).
- Mockear el modulo `electron` en unit tests (las APIs solo existen dentro del runtime).
- Stub de `showOpenDialog`/`showSaveDialog` en E2E (bloquean el proceso).
- CI headless Linux: `xvfb-run` o `xvfb-maybe`.

**Config electron-playwright-cli:** crear `.playwright/cli.config.json` con `browser.launchOptions.args: ["main.js"]` apuntando al entry point del proceso main.

**Tests existentes del repo** (patron scripts sueltos con `node`, sin framework): `tests/test-*.js`, `main/test-*.js` — se corren con `node <ruta>`. Las skills de arriba son para tests E2E/formales de la app Electron completa.

### Skills de Superpowers (Plugin Global)

Se activan con `skill({ name: "superpowers/<nombre>" })`. El plugin inyecta bootstrap context automaticamente en cada conversacion.

| Skill | Cuando usarlo | Activacion |
|-------|--------------|------------|
| **superpowers/brainstorming** | Refinar ideas antes de codificar, diseno socratico | OBLIGATORIO antes de escribir codigo nuevo |
| **superpowers/writing-plans** | Crear planes de implementacion detallados | Despues de aprobar diseno |
| **superpowers/executing-plans** | Ejecutar planes en batch con checkpoints | Con plan aprobado |
| **superpowers/subagent-driven-development** | Desarrollo rapido con subagentes y review en 2 etapas | Alternativa a executing-plans |
| **superpowers/test-driven-development** | Ciclo RED-GREEN-REFACTOR | OBLIGATORIO durante implementacion |
| **superpowers/systematic-debugging** | Debugging sistematico en 4 fases, root-cause tracing | Al investigar bugs |
| **superpowers/verification-before-completion** | Verificar que algo esta realmente arreglado | Antes de declarar un bug como resuelto |
| **superpowers/requesting-code-review** | Checklist pre-review | Entre tareas del plan |
| **superpowers/receiving-code-review** | Responder a feedback de review | Al recibir comentarios |
| **superpowers/using-git-worktrees** | Branches aislados para desarrollo paralelo | Al iniciar feature branch |
| **superpowers/finishing-a-development-branch** | Verificar tests, decidir merge/PR/keep/discard | Al completar tareas |
| **superpowers/dispatching-parallel-agents** | Workflows concurrentes con subagentes | Para tareas independientes |
| **superpowers/writing-skills** | Crear nuevos skills siguiendo mejores practicas | Al crear skills personalizados |
| **superpowers/using-superpowers** | Introduccion al sistema de skills | Referencia general |

### Workflow Recomendado para Desarrollo

1. **interview-me** - Si el pedido es vago o subespecificado (antes de todo)
2. **constraint-driven-development** - Si no hay CONSTRAINTS.md o se estan relajando reglas
3. **feature-dev** - Workflow completo (7 fases: discovery, exploration, questions, architecture, implementation, review, summary)
4. **doubt-driven-development** - Si stakes altos o decision no trivial (antes de dar por bueno)
5. **code-simplifier** - Despues de implementar codigo
6. **code-reviewer** - Antes de commit
7. **security-review** - Antes de commit, para codigo con input de usuario o superficies de ataque
8. **commit-workflow** - Al hacer commit

**Cuando NO usar Addy en paralelo a Superpowers:** no invocar `using-agent-skills` (meta-router de Addy) junto a `using-superpowers` — dos routers activos pelean por el routing. Elegir uno como primario; en este repo el primario es **Superpowers**.

### Proyecto K+AIR (SG-SST Electron)
- Stack: Electron + vanilla JS + Python 3.11.9
- No usar frameworks frontend (React, Vue, etc.)
- Para UI usar: html-tailwind guidelines del skill ui-ux-pro-max

### Convencion de Commits (OBLIGATORIO)

El usuario usa su propio formato de commits con versionado incremental. El formato vigente es un **híbrido**: el número de paquete delante y conventional commits después.

```
📦<numero| rango>[-fix] # <tipo>(<scope>): <descripcion en espanol, tono casual, sin punto>
```

Ejemplos reales (`git log`): `📦850-851 # feat(bandeja): columna lateral plegable y sin etiqueta de fecha`

> 📌 **Corregido 2026-10-03.** Esta línea decía antes "**NO** usar conventional commits" y definía
> `📦<numero> # <descripcion>`. El equipo migró al formato híbrido y esta sección quedó vieja.
> **Verificá con `git log -15` antes de cada commit**: la convención de este repo cambió varias veces.

- El emoji 📦 es literal (no es un placeholder).
- `<numero>` es secuencial e incremental (último conocido: 579 → siguiente 580 al 2026-07-21).
- La descripción es en español, sin punto final obligatorio, tono directo (ej: "Fix y Update sistema actualizacion e iconos y accesos directos del escritorio").
- Para work-in-progress / doc-only / refactor sin cambio funcional visible, mantener el mismo formato 📦n #.
- Ejemplos reales del repo: `📦396 #`, `📦397 #`, `📦398 #`, `📦399 #`, `📦551+552 #`, `📦579 #` (loop 47b, menú nativo).

**Antes de cada commit, verificar el último `📦<n>` en `git log` para usar el siguiente número correcto.**
- Si la sesión trabaja con Mavis (agente), **ambos pueden usar numeración** — coordinarse con `git log` antes de cada commit para no colisionar. Si ya hay un 📦547 tuyo, yo uso 📦548+ (no 📦547+548).
- Cumplir Resolucion 0312 de 2019 (Colombia)

**Prefijos alternativos (no solo `📦<n>`):** además del formato principal `📦<n>`, se usan prefijos descriptivos para cambios no funcionales:
- `🐛 fix:` — Bug fix puntual (ej: `🐛 fix(bandeja-integrada): 2 errores runtime`)
- `🎨 audit:` — Mejora visual / auditoría de UI (ej: `🎨 audit(objetivo): 3 ajustes`)
- `📧 audit:` — Auditoría de email (ej: `📧 audit(thread-grouping): refactor Gmail`)
- `📚 docs:` — Documentación (ej: `📚 docs: actualizar documentación completa v0.1.120`)
- `🔖 Bump version` — Bump de versión dedicado (1 commit)
- `Revert "<mensaje del commit original>"` — Revertir un commit completo. Usar `git revert <hash>` (NO `git reset --hard`). El historial queda limpio (commit original + commit de revert).
- Después de un revert, si querés reaplicar los cambios: `git revert <hash-revert>` o `git cherry-pick <hash-original>`

### Regla de Comunicación - Explicación Simple

Cuando diagnostiques un error o propongas una corrección, SIEMPRE debes incluir al final de tu respuesta una sección explicativa en lenguaje sencillo (sin jerga técnica) que contenga:

1. **Qué está pasando** - Explicar el problema como si le hablaras a alguien que no programa
2. **Qué hace la propuesta** - Explicar en términos simples qué corrige tu solución
3. **Antes vs Después** - Mostrar visualmente el cambio con un ejemplo claro

Formato recomendado:

```
## Explicación Simple

### El problema
[Explicar qué pasa actualmente en lenguaje cotidiano]

### La solución
[Explicar qué hace la corrección de forma sencilla]

### Antes vs Después
ANTES (con bug): [Descripción simple]
DESPUÉS (corregido): [Descripción simple]
```

NO usar términos como: callback, listener, async, await, variable, función, línea, código, archivo, componente, hook, state, props, render, mount, unmount, **BEM, CSS variable, data-attribute, grid, flexbox, hover, transition, shadow, border-radius, z-index, media query, pseudo-clase, cascada, responsive, overflow, scrollbar, gutter, opacity, transform, animación, breakpoint, padding, margin, gap, font, weight, color, background, border, radius, sombra, opacidad, transición, evento, controlador, manejador, helper, utilidad, módulo, import, export, require, dependency, paquete, librería, framework, patrón, refactor, debug, log, consola, stack, trace, error, excepción, promesa, callback, hilo, thread, mutex, lock, cache, memoria, almacenamiento, base de datos, query, SQL, índice, transacción, commit, rollback, merge, branch, push, pull, request, response, endpoint, API, endpoint, payload, JSON, XML, HTTP, HTTPS, SSL, TLS, header, body, query string, param, GET, POST, PUT, DELETE**, etc.
SI usar términos como: sistema, mensaje, ventana, tema, preferencia, configuración, resultado, lista, tabla, tarjeta, botón, panel, formulario, campo, opción, calendario, fecha, hora, día, mes, año, correo, contacto, evento, reunión, cita, capacitación, inducción, evaluación, archivo, documento, empresa, empleado, persona, etc.

---

## 📦887 / 889 / 890 · El color no tenía tema — y tenía cuatro formas distintas de romperse

Entre los tres paquetes se corrigió el modo oscuro de los submódulos del módulo **Recursos**: el home,
1.1.2 Roles y Responsabilidades, 1.1.3 Asignación de Recursos y 1.1.5 Gestión del COPASST. Los cuatro se
veían en claro con el shell oscuro alrededor, y **ninguno compartía la misma causa inmediata**. El
subtítulo del paquete lo dice, pero conviene separarlas, porque son cuatro comprobaciones distintas y una
sirve para diagnosticar a la otra.

| # | Qué falta | Cómo se reconoce |
|---|---|---|
| 1 | **El CSS no tiene ninguna regla por tema** | Hay colores escritos a mano. Se ve texto claro sobre fondo blanco |
| 2 | **Otro `:root` se lleva los tokens por delante** | Los tokens oscuros **sí** llegan, pero `--kair-card` resuelve a `#ffffff` |
| 3 | **Es un iframe y el `data-theme` no cruza la frontera** | El CSS oscuro está perfecto y no aplica nada. **No hay error en consola** |
| 4 | **Las reglas apuntan al contenedor, no a `<html>`** | `[data-theme="dark"] .algo[data-theme="dark"]` no matchea nunca |

El 1 y el 2 se confundían con frecuencia: en el 887 el síntoma era "tarjetas blancas" y la causa era el
2, porque dos CSS de módulo (`inspeccion.css` e `revision-alta-direccion.css`) abrían un `:root` con la
paleta **clara** y se cargaban **después** de `shared/kair-design-tokens.css`. `:root` y
`[data-theme="dark"]` empatan en (0,1,0) y los dos matchean `<html>`, así que ganaba el último.

### Trampa 1 · `dark-legacy` no es alias de `dark`

El shell manda el tema resuelto por tres vías, y una de ellas trae el **oscuro manual** como
`dark-legacy`:

1. `get-theme-response` → `{theme: <ya resuelto>}` — `renderer.js:2006`
2. `theme-changed` → `{theme: <preferencia>, effectiveTheme: <resuelto>}` — `renderer.js:1756` y `7445`
3. escritura directa en `iframe.contentDocument.documentElement` — `renderer.js:1746` y `7418`

Un código que solo acepta `'dark'` recibe `'dark-legacy'`, lo da por claro y **le quita el atributo**. El
modo manual queda sin pintar mientras el de sistema funciona: **la mitad de las pruebas pasa y parece que
el arreglo funcionó.** Cualquier validación de tema tiene que probar los dos modos por separado.

**Las que NO llegan** son las de `scripts/theme-manager.js`, que espera `{theme, mode}`. Ese archivo existe
en disco y **no está cargado en el shell**. Código que dependa de su forma de mensaje está roto sin que
nada lo indique. Por eso existe `shared/kair-iframe-theme.js`.

### Trampa 2 · Un `:root` dentro de un `<style>` inyectado escribe en TODO el shell

`showRealizarActasInterface()` (📦890) crea un `<style>` con `document.createElement('style')` y lo cuelga
en un `div`. **Un `<style>` aplica a todo el documento sin importar dónde cuelgue, y un `:root` que no está
en el `<head>` sigue siendo el `<html>`.** Ese `:root` traía `--widget-bg-color: #ffffff`, que `styles.css`
usa en **44 lugares**. Como la hoja entra después, ganaba por orden contra `[data-theme="dark"]`: mientras
el formulario estaba abierto, **el shell entero se leía con superficies blancas**, y no solo el formulario.

**Regla:** un `<style>` inyectado por un componente **nunca** declara `:root`. Los tokens van en el
contenedor real, que es `.copasst-actas-container`. Y todo selector de clase de ese `<style>` lleva el
contenedor delante: una regla sin scope en algo inyectado en el shell es una regla global esperando que
otro módulo la pise. En el 890 el primer pase dejó **tres** selectores sueltos (`.acta-form-group textarea`,
`.acta-form-group textarea:focus` y `.acta-btn-remove:hover`) y **el test los encontró**.

### Trampa 3 · El `postMessage` llega DESPUÉS de la escritura directa

El Repositorio de Actas (📦890) se quedaba en claro con el sistema en oscuro, y el CSS estaba bien. La
cadena, en orden:

```js
// renderer.js:1743-1759
iframe.contentDocument.documentElement.setAttribute('data-theme', 'dark');  // 1. correcto
iframe.contentWindow?.postMessage({ type: 'theme-changed',
                                    theme: themeMode, effectiveTheme });     // 2. despues
```

El paso 2 llega **asíncrono**, así que siempre se procesa después. El sincronizador del visor traducía el
mensaje con la forma `{theme, mode}` de `theme-manager.js`: con `theme: 'system'` devolvía `null` y
terminaba en `removeAttribute`, **borrando lo que el paso 1 acababa de poner**. Ganaba siempre el paso que
rompía.

**Regla:** si un iframe recibe el tema por **escritura directa Y por mensaje**, hay que decidir cuál manda y
**quitar el otro**. Conservar el sincronizador viejo "por si acaso" es lo peor: es el bug, y volver a usarlo
lo reintroduce en silencio. Ahora solo queda `shared/kair-iframe-theme.js`.

### Trampa 4 · El sello `?v=` va en los TRES niveles

Documento del iframe, script, y **el `iframe.src` en el padre**. En 1.1.2 el `iframe.src` no tenía ninguno:
el arreglo completo no llegaba a la vista, y sin él Electron sirve del caché. Esto ya costó dos intentos en
esta sesión.

### Trampa 5 · Un arnés que miente es peor que no tener arnés

La primera versión del arnés mutaba `data-theme` con el DOM ya montado y medía con `getComputedStyle`.
Reportaba **16 fallas que no existían**. Sin un ciclo de render entre el cambio y la lectura, el navegador
devuelve el estilo del **estado anterior**.

**La firma del arnés mintiendo** es una que no se puede explicar por el CSS: en un mismo elemento y en el
mismo instante, la **variable de tema leída como oscura y el fondo leído como claro**. Si eso aparece, el
que mide está mal.

**Regla:** el tema viaja en el HTML **desde el parseo**, antes del primer `<link>`:

```html
<script>(function(){var m=/[?&]modo=([a-z-]+)/.exec(location.search);var x=m?m[1]:'dark';
if(x!=='claro')document.documentElement.setAttribute('data-theme',x);})();</script>
```

Y `void documentElement.offsetHeight` no sirve: no fuerza el recálculo de estilo. Lo que funciona es que el
navegador nunca haya visto otro estado.

### Lo que sí se midió, y cómo

Nada de esto se afirma por lectura de CSS. El contraste se **midió** en el navegador, componiendo el fondo
real (subiendo por el árbol juntando capas con alfa) y contra la tarjeta real de cada tema:

| Paquete | `dark` | `dark-legacy` | claro |
|---|---|---|---|
| 890 · Portal + Generador | 42/42 | 42/42 | 23/23 |
| 890 · Repositorio de Actas | 10/10 | — | — |

El contraste del claro se comprueba contra los **valores exactos que producía el archivo original**, leídos
del CSS antes de tocarlo: los 23 coinciden. Es la forma de probar el "no toqué el claro" sin inventar.

WCAG 1.4.3 (4.5:1 para texto normal) encontró tres cosas que **una revisión visual no ve**: los botones de
acento estaban en **2.56:1** y **1.75:1** con texto blanco en oscuro, y "+ Agregar tema" en **3.95:1**. En
oscuro un azul que sube a `#5da2ff` necesita **texto oscuro encima**, no blanco.
---

## 📦891 / 892 · 1.1.1: el atributo que dispara el CSS, y el canal que no existe

Dos fallos con la misma forma: **una pieza del contrato entre capas que nadie verifica**. En los dos, el
código estaba escrito suponiendo algo del otro lado, y el otro lado hacía otra cosa.

| # | Capa que dio por sentado algo falso | Dónde | Qué pasó |
|---|---|---|---|
| 1 | El viewer traducía `{theme, mode}`; `renderer.js` manda `{theme, effectiveTheme}` | `responsable-sg-viewer.js` vs `renderer.js:1755` | `mode` llegaba `undefined`, el fallback devolvía `null` en modo sistema, y el `postMessage` **borraba** el atributo que la escritura directa acababa de poner |
| 2 | El padre rutaba por `__fileViewerBytes`; el preload expone `readFileBytes` | `responsable-sg-logic.js:69` vs `preload.js:285` | La guarda `typeof electronAPI[n] === 'function'` mató el canal **antes** del ruteo: el PDF fallaba siempre y ~40 líneas quedaron muertas |

### Cinco trampas de este turno

**Trampa 1 · Un canal virtual no es una función del preload.** `__fileViewerBytes` es una bandera para
llegar al bloque que lee bytes. Si validás que exista como función **antes** de rutear, lo matás. Y si
dejás una red de seguridad "por si falta algo", tiene que estar **después** de la guarda: comprobá que sea
**alcanzable**, no que el código exista. El test 861 llevaba tiempo comprobando la red sin notar la guarda.

**Trampa 2 · `dark-legacy` no es alias de `dark`, y `postMessage` es asíncrono.** Cuando el shell escribe
directamente en `contentDocument` **y además** manda un mensaje, gana el mensaje. Quitar una de las dos
rutas.

**Trampa 3 · Un panel que no limpia el estado anterior miente sobre el documento actual.**
`_showLoading()` solo encendía el overlay. El fallo de una carga pasada quedaba pintado debajo. Con un
`.docx` en pantalla y un error de PDF encima, no había forma de saber cuál fallaba. Limpiá **antes** de
pedir, y rescatá el `emptyState`: vive **dentro** del contenedor, así que al vaciarlo se pierde para siempre.

**Trampa 4 · Leer `utf8` y escribir `latin1` destruye el archivo sin que se note.** Cada `═══`, `—` y `·`
pasa a `P` o `?`. **Un CSS sigue funcionando con los comentarios convertidos en basura**, porque el
navegador los ignora: nada falla en pantalla. Lo detectó un test al leer 0 tokens. **Todo script que
escriba un archivo del repo tiene que abortar si el resultado contiene `U+FFFD`.**

**Trampa 5 · Un check que compara posiciones de dos textos distintos da un fallo falso.** Para verificar
que el `<script>` de tema va antes del primer `<link>`, hay que sanear los comentarios **antes de sacar
los dos índices, y sobre el mismo texto**: el comentario del `<head>` documenta por qué algo va primero, y
es más largo que el gap que se quiere medir. También: un check que cuenta usos con regex cuenta la
definición de la función como un uso más, y una mutación que no encuentra su ancla es un **mutante
vacío**, que es un fallo del test, no un detalle.

### El patrón que sí funciona

Un test de tema que **lee los tokens del CSS y calcula luminancia**, en vez de comparar contra una tabla
escrita a mano. Si alguien cambia `--kair-primary`, el ratio se recalcula y el test falla porque el color
sobre él ya no alcanza — no porque alguien se acuerde de actualizar la tabla.
## 📦893 · La pantalla de selección de empresa: una clase de página no se monta en un overlay

Después de 891 y 892, el owner pidió rediseñar la pantalla con la que arranca la app. Vanta se
conserva, las tarjetas llevan borde redondeado de 20 px y el texto va sobre un panel de vidrio. Lo
que se vej en pantalla no es lo queapproved, y ahí están las cinco lecciones.

**Trampa 1 · `.kair-premium` es el ENVOLTORIO DE PÁGINA, no una clase de contenedor.**
`shared/kair-premium.css:22` la define con `background:var(--kair-canvas,#FBFCFB)`,
`height:100%`, `width:100%` y `overflow-y:auto`; la línea 265 le da su oscuro,
`background:var(--content-area-bg,#2d3748)`. Montarla sobre el overlay tapaba la animación de
Vanta con un bloque opaco. Compra dos cosas (la fuente del sistema y el color de texto) y arrastra
tres que en un overlay sobran. **Un overlay se declara autosuficiente**: no alquila nada de la
página. Por eso el bloque del 893 cuelga de `.kair-company-select` a secas y re-declara la fuente,
el `box-sizing` y las bases de `.kair-mod`, que viven todas bajo `.kair-premium`.

**Trampa 2 · Cancelar una cascada con `background:transparent` defiende el síntoma, no la causa.**
La regla del overlay ganaba por especificidad y el bloque opaco desaparecía. El CSS quedaba
**correcto**, y ningún test lo cantaba —ni lo cantaría con la causa presente, porque la causa no
afectaba el resultado del check. Ese es el peor tipo de defensa: una que hace que todo parezca
bien mientras el error de fondo sigue ahí. Cuando el síntoma se solve con una regla que compite,
preguntate cuál es el error de diseño que la regla está tapando.

**Trampa 3 · Un estilo en línea puede ser COMPORTAMIENTO, no decoración.**
La pantalla vieja llevaba `uiContainer.style.alignItems = 'center'`. Al pasarla a clases, los doce
estilos en línea se fueron, y con ellos el centrado. Un contenedor sin `align-items` sigue siendo
un contenedor **válido**: llaves cuadradas, sin color prohibido, sin error de sintaxis, y el test
en verde. **Ningún check de estructura lo ve; solo se nota mirando la pantalla.** Cuando saques
estilos en línea, leé cada uno preguntándote qué se pierde si desaparece.

**Trampa 4 · Un check que fija el `?v=` literal se rompe en el próximo bumpeo.**
`test-panel-tema-885.js` exigía que el sello de `kair-premium.css` contuviera `panel885`. Cuando el
893 lo bumpeó, el test falló **sin que hubiera ningún error de verdad**, y su mutación se volvió
vacía porque el `replace()` ya no encontraba su ancla. Lo que ese check quiere asegurar es que
Electron no sirva el CSS anterior desde su caché, y eso lo garantiza la **fecha** del sello, no su
texto. **Anclá a la fecha mínima, nunca al literal del paquete.**

**Trampa 5 · Cuando el CSS cambia de forma, las mutaciones se vuelven no-op en silencio.**
Al rehacer el bloque del 893, seis mutaciones seguían apuntando a selectores que ya no existían.
No fallaron: el arnés las reportó como `MUTANTE VACIO`, que es exactamente lo que un mutante
vacío esconde. Después de cada rediseño, **re-anclá las mutaciones y exigí `mutaciones vacias: 0`**.
Un mutante que no muerde es peor que no tener mutación, porque el arnés dice «todo bien» mientras no
cubre nada.

### El patrón que sí funciona

Un check que **lee el atributo y el contexto donde vive**, no el atributo suelto. El test del 893
exige que `renderer.js` cree el contenedor **sin** la clase de página y que ninguna regla del
bloque cuelgue de ella. Con eso, el error de fondo no puede volver ni aunque alguien lo intente
de nuevo. Y para el contraste: componer los `rgba` sobre el fondo real **antes** de medir, en vez
de escribir el ratio a mano en un comentario.

## 📦894 · Un submódulo montado en línea nunca recibe el tema

El owner reportó dos cosas en un mismo mensaje: el submódulo 1.2.1 Programa de Capacitación Anual no
aplicaba bien los temas Sistema y Oscuro, y en el mismo mensaje aparecíA un `console.warn` de "Cambio de
módulo bloqueado". Su frase fue "no sé qué decisión tomar no quiero dañar nada de lo que ya funciona".
Ni una decisión ni un código sin antes: primero el diagnóstico, luego el owner decidió, luego un test por
cada arreglo.

**Trampa 1 · El tema solo llega a `<html>` y a los iframes.** Ese es el contrato del shell, y es
correcto. Lo que no estaba contemplado es el tercer caso: un submódulo cuyo contenido se inyecta **en
línea** con `fetch` + `innerHTML`. Ahí no hay `contentDocument` al que escribirle y el contenedor nunca
recibe el atributo. Una vista en línea tiene que **espejar** el atributo desde `document.documentElement`,
o su CSS de tema es código muerto. Antes de asumir que un `[data-theme]` no calza, **contar las escrituras**:
en capacitaciones había 0 `setAttribute` y 1 solo `getAttribute`.

**Trampa 2 · Un `--kair-*` global SÍ hereda: por eso el defecto se ve a medias.** Las tarjetas del
submódulo salían oscuras porque leen los tokens globales de `:root`, que el shell sí actualiza. Solo se
rompían el fondo, el texto propio y los gráficos. El resultado es una pantalla "a medio tema" que hace
pensar que el CSS está mal escrito, cuando el problema es que **nunca se ejecutó**.

**Trampa 3 · Las "reglas muertas" suelen ser código correcto que no calza.** Las 47 reglas
`[data-theme="dark"]` de `capacitaciones-view.css` estaban registradas como deuda desde antes. No eran
basura: eran el tema entero del módulo, escrito bien yJamás ejecutado. Antes de borrar código muerto,
preguntarse **qué lo haríA vivo** — porque casi siempre la respuesta es "un atributo que nadie escribe".

**Trampa 4 · Recrear un gráfico para cambiarle el tema le borra los datos.** Los colores van horneados
en el momento de crearlo, así que un cambio de tema obliga a recrearlo. Pero `initializeCharts()` deja las
series en cero: sin el `updateCharts()` que va justo después, cambiar de tema deja los tres gráficos vacíos.
Se arregla la legibilidad y se rompe el dato. Hay check dedicado al **orden** de esas dos llamadas, y una
mutación que invierte ese orden.

**Trampa 5 · Un espejo mal hecho es un bucle silencioso.** Si `_syncTheme()` leyera el atributo del
propio contenedor en vez de `documentElement`, se realimentaría: primero null, luego null para siempre, y
el defecto original volvería con código nuevo. El test exige que lea de `documentElement` **y** que no lea de
`this.container` en el mismo método.

**Trampa 6 · Registrar el estado es parte de tomar la vista.** `showSettingsPage()` monta un iframe sobre
`contentArea` y no anotaba nada: `currentModule` seguía diciendo "Recursos" y `currentSubmodule` decía
"1.2.1". El candado de `showModuleContent` veía ese valor truthy y se descartaba. El `console.warn` que lo
delataba era **cosmético**: lo que pasaba es que el clic siguiente en el menú no hacíA nada, sin error y sin
aviso. **Cuando una superficie reemplaza a la anterior, el estado anterior tiene que soltarse**, y antes de
borrar el DOM, no después.

**Trampa 7 · Arreglar el síntoma del estado destapa otro defecto.** Al quitar el bloqueo, el bloque de
refresco de tema (que usa `currentModule` para recargar "el módulo visible") empezó a expulsar al usuario de
Configuración hacia Recursos en cuanto tocara el selector de tema. Por eso `currentModule = null` va
**explícitamente** en la misma línea lógica, y por eso el test exige que estén juntos.

**Trampa 8 · Un candado que se habilita no se quita.** El candado de `showModuleContent` segue ahí:

**Trampa 9 · `dark-legacy` no es "el mismo oscuro con otro nombre": es otra paleta.** El prefijo
`[data-theme^="dark"]` hace que las reglas apliquen a las dos, **pero el bloque que las declara solo trae los
valores de `dark`**. Resultado: una pantalla azul dentro de un shell gris, que es justo lo que el owner
detectó mandando una captura del home de Recursos. **Habilitar un tema no es heredar su paleta.** Un
bloque `[data-theme="dark-legacy"]` al final, con la misma especificidad, gana por orden. Y los valores se
leen del shell (`kair-design-tokens.css`), no de una tabla escrita a mano, para que si la paleta del shell
cambia el test avise.

**El detalle fino:** el prefijo es lo que hace que las 47 reglas apliquen a las dos, así que el problema
no es el selector sino **los valores del bloque**. Un `^=` bien puesto sobre un bloque que solo declara una
paleta deja la mitad de la app teñida. Antes de dar por bueno un "ahora sí sigue el tema", mirá **los
dos temas**, no solo el que fallaba.

evita que una recarga espuria pierda el estado del submódulo. Hay check de que no desapareció, y otro de que
siga avisando cuando bloquea.

### El patron que sí funciona

Reusar la teardown que el proyecto ya tiene en vez de inventar una nueva: `_salirDeSubmodulo()` (del 843) es
la misma que usan el menú y el botón Volver, y te da de regalo el `try/finally` que impide que un
`destroy()` con error tranque la navegación. Para el contraste, leer los tokens del CSS y medir, no escribir
el ratio a mano. Y para el estado, un check que compruebe el **orden**: la teardown tiene que ir antes de que
se borre `contentArea`, no da igual.

## 📦895 · El archivo que parece eldueño del módulo puede no serlo

El Plan de Trabajo tiene dos implementaciones en el disco. `plan-viewer.js` (1 604 líneas) se lee primero
y parece el módulo: tiene `renderTree()`, `selectActivity()`, gestión de períodos y guardado a Excel.
Es **código muerto**. Espera `#treeContainer` y `#ganttRows`, que **no existen en ninguna parte del
repo**. La pantalla real la pinta el script inline de `plan-view.html`, un documento autocontenido con su
propio `ARBOL`, su `findAct()` y su `selectAct()`.

Lo peligroso no es que esté roto: es que **está bien escrito y ejecuta sin errores**. Sus funciones
empiezan con `var container = document.getElementById('treeContainer'); if (!container) return;`, así que
salen en la primera línea y no dejan ni un aviso en la consola.

**Trampa 10 · Antes de parchear un archivo de un módulo, confirmá que su DOM existe.** El mótodo es
una sola pregunta al grep: `grep -r 'id="treeContainer"'`. Si el ID que el JS busca no aparece en ningún
HTML del repo, el archivo está muerto. **No verifiques que el código exista: verifica que sea
alcanzable.** Es el mismo error de fondo del `__fileViewerBytes` del 892.

**Trampa 11 · Un techo se cumple por construcción, no con un clamp.** El owner pidió que el contenido no
subiera por encima de una línea. Un clamp sería un número que alguien puede aflojar; lo que de verdad
lo garantiza es la **ausencia del código que lo movería**. `scrollIntoView()` recorre TODOS los
ancestros scrolleables, incluido el documento, así que usarlo habría movido la página y escondido el
encabezado. La solución fue escribir únicamente `sc.scrollTop` del contenedor. El test cuenta las
escrituras de `scrollTop` de todo el archivo y exige que sean una.

**Trampa 12 · Un check que mira el texto se puede equivocar en las DOS direcciones.** El de "no uses
`scrollIntoView`" falló porque el propio **comentario** del código decía por qué no se usaba. El
sintoma es el mismo de la trampa 25 del 885 pero al revés: un comentario puede **hacer fallar** un check
en vez de satisfacerlo. Sanear comentarios antes de verificar, siempre.

**Trampa 13 · El orden importa cuando algo se reconstruye.** `selectAct` llama a `renderGantt()`, que
vacia el contenedor y manda el `scrollTop` a 0. Por eso el auto-scroll va **después**: al revés mide una
tabla vieja y el elemento que midió ya no existe. Hay check del orden y mutación que lo invierte.

**Trampa 14 · Si algo se construye condicionalmente, su ausencia es un caso normal, no un error.** Las
filas solo se crean de las carpetas abiertas, así que la actividad seleccionada puede no estar en el DOM.
Un `scrollIntoView` ingenuo no haría nada **y no avisaría**: el síntoma sería "a veces funciona".

### El patron que sí funciona

Un test con dos mitades: **mirar el código** para la forma, y **ejecutar la función real** extraía del
archivo con `vm` contra un DOM simulado para la aritmética. Así se comprueba que al bajar se llega
hasta `scrollHeight - clientHeight` y no a un número inventado. Y cuando el navegador se satura (el arnés
con iframe del 895 dió tres timeouts), eso es una respuesta válida: se cambia de método y se dice qué
queda sin verificar.

---

## Bug histórico: cierre de clase faltante

El primer script Python de Gestión de Amenazas (📦734) perdió el cierre de clase `}` porque `post_block = original_lines[740:]` saltaba la línea 740 (cierre). Síntoma: `SyntaxError: Unexpected token '.'` en `window.X = X;` (línea final). Fix: incluir el cierre como `class_closure = original_lines[739]` antes del `post_block`. Lección: SIEMPRE identificar la línea de cierre de clase explícitamente.

## Bug histórico: llamadas inválidas en `updateWidgetsUI`

El primer script Python de Gestión de Amenazas (📦734) eliminó `renderArchivosChart`/`renderTiposChart` como "código muerto" pero `updateWidgetsUI` los invocaba desde `refreshStats`. Síntoma: `TypeError: this.renderArchivosChart is not a function` + skeleton infinito. Fix: antes de eliminar cualquier método, hacer `grep -c "nombreMetodo"` para confirmar 0 referencias activas. Lección: aplicar el grep SIEMPRE como paso previo a la eliminación en scripts futuros.

## Bug histórico: scroll interno faltante (📦735)

El primer rediseño de Gestión de Amenazas (📦734) tenía `layout.style.height = '100%'` SIN la cadena flex. Sin `display: flex; flex-direction: column; min-height: 0`, el contenido se desbordaba sin scroll. Fix: usar `cssText` con todos los estilos de flex chain. Patrón ahora documentado arriba.

## Bug histórico pre-existente: clase CSS copiada

4 módulos usaban clase `.gestion-integral-home` (copia literal del CSS de Gestión Integral): Verificación (📦736), Mejoramiento (📦737), Gestión Amenazas (📦734), Gestión Integral (📦731). Renombrados a sus clases correctas (`.<módulo>-home`) en cada rediseño.
## Gotchas CSS del submódulo Investigación Accidentes (lección 2026-06-27)
Patrones que aprendí corrigiendo problemas visuales. Aplicar a cualquier vista similar:
> Los puntos 2 a 6 de esta lista eran reglas generales, no relato: viven ahora en `AGENTS.md § Reglas CSS generales`.

1. **`.inv-layout` está roto**: muchas reglas están scoped a `.inv-layout` (ej. `.inv-layout .hidden { display:none !important }`) pero el body NUNCA tiene esa clase → la regla no aplica. Solución: usar selectores globales o aplicar `class="inv-layout"` al body. En este módulo se unificó la regla `.hidden` a global.

2. **`.emo-scope #emo-root` no coincide NUNCA** (submódulo Evaluaciones Médicas, sep 2026): `render()` le pone la clase `emo-scope` a la PROPIA caja raíz (`id="emo-root"`), así que un selector `.emo-scope #emo-root` exige un ancestro con esa clase que no existe → la regla queda muerta y el `display:flex` nunca aplica. La prueba de humo `CSS: TODOS los selectores están bajo .emo-scope` exige que cada selector EMPIECE con `.emo-scope`, así que la forma correcta es `.emo-scope#emo-root` (misma especificidad, mismo nodo, cumple la prueba). Síntoma: el arreglo "funciona" en un lab donde el `<body>` tiene clase `emo-scope` (el body actúa de ancestro) pero NO en la app real. Lección: validar los labs SIN clases auxiliares que la app real no tiene, y medir con `getComputedStyle` en la cadena real de contenedores (`.submodule-content` → `#emo-root` → `.emo-kair-main`) en vez de confiar en capturas.

3. **Los 5 Porqués deben ser EXACTAMENTE 5 niveles — el modelo chiquito NO obedece el prompt** (sep 2026): Qwen3.5-0.8B llegó a generar 36 niveles a pesar de que el SYSTEM_PROMPT dice "EXACTAMENTE 5" y "Detente" (log `Portear/src/llm_server.log`, 14:59: `Post-procesamiento aplicado a 36 niveles`). El prompt NO es defensa suficiente; el tope vive en el código y hay que mantener TODAS las capas: (a) `llm_server.py` → `stop: ["6. ¿Por qué", ...]` en las options de analyze y regenerate; (b) `_strip_post_level5_content` corta el texto en el próximo encabezado `\d+. ¿Por qué` y toma el **máximo** `end` entre los patrones de categoría (si no, "Medio Ambiente", que va ANTES que "Material" en cada nivel, sobrescribe el fin de corte y se come la línea Material del nivel 5); (c) `parse_5_whys` / `parse_5_whys_alternative` descartan todo nivel fuera de 1-5;    (d) el render read-only de `investigacion-accidentes-main.js` filtra `n <= 5` + `.slice(0, 5)` (la variante editable ya acotaba `[1..5]`). Si quitas cualquiera de las 4, el bug vuelve. Regresiones: `tests/investigacion-accidentes/test-hf-llm-canales.js` (sección G) y `test-premium.js` (sección F). Ojo: `python-embed/` NO está en git, así que los tests del repo son solo de estructura — la verificación funcional del parser se corre aparte con `Portear\python-embed\python.exe`.

4. **La cuantización Q4_K_M destruye un fine-tune LoRA sobre un modelo de 0.8B** (sep 2026): el modelo entrenado con Unsloth (`Reivaj640/qwen3.5-0.8b-ia-v2` + `dataset_v4_final.jsonl` — respuestas progresivas, preguntas sustituidas con causas reales, sin razonamiento previo) funcionaba PERFECTO en Unsloth (fp16/bf16) y salía DEGENERADO en Ollama con el GGUF Q4_K_M: copiaba la plantilla literal ("¿Por qué [causa principal del nivel 1]?") y repetía las mismas 5 causas en los 5 niveles — con el prompt del entrenamiento EXACTO, con parámetros del entrenamiento (`temp 0.1, top_p 0.8, top_k 20, min_p 0, rep_pen 1.15, presence 0`), con el system prompt byte-exacto, con `TEMPLATE {{ .Prompt }}` o con la plantilla nativa, con modelo limpio sin params, e incluso con una FILA VERBATIM del dataset (y además inventaba contenido ajeno, ej. "desenergizar" en un caso de lavado de cuchillos). Con razonamiento activo el Q4_K_M entraba en bucle "Wait..." infinito en inglés sin escribir jamás la respuesta (124k chars). **La versión BF16/F16 (1.6 GB, tag `hf-qwen3.5-0.8b.f16-qwen3.5-0.8b-ia-v3.1` o Q8_0) resuelve todo**: el análisis sale encadenado (intento 1 → 66 → feedback → intento 2 → score 90, 0 repeticiones, ~26s). Regla: para modelos fine-tuneados pequeños exportar SIEMPRE GGUF en `f16`/`q8_0` (`model.save_pretrained_gguf("model_out", tokenizer, quantization_method="f16")`), nunca Q4_K_M. Test de regresión: si la salida repite la misma causa en 2+ niveles consecutivos, sospechar primero del GGUF, no del prompt.

5. **Cadena anti-repetición en `llm_server.py`** (misma época): el validador (`_validate_backward_chain`) detecta celdas que repiten textualmente nivel anterior (`_norm_cmp`, `repetition_cells`, gate 6+ → `valid=False`); si está estancado, `analyze_via_ollama` NO usa feedback retry (a 0.1 de temp el modelo lo ignora — probado: intento 2 salió con 19 repetidas tras feedback) sino **cadena iterativa** (`_analyze_iterative_chain`: multi-turn, el servidor sustituye la causa real en cada pregunta, anti-copia `_is_stagnant_vs` reintenta con temp 0.35, y el dedupe pasa a N/A cualquier categoría que repita el nivel anterior).    Regla de comparación: cuando hay estancamiento, **gana el candidato con MENOS `repetition_cells` aunque su score sea menor** (70 pts/20 repetidas single-shot vs 68 pts/10 repetidas iterativa → gana la iterativa; el overlap léxico premiaba lo idéntico). `_build_pregunta` extrae la pregunta real del modelo y, si copió el placeholder literal ("causa principal del nivel N"), la sintetiza con la causa real del nivel anterior. Regresiones en `test-hf-llm-canales.js` secciones H/I/J (142 checks).

6. **Prompts del 5 Porqués = byte-exactos al dataset de entrenamiento (`dataset_v5_final.jsonl`)**: (a) `INSTRUCCIONES_PROMPT` en `llm_server.py` es la plantilla v5 VERBATIM — metodología VERTICAL "ANÁLISIS VERTICAL POR CATEGORÍA" (cadena causal INDEPENDIENTE por columna M: cada celda explica la causa de la MISMA M del nivel anterior) con las reglas HERENCIA DE N/A, DETENCIÓN POR CAUSA RAÍZ y CERO CRUCES — NO re-envolver párrafos, NO agregar salto inicial invisible (un `\n` al abrir el `"""` ya es divergencia), NO quitar líneas en blanco. (b) Las secciones del accidente van en TEXTO PLANO (el v5 eliminó los asteriscos que tenía el v4): `build_user_prompt` arma `\n\nDescripción del accidente:\n…\n\nContexto Adicional:\n…\n\nAnálisis de 5 Porqués:`. (c) El parser acepta los encabezados encadenados del v5 (`2. ¿Por qué ocurrieron las causas del Nivel 1?`) y `_build_pregunta` los extrae para la UI; la función `_uniform_preguntas` (forzaba el header constante "¿Por qué ocurrió el accidente?" en los 5 niveles) **existió 1 día y se eliminó** — chocaba con el formato del dataset v5. (d) `config.json` → `llmSystemPrompt` se sincroniza manual con la constante, y el botón "Restaurar por Defecto" de Configuración › IA lleva el MISMO texto — si uno cambia, cambiar los tres. **Aviso de calidad visible**: el servidor devolvía `validation_warning`/score y el frontend lo ignoraba; ahora `investigacion-accidentes-main.js` pinta un banner ámbar `.inv-quality-warn` si `validation_warning` o `score < 70` (`view.css`, con dark en `[data-theme^="dark"]`; cache-bust `INV-20260925-calidad-banner`).

7. **Splash de bienvenida con confetti estilo Stripe** (v0.1.214, 📦815): el check verde Bootstrap hardcoded (`#28a745`) del `loading-success-icon` se reemplazó por SVG con gradiente (`<defs><linearGradient id="kairSuccessGrad">` verde→azul), halo pulsante (`<circle r="52">` con `success-halo` 2s ease-out infinite), check con stroke gradiente (4.5px round caps) y 6 cuadrados confetti (`rect 6×6`) rotando ±180° mientras vuelan ±42px en 3 colores premium v2 (`--kair-blue`, `--kair-green`, `--kair-amber`). ViewBox 52→120 para que respire. Tokens nuevos: `--kair-blue`, `--kair-green`, `--kair-amber` (reutilizados, antes no existían). **Aplicado a AMBOS** overlays (`#kair-loading-success.active` activo + `.kair-transition-success` legado CSS huérfano) por consistencia si el componente se reactiva. Si el user pide cambiar colores, **NO** hardcodear — exponer como tokens `--kair-X` en `:root` y consumirlos desde el `stroke`/`fill` del SVG y desde los keyframes CSS. Cache-bust `styles.css?v=20260926-confetti-success`. Patrón completo en `design_system.md §15`.

8. **URLs relativas en HTML inyectado vía `fetch + innerHTML` se resuelven desde el documento PADRE, no desde el archivo fetched** (v0.1.215, 📦816 — bug en refactor home de Capacitaciones): contraste directo con el patrón de Presupuesto que se carga en **iframe** (donde las URLs se resuelven desde el iframe). Cuando un componente hace `const html = await fetch('./modules/.../foo.html'); container.innerHTML = html`, todos los `<link>`, `<img>`, `<a href>` dentro del HTML inyectado resuelven sus paths relativas desde el BASE URI del documento padre (`index.html`), no desde el archivo fetched. **Síntoma**: la página sale sin estilos (los `<link>` no encuentran el CSS). **Fix**: usar paths relativas a `index.html` (`./shared/...`, `./modules/...`) y agregar `<link>` explícito al CSS del módulo (no se hereda del archivo fetched). Patrón de E2E sin display: `tests/cap-home-e2e.js` con jsdom lee los archivos del disco y los inyecta como `<style>` en un wrapper HTML, valida 18/18 DOM + 15/15 CSS + 9/9 tokens + 11/11 estilos + callbacks. Útil cuando no se puede ejecutar Electron con GUI.

---

## 📦898 · La cadena de alturas: un eslabón faltante hace desaparecer la barra de scroll

**Lo que pidió el owner.** Que la barra vertical del costado derecho de la ventana empiece al mismo
alto que la tarjeta "Actividad ID", que está a la derecha. Ese scroll era **el documento entero**, que
no tenía `overflow` declarado, así que su barra arrancaba en el borde superior del visor, muy por
encima del contenido.

**El patrón que lo resuelve** es el de app shell: cabecera y pestañas fijas, y un contenedor interno
que lleva el scroll.

```css
html{height:100%}
body{height:100%;overflow:hidden}
.kair-page{height:100%;min-height:0;display:flex;flex-direction:column}
.kair-topbar{flex:0 0 auto}
.kair-tabs{flex:0 0 auto}
.kair-plan-scroll{flex:1 1 auto;min-height:0;overflow:auto}
```

**EL ERROR, Y POR QUÉ EL SCROLL DESAPARECIÓ.**

La primera vez se puso `height:100%` en `html` y **no en `body`**. Con `body` de altura automática, el
`height:100%` de `.kair-page` no tiene base definitiva: el porcentaje cae a `auto`, la columna flex no
se acota, `.kair-plan-scroll` crece hasta la altura completa del contenido y por eso **nunca tiene
desbordamiento que scrollear**. Mientras tanto `body` ya tenía `overflow:hidden`, así que el recorte no
dejaba ver nada. Resultado: **la barra desaparece**. El owner lo reportó como *"quitaste por completo el
auto scroll"*. No era el auto-scroll: era la barra del documento.

**La regla.** Una cadena de alturas porcentuales no acota nada si le falta un eslabón. Si el padre
directo no tiene altura definida, el `height:100%` del hijo no vale nada. Acá la cadena eran cuatro:
`html` → `body` → `.kair-page` → `.kair-plan-scroll`, y faltaba `body`.

**El síntoma que delata el error, y el orden para diagnosticarlo.** Un contenedor con `overflow:auto`
que no muestra barra **no está roto: no tiene nada que scrollear**. Antes de culpar al `overflow`,
medí `scrollHeight` contra `clientHeight`. En un diseño de app shell, el primer sospechoso de un
scroll "que no existe" es que el contenedor **creció en vez de encogerse**, y casi siempre la causa es
un eslabón faltante en la cadena de alturas.

**El otro error del mismo turno: no preguntar cuál barra era.** El owner pidió cambiar "la barra del
autoscroll" y se hicieron dos intentos antes de entenderlo. El primero movió la barra vertical del
Gantt. El segundo desactivó el scroll del documento. Los dos estaban equivocados, y el segundo además
rompió lo que funcionaba. Cuando por fin se preguntó, con las tres barras de la captura nombradas por
posición, la respuesta fue la que menos se sospechaba: **la del costado derecho de la ventana**.

La lección no es "preguntá más". Es que **"la barra de scroll" es ambigua en cuanto hay más de un
contenedor scrolleable en pantalla**. Nombrarlas por posición —"la vertical del costado derecho de
toda la ventana", "la horizontal al pie de la tabla"— desambigua en un mensaje, y listar las
candidatas con lo que se ve de cada una evita dos ciclos de trabajo perdidos.

**Lo que sí quedó verificado.** En navegador real: la barra aparece en el borde derecho con la punta
superior justo debajo de las pestañas, y el pulgar ocupa menos de la mitad del carril, o sea que hay
contenido real para scrollear. Estructuralmente, los 92 pares de `div` quedan balanceados y el CSS con
las llaves en cero. Y el auto-scroll del 895 intacto: `scrollActIntoView()`, `SCROLL_MARGIN = 24` y
`.kair-gantt__scroll{max-height:560px}` sin tocar.

**Lo que no se pudo verificar.** La pestaña Cronograma dentro del contenedor nuevo: el navegador
embebido se colgó dos veces con timeout de 275 s, el mismo síntoma del 891 y del 895. Queda pendiente
la confirmación del owner en la app instalada.

**Pendiente de una decisión.** Quedan ~20 px entre el inicio de la barra y la tarjeta, por el
`margin-top:20px` que ya traían los bloques de contenido. Quitarlo alinea exacto pero cierra el
aire entre las pestañas y las tarjetas.

---

## 📦899 · 3.2.3: la tabla no aprovechaba la ventana maximizada

**Lo que pidió el owner.** Con la ventana maximizada, la tabla de "Registro y Análisis Estadístico"
seguía mostrando las mismas 15 filas: *"no aprovecha el modo maximizado, solo sigue mostrando las
mismas 15"*. En la captura se veía exactamente eso — 85 registros, "Mostrando 1–15 de 85", 6 páginas
y media pantalla en blanco debajo de la última fila.

**La causa** no era de estilos: el tamaño de página era **un número fijo en el estado de la tabla**
(`pageSize: 15` en `tState`) y nada lo volvía a mirar cuando cambiaba el tamaño de la ventana. El
resto del módulo (columnas, filtros, scroll horizontal) sí era fluido, por eso el defecto se veía
solo en la cantidad de filas.

**La decisión de detección** la tomó el owner, y es doble: hay maximizada si el ancho es **≥ 1360 px**
(el mismo umbral de "maximizada" que usan las media query del 3.3.1/3.3.2/3.3.3) **o** si el sistema
reporta la ventana maximizada (`window.electronAPI.isMaximized()`). Lo segundo hace falta porque en
un portátil de 1280 o 1366 maximizado el ancho no llega a 1360 y, con solo el umbral, seguiría en 15.
`isMaximized()` es una consulta con respuesta diferida, así que se dispara con un respiro de 150 ms
después del redimensionamiento (el ancho se aplica en el acto, el estado de la ventana después).

**El candado que hizo falta, y por qué.** El script del módulo **se re-ejecuta cada vez que se abre
la pantalla** (`renderer.js` agrega un `<script>` nuevo con el mismo `?v=`), y cada ejecución trae su
propio estado con su tamaño de página y su página activa. Como la escucha de redimensionamiento se
pegaba a `window` sin dar de baja la anterior, a la segunda apertura ya había dos: la vieja repintaba
la tabla con su estado obsoleto y pisaba el pintado nuevo. Se registró **una sola escucha por
módulo** (dar de baja la anterior al iniciar) y un identificador de sesión
(`window.__kairS323Sesion`) que retarda la respuesta del IPC: si la consulta vuelve después de
reabrir, la carga vieja no pinta. Sin ese candado el test lo muestra: el pie viejo
("Mostrando 16–30") aparece sobre la tabla nueva.

**Regla de diseño de este fix: nada de capas solapadas.** El primer intento puso el candado de sesión
en tres lugares a la vez. La mutación "quitar el candado de `aplicarPageSize`" quedó **verde**, o sea
que un check no mordía: los candados se cubrían mutuamente y quitar uno no se notaba. Se aplanó a dos
capas con responsabilidades distintas — **dedupe al registrar** (escucha vieja) y **candado al
responder el IPC** (promesa vieja) — y los dos quedan mordidos por un mutante.

**Al achicar la ventana la página se recorta**, no se queda sin filas: si estabas en la página 6 con
15 por página y pasás a 50, la página 6 no existe (77 registros → 2 páginas), así que va a la última
posible. Sin eso, la tabla queda vacía y el pie escribe "Mostrando 251–77 de 77".

**Verificación.** Test nuevo `tests/registro-estadistico/test-paginacion-maximizada.js` (**23/23**)
que **ejecuta el JS real** con un DOM mínimo y dispara el redimensionamiento: 1100 → 15 filas,
1904 → 50, vuelta a 1100 → 15, recorte de página, 1280 maximizada por el sistema → 50, apertura ya
maximizada sin resize → 50, reapertura sin escuchas apiladas y sin pintado cruzado, y con la tabla
fuera del documento no revienta. **6/6 mutantes matan al test**: tamaño fijo, sin escucha de resize,
sin consulta al sistema, sin recorte de página, sin candado de sesión y sin dedupe. Además
`test-premium.js` 24/24 y `test-chart-overflow.js` 20/20.

**Cache-bust**: token de `renderer.js` a `RES-20261015-v2-maximizada-50` (1 línea, CRLF intacto: el
archivo sigue con 8069 CRLF / 0 LF, verificado por bytes porque es el que más ruido provoca).

---

## ⚠️ Un gate que compara contra una clave que nadie escribe pregunta lo contrario a lo que debe (📦898, 2026-10-16)

**El síntoma.** El gate de consentimiento de la Ley 1581 decide mal en las dos direcciones, y
como los dos errores se cancelan, nadie lo reporta:

- **Editar el texto legal no re-pregunta nada.** Nadie se entera de que los documentos
  cambiaron. Se publicó en 2026 una versión que declara datos de salud enviados a WhatsApp, y
  **sin el gate arreglado ese texto nuevo no habría llegado a ningún usuario existente**.
- **Cada bump de versión de la app sí re-pregunta a todo el mundo**, aunque el texto legal sea
  idéntico al que el usuario ya aceptó.

**La causa raíz, en tres frases.** `consent:estado` comparaba contra
`cfg.consentDocumentVersion`, una clave de `config.json` que **nadie escribía**, así que el
`|| 'v1'` la dejaba siempre en `'v1'` y `document_version` siempre coincidía con eso. En paralelo
comparaba `app_version`, que cambia en cada release. O sea: **el criterio era el build en vez del
documento**, y el fallback era una constante inventada en vez de la versión real.

**Lo que lo escondía.** El renderer **ya enviaba** la versión del documento y un SHA-256 real del
texto que el usuario leyó (`renderer.js:4046-4048`), y el backend **ya lo guardaba** en cada
aceptación. `version_terminos`, `version_privacidad` y `texto_hash` aparecían en el CREATE
(`main.js:521-528`) y en el INSERT (`main.js:2814`), y **no los leía nadie**. La máquina estaba
construida y le faltaba un cable.

**La regla, y es la parte transferible:**

1. **Un valor con fallback literal es una mentira con default.** `cfg.X || 'v1'` no es "una
   versión por defecto": es un valor que nunca cambia. Si el fallback existe, el que lo lee tiene
   que poder escribirlo, o el default **es** la respuesta.
2. **El criterio de re-preguntar debe ser el documento, nunca el build.** Un release cambia todo
   el tiempo; el documento cambia cuando su texto cambia. Un criterio que se dispara por algo que
   no es lo que guarda la información se dispara siempre.
3. **Un campo que se escribe y no se lee es un `TODO` disfrazado de evidencia.** `texto_hash`
   "parecía" protección. No protegía nada porque nadie lo comparaba. Un mecanismo de registro que
   nadie consulta no es un mecanismo.
4. **Dos mecanismos que deciden lo mismo se pisan.** Se evaluó subir un número a mano *y* comparar
   el hash; hacer ambos es crear dos fuentes de verdad que divergen solas. Se hizo uno, y el otro
   quedó para cuando el número a mano sea un problema real.

**Cómo se cierra para que no vuelva.** Una sola constante, `CONSENT_DOCUMENT_VERSION` en
`main.js`, usada por los dos canales, **más un test que ata esa constante a las dos del renderer y
a la `Versión` que se imprime en `sitio/terminos.html` y `sitio/privacidad.html`**
(`main/test-consent-version-898.js`, 22 checks). Con eso, olvidar de subir el número deja la build
**roja en la máquina de quien edita**, y no llega como un reclamo. Ese es el punto: elegir que el
error se manifieste donde se puede corregir, y no donde no se puede.

**Regla de la casa, en una línea:** *cuando un documento legal cambia, subí el número Y corré el
test.* El número solo existe para eso; sin el test es un comentario que nadie lee.

## ⚠️ Publicar un documento legal sin grep del código es publicar una afirmación sin fuente

📦898, 2026-10-16. El owner preguntó, con buen tino, si todo lo que la app hace aparecía ya en
las páginas. La respuesta fue no, y la encontró **un grep, no una lectura**: dos rutas de salida
(`web.whatsapp.com` y el SMTP de `emailSender.js`) con datos personales y de salud, ausentes de
las tres tablas de subencargos y de las dos viñetas del modal.

El orden importa: **el grep se hizo ANTES de publicar**, no después de recibir un reclamo. Con las
páginas ya en línea, el mismo hallazgo era "el sitio público afirma una lista de terceros a la que
le falta uno" — y eso no se corrige, se legenda.

**Chequeo mínimo cuando el texto legal describe qué sale de la aplicación:** listar los dominios
externos que el código realmente contacta, excluyendo `vendor/`, `node_modules/`, `assets/` y los
`.min.`, y contrastarlos uno por uno contra la tabla de la página. Los que estén en los test files
y no en código que se distribuye **no cuentan** como destino — se declaran igual si el destino
existe en la app real.

## El CDN no era un detalle: 30 archivos vivos sacaban código de internet

2026-10-16, trabajo sin commitear al momento de escribir esto. Arrancó como "una etiqueta de más"
en un archivo de incapacidades y terminó siendo el hallazgo más grande de la jornada.

**Cómo se descubrió la escala.** El subagente legal señaló cuatro `<script>` de CDN en
`components/seguimiento/seguimiento-incapacidades.html`, que es el módulo que maneja CIE-10. El grep
de su nombre en todo el código **no lo encontró en ningún `.js`**: lo único que la app carga de
`components/` es `config-viewer.html` (`renderer.js:7414`). Ese archivo es **código muerto**. El
script `medicion-ausentismo.js:462` construye esa vista con `document.createElement`, sin iframe.

Buscar el CDN real abrió el tarro: **30 archivos vivos** sacando de `cdn.jsdelivr.net`,
`cdnjs.cloudflare.com` y `fonts.googleapis.com`, de los cuales **5 ejecutan JavaScript de
terceros**. El más importante es **`index.html`**, la ventana principal — la del modal de
consentimiento. Abría la app y bajaba `three.js r134`, `vanta 0.5.24`, `chart.js` **sin versión
fijada** y Bootstrap 5.3.0 desde internet.

**La migración ya estaba empezada y documentada.** `assets/` tenía `chart.umd.min.js` (v4.5.1),
`bootstrap-icons.css`, `font-awesome.min.css` y `google-fonts.css` con sus `.woff2`, y **28
archivos ya los usaban**. `AGENTS.md:892` dice que el CDN duplicado de Font Awesome "se quitó";
`AGENTS.md:773` marca `evaluaciones-medicas-view.html` como "deuda conocida". Los 30 archivos
eran los que se quedaron atrás de una migración a medias.

**Y ya había pasado antes.** `AGENTS.md:621` registra un incidente real: el modal de consentimiento
salía "pegado arriba a la izquierda y estirado a todo el alto", y la causa anotada fue
`index.html` cargando `bootstrap.min.css` desde el CDN. **La dependencia de CDN ya rompió la
pantalla legal una vez.** Eso no es una hipótesis de riesgo; es historia del repo.

**Lo que se hizo, en orden de riesgo:**

1. **Las tres URLs sin versión fijada se apuntaron a la copia local.** Antes de hacerlo se verificó
   qué versión estaba sirviendo el CDN sin fijar: **4.5.1, exactamente la misma que la copia local**.
   O sea que el cambio fue neutro en comportamiento y quitó el "hoy te sirve una versión y mañana
   otra".
2. **`chart.js`, `bootstrap-icons` y `font-awesome` se apuntaron a sus copias locales** en 31
   archivos (38 reemplazos). Cero descargas: todo ya estaba en el repo.
3. **Las tipografías se descargaron** — 22 `.woff2` (839 KB) de Roboto, Lexend, Inter, Manrope y
   DM Sans, y `google-fonts.css` se regeneró con 22 `@font-face` locales. **Segoe UI NO se bajó a
   propósito**: es fuente de sistema de Microsoft, no existe en Google Fonts, y Windows ya la trae.
4. **Dos iframes quedaron sin fuentes y hubo que repararlos** (ver más abajo).

**Lo que casi sale mal — tres errores, todos por no verificar lo suficiente:**

- **Se quitó `chart.js` de `gestacion-reportes.html` porque el HTML no tenía ni un `new Chart`.**
  No se miró qué scripts carga ese documento: carga `gestacion-reportes.js`, y ese sí dibuja
  gráficas (`new Chart` en las líneas 196, 250 y 308). **Las gráficas de ese módulo dejaron de
  dibujarse.** Se detectó por una búsqueda posterior y se corrigió apuntando a la copia local.
  *Regla: antes de borrar una etiqueta `<script>`, hay que leer los scripts que ese documento
  carga. Un HTML puede no usar la librería y sí usarla su `.js` hermano.*
- **El regex de repuntado se comió el sufijo de versión** y dejó rutas como
  `chart.umd.min.js@4.4.1/dist/chart.umd.min.js`. Solo se vio porque se escribió un verificador que
  comprueba que **cada** referencia a `assets/` resuelva a un archivo real en disco. Un path mal
  calculado no da error: rompe en silencio.
- **El script entró a `dist/win-unpacked/`** y modificó un artefacto de compilación. Está ignorado
  por git (no entró al commit), pero la build hay que **reconstruirla**. Falta excluir `dist/`
  además de `vendor/`, `node_modules/` y `renderer/file-viewer-assets/`.

**Regla de la casa:** *un `<script>` o un `<link>` a CDN es una dependencia de tiempo de ejecución,
no un detalle de estilo.* En una app que guarda datos sensibles de salud, el chequeo mínimo es
listar los `<script src="https://…">` **de los archivos que el código realmente carga** — no de
todos los que existen en el repo — y decidir por cada uno entre vendorizarlo o borrarlo.

## ⚠️ `test-alcance-tokens-889.js` solo lee UNA regla por archivo CSS

2026-10-16. Se descubrió al intentar quitar un `@import` de Google Fonts de
`shared/kair-design-tokens.css` (ver la entrada anterior). Ese cambio legítimo, que no toca ni un
token, puso el test en **31/37 con 0/21 mutaciones**. En HEAD da **37/37 y 21/21**.

**La causa no era el `@import`.** El parser es:

```js
const re = /(^|})\s*([^{}@]+?)\s*\{([^}]*)\}/g;
```

Cuando consume el `}` de cierre de un bloque, el siguiente `exec` necesita **otro** `}` antes del
próximo `{` — y el `{` se cruza primero. **El parser extrae como máximo una regla por archivo.**

El test pasaba por casualidad: el `@import` del principio bloqueaba el match del primer bloque (su
`@` no lo deja ser selector), así que el parser sacaba el **segundo** bloque, que era justamente el
oscuro `[data-theme="dark"]`. La respuesta correcta por el motivo equivocado.

Se intentó arreglar (quitar comentarios antes de parsear, desempate por posición dentro del
archivo). Con eso el parseo queda correcto y aparece el problema de verdad: `resolver()` ordena
ascendente y devuelve `candidatos[0]`, o sea **el primero**, mientras su propio comentario dice
"gana el archivo más tardío". **El código contradecía al comentario.**

**Se revirtió una vez, y fue la decisión correcta en su momento** — porque se intentó sin
entender la causa y el test se puso peor. Rehecha con la causa entendida, sí se pudo: el parser
se reemplazó por uno que **recorre las llaves con un contador de profundidad** (saltando
comentarios y saltando los bloques `@media` completos, que no compiten por `<html>`), y `resolver`
pasó a desempatar **descendente** —gana la última regla dentro del mismo archivo, como en un
navegador—, que es lo que su propio comentario ya decía pero el código no hacía.

**El arreglo destapó dos bugs más, y el orden mattered:**

- `resolver()` ordenaba ascendente y devolvía `candidatos[0]`, o sea **el primero**, mientras su
  comentario decía "gana el archivo más tardío". **El código contradecía al comentario**, y por eso
  un `:root` de cabecera ganaba a un `[data-theme="dark"]` declarado más abajo en el MISMO archivo.
- El parser nuevo, en su primera versión, dejaba el selector como `/* c */:root`: al saltar el
  comentario de cabecera no movía el arranque del selector.

**Y las comprobaciones nuevas no son decorativas.** Se agregaron tres checks al propio test
(37 → 40). Uno de ellos —*`declaraciones()` ve TODAS las reglas, no solo la primera*— **detecta al
parser viejo** (extrae 2 de 3 reglas, el test exige 3). Otro —*el texto de un comentario no se pega
al selector*— **se puso rojo solo y así destapó el segundo bug antes de que llegara a producción**.

Resultado: **40/40 checks base y 21/21 mutaciones**, y el `@import` de Google Fonts salió del
archivo. K+AIR ya no pide ninguna fuente a internet.

**Lo que sigue siendo cierto:** este test ahora simula la cascada mucho mejor, pero **seguir siendo
una simulación**. La herramienta que la confirma de verdad ya existe en el repo: `AGENTS.md:901`
describe `main/_audit-gh.js`, un arnés que **montó el shell en Electron real y midió** los tokens
con `getComputedStyle`. Para una respuesta definitiva sobre la cascada, ese es el camino.

**Regla de la casa:** *un test verde solo vale lo que vale su simulador.* Si un test se pone rojo
por un cambio que no toca lo que dice medir, **el primer sospechoso es el test, no el código** —
y antes de revertir, verificá cuánto del test es real: contá qué leería un parser roto.

---

## 🆕 "Sale todo en cero" no siempre es un bug: puede ser que nunca haya habido datos (2026-10-16)

El owner revisó Incidencia y Prevalencia después del trabajo de CDN y reportó: **"sale todo sin
datos"**. La primera hipótesis fue una regresión de Chart.js, porque las gráficas y las tablas
se fueron a cero al mismo tiempo. **Era falsa.**

**Lo que realmente pasaba.** Los dos módulos no leen de la base de datos: leen de un archivo
`Indicadores*.xlsx` que debe estar en
`<empresa>/3. Gestión de la Salud/3.3.x <submódulo>/`. Ese archivo **no existe**. Las carpetas
están **vacías: 0 elementos**, recursivamente, en las 4 empresas de Drive (Tempoactiva, Temposum,
Aseplus, Asel). Cootracom ni siquiera tiene la carpeta `3. Gestión de la Salud`.

**Lo que lo hace peligroso es que no falla.** `leerIndicadoresIncidencia()`
(`main/excel-bridge.js:890-906`) construye `emptyMonthly` — 12 meses en cero — y ante una ruta
inexistente devuelve **`success: true`**. El renderer no tiene forma de distinguir "no hay datos" de
"hay 0 casos". La pantalla entonces pinta una tabla completa, con su gráfica y su estado, que es
**idéntica** a una tabla real en cero. Peor: con `meta = 0`, `getStatusBadge()` devuelve **CUMPLE**
siempre (`incidencia-enfermedad-laboral.js:107-109`), o sea que muestra un sello verde de
cumplimiento sobre datos que no existen.

Y la otra mitad: **editar a mano tampoco funciona.** El número nuevo se ve un instante y después
sale "Ruta de INDICADORES no configurada" (`excel-bridge.js:981-985`), porque intenta escribir en
el archivo que no está.

**El contraste que lo explica.** Ausentismo (3.3.6) **sí** está conectado a la base de datos, con su
propio puente (`main/medprev-sve-datos-bridge.js`), y por eso calcula solo. Incidencia y Prevalencia
nunca recibieron esa migración: quedaron esperando un Excel que nadie creó. Ausentismo también
tiene archivos en Drive y los demás tienen carpetas vacías — la diferencia no es el disco, es si
el módulo fue migrado.

**Decisión del owner:** se deja como está y se anota. Hay que **crear las tablas en SQLite** y
conectar las dos secciones, como se hizo con Ausentismo.

### Tres reglas que salen de acá

1. **`success: true` con datos de relleno es peor que un error.** Un módulo que no tiene datos tiene
   que decirlo, no fabricar un objeto con la forma correcta. La señal de "vacío" necesita viajar
   explícita hasta la pantalla.
2. **Un estado verde sin fuente es una mentira.** `CUMPLE` cuando `meta = 0` no es un bug de
   estilo: es una regla de negocio que nunca debate qué significa "sin meta".
3. **Para diagnosticar "no hay datos", el código no alcanza — hay que mirar el disco.** Toda esta
   sección salió de recorrer las carpetas del Drive de las 4 empresas. El código decía `readdirSync`
   y el disco respondió 0. Un `git diff` sobre los dos HTML involvenidos mostraba solo una línea de
   CDN: la prueba de que no era una regresión del día.

## 📦903 — Reabrir el enlace de firma: el callejón sin salida, y el caché que lo fingió

**El defecto.** El enlace de firma es un **bearer token de un solo uso**: identifica al firmante y
no se puede reutilizar. El flujo estaba diseñado para el camino feliz —abrir, identificar, OTP,
firmar— y el camino de regreso se había dejado como un `catch` que decía "el enlace no es válido
o expiró". Para el caso **más común de todos**, que es el del trabajador que ya firmó y vuelve a
abrir el correo horas o días después, eso significaba tres cosas malas: una pantalla que dice
"no disponible" sin decir **por qué**, sin decir si su documento corría riesgo, y sin **a dónde ir**.
Cualquier estado que no fuera `SIGNED` caía al mismo texto: uno vencía, otro ya se había usado y
otro ni siquiera existía.

**Por qué la verificación siempre estuvo disponible.** `/api/sign/:token/verify` llama
`resolveToken` con `skipExpirationCheck: true` a propósito: la consulta es de solo lectura, así que
el endpoint responde igual después de `fecha_expiracion`. Ese endpoint ya existía y ya decía la
verdad (estado, hashes, firmantes, integridad recalculada). Lo que no existía era **el camino de
navegación** que lo llevara. El deep-link `?verificar=1` es eso: una URL compartible y reabrible
que salta la máquina de estados, en vez de una función interna a la que solo se llegaba desde una
pantalla que el usuario de un enlace en error nunca alcanzaba.

**La lección sobre el botón "Volver".** Volvía a `screen-signed` a ciegas. El flujo nuevo permite
llegar a la verificación desde la pantalla de error y desde el deep-link, y en ambos casos
"volver" iba a mostrar "✓ Documento firmado" sobre una solicitud que nadie había firmado. El
arreglo no fue condicionar el destino sino **reejecutar `init()`** y dejar que la máquina de estados
decida. Un destino fijo es una mentira en cuanto aparecen dos caminos de entrada.

**Lo que la prueba en producción destapó por debajo.** Con el enlace real ya firmado, el owner
siguió viendo el JSON crudo y preguntó si el arreglo había funcionado. No: el backend devolvía la
mini-app (comprobado con `curl` directo al origen) y el túnel tampoco intervenía (`HTTP=200
tipo=text/html` por `https://firma.kair.fyi`). Era **el caché del navegador**, guardando el `410`
anterior al despliegue. La causa era real y no un artefacto de la prueba: **la respuesta de error en
JSON no llevaba `Cache-Control`**, así que un `404`/`410` de `/s/<token>` quedaba en disco — con el
token adentro. La superficie del firmante responde ahora `no-store` en las dos ramas.

**La regla que sale de ahí, y que aplica más allá de la firma:** *antes de decir que un despliegue
no funcionó, probá la misma URL por dos caminos y en ventana privada.* Un caché del navegador
convierte un fix desplegado y correcto en "no sirvió", y el diagnóstico se va hacia el lado
equivocado — en este caso a rehacer el despliegue de algo que ya estaba bien.

### El `npm install` que borró 2.624 archivos versionados

Al intentar dejar correr la suite, `npm install` en `sgsst-electron-app` **borró 2.624 archivos y
modificó 15 más** dentro de `renderer/file-viewer-assets/`, además de tocar `package-lock.json`.
La causa es el `postinstall` de `@file-viewer/web` (`node ./scripts/copy-assets.mjs --postinstall`),
que reconstruye ese directorio desde el paquete instalado. npm 11.19.1 avisó de los install
scripts no cubiertos por `allowScripts` y aun así los dejó correr: **"up to date, audited 914
packages"** y, tres segundos después, dos mil archivos fuera del árbol de trabajo.

Todo se restauró con `git checkout` desde `HEAD`, que estaba limpio, más la carpeta nueva que el
postinstall dejó sin trackear. Dos cosas que quedan como regla: **antes de cualquier
`npm install` en este repo, `git status` tiene que estar limpio**, porque la restauración se hace
desde `HEAD` y cualquier trabajo sin commitear se pierde; y **`node_modules` de `sgsst-electron-app`
comparten con `firma-service`**, así que un `npm install` para un servicio toca los assets del otro.

### La suite que no corre: el binario nativo es de otra versión de Node

`better-sqlite3` estaba compilado para Node 22 (`NODE_MODULE_VERSION 136`) y el Node instalado es
v26 (`147`), así que **los 973 tests no arrancan**: fallan en `tests/setup.js` al aplicar las
migraciones, no al correr pruebas. No hay binario precompilado para Node 26, y la compilación con
`npm rebuild better-sqlite3` falla con `EPERM` al no poder reemplazar el `.node`, porque Electron y
otros procesos `node` lo tienen abierto. **La suite no puede correr con el Node que hay instalado**;
las dos salidas sanas son recompilar con los procesos cerrados o trabajar sobre Node 22 LTS.

Lo que sí se pudo verificar sin la base de datos: los 30 tests nuevos de esta jornada
(`tests/middleware/errors.test.js`, 20, y `tests/web/miniapp-reabierto.test.js`, 10 con 9
mutaciones). Los dos evitan `setup.js` a propósito — uno monta una app express mínima y el otro lee
el HTML y el JS — así que corren aunque la suite entera no pueda.

### Los dos 400 que casi cuestan una vuelta a producción

El despliegue a producción del 20 de octubre salió bien: 16 migraciones aplicadas, el
Acuerdo legal vigente con su huella sellada, la base íntegra. Pero la creación de la
solicitud de firma falló **dos veces seguidas** con un 400, y las dos veces la culpa
era del cliente de prueba, no del servicio.

El primer 400: `Idempotency-Key no soportado en legacy mode`. El script mandaba esa
cabecera y el servicio la rechaza cuando se autentica con la llave interna, porque la
idempotencia exige `req.id_empresa` y en modo legacy esa empresa es `null` por diseño.
El propio código lo explica con un 400 explícito, que es mejor que un 500 — pero
tampoco ayuda: la lección es que **la incompatibilidad estaba documentada en el
código y yo no la busqué antes de mandarla**.

El segundo 400: `Falta el campo "metadata" en el form-data`. El endpoint no recibe
campos sueltos en el multipart: recibe **un** campo `metadata` con un JSON string. Y
adentro de ese objeto, el `metadata` anidado también es un **string** (`z.string()`),
no un objeto. Cada uno de los dos errores era un 400 de una línea de diferencia.

Lo que los dos errores tienen en común es que **los dos habrían costado una vuelta a
producción** (descargar un script, subirlo, parar y arrancar el servicio) y lo que
también tienen en común es que **los dos se habían atrapado en un ensayo de un
minuto**.

El ensayo: levantar el servicio real en el puerto 3099 con la base de tests,
publicar el Acuerdo legal, registrar la Empresa con su Anexo, y correr el script
contra `http://127.0.0.1:3099`. Es el mismo código que corre en producción, contra el
mismo router y el mismo schema. El error sale exacto, en local, sin tocar nada. Y
además deja ver lo que de verdad importa: qué ve el firmante cuando abre el enlace
(`GET /api/sign/<token>/acuerdo.txt` → el texto legal, sus 32.907 caracteres, con la
etiqueta "Versión del Acuerdo: v1.0" que ahora coincide con la del sistema).

**La lección, en una línea**: un mock de la API te dice lo que vos creés que pedís; el
servidor real te dice lo que espera. Y un ensayo local no es un lujo de la QA: es lo
que evita que un 400 de contrato se descubra en el único entorno donde no se puede
arreglar a tiempo.

El patrón que quedó, y que conviene repetir: **toda comprobación que se pueda correr
contra el servicio real, se corre contra el servicio real**. Eso incluye el ensayo de
las migraciones sobre bases con evidencia, el ensayo del script de limpieza (con sus
tres candados verificados uno por uno) y este. Los tres encontraron cosas que ningún
test unitario habría visto.

### El despliegue que casi se hace sin llave

El owner pidió validar el repo y el Acuerdo para cambiar producción y hacer una prueba. SSH estaba
denegado, así que el trabajo se volvió **preparar el despliegue y entrenarlo sin el servidor** — y
ahí aparecieron tres cosas que, de no buscarlas, habrían sido un incidente y no un cambio de
versión.

**La primera: el servicio no habría arrancado.** `src/crypto/keys.js` exige `TOKEN_ENCRYPTION_KEY`
en producción, y esa variable es **nueva** del commit `ab78ca92` (📦906-911). El código que estaba
corriendo en el servidor —el anterior a ese commit— **no la usaba**: el token era un hash SHA-256
pelado y el OTP un hash con sal en la misma fila. La variable no existía en `/opt/kair-firma/.env`.
El despliegue, tal como estaba, habría dejado `firma.kair.fyi` sin responder, y el síntoma (el
dominio caído) no señalaba la causa: habría parecido un fallo de las migraciones o del binario.
La lección es de orden, no de fondo: **antes de desplegar, grep por las variables que el código
*nuevo* exige y compáralas con el `.env` del servidor**. Una variable nueva es un requisito de
arranque, y un requisito de arranque que no se cumple no se negocia en caliente.

**La segunda: el health no dice la verdad.** `src/routes/health.js` arma la versión con una
literal: `'compatible-' + (env === 'production' ? '0.1.189' : 'dev')`. El health respondía
`compatible-0.1.189` y seguiría respondiendo exactamente lo mismo **después** del despliegue.
Un health en verde no es evidencia de que el código nuevo esté corriendo: es evidencia de que el
proceso está vivo. La prueba de verdad salió de leer las rutas: `POST /api/solicitudes` (el canal de
datos del 1.3) **da 404 con el código viejo y 201 con el nuevo**. Una ruta que solo existe en la
versión nueva es un detector de despliegue mejor que cualquier campo de versión, porque no depende
de que alguien se acuerde de actualizarlo.

**La tercera: el choque de versiones del Acuerdo no se resuelve con un `DELETE`.** La versión del
Acuerdo **no es una etiqueta**: es la llave con la que el consentimiento apunta al texto que el
firmante leyó y aceptó. `createVersion` rechaza con `409 ACUERDO_VERSION_EXISTS` publicar encima
de una versión que ya existe, y por eso la legal no se puede poner encima de una v1.0 de pruebas.
Pero borrar la fila tampoco es la salida: los consentimientos ya aceptados guardan su propia huella
(`hash_texto_acuerdo`), así que si el texto que hay detrás de esa versión cambia, la copia que el
firmante puede descargar deja de ser la que aceptó. La salida sana es **publicar la legal con un
número nuevo** y dejar las dos versiones resolviéndose; la condición para decidir entre una cosa y
la otra es una sola consulta: ¿hay consentimientos aceptados bajo esa versión?

**Lo que sí se pudo hacer sin el servidor: ensayar las migraciones sobre bases con evidencia.**
No alcanza con leer las migraciones y ver que son `ALTER TABLE ADD COLUMN`. Se copiaron dos bases
reales —una con la v1.0 legal publicada y activa, otra con firmas, consentimientos y eventos— y se
les aplicó el tramo pendiente **en modo producción**, que es lo que hace que los triggers
append-only se creen (llevan la directiva `@skip-when-env test`, o sea que en la suite **nunca**
se prueban). Resultado: las filas no se movieron, el Acuerdo publicado quedó intacto con su huella,
`integrity_check` dio `ok`, y las filas viejas conservaron sus columnas de algoritmo en `NULL`
—que es exactamente lo que dicen las migraciones: se reescriben solas al primer uso. Un ensayo
así cuesta minutos y contesta la pregunta que un `git diff` de SQL no contesta.

**Y un bug de la propia casa, que salió de escribir un test.** El test que verificaba que la llave
interna no se imprimía capturaba la salida parcheando `process.stdout.write`. Resultado: en modo
`--test`, el runner reportaba **2 de 11 tests** — y todos pasaban. El parche global interceptaba
también lo que escribía el reporter del runner, así que el conteo de la suite mentía en silencio,
sin un solo test en rojo. La forma sana: que el script **inyecte** su sumidero de salida
(`main(argv, { sink })`) y el test lo capture por ahí. Un test que verifica algo sobre la salida de
otro módulo no puede tocar la consola global: el que verifica es el que mide, y si mide la salida
del runner, mide mal.

### El e2e que daba verde sin probar el correo

El script de humo de producciónCreation dio **OK con 12 comprobaciones** y el firmante nunca
recibió nada. No era el correo: era el script.

**El endpoint de creación no manda la invitación.** `POST /internal/sign-requests` crea la fila,
devuelve el token y la URL y ya. El primer contacto con el firmante es un endpoint aparte,
`POST /internal/sign-requests/:id/notify-remote`, que es el que llama a `mailer.sendInvite()`.
El script solo llamaba al primero, así que su e2e probaba la mitad del recorrido: creaba la
solicitud y declaraba haber hecho "el recorrido completo".

**El aviso mentía.** La línea decía "[AVISO] Se mando un correo real a adminkair@gmail.com", y
era el script imprimiendo su propio argumento. El servidor no había confirmado nada: no había
evento `INVITE_SENT`, no había `messageId`, no había correo. Un aviso que no sale del
servidor no es evidencia de nada.

**La búsqueda del culpable fue al lado equivocado.** Cuando el correo no llegó, el primer
sospechoso natural es el servidor de correo, y se montó una buena theory: "Gmail acepta con
`250 OK` y después descarta, porque una cuenta que envía desde una IP de servidor está
marcada". Se midió el SMTP, se probó un envío real, y **el correo de prueba llegó** a la
bandeja. El SMTP estaba bien. El bug era nuestro, y estaba en el lado del que no se sospechó:
el paso que el script no daba.

**El señuelo que sirve.** El `sendInvite()` lanza si el envío falla, y el service lo convierte
en `502 INVITE_EMAIL_FAILED`. Un `201` con la invitación no enviada solo es posible porque
**nadie llamó al endpoint que envía**. El `201` de la creación no dice nada sobre el correo,
igual que un `health` en verde no dice nada sobre el despliegue.

**El arreglo y su check.** El script ahora llama a `/notify-remote` después de crear, y reporta
lo que el servidor conteste: `OK` si salió, `AVISO` con el `502 INVITE_EMAIL_FAILED` si el
correo no salió (el servicio está bien, el correo no). Tres tests nuevos, y el primero
muerde: si se quita la llamada a la notificación, el test falla (se comprobó con una
mutación real, no de palabra). El principio es el de siempre: **un check que no muerde no es un
check** — y este llevaba dos días dando verde sin haber tocado el correo.

**Y había un segundo hueco en el mismo recorrido.** `identify()` exige que la fila tenga
`identificacion_tipo` y `identificacion_numero_hash`: sin ellos responde `500
MISSING_IDENTIFICATION_DATA` y el firmante no puede ni identificarse. El script tampoco los
mandaba. O sea, el e2e probaba tres de los cinco pasos del recorrido y no lo decía. El
cliente (K+AIR) manda el SHA-256 del número de documento, nunca el número en claro, y el
servicio lo convierte en un HMAC con su llave maestra; sin sal, el hash previo es
`sha256(numero)`, así que el firmante tiene que escribir exactamente el mismo número que
el script usó para calcular la huella. El script ahora lo calcula, lo manda, **te dice en la
salida qué número escribir**, y tiene dos tests que muerden (verificados con mutación
real). La lección es la misma de siempre y es la que más duele: un e2e que recorre la mitad
del camino y sale verde es peor que uno que no corre, porque **se cree que probó**.

### El enlace que el servicio no sabía resolver

El 21 de octubre, en producción, ningún enlace de firma resolvía. Todos los tokens devolvían
`404 TOKEN_NOT_FOUND` en las rutas de datos (`/api/sign/<token>/verify`, `/acuerdo.txt`,
`/medios`, `/identify`); el único 200 era el HTML estático de la mini-app, que es lo que hace
que el firmante vea una pantalla en vez de un error. El correo había salido, el alta había dado
201, el Acuerdo estaba publicado y sellado. Todo en verde menos lo único que importa: que el
firmante pueda abrir su enlace.

**El primer diagnostico ربط mal la causa, y no fue casual.** El `journalctl` showed que el
servicio contestaba `TOKEN_NOT_FOUND` y el hash archivado no coincidía con ninguno de los
candidatos del token. La conclusión "la llave cambió" era correcta en su forma pero inútil:
decía dónde mirar sin decir qué mirar. Hubo que construir un diagnóstico que separara cinco
causas distintas —llave distinta, esquema de hash distinto, proceso con el código anterior,
token mal transcrito y fila inexistente— y el que las separó fue comparar **el código que
corría** contra **el código que estaba en disco**.

**Lo que estaba en disco era el correcto.** Siete archivos de la capa cripto, byte a byte
idénticos al repo. Y el proceso había arrancado a las 02:22:43, después de la copia. Todo
cuadraba, y por eso la contradicción era real: el hash archivado no se reproducía con el
código desplegado, la llave vigente ni con ámbito global ni por empresa, por firma ni por
solicitud. La fila la había escrito el servicio treinta segundos antes.

**El `mtime` no era la prueba que yo creí que era.** Los archivos del servidor tenían fecha
del 19 y del 20 de octubre, anteriores al arranque del servicio, y yo leí eso como "el proceso
cargó estos archivos". Falso: `tar` conserva las fechas originales, así que un archivo copiado
a las 02:25 conserva la de hace semanas. **Un `mtime` nunca prueba qué código tiene un proceso
en memoria.** La prueba es el `uptime_seconds` del `/health` (tiene que ser chico después de
un reinicio) y el hash del archivo que quedó corriendo.

**El token que copiamos estaba mal.** Al leer el token de la salida
del script (de una foto de terminal, no de un pegado de texto) se coló una diferencia de un
carácter: `O` por `0`. El `journalctl` conservaba la ruta exacta que había llegado al
servidor, y al compararla se vio la diferencia. Un `404 TOKEN_NOT_FOUND` dice exactamente lo
mismo en los cinco casos, así que no ayuda: hay que leer el token del log, no del recuerdo.

**Lo que arregló el servicio fue reiniciarlo, y eso es lo que duele.** Con el proceso nuevo
(código del disco, llave del `.env`, sin caches viejas), el token nuevo resolvió al primer
intento: `200` con la fila completa. El proceso anterior escribía con el esquema de token
viejo —el `app.bak` del despliegue todavía guardaba `token_hash = SHA-256(token)` sin HMAC— y
el lector del código nuevo no reconocía esas filas. **El despliegue había dejado el disco
nuevo y el proceso viejo**, y la única forma de saberlo es comparar el código que corre con
el que está escrito.

**El arreglo de fondo son dos checks que muerden.** El primero: el script de humo ahora abre
el enlace que él mismo crea y exige que resuelva (paso 5c). Sin ese paso, una corrida da
`RESULTADO: OK` con el servicio entero roto, y eso fue exactamente lo que pasó durante horas.
El segundo: el runbook del despliegue ahora obliga a verificar el proceso que quedó
corriendo, no el archivo del disco. Y el script de purga ganó un modo `--solo-firmas`,
porque el candado que protege el texto legal —que hizo bien su trabajo— dejaba al sistema sin
forma de limpiar sus propias filas de prueba una vez que el legal ya estaba publicado. La
solución no fue aflojar el candado, fue **separar las dos cosas**: borrar las filas de prueba
sin tocar ninguna versión del Acuerdo.

**La moraleja es la de siempre, pero con un nombre nuevo: el hueco no estaba en el código que
se probaba, estaba en el código que comprobaba.** Un e2e que recorre la mitad del camino y
sale verde es peor que uno que no corre, porque se cree que probó. Y un despliegue se prueba
con el hash de lo que quedó corriendo, no con el del archivo que se copió.

---

## 📦933 · El bloqueo que bloqueaba, la excepción que deja rastro y la mutación que muerde por el motivo equivocado

*23-oct-2026 · la respuesta 11A del abogado · retención de 20 años · token único · D-03*

### El abogado no estaba equivocado en la ley; estaba equivocado en el código

El pedido fue: «que el bloqueo de la habilitación de la Empresa se aplique en los cuatro
puntos y que la excepción sea un flag auditable, no un if silencioso». Lo segundo se hizo
tal cual. Lo primero tenía una sorpresa: el abogado escribió que hoy el sistema «avisa»,
y **eso era inexacto**. Con el default, el bloqueo ya lanzaba `409 EMPRESA_NO_HABILITADA`
—pero **solo en la creación de la solicitud**. El commit, la creación del consentimiento y
la doble firma no comprobaban nada.

La moraleja: una instrucción que describe el código hay que **contrastarla con el código**
antes de tocarlo, no después. Si se hubiera implementado «lo que el abogado dijo que
había», se habría escrito un aviso nuevo donde ya había un bloqueo, y el sistema habría
quedado bloqueando en un punto y avisando en los otros tres.

### El «if silencioso» tenía dos caras

El `FIRMA_EXIGIR_HABILITACION_EMPRESA=false` era la puerta de atrás: apagaba el bloqueo y
dejaba un `WARN`. No era silencioso, pero era **inrastreable**: nadie sabe quién lo apagó
ni a quién dejó firmar sin Anexo de Encargo.

La salida que quedó no es una bandera, es una **excepción con expediente**: autorización
escrita (quién, fecha y referencia del documento), alcance de una Empresa y un número
máximo de firmas, ruta en papel operativa el mismo día, fecha cierta con máximo 30 días, y
una bitácora **append-only por triggers** (migración 036) donde cada uso queda con usuario,
fecha, motivo, Empresa y número de firmas. Y una regla que no es del abogado y sí del
sistema: una Empresa **sin ningún Anexo** solo entra como **piloto autorizado**, con
quien lo autoriza.

**El límite tenía que contar firmas, no puntos de verificación.** La primera versión gastaba
una unidad de alcance cada vez que se levantaba el bloqueo, y una firma atraviesa tres
puntos: creación, consentimiento y commit. Con un alcance de 3 se autorizaba **una** firma,
no tres. La corrección fue distinguir el punto que **abre** una firma (gasta) del punto que
la **verifica** (solo consulta). Es el mismo tipo de error del `PUT` de la ficha de la
Empresa: un límite que dice una cosa y cuenta otra es un límite que no significa nada.

### La mutación que muerde por el motivo equivocado

La lección más cara del día no fue del dominio: fue del arnés de pruebas. Al renombrar
`MAX_TOKENS_ACTIVOS` a `MAX_TOKENS_VIGENTES`, quedó la referencia vieja en el
`module.exports`. El `ReferenceError` no apareció en un test: apareció al **cargar el
módulo**, y como treinta archivos de test lo importan, **treinta archivos fallaron a la vez**
con un error que no tenía nada que ver con el cambio.

Lo peligroso es lo que pasó después: el script de mutaciones.reportó **14 de 14
detectadas**. Y era mentira para las que tocaban ese módulo: con el `ReferenceError` presente,
los tests fallaban **con la mutación puesta y sin ella**, así que cualquier mutación parecía
detectada. El contador estaba contando mientras el check no había bosteado.

La regla que sale de ahí es una sola y no es nueva, pero se vio con nombre: **antes de
creer un «14/14 de mutaciones detectadas», hay que verificar que el código carga y que la
suite está verde**. Si una mutación sobrevive, el check no muerde. Si detecta de golpe, hay
que sospechar que está fallando por otro lado. Y el fix es de una línea:
`node -e "require('./src/services/signRequest')"`.

### Dos respuestas del abogado, y gana la que se puede probar de dónde salió

En el repo aparecieron dos documentos con el mismo nombre y fechas distintas: el `.txt` de
41 128 bytes, copiado byte a byte del asset que el owner pegó, y un `.md` de 71 367 bytes
creado a las 3:33 AM que **no aparecía en ningún snapshot de sesión, ni en `assets/`, ni en
los logs del runtime**. Se contradecían en lo decisivo: uno decía «80 años por defecto,
efecto en el código: ninguno» y el otro «Recomiendo bajarlo a 20 años… cambia una
constante: ANIOS_CUSTODIA de 80 a 20».

El `.md` era **más grande y más reciente**: por tamaño y por hora, ganaba. Pero **no se
puede probar de dónde salió**, y eso lo descalifica. El criterio que se aplicó es el
general: *¿se puede probar el origen?* Un documento sin origen no compite —se señala como
contradictorio y no se usa como fuente—. Y la regla de por qué importa: cuando dos
fuentes se contradicen, la tentación no es promediarlas ni elegir la más reciente, es
**preguntar de dónde salió cada una**.

### Lo que quedó escrito y lo que no

El texto final del abogado trae **28 huecos** que solo el owner puede llenar (NIT y
representante, ciudad y país del servidor, los DPAs de Cloudflare y Google, el tipo de
cuenta de Google, el responsable de respaldos/monitoreo/soporte con su RTO/RPO, la persona o
área y el canal del 10.7(b), la URL de la política de datos). **La v1.1 no se publica con
huecos**: el abogado dice que sin ella no hay primera firma. Así que el mapa de empalme
quedó escrito (los 49 numerales que cambian, con el texto final citado íntegro y la lista
de lo que falta) y la publicación quedó para cuando los datos existan.

El orden del abogado se respeta: cerrar 9A, 10.4 y D-03 → ajustar el 8.6 en el código →
publicar la v1.1 → encender el D-02 → firmar el Anexo de Nube → primera firma real. **Los
tres primeros ya están.**



## 📦934-935 · La purga en dos capas y el fallo que no hacia ruido

*23-oct-2026 · el texto legal en el codigo · el recibo de supresion · la purga que no se ejecutaba*

### La operacion que se declaraba completa y no hacia la segunda mitad

El `scripts/purga-ventana.js` es el ejecutor de la supresion de datos vencidos. Su guion, textual:

> "Capa 1: el registro de auditoria."
> "Capa 2: la fila y los archivos. Se hace dentro de la misma ventana y sobre el mismo lote, y vuelve a
> comprobar el hold de cada firma."

La segunda linea era una **intencion**, no un hecho. La capa 1 (`conservacion.purgar()`) **cerraba la
ventana de purga y vaciaba el lote** al terminar, y la capa 2 (`supresion.suprimir()`) exige ventana
vigente y lote armado. El resultado era que la segunda capa moria con "No hay ventana de purga abierta" y
el script salia con codigo 3.

Lo que la segunda capa borra es **el documento, la constancia y los archivos**, y lo que escribe es **la
lapida** (`gh_firma_purgadas`) con la que un enlace ya suprimido responde 410 CONSERVACION_VENCIDA. Es
decir: **la capa 2 nunca se ejecuto en produccion**. Las firmas vencidas habrian seguido con su PDF
original, su PDF firmado y su constancia en el disco, y la tabla de lapidas estaba vacia.

Lo unico que impedia que esto fuera un desastre era que en produccion hay **0 firmas**. El
incumplimiento del 8.6 y del 10.6 de la v1.0 **vigente** era real; el daño, todavia no.

La trampa de fondo no es el bug: es que **el guion describia el comportamiento deseado, y nadie lo
comparo con el comportamiento real**. El codigo de la capa 1 era el que decidia cuando se cerraba la
ventana, y el codigo de la capa 2 asumia lo contrario. Dos piezas que se contradician en silencio, cada
una con su test en verde.

### La regla que sale: la ventana la cierra el orquestador

El arreglo no fue "quitar el cierre" (eso habria dejado la ventana abierta para siempre, que es peor):
fue **sacar la decision del cierre de la capa y ponerla en el que orchestra**. La capa 1 acepta
`{ cerrar: false }` —el default sigue siendo cerrar, porque su unico llamador fuera del script es el
test que mira la secuencia del log— y el script cierra **despues** de las dos capas. Y si algo falla, la
ventana se cierra igual en el `catch`: una ventana abierta con un lote a medias habilitaria una purga
que el operador no pidio.

### La simulacion que decia "0 firmas, 0 archivos" y un segundo despues suprimia una y tres

El mismo script, en la parte de arriba, decia "Simulacion de la capa de datos: 0 firmas, 0 archivos" y
despues reportaba "filas suprimidas: 1, archivos eliminados: 3". La simulacion leia el **lote**, y el
lote existe solo cuando ya se abrio la ventana: antes de abrirla estaba vacio. Se probo sobre las mismas
firmas que el lote va a contener (las vencidas y elegibles), sin que la ventana tenga que estar abierta.

La leccion es mas general que el script: **una simulación que no dice lo que va a pasar es peor que no
tenerla**, porque hace creer que no hay nada que hacer. Y una simulacion que se calcula sobre un estado
posterior al que se va a comparar no simula nada.

### El fallo silencioso que casi se va: un `undefined` ligado como NULL no lanza

Al revisar el codigo del recibo de supresion aparecio un `SELECT` que no traia la columna `firma_id` y
la usaba despues como parametro de bind. La primera caracterizacion fue "reventaba la consulta".
**Era falsa**: `better-sqlite3` liga un `undefined` como `NULL` y no lanza. El `WHERE firma_id =
NULL` no encontraba la fila del recibo de purgas y el recibo salia **sin la ventana de purga, sin la
comprobacion del hold y sin el recuento de eventos**: un fallo silencioso, con un objeto que parecia
completo.

Lo que lo destapo fue la mutacion: **quitar esa columna del `SELECT` no ponia ningun test en rojo**.
No porque el test fuera flojo, sino porque **no comprobaba los tres campos que esa mutacion degrada**.
El arreglo no fue solo agregar la columna al `SELECT`: fue **agregar al test las aserciones de esos tres
campos**. Un check que no muerde no es un check, y la forma de saber si muerde es mutar el codigo y
mirar.

Y la regla sobre el diagnostico: **un diagnostico equivocado escrito en un comentario es la forma mas
larga de propagar el error**. La caracterizacion correcta ("no lanza; degrada en silencio") quedo escrita
en el codigo y en el test, porque la primera version habia quedado en un comentario que explicaba un
crash que no existia.

### El 3.6(g) exige cuatro cosas y la evidencia guardaba dos

El 3.6(g) pide que la lapida identifique **la solicitud, la fecha y hora, las categorias suprimidas y el
fundamento del plazo**, y que haya **un recibo que la Empresa entrega al Trabajador si lo solicita**. La
lapida guardaba el `firma_id` (un entero interno) y el `id_empresa`, y como la supresion borra la fila
de la firma entera, el identificador que el Trabajador y la Empresa conocen se perdia **para siempre**.

Lo que faltaba no era solo guardar la columna: era **la via de entrega**. Nadie podia obtener el recibo
para darselo al Trabajador: el 3.6(g) se cumplia a medias. Por eso los endpoints son **per-empresa** (la
Empresa es la Responsable del dato y la que se lo entrega al Titular, 10.7(e)), con `404` silencioso
entre Empresas y sin datos personales en la respuesta.

Y una decision que se tomo a proposito: la purga del registro de auditoria (el 10.5(d)) **no** escribe
en `gh_firma_purgadas`. Esa tabla no es solo el archivo de la evidencia: es **el mecanismo del 410**, y
`supresion.buscarLapidada()` busca por `token_tombstone`. Meter ahi filas que no son lapidas de tokens
podia hacer que un enlace que SIGUE VIVO respondiera "no disponible por vencimiento del plazo". La
salida fue darle al recibo de purgas las dos columnas que faltaban (la 041) y armar el recibo con la
fuente que las tenga. Mezclar el archivo de la evidencia con el mecanismo del 410 es la clase de error
que despues nadie sabe explicar.

### Lo que el texto no tocaba y el codigo si

La v1.0 **vigente** no contradecía el codigo nuevo: su 8.6 no fija plazo y su 3.4(c) si dice "token de un
solo uso". Lo que si estaba incumplido era el **3.4(e)**: "expira a los seiscientos (600) segundos
contados desde su envio". Por eso la expiracion del OTP se implemento aunque la v1.1 no este publicada:
**una brecha contra el texto vigente se cierra igual**, y no es lo mismo que una mejora.

Y el rechazo es `410 OTP_EXPIRADO` con codigo propio, **no** el 410 generico: el generico diria "el
enlace expiro", y el enlace sigue vivo. El codigo explicito le dice a la mini-app que lo que vencio es
el codigo, y le deja ofrecer el reenvio. Un 410 generico para un caso que no es un 410 es una mentira
en la respuesta.



## 📦939 · La falla que no era del despliegue y el hold que no se podía limpiar

*23-oct-2026 · el smoke que miraba el token viejo · el forzado del hold · las filas hijas que quedaban*

### El 5c fallaba por el motivo equivocado

El humo de producción dio 14 comprobaciones, 1 falla y 3 avisos. La falla era el 5c: "El token de la
prueba NO resuelve :: HTTP 404 TOKEN_NOT_FOUND". La primera lectura fue "el despliegue rompió el
token". Era falsa. El guion del smoke era este:

1. `POST /internal/sign-requests` → 201, devuelve el token A.
2. `POST /internal/sign-requests/:id/notify-remote` **sin** `token` → el servicio emite el token B y,
   por el 3.4(c) ("cada reemisión se registra y deja sin efecto el token anterior"), **el token A
   muere**.
3. El 5c abre **el token A** → 404 TOKEN_NOT_FOUND.

El correo que sí salió llevaba el token B, y el token B servía. O sea: el check no comprobaba "el
enlace que recibe el firmante": comprobaba un enlace que **el propio script había invalidado dos
pasos antes**. La válvula ya existía y funcionaba: `notify-remote` acepta `token` en el body,
verifica que sea de esa solicitud (`tokenPerteneceA`) y lo reutiliza **sin rotar**. El humo no la
usaba. El arreglo estuvo en el script, no en el servicio: el token de la creación se calcula ANTES de
notificar y se manda en el body, así que la invitación sale con el mismo enlace que el check abre.

La regla: **antes de declarar "fallo del despliegue", comprobar que la cosa que el check mira siga
siendo la cosa que el servicio produjo**. Un check que falla porque la operación invalidó su propio
insumo es un check con el sujeto equivocado.

### El rastro de prueba que no se podía limpiar

El e2e dejó una fila en producción (id=12, SIGN-2026-427494, PENDING, 1 PDF) y
`limpiar-rastro-prueba.js --solo-firmas` se negó a borrarla: "1 firma(s) tienen deber legal de
conservación (hold)".

El hold venía de la **regla de retención, no de la ficha de la Empresa**. La ficha del servidor tiene
`conservacion_por_deber_legal = 0` (verificado el 24-oct-2026 con `panel-firmas.js --json`): no
levanta ningún hold. El hold lo trajo la **regla `CONTRATO_ELECTRONICO`**, la del 2.2.1.1.12 — el
contrato electrónico se conserva **sin término** — y el smoke cae en ella porque crea la solicitud
con `tipo_identificacion: 'OTROSI'`, que el catálogo resuelve a la categoría `CONTRATO_TRABAJO`.
O sea: el hold era el **más fuerte** de todos, no una bandera de la Empresa.

Eso no cambia la limpieza: `--forzar-hold` abre solo para filas que nunca tuvieron un acto y con el
hold automático (motivo `deber_legal_*`, actor `sistema`), y esa fila cumplía las dos. Pero el
recibo dice ahora la verdad de por qué se forzó, y no dice una cosa que no era.

`--forzar-hold` es la válvula, y solo se abre para filas que cumplen **dos** condiciones:

1. **Que nunca haya habido un acto.** La fila no puede estar en SIGNED / DUAL_FIRMADO / REJECTED /
   REVOKED / CANCELLED, ni tener documento firmado, hash de evidencia, constancia o PDF firmado.
2. **Que el hold sea el automático.** El motivo tiene que ser `deber_legal_*`, el actor `sistema`, y
   no puede haber un hold vigente en `gh_firma_holds` declarado por una persona.

Si una sola fila del rango falla alguna de las dos, **no se borra nada** (código 4): no hay limpieza
a medias. Una firma que sí ocurrió conserva su hold para siempre.

Y el forzamiento queda escrito en el recibo append-only (`gh_firma_purga_log` y
`gh_firma_purga_registro`), con quién lo hizo y por qué. El hold no se "libera" antes de borrar: la
fila desaparece dentro de la misma transacción que la borra, así que en ningún momento queda una firma
real sin su protección.

### Las filas hijas que quedaban

El script borraba tokens, eventos, sesiones y lotes, pero **no** `gh_firma_holds`: el historial de
los declares de conservación cuelga de la firma por `firma_id`. Al borrar la firma, el hold quedaba
en la base apuntando a una fila que ya no existía. Eso no es limpiar el rastro: es cambiar de rastro.

Las tablas que cuelgan de una fila hay que **enumerarlas del esquema**, no de la memoria: son
`gh_firma_eventos`, `gh_firma_sesiones`, `gh_firma_purga_lote`, `gh_firma_tokens`, `gh_firma_holds`,
`gh_firma_firmas_papel` y `gh_firma_purgadas` (esta última es la lápida: append-only, no se borra).

### Y un aserto que no mordía

El test que comprueba "los tokens también están borrados" usaba `firma.id`. El helper devuelve
`{signRequest, token, url_publica}`: `firma.id` era `undefined`, `better-sqlite3` lo ligaba como
`NULL`, el conteo salía 0 y el test pasaba **sin comprobar nada**. Ahora usa `firma.signRequest.id`. Un
test que pasa porque su bind es NULL no es un test: es la misma trampa del `undefined`, vestida de
test.



## 📦940 · La guarda que se comió al seed y la salida que no abre la puerta de par en par

*23-oct-2026 · la guarda de texto legal · el seed DEV · la salida con condición verificable*

### El choque

Del otro lado del repo, sin commitear, apareció una guarda de publicación: desde la v1.1, un texto
con corchetes o con marcas de borrador ("ACUERDO DEV", "PENDIENTE DE COMPLETAR") **no se publica**.
La guarda vive en el servicio (`agreement.js` → `textoLegal.js`) y es correcta: un texto legal a
medio llenar no se publica ni se firma.

El seed de desarrollo rompe contra ella, y no por casualidad: `scripts/seed-dev-acuerdo.js` siembra,
por definición, un texto que lleva la marca "ACUERDO DEV — NO LEGAL" a propósito, para que nadie lo
confunda con el texto legal. Las cuatro pruebas del seed que publican bajo una versión posterior a la
v1.0 quedaron rojas, y el `AppError` además se escapaba de `main()`: el script moría con una
excepción en vez de devolver un código de salida.

Las dos cosas son correctas. La guarda protege el camino legal; el seed siembra, por definición, un
texto que no es legal. El problema no era la guarda: era que **faltaba el punto de encuentro**.

### La salida: angosta, en el seed, y con condición verificable

La salida NO está en relajar la guarda, y tampoco en tocar los archivos del otro trabajo (que no se
tocan). Está en el seed, que escribe la fila él mismo —mismo hash, misma transición atómica de la
activa— cuando se cumplen **las dos** condiciones:

1. El ambiente no es producción (el bloque duro de arriba ya lo impide).
2. **TODA versión que hay en la base es una semilla DEV.**

La segunda es la que importa, y no es una suposición: se comprueba contra las filas. Si esa base
tiene un Acuerdo legal publicado —la v1.0 real y sellada del servidor—, la condición no se cumple y
**no hay salida**: el seed dice por qué y sale con código 1. O sea: si hay texto legal en la base, el
seed no puede dejar un texto marcado. El seed tampoco puede abrir la puerta a una base vacía por
accidente: una base vacía no es una base con texto legal, y ahí lo que se siembra es el fixture de
desarrollo, que es lo que la base espera.

La fila sembrada por el seed queda marcada con `metadata.dev_seed = true`. Esa marca es lo que
permite después distinguir "esto lo sembró el seed" de "esto es un Acuerdo real", y es la que hace
que la condición sea comprobable y no una promesa.

### Lo que NO se relajó

El camino legal sigue igual de duro: `agreementService.createVersion()` con un texto marcado y una
versión posterior a la v1.0 **sigue tirando** `TEXTO_LEGAL_CON_PLACEHOLDERS`, y hay un test que lo
comprueba. El bypass vive solo en el script de desarrollo, y solo se abre si la base es de
desarrollo.

### La red

Seis pruebas nuevas. Las dos que importan son las que cierran la puerta: una siembra una v1.0 legal
en la base y verifica que el seed se niegue (código 1) y que no quede ninguna fila nueva, y la otra
mete una semilla DEV **y** un Acuerdo legal para verificar que una sola versión legal en la base
cierra la salida. Un check que solo se puede abrir y no se puede cerrar no es un check: es una puerta
que no tiene marco.



## 📦941 · El reporte que dice qué falta, sin inventar nada

*23-oct-2026 · los bloqueantes de la respuesta 11A · la guarda de texto legal · el manifiesto de evidencias*

### El problema que se veía y el que no

Hasta ahora, la pregunta "¿el sistema ya puede publicar la v1.1 y aceptar la primera firma real?"
vivía únicamente en la cabeza del operador. Y no por descuido: la respuesta estaba repartida en
archivos sueltos —el texto de la v1.1, el Anexo de Nube, el Anexo de Encargo, la ficha de las
empresas, el inventario de retención, la configuración— y en datos que solo tiene el owner (NIT,
canal de datos, responsable, URL de la política). Reunirlos era trabajo de cada vez, y el error
fácil era uno: **rellenar el hueco con un valor plausible**.

Ese es el error que este trabajo se propone no cometer. `legal-readiness.json` es un inventario de
**evidencias**, y todas sus claves de datos están en `null`: cada campo se llena solo con una fecha,
un archivo o una huella. Un `null` no es un olvido: es un pendiente con nombre. Y
`src/services/readinessLegal.js` recorre ese manifiesto, los documentos reales del repo, el código
y la base, y devuelve **38 items**: 4 ok, 31 pendientes, 1 aviso, 2 que no aplican, con **19
bloqueantes** para el gate de publicación y la acción concreta que resolvería cada uno.

El reporte no publica, no firma, no enciende el D-02 y **no escribe en la base**: es una
fotografía. Se puede pedir por HTTP (`GET /internal/admin/readiness-legal`, con la key de operador)
o por consola (`node scripts/auditar-readiness-legal.js --gate=publicacion --json`), y **los dos
paths llaman al mismo servicio**: una lista de requisitos duplicada en dos archivos se
desactualiza sola, y un reporte que dice "está listo" cuando dejó de estarlo es peor que no
tener reporte.

### La guarda: un texto legal a medio llenar no se publica

En el otro extremo, `src/utils/textoLegal.js` mira un texto y dice si tiene corchetes o marcas de
borrador ("ACUERDO DEV", "PENDIENTE DE COMPLETAR", "Revisión profesional pendiente", "por
diligenciar"). La v1.0 queda fuera: está publicada y sellada, y sus fixtures de desarrollo la usan
tal cual. Desde la v1.1, `agreementService.createVersion()` **rechaza** el texto con
`TEXTO_LEGAL_CON_PLACEHOLDERS` antes de tocar la base, y `publicar-acuerdo-legal.js` hace la misma
comprobación antes de enviar nada. El texto que se publica no puede salir a medio llenar, y el
código que lo publica dice por qué no.

### Lo que el reporte dice hoy

Con lo que hay en el repo ahora, el gate de publicación **NO está listo**, y el reporte lo dice sin
suavizar: falta el texto de la v1.1 (y por tanto su huella en el manifiesto), la URL del Anexo de
Encargo, la URL de la política de tratamiento, la persona y el canal de protección de datos, el
responsable y su acta, y el NIT del Encargado. El Anexo de Nube tiene 53 placeholders y una marca
prohibida; el Anexo de Encargo, una. Faltan las pruebas en el ambiente real de la 9A, la 10.4 y el
D-03, y las tablas de excepciones (migraciones 035 y 036) no están en esta base.

Eso no es un dato pessimisticista: es la lista de trabajo, escrita con lo que falta y con quién
falta.



## 📦944 · La v1.1 deja de estar bloqueada: los campos del sistema y el sello de versión

*24-oct-2026 · la guarda de texto legal · los campos que registra el sistema · el empalme de la v1.1*

### Lo que el empalme contaba y lo que la guarda bloqueaba

El empalme de la v1.1 reportaba nueve corchetes: **cinco huecos** (los del abogado, en el 1.5,
el 10.1 y el 10.7(b)) y **cuatro más**. Los cuatro ya venían en la v1.0 y están en el bloque de
Manifestación de Voluntad:

```
Fecha y hora de aceptación: [registrada por el sistema]
Versión del Acuerdo aceptada: [registrada por el sistema]
Huella digital del texto: [registrada por el sistema]
Firma del Trabajador: [registrada por el sistema]
```

La guarda de publicación (`src/utils/textoLegal.js`) contaba **los nueve** y rechazaba el texto:
`analizarTextoLegal` devolvía `ok: false` con cuatro huecos que nadie podía llenar. O sea: la
v1.1 no se podía publicar ni con los cinco datos listos, y el bloqueo no venía de un dato
faltante sino de una regla que no entendía la diferencia entre "falta esto" y "esto lo pone el
sistema".

### Lo que dice el código, medido

Antes de tocar nada se comprobó qué pasa con esos cuatro campos en runtime:

- **El sistema no los sustituye en el texto que ve el trabajador.** Las únicas apariciones de
  `[registrada por el sistema]` en todo el `firma-service` son el fixture y el test;
  `web/firma/app.js:650` pinta `acuerdo.texto` tal cual (`box.textContent = acuerdo.texto;`).
- **Los valores sí existen, pero en otro lado**: la base de datos y la constancia PDF
  (`src/services/pdfGen.js:696-704`: "Versión del acuerdo", "Aceptado el", "Hash del acuerdo").
- **La v1.0 ya está publicada, sellada y viva en producción con esos cuatro dentro** (la guarda no
  le aplica a la v1.0). El trabajador que acepte el Acuerdo hoy ve ese texto.
- **El Anexo de Nube —el documento que sí se firma— no usa esa fórmula**: sus 53 corchetes son
  huecos, y después del cambio siguen siendo 53 huecos (`huecos.total: 53`, `sistema.total: 0`).

### La salida: el texto legal manda, el código se ajusta

El texto legal es el que manda. La v1.0 sellada ya usa esa fórmula, así que la regla del código
era más estricta que el texto. `src/utils/textoLegal.js` ahora conoce **un** campo del sistema,
`[registrada por el sistema]`, y lo clasifica aparte: no es un hueco, no bloquea, **pero se
lista**. El conteo quedó partido en dos en todos los consumidores:

| | qué es | bloquea |
|---|---|---|
| `huecos` | lo que alguien tiene que llenar | sí |
| `sistema` | lo que registra el sistema al firmar | no |

Y la excepción es de **contenido exacto**: `[registrada por la empresa]` o `[registrada por el
sistema más adelante]` siguen siendo huecos y bloquean. Hay tests para esas variantes, porque
una excepción de guarda sin la prueba de que sigue bloqueando es un agujero, no una excepción.

### La trampa que apareció por el camino

El empalme (`scripts/empalmar-acuerdo-v1.1.js`) **tenía su propia copia del patrón** de
placeholders. Si se hubiera arreglado solo el módulo compartido, el script habría salido con
código 0 —el texto ya sin huecos— mientras su reporte seguía diciendo "9 placeholders": un check
que no muerde y un reporte mintiendo. La copia se borró: el empalme ahora **importa** la regla
(`buscarPlaceholders`, `esPlaceholderDelSistema`) y su control de consistencia compara las dos
cuentas, las de todas las ocurrencias y las de los huecos.

El reporte nuevo dice las dos cosas, sin fundirlas:

```
PLACEHOLDERS DEL TEXTO RESULTANTE (9 ocurrencias: 5 huecos por llenar y 4 campos del sistema)

Huecos que hay que llenar (traen el texto final de la v1.1):
  - [URL]  ->  numeral 1.5 (linea 35)
  ...

Campos que registra el sistema (ya venían en la v1.0; no son huecos y NO bloquean):
  - [registrada por el sistema]  ->  MANIFESTACIÓN DE VOLUNTAD (linea 498)
  ...
```

### El segundo bloqueo: el texto seguía diciendo «v1.0»

Con los cinco huecos llenos, la v1.1 **todavía no se publicaba**. El motivo era otro, y no
era un dato que nadie tuviera: el texto que armaba el empalme seguía nombrando la versión
equivocada, en **dos** lugares:

```
L4    Versión del Acuerdo: v1.0
L620  …mecanismo de firma electrónica de K+AIR, versión v1.0, que se me ha presentado en
```

El primero es la cláusula que el propio readiness exige (`readinessLegal.analizarAcuerdo`
busca `Versión del Acuerdo: v1.1`) → el texto salía con `faltan: [{id: "version"}]` y
`ok: false`. El segundo es el bloque de Manifestación de Voluntad, donde el trabajador
declara qué versión acepta.

O sea: **el check existía desde el 📦941 y mordía**; lo que faltaba era correr la cadena
completa (empalme → guarda → readiness) y no las partes por separado. Con los cinco datos
puestos y el texto todavía en «v1.0», la primera firma real seguía bloqueada.

### La salida: el sello de versión

El Acuerdo nombra su versión en dos lugares y los dos tienen que decir la misma. El sello
**no va en el mapa de cambios** (ese mapa es el texto del abogado, copiado íntegro del
`.txt` de la respuesta 11A): es una **propiedad de la versión**, y lo aplica el script
tomándola del campo `version` del propio JSON.

Las reglas son estrictas a propósito:

| Regla | Por qué |
|---|---|
| Tiene que haber **exactamente una** mención en el encabezado | si hay dos, no se sabe cuál es la buena; si no hay ninguna, el texto no dice su versión |
| Tiene que haber **exactamente una** mención en la Manifestación | ídem, y es la que el trabajador lee |
| Las dos tienen que **decir lo mismo** | un texto que se contradice a sí mismo no se puede sellar |
| El JSON tiene que **declarar** la versión | sin eso no se sabe qué hay que sellar |
| Después de sellar se **vuelve a verificar** | un sello mal escrito es un texto que miente |

La última regla se pagó sola: durante la implementación, el sello producía `vv1.1` (la "v"
estaba dos veces) y el propio check lo cazó. Un sello que no se verifica es un sello que
miente.

Resultado: con los cinco huecos llenos, el empalme escribe el archivo (código 0), la guarda
lo deja pasar y **el readiness dice `ok: true`, `faltan: []`**. Es la primera vez que el
texto de la v1.1 queda armable y publicable.

### Los cinco datos del owner: en un archivo aparte

Los cinco corchetes que dejó el texto del abogado los llena el owner, no el abogado. La
primera tentación era rellenarlos en el mapa de cambios, pero ese mapa tiene una garantía
escrita y probada: **cada texto aparece LITERAL en el `.txt` de la respuesta 11A**
(`tests/scripts/empalmar-acuerdo-v1.1.test.js`). Rellenarlos ahí la habría roto, y el mapa
quedaría con texto que el abogado nunca escribió.

Así que los datos van en su propio archivo —`scripts/fixtures/acuerdo-v1.1-datos.json`— y el
empalme los sustituye con las mismas reglas estrictas del sello: cada placeholder tiene que
aparecer **exactamente una vez**, el valor no puede traer corchetes (sería otro placeholder) y
al terminar no puede quedar ningún hueco. Si algo falla, el script se niega (código 3) y no
escribe nada.

| Placeholder | Valor (owner, 24-oct-2026) |
|---|---|
| `[URL]` (1.5) | `https://kair.fyi/anexo-encargo.html` |
| `[ciudad, país]` (10.1) | `Barranquilla, Colombia` |
| `[interno, a cargo de … / provisto por …]` (10.1) | `a cargo de Gesstiar S.A.S., de forma interna, sin proveedor externo` |
| `[correo o URL]` (10.7(b)) | `privacidad.kair@gmail.com` |
| `[nombre o cargo]` (10.7(b)) | `Cargo Representante Legal de Gesstiar` |

### El canal, en un solo lugar

El canal de protección de datos estaba en tres sitios distintos: el `.env` del servidor
(`privacidad@k-air.com`), el default de `config.js` (`privacidad.kair@gmail.com`) y el
manifiesto (`null`). El readiness comparaba el configurado contra el documentado y por eso
decía *"El canal configurado y el documentado no coinciden"*. Ahora los cinco sitios dicen lo
mismo: `.env` (local y servidor), `config.js`, `.env.example`, manifiesto y el texto del
10.7(b).

### El texto armado no se commitea antes de la aprobación

`scripts/fixtures/acuerdo-v1.1.txt` es la versión que se firma. Salió del empalme (38 969
bytes, SHA-256 `a88e41af…0b7bc5`) y está en `.gitignore`: sale de ahí solo cuando el abogado
lo apruebe, y ese momento queda visible en el diff. Mientras tanto `publicado` sigue en
`false` en el manifiesto y `v1_1_fecha` en `null`.

### Lo que quedó verificado

- Con los cinco datos del owner, el empalme **escribe** el archivo (código 0), la guarda lo deja
  pasar y el readiness del texto dice `ok: true`, `faltan: []`. Sin los datos, sale con código 2
  y no escribe nada.
- El sello tiene sus propias pruebas de negativa: sin versión en el texto, con el encabezado y
  la Manifestación en desacuerdo, sin `version` en el JSON, y con la versión del JSON distinta
  de la que se está armando → el script se niega (código 3) en los cuatro casos.
- La sustitución de los datos también: placeholder que no aparece, placeholder que aparece
  cuatro veces, valor con corchetes, y huecos que quedan sin llenar → el script se niega en los
  cuatro casos.
- `node --check` en los cinco archivos tocados; suite completa **1705 tests · 1703 pass · 0 fail ·
  2 skipped** (28 tests nuevos: 11 del módulo compartido, 3 de la guarda, 14 del empalme).
- El readiness del gate de publicación pasó de **4 ok / 31 pendientes / 19 bloqueantes** a
  **9 ok / 26 pendientes / 13 bloqueantes** (`texto_v1_1`, `hash_v1_1` y `canal_datos`}.
- La v1.0 sellada no se tocó: su huella sigue siendo `52a490a4…10c04`.

### Lo que entra en este mismo commit

Este paquete se commitéa **junto con el 📦945** (`src/utils/textoLegal.js` y
`src/services/readinessLegal.js` quedan tocados por los dos en las mismas líneas; separarlos
por hunks sería frágil). Además del texto de la v1.1 y la guarda, este commit trae:

- **El NIT de Gesstiar S.A.S. (`900987987`)** en el manifiesto (`encargado.nit`) y en los seis
  documentos (`legal/` y `sitio/`): política, términos y Anexo de Encargo. Con eso el
  aviso "por diligenciar" quedó en **cero** y el ítem `nit_encargado` del readiness pasó a
  `ok`. El NIT va **tal como lo dió el owner** (nueve dígitos base, sin dígito de
  verificación): no se completa con datos que nadie confirmó.
- **Los cinco datos del owner** en `scripts/fixtures/acuerdo-v1.1-datos.json`. El texto armado
  (38 969 bytes, sha256 `a88e41af…b7bc5`) **no entra al repo**: `.gitignore` deja
  `scripts/fixtures/acuerdo-v1.1.txt` fuera hasta que el abogado apruebe la v1.1.
- El **fix del readiness** (§945): los checks de cláusulas leían el HTML crudo y no veían
  las cláusulas del Anexo de Nube porque están escritas con entidades HTML.
## 📦945 · El readiness leía el HTML crudo y no veía las cláusulas del Anexo de Nube

> **Este paquete se commitéa con el 📦944**, no aparte: los dos tocan
> `src/utils/textoLegal.js` y `src/services/readinessLegal.js` en las mismas líneas y
> separarlos por hunks sería frágil. La número de paquete se conserva para la
> bitácora.

### El bug

`analizarAnexoNube` y `analizarAnexoEncargo` corrían sus checks de cláusulas sobre el
**archivo HTML crudo**. Los dos anexos están escritos con entidades (`d&iacute;as
h&aacute;biles`, `Auditor&iacute;a`, `supresi&oacute;n`, `Devoluci&oacute;n`, `20
a&ntilde;os`), y los patrones de las cláusulas buscan el texto con la letra:

```js
{ id: 'dos_dias', re: /dos\s*\(2\)\s*d[ií]as\s*h[aá]biles/i }
```

`"dos (2) d&iacute;as h&aacute;biles"` **no matchea**. El resultado medido: el Anexo de
Nube reportaba **6 cláusulas faltantes**, y **cuatro de ellas el documento sí las tiene**.
El check no estaba mirando el documento legal: estaba mirando el marcado.

### La corrección

El texto que firma el Titular es el **renderizado**, no el HTML. Ahora hay un
`_textoRenderizado()` que quita las etiquetas y resuelve las entidades (las que el repo
usa de verdad y las numéricas), y las cláusulas, los corchetes y los marcadores se leen
sobre ese texto. **El hash sigue siendo el del archivo, byte a byte**: la huella
identifica el documento, no su forma de marcado.

Medido sobre el Anexo de Nube real:

| | antes | después |
|---|---|---|
| cláusulas faltantes | 6 | **0** |
| `clausulasOk` | false | **true** |
| huecos | 53 | 53 (no se perdió ninguno) |
| hash | `f50ed32c…19628` | `f50ed32c…19628` (igual) |

Las cuatro cláusulas que aparecían como faltantes —los veinte (20) años, los dos (2)
días hábiles, la devolución, la supresión y la auditoría— **estaban en el documento**.

### El segundo bug: un documento que dice "no firmar" podía estar `ok: true`

El aviso "NO FIRMAR HASTA COMPLETAR LOS DATOS" estaba en la lista de cláusulas
**requeridas** del Anexo de Nube, y ninguna marca del analizador legal lo reconocía. Las
dos cosas juntas producían una contradicción:

- con el aviso y sin huecos, el documento quedaba `ok: true` → **se podía publicar un
  documento que dice "no firmar"** (un check que no muerde en la dirección peligrosa);
- como el aviso era un requisito, **un documento final nunca podía quedar `ok`** → el
  ítem `documento_nube` bloqueaba la primera firma **para siempre**, porque el archivo
  del repo es el modelo y siempre tiene huecos.

Ahora el aviso es un **marcador** (`NO_FIRMAR`, en `src/utils/textoLegal.js`) y la
cláusula `banner` deja de ser un requisito permanente. La regla queda coherente en los
dos sentidos:

- **con datos pendientes, el documento tiene que advertirlo** (el aviso de no firmar o
  cualquier marca de borrador): si no, alguien lo diligencia a mano y se lleva un
  documento con huecos sin advertencia → el check reporta `aviso_sin_datos`;
- **sin datos pendientes, no puede llevar el aviso**: no se firma un documento que dice
  "no firmar" → el marcador lo bloquea.

El patrón vive **una sola vez**, en el módulo legal: el readiness lo pide con
`reDeMarcador('NO_FIRMAR')`, no con una copia del regex (la trampa 74).

### Verificación

- **12 tests nuevos**: 10 en `tests/readiness-documentos-html.test.js` (las entidades no
  esconden la cláusula; el texto plano y el HTML dan el MISMO resultado; el check muerde
  cuando la cláusula falta; la frase del aviso es una sola fuente; la regla del aviso en
  los dos sentidos; un documento que dice "no firmar" no se publica; el hash sigue siendo
  del archivo; los corchetes no se pierden) y 2 en `tests/readiness-legal.test.js`.
- Suite completa: **1717 tests · 1715 pass · 0 fail · 2 skipped**.
- `node --check` en los tres archivos; barrido de caracteres no latina limpio; EOL LF
  puro sin BOM en los cuatro.

### Lo que este paquete NO decide

El ítem `documento_nube` sigue en `pendiente`, y con razón: el modelo tiene 53 huecos.
Pero uno de ellos es una decisión de fondo que **no es del código**: si el archivo del
repo es el **modelo** (con los huecos por Empresa) o el **documento final** (diligenciado).
Hoy nadie diligencia el Anexo de Nube — el servicio nunca lo lee — y los tres huecos
por-Empresa (`[EMPRESA]`, su NIT y su representante) no tienen dueño. Eso es el punto 7,
y lo tiene que decidir el owner con el abogado.

## 📦946 · El NIT de Gesstiar S.A.S. y el dominio kair.fyi en los documentos publicados

*24-oct-2026 · la rama `gh-pages` · el CNAME · el NIT en los seis documentos*

Este es el commit de la **rama `gh-pages`** (la del sitio publicado), no de `Dev`. En `Dev` el
NIT entra dentro del 📦944; aquí es donde el documento **publicado** cambia.

### Los dos cambios

- **El `CNAME`** (9 bytes: `kair.fyi`): es lo que le faltaba a GitHub Pages para verificar el
  dominio. Sin el `CNAME` commiteado en la rama publicada, la página servía en
  `reignaj640.github.io` y `kair.fyi` nunca tendría certificado.
- **El NIT de Gesstiar S.A.S.** en los tres documentos del sitio (`anexo-encargo.html`,
  `privacidad.html`, `terminos.html`): `NIT 900987987` y `Datos de contacto:
  privacidad.kair@gmail.com`. En el sitio publicado ya no queda ningún "por diligenciar".

### El estado medido (no supuesto)

- `kair.fyi` resuelve a `185.199.108-111.153` (las cuatro IP de GitHub Pages): **DNS listo**.
- `http://kair.fyi/` responde **200**.
- `https://kair.fyi/` daba **error de certificado**: GitHub Pages aún no había verificado
  el dominio. La verificación se dispara con el `CNAME` commiteado; el certificado sale en
  minutos, no en días.
- El registro `firma.kair.fyi` (túnel `kair-firma`) **no se toca**: es otro nombre y otro
  destino.

### Lo que sigue sin dueño

En el manifiesto siguen en `null`, y por eso el `partes_encargado` y el banner del Anexo de
Nube no pueden quedar listos: `encargado.representante_legal`, `encargado.acta_designacion`,
`encargado.url_politica` y `encargado.url_anexo_encargo`. Ninguno se rellena con un ejemplo.

## 📦947 · El check pedía una migración que ya estaba aplicada

*24-oct-2026 · el readiness en el servidor · el nombre de la tabla de solicitudes del Titular*

### Lo que dijo el servidor

El despliegue del 24-oct-2026 (el commit `f26f8bc1`) terminó bien: los tres hashes en
disco coincidieron con los del commit, el servicio arrancó y el journal mostró
`"No hay migraciones pendientes","total":40`. Pero el readiness del servidor sacaba
**doce bloqueantes**, y entre ellos estaba uno que no podía ser cierto:

```
[pqrs] Tabla de solicitudes del Titular
    Falta la tabla de solicitudes del Titular.
    -> Aplicar las migraciones 028/029.
```

El journal de ese mismo arranque decía, línea por línea, que **028 y 029 ya estaban
aplicadas**. El reporte pedía aplicar unas migraciones que no había que aplicar: el
check no podía pasar nunca, y bloqueaba los dos gates.

### La causa, contrastada con el SQL

La migración 028 crea `gh_solicitudes_titular` — **sin el prefijo `firma_`**, a
propósito: esa tabla no cuelga de ninguna firma, y por eso la 5B (la supresión) no
la alcanza. El check buscaba `gh_firma_solicitudes_titular`, un nombre que **no
aparece en ninguna migración**. Los otros cuatro nombres del bloque
(`gh_firma_medios_trabajador`, `gh_firma_firmas_papel`,
`gh_firma_excepciones_habilitacion`, `gh_firma_excepciones_habilitacion_eventos`) sí
coincidían con sus migraciones (032 y 035); el quinto no.

La prueba no es la lectura del código: el test nuevo aplica el **SQL real** de la
migración 028 en una base en memoria y exige que el check vea la tabla. Con el
nombre viejo el test falla y `tabla_solicitudes` queda en los pendientes; con el
nombre correcto pasa.

### La segunda corrección: la acción que mandaba a hacer algo inútil

El ítem `hash_v1_1` ("Huella del texto registrada en el manifiesto") decía, cuando
faltaba el archivo de la v1.1:

> Calcular el SHA-256 del texto aprobado y registrarlo en legal-readiness.json.

La huella **ya estaba** en el manifiesto (`a88e41af…b7bc5`): lo que faltaba era el
archivo aprobado, que no entra al servidor hasta que el abogado apruebe el texto.
La acción mandaba al operador a registrar algo ya registrado.

Ahora la acción dice lo que falta, y el detalle sigue diciendo la verdad. Lo mismo
con la tabla: la acción pasó de "Aplicar las migraciones 028/029" a "Aplicar la
migración 028, que crea la tabla gh_solicitudes_titular".

### Verificación

- **2 tests nuevos** en `tests/readiness-legal.test.js`: uno aplica el SQL de la 028 y
  exige que el check vea la tabla; el otro exige que la acción no mande a registrar
  una huella que ya está puesta.
- **Mutación comprobada**: con el nombre viejo el primer test falla
  (`tabla_solicitudes` en los pendientes). Un test que no falla cuando se rompe el
  código no está probando nada.
- Suite completa: **1719 tests · 1717 pass · 0 fail · 2 skipped**.
- `node --check` en los dos archivos; barrido de caracteres no latina limpio; EOL LF
  puro sin BOM.

### Lo que este paquete NO hace

No publica la v1.1 ni los documentos finales: eso sigue esperando la aprobación del
abogado y las URLs (`encargado.url_politica`, `encargado.url_anexo_encargo`). Y el
Anexo de Nube sigue con sus 53 huecos: eso es el punto 7, y no es del código.

## 📦️948 · El Anexo de Encargo del servicio en la nube y las URLs del punto 3

*24-oct-2026 · el punto 3 cerrado · el Anexo de Encargo nuevo (reemplazo) · la politica del Encargado*

### Lo que habia

El punto 3 era "URLs del Anexo y de la política". La parte (a) —el DNS, el `CNAME` y el certificado—
ya estaba hecha y verificada. Faltaban (b) publicar los documentos y (c) declarar las URLs en el
manifiesto, y (c) no se puede hacer antes que (b): sellar una URL que todavía no sirve el
documento hace que el Acuerdo apunte a algo que no existe.

Al medir (b) apareció la sorpresa: **el Anexo de Encargo del repo era el de la app de
escritorio** (base de datos local en los equipos del cliente, control de acceso por cuenta de
Windows, Google Calendar, jsDelivr) y el Anexo de Nube no estaba en `sitio/`. Los dos
documentos describían un producto que ya no es el que se firma.

### Los tres documentos

- **El Anexo de Encargo nuevo** (`legal/anexo-encargo.html`, y su copia en `sitio/`): describe
  el `firma-service` —servicio en la nube— con las medidas que el código tiene de verdad (huella
  con sal, un solo token vigente por solicitud, OTP a los 600 segundos, bitácora de auditoría que
  no se altera, 48 horas de incidentes, dos días hábiles de traslado de PQRS, veinte años de
  custodia). Trae las cinco cláusulas que el checker exige y que el documento viejo no tenía: la
  remisión al Anexo de Nube, la **sustitución** (no un otrosí: la decisión del 24-oct fue
  (b) reemplazo), el art. 2.2.4.6.13, los veinte años y el servicio en la nube.
- **El Anexo de Nube**, copiado a `sitio/` y por fin en el menu del sitio. Sigue siendo el modelo
  v1.0 con sus 53 huecos y su aviso: diligenciarlo es el punto 7.
- **La política de tratamiento del Encargado** (`politica-firma.html`, nueva): la del **servicio
  de firma**, no la de la app. La que estaba publicada (`privacidad.html`) habla de conectar la
  cuenta de Google y de los tokens en el equipo: es de otro producto.

### El nudo que casi se pasa por alto

El `url_politica` del manifiesto se iba a llenar con `https://kair.fyi/privacidad.html`, que era
la decisión que estaba escrita. Al leer esa página resultó que es la política de la **app de
escritorio**: describe la conexión con Google, los tokens guardados en el equipo del usuario y
la revocación de esos tokens. Sellar esa URL como "la política de tratamiento" del Encargado
del servicio de firma habría sido **un sello falso**: el Acuerdo de la nube habría remitido a
un documento que no describe ese servicio.

El texto aprobado del Acuerdo (la v1.0, sellada) no obliga a esto: el 1.2 y el 10.7 remiten a la
política de la **Empresa** (la Responsable), no a la del Encargado. La del Encargado es un
documento propio, y por eso se redactó y se publicó aparte.

### El check del otrosí, que no admitía la sustitución

`REQUERIDOS_ENCARGO` exigía una cláusula de otrosí. Con la decisión (b) no hay otrosí: hay
sustitución, y un documento que no lleva la cláusula exigida no puede pasar un check.
El ítem ahora acepta **las dos redacciones** (`otros[ií]` o `sustitu`), porque son dos formas de
la misma cláusula y el requirement no es "otrosí" sino "que el documento diga cómo se
relaciona con el Anexo anterior".

### Verificación

- **3 tests nuevos**: la redacción de sustitución pasa; el Anexo de Encargo **real del repo** trae
  las cinco cláusulas; y las URLs del manifiesto apuntan a archivos que **existen en `sitio/`**.
  Ese último es el que ata el sello al documento: una URL que no sirve el archivo es un sello
  falso.
- Las tres URLs se **verificaron por HTTP** (200 y el contenido esperado) **antes** de sellarlas
  en el manifiesto, no después.
- Suite completa: **1722 tests · 1720 pass · 0 fail · 2 skipped**.
- El documento nuevo conserva la marca de revisión profesional pendiente: **lo redactó el
  modelo, no un abogado**, y quitar esa marca sin la revisión del abogado sería afirmar algo
  falso. Por eso el ítem `documento_encargo` sigue en pendiente y bloqueando la primera firma.

### Lo que este paquete NO cierra

El punto 7 (diligenciar el Anexo de Nube) y el punto 11 (la firma del Anexo de Encargo nuevo, que
necesita al abogado) siguen abiertos. El punto 3 era el de las URLs, y esas ya son verdad.

## 📦️949 · El acta de designación no era una obligación legal

*24-oct-2026 · el punto 5 · la designación de la persona o área · el acta que la ley no pide*

### Lo que pedía el check

El ítem `responsable_datos` del readiness exigía **dos** cosas: la persona o el área responsable de la
protección de datos **y** la referencia del acta de designación. Con la primera ya declarada (el cargo
del Representante Legal de Gesstiar) el ítem seguía en `pendiente`, y con él se bloqueaba la primera
firma.

El origen de la segunda condición era una línea de la respuesta 11A del abogado: *"Lo que debe
definir el owner antes de publicar: persona o área (con acta de designación), canal que alguien
atienda..."*.

### Lo que dice la norma

La norma que el check citaba es el **art. 2.2.2.25.4.4 del Decreto 1074 de 2015** (que reproduce el
art. 23 del Decreto 1377 de 2013): *"Todo Responsable y Encargado deberá designar a una persona o área
que asuma la función de protección de datos personales, que dará trámite a las solicitudes de los
Titulares..."*. Lo que exige es **designar**. Nada más.

Para responder si el acta formaba parte de ese "designar", se leyó la **Resolución 384 de 2026** de la
Secretaría Jurídica Distrital, que cita a la SIC: *"la Superintendencia de Industria y Comercio ha
precisado que la Ley Estatutaria 1581 de 2012 y sus normas reglamentarias no establecen un
procedimiento específico para la designación, ni determinan una profesión, tipo de vinculación o
dependencia particular..."*. Y esa misma resolución designa con una **Resolución**, no con un acta.

El texto aprobado del Acuerdo tampoco pide acta: el 10.7(b) final dice que la Empresa *"designa una
persona o área"* y que *"la persona o área responsable es [nombre o cargo]"*. La condición del acta
nunca llegó al texto final: era solo una nota de la lista de pendientes del Exchange.

### La decisión

Se quitó el acta del requisito bloqueante. El campo `acta_designacion` desaparece del manifiesto y el
ítem depende ya solo de la designación. La forma de documentarla es la **declaración pública**: el
Anexo de Encargo y la política dicen quién asume la función, con la cita de las dos normas, y ese
texto lo puede verificar un tercero sin pedirle nada a nadie. Un acta interna no se le puede pedir a
un tercero; una declaración publicada, sí.

### Los cuatro documentos

- `legal/anexo-encargo.html` y `sitio/anexo-encargo.html` (19 381 B, idénticos): el párrafo en el
  capítulo 1, el dato en el capítulo 11 y el art. 23 del Decreto 1377 de 2013 en la lista de normas.
- `legal/politica-firma.html` y `sitio/politica-firma.html` (10 366 B, idénticos): el párrafo en el
  capítulo 1 y la cita de las dos normas en el capítulo 7 (derechos del titular), que es donde el
  art. 23 aplica de verdad.

### Verificación

- **2 tests nuevos**: uno afirma que con solo la designación el ítem queda `ok` (y que **sin**
  designación sigue en `pendiente`), y otro ata el manifiesto real: si alguien vuelve a meter
  `acta_designacion` en `legal-readiness.json`, el test falla.
- **Mutación comprobada por los dos lados**: reintroducir el acta en el código (`&& !!_texto(enc.acta_designacion)`)
  rompe el primer test, y reintroducir el campo en el manifiesto rompe el segundo. Un check que se
  afloja sin que nada lo detecte es un check que ya no muerde.
- El reporte local: el ítem `responsable_datos` pasó de `pendiente` a `ok` — *"Persona o área
  designada: Cargo Representante Legal de Gesstiar."*
- Suite completa: **1724 tests · 1722 pass · 0 fail · 2 skipped** (antes 1722/1720/0/2: los dos
  tests nuevos son los de este paquete).
- Barrido de caracteres no latinos: limpio en los ocho archivos del paquete.

### Lo que este paquete NO cierra

Sigue faltando el **nombre** del representante legal de Gesstiar: con el cargo, la designación legal
está hecha; con el nombre, además, la identificación completa del Encargado en el Anexo de Nube
(`partes_encargado`). Ese nombre es del owner.

# T6 - El caso del buzón corporativo rechazado y el del medio personal confirmado

**Qué se corrió.** La prueba controlada que el T6 pide: los **dos** casos, uno
contra el otro, sobre el **código desplegado** del servidor de producción
(`kair-server`, `javier@192.168.1.11`), pero sobre una **copia aislada** de la
base de datos. El primero es el caso que la compuerta legal exige que ocurra:
un Trabajador declara un buzón que la **Empresa** puede leer y el sistema
**rechaza** la solicitud y deja el asiento `OTP_MEDIO_CORPORATIVO` en el
registro append-only de eventos. El segundo es el caso complementario: un
buzón **personal** que el Trabajador declara y **confirma**, que sí prospera.

**Fecha.** 12-nov-2026, de 13:55 a 13:58 (hora de Colombia). La corrida que
cierra el acta es la de las **13:57:49 - 13:58:01**; su salida completa está
en `/tmp/kair-t6/salida.txt` en el servidor.

**Dónde está el programa.**
`sgsst-electron-app/firma-service/scripts/probar-t6-medio-corporativo.js`
(sha256 `2fd3edcad25e7953c8754c8c2d7bf17923e62b9697d064ec5463664c5574b6a5`).
Es nuevo: **no** se modificó ningún script existente. Sigue el patrón de
`scripts/probar-10-4.js` y `scripts/probar-n9a.js`: el mismo esqueleto, la misma
cabecera que dice qué prueba, por qué existe y **qué no prueba**, los mismos
códigos de salida, y la misma regla de `sin --confirmar-escribe el script no
escribe nada`.

---

## 1. El requisito y el item que se mueven

| Qué | Dónde | Estado |
|---|---|---|
| **T6** — "E2E controlado con el caso «buzón corporativo rechazado» y el caso «medio personal confirmado», limpieza del rastro y acta" | `docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/10-informe-correcciones-para-asesor-juridico.md:135` | La fila dice "PENDIENTE: depende del servidor". **Los dos casos y el acta existen** (este documento). Sigue abierta la parte que exige **población real**. |
| **`d02`** — "Inventario de buzones corporativos" (`inventario_buzones: 0`) | `sgsst-electron-app/firma-service/legal-readiness.json:195-198` | **Sin tocar, a propósito.** La evidencia del manifiesto dice "0 solicitudes revisadas y 0 casos en riesgo (47.4) ... el resultado es 0 por población vacía, así que el inventario hay que repetirlo cuando haya solicitudes reales". Esta corrida **no** cambia ese 0: ver §7. |

El item del manifiesto que este caso sí ejercita es el hermano de `d02`:
**`rechazo_buzon_corporativo`** ("El OTP a un buzón corporativo se rechaza
siempre"), en `src/services/readinessLegal.js:1621-1645`. Ese item vale `OK`
porque el rechazo es **incondicional** en el código; lo que la compuerta quiere
poder auditar es el **rastro**: que cada caso rechazado quede como evento
`OTP_MEDIO_CORPORATIVO` en `gh_firma_eventos`, que es de solo anexado (la
migración 020 impide UPDATE y DELETE).

**Medido sobre la base de PRODUCCIÓN el 12-nov-2026:** el caso **no ha
ocurrido nunca**. `gh_firma_eventos` con `evento = 'OTP_MEDIO_CORPORATIVO'` →
**0 filas**. Hay 5 solicitudes (2 firmadas, 1 en papel, 1 cancelada, 1 abierta),
ninguna cayó en un buzón corporativo. El código del camino sí está probado
(`src/services/publicFlow.js`, `_controlarMedioCorporativo`, línea 1529), y esta
corrida lo ejercita **contra el código que está desplegado hoy**.

---

## 2. El código que se ejercitó

El código desplegado en `/opt/kair-firma/app` es **byte a byte igual** al del
repositorio en la rama `Dev` (commit `264d08df`, paquete 1052) para los seis
archivos del camino. Medido con SHA-256:

| Archivo | SHA-256 (idéntico en el repo y en el servidor) |
|---|---|
| `src/services/publicFlow.js` | `bb8b3771176d333e0be2e64fcf64d6812d8252ba8c06aad2d70c64359abd53d6` |
| `src/services/empresa.js` | `496c46468b9f6c49c572431374c7e7f3c8c34f87284cc4d7f4a6806f930794fa` |
| `src/services/medioPersonal.js` | `ca33513061fc912b460b95c01864434373a51578fb84bcfa284a3b898097ce89` |
| `src/routes/public.js` | `98a9b804780791b07e78bd1b9e43a294bdf05e8028a877868fcba51bdab5c737` |
| `src/config.js` | `70947f14a637f44bf16e02bb61cf633255f5932f1124cff480a3ad51ccf78d17` |
| `src/services/declaracionSalud.js` | `558e8212fe5a1d4a588c5f3189b77d992f100acae4858a9c1f403d1ff46ba849` |

Acuerdo vigente durante la prueba: **v1.6**, hash
`08e1eb8b09449fbc57eebdda89518482`.

---

## 3. Cómo se corrió (los comandos,textuales)

El patrón es el del 10.4 y el del 9A: **una instancia propia del servicio en
otro puerto**, apuntando a **una copia aislada** de la base.

**a) La copia, con `.backup` (WAL-safe) y solo lectura de la fuente:**

```bash
sqlite3 -readonly /opt/kair-firma/data/firma.sqlite ".backup '/tmp/kair-t6/firma-original.sqlite'"
sqlite3 /tmp/kair-t6/firma-original.sqlite ".backup '/tmp/kair-t6/firma-trabajo.sqlite'"
```

**b) La instancia aislada** (en `/opt/kair-firma/app`, con **llaves propias** de
esta corrida, `NODE_ENV=development` y `DB_PATH` a la copia):

```bash
NODE_ENV=development HOST=127.0.0.1 PORT=8906 \
PUBLIC_URL=http://127.0.0.1:8906 DB_PATH=/tmp/kair-t6/firma-trabajo.sqlite \
INTERNAL_API_KEY=<llave propia de la corrida> ADMIN_API_KEY=<llave propia> \
TOKEN_ENCRYPTION_KEY=<llave propia> \
SMTP_HOST=localhost SMTP_USER=dev-t6@example.invalid SMTP_PASS=dev-t6 \
SMTP_FROM_EMAIL=dev-t6@example.invalid PDF_STORAGE_PATH=/tmp/kair-t6/storage/pdfs \
node src/server.js
```

`NODE_ENV=development` es lo que hace que **no salga ningún correo**: el
`mailer` usa el transporte JSON y el código de verificación sale en la
respuesta. `PDF_STORAGE_PATH` aparta los PDF del `storage` de producción.

**c) La prueba:**

```bash
node /tmp/kair-t6/probar-t6-medio-corporativo.js \
  --db=/tmp/kair-t6/firma-trabajo.sqlite \
  --puerto=8906 \
  --app-dir=/opt/kair-firma/app \
  --empresa=900829731 \
  --trabajador=900000006 \
  --numero=900000006 \
  --semilla=6 \
  --interno-file=/tmp/kair-t6/internal-key.txt \
  --admin-file=/tmp/kair-t6/admin-key.txt \
  --estado=/tmp/kair-t6/estado.json \
  --evidencia=/tmp/kair-t6/evidencia.txt \
  --confirmar-escribe
```

**d) La comprobación de que PRODUCCIÓN no se tocó**, con `sqlite3 -readonly` y
el `journalctl` del servicio.

---

## 4. La salida medida (la corrida que cierra el acta)

`RESUMEN: 30 OK - 0 avisos - 0 fallas` · **código de salida 0**.

### Caso A — el buzón corporativo tiene que ser RECHAZADO

```
[OK]  La solicitud de firma se creo (en la base AISLADA) :: id_solicitud=SIGN-2026-114440 - estado=PENDING - version=v1.6
[OK]  El servidor responde el contexto publico :: id_solicitud=SIGN-2026-114440 - version de la declaracion=1.0
[OK]  El servicio RECHAZO el buzon corporativo :: HTTP 400 - codigo=MEDIO_OTP_CORPORATIVO - id_solicitud=SIGN-2026-114440 - origen=declarado_por_el_trabajador - canal_empresa=asepluscaribesas@gmail.com
[OK]  El caso quedo ASENTADO en el registro append-only (OTP_MEDIO_CORPORATIVO) :: evento id=151 - fecha_hora=2026-11-12T18:57:58.217Z - actor=sistema - metadata={"origen":"declarado_por_el_trabajador","dominio_corporativo":true,"resultado":"rechazado","correo_destino_enmascarado":"trab******@t6-corp.example"}
[OK]  La metadata del asiento dice que el caso fue rechazado :: dominio_corporativo=true - resultado=rechazado - origen=declarado_por_el_trabajador - buzon=trab******@t6-corp.example
[OK]  El codigo de verificacion NO salio (el rechazo es antes de generarlo) :: eventos OTP_SENT=0 - otp_hash en la fila=vacio - estado=OPENED
[OK]  No quedo archivada ninguna confirmacion sobre el buzon rechazado :: eventos MEDIO_PERSONAL_CONFIRMADO=0 - medio_otp_confirmado_correo=(vacio)
```

**Lo que quedó escrito en el rastro** (base AISLADA
`/tmp/kair-t6/firma-trabajo.sqlite`, tabla `gh_firma_eventos`):

```
151|OTP_MEDIO_CORPORATIVO|2026-11-12T18:57:58.217Z|sistema|{"origen":"declarado_por_el_trabajador","dominio_corporativo":true,"resultado":"rechazado","correo_destino_enmascarado":"trab******@t6-corp.example"}
```

El propio servicio también lo deja en su bitácora (log de la instancia
aislada):

```
{"level":"warn","message":"El OTP iba a un buzón que la Empresa puede leer: la solicitud se rechaza","env":"development","origen":"declarado_por_el_trabajador","aviso":"OTP_MEDIO_CORPORATIVO"}
```

### Caso B — el medio personal confirmado tiene que PROSPERAR

```
[OK]  La solicitud de firma se creo (en la base AISLADA) :: id_solicitud=SIGN-2026-972137 - estado=PENDING - version=v1.6
[OK]  El servidor responde el contexto publico :: id_solicitud=SIGN-2026-972137 - version de la declaracion=1.0
[OK]  La identificacion salio y el codigo fue al buzon personal :: estado=OTP_SENT - destino=trab******@t6-personal.example - ttl=600s
[OK]  El codigo salio (evento OTP_SENT) :: evento id=157 - fecha_hora=2026-11-12T18:57:58.499Z
[OK]  La confirmacion del medio quedo ASENTADA (MEDIO_PERSONAL_CONFIRMADO) :: evento id=158 - fecha_hora=2026-11-12T18:57:58.506Z - metadata={"correo":"trabajador@t6-personal.example","version_declaracion":"1.0","origen_medio":"TRABAJADOR_CONFIRMADO"}
[OK]  La fila archiva el buzon que el Trabajador confirmo :: medio_otp_confirmado_correo=trabajador@t6-personal.example - version=1.0 - fecha=2026-11-12T18:57:58.502Z
[OK]  En la firma del caso B no hay ningun asiento de rechazo :: eventos OTP_MEDIO_CORPORATIVO=0
[OK]  El codigo de verificacion era el correcto :: estado=OTP_VERIFIED - el codigo vino de el que devolvio el servicio en la respuesta (modo desarrollo: no se mando ningun correo)
```

### La transición: la COPIA cambió, PRODUCCIÓN no

Este es el punto que hace valer el resto: si la instancia hubiera estado
apuntando a producción, la base aislada no habría cambiado.

```
[OK]  La base AISLADA recibio las DOS solicitudes de la prueba :: firmas 5 -> 7 - eventos 55 -> 68
[OK]  La base AISLADA tiene UN caso mas de buzon corporativo :: OTP_MEDIO_CORPORATIVO 0 -> 1
[OK]  La base de PRODUCCION no cambio (comparacion de SOLO LECTURA) :: firmas=5 - eventos=55 - OTP_MEDIO_CORPORATIVO=0 (identicos a antes de la prueba)
```

| Medición | Instantánea original | Copia de trabajo | Copia restaurada | **PRODUCCIÓN** |
|---|---|---|---|---|
| `gh_firmas_electronicas` | 5 | 7 | 5 | **5** |
| `gh_firma_eventos` | 55 | 68 | 55 | **55** |
| `OTP_MEDIO_CORPORATIVO` | 0 | **1** | 0 | **0** |
| `gh_consentimientos_firma` | 3 | 3 | 3 | **3** |
| SHA-256 del **volcado canónico** (`.dump`) | `d90b347e…d2b` | `9ef3f96d…54fa` | `d90b347e…d2b` | **`d90b347e…d2b`** |

Sobre el SHA-256 del archivo: **no** sirve para comparar, porque `.backup`
reordena las páginas y dos archivos con el mismo contenido pueden tener
huellas distintas. La comparación honesta es la del **volcado canónico**, y ahí
el resultado es claro: **la instantánea original, la copia restaurada y la
base de PRODUCCIÓN tienen el mismo contenido**, mientras que la copia de
trabajo (la que llevó la prueba) es la única con el rastro.

Además:

- El **servicio de producción no se reinició**: `MainPID=281641` antes y
  después, `NRestarts=0`, `ActiveEnterTimestamp=Thu 2026-11-12 09:30:23 -05`.
- `journalctl -u kair-firma` en la ventana de la corrida: **`-- No entries --`**.
- La base de producción **no tiene** ninguno de los eventos de la prueba:
  `OTP_MEDIO_CORPORATIVO = 0` y las mismas 5 firmas
  (`SIGN-2026-734698` OPENED, `SIGN-2026-827084` OTP_VERIFIED,
  `SIGN-2026-927141` SIGNED, `SIGN-2026-738564` SIGNED,
  `SIGN-2026-016820` CANCELLED).
- El archivo `firma.sqlite` de producción conserva su fecha de modificación
  del 11-nov 12:13.
- **No se usó `sudo`**, no se paró ni se reinició el servicio de producción, no
  se reinstaló nada y no se salió del servidor.

---

## 5. La limpieza del rastro

`gh_firma_eventos` es de **solo anexado**: la migración 020 impide UPDATE y
DELETE, y la única forma de borrar una fila es la ventana de purga del 8.6, que
es un acto con requisitos propios. **El script no borra filas de ningún
registro** y no abre esa ventana: eso sería falsear la prueba.

Lo que se hizo, y lo que queda:

| Qué | Dónde | Estado |
|---|---|---|
| Las 2 solicitudes de la prueba y sus 13 eventos | `/tmp/kair-t6/firma-trabajo.sqlite` | **DESCARTADA**: no es la base de producción y no la usa ninguna otra corrida. Se deja en el servidor (no se borra nada). |
| La copia restaurada desde la instantánea original | `/tmp/kair-t6/firma-restaurada-20261112-135749.sqlite` | **Limpia**: mismo contenido que la instantánea original (volcado canónico `d90b347e…`). Es la que demuestra que el rastro de la prueba no quedó en ningún archivo utilizable. |
| La instantánea original | `/tmp/kair-t6/firma-original.sqlite` | Se conserva como respaldo. |
| Los PDF sintéticos | `/tmp/kair-t6/storage/pdfs` | Apartados del `storage` de producción. |
| Las llaves de la instancia aislada | `/tmp/kair-t6/internal-key.txt`, `admin-key.txt` (600) | Son **propias de esta corrida**, no las de producción (que están en `600 root` y `600 kairfirma`, y que la cuenta `javier` no puede leer). Se conservan. |

El script deja escrito en su salida qué creó y con qué comando se restaura la
copia:

```
Para dejar la copia limpia, restaure la instantanea original:
  sqlite3 <instante-original> ".backup '/tmp/kair-t6/firma-trabajo.sqlite'"
```

---

## 6. Lo que esta prueba **NO** prueba

Esto es lo más importante del acta.

1. **NO es el caso real.** Es una **corrida controlada**: una instancia propia
   del servicio, en otro puerto, con llaves propias, con `NODE_ENV=development`,
   sobre una **copia aislada** de la base de datos.
2. **Los datos son sintéticos.** El Trabajador es el id CRUDO `900000006` y el
   documento de identidad es `900000006`: no hay **ninguna persona real** detrás
   de las dos solicitudes. El documento que "se firma" lo genera el propio
   script con `pdf-lib` y lleva escrito en su primera página
   *"PRUEBA DEL T6 - DATOS SINTETICOS - NO ES EVIDENCIA DE UN ACTO REAL"*.
3. **La base de PRODUCCIÓN no se tocó.** Solo se abrió con `sqlite3 -readonly`,
   y el contenido de producción antes y después es idéntico (§4). Lo que la
   corrida demuestra es que **el mecanismo** funciona contra el código
   desplegado; no dice nada sobre lo que haya ocurrido en la vida real.
4. **En PRODUCCIÓN el caso sigue sin ocurrir.** No hay solicitudes reales de
   trabajadores con un buzón corporativo: hay 5 solicitudes en total (2
   firmadas, 1 en papel, 1 cancelada, 1 abierta) y ninguna cayó en un buzón que
   la Empresa pueda leer. El `0` de `d02.inventario_buzones` **sigue siendo 0**
   y esta corrida **no lo cambia**.
5. **El dominio corporativo del caso A se declaró de forma expresa en la
   COPIA.** En la base de producción, `gh_firma_empresas.dominios_corporativos`
   está **vacío**, y los cuatro correos de la ficha (canal de PQRS, de
   incidentes, responsable de tratamiento y canal de copia) son de `gmail.com`,
   o sea que el único dominio corporativo deducido de la ficha es `gmail.com`.
   Para que el caso fuera **expreso** y no una consecuencia colateral, el
   script declaró en la **copia** el dominio sintético `t6-corp.example` (un
   TLD reservado por la RFC 2606, que no existe en la red) y usó para el caso A
   el buzón `trabajador@t6-corp.example`. **En producción no se declaró nada.**
   Lo que la prueba prueba es que el control reacciona a un dominio que la
   Empresa pueda leer; no que en la operación real de hoy vaya a reaccionar
   al buzón que use un trabajador.
6. **No salió ningún correo.** La instancia corrió con `NODE_ENV=development`:
   el código de verificación sale en la respuesta y el `mailer` no abre conexión
   SMTP (el log muestra `[DEV-OTP] Correo simulado`). El caso A, además,
   ocurre **antes** de que se genere el código: por diseño (el 3.4(e) y el
   3.7(a) del Acuerdo), el rechazo tiene que dejar la fila sin rastro de
   estado.
7. **El script no borra asientos** (§5): el `OTP_MEDIO_CORPORATIVO` que quedó
   en la copia de trabajo **sigue ahí**, con su metadata. Borrar un asiento es
   un acto de la ventana de purga del 8.6, no una tarea de un script de prueba.
8. **No se corrió la suite de pruebas** del firma-service: la están corriendo
   otros agentes. No se modificó `legal-readiness.json`, ni
   `config/*.json`, ni nada bajo `firma-service/src/`, ni `Historial.md`, ni el
   cuadro canónico. No se commiteó ni se pusheó nada.

---

## 7. Qué queda pendiente para que el caso sea el REAL

| # | Qué falta | Quién | Por qué esta corrida no lo cierra |
|---|---|---|---|
| 1 | **Que el caso ocurra con una persona real**: una solicitud de firma en producción donde el Trabajador declare un buzón de la Empresa (o el sistema lo detecte), y el asiento quede en `gh_firma_eventos` de **producción**. | Owner + un trabajador real | Requiere un teléfono y una persona: no lo puede hacer un script. |
| 2 | **Repetir el inventario `d02` en producción** (`scripts/inventario-buzon-corporativo.js`) y actualizar `legal-readiness.json` → `d02.inventario_buzones` y `d02.inventario_evidencia` con la cifra real. | Owner (el manifiesto no lo modifica el equipo) | El inventario de hoy dio `0` por **población vacía**. Con el `0` de esta corrida no se puede levantar el item: esta corrida no es población real. |
| 3 | **Cerrar el 7.11 del cuadro canónico** (la corrida E2E completa con invitación, firma desde el celular y descarga de la constancia). | Owner (firma desde el celular) + equipo (smoke y acta) | Esta corrida no descarga la constancia ni firma: solo ejercita el camino del medio y el del rechazo. |
| 4 | **Decidir qué pasa con `d02.inventario_buzones`** cuando el caso real ocurra: el valor deja de ser `0` y el item `rechazo_buzon_corporativo` pasa de "el rechazo es incondicional" a "el rechazo **ocurrió** y quedó asentado". | Owner + abogado | La decisión sobre qué evidencia satisface la compuerta C-1 es del owner. |

**Lo que sí queda hecho y no hay que repetir:** el mecanismo está probado
contra el código desplegado, con los dos casos, con su asiento y con la
metadata; la limpieza del rastro está resuelta por el camino del inventario y
no por el de la purga; y el acta queda escrita.

---

## 8. Detalle menor que se encontró de paso (no es un defecto de esta prueba)

- El primer check del script que averiguaba el ambiente del servicio buscaba el
  literal `dev` en `kair_version`, pero la ruta de salud devuelve
  `compatible-dev` (la cadena es `'compatible-' + ('0.1.189' | 'dev')`). El
  primer check dio un **falso aviso** y se corrigió antes de la corrida que
  cierra el acta; la versión que queda en el repo mira el sufijo, no la
  palabra suelta.
- Una corrida intermedia (13:56:52) **falló con `401 INVALID_API_KEY`** porque
  una instancia aislada de la corrida anterior había quedado viva en el puerto
  8906 (la sesión SSH se cortó antes de que el envoltorio la parara): la
  instancia vieja tenía las llaves viejas. El envoltorio ahora **mata la
  instancia huérfana del puerto antes de arrancar** y **verifica que la
  instancia que responde sea la de esta corrida** (su `uptime_seconds`), porque
  una corrida contra una instancia ajena sería un falso verde. La corrida que
  cierra el acta no tuvo ese problema (`uptime_seconds: 2`).
- El log de la instancia registra un `DEPRECATION: cliente legacy accedió
  endpoint protegido por requireEmpresaScope` en el `POST /sign-requests`: el
  script usa la llave interna en modo legado, que es como lo hacen los otros
  programas de prueba del repo. Queda anotado como **observación** para quien
  revise el uso de la API interna, no como un defecto de esta prueba.

---

*Documento generado el 12-nov-2026 por el equipo de verificación de K+AIR. No
se modificó ningún archivo del repositorio fuera de este documento y del
programa nuevo `scripts/probar-t6-medio-corporativo.js`. No se commiteó ni se
pusheó nada. La base de producción no recibió ni una escritura.*

# Verificacion de cierre - Secciones 6 y 7 (correspondencia y pruebas / produccion y despliegue)

**Preparado el 12 de noviembre de 2026 (13:35-13:50, hora de Colombia) por el equipo de
verificacion de K+AIR.**

> **Que es esto.** El cuadro canonico de cierre
> (`sgsst-electron-app/docs/gestion-humana/firma-electronica/respuesta-checklist-cierre-2026-10-30.md`)
> es del 30-oct-2026 y su tabla de estados quedo desactualizada. Este documento **NO modifica ese
> cuadro**: es una foto medida de las 13 requirements de las secciones 6 y 7 que seguian
> marcados como pendientes o parciales, contrastando el codigo, los documentos y el servidor de
> produccion.
>
> **Como se midio.** (1) Lectura del codigo y los documentos del repo en la rama `Dev`, commit
> `264d08df` (paquete 1052). (2) SSH de solo lectura al servidor `kair-server`
> (`javier@192.168.1.11`, clave `id_ed25519_kair`): `systemctl show`, `curl` a
> `http://127.0.0.1:3001/health`, `sqlite3` contra `/opt/kair-firma/data/firma.sqlite`, `ls -l` /
> `stat` de permisos, `sha256sum` de los archivos en disco, `ss -ltn`, `journalctl -u kair-firma`
> y los logs de los cron. **No se uso `sudo`, no se detuvo ni se reinicio el servicio, no se
> escribio nada en el servidor y no se publico ningun secreto.** (3) La suite de pruebas del
> firma-service **NO se ejecuto** en esta ronda (la estan corriendo otros agentes); las cifras de
> suite que se citan son las medidas por el equipo el 12-nov-2026 y se citan con su fuente.
>
> **Las cuatro palabras de estado** son las del proyecto (`PROMPT.md` 5.30): `CERRADO`,
> `PENDIENTE`, `PARCIALMENTE`, `No aplica`. El estado va como ultima palabra de la clave del
> encabezado, despues del ultimo raya largo.

---

## 6. Correspondencia y pruebas

### 6.11 - Ejecutar la bateria completa de pruebas del servicio - CERRADO

**Que se verifico.** El texto canonico del requisito y su estado, y las tres fuentes que reportan
la ultima corrida de la suite: el runbook de despliegue, el `Historial.md` de la ronda del 12-nov
y el informe al abogado, donde T1 sigue marcado como pendiente de T3.

**Lo que se resolvio el 12-nov-2026 (T1).** La bateria se ejecuto **completa, tres veces, desde un
clon limpio del repositorio** (`verificacion-cierre/t1-corrida-desde-clon-limpio.md`):

| Corrida | tests | pass | fail | skipped |
|---|---|---|---|---|
| A (14:53) | 2 624 | 2 622 | **0** | 2 |
| B (15:03) | 2 630 | 2 628 | **0** | 2 |
| C (15:13) | 2 650 | 2 648 | **0** | 2 |

Las tres corrieron en un clon con `npm ci` desde cero (Node 22, ABI 127) y **sin `.env`**, y sus
conjuntos de nombres de prueba coinciden **exactamente** con las corridas del arbol del owner
(comparacion cerrada en los dos casos: 14:34 y 15:02). `npm ci` en el clon: `added 139 packages`,
exit 0, **0 vulnerabilidades**; los devDependencies no se perdieron y `better-sqlite3` carga bajo
Node 22.

**La corrida sobre el commit, que es la que faltaba (16:04 a 16:11).** Con la ronda ya commiteada
(`e4dd5f31`), el clon sale del commit: no hay nada que trasladar a mano.

```
tests 2665 | pass 2663 | fail 0 | cancelled 0 | skipped 2 | todo 0
duration_ms 323480
```

179 archivos de prueba, `exit 0`, sin bloques `not ok`. El clon se hizo con
`git -c core.autocrlf=false clone --no-hardlinks`, su `git status --porcelain` salio **vacio**, no
tiene `.env`, y `npm ci` dio `added 139 packages` con **0 vulnerabilidades**. Comparada contra la
corrida del arbol del owner: **el conjunto de los 2 665 nombres de prueba es identico** y los dos
omitidos son los mismos, con el mismo motivo escrito en el propio test. Y el clon quedo **byte a
byte** igual al arbol del owner: **4 810 archivos identicos, 0 diferentes, 0 ausentes**.

**Ojo con las dos cifras:** la del clon es la del commit `e4dd5f31`, **anterior** a las dos pruebas
de regresion del manifiesto que se agregaron el 12-nov por la tarde; el arbol de hoy da
**2 693 / 2 691 / 0 / 2**.

**Un hallazgo que hay que dejar escrito.** El primer clon se hizo con la configuracion del sistema
(`core.autocrlf = true`) y **no reproducia el arbol del owner**: materializo 2 697 de los 4 781
archivos versionados con CRLF, cuando los blobs los tienen en LF. El repo del owner tiene
`core.autocrlf = false` en su `.git/config` local, que pisa al del sistema. El clon tiene que
hacerse con `git -c core.autocrlf=false clone`, y `git reset --hard` **no** reescribe los archivos
que el indice ya da por buenos. Sin eso, un clon "limpio" en esta maquina **no** es el arbol del
owner, y cualquier prueba que mire bytes puede dar un resultado distinto.

**La corrida final del arbol del owner.** Con el arbol de dependencias ya corregido (las dos altas
de `npm audit` resueltas) y los tests nuevos de esta ronda, la suite completa se corrio una vez mas
sobre el arbol de trabajo del owner:

```
tests 2693 | pass 2691 | fail 0 | cancelled 0 | skipped 2 | todo 0
duration_ms 318180
```

180 archivos de prueba, `exit 0`, sin bloques `not ok`. **Esta es la cifra que publica ahora la
seccion 7 del runbook** (`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md`); la de 2 606 / 2 604
que publicaba antes ya no era vigente.

**Evidencia.**
`sgsst-electron-app/docs/gestion-humana/firma-electronica/verificacion-cierre/t1-corrida-desde-clon-limpio.md`
(el acta, con la salida literal de cada corrida y la de la corrida sobre el commit);
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` §7 (la cifra vigente);
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:1232` - "[ ] Correr los tests en el
servidor. La suite completa nunca se ha corrido ahi". Medido por SSH hoy: `/opt/kair-firma/app/tests`
**no existe** en el servidor.

**Que falta.** **Nada del lado de este requisito.** La corrida esta vinculada a un commit
(`e4dd5f31`), se reprodujo desde un clon limpio de ese commit, y la seccion 7 del runbook publica
la cifra vigente. Lo que **no** queda es otra cosa, y no es de este requisito: la suite **no se ha
corrido en el servidor** (`/opt/kair-firma/app/tests` no existe ahi), porque el servidor no tiene
los tests y desplegarlos es un acto del owner.

**Quien lo tiene.** — (cerrado por el equipo, con la corrida sobre el commit `e4dd5f31`).

---

## 7. Produccion y despliegue

### 7.1 - Confirmar la version exacta del codigo que se va a desplegar - PARCIALMENTE

**Que se verifico.** Como se puede identificar hoy el codigo que corre en produccion: el servidor
no tiene git, no tiene marcador de version, y el endpoint de salud no anuncia version real. Se
midieron por hash los archivos clave del arbol desplegado y se compararon con el arbol del repo
en el commit `264d08df`. Se reviso tambien el estado de la sesion de commits.

**Evidencia.**
`/health` (medido por SSH el 12-nov 13:31) - `{"status":"ok","version":"0.1.0","kair_version":"compatible-0.1.189","uptime_seconds":14441,"checks":{"db":"ok","smtp":"configured"}}`.
`sgsst-electron-app/firma-service/src/routes/health.js:45` - `kair_version: 'compatible-' + (config.env === 'production' ? '0.1.189' : 'dev')`: es un **valor fijo**, no dice que codigo corre. Por eso la comprobacion tiene que ser por disco, tal como dice el canonico
(`respuesta-checklist-cierre-2026-10-30.md:1241`).
Medido por SSH (`sha256sum` en `/opt/kair-firma/app` frente al hash del repo en `264d08df`):

| Archivo | Servidor | Repo `264d08df` | |
|---|---|---|---|
| `src/server.js` | `73947e2d...ff90` | `73947e2d...ff90` | igual |
| `src/services/readinessLegal.js` | `3f453ed2...2d9` | `3f453ed2...2d9` | igual |
| `config/tabla-conservacion.json` | `9c81a175...a61b` | `9c81a175...a61b` | igual |
| `legal-readiness.json` | `191c08b8...4013f` | `d9b59699...c9097b` | **difiere en 2 notas (12-nov, tarde); el despliegue lo alinea** |
| `scripts/fixtures/acuerdo-v1.6.txt` | `08e1eb8b...2f13e` | `08e1eb8b...2f13e` | igual |
| `package.json` | `0a25dbe8...e424` | `ca60b002...b55ca` | **distinto** |

Medido por SSH: `grep -n '"express"' /opt/kair-firma/app/package.json` devuelve `"express":
"^4.21.0"`, mientras el repo ya declara el piso `^4.22.3` (paquete 1051). El `package-lock.json`
desplegado fija `express 4.22.2`, `proxy-addr 2.0.7`, `qs 6.15.3` (lineas 551, 1141 y 1164 del lock
en disco).
`Historial.md:24` - el tar del despliegue habilitante fue `kair-deploy.tar.gz` (1 180 396 B,
sha256 `dc4c6936...97bc6`), armado con el codigo commiteado del paquete 1047 mas el manifiesto
corregido.
`Historial.md:8777` - los commits de la sesion (`91214c55` paquete 1050 y `dfc403b0` paquete 1051)
**no han salido del PC** y el paquete 1051 **no esta desplegado**.
`Historial.md:8781` - la cola del owner ya dice: "desplegar el 1051 en el servidor (el bump de
dependencias viaja en el paquete de despliegue, asi que sin desplegar la produccion sigue con las
versiones viejas)".

**Que falta.** Dos cosas. (a) Para el **proximo** despliegue no hay commit candidato declarado:
T3 sigue pendiente y el owner no ha fijado uno. (b) El estado desplegado es **mixto**: el codigo
fuente (`src/`) y el manifiesto coinciden con la punta del repo, pero los archivos de dependencias
en disco son los anteriores al paquete 1051. Es decir: **hoy no hay un commit unico que describa
lo que corre**, porque el codigo es de una epoca y el lock de otra. Ningun requisito pide
controlar eso, pero sin resolverlo la "version exacta" se responde por hash y no por nombre.
Ningun archivo del servidor declara la version: `package.json` dice `"version": "0.1.0"`
(constante) y no hay `.git` ni archivo de build.

**Quien lo tiene.** Owner (fijar el commit candidato, con el "dale" que autoriza commit) y
equipo (desplegar el 1051 con `npm ci --omit=dev`, paso que ya esta documentado).

### 7.3 - Ejecutar las migraciones de base de datos necesarias - CERRADO

**Que se verifico.** Las migraciones que el canonico pedia (`047`, `048`, `049`, `050`, `051`) y las
tres que se agregaron despues (`060` contrafirma del Anexo de Nube, `061` registro de poderes del
Encargado, `062` su rastro append-only), contra la tabla real de migraciones de la base de
produccion, y la correspondencia uno a uno con los archivos de migracion del repo.

**Evidencia.**
Medido por SSH: `SELECT COUNT(*) FROM gh_firma_schema_migrations` devuelve **61**, y las tres
ultimas filas son `060_anexo_nube_contrafirma`, `061_encargado_poderes` y
`062_encargado_poderes_append_only`, las tres con `applied_at = 2026-11-11 18:52:10` UTC, es
decir **13:52:10 hora de Colombia**, dentro de la ventana de la reparacion que quedo registrada en
`Historial.md:74` (13:38-13:52).
Comparacion 1:1 con el repo: `sgsst-electron-app/firma-service/src/db/schema/` tiene **61**
archivos `.sql` y el servidor tiene **61** migraciones aplicadas; la diferencia de los dos
conjuntos (hecha con `Compare-Object`) es **cero en ambos sentidos**: no hay migracion del repo sin
aplicar ni aplicada que no exista en el repo.
`Historial.md:74` - las migraciones las aplico **el propio servicio** al arrancar
(`src/server.js:251`), no un script aparte, con el entorno que le da systemd.

**Que falta.** Nada: queda cerrado. La comprobacion de que quedaron bien aplicadas es el 7.4.

**Quien lo tiene.** - (cerrado por el equipo en la reparacion del 11-nov-2026).

### 7.4 - Comprobar que las migraciones se aplicaron correctamente - CERRADO

**Que se verifico.** En disco y sobre la base de produccion: que las tablas, columnas y disparadores
que traen las tres migraciones nuevas existen de verdad, que la base esta integra, y que las rutas
que dependen de esas migraciones existen en el codigo que corre (un 404 significa codigo viejo).

**Evidencia.**
Medido por SSH contra `/opt/kair-firma/data/firma.sqlite`:
- `060`: la tabla `gh_firma_anexo_nube_suscripciones` tiene **15 columnas `contrafirma*`**
  (`contrafirmado_at`, `contrafirma_actor`, `contrafirma_motivo`, `contrafirma_codigo_enviado_at`,
  `contrafirma_canal`, `contrafirma_otp_hash`, `contrafirma_otp_intentos`,
  `contrafirma_otp_envios`, `contrafirma_estado`, `contrafirma_ip`, `contrafirma_user_agent`,
  `contrafirma_evidencia`, `contrafirma_acta_hash`, `contrafirma_acta_bytes`,
  `contrafirma_acta_archivo`); la ficha de empresa tiene las **5** columnas `anexo_nube*`
  (`anexo_nube_firmado_at`, `_version`, `_hash`, `_evidencia`, `anexo_nube_ejecutado_at`).
- `061` y `062`: existen `gh_firma_encargado_poderes` y `gh_firma_encargado_poderes_eventos`.
- Disparadores append-only: **36** disparadores `trg_*_no_delete` / `trg_*_no_update`, entre ellos
  `trg_firma_eventos_no_delete`, `trg_aprobaciones_publicacion_no_delete`,
  `trg_anexo_nube_eventos_no_delete`, `trg_encargado_poderes_eventos_no_delete`.
- `PRAGMA integrity_check` devuelve **ok**.
- Rutas que dependen del codigo nuevo: `POST` sin llave a las cuatro rutas de deshacer los actos
  devuelven **401** (existen), mientras una ruta inexistente devuelve **404**
  (medido por SSH el 12-nov 13:41).

**Que falta.** Nada: queda cerrado.

**Quien lo tiene.** - (cerrado por la reparacion del 11-nov-2026, verificado hoy por SSH).

### 7.5 - Verificar el estado de la base de datos y sus respaldos - PENDIENTE

**Que se verifico.** El estado de la base de produccion, el ciclo de respaldo diario (cifrado,
integridad, retencion), la existencia de una copia fuera del servidor, y si la **prueba de
restauracion mensual** que el propio manifiesto promete se ha ejecutado alguna vez. Ademas: si los
cuatro actos del P8 estan en algun respaldo.

**Evidencia.**
Medido por SSH:
- Base de produccion: `/opt/kair-firma/data/firma.sqlite` (872 448 B) con su WAL y SHM del
  12-nov 11:14; `PRAGMA integrity_check` = **ok**; 1 empresa (`900829731`), 2 suscripciones del
  Anexo de Nube y 2 del Anexo de Encargo.
- Ciclo de respaldo: `/etc/cron.d/kair-firma-backup` = `0 22 * * * root /opt/kair-firma/backup-firma.sh`.
  El log `backups/backup.log` del 11-nov 22:00 dice: "Backup OK: firma-20261111-220001.sqlite.enc
  (164714 B, sha256 `de14e3f4b3c94c32eb690ae9215c111cdc1b450c963726eac54bd5192ebde20a`, integrity
  ok, cifrado gpg) + storage-20261111-220001.tar.gz.enc". La frase de paso vive en
  `/opt/kair-firma/backup.passphrase` (600 root:root).
- **El ultimo respaldo es del 11-nov a las 22:00.** Los cuatro actos del P8 (12-nov 15:38 a
  16:14) **no estan en ningun respaldo todavia**: al momento de esta medicion (12-nov 13:35) el
  respaldo de hoy todavia no se habia hecho. Esto ya lo reporta el propio equipo en
  `Historial.md:8788`.
- **No hay copia fuera del servidor**: los 52 archivos `.enc` viven en `/opt/kair-firma/backups`, y
  `df -h` dice que `/opt` esta en `/dev/mapper/ubuntu--vg-ubuntu--lv` (11 % usado, 91 GB libres) -
  el **mismo disco** que la base. No existe `/opt/kair-firma/backups-offsite`, no hay `/mnt/*` ni
  `/media/*`, y no hay `rclone` instalado. El propio runbook lo lista como pendiente:
  `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:1154` ("[ ] Copia **off-site** de los
  respaldos (hoy viven en el mismo servidor que los datos)").
- **La prueba de restauracion mensual nunca se ha ejecutado**: `/etc/cron.d/kair-firma-restauracion`
  esta en `0 4 1 * *` y escribe en `/opt/kair-firma/backups/restauracion.log`, archivo que **no
  existe** (los crons se instalaron el 6-nov, despues del 1 de noviembre, y el 1 de diciembre
  todavia no llega). Es decir: el manifiesto promete "una prueba de restauracion mensual"
  (`sgsst-electron-app/firma-service/legal-readiness.json:47`) y esa prueba **nunca ha corrido una
  vez**.

**Que falta.** Tres cosas, y la primera es la unica urgente: (a) **el respaldo de hoy (12-nov 22:00)
debe correr y verificarse**, porque hasta entonces los cuatro actos del P8 -la evidencia de los
actos que el propio expediente declara como ejecutados- **no estan en ninguna copia**: un fallo de
disco hasta las 22:00 los pierde. (b) **La copia off-site**, que es la brecha mas grande del plan de
continuidad y la mas facil de cerrar. (c) **Ejecutar y registrar una prueba de restauracion** al
menos una vez, para que la frase "se verifica mensualmente que el respaldo se restaura
correctamente" del Anexo de Nube no sea una promesa sin un solo respaldo restaurado nunca.

**Quien lo tiene.** Equipo (correr y verificar el respaldo de hoy; instalar la copia off-site) y
owner (la cuenta y el destino de la copia off-site).

### 7.6 - Comprobar los permisos de archivos y directorios - PENDIENTE

**Que se verifico.** Los permisos reales del arbol desplegado, contra lo que el propio runbook
exige. Se midieron el directorio de la app, sus subdirectorios, los archivos, y cuantos archivos y
directorios quedan con permiso de escritura para cualquiera.

**Evidencia.**
Medido por SSH (`ls -ld` / `ls -l` en `/opt/kair-firma`):

```
drwxrwxrwx  8 kairfirma kairfirma  4096 nov 11 13:52 /opt/kair-firma/app
drwxrwxrwx  9 kairfirma kairfirma  4096 nov 11 13:52 /opt/kair-firma/app/src
-rw-rw-rw-  1 kairfirma kairfirma 11796 nov 11 07:04 /opt/kair-firma/app/src/server.js
-rw-rw-rw-  1 kairfirma kairfirma  1171 nov 11 07:04 /opt/kair-firma/app/package.json
drwxr-xr-x  2 kairfirma kairfirma  4096 nov 11 14:01 /opt/kair-firma/legal
```

Conteo: **236 archivos** y **18 directorios** bajo `/opt/kair-firma/app` con bit de escritura para
otros (`-perm -0002`).
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:768` - lo que el runbook exige: "`drwxr-x---`
en `app/`, `drwxr-xr-x` en `app/src/`, `-rw-r--r--` en los archivos".
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:279` - el paso 2b del despliegue
(`chmod -R u=rwX,go=rX` y `chmod 750` sobre `app/` y `legal/`) **no se aplico**: el script de
reparacion del 11-nov (`kair-reparar-produccion-v2.sh`, `Historial.md:74`) repuso `node_modules` y
aplico las migraciones, pero no normalizo permisos.
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:735` - el abogado ya lo habia marcado el
31-oct-2026: "con permisos 777, cualquier usuario de la maquina puede escribir el codigo que corre
el servicio, y eso no es 'minimo privilegio'".
Medido por SSH: `id javier` -> `uid=1000(javier) gid=1000(javier) groups=1000(javier),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),101(lxd)`. La cuenta de servicio corre como `kairfirma`
(`/etc/systemd/system/kair-firma.service`), y con `app/` en 777 una cuenta local cualquiera puede
**reemplazar el codigo que despues se ejecuta como `kairfirma`**: es una via de escalamiento, no
solo un desorden de permisos.
Lo que **si** esta bien: el paso 2c no aplica (no existe `/opt/kair-firma/app/data`, ni
`app/data/test.sqlite`; medido: "cannot access"), y los secretos **no** viven en `app/`:
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:771`.

**Que falta.** Aplicar el paso 2b del runbook (`chmod -R u=rwX,go=rX` mas `chmod 750` sobre `app/` y
`legal/`), que es una operacion de root y no la hizo el despliegue. Es el unico punto de esta
seccion que el propio abogado habia marcado como bloqueante y que sigue igual cuatro meses de
despues.

**Quien lo tiene.** Owner (ejecutar el `chmod` con su clave de sudo); el procedimiento ya esta
escrito y es de una sola linea.

### 7.7 - Comprobar la configuracion de seguridad del servicio - PENDIENTE

**Que se verifico.** Como esta expuesto el servicio (puertos, entrada, proxy), como esta endurecida
la unidad de systemd, que versiones de dependencias corre de verdad el proceso, con que runtime, y
si el disco esta cifrado.

**Evidencia.**
Medido por SSH:
- **Superficie**: `ss -ltn` muestra el servicio escuchando **unicamente en `127.0.0.1:3001`**. No
  hay 80 ni 443 abiertos, no hay `nginx` ni `caddy` instalados. La unica entrada es
  `/etc/cloudflared/config.yml`: `firma.kair.fyi -> http://127.0.0.1:3001`. La VM corre ademas
  Cockpit (4330) y un agente de Tailscale, que son superficies por revisar aparte.
- **Unidad systemd** (`/etc/systemd/system/kair-firma.service`): `User=kairfirma`,
  `EnvironmentFile=/opt/kair-firma/.env`, `NoNewPrivileges=true`, `PrivateTmp=true`,
  `ProtectSystem=full`, `ReadWritePaths=/opt/kair-firma`, `LimitNOFILE=65536`.
- **Proxy de confianza**: `sgsst-electron-app/firma-service/src/config.js:58` ->
  `trustProxy: process.env.TRUST_PROXY || 'loopback'`, aplicado en
  `sgsst-electron-app/firma-service/src/server.js:67` -> `app.set('trust proxy', config.trustProxy)`.
  El valor por defecto es `'loopback'` y el codigo nunca usa `'true'`
  (`sgsst-electron-app/firma-service/deploy/README-DESPLIEGUE.md:45`). El valor real vive en el
  `.env` (600 root), que esta cuenta no puede leer: **esa comprobacion puntual queda del owner**.
- **Dependencias que corre el proceso** (leidas de `node_modules` en el servidor):
  `express 4.22.2`, `proxy-addr 2.0.7`, `qs 6.15.3`, `nodemailer 6.10.1`, `zod 3.25.76`. Es decir,
  **produccion sigue con la version CRITICA de `proxy-addr` (2.0.7) y con las dos ALTAS**
  (`nodemailer`, `zod`). El repo ya las corrigio (`Historial.md:8735`: `proxy-addr` 2.0.8, `qs`
  6.16.2, `express` 4.22.3), pero **ese cambio no esta desplegado**
  (`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:346`).
- **Runtime**: `/usr/bin/node --version` -> **v20.20.2** (Node 20, EOL 2026-04-30). La decision del
  owner del 11-nov es Node 22 (`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:1186`), y el
  propio runbook avisa de que subirlo obliga a recompilar `better-sqlite3` antes de arrancar.
- **Cifrado en reposo**: `/dev/mapper` solo tiene `ubuntu--vg-ubuntu--lv` (sin `crypt`), y
  `/swap.img` es un archivo plano de 3,7 GB. El disco **no esta cifrado**, ya registrado como
  pendiente en `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:776`.

**Que falta.** (a) **Desplegar el paquete 1051 con `npm ci --omit=dev`**, que es lo que deja de
correr `proxy-addr` 2.0.7 y `qs` 6.15.3: hasta ese dia, el proceso ejecuta la version critica
aunque el repo ya la haya corregido. (b) **La decision del runtime**: Node 22, con su recompilacion
de `better-sqlite3` (ABI 127) antes de arrancar. (c) **El cifrado en reposo del disco**, que no es
un parche sino una decision del owner con el abogado. (d) La lectura del `TRUST_PROXY` real, que
solo puede hacer el owner porque el `.env` es 600 root.

**Quien lo tiene.** Equipo (desplegar el 1051 y recompilar el binario); owner (Node 22, cifrado en
reposo, lectura del `.env`).

### 7.8 - Verificar que no haya credenciales expuestas - CERRADO

**Que se verifico.** Que los archivos de credenciales del servidor tengan permisos restringidos y que
no los pueda leer nadie mas; que no haya material de clave dentro del arbol de codigo desplegado;
y que el repositorio este limpio de credenciales.

**Evidencia.**
Medido por SSH (`stat`): `/opt/kair-firma/.env` **600 root:root**; `/opt/kair-firma/admin-key.txt`
**600 kairfirma:kairfirma**; `/opt/kair-firma/internal-key.txt` **600 kairfirma:kairfirma**;
`/opt/kair-firma/backup.passphrase` **600 root:root**. La cuenta de verificacion (`javier`,
uid 1000) **no puede leer ninguno de los cuatro** (el `grep` del `.env` responde "Permission
denied" y el `grep -o '^[A-Z_]*='` no imprime ni un nombre).
Barrido del arbol desplegado (`src`, `config`, `scripts`, `web`) con patrones de clave privada,
`sk_live_`, `ghp_` y `xox*`: **sin coincidencias**.
Barrido del repositorio (`firma-service`, 361 archivos `.js/.json/.txt/.html` sin `node_modules`) con
los mismos patrones: **sin coincidencias**.
`sgsst-electron-app/docs/gestion-humana/firma-electronica/respuesta-checklist-cierre-2026-10-30.md:1209`
- el canonico ya daba por cerrado el lado del repositorio y dejaba pendiente solo la comprobacion en
el servidor de los permisos de los dos archivos de llave: **esa comprobacion esta hecha**.
`Historial.md:8756` - "Barrido de secretos: limpio" en la ronda del 12-nov.

**Que falta.** Nada respecto de las credenciales: queda cerrado. **Reserva que no pertenece a este
requisito pero se deja dicha porque es su vecina:** el arbol de codigo esta en 777 (7.6), o sea que
el riesgo residual no es "una credencial expuesta" sino "un codigo reemplazado". Se corrige en el
7.6, no aqui.

**Quien lo tiene.** - (cerrado: verificacion de solo lectura del 12-nov-2026).

### 7.9 - Verificar los registros y mecanismos de auditoria - CERRADO

**Que se verifico.** Que las tablas de bitacora existen y tienen contenido, que los disparadores
append-only estan instalados, y que los actos del P8 (12-nov) quedaron con rastro.

**Evidencia.**
Medido por SSH:
- `gh_firma_eventos`: **55 filas**, con el desglose por evento: `CREATED 5`,
  `IDENTIFICATION_COMPLETED 4`, `INVITE_SENT 4`, `OPENED 4`, `OTP_SENT 4`, `OTP_VERIFIED 4`,
  `PAPER_OPTION_AVAILABLE 4`, `CONSENT_ACCEPTED 2`, `SIGN_COMMITTED 2`,
  `PAPER_SIGNATURE_REGISTERED 1`, `ELECTRONIC_FLOW_CANCELLED 1`, `OTP_FAILED 1`, y otros.
- **36 disparadores append-only** instalados, entre ellos `trg_firma_eventos_no_delete` y
  `trg_firma_eventos_no_update`, `trg_aprobaciones_publicacion_no_delete/update`,
  `trg_anexo_nube_eventos_no_delete/update`, `trg_anexo_encargo_eventos_no_delete/update`,
  `trg_encargado_poderes_eventos_no_delete/update`, `trg_empresas_auditoria_no_delete/update`,
  `trg_firma_purga_registro_no_delete/update`.
- Rastro de los actos del P8: `gh_firma_anexo_nube_eventos` con **15** filas (las ultimas:
  `CONTRAFIRMA_CODIGO_INVALIDO` 15:41:11, `CONTRAFIRMA_CODIGO_ENVIADO` 16:12:54,
  `CONTRAFIRMA_FACULTAD_VERIFICADA` 16:13:54, `CONTRAFIRMA_FIRMADA` 16:13:54,
  `CONTRAFIRMA_ACTA_GENERADA` 16:13:54 con `hash=050f223a...4a501`) y
  `gh_firma_anexo_encargo_eventos` con **20** filas (`REPRESENTANTE_VERIFICADO` 15:40:32,
  `CONTRAFIRMA_FIRMADA` 16:14:31, acta `5dcb2149...4b062`).
- `gh_firma_aprobaciones_publicacion` con **4** filas, todas de tipo `OPERATIVA` y con
  `aprobado_por` = Javier Robles Fontalvo (v1.0, v1.4, v1.5, v1.6), y `gh_firma_empresas_auditoria`
  con su disparador de solo anexado.
- Bitacora del sistema: `journalctl -u kair-firma` responde y el monitor de salud cada 5 minutos
  deja log en `/opt/kair-firma/logs/health-check.log` (409 619 B al 12-nov 13:35).

**Que falta.** Nada: queda cerrado.

**Quien lo tiene.** - (cerrado: mecanismo construido y probado por el equipo, verificado hoy por
SSH en produccion).

### 7.11 - Ejecutar pruebas controladas de extremo a extremo - PENDIENTE

**Que se verifico.** Si el flujo electronico completo se ha ejercitado en produccion contra el
codigo que hoy corre, y si el caso real que el abogado pidio (buzon corporativo rechazado) ha
ocurrido alguna vez.

**Evidencia.**
Medido por SSH:
- Las **cinco** firmas de la base de produccion: `SIGN-2026-734698` (26-oct, OPENED),
  `SIGN-2026-827084` (26-oct, OTP_VERIFIED), `SIGN-2026-927141` (26-oct, SIGNED),
  `SIGN-2026-738564` (06-nov, SIGNED) y `SIGN-2026-016820` (06-nov, CANCELLED). La **ultima
  firma electronica completa es del 6 de noviembre**: despues del despliegue del 11-nov y de los
  cuatro actos del P8 del 12-nov **no se ha ejercitado el flujo de firma**.
- El evento mas reciente de la bitacora es del 06-nov 20:25:34Z (`ELECTRONIC_FLOW_CANCELLED`).
- Los dos programas que el canonico exige estan en el servidor
  (`/opt/kair-firma/app/scripts/smoke-produccion.js` y `limpiar-rastro-prueba.js`, ambos del
  11-nov 07:04), pero **no se han corrido** contra el codigo actual.
- El caso real rechazado **no ha ocurrido**: hay **0 eventos `OTP_MEDIO_CORPORATIVO`** en la base.
  Esto es T6 del abogado y sigue abierto:
  `sgsst-electron-app/docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/10-informe-correcciones-para-asesor-juridico.md:135`.
- La referencia historica que el propio canonico cita
  (`respuesta-checklist-cierre-2026-10-30.md:1237`) es del **26-oct-2026** con 12 comprobaciones y
  0 fallas: contra el codigo de esa fecha, no contra el de hoy.
- `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:1123` - el pendiente del runbook:
  "[ ] Correr los tests de extremo a extremo con datos reales: crear sign request, enviar la
  invitacion por correo, firmar desde el celular y descargar la constancia".

**Que falta.** Una corrida controlada de extremo a extremo **contra el codigo desplegado hoy**:
crear la solicitud, enviar la invitacion, firmar desde el celular y descargar la constancia, y
despues retirar el rastro con `limpiar-rastro-prueba.js --solo-firmas`. Con eso se cierra 7.11 y
ademas el T6 del abogado (el caso del buzon corporativo rechazado, que es el que la compuerta C-1
debe ver ocurrir en la vida real antes de encenderse para empresas que no tengan el Anexo de Nube).
Es el unico pendiente de esta seccion que exige **una persona con un celular**, no un script.

**Quien lo tiene.** Owner (firma desde el celular y descarga de la constancia) con el equipo
(smoke, limpieza del rastro y acta).

### 7.12 - Verificar la version y las migraciones en el servidor real - PARCIALMENTE

**Que se verifico.** Las dos mitades del requisito, por separado: las migraciones en el servidor real
y la version del codigo que corre en el servidor real.

**Evidencia.**
*Migraciones: verificadas* (mismo detalle que en 7.3 y 7.4): 61 de 61 aplicadas, 1:1 con el repo,
`integrity_check` ok, tablas, columnas y disparadores presentes, y las cuatro rutas que dependen de
las migraciones respondiendo 401 y no 404.
*Version: no se puede leer del servicio.* `sgsst-electron-app/firma-service/src/routes/health.js:45`
devuelve `kair_version: 'compatible-' + (config.env === 'production' ? '0.1.189' : 'dev')`, un
valor fijo. Medido por SSH: `/opt/kair-firma/app` **no tiene `.git`** y su `package.json` declara
`"version": "0.1.0"`, tambien fijo. El canonico ya lo anticipaba:
`respuesta-checklist-cierre-2026-10-30.md:1243` ("responde, pero no anuncia version ni
migraciones"), y por eso la comprobacion tiene que ser por disco.
*Por disco si se puede, y da un resultado que no es limpio:* los hashes de `src/server.js`,
`src/services/readinessLegal.js`, `config/tabla-conservacion.json`, `legal-readiness.json` y
`scripts/fixtures/acuerdo-v1.6.txt` **coinciden con el repo en `264d08df`**; los de
`package.json` y `package-lock.json` **no** (el deployed lock fija `express 4.22.2`,
`proxy-addr 2.0.7`, `qs 6.15.3`).
El manifiesto de produccion si esta verificado byte a byte: `sha256sum
/opt/kair-firma/app/legal-readiness.json` = `191c08b837b41069de4e2d25d7158fd90a7c3ce5f93b22696d2d7050f8a4013f`,
que es el hash canonico del repo. **Nota de vigencia (12-nov-2026, tarde).** Esta medicion es la de ese momento y **no se reescribe**. Desde esa tarde el **repositorio** lleva el manifiesto `d9b596993cec7958cadadcd9d9ed51c33878eb03c5b0c4aa1bc642a4bfc9097b`, que difiere del de produccion en **exactamente dos campos**: las dos notas (`anexo_nube.modelo.nota` y `anexo_encargo.nota`) que en produccion dicen «NO esta suscrito» mientras el propio bloque declara `firmado: true` y `contrafirmado: true` con la fecha del 12-nov. Los dos actos **existen en la base de produccion** (suscripcion id 2, `FIRMADA` y `CONTRAFIRMADA`, acta `050f223a3665cf7d`): lo que se corrige es la prosa, no el hecho. **El despliegue es lo que alinea los dos**, y por eso el repositorio va por delante a proposito y el hash del manifiesto **no coincide** con el del servidor hasta que ese despliegue se ejecute.

**Que falta.** La mitad de migraciones esta resuelta. La de version queda a medias: (a) **no hay
sello de version en el servidor** (ni git, ni build, ni version leida del manifiesto), asi que
responder "que version corre" obliga a comparar hashes archivo por archivo; y (b) el arbol
desplegado es **mixto** (codigo de la punta del repo, dependencias de antes del paquete 1051), de
modo que **ningun commit unico describe lo que corre ahora mismo**. Resolverlo es lo mismo que
desplegar el 1051 y dejar el sello de version.

**Quien lo tiene.** Equipo (desplegar el 1051 con `npm ci --omit=dev` y dejar el sello de version);
owner (decidir si el sello se lee del manifiesto o del hash de un archivo de build).

### 7.13 - Registrar el resultado de la comprobacion del servidor - CERRADO

**Que se verifico.** Que el resultado de la comprobacion del servidor quedara **escrito en el
documento que el canonico designa**, y no solo medido. Antes de esta medicion, la seccion 5.1 del
runbook era **solo el procedimiento** (parar, copiar, normalizar permisos, verificar hashes, migrar,
arrancar, verificar) y el resultado vivia disperso en el `Historial.md` y en los informes. Ahora el
resultado esta en la seccion 5.1 del runbook, en un apartado propio.

**Evidencia.**
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md`, seccion **5.1.4 «El resultado medido de la
comprobacion del servidor (12-nov-2026)»**: la medicion completa, con el commit de referencia
(`264d08df`), el estado del servicio, las migraciones, las cuatro huellas, los permisos, los logs, la
red, los respaldos y el resultado del preflight; mas la comparacion archivo por archivo del arbol
desplegado (247 archivos en comun, 6 diferentes, 0 sobrantes) y el comando para reproducirla.
Las actas completas, con la salida integra de cada comando, estan en
`verificacion-cierre/acta-comprobacion-servidor-2026-11-12.md` (esta comprobacion) y
`verificacion-cierre/acta-despliegue-2026-11-12.md` (el despliegue, requisito 8.8).
La medicion se hizo el 12-nov-2026, 19:52Z a 19:57Z, por SSH en modo de solo lectura: la base se
midio con `sqlite3 -readonly` y el unico script que necesita abrirla (el preflight) se corrio contra
una **copia** hecha con `.backup`, que es consistente; la original no se abrio en escritura.

**Que falta.** Nada del requisito: el resultado quedo registrado en el lugar que el canonico
designa, con el commit, las huellas, las migraciones, lo verificado y lo que quedo abierto con su
dueno. **Lo que el acta deja abierto es de otros requisitos** (7.5, 7.6, 7.7, 7.15 y el despliegue del
📦1051), y esos no se cierran por escribir un acta.

**Quien lo tiene.** Equipo (medir y escribir el acta). La parte que queda es del owner y esta
nombrada en el propio apartado 5.1.4.

### 7.15 - Autorizar expresamente la activacion del flujo - PENDIENTE

**Que se verifico.** Que exista un acto expreso del owner autorizando la activacion del flujo, y
cual es el estado real de las compuertas que hoy gobiernan la apertura.

**Evidencia.**
Medido por SSH, `gh_firma_aprobaciones_publicacion` (4 filas): las cuatro autorizaciones
registradas son de tipo `OPERATIVA` y se refieren a **publicar el Acuerdo** (v1.0, v1.4, v1.5,
v1.6), con `aprobado_por` = Javier Robles Fontalvo. **Ninguna de las cuatro es una autorizacion
de activacion del flujo.**
Estado real de las compuertas, medido:
- `sgsst-electron-app/firma-service/config/tabla-conservacion.json:6` -> `"activada": false`, con
  `"validado_por": null` y `"estado": "PROPUESTA"`: la compuerta de conservacion **esta cerrada a
  proposito** (es el orden J8 del abogado: validar, alinear, reejecutar pruebas y solo entonces
  abrir).
- `sgsst-electron-app/firma-service/src/config.js:203` ->
  `exigirAnexoNube: process.env.FIRMA_EXIGIR_ANEXO_NUBE === 'true'`: el interruptor C-1 **esta
  apagado** (y el propio codigo exige un orden escrito antes de encenderlo).
- `sgsst-electron-app/firma-service/legal-readiness.json:10` -> `"publicado": true`; linea 142
  `"firmado": true`; linea 147 `"contrafirmado": true`; lineas 115 y 137 `"estado": "firmado"`.
  La compuerta tecnica esta en verde: `Historial.md:8694` ("42 items cada uno, 40 `ok`, 0
  pendientes, **0 bloqueantes**") y `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:1318` (la
  compuerta `primera_firma` en `listo: true`).
- Pero la base tiene **una sola empresa** (medido: `900829731`, ASEPLUS CARIBE S.A.S.), que es la
  empresa de prueba: `Historial.md:8714` ("lo que no esta hecho es abrirlo a una empresa real: en
  la base de produccion hay UNA sola empresa, ASEPLUS CARIBE S.A.S., que es la de prueba").
- `.../paquete-abogado-2026-10-30/10-informe-correcciones-para-asesor-juridico.md:137` - **T8**
  ("Decision operativa del representante legal, identificando version/huella y verificaciones")
  sigue **Pendiente**.

**Que falta.** El **acto expreso del owner que autorice abrir el flujo a empresas reales**, con la
version, la huella y las verificaciones que lo sostienen (T8). Lo que hoy existe es otra cosa y hay
que distinguirla con cuidado: (a) la autorizacion de **publicar el Acuerdo v1.6**, que ya esta
registrada (fila 4 de `gh_firma_aprobaciones_publicacion`); (b) los **cuatro actos del P8**, que
se ejecutaron sobre la **empresa de prueba**; y (c) el hecho de que la compuerta tecnica este en
verde con 0 bloqueantes. **Ninguna de las tres cosas es la autorizacion de abrir el flujo**, y
ademas esa apertura tiene dos compuertas de proposito que hoy estan cerradas
(`aplicacion.activada: false` y `FIRMA_EXIGIR_ANEXO_NUBE` apagado): la de la tabla de conservacion
por decision del owner con el abogado (J8), y la del Anexo de Nube, que el codigo exige no
encender sin validar y reejecutar pruebas.

**Quien lo tiene.** Owner (el acto mismo, con su responsable y sus verificaciones), con el abogado
para la validacion de la compuerta de conservacion (J8) y la ratificacion externa (J6 y J7).

---

## Resumen de los 13 requisitos verificados

| ID | Requisito | Estado | Que falta, en una linea |
|---|---|---|---|
| 6.11 | Ejecutar la bateria completa de pruebas del servicio | **CERRADO** | Nada: la suite esta vinculada al commit `e4dd5f31` y se reprodujo desde un clon limpio de ese commit (2 665 / 2 663 / 0 / 2, exit 0, conjunto de nombres de prueba identico y clon byte a byte igual al arbol del owner). La corrida del 12-nov por la noche da **2 684 / 2 682 / 0 / 2**: los +14 posteriores a ese commit son las pruebas de la compuerta de conservacion (C1 a C4 y el marcador de pendiente), las del generador de los candidatos de la v1.4 y el guard de ASCII puro (que exige que los dos programas de la v1.4 no tengan ni un byte sobre 127, ni BOM, ni CRLF). |
| 7.1 | Confirmar la version exacta del codigo que se va a desplegar | **PARCIALMENTE** | El arbol desplegado se puede identificar por hash, pero es mixto (codigo de la punta, dependencias previas al 1051) y no hay commit candidato fijado para el proximo despliegue. |
| 7.3 | Ejecutar las migraciones de base de datos necesarias | **CERRADO** | Nada: 61 de 61 aplicadas, 1:1 con el repo, incluidas la 060, la 061 y la 062. |
| 7.4 | Comprobar que las migraciones se aplicaron correctamente | **CERRADO** | Nada: tablas, 15 columnas de contrafirma, 36 disparadores append-only, `integrity_check` ok y rutas 401 y no 404. |
| 7.5 | Verificar el estado de la base de datos y sus respaldos | **PENDIENTE** | Los cuatro actos del P8 aun no estan en ningun respaldo (el ultimo es del 11-nov 22:00), no hay copia off-site y la prueba de restauracion mensual nunca se ha ejecutado. |
| 7.6 | Comprobar los permisos de archivos y directorios | **PENDIENTE** | `app/` y `app/src/` siguen en 777 y 236 archivos son escribibles por cualquiera: falta el paso 2b del runbook (una linea de `chmod`, con root). |
| 7.7 | Comprobar la configuracion de seguridad del servicio | **PENDIENTE** | Produccion corre `proxy-addr` 2.0.7 (critica) y `nodemailer`/`zod` (altas) porque el 1051 no esta desplegado; ademas Node 20 (el owner decidio 22) y disco sin cifrar. |
| 7.8 | Verificar que no haya credenciales expuestas | **CERRADO** | Nada: los cuatro archivos de secreto son 600, la cuenta de verificacion no lee ninguno y los barridos de secretos (repo y arbol desplegado) estan limpios. |
| 7.9 | Verificar los registros y mecanismos de auditoria | **CERRADO** | Nada: 55 eventos de bitacora, 36 disparadores append-only y el rastro completo de los cuatro actos del P8. |
| 7.11 | Ejecutar pruebas controladas de extremo a extremo | **PENDIENTE** | El ultimo flujo electronico completo es del 6-nov: falta una corrida contra el codigo de hoy, con limpieza del rastro y acta. |
| 7.12 | Verificar la version y las migraciones en el servidor real | **PARCIALMENTE** | Las migraciones si estan verificadas en el servidor real; la version no se puede leer del servicio ni identificar con un commit unico. |
| 7.13 | Registrar el resultado de la comprobacion del servidor | **CERRADO** | Nada: el resultado quedo como acta en `MIGRACION-SERVIDOR-FIRMA.md` §5.1.4, con las actas `acta-comprobacion-servidor-2026-11-12.md` y `acta-despliegue-2026-11-12.md`. |
| 7.15 | Autorizar expresamente la activacion del flujo | **PENDIENTE** | No existe el acto expreso del owner que autorice abrir el flujo a empresas reales (T8); lo que hay es la autorizacion de publicar el Acuerdo v1.6 y los actos del P8 sobre la empresa de prueba. |

**Conteo de esta seccion: 6 CERRADO · 2 PARCIALMENTE · 5 PENDIENTE.**

> El 6.11 paso de PARCIALMENTE a **CERRADO** cuando la ronda se commiteo (`e4dd5f31`) y se pudo
> correr la suite **desde un clon limpio de ese commit**. Antes era el unico requisito de esta
> seccion que faltaba por el vinculo al commit.

---

## Conclusion: que bloquea de verdad la apertura a empresas reales

**Lo que NO bloquea, aunque parezca que si.** El canonico del 30-oct-era una foto de un sistema que
no existia. Hoy el servicio esta arriba y sano (`active`, `NRestarts=0`, arrancado el 12-nov a las
09:30:23, `/health` con `db: ok` y `smtp: configured`), las migraciones estan aplicadas y
comprobadas una a una, la bitacora y sus disparadores funcionan, los dos instrumentos del piloto
estan suscritos **y contrafirmados** con sus actas y sus huellas, las dos compuertas tecnicas
(`publicacion` y `primera_firma`) dan **40 items `ok` y 0 bloqueantes**, y no hay ninguna credencial
expuesta. **La parte tecnica de "abrir a una empresa real" ya esta hecha.**

**Lo que si bloquea, y son cuatro cosas concretas.** (1) **El respaldo de hoy (12-nov 22:00) tiene
que correr y verificarse**: hasta ese momento, la evidencia de los cuatro actos del P8 -los actos
que el propio expediente declara ejecutados- **esta en una sola copia de la base, sin respaldo**;
un fallo de disco hasta las 22:00 los pierde, y el plan de continuidad declara un RPO de 24 horas
que hoy no se cumple para esos datos. (2) **Los permisos 777 del arbol desplegado**: no es
estetica, es que una cuenta local cualquiera puede reescribir el codigo que despues corre como
`kairfirma`; es la unica observacion que el abogado marco como bloqueante el 31-oct y que cuatro
despliegues despues sigue igual, y se arregla con una linea de `chmod`. (3) **Desplegar el
paquete 1051**: mientras no se corra `npm ci --omit=dev`, el proceso ejecuta la version **critica**
de `proxy-addr` (2.0.7) y las dos **altas** de `nodemailer` y `zod`, aunque el repo ya las haya
corregido - o sea, el repo dice una cosa y el servidor hace otra, que es exactamente el tipo de
divergencia que este ejercicio pretende cerrar. (4) **El acto expreso del owner (T8)**: la
compuerta tecnica en verde **no es** la autorizacion de abrir, y las dos compuertas de proposito
(tabla de conservacion y exigencia del Anexo de Nube) siguen cerradas por decision, no por
olvido.

**Lo que es deuda, no bloqueo.** La copia **off-site** de los respaldos (brecha real de
continuidad, pero no impide firmar hoy: se resuelve en dias, no en semanas). La **prueba de
restauracion mensual**, que nunca ha corrido una vez y que el Anexo de Nube promete: hay que
ejecutarla una vez y registrar el acta, pero no impide la operacion. **Node 22** (el servidor
funciona en Node 20; el salto exige recompilar `better-sqlite3` y tiene su propio riesgo). El
**cifrado en reposo** del disco (decision del owner con el abogado, no un parche). Las **dos
vulnerabilidades altas** que exigen salto mayor de version (`nodemailer` 6.10.1 -> 10.5.0 y `zod`
3.25.76 -> 4.6.7): son cambios de API que hay que revisar en el codigo, no un parche. Y el
**caso real del buzon corporativo rechazado** (T6), que es el pendiente de 7.11 y el unico que
necesita una persona con un celular.

**El orden que propongo.** Respaldo de hoy primero (es automatico y ocurre solo a las 22:00), luego
el `chmod` y el despliegue del 1051 en la misma ventana de mantenimiento (los dos son del mismo
`sudo`), luego la corrida E2E controlada con su acta (ahi cae T6), luego el acta del despliegue en
la seccion 5.1 del runbook, y en paralelo la autorizacion expresa del owner y la validacion del
abogado sobre la compuerta de conservacion. Con eso, el servicio puede abrirse a una empresa real:
lo que falta no es codigo ni infraestructura, es **cerrar la divergencia entre lo que el repo
declara y lo que el servidor ejecuta**, y dejar por escrito el acto del owner.

---

*Documento generado por verificacion de solo lectura. No se modifico ningun archivo del
repositorio, ni el cuadro canonico, ni el `Historial.md`, ni el codigo del firma-service. No se
corrio la suite de pruebas. No se detuvo ni se reinicio el servicio de produccion. No se publico
ningun valor de secreto: de los archivos de credenciales solo se midieron permisos y duenos.*

# Decisión: el destino de la copia off-site de los respaldos (bloque M.7)

> **Fecha:** 2026-11-12. **Cierra:** el bloque **M.7** de
> `meta-para-abrir-a-empresas-reales-2026-11-12.md` («No hay copia de los respaldos fuera del
> servidor, y los actos del P8 aún no están en ninguno»).
>
> **Estado de este documento:** la decisión está tomada y el procedimiento está probado en su
> sintaxis. **M.7 sigue `PENDIENTE`** hasta que el owner ejecute la activación y quede **una copia
> real verificada en el destino**. Nada de lo que está aquí se hizo en producción: no se creó el
> bucket, no se instaló nada y no se copió ningún respaldo.
>
> **Todo lo que este documento afirma como número sale de una medición**, hecha el 2026-11-12 entre
> las 17:23 y las 17:35 (America/Bogota) por SSH contra `javier@192.168.1.11`, en modo de solo
> lectura. La sección «Qué NO prueba» dice qué quedó sin medir.

---

## Qué se midió

### La máquina que hay detrás de «el servidor»

| Dato | Valor medido | Cómo se midió |
|---|---|---|
| Tipo de máquina | **Portátil de consumo, no una VM** | `systemd-detect-virt` → `none`; `/sys/class/dmi/id/product_name` → `Aspire V5-121`; `sys_vendor` → `Acer`; `chassis_type` → `10` |
| Procesador / memoria | 2 CPU, 3,5 GiB de RAM | `nproc`, `free -h` |
| Red | `wlp2s0` = 192.168.1.11/24 (**Wi-Fi**), `tailscale0` = 100.119.81.74/32, puerta de enlace 192.168.1.1 | `ip -brief address`, `ip route` |
| Disco | 107 GB totales, 12 GB usados, **91 GB libres** (11 %); inodos: 4 % usados | `df -h`, `df -i` |
| Otros nodos en Tailscale | `desktop-27gu0po` (Windows, en línea) y `laptop-pss09anv` (Windows, **offline hace 8 días**) | `tailscale status` |
| Node | v20.20.2 en `/usr/bin/node`; **no hay nvm**; el servicio usa ruta absoluta: `ExecStart=/usr/bin/node src/server.js`; estado `active` | `node -v`, `which node`, `systemctl show kair-firma -p ExecStart` |
| Herramientas de transferencia | **`rsync` 3.2.7 sí**, `scp` sí, **`rclone` NO**; `apt` ofrece rclone 1.60.1 | `command -v`, `rsync --version`, `apt-cache policy rclone` |
| Salida a internet | TCP 443 **conecta** a `api.backblaze.com`, `s3.amazonaws.com` y `r2.cloudflarestorage.com`; sin proxy | `getent hosts`, `timeout 5 bash -c 'cat < /dev/null > /dev/tcp/HOST/443'` |
| Llaves SSH de `javier` | **Ninguna llave privada**: en `~/.ssh` solo `authorized_keys` y `known_hosts`; no hay `~/.ssh/config` | `ls -la ~/.ssh` |

> **Lo que esto decide:** no existe un «segundo servidor» al que copiarle. Los únicos otros equipos
> que aparecen en la red son un escritorio de Windows y un portátil apagado. Un destino por `rsync` o
> `scp` exige **comprar o levantar otra máquina** y mantenerla.

### Los respaldos que hay que copiar

| Dato | Valor medido |
|---|---|
| Ubicación | `/opt/kair-firma/backups` (mismo disco que la base) |
| Contenido | **52 archivos `.enc`**, 7 718 336 B en total (33 de base, 18 de storage, 1 manual) |
| Los dos más recientes | `firma-20261111-220001.sqlite.enc` (164 714 B) y `storage-20261111-220001.tar.gz.enc` (519 024 B), ambos con fecha de modificación 11-nov 22:00 |
| Tamaño de **un día** | 683 738 B (164 714 + 519 024) |
| Cifrado | GPG simétrico AES256 con `--passphrase-file`; la frase está en `/opt/kair-firma/backup.passphrase` (600 root) |
| Retención local | `deploy/backup-firma.sh` usa `RETENCION_DIAS=${KAIR_RETENCION_DIAS:-30}` y borra con `find … -mtime +$RETENCION_DIAS -delete` |

**Lo que no se pudo leer de la retención.** La copia de `backup-firma.sh` del servidor es
`750 root:root` y el `.env` es `600 root`: la cuenta `javier` no puede leer ninguno de los dos. La
retención de **30 días** está leída de la copia del repositorio (`deploy/backup-firma.sh`, 13 241 B,
el mismo tamaño que el del servidor); el valor efectivo en producción **no es verificable** desde esta
cuenta, porque el `.env` podría estar fijando `KAIR_RETENCION_DIAS`.

**La poda local, además, hoy no está podando.** El log del 11-nov dice «PODA RETENIDA: hay 5
firma(s) con deber legal de conservación (hold_legal=1)» y la base confirma **5 de 5** firmas con
`hold_legal = 1`. Es decir: la retención local efectiva es, por ahora, «mientras dure el hold», no
30 días.

### Los actos del P8

Medido en la base de producción, en **solo lectura** (`sqlite3 -readonly`, la base es legible por
`javier`):

Los cuatro actos del P8, medidos en la base de producción en **solo lectura**
(`sqlite3 -readonly`; la base es legible por `javier`):

| Acto | Marca de tiempo |
|---|---|
| Anexo de Nube **v1.3** suscrito por la Empresa (suscripción id 2) | `firmado_at` = `2026-11-12T15:38:27.990Z` |
| Anexo de Nube **v1.3** contrafirmado por K+AIR | `contrafirmado_at` = `2026-11-12T16:13:54.106Z` |
| Anexo de Encargo **2026-11-11** suscrito (suscripción id 2) | `firmado_at` = `2026-11-12T15:40:06.992Z` |
| Anexo de Encargo **2026-11-11** contrafirmado por K+AIR | `contrafirmado_at` = `2026-11-12T16:14:31.105Z` |

En la ficha de la Empresa (`gh_firma_empresas`, id 900829731) los mismos actos aparecen como
`anexo_nube_firmado_at = 2026-11-12T15:38:27.990Z`,
`anexo_nube_ejecutado_at = 2026-11-12T16:13:54.106Z` y
`anexo_encargo_suscrito_at = 2026-11-12T15:40:06.992Z`. El último evento de
`gh_firma_eventos` es del `2026-11-06T20:25:34.433Z` (55 eventos): los actos del P8 no viven en esa
tabla, viven en las de suscripciones.

El último respaldo es del **11-nov a las 22:00:02**
(`firma-20261111-220001.sqlite.enc`, sha256 `de14e3f4b3c94c32eb690ae9215c111cdc1b450c963726eac54bd5192ebde20a`,
según el log), o sea **anterior a los cuatro actos del 12-nov: no están en ningún respaldo**. El
respaldo del 12-nov a las 22:00 (que todavía no había corrido a la hora de medir) los incluye. Esto
es una **deducción** a partir de dos mediciones (la fecha del respaldo y la fecha de los actos): el
contenido del `.enc` no se puede abrir sin la frase, que es `600 root`.

### El estado de la copia off-site hoy

- **No existe** `/opt/kair-firma/backup-offsite.sh` ni `/opt/kair-firma/backup-offsite.conf` en el
  servidor: el script nunca se instaló.
- No existe `offsite.log`: la copia nunca se ha corrido.
- Los crons del servidor son `/etc/cron.d/kair-firma-backup` (0 22), `-health` (*/5), `-purga`
  (0 3) y `-restauracion` (0 4 1). No hay entrada de copia off-site.

---

## La decisión

> **El destino de la copia off-site es un bucket S3-compatible, con `rclone`, y una retención de
> 30 días. Recomendado: Backblaze B2.**
>
> `METODO=rclone` · `REMOTO=b2-kair:kair-firma-backups` · `RETENCION_DIAS=30`

### Por qué esta y no otra

1. **Es el único destino que existe hoy sin comprar hardware.** No hay un segundo servidor
   (medido: el «servidor» es un portátil Acer en Wi-Fi de la oficina, y los otros dos equipos de la
   red son un escritorio y un portátil apagado). Un bucket se abre en una consola y listo.
2. **El destino no ve texto claro.** Viajan los `.enc`, que ya van cifrados con GPG AES256. La
   frase **no** sube: vive en `/opt/kair-firma/backup.passphrase` (600 root) y no se envía en
   ningún comando. El proveedor ve texto cifrado, no datos de empresas.
3. **No es el proveedor de correo.** El canal de correo del servicio es Google (Workspace/Gmail; el
   CDPA se aceptó el 10-nov). Backblaze es otra cuenta, en otro proveedor: comprometer la cuenta de
   Google no se lleva los respaldos. Este era un criterio de la decisión y es la razón por la que
   **no** se usa Google Drive — aunque sea la sugerencia que dejó el propio
   `backup-firma.sh` en su línea comentada (`# rclone copy "$BACKUPS" gdrive:…`, `backup-firma.sh:288`).
4. **El volumen es ridículo para lo que cuesta.** Medido: 683 738 B por día. Son **20,5 MB** a 30
   días, **250 MB** a un año. La capa gratuita de B2 son los primeros **10 GB** (unas 14 600
   jornadas, del orden de 40 años de este volumen) y la salida es gratis hasta tres veces lo
   almacenado. La poda del destino son unas 2 llamadas de borrado al día, de las 2 500 gratuitas al
   día.
5. **No deja material de llaves en la máquina que se quiere respaldar.** Con `rsync` o `scp`
   habría que dejar en el portátil una llave privada SSH sin passphrase (o un `ssh-agent`) para que
   el cron pudiera copiar sin intervención: justo el activo que un atacante buscaría en la máquina
   cuya pérdida estamos cubriendo.

### Las dos decisiones de configuración que acompañan al destino

- **`RETENCION_DIAS = 30`.** Es exactamente la retención nominal local, así que **el destino nunca
  conserva más que la copia local**. (Hoy la local no poda por los *holds*, así que el margen real
  es mayor; ver el riesgo en «Qué NO prueba».) Si el owner quiere más aire, 90 días son 58,7 MB y
  siguen siendo gratis: basta cambiar el número en `/opt/kair-firma/backup-offsite.conf` y dejar que
  corra el cron (o correr el script a mano).
- **El `rclone.conf` vive en `/etc/rclone/rclone.conf`, modo 600 root**, y no en
  `/opt/kair-firma/`. Razón: el servicio corre como el usuario `kairfirma` y **no debe poder leer la
  clave del bucket**. Por la misma razón, el cron fija `RCLONE_CONFIG` de forma explícita: el
  script llama a `rclone` sin `--config`, y sin esa variable rclone buscaría el archivo en
  `$HOME/.config/rclone/rclone.conf`, que bajo cron no está garantizado.

---

## Alternativas descartadas

| Alternativa | Por qué se descartó |
|---|---|
| **`rsync` a un segundo servidor** | No hay segundo servidor (medido). Exigiría comprar o levantar otra máquina, mantenerla actualizada y con parche de seguridad, y dejarla con un copia-cron. Además exige una llave SSH sin passphrase en el portátil que se quiere respaldar. `rsync` sí está instalado (3.2.7), pero eso no compensa lo demás. |
| **`scp` a un segundo servidor** | Lo mismo, y peor: `scp` no verifica nada por sí mismo (la verificación del hash la hace el script después, pero solo si el archivo llegó entero), no reanuda una transferencia parcial y reescribe el archivo completo cada vez. Es la opción de último recurso dentro de `rsync`. |
| **`rclone` a Google Drive (el `gdrive` que sugiere el comentario de `backup-firma.sh:288`)** | Es el **mismo proveedor que el correo**. Una sola cuenta comprometida se lleva el correo y los respaldos: exactamente lo que este bloque quiere evitar. Además el remoto de Google es de OAuth y es incómodo de correr desatendido como root. |
| **Un segundo disco o un NAS en la red de la oficina** | Mismo dominio de falla: si se pierde el equipo o se cae la oficina, se pierden los dos. Y no existe ninguno instalado (no hay `samba`, ni `nfs`, ni discos montados en `/mnt` ni `/media`). |
| **El escritorio de Windows del owner (vía Tailscale)** | No es un servidor: no está encendido 24/7, no tiene SSH, y una copia que depende de que el dueño tenga el equipo prendido no es un respaldo. |
| **Subir el respaldo al mismo servidor, a otro directorio o a otro disco** | Es una segunda copia, no un respaldo: el disco es el mismo y la máquina es la misma. El propio script dice esto en su encabezado. |

> **Nota sobre el método, no sobre el destino:** las tres primeras filas son *métodos* del mismo
> script. Lo que la decisión fija es el **destino** (un bucket, no otro equipo) y, por lo tanto, el
> método (`rclone`). Si el owner prefiere `rsync` a una máquina propia, el script lo soporta tal
> cual: la rama de `rsync`/`scp` **no se tocó** en este trabajo.

---

## Cómo se activa (comando literal)

> Todos los comandos de esta sección se corren **en el servidor**, con la contraseña de `sudo` del
> owner. Los que llevan `scp` se corren **desde la estación de trabajo** del owner.
>
> **Antes de empezar, dos actos que solo puede hacer el owner** (credenciales que el equipo no
> tiene): abrir la cuenta en el proveedor y crear el bucket con su llave. Del panel del proveedor
> salen cuatro datos: **nombre del bucket**, **región**, **endpoint S3** e **ID y clave de
> acceso**. La clave **no** se escribe en el repositorio, ni en un chat, ni en este documento.

### 1. Instalar `rclone`

```bash
sudo apt-get update
sudo apt-get install -y rclone
rclone version | head -1
```

Medido el 2026-11-12: `apt` ofrece **1.60.1** en `noble-updates/universe`; `rclone` **no** estaba
instalado. La versión de `apt` sirve para S3 y para B2, y es la que se ensayó (§ «Qué evidencia
queda»).

### 2. Subir el script al servidor y verificar su huella

Desde la raíz del repositorio, en la estación de trabajo del owner:

```bash
scp "sgsst-electron-app/firma-service/deploy/backup-offsite.sh" \
    javier@192.168.1.11:/tmp/backup-offsite.sh
```

Y en el servidor (fuera de `sudo`, solo lectura):

```bash
sha256sum /tmp/backup-offsite.sh
```

La huella del archivo del repositorio con el parche aplicado es
**`fda29ae64d13d4bcb5853eb19b850b4fb7b0a5d30efe022d97db6141db2d477f`** (13 740 B, LF, sin BOM,
ASCII puro). Si la suma que sale en el servidor no es esa, no se instala: se sube otra vez.

Instalación:

```bash
sudo install -m 700 -o root -g root /tmp/backup-offsite.sh /opt/kair-firma/backup-offsite.sh
sudo ls -l /opt/kair-firma/backup-offsite.sh
```

### 3. Crear el `rclone.conf` (600 root, fuera de `/opt/kair-firma`)

```bash
sudo install -d -m 755 /etc/rclone
sudo install -m 600 -o root -g root /dev/null /etc/rclone/rclone.conf

sudo tee /etc/rclone/rclone.conf >/dev/null <<'EOF'
[b2-kair]
type = s3
provider = Other
access_key_id = <ID_DE_LLAVE_DE_ACCESO>
secret_access_key = <CLAVE_DE_ACCESO>
endpoint = <ENDPOINT_S3_DEL_PROVEEDOR>
region = <REGION_DEL_BUCKET>
acl = private
EOF

sudo chmod 600 /etc/rclone/rclone.conf
sudo ls -l /etc/rclone/rclone.conf
```

Qué es cada campo, y de dónde sale:

- `b2-kair` es el **nombre del remoto**. Es el que va en `REMOTO=` del paso 4.
- `type = s3` con `provider = Other` es la forma **portable**: sirve para Backblaze B2, para
  Cloudflare R2 y para cualquier S3-compatible. Para B2, el `endpoint` y la `region` son los que
  muestra el panel (por ejemplo, un endpoint `s3.us-west-004.backblazestorage.com` con región
  `us-west-004`); **los valores exactos se copian de la consola del proveedor**, no de memoria.
- Alternativa con el backend nativo de B2 (no necesita región): `type = b2`, con `account`,
  `key` y `secret`.
- `acl = private`: el bucket no se hace público.

Comprobación (no escribe nada). **Con `RCLONE_CONFIG` explícito**, porque sin esa variable `rclone`
busca su archivo en el `$HOME` de quien lo ejecuta, y bajo `sudo` ese `$HOME` no es el mismo que
el del cron:

```bash
sudo env RCLONE_CONFIG=/etc/rclone/rclone.conf rclone config file   # -> /etc/rclone/rclone.conf
sudo env RCLONE_CONFIG=/etc/rclone/rclone.conf rclone listremotes   # -> b2-kair:
sudo env RCLONE_CONFIG=/etc/rclone/rclone.conf rclone lsd b2-kair:  # -> el bucket recien creado
```

### 4. Crear la configuración del respaldo (600 root)

```bash
sudo install -m 600 -o root -g root /dev/null /opt/kair-firma/backup-offsite.conf

sudo tee /opt/kair-firma/backup-offsite.conf >/dev/null <<'EOF'
METODO=rclone
REMOTO=b2-kair:kair-firma-backups
RETENCION_DIAS=30
EOF

sudo chmod 600 /opt/kair-firma/backup-offsite.conf
```

> ⚠️ **El formato de `REMOTO` con `rclone` es `<NOMBRE-DEL-REMOTO>:<RUTA>`.** El nombre es el del
> remoto en el `rclone.conf` (`b2-kair`), **no** la palabra `rclone`. Si se escribe
> `rclone:mi-bucket/kair`, `rclone` busca un remoto que se llame «rclone», no lo encuentra, y la
> copia falla con el código 1 sin más explicación. Este error fue encontrado y corregido durante
> el ensayo (el encabezado del script tenía ese ejemplo engañoso).

### 5. La primera corrida, a mano

```bash
# 5a. Que haría, sin hacer nada:
sudo env RCLONE_CONFIG=/etc/rclone/rclone.conf bash /opt/kair-firma/backup-offsite.sh --estado

# 5b. Copiar y verificar:
sudo env RCLONE_CONFIG=/etc/rclone/rclone.conf bash /opt/kair-firma/backup-offsite.sh

# 5c. Comprobar que el destino tiene lo mismo:
sudo env RCLONE_CONFIG=/etc/rclone/rclone.conf bash /opt/kair-firma/backup-offsite.sh --verificar
```

**Una corrida buena se ve así** (texto tomado del ensayo, con la maqueta; los hashes cambian en cada
copia real):

```
COPIA OFFSITE: metodo rclone hacia b2-kair:kair-firma-backups (retencion 30 dias).
  OK firma-20261111-220001.sqlite.enc (164714 B, sha256 7913374f…) copiado y verificado.
  OK storage-20261111-220001.tar.gz.enc (519024 B, sha256 93bc20ef…) copiado y verificado.
  Poda del destino: copias con mas de 30 dias (lo que la retencion local permite).
COPIA OFFSITE: 2 archivo(s) copiados y verificados.
```

```
firma-20261111-220001.sqlite.enc: coincide (sha256 7913374f…).
storage-20261111-220001.tar.gz.enc: coincide (sha256 93bc20ef…).
VERIFICACION OFFSITE: todo coincide.
```

El código de salida de 5b y de 5c debe ser **0**. Si 5b dice «no se copió NADA» o «HASH
DISTINTO», **la copia no sirve** y la copia local no se tocó: eso está funcionando como debe.

Lo que **no** se debe hacer: no borrar ni mover el `.enc` local para «probar» la restauración. El
script nunca borra la copia local, y la prueba de restauración del paso 8 trabaja sobre una copia
**descargada del destino** en `/tmp`: no hay que tocar nada del respaldo local.

### 6. Dejarlo diario (siguiendo la convención del servidor: `/etc/cron.d`)

```bash
sudo tee /etc/cron.d/kair-firma-offsite >/dev/null <<'EOF'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
RCLONE_CONFIG=/etc/rclone/rclone.conf

30 22 * * * root /opt/kair-firma/backup-offsite.sh >> /opt/kair-firma/logs/offsite-cron.log 2>&1
EOF

sudo chmod 644 /etc/cron.d/kair-firma-offsite
sudo cat /etc/cron.d/kair-firma-offsite
```

- **22:30, no 22:00:** el respaldo local corre a las 22:00 (`/etc/cron.d/kair-firma-backup`), así
  que la copia sale media hora después y se lleva la pareja del día, no la de ayer.
- **`RCLONE_CONFIG` va explícito:** el script llama a `rclone` sin `--config`, y sin esa variable
  `rclone` busca su archivo en el `$HOME` de quien lo ejecuta, que bajo cron no es el mismo `$HOME`
  que en una terminal. Sin el archivo correcto, la copia falla con el código 1 (en el ensayo, con
  un remoto mal nombrado, el mensaje del script fue «COPIA FALLIDA … (codigo 1)»).
- **El `>>` del cron va a un archivo distinto del log del script.** El script ya escribe cada línea
  en `/opt/kair-firma/backups/offsite.log`; si el cron redirigiera al mismo archivo, cada línea
  saldría duplicada. `logs/offsite-cron.log` deja además la salida de cron por si el script no
  logra escribir su log.

### 7. Comprobar que el cron de verdad dispara

Al día siguiente, después de las 22:30:

```bash
sudo tail -5 /opt/kair-firma/backups/offsite.log
```

Debe haber una línea «OK … copiado y verificado» con la fecha de ese día. Si no la hay, mirar
`sudo tail -20 /opt/kair-firma/logs/offsite-cron.log`.

### 8. (Recomendado) Probar que la copia **se puede restaurar**

Es el punto que el propio runbook del repo marca como pendiente: «La restauración desde la copia
off-site no está probada». La prueba, con los comandos que usa `backup-firma.sh` al revés:

```bash
sudo install -d -m 700 /tmp/restore-test

sudo env RCLONE_CONFIG=/etc/rclone/rclone.conf rclone copyto \
  b2-kair:kair-firma-backups/firma-20261111-220001.sqlite.enc \
  /tmp/restore-test/firma-20261111-220001.sqlite.enc

sudo gpg --batch --yes --no-tty --quiet --decrypt --pinentry-mode loopback \
  --passphrase-file /opt/kair-firma/backup.passphrase \
  --output /tmp/restore-test/firma.sqlite \
  /tmp/restore-test/firma-20261111-220001.sqlite.enc

sudo sqlite3 -readonly /tmp/restore-test/firma.sqlite \
  "pragma integrity_check; select count(*) from gh_firma_empresas;"
```

Lo que hay que ver: `integrity_check` devuelve **`ok`** y el conteo de empresas es el mismo que el
de la base de producción. Esta prueba **lee** la copia; no la borra y no toca la base de producción.

> El nombre del objeto es el de la copia que se hizo (lleva la fecha y la hora:
> `firma-AAAAmmdd-HHMMSS.sqlite.enc`). El nombre exacto de la última copia está en
> `/opt/kair-firma/backups/offsite.log`, en la línea «OK …».

> **Y una cosa que no es opcional: la frase.** Si el servidor se pierde y con él
> `/opt/kair-firma/backup.passphrase`, **todas las copias del bucket quedan inservibles**: son
> texto cifrado y la frase estaba en la misma máquina. La frase tiene que existir **en otro sitio**
> (una copia sellada en poder del owner, o en un gestor de contraseñas). Eso no lo hace ningún
> script: es un acto del owner.

---

## Qué evidencia queda

### Lo que este trabajo ya dejó comprobado (ensayo del 2026-11-12)

El ensayo corrió en el servidor, **aislado en `/tmp/kair-m7-ensayo*`**, con un remoto de `rclone`
tipo `alias` apuntando a un directorio local. **No se tocó `/opt/kair-firma`**: el script se copió
con `APP` redireccionado a la maqueta. `rclone` se descargó de `downloads.rclone.org` y **se verificó
su SHA-256 contra el `SHA256SUMS` oficial** antes de usarlo.

| Comprobación | Resultado medido |
|---|---|
| `bash -n` del script parcheado | código 0 |
| `rclone hash` en 1.60.1 y en 1.76.0 | **`Error: unknown command "hash" for "rclone"`** — el comando no existe |
| Script **original**, con `METODO=rclone` | copia los archivos, pero **no puede verificar ninguno**: «NO SE PUDO VERIFICAR … el hash del destino salió vacío», salida 1, «no se copió NADA» |
| Script **parcheado**, con `METODO=rclone` | «OK … copiado y verificado» en los dos archivos, salida 0 |
| `--verificar` con el destino sano | «VERIFICACION OFFSITE: todo coincide», salida 0 |
| `--verificar` con el destino **corrupto** (se le sumó «corrupto» al objeto) | «HASH DISTINTO», salida 1 — **la comparación detecta la corrupción** |
| Poda del destino | Borra **solo** el objeto de más de 30 días del destino; **la copia local sigue completa** |
| Selector de archivos | No se llevó el archivo trampa `firma-pre-despliegue-20261026-180335.sqlite.enc` ni el respaldo viejo del 10-nov: se llevó el del 11-nov |
| Con **rclone 1.60.1** (la versión de `apt`) | Mismo resultado: copia verificada y `--verificar` con «todo coincide» |
| Con **rclone 1.76.0** (la última) | Mismo resultado |

**Segundo ensayo: la sintaxis de los comandos de activación** (también en `/tmp`, con las rutas
del sandbox en vez de las de producción):

| Se comprobó | Resultado |
|---|---|
| `install -d` + `install -m 600` + `tee` con heredoc para el `rclone.conf` | El archivo queda en 600 y el heredoc **no interpola**: los `<ENDPOINT_S3_DEL_PROVEEDOR>` quedan literales |
| Lo mismo para `/opt/kair-firma/backup-offsite.conf` | Queda en 600 con las tres líneas esperadas |
| El archivo de cron generado con `tee` | 644, termina en salto de línea, y la línea de trabajo tiene los 6 campos de `/etc/cron.d` (`30 22 * * * root`) |
| La corrida completa con el `rclone.conf` y el `backup-offsite.conf` **tal como quedarían en producción** (remoto `b2-kair`, `REMOTO=b2-kair:kair-firma-backups`, `RETENCION_DIAS=30`) | «OK … copiado y verificado» en los dos archivos, salida 0; `--verificar` → «todo coincide», salida 0; los dos objetos quedan en el destino |
| El directorio de logs que usa la redirección del cron | `/opt/kair-firma/logs` existe (`drwxr-xr-x root root`) |

### Lo que debe dejar el owner al activar

| Evidencia | Dónde queda |
|---|---|
| La salida de `--estado`, de la copia y de `--verificar` | En la consola; copiarla al acta |
| La primera copia verificada | `b2-kair:kair-firma-backups/`, con dos objetos `.enc` |
| La corrida nocturna | `/opt/kair-firma/backups/offsite.log` (una línea «OK …» por noche) |
| La salida de cron | `/opt/kair-firma/logs/offsite-cron.log` |
| La prueba de restauración (§ 8) | La salida de `integrity_check` |
| La huella del script instalado | `sha256sum /opt/kair-firma/backup-offsite.sh` → `fda29ae6…d477f` |

---

## Qué NO prueba

- **El ensayo no usó un bucket real.** Se usó un remoto de `rclone` tipo `alias` sobre un
  directorio local. Prueba la **lógica del script** (copia, hash, poda, selector), **no** las
  credenciales, los permisos, la región ni el endpoint de ningún proveedor.
- **Nada está probado contra un bucket hasta que haya una copia real verificada.** Hasta ese
  momento, M.7 sigue abierto. La primera corrida real es la que decide si el destino sirve.
- **No se leyó el contenido de ningún `.enc`.** Son `600 root` y la frase es `600 root`. Que los
  actos del P8 estén (o no) en un respaldo es una **deducción** de la fecha del respaldo y la fecha
  de los actos, no una lectura del archivo descifrado.
- **La retención local real no se pudo verificar.** Los 30 días salen de la copia del script en el
  repositorio (mismo tamaño en bytes que la del servidor). El valor efectivo en producción depende
  de `KAIR_RETENCION_DIAS` en el `.env`, que `javier` no puede leer.
- **La poda del destino no conoce los *holds*.** El destino borra por antigüedad (30 días) y la
  copia local se respeta por `hold_legal`. Si una firma con deber legal de conservación se firmara
  hoy, su respaldo local nunca se podaría, pero **su copia en el bucket sí se borraría a los 30
  días**. Para tapar eso hay dos salidas: subir `RETENCION_DIAS` a un valor que cubra el horizonte
  de conservación, o hacer que la poda del destino respete el hold (eso ya es un cambio de código
  aparte, fuera de este bloque).
- **No se probó la restauración desde el destino** (el paso 8 la propone, pero hasta que el owner la
  corra no hay evidencia de que una copia en el bucket sirva para restaurar).
- **No se probó el disparo real del cron.** Lo que se comprobó es la sintaxis del archivo de cron y
  el comportamiento del script; que el cron dispare a las 22:30 se ve en el log al día siguiente.
- **El destino elegido depende de una cuenta y una tarjeta del owner.** Si el owner no puede (o no
  quiere) abrir una cuenta en un proveedor de almacenamiento, la decisión no se activa y el
  bloque sigue abierto con la alternativa de `rsync`/`scp` a una máquina que habría que comprar.
- **Un respaldo fuera del servidor no protege contra la pérdida de la frase.** Es el punto del
  § 8: la copia es inservible sin `/opt/kair-firma/backup.passphrase`, que hoy está en la misma
  máquina.

---

## Lo que cambió en el repositorio con este trabajo

Un solo archivo:

- `sgsst-electron-app/firma-service/deploy/backup-offsite.sh`
  - **Rama `rclone` de la verificación del hash** (en `copiar_y_verificar` y en `modo_verificar`):
    el hash del destino se calcula **descargando el objeto y hasheándolo con SHA-256**
    (`rclone cat … | sha256sum`), en lugar de `rclone hash`. Con el código anterior, el método
    `rclone` **nunca podía dar una copia por buena**: `rclone hash` no es un comando de `rclone`
    (medido en 1.60.1 y 1.76.0) y, aunque lo fuera, el hash nativo de S3 es el MD5 (ETag), que no
    puede coincidir con el SHA-256 local.
  - **Encabezado:** se documenta el formato real de `REMOTO` con `rclone`
    (`<NOMBRE-DEL-REMOTO>:<RUTA>`), porque el ejemplo anterior (`rclone:mi-bucket/kair`) hacía que
    `rclone` buscara un remoto inexistente y la copia fallara con el código 1.
  - Las ramas `rsync` y `scp` **no se tocaron**. El resto del script tampoco.

El archivo sigue en **LF**, **sin BOM** y en **ASCII puro** (13 740 B).

### Qué se dejó en el servidor (y no se borró)

Las reglas de esta sesión prohíben borrar nada del servidor, así que los ensayos quedaron en `/tmp`.
No son nada de producción y se pueden quitar con una sola orden (o se quedan, que tampoco estorban:
el disco tiene 91 GB libres):

```bash
sudo rm -rf /tmp/kair-m7-ensayo /tmp/kair-m7-ensayo2 /tmp/kair-m7-ensayo3 /tmp/kair-m7-activacion
sudo rm -f /tmp/kair-m7-*.sh
```

Lo que hay ahí: los scripts de medición (`/tmp/kair-m7-medir*.sh`, `-p8.sh`, `-diag.sh`,
`-ensayo*.sh`, `-activacion.sh`), las dos versiones del script (`/tmp/kair-m7-original.sh` y
`/tmp/kair-m7-parcheado.sh`) y los cuatro directorios del ensayo, que suman unos 386 MB (casi todo
son dos copias de los zip de `rclone` y sus binarios). **En `/opt/kair-firma` no se creó, no se
modificó y no se borró nada**: ni `backup-offsite.sh`, ni `backup-offsite.conf`, ni `offsite.log`, ni
los respaldos.

# Sello de version, rotacion de logs y alerta por correo

Este documento explica **como instalar** las tres piezas que cierran M.24
(sello de version), M.23 (rotacion, retencion y acceso al log) y M.21 (la
alerta que hoy no existe cuando el tunel se cae).

Todo lo que hay aqui se instala **en el servidor** (`kair-server`), con
`sudo`. En el repositorio no se cambia nada mas: los cuatro archivos de este
paquete ya estan.

| Que | De donde sale | Donde queda en el servidor |
|---|---|---|
| Sello de version | `scripts/generar-sello-version.js` | `/opt/kair-firma/app/VERSION` |
| Rotacion y retencion | `deploy/logrotate-kair-firma.conf` | `/etc/logrotate.d/kair-firma` |
| Alerta por correo | `deploy/health-check.sh` | `/opt/kair-firma/health-check.sh` |
| Permisos del log | estos comandos | `/opt/kair-firma/logs` |

---

## 1. El SELLO DE VERSION (M.24)

### Que es y por que

El `/health` del servicio anunciaba una version FIJA (`compatible-0.1.189`):
un valor que no depende del codigo que esta corriendo. Con el arbol
desplegado sin `.git` y con un `package.json` que dice `"version": "0.1.0"`,
no habia forma de saber **que codigo corre**. La medicion del 12-nov-2026 lo
dio por partida doble: el arbol desplegado era **MIXTO** (5 archivos de
codigo coincidian con el repo en `264d08df`, pero `package.json` y
`package-lock.json` NO: el lock fijaba `express 4.22.2`, `proxy-addr 2.0.7` y
`qs 6.15.3`, las anteriores al paquete 1051).

El sello resuelve las dos cosas:

1. **El servicio anuncia su version.** El `/health` publica un campo nuevo,
   `version_sello`, con el commit, la fecha y un hash corto del arbol. Es
   ADITIVO: `kair_version` queda EXACTO como estaba (el gate y los tests
   dependen de ese valor).
2. **El despliegue deja esa misma version escrita.** El archivo `VERSION`
   viaja en el paquete y queda en `/opt/kair-firma/app/VERSION`, al lado del
   codigo que anuncia. El disco y el `/health` dicen lo mismo.

### Que es el hash del arbol (y por que NO es el hash de git)

El hash es el SHA-256 del CONTENIDO de los archivos que viajan en el
despliegue (`src`, `web`, `scripts`, `config`, `package.json`,
`package-lock.json`, `legal-readiness.json`). Esa distincion es la que
importa: el arbol desplegado era mixto porque el **lock** viajo con
versiones viejas, y un hash de contenido lo detecta; un hash del arbol de
git no.

Ademas, el hash se puede **recalcular en el servidor** y comparar con el
del sello: si no coinciden, lo que corre no es lo que se sello.

### Generar el sello (en el PC, antes de empaquetar)

El sello se genera desde el **commit que se va a desplegar**, no desde el
working tree: lo que se sella es lo que se empaqueta.

```powershell
# EN EL PC, desde la raiz del repo:
cd 'C:\Proyectos Programación\SG-SST-E'
$svc = 'sgsst-electron-app/firma-service'
$commit = (git rev-parse HEAD).Trim()
Write-Output "Commit a sellar: $commit"

# El sello se escribe en la raiz del servicio. Corre SIN RED y SIN hacer
# falta .git (el commit se lo pasamos por parametro).
node "$svc/scripts/generar-sello-version.js" --commit="$commit"
```

Salida esperada:

```
Sello escrito en ...\sgsst-electron-app\firma-service\VERSION
  commit: 264d08df...
  fecha : 2026-11-12T...
  arbol : dcc6a12e60e3 (255 archivos)
```

El archivo `VERSION` queda asi:

```json
{
  "servicio": "kair-firma-service",
  "commit": "264d08df...",
  "commit_corto": "264d08df",
  "fecha": "2026-11-12T20:00:00Z",
  "arbol": "dcc6a12e60e3",
  "arbol_metodo": "sha256-archivos",
  "archivos": 255
}
```

**Idempotente:** si se corre dos veces con el mismo commit, el archivo no se
reescribe (no cambia ni la fecha de modificacion) y el script lo dice
(`Sello sin cambios`). La fecha del sello es la del COMMIT, no la del
momento de correr el script: por eso el sello es una funcion del commit y
no depende de cuando se corrio.

### Que tiene que viajar en el paquete

El archivo `VERSION` tiene que ir en el `git archive` del despliegue, al
lado de `legal-readiness.json`. En `docs/MIGRACION-SERVIDOR-FIRMA.md` Seccion 5.1
(el comando `git archive` que arma el tar) hay que **agregar una linea**:

```powershell
git archive --format=tar.gz --output="$env:TEMP\kair-deploy\svc.tar.gz" HEAD `
  "$svc/src" "$svc/web" "$svc/scripts" "$svc/config" "$svc/package.json" "$svc/package-lock.json" "$svc/legal-readiness.json" "$svc/VERSION"
```

Sin esa linea, el sello se queda en el PC y el servidor no tiene nada que
anunciar: el `/health` responderia `version_sello.estado = "ausente"`, que
es exactamente lo que esta designed para decir (no inventa una version),
pero no sirve de nada.

> **Ojo:** `VERSION` es un archivo GENERADO, no versionado. Si se commitea,
> el hash del arbol no cambia (los archivos del hash no incluyen el
> `VERSION` mismo), pero el `commit` que announce seria el del commit
> anterior. Por eso se genera en el momento del despliegue y no se
> commitea. Si se commitea por error, se regenera antes de empaquetar.

### Verificar en el servidor (despues del despliegue)

```bash
# 1. El archivo esta ahi y el servicio lo anuncia:
sudo cat /opt/kair-firma/app/VERSION
curl -sS https://firma.kair.fyi/health | python3 -m json.tool

# Lo que tiene que aparecer en la respuesta:
#   "kair_version": "compatible-0.1.189"     <-- NO cambia (el gate depende)
#   "version_sello": {
#     "estado": "presente",
#     "commit": "264d08df...",
#     "commit_corto": "264d08df",
#     "fecha": "2026-11-12T20:00:00Z",
#     "arbol": "dcc6a12e60e3"
#   }

# 2. El hash del arbol en el servidor CORRESPONDE al sello:
cd /opt/kair-firma/app
sudo -u kairfirma node scripts/generar-sello-version.js --comprobar
#   OK: el arbol corresponde al sello (dcc6a12e60e3, 255 archivos).
#   (codigo 0 = coinciden; codigo 2 = NO coinciden: lo que corre no es
#    lo que se sello -> hay que redeployar)

# 3. Y que el commit del sello sea el commit desplegado:
sudo cat /opt/kair-firma/app/VERSION | grep '"commit"'
```

---

## 2. LA ROTACION Y LA RETENCION DE LOS LOGS (M.23)

### Que se midio el 12-nov-2026

- **No habia `logrotate` para `kair-firma`:** `ls /etc/logrotate.d/ | grep -i
  kair` no devolvia nada.
- **El log crecia sin rotar:** `/opt/kair-firma/logs/health-check.log` pesaba
  409 619 B al 12-nov 13:35. Nadie lo limpiaba ni lo comprimia.
- **El directorio lo leia cualquiera:** `ls -ld /opt/kair-firma/logs` daba
  `drwxr-xr-x root root` (755): cualquier usuario de la maquina podia leer
  el log.

Las tres casillas del `SECURITY.md` Seccion 7.4 que NO se cumplian son: "Rotacion
de logs configurada", "Retencion 90 dias" y "Acceso al log restringido".

### 2.1 Instalar la rotacion

```bash
sudo cp logrotate-kair-firma.conf /etc/logrotate.d/kair-firma
sudo chown root:root /etc/logrotate.d/kair-firma
sudo chmod 644 /etc/logrotate.d/kair-firma

# Probar la configuracion SIN rotar nada:
sudo logrotate -d /etc/logrotate.d/kair-firma

# Verificar que el sistema la toma:
sudo logrotate -d /etc/logrotate.d/ | grep -A5 kair
```

**Por que `copytruncate`:** el servicio y el cron de salud escriben en el
MISMO archivo con el descriptor abierto: el proceso no rota solo. Sin
`copytruncate`, logrotate RENOMBRA el archivo y el servicio sigue
escribiendo en el inode viejo (un archivo que nadie mira): el espacio no se
libera y el log "desaparece". Con `copytruncate`, logrotate copia el
contenido a un archivo fechado y TRUNCA el original: quien escribe sigue
escribiendo en el mismo archivo y la rotacion es real.

**Por que `su root root`:** los logs son de root (los escribe el cron que
corre como root) y tienen que quedar de root. `su root root` lo garantiza
aunque logrotate lo invoque alguien que no es root.

**Por que `rotate 90` y `maxage 90`:** `rotate 90` guarda 90 rotaciones
diarias y `maxage 90` borra lo que tenga mas de 90 dias. Los dos juntos son
la retencion de 90 dias del `SECURITY.md` Seccion 7.4.

**Por que no hay `create`:** con `copytruncate` el archivo original no se
recrea, se trunca: `create` no aplica. Los permisos del archivo vivo se
fijan en el `postrotate` y en el punto 2.2.

La primera rotacion ocurre sola al dia siguiente. Si se quiere forzar ya
(para ver el resultado sin esperar), con el servicio en marcha:

```bash
sudo logrotate -f /etc/logrotate.d/kair-firma
ls -l /opt/kair-firma/logs/
#   health-check.log        (el archivo vivo, truncado)
#   health-check.log.1      (la copia)
```

### 2.2 Restringir el acceso al log

Este paso NO lo hace `logrotate`: es un `chmod` sobre el directorio.

```bash
# El directorio: solo root y el grupo del servicio pueden entrar.
sudo chown root:kairfirma /opt/kair-firma/logs
sudo chmod 750 /opt/kair-firma/logs

# Los archivos de log que ya existen: ni root ni grupo, solo root.
sudo chown root:root /opt/kair-firma/logs/*.log
sudo chmod 640 /opt/kair-firma/logs/*.log
```

**Por que 750 y no 700:** el `SECURITY.md` Seccion 7.4 pide el acceso restringido
"al usuario del servicio y a root". Con `750` y grupo `kairfirma`, el
servicio (que corre como `kairfirma`) puede LEER sus logs y root puede
escribirlos, pero ningun otro usuario de la maquina puede entrar al
directorio. Con `700` el servicio tampoco podria leerlos.

**Que hay que revisar despues:** el servicio escribe sus logs en la
STDOUT (los captura `journald`), no en `/opt/kair-firma/logs`. Los archivos
de ese directorio son los de los scripts de la maquina (el monitor de salud,
los respaldos), que corren como root por cron. Por eso los archivos quedan
`640 root:root` y el directorio `750 root:kairfirma`: asi ningun usuario
ajeno al servicio puede leerlos.

### 2.3 Verificar

```bash
# El directorio ya no lo lee cualquiera:
ls -ld /opt/kair-firma/logs
#   drwxr-x--- 2 root kairfirma ... /opt/kair-firma/logs

# Un usuario cualquiera NO puede leer el log:
sudo -u nobody cat /opt/kair-firma/logs/health-check.log
#   cat: ...: Permission denied     <-- esto es lo que se busca

# La configuracion de rotacion esta en su sitio:
ls -l /etc/logrotate.d/kair-firma
sudo logrotate -d /etc/logrotate.d/kair-firma | head -20

# La retencion:
sudo grep -E 'rotate|maxage' /etc/logrotate.d/kair-firma
#   rotate 90
#   maxage 90
```

---

## 3. LA ALERTA POR CORREO (M.21)

### Que se midio el 12-nov-2026

El monitor de salud corre cada 5 minutos y reporta local y publico por
separado. El 12-nov-2026 a las **12:50:11** escribio "CAIDO publico
(https://firma.kair.fyi/health)" y a las **12:55:02** "OK publico". Se
recupero solo.

**El problema no fue la caida: fue que nadie fue avisado.** El monitor
detecta y escribe en el log, pero el log solo lo lee quien mire. Con esta
pieza, la caida llega al buzon.

El `health-check.sh` ahora avisa por correo (SMTP con `curl`) en DOS
situaciones:

| Situacion | Que significa | Aviso |
|---|---|---|
| El publico cae y el local responde | El problema es del tunel de Cloudflare o del dominio | SI |
| Caen los dos | El servicio esta caido | SI |
| El local no responde y el publico si | Situacion que no se ha medido en produccion | NO (queda en el log) |

### 3.1 Configuracion (todo por variables de entorno)

| Variable | Obligatoria | Por defecto | Que es |
|---|---|---|---|
| `ALERTA_CORREO` | no | `1` | `0` desactiva el aviso por completo |
| `ALERTA_PARA` | **si** para avisar | (vacio) | Destinatario. Varios separados por coma |
| `ALERTA_SMTP_HOST` | **si** para avisar | (vacio) | Servidor SMTP |
| `ALERTA_SMTP_PUERTO` | no | `587` | Puerto SMTP |
| `ALERTA_SMTP_USUARIO` | **si** para avisar | (vacio) | Usuario del SMTP |
| `ALERTA_SMTP_CLAVE` | **si** para avisar | (vacio) | Clave del SMTP |
| `ALERTA_SMTP_REMITENTE` | no | `alertas@kair.fyi` | Remitente |
| `ALERTA_SMTP_SSL` | no | `1` | `1` = STARTTLS en el 587 |

### 3.2 Instalar

**Paso 1: el script.** (Si el servidor ya tiene el `health-check.sh` viejo,
este es el que lo reemplaza.)

```bash
sudo cp health-check.sh /opt/kair-firma/health-check.sh
sudo chown root:root /opt/kair-firma/health-check.sh
sudo chmod 755 /opt/kair-firma/health-check.sh
```

**Paso 2: las variables, en el cron.** El archivo del cron es lo unico que
las lleva, asi que se pone `600` (lo lee root, no cualquiera).

```bash
sudo sh -c 'cat > /etc/cron.d/kair-firma-health <<EOF
ALERTA_PARA=adminkair@gmail.com
ALERTA_SMTP_HOST=smtp.gmail.com
ALERTA_SMTP_PUERTO=587
ALERTA_SMTP_USUARIO=alertas@kair.fyi
ALERTA_SMTP_CLAVE=clave-de-aplicacion
ALERTA_SMTP_REMITENTE=alertas@kair.fyi
*/5 * * * * root /opt/kair-firma/health-check.sh >> /opt/kair-firma/logs/health-check.log 2>&1
EOF'
sudo chown root:root /etc/cron.d/kair-firma-health
sudo chmod 600 /etc/cron.d/kair-firma-health
```

**Por que en el cron y no en un `.env`:** el archivo del cron es lo que el
cron lee, y con `600` la clave del SMTP no la lee nadie mas que root. Un
`.env` aparte habria que cargarlo desde el script, con el mismo resultado
y mas pasos.

> **La clave del SMTP va en un `netrc` temporal de modo 600**, escrito por
> el script en cada envio y borrado al terminar: asi NO aparece en la lista
> de procesos (`ps`), donde un `--user usuario:clave` si se veria.

### 3.3 Si NO se quiere el aviso por correo

**No hay que hacer nada**: sin `ALERTA_PARA` configurado, el script NO avisa
y NO falla. Solo escribe en el log, como antes. La instalacion actual no se
rompe por anadir esto.

Para desactivar el aviso dejando las demas variables:

```bash
# Anadir ALERTA_CORREO=0 al archivo del cron:
sudo sed -i '1i ALERTA_CORREO=0' /etc/cron.d/kair-firma-health
```

### 3.4 Que NO lleva el aviso

El correo lleva **solo**: que paso, cuando, donde, y que hacer. **NO**
lleva ninguna credencial: ni la clave del SMTP, ni tokens, ni llaves de API,
ni el `.env`. La clave del SMTP viaja en el `netrc` temporal de modo 600, no
en el mensaje.

### 3.5 Verificar

**Que el script sigue vivo y avisa en el log (sin correo):**

```bash
sudo /opt/kair-firma/health-check.sh
#   [2026-11-12T15:34:32-05:00] OK local (http://127.0.0.1:3001/health)
#   [2026-11-12T15:34:32-05:00] OK publico (https://firma.kair.fyi/health)
```

**Que el aviso sale de verdad (prueba de caida simulada, sin tocar el
servicio):** se apunto el destino del SMTP a un puerto cerrado y se fuerza
la caida del publico con `KAIR_URL_PUBLICA`.

```bash
# 1. Un SMTP de mentira: el aviso NO sale, pero se ve el intento.
sudo KAIR_URL_PUBLICA=http://127.0.0.1:9/health \
     ALERTA_PARA=adminkair@gmail.com \
     ALERTA_SMTP_HOST=127.0.0.1 ALERTA_SMTP_PUERTO=9 \
     ALERTA_SMTP_USUARIO=u ALERTA_SMTP_CLAVE=c \
     /opt/kair-firma/health-check.sh
#   [..] CAIDO publico (http://127.0.0.1:9/health). ...
#   [..] ALERTA: no se pudo enviar el correo (curl 7). La caida queda solo en el log.
#   (codigo de salida 0: el monitor NO se cae porque no pudo avisar)

# 2. Con el SMTP real, el correo llega al buzon:
sudo KAIR_URL_PUBLICA=http://127.0.0.1:9/health \
     /opt/kair-firma/health-check.sh
#   [..] ALERTA: aviso enviado por correo a adminkair@gmail.com.
```

**Que NO se repite el correo mientras la caida dura:**

```bash
# Con la caida aun simulada, se corre otra vez: el aviso ya salio y el
# estado no cambio, asi que no se manda otro correo.
sudo KAIR_URL_PUBLICA=http://127.0.0.1:9/health /opt/kair-firma/health-check.sh
#   (sin linea "ALERTA: aviso enviado por correo ...")

# Y cuando el publico vuelve, el estado se limpia (una caida nueva vuelve
# a avisar):
sudo /opt/kair-firma/health-check.sh
ls -l /opt/kair-firma/logs/health-check.alerta.estado
#   (no existe: el estado se limpio)
```

---

## 4. RESUMEN DE LOS COMANDOS (para pegar, de a uno)

El `docs/MIGRACION-SERVIDOR-FIRMA.md` avisa de esto: **un comando a la
vez**, la salida se lee antes del siguiente.

### En el PC (antes de empaquetar)

```powershell
cd 'C:\Proyectos Programación\SG-SST-E'
$commit = (git rev-parse HEAD).Trim()
node sgsst-electron-app/firma-service/scripts/generar-sello-version.js --commit="$commit"
```

### En el servidor (despues de subir el paquete, con el servicio parado)

```bash
sudo install -m 644 -o root -g root logrotate-kair-firma.conf /etc/logrotate.d/kair-firma
```

```bash
sudo chown root:kairfirma /opt/kair-firma/logs && sudo chmod 750 /opt/kair-firma/logs
```

```bash
sudo chown root:root /opt/kair-firma/logs/*.log && sudo chmod 640 /opt/kair-firma/logs/*.log
```

```bash
sudo cp health-check.sh /opt/kair-firma/health-check.sh && sudo chmod 755 /opt/kair-firma/health-check.sh
```

### Verificacion (despues de arrancar el servicio)

```bash
sudo cat /opt/kair-firma/app/VERSION
```

```bash
curl -sS https://firma.kair.fyi/health
```

```bash
cd /opt/kair-firma/app && sudo -u kairfirma node scripts/generar-sello-version.js --comprobar
```

```bash
sudo logrotate -d /etc/logrotate.d/kair-firma | head -20
```

```bash
ls -ld /opt/kair-firma/logs && sudo -u nobody cat /opt/kair-firma/logs/health-check.log
```

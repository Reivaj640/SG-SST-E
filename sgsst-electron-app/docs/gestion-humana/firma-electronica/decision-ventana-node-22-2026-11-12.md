# La ventana de Node 22 — determinacion del 12-nov-2026

> **Que decide este documento.** El owner decidio el 11-nov-2026 que el servidor corra **Node 22 (ABI
> 127)**. Este documento dice **como se hace esa ventana**, con comandos literales, con su rollback y con
> la prueba que ya esta hecha. **La ventana no se abre sola:** la abre el owner, con `sudo`, en un momento
> en que el servicio no este en uso.
>
> **Que NO hace.** No ejecuta nada. No reinicia nada. No abre ni cierra compuertas. No cambia el
> `ExecStart` de la unidad de systemd: eso es un acto del owner.

## 1. Decision

**La decision del 11-nov-2026 se mantiene y no se aplaza.** La ventana es ejecutable: el runtime, el
modulo nativo, el rollback y el verificador estan **medidos**, no supuesto.

**La colision que hay que resolver antes de empezar:** el cron `/etc/cron.d/kair-firma-health` corre
**cada 5 minutos** y reinicia el servicio si `/health` no responde. Durante la ventana el servicio esta
reiniciandose **a proposito**, asi que ese cron choca con la ventana. La ventana empieza **desactivando ese
cron** y termina **reactivandolo**. Es el unico ajuste de calendario que hace falta.

Los otros tres crons del servicio no estorban en una ventana corta: el respaldo corre a las **22:00**, la
purga a las **03:00** y la restauracion el dia **1** a las **04:00**. Si la ventana se hace de noche, el
respaldo de las 22:00 podria caer dentro: conviene **hacerla antes de las 21:00** o **desactivar tambien
`/etc/cron.d/kair-firma-backup`**.

## 2. Lo que esta medido (12-nov-2026, por SSH, sin tocar produccion)

### 2.1 El estado de hoy

| Dato | Valor | De donde sale |
|---|---|---|
| Runtime en produccion | **Node 20.20.2** (ABI 115) | `node -v` |
| Como se instalo | `20.20.2-1nodesource1`, de `deb.nodesource.com/node_20.x` | `apt-cache policy nodejs` |
| Como lo arranca el servicio | `/usr/bin/node src/server.js`, `WorkingDirectory=/opt/kair-firma/app`, usuario `kairfirma` | `systemctl show kair-firma -p ExecStart` |
| El `.node` que hay instalado | ABI 115 (el de Node 20) | carga OK con el node del PATH |
| Rollback disponible | **`/var/cache/apt/archives/nodejs_20.20.2-1nodesource1_amd64.deb`** | `ls /var/cache/apt/archives/` |

**El `.deb` de Node 20 esta en la cache de `apt`.** El rollback **no depende de internet**: es un
`dpkg -i` de un archivo que ya esta en la maquina.

### 2.2 La prueba de de-risqueo (la que faltaba)

La duda que hacia esto una hipotesis era: *«¿carga el modulo nativo con Node 22 en ESTA maquina?»*. Se
midio **sin instalar nada**, con el runtime descargado a `/tmp` y el arbol de prueba armado en `/tmp`:

1. **El runtime oficial se descarga y se verifica contra la firma oficial.**
   `node-v22.23.5-linux-x64.tar.xz` (31 062 912 B) de `https://nodejs.org/dist/v22.23.5/`, con
   SHA-256 `cdeb8670a0c81f51b4dc4ac61919f9b1ad917b304bf8221eb939570663d240f8`, **identico** al de
   `SHASUMS256.txt` de nodejs.org. Reporta `v22.23.5 ABI 127`.
2. **El prebuild oficial del modulo**, `better-sqlite3` 11.10.0 `node-v127-linux-x64` de GitHub:
   tar `ea6a09d12d43cca31782ab0e09ecf442b8e2a49f5a02b219f5f117a6601ed306`, binario
   `d7d9272b12d11c1dc2bb787741b1b7c4037d336155f316ace3420410c28fda37`.
3. **La prueba real:** con el runtime de Node 22, el binario **carga y responde**:
   `SELECT 1 = {"uno":1}`, `sqlite_version() = 3.49.2`, salida 0.
4. **La contraprueba:** el **mismo** binario con el Node 20 del servidor es **rechazado**, con el mensaje
   `NODE_MODULE_VERSION 127 ... requires NODE_MODULE_VERSION 115`. Es decir, el cambio de runtime y el
   cambio del modulo son **el mismo acto**: no se puede subir uno sin el otro.
5. **Produccion intacta al terminar:** `MainPID=281641`, `NRestarts=0`, `active (running)`, y
   `/health` respondiendo `{"status":"ok","checks":{"db":"ok","smtp":"configured"}}`.

**Consecuencia:** la ventana **no necesita compilar nada**. El prebuild oficial existe, se verificó y se
probó en esta maquina.

## 3. La ventana, paso a paso

> Todos los comandos son para el **owner**, en el servidor, con `sudo`. El equipo los ejecuto en modo de
> prueba **sin instalar nada** (seccion 2.2); lo que queda es el acto.

### 3.0 Preflight (sin `sudo`, no cambia nada)

```bash
bash /opt/kair-firma/app/deploy/verificar-runtime-node.sh
# exit 0 = el estado de HOY es coherente (Node 20 + modulo ABI 115).
```

### 3.1 Quitar la colision del cron de salud

```bash
sudo mv /etc/cron.d/kair-firma-health /etc/cron.d/kair-firma-health.durante-la-ventana
# (si la ventana es de noche, tambien:)
sudo mv /etc/cron.d/kair-firma-backup /etc/cron.d/kair-firma-backup.durante-la-ventana
```

### 3.2 Instalar Node 22 **sin tocar `/usr/bin/node`**

Se instala en un directorio propio, para que el binario del sistema siga siendo el de Node 20 y el
rollback sea una sola linea:

```bash
cd /tmp
curl -fsSLO https://nodejs.org/dist/v22.23.5/node-v22.23.5-linux-x64.tar.xz
echo "cdeb8670a0c81f51b4dc4ac61919f9b1ad917b304bf8221eb939570663d240f8  node-v22.23.5-linux-x64.tar.xz" | sha256sum -c -
sudo mkdir -p /opt/kair-firma/node22
sudo tar -xJf node-v22.23.5-linux-x64.tar.xz -C /opt/kair-firma/node22 --strip-components=1
/opt/kair-firma/node22/bin/node -p "process.version + ' ABI ' + process.versions.modules"
# esperado: v22.23.5 ABI 127
```

### 3.3 Poner el modulo nativo ABI 127

```bash
cd /opt/kair-firma/app
sudo -u kairfirma cp node_modules/better-sqlite3/build/Release/better_sqlite3.node /tmp/better_sqlite3.node.abi115
curl -fsSLo /tmp/prebuild-v127.tar.gz https://github.com/WiseLibs/better-sqlite3/releases/download/v11.10.0/better-sqlite3-v11.10.0-node-v127-linux-x64.tar.gz
echo "ea6a09d12d43cca31782ab0e09ecf442b8e2a49f5a02b219f5f117a6601ed306  /tmp/prebuild-v127.tar.gz" | sha256sum -c -
sudo -u kairfirma tar -xzf /tmp/prebuild-v127.tar.gz -C node_modules/better-sqlite3
sha256sum node_modules/better-sqlite3/build/Release/better_sqlite3.node
# esperado: d7d9272b12d11c1dc2bb787741b1b7c4037d336155f316ace3420410c28fda37
```

### 3.4 Apuntar la unidad al runtime nuevo

```bash
sudo systemctl edit kair-firma
# [Service]
# ExecStart=
# ExecStart=/opt/kair-firma/node22/bin/node src/server.js
sudo systemctl daemon-reload
sudo systemctl restart kair-firma
```

### 3.5 Verificar (sin `sudo`)

```bash
bash /opt/kair-firma/app/deploy/verificar-runtime-node.sh
# exit 0 = runtime y modulo coherentes, /health en 200 y checks.db == "ok".
```

Ademas, con el runtime esperado:

```bash
KAIR_VERSION_ESPERADA=22 KAIR_ABI_ESPERADO=127 bash /opt/kair-firma/app/deploy/verificar-runtime-node.sh
```

### 3.6 Reactivar los crons

```bash
sudo mv /etc/cron.d/kair-firma-health.durante-la-ventana /etc/cron.d/kair-firma-health
sudo mv /etc/cron.d/kair-firma-backup.durante-la-ventana /etc/cron.d/kair-firma-backup
```

## 4. El rollback (completo, con internet y sin internet)

Si algo falla, en este orden:

```bash
# 1. Volver el binario del sistema (Node 20, desde la cache de apt: NO necesita internet)
sudo dpkg -i /var/cache/apt/archives/nodejs_20.20.2-1nodesource1_amd64.deb

# 2. Restaurar el modulo nativo ABI 115
sudo -u kairfirma cp /tmp/better_sqlite3.node.abi115 \
  /opt/kair-firma/app/node_modules/better-sqlite3/build/Release/better_sqlite3.node

# 3. Volver a la unidad original
sudo systemctl revert kair-firma
sudo systemctl daemon-reload
sudo systemctl restart kair-firma

# 4. Verificar
bash /opt/kair-firma/app/deploy/verificar-runtime-node.sh
```

El rollback **no depende de internet** en ninguno de sus pasos: el `.deb` de Node 20 esta en la cache y
el binario nativo del ABI 115 queda guardado en `/tmp` antes de tocar nada.

## 5. El verificador

`firma-service/deploy/verificar-runtime-node.sh` es **de solo lectura**: no escribe, no borra, no reinicia,
no necesita `sudo` y **no abre la base de produccion en escritura**. Mide:

1. Que binario usa el servicio (`ExecStart` de systemd).
2. La version y el ABI de ese node, y los del node que esta primero en el `PATH`.
3. La version declarada del modulo y la huella SHA-256 de su binario nativo.
4. **Carga el modulo y ejecuta un `SELECT 1` real sobre una base EN MEMORIA.**
5. `/health`: codigo HTTP 200 y `checks.db == "ok"`.
6. El estado de systemd: `active`, `MainPID`, `NRestarts` y el arranque.

**Codigos de salida:** `0` = coherente; **`1` = incoherencia entre el runtime y el modulo, o el servicio no
esta sano** (este es el codigo que hace fallar la ventana); `2` = el entorno no se pudo medir.

## 6. Lo que queda como acto del owner

1. **Dar la ventana** (momento, y aviso a quien use el servicio en ese rato).
2. **Ejecutar los pasos 3.1 a 3.6**, en ese orden.
3. **Dejar el rollback escrito a mano antes de empezar** (la seccion 4).
4. **Avisar si el cron de salud se queda desactivado**: un cron desactivado es un watchdog apagado.

## 7. Riesgos, escritos

- **Subir el runtime sin el modulo (o al reves) deja el servicio muerto**: el proceso muere al abrir la
  base. Por eso el orden es runtime → modulo → unidad → reinicio, y el verificador se corre **antes** de
  reactivar el watchdog.
- **El watchdog apagado durante la ventana es un riesgo propio**: si el servicio se cae y no hay nadie
  mirando, la ventana se alarga sola. Por eso el paso 3.6 es parte de la ventana, no un extra.
- **El rollback depende de `/tmp`**: si `/tmp` se limpia entre el paso 3.3 y el 3.5, se pierde la copia del
  binario ABI 115. El `.deb` de Node 20 esta en un sitio estable (`/var/cache/apt/archives/`), pero el
  `.node` esta en `/tmp`: conviene copiarlo a `/opt/kair-firma/` antes de empezar.
- **Node 20 esta en EOL desde el 2026-04-30.** Node 22 no arregla eso (su EOL es posterior, pero tampoco
  eterno): esta decision compra margen, no un final. Es deuda, no una blocage.
- **Hoy esto no bloquea nada**: el servicio esta sano con Node 20 (`NRestarts = 0`, `/health` en `ok`). Es
  una decision de momento, no una urgencia.

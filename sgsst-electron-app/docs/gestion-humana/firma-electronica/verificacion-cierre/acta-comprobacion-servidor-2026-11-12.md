# Acta de comprobacion del servidor (requisito 7.13 del cuadro canonico)

**Fecha de la medicion.** 12-nov-2026, 19:52Z a 19:57Z (hora de Colombia: 14:52 a 14:57).
**Responsable.** Equipo de K+AIR, por SSH en modo de solo lectura contra `kair-server`
(`javier@192.168.1.11`).
**Que se midio.** El estado del servidor que corre el servicio de firma electronica: el proceso, la
salud, la base, los permisos, los respaldos, los logs, la red y **que codigo esta desplegado**.

**Advertencia de metodo.** La cuenta `javier` no puede abrir la base de produccion en escritura (el
`-wal` y el `-shm` son de `kairfirma`) ni leer el `.env` (`600 root`). Por eso:

- la base se midio con `sqlite3 -readonly`, y el unico script que necesito abrirla (el preflight) se
  corrio contra una **copia** hecha con `.backup`, que es consistente;
- las variables de entorno que el codigo exige (`INTERNAL_API_KEY`, `ADMIN_API_KEY`, las de SMTP) se
  pusieron **de mentira** para que `src/config.js` cargara. Ninguna de ellas participa en lo que el
  preflight calcula: su unico acceso a la base es `db.prepare(...)` con `.all()`/`.get()`, sin
  `INSERT`, `UPDATE` ni `DELETE`.

**Nada se modifico en produccion.** Los `mtime` del arbol desplegado, de la base y del manifiesto
quedaron como estaban.

---

## 1. Identificacion del codigo desplegado

El servidor **no tiene `.git`** (medido: `/opt/kair-firma/.git` no existe). Por eso "que codigo
corre" no se responde con `git log` en el servidor, y el manifiesto `legal-readiness.json` solo
habla de los TEXTOS (el Acuerdo y los anexos), no del codigo.

La respuesta se constructo comparando el sha256 de cada archivo desplegable del repositorio con el
de los mismos archivos en el servidor:

| Medida | Valor |
|---|---|
| Commit del repositorio | `264d08df` (📦1052), identico a `origin/Dev` |
| Archivos en comun | **247** |
| Archivos que difieren | **6** |
| Archivos sobrantes en el servidor | **0** |
| Archivos del repo aun no desplegados | 201 (tests, scripts nuevos, documentacion) |

Los 6 que difieren:

- `package.json` y `package-lock.json` — **el 📦1051 no esta desplegado** (ver el punto 5);
- `scripts/actualizar-manifiesto-1047.js` y `scripts/actualizar-manifiesto-v1.6.js` — versiones
  viejas de dos scripts auxiliares;
- `deploy/setup-vm.sh` y `deploy/README-DESPLIEGUE.md` — documentacion y script de despliegue.

**Todo `src/` que corre es byte a byte el del repositorio.** La comparacion es reproducible con
`firma-service/scripts/comparar-despliegue.js`: sale con codigo 1 y nombra los archivos mientras haya
diferencias.

## 2. El proceso y la salud

| Medida | Valor |
|---|---|
| `systemctl is-active kair-firma` | `active` |
| `systemctl is-enabled kair-firma` | `enabled` |
| `MainPID` | `281641` |
| `NRestarts` | `0` |
| Arranque | 12-nov-2026 09:30:23 -05 |
| `GET http://127.0.0.1:3001/health` | `{"status":"ok","db":"ok","smtp":"configured",...}` |

**El `/health` no identifica el codigo.** Devuelve `version: "0.1.0"` (el `package.json` del servidor)
y `kair_version: "compatible-0.1.189"`, que es un valor **fijo** y no cambia con el despliegue. Por
eso el `/health` no puede usarse como prueba de que se desplego algo: para eso esta la comparacion
por sha256 de este acta.

## 3. La base de datos

| Medida | Valor |
|---|---|
| Migraciones aplicadas | **61** |
| Ultima migracion | `062_encargado_poderes_append_only` |
| Firmas electronicas | **5** (2 `SIGNED`, 1 `CANCELLED`, 1 `OTP_VERIFIED`, 1 `OPENED`) |
| Eventos | **55** |
| Eventos `OTP_MEDIO_CORPORATIVO` | **0** |
| Empresas | **1** (`900829731` ASEPLUS CARIBE S.A.S., de prueba) |
| Ultimo evento | id 146, `ELECTRONIC_FLOW_CANCELLED`, `2026-11-06T20:25:34.433Z` |

**La ultima firma electronica completa es del 6 de noviembre.** Despues del despliegue del 11-nov y
de los cuatro actos del P8 del 12-nov, el flujo de firma **no se ha ejercitado** en produccion.

## 4. Permisos, logs y red

| Medida | Valor |
|---|---|
| Archivos escribibles por cualquiera (`-perm -0002`) en `/opt/kair-firma/app` | **236** |
| Directorios escribibles por cualquiera | **18** |
| `/opt/kair-firma/logs` | `755 root:root` |
| `health-check.log` | **411 704 B**, **5 820 lineas**, desde el **2026-10-26** |
| `logrotate` para este servicio | **no existe** (`/etc/logrotate.d/kair-firma` no esta) |
| Puerto 3001 | escucha **solo** en `127.0.0.1` |
| `cloudflared` | `active` |
| Node del servidor | **v20.20.2** |

El log de salud **crece sin rotar** y sin retencion: son ~576 lineas por dia (dos por cada corrida de
5 minutos), desde el 26-oct.

## 5. Dependencias instaladas (lo que no se ha desplegado)

| Paquete | En el servidor | En el repositorio |
|---|---|---|
| express | 4.22.2 | 4.22.3 |
| proxy-addr | **2.0.7** | **2.0.8** |
| qs | 6.15.3 | 6.16.2 |
| nodemailer | 6.10.1 | (por resolver, 📦1055 en curso) |
| zod | 3.25.76 | (por resolver, 📦1055 en curso) |

`proxy-addr 2.0.7` es la **critica** (IP spoofing por subred IPv4-mapped IPv6). Esta es exactamente
la diferencia que el 📦1051 arregla y que **no** esta en produccion.

## 6. Respaldos y purga

| Medida | Valor |
|---|---|
| Ultimo respaldo | **11-nov-2026 22:00** (`firma-20261111-220001.sqlite.enc`, 164 714 B, sha256 `de14e3f4b3c94c32eb690ae9215c111cdc1b450c963726eac54bd5192ebde20a`, `integrity ok`, cifrado gpg) |
| Copia fuera del servidor | **no hay ninguna** |
| Purga | 4 dias seguidos (7, 8, 11 y 12-nov) con «no hay solicitudes de purga pendientes» |

**Los cuatro actos del P8 (12-nov) todavia no estan en ningun respaldo.** El respaldo de hoy a las
22:00 ya los incluye, pero siguen en el **mismo disco** que la base: si la maquina se muere, se
pierden los dos.

## 7. Textos publicados y manifiesto

| Archivo | Huella sha256 |
|---|---|
| `/opt/kair-firma/app/legal-readiness.json` | `191c08b837b41069de4e2d25d7158fd90a7c3ce5f93b22696d2d7050f8a4013f` |
| `/opt/kair-firma/app/scripts/fixtures/acuerdo-v1.6.txt` | `08e1eb8b09449fbc57eebdda89518482b0063285d2f0f56ed335d2977532f13e` |
| `/opt/kair-firma/legal/anexo-nube-v1.3.html` | `fdd10551c2106e186d62a2b70922530ff9494a8538fc67816f6f5ad5ca2b585d` |
| `/opt/kair-firma/legal/anexo-encargo.html` | `6308b1f7a51007cb1e973de0210d1e5659d3b3ceb8e3e3b7a3ee52a7275b8948` |

El manifiesto es **byte a byte igual** al del repositorio. Las tres huellas coinciden con las que
declara el manifiesto. Las actas del P8 estan en `/opt/kair-firma/storage/pdfs/actas`:
`acta-2-anexo-encargo.pdf` (7 693 B), `acta-2-contrafirma-anexo-nube.pdf` (7 167 B),
`acta-2-contrafirma-anexo-encargo.pdf` (7 405 B).

## 8. El preflight de la compuerta del Anexo de Nube

Este es el control que decide si se puede abrir el servicio, y se corrio en la misma sesion.

```
cd /opt/kair-firma/app
node scripts/preflight-anexo-nube.js --json
```

**Salida: `ok: true`, `PREFLIGHT_EXIT=0`** — «hay al menos una Empresa activa con el Anexo de Nube
suscrito y contrafirmado sobre el texto vigente». En detalle:

- texto `legal/anexo-nube-v1.3.html`, 85 143 B, huella del archivo **igual** a la del manifiesto;
- 1 Empresa activa, 1 con el Anexo de Nube suscrito, 1 con el del texto **vigente**, 1 con el
  Anexo de Nube **EJECUTADO** (suscrito y contrafirmado): `900829731` ASEPLUS CARIBE S.A.S., suscrito
  `2026-11-12T15:38:27.990Z`, contrafirmado `2026-11-12T16:13:54.106Z`;
- `FIRMA_EXIGIR_ANEXO_NUBE`: **no definida** (apagada).

## 9. Que queda de esta comprobacion

1. **El 📦1051** (el bump de dependencias): `proxy-addr 2.0.7` sigue en produccion. Acto del owner
   (`sudo`).
2. **Los 236 archivos en 777**: el codigo que corre es escribible por cualquiera. Acto del owner
   (`sudo`).
3. **La bandera `FIRMA_EXIGIR_ANEXO_NUBE`**: apagada. Acto del owner. El preflight ya dio 0, asi que
   la condicion tecnica se cumple.
4. **Los logs**: sin rotacion y con retencion indefinida. El `logrotate` esta escrito en el
   repositorio; falta instalarlo en el servidor (`sudo`).
5. **El respaldo off-site**: el destino es una decision del owner; el script esta escrito y validado.
6. **Node 22**: el servidor corre v20.20.2 y `better-sqlite3` es ABI 127 (Node 22). Acto del owner.

## 10. Como se reproduce esta acta

```bash
# 1) Manifiesto del servidor
cd /opt/kair-firma/app
find . -type f -not -path './node_modules/*' -not -path './data/*' -not -path './storage/*' \
  -not -path './logs/*' -not -path './backups/*' -not -name '*.enc' -not -name '*.pdf' -not -name '*.log' \
  -print0 | xargs -0 sha256sum | sed 's#  \./#  #' | LC_ALL=C sort > /tmp/manifiesto-servidor.txt

# 2) En el PC, con el repositorio al dia
node firma-service/scripts/comparar-despliegue.js \
  --repo <ruta>/sgsst-electron-app/firma-service \
  --servidor <manifiesto-servidor.txt>
# Sale con codigo 1 y nombra los archivos que difieren.
```

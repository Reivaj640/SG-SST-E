# Plan de despliegue a producción — K+AIR Firma Electrónica (2026-10-20)

> **Estado: preparado, NO ejecutado.** Todo lo que sigue está verificado contra el
> código y contra producción el 2026-10-20; los pasos que necesitan el servidor
> quedan pendientes porque **no hay acceso SSH** (`javier@192.168.1.11` responde
> `Permission denied (publickey,password)`).
>
> Alcance: desplegar el commit `b5c04f93` (📦912-923, con `ab78ca92` 📦906-911
> abajo) en `kair-server` y hacer una prueba de extremo a extremo.
>
> **Este plan NO enciende ninguna bandera nueva** (el OTP al medio personal, el
> D-02, la v1.1 del Acuerdo). Despliega código y deja el servicio en pie.

---

## 1. Lo que está verificado hoy (2026-10-20)

| Qué | Estado | Cómo se comprobó |
|---|---|---|
| Rama / commit | `Dev` @ `b5c04f93`, árbol limpio | `git log`, `git status` |
| Suite del commit | 1377 tests · 1375 verdes · 0 fallos · 2 omitidos | `node --test` |
| Producción viva | `GET https://firma.kair.fyi/health` → 200, `checks.db=ok`, `checks.smtp=configured` | `Invoke-WebRequest` |
| Producción con el código **nuevo** | **NO** — `POST /api/solicitudes` responde **404** | `node scripts/smoke-produccion.js --canal-datos` |
| Migraciones en producción | aplicadas hasta la **018**; faltan **019 → 032** (14) | `gh_firma_schema_migrations` |
| Migraciones en el repo | 001–032 (no existe la 015) | `src/db/schema/` |
| Acceso SSH | **denegado** | `ssh javier@192.168.1.11` |
| Acuerdo legal v1.0 | íntegro, sellado `sha256 52a490a4…55710c04` (32907 chars) | `scripts/fixtures/acuerdo-ARCHIVO.json` |
| Acuerdo legal publicado | solo en `data/manual-8bc/archivo.sqlite` (local, no producción) | inventario de 379 bases |
| K+AIR de escritorio hablando con producción | **nunca**: cero llamadas a `firma.kair.fyi` en `main.log` | `Select-String` sobre el log |

**Dato que importa:** que el health responda `ok` no dice nada del despliegue.
`src/routes/health.js:45` devuelve `'compatible-' + (config.env === 'production'
? '0.1.189' : 'dev')` — **la versión está fija en el código**. La señal real de que
el código nuevo corrió es el `404` de `/api/solicitudes` (o su `201` después del
despliegue), que es una ruta que solo existe desde el 1.3.

---

## 2. Los cinco riesgos que pueden romper el despliegue

### R1 — `TOKEN_ENCRYPTION_KEY`: el servicio NO arranca sin ella

- `src/crypto/keys.js:108-113` lanza `TOKEN_ENCRYPTION_KEY requerida en produccion`.
- La variable es **nueva en el código que se va a desplegar**: `src/crypto/keys.js`
  se agregó en `ab78ca92` (📦906-911), que es el commit inmediatamente anterior a
  `b5c04f93`. El código que hoy corre en producción (≤018) **no la usaba**: antes
  el token era un hash SHA-256 pelado y el OTP un hash con sal en la misma fila.
- Consecuencia: si se despliega sin esta variable, el proceso muere al arrancar y
  `https://firma.kair.fyi/health` deja de responder. **Es el riesgo #1.**

> La variable se genera **una vez** y no se cambia más. Rotarla invalidaría los
> tokens cifrados y los seudónimos ya calculados (`keys.js` §rotación). Si se
> cambia, hay que montar el anillo (`FIRMA_HMAC_KEYRING`), no reemplazar la llave.

### R2 — El 409 `EMPRESA_NO_HABILITADA` puede cortar la operación

> **Actualizado el 23-oct-2026 (📦933).** `FIRMA_EXIGIR_HABILITACION_EMPRESA` **se
> retiró**: el bloqueo es incondicional y la única salida es la excepción auditable
> (`POST /internal/admin/excepciones-habilitacion`). Lo que sigue describe el
> estado en la fecha de este plan.

- `src/config.js:166-167`: `exigirHabilitacionEmpresa` es **true por defecto**
  (`FIRMA_EXIGIR_HABILITACION_EMPRESA !== 'false'`).
- `src/services/empresa.js:746-753`: una empresa registrada que no tenga
  **Anexo de Encargo firmado**, **plazo de retención declarado** ni
  **`canal_pqrs`** recibe `409 EMPRESA_NO_HABILITADA` y **no se le puede pedir
  una firma**.
- El `canal_pqrs` como requisito es **nuevo de `b5c04f93`** (no existía antes).
- Si en producción hay empresas registradas sin esos tres datos, al desplegar
  quedan sin poder pedir firmas. Hay que correr el inventario **antes**:
  `node scripts/inventario-empresas-no-habilitadas.js`.

### R3 — Choque de versiones del Acuerdo

- `scripts/archivar-acuerdo.js` sale con **exit 3** cuando en la base hay una
  `v1.0` cuyo texto no coincide con el archivo legal.
- `src/services/agreement.js:121-124`: `createVersion` lanza
  `409 ACUERDO_VERSION_EXISTS` si el número de versión ya existe. **La legal no
  se puede publicar encima de una v1.0 de pruebas** por la API.
- La decisión está en la §6 de este plan. **No se resuelve a ciegas.**

### R4 — `/health` no sirve como prueba de despliegue

Ver §1. La prueba es `/api/solicitudes` (o el log del servicio).

### R5 — Los inventarios no se han corrido

Sin la copia de producción no se puede correr
`scripts/inventario-buzon-corporativo.js` ni
`scripts/inventario-empresas-no-habilitadas.js`. El número que decide la
bandera del D-02 sale de ahí. **No se enciende la bandera sin el dato.**

---

## 3. Fase 0 — Copia verificada de la base de producción

El servicio sigue corriendo mientras se hace esto. `sqlite3 .backup` es seguro
con WAL; **nunca** copiar el archivo a pelo.

```bash
# EN EL SERVIDOR
STAMP=$(date +%Y%m%d-%H%M%S)
sudo -u kairfirma sqlite3 /opt/kair-firma/data/firma.sqlite \
  ".backup '/opt/kair-firma/backups/firma-$STAMP.sqlite'"
sudo cp /opt/kair-firma/backups/firma-$STAMP.sqlite /tmp/
sudo chown javier /tmp/firma-$STAMP.sqlite
```

```powershell
# EN EL PC
scp javier@192.168.1.11:/tmp/firma-20261020-XXXXXX.sqlite "$env:TEMP\prod-copia.sqlite"
```

**Antes de tocar nada, con la copia en el PC:**

```bash
# Estado de las migraciones aplicadas en producción
sqlite3 prod-copia.sqlite "SELECT version FROM gh_firma_schema_migrations ORDER BY version;"

# Versiones del Acuerdo publicadas
sqlite3 prod-copia.sqlite "SELECT version, substr(texto_hash,1,16), activa, fecha_creacion FROM gh_firma_acuerdo_versiones;"

# ¿El texto publicado es el legal o el de pruebas?
sqlite3 prod-copia.sqlite "SELECT version, CASE WHEN texto LIKE '%ACUERDO DEV%' THEN 'PRUEBAS' ELSE 'LEGAL' END FROM gh_firma_acuerdo_versiones;"

# Consentimientos ya aceptados (esto decide R3)
sqlite3 prod-copia.sqlite "SELECT version_acuerdo, COUNT(*) FROM gh_consentimientos_firma GROUP BY version_acuerdo;"

# Empresas registradas y si están habilitadas
sqlite3 prod-copia.sqlite "SELECT id_empresa, anexo_encargo_firmado_at IS NOT NULL, plazo_retencion_dias, canal_pqrs FROM gh_firma_empresas;"
```

**Prueba de restauración (obligatoria antes de seguir):** restaurar la copia en
una base vacía y comprobar que abre y que el conteo de filas es el mismo.

```bash
sqlite3 /tmp/restaurada.sqlite ".backup '/tmp/restaurada.sqlite'"   # o cp
sqlite3 /tmp/restaurada.sqlite "PRAGMA integrity_check;"
```

> Si `integrity_check` no dice `ok`, la copia no sirve: **no se sigue**.

---

## 4. Fase 1 — El `.env` de producción

Vive **solo** en el servidor: `/opt/kair-firma/.env` (el que lee systemd como
`EnvironmentFile`). El `.env` de `app/` lo carga `dotenv`, pero **no pisa** lo
que ya viene del systemd.

**Único cambio obligatorio: agregar la llave maestra.**

```bash
# EN EL SERVIDOR
sudo cp /opt/kair-firma/.env /opt/kair-firma/.env.bak-$(date +%Y%m%d-%H%M%S)

# Generar la llave (32 bytes hex = 64 caracteres)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Editar /opt/kair-firma/.env y AGREGAR esta linea (no cambiar ninguna otra):
#   TOKEN_ENCRYPTION_KEY=<el hex de arriba>
sudo nano /opt/kair-firma/.env
```

**Lo que NO se toca en esta fase:**

| Variable | Por qué no se toca |
|---|---|
| `INTERNAL_API_KEY`, `ADMIN_API_KEY` | Cambiarlas rompe la integración con K+AIR y con la consola. |
| `SMTP_*` | El correo funciona (`checks.smtp=configured`). |
| `DB_PATH`, `PDF_STORAGE_PATH` | Rutas que ya están bien. |

**Lo que se puede dejar para después (o no):**

| Variable | Efecto | Recomendación |
|---|---|---|
| `FIRMA_EXIGIR_HABILITACION_EMPRESA` | `true` (default) bloquea a las empresas sin Anexo/plazo/canal. `false` deja pasar con un WARN en el log. | **Dejarla en el default (bloquea)** y resolver con el inventario. Ponerla en `false` es una decisión de negocio, no técnica. |
| `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP` | `false` (default). En `true`, un buzón corporativo recibe `400 MEDIO_OTP_CORPORATIVO`. | **No encender.** Sin la v1.1 y sin el inventario, no. |
| `FIRMA_HMAC_KEYRING` / `FIRMA_HMAC_KEY_VERSION` | Opcionales: sin ellas el anillo es `{k1: TOKEN_ENCRYPTION_KEY}`. | **No hacen falta** para este despliegue. Son para la rotación futura. |
| `FIRMA_CANAL_PROTECCION_DATOS` | Default `privacidad@k-air.com`. | Verificar que el buzón exista ANTES de publicar la v1.1. No bloquea este despliegue. |

---

## 5. Fase 2 — Desplegar el código

**No hay cambios de dependencias** entre el commit desplegado y `b5c04f93`
(`git diff ab78ca92^ HEAD -- package.json` sale vacío). No hace falta `npm ci`.

```powershell
# EN EL PC — empaquetar SOLO lo que viaja a producción (tests/ NO viaja)
Set-Location "C:\Proyectos Programación\SG-SST-E\sgsst-electron-app\firma-service"
Compress-Archive -Path src,web,scripts,package.json,package-lock.json `
  -DestinationPath "$env:TEMP\kair-firma-b5c04f93.zip" -Force
scp "$env:TEMP\kair-firma-b5c04f93.zip" javier@192.168.1.11:/tmp/
```

```bash
# EN EL SERVIDOR
sudo systemctl stop kair-firma
sudo cp -r /opt/kair-firma/app /opt/kair-firma/app.bak-$(date +%Y%m%d-%H%M%S)
cd /tmp && sudo unzip -o kair-firma-b5c04f93.zip -d /opt/kair-firma/app
sudo chown -R kairfirma:kairfirma /opt/kair-firma
```

> ⚠️ **El zip de `Compress-Archive` (PowerShell 5.1) guarda las rutas con
> `\`, y en Linux ese `\` es parte del NOMBRE del archivo.** La extracción
> "funciona" y deja archivos planos llamados `src\server.js`: el código nuevo
> nunca llega a su lugar y el servicio reinicia con el viejo (pasó el
> 2026-10-22). Empaquetar con `tar -czf` (bsdtar, viene en Windows 10+) y
> extraer con `tar -xzf`, o extraer con el one-liner de `python3` que
> normaliza el separador. El detalle y la verificación están en
> [MIGRACION-SERVIDOR-FIRMA.md §5.1](../../MIGRACION-SERVIDOR-FIRMA.md).

**Aplicar las migraciones explícitamente** (aunque el servicio las corre al
arrancar, verlas en el log es la prueba):

```bash
cd /opt/kair-firma/app
sudo -u kairfirma node src/db/migrate.js 2>&1 | tee /tmp/migrate.log
grep -c "Aplicando migración" /tmp/migrate.log     # debe dar 15 (019..033)
```

Si `node src/db/migrate.js` complain de variables faltantes, es que falta la
llave maestra (R1): **parar ahí**, no arrancar el servicio.

```bash
sudo systemctl start kair-firma
sudo systemctl status kair-firma
sudo journalctl -u kair-firma -n 50 --no-pager
```

### Las 15 migraciones son ADITIVAS

Verificado en el código: `019`, `022`, `026` y `033` son `ALTER TABLE ... ADD COLUMN` y
`CREATE TABLE IF NOT EXISTS`; **ninguna reescribe ni borra filas**. No hay
backfill: las filas viejas se reescriben solas la primera vez que se tocan
(`019` §COMPATIBILIDAD, `022` §Backfill). Los tokens ya emitidos siguen
resolviendo porque `tokenHashCandidates` prueba el anillo, el formato v1 y el
**SHA-256 pelado** (`src/crypto/token.js:123-134`).

La **033** (`033_retencion_por_documento.sql`) agrega las cuatro columnas del
catálogo de retención por documento (`categoria_retencion`, `regla_retencion`,
`fecha_terminacion`, `plazo_retencion_aplicable`) y un índice. **No toca
ninguna fila**: las solicitudes anteriores quedan con las cuatro columnas en
`NULL` y siguen funcionando con la tabla de la Empresa, exactamente como antes
del catálogo. Es la que habilita la **custodia de 80 años** que aplica el
código (y el hold sin término del contrato electrónico); la Empresa ya no
tiene que declarar `plazo_retencion_dias`. Ver
[API §6.13.6](API.md#6136-el-catálogo-de-retención-por-tipo-de-documento).

> **Ojo con el orden**: el código nuevo INSERTa esas cuatro columnas. Si se
> copiase el código **sin** aplicar la 033, el alta de solicitudes fallaría con
> un error de columna inexistente. Por eso la 033 va **antes** de arrancar el
> servicio, no después.

Excepción a vigilar: `020_eventos_append_only.sql` lleva la directiva
`-- @skip-when-env test`; en producción **sí** se aplica (crea los triggers
append-only de `gh_firma_eventos`). Después de aplicarla, la tabla de eventos
**no admite UPDATE ni DELETE**: es el comportamiento buscado, pero significa
que un script de corrección manual sobre esa tabla va a fallar.

---

## 6. La decisión del Acuerdo (R3) — la parte que NO es técnica

La v1.0 legal está sellada (`sha256 52a490a4…`) y **no existe** un texto v1.1
legal en el repo (la v1.1 de la 10.4 era un fixture sintético de test). La 11A
sigue con el abogado.

**Si la consulta de la Fase 0 muestra que producción NO tiene ninguna `v1.0`:**

- Publicar la legal como `v1.0` por la API admin:
  ```bash
  # EN EL SERVIDOR: armar el cuerpo con el TEXTO DEL ARCHIVO (no pegado a mano)
  cd /opt/kair-firma/app
  sudo -u kairfirma node -e "
    const fs=require('fs');
    const texto=fs.readFileSync('scripts/fixtures/acuerdo-v1.0.txt','utf8');
    fs.writeFileSync('/tmp/acuerdo-cuerpo.json', JSON.stringify({
      version:'v1.0', texto, activa:true, creado_por:'rh:despliegue-2026-10-20'
    }));
    console.log('cuerpo listo:', fs.statSync('/tmp/acuerdo-cuerpo.json').size, 'bytes');
  "
  curl -sS -X POST https://firma.kair.fyi/internal/admin/acuerdo-versiones \
    -H "X-Admin-API-Key: $(cat /opt/kair-firma/admin-key.txt)" \
    -H "Content-Type: application/json" \
    --data-binary @/tmp/acuerdo-cuerpo.json
  ```
  Después: `sudo -u kairfirma node scripts/archivar-acuerdo.js --version=v1.0 --verificar` → **exit 0**.

**Si la consulta muestra una `v1.0` de PRUEBAS en producción:**

| Camino | Qué implica | Recomendación |
|---|---|---|
| A. Borrar la fila de pruebas y publicar la legal como `v1.0` | Si hay **consentimientos aceptados** bajo esa v1.0, sus `hash_texto_acuerdo` apuntan al texto de pruebas: la copia que el firmante puede bajar (el 5.4) ya no sería la que aceptó. **Evidencia rota.** | Solo si `gh_consentimientos_firma` está **vacía** para esa v1.0. |
| B. Publicar la legal como `v1.1` | Las solicitudes nuevas ligan a `v1.1` y las viejas a `v1.0`: los dos textos siguen resolviéndose. **Pero** el archivo del repo se llama `acuerdo-v1.0.txt` y el manifiesto lo sella como `v1.0`: hay que archivarlo además como `v1.1` (copia del archivo + entrada en el manifiesto). | **El camino seguro** si hay evidencia. |

> El número de versión **no es un etiqueta**: es la llave con la que el
> consentimiento apunta al texto que el firmante leyó. Cambiar el texto que
> hay detrás de una versión ya aceptada rompe la prueba, aunque el texto nuevo
> sea mejor.

**La pregunta que decide entre A y B:** ¿hay consentimientos aceptados bajo esa
v1.0? Sale de la consulta de la Fase 0. Si hay uno solo, es el camino B.

---

## 7. Fase 3 — Verificar el despliegue

```powershell
# Desde el PC: la prueba de humo (solo lectura)
Set-Location "C:\Proyectos Programación\SG-SST-E\sgsst-electron-app\firma-service"
node scripts/smoke-produccion.js --url=https://firma.kair.fyi
```

```bash
# EN EL SERVIDOR: el Acuerdo vigente y su huella (con la llave interna)
cd /opt/kair-firma/app
sudo -u kairfirma node -e "
  const db=require('./src/db/connection');
  const v=db.prepare('SELECT version, texto_hash, activa FROM gh_firma_acuerdo_versiones WHERE activa=1').get();
  console.log(v);
"
sudo -u kairfirma node scripts/archivar-acuerdo.js --version=v1.0 --verificar
# exit 0 = el archivo sigue cuadrando con lo publicado
```

| Evidencia | Resultado esperado |
|---|---|
| `GET /health` | 200, `checks.db=ok` |
| `POST /api/solicitudes` (con `--canal-datos`) | **201** (antes del despliegue daba 404) |
| `gh_firma_schema_migrations` | 32 filas (001–014, 016–032) |
| `journalctl -u kair-firma` | "Aplicando migración" × 14 |
| `archivar-acuerdo.js --verificar` | exit 0 |

> La fila que crea `--canal-datos` es una **solicitud de prueba** en el canal de
> datos: marcarla como prueba y cerrarla desde la consola.

---

## 8. Fase 4 — La prueba de extremo a extremo

```bash
# EN EL SERVIDOR (tiene la llave interna)
cd /opt/kair-firma/app
sudo -u kairfirma node scripts/smoke-produccion.js \
  --url=https://firma.kair.fyi \
  --interno-file=/opt/kair-firma/internal-key.txt \
  --e2e --confirmar-e2e \
  --empresa=<ID_EMPRESA> --trabajador=CC-PRUEBA --correo=<correo-de-prueba>
```

Lo que tiene que pasar, en orden:

1. **Creación** (`POST /internal/sign-requests`) → `201`, con `agreement_hash`
   igual a la huella del Acuerdo vigente.
2. **Correo**: llega la invitación con el enlace. `checks.smtp` **no** prueba
   esto (el health solo mira que las variables existan): probarlo de verdad con
   el `verify()` de `MIGRACION-SERVIDOR-FIRMA.md` §5.
3. **Mini-app**: abrir el enlace en el celular, leer el Acuerdo, marcar la
   casilla, identificar, recibir el OTP, firmar.
4. **Constancia**: descargarla y verificar que trae la huella del Acuerdo, el
   hash del documento y la fecha de aceptación.

Si el paso 1 responde **`409 EMPRESA_NO_HABILITADA`**, el servicio está bien y
lo que falta es el alta de la Empresa (Anexo firmado + plazo + `canal_pqrs`).
No es un fallo del despliegue: es el control del D-03, y la §2 (R2) lo anticipa.

---

## 9. Rollback

Todo el despliegue es reversible: el código anterior está en
`app.bak-<fecha>` y la base anterior en `backups/firma-<fecha>.sqlite`.

```bash
sudo systemctl stop kair-firma
sudo rm -rf /opt/kair-firma/app
sudo cp -r /opt/kair-firma/app.bak-<fecha> /opt/kair-firma/app
sudo chown -R kairfirma:kairfirma /opt/kair-firma
sudo systemctl start kair-firma
curl -sS https://firma.kair.fyi/health
```

**La base NO se deshace** (las migraciones son aditivas y el código viejo las
tolera: columnas de más no rompen un `SELECT *` controlado). Si aun así se
quiere volver atrás:

```bash
sudo systemctl stop kair-firma
sudo cp /opt/kair-firma/backups/firma-<fecha>.sqlite /opt/kair-firma/data/firma.sqlite
sudo rm -f /opt/kair-firma/data/firma.sqlite-wal /opt/kair-firma/data/firma.sqlite-shm
sudo systemctl start kair-firma
```

> `TOKEN_ENCRYPTION_KEY` **no se borra** al hacer rollback: el código viejo no la
> usa, y volver a ponerla después no cuesta nada. Borrarla sería un error.

---

## 10. Lo que este despliegue NO hace

- **No** publica la v1.1 del Acuerdo (sigue con el abogado).
- **No** enciende `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP` (el D-02): falta el
  inventario del buzón corporativo y la v1.1.
- **No** cambia el destino del OTP, ni el texto del Acuerdo, ni las
  contrapartes del D-02.
- **No** borra ni purga datos: la 5B (migraciones 024/025) queda **apagada**
  hasta que se declare el plazo y se corra el inventario.
- **No** rota ninguna llave.

---

## 11. Lo que sigue de este plan

| # | Qué | Quién |
|---|---|---|
| 1 | Dar acceso SSH o ejecutar las fases 0–4 a mano | owner |
| 2 | Responder 0.1: ¿el servicio ya opera con clientes y firmas reales? | owner |
| 3 | Correr `inventario-buzon-corporativo.js` sobre la copia | Fase 0 |
| 4 | Correr `inventario-empresas-no-habilitadas.js` y avisar a las empresas listadas | Fase 0 |
| 5 | Decidir A o B de la §6 según los consentimientos existentes | owner |
| 6 | Con el dato del inventario, decidir la bandera del D-02 | owner |

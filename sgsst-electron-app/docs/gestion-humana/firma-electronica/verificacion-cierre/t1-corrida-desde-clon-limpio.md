# T1 - Corrida de la suite completa desde un clon limpio del repositorio

Acta de la verificacion del punto **M.17** del mapa de la meta
(`meta-para-abrir-a-empresas-reales-2026-11-12.md`, bloque M.17) y del
requisito **T1** del cuadro canonico: la entrega tiene que poder reproducirse
desde un clon limpio del repositorio, no solo desde el arbol de trabajo del
owner con sus dependencias ya instaladas y su `.env` local.

**Fecha.** 12-nov-2026, de 14:41 a 15:18 (hora de Colombia).
**Donde.** Windows, PowerShell 5.1. El clon queda en `%TEMP%\kair-t1\clone`
(`C:\Users\Usuario\AppData\Local\Temp\kair-t1\clone`) y **no** se borro.
**Estado.** **T1 cerrado como metodo.** La corrida desde el clon limpio
reproduce exactamente el resultado del arbol del owner, dos veces, con el
conjunto de nombres de prueba identico. Queda pendiente una re-corrida sobre
el estado **commiteado** (ver seccion 8).

> Nota de codificacion: este archivo es ASCII puro, sin tildes, con LF y sin
> BOM, por la regla del repo. Por eso el camino del repo aparece como
> `$repo` y no escrito al pie de la letra (el directorio real lleva una "o"
> acentuada: `C:\Proyectos Programaci<U+00F3>n\SG-SST-E`).

---

## 1. Que se verifico y como

### 1.1 El entorno

| Dato | Valor medido |
|---|---|
| HEAD del repo | `264d08dfde4cf29f8367bda5cd51b58a1c431783` (rama `Dev`) |
| Node de la suite | `v22.23.4` (`%LOCALAPPDATA%\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin`) |
| npm | `11.19.1` (`C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js`) |
| Runner oficial | `%TEMP%\kair-p8\runner-suite.js` (escribe la salida TAP en UTF-8) |
| Destino de las corridas | `%TEMP%\kair-p8\suite-worker-t1*.txt` |
| Red | disponible (`registry.npmjs.org` respondio HTTP 200) |

### 1.2 Los comandos, literales y en orden

```powershell
# 0) Las variables de trabajo
$repo  = "C:\Proyectos Programaci<o>n\SG-SST-E"   # raiz del repo (la que tiene PROMPT.md)
$dest  = "$env:TEMP\kair-t1\clone"
$patch = "$env:TEMP\kair-t1\trabajo.patch"
$node22dir = "$env:LOCALAPPDATA\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin"
$env:PATH = "$node22dir;$env:PATH"                # node 22 primero

# 1) CLON LIMPIO (local, sin red)
git -c core.autocrlf=false clone $repo $dest
git -C $dest config core.autocrlf false
git -C $dest rev-parse HEAD          # 264d08dfde4cf29f8367bda5cd51b58a1c431783
git -C $dest branch --show-current   # Dev
git -C $dest status --porcelain      # (vacio)

# 2) LLEVAR EL ESTADO DEL ARBOL DE TRABAJO AL CLON
# 2a) los archivos versionados que estan modificados: parche binario
git -C $repo diff HEAD --binary --output=$patch
git -C $dest reset --hard HEAD
git -C $dest apply --binary $patch            # exit 0

# 2b) los archivos NO versionados (los "??"): copia con Node
node "$env:TEMP\kair-t1\copiar-no-versionados.js" $repo $dest

# 2c) COMPROBACION: los dos arboles quedaron iguales
node "$env:TEMP\kair-t1\comparar-versionados.js" $repo $dest
git -C $repo status --porcelain
git -C $dest status --porcelain

# 3) INSTALAR DESDE CERO (dentro del clon, con node 22)
Set-Location "$dest\sgsst-electron-app\firma-service"
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" ci

# 4) CORRER LA SUITE COMPLETA (dentro del clon, con node 22)
node "$env:TEMP\kair-p8\runner-suite.js" "$env:TEMP\kair-p8\suite-worker-t1-c.txt" `
     "$dest\sgsst-electron-app\firma-service"
```

El script de copia de los no versionados (`copiar-no-versionados.js`) lee
`git status --porcelain` del repo, se queda con las entradas `??` y copia cada
una con `fs.copyFileSync` (o `fs.cpSync` si es una carpeta). `Copy-Item` esta
bloqueado en este entorno.

### 1.3 El orden de las corridas

El arbol de trabajo del owner **estaba siendo editado en paralelo** durante
esta sesion (otras rondas de trabajo), asi que se hicieron **tres** corridas
del clon, cada una sobre un estado distinto del arbol del owner, y cada una
comparada contra una corrida del arbol del owner de la misma hora:

| Corrida | Estado del clon | Hora | Archivo TAP |
|---|---|---|---|
| A | owner a las 14:52 | 14:53 - 14:59 | `suite-worker-t1.txt` |
| B | owner a las 15:02 (con el salto de `nodemailer` 10 y `zod` 4) | 15:03 - 15:08 | `suite-worker-t1-b.txt` |
| C | owner a las 15:12 | 15:13 - 15:16 | `suite-worker-t1-c.txt` |

---

## 2. La salida de `npm ci`

La del clon, con el `package-lock.json` que hay hoy en el arbol del owner
(nodemailer 10.5.0, zod 4.6.7, better-sqlite3 11.10.0, supertest 7.2.2):

```
node : npm warn deprecated prebuild-install@7.1.3: No longer maintained. Please contact the author of the relevant
native addon; alternatives are available.

added 139 packages, and audited 140 packages in 47s

33 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities

exit npm ci: 0
```

La corrida A, con el lock anterior (nodemailer 6, zod 3), dio lo mismo salvo el
aviso de vulnerabilidades, que era de la version vieja:

```
added 139 packages, and audited 140 packages in 46s
33 packages are looking for funding
  run `npm fund` for details
2 high severity vulnerabilities
exit npm ci: 0
```

### 2.1 Los devDependencies NO se perderon

Es el control explicito del encargo, porque una corrida anterior de
`npm audit fix --omit=dev` borro los devDependencies y dejo 133 archivos de
prueba en rojo. Medido **despues** del `npm ci` del clon:

```
supertest instalado: True
supertest 7.2.2
better-sqlite3 OK, sqlite 3.49.2
```

Y los nueve modulos de produccion de `dependencies` presentes: `better-sqlite3`,
`dotenv`, `express`, `express-rate-limit`, `helmet`, `multer`, `nodemailer`,
`pdf-lib`, `zod`.

---

## 3. La salida de la suite completa

Corrida C (el clon, sobre el estado del owner a las 15:12). Salida del runner
oficial, tal cual:

```
archivos de prueba: 178
--- resumen ---
# tests 2650
# pass 2648
# fail 0
# cancelled 0
# skipped 2
# todo 0
# duration_ms 266703.9731
bloques not ok: 0
exit code: 0
salida en: C:\Users\Usuario\AppData\Local\Temp\kair-p8\suite-worker-t1-c.txt

exit runner: 0
```

Las tres corridas del clon:

| Corrida | Archivos de prueba | tests | pass | fail | skipped | exit |
|---|---|---|---|---|---|---|
| A (14:53) | 176 | 2624 | 2622 | **0** | 2 | 0 |
| B (15:03) | 177 | 2630 | 2628 | **0** | 2 | 0 |
| C (15:13) | 178 | 2650 | 2648 | **0** | 2 | 0 |

El TAP completo de cada corrida esta en `%TEMP%\kair-p8\suite-worker-t1.txt`,
`...-b.txt` y `...-c.txt` (5.6 MB cada uno, UTF-8). Los `not ok` son **0** en
las tres.

---

## 4. La comparacion con la corrida del arbol del owner

Las corridas del arbol del owner que sirvieron de referencia (mismo runner,
mismo Node 22):

| Corrida del owner | Hora | Archivo TAP | Resultado |
|---|---|---|---|
| `suite-17.txt` | 14:34 | `%TEMP%\kair-p8\suite-17.txt` | 2624 tests, 2622 pass, 0 fail, 2 skipped |
| `suite-worker-audit.txt` | 15:02 | `%TEMP%\kair-p8\suite-worker-audit.txt` | 2630 tests, 2628 pass, 0 fail, 2 skipped |

La comparacion no fue solo de los numeros: se comparo **el conjunto de nombres
de las 2 624 pruebas** (las lineas `# Subtest:` del TAP, ordenadas) y las
**lineas `ok N - ... # SKIP`**.

```
owner 14:34 (suite-17)          vs clon A (14:53) : nombres identicos = true | skips identicos = true
owner 15:02 (suite-worker-audit) vs clon B (15:03) : nombres identicos = true | skips identicos = true
owner 15:02 (suite-worker-audit) vs clon C (15:12) : solo en el clon = 20 tests nuevos
```

Los 20 tests de la ultima fila no son una diferencia: son **archivos de
prueba nuevos** que el arbol del owner recibio entre las 15:02 y las 15:12
(`tests/routes/health.test.js` y `tests/scripts/probar-reversion.test.js` mas
lo que se sumo a `src/routes/health.js`). El arbol del owner crecio durante la
sesion; el clon lo seguia.

### 4.1 Los dos omitidos, cuales son

Los mismos dos en las cinco corridas (owner y clon), y son **omitidos
deliberados en el codigo**, no fallos:

1. `internalServerLimiter: Capa 1 (id_empresa) 429 incluye headers IETF`
   - `tests/middleware/rateLimit-headers.test.js:185`
   - `t.skip('Capa 1 con 720 requests es muy lento; ...')`
2. `sec. 4.2: cliente omite document_hash del metadata -> SKIP (zod schema lo requiere)`
   - `tests/routes/signRequest-pdf-validation.test.js:318`
   - `t.skip('zod schema requiere document_hash; no se puede omitir sin cambiar el schema (fuera de scope)')`
   - (en el TAP el nombre arranca con el signo de seccion `U+00A7`; aqui se
     escribe `sec.` para mantener el archivo ASCII)

Lineas del TAP, identicas en el owner y en el clon:

```
ok 846 - internalServerLimiter: Capa 1 (id_empresa) 429 incluye headers IETF # SKIP Capa 1 con 720 requests es muy lento; ver internalServerLimiter.test.js para test de isolation, y test de Capa 4 mas abajo para headers IETF
ok 1657 - sec. 4.2: cliente omite document_hash del metadata -> SKIP (zod schema lo requiere) # SKIP zod schema requiere document_hash; no se puede omitir sin cambiar el schema (fuera de scope)
```

### 4.2 El estado del arbol: identico byte a byte

Al final de la sesion, con el clon sincronizado al ultimo estado del owner:

```
archivos versionados: 4781
identicos: 4780
diferentes: 0
ausentes en el clon: 0
```

(La entrada que no se compara como archivo es un directorio/submodulo.) Los
**4 780 archivos versionados** son byte a byte los del arbol del owner
(sha256), y los **17 no versionados** tambien.

`git status --porcelain` del owner y del clon, comparados linea por linea:
**identicos: True**.

---

## 5. Un hallazgo que hay que dejar escrito: el `core.autocrlf`

El primer clon se hizo con la configuracion por defecto de la maquina y
**no reproducia el arbol del owner**:

- `C:\Program Files\Git\etc\gitconfig` (configuracion del sistema) tiene
  `core.autocrlf = true`.
- El repo del owner tiene `core.autocrlf = false` en su `.git/config` local
  (que pisa al del sistema).
- Con `autocrlf = true`, el checkout del clon materializo **2 697 de los
  4 781 archivos versionados con CRLF**, cuando el blob y el arbol del owner
  los tienen en LF. Ejemplo medido: `PROMPT.md` en el clon tenia 2024 CRLF
  (288 835 B) y en el owner 0 CRLF (286 811 B); `.gitignore` idem.

Por eso el clon se tiene que hacer con `-c core.autocrlf=false` (y dejar ese
valor en el clon). Con eso, el checkout escribe los bytes del blob y el clon
si coincide con el arbol del owner. Sin eso, un clon "limpio" en esta maquina
**no** es el arbol del owner, y cualquier prueba que mire bytes (EOL, huellas)
puede dar un resultado distinto.

Ojo con un detalle del camino: `git reset --hard` **no** reescribe los
archivos que el indice ya da por buenos, asi que poner `autocrlf = false`
despues del `clone` no alcanza: hay que rehacer el clon con la opcion de
linea de comandos, o forzar el checkout con `git checkout-index -a -f`.

---

## 6. Que se toco y que NO se toco

### Se toco

- **El clon** (`%TEMP%\kair-t1\clone`): todo lo que se ejecuto. Clonado,
  parche, copia de no versionados, `npm ci` y tres corridas de la suite. El
  clon tiene su **propio** `data/test.sqlite` y su **propio** `storage-test/`
  (las rutas del servicio son relativas a su raiz), asi que no colisiona con
  ninguna otra corrida.
- **La cache de npm** de la maquina: `npm ci` escribio en ella.
- **Este acta**, en el repo del owner.

### NO se toco

- **El arbol de trabajo del owner**: no se modifico **ningun** archivo de
  contenido. Solo se usaron comandos de lectura (`git status`, `git diff`,
  `git ls-files`, `git rev-parse`, `git hash-object`, `git check-ignore`) y
  `git apply` se aplico **dentro del clon**, nunca en el owner. Unica
  salvedad honesta: `git status` puede refrescar la cache de estadisticas del indice
  (`.git/index`); es metadato del git, no contenido del repo.
- **El servidor**: no se toco. **No hubo ni una sola conexion SSH.** Todo
  fue local.
- **El `node_modules` del owner**: no se toco. El clon instalo el suyo desde el
  lockfile.
- **El `.env` del owner**: no se copio al clon (el clon **no tiene** `.env`).
  La suite no lo necesita: `tests/setup.js` fija todas las variables que
  `src/config.js` exige.
- **No se commiteo ni se hizo `git add` de nada.** El unico archivo nuevo en
  el repo es este acta.

---

## 7. Que prueba y que NO prueba

### Prueba

- **La suite del `firma-service` no depende de las dependencias ya instaladas
  del owner**: el clon las instalo desde cero con `npm ci` y desde el
  `package-lock.json`.
- **La suite no depende del `.env` del owner**: el clon no tenia `.env` y dio
  el mismo resultado (el `dotenv` de `src/config.js` no encuentra el archivo
  y `tests/setup.js` fija lo que hace falta).
- **La suite no depende de una base ni de un storage previos**: el clon no
  tenia `data/test.sqlite` ni `storage-test/`; los creo `tests/setup.js`.
- **La suite no depende de los fixtures ignorados** `scripts/fixtures/acuerdo-v1.1.txt`
  y `acuerdo-v1.2.txt`: no se copiaron (estan en `.gitignore` a proposito) y el
  resultado fue el mismo.
- **La entrega es reproducible desde un clon limpio**, con la reserva del
  punto 8.1.

### NO prueba

- **Que el servidor de produccion corresponda**: el servidor no se toco y no
  se comparo nada contra el.
- **Que la app de escritorio (Electron) arranque o empaquete**: solo se corrio
  la suite del `firma-service`. La suite de escritorio (152 pruebas) **no** se
  corrio en el clon.
- **Que `npm ci` funcione sin red**: en esta maquina hubo red
  (`registry.npmjs.org` respondio HTTP 200). La ruta `npm ci --offline` no se
  ejercito.
- **Que un clon de `HEAD` basta por si solo**: la ronda todavia no esta
  commiteada (ver 8.1).
- **Que el clon y el arbol del owner sigan iguales al dia siguiente**: el arbol del owner
  es un blanco en movimiento (ver 8.2).

---

## 8. Que queda pendiente y quien lo tiene

### 8.1 Re-corrir T1 sobre el estado commiteado - el equipo, al commitear

La corrida desde el clon limpio se hizo sobre `HEAD` **mas** el trabajo
sin commitear de la ronda, que hubo que trasladar a mano (parche + copia de
los no versionados). Mientras la ronda no este commiteada, un clon de `HEAD`
**no** contiene el trabajo de la ronda, y por eso el clon "limpio" todavia no
es el entregable de punta a punta.

Cuando la ronda se commitee, T1 se cierra de verdad: el clon sale del commit,
`npm ci` y la suite, y no hay nada que trasladar a mano. El metodo ya esta
probado y medido; lo que falta es la corrida.

### 8.2 El arbol del owner se movio durante la sesion - el equipo

Otras rondas de trabajo editaron el arbol del owner mientras corria la suite. El
numero de tests subio de 2 624 a 2 650 solo porque se agregaron archivos de
prueba. Al final de la sesion, el ultimo archivo nuevo
(`tests/scripts/probar-reversion.test.js`, 9 tests) se verifico **por
separado** en el clon, en verde:

```
# tests 9
# pass 9
# fail 0
# skipped 0
```

Asi que el estado del owner al final de la sesion deberia dar **2 659 tests,
2 657 pass, 0 fail, 2 skipped**. Ese numero **no** esta medido con una
corrida completa: es la suma medida (2 650 + 9). Cuando el arbol se quiete,
corre la suite completa en el owner y en el clon y compara.

### 8.3 Dejar escrita la trampa del `core.autocrlf` - el equipo

El punto 5 deberia entrar en la lista de trampas del repo (`PROMPT.md`): un
clon en esta maquina, con el `core.autocrlf = true` del Git del sistema, no
reproduce el arbol del owner. Sin esa nota, el proximo que clone y compare
puede perder horas en un diff de 2 697 archivos que en realidad son finales de
linea.

### 8.4 Lo que queda del mapa, sin relacion con T1

M.17 es el punto que cierra esta acta. Los demas (M.18, M.19 y los que
siguen) siguen abiertos y **no** los toco esta sesion.

---

## 9. Anexo: donde queda cada cosa

| Cosa | Ruta |
|---|---|
| Clon (no se borro) | `%TEMP%\kair-t1\clone` |
| Primer clon descartado (checkout con CRLF) | `%TEMP%\kair-t1\clone-crud-autocrlf-true` |
| Parche del arbol de trabajo | `%TEMP%\kair-t1\trabajo.patch` |
| Script de copia de no versionados | `%TEMP%\kair-t1\copiar-no-versionados.js` |
| Script de comparacion byte a byte | `%TEMP%\kair-t1\comparar-versionados.js` |
| TAP de la corrida A | `%TEMP%\kair-p8\suite-worker-t1.txt` |
| TAP de la corrida B | `%TEMP%\kair-p8\suite-worker-t1-b.txt` |
| TAP de la corrida C | `%TEMP%\kair-p8\suite-worker-t1-c.txt` |
| TAP de la corrida del owner (14:34) | `%TEMP%\kair-p8\suite-17.txt` |
| TAP de la corrida del owner (15:02) | `%TEMP%\kair-p8\suite-worker-audit.txt` |

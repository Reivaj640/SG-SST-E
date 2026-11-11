# Node 22 y `better-sqlite3`: por qué el gate no corría y cómo se destrabó (11-nov-2026)

> Documento de operación. Es la nota que deja por escrito **qué impedía medir el gate
> `primera_firma` en la máquina del owner**, **cuál era la causa real** (que no era la que se
> sospechaba) y **cuál es el comando exacto** que deja el servicio medible.
>
> **Estado:** RESUELTO el 11-nov-2026. El gate y la suite **vuelven a correr** en local. No se
> cambió ni una línea de código versionado: `package.json` y `package-lock.json` quedaron
> intactos y `node_modules/` está ignorado por git (`.gitignore:33`).
>
> **Decisión del owner (11-nov-2026):** recompilar con **Node 22** (ABI 127). Es además el
> runtime heredado que el servidor debe usar, así que el binario que se compila es el mismo
> que va a correr en producción.

---

## 1. El síntoma

El auditor del gate y la suite del `firma-service` morían al arrancar:

```
Error: The module '...\node_modules\better-sqlite3\build\Release\better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 136. This version of Node.js requires NODE_MODULE_VERSION 137.
    at Object..node (node:internal/modules/cjs/loader:2126:18)
    at Module.load (node:internal/modules/cjs/loader:121:5)
    at require (node:internal/modules/cjs/loader:1085:19)
    at bindings (...\node_modules\bindings\bindings.js:121:16)
```

El binario en disco pesaba **1 906 176 bytes**, con fecha **5-oct-2026**, y estaba compilado
para **NODE_MODULE_VERSION 136**.

## 2. Los Node disponibles y ninguno servía

| Node | Versión | `process.versions.modules` | ¿Sirve el binario? |
|---|---|---|---|
| El del `PATH` (`C:\Program Files\nodejs\node.exe`) | v26.10.0 | 147 | No |
| `npx node@24` (caché de npx) | v24.22.2 | 137 | No |
| `npx node@22` (caché de npx) | v22.23.4 | **127** | **Sí, recompilando** |

## 3. La causa real (y por qué el plan inicial no servía)

El plan inicial era «descargar el binario oficial, sin compilar». **Es falso**, y se verificó
contra el release oficial (`WiseLibs/better-sqlite3`, tag `v11.10.0`, publicado 2025-05-07,
116 assets):

1. **El paquete no trae el campo `binary`.** El `package.json` de `better-sqlite3` 11.10.0
   tiene las claves `name, version, description, homepage, author, repository, main, files,
   dependencies, devDependencies, scripts, license, keywords` — **y nada más**. Sin ese campo,
   `prebuild-install` no sabe qué módulo descargar y su salida cae directo a
   `node-gyp rebuild --release`.
2. **No existe el asset para Node 24.** En el release sí hay
   `better-sqlite3-v11.10.0-node-v127-win32-x64.tar.gz` (Node 22), `node-v115` (Node 20) y
   `node-v131` (Node 23), **pero no `node-v137`** (Node 24). Por eso Node 24 siempre exige
   compilar.
3. **La compilación contra Node 26 falla, y no por falta de compilador.** La máquina **sí**
   tiene Visual Studio Build Tools 18
   (`C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\MSBuild\Current\Bin\MSBuild.exe`).
   La compilación avanza y muere en el C++:

   ```
   src\util\binder.lzz(40,37): error C2039: 'GetPrototype': no es un miembro de 'v8::Object'
       C:\Users\Usuario\AppData\Local\node-gyp\Cache\26.10.0\include\node\v8-object.h(262,17)
   ```

   Es decir: **la versión 11.10.0 de `better-sqlite3` no compila contra la V8 de Node 26**
   (se quitó `v8::Object::GetPrototype`). No es un problema de esta máquina: es de la
   combinación de versiones.

> **Conclusión:** la única vía era **compilar contra Node 22**, que es justo el runtime que
> el servidor debe usar.

## 4. El comando que lo resuelve

En PowerShell, `npm` resuelve a `npm.ps1` y la política de ejecución lo bloquea; hay que usar
`npm.cmd`. Y hay que poner **Node 22 delante en el `PATH`**, porque el script de compilación
resuelve `node` desde el `PATH` (no del proceso que invoca npm):

```powershell
cd C:\Proyectos Programación\SG-SST-E\sgsst-electron-app\firma-service

$node22dir = "$env:LOCALAPPDATA\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin"
$env:PATH = "$node22dir;$env:PATH"

node --version        # debe imprimir v22.23.4
& "C:\Program Files\nodejs\npm.cmd" rebuild better-sqlite3
```

Salida: `rebuilt dependencies successfully` (exit 0). El binario queda regenerado en
`node_modules/better-sqlite3/build/Release/better_sqlite3.node`.

> ⚠️ **Si cambia la versión de Node, hay que recompilar.** El binario es específico de un ABI.
> Y si el servidor se actualiza a Node 26, `better-sqlite3` 11.10.0 **no** compila: habría que
> subir de versión del paquete (lo que toca `package.json` y `package-lock.json` y exige
> decisión del owner).

## 5. Lo que se midió después (11-nov-2026, con Node 22)

| Control | Resultado |
|---|---|
| Suite completa del `firma-service` (`npm test`) | **2 574 tests · 2 572 verdes · 0 rojos · 2 omitidos** (198 s) |
| Gate `primera_firma` | **42 ítems · 33 ok · 5 pendientes · 1 aviso · 3 no_aplica** · `listo: false` |
| `node scripts/actualizar-manifiesto-1047.js --check` | **0** — el manifiesto está al día |
| `node scripts/generar-anexo-encargo.js --check` | **0** — `legal/anexo-encargo.html` y `sitio/anexo-encargo.html` idénticos (`0cd6c05f…`) |
| App de escritorio (`test-anexos-1038/1041/1042`) | **33 verdes · 0 rojos** |
| `main/test-secretos-1047.js` | **16/16** |
| `main/test-email-env-931.js` | **33/33** |

### Los 5 pendientes del gate `primera_firma`, uno por uno

| # | Ítem | Grupo | Real o artefacto |
|---|---|---|---|
| 1 | `firmado_nube` | `anexo_nube` | **REAL** — la v1.2 no está suscrita |
| 2 | `contrafirma_nube` | `anexo_nube` | **REAL** — falta el segundo acto de K+AIR |
| 3 | `estado_encargo` | `anexo_encargo` | **REAL** — el 2026-11-09 no está suscrito |
| 4 | `publicado` | `acuerdo_v1_1` | Artefacto: la base local no tiene versión activa del Acuerdo |
| 5 | `aprobacion_operativa_vigente` | `acuerdo_v1_1` | Artefacto: la base local no tiene versión activa del Acuerdo |

Aviso: `empresas_nube` («en este ambiente no se exige el Anexo de Nube; en producción se exigirá
a cada empresa activa»). `mail_provider_dpa` = **ok** (P1 cerrado). `google_dpa` = **no_aplica**.
El grupo `d03` quedó **listo** en esta corrida (antes pedía la bitácora de excepciones): la base
local sí tiene las tablas y el trigger de las migraciones 035/036.

### Lo que sigue siendo un artefacto de la base local

`data/manual-8bc/firma.sqlite` **no tiene** las tablas ni columnas de la migración `060`
(`gh_firma_anexo_nube_suscripciones`, `anexo_nube_firmado_at`, `anexo_nube_ejecutado_at`):
el archivo tiene fecha **27-oct-2026**, anterior a esa migración, y **`data/` no está
versionada por git** (no es un cambio del código). Por eso:

- `scripts/actualizar-manifiesto-anexo-nube.js --check` → **exit 3**
  (`no such table: gh_firma_anexo_nube_suscripciones`) — **preexistente**, no lo causa este
  trabajo.
- `scripts/preflight-anexo-nube.js` → **exit 3** (`no such column: anexo_nube_firmado_at`)
  en lugar del exit 5 de «no hay ninguna Empresa activa con el Anexo de Nube suscrito sobre el
  texto vigente». El preflight **sí** imprime el bloque de la facultad (representante legal
  «Javier Robles Fontalvo», 0 poderes vigentes, `FIRMA_ADMIN_ACTOR` no definido porque el
  `.env` local no lo trae) y la huella del texto coincide con la del manifiesto
  (`242037b3…1f7245`).

**El preflight que decide la compuerta se corre en el servidor, no en esta base local.**

## 6. Lo que NO se hizo

- No se cambió `package.json`, ni `package-lock.json`, ni ningún archivo versionado.
- No se tocó la base local de datos (su fecha sigue en 27-oct-2026; solo se refrescó el WAL al
  abrirla en modo WAL).
- No se commiteó nada, no se pusheó nada, no se desplegó nada.
- No se encendió `FIRMA_EXIGIR_ANEXO_NUBE`, no se abrió producción a trabajadores reales.

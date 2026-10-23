# K+AIR — Prompt Operacional v2.0

> **Este archivo es un ÍNDICE, no una fuente de verdad.**
> Deliberadamente **no** repite la paleta, las clases CSS ni los tokens: viven en el código
> y en `design_system.md`, y copiarlos aquí es exactamente lo que dejó obsoleto al prompt v1.
> Si un valor de este documento contradice al repo, **manda el repo** y hay que corregir esto.

**Para:** cualquier modelo que **extienda, mantenga y evolucione** K+AIR.
**No es** para prototipar ni reinventar. La arquitectura, los contratos y los patrones ya existen.

**Rama de trabajo:** `Dev-Pc`. El remoto por defecto es `Dev`.
**Versión al escribir:** `0.1.238` · 📦858-859 (mini-calendario con filtro por día, compositor en pila).

---

## 1. Las fuentes de verdad — lee esto primero

Antes de proponer cualquier cosa, lee el documento que corresponda. **No adivines valores.**

| Quiero saber… | Leer | Nota |
|---|---|---|
| Qué hace el producto, para quién, qué reglas tiene | `PRODUCT.md` (raíz) | Actualizado 2026-10-03 |
| Paleta, tokens, componentes, trampas de CSS | `sgsst-electron-app/design_system.md` | **La fuente del sistema visual** |
| Qué se decidió y por qué (bitácora) | `sgsst-electron-app/BITACORA.md` | Buscar con `grep`, no leer entero |
| Qué se cambió y cuándo | `sgsst-electron-app/CHANGELOG.md` | Por paquete `📦n` |
| Qué está en curso y qué está roto | `sgsst-electron-app/CONTEXT.md` | |
| Cómo lo ve el usuario | `sgsst-electron-app/release-notes.md` | Un H1 por versión |
| Cómo se maneja un trabajo | `sgsst-electron-app/AGENTS.md` §Protocolo | Ver §7 de este archivo |

> ⚠️ **El prompt v1 de este repo se llenó de valores viejos porque copiaba tokens.**
> No repitas ese error. Si necesitas un valor, lelo del archivo o del código.

### 1.1 Qué leer para qué tarea

| Si te tocó… | Leé, en este orden |
|---|---|
| **Cualquier cosa** (arrancás de cero) | Este archivo → `Historial.md` (estado de cierre) |
| Tocar una vista, un componente o el CSS | Este archivo §4 → `design_system.md` |
| Entender por qué una línea es así | `BITACORA.md`, **con grep**, no leer entero |
| Escribir o revisar un test | Este archivo §7 |
| Cambiar un bridge, la base de datos o el sync | Este archivo §6.2 |
| Cambiar el header o el shell | Este archivo §9 trampa #3 |
| Tocar la Bandeja Integrada | Este archivo §9 trampas #1 y #4 |
| Preparar un commit o un release | `AGENTS.md` §Protocolo + este §5 |
| Cerrar la jornada | `Historial.md` §Regla de cierre |

### 1.2 Herramientas que no leen `PROMPT.md` al arrancar

Si tu herramienta lee otro nombre de arranque, apuntá los mismos dos archivos:

| Herramienta | Archivo de arranque |
|---|---|
| Claude Code | `CLAUDE.md` (ya existe en la raíz) |
| Codex / OpenAI / Mavis / Cursor | `AGENTS.md` → ya tiene el bloque de arranque en su primera línea |
| Gemini CLI | crear `GEMINI.md` que apunte a `CLAUDE.md` |
| Cualquier otra | crear el archivo que lea y que apunte a `PROMPT.md` + `Historial.md` |

---

## 2. Mapa del repo

```
SG-SST-E/
├── PRODUCT.md                 ← qué es K+AIR
├── PROMPT.md                  ← este archivo
└── sgsst-electron-app/
    ├── main.js                ← proceso principal (22 000+ líneas): ventana, BD, registro de bridges
    ├── renderer.js            ← shell: sidebar, header, routing de módulos (7 500 líneas)
    ├── preload.js             ← ÚNICO contextBridge. Namespaces anidados
    ├── index.html             ← shell. Orden de <link> = orden de cascada
    ├── main/                  ← 30 bridges (*-bridge.js) + 111 tests + schemas
    ├── modules/               ← submódulos por dominio (gestion-salud, mejoramiento, …)
    ├── shared/                ← tokens, componentes, calendario, alertas
    ├── renderer/
    │   └── bandeja-integrada/ ← la Bandeja Integrada (app monolítica propia)
    ├── Temp/                  ← runner de tests + scripts one-shot (los `.js` SÍ se versionan: hay 13)
    └── tests/                 ← 30 tests históricos — el runner NO los ve
```

**Stack:** Electron 37.10.3 (Chromium 138) · JavaScript vanilla, **sin frameworks** ·
SQLite vía `better-sqlite3` (`main/db-instance.js`) · Python 3.11.9 embebido para el
análisis de 5 Porqués.

**Iconos:** Lucide v0.462.0 en SVG inline (`vendor/lucide.min.js`).
**CSS:** plano, BEM, prefijo `kair-`.

> Los datos de este bloque se verificaron contra el código el **2026-10-03**. Si alguno no
> cuadra con lo que encontrás, **manda el código**: corregí esta línea y reportalo.
> Versión de Python: **declarada** en `CONTEXT.md` y la carpeta `Portear/python-embed/` existe,
> pero no se ejecutó el binario para confirmar la versión.
**Formato:** `es_CO` (fechas y moneda con coma decimal). **Resolución 0312 de 2019** es la norma que gobierna cada módulo.

---

## 3. Cómo se abre un módulo

Dos mecanismos, y **no son intercambiables**:

| Mecanismo | Qué | Ejemplo |
|---|---|---|
| **Swap de DOM** (el 95 %) | `contentArea.innerHTML = ''` y se reconstruye un `.module-content-area` | Evaluación Inicial, SVE, Presupuesto |
| **Iframe fullscreen** (1 caso) | `<iframe>` fixed, `z-index: 200001`, se posiciona midiendo el alto del header real | **Bandeja Integrada** |

**Regla del sidebar:** el clic en un módulo **siempre** sale del submódulo actual antes de cambiar
(`renderer.js` · `_salirDeSubmodulo`). Si no, se quedan vivos el vigilante y los modales del submódulo
anterior. Ese fue el bug de 📦843.

**postMessage:** solo existe entre la Bandeja y el shell, con una allowlist de 3 tipos
(`bandeja-integrada-back`, `-open-config`, `-destroyed`). No inventes otros.

---

## 4. El sistema visual tiene TRES islas — no una

Esto es lo que más confunde a un modelo nuevo. **No hay una sola paleta.**

| Isla | Dónde | Paleta | Regla |
|---|---|---|---|
| **1 · Shell** | `shared/kair-design-tokens.css` → `:root` | `--kair-blue #2057b8`, `--kair-mint #1bb888`, `--kair-amber #e7a224`, `--kair-red #da5563` | **Usa solo estos** en código nuevo |
| **2 · Bandeja** | `renderer/bandeja-integrada/premium.css` → `:root` | Declara sus propios tokens y **remapea** los legacy | Documento separado, no comparte contexto |
| **3 · Calendario** | `shared/kair-calendar.css` | **`#174ea6` / `#28a745`** (paleta vieja, intacta) | No la toques sin motivo, está aislada |

**Sobre la isla 3:** el dato verificable es que `shared/kair-calendar.css` declara
`--kair-cal-primary: #174ea6`, la paleta previa al redesign. **Por qué** quedó así
(se asume que se vendorizó antes del cambio, pero eso no está documentado en el repo) no se
afirma: es inferencia. Lo que sí importa es la consecuencia práctica: **no apliques la paleta del
shell a los estilos del calendario**, y no cambies `#174ea6` sin revisar los dos calendarios.

**Dark mode:** siempre `[data-theme^="dark"]`. **NUNCA** `[data-theme="dark"]` — el selector exacto deja
sin estilo al tema `dark-legacy`, que sí existe.

**Transición:** `--kair-transition` (180 ms ease-out). Es el token más usado del sistema.

**Espaciado:** la escala `--kair-space-*` está declarada y **muerta** (0 usos). El shell usa `--spacer*`.
No inventes usos de `--kair-space-*`.

**Tipografía:** `DM Sans` (texto) + `Manrope` (títulos). Segoe/Roboto es legacy del calendario.

📖 **Todo lo demás — tokens exactos, catálogo de componentes, flex chain, tabla blindada, modal en
`<body>`, dark mode, confetti — está en `sgsst-electron-app/design_system.md`. Léelo, no lo repitas aquí.**

---

## 5. Reglas de proceso (NO están en ningún otro archivo)

Estas son las que el prompt v1 no tenía y son las que más cuestan cuando faltan.

### 5.1 Nada de commits sin palabra de permiso

| El owner dice… | Se autoriza… |
|---|---|
| "ok procede", "procede" | Editar. **NO commitear.** |
| "dale", "OK", "perfecto", "commit" | Commitear. **NO pushear.** |
| "pushea y procede con el release" | Push + tag + release |
| "bumpea la versión", "prepara el release" | Bump de versión en los archivos del §5.2 |
| "revierte" | `git reset --hard` o `git revert` inmediato |

> "ok procede" es la trampa: **autoriza cambio, no commit.** Ante la duda, no commitees.
> Pedir permiso nunca está de más; commitear sin permiso rompe la confianza.

### 5.2 La versión SOLO se bumpea cuando el owner lo dice

**No bumpees por inercia.** El número de versión no es un contador de commits: está atado al
**release**, y el release es una decisión del owner. Si el owner no lo dice explícitamente,
la versión no se toca — por mucho que el commit traiga código de app.

> **Decisión del owner (Javier Robles Fontalvo), 2026-10-07.** Antes esta regla decía
> "siempre bumpear en el mismo commit". Se cambió porque el bump automático producía un
> efecto visible y molesto: `consent:estado` compara contra `app.getVersion()`, así que
> **cada bump hacía volver a aparecer la pantalla de consentimiento legal a todos los
> usuarios**, aunque el texto legal no hubiera cambiado. Ese bug de versiones está pendiente de
> arreglo, pero la regla ya no depende de él.

**Cómo se bumpea (solo cuando lo pida):** `package.json` + `CHANGELOG.md` + `README.md` +
`release-notes.md`. `CONTEXT.md` sigue prohibido por `AGENTS.md:516`. Nunca declares en el
CHANGELOG una versión que `package.json` no tenga.

**Frases que SÍ autorizan el bump** (y solo si además autorizan commit):
"bumpea la versión", "sube la versión", "prepara el release", "haz el release".

**Lo que NO lo autoriza:** "dale", "OK", "commit", "pushea", ni el hecho de que el trabajo
sea "grande" o "de aplicación". Un commit con `package.json` en el diff sin que el owner lo
pidiera es un error, aunque el resto del commit esté perfecto.

### 5.3 Cache-bust en `index.html`

Electron cachea agresivo. **Todo CSS o JS de UI que toques, bumpea su `?v=`** en el `index.html`
de ese documento, y el token nuevo **no** puede ser igual al anterior. Formato: `?v=AAAAMMDD-descripcion`.
No dejes el token a mano: se te olvida y el CSS viejo sigue sirviéndose.

🔴 **En la bandeja, `app.js` y `premium.css` llevan el MISMO token, a propósito.** No es
uniformidad estética: si difieren, la página se sirve con dos versiones distintas de la misma release.
`test-bandeja-tudia-849.js` lo verifica y **se cayó dos veces** en 📦860 porque subí solo el `?v=`
del `app.js` que había tocado y dejé el `premium.css` en el token anterior. Los dos archivos se
suben juntos aunque no los hayas tocado a los dos.

Y subir el token de `styles.css` **no** basta: hay que subir también el del iframe en
`renderer.js` (`bandejaIntegradaFrame.src`, contador que sube de uno en uno).

### 5.4 EOL — mixto por diseño, y lo fija el test

No hay `.gitattributes`. Cada archivo tiene su EOL y **cambiarlo rompe el diff entero**
(7 000 líneas de ruido) y los tests que lo verifican.

| Archivo | EOL |
|---|---|
| `main.js`, `preload.js`, `index.html` (shell), `main/*-bridge.js`, `shared/*.css`, `renderer/bandeja-integrada/premium.css` | **LF** |
| `renderer.js`, `renderer/bandeja-integrada/app.js`, `renderer/bandeja-integrada/index.html` | **CRLF** |

**Regla:** el EOL de un archivo **queda fijado por su test**. No lo cambies sin actualizar el test.
Para editar un CRLF sin romperlo, usa reemplazos de texto que no toquen los finales de línea, y verifica
que `git diff --numstat` sigue dando pocas líneas.

🔴 **En una PC recién formateada, el `autocrlf` del instalador de Git convierte todo a CRLF en el
checkout y `git status` sigue diciendo que está limpio.** Ver §5.17 — es el escenario donde esta tabla
se viola sola, sin que nadie edite nada.

### 5.5 Prohibido CJK y mojibake

Ningún carácter de CJK, kana, cirílico o hangul en el código ni en la documentación.
La regex canónica, **escrita con escapes y nunca con los caracteres literales**:

```js
new RegExp('[\\u4e00-\\u9fff\\u3040-\\u30ff\\u0400-\\u04ff\\uac00-\\ud7af]', 'g')
```

Se colaron varias veces: en rutas de `cd`, en comentarios, en un mensaje de commit y hasta
en este mismo prompt mientras se escribía.

### 5.6 Nunca backticks dentro de una plantilla JavaScript

Un backtick sin escapar corta el literal y el script deja de parsear con un error que **no señala la
línea real**. Para documentación: placeholder (`~B~`) y se convierte con `String.fromCharCode(96)`.
Y en PowerShell: nunca uses backticks en comandos inline; para mensajes de commit, `git commit -F <archivo>`.

### 5.7 ⚠️ La ruta con "programación" se corrompe

`C:\Proyectos de programación\SG-SST-E` ya se escribió mal como `deprogramming` y con caracteres CJK
varias veces. Entra con rutas relativas o copia la ruta con cuidado. Si un `cd` falla, **no lo reintentes
a ciegas**: el error es la pista.

### 5.8 Los 5 documentos se actualizan juntos

`CHANGELOG` + `AGENTS` + `README` + `CONTEXT` + `release-notes`. Si falta uno, el próximo que lea el repo
va a encontrar la app en un estado que no existe.

**Desde el 📦896** la bitácora de bugs ya no está en `AGENTS.md`, está en `BITACORA.md`. Cuando toques
una, tocá la otra: si cambiás una regla de proceso, va en `AGENTS.md`; si cambiás el relato de un bug,
va en `BITACORA.md`. `PROMPT.md` y `Historial.md` se actualizan al **cerrar** la jornada, no al commitear.

### 5.9 🔴 Cero presunciones: nada es una regla hasta contrastarlo con el código

**Un documento que diga "X" NO es evidencia de que X sea verdad.** Este repo tiene documentos de
103 KB, 362 KB y 433 KB, y todos han contenido reglas falsas durante meses. No es tolerable asumir
que algo es una regla porque está escrito.

**Antes de afirmar cualquier cosa como si fuera una regla del proyecto, verificá:**

1. **Que la cosa exista.** Función, clase, token, archivo, comando, script. Un grep que devuelva 0 es
   la respuesta definitiva. Si no lo encontrás, **no existe** — por más que un documento diga que sí.
2. **Que siga vigente.** Los documentos no se actualizan solos. Una convención de hace 20 versiones
   puede estar reemplazada.
3. **Que el valor sea el de hoy.** Contá, no creas: números de versión, contadores, tamaños, líneas.
4. **Que applies a tu caso.** Una regla de un módulo no es la regla del shell.

**Ejemplo real de por qué (2026-10-03).** `CONTEXT.md` decía, en "Reglas de código":

> - SIEMPRE escapar HTML con `KairUI.esc()` antes de inyectar texto del usuario
> - SIEMPRE formatear fechas con `KairHelpers.formatDate()`

🔴 **CORREGIDO el 2026-10-06: el "0 archivos" de este ejemplo era FALSO.** Las dos funciones
**existen**, pero dentro de un solo módulo: `modules/verificacion/auditoria-anual/kair-ui.js:12`
define `_esc`, que se exporta como `window.KairUI.esc` (línea 383), y `kair-helpers.js:11`
define `formatDate`, exportada como `window.KairHelpers.formatDate` (línea 200). Hay 12+
llamadas reales en los `*-view.js` de ese módulo.

**El riesgo sigue siendo real, por un motivo más preciso: no están en el shell.** Se cargan
con `loadScript` desde `auditoria-anual-component.js:52/54`, o sea únicamente al abrir
Auditoría Anual. Un modelo que copie la regla al shell escribe `KairUI.esc(...)` contra un
`window.KairUI` que no está, y la vista se cae con `ReferenceError`. Dos reglas
"OBLIGATORIAS" que habrían roto la app.

**La lección no cambia, y por eso el ejemplo corregido vale más que el original:** "no lo
encontré" y "no existe" no son lo mismo que "no está disponible donde lo estabas mirando".
Antes de declarar algo inexistente, **decí DÓNDE lo buscaste**.

En la misma sección: `var` (no `let`/`const`) — falsos, `main.js` tiene 2 608 `const`. Y
"el último número de paquete es `📦579`" cuando ya van 850+.

**Cómo se comporta un modelo con esta regla:**

| Situación | Lo correcto |
|---|---|
| Te piden usar una función que no reconocés | Grepeá. Si no existe, decilo. **No la inventes.** |
| Vas a repetir una regla de un documento | Verificá contra el código antes de aplicarla |
| Escribís un número (conteo, versión, tamaño) | Medilo, no lo estimés |
| No encontrás evidencia | Decí "no encontré evidencia" — es una respuesta válida |
| Un documento contradice al código | **Manda el código.** Corregí el documento y reportalo |

**Y lo más importante: aplicala a tus propias afirmaciones.** Si este documento dice algo, ese algo
también necesita respaldo. Un prompt que exige verificar el código y después afirma cosas sin
respaldo se contradice solo.

**Nunca borres ni reescribas un archivo grande sin verificar qué tiene de único primero.** Casi
siempre hay algo que no está en ningún otro lado — y un md5 del contenido normalizado antes y
después es la forma barata de demostrar que no se perdió nada.

### 5.10 🔴 Antes de cerrar: preguntá por los documentos

**Al terminar cualquier trabajo o sección —no importa cuán chica sea— el modelo DEBE preguntar:**

> "¿Querés que actualice los documentos (`Historial.md`, `PROMPT.md`, `CONTEXT.md`) para la próxima jornada?"

**No se cierra la sesión sin haberlo preguntado.** Es la diferencia entre que el próximo modelo
arranque sabiendo qué se hizo y arranque desde cero adivinando.

Al owner le toca responder. Si dice que sí, se actualizan:

| Documento | Qué se escribe |
|---|---|
| `Historial.md` | Bloque "estado al cierre" + entrada de la jornada en la bitácora |
| `PROMPT.md` | Si apareció una **regla de proceso** nueva o una **trampa** nueva → §5 y §9 |
| `CONTEXT.md` | Si cambió el estado del proyecto o el foco de trabajo |
| `BITACORA.md` | La lección del bug, **con su "por qué se rompió"**, no solo el síntoma |
| `CHANGELOG` + `README` + `release-notes` | Al **commitear**, no al cerrar |

**Distinguir las dos cosas:** el **registro de lo que se hizo** es en `Historial.md` y va siempre;
lo que se **publica** (`CHANGELOG`, `README`, `release-notes`) va en el commit.

**Qué NO va en `Historial.md`:** el detalle técnico de una línea. Eso va en el comentario `📦n` del
código y en `BITACORA.md`. `Historial.md` es el "dónde quedé", no el "cómo lo hice".

### 5.11 🔴 Un ancla de reemplazo tiene que reponer todo lo que tape

**Aplica a cualquier script que edite un archivo con `String.replace`**, sobre todo los documentos
y los archivos grandes.

**La trampa:** insertar "antes de X" pasando `[X, textoNuevo]`. El texto nuevo **no vuelve a
contener X**, así que X desaparece. Si X es un encabezado de sección, no se pierde una línea: queda
**huérfano todo lo que venía después**, absorbido dentro de la sección nueva. El script reporta `OK`.

Pasó de verdad en 📦852: el par `['## [0.1.233] - FECHA', '<sección 0.1.234 completa>']` iba a dejar
las entradas 📦850 y 📦851 sin encabezado dentro del CHANGELOG.

**Reglas:**

1. **El ancla lleva el contexto que la rodea**, no solo la primera línea. Un archivo con un
   blockquote entre el título y el subtítulo hace que un ancla "título + subtítulo" no exista.
2. **El texto de reemplazo termina reponiendo el ancla completo.**
3. **Exigir exactamente 1 coincidencia antes de reemplazar.** Sin esto, un `replace` que no
   encuentra nada devuelve el archivo intacto y el script reporta éxito:

   ```js
   const n = s.split(from).length - 1;
   if (n !== 1) throw new Error('se esperaba 1, halladas ' + n);
   ```

4. **Respaldar antes de correr.** Un script que escribe archivo por archivo no es atómico: si el
   primero sale bien y el segundo falla, quedan estados mezclados.
5. **"El script dijo OK" no es verificación.** Comprobar por **estructura**: dónde caen los
   encabezados, debajo de cuál versión quedaron las entradas.

```js
// Verificación por estructura, no por "el script terminó sin error"
Select-String -Path CHANGELOG.md -Pattern '^## \[0\.1\.2(3[0-9])\]' | Select-Object -First 5
```

**Tres casos que el guard tiene que distinguir (📦861):**

- **x0 es un ancla mal escrita, no una falta de singularidad.** La línea buscada tenía 8
  espacios de indentación y el ancla pedía 20. El mensaje decía "no es única" y el
  problema real era otro. `if (n !== 1)` cubre los dos casos pero el mensaje tiene que
  decir cuántos, y `0` significa "no existe".
- **Un color escrito como `rgba(r, g, b, a)` tiene tantas variantes como opacidades
  existan.** El patrón `\b0\.12\b` cambiaba dos de tres y dejaba el tercero del azul viejo.
  El patrón tiene que capturar la tupla: `/rgba\(23,\s*78,\s*166,(\s*[\d.]+\s*)\)/g`.
- **Cambiar un token de color no cambia lo que está escrito a mano.** El primario estaba
  en el token *y* en 7 `rgba()` horneados con su descomposición RGB. Cambiar solo el token
  deja el focus ring y dos sombras del color viejo, y se nota al pasar el mouse. Buscá
  el color descompuesto (`23, 78, 166`) antes de dar por hecha una migración.

### 5.11b 🔴 "Son copias" NO significa "se arreglan igual"

Antes de replicar un cambio en N archivos que se parecen, **contar cuántas variantes hay**.
No porque sean copias, sino porque *lo parezcan*.

En 📦861 los 15 exploradores de archivos parecían copias (el 1.1.1 es el original),
pero:

| Unidad | Cuántas variantes |
|---|---|
| `_loadPDF` | **4** (dos llaman `_displayPDF`, dos llaman `_renderPreview`, y con argumentos distintos) |
| Enrutado del PDF en el archivo de conexión | **3** (switch, tabla de acciones, `if`) |
| Módulos sin archivo de conexión | **3** de 15 |

Y la comparación línea por línea dio **"1593 líneas distintas"** entre dos archivos casi
idénticos, porque tienen distinto número de líneas y todo se desalinea. La comparación
útil es **por bloque**: extraer la función por llaves balanceadas y comparar su hash. Ahí
salió la verdad: **14 idénticos, uno variante** (y ese último en LF contra CRLF).

**Regla:** el guard de singularidad es lo que separa "no hice nada" de "rompí N módulos".
En 📦861 el primer intento casó en **0 de 15** anclas y **no escribió nada en ninguno**;
sin el guard, se habrían escrito quince archivos con la mitad de los cambios.

Y el otro riesgo es el opuesto: **un script que busca sin filtro se pasa de alcance.** La
limpieza de un color flotó sobre **23 CSS** en vez de los 15 del grupo, y cambió 7 módulos
que nadie había pedido. Se revirtieron con `git checkout`. Un script de cambio lleva la
lista explícita de lo que puede tocar, o un filtro que no pueda salir del alcance.

### 5.11c 🔴 Un archivo generado se verifica COMPILANDO, no contando llaves

Contar llaves balanceadas **no dice que el archivo esté bien**. Una cadena sin cerrar deja
el conteo en **cero igual**: la verificación pasa y el módulo revienta al cargarlo.

En 📦861 el script que aplicaba los cambios validaba llaves y nada más; una cadena quedó sin
cerrar, pasó la verificación y habría roto el 1.1.1 al abrirlo — donde nadie lo ve, porque
**ningún test de este repo abre la app** (§7.7).

**Regla:** antes de escribir un archivo generado, `node --check` sobre el **resultado**, con
el EOL ya convertido. Contar llaves queda como filtro barato previo, nunca como prueba.

### 5.11d 🔴 Un check que lee `git show HEAD:<archivo>` mide contra la referencia equivocada

**Aplica a cualquier test que lea "lo que dice git"** para compararlo contra el archivo del disco:
EOL, colores, versionado, cualquier cosa.

**La trampa:** `HEAD` **no es "el código en el que estoy trabajando"**. Es un puntero a un commit.
Cuando se ejecuta `git merge` **sin commitear**, `HEAD` sigue apuntando a la rama **destino**, con
las versiones viejas, mientras el disco ya tiene las de la rama **origen**. El check compara dos
cosas que no tienen por qué coincidir y reporta diferencias que no existen.

Pasó de verdad el 2026-10-05 al mergear `Dev-Pc` → `Dev` (567 commits). El test de 861 pasó de
**614/614 a 585/614**: 29 checks rojos, 15 de "los colores de estado NO se tocaron" y 14 de
"conserva el EOL que tiene en git [ahora CRLF, en git LF]". La lectura obvia —"el merge corrompió
los finales de línea"— era falsa. Los bytes crudos dieron:

```
afiliacion-viewer.js
   disco          CRLF=1702  LF=0
   Dev-Pc         CRLF=1702  LF=0   <-- IDENTICO al disco
   Dev            CRLF=0     LF=998
   MERGE_HEAD     CRLF=1702  LF=0   <-- IDENTICO al disco
```

Cero corrupción. Al commitear el merge, los mismos checks dieron **614/614**.

**Reglas:**

1. **Un check que mire git debe pasar la ref explícita**, nunca `HEAD` pelado. Si tiene que
   sobrevivir a un checkout o a un merge, `HEAD` es una variable oculta.
2. **Ante un check rojo en masse durante una operación de git**, la hipótesis por defecto es
   **"el check mide contra la referencia equivocada"**, no "la operación destrozó archivos". Antes de
   tocar un byte: comparar con `git cat-file -p <ref>:<archivo>`.
3. **`git status` limpio y `git diff <otra-rama>` vacío NO prueban que el árbol esté sano**: git
   compara contenido normalizado y el disco tiene los bytes.
4. **Comparar bytes con Node**, nunca desde PowerShell:
   ```js
   execFileSync('git', ['cat-file','-p', ref+':'+rel])  // sin encoding: 'utf8'
   ```
   PowerShell con `($out = git ...) -join "\`n"` **normaliza los finales de línea** y produce una
   medición que no corresponde al archivo. Es el mismo motivo por el que hay que usar scripts en
   `Temp/` y nunca `node -e`.
5. **Un merge sano termina en "árbol idéntico a la rama origen"**:
   `git diff <rama-origen> --stat -- sgsst-electron-app` sin salida significa que el merge solo
   trajo lo que la destino tenía propio.

### 5.12 🔴 Comprobar el valor no basta: hay que comprobar la transición

**Aplica a cualquier contador, badge, aviso de novedad o "sin leer"**: todo lo que dependa de un
valor guardado de la corrida anterior.

**La trampa:** un test que afirma una propiedad **en un instante** pasa aunque la transición esté
rota. Pasó de verdad en 📦853/854. El aviso de "Correos no leídos" se calculaba como
`nuevo = actual - visto`, con `visto` guardado en `localStorage`. El test comprobaba:

> *"si baja de la línea base el aviso es 0, nunca negativo"*

Pasaba, y estaba **justo a un paso del bug**. `max(0, actual - visto)` da 0 cuando `actual` cae
por debajo — correcto en ese instante. Lo que **no** preguntaba era qué venía después: la base
guardada seguía congelada en su máximo histórico, así que el próximo correo nuevo daba
`max(0, 1 - 4) = 0`. El aviso no volvía a prender hasta juntar 5 sin leídos. Y leer el correo
fuera de la app es lo que hace el owner todos los días, así que el camino normal estaba roto.

**Reglas:**

1. **Cada `f(x)` va seguido de `f(lo que viene después de x)`.** Si el valor inicial es correcto,
   el test pasa; la transición es la que muerde.
2. **Un valor guardado es un ancla, no un hecho.** Si la realidad puede quedar **por debajo** de lo
   guardado, hay que **reanclar**: si `actual < visto`, ya no hay nada pendiente y la base debe
   volver a `actual`. Una base que solo sube se congela y silencia el aviso para siempre.
3. **Es el mismo patrón del mutante vacío** (§7): test verde sobre un caso que nunca se ejerce.
   La pregunta no es "¿el test pasa?" sino "¿qué caso NO estoy ejercitando?".
4. **Antes de tocar la aritmética, auditar el test que la vigila.** El test es donde se ve el
   punto ciego: si se detiene en un valor y no sigue, ahí está el hueco.

```js
// ❌ Solo el instante: pasa, y la transición está rota
chk('si baja de la linea base es 0', ver(sb)[0] === 0);
// ✅ El instante Y lo que viene después
chk('si baja de la linea base es 0', ver(sb)[0] === 0);
sb.state.mails = [{ unread: true }];
chk('y un correo nuevo vuelve a marcar 1', ver(sb)[0] === 1);
```

### 5.13 🔴 `node --check` no caza un error de alcance

**Aplica a todo JavaScript grande**: `renderer/bandeja-integrada/app.js` tiene 6 800+ líneas dentro
de un IIFE, y `main.js` más de 10 000.

**La trampa:** declarar una función **dentro de** otra la deja local a esa otra. Si su consumidor vive
fuera, la llamada falla con `ReferenceError` **en tiempo de ejecución**, no al parsear.

Pasó de verdad en 📦855. El predicado de filtro se declaró dentro de `renderMailList` y su consumidor,
`setMailFilter`, quedó en el nivel de arriba:

```js
function renderMailList(container) {        // nivel 1
  function mailPasaFiltroActual(m) { ... }  // NIVEL 2: local a renderMailList
  const filtered = state.mails.filter(mailPasaFiltroActual);
}

function setMailFilter(f) {                 // nivel 1, fuera
  mailPasaFiltroActual(sel);                // ReferenceError en cuanto se toca un chip
}
```

`node --check` lo da por bueno: es JavaScript válido. Leerlo lo da por bueno: la declaración está
ahí, con el nombre correcto. **Solo falla cuando el owner toca el filtro**, o sea, en producción.

**Reglas:**

1. **Un helper compartido va al nivel de sus usuarios**, nunca anidado por conveniencia. Si lo usan
   dos funciones de niveles distintos, su nivel es el de la menos anidada.
2. **Indentar es información.** `^  function nombre` (2 espacios) es de nivel superior;
   `^    function nombre` (4) está anidada. Vale la pena grepear la indentación cuando se mueve código.
3. **El escenario de un sandbox es el detector barato.** Cuando un test arma un sandbox trayendo
   solo las funciones que necesita, si una quedó anidada en el archivo real el test no la puede
   extraer y falla. Ese fallo **es** la señal, no un estorbo del test.
4. **Un check que lo vigile.** En `test-bandeja-seleccion-855.js` la extracción exige
   `^  function NOMBRE(` a propósito, para que re-anidar la función reviente el test.

```bash
# Ver si algo quedo anidado por error: cuenta y compara
grep -n "^  function renderMailList" renderer/bandeja-integrada/app.js
grep -n "^    function mailPasaFiltroActual" renderer/bandeja-integrada/app.js   # 4 = MAL
```

### 5.14 🔴 Un check que reconoce la redacción de un bug no verifica el comportamiento

**Un check escrito contra el texto exacto del bug pasado solo reconhece ESA redacción.** Si el mismo
bug vuelve con otra forma, el check pasa en verde y el bug está de vuelta.

Pasó en 📦855 con dos checks de 📦853 que buscaban `state.mailFilter = "unread";`. La mutación que
reintroducía el bug usaba otra forma… y el check aun así **pasaba**, porque buscaba la cadena
anterior, que ya no estaba. Peor: la mutación también quedaba **vacía** (el `replace` no encontraba
nada), y eso se reportaba como "el check no muerde" cuando en realidad el check ni se estaba probando.

**Reglas:**

1. **Preguntar la pregunta de verdad, no la redacción.** En vez de `!/if (state.mails[0]) { selectMail/`
   —que solo reconoce esa forma—: `!/state\.selectedMailId = [^;]*state\.mails/`. La segunda dice
   *"la selección nunca se deriva de la lista"*, y es cierto para cualquier redacción del bug.
2. **Un check de texto es un check de contrato de implementación.** Úsalo cuando la forma ES el
   contrato (un id de IPC, un nombre de clase). Si lo que importa es el comportamiento, prefiero un
   escenario en sandbox.
3. **Si una mutación queda vacía, el check no se está probando.** Es la señal de que el check apuntaba
   a algo que cambió, no de que el check sea débil.
4. **Al cambiar un contrato, los checks viejos se INVIERTEN, no se borran** (§7). Un check invertido
   dice "esto ya no debe pasar por acá" y sigue morando si alguien lo deshace.

### 5.15 🔴 Un check que se satisface con su propio comentario

**El peor tipo de check: uno que pasa porque el texto que busca está en la NOTA al lado.**

Pasó de verdad en 📦857. El CSS lleva este comentario:

```css
/* 📦857 — `overflow-y: auto` y no `hidden`. Con `hidden` la TERCERA tarjeta... */
  overflow-y: auto;
```

Y el check hacía `/overflow-y:\s*auto/.test(css)` **sobre el CSS crudo**. Encontraba la palabra en el
comentario, no en la declaración: la mutación que cambiaba la línea real a `hidden` pasaba
igualmente. El check era verde, la declaración estaba rota, y nadie lo notó.

**La regla es simple: los comentarios se quitan ANTES de verificar una declaración.**

```js
function sinComentarios(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}
const side = sinComentarios(regla(css, '.kair-sidebar'));
chk('.kair-sidebar permite scroll en Y', /overflow-y:\s*auto/.test(side));
```

Esto ya lo hacíamos con el código JS (`soloCodigo()` quita comentarios y líneas `//`). **Se estaba
aplicando al JS y no al CSS**, y ahí es donde aparece el problema, porque en este repo los
comentarios del CSS son largos y describen el arreglo.

**Cómo se delata sola**: una mutación que toca justo la línea que el check vigila y reporta **"no
morde"**. Esa señal es la que hay que perseguir, no el check verde.

**Los tres siblings de esta lección, todos vistos el mismo día:**

| Trampa | Síntoma | Se arregla con |
|---|---|---|
| Check satisfecho por su comentario | la mutación "no muerde" | quitar comentarios antes de verificar |
| Regex con ventana `[\s\S]{0,160}` | alcanza la declaración del bloque SIGUIENTE | `[^}]*` anclado a la misma llave |
| Mutación sin ancla | `replace` cambia la **primera** de las 5 ocurrencias del archivo | ancla que incluya el contexto |

Y el cuarto, que es el mismo mal de todos: **una copia de la lógica dentro del test**. Una copia es
una segunda verdad; las mutaciones del archivo no la tocan y el test pasa sin estar probando nada.
Por eso la lógica tiene que vivir en una **función pura en el archivo real** (`alcanceFechas`,
`contarTipos`) y el test la extrae tal cual.

### 5.16 🔴 Cuidado con reescribir un archivo entero para borrar un bloque

`fs.writeFileSync` con el contenido reconstruido reescribe el archivo **completo**. Si el EOL del
repo es CRLF y el string quedó con LF, se rompe el diff entero y los tests que verifican el EOL
fallan. En `app.js` (CRLF) borrar un bloque muerto con `ReadAllText` + `Remove` + `WriteAllText`
funcionó solo porque las saltos de línea se preservan como caracteres del string — pero es
fragilidad gratis. **Después de reescribir un archivo, verificar el EOL contra lo que el test del
repo exige**, antes de seguir.

### 5.17 🔴 En una PC nueva, `core.autocrlf` rompe el repo entero (2277 archivos)

Descubierto el 2026-10-05 al validar un escritorio recién formateado.

**Qué pasa.** El instalador de Git for Windows deja `core.autocrlf=true` en
`C:\Program Files\Git\etc\gitconfig` — es **config de sistema, no del repo**, así que
`git config --global core.autocrlf` sale **vacío** y parece que no hay nada configurado.

Ese `true` convierte **LF → CRLF al hacer checkout**. Como este repo guarda `main.js`,
`preload.js`, `index.html`, `main/*-bridge.js`, `shared/*.css` y `premium.css` en **LF** a
propósito (§5.4), un clon en una PC nueva deja **2277 archivos en CRLF** en disco.

**Lo peligroso es que `git status` dice que todo está limpio.** Miente por dos motivos: el stat-cache
del índice registra los tamaños ya convertidos, y al commitear Git normaliza CRLF→LF. El archivo en
disco está mal, Git no lo ve, y el día que alguien haga `git add` sube **CRLF** y produce el diff de
~7000 líneas que §5.4 advierte. Los tests de EOL sí lo detectan (`premium.css sigue en LF
[CRLF, esperado LF]`), pero solo cuando corren.

**Cómo se comprueba** (no confiar en `git status`):

```powershell
git config --show-origin --get-all core.autocrlf   # la de sistema NO aparece en --global
$b = [System.IO.File]::ReadAllBytes('sgsst-electron-app/main.js')
# contar 0x0A precedido de 0x0D  -> si hay, el archivo está en CRLF
```

**El arreglo, y el que cuesta encontrar:**

```powershell
git config --local core.autocrlf false             # lo local le gana a la de sistema
```

Con eso, `git checkout-index -a -f`, `git update-index --really-refresh` y
`git read-tree --reset -u HEAD` **NO reescriben nada** — los tres reportan 0 cambios porque el
stat-cache sigue diciendo que todo coincide. Lo único que funciona es **reconstruir el índice**:

```powershell
git reset          # rehace el índice desde HEAD, sin stat-cache: ahora sí ve los 2277
git checkout -- .  # los restaura byte a byte desde el índice -> LF donde el repo dice LF
```

Después: `git status` limpio, `main.js` con LF, `app.js` con CRLF, los 5 tests de EOL en verde. De
88 a 98 tests en verde sobre 119.

**Regla:** en una máquina nueva, **antes de tocar código**, poner `core.autocrlf=false` a nivel de
repo y renormalizar. El `README.md` dice que el EOL lo fija el test, y es cierto — pero el test solo
avisa, no corrige.

### 5.18 🔴 Al partir un documento, el duplicado puede quedar repartido entre los dos nuevos

**El caso.** `AGENTS.md` tenía 10.993 líneas y su propio encabezado decía que era "89 % bitácora de
bugs". Se partió en `AGENTS.md` (operativo) + `BITACORA.md` (historia). El archivo tenía además
**4.200 líneas duplicadas byte a byte**, con offset constante de 5.335.

**El duplicado estaba en dos capas, y la segunda no se ve si solo mirás un archivo:**

1. **Dentro de un archivo** — 4.203 líneas. Se detectan comparando rangos y se borran con un diff más
   SHA-1 de cada copia antes de tocar nada.
2. **Entre los dos archivos nuevos** — 909 líneas: una segunda copia completa de "Arquitectura del
   Proyecto", con una mitad en cada archivo. **Un dedup por rango no la encuentra.** Solo aparece si
   buscás el duplicado **por contenido**.

**Regla:** después de partir un documento, buscá el duplicado por contenido en los **dos** archivos
resultantes, no solo por rango dentro de uno.

**Las tres invariantes que costaron escribir, y las tres importan:**

- En un **dedup** el conteo de cada línea tiene que **bajar**. La comprobación intuitiva ("no desapareció
  nada": `final >= original` texto por texto) **aborta siempre**, y parece prudencia cuando es un error.
  La correcta es `final = original − borrado`.
- Una línea no es contenido único solo si no aparece como **subcadena**. Una versión **reducida** de otra
  es redundante, y la versión larga que sobrevive la contiene. La prueba: ¿se reconstruye `L` a partir de
  `O` quitándole **un** tramo? Si sí, `O` es superconjunto y se conserva la larga.
- La invariante global de una división es por **texto distinto**: cada texto del original tiene que
  seguir existiendo en alguno de los dos archivos. Comparar líneas completas no sirve en cuanto se
  promotiona un encabezado o se renumera una lista.

**Y una de comunicación:** un conteo de líneas **escrito a mano en otro documento** es una mentira que se
pudre. Este valor pasó 4.800 → 10.993 → 9.873 → 5.706 en una tarde. Escribí "se busca con `grep`" y dejá
el número para el momento de escribirlo. Y si un documento **declara su propio tamaño**, que lo calcule el
script que lo escribe y verifique que coincida —contando `\n` sobre el texto joined, **no** elementos de
un array: un elemento con `\n` embebido cuenta una línea de menos y el número declarado queda viejo.

---

## 6. Convenciones de código

### 6.1 Backend — bridges

Sufijo **`-bridge.js`** (no `bridge-*.js`). Hay 30 en `main/`.

```js
// main.js — registro con require directo + destructuring
const { registerPresupuestoHandlers, SCHEMA_SQL, MIGRATIONS_SQL }
  = require('./main/presupuesto-bridge');

// el bridge valida sus deps al arrancar y LANZA si faltan
if (typeof getDb !== 'function') throw new Error('[presup] requiere deps.getDb');
```

**Cadena:** `renderer → window.electronAPI.<ns>.<metodo>() → ipcRenderer.invoke('dominio:verbo') → ipcMain.handle → db.prepare()`

- **Exposición:** un único `contextBridge` en `preload.js`, con **namespaces anidados**.
- **SIEMPRE `db.prepare(sql).all() / .get() / .run()`** — nunca SQL concatenado con datos.
- **La sesión se valida primero**, y después el filtro multi-empresa.
- **Nunca relanzar:** `catch` → log → respuesta de error. Un bridge que truena tumba la app.
- **Respuesta:** `{ success, data, error }`. ⚠️ `error` es **string** en 4 bridges y
  `{code, message}` en ~25. **Copia el estilo del bridge que estás tocando**; no lo unifiques por tu cuenta.
- El renderer siempre llama con **guard de disponibilidad**: `if (!window.electronAPI?.x?.y) return;`

### 6.2 Persistencia

- **SQLite es la verdad.** BD real: `%APPDATA%\sgsst-electron-app\kair.db`.
- Acceso por singleton (`main/db-instance.js`), pasado a cada bridge como `deps.getDb`.
- **No hay esquema central de migraciones.** Cada módulo exporta `MIGRATIONS_SQL` y `main.js` los aplica
  inline tras abrir la BD, con `try/catch` y **skip silencioso**. Sólo presupuesto tiene `MIGRATION_IDS`;
  no hay `PRAGMA user_version`.
- 🔴 **Un test que arma su propia base tiene que correr las MIGRACIONES, no solo el esquema.**
  El patrón de `main.js:592-608` es el que hay que copiar: statement por statement, con `try/catch`,
  porque al re-ejecutar *"duplicate column name"* es esperado. Los tests de gestión humana lo
  salteaban y por eso se comían `no such table: gh_eventos_personal` y
  `gh_documentos has no column named ruta_archivo` — **columnas que sí existen en la BD real**.
  Lo que falla así parece un bug de la app y no lo es: la columna está en `MIGRATIONS_SQL`, no en
  `SCHEMA_SQL`. **Antes de culpar a la app por un "no such column" en un test, verificá en la BD real.**
- Patrón para columna nueva: `PRAGMA table_info` + `ALTER TABLE ADD COLUMN` idempotente.
  Motivo documentado en el código: *`CREATE TABLE IF NOT EXISTS` no agrega columnas a una tabla que ya existe*.
- **`localStorage` solo para preferencias de UI** (tema, empresa activa, firma, filtro, sidebar).
  Nunca datos de negocio.

### 6.3 Frontend

- Comentarios con **`📦<n>`** que explican **el bug que motivó la línea**, no qué hace el código.
  Es el idioma del repo: `bandeja-integrada/app.js` tiene 233 de estos.
- Nada de frameworks. Un solo archivo monolítico por módulo grande está bien (`app.js` de la Bandeja, 435 KB).
- **Animaciones:** `transform`/`opacity`, **menos de 300 ms**, curva propia, interrumpibles.
  La excepción honesta: para que un contenido **gane ancho** hay que animar un `width`. Hazlo
  afectando una sola caja, y deja en `transform` la parte que el ojo sigue.
  `prefers-reduced-motion` apaga todo.
- Un `title` nativo del navegador **no se controla con z-index**: vive fuera del documento. Si estorba, se quita.
- SVG nativo para barras y donuts simples; Chart.js solo si hay zoom, tooltip complejo o muchas series.

---

## 7. Convenciones de tests

**Todo feature trae su test.** Sin excepción.

**Discovery:** por nombre, `/^test-.*\.js$/`, solo en `main/`. Los **30** de `tests/` **no los ve
nadie** — están en subdirectorios por módulo, y el runner no baja a buscarlos.
**Runner:** `node tools/run-all-tests.js` (filtra por substring: `… run-all-tests.js sidebar`).
Corre cada test con el **Node de Electron** (`ELECTRON_RUN_AS_NODE=1`), no con node pelado.

**Nombre:** `test-<slug>-<paquete>.js`. El número va **al final** y `test-` al principio
(necesario para que el runner lo descubra). Ejemplos: `test-bandeja-sidebar-850.js`, `test-minical-846.js`.

**Arquetipo** — un array `checks`, un resumen `N/M OK`, y exit code:

```js
const checks = [];
const ok = (n, c, e) => checks.push({ name: n, ok: !!c, extra: e });
// … checks.push(…) por cada invariante …
console.log((checks.length - failed) + '/' + checks.length + ' OK');
process.exit(failed === 0 ? 0 : 1);
```

> El runner parsea el resumen **con `leerResumen()`, que entiende 19 formatos** (`N/M OK`,
> `N/M checks OK`, `N OK · M FAIL`, `Total: N | ✅ N | ❌ M`, TAP, texto pelado…). Antes buscaba
> solo `N/M OK` y lo que no casaba lo contaba verde sin que nadie hubiera mirado sus checks — por
> eso el runner tiene que **entender** el formato, no alcanza con que vos lo imprimas. Ver §7.4.

### 7.1 Guards — checks que sí muerden

Un check estático no es "el texto existe". Es **una invariante con cota y motivo**:

```js
// z-index: ni debajo del popup, ni encima de los modales
Number(z) > 9999 && Number(z) < 450000
// ninguna transición de 300 ms o más
durMs.every(d => d < 300)
// el botón NO puede reconstruir el correo
!/render\(\)/.test(toggleSidebar)
```

**Reglas de los guards, todas aprendidas a golpes:**

1. **Leé solo código, no comentarios.** Si el guard matchea su propio comentario, no guarda nada.
   Helper: `soloCodigo()` — pero **no hay módulo común**: está duplicado en 11 tests.
2. **Acotá el rango a la misma llave.** Un `[\s\S]{0,300}` se rompe solo cuando agregás un comentario.
   `/…\s*\{[^}]*lo-que-buscas[^}]*\}/`. Y **no lo estires a ciegas**: si el patrón estuviera en otra
   regla, dejarías de detectarlo, que es justo de lo que trata.
3. **Decí también DÓNDE.** Un check de "este texto tiene que estar" que busca en todo el archivo
   pasa con la mitad del código.
4. **Tomá la media query correcta**: hay varias con el mismo `max-width`. Tomá la última del bloque
   responsive, no la primera.

### 7.2 Mutation testing — para trabajo de UI

El patrón de `checks[]` **no alcanza** para UI: casi todo lo que se rompe es un texto que dejó de estar
o un valor que cambió, y eso es trivial de "probar". Para UI, el estándar es factorizar el test como
`evaluar(htm, css, js) -> {f, n}` y llamarlo con **mutaciones en memoria**:

```js
const MUT = [
  ['el botón desaparece del HTML', h => h.replace(/<button[\s\S]*?<\/button>/, '')],
  ['queda el ancho fijo en vez de la variable', c => c.replace('var(--side-w)', '250px')],
];
MUT.forEach(m => {
  const mh = m[1](htm), mc = m[1](css), mj = m[1](js);
  if (mh === htm && mc === css && mj === js) {          // ← guard obligatorio
    vacios++; console.log('FAIL MUTANTE VACIO ' + m[0]); return;
  }
  if (evaluar(mh, mc, mj).f > 0) detectados++;
});
```

**Tres guards, todos obligatorios:**

1. **Normalizá a LF antes de mutar.** Una mutación con `"\n"` sobre un archivo CRLF no cambia nada.
2. **Contá los mutantes vacíos por separado** y hacelos fallar.
3. **Verificá `mut(x) !== x` antes de culpar a un check.** Las dos fallas se ven IGUAL:

| | El archivo cambió | Diagnóstico |
|---|---|---|
| Mutante vacío | **no** | La mutación está mal escrita |
| Check mal escrito | **sí** | El check no mira lo que dice mirar |

Un mutante **equivalente** (no cambia el comportamiento) se declara y se sigue viendo. No lo disimules
ni lo estires para que "muerda".

### 7.3 Cuando borras algo: invierte los checks, no los borro

Un check borrado es un hueco. Uno **invertido** sigue protegiendo: si la condición se cumple, ahora exige
que **NO** pase.

**Y si varios checks afirman lo mismo, invierte los TODOS.** El chip de fecha era afirmado por dos
checks —uno de HTML y otro de JS—. Invertir uno y borrar el otro deja el agujero de que
reintroducir el código sin el markup pase verde.

### 7.4 Fallos preexistentes — lo que la suite REALLY mide

**Medido el 2026-10-07:** **123 tests · 122 en verde · 1 con fallos · 1 sin resumen verificable.**
**Cero regresiones.** **No hay lista en código**: el runner no tiene tolerancias, viven documentadas acá
en prosa.

| # | Test | Qué necesita para pasar |
|---|---|---|
| 1 | `test-firma-constancia-consolidada.js` | `INTERNAL_API_KEY` del `firma-service` — saca **83/83** en los chequeos estáticos y después falla por la variable |

Se resuelve prendiendo el PC viejo que sostiene el `firma-service`. **Hoy la suite no tiene ni un
solo rojo de producto.**

⚠️ **Este cuadro estuvo mal hasta el 2026-10-07 y decía otra cosa.** Decir "3 con fallos, **todos
de entorno**" era falso: al verificar los tres uno por uno, **solo uno era de entorno**. Los otros
dos eran **tests desactualizados**, no fallos del entorno:

| Test que se reportaba mal | Por qué no era "de entorno" | Cómo se corrigió |
|---|---|---|
| `test-firma-bridge.js` (saca 0/0) | Exigía un `contentType` que el handler **quitó a propósito** al pasar a escribir el PDF en disco y a servirlo desde caché. El código estaba bien; el test describía el diseño anterior | Check **invertido**: ahora exige el diseño actual (PDF en disco + caché). **58/58** |
| `test-firma-tunnel-kit.js` (24/27) | Exigía `cloudflared tunnel --url` de los *quick tunnels*, que **ya no se usan**: el kit ahora arranca un túnel nombrado | Checks **invertidos** al túnel nombrado. **25/25** |

**La lección que sí queda:** "con fallos" y "de entorno" son cosas distintas, y un test viejo es
un **defecto del test**, aunque parezca un fallo de entorno porque muere en runtime. Antes de
reportar un rojo como "depende del entorno", hay que **leer el test y contrastarlo con el código**
(§5.9) para saber cuál de las dos cosas es. Los dos checks invertidos **muerden**: se comprobó por
mutación que pasan a rojo si el código vuelve al comportamiento viejo.

**✅ También se resolvieron los 2 de presupuesto** (ver más abajo el por qué, que es la parte
interesante): eran el mismo error de patrón dos veces.

**✅ Los que estaban aquí y ya se resolvieron** (eran fallos del test, no de la app):

- **`test-gestion-humana-bridge-write.js` (88/89 → 89/89).** El rojo deliberado de `pasoActual`
  NO era un bug. `paso_actual` significa **primer paso pendiente**, no "último hecho": el fix
  documentado en `gestion-humana-bridge.js:863` lo recalcula después de cada `marcar-paso`.
  Cerrado el memo (paso 1), el primer pendiente es el 2, así que 2 era lo correcto y el test
  estaba anclado a la semántica vieja — el mismo error conceptual que su hermano, el del 6 tras
  5 pasos, que ya se había corregido.
- **`test-sync-serializer.js` (43/44 → 45/45).** El fixture del test armaba `gestaciones` con
  una columna `updated_at` **que no existe en la BD real** (la real es `actualizado_en`, declarada
  en el `CREATE TABLE` desde el día uno, sin migración que la agregue). El serializer hace
  `ORDER BY actualizado_en` (`sync-serializer.js:391`); en el fixture eso reventaba con
  "no such column", caía al `catch` y devolvía `[]`. **En producción, una BD vieja sin esa
  columna haría que las gestaciones nunca se sincronizaran, en silencio.** Al arreglarlo apareció
  un segundo check que también estaba mal: `result5.applied` es el total de **todas** las
  entidades, no el de planes, así que pasó de 1 a 2 al empezar a contar la gestación.
- `test-gestion-humana-bridge-newtables.js` y `test-gestion-humana-bridge-write-extra.js` **no
  fallaban: reventaban.** Los tres tests de gestión humana arman su base con `SCHEMA_SQL` y nunca
  corren `MIGRATIONS_SQL`, que es donde viven las tablas nuevas (§6.2). Por eso se comían
  `no such table: gh_eventos_personal` y `gh_documentos has no column named ruta_archivo` —
  **ambas existen en la BD real**, verificado. Ahora aplican las migraciones con el mismo patrón de
  `main.js:592-608`. Resultado: **209 OK · 0 FAIL** y **72 OK · 0 FAIL**.
- `delete-personal` **no devolvía `undefined` por un defecto**: el test lo invocaba sobre un bp
  activo saltándose `gh:cambiar-estado`, violando la regla *"Activo → Retirado → [Ocultar]"*
  (`gestion-humana-bridge.js:1171`), y además leía `data.retired`, **un campo que el contrato no
  tiene** (la respuesta real es `{personalId, activo, estado, fechaRetiro}`).
- **`test-presupuesto-824-real.js` (34/38 → 39/39) y `test-presupuesto-824-roundtrip.js` (20/21 →
  21/21): el importador NO estaba roto.** Comparaban contra cifras escritas a mano en el test
  (19.696.874,33, 6.209.816) que eran una foto del Excel deDrive en el día en que se escribieron.
  Alguien le agregó septiembre a la fila de honorarios, el archivo pasó de 8 meses a 9, y los dos
  tests se pusieron rojos reportando un bug de **$776.227 que no existía**. La app importaba bien:
  la suma de la columna E del archivo da exactamente 20.473.101,33, que era lo que producía.

### 7.5 Un test contra un archivo que el usuario edita no puede llevar cifras fijas

Ese casi-costó caro: dos tests en rojo parecían un defecto de $776.227 en un número que se le
muestra al usuario, y la tentación era reportarlo como bug. **El rojo era indistinguible de un
bug real**, que es peor que no tener el test.

La regla: **si el archivo de entrada es editable por el usuario, el esperado se lee del archivo
en el momento de correr**, no se escribe a mano.

En este repo el caso es el Excel de presupuesto (`G:`). Ahora las cifras salen de
`main/presup-excel-truth.js`, que abre el archivo con SheetJS crudo y suma celda por celda —
**un camino distinto al del importador**, que parsea con su propia lógica de celdas combinadas y
bloques. Por eso no es una tautología: si el importador se le cae una columna, se le salta una
fila o suma dos veces, la comparación lo detecta.

Y **derivar el esperado no es excusa para dejar de morder**: el que fija el esperado tiene que
comprobar que el check se pone rojo cuando el producto se rompe. Se verificó con una mutación
(`val.ejecutado * 2` en `presupuesto-bridge.js`): los dos tests se pusieron rojos con
40.946.202,66, exactamente el doble. Después se revirtió.

**El riesgo que queda, dicho en voz alta**: con el esperado derivado, si alguien edita mal el
Excel, el test no lo va a reclamar. Antes tampoco lo hacía, así que no se pierde cobertura; lo
que se gana es que editar el archivo de un cliente no rompa la suite.

El **1 sin resumen** es `test-init-order-bug.js`: es un test de inspección estructural que imprime
texto, no un `N/M`. Sale 0 y el runner lo cuenta verde, pero sin poder confirmar cuántos checks corrieron.

**🔴 El hallazgo importante: de los 17 que había, 10 NO eran fallos del producto.** Eran tests
viejos contra código que se cambió **a propósito**, y el runner los mezclaba con los fallos reales.
Casi todos de dos causas:

- **📦581 (el update pasó al footer del shell).** `test-header-zindex.js` exigía z-index de
  `.header-update-panel`, que `CHANGELOG.md` ya decía haber borrado; `test-auto-download-flow.js`
  exigía los toasts que el Loop 3 convirtió en no-ops documentados.
- **📦752 (el rediseño premium de la Bandeja).** `test-auditoria-visual.js` exigía una toolbar
  duplicada y un `setTimeout` que `app.js:6222` documenta como **código zombie eliminado en el loop 28**.

**La regla que sale de ahí:** un check que pide algo que el código borró a propósito no se "arregla"
doblando el código — se **invierte** (§7.3). Invertirlo convierte un rojo permanente en un guard que
protege el borrado. Y **antes de llamar "preexistente" a un rojo, hay que preguntarse si el código
tenía razón**: 10 de 17 la tenían, y ninguno era una regresión escondida.

**Sobre el runner (`tools/run-all-tests.js` — que SÍ está versionado, contra lo que dice §2):**

1. `leerResumen()` entiende **19 formatos** de resumen. Antes buscaba solo `N/M OK`, que es lo que pide
   §7, y **no lo cumple ni la mitad de los tests**: conviven `29/29 checks OK`, `87 OK · 2 FAIL`,
   `Resultado: 3 OK / 2 FAIL`, `44/44 | pass: 44 | fail: 0`, `Total: 78 | ✅ 78 | ❌ 0`, TAP, y texto
   pelado como `ALL CHECKS PASSED`. Los que no casaban caían en un `ok:true` **sin que nadie hubiera
   mirado sus checks**. Por eso el bloque de arqueotipo de arriba dice `N/M OK` y no dice que el runner
   lo exija: el runner lo tiene que **entender**, no solo ellos lo tienen que **imprimir**.
2. Un test **sin resumen** va a su propia lista, no a la de fallos: no se sabe si el producto está roto,
   y contarlo como fallo sería mentir en la dirección contraria.

**Para afirmar que un fallo es preexistente hay que probarlo en HEAD limpio** y decirlo con esas
palabras. Un test rojo nuevo es un test rojo nuevo.

### 7.5 La polaridad del análisis de mutaciones (el error que más repetí)

La mutación **rompe** la forma buena. El check real **exige** la forma buena. Así que el detector del
mutante tiene que marcar cuando la buena **dejó de estar**:

```js
// MAL: el mutante rompe la llamada, la buena ya no está, y esto no marca nada
if (/laBuenaForma/.test(mutado)) fallo = true;     // ❌ nunca se cumple

// BIEN
if (!/laBuenaForma/.test(mutado)) fallo = true;    // ✅
```

**Lo cometí al revés 6 veces** (📦858, 📦859 y 📦860). En 📦860 el caso fue el más discreto de todos:
el detector decía `if (reglaFechaDe(c) !== '') fallo = true` sobre un mutante que **borra** la regla
de estilo, así que marcaba el fallo precisamente cuando el CSS estaba **bien**. El mutante pasaba y
el conteo bajaba de 9/10 a 8/10 sin que nada se pusiera rojo.

**La regla que evita el bouncing:** un detector de mutación se escribe como la **negación del check**,
y si tiene ramas por clave, se escribe **una sola vez** la regla de polaridad arriba y se aplica en
todas. No rama por rama. Escribirla en cada rama es exactamente cómo se cuelan los errores.

**Y el hermano de esto: un ancla sin singularidad desactiva mutaciones sin avisar.** `replace` con
**string** cambia solo la primera ocurrencia. Si el código nuevo **copió** una línea que ya usaba una
mutación como ancla, el mutante rompe la copia nueva y deja intacta la que el check vigila. Pasa, y
el conteo de mutaciones baja sin ruido. Cuando un mutante que antes mordía deja de morder después de
un cambio de producción, la hipótesis por defecto es **"el ancla perdió singularidad"**, no "el
check se puso flojo". Contá las ocurrencias antes de culpar al check: `split(de).length - 1`. Si da
más de 1, ahí está. Para volver a morder, `replace` con **regex** y `/g`. Y mejor todavía: **contar
las ocurrencias en el propio runner y reportarlo como error**, para que un ancla repetida se vea al
momento de escribirla y no tres paquetes después.

### 7.5b Un mutante que no muerde NO siempre es un check flojo

Cuando un mutante no muerde, la primera hipótesis es "el check está flojo". A veces es al revés: **la
línea vigilada es redundante con la de al lado, y no hacía falta**.

En 📦860 `fechaFila` tiene dos guardas de fecha inválida:

```js
if (typeof ms !== "number" || !isFinite(ms)) return "";   // guarda 1
var d = new Date(ms);
if (isNaN(d.getTime())) return "";                          // guarda 2
```

Quitar **cualquiera de las dos** no cambia nada que el check mire, porque `new Date(n)` **nunca** da
fecha inválida para un número finito. Los dos mutantes pasaban y el conteo se quedaba en 8/10.

**La hipótesis correcta era la tercera: "estas dos líneas se solapan"**, y la arreglo fue un solo
mutante que quita las dos. Regla: antes de culpar al check, preguntate **qué haría que el mutante
cambiara el comportamiento**. Si la respuesta es "nada, porque la otra guarda ya lo cubre", el
problema está en el código, no en el test — y el arreglo es **fusionar la guarda**, no ablandar el
check. Un mutante que no muerde es información sobre el código, no solo sobre el test.

#### Una quinta hipótesis: el mutante y el check no miran lo mismo

En 📦880 el mutante "ponle `border-radius: 0` a la pastilla del mes" **no mordía**, y la causa era
doble, en dos capas que hubo que arreglar por separado:

1. **El check era flojo de verdad.** `/border-radius\s*:\s*\d/` da por bueno un `border-radius: 0`,
   porque el `0` también es un dígito. Acá sí era el check.
2. **Y el mutante estaba mal escrito.** Cuando se endureció el check a comparar el **valor** contra
   cero (`radios(chip).some(v => v > 0)`), la mutación seguía usando el regex viejo, así que **seguía
   sin morder** — ahora por un motivo distinto y peor: parecía que el check ya era bueno.

**Regla que sale de acá:** cuando endurezcas un check, **revisá que los mutaciones que dependían del
check viejo usen la misma expresión.** Un mutante que sobrevive a un check ya endurecido está
midiendo otra cosa, no el comportamiento. La pregunta que lo destapa: *¿el mutante y el check leen
el mismo valor, con la misma función?* Si no, el mutante es el buggy.

Y una de fondo, sobre CSS: **`border-radius: 0`, `padding: 0` y `margin: 0` son `0`, y el `0` es un
dígito.** Cualquier check que verifique "tiene un valor numérico" en vez de "tiene un valor
distinto de cero" está roto para la mitad de las mutaciones que debería cazar.

### 7.6 CSS: cuando `min-*` es mayor que `max-*`, gana el `min-*`

**Este sí se ve en pantalla y los tests lo dejaron pasar.** `.compose-panel` declara
`min-width: 400px; min-height: 360px` (📦650). El estado minimizado pedía `max-width: 320px;
max-height: 48px`, y en CSS **el `min-*` gana**: el `max-*` no hace nada. La ventana se quedaba de
360px de alto y, con el cuerpo ya en `display: none`, el alto sobrante se veía como **un bloque
blanco vacío** bajo la barrita. El owner lo reportó con una captura; los 50 checks de 📦859 estaban
en verde.

**Regla:** en este repo, `min-width` / `min-height` viven en `.compose-panel` como tamaño mínimo
cómodo. **Cualquier estado alterno tiene que anularlos explícitamente** (`min-width: 0;
min-height: 0;`), no confiar en que su `max-*` gane. Un `min-*` que no mirás te gana.

**Y el Beware del cache-bust:** `styles.css?v=…` seguía en la versión del 17 de septiembre. El
archivo en disco estaba bien y la app servía la hoja vieja de la caché. **Cualquier cambio en CSS
tiene que subir el `?v=` de `index.html` y el del iframe en `renderer.js`.** Y ojo que el token es
**compartido** entre `app.js` y `premium.css` (§5.3): subir solo el que tocaste se sirve desparejo.

### 7.7 🔴 Los tests que escribas NO abren la base de datos — pero ya hay 13 que sí, y no corren

**Los 34 checks de 📦860 podían pasar en verde con la columna de fecha VACÍA en pantalla, y no
habría habido forma de verlo.** `fechaFila` exige `typeof ms === "number"` a propósito, así que si
`email_threads.last_message_date` devolviera el número como **texto**, las 150 filas darían `""` y
**la fecha no se dibujaría en ninguna**. Todos los checks seguían en verde, porque ninguno mira la
base: extraen la función del archivo y la prueban con fechas que el test inventó.

Este es el hermano mayor de §5.9. La hipótesis "el dato llega como número" **no estaba verificada
contra nada**; era una suposición razonable, y si fuera falsa el feature entero no funcionaba.

**Cuando un feature dependa de un dato que viene de la BD, verificalo contra la BD real** antes de
decir que está terminado. El patrón que sirve es corto y no va en la suite (depende de la base
local del developer, y los tests tienen que correr sin ella): un script en `Temp/` que **extrae la
función real del archivo real** y la corre sobre las filas de verdad.

```js
// 1) la función del archivo, no una copia
const fn = soloCodigo(appJs).match(/^  function NOMBRE\([\s\S]*?\n  \}/m);
const F = new Function(fn[0] + '\nreturn NOMBRE;')();
// 2) contra la base, con node:sqlite (el nativo de Node 24; better-sqlite3 NO)
const db = new DatabaseSync('…\\kair.db', { readOnly: true });
// 3) el resultado que importa no es "el formato es correcto" sino CUÁNTAS filas quedan sin dato
console.log('filas sin fecha: ' + sinFecha + ' de ' + total);
process.exit(sinFecha === 0 ? 0 : 1);
```

En 📦860: `last_message_date` es `INTEGER` y llega como `number` en las **150** filas, 0 sin fecha.
**Eso no lo sabía ningún check: se supo abriendo la base.** Antes de cerrar un feature de datos,
contá las filas reales que quedan sin el dato nuevo y dejá ese número a la vista.

#### 🔴 Corregido el 2026-10-07: el título de esta sección era demasiado absoluto

**13 tests de la suite SÍ abren la base de datos**, y el 2026-10-07 se midió que **no llegan ni a
arrancar**: mueren en `ERR_DLOPEN_FAILED` cargando
`node_modules/better-sqlite3/build/Release/better_sqlite3.node`, que está compilado para **Electron
37** mientras el `node` de la línea de comandos corre **v26.10.0**. El 14 es
`test-firma-constancia-consolidada.js`, que muere esperando `INTERNAL_API_KEY`.

La regla de esta sección sigue valiendo para lo que escribís — **los tests que escribas no abren la
base**, porque tienen que correr en la máquina de cualquiera sin ella — pero el repositorio ya tiene
tests que dependen de la local. **Consecuencia práctica al medir la suite: un `EXIT=1` no siempre es un
test rojo.** Clasificá los fallos por causa antes de reportar, porque un runner ingenuo cuenta como
verde lo que no se ejecutó, y se termina reportando "125 verdes" cuando en realidad lo que pasó es
que 112 corrieron y 14 nunca arrancaron.

Y ojo con el otro falso positivo del mismo día: `npm rebuild better-sqlite3` devolvió `EXIT=0`
desde PowerShell **sin haber ejecutado nada** (la Execution Policy bloquea `npm.ps1`; hay que usar
`npm.cmd`), y ese `0` era el exit de la tubería, no del npm. Un exit 0 sobre un comando que no corrió
es el peor fallo posible porque no se nota.

---

## 8. Reglas de comunicación

**Toda respuesta que diagnostique o proponga** termina con una sección en lenguaje sencillo, después del
cuerpo técnico:

```
## Explicación Simple
### El problema
### La solución
### Antes vs Después
```

Sin jerga: nada de "callback", "listener", "async", "variable", "función", "commit", "paquete", "módulo".
**SÍ usar:** sistema, mensaje, ventana, tema, preferencia, configuración, resultado, botón, columna, correo.

**Estilo con el owner:** español colombiano, tono de consultor, no de servicio al cliente. Nada de
"Con gusto", "Espero que te ayude", "¡Excelente!". Preferimos tablas y **antes/después**.
Aporta una **recomendación concreta**, no una lista de opciones sin criterio.
Pregunta solo lo que no se puede deducir del código.

---

## 9. Trampas activas en el repo (verificadas 2026-10-16)

No son estilo. Son cosas que **ya están rotas** y que un modelo va a pisar si no las conoce.

| # | Trampa | Dónde | Qué hacer |
|---|---|---|---|
| 1 | 🔴 **`styles.css` usa 6 tokens premium que NADIE define** en el shell. 4 sin fallback → CSS inválido | `styles.css:6159-6470` (`.kair-pendientes-popover*`) | Si tocás esa zona, definí los aliases o pasá a `--kair-line` / `--kair-text-2` / `--kair-blue` |
| 2 | 🔴 **`AGENTS.md` referencia `kair-canonical.css`, que NO EXISTE** | `AGENTS.md:235` | Esa línea es la **fuente probable del prompt v1**. No la uses como autoridad |
| 3 | 🟡 **El header NO colapsa por scroll.** Se auto-colapsa a los 5 000 ms y responde a hover | `renderer.js:2209-2219` | Si tocás el header, el modelo mental correcto es hover + timer |
| 4 | 🟡 **12 archivos JS muertos en `renderer/bandeja-integrada/`** — `render-sidebar`, `render-calendar`, `render-mail-list`, `render-mail-detail`, `event-modal`, `compose-modal`, `mail-operations`, `calendar-operations`, `state`, `handlers`, `init`, `helpers`. `index.html` solo carga `data.js`, `icons.js`, `app.js` | `renderer/bandeja-integrada/` | **No los edites**: no se ejecutan. `compose-modal.js` además tiene lógica duplicada viva en `app.js` |
| 5 | 🟡 **El `error` del IPC no tiene un solo formato** | 4 bridges string, ~25 objeto | Copiá el del bridge que tocás |
| 6 | 🟡 **La sección de tests de `AGENTS.md` quedó desactualizada** — no menciona el runner, ni `evaluar()`, ni los guards | `BITACORA.md` (sección 🧪 Tests smoke) | Usá §7 de este archivo |
| 7 | 🟡 **`kair-bandeja.sidebarColapsado` y los otros `localStorage` guardan `"1"`/`"0"`, no booleanos.** `"0"` es *truthy* | varios | Comparación estricta: `=== "1"` |
| 8 | 🟢 El sync falla con `no such column: actualizado_en` en BDs instaladas **antes** de la migración. El schema sí declara la columna: no es un typo del serializer, es una migración que falta | `sync-serializer.js:138,302,391,734` + `medprev-programas-schema-sql.js:37` | Al tocar migraciones, agregá el patrón `PRAGMA table_info` + `ALTER TABLE` |
| 9 | 🟢 4 archivos `.bak-*` en la raíz del app | `main.js.bak-*`, `renderer.js.bak-*`, `preload.js.bak-*`, `index.html.bak-*` | Candidatos a borrar, pero **no sin autorización** |
| 10 | 🔴 **El cache-bust de `styles.css` y el del iframe de la bandeja se sube a mano.** Quedaron en septiembre mientras se editaba la hoja | `bandeja-integrada/index.html`, `renderer.js:1269` | **Todo cambio en CSS sube los dos `?v=`**. La app sirve la hoja vieja de la caché y te hace perseguir un bug que ya está arreglado (§7.6) |
| 11 | 🟡 **La app tiene 25 correos en memoria de los 131 de la carpeta** (`PAGE_SIZE = 25`), y se agrandan con scroll | `app.js` `PAGE_SIZE` | Cualquier cosa que filtre la bandeja tiene que traer lo que falta de la caché. Filtrar `state.mails` da "vacío" en 25 días que sí tienen correo |
| 12 | 🔴 **En la bandeja, `app.js` y `premium.css` comparten el token de `?v=` a propósito.** Subir solo el que tocaste deja la página con dos versiones distintas | `bandeja-integrada/index.html`, verificado por `test-bandeja-tudia-849.js` | Los dos se suben juntos, aunque no hayas tocado los dos (§5.3) |
| 13 | 🔴 **Ningún test del repo abre la base de datos.** Un feature que dependa de un tipo de dato de la BD puede tener 34 checks en verde y no dibujar nada en pantalla | `main/test-*.js` (ninguno abre SQLite) | Antes de dar por terminado un feature de datos, correr un script en `Temp/` con la función **real** contra la **base real** y contar cuántas filas quedan sin el dato (§7.7) |
| 14 | 🔴 **`core.autocrlf=true` del instalador de Git rompe 2277 archivos y `git status` miente.** En una PC nueva, todo lo que el repo guarda en LF queda en CRLF en disco, y Git no lo ve porque normaliza al commitear | `C:\Program Files\Git\etc\gitconfig` (config de **sistema**, invisible desde `--global`) | `git config --local core.autocrlf false`, y renormalizar con `git reset` + `git checkout -- .` (§5.17). **Verificar los bytes, no `git status`** |
| 15 | 🔴 **`better-sqlite3` está atado a UNA versión de Node ABI, y acá hay dos en juego.** El binario quedó
  compilado contra el runtime de Electron (`node 22.21.1`, ABI **136**) y el Node del sistema es el
  **26** (ABI **147**). Con el Node 26 el `require` **lanza**: `was compiled against a different
  Node.js version using NODE_MODULE_VERSION 136. This version requires 147` | `node_modules/better-sqlite3` |
  **El síntoma aparece al CORRER la suite, no al instalar.** Falla en `tests/setup.js` al aplicar las
  migraciones, y se lee como "[TEST SAFETY] No se pudieron aplicar las migraciones", que parece un
  problema de datos. `npm install` dice **"up to date"** y no arregla nada: no hay binario precompilado
  para Node 26, así que hay que compilar, y `npm rebuild better-sqlite3` falla con `EPERM` si Electron
  o algún proceso `node` tiene el `.node` abierto. Las dos salidas sanas: **cerrar todo y
  recompilar**, o trabajar sobre Node 22 LTS. Y un detalle que importa: **el mismo `better-sqlite3`
  no puede servir a los dos consumidores.** La app Electron necesita el binario de Electron
  (`npm rebuild better-sqlite3 --runtime=electron --target=22.21.1 --disturl=https://electronjs.org/headers`);
  los tests de `firma-service` corren con el Node del sistema y necesitan el de ese Node. Compilá
  para uno, no para los dos, y verificá con un `SELECT` real dentro de Electron (§7.7).
  Mientras tanto, **un test que evite `setup.js` sí corre** — de ahí que los tests de middleware y de
  UI del 📦903 no abran la base |
| 16 | 🔴 **`CONTEXT.md` tiene separadores de línea **CR CR CR LF** (tres CR), no CRLF.** 1337 de sus 1354 líneas. Viene así del repo, no es de una edición | `CONTEXT.md` (todo el archivo) | **Nunca lo abras con `Edit` ni lo reescribas con `ReadAllText`/`WriteAllText`**: un CRLF "correcto" en el medio de eso rompe el diff entero. Si hay que tocarlo, buscar el ancla con una regex que tolere `\r*\n` y **armar el texto nuevo con el separador que ya usa el archivo**, verificado leyendo los bytes del ancla |
| 17 | 🔴 **`scripts/theme-manager.js` EXISTE en disco y NO está cargado en el shell.** Espera la forma de mensaje `{theme, mode}`, que el shell nunca manda | `scripts/theme-manager.js`, `renderer.js` | **Ninguna vista embebida puede depender de esa forma.** Usá `shared/kair-iframe-theme.js`, que maneja las tres que sí llegan |
| 18 | 🔴 **`dark-legacy` NO es alias de `dark`.** El oscuro manual se propaga con ese nombre | `[data-theme="dark"]` no matchea `dark-legacy` | Usá `[data-theme^="dark"]`. Un código que solo acepta `'dark'` **quita el atributo** y el modo manual queda sin pintar mientras el de sistema funciona: la mitad de las pruebas pasa |
| 19 | 🔴 **Un `:root` dentro de un `<style>` inyectado escribe en TODO el shell**, no solo en el componente | `copasst-logic.js` lo hacía con `--widget-bg-color`, que `styles.css` usa en **44 lugares** | Un `<style>` que cuelga de un `div` sigue aplicando a todo el documento, y `:root` sigue siendo el `<html>`. Los tokens van en el **contenedor real**, nunca en `:root` |
| 20 | 🔴 **La herramienta de edición normaliza a CRLF un archivo de EOL mixto.** `copasst-home.css` tiene el bloque legacy en CRLF y el premium del final en LF; editarlo lo convierte entero y el diff se vuelve ilegible | `modules/recursos/copasst/copasst-home.css` | Si un archivo es mixto, **`git checkout --` y rehacé el cambio por bytes** con un script que cuente las ocurrencias antes de escribir. Verificá los bytes, no `git status` |
| 21 | 🔴 **Un arnés que muta `data-theme` en caliente mide el estado anterior.** Reportó 16 fallas que no existían | los arneses de 887/889/890 | Que el tema viaje en el HTML **desde el parseo**, antes del primer `<link>`. `void offsetHeight` no fuerza el recálculo. **La firma de que el arnés miente**: en un mismo elemento y en el mismo instante, la variable de tema oscura y el fondo claro |
| 22 | 🔴 **Un canal virtual NO es una función del preload.** `responsable-sg-logic.js` rutea el preview del PDF por `__fileViewerBytes`, y ese nombre no existe en `window.electronAPI`: es una bandera para llegar al bloque que lee bytes con `readFileBytes` | `responsable-sg-logic.js:69`, `preload.js:285` | Si validás `typeof electronAPI[nombre] === 'function'` **antes** de rutear, matás el canal y dejás ~40 líneas de ruteo como código muerto. Y si hay una red de seguridad "por si falta algo", tiene que estar **después** de la guarda: si no, tampoco se alcanza. Comprobá que sea alcanzable, no que el código exista |
| 23 | 🔴 **El panel de vista previa no limpia el estado anterior.** `_showLoading()` solo encendía el overlay; `#viewerContainer` conservaba el fallo de la carga pasada | `responsable-sg-viewer.js` | Con un `.docx` en pantalla y un error de PDF pintado encima, no hay forma de saber cuál falló. Limpiá **antes** de pedir, y rescatá el `emptyState`: vive **dentro** del contenedor, así que al vaciarlo se pierde para siempre |
| 24 | 🔴 **Un archivo leído como `utf8` y escrito como `latin1` se destruye sin que se note.** Cada `═══`, `—` y `·` pasa a `P` o `?` | cualquiera con acentos o cajas de dibujo | **El CSS sigue "funcionando"**: el navegador ignora los comentarios, así que nada falla en pantalla. Solo se ve al leer el archivo. Lo detectó un test al encontrar 0 tokens. **Antes de escribir, abortá si el resultado tiene `U+FFFD`** |
| 25 | 🔴 **Un check que compara posiciones de dos textos distintos da un fallo falso.** Medir el índice de un elemento sobre el archivo con comentarios y el de otro sobre el archivo sin ellos | checks de orden de carga en `<head>` | El comentario del `<head>` documenta *por qué* algo va primero, y es más largo que el gap que se quiere medir. Sanear los comentarios **antes de sacar los dos índices**, y sobre el mismo texto |
| 26 | 🔴 **`.kair-premium` es el ENVOLTORIO DE PÁGINA, no una clase de contenedor.** Pinta fondo (`--kair-canvas` en claro, `#2d3748` en oscuro), fija `height:100%` y `overflow-y:auto` | `shared/kair-premium.css:22` y `:265` | **Nunca la pongas en un overlay** (un panel flotante sobre una animación o una imagen): lo tapa con un bloque opaco. Cancelarlo con un `background:transparent` hace que el CSS **parezca** correcto mientras el error de fondo sigue. Un overlay se declara **autosuficiente**: fuente, `box-sizing` y bases, de su cuenta |
| 27 | 🔴 **Un estilo en línea puede ser COMPORTAMIENTO, no decoración.** La pantalla de empresa llevaba `style.alignItems = 'center'`; al pasarla a clases, el centrado se fue sin que nada fallara | `renderer.js`, pantalla de selección de empresa (📦893) | Un contenedor sin `align-items` sigue siendo **válido**: llaves cuadradas, sin color prohibido, sin error de sintaxis, test en verde. **Ningún check de estructura lo ve.** Al sacar estilos en línea, leé cada uno preguntándote qué se pierde si desaparece |
| 28 | 🔴 **Un check que fija el `?v=` literal se rompe en el próximo bumpeo, y su mutación queda vacía sin avisar** | `main/test-panel-tema-885.js` | Lo que importa no es el texto del sello sino que **no retroceda** a uno anterior. Anclá a la **fecha mínima** del paquete, nunca al literal. Y después de cada cambio de forma en el CSS, re-anclá las mutaciones y exigí `mutaciones vacias: 0`: un mutante que no muerde es peor que no tenerlo |

| 29 | 🔴 **El tema solo llega a `<html>` y a los iframes.** Un submódulo montado **en línea**
  (`fetch` + `innerHTML`) no tiene `contentDocument` al que escribirle, así que su contenedor nunca recibe
  `data-theme` y todo su CSS de tema es código muerto | `capacitaciones-logic.js` (📦894) | Es
  un **tercer caso** del contrato del shell, no un bug de CSS. Antes de "arreglar" un `[data-theme]` que no
  calza, **contá las escrituras**: en ese módulo habíA 0 `setAttribute` y 1 solo `getAttribute`, y por eso
  sus 47 reglas `--k` jamás se ejecutaron. Una vista en línea tiene que **espejar** el atributo desde
  `document.documentElement`. Ojo: `--kair-*` globales **sí heredan** por `:root`, así que el defecto se ve
  "a medio tema" — tarjetas oscuras sobre fondo blanco — y parece un error de estilos |
| 30 | 🔴 **Recrear un gráfico para cambiarle el tema le borra los datos.** Los colores van horneados al
  crearlo, así que un cambio de tema obliga a recrearlo, y `initializeCharts()` deja las series en cero
  | `capacitaciones-logic.js`, gráficos de Chart.js (📦894) | Siempre `initializeCharts()` **seguido** de
  `updateCharts()`: el primero pone la paleta nueva y el segundo vuelve a volcar los datos desde
  `this.filteredCapacitaciones`. Sin el segundo, cambiar de tema deja los gráficos **vacíos**: se arregla la
  legibilidad y se rompe el dato. Poné un check del **orden** de las dos llamadas |
| 31 | 🔴 **La superficie que reemplaza a la anterior tiene que soltar el estado ANTES de borrar el
  DOM.** `showSettingsPage()` monta su iframe y no anotaba nada, as­ que `currentModule` decíA "Recursos" y
  `currentSubmodule` "1.2.1": el candado de `showModuleContent` lo veíA truthy y descartaba el cambio de
  módulo. El `console.warn` era cosmético; lo que pasaba es que el clic siguiente en el menú no hacíA
  nada | `renderer.js`, `showSettingsPage()` (📦894) | Reusá `_salirDeSubmodulo()` (la teardown del 📦843,
  con `try/finally`) y anulá **`currentModule` también**: si solo limpiás el submódulo, el bloque de refresco de
  tema lo usa para recargar "el módulo visible" y **expulsa al usuario de Configuración al tocar el selector de
  tema**. Bajar el `warn` a `info` deja el botón muerto igual: el defecto no es el ruido, es el estado viejo |
| 32 | 🔴 **Habilitar un tema NO es heredar su paleta.** El prefijo `[data-theme^="dark"]` hace que las
  reglas apliquen a `dark` y a `dark-legacy`, pero el bloque que las declara solo trae los **valores de
  `dark`**: la pantalla queda azul dentro de un shell gris | `capacitaciones-view.css` (📦894) |
  `dark-legacy` es el gris neutro (`#121212` / `#292929`), no un alias. hace falta un bloque
  `[data-theme="dark-legacy"]` **al final**, con la misma especificidad, para que gane por orden, y sus
  valores **leídos del shell** (`kair-design-tokens.css`), no escritos a mano. Un inventario de las
  reglas mostró que solo **tres** tenían superficie escrita a mano: el resto eran textos grises que se
  ven igual en las dos paletas. **Antes de dar por bueno un "ya sigue el tema", mirá los DOS temas** |
| 33 | U0001F534 **El archivo que parece el dueño del módulo puede ser código muerto.**
  `plan-viewer.js` tiene 1 604 líneas de `renderTree()`/`selectActivity()` y espera `#treeContainer`,
  que **no existe en ningún parte del repo**. La pantalla la pinta el script inline de `plan-view.html`
  | `modules/gestion-integral/plan-trabajo/` | Antes de parchear, `grep -r 'id="treeContainer"'`: si el
  ID que el JS busca no aparece en ningún HTML, está muerto. Sus funciones hacen `if (!container)
  return;`, así que **se ejecutan sin error y sin dejar aviso**. Comprobá que sea **alcanzable**, no
  que el código exista |
| 34 | U0001F534 **Un techo se cumple por construcción, no con un clamp.**
  `scrollIntoView()` recorre TODOS los ancestros scrolleables, incluido el documento | `plan-view.html`
  (📦895) | Si el techo pedido es "el contenido no sube de esta línea", lo que lo garantiza es la
  **ausencia del código que lo movería**, no un número que alguien pueda aflojar. Se escribió solo
  `sc.scrollTop` del contenedor, y el test cuenta las escrituras de `scrollTop` de todo el archivo y exige
  que sean **una** |
| 35 | U0001F534 **Un check que mira el texto se equivoca en las DOS direcciones.** El de "no uses
  `scrollIntoView`" falló porque el propio comentario decía por qué no se usaba |
  `main/test-plan-scroll-895.js` | Es la trampa 25 del 885 al revés: un comentario puede **hacer fallar** un
  check en vez de satisfacerlo. **Sanear comentarios antes de verificar**, siempre, y en las dos mitades |
| 36 | 🟡 **Una cadena de alturas porcentuales sin un eslabón no acota nada.** `html{height:100%}` sin `body{height:100%}` deja al `height:100%` del hijo sin base: cae a `auto`, la columna flex no se acota y el contenedor con `overflow:auto` crece a la altura del contenido, **no tiene nada que scrollear y la barra desaparece** mientras `overflow:hidden` recorta | `plan-view.html:86-93` (patrón de app shell: `html` + `body` + contenedor + `flex:1` + `min-height:0`) | Antes de culpar al `overflow`, medí `scrollHeight` contra `clientHeight`. Un contenedor con `overflow:auto` que no muestra barra **no está roto: no tiene contenido que scrollear** |
| 37 | 🔴 **`npm install` en `sgsst-electron-app` BORRA 2.624 archivos versionados.** El `postinstall` de
  `@file-viewer/web` (`node ./scripts/copy-assets.mjs --postinstall`) reconstruye
  `renderer/file-viewer-assets/` desde el paquete instalado. npm 11.19.1 **avisa** de los install
  scripts no cubiertos por `allowScripts` y aun así los deja correr: imprime "up to date, audited
  914 packages" y tres segundos después el directorio está vacío | `renderer/file-viewer-assets/`,
  `package-lock.json` | **Antes de cualquier `npm install`, `git status` tiene que estar limpio**,
  porque la restauración se hace desde `HEAD` y el trabajo sin commitear se pierde. Y notá que
  **`firma-service` comparte `node_modules` con la app**: un install para un servicio toca los assets
  del otro. Si te avisaron "4 paquetes con install scripts no cubiertos", el aviso es real, no ruido |
| 38 | 🔴 **Un caché del navegador hace que un fix desplegado parezca fallido.** Después de desplegar la
| 39 | 🔴 **El chequeo de caracteres no latinos solo mira CJK, cirílico y hangul.** Se colaron **arábigos** (`U+064A U+0631 U+0627`) en la Constancia donde decía «se le mostró» | Cualquier string que escribas | El rango del grep debe cubrir `\u0600-\u06FF` (árabe), `\u0590-\u05FF` (hebreo), `\u0900-\u097F` (devanagari), `\u0E00-\u0E7F` (tailandés), más CJK y cirílico. **Un filtro más estrecho que el problema no es un filtro** |
| 40 | 🔴 **Los modales se abren por tres caminos distintos y el cableado se pone en uno solo** | `config-viewer.html`: `agregarNuevaEmpresa`, `prepareLinkModal`, `viewCompanyDetails` | Cuando agregues comportamiento a un modal, **cablealo adentro de la función que lo abre** (`openLinkModal`), no en quien lo prepara. Y todo form de alta tiene que limpiar **todo** lo que hay debajo del botón guardar: forgot un bloque y los datos de la empresa anterior se le guardan a la nueva |
| 41 | 🔴 **`sitio/` y `sgsst-electron-app/legal/` tienen el MISMO nombre de archivo pero NO son copias** | `anexo-encargo.html` pesaba 15.651 en uno y 14.420 en el otro | **Antes de sincronizar, compará el tamaño en HEAD.** Si difieren, son dos documentos que comparten nombre: editá los dos por separado. Sincronizar a ciegas borra contenido real |
  página de enlace reabierto, el owner volvió a abrir el enlace firmado y siguió viendo el JSON crudo
  anterior: parecía que "no se había arreglado" | `firma-service/src/middleware/errors.js`, `/s/:token` |
  El backend respondía bien (`curl` directo al origen, `text/html`) y el túnel tampoco: era el caché.
  **Un `404`/`410` sin `Cache-Control` queda guardado en disco.** Antes de concluir que un despliegue
  no surtió efecto, probá la **misma URL por dos caminos** (directo y por el proxy) y en **ventana
  privada**. Y en una superficie con credenciales en la URL, `no-store` no es opcional |
| 43 | 🔴 **Una tabla append-only rompe la limpieza entre tests, y el arreglo NO es un `DELETE`.** Al agregar `gh_firma_purgadas` (lápida de la supresión), el `DELETE` de limpieza abortaba por el trigger | `firma-service/src/db/schema/025_purga_datos_append_only.sql`, `tests/helpers.js` | El trigger tiene que ir en **otra migración** con `-- @skip-when-env test` (el patrón de la 020), y la **limpieza en el `resetDb()` de `tests/helpers.js`**, no en el `before` de un archivo de test. Si la limpieza vive en un archivo, la suite depende del **orden** en que corren los archivos: se rompe al reordenar, y no lo detecta nadie. La garantía del trigger se prueba **contra el archivo real**, en una base aislada, con un test de mutación |
| 44 | 🔴 **Cuando una credencial deja de ser recuperable, se rompen TODOS sus consumidores — incluso los que no la necesitan.** Al dejar de guardar el token cifrado (8C), `getTokenForRecovery` lo usaban tres lugares: el endpoint `/link`, el `resend-otp` interno y la invitación al representante en la firma dual. **Dos de los tres solo lo usaban para encontrar la solicitud que ya tenían por id** | `firma-service/src/services/signRequest.js`, `src/services/publicFlow.js`, `src/routes/signRequest.js` | Cuando elimines o cambies una credencial, **auditá a todos los que la leen**, no solo al que la expone. Y preguntate qué necesita cada consumidor: si solo necesita el registro, pasale el registro. El `notify-remote` que rota un token nuevo **no debe invalidar el anterior**: un enlace que el trabajador ya tiene en el teléfono no se le rompe a mitad de camino |
| 45 | 🔴 **Cifrar un valor que antes se hasheaba rompe a los que lo LEÍAN, no solo al que lo guardaba.** Al cifrar el número del representante legal (8B), la huella de identificación y el seudónimo del consentimiento dejaron de poder calculararse: los dos sederivan del número en claro, y los dos leían el snapshot **ya cifrado**. Uno estaba a cuatro archivos de distancia del que escribía | `firma-service/src/services/signRequest.js` (`createForCompany`), `src/services/consent.js` (`ensureRepConsent`), `src/services/representante.js` | Cuando se cambia la forma de un dato, **grep por el valor, no por la columna**: buscá quién lo lee y quién lo **deriva**. Un valor cifrado que además se hashea no es un hash del número, es la huella de un sobre, y el resultado es silencioso: no falla, devuelve otra cosa. Y no te fíes de un test de punta a punta: el flujo completo puede pasar mientras el identificador queda mal |
| 46 | 🔴 **Un esquema sin `.strict()` descarta lo desconocido EN SILENCIO, y el dato se pierde durante meses sin que nadie se entere.** `correo_empresa` (el canal de copia del 8.4) lo mandaba la app desde hacía meses y zod lo eliminaba: no estaba declarado, y un esquema que no rechaza lo desconocido no dice nada | `firma-service/src/schemas/index.js`, `src/services/metadata.js` | Cuando declares un campo, poné `.strict()`: lo que no se conoce se **rechaza nombrando la clave**, en vez de perderse. Y ojo con el otro extremo: **una cadena vacía es la ausencia de un dato, no un dato inválido**. La app manda `correo_empresa: ''` siempre; si el esquema exige un correo, **cada firma del site B cae en 400** |
| 47 | 🔴 **El `/health` de un servicio devuelve una versión FIJA: no sirve como prueba de despliegue.** `src/routes/health.js:45` arma `'compatible-' + (env === 'production' ? '0.1.189' : 'dev')` — la versión está **hardcodeada en el código** | `firma-service/src/routes/health.js:45` | Antes y después de desplegar el health dice exactamente lo mismo. Un health que responde `ok` **no prueba que el código nuevo esté corriendo**. Para probarlo, usá una **ruta o un comportamiento que solo exista en el código nuevo**: acá, `POST /api/solicitudes` (el 1.3) da `404` antes del despliegue y `201` después. Esa es la prueba, no el health |
| 48 | 🔴 **Una variable de entorno que el código NUEVO exige puede no existir en el servidor: el servicio no arranca.** `TOKEN_ENCRYPTION_KEY` la exige `keys.js` en producción, y es **nueva de `ab78ca92`** — el código que estaba desplegado no la usaba (el token era un SHA-256 pelado) | `firma-service/src/crypto/keys.js:108-113` | Antes de desplegar, **grep por las variables que el código nuevo exige** (`required(...)` en `config.js`, `process.env.X` en `src/`) y compáralas con el `.env` del servidor. Sin esa variable el proceso muere al arrancar y el dominio deja de responder: no es un fallo de la migración, es un arranque incompleto. Y la llave **se genera una vez**: rotarla invalida los tokens cifrados y los seudónimos ya calculados |
| 49 | 🔴 **Un test que parchea `process.stdout.write` se come la salida del reporter de node:test.** En modo `--test` el runner solo veía **2 de 11** tests del archivo — y todos pasaban | `firma-service/tests/scripts/smoke-produccion.test.js` | El parche global intercepta también lo que escribe el reporter del runner, así que el conteo de la suite **miente** sin que ningún test falle. La forma sana es que el código **inyecte** su sumidero de salida (`main(argv, { sink })`) y el test lo capture por ahí. Si un test necesita ver la salida de otro módulo, **no parches la consola**: pedí el sumidero |
| 50 | 🔴 **El multipart de `POST /internal/sign-requests` lleva UN campo `metadata` con un JSON string, no campos sueltos.** Y su `metadata` anidado también es string (`z.string()`), no un objeto | `firma-service/src/routes/signRequest.js:141-164`, `src/schemas/index.js:82` | Mandar los campos sueltos es un 400 (`Falta el campo "metadata" en el form-data`); mandar el anidado como objeto es otro 400 (`Expected string, received object`). El schema del metadata es **`.strict()`**: una clave desconocida se rechaza nombrando la clave, y el blob que se archiva tiene lista blanca de **cinco** claves (`subtipo_identificacion`, `nombre_trabajador`, `nombre_empresa`, `correo_empresa`, `correo`). Ojo con `tipo_identificacion`: es la categoría del **documento** (CONTRATO, OTROSI, ACTA, CONSENTIMIENTO...) y no existe "OTRO" |
| 51 | 🔴 **Un ensayo contra el servicio REAL local (no contra un mock) es lo que atrapa los 400 de contrato — y cuesta un minuto.** Dos 400 seguidos en producción, los dos del cliente de prueba, se habrían evitado con el servicio corriendo en el puerto 3099 | `firma-service/scripts/smoke-produccion.js` | Levantá el servicio con la BD de tests, publicá el Acuerdo, registrá la Empresa y corré el script contra `http://127.0.0.1:3099`: ves el error exacto, lo arreglás, y lo volvés a correr. El ensayo además te deja ver **lo que ve el firmante** (`GET /api/sign/<token>/acuerdo.txt`), que es la prueba que de verdad importa. Un mock de la API no te dice qué contrato espera el servidor real |
| 52 | 🔴 **Crear la solicitud de firma NO manda ningún correo: el primer contacto con el firmante es OTRO endpoint.** `POST /internal/sign-requests` crea la fila, devuelve el token y la URL y no envía nada; la invitación la manda `POST /internal/sign-requests/:id/notify-remote`, que es el que llama a `mailer.sendInvite()` | `firma-service/src/routes/signRequest.js:320`, `src/services/signRequest.js:237`, `scripts/smoke-produccion.js` | Un e2e que solo crea la solicitud da **OK sin haber probado el correo**: el servicio responde 201, no hay evento `INVITE_SENT` y el firmante nunca se entera. Cuando una prueba afirme algo que el código no hizo, sospechá del **paso que falta**, no del servidor: el SMTP estaba perfecto (Gmail aceptó con `250 OK`) y el correo de prueba llegó a la bandeja. Y **un aviso que no sale del servidor no es evidencia**: el script decía "Se mando un correo real" imprimiendo su propio argumento |
| 53 | 🔴 **Crear la solicitud NO basta para que el firmante pueda firmar: `identify()` exige `identificacion_tipo` y `identificacion_numero_hash` en la fila.** Si faltan, responde `500 MISSING_IDENTIFICATION_DATA` y el recorrido se corta | `firma-service/src/services/publicFlow.js:865`, `src/services/identificacion.js` | El cliente (K+AIR) manda el **SHA-256** del número de documento, nunca el número en claro; el servicio lo convierte en un HMAC con su llave maestra. Sin sal, el hash previo es `sha256(numero)`, así que el firmante tiene que escribir **exactamente** el mismo número que el cliente usó para calcular la huella. Un e2e que crea la solicitud pero no manda la identificación prueba 3 de 5 pasos y no lo dice |
| 54 | 🔴 **El código de error es el mismo, pero el status no: el mini-app espera 422 y el servidor manda 500.** Así, el frontend no entra en su rama y el firmante ve el error genérico en vez del mensaje claro | `firma-service/src/services/publicFlow.js:866`, `web/firma/app.js` | `identify()` lanza `AppError(500, 'MISSING_IDENTIFICATION_DATA')`; el mini-app ramifica con `err.status === 422 && err.code === ...`. **El contrato cliente-servidor es el mismo contrato**: si un lado dice 422, el otro tiene que decir 422. Un `catch` por código sin el status se rompe en el momento en que uno de los dos lados cambia el número, y no hay ningún test que lo note |
| 55 | 🔴 **Un check que no muerde no es un check: el e2e daba `RESULTADO: OK` con 13 comprobaciones mientras NINGÚN token resolvía.** El script comprobaba la salud, el Acuerdo, la ruta interna y el alta... y nunca abría el enlace que él mismo creaba | `firma-service/scripts/smoke-produccion.js` (paso 5c, added 2026-10-21) | El alta dio 201, el correo salió y el firmante abrió un 404 `TOKEN_NOT_FOUND`. **Una corrida de humo que no abre el enlace que ella misma creo no prueba que el firmante pueda firmar.** Agregá el paso: crear → tomar el token → `GET /api/sign/<token>/verify` → tiene que dar 200. Y el test tiene que **morder**: si el check no puede fallar, no es un check |
| 56 | 🔴 **La prueba de un despliegue es el hash del ARCHIVO QUE QUEDÓ CORRIENDO, no el del disco ni el del repo.** Un proceso puede tener en memoria un código distinto del que está en disco (copia después del arranque, despliegue a medias) | `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` §5.1 | El 2026-10-21 el proceso llevaba horas sirviendo el app anterior: por eso los tokens que acuñaba no los resolvía el código nuevo. El **mtime NO sirve como prueba**: `tar` conserva las fechas originales, así que un archivo copiado hoy puede marcar la de hace semanas. El orden que sí: **parar → copiar → verificar hash en disco → arrancar → verificar `uptime_seconds` chico** |
| 57 | 🔴 **Un 404 `TOKEN_NOT_FOUND` no dice NADA del servidor: es el mismo error para cinco causas distintas.** En producción sirvió para: llave distinta, esquema de hash distinto, proceso con el código viejo, token mal transcrito y fila inexistente | `firma-service/src/services/signRequest.js` (`getByTokenHash`), `src/crypto/token.js` | Antes de culpar al servidor, **verificá el token de verdad**: el `journalctl` guarda la ruta exacta que llegó (`"path":"/api/sign/<token>/verify"`) y los logs del token salen con el formato del log, no con el que lo copia uno a mano. Un token transcrito de una foto de terminal puede tener un `O` por un `0`: el 404 dice lo mismo |
| 58 | 🟡 **El candado que protege el texto legal puede dejar al sistema sin poder limpiar sus propias pruebas.** El script de purga se negaba a borrar la versión v1.0 porque era el legal sellado, y no había forma de retirar las filas del e2e | `firma-service/scripts/limpiar-rastro-prueba.js` (`--solo-firmas`) | La salida no es aflojar el candado, es **separar las dos cosas**: un modo que borra las filas de prueba y **no toca ninguna versión**, con su propia verificación final (la versión vigente tiene que seguir ahí, activa y con su huella). Los consentimientos no se borran en ese modo: no cuelgan de una firma y borrarlos por fecha sería borrarlos a ciegas |
| 59 | 🔴 **Con `readline.emitKeypressEvents`, la tecla ESC sola NO emite ningún `keypress`: el parser espera a ver si lo que sigue es una secuencia de escape.** La tecla "volver" de un TUI es, con ese parser, inalcanzable | `firma-service/scripts/panel-firmas.js` (`crearLectorTeclado`) | En Node v26: ESC sola -> NINGUN keypress; ESC ESC -> NINGUN keypress; la flecha (ESC [ A) sí llega como `up`. El parser no traduce teclado: **reconoce secuencias ANSI**, y para una ESC ambigua su respuesta es "no sé qué es". Un TUI que dependa de ESC tiene que **decodificar los bytes él mismo** (ESC sola tras 50 ms = ESC; ESC seguida de `[` u `O` = secuencia). Y el test que lo cubría leía `key.name === 'escape'`, un valor que el runtime jamás produce: el test pasaba sin que la tecla existiera |
| 60 | 🔴 **`PUT /internal/admin/empresas/:id` es un REEMPLAZO de la ficha completa, no un parche: lo que no se manda queda en `NULL`** | `firma-service/src/services/empresa.js` (`update`), `src/routes/admin-empresas.js:110` | `razon_social` es `NOT NULL`: mandar solo `canal_pqrs` revienta con `SQLITE_CONSTRAINT_NOTNULL` (un 500, no un 400). Y mandar un juego parcial **borra el resto de la ficha**. El puente de 📦927 lo hace bien (GET + merge + PUT, preserva los campos del servidor), pero cualquiera que llame el endpoint tiene que saberlo: el override de un campo se lleva por delante los demás |
| 61 | 🔴 **Un script de operación con las rutas fijas al layout local es una caja fuerte vacía en producción: "nada que mover" significa "no miré donde debía".** Y si además se bloquea en producción, obliga a mover a ciegas | `firma-service/scripts/cleanup-orphan-pdfs.js` | En `kair-server` la base está en `/opt/kair-firma/data/` y el storage en `/opt/kair-firma/storage/`: son **hermanos** de `app/`, no hijos, así que `<app>/data/firma.sqlite` y `<app>/storage/pdfs` no existen. Las rutas tienen que salir del entorno (`DB_PATH`, `PDF_STORAGE_PATH`) igual que `src/config.js`. Y el **dry-run tiene que poder correr en producción**: no escribe nada y es la única forma de *ver* qué se movería antes de moverlo. Un script que en producción solo dice "no se puede" obliga a hacer el movimiento a ciegas. Y "nada que mover" **no puede significar "el storage está limpio"**: si hay huérfanos fuera de la lista objetivo, el script tiene que decir cuáles son |
| 62 | 🔴 **Un script que abre la base en modo escritura como root puede dejar los archivos `-wal`/`-shm` de root en el directorio de datos y romper al servicio, que corre como `kairfirma`** | `firma-service/scripts/cleanup-orphan-pdfs.js` (`abrirDb`) | En WAL, si la base no se puede abrir en solo lectura, el "plan B" de abrirla normal **escribe** y deja esos archivos con dueño root; el servicio (kairfirma) ya no puede escribir en ellos. El plan B correcto: **como root, negarse** y pedir que se corra como el usuario del servicio (`sudo -u kairfirma`). Los scripts de solo lectura, en el servidor, siempre con ese usuario |
| 63 | 🔴 **Un `module.exports` con el nombre viejo de una constante renombrada tumba TODA la suite, no un test.** El `ReferenceError` pasa al hacer `require` del módulo y se repite en cada archivo que lo importa | `firma-service/src/services/signRequest.js` (`module.exports`) | Renombrar `MAX_TOKENS_ACTIVOS` → `MAX_TOKENS_VIGENTES` dejó la referencia vieja en el `module.exports`: **30 archivos de test** fallaron a la vez con un error que no tenía nada que ver con el cambio. El síntoma "docenas de archivos fallan" NO es "la lógica está rota": es **un módulo que no carga**. Antes de culpar a la lógica: `node -e "require('./src/services/x')"`. Y después de renombrar una constante exportada, buscá el nombre viejo en TODO el archivo, `module.exports` incluido |
| 64 | 🔴 **Una mutación puede "morder" por el motivo equivocado y el conteo salir 14/14 sin que ningún check haya bosteado de verdad** | `%TEMP%\kair-mutar-933.js` | Si el módulo bajo prueba tiene un `ReferenceError` (trampa #63), **todos** los tests de ese archivo fallan con la mutación puesta **y** sin ella. El script ve "el test falló" y reporta "detectada": falso positivo. La regla: **antes de mutar, verificar que el código carga y que la suite está verde**. Si una mutación sobrevive, el check no muerde. Si "detecta" de golpe, puede que no esté mirando lo que dice mirar |
| 65 | 🟡 **Un límite que dice "firmas" tiene que contar FIRMAS, no los puntos de verificación que atraviesa la firma** | `firma-service/src/services/excepcionHabilitacion.js` (`vigentePara`), `src/services/empresa.js` (`assertHabilitadaParaFirma`) | El alcance de la excepción de habilitación es «un número máximo de firmas» (el abogado). Si se gasta en cada punto del bloqueo que se levanta, una firma consume hasta tres unidades (creación + consentimiento + commit) y el alcance de 3 permite **una** firma, no tres. La distinción que lo arregla: el punto que **abre** una firma gasta; el punto que la **verifica** solo consulta. Por eso `vigentePara` recibe `para_firma`: el mismo filtro sirve para las dos preguntas |
| 66 | 🔴 **Cuando llegan dos documentos del mismo autor que se contradicen, manda el ORIGEN, no la fecha** | `docs/gestion-humana/firma-electronica/respuesta-11A-2026-10-23.txt` vs `.md` | Eran las dos respuestas del abogado: el `.txt` (41 128 B) venía del asset que el owner pegó; el `.md` (71 367 B) se creó a las 3:33 AM **sin aparecer en ningún snapshot, ni en `assets/`, ni en los logs del runtime**: origen no verificable. Se contradecían en lo decisivo (80 vs 20 años, tres tokens vivos vs uno). El `.md` era **más grande y más reciente**, y por esas dos razones iba a ganar si se miraba solo el tamaño o la hora. El criterio correcto: **¿se puede probar de dónde salió?** Un documento sin origen no compite: se señala como contradictorio y no se usa |
| 67 | 🔴 **Un `undefined` ligado como bind NO lanza: el fallo es silencioso y degrada el resultado, no lo rompe.** En `better-sqlite3`, pasar `undefined` a un parámetro lo liga como `NULL` y la consulta se ejecuta normal | `firma-service/src/services/reciboSupresion.js` (`porSolicitud`), `src/services/supresion.js` | El `SELECT` de la lápida no traía `firma_id` y el código lo usaba como bind: el `WHERE firma_id = NULL` no encontraba la fila del recibo de purgas y el recibo salía **sin la ventana, sin el hold y sin el recuento de eventos**. Un objeto que parece completo y no lo está. La misma forma de fallo aparece cuando el código usa una columna que **no está en el `SELECT`**: no hay excepción, hay un `undefined` que viaja. Por eso, cuando un objeto armado se ve "incompleto", el primer suspecto es **el `SELECT`, no la lógica**: y el primer check es `assert.ok(recibo.ventana_hasta)`, no "que no reviente" |
| 68 | 🔴 **Una capa que cierra el contexto (la ventana, el lote, la transacción) antes de que corra la siguiente capa hace que la siguiente no corra NUNCA — y el guion del script lo promete como si pasara** | `firma-service/scripts/purga-ventana.js`, `src/services/conservacion.js` (`purgar`) | `conservacion.purgar()` cerraba la ventana de purga y vaciaba el lote al terminar; la capa 2 (`supresion.suprimir()`) exige ventana vigente y lote armado, así que moría con "No hay ventana de purga abierta" y el script salía con código 3. La **capa 2 nunca se ejecutó en producción**: nunca se borró un documento vencido y la tabla de lápidas quedó vacía. El error no fue el código de la capa 1: fue que **el guion describía un comportamiento que nadie contrastó con el código**. Reglas: (1) el que **orchestra** es el dueño del cierre, no la capa; (2) un `catch` tiene que cerrar el contexto igual, para no dejar una ventana abierta con un lote a medias; (3) **el guion de un script es una hipótesis hasta que hay un test que ejecuta el guion real** — `tests/purga-dos-capas.test.js` lo invoca con `main(argv, deps)` y le pasa las dependencias, en vez de probar los servicios sueltos; (4) la simulación tiene que correr sobre **las mismas filas** que la operación real va a usar, no sobre el estado que existe antes de abrir el contexto (la simulación decía "0 firmas, 0 archivos" y la operación suprimía una y tres) |


**Formato de commit real** (verificá con `git log` antes de cada uno, la convención migró varias veces):

```
📦<n|range>[-fix] # <tipo>(<scope>): <síntoma que vio el usuario, en minúsculas, sin punto>
```

Ejemplos reales: `📦850-851 # feat(bandeja): columna lateral plegable y sin etiqueta de fecha`.

---

## 10. Lo que NO hacer

- ❌ Commitear o pushear sin la palabra correcta (§5.1).
- ❌ Probar con datos inventados: usá la BD real o mocks que se parezcan a ella.
- ❌ Escribir en la BD real desde fuera de la app.
- ❌ Matar listeners sin `removeEventListener`, o dejar timers vivos al destruir un submódulo.
- ❌ Crear componentes o clases CSS sin grepear el repo primero: hay colisiones conocidas
  (`.kair-panel` vs `.kair-block__panel`, `.k-section-card` vs `.kair-card`).
- ❌ Unificar, limpiar o refactorizar de paso. **Lo que no se te pidió, no se toca.**
- ❌ Introducir un patrón nuevo cuando ya existe uno equivalente.
- ❌ Declarar algo "arreglado" sin test que lo demuestre, y sin que el test **detecte el bug si vuelve**.
- ❌ Romper un contrato de IPC sin versionarlo.
- ❌ Glassmorphism, neumorphism, gradientes agresivos, sombras para todo, dashboards "flashy".
  Esto es una app de cumplimiento normativo: **corporativa, sólida, modular, audit-ready.**

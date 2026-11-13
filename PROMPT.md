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
| Tocar los anexos (Anexo de Encargo o de Nube) o la firma | `sgsst-electron-app/docs/gestion-humana/firma-electronica/` — `API.md` §6.21-§6.22 y `FLOWS.md` |
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
| `PROMPT.md` | **LF** |
| `Historial.md` | **MIXTO por diseño**: 7 047 CRLF + 367 LF. La herramienta de edición lo aplana: **se parchea por bytes** (trampas 20 y 130) |
| `sgsst-electron-app/CONTEXT.md` | **MIXTO**: 1 400 CR CR LF + 558 CRLF (trampa 104) |

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
- **Un ancla puede tapar MÁS campos de los que parece.** En un archivo de test, el ancla
  `version_kair:'0.1.189', consent_id:'5' };` cubría **dos** campos del mismo objeto; el texto de
  reemplazo reponía solo el segundo y el `version_kair` **desapareció**. El archivo siguió siendo
  JavaScript válido y **la suite siguió dando verde en 2 077 de 2 078 pruebas**: un campo que falta
  no se ve como un error de edición, se ve como un **fallo de negocio**. El ancla tiene que reponer
  **todo** lo que tapaba, campo por campo, y el diff se lee antes de seguir.

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

### 5.19 🔴 Un control que compara contra una constante no comprueba el documento: comprueba la constante

**El caso.** `readinessLegal.js` validaba el Acuerdo contra la cadena fija `'v1.1'`:
`analizarAcuerdo(docAcuerdo.texto, 'v1.1')`. Cuando la v1.2 pasó a ser la candidata, el manifiesto pasó a
apuntar al archivo `acuerdo-v1.2.txt` — pero la constante se quedó en `'v1.1'`. El control quedó **rojo**
("Faltan cláusulas: Versión del Acuerdo: v1.1" sobre un texto que decía v1.2) y **nadie lo notó**, porque el
readiness no se corría contra el texto nuevo: se corría contra su archivo de siempre.

**Regla:** un control que valida un documento deriva el dato que compara **del documento o de su manifiesto**,
nunca de una constante escrita a mano. Y cuando cambia el texto, el control se corre **contra el texto nuevo**.

**Como quedó (30-oct-2026).** `_versionAcuerdoEsperada(datos, rutaArchivo)` lee `manifiesto.acuerdo.version`; si
no está, lo saca del nombre del archivo (`acuerdo-v1.3.txt` -> `v1.3`); y solo si no está en ninguno de los dos,
vuelve a `'v1.1'` como último recurso. El manifiesto es la fuente de verdad de qué versión se está revisando.

**Y el gemelo del bug.** El control textual del 8.6 exigía la redacción **vieja** ("retención por plazo no
declarado"). Cuando D1 eliminó ese mecanismo, el control nuevo empezó a exigir algo que el código ya no hacía y
dejó de exigir lo que el texto nuevo sí decía. Un control de un numeral es un **contrato bidireccional**: tiene
que exigir lo que el texto dice **y rechazar** lo que el texto dejó de decir. Por eso hoy el control tiene un
**control de ausencia**: un texto que todavía prometa el hold por plazo no declarado **falla**.

---

### 5.20 🔴 Cuando una regla legal cambia de fondo, hay que barrer TODO el texto por las frases del mecanismo retirado

**El caso.** D1 (30-oct-2026) eliminó la retención indefinida. Se reescribieron el 8.6(a) y el 8.6(h) — y el
**12.7** y el **3.6(g)** quedaron prometiendo el mecanismo viejo: "mientras ese plazo no esté declarado, la
prueba no se suprime y queda retenida por esa razón, conforme al 8.6(h)". El 12.7 hasta remitía a un literal
cuyo contenido ya no era ese.

**Regla:** cuando se retira un mecanismo, **no basta con reescribir el numeral que lo define**. Hay que buscar en
todo el documento las **frases** del mecanismo retirado — por la frase, no por el numeral. El barrido son
minutos; leer 72.000 caracteres a ojo son horas, y las horas son cuando se escapa.

**El patrón.** Una lista de frases del mecanismo viejo, aplicada al texto, que imprime el número de línea de cada
aparición:

```js
const L = fs.readFileSync(texto, 'utf8').split('\n');
L.forEach((l, i) => { if (/plazo no declarado|no se suprime|pendiente/i.test(l)) console.log(i + 1, l.trim()); });
```

Y el segundo control es el de **ausencia** del §5.19: el texto que conserva la frase vieja tiene que fallar.

---

### 5.21 🔴 Los números que se mandan a alguien salen de un script, no de una reescritura

**El caso.** La nota al abogado cita, para ocho documentos, sus bytes y su SHA-256. Esos números se escribieron a
mano la primera vez; el día que se regeneró el Anexo de Encargo (85.678 -> 85.947 B) la nota quedó mintiendo, y el
hash que el abogado iba a aprobar era el de un texto que ya no existía.

**Reglas:**

1. **La nota tiene un verificador**: `firma-service/scripts/verificar-nota-abogado.js` compara cada bytes y cada
   huella de la tabla contra el archivo real y contra `SHA256SUMS.txt`. Si el verificador falla, **la nota no
   sale**.
2. **El manifiesto es la fuente de las huellas** y el paquete se arma contra él (`armar-paquete-abogado.js` sale
   con código 3 si no coincide). Las huellas **se recalculan desde los archivos**, nunca se escriben de memoria.
3. **El manifiesto legal es ASCII puro**: sus notas van sin tildes y con escapes (`\u00e1`). Re-serializarlo con
   `JSON.stringify` convierte cada escape en el carácter real, el archivo deja de ser ASCII y el diff es
   enorme. Se edita con **reemplazo literal** + validación (JSON válido y ASCII puro) — así lo hace
   `actualizar-manifiesto-v1.3.js`.
4. **Un documento que se manda se documenta en el repo**: qué se mandó, cuándo y con qué hash.

---

### 5.22 🔴 Un parámetro que depende de validación jurídica se construye, pero no se activa

**El caso.** Los plazos de diez (10) y cinco (5) años de la tabla supletoria de conservación son "parámetros
iniciales" que el abogado dejó **sujetos a validación jurídica antes de activarse en producción**.

**Reglas:**

1. **Construir el mecanismo y activar el valor son dos decisiones.** El mecanismo va al código; el valor queda
   como **PROPUESTA** en la fuente de configuración (`config/tabla-conservacion.json`, campo `estado`) y en el
   Anexo, con el estado escrito.
2. **El Anexo que va al abogado publica los parámetros**: el documento dice qué se aplicaría, y es la
   **aprobación del abogado** la que los habilita. No se publica un Anexo con plazos "sin definir" para no
   mentir: se publica con los parámetros propuestos y se deja constancia de que están sujetos a validación.
3. **El estado vive en la fuente única, no en el código**: cambiar `estado` a "aprobado" es lo que habilita, y
   nadie lo cambia sin la validación encima.

---

### 5.23 🔴 Declarar que un parámetro no se activa no es lo mismo que impedir que se active

**El caso.** La 5.22 decía que los plazos de diez (10) y cinco (5) años "no se activan en producción hasta que el
abogado los valide", y la tabla de conservación lo **declaraba** en su campo `estado`: *"PROPUESTA. Los plazos de
diez (10) y cinco (5) años NO se activan en produccion hasta que el abogado los valide"*. Pero el **código no leía ese
estado**: el planificador aplicaba el plazo por defecto de la tabla sin mirarlo. La declaración era cierta en el
documento y falsa en el código, y el día que se desplegó se activaron en producción exactamente los plazos que el
abogado no había validado.

**Reglas:**

1. **Un parámetro que depende de validación jurídica se declara Y se bloquea.** La fuente legal lleva su propio
   interruptor (`aplicacion.activada`) y el código lo lee. Con la compuerta cerrada, el plazo por defecto es el del
   catálogo (la custodia que estaba en vigor) y la fila lo dice, con su fuente (`catalogo_sistema`).
2. **Las excepciones legales no dependen de la compuerta.** El piso del SG-SST y el hold del contrato sin término son
   deberes: siguen aplicando con la compuerta cerrada. Una compuerta apaga un parámetro, no una obligación.
3. **El respaldo de emergencia también arranca cerrado.** El respaldo congelado en el código, que entra cuando el
   archivo de configuración no se puede leer, tiene la compuerta cerrada: si no, una falla de lectura aplicaría los
   plazos no validados.
4. **Con la compuerta cerrada, el despliegue tiene que ser neutro**: el mismo plazo, el mismo texto al Trabajador y
   el mismo día de purga que antes. Es lo que hace que desplegar el mecanismo no sea activar el parámetro.

---

### 5.24 🔴 Un campo que otro script regenera no se edita a mano: se edita en el script

**El caso.** El manifiesto legal (`firma-service/legal-readiness.json`) lo reescribe
`scripts/actualizar-manifiesto-v1.4.js` desde constantes que el propio script declara
(`NOTA_ACUERDO`, `NOTA_ENCARGO`, `NOTA_NUBE`, `NOTA_CONSTANCIA`, `NOTA_MATRIZ`). Una corrección se
aplicó **en el JSON**, en la línea 87; la siguiente vez que corrió el script, la nota volvió a su
texto anterior y **la corrección desapareció sin que nadie la notara**. Dos días después el abogado
la volvió a señalar (N-1 de su plan de cierre). Peor: el mismo script, al **actualizar** un bloque
que ya existía, refrescaba solo el `hash` y la `nota`, y **no** el `actualizado_at`: la fecha del
bloque de la matriz quedó vieja aunque su fuente dijera lo contrario, y el manifiesto pasó a
declarar una fecha anterior al archivo que describe.

**Reglas:**

1. **Antes de editar un archivo, hay que saber quién lo escribe.** Si hay un script que lo
   regenera, la edición va **en el script**, y el JSON se regenera después. Editar el JSON a mano
   es editar un archivo que se sobrescribe: la corrección no está perdida, está emboscada.
2. **Un script que actualiza un bloque tiene que actualizarlo entero.** Si el bloque existe, se
   refrescan `hash`, `version`, `actualizado_at` y `nota`. La comprobación es directa y barata:
   la fecha que declara el manifiesto contra el `mtime` del archivo que describe.
3. **El manifiesto es de solo lectura para el humano.** Se edita `actualizar-manifiesto-v1.4.js` (o
   `config/`), y después corren el script y su `--check`.

---

### 5.25 🔴 Reemplazar un bloque de líneas por su número puede comerse el texto del borde

**El caso.** Al actualizar un párrafo por rango de líneas (`L[71..73] = [...]`), la primera línea
del rango era **la continuación de la frase del párrafo anterior**: el contenido empieza en la
línea 71, pero esa línea arranca en medio de una oración que empezó en la 70. Reemplazar el rango
dejó esa frase sin principio, y el documento quedó con un texto truncado que nadie notó hasta que
se leyó el párrafo completo. En otro caso, la aguja transcrita a mano no coincidió con el archivo
porque el texto decía «subencargado» y se escribió «subencargados»: la operación **abortó** (bien),
pero el trabajo se estaba haciendo al revés.

**Reglas:**

1. **Antes de reemplazar un rango de líneas se imprime el ANTES y el DESPUÉS.** El rango tiene que
   empezar donde termina la frase anterior y terminar donde empieza la siguiente.
2. **No se transcribe el texto viejo: se lee del archivo.** Un párrafo se reemplaza por su
   posición, o con una aserción (`split(viejo).length - 1 === 1`) que aborte si el texto no es el que
   se cree. Una coma de diferencia **aborta** la operación; una coma de diferencia silenciosa deja
   el documento con una frase rota.
3. **Si el texto viejo no se puede transcribir con confianza, se copia desde el archivo**, no desde
   el borrador.

---

## 6. Convenciones de código

### 5.26 🔴 Un control que apunta a una línea deja de comprobar el documento cuando el documento crece

**El caso.** La compuerta G0 del abogado comprobaba que el texto del abogado en el Anexo de Nube
(A3) seguía intacto **leyendo la línea 274** y buscando ahí una frase. Al diligenciar los
catorce marcadores, el documento creció dos líneas, el texto pasó a la línea 276 —intacto — y
la comprobación se puso en rojo diciendo que el texto del abogado ya no estaba.

**Por qué importa.** Un control que apunta a una posición se rompe en cuanto el documento crece, y
se rompe **falsa**: afirma que el texto no está cuando está. Eso es peor que no comprobar nada,
porque el rojo se lee como un defecto del documento y no como un defecto del control.

Reglas:

1. **Un control que verifica el texto de otro lo busca por contenido, no por posición**, y con una
   aserción de coincidencia **única**: si la frase aparece dos veces, el control aborta en vez de
   elegir una.
2. **Diligenciar un documento cambia su tamaño.** Todo verificador que apunte a una línea, un
   párrafo o un byte fijo hay que revisarlo el mismo día en que el documento crece.
3. **Un marcador puede ser una mención.** El texto del abogado en el §10 del Anexo de Nube dice
   «no se firma con marcadores [PENDIENTE] pendientes», y el analizador contaba ese corchete como un
   dato sin llenar. Trece huecos reales pasaron a uno, y el que quedaba era la palabra del abogado.
4. **La ausencia de filas no es la ausencia del mecanismo.** Antes de afirmar que el sistema no
   registra algo, buscar el `INSERT` en el código: la base dice qué pasó, el código dice qué
   puede pasar. El evento `OTP_SEND_FAILED` existía en el código y solo faltaba que fallara un
   envío para que hubiera fila.

### 5.27 🔴 Una huella que el texto AFIRMA que es la vigente no se puede absolver con una mención a una huella vieja

**El caso (31-oct-2026, noche).** El abogado revisó el paquete y encontró la huella vieja del
Anexo de Nube en el checklist que él firma. Se construyó un control automático que barre todo hex
de 64 caracteres de los documentos del paquete y lo compara con el manifiesto. El control pasó en
verde... y **el paquete tenía el mismo defecto, en otra fila**: la fila D3 del checklist 11 decía
«La huella vigente del Anexo de Encargo es `ebc294ac…` (86 382 B)», que era la huella **vieja** del
A2 (la vigente es `7d626ba9…`, 86 407 B). La fila entera se excusaba con la palabra «histórica»,
que estaba en **otra celda** de la misma fila: la mención a una huella vieja absolvía a la huella
que el documento afirmaba que era la vigente.

**Por qué importa.** Hay dos clases de referencia a una huella, y no son lo mismo:

| Clase | Qué afirma | Cómo se juzga |
|---|---|---|
| **Mención** | «la huella anterior `X` queda como histórica» | Si la misma unidad la declara vieja, pasa |
| **Afirmación** | «la huella vigente del Anexo es `X`» | Si `X` no es la vigente, el documento **miente** |

Una afirmación no se absuelve con una mención. Y el defecto es invisible si el control solo busca
huellas: encuentra `ebc294ac`, la ve junto a la palabra «histórica» y la da por buena.

Reglas:

1. **Una afirmación de vigencia se comprueba siempre.** Si el texto dice que una huella es la
   vigente (la huella vigente del…, es la que lleva…, la que se entrega…), esa huella tiene que ser
   la vigente del manifiesto. Si no lo es, es un fallo, aunque la misma fila diga «histórica».
2. **El alcance de la declaración de «histórica» es la fila, no el documento.** Y dentro de la fila,
   la afirmación de vigencia manda sobre la mención: se comprueba **antes**.
3. **La afirmación se lee por el segmento que precede a la huella**, no por la fila entera: una
   celda puede contener dos afirmaciones distintas («la huella vigente es X; la anterior es Y,
   histórica»).
4. **El control tiene que tener su prueba en negativa.** Reintroducir la huella vieja y comprobar
   que el script **rechaza** el paquete. Un control que solo se probó en verde no está probado.
5. **Las abreviaturas sueltas no se juzgan.** La forma `7298a943` la usan en el paquete también los
   hash de commit de git (`5534aca7`, `e1d10728`). Se juzgan las huellas de 64 caracteres y las
   formas con puntos suspensivos (`abc12345…f6d7`).

### 5.28 🔴 El tar armado en Windows llega al servidor en 777: el `chown` no arregla los permisos

**El caso (31-oct-2026).** El pre-T4 de solo lectura encontró `/opt/kair-firma/app` **y todas sus
subcarpetas en 777**, con la base de prueba dentro (`app/data/test.sqlite`). El despliegue
documentado hace `sudo tar -xzf` + `sudo chown -R kairfirma:kairfirma`: el `chown` cambia el
**dueño**, no los **permisos**. Y el tar se arma **en Windows**, con el `tar` de bsdtar, que **no
guarda permisos POSIX**: todos los archivos salen con modo 777 en el tar, y al extraerlos como root
quedan 777 en disco. El árbol quedó con dueño `kairfirma` y permisos 777 al mismo tiempo.

**Por qué importa.** Con 777, cualquier usuario de la máquina puede escribir el código que corre el
servicio de firma. No es un detalle de forma: es «mínimo privilegio» sin cumplir, y el abogado lo
marcó como bloqueante.

Reglas:

1. **El despliegue normaliza permisos, y es parte del ciclo pegado.** `sudo chmod -R u=rwX,go=rX`
   después del `chown`, en el mismo bloque, sin pausas.
2. **Endurecer no rompe el servicio.** La unidad corre como `User=kairfirma`: lee su propio código y
   no necesita ser root. Con 755 en directorios y 644 en archivos arranca igual.
3. **Los secretos no viven en el árbol del código.** El `.env` está en `/opt/kair-firma/.env` (600) y
   la base de producción en `/opt/kair-firma/data/`, **fuera** de `app/`. Por eso `go=rX` (lectura
   para otros) no expone nada secreto.
4. **La base de prueba no viaja a producción.** `app/data/test.sqlite` se retira en el despliegue.
5. **Permisos no es cifrado.** El disco sin cifrar (LVM sin LUKS) no lo arreglan los permisos: es una
   decisión aparte, del owner y del abogado, y se documenta como tal.

### 5.29 🔴 Una mención de un marcador no es un hueco

**El caso (3-nov-2026).** El Anexo de Nube reportaba un hueco bloqueante: `[PENDIENTE]`. No era un
dato sin llenar: los 14 apartados estaban diligenciados, y el corchete estaba **dentro** del aviso
del propio abogado («Este Anexo no se firma con marcadores [PENDIENTE] pendientes: se firma después
de completarlos, y la firma no sustituye la evidencia»). El texto **nombraba** el marcador; no lo
**dejaba** pendiente. El gate además reportaba «Faltan 1 datos del owner: [PENDIENTE]», que era
falso: al owner no le faltaba ningún dato.

**Por qué importa.** Un control que cuenta la aparición de una palabra cuenta las **menciones**
junto con los **datos**. Con el Anexo bloqueado por una mención, el flujo se detiene por un motivo
que no existe, y quien lo lee cree que a la Empresa le falta algo.

**La regla nueva, en el código y con su test.** `src/utils/textoLegal.js` gana `listarMenciones()`
y `RE_MENCION_DE_MARCADOR`; `analizarAnexoNube` resta las menciones de `huecosBloqueantes` y las
**lista** en el detalle («es una mención, no un dato por llenar»). Test propio de 6 casos:
`tests/legal-menciones-marcador.test.js`.

Reglas:

1. **Una mención se reconoce por su forma exacta, y la forma es estrecha.** Solo un `[PENDIENTE]`
   **inmediatamente precedido** de «marcador» o «marcadores» es mención. «los marcadores del
   formulario: [PENDIENTE]» **no** coincide.
2. **Una mención se lista, no se borra en silencio.** El hueco desaparece del conteo y el detalle
   dice por qué. Si desaparece sin explicación, el que lee no puede distinguir «no había» de «se
   decidió».
3. **Un patrón demasiado ancho se acota, no se borra.** Cuando un control señalando una frase
   verdadera, el arreglo es **acotar el patrón**, no quitar el control: y la acotación va por
   **línea**, porque en una misma línea puede estar la afirmación sobre el archivo y, al lado, la
   del servidor.

### 5.30 🔴 El estado de un requisito se cuenta con una palabra clave, no con texto libre

**El caso (3-nov-2026).** El cuadro canónico (`respuesta-checklist-cierre-2026-10-30.md`) declaraba
**63 cerrados · 33 pendientes · 0 no aplica · 96** en su tabla resumen, y el conteo real daba
**95 requisitos**: el 6.11 tenía como estado el texto libre «EJECUTADA en el árbol de trabajo;
pendiente de vincular a T3», que el contador no reconocía. El documento declaraba 96 y **contaba
95**: era incontabilizable, y su tabla no se podía verificar contra nada.

**Por qué importa.** Un estado escrito en prosa no se puede contar, y una tabla que no se puede
verificar es una afirmación, no un dato. Peor: el 6.11 **sí** estaba a medio hacer, así que la tabla
decía «12 cerrados» en la sección 6 cuando en realidad había 11 cerrados y 1 a medias.

**La regla.** El estado es **la última palabra de la clave** (lo que va después del último rayón
largo) y tiene que ser una de estas cuatro: `CERRADO`, `PENDIENTE`, `PARCIALMENTE`, `No aplica`.
`PARCIALMENTE` cuenta como pendiente (no está cerrado: algo falta). **La explicación va en el cuerpo,
no en la clave.**

Reglas:

1. **La clave del encabezado es un estado, no un párrafo.** Si hay que explicar, se explica debajo.
2. **La tabla resumen no se escribe a mano.** `scripts/contar-estados-checklist.js --escribir` la
   regenera desde el conteo real, y sin opciones **falla** si el documento no cuadra. Cuando el
   cuadro se mueve, los números que lo citan en otros documentos se actualizan con el conteo nuevo.
3. **Un requisito a medias se declara a medias.** Escribir «EJECUTADA localmente; falta el clon
   limpio» en el estado no es un detalle de redacción: hace que el requisito **desaparezca** del
   conteo, y que la tabla declare un cierre que no ocurrió.

### 5.31 🔴 Un commit amendado que ya estaba pusheado rompe el push: `--force-with-lease`, no `--force`

`git push` rechaza un commit que ya no está en la punta del remoto, y el rechazo **no dice por qué**: la
salida dice `! [rejected] Dev -> Dev (non-fast-forward)` y el operador, si tiene prisa, va al `--force`
sin más.

**El caso real (6-nov-2026).** Se corrigió un commit ya pusheado (📦1011) con `git commit --amend`,
porque el script tenía dos defectos que aparecieron probando en el ambiente real. Localmente quedó
todo bien; el remoto seguía teniendo la versión vieja (`489fc814`). El push normal falla.

**La forma correcta es fijar el hash que se espera encontrar:**

```powershell
git push --force-with-lease=Dev:489fc814 origin Dev
```

`--force-with-lease=<rama>:<hash-esperado>` **falla** si el remoto no está en ese hash. Eso es
justo lo que se quiere: si alguien más empujó mientras tanto, el push **no** pisa su trabajo.

**Reglas:**

1. **Nunca `--force` a secas.** Sin el `:<hash-esperado>` no hay ninguna garantía de que el remoto no
   haya avanzado, y un `--force` a ciegas puede borrar el trabajo de otro.
2. **Antes de forzar, mirá qué hay en el remoto** (`git log --oneline origin/<rama>`) y confirmá que
   lo que vas a pisar es **tu** commit y nada más: mismo padre, mismo autor. Si hay trabajo de
   terceros encima, no se fuerza: se hace cherry-pick o merge.
3. **Un `--amend` después de pushear es un commit distinto**: el hash viejo queda huérfano y es el que
   puede estar citado en el CHANGELOG o en un documento. Decilo.
4. **Quien lee el remoto tiene lo que pusheaste, no lo que amendaste.** Si no forzaste, el remoto tiene
   la versión vieja y el repo local la nueva: verificá contra el remoto, no contra local.
5. **El `force-with-lease` se aplica a una rama, no al repo:** es un push de esa rama, con ese estado
   esperado. Revisar el diff del remoto antes de mandarlo no es opcional: es lo que hace seguro el
   `--force-with-lease`.

### 5.32 🔴 Un 409 que no dice qué hacer es un paso que el script se saltó: el código del servidor es el contrato

Un `409` de un flujo no es un ruido: es la **precondición** que el servidor no vio satisfecha. El mensaje
diga lo que falta, pero **no cuál era el paso anterior**: hay que leer dónde se lanza el error y encontrar
qué lo produce.

**El caso real (6-nov-2026).** La herramienta que prueba la 10.4 en el servidor real se detuvo en el paso
de aceptar el Acuerdo con `409 DISPOSICION_POLITICAS_NO_REGISTRADA`: «el servidor no tiene constancia de
haber puesto las políticas de seguridad a disposición del Firmante». El servicio sí la registraba, pero
**cuando sirve el contexto** (`GET /s/:token` → `registrarPuestaEnDisposicionPoliticas`,
`publicFlow.js:176`), y la aceptación la exige (`publicFlow.js:670-675`). El script nunca pedía el
contexto en ese punto: pedía el contexto más tarde, en el paso siguiente. El navegador lo hace al abrir
el enlace; el script tiene que hacer lo mismo.

**Reglas:**

1. **El 409 se lee en el código, no se adivina.** El `code` del error (`DISPOSICION_POLITICAS_NO_REGISTRADA`)
   se busca con `grep` en el servicio: ahí está la precondition que falta y, en las líneas de arriba, la
   llamada que la produce.
2. **El script tiene que hacer lo que hace el navegador.** Si el cliente real pide un contexto antes de
   aceptar, el script lo pide antes de aceptar. "No meagre" no es una razón: el flujo se quedó esperando
   una llamada que nunca llegó.
3. **Un 409 que el script puede explicar es un paso que se saltó.** Antes de culpar al servicio, se
   enumeran los pasos que el cliente real hace y se comparan con los que hace el script.
4. **El paso que faltaba también es un paso que hay que probar.** El test tiene que **detectar el bug si
   vuelve**: en este caso el servicio falso del test pasó a exigir el contexto (409 si no se sirvió), y
   se comprobó que sin el fix **fallan 8 pruebas de 20**.
5. **Un flujo probado en el ambiente real encuentra lo que la suite no puede.** La suite corría contra un
   servicio falso que aceptaba siempre: el paso que faltaba no se podía ver.

### 5.33 🔴 Una comprobación que lee de una API que no expone el dato falla en falso, y el servicio falso la deja pasar

Antes de creerle a una falla: **comprobar que la fuente de la que se lee tiene el dato**. Si la API no lo
expone, lo que se lee es vacío, y una comprobación contra vacío es **falsa por construcción** — no está
midiendo lo que dice medir.

**El caso real (6-nov-2026).** La misma herramienta de la 10.4 falló en dos comprobaciones: «la huella
archivada es la del texto que el firmante leyó» y «el texto que descarga el firmante es el que quedó
archivado». Ambas leían `agreement_hash` de `GET /internal/sign-requests/:id`, que devuelve
`agreement_version` pero **no** `agreement_hash` (`src/routes/signRequest.js:469-487`). El servicio **sí**
escribía la huella de la versión nueva en la fila (`publicFlow.js:362`) y la fila en la base **sí** la
tenía — la comprobación de la base, en el mismo script, salía bien. Lo que fallaba era **dónde se leía**.

**Reglas:**

1. **Un fallo se lee contra la fuente**: si el valor leído viene vacío, primero se comprueba **qué
   expone** esa fuente. Un `null` en la respuesta es un dato que no viaja, no un dato que falta.
2. **La fila es la fuente de verdad** cuando lo que se verifica es cómo quedó la fila: se lee de la base,
   no de una proyección de la API.
3. **El servicio falso de los tests tiene que reproducir la API real**, incluida la ausencia de campos.
   Si el test falso devuelve `agreement_hash` y el endpoint no, el test pasa con un valor que el
   servidor nunca dio, y el error se descubre en producción.
4. **Un test que se cae al revertir el fix es la prueba de que el test sirve.** Acá: sin el fix fallan
   **7 pruebas de 20**.
5. **Un endpoint que no expone un campo que su cliente necesita es un hallazgo, no un detalle**: se
   anota y se decide con calma (cambiar ese contrato es decisión del owner), sin colarlo de paso en un
   fix de una herramienta.

### 5.34 🔴 Un deploy depende de procesos auxiliares que tienen fecha de expiración

El paquete que se descarga y el log que vuelve son **procesos auxiliares**: si mueren a mitad del deploy,
el deploy falla por una razón que no tiene nada que ver con el deploy.

**El caso real (6-nov-2026).** El puente HTTP que sirve el paquete del deploy y recoge el log del
servidor estaba corriendo como tarea en background: ese tipo de tarea tiene un **tope de una hora**, y a
las 16:30:52 mataron el puente. El deploy de las 16:23, además, falló en el paso de descarga con
`curl: (23) Failure writing output to destination` **sin causa aislada** (el puente sí sirvió el archivo:
`971421 B` registrados en su log). Esa falla nunca se aisló, así que la respuesta no fue adivinar la
causa: fue hacer el paso **resistente** (tres reintentos, escritura atómica y respaldo local ya
verificado) y, además, dejar el puente **desanclado** para que no se muera solo.

**Reglas:**

1. **Lo que el servidor necesita tiene que sobrevivir la sesión**: se lanza **desanclado**
   (`Start-Process`), no como tarea en background, y se comprueba que responde.
2. **Un deploy depende de la vida de sus auxiliares**: el puente es parte del deploy, y su vida útil es
   parte del plan. Un paquete que se sirve por HTTP tiene una copia local **verificada** en el servidor
   como red de seguridad.
3. **Cuando una falla no se aisló, la respuesta es robustecer, no inventar la causa.** Reintentos,
   escritura atómica y un segundo origen verificado: el paso deja de depender de la causa.
4. **Un log que se recoge por HTTP se pierde si el puente muere**: el deploy tiene que poder **terminar**
   sin que nadie lo esté mirando.

### 5.35 🔴 El estado de un ítem del readiness es el MISMO en las dos compuertas: la compuerta solo filtra al final

El readiness legal tiene dos compuertas (`publicacion` y `primera_firma`) y 40 ítems. Cada ítem trae su
propio `bloquea` (a qué compuertas bloquea). El reporte de una compuerta **no** mide un subconjunto de
ítems: **mide los 40**, y al final filtra los que bloquean la compuerta consultada.

**El caso real (6-nov-2026).** El deploy medía en el servidor la compuerta `publicacion` (y por eso salía
«20 · Pendientes: 0»). La pregunta era si quedaban bloqueantes para la **primera firma**, y esa compuerta
**nunca se había medido en el servidor**. Se comprobó en el código que el estado de cada ítem se calcula
igual para las dos compuertas: `gate` solo se usa en `readinessLegal.js:1922`
(`items.filter((i) => i.bloquea.includes(gate))`) y en el generador del texto. O sea: **el reporte de una
compuerta es el estado de todos los ítems**, y la otra compuerta se calcula con el `bloquea` de cada ítem.

**Reglas:**

1. **Una compuerta no es una medida distinta**: es un filtro sobre los mismos ítems. Antes de medir otra
   compuerta, se lee **dónde** se usa `gate` en el código (acá: solo en el filtro final).
2. **El `bloquea` de cada ítem está en el código**, no en el reporte de texto: el texto marca con `*` los que
   bloquean la compuerta consultada, y el JSON trae el `bloquea` completo.
3. **"El gate está verde" y "no hay bloqueantes" no son lo mismo**: el gate de publicación estaba en verde
   con 3 pendientes, y esos 3 bloqueaban la compuerta de primera firma.

### 5.36 🔴 Una variable de entorno encendida se deduce del número de avisos del reporte

Hay comprobaciones cuyo estado depende de una variable de entorno, y el reporte las publica como `aviso`.
Eso convierte un agregado en un **testigo** del valor de la variable.

**El caso real (6-nov-2026).** Al medir la compuerta de primera firma contra una copia de la base de
producción, el resultado local fue `OK: 36 · Avisos: 1` mientras el servidor había medido `OK: 37 · Avisos: 0`
**con el mismo código**. El ítem era `anexo_nube::empresas_nube`, que queda en `AVISO` **solo** cuando la
compuerta `FIRMA_EXIGIR_ANEXO_NUBE` está apagada (`readinessLegal.js:1704-1724`:
`exigirNube ? … : ESTADOS.AVISO`). Los otros dos ítems que pueden dar aviso (`empresas_base` y
`estado_encargo`) estaban en `pendiente`, así que no explicaban la diferencia. Conclusión: **la compuerta
está encendida en producción** — y la base lo confirmó (ASEPLUS con
`anexo_nube_firmado_at = 2026-11-05T22:51:34.349Z`).

**Reglas:**

1. **Un agregado que cambia entre dos corridas del mismo código es una pista**: `Avisos: 0` contra
   `Avisos: 1` no es ruido, es **el estado de una variable**. Se busca el ítem que explica la diferencia.
2. **Un ítem que no bloquea ninguna compuerta igual informa**: `empresas_nube` tiene `bloquea: []` cuando la
   compuerta está apagada, y por eso no movió el resultado del gate — pero sí el conteo.
3. **La deduceción se confirma con la fuente**: el `.env` del servidor es `0600 kairfirma` y no se lee sin
   `sudo`; la fila de la empresa en la base sí se lee, y fue la que confirmó.
4. **No se "ajusta" la configuración para que la medición cuadre**: primero se deduce el valor del dato
   medido, después se vuelve a medir y se compara.

### 5.37 🔴 Una medición contra una copia de la base se valida reproduciendo el número del servidor

Medir con una **copia** de la base de producción (en vez de la base viva) es más seguro y no necesita
`sudo`. Pero una copia puede no ser la base: el servicio está escribiendo, hay WAL, y hay variables de
entorno que no se ven. **La validación no es opcional**: la medición tiene que **reproducir exactamente** el
número que el servidor ya había medido, y si no reproduce, **no se reporta la otra compuerta**.

**El caso real (6-nov-2026).** La compuerta `primera_firma` nunca se había medido en el servidor (el deploy
solo mide `publicacion`), y `javier` no puede correr el audit allá (`/opt/kair-firma/app` es `750 kairfirma` y
el `.env` es `0600 kairfirma`). La maniobra: copiar la base con `sqlite3 -readonly … ".backup …"` (copia
consistente aunque el servicio escriba), traerla verificando la huella, correr **el mismo código
desplegado** contra ella, y **exigir** que la compuerta `publicacion` reprodujera el número del servidor
(`Items: 40 · OK: 37 · Pendientes: 3 · Avisos: 0 · N/A: 0`, `Bloqueantes: 20 · Pendientes: 0`). La primera
corrida **no reprodujo** (`OK: 36 · Avisos: 1`): de ahí salió el descubrimiento de §5.36. La segunda, con la
compuerta encendida, **sí reprodujo** — y recién entonces se midió la otra compuerta (`Bloqueantes: 37 ·
Pendientes: 3`). Las dos copias en claro se borraron después.

**Reglas:**

1. **La copia se hace con `sqlite3 .backup`**, no copiando el archivo: con el servicio corriendo, el archivo
   principal puede no incluir el WAL. Se abre en `-readonly` para no poder escribir en la base de producción.
2. **La copia se verifica por huella** antes de usarla, y la base de producción **no se abre en escritura**.
3. **La medición se valida contra un número ya medido en el servidor**: si no reproduce, el problema son los
   insumos, y la medición **no se reporta** (el script corta con un código de salida distinto de 0).
4. **Una copia en claro de datos personales se borra al terminar** (en el PC y en el servidor): el motivo de
   copiarla es medir una vez.
5. **Medir con copia no es medir en producción**: el reporte lo dice. La compuerta `primera_firma` se midió
   **contra una copia**; lo que se afirma es el estado de la base, no una ejecución en el servidor.

### 5.38 🔴 Una cabecera que declara una cualidad del archivo es una afirmación que hay que hacer verdadera

**El caso real (12-nov-2026), la ronda 15.** El programa nuevo `scripts/determinaciones-v1.4.js` abría su
cabecera con «**ASCII puro, LF, sin BOM. Es codigo**» y el archivo tenía **21 `§` y una `ñ`**. Peor: la
afirmación no era una rareza, porque **el repo entero la contradice**: en `firma-service/scripts/`, **47 de
62** archivos tienen caracteres sobre 127, y en `tests/`, **176 de 182**. O sea, la línea «ASCII puro» de
varias cabeceras es **aspiracional**: PROMPT.md §5.5 lo que prohíbe es el **CJK, el cirílico y el hangul**,
no la `ñ` ni el `§`. Un archivo cuya cabecera promete una cualidad que no tiene es una mentira que nadie
verifica, y el siguiente que lo lea se apoya en ella (y mete una tilde «porque en el repo se hace»).

**Reglas:**

1. **Si la cabecera dice una cualidad del archivo, esa cualidad se cumple o la cabecera se corrige.** Una
   de las dos, siempre: no hay una tercera.
2. **La afirmación que sobrevive es la que tiene un guard.** El `tests/scripts/generar-candidatos-v1.4.test.js`
   comprueba ahora, sobre los dos programas, que no hay **ningún** byte sobre 127, que no hay BOM, que no
   hay CRLF y que no hay CR suelto. Ese check es barato y es lo que convierte la frase de la cabecera en
   un dato.
3. **El guard tiene que morder, y eso se comprueba con un mutante**: se metió una tilde en una **copia** y
   el check la detectó (`no-ASCII=2` → rojo). Un check que nunca se ha visto fallar no es un check.
4. **§5.9 manda sobre la documentación**: una regla que el código no cumple es una regla aspiracional. Lo
   que se contrasta contra el código es lo que manda; el resto se corrige o se deja de decir.
5. **Antes de convertir a ASCII se mira qué texto es literal legal.** El texto que se aplica a los
   documentos va en **entidades HTML** (`&sect;`), que ya son ASCII y **no se tocan**: la conversión afecta
   solo a las cadenas descriptivas. Y se comprueba que el resultado no cambió: los candidatos siguieron
   dando las mismas huellas (`fae2b26b…` y `7576b1a1…`), el **texto del candidato sigue siendo byte a byte
   el de la determinación**, y los **8** tests del generador siguen verdes.

### 5.39 🔴 Cambiar el criterio con el que se cuenta un estado cambia la fuente de la verdad, no el número

**El caso real (13-nov-2026), la ronda 16.** El owner decidió que un bloque del mapa de la meta cierra
cuando **el pedido sale**, y no cuando el acto de un tercero se cumple. El mapa tenía 30 bloques: **9
cerrados y 21 pendientes**, y esos 21 pendientes eran, sobre todo, cosas que dependían de **alguien más**:
una firma, una credencial, una ventana de mantenimiento, una respuesta. Con el criterio viejo, cerrarlos por
decreto habría sido un **verde falso**; dejarlos abiertos para siempre, con el pedido ya escrito y con
destinatario y fecha, era un **conteo que no contaba nada**.

**Reglas:**

1. **Un cambio de criterio no se propaga como un cambio de número.** Si el conteo pasa de 9/21 a 30/0
   porque cambió la regla, el documento tiene que **decir cuál es la regla**; si no, el número nuevo se lee
   como «se hizo todo lo que faltaba».
2. **La fuente de la verdad del conteo se cambia CON el criterio.** Antes la fuente era el estado de cada
   bloque; ahora es la **tabla de solicitudes** (`tabla-de-solicitudes-2026-11-13.md`), con su estado, su
   fecha y su destinatario. El script que cuenta lee esa tabla y **falla en los dos sentidos**: un bloque que
   invoque una solicitud que no existe, y una solicitud que ningún bloque invoque.
3. **El estado que nadie va a cambiar desde el código vive en la tabla, no en el pie de nota.** La respuesta
   del tercero (`RESPONDIDA`, `CERRADA`) se sigue en la tabla, con su fecha: así el conteo puede seguir
   diciendo «cerrado = pedido emitido» sin mentir sobre el acto.
4. **El documento declara lo que NO afirma.** La leyenda del mapa dice, de entrada, que `CERRADO` significa
   «el pedido está emitido y medido» y que el mapa **no afirma que el servicio pueda abrirse a empresas
   reales**. Cambiar el criterio de un estado sin decir qué pasó es exactamente cómo se cuela un verde falso.
5. **El registro de lo que se midió no se corrige: se anota.** Los documentos que publicaban el conteo viejo
   llevan una **nota de la fecha** que dice cuál era su cifra y cuál es la vigente.

### 5.40 🔴 Una revisión que no es la respuesta cambia lo que se envía, no lo que está cerrado

**El caso real (13-nov-2026), la ronda 17.** El owner pegó una revisión de la **asesoría jurídica** sobre
las cuatro solicitudes al abogado matriculado. El escrito lo dice en su propio encabezado: «No
sustituye la decisión del abogado matriculado ni del representante legal». Traía **una corrección
obligatoria** (una cita normativa mal puesta), **dos avisos** (dos cosas que no se habían verificado) y
un punto a favor. Alguien podía leer eso como «ya está, el abogado respondió» y cerrar el círculo.

**Reglas:**

1. **Una revisión cambia el pedido, no el estado.** La revisión **dejó las cuatro sin `RESPONDIDA`**:
   lo que se corrige es **lo que se manda**, no lo que el destinatario contestó. El registro de
   solicitudes es el que dice si alguien respondió. (Más tarde ese mismo día, 13-nov-2026, S-01, S-03
   y S-04 se cerraron **por resolución del owner** —«resuelto por decisión del owner, sin ratificación
   externa», no por la revisión ni por respuesta—; **S-02 sigue `EMITIDA`** porque la compuerta exige
   `validado_por` y `validado_at` reales.)
2. **Una corrección va a la FUENTE, y la salida se regenera.** No se parchea el documento final: se
   corrige el texto legal que lo alimenta y se **regenera**. Un texto **ya suscrito no se corrige**: se
   sustituye, y la corrección vive en la versión nueva.
3. **Lo no verificado se marca como no verificado, en el documento que se envía.** Un texto que afirma
   algo que nadie comprobó es un defecto, aunque el texto sea correcto en el fondo. Si la afirmación no
   se pudo verificar, **se pide la confirmación** y se dice que no está verificada.
4. **Una pregunta que decide una redacción se pregunta de forma expresa.** Si la respuesta cambia lo que
   se escribe en la v1.4 (una obligación legal frente a una decisión propia), la pregunta **va en el
   escrito**, con su posible respuesta escrita, no implícita en un adjetivo.
5. **La huella de un insumo es la del contenido, no la que tenía cuando se escribió el documento que lo
   cita.** Si el insumo cambia, el documento que lo cita se vuelve a medir: bytes y SHA-256 con
   `execFileSync`, nunca con un pipe de shell.

### 5.41 🔴 Un requisito con código y con papel son dos requisitos, y el que no está escrito no está contado

**El caso real (13-nov-2026), la ronda 18.** El owner preguntó «¿hay algo pendiente por decisión?». La pregunta
se apoyó en el expediente y el expediente **no tenía la respuesta**: había **cinco decisiones del owner**
pendientes desde el 31-oct-2026 (las del §9 de `procedimiento-canal-fecha-terminacion-2026-10-31.md`), y
**ningún documento de cierre las mencionaba**. El mapa decía «30 bloques, 30 cerrados, 0 pendientes», y el
**0 pendientes era cierto y estaba incompleto**: el requisito no estaba registrado, así que no estaba
*pendiente* —estaba **invisible**.

**Reglas:**

1. **«Implementado» describe el código, no el requisito.** El §6 del Anexo de Encargo no dice «implementado»:
   dice «por el canal que el Encargado habilite». Un requisito que tiene una cara de código y otra de papel
   **no está cumplido** mientras falte el papel, por mucho que la prueba pase y el programa esté bien escrito.
2. **Una decisión que no está escrita, no está tomada.** Cinco decisiones pendientes el 31-oct siguen siendo
   cinco decisiones el 13-nov. Que nadie las reclamara no las decidía: las escondía.
3. **Un hueco que no está registrado no es un hueco cerrado: es un hueco invisible.** El mapa y la tabla de
   solicitudes cuentan lo que está escrito. Si un requisito no aparece en ninguno, **no está cerrado**,
   porque el conteo no lo cubre. Un `0 pendientes` que no cubre el universo es un verde falso con otro nombre.
4. **El hueco se escribe primero; el número sale después.** La corrección no es cambiar el número para que
   cuadre: es **registrar el hueco** (su bloque, su solicitud, su dueño y su fecha), y dejar que el script
   regenere el conteo desde el conteo real.
5. **La pregunta «¿qué falta?» se responde con el expediente, no de memoria.** Y si el expediente no alcanza
   para responderla, **eso es un hallazgo**: un requisito que el expediente no conoce es un requisito que
   nadie está midiendo.

### 5.42 🔴 Una decisión del owner se escribe en el documento que la pide; su solicitud se cierra cuando la respuesta se aplica y se verifica — o, sin respuesta, cuando el problema de fondo quedó resuelto y verificado (cierre por resolución)

**El caso real (13-nov-2026), la ronda 19.** La ronda 18 dejó registrada la **S-22** con las cinco
decisiones del owner sobre el canal de `fecha_terminacion`, y el bloque **M.31** en el mapa, con las
cinco **pendientes**. El owner las respondió ese mismo día. La respuesta tenía que quedar **escrita en el
documento que las pedía** —`procedimiento-canal-fecha-terminacion-2026-10-31.md`, en sus §3, §4 y §5— y
no en un chat, en un correo ni en una nota del `Historial.md`.

**Reglas:**

1. **La decisión se escribe donde se va a aplicar, con su fecha y su responsable.** En el procedimiento,
   en la sección que la pide; cada una con su *por qué* y su *consecuencia*, para que dentro de un año se
   sepa si fue una decisión o un descuido.
2. **Cerrar una solicitud es un acto de tres pasos**: la respuesta **se aplica** al documento destino,
   **se verifica** (con un guard que falle si la decisión no está) y **se registra** con su fecha. Una
   solicitud respondida y no aplicada sigue abierta, aunque el mensaje esté en el correo.
3. **La solicitud se cierra; el bloque del mapa no cambia de estado.** Un bloque cerrado por solicitud
   significa «el pedido está emitido y medido»: que la respuesta llegó y se aplicó **no** lo convierte en
   un bloque «cumplido». Lo que cambia es el **cuerpo** del bloque: su «qué falta» deja de listar la
   decisión y empieza a listar lo que sí falta (el abogado, la primera operación real).
4. **El estado de la solicitud se cuenta por su palabra** (`PREPARADA`, `EMITIDA`, `RESPONDIDA`,
   `CERRADA`), y **la cifra sale del script**. El mapa, el guion de cierre, la §8, el acta y el CONTEXT
   publican el conteo; el que no se reescribe es el registro con fecha de una ronda anterior.
5. **Un guard que no se ha visto fallar no es un guard.** El test nuevo comprueba que las cinco decisiones
   **están escritas** en el procedimiento y que la S-22 está `CERRADA`; si alguien borra el Anexo A o
   devuelve la decisión a «pendiente», el test **falla**.
6. **Hay una segunda forma de cerrar: por resolución (13-nov-2026).** Cuando el problema de fondo quedó
   **resuelto y verificado en el repositorio**, la fila se cierra aunque el destinatario no conteste con
   nombre, fecha y SHA, y la anotación de la propia fila dice **«resuelto por decisión del owner, sin
   ratificación externa»** — el registro no finge una validación externa que no hubo —. Si la respuesta
   formal llega después, se **archiva como ratificación sin reabrir la fila**. **Excepción: la S-02** (la
   compuerta de la tabla supletoria): `retencion.js:632-664` exige `validado_por` **y** `validado_at`
   reales, y un marcador no los reemplaza — o el abogado valida, o el owner cambia la regla documentada
   en el documento de la tabla, pero no en silencio —. La leyenda completa, con lo que cada cierre **no**
   dice, está en `tabla-de-solicitudes-2026-11-13.md`.

### 5.43 🔴 Medir y mutar no pueden ocurrir a la vez: la huella que sale es la del mutante, no la del archivo

**El caso real (13-nov-2026), la ronda 20.** Al publicar la huella del procedimiento del canal
(`procedimiento-canal-fecha-terminacion-2026-10-31.md`) se corrieron en paralelo los **mutantes** —el
arnés que mete un defecto, corre el verificador y restaura el archivo— y la **medición**. El arnés tenía
el archivo en estado mutado en ese instante: la medición devolvió **16 495 B / `5220559b…`**, que era la
huella **del mutante**, no la del archivo. La huella real era **16 513 B / `6f792eae…`** (la de ese
momento: el procedimiento volvió a cambiar el 13-nov-2026, en la ronda 21), y el escrito que se iba
a enviar declaraba la huella equivocada. Se detectó porque el test que compara la huella declarada
con la real **falló**: ese check es el que atrapó el error.

**Reglas:**

1. **Nunca se mide un archivo mientras un mutante lo tiene modificado.** El arnés de mutantes escribe,
   corre el verificador y restaura: entre la escritura y la restauración el archivo es **otro archivo**.
   Medir en esa ventana da la huella del defecto.
2. **La misma regla de la suite**: nunca dos corridas simultáneas en el mismo árbol. Un mutante es una
   corrida que escribe.
3. **La huella que se publica se mide DESPUÉS**, con el árbol quieto, y **se vuelve a medir al final**,
   después de todos los cambios.
4. **El guard que compara la huella declarada con la real es el que salva**: sin ese check, la huella
   del mutante habría viaja al escrito que se envía, y el abogado habría recibido un número que no
   corresponde con el archivo del repositorio.

### 5.44 🔴 Un documento que declara lo que le falta genera un pendiente: ese pendiente es una fila, y repetir no es corregir

**El caso real (13-nov-2026), la ronda 21.** El owner volvió a escribir las cinco decisiones del
canal de `fecha_terminacion` y pidió aplicarlas. Al cotejar su texto con el procedimiento,
**el contenido era el mismo**: las cinco decisiones ya estaban escritas desde la ronda anterior,
cada una en su sección, con su *por qué* y su *consecuencia*. Lo que sí cambió fue el **encabezado**
del procedimiento, que quedó con el estado «**pendiente de firma del owner** y de la validación del
abogado». Ese estado es un **pendiente con dueño**, así que se registró como la **S-24**: una fila
más, con destinatario, qué se pide, cómo se verifica y fecha.

**Reglas:**

1. **Un documento que dice «me falta X» tiene que tener X en la tabla de solicitudes.** Si el
   encabezado, el §9 o el cuerpo de un documento declara un estado pendiente, ese pendiente se
   registra como fila. Sin fila es un **hueco invisible** (trampa 162): el conteo no lo cubre y el
   mapa no lo nombra.
2. **La firma es un acto, y los actos tienen fila.** «Firmar el documento» no es un detalle de la
   decisión: es un acto del owner, con su verificación (el acta de la firma, con la huella del texto
   que se firma).
3. **Repetir no es corregir.** Cuando el owner reescribe lo que ya está escrito, se coteja el
   texto: si el contenido es el mismo, la solicitud **no se reabre** (sus criterios ya estaban
   cumplidos y verificados) y lo que se registra es **lo que cambió de verdad**; si el contenido
   difiere, la solicitud se reabre y se vuelve a aplicar, y la fila dice por qué.
4. **El estado del documento y el estado de la fila son el mismo hecho.** Si el encabezado dice
   «firmado» y la fila dice `EMITIDA`, una de las dos está mintiendo. El guard compara los dos.

### 5.45 🔴 Una respuesta que no es formal mueve la fila a `RESPONDIDA`: no la cierra, y lo que no se verificó queda declarado como no verificado en el texto

**El caso real (13-nov-2026), la ronda 22.** Un abogado matriculado respondió por escrito a las cinco
solicitudes al abogado (**S-01, S-02, S-03, S-04 y S-23**). El escrito **verificó la norma** en fuente
oficial y **contestó de forma expresa la pregunta de la región** (la condición de región United States **no
es una exigencia legal**: es una decisión conservadora de K+AIR). Pero **no llevaba nombre, fecha de
suscripción ni huella de un documento firmado**: es un escrito **no formal**. Y su propio texto decía tres
cosas que el registro tiene que respetar: «la fila NO cierra», «yo no puedo sustituir la redacción» y «lo
que no puedo verificar **es un hecho, no una norma**».

**Reglas:**

1. **Una respuesta no formal no cierra una fila que exige validación formal.** El estado que le
   corresponde es **`RESPONDIDA`**: el destinatario respondió y falta aplicar/completar lo que dijo. La
   fila que tiene un **candado en el código** (`retencion.js:632-664` exige `validado_por` **y**
   `validado_at` reales) **no se cierra con un marcador**, ni aunque la sustancia esté validada: el propio
   abogado lo escribió.
2. **Una respuesta que llega después de un cierre por resolución se archiva como ratificación, sin
   reabrir la fila** —y la fila lo dice: «el escrito del abogado se archivó como ratificación, sin
   reabrir». Reabrir una fila cerrada por resolución contradice la regla que la cerró.
3. **Lo que no se verificó se escribe como no verificado, en el texto que se firma.** Un documento que
   afirma «Estados Unidos es país con nivel adecuado» sobre una norma que el abogado **no verificó** es un
   documento que miente (art. 4 literal d de la Ley 1581: veracidad). La redacción honesta cita la norma
   **como marco sectorial de referencia, no como fundamento**, y dice que **no fue verificada**.
4. **Un hecho contractual que no se verificó es un pendiente, no un hecho.** La entidad que el contrato
   asigna, la huella y la efectividad del instrumento, el alcance de una cláusula y un plazo de
   notificación quedan **declarados como pendientes de confirmación contra el contrato**; un plazo propio
   se declara como **propio**, nunca como reflejo del plazo del proveedor.
5. **El escrito se archiva verbatim, con su huella y con su defecto.** El original puede venir
   **truncado**: eso se dice, se señala dónde se corta, y lo que llegó aparte se separa. Se archiva el
   **texto recibido**, no un resumen.
6. **Una corrección de contenido no se aplica al final del texto: se aplica a la fuente y se regenera.**
   El v1.4 se arma desde `legal/anexo-nube-v1.3.html` (suscrito) más las determinaciones; **editar el
   HTML a mano se pierde** en la próxima generación. Y **un texto suscrito no se corrige**: se sustituye.
7. **Un rango de sustitución tiene que cubrir el párrafo entero.** Un rango que se queda corto deja un
   fragmento huérfano del texto base pegado al texto nuevo: el documento sale con un párrafo roto y un
   texto duplicado, y **el generador no se queja** (trampa 166).
8. **Cuando la fuente cambia, los documentos que declaran su huella se vuelven a medir y se anotan.**
   Un escrito que se va a enviar con la huella vieja del insumo no es un escrito con una huella: es un
   escrito con una afirmación falsa (trampa 161). Los registros con fecha **se anotan, no se reescriben**.

### 5.46 🔴 El candidato tiene que ser byte a byte el literal del dictamen: un fragmento que reescribe el literal hace que el texto que se firma no sea el texto que se aprobó

**El caso real (13-nov-2026), la ronda 22 (tarde).** La determinación **B.8.5** sustituye el párrafo
completo «Lo que queda pendiente» del Anexo de Encargo (el rango `L1-B85`, líneas 524-537). El literal
nuevo copió del texto base la línea que nombra la suscripción —«…esta versión **2026-11-11** del Anexo
de Encargo…»—, porque en el texto base esa era la versión; en el candidato la versión que se suscribe es
la **2026-11-12**, y el motor lo resolvía con un fragmento aparte (`B6.4-535`) que sustituía
`2026-11-11` por `2026-11-12`.

El resultado: **el fragmento cayó dentro del rango**. Cuando el motor insertó el literal de B.8.5, el
fragmento pasó a reescribir **el literal recién insertado**. El candidato salió con `2026-11-12` y el
dictamen decía `2026-11-11`: **el texto que se iba a firmar no era el texto que estaba escrito**. El
generador **no se quejó** —el ancla casaba exactamente una vez—, y el defecto solo apareció cuando el
guard de identidad byte a byte comparó el candidato con el dictamen.

**Reglas:**

1. **El literal de una determinación es lo que se firma.** El candidato tiene que contenerlo **byte a
   byte**, y el guard lo dice: `el texto del candidato es byte a byte el de la determinacion`. Un motor
   que «corrige» el literal por su cuenta rompe esa garantía.
2. **Un fragmento (`B.6.x`) nunca reescribe el literal de una determinación.** Es una comodidad para
   anclas cortas. Si su destino cae **dentro** de un rango, hay dos salidas malas: el fragmento queda
   muerto (casa cero veces y el generador se niega) o reescribe el literal nuevo (y el texto firmado deja
   de ser el aprobado). La salida buena es la de la fuente: **el literal lleva la versión correcta y el
   fragmento se elimina**.
3. **El motor no sabe lo que ya está bien.** Solo conoce anclas: si una fecha ya quedó correcta en el
   literal, el motor la vuelve a cambiar si encuentra el fragmento. Por eso la corrección va en el
   literal, no en un parche del motor.
4. **Un guard de esta clase tiene que haber mordido.** El mutante es el defecto completo —el dictamen
   con la fecha vieja **más** el fragmento—: así se verifica que fallan el guard de identidad byte a byte
   y el guard estructural. Un mutante a medias (solo el fragmento) falla por otra razón y **no prueba
   nada**.
5. **La corrección que no cambia los bytes se anota igual.** Los candidatos de esta ronda **no
   cambiaron** de huella (`ba664e6f…` y `d4df187a…`): lo que cambió fue **de dónde salía** el texto. Una
   corrección invisible en el resultado visible es la más fácil de perder.

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

**Caso del 31-oct-2026 (firma-service): un rojo crónico que nadie abrió.** El test
`firma-service/tests/_adversary-e6e7.test.js` (ADVE6.7) pedía `201` al crear una solicitud y
recibía `422`. El `422` **no venía del `consent_id` que el test medía**: venía del control
`declaracion_datos_sensibles`, que la ruta exige **desde el commit `5534aca7` (📦978)** y que el
test no mandaba. El rojo llevaba **semanas** en la suite y nadie lo notó, porque el conteo siempre
salía "1 rojo" y era el de siempre. Reglas: (1) **un rojo crónico se abre una vez por cambio de
código, no una vez por corrida**: si el número de rojos no se mueve, hay que leer **por qué** falla
ese rojo, no compararlo con la corrida anterior; (2) **el código de error dice la causa**:
`422 DECLARACION_DATOS_SENSIBLES_REQUERIDA` no es "el `consent_id` está mal"; (3) **un test que
lleva semanas en rojo por un control ajeno no está midiendo lo que dice medir**: hay que
actualizarlo; (4) **el arreglo de un rojo viejo es en el test, no en el código**: el código
cumplía el control y el test tenía la expectativa de antes del control.

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

### 7.8 La suite del `firma-service` se corre con el Node de Electron: no hay que recompilar

**Medido el 5-nov-2026.** La trampa 15 dice que `better-sqlite3` no se puede cargar con el Node del
sistema (v26, ABI 147) porque el binding quedó compilado para el runtime de Electron (v22.21.1, ABI
136). Es cierto — y **la salida no es recompilar**: el binario que ya está en el repo sirve tal cual si
se corre la suite **con el Node de Electron**, que es justamente el runtime para el que se compiló.

```powershell
# 1. Las dependencias que faltan en firma-service, SIN compilar nada:
cd sgsst-electron-app/firma-service
npm.cmd install --no-save --no-package-lock --ignore-scripts

# 2. El binding ABI 136 del app Electron, copiado al paquete local:
#    (copiar node_modules/better-sqlite3/build/Release/better_sqlite3.node
#     a firma-service/node_modules/better-sqlite3/build/Release/)

# 3. La suite, con el Node de Electron:
$env:ELECTRON_RUN_AS_NODE = "1"
..\node_modules\electron\dist\electron.exe --test --require ./tests/setup.js `
  --test-concurrency=1 tests/services/agreement.test.js
```

`--ignore-scripts` es lo que hace que `npm install` **no** compile un `better-sqlite3` para el Node 26
(que es lo que rompe el binding de Electron): el paquete queda sin binario y se le copia encima el que
ya está compilado. **Nunca borres ni recompiles** el `node_modules` del app Electron: lo comparte con
la app.

**Medición completa del 5-nov-2026:** **2 096 tests · 2 084 verdes · 0 rojas · 10 canceladas · 2
omitidas.** Las 10 canceladas están todas en `tests/services/pdfValidator.test.js`
(`cancelledByParent`): el test parchea `PDFDocument.load` para que devuelva una promesa que nunca
resuelve, el event loop se queda vacío y el runner cancela el archivo entero. **Es un artefacto del
runner, no un defecto del código** — y se comprobó **contra HEAD limpio**: da exactamente lo mismo.
Cuando veas "canceladas", lo que hay que responder es "¿también pasaba sin mi cambio?", y la respuesta
se mide, no se supone.

**Medición del 5-nov-2026 (tarde, con el Anexo de Nube v1.1):** **2 120 tests · 2 108 verdes ·
0 rojas · 10 canceladas · 2 omitidas** (la línea base de arriba + 24 tests nuevos, sin regresiones).

🚨 **TRAMPA: UNA CORRIDA DE TESTS A LA VEZ. NO DOS.**
Todos los archivos de la suite usan la misma `data/test.sqlite`, y cada test llama a `resetDb()`,
que **borra las filas de todas las tablas**. Si se lanza la suite completa en segundo plano y al
mismo tiempo se corre un archivo suelto, **los dos procesos se borran la base mutuamente** y salen
fallos fantasma: el 5-nov-2026 se midieron 6 fallos en `notify-remote` y 1 en la suscripción del
Anexo de Nube, y al re-correr la suite **en solitario** los dos quedaron en **0**. La señal de que
es interferencia y no un defecto: los fallos caen en archivos que el cambio no toca. **Regla: una
corrida a la vez; si hay que correr dos, la segunda va con otra base** (`DB_PATH`).

**Medición del 6-nov-2026 (tarde, con el manifiesto de la 9A):** **2 166 tests · 2 163 pass · 1 fail
· 2 skipped**. El único rojo es `§6.2: el rechazo ocurre dentro del timeout (no hang)`: el rechazo
ocurre, pero más lento que el timeout del test.

🚨 **TRAMPA (6-nov-2026): LA SUITE COMPLETA TIENE UNA INTERMITENCIA PREEXISTENTE. UN ROJO AISLADO
NO ES REGRESIÓN.**
Los **146 archivos** de test comparten **UN solo `data/test.sqlite`**, y `tests/setup.js` corre
`migrate()` sobre esa base **en cada proceso**. Con eso, cada corrida completa deja **entre 0 y 9
fallos**, y **cambian de archivo en cada corrida**: la misma suite da un rojo en `notify-remote` una
vez y en otro archivo la siguiente. Está en la **trampa 115** del §9.

**Cómo se descarta la regresión (en este orden):**

1. **Corré la suite SIN el archivo nuevo** (o contra `HEAD` limpio): si también falla, no es tuyo.
2. **Corré el archivo que falló AISLADO**: **pasa 100 %**. Un archivo que pasa solo y falla en la
   suite es interferencia, no un defecto de tu cambio.
3. **Compará la LISTA de archivos que fallan entre corridas, no el número**: si cambia de archivo, es
   la intermitencia.

**Y sigue valiendo la regla de arriba: nunca dos procesos de test al tiempo.** Esta es la otra mitad
del mismo problema: la base es una sola y `resetDb()` borra todas las tablas.

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
  UI del 📦903 no abran la base. **Y hay una TERCERA salida, que es la que se usó el 5-nov-2026: no
  recompilar nada y correr la suite con el Node de Electron.** `ELECTRON_RUN_AS_NODE=1 electron.exe`
  ejecuta con el runtime ABI 136 — justo contra el que quedó compilado el binding — y ahí la suite
  corre completa. La receta exacta está en §7.8. Medido ese día: **2 096 tests · 2 084 verdes · 0
  rojas · 10 canceladas · 2 omitidas**; las 10 canceladas son de `pdfValidator.test.js`
  (`cancelledByParent`) y son **preexistentes**: se reprodujeron igual contra HEAD, sin el cambio |
| 16 | 🔴 **`CONTEXT.md` tiene separadores de línea **CR CR CR LF** (tres CR), no CRLF.** 1337 de sus 1354 líneas. Viene así del repo, no es de una edición | `CONTEXT.md` (todo el archivo) | **Nunca lo abras con `Edit` ni lo reescribas con `ReadAllText`/`WriteAllText`**: un CRLF "correcto" en el medio de eso rompe el diff entero. Si hay que tocarlo, buscar el ancla con una regex que tolere `\r*\n` y **armar el texto nuevo con el separador que ya usa el archivo**, verificado leyendo los bytes del ancla. **Ojo:** ese conteo es del 27-oct-2026 y el archivo tiene **tres** tipos de separador a la vez: la trampa 104 dice cual usa cada region |
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
| 69 | 🔴 **Un check que mira un token que la PROPIA operación ya invalidó es una FALLA por el motivo equivocado: el servicio puede estar perfecto** | `firma-service/scripts/smoke-produccion.js` (pasos 5b y 5c), `src/services/signRequest.js` (`notifyRemote`, `MAX_TOKENS_VIGENTES`) | El 3.4(c) es "cada reemisión se registra y deja sin efecto el token anterior" (un solo token vigente por solicitud). El smoke creaba la solicitud (token A), mandaba `notify-remote` **sin** token → el servicio emitía el token B y el A quedaba muerto → el 5c abría el token A y recibía 404 `TOKEN_NOT_FOUND`. El correo llevaba el enlace B, que sí servía: el 5c no comprobaba el enlace del firmante, comprobaba un enlace que el propio script había invalidado. La válvula ya existía y funcionaba: `notify-remote` acepta `token` en el body y lo reutiliza sin rotar (`tokenPerteneceA` lo verifica contra esa solicitud). **Antes de declarar "fallo del despliegue", comprobá que la cosa que el check mira siga siendo la cosa que el servicio produjo** |
| 70 | 🔴 **Borrar una fila y dejar sus filas hijas huérfanas NO es limpiar el rastro: es cambiar de rastro** | `firma-service/scripts/limpiar-rastro-prueba.js` (`aplicar`), `src/db/schema/023_conservacion.sql` | El script borraba tokens, eventos, sesiones y lotes, pero **no** `gh_firma_holds` (el historial de los declares de conservación, que cuelga por `firma_id`): al borrar la firma, el hold quedaba en la base apuntando a una fila que ya no existía. Las tablas que cuelgan de una fila hay que **enumerarlas del ESQUEMA** (`grep -n "firma_id INTEGER" src/db/schema/*.sql`), no de memoria: son `gh_firma_eventos`, `gh_firma_sesiones`, `gh_firma_purga_lote`, `gh_firma_tokens`, `gh_firma_holds`, `gh_firma_firmas_papel` y `gh_firma_purgadas` (esta última es la lápida: append-only, **no** se borra) |
| 71 | 🔴 **Una guarda de dominio y una herramienta de desarrollo se chocan: la salida NO es relajar la guarda, es una salida ANGOSTA con una condición COMPROBABLE — y que se pueda CERRAR** | `firma-service/scripts/seed-dev-acuerdo.js`, `src/services/agreement.js` (la guarda), `src/utils/textoLegal.js` | La guarda de publicación rechaza los textos con marcas de borrador ("ACUERDO DEV") en toda versión posterior a la v1.0; el seed DEV siembra un texto con esas marcas **a propósito**, para que nadie lo confunda con el texto legal. Las dos tienen razón: la guarda protege el camino legal, el seed siembra un texto que no es legal. La salida que se implementó: el seed escribe la fila él mismo (mismo hash, misma transición atómica) **solo si** (1) el ambiente no es producción y (2) **TODA versión de la base es una semilla DEV** (`metadata.dev_seed = true`). Si esa base tiene un Acuerdo legal publicado, la condición no se cumple, **no hay salida** y el seed sale con código 1. Reglas: (1) **no se relaja la guarda**: el camino legal sigue tirando `TEXTO_LEGAL_CON_PLACEHOLDERS`, y hay un test que lo comprueba; (2) la condición de la salida se comprueba **contra las filas**, no contra una suposición (nombre de archivo, ruta, tipo de base); (3) **una salida que solo se puede abrir no es una salida**: tiene que poder cerrarse, y por eso hay un test que mete una versión legal en la base y verifica que el seed se niegue; (4) el `main()` de un script devuelve un **código de salida**, no una excepción: un `AppError` que se escapa rompe a quien lo llama |
| 72 | 🔴 **Un reporte de readiness que RELLENA lo que falta con un valor plausible es peor que no tener reporte; y el endpoint y el CLI tienen que ser el MISMO servicio, no dos listas de requisitos** | `firma-service/src/services/readinessLegal.js`, `firma-service/legal-readiness.json`, `firma-service/scripts/auditar-readiness-legal.js`, `src/routes/admin.js` | `legal-readiness.json` es un inventario de **evidencias**: cada campo se llena solo con fecha, archivo o huella, y **todo lo que no tiene evidencia queda en `null`**. Un `null` es un pendiente con nombre, no un olvido. El reporte (`readinessLegal.evaluar`) cruza ese manifiesto, los documentos reales del repo, el código y la base, y devuelve los items con su estado (`ok`/`pendiente`/`aviso`/`no_aplica`), su `detalle` y la `accion` que lo resolvería; **no escribe en la base**, no publica y no firma. Reglas: (1) el endpoint admin (`GET /internal/admin/readiness-legal`) y el CLI **importan el mismo servicio**: dos copias de la lista de requisitos se desactualizan solas, y un reporte que dice "listo" cuando dejó de estarlo es peor que no tener reporte; (2) el dato faltante se dice **pendiente con su acción**, nunca se rellena con un ejemplo; (3) el reporte se contrasta contra el código antes de documentarlo en `API.md` — la forma del JSON se copió de la salida real, no de memoria |
| 73 | 🔴 **La EXPLICACIÓN de por qué pasó algo en producción tiene que ser comprobable contra el dato de producción: no contra la hipótesis que armaste leyendo el código** | `firma-service/src/services/retencion.js` (`planificar`), `firma-service/src/services/signRequest.js`, `firma-service/scripts/limpiar-rastro-prueba.js` | Caso real (24-oct-2026): se explicó que el hold de la fila de prueba venía de la ficha de la Empresa (`conservacion_por_deber_legal = 1`). El panel del servidor mostró **`0`**: la ficha no levanta ningún hold. El origen real era la **regla de retención**: `tipo_identificacion: 'OTROSI'` → categoría `CONTRATO_TRABAJO` → regla `CONTRATO_ELECTRONICO`, que lleva el hold **sin término** del 2.2.1.1.12. La explicación anterior era plausible y falsa. Reglas: (1) cuando se explica un comportamiento de producción, **los flags que intervienen se leen del servidor**, no se deducen del código; (2) un `0` y un `1` no son intercambiables: antes de afirmar que una bandera estaba activa, **léela**; (3) cuando hay varios caminos que producen el mismo efecto (el hold puede venir de la ficha o de la regla), **los dos se mencionan**; (4) si la explicación queda registrada en la documentación, se corrige: un documento que afirma una causa falsa es peor que uno que no menciona la causa |
| 74 | 🔴 **Una excepción a una guarda tiene que ser de contenido EXACTO, y el que la aplica y el que la reporta tienen que ser el MISMO código: una copia del patrón se desincroniza y el check miente** | `firma-service/src/utils/textoLegal.js` (`PLACEHOLDERS_DEL_SISTEMA`, `esPlaceholderDelSistema`), `scripts/empalmar-acuerdo-v1.1.js`, `src/services/readinessLegal.js`, `src/services/agreement.js` | La guarda de publicación rechazaba la v1.1 por los cuatro `[registrada por el sistema]` del bloque de Manifestación de Voluntad: el texto legal **ya publicado** (la v1.0, viva en producción) los usa, y los llena el sistema al firmar. El texto legal manda sobre el código, no al revés: la salida fue que el módulo compartido reconozca ese campo del sistema y **solo ese** (coincidencia exacta de contenido: `[registrada por la empresa]` o `[registrada por el sistema más adelante]` siguen siendo huecos y bloquean; hay tests para esas variantes). Reglas: (1) la excepción vive en **un solo archivo**, y los consumidores **importan** la regla: el empalme tenía su propia copia del `RE_PLACEHOLDER`, y con solo arreglar el módulo el script salía con código 0 mientras su reporte seguía diciendo "9 placeholders" — un check que no muerde; (2) el conteo se separa en **huecos** (bloquean) y **campos del sistema** (no bloquean, pero **se listan**: nada queda escondido) en todos los consumidores, y el que decide es `huecos`, no `total`; (3) una excepción de guarda se escribe con su **prueba de que sigue bloqueando**: si el detector acepta `[registrada por la empresa]`, la excepción no es de contenido exacto y es un agujero |
| 76 | 🔴 **El texto del abogado y los datos del owner van en archivos SEPARADOS, y el texto armado no se commitea hasta que lo apruebe quien lo aprueba** | `firma-service/scripts/fixtures/acuerdo-v1.1-cambios.json` (texto del abogado), `scripts/fixtures/acuerdo-v1.1-datos.json` (datos del owner), `scripts/empalmar-acuerdo-v1.1.js` (`sustituirDatos`), `firma-service/.gitignore` | El mapa de cambios tiene una garantía escrita y probada: **cada texto aparece LITERAL en el `.txt` de la respuesta 11A**. Rellenar ahí los datos del owner (la URL, la ciudad, el canal) la habría roto, y además el mapa quedaría con texto que el abogado nunca escribió. Reglas: (1) los datos van en **otro archivo**, y el empalme los sustituye con las mismas reglas estrictas del sello: cada placeholder tiene que aparecer **exactamente una vez**, el valor no puede traer corchetes, y al final no puede quedar ningún hueco; (2) el texto que sale del empalme es **la versión que se firma**, así que no se commitea antes de la aprobación: va en `.gitignore` y sale de ahí solo cuando quien aprueba lo aprueba, y ese momento queda visible en el diff; (3) el `.gitignore` no es un truco: es la frontera entre "armado" y "publicado"; un archivo ignorado que aparece en un commit es una señal de que alguien se saltó la aprobación |
| 75 | 🔴 **Un texto que nombra su versión en más de un lugar tiene que sellarse en TODOS, y el sello tiene que morder: si no hay exactamente una mención de cada lado, el script se niega** | `firma-service/scripts/empalmar-acuerdo-v1.1.js` (`sellarVersion`), `src/services/readinessLegal.js` (`analizarAcuerdo`) | El Acuerdo nombra su versión en DOS lugares: el encabezado ("Versión del Acuerdo: vX") y el bloque de Manifestación de Voluntad ("...K+AIR, versión vX..."). El empalme armaba la v1.1 cambiando numerales y dejaba los dos diciendo "v1.0": **con los cinco datos del abogado puestos, la v1.1 tampoco se publicaba**, porque el readiness exigía `Versión del Acuerdo: v1.1`. El check ya existía y mordía: lo que faltaba era **correr la cadena completa** (empalme → guarda → readiness), no las partes por separado. Reglas: (1) el sello de versión **no va en el mapa de cambios** (ese mapa es el texto del abogado, copiado íntegro): es una propiedad de la versión, y lo aplica el script tomándola del campo `version` del JSON; (2) el sello se niega a seguir si no encuentra **exactamente una** mención de cada lado, o si las dos no dicen la misma versión: un sello a ciegas es peor que no sellar; (3) **después** de sellar se vuelve a verificar, porque un sello mal escrito (una "v" de más) produce un texto que miente; (4) cuando varios checks se encadenan, el del final **también se ejecuta**: el de la versión estaba escrito desde el 📦941 y nadie lo había corrido contra el texto entero |
| 77 | 🔴 **Un check tiene que mirar el artefacto que se FIRMA, no el marcado: y una cláusula que se exige en un documento que nunca se firma hace que el check no pueda pasar nunca** | `firma-service/src/services/readinessLegal.js` (`_textoRenderizado`, `analizarAnexoNube`, `RE_AVISO_NO_FIRMAR`), `src/utils/textoLegal.js` (`MARCADORES_PROHIBIDOS`), `tests/readiness-documentos-html.test.js` | Caso real (24-oct-2026): el Anexo de Nube reportaba **6 cláusulas faltantes** y **cuatro el documento SÍ las tenía**. El check corría sobre el HTML crudo y los anexos están escritos con entidades: `"dos (2) d&iacute;as h&aacute;biles"` no matchea `/dos\s*\(2\)\s*días\s+hábiles/`. No era que faltara la cláusula: era que el check miraba el marcado y no el texto. El segundo bug era peor: el aviso "NO FIRMAR HASTA COMPLETAR LOS DATOS" estaba como cláusula **requerida** y ninguna marca lo reconocía, así que un documento que decía "no firmar" podía quedar `ok: true` (un check que no muerde en la dirección peligrosa) y, a la vez, como el requisito era permanente, el ítem `documento_nube` bloqueaba la primera firma **para siempre** (el archivo del repo es el modelo y siempre tiene huecos). Reglas: (1) el texto que se firma es el **renderizado**: las cláusulas, los corchetes y los marcadores se leen sobre el texto sin etiquetas y con las entidades resueltas, y **el hash sigue siendo el del archivo, byte a byte** (la huella identifica el documento, no su marcado); (2) **una cláusula exigida y un marcador que bloquea tienen que ser la MISMA frase y la MISMA fuente**: el patrón vive una vez en el módulo legal y el readiness lo pide con `reDeMarcador()`, nunca con una copia del regex (la trampa 74); (3) una cláusula que el documento que se firma **no puede llevar** no puede ser requisito permanente: el aviso de "no firmar" es del MODELO, y la regla coherente en los dos sentidos es "con datos pendientes tiene que advertir; sin datos pendientes no puede llevar el aviso"; (4) un check que nunca puede pasar es un check que no muerde: si un ítem bloquea la primera firma y solo se puede encender con un documento imposible, el problema es del requisito, no del documento |
| 79 | 🔴 **Una URL sellada tiene que apuntar al documento que está en el sitio, y el documento que se firma tiene que ser el del servicio que se firma: el mismo nombre puede ser de dos productos** | `firma-service/src/services/readinessLegal.js` (`REQUERIDOS_ENCARGO`, `url_politica`), `legal/anexo-encargo.html`, `legal/politica-firma.html`, `sitio/` | Caso real (24-oct-2026): el `url_politica` del manifiesto se iba a llenar con `https://kair.fyi/privacidad.html`, que era la decisión escrita. Al leer esa página resultó que es la política de la **app de escritorio** (conectar la cuenta de Google, tokens en el equipo del usuario): el Acuerdo de la nube habría remitido a un documento que no describe ese servicio. Y el `url_anexo_encargo` iba a apuntar a un Anexo que describía una base de datos local en los equipos del cliente. Reglas: (1) **sellar una URL es una afirmación**: antes de declararla se verifica por HTTP que responde y que **sirve el documento que es**, no solo que responde; (2) **una URL declarada tiene que estar atada al archivo**: un test comprueba que el archivo existe en el directorio que se publica, porque una URL que no sirve el documento es peor que no declararla; (3) **el mismo nombre puede ser de dos productos**: la política de la app y la del servicio de firma son dos documentos distintos, y cada una dice cuál es; (4) cuando el texto aprobado remite a un documento, se lee **quién** lo remite: el 1.2 y el 10.7 del Acuerdo remiten a la política de la **Empresa** (la Responsable), no a la del Encargado, y el check decía lo contrario; (5) un check que exige una cláusula que el documento final no lleva (el otrosí, cuando la decisión es el reemplazo) tiene que aceptar **las dos redacciones**: un requisito que no puede satisfacerse no es un requisito |
| 78 | 🔴 **Un check que busca un nombre de tabla lo contrasta con el SQL de la migración, no con la convención de los nombres vecinos** | `firma-service/src/services/readinessLegal.js` (`_tablaExiste`), `src/db/schema/028_solicitudes_titular.sql` | Caso real (24-oct-2026): el readiness buscaba `gh_firma_solicitudes_titular` y la 028 crea `gh_solicitudes_titular`, **sin el prefijo `firma_`** (esa tabla no cuelga de ninguna firma, y por eso la 5B no la alcanza: el nombre distinto es a propósito). El check no podía pasar nunca, y su acción pedía "aplicar las migraciones 028/029" mientras el journal de ese mismo arranque decía que **ya estaban aplicadas**: un pendiente que manda al operador a hacer algo inútil y que bloquea los dos gates. Reglas: (1) un pendiente de esquema no es un dato faltante: es un nombre que **el código busca y la base no tiene**; antes de reportarlo se lee el `CREATE TABLE` de la migración y se contrasta el nombre; (2) **los nombres de tabla no son una convención uniforme**: la 028 existe justamente para llevar un nombre distinto, y copiar el prefijo del vecino es inventarse una tabla que ninguna migración crea; (3) el test que fija esto aplica el **SQL real** de la migración en una base de prueba, no una copia a mano del `CREATE TABLE`: si alguien renombra la tabla en la 028, el test se rompe y avisa; (4) un check que nunca puede pasar es un check que no muerde, y su acción tiene que decir lo que **falta**, no lo que ya se hizo: la huella de la v1.1 ya estaba en el manifiesto, y la acción pedía registrarla otra vez |
| 80 | 🔴 **Un requisito que la ley no impone es un bloqueo falso: cuando la norma pide designar y el check pide un acta, hay que verificar la fuente oficial antes de exigir el acta** | `firma-service/src/services/readinessLegal.js` (item `responsable_datos`), `legal-readiness.json` (`encargado.responsable_datos`), `legal/anexo-encargo.html`, `legal/politica-firma.html`, `tests/readiness-legal.test.js` | Caso real (24-oct-2026): el readiness exigía **el acta de designación** para dar por designada la persona o área responsable de la protección de datos, y ese pendiente bloqueaba la primera firma. La norma que se citaba (art. 2.2.2.25.4.4 del Decreto 1074 de 2015, que reproduce el art. 23 del Decreto 1377 de 2013) exige **designar una persona o área**, y nada más: la SIC ha precisado que la Ley 1581 y sus normas reglamentarias "no establecen un procedimiento específico para la designación, ni determinan una profesión, tipo de vinculación o dependencia particular" (Resolución 384 de 2026, Secretaría Jurídica Distrital, que cita a la SIC). El acta era la condición que le pidió el abogado al owner, y el **texto final** del 10.7(b) solo dice "designa una persona o área" y "la persona o área responsable es [nombre o cargo]". Reglas: (1) **un check exige lo que la ley exige y nada más**: un requisito que la norma no impone es un pendiente que no se puede cerrar sin un documento que nadie tiene por qué tener; (2) la **fuente oficial** se lee antes de exigir: aquí la Resolución 384 de 2026 (que cita a la SIC) es la que dice que no hay procedimiento, y sin ese dato el "acta" parecía razonable; (3) **el texto aprobado manda sobre el encargo**: si el 10.7(b) final no pide acta, el acta no es requisito aunque alguien la pidiera en el Exchange; (4) la forma de documentar la designación la define la organización y tiene que ser **verificable por un tercero**: aquí es la declaración pública en el Anexo de Encargo y en la política, no un documento interno; (5) un check que se afloja necesita **prueba de que sigue bloqueando lo que sí debe**: el test afirma que sin designación el item queda pendiente, y se comprueba con mutación (reintroducir el acta en el código y en el manifiesto hace fallar los tests) |
| 81 | 🔴 **Un dato de contacto que el sistema declara es una afirmación pública: tiene que estar en el documento que se publica, y un test ata el valor al archivo** | `firma-service/legal-readiness.json` (`encargado.representante_legal`, `encargado.responsable_datos`, `pqrs.canal`, `pqrs.responsable`), `tests/readiness-legal.test.js`, `legal/anexo-encargo.html`, `legal/politica-firma.html`, `sitio/` | Caso real (24-oct-2026): con el nombre del representante legal y el canal de PQRS confirmados por el owner, el manifiesto los declaraba pero los documentos seguían diciendo "el Representante Legal de Gesstiar S.A.S." (el cargo, sin nombre) y el canal de PQRS no aparecía en ningún documento publicado: el dato existía, el titular no lo podía ver ni verificar. Reglas: (1) un campo del manifiesto que es un **dato de contacto o de identificación** es una afirmación sobre lo que el titular puede usar: si el JSON lo declara y el documento no lo publica, hay dos verdades; (2) **"canal único" solo es verificable si está publicado**: se declara en el manifiesto **y** se imprime en los documentos que se sirven, y un test comprueba que el valor del manifiesto aparece en esos archivos; (3) **el mismo nombre puede ser de dos cosas**: `asepluscaribesas@gmail.com` es el correo de ASEPLUS (remisiones médicas, `Portear/`) y no un canal de PQRS de K+AIR; antes de declarar un canal hay que confirmar a qué producto pertenece, porque un canal "único" que en realidad son dos es peor que ninguno; (4) un dato nuevo del owner se propaga a **todos** los lugares donde ya estaba el dato viejo (el manifiesto, los documentos de `legal/` y de `sitio/`, y los dos árboles tienen que quedar idénticos byte a byte); (5) cuando el dato ya está en el texto que se firma, el cambio obliga a **re-empalmar y re-sellar la huella**: el texto firmado y su hash van juntos, y eso se avisa en vez de tocarlo a mano |
| 82 | 🔴 **Un check que exige un documento que la arquitectura no puede producir es un bloqueo permanente: primero se decide QUÉ ES el archivo y después se mide** | `firma-service/src/services/readinessLegal.js` (`analizarAnexoNube`, item `documento_nube`), `firma-service/src/utils/textoLegal.js` (`PLACEHOLDERS_DE_LA_EMPRESA`), `legal/anexo-nube-v1.0.html` | Caso real (25-oct-2026): el Anexo de Nube del repo es el **modelo** que cada Empresa diligencia con sus datos y firma (lo dice el texto del abogado: "este documento es un modelo… se diligencia por cada Empresa"). El check pedía "sin placeholders" —cero corchetes— y la acción le pedía al operador "quitar todos los corchetes": pero los tres campos de la parte responsable (nombre, NIT y representante legal de la Empresa) **cambian en cada copia** y no se pueden diligenciar en el repo. El pendiente era imposible de cerrar y bloqueaba el primer gate para siempre. Reglas: (1) **antes de medir un documento hay que decidir qué es** (modelo, plantilla o documento final) y esa decisión tiene que estar apoyada en el texto que lo redacto y en la arquitectura, no en una preferencia; (2) un documento que **cambia en cada copia** tiene campos que otro diligencia: esos campos son una **tercera clase** de placeholder —ni huecos que bloqueen, ni campos del sistema— y la excepción es de **contenido exacto** (`NIT de la Empresa` sí; `NIT de la Empresa cliente` no) para que no se abra un agujero; (3) la excepción la aplica **un solo consumidor** (el Anexo de Nube), no el modulo legal entero: el modulo declara la clase, el consumidor decide donde; (4) el analisis distingue **"listo para firmarse tal cual"** de **"listo como modelo"**: el aviso de "no firmar" es parte de un modelo y no lo penaliza, y lo que no puede es que le falten datos; (5) **el detalle del pendiente dice QUÉ falta y DE QUIEN**, no "quite todos los corchetes": un pendiente imposible no es un pendiente, es un bug; y (6) el mismo applies a los datos: un campo del manifiesto que **nadie lee** (la seguridad fisica estaba declarada y ningun check la miraba) es un dato que no protege nada |
| 83 | 🔴 **Un check que lee un archivo que el paquete de despliegue no lleva lee el vacío: un vacío con forma de pendiente es peor que un error** | `firma-service/src/services/readinessLegal.js` (`REPO_ROOT`, `RUTAS_DEFAULT`), `firma-service/scripts/auditar-readiness-legal.js`, `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` | Caso real (26-oct-2026): el `git archive` del despliegue metía solo el service (`src`, `web`, `scripts`, `package.json`, `package-lock.json`, `legal-readiness.json`), pero el readiness lee el Anexo de Nube y el Anexo de Encargo en `REPO_ROOT/legal/` —**un nivel arriba** del directorio del service—, que en el servidor es `/opt/kair-firma/legal/`: hermano de `app/`, no hijo. Ese directorio nunca existió allá, así que el servidor leía un documento inexistente y reportaba *"Faltan cláusulas: Remisión al Anexo de Nube; Sustitución del Anexo anterior o cláusula de otrosí; Art. 2.2.4.6.13; Veinte (20) años; Servicio en nube / firma-service"* — cinco cláusulas que **no faltaban**. Reglas: (1) **el paquete se arma contra las rutas que el código lee**, no contra las que el código tiene: `git archive` con rutas relativas al service no puede llegar a `../legal`, y la forma del paquete tiene que seguir a `REPO_ROOT` y `SERVICE_ROOT` (`app/` y `legal/`, hermanos); (2) **un check no puede distinguir "el documento no tiene esta cláusula" de "el documento no llegó"**, y el que lee el reporte se lleva una conclusión falsa sobre un documento que sí existe: el detalle tiene que decir **"el documento no está disponible"** y no fingir un hueco de contenido; (3) **la forma del paquete y el comando de extracción son la misma cosa**: con el comando viejo, el tar nuevo deja el código viejo en su sitio, el servicio arranca con él y el despliegue es un **no-op silencioso** — el `sha256sum` de los archivos en disco es lo único que distingue "desplegué" de "no pasó nada"; (4) **la simulación del servidor es una prueba que se puede hacer en el PC**: extraer el tar a una ruta con la forma `/opt/kair-firma` y correr el readiness con el mismo `.env` y la misma base; (5) **un dato del owner puede topar un check**: con una cuenta de Google de consumidor, `devolucion_supresion` y `auditoria` exigen los dos subencargados (`cf && gg`) y no pueden quedar `ok` nunca, así que el check tiene que contar a Google solo cuando sí es subencargado |
| 84 | 🔴 **Un check que le exige un contrato a quien no es parte del contrato es un bloqueo permanente: primero se pregunta QUIÉN es subencargado, no qué cláusulas tiene** | `firma-service/src/services/readinessLegal.js` (`googleOk`, `devolucionOk`, `auditoriaOk`), `firma-service/legal-readiness.json` (`subencargados.google.cuenta`) | Caso real (26-oct-2026): el dato del servidor (`SMTP_USER=adminkair@gmail.com`) dijo que la cuenta de Google es de **consumo**. El check exigía la devolución y la auditoría de los **dos** subencargados (`cf && gg`), y `ggOk` solo era verdadero con cuenta Workspace/Cloud: con una cuenta de consumidor, `google_dpa`, `devolucion_supresion` y `auditoria` **no podían quedar `ok` nunca**, y el gate no abría por más que el owner llenara todo lo demás. El item hasta explicaba la razón correcta (Google no es subencargado; el envío es transferencia internacional, art. 26 de la Ley 1581) y se quedaba pendiente igual, porque el estado salía del AND. Reglas: (1) **la pregunta es "¿quién es subencargado?", no "¿qué cláusulas tiene?"**: una cuenta de consumo no tiene DPA que exigirle, y pedirle uno es pedir algo que no existe; (2) **un AND de varios exige que varios sean**: si el requisito es "de cada subencargado" y solo hay uno, se resuelve con el que existe — la condición tiene que mirar **quiénes** son subencargados, no una lista fija de dos; (3) **un pendiente que explica la razón correcta y aun así no se puede cerrar es un bug, no un dato faltante**: el detalle y el estado tienen que ir juntos; (4) **declarar un dato abre o cierra salidas, y el check tiene que tener más de una**: con un solo camino, cualquier dato distinto al esperado bloquea para siempre; (5) **lo que el dato abre no es lo mismo que lo que la ley exige**: una transferencia internacional tiene su propio requisito (autorización expresa o excepción del art. 26), no un DPA |
| 85 | 🔴 **Un check que valida el estado del contrato, no el estado de la parte: "el proveedor tiene DPA" y "el contrato permite usar al proveedor" son dos preguntas distintas** | `firma-service/src/services/readinessLegal.js` (`googleOk`, `ggOk`), `sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.1.txt` (10.1 y 10.5(f)), `sgsst-electron-app/legal/anexo-nube-v1.0.html` | Caso real (26-oct-2026): el dato del servidor dijo que la cuenta de Google es de consumo. El 📦956 abrió una "segunda salida" que dejaba el item `google_dpa` en ok, y eso era **un verde falso**: el Acuerdo (10.1 y 10.5(f)) condiciona el papel de subencargado al vínculo por contrato o DPA y **prohíbe transmitir datos personales a un proveedor no vinculado**, así que con esa cuenta el servicio no puede enviar el OTP. Un check que dice "no hay DPA que exigirle a quien no es subencargado" está bien; uno que dice "no hay DPA, no hay nada que hacer" miente, porque la pregunta correcta no era "¿tiene clauses?" sino **"¿el contrato permite usarlo?"**. Reglas: (1) **un bloque permanente tiene que venir con el motivo y la salida**: un pendiente que no dice cómo se resuelve es una pared, no un check; (2) **"no le aplica" y "no importa" no son lo mismo**: lo que no le aplica a un proveedor (un DPA) puede ser lo que lo impide usar (transmitirle datos); (3) **el check tiene que leer el contrato, no solo el manifiesto**: si el Acuerdo condiciona algo, esa condición es parte del estado; (4) **un documento que declara una parte como Responsable y otro que dice que no es subencargado no pueden ser el mismo documento**: la caracterización legal tiene que ser una sola en todo el texto; (5) **quitar una marca que bloquea exige la razón que la quitaba**: un aviso de "revisión profesional pendiente" se quita cuando un abogado lo aprueba, no porque otro agente reescribiera el documento |
| 86 | 🔴 **Un instrumento que declara el estado no puede declarar el estado que uno quiere: el manifiesto se llena con evidencia, no con intención** | `firma-service/legal-readiness.json` (la nota del propio manifiesto: "Cada campo se completa solo con evidencia verificable; no se rellena con valores de ejemplo"), `firma-service/src/services/readinessLegal.js` (`_proveedorOk`, `_nitValido`) | Caso real (26-oct-2026): el owner decidió migrar el correo a una cuenta Google Workspace/Cloud con DPA. Declarar `subencargados.google.cuenta = "workspace"` en el manifiesto **antes de que la cuenta exista** habría sido rellenar un campo con una intención: el check leería "workspace" y daría el DPA por verificado, cuando el servidor sigue enviando por `adminkair@gmail.com`. Lo correcto: el manifiesto declara lo que el servicio **hace hoy** (`"consumidor"`, evidenciado por el SMTP_USER del servidor) y el **modelo** —que describe el servicio como va a quedar cuando se firme— declara el camino decidido. Reglas: (1) **el manifiesto es un instrumento de medición, no un formulario de intención**: si se llena con lo que uno quiere que sea, el check deja de medir y empieza a mentir; (2) **la decisión se escribe donde sí es una declaración** —el tablero, el modelo, el contrato— y el instrumento espera la evidencia; (3) **el modelo y el manifiesto tienen cronologías distintas**: el modelo describe el servicio firmado y el manifiesto el servicio en marcha, y el gate no abre hasta que coinciden; (4) **un campo que el check no sabe leer es un campo que no protege**: `_nitValido` solo miraba que el NIT tuviera entre 8 y 12 dígitos, y por eso un dígito de verificación inválido pasó 17 comprobaciones en silencio; (5) **un dato aritmético se verifica, no se hereda**: el dígito de verificación del NIT se calculó con el algoritmo de la DIAN y se contrastó con tres ejemplos publicados |
| 87 | 🔴 **Un RTO sin deteccion de caidas es una promesa sin evidencia: el tiempo de recuperacion se cuenta desde que alguien se entera** | `firma-service/deploy/health-check.sh`, `firma-service/deploy/backup-firma.sh`, `firma-service/deploy/probar-restauracion.sh`, `firma-service/src/services/readinessLegal.js` (item `rto_rpo`), `firma-service/legal-readiness.json` |
| 88 | 🔴 **La hora del servidor es parte de la promesa: un cron escrito en "las 22:00" y un plazo en dias habiles usan la zona horaria de la maquina, no la del papel** | `firma-service/src/services/solicitudes.js` (`_sumarDiasHabiles`), `firma-service/src/services/pdfGen.js` (`fmtFechaHora`), `firma-service/deploy/backup-firma.sh`, `firma-service/deploy/kair-firma.service` |
Caso real (26-oct-2026): el servidor de produccion corria en **`Etc/UTC`**, no en hora de Colombia, y nadie lo habia medido porque `timedatectl` no estaba en el runbook. Tres consecuencias, todas silenciosas: (1) el cron del respaldo diario "de las 22:00" disparaba a las **17:00 de Colombia**, asi que la frase del Anexo de Nube era falsa; (2) los plazos de **dos (2) y cinco (5) dias habiles** —el de PQRS y el de la copia permanente— se contaban con el **dia UTC** (`getDay()`): una solicitud del viernes a las nueve de la noche en Colombia es "sabado" en UTC y el plazo vencia antes; (3) la **constancia PDF** imprimia la hora de UTC, cinco horas corrida. El codigo no era el culpable: `solicitudes.js:144` dice que el dia es **local** y `pdfGen.js:123` dice "hora local del servidor"; lo que estaba mal puesto era el servidor. Reglas: (1) **la zona horaria del servidor es un dato del despliegue, no un detalle del sistema**: se mide con `timedatectl` y se deja escrito en el runbook; (2) **cualquier hora que un documento declare tiene que decir en que zona**: "22:00" sin zona es una promise ambigua; (3) **un plazo en dias habiles se cuenta en el calendario de quien tiene el plazo**, no en el del servidor; (4) **cambiar la zona horaria se reinicia el servicio**: Node lee la zona al arrancar, y un cambio sin reinicio deja el proceso con la zona vieja; (5) **cambiar la zona no cambia los datos**: la base guarda ISO en UTC y las comparaciones son por instante, asi que lo unico que se mueve es lo que ya decia ser local |
| 89 | 🔴 **Un documento que describe como funcionaba el servicio se vuelve falso SOLO, sin que nadie lo toque: hay que releyerlo cuando cambia la operacion** | `sgsst-electron-app/legal/anexo-nube-v1.0.html` (§3 Respaldos), `sgsst-electron-app/firma-service/legal-readiness.json` |
| 90 | 🔴 **Cerrar la excepcion NO es lo mismo que agotarla: el commit de una firma ya abierta necesita la excepcion TODAVIA vigente** | `firma-service/src/services/excepcionHabilitacion.js` (`vigentePara`), `firma-service/src/services/publicFlow.js` (punto `commit`), `firma-service/src/services/consent.js` (`creacion_consentimiento`), `firma-service/src/services/signRequest.js` (puntos `creacion_solicitud` y `doble_firma`) |
| 91 | 🔴 **Un lote de comandos que ABRE un instrumento legal y lo CIERRA, sin el paso humano en el medio, produce un registro falso que no se puede arreglar despues** | `firma-service/src/routes/admin-excepciones.js` (`POST /excepciones-habilitacion/:id/cerrar`), `firma-service/src/services/excepcionHabilitacion.js` (bitacora append-only), `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` |
| 92 | 🔴 **El error de schema del servidor describe la FORMA del dato, no la CAUSA: la herramienta que pide datos al operador los valida antes de llamar y dice que falta** | `firma-service/scripts/smoke-produccion.js` (`validarArgumentos`), `firma-service/src/routes/public.js` (`identifyBody`), `firma-service/web/firma/app.js` (el input que borra lo que no es digito) |
| 93 | 🔴 **Un e2e que crea la solicitud pero no llega al commit NO prueba que la firma se pueda hacer: cada objeto que el firmante tiene que aceptar tiene que existir ANTES del enlace** | `firma-service/scripts/smoke-produccion.js` (`crearConsentimiento`), `firma-service/src/services/publicFlow.js` (`consentAccept`), `firma-service/src/routes/public.js` (`identifyBody`), `firma-service/web/firma/app.js` (el mensaje de `CONSENT_REQUIRED`) |
| 94 | 🔴 **El alcance de firmas se gasta al ABRIR la firma, no al firmarla: una solicitud que se abre y no se puede completar consume alcance igual, y ese alcance no vuelve** | `firma-service/src/services/excepcionHabilitacion.js` (`vigentePara`, `para_firma`), `firma-service/src/services/signRequest.js` (`creacion_solicitud`), `firma-service/src/services/publicFlow.js` (`commit`), `firma-service/src/services/empresa.js` (`assertHabilitadaParaFirma`) |
| 95 | 🔴 **Al abogado se le manda un documento CON hash: la respuesta va a venir contra ese texto, y sin hash nadie puede probar cuál era** | `sgsst-electron-app/docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-26.md`, `sgsst-electron-app/legal/anexo-encargo.html`, `sgsst-electron-app/legal/anexo-nube-v1.0.html`, `firma-service/legal-readiness.json` (`acuerdo.v1_1_hash`) |
| 96 | 🔴 **La evidencia de un control dice DÓNDE se probó cada parte: la suite que pasa no es el servidor que corre** | `firma-service/legal-readiness.json` (`d03.evidencia`), `firma-service/tests/excepcion-habilitacion.test.js`, `firma-service/src/services/readinessLegal.js` |
| 97 | 🔴 **Un test que solo pasa dentro de la suite completa esconde un problema de aislamiento: el que lo corre suelto ve un error que no existe** | `firma-service/tests/readiness-anexo-empresas.test.js`, `firma-service/tests/readiness-legal.test.js` |
| 98 | 🔴 **El tablero dice el estado Y las cifras: un tablero que dice "cerrado" con el hash de la versión anterior es un tablero que miente** | `Historial.md` (el tablero de los 15 puntos), `sgsst-electron-app/firma-service/legal-readiness.json`, `sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.1.txt` |
| 99 | 🔴 **Un documento legal describe el servicio: se vuelve falso SOLO, sin que nadie lo toque. Alinearlo no es reescribirlo, es cambiar lo que el sistema hace y lo que el texto dice** | `sgsst-electron-app/legal/anexo-nube-v1.0.html` (§3 Infraestructura, §5 Seguridad), `sgsst-electron-app/legal/anexo-encargo.html` (§5), `sgsst-electron-app/firma-service/src/services/mailer.js` (`sendSignedCopy`), `sgsst-electron-app/firma-service/src/config.js` (`ttl`), `sgsst-electron-app/firma-service/deploy/backup-firma.sh` |
| 100 | 🔴 **Aprobar el texto de una version y autorizar a publicarla son DOS decisiones: la segunda exige una garantia tecnica verificable, y una garantia que no bloquea la publicacion es una promesa** | `sgsst-electron-app/firma-service/src/services/agreement.js` (`createVersion`), `sgsst-electron-app/firma-service/src/services/aprobacionPublicacion.js`, `sgsst-electron-app/legal/constancia-aprobacion-acuerdo.html`, `sgsst-electron-app/firma-service/src/services/mailer.js` (`sendOTP`) |
Caso real (27-oct-2026): el abogado devolvio seis decisiones (1.a a 1.f) sobre el Acuerdo v1.1, y el v1.1 seguia siendo el unico texto que describia el servicio. La 1.f decia: "aprobar el texto no autoriza a activar el flag ni a publicar". La 1.b decia: "la Empresa es quien realiza el envio, con sus propios correos, K+AIR es el puente". Ninguna de las dos se podia aplicar solo con texto. La 1.b obligo a decidir **de quien sale el codigo OTP**: si el enlace lo remite la Empresa, el OTP no puede salir por su cuenta, porque el OTP es el dato de creacion de la firma y su custodia no puede depender de la Empresa (art. 2.2.2.47.4 num. 1 del Decreto 1074 de 2015). Ese filtro se escribio en el codigo (`mailer.sendOTP` ignora la cuenta de la Empresa y avisa por log) y despues en los tres documentos. La 1.f obligo a construir una **barrera real**: `agreement.createVersion` con `activa: true` devuelve 409 si no hay autorizacion operativa registrada para esa version Y ese hash, y el gate de readiness tiene un item propio que mira la version en vigor. Y la 1.a (la Empresa obtiene el correo del candidato verbalmente en la contratacion) obligo a distinguir **quien puso el medio**: el campo `correo_otp` lo escribe la Empresa y el Trabajador lo CONFIRMA, asi que el origen del medio tiene tres valores, no dos. Reglas: (1) **aprobar y publicar son dos decisiones y dos evidencias**: la aprobacion juridica queda en el texto, la autorizacion operativa en un registro con version, hash, garantia, resultado de verificaciones, responsable y fecha; (2) **una garantia que no bloquea no es una garantia**: si el sistema puede publicar la version sin la autorizacion, lo que se tiene es una promesa (la trampa 99 al reves: alli el texto mentia sobre el codigo, aqui el codigo no cumplia lo prometido); (3) **el remitente de un correo es parte del documento**: en cuanto el enlace puede salir por la cuenta de la Empresa, el texto que decia "el enlace y el OTP salen de la misma cuenta" queda falso en los TRES documentos que lo decian (Acuerdo 3.1, Anexo de Encargo seccion 5, Anexo de Nube seccion 3), y hay que corregirlos o quedan mintiendo en tres lugares; (4) **el dato de creacion se manda desde donde nadie mas lo controla**: si la Empresa puede ser el remitente, el OTP no sale por su cuenta, y esa exclusion vive en el codigo, no en el papel; (5) **una decision que cambia el rol de un actor cambia el codigo, el manifiesto y tres documentos**: si solo se reescribe el texto, el sistema sigue haciendo lo de antes y el texto vuelve a mentir (trampa 89); (6) **la autorizacion operativa se registra con la huella del texto, no con el nombre de la version**: sin el hash, una autorizacion de un texto serviria para publicar cualquier otro con el mismo nombre |
Caso real (27-oct-2026): al alinear los documentos con el uso de la cuenta gratuita de Gmail, aparecieron tres afirmaciones que el codigo contradijo y que nadie habia tocado: (1) el correo post-firma **adjuntaba el PDF firmado y la Constancia** (`sendSignedCopy`), de modo que la cuenta de consumidor recibia el contrato completo y ningun texto podia decir "notificaciones necesarias"; (2) la §5 del Anexo de Nube afirmaba "cifrado en reposo", "respaldos cifrados" y "autenticacion del personal" cuando la base es `better-sqlite3` sin SQLCipher, el respaldo es `sqlite3 .backup` + `tar.gz` **sin cifrar** y el acceso es por `X-Admin-API-Key` sin segundo factor; (3) la §3 seguia diciendo que el servidor estaba en `Etc/UTC` y que la prueba mensual de restauracion estaba "pendiente de programar", cuando ambas cosas ya se habian corregido el 26 de octubre (`America/Bogota` verificado y los tres cron instalados): **el documento describia un servicio que ya no existia, y nadie lo habia tocado**. Reglas: (1) **el documento legal es una afirmacion viva sobre el sistema**: cambiar la operacion obliga a releerlo (trampa 89), y un texto que describe un servicio que ya no esta es un defecto, no un documento viejo; (2) **la direccion de la correccion es hacia el documento, salvo que el documento tenga una promesa que el servicio cumple y vale la pena defender**: el RTO de 4 h, el respaldo con `integrity_check` y la prueba de restauracion se midieron y se dejaron; lo que no se podia sustentar se quito; (3) **"limitar el uso de un proveedor a notificaciones" es una afirmacion sobre el codigo, no sobre el papel**: si el correo lleva el documento adjunto, el texto que dice "notificacion" miente, y la unica forma de que el texto sea cierto es cambiar el correo (aqui: aviso con enlace, y un endpoint publico de la Constancia porque el boton de la mini-app estaba oculto justamente porque el trabajador la recibia por correo); (4) **no se borra una proteccion contractual para tapar un problema**: la clausula que exige contrato o DPA a los proveedores que reciben datos se conserva y se declara no satisfecha, con sus dos salidas reales (migrar a un proveedor con DPA o la autorizacion expresa y separable del Titular); (5) **una verdad que el texto no puede sostener se escribe como limitacion, no se omite**: "sin doble factor", "sin aviso a ninguna persona", "las copias no estan cifradas" son afirmaciones de fuerza, no debilidades; (6) **el hash del manifiesto se recalcula contra el archivo, nunca de memoria**: el del Anexo de Encargo llevaba una version anterior desde el 📦960 y el de la v1.1 apuntaba al texto viejo, y un hash desactualizado es un dato que miente (trampa 98); (7) **las dos copias del documento se comparan byte a byte**: `legal/` y `sitio/` tienen que quedar con el mismo hash o el sitio publica una version distinta de la que se firma |
Caso real (26-oct-2026): el piloto de la excepcion de habilitacion se dio en un solo lote de comandos — crear la excepcion, y cerrarla "porque la prueba ya estaba hecha". El cierre se ejecutó **catorce segundos** despues de la creacion, sin que nadie abriera el enlace ni firmara: `firmas_usadas = 0` y el motivo de cierre afirmaba "la firma de prueba se completo (commit, consentimiento y constancia)". La base lo contradijo: `SIGN-2026-734698` estaba en `PENDING` con `fecha_firma` vacia. Y como la bitacora es **append-only**, ese motivo falso ya no se puede editar: queda el y se corrige con un evento nuevo. Ocurrio dos veces seguidas. Reglas: (1) **el cierre de un instrumento legal va en un lote aparte, después de la evidencia**: el lote que lo abre no puede traer el que lo cierra, porque el paso humano que hay en el medio se salta; (2) **el motivo de cierre es una afirmacion sobre un hecho que la base puede verificar**: si dice "la firma se completo" y `firmas_usadas = 0`, el registro se contradice y el registro es lo que el abogado lee; (3) **antes de cerrar, se mira el estado**: `SELECT estado, fecha_firma FROM gh_firmas_electronicas WHERE id_solicitud = ...` — el commit se ve en el dato, no en la intention del operador; (4) **la bitacora append-only no se puede corregir, solo complementar**: por eso el error de una vez se multiplica si se repite, y por eso el siguiente instrumento tiene que llevar la correccion en su motivo; (5) **un lote de comandos se ordena por lo que depende de que pase una persona**: lo que puede hacer el operador va en un lote, lo que necesita un humano (firmar en el celular) va en otro, y lo que depende de ese humano (cerrar la excepcion) va en un tercero |
Caso real (26-oct-2026): la excepcion de habilitacion de piloto se creo con alcance de una (1) firma, el smoke creo la solicitud (y gasto esa unidad) y el 5c resolvio el token. Despues se CERRO la excepcion "porque la prueba ya estaba hecha". Con `estado = 'CERRADA'`, la consulta de `vigentePara` (que filtra `estado = 'VIGENTE'`) ya no la devuelve, y **la firma que quedo abierta no se puede commitear**: el commit y la creacion del consentimiento llaman `assertHabilitadaParaFirma` con `cuenta_firma: false`, que es justamente el punto que solo necesita que la excepcion siga en plazo. Agotada y cerrada son dos estados distintos y el codigo los distingue a proposito. Reglas: (1) **la excepcion tiene que vivir TODA la firma, no solo su creacion**: se cierra cuando la firma termina, no cuando la prueba tecnica termina; (2) **"agotada" no es "cerrada"**: la excepcion agotada (`firmas_usadas >= alcance_firmas_max`) sigue vigente y sigue levantando el bloqueo de los puntos que VERIFICAN; la cerrada ya no; (3) **un punto que ABRE una firma gasta alcance y uno que la VERIFICA no**: la creacion y la doble firma gastan, el commit y el consentimiento no; (4) **cerrar antes de tiempo deja la firma abierta sin poder firmarse**: hay que crear otra excepcion (y su propia bitacora lo dice); (5) **el motivo de cierre dice por que se cierra**: "el alcance se agoto" no es lo mismo que "la excepcion ya no aplica"; (6) **el estado VIGENTE es el que manda**: el filtro por `estado` va antes que el filtro por plazo y por alcance, asi que un `CERRADA` no se salva por estar en plazo |
Caso real (26-oct-2026): el modelo del Anexo de Nube decia, textualmente, "hoy la copia es manual y la copia autom&aacute;tica diaria est&aacute; pendiente". Esa frase era cierta el dia que se escribio y **dejo de serlo en el momento en que el cron quedo instalado**: el documento legal que se iba a firmar seguia describiendo un servicio que ya no existia, y el que lo iba a firmar no tendria como enterarse. Reglas: (1) **cambiar la operacion obliga a releer los documentos que la describen**: el backlog es "el repo dice X" y el repo tiene que decir lo que se hace; (2) **un documento que se firma no se actualiza a medias**: si el dato cambio, se corrige ANTES de la firma, porque despues hay que volver a firmar; (3) **el bloque de pendientes tambien es contenido**: si el documento lista "cuatro datos que faltan" y tres ya estan, la lista es un defecto, no un detalle (aqui paso de cuatro datos a uno); (4) **las dos copias del documento se comparan byte a byte**: `legal/` y `sitio/` tienen que quedar con el mismo hash o el sitio publica una version distinta de la que se firma |
Caso real (26-oct-2026): el backup era **manual, sin cron** (el propio runbook lo decia: "Monitorizacion: nada avisa") y el manifiesto tenia `rto_horas`, `rpo_horas` y `plan_continuidad` en `null`. Con eso, un RTO de 4 h no es una promesa: es un numero que el Anexo de Nube firmaria sin que nadie supiera **cuando empieza a correr**. Reglas: (1) **el RPO no puede ser menor al intervalo entre las copias**: si el respaldo es diario, el RPO es de 24 h; prometer menos es prometer algo que no existe; (2) **un respaldo que nunca se ha restaurado no es un respaldo, es un archivo**: la prueba de restauracion (integridad + tablas + conteos + `user_version`) va en el mismo paso que la instalacion del cron, no como extra; (3) **la copia es la que se verifica**: el `PRAGMA integrity_check` va sobre la copia, no sobre el original (copiar el archivo con el servicio corriendo se lleva una copia a medio escribir); (4) **un plazo de supresion tiene que tener a alguien que lo haga cumplir**: por eso es el mismo plazo que la retencion de las copias (la poda lo hace cumplir) y no un numero en un documento; (5) **un detector que solo deja log no es deteccion**: el script puede reiniciar el servicio, pero si nadie esta mirando el log, el RTO cuenta desde que el owner se entere; (6) **el dato se llena con la evidencia**: los tres campos del manifiesto se escriben cuando el cron esta instalado y la restauracion probada en el servidor, no antes (trampa 86) |
Caso real (26-oct-2026): la corrida e2e del piloto se ejecuto **dos veces seguidas** con los valores de ejemplo sin cambiar (`--correo=CORREO_REAL`, `--numero-documento=NUMERO_DE_CEDULA`). Las dos veces el servidor respondio `400 INVALID_REQUEST_BODY` con `"Invalid email"` en `correo_verificacion`: un mensaje de **forma** que no dice la causa real (falta el correo del firmante), y por eso el operador no se entero de que el problema era el marcador copiado. El dano mayor estaba en el otro dato: con `--numero-documento=PRUEBA-001` el alta habria dado **201** y la solicitud habria sido **imposible de firmar**, porque la mini-app borra todo lo que no sea digito (`web/firma/app.js`) y la ruta `identifyBody` exige `regex(/^\d+$/)` con 4 a 20 caracteres: el firmante nunca podria identificarse, y el unico sintoma seria un `422 IDENTIFICATION_FAILED` sin causa aparente. Reglas: (1) **la herramienta que pide datos al operador los valida ANTES de tocar el sistema**, y el error dice que falta y como se corrige: un 400 de schema no es un diagnostico; (2) **un valor de ejemplo que se copia es un valor sin cambiar**: los marcadores (`CORREO_REAL`, `NUMERO_DE_CEDULA`, `TU_CEDULA`, `MAIL`) se rechazan **por nombre**, no por formato; (3) **un correo con formato invalido y un correo vacio son dos fallos distintos**: el vacio es peor, porque el default del script (`prueba@example.com`) es un buzon muerto y el OTP no le llega a nadie; (4) **el dato que se compara por huella tiene que ser exactamente el que el humano va a escribir**: el script calcula `sha256(numero)` y el numero del comando y el del celular son el mismo string, sin puntos ni guiones; (5) **un 201 no prueba que la firma se pueda hacer**: la solicitud creada tiene que ser **firmable**, y eso se comprueba antes de crearla, no despues; (6) **el smoke es una herramienta de linea de comandos que el owner usa a mano**: su ergonomicidad es parte del control, no un detalle |
Caso real (26-oct-2026): el e2e dio **14 comprobaciones, 0 fallas, RESULTADO OK**: la solicitud se creo (`SIGN-2026-827084`), la invitacion salio por correo y el token resolvio. Y la firma **no se podia hacer**. El firmante se identifico, recibio el codigo, llego a la tercera casilla de la mini-app (la del Acuerdo de uso) y ahi el servidor respondio `409 CONSENT_REQUIRED`: la fila de la solicitud se creo **sin `consent_id`**, o sea sin el consentimiento del Acuerdo, que es el objeto que la mini-app tiene que aceptar antes de firmar. El smoke creaba UNO de los dos objetos del proceso (la solicitud) y no el otro (el consentimiento): el flujo real de K+AIR crea el consentimiento, crea la solicitud con su `consent_id`, y recien ahi se emite el enlace. El sintoma era desconcertante porque el mensaje de la mini-app decia *"Esta solicitud no requiere aceptacion de Acuerdo. Contacta a tu empleador"*: **al reves de lo que significa el codigo** (`CONSENT_REQUIRED` = falta el consentimiento), asi que el sintoma senalaba un problema de la solicitud y no del cliente que la habia creado. Reglas: (1) **un e2e que no llega al commit no prueba que la firma se pueda hacer**: el check tiene que comprobar que la solicitud tiene TODO lo que la mini-app va a necesitar, no solo que el alta dio 201; (2) **el cliente tiene que hacer los pasos que el servidor exige**: la firma es un proceso de dos objetos (consentimiento + solicitud) y el smoke solo hacia el segundo; (3) **el mensaje de error tiene que decir lo que el codigo significa**: un mensaje al reves manda al usuario al lugar equivocado, y en un celular eso se lee como "el sistema esta roto"; (4) **un 201 no es una firma**: el alta puede ser correcta y la firma imposible, y no hay forma de saberlo sin abrir el enlace; (5) **lo que no se puede reparar, hay que rehacerlo**: no hay endpoint para enlazar un consentimiento a una solicitud ya creada (el vinculo se escribe al crear la solicitud), asi que una solicitud sin consentimiento no tiene arreglo: hay que crear otra; (6) **el check que muerde es el que relee la fila**: crear no devuelve el `consent_id`, asi que la comprobacion tiene que releer la solicitud y verificar el vinculo |
Caso real (26-oct-2026): la excepcion 4 se creo con `alcance_firmas_max: 2` ("1 para el piloto y 1 de repuesto") y al final del dia quedo en **`firmas_usadas: 2` de 2**, con **una sola firma**. Las dos unidades se gastaron en la **apertura** de dos solicitudes: `SIGN-2026-827084` (que se creo sin el consentimiento del Acuerdo y por tanto era **imposible de firmar**: no se podia aceptar el Acuerdo en la mini-app) y `SIGN-2026-927141` (la que si se firmo a las 16:10:16 hora Colombia). El **commit no consume alcance**: `creacion_solicitud` va con `cuenta_firma: true` y `commit` con `cuenta_firma: false` (el commit *verifica* una firma ya abierta, y la excepcion que la abrio es la suya). Reglas: (1) **el alcance se gasta al abrir, no al firmar**: la unidad se consume en la creacion de la solicitud, que es el punto `creacion_solicitud`; (2) **una solicitud que se abre y no se puede completar consume alcance igual**: por eso hay que verificar que la solicitud es **firmable** (consentimiento vinculado, Acuerdo vigente, token vivo) ANTES de abrirla, porque el alcance gastado no vuelve; (3) **`firmas_usadas` se lee contra el alcance, no contra las firmas**: "2 de 2" puede querer decir dos firmas o una firma y una carta; (4) **agotada no es cerrada**: mientras la excepcion siga `VIGENTE` y en plazo, sigue levantando el bloqueo en los puntos que verifican (por eso el commit de la 927141 paso con el alcance ya agotado); (5) **el motivo de cierre dice que paso**: el de la 4 dice "alcance gastado 2 de 2" y por que, sin afirmar nada que no haya pasado |
Caso real (26-oct-2026): la respuesta 11A del abogado (23-oct) decidio las cuatro cuestiones, entrego el texto final de los doce grupos de la v1.1 y dictamino el Anexo de Nube. Del otro lado quedaron dos bloqueos que son de proceso, no de fondo: (a) el texto de la v1.1 **armado** (42 475 B, `634b063c…`) no se puede publicar sin su aprobacion, y (b) el Anexo de Encargo conserva la marca de "revision profesional pendiente", que el readiness trata como bloqueante y que **solo se quita cuando el abogado revisa el documento**. Cuando se le manda un documento por correo, el archivo que llega es una **copia**: nadie puede probar despues cual era el texto exacto que se adjunto, y la respuesta del abogado va a venir contra ese texto. Reglas: (1) **al abogado se le manda un documento con hash**: el `SHA256SUMS.txt` del paquete permite verificar que el archivo que tiene es el que tiene el sistema; (2) **la respuesta se aplica contra el texto que se le mando**, no contra "el texto del Anexo de Encargo": si el hash del documento que llega no coincide con el del sistema, hay que rehacer el paquete antes de aplicar nada; (3) **la marca de revision pendiente no se quita por buena voluntad**: se quita con la revision del abogado, y el motivo de la quitada dice que reviso (trampa 86: el dato se llena con la evidencia); (4) **lo que el abogado dejo entre corchetes se le devuelve como pregunta cerrada, no como hueco abierto**: los tres huecos del DPA de Google se le presentan con las dos alternativas y su consecuencia; (5) **un paquete que se manda se documenta en el repo**: que quede escrito que se envio, que se mando y con que hash, para que el que siga sepa desde donde seguir |
Caso real (26-oct-2026): el punto `d03` del manifiesto ("Prueba de D-03 en los cuatro puntos de bloqueo") se cierra el 26-oct-2026 con evidencia de **dos fuentes distintas**, y la evidencia dice cuál es cuál: (a) la **suite automatica** prueba los cuatro puntos en las dos direcciones (`tests/excepcion-habilitacion.test.js`: "punto (i) creacion: sin excepcion NO se crea la solicitud" / "con excepcion la solicitud SI se crea"; "punto (ii) commit: sin excepcion vigente NO se firma" / "con excepcion vigente la firma pasa y queda escrita"; "punto (iii) consentimiento: sin excepcion NO se crea" / "con excepcion SI se crea"; "punto (iv) doble firma: sin excepcion vigente NO se crea el hijo"); (b) la **produccion** (kair-server, el mismo dia) probar el mecanismo de punta a punta: la excepcion 4 creada con las seis condiciones, usada 2 de 2, cerrada con el motivo verdadero, y la cara 409 real observada en el punto (i) creacion. Lo que **no** se probo en el servidor real son las caras 409 de los puntos (ii), (iii) y (iv): en el commit el chequeo del D-03 va antes de generar el PDF, y en la doble firma el fallo queda en el LOG del servidor ("firma-dual: error creando hijo"), no en la respuesta, porque el padre ya firmo legalmente. Reglas: (1) **la evidencia dice DONDE se probo cada parte**: el suite que pasa no es el servidor que corre, y una corrida en el servidor no prueba todas las ramas; (2) **la evidencia dice tambien el limite**: decir "probado en los cuatro puntos" sin decir "tres por la suite y uno en el servidor" es mentir por omision, y el que la lea (el abogado) no tiene como saberlo; (3) **el mismo codigo**: la suite corre el MISMO modulo que el servidor (mismo tar), asi que la prueba automatica de una rama es evidencia valida del comportamiento de esa rama en produccion; (4) **un booleano de "probada" es una puerta, no un documento**: lo que sostiene la puerta es el texto de la evidencia, y ese texto tiene que poder auditarse; (5) **no sePRESENTA como cierre lo que es un limite**: si el limite es real, se escribe; un cierre con la evidencia escrita asi no se puede discutir despues |
Caso real (26-oct-2026): corriendo `node --test tests/readiness-anexo-empresas.test.js` **suelto**, tres tests fallan con `{ code: 'SQLITE_ERROR' }`; el mismo archivo, dentro de la suite completa, pasa. La causa no es el archivo: es que ese archivo **depende del setup de otro** (la base se crea en un `before` compartido o en otro archivo) y, solo, no encuentra el esquema. El riesgo no es el error del test: es que el que lo corre suelto **cree que rompio algo** (en este caso, que el manifiesto estaba mal) y **revierta un cambio que estaba bien** — que es exactamente lo que estuvo a punto de pasar el 26-oct-2026 con el `d03`. Reglas: (1) **un test que solo pasa en la suite completa es una mina**: o se arregla su aislamiento, o se documenta que hay que correrlo en la suite; (2) **antes de dar por rota una cosa, se reproduce con el estado anterior**: el `SQLITE_ERROR` se reprodujo con el manifiesto de HEAD, y eso lo convirtió en "pre-existente" en lugar de "causado por mi cambio"; (3) **el manifiesto se compara antes y despues**: el parche imprime que secciones cambiaron (solo `d03`), y eso descarta de entrada que el cambio haya roto otra cosa; (4) **la suite completa es la que vale**: un archivo suelto que falla no dice nada del estado del proyecto |
Caso real (26-oct-2026): al cerrar la jornada, el tablero de los 15 puntos decia que la v1.1 armada eran "38 969 B, a88e41af…b7bc5" y el manifiesto decia "634b063c…". Las dos cifras eran **ciertas en su momento**: la v1.1 se re-empaqueto con los doce grupos de la respuesta 11A del abogado y crecio. El tablero se habia escrito con la cifra de la v1.1 anterior y nadie lo actualizo al re-empalmar. El riesgo no es que un numero este viejo: es que **el que lo lea lo compare con el archivo, no coincida, y pierda la confianza en todo lo demas** — y, peor, que mande ese hash al abogado como si fuera el del texto que se va a revisar. Reglas: (1) **un tablero con cifras viejas es un tablero que miente**: el hash se recalcula contra el archivo, nunca de memoria ni de una entrada vieja; (2) **el manifiesto y el tablero tienen que decir lo mismo del mismo objeto**: si uno dice 42 475 B y el otro 38 969 B, no es un detalle de redaccion, son dos textos distintos y alguien los va a mandar; (3) **cada paquete revisa las filas que toco**: el tablero no se actualiza "al final", porque "al final" es cuando ya nadie recuerda las cifras; (4) **la fila dice quien la cierra**: el dueno de cada pendiente (el abogado, el owner, la Empresa, el sistema) es la informacion que evita el "esto esta en manos de alguien que no sabe"; (5) **las cifras que importan son las del artefacto**: bytes y hash del archivo, no el numero que se recuerda de la entrada anterior |
Caso real (26-oct-2026): la corrida e2e del piloto se ejecuto **dos veces seguidas** con los valores de ejemplo sin cambiar (`--correo=CORREO_REAL`, `--numero-documento=NUMERO_DE_CEDULA`). Las dos veces el servidor respondio `400 INVALID_REQUEST_BODY` con `"Invalid email"` en `correo_verificacion`: un mensaje de **forma** que no dice la causa real (falta el correo del firmante), y por eso el operador no se entero de que el problema era el marcador copiado. El dano mayor estaba en el otro dato: con `--numero-documento=PRUEBA-001` el alta habria dado **201** y la solicitud habria sido **imposible de firmar**, porque la mini-app borra todo lo que no sea digito (`web/firma/app.js`) y la ruta `identifyBody` exige `regex(/^\d+$/)` con 4 a 20 caracteres: el firmante nunca podria identificarse, y el unico sintoma seria un `422 IDENTIFICATION_FAILED` sin causa aparente. Reglas: (1) **la herramienta que pide datos al operador los valida ANTES de tocar el sistema**, y el error dice que falta y como se corrige: un 400 de schema no es un diagnostico; (2) **un valor de ejemplo que se copia es un valor sin cambiar**: los marcadores (`CORREO_REAL`, `NUMERO_DE_CEDULA`, `TU_CEDULA`, `MAIL`) se rechazan **por nombre**, no por formato; (3) **un correo con formato invalido y un correo vacio son dos fallos distintos**: el vacio es peor, porque el default del script (`prueba@example.com`) es un buzon muerto y el OTP no le llega a nadie; (4) **el dato que se compara por huella tiene que ser exactamente el que el humano va a escribir**: el script calcula `sha256(numero)` y el numero del comando y el del celular son el mismo string, sin puntos ni guiones; (5) **un 201 no prueba que la firma se pueda hacer**: la solicitud creada tiene que ser **firmable**, y eso se comprueba antes de crearla, no despues; (6) **el smoke es una herramienta de linea de comandos que el owner usa a mano**: su ergonomicidad es parte del control, no un detalle |
| 101 | 🔴 **Un verificador que contradice lo que ya viste esta mal, no el dato: el codigo de un caracter no es el que uno se acuerda, y el reporte imprime titulos, no ids** | `sgsst-electron-app/firma-service/src/services/readinessLegal.js` (`generarReporteTexto`), `sgsst-electron-app/firma-service/scripts/auditar-readiness-legal.js`, `sgsst-electron-app/firma-service/src/services/aprobacionPublicacion.js` | Antes de reportar un "REVISAR" o un "falta", **reproduce la comprobacion en local**: si el verificador dice que no y la fila que acabas de registrar dice que si, el sospechoso es el verificador |
Caso real (27-oct-2026): la autorizacion operativa de la v1.0 quedo registrada en produccion y la respuesta del servidor la devolvio con las tildes correctas. Dos verificaciones dieron negativo, y las dos **eran las verificaciones**: (a) `instr(garantia, char(233))` dio 0 porque **233 decimal es la `e` acentuada (hex C3A9), no la `o` acentuada: el codigo de la `o` es 243 (C3B3)**, y el texto de la garantia no tiene ninguna `e`, asi que el `CASE` caia en la rama 'REVISAR' con el dato sano; (b) `grep 'aprobacion_operativa_vigente'` sobre el reporte no encontro nada porque el reporte en texto imprime el **titulo** del item ('Aprobacion operativa de la version vigente'), no su id de maquina, y un item que ya paso a OK **desaparece** de la lista de 'Faltan N bloqueante(s)': la ausencia era la buena noticia. Reglas: (1) **un verificador que contradice la evidencia visible se suspecta primero a si mismo**: la respuesta del servidor con el texto completo era la evidencia y las dos consultas eran las que fallaban; (2) **el codigo de un caracter no se recuerda, se comprueba**: `char(233)` y `char(243)` son `e` y `o` acentuadas, y se verifican en una linea contra la base ANTES de llevar el comando al servidor; (3) **el id de un item no es su nombre en el reporte**: el reporte de texto imprime `item.titulo`, y el id solo existe en el JSON (`--json`); (4) **un item que pasa a OK se borra de la lista de pendientes**: se busca por el titulo, y el resumen (`Items:`, `Bloqueantes de este gate:`) es el que dice los numeros; (5) **una comprobacion que no se puede reproducir en local no se reporta como resultado**: se reporta como 'no verificado' |
| 102 | 🔴 **Un script que edita archivos en lote no se puede deshacer con git si los archivos no estan commiteados: el trabajo de otro worker en el MISMO archivo se lleva por delante** | `%TEMP%\kair-confirmar-tests.js` (batch de `/identify`), `sgsst-electron-app/firma-service/tests/*.test.js` | Un script propio metia la confirmacion del medio en los 68 cuerpos de `/identify` de 24 archivos de test. La primera version **metia los campos al principio del objeto** en vez de al final, y dejo 24 archivos con sintaxis rota. Agravante: 19 de esos archivos ya estaban tocados por otro worker y **no estaban commiteados**, asi que `git checkout` no restauraba nada sin llevarse por delante el trabajo ajeno. Reglas: (1) **un batch se prueba en SECO primero** (`--dry`) y, despues de aplicarlo, el `git diff` contra `HEAD` tiene que ser **exactamente** el cambio que el script dice hacer: si aparece algo mas, el script rompio algo; (2) **un archivo con trabajo ajeno no se restaura con `git checkout`**: se repara, o se restaura solo cuando se sabe que nadie mas lo toco; (3) **quien repara un batch escribe el inverso exacto de la transformacion**, y lo demuestra con un viaje de ida y vuelta antes de tocar un archivo real; (4) **un batch que reescribe un objeto inserta al FINAL del contenido**, antes del espacio final, nunca al principio: la forma del objeto es parte del archivo y el EOL de cada linea se respeta |
| 103 | 🔴 **Una variable que se borra dentro de una funcion deja referencias fantasma, y el `catch` generico las disfraza de 500: el error de negocio se pierde** | `sgsst-electron-app/firma-service/src/services/publicFlow.js` (`resendOtpDeSignRequest`), `src/middleware/errors.js` | Al cambiar el desbloqueo del reenvio (el bloqueo duro del OTP, 📦978) se dejo una referencia a `wasLocked`, que ya no existia. El `catch` generico se la comio a todos los errores de negocio: **14 tests de reenvio fallaron con 500 INTERNAL_ERROR** en vez del 422 que corresponde, y el unico rastro era el log del servidor. Reglas: (1) **cuando se borra o renombra una variable, se busca su nombre viejo en TODO el bloque**, no solo donde se declaraba; (2) **un 500 donde deberia haber un 4xx es un ReferenceError hasta que se demuestre lo contrario**: el primer paso es el log del servidor, no el test; (3) **el `catch` generico es la ultima linea de defensa, no el plan**: un error de negocio (400/409/422) tiene que salir como tal, y si sale como 500 lo primero que se revisa es una variable que no carga |
| 104 | 🔴 **`CONTEXT.md` tiene TRES tipos de separador y cada region usa el suyo: la trampa 16 dice "tres CR" pero solo las primeras 6 lineas los tienen** | `sgsst-electron-app/CONTEXT.md` (todo el archivo) | **Remedido el 5-nov-2026 con los bytes crudos: 1 958 separadores, 1 400 con CR CR LF, 558 con CRLF (1 CR) y 1 con LF puro.** El **bloque de entradas del principio** (donde se inserta un hito nuevo, lineas 22 a 454) sigue siendo **CRLF normal**; el cuerpo **alterna** por regiones (562-1698 CR CR LF · 1699-1705 CRLF · 1706 CR CR LF · 1720-1941 CR CR LF · 1942-1958 CRLF), así que **no hay una sola region**: el separador se mide en el ancla, y el conteo de la trampa 16 ("1337 de sus 1354 lineas") ya no describe el archivo. La trampa 16 acierta en "nunca lo reescribas entero". Reglas: (1) **el separador se mide en el ancla exacta, no se supone**: se leen los bytes de la linea del ancla y de la anterior antes de escribir; (2) **un contador ingenuo de "\r\n" cuenta igual los "\r\r\n"**: por eso un archivo CR CR LF puede aparecer como "CRLF puro" y el EOL se tiene que medir con los bytes; (3) **el texto nuevo se arma con el separador de SU ancla, no con el del archivo entero**: insertar CRLF en una region CR CR LF rompe el diff de esa linea; (4) **insertar un hito en CONTEXT.md es un `replace` del ancla**: bloque nuevo + un marcador `>> **Anterior · ...**` + el ancla original (esa duplicacion **es** el estilo de la casa, no un error), y el separador del texto nuevo es el de la linea del ancla |
| 105 | 🔴 **El readiness comparaba el Acuerdo contra una versión fija: el control estaba rojo desde la v1.2 y nadie lo notó** | `sgsst-electron-app/firma-service/src/services/readinessLegal.js` (`analizarAcuerdo`, `_versionAcuerdoEsperada`), `firma-service/legal-readiness.json` (`acuerdo.version`) | La versión que se compara sale del **manifiesto**, y si no está, del **nombre del archivo**. Cuando cambies el texto del Acuerdo, corré el readiness **contra el texto nuevo** |
Caso real (30-oct-2026): cerrando la línea legal en v1.3 se descubrió que el control textual del Acuerdo estaba en rojo **desde la v1.2**: comparaba el texto contra la cadena fija `'v1.1'` y reportaba "Faltan cláusulas: Versión del Acuerdo: v1.1" sobre un texto que decía v1.2. Nadie lo notó porque el readiness se corría contra su propio archivo de siempre, no contra el texto candidato. Reglas: (1) **un control que compara contra una constante no comprueba el documento: comprueba la constante** — el dato que se compara se deriva del documento o de su manifiesto, nunca de un literal escrito a mano; (2) **cuando cambia el texto, el control se corre contra el texto nuevo**: el readiness que no se corrió contra la v1.2 es el que dejó el rojo pasar; (3) **un control de un numeral es un contrato bidireccional**: además de exigir lo que el texto dice, tiene que **rechazar** lo que el texto dejó de decir — el control textual del 8.6 exigía la redacción vieja ("retención por plazo no declarado") que D1 eliminó, y por eso hoy tiene un control de **ausencia**; (4) **el manifiesto declara qué versión se revisa**: el campo `acuerdo.version` es la fuente de verdad, y el nombre del archivo es el plan B; (5) **un control que nadie corre es un control que no existe**: por eso el verificador de la nota al abogado es un script, no una revisión manual |
| 106 | 🔴 **El 12.7 y el 3.6(g) seguían prometiendo la retención indefinida después de que D1 la eliminara** | `sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.3.txt` (numerales 12.7 y 3.6(g)), `firma-service/src/services/readinessLegal.js` (`_textoRetencionV13`) | Cuando se retira un mecanismo, **barré todo el texto por las frases del mecanismo viejo**, no solo el numeral que lo definía. El barrido son minutos; leer 72.000 caracteres a ojo son horas |
Caso real (30-oct-2026): D1 eliminó la retención indefinida y se reescribieron el 8.6(a) y el 8.6(h) — pero el **12.7** seguía diciendo "mientras ese plazo no esté declarado, la prueba no se suprime y queda retenida por esa razón, conforme al 8.6(h)", y remitía a un literal cuyo contenido ya no era ese. Lo cazó un barrido del texto por las frases del mecanismo retirado, no la lectura. Reglas: (1) **retirar un mecanismo es reescribir todos los numerales que lo nombran**, no solo el que lo define: un numeral puede remitir a otro y quedarse hablando de un mundo que ya no existe; (2) **el barrido es por la frase, no por el numeral**: la lista de frases del mecanismo viejo se aplica al texto entero y devuelve números de línea; (3) **el texto no puede prometer lo que el código no cumple**: los dos numerales apuntaban a un mecanismo que ya no existía en el código, y por eso el 12.7 y el 3.6(g) se corrigieron en la v1.3 antes de mandarse; (4) **un control de ausencia es el que sostiene la corrección**: el texto que todavía trae la frase vieja tiene que **fallar**, porque si pasara, nadie se enteraría |
| 107 | 🟡 **La nota al abogado citaba bytes y huellas escritas a mano: el día que cambió un documento, quedó mintiendo** | `docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/nota-al-abogado-2026-10-30.md`, `firma-service/scripts/verificar-nota-abogado.js`, `firma-service/scripts/actualizar-manifiesto-v1.3.js` | Los números de la nota los **compara un script** contra el archivo real; si el verificador falla, la nota no sale. Las huellas se recalculan desde los archivos, no se transcriben |
Caso real (30-oct-2026): la nota al abogado de la ronda 4 cita, para ocho documentos, sus bytes y su SHA-256. Los números se escribieron a mano; cuando el Anexo de Encargo se regeneró (85.678 -> 85.947 B) la nota quedó diciendo una cosa y el paquete otra, y el hash que el abogado iba a aprobar era el de un texto que ya no existía. Reglas: (1) **una nota con cifras escritas a mano es una nota que se pudre**: hoy las compara `verificar-nota-abogado.js`, que además valida contra `SHA256SUMS.txt`; (2) **las huellas se recalculan, no se transcriben**: `actualizar-manifiesto-v1.3.js` las saca de los archivos reales y `armar-paquete-abogado.js` sale con código 3 si el manifiesto no coincide; (3) **el manifiesto legal es ASCII puro y se edita con reemplazo literal**: un `JSON.stringify` convierte los `\u00e1` en caracteres reales, el archivo deja de ser ASCII y el diff es enorme; (4) **el paquete se arma con un script, no a mano**: el script copia los adjuntos, calcula las huellas y retira los adjuntos de una ronda anterior, para que al abogado no le lleguen dos versiones del mismo documento |
| 109 | 🟡 **La limpieza de temporales se define por lo que se CONSERVA, no por el patrón que se borra** | `%TEMP%\kair-deploy` (el paquete que se sirve por HTTP), `%TEMP%\kair-deploy-stage`, los procesos `python` que no son del despliegue | El patrón borra lo que coincide; la lista blanca decide lo que sobrevive. El directorio del paquete se excluye por nombre |
Caso real (30-oct-2026, noche): al cerrar el despliegue había que limpiar **844** temporales acumulados en el `TEMP%` del portátil (39 MB de carpetas `kair-huerfanos-*`, `kair-firma-test-*`, `kair-eval-*` y los bundles `*.tmp.js` de la app). El riesgo no era el volumen: era que **el paquete del despliegue vive en la MISMA carpeta** (`%TEMP%\kair-deploy\kair-deploy.tar.gz`) y lo está sirviendo un `python -m http.server` que el servidor va a bajar en los minutos siguientes. Un borrado por patrón se lo llevaba y dejaba el despliegue sin paquete y sin huella con la cual comparar. Reglas: (1) **la limpieza se define por la lista de lo que se conserva, no por el patrón de lo que se borra**: el script excluye por nombre el directorio del paquete; (2) **antes de matar un proceso se lee su línea de comandos**: en la misma máquina había dos `python` que NO eran del despliegue (el `unsloth studio` en el 8888) y a los que un `taskkill` por nombre de proceso los habría matado sin querer; (3) **el puente de descarga se verifica DESPUÉS de limpiar**: un HTTP 200 con el mismo `Content-Length` es lo que dice que el paquete sigue ahí; (4) **el hash se recalcula después de limpiar**: si el paquete hubiera cambiado, el `sha256sum` del servidor no iba a coincidir y el despliegue se paraba sin haber tocado nada |
| 108 | 🔴 **Un mecanismo legal desplegado sin su compuerta aplica en producción lo que el texto vigente no dice** | `sgsst-electron-app/firma-service/config/tabla-conservacion.json` (`aplicacion.activada`), `firma-service/src/services/retencion.js` (`_tablaActivada`), `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` (§5.1) | La fuente legal declara su propio estado y el código lo lee. Con la compuerta cerrada, el plazo por defecto es el del catálogo y las excepciones legales siguen aplicando |
Caso real (30-oct-2026, noche): el owner dijo "pongámoslo en producción" y la revisión del camino de despliegue encontró tres defectos que eran jurídicos, no técnicos. (1) La tabla de conservación declaraba `estado: PROPUESTA` — "los plazos de diez (10) y cinco (5) años NO se activan en producción hasta que el abogado los valide" — pero el **código no leía ese estado**: el planificador aplicaba el plazo por defecto de la tabla sin mirarlo. Desplegarlo activaba en producción exactamente los plazos que el abogado no había validado, y el Acuerdo **vigente** (la v1.0, cuyo 8.6 remite a la tabla de la Empresa y no describe esos plazos) no los dice. (2) El `git archive` del §5.1 no llevaba `config/`: sin la tabla en disco el servicio arrancaba con el **respaldo congelado del código (tres categorías en vez de ocho)** y lo hacía **en silencio**. (3) El manifiesto apuntaba a `scripts/fixtures/acuerdo-v1.3.txt`, que **no estaba versionado ni viajaba en el tar**: el readiness del servidor iba a leer un archivo inexistente y a reportar huecos que son puro artefacto del empaquetado. Reglas: (1) **un mecanismo que administra plazos declara su propia activación y el código la lee**: lo que decide cuándo se aplica un plazo es el documento que lo administra, no una constante ni una variable de entorno; (2) **lo que el texto vigente no describe, el código no lo aplica**: el Acuerdo que manda en producción es el que está en la base, no el que se está preparando; (3) **el paquete se verifica por su contenido, no por su hash**: un hash de un tar no dice si dentro va la tabla de conservación; (4) **el tar se arma desde el commit, así que lo que no está versionado no viaja**: versionar el texto del Acuerdo no es opcional cuando el manifiesto lo declara; (5) **el respaldo de emergencia de un mecanismo con compuerta, arranca con la compuerta cerrada**: si no, la falla de leer el archivo activa lo que la compuerta bloquea |


| 110 | 🔴 **Una regla de `.gitignore` puede tragarse archivos de prueba REALES: corren en la suite y no viajan con el repo** | `sgsst-electron-app/.gitignore:80` (`_*.js`) | Antes de decir que un archivo "está en el repo", comprobá `git check-ignore -v <archivo>`: si imprime la regla, **no está versionado**, aunque exista en disco y sus pruebas corran |
Caso real (31-oct-2026): al corregir el único rojo de la suite del `firma-service` (ADVE6.7) se descubrió que el archivo que lo contiene —`firma-service/tests/_adversary-e6e7.test.js`— **no está versionado**: la regla `_*.js` (📦773, pensada para los scripts one-off de depuración) lo traga porque el nombre arranca con guion bajo. Lo mismo pasa con `firma-service/tests/routes/__test-isolation.test.js`. El `package.json` del servicio corre `tests/*.test.js` y `tests/routes/*.test.js`, así que **37 pruebas se ejecutan en esta máquina y no existen para nadie más**: ni para el CI, ni para otra PC, ni para un clon nuevo. Reglas: (1) **el conteo de la suite incluye pruebas que pueden no estar en el repo**: antes de reportar "2 078 en verde", hay que saber cuántas de esas viajan; (2) **`git check-ignore -v` es la forma de saber si un archivo está versionado**, no `git status` ni el hecho de que exista en disco; (3) **un archivo de prueba real no lleva el prefijo de los temporales**: la excepción va en el `.gitignore` (`!firma-service/tests/_*.test.js`), no en el nombre del archivo; (4) **una prueba que no viaja no protege a nadie**: verde en esta máquina y verde en otra son dos cosas distintas

| 111 | 🔴 **El manifiesto legal lo reescribe su script: editar el JSON a mano no vale, y el script tiene que refrescar el bloque entero** | `sgsst-electron-app/firma-service/legal-readiness.json`, `sgsst-electron-app/firma-service/scripts/actualizar-manifiesto-v1.4.js` | Las `nota` de los bloques (`acuerdo`, `anexo_encargo`, `anexo_nube.modelo`, `constancia`, `matriz_finalidades`) son **constantes del script**. Una corrección aplicada al JSON desaparece en la siguiente regeneración: la de la línea 87 se perdió y el abogado la volvió a señalar dos días después. Y el script, al actualizar un bloque que ya existía, refrescaba `hash` y `nota` pero **no** `actualizado_at`: el manifiesto pasaba a declarar una fecha anterior al archivo que describe. Reglas: (1) **el manifiesto no se edita a mano**: se edita el script (o `config/`), y se corren el script y su `--check`; (2) **un bloque que se actualiza se actualiza entero**: `hash`, `version`, `actualizado_at` y `nota`; (3) **la fecha que declara el manifiesto se compara con el `mtime` del archivo que describe**, y esa comparación es parte de la cadena, no un extra (§5.24) |
| 112 | 🔴 **Un control legal que apunta a un número de línea se rompe en cuanto el documento crece, y se rompe mintiendo** | `sgsst-electron-app/legal/anexo-nube-v1.0.html` (la línea 274 que la compuerta G0 daba por buena) | La G0 comprobaba que el texto del abogado seguía intacto **leyendo la línea 274**. Al diligenciar los catorce marcadores el documento creció dos líneas, el texto pasó a la 276 y el control quedó rojo diciendo que el texto ya no estaba. **Un control que verifica el texto de otro lo busca por contenido, con aserción de coincidencia única**; y todo verificador que apunte a una línea, un párrafo o un byte se revisa el mismo día en que el documento crece |
| 113 | 🔴 **La ausencia de filas en la base no es la ausencia del mecanismo, y un corchete puede ser una palabra y no un dato** | `sgsst-electron-app/firma-service/src/services/publicFlow.js` (evento `OTP_SEND_FAILED`) | Del hecho de que la base de producción no tuviera filas de error de envío se concluyó que el sistema no registraba los errores: **falso**, el `INSERT` del evento está en el código y lo que no había pasado es que ningún envío fallara. Y al otro lado, el único hueco que le quedaba al Anexo diligenciado era `[PENDIENTE]`, que era **la palabra del abogado dentro de su propia regla**, no un dato. Reglas: **la base dice qué pasó, el código dice qué puede pasar**; y cuando el control discrepa del documento, la primera pregunta es si el control está contando algo que no es un dato |
| 114 | 🔴 **Un diagnóstico negativo que no se midió en el puerto real es una hipótesis, no un hallazgo: y endurecer es cerrar el CAMINO de red, no apagar el servicio** | `kair-server` (acceso administrativo por SSH y por Cockpit), Tailscale | El diagnóstico de la jornada anterior concluyó que `sshd` estaba apagado y que la única vía era Cockpit. **Era falso**: medido en el servidor, `cockpit.socket` estaba `enabled`+`active` escuchando en `*:9090` y `sshd` escuchaba en `0.0.0.0:22` y `[::]:22`, con la ruta de Tailscale **directa** (5-23 ms). El falso negativo venía de probar el acceso por la IP de la LAN en vez de por el puerto que el servicio escucha. Reglas: (1) **un servicio se da por caído cuando se mide su PUERTO, no cuando falla un CAMINO**: `ss -ltnp` y `systemctl is-active` miden el servicio; un `curl` a una IP mide un camino, no un estado; (2) **un diagnóstico negativo se confirma por una vía INDEPENDIENTE antes de escribirlo**: SSH y Cockpit se probaron por separado y los dos funcionaban; (3) **endurecer es cerrar el camino, no apagar el servicio**: el `sshd` se dejó escuchando y lo que se cerró fue el acceso desde la LAN — la vía real quedó siendo Tailscale, con el firewall local en reglas de entrada y el ACL del tailnet; (4) **el acceso administrativo se ata a una identidad, no a una contraseña**: la llave pública del PC se instaló en `~javier/.ssh/authorized_keys` (600, idempotente) y el acceso es `ssh -i`, no con clave de usuario; (5) **el servidor es una LAPTOP (Acer Aspire V5-121, 3,5 GB de RAM, 2 nucleos): servidor, base y respaldos son UN SOLO punto de falla** |

| 115 | 🔴 **La suite completa tiene una INTERMITENCIA PREEXISTENTE: cada corrida deja entre 0 y 9 fallos y cambian de archivo.** Los 146 archivos de test comparten UN solo `data/test.sqlite`, y `tests/setup.js` corre `migrate()` sobre esa base **en cada proceso** | `sgsst-electron-app/firma-service/tests/setup.js`, `data/test.sqlite` | Un rojo que aparece en la suite completa **no es regresión hasta que se descarta**: (1) corré la suite **sin** el archivo nuevo (o contra `HEAD` limpio) — si también falla, no es tuyo; (2) corré el archivo que falló **aislado** — pasa **100 %**; (3) compará **la lista de archivos** que fallan entre corridas, no el número: si cambia de archivo, es la intermitencia. Medido el 6-nov-2026: **2 166 tests · 2 163 pass · 1 fail · 2 skipped**; el que falla es `§6.2: el rechazo ocurre dentro del timeout (no hang)`. **Y sigue valiendo la regla de §7.8: nunca dos procesos de test al tiempo** |
| 116 | 🔴 **El servidor de producción es una LAPTOP: si está apagada, no hay respaldo diario ni health-check.** El cron del respaldo (22:00) solo corrió el 1-nov y el 3-nov | `kair-server` (`/etc/cron.d/kair-firma-backup`, `cron.service`), `sgsst-electron-app/firma-service/deploy/health-check.sh` | Es el **punto único de falla** y no se ve desde el código. `cron.service` se reinició el 6-nov-2026 a las 08:59 (la máquina se apagó); el health-check sí corre porque está **cada 5 minutos** y sobrevive al reinicio. **Un respaldo que depende de que la máquina esté encendida no es un respaldo diario**, y su RPO no es el que dice el documento. Reglas: (1) **una periodicidad no es una garantía si el host se apaga**: la evidencia del respaldo se mira en el **servidor**, no en el cron; (2) el respaldo **off-site** (que hoy falta: `rclone` sin configurar) es lo que rompe esa dependencia, no un cron más fino; (3) al reportar, decir **cuándo corrió el último respaldo de verdad**, no que el cron está instalado |
| 117 | 🔴 **Lo que el código desplegado hace NO se puede leer sin `sudo`: la llave interna y la de administración son `0600 kairfirma`, y `/opt/kair-firma/app` es `750 kairfirma`** | `kair-server` (`/opt/kair-firma/app`, las llaves del `firma-service`), `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` | El usuario de SSH (`javier`) **no puede** leer ni las llaves ni el código que está corriendo, y `sudo` **no** tiene contraseña por ssh: hay que entrar por Cockpit. **Un diagnóstico a medias se convierte en una afirmación**: si no se pudo leer el archivo, el resultado es «no medido», no «no pasa». Antes de afirmar qué versión corre el servidor, **medí el hash del archivo en disco** (trampa 56) o usá una ruta que solo exista en el código nuevo (trampa 47): el `version` del `/health` es fijo y no prueba nada |
| 118 | 🔴 **Una purga que mira una extensión no limpia lo que el script ANTERIOR dejó con otra.** El script viejo escribía `.sqlite` y `.tar.gz` en claro; el nuevo solo escribe `.enc`, y tanto su poda como la purga solo miran los `.enc` | `sgsst-electron-app/firma-service/deploy/backup-firma.sh` (poda: `find "$BACKUPS" -name 'firma-*.sqlite.enc' ...`), `deploy/purgar-respaldos.sh` (recorre `firma-*.sqlite.enc` y `storage-*.tar.gz.enc`), `/opt/kair-firma/backups/` | En el servidor quedaron **46 respaldos EN CLARO** (33 `.sqlite` sin `.enc`, más sus `-wal`/`-shm`, más 12 `storage-*.tar.gz`) y **cero cifrados**: los de la **primera** categoría **no se borran nunca solos**, porque ni la poda ni la purga los miran. Reglas: (1) **una purga se define por lo que CONSERVA, no por el patrón que borra** (trampa 109): el conjunto que se mira tiene que ser el que dejaron **todos** los scripts, no solo el actual; (2) **cifrar no es renombrar**: un respaldo en claro al que se le pone `.enc` encima **no** está cifrado; (3) **el cifrado se verifica**: se descifra y se corre `PRAGMA integrity_check` **antes** de borrar el original — lo que no se verifica **se deja como está y se reporta**, nunca se borra a ciegas; (4) lo que está en claro contradice lo que el Anexo de Nube promete: es una **afirmación pública falsa**, no un detalle de operación |

| 119 | 🔴 **El revert de un deploy NO puede heredar la lista de archivos de una corrida anterior: si la hereda, puede borrar de producción lo que esa corrida instaló** | El script de deploy (`$WORK/nuevos.txt`, el directorio de trabajo `/tmp/kair-deploy-work`) | El rollback lee la lista de archivos **nuevos** (los que el paquete agrego y que no existían) para borrarlos si la corrida falla. Esa lista **queda en el disco** entre corridas: si una corrida anterior instaló archivos nuevos y esta falla **antes** de rehacerla, el revert borra de producción archivos que la corrida anterior había instalado **correctamente**. Medido el 6-nov-2026: la lista estaba **vacía** (0 archivos), así que **no se borró nada** y la app desplegada quedó intacta — el defecto estaba, la suerte no. Reglas: (1) **la lista del rollback pertenece a la corrida que la hizo**: se limpia al arrancar el script, no se hereda; (2) **un revert tiene que decir qué borró**: si dice "borrados los archivos nuevos del paquete" y no dice cuántos, no hay evidencia de nada; (3) **antes de un deploy se mira el estado real del servidor** (qué hay en `$BASE/app`), no se asume que quedó como estaba; (4) **el hash del archivo desplegado es la prueba del deploy**, no el mensaje de "despliegue completo" |
| 120 | 🔴 **Una comprobación que lee de un endpoint que NO expone el campo falla en falso, y el servicio falso de los tests la deja pasar** | `sgsst-electron-app/firma-service/src/routes/signRequest.js` (`GET /internal/sign-requests/:id`, líneas 469-487), `sgsst-electron-app/firma-service/src/services/publicFlow.js` (`migrarAVersionVigente`, línea 362), `scripts/probar-10-4.js` | El endpoint devuelve `agreement_version` pero **no** `agreement_hash`: la herramienta de la 10.4 lo leía de ahí, obtenía vacío y **fallaba en falso** dos comprobaciones, cuando el servicio **sí** escribía la huella en la fila y la fila en la base la tenía (esa comprobación, en el mismo script, salía bien). El servicio falso de los tests **sí** devolvía el campo, así que la suite entera en verde no lo delataba. Reglas: (1) **antes de creerle a una falla, se comprueba que la fuente tiene el dato**: un valor vacío puede ser un dato que no viaja; (2) **el servicio falso tiene que reproducir la API real, incluida la ausencia de campos**: si el test devuelve un campo que el endpoint no devuelve, el test miente; (3) **se reverte el fix para comprobar que el test lo atrapa**: acá, sin el fix, **fallan 7 pruebas de 20**; (4) **un endpoint que no expone un campo que su cliente necesita se anota como decisión del owner**, no se colorea de paso en el fix de una herramienta |
| 121 | 🔴 **El respaldo diario y la poda solo miran `*.enc`: un respaldo en claro hecho a mano no lo recoge NINGÚNO de los dos** | `sgsst-electron-app/firma-service/deploy/backup-firma.sh` (poda: `find "$BACKUPS" -name 'firma-*.sqlite.enc' ...`), `deploy/purgar-respaldos.sh` (recorre `firma-*.sqlite.enc` y `storage-*.tar.gz.enc`), el paso 15 del script de deploy (mira `$BACKUPS/firma-*.sqlite`) | Continuación de la trampa 118, medida el 6-nov-2026: después de cifrar los 46 respaldos en claro del script viejo, **quedó uno** —`manual-pre-994-2026-11-03-1749.sqlite`, 512 KB, copiado a mano el 3-nov— porque **el paso 15 del deploy también miraba `firma-*.sqlite`**, no cualquier `.sqlite`. Reglas: (1) **un patrón de nombre no es "todos"**: `firma-*` no cubre una copia que se llama `manual-*`; (2) **el que busca tiene que ser el mismo conjunto que dejaron todos los scripts**, no el del script actual (trampa 109); (3) **al cifrar un respaldo se DESCIFRA y se comprueba que abre (`PRAGMA integrity_check`) ANTES de borrar el original** — lo que no verifica se deja y se reporta; (4) **el respaldo diario ahora avisa** de cualquier `.sqlite`/`.tar.gz` en claro que no sea `.enc`, sin cifrar ni borrar nada: avisar es seguro, cifrar a ciegas no |
| 122 | 🟡 **El puente que sirve el paquete del deploy y recoge su log es una tarea en background: tiene tope de una hora y muere solo** | `%TEMP%\kair-puente.js` (el puente), el tar del deploy (`%TEMP%\kair-deploy\kair-deploy.tar.gz`), el log del deploy (`%TEMP%\kair-deploy\deploy.txt`) | Medido el 6-nov-2026: la tarea en background que servía el puente **la mataron a las 16:30:52** por su tope de una hora, sin que nadie lo decidiera. El deploy depende de ella para dos cosas: el paquete que baja el servidor y el log que se recoge. Además, el deploy de las 16:23 falló con `curl: (23) Failure writing output to destination` **sin causa aislada** (el puente sí sirvió el archivo: `971421 B` en su log). Reglas: (1) **lo que el servidor necesita tiene que sobrevivir la sesión**: se lanza **desanclado** (`Start-Process`), no como tarea en background, y se comprueba que responde; (2) **el paquete tiene una copia local verificada en el servidor** (`/tmp/kair-paquete-*.tar.gz`) como red: si el puente no responde, el deploy usa esa y **verifica su hash igual**; (3) **cuando una falla no se aisló, se robustece en vez de inventar la causa**: tres reintentos, escritura atómica (`$TAR.parte` y `mv`) y un segundo origen; (4) **el log del deploy se recoge por HTTP**: si el puente muere, el deploy tiene que poder **terminar** sin que nadie lo esté mirando || 123 | 🔴 **El estado de un ítem del readiness es el MISMO en las dos compuertas: la compuerta solo FILTRA al final** | `sgsst-electron-app/firma-service/src/services/readinessLegal.js` (línea 1922: `items.filter((i) => i.bloquea.includes(gate))`), `sgsst-electron-app/firma-service/scripts/auditar-readiness-legal.js` | Medido el 6-nov-2026: el deploy solo mide la compuerta `publicacion`, y de ese reporte se veía que la de `primera_firma` (37 bloqueantes) nunca se había medido en el servidor. El reporte de una compuerta **mide los 40 ítems** y filtra al final: el estado de un ítem no depende de la compuerta consultada. Reglas: (1) **una compuerta no es una medida distinta**: antes de medirla, se lee **dónde** se usa `gate` en el código (acá: solo en el filtro final); (2) **el `bloquea` de cada ítem está en el código**: el texto del reporte marca con `*` los que bloquean la compuerta consultada; (3) **"el gate está verde" no es "no hay bloqueantes"**: había 3 pendientes que no bloqueaban la publicación y sí bloqueaban la primera firma |
| 124 | 🔴 **Una variable de entorno encendida se deduce del CONTEO DE AVISOS del reporte** | `sgsst-electron-app/firma-service/src/services/readinessLegal.js` (`anexo_nube::empresas_nube`, líneas 1704-1724: `exigirNube ? … : ESTADOS.AVISO`), `sgsst-electron-app/firma-service/src/config.js` (`exigirAnexoNube`) | Medido el 6-nov-2026: el servidor había medido `Avisos: 0` y la copia dio `Avisos: 1` **con el mismo código**. El único ítem que da aviso solo por tener apagada la compuerta `FIRMA_EXIGIR_ANEXO_NUBE` es `empresas_nube`, así que **la compuerta está encendida en producción** (y la base lo confirma: ASEPLUS con `anexo_nube_firmado_at = 2026-11-05T22:51:34.349Z`). Reglas: (1) **un agregado que difiere entre dos corridas del mismo código es el estado de una variable**, no ruido: se busca el ítem que explica la diferencia; (2) **un ítem que no bloquea ninguna compuerta igual informa** (aquí `bloquea: []` y sin embargo movió el conteo); (3) **la deduceción se confirma con la fuente** que sí se puede leer (la fila de la base), no ajustando la configuración para que la medición cuadre |
| 125 | 🔴 **Copiar la base de producción a ojo mide una base que puede no ser la de producción** | `sqlite3 -readonly … ".backup …"` (la copia consistente), `sgsst-electron-app/firma-service/src/db/connection.js` (WAL) | Medido el 6-nov-2026: para medir la compuerta `primera_firma` sin `sudo` (`/opt/kair-firma/app` es `750 kairfirma` y el `.env` `0600 kairfirma`) se copió la base viva. Reglas: (1) **la copia se hace con `sqlite3 .backup`**, no copiando el archivo: con el servicio corriendo y el WAL activo, el archivo principal puede no reflejar lo último; (2) **en `-readonly`**, para no poder escribir en la base de producción, y **verificada por huella** al traerla; (3) **la medición se valida contra un número ya medido en el servidor**: tiene que reproducirlo EXACTO, y si no reproduce, no se reporta nada del resto; (4) **la copia en claro se borra al terminar**, en el PC y en el servidor: el motivo de copiarla es medir una vez |
| 126 | 🔴 **Un `UPDATE` con el MISMO número de `?` no avisa si los argumentos están en el orden equivocado: la sentencia no actualiza nada y no falla** | `sgsst-electron-app/firma-service/src/services/anexoEncargo.js` (el `UPDATE` de la suscripción y el de la contrafirma), `src/db/connection.js` (`better-sqlite3`) | Caso real (7-nov-2026): al escribir la evidencia de la contrafirma, los argumentos del `UPDATE` quedaron en otro orden que los `?` de la sentencia. Con el **mismo número** de `?`, `better-sqlite3` **no avisa**: la sentencia se ejecuta, **no actualiza ninguna fila y no lanza error**. La suscripción quedaba sin la huella de su acta y el test daba verde. Reglas: (1) **el orden de los argumentos es el de los signos de interrogación, uno por uno**, y cada `?` va en la posición de su valor: con un `?` de más o de menos el motor avisa, con el mismo número no; (2) **un `UPDATE` que no falla no es un `UPDATE` que funcionó**: un test que no lee la fila después de escribir no lo detecta, y el detalle del `UPDATE` queda anotado en el código; (3) el `?` se escribe pegado a la columna que le corresponde, no al final por costumbre; (4) cuando el mismo `UPDATE` se arma en dos sitios (la fase 1 y la contrafirma), cada uno tiene su propia lista: copiar el `SET` del primero al segundo sin revisar el orden es justo como se cuela el bug |
| 127 | 🔴 **`assert.rejects` NO consulta el validador si la función lanza de forma SÍNCRONA: el callback tiene que ser `async`** | `sgsst-electron-app/firma-service/tests/anexo-encargo-ajustes.test.js`, `node:test` | Caso real (7-nov-2026): un test de la contrafirma fallaba siempre con el código de error equivocado, y el código estaba bien. La causa era del test: `assert.rejects(fn, validador)` **recibe el error de la promesa**, y si `fn` **lanza de forma síncrona** (antes de devolver la promesa), ese error escapa del `assert` y el validador **nunca se ejecuta**. El mensaje que se veía era el del error de verdad, leído como si fuera una discrepancia de código. Reglas: (1) **el callback del validador tiene que ser `async`** cuando la función puede lanzar antes de devolver la promesa, o el validador no se ejecuta nunca; (2) **un test que falla con el error que esperaba no es un test que probó el código**: hay que comprobar que el validador se ejecutó (que la aserción de adentro también); (3) la forma de comprobarlo es empírica, no de memoria: un `throw` síncrono dentro del validador rompe la prueba al revés; (4) cuando el mismo servicio se prueba por HTTP y por servicio, el helper de la aserción tiene que ser el mismo en los dos, o los dos mienten distinto |
| 128 | 🔴 **Un patrón que solo reconoce strings no puede escribir sobre `null`, y en un manifiesto los campos que faltan arrancan en `null`** | `sgsst-electron-app/firma-service/scripts/actualizar-manifiesto-anexo-encargo.js` (`ponerEnBloque`), `legal-readiness.json` (el bloque `anexo_encargo`) | Caso real (7-nov-2026): el script que escribe el estado del Anexo de Encargo en el manifiesto usaba un patrón que reconocía `"clave": "valor"` y nada más. En el manifiesto de verdad, `fecha` y `evidencia` están en **`null`** (todavía no hay un acto que las llene): el script fallaba al **escribir sobre el archivo real**, y `node --check` no lo delata porque la sintaxis está bien. Reglas: (1) **el patrón tiene que reconocer los dos estados del campo**: el que ya tiene valor y el que está vacío; (2) **un script que escribe sobre un archivo del repo se prueba sobre una COPIA**, nunca sobre el original (por eso el script acepta `--manifiesto`); (3) **el test escribe sobre los dos casos** —sobre `null` y sobre un string— porque el que faltaba es el que se encuentra en producción; (4) **el archivo que se edita con reemplazo literal tiene que seguir siendo JSON válido después**: el script lo reparsea y se niega si no lo es, y además comprueba que siga siendo ASCII puro |
| 129 | 🔴 **Un script que ejecuta su `main()` al importarse no se puede probar, y un `process.exit` en el importador se lleva la suite entera** | `sgsst-electron-app/firma-service/scripts/preflight-anexo-encargo.js` (antes: `main()` al final del archivo y `process.exit` dentro), los scripts del repo que sí usan `module.exports` | Caso real (7-nov-2026): el preflight del Anexo de Encargo ejecutaba su `main()` al ser importado y terminaba con `process.exit(...)` dentro: **importarlo en un test mataba el proceso de la suite**, y `require` del módulo no devolvía nada. Reglas: (1) **el `main()` se llama solo si el archivo es el que se está ejecutando** (`if (require.main === module)`), y el `module.exports` va al final; (2) **`main()` devuelve el código de salida** y quien lo ejecuta decide si llama a `process.exit`: así el test puede afirmar sobre el código sin morir; (3) **la salida es inyectable** (`fijarSalida`), para que un test no grabe cuatrocientas líneas en la consola; (4) **las rutas que el script mira son inyectables también** (`--manifiesto`, `--texto`, `--backup`): si no, no hay forma de probarlo sin tocar los archivos de verdad |
| 130 | 🔴 **Los tres documentos de cierre son de EOL MIXTO y la herramienta de edición los aplana: se parchean por bytes, nunca con un reemplazo de texto** | `Historial.md` (7 047 CRLF + 367 LF), `sgsst-electron-app/CONTEXT.md` (1 400 CR CR LF + 558 CRLF), `PROMPT.md` (LF puro) | Caso real (7-nov-2026): al corregir **una línea** de `Historial.md` con la herramienta de edición, las 367 líneas que estaban en LF pasaron a CRLF: el diff pasó de 107 inserciones a **475 inserciones y 368 borrados**, y el archivo dejó de tener la mezcla que el repo guarda. Se reparó con `git checkout --` y re-aplicando el parche con un script que hace **splice de texto** (sin `split('\n')` + `join`), porque un split/join destruye los CR CR LF (trampa 104). Reglas: (1) **`Historial.md`, `PROMPT.md` y `CONTEXT.md` se cierran SIEMPRE en la misma tanda**, y son los archivos que más se editan: el riesgo es diario, no excepcional; (2) **la herramienta de edición no se usa en un archivo mixto**: se hace `git checkout --` y un script con splice de texto; (3) **el texto nuevo se arma con el separador del ANCLA** (se leen los bytes de la línea del ancla y de la anterior antes de escribir), no con el del archivo entero; (4) **después se verifica con `git diff --numstat`**: si aparecen borrados donde no había ninguno, el EOL se aplanó y hay que volver atrás; (5) **el EOL se mide con los bytes crudos** (trampa 104): un contador ingenuo de "\r\n" cuenta igual los "\r\r\n" |
| 131 | 🔴 **En el navegador `self` es `window`: un `self.` sin declarar dentro de un método de prototipo resuelve a `window.algo` y es `undefined` — y si el error cae dentro de un `async` sin `await`, queda como un rechazo sin capturar y la pantalla se queda en "Cargando…" para siempre** | `sgsst-electron-app/modules/gestion-humana/firma-operador/index.js` (`_htmlSuscripcionEncargo`, `_htmlSuscripcionNube`), `main/test-anexos-1041.js` | Caso real (7-nov-2026): el detalle de una empresa en el panel de los anexos no cargaba nunca. `_htmlSuscripcionEncargo` y `_htmlSuscripcionNube` usaban `self._htmlEventos(...)` sin declarar `var self = this;` en esos dos métodos: en el navegador **`self` es el global `window`**, así que la llamada era `window._htmlEventos` y reventaba con "is not a function". Como el fallo pasaba dentro de un `async` sin `await`, nadie lo veía: **el modal se quedaba en "Cargando…"**. Reglas: (1) **`self` en un método de prototipo se declara o no se usa**: el patrón del repo es `var self = this;` al principio de cada método; (2) **un test que solo lee el archivo no ejecuta nada**: los tests de 📦1038 eran aserciones estáticas sobre strings y ninguno pintaba el render, por eso el bug llegó a producción; una vista se prueba **ejecutándola** (el `require` del módulo con un `window` mínimo alcanza para lo que no toca el DOM); (3) **el guard tiene que morder**: revirtiendo el fix, el suite pasó de 6 verdes a 4 rojos, y eso es lo que prueba que el testea; (4) **un `async` sin `await` que revienta es un error mudo**: los rechazos sin capturar no se ven en la consola del renderer, así que hay que atraparlos a mano para verlos |
| 132 | 🔴 **El `.env` que lee el service NO está donde el código lo busca: `src/config.js` apunta a `app/.env` y el archivo real vive en `/opt/kair-firma/.env`** | `sgsst-electron-app/firma-service/src/config.js:8`, `sgsst-electron-app/firma-service/scripts/*.js` (preflight, manifiesto, auditoría) | Caso real (7-nov-2026): `src/config.js:8` hace `require('dotenv').config({ path: path.join(__dirname, '..', '.env') })`, o sea `/opt/kair-firma/app/.env` — **ese archivo no existe**; el real es `/opt/kair-firma/.env` (600, `kairfirma`). Sin variables, dos fallos distintos y ambos engañosos: (1) los scripts **abortar con `Variable de entorno requerida: INTERNAL_API_KEY`**; (2) el preflight **lee una base vacía** y por eso reporta `Empresas activas: 0`, `Actas: (sin carpeta)`, `Respaldo: (sin script)` — **eso no es la realidad del servidor, es un artefacto de no haber cargado el entorno**, y es lo que hace creer que no hay datos ni respaldo. Reglas: (1) **en el servidor, todo script se corre con el entorno explícito**: `sudo bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && node scripts/…'`; (2) **un preflight que reporte ceros es un preflight sin entorno**, se corrige el comando y no la base; (3) **el preflight corre como root**: `kairfirma` recibe `EACCES` al leer `/opt/kair-firma/backup-firma.sh` (root-only, y el cron lo corre como root); (4) **el `.env` nunca se imprime, ni parcial ni con `grep`** |
| 133 | 🔴 **Una captura de baja resolución no es evidencia: el archivo y su huella sí** | `sgsst-electron-app/firma-service/src/services/mailer.js`, `Historial.md`, `sgsst-electron-app/CONTEXT.md` | Caso real (7-nov-2026): se reportó que `/opt/kair-firma/app/src/services/mailer.js` **no era el del repo** — una captura de Outlook a 7 px de alto dejó leer "Gestionar S.A.S." y una frase rota "la empresa no habilitada para el solo", y el nombre del archivo salía deformado. **Era una mala lectura de la imagen.** El `sha256sum` del servidor da `db0385400ac1218b2fae7713073934a34b8c6818c91f6384b9a1d14413d9f0fb`, **idéntico al repo**, y los `grep` de "Gestionar S.A.S." y "habilitada para el solo" **no devuelven nada**. Reglas: (1) **antes de afirmar que un archivo del servidor difiere del repo, se compara la huella**: `sha256sum` en el servidor contra el SHA-256 local; (2) **el texto se lee del archivo, no de un pantallazo**: una captura es un indicio, el `grep` es la prueba; (3) **un hallazgo de "código ajeno en producción" se desdice con una huella, no con un argumento**; (4) **el nombre vigente es "Gesstiar S.A.S.", con doble `s`** — el de una sola `s` (`Gestiar S.A.S.`) es un error de lectura, no una variante |
| 134 | 🔴 **Contrafirmar no habilita: lo que habilita a la Empresa es el manifiesto, y es lo que lee la compuerta** | `sgsst-electron-app/firma-service/scripts/actualizar-manifiesto-anexo-encargo.js`, `sgsst-electron-app/firma-service/legal-readiness.json`, `sgsst-electron-app/firma-service/src/services/readinessLegal.js` | Caso real (7-nov-2026): al cerrar el piloto de ASEPLUS, la contrafirma dejó `anexo_encargo_firmado_at` escrito y la vista de la propia Empresa mostró `anexo_encargo.estado = "ejecutado"` y `habilitacion.ok = true`, pero **la compuerta (`primera_firma`) seguía marcando el Anexo como pendiente** porque lee `legal-readiness.json`, no la base: el manifiesto seguía en `no_firmado`. Reglas: (1) **la contrafirma es el acto; el manifiesto es el estado**: cerrar el piloto son **dos** pasos, contrafirmar y escribir el manifiesto; (2) **`actualizar-manifiesto-anexo-encargo.js` se niega a escribir "firmado" sin contrafirma** — es la red que impide declarar firmado lo que no lo está; (3) **el manifiesto se replica en el repo y se verifica por SHA-256 contra el del servidor**: si el repo y el servidor no coinciden, el próximo deploy **resucita el `no_firmado`** y la compuerta retrocede; (4) **la huella del manifiesto es parte del entregable**: `f31bdae3084cfdf3c983dc18c909312bbef77764d988b48e38647fb416760ae9` en los dos lados al 7-nov-2026 |
| 135 | 🔴 **El deploy deja `app/` en 750: corrido como usuario normal, un verificador de huellas no ve NADA, y `sha256sum` devuelve vacío — no "no existe"** | `sgsst-electron-app/firma-service/deploy/` (el paso 2b del script de despliegue), el servidor `kair-server` (`/opt/kair-firma/app`, `/opt/kair-firma/legal`) | Caso real (7-nov-2026): el verificador de huellas contra HEAD reportó "16 archivos difieren (en disco: no existe)" para `app/src/server.js`, `legal/*.html` y el resto, cuando los 16 estaban en su sitio y eran idénticos al repo. La causa NO era un despliegue roto: el deploy normaliza los permisos y deja `/opt/kair-firma/app` y `/opt/kair-firma/legal` en **750 con dueño `kairfirma`** (el `chown` + el `chmod 750` del paso 2b), así que un usuario que no esté en ese grupo **no puede entrar** y `sha256sum` no imprime nada. Un "no existe" y un "no tengo permiso" se ven igual cuando no se distingue la salida vacía. Reglas: (1) **el verificador de huellas corre como root** (`sudo bash …`), igual que el deploy; (2) **el verificador comprueba PRIMERO que puede leer** y, si no, dice "sin permiso de lectura" y sale con código 2, en vez de reportar 16 archivos faltantes; (3) **"todos los archivos difieren" es la señal de un problema de permisos, no de un despliegue a medias**: un archivo que falta falla uno, no todos; (4) **un `sha256sum` que no imprime nada no es un hash**: hay que mirar el código de salida y el error, no asumir que el archivo no está; (5) **el paso 2b del deploy es el que deja esa barrera**: es correcta (el service corre como `kairfirma`), pero los scripts de verificación tienen que contar con ella |
| 136 | 🔴 **Un texto que nombra una versión CONCRETA se vuelve vieja sin que nadie se avise: la versión sale del dato, nunca escrita a mano** | `sgsst-electron-app/firma-service/src/services/readinessLegal.js` (la `accion` del item de Google), `sgsst-electron-app/firma-service/tests/readiness-legal.test.js` | Caso real (7-nov-2026): la acción del único pendiente del gate (`primera_firma`) decía, textualmente, "La v1.2 del Acuerdo es la que sostiene ese régimen; hasta que el abogado la apruebe, la primera firma queda bloqueada". La v1.2 **ya no era candidata**: la superaron la v1.3, la v1.4 y la v1.5, y su texto ni siquiera estaba en el repo (está en el `.gitignore`, a la espera del abogado). El gate mandaba a buscar la aprobación de una versión muerta y, de paso, contradecía al manifiesto, que ya declaraba la determinación del papel de Google por operación (punto J6 del abogado, 30-oct-2026). El test lo **congelaba**: `assert.ok(/v1\.2/.test(item.accion))` — el mismo patrón que se corrigió en el 📦1045. Reglas: (1) **la versión sale del manifiesto**: `versionAcuerdo` la deriva de `datos.acuerdo.version` y, si el manifiesto no la declara, del nombre del archivo; cuando el owner publique la v1.6, el texto la nombra solo; (2) **un test que congela una versión congela el error**: la aserción compara contra lo que declara el manifiesto, no contra una cadena fija; (3) **una acción que dice "hasta que X la apruebe" se envejece con X**: lo que se puede afirmar es lo que YA está hecho y lo que falta, no el estado de una versión por aprobar; (4) **el texto de un gate es una instrucción**: si manda a hacer algo que ya no existe, es un bloqueo sin nombre |
| 137 | 🔴 **El estado "firmado" se contrasta contra el TEXTO, no contra la fecha: una firma de otra versión es un verde falso** | `sgsst-electron-app/firma-service/src/services/readinessLegal.js` (`firmadoOk`, `encargoFirmadoOk`), `sgsst-electron-app/firma-service/legal-readiness.json` (los bloques `anexo_nube` y `anexo_encargo`), `sgsst-electron-app/firma-service/scripts/preflight-anexo-nube.js` (`con_anexo_nube_vigente`) | Caso real (9-nov-2026), hallazgo 3.3 del plan de cierre del punto 2: `firmadoOk` exigía `firmado`, fecha, versión, hash y evidencia, pero **no comparaba la suscripción con el texto vigente**; y `empresas_nube` contaba empresas con `anexo_nube_firmado_at` sin mirar **qué** texto habían suscrito. Al publicar la v1.2 del Anexo de Nube, el gate habría seguido diciendo "Anexo de Nube firmado" citando la suscripción de la v1.1, y la preflight (que sí lo hacía bien) habría dado verde por otro lado. Reglas: (1) **la suscripción se compara contra (versión, huella) del texto vigente**, no contra la fecha: la fecha dice cuándo, la huella dice **qué**; (2) **el recuento de empresas usa la huella**, igual que la preflight (`con_anexo_nube_vigente`); (3) **el mismo criterio para el Anexo de Encargo**: el manifiesto declara la huella del archivo que el servidor lee, y una firma de otra versión no describe ese texto; (4) **el detalle dice el motivo real** ("la suscripción es de la v1.1 y el texto vigente es la v1.2"), no "falta el Anexo firmado": son dos hechos distintos y la Empresa tiene que hacer uno solo; (5) **la suscripción anterior no se borra**: queda en `versiones_firmadas`, con su fecha, su huella y su evidencia |
| 138 | 🔴 **Un control que mira una RUTA escrita a mano analiza un documento que el servicio no firma** | `sgsst-electron-app/firma-service/src/services/readinessLegal.js` (`RUTAS_DEFAULT.anexoNube`), `sgsst-electron-app/firma-service/src/services/anexoNube.js` (`VERSION_MODELO`, `RUTA_MODELO`), `sgsst-electron-app/firma-service/scripts/preflight-anexo-nube.js` | Caso real (9-nov-2026): `RUTAS_DEFAULT.anexoNube` apuntaba a `legal/anexo-nube-v1.1.html` con la ruta **escrita a mano**, mientras el módulo que suscribe (`services/anexoNube.js`) firma el archivo de `VERSION_MODELO`. Al publicar la v1.2, el gate habría analizado la v1.1 y la preflight habría verificado un texto que el servicio no firma: los dos controles hablarían de textos distintos y ninguno se habría enterado. Reglas: (1) **la ruta sale del módulo que suscribe** (`anexoNube.RUTA_MODELO`), no de una constante: una versión escrita a mano en dos sitios se desalinea en cuanto se publica una nueva; (2) **antes de importar, se mira si hay círculo**: en este caso `anexoNube.js` no requiere `readinessLegal.js` (solo `routes/admin.js` lo hace), y esa comprobación se hace con `grep`, no por intuición; (3) **la preflight usa la misma ruta que el servicio**: si cada control mira un archivo distinto, no hay dos compuertas sino dos opinóones; (4) el test que ata el acoplamiento (`manifiesto · el Anexo de Nube que declara es el que el servicio suscribe`) compara **el nombre del archivo** contra `VERSION_MODELO`, no contra una versión escrita a mano |
| 139 | 🔴 **Un ítem que ya no aplica NO se marca "ok": `no_aplica` no es "cumplido"** | `sgsst-electron-app/firma-service/src/services/readinessLegal.js` (el ítem legado `google_dpa`), `sgsst-electron-app/firma-service/legal-readiness.json` (`subencargados.google`) | Caso real (9-nov-2026): al sustituir la cuenta de Gmail de consumo por Google Workspace con CDPA, el ítem `google_dpa` (el vínculo con Google **bajo la cuenta de consumo**) quedó sin objeto. Las dos salidas fáciles eran malas: marcarlo `ok` es un **verde falso** (dice "cumplido" de algo que nadie midió, y además lo que sigue vigente es otro ítem), y dejarlo pendiente es un **bloqueo permanente sin salida** (nadie puede cumplir un requisito que ya no aplica). Reglas: (1) **`no_aplica` con el detalle que dice qué lo sustituye**: "No aplica al estado anterior: la cuenta de consumo se sustituyó por Google Workspace con DPA. Ver mail_provider_dpa"; (2) **`no_aplica` no bloquea ni cuenta como pendiente**: el `gate` filtra por `estado !== OK && estado !== no_aplica`; (3) **el ítem nuevo es el que mide**: el que se declara vigente es el que tiene el dato y la evidencia; (4) **`ok` significa "se verificó", no "ya no importa"**: los dos se confundieron en un solo campo y por eso hacen falta dos; (5) el bloque viejo del manifiesto se conserva con `estado: "sustituido"` y `sustituido_por`, como historia: no se borra un dato que alguien relleno para mal |
| 140 | 🔴 **Un documento vigente puede ENLAZAR internamente a un texto histórico: los enlaces son parte del contrato** | `sgsst-electron-app/legal/anexo-encargo.html` (los enlaces del §1 y del §9), `sgsst-electron-app/legal/anexo-nube-v1.2.html` | Caso real (9-nov-2026), punto 3 del plan de cierre: el Anexo de Encargo 2026-11-09 decía en su §5 "Anexo de Nube, versión 1.2" con el enlace correcto, pero en el §1 (la definición de Encargado) y en el §9 (el servicio en la nube) el `href` apuntaba a `anexo-nube-v1.1.html`: la versión histórica. El lector del contrato vigente terminaba en un texto que ya no era el vigente, y el manifiesto declaraba la huella del documento equivocado. Reglas: (1) al publicar una versión nueva se revisan los enlaces INTERNOS de todos los documentos vigentes, no solo su prosa: `grep -n 'href="anexo-' legal/ sitio/`; (2) un enlace a una versión anterior no es neutro, es una remisión contractual a un texto histórico; (3) corregir un enlace **cambia la huella del documento**: el manifiesto se recalcula con su script y toda huella citada fuera de él (plan, informe, mensaje) queda obsoleta; (4) un texto **ya suscrito** no se corrige jamás: su huella es la que firmó la parte y sus enlaces describen el estado de aquel momento |
| 141 | 🔴 **Un escaneo de secretos que no distingue una huella SHA-256 de un token produce un falso positivo por cada hash** | `%TEMP%\kair-escaneo-secretos-1047.js`, `%TEMP%\kair-escaneo-historial2.js` | Caso real (9-nov-2026), Fase 0 del punto 3: el escaneo del paquete 📦1047 marcó 46 coincidencias de `[a-z0-9]{32}` y todas eran las MITADES de hashes SHA-256 de 64 hexes, que son las huellas legítimas del repo. Y el patrón de la app password de Google (cuatro palabras de cuatro letras) matcheó frases del castellano ("cada HTML sean byte", "solo esta capa deja"). Un escaneo que no distingue lo que el repo hace de lo que se busca produce un informe que nadie puede usar y que entrena al(owner a ignorar la herramienta. Reglas: (1) se excluyen explícitamente los hashes de 64 hex y los marcadores de plantilla (`cambiar`, `pegar`, `generar`); (2) los patrones flojos se acotan y los hallazgos se revisan uno por uno antes de declarar limpio; (3) el escaneo mira el CONTENIDO COMPLETO de los archivos nuevos, no solo el diff: un archivo nuevo no aparece en el diff |
| 142 | 🔴 **El historial de Git se escanea con `cat-file --batch` POR LOTES: 25 000 blobs de una vez revientan el búfer y el proceso muere sin decir nada** | `%TEMP%\kair-escaneo-historial2.js` | Caso real (9-nov-2026): con `git rev-list --objects --all --filter=blob:none` el listado trae los nombres pero los blobs NO están en local: `git cat-file` responde "bad file" por cada uno. Y sin filtro, un solo `git cat-file --batch` con los 25 105 blobs del repo revienta el `maxBuffer` y `spawnSync` vuelve con el estado 3 sin stderr. Reglas: (1) sin el filtro de blobs: `git rev-list --objects --all`; (2) el volcado se pide por lotes de ~800 OIDs, cada uno en su propio proceso; (3) el parseo del formato `--batch` es `oid tipo tamaño\n` seguido de EXACTAMENTE `tamaño` bytes y un salto: si se calcula mal el desplazamiento, el resto del lote se lee como basura y el escaneo pasa sin mirar nada; (4) un escaneo que termina sin imprimir su conteo de blobs revisados no es un escaneo: es un fallo silencioso |
| 143 | 🔴 **Los documentos PÚBLICOS del sitio son parte del contrato: cambiar el enlace sin cambiar el texto deja el sitio PEOR** | `sitio/politica-firma.html`, `sitio/terminos.html`, `sitio/privacidad.html`, `sitio/index.html`, `sitio/autorizacion-trabajadores.html` | Caso real (9-nov-2026), punto 3 del plan de cierre: tras la Decisión A, el sitio público seguía diciendo "Google no actúa como encargado... no hay DPA empresarial aplicable" y "no se utiliza Google Workspace", mientras el Anexo de Nube v1.2 ya decía lo contrario. Cambiar solo el enlace del menú a la v1.2 habría dejado un texto falso con un enlace nuevo: peor que un sitio viejo coherente. Reglas: (1) la página pública afirma hechos que el expediente tiene que sostener: publicar "Google Workspace con CDPA" antes de que el CDPA esté aceptado (P1) y antes del envío real (P5) es una afirmación prematura; (2) corregir un documento público exige los HECHOS verificados (P1, P2, P5), no una decisión de redacción; (3) mientras tanto el texto público no se toca y la desalineación queda ESCRITA, con su dependencia y su responsable; (4) "publicar la v1.2 en `sitio/`" es poner el archivo ahí, byte a byte: no es reescribir los otros documentos |
| 144 | 🔴 **El manifiesto lo escriben DOS scripts y no se pueden pisar: el que publica el texto y el que lee la base** | `sgsst-electron-app/firma-service/scripts/actualizar-manifiesto-1047.js`, `sgsst-electron-app/firma-service/scripts/actualizar-manifiesto-anexo-nube.js` | Caso real (9-nov-2026): el script que publica el Anexo de Nube v1.2 reconstruía el bloque `anexo_nube` con `firmado: false` SIEMPRE, y el script nuevo que lee `gh_firma_anexo_nube_suscripciones` escribía el estado real desde la base. Correr el primero después del segundo BORRABA la firma: un verde falso, y el `firmado_nube` del gate volvía a pendiente sin que nadie hubiera tocado la base. Reglas: (1) el script que publica el TEXTO conserva la firma si describe el texto vigente (versión Y huella) y la mueve a `versiones_firmadas` si describe otro; (2) el script que lee la BASE es el único que declara una firma: nadie la escribe a mano; (3) los dos scripts se prueban en los DOS órdenes; (4) el `--check` de cualquiera de los dos LEE LA BASE: es la única forma de que un `firmado: true` escrito a mano se detecte |
| 145 | 🔴 **Un instrumento BILATERAL exige DOS actos: un gate que mide uno y declara "firmado" es un verde falso** | `sgsst-electron-app/firma-service/src/services/readinessLegal.js` (item `contrafirma_nube`), `sgsst-electron-app/firma-service/scripts/actualizar-manifiesto-anexo-nube.js` | Caso real (9-nov-2026), punto 3: el texto vigente del Anexo de Nube (v1.2, §10) dice que lo suscriben DOS partes — la Empresa y K+AIR — y que el instrumento solo queda EJECUTADO cuando los dos actos se han producido. El código solo registraba el primero, así que el manifiesto decía "firmado" y el gate daba el item `firmado_nube` en `ok` describiendo LA MITAD del instrumento. Reglas: (1) antes de dar por cumplido un instrumento, se lee su TEXTO y se cuentan los actos que exige; (2) cada acto se mide en su propio item del gate, con su propio detalle: "falta la suscripción" y "falta la contrafirma" son dos motivos y dos acciones; (3) el manifiesto declara los dos actos por separado (`firmado` y `contrafirmado`), nunca uno que se pueda leer como "el instrumento está"; (4) un texto firmado por dos partes que el sistema solo sabe registrar por una no puede instrumentarse: se implementa el segundo acto |
| 146 | 🔴 **Fallar CERRADO se decide POR PARTES: declarar "no suscrito" no depende del segundo acto, declarar "suscrito" sí** | `sgsst-electron-app/firma-service/scripts/actualizar-manifiesto-anexo-nube.js` (`puedeDeclararFirma`), `sgsst-electron-app/firma-service/src/services/readinessLegal.js` (`_resumenEmpresas`) | Caso real (9-nov-2026): al escribir el estado del Anexo de Nube, la migración 060 (la del segundo acto) puede no estar aplicada en la base de destino. Un "cerrado" a secas rompe el preflight y el `--check` en un servidor sano; un "abierto" declara una firma que nadie puede verificar. Reglas: (1) lo que NO depende del dato ausente se declara igual ("no hay suscripción del texto vigente" es un hecho que se ve sin las columnas de la contrafirma); (2) lo que SÍ depende, no se declara: si hay una suscripción del texto vigente y la base no tiene las columnas del segundo acto, el script NO escribe y sale con 3, diciendo qué migración falta; (3) la comprobación que decide se saca a una FUNCIÓN pura y se prueba sola (`puedeDeclararFirma`), porque una regla escondida en el cuerpo del script no se puede atestar; (4) lo mismo aplica a la columna de ejecución en la ficha: sin ella, el conteo de Empresas ejecutadas es CERO, no "todas" |
| 147 | 🔴 **La Empresa se habilita para firmar con el instrumento EJECUTADO, no con el primer acto: es el espejo del Anexo de Encargo** | `sgsst-electron-app/firma-service/src/services/empresa.js` (`verificarHabilitacionFirma`), `sgsst-electron-app/firma-service/src/services/readinessLegal.js` | Caso real (9-nov-2026): para el Anexo de Encargo, la habilitación ya exigía `anexo_encargo_firmado_at` — la fecha del SEGUNDO acto, la contrafirma — y no la de la suscripción: el abogado lo dijo textualmente ("la empresa no debería empezar a usar el servicio hasta que K+AIR firme la otra parte"). El Anexo de Nube quedó con la regla anterior (basta la suscripción), que era correcta cuando el texto no exigía contrafirma. Reglas: (1) cuando un instrumento se vuelve bilateral, se revisa TODO lo que dependía de él: la habilitación, el gate, el preflight, el manifiesto; (2) el identificador del pendiente puede conservar su nombre (`anexo_nube_firmado`) si su SIGNIFICADO pasa a ser "el instrumento no está ejecutado", como ya ocurre con el del Encargo; (3) la compuerta apagada no excuse la regla: la regla se escribe correcta y el encendido es otro acto; (4) el test que ata la habilitación se actualiza para sembrar los DOS actos, y su nombre dice "EJECUTADO", no "firmado" |
| 148 | 🔴 **Una NEGATIVA escrita en un comentario es una afirmación que caduca sola: cuando el instrumento cambia, hay que buscar el texto que dice lo que YA NO es** | `sgsst-electron-app/firma-service/src/routes/empresaAnexos.js`, `sgsst-electron-app/docs/gestion-humana/firma-electronica/API.md` (§6.22), `sgsst-electron-app/docs/gestion-humana/firma-electronica/FLOWS.md` (§13.4) | Caso real (9-nov-2026), punto 3: al hacer bilateral el Anexo de Nube quedaron TRES textos diciendo "el Anexo de Nube NO es bilateral" — un comentario en el servicio, la tabla comparativa de `FLOWS.md` y la nota de `API.md`. Eran verdad el día anterior y pasaron a ser mentira sin que nadie los tocara: un comentario no se actualiza solo, y un documento de API no se rederiva solo. El peor: el comentario estaba pegado a la función que devolvía el estado, y decía la razón de por qué ese estado era un `firmado` a secas. Reglas: (1) cuando cambia la NATURALEZA de un instrumento (de unilateral a bilateral), se busca el texto que afirma lo contrario y se corrige: `grep -rn "no es bilateral\|no tiene contrafirma\|no hay fase de" src/ docs/`; (2) el comentario de una función es parte de su contrato: si la función cambia de forma, el comentario cambia con ella; (3) una negativa es más peligrosa que una afirmación, porque nadie la relee buscando qué dejó de ser cierto; (4) en el API, la respuesta documentada y la que devuelve el código se comparan en la misma revisión, no en la siguiente |
| 149 | 🔴 **Un documento que promete una capacidad que el código NO tiene es un verde falso por la vía del papel: toda fila de API se contrasta contra el código antes de escribirla** | `sgsst-electron-app/docs/gestion-humana/firma-electronica/API.md` (§6.22.3), `sgsst-electron-app/main/firma-bridge.js`, `sgsst-electron-app/preload.js` | Caso real (9-nov-2026), punto 3: al documentar las dos rutas nuevas de contrafirma del Anexo de Nube se escribieron en la tabla de canales IPC dos filas (`firma:anexo:nube-contrafirma-codigo` y `firma:anexo:nube-contrafirmar`) **que nunca se escribieron en el bridge**: no hay handler, no hay método en el preload. La tabla decía trece canales y el título del apartado decía once — el título era el que cuadraba. El documento afirmaba una capacidad inexistente y nadie la notó porque el documento es texto y el código es código, y nadie los comparó. Reglas: (1) cada fila que nombre un canal IPC, un método del preload o un endpoint se contrasta contra el archivo que lo implementa ANTES de escribirla: `grep -n "handle('firma:" main/firma-bridge.js`; (2) el recuento del apartado tiene que cuadrar con las filas: un título que dice "once" sobre una tabla de trece es la pista de que sobran filas; (3) una capacidad que existe en el SERVICIO pero no en la APP se documenta como lo que es —"se hace por HTTP contra el servicio"— y no como un botón que el operador cree que tiene; (4) un botón que no tiene canal IPC no se pone: un botón que no hace nada es peor que un botón que no existe, porque el operador lo pulsa y no pasa nada |


| 150 | 🔴 **Un `*/` dentro de un comentario de bloque lo CIERRA: `node --check` pasa y el fallo aparece al IMPORTAR** | `sgsst-electron-app/shared/env-loader.js`, `sgsst-electron-app/main/test-email-env-931.js`, `sgsst-electron-app/main/_verificar-credenciales-build.js` | Caso real (10-nov-2026): la cabecera del cargador del `.env` traía el patrón de archivos `**/utils/**` **dentro de un comentario de bloque**. Ese `*/` cerró el comentario antes de tiempo y todo lo que venía después **se ejecutó como código** → `ReferenceError: utils is not defined` al importar el módulo, que mataba `utils/emailSender.js` y dejaba **muerto el botón "Enviar por correo"** en el instalador **y** en desarrollo. Lo caro: **`node --check` pasa** (el archivo es JavaScript válido) y **2 494 tests en verde** no lo cazaron, porque el test leía el archivo **como texto** y buscaba cadenas: afirmaba el texto correcto de un archivo que al cargarse reventaba. Reglas: (1) **dentro de un comentario de bloque no hay `*/`**: los patrones de archivos se describen con palabras ("la carpeta `utils/**`") o se parten; (2) **un test que lee el código como texto no prueba que el código funcione**: si el módulo se importa en runtime, el test lo **importa** (`require`) y afirma que no lanza — 2 checks: "el cargador SE CARGA" y "el sender SE CARGA"; (3) **el guard va en el build, no solo en el test**: `_verificar-credenciales-build.js` corta el build si el cargador no carga, porque el síntoma (un error de Gmail que no menciona K+AIR) lo ve el cliente final; (4) **un comentario no puede romper el archivo que documenta**: en el archivo que se carga, el comentario **es** código |
| 151 | 🔴 **El `.env` de la app VIAJA DENTRO del instalador: rotar las claves sin decidir dónde viven solo repite el incidente en 90 días** | `sgsst-electron-app/package.json` (`build.files`), `sgsst-electron-app/main/_verificar-credenciales-build.js`, `sgsst-electron-app/docs/gestion-humana/firma-electronica/rotacion-app-passwords-p11-2026-11-10.md` | Caso real (10-nov-2026), P11: `electron-builder` **no excluye** el `.env` de la app (a propósito: sin él el correo no funciona en el cliente), así que **las 5 app passwords de los 5 clientes viajan dentro del instalador**. Medido: hoy **cada equipo de cliente tiene las claves de los otros clientes**. Rotarlas sin cambiar el modelo de distribución **repite P11 completo**: el repo queda limpio, las claves nuevas vuelven a publicarse en el próximo build. Reglas: (1) **"el secreto no está en el repo" no es "el secreto no está en el cliente"**: el `.env` es el lugar correcto para los valores, y a la vez es el lugar donde se **distribuyen**; (2) **rotar sin decidir dónde viven las claves nuevas es media solución**: la decisión es (A) build por empresa, (B) relay en el servidor, (C) solo rotar; (3) **la guarda que evita la repetición es un escaneo que corta el build**: `main/detector-secretos.js` + `main/test-secretos-1047.js`, que nunca imprime el valor (solo archivo, línea y regla); (4) **un escaneo se calibra contra sus falsos positivos**: la prosa castellana tiene 16 letras en 4 palabras ("cada html sean byte"), así que la regla de texto libre exige delimitadores y una letra que no aparece en las palabras corrientes, y la regla precisa es la de **asignación** a un campo `password`/`secret`/`token`/`clave`/`contrasena` |
| 152 | 🔴 **Un script que DECLARA un estado pendiente puede BORRAR un cierre ya hecho** | `sgsst-electron-app/firma-service/scripts/actualizar-manifiesto-1047.js` (bloque `subencargados.mail_provider.aceptacion`) | Caso real (10-nov-2026): el regenerador del manifiesto reconstruía `mail_provider` con `aceptada: false`, así que si P1 se cerraba y después alguien corría el 1047, **el cierre se perdía sin aviso** y el gate volvía a decir "no listo" con un manifiesto que sí estaba cerrado. Reglas: (1) el `aceptada: false` que escribe un script es el **estado inicial**, no el vigente: un regenerador tiene que **conservar** los subbloques que otro script cierra (fix `aceptacionPrevia`; `tests/scripts/actualizar-manifiesto-1047.test.js` 4/4); (2) el dato legal no se escribe a mano sino desde un acta: `actualizar-manifiesto-aceptacion-cdpa.js` solo registra con evidencia real y **rechaza marcadores** (`PENDIENTE`, `por definir`, `[nombre del owner]`, exit 2) — una plantilla por completar nunca se registra como cumplida (39/39 tests); (3) el gate acompaña: `_aceptacionCdpaOk` exige modo + fecha + evidencia, un `aceptada: true` vacío ya no habilita el ítem (56/56 tests) |
| 153 | 🔴 **Un acta que dice QUIÉN firmó pero no CON QUÉ PODER es un acta a medias: tener un campo `actor` no es acreditar la facultad** | `sgsst-electron-app/firma-service/src/services/poderesEncargado.js`, `sgsst-electron-app/firma-service/src/services/anexoNube.js` (`contrafirmarAnexoNube`), `sgsst-electron-app/firma-service/src/services/anexoEncargo.js` (`contrafirmar`), `sgsst-electron-app/firma-service/src/db/schema/061_encargado_poderes.sql` | Caso real (10-nov-2026), P7: el abogado condicionó la contrafirma — «La ejecución por una persona distinta del representante legal de Gesstiar S.A.S. requerirá acreditar previamente la facultad de representación o poder suficiente, que deberá conservarse en el expediente» — y el código **no cumplía esa condición**: el segundo acto se cerraba con el nombre que llegaba en `X-Admin-Actor` y sin ninguna acreditación. El cotejo que sí existía era el del lado de la **Empresa** (`_cotejarFirmante`), y la grieta estaba del lado de **Gesstiar**: el acta declaraba quién firmó por K+AIR pero no con qué poder, y el gate no lo exigía. Reglas: (1) **una condición del abogado se implementa o se declara incumplida**: se contrasta su texto contra el código antes de dar por cerrado un punto — `grep -rn "contrafirmar\|X-Admin-Actor" src/services/`; (2) **un dato de identidad no es un dato de facultad**: para poder firmar por una empresa hay que probar el poder, y el poder se guarda (documento + huella + vigencia), no se deduce de un nombre; (3) **la comprobación es FALLA CERRADA**: sin tabla de poderes (migración sin aplicar) o sin actor declarado, la contrafirma se rechaza con 409 en vez de pasar; (4) **lo que se exige en el acto se exige también en el gate y en el manifiesto**: `contrafirma_nube` no puede quedar `ok` sin la acreditación (si no, el manifiesto dice "ejecutado" describiendo un acto sin poder); (5) **el mismo control se aplica a los dos instrumentos**: la contrafirma del Anexo de Encargo tenía exactamente la misma grieta, y arreglar solo una es dejar el hueco abierto en el gemelo |
| 154 | 🔴 **Un «NO DECLARADA» que miente es tan grave como un «FIRMADO» que miente: cuando se agrega un dato a una forma de lectura, hay que buscar las DOS formas** | `sgsst-electron-app/firma-service/src/routes/admin-empresas.js` (`_suscripcionEncargo`), `sgsst-electron-app/modules/gestion-humana/firma-operador/index.js` | Caso real (10-nov-2026), mismo paquete 📦1047: la línea «Facultad acreditada» del panel del operador se añadió a las DOS vistas (Anexo de Nube y Anexo de Encargo), pero la lectura `GET /internal/admin/empresas/:id/anexos` solo traía `contrafirma_evidencia` en la forma del **Nube**: en la del **Encargo** faltaba, así que el panel pintaba «NO DECLARADA» con la faculty **ya acreditada en el expediente**. Reglas: (1) **el falso negativo es el más caro de los dos**, porque nadie se queja de una falta que no existe: se la cree, y el trabajo se repite o se bloquea; (2) **la forma de lectura es una sola cosa compartida**: al agregar un campo hay que buscar todas las formas que la sirven (`_suscripcionEncargo`, `_suscripcionNube`, ...) y comprobar que las dos lo traen; (3) **la línea de la pantalla se prueba contra la forma de la API, no contra la pantalla**: un test que solo mira el código del panel pasa con un dato que la API nunca entrega; (4) **el gemelo también, en la lectura**: la misma regla del acta — el dato que se declara en un instrumento tiene que poder leerse en los dos. |
| 155 | 🔴 **Un clon "limpio" con la configuración del Git del sistema NO es el árbol del repo: `core.autocrlf` reescribe los bytes al hacer checkout** | `C:\Program Files\Git\etc\gitconfig` (`core.autocrlf = true`), el `.git/config` local del repo (`core.autocrlf = false`), todo clon de prueba de `firma-service` | Caso real (12-nov-2026), la corrida T1: el primer clon se hizo con `git clone` a secas y **no reproducía el árbol del owner**: materializó **2 697 de los 4 781 archivos versionados con CRLF**, cuando los blobs los tienen en LF (ejemplo medido: `PROMPT.md` con 2 024 CRLF y 288 835 B en el clon, contra 0 CRLF y 286 811 B en el owner). La suite daba verde en los dos, así que el defecto **no se veía en los tests**: se veía en las huellas y en el EOL. Reglas: (1) **un clon se hace con `-c core.autocrlf=false`**, porque el repo guarda bytes y su `core.autocrlf` local es `false` (trampa 130: el EOL de cada archivo está fijado por su test); (2) **`git reset --hard` NO reescribe los archivos que el índice ya da por buenos**: poner la opción después del `clone` no alcanza; hay que rehacer el clon con la opción de línea de comandos o forzar `git checkout-index -a -f`; (3) **"el clon dio verde" no es "el clon es el repo"**: antes de comparar nada, se compara el clon contra el árbol (hash por archivo o `git status --porcelain` idéntico) — la suite verde no lo detecta, porque a los tests les da igual el EOL; (4) **la comparación de un clon es de bytes, no de tests**: si lo que se quiere probar son huellas o separadores, hay que comparar los **bytes** de los archivos, no el resultado de una suite |
| 156 | 🔴 **Un runner que lanza la suite con `process.execPath` usa el Node con el que arrancó, no el que está primero en el `PATH`: `npm` sí sigue el `PATH`, `process.execPath` no** | `%TEMP%\kair-p8\runner-suite.js` (`spawnSync(process.execPath, ...)`), `sgsst-electron-app/firma-service/tests/setup.js:130` (el guardia que lanzo el mensaje) | Caso real (12-nov-2026), la corrida T1 sobre el commit `e4dd5f31`: el script que lanza el runner puso el Node 22 primero en el `PATH` y por eso `npm ci` compiló el `better-sqlite3` para el ABI 127; pero el runner se invocó con el `node` del sistema (v26, ABI 147) y el `process.execPath` de ese proceso **era** el v26. La suite abortó en 0 s con `[TEST SAFETY] No se pudieron aplicar las migraciones en la BD de tests`, un mensaje que parece de datos y no de runtime. Debajo estaba `NODE_MODULE_VERSION 127 ... This version of Node.js requires NODE_MODULE_VERSION 147`. Reglas: (1) **`npm` resuelve el Node por el `PATH`; `process.execPath` no**: en la misma corrida, la instalación y la ejecución pueden quedar en ABI distintos, y el `npm ci` verde no dice nada del runtime de la suite; (2) **un runner se invoca con la ruta absoluta del binario que se quiere usar**, no con el `node` suelto; (3) **"[TEST SAFETY] No se pudieron aplicar las migraciones" es un síntoma de runtime, no de datos**: hay que leer el error hasta el final antes de culpar a la base; (4) **cambiar el `PATH` después de arrancar no cambia el interprete de ese proceso**: el runtime de un proceso es el con el que arrancó |
| 157 | 🔴 **Un `.ps1` guardado SIN BOM lo lee PowerShell 5.1 como ANSI: las rutas con acentos se corrompen y el script falla aunque la ruta esté bien escrita** | `%TEMP%\kair-p8\*.ps1` (scripts de sesión), cualquier ruta con acentos (`C:\Proyectos Programación\...`), `Out-File -Encoding ascii` de PowerShell 5.1 | Caso real (12-nov-2026), la corrida de la suite de la tarde: el script de la corrida falló con `MODULE_NOT_FOUND` (`requireStack: []`) y el runner se quejó de «no se encontro ningun archivo de prueba», cuando **el mismo comando escrito en la línea de comandos funcionaba**. El archivo se había escrito en UTF-8 sin BOM y PowerShell 5.1 lo decodifica con la página de códigos del sistema: `Programación` quedó `Programaci?n`. Reglas: (1) un `.ps1` con rutas acentuadas se guarda **con BOM**; (2) o el script **no lleva rutas**: se resuelve todo con `process.cwd()` y rutas relativas; (3) **un comando que funciona en la línea de comandos y falla dentro del archivo es un problema de codificación, no de lógica**: se compara lo que el intérprete ve (`Get-Content`) con lo que dice el editor; (4) `Out-File -Encoding ascii` hace lo mismo (convierte la `ó` en `?`) y `-Encoding utf8` **escribe con BOM**, que es justamente lo que hay que evitar en los archivos de código del repo |
| 158 | 🔴 **Un test que se corre SIN el `--require ./tests/setup.js` usa la base de desarrollo, no la base de pruebas: el fallo parece un defecto del código y es una base equivocada** | `sgsst-electron-app/firma-service/tests/setup.js`, `tests/helpers.js` (`resetDb`), `src/db/connection.js` (la ruta de la base sale de `DB_PATH`) | Caso real (12-nov-2026), los tests del manifiesto: al correr `node --test` a mano, **39 de 64 fallaron** con `gh_solicitudes_titular_eventos is append-only: no se puede DELETE` (`SQLITE_CONSTRAINT_TRIGGER`). El runner oficial sí lleva `--require ./tests/setup.js`; sin él, la conexión abre `data/manual-8bc/firma.sqlite` (la de **desarrollo**), donde las migraciones append-only **no se omiten** y el `DELETE` de limpieza aborta. Reglas: (1) **un test se corre como lo corre el runner oficial**: `node --test --require ./tests/setup.js --test-concurrency=1`; (2) **un `SQLITE_CONSTRAINT_TRIGGER` en un trigger append-only, en un test que antes pasaba, es una base equivocada** hasta que se demuestre lo contrario; (3) la base de pruebas se regenera antes de la corrida (`node scripts/migrate-test.js`): un `DELETE` que aborta la deja sucia y **el siguiente `resetDb` también aborta**, así que el fallo se propaga a toda la suite; (4) el error de un trigger **no se "arregla" apagando el trigger**: el trigger es la garantía de que el rastro no se reescribe |
| 159 | 🔴 **Un pipe entre dos comandos nativos en PowerShell 5.1 PASA POR TEXTO: convierte los LF en CRLF y le mete un BOM, y la medición de un archivo da un resultado que no es el del archivo** | `%TEMP%\kair-p8\eol-count.js`, `git cat-file blob` medido a través de un pipe de PowerShell, cualquier `nativo \| nativo` de PowerShell 5.1 | Caso real (12-nov-2026), la ronda 15: al medir el EOL del blob **staged** contra el archivo del working tree —para confirmar que el índice no iba a aplanar el EOL mixto de `Historial.md` y de `CONTEXT.md`— la medición por pipe devolvió `crlf=9471, lf=0, bom=true` y **1 793 bytes de más**: el archivo del índice era **byte a byte igual** al del working tree (`crlf=7684, lf=1787, bom=false`, 825 978 B en los dos). Medido con `execFileSync` de Node, que lee bytes crudos, el mismo `git cat-file` dio el resultado correcto. Reglas: (1) **medir bytes es leer bytes**: un pipe de PowerShell entre dos procesos nativos **decodifica a texto y reescribe los finales de línea**, así que lo que sale de ahí **no es el archivo**; (2) **un BOM que aparece solo en la medición es la señal de que pasó por el pipe**, no de que el archivo tenga BOM; (3) **la medición byte a byte se hace con `execFileSync`** (o escribiendo a un archivo), nunca a través del pipe de la shell; (4) **un conteo que no cuadra se contrasta con un segundo método ANTES de tocar el archivo**: si el `git diff` del archivo está vacío y el índice dice que cambió, el que miente es el medidor, y "arreglar" el archivo para que cuadre la medición rompe un archivo que estaba bien |

| 160 | 🔴 **Un verificador que compara un bloque de varias líneas por su primera línea acepta una reescritura que pierde líneas: el documento queda mal formado y el guard en verde** | `sgsst-electron-app/firma-service/scripts/contar-estados-meta-apertura.js` (la frase de conciliación), `sgsst-electron-app/docs/gestion-humana/firma-electronica/meta-para-abrir-a-empresas-reales-2026-11-12.md` | Caso real (13-nov-2026), la ronda 16: el script que reescribe la frase de conciliación del mapa **comparaba el bloque por su primera línea** y lo reescribía entero. Cuando la frase pasó a ocupar **dos líneas** (para nombrar las 21 solicitudes y aclarar que *cerrado no es acto cumplido*), la reescritura **perdió la línea en blanco** que separaba la frase del `---` de abajo: el documento quedó con la frase pegada al separador, y el script **no se quejaba**, porque comparaba una línea con una línea y las dos coincidían. Reglas: (1) **un bloque se compara completo**: si lo que se reescribe ocupa más de una línea, el comparador compara el bloque entero y el reescritor escribe el bloque entero —uno por líneas y el otro por bloques se contradicen—; (2) **un verificador que reescribe tiene que ser idempotente**: correrlo dos veces tiene que dejar el mismo archivo, y el **mutante** (una copia a la que se le quita la línea en blanco) tiene que salir en rojo; (3) **un reescritor se prueba sobre una copia y el diff se mira a ojo**: un `git diff` que muestra una línea en blanco desaparecida es el defecto entero; (4) **cuando el texto comparado crece a más de una línea, el comparador y el reescritor se cambian juntos** |

| 161 | 🔴 **La huella que un documento declara es la del contenido: si el insumo cambia, la huella queda vieja y el documento que se envía pasa a mentir** | `sgsst-electron-app/docs/gestion-humana/firma-electronica/solicitudes-al-abogado-2026-11-13.md` (las tablas de insumos), `sgsst-electron-app/firma-service/scripts/generar-candidatos-v1.4.js` | Caso real (13-nov-2026), la ronda 17: al corregir **en la fuente** la cita del Decreto 1377, cambiaron el dictamen de L1 y el pedido 6, y el escrito al abogado **seguía declarando sus huellas viejas** (89 527 B / `901b2ed9…` y `d5a44080…`): el abogado recibía dos números que ya no correspondían a los archivos del repositorio. Reglas: (1) **la huella que se declara es la del archivo en ese momento**, medida con `execFileSync`; (2) **si el insumo cambia, el documento que lo cita se vuelve a medir y se vuelve a escribir**; (3) **el verificador compara la huella declarada con la real del archivo y falla si no coinciden** —una tabla de insumos sin ese check es una tabla de deseos—; (4) **la huella del texto generado no se mueve porque haya cambiado el texto fuente**: si la corrección no está en la región que el generador lee, el candidato sale idéntico, y eso **no** significa que la corrección no llegó (medido: el dictamen pasó de 90 850 B a 90 936 B y los dos candidatos conservaron `fae2b26b…` y `7576b1a1…`) |

| 162 | 🔴 **Un requisito con código y con papel son dos requisitos: el código implementado no cierra el requisito, y un hueco que no está registrado no es un hueco cerrado, es un hueco invisible** | `sgsst-electron-app/docs/gestion-humana/firma-electronica/procedimiento-canal-fecha-terminacion-2026-10-31.md` (§9), `sgsst-electron-app/docs/gestion-humana/firma-electronica/meta-para-abrir-a-empresas-reales-2026-11-12.md` (bloque M.31), `sgsst-electron-app/docs/gestion-humana/firma-electronica/tabla-de-solicitudes-2026-11-13.md` (S-22) | Caso real (13-nov-2026), la ronda 18: el canal de `fecha_terminacion` estaba **implementado y probado** (`src/services/fechaTerminacion.js`, migraciones 052/053, `tests/fecha-terminacion-canal.test.js`, y la correspondencia del §8.6(b) diciendo «Implementado»), y aun así el requisito **no estaba cumplido**: faltaban las **cinco decisiones del owner** que el propio procedimiento pedía, y **ningún documento de cierre las registraba**. El mapa publicaba «30 bloques, 30 cerrados, 0 pendientes»: el 0 era cierto y estaba incompleto. Reglas: (1) **«Implementado» describe el código, no el requisito**: el §6 del Anexo dice «por el canal que el Encargado habilite», y sin papel no hay canal habilitado; (2) **una decisión que no está escrita no está tomada**: cinco decisiones del 31-oct siguen vivas el 13-nov; (3) **un hueco sin registro no es un hueco cerrado, es un hueco invisible**: el conteo solo cubre lo que está escrito, y un `0 pendientes` que no cubre el universo es un verde falso con otro nombre; (4) **el hueco se escribe primero y el número sale después**: registrar el bloque y la solicitud, y dejar que el script regenere el conteo real —cambiar el número para que cuadre es escribir la cifra a mano; (5) **el mapa tiene que poder responder «¿qué falta?»**: si el expediente no alcanza, eso es un hallazgo, no un vacío |

| 163 | 🔴 **Una respuesta que no se escribe en el documento que la pide no está aplicada: la solicitud queda cerrada en el papel y abierta en la realidad** | `sgsst-electron-app/docs/gestion-humana/firma-electronica/procedimiento-canal-fecha-terminacion-2026-10-31.md` (§3.1, §3.2, §4, §5a, §5b, Anexo A), `sgsst-electron-app/docs/gestion-humana/firma-electronica/tabla-de-solicitudes-2026-11-13.md` (S-22 y su §2.1), `sgsst-electron-app/firma-service/tests/scripts/contar-estados-meta-apertura.test.js` | Caso real (13-nov-2026), la ronda 19: el owner respondió las **cinco decisiones** del canal de `fecha_terminacion` que la S-22 pedía. La respuesta existía —en el mensaje del owner— pero **no estaba escrita en el procedimiento**, así que el requisito seguía sin cumplir: era la misma trampa de la ronda 18 en su forma inversa (ahora el hueco no es invisible, es **aparentemente** visible). Reglas: (1) **la decisión se escribe donde se va a aplicar**, con su fecha y su responsable, y no en un chat, un correo o el `Historial.md`; (2) **cerrar una solicitud es un acto de tres pasos**: aplicar, verificar y registrar —responder no es cerrar—; (3) **la respuesta se registra con su contenido**: la tabla tiene su §2.1 con las cinco decisiones, dónde quedaron escritas y quién respondió; (4) **la solicitud se cierra y el bloque del mapa no cambia de estado**: un bloque cerrado por solicitud significa «el pedido está emitido y medido», y lo que cambia es el «qué falta» del bloque; (5) **el guard tiene que fallar cuando la decisión no está escrita**: el test comprueba las cinco marcas de decisión, el Anexo A y el estado `CERRADA` de la S-22, y si alguien borra el Anexo A o devuelve una decisión a «pendiente», el test **falla** |

| 164 | 🔴 **Medir un archivo mientras un mutante lo tiene modificado devuelve la huella del mutante, no la del archivo: y esa huella se va al escrito que se envía** | `%TEMP%\kair-p8\mutantes-v19.js`, `%TEMP%\kair-p8\huellas-r19.js`, `sgsst-electron-app/docs/gestion-humana/firma-electronica/solicitud-al-abogado-validacion-procedimiento-2026-11-13.md` (la tabla de insumos), `sgsst-electron-app/firma-service/tests/scripts/contar-estados-meta-apertura.test.js` (el check de la huella real) | Caso real (13-nov-2026), la ronda 20: al publicar la huella del procedimiento del canal se launcharon en paralelo el **arnés de mutantes** (que escribe un defecto, corre el verificador y restaura) y la **medición**. La medición cayó en la ventana en que el arnés tenía el archivo mutado, y devolvió **16 495 B / `5220559b…`**, que era la huella **del mutante**: la real era **16 513 B / `6f792eae…`** (la de ese momento: el procedimiento volvió a cambiar el 13-nov-2026, en la ronda 21). El error se detectó porque el test que compara la huella declarada con la real **falló**; sin ese check, la huella del mutante habría viajado al escrito que se le manda al abogado. Reglas: (1) **nunca se mide un archivo mientras un mutante lo tiene modificado** — entre la escritura y la restauración el archivo es otro archivo—; (2) **la misma regla de la suite**: nunca dos corridas simultáneas en el mismo árbol, y un mutante es una corrida que escribe; (3) **la huella que se publica se mide con el árbol quieto y se vuelve a medir al final**, después de todos los cambios; (4) **el guard que compara la huella declarada con la real es el que salva**: es el que hace que una huella vieja o ajena no llegue al documento enviable |

| 165 | 🔴 **Un guard que busca la cifra en todo el documento se satisface con una entrada histórica: la línea viva puede quedar vieja y nadie lo ve** | `sgsst-electron-app/CONTEXT.md` (la línea que describe la META), `sgsst-electron-app/firma-service/tests/scripts/contar-estados-meta-apertura.test.js` (el guard de la línea viva) | Caso real (13-nov-2026), la ronda 21: el CONTEXT publicaba en su **línea viva** —la que describe la META, la que se lee antes de tocar nada— la cifra de la ronda anterior (**22 solicitudes** con **21 `EMITIDA` y 1 `CERRADA`**), mientras la tabla ya iba en **23: 22 `EMITIDA` y 1 `CERRADA`**. El check de la ronda 20 buscaba `/22\s+EMITIDA…1\s+CERRADA/` en **todo** el CONTEXT: lo satisfacía la **entrada histórica** de la ronda 20 (que sí decía 22 `EMITIDA` y 1 `CERRADA`), así que la deriva no la vio nadie — llevaba una ronda entera publicada. Reglas: (1) **la cifra se propaga a la línea viva y se verifica en esa línea**: un guard que busca en todo el documento se cumple con la coincidencia más antigua; (2) **un registro con fecha es un registro**: la entrada de una ronda anterior se anota, no se reescribe, y por eso convive con la línea viva y la puede tapar; (3) **el guard deriva el número de la fuente** —la tabla de solicitudes— y no de una constante escrita a mano, para que no se pueda quedar viejo sin que nadie lo note; (4) **un guard que no se ha visto fallar no es un guard**: el mutante de la ronda 21 devuelve la línea viva a la cifra de la ronda anterior y el test tiene que ponerse en rojo; (5) **la deriva se busca, no se supone**: en cada ronda se comparan una por una las publicaciones de la cifra contra la fuente, porque un script de propagación que dice «OK» no prueba que la línea viva haya quedado actualizada |

| 166 | 🔴 **Un rango de sustitución que no cubre el párrafo entero deja un fragmento huérfano: el documento sale con un párrafo roto y un texto duplicado, y el generador no se queja** | `sgsst-electron-app/firma-service/scripts/determinaciones-v1.4.js` (los rangos), `sgsst-electron-app/docs/gestion-humana/firma-electronica/dictamen-legal-l1-2026-11-12.md` (los bloques literales), `sgsst-electron-app/firma-service/tests/scripts/contar-estados-meta-apertura.test.js` (el guard del fragmento duplicado) | Caso real (13-nov-2026), la ronda 22: la determinación **B.2** sustituía las líneas **488-496** del texto base cuando el párrafo entero llegaba hasta la **507**. El texto nuevo terminaba en «… que no están en el CDPA.» y el texto base continuaba con «<strong>Lo que el CDPA sí establece</strong>…»: el resultado era un **párrafo roto con el fragmento duplicado** («que no están en el CDPA.» dos veces seguidas) en el §4 del Anexo de Nube v1.4. **El generador no lo detectó**: su guard comprueba que el ancla case **una** vez, y el ancla sí casaba una vez —lo que quedaba fuera del rango no lo comprobaba nadie—. Reglas: (1) **un rango tiene que cubrir la unidad completa** —un párrafo, una fila de tabla, una viñeta—, y el bloque nuevo tiene que **incorporar** lo que el texto base tenía después; (2) **la costura se mira**: el verificador compara el texto final con el base y **busca fragmentos repetidos en la unión** (una línea que repite el final de la anterior); (3) **el guard cuenta el fragmento**: si «que no están en el CDPA» aparece dos veces, el test falla; (4) **el rango se corrige en el motor y el bloque se completa en la fuente**, no parcheando la salida |

| 167 | 🔴 **Un texto que se firma no puede afirmar lo que nadie verificó: la norma no verificada se cita como marco de referencia, y el hecho no verificado se declara pendiente de confirmación** | `sgsst-electron-app/docs/gestion-humana/firma-electronica/dictamen-legal-l1-2026-11-12.md` (los bloques A.1, A.2.2, A.4, A.5, B.1, B.2, B.3 y B.8), `sgsst-electron-app/docs/gestion-humana/firma-electronica/candidatos-v1.4/anexo-nube-v1.4.html`, `sgsst-electron-app/docs/gestion-humana/firma-electronica/respuesta-del-abogado-2026-11-13.md` | Caso real (13-nov-2026), la ronda 22: la v1.4 candidata afirmaba, en ocho lugares distintos, que «Estados Unidos es país con nivel adecuado de protección» y que la **región US del bucket** era «condición de esta declaración» —todo ello sobre el **numeral 3.2 del Título V de la Circular Única**, que el abogado matriculado declaró por escrito **no verificado**. Un documento que se firma afirmando una norma no verificada es un documento que miente (art. 4 literal d de la Ley 1581) y que además **atribuye al cliente un riesgo que él no eligió**. Reglas: (1) **lo no verificado se dice no verificado, en el texto que se firma**: «marco sectorial de referencia, no como fundamento» y «no fue verificado el 13-nov-2026»; (2) **una condición que no es legal no se presenta como legal**: la región US pasó a ser **decisión conservadora de K+AIR**, con su fundamento (el art. 24 num. 2 y el art. 25 **no condicionan el país**); (3) **una cita normativa que sale de la lista de referencias es una contradicción interna**: la viñeta del Título V se había comido un rango mal acotado y el cuerpo la citaba sin que la lista la nombrara; (4) **el guard vigila el texto, no solo el conteo**: el test comprueba que el candidato dice «marco sectorial de referencia», «no fueron verificados», «decisión conservadora de K+AIR» y «supuesto (ii)» |

| 168 | 🔴 **Un fragmento de sustitución cuyo destino cae dentro de un rango reescribe el literal nuevo: el texto que se firma deja de ser el texto que se aprobó, y el generador no se queja** | `sgsst-electron-app/firma-service/scripts/determinaciones-v1.4.js` (los fragmentos y los rangos), `sgsst-electron-app/docs/gestion-humana/firma-electronica/dictamen-legal-l1-2026-11-12.md` (el literal B.8.5 y la fila 535 de B.6.4), `sgsst-electron-app/firma-service/tests/scripts/generar-candidatos-v1.4.test.js` (el guard de identidad byte a byte y el guard estructural) | Caso real (13-nov-2026), la ronda 22 (tarde): el rango `L1-B85` sustituía el párrafo entero «Lo que queda pendiente» del Anexo de Encargo y su literal **B.8.5** copiaba del texto base la línea «…esta versión **2026-11-11** del Anexo de Encargo…», mientras el motor resolvía la fecha con un fragmento aparte (`B6.4-535`) que sustituía `2026-11-11` por `2026-11-12`. Al insertar el literal, **el fragmento cayó dentro del rango** y pasó a reescribirlo: el candidato salió con `2026-11-12` y **el dictamen decía `2026-11-11`**. El texto que se iba a firmar no era el texto que estaba escrito, y **el generador no se quejó** —el ancla casaba exactamente una vez—. Reglas: (1) **el literal es lo que se firma**: el guard `el texto del candidato es byte a byte el de la determinacion` tiene que pasar, y si falla, **el literal se corrige en el dictamen** (fecha `2026-11-12`) y el fragmento **se elimina**; (2) **un fragmento no puede tocar el literal de una determinación**: guard estructural que compara cada ancla de cada fragmento contra todos los literales del dictamen y del pedido; (3) **el mutante tiene que ser el defecto completo** —el dictamen con la fecha vieja **más** el fragmento—: un mutante a medias falla por otra razón y no prueba nada; (4) **una corrección que no cambia los bytes se anota igual**: aquí las huellas de los candidatos no se movieron (`ba664e6f…` y `d4df187a…`) y lo que cambió fue **de dónde salía** el texto; (5) **la fuente que cambia obliga a re-medir lo que la declara**: el escrito al abogado declaraba huellas que ya no correspondían a los archivos, y se anotó con las vigentes |

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

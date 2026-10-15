# Instrucciones Globales - OpenCode

> ## 🚦 Arranque — leé esto primero
>
> Este archivo tiene **4 800+ líneas y es 89 % bitácora de bugs**. No lo leas entero: buscá con grep.
>
> | Leé esto | Para qué |
> |---|---|
> | **`../PROMPT.md`** | El prompt operacional. Rol, reglas de proceso, convenciones, trampas activas |
> | **`../Historial.md`** | **Dónde quedó el trabajo y qué falta.** Estado de cierre + cola acordada |
>
> Empezá por esos dos. Recién después volvés a buscar acá el "por qué" de algo puntual.
>
> ⚠️ **Este archivo contiene secciones que quedaron viejas.** Si contradice al código, **manda el
> código** y hay que corregir la sección. Las trampas conocidas están en `PROMPT.md` §9.
>
> 🔴 **Y una advertencia sobre este archivo en particular:** nada de lo que dice acá es una regla
> sin verificar. Hubo reglas "OBLIGATORIAS" que mandaban llamar funciones que **no existen**
> (`KairUI.esc()`, `KairHelpers.formatDate()`), una convención de commits con 270 versiones de atraso,
> y una referencia a un archivo CSS inexistente. **Grepeá antes de aplicar lo que leas acá.**
> La regla completa está en `../PROMPT.md` §5.9.

## Skills Disponibles

Todos los skills se activan con `skill({ name: "<nombre>" })`. El modelo decide cuando cargarlos segun la tarea.

### Skills de UI/UX

| Skill | Cuando usarlo | Activacion |
|-------|--------------|------------|
| **ui-ux-pro-max** | Diseno de interfaces, paletas, tipografia, animaciones, responsive, dark mode | OBLIGATORIO para UI/UX |
| **frontend-design** | Interfaces con alta calidad visual, estetica creativa, evitar look generico AI | Recomendado para UI nueva |

**ui-ux-pro-max** - Motor de busqueda Python (ejecutar antes de implementar UI):
```bash
python .opencode/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system -p "K+AIR"
python .opencode/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>
python .opencode/skills/ui-ux-pro-max/scripts/search.py "<query>" --stack html-tailwind
```

**Stacks:** html-tailwind, react, nextjs, vue, svelte, swiftui, react-native, flutter, shadcn, jetpack-compose
**Dominios:** product, style, typography, color, landing, chart, ux, web, prompt

### Skills de Desarrollo (Superpowers)

| Skill | Cuando usarlo | Activacion |
|-------|--------------|------------|
| **feature-dev** | Desarrollar features nuevas (workflow 7 fases) | Al implementar features |
| **code-architect** | Disenar arquitectura antes de implementar | Antes de features grandes |
| **code-explorer** | Entender codigo existente antes de modificarlo | Antes de tocar codigo desconocido |
| **code-reviewer** | Review de bugs, seguridad, calidad (confidence >= 80) | Despues de implementar, antes de commit |
| **code-simplifier** | Simplificar codigo manteniendo funcionalidad | Despues de implementar, antes de commit |
| **silent-failure-hunter** | Cazar errores silenciosos y error handling deficiente | Despues de escribir try-catch o fallbacks |
| **security-review** | Review de seguridad: inyeccion, auth bypass, crypto, RCE, data exposure (confidence >= 8) | Despues de implementar, antes de commit, para codigo con input de usuario |
| **commit-workflow** | Crear commits, push, PRs con mensajes significativos | Al hacer commit o PR |

### Skills de Requisitos y Calidad (Addy Osmani · `.agents/skills/`)

Skills de `addyosmani/agent-skills` seleccionadas por complementar Superpowers sin duplicar. Se activan con `skill({ name: "<nombre>" })`.

| Skill | Cuando usarlo | Activacion |
|-------|--------------|------------|
| **interview-me** 🥇 | Extraer lo que el usuario realmente quiere: una pregunta a la vez hasta ~95% confianza. Mejor que brainstorming para pedidos vagos ("hazme X" sin detalle) | Pedido subespecificado; "interview me", "grill me", "are we sure?" |
| **constraint-driven-development** 🥇 | Formalizar y hacer cumplir las reglas duras del proyecto como contrato escrito (`CONSTRAINTS.md`). Detecta cuando un agente "suaviza" checks (tests saltados, suppressions, thresholds bajados) | Definir/auditar estandares de calidad; cuando se note que se relajan reglas de AGENTS.md |
| **doubt-driven-development** 🥈 | Revision adversarial fresh-context de cada decision no trivial antes de darla por buena: CLAIM → EXTRACT → DOUBT → RECONCILE. Seguro contra bugs de raiz escondida (caso Bootstrap 📦761) | Stakes altos (seguridad, auth, migraciones irreversibles); codigo unfamiliar; output "seguro" pero barato de verificar ahora |
| **deprecation-and-migration** 🥈 | Gestionar retiro/migracion de sistemas viejos, APIs o features. Expand/contract, eliminar codigo zombie | Limpiar modulos legacy del repo; decidir si mantener o sunsetear algo |
| **documentation-and-adrs** 🥉 | Architecture Decision Records: documentar el *porque* de decisiones arquitectonicas y cambios de API | Decisiones de arquitectura; shipping features; cambiar APIs publicas/IPC |

**Nota:** `git-workflow-and-versioning` de este pack NO se instalo a proposito — choca con la convencion `📦n` obligatoria del repo.

**Origen:** [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (98k★, MIT). Todas Safe / Low Risk. Docs: `.agents/skills/<nombre>/SKILL.md`.

### Skills de Testing Electron (`.agents/skills/`)

| Skill | Cuando usarlo | Activacion |
|-------|--------------|------------|
| **desktop-testing-electron** | Tests E2E con Playwright `_electron.launch()`, unit tests de main/preload (mock de `electron`/`contextBridge`/`ipcRenderer`), stub de dialogos nativos, CI headless con `xvfb-run` | Al escribir o correr tests de la app Electron |
| **electron-playwright-cli** | Automatizar la app Electron en vivo: snapshots, clicks, typing, screenshots, extraccion de datos (CLI `electron-playwright-cli`) | Para interactuar/probar la app en runtime sin armar un test formal |

**Reglas criticas (desktop-testing-electron):**
- SIEMPRE `await electronApp.close()` en el teardown (procesos Electron rompen CI).
- Mockear el modulo `electron` en unit tests (las APIs solo existen dentro del runtime).
- Stub de `showOpenDialog`/`showSaveDialog` en E2E (bloquean el proceso).
- CI headless Linux: `xvfb-run` o `xvfb-maybe`.

**Config electron-playwright-cli:** crear `.playwright/cli.config.json` con `browser.launchOptions.args: ["main.js"]` apuntando al entry point del proceso main.

**Tests existentes del repo** (patron scripts sueltos con `node`, sin framework): `tests/test-*.js`, `main/test-*.js` — se corren con `node <ruta>`. Las skills de arriba son para tests E2E/formales de la app Electron completa.

### Skills de Superpowers (Plugin Global)

Se activan con `skill({ name: "superpowers/<nombre>" })`. El plugin inyecta bootstrap context automaticamente en cada conversacion.

| Skill | Cuando usarlo | Activacion |
|-------|--------------|------------|
| **superpowers/brainstorming** | Refinar ideas antes de codificar, diseno socratico | OBLIGATORIO antes de escribir codigo nuevo |
| **superpowers/writing-plans** | Crear planes de implementacion detallados | Despues de aprobar diseno |
| **superpowers/executing-plans** | Ejecutar planes en batch con checkpoints | Con plan aprobado |
| **superpowers/subagent-driven-development** | Desarrollo rapido con subagentes y review en 2 etapas | Alternativa a executing-plans |
| **superpowers/test-driven-development** | Ciclo RED-GREEN-REFACTOR | OBLIGATORIO durante implementacion |
| **superpowers/systematic-debugging** | Debugging sistematico en 4 fases, root-cause tracing | Al investigar bugs |
| **superpowers/verification-before-completion** | Verificar que algo esta realmente arreglado | Antes de declarar un bug como resuelto |
| **superpowers/requesting-code-review** | Checklist pre-review | Entre tareas del plan |
| **superpowers/receiving-code-review** | Responder a feedback de review | Al recibir comentarios |
| **superpowers/using-git-worktrees** | Branches aislados para desarrollo paralelo | Al iniciar feature branch |
| **superpowers/finishing-a-development-branch** | Verificar tests, decidir merge/PR/keep/discard | Al completar tareas |
| **superpowers/dispatching-parallel-agents** | Workflows concurrentes con subagentes | Para tareas independientes |
| **superpowers/writing-skills** | Crear nuevos skills siguiendo mejores practicas | Al crear skills personalizados |
| **superpowers/using-superpowers** | Introduccion al sistema de skills | Referencia general |

### Workflow Recomendado para Desarrollo

1. **interview-me** - Si el pedido es vago o subespecificado (antes de todo)
2. **constraint-driven-development** - Si no hay CONSTRAINTS.md o se estan relajando reglas
3. **feature-dev** - Workflow completo (7 fases: discovery, exploration, questions, architecture, implementation, review, summary)
4. **doubt-driven-development** - Si stakes altos o decision no trivial (antes de dar por bueno)
5. **code-simplifier** - Despues de implementar codigo
6. **code-reviewer** - Antes de commit
7. **security-review** - Antes de commit, para codigo con input de usuario o superficies de ataque
8. **commit-workflow** - Al hacer commit

**Cuando NO usar Addy en paralelo a Superpowers:** no invocar `using-agent-skills` (meta-router de Addy) junto a `using-superpowers` — dos routers activos pelean por el routing. Elegir uno como primario; en este repo el primario es **Superpowers**.

### Proyecto K+AIR (SG-SST Electron)
- Stack: Electron + vanilla JS + Python 3.11.9
- No usar frameworks frontend (React, Vue, etc.)
- Para UI usar: html-tailwind guidelines del skill ui-ux-pro-max

### Convencion de Commits (OBLIGATORIO)

El usuario usa su propio formato de commits con versionado incremental. El formato vigente es un **híbrido**: el número de paquete delante y conventional commits después.

```
📦<numero| rango>[-fix] # <tipo>(<scope>): <descripcion en espanol, tono casual, sin punto>
```

Ejemplos reales (`git log`): `📦850-851 # feat(bandeja): columna lateral plegable y sin etiqueta de fecha`

> 📌 **Corregido 2026-10-03.** Esta línea decía antes "**NO** usar conventional commits" y definía
> `📦<numero> # <descripcion>`. El equipo migró al formato híbrido y esta sección quedó vieja.
> **Verificá con `git log -15` antes de cada commit**: la convención de este repo cambió varias veces.

- El emoji 📦 es literal (no es un placeholder).
- `<numero>` es secuencial e incremental (último conocido: 579 → siguiente 580 al 2026-07-21).
- La descripción es en español, sin punto final obligatorio, tono directo (ej: "Fix y Update sistema actualizacion e iconos y accesos directos del escritorio").
- Para work-in-progress / doc-only / refactor sin cambio funcional visible, mantener el mismo formato 📦n #.
- Ejemplos reales del repo: `📦396 #`, `📦397 #`, `📦398 #`, `📦399 #`, `📦551+552 #`, `📦579 #` (loop 47b, menú nativo).

**Antes de cada commit, verificar el último `📦<n>` en `git log` para usar el siguiente número correcto.**
- Si la sesión trabaja con Mavis (agente), **ambos pueden usar numeración** — coordinarse con `git log` antes de cada commit para no colisionar. Si ya hay un 📦547 tuyo, yo uso 📦548+ (no 📦547+548).
- Cumplir Resolucion 0312 de 2019 (Colombia)

**Prefijos alternativos (no solo `📦<n>`):** además del formato principal `📦<n>`, se usan prefijos descriptivos para cambios no funcionales:
- `🐛 fix:` — Bug fix puntual (ej: `🐛 fix(bandeja-integrada): 2 errores runtime`)
- `🎨 audit:` — Mejora visual / auditoría de UI (ej: `🎨 audit(objetivo): 3 ajustes`)
- `📧 audit:` — Auditoría de email (ej: `📧 audit(thread-grouping): refactor Gmail`)
- `📚 docs:` — Documentación (ej: `📚 docs: actualizar documentación completa v0.1.120`)
- `🔖 Bump version` — Bump de versión dedicado (1 commit)
- `Revert "<mensaje del commit original>"` — Revertir un commit completo. Usar `git revert <hash>` (NO `git reset --hard`). El historial queda limpio (commit original + commit de revert).
- Después de un revert, si querés reaplicar los cambios: `git revert <hash-revert>` o `git cherry-pick <hash-original>`

### Regla de Comunicación - Explicación Simple

Cuando diagnostiques un error o propongas una corrección, SIEMPRE debes incluir al final de tu respuesta una sección explicativa en lenguaje sencillo (sin jerga técnica) que contenga:

1. **Qué está pasando** - Explicar el problema como si le hablaras a alguien que no programa
2. **Qué hace la propuesta** - Explicar en términos simples qué corrige tu solución
3. **Antes vs Después** - Mostrar visualmente el cambio con un ejemplo claro

Formato recomendado:

```
## Explicación Simple

### El problema
[Explicar qué pasa actualmente en lenguaje cotidiano]

### La solución
[Explicar qué hace la corrección de forma sencilla]

### Antes vs Después
ANTES (con bug): [Descripción simple]
DESPUÉS (corregido): [Descripción simple]
```

NO usar términos como: callback, listener, async, await, variable, función, línea, código, archivo, componente, hook, state, props, render, mount, unmount, **BEM, CSS variable, data-attribute, grid, flexbox, hover, transition, shadow, border-radius, z-index, media query, pseudo-clase, cascada, responsive, overflow, scrollbar, gutter, opacity, transform, animación, breakpoint, padding, margin, gap, font, weight, color, background, border, radius, sombra, opacidad, transición, evento, controlador, manejador, helper, utilidad, módulo, import, export, require, dependency, paquete, librería, framework, patrón, refactor, debug, log, consola, stack, trace, error, excepción, promesa, callback, hilo, thread, mutex, lock, cache, memoria, almacenamiento, base de datos, query, SQL, índice, transacción, commit, rollback, merge, branch, push, pull, request, response, endpoint, API, endpoint, payload, JSON, XML, HTTP, HTTPS, SSL, TLS, header, body, query string, param, GET, POST, PUT, DELETE**, etc.
SI usar términos como: sistema, mensaje, ventana, tema, preferencia, configuración, resultado, lista, tabla, tarjeta, botón, panel, formulario, campo, opción, calendario, fecha, hora, día, mes, año, correo, contacto, evento, reunión, cita, capacitación, inducción, evaluación, archivo, documento, empresa, empleado, persona, etc.

---

## Arquitectura del Proyecto (para IA nueva)

Si otra IA va a extender el proyecto, debe seguir estas convenciones:

### Stack
- **Electron** (no React, no Vue, no frameworks frontend)
- **Vanilla JS** (ES5/ES6 mixto, sin TypeScript)
- **CSS plano** (sin Tailwind, sin preprocessors — solo BEM con prefijo `kair-`)
- **Lucide icons** vía SVG inline (`<svg class="lucide lucide-mail">` con `<path>`, `<line>`, etc.) — generado desde `renderer/bandeja-integrada/data.js` (D.ICONS)
- **Backend IPC** vía `window.electronAPI.*` (definido en preload.js con contextBridge)

### Patrón de archivo (template para cualquier vista nueva)

```javascript
/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Nombre vista (replica XxxView.tsx del .tar)
   v3.0 · FECHA — descripción breve
   ═══════════════════════════════════════════════════════════════════ */

var NombreVista = (function () {
  'use strict';

  // Estado privado del módulo (se preserva entre renders)
  var _state = { ... };
  var _onRerender = null;

  function _esc(s) { return KairUI.esc(s); }
  function _fmtDate(iso) { return KairHelpers.formatDate(iso); }

  function _renderHeader() { return '<div class="kair-header">...</div>'; }
  function _renderKpis() { return '...'; }
  function _renderList() { return '...'; }

  function _rerender() { if (typeof _onRerender === 'function') _onRerender(); }

  function render(container) {
    var data = KairStore.selectAudits();  // o cualquier selector
    container.innerHTML = '<div class="kair-main">' +
      _renderHeader() + _renderKpis() + _renderList(data) +
      '</div>';
    _bindEvents(container);
  }

  function _bindEvents(container) {
    container.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () { ... });
    });
  }

  function setRerenderCallback(fn) { _onRerender = fn; }
  function destroy() { /* cleanup timers, listeners */ }

  return { render: render, destroy: destroy, setRerenderCallback: setRerenderCallback };
})();

window.NombreVista = NombreVista;  // SIEMPRE exportar a window
```

### Reglas obligatorias
- `var` (no `let`/`const`) para mantener compat con código legacy
- Funciones en camelCase con `_` prefix para helpers privados (`_renderHeader`, `_bindEvents`)
- **Siempre** escapar HTML con `KairUI.esc()` antes de inyectar texto del usuario
- **Siempre** formatear fechas con `KairHelpers.formatDate()`
- **Siempre** traducir enums a labels con diccionarios `KairHelpers.*Label[enum]`
- **Siempre** traducir enums a badge variant con `KairHelpers.*Badge[enum]`
- Para `data-*` en HTML usar kebab-case (`data-go-hub`, `data-action="new"`)
- **NUNCA** usar `bind` events sin cleanup en `destroy()` (causa memory leaks + double-fire)
- Exports a `window.X = X` SIEMPRE al final del archivo

### Clases CSS canónicas (NO crear nuevas)
> ⚠️ **Corregido 2026-10-03.** Esta sección decía que estas clases están definidas en
> `kair-canonical.css`. **Ese archivo NO EXISTE en el repo** (verificado con glob: 0 coincidencias).
> Esa línea es la fuente probable del `PROMPT.md` v1, que quedó obsoleto.
>
> **Fuente real del sistema visual:** `design_system.md` + `shared/kair-design-tokens.css`
> + `shared/kair-components.css`. Antes de crear cualquier clase `kair-*`, grepeá el repo.

**No todas estas clases existen todavía, y varias están en conflicto.** Antes de usarlas:

| Clase | Estado real |
|---|---|
| `kair-header*` | Solo dentro de algunos submódulos, **no en el shell**. El shell usa `<header id="app-header">` con `.header-content` |
| `kair-header__tab` | **Muerta** — migrada a `.em-tab` |
| `kair-kpi-strip` / `kair-kpi-item*` | Retirada del sistema en 📦849; el owner pidió no volver a mostrar eventos críticos |
| `kair-card`, `kair-table-wrap`, `kair-table` | Vivas y canónicas |
| `kair-panel` | ⚠️ **Colisión**: ese nombre lo usa `revision-alta-direccion.css` como panel de layout. El marco canónico es `.kair-block__panel` |
| `k-section-card` | Legacy peligroso, no usar en código nuevo (choca con `kair-card`) |
- Buttons: clases `kair-header__action--*` (NO usar shadcn-style buttons)
- Section cards: `kair-rad-section-card`, `kair-rad-section-card__head/title/body`
- Progress: `kair-progress`, `kair-progress__bar`, `kair-progress__bar.is-{success|warning|danger}`
- Dialog: `kair-dialog-overlay`, `kair-dialog`, `kair-dialog__header/body/footer/title`
- Calendarios: `kair-cron-grid`, `kair-cron-grid__row/cell/head/corner/month/audit/hito`
- Workflow editor: `kair-rad-editor`, `kair-rad-editor__main/sidebar`, `kair-rad-sticky-footer`, `kair-rad-side-nav__item`

### K+AIR Premium Design System (v0.1.214 · 📦730-815)

A partir de v0.1.197, los homes de módulos usan el sistema premium con tokens compartidos. **15 paquetes en el rango 📦730-815** migrados al patrón unificado (sep 2026, 4 olas):

**Ola 1 — Homes de módulo (📦730-738, v0.1.197-205):** 8 homes rediseñados con score compuesto + metric cards + chart SVG nativo + module grid.

| 📦 | Módulo | Versión | Score compuesto |
|----|--------|---------|------------------|
| 📦730 | Recursos | v0.1.197 | 6 componentes (inducciones, capacitaciones, presupuesto, actas COPASST/Comité, afiliación) |
| 📦731 | Gestión Integral | v0.1.198 | 6 componentes (Plan Anual %, Objetivos %, Evaluación Inicial %, Política ok, Rendición ok, Cambios ok) |
| 📦732 | Gestión de la Salud | v0.1.199 | Compuesto (tasas ausentismo, accidentes, evaluaciones, seguimientos) |
| 📦733 | Gestión de Peligros y Riesgos | v0.1.200 | 5 componentes (Inspecciones %, Mantenimiento %, Peligros evaluados %, Mediciones %, EPP %) |
| 📦734/735 | Gestión de Amenazas | v0.1.201/202 | Cobertura documental (% submódulos con archivos) |
| 📦736 | Verificación | v0.1.203 | Cumplimiento promedio de 4 submódulos + IPC real del ciclo activo |
| 📦737 | Mejoramiento | v0.1.204 | % cumplimiento (cerradas/total) del viewer 7.1.1 |

#### Archivos del design system
- `shared/kair-design-tokens.css` — 9 tokens CSS globales en `:root`: tipografía (`--kair-font-display` DM Sans 800, `--kair-font-ui` Manrope), radios (`--kair-radius-card/modal/control`), espacios (`--kair-spacer-*`), colores (`--kair-blue/blue-ink/mint/red/amber/ink/muted/faint/canvas/card/line`), transiciones (`--kair-transition` 180ms).
- `shared/kair-components.css` — 14 componentes reutilizables con prefijo `kair-` (sin choque con el sistema BEM legacy).

#### Componentes premium
- `.kair-page-header` + `.kair-page-title-block` + `.kair-breadcrumb` — header con breadcrumb + H1
- `.kair-hero-card` — card grande oscura con mensaje + score + círculo decorativo
- `.kair-metric-card` (variantes `--danger`, `--warning`) — KPI con progress bar
- `.kair-card` — card genérica
- `.kair-tabs` + `.kair-tab` — tabs horizontales
- `.kair-btn-primary` + `.kair-btn-ghost` — botones
- `.kair-status-pill` (variantes `--ok`, `--warn`, `--danger`) — badge de estado
- `.kair-progress` + `.kair-progress i` — barra de progreso
- `.kair-chart` + `.kair-legend` — chart SVG
- `.kair-task` + `.kair-task-icon` — item de lista con icono circular
- `.kair-module` + `.kair-module-grid` — card de submódulo con flecha

#### Estructura canónica del home premium (todos los módulos)

```javascript
async render() {
    // 1. injectStyles() vacío (usa design system compartido)
    // 2. layout con flex chain: height 100% + display flex + flex-direction column + min-height 0
    // 3. header minimal (.kair-page-header + breadcrumb + H1)
    // 4. mainArea con skeleton + flex:1 + overflow-y:auto
    // 5. await refreshStats() / loadCicloActivo() / IPC
    // 6. await renderMainArea(mainArea) — premium pattern
}

async renderMainArea(container) {
    // 1. Calcular score compuesto (promedio simple excluyendo sin datos)
    // 2. Hero strip: 1 .kair-hero-card (score) + 3 .kair-metric-card
    // 3. Content grid: .kair-card (chart SVG nativo) + .kair-card (panel "En tu radar")
    // 4. Modules grid: .kair-module-grid con cards de submódulos
}
```

#### Reglas del design system
- **Coexistencia**: los nuevos `kair-*` conviven con los legacy `--k-*` sin conflicto (prefijos distintos).
- **Responsive fluido**: usar `clamp(min, vw, max)` + `auto-fit` / `auto-fill` para escalar entre ~600px y >1300px.
- **Cache-bust obligatorio**: cada vez que se modifique `kair-design-tokens.css` o `kair-components.css`, bumpear `?v=YYYYMMDD-HHMM-descriptor` en `index.html`. **Lo mismo aplica a `styles.css`** y a cada `<script>` de módulo home. Bumpear `?v=YYYYMMDD-vN-rediseno` (o `-fix-*`) tras CADA cambio.
- **NO agregar `margin: 0 auto` a headers que comparten container con cards** — esto centra el bloque y lo desalinea del resto. Usar `margin: 0 lateral` + `max-width` igual al container padre.
- **Para scroll interno en flex chain**: TODOS los niveles intermedios necesitan `flex: 1` O `height: 100%` + `min-height: 0` para que `overflow: auto` funcione. Si una clase usada en JS no tiene reglas CSS, agregarlas (caso histórico: `.k-app-layout`).
- **🚨 📦757 — EL GRÁFICO NO PUEDE SALIRSE DE SU TARJETA.** El área del gráfico
  (`.kair-chart`) mide `clamp(130px, 13vw, 170px)` y su SVG se posiciona absoluto ocupando
  toda la caja: `.kair-chart svg { width:100%; height:100%; position:absolute; inset:0 }`.
  **Nunca** le pongas al SVG un `style="height:auto"` (ni `width`): el estilo EN LÍNEA le gana
  al CSS, el SVG pasa a medir `ancho × (viewBoxH/viewBoxW)` — con un viewBox 690×170 eso es
  ~25% del ancho, o sea MÁS que los 170px de la caja — y como nada lo recortaba, las líneas,
  la barra y el texto se derramaban sobre el relleno y el borde inferior de la card. Bug real
  reportado con captura en "Ejecución del Plan Anual" (home de Gestión Integral); lo mismo
  estaba en Peligros y Salud. Reglas:
  1. El SVG se genera **sin** `width`/`height` en línea (a lo sumo `style="display:block"`).
  2. `.kair-chart` lleva `overflow: hidden` + `border-radius: 10px` como red de seguridad: si
     un gráfico se pasa de alto, se recorta a su caja en vez de invadir la tarjeta.
  3. Vale para CUALQUIER elemento dentro de un `.kair-chart` (paths, textos, tooltips): el que
     se salga, se recorta.
  4. Test: `node main/test-chart-overflow.js` (verifica que ningún módulo use alto/ancho en
     línea en el SVG y que `.kair-chart` recorte).
- **🚨 📦758 — UNA BARRA SE DIBUJA CON CAJAS HTML, NO CON UN DIBUJO ESTIRADO.** Después de
  📦757 (el gráfico ya no se salía de la tarjeta) el user volvió con OTRA captura: en
  "Ejecución del Plan Anual" se veía el `36 %` **encima** de la palabra "ejecutadas".
  Causa: el dibujo usaba `<svg preserveAspectRatio="none">`, que significa "estirá el
  dibujo para llenar la caja". Al cambiar el ancho de la tarjeta, TODO se deforma: el
  texto se estira a lo ancho y se aplasta a lo alto, y las posiciones internas (medidas
  en un lienzo de 690px) dejan de coincidir con el tamaño real de la caja → texto montado
  sobre texto. **Regla:** las barras se dibujan con el componente HTML `.kair-bar-chart`
  (filas `label | barra | valor` en una rejilla de 3 columnas, ancho de relleno real en %,
  alto del contenido). Un `<svg>` dentro de `.kair-chart` solo se justifica para dibujos
  de líneas (Recursos), y en ese caso: nada de `preserveAspectRatio="none"` y **nada de
  texto adentro del dibujo** (los meses van como texto normal debajo, en
  `.kair-bar-chart__months`).
  - Cajas: `.kair-chart--flow` = `height: auto` + `min-height: clamp(130px,13vw,170px)`
    (el alto lo pone el contenido, pero un dibujo de líneas conserva dónde dibujarse);
    `.kair-chart--flow > svg` = `position: static` + alto propio `clamp(96px,9.5vw,130px)`.
  - **Regla de la rejilla**: el valor mide lo que mide su texto (`max-content`) para que
    todos los valores queden alineados al borde derecho; nunca `auto` (deja hueco y
    desalinea las filas).
  - Tests: `node main/test-chart-overflow.js` (20 checks, estructura) y
    `node main/test-grafico-se-ve-bien.js` (39 checks, **ejecuta el código real** con un
    DOM mínimo y verifica los porcentajes de cada barra, los textos y las reglas CSS).
  - Medición real (temporal, ya borrada): se abrió el gráfico en Electron a 1500/1100/900px
    y se midió caja por caja → `valorDerechaMenosChart = 0` en todas las filas, hueco
    label↔barra y barra↔valor siempre igual (8.8-12px), tarjeta de gráfico y tarjeta de
    radar con el MISMO alto (270px a 1500, 228px a 1100).
- **📦756/📦757/📦758 — Cache-bust de los homes de módulo**: los `*-home.js` se cargan con
  `<script src="modules/.../x-home.js?v=...">` en `index.html`. **Cada vez que se toca un home hay
  que bumpear SU `?v=`** (📦756 lo omitió para 4 homes: recursos, amenazas, verificación y
  mejoramiento; se corrigió en 📦757). No alcanza con bumpear `styles.css`.
- **🚨 📦759 — EVALUACIÓN INICIAL DEL SG-SST: los dos bugs de raíz que hay que no repetir.**
  El submódulo 2.3.1 (`modules/gestion-integral/evaluacion-inicial-sg-sst/`) tenía un problema
  de arquitectura de estilos, no de diseño. Cuando se toque cualquier submódulo viejo, buscar
  los mismos dos patrones:
  1. **CSS inyectado desde el `.js`.** El componente armaba 270 líneas de CSS en un `<style>`
     al `<head>` con un `:root` **GLOBAL** (`--primary`, `--text-dark`, `--bg-card`, `--border`…)
     y reglas `.k-*` **sin scope**. Se agregaba DESPUÉS del `<link>`, así que le ganaba al `.css`
     en cada empate → **editar la hoja de estilos no cambiaba nada**, y esos nombres genéricos
     se filtraban a TODA la app (otros módulos usan `--primary`). Se eliminó ese bloque; lo que
     hacía falta de él (barra PHVA, layout, modal de archivos) vive en la hoja premium.
     **Regla:** ningún componente inyecta CSS al `<head>`; si necesita estilos propios, van en
     su hoja con su propio prefijo.
  2. **Los modales viven FUERA del contenedor del módulo.** `#k-modal-root` (modal de PDF) y los
     4 `<dialog>` de Planes de Acción se cuelgan del `<body>`. Si la capa de estilos se scopea
     al contenedor, **los modales se quedan sin estilo y sin modo oscuro** (era exactamente lo
     que se veía: modal blanco con el tema oscuro puesto). Solución: una sola marca,
     `kair-eval-scope`, aplicada a los TRES puntos de montaje con `this._scope(nodo)`.
     **Regla:** al migrar cualquier componente, listar TODOS los lugares donde appendea nodos
     (contenedor, body, top layer) y scopear cada uno.
  - **Bug de pestañas (preexistente, corregido).** `.k-view { display: none }` y
    `.k-view.active { display: block }` tienen **la misma prioridad** (0,2,0); cuando empatan
    gana la declarada más abajo. Con la regla que apaga escrita después, **la vista activa
    quedaba invisible**: la tabla de Hallazgos y la de Planes de Acción no aparecían nunca
    (el botón sí se marcaba, porque es otra clase). Fix: `.k-view:not(.active) { display: none }`.
     **Regla:** nunca dejar un `display: none` genérico antes de un estado activo con la misma
     prioridad — o se excluye el estado, o se sube la prioridad del activo.
  - **Modo oscuro: la app tiene DOS atributos.** `theme-manager.js` aplica `data-theme="dark"`
     (tema "Sistema" con el SO oscuro) y `data-theme="dark-legacy"` (tema "Oscuro" manual). El
     módulo solo cubría el primero → con el tema oscuro elegido a mano quedaba claro.
     **Siempre cubrir los dos.**
  - **Tokens "envenenados" por la hoja base.** El `.css` base vuelve a declarar `--ei-*` en
     `.ev-inicial-sgsst` (misma prioridad, después en la cascada), así que los alias
     (`--ei-bg-card` → `--kair-card` → `#ffffff`) resolvían blanco en oscuro. Para las
     superficies se usa un token propio (`--ei-surface`) y en el bloque oscuro se listan
     selectores con prioridad extra (incluyendo el layout) más los alias `--k-*` y los
     genéricos. **Regla:** cuando se reasignan tokens, verificar el valor *calculado* en el
     nodo real (`getComputedStyle(el).getPropertyValue('--token')`), no confiar en el CSSOM.
  - **El `<canvas>` no entiende `var()`.** El gauge tenía 3 hex fijos (`#dc3545`, `#ffc107`,
     `#28a745`) y por eso no seguía ni la paleta ni el tema. Ahora usa `this._color('--ei-x', respaldo)`,
     que lee el valor real con `getComputedStyle`.
  - **Colores escritos a mano en el HTML.** Los `style="color: var(--text-dark)"` del template
     usaban tokens **globales**; se cambiaron por los del módulo (`var(--ei-text-dark)`) y se
     tokenizaron los hex sueltos. Además había un `background: var(--warning)15` (concatenación
     inválida: el navegador la descarta en silencio).
  - **Herramientas de verificación** (están en `.gitignore`, se crean de nuevo si hacen falta):
     `main/_preview-evaluacion.js` renderiza el componente real con un puente simulado y saca
     capturas en claro y oscuro; `main/_preview-modales.js` abre los 5 modales y **mide el
     contraste** de cada texto (ratio WCAG) para detectar texto invisible. Lección del arnés:
     con la ventana **sin mostrar**, Electron mide todo en 0 — hay que usar `win.showInactive()`.
  - Test: `node main/test-evaluacion-inicial-premium.js` (45 checks).
- **🚨 📦760 — ARCHIVO Y RETENCIÓN (2.5.1): el iframe y el backend del Excel tenían nombres
  de campo DISTINTOS.** Es el bug más caro de esta familia de módulos y conviene buscarlo en
  cualquier submódulo que hable con un Excel por `postMessage`. El iframe leía `doc.tipo` y
  `doc.hoja`, y escribía `disposicionFinal` y `tipo`; el backend
  (`archivo-retencion-main.js`, que lee el Excel con ExcelJS) expone OTROS nombres.
  Consecuencias reales que tenía el módulo:
  1. La columna **Tipo** salía siempre `—` y los KPI Documentos/Registros siempre en **0**
     (el backend entrega `tipoDoc`/`tipoReg`/`tipoInterno`/`tipoExterno`, booleanos).
  2. El selector **"Todas las hojas" quedaba vacío** (el backend lo llama `hojaOrigen`).
  3. **Editar Tipo o Disposición Final no se guardaba** (el backend lee `disposicion` y
     parsea `tipo` como texto combinado; `disposicionFinal` no existe allá).
  **Regla:** los nombres del backend NO se usan nunca directo en la vista. Se escribe un
  **adaptador explícito** con dos funciones, `desdeBackend()` (al leer) y `haciaBackend()`
  (al escribir), y TODA mutación pasa por ellas. Al tocar el modelo, verificar contra
  `leerExcelCompleto()` de `archivo-retencion-main.js` (los campos exactos que devuelve).
  Ojo con el orden del handler `actualizar`: primero parsea `tipo` y DESPUÉS aplica los
  booleanos individuales, así que si se mandan, tienen que ser coherentes con el texto.
- **📦760 — Archivo y Retención pasó al diseño premium v2.** Se adoptó el prototipo
  completo (barra superior con migas de pan, 4 tarjetas de KPI con el de archivo muerto
  clicable, filtro por disposición, tabla con fila expandible y edición en línea,
  paginación con números, modal por bloques, esqueleto de carga, ARIA y teclado) y se
  **recableó al puente real** (el prototipo era una demo en memoria SIN puente).
  - **Archivos**: el HTML quedó solo con el marcado; los estilos en
    `archivo-retencion-view.css` y la lógica en `archivo-retencion-view.js`. Los tres
    llevan `?v=` propio y el wrapper (`archivo-retencion.js`) versiona la URL del iframe:
    **sin ese `v=` un rediseño no se ve hasta limpiar la caché**.
  - **Se conservó** lo que el prototipo no traía: edición en línea en Descripción /
    Código / Revisión / Almacenamiento, fila marcada como "sin guardar" y botón
    **Guardar** masivo; y los atajos Ctrl+N / Ctrl+F.
  - **Guardado masivo**: manda un `actualizar` **por fila** (no el `guardar` con la lista
    entera). El backend aplica por `numero`, así que así no se pisan las filas que no se
    tocaron. La respuesta se relee con `leer-todos` para que los números queden alineados.
  - **Modo oscuro completo**: cubre `data-theme="dark"` **y** `data-theme="dark-legacy"`
    (los dos que aplica `scripts/theme-manager.js`) y alcanza barra superior, tarjetas,
    filtros, tabla, fila expandible, modales, paginación, avisos y esqueleto. Antes solo
    estaba el encabezado y la franja de KPIs, y el tema oscuro manual no se aplicaba.
  - **Layout del modal**: es una columna de 3 partes (cabecera fija + cuerpo con scroll +
    pie fijo) con `overflow: hidden` en el contenedor y `min-height: 0` en el cuerpo. Sin
    eso el pie se montaba encima del último campo y "Disposición final" quedaba tapado.
  - **Herramienta**: `main/_preview-archivo.js` (en `.gitignore`) monta la vista real con
    un puente simulado que responde con la forma EXACTA del backend, ejercita filtros,
    búsqueda, orden, expansión, edición en línea, guardado masivo y los dos modales, y saca
    capturas en claro y oscuro. Lección: con la ventana **sin mostrar**, Electron mide todo
    en 0 — hay que usar `win.showInactive()`; y el puente tiene que estar inyectado **antes**
    del script de la vista, o el primer `leer-todos` se pierde.
  - Test: `node main/test-archivo-retencion-premium.js` (50 checks).
- **📦761 — Evaluación Inicial del SG-SST: se adoptó el prototipo premium v2 completo y se
  recableó al backend (segunda pasada sobre el mismo módulo).** Después de 📦759 (que había
  modernizado el módulo conservando su estructura) el usuario trajo un prototipo que **sí
  rediseñaba** la pantalla: barra superior con icono, pestañas con **chip del PDF activo**, 3
  tarjetas de indicadores (las de críticos y planes **clicables**, que llevan a su pestaña),
  **medidor de cumplimiento en SVG** (antes era un `<canvas>`), bloque PHVA con estado vacío,
  tarjeta de archivo fuente, selector de PDF de **dos paneles** con migas, y los modales de
  detalle / formulario / confirmación / **seguimiento** / **responsables**.
  - **Archivos**: `index.html` (solo marcado) + `evaluacion-inicial-view.css` (todo bajo
    `.ev-scope`) + `evaluacion-inicial-view.js`. El componente se exporta como
    `window.EvaluacionInicialView` y mantiene el alias viejo `EvaluacionInicialSgSst`.
  - **Contratos reales que usa** (el prototipo proponía otros que NO existen:
    `listarFuentesEvaluacion`, `cargarEvaluacionPDF`, `createPlan`…): `findSubmodulePath` +
    `readDirectory` para listar los PDF de `Diagnostico Ministerio` / `Diagnostico ARL`,
    `processEvaluacionPdf(pdfPath, sourceType)`, `evaluacionActionPlans.listar/guardar/eliminar`
    y `openPath` para ver el documento. **Volver** usa el callback que pasa `renderer.js`.
  - **Adaptador**: el parser devuelve `findings` con `{code, desc, max, grade, status}` y la
    vista trabaja con `{c, d, max, obt, estado}`; los planes viven en la base y se arman campo
    por campo (`planDesdeBackend` / `planHaciaBackend`). Los estados se traducen incluyendo
    **`parcial`** (el prototipo solo conocía cumple / no cumple).
  - **Lo que el prototipo dejaba como aviso y ahora funciona de verdad**: agregar
    **seguimientos** y gestionar **responsables** (antes mostraba "disponible al integrar").
  - **Modo oscuro completo** con los DOS atributos (`dark` y `dark-legacy`). El prototipo no
    traía ninguno.
  - 🚨 **Lección de EOL de este repo (me pasó tres veces):** `renderer.js` tiene saltos de línea
    **mezclados** por diseño (mezcla de CRLF y LF). El `edit` y `write` los normalizan y el
    diff pasa a mostrar 7.000 líneas cambiadas. Para tocar ese archivo: `git checkout --` para
    restaurarlo y después aplicar el cambio con reemplazos de texto que **no** toquen los
    finales de línea, verificando que el conteo de CRLF/LF quede igual. `git diff --numstat`
    tiene que dar pocas líneas.
  - 🚨 **`CONTEXT.md` es el peor caso: NUNCA usar `edit` ni `write` sobre él.** Además de mezclar

- 🚨 **`sitio/` y la rama `gh-pages` son el MISMO contenido en dos lugares, y solo uno es la
  fuente.** `sitio/` (en `Dev`) es la fuente real; `gh-pages` es una copia *generada* para que
  GitHub Pages la sirva entera como raíz del sitio. Si editás una, hay que regenerar la otra
  o el sitio público queda desactualizado sin que nada avise. La rama se construyó con
  `git hash-object` + `mktree` + `commit-tree` + `update-ref`, **sin `git checkout --orphan`**:
  el checkout vacía el árbol de la rama actual y en el worktree del owner había cambios SIN
  COMMITEAR (el ancho de la tarjeta de ingreso, que no tenía número de paquete). Ese camino no los tocaba.
- 🚨 **El sitio legal NO va en `docs/`.** `docs/` ya tenía contenido interno (protocolos SST,
  planes de gestión, `investigacion-seguimiento-embarazo-sst-colombia.md`). GitHub Pages desde
  la raíz o desde `docs/` publica **todo** como sitio web oficial; desde `gh-pages` publica
  solo `sitio/`. Verificado: `/docs/`, `/Portear/` y `/sgsst-electron-app/` devuelven 404 en
  `reivaj640.github.io/SG-SST-E/`.
- 📌 **Estado de Google Auth Platform (2026-10-06):** el proyecto `KAIR Calendar Sync`
  (`kair-calendar-sync`) está en **"En producción"**, con los 5 scopes declarados y coincidentes
  con los que pide `google-auth.js`. La app sigue SIN verificar, así que cada persona ve el
  aviso de "app no verificada" al autorizar (normal con scopes restringidos). Tope de **100
  usuarios de por vida del proyecto, sin reset**. La app NO puede pasar a Production si el
  repo es privado: `publish: {provider: "github"}` + electron-updater sin token ⇒ 404 en la
  API de releases ⇒ todos los clientes dejan de actualizar. De ahí que las credenciales
  vivan en `.env` y no en el archivo versionado.
- 📌 **El correo de soporte del sitio es `adminkair@gmail.com`** — ya NO es provisorio
  (`e373fdce`). Si algún día cambia, va en **tres** lugares: `sitio/soporte.html`, el correo de
  asistencia de Google Auth Platform y esta documentación; y después hay que regenerar
  `gh-pages`. Ojo con `privacidad.html`: se corrigió una afirmación falsa que daba
  `firma.k-air.com` por el servidor de firma, cuando la URL sale de `secrets.enc` y la
  configura cada empresa (`main/firma-bridge.js:571-576`).
    CRLF y LF, usa separadores `\r\r\r\n` (CR CR CR LF) en los bloques de novedades. El editor
    los aplana a CRLF y el diff pasa de unas 40 líneas a **4.262**. Pasó dos veces en 📦868 y
    arruinó los cambios: el arreglo fue `git checkout --` y re-aplicar TODO con un script de
    Node que parte de `git show HEAD:<ruta>`, **detecta el separador real del punto de inserción**
    (`/(\r\r\n|\r\n|\n)$/` sobre los 6 bytes previos al ancla) y une el texto nuevo con ese mismo
    separador. Siempre re-correr `kair-comparar-eol.js` después de tocar docs: es el único que
    avisa.
  - **Herramienta**: `main/_preview-evaluacion-v2.js` (en `.gitignore`) monta la vista real con
    un backend simulado que responde con la forma EXACTA del parser, y ejercita todo el flujo
    (cargar PDF, tabs, búsqueda, planes, seguimiento, responsables, eliminar, volver) sacando
    capturas en claro y oscuro.
  - Tests: `node main/test-evaluacion-inicial-v2.js` (64 checks, nuevo). El test de 📦759
    (`test-evaluacion-inicial-premium.js`) se conservó reducido a lo que sigue vigente
    (modo oscuro y que no vuelva el CSS global), 43 checks.
  - 🚨 **EL ERROR QUE HAY QUE NO REPETIR AL ADOPTAR UN PROTOTIPO (bug real del 📦761):**
    el prototipo del módulo venía como un **documento HTML completo** con su marcado en
    el `<body>`. Se dejó el marcado en el `index.html` del módulo y el componente solo
    hacía `document.getElementById('ev-root')` — **y el submódulo quedaba en blanco** con
    `[K+AIREVAL][MODULO][INIT][ERR] no se encontró el marcado del módulo`.
    Por qué: este componente **no se monta por iframe** (a diferencia de Archivo y
    Retención). `renderer.js` hace `new Componente(contenedor, ...)` y llama `render()`
    con un contenedor del **documento principal**; el `index.html` del módulo **nunca se
    carga**. Conclusión: **el componente tiene que inyectar su propio marcado** en
    `render()` (`marcadoVista()` devuelve el HTML embebido y se hace
    `contenedor.innerHTML`). El `index.html` queda solo como envoltorio para abrir la
    vista suelta en desarrollo.
    **Regla general, antes de adoptar cualquier prototipo:** averiguar CÓMO se monta el
    submódulo (`iframe` vs `new Componente(contenedor)`) y de dónde sale su marcado. Si
    es `new Componente(...)`, el HTML del prototipo se embebe en el `.js`; si es iframe,
    el HTML se queda como archivo y el wrapper versiona la URL.
  - **Los modales se mueven al `<body>` y los estilos tienen que contemplarlo.** Como los
    modales son `position: fixed`, adentro de un contenedor con `flex`/`transform` `fixed`
    se comporta como `absolute` y no cubre la ventana. Se mueven al `<body>` con la clase
    `ev-scope` puesta, así que las reglas de modales se escriben **de las dos formas**
    (`.ev-scope .overlay, .ev-scope.overlay { … }`). Los tokens se movieron a `:root`
    justamente para que esos nodos no se queden sin colores. Y `destroy()` los saca del
    `<body>` para no dejarlos colgados.
  - **Truco de verificación de geometría** (más confiable que la captura): medir el
    `getBoundingClientRect()` del modal y del velo contra `window.innerWidth/Height`.
    En este módulo dio `overlay: [0,0,1440,980]` con ventana `1440×980` → encaja perfecto.
    Ojo: `capturePage()` puede devolver una imagen mal compuesta (en esta sesión pintó un
    rectángulo blanco de exactamente 720×490, o sea **la mitad** de la ventana) — cuando
    la medida dice que encaja y la captura no, **gana la medida**.
  - 🚨🚨 **LA APP CARGA BOOTSTRAP 5.3 DESDE INTERNET Y SUS CLASES CHOCAN CON LAS NUESTRAS
    (bug real del 📦761, el más caro de la sesión).** El módulo se veía perfecto en el
    entorno de pruebas pero en la app el modal quedaba **pegado arriba a la izquierda y
    estirado a todo el alto** (medido: 420 × 617 en vez de 420 × 285) y el velo oscuro no
    cubría la pantalla. Causa: `index.html` carga
    `https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css`, y Bootstrap
    define `.modal { position: fixed; top:0; left:0; width:100%; height:100%; overflow:auto;
    z-index:1055 }` (más `.modal-dialog`, `.modal-content`, `.modal-open`…).
    **Cómo diagnosticarlo (receta que sirvió):** enumerar el CSSOM y ver qué reglas matchean
    el nodo:
    ```js
    for (const ss of document.styleSheets) {
      let reglas; try { reglas = ss.cssRules } catch { continue }
      for (const r of reglas) {
        if (!r.selectorText || !r.style) continue;
        if (r.style.getPropertyValue('position') && el.matches(r.selectorText))
          console.log(ss.href, r.selectorText, r.style.getPropertyValue('position'));
      }
    }
    ```
    Eso devolvió `bootstrap.min.css :: .modal { position: fixed }` y cerró el caso.
    **Tres reglas para que no vuelva a pasar:**
    1. **Antes de adoptar un diseño, revisar si sus clases ya existen en Bootstrap.**
       Las que usa este módulo y Bootstrap también define: `modal`, `card`, `row`, `btn`,
       `text-*`, `d-*`, `search`, `badge`, `toast`, `container`. Bootstrap gana en las
       propiedades que NO declaramos (su `.modal` obligaba a `position`, `width`, `height`,
       `top`, `left`). Hay que **neutralizarlas explícitamente** y no confiar en que "nuestra
       clase pesa más".
    2. **Bootstrap tiene que cargarse ANTES que las hojas propias de la app.** Estaba al
       final de la lista de `<link>`, así que le ganaba a todo lo que no declarara la
       propiedad. Se movió al principio de `index.html` (una librería externa va debajo).
       Verificado: **ninguna hoja propia de la app define `.modal`** (0 reglas en `styles.css`,
       `development-styles.css` y las de `shared/`), así que moverlo no cambia nada más.
    3. **El test aislado NO alcanza.** Hay que probar con las hojas de la app cargadas, o al
       menos con Bootstrap. Nuevo test: `manual-test-evaluacion-inicial-bootstrap.js` (22 checks)
       monta el módulo con Bootstrap cargado y **mide la geometría** del modal (posición,
       alto, centrado, y que las tarjetas no hereden el fondo de Bootstrap). Usa una copia
       local `main/_bootstrap-5.3.0.min.css` para no depender de la conexión.
- **📦762 — EVALUACIONES MÉDICAS OCUPACIONALES (3.1.4): el módulo NO guardaba nada y pasó al
  premium v2 con los certificados persistidos.** Antes era un **explorador de carpetas**
  (`getDocumentFolders` + `readDirectory`): no existía ningún registro de trabajador, examen,
  concepto de aptitud ni vencimiento. Se adoptó el prototipo `kair-evaluaciones-medicas.html`
  y se le agregó la base.
  - **Archivos**: `evaluaciones-medicas-v2.js` (componente + marcado EMBEBIDO), `.css` (todo
    bajo `.emo-scope`) y `.html` (copia legible del marcado). Puente:
    `main/evaluaciones-medicas-bridge.js` (tabla `evaluaciones_medicas_certificados`).
  - **Cómo se monta**: igual que 📦761 — **NO es iframe**, `renderer.js` le pasa un contenedor
    del documento principal, así que el componente inyecta su propio marcado. Y hay **dos**
    globals con el mismo nombre: `evaluaciones-medicas-logic.js` (el módulo viejo, que sigue
    cargado) define `window.EvaluacionesMedicasComponent` y el nuevo también; **el orden de
    los `<script>` decide** y el nuevo va DESPUÉS. Es frágil: si alguien reordena, vuelve el
    viejo y con él su CSS global. Conviene sacar ese `<script>`.
  - **Regla legal que gobierna el diseño**: Res. 2346 de 2007 art. 12 — cada evaluación es un
    evento sanitario independiente. **Renovar NO modifica ni borra el certificado anterior**:
    agrega uno nuevo enlazado por `certificado_origen`, y el detalle muestra el historial del
    trabajador por cédula. El diagnóstico clínico no se archiva (solo el concepto y las
    recomendaciones laborales) y "Apto con recomendaciones" **exige** cargarlas.
  - 🚨🚨 **EL BUG MÁS CARO DE ESTE PAQUETE: la hoja NO estaba linkeada en `index.html`.**
    Se conectó el `<script>` y **se olvidó el `<link rel="stylesheet">`**. Síntoma en la app:
    la pantalla quedaba casi vacía con **un dibujo gigante** y el módulo medía **26.259 px de
    alto** (26 veces la ventana). Causa: **un `<svg>` sin tamaño efectivo se estira a todo el
    ancho de su contenedor**; el módulo tiene 42 iconos y sin CSS ninguno quedaba acotado
    (se midieron SVGs de 1440×1440 dentro de los iconos). Diagnóstico que lo cerró: enumerar
    el CSSOM y ver que **la hoja no aparecía** entre las cargadas (`hojas: []`), y medir los
    15 elementos más grandes del módulo. Con la hoja cargada: 311 reglas, icono 20×20, y el
    módulo vuelve a medir la ventana (980 px) sin nada desbordado.
    **Regla: al adoptar un diseño, verificar LOS DOS enganches — el script Y la hoja.** Y si
    se ve un gráfico enorme, sospechar del CSS que no cargó, no del SVG.
  - **Cómo se construyó (y por qué el CSS/JS son la fuente de verdad)**: el prototipo reusaba
    nombres que ya existen en la app (`kair-card`, `kair-header`, `kair-modal`, `kair-table`)
    y en Bootstrap (`modal`, `card`, `btn`, `overlay`). Se pasó una vez por un script de
    migración que: (1) prefijó **todas** las clases a `emo-`; (2) puso **todos** los selectores
    —incluidos los de etiqueta (`body`, `h1`, `button`)— bajo `.emo-scope`; (3) movió los
    tokens del prototipo de `:root` a `.emo-scope` porque la app **ya usa `--kair-*`** con
    otros valores y dejarlos sueltos **pisaba la paleta de toda la aplicación**; (4) embebió el
    marcado en el `.js`. Ese script se retiró: **ahora se edita el CSS y el JS a mano**, con
    las dos reglas marcadas en el encabezado de la hoja.
  - **Modo oscuro agregado de cero** (el prototipo no traía ninguno), cubriendo los DOS
    atributos de la app y con los nombres de token **del prototipo**, no los de la app.
  - **Piezas que la lógica genera y la hoja no tenía**: los contenedores de texto de las filas
    de lista necesitan `display:flex;flex-direction:column` (el prototipo usaba `<div>` y la
    lógica usa `<span>`: sin eso el nombre y el detalle salían pegados en la misma línea), y
    la paginación viene en el marcado con el atributo `hidden`, así que hay que mostrarla.
    **Regla: si la lógica genera HTML, verificar que cada clase generada tenga regla en la
    hoja** (el test lo comprueba).
  - Test: `node main/test-evaluaciones-medicas-v2.js` (**85 checks**). Verificación visual con
    montaje real y puente simulado: `npx electron main/_preview-emo.js`.
  - **Pendiente heredado del home de Salud: RESUELTO en 📦763** (ver la entrada siguiente).
- **📦763 — HOME DE GESTIÓN DE LA SALUD: el error de consola era DOS problemas distintos, y el
  mensaje apuntaba al lugar equivocado.** El síntoma era:
  `[SALUD] Error refrescando estadísticas: TypeError: Cannot read properties of undefined
  (reading 'cache')` en `gestion-salud-home.js` al abrir el módulo.
  - **(1) `window._saludHomeState` no se creaba en NINGÚN archivo.** El home usa esa memoria de
    sesión (`.cache` y `.lastUpdate`, dos `Map` por empresa) en `refreshStats` y en un
    `renderMainArea` viejo, pero nadie la definía. Se define al cargar el archivo, de forma
    idempotente (`= window._saludHomeState || {…}`) y además la escritura queda protegida con
    un `if (!window._saludHomeState)` para que nunca pueda volver a cortar la carga.
  - **(2) El mensaje NO venía de la caché.** El texto "reading 'cache'" engañaba: el error real
    se lanzaba en `updateWidgetsUI`, cuyas guardas eran `if (data.X && this.widgets.X)` y
    **`this.widgets` nunca se inicializa** (es del sistema de widgets viejo que el rediseño
    premium dejó sin usar; los `create*Widget()` son código muerto). La segunda mitad de la
    guarda leía `this.widgets.ausentismo` → TypeError, y el `catch` de `refreshStats` lo
    reportaba con el texto de "refrescando estadísticas". **Lección: cuando el mensaje de un
    error señala una propiedad, leer el STACK, no confiar en el texto** (el nombre de la
    propiedad del mensaje es el que se estaba leyendo, no necesariamente el que falla). Se
    agregó un `if (!this.widgets) return;` al principio y se protegió la llamada a
    `renderIndicesChart` con `typeof … === 'function'`.
  - **(3) `this.saludStats` NUNCA se asignaba.** El render activo (`renderMainArea`, el de más
    abajo del archivo — hay un `renderMainArea` viejo antes que quedó anulado) lee
    `this.saludStats || {}`, así que el home mostraba todo en 0 aunque el backend tuviera
    datos. Los datos se guardaban solo en la caché de sesión, que nadie leía. Ahora se asigna.
  - **(4) Los nombres de campo del backend NO son los que lee el render.** Medido con la
    empresa real (`Tempoactiva`), las 7 respuestas son:
    `ausentismo → {pendientes, activos, cerrados, total}` · `accidentes → {totalYear, mesActual,
    mensual[12]}` · `examenes → {totalYear, mesActual}` · `seguimientos → {totalAnio,
    realizadosAnio, totalMes, realizadosMes}` · `recursos → {stats}` (puede ser `null`) ·
    `remisiones → success:false 'Empresa no configurada'` · `indicadores → success:false
    COMPANY_NOT_FOUND`. El render espera `totalExamenes/realizados/pendientes`,
    `total/completados/pendientes`, `total/investigados/pendientes`, `tasaAusentismo/
    totalTrabajadores`. Se agregó el adaptador `_adaptarRespuestasSalud()` con el mapeo
    documentado, a prueba de fallos (`r = r || {}`) y **sin inventar** los datos que el backend
    no informa (`totalTrabajadores` y `tasaAusentismo` quedan en 0 para no calcular una tasa
    falsa; los casos de ausentismo se exponen aparte como `totalCasos`).
  - **Cómo se diagnosticó** (receta reutilizable): se corrió el home real dentro de la app
    cargando el archivo por `executeJavaScript`, se envolvió el método sospechoso para registrar
    qué recibe, y se capturó **el stack completo** interceptando `console.error`. Eso dio
    `at GestionSaludHome.updateWidgetsUI (<anonymous>:263:45)` y desmintió la hipótesis inicial.
  - **Cache-bust**: se bumpeó el `?v=` del home en `index.html` a
    `GESTION-SALUD-20260918-fix-home-cache`, y se actualizó la versión esperada en
    `test-chart-overflow.js` (que la fija por módulo).
  - Test: `node main/test-gestion-salud-home.js` (**26 checks**). Verificación en la app real:
    correr el home y afirmar que **no** aparece ningún error de consola.
- **📦766 — AUDITORÍA DE EMO (3.1.4): fuga crítica de estilos al documento principal + higiene.**
  El portal viejo (`evaluaciones-medicas-home.html`) se inyecta con `innerHTML` en el DOM
  global (`evaluaciones-medicas-logic.js → loadPortalHome`), y su `<style>` traía `:root`,
  `body` y `*` sueltos: al inyectarse, **pisaban las variables del design system global**
  (`--primary`, `--bg-card`, `--text-muted`, `--border`, `--radius`, `--shadow-lg`) para toda
  la app, y el reset `*` borraba márgenes/rellenos de todos los módulos. Además traía
  `<link>` a Font Awesome y Google Fonts que también cargaban en global.
  - **Fix P0 (doble candado)**: (1) todo el bloque `<style>` del portal quedó **acotado a
    `#em-portal-container`** (cada selector, incluidas las reglas de una línea y las
    `@media`), las variables pasaron de `:root` a ese contenedor y las fuentes externas se
    cambiaron por la pila del sistema; (2) en `logic.js` el HTML recibido por `fetch` se
    sanitiza con `html.replace(/<link[^>]*>/gi, '')` **antes** del `innerHTML`.
  - **Fix P1 (muertos)**: eliminados `index.js` (CommonJS sin uso), `evaluaciones-component.js`
    (apuntaba a `evaluaciones-viewer.html`, que no existe) y `evaluaciones-medicas-v2-markup.html`
    (copia estática del marcado embebido en el v2; nadie lo cargaba).
  - **Fix P2 (prevención viewer)**: `evaluaciones-medicas-view.css` definía `:root { --em-* }`.
    Vivía solo en el iframe, pero si algún día se linkeaba en `index.html` filtraría. Ahora
    las variables y el reset están en `body.em-viewer-scope` y el `<body>` de
    `evaluaciones-medicas-view.html` lleva esa clase — fuera del iframe las reglas no
    coinciden con nada y no pueden fugar.
  - **Fix P3 (offline)**: los 8 iconos Font Awesome del portal (`fa-arrow-left`,
    `fa-stethoscope`, `fa-file-medical`, `fa-plus-circle`, `fa-chart-pie`, `fa-clock`,
    `fa-file-export`, `fa-shield-alt`) se reemplazaron por **SVG inline** estilo Lucide
    (`stroke="currentColor"`, dimensionados con `#em-portal-container svg { width:1em; height:1em }`),
    y se quitó el CDN. OJO: `evaluaciones-medicas-view.html` y `exportar-informe-seguimiento.html`
    (ventana nueva) **siguen con Font Awesome CDN** — queda como deuda conocida (funcionan,
    pero sin internet no cargan iconos).
  - **Regla durable**: cuando un HTML se inyecta con `innerHTML` en el DOM principal, su
    `<style>` se activa en GLOBAL. Acotar todo a un contenedor propio (`#id`) y sanitizar
    `<link>` antes de inyectar. Nunca confiar en que "solo se usa dentro de su módulo".
- **📦767 — EMO (3.1.4): adjuntar el PDF que entrega la IPS con diálogo nativo + copia por
  año.** Antes "adjuntar" solo elegía entre los archivos que ya estaban en la carpeta del
  módulo (con un `prompt` numerado). Ahora el canal `evaluaciones-medicas:adjuntar-certificado`
  (puente) abre `dialog.showOpenDialog`, copia el PDF a
  `<empresa>/3. Gestión de la Salud/3.1.4 Evaluaciones médicas/3.1.4.1. Certificados de
  Aptitud Medica/<AÑO del examen>/` y devuelve la ruta final que se guarda en el registro.
  - `_resolverSubcarpeta(base, prefijo, clave, nombreCanonico)`: encuentra la carpeta real
    aunque varíe el nombre ("3. Gestión de la Salud", "3. Gestion de la salud"…) y la crea
    con nombre canónico si falta. Verificado contra la estructura real del Drive.
  - El año sale de la fecha del examen del formulario (`#rm-fecha`); sin fecha, año actual.
  - Nunca pisa un archivo: "CARELIS CARIDAD (1).pdf". El renderer trata `CANCELADO` en
    silencio (el usuario cerró el diálogo).
  - Cache-bump: `EMO-20260918-v3-adjuntar-pdf`. Test: 89 checks (`_handlerAdjuntar` y
    `_resolverSubcarpeta` exportados para pruebas).
  - **📦767-fix (modal)**: `abrirOverlay('modal-cert')` ponía `emo-is-open` en el modal
    INTERNO, pero la visibilidad la controla la CAPA (`.emo-kair-overlay.emo-is-open`), así
    que el formulario "abría" en el log y nunca se mostraba. `_capaOverlay(id)` resuelve la
    capa padre cuando le pasan el modal. Mismo caso con el clic en el fondo: buscaba clases
    viejas (`emo-overlay`) cuando el diseño usa `emo-kair-overlay`/`emo-kair-backdrop`. El
    test de humo ahora atrapa ambos (cada `abrirOverlay('…')` debe apuntar a una capa).
- **📦768 — EMO (3.1.4): al adjuntar el PDF de la IPS, el formulario se pre-llena solo.**
  Reutiliza `utils/remisionUtils.js` (la MISMA extracción de texto del submódulo de
  restricciones médicas, pdf-parse). El puente expone `evaluaciones-medicas:extraer-certificado`
  → `extraerDatosCertificado(text)` con regexes del formato "CONCEPTO OCUPACIONAL" de las IPS
  (probado con Comfamiliar Atlántico): nombre, cédula, cargo, tipo (normalizado al catálogo),
  IPS (primera línea), fecha de atención (→ ISO), concepto (`CONCEPTO MEDICO OCUPACIONAL:` →
  APTO / APTO CON RECOMENDACIONES / APLAZADO / NO APTO) y recomendaciones. El renderer
  (`rellenarDesdePdf`) llena SOLO los campos vacíos: lo que el usuario escribió no se toca.
  Si el formato no se reconoce (sin cédula ni nombre), avisa y deja el formulario intacto.
  - Cache-bump: `EMO-20260918-v5-lectura-pdf`. Test: 95 checks, incluida la unidad del
    extractor con texto real embebido. Verificado de punta a punta con un PDF real del Drive.
- **📦769 — EMO (3.1.4): la pantalla ahora aprovecha TODO el ancho + el header del 2.9.1.**
  - **El ancho:** `.emo-kair-main` tenía `max-width: 1240px; margin: 0 auto`, que **centra** el
    contenido y deja franjas vacías que CRECEN con la ventana. Medido en la app: a 1800 px de
    ancho se perdían **273 px a la izquierda y 288 a la derecha (561 px en total)**, y a 1366 px
    todavía se perdían 56 + 71 px. Afectaba justo a lo que más ancho necesita: las 4 tarjetas de
    indicadores, las dos columnas del resumen y la tabla de certificados.
    **Fix:** `max-width: none; margin: 0` y el aire de los costados pasa a ser proporcional
    (`padding: clamp(14px, 1.6vw, 26px) clamp(14px, 1.8vw, 34px) 32px`) para que en pantallas
    chicas el relleno no coma contenido. Además el buscador tenía un tope fijo de 340 px
    pensado para el layout angosto: ahora `max-width: clamp(340px, 26vw, 520px)`.
    Medido después: a 1800 px el contenido mide **1800 (0 px perdidos de cada lado)**, las
    columnas del resumen pasan de 750 a **994 px**, y en los tres anchos probados (1800/1366/1024)
    y los tres temas (claro/`dark`/`dark-legacy`) **no hay desborde horizontal**. El relleno
    escala solo: 26 px a 1684 px de ancho, 14,4 px a 900. Cache-bump:
    `EMO-20260918-v8-tabla-altura-fix-ancho-completo`.
  - **La regla general (vale para cualquier módulo):** un `max-width` con `margin: 0 auto` en el
    contenedor de contenido es una decisión de diseño, no un detalle. Si la pantalla va a mostrar
    tablas o grillas de indicadores, ese tope **desperdicia el ancho de las pantallas grandes**.
    Antes de dejarlo, medir `getBoundingClientRect()` del contenedor contra `window.innerWidth`.
  - **El header del 2.9.1 (📦764):** su bloque de reglas está al final de
    `evaluacion-proveedores.css` y lleva **`!important` a propósito**. Motivo: en la app,
    **ninguna regla `.ep-header*` de ninguna hoja llegaba a aplicarse** —verificado recorriendo
    el CSSOM completo: 0 reglas con `ep-header` matchean el nodo, y no hay estilos en línea—,
    pese a que la hoja carga (245 reglas), el `<link>` está bien puesto, el contenedor
    `.evaluacion-proveedores` existe en el `<body>` y el elemento **coincide** con el selector
    (`h.matches('.evaluacion-proveedores .ep-header') === true`). Síntoma: el header medía
    **1678 px de alto**, el icono quedaba `display: inline` con ancho `auto` y los botones
    caían 1517 px más abajo. Con `!important` el header baja a **194 px** y el icono recupera
    su caja de 44×44; sin `!important` vuelve a romperse (probado ida y vuelta). Es una
    excepción deliberada a la regla de "no usar `!important`": **si algún día se encuentra la
    causa, hay que sacarlos**.
  - ⚠️ **Hallazgo sin cerrar (no bloquea al usuario):** en los arneses de diagnóstico, al montar
    el componente 2.9.1 por `executeJavaScript` **el `<link>` de su hoja desaparece del DOM**
    (las hojas bajan de 35 a 28 y la del módulo ya no está). No se pudo aislar la causa, y no se
    descarta que sea un artefacto del arnés (el `document` que se consulta podría no ser el mismo
    que recibe el montaje). **No se pudo confirmar el header en la app real por esta vía.** Si
    aparece un problema visual en 2.9.1, empezar por acá.
  - **Cómo se midió** (receta reutilizable para "desperdicio de ancho"): montar la vista en una
    ventana a 1800/1366/1024 y comparar `getBoundingClientRect()` del contenedor contra
    `window.innerWidth`, mirando `maxWidth`, `marginLeft/Right` y `paddingLeft` calculados, más
    `document.documentElement.scrollWidth` para descartar desborde horizontal.
- **📦810 — GESTIÓN HUMANA: saneamiento pre-migración (P0/P1/P2 de la auditoría).** Antes de la
  migración premium vista por vista se limpiaron los 5 hallazgos críticos. **SIN rediseño visual**:
  misma cara en claro, misma estructura; solo deja de romper al resto y ya tiene modo oscuro.
  - **P0 · Carpetas envenenaba los tokens GLOBALES.** `carpetas/index.css` declaraba 26 tokens
    `--kair-*` en `:root` (5 chocaban con el DS oficial: `--kair-surface/-text/-track/-shadow-card/
    -transition`) y clases `.kair-btn/.kair-card` sin scope que chocaban con
    `shared/kair-components.css`. Como SIEMPRE se carga en `index.html`, pisaba el DS de toda la
    app con valores distintos (su transición 160ms le ganaba a la oficial 180ms, su
    `--kair-text #1a1a2e` al oficial `#14213d`). **Fix:** TODA la hoja quedó acotada bajo
    `.carp-scope` (los 145 selectores con un script de transformación) y el bloque `:root` pasó a
    `.carp-scope`, que el componente pone en su contenedor en `render()` (los modales también
    cuelgan del contenedor, así que quedan cubiertos). Verificado en la app real: el root queda
    con los valores del DS y dentro de Carpetas viven los suyos. **Mismo bug que 📦759/📦766,
    versión tokens — regla idéntica: tokens del prototipo JAMÁS en `:root`.**
  - **P1 · Vista "Documentos" era código muerto cargándose en cada arranque** (88,6 KB JS + 695
    líneas CSS + 12,9 KB HTML): el shell la reemplazó por Carpetas (commit `79b0fe02`) y ya no
    hay `case 'documentos'` en `gestion-humana-home.js`. Se QUITÓ la carga en `index.html`
    (css + js). **La carpeta NO se borra**: `docs/kair-firma-integration/INTEGRATION.md` dice que
    ahí vive la "firma operativa interna" (canvas + `gh_firmas_digitales`) y NO se elimina; queda
    dormida y documentada con un comentario en `index.html`.
  - **P1 · Modo oscuro 0% → cubierto en las 11 hojas del módulo** (shell + kpi-bar + 9 vistas con
    CSS). Se hizo de forma SISTEMÁTICA con dos codemods (ambos borrados tras usarse; se pueden
    regenerar de esta entrada):
    1. **Overlay CSS append-only**: script que recorre cada regla, y si una declaración tiene un
       color claro escrito a mano, emite al final del archivo `[data-theme="dark"] sel, [data-theme="dark-legacy"] sel { … }`
       mapeando los hex claros a los tokens de `styles.css` (`--bg-color`, `--widget-bg-color`,
       `--border-color`, `--text-color`, `--text-light-color`, `--text-lighter-color`,
       `--primary-color`, `--success/danger/warning-color`, `--box-shadow(-lg)`), que **ya tienen
       los dos temas definidos** → un solo overlay cubre los dos modos. 481 reglas generadas.
       ⚠️ Gotcha del parser: un comentario `/* … */` pegado a la declaración invalidaba el
       mapeo (`prop` quedaba "/* c */ background"); hay que limpiar comentarios de las
       declaraciones antes de mapear.
    2. **Codemod de estilos en línea** (los `style="…#hex…"` y `.style.cssText` del JS le ganan a
       cualquier overlay — caso real: la `.kair-card` de Carpetas con `background:white` en línea):
       reemplaza SOLO hexes mapeables dentro de strings de estilo por `var(--token)` (120
       reemplazos en 9 vistas; `documentos/` se saltó a propósito por estar dormida).
    3. Carpetas, que es token-based, además redeclara sus 26 tokens en oscuro bajo
       `[data-theme="dark"] .carp-scope` y una regla extra para su `.kair-card`, que hereda de la
       hoja GLOBAL (los tokens del DS `--kair-*` no tienen variante oscura: cuando una vista
       premium viva dentro de otra hoja, sus `--kair-card/line` siguen claros — hay que oscurecer
       a mano lo que se herede del DS).
  - **P2 · Font Awesome: se quitó el CDN duplicado.** `index.html` cargaba FA 6.5 desde cdnjs
    (línea 34) Y la copia local `assets/css/font-awesome.min.css` (línea 65, con webfonts locales
    verificadas). Doble descarga y dependencia de internet al pedo: quedó solo la local.
    La migración FA → SVG Lucide queda para la migración premium vista por vista (277 iconos,
    69 en firma-electronica — es estética, no urgencia).
  - **P2 · Heterogeneidad de diseño (azul #174ea6, radios 0,4rem, sin clamp):** es la migración
    misma, se hace después por vista con el usuario. Este paquete solo saneó.
  - **Cache-bust**: las 11 hojas GH + sus 12 JS quedaron con `?v=GH-20260923-p0-dark-scopes`
    (antes NO tenían versión — regla del repo: tocar archivo propio = bumpear su `?v=`).
  - **Verificación real**: arnés `main/_audit-gh.js` (borrado; recreable) montó el shell en
    Electron real y midió: tokens globales intactos tras abrir Carpetas, shell/header/content
    oscuros en AMBOS temas, y barrido de las 9 vistas sin wrappers blancos en oscuro — 28/28 OK.
    Gotcha del arnés: `getComputedStyle` de un custom property devuelve el valor CON las var()
    resueltas (esperar `#2d3748`, no el texto `var(--widget-bg-color)`); y caminar el CSSOM de
    hojas `file://`/CDN puede lanzar SecurityError — para depurar reglas mejor `el.matches()` +
    `getComputedStyle`.
  - **Comprobado sin relación con este paquete:** `test-gestion-humana-bridge-write.js` falla con
    2 checks (pasoActual) ya en HEAD limpio — preexistente (📦807-809, sesión concurrente), NO es
    de este trabajo. `test-chart-overflow.js` 18/20 también falla en HEAD limpio por lo mismo.
- **📦811 — GESTIÓN HUMANA · SHELL + HOME premium (v0.3.0) + BUG LATENTE DE TOASTS.**
  Primer paquete de la migración premium vista por vista (tras el saneamiento 📦810).
  - **Diseño** (el aprobado por el usuario en Evaluación Inicial/EMO/2.9.1): header con badge de
    ícono 44×44 (`--gh-accent-soft/--gh-accent`), título Manrope 800/20, subtítulo 12.5 muted
    **con la empresa activa** (antes venía QUEMADO "TEMPOACTIVA EST S.A.S." — ahora lo llena
    `_updateSubtitle()` tras inyectar el marcado); tabs con subrayado e **iconos SVG inline**
    (diccionario `GH_SVG` + `ghSvg()`, 13 trazos estilo Lucide: grid, chart, userplus, folder,
    filepen, shield, users, umbrella, filemed, megaphone, bell, chevron, pulse, checkflag) —
    **Font Awesome queda FUERA del shell** (sigue en las vistas hijas hasta su propia migración);
    home = hero (gradiente ink→accent + stat grande "trabajadores activos") + 3 métricas
    (en proceso/completadas/canceladas) + grid de 9 tarjetas `.gh-mod` de área con tile teñido
    por acento propio, chips de KPI cuando hay datos (Base de Personal, Contratación) y chevón
    que se ilumina al pasar el mouse. **Todo el ancho disponible** (sin `max-width` + `margin:auto`):
    padding lateral `clamp(16px,2vw,28px)` (📦769). Ancho de ventana < 1200 sigue colapsando las
    tabs a `shortLabel` (📦716, se conservó).
  - **Temas sin pelear con el DS:** las superficies usan los tokens de `styles.css`
    (`--widget-bg-color`, `--bg-color`, `--border-color`, `--text-*`, `--box-shadow`) que YA tienen
    los dos modos oscuros; los acentos de marca son `--gh-*` declarados en `.gh-shell` con su
    bloque oscuro (`#2057b8` claro → `#6aa5ff` en dark). Así no se depende de que el DS tenga
    variantes oscuras (no las tiene — ojo al heredar `--kair-card/#fff` de `kair-components.css`).
  - **Clases históricas conservadas** (`gh-shell`, `gh-header`, `gh-tabs`, `gh-tab`, `gh-content`,
    `gh-bell-*`) → el overlay de 📦810 y el resto del módulo no se rompen. El marcado del shell
    vive en `gestion-humana-home.html` + fallback inline en `_fetchShellHtml()` y **los dos
    coinciden** (⚠️ el `fetch()` falla en arneses sueltos porque resuelve relativo a la página;
    en la app funciona relativo a `index.html` — el fallback es el respaldo).
  - **Limpieza:** eliminados `_renderCarpetasView` (vista-placeholder vieja ya montada por
    `CarpetasComponent`) y `_nitFromCompany` (sin uso desde que se quitó el badge NIT).
  - 🐛 **BUG LATENTE ENCONTRADO POR EL ARNÉS (venía de fábrica):** en 5 vistas el helper de toasts
    estaba declarado como MÉTODO `_toast() {}` pero se llamaba como PROPIEDAD `this._toast.error(...)`
    → `TypeError: this._toast.error is not a function` en TODA ruta de error (explotaba el catch).
    Otras 3 vistas ya lo tenían bien (`get _toast() {}`) y firma-electronica usa
    `Object.defineProperty`. **Fix uniforme:** `_toast() {` → `get _toast() {` y el único llamado
    `this._toast()` interno (en `_showToast`) → `this._toast`, en base-personal (22 sitios),
    afiliaciones (2), permisos (8), dashboard (1), trabajador-detalle (1). `documentos/` se saltó
    (dormida, 📦810). Moraleja: al homogeneizar APIs en un módulo viejo, verificar que declaración
    y llamada sean del MISMO tipo (método vs getter) — `node --check` no lo atrapa, solo explota
    en runtime cuando el camino de error se ejecuta.
  - **Verificación real** (arnés `main/_preview-gh811.js`, borrado tras usar): monta el shell en
    la app real con `Tempoactiva`, valida 28 checks (badge 44px + SVG, subtítulo con empresa, 10
    tabs sin FA, hero/métricas/9 cards, click en card navega y marca el tab, sin desborde
    horizontal a 1600 y a 1000 con shortLabel, fondos oscuros en `dark` y `dark-legacy`, 0 errores
    de consola). **Nota de arnés:** `capturePage()` salía en BLANCO o mostraba el splash
    (`#kair-splash` lo tapa todo) — en este entorno gana la medición, no el píxel; para captura
    real, ventana visible + PowerShell GDI `CopyFromScreen`, y OJO: lanzar dos Electron a la vez
    con el mismo archivo de salida bloquea el segundo.
  - Cache-bust: `gestion-humana-home.css/js` → `GH-20260923-v2-premium-shell`; los 5 JS del fix de
    toasts → `GH-20260923-v2-toast-getter`.
- **Patrón exacto del layout y mainArea** (replicado en los 8 módulos):

```javascript
const layout = document.createElement('div');
layout.className = 'k-app-layout';
layout.style.cssText = 'height: 100%; display: flex; flex-direction: column; min-height: 0;';

const mainArea = document.createElement('div');
mainArea.id = 'app-container';
mainArea.className = '<nombre-modulo>-home';   // NO usar .gestion-integral-home como copia
mainArea.style.cssText = 'flex: 1; min-height: 0; overflow-y: auto; padding: 0 1.5rem 1.5rem; box-sizing: border-box;';
```

#### Patrón de score compuesto del módulo

El hero card de cada módulo usa **promedio simple de N componentes** disponibles en sus stats, excluyendo los que no tienen datos:

```javascript
const componentes = [
    inducciones.totalTrabajadores > 0 ? inducciones.porcentajeCompletado : null,
    capacitaciones.programadas > 0 ? capacitaciones.porcentajeCumplimiento : null,
    totalPlaneado > 0 ? cumplimientoPresupuesto : null,
    copasst.actaMesEnCurso ? 100 : 0,    // binario mensual
    comite.actaMesEnCurso ? 100 : 0,     // binario mensual
    afiliacion.estado === 'ok' ? 100 : (afiliacion.estado ? 0 : null)
];
const score = componentes.filter(v => v !== null)
                          .reduce((a, b) => a + b, 0) / componentes.filter(v => v !== null).length;
```

Tipos de componentes soportados:
- **Continuo (% calculado)**: ej. cumplimiento de presupuesto
- **Binario (100/0)**: ej. acta del mes en curso
- **Inverso (100-X)**: ej. tasa de ausentismo → `100 - tasaAusentismo`
- **Discreto (100/0/null)**: ej. estado de afiliación ok/warn/danger

#### `handleSubmoduleClick` — patrón obligatorio

Si el módulo tiene submódulos navegables, el handler DEBE existir (verificado en 8 paquetes):

```javascript
handleSubmoduleClick(submoduleName) {
    const mainCanvas = document.querySelector('.main-canvas');
    if (mainCanvas && typeof window.showSubmoduleContent === 'function') {
        window.showSubmoduleContent(mainCanvas, this.moduleName, submoduleName);
    } else {
        alert('Navegando a ' + submoduleName);
    }
}
```

Antes de la migración, este handler faltaba en Gestión Integral (📦731) y Gestión Salud (📦732), causando clicks que no navegaban. Ahora se agrega preventivamente en cada rediseño.

#### Chart SVG nativo vs Chart.js

El home premium usa **SVG nativo** (no Chart.js) en `renderChart*()`:
- Más simple (sin canvas-reuse bugs, sin init/destroy).
- Mismo visual con menos código.
- Métodos Chart.js legacy (`renderAuditoriasChart`, `renderCumplimientoChart`, `renderAccionesChart`, `renderEstadosChart`, `renderArchivosChart`, `renderTiposChart`, `renderInspeccionesChart`, `renderCumplimientoChart` en Peligros) quedan en el archivo por si se necesitan en otros submódulos, pero ya NO se invocan desde el home.

#### Lección crítica: reescritura de archivos grandes con scripts Python (📦730-737)

Cuando un módulo home tiene >30KB con muchos métodos, usar SIEMPRE este patrón en el script Python (lección aprendida en 5 paquetes):

1. **Backup atómico** con `[System.IO.File]::Copy()` de .NET (Copy-Item bloqueado en PowerShell). Patrón `*.bak-pre-rediseno-YYYYMMDD` (ignorado por `.gitignore`).
2. **Inventario pre de métodos** con regex `^\s*(?:async\s+)?(\w+)\s*\(` (NO capturar el `async`).
3. **Reemplazar 3 rangos identificados** (no 1 reescritura masiva):
   - Rango A: `async render()` legacy → nuevo con premium pattern
   - Rango C: `injectStyles()` con CSS legacy → stub mínimo
   - Rango D: métodos legacy mezclados → reconstrucción con lista EXPLÍCITA de preservados + nuevos
4. **Inventario post de métodos** (mismo regex).
5. **Verificación de preservación**: `preserved_expected.issubset(post_names)` debe ser True.
6. **Verificación de duplicados por declaración exacta**: `grep -c "^\s*(async\s+)?nombreMetodo\(" archivo` para CADA método del inventario post. Debe ser exactamente 1.
7. **Validar JS** con `node -c archivo.tmp.js` (NO `archivo.tmp` — Node no reconoce `.tmp`).
8. **Escribir atómicamente** con `os.replace(tmp, src)`.

#### Bug histórico: cierre de clase faltante

El primer script Python de Gestión de Amenazas (📦734) perdió el cierre de clase `}` porque `post_block = original_lines[740:]` saltaba la línea 740 (cierre). Síntoma: `SyntaxError: Unexpected token '.'` en `window.X = X;` (línea final). Fix: incluir el cierre como `class_closure = original_lines[739]` antes del `post_block`. Lección: SIEMPRE identificar la línea de cierre de clase explícitamente.

#### Bug histórico: llamadas inválidas en `updateWidgetsUI`

El primer script Python de Gestión de Amenazas (📦734) eliminó `renderArchivosChart`/`renderTiposChart` como "código muerto" pero `updateWidgetsUI` los invocaba desde `refreshStats`. Síntoma: `TypeError: this.renderArchivosChart is not a function` + skeleton infinito. Fix: antes de eliminar cualquier método, hacer `grep -c "nombreMetodo"` para confirmar 0 referencias activas. Lección: aplicar el grep SIEMPRE como paso previo a la eliminación en scripts futuros.

#### Bug histórico: scroll interno faltante (📦735)

El primer rediseño de Gestión de Amenazas (📦734) tenía `layout.style.height = '100%'` SIN la cadena flex. Sin `display: flex; flex-direction: column; min-height: 0`, el contenido se desbordaba sin scroll. Fix: usar `cssText` con todos los estilos de flex chain. Patrón ahora documentado arriba.

#### Bug histórico pre-existente: clase CSS copiada

4 módulos usaban clase `.gestion-integral-home` (copia literal del CSS de Gestión Integral): Verificación (📦736), Mejoramiento (📦737), Gestión Amenazas (📦734), Gestión Integral (📦731). Renombrados a sus clases correctas (`.<módulo>-home`) en cada rediseño.

#### Sidebar premium (📦738 · v0.1.205)

El sidebar lateral principal usa `.kair-nav-card` y derivados, definidos en **`shared/kair-sidebar.css`**.

**Componentes**:
- `.kair-nav-card` — button card principal (fila de navegación)
- `.kair-nav-card__icon` — wrapper del icono SVG (22×22, stroke-width 1.8, sin caja de fondo)
- `.kair-nav-card__text` — columna con título + subtítulo
- `.kair-nav-card__title` — 14px, weight 700, `var(--kair-font-ui)`
- `.kair-nav-card__subtitle` — 12px, weight 500, `var(--kair-muted)`
- `.kair-nav-card--active` — estado seleccionado (fondo `--kair-soft`, título/icono `--kair-blue`)
- `.kair-nav-card--footer` — variante "Salir" (sin border dashed)
- `.kair-nav-card__badge` (+ `--warn`, `--ok`) — badge opcional preparado para alertas futuras
- `.kair-nav-section-header-li` + `.kair-nav-section-header` — header de sección ("Módulos del Sistema")
- `.kair-nav-footer-li` — separador antes de "Salir"

**Decisión de diseño clave** (v4 final, tras 4 iteraciones con feedback del user):
- **Fondo transparente por default** (no `--kair-card` que se veía "gris deprimente")
- **Sin border visible** en estado normal ni activo (el border se sentía redundante)
- **Hover y activo usan EL MISMO fondo** (`--kair-soft`): pasás el mouse sobre cualquier módulo y ya "se ve seleccionado" — consistencia visual inmediata
- **Icono sin caja de fondo**: solo el SVG con color (`--kair-blue-ink` para inactivos, `--kair-blue` para activos/hover)
- **Sin box-shadow en activo**: solo cambio de color de fondo + título + icono
- **Salir**: variante footer con mismo comportamiento de hover que los módulos

**Estado activo** se aplica con clase `kair-nav-card--active` (NO con `.active` legacy). El handler `setActiveSidebarButton(card)` en `renderer.js:3657` hace `classList.add('kair-nav-card--active')` / `remove`.

**Compatibilidad**: las clases legacy `.sidebar-module-card*` NO se eliminaron — conviven sin conflicto por si otros componentes las referencian.

**Migración futura**: el panel dashboard horizontal (`renderer.js:4180` "Módulos del Sistema" en home) y el submenu de Bandeja Integrada (`renderer/bandeja-integrada/init.js:51` `<aside class="kair-card kair-sidebar">`) aún usan legacy. Se pueden migrar después con los mismos componentes.

**Iteraciones de diseño** (lección sobre UX con user):
1. v1-premium: caja de fondo en iconos + bordes. **Rechazada**: "demasiado gris deprimente, no premium".
2. v2-noborder: sin border, fondo transparente, iconos sin caja. **Aprobada**.
3. v3-hover-soft: hover = activo (mismo `--kair-soft`). **Aprobada**.
4. v4-footer-soft: hover de "Salir" = mismo `--kair-soft`. **Aprobada**.

Lección: cuando se diseña con feedback iterativo, **empezar minimalista** (sin border, sin caja, sin sombra) y agregar elementos solo si el user lo pide. Es más fácil agregar que quitar.

### Comunicación
- **Renderer ↔ Main process**: `window.electronAPI.modulo.metodo(arg).then(...)`
- **Entre vistas**: `window.KairStore.actions.goXxx()` + `_refreshView()` en el componente
- **Toasts**: `window.updateNotifier.show({ type: 'success|info|warning|error', title, subtitle })`
- **Confirm dialogs**: `window.kairAuditoriaAnual.showConfirm({...}).then(ok => ...)`

### Carga de dependencias (cascada)
El componente carga sus dependencias con `loadCss()` + `loadScript()` en cascada anidada. NO usar ES modules ni require(). Ver `auditoria-anual-component.js` líneas 24-110 como referencia.

### Gotchas CSS del submódulo Investigación Accidentes (lección 2026-06-27)
Patrones que aprendí corrigiendo problemas visuales. Aplicar a cualquier vista similar:

1. **`.inv-layout` está roto**: muchas reglas están scoped a `.inv-layout` (ej. `.inv-layout .hidden { display:none !important }`) pero el body NUNCA tiene esa clase → la regla no aplica. Solución: usar selectores globales o aplicar `class="inv-layout"` al body. En este módulo se unificó la regla `.hidden` a global.

2. **Body debe ser `height:100vh + overflow:hidden`** (no `min-height`) cuando hay contenido scrollable interno. Si es `min-height`, el body crece si el contenido suma más que viewport y el iframe lo recorta (pierdes header y action bar).

3. **`flex:1` en wrapper > `height: calc(100vh - Xpx)`**: el cálculo con números mágicos (ej. `53px` para header) es frágil. Mejor `flex:1; min-height:0` y dejar que flexbox calcule.

4. **`overflow-y: auto` come 15px del padding** por el scrollbar vertical. Usar `scrollbar-gutter: stable` (Chrome 94+) para reservar ese espacio desde el inicio. Sin esto, los bordes laterales de las cards se cortan en ventanas estrechas.

5. **`child_process.spawn()` sin `windowsHide: true`** abre una ventana de consola negra que parpadea al cerrarse. SIEMPRE pasar `{windowsHide: true}` en Windows. Aplica a TODOS los spawn de Python/VBS/cscript (16 lugares en main.js + investigacion_handlers.js).

6. **NO agregar colores/accent decorativos** cuando el usuario reporta clipping o bordes cortados. Primero diagnosticar geometría (padding, overflow, scrollbars, container width). El usuario prefiere fixes mínimos sin color.

7. **`.emo-scope #emo-root` no coincide NUNCA** (submódulo Evaluaciones Médicas, sep 2026): `render()` le pone la clase `emo-scope` a la PROPIA caja raíz (`id="emo-root"`), así que un selector `.emo-scope #emo-root` exige un ancestro con esa clase que no existe → la regla queda muerta y el `display:flex` nunca aplica. La prueba de humo `CSS: TODOS los selectores están bajo .emo-scope` exige que cada selector EMPIECE con `.emo-scope`, así que la forma correcta es `.emo-scope#emo-root` (misma especificidad, mismo nodo, cumple la prueba). Síntoma: el arreglo "funciona" en un lab donde el `<body>` tiene clase `emo-scope` (el body actúa de ancestro) pero NO en la app real. Lección: validar los labs SIN clases auxiliares que la app real no tiene, y medir con `getComputedStyle` en la cadena real de contenedores (`.submodule-content` → `#emo-root` → `.emo-kair-main`) en vez de confiar en capturas.

8. **Los 5 Porqués deben ser EXACTAMENTE 5 niveles — el modelo chiquito NO obedece el prompt** (sep 2026): Qwen3.5-0.8B llegó a generar 36 niveles a pesar de que el SYSTEM_PROMPT dice "EXACTAMENTE 5" y "Detente" (log `Portear/src/llm_server.log`, 14:59: `Post-procesamiento aplicado a 36 niveles`). El prompt NO es defensa suficiente; el tope vive en el código y hay que mantener TODAS las capas: (a) `llm_server.py` → `stop: ["6. ¿Por qué", ...]` en las options de analyze y regenerate; (b) `_strip_post_level5_content` corta el texto en el próximo encabezado `\d+. ¿Por qué` y toma el **máximo** `end` entre los patrones de categoría (si no, "Medio Ambiente", que va ANTES que "Material" en cada nivel, sobrescribe el fin de corte y se come la línea Material del nivel 5); (c) `parse_5_whys` / `parse_5_whys_alternative` descartan todo nivel fuera de 1-5;    (d) el render read-only de `investigacion-accidentes-main.js` filtra `n <= 5` + `.slice(0, 5)` (la variante editable ya acotaba `[1..5]`). Si quitas cualquiera de las 4, el bug vuelve. Regresiones: `tests/investigacion-accidentes/test-hf-llm-canales.js` (sección G) y `test-premium.js` (sección F). Ojo: `python-embed/` NO está en git, así que los tests del repo son solo de estructura — la verificación funcional del parser se corre aparte con `Portear\python-embed\python.exe`.

9. **La cuantización Q4_K_M destruye un fine-tune LoRA sobre un modelo de 0.8B** (sep 2026): el modelo entrenado con Unsloth (`Reivaj640/qwen3.5-0.8b-ia-v2` + `dataset_v4_final.jsonl` — respuestas progresivas, preguntas sustituidas con causas reales, sin razonamiento previo) funcionaba PERFECTO en Unsloth (fp16/bf16) y salía DEGENERADO en Ollama con el GGUF Q4_K_M: copiaba la plantilla literal ("¿Por qué [causa principal del nivel 1]?") y repetía las mismas 5 causas en los 5 niveles — con el prompt del entrenamiento EXACTO, con parámetros del entrenamiento (`temp 0.1, top_p 0.8, top_k 20, min_p 0, rep_pen 1.15, presence 0`), con el system prompt byte-exacto, con `TEMPLATE {{ .Prompt }}` o con la plantilla nativa, con modelo limpio sin params, e incluso con una FILA VERBATIM del dataset (y además inventaba contenido ajeno, ej. "desenergizar" en un caso de lavado de cuchillos). Con razonamiento activo el Q4_K_M entraba en bucle "Wait..." infinito en inglés sin escribir jamás la respuesta (124k chars). **La versión BF16/F16 (1.6 GB, tag `hf-qwen3.5-0.8b.f16-qwen3.5-0.8b-ia-v3.1` o Q8_0) resuelve todo**: el análisis sale encadenado (intento 1 → 66 → feedback → intento 2 → score 90, 0 repeticiones, ~26s). Regla: para modelos fine-tuneados pequeños exportar SIEMPRE GGUF en `f16`/`q8_0` (`model.save_pretrained_gguf("model_out", tokenizer, quantization_method="f16")`), nunca Q4_K_M. Test de regresión: si la salida repite la misma causa en 2+ niveles consecutivos, sospechar primero del GGUF, no del prompt.

10. **Cadena anti-repetición en `llm_server.py`** (misma época): el validador (`_validate_backward_chain`) detecta celdas que repiten textualmente nivel anterior (`_norm_cmp`, `repetition_cells`, gate 6+ → `valid=False`); si está estancado, `analyze_via_ollama` NO usa feedback retry (a 0.1 de temp el modelo lo ignora — probado: intento 2 salió con 19 repetidas tras feedback) sino **cadena iterativa** (`_analyze_iterative_chain`: multi-turn, el servidor sustituye la causa real en cada pregunta, anti-copia `_is_stagnant_vs` reintenta con temp 0.35, y el dedupe pasa a N/A cualquier categoría que repita el nivel anterior).    Regla de comparación: cuando hay estancamiento, **gana el candidato con MENOS `repetition_cells` aunque su score sea menor** (70 pts/20 repetidas single-shot vs 68 pts/10 repetidas iterativa → gana la iterativa; el overlap léxico premiaba lo idéntico). `_build_pregunta` extrae la pregunta real del modelo y, si copió el placeholder literal ("causa principal del nivel N"), la sintetiza con la causa real del nivel anterior. Regresiones en `test-hf-llm-canales.js` secciones H/I/J (142 checks).

11. **Prompts del 5 Porqués = byte-exactos al dataset de entrenamiento (`dataset_v5_final.jsonl`)**: (a) `INSTRUCCIONES_PROMPT` en `llm_server.py` es la plantilla v5 VERBATIM — metodología VERTICAL "ANÁLISIS VERTICAL POR CATEGORÍA" (cadena causal INDEPENDIENTE por columna M: cada celda explica la causa de la MISMA M del nivel anterior) con las reglas HERENCIA DE N/A, DETENCIÓN POR CAUSA RAÍZ y CERO CRUCES — NO re-envolver párrafos, NO agregar salto inicial invisible (un `\n` al abrir el `"""` ya es divergencia), NO quitar líneas en blanco. (b) Las secciones del accidente van en TEXTO PLANO (el v5 eliminó los asteriscos que tenía el v4): `build_user_prompt` arma `\n\nDescripción del accidente:\n…\n\nContexto Adicional:\n…\n\nAnálisis de 5 Porqués:`. (c) El parser acepta los encabezados encadenados del v5 (`2. ¿Por qué ocurrieron las causas del Nivel 1?`) y `_build_pregunta` los extrae para la UI; la función `_uniform_preguntas` (forzaba el header constante "¿Por qué ocurrió el accidente?" en los 5 niveles) **existió 1 día y se eliminó** — chocaba con el formato del dataset v5. (d) `config.json` → `llmSystemPrompt` se sincroniza manual con la constante, y el botón "Restaurar por Defecto" de Configuración › IA lleva el MISMO texto — si uno cambia, cambiar los tres. **Aviso de calidad visible**: el servidor devolvía `validation_warning`/score y el frontend lo ignoraba; ahora `investigacion-accidentes-main.js` pinta un banner ámbar `.inv-quality-warn` si `validation_warning` o `score < 70` (`view.css`, con dark en `[data-theme^="dark"]`; cache-bust `INV-20260925-calidad-banner`).

12. **Splash de bienvenida con confetti estilo Stripe** (v0.1.214, 📦815): el check verde Bootstrap hardcoded (`#28a745`) del `loading-success-icon` se reemplazó por SVG con gradiente (`<defs><linearGradient id="kairSuccessGrad">` verde→azul), halo pulsante (`<circle r="52">` con `success-halo` 2s ease-out infinite), check con stroke gradiente (4.5px round caps) y 6 cuadrados confetti (`rect 6×6`) rotando ±180° mientras vuelan ±42px en 3 colores premium v2 (`--kair-blue`, `--kair-green`, `--kair-amber`). ViewBox 52→120 para que respire. Tokens nuevos: `--kair-blue`, `--kair-green`, `--kair-amber` (reutilizados, antes no existían). **Aplicado a AMBOS** overlays (`#kair-loading-success.active` activo + `.kair-transition-success` legado CSS huérfano) por consistencia si el componente se reactiva. Si el user pide cambiar colores, **NO** hardcodear — exponer como tokens `--kair-X` en `:root` y consumirlos desde el `stroke`/`fill` del SVG y desde los keyframes CSS. Cache-bust `styles.css?v=20260926-confetti-success`. Patrón completo en `design_system.md §15`.

13. **URLs relativas en HTML inyectado vía `fetch + innerHTML` se resuelven desde el documento PADRE, no desde el archivo fetched** (v0.1.215, 📦816 — bug en refactor home de Capacitaciones): contraste directo con el patrón de Presupuesto que se carga en **iframe** (donde las URLs se resuelven desde el iframe). Cuando un componente hace `const html = await fetch('./modules/.../foo.html'); container.innerHTML = html`, todos los `<link>`, `<img>`, `<a href>` dentro del HTML inyectado resuelven sus paths relativas desde el BASE URI del documento padre (`index.html`), no desde el archivo fetched. **Síntoma**: la página sale sin estilos (los `<link>` no encuentran el CSS). **Fix**: usar paths relativas a `index.html` (`./shared/...`, `./modules/...`) y agregar `<link>` explícito al CSS del módulo (no se hereda del archivo fetched). Patrón de E2E sin display: `tests/cap-home-e2e.js` con jsdom lee los archivos del disco y los inyecta como `<style>` en un wrapper HTML, valida 18/18 DOM + 15/15 CSS + 9/9 tokens + 11/11 estilos + callbacks. Útil cuando no se puede ejecutar Electron con GUI.

### Stores y estado
- Cada módulo tiene un `kair-store.js` con patrón pub/sub: `getState()`, `setState()`, `subscribe(fn)`, `actions`
- Selectores computados: `KairStore.computeKpisXxx()`, `KairStore.selectAudits()`
- Mutaciones: `KairStore.actions.addXxx()`, `KairStore.actions.updateXxx()`
- Persistencia SQLite: `KairStoreBridge.persist('addXxx', { ... })`

### Cuando extender con una nueva vista:
1. Crear archivo en el módulo correspondiente (`modules/<area>/<submodulo>/`)
2. Seguir el patrón IIFE + window export
3. Usar solo clases CSS canónicas (`kair-*`)
4. Si necesita un componente orquestador (como `auditoria-anual-component.js`), crear uno que cargue CSS + scripts + vistas via cascada
5. **NO commitear sin autorización explícita del usuario** (ver protocolo completo abajo)

### 🚨 Protocolo de autorización de commits y releases (CRÍTICO — aprendido de incidente 2026-08-11)

El 2026-08-11 se cometieron 2 releases (v0.1.165 y v0.1.166) sin autorización explícita del usuario, sobre-interpretando "procede" como "cambios + commit + release". **Regla sagrada**: cuando hay duda, **PREGUNTAR**. Mejor hacer 1 pregunta extra que 1 commit no autorizado.

| Palabra/frase del user | Significado | Acción permitida |
|------------------------|------------|------------------|
| "procede" / "ok procede" | Autoriza hacer cambios de código | Editar archivos, **NO** commitear, **NO** pushear, **NO** release |
| "dale" / "OK" / "commit" / "perfecto" | Autoriza commit (post-validación visual) | `git commit`, pero **NO** pushear, **NO** release |
| "realiza solo el commit" | Autoriza commit pero NO push | `git commit` local, sin `git push` |
| "pushea y procede con el release" | Autoriza push + bump + release | `git push` + `git tag` + `git push --tags` + build + GitHub release |
| "revierte" | Revertir último commit | `git reset --hard HEAD~1` o `git revert <hash>` |
| "no committe" / "sin commitear" | Trabajar sin commitear | Hacer cambios, dejar en working tree, esperar validación |
| "actualiza tu aprendizaje" | Guardar regla durable cross-project en memoria | Llamar `memory` tool |

**Después de cada commit + push + release, redactar el mensaje Y EL RESUMEN, y preguntar "¿procede con commit + release?" antes de ejecutar `git commit && git push && gh release create`.** El output del tool debe terminar con: "Implementé X, Y, Z. ¿Procede con commit + release? (responde 'dale' / 'OK' / 'commit' / 'perfecto' para autorizar)".

---

Para contexto histórico de bugs y trampas conocidas, ver BITACORA.md. Buscar con grep, no leer entero.

# Instrucciones Globales - OpenCode

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

El usuario usa su propio formato de commits con versionado incremental. **NO usar conventional commits (`feat:`, `fix:`, `docs:`, `style:`)** — usar SIEMPRE:

```
📦<numero> # <descripcion en espanol, tono casual>
```

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
Las vistas usan exclusivamente el sistema BEM `kair-*` definido en `kair-canonical.css`:
- Header: `kair-header`, `kair-header__bar`, `kair-header__left/center/right`, `kair-header__tab`, `kair-header__tab-badge`, `kair-header__action--{primary|secondary|ghost|success}`, `kair-header__back`, `kair-header__company`, `kair-header__breadcrumb`
- KPIs: `kair-kpi-strip`, `kair-kpi-item`, `kair-kpi-item__icon/value/label/subdata`
- Cards: `kair-card`, `kair-hub-card`, `kair-hub-card__icon/title/desc/meta`
- Tables: `kair-table-wrap`, `kair-table`
- Forms: `kair-field`, `kair-field__label/input/textarea/select`, `kair-field__input-wrap`
- Badges: `kair-badge`, `kair-badge--{primary|success|warning|danger|info|neutral}`, `kair-dot`
- Empty states: `kair-empty`, `kair-empty__icon/title/desc`
- Buttons: clases `kair-header__action--*` (NO usar shadcn-style buttons)
- Section cards: `kair-rad-section-card`, `kair-rad-section-card__head/title/body`
- Progress: `kair-progress`, `kair-progress__bar`, `kair-progress__bar.is-{success|warning|danger}`
- Dialog: `kair-dialog-overlay`, `kair-dialog`, `kair-dialog__header/body/footer/title`
- Calendarios: `kair-cron-grid`, `kair-cron-grid__row/cell/head/corner/month/audit/hito`
- Workflow editor: `kair-rad-editor`, `kair-rad-editor__main/sidebar`, `kair-rad-sticky-footer`, `kair-rad-side-nav__item`

### K+AIR Premium Design System (v0.1.211 · 📦730-805)

A partir de v0.1.197, los homes de módulos usan el sistema premium con tokens compartidos. **13 paquetes en el rango 📦730-805** migrados al patrón unificado (sep 2026, 3 olas):

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
  - 🚨 **Lección de EOL de este repo (me pasó dos veces):** `renderer.js` tiene saltos de línea
    **mezclados** por diseño (mezcla de CRLF y LF). El `edit` y `write` los normalizan y el
    diff pasa a mostrar 7.000 líneas cambiadas. Para tocar ese archivo: `git checkout --` para
    restaurarlo y después aplicar el cambio con reemplazos de texto que **no** toquen los
    finales de línea, verificando que el conteo de CRLF/LF quede igual. `git diff --numstat`
    tiene que dar pocas líneas.
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
       menos con Bootstrap. Nuevo test: `test-evaluacion-inicial-bootstrap.js` (22 checks)
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

## 🆕 Menú nativo de Electron oculto (Loop 47b, 📦579, v0.1.130)

La **Bandeja Integrada** (cliente Gmail integrado en K+AIR) sigue un patrón DIFERENTE al de las vistas de submódulos. En lugar de integrarse al sistema de vistas existentes, se carga como un **iframe aislado** dentro del header principal.

### Estructura de archivos
```
sgsst-electron-app/
├── renderer/bandeja-integrada/
│   ├── index.html          # UI principal
│   ├── app.js              # Toda la lógica (~3,400 líneas)
│   ├── styles.css          # BEM Gmail-style (~3,300 líneas)
│   ├── data.js             # D.ICONS (Lucide) + datos mock fallback
│   └── README.md           # Doc interna
└── (consumido desde renderer.js con iframe + cache-bust)
```

### Cómo se monta el iframe
En `renderer.js`, cuando el user hace click en el botón "Bandeja Integrada" del header:
```js
var bandejaIntegradaFrame = document.createElement('iframe');
bandejaIntegradaFrame.src = 'renderer/bandeja-integrada/index.html?v=' + currentVersion;
document.body.appendChild(bandejaIntegradaFrame);
```

**Cache-bust dinámico (`?v=N`):** cada vez que se cambia código de la Bandeja Integrada, hay que bumpear el `currentVersion` (actualmente en `v=695`) en `renderer.js` **línea ~1131** (verificado 2026-09; la referencia vieja "línea ~1044 / v=617" quedó obsoleta). Sin esto, el navegador cachea la versión vieja y no se ven los cambios.

### Comunicación iframe ↔ renderer principal
- **renderer → Bandeja**: `bandejaIntegradaFrame.contentWindow.postMessage({ type: 'bandeja-integrada-toggle' }, '*')`
- **Bandeja → renderer**: `window.parent.postMessage({ type: 'bandeja-integrada-back' }, '*')`
- **3 formas de salir de la Bandeja**:
  1. Botón "X" (toggle) en el header principal
  2. FAB "← Volver" flotante arriba a la izquierda
  3. Tecla `ESC` (con flag para evitar cierre accidental al escribir en inputs)

### Reglas específicas de la Bandeja Integrada
- **Coexiste con K+AIR Calendar**: NO lo reemplaza. Ambos funcionan en paralelo.
- **OAuth Gmail + SQLite cache**: el cache local está en `kair.db` (mismo archivo que usa el resto de la app).
- **BEM refactor 4 componentes**: `.email-row`, `.thread-header`, `.quoted-thread`, `.compose-panel` (con tokens CSS en `:root`).
- **Sin Tailwind**: el archivo `styles.css` NO debe tener `@import "tailwindcss"`. Si lo ves, elimínalo (causa `ERR_FILE_NOT_FOUND` en consola).
- **Patrón IIFE + window export**: igual que las vistas de submódulos, pero todo dentro del iframe.
- **SIEMPRE usar `getMailDisplayContact(mail)`** para resolver el "contacto visible" de un mail (línea 301). En **INBOX** es el `sender` (a quien respondés), en **SENT** es el primer item de `to_list` o `participants_list` excluyendo al user (el destinatario original, a quien le enviaste). **NUNCA** usar `mail.senderEmail` directamente para el "Para" del reply — en SENT eso es tu propio email, y el chip se trunca a 180px mostrando solo la primera letra ("m" o similar). Bug arreglado en v0.1.173 (📦701-fix12).
- **Permisos por usuario** (desde v0.1.175, 📦702): el acceso a la Bandeja Integrada se gatea con `users.bandeja_integrada_enabled` (default 0). El admin puede condicionar el acceso desde **Configuración > Gestión de Usuario** con el toggle "Acceso a Bandeja Integrada". **Admin global SIEMPRE forzado a `enabled: true`** por el backend (no se puede deshabilitar a sí mismo ni a otros admins). Los tokens de Gmail NO se ven afectados — siguen en `email_connections` por empresa.
  - **Visibilidad del botón en el header** (Step 5): el botón del sobre en el header se **oculta** para users sin acceso. Función `applyBandejaIntegradaVisibility(allowed)` en `renderer.js:1179` con fail-**CLOSED** (oculta si no se puede determinar). Se llama al cargar la app (oculta), después del login (chequea y aplica), y después del logout (oculta). El gate de `checkBandejaIntegradaAccess()` queda como defensa en profundidad. **NO usar fail-open acá** — si el chequeo falla, mejor ocultar que mostrar algo no autorizado.
- **Capacitaciones en el calendario requieren hora** (v0.1.175): el calendario de la Bandeja Integrada **solo muestra** las capacitaciones que tengan fecha **Y** hora persistida en el sidecar. Las que solo tienen fecha se excluyen del calendario pero siguen en el Listado del módulo Capacitaciones (la UI avisa con un toast al cargar el año).
  - **Persistencia de hora**: NO está en el Excel. La columna HORA del Listado es un `<input type="time">` en el modal de crear/editar (`capacitaciones-view.html:268`). Se persiste en `localStorage` con key `kair-cap-horas` (mapa `{nombreCapacitacion: 'HH:MM'}`) y se expone en `window.kairCapHoras` (getter) por `capacitaciones-logic.js:37`.
  - **Filtro del backend**: `main.js:5377-5380` en `_leerCapacitacionesDeEmpresa` — `if (!start || !end) { skippedNoHora++; continue; }`. Log: `[CAL-CAP] N eventos... (omitidas: Y sin nombre, Z sin fecha, W sin hora)`.
  - **Adapter del calendario**: `shared/kair-calendar-adapter.js:159-174` lee `window.kairCapHoras` (1ª opción) o `localStorage.getItem('kair-cap-horas')` (fallback). El fallback es importante porque el componente CapacitacionesComponent corre en un iframe y `window.kairCapHoras` del iframe no es accesible desde el adapter del parent.
  - **Para quitar la hora**: en el modal de editar, click 🗑️ al lado del input Hora → input se vacía → Actualizar → `_setHora(name, '')` borra la key del sidecar → cap desaparece del calendario.
  - **Bug latente** (no resuelto): `colDuracion` referenciada pero no definida en `main.js:5359-5363` → `durH` siempre queda en 2h. Afecta el `end` del evento.

- **Cumplido en Bandeja Integrada se desmarca solo ~60s después de marcar** (v0.1.176, 🐛 fix): bug visible del user donde el ✓ aparecía al marcar un `gcal-*` pero desaparecía ~1 minuto después en el `autoRefreshInterval`. La BD SÍ tenía el registro. **Causa raíz**: el adapter (`shared/kair-calendar-adapter.js`) SÍ construye un `cumMap` interno con los IDs `gcal-*` y enriquece su lista base con `cumplido: true` cuando hay match, **PERO el adapter NO incluye los eventos de Google Calendar en su lista base** — esos llegan DESPUÉS via `loadEventsFromGoogle()` (en `loadEventsFromIPC`) y se concatenan al `state.events` sin enriquecer → quedan con `cumplido: undefined` → `renderBigCalendar()` no muestra el ✓. **Fix en 3 archivos**:
  1. **`shared/kair-calendar-adapter.js:290`** — el adapter ahora expone el `cumMap` en la respuesta: `return { success: true, data: merged, cumMap: cumplidosMap }`. Cambio **backward-compatible**: el KairCalendar embebido (`kair-calendar.js:1380`) y KairAlerts (`kair-alerts.js:189`) solo leen `res.data` e ignoran el campo nuevo. Version bump 1.2.0 → 1.3.0.
  2. **`renderer/bandeja-integrada/app.js:1158`** (loadEventsFromIPC) — captura `var cumMapFromAdapter = (result && result.cumMap) || {}` después de `adapter.list()`.
  3. **`renderer/bandeja-integrada/app.js:1185-1198`** (loadEventsFromIPC) — después de obtener `gcalEvents` via `loadEventsFromGoogle()`, los enriquece con `cumplido: true` si su `id` está en el `cumMapFromAdapter`. Funciona porque los IDs de Google (`gcal-...`) matchean los `evento_id` que devuelve el bridge `eventos-cumplidos:listar`.
  - **Fix complementario** (era parte del problema raíz): `eventos-cumplidos-bridge.js:180-186` — el UPSERT ahora incluye `empresa_id = excluded.empresa_id` (antes solo actualizaba `cumplido_en` y `nota`, así que si el frontend pasaba `empresaId=null` después de un valor real, el registro quedaba con `empresa_id=NULL` y la query `WHERE empresa_id = 'X'` nunca matcheaba). `eventos-cumplidos-bridge.js:99-122` — migración one-shot en `_ensureSchemaMigrated` que infiere la empresa del prefijo del `evento_id` para los NULLs (`SUBSTR + INSTR`, idempotente). `_refreshCumplidosEnCalendario()` huérfano del 📦694-fix4 ahora se llama desde el handler de marcar cumplido (`app.js:2278-2286`) como defensa en profundidad.
  - **Patrón cross-project a recordar** (guardado en agent memory): cuando un adapter/componente calcula un enrichment (cumMap, colorMap, etc.) para su lista interna, **EXPONER ese enrichment en la respuesta** si hay OTROS consumidores (Google, sync, otros módulos) que también quieren enriquecer. Si no se expone, los demás consumidores duplican lógica o quedan sin enrichment. **Firma recomendada**: `return { success, data, derivedMaps }` en vez de `return { success, data }`. El cambio es backward-compatible: los callers que no necesitan el enrichment simplemente ignoran el campo nuevo.

### Cómo extender la Bandeja Integrada
1. Modificar archivos en `renderer/bandeja-integrada/`
2. Bumpear cache-bust en `renderer.js` (línea ~1131: `?v=N+1`, hoy `?v=695`)
3. Si agregás un IPC handler nuevo en `main.js`, exponerlo en `preload.js`
4. Si agregás un módulo SQLite nuevo, actualizar `main/email-schema-sql.js` + `main/email-db.js` + `main/email-sync.js`
5. NO commitear sin autorización explícita del usuario

---

## 🆕 Update UX completo (Loop 1-10, 📦581, v0.1.131)

A partir de **v0.1.131** el sistema de actualizaciones de K+AIR se rediseñó completamente siguiendo el patrón Claude/opencode: **no invasivo, footer-anchored, discoverable solo si hay update**. 10 loops de iteración visual con el user.

**Componentes**:

1. **Botón-dot en el footer** (`#footer-update-btn`) — al lado de `#app-version`. Dot de 8px con 3 estados visuales:
   - **OCULTO** (atributo `hidden`): al día, no hay ruido visual
   - **AZUL con pulse** (`.footer-update-available`): hay update disponible
   - **VERDE con halo** (`.footer-update-ready`): update descargado, listo para reiniciar
2. **Dropdown anclado al dot** (`#kair-update-dropdown`) — `position: fixed` en el body, abre HACIA ARRIBA del dot del footer. Header azul claro (#e8f0fe), 2 botones de acción (Reiniciar / Más tarde) + link "Ver información de versión". Z-index 500001 (escapa del `isolation: isolate` del header).
3. **Modal "Información de actualizaciones"** (`#kair-update-modal-overlay`) — user-invoked, abre con el link del dropdown. Badge de estado con dot animado, grid con versión instalada / última versión / última verificación / canal, botón "Buscar actualizaciones ahora" con feedback de "Buscando…".
4. **Panel "Actualizaciones" en Configuración** — pestaña "Acerca de la App". Grid con la misma info + 6 estados (idle / checking / not-available / available / downloaded / error) + botón de check manual + botón "Reiniciar e Instalar".
5. **Disclaimer "Se instalará al cerrar la app"** — al lado del dot del footer, solo visible cuando hay update. Cambia a "Lista para reiniciar" cuando está descargado.
6. **Release notes desde GitHub API** — IPC handler `get-release-notes` en `main.js` con cache de 1h, render en formato monospace con scroll interno en el modal.

**Cambios de arquitectura**:

- **Toasts invasivos removidos**: `notifyAvailable()`, `notifyDownloaded()`, `updateProgress()` ahora son no-ops (solo loguean). El UI muestra el dot del footer en su lugar. `notifyError()` se mantiene (errores merecen notificación).
- **Botón del header eliminado**: se quitó `<button id="header-update-btn">` del header y 200+ líneas de CSS legacy. La versión ya está en el footer, no tiene sentido duplicarla.
- **Dropdown positioning con footer como referencia**: el cálculo usa el `top` del `#app-footer` (no el del dot) y setea `max-height` dinámico. Si el contenido es más grande, hace scroll interno en el body. Fix del bug donde el dropdown invadía el footer.

**Archivos modificados**: `index.html`, `styles.css`, `renderer.js`, `main.js`, `preload.js`, `components/config/config-viewer.html`, `assets/js/update-notifications.js`.

**Tests**: 158/158 OK en `main/test-fixes-loop48.js`.

**Para validar visualmente**:

```js
// Simular el dot azul (update disponible)
const b = document.getElementById('footer-update-btn');
b.hidden = false;
b.className = 'footer-update-btn footer-update-available';
b.click();  // abre el dropdown anclado arriba del dot
```

## 🎨 Footer minimalista: solo en pantalla de inicio, blanco sobre Vanta (📦701-fix9, v0.1.171)

A partir de **v0.1.171** el footer negro con copyright y versión se quitó de la app principal y de la Bandeja Integrada. Ahora solo aparece en la pantalla de inicio (splash + login + selección de empresa) flotando sobre el Vanta con texto blanco.

### Patrón de implementación con CSS `:has()`

El selector original `.vanta-fullscreen #app-footer { display: none; }` **NUNCA funcionó** porque la clase `vanta-fullscreen` se aplica a `.main-container` (sibling del footer, no ancestro). Por eso veías el footer negro en la app principal — la regla de ocultarlo nunca matcheó.

**Solución con `:has()` (selector moderno, soportado en Electron 37 / Chromium 118+):**

```css
/* Default: footer oculto en la app principal */
#app-footer {
  display: none !important;
}

/* Cuando #app tiene un descendiente con vanta-fullscreen, mostrar el footer */
#app:has(.vanta-fullscreen) #app-footer {
  display: flex !important;
  position: fixed !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 50 !important;
  background-color: transparent !important;
  color: rgba(255, 255, 255, 0.85) !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5) !important;
  padding: var(--spacer-sm) var(--spacer-lg) !important;
  justify-content: space-between !important;
  border-top: none !important;
}
```

**Por qué `:has()`** en vez de modificar el JS:
- `vanta-fullscreen` se togglea en 7 lugares del `renderer.js`
- Con `:has()` desde el padre común (`#app`), una sola regla CSS cubre los 7 casos
- Cero cambios al JS = cero riesgo de regresión

### Reglas para IAs que extiendan el patrón

1. **Usar `:has()` para elementos siblings del que togglea la clase**: cuando una clase se aplica a un elemento y querés afectar a sus siblings, `:has()` desde el ancestro común es la solución CSS-only.
2. **`text-shadow` siempre en texto sobre fondos variables**: el Vanta es animado, el color cambia. Sin text-shadow el texto blanco se pierde en zonas claras. Usar `text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5)` para legibilidad consistente.
3. **`position: fixed` + `bottom: 0` para elementos que overlay contenido**: el footer sigue en el DOM, pero con `position: fixed` no toma espacio en el flow y overlay el contenido (el Vanta en este caso).
4. **Trade-off del update dot**: el dot de updates vivía en el footer. Al ocultarlo, perdimos el indicador visible. Sigue accesible desde Configuración > Acerca de la App. Si querés re-ubicarlo (botón flotante, header), es un cambio pequeño.

### Bandeja Integrada — patrón más simple

Para la Bandeja Integrada (que es un iframe con su propio scope), la solución fue más simple porque no hay selector de padre:

```css
/* renderer/bandeja-integrada/styles.css */
.kair-footer {
  display: none !important;
}
```

El HTML y el JS no se tocaron — el DOM se sigue actualizando (`#footer-events-count`, `#footer-company`, `#footer-view`), solo se oculta visualmente. Si querés recuperarlo, comentás la línea y todo vuelve a funcionar.

## 🆕 Release flow automatizado (📦585, v0.1.131+)

A partir de **v0.1.131+** el流程 de release está automatizado. Antes había que acordarse de hacer `git tag` + `git push origin <tag>` antes de correr `electron-builder --publish=always`, y si se olvidaba, GitHub devolvía **422 "Published releases must have a valid tag"** y el release quedaba roto con assets huérfanos.

### `scripts/release.ps1` (7.6 KB)

Ejecuta el流程 completo de release en 7 pasos. **El paso crítico es el 5: `git push origin v<version>` ANTES del build** — eso es lo que evita el 422.

```powershell
#流程 completo (con tests):
.\scripts\release.ps1

#流程 sin tests:
.\scripts\release.ps1 -SkipTests
```

**Pasos del script**:

1. **Pre-checks** — Verifica `GH_TOKEN` en environment, branch actual = `Dev-Pc` (configurable con `-Branch`), working tree limpio (advierte y pide confirmación si hay cambios).
2. **Tests** (opcional) — Corre `main/test-fixes-loop48.js` si existe. Falla rápido si hay tests rotos.
3. **`git push origin Dev-Pc`** — Sube los commits pendientes al remoto.
4. **Crea tag `v<version>` local** — Lee la versión de `package.json`. Si el tag ya existe local, pregunta si lo borra.
5. **`git push origin v<version>`** ← **EL PASO QUE EVITA EL 422**
6. **Verifica visibilidad del tag en GitHub** — Hace `GET /repos/{owner}/{repo}/git/refs/tags/{tag}`. Si no está visible, espera 5s.
7. **`npx electron-builder --win --publish=always`** — Build completo. Si falla, llama a `fix-release.ps1` automáticamente.

### `scripts/fix-release.ps1` (7.8 KB) — Fallback

Si `electron-builder` falla (típicamente por timeout al subir el `.exe` de 264 MB), `release.ps1` llama automáticamente a este script. También se puede correr manual:

```powershell
# Usa la version de package.json:
.\scripts\fix-release.ps1

# Version especifica:
.\scripts\fix-release.ps1 -Version 0.1.133
```

**6 pasos del fix**:

1. **Verifica archivos locales** — `.exe` y `.blockmap` en `dist/`. Falla si no existen.
2. **SHA512 + latest.yml** — Calcula el hash real del `.exe` local y regenera `dist/latest.yml` con el formato que espera `electron-updater`.
3. **Obtiene o crea el release** — `GET /repos/{owner}/{repo}/releases/tags/v{version}`. Si no existe, lo crea.
4. **Borra assets huérfanos** — Recorre los assets existentes y borra los que tienen el nombre viejo (`sgsst-electron-app-setup-*`).
5. **Sube assets con curl** — `.exe`, `.blockmap`, `latest.yml` con `& curl.exe -X POST` directo a `uploads.github.com`. Cada upload muestra OK/FAIL.
6. **PATCH name + body** — `PATCH /releases/{id}` con el nombre `v{version}` y un body minimalista con link al CHANGELOG.

### Bugs del fix manual que el script ya corrige

Durante los intentos manuales de v0.1.131/132/133 descubrimos 2 bugs en el shell scripting que el script ya tiene arreglados:

1. **Regex glotona**: `"\?.*$"` se comía el `}` final del `upload_url`, dejando `assets{` que curl rechazaba como "Bad hostname". **Fix**: usar `\{[^}]*\}` (una sola pasada, no glotona).
2. **PowerShell wildcard**: `"$uploadBase?name=..."` se parseaba como `"$uploadBase?` (variable con 1 char extra) + `name=...` porque `?` es wildcard. **Fix**: delimitar con `{}` → `"${uploadBase}?name=..."`.

### Cero impacto en runtime

Los scripts son **solo para el build pipeline**, no se importan en la app. `package.json` no los referencia. Se pueden commitear al repo sin riesgo.

## 🆕 Menú nativo de Electron oculto (Loop 47b, 📦579, v0.1.130)

A partir de **v0.1.130** la barra de menú nativa de Windows (File / Edit / View / Window / Help) ya **no se muestra** por defecto en la app. Comportamiento idéntico a Discord, Slack, VSCode:

- **Modo DESARROLLO** (`npm start`): menú OCULTO por defecto. Aparece temporalmente al presionar la tecla **Alt** (comportamiento estándar de Windows). Útil para acceder a Reload, DevTools, etc. sin saturar la UI.
- **Modo PRODUCCIÓN** (app empaquetada con `.exe`): menú OCULTO TOTAL. Ni siquiera aparece con Alt. La app se ve limpia, sin elementos del sistema operativo que el cliente no necesita.

### Implementación

- **En `main.js` BrowserWindow**: `autoHideMenuBar: true` (opción NATIVA de Electron).
- **En `main.js` `app.whenReady()`**: bloque condicional `if (app.isPackaged) { Menu.setApplicationMenu(null); }` que en producción lo oculta TOTALMENTE.
- **Import necesario**: `const { ..., Menu } = require('electron');` (la línea 3 de main.js ya lo incluye).

### Reglas para IAs que extiendan la app

- **NO cambiar el comportamiento** sin preguntarle al usuario. El patrón está validado y funciona bien.
- Si necesitás exponer un menú custom (ej. para una feature de debug), usá `Menu.buildFromTemplate([...])` y `Menu.setApplicationMenu(menu)` — pero **solo en modo dev** (`if (!app.isPackaged)`).
- Los atajos de teclado del menú nativo (F12, Ctrl+R, Ctrl+Shift+I) **siguen funcionando** aunque el menú esté oculto, porque Electron los mantiene registrados internamente.

---

## 🆕 Seguimiento de Incapacidades con SQLite (📦701+705+706+702+703+704, v0.1.166-170)

A partir de **v0.1.166** el submódulo 3.3.6 (Medición del Ausentismo por Causa Médica) tiene un **flujo completo de seguimiento de incapacidades (PRIC)** que respalda los datos en SQLite (kair.db) en paralelo al Excel legacy PRI.xlsx. Se entregó en 5 iteraciones:

### Evolución por versión

| Versión | Commit | Foco |
|---------|--------|------|
| v0.1.166 | `📦701` | **FASE 1**: schema SQLite + bridge IPC. Tabla `seguimiento_incapacidad_caso` (~80 cols, UNIQUE empresa+cedula+fechas) + `seguimiento_incapacidad_registro` (FK CASCADE). 6 handlers: `guardar`/`listar`/`obtener`/`eliminar`/`exportarExcel`/`exportarTodos`. Sincronización bidireccional SQLite ↔ Excel con botón "Exportar a Excel" desde la UI. |
| v0.1.167 | `📦702+703+704` | **FASE 2+3**: banner BD con 4 estados visuales (is-unsaved/saved/exported/error), lista de casos en BD con badges, auto-hide header después de 30s de inactividad. |
| v0.1.168 | `📦701+705+706+fix3+4+5` | **Bugfixes críticos**: schema con columnas duplicadas (origen_dx2/dx3 en 2 secciones), error "[object Object]" al guardar, búsqueda primero en BD, tabla refleja seguimientos nuevos, estado actualizado, botón Siguiente inteligente (considera secciones atenuadas), mapeo de IDs reales del HTML, alias de export en el bridge. |
| v0.1.169 | `📦701+fix6+fix7` | **Informe PRI**: casos de BD incluidos con sus seguimientos (query separada a `seguimiento_incapacidad_registro WHERE caso_id = ?`). Mapeo: fecha en `colIdx[seguimiento N]`, descripción en `colIdx + 1` (columna adyacente sin header). Timezone fix en `formatDate` (YYYY-MM-DD + T00:00:00 para local). `determinarEstadoCaso` considera el caso de BD. |
| v0.1.170 | `📦701-fix8` | **Cédula display vs BD**: normalización en 2 capas (renderer + bridge) para que la query matchee siempre. Lección: cualquier query de BD con cédulas/documentos del display debe normalizar antes. |

### Estructura de archivos clave

```
sgsst-electron-app/
├── main/
│   ├── seguimiento-incapacidad-bridge.js  # 6 handlers IPC + schema SQL
│   └── db-instance.js                     # Singleton de la BD
├── preload.js                             # Expone window.electronAPI.seguimientoIncapacidad
├── modules/gestion-salud/ausentismo/
│   ├── medicion-ausentismo.js             # Renderer: flujo completo de seguimiento
│   └── informe-pri-builder.html           # Informe PRI (incluye casos de BD)
└── main.js                                # get-pri-seguimiento-data con casos de BD
```

### Patrón del bridge IPC (6 handlers)

```js
// 1. Schema SQL (idempotente, en try/catch)
const SEG_INC_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS seguimiento_incapacidad_caso (...)`;
const SEG_INC_REG_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS seguimiento_incapacidad_registro (...)`;

// 2. Helpers de transformación
function _aplanarCaso(caso) { /* frontend JSON → DB row */ }
function _expandirCaso(row, regs) { /* DB row → frontend JSON anidado {trabajador, incapacidad, pric, ...} */ }

// 3. Handlers
ipcMain.handle('seguimiento-incapacidad:guardar', (event, { empresaId, data }) => _handlerGuardar(empresaId, data));
ipcMain.handle('seguimiento-incapacidad:listar', (event, { empresaId }) => _handlerListar(empresaId));
ipcMain.handle('seguimiento-incapacidad:buscarPorCedula', (event, { empresaId, cedula }) => _handlerBuscarPorCedula(empresaId, cedula));
// ... + obtener, eliminar, exportarExcel
```

### Reglas para IAs que extiendan el flujo

1. **Patrón "tabla principal + tabla de detalles"**: `seguimiento_incapacidad_caso` (1 fila por caso) + `seguimiento_incapacidad_registro` (N filas con FK CASCADE). NO asumas que el caso tiene un array embebido de seguimientos — query separada.
2. **Patrón "Excel column header + adyacente sin header"**: el Excel legacy tiene `SEGUIMIENTO 1` en col N y la descripción en col N+1 (sin header propio). Al mapear de BD a Excel, setea por índice directo: `newRow[colIdx[seguimiento N]] = fecha` y `newRow[colIdx[seguimiento N] + 1] = descripcion`. Verifica `idxDesc < totalCols` antes de escribir.
3. **Patrón "defense in depth en 2 capas"**: cualquier input de display que vaya a query de BD debe normalizarse TANTO en el renderer (caller) COMO en el bridge (handler). La cédula display `1,044,392,755` no matchea con la BD `1044392755` — `.replace(/,/g, '').replace(/\./g, '').trim()` en ambos lados.
4. **Patrón "YYYY-MM-DD nativo en backend"**: el `formatDate()` del renderer espera ISO o Date nativo. Si mandas DD/MM/YYYY retorna "Invalid Date". El backend SIEMPRE envía YYYY-MM-DD, el frontend formatea para display.
5. **Patrón "sección ya capturada"**: cuando un caso ya tiene datos guardados, marcar `seccion1YaCapturada = true` para bypass de validación al reabrir. Caso nuevo → sección 1 (capturar), caso existente → sección 2 (continuar seguimiento).
6. **Patrón "botón Siguiente inteligente"**: considerar no solo "es la última sección" sino "hay siguiente VISIBLE (no atenuada)?" para el caso seguimiento simple.
7. **Patrón "exportar alias largo + corto"**: cuando se importa con destructuring, exportar TANTO el nombre largo COMO el corto (`registerSeguimientoIncapacidadHandlers: registerHandlers`) para evitar `undefined` cuando hay inconsistencia.
8. **Patrón "validar schema con Python sqlite3 antes de integrar"**: el bug del schema con columnas duplicadas pasó 2 versiones porque el try/catch silenciaba el error. Verificar el schema con `python -c "import sqlite3; ..."` antes de mergear.
9. **NO commitear sin autorización explícita** del usuario. "procede" = SOLO autoriza hacer cambios de código. "dale/OK/commit/perfecto" = autoriza commit. "realiza solo el commit" = autoriza commit sin push. "pushea y procede con el release" = push + bump + release.

---

## 🧪 Tests smoke (en `main/test-*.js`)

Desde v0.1.120, el proyecto tiene **tests smoke** en `sgsst-electron-app/main/test-*.js` que validan que los cambios no rompen nada.

**OJO — hay dos grupos:**
- Los `test-fixes-loopN.js` / `test-compose-bem.js` (históricos, 📦 de la Bandeja vieja) **están en
  `.gitignore`** (no se commitean).
- Los de la Bandeja Integrada premium **SÍ se commitean** (van con el cambio): `test-bandeja-premium-v2.js`,
  `test-firma-imagen.js`, `test-bandeja-toolbar-compacta.js`, `test-bandeja-paginacion.js` y
  `test-bandeja-paginacion-funcional.js`.

### Archivos de test
| Archivo | Checks | Qué valida |
|---------|--------|------------|
| `test-compose-bem.js` | 58 | BEM refactor 4 componentes (email-row, thread-header, quoted-thread, compose-panel) |
| `test-fixes-loop1.js` | 18 | 5 fixes visuales del loop 1 (hover fecha, word-break, quote, "para: —", chip "Recibidos") |
| `test-fixes-loop2.js` | 20 | Features 4-7 (adjuntos, firma, badge N mensajes, auto-refresh) |
| `test-fixes-loop3.js` | 11 | Badge N mensajes + auto-refresh 5 min |
| `test-fixes-loop4.js` | 14 | Operadores de búsqueda con chips visuales |
| `test-fixes-loop5.js` | 14 | 4 fixes visuales Gmail-style del loop 5 (body limpio, email no cortado, "hace X horas", chip) |
| `test-fixes-loop6.js` | 4 | 2 errores runtime (m is not defined + tailwindcss) |
| `test-fixes-loop7.js` | 8 | 3 mejoras visuales del preview de Z.ai (avatar 32px, sort, footer) |
| `test-fixes-loop8.js` | 10 | 3 ajustes de la imagen objetivo (para plano, 1 de N, weekday) |
| `test-bandeja-premium-v2.js` | 42 | Migración premium v2 (📦752): topbar, KPI cards, sidebar, capa CSS y contrato DOM |
| `test-firma-imagen.js` | 88 | Firma con imagen (📦753): MIME en línea, `cid:`, adjuntos, cupo de Gmail, no-leídos, respuesta rápida |
| `test-bandeja-toolbar-compacta.js` | 50 | Toolbar compacta (📦754): 1 fila de acciones + fila de carpetas, menú "Más", fix del helper `el()` |
| `test-bandeja-paginacion.js` | 48 | Paginación (📦755): esquema, sync `append`, scroll infinito, botón "Cargar más", fixes del cupo |
| `test-bandeja-paginacion-funcional.js` | 22 | **FUNCIONAL** (📦755): páginas sin solaparse, contador, `page_token` y ventana de fechas — contra SQLite real |
| `test-skeleton-encaje.js` | 26 | Encaje del esqueleto (📦756): compara radio/borde/padding/gap/alto del esqueleto contra las tarjetas reales, en los 7 homes y en el submódulo Mantenimiento |
| `test-chart-overflow.js` | 20 | El gráfico no se sale de su tarjeta ni deforma su texto (📦757+📦758): sin alto/ancho en línea, sin `preserveAspectRatio="none"`, sin texto dentro del dibujo, los 7 homes usan `.kair-bar-chart` + `.kair-chart--flow`, y cache-bust |
| `test-grafico-se-ve-bien.js` | 39 | Los gráficos se ven bien (📦758): **EJECUTA el código real** de los 7 homes con un DOM mínimo y verifica el HTML producido (porcentajes de cada barra, textos, filas) + las reglas CSS que impiden que se pisen |
| `test-evaluacion-inicial-premium.js` | 43 | Evaluación Inicial del SG-SST — ronda anterior (📦759): conserva las verificaciones de que el modo oscuro cubra `dark` Y `dark-legacy` y de que NO vuelva el CSS global inyectado desde el `.js`. Lo específico del rediseño v2 lo cubre el test de abajo |
| `test-evaluacion-inicial-v2.js` | 64 | Evaluación Inicial del SG-SST v2 (📦761): **EJECUTA la vista real** con un backend simulado y verifica la estructura del diseño nuevo (barra superior, pestañas, 3 indicadores clicables, medidor SVG, PHVA, los 5 modales), el adaptador `findings → estándares`, que los planes se guarden y se borren contra la base, el modo oscuro en los DOS atributos y el contrato con `renderer.js` |
| `test-evaluacion-inicial-bootstrap.js` | 22 | **Necesita ventana: `npx electron main/test-evaluacion-inicial-bootstrap.js`.** Choque con Bootstrap (📦761): monta el módulo con `bootstrap.min.css` cargado y **mide la geometría** del modal contra la ventana (que no quede `position: fixed`, que no se estire a todo el alto, que quede centrado y con su ancho de 420px) y que las tarjetas no hereden el fondo de la librería. Usa la copia local `main/_bootstrap-5.3.0.min.css` para no depender de la conexión |
| `test-evaluaciones-medicas-v2.js` | 85 | Evaluaciones Médicas Ocupacionales v2 (📦762): valida el **puente de base** (nombre, cédula, tipo, concepto, fechas y la regla de "Apto con recomendaciones" — todo ANTES de tocar la base), la **construcción** del módulo (clases prefijadas `emo-`, 107 ids del contrato, marcado balanceado, todos los selectores bajo `.emo-scope`, tokens fuera de `:root`), el **registro en la app** (los 4 puntos del patrón puente + `renderer.js` + **que la hoja esté linkeada en `index.html`**) y la **regla legal** de la renovación (certificado nuevo enlazado al anterior). Verificación visual: `npx electron main/_preview-emo.js` |
| `test-archivo-retencion-premium.js` | 50 | Archivo y Retención en premium (📦760): **EJECUTA la vista real** y verifica el adaptador de campos contra la forma exacta del backend (que el Tipo salga de los 4 booleanos, que la hoja se lea de `hojaOrigen`, y que el payload mande `disposicion` y no `disposicionFinal`), la estructura nueva, la edición en línea, el guardado masivo, los `type` del puente y el modo oscuro en todos los bloques |

**Nota:** el total puede variar si se agregan o quitan tests. Correr los del módulo que se toca antes de commitear.

### ⚠️ Tests FUNCIONALES: se corren con Electron, no con `node`
`better-sqlite3` está compilado para el ABI de Electron, así que un test que abra la base con `node`
a secas falla con `ERR_DLOPEN_FAILED`. Hay que correrlo con el Node de Electron:
```powershell
$env:ELECTRON_RUN_AS_NODE=1; npx electron main/test-bandeja-paginacion-funcional.js
```
(`ELECTRON_RUN_AS_NODE=1` ejecuta Electron como Node puro: sin ventana, sin GPU, sin problemas de sandbox.)


### Patrón de test
Cada test sigue el mismo patrón:
```js
const fs = require('fs');
const path = require('path');
const appPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');
const appSrc = fs.readFileSync(appPath, 'utf8');

const checks = [];
checks.push({ name: 'JS: feature X existe', ok: /patron regex/.test(appSrc) });
// ... más checks

// Reporte
var failed = 0;
checks.forEach(function (c) { /* ... */ });
process.exit(failed === 0 ? 0 : 1);
```

### Cómo correr los tests antes de commitear
```bash
cd sgsst-electron-app
for ($i=1; $i -le 8; $i++) { node main/test-fixes-loop$i.js }
node main/test-compose-bem.js
```

### Reglas
- **SIEMPRE** agregar un test nuevo cuando se implemente una feature (incrementar el contador)
- **SIEMPRE** correr los tests antes de commitear
- **NO** commitear si algún test falla (investigar y arreglar primero)
- Los tests son **smoke tests** (validan estructura, no funcionalidad completa). Para tests de integración usar herramientas más pesadas (no implementadas aún).

---

## 🔍 Workflow de auditoría visual (v0.1.120+)

Cuando el usuario pide una **auditoría visual** (compara una imagen objetivo con el código actual), seguir este workflow:

### Pasos

1. **Recibir la imagen objetivo** (screenshot, URL de preview, o descripción)
2. **Comparar con el código actual** de la Bandeja Integrada:
   - Render del detail (thread grouping, header, recipients, action icons)
   - Render de la lista (avatars, sender, subject, snippet, time, attachments, labels)
   - Estado de los correos (unread, read, selected, hover)
   - Filtros y ordenamiento
   - Footer / versión
3. **Listar las diferencias** en una tabla priorizada:
   - 🔴 Críticos (rompen la apariencia)
   - 🟡 Importantes (no coincide con objetivo)
   - 🟢 Nice to have (mejoras menores)
4. **Aplicar fixes priorizados** con prefijos descriptivos (`🎨 audit:`, `📧 audit:`, `🐛 fix:`, `📚 docs:`)
5. **Agregar test smoke** que valide cada fix (en `main/test-fixes-loop<N>.js`)
6. **Commitear** con mensaje que liste los cambios

### Ejemplo: `🎨 audit(objetivo): 3 ajustes para coincidir con imagen objetivo`
- 3 cambios: "para:" como texto plano, "1 de N" dinámico, "Dom" weekday
- 1 commit: `89bbf28`
- 1 test: `test-fixes-loop8.js` (10 checks)
- Si el user no está conforme: `git revert 89bbf28` → commit `1fd5c0f`

### Skills útiles para auditorías
- `ui-ux-pro-max` — Análisis de diseño con base de datos de patrones UI
- `code-reviewer` — Review de confianza para validar que los fixes son correctos
- `code-simplifier` — Simplificar el código de los fixes sin perder funcionalidad

---

## 📦 Skills de opencode-power-pack (instalados en v0.1.120, 📦564)

Además de los 14 skills de superpowers, hay **11 skills de opencode-power-pack** instalados en `.opencode/skills/`. Cada uno tiene su propio SKILL.md que se carga con `skill({ name: "<nombre>" })`.

| Skill | Propósito |
|-------|-----------|
| **brainstorming** | Refinar ideas antes de codificar |
| **code-architect** | Diseñar arquitectura antes de implementar |
| **code-explorer** | Entender código existente antes de modificarlo |
| **code-reviewer** | Review de bugs/seguridad/calidad |
| **code-simplifier** | Simplificar código manteniendo funcionalidad |
| **commit-workflow** | Crear commits y PRs con mensajes significativos |
| **dispatching-parallel-agents** | Workflows concurrentes con subagentes |
| **doc-coauthoring** | Co-autoría de documentos estructurados |
| **feature-dev** | Workflow de features nuevas (7 fases) |
| **finishing-a-development-branch** | Decidir merge/PR/keep al completar tareas |
| **receiving-code-review** | Responder a feedback de code review |
| **requesting-code-review** | Checklist pre-review |
| **security-review** | Review de seguridad (inyección, auth bypass, RCE) |
| **silent-failure-hunter** | Cazar errores silenciosos en try-catch |
| **subagent-driven-development** | Desarrollo rápido con subagentes |
| **test-driven-development** | Ciclo RED-GREEN-REFACTOR |
| **using-git-worktrees** | Branches aislados para desarrollo paralelo |
| **using-superpowers** | Introducción al sistema de skills |
| **verification-before-completion** | Verificar antes de declarar completo |
| **visual-page** | Crear página HTML visual para conceptos complejos |
| **writing-plans** | Crear planes de implementación |
| **writing-skills** | Crear nuevos skills |

**Nota:** Esta lista puede crecer. Verificar `.opencode/skills/` para los disponibles.

---

## 🎨 Sistema de Skeleton Screens (v0.1.110+, 📦483-491)

El proyecto tiene un sistema centralizado de placeholders de carga que reemplazan los spinners genéricos. **API expuesta como `KairSkeleton.*`** con 10 componentes (SkeletonCard, SkeletonTable, SkeletonKPI, etc.).

**Cuándo usar:** cualquier vista que muestre datos asíncronos (KPIs, listas, tablas) antes de tener los datos reales.

**Patrón canónico para homes de módulo** (orden crítico para evitar parpadeos):
1. `container.innerHTML = '<div class="kair-skeleton-home">…</div>';` (mostrar skeleton YA)
2. `main.appendChild(container);` (montar en DOM)
3. `setTimeout(() => { loadStats(); }, 200);` (esperar 200ms para que el browser pinte el skeleton)
4. Dentro de `loadStats()`: hacer fetch, render real, `container.innerHTML = …` (reemplazar skeleton)

### Patrón canónico para homes de módulo

```js
async render() {
    this.container.innerHTML = '';
    // ... setup de layout ...

    const mainArea = document.createElement('div');
    mainArea.className = 'main-area';
    mainArea.style.flex = '1';

    // 1. Inyectar skeleton EN mainArea
    mainArea.innerHTML = KairSkeleton.kpiStrip(5) + KairSkeleton.chartBars(12) + KairSkeleton.chartDonut();

    // 2. Agregar al DOM (skeleton visible)
    contentContainer.appendChild(mainArea);
    layout.appendChild(contentContainer);
    this.container.appendChild(layout);

    // 3. Retardo 200ms (ojo registra el skeleton)
    await new Promise(r => setTimeout(r, 200));

    // 4. Cargar datos (skeleton visible mientras espera)
    await this.refreshStats();  // o await this.loadXxxStats();

    // 5. Renderizar widgets (limpia skeleton primero)
    await this.renderMainArea(mainArea);
}

async renderMainArea(container) {
    container.innerHTML = '';  // SIEMPRE limpiar antes de pintar
    // ... crear widgets y charts con datos reales ...
}
```

### Reglas críticas

1. **📦756 — EL ESQUELETO TIENE QUE ENCAJAR CON EL CONTENIDO REAL.** El bloque sombreado
   que se ve mientras cargan los datos debe ocupar **exactamente el mismo espacio** que el
   contenido que lo reemplaza; si no, al llegar los datos todo salta de lugar.
   Medido en 📦756, los homes usaban `KairSkeleton.kpiStrip(4)`, que dibujaba 4 tarjetas
   genéricas con OTRA forma:

   | Medida | Esqueleto viejo (`.ks-kpi-card`) | Tarjeta real (`.kair-metric-card`) |
   |---|---|---|
   | Radio | 12px | **20px** (`--kair-radius-card`) |
   | Padding | 20px fijo | clamp(15px, 1.6vw, 22px) / clamp(15px, 1.6vw, 20px) |
   | Alto mínimo | 104px | **clamp(110px, 10vw, 140px)** |
   | Layout | fila con avatar de 48px | **columna** (label / valor / descripción / barra) |
   | Contenedor | gap 16px + margin-bottom 24px, sin gutter | `.kair-health`: gap clamp(10,1.2vw,16) + gutter clamp(4,0.6vw,8) |
   | Borde | `--border-color` (#e2e8f0) | `--kair-line` (#e8ebee) |
   | Estructura | 4 tarjetas iguales (+ chart de 280px) | hero oscuro (2 columnas) + 3 métricas + 2 tarjetas + grilla de submódulos |

   **Solución (la definitiva)**: los generadores `KairSkeleton.home()`, `homeHero()`,
   `homeContent()`, `homeModules()`, `metricStrip()` y `metricCard()` **reutilizan las clases
   REALES** (`.kair-health`, `.kair-hero-card`, `.kair-metric-card`, `.kair-content`,
   `.kair-card`, `.kair-chart`, `.kair-legend`, `.kair-task`, `.kair-modules`,
   `.kair-module-grid`, `.kair-module`) y sólo cambian el texto por barras `.ks-bar`. El
   radio, el borde, el padding, el gap y el alto mínimo son idénticos **por construcción**:
   no hay una segunda hoja de estilos que se pueda desincronizar.
   - Los 7 homes de módulo usan `mainArea.innerHTML = KairSkeleton.home({ metrics: 3, rows: 4, modules: 6 })`.
   - El CSS `.ks-*` que sí sigue existiendo (para tablas, listas, formularios y KPIs) quedó
     **alineado** a las medidas premium y expone variables (`--ks-kpi-min`, `--ks-kpi-gap`,
     `--ks-kpi-pad`, `--ks-kpi-radius`, `--ks-kpi-minh`, `--ks-kpi-align`, `--ks-kpi-text`).
   - Un submódulo con KPIs de otra medida alinea su esqueleto **sin tocar styles.css**,
     declarando las variables en el contenedor. Ejemplo real (📦756) en
     `mantenimiento.css`: sus tarjetas son de 180px y centradas, así que el esqueleto hereda
     `--ks-kpi-min: 180px`, `--ks-kpi-pad: var(--kair-mnt-space-4) var(--kair-mnt-space-5)`, etc.
   - `kair-skeleton.js` se cargaba **sin `?v=`** en index.html → ahora tiene cache-bust.

   **Regla práctica**: antes de usar un esqueleto genérico, mirá el componente REAL que va a
   reemplazarlo y compará radio, borde, padding, gap y alto mínimo. Si difieren, hay salto.

2. **`?.` y `||` con default**: `KairSkeleton.show(container, 'table', { rows: 12 })` inyecta
   `.ks-skeleton-state` dentro del target; `hide()` borra ese wrapper. El `show` guarda el
   HTML previo en `dataset.ksPrev` (no lo restaura solo).


1. **Orden del DOM**: `appendChild` debe ir ANTES del `await renderMainArea/loadStats`. Si invertís el orden, el await termina antes de que mainArea sea visible.
2. **Retardo 200ms**: `setTimeout(200)` mínimo entre `appendChild` y `await`. `requestAnimationFrame` (16ms) es insuficiente.
3. **Limpieza en renderMainArea**: `container.innerHTML = ''` SIEMPRE al inicio, sino el skeleton queda apilado con los widgets reales.
4. **Conteo correcto**: el skeleton debe coincidir con la cantidad y tipo de widgets/charts que `renderMainArea` realmente crea.

### Bug detector automatizado

```bash
node -e "
const fs=require('fs');
const path=require('path');
const homes=['modules/gestion-integral/gestion-integral-home.js','modules/recursos/recursos-home.js','modules/gestion-salud/gestion-salud-home.js','modules/gestion-peligros/gestion-peligros-home.js','modules/gestion-amenazas/gestion-amenazas-home.js','modules/verificacion/verificacion-home.js','modules/mejoramiento/mejoramiento-home.js'];
homes.forEach(f=>{const code=fs.readFileSync(f,'utf8');const renderStart=code.indexOf('async render()');const body=code.slice(renderStart,renderStart+3000);const awaitIdx=body.indexOf('await this.renderMainArea');const appendIdx=body.indexOf('this.container.appendChild(layout)');if(awaitIdx>0&&appendIdx>0&&awaitIdx<appendIdx){console.log('⚠️  '+f);}else{console.log('✅ '+path.basename(f));}});
"
```

---

## 🔄 Dual-tree workflow (instalador ↔ git clone)

El proyecto se mantiene en DOS árboles paralelos:

- **Instalador built** (`D:\K-AIR-Installer-v<X>\resources\`) — artefacto empaquetado, runtime "source of truth"
- **Git clone** (`C:\Proyectos de Programación\Clone de Git\SG-SST-E\sgsst-electron-app\`) — repositorio de desarrollo

### Flujo

1. El usuario trabaja en la app instalada (la ejecuta como usuario final)
2. Periódicamente sincroniza el clon con el contenido del instalador para commitear cambios
3. La sincronización es **unidireccional D → C** (instalador → clon)
4. El clon recibe los cambios, se commitea, se pushea a GitHub

### Reglas

- **NO** copiar wholesale el `package.json` del instalador — solo trae `dependencies` (runtime), pierde `scripts`/`build`/`devDependencies`. Merge selectivo: deps del instalador + scripts/build/devDeps del clon.
- **Verificar** que `D:\` NO tiene `.git` antes de copiar (para no pisar nada por accidente)
- **Después de copiar**: `git status --short` puede reportar muchos "modified" pero el `git commit` real capturará menos (autocrlf).
- **Al reportar al usuario**, NO fiarse del conteo de `git status`. Decir "se copiaron N archivos pero solo M tenían cambios reales vs HEAD" si hay discrepancia.
- **Bump de versión** en `package.json` lo hace el USUARIO manualmente (no automático), 1 commit dedicado.
- **NO** commitear sin autorización ("sí"/"dale"/"commit"). Delegaciones por fase son puntuales, no transferibles.

### Script de sync típico

```bash
# Antes de sincronizar, verificar que D:\ no tiene .git
ls "D:\K-AIR-Installer-v0.1.110\resources" | Select-String ".git"

# Sincronizar selectivamente
Copy-Item "D:\K-AIR-Installer-v0.1.110\resources\modules\gestion-integral\gestion-integral-home.js" `
            "C:\Proyectos de Programación\Clone de Git\SG-SST-E\sgsst-electron-app\modules\gestion-integral\gestion-integral-home.js" -Force

# Verificar
cd "C:\Proyectos de Programación\Clone de Git\SG-SST-E\sgsst-electron-app"
git status --short
```

---

## 📊 Snapshot actual del proyecto (snapshot 2026-07-19)

- **Versión:** 0.1.120
- **Working tree:** limpio
- **Último commit:** `1fd5c0f` (Revert "🎨 audit(objetivo): 3 ajustes")
- **Commits principales recientes (en orden inverso):**
  - `1fd5c0f` — Revert "🎨 audit(objetivo): 3 ajustes" (deshizo el `89bbf28`)
  - `89bbf28` — 🎨 audit(objetivo): 3 ajustes (REVERTIDO)
  - `e44ddde` — 🎨 audit(preview-z-ai): 3 mejoras visuales (avatar 32px, sort, footer)
  - `dd577fe` — 🐛 fix(bandeja-integrada): 2 errores runtime
  - `b68b316` — 📧 audit(thread-grouping): refactor Gmail compacto
  - `6c0fb4b` — 📦564 # Instalar skills oficiales
  - `25a51d6` — 📚 docs: actualizar documentación completa v0.1.120
  - `383a96f` — 🔖 Bump version 0.1.120
  - `aef69d9` — 📦563 # Bandeja Integrada (release principal)
- **Sistema de Skeletons:** completo (📦483-491, 9 commits)
- **Bandeja Integrada:** completa y validada (📦563, 22 archivos, 11,285 líneas). Coexiste con K+AIR Calendar. OAuth + SQLite cache + Gmail-look UI + BEM refactor 4 componentes + 7 features. **Tests: 172/172 OK** acumulado. Ver la sección "🆕 Bandeja Integrada" más abajo en este archivo para los detalles completos.
- **9 módulos + 48 submódulos con lógica + ~58 submódulos menú + Bandeja Integrada (nuevo módulo de correo)**
- **Pendientes próximos (post-Bandeja Integrada):**
  - F3.C — Google Calendar write (eventos creados en Bandeja Integrada → Google Calendar real)
  - Refactor total legacy → BEM puro (sin compat con `.kair-mail-row`)
  - Vista diferenciada Enviados vs Recibidos (mostrar destinatario como sender en Enviados)
  - Drag & drop visual de correos al calendario
  - Bandeja Integrada v2 features: drag&drop archivos al compose, undo, snooze, mail icons overlay en calendar

---

## 📊 Snapshot actualizado (snapshot 2026-07-24)

- **Versión:** 0.1.136 (publicada, sin bump nuevo)
- **Working tree:** limpio
- **Último commit:** `7eb39dc` (📦603-fix)
- **Commits nuevos en esta sesión (📦601-📦603-fix):**
  - `a687a04` — 📦601 feat(calendario): RSVP modal + banner invitacion ICS en emails + auto-refresh 1 min
  - `a2a71e1` — 📦602 feat(bandeja-integrada): email viewer estilo Gmail (banner ICS, divider, translation banner, reply footer)
  - `b332f34` — 📦602-fix feat(bandeja-integrada): alinear banner ICS con header (padding 0 20px)
  - `5621989` — 📦603 fix(bandeja-integrada): 2 fixes importantes (sync no borra threads antes; banner+divider+footer alineados)
  - `7eb39dc` — 📦603-fix feat(bandeja-integrada): preservar messages al refrescar state.mails (FIX REAL del bug)
- **Commits REVERTIDOS esta sesión:**
  - `c76eb3d` — 📦604 (scroll interno + sidebar sticky). User pidió revertir. **NO commiteé sin autorización explícita** (ver regla abajo).
- **Logros del email viewer (📦602):**
  - Banner de invitación ICS entre header y cuerpo del correo (estilo Gmail)
  - Icono Calendar 4-colores en esquina superior derecha del banner
  - Botones Sí/No/Tal vez + "Proponer otro horario" + ⋮
  - Divider "Según este correo electrónico" con feedback 👍/👎
  - Banner de traducción con detección simple EN/ES
  - Header de adjuntos "X archivo adjunto · Analizado por Gmail"
  - Footer Responder/Reenviar con iconos SVG inline
  - Padding 20px en divider/footer/botones para alinear con cuerpo
- **Logros del F3.C Google Calendar sync (📦601):**
  - `shared/google-calendar.js` (nuevo, 360 líneas) con 7 funciones
  - 6 IPCs nuevos en main.js: `google-calendar:list/create/update/delete/sync/respond/upsert-from-ics`
  - preload.js expone `googleCalendar.*` en contextBridge
  - `sendUpdates: 'all'` en create/update/delete (envía invitación a attendees)
  - RSVP buttons (Asistiré/Tal vez/No) en modal con `responseStatus`
  - Parser RFC 5545 mínimo (parseIcs) en renderer
  - Banner invitación Calendar en email viewer
  - Auto-refresh cada 1 minuto
- **Bug crítico del sync resuelto (📦603 + 📦603-fix):**
  - **Causa 1 (backend)**: `deleteThreadsByFolder` borraba TODOS los threads antes del re-insert. Fix: mover delete después + nueva función `deleteThreadsByIds`.
  - **Causa 2 (frontend, MÁS SUTIL)**: `syncInboxInBackground` reemplazaba `state.mails` con objetos NUEVOS sin `messages`/`body`/`body_html`/`attachments`. Fix: mergear datos del cache con mails existentes por ID, preservando campos lazy-loaded. Más red de seguridad en `renderMailDetail` con flag `_loadingBody`.
  - **Lección**: cuando un bug persiste después de un fix "obvio", buscar la causa en otro lugar. En este caso el fix backend era correcto pero incompleto.
- **Tests: 189/189 OK** acumulado (de submódulo 3.1.3)

---

## 📊 Snapshot actualizado (snapshot 2026-07-27 — file-viewer + v0.1.137)

- **Versión:** 0.1.137 (publicada)
- **Working tree:** con cambios sin commitear (file-viewer feature, ver abajo)
- **Último commit pusheado:** `80fba542` (📦606 release notes)
- **HEAD:** `80fba542`
- **Tamaño `renderer/file-viewer-assets/`:** 29.16 MB (después de limpieza de carpetas no usadas; era 139 MB original)
- **Pendiente próximo commit:** 1 commit único con todo el feature de file-viewer (Pendiente de autorización del user)

**Commits pusheados desde snapshot anterior (📦604-📦606):**
- `a578c09b` — 📦604 feat(skills): emilkowalski/skills (8 skills) + snapshot 2026-07-24
- `7eb39dc7` — 📦603-fix feat(bandeja-integrada): preservar messages al refrescar state.mails
- `5621989` — 📦603 fix(bandeja-integrada): 2 fixes importantes (sync no borra threads antes; banner+divider+footer alineados)
- `b332f34d` — 📦602-fix feat(bandeja-integrada): alinear banner ICS con header
- `a2a71e1` — 📦602 feat(bandeja-integrada): email viewer estilo Gmail
- `a687a04` — 📦601 feat(calendario): RSVP modal + banner invitación ICS en emails + auto-refresh 1 min
- `f0b0bbb6` — 🔧 chore(build): excluir skills de opencode del paquete
- `a87e001d` — 🔖 Bump version 0.1.136 → 0.1.137
- `9643ea93` — 📦605 feat(bandeja-integrada): scroll interno sidebar + lista correos
- `80fba542` — 📦606 feat(release): release notes con `releaseInfo.releaseNotesFile` apuntando a `release-notes.md`

**Commits REVERTIDOS esta sesión:**
- `c76eb3d` — 📦604 (scroll interno + sidebar sticky). User pidió revertir. Lección: hacer un panel a la vez y validar entre cada uno.

---

El user me lo recordó FIRME el 2026-07-24 después de que commiteé `📦604` sin pedirle OK.

**REGLA**: 
- **NUNCA** hacer commit/push sin que el user diga explícitamente: "dale", "OK", "commit", "perfecto" o "procede"
- Si dice "sin commit hasta X", respetarlo estrictamente
- Si dice "revierte" o "elimina", hacer `git reset --hard` al commit anterior INMEDIATAMENTE
- El user acumula cambios en working tree, los valida visualmente, y solo después autoriza el commit
- Asumir "quedo bien" = "hace commit" es MAL

**Patrón de trabajo**:
1. Hacer cambios, dejar en working tree
2. Mostrar resumen claro de qué se cambió
3. Preguntar: "probá y decime si está bien. Si está OK, commiteamos"
4. Esperar la palabra clave
5. SOLO entonces hacer commit

**Caso real (esta sesión)**: commiteé `c76eb3d` (📦604) sin pedir OK. User lo revirtió con `git reset --hard 7eb39dc`. No volver a repetir.

---

## 🆕 Layout Bandeja Integrada: scroll interno en paneles (2026-07-27)

El user pidió "que todo quepa en la app sin desplazamientos" — el scroll debe ser INTERNO de cada panel, no de la página completa.

**Patrón validado** (commit `9643ea93`, 📦605 — pasos 1 y 2):

```css
html, body { height: 100%; overflow: hidden; }  /* bloquea scroll de página */

.kair-panel {                                    /* cualquier panel (sidebar, lista, detalle, calendar) */
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;                                 /* CRÍTICO: permite que el item flexible se encoja */
  overflow: hidden;
}
.kair-panel > .fijo { flex-shrink: 0; }                       /* header/search/footer NO se encojen */
.kair-panel > .scroll { flex: 1; min-height: 0; overflow-y: auto; }  /* contenido con scroll INTERNO */
```

**Requisito para que `height: 100%` funcione**:
- El padre debe ser flex O grid (NO `display: block`)
- En grid: `grid-template-rows: 1fr` + `align-items: stretch` explícitos
- `min-height: 0` en CADA nivel de flex/grid anidado

**Pasos aplicados**:
- **Paso 1 (sidebar, ✅ validado)**: mini-cal fijo arriba, leyenda flexible con scroll, integración fija abajo
- **Paso 2 (lista correos, ✅ validado)**: header + buscador + filtros fijos, items con scroll
- **Paso 3 (pendiente)**: detalle del correo con header sticky + footer fijo + body scrollable
- **Paso 4 (pendiente)**: calendar slide con toolbar fija + grid scrollable
- **Paso 5 (pendiente)**: resize handler en `renderer.js` para que el iframe se reajuste al cambiar tamaño de ventana

**Lección del 📦604 revertido (vs 📦605 que funciona)**:
- **604**: hizo los 3 cambios a la vez (sidebar + lista + detalle + sticky) sin debuggear → se rompió
- **605**: hace UN panel a la vez, validando con el user en cada paso → funciona
- El user prefiere ir paso a paso con validación visual entre cada uno

---

## 🆕 Skills de emilkowalski instaladas (2026-07-27)

Commit `a578c09b` (📦604). 8 skills de diseño + animación instaladas:
- `emil-design-eng` — skill principal (UI polish, animación, component design)
- `review-animations` — review estricto contra estándares altos
- `improve-animations` — audit + planes priorizados
- `find-animation-opportunities` — búsqueda de oportunidades de motion
- `animation-vocabulary` — glosario de términos correctos
- `apple-design` — principios de diseño de Apple
- `pick-ui-library` — picker de UI library
- `prototype` — múltiples versiones de UI

**Instalación**: `npx skills@latest add emilkowalski/skills --all`

**Estructura creada**:
- `.agents/skills/` — 8 skills fuente universal (SKILL.md reales)
- `.opencode/skills/` — 8 junctions (mklink /J) → `.agents/skills/` (para opencode)
- `.claude/skills/` — 8 junctions → `.agents/skills/` (para Claude)
- `agent/skills/` — 8 junctions → `.agents/skills/` (otros agentes)
- `skills-lock.json` — metadata con hashes para restaurar

**Total en `.opencode/skills/`**: 21 skills (13 que ya teníamos + 8 nuevas).

**Para Windows**: el instalador oficial crea symlinks Unix que no funcionan en Windows. Hay que usar `cmd /c "mklink /J ... ..."` o `New-Item -ItemType Junction` con paths absolutos (los paths relativos con `..\..\..\.agents\skills\` se resuelven mal).

---

## 🆕 @file-viewer — preview nativo de Office/PDF (2026-07-27, working tree)

User aprobó integrar [flyfish-dev/file-viewer](https://github.com/flyfish-dev/file-viewer) para reemplazar los 3 IPCs de preview actuales (`get-pdf-preview`, `get-word-preview`, `get-excel-preview`) que dependen de Python + LibreOffice (lentos, baja fidelidad, sin búsqueda, sin selección de texto).

**Estrategia: migración gradual (Opción B)** — los 3 IPCs viejos siguen vivos (no se rompe nada), el file-viewer se agrega como camino nuevo para los formatos Office (PPTX, DOCX, XLSX, imágenes, etc.). PDF queda en el flujo viejo por ahora (decisión aparte, ver "Pendientes próximos").

**Arquitectura del flujo nuevo**:

```
Renderer (browser)
  ├─ PDF actual:    getPDFPreview   ─┐
  ├─ DOCX actual:   getWordPreview  ─┤  ← MANTENER (prescindibles gradualmente)
  ├─ XLSX actual:   getExcelPreview ─┘
  └─ PPTX + resto:  readFileBytes (NUEVO) → Blob → <flyfish-file-viewer>
                                                │
Main process (Node)                              │
  ├─ IPCs actuales (sin cambios) ────────────────┤
  └─ IPC NUEVO read-file-bytes  ──────────────── ┘
```

**Componentes implementados (en working tree, sin commitear)**:

1. **NPM deps nuevas**:
   - `@file-viewer/web@2.2.3` (production) — bundle IIFE del viewer
   - `@file-viewer/preset-office` (production) — solo PDF/Word/Excel/PowerPoint (no trae CAD/3D/drawio/typst)
   - `pptxgenjs` (dev) — generador del sample de prueba

2. **IPC nuevo `read-file-bytes`** (`main.js`):
   - Recibe `filePath`, valida ruta accesible
   - Whitelist de extensiones (~200 formatos Office/PDF/imagenes/video/audio/EML/ZIP/3D/CAD/Mermaid/PlantUML/XMind/draw.io)
   - Validación de tamaño máximo **100 MB** (configurable vía `KAIR_FV_MAX_BYTES` env)
   - Retorna `{ success, data: { bytes: Uint8Array, name, ext, size } }` o `{ success: false, error }`
   - NO convierte a PDF, NO llama Python/LibreOffice — bytes crudos

3. **Preload** (`preload.js`):
   - `window.electronAPI.readFileBytes(filePath)` → IPC

4. **Helper compartido** (`shared/file-viewer.js`):
   - `window.kairFV.openWithFileViewerFromPath(filePath)` — abre el modal global con file-viewer
   - `window.kairFV.openFileViewerFromFile(file)` — variante con File API (input file)
   - `window.kairFV.closeFileViewer()` — cierra el modal
   - Crea el DOM del modal (full-screen) si no existe
   - Carga el bundle IIFE del viewer
   - Configura `setDefaultFullAssetBaseUrl('renderer/file-viewer-assets/')` para que los workers carguen desde el directorio local

5. **Bundle IIFE + helper cargados en `index.html` raíz** (renderer global):
   - `<script src="renderer/file-viewer-assets/flyfish-file-viewer-web.iife.js">` antes de `renderer.js`
   - `<script src="shared/file-viewer.js">` después del bundle
   - **CSP ajustada** para permitir `blob:` en `frame-src`/`child-src`/`img-src`/`script-src`/`object-src` (necesario para que el viewer renderice con Blob URLs)

6. **Switch del orquestador** (`renderer.js:1215`):
   - Cuando llega cualquier `*-preview-request`, decodifica `payload.filePath`
   - Detecta la extensión
   - Si es Office (no PDF) → dispara `kairFV.openWithFileViewerFromPath()` y responde al módulo con un **PDF dummy 1×1px** (base64 hardcoded) marcado con `handled: 'file-viewer'` para que el módulo no rompa su flujo de mostrar el response en un iframe
   - Si es PDF → llama al IPC viejo (sin cambios)
   - **Workaround documentado**: la integración limpia en los 46 submódulos (que detecten `handled: 'file-viewer'` y no muestren nada) queda pendiente

7. **Demo standalone en Bandeja Integrada** (`renderer/bandeja-integrada/{app.js,index.html,styles.css}`):
   - Botón "Probar FV" en el header (temporal pero útil para probar archivos que no estén en el flujo)
   - Input file oculto que acepta 200+ formatos
   - Modal full-screen con header (extensión coloreada por tipo, nombre, tamaño) + body con `<flyfish-file-viewer>` + cerrar con ESC o click fuera
   - 2 variantes: `openFileViewerFromFile(file)` (File API) y `openWithFileViewerFromPath(filePath)` (IPC)

8. **Sample PPTX** (`assets/samples/sample-sgsst.pptx` + `scripts/generate-sample-pptx.js`):
   - 8 slides con contenido SG-SST realista: portada, marco legal (Decreto 1072, Resolución 0312), política, objetivos, ciclo PHVA, indicadores, cierre
   - 175 KB, generado con `pptxgenjs`
   - Se puede regenerar con `node scripts/generate-sample-pptx.js`

9. **Script de setup reproducible** (`scripts/setup-file-viewer.js`):
   - Reinstala los assets oficiales via `file-viewer-copy-assets` (~139 MB)
   - Borra las carpetas que no usamos con `preset-office` (drawio 59 MB, typst 36 MB, model 7.4 MB, cad 6.3 MB, data 0.6 MB) → **queda en 29 MB**
   - Reporta el tamaño final
   - **Uso**: `node scripts/setup-file-viewer.js` (idempotente, se puede correr cada vez que se actualice el paquete)

**Limpieza de assets** — análisis del tamaño original de `renderer/file-viewer-assets/`:

| Categoría          | Tamaño   | Usado |
|--------------------|---------:|:-----:|
| vendor/drawio/     | 59.29 MB | NO    |
| wasm/typst/        | 36.25 MB | NO    |
| vendor/ppt/        | 17.29 MB | SÍ    |
| vendor/pdf/        |  9.18 MB | SÍ    |
| wasm/model/ (3D)   |  7.40 MB | NO    |
| wasm/cad/          |  6.26 MB | NO    |
| vendor/libarchive/ |  1.01 MB | SÍ (ZIP)  |
| vendor/xlsx/       |  0.79 MB | SÍ    |
| wasm/data/ (sql)   |  0.63 MB | NO    |
| vendor/pptx/       |  0.55 MB | SÍ    |
| vendor/docx/       |  0.32 MB | SÍ    |
| **Total**          | **139 MB → 29 MB** | |

**Cosas que NO se tocaron** (preservadas para no romper):
- Los 3 IPCs viejos (`get-pdf-preview`, `get-word-preview`, `get-excel-preview`) — siguen funcionando
- El flujo de PDF — el switch del orquestador mantiene el camino viejo cuando ext === 'pdf'
- Los 46 submódulos que llaman a los IPCs viejos — no se modificó ningún `*-logic.js` ni `*-component.js`
- El modal genérico de la Bandeja Integrada (`#modal-overlay` / `#event-modal`) — el modal de file-viewer es independiente (`#fv-overlay` / `#fv-body`)

**Pendiente de validación por el user** (working tree, sin commitear):
- PPTX: abrir `assets/samples/sample-sgsst.pptx` desde Bandeja Integrada (botón "Probar FV")
- XLSX: abrir un Excel desde cualquier submódulo → file-viewer modal global
- DOCX: abrir un Word desde cualquier submódulo → file-viewer modal global
- PDF: el flujo viejo (sin cambios, sigue funcionando)

**Pendiente para iteración futura** (no urgente):
- Integración limpia en los 46 submódulos (que detecten `handled: 'file-viewer'` y no muestren el PDF dummy)
- Decisión sobre PDF (mantener flujo viejo o migrar a file-viewer)
- Empaquetado: verificar que el `files: ["**/*"]` del package.json incluye `renderer/file-viewer-assets/` y que el .exe no excede ~270 MB (243 + 29)
- Probar auto-update end-to-end
- Rotar `GH_TOKEN` (comprometido, sigue pendiente)

---

## 🆕 Gotcha: copy-assets.mjs crea duplicado en public/file-viewer/ (📦629, 2026-07-29)

**Síntoma**: VS Code muestra "Cambios 2911" con archivos "U" (Untracked) sin razón aparente.

**Causa raíz**: El script oficial `node node_modules/@file-viewer/web-full/scripts/copy-assets.mjs`
siempre copia los assets a `public/file-viewer/` (carpeta de la app original de file-viewer).
Pero nuestro proyecto Electron usa `renderer/file-viewer-assets/` (ver `shared/file-viewer.js:455`
y `scripts/setup-file-viewer.js`). El duplicado en `public/` no se usa, pesa 176.84 MB, y
queda como 2910 archivos untracked que el `.gitignore` del subdir no cubría.

**Fix aplicado** (commit `aa3a7e32`, 📦629):
- `sgsst-electron-app/.gitignore`: agregar `public/file-viewer/` y `docs/`
- `public/file-viewer/` (176.84 MB) → papelera con `mavis-trash`

**Regla para futuro**:
- Si VS Code reporta >100 untracked, **asumí .gitignore gap primero**, NO display bug
- Después de correr `copy-assets.mjs`, **verificar** con `git ls-files --others --exclude-standard | wc -l`
- Diagnosticar con `git ls-files --others --exclude-standard` (canta la verdad), NO solo `git status` (agrupa por dir)
- Si aparecen 2900+ untracked justo después de un upgrade de file-viewer, es ESTO

---

1. 🔐 **URGENTE**: rotar `GH_TOKEN` (sigue expuesto en respuestas anteriores)
2. Probar auto-update end-to-end: instalar v0.1.136 manual, bumpear a v0.1.137 trivial con `.\scripts\release.ps1`
3. **Bug pre-existente `.gitignore`**: `test-*.js` ignora `main/test-fixes-loop48.js` (161 tests) y `main/test-profesiograma-*.js` (189 tests). Fix: cambiar regla a `test-tmp-*.js`. **Commit aparte** porque toca `.gitignore`.
4. **Backlog K+AIR**:
   - Optimizar python-embed: pymupdf → pypdfium2, strip `__pycache__`
   - asar + asarUnpack bien configurado (F3.C puede meter assets)
   - Bandeja Integrada v2: drag&drop archivos al compose, undo, snooze
   - F3.C ya hecho (sync bidireccional) — falta polish
5. **Layout Bandeja Integrada — Pasos 3, 4, 5**:
   - Paso 3: detalle del correo con header sticky + footer fijo
   - Paso 4: calendar slide con scroll interno
   - Paso 5: resize handler en renderer.js para ajustar iframe al cambiar tamaño

## 🆕 Ciclo Laboral 1.0 cerrado en Gestión Humana (📦767 + fix, v0.1.191, 2026-08-31)

A partir de **v0.1.191** el submódulo de Base Personal (Gestión Humana) tiene el **ciclo laboral completo del bp** cerrado: ACTIVO → RETIRADO → ACTIVO (vía REINGRESO o RECONTRATACION), con eventos transaccionales en `gh_eventos_personal` y barrera en backend, import y frontend. **Esta es la única fuente de verdad para reglas de transición de ciclo. Si una futura sesión de AI tiene que tocar algo de esto, léase esta sección primero.**

### Arquitectura de las 4 transiciones atómicas

| Handler | Transición | Tabla afectada | Evento generado | Atomicidad |
|---|---|---|---|---|
| `gh:cambiar-estado` (estado=retirado) | ACTIVO → RETIRADO | UPDATE `estado='retirado', fecha_retiro=...` | `RETIRO` en `gh_eventos_personal` | BEGIN+UPDATE+INSERT+COMMIT (ROLLBACK ante error) |
| `gh:cambiar-estado` (estado=activo) | RETIRADO → ACTIVO | UPDATE `estado='activo', fecha_retiro=NULL` | `REINGRESO` en `gh_eventos_personal` | BEGIN+UPDATE+INSERT+COMMIT |
| `gh:recontratar-personal` | RETIRADO → ACTIVO + nueva CT | UPDATE bp + INSERT `contrataciones` + UPDATE vincula | `RECONTRATACION` en `gh_eventos_personal` (con `contratacion_id`) | BEGIN+INSERT+UPDATE+UPDATE+INSERT+COMMIT |
| `gh:delete-personal` | (ninguna de ciclo) | UPDATE `activo=0` | (ninguno) | atómico pero NO genera evento |

### REGLA DE ORO (no violar en futuras sesiones de AI)

**`gh:cambiar-estado` es la ÚNICA autoridad para RETIRO y REINGRESO.**
**`gh:recontratar-personal` es la ÚNICA autoridad para RECONTRATACION.**

`gh:update-personal` **NO puede** modificar:
- `estado` (ciclo) — bridge rechaza con `PROTECTED_FIELD`
- `fechaRetiro` (ciclo) — bridge rechaza con `PROTECTED_FIELD`
- `fechaIngreso` (ciclo) — bridge rechaza con `PROTECTED_FIELD`

El rechazo es **atómico**: si llega un campo protegido junto a campos válidos (`cargo`, `salario`, `email`, etc.), no se aplica NADA. Rollback completo. Esto evita que un payload mixto actualice parcialmente la BD.

### Defensa en 3 capas

1. **Bridge (`main/gestion-humana-bridge.js`)**: autoridad. Rechaza en backend.
2. **Frontend (`modules/gestion-humana/base-personal/index.js`)**: UX. `_saveDetailEdit` filtra `PROTECTED_FIELDS`. Tab "Datos Laborales" muestra los 3 campos como read-only.
3. **Import (`gh:import-personal`)**:的政策 estricta CASE WHEN. No pisa `fecha_retiro` ni `estado retirado` de bp existente.

### Reglas de import (crítico, fácil de romper)

| Campo del bp existente | Valor en Excel | Acción del import-update |
|---|---|---|
| `estado = retirado` | (cualquier) | **CONSERVAR** (no pisar) |
| `estado = activo` | (cualquier) | Actualizar (revisión administrativa legítima) |
| `fecha_ingreso` con valor | (cualquier) | **CONSERVAR** |
| `fecha_ingreso` NULL | nueva fecha | **COMPLETAR** (excepción permitida) |
| `fecha_retiro` con valor | (cualquier) | **CONSERVAR SIEMPRE** (incluso si Excel trae otra fecha) |
| `fecha_retiro` NULL | nueva fecha | **NO COMPLETAR** (preservar NULL) |
| bp activo + `fechaRetiro` en Excel | (cualquier) | **REPORTAR WARNING** (no asignar, no abortar la fila) |

### Estructura de `gh_eventos_personal`

- **12 columnas**: id (prefijo `ev-`), empresa_id, trabajador_id, tipo_evento, fecha_evento, estado_anterior, estado_nuevo, fecha_referencia, contratacion_id, metadata (JSON), usuario_id, created_at.
- **3 tipos**: RETIRO, REINGRESO, RECONTRATACION.
- **4 CHECK constraints** que validan coherencia (ej. RETIRO requiere `estado_anterior<>'retirado' AND estado_nuevo='retirado'`; RECONTRATACION requiere `contratacion_id IS NOT NULL`; REINGRESO/RECONTRATACION requieren `fecha_referencia IS NOT NULL`).
- **4 índices** para performance.
- **2 FKs**: empresa_id y trabajador_id.

### Tests E2E (153 asserts distribuidos en 3 archivos)

- `test-gestion-humana-bridge-e2e.js` (137 asserts): 11 escenarios base (T1-T11) + 8 de protección (T12-T19).
- `test-gestion-humana-bridge-import.js` (67 asserts): 11 escenarios base + 6 de política estricta (T20-T25).
- `test-gestion-humana-bridge-schema.js` (154 asserts): schema, índices, FKs, conteo de handlers.

### Flujo de UI correcto (lo que debe hacer el user)

1. **Retirar**: Base Personal → Trabajador → botón "Retirar trabajador" (visible si `estado=activo`) → confirma → backend ejecuta `gh:cambiar-estado` → se genera evento RETIRO.
2. **Reingresar**: Base Personal → Trabajador → botón "Reingresar" (visible si `estado=retirado`) → confirma → backend ejecuta `gh:cambiar-estado` → se genera evento REINGRESO.
3. **Recontratar**: Gestión Humana → Contrataciones → Nueva contratación → al escribir la cédula de un bp retirado aparece el modal "¿Recontratar?" con 4 opciones (Reingresar / Recontratar / Corregir cédula / Cancelar).

### BP de evidencia histórico

`bp-mthobzc0-uvkk` (CC 9999999999) es el bp que el user creó durante la prueba manual que descubrió el bypass. Tiene `estado=retirado, activo=1, fecha_retiro=NULL` y NO tiene evento RETIRO. Es la **evidencia** de que el bypass existió y fue cerrado. **No tocarlo a menos que se decida explícitamente restaurarlo u ocultarlo.**

### Auditoría de regresiones

Antes de cualquier cambio futuro que toque estos handlers, ejecutar:
- `node main/test-gestion-humana-bridge-e2e.js` (debe dar 137 OK)
- `node main/test-gestion-humana-bridge-import.js` (debe dar 67 OK)
- `node main/test-gestion-humana-bridge-schema.js` (debe dar 154 OK)

Si alguno da FAIL, parar y revisar antes de commitear. Los 2 fails preexistentes en `test-gestion-humana-bridge-write-extra.js` y `test-gestion-humana-bridge-newtables.js` son histórico y NO son de este módulo.

### Lo que NO se debe hacer

- ❌ NO agregar `estado`, `fechaRetiro` o `fechaIngreso` al whitelist de `_handlerUpdatePersonal` (re-abre el bypass)
- ❌ NO permitir `data.fechaRetiro` en `_handlerCreatePersonal`
- ❌ NO quitar los `CASE WHEN` de `gh:import-personal` (re-abre el bypass en import)
- ❌ NO quitar el filtro `PROTECTED_FIELDS` de `_saveDetailEdit` en el frontend
- ❌ NO restaurar `_openEditModal` (código muerto, pero si alguien lo reactiva sin filtro, es un bypass)
- ❌ NO borrar la tabla `gh_eventos_personal` ni los CHECK constraints
- ❌ NO usar `gh:update-personal` para transiciones de ciclo (es el bypass original)

---

## 🆕 Cascada CSS: fugas globales y blindaje por módulo (📦746, 2026-09-16)

### El problema

Los CSS de varios módulos se cargan **globalmente** en `index.html` y declaran clases **sin scope** (`.kair-card`, `.kair-kpi`, `.kair-chart`, `.kair-legend`, etc.). Esas reglas filtran propiedades a módulos que no las definen, y **ganan la cascada** porque el módulo destino **no declara esas propiedades** (la especificidad solo compite por propiedad declarada, no por regla completa).

Síntoma real en Inducciones: las KPI cards salían **centradas** (en vez de alineadas a la izquierda), las barras de progreso **invisibles** (el contenedor se encogía a ancho 0), y los gráficos **cortados** (labels del eje X recortados + SVG estirado).

### Fuentes que fugan (cargadas en `index.html` head)

| Archivo | Clases globales | Propiedades que fugan |
|---------|-----------------|----------------------|
| `shared/kair-components.css` | `.kair-card`, `.kair-chart`, `.kair-chart svg`, `.kair-legend` | `height:clamp(130px,13vw,170px)`, `position:absolute;inset:0`, `padding`, `border-bottom`, `background` |
| `modules/verificacion/revision-alta-direccion/revision-alta-direccion.css` | `.kair-kpi*`, `.kair-card*`, `.kair-tabs`, `.kair-toolbar` | `align-items:center`, `white-space:nowrap`, `overflow:hidden`, `padding`, `border-bottom`, `flex-wrap` |
| `modules/gestion-peligros/inspecciones/inspeccion.css` | `.kair-card`, `.kair-card__body`, `.kair-select` | `padding`, `width:100%` |
| `frecuencia/severidad-accidentalidad.css` (cargados dinámicamente por `renderer.js`) | `.kair-kpi`, `.kair-card` | `align-items:center`, `text-align:center`, `margin-bottom` |

### Cómo diagnosticar una fuga

```bash
# 1. ¿Quién define la clase SIN scope?
rg -n "^\.kair-card[ ,{]" --glob "*.css" | Where-Object { $_ -notmatch "inducciones" }
# 2. ¿Qué CSS se carga siempre?
rg -n "\.css" index.html
# 3. ¿El módulo realmente usa la clase que voy a tocar?
rg -n "<clase>" modules/<ruta>/ -g "*.js" -g "*.html"
```

### Fix aplicado (patrón de blindaje)

1. **Blindaje en el módulo destino** (`modules/recursos/inducciones/inducciones-view.css`, bloque `BLINDAJE anti-fugas` al final): declarar **explícitamente** las propiedades que fugan, para que ganen por especificidad (2 clases vs 1). Cubre `overflow`, `margin-bottom`, `padding`, `border-bottom`, `flex-wrap`, `height`, `position`, `inset`, `align-items`, `text-align`, `white-space`.
2. **Limpieza de dead code** en `revision-alta-direccion.css`: el módulo usa **solo** `.kair-rad-*`; se eliminaron las reglas globales `.kair-kpi*` y `.kair-card*` (verificado con `rg` que ningún JS/HTML del módulo las usa y que otros módulos tienen las suyas propias).

### Reglas para futuros módulos

- **Siempre** scopear las clases nuevas bajo el contenedor del módulo (`.inducciones-container`, `.kair-rad-*`, etc.).
- **Nunca** declarar `.kair-card`, `.kair-kpi`, `.kair-chart`, `.kair-legend`, `.kair-tabs`, `.kair-toolbar` sin scope — son nombres genéricos compartidos.
- Si un módulo sufre un desajuste visual inexplicable (centrados, recortes, alturas fijas, padding doble), **sospechar primero de una fuga global** y aplicar el patrón de blindaje.
- Al eliminar reglas "muertas", verificar con `rg` que el módulo no las use **y** que las clases estén cubiertas en `shared/` o en el CSS propio de cada módulo que las use.

### Cache-bust Inducciones

Token actual: `INDUCCIONES-20260915-v21-chart-scope-fix`. Bumpear en 4 lugares:
- `modules/recursos/inducciones/inducciones-view.html` (línea 1, `<link>`)
- `modules/recursos/inducciones/inducciones-logic.js` (`INDUC_TOKEN`)
- `index.html` (2 `<script>` tags)
- `main/test-inducciones-premium-v2.js` (3 checks)

Test: `node main/test-inducciones-premium-v2.js` → debe dar **87 OK**.

---

## 🆕 Bandeja Integrada · Sincronización con Gmail (📦747-748, 2026-09-16)

### Modelo de tokens (DOS conceptos, no confundir)

| Concepto | Significado | Dónde vive | Se usa para |
|----------|-------------|-----------|-------------|
| `connected` | Hay cuenta vinculada (tokens guardados) | `config.json` → `googleOAuth` | Mostrar el **cache real** de correos (no mocks) |
| `tokenValid` | Los tokens funcionan AHORA (refresh OK) | `config.json` → `googleOAuth` | Permitir **sincronizar** |
| `needsReauth` | Hay cuenta pero los tokens ya no sirven | derivado (`connected && !tokenValid`) | Mostrar "Sesión expirada · Reconectar" |

**Regla de oro**: `state.gmailConnected` = "hay cuenta" (carga el cache). `state.gmailTokenValid` = "puedo sincronizar". **NUNCA** usar `connected` para decidir si sincronizar, ni `tokenValid` para decidir si mostrar el cache (si no, se ven correos demo de `renderer/bandeja-integrada/data.js`).

**Fuente de verdad de tokens**: `config.json` → `googleOAuth` (vía `shared/google-tokens.js`). La tabla `email_connections` (SQLite) guarda SOLO metadata (`id`, `email`, `provider`) — `saveConnection()` siempre escribe `access_token: null, refresh_token: null`. No buscar tokens ahí.

### Gmail API — Rate limiter (cuello de botella real)

`shared/google-gmail.js` tiene un **token bucket global** (`GmailRateLimiter`):
- **40 req/min** (era 20). Gmail permite 250 units/user/min; `messages.get` cuesta 5 units → 50/min es el tope seguro.
- **El sync pide 1 request por mensaje** (detalle `format:'full'`), así que el tiempo ≈ `N correos / 40` minutos.
- **`email-sync.js` usa `maxTotalResults: 25`** (era 500 → ~25 min, parecía colgado; luego 50). 25 alcanza para poblar la lista.
- **Nunca** subir `maxTotalResults` sin subir el rate limiter proporcionalmente.

### Anti-cuelgue (timeouts obligatorios)

| Capa | Timeout | Archivo |
|------|---------|---------|
| Refresh de token (red a Google) | 10s (`_withTimeout`) | `shared/google-auth.js` |
| Callback server OAuth | 5 min + `server.on('error')` para EADDRINUSE | `shared/google-auth.js` |
| IPC `email-cache:sync-inbox` | 120s (`Promise.race`) | `main.js` |
| Guard anti-apilamiento | `_syncInFlight` | `renderer/bandeja-integrada/app.js` |

**Por qué**: sin el guard, el auto-refresh (cada 1 min) lanzaba un sync nuevo cada minuto y se apilaban en la cola del rate limiter → **ninguno terminaba**. Sin el timeout del IPC, la UI quedaba en skeleton infinito.

### Logs del proceso principal

Los `console.log` de `main/` van a la **terminal** (no a DevTools). Para verlos en el renderer, `email-sync.js` acepta `options.log` y `main.js` le pasa `sendLog`. Los `[email-sync] syncInbox inicio/listInbox OK/FIN` ahora aparecen en DevTools con tiempos.

### Diagnóstico rápido

```bash
# Estado de tokens (sin exponer secretos)
node -e 'const os=require("os"),p=require("path"),f=require("fs");const c=JSON.parse(f.readFileSync(p.join(os.homedir(),"AppData","Roaming","sgsst-electron-app","config.json"),"utf8"));const t=c.googleOAuth||{};console.log("access:",!!t.access_token,"refresh:",!!t.refresh_token,"expiry:",t.expiry_date,"now:",Date.now());'
# Cache de correos
node -e 'const os=require("os"),p=require("path"),{DatabaseSync}=require("node:sqlite");const db=new DatabaseSync(p.join(os.homedir(),"AppData","Roaming","sgsst-electron-app","kair.db"),{readOnly:true});console.log(db.prepare("SELECT folder, COUNT(*) c FROM email_threads GROUP BY folder").all());'
```

Nota: `better-sqlite3` está compilado para Electron → usar `node:sqlite` (nativo) para inspeccionar la DB con Node plano.

---

## 🆕 Dashboard Principal · Premium v2 (📦748, 2026-09-16)

El **Panel de Control** (dashboard de empresa, `renderDashboard` en `renderer.js`) fue migrado al estilo **premium v2** (mismo sistema que los homes de módulo y que la referencia `kair-dashboard.html`).

### Estructura (de arriba hacia abajo)
```
.kair-dashboard            ← contenedor (scroll interno, tokens premium)
  .kair-page
    nav > .kair-breadcrumb
    .kair-topbar           ← .kair-module-id (icono + "Panel de Control") + acciones (chip empresa + Actualizar)
    .kair-hero             ← Estado General: #hero-title, #hero-sub, #hero-pct, #hero-meter
    .kair-grid-kpis #kpi-slot      ← 4 .kair-kpi (render JS)
    .kair-card .kair-mod-grid #mod-grid   ← 7 .kair-mod (render JS)
    .kair-card #sec-radar
      #tasks-panel-header  ← título + .kair-seg #seg-filtros (Todos/Críticos/Hoy)
      .kair-task-grid #tasks-container   ← .kair-task (render JS)
      .kair-empty #task-empty
  .kair-toasts #dash-toasts
```

### CSS
Todo el CSS vive en **`styles.css`** (bloque `📦748 · DASHBOARD PREMIUM v2`), **scoped bajo `.kair-dashboard`** para no filtrar al resto de la app (lección de la cascada CSS). Los tokens `--kair-*` vienen de `shared/kair-design-tokens.css`.

**Regla**: nunca agregar reglas `.kair-hero`, `.kair-kpi`, `.kair-mod`, `.kair-task`, `.kair-seg` sin el prefijo `.kair-dashboard`.

### Funciones JS (top-level en `renderer.js`)
| Función | Rol |
|---------|-----|
| `loadDashboardData()` | Llama a `getDashboardSummary` y orquesta los renders |
| `renderDashHero(data)` | Título humanizado + `%` frentes críticos + meter |
| `renderDashKpis(data)` | 4 `.kair-kpi` desde `data.kpis` |
| `renderDashModules(data)` | 7 `.kair-mod` con chips de estado (IDs `module-badge-<name>`) |
| `renderTasks(tasks)` | `.kair-task` con chip de severidad (`critical`→rojo, `warning`/`warn`→ámbar, resto→azul) |
| `updateModuleBadges(status, rec, salud)` | Pinta los chips de cada `.kair-mod` |
| `updateModuleSelection(name)` | Marca `.kair-mod.is-active` |
| `updateFilterUI(moduleName, count)` | Conteos del `.kair-seg` + subtítulo del radar |
| `filterDashboardTasksByModule(name)` | Filtra tareas por módulo (click en `.kair-mod`) |
| `navigateToModule(mod, sub)` | Navega al submódulo (click en `.kair-task`) |

### Datos reales (`getDashboardSummary`)
```js
{ success, data: {
    kpis: { accidents_year, pric_active, overdue_docs, compliance,
            recursos_alerts, gestion_salud_alerts },
    tasks: [{ priority, module, submodule, title, desc, icon }],
    module_status: { recursos: 'ok'|'warning'|'danger', ... }
} }
```

### Cache-bust
En `index.html`:
- `styles.css?v=20260916-dashboard-premium`
- `renderer.js?v=20260916-dashboard-premium` (⚠️ `renderer.js` **no tenía token** antes — se le agregó)

### Lección: parchear funciones grandes con un script Node
Para reescribir funciones de >50 líneas en `renderer.js` (7000+ líneas), usar un script Node con un helper `replaceFunction(src, signature, newCode)` que:
1. Busca la firma exacta (`function foo(...)`).
2. Encuentra la `{` de apertura.
3. Cuenta llaves hasta el cierre balanceado.
4. Reemplaza el bloque completo.

Validar con `new Function(src)` ANTES de escribir, y luego `node --check renderer.js`. Fue más confiable que el edit tool para bloques de ~80 líneas.

---

## 🆕 Playbook · Migrar un submódulo al estilo premium (📦749, 2026-09-16)

### Sistema oficial: `shared/kair-premium.css` (scoped bajo `.kair-premium`)

El **"dialecto premium"** (hero, KPI cards, chips, tasks, modules, segmented) vive en **`shared/kair-premium.css`** y está scopado bajo `.kair-premium`. Para usarlo, agregar `class="kair-premium"` al wrapper raíz del módulo/submódulo.

```html
<div class="inducciones-container kair-premium">   <!-- o .kair-dashboard kair-premium -->
```

El archivo se carga globalmente en `index.html` (junto a `kair-design-tokens.css` y `kair-components.css`).

### Componentes disponibles

| Clase | Qué es |
|-------|--------|
| `.kair-page` | contenedor de página (padding + ancho fluido) |
| `.kair-breadcrumb` | ruta de navegación |
| `.kair-topbar` + `.kair-module-id` (`__icon/__title/__desc`) | encabezado del módulo |
| `.kair-chip` (+ `--soft-green/amber/red/slate/blue`, `--sm`) | pills de estado |
| `.kair-btn` (+ `--primary/outline/ghost`) | botones |
| `.kair-seg` (+ `__n`) | control segmentado (filtros) |
| `.kair-grid-kpis` | grid de 4 columnas para KPI |
| `.kair-hero` (+ `__label/__row/__title/__sub/__cta/__aside/__pct/__pct-label/__meter/__meter-fill`) | panel navy "Estado General" |
| `.kair-kpi` (+ `__top/__label/__icon/__value/__sub/__bar/__fill`) | tarjeta de KPI |
| `.kair-card` (+ `__head/__title/__sub`, `--plain`) | tarjeta de sección |
| `.kair-mod-grid` + `.kair-mod` (+ `__top/__icon/__name/__sub`, `.is-active`) | grid de módulos |
| `.kair-task-grid` + `.kair-task` (+ `--critical/--warn/--info`, `__top/__code/__title/__bottom/__icon/__desc/__arrow`) | grid de pendientes |
| `.kair-empty` (+ `__icon/__title/__sub`) | estado vacío |
| `.kair-toasts` + `.kair-toast` (+ `--success/warn/info/error`) | notificaciones |
| `.kair-boot` + `.kair-skel` | skeleton de arranque |

### Checklist de migración

1. **Agregar `kair-premium`** al wrapper raíz (junto a la clase del módulo).
2. **Estructura**: breadcrumb → topbar → hero → `.kair-grid-kpis` → `.kair-card` (módulos) → `.kair-card` (tareas) → toasts.
3. **Datos**: mantener el IPC/selector existente; solo cambia el render.
4. **Scopear** cualquier clase NUEVA específica del módulo bajo el wrapper (nunca global).
5. **Eliminar** las copias locales de las clases del dialecto (`.kair-hero`, `.kair-kpi`, `.kair-chip`, `.kair-task`, `.kair-mod`, `.kair-seg`) — ya están en el shared.
6. **Cache-bust**: bumpear `?v=` de `styles.css`, `renderer.js` (si aplica) y el `<script>` del módulo.
7. **Verificar**: visual en maximizada y ventana + smoke tests.

### Reglas de oro

- **Nunca** declarar `.kair-hero`, `.kair-kpi`, `.kair-chip`, `.kair-task`, `.kair-mod`, `.kair-seg` sin el prefijo `.kair-premium` (o el scope del módulo).
- **Nunca** usar `margin: 0 auto` en headers que comparten container con cards.
- Para scroll interno: `flex: 1` + `min-height: 0` en TODOS los niveles de la cadena.
- Si un módulo necesita un ajuste puntual, declararlo bajo su propio scope (`.mi-modulo .kair-kpi{...}`) — gana por orden de carga.

### Estado de migración

| Módulo | Usa `kair-premium` | Notas |
|--------|--------------------|-------|
| Dashboard principal | ✅ (📦749) | Piloto — referencia de implementación |
| Configuración | ✅ (📦751) | No usa `kair-premium`: capa propia scoped `.kair-config` + Header System v2 |
| Bandeja Integrada | ✅ (📦752) | No usa `kair-premium`: capa propia `premium.css` (tokens + remapeo legacy) + topbar/segmentado propios. Es un iframe con scope aislado |
| Perfil de Cargo y Profesiograma | ✅ (📦772) | No usa `kair-premium`: tokens premium en su `:root` propio (iframe aislado) + Header System v2 |
| Reportes de Accidentes (FURAT) | ✅ (📦773) | No usa `kair-premium`: tokens premium en su `:root` propio (iframe aislado) + Header System v2 |
| Gestión del Cambio (2.11.1) | ✅ (📦774) | No usa `kair-premium`: capa propia scoped `.gdc-scope` + tokens `--gdc-*` + Header System v2 (marcado EMBEBIDO en el `.js`, no iframe) |
| Restricciones y Remisiones (3.1.6) | ✅ (📦775-779) | No usa `kair-premium`: portal scoped `.rm-portal-scope` + Enviar (flujo completo de 3 pasos, `.remenv-scope`), Control (`.remctl-scope`) y Estadísticas (`.remstat-scope`) embebidos + visor con tokens remapeados; paleta alineada a `kair-design-tokens` |
| Investigación de Accidentes (3.2.2) | ✅ (📦780) | No usa `kair-premium`: portal scoped `.inv-portal-scope` + Realizar/Ver con Header System v2 y tokens `--inv-*` remapeados; se quitó el `<link>` global que filtraba `html`/`body`/`.k-section-card` |
| Registro y Análisis Estadístico (3.2.3) | ✅ (📦783) | No usa `kair-premium`: tokens `--k-*` remapeados a la canónica + Header System v2; se quitaron `.k-section-card`/`.header-back-btn` (clases GLOBALES) y se scopearon las reglas `.k-*`; gráficos Chart.js theme-aware |
| Frecuencia de la Accidentalidad (3.3.1) | ✅ (📦784) | No usa `kair-premium`: tokens propios `--freq-*` scoped + Header System v2; se quitó el `:root` + `*` + `body` GLOBALES y se scopearon 139 selectores; el gráfico SVG lee la paleta con `tok()` |
| Severidad de la Accidentalidad (3.3.2) | ✅ (📦785) | No usa `kair-premium`: tokens propios `--sev-*` scoped + Header System v2; se quitó el `:root` + `*` + `body` GLOBALES; 125 selectores scopados; modo oscuro en los 2 atributos (`dark` + `dark-legacy` con `[data-theme^="dark"]`); tabla blindada (`min-width:0 !important` + `table-layout:fixed`) con 7 anchos fijos que suman 100%; gráfico SVG leyendo la paleta con `tok()`/`palette()`; wrapper `.sev-duo` en paralelo (gráfico+tabla) en maximizada; meses grid 6/12; código muerto eliminado |
| Índice de Mortalidad (3.3.3) | ✅ (📦786) | No usa `kair-premium`: tokens propios `--mort-*` scoped + Header System v2; se quitó el `:root` + `*` + `body` GLOBALES; selectores scopados; modo oscuro en los 2 atributos (`dark` + `dark-legacy` con `[data-theme^="dark"]`); tabla blindada (`min-width:0 !important` + `table-layout:fixed`) con 7 anchos fijos que suman 100%; Chart.js theme-aware con gradientes dark/light; `tok()`/`palette()` en getStatusBadge/getValueColor/renderizar/renderizarTabla; resize handler con cleanup (`window.__mortResizeHandler`); código muerto eliminado (`escapeHtml`); renderer.js parcheado con TOKEN + cache-bust en 2 niveles + sanitizar `<link>` CDN; gráfico y tabla en paralelo en maximizada (`.mort-duo`, `📦786-fix`); test 46/46 |
| Prevalencia de Enfermedad Laboral (3.3.4) | ✅ (📦787) | No usa `kair-premium`: tokens propios `--prev-*` scoped + Header System v2; se quitó el `:root` + `*` + `body` GLOBALES; modo oscuro en los 2 atributos (`dark` + `dark-legacy` con `[data-theme^="dark"]`); tabla blindada (`min-width:0 !important` + `table-layout:fixed`) con 6 anchos fijos que suman 100% (12/12/16/28/10/22); Chart.js theme-aware con gradientes dark/light y `Chart.defaults`; `tok()`/`palette()` en getStatusBadge/getValueColor/renderizar/renderizarTabla/renderFallbackChart; resize handler con cleanup (`window.__prevResizeHandler`); código muerto eliminado (`escapeHtml` + 15 `console.log`); renderer.js parcheado con TOKEN + cache-bust en 2 niveles + sanitizar `<link>` CDN; gráfico y tabla en paralelo en maximizada (`.prev-duo`); test 46/46 |
| Incidencia de Enfermedad Laboral (3.3.5) | ✅ (📦788) | Módulo hermano de Prevalencia (3.3.4) — generado desde sus archivos ya migrados con renombres controlados (`prevalencia`→`incidencia`, `casosEL`→`casosNuevosEL` **case-sensitive** para no romper `totalCasosEL`, `--prev-`→`--inc-`, `__prevResizeHandler`→`__incResizeHandler`) y conservando las etiquetas propias (CASOS NUEVOS EL, Meta <5 Coordinador SST, párrafo extra de metodología, botón Reintentar). Tokens `--inc-*` scoped + Header System v2 + dark en los 2 atributos; tabla blindada con 6 anchos fijos 12/12/16/28/10/22; Chart.js theme-aware; `tok()`/`palette()`; resize con cleanup; gráfico y tabla en paralelo (`.inc-duo`); se agregaron los estilos del error (`kair-error-icon`/`kair-error-msg`/`kair-retry-btn`) que el HTML usaba y la hoja vieja no definía; código muerto eliminado; renderer.js con TOKEN + cache-bust en 2 niveles + sanitizar `<link>` CDN; test 46/46 |
| Medición del Ausentismo (3.3.6) | ✅ (📦789) | **Fase 1** (home + blindaje) + **vistas**: home premium v2 (Header v2 + SVG + dark + theme sync); blindaje de los **7 bloques `<style>`** inyectados en el `<head>` global (~684 líneas) scopados bajo `.aus-scope` (+ `:root --sp-*` → `.aus-scope`, selectores de etiqueta scopados, `@keyframes` genéricos renombrados a `aus*`); `.aus-scope` en el contenedor + los **6 nodos montados en `<body>`**; **Registrar** y **Ver Ausentismo** reescritas con clases premium + SVG (0 colores inline, 0 FA); **Seguimiento de Incapacidades** (KPIs, filtros, tabla, avatar, progress, badges) + **Estadísticas** (tokens `--aus-*` en los bloques `.k-*`/`.es-*` → dark automático); **Consulta de Trabajadores** (tokens canónicos + Header v2 + 7 SVG) y **Generar Informe** (**CDN → local** Google Fonts/FA + tokens + Header v2); **2 inyecciones de Font Awesome CDN eliminadas**; fix del panel de seguimiento (`.aus-scope.seguimiento-backdrop` — forma **self**); tests 110/110 |
| Seguimiento de Gestación (3.3.6) | ⏳ (📦790) | Home migrado: tokens `--v3-*` remapeados a la canónica + dark (2 atributos) + Header System v2 (transparente, título Manrope 800 20px, icon chip 44×44) + contraste del botón primario en oscuro. Quedan **antesala**, **mensual** y **reportes** (mismo patrón) |
| Inducciones | ⏳ | Dialecto propio en `inducciones-view.css` (scoped `.inducciones-container`) |
| Plan de Trabajo | ⏳ | Dialecto propio en `plan-view.html` |
| Otros submódulos | ⏳ | Migrar con este playbook |

### Historial

- **📦748**: Dashboard premium v2 (CSS scoped `.kair-dashboard` en `styles.css`).
- **📦749**: Extracción del dialecto a `shared/kair-premium.css` scoped `.kair-premium`; dashboard migrado como piloto; `styles.css` vuelve a su rol de estilos legacy.
- **📦751**: Configuración del Sistema migrada a premium v2 (capa scoped `.kair-config` + remapeo de tokens legacy; Header System v2 con breadcrumb + icono/título + tabs con subrayado; soporte dark/dark-legacy).
- **📦772**: Perfil de Cargo y Profesiograma (3.1.3) migrado a premium v2 (tokens premium en su `:root`; Header System v2 con breadcrumb + icono/título; tabs con subrayado azul estilo Evaluación Inicial; modo oscuro en los 2 atributos; `destroy()` + cache-bust).
- **📦773**: Reportes de Accidentes (3.2.1 · FURAT) migrado a premium v2 (tokens `--furat-*` remapeados en su `:root`; Header System v2; tabs con subrayado; modo oscuro cubriendo `dark` y `dark-legacy` con `[data-theme^="dark"]`; reset scoped; cache-bust triple).
- **📦774**: Gestión del Cambio (2.11.1) migrado a premium v2: de 6 archivos (logic + 2 css + html + viewer + index) a UN solo par CSS+JS con el marcado embebido; capa scoped `.gdc-scope` + tokens `--gdc-*`; overlays al `<body>` envueltos en `.gdc-scope`; vigía `MutationObserver` + `destroy()`; se conservó exacto el contrato de datos Excel (4 IPC) y la máquina de estados.
- **📦775**: Restricciones y Remisiones (3.1.6) — segunda pasada premium: portal del módulo migrado a premium y **scoped** (`.rm-portal-scope`, se corrigió la fuga de `:root`/`*` al inyectarse con `innerHTML`), visor (`remisiones-view.css`) e informe (`generar-informe-remision.css`) con tokens remapeados a premium + dark en el informe, header del informe alineado con el cuerpo, limpieza de 9 archivos muertos y ~600 líneas huérfanas; el test subió a 62 checks.
- **📦776**: Restricciones y Remisiones (3.1.6) — el flujo de **Enviar Remisión** ahora es UNO SOLO: los 3 pasos (Cargar PDF → Generar informe oficial → Enviar a la EPS) viven dentro del componente premium `enviar-remision-v2` (antes el paso 1 saltaba a la página vieja `generar-informe-remision.html` y a un modal de envío aparte, con otro diseño). El paso 3 trae **vista previa del informe** (nombre del documento + resumen + botón "Ver informe" que abre el visor) y un botón **Cancelar** con confirmación que reinicia el flujo sin borrar nada. Se borraron la página del informe, el modal de envío, `env-modal.css` y ~390 líneas más del `logic.js` (métodos + handlers del bridge viejo).
- **📦777**: Restricciones y Remisiones (3.1.6) — **alineación de la paleta** de `enviar-remision-v2.css` y `control-remisiones-v2.css` a la canónica de la app (`shared/kair-design-tokens.css`, la de Recursos / Gestión Integral). Traían una paleta propia (`#2456d6` azul, `#eef1f7` fondo, `#e3e8f2` borde, `Segoe UI`, radio 14px) que se veía distinta; ahora usan `#2057b8` / `#fbfcfb` / `#e8ebee` / `DM Sans` + `Manrope` / radio 20px, y el modo oscuro `#0f172a` / `#1a2334` / `#6ea8fe`.
- **📦778**: Control de Remisiones (3.1.6) — el Excel real `GI-FO-012` trae **encabezados repetidos y filas vacías** en el medio; el backend las contaba como registros (18 en vez de 8). Ahora `get-control-remisiones-data` **descarta filas vacías y encabezados repetidos** y devuelve **`rowNumbers`** (nº de fila real) para que el guardado por celda A1 no se desalinee.
- **📦779**: Estadísticas de Remisiones (3.1.6) — nueva sección que **deriva métricas del Control** (KPIs + 6 gráficos: sexo, tipo de evaluación, rango de edad, concepto médico, top cargos y estado civil), con normalización de valores inconsistentes del Excel y el mismo dialecto premium v2.
- **📦780**: Investigación de Accidentes e Incidentes (3.2.2) — las 3 vistas (portal + Realizar + Ver) al premium v2; se quitó el `<link>` **global** que filtraba `html`/`body`/`.k-section-card` a toda la app; Header System v2, tokens canónicos, `[data-theme^="dark"]` y cache-bust de los iframes.
- **📦781**: Investigación de Accidentes (3.2.2) — "Ver Investigaciones" ahora aprovecha **todo el ancho** en maximizada (`.inv-body` sin `max-width:1200px` centrado); buscador con tope (`clamp`) y toggle de vista al extremo derecho.
- **📦782**: Investigación de Accidentes (3.2.2) — la vista de LISTA pasa a **2 columnas** en maximizada (`@media (min-width:1360px)`, `repeat(2, minmax(0,1fr))`); la cuadrícula no se toca; el estado vacío y el esqueleto llevan `grid-column: 1 / -1`.
- **📦783**: Registro y Análisis Estadístico (3.2.3) migrado a premium v2 — Header System v2, tokens `--k-*` remapeados a la canónica, scoping total del CSS (se quitaron las clases GLOBALES `.k-section-card`/`.header-back-btn`), modo oscuro en los DOS atributos, chips con `color-mix` y los 9 gráficos Chart.js con colores de tema.
- **📦784**: Frecuencia de la Accidentalidad (3.3.1) migrada a premium v2 — Header System v2, tokens propios `--freq-*` scoped (se quitó el `:root` + `*` + `body` GLOBALES que pisaban tokens y márgenes de TODA la app), 139 selectores scopados, modo oscuro en los DOS atributos y el gráfico SVG leyendo la paleta con `tok()`.
- **📦785**: Severidad de la Accidentalidad (3.3.2) migrada a premium v2 — Header System v2, tokens propios `--sev-*` scoped (se quitó el `:root` + `*` + `body` GLOBALES que pisaban tokens y márgenes de TODA la app), 125 selectores scopados, modo oscuro en los DOS atributos (`dark` + `dark-legacy` con `[data-theme^="dark"]`), tabla con blindaje (`min-width:0 !important` + `table-layout:fixed`) y 7 anchos fijos que suman 100%, gráfico SVG leyendo la paleta con `tok()`/`palette()`, wrapper `.sev-duo` en paralelo (gráfico+tabla) en maximizada, meses grid 6/12, código muerto eliminado (`buildGridLines`/`buildChartPoints`/`escapeHtml`), renderer.js parcheado con TOKEN + cache-bust en 2 niveles + sanitizar `<link>` CDN, test 21/21, EOL normalizado a LF.
- **📦786**: Índice de Mortalidad (3.3.3) migrada a premium v2 — Header System v2, tokens propios `--mort-*` scoped (se quitó el `:root` + `*` + `body` GLOBALES que pisaban tokens y márgenes de TODA la app), selectores scopados, modo oscuro en los DOS atributos (`dark` + `dark-legacy` con `[data-theme^="dark"]`), tabla con blindaje (`min-width:0 !important` + `table-layout:fixed`) y 7 anchos fijos que suman 100%, Chart.js theme-aware con gradientes dark/light y Chart.defaults, `tok()`/`palette()` en getStatusBadge/getValueColor/renderizar/renderizarTabla, resize handler con cleanup (`window.__mortResizeHandler`), código muerto eliminado (`escapeHtml`), renderer.js parcheado con TOKEN `MORT-20260919-v1-premium` + cache-bust en 2 niveles + sanitizar `<link>` CDN, test 38/38, EOL normalizado a LF.
- **📦786-fix**: Índice de Mortalidad (3.3.3) — el gráfico y la tabla ahora van **en paralelo en maximizada**, igual que Frecuencia (3.3.1) y Severidad (3.3.2). Se envolvieron `#chartSection` + `#tableSection` en un `<div class="mort-duo">` con el mismo tratamiento que `.freq-duo`/`.sev-duo`: `grid-template-columns: 1fr` por defecto y `minmax(0,1fr) minmax(0,1fr)` en `@media (min-width:1360px)`, con las 2 tarjetas `display:flex; flex-direction:column` para que se estiren al MISMO alto (el de la tabla) y el `.kair-chart-container` `flex:1; min-height:0` para que el canvas (Chart.js `responsive:true` + `maintainAspectRatio:false`) ocupe el espacio libre sin deformarse. 🚨 **La trampa de este módulo (que NO tienen Frecuencia ni Severidad)**: el JS hacía `chartSection.style.display = 'block'` / `tableSection.style.display = 'block'` con **estilo EN LÍNEA**, y el estilo en línea le gana al CSS → el `display:flex` de la media query nunca aplicaba. Fix: el JS ahora pone `display = ''` (quita la propiedad del estilo en línea; las `<section>` vuelven a su `block` por defecto) y el CSS decide el display. **Regla**: si un módulo fija `display` con `style.display = '...'`, cualquier layout que necesite otro `display` (flex/grid) tiene que quitarse esa propiedad primero, o el CSS pierde. Cache-bust en 2 niveles (`MORT-20260919-v2-duo` + `renderer.js?v=20260919-mortalidad-duo`), test 46/46 (8 checks nuevos: wrapper del duo, grid 1/2 columnas, tarjetas flex, chart container flex:1 y que el JS no fije display en línea). **Medido con arnés real de Electron**: maximizada (inner 1904) → `cols 690px 690px`, chart y table 580×580, lado a lado, sin desborde; ventana normal (inner 1184) → `cols 1113px` (1 columna), apiladas, sin desborde.
- **📦787**: Prevalencia de Enfermedad Laboral (3.3.4) migrada a premium v2 — Header System v2 (breadcrumb + icon chip + título Manrope 800 + subtítulo + acciones con SVG inline), tokens propios `--prev-*` scoped (se quitó el `:root` + `*` + `body` GLOBALES que pisaban tokens y márgenes de TODA la app), modo oscuro en los DOS atributos (`dark` + `dark-legacy` con `[data-theme^="dark"]`), tabla blindada (`min-width:0 !important` + `max-width:100% !important` + `table-layout:fixed`) con **6 anchos fijos que suman 100%** (Mes 12 / Casos EL 12 / Trabajadores 16 / Prevalencia 28 / Meta 10 / Estado 22), Chart.js theme-aware (gradientes, los 4 plugins metaZone/barLabels/promedioLine/metaLine, `Chart.defaults` y tooltip/ejes leyendo la paleta con `tok()`/`palette()`), `tok()`/`palette()` en getStatusBadge/getValueColor/renderizar/renderizarTabla/renderFallbackChart, resize handler con cleanup (`window.__prevResizeHandler`, `removeEventListener` del anterior), **gráfico y tabla en paralelo en maximizada** (`.prev-duo` con el mismo patrón que `.freq-duo`/`.sev-duo`/`.mort-duo` y el `display = ''` en el JS para que el estilo en línea no pise el `flex`), iconos en **SVG inline** (se quitó el CDN de Bootstrap Icons y los `<i class="bi ...">` que nunca renderizaban porque el `<link>` del `<head>` se descarta al inyectar solo `doc.body`), código muerto eliminado (`escapeHtml` + 15 `console.log` de ruido, 2 convertidos a `console.error`), renderer.js parcheado con TOKEN `PREV-20260919-v1-premium` + cache-bust en 2 niveles + sanitizar `<link>` CDN, test 46/46, EOL normalizado a LF. **Medido con arnés real de Electron**: ventana normal (inner 1184) → `cols 1113px` (1 columna), apiladas; maximizada (inner 1904) → `cols 690px 690px`, chart y table 604×604, lado a lado, **0 celdas recortadas**, tabla sin desborde; `dark` y `dark-legacy` → idénticos (`#0f172a` / `#1a2334` / `#e8edf5`).
- **📦788**: Incidencia de Enfermedad Laboral (3.3.5) migrada a premium v2. Es **módulo hermano** de Prevalencia (3.3.4): los archivos originales eran **idénticos salvo renombres**, así que el CSS y el JS se **generaron desde los de Prevalencia ya migrados** con renombres controlados (script `_gen-incidencia.js`), y el HTML se escribió a mano para conservar sus etiquetas propias. Renombres: `prevalencia`→`incidencia`, `Prevalencia`→`Incidencia`, `PREVALENCIA`→`INCIDENCIA`, `PREV-`→`INC-`, `prev-`→`inc-`, `__prevResizeHandler`→`__incResizeHandler`, `prevSlideIn`→`incSlideIn`, `Submódulo 3.3.4`→`3.3.5`. 🚨 **La trampa del renombre masivo**: `casosEL`→`casosNuevosEL` tiene que ser **case-sensitive**; un `-replace` de PowerShell (que es case-INsensitive por defecto) convierte también `totalCasosEL` en `totalcasosNuevosEL` y rompe los totales. Con `String.split().join()` de Node (case-sensitive) `totalCasosEL` no se toca (tiene `C` mayúscula). **Regla**: al clonar un módulo hermano por renombre, usar reemplazos case-sensitive y verificar explícitamente que las variables que COMPARTEN substring (`casosEL` vs `totalCasosEL`) sobrevivan. Se conservaron las diferencias reales de Incidencia: KPI "CASOS NUEVOS EL (AÑO)", Meta "<5 (Coordinador SST)", el párrafo extra `<strong>Meta:</strong>` de la metodología, el `<strong>Interpretación</strong>` con "nuevos casos" y la sección de error con icono + mensaje + botón **Reintentar**. Se **agregaron a la hoja** los estilos del error (`.kair-error-icon`, `.kair-error-msg`, `.kair-retry-btn`) que el HTML usaba y la hoja vieja **no definía** (salían sin estilo). Todo lo demás igual que 📦787: tokens `--inc-*` scoped, Header System v2 con SVG inline (se quitó el CDN de Bootstrap Icons), dark en los 2 atributos, tabla blindada con 6 anchos fijos 12/12/16/28/10/22, Chart.js theme-aware (gradientes + 4 plugins + `Chart.defaults`), `tok()`/`palette()` en getStatusBadge/getValueColor/renderizar/renderizarTabla/renderFallbackChart, resize con cleanup, `.inc-duo` en paralelo en maximizada (con el `display = ''` en el JS), código muerto eliminado (`escapeHtml` + 15 `console.log`, 2 a `console.error`), renderer.js con TOKEN `INC-20260919-v1-premium` + cache-bust en 2 niveles + sanitizar `<link>` CDN, test 46/46, EOL normalizado a LF. **Medido con arnés real de Electron**: ventana normal (inner 1184) → `cols 1113px` (1 columna), apiladas; maximizada (inner 1904) → `cols 690px 690px`, chart y table 619×619, lado a lado, **0 celdas recortadas**, tabla sin desborde; `dark` y `dark-legacy` → idénticos (`#0f172a` / `#1a2334` / `#e8edf5`).

- **📦789**: Medición del Ausentismo (3.3.6) migrada a premium v2 en **dos fases**. **Fase 1 (home + blindaje)**: el home (iframe) pasó a Header System v2 + paleta canónica + modo oscuro (2 atributos) + 10 iconos SVG inline (0 Font Awesome) + `initThemeSync()` (pide el tema al padre y escucha `theme-changed`, porque el iframe se crea DESPUÉS de aplicar el tema); y se **blindaron los 7 bloques `<style>`** que el componente inyectaba en el `<head>` GLOBAL (~684 líneas con `:root --sp-*`, 95 clases sin scope y selectores de etiqueta como `textarea`): todos scopados bajo `.aus-scope` con un transformador CSS propio (respeta `@keyframes` verbatim, recurre en `@media`, preserva comentarios), el `:root` movido a `.aus-scope`, y los `@keyframes` genéricos (`fadeIn`/`slideDown`/`slideUp`) renombrados a `ausFadeIn`/`ausSlideDown`/`ausSlideUp`. 🚨 **Trampa del scopeado en nodos montados en `<body>`**: como el backdrop del panel se appendea a `<body>`, se le puso `.aus-scope` A SÍ MISMO — pero los selectores `.aus-scope .seguimiento-backdrop` exigen un **ancestro**, así que NO aplicaban y el panel quedaba en `translateX(100%)` (fuera de pantalla: el usuario lo reportó como "selecciono un trabajador y no lo muestra"). Fix: variante **self** (`.aus-scope.seguimiento-backdrop`), mismo patrón de 📦761. **Vistas**: Registrar y Ver Ausentismo reescritas con clases premium + SVG (0 colores inline, 0 FA, se conservaron los 15 IDs del form y las clases de delegación); Seguimiento de Incapacidades (KPIs, filtros, tabla, avatar, progress, badges, acciones SVG) y Estadísticas (los bloques `.k-*`/`.es-*` remapeados a tokens `--aus-*` → dark automático, radios 20/12, header v2); **2 inyecciones de Font Awesome CDN eliminadas**; `_injectPremiumViewsStyles()` se llama en `render()` (antes solo en 2 vistas → Seguimiento y Estadísticas quedaban sin estilos). **Consulta de Trabajadores** (tokens canónicos + dark + Header v2 + 7 SVG) y **Generar Informe** (**CDN → local** de Google Fonts y Font Awesome → ya funciona offline, + tokens + Header v2 + contraste del botón en oscuro). Se corrigieron además 2 tests que asertaban el token **compartido** de `renderer.js` en `index.html` (Mortalidad y Prevalencia venían fallando desde 📦788). Test 110/110.
- **📦790**: Seguimiento de Gestación (3.3.6) — **home migrado** (primera de 4 vistas): tokens `--v3-*` (azul viejo `#174ea6`, familia de `auditoria-anual.css`) remapeados a la paleta canónica, radios 20/12, fuente DM Sans; bloque `[data-theme^="dark"]` con los 20 tokens oscuros; Header System v2 (transparente, título **Manrope 800 20px**, icono convertido en **chip 44×44** radio 12 blue-soft); override de contraste del botón primario en oscuro. 🚨 **Bug propio detectado con Electron**: la inserción del bloque oscuro **consumió el `}` de cierre del `:root`**, así que el bloque oscuro quedaba anidado dentro de `:root` (CSS inválido) y **no aplicaba** — se detectó midiendo `getComputedStyle` en tema oscuro (el fondo seguía claro). Quedan **antesala**, **mensual** y **reportes** (mismo patrón).
- **📦791**: 2 fixes posteriores a la migración de Ausentismo/Gestión de la Salud. **(1) Consulta de Trabajadores — icono gigante**: al reemplazar los `<i class="fas ...">` por `<svg>` inline, la regla que les daba tamaño seguía apuntando a `i` (`.ct-empty-state i { font-size: 3rem }`), así que el `<svg>` quedaba **sin ancho/alto** y se estiraba a todo el contenedor (mismo patrón de 📦762). Fix: variante `svg` en las 3 reglas que apuntaban a `i` (`.ct-empty-state`, `.ct-search-title`, `.ct-modal-header h3`) con `width/height` explícitos. **Regla**: al cambiar un `<i>` por un `<svg>`, TODA regla que lo dimensionaba por `font-size` necesita su variante `svg` con `width/height`. Se auditó con Electron midiendo TODOS los SVG de las vistas migradas (home, Registrar, Ver, Seguimiento, Estadísticas): ninguno más tenía el problema. **(2) Home de Gestión de la Salud — la gráfica "Indicadores de Salud" mostraba 0.00 en las 4 barras**: `renderChartSalud()` leía `indicadores.frecuencia`/`.severidad`/`.prevalencia`/`.incidencia`, pero `excel-bridge.leerIndicadores()` NO devuelve esos escalares — devuelve `frecuenciaMensual[]`/`severidadMensual[]` (con `indiceFrecuencia`/`indiceSeveridad` por mes) y `config.prevalenciaEL`/`config.incidenciaEL` (sumas anuales). Como los 4 campos eran `undefined`, `Number(undefined) || 0` daba 0.00. Fix: frecuencia y severidad se derivan del **promedio de los meses con valor** (mismo criterio que el KPI del módulo 3.3.1) y prevalencia/incidencia de `config.*`; se sigue aceptando el escalar si el backend lo agrega (retrocompatible). Verificado con Electron (mock con la forma real del backend): 2.00 / 15.00 / 123.45 / 67.89 (antes 0.00). Tests: `tests/gestion-salud/test-home-indicadores.js` (8/8) + `tests/ausentismo/test-premium.js` 121/121 (11 checks nuevos de Consulta/Informe).
- **📦792**: Popover **"Pendientes" (KairAlerts)** modernizado a premium v2. Es el panel flotante que se abre con la campana (`shared/kair-alerts.js`, 698 líneas) y su CSS vivía en **`styles.css`** (bloque de 334 líneas: `.kair-alerts-panel` + `.kair-alerts-popover` + `.kair-alerts-list`/`__item`/`__empty`). **Estado que tenía**: 28 colores hardcodeados (`#174ea6` azul viejo, `#dc3545` rojo viejo, `#111827`, `#1f2937`, `#f8fafc`…), **0 tokens canónicos**, radio 10px, sombras genéricas y sin las fuentes del sistema; sí tenía dark mode (32 reglas `[data-theme=...]`). **Cambios**: tokens locales **`--ka-*`** scoped bajo `.kair-alerts-panel`/`.kair-alerts-popover` mapeados a la paleta canónica + bloque `[data-theme^="dark"]` con los 15 tokens oscuros (cubre `dark` + `dark-legacy`); **60 reemplazos** de colores hardcodeados → `var(--ka-*)`; radios 10px → **20px** (tarjeta) / 12px (controles); sombra del sistema; **DM Sans** (UI) + **Manrope** (título). 🚨 **Trampa del mapeo de color por valor**: `#111827` se usaba para DOS cosas distintas — **fondo** oscuro del header/footer y **color de texto** — así que un único mapeo (`→ var(--ka-ink)`) dejó el header **claro en modo oscuro** (el color del texto como fondo). Se separó: fondo → `var(--ka-soft)`, texto → `var(--ka-ink)`. **Regla**: antes de tokenizar por valor, verificar si ese hex se usa como superficie y como texto (mapear por PROPIEDAD, no solo por valor). **Dato clave**: `shared/kair-design-tokens.css` **NO tiene variantes dark** (los `--kair-*` son solo claros), por eso el popover necesita sus propios tokens + bloque dark. Verificado con Electron en claro/`dark`/`dark-legacy` (fondo `#ffffff`/`#1a2334`, radio 20px, header `#f3f6f6`/`#1e2738`, título Manrope). Cache-bust de `styles.css` → `20260920-alerts-premium`.
---

## 🆕 Especificaciones técnicas SG-SST · ST-01 a ST-08 (📦749, 2026-09-16)

Contrato técnico de los **próximos submódulos** del SG-SST, derivado del PDF
`kair-plan-trabajo-documento-tecnico` (v1.0) y **adaptado a la arquitectura Electron** de este repo.

📄 **`docs/especificaciones-tecnicas-sg-sst-v1.md`**

Contiene: estado actual, arquitectura y patrones obligatorios (tokens, componentes `.kair-*`,
`.kair-screen`, contratos IPC `{ success, data }`, logging `[K+AIRxxx]`, definición de "hecho"),
mapa de módulos y prioridades **P1/P2/P3**, las 8 especificaciones autocontenidas y el roadmap por
fases.

**Prioridades y carpeta real en el repo:**

| ID | Submódulo | Prioridad | Carpeta |
|----|-----------|-----------|---------|
| ST-01 | Plan de Trabajo SG-SST y presupuesto | P1 | `modules/gestion-integral/plan-trabajo` (+ `modules/recursos/presupuesto`) |
| ST-02 | Comités y Actas (COPASST / Convivencia) | P1 | `modules/recursos/copasst`, `modules/recursos/comite-convivencia` |
| ST-03 | Afiliación al SSSI y vigencias | P1 | `modules/gestion-humana/afiliaciones`, `modules/gestion-humana/documentos` |
| ST-04 | Incidentes, accidentes y PRIC | P2 | `modules/gestion-salud/investigacion-accidentes` |
| ST-05 | Matriz IPERC | P2 | `modules/gestion-peligros/identificacion-peligros` |
| ST-06 | Salud ocupacional (ausentismo y exámenes) | P2 | `modules/gestion-salud/ausentismo`, `modules/gestion-salud/evaluaciones-medicas` |
| ST-07 | Emergencias (brigada, simulacros, recursos) | P3 | `modules/gestion-amenazas/plan-prevencion` |
| ST-08 | Verificación y mejoramiento | P3 | `modules/verificacion/auditoria-anual`, `modules/mejoramiento/acciones-preventivas-correctivas` |

**Uso:** al iniciar cualquier submódulo nuevo, leer primero su ST-xx y seguir el ciclo
auditar → especificar → construir/verificar → documentar. Los contratos IPC propuestos
(`getPlanTrabajo`, `getComites`, `getAfiliaciones`, `getEventos`, `getIperc`, `getSaludOcupacional`,
`getEmergencias`, `getVerificacion`) se conectan en la fase correspondiente, con verificación
independiente.

> **Nota:** el PDF original asumía prototipos HTML autocontenidos en `public/`+`download/`. Este repo ya
> es Electron (`modules/` + `renderer.js` + `preload.js`), y el login/splash/selección de empresa ya
> está integrado → la "Fase 0" del PDF se reduce a conectar contratos reales faltantes.

---

## 🆕 Configuración del Sistema · Premium v2 (📦751, 2026-09-16)

La sección **Configuración** (`components/config/config-viewer.html`, ~7.4k líneas) se carga en un
`<iframe>` desde `renderer.js` → `showSettingsPage()`. Fue migrada al estilo **premium v2**.

### Estrategia clave: remapeo de tokens (no reescribir CSS)

El diseño legacy de Configuración era **100% variable-driven**: todo su CSS y sus `style="..."` en
línea usan `var(--primary)`, `var(--bg-card)`, `var(--text-muted)`, `var(--font-heading)`,
`var(--radius*)`, `var(--shadow*)`. Por eso **no se reescribió el CSS existente**: se cargó
`shared/kair-design-tokens.css` y se **remapearon esas variables** a los tokens premium dentro de
`.kair-config` (la clase del `<body>`). Resultado: todo el CSS previo + los estilos en línea adoptan
el look premium sin tocar el markup de las 6 secciones.

```css
.kair-config{
  --primary: var(--kair-blue); --primary-hover:#1a4a9e;
  --bg-general: var(--kair-canvas); --bg-card: var(--kair-card);
  --border-color: var(--kair-line); --border: var(--kair-line);
  --text-main: var(--kair-ink); --text-muted: var(--kair-muted);
  --font-heading: var(--kair-font-display); --font-body: var(--kair-font-ui);
  --radius: var(--kair-radius-control); --radius-md:10px; --radius-lg: var(--kair-radius-card);
}
```

**Bug fix incluido**: `--border` y `--radius-md` se usaban en el archivo pero **no estaban
definidos** (eran declaraciones inválidas); ahora quedan definidos en la capa premium.

> **Técnica reutilizable**: si un módulo/legacy es variable-driven, migrar por **remapeo de tokens**
> (1 bloque CSS) en vez de reescribir reglas una por una. Mucho menor riesgo.

### Header System v2 (patrón oficial)

El header sigue el patrón de `modules/recursos/capacitaciones/capacitaciones-view.html`:

```
.cfg-header                 ← transparente sobre el canvas (sin card/borde/sombra)
  .cfg-breadcrumb           ← Inicio › Configuración (último en negrita, "Inicio" → goHome())
  .cfg-header-row
    .cfg-header-left        ← .cfg-header-icon (42×42, radio 12, blue-soft) + h3 + p
    .cfg-header-right       ← .cfg-back-btn (outline)
  .cfg-tabs                 ← tabs con subrayado: border-bottom 1px gris + activa 2px azul
```

- **Iconos en SVG inline** (feather-style, stroke 1.8-1.9). ⚠️ `config-viewer.html` **NO carga**
  Font Awesome ni Bootstrap Icons: los `<i class="fas ...">` / `<i class="bi ...">` que quedan en el
  archivo **no renderizan**. Para iconos nuevos usar **SVG inline**.
- Se conservó la clase **`nav-tab`** en los botones de tab porque `switchTab()` y
  `validateUserPermissions()` la usan (`document.querySelector('.nav-tab[onclick*="\'usuarios\'"]')`).
  **No renombrar** `nav-tab` ni los `onclick="switchTab('x', this)"`.
- Los IDs `tab-<seccion>` y `goHome()` también se conservaron intactos.

### Modo oscuro

La capa premium incluye overrides de tokens para `[data-theme="dark"]` y `[data-theme="dark-legacy"]`
(el padre aplica el tema sobre `document.documentElement` del iframe).

### Cache-bust

El iframe se carga con token en `renderer.js` (`showSettingsPage`):
`components/config/config-viewer.html?v=20260916-premium`. **Bumpear al modificar el archivo.**

### Verificación

`node main/test-config-premium-v2.js` → **37/37 OK** (tokens, capa premium, header v2, tabs,
dark, integridad de llaves/HTML, cache-bust y handlers intactos).

---

## 🆕 Bandeja Integrada · Premium v2 (📦752, 2026-09-17)

La **Bandeja Integrada** (`renderer/bandeja-integrada/`) se migró al look premium v2 del
diseño objetivo `kair-bandeja.html` (prototipo autocontenido que pasó el user): topbar con
breadcrumb + icono/título + chip de fecha + segmentado **Agenda / Correo**, 4 KPI cards,
sidebar de tarjetas (mini-calendario, tipos de evento con contador, integración correo) y
el correo (toolbar, carpetas, lista, lector) + agenda (mes/semana/día/programar) re-skineados.

### Estrategia: 2 capas (mismo patrón que Configuración 📦751)

1. **Remapeo de tokens.** `styles.css` (5.778 líneas, legacy Gmail-style) es **100%
   variable-driven**. `premium.css` define los **tokens premium v2** (`--kair-surface`,
   `--kair-blue: #2057B8`, `--kair-sh-*`, `--kair-r-*`, `--kair-font-t/b`) y **remapea los
   tokens legacy** a sus equivalentes premium (`--kair-primary`, `--kair-bg-card`,
   `--kair-text-muted`, `--kair-text-light`, `--email-*`, `--kair-shadow-*`, `--radius`).
   Resultado: todo el CSS legacy adopta la paleta premium **sin reescribirlo**.
2. **Recetas de componentes** para donde la geometría legacy no coincide: topbar,
   KPI cards, sidebar, filas de correo, carpetas, lector, toolbar de agenda, celdas del
   mes, modales, redactor, toasts, scrollbar y responsive.

`premium.css` se carga **después** de `styles.css` en `index.html` → gana por cascada a
igual especificidad. **No usa la clase `kair-premium`** de `shared/kair-premium.css` (el
iframe tiene su propio scope y su propio dialecto, igual que Configuración con `.kair-config`).

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `renderer/bandeja-integrada/premium.css` | **NUEVO** (1.788 líneas). Tokens + remapeo + recetas premium. |
| `renderer/bandeja-integrada/index.html` | Topbar premium (`.kair-top`), segmentado `#tab-agenda`/`#tab-correo`, KPI `.kpis`, sidebar sin tarjeta propia. |
| `renderer/bandeja-integrada/app.js` | `renderKpiStrip` (KPI cards que navegan), `renderSidebar` (mini/tipos/sidecard), `renderHeaderState` (segmentado + chip de fecha), `bindHeader` (tabs + guard del search), `setCalendarVisible()`. |
| `renderer.js` | Cache-bust del iframe `?v=683` → `?v=685`. |
| `main/test-bandeja-premium-v2.js` | **NUEVO**. Smoke test estático (37 checks). |

### Hallazgo crítico: 12 archivos JS huérfanos

`index.html` carga **solo `app.js`** (+ `data.js`, `icons.js`, `kair-calendar*.js`,
`colombia-festivos.js`, `file-viewer`). **No** carga `init.js`, `handlers.js`, `state.js`,
`helpers.js`, `mail-operations.js`, `calendar-operations.js`, `compose-modal.js`,
`event-modal.js`, `render-mail-list.js`, `render-mail-detail.js`, `render-sidebar.js`,
`render-calendar.js`. Esos 12 archivos tienen un **contrato DOM paralelo y divergente**
(emiten clases que no existen en vivo, p. ej. `kair-sidebar__minical`) y referencian helpers
inexistentes. **`app.js` es el único contrato vivo: cualquier rediseño se hace ahí.**
Ojo: `init.js:40` hace `innerHTML=""` de `#kair-app` y reconstruye el skeleton — si algún día
se agrega ese `<script>`, **destruye el topbar de `index.html`**.

### Contrato DOM del topbar (lo que NO se puede renombrar)

`bindHeader()` y `renderHeaderState()` corren en `init()` **sin guards**, así que estos IDs
deben existir siempre en `index.html`: `#btn-back`, `#btn-refresh`, `#refresh-icon`,
`#btn-compose`, `#btn-signature`, `#gmail-indicator`, `#gmail-indicator-text`, `#kpi-strip`,
`#sidebar`, `#content-area`, `#mail-list-container`, `#mail-detail-container`,
`#calendar-slide`, `#footer-events-count`, `#footer-view`, `#modal-overlay`, `#event-modal`,
`#toast-container` y los `#fv-*`. `renderFooter()` tampoco tiene guards.

### Cambios intencionales respecto de la versión anterior

- **Se eliminó `#panel-toggle`** (el botón-flecha entre sidebar y contenido) → lo reemplaza
  el segmentado Agenda/Correo, que **fija** el estado (`setCalendarVisible(true|false)`) en
  vez de alternarlo. Se conservan `#content-area[data-calendar-visible]` y
  `#calendar-slide[data-visible]`, que es de lo que depende el CSS del slide.
- **Se eliminó del topbar el buscador `#search-input`** (el binding quedó con guard): la
  búsqueda vive en `#mail-search-input` del panel de correo y escribe el mismo
  `state.searchQuery`. Antes era invisible igual, porque `styles.css` ocultaba el header
  completo (`.kair-header { display:none !important }`).
- **Se eliminaron** el chip de empresa `#company-name` (el scope de empresa se ve en el
  toggle "Todas las empresas" de la toolbar de la agenda), los iconos decorativos de
  notificaciones/configuración (no tenían handler) y el botón de prueba `#btn-fv-test`
  (`wireFileViewerDemo()` ya validaba con `if (btn && input)`; el preview de adjuntos sigue
  funcionando por `#fv-file-input`).
- **El CTA "Redactar" del topbar es solo icono** para no duplicar el "Redactar" con label de
  la toolbar del correo (que es donde lo pone el diseño objetivo).

### Cache-bust (doble)

1. `renderer.js` → `renderer/bandeja-integrada/index.html?v=685` (el iframe).
2. `index.html` → `styles.css?v=…`, `premium.css?v=20260917-premium-fix1` y `app.js?v=…` (los
   sub-recursos del iframe se cachean aparte del documento).

### Verificación

`node main/test-bandeja-premium-v2.js` → **42/42 OK** (topbar, contrato DOM crítico, render
premium en app.js, capa CSS, cache-bust y los 5 checks de regresión de los bugs de 📦752-fix1).
Correr también los smoke tests históricos de la bandeja (`main/test-compose-bem.js`,
`main/test-auditoria-visual.js`).
Nota: `test-compose-bem.js` y `test-auditoria-visual.js` ya venían fallando antes de 📦752
(buscan reglas `.message-block--expanded` y `.kair-mail-message__avatar{width:32px}` que no
existen en el repo).

### 🐛 Bugs de la primera pasada (📦752-fix1, encontrados en la validación visual)

La primera versión se veía **casi vacía y lavada**. Dos causas, ambas en `premium.css`:

1. **`.kair-layout` quedó con 3 columnas** (`250px 26px 1fr`) después de retirar el
   botón-flecha `#panel-toggle`. Al quedar solo 2 hijos (sidebar + área de contenido), el
   contenido se acomodó en el **carril de 26px** → la lista de correos y el calendario se
   veían como una tira vertical de ~5px. **Fix**: `grid-template-columns: 250px 1fr` (y las
   dos media queries: `224px 1fr` y `1fr`). Lección: al sacar un hijo de un grid, revisar
   SIEMPRE el `grid-template-columns` de las 3 declaraciones (base + 2 breakpoints).

2. **`.kair-modal-overlay` declaraba `display: flex` en la regla base.** El modal vive en
   `index.html` con el atributo `hidden`, y **quien lo oculta es la regla del NAVEGADOR**
   (`[hidden] { display: none }`). Como una regla propia gana sobre la del navegador, el
   overlay quedó **visible siempre**: un velo `rgba(...,.45)` + `backdrop-filter: blur(2px)`
   tapando toda la bandeja. **Fix**: la regla base NO declara `display`; el `display:flex`
   va en `.kair-modal-overlay:not([hidden])` (mismo patrón que el CSS legacy).
   **REGLA PARA FUTURAS CAPAS**: en este módulo, si un elemento del HTML lleva el atributo
   `hidden` (p. ej. `#modal-overlay`, `#fv-overlay`, `#mail-details-panel`), la capa nueva
   **NUNCA** debe declarar `display` en su selector base.

También se corrigió que `.kair-toast` no capturaba clicks: `#toast-container` es
`pointer-events: none` (para no bloquear la UI) pero la píldora necesita
`pointer-events: auto`, porque adentro viven los botones de "Deshacer" y "Posponer".

Los tres casos quedaron **blindados con checks de regresión** en
`main/test-bandeja-premium-v2.js` (bloques 6.a/6.b/6.c) → el test pasó de 37 a **42 checks**.

### Pendiente de validación visual

Falta revisar en pantalla: (1) que el scroll interno de la lista de correos y del lector
funcione bien tras cambiar `.kair-mail-stack` a 388px, (2) el aspecto del sidebar de 3
tarjetas en la columna de 250px, (3) contraste del modo oscuro si el padre aplica tema
(esta capa **no** define overrides dark).

---

## 🆕 Bandeja Integrada · Firma de correo con imagen (📦753, 2026-09-18)

El modal **"Firma de correo"** se rediseñó al estilo premium v2 y ahora permite **texto +
imagen**. La imagen viaja **dentro del correo** (no como archivo adjunto).

### Cómo viaja la imagen: inline con Content-ID (CID)

Un `data:image/...;base64` dentro del HTML **no sirve**: Gmail web y la mayoría de los
clientes lo bloquean al recibir. Un adjunto normal tampoco: el destinatario la vería como
archivo suelto. La forma correcta es **imagen en línea**:

```html
<img src="cid:kair-firma@kair" alt="Firma" style="max-width:420px">
```
```mime
Content-Type: image/png; name="firma.png"
Content-Disposition: inline; filename="firma.png"
Content-Transfer-Encoding: base64
Content-ID: <kair-firma@kair>
```

Esto obliga a envolver el `multipart/alternative` en un **`multipart/related`**. La
estructura MIME resultante (4 casos) vive en **`buildRawMessage()`**
(`shared/google-gmail.js`), que se **extrajo de `sendMessage()` y se exportó** para poder
testearla sin OAuth:

| Caso | Estructura |
|------|-----------|
| Sin adjuntos ni imagen | `multipart/alternative` (text/plain + text/html) — comportamiento original |
| Con imagen | `multipart/related` (alternative + imagen inline) |
| Con imagen + adjuntos | `multipart/mixed` ( `related`(alternative + imagen) + adjuntos ) |
| Solo adjuntos | `multipart/mixed` (alternative + adjuntos) — comportamiento original |

**REGLA**: el `related` va SIEMPRE adentro del `mixed` y **antes** de los adjuntos; el orden
inverso rompe la resolución del `cid:`.

### Contrato IPC (sin cambios de plomería)

`sendMessage()` acepta un campo nuevo opcional:

```js
window.electronAPI.googleGmail.sendMessage({
  to, cc, subject, body, inReplyTo, references, threadId, attachments,
  signatureImage: { name: 'firma.png', mimeType: 'image/png', data: '<base64 SIN el prefijo data:...>' }
});
```
`main.js` ya reenvía las options tal cual (`Object.assign({configPath}, options)`) y
`preload.js` también, así que **no hubo que tocar ni el IPC ni el preload**. Los otros 3
call sites de `sendMessage` no pasan el campo → comportamiento idéntico al anterior.

### Persistencia (localStorage)

| Clave | Contenido |
|-------|-----------|
| `kair.emailSignature` | Texto de la firma (como antes) |
| `kair.emailSignatureImage` | `{ dataUrl, mimeType, name, size }` |

- **Límite: 400 KB** (`SIG_IMAGE_MAX_BYTES`) — entra cómodo en la cuota de localStorage y en
  el peso del correo (base64 infla ~33%).
- Formatos: PNG, JPG, WEBP, GIF (`SIG_IMAGE_MIMES`). Cualquier otro se rechaza con toast.
- El helper `getSignatureImage()` devuelve `{name, mimeType, data}` **sin** el prefijo
  `data:...;base64,` (el backend espera base64 puro).
- La firma (texto e imagen) **no se agrega en reenvíos**, igual que antes.

### UI del modal (premium v2)

- ⚠️ **Bug corregido**: el CSS legacy pintaba `.kair-signature-modal__header` con
  `background: #404040` y el título en blanco. La capa premium sobreescribía la tipografía
  pero **no el fondo**, así que el título quedaba oscuro sobre oscuro. Ahora la regla premium
  fija `background: var(--kair-surface)` + `color: var(--kair-text)`.
- El modal pasó de 8px a **20px** de radio (`--kair-r-md`), con icono+subtítulo en el header,
  hint azul, labels en versalitas, caja de imagen (subir / miniatura + cambiar / quitar),
  vista previa en vivo (imagen arriba, texto abajo) y pie con "Borrar firma" en tono de
  peligro + Cancelar + Guardar.
- El overlay de firma mantiene `z-index: 450000` (debajo del modal de eventos 500000).

### Verificación

`node main/test-firma-imagen.js` → **60/60 OK**. No es un test de patrones: **ejecuta
`buildRawMessage()` y `extractAttachments()` de verdad** y valida la estructura MIME
(boundaries, `Content-ID`, `Content-Disposition: inline`, base64 partido en líneas de ≤76,
orden related→adjuntos) en los 4 casos, la clasificación inline vs adjunto de las partes, más
los checks estáticos de UI/CSS y del refresco.

### 🐛 Bugs encontrados en la prueba real de envío (📦753-fix1)

**1. La firma se veía como "1 archivo adjunto" y no dentro del cuerpo.** Dos causas:

- **`sanitizeHtml()` reemplazaba los `cid:` por un pixel transparente 1x1** (decisión de
  📦690 para evitar el `ERR_UNKNOWN_URL_SCHEME` en consola). Resultado: la imagen **nunca** se
  veía. **Fix**: ahora anota el Content-ID en `data-kair-cid` (y deja el pixel como src
  provisorio) y una función nueva, **`hydrateInlineImages(root, mail)`**, busca las partes en
  línea del mensaje, las descarga con `googleGmail.downloadAttachment` y cambia el `src` por un
  **data URL** (con caché en memoria por `messageId:attachmentId` para no re-descargar en cada
  render). Se llama al final de `renderMailDetail()`.
- **`extractAttachments()` listaba CUALQUIER parte con nombre de archivo como adjunto**, así que
  la imagen en línea aparecía en la barra "N archivos adjuntos". **Fix**: el parser ahora
  expone `contentId`, `disposition` e `isInline` (lee los headers `Content-ID` y
  `Content-Disposition` de cada parte); el renderer **excluye del listado** las partes en línea y
  `hasAttachment` solo cuenta las que no son inline (un correo con solo firma-imagen ya no
  muestra el clip en la lista).

**Persistencia**: `email_attachments` sumó las columnas `content_id` y `disposition`
(CREATE TABLE + migración idempotente en `EMAIL_MIGRATIONS_SQL`, mismo patrón que las columnas
de 📦647-fix2). El parser → `email-sync.js` → `email-db.saveAttachment()` las guardan.
⚠️ **Los mensajes ya cacheados** tienen esas columnas en NULL, así que su imagen aparece como
adjunto hasta que se re-sincronicen (el sync re-inserta los adjuntos de los últimos 25 hilos en
cada corrida: se auto-cura solo).

**2. La bandeja tardaba hasta ~2 minutos en reflejar un correo enviado.** Tres causas:

- El bloque post-envío sincronizaba **siempre INBOX**, pero el correo recién enviado vive en
  **Enviados** → no aparecía hasta el próximo auto-refresh. **Fix**: helper nuevo
  `refreshFolderNow(folder)` (sincroniza + relee + repinta **si esa carpeta es la visible**) y el
  post-envío refresca **la carpeta visible + SENT** al instante.
- El auto-refresh corría **cada 60 s**. **Fix**: **30 s**.
- Al volver a la app, `visibilitychange` solo **reiniciaba el timer** (hasta 60 s de espera).
  **Fix**: ahora sincroniza **de inmediato**.

Además, el merge de threads (preservar `messages`/`body`/`body_html`/`attachments` + las marcas
locales de leído/destacado) que estaba **duplicado en 2 lugares** se extrajo a
**`applyThreadsToState(threadsData)`**, usado por las 3 rutas de refresco.

### 🐛 Segunda ronda de la prueba real (📦753-fix2)

**1. La imagen de firma tardaba ~10 s en aparecer.** Causa raíz medida: el
`GmailRateLimiter` (`shared/google-gmail.js`) entrega **40 tokens por ventana de 60 s** y el
sync pide ~26 llamadas de golpe; cuando la ventana se agota, **todo** espera al próximo
refill (hasta 60 s). Abrir un correo y traer su imagen quedaba detrás del sync. Fixes:

- **Reserva de tokens para el user**: el tráfico de fondo nunca usa los últimos **8** tokens
  (`PRIORITY_RESERVE`). `GmailRateLimiter.run(fn, { priority: true })` sí puede usarlos; el
  sync va **sin** `priority`.
- **Prioridad** aplicada en `downloadAttachment` (imagen/adjunto) y `sendMessage` (enviar).
- **Caché en disco** en el handler `google-gmail:download-attachment`:
  `userData/email-attachments/<messageId>/<attachmentId>.b64`. Cada imagen se descarga **una
  sola vez**; después es instantánea y no consume cuota.
- **De-duplicación** de pedidos en vuelo (`_inlineImgPending`) y **placeholder**
  (`.kair-inline-img--loading`) mientras baja, para que no parezca que el correo no tiene imagen.

**2. Correos ya leídos volvían a aparecer como NO leídos.** Causa raíz: en
`email-db.saveMessage()` había un `UPDATE email_threads SET has_unread = 1` **incondicional**
para cualquier mensaje que no fuera del user (Loop2-fix). Como el auto-refresh re-guarda los
últimos 25 hilos en cada corrida, **cada sincronizado volvía a marcar como no leído** lo que
el user ya había leído (el mark-read local se perdía; el punto azul de la lista sale de
`thread.has_unread` → `threadToMail()`). Se notaba más al bajar el intervalo a 30 s.

Fix: **`recomputeThreadUnread(threadId)`** recalcula el flag desde los labels reales
(`label_ids LIKE '%"UNREAD"%'`, ignorando enviados y borradores) y se ejecuta **después** de
guardar el mensaje. Un correo nuevo sin leer se sigue marcando ✓; uno ya leído no revive.

### Verificación

`node main/test-firma-imagen.js` → **83/83 OK** (incluye la estructura MIME real, la
clasificación inline vs adjunto, el refresco, la reserva del rate limiter, el caché en disco,
el recálculo del "no leído" y el envío real desde la respuesta rápida).

### 🐛 Tercera ronda de la prueba real (📦753-fix3)

**La respuesta rápida no enviaba nada.** El botón **"Enviar"** de la barra de respuesta del
lector (`.kair-mail-detail__reply`) **no enviaba**: abría el redactor flotante con el texto
prellenado (`openComposeModal("reply", mail)` + un `setTimeout` que copiaba el texto). El user
creía que la respuesta ya había salido, cerraba el redactor, y **la respuesta nunca se enviaba
ni aparecía en Enviados** (de ahí que el último enviado fuera el correo de prueba anterior).

Fix: el botón ahora **envía directo** (como Gmail), reutilizando `sendComposedMail()`:

- Resuelve el destinatario con `getMailDisplayContact(mail)` (remitente en Recibidos,
  destinatario en Enviados), arma el asunto con `RV:` si no lo tiene, y manda
  `isReply: true` + `threadId` para que quede **en el mismo hilo**.
- Incluye la firma (texto + imagen) y el quote del original, igual que el redactor.
- Deshabilita el botón con "Enviando…" y lo restaura al terminar; limpia el input si salió bien.
- **`sendComposedMail()` ahora devuelve `true`/`false`** (antes devolvía `undefined` siempre) y
  **`opts.closeModal` pasó a ser opcional** (`typeof === 'function'`), porque la respuesta
  rápida no tiene modal que cerrar. Cambio backward-compatible: el redactor no usa el retorno.

### 🐛 Cuarta ronda: el sync vencía a los 120 s y Enviados nunca se actualizaba (📦753-fix4)

**Síntoma**: tras enviar desde la respuesta rápida, el correo no aparecía en Enviados, y en la
consola salía `[BandejaIntegrada] Background sync failed: El sync tardó más de 120s sin
responder`. Causa raíz **de mi propia optimización anterior** (📦753-fix2): al subir la
frecuencia de sincronizado (30 s + foco + post-envío) el consumo superó el cupo de Gmail.

**La cuenta del cupo** (esto es lo importante para no repetirlo):

- `GmailRateLimiter` entrega **N tokens por ventana de 60 s** y **todo** pasa por ahí.
- Un sync de 25 hilos cuesta **26 requests** (`messages.list` + 1 `messages.get` **por mensaje**,
  en lotes de 3 con 500 ms de espera) → ~5 s mínimo, y ~26 tokens.
- Con el cupo viejo (**40/min**, y encima 8 reservados → 32 para el fondo) **UN solo sync ya casi
  agotaba la ventana**. El segundo sync (Enviados) esperaba al siguiente minuto, y si se
  acumulaban dos ventanas **vencía a los 120 s** (timeout del handler IPC en `main.js:2020`).
- Resultado: la carpeta Enviados quedaba con datos viejos y el correo recién enviado no
  aparecía **aunque el envío hubiera salido bien**.

**El cupo real de Gmail** es 250 unidades/usuario/segundo y `messages.get` cuesta 5 unidades →
~3.000 lecturas/min. El valor de 40/min era ~1,3 % del cupo real (margen absurdo).

Fixes:

- **Cupo 40 → 120 requests/min** (`REFILL_RATE`) y **reserva del user 8 → 25**. Con eso el fondo
  tiene ~95 tokens/min: alcanza para 3 syncs/min y sobran tokens para lo interactivo.
- **Refresco de Enviados más barato**: después de enviar se piden **8 hilos** (el enviado es el
  más nuevo) en vez de 25 → ~9 requests en lugar de 26.
- **No apilar syncs por carpeta**: `_folderSyncInFlight[folder]` — si ya hay un sync corriendo
  para esa carpeta, se reutiliza esa promesa (el auto-refresh + el post-envío + el foco podían
  encolar 3 syncs idénticos y agotar el cupo).

**Lección**: al subir la frecuencia de un refresco hay que rehacer la cuenta del cupo
(`requests por sync × syncs por minuto ≤ tokens por ventana − reserva`). Un cupo pensado para
"un sync cada 60 s" no aguanta "un sync cada 30 s + uno por envío + uno por foco".

### Pendiente

- Re-validar en pantalla: (1) que la imagen aparezca rápido y con placeholder mientras baja,
  (2) que un correo leído **no** vuelva a marcarse como no leído tras un par de sincronizados,
  (3) que un correo enviado aparezca **en segundos** en Enviados (respuesta rápida y redactor),
  (4) que no vuelva a aparecer el error "El sync tardó más de 120s sin responder" en consola.
- Cache-bust: iframe `?v=690`, `premium.css?v=20260918-firma-imagen-fix2`,
  `app.js?v=20260918-firma-imagen-fix4`. → **superado por 📦754/📦755**: hoy es `?v=695`,
  `premium.css?v=20260918-paginacion-correos` y `app.js?v=20260918-paginacion-correos-fix2`.

---

## 📦754 · Bandeja Integrada — toolbar compacta (2 filas en vez de 5)

**Pedido del user**: "mejorar esta sección para ahorrar espacio y que sea más intuitiva, sin quitar
espacio y que este espacio sea aprovechado para tener más espacio para mostrar correos manteniendo
mi estilo premium" (apuntando a la zona `[+ Redactar] [⟳ Sincronizar] [≡ Reciente ▾]` + buscador +
3 filas de chips de carpetas).

### Antes vs después

| | Antes | Ahora |
|---|---|---|
| Filas de "chrome" antes del primer correo | **5** (acciones / buscador / 3 filas de carpetas) | **2** (toolbar / fila de carpetas) |
| Acciones | Redactar + Sincronizar (con etiqueta) | Redactar (**con** etiqueta) + Sincronizar (**solo icono**, tooltip) |
| Buscador | Fila propia (38px) | Dentro de la toolbar (32px, `flex: 1`) |
| Orden | Botón en la barra de acciones | Botón al final de la misma fila (solo icono + tooltip con el orden actual) |
| Carpetas | 11 chips en 3 filas (`flex-wrap: wrap`) | **2 chips** (Recibidos · Enviados) + `Más ▾` con **9 filtros** (No leídos, Marcados, Reuniones + las 6 carpetas de Gmail) |

### Decisiones y por qué

1. **El panel de correos mide 388px** (`330px` bajo 1280px de ventana, `1fr` en mobile — ver
   `.kair-mail-stack grid-template-columns`). Ese ancho manda: no entran 3 etiquetas + buscador.
   Por eso `Sincronizar` y `Orden` quedan **solo icono** con `title`. El orden no-default se pinta
   azul (`data-active="true"`) para que el estado se vea sin etiqueta.
2. **A la vista solo `Recibidos` y `Enviados` (fix7)**: con esos 2 chips + `Más ▾` la fila de
   carpetas es UNA línea y la bandeja queda en 2 líneas de controles en total (el pedido explícito
   del user). Todo lo demás vive en el menú `Más ▾`: las 3 vistas rápidas (`unread`, `flagged`,
   `meeting`) **primero**, un separador, y después las 6 carpetas de Gmail (`drafts`, `trash`,
   `spam`, `starred`, `important`, `archive`). El botón muestra la vista activa, así el filtro
   nunca se "pierde".
3. **`applyFilter(f)`** — la lógica del click (cambiar `state.mailFilter`, `_resetMailListScroll`,
   y recargar la carpeta si `isFolder`) se extrajo a una función y la usan **los chips y el menú**.
   Antes estaba inline en el forEach de los chips.
4. **La fila de carpetas usa `flex-wrap: wrap` + `display: contents` (fix6)**: la primera versión
   usaba UNA línea con `overflow-x: auto` y, con 388px de panel, el último chip visible quedaba
   **cortado a la mitad** (se veía como un error de dibujado, ver la captura del user). Con
   `.kair-mail-list-filters { display: contents }` los chips son items de la fila y envuelven junto
   con el botón `Más`. Desde el fix7 no hace falta envolver (son 3 elementos) pero el wrap queda
   como red de seguridad en ventanas angostas.
5. **El menú `Más` se ancla a LA FILA, no al botón**: `.kair-mail-filter-row { position: relative }`
   y `.kair-mail-folders-menu { position: absolute; right: 0; top: calc(100% + 2px) }`. Si se
   anclara al botón, al envolver el botón a la 2ª línea el menú de 198px se saldría del panel.
   Con 9 items además lleva `max-height: 70vh; overflow-y: auto` para no salirse en ventanas bajas.
6. **Un solo listener global** para cerrar el menú (`handleFoldersMenuOutsideClick` +
   `handleFoldersMenuEscape`, registrados al cargar y removidos en `destroy()`). Lo obvio era
   registrar el listener dentro del render de la lista, pero `renderMailList` corre en **cada**
   `render()` → se acumulaban handlers.

### Pitfalls confirmados (ampliación de la regla histórica)

1. **`display` + `[hidden]`**: `.kair-mail-folders-menu` NO declara `display` en su regla base;
   el `display:flex` vive en `.kair-mail-folders-menu:not([hidden])`. Si se declara en la base,
   pisa el `[hidden] { display:none }` del navegador y **el menú queda siempre abierto** (mismo bug
   que el `.kair-modal-overlay` del 📦752). El test lo valida explícitamente.
2. **El helper `el(tag, attrs)` de `app.js` NO soporta el atributo `hidden`** (solo `class`, `html`,
   `data-*`, `style`, `onClick/onInput/onChange`, `title`, `aria-label`, `type`, `placeholder`,
   `value`). `el("div", { hidden: true })` se ignora en silencio → hay que hacer `menu.hidden = true`
   después de crearlo.
3. **Especificidad de `:first-child`**: al sacar el botón de orden de `.kair-mail-compose-bar`,
   `:first-child` volvió a apuntar a "Redactar" (que es el que debe verse azul). Mover botones entre
   contenedores cambia qué elemento matchea `:first-child` — revisar los estilos que dependen de eso.

### Validación

- `node main/test-bandeja-toolbar-compacta.js` → **48/48 OK** (nuevo).
- `node main/test-bandeja-premium-v2.js` → 42/42 OK · `node main/test-firma-imagen.js` → 88/88 OK.
- Validado en pantalla por el user (2 rondas de capturas).

### fix6 (feedback visual del user sobre 📦754)

El user probó y mandó 2 capturas: la toolbar y el menú se veían bien, pero el chip **"No leídos"
quedaba cortado a la mitad** contra el borde de la tira (la fila tenía `overflow-x: auto` y con
388px de panel no entraban las 6 carpetas). Ajustes aplicados:

- `.kair-mail-filter-row`: `flex-wrap: wrap` + `position: relative` (bloque contenedor del menú).
- `.kair-mail-list-filters`: `display: contents` → sus chips son items de la fila y envuelven
  junto con el botón `Más` (el wrapper deja de aportar caja; ya no hay scroll horizontal).
- Etiqueta `all`: "Bandeja de entrada" → **"Recibidos"** (la tab de arriba ya dice el nombre largo).
- Chips más compactos: fuente 11.5px, padding `5px 10px`, gap 5px.
- `@media (max-width: 1280px)`: se esconden los iconitos de las carpetas (el panel baja a 330px).
  El chevron del botón `Más` NO se esconde.
- **El menú `Más` ahora se ancla a la FILA** (`right: 0` contra `.kair-mail-filter-row`): al
  envolver, el botón puede caer en la 2ª línea y, si el menú se anclara a él, se saldría del panel.

### fix7 (pedido explícito del user: "así lo quiero", 2 líneas)

**Línea 1**: `[+ Redactar] [⟳] [buscador flexible] [≡ ▾]` — sin cambios.
**Línea 2**: `[Recibidos 22] [Enviados] [Más ▾]` — `PRIMARY_FILTERS = ["all", "sent"]`.

Todo el resto vive en el menú `Más ▾`: **primero las 3 vistas** (`unread`, `flagged`, `meeting`),
un **separador** (`.kair-mail-folders-menu__sep`) y después las **6 carpetas** de Gmail. Con 9 items
el menú lleva `max-height: 70vh; overflow-y: auto` para no salirse en ventanas bajas.

Lección: un contenedor con `overflow-x: auto` para "que entre todo" es una trampa cuando el panel
es angosto — el último elemento visible queda cortado y se lee como error de dibujado. Y cuando el
panel tiene ancho fijo, la única forma de garantizar UNA línea es reducir la cantidad de elementos
visibles (mover el resto a un menú), no achicar infinitamente los chips.

---

## 📦755 · Bandeja Integrada — ver TODOS los correos (paginación)

**Pedido del user**: "como podemos ver todos los correos... ya que actualmente no tenemos esa opción
de ver todos los correos bien sea con la barra de desplazamiento o con una paginación".

### El diagnóstico

La Bandeja **solo podía mostrar los 25 correos más nuevos** por dos topes que se sumaban:

1. **El sync** (`email-sync.syncInbox`) pedía siempre **la PRIMERA página** de Gmail
   (`maxResults: 25`, sin `pageToken`) y después **borraba del cache todo lo que no estuviera en esa
   página** (limpieza de huérfanos). O sea: el cache nunca podía tener más de 25 threads por carpeta.
2. **La lista** leía el cache con `getThreads({ maxResults: 25 })` fijo, sin offset.

No había scroll infinito ni botón de "cargar más": el final de la lista simplemente terminaba.

### La solución (4 capas)

| Capa | Cambio |
|---|---|
| **Schema** | Nueva tabla `email_sync_state` (folder PK, `page_token`, `loaded_count`, `pages_loaded`). Idempotente: `CREATE TABLE IF NOT EXISTS` dentro de `EMAIL_SCHEMA_SQL`, que `main.js` ejecuta en cada arranque → las bases existentes la crean solas. |
| **email-db.js** | `getThreadsFromCache` acepta `offset` (`LIMIT @maxResults OFFSET @offset`); nuevo `countThreadsFromCache`; nuevos `saveSyncState` / `getSyncState` / `resetSyncState`. El WHERE se extrajo a **`buildThreadsWhere()`** para que la lista y el contador usen EXACTAMENTE el mismo filtro (si no, "Mostrando 25 de 137" mentiría). El contador va envuelto en una subquery porque el operador `to:` necesita el `last_to_list` que sale de `email_messages`. |
| **email-sync.js** | `syncInbox({ append: true })` = traer la **página siguiente** desde el `nextPageToken` guardado, **agregando** al cache. Devuelve `nextPageToken` + `hasMore` y guarda el estado. `fetchAll: false` (una página por vez, explícito). |
| **Renderer** | `state.mailLoaded` (ventana cargada) + `loadMoreMails()` + scroll infinito + pie "Mostrando X de Y" con botón. |

### Decisión clave: la limpieza de huérfanos NO puede borrar lo que el user cargó

`syncInbox` borraba los threads de la carpeta que no venían en la respuesta de Gmail (para limpiar
los que se borraron/archivaron). Con paginación eso es **destructivo**: el sync de fondo trae solo la
página 1, así que habría borrado las páginas 2, 3, … que el user acababa de pedir.

Fix: **ventana de fechas**. Se calcula la fecha más vieja de la página traída (`cutoff`) y solo se
consideran huérfanos los threads **dentro** de esa ventana (`last_message_date >= cutoff`). Los más
viejos pertenecen a páginas siguientes y no se tocan. Además la limpieza se saltea por completo en
modo `append`. El test funcional lo verifica: sin la ventana se habrían borrado 35 correos de 60.

### Los dos caminos de "cargar más" (en este orden)

1. **Cache local primero** (`mailTotal > mostrado`): solo se amplía `state.mailLoaded` y se relee el
   cache. **Cero requests a Gmail** → instantáneo.
2. **Gmail después** (el cache ya se agotó): `syncInbox({ append: true })` con el `pageToken`
   guardado → 1 request de listado + 25 de detalle ≈ 40s (mismo costo que el sync normal, respeta el
   cupo de 120/min del 📦753).

El **scroll infinito** dispara lo mismo al llegar a 220px del final; el **botón del pie** es la
acción visible para quien no scrollea y también el indicador de "Cargando correos…". El pie se
repinta SOLO él (`updateMailPagerFooter`) cuando llega el total: si se re-renderizara la lista, el
scroll del user saltaría.

### Pitfall encontrado en el camino: `el()` ignoraba `id`

El helper `el(tag, attrs)` de `app.js` soportaba `class`, `html`, `data-*`, `style`, `onClick`,
`onInput`, `onChange`, `title`, `aria-label`, `type`, `placeholder` y `value`… **pero NO `id`**: se
ignoraba en silencio. Consecuencia real: el botón de orden (`#mail-sort-toggle`) se crea con
`el("button", { id: "mail-sort-toggle", ... })` desde el 📦754, quedaba **sin id**, y el handler que
lo busca con `$("#mail-sort-toggle")` **nunca se enganchaba** (el botón no hacía nada).

Fix: `el()` ahora soporta `id` (y `hidden`). **Regla**: antes de crear un elemento con `el()` y
buscarlo después por id, verificar que el helper soporte ese atributo — o setearlo a mano
(`node.id = "x"`), como se hacía con `menu.hidden`.

### Validación

- `node main/test-bandeja-paginacion.js` → **48/48 OK** (estructural, nuevo).
- **`test-bandeja-paginacion-funcional.js` → 22/22 OK** (FUNCIONAL contra SQLite en memoria:
  páginas sin solaparse, contador que coincide con la lista, `page_token` por carpeta, y la ventana
  de fechas de la limpieza). ⚠️ Se corre con
  `$env:ELECTRON_RUN_AS_NODE=1; npx electron main/test-bandeja-paginacion-funcional.js` porque
  `better-sqlite3` está compilado para el ABI de Electron (con `node` a secas da `ERR_DLOPEN_FAILED`).
- `test-bandeja-toolbar-compacta.js` 50/50 · `test-bandeja-premium-v2.js` 42/42 ·
  `test-firma-imagen.js` 88/88.
- Cache-bust: iframe `?v=695`, `premium.css`/`app.js?v=20260918-paginacion-correos-fix2`.

### fix (prueba real del user: log de consola)

El user probó la paginación y **funcionó**, pero en el medio apareció un toast
**"No se pudieron cargar más correos · No se pudo obtener el perfil de Gmail"** y el log mostró
**10+ "Cargando la página siguiente de INBOX desde Gmail..." encadenados**. Diagnóstico:

1. **El scroll infinito encadenaba páginas.** Al agregar 25 filas la lista crecía y volvía a
   disparar el evento de scroll (y el navegador emite varios eventos por gesto). Cada página son
   **26 requests**; 4-5 páginas seguidas + el auto-refresh cada 30s (26 requests más) superan el
   cupo de Gmail (120/min, ver 📦753) → el sync empezó a fallar y uno de los pedidos reventó en
   `getProfile`.
2. **`getProfile` abortaba todo el sync.** Si esa llamada fallaba (rate limit, hipo de red) el sync
   devolvía `No se pudo obtener el perfil de Gmail` aunque los tokens estuvieran perfectos y el
   email ya estuviera guardado en `email_connections`.

Fixes:

- **Scroll infinito "armado"**: se dispara UNA página por llegada al final. Si el user sigue
  bajando, el primer evento de scroll queda lejos del final (se agregaron 25 filas) y vuelve a
  armarse (`if (remaining > 400 || sinceLast > 5000) state._autoLoadArmed = true`). Más un
  **cooldown de 1,5s** entre cargas automáticas.
- **No apilar syncs**: `isAnySyncInFlight()` (sync de fondo + syncs por carpeta). "Cargar más"
  posterga si hay otro sync corriendo, y el **auto-refresh se saltea el ciclo** si se acaba de
  cargar una página (`mailLoadingMore` o `_lastLoadMoreAt < 15s`). Prioriza la acción del user
  sobre el refresco automático.
- **`getProfile` con fallback**: si falla, se usa el email de `emailDb.getAllConnections()[0]`.
  Solo se aborta si tampoco hay conexión guardada.
- **Toast con throttle** (`notifyLoadMoreError`, 30s por mensaje distinto): si el user insiste o el
  scroll dispara varias veces, no recibe 5 toasts iguales.

**Lección**: al agregar paginación sobre una API con cupo (Gmail), el scroll infinito es un
multiplicador de requests. Hay que ponerle freno explícito (armado + cooldown) y hacer que las
tareas automáticas (auto-refresh) cedan prioridad a la acción del usuario.

---

## 🆕 Perfil de Cargo y Profesiograma · Premium v2 (📦772, 2026-09-18)

El submódulo **3.1.3** (`modules/gestion-salud/perfiles-cargo-profesiograma/`) se migró al estilo
**premium v2** siguiendo el patrón de Evaluación Inicial (📦761) y Evaluación y Selección (📦770).

### Cómo se monta (iframe)

`renderer.js` hace `new PerfilesCargoProfesiogramaComponent(container, company, module, sub, safeBackToModuleCallback)`
y el componente carga un **iframe** con la UI completa → per el patrón 📦761, el HTML se queda como
archivo y el **wrapper versiona la URL**. El componente ahora tiene **`destroy()`** (remueve el
listener de mensajes y limpia el contenedor) y el render hace
`removeEventListener` + `addEventListener` para que **un render repetido no duplique el listener**.

### Estrategia: tokens premium en su `:root` propio

El CSS vive en un bloque `<style>` DENTRO del HTML (iframe aislado, no envenena la app). El diseño
era variable-driven (`:root` con tokens genéricos `--primary`, `--bg-card`, `--border`…) — se
**remapearon los valores** al dialecto premium (#2057B8 / #14213D / #748096 / #E8EBEE / sombras
rgba(20,33,61,…)) y se agregaron variables nuevas (`--row-hover`, `--slate-soft`, `--dirty-bg`,
`--sk-1/--sk-2`) para los colores que estaban hardcodeados.

### Header System v2

```
.app-header                    ← transparente sobre el canvas (sin card/borde)
  .breadcrumb                  ← Gestión de la Salud › 3.1.3 › Inicio (SE CONSERVÓ: el JS
                                 lo usa — switchView escribe #bc-current con el nombre de la vista)
  .app-header-row
    .app-header-left           ← .header-icon (44×44, radio 12, blue-soft, SVG stethoscope)
                                 + .app-title (Manrope 800, 20px) + .app-sub
    .header-actions            ← 3 .header-btn (outline; Volver en primary) con SVG inline
.tabs-bar                      ← transparente + línea gris 1px + tabs con subrayado
```

- **Tabs con subrayado** (patrón Evaluación Inicial): activa = `color: var(--primary)` +
  `border-bottom-color: var(--primary)` (2px que se monta sobre la línea con `margin-bottom:-1px`);
  hover SOLO cambia el color (sin fondo); contenedor con `flex-wrap: wrap` (no `overflow-x`).
- **Iconos en SVG inline** en el header y las 7 tabs. El resto del módulo conserva Font Awesome
  (el iframe lo carga por CDN — deuda conocida offline).
- **Se conservó intacto**: los ids `btn-import`/`btn-export`/`btn-back`, los `data-view` de las 7
  tabs, los 3 badges, el contrato postMessage `{ action: 'backToModule' }` (campo `action`, no `type`)
  y TODA la lógica del viewer.js (sin cambios).

### Modo oscuro

Bloque de tokens para `[data-theme="dark"]` **y** `[data-theme="dark-legacy"]` (theme-manager.js
propaga el tema a TODOS los iframes). Cubre superficies hardcodeadas: tags (5 variantes soft),
toast (`.toast:not(.success):not(.error)` para no pisar los toasts de éxito/error), dialog-overlay
e inputs/selects del formulario. El CSS del explorer (prestado de `responsable-sg-view.css`) ya
tiene su propio modo oscuro.

### Fixes incluidos

- **`.view:not(.active) { display: none }`** — el toggle `.view`/`.view.active` tenía igual
  especificidad (lección 📦759; funcionaba por orden, ahora es a prueba de reorden).
- **Colores tokenizados**: gradiente del hero premium (#2057B8 → #14213D), tablas
  (`th` → `var(--bg-body)`, `td` → `var(--border)`, hover → `var(--row-hover)`), ipr-cells,
  dirty-row, skeleton, botones, search-box, dialog y detail-panel → todo con variables que el
  bloque oscuro remapea.

### Cache-bust (triple)

1. `component.js` → URL del iframe `?v=PCP-20260918-premium`.
2. `viewer.html` → script del viewer `?v=PCP-20260918-premium`.
3. `index.html` → script del componente `?v=PCP-20260918-premium`.

### Verificación

`node tests/profesiograma/test-premium-v2.js` → **39/39 OK** (tokens, header v2, tabs, fix .view,
colores, dark, componente con destroy/cache-bust, integridad JS/HTML). Los 12 tests históricos del
módulo (`tests/profesiograma/test-*.js`): 6 pasan; 4 requieren el Excel GI-FO-047 en Temp (no está
en esta máquina) y 2 tienen 1 FAIL preexistente de lógica del bridge (export: primera fila del
Excel; prof-id: grupoOcupacional null) — el bridge NO se tocó en esta migración.

### Pendiente

- Reemplazar los iconos FA del cuerpo (KPIs, module-cards, hero, diálogos) por SVG inline y quitar
  los 3 CDN (deuda offline, mismo pendiente de los viewers EMO).
- Divergencia de nombres en el bridge: `matriz` devuelve `tipoExamenId` (camelCase) pero
  `cargos:get` devuelve `tipo_examen_id` (snake_case) — revisar si algún día se toca el puente.

---

## 🆕 Reportes de Accidentes (FURAT) · Premium v2 (📦773, 2026-09-18)

El submódulo **3.2.1** (`modules/gestion-salud/reportes-accidentes/`) se migró al estilo **premium v2**
siguiendo el patrón de Evaluación Inicial (📦761), Evaluación y Selección (📦771) y Perfil de Cargo
(📦772). Es un módulo **FURAT** (reporte de accidentes de trabajo) con dashboard, biblioteca de
archivos por año y modales de carga/metadata.

### Cómo se monta (iframe)

`renderer.js` hace `new ReportesAccidentesComponent(container, company, module, sub, safeBackToModuleCallback)`
y el componente carga un **iframe** con `reportes-accidentes-view.html`. El wrapper versiona la URL y
ahora **`setupFrameCommunication` remueve el listener anterior antes de agregar** (un render repetido no
duplica el listener; `destroy()` ya existía y lo remueve).

### Estrategia: tokens premium en su `:root` propio

El CSS (`reportes-accidentes-view.css`, ~3.2k líneas) ya tenía su propio namespace `--furat-*` en
`:root`. Como el módulo vive en un **iframe aislado**, remapear los valores ahí es seguro (no filtra a
la app). Se remapearon al dialecto premium: azul `#2057b8`, tinta `#14213d`, muted `#98a2b3`,
borde `#e8ebee`, canvas `#fbfcfb`, sombras `rgba(37,56,82,…)`, tipografía DM Sans + Manrope. Se
agregaron variables nuevas para las superficies que estaban **hardcodeadas** (`--furat-row-hover`,
`--furat-slate-soft`, `--furat-blue-soft`, `--furat-header-icon-bg`, `--furat-line-soft`).

### Header System v2

```
.furat-header-v2               ← transparente sobre el canvas (sin card/borde)
  .furat-breadcrumb            ← Gestión de la Salud › 3.2.1 › Reportes de Accidentes
  .furat-header-row
    .furat-header-left         ← .furat-header-icon (44×44, radio 12, var(--furat-header-icon-bg), SVG shield)
                                 + .furat-title (Manrope 800, 20px) + .furat-subtitle
    .furat-header-actions      ← .furat-header-company (SVG building + #header-company-text)
                                 + .furat-back-btn (outline) con SVG inline
  .em-tabs                     ← tabs con subrayado (ver abajo)
```

- **Contrato conservado**: `#backBtn` (el viewer postea `back-to-module-request`), `#header-company-text`,
  `.em-tabs` / `.em-tab` / `.em-tab--active` (el viewer engancha el click y alterna la clase) y
  `data-view="dashboard|library"`. **No renombrar** esas clases: el JS las busca por nombre.
- **Iconos SVG inline** en el header y las 2 tabs. Se quitó el CDN de **Bootstrap Icons** (no se usaba
  en ningún lado). Font Awesome se conserva para el cuerpo del módulo (KPIs, tablas, modales).

### Tabs con subrayado (patrón Evaluación Inicial)

La línea es del contenedor (`border-bottom: 1px solid var(--furat-border)`) y la tab activa monta su
subrayado de 2px encima (`margin-bottom: -1px`). Hover **solo cambia el color** (sin fondo). El
contenedor usa **`flex-wrap: wrap`** (no `overflow-x`, lección del chip cortado 📦754).

### Modo oscuro: los DOS atributos con UN selector

🚨 **Truco reutilizable**: la app aplica `data-theme="dark"` (tema Sistema) y `data-theme="dark-legacy"`
(Oscuro manual). En vez de duplicar las **128 reglas** oscuras, se usa el selector de atributo
**`[data-theme^="dark"]`** (empieza con "dark"), que matchea ambos. Un solo reemplazo global
`[data-theme="dark"]` → `[data-theme^="dark"]` cubrió todo el archivo.
- El bloque de tokens oscuros define también las variables nuevas del header (`--furat-header-icon-bg`, etc.).
- Se eliminaron las reglas viejas de header con hex fijo (`#1e1e2f` / `#3a3a4d`): ya no hacen falta porque
  todo el header está tokenizado.

### Higiene de CSS

- **Reset scoped**: `* { … }` → `body, .furat-app, .furat-app * { … }` (por si algún día se linkea fuera
  del iframe).
- **Código muerto eliminado**: el bloque viejo `.furat-header*` (0 usos) tenía **propiedades huérfanas y
  una llave de más** (el archivo venía desbalanceado 623/624). Con la limpieza quedó **596/596**. También
  se eliminó el bloque **duplicado** de `.k-section-card` / `.header-back-btn` / `.em-tabs` (había dos
  copias del mismo header).
- Se reemplazaron los tokens viejos `#f8f9fa` / `#dee2e6` / `#5a6378` / `#174ea6` (ya no existen en el CSS).

### 🐛 Fallo de diseño encontrado en la validación visual: el BODY scrolleaba

El usuario mandó una captura donde se veían **solo las tabs pegadas al borde superior** y el header
(breadcrumb + título + Volver) había desaparecido. Diagnóstico con un arnés de Electron que mide
geometría (`getBoundingClientRect` + `scrollHeight`): el body medía **1310px** contra un viewport de
**755px** y `.kair-container` medía **1038px** (se estiraba con el contenido). Causa: el CSS tenía
`body { min-height: 100vh; overflow-y: auto }` y `.furat-app { min-height: 100vh }`. Con `min-height`
el contenedor **crece con el contenido**, así que el `overflow-y: auto` interno nunca se activa y el
que scrollea es el **body** → al bajar, el header se va de pantalla. Es exactamente el gotcha 📦682 de
este archivo ("Body debe ser `height:100vh + overflow:hidden`, no `min-height`").
- **Fix**: `body { height: 100vh; overflow: hidden }`, `.furat-app { height: 100vh; min-height: 0;
  overflow: hidden }` y `.kpi-strip { flex-shrink: 0 }`. Medido después: `body.scrollHeight == innerHeight`
  (755) y al scrollear el contenido (`.furat-view` → `scrollTop 555`) el header queda en `top: 0`.
- **Segundo arreglo**: el `.kpi-strip` iba **a todo el ancho** (flush) mientras el header y las cards
  están inset ~23px → se veía desalineado. Ahora lleva
  `margin: 0 clamp(16px, 1.8vw, 28px) 16px`.
- **Receta de verificación visual** (arnés temporal, en `.gitignore`): cargar la vista real en un
  `BrowserWindow`, `showInactive()`, y medir con `executeJavaScript`: rect del header/tabs/kpi, `body.scrollHeight`
  vs `innerHeight`, el scroller real y su `scrollHeight`, y las fuentes/colores calculados. Con la ventana
  **sin mostrar** Electron mide todo en 0 → hay que usar `win.showInactive()`. Y ojo: el scroller de este
  módulo es **`.furat-view--active`** (no `.k-main-content`).

### 🐛 fix2 — el iframe no llenaba el alto (contenido recortado)

Segunda captura del usuario: **"no se ve nada"** — se veían el header y las tabs, pero ni la franja de
KPIs ni el contenido. Diagnóstico con un arnés que monta el componente dentro de la cadena REAL de la
app (`#main-content → .main-canvas → .module-content-area → .submodule-content`, sin login):
- La cadena SÍ es definida (`#main-content` = 735px en 1280×800, 508px en 1146×573).
- Con el arnés, el iframe mide 715px y la franja de KPIs aparece en `top: 175`. Con las dos variantes
  (vieja y nueva) de `logic.js`. O sea: la cadena por sí sola no explicaba el síntoma.
- Lo que sí era frágil: `logic.js` ponía el **contenedor en `height: auto` + `min-height: 100%`** y el
  **iframe en `min-height: 100%`**, una resolución circular que en algunos contextos cae al alto por
  defecto del iframe (~150px) → solo se veía el header y el resto quedaba recortado (más aún con
  `overflow: hidden`).
- **Fix**: el iframe se estira con `flex: 1; height: 100%; min-height: 0; display: block` (el
  contenedor ya es `flex column`), y el contenedor pasa a `height: 100%; min-height: 0; overflow: hidden`
  (el scroll vive DENTRO del iframe, no en el contenedor padre). Se quitó `height: auto` +
  `min-height: 100%` y el `scrolling`/`overflow` del iframe.
- **CSS**: se cambió `height: 100vh` por `html, body { height: 100% }` + `body { height: 100% }` y
  `.furat-app { height: 100% }` — es el patrón que ya usan `frecuencia-accidentalidad` y
  `severidad-accidentalidad` (iframes hermanos que sí funcionan). `vh` dentro de un iframe anidado
  puede desincronizarse; `%` contra la cadena real es lo probado en esta app.
- **Cache-bust**: se bumpeó el token a `FURAT-20260918-premium-fix2` (CSS + viewer + logic.js en
  `index.html`) — el arreglo anterior se había hecho SIN bumpear el token, así que el usuario podía
  seguir viendo el CSS viejo cacheado. **Regla**: cada vez que se toca el CSS/HTML/JS del módulo,
  bumpear el token, aunque sea el mismo día.
- Test: `node tests/reportes-accidentes/test-premium-v2.js` → **47/47 OK** (se agregaron 2 checks del
  iframe y 2 del contenedor).

### 🚨 EOL: el diff salía como "todo el archivo cambiado"

`git ls-files --eol` mostró que **todo el directorio está `i/lf w/crlf`**: el índice guarda LF y el
working tree tiene CRLF (checkout de Windows). Git **no marca** los archivos que no se tocan (usa la
caché de stat), pero al **tocar** un archivo compara el CRLF del working contra el LF del índice y el
diff sale de **miles de líneas**. Fix: normalizar los archivos editados a **LF** (el EOL del índice).
Con eso el diff bajó a 298/377 en el CSS y 32/24 en el HTML. **Regla**: antes de editar un archivo,
correr `git ls-files --eol -- <ruta>`; si dice `i/lf w/crlf` y lo vas a tocar, normalizá a LF al final
(o esperá un diff gigante).

### Cache-bust (triple)

1. `logic.js` → URL del iframe `&v=FURAT-20260918-premium`.
2. `view.html` → `<link>` del CSS y `<script>` del viewer con `?v=FURAT-20260918-premium`.
3. `index.html` → script de `reportes-accidentes-logic.js?v=FURAT-20260918-premium`.

### Verificación

`node tests/reportes-accidentes/test-premium-v2.js` → **41/41 OK** (tokens, header v2, tabs, dark con
`^="dark"`, reset scoped, componente con guard/cache-bust, integridad JS, cache-bust triple, CDN).
Los 2 tests funcionales del módulo quedan como deuda (el módulo no tenía tests antes de 📦773).

### Pendiente

- Reemplazar los iconos FA del cuerpo (KPIs, tablas, modales, dropzone) por SVG inline y quitar el CDN
  de Font Awesome (deuda offline, mismo pendiente que los viewers EMO y el 3.1.3).
- El `.kpi-strip` sigue a ancho completo (flush) mientras el header está inset: es el diseño previo; si
  se quiere alinear, envolverlo con el mismo `clamp(...)` del header.

---

## 🆕 Gestión del Cambio · Premium v2 (📦774, 2026-09-19)

El submódulo **2.11.1** (`modules/gestion-integral/gestion-del-cambio/`) se migró al estilo **premium v2**.
Es el módulo de **gestión del cambio** (GI-FO-058 / GI-FO-059): registro de cambios con pipeline de 5
etapas, lista de chequeo de 13 ítems, evaluación de riesgos y plan de cierre.

### De 6 archivos a 1 par (marcado EMBEBIDO, no iframe)

La implementación vieja tenía 6 archivos: `gestion-cambio-logic.js` (componente) + `gestion-cambio-view.html`
(marcado) + `gestion-cambio-view.css` + `gestion-cambio-modal.css` + `gestion-cambio-viewer.js` + `index.js`
(CommonJS). **Los 6 se eliminaron.** Ahora hay solo:

| Archivo | Rol |
|---------|-----|
| `gestion-cambio-v2.js` | Componente + marcado EMBEBIDO en la constante `MARCADO` |
| `gestion-cambio-v2.css` | Todos los estilos, bajo `.gdc-scope` |

`renderer.js` (línea ~5359, **sin cambios**) hace
`new window.GestionDelCambioComponent(contenedor, empresa, módulo, sub, safeBackToModuleCallback)` y
`render()`. **No es iframe**: el componente inyecta su propio marcado (`this.raiz.innerHTML = MARCADO`) →
regla de 📦761. El `index.html` dejó de cargar `gestion-cambio-logic.js` y ahora carga la hoja + el `.js` v2
con cache-bust `GDC-20260918-v1-premium`.

### CSS: capa scoped `.gdc-scope` con tokens propios

- **Todos** los selectores van bajo `.gdc-scope` (el test lo verifica recorriendo el CSS y falla si alguno
  queda suelto). Tokens propios `--gdc-*` (azul `#2057B8`, tinta `#14213D`, borde `#E8EBEE`, sombras
  `rgba(20,33,61,…)`, radios 20/14/10/8, transición 180ms).
- **Sin `:root` global**: los tokens viven en `.gdc-scope` para no pisar la paleta de la app (lección 📦762).
- **Modo oscuro** para `[data-theme="dark"]` **y** `[data-theme="dark-legacy"]` (los dos que aplica
  `scripts/theme-manager.js`).
- Clases con prefijo `gdc-` (el prototipo viejo usaba `kair-gc-*`). Sin nombres genéricos sueltos
  (`badge`, `card`, `btn`, `modal`, `overlay`…) — el test lo verifica.

### Overlays al `<body>` ENVUELTOS en `.gdc-scope` (patrón 📦761)

El modal del asistente y los toasts son `position: fixed`; adentro de un contenedor con `flex`/`transform`
`fixed` se comporta como `absolute` y no cubre la ventana. Por eso se **mueven al `<body>`**, pero
**envueltos en un `<div class="gdc-scope">`** — si no, como el CSS usa selectores descendientes
(`.gdc-scope .gdc-modal`), al salir del árbol del componente perderían TODOS los estilos.

### Vigía de navegación (por qué hace falta)

`renderer.js` solo llama `destroy()` del componente activo cuando el **siguiente** se monta por
`createComponentSafely`; los montajes directos **no avisan**. Como el componente deja capas en el `<body>`,
al navegar a otro submódulo quedarían flotando (era el bug del "modal flotante"). Solución: un
**`MutationObserver`** sobre `documentElement` que, si el host O la raíz salen del documento
(`!host.isConnected || !self.raiz.isConnected`), llama a `#limpiarCapas()` (retira los nodos del body,
desconecta el observer, suelta el ESC y desbloquea el scroll). `destroy()` hace lo mismo de forma explícita.
Un `render()` repetido también llama `#limpiarCapas()` primero (no duplica capas).

### Contrato de datos EXCEL (intacto)

El componente usa **exactamente 4 canales** IPC (verificado por el test):
`loadGestionCambioData(empresa)` · `saveGestionCambioData(empresa, data)` ·
`generateGestionCambioId(empresa)` · `updateGestionCambioEstado(empresa, id, estado, extra)`.
Los handlers viven en `main.js` (líneas ~17762-17973) y NO se tocaron. La máquina de estados y la lista de
chequeo de 13 ítems (Rh1-4, Rl1-3, Sst1-6) y los 8 tipos de cambio se conservan igual.

### Validaciones de transición (no se pueden saltar)

- **Aprobado** exige la lista de chequeo **completa** (los 13 ítems vía `CLAVES`) y el **nivel de riesgo**.
- **En Ejecución** exige **al menos una aprobación** (SST o área).
- **Cerrado** exige **fecha de ejecución** y **fecha de cierre**.

### Verificación

- `node main/test-gestion-cambio-v2.js` → **69/69 OK** (registro en `index.html`, construcción del
  componente, CSS bajo `.gdc-scope` + dark, contrato de datos y validaciones).
- Verificación funcional con arnés temporal (`main/_preview-gdc.js`, en `.gitignore`): monta el componente
  real con un puente simulado y confirmó **5 filas**, KPIs `pend 3 / alto 2 / activos 4 / mes 1`, pipeline
  `1/1/1/1/1`, el asistente **"Paso 1 de 4"** con **8 tipos** y **13 ítems** de checklist, y el modo oscuro
  (`dark-legacy`: fondo `#131824`, texto `#E8EDF5`, tarjeta `#1B2230`). **Sin errores de consola.**

### Limpieza de código muerto

- Se eliminaron los 6 archivos viejos del módulo (nada los referenciaba; solo quedaba un comentario en
  `main.js` que se actualizó a `gestion-cambio-v2.js#renderPipeline`).
- El comentario de `classifyCambioPipeline` en `main.js` tenía un placeholder `📦XXX` (preexistente).

### Pendiente

- El CSS usa `font: … 'Inter', …` pero la app **no carga Inter** → cae a `system-ui`. Si se quiere
  consistencia con el resto del sistema premium, cambiar a `'DM Sans'` (el `--kair-font-ui` de la app).
- Iconos: el header y el modal usan **SVG inline**; revisar si quedó algún `<i class="fas">` en el cuerpo
  que dependa de un CDN (el módulo no carga Font Awesome).

---

## 🆕 Restricciones y Remisiones · Premium v2, segunda pasada (📦775, 2026-09-19)

El submódulo **3.1.6** (`modules/gestion-salud/restricciones-medicas/`) tiene 5 interfaces. Una pasada
previa (sin número de commit, en curso) migró **Enviar Remisión** y **Control de Remisiones** a
componentes embebidos premium (`.remenv-scope` / `.remctl-scope`). En 📦775 se completó el resto.

### Estado de las 5 interfaces

| Interfaz | Cómo se monta | Estado |
|----------|---------------|--------|
| Portal (home del módulo) | `fetch` + `innerHTML` en el documento principal | 📦775 premium + scoped |
| Ver Remisiones Médicas (visor) | `<iframe>` → `remisiones-view.html` | 📦775 tokens premium |
| Enviar Remisiones | componente embebido | ✅ v2 (pasada previa) |
| Control de Remisiones | componente embebido | ✅ v2 (pasada previa) |
| Generar Informe | `<iframe>` → `generar-informe-remision.html` | 📦775 tokens premium + dark |

### 🚨 El portal FILTRABA tokens a toda la app (bug tipo 📦766)

`restricciones-medicas-logic.js#render()` hace `fetch` del portal y
`this.container.innerHTML = html`. El HTML traía un `<style>` con **`:root`** (`--primary: #174ea6`,
`--bg-card`, `--text-dark`, `--border`, `--radius`, `--shadow-lg`) y un **reset `* { margin:0; padding:0 }`**.
Un `<style>` insertado por `innerHTML` aplica a TODO el documento, así que mientras el submódulo estaba
abierto la app entera heredaba esos nombres genéricos (mismo patrón del portal de EMO, 📦766).

**Fix (doble candado):**
1. El portal se reescribió como **fragmento** con TODO bajo `.rm-portal-scope` (el `*` quedó como
   `.rm-portal-scope *`), sin `:root`. Los tokens locales (`--rmp-*`) mapean a `--kair-*` con respaldo.
2. En `render()` se **sanitiza** el HTML antes de inyectarlo:
   `html.replace(/<link[^>]*>/gi, '')` (los `<link>` del portal cargaban CDNs en global). Se eliminaron
   los CDN de Font Awesome y Bootstrap Icons (los iconos ahora son **SVG inline**).

Verificado con un arnés de Electron: tras inyectar el portal, `--primary`, `--bg-card` y `--text-dark`
del `documentElement` quedan **vacíos** (antes los pisaba).

### Portal premium

- Breadcrumb + icon chip + título Manrope 800 + botón "Volver al Menú".
- 2 acciones principales (Ver Remisiones = card primaria con gradiente azul; Enviar = card con icono verde).
- 4 tarjetas de herramientas (Control, Estadísticas, Exportar, Configuración) con iconos SVG.
- **Contenido centrado** en pantallas anchas: `.rm-portal { max-width: 1120px; margin: 0 auto; }`.
  En maximizada (1920px) antes quedaba pegado a la izquierda (tenía el `max-width` SIN centrar);
  verificado con un arnés que mide el hueco izquierdo/derecho (392px y 392px a 1904px de host).
- Modo oscuro para `[data-theme="dark"]` y `[data-theme="dark-legacy"]`.
- Cache-bust en el `fetch` del HTML y en el `<script>` del home (`?v=REM-20260919-v2-portal-premium`).

### Visor e informe: remapeo de tokens (iframe aislado)

Ambos viven en `<iframe>`, así que sus `:root` están aislados. Se aplicó la **técnica de remapeo de
tokens** (📦751) en vez de reescribir reglas:
- **Visor** (`remisiones-view.css`): `--kair-primary #174ea6 → #2057b8`, `--kair-bg-app #f8f9fa → #fbfcfb`,
  texto `#1a1a2e → #14213d`, borde `#dee2e6 → #e8ebee`, fuente Roboto → **DM Sans**; el bloque oscuro pasó
  a la paleta premium (`#0f172a`/`#1a2334`/`#6ea8fe`). Se reemplazaron los 3 hex sueltos que quedaban
  (`rgba(77,166,255)` y el gradiente del skeleton). Se agregó el `<link>` de DM Sans + Manrope y cache-bust.
- **Informe** (`generar-informe-remision.css`): `--env-*` remapeados a premium; **se agregó modo oscuro**
  (no tenía) para los dos atributos; el header tenía colores **en línea** hardcodeados
  (`#ffffff`, `#dee2e6`, `#174ea6`, `#1a1a2e`) → tokenizados a `var(--env-*)` para que sigan el tema;
  el icono de empresa `kair-icon-building` (clase de `styles.css`, no disponible en el iframe) → SVG inline;
  fuente Roboto/Lexend → DM Sans/Manrope; cache-bust en el `<link>` y en la URL del iframe.
- **Alineación del informe (paso 3)**: el header tenía el **título pegado al borde izquierdo** mientras
  `.env-body` iba **centrado a 900px** → se veía desalineado de arriba a abajo. Se envolvió el contenido
  del header en **`.env-header-inner`** con el MISMO `max-width: 900px; margin: 0 auto; padding: 0 1.5rem`
  del cuerpo, así el título, el stepper y las tarjetas comparten los mismos bordes. Medido a 1904px de
  ancho: antes el título estaba en `x=81` y la tarjeta en `x=526`; ahora el stepper y la tarjeta quedan
  ambos en `x=526` (852px de ancho). **Regla**: cuando un header y su contenido no comparten contenedor,
  darles el mismo `max-width` + `margin: 0 auto` (y el mismo padding) para que los bordes coincidan.

### Cache-bust

- Portal: `?v=REM-20260919-v2-portal-premium` (fetch HTML + script home).
- Visor: `remisiones-view.css?v=REM-20260919-v2-premium` + `&v=REM-20260919-v2-premium` en la URL del iframe.
- Informe: `generar-informe-remision.css?v=REM-20260919-v2-premium` + `&v=…` en la URL del iframe.

### Verificación

- `node main/test-remisiones-v2.js` → **62/62 OK** (se agregaron 19 checks de portal/visor/informe).
- Arnés de Electron: portal sin fuga + claro/oscuro; visor con `--kair-primary #2057b8`; informe con
  `--env-primary #2057b8` (claro) y `#6ea8fe` (oscuro).
- ⚠️ **Nota del arnés**: el informe no se puede cargar con `loadFile` cuando el `<head>` tiene los CDN y
  no hay red (Electron rechaza con `ERR_FAILED`); para verificarlo se copia el HTML al módulo quitando
  los `<link>` con `https?` (conservando el CSS local) y se borra al terminar.

### Limpieza de código muerto (mismo 📦775)

El módulo tenía **9 archivos muertos** y ~600 líneas de código huérfano en el `logic.js`:

| Archivo | Por qué estaba muerto |
|---------|----------------------|
| `enviar-remision.html` / `.js` / `.css` | reemplazados por `enviar-remision-v2.*` |
| `control-remisiones.css` | su loader `_loadControlStyles()` **nunca se llamaba** |
| `restricciones-view.html` / `.css` / `restricciones-viewer.js` | 0 referencias (el visor real es `remisiones-view.*`) |
| `restricciones-component.js` | apuntaba a `restricciones-viewer.html` (archivo inexistente); solo lo listaba jsdoc |
| `index.js` | requería el `logic` (que **no** tiene `module.exports` y usa `window`) y nadie lo cargaba |

- **Métodos huérfanos del `logic.js`** (19, ~600 líneas): la cadena del explorador viejo
  (`showVerRemisionesPage` + `navigateToInitialPath`/`navigateToPath`/`updateNavBar`/`displayItems`/`previewDocument`),
  los helpers del flujo viejo (`createFileSelectionBox`/`createActionsBox`/`createDataDisplayBox`/`createLogBox`
  + `processSelectedPdf`/`displayExtractedData`/`handleGeneration`/`handleSendWhatsApp`/`handleSendEmail`),
  `createModernHeader`, `createHeader`, `_loadControlStyles` y `saveCellData`. Se eliminaron con un script que
  localiza la firma y **balancea llaves** (el `logic.js` pasó de ~1300 a 798 líneas, −37 %).
  Se verificó que ningún método vivo los llamara y que los nombres homónimos de otros módulos son independientes.
- **`modules/gestion-salud/index.js`**: se quitó el `require('./restricciones-medicas')` (ya no existe el `index`).
- **`jsdoc.json` + `scripts/generate-docs.js`**: se quitaron `restricciones-component.js` y `restricciones-viewer.js`.
- **Verificación**: `node --check` OK; `test-remisiones-v2.js` 62/62; y un **smoke funcional con Electron**
  (portal renderiza con sus 6 tarjetas → monta Enviar v2 → monta Control v2 → vuelve al portal, **0 errores de consola**).
- **Regla**: al migrar una pantalla, borrar los archivos que reemplaza y sus loaders. Un loader de CSS
  (`_loadControlStyles`) que nadie llama deja el `.css` huérfano y es fácil de pasar por alto.

### Pendiente

- El **portal** y el **visor** todavía cargan CDN (Google Fonts). Deuda offline conocida, igual que los
  viewers EMO. El **informe** que también cargaba CDN se eliminó en 📦776.
- El visor ya era `kair-*` v2.0 (jul-2026) con dark mode; solo se le remapearon los colores. Si se quiere
  el Header System v2 completo (icon chip + Manrope 800), es una pasada aparte.

---

## 🆕 Enviar Remisión · Flujo completo en UNA interfaz (📦776, 2026-09-19)

El flujo de **Enviar Remisión** (3.1.6) se veía como **dos pantallas distintas**: el componente premium
`enviar-remision-v2` (paso 1 "Cargar PDF") redirigía —tras extraer los datos— a la página vieja
`generar-informe-remision.html` (otro diseño, con su propio stepper de 4 pasos) y luego a un modal de
envío legacy (`env-modal.css`). El usuario pidió **continuidad y homogeneidad**.

### Qué se hizo

Se movieron los 3 pasos DENTRO del componente premium, con su track de 3 pasos:

| Paso | Acción | API directa (sin bridge) |
|------|--------|--------------------------|
| 1 · Cargar PDF | selecciona y procesa el PDF | `selectPdfFile` + `processRemisionPdf` |
| 2 · Generar informe oficial | muestra los datos extraídos y genera el documento | `generateRemisionDocument(extractedData, empresa)` |
| 3 · Enviar a la EPS | WhatsApp / correo con los contactos de la base | `getContactInfo(cedula, empresa)` + `sendRemisionByWhatsapp` / `sendRemisionByEmail` |

- El componente **ya no redirige**: `#mostrarPaso(n)` alterna las tarjetas (PDF / datos / enviar) y el
  track marca el progreso. Se eliminó el callback `onNavigateToInforme`.
- Como es un componente **embebido** (no iframe), llama a `window.electronAPI.*` **directo** — no usa el
  bridge de `postMessage`.
- **Vista previa ANTES de enviar** (buena práctica): el paso 3 abre con un panel "Vista previa del informe
  oficial" que muestra el nombre del documento, un resumen de los datos clave (trabajador, cédula, fecha,
  cargo) y un botón **"Ver informe"** que abre el `.docx` generado en el visor
  (`window.kairFV.openWithFileViewerFromPath(documentPath)`, con respaldo en `electronAPI.openPath`). Así
  el usuario corrobora el documento antes de elegir WhatsApp/correo.
- **Cancelar con confirmación**: en los pasos 2 y 3 el header muestra un botón **"Cancelar"** que abre un
  diálogo de confirmación; al confirmar, el componente limpia su estado (`extractedData`, `documentPath`,
  contactos) y vuelve al paso 1 **sin borrar los archivos ya generados**. El botón se oculta en el paso 1
  (no hay nada que cancelar) y el diálogo también se cierra al hacer clic en el fondo o en "Seguir".

### Limpieza

- **Borrados**: `generar-informe-remision.html/.js/.css` (la página vieja) y `env-modal.css` (el modal).
- **`logic.js`**: fuera `showGenerarInformePage`, `_renderSendOnlyPage`, `_loadContactInfo`,
  `_handleModalWhatsApp`, `_handleModalEmail`, `_closeSendModal`, `_loadModalStyles` y los 9 casos del
  bridge del flujo viejo (`select-pdf-file-request`, `process-remision-pdf-request`,
  `generate-remision-doc-request`, `send-remision-whatsapp-request`, `send-remision-email-request`,
  `informe-data-request`, `back-to-verify-request`, `continue-to-send-request`,
  `navigate-to-generar-informe-request`). Se **conservaron** los handlers del visor (preview, carpetas,
  descarga, `back-to-module-request`). El `logic.js` quedó en **~19 KB** (venía de ~60 KB).
- El módulo quedó con **10 archivos**, todos en uso.

### Verificación

- `node main/test-remisiones-v2.js` → **59/59 OK** (los checks del flujo viejo se reemplazaron por los del
  flujo nuevo: 3 pasos, `generateRemisionDocument`, `sendRemisionByWhatsapp/Email`, `getContactInfo`).
- **Smoke funcional con Electron** del flujo completo: clic en la zona de carga → paso 2 (6 campos
  extraídos, track en "Generar informe oficial") → "Generar Informe Oficial" → paso 3 (track en
  "Enviar a la EPS", contactos cargados) → clic en WhatsApp → enviado. **0 errores de consola.**
- Cache-bust: `?v=REM-20260919-v2-flujo-completo` en `logic.js` + `enviar-remision-v2.*`.

### Regla

Si un componente tiene un **track de pasos** pero delega los siguientes a **otra pantalla**, el usuario
verá un salto de diseño. La solución es traer todos los pasos al mismo componente (o replicar el mismo
Header/stepper/dialecto en la pantalla destino). Acá se eligió lo primero.

---

## 🆕 Control de Remisiones · filas basura del Excel (📦778, 2026-09-19)

El Control de Remisiones mostraba **18 "registros"** cuando en realidad había **8**. La causa estaba en el
archivo real `GI-FO-012 CONTROL DE REMISIONES.xlsx`: la hoja trae **una copia del encabezado en la fila 6**
(después de la primera tanda de datos) y **9 filas vacías** (7-15) antes de la segunda tanda.

- El handler `get-control-remisiones-data` (`main.js`) tomaba `allData[0]` como encabezados y
  `allData.slice(1)` como datos → el encabezado repetido aparecía como **fila de datos** (resaltada por
  `tbody tr:nth-child(even)`) y las filas vacías engordaban los KPIs (Pendientes).
- **Fix (backend)**: al leer se **normalizan** las filas (pad/truncate a las columnas del encabezado) y se
  **descartan** las filas vacías y las que repiten el encabezado. Log: `Filas de datos válidas: N
  (descartadas: X vacías, Y encabezados repetidos)`.
- **Fix crítico asociado**: al descartar filas, el **índice** de la fila ya no coincide con la **fila
  real** del Excel, y el guardado de la última columna (`updateExcelCell` con dirección A1) habría
  escrito en la fila equivocada. El backend ahora devuelve **`rowNumbers`** (nº de fila real, 1-based,
  por cada fila válida) y el componente lo usa para armar la dirección (`U17` en vez de `U7`).
- **Verificación**: contra el Excel real → 18 → **8 filas** (9 vacías + 1 encabezado descartados);
  KPIs `8 / 8 / 0`; mapeo `rowNumbers` correcto (la 6ª fila válida es la fila 17 del Excel). Test `65/65`.

### Regla

Un Excel "de control" puede tener **encabezados repetidos** y **filas vacías** en el medio (copiar/pegar,
bloques separados). Al leerlo para una tabla, **filtrar la basura en el backend** — y si se filtra,
devolver el **número de fila real** para que las escrituras por celda (A1) no se desalineen.

---

## 🆕 Estadísticas de Remisiones · nueva sección (📦779, 2026-09-19)

El card "Estadísticas de Remisiones" del portal 3.1.6 era un **placeholder** ("Próximamente"). Ahora es una
pantalla real que **deriva sus métricas del Control de Remisiones** (mismo origen: `getControlRemisionesData`
→ Excel `GI-FO-012`). No hay datos nuevos: se calcula sobre las filas del control.

### Métricas

- **KPIs**: total de remisiones, con seguimiento (última columna no vacía, igual que el Control), pendientes
  y **edad promedio**.
- **6 gráficos**: por sexo (donut SVG + leyenda), por tipo de evaluación (barras), por rango de edad
  (columnas `<30/30-39/40-49/50-59/60+`), por concepto médico laboral (barras), top cargos (barras, top 6)
  y por estado civil (barras).
- **Nota al pie**: cuántas remisiones se analizaron y cuántas no tienen fecha de atención.

### Decisiones

- **Normalización de valores** (`#normSexo`, `#normEval`, `#normConcepto`, `#normCivil`): el Excel real trae
  valores inconsistentes (`Masculino`/`MASCULINO`, `INGRESO`/`EVALUACIÓN MÉDICA DE INGRESO`,
  `Soltero(a)`/`SOLTERO(A)`/`SEPARADO PARENTESCO: NINGUNO`). Sin normalizar, cada variante sería una
  barra distinta.
- **Barras como cajas HTML** (lección 📦758): nunca SVG estirado. El donut sí es SVG (proporción fija).
- **Mismo dialecto premium v2** (`.remstat-scope`, tokens canónicos, dark en los 2 atributos), coherente
  con Enviar y Control.
- **Sin series por mes**: 5 de 8 remisiones no tienen "Fecha de Atención" en el Excel, así que una serie
  temporal saldría casi vacía. Se muestra la nota y se omite ese gráfico.

### Verificación

- Arnés de Electron con el Excel real: KPIs `8 / 8 / 0 / 47 años`, 6 gráficos (donut 2, eval 4, edad 5,
  concepto 2, cargos 6, EPS 3), claro y oscuro, **0 errores de consola**.
- Test `main/test-remisiones-v2.js` → **77/77 OK** (12 checks nuevos de Estadísticas).

### Archivos

- `estadisticas-remisiones-v2.js` + `.css` (nuevos), `restricciones-medicas-logic.js`
  (`showEstadisticasRemisionesPage`), `restricciones-medicas-home.html`/`.js` (`rmEnterEstadisticas`),
  `index.html` (CSS+JS con cache-bust `REM-20260919-v3-estadisticas`).

---

## 🆕 Investigación de Accidentes e Incidentes · Premium v2 (📦780, 2026-09-19)

El submódulo **3.2.2** (`modules/gestion-salud/investigacion-accidentes/`) tiene **3 vistas**, todas
montadas como **iframe** desde `investigacion-accidentes-logic.js`: el portal (`investigacion-home.html`),
"Realizar Investigación" (`investigacion-accidentes-view.html`) y "Ver Investigaciones"
(`investigaciones-view.html`). Se migraron las 3 al premium v2.

### 🚨 La fuga global más grave hasta ahora

`investigacion-accidentes-view.css` estaba linkeada **DOS veces**: dentro de su iframe (correcto) **y en
`index.html`** (línea 24). Esa copia global traía:

- `html, body { margin:0; height:100vh; overflow:hidden }` → forzaba el layout de TODA la app.
- `body { display:flex; flex-direction:column }` → global.
- `:root { --inv-* }` → global.
- `.k-section-card { … }` **sin scope** → afectaba a los ~20 módulos que usan esa clase genérica.

**Fix**: se **quitó el `<link>` global** de `index.html` (el iframe ya carga la hoja). Verificado con `rg`
que ningún elemento del app principal usa clases `inv-*` y que `styles.css` no define `.k-section-card`.

### Portal premium

- Marcado bajo `.inv-portal-scope` (sin `:root` ni `*` globales).
- Header System v2 (breadcrumb + icon chip + título Manrope + subtítulo + Volver).
- 2 KPI (Pendientes / Completadas) + 2 acciones principales + 4 herramientas, iconos SVG inline (sin CDN).
- Modo oscuro para `dark` y `dark-legacy`.

### Realizar / Ver: tokens + Header v2 + dark

- **Tokens** remapeados a la canónica (`#2057b8`, `#fbfcfb`, `#e8ebee`, DM Sans + Manrope, radios 12/16/20).
- **Header System v2** reemplazó el `k-section-card` viejo; los botones (`Visualizar/Imprimir/Volver`,
  `Actualizar/Volver`) conservan sus ids y pasaron a SVG inline (el botón Actualizar rota su SVG con la
  clase `fa-spin` que el JS ya agregaba → se define la animación `inv-btn-spin`).
- **Modo oscuro**: se usó el selector **`[data-theme^="dark"]`** (cubre `dark` Y `dark-legacy`) en TODO el
  CSS de las dos vistas (truco 📦773). En "Ver" la vista solo tenía 9 reglas oscuras (el header) → se
  agregó el bloque completo de tokens oscuros.
- **Bug de modo oscuro**: la card "Configuración" (`.inv-combined-left`) tenía `background:#fafbfc` +
  `[data-theme="dark"]` (sin `dark-legacy`) → quedaba blanca con el tema oscuro manual. Corregido.
- **Tipografía**: el header v2 vive FUERA de `.inv-layout` (que declaraba la fuente) → se movió
  `font-family: var(--inv-font-body)` al `body`.

### Cache-bust

- `index.html` → logic.js con `?v=INV-20260919-premium`.
- `logic.js` → las **4 URLs de iframe** con `&v=INV-20260919-premium`.
- Las 2 hojas y los 2 scripts de las vistas con `?v=INV-20260919-premium`.

### 📦781 — Aprovechar el ancho en maximizada

En **"Ver Investigaciones"** el contenido quedaba **centrado a 1200px** (`.inv-body { max-width:1200px;
margin:0 auto }`): a 1900px de ventana se perdían **~350px por lado**. Ahora:

- `.inv-body` → `max-width: none; margin: 0` + padding proporcional `clamp(14px, 1.6vw, 26px) clamp(14px, 1.8vw, 34px) 32px`.
- El buscador (con `flex:1` se estiraba a **~1300px**) → `max-width: clamp(340px, 30vw, 640px)`.
- El toggle de vista (grid/lista) → `margin-left: auto` (al extremo derecho de la barra).
- La vista **"Realizar" ya usaba todo el ancho** (su contenedor `.inv-main-wrapper`/`.inv-main-scroll` no tiene `max-width`); no se tocó.
- **Regla** (📦769): un `max-width` + `margin:0 auto` en el contenedor de contenido es una decisión de
  diseño que **desperdicia el ancho** en maximizada. Medir `getBoundingClientRect()` contra
  `window.innerWidth` antes de dejarlo.

### 📦782 — Lista en DOS columnas en maximizada

En "Ver Investigaciones" el modo **lista** (el que se ve por defecto; el botón muestra el icono
`fa-th-large` = "cambiar a cuadrícula") ponía las tarjetas a **todo el ancho** (~1884px con la ventana a
1900px), con muchísimo espacio vacío a la derecha. Ahora, **solo en maximizada**, la lista pasa a
**2 columnas**:

- `.inv-cards-list:not(.inv-cards-grid)` dentro de `@media (min-width: 1360px)` →
  `display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem 1rem; align-items: start`
  y las tarjetas pierden su `margin-bottom: 0.75rem`.
- **"Solo este modo"**: la vista de **cuadrícula** (`.inv-cards-grid`, `auto-fill minmax(340px,1fr)`)
  **NO se tocó** — verificado: a 1900px sigue dando sus 5 columnas de 350px.
- **Estado vacío y esqueleto**: al volverse grilla, `.inv-empty` y `.ks-list` (`KairSkeleton.list()`
  devuelve **UN** wrapper con N items) habrían quedado **a media columna**. Ahora llevan
  `grid-column: 1 / -1` (vale también para la cuadrícula, donde era un bug preexistente).
- **Medido** con un arnés de Electron (copia temporal del HTML sin los `<link>` de CDN): 1900px →
  `display:grid`, `cols: 900.09px 900.09px`, tarjetas lado a lado, `margin-bottom:0`; 1200px →
  `display:block`, 1 columna, `margin-bottom:12px`; vacío a 1900px → 1816px = ancho de la lista.
- **Regla**: para "N columnas solo cuando hay espacio" usar una **media query**, no `auto-fit` (en
  pantallas ultra anchas daría 3+ columnas). Y al convertir un contenedor a grilla, revisar **todos**
  sus hijos que no sean tarjetas (estados vacíos, esqueletos, avisos) y darles `grid-column: 1 / -1`.
- **Umbral**: `1360px` (cada columna ≈ 640px). Si en otra pantalla "maximizado" no alcanza, se ajusta
  ese número en la media query.

### 📦783 — Registro y Análisis Estadístico (3.2.3) al premium v2

El submódulo **3.2.3** (`modules/gestion-salud/registro-estadistico/`) es una tabla de 19 columnas
(paginada, filtrable, ordenable) + un tablero con 8 KPIs, 3 indicadores SG-SST (IFA/IG/PA), panel de
alertas, **9 gráficos Chart.js**, 2 tablas Top 5 y recomendaciones automáticas.

#### Cómo se monta (NO es iframe) — y su riesgo de fuga

`renderer.js#showRegistroEstadisticoContent` hace **`fetch` del HTML** y lo inyecta con
`container.innerHTML = doc.body.innerHTML` en el **documento PRINCIPAL**; el CSS se appendea al
`<head>` **global** y el JS también. O sea: el CSS de este módulo queda activo en TODA la app
mientras esté abierto (misma clase de riesgo que el portal de EMO 📦766 y el de Remisiones 📦775).

#### 🚨 Lo que se arregló: 2 clases GLOBALES de otros módulos

El header era una `.k-section-card` (clase que usan **~20 módulos**) y el botón usaba
`.header-back-btn`; el CSS definía `.kair-s323 .k-section-card { background:#ffffff; … }`. Eso
acoplaba este módulo con una clase compartida. Se reemplazó por un **Header System v2 propio**
(`.kair-s323-header-v2`, `.kair-s323-header-icon`, `.kair-s323-title`, `.kair-s323-btn`) y se
**borraron** esas reglas → el módulo ya no define ninguna clase genérica de otro módulo.

Además se scopearon las reglas que quedaban sueltas (`.k-spinner`, `.k-btn-sample`, `.k-action-btns`,
`.k-btn-action`, `.k-dash-actions`) y se renombraron los `@keyframes` globales
(`kSpinnerRotate`→`kairS323Spinner`, `kFadeIn`→`kairS323FadeIn`, `kSlideUp`→`kairS323SlideUp`).

#### Estrategia: remapeo de tokens conservando los NOMBRES

El JS escribe **estilos en línea** con `var(--k-text-muted)`, `var(--k-primary)`, etc. Por eso **no**
se renombraron los tokens: se conservaron los nombres `--k-*` y **solo se cambiaron los valores** a
la paleta canónica (`#2057b8` / `#14213d` / `#748096` / `#e8ebee` / `#fbfcfb`, DM Sans + Manrope).
Así los estilos en línea que genera el JS siguen funcionando sin tocar el JS.

- Se agregó `--k-radius-card: 20px` (los controles quedan en `--k-radius: 12px`) y se aplicó a
  tarjetas, toolbar, tabla, filtros y KPI cards.
- `--k-font` pasó de `'Segoe UI'` a `'DM Sans'`; los títulos usan `--k-font-display` (Manrope 800).

#### Chips y estados: `color-mix` en vez de 13 hex duplicados

Los badges (13 variantes), los estados SG-SST y las alertas tenían fondos hex fijos que se veían
mal en oscuro. Ahora el fondo **se deriva del color del texto**:

```css
.kair-s323-badge { background: color-mix(in srgb, currentColor 12%, transparent); }
```

y cada variante solo declara `color`. Sirve igual en claro y en oscuro sin duplicar reglas.

#### Modo oscuro: los DOS atributos con UN selector

Se reemplazó el bloque `[data-theme="dark"]` (que solo cubría el tema Sistema) por
**`[data-theme^="dark"]`**, que matchea `dark` **y** `dark-legacy` (el Oscuro manual).
⚠️ **Detalle que hay que recordar**: en oscuro `--k-primary` es un azul **claro** (`#6ea8fe`, para
que se lea como texto sobre fondo oscuro), así que **las superficies que usan `--k-primary` como
FONDO** (botón primario, cabecera del modal, badge de período, número de las recomendaciones,
paginación activa) necesitan un azul **oscuro** (`#2f5fa8`) o el texto blanco no se leería. Están
listadas en una sola regla agrupada.

#### Los 9 gráficos siguen el tema

Los datasets usaban la paleta vieja (`#174ea6`, `#28a745`…) y Chart.js no tenía colores de eje
propios → en oscuro los ejes quedaban grises sobre fondo oscuro. Ahora, al inicio de `renderCharts`:

```js
const _isDark = (document.documentElement.getAttribute('data-theme') || '').indexOf('dark') === 0;
Chart.defaults.color = _isDark ? '#98a6bf' : '#748096';
Chart.defaults.borderColor = _isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,33,61,0.08)';
Chart.defaults.font.family = "'DM Sans', system-ui, -apple-system, sans-serif";
```

(Chart.js usa esos defaults globales para ticks, leyenda y rejilla, así que con 4 líneas quedan los
9 gráficos alineados.) **Limitación conocida**: los colores se fijan al **renderizar** el tablero, así
que cambiar el tema con el tablero ya abierto no repinta los gráficos. En el flujo real no pasa: el
tema lo aplica `theme-manager.js` al arrancar, antes de que el módulo se cargue.

#### Verificación

- `node tests/registro-estadistico/test-premium.js` → **24/24 OK** (header v2, los **49 ids** del
  contrato con el JS, paleta canónica, cero selectores sueltos, cero `.k-section-card`, dark en los
  dos atributos, `color-mix`, keyframes con prefijo y los cache-bust).
- Arnés de Electron (con `window.Chart` simulado, porque el CDN no está offline): claro →
  `#fbfcfb` / `#2057b8` / tarjeta `20px` / título Manrope 800 20px; `dark` y `dark-legacy` → idénticos
  (`#0f172a` / `#6ea8fe` / `#1a2334`); pestaña Tablero → **8 KPIs, 3 SG-SST, 21 alertas, 2 Top 5,
  6 recomendaciones y los 9 gráficos** con sus ids; badge de período en oscuro → `#2f5fa8`;
  **0 errores de consola**.
- Cache-bust: token `RES-20260919-v1-premium` en el CSS, el HTML, el JS y el guard del `<link>`.
- ⚠️ **EOL**: el directorio es `i/lf w/crlf`. Al tocar los 3 archivos el diff salió de **miles de
  líneas**; se normalizaron a **LF** y el diff bajó a 246/147 (CSS), 29/18 (HTML) y 20/13 (JS).
  Mismo gotcha de 📦773.

#### Regla

Si un módulo se monta con `innerHTML` en el documento principal, **revisar qué clases GLOBALES usa
su HTML** (`.k-section-card`, `.header-back-btn`, `.card`, `.modal`, `.badge`…): mientras el módulo
esté abierto, su CSS puede redefinirlas para toda la app. Reemplazarlas por clases propias del módulo.

### 📦784 — Frecuencia de la Accidentalidad (3.3.1) al premium v2

El submódulo **3.3.1** (`modules/gestion-salud/frecuencia-accidentalidad/`) tiene una tabla mensual
**editable** (12 filas × AT/Trabajadores, se guarda al confirmar con Enter/blur), 5 KPIs, tarjeta de
meta, un **gráfico SVG nativo** (12 barras + línea de meta), 12 tarjetas de mes, 4 colapsables con
barras de progreso, la referencia del indicador y la metodología.

#### 🚨🚨 La fuga más grave de la serie: `:root` + `*` + `body` GLOBALES

`renderer.js#showFrecuenciaAccidentalidadContent` monta el módulo con `fetch` + `innerHTML` en el
**documento PRINCIPAL** y appendea su hoja al `<head>` **global**. Esa hoja traía:

1. **`:root { --kair-primary, --kair-card, --kair-text, --kair-shadow, … }`** → sobrescribía tokens
   de `shared/kair-design-tokens.css` (`--kair-card`, `--kair-text` y `--kair-shadow` chocaban por
   NOMBRE EXACTO). Como el `:root` del módulo va después en la cascada, **podía dejar el tema oscuro
   en blanco** mientras el módulo estaba abierto.
2. **`* { box-sizing; margin:0; padding:0 }`** → **borraba los márgenes y rellenos de TODA la app**.
3. **`body { overflow:hidden; height:100% }`** → forzaba el layout de la ventana completa.
4. **~60 clases `.kair-*` sin scope** (`.kair-card`, `.kair-kpi`, `.kair-table`, `.kair-btn`,
   `.kair-badge`, `.kair-empty`, `.kair-toast`, `.kair-input`, `.kair-progress-*`, `.kair-collapsible*`,
   `.kair-month-card*`, `.kair-target-*`, …) que **chocan** con `shared/kair-components.css`,
   `shared/kair-premium.css` y `styles.css` (p. ej. el `.kair-kpi` del módulo imponía
   `text-align:center` a los `.kair-kpi` premium de otros módulos).

#### Cómo se arregló

1. **Tokens propios `--freq-*`** (renombrados los 104 usos) y movidos de `:root` a
   `.frecuencia-container`. Se conservaron los NOMBRES originales solo cambiando el prefijo, y los
   valores se remapearon a la paleta canónica (`#2057b8` / `#14213d` / `#748096` / `#e8ebee` /
   `#fcfbfb`, DM Sans + Manrope, radios 20px tarjeta / 12px control).
2. **Reset scoped**: `*` → `.frecuencia-container, .frecuencia-container *` (box-sizing) y
   `.frecuencia-container *` (margin/padding). `body` → se fusionó en la regla del contenedor.
3. **139 selectores scopados** bajo `.frecuencia-container` con un script. ⚠️ **Ojo con los
   selectores MULTILÍNEA**: un script que solo mira líneas que terminan en `{` deja la PRIMERA línea
   de un selector partido sin scopar (pasó con `.kair-table thead th,` dentro de 2 `@media`). Hay que
   verificar con una búsqueda de selectores sueltos, no confiar en el script.
4. **Header System v2** propio (`.freq-header-v2`, `.freq-header-icon`, `.freq-title`, `.freq-btn`,
   `.freq-select`) y se **borraron** las reglas `.k-section-card` / `.header-back-btn` /
   `.header-action--ghost`.
5. **`@keyframes` renombrados**: `pulse`→`freqPulse`, `slideIn`→`freqSlideIn` (eran nombres globales).
6. **Modo oscuro con `[data-theme^="dark"]`** (antes solo `[data-theme="dark"]`, así que el tema
   Oscuro manual quedaba claro) + el detalle de que las superficies con acento de FONDO necesitan la
   versión oscura del acento (`#2f5fa8`) para que el texto blanco se lea.

#### El gráfico (y las celdas) ahora leen la paleta

Todos los colores del gráfico SVG, de la tabla, de las tarjetas de mes y de las barras de progreso
estaban **hardcodeados en el JS** (`#174ea6`, `#28a745`, `#ffc107`, `#dc3545`, `#6c757d`, `#212529`…)
y no seguían ni la paleta ni el tema. Ahora hay 2 helpers:

```js
function tok(name, fallback) {           // lee un token CSS del módulo
  var host = document.querySelector('.frecuencia-container') || document.documentElement;
  return getComputedStyle(host).getPropertyValue(name).trim() || fallback;
}
function palette() { return { bg: tok('--freq-bg','#fbfcfb'), danger: tok('--freq-danger','#da5563'), … }; }
```

y `renderChart` / `renderTabla` / `renderColapsables` / `renderMonthCards` hacen `var C = palette();`
al entrar (se relee en cada render, así sigue el tema).

⚠️ **Nota sobre SVG**: `fill="var(--x)"` como ATRIBUTO no es confiable; por eso se lee el valor con
`getComputedStyle` y se concatena el color ya resuelto.

#### Limpieza

- **Código muerto eliminado**: `buildGridLines()` y `buildChartPoints()` (nunca se llamaban) y
  `escapeHtml()` (solo lo usaba el anterior).
- **Iconos**: el header usaba `bi bi-copy` / `bi bi-arrow-clockwise` de Bootstrap Icons, cuyo
  `<link>` vive en el `<head>` del HTML… que **se descarta** al inyectar solo `doc.body.innerHTML` →
  **nunca renderizaban**. Ahora son SVG inline.
- El SVG del gráfico ganó `display:block` (evita el hueco de línea base). Mantiene `height:auto`
  porque su contenedor usa `min-height` (no alto fijo), así que no aplica el riesgo de 📦757.
- El cache-bust del `<script>` pasó de `?_t=Date.now()` (rompía toda cache) a `?v=TOKEN`.

#### Gráfico y tabla en PARALELO en maximizada

En maximizada el gráfico ocupaba todo el ancho y la tabla quedaba debajo. Ahora, en
`@media (min-width: 1360px)`, `.freq-duo` (que envuelve las 2 tarjetas en el HTML) usa
`grid-template-columns: minmax(0,1fr) minmax(0,1fr)` → **gráfico y tabla lado a lado**. En ventanas
normales van uno debajo del otro (`grid-template-columns: 1fr`).

Detalle fino: la tabla mide ~773px de alto y el gráfico ~382px, así que con `align-items: start`
quedaba un hueco visible debajo del gráfico. Las tarjetas del `duo` se volvieron
`display:flex; flex-direction:column` con `.kair-chart-container { flex: 1 }` para que **se estiren
al mismo alto** y el gráfico se centre en el espacio libre **sin deformarse** (el SVG conserva su
proporción por el `viewBox` + el `preserveAspectRatio` por defecto, que lo escala para encajar).
Medido: a 1600px las 2 tarjetas miden 773px de alto; a 1200px vuelven a su alto natural (508 / 773)
apiladas.

**Regla**: al poner 2 tarjetas de contenido en paralelo, decidir explícitamente qué pasa con el
alto — `align-items: start` deja huecos si los contenidos difieren mucho; `stretch` + `flex: 1` en
el hijo que debe crecer da tarjetas alineadas.

**Y la tabla tiene que ENTRAR COMPLETA en su columna**: con `white-space: nowrap` en el `th`, el
ancho **mínimo** de la tabla era **836px** (los encabezados "Trabajadores" e "Índice Frecuencia" no
podían partir), así que en la columna de ~800px del layout en paralelo la última columna (**Estado**)
quedaba cortada y aparecía **scroll horizontal** — el usuario lo reportó con captura. Con
`white-space: normal` + `line-height: 1.2` en el `th` el mínimo bajó a **≤620px** y la tabla entra
completa (medido: a 620/660/700/740/780/820/900px NO desborda, y el encabezado sigue en **una** línea
de 40px porque las palabras caben). **Regla**: si una tabla va a vivir en una columna, su `th` no
puede llevar `nowrap`; hay que medir el `scrollWidth` contra el `clientWidth` a varios anchos.

**Y después el usuario pidió ANCHOS FIJOS en maximizada** (que la tabla no se reparta según el
contenido): dentro del mismo `@media (min-width: 1360px)` se agregó `table-layout: fixed` +
`width` por columna (`th:nth-child(n)`) más `overflow:hidden; text-overflow:ellipsis` en `th`/`td`
como red. Reparto final (**suma exacta 100%**): **Mes 10% · AT 8% · Trabajadores 24% ·
Índice Frecuencia 28% · Meta 8% · Estado 22%**. Medido (con **0 celdas recortadas** y sin desborde):

| Pantalla | Ancho tabla | Mes | AT | Trabajadores | Índice Frecuencia | Meta | Estado |
|---|---|---|---|---|---|---|---|
| 1920 (vw 1904) | 845px | 84.50 | 67.59 | 202.80 | 236.61 | 67.59 | 185.95 |
| 1900 (vw 1884) | 835px | 83.53 | 66.83 | 200.50 | 233.92 | 66.83 | 183.84 |
| 1760 (vw 1744) | 768px | 76.81 | 61.45 | 184.38 | 215.11 | 61.45 | 169.05 |
| 1600 (vw 1584) | 691px | 69.14 | 55.31 | 165.94 | 193.59 | 55.31 | 152.16 |
| 1440 (vw 1424) | 615px | 61.45 | 49.16 | 147.50 | 172.11 | 49.16 | 135.27 |

Por debajo de 1360px vuelve a `table-layout: auto` (la tabla se apila y ocupa todo el ancho).

⚠️ **Gotcha de los porcentajes con `table-layout: fixed`**: si los 6 `width` **no suman 100%**, el
sobrante se reparte proporcionalmente y los anchos reales NO son los declarados (p. ej. con
8.5/10/19/22/12/20 = 91.5% la columna AT terminó midiendo 92px en vez de 84px). Dejar la suma en 100.
⚠️ **Gotcha de la simulación**: el arnés usaba los meses COMPLETOS ("Septiembre") y reportaba
recortes que en la app no existen, porque el Excel trae las **3 letras** (ENE, FEB, SEP…). Verificar
el dato real antes de "arreglar" un ancho por un recorte que no ocurre.
⚠️ **Límite real**: el badge automático (🤖, que marca un mes con AT contado desde la caracterización)
necesita ~58px, así que con AT por debajo de 8% se recorta en ventanas de ≤1600px (en maximizada no).

⚠️🚨 **Lección de cache-bust — son DOS niveles y costó 2 rondas de validación**: hay un módulo que se
monta desde `renderer.js` (`showFrecuenciaAccidentalidadContent`), así que el cache-bust tiene **dos
eslabones**:

1. `index.html` → `<script src="renderer.js?v=...">` (el token del PROPIO renderer).
2. `renderer.js` → `const TOKEN = 'FREQ-...'` (el que versiona el CSS/HTML/JS del módulo).

Si se bumpea **solo el 2**, la app sigue cargando el `renderer.js` **cacheado**, que contiene el
`TOKEN` viejo → el navegador sirve el CSS viejo y **el cambio no se ve NUNCA** (el usuario mandó
captura dos veces de la tabla cortada creyendo que el arreglo no funcionaba). Pasó exactamente eso:
se bumpéo `TOKEN` a `v6` pero `index.html` seguía con `renderer.js?v=20260916-premium-split`.
**Regla: al tocar `renderer.js` hay que bumpear LOS DOS tokens.** El test ahora lo verifica
(`index.html: el <script> de renderer.js lleva un token`), pero eso solo comprueba que EXISTA uno —
si el cambio "no se ve", **lo primero es revisar si el `renderer.js` del `index.html` quedó viejo**.

#### 🚨🚨 El `min-width` AJENO: por qué la tabla medía 900px en un contenedor de 584px

Síntoma: `table-layout: fixed` + `width: 100%` + 6 columnas que suman 100%… y la tabla **igual** medía
**900px** con scroll horizontal y la columna "Estado" cortada.

Receta de diagnóstico que lo cerró (pedírsela al usuario para la consola):

```js
const t = document.querySelector('.kair-table');
const w = document.querySelector('.kair-table-wrap');
console.log('wrap', w.clientWidth, w.scrollWidth);
console.log('table', getComputedStyle(t).width, getComputedStyle(t).tableLayout);
[...t.querySelectorAll('thead th')].forEach((th, i) => console.log(i + 1, getComputedStyle(th).width));
```

Dio `layout: fixed` (o sea, **la hoja nueva SÍ estaba cargada**) pero `cssWidth = 900px` y las
columnas exactamente 12/9/22/25/9/23% **de 900** → `width: 100%` no se respetaba: algo **externo** le
imponía un ancho mínimo. Y sí: otros módulos traen reglas **SIN SCOPE** como
`table.kair-table { min-width: 1080px }` (Archivo y Retención, `archivo-retencion-view.css:181`) que se
inyectan en el `<head>` **global**.

**Fix — blindar la tabla**:
```css
.frecuencia-container .kair-table {
  width: 100%;
  min-width: 0 !important;
  max-width: 100% !important;
  table-layout: fixed;
}
```
**Regla**: cuando un módulo usa una clase **GENÉRICA** del design system (`.kair-table`, `.kair-card`,
`.kair-kpi`, `.kair-empty`…), **otro módulo puede estar redefiniéndola globalmente**. Antes de pelear
con el layout, volcar las reglas que matchean el nodo y ver quién setea `width`/`min-width`/`max-width`.
Y ojo: acá se gastaron **3 rondas de validación** suponiendo que era caché cuando el CSS ya estaba bien.

#### Alto de filas, alto del gráfico y grilla de meses (los 3 ajustes finos que pidió el usuario)

1. **Alto de filas**: lo maneja el `padding` de `td`/`th` + el de las celdas editables. Bajó de **48 a
   35px** con `td { padding: 0.3rem }`, `th { padding: 0.5rem }` y `.kair-editable { padding: 0.1rem 0.4rem }`
   (y los mismos valores en los `@media` de ≥1920 y ≥2560, si no vuelven a crecer en monitores grandes).
2. **Alto del gráfico**: el `viewBox` tenía un **tope de ancho** (`baseWidth` 800/1200/1400) y un alto
   fijo del **40% del ancho**, así que dentro de la tarjeta estirada dejaba franjas vacías. Ahora el
   viewBox se ajusta **exactamente** al contenedor:
   ```js
   var W = Math.max(320, Math.round(containerWidth));
   var H = Math.max(320, Math.round(W * 0.4), container.offsetHeight || 0);
   ```
   Con eso el SVG (que va con `width:100%`) llena la caja: el intervalo del eje pasó de **48 a 86px**.
   ⚠️ **Hay que renderizar la TABLA ANTES del GRÁFICO** en `renderizar()`, porque el gráfico mide el
   alto de su contenedor y ese alto depende de la tabla (que es la que estira la fila del `duo`).
   ⚠️ Y hay que **re-renderizar al redimensionar** (debounce 250 ms) guardando **UN solo** handler en
   `window.__freqResizeHandler` (con `removeEventListener` del anterior) para que reabrir el módulo no
   acumule listeners ni deje closures con datos viejos.
3. **Grilla "Detalle por Mes"**: `repeat(6, minmax(0,1fr))` en ventana (2 filas de 6) y
   `repeat(12, minmax(0,1fr))` en `@media (min-width: 1360px)` (1 fila de 12). Con 12 columnas hay que
   achicar un poco el contenido de la tarjeta (`padding`, nombre, valor y detalle) o el texto se corta
   (medido: 139px por tarjeta a 1920, 101px a 1453, **0 recortes**).

#### Verificación

- `node tests/frecuencia-accidentalidad/test-premium.js` → **28/28 OK** (incluye "NO hay `:root`
  global", "NO hay reset `*` global", "NO hay regla `body` global", "TODOS los selectores están bajo
  `.frecuencia-container`" y "los 32 ids del contrato siguen presentes").
- Arnés de Electron con el puente simulado: claro → contenedor `#fbfcfb`, `--freq-primary` `#2057b8`,
  tarjetas 20px, título Manrope 800, **5 KPIs, 12 filas, 12 tarjetas de mes, 4 colapsables, 9 barras**
  y el gráfico (580px) con rellenos `#fbfcfb` + `#1bb888`×10 + `#e7a224`×2; `dark` y `dark-legacy` →
  idénticos (`#0f172a` / `#6ea8fe` / `#1a2334`) y el gráfico **cambia a `#3ecf9a` / `#f0b45a`**;
  badge en oscuro `#2f5fa8`; **0 errores de consola**.
- Cache-bust: token `FREQ-20260919-v1-premium` en el CSS, el HTML, el JS y el guard del `<link>`.
- EOL: el directorio es `i/lf w/crlf`; se normalizaron los 3 archivos a **LF** (diff final:
  395/332 CSS, 33/24 HTML, 41/45 JS).

### Verificación

- Arnés de Electron (una vista por proceso): portal OK; "Realizar" con `headerV2:true`, `#2057b8`, DM Sans;
  "Ver" con `headerV2:true`, DM Sans; claro y oscuro. **0 errores de consola** (el único
  `KairSkeleton is not defined` es del arnés: en la app el shim lo toma del padre).
- Test `tests/investigacion-accidentes/test-premium.js` → **28/28 OK**.
- ⚠️ Nota del arnés: `loadFile` con `query` y el encadenado de vistas en el mismo proceso daban
  `ERR_FAILED`; se resolvió cargando **una vista por proceso** y sin `query`.

### Regla

Cuando un CSS se linkea **globalmente** además de dentro de su iframe, revisar si trae `html`/`body`/`*`
o clases genéricas (`.k-section-card`): aunque el módulo "funcione", está pisando a toda la app.

---

## 🆕 Remisiones · Alineación a la paleta canónica (📦777, 2026-09-19)

Al validar contra los módulos principales (**Recursos**, **Gestión Integral**), los dos componentes
embebidos de Remisiones (`enviar-remision-v2` y `control-remisiones-v2`) traían una **paleta propia** que
no coincidía con el resto del sistema. Se remapearon sus tokens (técnica 📦751) a los valores canónicos de
`shared/kair-design-tokens.css`:

| Token | Antes (propio) | Ahora (canónico) |
|-------|----------------|------------------|
| azul | `#2456d6` | `#2057b8` |
| azul oscuro | `#1b3f9e` | `#172c4c` |
| azul suave | `#e8eefc` | `#eaf1fb` |
| fondo | `#eef1f7` | `#fbfcfb` |
| borde | `#e3e8f2` | `#e8ebee` |
| tinta | `#16233b` | `#14213d` |
| muted | `#66738c` | `#748096` |
| faint | `#93a0b8` | `#aab1bd` |
| verde | `#0f9d63` | `#1bb888` |
| verde suave | `#e3f6ec` | `#e6f5ef` |
| ámbar | `#b97e12` | `#e7a224` |
| ámbar suave | `#fbf1da` | `#fbf0db` |
| rojo | `#d64550` | `#da5563` |
| rojo suave | `#fbe7e9` | `#fae6e9` |
| radio | `14px` / `10px` | `20px` / `12px` |
| fuente | `'Segoe UI', 'Manrope'` | `'DM Sans'` (UI) + `'Manrope'` (títulos) |
| sombra | `0 1px 2px …, 0 8px 24px rgba(22,35,59,.07)` | `0 2px 7px rgba(37,56,82,.08)` |
| oscuro | `#0f1622` / `#1a2434` / `#5b8def` | `#0f172a` / `#1a2334` / `#6ea8fe` |

- Los **títulos** (`.remenv-header__title`, `.remenv-card__title`, `.remctl-header__title`,
  `.remctl-card__title`) pasaron a `Manrope` 800 y subieron 1px (18/15px) para el look display canónico.
- Se agregó `--remenv-font-display` / `--remctl-font-display` (Manrope).
- **Verificación**: arnés de Electron que compara los tokens computados del v2 contra los canónicos →
  **`alineado: true`**, sin fallos; fuentes `DM Sans`, radio `20px`, títulos `Manrope`. Test `63/63`.
- **Regla**: al migrar un submódulo, **usar la paleta canónica** (`shared/kair-design-tokens.css`), no una
  propia. Si el diseño trae su propia paleta, remapear los tokens a los valores canónicos (no reescribir
  reglas). Un azul distinto (`#2456d6` vs `#2057b8`) se nota al lado de los demás módulos.

### 📦793 — Inspecciones Sistemáticas (4.2.4) — hub al premium v2

El **hub** (landing) del submódulo `4.2.4 Inspecciones Sistemáticas a las Instalaciones, Máquinas o Equipos`
(`modules/gestion-peligros/inspecciones/`) migra al **Patrón A premium** (mismo que los 8 módulos home rediseñados
en 📦730-737). Las 7 vistas funcionales (dashboard, historial, detalle, 4 formularios) **quedan intactas** y siguen
usando el header legacy `.k-module-header` — `buildHeader()` en `inspeccion-templates.js` no se toca.

#### Estructura nueva del hub (de arriba a abajo)

1. **Page-header premium** (`.kair-page-header`): icono decorativo en chip 44×44 (`.kair-badge-ico`, fondo
   `--kair-hover-soft` + color `--kair-primary`), título Manrope 800 20px (`.kair-title`), subtítulo muted 12.5px
   (`.kair-sub`), 2 acciones a la derecha (`.kair-actions` con `Ver Historial` outline + `Volver` ghost).
   **Sin breadcrumb pills, sin chip de empresa** — limpio como la referencia Evaluación Inicial.
2. **Hero card con score compuesto** (`.kair-hero-card`): bloque grande con score `X%` (color `--kair-primary`,
   42px/800) a la izquierda separado por border-right, título "Realizar Nueva Inspección" + descripción a la
   derecha. Fondo `linear-gradient(135deg, var(--kair-card) 0%, var(--kair-hover-soft) 100%)`.
   **Score** = `closedCount / total * 100` donde `closedStatuses = ["Ejecutado","Completada","Cumplida"]`.
3. **3 metric cards** (`.kair-metric-strip` + `.kair-metric-card`): grid 3-col con icono 42×42 a color (blue/amber/red)
   + valor 24px/800 + label uppercase 11px + sub 11px muted. Cálculos:
   - `Inspecciones del mes` (azul): `count(date >= firstOfMonth)`
   - `No conformidades` (amber): `count(status ∈ {Pendiente, Vencida, Sin Iniciar})`
   - `Próximas a vencer` (rojo): `count(status ∈ {Pendiente, Programada, Sin Iniciar} ∧ date ∈ [now, now+7d])`
4. **Chart SVG nativo** (barras horizontales, sin Chart.js): label "Nombre" + valor "X (Y%)" arriba, barra
   coloreada con el `accent` del tipo (que ya viene en `INSPECTION_TYPE_LIST`). Empty state si `total === 0`.
5. **Module grid** (`.kair-module-grid`): 4 cards de tipos (botiquín/extintores/instalaciones/equipos_emergencia)
   con chip de código (`.kair-module-card__code`, fondo `hover-soft` + color `primary`) + revisión + título +
   descripción + **flecha a la derecha** que se desplaza 2px al hover.
6. **Inspecciones Recientes** (5 últimas): header de sección (`.kair-section-head`) con título uppercase + botón
   ghost "Ver historial completo", tabla intacta.

#### Layout flex chain (crítico para scroll interno)

```js
var wrap = tpl.el("div", { className: "kair-app" });
wrap.style.cssText = "height:100%;display:flex;flex-direction:column;min-height:0;";

var main = tpl.el("main", { className: "insp-hub-home" });
main.style.cssText = "flex:1;min-height:0;overflow-y:auto;padding:0 1.5rem 1.5rem;box-sizing:border-box;";
```

Sin `display:flex;flex-direction:column;min-height:0`, el contenido se desborda sin scroll (mismo bug histórico
que 📦735 Amenazas).

#### CSS (~451 líneas nuevas)

- 11 clases premium nuevas scopeadas bajo `.kair-app .kair-*`: `.kair-page-header`, `.kair-badge-ico`,
  `.kair-titles`, `.kair-title`, `.kair-sub`, `.kair-actions`, `.kair-btn` (+ variantes `primary`/`outline`/`ghost`),
  `.kair-hero-card` (+ 6 sub-clases), `.kair-metric-strip`, `.kair-metric-card` (+ 6 sub-clases + 3 variantes
  `--blue`/`--amber`/`--red`), `.kair-chart-svg` + `.kair-chart-row` (+ 4 sub-clases + `.kair-chart-empty`),
  `.kair-module-section`, `.kair-section-title`, `.kair-section-head`, `.kair-module-grid`,
  `.kair-module-card` (+ 7 sub-clases).
- Tokens **locales** del scope (no toca el design system global): `--kair-primary`, `--kair-hover-soft`,
  `--kair-text-muted`, `--kair-text-soft`, `--kair-card`, `--kair-border`, `--kair-muted-bg`, `--kair-radius-sm`,
  `--kair-radius-md`, `--kair-shadow-card`, `--kair-transition`, `--kair-font`.
- **Responsive**: `@media (max-width: 1024px)` → metric strip a 2-col + grid 1-col + hero en columna.
  `@media (max-width: 640px)` → metric strip a 1-col + header wrap.
- **Dark theme** con selectores `[data-theme="dark"]` + `[data-theme="dark-legacy"]` (8 overrides para hero,
  page-header, badge-ico, metric card, module card).
- **Sintaxis validada** con `node --check` exit 0.

#### Cache-bust

- `inspeccion.css?v=20260915-hero-scope-fix` → `?v=20260920-hub-premium`

#### Lo que NO se tocó

- `inspeccion-templates.js` — `buildHeader()` queda legacy (lo siguen usando dashboard, historial, detalle,
  4 formularios).
- `api.js`, `store.js`, `router.js`, IPC, BD — intactos.
- `inspeccion.css` línea 116-240 (`.k-module-header` legacy) — sigue ahí para las otras vistas.

### 📦794 — Identificación de Peligros (4.1.2) migrada al premium v2

Migración completa del submódulo `4.1.2 Identificación de Peligros` al dialecto premium v2 (mismo patrón
aplicado en 📦783 Registro, 📦784 Frecuencia, 📦785–792). Incluye:

- **Bridge IPC** (`main/identificacion-peligros-bridge.js`): reescrito con tokens scoped, modo oscuro en
  ambos atributos (`[data-theme^="dark"]`), BOM/EOL normalizado a LF.
- **Sub-componentes JS** (`kair-matriz-peligros-{header,matriz,indicadores,priorizacion,service}.js` +
  `kair-matriz-peligros.js`): migrados al dialecto premium v2 con Header System v2, tokens scoped, sin
  colores hardcodeados, sin selectores globales.
- **CSS** (`kair-matriz-peligros.css`): scoped bajo `.km-wrapper`, modo oscuro completo, donut theme-aware
  con helpers `tok()`/`palette()` que leen tokens CSS computados (en vez de hex hardcodeados).
- **Home del módulo padre** (`gestion-peligros-home.js`): ajustes de integración.
- **Test nuevo** (`main/test-identificacion-peligros.js`, 149 líneas, 9 contratos): valida tokens nuevos en
  `.km-wrapper`, modo oscuro con re-definición de tokens (ambos atributos), reglas de especificidad oscuras,
  sin colores sueltos en secciones claras, integridad estructural del CSS, donut con clase + sin atributos
  stroke muertos, colores inline theme-aware, iconos 0 Font Awesome con Bootstrap local, cableado intacto.

#### Reglas recordadas (ya estaban, ahora aplicadas a 4.1.2)

- Scope `:root` + `*` + `body` GLOBALES son la fuga más grave: pisar tokens y márgenes de TODA la app.
  Mover a scope del módulo (`.km-wrapper`).
- Modo oscuro debe cubrir **ambos atributos** (`data-theme="dark"` + `data-theme="dark-legacy"`) con
  selector `[data-theme^="dark"]`.
- Gráficos que dependen del tema: helpers `tok()` / `palette()` que leen tokens CSS computados con
  `getComputedStyle`, en vez de hex hardcodeados.
- Tests de contratos: validar IDs, scopes, ausencia de selectores globales y de colores hardcodeados.



### 📦796 — Inspecciones Sistemáticas (4.2.4): premium completo de las 7 vistas

Cierre de la migración iniciada en 📦793 (hub). Las 7 vistas funcionales (hub, dashboard de programa anual,
historial, detalle y los 4 formularios) migran al header premium v7 (`buildHeader` con clases `kmi-*`,
transparente, breadcrumb + Sincronizado + Volver), manteniendo intacto todo el flujo de datos.

- **Header premium v7** en `inspeccion-templates.js` → heredan las 7 vistas; cache-bust `20260921-premium-v2-inspecciones`.
- **Hub reescrito** (referencia): hero oscuro con score compuesto + donut SVG nativo + 4 KPIs + formatos
  verticales + recientes/avance.
- **Historial**: filas con píldoras de filtro por tipo; **Dashboard/Programa**: tabla mensual con tokens;
  **Detalle + 4 formularios**: tokens del sistema + modo oscuro redefinido bajo `[data-theme] .kair-app`.
- **Verificación visual** en claro/oscuro, maximizado y ventana 1000px.

### 📦797 — Mantenimiento Periódico (4.2.5): header premium

`mantenimiento-component.js` + `mantenimiento.css` alineados al header premium (mismo lenguaje visual
del v7): título Manrope 800, acciones consistentes, tokens canónicos. Cache-bust `20260921-premium-header`
(5 referencias en `index.html`). El cronograma y el resumen (vistas funcionales) no cambian de flujo.

### 📦798 — Inspecciones (4.2.4): reconexión a la carpeta real de la empresa

El submódulo vuelve a leer/escribir la carpeta SG-SST de la empresa en Drive (la conexión existió en
📦332/338 de mayo 2026 y quedó desactivada en la reconstrucción 📦500; la firma `getCompanyRootPath`
llegaba por deps pero no se usaba).

- **Programa anual desde el Excel real**: `programa:obtener` lee `PROGRAMA DE INSPECCIONES.xlsx` de la
  carpeta 4.2.4 (encabezados de mes detectados por texto Ene…Dic, no por posición fija — el Excel del
  cliente tiene filas desalineadas; celdas de error `#VALUE!` y zona de firmas ignoradas; códigos
  `p`=programado, `c`=cumplido). `programa:actualizarActividad` con id `excel:<empresa>:<año>:<fila>`
  escribe la `c` en el Excel con **respaldo automático en `backup/` antes de cada escritura** (patrón
  📦332). Cache en memoria por mtime (el calendario itera mes a mes). Sin carpeta/Excel → cae a la
  libreta interna como antes.
- **Histórico visible**: nuevo canal `inspeccion:explorarHistorico` escanea `Inspeciones realizadas/
  <Sede>/<DD-MM-AAAA>/` y la vista de Historial muestra la sección "Archivo histórico · carpeta de la
  empresa" (visitas con conteo de fotos/formatos + formatos sueltos tipo `GI-FO-026 1-2026.xlsx`),
  con `inspeccion:abrirRuta` (shell.openPath) para abrir cada carpeta.
- **Archivado**: `inspeccion:archivar` genera el formato oficial de la inspección y lo guarda en
  `Inspeciones realizadas/<sede>/<fecha>/`; botón "Archivar en carpeta" en el detalle.
- **Migración legado**: `inspecciones_data.json` de la carpeta (formato 📦332) se importa a la libreta
  interna una sola vez, idempotente por id (`meta.legacyFolderImportedFor`).
- **Fix de fechas** (todo el submódulo): `formatDate` parseaba las ISO sin hora como UTC y en Colombia
  (UTC-5) mostraba un día atrás; ahora se construye fecha local.
- **Preload**: 3 métodos nuevos (`inspeccionExplorarHistorico`, `inspeccionAbrirRuta`, `inspeccionArchivar`).
- **Test nuevo** `main/test-inspecciones-carpeta.js`: **26/26** contra copia de la estructura real
  (Excel intacto verificado). Cache-bust `20260921-carpeta-v1`.

### 📦799 — Home Gestión de Peligros y Riesgos: fix de datos reales en hero, tarjetas y gráficas

El home premium (📦754) mostraba TODO en cero aunque la empresa tuviera datos. Dos fallos combinados:

1. **La información nunca llegaba a la vista**: `refreshStats()` guardaba las respuestas en la caché
   global de sesión pero jamás asignaba `this.peligrosStats` (lo que lee `renderMainArea()`). Mismo
   patrón de "datos en la bodega, no en el tablero" que 📦791 (gráfica de Salud).
2. **Nombres incompatibles**: la vista leía `inspecciones.total/realizadas/vencidas` y
   `mantenimiento.total/completados/atrasado`, pero los puentes devuelven
   `programaTotal/programaCompletadas/programaPendientes` (o `totalInspecciones/completadas/pendientesMes`)
   y `totalActividades/completadasMes/pendientesMes` → todo `undefined` → 0.

Fix: mapeo explícito en `refreshStats()` + asignación real de `this.peligrosStats`. **Mediciones y EPP**
(como nunca tuvieron puente de datos) pasan a "sin datos" (`null`): el score compuesto los excluye en
vez de mostrar 0/0 eternamente, y la barra de Mediciones solo se dibuja cuando exista un canal que la
alimente. Incluye los 2 ajustes pendientes de la auditoría de Mantenimiento (📦797): carga CSS
duplicada sin versión (`mantenimiento-component.js`) y tipografía Manrope/DM Sans (`mantenimiento.css`).
Cache-bust `GESTION-PELIGROS-20260921-fix-home-datos`. REGLA: cuando una vista compuesta lee de varios
puentes, verificar el nombre exacto de cada campo en el puente (no asumir) y confirmar que el resultado
termina asignado en el estado que la vista realmente lee.

### 📦800 — Auditoría Anual (6.1.2): botón "Nueva auditoría" abría un modal sin estilo

El botón "Nueva auditoría" (hub y lista) no mostraba el formulario. Dos fallos:

1. **Cero CSS para el modal**: `.kair-aud-modal`, `__backdrop/panel/head/body/foot/close/error`,
   `.kair-aud-form-row`, `.kair-aud-btn*`, confirm y toast fallback **no tenían ninguna regla** en
   `auditoria-anual.css`. Sin `display:none` base ni `--open { display:flex }`, el modal quedaba
   como bloque visible al final del body (o invisible según el cascade), y los `--v3-*` no
   resolvían porque el nodo vive en `<body>`, fuera de `.kair-v3-module`.
2. **Vista de lista con placeholder**: el handler de `[data-action="new-audit"]` solo mostraba
   "En la versión enterprise…"; la fachada `openAuditoriaForm` fallaba en silencio si
   `__kairAudInstance` era null. Además el guard `_clickBound` del hub impedía re-bindear tras
   destroy+re-render → al re-entrar al módulo el botón del hub dejaba de funcionar.

**Fix**: +432 líneas de CSS (modal/confirm/toast con tokens `--aud-*` declarados EN el modal +
dark con `[data-theme^="dark"]`), `console.warn` en la fachada, handler real en la lista,
bind en cada render del hub (sin `_clickBound`), cache-bust `AUD-20260921-modal-css` en 3 niveles
(index.html + loadCss CSS + loadScript list-view), EOL normalizado a LF. `node --check` OK.

**Regla**: un modal montado en `<body>` necesita sus propios tokens (no hereda los del scope del
módulo) y su propia regla `display:none` + estado abierto; verificar que toda clase generada por
el JS tenga regla en la hoja.

### 📦801 — Matriz de Control Operacional (7.1.1): premium v2 + fix de scroll del editor

Migración al dialecto premium v2 (mismo patrón que FURAT 📦773 y Profesiograma 📦772) y arreglo del scroll roto en la vista de edición que el usuario reportó con captura.

**Premium v2**: tokens en `:root` (iframe aislado → seguro), Header System v2 con SVG inline, dark con `[data-theme^="dark"]` (los 2 atributos), fix del selector roto `'\.kair-form-section'`, `_syncMejoramientoStore()` → `MejoramientoStore.update('711', …)` con guard, contrato DOM del header intacto.

**Scroll del editor (3 causas)**:
1. `.kair-editor` tenía `align-items: start` → la fila `main` del grid no se estiraba, `overflow-y: auto` nunca activaba y `.kair-app { overflow: hidden }` recortaba. Quitado (el sidebar ya tiene `align-self: start`).
2. Faltaba `min-height: 0` en `.kair-editor__main` → el item del grid no podía encogerse bajo su contenido.
3. La vista lista usaba `class="kair-app-main"` (clase huérfana: 0 reglas) en vez de `.kair-main` (que sí tiene `flex:1; min-height:0; overflow-y:auto`).

**Verificación**: test `tests/mejoramiento/test-premium-v2.js` → 39/39 OK (4 checks de regresión del scroll); arnés Electron midió `clientHeight 492 / scrollHeight 5258`, `scrollTop 400`, `alignItems: normal`. Cache-bust `APC-20260921-v2-scroll` en los 4 sitios + test.

**Regla**: en un layout grid `1fr auto`, si un hijo debe scrollear necesita `min-height: 0` Y su fila no puede quedar con `align-items: start` en el contenedor; verificar también que la clase del HTML exista en la hoja (un nombre huérfano = 0 reglas = sin scroll).

### 📦802 — Verificación: Definición de Indicadores (6.1.1) + Despliegue Estratégico (6.1.3)

Migración premium v2 de los 2 submódulos que quedaban en working tree, con conexión al Excel real de la empresa.

**6.1.1 Definición de Indicadores**:
- Bridge nuevo `main/indicadores-verificacion-bridge.js` (`registerVerificacionIndicadoresHandlers(app, { getCompanyRootPath })`): lee `INDICADORES <año>.xlsx` de `6. Verificación/6.1.1 …` (misma resolución de carpetas por variantes de acento que inspecciones 📦798). Hojas de definición RESULTADO/ESTRUCTURA/PROCESO + hojas de datos con series mensuales (doble fila: valor y denominador/"N° Trabajadores"). Match por nombre normalizado sin tildes. Sin carpeta → `{ source: 'none' }` y el frontend cae a la libreta de ejemplo.
- Cableado: require + try/catch en `main.js`, `preload.js` → `verificacionIndicadores.obtener`.
- Frontend: header premium `kair-page-header` (badge de origen Excel vs ejemplo), KPIs con tokens canónicos, Exportar con acción real, dark `[data-theme^="dark"]`. Cache-bust `index.html` (`?v=20260921-premium-v6` CSS, `-v2/-v3` scripts).
- Tests: `main/test-indicadores-carpeta.js` **37/37** (Electron + Excel real: 18 indicadores, series, año, fallback).

**6.1.3 Despliegue Estratégico**:
- Vista premium v2: Header v2 (`kair-rad-despliegue-header` + badge-ico + Volver→`ctx.navigate('hub')` + Refrescar→`ctx.refresh()`), 4 metric cards, tabla blindada, `tok()`/`palette()`, IPC `listarIndicadores` con fallback mock.
- Tokens scoped `--rad-desp-*` bajo `.kair-rad-view-despliegue` + dark `[data-theme^="dark"]` (sin `:root`/`*`/`body` globales). Cache-bust `?v=20260921-premium-v2`.
- Test: `main/test-despliegue-estrategico-premium.js` **38/38**.

**Nota**: los comentarios `📦800` en el código de 6.1.1 son numeración provisional de la sesión previa (📦800 real = Auditoría Anual); el commit es 📦802. `renderer.js` solo depura 2 mensajes de `console.warn`.

---

## 🆕 Notificaciones persistentes (correo + eventos) (📦807-808 commiteado · 📦809 fix duplicación + tabs + tamaño)

Feature de notificaciones persistentes en el proceso main (detección + persistencia + UI completa).

**Archivos**: `main/notifications-bridge.js` (4 handlers IPC + tabla `notificaciones` con `dedupe_key` UNIQUE + índice único compuesto + **`GLOBAL_COMPANY='*'`** y migración one-shot que consolida correos), `main/notifications-service.js` (detección con 12 fuentes de calendario + backoff + guard de reentrada), `main/notifications-email.js` (detector de correo del cache — **UNA fila global `company_key='*'` por thread, sin fan-out por empresa**), `main/notifications-gate.js` (gate de bandeja fail-closed, mismo criterio que el bridge de permisos 📦702); cableado en `main.js` + `preload.js` (`window.electronAPI.notifications`); UI en `renderer.js` (badge + toast con escape HTML), `shared/kair-alerts.js` (**tabs Pendientes/Notificaciones** con `_state.activeTab` + `localStorage['kair-alerts-tab']`, listar `soloNoLeidas`, correo global siempre navega, ventana 15m/1h/6h/24h persistida, **footer en ambas pestañas**, **`_pinPopoverHeight`/`_state.panelMinH` para tamaño estable al conmutar**), `styles.css` + `index.html` (estilos tabs, dark, notifs-list **sin `max-height`**, cache-bust `20260923-notifs-size`) y `assets/js/update-notifications.js`.

**Seguridad**: sesión obligatoria en los 4 canales (`UNAUTHORIZED`), `companyKey` ajena a la sesión → `FORBIDDEN_COMPANY` (nunca empresas ajenas; `marcarLeida` solo marca ids de la sesión + globales `'*'`), gate `bandeja_integrada_enabled` fail-closed, y **sin log de `access_token`** en notifications-*.

**Tests** (correrlos antes de commitear; bridge/service usan better-sqlite3 → con Electron):

```powershell
$env:ELECTRON_RUN_AS_NODE=1; npx electron main/test-notificaciones-bridge.js   # 28/28
$env:ELECTRON_RUN_AS_NODE=1; npx electron main/test-notificaciones-service.js  # 10/10
node main/test-notificaciones-email.js     # 7/7
node main/test-notificaciones-wiring.js    # 11/11
node main/test-notificaciones-fuentes.js   # 52/52
node main/test-notificaciones-ui.js        # 36/36 (incluye checks de tamaño estable)
node main/test-notificaciones-seguridad.js # 23/23 (seguridad: UNAUTHORIZED/FORBIDDEN/gate/token)
```

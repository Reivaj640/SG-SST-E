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

### Skills de Desarrollo

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

1. **feature-dev** - Workflow completo (7 fases: discovery, exploration, questions, architecture, implementation, review, summary)
2. **code-simplifier** - Despues de implementar codigo
3. **code-reviewer** - Antes de commit
4. **security-review** - Antes de commit, para codigo con input de usuario o superficies de ataque
5. **commit-workflow** - Al hacer commit

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

### K+AIR Premium Design System (v0.1.205 · 📦730-738)

A partir de v0.1.197, los homes de módulos usan el sistema premium con tokens compartidos. **8 paquetes ya migrados** al patrón unificado (sep 2026):

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
| Inducciones | ⏳ | Dialecto propio en `inducciones-view.css` (scoped `.inducciones-container`) |
| Plan de Trabajo | ⏳ | Dialecto propio en `plan-view.html` |
| Otros submódulos | ⏳ | Migrar con este playbook |

### Historial

- **📦748**: Dashboard premium v2 (CSS scoped `.kair-dashboard` en `styles.css`).
- **📦749**: Extracción del dialecto a `shared/kair-premium.css` scoped `.kair-premium`; dashboard migrado como piloto; `styles.css` vuelve a su rol de estilos legacy.
- **📦751**: Configuración del Sistema migrada a premium v2 (capa scoped `.kair-config` + remapeo de tokens legacy; Header System v2 con breadcrumb + icono/título + tabs con subrayado; soporte dark/dark-legacy).

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






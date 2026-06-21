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
- `<numero>` es secuencial e incremental (último conocido: 399 → siguiente 400).
- La descripción es en español, sin punto final obligatorio, tono directo (ej: "Fix y Update sistema actualizacion e iconos y accesos directos del escritorio").
- Para work-in-progress / doc-only / refactor sin cambio funcional visible, mantener el mismo formato 📦n #.
- Ejemplos reales del repo: `📦396 #`, `📦397 #`, `📦398 #`, `📦399 #`.

**Antes de cada commit, verificar el último `📦<n>` en `git log` para usar el siguiente número correcto.**
- Cumplir Resolucion 0312 de 2019 (Colombia)

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

NO usar términos como: callback, listener, async, await, variable, función, línea, código, archivo, etc.
SI usar términos como: sistema, mensaje, ventana, tema, preferencia, configuración, resultado, etc.

---

## Arquitectura del Proyecto (para IA nueva)

Si otra IA va a extender el proyecto, debe seguir estas convenciones:

### Stack
- **Electron** (no React, no Vue, no frameworks frontend)
- **Vanilla JS** (ES5/ES6 mixto, sin TypeScript)
- **CSS plano** (sin Tailwind, sin preprocessors — solo BEM con prefijo `kair-`)
- **Bootstrap Icons** vía `<i class="bi bi-xxx">`
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

### Comunicación
- **Renderer ↔ Main process**: `window.electronAPI.modulo.metodo(arg).then(...)`
- **Entre vistas**: `window.KairStore.actions.goXxx()` + `_refreshView()` en el componente
- **Toasts**: `window.updateNotifier.show({ type: 'success|info|warning|error', title, subtitle })`
- **Confirm dialogs**: `window.kairAuditoriaAnual.showConfirm({...}).then(ok => ...)`

### Carga de dependencias (cascada)
El componente carga sus dependencias con `loadCss()` + `loadScript()` en cascada anidada. NO usar ES modules ni require(). Ver `auditoria-anual-component.js` líneas 24-110 como referencia.

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
5. NO commitear sin autorización explícita del usuario ("sí"/"dale"/"commit")

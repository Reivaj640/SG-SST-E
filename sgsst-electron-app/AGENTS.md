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

**Cache-bust dinámico (`?v=N`):** cada vez que se cambia código de la Bandeja Integrada, hay que bumpear el `currentVersion` (actualmente en `v=617`) en `renderer.js` línea ~1044. Sin esto, el navegador cachea la versión vieja y no se ven los cambios.

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

### Cómo extender la Bandeja Integrada
1. Modificar archivos en `renderer/bandeja-integrada/`
2. Bumpear cache-bust en `renderer.js` (línea ~1044: `?v=N+1`)
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

## 🧪 Tests smoke (en `main/test-*.js`)

Desde v0.1.120, el proyecto tiene **9 archivos de tests smoke** en `sgsst-electron-app/main/test-*.js` que validan que los cambios no rompen nada. **Todos están en `.gitignore`** (no se commitean).

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
| **Total** | **157** | Acumulado histórico |

**Nota:** el total puede variar si se agregan o quitan tests. Siempre correr los 9 antes de commitear.

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

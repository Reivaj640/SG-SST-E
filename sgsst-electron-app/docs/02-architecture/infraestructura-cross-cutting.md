# 🔧 Infraestructura Cross-Cutting K+AIR

**Versión:** 1.0
**Actualizado:** 9 de junio de 2026
**Estado:** ✅ Componentes compartidos

---

## Descripción

Documentación de los componentes de infraestructura compartidos (cross-cutting) que sirven a todos los módulos de la aplicación K+AIR: sistema de carga de vistas, notificaciones toast, auto-update, sistema de carga (loading), y KPI Stats Ribbon.

---

## 1. ViewLoader — Carga Dinámica de Vistas

### Archivos

| Archivo | Líneas | Propósito |
|---|---|---|
| `modules/helpers/viewLoader.js` | 45 | Helper Node.js para lectura de HTML desde filesystem |
| `renderer.js` | 3385-4270+ | Orquestación principal de cambio de vistas |

### Arquitectura: Dos Capas

**Capa 1 — `viewLoader.js` (bajo nivel, Node.js)**

- `loadView(modulePath, viewFile)` — síncrono, retorna HTML string
- `loadViewAsync(modulePath, viewFile)` — async, retorna Promise
- Usa `fs.readFileSync` / `fs.readFile` con `path.join(__dirname, ...)`
- **NO usado directamente por el renderer** (es helper Node-side)

**Capa 2 — `renderer.js` (DOM-based, renderer process)**

El renderer NO usa `viewLoader.js`. Usa manipulación DOM directa + instanciación de componentes:

| Función | Líneas | Propósito |
|---|---|---|
| `showModuleContent(moduleName)` | 3520-3580 | Entry point al clickear módulo en sidebar |
| `showModuleHome(container, moduleName)` | 3660-3750 | Crea home del módulo (despacha a Home components) |
| `showModuleContentWithSubmodule(module, sub)` | 3385-3428 | Shortcut desde dashboard a submódulo |
| `showSubmoduleContent(container, module, sub)` | 3806-4270+ | **Core**: if/else chain que instancia componentes |
| `showGenericModuleHome(container, module, subs)` | 3753-3802 | Fallback: grid de tarjetas de submódulos |

### Mecanismo de Carga

1. `document.createElement('div')` → wrapper `.submodule-content`
2. `currentActiveComponent.destroy()` → cleanup componente previo
3. `new window.ComponentName(container, company, module, submodule, callback)` → instanciar
4. `component.render()` → poblar container
5. Si componente no existe → `showDevelopmentMessage()`

### CSS Clave

| Clase | Propósito |
|---|---|
| `.main-canvas` | Wrapper principal contenido |
| `.module-content-area` | Container home de módulo |
| `.submodule-content` | Wrapper submódulo individual |

---

## 2. Toast / Sistema de Notificaciones

### Archivos

| Archivo | Líneas | Propósito |
|---|---|---|
| `assets/js/kair-toast.js` | 74 | **KAIRToast** — sistema toast general |
| `assets/js/update-notifications.js` | 288 | **UpdateNotificationManager** — toasts de actualización |
| `styles.css` | 3369-3664 | CSS global de toasts |
| `index.html` | 195, 198, 203 | Carga de scripts + `#notification-hub` |

### KAIRToast (Propósito General)

**Clase:** `KAIRToast` — singleton con lazy hub initialization

**Instancia global:** `window.KAIRToast`

```javascript
window.KAIRToast.show(message, type, { subtitle, autoClose })
// type: 'info' | 'success' | 'error' | 'warning'
// autoClose: ms (default 4000), 0 = persistente
```

- **Max 3 toasts** visibles simultáneamente
- Container: `#notification-hub` (fixed bottom-right, 360px, z-index 999999)
- Animación: `translateX(120%) → translateX(0)` con cubic-bezier spring
- Iconos: Bootstrap Icons (`bi-info-circle-fill`, `bi-check-circle-fill`, etc.)
- Colores por tipo (gradientes): info (#174ea6→#185abd), success (#28a745→#218838), error (#dc3545→#c82333), warning (#ffc107→#e0a800)
- Dark theme: bg #1E293B, texto claro

### UpdateNotificationManager (Actualizaciones)

**Clase:** `UpdateNotificationManager`

**Instancia global:** `window.updateNotifier`

Extiende KAIRToast con:

- **Barra de progreso** (`{ percent, speed }`)
- **Botón de acción** (`buttonText` + `onClick`)
- Solo 1 toast de update a la vez (reemplaza anterior)

| Método | Descripción |
|---|---|
| `notifyChecking()` | Info, persistente, icono pulsante |
| `notifyNotAvailable()` | Warning, 4s auto-close |
| `notifyAvailable(version)` | Info, barra progreso 0%, persistente |
| `updateProgress(percent, speed)` | Actualiza barra progreso |
| `notifyDownloaded(version, onRestart)` | Success, botón "Reiniciar e Instalar Ahora" |
| `notifyError(errMsg)` | Error, 6s auto-close |

### Variantes Locales

Algunos módulos implementan toasts inline propios (e.g., `evaluacion-inicial-sg-sst.js` usa `#k-toast` con `.k-toast.show.success/warning/danger`). Son **locales** y separados del sistema global.

---

## 3. Auto-Update — Sistema de Actualización

### Arquitectura 3-Procesos

```
main.js (autoUpdater) ──IPC──> preload.js (bridge) ──window.electronAPI──> renderer.js / update-notifications.js
```

### Eventos Main Process (main.js 475-574)

| Evento autoUpdater | Línea | Canal IPC | Data |
|---|---|---|---|
| `checking-for-update` | 480 | `update_checking` | — |
| `update-available` | 491 | `update_available` | `{ version, ...info }` |
| `update-not-available` | 503 | `update_not_available` | `{ version, ...info }` |
| `download-progress` | 512 | `update_progress` | `{ percent, speed }` |
| `update-downloaded` | 522 | `update_downloaded` | `{ version, ...info }` |
| `error` | 530 | `update_error` | `{ message }` |

- Auto-download al detectar `update-available` (línea 499)
- Error handling: Squirrel exit code 2 (retry 60s), network errors (no retry), rate limiting (no retry)
- Check triggered 5s after app ready (main.js 6818-6821)

### Doble Registro de Listeners

⚠️ **Redundancia:** Tanto `renderer.js` (1416-1480) como `update-notifications.js` (249-283) registran listeners para los mismos eventos IPC. Ambos llaman a `window.updateNotifier`.

---

## 4. Loading System — Sistema de Carga

### Dos Fases

**Fase 1: Ventana de Carga Independiente (startup)**

| Archivo | Propósito |
|---|---|
| `loading/loading.html` | Página de carga autocontenida (500x600 frameless) |
| `loading/preload-loading.js` | Preload específico (IPC `loading-complete`) |
| `main.js` 604-631, 6758-6773 | Lifecycle de loading window |

Flujo:

1. `createLoadingWindow()` → BrowserWindow frameless 500x600
2. `createWindow()` en paralelo → main window **oculta**
3. Loading simulation (9 pasos) con `KairLoadingController`
4. `window.dispatchEvent('kair-loading-complete')` → IPC `loading-complete`
5. Main process cierra loading window, muestra main window
6. **Fallback:** si IPC no llega, auto-cierre en 10s

**Fase 2: Transición Post-Login (renderer)**

| Archivo | Líneas | Propósito |
|---|---|---|
| `renderer.js` | 1744-1883 | `KairLoadingController` (renderer-side) |
| `renderer.js` | 1897-2080 | Overlay transición login |

Flujo:

1. `executeLoginTransition()` → crea overlay `.loading-container`
2. Fade-out auth screen (blur + scale + opacity)
3. Secuencia: 25% "Verificando credenciales" → 50% "Cargando configuración" → 75% "Preparando interfaz" → 100% "Bienvenido!"
4. Animación SVG checkmark circle
5. Dispatch `kair-loading-complete` → remover overlay

### Clase: KairLoadingController

| Método | Propósito |
|---|---|
| `setProgress(value)` | Actualizar barra y porcentaje |
| `setMessage(main, sub)` | Texto con fade transition |
| `complete()` | Fade-out, dispatch `kair-loading-complete` |
| `showError(message)` | Error display rojo |
| `reset()` | Reset completo para reuso |
| `startSimulation()` | 9-step timed progress sequence |

### Splash Screen (Pre-Login)

- `.kair-splash-screen` overlay z-index 100
- Orbs animados, polígonos, 6 partículas
- Logo con animación `kair-float`
- Click logo → `.kair-splash-hidden` → revela `.kair-auth-card`

---

## 5. KPI Stats Ribbon (`.k-stats-ribbon`)

### Definición Canónica

| Archivo | Líneas | Contenido |
|---|---|---|
| `modules/gestion-integral/plan-trabajo/plan-view.css` | 534-695 | CSS canónico (light + dark + responsive) |
| `modules/gestion-integral/plan-trabajo/plan-view.html` | 55-85 | HTML canónico |
| `modules/gestion-integral/plan-trabajo/plan-viewer.js` | 978-982 | Poblado de datos |

### Estructura HTML (BEM)

```html
<div class="k-stats-ribbon">
  <div class="k-stats-ribbon__item">
    <span class="k-stats-ribbon__icon primary"><i class="bi bi-calendar-check"></i></span>
    <div class="k-stats-ribbon__data">
      <span class="k-stats-ribbon__value" id="stat-total">0</span>
      <span class="k-stats-ribbon__label">Programadas</span>
    </div>
    <span class="k-stats-ribbon__pct" id="stat-progress-text">0%</span>
  </div>
  <div class="k-stats-ribbon__divider"></div>
  <!-- más items... -->
</div>
```

### Clases CSS y Design System

| Clase | Propósito | Key Styles |
|---|---|---|
| `.k-stats-ribbon` | Container | flex, `var(--bg-card)`, `var(--border)`, `var(--radius-lg)`, `var(--shadow-sm)` |
| `.k-stats-ribbon__item` | Stat individual | flex, gap 0.625rem, padding 0.75rem 1.25rem, flex: 1 |
| `.k-stats-ribbon__icon` | Badge icono circular | 32x32px, 50% radius |
| `.k-stats-ribbon__icon.primary` | Color primario | `var(--primary-light)` bg, `var(--primary)` color |
| `.k-stats-ribbon__icon.success` | Color éxito | `var(--success-light)` bg, `var(--success)` color |
| `.k-stats-ribbon__icon.warning` | Color advertencia | `var(--warning-light)` bg, `#856404` color |
| `.k-stats-ribbon__icon.danger` | Color peligro | `var(--danger-light)` bg, `var(--danger)` color |
| `.k-stats-ribbon__icon.muted` | Color apagado | `#f0f2f5` bg, `var(--text-muted)` color |
| `.k-stats-ribbon__value` | Número grande | 1.25rem, 700 weight |
| `.k-stats-ribbon__value--muted` | Valor muted | 1rem, `var(--text-muted)` |
| `.k-stats-ribbon__label` | Etiqueta | 0.6875rem, uppercase, 0.5px letter-spacing |
| `.k-stats-ribbon__pct` | Badge porcentaje | pill shape, `var(--primary)` on `var(--primary-light)` |
| `.k-stats-ribbon__divider` | Separador vertical | 1px, 32px, `var(--border)` |

- **Dark theme:** icon bg rgba 15% opacity, texto light gray, ribbon bg #1e1e2e
- **Responsive (<768px):** ribbon wraps, items 1 1 45%, dividers hidden

### Módulos que Usan el Ribbon

| Módulo | Archivo | Datos Poblados |
|---|---|---|
| Plan de Trabajo | `plan-viewer.js:978` | total, completadas, pendientes, vencidas, % progreso |
| Evaluación Inicial | `evaluacion-inicial-sg-sst.js:787` | score %, gaps, pendientes |
| Capacitaciones | `capacitaciones-logic.js:641` | total, completadas, pendientes, participantes, % |
| Inducciones | `inducciones-logic.js:247` | total |

⚠️ **Nota:** CSS del ribbon está duplicado en múltiples archivos. La versión canónica es `plan-view.css:534-695`.

---

**Mantenido por:** Architecture Team
**Última actualización:** 9 de junio de 2026
**Versión doc:** 1.0 (v0.1.99)

# K+AIR · Design System (Premium v2)

> **Estado:** v0.1.212 (22 sept 2026) — sincronizado con `shared/kair-design-tokens.css`, `kair-components.css`, `kair-premium.css`, `kair-sidebar.css`, `kair-calendar.css`.
> **Para:** sesiones de AI que implementen UI + owner como referencia para consistencia visual.
> **Convención del doc:** cada patrón viene con su archivo de implementación, ejemplos de uso, y trampas conocidas.

---

## 1. Filosofía del sistema

**Principios rectores** (aprendidos en 70+ paquetes, 📦730-805):

1. **Coexistencia sin choque** — los nuevos `kair-*` conviven con los legacy `--k-*` sin conflicto (prefijos distintos). NO renombrar legacy — coexisten.
2. **Tokens scoped primero, hardcodes NUNCA** — todo color/radio/tipografía que pueda ser local va en `--X-*` scoped bajo el contenedor del módulo.
3. **Bordes > sombras** — preferir `border: 1px solid var(--kair-line)` a `box-shadow` cuando sea posible.
4. **Transición uniforme** — `var(--kair-transition)` (180ms ease-out) en TODO cambio de estado (hover, focus, active, etc.).
5. **Mínimo invasivo** — empezar minimalista (sin border, sin caja, sin shadow). Agregar elementos decorativos solo bajo pedido explícito del owner.
6. **Dark mode siempre con `[data-theme^="dark"]`** — cubre `dark` y `dark-legacy`. NUNCA `[data-theme="dark"]` solo.
7. **Responsive fluido con `clamp()`** — no usar breakpoints fijos de Electron (la app tiene `minWidth: 1024`). Usar `clamp(min, vw, max)` y `auto-fit/auto-fill`.

---

## 2. Archivos del sistema

| Archivo | Tamaño | Rol | Paquete |
|---|---|---|---|
| `shared/kair-design-tokens.css` | 4 KB | 9 tokens canónicos + dialect extendido (chips soft, jerarquía de texto) | 📦730 base |
| `shared/kair-components.css` | 15 KB | 14 componentes `kair-*` reutilizables | 📦730 base |
| `shared/kair-premium.css` | 19 KB | Dialecto premium v2 extraído (uso compartido por módulos) | 📦749 |
| `shared/kair-sidebar.css` | 5 KB | Componentes del sidebar lateral (`kair-nav-card`) | 📦738 |
| `shared/kair-calendar.css` | 41 KB | Componentes del calendario (header + grid + eventos) | 📦738+ |

**Cargados en `index.html` con cache-bust `?v=20260922-notifs-ui` o el que corresponda.**

---

## 3. Tokens canónicos (`kair-design-tokens.css`)

### 3.1 Paleta semántica

```css
:root {
  /* Colores base */
  --kair-canvas:    #fbfcfb;   /* fondo de aplicación */
  --kair-card:      #ffffff;   /* superficie de tarjetas */
  --kair-soft:      #f3f6f6;   /* neutro suave (chips, divisores internos, hover) */

  /* Texto */
  --kair-ink:       #14213d;   /* texto principal */
  --kair-muted:     #748096;   /* texto secundario */
  --kair-faint:     #aab1bd;   /* texto auxiliar, breadcrumbs */

  /* Bordes y separadores */
  --kair-line:      #e8ebee;   /* borde sutil por defecto */
  --kair-line-soft: #eef0f1;   /* borde muy sutil (separadores internos) */

  /* Acentos semánticos (NO decorar) */
  --kair-blue:      #2057b8;   /* acción primaria, navegación activa, datos destacados */
  --kair-blue-ink:  #172c4c;   /* azul oscuro para hero cards */
  --kair-mint:      #1bb888;   /* éxito, cumplimiento */
  --kair-amber:     #e7a224;   /* advertencia */
  --kair-red:       #da5563;   /* riesgo */

  /* Sombras muy suaves */
  --kair-shadow-soft: 0 8px 18px rgba(32, 87, 184, 0.15);   /* botón primario */
  --kair-shadow-card: 0 2px 7px rgba(37, 56, 82, 0.08);     /* card elevado leve */

  /* Tipografía */
  --kair-font-ui:      'DM Sans', system-ui, -apple-system, sans-serif;
  --kair-font-display: 'Manrope', 'DM Sans', sans-serif;

  /* Radios */
  --kair-radius-card:    20px;   /* tarjetas principales */
  --kair-radius-modal:   22px;   /* hero cards grandes */
  --kair-radius-control: 12px;   /* botones, inputs, chips */
  --kair-radius-pill:    999px;

  /* Espaciado */
  --kair-space-xs: 4px;
  --kair-space-sm: 8px;
  --kair-space-md: 16px;
  --kair-space-lg: 24px;
  --kair-space-xl: 32px;

  /* Transiciones */
  --kair-transition: 180ms ease-out;
}
```

### 3.2 Dialect extendido (📦739 — chips soft, jerarquía de texto)

```css
:root {
  /* Variantes "soft" para chips con fondo de color */
  --kair-blue-soft:   #eaf1fb;
  --kair-blue-text:   #2057b8;
  --kair-green-soft:  #e6f5ef;
  --kair-green-text:  #1bb888;
  --kair-green:       #1bb888;     /* alias de --kair-mint */
  --kair-amber-soft:  #fbf0db;
  --kair-amber-text:  #b07c1a;
  --kair-red-soft:    #fae6e9;
  --kair-red-text:    #da5563;
  --kair-slate-soft:  #f1f3f5;
  --kair-slate:       #748096;
  --kair-blue-light:  #b5c8e3;     /* azul claro para barras de género */

  /* Jerarquía de texto detallada (entre ink y muted) */
  --kair-text:    #14213d;         /* alias de --kair-ink */
  --kair-text-2:  #4d5b75;         /* entre ink y muted */
  --kair-text-3:  #98a2b3;         /* entre muted y faint */

  /* Aliases de superficie/track/sombra */
  --kair-surface: #ffffff;
  --kair-track:   #e8ebee;
  --kair-shadow:  0 4px 14px rgba(37, 56, 82, 0.08);

  /* Tipografía display + transition shorthand */
  --kair-font-title: 'Manrope', 'DM Sans', sans-serif;
  --kair-t:          180ms ease-out;
}
```

### 3.3 Uso correcto de tokens

```css
/* ✅ BIEN: usar tokens */
.card { background: var(--kair-card); border: 1px solid var(--kair-line); border-radius: var(--kair-radius-card); }

/* ❌ MAL: hardcodear */
.card { background: #fff; border: 1px solid #e8ebee; border-radius: 20px; }
```

---

## 4. Componentes base (`kair-components.css`)

14 componentes reutilizables con prefijo `kair-*` (sin choque con el sistema BEM legacy `--k-*`):

### 4.1 Header System v2

```html
<header class="kair-page-header">
  <nav class="kair-breadcrumb">
    <a>Módulo</a><span>›</span>
    <a>Submódulo</a><span>›</span>
    <span aria-current="page">Vista actual</span>
  </nav>
  <div class="kair-page-title-block">
    <div class="kair-badge-ico"><!-- SVG 44×44 --></div>
    <div>
      <h1>Título principal</h1>
      <p class="kair-subtitle">Descripción secundaria muted</p>
    </div>
  </div>
  <div class="kair-actions">
    <button class="kair-btn kair-btn-ghost">Secundario</button>
    <button class="kair-btn kair-btn-primary">Primario</button>
  </div>
</header>
```

**Reglas del Header:**
- `padding: 4px` (NO 20px) en horizontal — maximiza el ancho disponible
- Transparente sobre `var(--kair-canvas)` (NO background card)
- `flex-direction: row` para breadcrumb arriba + título+acciones abajo (en L7+)
- Hover de botones ghost usa `--kair-canvas` (NO `--kair-soft`)
- Botones outline/ghost NUNCA con border azul en estado normal

### 4.2 Catálogo de componentes

| Clase | Uso | Variantes |
|---|---|---|
| `.kair-page-header` | Header premium v2 (transparente) | — |
| `.kair-page-title-block` | Bloque con icon chip + título + subtítulo | — |
| `.kair-breadcrumb` | Breadcrumb con separadores `›` | `li[aria-current="page"]` |
| `.kair-hero-card` | Card grande oscura (azul-ink) con mensaje + score + círculo decorativo | — |
| `.kair-metric-card` | KPI con título + valor + progress bar | `--danger`, `--warning` |
| `.kair-card` | Card genérica | — |
| `.kair-tabs` + `.kair-tab` | Tabs horizontales con subrayado azul de 2px en activa | — |
| `.kair-btn` | Botón base (11px 17px padding, radius 12) | `.kair-btn-primary` (azul + shadow), `.kair-btn-ghost` (blanco + border) |
| `.kair-status-pill` | Badge de estado | `--ok` (verde), `--warn` (ámbar), `--danger` (rojo) |
| `.kair-progress` + `i` | Barra de progreso (track + fill) | color del fill según contexto |
| `.kair-chart` + `.kair-legend` | Chart SVG nativo | — |
| `.kair-task` + `.kair-task-icon` | Item de lista con icono circular | — |
| `.kair-module` + `.kair-module-grid` | Card de submódulo con flecha | — |

### 4.3 Botones — cuándo usar cuál

```css
.kair-btn-primary  /* acción principal: Guardar, Confirmar, Exportar */
.kair-btn-ghost    /* acción secundaria: Cancelar, Volver, Refrescar */
```

**Trampa común:** NUNCA usar `border: 1px solid var(--kair-blue)` en estado normal de ghost — eso comunica "primario". Los ghost son blancos con `--kair-line`.

---

## 5. Patrones estructurales (trampas evitadas)

### 5.1 Flex chain para scroll interno

**EL más repetido en commits 📦735, 📦738, 📦751, 📦801.** Sin esto, el contenido se desborda sin scroll.

```css
/* ✅ Layout principal: SIEMPRE flex chain */
.k-app-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ✅ Main con scroll: necesita flex + min-height:0 */
.main-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 1.5rem 1.5rem;
  box-sizing: border-box;
}
```

**Por qué `min-height: 0`?** Sin eso, el item del grid/flex no puede encogerse por debajo de su contenido y `overflow-y: auto` nunca se activa.

### 5.2 Tabla blindada anti-fugas

**Patrón originado en 📦784-fix2 (Frecuencia) y replicado en Severidad, Prevalencia, Incidencia, Mejoramiento, Despliegue Estratégico.**

```css
/* ✅ Tabla que no se sale ni deforma scroll */
table.kair-table {
  min-width: 0 !important;
  max-width: 100% !important;
  table-layout: fixed;
  width: 100%;
}

/* ✅ Columnas con anchos fijos que suman 100% */
.kair-table th:nth-child(1) { width: 14.5%; }
.kair-table th:nth-child(2) { width: 12%; }
.kair-table th:nth-child(3) { width: 11%; }
/* ... sumar 100% ... */
```

**Trampa:** si los anchos suman >100%, la tabla se sale del card y aparece scroll horizontal no deseado.

### 5.3 Modal en `<body>` con tokens scoped

**Caso real: 6.1.2 Auditoría Anual (📦800).** El modal vive en `<body>`, fuera del wrapper `.kair-v3-module` donde están los `--v3-*`.

```css
/* ✅ Modal con tokens PROPIOS sobre sí mismo */
.kair-aud-modal {
  --aud-blue: #2057b8;
  --aud-ink: #14213d;
  --aud-line: #e8ebee;
  /* ... paleta canónica ... */
  background: #fff;
  border-radius: 20px;
}

[data-theme^="dark"] .kair-aud-modal {
  --aud-blue: #4a82d6;
  --aud-ink: #e6e9ee;
  /* ... dark mode ... */
}
```

### 5.4 Header transparente v7 (sin background card)

**Aprendido en 📦796+ y aplicado a Inspecciones/Mantenimiento/Notificaciones.**

```css
/* ✅ v7: header transparente, sin background, sin chip empresa, sin border-bottom */
.kmi-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 0;
  background: transparent;
  border-bottom: none;
}

/* ❌ v6 (legacy): con background card, chip empresa, divider */
.kmi-header { background: var(--kair-card); border-bottom: 1px solid var(--kair-line); }
```

### 5.5 Dark mode — selector único

```css
/* ✅ Cubre dark + dark-legacy */
[data-theme^="dark"] {
  --kair-canvas: #0f1419;
  --kair-card: #1a1f25;
  /* ... etc ... */
}

/* ❌ NUNCA usar (deja dark-legacy sin estilo) */
[data-theme="dark"] { ... }
```

### 5.6 Tokens scoped bajo contenedor (NO en `:root`)

```css
/* ✅ Tokens scoped por módulo */
.kair-rad-view-despliegue {
  --rad-desp-blue: #2057b8;
  --rad-desp-ink: #14213d;
  --rad-desp-canvas: #fbfcfb;
}

[data-theme^="dark"] .kair-rad-view-despliegue {
  --rad-desp-canvas: #0f1419;
  --rad-desp-ink: #e6e9ee;
}

/* ❌ NUNCA globales (chocan entre módulos) */
:root { --rad-desp-blue: #2057b8; }
[data-theme="dark"] { --rad-desp-canvas: #0f1419; }
```

**Patrones de nombres de scope por módulo:**

| Módulo | Scope | Prefijo |
|---|---|---|
| Inspecciones | `.kair-app` | `kmi-` |
| Identificación Peligros | `.km-wrapper` | `--km-*` |
| Mantenimiento | `.mantenimiento-X` | `--mant-*` |
| Auditoría Anual | `.kair-aud-modal` (en `<body>`) | `--aud-*` |
| Severidad | `.sev-scope` | `--sev-*` |
| Mortalidad | `.mort-scope` | `--mort-*` |
| Prevalencia | `.prev-scope` | `--prev-*` |
| Incidencia | `.inc-scope` | `--inc-*` |
| Frecuencia | `.freq-scope` | `--freq-*` |
| Ausentismo | `.aus-scope` | `--aus-*` |
| Mejoramiento | `.kair-acciones-pc` | `--v3-*` |
| Despliegue Estratégico | `.kair-rad-view-despliegue` | `--rad-desp-*` |

### 5.7 Donut chart theme-aware con helpers `tok()` / `palette()`

**Patrón de 6.1.2 Identificación de Peligros (📦794).** SVG donut que cambia colores con el tema sin duplicar reglas.

```css
.kair-donut-stroke { stroke: tok('--kair-blue'); }
```

```js
// Helper JS: resuelve el color del tema actual
function tok(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}
function palette() {
  return {
    blue: tok('--kair-blue'),
    mint: tok('--kair-mint'),
    red: tok('--kair-red'),
    amber: tok('--kair-amber')
  };
}
```

### 5.8 Chart SVG nativo (sin Chart.js)

**Patrón de Inspecciones (📦793) y Despliegue Estratégico (📦802).** Reemplaza Chart.js cuando solo se necesita un chart simple.

```html
<svg viewBox="0 0 400 200" class="kair-chart">
  <!-- Barras horizontales con label "X/Y (Z%)" -->
  <g>
    <rect x="0" y="20" width="200" height="20" fill="var(--kair-blue)" rx="4"/>
    <text x="210" y="35">29/39 (74%)</text>
  </g>
</svg>
```

**Cuándo SÍ usar Chart.js**: cuando necesitas animaciones, zoom, tooltips complejos (ej. Registro Estadístico 3.2.3 con 9 gráficos).

**Cuándo NO**: cuando son barras simples, donuts, o progress visuales → SVG nativo.

### 5.9 Hover state unificado (sin `:hover` con colores hardcoded)

```css
/* ✅ Hover con token */
.kair-nav-card:hover { background-color: var(--kair-soft); }

/* ❌ Hardcoded */
.kair-nav-card:hover { background-color: #f3f6f6; }
```

**Lección crítica del sidebar (📦738):** 4 iteraciones porque empecé con cajas/bordes/sombras decorativos. Owner rechazó. Empezar minimalista, agregar solo si pide.

---

## 6. Header System v2 — patrón detallado

El Header premium v2 es la pieza más copiada del sistema. Estructura canónica:

```html
<header class="kair-page-header">
  <nav class="kair-breadcrumb">
    <ol>
      <li><a href="#">Módulo</a></li>
      <li class="kair-breadcrumb__sep">›</li>
      <li><a href="#">Submódulo</a></li>
      <li class="kair-breadcrumb__sep">›</li>
      <li aria-current="page">Vista</li>
    </ol>
  </nav>
  <div class="kair-page-title-block">
    <div class="kair-badge-ico">
      <svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true">
        <!-- icono del módulo -->
      </svg>
    </div>
    <div class="kair-titles">
      <h1>Título principal</h1>
      <p class="kair-subtitle">Descripción secundaria</p>
    </div>
  </div>
  <div class="kair-actions">
    <button class="kair-btn kair-btn-ghost">
      <svg width="16" height="16"><!-- icono 16 --></svg>
      Acción secundaria
    </button>
    <button class="kair-btn kair-btn-primary">
      <svg width="16" height="16"><!-- icono 16 --></svg>
      Acción principal
    </button>
  </div>
</header>
```

**Tokens canónicos del Header:**

```css
.kair-page-header {
  /* NO background: transparente sobre --kair-canvas */
  /* padding: 4px (NO 20px) — maximiza el ancho */
  padding: 4px clamp(8px, 1.5vw, 16px) clamp(20px, 2.4vw, 32px);
  max-width: min(1400px, 100%); /* NO margin: 0 auto (eso centra y desalinea) */
}

.kair-badge-ico {
  width: 44px; height: 44px;
  border-radius: var(--kair-radius-control);
  background: var(--kair-blue-soft); /* o blue-light, amber-soft, etc. */
  display: flex; align-items: center; justify-content: center;
  color: var(--kair-blue);
}

.kair-titles h1 {
  font: 800 clamp(22px, 2.6vw, 34px) / 1.1 var(--kair-font-display);
  color: var(--kair-ink);
  margin: 0;
}

.kair-titles .kair-subtitle {
  color: var(--kair-muted);
  font-size: clamp(13px, 1.05vw, 14px);
  margin: 4px 0 0;
}
```

**Header transparente v7** (variante sin card, sin chip empresa):
```css
/* Para módulos donde el chip empresa no aplica (ej. Inspecciones, Mantenimiento) */
.kmi-header {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 0;
  background: transparent;
  border-bottom: none;
  /* Sin divider, sin background card */
}
```

---

## 7. Sidebar premium (📦738)

4 iteraciones hasta aprobar. **Lección**: empezar minimalista.

### 7.1 Componentes del sidebar

```html
<button class="kair-nav-card">
  <span class="kair-nav-card__icon"><!-- SVG --></span>
  <span class="kair-nav-card__text">
    <span class="kair-nav-card__title">Recursos</span>
    <span class="kair-nav-card__subtitle">Capacitación, Roles</span>
  </span>
  <span class="kair-nav-card__badge">12</span> <!-- opcional -->
</button>
```

### 7.2 Estados (mínimos, decididos tras 4 iteraciones)

| Estado | Background | Border | Box-shadow | Color título |
|---|---|---|---|---|
| Normal | transparent | none | none | `--kair-ink` |
| Hover | `--kair-soft` | none | none | `--kair-ink` |
| Activo | `--kair-soft` | none | none | `--kair-blue` |

**Decisiones finales** (v4):
- Fondo transparente por default (NO `--kair-card` que se veía "gris deprimente")
- Hover y activo usan el MISMO fondo `--kair-soft`
- Sin border visible en estado normal ni activo
- Sin box-shadow en activo
- Icono sin caja de fondo — solo SVG con color

### 7.3 Lección transferible (cross-project)

> **Cuando se diseña con feedback iterativo, empezar minimalista** (sin border, sin caja, sin sombra, sin box-shadow) y agregar elementos solo si el user lo pide. Es más fácil agregar que quitar.

---

## 8. Convención de cache-bust

**Cada cambio a un CSS/JS de UI requiere bumpear cache-bust en `index.html`** porque Electron cachea agresivamente.

### 8.1 Formato

```html
<!-- CSS -->
<link rel="stylesheet" href="shared/kair-design-tokens.css?v=20260922-notifs-ui">
<link rel="stylesheet" href="shared/kair-components.css?v=20260922-notifs-ui">

<!-- JS de módulo -->
<script src="modules/gestion-salud/severidad-accidentalidad/severidad-accidentalidad.js?v=20260921-premium-v2"></script>
```

### 8.2 Cuándo bumpear

| Cambio | Bumpear en index.html |
|---|---|
| `shared/kair-design-tokens.css` | ✅ siempre |
| `shared/kair-components.css` | ✅ siempre |
| `shared/kair-premium.css` | ✅ siempre |
| `shared/kair-sidebar.css` | ✅ siempre |
| `shared/kair-calendar.css` | ✅ siempre |
| `styles.css` (legacy) | ✅ siempre |
| `renderer.js` | ✅ siempre |
| `*-home.js` de módulo | ✅ (también `?v=YYYYMMDD-vN-rediseno` o `-fix-*`) |
| `<script>` de submódulo específico | ✅ |

### 8.3 Formato del sufijo

- `20260922-notifs-ui` — feature grande
- `20260921-premium-v2` — premium v2
- `20260921-premium-header` — solo header
- `GESTION-PELIGROS-20260921-fix-home-datos` — fix específico
- `APC-20260921-v2-scroll` — fix + scope

---

## 9. Convenciones de naming (CSS)

### 9.1 Prefijos por tipo

| Prefijo | Tipo | Ejemplo |
|---|---|---|
| `.kair-*` | Componentes del design system compartido | `.kair-card`, `.kair-btn-primary` |
| `.kmi-*` | Componentes scoped de Inspecciones | `.kmi-header`, `.kmi-chart` |
| `.km-*` | Componentes scoped de Identificación de Peligros | `.km-wrapper`, `.km-donut` |
| `.mantenimiento-*` | Componentes scoped de Mantenimiento | (legacy) |
| `.kair-aud-*` | Componentes scoped de Auditoría | `.kair-aud-modal` |
| `.kair-acciones-pc-*` | Componentes scoped de Mejoramiento | — |
| `--v3-*` | Tokens scoped de Mejoramiento | `--v3-blue`, `--v3-canvas` |
| `--freq-*` / `--sev-*` / `--mort-*` / `--prev-*` / `--inc-*` | Tokens scoped de indicadores | -- |
| `--aus-*` | Tokens scoped de Ausentismo | -- |
| `--rad-desp-*` | Tokens scoped de Despliegue Estratégico | -- |
| `--aud-*` | Tokens scoped de Auditoría Anual | -- |

### 9.2 Clases PROHIBIDAS (legacy peligrosas)

- ❌ `.k-section-card` — choca con `.kair-card` semánticamente
- ❌ `.header-back-btn` — debe ser local con `.kmi-header .kmi-back`
- ❌ `.header-action--ghost` — debe ser local con `.kmi-header .kmi-action`

**Si encuentras estas en código nuevo, reescribir como scoped.**

### 9.3 Tabla blindada — clase estándar

```html
<div class="kair-table-wrap">
  <table class="kair-table">
    <thead>
      <tr><th>Col 1</th><th>Col 2</th></tr>
    </thead>
    <tbody>
      <tr><td>Dato 1</td><td>Dato 2</td></tr>
    </tbody>
  </table>
</div>
```

---

## 10. Reglas del dark mode

### 10.1 Selector único

```css
[data-theme^="dark"] { /* cubre dark + dark-legacy */ }
```

### 10.2 Inversión de tokens

```css
[data-theme^="dark"] {
  --kair-canvas: #0f1419;
  --kair-card:   #1a1f25;
  --kair-soft:   #252b32;
  --kair-ink:    #e6e9ee;
  --kair-muted:  #98a2b3;
  --kair-faint:  #6a7280;
  --kair-line:   #2a3138;
  --kair-line-soft: #232830;
  /* Acentos más claros en dark */
  --kair-blue:   #4a82d6;
  --kair-mint:   #2dd3a3;
  --kair-amber:  #f0b54a;
  --kair-red:    #e87a89;
}
```

### 10.3 SVG dark mode (patrón `tok()`)

```js
// Donut chart que cambia con el tema sin duplicar CSS
function tok(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}
```

```css
/* SVG inline que usa tokens */
.kair-donut { stroke: var(--kair-blue); }
```

---

## 11. Estructura canónica del render() de un módulo premium

```javascript
async render() {
  // 1. Injectar estilos (vacío si usa design system compartido)
  this.injectStyles();

  // 2. Layout con FLEX CHAIN (sin esto: sin scroll)
  const layout = document.createElement('div');
  layout.className = 'k-app-layout';
  layout.style.cssText = 'height: 100%; display: flex; flex-direction: column; min-height: 0;';

  // 3. Header minimal (Header v2 transparente)
  const header = document.createElement('header');
  header.className = 'kair-page-header';
  header.innerHTML = '...breadcrumb + title + actions...';

  // 4. MainArea con skeleton + flex:1 + min-height:0 + overflow-y:auto
  const mainArea = document.createElement('div');
  mainArea.className = '<modulo>-home';
  mainArea.style.cssText = 'flex: 1; min-height: 0; overflow-y: auto; padding: 0 1.5rem 1.5rem; box-sizing: border-box;';

  // 5. Cargar datos (IPC, refreshStats, loadCicloActivo)
  await this.refreshStats();
  await this.loadCicloActivo();

  // 6. Renderizar contenido premium
  await this.renderMainArea(mainArea);

  layout.appendChild(header);
  layout.appendChild(mainArea);
  container.appendChild(layout);
}

async renderMainArea(container) {
  // 1. Score compuesto (promedio simple excluyendo null)
  const score = this.calculateScore();

  // 2. Hero strip (1 hero + 3 metric cards)
  // 3. Content grid (chart + panel "En tu radar")
  // 4. Module grid (cards de submódulos con flecha)
}
```

---

## 12. Patrones de error conocidos

### 12.1 Gráfico que se sale de su tarjeta (📦757)

**Síntoma**: SVG con `position: absolute` se desborda del `.kair-chart` que mide `clamp(130px, 13vw, 170px)`.

**Fix**:
```css
.kair-chart { position: relative; overflow: hidden; height: clamp(130px, 13vw, 170px); }
.kair-chart svg { position: absolute; max-width: 100%; }
```

### 12.2 Modal sin estilos en `<body>` (📦800)

**Síntoma**: Modal vive en `<body>` fuera de `.kair-v3-module`, los `--v3-*` tokens no llegan, modal aparece sin estilos.

**Fix**: declarar tokens scoped sobre el propio modal (ver §5.3).

### 12.3 Listener stale tras destroy + re-render (📦731, 📦800)

**Síntoma**: El guard `_clickBound = false` impide re-bindear el listener tras destroy + re-render del módulo. Botón deja de funcionar al re-entrar.

**Fix**: bindear en CADA `render()`. El handler ya debe tener su guard interno (ej. `if (view !== 'hub') return;`).

### 12.4 Scroll roto del editor (📦801)

**Síntoma**: Editor con `grid-template-rows: 100px 1fr` no scrollea — el contenido se desborda sin scroll interno.

**3 causas diagnosticadas**:
1. `.kair-editor` con `align-items: start` → la fila main no se estira
2. Falta `min-height: 0` en `.kair-editor__main`
3. Vista lista usa `class="kair-app-main"` huérfana (correcta: `.kair-main`)

### 12.5 Datos que "mueren en la bodega" (📦799)

**Síntoma**: `refreshStats()` lee datos pero la vista muestra 0/0.

**Fix**: persistir el resultado en `this.*` para que la vista lo encuentre:
```js
async refreshStats() {
  const r = await fetchData();
  this.stats = r;  // ← siempre asignar a this.*
}
```

---

## 13. Cómo migrar un nuevo submódulo al sistema (premium**

Aplicado en el rango 📦739-802 (50+ submódulos). Pasos:

1. **Inventariar el submódulo**:
   - ¿Cuántas vistas tiene? (1-7 típico)
   - ¿Lee Excel, BD, o ambos?
   - ¿Genera eventos para calendario?

2. **Crear/actualizar CSS**:
   - Tokens scoped bajo el contenedor del módulo
   - Usar `kair-*` solo para componentes del design system
   - Dark mode con `[data-theme^="dark"]`

3. **Reescribir render()** (ver §11):
   - Layout con flex chain (sin esto: scroll roto)
   - Header v2 transparente
   - MainArea con `flex:1; min-height:0; overflow-y:auto`

4. **Bumpear cache-bust** en `index.html` para el `<script>` del home (no del submódulo si ya tiene cache-bust propio).

5. **Tests**: si agregas feature, agregar test en `main/test-X.js` con `$env:ELECTRON_RUN_AS_NODE=1; npx electron main/test-X.js`.

6. **Documentar**: entrada en CHANGELOG (`📦<n>`), sección en AGENTS.md, entrada en README.md Cambios Recientes.

---

## 14. Compatibilidad con legacy

El sistema legacy `--k-*` y el premium `kair-*` **coexisten**:

- `k-section-card` (legacy) NO usar en código nuevo
- `kair-card` (premium) usar en código nuevo
- Si una clase legacy está en uso, NO renombrar (rompe otros módulos que la consumen). Solo reemplazar cuando se toque el módulo entero.

**Lista de legacy peligroso** (no usar):
- `.k-section-card`
- `.header-back-btn`
- `.header-action--ghost`
- `.k-card` (sin el sufijo `-section`)

---

## 15. Glosario visual

| Término | Significado |
|---|---|
| **Premium v2** | El dialecto actual (post-📦730). Header transparente, flex chain, tokens scoped, dark unificado. |
| **Header v2** | Header system con breadcrumb + icon chip 44×44 + título Manrope + acciones. |
| **Header v7** | Variante sin background card (transparente sobre canvas). |
| **Flex chain** | `display:flex; flex-direction:column; min-height:0` obligatorio para scroll interno. |
| **Tabla blindada** | `min-width:0 !important; table-layout:fixed;` con anchos que suman 100%. |
| **Modal en body** | Modal que vive en `<body>` (no en el wrapper del módulo) → tokens scoped sobre sí mismo. |
| **Tokens scoped** | `--X-*` declarados en el contenedor del módulo, NO en `:root`. |
| **Cache-bust** | `?v=YYYYMMDD-desc` en cada CSS/JS modificado, en `index.html`. |
| **Donut theme-aware** | SVG que cambia colores con `tok('--kair-blue')` en runtime. |

---

**Última revisión:** 22 sept 2026
**Próxima revisión:** cuando se agreguen nuevos componentes al design system o se complete la sección 14 (backlog normativo).
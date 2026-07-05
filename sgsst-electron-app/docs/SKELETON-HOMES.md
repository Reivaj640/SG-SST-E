# K+AIR · Patrón de Skeleton en Homes de Módulo

> Guía específica del patrón aplicado en los 7 homes de módulo principales
> (📦491, 2026-07-04). Complementa a [`SKELETON-SYSTEM.md`](./SKELETON-SYSTEM.md).
>
> **Aplica a:** `*-home.js` de módulos principales donde se renderiza una grilla
> de widgets (KPIs) + 1-3 charts + lista de submódulos.

---

## TL;DR — El patrón canónico

```js
async render() {
    this.container.innerHTML = '';
    this.currentCompany = this.getCurrentCompany();

    // 1. Setup de layout (igual que siempre)
    this.injectStyles();
    const layout = document.createElement('div');
    /* ... header, contentContainer, mainArea ... */

    // 2. Inyectar skeleton EN mainArea (mismas cards/charts que el render real)
    mainArea.innerHTML = KairSkeleton.kpiStrip(5) + KairSkeleton.chartBars(12) + KairSkeleton.chartDonut();

    // 3. Agregar al DOM (skeleton visible inmediatamente)
    contentContainer.appendChild(mainArea);
    layout.appendChild(contentContainer);
    this.container.appendChild(layout);

    // 4. Retardo de 200ms (ojo humano necesita 12+ frames para registrar el skeleton)
    await new Promise(r => setTimeout(r, 200));

    // 5. Cargar datos async (skeleton visible mientras espera)
    await this.loadXxxStats();   // o: await this.refreshStats();

    // 6. Renderizar widgets reales (limpia el skeleton primero)
    await this.renderMainArea(mainArea);
}

async renderMainArea(container) {
    // 📦491-fix — SIEMPRE limpiar antes de pintar (sino skeleton queda apilado)
    container.innerHTML = '';

    // ... crear widgets y charts con datos reales ...
    container.appendChild(widgetsContainer);
}
```

---

## Anatomía del orden crítico

```
tiempo →

[1] container.innerHTML = ''           ← limpia la vista anterior
[2] injectStyles() + crear layout     ← estructura de la página
[3] mainArea.innerHTML = skeleton      ← skeleton inyectado en memoria
[4] appendChild al DOM                 ← skeleton VISIBLE en pantalla
[5] await setTimeout(200)              ← ojo humano registra el skeleton
[6] await loadStats()                  ← carga datos del backend
[7] renderMainArea: container.innerHTML = '' ← limpia skeleton
[8] renderMainArea: pintar widgets     ← cards reales aparecen
```

**Si invertís pasos [4] y [6]**, el await corre antes de que mainArea sea visible:
- container.innerHTML = skeleton (en memoria, no se ve)
- await this.renderMainArea() ← LIMPIA el skeleton + pinta widgets
- appendChild al DOM ← ya no hay skeleton, solo widgets

Resultado: el usuario nunca ve el skeleton. Por eso el orden es **crítico**.

---

## Mapeo de componentes KairSkeleton por home

Antes de escribir el skeleton, **leer el código de `renderMainArea`** y contar:

| Qué crear en renderMainArea | KairSkeleton equivalente |
|---|---|
| `widgetsContainer.appendChild(widget1)` | `KairSkeleton.kpiStrip(N)` (N = total widgets) |
| `widgetsContainer.appendChild(widget2)` | (incluido en el kpiStrip de arriba) |
| `chartsGrid.appendChild(chartContainer)` con `new Chart(type: 'bar')` | `KairSkeleton.chartBars(12)` |
| `chartsGrid.appendChild(chartContainer)` con `new Chart(type: 'doughnut')` | `KairSkeleton.chartDonut()` |
| `chartsGrid.appendChild(chartContainer)` con `new Chart(type: 'line')` | `KairSkeleton.chartBars(12)` (mismo skeleton, no hay variante "line") |

### Ejemplo: recursos-home.js

```js
// En renderMainArea() encontramos:
// - widgetsContainer.appendChild(createInductionWidget())   ← widget 1
// - widgetsContainer.appendChild(createTrainingWidget())     ← widget 2
// - widgetsContainer.appendChild(createCopasstWidget())      ← widget 3
// - widgetsContainer.appendChild(createComiteConvivenciaWidget()) ← widget 4
// - widgetsContainer.appendChild(createAfiliacionWidget())   ← widget 5
// - widgetsContainer.appendChild(createBudgetWidget())       ← widget 6
// - chartsGrid.appendChild(budgetChartCard)        ← chart 1 (line)
// - chartsGrid.appendChild(trainingChartCard)      ← chart 2 (bar)
// - chartsGrid.appendChild(inductionChartCard)     ← chart 3 (line)

// Entonces el skeleton correcto es:
mainArea.innerHTML =
    KairSkeleton.kpiStrip(6) +                  // 6 widgets
    KairSkeleton.chartBars(12) +                // chart 1 (line)
    KairSkeleton.chartBars(12) +                // chart 2 (bar)
    KairSkeleton.chartBars(12);                 // chart 3 (line)
```

### Conteo de los 7 homes migrados (📦491)

| Home | `kpiStrip(N)` | Charts en skeleton | Widgets reales | Charts reales |
|---|---|---|---|---|
| `gestion-integral-home.js` | 5 | 2×`chartBars(12)` | 5 (+1 condicional) | 2 bar |
| `recursos-home.js` | 6 | 3×`chartBars(12)` | 6 | 3 (line/bar/line) |
| `gestion-salud-home.js` | 6 | 2×`chartBars(12)` | 6 | 2 (bar/line) |
| `gestion-peligros-home.js` | 5 | `chartBars(12) + chartDonut()` | 5 | 2 (bar/doughnut) |
| `gestion-amenazas-home.js` | 2 | `chartBars(12) + chartDonut()` | 2 (dinámico) | 2 (bar/doughnut) |
| `verificacion-home.js` | 6 | `chartBars(12) + chartDonut()` | 6 | 2 (bar/doughnut) |
| `mejoramiento-home.js` | 5 | `chartBars(12) + chartDonut()` | 5 | 2 (bar/doughnut) |

---

## Por qué 200ms (no 16ms con requestAnimationFrame)

`requestAnimationFrame` solo garantiza **1 frame** (~16ms a 60fps). El ojo humano
necesita al menos **100-200ms** para registrar conscientemente algo nuevo en pantalla.

Sin el retardo suficiente, el skeleton se pinta y se borra en el mismo ciclo de
render, antes de que el usuario lo vea.

**Regla de oro:** `setTimeout(200)` mínimo entre `appendChild` y `await loadStats/renderMainArea`.

---

## Variaciones del patrón

### Variante A: `refreshStats` separado de `renderMainArea` (más común)

```js
async render() {
    /* setup + skeleton + appendChild + setTimeout(200) */
    await this.refreshStats();        // actualiza `this.stats` desde el store/IPC
    this.renderMainArea(mainArea);   // pinta widgets leyendo `this.stats`
}
```

**Usado en:** `gestion-salud-home.js`, `gestion-peligros-home.js`, `gestion-amenazas-home.js`.

### Variante B: `loadXxxStats` dentro de `renderMainArea` (más simple)

```js
async render() {
    /* setup + skeleton + appendChild + setTimeout(200) */
    await this.renderMainArea(mainArea);   // hace TODO: limpia + carga + pinta
}

async renderMainArea(container) {
    container.innerHTML = '';
    await this.loadGestionIntegralStats();  // carga inline
    /* pintar widgets */
}
```

**Usado en:** `gestion-integral-home.js`, `recursos-home.js`.

### Variante C: datos hardcoded / store reactivo (sin IPC)

```js
async render() {
    /* setup + skeleton + appendChild + setTimeout(200) */
    this.renderMainArea(mainArea);   // sin await (datos ya disponibles)
}
```

**Usado en:** `verificacion-home.js` (datos hardcoded), `mejoramiento-home.js` (store).

⚠️ **Para C igual necesitás el setTimeout(200)** — el `await setTimeout` corre antes
del renderMainArea, garantizando que el skeleton se vea aunque los datos sean instantáneos.

---

## Patrones que NO migran (UX correcta para esos casos)

| Patrón | Razón | Acción |
|---|---|---|
| Overlay fullscreen (`<div id="loadingOverlay">`) | Acción bloqueante ("Clonar Plan", "Generar PDF") | NO migrar |
| Spinner inline en botón (`<i class="fa-spinner"> Guardando...`) | Feedback inmediato en el mismo botón | NO migrar |
| Toast de progreso (`showLoadingToast()`) | Progreso de operación larga con título + subtítulo | NO migrar |
| Badge de status (`<i class="bi-hourglass">`) | Indicador de estado, no espera de datos | NO migrar |

---

## Verificación visual (checklist)

Después de aplicar el patrón, sincronizar y abrir la app:

1. ✅ ¿Se ve el skeleton al entrar al módulo? (200ms mínimo visible)
2. ✅ ¿El conteo de barritas coincide con las cards que aparecen después?
3. ✅ ¿Los tipos de chart (bar vs donut) coinciden con el render real?
4. ✅ ¿El skeleton DESAPARECE completamente cuando llegan los datos?
5. ✅ ¿No queda skeleton apilado DEBAJO de las cards reales?
6. ✅ ¿Funciona en light Y dark mode?
7. ✅ ¿El shimmer se ve animado mientras esperás?

Si alguna falla, ver la sección **Troubleshooting** en `SKELETON-SYSTEM.md`.

---

## Script automatizado de detección de bugs

Para detectar el bug "await renderMainArea antes de appendChild", correr este script
en el directorio del proyecto:

```bash
node -e "
const fs=require('fs');
const path=require('path');
const homes = [
    'modules/gestion-integral/gestion-integral-home.js',
    'modules/recursos/recursos-home.js',
    'modules/gestion-salud/gestion-salud-home.js',
    'modules/gestion-peligros/gestion-peligros-home.js',
    'modules/gestion-amenazas/gestion-amenazas-home.js',
    'modules/verificacion/verificacion-home.js',
    'modules/mejoramiento/mejoramiento-home.js'
];
homes.forEach(f => {
    const code = fs.readFileSync(f, 'utf8');
    const hasRender = /async\s+render\s*\(\s*\)/.test(code);
    if (hasRender) {
        const renderStart = code.indexOf('async render()');
        const renderEnd = code.indexOf('    }', renderStart) + 5;
        const body = code.slice(renderStart, renderEnd);
        const skeletonIdx = body.indexOf('KairSkeleton');
        const awaitIdx = body.indexOf('await this.renderMainArea');
        const appendIdx = body.indexOf('this.container.appendChild(layout)');
        if (skeletonIdx > 0 && awaitIdx > 0 && appendIdx > 0) {
            if (awaitIdx < appendIdx) {
                console.log('  ⚠️  POTENTIAL BUG en ' + f);
            } else {
                console.log('  ✅ ' + path.basename(f) + ' correcto');
            }
        }
    }
});
"
```

Output esperado: 7 líneas con ✅. Si alguna muestra ⚠️, revisar el orden en ese archivo.

---

## Changelog del patrón

- **📦491 (2026-07-04)** — Implementación inicial en 7 homes principales
- **📦491-fix (2026-07-04)** — Microtask delay con `requestAnimationFrame` (16ms)
- **📦491-fix2 (2026-07-04)** — Aumento del delay a `setTimeout(200)` para visibilidad humana
- Pendiente: **📦492** — Aplicar a dashboards (`archivo-retencion-dashboard.js` + otros)
- Pendiente: **📦493** — Aplicar a homes de submódulos de Gestión Salud (5 homes IIFE)
# K+AIR · Sistema de Skeleton Screens

> Sistema centralizado de esqueletos de carga (skeleton screens) para reemplazar
> spinners genéricos por placeholders que imitan la forma del componente real.
>
> **Versión:** 1.0 · **Introducido en:** 📦483 (2026-07-04)
>
> **API:** `window.KairSkeleton.*` (ver [`shared/kair-skeleton.js`](../shared/kair-skeleton.js))
>
> **Demo interactivo:** [`docs/skeleton-demo.html`](./skeleton-demo.html)

---

## Por qué skeletons y no spinners

| Antes (spinner) | Ahora (skeleton) |
|---|---|
| ❌ El usuario no sabe qué va a aparecer | ✅ Ve la estructura del componente mientras carga |
| ❌ Sensación de "la app se trabó" | ✅ Sensación de velocidad (percepción < 100ms) |
| ❌ Inconsistente entre vistas (cada una con su spinner) | ✅ Sistema unificado, mismas reglas en toda la app |
| ❌ Rompe el ritmo visual al terminar la carga | ✅ Transición suave (estructura → datos reales) |

---

## API rápida

Todas las funciones devuelven un string HTML listo para inyectar:

```js
// Primitiva
KairSkeleton.bar({ variant, width, height, style })

// Componentes
KairSkeleton.kpiStrip(count)        // tira de N cards KPI (default 4)
KairSkeleton.table(rows, cols)       // tabla con header + filas (default 8×6)
KairSkeleton.chartBars(bars)         // chart de barras (default 12)
KairSkeleton.chartDonut()            // donut + leyenda lateral
KairSkeleton.filters(count)         // barra de filtros (default 4)
KairSkeleton.section(opts)          // header de sección (título + subtítulo + botón)
KairSkeleton.form(fields)           // formulario (default 6 campos)
KairSkeleton.detail(items)          // vista detalle (default 5 items)
KairSkeleton.list(count)            // lista con avatares (default 8 items)
KairSkeleton.card(opts)             // card individual (imagen opcional)

// Helpers
KairSkeleton.show(target, component, opts)   // inyecta en un contenedor
KairSkeleton.hide(target)                    // limpia el contenedor
```

---

## Uso básico (3 líneas)

```js
// 1. Cargar shared/kair-skeleton.js (ya está en index.html globalmente)
<script src="shared/kair-skeleton.js"></script>

// 2. Antes de la carga async
container.innerHTML = KairSkeleton.table(10, 5);

// 3. Cuando llegan los datos — pintar el contenido real
container.innerHTML = renderRealData(data);
```

## Uso con helpers (más limpio)

```js
// Inyecta skeleton + guarda estado
KairSkeleton.show('#statsContainer', 'kpiStrip', { count: 4 });

// Después de la carga
KairSkeleton.hide('#statsContainer');
document.querySelector('#statsContainer').innerHTML = renderKPIs(data);
```

---

## Cuándo usar cada componente

| Si vas a mostrar... | Usa... | Ejemplo |
|---|---|---|
| Una fila de KPIs arriba del contenido | `KairSkeleton.kpiStrip(4)` | Estadísticas, dashboard |
| Una tabla/lista de N items | `KairSkeleton.table(rows, cols)` o `KairSkeleton.list(n)` | Seguimientos, registros |
| Un gráfico de barras (meses, categorías) | `KairSkeleton.chartBars(12)` | Charts Chart.js |
| Un gráfico circular/donut | `KairSkeleton.chartDonut()` | Distribución por tipo |
| Una barra de filtros arriba | `KairSkeleton.filters(4)` | Filtros de búsqueda |
| Un encabezado con título + botón | `KairSkeleton.section()` | Top de sección |
| Un formulario con N campos | `KairSkeleton.form(6)` | Wizard, edición |
| Una vista de detalle (label: valor) | `KairSkeleton.detail(5)` | Preview de documento |
| Una lista de items con avatar | `KairSkeleton.list(8)` | Biblioteca, folders |
| Una card individual | `KairSkeleton.card({ image: true })` | Card de informe |

---

## Patrón típico de integración

```js
async function loadData() {
  // 1. Mostrar skeleton
  container.innerHTML = KairSkeleton.table(10, 5);

  try {
    // 2. Cargar datos via IPC
    const result = await window.electronAPI.readSomething();

    // 3. Renderizar datos reales
    container.innerHTML = result.success
      ? renderRealTable(result.data)
      : renderError(result.error);
  } catch (err) {
    container.innerHTML = renderError(err.message);
  }
}
```

Para tablas que ya tienen `<tbody>`, podés usar el patrón con `<td colspan>`:

```js
// Dentro de render() de un componente
container.innerHTML = `
  <table>
    <thead>...</thead>
    <tbody>
      <tr>
        <td colspan="5" class="ks-loading-cell" style="padding:16px;">
          ${KairSkeleton.table(8, 5)}
        </td>
      </tr>
    </tbody>
  </table>
`;

// Después de la carga:
tbody.innerHTML = rows.map(row => `<tr>${cells}</tr>`).join('');
```

---

## Theming automático (light/dark)

El sistema detecta el tema actual vía atributo `[data-theme="dark"]` en `<html>` y ajusta
los colores del shimmer automáticamente via variables CSS:

```css
:root {
  --ks-base: rgba(226, 232, 240, 0.55);     /* light */
  --ks-highlight: rgba(203, 213, 225, 0.95);
}
[data-theme="dark"] {
  --ks-base: rgba(51, 65, 85, 0.45);         /* dark */
  --ks-highlight: rgba(100, 116, 139, 0.95);
}
```

**No tenés que hacer nada** — los skeletons se adaptan solos.

---

## Reduced motion

Si el usuario tiene `prefers-reduced-motion: reduce` activado en su OS,
las animaciones se desactivan automáticamente (los skeletons se ven estáticos).

---

## Patrones que NO migran (UX correcta)

Algunos loadings de la app **no se reemplazan** por skeletons porque el patrón
actual es el correcto para esos casos:

| Patrón | Por qué se queda | Ejemplo |
|---|---|---|
| **Overlay fullscreen con spinner grande** | El usuario espera un overlay cuando hace click en "Generar informe PDF" o "Clonar plan". Es una acción bloqueante. | `plan-home.js`, `rendicion-home.js`, todos los `*-viewer.js` |
| **Badge inline en botón** (`Guardando...`) | El usuario clickeó un botón y espera feedback inmediato en el mismo botón. | `saveBtn.innerHTML = '<i class="fa-spinner"> Guardando...'` |
| **Toast de progreso** (`showLoadingToast()`) | Progreso de operación larga con título + subtítulo. | `registrar-ausentismo.js` |

**Regla:** si la operación es **bloqueante y centrada en una acción del usuario**,
usá overlay. Si la operación es **cargar datos que se mostrarán en un contenedor**,
usá skeleton.

---

## Clases CSS nuevas (`.ks-*`)

| Clase | Uso |
|---|---|
| `.ks-bar` | Primitiva (barrita con shimmer) |
| `.ks-bar.ks-text` / `.ks-text-sm` / `.ks-text-lg` / `.ks-title` / `.ks-number` / `.ks-avatar` / `.ks-button` | Variantes de forma |
| `.ks-stagger` | Cascada de delays para efecto "respiración" |
| `.ks-kpi-strip` / `.ks-kpi-card` / `.ks-kpi-body` | Tira de KPIs |
| `.ks-table` / `.ks-table__header` / `.ks-table__row` | Tabla con header |
| `.ks-chart` / `.ks-chart__header` / `.ks-chart__body--bars` / `--donut` | Charts |
| `.ks-donut` / `.ks-donut-legend` | Donut |
| `.ks-filters` | Barra de filtros |
| `.ks-section` / `.ks-section__head` | Header de sección |
| `.ks-form` / `.ks-form__field` | Formulario |
| `.ks-detail` / `.ks-detail__row` | Vista detalle |
| `.ks-list` / `.ks-list__item` / `.ks-list__body` | Lista |
| `.ks-card` / `.ks-card__body` | Card |
| `.ks-skeleton-state` | Wrapper de estado skeleton |
| `.ks-loading-cell` | Celdas de tabla con skeleton (uso opcional) |

Todas respetan `[data-theme="dark"]` automáticamente.

---

## Vistas migradas (referencia)

Las siguientes vistas usan `KairSkeleton.*` desde 📦484:

| Módulo | Archivo | Componentes usados |
|---|---|---|
| Gestión Salud · Medición Ausentismo | `medicion-ausentismo.js` | `table`, `kpiStrip`, `chartBars` |
| Gestión Salud · Investigación Accidentes | `investigaciones-viewer.js` | `list`, `detail` |
| Gestión Salud · Investigación Accidentes (modal save) | `investigacion-accidentes-main.js` | `list` |
| Gestión Salud · Restricciones Médicas (docs) | `remisiones-viewer.js` | `list`, `detail` |
| Gestión Salud · Restricciones Médicas (vista previa) | `restricciones-viewer.js` | `detail` |
| Gestión Salud · Evaluaciones Médicas (lib + preview) | `evaluaciones-medicas-viewer.js` | `list`, `detail` |
| Gestión Salud · Reportes Accidentes (preview + biblioteca) | `reportes-accidentes-viewer.js` | `detail`, `list` |
| Gestión Salud · Consulta Trabajadores | `consulta-trabajadores.js` | `list` |
| Gestión Salud · Severidad Accidentalidad | `severidad-accidentalidad.js` | `chartBars` |
| Gestión Salud · Frecuencia Accidentalidad | `frecuencia-accidentalidad.js` | `chartBars` |
| Gestión Peligros · Mantenimiento (resumen + cronograma + evidencias) | `resumen-mant.js`, `mantenimiento-component.js`, `cronograma-mant.js` | `kpiStrip`, `list` |
| Gestión Peligros · Inspecciones (formulario + historial) | `inspecciones-component.js`, `formulario-insp.js`, `historial-insp.js` | `form`, `list` |

---

## Agregar skeletons a una vista nueva (checklist)

1. **Cargá el script** en `index.html` si todavía no está (ya está global desde 📦484).
2. **Identificá qué se va a mostrar** cuando lleguen los datos.
3. **Elegí el componente** de la tabla "Cuándo usar cada componente".
4. **Reemplazá el HTML de loading**:
   ```diff
   - container.innerHTML = '<div class="my-loading"><spinner>...</spinner></div>';
   + container.innerHTML = KairSkeleton.table(10, 5);
   ```
5. **Validá** que el skeleton se vea bien en light y dark.
6. **No borres** las CSS obsoletas de otras vistas (cleanup se hace en otra fase).

---

## Limitaciones conocidas

- **Tablas complejas con rowspan/colspan**: usar `KairSkeleton.list(N)` en lugar de `.table()`.
  Las tablas planas NxM no capturan bien la estructura irregular.
- **Contenido muy específico**: si el componente real tiene una forma única (ej: wizard
  de 3 pasos, dashboard con widgets custom), podés combinar primitivas `.ks-bar()` para
  construir el skeleton manualmente.

---

## Mantenimiento

- **CSS**: bloque marcado con `📦483` en `styles.css` (~341 líneas al final).
- **JS**: [`shared/kair-skeleton.js`](../shared/kair-skeleton.js) (~280 líneas, IIFE).
- **Demo**: [`docs/skeleton-demo.html`](./skeleton-demo.html) — abrir en navegador para ver
  los 10 componentes en vivo con toggle dark mode.

---

## Changelog

- **📦483 (2026-07-04)** — Release inicial del sistema v1.0
  - `shared/kair-skeleton.js` con API completa
  - Bloque CSS `.ks-*` en `styles.css`
  - Demo interactivo
- **📦484 (2026-07-04)** — Piloto en Medición Ausentismo
- **📦485-488 (2026-07-04)** — Migración de 9 vistas en Gestión Salud y Gestión Peligros
- **📦490 (2026-07-04)** — Cleanup: borrar CSS obsoletas, helpers JS, crear esta documentación
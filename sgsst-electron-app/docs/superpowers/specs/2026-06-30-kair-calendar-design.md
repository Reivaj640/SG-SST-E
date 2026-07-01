# K+AIR Calendar — Design Spec

**Fecha:** 2026-06-30
**Autor:** brainstorming con el usuario (Prof. SST, K+AIR)
**Estado:** Borrador para revisión

---

## 1. Resumen

Reemplazar el mini-popup inútil del botón `#calendar-button` del header de K+AIR (SG-SST Electron) por un **calendario central de actividades** inspirado en Bitrix24. Permite al usuario ver, en una sola pantalla, todas las actividades agendadas del Plan de Trabajo Anual, Capacitaciones, fases de Auditoría, y crear eventos rápidos propios sin navegar a un módulo específico.

## 2. Objetivos

- **Centralizar** la visualización de fechas/eventos que hoy están dispersos en 4+ módulos.
- **Reducir fricción** del usuario: 1 click en el header → ver todo lo agendado.
- **Permitir crear** eventos rápidos (recordatorios, reuniones ad-hoc) sin abrir un módulo.
- **Preservar la verdad** de los datos: cada evento sigue "viviendo" en su módulo origen. El calendario es una vista agregada, no una fuente nueva de verdad (excepto los "rápidos" que sí son nuevos).

## 3. No-objetivos (out of scope v1)

- Sincronización con Google Calendar / Outlook / iCloud.
- Notificaciones push (recordatorios que avisen X minutos antes).
- Vista "Programar" (lista cronológica completa de próximos eventos) — el botón ya está en la UI pero queda en blanco en v1; queda para v2.
- Edición de eventos del Plan de Trabajo / Capacitaciones / Auditoría desde el calendario. Click navega al módulo origen.
- Investigación de accidentes, COPASST, Rev. Alta Dirección, Exámenes médicos (v2).

## 4. Arquitectura

### 4.1 Estructura de archivos

```
shared/
  kair-calendar.css         ← extraído del standalone (líneas 99-1392)
  kair-calendar.js          ← extraído del standalone (líneas 1421-2538)
  kair-calendar-adapter.js  ← NUEVO — une las 4 fuentes de datos
  k-sileo.js, k-sileo.css   ← ya existen, patrón de referencia

modules/shared/
  calendar-detail-panel.js  ← NUEVO — side panel de detalle (decisión Q3)

main/
  eventos-rapidos-bridge.js ← NUEVO — IPC + SQLite para eventos rápidos
  (otros bridges existentes se extienden mínimamente para exponer getEvents)

renderer.js                 ← MODIFICADO — reemplazar toggleCalendarModal
index.html                  ← MODIFICADO — cargar los 3 nuevos <script>/<link>

docs/superpowers/specs/
  2026-06-30-kair-calendar-design.md   ← este documento
```

### 4.2 Patrón de componente

`KairCalendar` ya está implementado como IIFE vanilla JS sin dependencias, exportado en `window.KairCalendar.create(options)`. Patrón idéntico a `k-sileo.js` ya en uso. Acepta:

```js
window.KairCalendar.create({
  triggerSelector: '#calendar-button',  // botón del header
  anchor: 'right',
  inline: false,
  initialView: 'month',
  showSidebar: true,
  eventTypes: [...],                     // 5 tipos SG-SST
  adapter: window.KairCalendarAdapter,   // ← NUEVO en SG-SST
  onEventClick: window.calendarDetailPanel.open   // ← NUEVO en SG-SST
});
```

### 4.3 Adaptador SG-SST

`shared/kair-calendar-adapter.js` implementa el contrato `list/create/update/remove`:

| Operación | Comportamiento |
|-----------|----------------|
| `list(range)` | Agrega eventos de las 4 fuentes en paralelo vía `Promise.all`. Devuelve array unificado. |
| `create(event)` | Solo si `event.type === 'rapido'`. Persiste en SQLite tabla `eventos_rapidos`. Otros tipos: rechaza con error claro. |
| `update(event)` | Solo si id empieza con `rapido-`. Igual que create. |
| `remove(id)` | Solo si id empieza con `rapido-`. |

Las 4 fuentes consultadas:

| Fuente | IPC | Datos que retorna |
|--------|-----|-------------------|
| Plan de Trabajo | `electronAPI.planTrabajo.getEvents({ start, end })` (handler NUEVO, lee del Excel del cronograma vía `auditoria-anual-bridge.js`) | `{ id: 'plan-XYZ', title, date, start, end, type: 'plan' }` |
| Capacitaciones | `electronAPI.capacitaciones.getEvents({ start, end })` (handler NUEVO, lee de `get-capacitaciones-sheets`) | `{ id: 'cap-XYZ', title, date, start, end, type: 'capacitacion' }` |
| Auditoría anual | `electronAPI.auditoria.getFases({ start, end })` (handler NUEVO, lee de `kair-store` auditoria) | `{ id: 'aud-XYZ', title, date, start, end, type: 'auditoria' }` |
| Eventos rápidos | `electronAPI.eventosRapidos.list({ start, end })` (handler NUEVO, tabla SQLite nueva) | `{ id: 'rapido-XYZ', title, date, start, end, type: 'rapido' }` |

### 4.4 Tipos de evento

5 tipos, colores siguiendo convención Bootstrap/SG-SST:

| `type` | Color | Origen |
|--------|-------|--------|
| `plan` | `#174ea6` (azul) | Plan Trabajo |
| `capacitacion` | `#28a745` (verde) | Capacitaciones |
| `auditoria` | `#ffc107` (amarillo) | Fases auditoría |
| `rapido` | `#6c757d` (gris) | Eventos rápidos |
| `vencido` | `#dc3545` (rojo) | Auto-calculado (no se almacena, se calcula al renderizar si `date < hoy AND estado !== 'cerrado'`) |

## 5. Cambios por archivo

### 5.1 `shared/kair-calendar.css`

Copia literal del bloque CSS del standalone. Sin modificaciones (los tokens ya están aislados con `--kair-cal-*`, no colisionan con nada).

### 5.2 `shared/kair-calendar.js`

Copia literal del bloque JS del standalone. Sin modificaciones. Exporta `window.KairCalendar`.

### 5.3 `shared/kair-calendar-adapter.js` (NUEVO)

```js
window.KairCalendarAdapter = (function () {
  'use strict';

  async function list(range) {
    try {
      const [plan, cap, aud, rap] = await Promise.all([
        window.electronAPI.planTrabajo.getEvents(range).catch(() => ({ success: false, data: [] })),
        window.electronAPI.capacitaciones.getEvents(range).catch(() => ({ success: false, data: [] })),
        window.electronAPI.auditoria.getFases(range).catch(() => ({ success: false, data: [] })),
        window.electronAPI.eventosRapidos.list(range).catch(() => ({ success: false, data: [] })),
      ]);
      const data = [
        ...(plan.data || []),
        ...(cap.data || []),
        ...(aud.data || []),
        ...(rap.data || []),
      ];
      return { success: true, data };
    } catch (e) {
      return { success: false, error: { message: e.message } };
    }
  }

  async function create(ev) {
    if (ev.type !== 'rapido') {
      return { success: false, error: { message: 'Solo se pueden crear eventos rápidos desde el calendario. Los demás se editan en su módulo.' } };
    }
    return window.electronAPI.eventosRapidos.create(ev);
  }

  async function update(ev) {
    if (!ev.id || !ev.id.startsWith('rapido-')) {
      return { success: false, error: { message: 'Solo se pueden editar eventos rápidos desde el calendario.' } };
    }
    return window.electronAPI.eventosRapidos.update(ev);
  }

  async function remove(id) {
    if (!id || !id.startsWith('rapido-')) {
      return { success: false, error: { message: 'Solo se pueden eliminar eventos rápidos desde el calendario.' } };
    }
    return window.electronAPI.eventosRapidos.remove(id);
  }

  return { list, create, update, remove };
})();
```

### 5.4 `modules/shared/calendar-detail-panel.js` (NUEVO)

Side panel HTML flotante desde la derecha, ~400px ancho, muestra:
- Título del evento
- Tipo (badge con color)
- Fecha + hora
- Descripción
- Botón "Ir al módulo" (visible solo si NO es tipo `rapido`)

Sigue el patrón IIFE + export a `window.calendarDetailPanel`.

API: `open(event)` / `close()`.

Click en "Ir al módulo" decide según `event.type`:
- `plan` → `KairStore.goPlanTrabajo()` + cerrar calendario + panel
- `capacitacion` → `KairStore.goCapacitaciones()` + idem
- `auditoria` → `KairStore.goAuditoria()` + idem
- `rapido` → no muestra el botón (se edita desde el modal nativo del calendario)

### 5.5 `main/eventos-rapidos-bridge.js` (NUEVO)

Tabla SQLite nueva:

```sql
CREATE TABLE IF NOT EXISTS eventos_rapidos (
  id TEXT PRIMARY KEY,           -- 'rapido-' + uuid
  titulo TEXT NOT NULL,
  fecha TEXT NOT NULL,            -- ISO YYYY-MM-DD
  hora_inicio TEXT,               -- HH:MM opcional
  hora_fin TEXT,                  -- HH:MM opcional
  tipo TEXT DEFAULT 'rapido',
  descripcion TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_eventos_rapidos_fecha ON eventos_rapidos(fecha);
```

IPC handlers (en `main.js` o en el bridge):
- `eventos-rapidos:list({ start, end })` → SELECT
- `eventos-rapidos:create(event)` → INSERT, devuelve id generado
- `eventos-rapidos:update(event)` → UPDATE WHERE id
- `eventos-rapidos:remove(id)` → DELETE WHERE id

Preload expone en `window.electronAPI.eventosRapidos.{list,create,update,remove}`.

### 5.6 Bridges existentes (extensiones mínimas)

Agregar método `getEvents` (o `getFases`) a los bridges existentes:

| Bridge | Agregar | Devuelve |
|--------|---------|----------|
| `plan-trabajo-bridge.js` | handler `plan-trabajo:get-events` | Lee del cronograma Excel (mismo código que usa `auditoria-anual-bridge.js`), mapea cada actividad a `{ id: 'plan-XYZ', title, date, start, end, type: 'plan' }` |
| `capacitaciones-bridge.js` | handler `capacitaciones:get-events` | Lee del Excel de capacitaciones, mapea |
| `auditoria-anual-bridge.js` | handler `auditoria:get-fases` | Lee de `kair-store`, mapea fases a eventos |

Cada uno es < 50 líneas, solo mapping, sin lógica nueva.

### 5.7 `renderer.js` (MODIFICADO)

**Eliminar** (líneas 1693-1842 aprox):
- `let isCalendarModalVisible`
- `let calendarModalElement`
- `function toggleCalendarModal()`
- `function showCalendarModal()`
- `function hideCalendarModal()`

**Agregar** (en `initializeApp` o equivalente, cerca del listener de `#calendar-button`):

```js
// Inicializar calendario K+AIR (reemplaza mini-popup viejo)
window.kairCal = window.KairCalendar.create({
  triggerSelector: '#calendar-button',
  anchor: 'right',
  inline: false,
  initialView: 'month',
  initialDate: new Date(),
  locale: 'es',
  showSidebar: true,
  eventTypes: [
    { id: 'plan',         label: 'Plan de Trabajo',     color: '#174ea6' },
    { id: 'capacitacion', label: 'Capacitación',        color: '#28a745' },
    { id: 'auditoria',    label: 'Auditoría',           color: '#ffc107' },
    { id: 'rapido',       label: 'Evento rápido',       color: '#6c757d' },
    { id: 'vencido',      label: 'Vencido',             color: '#dc3545' }
  ],
  adapter: window.KairCalendarAdapter,
  onEventClick: function (ev) {
    if (ev.type === 'rapido') {
      // El calendario ya abre su modal nativo de edición
      return;
    }
    window.calendarDetailPanel.open(ev);
  }
});
```

### 5.8 `index.html` (MODIFICADO)

Agregar antes de `renderer.js`:

```html
<link rel="stylesheet" href="shared/kair-calendar.css" />
<script src="shared/kair-calendar.js"></script>
<script src="shared/kair-calendar-adapter.js"></script>
<script src="modules/shared/calendar-detail-panel.js"></script>
```

## 6. UX — flujo del usuario

1. Usuario abre la app → ve header con botón calendario (ícono actual sin cambios).
2. Click en `#calendar-button` → popover 920px se despliega debajo del botón.
3. Ve mes actual con eventos de las 4 fuentes coloreados según tipo.
4. Sidebar izquierdo muestra mini-calendario (con puntos rojos en días con eventos) + leyenda de tipos.
5. Click en una flecha ◄ ► → navega mes anterior/siguiente.
6. Click en "Hoy" → vuelve al día actual.
7. Tabs Día/Semana/Mes/Programar → cambia vista. (Programar muestra "Próximamente" en v1.)
8. Click en "+ Crear" → modal de crear evento rápido.
9. Click en un evento `rapido` → modal de edición (propio del calendario).
10. Click en un evento de plan/cap/aud → side panel detalle con botón "Ir al módulo".
11. Click fuera o ESC → cierra el calendario.

## 7. Manejo de errores

| Caso | Comportamiento |
|------|----------------|
| Alguna fuente de datos falla (ej: archivo Excel no se puede leer) | El adapter loggea warning y devuelve `[]` para esa fuente. Las demás siguen funcionando. |
| SQLite no disponible (caso muy raro) | Toast rojo "No se pudo guardar el evento. Reintentá." |
| Evento de tipo no-rápido intentando crear/editar/eliminar | Adapter rechaza con error claro. Toast rojo. |
| Click en evento cuyo módulo origen ya no existe | Botón "Ir al módulo" oculto, side panel solo muestra info. |

## 8. Testing

- **Manual QA en cada ambiente** (instalador + clon dev).
- Verificar que el calendario abre con click en header, cierra con click fuera / ESC.
- Verificar que se ven eventos de cada fuente cuando hay datos.
- Verificar que crear/editar/eliminar un evento rápido persiste y aparece después de reload.
- Verificar que el side panel navega correctamente al módulo origen.
- Verificar dark mode (los tokens `--kair-cal-*` deberían funcionar en ambos; verificar contraste).

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Los bridges existentes no exponen `getEvents` y hay que escribir código nuevo | Tarea explícita en el plan; < 50 LOC por bridge |
| Performance: cargar 4 fuentes en paralelo puede ser lento | `Promise.all` con timeout de 5s por fuente; mostrar eventos parciales si alguna falla |
| El CSS del calendario choca con algo del proyecto | Todos los selectores tienen prefijo `kair-cal-*` — confirmado en standalone |
| Dark mode no se ve bien | Agregar overrides en `shared/kair-calendar.css` con selectores `[data-theme="dark"] .kair-cal-*` (mínimo trabajo, ~30 líneas) |
| El usuario abre 2 calendarios a la vez | El componente ya previene esto: un solo popover por instancia |

## 10. Out of scope explícito (v2+)

- Sincronización Google / Outlook / iCloud.
- Notificaciones push (toast de Windows nativo).
- Vista "Programar" funcional.
- Investigación accidentes, COPASST, Exámenes médicos, Rev. Alta Dirección.
- Drag & drop para reagendar.
- Edición inline de eventos no-rápidos.
- Móvil / responsive (< 768px ya contemplado en standalone, pero no priorizado).
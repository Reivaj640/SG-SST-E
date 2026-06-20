# PORT_PLAN.md — Port de Next.js → vanilla JS para 6.1.2

**Fecha**: 2026-06-19
**Origen**: `tmp/workspace-new-6.1.2/` (Next.js 14 + React + TS + Tailwind + shadcn/ui)
**Destino**: `sgsst-electron-app/modules/verificacion/auditoria-anual/v3/`
**Stack destino**: Electron + vanilla JS + CSS K+AIR + SQLite (vía IPC)

---

## 1. Inventario del proyecto origen (16 archivos · 274KB)

| Archivo | Tipo | Tamaño | Prioridad |
|---------|------|--------|-----------|
| `KairHeader.tsx` | utility | 5.7KB | F1 |
| `KairKpiStrip.tsx` | utility | 2.3KB | F1 |
| `KairBadge.tsx` | utility | 0.8KB | F1 |
| `views/HubView.tsx` | vista | 16.0KB | F3 |
| `views/ListView.tsx` | vista | 14.0KB | F4 |
| `views/EditorView.tsx` | vista | 18.0KB | F5 |
| `views/HallazgosView.tsx` | vista | 22.0KB | F6 |
| `views/CronogramaView.tsx` | vista | 33.0KB | F7 |
| `views/InformesView.tsx` | vista | 22.0KB | F8 |
| `sections/CronogramaSection.tsx` | sección | 10.1KB | F7 |
| `sections/PlanSection.tsx` | sección | 8.6KB | F5 |
| `sections/PlanAccionSection.tsx` | sección | 13.4KB | F5 |
| `sections/EjecucionSection.tsx` | sección | 10.7KB | F5 |
| `sections/DesempenoSection.tsx` | sección | 15.0KB | F5 |
| `sections/HallazgosSection.tsx` | sección | 18.3KB | F5/F6 |
| `sections/InformeSection.tsx` | sección | 11.9KB | F5/F8 |
| `lib/kair/types.ts` | modelo | 6.0KB | F2 |
| `lib/kair/helpers.ts` | utils | 5.9KB | F2 |
| `lib/kair/mockData.ts` | datos | 31.4KB | F2 |
| `lib/kair/store.ts` | estado | 15.0KB | F2 |

**Total**: 274.5KB → ~12-18KB de código vanilla equivalente (factor compresión 0.04-0.07).

---

## 2. Mapeo de dependencias

| Dependencia origen | Reemplazo vanilla | Notas |
|--------------------|-------------------|-------|
| React + JSX | `document.createElement` + `innerHTML` | Helper `h(tag, props, ...children)` |
| TypeScript | Quitar tipos, dejar JSDoc | Más rápido de mantener |
| Tailwind | CSS K+AIR + tokens en v3.css | Mapeo tabla abajo |
| shadcn/ui (40+ componentes) | Helpers `kair-ui.js` con 8-10 componentes clave | Card, Button, Badge, Dialog, Input, Select, Textarea, Tabs, Tooltip |
| lucide-react | bootstrap-icons (ya disponibles) | Mapeo en `kair-icons.js` |
| @dnd-kit | HTML5 drag&drop API nativa | Sin dependencia |
| @mdxeditor/editor | textarea + preview básico | Funcional, no WYSIWYG |
| Prisma | Tu SQLite + bridge IPC actual | Reusar `main/auditoria-anual-bridge.js` |
| Zustand | Patrón pub/sub: `kairStore.subscribe(fn)` | ~30 líneas, sin dependencia |
| shadcn form (react-hook-form + zod) | Validación inline en handlers | Más simple para vanilla |
| next/image | `<img>` nativo | OK |
| next/link | Navegación manual + `navigate()` | Ya tienes el patrón |

---

## 3. Mapeo Tailwind classes → K+AIR CSS

### Colores
| Tailwind | K+AIR CSS |
|----------|-----------|
| `bg-background` | `background: var(--kair-app-bg)` |
| `bg-card` | `background: var(--kair-card-bg)` |
| `bg-primary` | `background: var(--kair-primary)` |
| `bg-secondary` / `bg-accent` | `background: var(--kair-tint-blue)` |
| `bg-muted` | `background: var(--kair-neutral-soft)` |
| `bg-destructive` | `background: var(--kair-danger)` |
| `text-foreground` | `color: var(--kair-text-strong)` |
| `text-muted-foreground` | `color: var(--kair-text-muted)` |
| `text-primary` | `color: var(--kair-primary)` |
| `text-destructive` | `color: var(--kair-danger)` |
| `border-border` | `border: 1px solid var(--kair-border)` |
| `ring-ring` | `box-shadow: 0 0 0 3px rgba(23, 78, 166, 0.12)` |

### Layout
| Tailwind | K+AIR |
|----------|-------|
| `flex` | `display: flex` |
| `grid grid-cols-{n}` | `display: grid; grid-template-columns: repeat(n, 1fr)` |
| `gap-{n}` | `gap: var(--kair-s${n})` |
| `p-{n}` | `padding: ${n * 0.25}rem` |
| `rounded-{sm,md,lg}` | `border-radius: var(--kair-radius-${size})` |
| `max-w-{size}` | `max-width: ${value}` |

### Tipografía
| Tailwind | K+AIR |
|----------|-------|
| `text-xs` | `font-size: 0.75rem` |
| `text-sm` | `font-size: 0.875rem` |
| `text-base` | `font-size: 1rem` |
| `text-lg/xl/2xl/3xl` | `font-size: 1.125/1.25/1.5/1.875rem` |
| `font-bold` | `font-weight: 700` |
| `font-semibold` | `font-weight: 600` |
| `font-medium` | `font-weight: 500` |

---

## 4. Mapeo lucide-react → bootstrap-icons

| lucide | bootstrap |
|--------|-----------|
| `ClipboardList` | `bi-clipboard-check` |
| `AlertTriangle` | `bi-exclamation-triangle` |
| `CalendarDays` | `bi-calendar3` |
| `FileText` | `bi-file-earmark-text` |
| `ArrowRight` | `bi-chevron-right` |
| `ShieldCheck` | `bi-shield-check` |
| `TrendingUp` | `bi-graph-up-arrow` |
| `Plus` | `bi-plus-lg` |
| `Edit` | `bi-pencil` |
| `Trash` | `bi-trash` |
| `Eye` | `bi-eye` |
| `X` | `bi-x-lg` |
| `Check` | `bi-check-lg` |
| `MoreVertical` | `bi-three-dots-vertical` |
| `Search` | `bi-search` |
| `Filter` | `bi-funnel` |
| `Download` | `bi-download` |
| `Upload` | `bi-upload` |
| `Save` | `bi-save` |
| `User` | `bi-person` |
| `Users` | `bi-people` |
| `Calendar` | `bi-calendar` |
| `Clock` | `bi-clock` |
| `MapPin` | `bi-geo-alt` |
| `Tag` | `bi-tag` |
| `Flag` | `bi-flag` |
| `Hash` | `bi-hash` |
| `Link` | `bi-link-45deg` |
| `ExternalLink` | `bi-box-arrow-up-right` |
| `Info` | `bi-info-circle` |
| `AlertCircle` | `bi-exclamation-circle` |
| `CheckCircle` | `bi-check-circle` |
| `XCircle` | `bi-x-circle` |
| `HelpCircle` | `bi-question-circle` |
| `ChevronDown/Up/Left/Right` | `bi-chevron-down/up/left/right` |
| `ChevronsUp/Down` | `bi-chevron-double-up/down` |
| `GripVertical` | `bi-grip-vertical` |
| `Circle` | `bi-circle` |
| `Dot` | `bi-dot` |

---

## 5. Estructura de carpetas destino

```
modules/verificacion/auditoria-anual/
├── v2/  ← código actual (mantener por compat temporal)
│   ├── auditoria-anual-component.js
│   ├── auditoria-anual-v2.css
│   ├── auditoria-anual-service.js
│   ├── auditoria-cronograma-view.js
│   ├── auditoria-hallazgos-view.js
│   ├── auditoria-plan-view.js
│   ├── auditoria-informe-view.js
│   └── ...
└── v3/  ← código portado del tar (NUEVO)
    ├── auditoria-anual-v3.css        (F1)
    ├── kair-ui.js                     (F1) 5 componentes base
    ├── kair-icons.js                  (F1) mapeo lucide→bi
    ├── kair-store.js                  (F2) store + subscribe
    ├── kair-types.js                  (F2) tipos JSDoc
    ├── kair-helpers.js                (F2) funciones puras
    ├── kair-mock-data.js              (F2) datos demo
    ├── auditoria-hub-view.js         (F3)
    ├── auditoria-list-view.js         (F4)
    ├── auditoria-editor-view.js       (F5)
    ├── auditoria-hallazgos-view.js    (F6)
    ├── auditoria-cronograma-view.js   (F7)
    ├── auditoria-informes-view.js     (F8)
    └── PORT_PLAN.md                   (F0) este archivo
```

---

## 6. Componentes shadcn a portar (helper `kair-ui.js`)

| Componente | API vanilla |
|------------|-------------|
| `Card` | `Card({children, className, id})` → HTML completo con header/body/footer |
| `Button` | `Button({variant, size, onClick, children, disabled, icon})` → `<button>` con clases |
| `Badge` | `Badge({variant, children, dot})` → `<span>` |
| `Dialog` | `Dialog({open, onClose, title, children, footer})` → modal overlay |
| `Input` | `Input({type, placeholder, value, onChange, icon, error})` → wrapper de `<input>` |
| `Textarea` | `Textarea({value, onChange, rows, placeholder, error})` → wrapper de `<textarea>` |
| `Select` | `Select({value, options, onChange, placeholder})` → `<select>` estilado |
| `Tabs` | `Tabs({tabs, active, onChange})` → nav + panels |
| `Tooltip` | `Tooltip({text, children})` → wrapper con `title` + listener |
| `EmptyState` | `EmptyState({icon, title, description, action})` → card vacía |

**Total esperado**: ~400-500 líneas de `kair-ui.js` + ~200 líneas de `kair-icons.js`.

---

## 7. Decisiones técnicas locked

- **Sin nuevas dependencias npm**. Todo con vanilla JS, HTML, CSS, tu bridge IPC.
- **Patrón `kairStore`**: objeto global con `getState()`, `setState(updater)`, `subscribe(fn)`. ~30 líneas.
- **Mock data inicial**: reusar `mockData.ts` del tar pero con adaptaciones (no requiere backend en F1-F8, se reemplaza en F9).
- **CSS separado por fase**: cada vista aporta su CSS a `auditoria-anual-v3.css` (mismo archivo, organizado por secciones con comentarios).
- **HTML en strings**: usar template literals con `innerHTML`. Más rápido y legible que DOM API para componentes grandes.
- **Eventos**: inline `onclick="..."` para CTAs simples, `addEventListener` para interacción compleja.
- **Iconos**: helper `icon(name)` que retorna `<i class="bi bi-{name}">` desde el mapeo.
- **Drag&drop**: HTML5 nativo (`draggable="true"`, `dragstart`, `dragover`, `drop`). Sin librería.
- **Sin tests automatizados** (mantengo tu política del proyecto).

---

## 8. Checkpoint

**F0 (análisis)**: ✅ este documento
**F1 (design system)**: `auditoria-anual-v3.css` + `kair-ui.js` + `kair-icons.js` + carga en componente

Cuando termines F1, valida visualmente con `Ctrl+Shift+R` que la página de 6.1.2 no se rompió. Luego das luz verde para F2.

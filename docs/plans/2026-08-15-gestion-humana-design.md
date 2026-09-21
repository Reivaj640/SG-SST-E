# Gestión Humana — Design Doc

**Fecha:** 2026-08-15
**Autor:** K+AIR Bot
**Estado:** Draft (esperando aprobación del usuario)
**Versión K+AIR objetivo:** v0.1.191 (después del commit de Presupuesto v0.1.190)

## Contexto

El usuario quiere agregar un módulo de RRHH ("Gestión Humana") a K+AIR,
inspirado en el demo de Tempoactiva (Next.js + Prisma) que tiene 8
módulos: Dashboard, Base de Personal, Contratación, Vacaciones,
Permisos, Afiliaciones, Documentos y Comunicación.

K+AIR hoy es una app de **SG-SST** (Seguridad y Salud en el Trabajo)
con módulos como gestion-amenazas, gestion-salud, recursos, etc.
El módulo `recursos` actual tiene cosas "tipo RRHH" (capacitación,
inducciones, copasst, afiliación) pero todas enfocadas a SG-SST.

El usuario validó:
- **Alcance:** "todo el proceso" = Base de Personal + Contratación (6 pasos) en v0.1
- **Layout:** Patrón K+AIR existente (Volver + grid de cards)
- **Storage:** SQLite (mismo patrón que Presupuesto 1.1.3)

## Objetivo

Crear un nuevo módulo top-level `gestion-humana` con dos sub-módulos
funcionales en v0.1:

1. **Base de Personal** — CRUD de trabajadores con campos completos
   (similar al demo, ~30 campos), búsqueda, filtros, export a Excel
2. **Contratación** — Pipeline de 6 pasos (memo, contacto, examenes,
   documentos, afiliaciones, activación S400) estilo Kanban tracker

El módulo queda preparado para crecer (v0.2+) con: Vacaciones, Permisos,
Afiliaciones, Documentos.

## Arquitectura

### Estructura de archivos

```
sgsst-electron-app/
├── modules/
│   └── gestion-humana/                     ← NUEVO módulo top-level
│       ├── index.js                        ← exports contratacion + base-personal
│       ├── gestion-humana-home.html        ← grilla de cards (entry point del módulo)
│       ├── gestion-humana-home.js          ← lógica de la grilla
│       ├── gestion-humana-home.css         ← estilos
│       ├── contratacion/                   ← submódulo Contratación
│       │   ├── index.js
│       │   ├── contratacion-logic.js       ← IPC + postMessage al parent
│       │   ├── contratacion-view.html      ← UI principal (iframe content)
│       │   ├── contratacion-viewer.js      ← render del iframe
│       │   └── contratacion-view.css
│       └── base-personal/                  ← submódulo Base de Personal
│           ├── index.js
│           ├── base-personal-logic.js
│           ├── base-personal-view.html
│           ├── base-personal-viewer.js
│           └── base-personal-view.css
├── main/
│   ├── gestion-humana-bridge.js            ← NUEVO bridge IPC
│   ├── gestion-humana-schema-sql.js        ← NUEVO schema
│   ├── test-gestion-humana-bridge-schema.js
│   ├── test-gestion-humana-bridge-read.js
│   ├── test-gestion-humana-bridge-write.js
│   └── test-gestion-humana-flow.js         ← end-to-end
├── preload.js                              ← MODIFICADO: expone canales IPC
├── main.js                                 ← MODIFICADO: registra bridge
├── index.html                              ← MODIFICADO: agrega card en grilla principal
└── package.json                            ← bump 0.1.190 → 0.1.191
```

### Schema SQL (3 tablas)

```sql
-- Aspirantes / procesos de contratación en curso
CREATE TABLE contrataciones (
  id TEXT PRIMARY KEY,                     -- formato "ct-{nanoid}"
  empresa_id TEXT NOT NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  cedula TEXT,
  telefono TEXT,
  cargo TEXT NOT NULL,
  salario REAL,
  fecha_ingreso TEXT NOT NULL,             -- ISO 8601
  sede_id TEXT,
  empresa_usuaria TEXT,
  paso_actual INTEGER DEFAULT 1,           -- 1-6
  memo_recibido INTEGER DEFAULT 0,
  memo_fecha TEXT,
  memo_notas TEXT,
  contacto_realizado INTEGER DEFAULT 0,
  contacto_fecha TEXT,
  contacto_notas TEXT,
  examenes_programados INTEGER DEFAULT 0,
  examenes_fecha TEXT,
  examenes_ips TEXT,
  examenes_notas TEXT,
  documentos_firmados INTEGER DEFAULT 0,
  documentos_fecha TEXT,
  documentos_notas TEXT,
  afiliaciones_completadas INTEGER DEFAULT 0,
  afiliaciones_fecha TEXT,
  afiliaciones_notas TEXT,
  s400_activado INTEGER DEFAULT 0,
  s400_fecha TEXT,
  s400_notas TEXT,
  estado TEXT DEFAULT 'en_proceso',        -- en_proceso | completado | cancelado
  trabajador_id TEXT,                      -- link a base_personal cuando completa
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_contrataciones_empresa ON contrataciones(empresa_id);
CREATE INDEX idx_contrataciones_estado ON contrataciones(estado);

-- Base de personal (trabajadores activos/inactivos)
CREATE TABLE base_personal (
  id TEXT PRIMARY KEY,                     -- formato "bp-{nanoid}"
  empresa_id TEXT NOT NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  cedula TEXT NOT NULL,
  tipo_documento TEXT DEFAULT 'CC',        -- CC | CE | TI | PAS
  fecha_exp_cedula TEXT,
  lugar_exp_cedula TEXT,
  fecha_nacimiento TEXT,
  lugar_nacimiento TEXT,
  telefono TEXT,
  celular TEXT,
  email TEXT,
  estado_civil TEXT,                       -- soltero | casado | union_libre | ...
  nivel_educativo TEXT,                    -- primaria | secundaria | tecnico | profesional | ...
  direccion TEXT,
  barrio TEXT,
  ciudad TEXT,
  cargo TEXT,
  salario REAL,
  tipo_contrato TEXT,                      -- indefinido | fijo | prestacion | ...
  fecha_ingreso TEXT,
  fecha_retiro TEXT,
  estado TEXT DEFAULT 'activo',            -- activo | incapacitado | vacaciones | permiso | maternidad | paternidad | luto | retirado
  eps TEXT,
  pension TEXT,
  arl TEXT,
  caja_compensacion TEXT,
  activo_s400 INTEGER DEFAULT 0,
  empresa_usuaria TEXT,
  banco TEXT,
  numero_cuenta TEXT,
  activo INTEGER DEFAULT 1,                -- soft delete
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(empresa_id, cedula)
);
CREATE INDEX idx_base_personal_empresa ON base_personal(empresa_id);
CREATE INDEX idx_base_personal_estado ON base_personal(estado);

-- Sedes (referencia para contrataciones y base_personal)
CREATE TABLE gh_sedes (
  id TEXT PRIMARY KEY,                     -- formato "se-{nanoid}"
  empresa_id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  direccion TEXT,
  ciudad TEXT,
  activo INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(empresa_id, nombre)
);
```

### IPC Bridge (Channels)

**Read (5):**
- `gh:list-contrataciones` (filtros: empresaId, estado)
- `gh:get-contratacion` (por id)
- `gh:list-personal` (filtros: empresaId, estado, search)
- `gh:get-personal` (por id)
- `gh:list-sedes`

**Write Contratación (4):**
- `gh:create-contratacion`
- `gh:update-contratacion` (campos básicos)
- `gh:delete-contratacion` (soft)
- `gh:marcar-paso` (body: { contratacionId, pasoNum, fecha, notas }) — avanza el pipeline

**Write Personal (4):**
- `gh:create-personal`
- `gh:update-personal`
- `gh:delete-personal` (soft)
- `gh:cambiar-estado` (body: { personalId, estado, fecha, notas })

**Write Sedes (2):**
- `gh:create-sede`
- `gh:update-sede`

**Diag (1):**
- `gh:diag` — para verificar estado del bridge

**Total: 16 channels** (siguiendo la firma `(app, deps)` del bridge de Presupuesto)

### Visual — Patrón K+AIR (grilla de cards)

**Home del módulo (`gestion-humana-home.html`):**

```
┌─────────────────────────────────────────────┐
│ ← Volver al Menú    Gestión Humana          │
├─────────────────────────────────────────────┤
│                                             │
│  Sistema de Gestión Humana                  │
│  Administre el personal, los procesos de    │
│  contratación y más.                        │
│                                             │
│  ┌──────────────┐  ┌──────────────┐         │
│  │  👥           │  │  📋           │        │
│  │              │  │              │         │
│  │  Base de     │  │  Contrata-   │         │
│  │  Personal    │  │  ción        │         │
│  │              │  │              │         │
│  │  14 trab.    │  │  3 en proc.  │         │
│  │  12 activos  │  │  2 complet.  │         │
│  │              │  │              │         │
│  │  [Gestionar] │  │  [Gestionar] │         │
│  └──────────────┘  └──────────────┘         │
│                                             │
│  Próximamente:                             │
│  📅 Vacaciones · 📄 Permisos ·              │
│  🛡️ Afiliaciones · 📑 Documentos           │
│                                             │
└─────────────────────────────────────────────┘
```

**Sub-módulo "Base de Personal" (iframe):**

```
┌─────────────────────────────────────────────┐
│  Base de Personal                          │
├─────────────────────────────────────────────┤
│ KPIs: [Total] [Activos] [En proc] [Retir.] │
│                                             │
│ 🔍 Search: [____________] [Filtros ▾]       │
│                  [+ Nuevo Trabajador]       │
│ [Exportar Excel]                            │
│                                             │
│ ┌──────────────────────────────────────┐   │
│ │ Cédula  │ Nombre      │ Cargo  │ Est │   │
│ ├─────────┼─────────────┼────────┼─────┤   │
│ │ 1234567 │ Juan Pérez  │ Op.    │ 🟢  │   │
│ │ ...                                   │   │
│ └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Sub-módulo "Contratación" (iframe):**

```
┌─────────────────────────────────────────────┐
│  Contratación                              │
├─────────────────────────────────────────────┤
│ KPIs: [Total] [En proc] [Complet.]          │
│                                             │
│ [+ Nueva Contratación]    [Exportar Excel] │
│                                             │
│ ┌──────────────────────────────────────┐   │
│ │ Aspirante  │ Cargo   │ Paso  │ Est  │   │
│ ├────────────┼─────────┼───────┼──────┤   │
│ │ M. López   │ Op.     │ 1/6   │ 🟡   │   │
│ │ R. García  │ Admin   │ 4/6   │ 🟡   │   │
│ │ ...                                   │   │
│ └──────────────────────────────────────┘   │
│                                             │
│ Click en fila → detalle de 6 pasos          │
└─────────────────────────────────────────────┘
```

**Detalle de Contratación (sub-modal al click en fila):**

```
┌─────────────────────────────────────────────┐
│ María López — Op. de Mantenimiento          │
│ Ingreso: 15/09/2026                         │
├─────────────────────────────────────────────┤
│ Pipeline de 6 pasos:                        │
│                                             │
│ ① Memo / Correo      [✅ 01/09] [Editar]    │
│ ② Contacto Aspirante [⬜] [Marcar]          │
│ ③ Exámenes Médicos   [⬜] [Marcar]          │
│ ④ Firma Documentos   [⬜] [Marcar]          │
│ ⑤ Afiliaciones       [⬜] [Marcar]          │
│ ⑥ Activación S400    [⬜] [Marcar]          │
│                                             │
│ [Cancelar Contratación]  [Convertir a Trab] │
└─────────────────────────────────────────────┘
```

### Integración con K+AIR

1. **Grilla principal (`index.html`)**: agregar card "Gestión Humana" al lado de las otras
2. **main.js**: registrar `registerGestionHumanaHandlers` al boot
3. **preload.js**: exponer los 16 canales `gh:*` via `window.electronAPI`
4. **Patrón visual**: reusar KairConfirm + KAIRToast ya implementados

### Vinculación con módulos existentes (v0.2+, no en MVP)

- Cuando una contratación se completa (paso 6) → botón "Convertir a Trabajador" → crea registro en `base_personal`
- En `base_personal` se puede mostrar link a "Programar Inducción" → crea tarea en `recursos/inducciones`
- En `base_personal` link a "Registrar Afiliación" → crea registro en `recursos/afiliacion`

**Para v0.1 estos links NO existen.** Solo son campos placeholder con un comentario `// TODO v0.2: link a inducciones`.

## Decisiones técnicas

1. **Storage**: SQLite con `better-sqlite3` en producción, `sql.js` en tests
   (mismo patrón que Presupuesto)
2. **Auth**: Soft auth (mismo que Presupuesto) — si token vacío, `user=null, softAuth=true`
3. **Firma bridge**: `(app, deps)` (mismo que Presupuesto — bug histórico corregido)
4. **Soft delete**: `activo=0` en `base_personal` (las contrataciones tienen `estado=cancelado`)
5. **IDs**: formato `{prefix}-{nanoid}` (ct-, bp-, se-)
6. **Fechas**: ISO 8601 strings (no Date objects) — mismo patrón
7. **Tests**: como contrato (mismo que Presupuesto) — 5 archivos de test + 1 end-to-end

## Plan de implementación (Fases)

### **Fase 0 — Schema + Bridge vacío (1 sesión)**
- Crear `main/gestion-humana-schema-sql.js` con las 3 tablas
- Crear `main/gestion-humana-bridge.js` con firma `(app, deps)` + todos los handlers como STUB
- Tests de schema (49 OK)

### **Fase 1 — Read handlers (1 sesión)**
- Implementar los 5 handlers de lectura
- Tests de read (57 OK)

### **Fase 2 — Write handlers Contratación (1 sesión)**
- `create-contratacion`, `update-contratacion`, `delete-contratacion`, `marcar-paso`
- Tests de write (47 OK)

### **Fase 3 — Write handlers Personal (1 sesión)**
- `create-personal`, `update-personal`, `delete-personal`, `cambiar-estado`
- `create-sede`, `update-sede`
- Tests adicionales

### **Fase 4 — UI módulo home (1 sesión)**
- `gestion-humana-home.html/js/css` con la grilla de cards
- Card en `index.html` grilla principal
- `preload.js` expone canales
- `main.js` registra bridge

### **Fase 5 — UI Base de Personal (2 sesiones)**
- Iframe con KPIs + tabla + búsqueda/filtros
- Modal "Nuevo Trabajador" con KairConfirm.input() (KairConfirm ya existe)
- Modal "Editar Trabajador"
- Botón eliminar (soft)

### **Fase 6 — UI Contratación (2 sesiones)**
- Iframe con KPIs + tabla de procesos
- Modal "Nueva Contratación"
- Modal "Detalle de pasos" con los 6 pasos clickeables
- Botón "Marcar paso" (abre KairConfirm.input() con fecha + notas)

### **Fase 7 — Tests end-to-end + docs (1 sesión)**
- `test-gestion-humana-flow.js` con datos reales (aspirante → completar 6 pasos → convertir a trabajador)
- Actualizar AGENTS.md con el módulo
- Commit + bump a v0.1.191

**Total estimado: ~9-10 sesiones** (sin contar iteraciones con feedback visual)

## Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Volumen alto de código (16 handlers + 2 UIs grandes) | Implementar fase por fase, validar visualmente entre fases |
| Datos de trabajadores son sensibles (PII) | Encriptación de BD (ya existe en K+AIR) — confirmar con usuario |
| Integración con módulos viejos podría romper cosas | v0.1 NO integra con inducciones/afiliacion (solo placeholder). v0.2+ con tests dedicados |
| Performance con muchos trabajadores (1000+) | Índices en `empresa_id`, `estado`, `cedula` — tests de performance con seed de 1000+ |
| UX inconsistente con K+AIR | Reusar KairConfirm, KAIRToast, header pattern de Presupuesto — mismo visual language |

## Preguntas abiertas (para resolver durante implementación)

1. **¿Soft delete también en `contrataciones`?** Mi recomendación: NO. Las
   contrataciones canceladas quedan con `estado='cancelado'` (histórico
   visible). El soft delete solo en `base_personal` (porque un trabajador
   retirado puede volver).

2. **¿Multi-empresa desde el inicio?** Mi recomendación: SÍ. El campo
   `empresa_id` ya está en todas las tablas. La UI filtra por
   `currentCompany` (mismo patrón que Presupuesto).

3. **¿Export a Excel?** Mi recomendación: SÍ (mismo patrón que Presupuesto).
   Botón "Exportar Excel" en ambos sub-módulos.

## Decisiones que necesito del usuario antes de implementar

1. **OK con el plan completo de 7 fases?**
2. **¿Convertir Contratación completada → Trabajador en v0.1 o v0.2?**
   Mi recomendación: v0.2 (es un feature adicional, no parte del MVP)
3. **¿Soft delete en `contrataciones`?**
   Mi recomendación: NO (usar `estado='cancelado'`)

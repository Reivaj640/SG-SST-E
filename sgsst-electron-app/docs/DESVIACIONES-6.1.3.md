# Desviaciones del SPEC 6.1.3 — Revisión por la Alta Dirección

**Fecha de creación:** 2026-06-16
**Estado:** Activo

---

## DESV-001 — Vanilla JS en lugar de React

| Campo | Valor |
|-------|-------|
| **Spec §13.1** | React + Redux + Zustand |
| **Implementación real** | Vanilla JS + prototype constructors + closures |
| **Justificación** | Consistencia arquitectónica con el resto de K+AIR completo |
| **Impacto** | Ninguno funcional; solo estructura de archivos |

### Reglas bajo esta desviación

- Zustand NO se usa. El estado se maneja con closures y prototypes como ya lo hace la app.
- Los "stores" del spec se traducen a servicios prototype con métodos get/set equivalentes.
- Componentes spec → constructores vanilla con métodos render(), mount(), unmount().
- Rutas del spec → router vanilla ya existente en la app.

---

## Alineación con spec §6.1 — Renombramiento de parámetros IPC

| Canal | Parámetro anterior | Parámetro §6.1 | Fecha | Archivos modificados |
|-------|-------------------|----------------|-------|---------------------|
| `importarXlsx` | `path`, `tipo` | `archivoPath`, `tipoPlantilla` | 2026-06-16 | preload.js (L331), service.js (L76-77), bridge.js (L603-604) |
| `exportarXlsx` | `tipo` | `tipoPlantilla` | 2026-06-16 | preload.js (L332), service.js (L81-82), bridge.js (L654) |

### Justificación

Los contratos IPC son la frontera entre procesos. Si el spec §6.1 dice `archivoPath`/`tipoPlantilla`, cualquier consumidor futuro del canal (tests, otros módulos, scripts de migración) esperará esos nombres. Mantener los viejos genera deuda técnica inmediata y desviación del spec.

### Call sites afectados

| Archivo | Línea | Cambio |
|---------|-------|--------|
| `preload.js` | 331 | `{ path, tipo }` → `{ archivoPath, tipoPlantilla }` |
| `preload.js` | 332 | `{ tipo, id }` → `{ tipoPlantilla, id }` |
| `revision-alta-direccion-service.js` | 76-77 | `filePath, tipo` → `archivoPath, tipoPlantilla` |
| `revision-alta-direccion-service.js` | 81-82 | `tipo` → `tipoPlantilla` |
| `revision-alta-direccion-bridge.js` | 603-604 | `params.path, params.tipo` → `params.archivoPath, params.tipoPlantilla` |
| `revision-alta-direccion-bridge.js` | 654 | `params.tipo` → `params.tipoPlantilla` |

**No hay call sites externos** al submódulo 6.1.3.

---

## Clasificación de campos texto largo (§4)

Resultado de inspección de plantillas .xlsx originales en `utils/`:

| # | Campo (§) | Entidad | Propuesta | Justificación |
|---|-----------|---------|-----------|---------------|
| 1 | secciones[].contenido (§4.1.2) | RevisionGerencial | TEXTAREA | Celda merge `s=none`, texto plano |
| 2 | secciones[].subTemas[].contenido (§4.1.2) | RevisionGerencial | TEXTAREA | Sub-temas §2/§5 son texto plano |
| 3 | ordenDia (§4.2) | ActaReunion | TEXTAREA | Celda merged `s=none` |
| 4 | desarrollo[].temaTratado (§4.2.1) | ActaReunion | TEXTAREA | Celda `s=none` |
| 5 | desarrollo[].compromiso (§4.2.1) | ActaReunion | TEXTAREA | Celda `s=none` |
| 6 | desarrollo[].verificacion (§4.2.1) | ActaReunion | TEXTAREA | Celda `s=none` |
| 7 | objetivoEstrategico (§4.3) | IndicadorSST | TEXTAREA | Celda `s=none` |
| 8 | indicador (§4.3) | IndicadorSST | TEXTAREA | Celda `s=none` |
| 9 | formula (§4.3) | IndicadorSST | TEXTAREA | Celda `s=none` |

**Conclusión:** Ningún campo requiere editor rico (Quill/TipTap). Todos son texto plano según inspección de plantillas originales. DESV-002 NO es necesaria.

---

## Plantillas .xlsx — Ubicación real

| Plantilla | Ruta en repositorio |
|-----------|---------------------|
| G-FO-001 | `utils/G-FO-001 DESPLIEGUE ESTRATEGICO.xls` |
| G-FO-006 | `utils/G-FO-006 REVISION GERENCIAL 03.xlsx` |
| G-FO-009 | `utils/G-FO-009 ACTA DE REUNION GERENCIAL.xlsx` |
| GG-FO-005 | `utils/GG-FO-005 REGISTRO DE DOCUMENTOS INTERNOS Y EXTRENOS.xlsx` |
| G-PR-001 | `utils/G-PR-001 PROCEDIMIENTO DE REVISION GERENCIAL.doc` |

En runtime, el bridge busca en `userData/plantillas/6.1.3/` con nombres normalizados:
`G-FO-001.xlsx`, `G-FO-006.xlsx`, `G-FO-009.xlsx`, `GG-FO-005.xlsx`

---

## Fase 1 — Entregables completados

| # | Entregable | Estado |
|---|-----------|--------|
| 1.1 | docs/DESVIACIONES-6.1.3.md | ✅ |
| 1.2 | Auditoría bridge vs §6.1 | ✅ 16/16 canales alineados |
| 1.3 | Renombrar parámetros importarXlsx/exportarXlsx | ✅ |
| 1.4 | Tabla de impacto de renombramiento | ✅ |
| 1.5 | Modelo RevisionGerencial + Participante + Seccion + SubTema + AccionSeccion | ✅ |
| 1.6 | Modelo ActaReunion + Compromiso | ✅ |
| 1.7 | Modelo IndicadorSST + Medicion | ✅ |
| 1.8 | Modelo RegistroDocumental | ✅ |
| 1.9 | Campos texto largo → 9/9 TEXTAREA | ✅ |
| 1.10 | Autocheck cierre Fase 1 | ✅ |

---

## Fase 2 — Entregables completados

| # | Entregable | Estado |
|---|-----------|--------|
| 2.1 | Parser G-FO-006: 12 secciones canónicas, 2 sub-temas, participantes dual (empresa/invitados) | ✅ |
| 2.2 | Parser G-FO-009: encabezado R8-R15, tabla desarrollo R34-R43 | ✅ |
| 2.3 | Parser G-FO-001: 16 indicadores R7-R22, 7 columnas | ✅ |
| 2.4 | Parser GG-FO-005: 35 registros R8-R42, 9 columnas | ✅ |
| 2.5 | Exporters: `_resolverPlantilla()` busca en `utils/` (source) o `userData/` (copia), preserva formato | ✅ |
| 2.6 | Validaciones: transición estados, campos requeridos al cerrar | ✅ |
| 2.7 | Autocheck Fase 2 | ✅ |

---

## Fase 3 — Entregables completados

| # | Entregable | Estado |
|---|-----------|--------|
| 3.1 | Componente principal: dashboard + tabs + KPI strip + navegación | ✅ |
| 3.2 | Vista revisiones-list: filtros (año, estado, tipo, búsqueda) + tabla | ✅ |
| 3.3 | Vista revision-editor: 12 secciones canónicas + participantes dual + acciones | ✅ |
| 3.4 | Vista actas-list: tabla + modal crear acta | ✅ |
| 3.5 | Vista acta-editor: datos generales + participantes + tabla compromisos | ✅ |
| 3.6 | Vista despliegue-estrategico: política integral + tabla indicadores | ✅ |
| 3.7 | Vista registro-documental: tabla 9 columnas + CRUD | ✅ |
| 3.8 | Vista procedimiento: visor G-PR-001 + botón abrir Word | ✅ |
| 3.9 | Autocheck Fase 3 | ✅ |

---

## Fase 4 — Entregables completados

| # | Entregable | Estado |
|---|-----------|--------|
| 4.1 | Dispatch en renderer.js (L4533): `"6.1.3 Revisión de la alta Dirección"` → `RevisionAltaDireccionComponent` | ✅ |
| 4.2 | Integración con router módulo 6: ALL_SUBMODULES (L94), permisos (L178), bridge registrado (main.js L7667) | ✅ |
| 4.3 | Autocheck Fase 4 | ✅ |

---

## Fase 5 — Entregables completados

| # | Entregable | Estado |
|---|-----------|--------|
| 5.1 | Estructura: 11 archivos frontend + 1 bridge | ✅ |
| 5.2 | Syntax check: 11/11 JS files OK | ✅ |
| 5.3 | CSS: 680 líneas BEM + dark mode + responsive | ✅ |
| 5.4 | Modelos vs parsers: coherencia verificada | ✅ |
| 5.5 | Autocheck final Fase 5 | ✅ |

---

## RESUMEN FINAL — IMPLEMENTACIÓN COMPLETA

### Archivos creados/modificados

| Archivo | Acción | Líneas |
|---------|--------|--------|
| `docs/DESVIACIONES-6.1.3.md` | **Creado** | ~120 |
| `main/revision-alta-direccion-bridge.js` | **Modificado** | ~960 |
| `preload.js` | **Modificado** | +4 |
| `modules/.../revision-alta-direccion-models.js` | **Creado** | ~412 |
| `modules/.../revision-alta-direccion-service.js` | **Modificado** | ~103 |
| `modules/.../revision-alta-direccion-component.js` | **Verificado** | ~342 |
| `modules/.../revision-alta-direccion.css` | **Verificado** | ~680 |
| `modules/.../vistas/revisiones-list.js` | **Verificado** | ~174 |
| `modules/.../vistas/revision-editor.js` | **Verificado** | ~328 |
| `modules/.../vistas/actas-list.js` | **Verificado** | ~157 |
| `modules/.../vistas/acta-editor.js` | **Verificado** | ~190 |
| `modules/.../vistas/despliegue-estrategico.js` | **Verificado** | ~144 |
| `modules/.../vistas/registro-documental.js` | **Verificado** | ~109 |
| `modules/.../vistas/procedimiento.js` | **Verificado** | ~102 |
| `index.html` | **Modificado** | +1 script tag |

### Verificaciones finales

- **Syntax**: 11/11 JS files OK
- **Modelos**: 9 constructores + 4 fábricas + 4 constantes
- **Parsers**: 4 plantillas inspeccionadas (G-FO-006, G-FO-009, G-FO-001, GG-FO-005)
- **Exporters**: `_resolverPlantilla()` busca en `utils/` (source) o `userData/` (copia)
- **IPC**: 16 canales registrados con parámetros renombrados
- **Integración**: dispatch, permisos, router verificados

# Especificaciones técnicas · Plan de trabajo SG-SST — K+AIR

> **Versión 1.0 · septiembre de 2026**
> Documento técnico derivado de `kair-plan-trabajo-documento-tecnico (1).pdf` (v1.0), **adaptado a la
> arquitectura real de la aplicación Electron** de este repositorio.
> Autoría original: Javier Robles F. · Prof. SG-SST · Esp. Gerencia de Proyectos.

## Nota de adaptación (PDF → repo Electron)

El documento original describe un flujo de **prototipos HTML autocontenidos** (`kair-*.html` en
`public/` + copia portable en `download/`). Este repositorio ya evolucionó a una **aplicación Electron**
con:

- `renderer.js` (orquestador de vistas) + `index.html` (shell).
- Módulos en `modules/<área>/<submódulo>/` (no en `public/`).
- Contratos IPC reales en `preload.js` + handlers en `main.js` / `main/`.
- Sistema de diseño premium compartido en `shared/`.

Por lo tanto, todo lo relativo al "flujo de prototipos" se reescribió a la arquitectura Electron. **Se
conservan íntegros**: las entidades y estructuras de datos, los contratos IPC propuestos, las etiquetas
de logging, los criterios de aceptación y la priorización ST-01…ST-08.

---

## 1. Propósito y alcance

### 1.1 Objetivo

Consolidar las especificaciones y estructuras técnicas que gobiernan el desarrollo de los próximos
submódulos de K+AIR. Cada submódulo queda descrito con: objetivo, pantallas, estructura de datos,
contrato de integración y criterios de aceptación verificables.

El documento actúa como **contrato de trabajo entre diseño y desarrollo**: fija la arquitectura ya
aprobada (premium v2, Electron, contratos IPC, logging estructurado) para que ningún módulo nuevo
reinicie decisiones tomadas, y establece el orden de ejecución derivado de las señales reales del Panel
de Control.

**Regla de oro del proyecto:** solo se cambia lo solicitado, sin dañar procesos de negocio, permisos,
datos, formularios, cálculos, rutas ni integraciones existentes.

### 1.2 Alcance y fuentes

- **Inventario** del trabajo ya ejecutado.
- **Arquitectura y patrones obligatorios** para todo desarrollo nuevo.
- **Especificaciones técnicas** de ocho submódulos priorizados (**ST-01 a ST-08**).
- **Roadmap** de ejecución por fases y riesgos.

**Fuera de alcance:** la conexión de backend real de cada submódulo. Este documento define los
contratos; cada API se conecta en su propia fase con verificación independiente.

### 1.3 Cómo leer este documento

- **Cap. 2** — punto de partida: qué está hecho y qué señala el Panel.
- **Cap. 3** — la biblia técnica: todo módulo nuevo debe cumplirla.
- **Cap. 4** — mapa de módulos y prioridades P1/P2/P3.
- **Cap. 5** — el corazón: especificaciones ST-01…ST-08 autocontenidas.
- **Caps. 6-8** — roadmap, riesgos y gobernanza.

---

## 2. Estado actual del sistema

### 2.1 Módulos con tratamiento premium v2

El proyecto completó la migración visual de la capa de acceso y de cuatro módulos funcionales al
sistema **premium v2**. La tabla resume el inventario.

| Módulo | Referencia | Alcance del rediseño | Estado |
|--------|-----------|----------------------|--------|
| Panel de Control | `renderDashboard` (`renderer.js`) | Hero "Estado General" con conclusión humanizada; 4 KPI; 7 tarjetas de módulos; pendientes con severidad y acento lateral; filtros Todos/Críticos/Hoy; skeleton y toasts. | Completado y verificado (📦748/📦749) |
| Documentos de Contratación | `modules/gestion-humana/documentos` | KPI strip en vivo; tabla enterprise con búsqueda y paginación; expediente por empleado con semáforo; modal de subida drag & drop. | Completado y verificado |
| Programa de Capacitación | `modules/recursos/capacitaciones` | Dashboard con hero y 3 gráficas SVG sin librerías; listado con barra única de filtros; modales crear/editar/completar/eliminar; exportación CSV real. | Completado y verificado |
| Inducción y Reinducción | `modules/recursos/inducciones` | Dashboard con 6 gráficas y "En tu radar" dinámico; registro con búsqueda y micro-barras; modal registrar/editar con validación inline. | Completado y verificado |
| Acceso (login, splash, empresas) | shell Electron | Login con validación inline, splash con progreso real y grid de empresas activas; contratos `login()`, `getEmpresasActivas()`, `entrarEmpresa(id)`. | **Ya integrado en la app Electron** (Fase 0 cubierta) |

> **Nota de gestión:** el PDF original marcaba el módulo de acceso como "artefacto por restaurar en el
> workspace". En este repositorio el login/splash/selección de empresa **ya está implementado** en la
> app Electron, por lo que la Fase 0 del roadmap (cap. 6) se reduce a conectar contratos reales
> faltantes, no a reconstruir el login.

### 2.2 Señales de gestión del Panel de Control

Cuatro indicadores condensan el estado del sistema (corte 15-sep-2026, datos del prototipo). Son la
**línea base** contra la cual los nuevos submódulos deben cuadrar al integrarse.

| Indicador | Valor | Semántica | Implicación |
|-----------|-------|-----------|-------------|
| Accidentes (año) | 1 | Neutro | ST-04 debe reportar exactamente el evento del año y alimentar el contador. |
| Casos PRIC activos | 0 | Positivo: "Bajo control" | ST-04 debe modelar el seguimiento para mantener la señal cuando existan casos. |
| Documentos vencidos | 12 | Crítico: "Requieren gestión" | ST-03 debe explicar los vencimientos documento por documento y permitir gestionarlos. |
| Plan de trabajo | 36 % | Atención (barra ámbar) | ST-01 calcula este porcentaje desde el plan anual. |

> Si el plan calculado por ST-01 no reproduce el 36 %, o ST-03 no reproduce los 12 vencidos, la
> integración no respetó la fuente de verdad del usuario.

### 2.3 Pendientes activos

La sección "Pendientes y Tareas" lista ocho hallazgos con la codificación de la estructura documental
del SG-SST. Se transcriben porque son la evidencia que justifica la priorización del cap. 4.

| Código | Hallazgo | Severidad |
|--------|----------|-----------|
| 1.4 | Presupuesto: 71 % ejecutado. Asignado $27.8M · Ejecutado $19.7M · Saldo $8.1M. Desviación significativa. | Atención |
| 1.1.6 | COPASST: periodo por vencer (2024-2026). Renovación antes de diciembre de 2026. | Atención |
| 1.2.2 | Inducción y Reinducción: 4 inducciones pendientes; cumplimiento 96 %. | Info |
| 1.2.1 | Programa de Capacitación: 12 capacitaciones vencidas. | Crítico |
| 1.1.4 | Afiliación al SSSI: pendiente. Planillas registradas: 0; sin planilla de septiembre de 2026. | Crítico |
| 1.1.6 | COPASST: sin reunión desde mayo de 2026. Requisito: reuniones mensuales. | Crítico |
| 1.1.8 | Comité de Convivencia: sin acta de elección o constitución. | Crítico |
| 1.1.8 | Comité de Convivencia: sin reunión desde noviembre de 2025. Requisito: mensual. | Crítico |

### 2.4 Lectura para la planificación

Los ocho pendientes se concentran en cuatro frentes:

1. **Planificación y presupuesto** — código 1.4 (71 %) y KPI del plan (36 %).
2. **Gobierno de comités** — 4 de 8 hallazgos (COPASST y Convivencia).
3. **Gestión documental y afiliaciones** — planilla SSSI ausente + 12 documentos vencidos.
4. **Formación** — ya cubierta por Capacitación e Inducción (módulos migrados).

De aquí sale la priorización: primero los frentes con más hallazgos críticos y mayor recurrencia
mensual (P1); luego eventos/riesgo/salud (P2); y al final verificación/emergencias/mejoramiento (P3).

---

## 3. Arquitectura y patrones establecidos

Capítulo obligatorio para los submódulos ST-01…ST-08. Garantiza consistencia y hace que el costo
marginal de un módulo nuevo sea bajo (el 70 % de las piezas ya existe).

### 3.1 Estructura de un módulo (Electron)

Convención real del repo:

```
modules/<área>/<submódulo>/
  <submódulo>-home.html      ← dashboard del submódulo (hero + KPIs + gráficas)
  <submódulo>-home.js        ← lógica del home
  <submódulo>-view.html      ← listado/registro principal
  <submódulo>-logic.js       ← lógica de negocio + render de tabla
  <submódulo>-viewer.js      ← integración con el shell (IPC, navegación)
  <submódulo>-view.css       ← estilos scopados al contenedor del módulo
  index.js                   ← registro/exportación del módulo
```

**Flujo de trabajo:** auditar → especificar y aprobar → construir por partes + ensamblar → validador
estructural del módulo → verificación en los dos viewports (1440×820 escritorio, 390×844 móvil) con
consola limpia → copia/registro.

### 3.2 Sistema de diseño premium v2 (tokens)

Los tokens CSS son la **fuente única de verdad visual** (`shared/kair-design-tokens.css`). Está
prohibido introducir valores hexadecimales sueltos fuera de los tokens.

| Token | Valor | Uso |
|-------|-------|-----|
| `--kair-bg` / `--kair-surface` | `#FBFCFB` / `#FFFFFF` | Fondo de app y superficies de tarjetas/tablas. |
| `--kair-text` / `-2` / `-3` | `#14213D` / `#748096` / `#9AA4B8` | Jerarquía tipográfica. |
| `--kair-border` | `#E8EBEE` | Bordes de tarjetas, tablas y separadores. |
| `--kair-blue` (hover / soft) | `#2057B8` · `#1A4A9E` · `#EDF3FC` | Acciones primarias, enlaces, acentos. |
| `--kair-green` / `--kair-red` / `--kair-amber` | `#1BB888` / `#DA5563` / `#E7A224` | **Solo estados**: aprobado, crítico, atención. |
| `--kair-navy` | `#14213D` | Hero "Estado General", paneles de marca. |
| Radios / transiciones | 24 / 20 / 12 / 10 px · 150-220 ms | Redondeos por jerarquía y transiciones uniformes. |
| Tipografía | Manrope 700/800 · Inter 13-14 px | Títulos Manrope; interfaz y tablas Inter. |

**Regla rectora: "semántico, no decorativo".** Verde/rojo/ámbar solo comunican estado, nunca adorno.
La distinción entre categorías se logra con la misma familia azul en distintas luminosidades o con
etiquetas y contadores — antes que introducir un color nuevo.

### 3.3 Biblioteca de componentes reutilizables

Los componentes viven en **`shared/kair-premium.css`** (dialecto, scoped bajo `.kair-premium`) y
`shared/kair-components.css`. "Reutilizar la tabla enterprise" significa **copiar sus clases y
comportamiento**, no reconstruirlos.

| Componente | Comportamiento incluido | Dónde |
|------------|-------------------------|-------|
| Header System v2 | Breadcrumb, título con icono en contenedor azul suave, acciones a la derecha. | `.kair-breadcrumb` + `.kair-topbar` + `.kair-module-id` |
| Hero "Estado General" | Panel navy a ancho completo con conclusión humanizada dinámica, %, barra semántica y CTA. | `.kair-hero` |
| KPI cards | Fila de 4 tarjetas con valor, sufijo, chip semántico opcional y subtítulo; responsive 4→2→1. | `.kair-grid-kpis` + `.kair-kpi` |
| Chips suaves | Estados y categorías con fondos de baja saturación. | `.kair-chip` (+ `--soft-*`) |
| Tabla enterprise | Filas altas, cabecera fija, avatar con iniciales, orden, búsqueda con retardo 260-300 ms, paginación 8-10 filas, estados vacío/skeleton. | por módulo |
| Barra única de filtros | Selecciones combinables, contador de resultados y "Limpiar". | `.kair-seg` |
| Modales premium | Overlay con desenfoque, cierre con Escape, gestión de foco, validación inline. | por módulo |
| Toasts y logging | Confirmaciones con icono semántico + registro estructurado (§3.6). | `.kair-toasts` / `.kair-toast` |
| Exportación CSV | Archivo con BOM y separador `;` a partir de las filas filtradas. | por módulo |
| Gráficas SVG runtime | Línea dual con área, donut con centro intercambiable, columnas con meta, barras horizontales; sin librerías. | por módulo |
| Grid de módulos / pendientes | Tarjetas de módulo y de tarea con severidad. | `.kair-mod-grid` / `.kair-task-grid` |

**Migración al dialecto:** agregar `class="kair-premium"` al wrapper raíz y seguir el playbook de
`AGENTS.md` ("Playbook · Migrar un submódulo al estilo premium").

### 3.4 Máquina de estados y navegación

Los módulos con varias vistas implementan una máquina de estados mínima: pantallas hermanas con la
clase `.kair-screen`, de las cuales exactamente una lleva `.is-active`, y una función `show(name)`.

```js
function show(name){
  document.querySelectorAll(".kair-screen")
    .forEach(function(s){ s.classList.remove("is-active"); });
  var el = document.getElementById("screen-" + name);
  el.classList.add("is-active");
  klog("FLOW", "SCREEN_SHOWN", "INFO", "screen=" + name);
}
```

El cambio de pantalla **no destruye** datos de formulario ni filtros activos, salvo indicación
contraria. **Navegación cruzada con estado:** todo acceso cruzado especifica qué estado lleva
(patrón ya usado por Inducción y Capacitación) para que el usuario nunca llegue a una vista sin
contexto.

### 3.5 Contratos IPC vigentes y convención

La comunicación con el proceso principal se realiza **exclusivamente** por `window.electronAPI`
(funciones expuestas en `preload.js`). Cada módulo documenta su punto de integración con un comentario
`PUNTO DE INTEGRACION` y mantiene datos demo en memoria hasta conectar el contrato real.

| Contrato (`window.electronAPI`) | Módulo | Respuesta esperada |
|---------------------------------|--------|--------------------|
| `getDashboardSummary(empresa)` | Panel de Control | `{ success, data: { kpis, tasks, module_status } }` |
| `getDocumentosContratacion()` | Documentos de Contratación | `{ success, data: [empleados con documentos y categorías] }` |
| `getCapacitaciones()` | Programa de Capacitación | `{ success, data: { periodo, actividades, asistencia } }` |
| `getInducciones()` | Inducción y Reinducción | `{ success, data: { anio, registros } }` |
| `login({ correo, password, recordar })` | Acceso | Resultado de autenticación con estado y mensaje |
| `getEmpresasActivas()` | Acceso | `{ success, data: [ { id, nombre, estado } ] }` |
| `entrarEmpresa(id)` | Acceso | Apertura de sesión sobre la empresa elegida |

**Convención para contratos nuevos (ST-01…ST-08):** nombre en camelCase con prefijo del dominio
(`getPlanTrabajo`, `getComites`, `getAfiliaciones`), reciben el año y/o el identificador de empresa
cuando aplique, responden siempre `{ success, data }` y documentan la estructura completa de `data`.
**Ningún módulo del renderer conoce detalles de la base de datos: solo la forma del contrato.**

### 3.6 Logging estructurado

Formato obligatorio: `[K+AIRTAG][MODULO][ACCION][STATUS]`, donde `STATUS` ∈ `OK | INFO | WARN | ERROR`.
Es obligatorio desde la primera versión del módulo, no un añadido posterior.

| Tag | Módulo | Ejemplo |
|-----|--------|---------|
| `K+AIRDASH` | Panel de Control | `[K+AIRDASH][MODULOS][CLICK][INFO] modulo=riesgos` |
| `K+AIRDOCS` | Documentos de Contratación | `[K+AIRDOCS][UPLOAD][SUBMIT][OK] archivo=contrato.pdf` |
| `K+AIRCAP` | Programa de Capacitación | `[K+AIRCAP][EXPORT][OK] filas=19` |
| `K+AIRIND` | Inducción y Reinducción | `[K+AIRIND][REGISTRO][VALIDATE][WARN] cedula=` |
| `K+AIRAUTH` | Acceso | `[K+AIRAUTH][SPLASH][PROGRESS_DONE][OK]` |
| `K+AIRPLAN` (propuesto) | ST-01 Plan de Trabajo | `[K+AIRPLAN][ACTIVIDAD][SUBMIT][OK] id=12` |
| `K+AIRCOM` (propuesto) | ST-02 Comités y Actas | `[K+AIRCOM][ACTA][UPLOAD][OK] comite=COPASST` |
| `K+AIRAFIL` (propuesto) | ST-03 Afiliaciones y vigencias | `[K+AIRAFIL][PLANILLA][SUBMIT][OK] mes=2026-09` |
| `K+AIREVENTO` (propuesto) | ST-04 Incidentes y accidentes | `[K+AIREVENTO][INVESTIGACION][SUBMIT][OK] id=7` |
| `K+AIRIPERC` (propuesto) | ST-05 Matriz IPERC | `[K+AIRIPERC][VALORACION][SUBMIT][OK]` |
| `K+AIRSALUD` (propuesto) | ST-06 Salud ocupacional | `[K+AIRSALUD][EXAMEN][SUBMIT][OK]` |
| `K+AIREMER` (propuesto) | ST-07 Emergencias | `[K+AIREMER][RECURSO][SUBMIT][OK]` |
| `K+AIRVERIF` (propuesto) | ST-08 Verificación y mejoramiento | `[K+AIRVERIF][ACCION][SUBMIT][OK]` |

### 3.7 Método de construcción y definición de "hecho"

Método invariable: **auditar → especificar (aprobación breve con el usuario) → construir por partes y
verificar → documentar**. Un módulo está "hecho" solo si cumple **simultáneamente**:

- Sin errores de JavaScript en los dos viewports de referencia, con consola limpia.
- Tokens y componentes del cap. 3 respetados; **cero hexadecimales fuera de tokens**; regla
  "semántico, no decorativo" aplicada.
- Datos demo coherentes: los KPI en vivo coinciden con el dataset y con las cifras del Panel.
- **Prototipo honesto**: toda acción que dependa del backend se resuelve con estado visible y toasts,
  dejando el `PUNTO DE INTEGRACION` documentado.
- Accesibilidad básica: Escape cierra modales, foco gestionado, `aria` en controles de estado,
  `prefers-reduced-motion` respetado.
- Registro: entrada en `CHANGELOG.md` con decisiones y contratos preservados.

---

## 4. Mapa de módulos y priorización

### 4.1 Los 7 módulos del sistema

| Módulo (panel) | Contenidos | Estado | Lectura para este plan |
|----------------|-----------|--------|------------------------|
| Recursos | Capacitación, Riesgos | 23 alertas | Capacitación ya migrada; concentra rezagos de formación. |
| Cest. Integral | Política, Planes | OK | Política y plan de trabajo: aquí vive ST-01. |
| Cest. Salud | Ausentismo, AT, EL | Pendiente | Sin datos operando; ST-04 y ST-06 lo activan. |
| Cest. Pel. y Riesgos | IPERC, Controles | OK | Destino de ST-05. |
| Cest. Amenazas | Emergencias | OK | Destino de ST-07. |
| Verificación | Auditorías | OK | Destino de ST-08. |
| Mejoramiento | Acciones Correctivas | OK | Cierra el ciclo PHVA con Verificación (ST-08). |

### 4.2 Correspondencia con la estructura documental

Los códigos de los pendientes (1.1.4, 1.1.6, 1.1.8, 1.2.1, 1.2.2, 1.4) siguen la estructura
documental del SG-SST (Decreto 1072 de 2015). Esa numeración define el campo `capitulo` de las
estructuras de datos (ST-01 lo usa para agrupar el plan y el dashboard para clasificar pendientes).

**Trazabilidad panel-módulo (criterio transversal):** cuando un hallazgo se cierre desde el nuevo
submódulo, la tarjeta del panel debe desaparecer o degradar su severidad **sin intervención manual**,
porque ambos consumen la misma fuente vía contratos.

### 4.3 Criterios de priorización y resultado

Criterios: severidad/número de hallazgos atendidos · recurrencia operativa mensual · dependencia de
datos ya modelados · valor normativo y de auditoría.

| ID | Submódulo | Prioridad | Hallazgos que atiende | Carpeta real en el repo |
|----|-----------|-----------|-----------------------|-------------------------|
| ST-01 | Plan de Trabajo SG-SST y presupuesto | P1 | KPI plan 36 %; presupuesto 1.4 al 71 % | `modules/gestion-integral/plan-trabajo` (+ `modules/recursos/presupuesto`) |
| ST-02 | Comités y Actas (COPASST y Convivencia) | P1 | 1.1.6 ×2 y 1.1.8 ×2 (4 de 8) | `modules/recursos/copasst`, `modules/recursos/comite-convivencia`, `modules/recursos/capacitacion-copasst` |
| ST-03 | Afiliación al SSSI y vigencias documentales | P1 | 1.1.4 sin planilla; 12 vencidos | `modules/gestion-humana/afiliaciones`, `modules/recursos/afiliacion`, `modules/gestion-humana/documentos` |
| ST-04 | Incidentes, accidentes y casos PRIC | P2 | KPI accidentes 1; PRIC 0 | `modules/gestion-salud/investigacion-accidentes`, `reportes-accidentes`, `frecuencia-accidentalidad`, `severidad-accidentalidad` |
| ST-05 | Matriz IPERC de peligros y riesgos | P2 | Alertas de Recursos (riesgos) | `modules/gestion-peligros/identificacion-peligros`, `modules/gestion-peligros/metodologia-ipevr` |
| ST-06 | Salud ocupacional: ausentismo y exámenes | P2 | Módulo Cest. Salud pendiente | `modules/gestion-salud/ausentismo`, `evaluaciones-medicas`, `restricciones-medicas` |
| ST-07 | Emergencias: brigada, simulacros y recursos | P3 | Módulo Cest. Amenazas | `modules/gestion-amenazas/plan-prevencion`, `modules/gestion-amenazas/examenes-brigadista` |
| ST-08 | Verificación y mejoramiento | P3 | Auditorías y acciones correctivas | `modules/verificacion/auditoria-anual`, `modules/verificacion/definicion-indicadores`, `modules/mejoramiento/acciones-preventivas-correctivas`, `modules/mejoramiento/planes-mejoramiento` |

---

## 5. Especificaciones técnicas de los próximos submódulos

Esqueleto estándar de cada especificación: objetivo y alcance · pantallas y componentes · estructura
de datos · contrato IPC y logging · criterios de aceptación.

### 5.1 ST-01 · Plan de Trabajo SG-SST (P1)

**Objetivo.** Administrar el plan de trabajo anual: actividades con cronograma, responsables,
presupuesto y avance. Es el módulo que calcula el KPI "Plan de trabajo 36 %" y gestiona la partida del
código 1.4 (asignado $27.8M, ejecutado $19.7M, saldo $8.1M).

**Pantallas.** Dashboard del plan (hero con ejecución global + 4 KPI + columnas de ejecución por mes +
donut por capítulo + "En tu radar" + CTA al listado) · Listado de actividades (tabla enterprise con
micro-cronograma de 12 celdas, presupuesto y avance con barra semántica; filtros año/capítulo/estado;
export CSV) · Modales: registrar/editar, marcar ejecutada (con evidencia drag & drop), confirmar
eliminación.

**Estructura de datos** — entidad `actividad` (el plan agrupa `{ anio, empresa_id, actividades[] }`):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | entero | Identificador único de la actividad. |
| `codigo` | texto | Código del capítulo (1.4, 1.2.1, 2.1.1…). |
| `nombre` | texto | Descripción de la actividad tal como se auditará. |
| `meta` | texto | Meta o resultado esperado. |
| `indicador` | texto | Cómo se mide (conteo, porcentaje, fecha). |
| `frecuencia` | texto | Única, mensual, trimestral, semestral o anual. |
| `responsable` | texto + cargo | Nombre, cargo y área del responsable. |
| `meses[12]` | booleanos | Meses del año en que está programada. |
| `presupuesto` | 2 decimales | Asignado y ejecutado (alimenta el código 1.4). |
| `estado` | enum | Planificada, En ejecución, Ejecutada o Vencida. |
| `avance_pct` | entero 0-100 | Promedio ponderado = KPI del panel. |
| `evidencias[]` | lista | Archivos adjuntos con fecha y categoría. |

**Contrato IPC y logging:**

```js
// PUNTO DE INTEGRACION — ST-01 Plan de Trabajo
const res = await window.electronAPI.getPlanTrabajo(anio);
// res = { success, data: {
//   anio,
//   resumen: { total, ejecutadas, vencidas, avance_pct,
//              presupuesto: { asignado, ejecutado, saldo } },
//   actividades: [ ... ] } }
// Logging: [K+AIRPLAN][MODULO][ACCION][STATUS]
```

`resumen` es la proyección que consumirá el Panel de Control: el KPI del plan y la fila de
presupuesto del 1.4 deben salir de aquí, **no recalcularse** en el dashboard.

**Criterios de aceptación:**

- El promedio de avance reproduce exactamente el 36 % y la suma presupuestal 27.8 / 19.7 / 8.1 M.
- Marcar una actividad como ejecutada recalcula en vivo hero, KPI, gráficas, radar y barras, sin
  recargar.
- `Vencida` y `En ejecución` usan solo colores semánticos; el resto de la tabla permanece neutro.
- El micro-cronograma de 12 celdas es legible en móvil (se compacta a 6 por fila); el CSV respeta los
  filtros activos.
- Verificación en los dos viewports, consola limpia y logging `K+AIRPLAN` en todas las acciones.

### 5.2 ST-02 · Comités y Actas (P1)

**Objetivo.** Gestionar COPASST y Comité de Convivencia: vigencia, membresía, reuniones mensuales,
actas y compromisos. Atiende 4 de los 8 hallazgos del panel.

**Pantallas.** Dashboard de comités (una tarjeta por comité con vigencia, reunión del mes, últimos
compromisos, próximos a vencer; hero con conclusión global) · Registro de reuniones y actas (tabla
enterprise con fecha, nº de acta, asistentes, archivo y compromisos; carga drag & drop; filtro por
comité y año) · Modal de reunión (comité, fecha, asistentes, compromisos con detalle por fila).

**Estructura de datos** — entidades del módulo:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `comite` | enum | COPASST o Convivencia; cada registro pertenece a una empresa. |
| `vigencia` | fechas | Inicio y fin del periodo del comité electo. |
| `miembros[]` | lista | Integrantes con nombre, cargo, representación y suplencia. |
| `reuniones[]` | lista | Reuniones con fecha, `acta_id`, asistentes y `compromisos[]`. |
| `compromisos[]` | lista | Descripción, responsable, fecha y estado (Abierto, Cumplido). |
| `acta` | archivo | PDF del acta con fecha de carga; alimenta las alertas por ausencia. |

**Contrato IPC y logging:**

```js
// PUNTO DE INTEGRACION — ST-02 Comites y Actas
const res = await window.electronAPI.getComites(empresa_id);
// res = { success, data: { comites: [ { comite, vigencia, miembros,
//   reuniones: [ { fecha, acta, asistentes, compromisos } ] } ] } }
// Logging: [K+AIRCOM][MODULO][ACCION][STATUS]
```

**Criterios de aceptación:**

- El dataset reproduce los cuatro hallazgos (COPASST vigencia por vencer, COPASST sin reunión desde
  mayo-2026, Convivencia sin acta de constitución, Convivencia sin reunión desde nov-2025).
- Las alertas de rezago se calculan contra la fecha del sistema (no escritas a mano).
- Registrar una reunión con acta de agosto-2026 retira en vivo las tarjetas de rezago del hero y del
  dashboard.
- Las actas cargadas aparecen con ver/descargar (prototipo honesto con toast hasta integrar).

### 5.3 ST-03 · Afiliación al SSSI y vigencias documentales (P1)

**Objetivo.** Controlar las planillas mensuales de afiliación (pensiones, salud, riesgos laborales) y
las vigencias documentales del personal. Explica "Planillas registradas: 0" (falta sep-2026) y los 12
documentos vencidos, y los vuelve gestionables.

**Pantallas.** Dashboard (hero con estado del SSSI del año, conteo de vencidos; KPI de planillas
cargadas, vencidos, por vencer en 30 días y trabajadores afectados; grilla anual de 12 celdas; lista de
vigencias críticas) · Mesa de vigencias (tabla ordenada por días para vencer, con chip semántico y
acción que enlaza al expediente en Documentos) · Modal de planilla (mes, año, nº de afiliados, archivo
soporte; valida mes duplicado).

**Estructura de datos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `planilla` | registro mensual | Mes, año, empresa, nº de afiliados, archivo soporte y fecha de carga. |
| `estado_planilla` | enum | Cargada o Pendiente; alimenta la grilla anual y el hallazgo 1.1.4. |
| `vigencia` | registro por documento | Trabajador, tipo de documento, vencimiento y días restantes. |
| `semaforo` | derivado | Vencido (rojo), vence en 30 días (ámbar), vigente (neutro). |

**Contrato IPC y logging:**

```js
// PUNTO DE INTEGRACION — ST-03 Afiliaciones y vigencias
const res = await window.electronAPI.getAfiliaciones(anio);
// res = { success, data: { planillas: [12 meses con estado],
//   vigencias: [ { empleado_id, documento, vence_el, dias } ] } }
// Logging: [K+AIRAFIL][MODULO][ACCION][STATUS]
```

**Criterios de aceptación:**

- El conteo de documentos vencidos reproduce exactamente el 12 del KPI del panel.
- La grilla anual marca septiembre-2026 como pendiente y responde en vivo al registrar la planilla.
- La mesa de vigencias enlaza con el expediente del trabajador reutilizando la navegación con estado.

### 5.4 ST-04 · Incidentes, accidentes y casos PRIC (P2)

**Objetivo.** Ciclo completo de reporte e investigación de eventos (incidentes, AT, enfermedad
laboral), con seguimiento de casos activos y el registro del único accidente del año.

**Pantallas.** Dashboard de eventos (hero con resumen del año e indicadores de accidentalidad; KPI de
eventos reportados, abiertos, días perdidos e investigaciones al día; línea temporal mensual; donut por
tipo y parte del cuerpo; "En tu radar" con investigaciones vencidas) · Registro de eventos (tabla
enterprise con filtros y export CSV) · Modal de investigación (ficha guiada: descripción, causa
inmediata, causa básica, acciones correctivas y cierre con verificación de eficacia).

**Estructura de datos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `evento` | registro | Tipo, fecha, trabajador, descripción y lugar. |
| `gravedad` | enum | Leve, Moderada, Grave o Mortal. |
| `dias_perdidos` | entero | Días de incapacidad; alimenta accidentalidad. |
| `investigacion` | sub-registro | Causa inmediata, causa básica, `acciones[]` y fecha de cierre. |
| `estado` | enum | Reportado, En investigación, En seguimiento o Cerrado. |

**Contrato IPC y logging:**

```js
// PUNTO DE INTEGRACION — ST-04 Incidentes y accidentes
const res = await window.electronAPI.getEventos(anio);
// res = { success, data: { eventos: [ ... ],
//   indicadores: { accidentes_anio, casos_activos, dias_perdidos } } }
// Logging: [K+AIREVENTO][MODULO][ACCION][STATUS]
```

**Criterios de aceptación:**

- El dataset contiene exactamente un accidente en el año y ningún caso activo (cuadra ambos KPI).
- El flujo reportar → investigar → cerrar recalcula los KPI y retira el caso del hero al cerrarlo.
- Los indicadores se derivan del dataset y quedan listos para ST-06.

### 5.5 ST-05 · Matriz IPERC de peligros y riesgos (P2)

**Objetivo.** Identificación de peligros y valoración de riesgos por cargo y proceso (metodología GTC
45), con controles operacionales y reevaluación periódica. Alimenta por encadenamiento a formación,
salud y compras de EPP.

**Estructura de datos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `peligro` | registro | Área, proceso, cargo, tipo de peligro, descripción y clasificación GTC 45. |
| `valoracion` | nivel | Probabilidad × consecuencia → Bajo, Moderado, Alto o Extremo. |
| `controles[]` | lista | Controles por jerarquía (eliminación, sustitución, ingeniería, administrativos, EPP) y eficacia. |
| `reevaluacion` | fecha | Próxima revisión; genera alerta cuando vence. |

**Contrato IPC y logging:**

```js
// PUNTO DE INTEGRACION — ST-05 IPERC
const res = await window.electronAPI.getIperc(empresa_id);
// res = { success, data: { peligros: [ ... ],
//   resumen: { por_nivel: { bajo, moderado, alto, extremo } } } }
// Logging: [K+AIRIPERC][MODULO][ACCION][STATUS]
```

**Criterios de aceptación:**

- Pantalla única con resumen (columnas por nivel y barras horizontales por área) y detalle filtrable;
  export CSV.
- Los niveles Alto y Extremo usan color semántico **solo en el chip**, sin teñir filas completas.
- Editar una valoración recalcula el resumen y las alertas de reevaluación en vivo.

### 5.6 ST-06 · Salud ocupacional: ausentismo y exámenes médicos (P2)

**Objetivo.** Activar "Cest. Salud": ausentismo por causa médica (días y costos), exámenes médicos
ocupacionales y programas de vigilancia epidemiológica (PVE) asociados a los riesgos de ST-05.

**Estructura de datos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `ausencia` | registro | Trabajador, causa (común, laboral, accidente), días, mes y costo estimado. |
| `examen` | registro | Trabajador, tipo, fecha, concepto (Aprobado, Restricción, Diferido) y próximo vencimiento. |
| `pve` | registro | Programa de vigilancia con población objetivo, periodicidad y cobertura (%). |

**Contrato IPC y logging:**

```js
// PUNTO DE INTEGRACION — ST-06 Salud ocupacional
const res = await window.electronAPI.getSaludOcupacional(anio);
// res = { success, data: { ausentismo: [...], examenes: [...], pve: [...] } }
// Logging: [K+AIRSALUD][MODULO][ACCION][STATUS]
```

**Criterios de aceptación:**

- Dashboard con columnas de ausentismo mensual, donut de conceptos de exámenes y barras de cobertura
  de PVE.
- Las restricciones médicas activas se cruzan con los cargos de la matriz IPERC y se señalan en el
  radar.
- Dataset coherente con el año en curso, sin meses inventados (los meses sin datos no se grafican).

### 5.7 ST-07 · Emergencias: brigada, simulacros y recursos (P3)

**Objetivo.** Gestionar la respuesta a emergencias ("Cest. Amenazas"): brigada, plan de simulacros y
recursos de respuesta (extintores, botiquines, luces) con vigencia de recarga o inspección.

**Estructura de datos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `brigadista` | registro | Trabajador, brigada (evacuación, combate, primeros auxilios), capacitaciones vigentes. |
| `simulacro` | registro | Fecha, escenario, participación, observaciones y plan de mejora. |
| `recurso` | registro | Tipo, sede, última inspección/recarga y vencimiento con semáforo. |

**Contrato IPC y logging:**

```js
// PUNTO DE INTEGRACION — ST-07 Emergencias
const res = await window.electronAPI.getEmergencias(empresa_id);
// res = { success, data: { brigada: [...], simulacros: [...], recursos: [...] } }
// Logging: [K+AIREMER][MODULO][ACCION][STATUS]
```

**Criterios de aceptación:**

- Panel con próxima actividad de brigada, simulacros del año y recursos vencidos o por vencer en 30
  días.
- La tarjeta de brigadista muestra la vigencia de su capacitación y enlaza al registro de
  capacitaciones.

### 5.8 ST-08 · Verificación y mejoramiento (P3)

**Objetivo.** Cerrar el ciclo PHVA en "Verificación" y "Mejoramiento": auditorías internas (incluida la
Resolución 312 de 2019), inspecciones planeadas, hallazgos y acciones correctivas con seguimiento de
eficacia. Consume hallazgos de todos los módulos, por lo que se ejecuta al final.

**Estructura de datos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `auditoria` | registro | Fecha, alcance, estándar auditado, conclusión general y `hallazgos[]`. |
| `inspeccion` | registro | Área, fecha, ítems verificados con resultado y responsable. |
| `accion` | registro | Origen (auditoría, inspección, incidente, revisión), descripción, responsable, fecha y verificación de eficacia. |

**Contrato IPC y logging:**

```js
// PUNTO DE INTEGRACION — ST-08 Verificacion y mejoramiento
const res = await window.electronAPI.getVerificacion(anio);
// res = { success, data: { auditorias: [...], inspecciones: [...], acciones: [...] } }
// Logging: [K+AIRVERIF][MODULO][ACCION][STATUS]
```

**Criterios de aceptación:**

- Tablero del ciclo con auditorías del año, inspecciones al día y acciones abiertas por origen, con
  edad promedio.
- Toda acción correctiva cita su origen con el código del módulo que la generó (trazabilidad del
  cap. 4).

---

## 6. Roadmap de ejecución por fases

Cada fase cierra con los entregables estándar (módulo verificado, verificación registrada y
`CHANGELOG.md` actualizado) y puede ajustarse con el usuario antes de iniciarse, sin alterar la regla
de oro.

| Fase | Contenido | Resultado esperado al cerrar |
|------|-----------|------------------------------|
| Fase 0 | Conexión de los primeros contratos IPC reales (login, empresas, dashboard); navegación desde las tarjetas del Panel hacia los módulos migrados. *(La restauración de `kair-acceso.html` ya no aplica: el acceso está integrado en la app Electron.)* | Aplicación navegable de extremo a extremo con autenticación real y el mapa de módulos activo. |
| Fase 1 | ST-01, ST-02, ST-03 | Los tres módulos P1 construidos, verificados y con dataset coherente con el Panel; 6 de los 8 pendientes con módulo que los gestiona. |
| Fase 2 | ST-04, ST-05, ST-06 | Ciclo de eventos y riesgo técnico operando; "Cest. Salud" activo con datos. |
| Fase 3 | ST-07, ST-08 + refinamientos de navegación y reportes | Mapa completo de los 7 módulos cubierto y ciclo PHVA cerrado en la herramienta. |

### 6.1 Método de trabajo por módulo (4 pasos, sin saltos)

1. **Auditar** — revisar el estado actual del dominio y releer el `CHANGELOG.md`, `AGENTS.md` y esta
   especificación para fijar el alcance exacto de la sesión.
2. **Especificar y aprobar** — presentar al usuario qué se cambia, qué se conserva y el plan pequeño y
   verificable; ajustar la ST-xx si el usuario lo pide.
3. **Construir y verificar** — construcción por partes, ensamblado, validador estructural,
   previsualización y verificación automatizada en los dos viewports con correcciones inmediatas.
4. **Documentar** — capturas de evidencia y entrada en `CHANGELOG.md` con decisiones, contratos
   preservados y estado final.

### 6.2 Seguimiento y control

El registro maestro de avance es `CHANGELOG.md` (con el detalle de decisiones en `AGENTS.md`). Cada
módulo nuevo añade su entrada con el mismo formato. Este documento técnico se versiona junto al plan:
la presente edición es la **v1.0 (septiembre de 2026)** y su siguiente revisión procede **al cierre de
la Fase 1**, para incorporar los aprendizajes de los tres módulos P1 y reevaluar P2/P3 con el usuario.
Cualquier cambio de alcance aprobado se registra primero en la especificación y luego en el
`CHANGELOG.md`.

---

## 7. Riesgos y consideraciones de integración

| Riesgo | Impacto potencial | Mitigación adoptada |
|--------|-------------------|---------------------|
| Datasets demo que no cuadran con las cifras del Panel al integrar datos reales. | Pérdida de confianza en los KPI; dobles cálculos. | Cada especificación exige reproducir literalmente los valores del panel (36 %, 71 %, 12, 1 y 0) y proyecta el campo `resumen` que consumirá el dashboard. |
| Ampliación de alcance durante la construcción ("scope creep"). | Retrasos y módulos sobrecargados. | Regla de oro + ciclo en 4 pasos: lo no especificado se agrega como especificación nueva aprobada, nunca como cambio silencioso. |
| Daño a procesos o contratos existentes al conectar el backend real. | Ruptura de módulos verificados. | Prototipo honesto con `PUNTO DE INTEGRACION` documentado; contratos `{ success, data }`; conexión por contrato individual con verificación separada. |
| Tipografías de Google Fonts sin red en el entorno de escritorio. | Fuentes de respaldo visualmente distintas. | Pila de respaldo obligatoria en todos los módulos; empaquetado local de Manrope e Inter si el usuario lo aprueba. |
| Divergencia de datos entre empresas del grupo. | Indicadores mezclados entre empresas. | Aislamiento por empresa activa; todo contrato nuevo recibe empresa y/o año como parámetro. |

---

## 8. Gobernanza del método de trabajo

**Regla de oro:** solo se cambia lo solicitado explícitamente; ninguna modificación puede dañar
procesos de negocio, permisos, datos, formularios, cálculos, rutas ni integraciones existentes. Cuando
aparece una necesidad nueva, no se ejecuta de inmediato: se registra como especificación o mejora
pendiente y el usuario decide su prioridad.

**Método invariable:** auditar → aplicar especificaciones → verificar → documentar. Antes de modificar
código se explica al usuario qué se va a cambiar, qué se conserva y un plan pequeño y verificable; cada
respuesta de trabajo cierra con una explicación sencilla; cada entregable se presenta con sus cambios
visuales, la lista de archivos, el método de verificación y los siguientes pasos.

Las decisiones de este documento entran en vigencia con la aprobación del usuario.

---

## Control de versiones

| Versión | Fecha | Autoría | Contenido del cambio |
|---------|-------|---------|----------------------|
| 1.0 | Septiembre de 2026 | Javier Robles F. | Emisión inicial: estado del sistema, arquitectura y patrones, especificaciones ST-01 a ST-08, roadmap por fases y riesgos. |
| 1.0-repo | Septiembre de 2026 | Adaptación al repositorio | Traducción del flujo de prototipos HTML a la arquitectura Electron; mapeo ST-xx → carpetas reales de `modules/`; Fase 0 ajustada al acceso ya integrado. |
| 1.1 | Prevista al cierre de la Fase 1 | A definir con el usuario | Aprendizajes de ST-01 a ST-03, reevaluación de P2/P3 y ajuste del roadmap. |

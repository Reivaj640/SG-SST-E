# Gestión Integral · estructura del dashboard y plan de los pendientes

Fecha: 2026-10-02 · Repo: `SG-SST-E/sgsst-electron-app` · Rama `Dev-Pc`

Analiza cómo está armado un submódulo (tomando **Recursos** como referencia) y
traduce eso en la lista de tareas para cerrar los 4 submódulos de **Gestión
Integral** que todavía no existen.

---

## 1. Resumen

De los **13 submódulos** que Gestión Integral declara en el dashboard, **9 tienen
componente** y **4 no**: al hacerles clic caen en
`showGenericSubmoduleContent()` (`renderer.js:5898`), que pinta *"Funcionalidad
en Desarrollo"*.

| Pendiente | Nombre | Conflicto a definir |
|---|---|---|
| **2.7.1** | Matriz de requisitos legales | — |
| **2.8.1** | Mecanismos de comunicaciones | — |
| **2.12.1** | Equipos y Herramientas | se solapa con **4.2.5 Mantenimiento** (ya existe) |
| **2.13.1** | Elementos de Protección Personal | se solapa con **4.2.6 Entrega de EPP** (no existe) |

Además hay 3 cosas rotas de fondo que conviene arreglar antes o durante:

1. `modules/gestion-integral/index.js` **no exporta 3 de las 9 carpetas** que sí
   existen (`archivo-retencion`, `evaluacion-proveedores`,
   `evaluacion-seleccion`).
2. 9 de los 13 submódulos **comparten la clave de permiso**
   `gestion-integral.plan-trabajo`: si un rol tiene permiso de Plan de Trabajo,
   entra a los 9. No hay una clave propia por submódulo.
3. Dos archivos sueltos en `main/` declaran los mismos `window.X` que las vistas
   reales: `main/test-evaluacion-inicial-v2.js` (`window.EvaluacionInicialView`)
   y `main/_armar-evs.js` (`window.EvaluacionSeleccionComponent`). No se cargan
   desde `index.html`, pero son bombas de relojería para quien busque de dónde
   sale un componente.

---

## 2. La estructura: cómo se enchufa un submódulo

Son **3 capas**. Recursos es el ejemplo más limpio de las 3.

### Capa 1 — El dashboard (`renderer.js`)

Cuatro cosas, en este orden:

| Qué | Dónde | Qué hace |
|---|---|---|
| `ALL_SUBMODULES` | `renderer.js:37` | El registro maestro: módulo → lista de submódulos. Si un submódulo no está aquí, no aparece. |
| `SUBMODULE_PERMISSION_MAP_UI` | `renderer.js:139` | submódulo → clave de permiso. Se consulta en `getResourceForSubmodule()` (`:213`) y `isSubmoduleAllowed()` (`:259`). |
| La cadena de dispatch | `renderer.js:5192-5809` | Un `if/else if` por `submoduleName`, cada uno instanciando `window.XxxComponent` vía `createComponentSafely()` (`:5164`). |
| El fallback | `renderer.js:5898` | Sin caso → `showGenericSubmoduleContent()` → *"Funcionalidad en Desarrollo"*. |

El contrato del componente es fijo (ver `modules/recursos/responsable-sg/responsable-sg-logic.js:4`):

```js
new XxxComponent(submoduleContentDiv, currentCompany, moduleName, submoduleName, safeBackToModuleCallback)
```

y debe exponer `render()` y `destroy()`. `createComponentSafely` destruye el
componente anterior antes de crear el nuevo, así que **`destroy()` es
obligatorio** si el componente abre listeners o timers.

### Capa 2 — El módulo (`modules/<modulo>/<carpeta>/`)

El patrón de Recursos, submódulo por submódulo:

```
modules/recursos/responsable-sg/
  index.js                  20 líneas — exporta la clase
  responsable-sg-logic.js    el HOST: crea un iframe, escucha postMessage, delega a electronAPI
  responsable-sg-view.html   la página del iframe (carga el viewer)
  responsable-sg-viewer.js   la UI de verdad (~1400 líneas)
  responsable-sg-view.css    los estilos (~1550 líneas)
```

Los submódulos que además tienen dos audiences agregan un `-home.js` + `-portal-logic.js`
(lo que ve la empresa vs. lo que ve el trabajador: `capacitaciones`,
`comite-convivencia`, `copasst`, `presupuesto`).

El `-logic.js` **no dibuja nada**: arma el iframe y traduce los mensajes. El
`viewer.js` es el que pinta, y es el que no tiene `window.electronAPI` (por
eso el `logic` le presta sus APIs por `postMessage`).

**Y el `-logic.js` tiene que estar en `index.html`**, o el dispatch encuentra
`window.XxxComponent === undefined` y cae al mensaje de desarrollo aunque el
código exista.

### Capa 3 — Los datos (`main/` + `preload.js`)

Solo hace falta si el submódulo guarda **datos estructurados**. El camino que
ya usa el SVE (📦827) es:

```
main/<slug>-schema-sql.js     las tablas + las migraciones
main/<slug>-bridge.js         los handlers ipcMain.handle('<slug>:*')
main.js                       registro del schema + de los handlers
preload.js                    los métodos en el contextBridge
main/sync-serializer.js       para que el dato viaje a los otros equipos
main/test-<slug>-bridge.js    pruebas (se corren con Electron, no con node)
```

Y el patrón de **persistencia en el renderer** es de 3 archivos:
`<slug>-persistencia.js` (el único que sabe que hay base), `<slug>-app.js` (el
store con `sombra` + diff) y `<slug>-views.js` (las vistas, que **no** conocen
la base).

### Reglas del repo que aplican (AGENTS.md:176-249)

- `var`, no `let`/`const` (compat con el legacy).
- Helpers privados con `_` adelante: `_renderHeader`, `_bindEvents`.
- **Siempre** escapar con `KairUI.esc()` y fechas con `KairHelpers.formatDate()`.
- Solo clases CSS canónicas `kair-*` (BEM). No inventar clases nuevas.
- **Nunca** dejar `addEventListener` sin limpiar en `destroy()`.
- `window.X = X` siempre al final del archivo.

---

## 3. Estado real de los 13 submódulos

| ID | Submódulo | Componente | Carpeta | Estado |
|---|---|---|---|---|
| 2.1.1 | Política del SG-SST | `PoliticaComponent` | `politica/` | 🟢 8 archivos |
| 2.2.1 | Objetivos SST | `ObjetivosSSTComponent` | `objetivos-sst/` | 🟢 6 |
| 2.3.1 | Evaluación inicial del SG-SST | `EvaluacionInicialView` | `evaluacion-inicial-sg-sst/` | 🟢 9 |
| 2.4.1 | Plan de Trabajo Anual | `PlanTrabajoComponent` | `plan-trabajo/` | 🟢 7 |
| 2.5.1 | Archivo y retención documental | `ArchivoRetencionComponent` | `archivo-retencion/` | 🟢 7 |
| 2.6.1 | Rendición de cuentas | `RendicionCuentasComponent` | `rendicion-cuentas/` | 🟢 7 |
| **2.7.1** | **Matriz de requisitos legales** | — | — | 🔴 **pendiente** |
| **2.8.1** | **Mecanismos de comunicaciones** | — | — | 🔴 **pendiente** |
| 2.9.1 | Identif. y evaluac. de bienes y servicios | `EvaluacionProveedores` | `evaluacion-proveedores/` | 🟢 3 |
| 2.10.1 | Evaluación y selección de proveedores | `EvaluacionSeleccionComponent` | `evaluacion-seleccion/` | 🟢 6 |
| 2.11.1 | Gestión del Cambio | `GestionDelCambioComponent` | `gestion-del-cambio/` | 🟢 2 |
| **2.12.1** | **Equipos y Herramientas** | — | — | 🔴 **pendiente** |
| **2.13.1** | **Elementos de Protección Personal** | — | — | 🔴 **pendiente** |

**Ninguno de los 9 que ya existen tiene base de datos propia.** Usan
`electronAPI.*` para documentos (`getDocumentFolders`, `uploadDocument`,
`getPDFPreview`…) y un poco de `localStorage`. El único con dato estructurado
propio en todo el módulo es el SVE (3.1.2), que es de Gestión de la Salud.

Y 4.2.5 Mantenimiento (que se solapa con 2.12.1) usa
`main/mantenimiento-bridge.js`, que **trabaja sobre un Excel** en la carpeta de
la empresa (`_findExcelFile(dir, 'GS-FO-008' | 'MANTENIMIENTO' | 'CRONOGRAMA')`,
`mantenimiento-bridge.js:214`), no contra SQLite.

---

## 3b. Lo que YA existe en el repositorio de archivos (investigado 2026-10-02)

La carpeta del SG-SST en la unidad de Google Drive tiene una carpeta por
submódulo, y los 4 pendientes también. Eso decide el modelo: la **definición
va en SQLite y la evidencia se queda como documento** en esa misma carpeta.

| Carpeta | Qué hay | Qué significa para el plan |
|---|---|---|
| `2.7.1 Matriz de requisitos legales` | `Matriz Transversal 15.4.2020 Vol I.xlsm` (16,5 MB) | La matriz legal **ya existe** como libro de Excel. 2.7.1 debe leerlo, no inventarlo. |
| `2.8.1 Mecanismo de comunicaciónes` | 18 archivos, casi todos `Carta Tempoactiva N.docx` (2017-2024) + `GT-PR-001` y `GT-FO-002` (quejas, reclamos y sugerencias) | La carpeta se está usando de **buzón de cartas**, no de matriz. La matriz de comunicación no existe. |
| `2.12.1 Equipos y Herramientas` | **vacía** | No hay inventario. |
| `2.13.1 Elementos de Protección Personal` | **vacía** | No hay nada de EPP acá (está en 4.2.6, ver abajo). |

### 4.2.5 ya tiene el inventario escondido dentro del cronograma

`GS-FO-008 CRONOGRAMA MANTENIMIENTO PREVENTIVO.xlsx` (hoja `General`,
21 equipos/instalaciones) tiene estas columnas:

`Item | Instalación/equipo | Codigo del equipo | Responsable del Mto |
Diagnostico | Actividades realizadas | Frecuencia | Enero..Diciembre x MPP/MPE/MPC`

O sea: **las 5 primeras columnas YA son un inventario parcial** (nombre, código,
responsable, frecuencia) y las 36 siguientes son el cronograma mensual. La
frecuencia viene en tres clases: MPP (preventivo programado), MPE (preventivo
correctivo) y MPC (correctivo).

### 4.2.6 ya tiene la matriz de EPP, una hoja por cargo

`GI-FO-011 MATRIZ DE EPP.xls` tiene 5 hojas, una **por cargo**
(Superintendente de Mina, ELÉCTRICO 4, …) más una de `Valoración` y una
`GP` con la escala de priorización de factores de riesgo (N.E / G.P / Int.1).
Columnas:

`RIESGO | ORIGEN Y/O FORMA DEL RIESGO | PARTE DEL CUERPO | EPP |
FACTORES (Riesgo a intervenir / Individuo / EPP) | ESPECIFICACIONES |
GUIA DE REPOSICION // MARCA | EJEMPLAR`

### Conclusión de la frontera (con datos, no con suposiciones)

**2.12.1 vs 4.2.5 — el inventario se IMPORTA del cronograma.** No hay dos
listas: las 5 primeras columnas del GS-FO-008 son el inventario que a 2.12.1
le falta, y lo que le sobra ahí (fecha de adquisición, valor, vida útil,
estado, cantidad) se agrega en la app. 4.2.5 conserva la rejilla de meses,
pero su `item` pasa a apuntar a `gi_equipos.id`.
Migración única, de una vez.

**2.13.1 vs 4.2.6 — 2.13.1 importa `GI-FO-011`; 4.2.6 se
construye después** como la vista de proceso (pendientes de entrega) sobre las
mismas tablas. Las columnas de la matriz de EPP ya calzan 1:1 con lo que hay
que guardar.

---

## 4. Las tareas

Paquetes pensados para que cada uno sea commiteable por separado. El orden
importa: primero lo transversal (arranca T0), después los 4 submódulos.

### T0 · Transversal (rápido, destraba todo lo demás)

| # | Tarea | Dónde | Hecho cuando |
|---|---|---|---|
| T0.1 | `index.js` exporta las 9 carpetas (faltan 3) | `modules/gestion-integral/index.js` | el script da 0 "NO exportados" |
| T0.2 | Clave de permiso propia por submódulo | `renderer.js:139` + donde se guardan los roles | un rol con `gestion-integral.matriz-legal` **no** entra a 2.4.1 |
| T0.3 | Sacar `main/_armar-evs.js` y `main/test-evaluacion-inicial-v2.js` fuera de la app (o renombrarlos `_test-`) | `main/` | ningún archivo suelto declara `window.XxxComponent` |
| T0.4 | Guarda estática: todo submódulo de `ALL_SUBMODULES` tiene caso en el dispatch | test nuevo `main/test-shell-submodulos.js` | la guarda **falla** si se agrega un 2.14 sin dispatch |
| T0.5 | Guarda estática: todo `XxxComponent` del dispatch está cargado en `index.html` | mismo test | la guarda falla si se sube un `-logic.js` y se olvida el `<script>` |

> T0.4 es la que evita volver a tener pendientes invisibles. Hoy nadie lo
> comprueba: por eso 4 submódulos llevan meses mostrando "en desarrollo" sin que
> nadie lo note.

### T1 · 📦828 · 2.7.1 Matriz de requisitos legales

**Qué es.** Los 9 requisitos del Decreto 1072 de 2015 que la empresa debe
documentar, cada uno con su norma, su evidencia, su responsable y su estado.
Es la espina dorsal del SG-SST: el resto de submódulos cuelga de acá.

**Modelo de datos — 3 tablas** (a confirmar):

```
gi_requisitos_legales   (id, empresa_id, codigo, nombre, norma, descripcion,
                         responsable, estado, periodo, creado_en, actualizado_en)
gi_requisitos_evidencias(requisito_id, empresa_id, documento_id, vigente_desde)
gi_normas_aplicables    (empresa_id, norma, articulo, obligacion, aplica, notas)
```

**Tareas**

| # | Tarea | Entregable |
|---|---|---|
| T1.1 | `main/gi-requisitos-schema-sql.js` + bridge con 6 canales (leer/grabar/eliminar requisito, evidencia, norma, exportar) + registro en `main.js` + `preload.js` | los datos viven en `kair.db`, no en la carpeta de la empresa |
| T1.2 | `modules/gestion-integral/matriz-legal/` con los 5 archivos del patrón | carpeta nueva |
| T1.3 | La vista: los 9 requisitos como tarjetas con semáforo, filtro por estado, detalle con la evidencia | `matriz-legal-viewer.js` |
| T1.4 | Leer `Matriz Transversal 15.4.2020 Vol I.xlsm`; los 9 requisitos del Decreto 1072 se siembran como definición (**sin** datos inventados) | la matriz real de la empresa se ve en la app |
| T1.5 | `main/test-gi-requisitos-bridge.js` + guarda estática de cableado | verde |
| T1.6 | `sync-serializer.js`: entidad `gi_requisitos_legales` | el dato llega al otro equipo |

### T2 · 📦829 · 2.8.1 Mecanismos de comunicaciones

**Qué es.** La matriz de circulación de información: qué se comunica, a quién,
por qué medio, con qué frecuencia, quién responde y dónde queda la evidencia.
Cubre los mecanismos del Decreto 1072 y alimenta los comités (2.11.1) y el
archivo (2.5.1).

**Modelo de datos — 2 tablas:**

```
gi_comunicaciones   (id, empresa_id, que, a_quien, medio, frecuencia,
                     responsable, fecha, estado, seguimiento)
gi_comunicaciones_adjuntos (comunicacion_id, empresa_id, documento_id)
```

**Tareas**

| # | Tarea | Entregable |
|---|---|---|
| T2.1 | Schema + bridge (leer/grabar/eliminar comunicación, adjuntar evidencia) + `main.js` + `preload.js` | en SQLite |
| T2.2 | Carpeta `mecanismos-comunicacion/` con los 5 archivos | carpeta nueva |
| T2.3 | Vista: tabla tipo matriz (canal × público), contador de pendientes de respuesta, filtro por medio | la vista |
| T2.4 | Conectar con 2.5.1: la evidencia que se adjunte debe caer en el archivo con su carpeta y su tiempo de retención | 1 evidencia = 1 documento en el archivo |
| T2.5 | Tests + `sync-serializer` | verde |

### T3 · 📦830 · 2.12.1 Equipos y Herramientas

**El solapamiento importa y hay que decidirlo ANTES de escribir código.**

Hoy 4.2.5 existe y es una **hoja de mantenimiento en Excel** (el cronograma de
mantenimientos del programa). 2.12.1 "Equipos y Herramientas" es otra cosa: el
**inventario** de los equipos (qué hay, dónde, a cargo de quién, desde cuándo,
cuánto costó, en qué estado).

**Recomendación:** 2.12.1 = inventario en SQLite; 4.2.5 = el cronograma, que
pasa a leer el inventario (el `item` del mantenimiento apunta a un
`gi_equipo.id` en vez de a un texto suelto). Así no se mantienen dos listas que
se contradicen.

**Modelo de datos — 2 tablas:**

```
gi_equipos       (id, empresa_id, nombre, tipo, area, cantidad, responsable,
                  fecha_adquisicion, valor, vida_util_anios, estado, eliminado_en)
gi_mantenimientos(equipo_id, empresa_id, tipo, periodicidad, ultimo, proximo, estado)
```

**Tareas**

| # | Tarea | Entregable |
|---|---|---|
| T3.0 | Solapamiento con 4.2.5 — **ya resuelto**: el inventario se importa del cronograma | ver 3b |
| T3.1 | Schema + bridge (CRUD de equipo, mantenimientos del equipo, historial) + `main.js` + `preload.js` | en SQLite |
| T3.2 | Carpeta `equipos-herramientas/` con los 5 archivos | carpeta nueva |
| T3.3 | Vista: inventario filtrable (área, tipo, estado) + ficha del equipo con sus mantenimientos | la vista |
| T3.4 | Importar el GS-FO-008: las 5 primeras columnas son el inventario (21 equipos con responsable y frecuencia) | el inventario arranca con los equipos reales, no vacío |
| T3.5 | Bridge de 4.2.5: `item` → `gi_equipos.id` | los dos submódulos hablan del mismo equipo |
| T3.6 | Tests + `sync-serializer` | verde |

### T4 · 📦831 · 2.13.1 Elementos de Protección Personal

**El solapamiento:** 4.2.6 "Entrega de EPP" **no existe** (no tiene caso en el
dispatch). O sea que hoy nadie entrega EPP en la app.

**Recomendación:** 2.13.1 construye **el catálogo y la matriz** (qué EPP, para
qué riesgo, vida útil, reposición) + **el registro de entrega** (a quién, qué,
cuándo, quién lo entregó, firma). 4.2.6 queda después como la vista de proceso
(pendientes de entrega) leyendo las mismas tablas.

**Modelo de datos — 3 tablas:**

```
gi_epp_catalogo (id, empresa_id, nombre, tipo, riesgo, vida_util_meses,
                 periodicidad_reposicion, valor_unitario, activo)
gi_epp_entregas  (epp_id, empresa_id, trabajador_id, cargo, area, cantidad,
                  fecha, responsable, firmado, observaciones)
gi_epp_matriz    (empresa_id, cargo, area, riesgo, epp_id, obligatoriedad)
```

**Tareas**

| # | Tarea | Entregable |
|---|---|---|
| T4.0 | Solapamiento con 4.2.6 — **ya resuelto**: 2.13.1 importa GI-FO-011, 4.2.6 después | ver 3b |
| T4.1 | Schema + bridge + `main.js` + `preload.js` | en SQLite |
| T4.2 | Carpeta `epp/` con los 5 archivos | carpeta nueva |
| T4.3 | Vista: 3 pestañas (catálogo / matriz cargo×riesgo / entregas) | la vista |
| T4.4 | Importar `GI-FO-011 MATRIZ DE EPP.xls` (5 hojas, una por cargo) en vez de precargar a mano | las columnas del .xls ya calzan con las tablas |
| T4.5 | Exportar a Excel con el formato que la empresa ya usa para la entrega | el documento que la empresa ya presenta |
| T4.6 | Tests + `sync-serializer` | verde |

---

## 5. Orden sugerido

```
T0 (transversal, 1 paquete)          ← destraba y evita más pendientes invisibles
  └─ T1 2.7.1 matriz legal           ← primero: es la espina dorsal
       └─ T2 2.8.1 comunicaciones     ← depende de T1 (evidencia compartida)
            └─ T3 2.12.1 equipos     ← depende de la decisión con 4.2.5
                 └─ T4 2.13.1 EPP   ← depende de la decisión con 4.2.6
```

Cada paquete se cierra con: pruebas en verde + render real verificado +
`docs/capturas/` + entrada en el CHANGELOG. Nada de commitear sin que el owner
lo autorice.

---

## 6. Decisiones que necesito del owner

1. **Modelo de datos de los 4 nuevos.** ¿SQLite + sync (el camino del SVE,
   recomendado) o documentos en la carpeta de la empresa (como 2.5.1 Archivo)?
   Afecta el 100% del trabajo de los 4 paquetes.
2. ~~2.12.1 vs 4.2.5~~ — **RESUELTO 2026-10-02** con la investigacion del
   repositorio: el inventario se importa del cronograma (seccion 3b).
3. **2.13.1 vs 4.2.6.** ¿2.13.1 arma catálogo + entregas y 4.2.6 queda para
   después (recomendado), o se hacen las dos de una?
4. **Por dónde se arranca.** ¿T0 primero, o 2.7.1 directo?

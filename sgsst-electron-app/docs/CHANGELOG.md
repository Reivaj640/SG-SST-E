# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.51] - 2026-02-28

### Added
- **Calificación PCL Regional y Nacional** 🆕
  - Dos secciones separadas en la UI con identificación visual clara
  - Calificación Regional: Ícono de marcador, color azul índigo (#4F46E5)
  - Calificación Nacional: Ícono de edificio, color azul oscuro (#174ea6)
  - 14 campos en total (7 Regional + 7 Nacional)

- **Campos de Calificación Regional** (Columnas FC-FI, Índices 158-164)
  - Estado del Proceso Regional
  - Fecha de Solicitud Regional
  - Fecha Dictamen Regional
  - % PCL Regional
  - Origen Calificado Regional
  - Fecha de Estructuración Regional
  - Observaciones Calificación Regional

- **Campos de Calificación Nacional** (Columnas FJ-FP, Índices 165-171)
  - Estado del Proceso Nacional
  - Fecha de Solicitud Nacional
  - Fecha Dictamen Nacional
  - % PCL Nacional
  - Origen Calificado Nacional
  - Fecha de Estructuración Nacional
  - Observaciones Calificación Nacional

### Fixed
- **Error `list assignment index out of range`** 🐛
  - Movida la extensión de `fila_completa` antes de las asignaciones de Calificación
  - Ahora se extiende a 172 elementos antes de asignar índices 158-171
  - Archivo: `Portear/src/actualizar_ausentismo.py` (líneas 1073-1075)

- **Datos de Calificación no se guardaban en Excel** 🐛
  - Corregido mapeo de campos en `ejecutarGuardadoReal()`
  - Ahora se envían correctamente los campos Regional y Nacional a Python
  - Archivo: `modules/gestion-salud/ausentismo/medicion-ausentismo.js` (líneas 4311-4328)

### Changed
- **Estructura de Datos de Calificación** 🔄
  - Objeto `followUpData.calificacion` ahora contiene campos Regional y Nacional
  - Compatibilidad mantenida con `calificacionLegacy` para registros antiguos
  - Función `cargarRegistroYAbrirPanel()` actualizada para cargar ambos conjuntos

- **UI del Panel de Seguimiento** 🎨
  - Sección 5: Calificación PCL ahora tiene dos subsecciones visuales
  - Separadores con bordes de 2px y colores distintivos
  - Títulos con íconos y uppercase para claridad

### Technical Details
- **Frontend:** `medicion-ausentismo.js`
  - Líneas 2743-2845: UI de Calificación PCL
  - Líneas 3600-3620: `saveSeguimientoData()` - Recolección de datos
  - Líneas 4070-4095: `cargarRegistroYAbrirPanel()` - Carga de datos
  - Líneas 4311-4328: `ejecutarGuardadoReal()` - Envío a Python

- **Backend:** `Portear/src/actualizar_ausentismo.py`
  - Líneas 985-1000: Índices de columnas Regional/Nacional
  - Líneas 1073-1075: Extensión de lista antes de asignaciones
  - Líneas 1077-1092: Asignación de campos Regional (FC-FI)
  - Líneas 1094-1100: Asignación de campos Nacional (FJ-FP)

### Documentation
- **Nueva Documentación:** `docs/ACTUALIZACION_v0.1.51_CALIFICACION_PCL.md`
  - Estructura de datos completa
  - Flujo de datos frontend → backend → Excel
  - Errores corregidos y soluciones
  - Pruebas realizadas

---

## [0.1.50] - 2026-02-26

### Added
- **Sistema de Alertas para Registros Existentes** 🆕
  - Modal moderno al guardar seguimiento con registros duplicados
  - Opciones: "Actualizar registro seleccionado" o "Crear nuevo registro"
  - Diseño con gradiente naranja, avatar con iniciales, timeline de registros
  - Función `buscar_registros_por_cedula()` en Python
  - Handler IPC `buscar-registros-cedula` en main.js

- **Cálculos Automáticos en Formulario** 🆕
  - Edad: Calculada desde fecha de nacimiento
  - IMC: Calculado desde peso/talla² (talla en cm)
  - Estado Nutricional: 6 categorías con indicadores visuales
  - Días Trabajados: Calculado desde fecha de ingreso (6 días trabajo, 1 descanso)
  - Antigüedad: Años desde fecha de ingreso

- **Nuevos Campos en Formulario de Seguimiento**
  - Salud: Peso (Kg), Talla (cm), IMC, Estado Nutricional, Actividades Extralaborales
  - Laborales: Edad, Tipo de Cargo, Tipo de Evento

- **Estadísticas en Tiempo Real** 📊
  - KPIs se actualizan al aplicar filtros (Año/Mes)
  - Funciones: `calculateKPIsFromRawData()`, `calculateKPIsFromFilteredData()`
  - Handler `read-ausentismo-data` para cargar todos los datos
  - Tarjetas: Casos Activos, Próximos a Vencer, Docs Pendientes, Cerrados (Mes)

- **Modal de Detalles Modernizado** 👁️
  - Header con ícono en gradiente
  - Employee card con avatar
  - Timeline vertical de incapacidades
  - Badges de estado con colores
  - Animaciones fade in / slide up

### Changed
- **Organización de Columnas en PRI.xlsx** ⚠️
  - Datos se guardan en columnas específicas (C-AA)
  - Función `indice_a_columna()` para columnas después de Z
  - Cálculo automático de edad, antigüedad, estado nutricional

- **Filtros Actualizan KPIs** 🔄
  - `applySeguimientoFilters()` ahora recalcula estadísticas
  - Event listeners en selectores de Año/Mes
  - Filtros se aplican solo con click en botón "Filtrar"

- **Mejoras en Logging** 📝
  - Logs `[KPIs Raw]`, `[KPIs Filtered]` para depuración
  - Logs `[GUARDAR SEGUIMIENTO]` con detalle de acciones
  - Logs `[ESTADISTICAS]` para carga de datos

### Fixed
- **Error de Columnas Excel** 🐛
  - Problema: `[7 is not a valid coordinate or range`
  - Causa: Columna AA mal calculada (chr(91) = '[')
  - Solución: Función `indice_a_columna()` con lógica para AA, AB, AC...

- **KPIs en Cero** 🐛
  - Problema: Todas las tarjetas mostraban "0"
  - Causa: Handler `read-ausentismo-data` no existía
  - Solución: Handler implementado en main.js

- **Filtros Auto-Aplicados** 🐛
  - Problema: Filtros se aplicaban al cambiar selección (sin click)
  - Solución: Removidos event listeners automáticos

### Technical
- **Python Script (actualizar_ausentismo.py)**
  - Función `guardar_seguimiento()` con columnas específicas
  - Función `buscar_registros_por_cedula()` para alertas
  - Funciones auxiliares: `calcular_edad()`, `calcular_antiguedad()`, `calcular_estado_nutricional()`, `calcular_dias_trabajados()`

- **Frontend (medicion-ausentismo.js)**
  - Función `mostrarModalSeleccionRegistros()` con diseño moderno
  - Función `confirmarGuardadoConSeleccion()` para interacción
  - Función `calculateKPIsFromFilteredData()` para filtros

- **Backend (main.js)**
  - Handler `buscar-registros-cedula` para búsqueda de duplicados
  - Handler `read-ausentismo-data` para estadísticas

### Documentation
- **Nueva Documentación Creada:**
  - `docs/RESUMEN_CAMBIOS_v0.1.50.md` - Resumen completo de cambios
  - Actualización de `docs/CHANGELOG.md` con versión 0.1.50

## [0.1.49] - 2026-02-26

### Added
- **Sistema Dual de Archivos para Ausentismo** 🆕
  - Separación clara entre archivo de registro general (PI-FO-076) y seguimiento de casos (PRI.xlsx)
  - Documentación completa en `docs/ARQUITECTURA_AUSENTISMO_DUAL.md`

- **Nuevo Handler IPC: `get-pri-seguimiento-data`** 
  - Lee específicamente el archivo PRI.xlsx
  - Selecciona automáticamente la hoja "Casos en seguimiento"
  - Detección inteligente de encabezados
  - Logs de depuración detallados
  - Ubicación: `main.js` línea ~3251

- **Nueva API en preload.js**
  - `getPriSeguimientoData(companyName)` - Expone el handler `get-pri-seguimiento-data`
  - Permite al frontend leer datos del PRI.xlsx para seguimiento detallado

### Changed
- **Handler `get-ausentismo-data` MODIFICADO** ⚠️
  - Ahora usa **PI-FO-076 / PG-FO-076 / GI-FO-076** para la lista principal de ausentismo
  - **NO usa PRI.xlsx** para consultas generales
  - Lógica de selección mejorada:
    1. Busca específicamente PI-FO-076, PG-FO-076 o GI-FO-076
    2. Si no encuentra, usa el primer .xlsx que NO sea PRI.xlsx
    3. Fallback: usa el primer archivo .xlsx disponible

- **Mejoras en Logs de Depuración**
  - Logs detallados que muestran TODOS los archivos en la carpeta de ausentismo
  - Búsqueda específica de archivos con "PRI" en el nombre
  - Confirmación visual de qué archivo se está seleccionando
  - Logs separados para `get-ausentismo-data` y `get-pri-seguimiento-data`

### Fixed
- **Problema de selección de archivo PRI.xlsx**
  - El sistema ahora encuentra correctamente el archivo PRI.xlsx cuando existe
  - Se filtra el archivo temporal `~$PRI.xlsx` automáticamente
  - Se selecciona la hoja correcta ("Casos en seguimiento") en lugar de "Introducción"

### Documentation
- **Nueva Documentación Creada:**
  - `docs/ARQUITECTURA_AUSENTISMO_DUAL.md` - Arquitectura completa del sistema dual
    - Flujo de datos por sección
    - Handlers IPC implementados
    - Logs de depuración de ejemplo
    - Consideraciones importantes sobre sincronización

- **README.md Actualizado:**
  - Versión actualizada a 0.1.49
  - Tabla de APIs de ausentismo actualizada con `getPriSeguimientoData` y `saveFollowUp`
  - Enlace a nueva documentación de arquitectura dual

### Technical Details
- **Archivos Modificados:**
  - `main.js` (+250 líneas)
    - Modificado `get-ausentismo-data` para usar PI-FO-076
    - Agregado `get-pri-seguimiento-data` para PRI.xlsx
    - Agregada función `obtenerRutaPri()` para obtener ruta específica de PRI.xlsx
    - Modificado `save-follow-up` para usar `obtenerRutaPri()` en lugar de `obtenerRutaAusentismo()`
  - `preload.js` (+2 líneas)
    - Expuesta nueva API `getPriSeguimientoData`
  - `components/seguimiento/seguimiento-incapacidades.html` (+120 líneas)
    - `viewCase()` → async, carga PRI.xlsx
    - `loadPriDataForCase()` → nueva función
    - `saveFollowUp()` → usa API de Electron directamente
  - `README.md` (versión 0.1.49)
  - `docs/CHANGELOG.md` (este archivo)
  - `docs/ARQUITECTURA_AUSENTISMO_DUAL.md` (nuevo)
  - `docs/ACTUALIZACION_FRONTEND_SEGUIMIENTO_v0.1.49.md` (nuevo)
  - `docs/RESUMEN_CAMBIOS_v0.1.49.md` (nuevo)

### Next Steps (Pendientes)
- [x] Actualizar `seguimiento-incapacidades.html` para usar `getPriSeguimientoData` en "Abrir Seguimiento" ✅
- [x] Modificar handler `save-follow-up` para usar PRI.xlsx específicamente ✅
- [x] Conectar formulario de seguimiento con la función de guardado ✅

### Frontend - Actualización Completada (Parte 2)
- **`seguimiento-incapacidades.html` MODIFICADO** ⚠️
  - Función `viewCase()` ahora es asíncrona y carga datos desde PRI.xlsx
  - Nueva función `loadPriDataForCase()` para cargar datos específicos del PRI
  - Función `saveFollowUp()` actualizada para usar API de Electron directamente
  - Eliminada dependencia de `sendMessageToParent()` para guardado
  - Agregados logs de depuración detallados

- **Flujo de Carga de Datos:**
  1. Abre caso → Carga datos básicos desde PI-FO-076
  2. Llama `getPriSeguimientoData()` → Lee PRI.xlsx
  3. Busca caso por cédula/nombre en PRI
  4. Si encuentra → Carga cargo, área, EPS, ARL
  5. Si no encuentra → Caso nuevo (solo datos básicos)

- **Flujo de Guardado:**
  1. Usuario llena formulario
  2. Click "Guardar Seguimiento"
  3. `saveFollowUp()` → `window.electronAPI.saveFollowUp()`
  4. Handler `save-follow-up` busca PRI.xlsx específicamente
  5. Python escribe en PRI.xlsx
  6. Recarga tabla y muestra notificación de éxito

- **Archivos Modificados:**
  - `components/seguimiento/seguimiento-incapacidades.html` (+120 líneas)
    - `viewCase()` → async, carga PRI.xlsx
    - `loadPriDataForCase()` → nueva función
    - `saveFollowUp()` → usa API de Electron directamente

---

## [0.1.48] - 2026-02-25

### Added
- **Módulo de Seguimiento PRIC (Proceso de Rehabilitación e Incorporación Laboral)** 🆕
  - Panel slideover de seguimiento de incapacidades con diseño moderno
  - 5 secciones especializadas: Datos Generales, Incapacidad Temporal, Etapas PRIC, Seguimiento Recomendaciones, Calificación PCL
  - Navegación horizontal por pestañas con animaciones fade-in
  - Carga automática de datos del empleado desde la tabla de seguimiento
  - Tabla dinámica de recomendaciones con capacidad de agregar/eliminar filas
  - Integración con hoja "Casos en seguimiento" de Excel (pendiente implementación real)

- **Funcionalidades de Seguimiento de Incapacidades**
  - Botón "Abrir Seguimiento" en modal de detalles de empleado
  - Autocompletado de datos laborales (cargo, área, EPS, ARL)
  - Campos de solo lectura para datos que vienen del empleado
  - ARL prellenado con "COLMENA SEGUROS" por defecto
  - Validación de fechas y campos obligatorios

- **Interfaz de Usuario Mejorada**
  - Panel slideover (95% ancho, máx 1100px) con backdrop y efecto blur
  - Sistema de navegación horizontal con 5 pestañas
  - Scrollbars personalizados con estilos K+AIR
  - Botones con efectos hover y transiciones suaves
  - Notificaciones toast de éxito/error

### Changed
- **Actualización de Documentación**
  - README.md actualizado con sección completa de Módulo de Ausentismo y Seguimiento PRIC
  - Agregados detalles de algoritmo de detección de casos en seguimiento
  - Documentación de métodos del componente: `createSeguimientoPanel()`, `closeSeguimientoPanel()`, `showSeguimientoPanelSection()`, etc.
  - Actualizada versión del documento a 2.1
  - CHANGELOG.md actualizado con cambios de versión 0.1.48

- **Mejoras en el Módulo de Ausentismo (3.3.6)**
  - Refactorización de `renderNotaSeguimientoSection()` para pasar datos completos del empleado
  - Mejora en serialización de datos para botones dinámicos
  - Optimización de carga de datos en panel PRIC

### Technical Details
- **Archivos Modificados:**
  - `modules/gestion-salud/ausentismo/medicion-ausentismo.js` (+850 líneas)
    - Agregados métodos: `createSeguimientoPanel()`, `closeSeguimientoPanel()`, `showSeguimientoPanelSection()`, `cargarDatosEnPanelSeguimiento()`, `addRecomRow()`, `removeRecomRow()`, `saveSeguimientoData()`
    - Actualizado método `abrirSeguimiento()` para abrir panel slideover
    - Modificado `renderNotaSeguimientoSection()` para pasar datos del empleado
  
- **Estilos CSS:**
  - ~200 líneas de CSS personalizado para panel slideover
  - Variables CSS para consistencia de colores (--sp-primary, --sp-accent, etc.)
  - Animaciones spFadeIn para transiciones entre pestañas
  - Scrollbars personalizados para contenido y navegación

### Fixed
- Corrección en ordenamiento de fechas de incapacidades (strings ISO a Date objects)
- Manejo de errores en carga de datos desde Excel
- Validación de fechas inválidas en carga de incapacidades

### Deprecated
- Funcionalidad de "Guardar Nota" en modal de detalles (eliminada)
- Botón "Cerrar" en sección de seguimiento (eliminado)

### Pending
- Implementación real de guardado en Excel (`guardarSeguimientoPCL()`)
- Conexión con backend para persistencia de datos de seguimiento
- Generación de informes PDF desde datos de seguimiento PRIC

---

## [0.1.47] - 2026-02-24

### Changed
- **Actualización de Documentación del Proyecto**
  - Escaneo completo del código fuente vs documentación existente
  - Identificación de 18 módulos reorganizados (100% completados)
  - Documentación de scripts Python de Portear/src
  - Actualización de estado de módulos en PROJECT_OVERVIEW.md

### Documentation
- Actualización de CHANGELOG.md con versiones 0.1.41-0.1.46
- Creación de docs/scripts-python.md para documentar utilidades Python
- Actualización de estado de reorganización modular
- Generación de documentación JSDoc API actualizada
- Agregados JSDoc a archivos de utilidades (/utils)
- Documentado theme-manager.js en docs principales
- Corregido jsdoc.json con rutas actualizadas de módulos

## [0.1.45] - 2026-02-22

### Fixed
- Correcciones menores en generación de informes de investigación
- Mejoras en extracción de datos desde PDFs de accidentes

## [0.1.44] - 2026-02-22

### Added
- Soporte para tema oscuro (paleta Negro/Gris) en Theme Manager
- Sistema centralizado de gestión de temas (Claro/Oscuro/Sistema)

### Changed
- Mejora en comunicación iframe-renderer para módulos reorganizados

## [0.1.43] - 2026-02-21

### Fixed
- Corrección en mapeo de rutas para empresas configuradas
- Mejoras en sistema de logging centralizado

## [0.1.42] - 2026-02-21

### Added
- Módulo de inducciones reorganizado (1.2.2)
- Módulo de capacitaciones reorganizado (1.2.1)

### Changed
- Migración de archivos a estructura modular `modules/recursos/`
- Actualización de referencias en index.html y renderer.js

## [0.1.41] - 2026-02-21

### Added
- Módulo de rendición de cuentas reorganizado (2.6.1)
- Módulo de objetivos SST reorganizado (2.2.1)
- Módulo de evaluación inicial SG-SST reorganizado (2.3.1)

### Changed
- Continuación de reorganización modular de gestión-integral
- Actualización de jsdoc.json con nuevas rutas de módulos

## [0.1.40] - 2026-02-20

### Added
- **Sistema de Inteligencia Artificial para Investigación de Accidentes**
  - Servidor LLM persistente (`llm_server.py`) con modelo Mistral 3 3B Reasoning
  - Análisis automático de causa raíz mediante metodología 5 Porqués
  - Extracción de datos desde PDFs de reportes de accidentes
  - Generación automática de informes de investigación en formato DOCX
  - Integración con plantillas personalizadas por empresa

- **Nueva Interfaz del Módulo 3.2.2 Investigación de Accidentes**
  - Portal de bienvenida con diseño K+AIR
  - Tarjetas de acción principales y secundarias
  - Estadísticas de investigaciones pendientes y completadas
  - Navegación mejorada entre vistas

- **Sistema Visual Oficial K+AIR**
  - Paleta de colores estandarizada (Primario: #174ea6, Éxito: #28a745, etc.)
  - Tipografía oficial (Lexend para títulos, Roboto para cuerpo)
  - Componentes reutilizables con bordes 0.375rem
  - Animaciones fadeIn consistentes

### Fixed
- Corrección de indexación de datos del análisis 5 Porqués en informes
  - Agregadas múltiples variantes de búsqueda para claves (PorQue1, Por Qué 1, etc.)
  - Corregido desanidamiento desde `analysis.data`
- Corregido desfase de altura en portal de investigación de accidentes
- Eliminados headers redundantes en vistas de módulos

### Changed
- Refactorización de `investigacion-accidentes-logic.js` para usar iframe con portal
- Mejora en comunicación iframe-renderer con patrón `-request` / `-response`
- Estandarización de comunicación entre módulos y renderer principal

## [0.1.39] - 2026-01-21

### Added
- Estandarización de patrones de comunicación entre Iframes y Renderer (`-request` / `-response`).
- Nueva petición `duplicate-budget-file-request` en el sistema de renderizado.

### Fixed
- Corrección del módulo **Plan de Trabajo Anual** (2.4.1):
  - Solucionado error que bloqueaba la clonación de planes de trabajo.
  - Eliminado uso de `prompt()` (incompatible con Electron/Iframe) por `confirm()`.
  - Automatización del cálculo del año siguiente para nuevos periodos.
  - Sincronización de tipos de mensajes entre `plan-viewer.js` y `renderer.js`.

## [0.1.38] - 2025-01-08

### Added
- Nuevo módulo de verificación de tamaños
- Script para verificación de tamaños de archivos
- Funcionalidad de limpieza de datos

### Changed
- Mejoras en el manejo de datos
- Actualización de dependencias
- Corrección de errores menores

## [0.1.37] - 2024-12-20

### Added
- Nuevo módulo de trabajo en alto riesgo
- Componentes para trabajo en alto riesgo
- Funcionalidades de gestión de riesgos

### Changed
- Actualización de la interfaz de usuario
- Mejoras en la navegación
- Corrección de errores menores

## [0.1.36] - 2024-12-18

### Added
- Nuevo módulo de seguimiento de incapacidades
- Dashboard de ausentismo
- Funcionalidades de reporte

### Changed
- Mejoras en el módulo de ausentismo
- Actualización de gráficos
- Corrección de errores menores

## [0.1.35] - 2024-12-15

### Added
- Nuevo módulo de investigación de accidentes
- Componentes para investigación de accidentes
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de reportes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.34] - 2024-12-10

### Added
- Nuevo módulo de evaluaciones médicas
- Componentes para evaluaciones médicas
- Funcionalidades de seguimiento

### Changed
- Mejoras en el módulo de restricciones médicas
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.33] - 2024-12-05

### Added
- Nuevo módulo de capacitación COPASST
- Componentes para capacitación COPASST
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de comité de convivencia
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.32] - 2024-11-30

### Added
- Nuevo módulo de comité de convivencia
- Componentes para comité de convivencia
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de afiliación
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.31] - 2024-11-25

### Added
- Nuevo módulo de afiliación
- Componentes para afiliación
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de política
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.30] - 2024-11-20

### Added
- Nuevo módulo de política
- Componentes para política
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de roles y responsabilidades
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.29] - 2024-11-15

### Added
- Nuevo módulo de roles y responsabilidades
- Componentes para roles y responsabilidades
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de presupuesto
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.28] - 2024-11-10

### Added
- Nuevo módulo de presupuesto
- Componentes para presupuesto
- Funcionalidades de cálculo

### Changed
- Mejoras en el módulo de reportes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.27] - 2024-11-05

### Added
- Nuevo módulo de reportes
- Componentes para reportes
- Funcionalidades de exportación

### Changed
- Mejoras en el módulo de gestión de riesgos
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.26] - 2024-10-30

### Added
- Nuevo módulo de gestión de riesgos
- Componentes para gestión de riesgos
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de gestión integral
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.25] - 2024-10-25

### Added
- Nuevo módulo de gestión integral
- Componentes para gestión integral
- Funcionalidades de coordinación

### Changed
- Mejoras en el módulo de gestión de salud
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.24] - 2024-10-20

### Added
- Nuevo módulo de gestión de salud
- Componentes para gestión de salud
- Funcionalidades de monitoreo

### Changed
- Mejoras en el módulo de gestión de amenazas
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.23] - 2024-10-15

### Added
- Nuevo módulo de gestión de amenazas
- Componentes para gestión de amenazas
- Funcionalidades de evaluación

### Changed
- Mejoras en el módulo de mejoramiento
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.22] - 2024-10-10

### Added
- Nuevo módulo de mejoramiento
- Componentes para mejoramiento
- Funcionalidades de seguimiento

### Changed
- Mejoras en el módulo de verificación
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.21] - 2024-10-05

### Added
- Nuevo módulo de verificación
- Componentes para verificación
- Funcionalidades de control

### Changed
- Mejoras en el módulo de recursos
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.20] - 2024-09-30

### Added
- Nuevo módulo de recursos
- Componentes para recursos
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de evaluaciones
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.19] - 2024-09-25

### Added
- Nuevo módulo de evaluaciones
- Componentes para evaluaciones
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de curso virtual
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.18] - 2024-09-20

### Added
- Nuevo módulo de curso virtual
- Componentes para curso virtual
- Funcionalidades de capacitación

### Changed
- Mejoras en el módulo de curso 50 horas
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.17] - 2024-09-15

### Added
- Nuevo módulo de curso 50 horas
- Componentes para curso 50 horas
- Funcionalidades de certificación

### Changed
- Mejoras en el módulo de responsable SG
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.16] - 2024-09-10

### Added
- Nuevo módulo de responsable SG
- Componentes para responsable SG
- Funcionalidades de coordinación

### Changed
- Mejoras en el módulo de restricciones
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.15] - 2024-09-05

### Added
- Nuevo módulo de restricciones
- Componentes para restricciones
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de sociodemográfica
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.14] - 2024-08-30

### Added
- Nuevo módulo de sociodemográfica
- Componentes para sociodemográfica
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de ausentismo
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.13] - 2024-08-25

### Added
- Nuevo módulo de ausentismo
- Componentes para ausentismo
- Funcionalidades de medición

### Changed
- Mejoras en el módulo de medición de ausentismo
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.12] - 2024-08-20

### Added
- Nuevo módulo de medición de ausentismo
- Componentes para medición de ausentismo
- Funcionalidades de cálculo

### Changed
- Mejoras en el módulo de investigación de accidentes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.11] - 2024-08-15

### Added
- Nuevo módulo de investigación de accidentes
- Componentes para investigación de accidentes
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de reportes de accidentes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.10] - 2024-08-10

### Added
- Nuevo módulo de reportes de accidentes
- Componentes para reportes de accidentes
- Funcionalidades de generación

### Changed
- Mejoras en el módulo de copasst
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.9] - 2024-08-05

### Added
- Nuevo módulo de copasst
- Componentes para copasst
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de comité de convivencia
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.8] - 2024-08-01

### Added
- Nuevo módulo de comité de convivencia
- Componentes para comité de convivencia
- Funcionalidades de coordinación

### Changed
- Mejoras en el módulo de política
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.7] - 2024-07-25

### Added
- Nuevo módulo de política
- Componentes para política
- Funcionalidades de definición

### Changed
- Mejoras en el módulo de roles y responsabilidades
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.6] - 2024-07-20

### Added
- Nuevo módulo de roles y responsabilidades
- Componentes para roles y responsabilidades
- Funcionalidades de asignación

### Changed
- Mejoras en el módulo de afiliación
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.5] - 2024-07-15

### Added
- Nuevo módulo de afiliación
- Componentes para afiliación
- Funcionalidades de registro

### Changed
- Mejoras en el módulo de presupuesto
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.4] - 2024-07-10

### Added
- Nuevo módulo de presupuesto
- Componentes para presupuesto
- Funcionalidades de cálculo

### Changed
- Mejoras en el módulo de reportes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.3] - 2024-07-05

### Added
- Nuevo módulo de reportes
- Componentes para reportes
- Funcionalidades de exportación

### Changed
- Mejoras en el módulo de gestión
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.2] - 2024-07-01

### Added
- Nuevo módulo de gestión
- Componentes para gestión
- Funcionalidades de administración

### Changed
- Mejoras en la estructura general
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.1] - 2024-06-25

### Added
- Estructura inicial del proyecto
- Configuración de Electron
- Módulos básicos de la aplicación

### Changed
- Configuración inicial
- Estructura de directorios
- Archivos base

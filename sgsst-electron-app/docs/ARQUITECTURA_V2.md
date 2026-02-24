# 🏗️ Arquitectura del Sistema K+AIR SG-SST

**Versión:** 2.0  
**Fecha:** 24 de febrero de 2026  
**Estado:** Post-Reorganización Completa

---

## 📋 Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Arquitectura Electron](#2-arquitectura-electron)
3. [Estructura de Directorios](#3-estructura-de-directorios)
4. [Módulos y Submódulos](#4-módulos-y-submódulos)
5. [Sistema de Comunicación IPC](#5-sistema-de-comunicación-ipc)
6. [Motor Normativo](#6-motor-normativo)
7. [Sistema de Renderizado](#7-sistema-de-renderizado)
8. [Integración con Python](#8-integración-con-python)
9. [Sistema Visual Oficial](#9-sistema-visual-oficial)
10. [Decisiones Arquitectónicas](#10-decisiones-arquitectónicas)

---

## 1. Visión General

### 1.1 Propósito del Sistema

**K+AIR** es una aplicación empresarial Electron que implementa un Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) conforme a la normativa colombiana (Resolución 0312 de 2019).

### 1.2 Principios de Diseño

| Principio | Descripción |
|-----------|-------------|
| **Multi-empresa** | Una sola aplicación, múltiples empresas con experiencias personalizadas |
| **Modularidad** | 7 módulos principales, 27 submódulos completamente aislados |
| **Normativo** | Escenarios dinámicos basados en tamaño y nivel de riesgo |
| **Seguridad** | Comunicación IPC controlada vía preload.js |
| **Mantenibilidad** | Raíz limpia (13 archivos), módulos organizados |
| **Compatibilidad** | Backward compatibility garantizada |

### 1.3 Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Framework** | Electron | 37.3.0 |
| **Runtime** | Node.js | 18.x+ |
| **Frontend** | Vanilla JS + CSS | - |
| **Backend Python** | Flask + Pandas + OpenPyXL | 3.10-3.12 |
| **IA/ML** | Mistral 3 3B Reasoning | - |
| **Build** | electron-builder | 26.0.12 |

---

## 2. Arquitectura Electron

### 2.1 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         K+AIR Electron App                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    RENDERER PROCESS                       │   │
│  │  (Interfaz de Usuario - Contexto de Navegador)            │   │
│  │                                                            │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐          │   │
│  │  │ index.html │  │ renderer.js│  │  styles.css│          │   │
│  │  │   (143L)   │  │   (3170L)  │  │  (~2500L)  │          │   │
│  │  └────────────┘  └────────────┘  └────────────┘          │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────────────────┐   │   │
│  │  │              modules/ (27 submódulos)               │   │   │
│  │  │  - gestion-integral/ (5 submódulos + home)         │   │   │
│  │  │  - recursos/ (11 submódulos + home)                │   │   │
│  │  │  - gestion-salud/ (6 submódulos + home)            │   │   │
│  │  │  - gestion-peligros/ (home)                        │   │   │
│  │  │  - gestion-amenazas/ (home)                        │   │   │
│  │  │  - verificacion/ (home)                            │   │   │
│  │  │  - mejoramiento/ (home)                            │   │   │
│  │  └────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↕ IPC (contextBridge)              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     PRELOAD SCRIPT                        │   │
│  │  (Puente Seguro - contextBridge)                          │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────────────────┐   │   │
│  │  │  preload.js (~180L) - 60+ contratos IPC expuestos   │   │   │
│  │  │  - window.electronAPI.getRecursosStats()           │   │   │
│  │  │  - window.electronAPI.procesarAusentismo()         │   │   │
│  │  │  - window.electronAPI.selectDirectory()            │   │   │
│  │  │  - [Ver lista completa en preload.js]              │   │   │
│  │  └────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↕ IPC (ipcMain.handle)             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      MAIN PROCESS                         │   │
│  │  (Lógica de Negocio - Contexto Node.js)                  │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────────────────┐   │   │
│  │  │  main.js (4766L) - 55+ handlers IPC                 │   │   │
│  │  │  - ipcMain.handle('get-recursos-stats')            │   │   │
│  │  │  - ipcMain.handle('procesar-ausentismo')           │   │   │
│  │  │  - ipcMain.handle('map-directory') → Python        │   │   │
│  │  │  - [Ver lista completa en main.js]                 │   │   │
│  │  └────────────────────────────────────────────────────┘   │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────────────────┐   │   │
│  │  │  investigation_handlers.js (handlers especializados)│   │   │
│  │  │  - investigacion-accidentes-select-accident-pdf    │   │   │
│  │  │  - investigacion-accidentes-analyze-accident       │   │   │
│  │  │  - investigacion-accidentes-generate-accident-report│  │   │
│  │  └────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↕ child_process                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   PYTHON MODULE (Portear/)                │   │
│  │  (Procesamiento Especializado - Scripts Python)           │   │
│  │                                                            │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐          │   │
│  │  │ llm_server │  │ accident_  │  │ map_       │          │   │
│  │  │ Flask:5555 │  │ processor  │  │ directory  │          │   │
│  │  └────────────┘  └────────────┘  └────────────┘          │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐          │   │
│  │  │ report_    │  │ copasst_   │  │ comite_    │          │   │
│  │  │ generator  │  │ acta       │  │ convivencia│          │   │
│  │  └────────────┘  └────────────┘  └────────────┘          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Flujo de Datos

```
Usuario → UI (renderer.js) → preload.js (contextBridge)
                                 ↓
                            IPC Channel
                                 ↓
                          main.js (ipcMain)
                                 ↓
                    ┌────────────┴────────────┐
                    ↓                         ↓
            FileSystem                Python Scripts
            (Excel, PDF)              (LLM, Procesamiento)
                    ↓                         ↓
                    └────────────┬────────────┘
                                 ↓
                            Respuesta IPC
                                 ↓
                          renderer.js
                                 ↓
                           UI Update
```

### 2.3 Ciclo de Vida de la Aplicación

```
1. main.js inicia
   ↓
2. Crea BrowserWindow
   ↓
3. Carga index.html
   ↓
4. Carga preload.js (contextBridge)
   ↓
5. Carga renderer.js
   ↓
6. Inicializa módulos
   ↓
7. Espera interacción de usuario
   ↓
8. Procesa eventos IPC
   ↓
9. Ejecuta operaciones (filesystem, Python)
   ↓
10. Retorna resultados vía IPC
   ↓
11. Actualiza UI
```

---

## 3. Estructura de Directorios

### 3.1 Raíz del Proyecto (13 archivos)

```
sgsst-electron-app/
├── index.html                    # Punto de entrada (143 líneas)
├── main.js                       # Proceso principal (4766 líneas)
├── preload.js                    # Puente IPC (~180 líneas)
├── renderer.js                   # Renderizado UI (3170 líneas)
├── styles.css                    # Estilos globales (~2500 líneas)
├── development-styles.css        # Estilos desarrollo (~500 líneas)
├── package.json                  # Configuración npm
├── package-lock.json             # Bloqueo de dependencias
├── README.md                     # Este archivo
├── docker-compose.yml            # Configuración Docker
├── icon-config.json              # Configuración de iconos
├── .gitignore                    # Ignorados de Git
└── [directorios]
```

### 3.2 Módulos (8 módulos principales)

```
modules/
├── gestion-integral/             # Módulo 2
│   ├── index.js                  # Exporta submódulos
│   ├── gestion-integral-home.js  # Home del módulo
│   ├── evaluacion-inicial-sg-sst/
│   │   ├── index.js
│   │   ├── evaluacion-inicial-sg-sst-logic.js
│   │   ├── evaluacion-inicial-sg-sst.js
│   │   ├── evaluacion-inicial-sg-sst.css
│   │   └── evaluacion-inicial-sg-sst-test.html
│   ├── objetivos-sst/
│   │   ├── index.js
│   │   ├── objetivos-sst-logic.js
│   │   ├── objetivos-sst-viewer.js
│   │   └── objetivos-sst-view.css
│   ├── plan-trabajo/
│   │   ├── index.js
│   │   ├── plan-trabajo-logic.js
│   │   ├── plan-home.js
│   │   └── plan-viewer.js
│   ├── politica/
│   │   ├── index.js
│   │   ├── politica-logic.js
│   │   ├── politica-viewer.js
│   │   └── onlyoffice-bridge.js  # Integración OnlyOffice
│   └── rendicion-cuentas/
│       ├── index.js
│       ├── rendicion-logic.js
│       └── rendicion-viewer.js
│
├── recursos/                     # Módulo 1
│   ├── index.js
│   ├── recursos-home.js
│   ├── afiliacion/
│   ├── capacitacion-copasst/
│   ├── capacitaciones/
│   ├── comite-convivencia/
│   ├── copasst/
│   ├── curso-virtual/
│   ├── inducciones/
│   ├── presupuesto/
│   ├── responsable-sg/
│   ├── roles-responsabilidades/
│   └── trabajo-alto-riesgo/
│
├── gestion-salud/                # Módulo 3
│   ├── index.js
│   ├── gestion-salud-home.js
│   ├── ausentismo/               # 3.3.6 Medición del ausentismo
│   │   ├── index.js
│   │   ├── medicion-ausentismo.js         # Componente principal
│   │   ├── medicion-ausentismo-home.js    # Portal de bienvenida
│   │   ├── medicion-ausentismo-home.html  # HTML del portal
│   │   ├── registrar-ausentismo.js        # Formulario de registro
│   │   ├── ver-ausentismo-logic.js        # Lógica de consulta
│   │   └── ver-ausentismo-dashboard.html  # Dashboard
│   ├── evaluaciones-medicas/
│   ├── investigacion-accidentes/ # 3.2.2 Con IA
│   ├── reportes-accidentes/
│   ├── restricciones-medicas/
│   └── sociodemografica/
│
├── gestion-peligros/             # Módulo 4
│   └── gestion-peligros-home.js
│
├── gestion-amenazas/             # Módulo 5
│   └── gestion-amenazas-home.js
│
├── verificacion/                 # Módulo 6
│   └── verificacion-home.js
│
├── mejoramiento/                 # Módulo 7
│   └── mejoramiento-home.js
│
└── helpers/                      # Utilidades
    └── viewLoader.js
```

### 3.3 Otros Directorios Clave

```
├── assets/                       # Recursos gráficos
│   ├── KIAR256.ico              # Icono principal
│   ├── KIAR256.png              # Icono PNG
│   └── [imágenes de empresas]
│
├── backup_archivos_originales/   # Respaldo histórico (67 archivos)
│   ├── init-modular-system.js   # Legacy (no usar)
│   ├── compat-responsable-sg.js # Legacy (no usar)
│   └── [archivos originales migrados]
│
├── components/                   # Componentes reutilizables
│   ├── config/
│   │   └── config-viewer.html
│   └── seguimiento/
│       ├── exportar-informe-seguimiento.html
│       └── seguimiento-incapacidades.html
│
├── docs/                         # Documentación (137 archivos)
│   ├── api/                     # JSDoc generado
│   ├── api-test/                # Tests de documentación
│   ├── LIMPIEZA_REORGANIZACION_FEB_2026.md
│   ├── ESTADO_ACTUAL_REORGANIZACION.md
│   ├── PROJECT_OVERVIEW.md
│   ├── arquitectura.md
│   ├── archivos-clave.md
│   ├── motor-normativo.md
│   ├── escenarios-normativos.md
│   ├── flujo-creacion-empresa.md
│   ├── renderer.md
│   ├── modulo-investigacion-accidentes.md
│   ├── DEPENDENCIAS.md
│   ├── CHANGELOG.md
│   └── [más documentación funcional]
│
├── examples/                     # Ejemplos y demos
│   ├── scripts/
│   ├── views/
│   └── curso-50-horas.js
│
├── logs/                         # Registros de la aplicación
│   └── dev_log.txt
│
├── Portear/                      # Módulo Python
│   ├── src/
│   │   ├── llm_server.py                    # Servidor Flask (puerto 5555)
│   │   ├── accident_processor.py            # Procesamiento de PDF
│   │   ├── accident_report_generator.py     # Generador de informes
│   │   ├── map_directory.py                 # Mapeo de directorios
│   │   ├── copasst_acta_generator.py        # Generador de actas
│   │   ├── comite_convivencia_acta_generator.py
│   │   ├── convert_docx_to_pdf.py
│   │   ├── convert_xlsx_to_pdf.py
│   │   ├── actualizar_ausentismo.py
│   │   └── [15+ scripts especializados]
│   ├── .venv/                    # Entorno virtual Python
│   └── requirements.txt          # Dependencias Python
│
├── scripts/                      # Scripts de utilidad
│   ├── theme-manager.js         # Gestor de temas
│   └── generate-docs.js         # Generador de documentación
│
├── test/                         # Archivos de prueba
│   ├── test-jsdoc.js
│   ├── test-module-cards.js
│   └── test_remision_utils.py
│
└── utils/                        # Utilidades varias
    ├── debug/
    │   ├── debug-app.js
    │   ├── debug-main.js
    │   └── debug-full.js
    ├── ausentismoUtils.js
    ├── remisionUtils.js
    ├── evaluacionPdfParser.js
    └── [archivos de soporte]
```

---

## 4. Módulos y Submódulos

### 4.1 Sistema de Módulos

Cada módulo sigue esta estructura:

```
[nombre-modulo]/
├── index.js                      # Punto de entrada (exports)
├── [nombre-modulo]-home.js       # Vista home del módulo
└── [submodulo]/
    ├── index.js                  # Exporta componentes del submódulo
    ├── [nombre]-logic.js         # Lógica de negocio
    ├── [nombre]-component.js     # Componente (si aplica)
    ├── [nombre]-viewer.js        # Vista del componente
    ├── [nombre]-view.html        # HTML de la vista
    └── [nombre]-view.css         # Estilos de la vista
```

### 4.2 Matriz de Módulos y Submódulos

| Módulo | Código | Submódulos | Archivos Home |
|--------|--------|-----------|---------------|
| **1. Recursos** | 1 | 11 | `recursos-home.js` |
| 1.1.1 | Responsable del SG | `responsable-sg-logic.js`, `viewer.js`, `view.html` |
| 1.1.2 | Roles y Responsabilidades | `roles-responsabilidades-logic.js`, `viewer.js` |
| 1.1.3 | Asignación de Recursos | `presupuesto-logic.js` |
| 1.1.4 | Afiliación al SSSI | `afiliacion-logic.js` |
| 1.1.5 | Trabajo de Alto Riesgo | `trabajo-alto-riesgo-logic.js` |
| 1.1.6 | Conformación de Copasst | `copasst-logic.js` |
| 1.1.7 | Capacitación al Copasst | `capacitacion-copasst-logic.js` |
| 1.1.8 | Comité de Convivencia | `comite-convivencia-logic.js` |
| 1.2.1 | Programa de Capacitación | `capacitaciones-logic.js` |
| 1.2.2 | Inducción y Reinducción | `inducciones-logic.js` |
| 1.2.3 | Curso Virtual 50 Horas | `curso-virtual-logic.js` |
| **2. Gestión Integral** | 2 | 6 | `gestion-integral-home.js` |
| 2.1.1 | Política del SG-SST | `politica-logic.js`, `onlyoffice-bridge.js` |
| 2.2.1 | Objetivos SST | `objetivos-sst-logic.js` |
| 2.3.1 | Evaluación Inicial SG-SST | `evaluacion-inicial-sg-sst-logic.js` |
| 2.4.1 | Plan de Trabajo Anual | `plan-trabajo-logic.js` |
| 2.6.1 | Rendición de Cuentas | `rendicion-logic.js` |
| **3. Gestión de la Salud** | 3 | 6 | `gestion-salud-home.js` |
| 3.1.1 | Diagnóstico Sociodemográfico | `sociodemografica-component.js` |
| 3.1.4 | Evaluaciones Médicas | `evaluaciones-medicas-logic.js`, `component.js` |
| 3.1.6 | Restricciones Médicas | `restricciones-medicas-logic.js`, `component.js` |
| 3.2.1 | Reporte de Accidentes | `reportes-accidentes-logic.js` |
| 3.2.2 | Investigación de Accidentes 🤖 | `investigacion-accidentes-logic.js`, `handlers.js` |
| 3.3.6 | Medición del Ausentismo | `medicion-ausentismo.js`, `registrar-ausentismo.js` |
| **4. Gestión de Peligros** | 4 | 1 | `gestion-peligros-home.js` |
| **5. Gestión de Amenazas** | 5 | 1 | `gestion-amenazas-home.js` |
| **6. Verificación** | 6 | 1 | `verificacion-home.js` |
| **7. Mejoramiento** | 7 | 1 | `mejoramiento-home.js` |

**Total:** 7 módulos, 27 submódulos

### 4.3 Componentes Globales (window.*)

Todos los componentes se exponen globalmente para acceso desde el renderer:

```javascript
// Módulo Recursos
window.ResponsableSgComponent
window.RolesResponsabilidadesComponent
window.AfiliacionComponent
window.CopasstComponent
window.CapacitacionCopasstComponent
window.ComiteConvivenciaComponent
window.CursoVirtualComponent
window.CapacitacionesComponent
window.InduccionesComponent
window.PresupuestoGestionComponent
window.TrabajoAltoRiesgoComponent

// Módulo Gestión Integral
window.PoliticaComponent
window.ObjetivosSSTComponent
window.PlanTrabajoComponent
window.RendicionCuentasComponent

// Módulo Gestión de la Salud
window.SociodemograficaComponent
window.EvaluacionesMedicasComponent
window.RestriccionesMedicasComponent
window.ReportesAccidentesComponent
window.InvestigacionAccidentesComponent
window.MedicionAusentismoComponent
window.RegistrarAusentismoComponent
window.VerAusentismoComponent

// Homes de Módulos
window.RecursosHome
window.GestionIntegralHome
window.GestionSaludHome
window.GestionPeligrosHome
window.GestionAmenazasHome
window.VerificacionHome
window.MejoramientoHome
```

---

## 5. Sistema de Comunicación IPC

### 5.1 Arquitectura IPC

```
┌─────────────────┐                    ┌─────────────────┐
│   Renderer      │                    │   Main Process  │
│   (Browser)     │                    │   (Node.js)     │
│                 │                    │                 │
│ window.         │  ┌──────────────┐  │ ipcMain.        │
│ electronAPI     │──│  preload.js  │──│ handle()        │
│                 │  │ contextBridge│  │                 │
│                 │  └──────────────┘  │                 │
└─────────────────┘                    └─────────────────┘
```

### 5.2 Contratos IPC Principales (60+)

#### App & Configuración (5)
| Método | Handler | Descripción |
|--------|---------|-------------|
| `getAppVersion()` | `get-app-version` | Obtener versión |
| `getRecursosStats(companyName)` | `get-recursos-stats` | Estadísticas recursos |
| `saveConfig(config)` | `save-config` | Guardar config |
| `loadConfig()` | `load-config` | Cargar config |
| `loadNormativa()` | `load-normativa` | Cargar normativa |

#### Sistema de Temas (5)
| Método | Handler | Descripción |
|--------|---------|-------------|
| `getSystemTheme()` | `get-system-theme` | Tema del SO |
| `saveThemePreference(theme)` | `save-theme-preference` | Guardar preferencia |
| `getThemePreference()` | `get-theme-preference` | Preferencia guardada |
| `getEffectiveTheme()` | `get-effective-theme` | Tema efectivo |
| `onSystemThemeChanged(cb)` | `system-theme-changed` | Listener cambios |

#### Archivos y Directorios (6)
| Método | Handler | Descripción |
|--------|---------|-------------|
| `selectDirectory()` | `select-directory` | Seleccionar dir |
| `mapDirectory(path)` | `map-directory` | Mapear con Python |
| `readDirectory(path)` | `read-directory` | Leer contenido |
| `openPath(filePath)` | `open-path` | Abrir archivo |
| `readExcelFile(path)` | `read-excel-file` | Leer Excel |
| `processExcelData(payload)` | `process-excel-data` | Procesar Excel |

#### Ausentismo (4)
| Método | Handler | Descripción |
|--------|---------|-------------|
| `getAusentismoData(company)` | `get-ausentismo-data` | Datos ausentismo |
| `buscarEmpleadoPorCedula(cedula, empresa)` | `buscar-empleado-por-cedula` | Buscar empleado |
| `buscarCie10Descripcion(code)` | `buscar-cie10-descripcion` | Buscar CIE-10 |
| `procesarAusentismo(formData)` | `procesar-ausentismo` | Procesar formulario |

#### Investigación de Accidentes 🤖 (6)
| Método | Handler | Descripción |
|--------|---------|-------------|
| `selectAccidentPdf()` | `investigacion-accidentes-select-accident-pdf` | Seleccionar PDF |
| `processAccidentPdf(path)` | `investigacion-accidentes-process-accident-pdf` | Procesar PDF |
| `analyzeAccident(data)` | `investigacion-accidentes-analyze-accident` | Analizar con LLM |
| `generateAccidentReport(data)` | `investigacion-accidentes-generate-accident-report` | Generar informe |
| `startModelLoading()` | `investigacion-accidentes-start-model-loading` | Cargar modelo |
| `saveTempPdfFile(filename, data)` | `investigacion-accidentes-save-temp-pdf-file` | Guardar temporal |

#### Presupuesto (5)
| Método | Handler | Descripción |
|--------|---------|-------------|
| `getPresupuestoFiles(company)` | `getPresupuestoFiles` | Obtener archivos |
| `readPresupuestoData(path)` | `readPresupuestoData` | Leer datos |
| `saveBudgetFile(path, data)` | `saveBudgetFile` | Guardar archivo |
| `openBudgetWindow(file)` | `open-budget-window` | Abrir ventana |
| `duplicateBudgetFile(params)` | `duplicate-budget-file` | Duplicar archivo |

#### Capacitaciones (6)
| Método | Handler | Descripción |
|--------|---------|-------------|
| `getCapacitacionesSheets(path)` | `get-capacitaciones-sheets` | Obtener hojas |
| `initExcel(data)` | `init-excel` | Inicializar Excel |
| `updateCapacitacionesExcel(data)` | `update-capacitaciones-excel` | Actualizar |
| `duplicateCapacitacionesSheet(args)` | `duplicate-capacitaciones-sheet` | Duplicar hoja |
| `updateExcelCell(data)` | `update-excel-cell` | Actualizar celda |
| `convertExcelToPdf(path)` | `convertExcelToPdf` | Convertir a PDF |

#### OnlyOffice (2)
| Método | Handler | Descripción |
|--------|---------|-------------|
| `openOnlyOfficeEditor(payload)` | `open-onlyoffice-editor` | Abrir editor |
| `generateOnlyOfficeConfig(payload)` | `generate-onlyoffice-config` | Generar config |

#### Documentos (7)
| Método | Handler | Descripción |
|--------|---------|-------------|
| `getDocumentFolders(payload)` | `get-document-folders` | Obtener carpetas |
| `getPDFPreview(path)` | `get-pdf-preview` | Vista PDF |
| `getWordPreview(path)` | `get-word-preview` | Vista Word |
| `getExcelPreview(path)` | `get-excel-preview` | Vista Excel |
| `downloadDocument(path)` | `download-document` | Descargar |
| `getEditableContent(payload)` | `get-editable-content` | Contenido editable |
| `saveEditedDocument(payload)` | `save-edited-document` | Guardar editado |

#### Actas (4)
| Método | Handler | Descripción |
|--------|---------|-------------|
| `getActaData()` | `get-acta-data` | Datos acta Copasst |
| `getConvivenciaActaData()` | `getConvivenciaActaData` | Datos acta convivencia |
| `generateCopasstActa(changes)` | `generate-copasst-acta` | Generar acta |
| `generateConvivenciaActa(changes)` | `generate-convivencia-acta` | Generar acta |

#### Remisiones (6)
| Método | Handler | Descripción |
|--------|---------|-------------|
| `getControlRemisionesData(company)` | `get-control-remisiones-data` | Datos remisiones |
| `processRemisionPdf(path)` | `process-remision-pdf` | Procesar PDF |
| `convertDocxToPdf(path)` | `convert-docx-to-pdf` | Convertir DOCX |
| `selectPdfFile()` | `select-pdf-file` | Seleccionar PDF |
| `generateRemisionDocument(data, empresa)` | `generate-remision-document` | Generar remisión |
| `sendRemisionByEmail(path, data, empresa)` | `send-remision-by-email` | Enviar email |
| `sendRemisionByWhatsapp(path, data, empresa)` | `send-remision-by-whatsapp` | Enviar WhatsApp |

#### Seguimiento de Incapacidades (5)
| Método | Handler | Descripción |
|--------|---------|-------------|
| `saveFollowUp(data, company)` | `save-follow-up` | Guardar seguimiento |
| `exportIncapacityData(company)` | `export-incapacity-data` | Exportar datos |
| `getFollowUpHistory(caseId, company)` | `get-follow-up-history` | Historial |
| `loadFollowUpData(company)` | `load-follow-up-data` | Cargar datos |
| `saveDebugHtml(html)` | `save-debug-html` | Guardar debug |

#### Objetivos SST (3)
| Método | Handler | Descripción |
|--------|---------|-------------|
| `getObjetivosExcelPath(company)` | `get-objetivos-excel-path` | Ruta Excel |
| `loadObjetivosExcelData(path)` | `load-objetivos-excel-data` | Cargar datos |
| `saveObjetivosExcelData(path, data)` | `save-objetivos-excel-data` | Guardar datos |

#### Inducciones (1)
| Método | Handler | Descripción |
|--------|---------|-------------|
| `getInduccionesData(company)` | `get-inducciones-data` | Datos inducciones |

#### Evaluación Inicial (1)
| Método | Handler | Descripción |
|--------|---------|-------------|
| `processEvaluacionPdf(path, type)` | `process-evaluacion-pdf` | Procesar PDF |

#### Eventos del Sistema (5)
| Método | Descripción |
|--------|-------------|
| `send(channel, data)` | Enviar mensaje |
| `onIpcMessage(channel, listener)` | Escuchar mensaje |
| `removeIpcMessageListener(channel, listener)` | Remover listener |
| `onUpdateAvailable(callback)` | Actualización disponible |
| `onUpdateDownloaded(callback)` | Actualización descargada |
| `restartApp()` | Reiniciar aplicación |

**Lista completa en:** 📖 [preload.js](preload.js) y 📖 [main.js](main.js)

---

## 6. Motor Normativo

### 6.1 Descripción

El motor normativo determina qué módulos y submódulos están activos para cada empresa según:
- Número de trabajadores
- Nivel de riesgo (I, II, III, IV, V)
- Sector (agropecuario o no)

### 6.2 Escenarios Normativos (Resolución 0312 de 2019)

| Escenario | Trabajadores | Riesgo | Aplicación |
|-----------|-------------|--------|------------|
| **COMPLETO** | > 50 | Todos | Todos los módulos activos |
| **COMPLETO_CAP_III** | ≤ 50 | IV, V | Todos los módulos activos |
| **SIMPLIFICADO** | ≤ 50 | I, II, III | Módulos básicos activos |
| **AGROPECUARIO** | ≤ 50 | I, II, III | Módulos básicos + agropecuario |

### 6.3 Flujo de Determinación Normativa

```
1. Usuario crea empresa
   ↓
2. Ingresa datos:
   - Número de trabajadores
   - Nivel de riesgo
   - ¿Es agropecuaria?
   ↓
3. renderer.js determina escenario:
   determinarEscenarioNormativo(empresa)
   ↓
4. Filtra módulos activos:
   filtrarModulosPorNormativa(escenario)
   ↓
5. Renderiza solo módulos activos
   ↓
6. UI muestra solo lo permitido
```

### 6.4 Estructura de Normativa (JSON)

```json
{
  "escenarios": {
    "COMPLETO": {
      "condiciones": {
        "trabajadores_min": 51
      },
      "modulos": {
        "activar": [1, 2, 3, 4, 5, 6, 7],
        "desactivar": []
      },
      "submodulos": {
        "activar": ["*"],
        "desactivar": []
      }
    },
    "SIMPLIFICADO": {
      "condiciones": {
        "trabajadores_max": 50,
        "riesgo": ["I", "II", "III"]
      },
      "modulos": {
        "activar": [1, 2, 3],
        "desactivar": [4, 5, 6, 7]
      },
      "submodulos": {
        "activar": ["1.*", "2.*", "3.1.*", "3.2.*"],
        "desactivar": ["3.3.*"]
      }
    }
  }
}
```

**Documentación completa:** 📖 [docs/motor-normativo.md](docs/motor-normativo.md)  
📖 [docs/escenarios-normativos.md](docs/escenarios-normativos.md)

---

## 7. Sistema de Renderizado

### 7.1 Arquitectura de Renderizado

```
┌─────────────────────────────────────────────────────────┐
│                    renderer.js                           │
├─────────────────────────────────────────────────────────┤
│  CONSTANTES                                             │
│  - MODULES_WITH_CALENDAR                                │
│  - SIDEBAR_BUTTONS                                      │
│  - ALL_SUBMODULES                                       │
│  - COMPANY_BUTTONS                                      │
├─────────────────────────────────────────────────────────┤
│  ESTADO GLOBAL                                          │
│  - currentCompany                                       │
│  - currentModule                                        │
│  - currentSubmodule                                     │
│  - currentCalendarInstance                              │
│  - currentActiveComponent                               │
├─────────────────────────────────────────────────────────┤
│  FUNCIONES PRINCIPALES                                  │
│  - cargarNormativa()                                    │
│  - determinarEscenarioNormativo(empresa)                │
│  - filtrarModulosPorNormativa(escenario)                │
│  - showCalendarInModule(container)                      │
│  - hideCalendar()                                       │
│  - applyGlobalTheme()                                   │
│  - renderSidebar()                                      │
│  - renderModuleContent(module, submodule)               │
│  - showSubmoduleContent(module, submodule)              │
├─────────────────────────────────────────────────────────┤
│  EVENT HANDLERS                                         │
│  - DOMContentLoaded                                     │
│  - window.postMessage (iframe communication)            │
│  - IPC listeners                                        │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Flujo de Renderizado de Módulo

```
1. Usuario hace clic en módulo del sidebar
   ↓
2. renderer.js detecta clic
   ↓
3. Determina si es módulo o submódulo
   ↓
4. Si es módulo:
   - Carga [modulo]-home.js
   - Instancia: new ModuleHome(container)
   - Renderiza: home.render()
   - Muestra calendario (si aplica)
   ↓
5. Si es submódulo:
   - Busca ruta: findSubmodulePath()
   - Carga componente: new SubmoduleComponent()
   - Renderiza: component.render()
   - Oculta calendario
```

### 7.3 Sistema de Calentario

El calendario (Vanilla Calendar Pro) se muestra solo en módulos principales:

```javascript
const MODULES_WITH_CALENDAR = [
    "Gestión Integral",
    "Recursos",
    "Gestión de la Salud",
    "Gestión de Peligros y Riesgos",
    "Gestión de Amenazas",
    "Verificación",
    "Mejoramiento"
];

// NO se muestra en submódulos
if (currentSubmodule) {
    hideCalendar();
    return;
}
```

**Documentación completa:** 📖 [docs/renderer.md](docs/renderer.md)

---

## 8. Integración con Python

### 8.1 Arquitectura de Integración

```
┌─────────────────┐         child_process         ┌─────────────────┐
│   main.js       │ ────────────────────────────→ │   Python        │
│   (Node.js)     │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │   (Scripts)     │
│                 │   stdout (JSON)               │                 │
│ execFile()      │                               │ sys.stdout      │
└─────────────────┘                               └─────────────────┘
```

### 8.2 Scripts Python Principales

#### Procesamiento de Accidentes 🤖
| Script | Propósito | Puerto |
|--------|-----------|--------|
| `llm_server.py` | Servidor Flask para LLM | 5555 |
| `accident_processor.py` | Extracción de datos de PDF | - |
| `accident_report_generator.py` | Generación de informe DOCX | - |

#### Generación de Documentos
| Script | Propósito |
|--------|-----------|
| `copasst_acta_generator.py` | Generar actas Copasst |
| `comite_convivencia_acta_generator.py` | Generar actas de convivencia |
| `convert_docx_to_pdf.py` | Convertir DOCX → PDF |
| `convert_xlsx_to_pdf.py` | Convertir XLSX → PDF |

#### Utilidades
| Script | Propósito |
|--------|-----------|
| `map_directory.py` | Mapear estructura de directorios |
| `actualizar_ausentismo.py` | Actualizar datos de ausentismo |

### 8.3 Flujo de Llamada Python

```javascript
// main.js
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFilePromise = promisify(execFile);

ipcMain.handle('map-directory', async (event, directoryPath) => {
  const pythonPath = await getPython();
  const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'map_directory.py');
  
  const { stdout, stderr } = await execFilePromise(pythonPath, [
    pythonScriptPath,
    directoryPath
  ], { cwd: path.dirname(pythonScriptPath) });
  
  const structure = JSON.parse(stdout);
  return { success: true, structure: structure };
});
```

### 8.4 Detección Robusta de Python

```javascript
async function findPython() {
  // 1. Buscar en PATH
  try {
    const { stdout } = await execPromise('where python');
    // Probar ejecutables encontrados
  } catch (e) {
    // 2. Buscar en rutas comunes
    const commonPaths = [
      path.join(__dirname, 'Portear', '.venv', 'Scripts', 'python.exe'),
      `C:\\Users\\${username}\\AppData\\Local\\Programs\\Python\\Python312\\python.exe`,
      // ... más rutas
    ];
  }
}
```

**Documentación completa:** 📖 [docs/scripts-python.md](docs/scripts-python.md)

---

## 9. Sistema Visual Oficial K+AIR

### 9.1 Paleta de Colores

```css
:root {
  /* Colores Primarios */
  --k-primary: #174ea6;
  --k-primary-hover: #185abd;
  --k-primary-light: rgba(23, 78, 166, 0.1);
  
  /* Colores Semánticos */
  --k-success: #28a745;
  --k-success-light: rgba(40, 167, 69, 0.1);
  --k-warning: #ffc107;
  --k-warning-light: rgba(255, 193, 7, 0.1);
  --k-danger: #dc3545;
  --k-danger-light: rgba(220, 53, 69, 0.1);
  
  /* Fondos */
  --k-bg-app: #f8f9fa;
  --k-bg-card: #ffffff;
  --k-border: #dee2e6;
  
  /* Texto */
  --k-text-main: #212529;
  --k-text-muted: #6c757d;
  
  /* Bordes y Sombras */
  --k-radius-md: 0.375rem;
  --k-radius-lg: 0.5rem;
  --k-shadow-sm: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.05);
  --k-shadow-md: 0 0.5rem 1rem rgba(0, 0, 0, 0.08);
}
```

### 9.2 Componentes Base

#### Tarjetas (Cards)
```css
.widget {
  background: var(--k-bg-card);
  border: 1px solid var(--k-border);
  border-radius: var(--k-radius-lg);
  padding: 1.25rem;
  box-shadow: var(--k-shadow-sm);
  transition: transform 0.2s ease;
}
.widget:hover {
  transform: translateY(-3px);
  box-shadow: var(--k-shadow-md);
}
```

#### Botones
```css
.btn-primary {
  background-color: var(--k-primary);
  color: white;
  border: none;
  padding: 0.5rem 1.25rem;
  border-radius: var(--k-radius-md);
  font-weight: 500;
  transition: background 0.2s;
}
.btn-primary:hover {
  background-color: var(--k-primary-hover);
}
```

### 9.3 Tipografía

```css
body {
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
  font-size: 1rem;
  line-height: 1.5;
  color: var(--k-text-main);
}

h1, h2, h3, h4, h5, h6 {
  font-weight: 600;
  line-height: 1.2;
}
```

### 9.4 Temas (Claro/Oscuro/Sistema)

El sistema soporta 3 modos de tema:

| Tema | Descripción | Variables |
|------|-------------|-----------|
| **Claro** | Tema por defecto | Variables estándar |
| **Oscuro** | Paleta azul | `--k-primary: #4da6ff` |
| **Oscuro Legacy** | Paleta gris/negro | `--k-primary: #9e9e9e` |
| **Sistema** | Sigue al SO | Resuelve a claro/oscuro |

**Implementación:**
```javascript
// renderer.js - applyGlobalTheme()
async function applyGlobalTheme() {
  const savedTheme = await window.electronAPI.getThemePreference();
  const effectiveTheme = savedTheme === 'system' 
    ? await window.electronAPI.getSystemTheme()
    : savedTheme;
  
  if (effectiveTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}
```

**Documentación UI:** 📖 [docs/ui-update-responsable-sg.md](docs/ui-update-responsable-sg.md)

---

## 10. Decisiones Arquitectónicas

### 10.1 Decisiones Clave

| Decisión | Alternativas | Justificación |
|----------|-------------|---------------|
| **Electron** | Web app pura, .NET, Java | Multiplataforma, acceso a filesystem |
| **Vanilla JS** | React, Angular, Vue | Curva de aprendizaje, sin build step |
| **CommonJS** | ES6 Modules | Compatibilidad con Electron |
| **IPC vía preload** | nodeIntegration: true | Seguridad (contextIsolation) |
| **Python para IA** | Node.js con bindings | Mejor ecosistema ML (PyTorch) |
| **Archivos locales** | Base de datos | Simplicidad, portabilidad |
| **Componentes globales** | Module system estricto | Compatibilidad con código legacy |

### 10.2 Patrones de Diseño

| Patrón | Uso |
|--------|-----|
| **Singleton** | `window.currentCompany`, `window.currentModule` |
| **Factory** | Creación de componentes: `new ModuleHome()` |
| **Observer** | Listeners IPC: `window.electronAPI.onIpcMessage()` |
| **Strategy** | Escenarios normativos diferentes |
| **Facade** | `preload.js` como fachada de IPC |
| **Bridge** | `preload.js` como puente entre procesos |

### 10.3 Principios de Diseño

1. **Aislamiento Total**: Cada módulo es independiente
2. **Sin Efectos Colaterales**: Los cambios no afectan otros módulos
3. **Compatibilidad Hacia Atrás**: No romper contratos existentes
4. **Legibilidad**: Código claro y mantenible
5. **Coherencia UX/UI**: Sistema visual único
6. **Backend Predecible**: Handlers IPC estables

### 10.4 Reglas de Cambio

Cuando se requiera modificar algo:

1. **Identificar impacto**: ¿Qué otros módulos podrían verse afectados?
2. **Verificar contratos**: ¿Se altera algún handler IPC?
3. **Documentar**: Actualizar docs si es necesario
4. **Backup**: Mover archivos originales a `backup_archivos_originales/`
5. **Probar**: Verificar que no hay efectos colaterales
6. **Comunicar**: Actualizar CHANGELOG.md

---

## Apéndice A: Estadísticas del Proyecto

| Métrica | Valor |
|---------|-------|
| **Líneas de código totales** | ~15,000+ |
| **main.js** | 4766 líneas |
| **renderer.js** | 3170 líneas |
| **preload.js** | ~180 líneas |
| **index.html** | 143 líneas |
| **Módulos** | 7 |
| **Submódulos** | 27 |
| **Handlers IPC** | 55+ |
| **Contratos IPC** | 60+ |
| **Scripts Python** | 15+ |
| **Archivos CSS** | 46 |
| **Componentes JS** | 22+ |
| **Archivos en docs/** | 137 |
| **Archivos en modules/** | 136 |

---

## Apéndice B: Glosario de Términos

| Término | Definición |
|---------|------------|
| **IPC** | Inter-Process Communication (comunicación entre procesos) |
| **Preload** | Script que se ejecuta antes del renderer para exponer APIs |
| **Renderer** | Proceso de renderizado (navegador Chromium) |
| **Main Process** | Proceso principal de Electron (Node.js) |
| **contextBridge** | API de Electron para exponer funciones de forma segura |
| **SG-SST** | Sistema de Gestión de Seguridad y Salud en el Trabajo |
| **Copasst** | Comité Paritario de Seguridad y Salud en el Trabajo |
| **ARL** | Administradora de Riesgos Laborales |
| **EPS** | Entidad Promotora de Salud |
| **CIE-10** | Clasificación Internacional de Enfermedades (versión 10) |
| **LLM** | Large Language Model (modelo de lenguaje grande) |

---

**Documento mantenido por:** Product Architect & Full-Stack Team  
**Última actualización:** 24 de febrero de 2026  
**Versión:** 2.0 (Post-Reorganización Completa)

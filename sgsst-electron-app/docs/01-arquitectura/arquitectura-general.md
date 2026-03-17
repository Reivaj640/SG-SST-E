# 🏗️ Arquitectura General K+AIR SG-SST

**Versión:** 3.0 (Unificada)  
**Actualizado:** 16 de marzo de 2026  
**Estado:** ✅ Actualizado

---

## 📋 Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Arquitectura Electron](#2-arquitectura-electron)
3. [Estructura de Directorios](#3-estructura-de-directorios)
4. [Módulos y Submódulos](#4-módulos-y-submódulos)
5. [Sistema de Comunicación IPC](#5-sistema-de-comunicación-ipc)
6. [Motor Normativo](#6-motor-normativo)
7. [Integración con Python](#7-integración-con-python)
8. [Decisiones Arquitectónicas](#8-decisiones-arquitectónicas)

---

## 1. Visión General

### 1.1 Propósito del Sistema

**K+AIR** es una aplicación empresarial Electron que implementa un Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) conforme a la normativa colombiana (Resolución 0312 de 2019).

### 1.2 Principios de Diseño

| Principio | Descripción |
|-----------|-------------|
| **Multi-empresa** | Una sola aplicación, múltiples empresas con experiencias personalizadas |
| **Modularidad** | 7 módulos principales, 27+ submódulos completamente aislados |
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
| **DB Local** | SQLite (better-sqlite3) | - |
| **Auth** | bcryptjs (hash de contraseñas) | - |

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
│  │  └────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↕ IPC (contextBridge)              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     PRELOAD SCRIPT                        │   │
│  │  (Puente Seguro - contextBridge)                          │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────────────────┐   │   │
│  │  │  preload.js (~180L) - 60+ contratos IPC expuestos   │   │   │
│  │  └────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↕ IPC (ipcMain.handle)             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      MAIN PROCESS                         │   │
│  │  (Lógica de Negocio - Contexto Node.js)                  │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────────────────┐   │   │
│  │  │  main.js (4766L) - 55+ handlers IPC                 │   │   │
│  │  └────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↕ DB local                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                        SQLite DB                          │   │
│  │  (kair.db en app.getPath('userData'))                      │   │
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
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Flujo de Datos Típico

```
Usuario → UI (renderer.js)
    ↓
preload.js (contextBridge)
    ↓
IPC Channel
    ↓
main.js (ipcMain)
    ↓
┌────────────┴────────────┐
↓                         ↓
FileSystem          Python Scripts
(Excel, PDF)        (LLM, Procesamiento)
↓                         ↓
└────────────┬────────────┘
             ↓
        SQLite DB
     (kair.db local)
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
├── README.md                     # Documentación principal
├── docker-compose.yml            # Configuración Docker
├── icon-config.json              # Configuración de iconos
├── .gitignore                    # Ignorados de Git
└── [directorios]
```

### 3.2 Módulos (8 módulos principales)

```
modules/
├── gestion-integral/             # Módulo 2: Política, Objetivos, Evaluación
│   ├── index.js                  # Exporta submódulos
│   ├── gestion-integral-home.js  # Home del módulo
│   ├── evaluacion-inicial-sg-sst/
│   ├── objetivos-sst/
│   ├── plan-trabajo/
│   ├── politica/
│   └── rendicion-cuentas/
│
├── recursos/                     # Módulo 1: Responsable, Roles, Capacitación
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
├── gestion-salud/                # Módulo 3: Evaluaciones, Accidentes, Ausentismo
│   ├── index.js
│   ├── gestion-salud-home.js
│   ├── ausentismo/               # 3.3.6 Medición del ausentismo
│   ├── evaluaciones-medicas/     # 3.1.4 Evaluaciones médicas
│   ├── investigacion-accidentes/ # 3.2.2 Investigación con IA 🤖
│   ├── reportes-accidentes/      # 3.2.1 Reporte accidentes
│   ├── restricciones-medicas/    # 3.1.6 Restricciones médicas
│   └── sociodemografica/         # 3.1.1 Diagnóstico sociodemográfico
│
├── gestion-peligros/             # Módulo 4: Identificación de peligros
│   └── gestion-peligros-home.js
│
├── gestion-amenazas/             # Módulo 5: Plan de emergencias
│   └── gestion-amenazas-home.js
│
├── verificacion/                 # Módulo 6: Auditorías, Indicadores
│   └── verificacion-home.js
│
├── mejoramiento/                 # Módulo 7: Acciones correctivas
│   └── mejoramiento-home.js
│
└── helpers/                      # Utilidades
    └── viewLoader.js
```

### 3.3 Otros Directorios Clave

```
├── assets/                       # Recursos gráficos
├── backup_archivos_originales/   # Respaldo histórico (67 archivos)
├── components/                   # Componentes reutilizables
├── docs/                         # Documentación (organizada)
├── examples/                     # Ejemplos y demos
├── logs/                         # Registros de la aplicación
├── Portear/                      # Módulo Python (15+ scripts)
├── scripts/                      # Scripts de utilidad
├── test/                         # Archivos de prueba
└── utils/                        # Utilidades varias
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
| 1.1.1 | Responsable del SG | `responsable-sg-logic.js` |
| 1.1.2 | Roles y Responsabilidades | `roles-responsabilidades-logic.js` |
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
| 2.1.1 | Política del SG-SST | `politica-logic.js` |
| 2.2.1 | Objetivos SST | `objetivos-sst-logic.js` |
| 2.3.1 | Evaluación Inicial SG-SST | `evaluacion-inicial-sg-sst-logic.js` |
| 2.4.1 | Plan de Trabajo Anual | `plan-trabajo-logic.js` |
| 2.6.1 | Rendición de Cuentas | `rendicion-logic.js` |
| **3. Gestión de la Salud** | 3 | 6 | `gestion-salud-home.js` |
| 3.1.1 | Diagnóstico Sociodemográfico | `sociodemografica-component.js` |
| 3.1.4 | Evaluaciones Médicas | `evaluaciones-medicas-logic.js` |
| 3.1.6 | Restricciones Médicas | `restricciones-medicas-logic.js` |
| 3.2.1 | Reporte de Accidentes | `reportes-accidentes-logic.js` |
| 3.2.2 | Investigación de Accidentes 🤖 | `investigacion-accidentes-logic.js` |
| 3.3.6 | Medición del Ausentismo | `medicion-ausentismo.js` |
| **4. Gestión de Peligros** | 4 | 1 | `gestion-peligros-home.js` |
| **5. Gestión de Amenazas** | 5 | 1 | `gestion-amenazas-home.js` |
| **6. Verificación** | 6 | 1 | `verificacion-home.js` |
| **7. Mejoramiento** | 7 | 1 | `mejoramiento-home.js` |

**Total:** 7 módulos, 27+ submódulos

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

### 5.2 Categorías de Handlers

| Categoría | Cantidad | Ejemplos |
|-----------|----------|----------|
| App & Configuración | 5 | `getAppVersion`, `loadConfig` |
| Sistema de Temas | 5 | `getSystemTheme`, `saveThemePreference` |
| Archivos y Directorios | 6 | `selectDirectory`, `readExcelFile` |
| Ausentismo | 4 | `getAusentismoData`, `procesarAusentismo` |
| Investigación de Accidentes 🤖 | 6 | `analyzeAccident`, `generateAccidentReport` |
| Presupuesto | 5 | `getPresupuestoFiles`, `saveBudgetFile` |
| Capacitaciones | 6 | `updateCapacitacionesExcel`, `convertExcelToPdf` |
| OnlyOffice | 2 | `openOnlyOfficeEditor`, `generateOnlyOfficeConfig` |
| Documentos | 7 | `getPDFPreview`, `downloadDocument` |
| Actas | 4 | `generateCopasstActa`, `generateConvivenciaActa` |
| Remisiones | 6 | `processRemisionPdf`, `sendRemisionByEmail` |
| Seguimiento de Incapacidades | 5 | `saveFollowUp`, `getFollowUpHistory` |
| Objetivos SST | 3 | `loadObjetivosExcelData`, `saveObjetivosExcelData` |
| Inducciones | 1 | `syncInduccionData` |
| **TOTAL** | **55+** | - |

**Documentación Completa:** [ipc-contratos.md](ipc-contratos.md)

---

## 6. Motor Normativo

### 6.1 Escenarios Normativos (Resolución 0312 de 2019)

El sistema determina automáticamente los módulos requeridos según:

| Factor | Descripción |
|--------|-------------|
| **Tamaño de empresa** | Micro, Pequeña, Mediana, Grande |
| **Nivel de riesgo** | I, II, III, IV, V |
| **Sector económico** | Determina requisitos específicos |

### 6.2 Escenarios Implementados

```javascript
const escenarios = {
  "1A": { // Microempresa, Riesgo I
    modulos: ["Recursos básicos", "Política", "Reglamento"]
  },
  "5E": { // Grande, Riesgo V
    modulos: ["Todos los módulos (27+)"]
  }
};
```

**Documentación Completa:** [motor-normativo.md](motor-normativo.md)

---

## 7. Integración con Python

### 7.1 Arquitectura de Integración

```
main.js (Node.js)
    ↓
child_process.spawn()
    ↓
python.exe [script.py] [args]
    ↓
stdout / stderr (JSON)
    ↓
main.js procesa respuesta
```

### 7.2 Scripts Python Disponibles

| Script | Propósito | Puerto/Output |
|--------|-----------|---------------|
| `llm_server.py` | Servidor Flask para IA | Puerto 5555 |
| `accident_processor.py` | Extracción de datos de PDF | stdout (JSON) |
| `accident_report_generator.py` | Generación de informes DOCX | Archivo DOCX |
| `map_directory.py` | Mapeo de directorios | stdout (JSON) |
| `copasst_acta_generator.py` | Generador de actas COPASST | Archivo DOCX |
| `comite_convivencia_acta_generator.py` | Actas de convivencia | Archivo DOCX |
| `convert_docx_to_pdf.py` | Conversión DOCX → PDF | Archivo PDF |
| `convert_xlsx_to_pdf.py` | Conversión XLSX → PDF | Archivo PDF |
| `actualizar_ausentismo.py` | Actualización de ausentismo | stdout (JSON) |

### 7.3 Configuración del Modelo LLM

```python
RUTA_MODELO = "D:\\1. Estudio\\1.1 IA\\1.1.2. LLM's\\Inv. AT\\mistral-3-3B-Reasonig-2512"
PUERTO_SERVIDOR = 5555
TIPO_MODELO = "Multimodal (texto + imagen)"
CUANTIZACION = "bfloat16"
CONTEXTO_MAXIMO = 4096 tokens
```

---

## 8. Decisiones Arquitectónicas

### 8.1 Separación Backend/Frontend

| Capa | Responsabilidades | Archivos |
|------|-------------------|----------|
| **Backend** | Leer datos, Validar, Calcular reglas, Exponer contratos | `main.js`, `preload.js` |
| **Frontend** | Mostrar datos, Validaciones de UI, Formateo visual | `renderer.js`, `modules/` |

**Regla de oro:** El backend calcula, el frontend muestra.

### 8.2 Contratos Inquebrantables

**PROHIBIDO en Backend:**
- ❌ Cambiar estructura de retorno sin versionar
- ❌ Renombrar campos existentes
- ❌ Alterar tipos de datos
- ❌ Devolver datos incompletos

**Si se requiere cambio:**
- ✅ Crear NUEVA función (ej: `getPresupuestoV2`)
- ✅ O versionar explícitamente

### 8.3 Manejo de Errores

Toda respuesta debe seguir este patrón:

```javascript
{
  success: boolean,
  data?: object,
  error?: {
    code: string,
    message: string
  }
}
```

### 8.4 Seguridad de Archivos

- ✅ Validar rutas antes de acceder
- ✅ Manejar ausencia de archivos sin crash
- ✅ Nunca exponer paths completos innecesarios
- ✅ Usar `path.join()` para rutas cross-platform

### 8.5 Persistencia Local y Autenticación

- ✅ DB local SQLite (`kair.db`) para usuarios, roles, sesiones y asignaciones
- ✅ Hash de contraseñas con `bcryptjs` (sin almacenar texto plano)
- ✅ Login obligatorio en cada arranque (no reutiliza sesión previa)

---

## 9. Sistema Visual Oficial

### 9.1 Archivos de Estilo

| Archivo | Propósito | Líneas |
|---------|-----------|--------|
| `styles.css` | Estilos globales oficiales | ~2500 |
| `development-styles.css` | Estilos específicos de desarrollo | ~500 |

### 9.2 Principios de Diseño

- **Consistencia:** Mismos colores, fuentes y espaciados en toda la app
- **Responsividad:** Se adapta a diferentes tamaños de ventana
- **Accesibilidad:** Contrastes adecuados, tamaños legibles
- **Tema:** Soporte para modo claro/oscuro

---

## 10. Mantenimiento y Actualización

### 10.1 Comandos Esenciales

```bash
# Ejecutar aplicación
npm start

# Modo desarrollo
npm run dev

# Generar documentación API
npm run docs:generate

# Construir para distribución
npm run build
```

### 10.2 Documentación Relacionada

| Documento | Propósito |
|-----------|-----------|
| [../../README.md](../../README.md) | Inicio rápido |
| [ipc-contratos.md](ipc-contratos.md) | Contratos IPC (NO TOCAR) |
| [motor-normativo.md](motor-normativo.md) | Escenarios normativos |
| [02-modulos/](../02-modulos/) | Documentación de módulos |
| [03-guias/](../03-guias/) | Guías prácticas |

---

**Mantenido por:** Product Architect & Full-Stack Team  
**Última actualización:** 16 de marzo de 2026  
**Versión:** 0.1.75

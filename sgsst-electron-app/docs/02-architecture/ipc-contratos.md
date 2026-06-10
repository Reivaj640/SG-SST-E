# 📡 Contratos IPC K+AIR

**Versión:** 4.0
**Actualizado:** 9 de junio de 2026
**Estado:** ✅ COMPLETO — 137/137 contratos documentados

---

## ⚠️ Advertencia Importante

> **ESTE ARCHIVO DOCUMENTA CONTRATOS INQUEBRANTABLES**
>
> - ❌ **NO modificar** estructura de retorno sin versionar
> - ❌ **NO renombrar** campos existentes
> - ❌ **NO alterar** tipos de datos
> - ✅ **SI crear** nueva función versionada (ej: `getPresupuestoV2`)
>
> **Responsable:** Backend Architect
> **Impacto:** Cambios afectan TODOS los módulos frontend

---

## 📋 Tabla de Contenidos

1. [Arquitectura IPC](#1-arquitectura-ipc)
2. [Resumen de Handlers](#2-resumen-de-handlers)
3. [Contratos por Categoría](#3-contratos-por-categoría)
4. [Patrones de Error](#4-patrones-de-error)
5. [Ejemplos de Uso](#5-ejemplos-de-uso)

---

## 1. Arquitectura IPC

### 1.1 Flujo de Comunicación

```
┌─────────────────┐                    ┌─────────────────┐
│   Renderer      │                    │   Main Process  │
│   (Frontend)    │                    │   (Backend)     │
│                 │                    │                 │
│ window.         │  ┌──────────────┐  │ ipcMain.        │
│ electronAPI     │──│  preload.js  │──│ handle()        │
│                 │  │ contextBridge│  │                 │
│                 │  └──────────────┘  │                 │
└─────────────────┘                    └─────────────────┘
```

### 1.2 Archivos Clave

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `preload.js` | 420 | Expone 137 contratos vía `contextBridge` |
| `main.js` | 15809 | Implementa 133 `ipcMain.handle` + 4 `ipcMain.on` |

---

## 2. Resumen de Handlers

**Total:** 133 handlers `ipcMain.handle()` + 4 listeners `ipcMain.on()` = 137 total

| Categoría | Handlers | Descripción |
|-----------|----------|-------------|
| App & Configuración | 6 | Versión, ruta, config, normativa, stats recursos |
| Autenticación y Usuarios | 10 | Login, logout, CRUD usuarios, asignaciones |
| Sistema de Temas | 5 | Tema sistema/usuario, preferencias |
| Archivos y Directorios | 6 | Selección, mapeo, lectura, apertura, Excel |
| Dashboard Scanner | 1 | Resumen consolidado |
| Evaluación y Selección | 8 | Asociados, evaluaciones, reevaluaciones, NC |
| Archivos Proveedores | 3 | Carpeta, copia, listado |
| Documentos & OnlyOffice | 9 | Preview, edición, OnlyOffice |
| Gestión Archivos CRUD | 6 | Upload, delete, open, carpeta, rename |
| Word COM | 2 | Diagnosticar, reparar |
| Utilidades Rutas | 3 | Submódulo, archivo, dependencias |
| Diálogo Guardado | 1 | Diálogo nativo OS |
| Excel Extendido | 4 | Proveedores, plan trabajo, reparación, auditoría |
| Remisiones | 7 | PDF, DOCX→PDF, generación, email, WhatsApp, contacto |
| Capacitaciones | 6 | Gestión, auditoría, duplicación, PDF |
| Presupuesto | 5 | Lectura, guardado, ventana, duplicación |
| Investigación Accidentes | 10 | PDF, IA (5 Porqués), informe + gestión |
| Registro Estadístico | 1 | Cargar datos (3.2.3) |
| Ausentismo | 4 | Datos, búsqueda, CIE-10, procesamiento |
| PRI Seguimiento | 8 | Seguimientos, historial, export, PRI extendido |
| Consulta Trabajadores | 2 | Búsqueda global, empresas BD |
| Estadísticas Cached | 7 | Widgets home (7 stats) |
| Inducciones | 3 | Datos, sync Forms, check cambios |
| Actas | 8 | COPASST, Convivencia + autofill, save-path |
| Objetivos SST | 3 | Ruta, carga, guardado Excel |
| Evaluación Inicial | 1 | Procesar PDF |
| Archivo y Retención | 7 | CRUD documentos retención |
| Gestión del Cambio | 4 | Load, save, generate ID, update estado |
| Frecuencia Accidentalidad | 4 | Rutas, indicadores, caracterización, Excel |
| Severidad Accidentalidad | 3 | Rutas, indicadores, Excel |
| Mortalidad | 3 | Rutas, indicadores, Excel |
| Indicadores Archivos | 2 | Listar, duplicar por año |
| Inspecciones | 17 | CRUD, schedule, Excel, metadatos |
| Mantenimiento | 10 | CRUD, toggle, evidencias, stats |
| Matriz de Peligros | 25 | CRUD jerárquico, heatmap, priorización, GTC-45, sync |
| Auto-Update | 7 | Eventos actualización + restart |
| IPC Genérico | 3 | Send, on, removeListener |
| Watchers Capacitaciones | 2 | Start/stop watching |
| Loading System | 1 | Señal carga completa |
| **TOTAL** | **137** | **133 handle + 4 on** |

> ✅ **Todos los 137 contratos están documentados** en secciones 2.1–2.45.

---

## 2. Contratos por Categoría

### 2.1 App & Configuración (5 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getAppVersion()` | `get-app-version` | - | `string` | Versión de la app |
| `getAppPath()` | `get-app-path` | - | `string` | Ruta base de la aplicación |
| `getRecursosStats(companyName)` | `get-recursos-stats` | `companyName: string` | `{ success, data }` | Estadísticas del módulo Recursos |
| `saveConfig(config)` | `save-config` | `config: object` | `{ success, error? }` | Guardar configuración |
| `loadConfig()` | `load-config` | - | `{ success, data }` | Cargar configuración |
| `loadNormativa()` | `load-normativa` | - | `{ success, data }` | Cargar reglas normativas |

**Ejemplo de uso:**
```javascript
// Frontend (renderer.js)
const version = await window.electronAPI.getAppVersion();
console.log(`Versión: ${version}`);

const stats = await window.electronAPI.getRecursosStats('Empresa SAS');
if (stats.success) {
  console.log(`Recursos: ${stats.data.total}`);
}
```

---

### 2.2 Autenticación y Usuarios (v1) 🆕

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `authLoginV1(payload)` | `auth-login-v1` | `{ email, password }` | `{ success, data?, error? }` | Login y creación de sesión |
| `authLogoutV1(payload)` | `auth-logout-v1` | `{ token }` | `{ success, error? }` | Cerrar sesión |
| `companiesSyncV1(payload)` | `companies-sync-v1` | `{ token }` | `{ success, data?, error? }` | Sincronizar empresas config.json → DB |
| `usersListV1(payload)` | `users-list-v1` | `{ token }` | `{ success, data?, error? }` | Listar usuarios |
| `usersCreateV1(payload)` | `users-create-v1` | `{ token, user }` | `{ success, data?, error? }` | Crear usuario |
| `usersUpdateV1(payload)` | `users-update-v1` | `{ token, userId, patch }` | `{ success, error? }` | Actualizar usuario |
| `usersDisableV1(payload)` | `users-disable-v1` | `{ token, userId }` | `{ success, error? }` | Desactivar usuario |
| `assignmentsSetV1(payload)` | `assignments-set-v1` | `{ token, assignments, replaceAllForUser? }` | `{ success, error? }` | Asignar empresas y rol |
| `assignmentsListV1(payload)` | `assignments-list-v1` | `{ token }` | `{ success, data?, error? }` | Listar asignaciones del usuario autenticado |
| `assignmentsListByUserV1(payload)` | `assignments-list-by-user-v1` | `{ token, userId }` | `{ success, data?, error? }` | Listar asignaciones por usuario |

**Estructura de `data` en `authLoginV1`:**
```javascript
{
  token: string,
  user: { id, email, full_name, status },
  companies: [{ company_key, display_name, role }]
}
```

**Estructura de `user` en `usersCreateV1`:**
```javascript
{
  email: string,
  full_name: string,
  password: string
}
```

**Estructura de `assignments` en `assignmentsSetV1`:**
```javascript
[
  { userId: number, companyKey: string, role: string }
]
```

---

### 2.3 Sistema de Temas (5 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getSystemTheme()` | `get-system-theme` | - | `'light' \| 'dark'` | Tema del sistema operativo |
| `saveThemePreference(theme)` | `save-theme-preference` | `theme: string` | `{ success }` | Guardar preferencia de tema |
| `getThemePreference()` | `get-theme-preference` | - | `string \| null` | Preferencia guardada |
| `getEffectiveTheme()` | `get-effective-theme` | - | `'light' \| 'dark'` | Tema efectivo (sistema o preferencia) |
| `onSystemThemeChanged(cb)` | `system-theme-changed` | `callback: function` | `() => void` (unsubscribe) | Listener de cambios de tema |

---

### 2.4 Archivos y Directorios (6 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `selectDirectory()` | `select-directory` | - | `{ success, path?, error? }` | Diálogo de selección de directorio |
| `mapDirectory(path)` | `map-directory` | `path: string` | `{ success, structure, log }` | Mapear directorio con Python |
| `readDirectory(path)` | `read-directory` | `path: string` | `{ success, files, folders }` | Leer contenido de directorio |
| `openPath(filePath)` | `open-path` | `filePath: string` | `{ success, error? }` | Abrir archivo con app predeterminada |
| `readExcelFile(path)` | `read-excel-file` | `path: string` | `{ success, data, error? }` | Leer archivo Excel |
| `processExcelData(payload)` | `process-excel-data` | `payload: object` | `{ success, data, error? }` | Procesar datos de Excel |

**Ejemplo de uso:**
```javascript
// Frontend - Seleccionar y leer Excel
const { success, path } = await window.electronAPI.selectDirectory();
if (success) {
  const excelData = await window.electronAPI.readExcelFile(path + '/datos.xlsx');
  if (excelData.success) {
    console.log('Datos:', excelData.data);
  }
}
```

---

### 2.5 Ausentismo (4 contratos) 🔴 CRÍTICO

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getAusentismoData(company)` | `get-ausentismo-data` | `company: string` | `{ success, data, error? }` | Datos de ausentismo de empresa |
| `buscarEmpleadoPorCedula(cedula, empresa)` | `buscar-empleado-por-cedula` | `cedula: string`, `empresa: string` | `{ success, data }` | Buscar empleado por cédula en PI-FO-001 |
| `buscarCie10Descripcion(code)` | `buscar-cie10-descripcion` | `code: string` | `{ success, descripcion }` | Buscar descripción CIE-10 |
| `procesarAusentismo(formData)` | `procesar-ausentismo` | `formData: object` | `{ success, data, error? }` | Procesar formulario de incapacidad |

**Estructura de `formData` para `procesarAusentismo`:**
```javascript
{
  cedula: string,
  nombre: string,
  fechaNacimiento: string,
  genero: string,
  cargo: string,
  area: string,
  empresaUsuaria: string,
  fechaInicio: string,
  fechaFin: string,
  diasIncapacidad: number,
  claseIncapacidad: 'EPS' | 'ARL' | 'EMPRESA',
  tipoIncapacidad: string,
  entidad: string,
  codigoCie10: string,
  descripcionDiagnostico: string,
  recordIndex: number  // Índice en PI-FO-076.xlsx
}
```

**Ejemplo de uso:**
```javascript
// Frontend - Buscar empleado
const resultado = await window.electronAPI.buscarEmpleadoPorCedula('12345678', 'Empresa SAS');
if (resultado.success) {
  console.log('Empleado encontrado:', resultado.data);
  // resultado.data = { nombre, cargo, area, empresaUsuaria, ... }
}

// Frontend - Procesar incapacidad
const formData = {
  cedula: '12345678',
  nombre: 'Juan Pérez',
  // ... resto de campos
};
const resultado = await window.electronAPI.procesarAusentismo(formData);
if (resultado.success) {
  console.log('Incapacidad procesada:', resultado.data);
}
```

---

### 2.6 Investigación de Accidentes 🤖 (6 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `selectAccidentPdf()` | `investigacion-accidentes-select-accident-pdf` | - | `{ success, filePath? }` | Seleccionar PDF de accidente |
| `processAccidentPdf(path)` | `investigacion-accidentes-process-accident-pdf` | `path: string` | `{ success, data }` | Extraer datos del PDF con Python |
| `analyzeAccident(data)` | `investigacion-accidentes-analyze-accident` | `data: object` | `{ success, analysis }` | Analizar con LLM (5 Porqués) |
| `generateAccidentReport(data)` | `investigacion-accidentes-generate-accident-report` | `data: object` | `{ success, reportPath }` | Generar informe DOCX |
| `startModelLoading()` | `investigacion-accidentes-start-model-loading` | - | `{ success }` | Iniciar carga del modelo LLM |
| `saveTempPdfFile(filename, data)` | `investigacion-accidentes-save-temp-pdf-file` | `filename: string`, `data: base64` | `{ success, path }` | Guardar PDF temporal |

**Estructura de `data` para `analyzeAccident`:**
```javascript
{
  texto_accidente: string,      // Descripción del accidente
  imagenes?: string[],          // URLs o paths de imágenes (opcional)
  empresa: string,              // Nombre de la empresa
  trabajador: string,           // Nombre del trabajador
  fecha: string,                // Fecha del accidente
  cargo: string                 // Cargo del trabajador
}
```

**Estructura de `analysis` (retorno):**
```javascript
{
  causas_basicas: {
    factores_personales: string[],
    factores_trabajo: string[]
  },
  causas_inmediatas: {
    actos_inseguros: string[],
    condiciones_inseguras: string[]
  },
  causa_raiz: string,
  recomendaciones: string[],
  metodologia: '5 Porqués',
  categorias: '5M'  // Mano de obra, Máquina, Material, Método, Medio
}
```

**Ejemplo de uso:**
```javascript
// Frontend - Analizar accidente
const pdfPath = await window.electronAPI.selectAccidentPdf();
if (pdfPath.success) {
  // 1. Extraer datos del PDF
  const extracted = await window.electronAPI.processAccidentPdf(pdfPath.filePath);
  
  // 2. Analizar con IA
  const analysis = await window.electronAPI.analyzeAccident(extracted.data);
  
  // 3. Generar informe
  const report = await window.electronAPI.generateAccidentReport({
    ...extracted.data,
    analysis: analysis.analysis
  });
  
  // 4. Abrir informe
  await window.electronAPI.openPath(report.reportPath);
}
```

---

### 2.7 Presupuesto (5 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getPresupuestoFiles(company)` | `getPresupuestoFiles` | `company: string` | `{ success, files }` | Obtener archivos de presupuesto |
| `readPresupuestoData(path)` | `readPresupuestoData` | `path: string` | `{ success, data }` | Leer datos de presupuesto |
| `saveBudgetFile(path, data)` | `saveBudgetFile` | `path: string`, `data: object` | `{ success, error? }` | Guardar archivo de presupuesto |
| `openBudgetWindow(file)` | `open-budget-window` | `file: object` | `{ success }` | Abrir ventana de presupuesto |
| `duplicateBudgetFile(params)` | `duplicate-budget-file` | `params: object` | `{ success, newPath? }` | Duplicar archivo de presupuesto |

---

### 2.8 Capacitaciones (6 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getCapacitacionesSheets(path)` | `get-capacitaciones-sheets` | `path: string` | `{ success, sheets }` | Obtener hojas de Excel |
| `initExcel(data)` | `init-excel` | `data: object` | `{ success }` | Inicializar Excel |
| `updateCapacitacionesExcel(data)` | `update-capacitaciones-excel` | `data: object` | `{ success }` | Actualizar Excel de capacitaciones |
| `duplicateCapacitacionesSheet(args)` | `duplicate-capacitaciones-sheet` | `args: object` | `{ success }` | Duplicar hoja de capacitaciones |
| `updateExcelCell(data)` | `update-excel-cell` | `data: object` | `{ success }` | Actualizar celda específica |
| `convertExcelToPdf(path)` | `convertExcelToPdf` | `path: string` | `{ success, pdfPath? }` | Convertir Excel a PDF |

---

### 2.9 OnlyOffice (2 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `openOnlyOfficeEditor(payload)` | `open-onlyoffice-editor` | `payload: object` | `{ success, error? }` | Abrir editor OnlyOffice |
| `generateOnlyOfficeConfig(payload)` | `generate-onlyoffice-config` | `payload: object` | `{ success, config }` | Generar configuración OnlyOffice |

---

### 2.10 Documentos (7 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getDocumentFolders(payload)` | `get-document-folders` | `payload: object` | `{ success, folders }` | Obtener carpetas de documentos |
| `getPDFPreview(path)` | `get-pdf-preview` | `path: string` | `{ success, preview }` | Vista previa de PDF |
| `getWordPreview(path)` | `get-word-preview` | `path: string` | `{ success, preview }` | Vista previa de Word |
| `getExcelPreview(path)` | `get-excel-preview` | `path: string` | `{ success, preview }` | Vista previa de Excel |
| `downloadDocument(path)` | `download-document` | `path: string` | `{ success, error? }` | Descargar documento |
| `getEditableContent(payload)` | `get-editable-content` | `payload: object` | `{ success, content }` | Obtener contenido editable |
| `saveEditedDocument(payload)` | `save-edited-document` | `payload: object` | `{ success, error? }` | Guardar documento editado |

---

### 2.11 Actas (4 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getActaData()` | `get-acta-data` | - | `{ success, data }` | Datos para acta COPASST |
| `getConvivenciaActaData()` | `getConvivenciaActaData` | - | `{ success, data }` | Datos para acta de convivencia |
| `generateCopasstActa(changes)` | `generate-copasst-acta` | `changes: object` | `{ success, actaPath }` | Generar acta COPASST DOCX |
| `generateConvivenciaActa(changes)` | `generate-convivencia-acta` | `changes: object` | `{ success, actaPath }` | Generar acta de convivencia DOCX |

---

### 2.12 Remisiones (6 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getControlRemisionesData(company)` | `get-control-remisiones-data` | `company: string` | `{ success, data }` | Datos de remisiones |
| `processRemisionPdf(path)` | `process-remision-pdf` | `path: string` | `{ success, data }` | Procesar PDF de remisión |
| `convertDocxToPdf(path)` | `convert-docx-to-pdf` | `path: string` | `{ success, pdfPath }` | Convertir DOCX a PDF |
| `selectPdfFile()` | `select-pdf-file` | - | `{ success, filePath }` | Seleccionar archivo PDF |
| `generateRemisionDocument(data, empresa)` | `generate-remision-document` | `data: object`, `empresa: string` | `{ success, docPath }` | Generar documento de remisión |
| `sendRemisionByEmail(path, data, empresa)` | `send-remision-by-email` | `path: string`, `data: object`, `empresa: string` | `{ success, error? }` | Enviar remisión por email |
| `sendRemisionByWhatsapp(path, data, empresa)` | `send-remision-by-whatsapp` | `path: string`, `data: object`, `empresa: string` | `{ success, error? }` | Enviar remisión por WhatsApp |

---

### 2.13 Seguimiento de Incapacidades (5 contratos) 🔴 CRÍTICO

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `saveFollowUp(data, company)` | `save-follow-up` | `data: object`, `company: string` | `{ success, error? }` | Guardar seguimiento PRIC en PRI.xlsx |
| `exportIncapacityData(company)` | `export-incapacity-data` | `company: string` | `{ success, path?, error? }` | Exportar datos de incapacidad |
| `getFollowUpHistory(caseId, company)` | `get-follow-up-history` | `caseId: string`, `company: string` | `{ success, history }` | Obtener historial de seguimientos |
| `loadFollowUpData(company)` | `load-follow-up-data` | `company: string` | `{ success, cases }` | Cargar casos de PRI.xlsx |
| `saveDebugHtml(html)` | `save-debug-html` | `html: string` | `{ success, path }` | Guardar HTML de depuración |

**Estructura de `data` para `saveFollowUp`:**
```javascript
{
  // Datos del trabajador
  trabajador: {
    nombre: string,
    cedula: string,
    fechaNacimiento: string,
    genero: string,
    cargo: string,
    area: string,
    fechaIngreso: string,
    antiguedad: number,  // Calculado automáticamente
    tipoContrato: string,
    salario: number,
    eps: string,
    afp: string,
    tipoEvento: string,
    tipoCargo: string
  },
  // Datos de incapacidad
  incapacidad: {
    fechaInicio: string,
    fechaFin: string,
    diasAcumulados: number,  // Calculado automáticamente
    clase: 'EPS' | 'ARL' | 'EMPRESA',
    codigoCie10: string,
    descripcionDiagnostico: string,
    numeroProrrogas: number,
    seguimientos: [  // Hasta 5 seguimientos 🆕
      {
        fecha: string,
        descripcion: string
      }
    ]
  },
  // Datos PRIC (5 etapas)
  pric: {
    // ... estructura de 5 etapas
  },
  // Calificación PCL (14 campos)
  calificacion: {
    // ... datos de calificación
  },
  // Recomendaciones
  recomendaciones: [
    {
      recomendacion: string,
      entidad: string,
      fechaLimite: string,
      cumple: 'SI' | 'NO',
      observacion: string
    }
  ]
}
```

**Columnas de indexación en PRI.xlsx:**

| Campo | Columna | Índice |
|-------|---------|--------|
| Seguimiento 1 - Fecha | AB | 27 |
| Seguimiento 1 - Descripción | AC | 28 |
| Seguimiento 2 - Fecha | AD | 29 |
| Seguimiento 2 - Descripción | AE | 30 |
| Seguimiento 3 - Fecha | AF | 31 |
| Seguimiento 3 - Descripción | AG | 32 |
| Seguimiento 4 - Fecha | AH | 33 |
| Seguimiento 4 - Descripción | AI | 34 |
| Seguimiento 5 - Fecha | AJ | 35 |
| Seguimiento 5 - Descripción | AK | 36 |

**Lógica de actualización vs creación:**

| Condición | Acción |
|-----------|--------|
| MISMA cédula + MISMAS fechas (fecha_fin) | ✅ ACTUALIZA registro existente |
| MISMA cédula + DIFERENTES fechas | ✅ CREA NUEVO registro |
| Cédula diferente | ✅ CREA NUEVO registro |

---

### 2.14 Objetivos SST (3 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getObjetivosExcelPath(company)` | `get-objetivos-excel-path` | `company: string` | `{ success, path }` | Obtener ruta de Excel de objetivos |
| `loadObjetivosExcelData(path)` | `load-objetivos-excel-data` | `path: string` | `{ success, data }` | Cargar datos de Excel |
| `saveObjetivosExcelData(path, data)` | `save-objetivos-excel-data` | `path: string`, `data: object` | `{ success, error? }` | Guardar datos en Excel |

---

### 2.15 Inducciones 🆕 (1 contrato)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `syncInduccionData(data)` | `sync-induccion-data` | `data: object` | `{ success, error? }` | Sincronizar datos de Google Forms → Excel → App |

**Estructura de `data`:**
```javascript
{
  empresa: string,
  trabajador: {
    nombre: string,
    cedula: string,
    cargo: string,
    area: string,
    fechaIngreso: string
  },
  induccion: {
    fecha: string,
    tipo: 'Inducción' | 'Reinducción',
    temas: string[],
    duracion: number,  // horas
    instructor: string,
    aprobado: boolean
  }
}
```

---

### 2.16 Dashboard Scanner (1 contrato)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getDashboardSummary(companyName)` | `get-dashboard-summary` | `companyName: string` | `{ success, data?, error? }` | Resumen consolidado del dashboard principal |

**Estructura de `data`:**
```javascript
{
  modulos: {
    recursos: { total, pendientes },
    salud: { examenes, seguimientos },
    peligros: { hallazgos, controles },
    verificacion: { auditorias, nc },
    mejoramiento: { acciones, cerradas }
  },
  alertas: number,
  pendientes: number
}
```

---

### 2.17 Evaluación y Selección (8 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getAsociadosES()` | `get-asociados-es` | - | `{ success, data? }` | Listar asociados/proveedores |
| `saveAsociadosES(data)` | `save-asociados-es` | `data: object` | `{ success, error? }` | Guardar lista de asociados |
| `getEvaluacionesES()` | `get-evaluaciones-es` | - | `{ success, data? }` | Listar evaluaciones |
| `saveEvaluacionesES(data)` | `save-evaluaciones-es` | `data: object` | `{ success, error? }` | Guardar evaluaciones |
| `getReevaluacionesES()` | `get-reevaluaciones-es` | - | `{ success, data? }` | Listar reevaluaciones |
| `saveReevaluacionesES(data)` | `save-reevaluaciones-es` | `data: object` | `{ success, error? }` | Guardar reevaluaciones |
| `getNoConformidadesES()` | `get-noconformidades-es` | - | `{ success, data? }` | Listar no conformidades |
| `saveNoConformidadesES(data)` | `save-noconformidades-es` | `data: object` | `{ success, error? }` | Guardar no conformidades |

---

### 2.18 Archivos de Proveedores — Evidencias (3 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `createProviderFolder(basePath, folderName)` | `create-provider-folder` | `basePath: string`, `folderName: string` | `{ success, error? }` | Crear carpeta de proveedor |
| `copyFileToProviderFolder(source, dest, name)` | `copy-file-to-provider-folder` | `source: string`, `dest: string`, `name: string` | `{ success, error? }` | Copiar archivo a carpeta proveedor |
| `listProviderFiles(folderPath)` | `list-provider-files` | `folderPath: string` | `{ success, files? }` | Listar archivos de carpeta proveedor |

---

### 2.19 Gestión de Archivos — CRUD (6 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `uploadDocument(payload)` | `upload-document` | `payload: object` | `{ success, error? }` | Subir documento |
| `deleteDocument(filePath)` | `delete-document` | `filePath: string` | `{ success, error? }` | Eliminar documento |
| `openFile(filePath)` | `open-file` | `filePath: string` | `{ success, error? }` | Abrir archivo con app predeterminada |
| `createFolder(payload)` | `create-folder` | `payload: { path, name }` | `{ success, error? }` | Crear carpeta |
| `deleteFolder(payload)` | `delete-folder` | `payload: { path }` | `{ success, error? }` | Eliminar carpeta |
| `renameItem(payload)` | `rename-item` | `payload: { path, newName }` | `{ success, error? }` | Renombrar archivo/carpeta |

---

### 2.20 Diagnóstico Word COM (2 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `diagnoseWordCom()` | `diagnose-word-com` | - | `{ success, data? }` | Diagnosticar estado de Word COM |
| `repairWordCom()` | `repair-word-com` | - | `{ success, error? }` | Reparar integración Word COM |

---

### 2.21 Utilidades de Rutas y Dependencias (3 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `findSubmodulePath(companyName, module, submodule)` | `find-submodule-path` | `companyName: string`, `module: string`, `submodule: string` | `{ success, path? }` | Buscar ruta de submódulo |
| `getFilePath(payload)` | `get-file-path` | `payload: object` | `{ success, path? }` | Obtener ruta de archivo |
| `checkDependencies()` | `check-dependencies` | - | `{ success, data? }` | Verificar dependencias del sistema |

---

### 2.22 Diálogo de Guardado (1 contrato)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `showSaveDialog(options)` | `save-file-dialog` | `options: object` | `{ success, path? }` | Mostrar diálogo de guardado nativo |

---

### 2.23 Excel — Operaciones Extendidas (4 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `saveProveedoresExcelData(filePath, data)` | `save-proveedores-excel-data` | `filePath: string`, `data: object` | `{ success, error? }` | Guardar datos de proveedores en Excel |
| `updatePlanTrabajoExcel(payload)` | `update-plan-trabajo-excel` | `payload: object` | `{ success, error? }` | Actualizar Excel de Plan de Trabajo |
| `repairPlanTrabajoExcel(payload)` | `repair-plan-trabajo-excel` | `payload: object` | `{ success, error? }` | Reparar Excel de Plan de Trabajo |
| `auditExcelContent(data)` | `audit-excel-content` | `data: object` | `{ success, data? }` | Auditar contenido de Excel |

---

### 2.24 Investigación de Accidentes — Gestión (4 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getInvestigacionStats(companyName)` | `investigacion-accidentes-get-stats` | `{ companyName }` | `{ success, data? }` | Estadísticas de investigaciones |
| `listInvestigations(companyName, filter)` | `investigacion-accidentes-list-investigations` | `{ companyName, filter }` | `{ success, data? }` | Listar investigaciones con filtro |
| `getInvestigationDetail(companyName, name)` | `investigacion-accidentes-get-investigation-detail` | `{ companyName, investigationName }` | `{ success, data? }` | Detalle de una investigación |
| `getCrossReferenceData(companyName)` | `investigacion-accidentes-cross-reference-data` | `{ companyName }` | `{ success, data? }` | Datos de referencia cruzada |

---

### 2.25 Registro Estadístico (1 contrato)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `registroEstadisticoCargarDatos(companyName)` | `registro-estadistico:cargar-datos` | `{ companyName }` | `{ success, data? }` | Cargar datos del registro estadístico (3.2.3) |

---

### 2.26 Seguimiento PRI Extendido (3 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `readAusentismoData(companyName)` | `get-ausentismo-data` | `companyName: string` | `{ success, data? }` | Leer datos de ausentismo (alias) |
| `getPriSeguimientoData(companyName)` | `get-pri-seguimiento-data` | `companyName: string` | `{ success, data? }` | Datos de seguimiento PRI |
| `buscarTodosRegistrosPRI(companyName)` | `buscar-todos-registros-pri` | `companyName: string` | `{ success, data? }` | Buscar todos los registros PRI |

---

### 2.27 Consulta de Trabajadores (2 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `consultarTrabajadoresGlobal(params)` | `consultar-trabajadores-global` | `params: object` | `{ success, data? }` | Búsqueda global de trabajadores |
| `obtenerEmpresasConBDPersonal()` | `obtener-empresas-con-bd-personal` | - | `{ success, data? }` | Empresas con BD de personal disponible |

---

### 2.28 Estadísticas Cached — Widgets Home (7 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getAusentismoStats(companyName, mode)` | `get-ausentismo-stats` | `companyName: string`, `mode: string` | `{ success, data? }` | Stats ausentismo (widget home) |
| `getAccidentesStats(companyName)` | `get-accidentes-stats` | `companyName: string` | `{ success, data? }` | Stats accidentes FURAT (widget home) |
| `getIndicadoresSaludStats(companyName)` | `get-indicadores-salud-stats` | `companyName: string` | `{ success, data? }` | Stats indicadores salud (widget home) |
| `getExamenesStats(companyName)` | `get-examenes-stats` | `companyName: string` | `{ success, data? }` | Stats exámenes médicos (widget home) |
| `getRemisionesStats(companyName)` | `get-remisiones-stats` | `companyName: string` | `{ success, data? }` | Stats remisiones (widget home) |
| `getSaludSeguimientosStats(companyName)` | `get-salud-seguimientos-stats` | `companyName: string` | `{ success, data? }` | Stats seguimientos salud (widget home) |
| `getGestionIntegralStats(companyName)` | `get-gestion-integral-stats` | `companyName: string` | `{ success, data? }` | Stats gestión integral (widget home) |

---

### 2.29 Inducciones Extendidas (3 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getInduccionesData(companyName)` | `get-inducciones-data` | `companyName: string` | `{ success, data? }` | Cargar datos de inducciones |
| `syncInduccionesFromForms(companyName)` | `sync-inducciones-from-forms` | `companyName: string` | `{ success, error? }` | Sincronizar inducciones desde Google Forms |
| `checkInduccionesChanges(companyName, lastKnownHash)` | `check-inducciones-changes` | `companyName: string`, `lastKnownHash: string` | `{ success, hasChanges? }` | Verificar cambios en inducciones |

---

### 2.30 Actas Extendidas (4 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getCopasstAutoFillData(companyName)` | `get-copasst-auto-fill-data` | `companyName: string` | `{ success, data? }` | Datos autofill para acta COPASST |
| `getCopasstSavePath(companyName, year, month, num)` | `get-copasst-save-path` | `companyName: string`, `year`, `monthName`, `actaNumber` | `{ success, path? }` | Ruta de guardado acta COPASST |
| `getConvivenciaAutoFillData(companyName)` | `get-convivencia-auto-fill-data` | `companyName: string` | `{ success, data? }` | Datos autofill para acta Convivencia |
| `getConvivenciaSavePath(companyName, year, month)` | `get-convivencia-save-path` | `companyName: string`, `year`, `monthName` | `{ success, path? }` | Ruta de guardado acta Convivencia |

---

### 2.31 Remisiones — Contacto (1 contrato)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getContactInfo(cedula, empresa)` | `get-contact-info` | `cedula: string`, `empresa: string` | `{ success, data? }` | Obtener info de contacto del trabajador |

---

### 2.32 Evaluación Inicial SG-SST (1 contrato)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `processEvaluacionPdf(pdfPath, sourceType)` | `process-evaluacion-pdf` | `pdfPath: string`, `sourceType: string` | `{ success, data? }` | Procesar PDF de evaluación inicial |

---

### 2.33 Archivo y Retención Documental (7 contratos)

Accesos vía namespace `archivoRetencion.*`:

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `archivoRetencion.getStats(companyName)` | `archivo-retencion:get-stats` | `companyName: string` | `{ success, data? }` | Estadísticas de archivo/retención |
| `archivoRetencion.getExcelPath(companyName)` | `archivo-retencion:get-excel-path` | `companyName: string` | `{ success, path? }` | Ruta del Excel de retención |
| `archivoRetencion.leerTodos(companyName)` | `archivo-retencion:leer-todos` | `companyName: string` | `{ success, data? }` | Leer todos los documentos |
| `archivoRetencion.guardar(companyName, docs)` | `archivo-retencion:guardar` | `companyName: string`, `documentos: array` | `{ success, error? }` | Guardar documentos masivamente |
| `archivoRetencion.crear(companyName, doc)` | `archivo-retencion:crear` | `companyName: string`, `documento: object` | `{ success, error? }` | Crear nuevo documento de retención |
| `archivoRetencion.actualizar(companyName, doc)` | `archivo-retencion:actualizar` | `companyName: string`, `documento: object` | `{ success, error? }` | Actualizar documento de retención |
| `archivoRetencion.eliminar(companyName, num)` | `archivo-retencion:eliminar` | `companyName: string`, `{ numero }` | `{ success, error? }` | Eliminar documento de retención |

**Estructura de `documento`:**
```javascript
{
  numero: string,
  tipoDocumental: string,
  descripcion: string,
  tiempoRetencion: number,
  responsable: string,
  ubicacion: string,
  estado: 'Activo' | 'Inactivo'
}
```

---

### 2.34 Gestión del Cambio (4 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `loadGestionCambioData(companyName)` | `gestion-cambio-load-data` | `companyName: string` | `{ success, data? }` | Cargar datos de gestión del cambio |
| `saveGestionCambioData(companyName, changeData)` | `gestion-cambio-save-data` | `companyName: string`, `changeData: object` | `{ success, error? }` | Guardar datos de gestión del cambio |
| `generateGestionCambioId(companyName)` | `gestion-cambio-generate-id` | `companyName: string` | `{ success, id? }` | Generar ID secuencial de cambio |
| `updateGestionCambioEstado(companyName, id, estado, extra)` | `gestion-cambio-update-estado` | `companyName: string`, `changeId: string`, `nuevoEstado: string`, `extraData?: object` | `{ success, error? }` | Actualizar estado de gestión del cambio |

**Estructura de `changeData`:**
```javascript
{
  id: string,
  descripcion: string,
  tipo: string,
  fechaSolicitud: string,
  solicitante: string,
  estado: 'Pendiente' | 'En Proceso' | 'Implementado' | 'Rechazado',
  impacto: string,
  justificacion: string
}
```

---

### 2.35 Indicadores — Frecuencia de la Accidentalidad (4 contratos)

Accesos vía namespace `frecuenciaAccidentalidad.*`:

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `frecuenciaAccidentalidad.configurarRutas(company, year)` | `frecuencia-accidentalidad:configurar-rutas` | `companyName: string`, `year: number` | `{ success, error? }` | Configurar rutas del indicador |
| `frecuenciaAccidentalidad.leerIndicadores()` | `frecuencia-accidentalidad:leer-indicadores` | - | `{ success, data? }` | Leer valores del indicador |
| `frecuenciaAccidentalidad.leerCaracterizacion()` | `frecuencia-accidentalidad:leer-caracterizacion` | - | `{ success, data? }` | Leer datos de caracterización |
| `frecuenciaAccidentalidad.escribirEnExcel(mes, campos)` | `frecuencia-accidentalidad:escribir-excel` | `mes: number`, `campos: object` | `{ success, error? }` | Escribir datos del mes en Excel |

---

### 2.36 Indicadores — Severidad de la Accidentalidad (3 contratos)

Accesos vía namespace `severidadAccidentalidad.*`:

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `severidadAccidentalidad.configurarRutas(company, year)` | `severidad-accidentalidad:configurar-rutas` | `companyName: string`, `year: number` | `{ success, error? }` | Configurar rutas del indicador |
| `severidadAccidentalidad.leerIndicadores()` | `severidad-accidentalidad:leer-indicadores` | - | `{ success, data? }` | Leer valores del indicador |
| `severidadAccidentalidad.escribirEnExcel(mes, campos)` | `severidad-accidentalidad:escribir-excel` | `mes: number`, `campos: object` | `{ success, error? }` | Escribir datos del mes en Excel |

---

### 2.37 Indicadores — Índice de Mortalidad (3 contratos)

Accesos vía namespace `mortalidad.*`:

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `mortalidad.configurarRutas(company, year)` | `mortalidad:configurar-rutas` | `companyName: string`, `year: number` | `{ success, error? }` | Configurar rutas del indicador |
| `mortalidad.leerIndicadores()` | `mortalidad:leer-indicadores` | - | `{ success, data? }` | Leer valores del indicador |
| `mortalidad.escribirExcel(mes, campos)` | `mortalidad:escribir-excel` | `mes: number`, `campos: object` | `{ success, error? }` | Escribir datos del mes en Excel |

---

### 2.38 Indicadores — Archivos y Duplicación (2 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getIndicadoresFiles({ companyName, submodule })` | `get-indicadores-files` | `{ companyName: string, submodule: string }` | `{ success, data? }` | Listar archivos de indicadores por submódulo |
| `duplicateIndicadoresFile({ currentFilePath, newYear })` | `duplicate-indicadores-file` | `{ currentFilePath: string, newYear: number }` | `{ success, newPath? }` | Duplicar archivo de indicadores para nuevo año |

---

### 2.39 Inspecciones Sistemáticas (17 contratos)

Accesos vía namespace `inspecciones.*`:

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `inspecciones.getStats(companyName)` | `inspecciones:get-stats` | `companyName: string` | `{ success, data? }` | Estadísticas de inspecciones |
| `inspecciones.getSchedule(companyName, year)` | `inspecciones:get-schedule` | `companyName: string`, `year: number` | `{ success, data? }` | Cronograma de inspecciones |
| `inspecciones.updateMonth(company, actId, month, status)` | `inspecciones:update-month` | `companyName`, `activityId`, `month`, `status` | `{ success, error? }` | Actualizar estado mensual de actividad |
| `inspecciones.updateField(company, actId, field, value)` | `inspecciones:update-field` | `companyName`, `activityId`, `field`, `value` | `{ success, error? }` | Actualizar campo de actividad |
| `inspecciones.readExcel(companyName, type)` | `inspecciones:read-excel` | `companyName: string`, `type: string` | `{ success, data? }` | Leer Excel de inspecciones |
| `inspecciones.writeExcel(companyName, type, formData)` | `inspecciones:write-excel` | `companyName`, `type`, `formData` | `{ success, error? }` | Escribir en Excel de inspecciones |
| `inspecciones.writeHeader(companyName, type, headerData)` | `inspecciones:write-header` | `companyName`, `type`, `headerData` | `{ success, error? }` | Escribir encabezado en Excel |
| `inspecciones.getTemplate(companyName, type)` | `inspecciones:get-template` | `companyName: string`, `type: string` | `{ success, data? }` | Obtener plantilla de inspección |
| `inspecciones.listFiles(companyName)` | `inspecciones:list-files` | `companyName: string` | `{ success, data? }` | Listar archivos de inspecciones |
| `inspecciones.getFileMetadata(companyName, filePath)` | `inspecciones:get-file-metadata` | `companyName: string`, `filePath: string` | `{ success, data? }` | Metadatos de archivo de inspección |
| `inspecciones.listInspections(companyName, filters)` | `inspecciones:list` | `companyName: string`, `filters: object` | `{ success, data? }` | Listar inspecciones con filtros |
| `inspecciones.getInspection(companyName, id)` | `inspecciones:get` | `companyName: string`, `id: string` | `{ success, data? }` | Obtener inspección por ID |
| `inspecciones.deleteInspection(companyName, id)` | `inspecciones:delete` | `companyName: string`, `id: string` | `{ success, error? }` | Eliminar inspección |
| `inspecciones.createInspection(companyName, type, month, year)` | `inspecciones:create` | `companyName`, `type`, `month`, `year` | `{ success, data? }` | Crear nueva inspección |
| `inspecciones.listFilesByType(companyName, type)` | `inspecciones:list-by-type` | `companyName: string`, `type: string` | `{ success, data? }` | Listar archivos por tipo de inspección |
| `inspecciones.readExcelByPath(companyName, type, filePath)` | `inspecciones:read-by-path` | `companyName`, `type`, `filePath` | `{ success, data? }` | Leer Excel por ruta específica |
| `inspecciones.writeExcelByPath(companyName, type, formData, filePath)` | `inspecciones:write-by-path` | `companyName`, `type`, `formData`, `filePath` | `{ success, error? }` | Escribir Excel por ruta específica |

---

### 2.40 Mantenimiento Periódico (10 contratos)

Accesos vía namespace `mantenimiento.*`:

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `mantenimiento.read(companyName)` | `mantenimiento:read` | `companyName: string` | `{ success, data? }` | Leer datos de mantenimiento |
| `mantenimiento.save(companyName, items)` | `mantenimiento:save` | `companyName: string`, `items: array` | `{ success, error? }` | Guardar datos de mantenimiento |
| `mantenimiento.toggleMonth(company, row, month, type, value)` | `mantenimiento:toggle-month` | `companyName`, `rowIndex`, `month`, `type`, `value` | `{ success, error? }` | Alternar estado mensual (P/C/null) |
| `mantenimiento.updateField(company, row, field, value)` | `mantenimiento:update-field` | `companyName`, `rowIndex`, `field`, `value` | `{ success, error? }` | Actualizar campo de fila |
| `mantenimiento.addRow(companyName, itemData)` | `mantenimiento:add-row` | `companyName: string`, `itemData: object` | `{ success, error? }` | Agregar nueva fila de mantenimiento |
| `mantenimiento.saveEvidence(companyName, evidenceData)` | `mantenimiento:save-evidence` | `companyName: string`, `evidenceData: object` | `{ success, error? }` | Guardar evidencia de mantenimiento |
| `mantenimiento.readEvidenceFile(company, relPath)` | `mantenimiento:read-evidence-file` | `companyName: string`, `relativePath: string` | `{ success, data? }` | Leer archivo de evidencia |
| `mantenimiento.deleteEvidence(company, relPath)` | `mantenimiento:delete-evidence` | `companyName: string`, `relativePath: string` | `{ success, error? }` | Eliminar evidencia |
| `mantenimiento.listEvidences(company, row, cat, year)` | `mantenimiento:list-evidences` | `companyName`, `rowIndex`, `category`, `year` | `{ success, data? }` | Listar evidencias de una fila |
| `mantenimiento.getStats(companyName)` | `mantenimiento:get-stats` | `companyName: string` | `{ success, data? }` | Estadísticas de mantenimiento |

**Estructura de `itemData` (fila de Plan de Trabajo):**
```javascript
{
  id: string,
  name: string,
  type: 'activity' | 'header',
  level: number,        // 1 = grupo padre
  responsible: string,
  months: array         // 12 posiciones: null | 'P' | 'C'
}
```

---

### 2.41 Matriz de Peligros — Identificación (27 contratos)

Accesos vía namespace `matrizPeligros.*`:

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `matrizPeligros.read(companyName)` | `matriz-peligros:read` | `companyName: string` | `{ success, data? }` | Leer matriz completa |
| `matrizPeligros.save(companyName, data)` | `matriz-peligros:save` | `companyName: string`, `data: object` | `{ success, error? }` | Guardar matriz completa |
| `matrizPeligros.addSede(companyName, nombre)` | `matriz-peligros:add-sede` | `companyName: string`, `nombre: string` | `{ success, data? }` | Agregar sede |
| `matrizPeligros.addProceso(companyName, sedeId, nombre)` | `matriz-peligros:add-proceso` | `companyName`, `sedeId`, `nombre` | `{ success, data? }` | Agregar proceso a sede |
| `matrizPeligros.addCargo(companyName, procesoId, nombre)` | `matriz-peligros:add-cargo` | `companyName`, `procesoId`, `nombre` | `{ success, data? }` | Agregar cargo a proceso |
| `matrizPeligros.addPeligro(companyName, cargoId, data)` | `matriz-peligros:add-peligro` | `companyName`, `cargoId`, `data` | `{ success, data? }` | Agregar peligro a cargo |
| `matrizPeligros.updatePeligro(companyName, id, cambios)` | `matriz-peligros:update-peligro` | `companyName`, `peligroId`, `cambios` | `{ success, error? }` | Actualizar peligro |
| `matrizPeligros.deletePeligro(companyName, id)` | `matriz-peligros:delete-peligro` | `companyName`, `peligroId` | `{ success, error? }` | Eliminar peligro |
| `matrizPeligros.deleteCargo(companyName, id)` | `matriz-peligros:delete-cargo` | `companyName`, `cargoId` | `{ success, error? }` | Eliminar cargo y peligros |
| `matrizPeligros.deleteProceso(companyName, id)` | `matriz-peligros:delete-proceso` | `companyName`, `procesoId` | `{ success, error? }` | Eliminar proceso y descendencia |
| `matrizPeligros.deleteSede(companyName, id)` | `matriz-peligros:delete-sede` | `companyName`, `sedeId` | `{ success, error? }` | Eliminar sede y descendencia |
| `matrizPeligros.renameSede(companyName, id, nombre)` | `matriz-peligros:rename-sede` | `companyName`, `sedeId`, `nombre` | `{ success, error? }` | Renombrar sede |
| `matrizPeligros.renameProceso(companyName, id, nombre)` | `matriz-peligros:rename-proceso` | `companyName`, `procesoId`, `nombre` | `{ success, error? }` | Renombrar proceso |
| `matrizPeligros.renameCargo(companyName, id, nombre)` | `matriz-peligros:rename-cargo` | `companyName`, `cargoId`, `nombre` | `{ success, error? }` | Renombrar cargo |
| `matrizPeligros.updateCargo(companyName, id, cambios)` | `matriz-peligros:update-cargo` | `companyName`, `cargoId`, `cambios` | `{ success, error? }` | Actualizar datos de cargo |
| `matrizPeligros.stats(companyName)` | `matriz-peligros:stats` | `companyName: string` | `{ success, data? }` | Estadísticas de la matriz |
| `matrizPeligros.heatmap(companyName)` | `matriz-peligros:heatmap` | `companyName: string` | `{ success, data? }` | Datos para mapa de calor |
| `matrizPeligros.priorizacion(companyName)` | `matriz-peligros:priorizacion` | `companyName: string` | `{ success, data? }` | Datos de priorización |
| `matrizPeligros.metadata(companyName)` | `matriz-peligros:metadata` | `companyName: string` | `{ success, data? }` | Metadatos de la matriz |
| `matrizPeligros.updateMetadata(companyName, metadata)` | `matriz-peligros:update-metadata` | `companyName`, `metadata` | `{ success, error? }` | Actualizar metadatos |
| `matrizPeligros.notasAnaliticas(companyName)` | `matriz-peligros:notas-analiticas` | `companyName: string` | `{ success, data? }` | Notas analíticas de peligros |
| `matrizPeligros.gtc45Options()` | `matriz-peligros:gtc45-options` | - | `{ success, data? }` | Opciones GTC-45 (clasificación peligros) |
| `matrizPeligros.discoverXlsx(companyName)` | `matriz-peligros:discover-xlsx` | `companyName: string` | `{ success, data? }` | Descubrir archivos XLSX de matriz |
| `matrizPeligros.importXlsx(companyName, filePath)` | `matriz-peligros:import-xlsx` | `companyName`, `filePath` | `{ success, data? }` | Importar matriz desde XLSX |
| `matrizPeligros.syncXlsx(companyName)` | `matriz-peligros:sync-xlsx` | `companyName: string` | `{ success, data? }` | Sincronizar JSON con XLSX |

**Estructura jerárquica de datos:**
```
Sede → Proceso → Cargo → Peligro
(sedeId) (procesoId) (cargoId) (peligroId)
```

**Estructura de `data` en `addPeligro`:**
```javascript
{
  peligro: string,
  riesgo: string,
  fuente: string,
  efectoPosible: string,
  medidaControl: string,
  probabilidad: 'Baja' | 'Media' | 'Alta',
  severidad: 'Baja' | 'Media' | 'Alta',
  nivelRiesgo: string,
  categoriaGTC45: string
}
```

---

### 2.42 Auto-Update — Eventos del Sistema (7 contratos)

Eventos vía `ipcRenderer.on()` (listeners, NO invoke):

| Método Frontend | Canal | Dirección | Retorno | Descripción |
|-----------------|-------|-----------|---------|-------------|
| `onUpdateAvailable(callback)` | `update_available` | Main → Renderer | `{ version, releaseNotes }` | Actualización disponible |
| `onUpdateDownloaded(callback)` | `update_downloaded` | Main → Renderer | `{ version }` | Actualización descargada |
| `onUpdateChecking(callback)` | `update_checking` | Main → Renderer | - | Verificando actualizaciones |
| `onUpdateNotAvailable(callback)` | `update_not_available` | Main → Renderer | - | No hay actualizaciones |
| `onUpdateProgress(callback)` | `update_progress` | Main → Renderer | `{ percent }` | Progreso de descarga |
| `onUpdateError(callback)` | `update_error` | Main → Renderer | `{ error }` | Error en actualización |
| `restartApp()` | `restart_app` | Renderer → Main (send) | - | Reiniciar app para actualizar |

---

### 2.43 IPC Genérico — Send/On (3 contratos)

| Método Frontend | Canal | Dirección | Retorno | Descripción |
|-----------------|-------|-----------|---------|-------------|
| `send(channel, data)` | Genérico | Renderer → Main | - | Enviar mensaje IPC genérico |
| `onIpcMessage(channel, listener)` | Genérico | Main → Renderer | `...args` | Escuchar mensaje IPC genérico |
| `removeIpcMessageListener(channel, listener)` | Genérico | - | - | Remover listener IPC genérico |

---

### 2.44 Capacitaciones — Watchers (2 contratos on)

| Canal | Dirección | Descripción |
|-------|-----------|-------------|
| `start-watching-capacitaciones` | Renderer → Main | Iniciar watcher de archivos de capacitaciones |
| `stop-watching-capacitaciones` | Renderer → Main | Detener watcher de capacitaciones |

---

### 2.45 Loading System (1 contrato on)

| Canal | Dirección | Descripción |
|-------|-----------|-------------|
| `loading-complete` | Renderer → Main | Señal de carga completa del renderer |

---

## 3. Patrones de Error

### 3.1 Formato Estándar de Error

Todos los errores deben seguir este formato:

```javascript
{
  success: false,
  error: {
    code: string,      // Código de error único (ej: 'FILE_NOT_FOUND')
    message: string    // Mensaje descriptivo en español
  }
}
```

### 3.2 Códigos de Error Comunes

| Código | Descripción | Acción Recomendada |
|--------|-------------|-------------------|
| `FILE_NOT_FOUND` | Archivo no existe | Verificar ruta |
| `INVALID_FORMAT` | Formato de archivo inválido | Verificar extensión |
| `PERMISSION_DENIED` | Sin permisos de lectura/escritura | Ejecutar como administrador |
| `PYTHON_NOT_FOUND` | Python no instalado | Instalar Python 3.10+ |
| `EXCEL_LOCKED` | Excel abierto en otro proceso | Cerrar Excel y reintentar |
| `INVALID_DATA` | Datos inválidos | Validar estructura de datos |
| `NETWORK_ERROR` | Error de red (servidor LLM) | Verificar conexión |

### 3.3 Manejo de Errores en Frontend

```javascript
// Frontend - Manejo adecuado de errores
try {
  const result = await window.electronAPI.procesarAusentismo(formData);
  
  if (!result.success) {
    console.error(`Error ${result.error.code}: ${result.error.message}`);
    
    // Mostrar mensaje al usuario
    alert(result.error.message);
    return;
  }
  
  // Procesar resultado exitoso
  console.log('Éxito:', result.data);
  
} catch (error) {
  // Error no controlado (crash)
  console.error('Error crítico:', error);
  alert('Ocurrió un error inesperado. Por favor reintente.');
}
```

---

## 4. Ejemplos de Uso

### 4.1 Flujo Completo: Registro de Incapacidad

```javascript
// Frontend - renderer.js o modulo correspondiente

async function registrarIncapacidad(formData) {
  try {
    // 1. Buscar empleado por cédula
    const empleado = await window.electronAPI.buscarEmpleadoPorCedula(
      formData.cedula,
      formData.empresa
    );
    
    if (!empleado.success) {
      throw new Error('Empleado no encontrado');
    }
    
    // 2. Buscar código CIE-10
    const cie10 = await window.electronAPI.buscarCie10Descripcion(
      formData.codigoCie10
    );
    
    // 3. Procesar incapacidad
    const resultado = await window.electronAPI.procesarAusentismo({
      ...formData,
      ...empleado.data,
      descripcionDiagnostico: cie10.descripcion
    });
    
    if (!resultado.success) {
      throw new Error(resultado.error.message);
    }
    
    // 4. Mostrar confirmación
    alert('Incapacidad registrada exitosamente');
    
    return resultado.data;
    
  } catch (error) {
    console.error('Error registrando incapacidad:', error);
    throw error;
  }
}
```

### 4.2 Flujo Completo: Investigación de Accidente con IA

```javascript
// Frontend - modulo-investigacion-accidentes.js

async function investigarAccidente() {
  try {
    // 1. Seleccionar PDF
    const pdfSelect = await window.electronAPI.selectAccidentPdf();
    if (!pdfSelect.success) return;
    
    // 2. Extraer datos del PDF
    const extracted = await window.electronAPI.processAccidentPdf(
      pdfSelect.filePath
    );
    
    // 3. Analizar con LLM
    const analysis = await window.electronAPI.analyzeAccident({
      texto_accidente: extracted.data.descripcion,
      empresa: extracted.data.empresa,
      trabajador: extracted.data.trabajador,
      fecha: extracted.data.fecha,
      cargo: extracted.data.cargo
    });
    
    // 4. Mostrar análisis al usuario
    mostrarAnalisis(analysis.analysis);
    
    // 5. Generar informe cuando usuario confirme
    const reportPath = await window.electronAPI.generateAccidentReport({
      ...extracted.data,
      analysis: analysis.analysis
    });
    
    // 6. Abrir informe
    await window.electronAPI.openPath(reportPath);
    
  } catch (error) {
    console.error('Error en investigación:', error);
    alert('Error investigando accidente: ' + error.message);
  }
}
```

### 4.3 Flujo Completo: Seguimiento PRIC

```javascript
// Frontend - medicion-ausentismo.js

async function guardarSeguimientoPRIC(data, empresa) {
  try {
    // 1. Validar datos mínimos
    if (!data.trabajador?.cedula || !data.incapacidad?.fechaFin) {
      throw new Error('Datos incompletos');
    }
    
    // 2. Guardar seguimiento
    const resultado = await window.electronAPI.saveFollowUp(data, empresa);
    
    if (!resultado.success) {
      throw new Error(resultado.error?.message || 'Error guardando seguimiento');
    }
    
    // 3. Mostrar confirmación
    alert('Seguimiento guardado exitosamente');
    
    // 4. Recargar lista de casos
    await cargarCasosPRI();
    
    return true;
    
  } catch (error) {
    console.error('Error guardando seguimiento:', error);
    alert('Error: ' + error.message);
    return false;
  }
}
```

---

## 5. Versionamiento de Contratos

### 5.1 Cuándo Versionar

| Escenario | Acción |
|-----------|--------|
| Agregar campo opcional | ✅ NO versionar (backward compatible) |
| Cambiar tipo de dato | 🔴 Versionar (breaking change) |
| Renombrar campo | 🔴 Versionar (breaking change) |
| Cambiar estructura de retorno | 🔴 Versionar (breaking change) |
| Agregar nuevo handler | ✅ NO versionar (nueva funcionalidad) |

### 5.2 Convención de Nombres

```javascript
// ✅ Correcto - Versión explícita
window.electronAPI.getPresupuesto()      // Versión original
window.electronAPI.getPresupuestoV2()    // Nueva versión con cambios

// ❌ Incorrecto - Cambiar sin versionar
window.electronAPI.getPresupuesto()      // Antes retornaba { data }
window.electronAPI.getPresupuesto()      // Ahora retorna { success, data, error }
                                         // ¡ROMPE frontend existente!
```

### 5.3 Ejemplo de Migración

```javascript
// Backend - main.js

// Versión 1 (mantener para compatibilidad)
ipcMain.handle('get-presupuesto', async (event, company) => {
  const data = await leerPresupuesto(company);
  return { data };  // Formato antiguo
});

// Versión 2 (nuevo contrato)
ipcMain.handle('get-presupuesto-v2', async (event, company) => {
  try {
    const data = await leerPresupuesto(company);
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: { code: 'READ_ERROR', message: error.message } 
    };
  }
});

// Frontend - preload.js
module.exports = {
  // Versión 1 (mantener)
  getPresupuesto: (company) => ipcRenderer.invoke('get-presupuesto', company),
  
  // Versión 2 (nuevo)
  getPresupuestoV2: (company) => ipcRenderer.invoke('get-presupuesto-v2', company)
};
```

---

## 6. Auditoría de Contratos

### 6.1 Verificación de Consistencia

Ejecutar periódicamente:

```bash
# Verificar que todos los handlers estén implementados
node scripts/verify-ipc-handlers.js

# Verificar que preload.js exponga todos los handlers
node scripts/verify-preload-exposure.js
```

### 6.2 Métricas

| Métrica | Valor | Estado |
|---------|-------|--------|
| Total handlers IPC | 55+ | ✅ |
| Total handlers IPC | 137 | ✅ |
| Total contratos preload | 137 | ✅ |
| Handlers documentados | 137/137 (100%) | ✅ |
| Contratos versionados | 2 | ✅ |

---

**Mantenido por:** Backend Architect
**Última actualización:** 9 de junio de 2026
**Versión:** 4.0 (v0.1.99) — 137/137 documentados

**Próxima revisión:** Al agregar o modificar handlers IPC

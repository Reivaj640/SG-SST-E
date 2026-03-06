# 📡 Contratos IPC K+AIR

**Versión:** 1.0  
**Actualizado:** 6 de marzo de 2026  
**Estado:** ✅ CRÍTICO - NO TOCAR SIN VERSIONAR

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
2. [Contratos por Categoría](#2-contratos-por-categoría)
3. [Patrones de Error](#3-patrones-de-error)
4. [Ejemplos de Uso](#4-ejemplos-de-uso)

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
| `preload.js` | ~224 | Expone 60+ contratos vía `contextBridge` |
| `main.js` | 4766 | Implementa 55+ handlers con `ipcMain.handle` |

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

### 2.2 Sistema de Temas (5 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getSystemTheme()` | `get-system-theme` | - | `'light' \| 'dark'` | Tema del sistema operativo |
| `saveThemePreference(theme)` | `save-theme-preference` | `theme: string` | `{ success }` | Guardar preferencia de tema |
| `getThemePreference()` | `get-theme-preference` | - | `string \| null` | Preferencia guardada |
| `getEffectiveTheme()` | `get-effective-theme` | - | `'light' \| 'dark'` | Tema efectivo (sistema o preferencia) |
| `onSystemThemeChanged(cb)` | `system-theme-changed` | `callback: function` | `() => void` (unsubscribe) | Listener de cambios de tema |

---

### 2.3 Archivos y Directorios (6 contratos)

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

### 2.4 Ausentismo (4 contratos) 🔴 CRÍTICO

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

### 2.5 Investigación de Accidentes 🤖 (6 contratos)

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

### 2.6 Presupuesto (5 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getPresupuestoFiles(company)` | `getPresupuestoFiles` | `company: string` | `{ success, files }` | Obtener archivos de presupuesto |
| `readPresupuestoData(path)` | `readPresupuestoData` | `path: string` | `{ success, data }` | Leer datos de presupuesto |
| `saveBudgetFile(path, data)` | `saveBudgetFile` | `path: string`, `data: object` | `{ success, error? }` | Guardar archivo de presupuesto |
| `openBudgetWindow(file)` | `open-budget-window` | `file: object` | `{ success }` | Abrir ventana de presupuesto |
| `duplicateBudgetFile(params)` | `duplicate-budget-file` | `params: object` | `{ success, newPath? }` | Duplicar archivo de presupuesto |

---

### 2.7 Capacitaciones (6 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getCapacitacionesSheets(path)` | `get-capacitaciones-sheets` | `path: string` | `{ success, sheets }` | Obtener hojas de Excel |
| `initExcel(data)` | `init-excel` | `data: object` | `{ success }` | Inicializar Excel |
| `updateCapacitacionesExcel(data)` | `update-capacitaciones-excel` | `data: object` | `{ success }` | Actualizar Excel de capacitaciones |
| `duplicateCapacitacionesSheet(args)` | `duplicate-capacitaciones-sheet` | `args: object` | `{ success }` | Duplicar hoja de capacitaciones |
| `updateExcelCell(data)` | `update-excel-cell` | `data: object` | `{ success }` | Actualizar celda específica |
| `convertExcelToPdf(path)` | `convertExcelToPdf` | `path: string` | `{ success, pdfPath? }` | Convertir Excel a PDF |

---

### 2.8 OnlyOffice (2 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `openOnlyOfficeEditor(payload)` | `open-onlyoffice-editor` | `payload: object` | `{ success, error? }` | Abrir editor OnlyOffice |
| `generateOnlyOfficeConfig(payload)` | `generate-onlyoffice-config` | `payload: object` | `{ success, config }` | Generar configuración OnlyOffice |

---

### 2.9 Documentos (7 contratos)

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

### 2.10 Actas (4 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getActaData()` | `get-acta-data` | - | `{ success, data }` | Datos para acta COPASST |
| `getConvivenciaActaData()` | `getConvivenciaActaData` | - | `{ success, data }` | Datos para acta de convivencia |
| `generateCopasstActa(changes)` | `generate-copasst-acta` | `changes: object` | `{ success, actaPath }` | Generar acta COPASST DOCX |
| `generateConvivenciaActa(changes)` | `generate-convivencia-acta` | `changes: object` | `{ success, actaPath }` | Generar acta de convivencia DOCX |

---

### 2.11 Remisiones (6 contratos)

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

### 2.12 Seguimiento de Incapacidades (5 contratos) 🔴 CRÍTICO

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

### 2.13 Objetivos SST (3 contratos)

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `getObjetivosExcelPath(company)` | `get-objetivos-excel-path` | `company: string` | `{ success, path }` | Obtener ruta de Excel de objetivos |
| `loadObjetivosExcelData(path)` | `load-objetivos-excel-data` | `path: string` | `{ success, data }` | Cargar datos de Excel |
| `saveObjetivosExcelData(path, data)` | `save-objetivos-excel-data` | `path: string`, `data: object` | `{ success, error? }` | Guardar datos en Excel |

---

### 2.14 Inducciones 🆕 (1 contrato)

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
| Total contratos preload | 60+ | ✅ |
| Handlers documentados | 100% | ✅ |
| Contratos versionados | 2 | ✅ |

---

**Mantenido por:** Backend Architect  
**Última actualización:** 6 de marzo de 2026  
**Versión:** 0.1.70

**Próxima revisión:** Al agregar o modificar handlers IPC

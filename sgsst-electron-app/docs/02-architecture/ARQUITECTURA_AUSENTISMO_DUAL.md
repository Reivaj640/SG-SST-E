# 📊 Arquitectura Dual de Archivos - Módulo de Ausentismo

**Versión:** 0.1.99
**Fecha de actualización:** 9 de junio de 2026
**Autor:** Javier Robles F. Prof. SG-SST - Esp. Gerencia de Proyectos

---

## 📋 Descripción General

El módulo de **Medición del Ausentismo** utiliza un **sistema dual de archivos Excel** para separar la gestión general de incapacidades del seguimiento detallado de casos individuales.

### 🎯 Propósito del Sistema Dual

| Archivo | Propósito | Tipo de Datos |
|---------|-----------|---------------|
| **PI-FO-076 / PG-FO-076 / GI-FO-076** | Registro y consulta general | Lista maestra de todas las incapacidades |
| **PRI.xlsx** | Seguimiento detallado de casos | Casos en seguimiento activo, recomendaciones y datos de salud |

### 🆕 Novedades Versión 0.1.50

- **Alertas de Registros Existentes**: Modal interactivo al detectar duplicados
- **Cálculos Automáticos**: Edad, IMC, Estado Nutricional, Días Trabajados
- **KPIs en Tiempo Real**: Actualización dinámica con filtros
- **Columnas Específicas**: Organización estructurada en PRI.xlsx (C-AA)

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                    Módulo de Ausentismo                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  PI-FO-076 (o PG-FO-076 / GI-FO-076)                     │   │
│  │  ─────────────────────────────────────────────────────   │   │
│  │  • Registro de TODAS las incapacidades                   │   │
│  │  • Datos generales de empleados                          │   │
│  │  • Diagnósticos CIE-10                                   │   │
│  │  • Días de incapacidad                                   │   │
│  │  • EPS/ARL                                               │   │
│  │                                                           │   │
│  │  Usado por:                                              │   │
│  │  ✅ Registrar Ausentismo                                 │   │
│  │  ✅ Ver Ausentismo                                       │   │
│  │  ✅ Seguimiento de Incapacidades (lista principal)       │   │
│  │  ✅ Estadísticas                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  PRI.xlsx                                                 │   │
│  │  ─────────────────────────────────────────────────────    │   │
│  │  • Solo casos en seguimiento activo                       │   │
│  │  • Etapas PRIC (Programa de Rehabilitación)              │   │
│  │  • Recomendaciones médico-laborales                      │   │
│  │  • Calificación de pérdida de capacidad laboral          │   │
│  │  • Seguimiento de recomendaciones                        │   │
│  │                                                           │   │
│  │  Usado por:                                              │   │
│  │  ✅ Abrir Seguimiento (detalle de caso individual)       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura de Archivos por Empresa

### **ASEPLUS**
```
G:\Mi unidad\2. Trabajo\1. SG-SST\2. Temporales Comfa\3. Aseplus\
  3. Gestión de la Salud\
    3.3.6 Medición del ausentismo por causa médica\
      ├── PI-FO-076 AUSENTISMO POR ARL Y EPS (ASEPLUS).XLSX  ← Ausentismo general
      ├── PRI.xlsx                                            ← Seguimiento de casos
      └── PG-FO-067 CONSOLIDADO DE EXAMENES OCUPACIONALES.xls
```

### **TEMPOACTIVA**
```
G:\Mi unidad\2. Trabajo\1. SG-SST\2. Temporales Comfa\1. Tempoactiva Est SAS\
  3. Gestión de la Salud\
    3.3.6 Medición del ausentismo por causa médica\
      └── GI-FO-076 AUSENTISMO POR ARL Y EPS 2024.xlsx  ← Ausentismo general
```

### **TEMPOSUM**
```
G:\Mi unidad\2. Trabajo\1. SG-SST\2. Temporales Comfa\2. Temposum Est SAS\
  3. Gestión de la Salud\
    3.3.6 Medición del ausentismo por causa médica\
      └── 3 AUSENTISMO POR ARL Y EPS (TEMPOSUM) 2024.XLSX  ← Ausentismo general
```

---

## 🔧 Handlers IPC Implementados

### **1. `get-ausentismo-data` (EXISTENTE - MODIFICADO)**

**Propósito:** Leer datos del archivo de ausentismo general (PI-FO-076 / PG-FO-076 / GI-FO-076)

**Ubicación:** `main.js` línea ~2944

**Contrato en preload.js:**
```javascript
readAusentismoData: (companyName) =>
  ipcRenderer.invoke('get-ausentismo-data', companyName)
```

**Uso en Frontend:**
```javascript
// Para: Ver Ausentismo, Registrar Ausentismo, Estadísticas, Lista de Seguimiento
const result = await window.electronAPI.readAusentismoData('Aseplus');

// Resultado:
{
  success: true,
  headers: ['No', 'EMPRESA', 'NOMBRE', 'CEDULA', 'CARGO', ...],
  rows: [...],  // 610 registros para Aseplus
  filePath: 'G:\\...\\PI-FO-076 AUSENTISMO POR ARL Y EPS (ASEPLUS).XLSX',
  companyName: 'Aseplus'
}
```

**Lógica de Selección de Archivo:**
```javascript
// 1. Buscar específicamente PI-FO-076, PG-FO-076 o GI-FO-076
const ausentismoGeneralFile = excelFiles.find(
  f => f.name && (
    f.name.toUpperCase().includes('PI-FO-076') ||
    f.name.toUpperCase().includes('PG-FO-076') ||
    f.name.toUpperCase().includes('GI-FO-076')
  )
);

// 2. Si no encuentra, usar el primer .xlsx que NO sea PRI.xlsx
const excelFile = ausentismoGeneralFile || 
                  excelFiles.find(f => !f.name.toUpperCase().includes('PRI')) || 
                  excelFiles[0];
```

---

### **2. `get-pri-seguimiento-data` (NUEVO - v0.1.49)**

**Propósito:** Leer datos del archivo PRI.xlsx, hoja "Casos en seguimiento"

**Ubicación:** `main.js` línea ~3251

**Contrato en preload.js:**
```javascript
getPriSeguimientoData: (companyName) =>
  ipcRenderer.invoke('get-pri-seguimiento-data', companyName)
```

**Uso en Frontend:**
```javascript
// Para: Abrir Seguimiento (detalle de caso individual)
const result = await window.electronAPI.getPriSeguimientoData('Aseplus');

// Resultado:
{
  success: true,
  headers: ['Identificación', 'Nombre', 'Cargo', 'Fecha Inicio', ...],
  rows: [...],  // Casos en seguimiento
  filePath: 'G:\\...\\PRI.xlsx',
  sheetName: 'Casos en seguimiento',
  companyName: 'Aseplus'
}
```

**Lógica de Selección de Hoja:**
```javascript
// Buscar la hoja "Casos en seguimiento"
const sheetName = workbook.SheetNames.find(name => 
  name.toLowerCase().includes('casos en seguimiento') ||
  name.toLowerCase().includes('casos') ||
  name.toLowerCase().includes('seguimiento')
);
```

**Detección de Encabezados:**
```javascript
// El PRI tiene estructura diferente - buscar fila con encabezados
let headerRowIndex = -1;
for (let i = 0; i < Math.min(20, allData.length); i++) {
  const row = allData[i];
  if (row && row.some(cell => 
    cell && (
      cell.toString().toLowerCase().includes('identificación') ||
      cell.toString().toLowerCase().includes('nombre') ||
      cell.toString().toLowerCase().includes('cedula')
    )
  )) {
    headerRowIndex = i;
    break;
  }
}
```

---

## 📊 Flujo de Datos por Sección

### **1. Registrar Ausentismo**
```
┌─────────────────────┐
│  Formulario de      │
│  Registro           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  readAusentismoData │  ← Lee PI-FO-076 para verificar datos existentes
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  procesarAusentismo │  ← Escribe nueva incapacidad en PI-FO-076
└─────────────────────┘
```

### **2. Ver Ausentismo**
```
┌─────────────────────┐
│  Tabla de           │
│  Ausentismo         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  readAusentismoData │  ← Lee PI-FO-076
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Renderizar tabla   │  ← Muestra todas las incapacidades
└─────────────────────┘
```

### **3. Seguimiento de Incapacidades (Lista Principal)**
```
┌─────────────────────┐
│  Lista de           │
│  Incapacidades      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  readAusentismoData │  ← Lee PI-FO-076
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Filtrar casos      │  ← Aplica filtros PRIC (≥10 días, gaps, etc.)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Renderizar tabla   │  ← Muestra casos que requieren seguimiento
└─────────────────────┘
```

### **4. Abrir Seguimiento (Detalle de Caso Individual)**
```
┌─────────────────────┐
│  Click en "Abrir    │
│  Seguimiento"       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────┐
│  getPriSeguimientoData  │  ← Lee PRI.xlsx, hoja "Casos en seguimiento"
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────┐
│  Modal de           │  ← Muestra formulario de seguimiento detallado
│  Seguimiento        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  saveFollowUp       │  ← Escribe en PRI.xlsx
└─────────────────────┘
```

### **5. Estadísticas**
```
┌─────────────────────┐
│  Dashboard de       │
│  Estadísticas       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  readAusentismoData │  ← Lee PI-FO-076
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Calcular KPIs      │  ← Índices de ausentismo, tendencias, etc.
└─────────────────────┘
```

---

## 🔍 Logs de Depuración

### **Cuando se llama `get-ausentismo-data`:**
```log
========================================
[AUSENTISMO][MAIN] Handler get-ausentismo-data llamado para empresa: Aseplus
[AUSENTISMO][MAIN] === ARCHIVOS EN LA CARPETA DE AUSENTISMO ===
[AUSENTISMO][MAIN] Total de archivos encontrados: 3
  [0] PI-FO-076 AUSENTISMO POR ARL Y EPS (ASEPLUS).XLSX (ext: .XLSX)
  [1] PRI.xlsx (ext: .xlsx)
  [2] ~$PRI.xlsx (ext: .xlsx)
[AUSENTISMO][MAIN] ============================================
[AUSENTISMO][MAIN] Archivos .xlsx encontrados: 3
[AUSENTISMO][MAIN] Archivo SELECCIONADO: PI-FO-076 AUSENTISMO POR ARL Y EPS (ASEPLUS).XLSX
[AUSENTISMO][MAIN] ¿Es archivo de ausentismo general (PI/PG/GI-FO-076)?: ✅ SÍ
[AUSENTISMO][MAIN] Ruta completa: G:\...\PI-FO-076 AUSENTISMO POR ARL Y EPS (ASEPLUS).XLSX
```

### **Cuando se llama `get-pri-seguimiento-data`:**
```log
========================================
[PRI][MAIN] Handler get-pri-seguimiento-data llamado para empresa: Aseplus
[PRI][MAIN] ✅ Archivo PRI.xlsx encontrado: G:\...\PRI.xlsx
[PRI][MAIN] Nombres de hojas en PRI.xlsx: [
  'Introducción',
  'Instructivo',
  'Casos en seguimiento',  ← Hoja seleccionada
  'Seguimiento a recomendaciones',
  ...
]
[PRI][MAIN] Hoja seleccionada: Casos en seguimiento
[PRI][MAIN] Total de filas leídas: XXX
[PRI][MAIN] Datos del PRI listos para enviar:
  - Éxito: true
  - Encabezados: XX columnas
  - Filas: XX registros
  - Archivo: G:\...\PRI.xlsx
  - Hoja: Casos en seguimiento
========================================
```

---

## 📝 Consideraciones Importantes

### **1. Nomenclatura de Archivos**

| Empresa | Prefijo | Código Completo |
|---------|---------|-----------------|
| **Aseplus** | PI | PI-FO-076 |
| **Temposum** | PG | PG-FO-076 |
| **Tempoactiva** | GI | GI-FO-076 |
| **Asel** | A | A-FR-31 |

**Nota:** El prefijo indica el tipo de documento:
- **PI** = Procedimiento Interno
- **PG** = Procedimiento de Gestión
- **GI** = Gestión Integral
- **A** = Anexo

### **2. Archivos Temporales de Excel**

Los archivos que comienzan con `~$` son archivos temporales de Excel y **NO deben usarse**:
```
PRI.xlsx         ← ✅ Archivo real
~$PRI.xlsx       ← ❌ Archivo temporal (ignorar)
```

### **3. Estructura del PRI.xlsx**

El archivo PRI.xlsx tiene múltiples hojas:
```
1. Introducción              ← Texto introductorio
2. Instructivo               ← Instrucciones de uso
3. Epidemiología Riesgo      ← Estadísticas
4. Diagnóstico PHVA          ← Diagnóstico
5. Resultados                ← Resultados
6. Plan de trabajo y gestión ← Planes
7. Casos en seguimiento      ← ✅ HOJA PRINCIPAL PARA SEGUIMIENTO
8. Seguimiento a recomendaciones ← Recomendaciones
9. ETAPA                     ← Etapas PRIC
10. CIE10 2021               ← Códigos CIE-10
11. Listas                   ← Listas desplegables
```

### **4. Sincronización de Datos**

**Importante:** Los datos entre PI-FO-076 y PRI.xlsx **NO están sincronizados automáticamente**.

- **PI-FO-076** es la **fuente de verdad** para el registro de incapacidades
- **PRI.xlsx** es la **herramienta de seguimiento** para casos activos

Cuando un caso se marca como "cerrado" en PRI.xlsx, **NO se actualiza automáticamente** en PI-FO-076.

---

## 🚀 Próximos Pasos (Pendientes)

### **Frontend**
- [x] Actualizar `seguimiento-incapacidades.html` para usar `getPriSeguimientoData` cuando se abra el seguimiento de un caso individual
- [x] Implementar formulario de seguimiento detallado (Etapas PRIC, Recomendaciones, Calificación PCL)
- [x] Agregar botón "Guardar Seguimiento" que escriba en PRI.xlsx

### **Backend**
- [x] Implementar handler `save-follow-up` para escribir en PRI.xlsx (`saveFollowUp` — 9 IPC handlers PRI)
- [x] Validar que los datos escritos en PRI.xlsx mantengan la integridad del archivo

---

## 📚 Referencias

- **Resolución 0312 de 2019** - Estándares Mínimos del SG-SST
- **Resolución 3050 de 2022** - Programa de Rehabilitación Integral
- **Decreto 1607 de 2008** - Tabla de valoración de pérdida de capacidad laboral

---

## 📞 Contacto

**Autor:** Javier Robles F.  
**Cargo:** Prof. SG-SST - Esp. Gerencia de Proyectos  
**Email:** [correo@empresa.com](mailto:correo@empresa.com)

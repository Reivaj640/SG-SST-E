# 🏥 Módulo 3: Gestión de la Salud

**Versión:** 1.0  
**Actualizado:** 6 de marzo de 2026  
**Estado:** ✅ Actualizado

---

## 📋 Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [3.1.1 Diagnóstico Sociodemográfico](#311-diagnóstico-sociodemográfico)
3. [3.1.4 Evaluaciones Médicas](#314-evaluaciones-médicas)
4. [3.1.6 Restricciones Médicas](#316-restricciones-médicas)
5. [3.2.1 Reporte de Accidentes](#321-reporte-de-accidentes)
6. [3.2.2 Investigación de Accidentes con IA 🤖](#322-investigación-de-accidentes-con-ia)
7. [3.3.6 Medición del Ausentismo](#336-medición-del-ausentismo)

---

## 1. Visión General

### 1.1 Propósito del Módulo

El módulo de **Gestión de la Salud** agrupa todos los componentes relacionados con la salud ocupacional de los trabajadores, incluyendo:

- Diagnóstico sociodemográfico
- Evaluaciones médicas ocupacionales
- Restricciones y recomendaciones médicas
- Reporte e investigación de accidentes
- Medición del ausentismo

### 1.2 Submódulos

| Código | Submódulo | Archivos Principales | Estado |
|--------|-----------|---------------------|--------|
| 3.1.1 | Diagnóstico Sociodemográfico | `sociodemografica-component.js` | ✅ |
| 3.1.4 | Evaluaciones Médicas | `evaluaciones-medicas-logic.js` | ✅ |
| 3.1.6 | Restricciones Médicas | `restricciones-medicas-logic.js` | ✅ |
| 3.2.1 | Reporte de Accidentes | `reportes-accidentes-logic.js` | ✅ |
| 3.2.2 | Investigación de Accidentes | `investigacion-accidentes-logic.js` 🤖 | ✅ |
| 3.3.6 | Medición del Ausentismo | `medicion-ausentismo.js` | ✅ |

### 1.3 Archivos del Módulo

```
modules/gestion-salud/
├── index.js                          # Exporta componentes
├── gestion-salud-home.js             # Home del módulo
├── gestion-salud-home.html           # HTML del home
├── gestion-salud.css                 # Estilos del módulo
├── ausentismo/
│   ├── index.js
│   ├── medicion-ausentismo.js        # ~4465 líneas
│   ├── medicion-ausentismo-home.js
│   ├── medicion-ausentismo-home.html
│   ├── registrar-ausentismo.js       # ~1200 líneas
│   ├── ver-ausentismo-logic.js
│   └── ver-ausentismo-dashboard.html
├── evaluaciones-medicas/
├── investigacion-accidentes/
├── reportes-accidentes/
├── restricciones-medicas/
└── sociodemografica/
```

---

## 3.1.1 Diagnóstico Sociodemográfico

### Descripción

Permite recopilar y analizar información sociodemográfica y de condiciones de salud de los trabajadores.

### Funcionalidades

- ✅ Registro de información personal (edad, género, estado civil)
- ✅ Información laboral (cargo, área, turno, antigüedad)
- ✅ Hábitos y estilos de vida
- ✅ Condiciones de salud crónicas
- ✅ Estadísticas y gráficos

### Archivos

- `modules/gestion-salud/sociodemografica/sociodemografica-component.js`
- `modules/gestion-salud/sociodemografica/sociodemografica-viewer.js`
- `modules/gestion-salud/sociodemografica/sociodemografica-view.html`

### Contratos IPC Relacionados

```javascript
// No tiene handlers específicos - usa handlers genéricos de Excel
await window.electronAPI.readExcelFile(path);
await window.electronAPI.processExcelData(payload);
```

---

## 3.1.4 Evaluaciones Médicas

### Descripción

Gestiona las evaluaciones médicas ocupacionales (ingreso, periódico, retiro).

### Funcionalidades

- ✅ Programación de evaluaciones
- ✅ Registro de resultados
- ✅ Historial médico por trabajador
- ✅ Alertas de evaluaciones vencidas
- ✅ Reportes estadísticos

### Archivos

- `modules/gestion-salud/evaluaciones-medicas/evaluaciones-medicas-logic.js`
- `modules/gestion-salud/evaluaciones-medicas/evaluaciones-component.js`
- `modules/gestion-salud/evaluaciones-medicas/evaluaciones-viewer.js`
- `modules/gestion-salud/evaluaciones-medicas/evaluaciones-view.html`

### Contratos IPC Relacionados

```javascript
// Leer evaluaciones desde Excel
const evaluaciones = await window.electronAPI.readExcelFile(path);

// Guardar nueva evaluación
const resultado = await window.electronAPI.processExcelData({
  action: 'add',
  data: evaluacionData
});
```

---

## 3.1.6 Restricciones Médicas

### Descripción

Administra las restricciones y recomendaciones médicas emitidas por los profesionales de salud.

### Funcionalidades

- ✅ Registro de restricciones temporales y permanentes
- ✅ Seguimiento de vigencia de restricciones
- ✅ Notificaciones de reevaluación
- ✅ Reporte de restricciones activas

### Archivos

- `modules/gestion-salud/restricciones-medicas/restricciones-medicas-logic.js`
- `modules/gestion-salud/restricciones-medicas/restricciones-component.js`
- `modules/gestion-salud/restricciones-medicas/restricciones-viewer.js`
- `modules/gestion-salud/restricciones-medicas/restricciones-view.html`

### Contratos IPC Relacionados

```javascript
// Cargar restricciones
const restricciones = await window.electronAPI.readExcelFile(path);

// Actualizar estado de restricción
await window.electronAPI.processExcelData({
  action: 'update',
  data: { ...restriccion, estado: 'VENCIDA' }
});
```

---

## 3.2.1 Reporte de Accidentes

### Descripción

Permite registrar y reportar accidentes de trabajo, enfermedades laborales e incidentes.

### Funcionalidades

- ✅ Registro inicial de accidente
- ✅ Clasificación (accidente, incidente, enfermedad laboral)
- ✅ Descripción de hechos
- ✅ Parte del cuerpo afectada
- ✅ Agente causante
- ✅ Notificación a ARL

### Archivos

- `modules/gestion-salud/reportes-accidentes/reportes-accidentes-logic.js`
- `modules/gestion-salud/reportes-accidentes/reportes-accidentes-viewer.js`
- `modules/gestion-salud/reportes-accidentes/reportes-accidentes-view.html`

### Contratos IPC Relacionados

```javascript
// Guardar reporte de accidente
const resultado = await window.electronAPI.processExcelData({
  action: 'add',
  data: {
    fecha: '2026-03-06',
    trabajador: 'Juan Pérez',
    tipo: 'ACCIDENTE',
    descripcion: '...',
    parteCuerpo: 'Mano derecha',
    agenteCausante: 'Herramienta manual'
  }
});
```

---

## 3.2.2 Investigación de Accidentes con IA 🤖

### Descripción

Módulo avanzado que utiliza **Inteligencia Artificial** (LLM Mistral 3 3B) para analizar causas raíz de accidentes mediante la metodología de **5 Porqués** y categorías **5M**.

### Tecnología

| Componente | Tecnología | Configuración |
|------------|------------|---------------|
| **Modelo LLM** | Mistral 3 3B Reasoning | Multimodal (texto + imagen) |
| **Servidor** | Flask | Puerto 5555 |
| **Metodología** | 5 Porqués | Categorías 5M |
| **Cuantización** | bfloat16 | 4096 tokens contexto |

### Funcionalidades

- ✅ Carga de PDF de accidente
- ✅ Extracción automática de datos con Python
- ✅ Análisis de causas raíz con LLM
- ✅ Generación automática de informe DOCX
- ✅ Categorización 5M (Mano de obra, Máquina, Material, Método, Medio)

### Flujo de Trabajo

```
1. Usuario sube PDF de accidente
   ↓
2. Python extrae datos (accident_processor.py)
   ↓
3. LLM analiza causas raíz (llm_server.py - puerto 5555)
   ↓
4. Genera informe DOCX automático (accident_report_generator.py)
   ↓
5. Usuario descarga informe
```

### Archivos del Módulo

```
modules/gestion-salud/investigacion-accidentes/
├── index.js
├── investigacion-accidentes-logic.js
├── investigacion_handlers.js         # Handlers especializados IPC
├── investigaciones-viewer.js
├── investigaciones-view.html
└── investigaciones-view.css
```

### Scripts Python Relacionados

```
Portear/src/
├── llm_server.py                     # Servidor Flask (puerto 5555)
├── accident_processor.py             # Extracción de datos de PDF
├── accident_report_generator.py      # Generación de informes DOCX
└── convert_docx_to_pdf.py            # Conversión final a PDF
```

### Contratos IPC (6 handlers)

| Método | Handler | Descripción |
|--------|---------|-------------|
| `selectAccidentPdf()` | `investigacion-accidentes-select-accident-pdf` | Seleccionar PDF |
| `processAccidentPdf(path)` | `investigacion-accidentes-process-accident-pdf` | Extraer datos |
| `analyzeAccident(data)` | `investigacion-accidentes-analyze-accident` | Analizar con LLM |
| `generateAccidentReport(data)` | `investigacion-accidentes-generate-accident-report` | Generar informe |
| `startModelLoading()` | `investigacion-accidentes-start-model-loading` | Cargar modelo |
| `saveTempPdfFile(filename, data)` | `investigacion-accidentes-save-temp-pdf-file` | Guardar temporal |

### Ejemplo de Uso

```javascript
// Frontend - investigacion-accidentes-logic.js

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
    
    // 4. Mostrar análisis
    mostrarAnalisis(analysis.analysis);
    
    // 5. Generar informe
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

### Estructura del Análisis (retorno del LLM)

```javascript
{
  causas_basicas: {
    factores_personales: [
      "Conocimiento insuficiente",
      "Fatiga"
    ],
    factores_trabajo: [
      "Supervisión deficiente",
      "Herramientas inadecuadas"
    ]
  },
  causas_inmediatas: {
    actos_inseguros: [
      "Usar herramientas defectuosas",
      "No seguir procedimiento"
    ],
    condiciones_inseguras: [
      "Área de trabajo desordenada",
      "Iluminación insuficiente"
    ]
  },
  causa_raiz: "Supervisión deficiente y falta de capacitación",
  recomendaciones: [
    "Capacitar en uso correcto de herramientas",
    "Implementar inspecciones periódicas",
    "Mejorar iluminación del área"
  ],
  metodologia: '5 Porqués',
  categorias: '5M'
}
```

### Documentación Completa

- 📖 [01-arquitectura/ipc-contratos.md](../01-arquitectura/ipc-contratos.md#25-investigación-de-accidentes--6-contratos)

---

## 3.3.6 Medición del Ausentismo 🔴 CRÍTICO

### Descripción

Módulo completo para **gestionar, registrar y hacer seguimiento a las incapacidades** de los empleados, con **detección automática de casos PRIC** (Proceso de Rehabilitación y Reincorporación Laboral).

### Funcionalidades Principales

#### 1. Registro de Incapacidades

| Característica | Descripción |
|----------------|-------------|
| **Búsqueda automática** | Por cédula en PI-FO-001.xlsx |
| **Autocompletado** | Cargo, área, empresa usuaria |
| **CIE-10** | Búsqueda de códigos con descripción |
| **Validación** | Verifica pertenencia a la empresa |
| **Tipos soportados** | EPS, ARL, Enfermedad Laboral, Licencias, Calamidad |

#### 2. Detección Automática de Casos PRIC

El sistema identifica automáticamente empleados que cumplen **una de dos condiciones**:

| Condición | Criterio | Ejemplo |
|-----------|----------|---------|
| **Condición 1** | Incapacidad individual ≥ 10 días | Incapacidad de 15 días por cirugía |
| **Condición 2** | Suma ≥ 10 días con gaps ≤ 3 días | 3 incapacidades de 4, 3 y 5 días con 2 días entre ellas |

**Algoritmo de Detección:**
```javascript
// Pseudocódigo del algoritmo
1. Agrupar incapacidades por empleado (cédula)
2. Para cada empleado:
   a. Verificar si alguna incapacidad >= 10 días → Condición 1 CUMPLE
   b. Si no, sumar todas las incapacidades
   c. Verificar gaps entre incapacidades consecutivas
   d. Si suma >= 10 Y gaps <= 3 → Condición 2 CUMPLE
3. Mostrar en tabla de seguimiento solo empleados que cumplen condiciones
```

#### 3. Tabla de Seguimiento de Incapacidades

**Columnas:**
- Empleado (nombre + cédula)
- Tipo (EPS/ARL)
- Periodo (fechas inicio-fin)
- Avance (barra de progreso con días transcurridos)
- Estado (En curso / Próximo a vencer / Finalizado)
- Acciones (Ver detalles, Agregar nota, Adjuntar archivo)

**KPIs en Tiempo Real:**
- 📊 Casos Activos
- ⏳ Próximos a Vencer (< 2 días)
- 📄 Docs Pendientes
- ✅ Cerrados (Mes)

**Filtros Disponibles:**
- Buscar por nombre o cédula
- Estado (En curso, Próximo a vencer, Finalizado)
- Tipo (EPS, ARL)
- Año de inicio de incapacidad
- Mes de inicio de incapacidad

#### 3.1. Tabla de Ausentismo - Vista Completa 🆕

**Columnas de la Tabla (17 columnas):**

| # | Columna | Nombre Técnico | Índice | Ancho Máx. |
|---|---------|----------------|--------|------------|
| 1 | No | `no` | - | Auto |
| 2 | Nombre | `NOMBRE` | 2 | 180px |
| 3 | Cédula | `CEDULA` | 3 | Auto |
| 4 | Cargo | `CARGO` | 5 | 120px |
| 5 | Empresa Usuaria | `EMPRESA USUARIA` | 6 | 150px |
| 6 | Área/Dpto | `ÁREA O DPTO` | 7 | 120px |
| 7 | Género | `GENERO` | 8 | Auto |
| 8 | Mes | `MES` | 9 | Auto |
| 9 | N° Días | `N° DIAS DE INCAPACIDAD` | 10 | Auto |
| 10 | Clase | `CLASE DE INCAPACIDAD` | 11 | Auto |
| 11 | Tipo | `TIPO DE INCAPACIDAD` | 12 | 150px |
| 12 | Entidad | `ENTIDAD` | 13 | Auto |
| 13 | **Año** 🆕 | `AÑO` | 14 | Auto |
| 14 | **Fecha Inicio** 🆕 | `F. INICIO` | 15 | Auto |
| 15 | **Fecha Fin** 🆕 | `F. FIN` | 16 | Auto |
| 16 | **Código** 🆕 | `CODIGO` | 17 | Auto |
| 17 | Descripción | `DESCRIPCION` | 18 | 200px |

**Características:**
- ✅ Scroll horizontal responsivo
- ✅ Columnas sticky (header fijo)
- ✅ Hover effects
- ✅ Text truncation con ellipsis
- ✅ Badges de colores por clase

#### 4. Modal de Detalles con Incapacidades Seleccionables 🆕

Al hacer clic en "Ver Detalles":

**Características:**
- ✅ Checkboxes en todas las incapacidades
- ✅ Código CIE-10 y diagnóstico en TODAS
- ✅ Diseño visual mejorado
- ✅ Filtro de año aplicado

**Para Condición 1:**
- Lista de incapacidades ≥ 10 días con checkboxes
- Cada incapacidad muestra: fechas, días, tipo, estado, CIE-10

**Para Condición 2:**
- Secuencia completa de incapacidades con checkboxes
- Cálculo y visualización de gaps
- Total acumulado de días

#### 5. Flujo de Selección de Casos 🆕

```
1. Click en "Abrir Seguimiento" desde modal de detalles
   ↓
2. Sistema busca registros existentes en PRI.xlsx por cédula
   ↓
3. Si hay registros → Modal "Registros Existentes Detectados"
   - Muestra lista de casos encontrados
   - Usuario selecciona caso existente → Panel abre con datos cargados
   - Usuario selecciona "Crear nuevo registro" → Panel abre vacío
   ↓
4. Si no hay registros → Panel abre directamente para crear nuevo
   ↓
5. Panel de gestión muestra TODAS las secciones con datos cargados
```

#### 6. Formulario Maestro de Seguimiento PRIC 🆕

**Mejoras:**

| Mejora | Descripción |
|--------|-------------|
| **Cálculo automático de antigüedad** | Al ingresar fecha de ingreso |
| **Cálculo automático de días acumulados** | Al ingresar fechas inicio/fin |
| **Carga automática de CIE-10** | Desde la incapacidad seleccionada |
| **Seguimientos Múltiples** | Hasta 5 seguimientos con fecha y descripción |

**Nueva Sección: Seguimientos Múltiples**

```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Seguimientos                          [+ Agregar]        │
├─────────────────────────────────────────────────────────────┤
│ [Fecha] [Descripción del seguimiento..............] [🗑️]    │
│ [Fecha] [Descripción del seguimiento..............] [🗑️]    │
│ [Fecha] [Descripción del seguimiento..............] [🗑️]    │
└─────────────────────────────────────────────────────────────┘
```

**Funciones:**
- Click "+ Agregar Seguimiento" → Agrega nueva fila
- Click "🗑️" → Elimina seguimiento específico
- Al guardar → Todos los seguimientos se indexan en PRI.xlsx

**Columnas de Indexación en PRI.xlsx:**

| Seguimiento | Fecha (Columna) | Índice | Descripción (Columna) | Índice |
|-------------|-----------------|--------|-----------------------|--------|
| 1 | AB | 27 | AC | 28 |
| 2 | AD | 29 | AE | 30 |
| 3 | AF | 31 | AG | 32 |
| 4 | AH | 33 | AI | 34 |
| 5 | AJ | 35 | AK | 36 |

**Lógica de Actualización vs Creación:**

| Condición | Acción |
|-----------|--------|
| MISMA cédula + MISMAS fechas (fecha_fin) | ✅ ACTUALIZA registro existente |
| MISMA cédula + DIFERENTES fechas | ✅ CREA NUEVO registro |
| Cédula diferente | ✅ CREA NUEVO registro |

### Archivos del Módulo

```
modules/gestion-salud/ausentismo/
├── index.js
├── medicion-ausentismo.js            # ~4465 líneas - Componente principal
├── medicion-ausentismo-home.js       # Portal de bienvenida
├── medicion-ausentismo-home.html     # HTML del portal
├── registrar-ausentismo.js           # ~1200 líneas - Formulario
├── ver-ausentismo-logic.js           # Lógica de consulta
└── ver-ausentismo-dashboard.html     # Dashboard
```

### Contratos IPC (4 handlers) 🔴 CRÍTICO

| Método | Handler | Descripción |
|--------|---------|-------------|
| `getAusentismoData(company)` | `get-ausentismo-data` | Datos de ausentismo de empresa |
| `buscarEmpleadoPorCedula(cedula, empresa)` | `buscar-empleado-por-cedula` | Buscar en PI-FO-001 |
| `buscarCie10Descripcion(code)` | `buscar-cie10-descripcion` | Buscar CIE-10 |
| `procesarAusentismo(formData)` | `procesar-ausentismo` | Procesar incapacidad |
| `saveFollowUp(data, company)` | `save-follow-up` | Guardar seguimiento PRIC |
| `getFollowUpHistory(caseId, company)` | `get-follow-up-history` | Historial de seguimientos |
| `loadFollowUpData(company)` | `load-follow-up-data` | Cargar casos de PRI.xlsx |

### Estructura de Datos de Seguimiento PRIC

```javascript
{
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
  incapacidad: {
    fechaInicio: string,
    fechaFin: string,
    diasAcumulados: number,  // Calculado automáticamente
    clase: 'EPS' | 'ARL' | 'EMPRESA',
    codigoCie10: string,
    descripcionDiagnostico: string,
    numeroProrrogas: number,
    seguimientos: [  // Hasta 5 seguimientos
      {
        fecha: string,
        descripcion: string
      }
    ]
  },
  pric: {
    // 5 etapas PRIC
  },
  calificacion: {
    // 14 campos de calificación PCL
  },
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

### Ejemplo de Uso Completo

```javascript
// Frontend - medicion-ausentismo.js

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
    
    alert('Incapacidad registrada exitosamente');
    return resultado.data;
    
  } catch (error) {
    console.error('Error registrando incapacidad:', error);
    alert('Error: ' + error.message);
  }
}

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
    
    alert('Seguimiento guardado exitosamente');
    
    // 3. Recargar lista de casos
    await cargarCasosPRI();
    
    return true;
    
  } catch (error) {
    console.error('Error guardando seguimiento:', error);
    return false;
  }
}
```

### Criterios Normativos

El módulo se basa en los lineamientos de la **Resolución 0312 de 2019**:

- **Seguimiento especial:** Incapacidades ≥ 10 días (origen común o laboral)
- **Secuencia de incapacidades:** Múltiples incapacidades con gaps ≤ 3 días que suman ≥ 10 días
- **Proceso PRIC:** Proceso de Rehabilitación y Reincorporación Laboral con 5 etapas

### Documentación Completa

- 📖 [01-arquitectura/ipc-contratos.md](../01-arquitectura/ipc-contratos.md#24-ausentismo-4-contratos)
- 📖 [01-arquitectura/ipc-contratos.md](../01-arquitectura/ipc-contratos.md#212-seguimiento-de-incapacidades-5-contratos)

---

## 2. Cambios Recientes

### Versión 0.1.70 (6 marzo 2026)

- ✅ Documentación consolidada del módulo
- ✅ Seguimientos múltiples (hasta 5) en PRIC
- ✅ Cálculo automático de antigüedad y días acumulados
- ✅ Modal de selección de casos con registros existentes
- ✅ Tabla de ausentismo de 17 columnas

### Versión 0.1.52 (1 marzo 2026)

- ✅ Informe PRI Builder Multicaso
- ✅ Calificación PCL Regional/Nacional (14 campos)
- ✅ Sistema dual de archivos (PI-FO-076 + PRI.xlsx)

### Versión 0.1.50 (26 febrero 2026)

- ✅ Alertas de registros duplicados
- ✅ Cálculos automáticos (edad, IMC, días trabajados)
- ✅ KPIs en tiempo real

---

**Mantenido por:** Product Architect & Full-Stack Team  
**Última actualización:** 6 de marzo de 2026  
**Versión:** 0.1.70

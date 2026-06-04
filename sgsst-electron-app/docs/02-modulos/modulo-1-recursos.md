# 👥 Módulo 1: Recursos

**Versión:** 2.4
**Actualizado:** 4 de junio de 2026
**Estado:** ✅ Actualizado v0.1.98

---

## 📋 Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [1.1.1 Responsable del SG](#111-responsable-del-sg)
3. [1.1.2 Roles y Responsabilidades](#112-roles-y-responsabilidades)
4. [1.1.3 Asignación de Recursos](#113-asignación-de-recursos)
5. [1.1.4 Afiliación al SSSI](#114-afiliación-al-sssi)
6. [1.1.5 Trabajo de Alto Riesgo](#115-trabajo-de-alto-riesgo)
7. [1.1.6 Conformación de Copasst](#116-conformación-de-copasst)
8. [1.1.7 Capacitación al Copasst](#117-capacitación-al-copasst)
9. [1.1.8 Comité de Convivencia](#118-comité-de-convivencia)
10. [1.2.1 Programa de Capacitación 🆕](#121-programa-de-capacitación)
11. [1.2.2 Inducción y Reinducción 🆕](#122-inducción-y-reinducción)
12. [1.2.3 Curso Virtual 50 Horas](#123-curso-virtual-50-horas)

---

## 1. Visión General

### 1.1 Propósito del Módulo

El módulo de **Recursos** gestiona todos los aspectos relacionados con la asignación, capacitación y documentación del talento humano en el sistema de gestión SG-SST.

### 1.2 Submódulos

| Código | Submódulo | Archivos Principales | Estado |
|--------|-----------|---------------------|--------|
| 1.1.1 | Responsable del SG | `responsable-sg-logic.js`, `viewer.js` | ✅ |
| 1.1.2 | Roles y Responsabilidades | `roles-responsabilidades-logic.js`, `viewer.js` | ✅ |
| 1.1.3 | Asignación de Recursos | `presupuesto-logic.js`, `presupuesto-gestion.html` | ✅ |
| 1.1.4 | Afiliación al SSSI | `afiliacion-logic.js`, `viewer.js` | ✅ |
| 1.1.5 | Trabajo de Alto Riesgo | `trabajo-alto-riesgo-logic.js`, `viewer.js` | ✅ |
| 1.1.6 | Conformación de Copasst | `copasst-logic.js`, `viewer.js` | ✅ |
| 1.1.7 | Capacitación al Copasst | `capacitacion-copasst-logic.js`, `viewer.js` | ✅ |
| 1.1.8 | Comité de Convivencia | `comite-convivencia-logic.js`, `viewer.js` | ✅ |
| 1.2.1 | Programa de Capacitación | `capacitaciones-logic.js`, `capacitaciones-viewer.js`, `capacitaciones-portal-logic.js` 🆕 | ✅ |
| 1.2.2 | Inducción y Reinducción | `inducciones-logic.js`, `inducciones-viewer.js` 🆕 | ✅ |
| 1.2.3 | Curso Virtual 50 Horas | `curso-virtual-logic.js`, `viewer.js` | ✅ |

### 1.3 Archivos del Módulo

```
modules/recursos/
├── index.js
├── recursos-home.js
├── recursos-home.html
├── recursos.css
├── afiliacion/
│   ├── afiliacion-logic.js
│   ├── afiliacion-viewer.js
│   └── afiliacion-view.html
├── capacitacion-copasst/
│   ├── capacitacion-copasst-logic.js
│   ├── capacitacion-copasst-viewer.js
│   └── capacitacion-copasst-view.html
├── capacitaciones/
│   ├── capacitaciones-logic.js
│   ├── capacitaciones-viewer.js
│   ├── capacitaciones-portal-logic.js  🆕
│   ├── cap-home.html  🆕
│   ├── cap-home.js  🆕
│   ├── capacitaciones-view.html
│   └── capacitaciones-view.css
├── comite-convivencia/
├── copasst/
├── curso-virtual/
├── inducciones/
│   ├── inducciones-logic.js
│   ├── inducciones-viewer.js
│   └── inducciones-view.html
├── presupuesto/
├── responsable-sg/
├── roles-responsabilidades/
└── trabajo-alto-riesgo/
```

### 1.4 Novedades v0.1.71 🆕

| Funcionalidad | Descripción | Impacto |
|---------------|-------------|---------|
| **Portal de Bienvenida Capacitaciones** | Interfaz tipo antesala similar a Plan de Trabajo (2.4.1) | UX mejorada |
| **Clonar Cronograma** | Duplica hojas Excel (Matriz Cap. YYYY → Matriz Cap. YYYY+1) | Ahorro de tiempo |
| **Detección Automática de Año Activo** | Detecta automáticamente el año más reciente en hojas | Automatización |
| **Notificaciones Toast** | Reemplaza `alert()` por notificaciones modernas | UX mejorada |
| **Modales Modernizados** | Diseño centrado, animaciones suaves | UX mejorada |
| **Sincronización Inducciones** | Google Forms → Excel → App sin intervención manual | Automatización total |

---

## 1.1.1 Responsable del SG

### Descripción

Designa y documenta el responsable del Sistema de Gestión de Seguridad y Salud en el Trabajo.

### Funcionalidades

- ✅ Registro de datos del responsable
- ✅ Información de contacto
- ✅ Formación y competencias
- ✅ Designación formal
- ✅ Vigencia de la designación

### Archivos

- `modules/recursos/responsable-sg/responsable-sg-logic.js`
- `modules/recursos/responsable-sg/responsable-sg-viewer.js`
- `modules/recursos/responsable-sg/responsable-sg-view.html`

### Contratos IPC Relacionados

```javascript
// Cargar datos del responsable
const responsable = await window.electronAPI.readExcelFile(path);

// Guardar responsable
await window.electronAPI.processExcelData({
  action: 'save',
  data: responsableData
});
```

---

## 1.1.2 Roles y Responsabilidades

### Descripción

Define y documenta los roles y responsabilidades en el SG-SST para todos los niveles de la organización.

### Funcionalidades

- ✅ Matriz de roles y responsabilidades
- ✅ Responsabilidades por cargo
- ✅ Responsabilidades por nivel jerárquico
- ✅ Difusión y capacitación
- ✅ Actualización periódica

### Archivos

- `modules/recursos/roles-responsabilidades/roles-responsabilidades-logic.js`
- `modules/recursos/roles-responsabilidades/roles-responsabilidades-viewer.js`
- `modules/recursos/roles-responsabilidades/roles-responsabilidades-view.html`

---

## 1.1.3 Asignación de Recursos (Presupuesto)

### Descripción

Gestiona la asignación de recursos financieros para la implementación y mantenimiento del SG-SST.

### Funcionalidades

- ✅ Elaboración de presupuesto anual
- ✅ Seguimiento a ejecución presupuestal
- ✅ Reportes de inversión en SG-SST
- ✅ Proyección de recursos
- ✅ Comparativo presupuesto vs ejecutado

### Archivos

- `modules/recursos/presupuesto/presupuesto-logic.js`
- `modules/recursos/presupuesto/presupuesto-gestion.html`
- `modules/recursos/presupuesto/presupuesto-selector.html`

### Contratos IPC Relacionados

```javascript
// Obtener archivos de presupuesto
const files = await window.electronAPI.getPresupuestoFiles(empresa);

// Leer datos de presupuesto
const data = await window.electronAPI.readPresupuestoData(filePath);

// Guardar presupuesto
await window.electronAPI.saveBudgetFile(filePath, presupuestoData);
```

### 🆕 Novedad v0.1.84 - Fix Error "Shared Formula master"

**Problema:** Al guardar cambios en el presupuesto, la aplicación fallaba con el error:
```
Error: Shared Formula master must exist above and or left of clone for cell F25
```

**Solución implementada:**
- ✅ Detección previa de celdas con fórmula antes de escribir
- ✅ Preservación de fórmulas compartidas (columna F % Ejecutado)
- ✅ Cálculo automático de totales desde backend (fila TOTAL)
- ✅ Manejo seguro de merges (sin reaplicar sobre existentes)

**Impacto:**
- Guardado: 0% éxito → 100% éxito
- Fórmulas preservadas: 0% → 100%
- Errores en logs: ~20 warnings + 1 error → 0 warnings + 0 errors

**Documentación:** [`docs/05-updates/v0.1.84-presupuesto-shared-formula-fix.md`](../05-updates/v0.1.84-presupuesto-shared-formula-fix.md)

---

### 🆕 Novedad v0.1.85 - Cumplimiento Normativo en Inducciones

**Problema:** La tarjeta de estadísticas de Inducciones mostraba información incompleta:
```
Widget anterior: "35 / 35" + "✔ 100% Completado"
❌ PROBLEMA: Faltan 15 trabajadores por capacitar, pero el widget dice 100%
```

**Solución implementada:**
- ✅ Lee `stats.employees` desde config de la empresa
- ✅ Calcula pendientes: `empleados - completadas`
- ✅ Calcula porcentaje real: `(completadas / empleados) * 100`
- ✅ Alertas inteligentes: óptimo (≥90%), refuerzo (≥50%), crítico (<50%)

**Impacto:**
- Precisión del dato: Histórico → Normativo (+100%)
- Pendientes visibles: No mostraba → Muestra cantidad exacta
- Porcentaje útil: 100% (falso) → Real según nómina

**Ejemplo con solución:**
```
Empresa: 50 trabajadores (configurado en stats.employees)
Inducciones completadas: 35
Widget nuevo: "35 / 50" + "⚠ Refuerzo necesario (15 pendientes)"
```

**Configuración requerida:**
- Ir a: Configuración → Ajustes de Empresa
- Editar campo: "Número de trabajadores"
- Guardar cambios

**Documentación:** [`docs/05-updates/v0.1.85-inducciones-cumplimiento-normativo.md`](../05-updates/v0.1.85-inducciones-cumplimiento-normativo.md)

---

### 🆕 Novedad v0.1.86 - Visualizador 1.1.1 Mejorado

**Funcionalidades agregadas:**

1. **📤 Arrastrar y Soltar Archivos**
   - Overlay azul aparece solo en carpeta destino
   - Borde dashed azul durante drag-over
   - Múltiples archivos se procesan en paralelo
   - Validación: 10MB máximo, tipos permitidos

2. **🖱️ Menú Contextual con Clic Derecho**
   - 🔗 Abrir archivo (aplicación predeterminada)
   - 🗑️ Eliminar archivo (con confirmación)
   - Divider horizontal entre opciones
   - Cierra con clic fuera o Escape

3. **🗑️ Eliminar con Confirmación Moderna**
   - Modal K+AIR (reemplaza `confirm()` nativo)
   - Mensaje personalizado con nombre del archivo
   - Advertencia: "Esta acción no se puede deshacer"
   - Botones: Cancelar (ghost) vs Eliminar (danger)

4. **🎨 Notificaciones Toast Modernas**
   - 4 tipos: Success, Error, Warning, Info
   - Animación slide-in desde derecha
   - Auto-ocultado (3-6 segundos)
   - Apilables (múltiples visibles)

5. **⚠️ Manejo Específico de Errores**
   - EPERM: "El archivo está abierto en otra aplicación..."
   - ENOENT: "El archivo no existe..."
   - EACCES: "No tienes permisos..."

**Impacto:**
- Acciones por archivo: 1 → 3 (+200%)
- Formas de subir: 1 → 2 (+100%)
- Errores manejados: 1 → 4 (+300%)

**Documentación:** [`docs/05-updates/v0.1.86-mejoras-visualizador-1.1.1.md`](../05-updates/v0.1.86-mejoras-visualizador-1.1.1.md)

---

## 1.1.4 Afiliación al SSSI

### Descripción

Gestiona la afiliación de los trabajadores al Sistema de Seguridad Social Integral (Salud, Pensión, Riesgos Laborales).

### Funcionalidades

- ✅ Registro de afiliaciones a EPS
- ✅ Afiliación a fondos de pensión
- ✅ Afiliación a ARL
- ✅ Verificación de vigencia
- ✅ Reporte de novedades

### Archivos

- `modules/recursos/afiliacion/afiliacion-logic.js`
- `modules/recursos/afiliacion/afiliacion-viewer.js`
- `modules/recursos/afiliacion/afiliacion-view.html`

### Contratos IPC Relacionados

```javascript
// Buscar empleado en PI-FO-001
const empleado = await window.electronAPI.buscarEmpleadoPorCedula(
  cedula,
  empresa
);
```

---

## 1.1.5 Trabajo de Alto Riesgo

### Descripción

Controla las actividades de trabajo de alto riesgo y los permisos requeridos.

### Funcionalidades

- ✅ Identificación de trabajos de alto riesgo
- ✅ Permisos de trabajo seguro
- ✅ Análisis de trabajo seguro (ATS)
- ✅ Seguimiento a controles
- ✅ Registro de trabajos realizados

### Archivos

- `modules/recursos/trabajo-alto-riesgo/trabajo-alto-riesgo-logic.js`
- `modules/recursos/trabajo-alto-riesgo/trabajo-alto-riesgo-viewer.js`
- `modules/recursos/trabajo-alto-riesgo/trabajo-alto-riesgo-view.html`

---

## 1.1.6 Conformación de Copasst

### Descripción

Gestiona la conformación y documentación del Comité Paritario de Seguridad y Salud en el Trabajo. Incluye autollenado de actas de reunión mensual con datos del Plan de Trabajo y accidentalidad.

### Funcionalidades

- ✅ Registro de miembros del COPASST
- ✅ Período de conformación
- ✅ Acta de elección
- ✅ Integrantes principales y suplentes
- ✅ Vigencia del comité
- ✅ **Autollenado de actas de reunión** — Datos del Plan de Trabajo (mes anterior) y accidentalidad 🆕
- ✅ **Texto formateado multilinea** — Numeración, iconos ✓/⏱, agrupación por estado 🆕
- ✅ **Accidentalidad enriquecida** — Nombre completo, identificación, fecha DD/MM/YYYY 🆕

### Archivos

- `modules/recursos/copasst/copasst-logic.js`
- `modules/recursos/copasst/copasst-viewer.js`
- `modules/recursos/copasst/copasst-view.html`

### Autollenado de Actas (v0.1.98)

El handler IPC `get-copasst-auto-fill-data` genera automáticamente:

| Paso | Contenido | Fuente |
|------|-----------|--------|
| PASO 1 | Número de acta, fecha sugerida | `getActasByFileName()` |
| PASO 2 | Mes objetivo | Cálculo desde fecha |
| PASO 3 | Agenda estándar COPASST | Hardcodeado (norma) |
| PASO 4 | Plan de Trabajo del **mes anterior** | `Plan de Trabajo {year}.xlsx` — columna `previousMonthKey` |
| PASO 5 | Accidentalidad del mes anterior | `Accidentalidad.xlsx` — columnas `Nombre Completo`, `Identificación`, `Fecha del incidente` |
| PASO 6 | Respuesta final consolidada | Todos los pasos |

**Columnas de accidentalidad (con fallback):**

| Columna principal | Fallback 1 | Fallback 2 |
|-------------------|------------|------------|
| `Nombre Completo` | `Nombre` | `Trabajador` |
| `Identificación` | `Cédula` | — |

**Formato de texto en desarrollo items:**

```
Plan de Trabajo del mes de Febrero 2026:
 1. Actividad A — ✓ Completado
 2. Actividad B — ⏱ Programado

En el mes de Febrero 2026, Se presentó(ron) 1 accidente(s) de trabajo:
 1. Lilibeth Pérez — CC 22510033 — 15/02/2026
```

**Transición de año:** Si el acta es de Enero, el mes anterior es Diciembre del año previo. El sistema busca automáticamente en `Plan de Trabajo {previousYear}.xlsx`.

### Contratos IPC Relacionados

```javascript
// Obtener datos para acta
const actaData = await window.electronAPI.getActaData();

// Generar acta de conformación
const actaPath = await window.electronAPI.generateCopasstActa(changes);

// Autollenado de acta de reunión (v0.1.98+)
const autoFillData = await window.electronAPI['get-copasst-auto-fill-data']({
  empresaPath, targetMonth, targetYear, submoduloPath
});
```

---

## 1.1.7 Capacitación al Copasst

### Descripción

Gestiona el plan de capacitación para los miembros del COPASST.

### Funcionalidades

- ✅ Plan anual de capacitación
- ✅ Registro de capacitaciones realizadas
- ✅ Horas de capacitación
- ✅ Temáticas cubiertas
- ✅ Certificaciones

### Archivos

- `modules/recursos/capacitacion-copasst/capacitacion-copasst-logic.js`
- `modules/recursos/capacitacion-copasst/capacitacion-copasst-viewer.js`
- `modules/recursos/capacitacion-copasst/capacitacion-copasst-view.html`

---

## 1.1.8 Comité de Convivencia

### Descripción

Gestiona la conformación y funcionamiento del Comité de Convivencia Laboral.

### Funcionalidades

- ✅ Registro de miembros del comité
- ✅ Acta de conformación
- ✅ Período de vigencia
- ✅ Casos atendidos
- ✅ Seguimiento a recomendaciones

### Archivos

- `modules/recursos/comite-convivencia/comite-convivencia-logic.js`
- `modules/recursos/comite-convivencia/comite-convivencia-viewer.js`
- `modules/recursos/comite-convivencia/comite-convivencia-view.html`

### Contratos IPC Relacionados

```javascript
// Obtener datos para acta
const actaData = await window.electronAPI.getConvivenciaActaData();

// Generar acta de convivencia
const actaPath = await window.electronAPI.generateConvivenciaActa(changes);
```

---

## 1.2.1 Programa de Capacitación

### Descripción

Administra el programa anual de capacitación en SG-SST para todos los trabajadores.

### Funcionalidades

- ✅ Plan anual de capacitaciones
- ✅ Cronograma de actividades
- ✅ Registro de asistentes
- ✅ Evaluación de efectividad
- ✅ Certificados de capacitación
- ✅ Conversión Excel a PDF 🆕

### Archivos

- `modules/recursos/capacitaciones/capacitaciones-logic.js`
- `modules/recursos/capacitaciones/capacitaciones-viewer.js`
- `modules/recursos/capacitaciones/capacitaciones-view.html`

### Contratos IPC Relacionados

```javascript
// Obtener hojas del Excel
const sheets = await window.electronAPI.getCapacitacionesSheets(path);

// Inicializar Excel
await window.electronAPI.initExcel(data);

// Actualizar capacitaciones
await window.electronAPI.updateCapacitacionesExcel(data);

// Duplicar hoja para nueva empresa
await window.electronAPI.duplicateCapacitacionesSheet(args);

// Actualizar celda específica
await window.electronAPI.updateExcelCell(data);

// Convertir a PDF
const pdfPath = await window.electronAPI.convertExcelToPdf(path);
```

---

## 1.2.2 Inducción y Reinducción 🆕

### Descripción

Gestiona el proceso de inducción y reinducción de trabajadores, con **sincronización automática desde Google Forms** → Excel → App.

### Funcionalidades 🆕

- ✅ **Sincronización automática desde Google Forms**
- ✅ Registro de inducciones y reinducciones
- ✅ Temas cubiertos
- ✅ Duración de la capacitación
- ✅ Instructor responsable
- ✅ Evaluación de efectividad
- ✅ Certificados

### Flujo de Sincronización 🆕

```
Google Forms (nuevo registro)
    ↓
Google Sheets (webhook)
    ↓
Excel local (actualización automática)
    ↓
Aplicación (detecta cambios y sincroniza)
```

### Archivos

- `modules/recursos/inducciones/inducciones-logic.js`
- `modules/recursos/inducciones/inducciones-viewer.js`
- `modules/recursos/inducciones/inducciones-view.html`

### Contratos IPC Relacionados

```javascript
// Sincronizar datos desde Google Forms
const resultado = await window.electronAPI.syncInduccionData({
  empresa: 'Empresa SAS',
  trabajador: {
    nombre: 'Juan Pérez',
    cedula: '12345678',
    cargo: 'Operario',
    area: 'Producción',
    fechaIngreso: '2026-01-15'
  },
  induccion: {
    fecha: '2026-01-20',
    tipo: 'Inducción',  // o 'Reinducción'
    temas: ['Política SG-SST', 'Roles', 'Emergencias'],
    duracion: 4,  // horas
    instructor: 'María González',
    aprobado: true
  }
});
```

### Estructura de Datos

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

### Características de la Sincronización

| Característica | Descripción |
|----------------|-------------|
| **Automática** | Sin intervención del usuario |
| **Bidireccional** | Google Forms ↔ Excel ↔ App |
| **Validación** | Verifica datos antes de sincronizar |
| **Histórico** | Mantiene registro de todas las inducciones |
| **Alertas** | Notifica inducciones pendientes |

---

## 1.2.3 Curso Virtual 50 Horas

### Descripción

Gestiona el curso virtual de 50 horas en seguridad y salud en el trabajo.

### Funcionalidades

- ✅ Registro de participantes
- ✅ Seguimiento de progreso
- ✅ Módulos del curso
- ✅ Evaluaciones por módulo
- ✅ Certificado de aprobación
- ✅ Reporte de horas completadas

### Archivos

- `modules/recursos/curso-virtual/curso-virtual-logic.js`
- `modules/recursos/curso-virtual/curso-virtual-viewer.js`
- `modules/recursos/curso-virtual/curso-virtual-view.html`

---

## 2. Cambios Recientes

### Versión 0.1.70 (6 marzo 2026)

- ✅ Documentación consolidada del módulo
- ✅ Sincronización automática de inducciones desde Google Forms

### Versión 0.1.52 (1 marzo 2026)

- ✅ Conversión de Excel a PDF para capacitaciones
- ✅ Duplicación de hojas para nuevas empresas

---

**Mantenido por:** Product Architect & Full-Stack Team  
**Última actualización:** 6 de marzo de 2026  
**Versión:** 0.1.70

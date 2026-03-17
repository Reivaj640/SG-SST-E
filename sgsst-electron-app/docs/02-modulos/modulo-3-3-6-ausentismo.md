# 🏥 Módulo 3.3.6: Medición del Ausentismo 🆕

**Versión:** 3.0  
**Actualizado:** 17 de marzo de 2026  
**Estado:** ✅ Actualizado v0.1.75  
**Crítico:** 🔴 SI - Módulo con cambios mayores

---

## 📋 Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Sistema Dual de Archivos](#2-sistema-dual-de-archivos)
3. [Detección Automática de Casos](#3-detección-automática-de-casos)
4. [Tabla de Ausentismo - 17 Columnas](#4-tabla-de-ausentismo---17-columnas)
5. [Seguimiento PRIC con Seguimientos Múltiples](#5-seguimiento-pric-con-seguimientos-múltiples)
6. [Flujo de Selección de Casos](#6-flujo-de-selección-de-casos)
7. [Contratos IPC Relacionados](#7-contratos-ipc-relacionados)
8. [Estructura de Datos](#8-estructura-de-datos)

---

## 1. Visión General

### 1.1 Propósito del Módulo

El módulo de **Medición del Ausentismo** permite gestionar, registrar y hacer seguimiento a las incapacidades de los empleados, con detección automática de casos que requieren atención especial según criterios de la normativa SG-SST (Resolución 0312 de 2019).

### 1.2 Funcionalidades Principales

| Funcionalidad | Descripción | Estado |
|---------------|-------------|--------|
| **Registro de Incapacidades** | Búsqueda automática de empleados, CIE-10, validación | ✅ |
| **Detección Automática** | Casos ≥ 10 días o secuencias con gaps ≤ 3 días | ✅ |
| **Tabla 17 Columnas** | Vista completa con año, fechas, código CIE-10 | ✅ |
| **Filtros Dinámicos** | Año, mes, tipo basados en datos reales | ✅ |
| **Seguimiento PRIC** | 5 etapas + seguimientos múltiples (hasta 5) | ✅ |
| **Selección de Incapacidades** | Checkboxes para incapacidades específicas | ✅ |
| **Flujo de Selección** | Modal de registros existentes detectados | ✅ |
| **Cálculos Automáticos** | Antigüedad, días acumulados, IMC | ✅ |

### 1.3 Archivos del Módulo

```
modules/gestion-salud/ausentismo/
├── index.js
├── medicion-ausentismo.js         # ~4465 líneas - Componente principal
├── medicion-ausentismo-home.js    # Portal de bienvenida
├── medicion-ausentismo-home.html  # HTML del portal
├── registrar-ausentismo.js        # ~1200 líneas - Formulario
├── ver-ausentismo-logic.js        # Lógica de vista completa
└── ver-ausentismo-dashboard.html  # Dashboard de estadísticas
```

---

## 2. Sistema Dual de Archivos

### 2.1 Arquitectura Dual 🔴 CRÍTICO

El módulo utiliza **DOS archivos Excel** de forma complementaria:

| Archivo | Propósito | Ubicación |
|---------|-----------|-----------|
| **PI-FO-076.xlsx** | Lista general de incapacidades (todas) | `Empresas/{empresa}/SG-SST/Formatos/PI-FO-076/` |
| **PRI.xlsx** | Seguimiento de casos especiales (≥ 10 días) | `Empresas/{empresa}/SG-SST/Seguimiento/PRI.xlsx` |

### 2.2 Flujo de Datos

```
┌─────────────────────────────────────────────────────────────┐
│  REGISTRO DE INCAPACIDAD                                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PI-FO-076.xlsx (Todas las incapacidades)                   │
│  - Columnas: A-AX (48 columnas)                             │
│  - Registro: TODAS las incapacidades (cualquier duración)   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
            ┌─────────────────────────┐
            │ ¿Cumple criterios?      │
            │ - Individual ≥ 10 días  │
            │ - O suma ≥ 10 con gaps  │
            └─────────────────────────┘
                     │          │
                   SI          NO
                     │          │
                     ▼          └──→ Solo PI-FO-076
            ┌─────────────────────────┐
            │ PRI.xlsx                │
            │ (Seguimiento especial)  │
            │ - Columnas: A-AX (50)   │
            │ - Hasta 5 seguimientos  │
            │ - Etapas 4 y 5          │
            └─────────────────────────┘
```

### 2.3 Criterios de Detección Automática

El sistema identifica automáticamente empleados que cumplen **UNA de dos condiciones**:

| Condición | Criterio | Ejemplo |
|-----------|----------|---------|
| **Condición 1** | Incapacidad individual ≥ 10 días | Incapacidad de 15 días por cirugía |
| **Condición 2** | Suma de incapacidades ≥ 10 días con gaps ≤ 3 días | 3 incapacidades de 4, 3 y 5 días con 2 días entre ellas |

### 2.4 Algoritmo de Detección

```javascript
// Pseudocódigo del algoritmo de detección

function detectarCasosEnSeguimiento(incapacidades) {
  // 1. Agrupar por empleado (cédula)
  const agrupadas = agruparPorCedula(incapacidades);
  
  // 2. Para cada empleado
  for (const empleado of agrupadas) {
    // Condición 1: Alguna incapacidad >= 10 días
    const condicion1 = empleado.incapacidades.some(
      inc => inc.dias >= 10
    );
    
    if (condicion1) {
      marcarParaSeguimiento(empleado, 'Condición 1');
      continue;
    }
    
    // Condición 2: Suma >= 10 días con gaps <= 3 días
    const suma = sumarIncapacidades(empleado.incapacidades);
    const gaps = calcularGaps(empleado.incapacidades);
    
    const condicion2 = suma >= 10 && gaps.every(g => g <= 3);
    
    if (condicion2) {
      marcarParaSeguimiento(empleado, 'Condición 2');
    }
  }
  
  // 3. Retornar solo empleados en seguimiento
  return empleadosEnSeguimiento;
}
```

---

## 3. Detección Automática de Casos

### 3.1 Ejemplos de Detección

#### Ejemplo 1: Condición 1 (Individual ≥ 10 días)

| Empleado | Incapacidad | Fecha Inicio | Fecha Fin | Días | ¿Seguimiento? |
|----------|-------------|--------------|-----------|------|---------------|
| Juan Pérez | Cirugía | 2026-02-01 | 2026-02-15 | 15 | ✅ SI (≥ 10) |

#### Ejemplo 2: Condición 2 (Suma ≥ 10 con gaps ≤ 3)

| Empleado | Incapacidad | Fecha Inicio | Fecha Fin | Días | Gap | ¿Seguimiento? |
|----------|-------------|--------------|-----------|------|-----|---------------|
| María López | Gripe | 2026-01-05 | 2026-01-08 | 4 | - | - |
| María López | Gripe | 2026-01-11 | 2026-01-13 | 3 | 2 días | ✅ SI |
| María López | Bronquitis | 2026-01-17 | 2026-01-21 | 5 | 3 días | ✅ SI |
| **Total** | | | | **12 días** | **Gaps: 2, 3** | ✅ |

#### Ejemplo 3: NO cumple condiciones

| Empleado | Incapacidad | Fecha Inicio | Fecha Fin | Días | Gap | ¿Seguimiento? |
|----------|-------------|--------------|-----------|------|-----|---------------|
| Carlos Ruiz | Gripe | 2026-01-10 | 2026-01-12 | 3 | - | - |
| Carlos Ruiz | Gripe | 2026-02-15 | 2026-02-17 | 3 | 34 días | ❌ NO (gap > 3) |

---

## 4. Tabla de Ausentismo - 17 Columnas

### 4.1 Estructura Completa 🆕

**Versión:** v0.1.53+

| # | Columna | Nombre Técnico | Índice | Ancho Máx. | Fuente |
|---|---------|----------------|--------|------------|--------|
| 1 | No | `no` | - | Auto | Generado |
| 2 | Nombre | `NOMBRE` | 2 | 180px | Col B |
| 3 | Cédula | `CEDULA` | 3 | Auto | Col C |
| 4 | Cargo | `CARGO` | 5 | 120px | Col E |
| 5 | Empresa Usuaria | `EMPRESA USUARIA` | 6 | 150px | Col F |
| 6 | Área/Dpto | `ÁREA O DPTO` | 7 | 120px | Col G |
| 7 | Género | `GENERO` | 8 | Auto | Col H |
| 8 | Mes | `MES` | 9 | Auto | Col I |
| 9 | N° Días | `N° DIAS DE INCAPACIDAD` | 10 | Auto | Col J |
| 10 | Clase | `CLASE DE INCAPACIDAD` | 11 | Auto | Col K |
| 11 | Tipo | `TIPO DE INCAPACIDAD` | 12 | 150px | Col L |
| 12 | Entidad | `ENTIDAD` | 13 | Auto | Col M |
| 13 | **Año** 🆕 | `AÑO` | 14 | Auto | Col O o extraído |
| 14 | **Fecha Inicio** 🆕 | `F. INICIO` | 15 | Auto | Col P |
| 15 | **Fecha Fin** 🆕 | `F. FIN` | 16 | Auto | Col Q |
| 16 | **Código** 🆕 | `CODIGO` | 17 | Auto | Col R (CIE-10) |
| 17 | Descripción | `DESCRIPCION` | 18 | 200px | Col S |

### 4.2 Características de la Tabla

| Característica | Descripción |
|----------------|-------------|
| **Scroll horizontal responsivo** | Se expande cuando hay espacio disponible |
| **Columnas sticky** | Header fijo al hacer scroll vertical |
| **Hover effects** | Resalta fila al pasar el mouse |
| **Text truncation** | Elipsis para texto largo con tooltip |
| **Badges de colores** | Clase (EPS, ARL, Licencia) con colores distintivos |

### 4.3 Filtros Dinámicos 🆕

| Filtro | Funcionamiento | Datos |
|--------|----------------|-------|
| **Buscar** | Nombre o cédula (búsqueda parcial) | Todos los registros |
| **Año** | Todos los años presentes (descendente) | Extraído de columna O o fecha inicio |
| **Mes** | 12 meses (Enero-Diciembre) | Fijo |
| **Tipo** | Todos los tipos únicos de "CLASE DE INCAPACIDAD" | Columna K |
| **Botones** | "Filtrar" y "Limpiar" | - |

### 4.4 Función de Filtros Dinámicos

```javascript
// Función nueva: populateDynamicFilters()
function populateDynamicFilters(registros) {
  // 1. Extraer años únicos
  const anos = [...new Set(registros.map(r => 
    r.AÑO || extraerAnio(r.F_INICIO)
  ))].sort((a, b) => b - a);  // Descendente
  
  // 2. Extraer tipos únicos
  const tipos = [...new Set(registros.map(r => 
    r.CLASE_DE_INCAPACIDAD?.trim()
  ).filter(Boolean))].sort();  // Alfabético
  
  // 3. Actualizar selects
  llenarSelect('filtro-anio', anos);
  llenarSelect('filtro-tipo', tipos);
}
```

---

## 5. Seguimiento PRIC con Seguimientos Múltiples

### 5.1 Formulario Maestro de Seguimiento 🆕

**Mejoras Implementadas:**

| Mejora | Descripción |
|--------|-------------|
| **Cálculo automático de antigüedad** | Al ingresar fecha de ingreso, calcula años automáticamente |
| **Cálculo automático de días acumulados** | Al ingresar fechas de inicio/fin, calcula días totales |
| **Carga automática de CIE-10** | Desde la incapacidad seleccionada |
| **Seguimientos Múltiples** | Hasta 5 seguimientos con fecha y descripción |

### 5.2 Sección de Seguimientos Múltiples

```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Seguimientos                          [+ Agregar]       │
├─────────────────────────────────────────────────────────────┤
│ [📅 2026-02-27] [Revisión médica inicial............] [🗑️] │
│ [📅 2026-03-05] [Seguimiento por terapia física.....] [🗑️] │
│ [📅 2026-03-12] [Evaluación de reincorporación......] [🗑️] │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Funciones de Seguimientos

| Acción | Resultado |
|--------|-----------|
| Click "+ Agregar Seguimiento" | Agrega nueva fila con fecha y descripción vacías |
| Click "🗑️" | Elimina ese seguimiento específico |
| Al guardar | Todos los seguimientos se indexan en PRI.xlsx |

### 5.4 Columnas de Indexación en PRI.xlsx

| Seguimiento | Fecha (Columna) | Índice | Descripción (Columna) | Índice |
|-------------|-----------------|--------|-----------------------|--------|
| 1 | AB | 27 | AC | 28 |
| 2 | AD | 29 | AE | 30 |
| 3 | AF | 31 | AG | 32 |
| 4 | AH | 33 | AI | 34 |
| 5 | AJ | 35 | AK | 36 |

### 5.5 Lógica de Actualización vs Creación 🆕

El sistema usa **criterio inteligente** para determinar si actualiza o crea:

| Condición | Acción |
|-----------|--------|
| MISMA cédula + MISMAS fechas (fecha_fin) | ✅ **ACTUALIZA** registro existente |
| MISMA cédula + DIFERENTES fechas | ✅ **CREA NUEVO** registro |
| Cédula diferente | ✅ **CREA NUEVO** registro |

**Esto permite que un mismo empleado tenga múltiples registros en PRI.xlsx, uno por cada incapacidad diferente.**

---

## 6. Flujo de Selección de Casos

### 6.1 Nuevo Comportamiento al Abrir Seguimiento 🆕

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Click en "Abrir Seguimiento" desde modal de detalles     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Sistema busca registros existentes en PRI.xlsx por cédula│
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
            ┌─────────────────────────┐
            │ ¿Hay registros?         │
            └─────────────────────────┘
                     │          │
                   SI          NO
                     │          │
                     ▼          ▼
    ┌─────────────────────────┐  ┌─────────────────────────┐
    │ Modal "Registros        │  │ Panel abre directamente│
    │ Existentes Detectados"  │  │ para crear nuevo       │
    │ - Muestra casos         │  │                        │
    │ - Usuario selecciona    │  │                        │
    └─────────────────────────┘  └─────────────────────────┘
                     │
                     ▼
    ┌─────────────────────────┐
    │ Usuario selecciona:     │
    │ - Caso existente        │
    │ - O "Crear nuevo"       │
    └─────────────────────────┘
                     │
                     ▼
    ┌─────────────────────────┐
    │ Panel de gestión abre   │
    │ con datos cargados      │
    └─────────────────────────┘
```

### 6.2 Modal "Registros Existentes Detectados"

| Elemento | Descripción |
|----------|-------------|
| **Encabezado** | "Registros Existentes Detectados" |
| **Contenido** | Lista de casos encontrados con: fecha, días, diagnóstico |
| **Indicador** | Badge "Más reciente" en el último caso |
| **Acciones** | - Seleccionar caso existente (radio buttons)<br>- "Crear nuevo registro" (opción adicional)<br>- "Cancelar" |

### 6.3 Modal de Detalles con Checkboxes 🆕

**Características Nuevas:**

| Característica | Descripción |
|----------------|-------------|
| **Checkboxes en incapacidades** | Usuario selecciona incapacidades específicas |
| **CIE-10 en TODAS** | Código y diagnóstico en cada incapacidad |
| **Diseño mejorado** | Hover effects, transiciones suaves |
| **Filtro de año aplicado** | Solo muestra incapacidades del año seleccionado |

**Para Condición 1 (≥ 10 días):**
- Encabezado con datos del empleado
- Lista de incapacidades ≥ 10 días con checkboxes
- Cada incapacidad muestra: checkbox, fechas, días, tipo, estado, CIE-10

**Para Condición 2 (Suma ≥ 10 con gaps ≤ 3):**
- Encabezado con datos del empleado
- Secuencia completa con checkboxes
- Cálculo y visualización de gaps
- Total acumulado de días
- CIE-10 de cada incapacidad

---

## 7. Contratos IPC Relacionados

### 7.1 Handlers Críticos 🔴

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `readAusentismoData(company)` | `get-ausentismo-data` | `company: string` | `{ success, data }` | Leer datos de PI-FO-076 |
| `getPriSeguimientoData(company)` | `get-pri-seguimiento-data` | `company: string` | `{ success, data }` | Leer casos de PRI.xlsx |
| `buscarEmpleadoPorCedula(cedula, empresa)` | `buscar-empleado-por-cedula` | `cedula, empresa` | `{ success, data }` | Buscar en PI-FO-001 |
| `buscarCie10Descripcion(code)` | `buscar-cie10-descripcion` | `code: string` | `{ success, descripcion }` | Buscar CIE-10 |
| `procesarAusentismo(formData)` | `procesar-ausentismo` | `formData: object` | `{ success, data }` | Registrar incapacidad |
| `saveFollowUp(data, company)` | `save-follow-up` | `data, company` | `{ success }` | Guardar seguimiento PRIC |
| `buscarRegistrosCedula(cedula, company)` | `buscar-registros-cedula` | `cedula, company` | `{ success, data }` | Buscar en PRI.xlsx |
| `exportIncapacityData(company)` | `export-incapacity-data` | `company` | `{ success, path }` | Exportar a Excel |
| `getFollowUpHistory(caseId, company)` | `get-follow-up-history` | `caseId, company` | `{ success, history }` | Historial de seguimientos |
| `loadFollowUpData(company)` | `load-follow-up-data` | `company` | `{ success, cases }` | Cargar todos los casos |

### 7.2 Ejemplo de Uso Completo

```javascript
// Flujo completo: Registro y seguimiento de incapacidad

async function registrarYDarSeguimiento(formData, empresa) {
  try {
    // 1. Buscar empleado
    const empleado = await window.electronAPI.buscarEmpleadoPorCedula(
      formData.cedula,
      empresa
    );
    
    if (!empleado.success) {
      throw new Error('Empleado no encontrado');
    }
    
    // 2. Buscar CIE-10
    const cie10 = await window.electronAPI.buscarCie10Descripcion(
      formData.codigoCie10
    );
    
    // 3. Registrar incapacidad en PI-FO-076
    const registro = await window.electronAPI.procesarAusentismo({
      ...formData,
      ...empleado.data,
      descripcionDiagnostico: cie10.descripcion
    });
    
    // 4. Verificar si cumple criterios para PRI.xlsx
    if (formData.diasIncapacidad >= 10) {
      // 5. Guardar seguimiento en PRI.xlsx
      const followUpData = {
        trabajador: {
          ...empleado.data,
          antiguedad: calcularAntiguedad(empleado.data.fechaIngreso)
        },
        incapacidad: {
          fechaInicio: formData.fechaInicio,
          fechaFin: formData.fechaFin,
          diasAcumulados: formData.diasIncapacidad,
          clase: formData.claseIncapacidad,
          codigoCie10: formData.codigoCie10,
          descripcionDiagnostico: cie10.descripcion,
          seguimientos: [
            {
              fecha: new Date().toISOString().split('T')[0],
              descripcion: 'Registro inicial de incapacidad ≥ 10 días'
            }
          ]
        },
        pric: { /* 5 etapas */ },
        recomendaciones: []
      };
      
      await window.electronAPI.saveFollowUp(followUpData, empresa);
    }
    
    return registro;
    
  } catch (error) {
    console.error('Error en registro:', error);
    throw error;
  }
}
```

---

## 8. Estructura de Datos

### 8.1 Objeto Empleado

```javascript
{
  cedula: "12345678",
  nombre: "Juan Pérez",
  cargo: "Operario de Producción",
  departamento: "Planta",
  empresaUsuaria: "Empresa SAS",
  genero: "Masculino",
  fechaNacimiento: "1985-05-15",  // 🆕
  fechaIngreso: "2020-01-10",      // 🆕
  incapacidades: [
    {
      fechaInicio: Date,
      fechaFin: Date,
      diasIncapacidad: 15,
      record: { /* datos crudos del Excel */ }
    }
  ]
}
```

### 8.2 Datos de Seguimiento PRIC (Actualizado 🆕)

```javascript
{
  trabajador: {
    nombre: "Juan Pérez",
    cedula: "12345678",
    fechaNacimiento: "1985-05-15",
    genero: "Masculino",
    cargo: "Operario",
    area: "Planta",
    fechaIngreso: "2020-01-10",
    antiguedad: 5,  // Calculado automáticamente
    tipoContrato: "Término Indefinido",
    salario: 1500000,
    eps: "Sanitas",
    afp: "Porvenir",
    tipoEvento: "Enfermedad General",
    tipoCargo: "Operativo"
  },
  incapacidad: {
    fechaInicio: "2025-02-01",
    fechaFin: "2025-02-28",
    diasAcumulados: 28,  // Calculado automáticamente
    clase: "EPS",
    codigoCie10: "S801",
    descripcionDiagnostico: "Contusión de pierna",
    numeroProrrogas: 0,
    // 🆕 Seguimientos múltiples (hasta 5)
    seguimientos: [
      {
        fecha: "2025-02-27",
        descripcion: "Revisión médica inicial"
      },
      {
        fecha: "2025-03-05",
        descripcion: "Seguimiento por terapia física"
      },
      {
        fecha: "2025-03-12",
        descripcion: "Evaluación de reincorporación"
      }
    ]
  },
  pric: { /* 5 etapas PRIC */ },
  calificacion: { /* datos de calificación PCL */ },
  recomendaciones: [
    {
      recomendacion: "Reposo absoluto 15 días",
      entidad: "ARL",
      fechaLimite: "2026-03-15",
      cumple: "SI",
      observacion: "Cumplido según certificado"
    }
  ]
}
```

### 8.3 Columnas de PRI.xlsx (50 columnas)

| Columna | Índice | Campo | Descripción |
|---------|--------|-------|-------------|
| A-K | 1-11 | Datos básicos | Nombre, cédula, cargo, área, etc. |
| L | 12 | Salario | Salario básico del empleado |
| M | 13 | EPS | Entidad promotora de salud |
| N | 14 | AFP | Fondo de pensiones |
| O | 15 | Tipo evento | Enfermedad general, laboral, AT |
| P | 16 | Tipo cargo | Operativo, administrativo, directivo |
| Q | 17 | Tipo contrato | Término fijo, indefinido, etc. |
| R | 18 | Peso | Peso en kg |
| S | 19 | Talla | Talla en cm |
| T | 20 | IMC | Índice de masa corporal |
| U | 21 | Dominancia | Zurdo, diestro |
| V | 22 | Actividades extralaborales | Descripción |
| W | 23 | CIE-10 DX2 | Segundo diagnóstico |
| X | 24 | Origen DX2 | Origen del segundo diagnóstico |
| Y | 25 | CIE-10 DX3 | Tercer diagnóstico |
| Z | 26 | Origen DX3 | Origen del tercer diagnóstico |
| AA | 27 | Fecha inicio | Fecha de inicio de incapacidad |
| AB | 28 | Fecha fin | Fecha de finalización |
| AC | 29 | Código CIE-10 | Código del diagnóstico principal |
| AD | 30 | Descripción | Descripción del diagnóstico |
| AE | 31 | Clase | LABORAL / COMÚN |
| AF | 32 | Número prórrogas | Cantidad de prórrogas |
| AG-AJ | 33-36 | Etapas PRIC | 5 etapas del proceso |
| AK-AN | 37-40 | Calificación PCL | 14 campos de calificación |
| AO-AS | 41-45 | Recomendaciones | Lista de recomendaciones |
| AT | 46 | Seguimiento 1 - Fecha | Fecha del primer seguimiento |
| AU | 47 | Seguimiento 1 - Descripción | Descripción del primer seguimiento |
| AV | 48 | Seguimiento 2 - Fecha | Fecha del segundo seguimiento |
| AW | 49 | Seguimiento 2 - Descripción | Descripción del segundo seguimiento |
| AX | 50 | Seguimiento 3 - Fecha | Fecha del tercer seguimiento |
| AY | 51 | Seguimiento 3 - Descripción | Descripción del tercer seguimiento |
| AZ | 52 | Seguimiento 4 - Fecha | Fecha del cuarto seguimiento |
| BA | 53 | Seguimiento 4 - Descripción | Descripción del cuarto seguimiento |
| BB | 54 | Seguimiento 5 - Fecha | Fecha del quinto seguimiento |
| BC | 55 | Seguimiento 5 - Descripción | Descripción del quinto seguimiento |
| BD | 56 | Fecha reincorporación | Etapa 4 - Fecha |
| BE | 57 | Tipo reintegro | Etapa 4 - Tipo |
| BF | 58 | Adaptaciones | Etapa 4 - Adaptaciones |
| BG | 59 | Fecha cierre | Etapa 5 - Fecha |
| BH | 60 | Motivo cierre | Etapa 5 - Motivo |
| BI | 61 | Observaciones finales | Etapa 5 - Observaciones |

---

## 9. Cambios Recientes

### v0.1.53 - 4 Mar 2026 🆕

| Cambio | Descripción |
|--------|-------------|
| **+4 columnas en tabla** | Año, Fecha Inicio, Fecha Fin, Código |
| **Filtros dinámicos** | Año y tipo basados en datos reales |
| **Corrección de género** | FEMENINO/MASCULINO (coincide con Excel) |
| **Scroll modernizado** | Scrollbars consistentes en temas claro/oscuro |
| **Info de mapeo** | Fecha y tipo de mapeo en tarjetas de empresas |

### v0.1.52 - 28 Feb 2026

| Cambio | Descripción |
|--------|-------------|
| **Etapas 4 y 5** | Reincorporación y cierre implementadas |
| **+20 columnas en PRI.xlsx** | Seguimientos, DX2, DX3, etapas 4-5 |
| **Carga completa de casos** | Carga TODOS los campos del registro |
| **Modal mejorado** | Muestra CIE-10 + descripción completa |

### v0.1.51 - 27 Feb 2026

| Cambio | Descripción |
|--------|-------------|
| **Incapacidades seleccionables** | Checkboxes en modal de detalles |
| **Flujo de selección** | Modal después de "Abrir Seguimiento" |
| **Cálculos automáticos** | Antigüedad y días acumulados |
| **Seguimientos múltiples** | Hasta 5 seguimientos por caso |
| **Lógica inteligente** | Actualiza o crea según fechas |

---

## 10. Referencias Normativas

### Resolución 0312 de 2019

| Artículo | Descripción |
|----------|-------------|
| **Art. 11** | Seguimiento a trabajadores con incapacidades |
| **Art. 12** | Procesos de rehabilitación y reincorporación |
| **Anexo 1** | Estándares mínimos según tamaño y riesgo |

### Criterios de Seguimiento

| Criterio | Valor |
|----------|-------|
| **Incapacidad individual** | ≥ 10 días (origen común o laboral) |
| **Secuencia de incapacidades** | Suma ≥ 10 días con gaps ≤ 3 días |
| **Proceso PRIC** | 5 etapas estructuradas |

---

**Mantenido por:** Full-Stack Team & SST Specialist  
**Última actualización:** 17 de marzo de 2026  
**Versión:** 3.0 (v0.1.75)  
**Próxima revisión:** Al modificar estructura de PRI.xlsx o PI-FO-076

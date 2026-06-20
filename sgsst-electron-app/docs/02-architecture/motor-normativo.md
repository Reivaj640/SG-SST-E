# ⚖️ Motor Normativo K+AIR

**Versión:** 1.1
**Actualizado:** 9 de junio de 2026
**Estado:** ✅ Actualizado v0.1.99

---

## 📋 Tabla de Contenidos

1. [Descripción General](#1-descripción-general)
2. [Escenarios Normativos](#2-escenarios-normativos)
3. [Funcionamiento](#3-funcionamiento)
4. [Integración con el Sistema](#4-integración-con-el-sistema)
5. [Escenarios Implementados](#5-escenarios-implementados)

---

## 1. Descripción General

### 1.1 Propósito

El **motor normativo** es el componente central del sistema K+AIR que permite aplicar diferentes escenarios normativos a las empresas según:

- **Tamaño de la empresa** (número de trabajadores)
- **Nivel de riesgo** (I, II, III, IV, V)
- **Sector económico** (actividad económica principal)

### 1.2 Base Legal

El motor normativo implementa la **Resolución 0312 de 2019** del Ministerio de Salud y Protección Social de Colombia, que establece los Estándares Mínimos del Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST).

### 1.3 Principios de Diseño

| Principio | Descripción |
|-----------|-------------|
| **Dinámico** | Escenarios se aplican automáticamente según datos de la empresa |
| **Progresivo** | A mayor tamaño/riesgo, más módulos requeridos |
| **Validado** | El sistema verifica cumplimiento de requisitos |
| **Flexible** | Permite módulos adicionales no obligatorios |

---

## 2. Escenarios Normativos

### 2.1 Matriz de Escenarios

| Tamaño \ Riesgo | I (Bajo) | II (Medio) | III (Alto) | IV (Muy Alto) | V (Extremo) |
|-----------------|----------|------------|------------|---------------|-------------|
| **Micro (1-10)** | 1A | 1B | 1C | 1D | 1E |
| **Pequeña (11-50)** | 2A | 2B | 2C | 2D | 2E |
| **Mediana (51-200)** | 3A | 3B | 3C | 3D | 3E |
| **Grande (201+)** | 4A | 4B | 4C | 4D | 4E |

### 2.2 Estructura de Escenario

```json
{
  "codigo": "1A",
  "nombre": "BÁSICO_1-10_R1-3",
  "descripcion": "Escenario básico para empresas de 1-10 trabajadores con riesgos 1-3",
  "tamaño": "micro",
  "riesgo": ["I", "II", "III"],
  "modulos_obligatorios": [
    {
      "codigo": "1.1.1",
      "nombre": "Responsable del SG",
      "activo": true,
      "obligatorio": true
    },
    {
      "codigo": "2.1.1",
      "nombre": "Política del SG-SST",
      "activo": true,
      "obligatorio": true
    }
  ],
  "modulos_opcionales": [
    {
      "codigo": "1.2.3",
      "nombre": "Curso Virtual 50 Horas",
      "activo": false,
      "obligatorio": false
    }
  ],
  "requisitos_especificos": [
    "Designar responsable del SG-SST",
    "Formular y aprobar la política del SG-SST",
    "Elaborar reglamento de higiene y seguridad industrial"
  ]
}
```

### 2.3 Tipos de Escenarios

| Tipo | Descripción | Empresas Típicas |
|------|-------------|------------------|
| **BÁSICO** | 1-10 trabajadores, riesgo I-III | Tiendas, consultorios, oficinas pequeñas |
| **INTERMEDIO** | 11-50 trabajadores o riesgo IV | Restaurantes, talleres, pequeñas fábricas |
| **AVANZADO** | 51-200 trabajadores o riesgo V | Fábricas, hospitales, construcción |
| **ESPECIALIZADO** | Actividades de alto riesgo específico | Minería, químicos, explosivos |

---

## 3. Funcionamiento

### 3.1 Flujo de Aplicación de Escenario

```
1. Usuario crea empresa
   ↓
2. Ingresa datos:
   - Número de trabajadores
   - Nivel de riesgo
   - Sector económico
   ↓
3. Sistema calcula escenario normativo
   ↓
4. Sistema activa módulos obligatorios
   ↓
5. Sistema muestra módulos en UI
```

### 3.2 Cálculo de Escenario

```javascript
// renderer.js - Lógica de cálculo de escenario

function calcularEscenarioNormativo(empresa) {
  const { trabajadores, riesgo, sector } = empresa;
  
  // Determinar tamaño
  let tamaño;
  if (trabajadores <= 10) {
    tamaño = 'micro';
  } else if (trabajadores <= 50) {
    tamaño = 'pequeña';
  } else if (trabajadores <= 200) {
    tamaño = 'mediana';
  } else {
    tamaño = 'grande';
  }
  
  // Determinar código de escenario
  const codigoTamaño = {
    'micro': '1',
    'pequeña': '2',
    'mediana': '3',
    'grande': '4'
  };
  
  const codigoRiesgo = {
    'I': 'A',
    'II': 'B',
    'III': 'C',
    'IV': 'D',
    'V': 'E'
  };
  
  const escenario = `${codigoTamaño[tamaño]}${codigoRiesgo[riesgo]}`;
  
  return {
    codigo: escenario,
    tamaño: tamaño,
    riesgo: riesgo,
    sector: sector
  };
}
```

### 3.3 Activación de Módulos

```javascript
// renderer.js - Activación de módulos según escenario

function activarModulosPorEscenario(escenario) {
  const modulosActivos = [];
  
  // Módulos base (todos los escenarios)
  modulosActivos.push('1.1.1'); // Responsable del SG
  modulosActivos.push('2.1.1'); // Política del SG-SST
  
  // Módulos según tamaño
  if (['pequeña', 'mediana', 'grande'].includes(escenario.tamaño)) {
    modulosActivos.push('1.1.6'); // COPASST
    modulosActivos.push('1.1.7'); // Capacitación COPASST
  }
  
  // Módulos según riesgo
  if (['IV', 'V'].includes(escenario.riesgo)) {
    modulosActivos.push('1.1.5'); // Trabajo de alto riesgo
    modulosActivos.push('5.1.1'); // Plan de emergencias
  }
  
  // Módulos específicos por sector
  if (escenario.sector === 'Salud') {
    modulosActivos.push('3.1.4'); // Evaluaciones médicas
    modulosActivos.push('3.1.6'); // Restricciones médicas
  }
  
  return modulosActivos;
}
```

---

## 4. Integración con el Sistema

### 4.1 Archivos de Escenarios

Los escenarios se almacenan en archivos JSON en el directorio de la empresa:

```
Empresas/
└── [Nombre Empresa]/
    ├── normativa/
    │   ├── escenario.json         # Escenario asignado
    │   ├── modulos.json           # Módulos activados
    │   └── requisitos.json        # Requisitos específicos
    └── [archivos de módulos]
```

### 4.2 Carga de Escenario

```javascript
// main.js - Handler IPC para cargar escenario

ipcMain.handle('cargar-escenario-normativo', async (event, empresaPath) => {
  try {
    const escenarioPath = path.join(empresaPath, 'normativa', 'escenario.json');
    const modulosPath = path.join(empresaPath, 'normativa', 'modulos.json');
    
    const escenario = JSON.parse(fs.readFileSync(escenarioPath, 'utf8'));
    const modulos = JSON.parse(fs.readFileSync(modulosPath, 'utf8'));
    
    return {
      success: true,
      data: {
        escenario,
        modulos
      }
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SCENARIO_LOAD_ERROR',
        message: `Error cargando escenario: ${error.message}`
      }
    };
  }
});
```

### 4.3 Renderizado de Módulos

```javascript
// renderer.js - Renderizado condicional de módulos

async function renderizarModulosEmpresa(empresa) {
  // Cargar escenario normativo
  const escenarioData = await window.electronAPI.cargarEscenarioNormativo(
    empresa.path
  );
  
  if (!escenarioData.success) {
    console.error('Error cargando escenario:', escenarioData.error);
    return;
  }
  
  const { modulos } = escenarioData.data;
  
  // Renderizar solo módulos activos
  const sidebar = document.querySelector('.sidebar');
  modulos.forEach(modulo => {
    if (modulo.activo) {
      const moduloElement = document.createElement('div');
      moduloElement.className = 'modulo-item';
      moduloElement.dataset.codigo = modulo.codigo;
      moduloElement.innerHTML = `
        <span class="modulo-icon">${modulo.activo ? '✅' : '🔒'}</span>
        <span class="modulo-nombre">${modulo.nombre}</span>
        ${modulo.obligatorio ? '<span class="badge obligatorio">Obligatorio</span>' : ''}
      `;
      sidebar.appendChild(moduloElement);
    }
  });
}
```

---

## 5. Escenarios Implementados

### 5.1 Escenario 1A - Microempresa Riesgo I-II-III

**Descripción:** Empresas de 1-10 trabajadores con riesgo bajo a medio

**Módulos Obligatorios:**
- ✅ 1.1.1 Responsable del SG
- ✅ 2.1.1 Política del SG-SST
- ✅ 2.5.1 Archivo y retención documental

**Módulos Opcionales:**
- 🔲 1.2.3 Curso Virtual 50 Horas
- 🔲 3.2.1 Reporte de Accidentes

**Requisitos Específicos:**
1. Designar responsable del SG-SST
2. Formular y aprobar la política del SG-SST
3. Elaborar reglamento de higiene y seguridad industrial
4. Afiliar trabajadores al sistema de seguridad social

---

### 5.2 Escenario 2C - Pequeña Empresa Riesgo III

**Descripción:** Empresas de 11-50 trabajadores con riesgo medio-alto

**Módulos Obligatorios:**
- ✅ 1.1.1 Responsable del SG
- ✅ 1.1.2 Roles y Responsabilidades
- ✅ 1.1.4 Afiliación al SSSI
- ✅ 1.1.6 Conformación de COPASST
- ✅ 1.1.7 Capacitación al COPASST
- ✅ 2.1.1 Política del SG-SST
- ✅ 2.3.1 Evaluación Inicial SG-SST
- ✅ 2.4.1 Plan de Trabajo Anual
- ✅ 3.2.1 Reporte de Accidentes
- ✅ 3.2.2 Investigación de Accidentes

**Módulos Opcionales:**
- 🔲 1.2.1 Programa de Capacitación
- 🔲 3.1.4 Evaluaciones Médicas
- 🔲 3.3.6 Medición del Ausentismo

**Requisitos Específicos:**
1. Conformar COPASST (paritario)
2. Capacitar miembros de COPASST
3. Realizar evaluaciones médicas ocupacionales
4. Investigar accidentes de trabajo
5. Reportar accidentes a ARL

---

### 5.3 Escenario 4E - Grande Empresa Riesgo V

**Descripción:** Empresas de 201+ trabajadores con riesgo extremo

**Módulos Obligatorios:**
- ✅ **TODOS los 27+ submódulos**

**Módulos Críticos Adicionales:**
- ✅ 1.1.5 Trabajo de Alto Riesgo
- ✅ 3.2.2 Investigación de Accidentes con IA 🤖
- ✅ 3.3.6 Medición del Ausentismo (seguimiento PRIC)
- ✅ 5.1.1 Plan de Prevención de Emergencias
- ✅ 6.1.2 Auditoría Anual
- ✅ 7.1.1 Acciones Preventivas y Correctivas

**Requisitos Específicos:**
1. Sistema de gestión de la salud completo
2. Investigación de accidentes con metodología 5 Porqués
3. Seguimiento PRIC para incapacidades ≥ 10 días
4. Auditorías internas anuales
5. Revisión por la alta dirección anual
6. Planes de mejoramiento documentados

---

## 6. Validación de Cumplimiento

### 6.1 Matriz de Cumplimiento

El sistema genera una matriz de cumplimiento para cada empresa:

```javascript
// Ejemplo de matriz de cumplimiento

const matrizCumplimiento = {
  empresa: 'Empresa SAS',
  escenario: '2C',
  fechaEvaluacion: '2026-03-06',
  cumplimiento: {
    modulosObligatorios: {
      total: 10,
      completados: 8,
      pendientes: 2,
      porcentaje: 80
    },
    requisitosEspecificos: {
      total: 5,
      cumplidos: 4,
      pendientes: 1,
      porcentaje: 80
    },
    estado: 'EN_PROCESO',  // CUMPLIDO, EN_PROCESO, NO_CUMPLIDO
    observaciones: [
      'Pendiente capacitar miembros de COPASST',
      'Pendiente realizar evaluación inicial SG-SST'
    ]
  }
};
```

### 6.2 Alertas de Incumplimiento

El sistema genera alertas cuando:

| Condición | Acción |
|-----------|--------|
| Módulo obligatorio sin completar | 🔴 Alerta crítica |
| Requisito específico pendiente | 🟡 Alerta preventiva |
| Auditoría vencida | 🔴 Alerta crítica |
| Capacitación COPASST vencida | 🟡 Alerta preventiva |

---

## 7. Actualización de Escenarios

### 7.1 Cambio de Escenario

Cuando una empresa cambia de tamaño o riesgo:

```javascript
// Frontend - Cambio de escenario

async function actualizarEscenarioEmpresa(empresa, nuevosDatos) {
  // 1. Calcular nuevo escenario
  const nuevoEscenario = calcularEscenarioNormativo({
    ...empresa,
    ...nuevosDatos
  });
  
  // 2. Obtener módulos del nuevo escenario
  const modulosNuevos = await window.electronAPI.obtenerModulosEscenario(
    nuevoEscenario.codigo
  );
  
  // 3. Comparar con módulos actuales
  const modulosNuevosActivar = modulosNuevos.filter(
    m => !empresa.modulosActivos.includes(m.codigo)
  );
  
  // 4. Mostrar confirmación al usuario
  if (modulosNuevosActivar.length > 0) {
    const confirmacion = confirm(
      `Se activarán ${modulosNuevosActivar.length} módulos adicionales. ¿Continuar?`
    );
    
    if (!confirmacion) return;
  }
  
  // 5. Actualizar escenario
  await window.electronAPI.actualizarEscenarioNormativo(
    empresa.id,
    nuevoEscenario,
    modulosNuevos
  );
  
  // 6. Recargar UI
  await renderizarModulosEmpresa(empresa);
}
```

---

## 8. Documentación Relacionada

| Documento | Propósito |
|-----------|-----------|
| [../README.md](../README.md) | Inicio rápido |
| [arquitectura-general.md](arquitectura-general.md) | Arquitectura completa |
| [02-modulos/](../02-modulos/) | Documentación de módulos |

---

**Mantenido por:** Product Architect & Full-Stack Team  
**Última actualización:** 9 de junio de 2026
**Versión:** 0.1.99

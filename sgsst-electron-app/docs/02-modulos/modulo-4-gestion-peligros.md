# ⚠️ Módulo 4: Gestión de Peligros

**Versión:** 1.0
**Actualizado:** 9 de junio de 2026
**Estado:** ✅ Actualizado v0.1.99

---

## 📋 Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [4.1.1 Metodología IPEVR](#411-metodología-ipevr)
3. [4.1.2 Identificación de Peligros](#412-identificación-de-peligros)
4. [4.1.3 Sustancias Químicas](#413-sustancias-químicas)
5. [4.1.4 Mediciones Ambientales](#414-mediciones-ambientales)
6. [4.2.1 Medidas de Prevención y Control](#421-medidas-de-prevención-y-control)
7. [4.2.2 Aplicación Medidas de Prevención](#422-aplicación-medidas-de-prevención)
8. [4.2.3 Evaluación de Procedimientos](#423-evaluación-de-procedimientos)
9. [4.2.4 Inspecciones Sistemáticas](#424-inspecciones-sistemáticas)
10. [4.2.5 Mantenimiento Periódico](#425-mantenimiento-periódico)
11. [4.2.6 Entrega de EPP](#426-entrega-de-epp)

---

## 1. Visión General

### 1.1 Propósito del Módulo

El módulo de **Gestión de Peligros** identifica, evalúa y controla los peligros ocupacionales en el lugar de trabajo, conforme a los requisitos de la Resolución 0312 de 2019.

### 1.2 Submódulos (10)

| Código | Submódulo | Componente Real | Estado |
|--------|-----------|-----------------|--------|
| 4.1.1 | Metodología IPEVR | `metodologia-ipevr-logic.js` | ✅ Implementado |
| 4.1.2 | Identificación de Peligros | `identificacion-peligros-component.js` | ✅ Implementado |
| 4.1.3 | Sustancias Químicas | Generic fallback | 🟡 Placeholder |
| 4.1.4 | Mediciones Ambientales | Generic fallback | 🟡 Placeholder |
| 4.2.1 | Medidas Prevención y Control | Generic fallback | 🟡 Placeholder |
| 4.2.2 | Aplicación Medidas Prevención | Generic fallback | 🟡 Placeholder |
| 4.2.3 | Evaluación de Procedimientos | Generic fallback | 🟡 Placeholder |
| 4.2.4 | Inspecciones Sistemáticas | `inspecciones-component.js` | ✅ Implementado |
| 4.2.5 | Mantenimiento Periódico | `mantenimiento-component.js` | ✅ Implementado |
| 4.2.6 | Entrega de EPP | Generic fallback | 🟡 Placeholder |

### 1.3 Componente Home

- Archivo: `modules/gestion-peligros/gestion-peligros-home.js` (694L)
- Dashboard con datos reales y gráficas Chart.js
- KPIs: peligros identificados, inspecciones realizadas, EPP entregados

### 1.4 Contratos IPC Principales

| Categoría | Cantidad | Ejemplo |
|-----------|----------|---------|
| Matriz de Peligros | 25 | `matrizPeligros.read`, `matrizPeligros.heatmap` |
| Inspecciones | 18 | `inspecciones.getStats`, `inspecciones.createInspection` |
| Mantenimiento | 11 | `mantenimiento.read`, `mantenimiento.toggleMonth` |

---

## 4.1.1 Metodología IPEVR

### Descripción

Documenta la metodología de Identificación de Peligros, Evaluación de Valoración de Riesgos (IPEVR) utilizada por la empresa.

### Funcionalidades

- ✅ Registro de la metodología IPEVR adoptada
- ✅ Tabla de valoración de probabilidad e impacto
- ✅ Criterios de aceptabilidad del riesgo
- ✅ Matriz de jerarquización

### Archivos

- `modules/gestion-peligros/metodologia-ipevr/metodologia-ipevr-logic.js`
- `modules/gestion-peligros/metodologia-ipevr/metodologia-ipevr-viewer.js`
- `modules/gestion-peligros/metodologia-ipevr/metodologia-ipevr-view.html`

---

## 4.1.2 Identificación de Peligros

### Descripción

Registro sistemático de peligros asociados a cada actividad, proceso y puesto de trabajo.

### Funcionalidades

- ✅ Matriz de identificación de peligros
- ✅ Clasificación por factor de riesgo (físico, químico, biológico, etc.)
- ✅ Evaluación de riesgo (probabilidad × consecuencias)
- ✅ Heatmap de peligros por área
- ✅ Filtros por categoría, nivel de riesgo, área

### Contratos IPC Relacionados

```javascript
// Leer matriz de peligros
const data = await window.electronAPI['matrizPeligros.read'](empresaPath);

// Generar heatmap
const heatmap = await window.electronAPI['matrizPeligros.heatmap'](empresaPath);

// Crear nuevo peligro
await window.electronAPI['matrizPeligros.create']({ empresaPath, peligro });

// Actualizar peligro existente
await window.electronAPI['matrizPeligros.update']({ empresaPath, id, changes });

// Eliminar peligro
await window.electronAPI['matrizPeligros.delete']({ empresaPath, id });
```

### Archivos

- `modules/gestion-peligros/identificacion-peligros/identificacion-peligros-component.js`
- `modules/gestion-peligros/identificacion-peligros/identificacion-peligros-viewer.js`
- `modules/gestion-peligros/identificacion-peligros/identificacion-peligros-view.html`

---

## 4.1.3 Sustancias Químicas

### Descripción

Inventario y gestión de sustancias químicas presentes en el lugar de trabajo, con hojas de seguridad (SDS).

### Funcionalidades

- 🟡 Registro de sustancias químicas (generic fallback)
- 🟡 Hojas de datos de seguridad (SDS)
- 🟡 Etiquetado y rotulado

### Componente Renderer

- Ruta en renderer.js: `gestion-peligros/sustancias-quimicas`
- Redirige a vista genérica del módulo

---

## 4.1.4 Mediciones Ambientales

### Descripción

Registro de mediciones ambientales (ruido, iluminación, temperatura, ventilación, etc.) realizadas en el lugar de trabajo.

### Funcionalidades

- 🟡 Registro de mediciones (generic fallback)
- 🟡 Comparación con valores límite permisibles
- 🟡 Histórico de mediciones

### Componente Renderer

- Ruta en renderer.js: `gestion-peligros/mediciones-ambientales`
- Redirige a vista genérica del módulo

---

## 4.2.1 Medidas de Prevención y Control

### Descripción

Registro de medidas de prevención y control implementadas para cada peligro identificado.

### Funcionalidades

- 🟡 Registro de medidas (generic fallback)
- 🟡 Clasificación: eliminación, sustitución, control ingeniería, administrativo, EPP
- 🟡 Seguimiento de implementación

### Componente Renderer

- Ruta en renderer.js: `gestion-peligros/medidas-prevencion`
- Redirige a vista genérica del módulo

---

## 4.2.2 Aplicación Medidas de Prevención

### Descripción

Verificación de la aplicación efectiva de las medidas de prevención y control definidas.

### Funcionalidades

- 🟡 Verificación de aplicación (generic fallback)
- 🟡 Registro de evidencias

### Componente Renderer

- Ruta en renderer.js: `gestion-peligros/aplicacion-medidas`
- Redirige a vista genérica del módulo

---

## 4.2.3 Evaluación de Procedimientos

### Descripción

Evaluación de procedimientos de trabajo seguro para las actividades de mayor riesgo.

### Funcionalidades

- 🟡 Registro de procedimientos (generic fallback)
- 🟡 Evaluación de cumplimiento
- 🟡 Actualizaciones y versiones

### Componente Renderer

- Ruta en renderer.js: `gestion-peligros/evaluacion-procedimientos`
- Redirige a vista genérica del módulo

---

## 4.2.4 Inspecciones Sistemáticas

### Descripción

Programa de inspecciones sistemáticas a instalaciones, equipos y procesos para detectar condiciones de riesgo.

### Funcionalidades

- ✅ Crear inspecciones con formularios dinámicos
- ✅ Asignar responsables y fechas
- ✅ Registro de hallazgos y no conformidades
- ✅ Plan de acción correctiva
- ✅ Estadísticas y dashboards (18 IPC handlers)

### Contratos IPC Relacionados

```javascript
// Estadísticas de inspecciones
const stats = await window.electronAPI['inspecciones.getStats'](empresaPath);

// Crear nueva inspección
await window.electronAPI['inspecciones.createInspection']({ empresaPath, inspection });

// Leer inspecciones
const list = await window.electronAPI['inspecciones.read'](empresaPath);

// Actualizar inspección
await window.electronAPI['inspecciones.update']({ empresaPath, id, changes });
```

### Archivos

- `modules/gestion-peligros/inspecciones/inspecciones-component.js`
- `modules/gestion-peligros/inspecciones/inspecciones-viewer.js`
- `modules/gestion-peligros/inspecciones/inspecciones-view.html`

---

## 4.2.5 Mantenimiento Periódico

### Descripción

Programa de mantenimiento periódico de instalaciones, equipos y herramientas, con control mensual de cumplimiento.

### Funcionalidades

- ✅ Registro de actividades de mantenimiento
- ✅ Control mensual (12 posiciones: null / 'P' programado / 'C' cumplido)
- ✅ Toggle mes (P↔C)
- ✅ Estadísticas de cumplimiento (11 IPC handlers)

### Contratos IPC Relacionados

```javascript
// Leer datos de mantenimiento
const data = await window.electronAPI['mantenimiento.read'](empresaPath);

// Toggle mes (programado/cumplido)
await window.electronAPI['mantenimiento.toggleMonth']({ empresaPath, activityId, monthIndex });

// Estadísticas
const stats = await window.electronAPI['mantenimiento.getStats'](empresaPath);
```

### Archivos

- `modules/gestion-peligros/mantenimiento/mantenimiento-component.js`
- `modules/gestion-peligros/mantenimiento/mantenimiento-viewer.js`
- `modules/gestion-peligros/mantenimiento/mantenimiento-view.html`

---

## 4.2.6 Entrega de EPP

### Descripción

Registro de entrega de Elementos de Protección Personal (EPP) a trabajadores, con firma de acuse de recibo.

### Funcionalidades

- 🟡 Registro de entrega (generic fallback)
- 🟡 Control de dotación por trabajador
- 🟡 Firma de acuse de recibo

### Componente Renderer

- Ruta en renderer.js: `gestion-peligros/entrega-epp`
- Redirige a vista genérica del módulo

---

## 2. Cambios Recientes

### Versión 0.1.99 (9 junio 2026)

- ✅ Documentación dedicada del Módulo 4
- ✅ 10 submódulos documentados (5 con implementación real, 5 con generic fallback)
- ✅ Contratos IPC: 25 matriz peligros, 18 inspecciones, 11 mantenimiento

---

**Mantenido por:** Product Architect & Full-Stack Team
**Última actualización:** 9 de junio de 2026
**Versión:** 1.0 (v0.1.99)

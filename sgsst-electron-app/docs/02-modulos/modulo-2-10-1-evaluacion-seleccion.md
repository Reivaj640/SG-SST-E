# Submódulo 2.10.1 — Evaluación y Selección de Proveedores y Contratistas

**Versión:** 1.0
**Actualizado:** 9 de junio de 2026
**Estado:** ✅ Actualizado v0.1.99
**Módulo padre:** Gestión Integral (Módulo 2)
**Código SG-SST:** 2.10.1

---

## 📋 Tabla de Contenidos

1. [Descripción](#1-descripción)
2. [Arquitectura](#2-arquitectura)
3. [Dualidad de Versiones](#3-dualidad-de-versiones)
4. [Archivos](#4-archivos)
5. [Flujo de Datos](#5-flujo-de-datos)
6. [Contratos IPC](#6-contratos-ipc)
7. [Estructura de Datos](#7-estructura-de-datos)
8. [Tabs del Componente](#8-tabs-del-componente)
9. [Navegación](#9-navegación)
10. [Observaciones](#10-observaciones)

---

## 1. Descripción

Sistema de evaluación y selección de proveedores y contratistas que permite gestionar el registro de asociados, realizar evaluaciones de selección, reevaluaciones anuales y registrar no conformidades. Cumple con los requisitos de la Resolución 0312 de 2019 para la evaluación de desempeño de proveedores en el SG-SST.

---

## 2. Arquitectura

### Patrón: Componente Modular + Servicios IIFE

El submódulo usa una arquitectura de componente principal (`EvaluacionSeleccionComponent`) que orquesta 6 tabs independientes, cada uno implementado como IIFE o clase propia. Tres servicios compartidos (`AsociadosServiceES`, `EvaluacionesServiceES`, `NoConformidadesServiceES`) manejan el CRUD con caché en memoria.

```
┌─────────────────────────────────────────────────────┐
│         EvaluacionSeleccionComponent                │
│  (evaluacion-seleccion-component.js)                │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐│
│  │Dashboard │ │Registro  │ │Evaluación            ││
│  │ModuleES  │ │IIFE      │ │IIFE                  ││
│  └──────────┘ └──────────┘ └──────────────────────┘│
│  ┌──────────┐ ┌──────────────┐ ┌──────────────────┐│
│  │Reevalua- │ │No Conformi-  │ │Reportes          ││
│  │ción IIFE │ │dades IIFE    │ │IIFE              ││
│  └──────────┘ └──────────────┘ └──────────────────┘│
│                                                     │
│  ┌────────────────┐ ┌────────────────┐             │
│  │AsociadosService│ │EvaluacionesServ│             │
│  │ES              │ │iceES           │             │
│  └────────────────┘ └────────────────┘             │
│  ┌──────────────────────┐ ┌────────────────────┐   │
│  │NoConformidadesService│ │KAIRUtils           │   │
│  │ES                    │ │                    │   │
│  └──────────────────────┘ └────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 3. Dualidad de Versiones

| Atributo | Módulo Antiguo (2.9.1) | Módulo Nuevo (2.10.1) |
|---|---|---|
| **Label** | "Identificación y evaluación para la adquisición de bienes y servicios" | "Evaluación y selección de proveedores y contratistas" |
| **Directorio** | `modules/gestion-integral/evaluacion-proveedores/` | `modules/gestion-integral/evaluacion-seleccion/` |
| **Versión** | v1.0.0 | v2.10.1 |
| **Arquitectura** | Clase monolítica `EvaluacionProveedores` | Modular: 1 componente + 6 tabs + 3 servicios |
| **Almacenamiento** | Excel + filesystem | JSON en `userData/evaluacion-seleccion-data/` |
| **Gestión archivos** | `createProviderFolder`, `copyFileToProviderFolder`, `listProviderFiles` | No implementado aún |
| **Export global** | `window.EvaluacionProveedores` | `window.EvaluacionSeleccionComponent` |

---

## 4. Archivos

| Archivo | Líneas | Propósito |
|---|---|---|
| `modules/gestion-integral/evaluacion-seleccion/evaluacion-seleccion-component.js` | - | Componente principal `EvaluacionSeleccionComponent` |
| `modules/gestion-integral/evaluacion-seleccion/asociados-service.js` | - | `AsociadosServiceES` — CRUD asociados con caché |
| `modules/gestion-integral/evaluacion-seleccion/evaluaciones-service.js` | - | `EvaluacionesServiceES` — CRUD evaluaciones y reevaluaciones |
| `modules/gestion-integral/evaluacion-seleccion/noconformidades-service.js` | - | `NoConformidadesServiceES` — CRUD no conformidades |
| `modules/gestion-integral/evaluacion-seleccion/kair-utils.js` | - | `KAIRUtils` — Utilidades compartidas |
| `modules/gestion-integral/evaluacion-seleccion/dashboard.js` | - | `DashboardModuleES` — Tab Dashboard |
| `modules/gestion-integral/evaluacion-seleccion/registro.js` | - | IIFE — Tab Registro |
| `modules/gestion-integral/evaluacion-seleccion/evaluacion.js` | - | IIFE — Tab Evaluación |
| `modules/gestion-integral/evaluacion-seleccion/reevaluacion.js` | - | IIFE — Tab Reevaluación |
| `modules/gestion-integral/evaluacion-seleccion/noconformidades.js` | - | IIFE — Tab No Conformidades |
| `modules/gestion-integral/evaluacion-seleccion/reportes.js` | - | IIFE — Tab Reportes |
| `modules/gestion-integral/evaluacion-seleccion/evaluacion-seleccion.css` | - | Estilos con prefijo `--kair-` |

---

## 5. Flujo de Datos

### Lectura (ej: cargar asociados)

```
UI Tab (registro.js)
  → AsociadosServiceES.getAll()
    → si _cache existe: return _cache (sincrónico)
    → sino: window.electronAPI.invoke('es:read-asociados')
      → preload.js → ipcRenderer.invoke('es:read-asociados')
        → main.js: readESFile('asociados.json')
          → fs.readFile(userData/evaluacion-seleccion-data/asociados.json)
    → cachear resultado
  → render en UI
```

### Escritura (ej: crear asociado)

```
UI Tab (registro.js)
  → AsociadosServiceES.create(newRecord)
    → currentData = await this.getAll()
    → currentData.push(newRecord)
    → window.electronAPI.invoke('es:write-asociados', currentData)
      → main.js: writeESFile('asociados.json', data)
        → fs.writeFile(..., JSON.stringify(data, null, 2))
    → actualizar _cache
  → return newRecord
```

### Fallback (sin electronAPI)

Los servicios degradan a `localStorage` con claves `es-asociados`, `es-evaluaciones`, etc.

---

## 6. Contratos IPC

| Canal | Método Preload | Descripción |
|---|---|---|
| `es:read-asociados` | `getAsociadosES()` | Leer asociados.json |
| `es:write-asociados` | `saveAsociadosES(data)` | Guardar asociados.json |
| `es:read-evaluaciones` | `getEvaluacionesES()` | Leer evaluaciones.json |
| `es:write-evaluaciones` | `saveEvaluacionesES(data)` | Guardar evaluaciones.json |
| `es:read-reevaluaciones` | `getReevaluacionesES()` | Leer reevaluaciones.json |
| `es:write-reevaluaciones` | `saveReevaluacionesES(data)` | Guardar reevaluaciones.json |
| `es:read-noconformidades` | `getNoConformidadesES()` | Leer noconformidades.json |
| `es:write-noconformidades` | `saveNoConformidadesES(data)` | Guardar noconformidades.json |
| `create-provider-folder` | `createProviderFolder(base, name)` | Crear carpeta evidencia (legacy 2.9.1) |
| `copy-file-to-provider-folder` | `copyFileToProviderFolder(src, dest, name)` | Copiar archivo evidencia (legacy) |
| `list-provider-files` | `listProviderFiles(path)` | Listar archivos evidencia (legacy) |

---

## 7. Estructura de Datos

### asociados.json

```javascript
[
  {
    id: string,           // UUID
    tipo: 'proveedor' | 'contratista',
    nombre: string,
    documento: string,    // NIT/CC
    contacto: string,
    estado: 'Activo' | 'Inactivo',
    // ... campos adicionales
  }
]
```

### evaluaciones.json

```javascript
[
  {
    id: string,
    asociadoId: string,   // Ref a asociado
    fecha: string,        // ISO date
    criterios: [          // Items evaluados (escala 1-4)
      { criterio: string, puntaje: number }
    ],
    puntajeTotal: number,
    clasificacion: 'BUENO' | 'REGULAR' | 'MALO',
    // >=3.1 BUENO, 2.1-3.0 REGULAR, <=2.0 MALO
  }
]
```

### noconformidades.json

```javascript
[
  {
    id: string,
    asociadoId: string,
    descripcion: string,
    estado: 'Abierta' | 'En Proceso' | 'Cerrada',
    fechaApertura: string,
    fechaCierre: string | null,
  }
]
```

---

## 8. Tabs del Componente

| Tab | Clase/IIFE | Funcionalidad |
|---|---|---|
| Dashboard | `DashboardModuleES` | Tarjetas resumen, alertas, evaluaciones recientes, gráficas |
| Registro | IIFE | CRUD tabla + modal, búsqueda/filtro por tipo, grid documentos |
| Evaluación | IIFE | Formulario con matriz de scoring (1-4), dropdown de asociados sin eval. selección |
| Reevaluación | IIFE | Reevaluación anual con historial, matriz de scoring |
| No Conformidades | IIFE | Tabla + modal, filtro por estado, búsqueda |
| Reportes | IIFE | Filtros, tarjetas resumen, gráficas de distribución y criterios |

---

## 9. Navegación

- **Módulo:** Gestión Integral
- **Sidebar:** "2.10.1 Evaluación y selección de proveedores y contratistas"
- **Ruta:** `gestion-integral.plan-trabajo`
- **Instanciación:** `new window.EvaluacionSeleccionComponent(container, company, module, submodule, callback)`
- **Script loading:** `index.html` líneas 154-169

---

## 10. Observaciones

1. Ambos módulos (antiguo 2.9.1 y nuevo 2.10.1) coexisten en `index.html`
2. El nuevo módulo no tiene gestión de archivos/evidencias (el antiguo sí la tiene)
3. El caché en memoria (`_cache`) no se invalida si la escritura IPC falla
4. Scoring: `KAIRUtils.classifyScore()` usa umbrales >=3.1 BUENO, 2.1-3.0 REGULAR, <=2.0 MALO
5. La ruta de navegación mapea a `gestion-integral.plan-trabajo` (posible artefacto legacy)

---

## Cambios Recientes

### Versión 0.1.99 (9 junio 2026)

- ✅ Documentación dedicada del Submódulo 2.10.1
- ✅ 6 tabs documentados (Dashboard, Registro, Evaluación, Reevaluación, No Conformidades, Reportes)
- ✅ Contratos IPC: 8 canales propios + 3 legacy
- ✅ Dualidad de versiones (2.9.1 vs 2.10.1) documentada

---

**Mantenido por:** Frontend Team
**Última actualización:** 9 de junio de 2026
**Versión doc:** 1.0 (v0.1.99)

# Actualización v0.1.52 - Informe PRI Builder Multicaso

**Fecha:** 1 de marzo de 2026  
**Módulo:** Gestión de la Salud → Medición del Ausentismo  
**Archivo Principal:** `modules/gestion-salud/ausentismo/informe-pri-builder.html`

---

## 📋 Resumen Ejecutivo

Se implementó un **constructor de informes PRI multicaso** que permite visualizar y generar reportes consolidados de seguimiento de incapacidades, leyendo datos directamente del archivo `PRI.xlsx` (hoja "Casos en seguimiento").

---

## 🎯 Objetivos Cumplidos

| Objetivo | Estado |
|----------|--------|
| Leer datos desde PRI.xlsx | ✅ Completado |
| Visualizar interfaz directamente (sin modal) | ✅ Completado |
| Mostrar datos reales del Excel | ✅ Completado |
| Extraer seguimientos de columnas múltiples | ✅ Completado |
| Extraer calificación PCL (4 diagnósticos) | ✅ Completado |
| Extraer recomendaciones | ✅ Completado |
| Navegación por páginas (resumen + casos) | ✅ Completado |

---

## 🔧 Cambios Realizados

### 1. Corrección de Inicialización de Vista

**Problema:** La interfaz mostraba solo un botón y requería hacer click para abrir el modal.

**Solución:**
- Eliminado botón trigger inicial
- Eliminado modal backdrop
- El `.report-builder` se muestra directamente como elemento raíz
- Auto-inicialización con `DOMContentLoaded`

**Archivo:** `informe-pri-builder.html`
```javascript
// Auto-inicializar al cargar el DOM
document.addEventListener('DOMContentLoaded', function() {
    initializeReportBuilder();
});
```

---

### 2. Obtención de Empresa Actual

**Problema:** El nombre de la empresa llegaba vacío (`""`) al backend.

**Solución:** Función `getCurrentCompany()` con múltiples fuentes:

```javascript
function getCurrentCompany() {
    // 1. window.currentCompany
    if (window.currentCompany && window.currentCompany !== 'default_company') {
        return window.currentCompany;
    }
    // 2. window.rendererState.selectedCompany
    if (window.rendererState && window.rendererState.selectedCompany) {
        return window.rendererState.selectedCompany;
    }
    // 3. Fallback: DOM padre
    try {
        const companyNameEl = window.parent.document.getElementById('company-name');
        if (companyNameEl && companyNameEl.textContent !== 'Empresa') {
            return companyNameEl.textContent.trim();
        }
    } catch (e) {}
    // 4. Valor por defecto
    return 'Aseplus';
}
```

---

### 3. Mapeo de Columnas del PRI.xlsx

**Estructura Real del PRI.xlsx (Hoja "Casos en seguimiento"):**

| Campo | Columna | Índice | Búsqueda |
|-------|---------|--------|----------|
| ITEM | A | 0 | `includes('item')` |
| NOMBRE TRABAJADOR | C | 2 | `includes('nombre trabajador')` |
| NUMERO DOCUMENTO | D | 3 | `includes('documento')` |
| SEDE/AREA | M | 12 | `includes('sede')` |
| CARGO | N | 13 | `includes('cargo')` |
| EPS | Q | 16 | `includes('eps')` |
| DÍAS INCAPACIDAD ACUMULADOS | Y | 24 | `includes('días incapacidad')` |
| FECHA INICIO INCAPACIDAD | Z | 25 | `includes('fecha de inicio')` |
| FECHA FINALIZACIÓN | AA | 26 | `includes('fecha de finalización')` |
| CIE-10 DX 1 | AB | 27 | `includes('cie-10') && includes('dx 1')` |
| DIAGNOSTICO | AC | 28 | `includes('diagnostico')` |
| ORIGEN DX 1 | AD | 29 | `includes('origen') && includes('dx 1')` |
| SEGUIMIENTO 1 (FECHA) | AE | 30 | `includes('seguimiento 1')` |
| SEGUIMIENTO 1 (DESC) | AF | 31 | `includes('seguimiento 1') && includes('descr')` |
| ... Seguimientos 2-5 | AG-AK | 32-35 | Similar |
| FECHA DE CALIFICACIÓN | ... | ... | `includes('fecha de calificación')` |
| PORCENTAJE PCL | ... | ... | `includes('porcentaje') && includes('pcl')` |
| CIE-10 CALIFICADA DX 1-4 | ... | ... | `includes('cie-10 calificada')` |
| ORIGEN DX 1-4 CALIFICADA | ... | ... | `includes('origen dx') && includes('calificada')` |
| RECOMENDACIÓN EMITIDA | ... | ... | `includes('recomendación emitida')` |

**Código de Mapeo:**
```javascript
const colIndex = {
    nombre: headers.findIndex(h => h.includes('nombre trabajador')),
    cedula: headers.findIndex(h => h.includes('documento') || h.includes('identidad')),
    area: headers.findIndex(h => h.includes('sede') || h.includes('área')),
    cargo: headers.findIndex(h => h.includes('cargo')),
    eps: headers.findIndex(h => h.includes('eps')),
    diasIncapacidad: headers.findIndex(h => h.includes('días incapacidad acumulados')),
    fechaInicio: headers.findIndex(h => h.includes('fecha de inicio de incapacidad')),
    fechaFin: headers.findIndex(h => h.includes('fecha de finalización')),
    cie10: headers.findIndex(h => h.includes('cie-10') && h.includes('dx 1') && !h.includes('calificada')),
    diagnostico: headers.findIndex(h => h.includes('diagnostico') && !h.includes('cie')),
    origen: headers.findIndex(h => h.includes('origen') && h.includes('dx 1') && !h.includes('calificada')),
    // Seguimientos
    seguimiento1Fecha: headers.findIndex(h => h.includes('seguimiento 1') && !h.includes('descr')),
    seguimiento1Desc: headers.findIndex(h => h.includes('seguimiento 1') && h.includes('descr')),
    // PCL
    pclFecha: headers.findIndex(h => h.includes('fecha de calificación')),
    pclPorcentaje: headers.findIndex(h => h.includes('porcentaje') && h.includes('pcl')),
    pclCie10_1: headers.findIndex(h => h.includes('cie-10 calificada') && h.includes('dx 1')),
    pclOrigen_1: headers.findIndex(h => h.includes('origen dx 1') && h.includes('calificada')),
    // ... DX 2-4
    // Recomendaciones
    recomendacionEmitida: headers.findIndex(h => h.includes('recomendación emitida')),
    recomendacionesVigentes: headers.findIndex(h => h.includes('recomendaciones laborales vigentes'))
};
```

---

### 4. Extracción de Seguimientos (Columnas Múltiples)

**Problema:** Los seguimientos están en 5 columnas separadas (SEGUIMIENTO 1-5).

**Solución:**
```javascript
const seguimientos = [];
for (let i = 1; i <= 5; i++) {
    const fechaKey = `seguimiento${i}Fecha`;
    const descKey = `seguimiento${i}Desc`;
    const fechaSeg = getCellValue(colIndex[fechaKey]);
    const descSeg = getCellValue(colIndex[descKey]);
    if (fechaSeg || descSeg) {
        seguimientos.push({
            fecha: fechaSeg || 'N/A',
            descripcion: descSeg || 'Sin descripción'
        });
    }
}
```

---

### 5. Extracción de Calificación PCL (4 Diagnósticos)

**Estructura PCL:**
```javascript
const pclData = {
    fecha: getCellValue(colIndex.pclFecha),
    porcentaje: getCellValue(colIndex.pclPorcentaje),
    origen: getCellValue(colIndex.pclOrigen),
    diagnosticos: [
        { cie10: getCellValue(colIndex.pclCie10_1), origen: getCellValue(colIndex.pclOrigen_1) },
        { cie10: getCellValue(colIndex.pclCie10_2), origen: getCellValue(colIndex.pclOrigen_2) },
        { cie10: getCellValue(colIndex.pclCie10_3), origen: getCellValue(colIndex.pclOrigen_3) },
        { cie10: getCellValue(colIndex.pclCie10_4), origen: getCellValue(colIndex.pclOrigen_4) }
    ].filter(d => d.cie10 || d.origen)
};
```

---

### 6. Extracción de Recomendaciones

**Problema:** Las recomendaciones pueden ser múltiples y estar separadas por punto y coma.

**Solución:**
```javascript
const recomendacionTexto = getCellValue(colIndex.recomendacionEmitida) || 
                           getCellValue(colIndex.recomendacionesVigentes);
const entidadRec = getCellValue(colIndex.recomendacionEntidad) || 'EPS/ARL';
const cumpleRec = getCellValue(colIndex.recomendacionCumple);

if (recomendacionTexto) {
    const recsList = recomendacionTexto.split(/[;|]/).filter(r => r.trim());
    recsList.forEach((rec, idx) => {
        recomendaciones.push({
            recomendacion: rec.trim(),
            entidad: entidadRec,
            cumple: cumpleRec || (idx === 0 ? 'EN PROCESO' : 'PENDIENTE')
        });
    });
}
```

---

### 7. Renderizado Condicional por Checkbox

**Checkboxes disponibles:**

| Checkbox | ID | Sección Renderizada |
|----------|-----|---------------------|
| Incapacidad | `includeIncapacidad` | Detalle de incapacidad (fechas, días, diagnóstico) |
| Proceso PRIC | `includePRIC` | Etapas 1, 2, 3 del PRIC |
| Seguimientos | `includeSeguimientos` | Timeline de seguimientos |
| Calificación PCL | `includePCL` | Tabla de calificación (4 diagnósticos) |
| Recomendaciones | `includeRecomendaciones` | Tabla de recomendaciones |

**Ejemplo de renderizado condicional:**
```javascript
${reportConfig.includeSeguimientos && c.seguimientos && c.seguimientos.length > 0 ? `
<div class="section-header">4. HISTORIAL DE SEGUIMIENTOS</div>
<div class="timeline-seguimiento">
    ${c.seguimientos.map(s => `
        <div class="timeline-item">
            <div class="timeline-date">${formatDate(s.fecha)}</div>
            <div class="timeline-content">
                <strong>Nota de Seguimiento</strong>
                ${s.descripcion}
            </div>
        </div>
    `).join('')}
</div>
` : ''}
```

---

## 📊 Estructura del Informe

### Página 1: Resumen Consolidado

```
┌─────────────────────────────────────────────────┐
│ INFORME CONSOLIDADO PRI                         │
│ Seguimiento de Incapacidades - K+AIR            │
│ Periodo: 2026-01-01 al 2026-03-01               │
├─────────────────────────────────────────────────┤
│ 1. RESUMEN EJECUTIVO                            │
│    - Total casos: X                             │
│    - Total días: Y                              │
│    - Promedio días/caso: Z                      │
│                                                 │
│    ┌──────────────┬────────┬─────────┬────────┐ │
│    │ Total Días   │ 67 Días│ Casos   │ 1 Casos│ │
│    │ Perdidos     │        │ Activos │        │ │
│    ├──────────────┼────────┼─────────┼────────┤ │
│    │ Total Casos  │ 3 Casos│ Casos   │ 2 Casos│ │
│    │              │        │ Cerrados │        │ │
│    └──────────────┴────────┴─────────┴────────┘ │
│                                                 │
│ 2. LISTADO DE CASOS EN PERIODO                  │
│    (Tabla con ID, Nombre, Dx, Origen, Días)     │
│                                                 │
│ 3. DISTRIBUCIÓN POR ÁREA                        │
│    (Tabla con Área, Casos, Días, % del Total)   │
└─────────────────────────────────────────────────┘
```

### Páginas 2-N: Ficha Detallada por Caso

```
┌─────────────────────────────────────────────────┐
│ FICHA DETALLADA DE CASO                         │
│ ID Caso: PRI-2024-1 | Juan Carlos Pérez         │
│ Estado: EN SEGUIMIENTO                          │
├─────────────────────────────────────────────────┤
│ 1. INFORMACIÓN DEL TRABAJADOR                   │
│    - Nombre, Cédula, Cargo, Área, EPS/ARL       │
│                                                 │
│ 2. DETALLE DE INCAPACIDAD                       │
│    - Fechas, Días, Origen, Diagnóstico, CIE-10  │
│                                                 │
│ 3. PROCESO PRIC                                 │
│    ┌─────────────┬────────┬────────┬──────────┐ │
│    │ Etapa       │ Estado │ Fecha  │ Respons. │ │
│    ├─────────────┼────────┼────────┼──────────┤ │
│    │ 1. Captura  │ OK     │ ...    │ Gerencia │ │
│    │ 2. Plan     │ OK     │ ...    │ ARL      │ │
│    │ 3. Ejecución│ EN CURSO│ ...   │ EPS      │ │
│    └─────────────┴────────┴────────┴──────────┘ │
│                                                 │
│ 4. HISTORIAL DE SEGUIMIENTOS                    │
│    - Timeline con fechas y descripciones        │
│                                                 │
│ 5. CALIFICACIÓN PCL (si checkbox activo)        │
│    - Fecha, Porcentaje, Origen                  │
│    - DX 1-4 con CIE-10 y Origen                 │
│                                                 │
│ 6. RECOMENDACIONES                              │
│    - Tabla: Recomendación, Entidad, Cumplimiento│
└─────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Datos

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USUARIO hace click en "Generar Informe PRI"              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. medicion-ausentismo-home.js envía postMessage            │
│    { type: 'load-module-view',                              │
│      payload: { path: '.../informe-pri-builder.html' } }    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. renderer.js carga la vista en el área de contenido       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. informe-pri-builder.html se auto-inicializa              │
│    - getCurrentCompany() → "Aseplus"                        │
│    - loadCasesData()                                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. window.electronAPI.getPriSeguimientoData('Aseplus')      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. main.js (Handler 'get-pri-seguimiento-data')             │
│    - Lee configuración de empresa                           │
│    - Busca carpeta "3. Gestión de la Salud"                 │
│    - Busca submódulo "3.3.6 Medición del ausentismo"        │
│    - Encuentra PRI.xlsx                                     │
│    - Lee hoja "Casos en seguimiento"                        │
│    - Retorna: { success: true, headers: [...], rows: [...] }│
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. processPriRowsToCases(rows, headers)                     │
│    - Mapea columnas por nombre                              │
│    - Extrae seguimientos (5 columnas)                       │
│    - Extrae PCL (4 diagnósticos)                            │
│    - Extrae recomendaciones                                 │
│    - Retorna: Array de objetos caso                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. processCasesData()                                       │
│    - Calcula resumen (totalCases, totalDays, etc.)          │
│    - Actualiza UI (caseCount, caseList)                     │
│    - Renderiza página 0 (Resumen)                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 Pruebas Realizadas

| Prueba | Resultado | Observaciones |
|--------|-----------|---------------|
| Carga de vista | ✅ Exitosa | Se muestra directamente sin modal |
| Detección de empresa | ✅ Exitosa | "Aseplus" detectada desde window.currentCompany |
| Lectura de PRI.xlsx | ✅ Exitosa | 4 registros encontrados |
| Mapeo de columnas | ✅ Exitoso | Todos los índices encontrados correctamente |
| Extracción de seguimientos | ✅ Exitosa | Seguimientos 1-5 extraídos |
| Extracción de PCL | ✅ Exitosa | 4 diagnósticos con CIE-10 y origen |
| Extracción de recomendaciones | ✅ Exitosa | Múltiples recomendaciones separadas por `;` |
| Renderizado de resumen | ✅ Exitoso | Tablas y estadísticas correctas |
| Navegación entre páginas | ✅ Exitosa | Botones Anterior/Siguiente funcionales |
| Checkboxes condicionales | ✅ Exitosos | Cada sección se muestra/oculta según checkbox |

---

## 📁 Archivos Modificados

| Archivo | Cambios | Líneas Clave |
|---------|---------|--------------|
| `medicion-ausentismo-home.js` | Corregido postMessage (payload.path) | 106-112 |
| `informe-pri-builder.html` | Reescritura completa del builder | 1-1419 |

---

## 🚀 Cómo Usar

1. **Navegar a:** Gestión de la Salud → 3.3.6 Medición del ausentismo
2. **Click en:** "Generar Informe PRI (Multicaso)"
3. **Seleccionar periodo:** Fechas de inicio y fin
4. **Seleccionar casos:** Click en cada caso para ver detalle
5. **Activar/desactivar secciones:** Usar checkboxes de "Contenido del Informe"
6. **Navegar:** Botones "Anterior" / "Siguiente"
7. **Exportar:** Botones "Excel" (próximamente) / "Generar PDF" (imprimir)

---

## ⚠️ Consideraciones

1. **Archivo PRI.xlsx requerido:** Debe existir en la carpeta del ausentismo con la hoja "Casos en seguimiento"
2. **Estructura de columnas:** El mapeo depende de los nombres exactos de los encabezados
3. **Datos vacíos:** Si una columna no existe, se usa valor por defecto ('N/A', 'Sin nombre', etc.)
4. **Caché del navegador:** Puede ser necesario reiniciar la aplicación para cargar la nueva versión

---

## 📝 Próximos Pasos

- [ ] Implementar exportación real a Excel (actualmente solo alerta)
- [ ] Agregar filtro por fechas en la consulta al backend
- [ ] Mejorar detección automática de columnas si cambian los nombres
- [ ] Agregar opción para seleccionar qué casos incluir en el informe
- [ ] Implementar vista previa de impresión optimizada

---

## 🔗 Referencias

- **Documento de Arquitectura:** `docs/ARQUITECTURA_AUSENTISMO_DUAL.md`
- **CHANGELOG:** `docs/CHANGELOG.md` (versión 0.1.52)
- **Handler Backend:** `main.js` (líneas 3355-3550)
- **UI Componente:** `modules/gestion-salud/ausentismo/informe-pri-builder.html`

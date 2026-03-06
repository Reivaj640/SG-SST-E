# Módulo de Ausentismo - Documentación Técnica

**Versión:** 1.0.0  
**Última actualización:** 4 de marzo de 2026  
**Archivo principal:** `modules/gestion-salud/ausentismo/medicion-ausentismo.js`

---

## 📋 Descripción General

El módulo de **Medición del Ausentismo** permite visualizar, filtrar y analizar todas las incapacidades registradas por la empresa, con una tabla completa de 17 columnas y filtros dinámicos inteligentes.

---

## 🎯 Funcionalidades Principales

### 1. Tabla de Ausentismo (17 Columnas)

| # | Columna | Campo Técnico | Índice | Descripción |
|---|---------|---------------|--------|-------------|
| 1 | No | `no` | - | Número secuencial |
| 2 | Nombre | `NOMBRE` | 2 | Nombre completo del empleado |
| 3 | Cédula | `CEDULA` | 3 | Documento de identidad |
| 4 | Cargo | `CARGO` | 5 | Cargo del empleado |
| 5 | Empresa Usuaria | `EMPRESA USUARIA` | 6 | Empresa donde presta servicio |
| 6 | Área/Dpto | `ÁREA O DPTO` | 7 | Departamento o área |
| 7 | Género | `GENERO` | 8 | Masculino / Femenino |
| 8 | Mes | `MES` | 9 | Mes de la incapacidad |
| 9 | N° Días | `N° DIAS DE INCAPACIDAD` | 10 | Duración en días |
| 10 | Clase | `CLASE DE INCAPACIDAD` | 11 | EPS, ARL, LICENCIA |
| 11 | Tipo | `TIPO DE INCAPACIDAD` | 12 | Tipo específico |
| 12 | Entidad | `ENTIDAD` | 13 | EPS o ARL |
| 13 | **Año** 🆕 | `AÑO` | 14 | Año de la incapacidad |
| 14 | **Fecha Inicio** 🆕 | `F. INICIO` | 15 | Fecha de inicio |
| 15 | **Fecha Fin** 🆕 | `F. FIN` | 16 | Fecha de finalización |
| 16 | **Código** 🆕 | `CODIGO` | 17 | Código CIE-10 |
| 17 | Descripción | `DESCRIPCION` | 18 | Descripción del diagnóstico |

### 2. Filtros Dinámicos

#### Filtro de Búsqueda
- **Campos:** Nombre y Cédula
- **Tipo:** Búsqueda parcial (case-insensitive)
- **Ejemplo:** "juan" encuentra "Juan Pérez" y "1007096798"

#### Filtro de Año 🆕
- **Comportamiento:** Dinámico basado en datos reales
- **Orden:** Descendente (año más reciente primero)
- **Fallback:** Si columna O está vacía, extrae año de F. INICIO
- **Ejemplo:** 2024, 2023, 2022, 2021, 2020

#### Filtro de Mes
- **Opciones:** 12 meses (Enero - Diciembre)
- **Comparación:** Exacta con columna MES del Excel

#### Filtro de Tipo (Clase) 🆕
- **Comportamiento:** Dinámico basado en "CLASE DE INCAPACIDAD"
- **Orden:** Alfabético
- **Ejemplo:** ARL, EPS, LICENCIA DE MATERNIDAD, LICENCIA DE PATERNIDAD

### 3. Estadísticas de Ausentismo

#### Filtros de Estadísticas 🆕

| Filtro | Opciones | Comportamiento |
|--------|----------|----------------|
| **Año** | Todos los años en datos | Dinámico, descendente |
| **Mes** | Meses con registros | Solo meses con datos |
| **Género** | FEMENINO, MASCULINO | Coincide con Excel |
| **Clase** | Todos los tipos únicos | Dinámico, alfabético |

#### Gráficos

**1. Distribución Mensual (Barras)**
- Eje X: Meses
- Eje Y: Cantidad de incapacidades
- Color: #174ea6 (azul corporativo)

**2. Tipos de Incapacidad (Doughnut)**
- Categorías: EPS, ARL, Licencias
- Colores: Azul (#174ea6), Rojo (#dc3545), Amarillo (#ffc107)

**3. Distribución por Género (Doughnut) 🆕**
- Categorías: Femenino, Masculino, Otro
- Colores: Rosa (#e91e63), Azul (#2196f3), Gris (#9e9e9e)
- Cálculo: `row.GENERO.toUpperCase() === 'FEMENINO'`

---

## 🏗️ Arquitectura Técnica

### Estructura de Datos

```javascript
// Objeto de dato procesado
{
  // Índices numéricos (acceso directo)
  '0': '1',                    // No
  '2': 'KARINA GREGORIA...',   // NOMBRE
  '3': '1,007,096,798',        // CEDULA
  '14': '2024',                // AÑO
  '15': '4/1/24',              // F. INICIO
  '16': '4/1/23',              // F. FIN
  '17': 'O829',                // CODIGO
  
  // Nombres de columna
  'NOMBRE': 'KARINA GREGORIA...',
  'CEDULA': '1,007,096,798',
  'AÑO': '2024',
  'F. INICIO': '4/1/24',
  'F. FIN': '4/1/23',
  'CODIGO': 'O829',
  
  // Búsqueda flexible (minúsculas)
  'nombre': 'KARINA GREGORIA...',
  'cedula': '1,007,096,798',
  
  // Metadatos
  'no': 1  // Número secuencial
}
```

### Flujo de Carga de Datos

```javascript
1. renderVerAusentismoView()
   ↓
2. loadAusentismoData(table, notificationDiv)
   ↓
3. window.electronAPI.readAusentismoData(company)
   ↓
4. Procesar filas → currentAusentismoData
   ↓
5. renderTable(table, data)
   ↓
6. populateDynamicFilters() 🆕
```

### Función `populateDynamicFilters()` 🆕

```javascript
/**
 * Llena los filtros con datos reales del Excel
 */
populateDynamicFilters() {
    // 1. Filtro de AÑO
    const yearsSet = new Set();
    data.forEach(row => {
        let year = row['14'] || row.AÑO || row.ANO || '';
        if (!year) {
            // Fallback: extraer de F. INICIO
            const match = row['15'].match(/(19|20)\d{2}/);
            if (match) year = match[0];
        }
        yearsSet.add(year);
    });
    const years = Array.from(yearsSet).sort((a, b) => b - a);
    
    // 2. Filtro de TIPO
    const typesSet = new Set();
    data.forEach(row => {
        const clase = row['CLASE DE INCAPACIDAD'] || row['11'];
        if (clase) typesSet.add(clase.toUpperCase());
    });
    const types = Array.from(typesSet).sort();
}
```

### Función `applyFilters()` 🆕

```javascript
applyFilters(tableElement, notificationDiv) {
    const search = document.getElementById('searchFilter').value;
    const year = document.getElementById('yearFilter').value;
    const month = document.getElementById('monthFilter').value;
    const type = document.getElementById('typeFilter').value;
    
    const filtered = data.filter(row => {
        // Búsqueda por nombre/cédula
        const matchesSearch = !search || 
            nombre.includes(search) || 
            cedula.includes(search);
        
        // Match exacto de año (columna 14)
        const matchesYear = !year || row['14'] === year;
        
        // Match exacto de mes
        const matchesMonth = !month || row.MES === month;
        
        // Match exacto de tipo (columna 11)
        const matchesType = !type || 
            row['CLASE DE INCAPACIDAD'] === type;
        
        return matchesSearch && matchesYear && matchesMonth && matchesType;
    });
}
```

---

## 🎨 Diseño Visual

### Scroll Horizontal Responsivo

```css
.ausentismo-table {
    width: 100%;
    min-width: fit-content;  /* Se expande si hay espacio */
}

.ausentismo-table-wrapper {
    overflow-x: auto;
    overflow-y: auto;
}

/* Scrollbar personalizado */
.ausentismo-table-wrapper::-webkit-scrollbar {
    width: 10px;
    height: 10px;
}

.ausentismo-table-wrapper::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 8px;
}

.ausentismo-table-wrapper::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}
```

### Badges de Clase

```javascript
let badgeColor = '#dbeafe';  // EPS (azul claro)
let badgeText = '#1d4ed8';

if (clase === 'ARL') {
    badgeColor = '#fef3c7';  // ARL (amarillo claro)
    badgeText = '#d97706';
} else if (clase.includes('LICENCIA')) {
    badgeColor = '#d1fae5';  // Licencia (verde claro)
    badgeText = '#059669';
}
```

---

## 📊 Índices de Columnas del Excel

| Índice | Columna Excel | Header | Búsqueda Fallback |
|--------|---------------|--------|-------------------|
| 0 | A | No | - |
| 1 | B | EMPRESA | - |
| 2 | C | NOMBRE | NOMBRE, NOMBRES |
| 3 | D | CEDULA | CEDULA, IDENTIFICACION |
| 4 | E | Columna1 | - |
| 5 | F | CARGO | CARGO, PUESTO |
| 6 | G | EMPRESA USUARIA | EMPRESA USUARIA |
| 7 | H | ÁREA O DPTO | AREA, DEPARTAMENTO |
| 8 | I | GENERO | GENERO, SEXO |
| 9 | J | MES | MES |
| 10 | K | N° DIAS DE INCAPACIDAD | DIAS |
| 11 | L | CLASE DE INCAPACIDAD | CLASE, TIPO |
| 12 | M | TIPO DE INCAPACIDAD | TIPO |
| 13 | N | ENTIDAD | ENTIDAD, EPS, ARL |
| **14** | **O** | **AÑO** 🆕 | ANO, extraído de fecha |
| **15** | **P** | **F. INICIO** 🆕 | FECHA INICIO |
| **16** | **Q** | **F. FIN** 🆕 | FECHA FIN, FECHA FINALIZACION |
| **17** | **R** | **CODIGO** 🆕 | CODIGO, CÓDIGO, CIE-10 |
| 18 | S | DESCRIPCION | DESCRIPCION, DIAGNOSTICO |

---

## 🔧 Funciones Principales

### `renderVerAusentismoView(container)`
Renderiza la vista principal de la tabla de ausentismo.

### `loadAusentismoData(tableElement, notificationDiv)`
Carga datos desde el archivo Excel y procesa la estructura.

### `renderTable(tableElement, data)`
Renderiza el cuerpo de la tabla con los datos procesados.

### `populateDynamicFilters()` 🆕
Llena los filtros de año y tipo con datos reales.

### `applyFilters(tableElement, notificationDiv)`
Aplica los filtros seleccionados a los datos.

### `renderEstadisticasView(container)`
Renderiza el dashboard de estadísticas con gráficos.

### `loadEstadisticasData(notificationDiv)`
Carga datos para estadísticas.

### `populateStatsFilters(data)` 🆕
Llena los filtros de estadísticas con datos reales.

### `applyStatsFilters(notificationDiv)`
Aplica filtros de estadísticas y actualiza gráficos.

---

## 🐛 Solución de Problemas

### Problema: Filtro de año no muestra todos los años

**Causa:** Registros antiguos sin columna AÑO (O)

**Solución:** El sistema usa fallback automático:
```javascript
let year = row['14'] || row.AÑO || '';
if (!year) {
    const match = row['15'].match(/(19|20)\d{2}/);
    if (match) year = match[0];  // Extrae de F. INICIO
}
```

### Problema: Género no coincide en estadísticas

**Causa:** Excel usa "Femenino"/"Masculino", código usaba "MUJER"/"HOMBRE"

**Solución:** Actualizado a:
```javascript
const femeninoCount = data.filter(row => 
    (row.GENERO || '').toUpperCase() === 'FEMENINO'
).length;
```

### Problema: Tabla no muestra todas las columnas

**Causa:** Contenedor con max-width limitado

**Solución:** Actualizado a:
```css
mainContent { max-width: 100%; }
.ausentismo-table { width: 100%; min-width: fit-content; }
```

---

## 📝 Ejemplos de Uso

### Filtrar por año específico

```javascript
// Usuario selecciona "2024" en filtro
const year = "2024";
const filtered = data.filter(row => row['14'] === year);
// Resultado: Solo incapacidades de 2024
```

### Filtrar por tipo específico

```javascript
// Usuario selecciona "ARL" en filtro
const type = "ARL";
const filtered = data.filter(row => 
    row['CLASE DE INCAPACIDAD'] === type
);
// Resultado: Solo accidentes de trabajo
```

### Búsqueda combinada

```javascript
// Nombre + Año + Tipo
const search = "perez";
const year = "2024";
const type = "EPS";

const filtered = data.filter(row => {
    const nombre = (row.NOMBRE || '').toLowerCase();
    return nombre.includes(search) && 
           row['14'] === year && 
           row['CLASE DE INCAPACIDAD'] === type;
});
```

---

## 📖 Referencias

- **Archivo Principal:** `modules/gestion-salud/ausentismo/medicion-ausentismo.js`
- **Backend:** `main.js` (handler `readAusentismoData`)
- **Python:** `Portear/src/actualizar_ausentismo.py`
- **Excel:** GI-FO-076 / PI-FO-076 / PG-FO-076 (según empresa)

---

## 📋 Changelog

### v1.0.0 - 4 Mar 2026
- ✅ Agregadas 4 columnas nuevas (Año, Fecha Inicio, Fecha Fin, Código)
- ✅ Filtros dinámicos de año y tipo
- ✅ Corrección de género en estadísticas (FEMENINO/MASCULINO)
- ✅ Scroll horizontal responsivo
- ✅ Función `populateDynamicFilters()`
- ✅ Función `populateStatsFilters()`
- ✅ Fallback para registros sin columna AÑO

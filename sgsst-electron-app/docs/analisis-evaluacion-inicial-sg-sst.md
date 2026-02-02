# Análisis del Submódulo: 2.3.1 Evaluación Inicial del SG-SST

**Fecha:** 2026-02-02  
**Analista:** Kilo Code  
**Objetivo:** Analizar la función de extracción de datos de PDF y sus conexiones con el resto del código.

---

## 1. Estructura del Submódulo

### Archivos del Submódulo
```
modules/gestion-integral/evaluacion-inicial-sg-sst/
├── evaluacion-inicial-sg-sst.js          # Componente principal de UI
├── evaluacion-inicial-sg-sst-logic.js     # Lógica de carga del componente
├── evaluacion-inicial-sg-sst.css          # Estilos
├── index.js                               # (no analizado en detalle)
└── evaluacion-inicial-sg-sst-test.html    # Archivo de prueba
```

### Archivos Relacionados
```
utils/
└── evaluacionPdfParser.js                 # Parser de PDFs de evaluación

main.js                                     # Handlers IPC
preload.js                                  # Exposición de APIs al renderer
```

---

## 2. Flujo de Datos Completo

### 2.1 Inicialización del Componente

```
evaluacion-inicial-sg-sst-logic.js
    ↓
loadEvaluacionInicialSgSst(container, moduleName, submoduleTitle)
    ↓
new EvaluacionInicialSgSst(container, moduleName, submoduleTitle)
    ↓
evaluacionComponent.render()
```

### 2.2 Flujo de Carga de Archivos

```
EvaluacionInicialSgSst.initializeData()
    ↓
window.electronAPI.findSubmodulePath(company, 'Gestión Integral', '2.3.1 Evaluación inicial del SG-SST')
    ↓
[IPC] find-submodule-path (main.js:2259)
    ↓
searchInStructure(node, '2.3.1')
    ↓
Retorna: { success: true, path: '...' }
    ↓
EvaluacionInicialSgSst.loadRealFiles()
    ↓
window.electronAPI.readDirectory(submodulePath)
    ↓
[IPC] read-directory (main.js:546)
    ↓
Retorna: { success: true, files: [...], folders: [...] }
    ↓
Búsqueda recursiva en subcarpetas: ['Diagnostico Ministerio', 'Diagnostico ARL', 'SGSST']
    ↓
Detección de PDF: reportPdf = allFiles.find(f => f.name.toLowerCase().endsWith('.pdf') && ...)
    ↓
EvaluacionInicialSgSst.processPdfData(pdfPath)
```

### 2.3 Flujo de Procesamiento de PDF

```
EvaluacionInicialSgSst.processPdfData(pdfPath)
    ↓
window.electronAPI.processEvaluacionPdf(pdfPath, sourceType)
    ↓
[IPC] process-evaluacion-pdf (main.js:4030)
    ↓
const EvaluacionPdfParser = require('./utils/evaluacionPdfParser')
    ↓
const parser = new EvaluacionPdfParser()
    ↓
parser.parsePdf(pdfPath, sourceType)
    ↓
[evaluacionPdfParser.js] parsePdf()
    ↓
fs.existsSync(pdfPath) → Verificación de archivo
    ↓
fs.readFileSync(pdfPath) → Lectura del archivo
    ↓
pdfParse(dataBuffer) → Extracción de texto del PDF
    ↓
sourceType === 'ministerio' ? parseMinisterioPdf() : parseArlPdf()
    ↓
calculateMetrics(findings)
    ↓
Retorna: { success: true, findings: [...], metrics: {...} }
    ↓
[IPC] Retorna resultado al renderer
    ↓
EvaluacionInicialSgSst.renderHallazgosTable()
    ↓
EvaluacionInicialSgSst.updateDashboardWithRealData(metrics)
```

---

## 3. Análisis de Contratos y Conexiones

### 3.1 Contratos de API (IPC)

#### `findSubmodulePath(company, module, submodule)`
- **Ubicación:** [`main.js:2259`](main.js:2259)
- **Parámetros:**
  - `companyName`: Nombre de la empresa (ej: 'Tempoactiva')
  - `module`: Nombre del módulo (ej: 'Gestión Integral')
  - `submodule`: Nombre del submódulo (ej: '2.3.1 Evaluación inicial del SG-SST')
- **Retorna:** `{ success: boolean, path?: string, error?: string }`
- **Lógica:**
  - Lee el archivo de configuración (`config.json`)
  - Busca la estructura de la empresa en `config.companyPaths[companyName].structure.structure`
  - Extrae el código del submódulo (ej: '2.3.1')
  - Busca recursivamente usando `searchInStructure()`
  - Para módulos específicos como "Recursos", busca primero en la carpeta del módulo

#### `readDirectory(directoryPath)`
- **Ubicación:** [`main.js:546`](main.js:546)
- **Parámetros:**
  - `directoryPath`: Ruta del directorio a leer
- **Retorna:** `{ success: boolean, files?: Array, folders?: Array, error?: string }`
- **Lógica:**
  - Usa `fsp.readdir()` con `{ withFileTypes: true }`
  - Separa archivos y carpetas
  - Para archivos: incluye nombre, ruta, tamaño, fecha de modificación, extensión
  - Para carpetas: incluye nombre y ruta

#### `processEvaluacionPdf(pdfPath, sourceType)`
- **Ubicación:** [`main.js:4030`](main.js:4030)
- **Parámetros:**
  - `pdfPath`: Ruta del archivo PDF
  - `sourceType`: Tipo de fuente ('ministerio' o 'arl')
- **Retorna:** 
  ```javascript
  {
    success: boolean,
    year: string,
    source: string,
    fileName: string,
    filePath: string,
    findings: Array<{
      code: string,
      cycle: string,
      standard: string,
      desc: string,
      max: number,
      grade: number,
      status: string,
      requiereRevisionManual?: boolean
    }>,
    metrics: {
      cumplimiento: number,
      totalItems: number,
      cumplidos: number,
      noCumplidos: number,
      parcial: number
    },
    error?: string
  }
  ```

### 3.2 Contratos del Parser de PDF

#### `EvaluacionPdfParser.parsePdf(pdfPath, sourceType)`
- **Ubicación:** [`utils/evaluacionPdfParser.js:26`](utils/evaluacionPdfParser.js:26)
- **Validaciones:**
  - Verifica que el archivo existe con `fs.existsSync()`
  - Lee el archivo con `fs.readFileSync()`
  - Extrae texto usando `pdfParse()`
- **Métodos de parsing:**
  - `parseMinisterioPdf(text, filePath)` - Para PDFs del Ministerio
  - `parseArlPdf(text, filePath)` - Para PDFs de ARL
  - `parseGenericPdf(text)` - Fallback genérico

---

## 4. Análisis de Coherencia

### 4.1 Verificación de Archivo Esperado

**Estado:** ✅ **COHERENTE**

El código verifica correctamente la existencia del archivo:

```javascript
// utils/evaluacionPdfParser.js:31-33
if (!fs.existsSync(pdfPath)) {
    throw new Error(`Archivo no encontrado: ${pdfPath}`);
}
```

**Observación:** La verificación se realiza en el lado del proceso principal (main process), lo cual es correcto para operaciones de sistema de archivos en Electron.

### 4.2 Detección de PDF en Directorio

**Estado:** ✅ **COHERENTE**

El componente busca PDFs con criterios específicos:

```javascript
// evaluacion-inicial-sg-sst.js:353-356
const reportPdf = allFiles.find(f => 
    f.name.toLowerCase().endsWith('.pdf') && 
    (f.name.includes('0312') || f.name.includes('evaluacion') || f.name.includes('informe'))
);
```

**Observaciones:**
1. La búsqueda es case-insensitive (`.toLowerCase()`)
2. Busca PDFs que contengan '0312', 'evaluacion' o 'informe' en el nombre
3. Prioriza el primer PDF encontrado que cumpla los criterios

**Posible mejora:** Considerar permitir al usuario seleccionar manualmente el PDF si se encuentran múltiples archivos.

### 4.3 Extracción de Información del PDF

**Estado:** ⚠️ **PARCIALMENTE COHERENTE**

#### Análisis de Patrones Regex

**Patrones definidos:**
```javascript
// utils/evaluacionPdfParser.js:9-17
this.patterns = {
    itemCode: /(\d+\.\d+\.\d+)/,           // Ej: 1.1.1, 2.10.1
    cycle: /(PLANEAR|HACER|VERIFICAR|ACTUAR)/i,
    standard: /(?:Estándar|Estandar|Standard)[:\s]*(.+?)(?=\n|$)/i,
    maxScore: /(?:Máximo|Maximo|Max)[:\s]*(\d+\.?\d*)/i,
    scoreObtained: /(?:Obtenido|Obt|Puntaje)[:\s]*(\d+\.?\d*)/i,
    status: /(?:Cumple|No Cumple|Parcial|No Aplica)/i,
    year: /20(2[0-9]|3[0-9])/
};
```

**Observaciones:**
1. ✅ Los patrones son robustos y manejan variaciones (mayúsculas/minúsculas, acentos)
2. ✅ El patrón de código `(\d+\.\d+\.\d+)` es específico para el formato del Ministerio
3. ⚠️ Los patrones de puntaje pueden fallar si el PDF tiene un formato diferente
4. ⚠️ No hay validación de que los puntajes sean numéricos válidos

#### Método `parseMinisterioPdf()`

**Estado:** ✅ **BIEN IMPLEMENTADO**

```javascript
// utils/evaluacionPdfParser.js:107-196
parseMinisterioPdf(text, filePath) {
    // 1. Detecta ciclos PHVA en el texto completo
    const cycleMatches = text.matchAll(/(?:Ciclo|CICLO)[:\s]*(PLANEAR|HACER|VERIFICAR|ACTUAR)/gi);
    
    // 2. Busca ítems usando patrón multiline tolerant
    const itemPattern = /(\d+\.\d+\.\d+)[\s\S]+?(?=\d+\.\d+\.\d+|$)/g;
    
    // 3. Para cada ítem, determina el ciclo basado en posición
    currentCycle = this.determineCycleForPosition(text, match.index, cycles);
    
    // 4. Extrae descripción, puntajes y estado
    // ...
}
```

**Fortalezas:**
1. ✅ Usa `[\s\S]` para manejar saltos de línea (multiline tolerant)
2. ✅ Determina el ciclo PHVA basado en la posición del ítem
3. ✅ Tiene validación cruzada para detectar inconsistencias
4. ✅ Marca ítems que requieren revisión manual

**Debilidades:**
1. ⚠️ La extracción de descripción usa `substring(0, 200)` lo cual puede truncar información importante
2. ⚠️ El patrón de puntaje `/(\d+\.?\d*)\s*(?:\/|de)\s*(\d+\.?\d*)/i` puede no funcionar con todos los formatos
3. ⚠️ No hay manejo de errores específicos para cada ítem

#### Método `parseArlPdf()`

**Estado:** ⚠️ **NECESITA VALIDACIÓN**

```javascript
// utils/evaluacionPdfParser.js:214-295
parseArlPdf(text, filePath) {
    // Busca riesgos usando patrón: (?:Riesgo|R-)[A-Z]+
    const riskPattern = /(?:Riesgo|R-)([A-Z]+)[\s\S]+?(?=(?:Riesgo|R-)[A-Z]+|$)/gi;
    // ...
}
```

**Observaciones:**
1. ✅ El patrón busca códigos de riesgo como "R-ALTO", "R-MEDIO", etc.
2. ⚠️ Asume un formato específico de código de riesgo que puede no ser universal
3. ⚠️ No hay ejemplos de PDFs de ARL para validar el patrón
4. ⚠️ El puntaje máximo por defecto es 10, lo cual puede no ser correcto para todos los riesgos

#### Método `parseGenericPdf()`

**Estado:** ⚠️ **FALLBACK LIMITADO**

```javascript
// utils/evaluacionPdfParser.js:300-356
parseGenericPdf(text) {
    // Busca patrones de código y descripción
    const patterns = [
        /(\d+\.\d+\.\d+)\s+([^\n]+?)(?=\n\d+\.\d+\.\d+|\n*$)/g,
        /([A-Z]-\w+)\s+([^\n]+?)(?=\n[A-Z]-\w+|\n*$)/g
    ];
    // ...
}
```

**Observaciones:**
1. ✅ Proporciona un fallback cuando no se detectan patrones específicos
2. ⚠️ La extracción de puntajes es muy básica y puede no ser precisa
3. ⚠️ No maneja ciclos PHVA
4. ⚠️ Limita la descripción a 100 caracteres

### 4.4 Cálculo de Métricas

**Estado:** ✅ **COHERENTE**

```javascript
// utils/evaluacionPdfParser.js:361-389
calculateMetrics(findings) {
    const totalItems = findings.length;
    const cumplidos = findings.filter(f => f.status === 'Cumple').length;
    const noCumplidos = findings.filter(f => f.status === 'No Cumple').length;
    const parcial = findings.filter(f => f.status === 'Parcial').length;
    
    const totalGrade = findings.reduce((sum, f) => sum + (f.grade || 0), 0);
    const totalMax = findings.reduce((sum, f) => sum + (f.max || 0), 0);
    
    const cumplimiento = totalMax > 0 ? Math.round((totalGrade / totalMax) * 100) : 0;
    
    return { cumplimiento, totalItems, cumplidos, noCumplidos, parcial };
}
```

**Observaciones:**
1. ✅ Calcula correctamente el porcentaje de cumplimiento
2. ✅ Maneja el caso de división por cero
3. ✅ Usa `Math.round()` para redondear a entero
4. ✅ Cuenta correctamente los ítems por estado

---

## 5. Análisis de Procesamiento para Mostrar en Pantalla

### 5.1 Renderizado de Hallazgos

**Estado:** ✅ **COHERENTE**

```javascript
// evaluacion-inicial-sg-sst.js:458-482
renderHallazgosTable() {
    tbody.innerHTML = this.currentFindings.map(item => {
        const isCompliant = item.grade >= item.max;
        const badgeClass = isCompliant ? 'k-badge-success' : 'k-badge-danger';
        
        return `
            <tr>
                <td>${item.code}</td>
                <td>${item.desc}</td>
                <td>${item.max}</td>
                <td>${item.grade}</td>
                <td><span class="k-badge ${badgeClass}">${item.status}</span></td>
            </tr>
        `;
    }).join('');
}
```

**Observaciones:**
1. ✅ Muestra correctamente código, descripción, puntaje máximo, puntaje obtenido y estado
2. ✅ Usa colores para indicar cumplimiento (verde/rojo)
3. ✅ Maneja el caso de no hay hallazgos

**Posible mejora:** Mostrar indicador visual para ítems que requieren revisión manual (`requiereRevisionManual`).

### 5.2 Actualización del Dashboard

**Estado:** ✅ **COHERENTE**

```javascript
// evaluacion-inicial-sg-sst.js:484-524
updateDashboardWithRealData(metrics) {
    // Actualiza textos
    const score = metrics.cumplimiento || 0;
    const noCumplidos = metrics.noCumplidos || 0;
    
    if (scoreEl) scoreEl.textContent = score + '%';
    if (gapsEl) gapsEl.textContent = noCumplidos;
    
    // Actualiza gráficos
    this.drawGauge(score);
    this.drawPhvaChart();
}
```

**Observaciones:**
1. ✅ Actualiza correctamente los KPIs principales
2. ✅ Redibuja los gráficos con los nuevos datos
3. ✅ Maneja valores nulos con `|| 0`

---

## 6. Hallazgos y Problemas Identificados

### 6.1 Problemas Críticos

**Ninguno identificado.** La función de extracción de PDF está bien implementada y es coherente.

### 6.2 Problemas Moderados

#### 1. Falta de Validación de Formato de PDF

**Ubicación:** [`utils/evaluacionPdfParser.js:26-77`](utils/evaluacionPdfParser.js:26)

**Problema:** El parser asume que el PDF tiene un formato específico pero no valida esto antes de intentar extraer datos.

**Impacto:** Puede producir resultados incorrectos o vacíos si el PDF tiene un formato diferente.

**Recomendación:** Agregar validación preliminar del formato del PDF antes de intentar extraer datos.

```javascript
// Sugerencia de mejora
async parsePdf(pdfPath, sourceType) {
    // ... código existente ...
    
    // Validar formato preliminar
    const formatValidation = this.validatePdfFormat(fullText, sourceType);
    if (!formatValidation.isValid) {
        console.warn('[EvaluacionPdfParser] Formato de PDF no reconocido:', formatValidation.reason);
        return {
            success: false,
            error: `Formato de PDF no reconocido: ${formatValidation.reason}`,
            // ... resto del objeto de error
        };
    }
    
    // ... continuar con el parsing ...
}

validatePdfFormat(text, sourceType) {
    if (sourceType === 'ministerio') {
        const hasItems = /(\d+\.\d+\.\d+)/.test(text);
        const hasCycles = /(PLANEAR|HACER|VERIFICAR|ACTUAR)/i.test(text);
        if (!hasItems) return { isValid: false, reason: 'No se detectaron ítems con formato X.Y.Z' };
        if (!hasCycles) return { isValid: false, reason: 'No se detectaron ciclos PHVA' };
    }
    return { isValid: true };
}
```

#### 2. Extracción de Descripción Truncada

**Ubicación:** [`utils/evaluacionPdfParser.js:130`](utils/evaluacionPdfParser.js:130)

**Problema:** La descripción se trunca a 200 caracteres, lo cual puede perder información importante.

**Impacto:** El usuario no puede ver la descripción completa de los estándares.

**Recomendación:** Considerar mostrar la descripción completa en un tooltip o modal al hacer clic.

#### 3. Falta de Manejo de Errores Específicos por Ítem

**Ubicación:** [`utils/evaluacionPdfParser.js:121-186`](utils/evaluacionPdfParser.js:121)

**Problema:** Si un ítem individual falla al parsearse, no se registra específicamente cuál fue el error.

**Impacto:** Difícil de depurar cuando hay ítems que no se extraen correctamente.

**Recomendación:** Agregar logging detallado para ítems que fallan.

```javascript
// Sugerencia de mejora
for (const match of itemMatches) {
    try {
        // ... código de extracción ...
        findings.push({ /* ... */ });
    } catch (itemError) {
        console.warn(`[EvaluacionPdfParser] Error extrayendo ítem ${code}:`, itemError.message);
        // Opcional: agregar a una lista de ítems con error
    }
}
```

### 6.3 Problemas Menores

#### 1. No hay Selección Manual de PDF

**Ubicación:** [`evaluacion-inicial-sg-sst.js:353-356`](evaluacion-inicial-sg-sst.js:353)

**Problema:** El sistema selecciona automáticamente el primer PDF que cumple los criterios, sin permitir al usuario elegir.

**Impacto:** Si hay múltiples PDFs, el usuario no puede seleccionar cuál procesar.

**Recomendación:** Agregar un selector de PDF cuando se encuentren múltiples archivos.

#### 2. Falta de Indicador Visual para Revisión Manual

**Ubicación:** [`evaluacion-inicial-sg-sst.js:458-482`](evaluacion-inicial-sg-sst.js:458)

**Problema:** Los ítems marcados con `requiereRevisionManual` no se destacan visualmente en la tabla.

**Impacto:** El usuario no sabe fácilmente qué ítems requieren revisión manual.

**Recomendación:** Agregar un icono o color especial para estos ítems.

```javascript
// Sugerencia de mejora
renderHallazgosTable() {
    tbody.innerHTML = this.currentFindings.map(item => {
        const isCompliant = item.grade >= item.max;
        const badgeClass = isCompliant ? 'k-badge-success' : 'k-badge-danger';
        const needsReview = item.requiereRevisionManual;
        
        return `
            <tr class="${needsReview ? 'k-row-warning' : ''}">
                <td>
                    ${item.code}
                    ${needsReview ? '<i class="bi bi-exclamation-circle text-warning" title="Requiere revisión manual"></i>' : ''}
                </td>
                <td>${item.desc}</td>
                <td>${item.max}</td>
                <td>${item.grade}</td>
                <td><span class="k-badge ${badgeClass}">${item.status}</span></td>
            </tr>
        `;
    }).join('');
}
```

#### 3. No hay Caché de Resultados

**Problema:** Cada vez que se carga el submódulo, se procesa el PDF nuevamente.

**Impacto:** Puede ser lento si el PDF es grande.

**Recomendación:** Considerar cachear los resultados procesados.

---

## 7. Recomendaciones de Mejora

### 7.1 Prioridad Alta

1. **Agregar validación preliminar del formato de PDF** antes de intentar extraer datos.
2. **Mejorar el manejo de errores** con logging detallado para ítems que fallan.
3. **Agregar indicador visual** para ítems que requieren revisión manual.

### 7.2 Prioridad Media

1. **Permitir selección manual de PDF** cuando se encuentren múltiples archivos.
2. **Mostrar descripción completa** en tooltip o modal.
3. **Agregar caché de resultados** para mejorar el rendimiento.

### 7.3 Prioridad Baja

1. **Agregar pruebas unitarias** para el parser de PDF.
2. **Documentar los formatos de PDF esperados** para Ministerio y ARL.
3. **Agregar métricas adicionales** como cumplimiento por ciclo PHVA.

---

## 8. Conclusión

### Estado General: ✅ **FUNCIONAL Y COHERENTE**

La función de extracción de datos de PDF para el submódulo "2.3.1 Evaluación Inicial del SG-SST" está **bien implementada y es coherente** con el resto del sistema. Los contratos de API están bien definidos, el flujo de datos es claro y la lógica de procesamiento es robusta.

### Puntos Fuertes

1. ✅ Arquitectura modular y bien organizada
2. ✅ Separación clara entre UI, lógica y procesamiento de datos
3. ✅ Uso correcto de IPC para comunicación entre procesos
4. ✅ Patrones regex robustos que manejan variaciones
5. ✅ Validación cruzada para detectar inconsistencias
6. ✅ Manejo de errores con try-catch
7. ✅ Logging detallado para depuración

### Áreas de Mejora

1. ⚠️ Falta validación preliminar del formato de PDF
2. ⚠️ No hay selección manual de PDF cuando hay múltiples archivos
3. ⚠️ Los ítems que requieren revisión manual no se destacan visualmente
4. ⚠️ La descripción se trunca a 200 caracteres

### Recomendación Final

**La función de extracción de PDF está lista para producción** pero se recomienda implementar las mejoras de prioridad alta para mejorar la robustez y la experiencia del usuario.

---

## 9. Referencias

- [`modules/gestion-integral/evaluacion-inicial-sg-sst/evaluacion-inicial-sg-sst.js`](modules/gestion-integral/evaluacion-inicial-sg-sst/evaluacion-inicial-sg-sst.js) - Componente principal de UI
- [`modules/gestion-integral/evaluacion-inicial-sg-sst/evaluacion-inicial-sg-sst-logic.js`](modules/gestion-integral/evaluacion-inicial-sg-sst/evaluacion-inicial-sg-sst-logic.js) - Lógica de carga
- [`utils/evaluacionPdfParser.js`](utils/evaluacionPdfParser.js) - Parser de PDFs
- [`main.js:4030`](main.js:4030) - Handler IPC `process-evaluacion-pdf`
- [`main.js:2259`](main.js:2259) - Handler IPC `find-submodule-path`
- [`main.js:546`](main.js:546) - Handler IPC `read-directory`
- [`preload.js:148`](preload.js:148) - Exposición de API al renderer

# Plan: Corregir mapeo de filas en gráfica de índices de accidentalidad

## Diagnóstico

El archivo `main/excel-bridge.js` usa constantes fijas (`FILAS` y `FILAS_MORTALIDAD`) para mapear filas del Excel de indicadores. El Excel de ASEL tiene un offset de +4 filas respecto al formato estándar que usan Aseplus/Tempoactiva/Temposum.

### Mapeo actual (hardcodeado) vs Real por empresa

| Fila | FILAS asume | Aseplus/Tempoactiva/Temposum | ASEL |
|------|-------------|-------------------------------|------|
| 9 | accidentesAT (A.T) | A.T ✅ | *(vacía)* ❌ |
| 10 | trabajadoresFreq | N° Trabajadores ✅ | *(vacía)* ❌ |
| 11 | diasPerdidos | Días perdidos ✅ | *(vacía)* ❌ |
| 12 | trabajadoresSev | N° Trabajadores ✅ | *(vacía)* ❌ |
| 13 | eventosMortales | Eventos Mortales ✅ | **A.T (Indice frecuencia)** ❌ |
| 14 | - | A.T | N° Trabajadores |
| 15 | prevalenciaEL | Tasa prevalencia EL ✅ | **Indice de severidad** ❌ |
| 17 | incidenciaEL | Tasa Incidencia EL ✅ | **Eventos Mortales** ← POSICIÓN REAL |
| 19 | eventosAusencia | Eventos Ausencia ✅ | Casos nuevos EL ❌ |
| 20 | diasProgramados | Días Programados ✅ | N° Trabajadores EL ❌ |
| 23 | - | - | **Eventos Ausencia** ← POSICIÓN REAL |
| 24 | - | - | **Días Programados** ← POSICIÓN REAL |

**Consecuencia**: En ASEL, la fila 13 contiene "A.T = 1" (1 accidente de trabajo en julio), y el código lo lee como `eventosMortales = 1`. Por eso la gráfica muestra un falso evento mortal.

### Causa secundaria: "muestra lo mismo en todas las empresas"

Esto puede ser por la variable global `EXCEL_INDICADORES` que se sobreescribe entre llamadas concurrentes. Sin embargo, el handler `get-indicadores-salud-stats` llama `configurarRutasConRuta()` + `leerIndicadores()` en secuencia síncrona dentro del mismo handler, por lo que la race condition es improbable en este handler específico. El problema más probable es que al cambiar de empresa, si no se recarga la página, el caché del renderer pueda servir datos viejos (aunque el código sí pasa `company` al handler).

---

## Estrategia de solución

**Detección dinámica de filas por etiquetas en columna D** (confirmado con el usuario).

En lugar de usar constantes fijas, escanear la hoja Excel para identificar las filas correctas basándose en las etiquetas de la columna D.

---

## Archivo a modificar: `main/excel-bridge.js`

### Cambio 1: Nueva función `detectarFilas(ws)` 

Insertar DESPUÉS de la línea 40 (`const COLUMNA_META = 30; // Columna AD`) y ANTES de la línea 42 (`// ── Utilidad: obtener valor numérico de celda ──`):

```js
// ── Detección dinámica de filas por etiquetas en columna D ──
// Cada empresa puede tener un layout diferente (offset de filas).
// Esta función escanea la hoja y mapea las etiquetas de columna D
// a los números de fila correctos, con fallback a FILAS si no detecta.
function detectarFilas(ws) {
	var detectadas = {};
	var trabajadoresCount = 0;

	for (var row = 1; row <= 30; row++) {
		var dVal = String(ws.getCell(row, 4).value || '').trim();
		var bVal = String(ws.getCell(row, 2).value || '').trim().toLowerCase();

		if (!dVal) continue;

		var dLower = dVal.toLowerCase();

		if (dLower === 'a.t') {
			if (!detectadas.accidentesAT) {
				detectadas.accidentesAT = row;
			}
		} else if (dLower.startsWith('n\u00b0 trabajadores') || dLower.startsWith('n° trabajadores') || dLower.startsWith('nª trabajadores') || dLower === 'n° trabajadores') {
			trabajadoresCount++;
			if (trabajadoresCount === 1) {
				detectadas.trabajadoresFreq = row;
			} else if (trabajadoresCount === 2) {
				detectadas.trabajadoresSev = row;
			}
		} else if (dLower.includes('días perdidos') || dLower.includes('dias perdidos')) {
			detectadas.diasPerdidos = row;
		} else if (dLower.includes('eventos mortales') || dLower.includes('evento mortal')) {
			detectadas.eventosMortales = row;
		} else if (dLower.includes('eventos ausencia') || dLower.includes('evento ausencia')) {
			detectadas.eventosAusencia = row;
		} else if (dLower.includes('días programados') || dLower.includes('dias programados')) {
			detectadas.diasProgramados = row;
		} else if (dLower.includes('casos nuevos y antiguos')) {
			detectadas.prevalenciaEL = row;
		} else if (dLower.includes('casos nuevos') && !dLower.includes('antiguos')) {
			detectadas.incidenciaEL = row;
		}
	}

	var resultado = {};
	resultado.accidentesAT = detectadas.accidentesAT || FILAS.accidentesAT;
	resultado.trabajadoresFreq = detectadas.trabajadoresFreq || FILAS.trabajadoresFreq;
	resultado.diasPerdidos = detectadas.diasPerdidos || FILAS.diasPerdidos;
	resultado.trabajadoresSev = detectadas.trabajadoresSev || FILAS.trabajadoresSev;
	resultado.eventosMortales = detectadas.eventosMortales || FILAS.eventosMortales;
	resultado.prevalenciaEL = detectadas.prevalenciaEL || FILAS.prevalenciaEL;
	resultado.incidenciaEL = detectadas.incidenciaEL || FILAS.incidenciaEL;
	resultado.eventosAusencia = detectadas.eventosAusencia || FILAS.eventosAusencia;
	resultado.diasProgramados = detectadas.diasProgramados || FILAS.diasProgramados;

	console.log('[EXCEL-BRIDGE] Filas detectadas:', JSON.stringify(resultado));

	return resultado;
}
```

### Cambio 2: Modificar `leerIndicadores()` (línea 186)

Reemplazar el bloque de lectura de datos (después de encontrar la hoja `ws`) para que use `detectarFilas(ws)` en lugar de `FILAS`:

**Línea actual (~229-296)**:
```js
const metaFrecuencia = obtenerValor(ws, FILAS.accidentesAT, COLUMNA_META);
const metaSeveridad = obtenerValor(ws, FILAS.diasPerdidos, COLUMNA_META);
// ... loop que usa FILAS.xxx ...
```

**Nuevo código** - Insertar después de `if (!ws) { ... throw ... }` y antes de la lectura de metaFrecuencia:

```js
const filas = detectarFilas(ws);
```

Luego reemplazar TODAS las referencias a `FILAS.xxx` dentro de `leerIndicadores()` por `filas.xxx`:

- `FILAS.accidentesAT` → `filas.accidentesAT`
- `FILAS.trabajadoresFreq` → `filas.trabajadoresFreq`
- `FILAS.diasPerdidos` → `filas.diasPerdidos`
- `FILAS.eventosMortales` → `filas.eventosMortales`
- `FILAS.prevalenciaEL` → `filas.prevalenciaEL`
- `FILAS.eventosAusencia` → `filas.eventosAusencia`
- `FILAS.diasProgramados` → `filas.diasProgramados`

**Nota**: La línea 294 `const mortalidad = obtenerValor(ws, FILAS.eventosMortales, 5);` debe cambiar a `filas.eventosMortales`. La línea 295 `const prevalenciaEL = obtenerValor(ws, FILAS.prevalenciaEL, 5);` debe cambiar a `filas.prevalenciaEL`. La línea 296 `const metaMortalidad = obtenerValor(ws, FILAS.eventosMortales, COLUMNA_META);` debe cambiar a `filas.eventosMortales`.

### Cambio 3: Modificar `leerIndicadoresMortalidad()` (línea 506)

Después de encontrar la hoja `ws`, agregar:

```js
const filas = detectarFilas(ws);
```

Reemplazar:
- `FILAS_MORTALIDAD.eventosMortales` → `filas.eventosMortales`
- `FILAS_MORTALIDAD.trabajadores` → `filas.trabajadoresSev` (o la fila detectada para trabajadores después de mortalidad)

**Nota importante**: En `FILAS_MORTALIDAD`, `trabajadores: 14` es la fila de trabajadores bajo mortalidad. Con detección dinámica, necesitamos distinguir los trabajadores de mortalidad. En el Excel de Aseplus/Tempoactiva, la fila 14 es "A.T" (no trabajadores) bajo mortalidad. En ASEL, la fila 18 es "A.T" bajo mortalidad.

Revisando el Excel:
- Aseplus: Row 14 = "A.T" (trabajadores afectados por mortalidad)
- Tempoactiva: Row 14 = "N° Trabajadores" 
- ASEL: Row 18 = "A.T"

Para `leerIndicadoresMortalidad`, el campo `trabajadores` se usa solo como un valor informativo (se lee de col 5). Podemos mejorarlo para que busque la fila correcta. Sin embargo, para no romper el contrato, podemos simplemente usar la fila inmediatamente debajo de `eventosMortales` detectada.

**Mejor enfoque**: Después de detectar `eventosMortales`, buscar la fila que contiene "A.T" o "N° Trabajadores" en la fila `eventosMortales + 1`:

```js
const mortalidadRow = filas.eventosMortales;
const trabajadoresMortalidadRow = mortalidadRow + 1;
```

### Cambio 4: Modificar `escribirEnExcel()` (línea 449)

Después de obtener `ws`, agregar:

```js
const filas = detectarFilas(ws);
```

Reemplazar `FILAS.xxx` por `filas.xxx` en todas las escrituras.

**OJO**: La línea 485 `await workbook.xlsx.writeFile(EXCEL_INDICADORES);` guarda en la variable global, no en `rutaOverride`. Esto es un bug existente pero NO se debe modificar (está fuera del alcance solicitado, solo se reporta).

### Cambio 5: Modificar `escribirEnExcelMortalidad()` (línea 578)

Después de obtener `ws`, agregar:

```js
const filas = detectarFilas(ws);
```

Reemplazar:
- `FILAS_MORTALIDAD.eventosMortales` → `filas.eventosMortales`
- `FILAS_MORTALIDAD.trabajadores` → `filas.eventosMortales + 1` (fila inmediatamente debajo de mortalidad)

**Nota**: El bug de línea 619 `await workbook.xlsx.writeFile(EXCEL_INDICADORES);` también existe aquí pero NO se modifica.

---

## No se modifica

- `main.js` - handlers IPC no cambian
- `preload.js` - bridges no cambian
- `gestion-salud-home.js` - renderer no cambia
- Ningún contrato de retorno (estructura idéntica, solo valores corregidos)
- Ningún otro módulo

## Confirmación

- ✅ No se rompe otro módulo (solo se modifica `excel-bridge.js`)
- ✅ No se alteran contratos (estructura de retorno idéntica)
- ✅ No hay efectos secundarios (fallback a filas fijas si la detección falla)
- ✅ Empresas existentes (Aseplus, Tempoactiva, Temposum) siguen funcionando igual
- ✅ ASEL ahora leerá correctamente eventos mortales de la fila 17 en lugar de la fila 13

## Bug existente reportado (NO corregir)

- `escribirEnExcel()` y `escribirEnExcelMortalidad()` guardan en `EXCEL_INDICADORES` (variable global) en lugar de `rutaOverride`. Esto puede causar que se escriba en el archivo de la empresa equivocada si se llama sin `rutaOverride`. **No se corrige en este cambio** por regla de oro (solo modificar lo solicitado).

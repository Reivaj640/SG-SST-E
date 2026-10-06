# Spec: Política SST Stats — Approach B

**Fecha:** 2026-07-15
**Status:** Aprobado por el usuario
**Autor:** Mavis (con colaboración del usuario)

## Overview

Mejorar la lógica de detección del documento "Política SST" en el módulo de Gestión Integral del proyecto K+AIR (SG-SST-E). El código actual (`calculatePoliticaStats` en main.js:14539) tiene 3 problemas principales:

1. Solo busca en el directorio raíz (no recursivo)
2. Detecta "actualizada" con threshold de 1 año (no "año en curso" como pide el usuario)
3. Toma el primer archivo que matchea (no el más reciente)

Además, el feedback visual en la tarjeta es limitado (solo "Actualizada" / "Por actualizar" / "No disponible").

## Contexto

- **Proyecto:** K+AIR (SG-SST-E) — sistema de gestión de seguridad y salud en el trabajo
- **Stack:** Electron + Node.js + better-sqlite3 + IPC bridge
- **Módulo afectado:** Gestión Integral (tarjeta "Política SST" en el home del módulo)
- **Código actual:**
  - `main.js:14539-14609` → `calculatePoliticaStats(basePath)` (función que busca el documento)
  - `main.js:6719` → llamada alternativa desde `calculateAutoResultados`
  - `main.js:14492` → response shape (default en caso de error)
  - `main.js:6720-6728` → cálculo del estado y resultado
  - `modules/gestion-integral/gestion-integral-home.js:943,987` → consumo en el renderer

## Approach Elegido: B (Completo)

**Por qué no A:** El approach mínimo solo arregla 2 de 5 problemas identificados. El usuario pidió "búsqueda en el repositorio de la política y sus subcarpetas" — eso requiere recursividad, que el approach A no incluye.

**Por qué no C:** El approach premium incluye detección por contenido de PDF (parsing de archivos binarios) e historial de versiones. Eso es sobrediseño para el valor real: el usuario quiere ver "está o no está actualizado", no un sistema de versionado de documentos.

**Approach B incluye:**
- ✅ Búsqueda recursiva en subcarpetas (maxDepth=3, con skip de node_modules/.git/dist)
- ✅ Detección por "año en curso" (enero 1 a diciembre 31 del año actual)
- ✅ Toma el archivo MÁS RECIENTE (por mtime, no el primero)
- ✅ Validación por nombre con regex estricto (evita falsos positivos)
- ✅ Búsqueda exhaustiva con fallback a otras rutas
- ✅ Feedback visual mejorado (path, fecha, días desde actualización, tooltip)

## Diseño Detallado

### Backend: `main.js`

#### 1. Refactor de `calculatePoliticaStats` (líneas 14539-14609)

**Cambios principales:**

- **API compatible hacia atrás:** El objeto retornado mantiene los 4 campos existentes (`documento_encontrado`, `actualizada`, `fecha`, `estado`) y agrega 5 nuevos (`path_corto`, `nombre_archivo`, `dias_desde_actualizacion`, `en_ano_curso`, `candidatos_evaluados`)
- **Lógica de "año en curso":** `masReciente.mtime >= new Date(currentYear, 0, 1)` Y `<= new Date(currentYear, 11, 31, 23, 59, 59)`
- **Selección de archivo:** ordena por `mtime` descendente, toma el primero (más reciente)

```javascript
// Shape del nuevo resultado:
{
  documento_encontrado: true,
  actualizada: true,                    // <= año en curso
  en_ano_curso: true,                   // NUEVO
  fecha: Date,                          // mtime del archivo más reciente
  estado: 'Actualizada',                // o 'Por actualizar' / 'No disponible'
  path_corto: 'politica-sst.pdf',       // NUEVO: relative a "2.1 Política SST"
  nombre_archivo: 'politica-sst.pdf',   // NUEVO
  dias_desde_actualizacion: 142,        // NUEVO
  candidatos_evaluados: 3               // NUEVO: archivos revisados
}
```

#### 2. Helpers nuevos (en main.js)

**`isPoliticaSSTFile(nombre)`** — Regex estricto para evitar falsos positivos:

```javascript
function isPoliticaSSTFile(nombre) {
  const nombreLower = nombre.toLowerCase();
  // Acepta: "politica-sst", "politica_sst", "politicasst", "política de seguridad y salud"
  // Rechaza: "politica de privacidad", "politica de vacaciones"
  const regex = /(politica|pol[íi]tica)[\s_-]*(sst|sg[\s-]?sst|seguridad[\s_-]*y[\s_-]*salud)/i;
  return regex.test(nombreLower);
}
```

**Tabla de validación:**

| Input | Output | Razón |
|-------|--------|-------|
| `politica-sst.pdf` | ✅ true | Matchea regex |
| `politica_sst.pdf` | ✅ true | Matchea regex |
| `politicasst.pdf` | ✅ true | Matchea regex |
| `POLÍTICA DE SST.pdf` | ✅ true | Case-insensitive |
| `politica-de-seguridad-y-salud.pdf` | ✅ true | Matchea "seguridad y salud" |
| `politica-de-privacidad.pdf` | ❌ false | No contiene "sst" |
| `politica-de-vacaciones.pdf` | ❌ false | No contiene "sst" |
| `plan-de-trabajo.pdf` | ❌ false | No es política |
| `manual-de-empleado.pdf` | ❌ false | No es política |

**`findPoliticaFilesRecursive(rootPath, maxDepth=3)`** — Búsqueda recursiva limitada:

- Usa `fsp.readdir` con `{ withFileTypes: true }` (1 syscall por nivel)
- Skip explícito: `node_modules`, `.git`, `dist`, `win-unpacked`
- Solo extensiones: `.pdf`, `.docx`, `.xlsx`
- Retorna array de `{ nombre, fullPath, mtime }`

**`findGestionIntegralFolder(basePath)`** — Extraído de la lógica actual (3 variantes de nombre).

#### 3. Compatibilidad con código existente

- **NO se rompe el API actual.** Los handlers IPC (`get-gestion-integral-stats`, `get-auto-resultados`) siguen retornando el mismo shape, solo con campos adicionales.
- El renderer puede usar los campos nuevos gradualmente.

### Frontend: `modules/gestion-integral/gestion-integral-home.js`

#### 1. Reemplazo de `createWidget` genérico por método específico (línea 987)

**Antes:**
```javascript
const widget1 = this.createWidget('Política SST', politica.estado, politica.actualizada ? '✅ Al día' : '⚠️ Por actualizar');
```

**Después:**
```javascript
const widget1 = this.createWidgetPoliticaSST(politica);
```

#### 2. Nuevo método `createWidgetPoliticaSST(data)`

**Estructura del widget:**

```
┌─────────────────────────┐
│ Política SST          ✅ │  ← Header con ícono
├─────────────────────────┤
│                         │
│      Actualizada        │  ← Valor principal (color según estado)
│                         │
│   10/04/2026            │  ← Fecha del documento
│   Hace 142 días         │  ← Tiempo desde actualización
│                         │
└─────────────────────────┘
```

**Tooltip al hacer hover:** `nombre_archivo + path_corto` (path completo relativo a la carpeta de la empresa)

**Estados visuales:**

| Estado | Color | Ícono | Subtítulo |
|--------|-------|-------|-----------|
| `Actualizada` | Verde (#28a745) | ✅ | Fecha + "Hace X días/meses/años" |
| `Por actualizar` | Amarillo (#ffc107) | ⚠️ | Fecha + "Hace X..." |
| `No disponible` | Rojo (#dc3545) | ❌ | "No se encontró la carpeta" o "N archivos revisados, ninguno es política SST" |

#### 3. CSS (opcional, en `styles.css`)

```css
.k-widget__valor--success { color: #28a745; }
.k-widget__valor--warning { color: #ffc107; }
.k-widget__valor--error { color: #dc3545; }

.k-widget__subtitulo--warning {
  color: #856404;
  background: #fff3cd;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85em;
}
```

## Estructura de Archivos (cambios)

| Archivo | Tipo | Líneas estimadas |
|---------|------|------------------|
| `sgsst-electron-app/main.js` | Modificar | +60 (refactor) + 80 (helpers) |
| `sgsst-electron-app/modules/gestion-integral/gestion-integral-home.js` | Modificar | +60 (nuevo método) |
| `sgsst-electron-app/styles.css` | Modificar | +30 (CSS opcional) |
| `sgsst-electron-app/main/test-politica-stats.js` | Nuevo | +150 (tests) |
| **Total** | **4 archivos** | **~380 líneas** |

## Tests

### `main/test-politica-stats.js` (nuevo, 150+ líneas)

#### Estructura del test

```javascript
// Helpers para crear fixtures temporales
function createTestFixture({ actualizada, conSubcarpetas }) { ... }

// Tests
test('isPoliticaSSTFile acepta nombres válidos', () => { ... });
test('isPoliticaSSTFile rechaza falsos positivos', () => { ... });
test('findPoliticaFilesRecursive encuentra en subcarpetas', () => { ... });
test('findPoliticaFilesRecursive respeta maxDepth', () => { ... });
test('findPoliticaFilesRecursive ignora node_modules', () => { ... });
test('calculatePoliticaStats detecta política actualizada en año en curso', () => { ... });
test('calculatePoliticaStats marca Por actualizar si es de año anterior', () => { ... });
test('calculatePoliticaStats toma el archivo más reciente, no el primero', () => { ... });
test('calculatePoliticaStats devuelve path_corto correcto', () => { ... });
test('calculatePoliticaStats calcula dias_desde_actualizacion', () => { ... });
test('calculatePoliticaStats devuelve No disponible si no hay carpeta', () => { ... });
test('calculatePoliticaStats ignora archivos que no son política', () => { ... });
```

## Acceptance Criteria

- [ ] La búsqueda recursiva encuentra el documento en subcarpetas hasta 3 niveles de profundidad
- [ ] Se ignoran carpetas `node_modules`, `.git`, `dist`, `win-unpacked`
- [ ] Solo se aceptan archivos que matcheen el regex de Política SST (rechaza "política de privacidad", "política de vacaciones", etc.)
- [ ] Se toma el archivo más reciente por `mtime`, no el primero de la lista
- [ ] `en_ano_curso: true` solo si la fecha está entre enero 1 y diciembre 31 del año actual
- [ ] `estado: 'Actualizada'` cuando `en_ano_curso: true`
- [ ] `estado: 'Por actualizar'` cuando el documento existe pero no es del año en curso
- [ ] `estado: 'No disponible'` cuando no se encuentra el documento o la carpeta
- [ ] El widget muestra la fecha del documento en formato DD/MM/YYYY
- [ ] El widget muestra "Hace X días/meses/años" según corresponde
- [ ] El tooltip al hacer hover muestra `nombre_archivo + path_corto`
- [ ] La API existente sigue funcionando sin breaking changes (campos viejos preservados)
- [ ] Los tests pasan al 100% (todos los casos)
- [ ] El comando `npm run build:win` (o el wrapper `build-and-publish.bat`) sigue funcionando

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Performance: filesystem lento en empresas con miles de archivos | `maxDepth=3` limita la recursividad, skip explícito de carpetas pesadas |
| Regex muy estricto: rechaza políticas válidas con nombres raros | El regex acepta múltiples variantes (con/sin guión, con/sin tilde, abreviado o completo) |
| Cambio de API rompe consumers | Mantener los 4 campos existentes, solo agregar 5 nuevos |
| Búsqueda en archivos con permisos restringidos | Try-catch en el helper recursivo, log de warning, continuar con los demás |
| Falsos positivos: documento "política" que no es la política SST | Regex estricto + verificación del path (debe estar en carpeta de Gestión Integral) |
| Tests flaky por mtime | Usar `fs.utimesSync` para setear fechas explícitas en fixtures |
| Año nuevo (1 de enero): la lógica de "año en curso" cambia | Tests con fechas límite (31 diciembre y 1 enero) para validar el comportamiento |

## Out of Scope (no se hace en este spec)

- Detección por contenido del PDF (parsing binario)
- Historial de versiones de la política
- Notificaciones automáticas cuando está por vencer
- Comparación entre empresas
- Edición de la metadata del documento
- Versionado con Git
- Sync multipc de la metadata (ya cubierto por la feature existente de sync)

## Próximos Pasos

1. **User review del spec:** el usuario revisa este archivo
2. **Aprobación:** una vez aprobado, se invoca `writing-plans` skill para crear el plan de implementación
3. **Implementación:** siguiendo el plan, con tests primero (TDD)
4. **Verificación:** todos los tests pasan, la feature funciona end-to-end

# 📝 Resumen de Cambios - Versión 0.1.49

**Fecha:** 26 de febrero de 2026  
**Tipo de Actualización:** Backend - Arquitectura de Datos

---

## 🎯 Objetivo Principal

Implementar un **sistema dual de archivos** para el módulo de Ausentismo, separando:
1. **Registro general** de incapacidades (PI-FO-076)
2. **Seguimiento detallado** de casos individuales (PRI.xlsx)

---

## 📁 Archivos Involucrados

| Archivo | Propósito | Secciones que lo usan |
|---------|-----------|----------------------|
| **PI-FO-076 / PG-FO-076 / GI-FO-076** | Registro y consulta general | Registrar Ausentismo, Ver Ausentismo, Seguimiento de Incapacidades (lista), Estadísticas |
| **PRI.xlsx** | Seguimiento detallado de casos | Abrir Seguimiento (detalle de caso individual) |

---

## 🔧 Cambios Técnicos

### **1. `main.js` - Handler `get-ausentismo-data` (MODIFICADO)**

**Antes:**
```javascript
// Tomaba el primer archivo .xlsx encontrado
const excelFile = excelFiles[0];
```

**Ahora:**
```javascript
// Busca específicamente PI-FO-076, PG-FO-076 o GI-FO-076
const ausentismoGeneralFile = excelFiles.find(
  f => f.name && (
    f.name.toUpperCase().includes('PI-FO-076') ||
    f.name.toUpperCase().includes('PG-FO-076') ||
    f.name.toUpperCase().includes('GI-FO-076')
  )
);

// Si no encuentra, usa el primer .xlsx que NO sea PRI.xlsx
const excelFile = ausentismoGeneralFile || 
                  excelFiles.find(f => !f.name.toUpperCase().includes('PRI')) || 
                  excelFiles[0];
```

**Ubicación:** `main.js` línea ~3096

---

### **2. `main.js` - Nuevo Handler `get-pri-seguimiento-data`**

**Propósito:** Leer datos del PRI.xlsx, hoja "Casos en seguimiento"

**Características:**
- Busca específicamente el archivo `PRI.xlsx`
- Selecciona automáticamente la hoja "Casos en seguimiento"
- Detección inteligente de encabezados (estructura diferente a PI-FO-076)
- Logs de depuración detallados

**Ubicación:** `main.js` línea ~3251

**Contrato de Respuesta:**
```javascript
{
  success: true,
  headers: ['Identificación', 'Nombre', 'Cargo', ...],
  rows: [...],  // Datos de casos en seguimiento
  filePath: 'G:\\...\\PRI.xlsx',
  sheetName: 'Casos en seguimiento',
  companyName: 'Aseplus'
}
```

---

### **3. `preload.js` - Nueva API Expuesta**

**Agregado:**
```javascript
getPriSeguimientoData: (companyName) =>
  ipcRenderer.invoke('get-pri-seguimiento-data', companyName)
```

**Ubicación:** `preload.js` línea ~165

---

## 📊 Flujo de Datos Actualizado

### **Lista Principal de Seguimiento de Incapacidades**
```
Frontend (seguimiento-incapacidades.html)
    ↓
window.electronAPI.readAusentismoData(companyName)
    ↓
get-ausentismo-data (main.js)
    ↓
Lee PI-FO-076 (NO PRI.xlsx)
    ↓
Devuelve 610 registros (Aseplus)
    ↓
Frontend filtra casos que requieren seguimiento (≥10 días, gaps, etc.)
    ↓
Muestra 73 casos que cumplen criterios (Aseplus)
```

### **Detalle de Caso Individual (Abrir Seguimiento)**
```
Frontend (seguimiento-incapacidades.html)
    ↓
Click en "Abrir Seguimiento" de un caso
    ↓
window.electronAPI.getPriSeguimientoData(companyName)  ← PENDIENTE IMPLEMENTAR
    ↓
get-pri-seguimiento-data (main.js)
    ↓
Lee PRI.xlsx, hoja "Casos en seguimiento"
    ↓
Devuelve datos del caso seleccionado
    ↓
Frontend muestra formulario de seguimiento detallado
```

---

## 🐛 Problemas Resueltos

### **Problema 1: No se encontraba el archivo PRI.xlsx**
**Causa:** El sistema tomaba el primer archivo .xlsx encontrado

**Solución:** 
- Se agregaron logs que muestran TODOS los archivos en la carpeta
- Se busca específicamente por nombre de archivo
- Se filtra el archivo temporal `~$PRI.xlsx`

### **Problema 2: Se leía la hoja equivocada del PRI.xlsx**
**Causa:** El sistema seleccionaba la primera hoja ("Introducción")

**Solución:**
- Búsqueda específica de la hoja "Casos en seguimiento"
- Fallback a variaciones: "casos", "seguimiento"

### **Problema 3: Se usaba PRI.xlsx para TODO**
**Causa:** Un solo handler para ambos propósitos

**Solución:**
- Dos handlers separados:
  - `get-ausentismo-data` → PI-FO-076
  - `get-pri-seguimiento-data` → PRI.xlsx

---

## 📝 Logs de Depuración Agregados

### **Para `get-ausentismo-data`:**
```log
[AUSENTISMO][MAIN] === ARCHIVOS EN LA CARPETA DE AUSENTISMO ===
[AUSENTISMO][MAIN] Total de archivos encontrados: 3
  [0] PI-FO-076 AUSENTISMO POR ARL Y EPS (ASEPLUS).XLSX
  [1] PRI.xlsx
  [2] ~$PRI.xlsx
[AUSENTISMO][MAIN] ============================================
[AUSENTISMO][MAIN] Archivo SELECCIONADO: PI-FO-076 AUSENTISMO POR ARL Y EPS (ASEPLUS).XLSX
[AUSENTISMO][MAIN] ¿Es archivo de ausentismo general (PI/PG/GI-FO-076)?: ✅ SÍ
```

### **Para `get-pri-seguimiento-data`:**
```log
[PRI][MAIN] Handler get-pri-seguimiento-data llamado para empresa: Aseplus
[PRI][MAIN] ✅ Archivo PRI.xlsx encontrado: G:\...\PRI.xlsx
[PRI][MAIN] Nombres de hojas en PRI.xlsx: ['Introducción', 'Casos en seguimiento', ...]
[PRI][MAIN] Hoja seleccionada: Casos en seguimiento
[PRI][MAIN] Total de filas leídas: XXX
```

---

## ⏭️ Próximos Pasos (Pendientes)

### **Frontend**
1. **Actualizar `seguimiento-incapacidades.html`**
   - Modificar función `saveFollowUp()` para usar `window.electronAPI.getPriSeguimientoData()`
   - Implementar carga de datos del PRI.xlsx cuando se abra el seguimiento de un caso

2. **Implementar guardado en PRI.xlsx**
   - Conectar formulario de seguimiento con handler `save-follow-up` (ya existe en main.js)
   - Validar que los datos se escriban en la hoja correcta

### **Backend**
1. **Verificar handler `save-follow-up`**
   - Asegurar que escriba en PRI.xlsx, no en PI-FO-076
   - Validar estructura de datos

---

## 📚 Documentación Actualizada

| Documento | Cambios |
|-----------|---------|
| `docs/ARQUITECTURA_AUSENTISMO_DUAL.md` | **🆕 Creado** - Arquitectura completa del sistema dual |
| `README.md` | Versión 0.1.49, APIs actualizadas |
| `docs/CHANGELOG.md` | Entrada completa para v0.1.49 |

---

## ✅ Verificación

Para verificar que los cambios funcionan correctamente:

1. **Reiniciar la aplicación**
2. **Ir a Gestión de la Salud → 3.3.6 Medición del Ausentismo**
3. **Click en "Seguimiento de Incapacidades"**
4. **Verificar en logs de terminal:**
   ```
   [AUSENTISMO][MAIN] Archivo SELECCIONADO: PI-FO-076 AUSENTISMO POR ARL Y EPS (ASEPLUS).XLSX
   [AUSENTISMO][MAIN] ¿Es archivo de ausentismo general (PI/PG/GI-FO-076)?: ✅ SÍ
   ```
5. **Debería mostrar 610 registros** (para Aseplus) en la lista principal

---

## 📞 Contacto

**Autor:** Javier Robles F.  
**Cargo:** Prof. SG-SST - Esp. Gerencia de Proyectos

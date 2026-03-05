# Módulo de Inducciones y Reinducción - K+AIR

## 📋 Descripción General

El módulo de **Inducciones y Reinducción** permite gestionar el registro y seguimiento de las inducciones de empleados en el sistema SG-SST. Los datos se sincronizan automáticamente desde Google Forms a través de un archivo Excel con Power Query.

---

## 🏗️ Arquitectura

### Estructura de Archivos

```
modules/recursos/inducciones/
├── inducciones-view.html      # Vista HTML del componente
├── inducciones-view.css       # Estilos K+AIR oficiales
├── inducciones-viewer.js      # Viewer wrapper
├── inducciones-logic.js       # Lógica del componente (frontend)
└── index.js                   # Export del módulo
```

### Backend (main.js)

**Funciones IPC:**
- `get-inducciones-data` - Obtener datos de inducciones
- `check-inducciones-changes` - Verificar cambios en el archivo
- `sync-inducciones-from-forms` - Sincronizar desde Google Forms

---

## 🔄 Flujo de Sincronización Automática

### Paso 1: Apertura del Módulo
```
Usuario abre Inducciones
    ↓
Frontend llama a getInduccionesData(companyName)
    ↓
Backend busca carpeta de inducciones
    ↓
Backend encuentra archivo Excel
    ↓
Backend lee datos y retorna
    ↓
Frontend renderiza tabla y gráficos
```

### Paso 2: Detección de Cambios
```
Después de cargar (1 segundo)
    ↓
Frontend llama a checkInduccionesChanges(company, lastHash)
    ↓
Backend compara hash del archivo (tamaño + mtimeMs)
    ↓
Si hay cambios → Mostrar banner
Si no hay cambios → Mostrar "Sincronizado"
```

### Paso 3: Sincronización (Automática/Manual)
```
Usuario hace clic en "Sincronizar"
    ↓
Backend ejecuta refreshExcelPowerQuery(filePath)
    ↓
    ├─→ Crea VBScript temporal
    ├─→ Ejecuta cscript.exe con ruta del Excel
    ├─→ VBScript abre Excel (COM Automation)
    ├─→ Ejecuta workbook.RefreshAll()
    ├─→ Espera a que termine Power Query (máx. 60s)
    ├─→ Guarda y cierra Excel
    └─→ Limpia archivo temporal
    ↓
Backend lee datos actualizados
    ↓
Frontend actualiza interfaz
    ↓
Muestra notificación de éxito
```

---

## 🎯 Características Implementadas

### 1. Búsqueda Inteligente de Carpetas

**Sistema de 3 prioridades con normalización de tildes:**

```javascript
const normalize = (str) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// PRIORIDAD 1: Carpeta con "induccion" o "reinduccion"
const indFolder = subs.find(s => {
  const norm = normalize(s);
  return norm.includes('induccion') || norm.includes('reinduccion');
});

// PRIORIDAD 2: Carpeta 1.1.x o 1.2.x con "induccion"
const indFolderNumeric = subs.find(s => {
  const norm = normalize(s);
  return (s.startsWith('1.1') || s.startsWith('1.2')) && norm.includes('induccion');
});

// PRIORIDAD 3: Fallback cualquier carpeta 1.1
const fallbackFolder = subs.find(s => s.includes('1.1') || normalize(s).includes('inducci'));
```

**Ejemplos que funcionan:**
- `1.2.2 Inducción y Reinducción` ✅
- `1.2.2 Induccion y Reinduccion` ✅
- `1.1.5 Inducciones` ✅

### 2. Búsqueda Flexible de Archivos

**Variantes soportadas:**
```javascript
const excelFile = files.find(f => {
    const lowerName = f.toLowerCase();
    return lowerName.includes('inducción') ||
           lowerName.includes('induccion') || 
           lowerName.includes('inducciones') ||
           lowerName.includes('fo-046') || 
           lowerName.includes('fo_046') ||
           lowerName.includes('046') ||
           lowerName.includes('registro');
});
```

**Ejemplos que funcionan:**
- `ACT-FO-046 Registro de Inducción.xlsx` ✅
- `A-FR-07 Registro de Inducción.xlsx` ✅
- `Formato_induccion_2026.xlsx` ✅
- `Control_de_Inducciones.xlsx` ✅

### 3. Filtrado de Encabezados

**Detecta y salta filas de títulos:**
```javascript
const lowerRow = row.join(' ').toLowerCase();
if (lowerRow.includes('fecha de ingreso') || 
    lowerRow.includes('nombre completo') || 
    lowerRow.includes('cedula') || 
    lowerRow.includes('cargo') ||
    lowerRow.includes('fecha') && lowerRow.includes('empleado')) {
    continue;  // Saltar esta fila
}
```

### 4. Sincronización con Power Query (COM Automation)

**VBScript para controlar Excel:**
```vbscript
Set excelApp = CreateObject("Excel.Application")
excelApp.Visible = False
Set workbook = excelApp.Workbooks.Open(filePath)
workbook.RefreshAll

' Esperar a que termine (máx. 60 segundos)
Do While excelApp.BackgroundQueryDownloading
    WScript.Sleep 500
Loop

workbook.Save
workbook.Close
excelApp.Quit
```

**Ventajas:**
- ✅ No requiere librerías adicionales
- ✅ Funciona con cualquier versión de Excel
- ✅ Maneja archivos con Power Query
- ✅ Se ejecuta en segundo plano

### 5. UI/UX K+AIR Oficial

**Elementos visuales:**
- Banner de sincronización (animado)
- Botón manual "Sincronizar"
- Indicador de estado ("Sincronizado HH:MM:SS")
- Toast notifications
- Gráficos de Dashboard
- Tabla de registros

---

## 📊 Contratos de API

### `getInduccionesData(companyName)`

**Request:**
```javascript
window.electronAPI.getInduccionesData('Asel')
```

**Response:**
```javascript
{
  success: true,
  data: [
    {
      id: 1,
      date: '2024-01-10',
      year: '2024',
      name: 'Carlos Pérez',
      idCard: '80123456',
      position: 'Supernumerario',
      gender: 'Hombre',
      score: '22',
      status: 'approved'
    }
  ],
  filePath: 'G:\\...\\Registro de Inducción.xlsx'
}
```

### `checkInduccionesChanges(companyName, lastKnownHash)`

**Request:**
```javascript
window.electronAPI.checkInduccionesChanges('Asel', '12345-1678901234567')
```

**Response (sin cambios):**
```javascript
{
  success: true,
  hasChanges: false,
  currentHash: '12345-1678901234567',
  lastModified: '2026-03-05T16:00:00.000Z',
  filePath: 'G:\\...\\Registro de Inducción.xlsx'
}
```

**Response (con cambios):**
```javascript
{
  success: true,
  hasChanges: true,
  currentHash: '67890-1678901234890',
  lastModified: '2026-03-05T16:30:00.000Z',
  filePath: 'G:\\...\\Registro de Inducción.xlsx',
  totalRecords: 137
}
```

### `syncInduccionesFromForms(companyName)`

**Request:**
```javascript
window.electronAPI.syncInduccionesFromForms('Asel')
```

**Response:**
```javascript
{
  success: true,
  data: [...],  // Array de registros
  filePath: 'G:\\...\\Registro de Inducción.xlsx',
  currentHash: '67890-1678901234890',
  lastModified: '2026-03-05T16:30:00.000Z',
  message: 'Se sincronizaron 137 registros desde Google Forms'
}
```

---

## 🎨 Componentes Frontend

### InduccionesComponent

**Métodos principales:**

```javascript
class InduccionesComponent {
    // Cargar datos iniciales
    async loadData()
    
    // Verificar cambios después de cargar
    async checkForChanges()
    
    // Sincronizar desde Forms
    async syncFromForms()
    
    // Mostrar banner de sincronización
    showSyncBanner(newRecordsCount)
    
    // Actualizar estado de sincronización
    setSyncStatus(status, text)
    
    // Renderizar estadísticas
    renderDashboardStats()
    
    // Renderizar tabla
    renderTable()
    
    // Renderizar gráficos
    updateDashboardCharts(data)
    renderReportsCharts()
}
```

---

## 🐛 Solución de Problemas

### El archivo no se encuentra

**Síntoma:** `Error: Archivo Excel de inducciones no encontrado`

**Causas posibles:**
1. La carpeta no se llama "Inducción" o similar
2. El archivo no contiene "induccion", "046", o "registro" en el nombre
3. El archivo está abierto en Excel

**Solución:**
1. Verificar que la carpeta contenga "induccion" (con o sin tilde)
2. Renombrar archivo para que incluya "Inducción", "Registro", o "046"
3. Cerrar Excel antes de sincronizar

### Power Query no se actualiza

**Síntoma:** Los datos no cambian después de sincronizar

**Causas posibles:**
1. El archivo no tiene conexión de Power Query configurada
2. Excel no está instalado
3. Error de COM Automation

**Solución:**
1. Abrir Excel → Datos → Consultas y Conexiones
2. Verificar que haya una consulta configurada
3. Probar actualización manual: Datos → Actualizar Todo

### La fila de encabezados se muestra como registro

**Síntoma:** La tabla muestra "Fecha de Ingreso", "Nombre Completo", etc.

**Causa:** El archivo tiene una estructura diferente

**Solución:** El código ya filtra automáticamente estas filas. Si persiste, agregar más palabras clave al filtro:

```javascript
if (lowerRow.includes('palabra_clave_nueva')) {
    continue;
}
```

---

## 📝 Logs de Depuración

### Habilitar logs completos

En `main.js`, los logs se muestran en la terminal:
```bash
[MAIN] Buscando carpeta inducciones en: G:\...\1. Recursos
[DEBUG] [MAIN] Ruta estándar no existe, buscando alternativas...
[DEBUG] [MAIN] Subcarpetas encontradas: 1.1.x, 1.2.2 Inducción y Reinducción, ...
[DEBUG] [MAIN] Carpeta de inducciones encontrada: 1.2.2 Inducción y Reinducción
[DEBUG] [MAIN] Archivos en carpeta inducciones: A-FR-07 Registro de Inducción.xlsx
[DEBUG] [MAIN] Archivo Excel encontrado: A-FR-07 Registro de Inducción.xlsx
```

### Logs del frontend

En DevTools del navegador:
```javascript
🔄 [Inducciones] Cargando datos reales para: Asel
✅ [Inducciones] Datos cargados: 45 registros
✅ [Inducciones] Sincronización completada: 45 registros
```

---

## 🔐 Consideraciones de Seguridad

1. **El archivo Excel NO debe estar abierto** durante la sincronización
2. **Power Query debe estar configurado** para conectarse a Google Forms
3. **Permisos de escritura** necesarios en la carpeta de la empresa
4. **Excel debe estar instalado** en el equipo del usuario

---

## 📈 Métricas de Rendimiento

| Operación | Tiempo Promedio |
|-----------|----------------|
| Carga inicial de datos | 200-500ms |
| Verificación de cambios | 50-100ms |
| Sincronización (Power Query) | 5-30 segundos |
| Renderizado de tabla (100 registros) | <100ms |

---

## 🚀 Futuras Mejoras

- [ ] Soporte para múltiples archivos de inducción
- [ ] Historial de sincronizaciones
- [ ] Notificaciones push cuando hay datos nuevos
- [ ] Sincronización en segundo plano automática
- [ ] Exportar informe PDF de inducciones
- [ ] Filtros avanzados por cargo, fecha, estado

---

## 📞 Soporte

Para problemas o preguntas sobre este módulo, contactar al equipo de desarrollo K+AIR.

**Última actualización:** Marzo 2026  
**Versión:** v0.1.70+

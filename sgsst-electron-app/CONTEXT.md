# K+AIR - Contexto del Proyecto

**Última actualización:** 25 de marzo de 2026
**Versión actual:** 0.1.93
**Tipo:** Aplicación empresarial Electron para SG-SST (Colombia)

---

## 🎯 Propósito

**K+AIR** es un sistema de gestión de Seguridad y Salud en el Trabajo (SG-SST) diseñado para empresas colombianas. Cumple con la Resolución 0312 de 2019 y permite gestionar múltiples empresas desde una única interfaz.

**Usuarios objetivo:** Departamentos de SST, administración, auditoría, gerencia.

---

## 🏗️ Arquitectura (Resumen)

```
┌─────────────────────────────────────────────────────────┐
│                    K+AIR Electron App                    │
├─────────────────────────────────────────────────────────┤
│  RENDERER (Frontend)                                    │
│  ├── index.html                                         │
│  ├── renderer.js (Lógica de UI)                         │
│  └── modules/ (27+ submódulos)                          │
├─────────────────────────────────────────────────────────┤
│  PRELOAD (Puente Seguro)                                │
│  └── preload.js (78 contratos IPC expuestos)            │
├─────────────────────────────────────────────────────────┤
│  MAIN (Backend Electron)                                │
│  └── main.js (78 handlers IPC)                          │
├─────────────────────────────────────────────────────────┤
│  DATABASE                                                │
│  └── SQLite (kair.db) - Usuarios, roles, sesiones       │
├─────────────────────────────────────────────────────────┤
│  PYTHON (Portear/python-embed/)                         │
│  ├── Python 3.11.9 empaquetado                          │
│  ├── 79+ paquetes (pandas, openpyxl, PyMuPDF, etc.)    │
│  └── Scripts: map_directory.py, actualizar_ausentismo   │
└─────────────────────────────────────────────────────────┘
```

**Tecnologías clave:**
- Electron 37.x
- Node.js
- Python 3.11.9 (empaquetado)
- SQLite (better-sqlite3)
- React-like vanilla JS (sin framework)

---

## 📁 Estructura de Archivos Clave

### Raíz del Proyecto

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `main.js` | ~7800 | Backend Electron, handlers IPC |
| `preload.js` | ~180 | Contratos IPC (electronAPI) |
| `renderer.js` | ~3200 | Lógica de UI, navegación |
| `index.html` | 143 | Punto de entrada HTML |
| `package.json` | 137 | Configuración npm + electron-builder |

### Python (Portear/)

| Archivo | Propósito |
|---------|-----------|
| `Portear/python-embed/` | Python 3.11.9 + 79 paquetes |
| `Portear/python-embed/python-scripts/` | Scripts de procesamiento |
| `Portear/python-embed/python-scripts/map_directory.py` | Mapeo de directorios |
| `Portear/python-embed/python-scripts/actualizar_ausentismo.py` | Ausentismo |
| `Portear/python-embed/python-scripts/convert_docx_to_pdf.py` | Conversión Word→PDF |
| `Portear/python-embed/python-scripts/convert_xlsx_to_pdf.py` | Conversión Excel→PDF |

### Módulos (modules/)

```
modules/
├── gestion-integral/       # Módulo 2
├── gestion-salud/          # Módulo 3 (IA + Ausentismo)
│   └── ausentismo/
│       ├── medicion-ausentismo-home.html
│       ├── medicion-ausentismo-home.js
│       └── medicion-ausentismo.js
├── recursos/               # Módulo 1
└── ...
```

---

## 🐍 Python Empaquetado (v0.1.80+)

### Configuración

- **Versión:** Python 3.11.9 embeddable
- **Ubicación:** `Portear/python-embed/`
- **Configuración crítica:** `python311._pth` con `import site` descomentado
- **Paquetes instalados en:** `Portear/python-embed/Lib/site-packages/`

### Paquetes Críticos (79+)

| Categoría | Paquetes |
|-----------|----------|
| **Datos** | pandas, numpy, python-dateutil |
| **Word** | python-docx, docxtpl, lxml |
| **Excel** | openpyxl, et-xmlfile |
| **PDF** | PyMuPDF, reportlab, pillow |
| **Servidor** | flask, jinja2, werkzeug |
| **Automatización** | pywin32 |
| **IA/LLM** | ~~torch~~ (excluido en v0.1.83) |
| **Build** | pip, setuptools, wheel |

### Scripts Python Principales

| Script | Función |
|--------|---------|
| `map_directory.py` | Mapear estructura de directorios (SIN checksum desde v0.1.83) |
| `actualizar_ausentismo.py` | Procesar archivos de ausentismo (Excel) |
| `convert_docx_to_pdf.py` | Convertir Word a PDF |
| `convert_xlsx_to_pdf.py` | Convertir Excel a PDF |
| `dashboard_scanner.py` | Escanear dashboard (pandas) |
| `copasst_acta_generator.py` | Generar actas COPASST |
| `comite_convivencia_acta_generator.py` | Generar actas Convivencia |

---

## 📊 Estado Actual (v0.1.90)

### ✅ Funcionalidades Operativas

- [x] Python empaquetado funcional (sin instalación manual)
- [x] Recursos locales (bootstrap-icons, font-awesome, Roboto)
- [x] Mapeo rápido de directorios (<10 segundos)
- [x] Ausentismo funcional (pandas)
- [x] Conversión PDF (python-docx, openpyxl, PyMuPDF)
- [x] Generación de actas (COPASST, Convivencia)
- [x] Autenticación con SQLite
- [x] Multi-empresa con escenarios normativos
- [x] Actualizaciones automáticas desde GitHub
- [x] **Guardado de Presupuesto** - Fórmulas compartidas preservadas 🆕
- [x] **Inducciones con Cumplimiento Normativo** - Cálculo real basado en nómina 🆕
- [x] **Visualizador 1.1.1 Mejorado** - Drag & drop, menú contextual, eliminar, toast 🆕
- [x] **Soporte Responsive** - Optimizado para 1366x768 y 1536x864 🆕
- [x] **Espaciado Compacto en Módulo Recursos** - 75% menos espacio entre widgets y gráficas 🆕
- [x] **Login Modernizado** - Animaciones, logo K+AIR, fondo Vanta.js, íconos en inputs 🆕
- [x] **Transición Animada Login→Interfaz** - Overlay con spinner, mensajes, progreso y check de éxito 🆕

### ️ Limitaciones Temporales

- [ ] **IA/LLM deshabilitada** - torch excluido para reducir tamaño de build
  - **Razón:** Build de ~800 MB → ~450 MB, tiempo 15-25 min → 8-12 min
  - **Re-habilitar:** Eliminar `!Lib/site-packages/torch/**` de package.json

### 🔧 Mejoras Recientes

**v0.1.90 (21 de marzo de 2026):**
1. **Feature: Transición Animada Login→Interfaz** - Overlay con logo, spinner, mensajes y progreso
2. **Secuencia de 8 fases** - Fade-out login, overlay, loading (4 mensajes), éxito, fade-out overlay
3. **Personalización** - Nombre del usuario en bienvenida, mensajes dinámicos con dots animados
4. **Accesibilidad** - Respeta `prefers-reduced-motion` para usuarios sensibles

**v0.1.89 (21 de marzo de 2026):**
1. **Feature: Login Modernizado** - Animaciones fade-in, stagger, logo K+AIR
2. **Fondo Vanta.js** - Olas animadas con colores corporativos en login
3. **Íconos en inputs** - Sobre (email) y candado (password) con Font Awesome
4. **Micro-interacciones** - Hover, focus, shake, spinner de carga
5. **Accesibilidad** - Respeta prefers-reduced-motion

**v0.1.88 (21 de marzo de 2026):**
1. **Fix: Espaciado Módulo Recursos** - Reducción de 75% en espacio entre widgets y gráficas
2. **Estilos globales anidados** - Solucionado conflicto con `!important` en styles.css
3. **Selectores con especificidad** - Patrón implementado para evitar conflictos futuros

**v0.1.87 (20 de marzo de 2026):**
1. **Feature: Soporte Responsive** - Optimizado para 1366x768 y 1536x864
2. **Media queries específicas** - Ajustes progresivos por resolución
3. **Ventana inicial optimizada** - 1200x700 (cabe en 1366x768)
4. **Sin cambios en ≥1920x1080** - Mantiene UI original

**v0.1.86 (20 de marzo de 2026):**
1. **Feature: Drag & Drop en Visualizador 1.1.1** - Arrastrar y soltar archivos en carpetas
2. **Feature: Menú Contextual** - Clic derecho para abrir o eliminar archivos
3. **Feature: Modal de Confirmación** - Reemplaza `confirm()` nativo
4. **Feature: Notificaciones Toast** - Sistema moderno K+AIR
5. **Feature: Manejo de Errores** - Específico por tipo (EPERM, ENOENT, EACCES)

**v0.1.85 (20 de marzo de 2026):**
1. **Feature: Cumplimiento Normativo en Inducciones** - Cálculo real basado en nómina
2. **Cálculo de pendientes** - `empleados - completadas`
3. **Alertas inteligentes** - Óptimo (≥90%), refuerzo (≥50%), crítico (<50%)
4. **Fallback automático** - Si no hay empleados configurados, usa histórico

**v0.1.84 (20 de marzo de 2026):**
1. **Fix: Error "Shared Formula master"** - Guardado de Presupuesto funcional
2. **Detección de fórmulas compartidas** - Preservación automática
3. **Cálculo de totales desde backend** - Fila TOTAL calculada automáticamente
4. **Manejo seguro de merges** - Sin warnings por merges duplicados

**v0.1.83 (19 de marzo de 2026):**
1. **Exclusión de torch** - Reduce tamaño y tiempo de build
2. **Eliminación de checksum** - Mapeo 1500+ segundos → <10 segundos
3. **Recursos locales** - Sin ERR_TIMED_OUT de CDNs
4. **waitForElement mejorado** - Retry logic con backoff exponencial

---

## 🔗 Enlaces Críticos de Documentación

### Para Nuevos Desarrolladores
1. **docs/START_HERE.md** - Punto de entrada único
2. **docs/01-quick-start/installation.md** - Instalación y configuración
3. **docs/02-architecture/overview.md** - Arquitectura general

### Para IA (Cursor, Copilot, etc.)
1. **CONTEXT.md** (este archivo) - Contexto completo
2. **docs/02-architecture/ipc-contracts.md** - Contratos IPC (CRÍTICO)
3. **docs/03-modules/** - Módulos específicos

### Para Usuarios Finales
1. **README.md** (raíz) - Guía de usuario y visión general
2. **docs/01-quick-start/troubleshooting.md** - Problemas comunes
3. **docs/acerca-de-actualizacion.md** - Actualización del sistema

### Referencia Técnica
1. **CHANGELOG.md** - Historial de cambios por versión
2. **docs/05-updates/** - Actualizaciones detalladas
3. **docs/04-guides/backend-contracts.md** - Contratos backend

---

## 📋 Convenciones de Desarrollo

### Backend (main.js)

```javascript
// Todos los handlers IPC siguen este patrón:
ipcMain.handle('nombre-handler', async (event, params) => {
  try {
    // 1. Validar datos
    // 2. Ejecutar lógica
    // 3. Retornar { success: true, data: {...} }
  } catch (error) {
    // Retornar { success: false, error: { code, message } }
  }
});
```

### Frontend (renderer.js)

```javascript
// Llamar handlers IPC:
const result = await electronAPI.nombreHandler(params);
if (result.success) {
  // Usar result.data
} else {
  // Manejar result.error
}
```

### Python Scripts

```python
# Todos los scripts retornan JSON por stdout:
if __name__ == "__main__":
    try:
        result = process()
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
```

---

## 🚀 Comandos de Build

```bash
# Desarrollo
npm start

# Build (producción)
export GH_TOKEN=<tu_token>
npx electron-builder --win --publish=always

# Build con Python empaquetado
# (python-embed ya está configurado en package.json)
```

**Tiempos estimados (v0.1.83):**
- Build: 8-12 minutos
- Tamaño installer: ~450 MB

---

## 🆕 Cambios Recientes (v0.1.93 - 25 de marzo de 2026)

### 1. Visualizadores Modernizados (9 submódulos)

**Descripción:** Sistema unificado de gestión documental con funciones modernas replicadas en 9 visualizadores.

**Submódulos Actualizados:**
| Código | Submódulo | Funciones |
|--------|-----------|-----------|
| 1.1.1 | Responsable SG | Drag&Drop, Context Menu, Toast, Confirm Modal |
| 1.1.2 | Roles y Responsabilidades | Drag&Drop, Context Menu, Toast, Confirm Modal |
| 1.1.4 | Afiliación al SSSI | Drag&Drop, Context Menu, Toast, Confirm Modal |
| 1.1.5 | Trabajo de Alto Riesgo | Drag&Drop, Context Menu, Toast, Confirm Modal |
| 1.1.6 | Conformación de Copasst | Drag&Drop, Context Menu, Toast, Confirm Modal |
| 1.1.7 | Capacitación al Copasst | Drag&Drop, Context Menu, Toast, Confirm Modal |
| 1.1.8 | Comité de Convivencia | Drag&Drop, Context Menu, Toast, Confirm Modal |
| 1.2.3 | Curso Virtual 50 Horas | Drag&Drop, Context Menu, Toast, Confirm Modal |
| 1.2.4 | Manual SST Proveedores | Drag&Drop, Context Menu, Toast, Confirm Modal |

**Funciones Implementadas:**

1. **Drag & Drop de Archivos**
   - Overlay visual con ícono animado bounce
   - Subida automática de archivos soltados
   - Manejo de múltiples archivos simultáneos
   - Feedback con notificaciones toast

2. **Menú Contextual (Clic Derecho)**
   - Menú flotante con opciones: Abrir archivo, Eliminar archivo
   - Posicionamiento inteligente (no sale de pantalla)
   - Cierre con clic fuera o tecla Escape

3. **Modal de Confirmación Moderno**
   - Diseño centrado con animación slideUp
   - Header amarillo con ícono de advertencia
   - Nombre del archivo en caja destacada
   - Botones Cancelar / Eliminar estilizados

4. **Notificaciones Toast Modernas**
   - 4 tipos: success, error, warning, info
   - Iconos FontAwesome por tipo
   - Auto-eliminación con animación fade-out (300ms)
   - Contenedor en esquina superior derecha

5. **Abrir Archivo con Aplicación Predeterminada**
   - Opción en menú contextual
   - Usa `electronAPI.open-file`
   - Manejo de errores específico (EPERM, ENOENT, EACCES)

**Archivos Modificados por Submódulo:**

| Archivo | Líneas agregadas | Funciones |
|---------|-----------------|-----------|
| `[submodulo]-view.html` | ~40 | contextMenu, confirmModal, kToastContainer |
| `[submodulo]-view.css` | ~280 | Estilos para modales, toast, drag&drop |
| `[submodulo]-viewer.js` | ~450 | Todas las funciones modernas |

**Funciones JavaScript Agregadas:**

```javascript
// Drag & Drop
- setupDragAndDrop()
- setupFolderDragAndDrop(folderElement, folderPath)
- preventDefaults(e)
- handleDragOver(e)
- uploadFile(file, folderPath)
- fileToBase64(file)

// Context Menu
- showContextMenu(x, y, doc)
- hideContextMenu()
- deleteDocument()
- setupContextMenu()
- openFile()

// Toast Notifications
- showToast(message, type, duration)

// Confirm Modal
- showConfirmModal(fileName, callback)
- hideConfirmModal()
- acceptConfirm()
- cancelConfirm()
- setupConfirmModal()
```

**Funciones Actualizadas:**

| Función | Cambio |
|---------|--------|
| `setupEventListeners()` | Ahora llama a `setupDragAndDrop()` y `setupContextMenu()` |
| `renderFolders()` | Agrega clase 'folder' y llama a `setupFolderDragAndDrop()` |
| `renderDocuments()` | Agrega evento 'contextmenu' para clic derecho |

**Impacto:**
- **UX:** Mejora significativa en usabilidad y consistencia entre submódulos
- **Backend:** Sin cambios (mismos contratos IPC)
- **Temas:** Compatible con claro, oscuro (system), oscuro (legacy)
- **Consistencia:** 9 visualizadores con misma UX/UI

---

## 🆕 Cambios Recientes (v0.1.92 - 25 de marzo de 2026)

### 1. Alerta de Afiliación al SSSI

**Backend (`main.js`):**
- Nueva función `calculateAfiliacionStats()` que busca planillas de afiliación en `1.1.4 Afiliación al SSSI`
- Detección automática de archivos PDF/XLSX con "planilla" en el nombre
- Extracción del mes desde el nombre del archivo (ej: "planilla_marzo_2026.pdf")
- Comparación con el mes en curso y generación de alerta crítica si falta
- Integración en `get-recursos-stats` API
- Integración en `getDashboardAlertas()`

**Frontend (`recursos-home.js`):**
- Nueva función `calculateAfiliacionClientSide()` (espejo del backend)
- Widget visual `createAfiliacionWidget()` con diseño consistente a presupuesto
- Badge verde "Al día" o rojo "Pendiente"
- Muestra mes actual y último mes registrado
- Actualización en `loadResourceStats()`

**Archivos modificados:**
- `main.js`: `calculateAfiliacionStats()`, `get-recursos-stats`, `getDashboardAlertas()`
- `modules/recursos/recursos-home.js`: `calculateAfiliacionClientSide()`, `createAfiliacionWidget()`, `loadResourceStats()`

### 2. Dashboard con Filtros por Módulo

**Panel "MÓDULOS DEL SISTEMA":**
- Panel lateral en dashboard con lista de módulos interactiva
- Cada módulo muestra badge con cantidad de alertas
- Click en módulo filtra tareas del dashboard
- Resaltado azul del módulo seleccionado

**Funciones implementadas:**
- `updateModuleSelection(moduleName)`: Actualiza visualmente módulo seleccionado
- `filterDashboardTasksByModule(moduleName)`: Filtra tareas y actualiza UI
- `clearFilter()`: Limpia filtro y selección de módulo

**Archivos modificados:**
- `renderer.js`: Creación del panel, `updateModuleSelection()`, `filterDashboardTasksByModule()`, `clearFilter()`

### 3. Sidebar Inteligente

**Problema corregido:** Botón de módulo permanecía resaltado permanentemente

**Solución implementada:**
- Limpieza de referencia `window.activeSidebarButton` en `createSidebarButtons()`
- Limpieza en `showCompanyHomePage()` (al mostrar dashboard)
- Limpieza en `selectCompany()` (al cambiar de empresa)

**Archivos modificados:**
- `renderer.js`: `createSidebarButtons()`, `showCompanyHomePage()`, `selectCompany()`

### 4. Logs de Depuración para Alertas

**Backend (`main.js`):**
- Logs detallados para cada tipo de alerta (capacitaciones, inducciones, EPP, presupuesto, afiliación)
- Resumen final con total de alertas generadas
- Detalle de cada tarea con módulo, submódulo y descripción

**Frontend (`recursos-home.js`):**
- Logs en `calculateAfiliacionClientSide()` con datos para renderizar
- Logs en `createAfiliacionWidget()` con estado visual
- Resumen en `loadResourceStats()` con todas las estadísticas cargadas

**Archivos modificados:**
- `main.js`: `getDashboardAlertas()` con logs para cada alerta
- `modules/recursos/recursos-home.js`: Logs en funciones de afiliación

---

## 📞 Recursos Adicionales

- **Repositorio:** https://github.com/Reivaj640/SG-SST-E
- **Releases:** https://github.com/Reivaj640/SG-SST-E/releases
- **Documentación:** `/docs/`
- **API (JSDoc):** `/docs/api/` (generado automáticamente)

---

**Documento creado:** 19 de marzo de 2026  
**Propósito:** Contexto unificado para IA y nuevos desarrolladores  
**Mantenimiento:** Actualizar con cada cambio arquitectónico mayor

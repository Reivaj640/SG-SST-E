# K+AIR - Contexto del Proyecto

**Última actualización:** 19 de marzo de 2026  
**Versión actual:** 0.1.83  
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

## 📊 Estado Actual (v0.1.83)

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

### ⚠️ Limitaciones Temporales

- [ ] **IA/LLM deshabilitada** - torch excluido para reducir tamaño de build
  - **Razón:** Build de ~800 MB → ~450 MB, tiempo 15-25 min → 8-12 min
  - **Re-habilitar:** Eliminar `!Lib/site-packages/torch/**` de package.json

### 🔧 Mejoras Recientes (v0.1.83)

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

## 📞 Recursos Adicionales

- **Repositorio:** https://github.com/Reivaj640/SG-SST-E
- **Releases:** https://github.com/Reivaj640/SG-SST-E/releases
- **Documentación:** `/docs/`
- **API (JSDoc):** `/docs/api/` (generado automáticamente)

---

**Documento creado:** 19 de marzo de 2026  
**Propósito:** Contexto unificado para IA y nuevos desarrolladores  
**Mantenimiento:** Actualizar con cada cambio arquitectónico mayor

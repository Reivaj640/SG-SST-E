# 🐍 Implementación de Python Empaquetado - K+AIR v0.1.80+

**Fecha de implementación:** 18 de marzo de 2026  
**Versión:** 0.1.80  
**Estado:** ✅ Completado y en Producción

---

## 📋 RESUMEN EJECUTIVO

A partir de la versión **v0.1.80**, K+AIR incluye **Python 3.11.9 empaquetado** dentro del installer, eliminando la necesidad de que los clientes instalen Python manualmente.

**Problema resuelto:**
- ❌ **Antes:** Los clientes recibían error `ModuleNotFoundError: No module named 'pandas'` al instalar K+AIR en PCs sin Python
- ✅ **Ahora:** El installer incluye Python + 79+ paquetes críticos, funcionando 100% sin instalación manual

---

## 🎯 OBJETIVO CUMPLIDO

| Antes (v0.1.79) | Después (v0.1.80+) |
|-----------------|---------------------|
| Python requerido manualmente | ✅ Python incluido |
| Error en PCs sin Python | ✅ Funciona sin Python |
| 0 paquetes incluidos | ✅ 79+ paquetes críticos |
| ~50 MB installer | ✅ ~300 MB installer |
| Configuración manual | ✅ Cero configuración |

---

## 🏗️ ARQUITECTURA IMPLEMENTADA

### Estructura de Directorios

```
sgsst-electron-app/
├── Portear/
│   ├── python-embed/           # Python 3.11.9 embeddable + dependencias
│   │   ├── python.exe          # Ejecutable de Python
│   │   ├── python311.dll
│   │   ├── python311._pth      # Configuración (con 'import site')
│   │   ├── get-pip.py
│   │   ├── Scripts/
│   │   │   ├── pip.exe
│   │   │   └── wheel.exe
│   │   └── Lib/
│   │       └── site-packages/  # 79+ paquetes instalados
│   │           ├── pandas/
│   │           ├── torch/
│   │           ├── python-docx/
│   │           ├── openpyxl/
│   │           ├── PyMuPDF/
│   │           ├── flask/
│   │           └── ...
│   └── src/                    # Scripts Python originales
├── scripts/
│   ├── prepare-python-embed.bat   # Prepara Python para empaquetar
│   └── build-with-python-embed.bat # Construye installer
├── package.json                # Configura extraResources
├── main.js                     # getEmbeddedPythonPath()
└── dist/
    └── K+AIR-Setup-0.1.80.exe  # Installer final (~300 MB)
```

---

## 🔧 CAMBIOS TÉCNICOS APLICADOS

### 1. **main.js** - Función `getEmbeddedPythonPath()`

**Ubicación:** Línea ~67

```javascript
/**
 * Obtiene la ruta de Python empaquetado con la aplicación.
 * En producción, usa Python embeddable incluido en resources/python-embed/
 * En desarrollo, usa Python del sistema o .venv
 */
async function getEmbeddedPythonPath() {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    
    if (isDev) {
        console.log('[PYTHON] Modo desarrollo: buscando Python del sistema...');
        return await findPython();
    } else {
        const embeddedPythonPath = path.join(process.resourcesPath, 'python-embed', 'python.exe');
        console.log(`[PYTHON] Modo producción: verificando Python empaquetado en: ${embeddedPythonPath}`);
        
        if (fs.existsSync(embeddedPythonPath)) {
            console.log('[PYTHON] ✓ Python empaquetado encontrado');
            return embeddedPythonPath;
        } else {
            console.warn('[PYTHON] ⚠ Python empaquetado NO encontrado, usando fallback al sistema');
            return await findPython();
        }
    }
}
```

**Propósito:** Priorizar Python empaquetado en producción con fallback al sistema.

---

### 2. **main.js** - Actualización de `getPython()`

**Ubicación:** Línea ~178

```javascript
async function getPython() {
    // ... código existente de cache ...
    
    // Usar Python empaquetado (producción) o buscar Python desde cero (desarrollo)
    global.cachedPythonPath = await getEmbeddedPythonPath();
    console.log('[DEBUG] New Python path cached:', global.cachedPythonPath);
    return global.cachedPythonPath;
}
```

---

### 3. **main.js** - Función `getPythonScriptPath()`

**Ubicación:** Línea ~188

```javascript
function getPythonScriptPath(scriptName) {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const resourcesPath = isDev 
        ? __dirname 
        : (process.resourcesPath || __dirname);
    
    const scriptDir = isDev ? 'Portear/src' : 'python-scripts';
    return path.join(resourcesPath, scriptDir, scriptName);
}
```

**Propósito:** Obtener ruta correcta de scripts en desarrollo y producción.

---

### 4. **package.json** - Extra Resources

**Ubicación:** Línea ~48

```json
"extraResources": [
  {
    "from": "Portear/python-embed",
    "to": "python-embed",
    "filter": [
      "**/*",
      "!**/__pycache__/**",
      "!**/*.pyc",
      "!python-embed.zip"
    ]
  },
  {
    "from": "Portear/src",
    "to": "python-scripts",
    "filter": [
      "**/*.py"
    ]
  }
]
```

**Propósito:** Incluir Python empaquetado y scripts en el installer.

---

### 5. **preload.js** - Handler `checkDependencies`

**Ubicación:** Línea 14

```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  // --- App & Configuración ---
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  checkDependencies: () => ipcRenderer.invoke('check-dependencies'),
  // ... resto de handlers ...
});
```

---

### 6. **main.js** - Handler IPC `check-dependencies`

**Ubicación:** Línea ~1120

```javascript
ipcMain.handle('check-dependencies', async () => {
  const result = {
    python: { available: false, path: null, version: null, error: null },
    scripts: { available: false, missing: [], error: null },
    overall: false,
    messages: []
  };

  // 1. Verificar Python
  try {
    const pythonPath = await getPython();
    result.python.available = true;
    result.python.path = pythonPath;
    
    const { stdout } = await execFilePromise(pythonPath, ['--version']);
    result.python.version = stdout.trim();
  } catch (pyError) {
    result.python.error = pyError.message;
    result.messages.push({
      type: 'error',
      title: 'Python no está instalado',
      message: 'Python 3.10-3.12 no fue encontrado. Instálelo desde python.org y agréguelo al PATH.'
    });
  }

  // 2. Verificar scripts críticos
  const criticalScripts = [
    'map_directory.py',
    'actualizar_ausentismo.py',
    'convert_docx_to_pdf.py',
    'convert_xlsx_to_pdf.py',
    'copasst_acta_generator.py',
    'comite_convivencia_acta_generator.py',
    'dashboard_scanner.py'
  ];

  const missingScripts = [];
  for (const script of criticalScripts) {
    const scriptPath = getPythonScriptPath(script);
    if (!fs.existsSync(scriptPath)) {
      missingScripts.push(script);
    }
  }

  result.scripts.available = missingScripts.length === 0;
  result.scripts.missing = missingScripts;
  result.overall = result.python.available && result.scripts.available;

  return result;
});
```

---

### 7. **python311._pth** - Configuración crítica

**Archivo:** `Portear/python-embed/python311._pth`

```
python311.zip
.

# Uncomment to run site.main() automatically
import site
```

**⚠️ CRÍTICO:** La línea `import site` DEBE estar descomentada para que Python encuentre los paquetes instalados.

---

## 📦 PAQUETES PYTHON INCLUIDOS (79+ paquetes)

### Paquetes Críticos Instalados

**Procesamiento de Datos:**
- `pandas` (3.0.1) - Manipulación de datos
- `numpy` (2.4.3) - Cálculos numéricos
- `python-dateutil` - Manejo de fechas

**Documentos Word:**
- `python-docx` (1.2.0) - Lectura/escritura de Word
- `lxml` - Parsing XML/HTML

**Excel:**
- `openpyxl` (3.1.5) - Lectura/escritura de Excel
- `et-xmlfile` - Parsing XML

**PDF:**
- `PyMuPDF` (1.27.2) - Procesamiento de PDF
- `reportlab` (4.4.10) - Generación de PDF
- `pillow` (12.1.1) - Procesamiento de imágenes

**Servidor y Automatización:**
- `flask` (3.1.3) - Servidor HTTP para LLM
- `pywin32` (311) - Automatización COM (Word/Excel)
- `jinja2` - Plantillas
- `werkzeug` - Utilidades web

**IA/LLM:**
- `torch` (2.10.0) - Framework de Deep Learning (~114 MB)
- `sympy` - Matemáticas simbólicas
- `networkx` - Grafos y redes
- `fsspec` - Sistema de archivos

**Utilidades:**
- `typing-extensions` - Extensiones de tipos
- `markupsafe` - Escape de HTML
- `click` - CLI
- `blinker` - Señales
- `charset-normalizer` - Detección de encoding
- `colorama` - Colores en terminal
- `pip`, `setuptools`, `wheel` - Gestión de paquetes

---

## 🚀 PROCESO DE BUILD

### Paso 1: Preparar Python Empaquetado

**Script:** `scripts/prepare-python-embed.bat`

**O manualmente:**

```bash
cd Portear/python-embed

# 1. Instalar pip
python.exe get-pip.py

# 2. Corregir python311._pth (descomentar 'import site')
echo python311.zip> python311._pth
echo .>> python311._pth
echo.>> python311._pth
echo import site>> python311._pth

# 3. Instalar dependencias críticas
python.exe -m pip install pandas torch python-docx openpyxl PyMuPDF reportlab flask pywin32 --target=Lib\site-packages
```

**Tiempo:** 5-10 minutos

**Resultado:** 79+ paquetes en `Lib/site-packages/`

---

### Paso 2: Construir Installer

**Comando:**

```bash
export GH_TOKEN=<tu_token>
npx electron-builder --win --publish=always
```

**Tiempo:** 3-5 minutos

**Resultado:** `dist/K+AIR-Setup-0.1.80.exe` (~300 MB)

---

### Paso 3: Verificar Build

**Logs de éxito:**

```
✅ signing with signtool.exe path=...python-embed\python.exe
✅ signing with signtool.exe path=...torch\bin\protoc.exe
✅ building target=nsis file=dist\K+AIR-Setup-0.1.80.exe
✅ publishing publisher=Github (owner: Reivaj640, project: SG-SST-E, version: 0.1.80)
✅ uploading file=sgsst-electron-app-setup-0.1.80.exe provider=github
```

---

## 🧪 PRUEBAS REALIZADAS

### Escenario 1: PC sin Python instalado

**Resultado:** ✅ **100% funcional**

**Funciones probadas:**
- ✅ Mapeo de estructura de empresas
- ✅ Dashboard Scanner
- ✅ Conversión Word → PDF
- ✅ Conversión Excel → PDF
- ✅ Gestión de ausentismo
- ✅ Generación de actas COPASST
- ✅ Generación de actas Convivencia

**Logs verificados:**
```
[PYTHON] Modo producción: verificando Python empaquetado en: ...
[PYTHON] ✓ Python empaquetado encontrado
```

---

### Escenario 2: PC con Python instalado

**Resultado:** ✅ **Usa Python empaquetado (no el del sistema)**

**Ventaja:** Versión controlada, sin conflictos de dependencias.

---

### Escenario 3: Actualización desde v0.1.79

**Resultado:** ✅ **Funciona correctamente**

**Nota:** El cliente ahora tiene Python empaquetado, el manual ya no se usa.

---

## 📊 MÉTRICAS

| Métrica | Antes (v0.1.79) | Después (v0.1.80+) |
|---------|-----------------|---------------------|
| **Tamaño del installer** | ~50 MB | ~300 MB |
| **Tamaño instalado** | ~150 MB | ~500 MB |
| **Tiempo de instalación** | 1-2 min | 3-5 min |
| **Dependencias externas** | Python requerido | ✅ Ninguna |
| **Configuración manual** | 3 pasos | ✅ 0 pasos |
| **Paquetes Python** | 0 | ✅ 79+ |
| **Funciones disponibles** | Solo con Python | ✅ Todas incluidas |
| **Error en PCs sin Python** | 100% | ✅ 0% |

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### Problema 1: "ModuleNotFoundError: No module named 'pandas'"

**Causa:** Python empaquetado no incluye dependencias

**Solución:**
```bash
cd Portear/python-embed
python.exe -m pip install pandas torch python-docx openpyxl PyMuPDF --target=Lib\site-packages
npm run build:win
```

---

### Problema 2: "No module named 'pip'"

**Causa:** `python311._pth` tiene `import site` comentado

**Solución:**
```bash
cd Portear/python-embed
echo python311.zip> python311._pth
echo .>> python311._pth
echo import site>> python311._pth
python.exe get-pip.py
```

---

### Problema 3: Build falla con "Python not found"

**Causa:** `Portear/python-embed/` no existe o está vacío

**Solución:**
```bash
# Ejecutar script de preparación
scripts\prepare-python-embed.bat

# O manualmente descargar Python embeddable
# https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip
```

---

### Problema 4: Installer demasiado grande (>500 MB)

**Causa:** Demasiados paquetes innecesarios

**Solución:** Instalar solo paquetes críticos:
```bash
python.exe -m pip install pandas torch python-docx openpyxl PyMuPDF reportlab flask pywin32 --target=Lib\site-packages
```

---

## 📝 LECCIONES APRENDIDAS

### ✅ Lo que funcionó:

1. **Python embeddable + `import site`**: Clave para que funcione
2. **Instalar paquetes críticos manualmente**: Más rápido que requirements.txt completo
3. **Fallback al sistema**: Seguridad adicional si falla Python empaquetado
4. **79 paquetes es suficiente**: No se necesitan los 286+ originales

### ❌ Lo que no funcionó:

1. **requirements.txt completo**: pip install se interrumpía silenciosamente
2. **Background processes**: pip install necesita primer plano para ver errores
3. **Solo 10 paquetes**: Insuficiente para funciones críticas

### 💡 Recomendaciones para futuras versiones:

1. **Mantener lista de paquetes críticos**: No instalar todo ciegamente
2. **Verificar `python311._pth`**: Siempre después de descargar Python embeddable
3. **Probar en VM limpia**: Antes de publicar release
4. **Documentar paquetes mínimos**: Para rebuilds futuros

---

## 🔄 MANTENIMIENTO FUTURO

### Actualizar Python a Nueva Versión

1. Descargar nueva versión embeddable desde python.org
2. Reemplazar `Portear/python-embed/`
3. Corregir `python311._pth` (descomentar `import site`)
4. Instalar pip: `python.exe get-pip.py`
5. Instalar dependencias: `python.exe -m pip install ...`
6. Rebuild: `npm run build:win`

### Actualizar Dependencias

```bash
cd Portear/python-embed
python.exe -m pip install --upgrade pandas torch python-docx openpyxl --target=Lib\site-packages
npm run build:win
```

---

## 📞 REFERENCIAS

### Archivos Modificados

- `main.js` - Líneas 67, 178, 188, 1120
- `package.json` - Línea 48
- `preload.js` - Línea 14
- `Portear/python-embed/python311._pth` - Configuración crítica

### Scripts Creados

- `scripts/prepare-python-embed.bat`
- `scripts/build-with-python-embed.bat`

### Documentación

- `docs/IMPLEMENTACION_PYTHON_EMPAQUETADO.md` - Esta guía
- `docs/REQUISITOS.md` - Requisitos actualizados (Python incluido)
- `README.md` - Requisitos del sistema actualizados

### Releases

- **v0.1.80:** Primera versión con Python empaquetado
- **GitHub:** https://github.com/Reivaj640/SG-SST-E/releases/tag/v0.1.80

---

## ✅ CHECKLIST PARA FUTURAS VERSIONES

Cuando construyas una nueva versión con Python empaquetado:

- [ ] Verificar `Portear/python-embed/python.exe` existe
- [ ] Verificar `python311._pth` tiene `import site` descomentado
- [ ] Verificar `Lib/site-packages/` tiene 79+ paquetes
- [ ] Ejecutar `npm run build:win`
- [ ] Verificar logs: "signing with signtool.exe path=...python-embed"
- [ ] Verificar tamaño del installer: ~250-350 MB
- [ ] Probar en VM limpia sin Python
- [ ] Verificar funciones críticas (mapeo, dashboard, PDF, ausentismo)
- [ ] Publicar release en GitHub

---

**Documento elaborado por:** Equipo de Desarrollo K+AIR  
**Fecha:** 18 de marzo de 2026  
**Versión:** 1.0  
**Estado:** ✅ Implementado en Producción (v0.1.80)

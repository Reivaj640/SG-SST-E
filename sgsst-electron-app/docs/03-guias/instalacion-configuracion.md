# 🛠️ Instalación y Configuración K+AIR

**Versión:** 1.0  
**Actualizado:** 6 de marzo de 2026  
**Estado:** ✅ Actualizado

---

## 📋 Tabla de Contenidos

1. [Requisitos del Sistema](#1-requisitos-del-sistema)
2. [Instalación Paso a Paso](#2-instalación-paso-a-paso)
3. [Configuración del Entorno](#3-configuración-del-entorno)
4. [Comandos Disponibles](#4-comandos-disponibles)
5. [Solución de Problemas](#5-solución-de-problemas)

---

## 1. Requisitos del Sistema

### 1.1 Hardware Recomendado

| Componente | Mínimo | Recomendado |
|------------|--------|-------------|
| **Procesador** | Intel i5 / AMD Ryzen 5 | Intel i7 / AMD Ryzen 7 |
| **RAM** | 8 GB | 16 GB |
| **Almacenamiento** | 2 GB HDD | 5 GB SSD |
| **GPU** (opcional) | Integrada | NVIDIA con 4GB VRAM |
| **Pantalla** | 1366x768 | 1920x1080 |

### 1.2 Software Requerido

| Componente | Versión Mínima | Recomendada | Notas |
|------------|----------------|-------------|-------|
| **Node.js** | 18.x | 20.x LTS | [Descargar](https://nodejs.org/) |
| **Python** | 3.10 | 3.11-3.12 | ⚠️ NO usar 3.14 |
| **Git** | Última | Última | [Descargar](https://git-scm.com/) |
| **CUDA** (opcional) | 12.x | 12.x | Para GPU NVIDIA |

### 1.3 Sistemas Operativos Soportados

- ✅ Windows 10/11 (64-bit)
- ✅ macOS 11+ (Big Sur o superior)
- ✅ Linux (Ubuntu 20.04+, Fedora 35+)

---

## 2. Instalación Paso a Paso

### 2.1 Clonar Repositorio

```bash
# Clonar repositorio
git clone https://github.com/Reivaj640/SG-SST-E.git sgsst-electron-app

# Navegar al directorio
cd sgsst-electron-app
```

### 2.2 Instalar Dependencias Node.js

```bash
# Instalar dependencias
npm install

# Verificar instalación
npm list --depth=0
```

**Paquetes instalados:**
- `electron` ^37.3.0 - Framework principal
- `electron-log` ^5.4.3 - Sistema de logging
- `electron-updater` ^6.6.2 - Actualizaciones automáticas
- `xlsx` ^0.18.5 - Lectura/escritura de Excel
- `exceljs` ^4.4.0 - Manipulación avanzada de Excel
- `pdf-parse` ^2.4.5 - Lectura de PDF
- `electron-builder` ^26.0.12 - Empaquetado

### 2.3 Configurar Entorno Virtual Python

```bash
# Navegar a directorio Portear
cd Portear

# Crear entorno virtual
python -m venv .venv

# Activar entorno virtual
# Windows:
.venv\Scripts\activate

# Linux/Mac:
source .venv/bin/activate
```

### 2.4 Instalar Dependencias Python

```bash
# Instalar todas las dependencias
pip install -r requirements.txt

# Verificar instalación
pip list
```

**Dependencias críticas:**
- `python-docx` 1.1.2 - Documentos Word
- `openpyxl` 3.1.5 - Archivos Excel
- `pandas` 2.2.3 - Manipulación de datos
- `flask` - Servidor HTTP para LLM
- `torch` 2.9.0+cu128 - Framework Deep Learning
- `transformers` 4.53.1 - Modelos de lenguaje
- `pdfplumber` 0.11.4 - Extracción de PDF

### 2.5 Verificar Instalación

```bash
# Verificar Node.js
node --version  # Debe mostrar v18.x o v20.x

# Verificar npm
npm --version

# Verificar Python
python --version  # Debe mostrar 3.10, 3.11 o 3.12

# Verificar pip
pip --version
```

---

## 3. Configuración del Entorno

### 3.1 Configurar Ruta del Modelo LLM

El modelo LLM se almacena en una ruta específica. Configurar en `Portear/src/llm_server.py`:

```python
RUTA_MODELO = "D:\\1. Estudio\\1.1 IA\\1.1.2. LLM's\\Inv. AT\\mistral-3-3B-Reasonig-2512"
PUERTO_SERVIDOR = 5555
```

### 3.2 Configurar Directorios de Empresas

Las empresas se almacenan en un directorio configurable. La estructura es:

```
Empresas/
├── Tempoactiva Est SAS/
│   ├── PI-FO-001.xlsx
│   ├── PI-FO-076.xlsx
│   ├── PRI.xlsx
│   └── normativa/
├── TempoSum SAS/
├── Aseplus SAS/
└── Asel SAS/
```

### 3.3 Configurar OnlyOffice (Opcional)

Para edición de documentos en línea:

1. Instalar Document Server de ONLYOFFICE
2. Configurar ruta en `modules/gestion-integral/politica/onlyoffice-bridge.js`
3. Generar certificados SSL

---

## 4. Comandos Disponibles

### 4.1 Desarrollo Diario

```bash
# Ejecutar aplicación en modo normal
npm start

# Modo desarrollo con recarga automática
npm run dev

# Depuración
npm run debug         # Debug completo
npm run debug-main    # Solo proceso principal
npm run debug-full    # Debug extendido
```

### 4.2 Construcción y Distribución

```bash
# Construir para plataforma actual
npm run build

# Construir para Windows
npm run build:win

# Construir para macOS
npm run build:mac

# Construir para Linux
npm run build:linux
```

### 4.3 Documentación

```bash
# Generar documentación API (JSDoc)
npm run docs:generate

# Vigilar cambios y regenerar automáticamente
npm run docs:watch
```

### 4.4 Utilidades

```bash
# Limpiar build anterior
npm run clean

# Verificar dependencias
npm run verify

# Ejecutar tests
npm test
```

---

## 5. Solución de Problemas

### 5.1 Python No Encontrado

**Error:**
```
Error: Python not found. Please install Python 3.10-3.12
```

**Solución:**
```bash
# Windows - Verificar instalación
py --version

# Si no está instalado, descargar de https://www.python.org/downloads/
# Marcar "Add Python to PATH" durante instalación

# Verificar que Python esté en PATH
where python  # Windows
which python  # Linux/Mac
```

### 5.2 Error de Dependencias Python

**Error:**
```
ERROR: Could not find a version that satisfies the requirement torch
```

**Solución:**
```bash
# Actualizar pip
python -m pip install --upgrade pip

# Instalar torch con CUDA (si hay GPU NVIDIA)
pip install torch --index-url https://download.pytorch.org/whl/cu128

# O versión CPU (sin GPU)
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

### 5.3 Error de Compilación en Windows

**Error:**
```
error: Microsoft Visual C++ 14.0 or greater is required
```

**Solución:**
1. Descargar Build Tools: https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. Instalar "Desktop development with C++"
3. Reiniciar y reintentar `npm install`

### 5.4 Modelo LLM No Carga

**Error:**
```
Error loading model: [Errno 2] No such file or directory
```

**Solución:**
1. Verificar ruta del modelo en `Portear/src/llm_server.py`
2. Asegurarse de que la ruta sea absoluta
3. Verificar permisos de lectura en el directorio
4. Reiniciar servidor Flask:
   ```bash
   cd Portear/src
   python llm_server.py
   ```

### 5.5 Electron No Inicia

**Error:**
```
A JavaScript error occurred in the main process
```

**Solución:**
```bash
# Eliminar node_modules y reinstalar
rm -rf node_modules package-lock.json
npm install

# Eliminar caché de Electron
rm -rf ~/.cache/electron

# Reintentar
npm start
```

### 5.6 Error de Permisos en Archivos Excel

**Error:**
```
Error: EPERM: operation not permitted, open '.../archivo.xlsx'
```

**Solución:**
1. Cerrar Excel si está abierto
2. Verificar que el archivo no esté en solo lectura
3. Ejecutar aplicación como administrador (Windows)
4. Verificar permisos del directorio

---

## 6. Verificación Post-Instalación

### Checklist de Verificación

- [ ] `npm start` ejecuta sin errores
- [ ] La ventana de la aplicación se abre
- [ ] Los módulos se cargan correctamente
- [ ] Python está accesible desde la aplicación
- [ ] El servidor LLM inicia (puerto 5555)
- [ ] Los archivos Excel se leen correctamente
- [ ] Los logs se generan en `logs/`

### Test Rápido

```bash
# Ejecutar aplicación
npm start

# En la aplicación:
# 1. Crear empresa de prueba
# 2. Navegar a Módulo 1.1.1 (Responsable SG)
# 3. Guardar datos de prueba
# 4. Verificar que se guarda en Excel
# 5. Navegar a Módulo 3.3.6 (Ausentismo)
# 6. Verificar que carga datos
```

---

## 7. Actualización desde Versión Anterior

### 7.1 Actualizar Dependencias Node.js

```bash
# Actualizar dependencias
npm update

# O reinstalar completamente
rm -rf node_modules package-lock.json
npm install
```

### 7.2 Actualizar Dependencias Python

```bash
# Activar entorno virtual
cd Portear
.venv\Scripts\activate  # Windows

# Actualizar dependencias
pip install --upgrade -r requirements.txt
```

### 7.3 Migrar Datos

Los datos de empresas se mantienen en el directorio `Empresas/`. No es necesario migrar nada.

---

## 8. Enlaces Externos

### Descargas Oficiales

- [Node.js](https://nodejs.org/)
- [Python](https://www.python.org/downloads/)
- [Git](https://git-scm.com/)
- [CUDA Toolkit](https://developer.nvidia.com/cuda-downloads)

### Documentación Oficial

- [Electron Docs](https://www.electronjs.org/docs)
- [Node.js Docs](https://nodejs.org/docs)
- [Python Docs](https://docs.python.org/3/)
- [Flask Docs](https://flask.palletsprojects.com/)

---

**Mantenido por:** Product Architect & Full-Stack Team  
**Última actualización:** 6 de marzo de 2026  
**Versión:** 0.1.70

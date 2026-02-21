# Dependencias del Sistema K+AIR - SG-SST

Este documento lista todas las dependencias necesarias para ejecutar el sistema K+AIR en un nuevo equipo.

## 📋 Requisitos del Sistema

| Componente | Versión Mínima | Notas |
|------------|----------------|-------|
| **Node.js** | 18.x o superior | Recomendado 20.x LTS |
| **Python** | 3.10 - 3.12 | No usar 3.14 (incompatibilidad con algunas librerías) |
| **CUDA** | 12.x | Para uso de GPU con el modelo LLM |
| **Git** | Última versión | Para control de versiones |

---

## 🔷 Dependencias Node.js

### Instalación
```bash
npm install
```

### Dependencias de Producción

| Paquete | Versión | Descripción |
|---------|---------|-------------|
| `electron` | ^37.3.0 | Framework principal de la aplicación |
| `electron-log` | ^5.4.3 | Sistema de logging |
| `electron-updater` | ^6.6.2 | Actualizaciones automáticas |
| `xlsx` | ^0.18.5 | Lectura/escritura de archivos Excel |
| `exceljs` | ^4.4.0 | Manipulación avanzada de Excel |
| `express` | ^5.2.1 | Servidor HTTP local |
| `cors` | ^2.8.6 | Manejo de CORS |
| `body-parser` | ^2.2.2 | Parsing de JSON |
| `pdf-parse` | ^2.4.5 | Lectura de archivos PDF |
| `jquery` | ^3.7.1 | Manipulación DOM |
| `jquery-ui-dist` | ^1.13.3 | Componentes UI jQuery |
| `vanilla-calendar-pro` | ^3.0.5 | Calendario |
| `node-fetch` | ^2.6.7 | Peticiones HTTP |
| `request` | ^2.88.2 | Peticiones HTTP legacy |

### Dependencias de Desarrollo

| Paquete | Versión | Descripción |
|---------|---------|-------------|
| `electron-builder` | ^26.0.12 | Empaquetado de la aplicación |
| `jsdoc` | ^4.0.5 | Generación de documentación |
| `nodemon` | ^3.1.10 | Recarga automática en desarrollo |
| `conventional-changelog-cli` | ^5.0.0 | Generación de changelog |

---

## 🐍 Dependencias Python

### Instalación
```bash
cd Portear
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### Dependencias Críticas (Requeridas)

#### Procesamiento de Documentos
| Paquete | Versión | Descripción |
|---------|---------|-------------|
| `python-docx` | 1.1.2 | Lectura/escritura de documentos Word |
| `docxtpl` | 0.20.0 | Plantillas de documentos Word |
| `openpyxl` | 3.1.5 | Lectura/escritura de Excel |
| `pandas` | 2.2.3 | Manipulación de datos |
| `pdfplumber` | 0.11.4 | Extracción de texto de PDF |
| `PyPDF2` | 3.0.1 | Manipulación de PDF |
| `PyMuPDF` | 1.25.2 | Procesamiento avanzado de PDF |
| `reportlab` | 4.2.5 | Generación de PDF |

#### Servidor LLM (IA)
| Paquete | Versión | Descripción |
|---------|---------|-------------|
| `torch` | 2.9.0+cu128 | Framework de Deep Learning |
| `transformers` | 4.53.1 | Modelos de lenguaje |
| `accelerate` | 0.27.2 | Aceleración de inferencia |
| `safetensors` | 0.4.5 | Formato seguro de tensores |
| `flask` | Última | Servidor HTTP para LLM |
| `tokenizers` | 0.21.2 | Tokenización eficiente |

#### OCR y Visión
| Paquete | Versión | Descripción |
|---------|---------|-------------|
| `opencv-python` | 4.10.0.84 | Procesamiento de imágenes |
| `pytesseract` | 0.3.13 | OCR |
| `pillow` | 11.0.0 | Manipulación de imágenes |

#### Utilidades
| Paquete | Versión | Descripción |
|---------|---------|-------------|
| `requests` | 2.32.3 | Peticiones HTTP |
| `tqdm` | 4.67.1 | Barras de progreso |
| `python-dateutil` | 2.9.0 | Manejo de fechas |
| `PyYAML` | 6.0.2 | Archivos de configuración |

### Dependencias Opcionales (Mejoran funcionalidad)

| Paquete | Descripción |
|---------|-------------|
| `gradio` | Interfaz web para modelos |
| `onnxruntime-gpu` | Inferencia optimizada con GPU |
| `scikit-learn` | Machine learning |
| `numpy` | Cálculos numéricos |

---

## 🖥️ Configuración del Modelo LLM

### Ruta del Modelo
El modelo debe estar ubicado en:
```
D:\1. Estudio\1.1 IA\1.1.2. LLM's\Inv. AT\mistral-3-3B-Reasonig-2512
```

Si se cambia la ubicación, actualizar en:
- `Portear/src/llm_server.py` (línea 57)

### Descarga del Modelo
El modelo está disponible en HuggingFace:
```bash
# Requiere huggingface-hub
pip install huggingface-hub

# Descargar modelo (ejemplo)
huggingface-cli download <repo-id> --local-dir ./mistral-3-3B-Reasonig-2512
```

### Requisitos de Hardware para LLM
| Componente | Mínimo | Recomendado |
|------------|--------|-------------|
| RAM | 16 GB | 32 GB |
| VRAM GPU | 8 GB | 12+ GB |
| Almacenamiento | 15 GB | 20 GB |

---

## 📁 Estructura de Directorios

```
sgsst-electron-app/
├── node_modules/          # Dependencias Node.js (npm install)
├── Portear/
│   ├── .venv/             # Entorno virtual Python
│   ├── src/               # Scripts Python
│   └── requirements.txt   # Dependencias Python
├── docs/                  # Documentación
├── modules/               # Módulos de la aplicación
├── assets/                # Recursos gráficos
├── main.js                # Proceso principal Electron
├── preload.js             # Bridge seguro
├── renderer.js            # Lógica de interfaz
└── package.json           # Dependencias Node.js
```

---

## 🚀 Instalación Completa (Nuevo Equipo)

### 1. Clonar el Repositorio
```bash
git clone https://github.com/Reivaj640/SG-SST-E.git
cd SG-SST-E/sgsst-electron-app
```

### 2. Instalar Node.js
```bash
# Descargar e instalar Node.js 20.x LTS desde:
# https://nodejs.org/

# Verificar instalación
node --version
npm --version
```

### 3. Instalar Dependencias Node.js
```bash
npm install
```

### 4. Instalar Python
```bash
# Descargar Python 3.11 desde:
# https://www.python.org/downloads/

# Verificar instalación
python --version
pip --version
```

### 5. Configurar Entorno Python
```bash
cd Portear

# Crear entorno virtual
python -m venv .venv

# Activar entorno virtual
.venv\Scripts\activate    # Windows
source .venv/bin/activate  # Linux/Mac

# Instalar dependencias
pip install -r requirements.txt
```

### 6. Descargar el Modelo LLM
```bash
# Colocar el modelo en la ruta configurada
# O actualizar la ruta en llm_server.py
```

### 7. Ejecutar la Aplicación
```bash
cd ..
npm start
```

---

## ⚠️ Problemas Comunes

### Error: Node modules no encontrados
```bash
npm install
```

### Error: Python no encontrado
Verificar que Python esté en el PATH del sistema.

### Error: CUDA no disponible
Instalar drivers NVIDIA y CUDA Toolkit 12.x.
El modelo puede funcionar en CPU pero será más lento.

### Error: Módulo 'torch' no encontrado
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
```

### Error: Faltan dependencias en requirements.txt
```bash
pip install -r requirements.txt --upgrade
```

---

## 📦 Construcción para Distribución

```bash
# Construir instalador Windows
npm run build:win

# Los archivos se generan en:
# dist/K+AIR Setup X.X.X.exe
```

---

## 🔄 Actualización de Dependencias

### Node.js
```bash
npm update
npm outdated  # Verificar actualizaciones disponibles
```

### Python
```bash
pip list --outdated
pip install --upgrade <paquete>
pip freeze > requirements.txt  # Actualizar lista
```

---

## 📝 Notas Importantes

1. **No incluir** `node_modules/` ni `Portear/.venv/` en el repositorio Git
2. **El modelo LLM** (~15GB) no está en el repositorio, debe descargarse aparte
3. **CUDA** es opcional pero altamente recomendado para el análisis de IA
4. **Python 3.14** tiene incompatibilidades con algunas librerías de ML

---

## 📞 Soporte

Si encuentras problemas con las dependencias:
1. Verificar versiones instaladas
2. Consultar este documento
3. Revisar logs de error en consola
4. Crear issue en el repositorio con detalles del error

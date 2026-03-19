# 🐍 Portear - Módulo Python para K+AIR

**Versión:** 1.0  
**Fecha:** 18 de marzo de 2026  
**Python:** 3.11.9 (embeddable)

---

## 📋 DESCRIPCIÓN

Portear contiene todos los scripts Python necesarios para las funcionalidades de K+AIR que requieren procesamiento avanzado de datos, documentos e IA.

**A partir de v0.1.80:** Python está **empaquetado** con el installer de K+AIR, eliminando la necesidad de instalación manual.

---

## 📁 ESTRUCTURA DE DIRECTORIOS

```
Portear/
├── python-embed/               # Python 3.11.9 empaquetado (v0.1.80+)
│   ├── python.exe              # Ejecutable de Python
│   ├── python311.dll
│   ├── python311._pth          # Configuración (¡import site descomentado!)
│   ├── get-pip.py
│   ├── Scripts/
│   │   ├── pip.exe
│   │   └── wheel.exe
│   └── Lib/
│       └── site-packages/      # 79+ paquetes instalados
│           ├── pandas/
│           ├── torch/
│           ├── python-docx/
│           ├── openpyxl/
│           ├── PyMuPDF/
│           ├── flask/
│           └── ...
├── src/                        # Scripts Python de K+AIR
│   ├── map_directory.py        # Mapeo de estructura de empresas
│   ├── dashboard_scanner.py    # Dashboard Scanner
│   ├── actualizar_ausentismo.py # Gestión de ausentismo
│   ├── convert_docx_to_pdf.py  # Conversión Word → PDF
│   ├── convert_xlsx_to_pdf.py  # Conversión Excel → PDF
│   ├── copasst_acta_generator.py # Actas COPASST
│   ├── comite_convivencia_acta_generator.py # Actas Convivencia
│   ├── accident_processor.py   # Procesamiento de accidentes
│   ├── accident_report_generator.py # Informes de accidentes
│   ├── llm_server.py           # Servidor LLM para IA
│   └── ...
├── requirements.txt            # Dependencias de Python (286+ paquetes)
└── README.md                   # Este archivo
```

---

## 🚀 INSTALACIÓN PARA DESARROLLADORES

### Opción A: Usar Python Empaquetado (Recomendado)

El installer ya incluye Python con 79+ paquetes. No necesitas instalar nada adicional.

**Para rebuild:**

```bash
# 1. Preparar Python empaquetado (solo primera vez)
scripts\prepare-python-embed.bat

# 2. Construir installer
npm run build:win
```

---

### Opción B: Python del Sistema (Desarrollo)

Si quieres desarrollar scripts Python localmente:

```bash
# 1. Crear entorno virtual
cd Portear
python -m venv .venv

# 2. Activar entorno (Windows)
.venv\Scripts\activate

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Ejecutar scripts para prueba
python src/map_directory.py "C:\ruta\empresa"
```

---

## 📦 PAQUETES INCLUIDOS (79+ paquetes)

### Procesamiento de Datos
- `pandas` (3.0.1) - Manipulación de datos tabulares
- `numpy` (2.4.3) - Cálculos numéricos
- `python-dateutil` - Manejo de fechas

### Documentos Word
- `python-docx` (1.2.0) - Lectura/escritura de .docx
- `docxtpl` (0.20.0) - Plantillas Word
- `lxml` - Parsing XML/HTML

### Excel
- `openpyxl` (3.1.5) - Lectura/escritura de .xlsx
- `et-xmlfile` - Parsing XML

### PDF
- `PyMuPDF` (1.27.2) - Lectura/manipulación de PDF
- `pdfplumber` (0.11.4) - Extracción de texto de PDF
- `reportlab` (4.4.10) - Generación de PDF
- `pillow` (12.1.1) - Procesamiento de imágenes

### IA/LLM
- `torch` (2.10.0) - Framework de Deep Learning (~114 MB)
- `transformers` (4.53.1) - Modelos de lenguaje
- `sympy` - Matemáticas simbólicas
- `networkx` - Grafos y redes

### Servidor y Automatización
- `flask` (3.1.3) - Servidor HTTP para LLM
- `pywin32` (311) - Automatización COM (Word/Excel en Windows)
- `jinja2` - Plantillas
- `werkzeug` - Utilidades web

### Utilidades
- `typing-extensions` - Extensiones de tipos
- `markupsafe` - Escape de HTML
- `click` - CLI
- `blinker` - Señales
- `charset-normalizer` - Detección de encoding
- `colorama` - Colores en terminal
- `pip`, `setuptools`, `wheel` - Gestión de paquetes

---

## 🔧 SCRIPTS PRINCIPALES

### map_directory.py
**Propósito:** Mapear estructura de directorios de una empresa

**Uso:**
```python
python src/map_directory.py "C:\ruta\empresa"
```

**Salida:** JSON con estructura de archivos y carpetas

---

### dashboard_scanner.py
**Propósito:** Generar dashboard de recursos de la empresa

**Uso:**
```python
python src/dashboard_scanner.py "C:\ruta\empresa"
```

**Salida:** JSON con estadísticas de recursos

---

### actualizar_ausentismo.py
**Propósito:** Gestionar ausentismo e incapacidades

**Funciones:**
- `registrar_incapacidad()` - Registrar nueva incapacidad
- `buscar_empleado()` - Buscar empleado por cédula
- `buscar_cie10()` - Buscar descripción CIE-10
- `guardar_seguimiento()` - Guardar seguimiento de caso
- `buscar_registros_por_cedula()` - Buscar registros por cédula
- `cargar_todos_registros_pri()` - Cargar todos los registros PRI
- `obtener_historial()` - Obtener historial de seguimientos
- `cargar_seguimientos()` - Cargar seguimientos desde archivo

**Uso:**
```python
python src/actualizar_ausentismo.py registrar_incapacidad "EMPRESA" "RUTA\archivo.xlsx" '{"datos": "json"}'
```

---

### convert_docx_to_pdf.py
**Propósito:** Convertir documentos Word a PDF usando COM

**Uso:**
```python
python src/convert_docx_to_pdf.py "documento.docx" "salida.pdf"
```

**Requisito:** Microsoft Word instalado (para automatización COM)

---

### convert_xlsx_to_pdf.py
**Propósito:** Convertir Excel a PDF

**Uso:**
```python
python src/convert_xlsx_to_pdf.py "archivo.xlsx" "salida.pdf"
```

---

### copasst_acta_generator.py
**Propósito:** Generar actas de COPASST

**Uso:**
```python
python src/copasst_acta_generator.py "datos.json" "salida.xlsx"
```

---

### comite_convivencia_acta_generator.py
**Propósito:** Generar actas de Comité de Convivencia

**Uso:**
```python
python src/comite_convivencia_acta_generator.py "datos.json" "salida.xlsx"
```

---

### llm_server.py
**Propósito:** Servidor Flask para análisis de accidentes con IA

**Puerto:** 5555

**Uso:**
```python
python src/llm_server.py
```

**Endpoints:**
- `POST /analyze` - Analizar accidente
- `GET /health` - Verificar estado del servidor

---

## ⚠️ CONFIGURACIÓN CRÍTICA

### python311._pth

**Archivo:** `Portear/python-embed/python311._pth`

**Contenido requerido:**
```
python311.zip
.

# Uncomment to run site.main() automatically
import site
```

**⚠️ CRÍTICO:** La línea `import site` DEBE estar descomentada. Si está comentada (`#import site`), Python NO encontrará los paquetes instalados.

**Síntoma de error:**
```
ModuleNotFoundError: No module named 'pip'
```

**Solución:**
```bash
echo python311.zip> python311._pth
echo .>> python311._pth
echo import site>> python311._pth
```

---

## 🔍 SOLUCIÓN DE PROBLEMAS

### Error: "ModuleNotFoundError: No module named 'pandas'"

**Causa:** Paquetes no instalados en python-embed

**Solución:**
```bash
cd Portear/python-embed
python.exe -m pip install pandas torch python-docx openpyxl PyMuPDF --target=Lib\site-packages
```

---

### Error: "No module named 'pip'"

**Causa:** `import site` comentado en python311._pth

**Solución:**
```bash
cd Portear/python-embed
# Editar python311._pth y descomentar 'import site'
python.exe get-pip.py
```

---

### Error: "Python no está instalado"

**Causa:** Python empaquetado no encontrado

**Solución:**
1. Verificar que `Portear/python-embed/python.exe` existe
2. Ejecutar `scripts/prepare-python-embed.bat`
3. Rebuild: `npm run build:win`

---

### Build falla con "Python not found"

**Causa:** `Portear/python-embed/` no existe

**Solución:**
```bash
scripts\prepare-python-embed.bat
```

---

## 📝 DESARROLLO DE NUEVOS SCRIPTS

### Estructura recomendada:

```python
# nuevo_script.py
import sys
import json
from pathlib import Path

def send_log(message):
    """Enviar log a stderr para que Electron lo capture"""
    print(f"[NUEVO_SCRIPT] {message}", file=sys.stderr)

def main(arg1, arg2):
    """Función principal del script"""
    send_log(f"Iniciando con arg1={arg1}, arg2={arg2}")
    
    # Tu lógica aquí
    result = {"success": True, "data": {}}
    
    send_log("Completado exitosamente")
    return result

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Argumentos insuficientes"}))
        sys.exit(1)
    
    try:
        result = main(sys.argv[1], sys.argv[2])
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
```

### Agregar a requirements.txt:

1. Agregar paquete a `requirements.txt`
2. Instalar: `pip install -r requirements.txt --target=Lib\site-packages`
3. Verificar: `python.exe -m pip list`
4. Rebuild: `npm run build:win`

---

## 🔄 ACTUALIZACIÓN DE DEPENDENCIAS

### Actualizar paquetes existentes:

```bash
cd Portear/python-embed
python.exe -m pip install --upgrade pandas torch python-docx --target=Lib\site-packages
```

### Agregar nuevo paquete:

```bash
cd Portear/python-embed
python.exe -m pip install nuevo_paquete --target=Lib\site-packages
```

### Verificar paquetes instalados:

```bash
cd Portear/python-embed
python.exe -m pip list
```

---

## 📊 ESTADÍSTICAS

| Métrica | Valor |
|---------|-------|
| **Python versión** | 3.11.9 |
| **Paquetes instalados** | 79+ |
| **Tamaño python-embed/** | ~500 MB |
| **Scripts en src/** | 15+ |
| **Tamaño installer** | ~300 MB |

---

## 📞 REFERENCIAS

### Documentación Relacionada
- `docs/IMPLEMENTACION_PYTHON_EMPAQUETADO_v0.1.80.md` - Guía de implementación
- `docs/REQUISITOS.md` - Requisitos del sistema
- `README.md` - Documentación principal de K+AIR

### Scripts de Build
- `scripts/prepare-python-embed.bat` - Preparar Python
- `scripts/build-with-python-embed.bat` - Construir installer

### Releases
- **v0.1.80:** Primera versión con Python empaquetado
- **GitHub:** https://github.com/Reivaj640/SG-SST-E/releases/tag/v0.1.80

---

**Documento elaborado por:** Equipo de Desarrollo K+AIR  
**Fecha:** 18 de marzo de 2026  
**Versión:** 1.0  
**Estado:** ✅ En Producción (v0.1.80)

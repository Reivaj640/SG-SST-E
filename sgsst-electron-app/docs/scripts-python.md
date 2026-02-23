# Scripts Python - Portear/src

## Descripción General

El directorio `Portear/src/` contiene todos los scripts Python utilizados por la aplicación K+AIR para procesamiento de documentos, generación de informes, y el servidor de inteligencia artificial.

## 📁 Estructura de Directorios

```
Portear/src/
├── llm_server.py                      # Servidor Flask para modelo LLM
├── accident_processor.py              # Extracción de datos desde PDFs
├── accident_report_generator.py       # Generación de informes DOCX
├── copasst_acta_generator.py          # Generador de actas COPASST
├── comite_convivencia_acta_generator.py # Generador de actas de convivencia
├── convert_docx_to_pdf.py             # Conversión DOCX → PDF
├── convert_xlsx_to_pdf.py             # Conversión XLSX → PDF
├── actualizar_ausentismo.py           # Actualización de datos de ausentismo
├── map_directory.py                   # Mapeo de directorios
├── Invest_APP_V_3.py                  # Aplicación standalone de investigación
├── remision_utils.py                  # Utilidades para remisiones
├── remisiones_v1.0.py                 # Sistema de remisiones v1.0
├── process_pdf_cli.py                 # CLI para procesamiento de PDF
└── test_docx2pdf.py                   # Tests de conversión DOCX
```

---

## 🔬 Scripts de Inteligencia Artificial

### `llm_server.py` - Servidor de Inferencia LLM

**Propósito:** Mantiene el modelo Mistral 3 3B Reasoning en memoria para análisis rápido de accidentes laborales.

**Características:**
- Servidor Flask en puerto 5555
- Modelo: Mistral3ForConditionalGeneration
- Prompt template para análisis 5 Porqués con categorías 5M
- Logging a archivo y consola

**Endpoints:**
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/health` | GET | Verifica estado del servidor |
| `/load` | POST | Carga el modelo en memoria |
| `/analyze` | POST | Analiza accidente con 5 Porqués |
| `/status` | GET | Estado detallado del modelo |

**Configuración:**
```python
MODEL_PATH = r"D:\1. Estudio\1.1 IA\1.1.2. LLM's\Inv. AT\mistral-3-3B-Reasonig-2512"
SERVER_PORT = 5555
SERVER_HOST = "127.0.0.1"
```

**Dependencias:**
- flask
- torch
- transformers
- safetensors
- accelerate

**Ejemplo de uso:**
```bash
python llm_server.py
# POST http://127.0.0.1:5555/analyze
# Body: {"descripcion": "...", "contexto": "..."}
```

---

### `accident_processor.py` - Procesador de Accidentes

**Propósito:** Extrae datos desde PDFs de reportes de accidentes y analiza causas con IA.

**Funciones Principales:**

#### `extract_data_from_pdf(pdf_path)`
Extrae datos estructurados desde un PDF de accidente.

**Retorna:**
```json
{
  "success": true,
  "data": {
    "No. Identificación": "...",
    "Nombre Completo": "...",
    "Fecha del Accidente": "...",
    "Descripcion del Accidente": "...",
    ...
  }
}
```

#### `analyze_accident(extracted_data, contexto_adicional)`
Analiza las causas del accidente usando el servidor LLM.

**Retorna:**
```json
{
  "success": true,
  "analysis": {
    "PorQue1": { "Mano de Obra": "...", "Método": "...", ... },
    "PorQue2": { ... },
    ...
  }
}
```

**Dependencias:**
- Invest_APP_V_3 (PdfProcessor, AccidentAnalyzer)

---

### `accident_report_generator.py` - Generador de Informes

**Propósito:** Genera informes DOCX de investigación de accidentes usando plantillas personalizadas por empresa.

**Configuración de Rutas:**
```python
RUTAS = {
    "TEMPOACTIVA": {
        "investigaciones": "G:/.../Investigaciones/",
        "plantilla": "G:/.../GI-FO-020 INVESTIGACION.docx"
    },
    "TEMPOSUM": { ... },
    "ASEPLUS": { ... },
    "ASEL": { ... }
}
```

**Funciones:**

#### `preparar_datos_para_plantilla(combined_data)`
Normaliza y prepara datos para la plantilla DOCX, manejando múltiples variantes de claves.

#### `get_normalized_value(data_dict, possible_keys, default)`
Busca valores en diccionarios con múltiples posibles nombres de clave.

**Campos del Informe:**
- Datos del trabajador (identificación, nombre, cargo, etc.)
- Datos del accidente (fecha, hora, lugar, descripción)
- Análisis 5 Porqués (5 niveles × 5 categorías 5M)
- Recomendaciones
- Involucrados

**Dependencias:**
- docxtpl
- python-docx
- re

---

## 📝 Scripts de Generación de Documentos

### `copasst_acta_generator.py` - Generador de Actas COPASST

**Propósito:** Genera actas de reunión COPASST en formato Excel.

**Características:**
- Usa plantilla Excel: `ACT-FO-029 Acta de Reunión Copasst.xlsx`
- Preserva estilos y celdas combinadas
- Modo depuración con `--debug`

**Funciones:**

#### `debug_cell_coordinates(ws)`
Imprime coordenadas de celdas para mapeo de datos (modo depuración).

#### `main(temp_data_path, output_path)`
Carga plantilla, aplica cambios desde JSON y guarda resultado.

**Entrada JSON:**
```json
{
  "changes": [
    {"field": "fecha", "value": "2026-02-23"},
    {"field": "asistentes", "value": "..."}
  ]
}
```

**Dependencias:**
- openpyxl

---

### `comite_convivencia_acta_generator.py` - Generador de Actas de Convivencia

**Propósito:** Genera actas de reunión del Comité de Convivencia en formato Excel.

**Características:**
- Usa plantilla: `GI-FO-029 ACTA DE REUNION CONVIVENCIA.xlsx`
- Similar estructura a copasst_acta_generator.py
- Modo depuración con `--debug`

**Dependencias:**
- openpyxl

---

### `convert_docx_to_pdf.py` - Conversor DOCX a PDF

**Propósito:** Convierte documentos Word (DOC/DOCX) a PDF.

**Características:**
- Para `.docx`: Usa librería `docx2pdf` (conversión rápida)
- Para `.doc`: Usa automatización COM con MS Word
- Genera archivo temporal si no se especifica ruta de salida

**Uso:**
```bash
python convert_docx_to_pdf.py documento.docx [salida.pdf]
```

**Retorna:**
```json
{"success": true, "pdf_path": "/ruta/al/archivo.pdf"}
```

**Dependencias:**
- docx2pdf
- pywin32 (solo Windows, para archivos .doc)

---

### `convert_xlsx_to_pdf.py` - Conversor XLSX a PDF

**Propósito:** Convierte archivos Excel (XLS/XLSX) a PDF.

**Métodos de Conversión:**

1. **LibreOffice (preferido):**
   ```bash
   libreoffice --headless --convert-to pdf archivo.xlsx
   ```

2. **Python (fallback):**
   - openpyxl para leer Excel
   - reportlab para generar PDF

**Uso:**
```bash
python convert_xlsx_to_pdf.py reporte.xlsx [salida.pdf]
```

**Dependencias:**
- openpyxl
- reportlab (método alternativo)
- LibreOffice (instalado en sistema, preferido)

---

## 📊 Scripts de Gestión de Datos

### `actualizar_ausentismo.py` - Actualizador de Ausentismo

**Propósito:** Actualiza el archivo de control de ausentismo SIN usar fórmulas de Excel.

**Características:**
- Mantiene formato visual original
- Genera copia `*_actualizado.xlsx`
- Busca empleados por cédula en bases de datos configuradas

**Bases de Datos Configuradas:**
```python
BASES_DATOS = {
    "TEMPOACTIVA": "G:/.../Base de Datos Personal Temporales.xlsx",
    "TEMPOSUM": "G:/.../Base de Datos Personal Temporales.xlsx",
    "ASEPLUS": "G:/.../Base de Datos Personal Temporales.xlsx",
    "ASEL": "G:/.../Formato - Base de datos personal ASEL.xlsx"
}
```

**Funciones:**

#### `buscar_empleado_por_cedula(cedula, empresa)`
Busca un empleado por cédula en la base de datos de la empresa.

**Retorna:**
```json
{
  "success": true,
  "data": {
    "nombre": "...",
    "cargo": "...",
    ...
  }
}
```

**Dependencias:**
- pandas
- openpyxl

---

### `map_directory.py` - Mapeador de Directorios

**Propósito:** Escanea y mapea la estructura de un directorio, devolviendo JSON.

**Características:**
- Recursivo
- Incluye fechas de creación/modificación
- Manejo de errores por archivo
- Normalización Unicode para nombres
- Conteo total de archivos y carpetas

**Estructura de Salida:**
```json
{
  "root": "/ruta/base",
  "scan_date": "2026-02-23",
  "total_files": 150,
  "total_folders": 25,
  "errors": [],
  "structure": {
    "name": "Directorio",
    "path": "/ruta/completa",
    "created": 1234567890,
    "modified": 1234567890,
    "files": [...],
    "subdirectories": {...},
    "file_count": 50,
    "dir_count": 10
  }
}
```

**Funciones:**

#### `_clean_string_for_json(s)`
Limpia cadenas para asegurar compatibilidad con JSON (normalización Unicode).

#### `_map_directory_recursive(directory_path)`
Función recursiva que mapea un directorio y sus subdirectorios.

**Uso en Electron:**
```javascript
const result = await window.electronAPI.mapDirectory(rutaDirectorio);
```

**Dependencias:**
- pathlib
- unicodedata
- hashlib (para checksums)

---

## 🔧 Scripts de Utilidad

### `Invest_APP_V_3.py` - Aplicación Standalone de Investigación

**Propósito:** Aplicación completa de investigación de accidentes (interfaz gráfica).

**Características:**
- Interfaz con CustomTkinter
- Procesamiento de PDFs integrado
- Análisis 5 Porqués con IA
- Generación de informes

**Clases Principales:**

#### `PdfProcessor`
Procesa PDFs de reportes de accidentes.

**Métodos:**
- `extract_pdf_data(pdf_path)`: Extrae datos estructurados

#### `AccidentAnalyzer`
Analiza causas de accidentes con LLM.

**Métodos:**
- `analyze_5whys(descripcion, contexto)`: Genera análisis 5 Porqués

**Dependencias:**
- customtkinter
- tkinter
- PyPDF2 / pdfplumber
- requests (para comunicación con LLM)

---

### `remision_utils.py` - Utilidades para Remisiones

**Propósito:** Funciones utilitarias para generación y envío de remisiones.

**Funciones Principales:**
- Extracción de datos desde PDFs de remisión
- Validación de datos
- Formateo de información

**Dependencias:**
- pdfplumber
- re

---

### `remisiones_v1.0.py` - Sistema de Remisiones v1.0

**Propósito:** Sistema completo para generación de documentos de remisión.

**Características:**
- Generación de documentos DOCX
- Envío por email
- Envío por WhatsApp

**Dependencias:**
- python-docx
- docxtpl

---

### `process_pdf_cli.py` - CLI de Procesamiento de PDF

**Propósito:** Interfaz de línea de comandos para procesamiento de PDFs.

**Uso:**
```bash
python process_pdf_cli.py extract archivo.pdf
python process_pdf_cli.py analyze --pdf archivo.pdf --contexto "..."
```

**Dependencias:**
- argparse
- pdfplumber

---

### `test_docx2pdf.py` - Tests de Conversión DOCX

**Propósito:** Script de prueba para conversión DOCX → PDF.

**Uso:**
```bash
python test_docx2pdf.py documento.docx
```

**Dependencias:**
- docx2pdf

---

## 📦 Dependencias Completas

### Requeridas (Core)
```
flask>=3.0.0
torch>=2.0.0
transformers>=4.50.0
docxtpl>=0.20.0
openpyxl>=3.1.0
pandas>=2.0.0
pdfplumber>=0.11.0
PyPDF2>=3.0.0
PyMuPDF>=1.24.0
python-docx>=1.1.0
reportlab>=4.0.0
requests>=2.31.0
```

### Opcionales (Mejoran funcionalidad)
```
docx2pdf>=0.1.8  # Conversión DOCX → PDF
pywin32>=306     # Automatización COM (Windows)
customtkinter>=5.2.0  # Interfaces gráficas
gradio>=4.0.0    # Interfaces web para ML
```

### Sistema (No Python)
- **LibreOffice**: Conversión XLSX → PDF (recomendado)
- **Microsoft Word**: Conversión DOC → PDF (requerido para .doc)
- **CUDA Toolkit 12.x**: Aceleración GPU para LLM (opcional)

---

## 🔐 Consideraciones de Seguridad

1. **Rutas Hardcodeadas:** Las rutas en `accident_report_generator.py` y `actualizar_ausentismo.py` contienen rutas absolutas a recursos compartidos. Verificar permisos de acceso.

2. **Logging:** Los scripts generan logs que pueden contener información sensible. Revisar políticas de retención.

3. **Ejecución de Scripts:** Los scripts se ejecutan en el contexto del usuario. Validar siempre las rutas de entrada/salida.

---

## 🧪 Pruebas

### Probar Servidor LLM
```bash
cd Portear/src
python llm_server.py
# En otra terminal:
curl http://127.0.0.1:5555/health
```

### Probar Extracción de PDF
```bash
python accident_processor.py extract --pdf_path "ruta/al/reporte.pdf"
```

### Probar Mapeo de Directorio
```bash
python map_directory.py "C:/Directorio/a/mapear"
```

---

## 📝 Notas de Desarrollo

1. **Encoding:** Todos los scripts usan UTF-8 para evitar problemas con caracteres especiales en español.

2. **Logging:** Se recomienda usar logging en lugar de print para producción.

3. **Errores:** Los scripts devuelven JSON con `{"success": bool, ...}` para facilitar integración con Electron.

4. **Rutas:** Usar siempre `pathlib.Path` para compatibilidad multiplataforma.

5. **Entorno Virtual:** Todos los scripts deben ejecutarse dentro del entorno virtual `Portear/.venv/`.

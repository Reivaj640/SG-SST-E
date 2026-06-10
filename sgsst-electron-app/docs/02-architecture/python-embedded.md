# 🐍 Python Empaquetado - K+AIR

**Versión:** 1.0
**Actualizado:** 9 de junio de 2026
**Desde versión:** v0.1.80

---

## 📋 Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Estructura de python-embed/](#2-estructura-de-python-embed)
3. [Scripts Disponibles](#3-scripts-disponibles)
4. [Comunicación con Main Process](#4-comunicación-con-main-process)
5. [Desarrollo Local](#5-desarrollo-local)
6. [Build y Distribución](#6-build-y-distribución)

---

## 1. Visión General

Desde la versión v0.1.80, K+AIR incluye **Python 3.11.9 empaquetado** dentro del installer de Electron. Esto elimina la necesidad de instalar Python por separado en la máquina del cliente final.

**Características clave:**
- Python 3.11.9 Windows embeddable package
- 79+ paquetes pre-instalados en `Lib/site-packages/`
- Scripts propios en `python-scripts/`
- Sin instalación manual requerida para el usuario final
- Comunicación vía `child_process.spawn()` desde Main Process

---

## 2. Estructura de python-embed/

```
python-embed/
├── python.exe                  # Python 3.11.9 embeddable
├── python311.dll               # Runtime DLL
├── python311.zip               # Stdlib comprimida
├── python-scripts/             # Scripts propios de K+AIR
│   ├── map_directory.py        # Mapeo de directorios empresa
│   ├── accident_processor.py   # Procesamiento accidentalidad
│   ├── accident_report_generator.py  # Generación reportes AT
│   ├── actualizar_ausentismo.py      # Actualización ausentismo
│   ├── copasst_acta_generator.py     # Generación actas COPASST
│   ├── comite_convivencia_acta_generator.py  # Actas Comité Convivencia
│   ├── convert_docx_to_pdf.py  # Conversión DOCX → PDF
│   ├── convert_xlsx_to_pdf.py  # Conversión XLSX → PDF
│   ├── dashboard_scanner.py    # Escaneo para dashboard
│   ├── Invest_APP_V_3.py       # Investigación accidentes
│   ├── llm_server.py           # Servidor LLM local
│   ├── process_pdf_cli.py      # Procesamiento PDF CLI
│   ├── read_sve_psicosocial.py # Lectura SVE psicosocial
│   ├── remisiones_v1.0.py      # Generación remisiones
│   ├── remision_utils.py       # Utilidades remisiones
│   ├── remision_utils_append.py # Append remisiones
│   └── test_docx2pdf.py        # Test conversión DOCX
├── Lib/
│   └── site-packages/          # Paquetes instalados
│       ├── openpyxl/           # Lectura/escritura Excel
│       ├── PyMuPDF (fitz)/     # Manipulación PDF
│       ├── pyyaml/             # Parser YAML
│       ├── pywin32 (win32com)/ # COM automation (Word, Excel)
│       ├── filelock/           # File locking
│       └── ... (79+ paquetes)
├── Scripts/                    # Scripts de paquetes
│   ├── pdf2txt.py
│   └── dumppdf.py
└── _pth                        # Path configuration
```

---

## 3. Scripts Disponibles

### Scripts de Mapeo y Dashboard

| Script | Propósito | Invocado desde |
|--------|-----------|---------------|
| `map_directory.py` | Mapea estructura de directorios de la empresa | `map-directory` IPC handler |
| `dashboard_scanner.py` | Escanea archivos para datos del dashboard | `dashboard-scan` IPC handler |

### Scripts de Generación de Documentos

| Script | Propósito | Invocado desde |
|--------|-----------|---------------|
| `copasst_acta_generator.py` | Genera actas de COPASST con autofill | `copasst-generate-acta` IPC handler |
| `comite_convivencia_acta_generator.py` | Genera actas de Comité de Convivencia | `comite-convivencia-generate-acta` IPC handler |
| `accident_report_generator.py` | Genera reportes de accidentes de trabajo | `accident-report` IPC handler |
| `remisiones_v1.0.py` | Genera remisiones médicas | `generate-remision` IPC handler |

### Scripts de Procesamiento

| Script | Propósito | Invocado desde |
|--------|-----------|---------------|
| `accident_processor.py` | Procesa datos de accidentalidad | `process-accident` IPC handler |
| `actualizar_ausentismo.py` | Actualiza datos de ausentismo | `update-ausentismo` IPC handler |
| `Invest_APP_V_3.py` | Investiga accidentes de trabajo | `investigate-accident` IPC handler |
| `read_sve_psicosocial.py` | Lee datos SVE psicosocial | `read-sve` IPC handler |

### Scripts de Conversión

| Script | Propósito | Invocado desde |
|--------|-----------|---------------|
| `convert_docx_to_pdf.py` | Convierte DOCX a PDF vía COM | `convert-docx-pdf` IPC handler |
| `convert_xlsx_to_pdf.py` | Convierte XLSX a PDF | `convert-xlsx-pdf` IPC handler |
| `process_pdf_cli.py` | Procesa PDF desde CLI | `process-pdf` IPC handler |

### Otros Scripts

| Script | Propósito | Invocado desde |
|--------|-----------|---------------|
| `llm_server.py` | Servidor LLM local para IA | `llm-query` IPC handler |
| `remision_utils.py` | Utilidades comunes de remisiones | Importado por remisiones_v1.0 |
| `remision_utils_append.py` | Append de datos a remisiones | Importado por remisiones_v1.0 |
| `test_docx2pdf.py` | Test de conversión DOCX→PDF | Manual / testing |

---

## 4. Comunicación con Main Process

La comunicación entre Electron (Main Process) y Python se realiza mediante `child_process.spawn()`:

```javascript
// En main.js
const { spawn } = require('child_process');
const pythonPath = path.join(__dirname, 'python-embed', 'python.exe');
const scriptPath = path.join(__dirname, 'python-embed', 'python-scripts', 'map_directory.py');

const process = spawn(pythonPath, [scriptPath, '--company', companyDir, '--output', 'json']);
process.stdout.on('data', (data) => {
  const result = JSON.parse(data.toString());
  event.reply('map-directory-response', { success: true, data: result });
});
process.stderr.on('data', (data) => {
  console.error(`Python error: ${data}`);
});
```

**Formato de respuesta estándar:**
```json
{
  "success": true,
  "data": { ... }
}
```

```json
{
  "success": false,
  "error": "Descripción del error"
}
```

---

## 5. Desarrollo Local

Para desarrollo local sin el Python empaquetado:

1. **Instalar Python 3.11.9** desde [python.org](https://www.python.org/downloads/)
2. **Instalar dependencias:**
   ```bash
   pip install openpyxl PyMuPDF pyyaml pywin32 filelock
   ```
3. **Configurar path en desarrollo:**
   - En `main.js`, el código detecta si `python-embed/python.exe` existe
   - Si no existe, usa `python` del PATH del sistema
   - Esto permite desarrollo sin el bundle completo

---

## 6. Build y Distribución

### Exclusiones de Build (v0.1.83+)

Para optimizar tamaño, se excluyen del build:
- `torch/` (reduce ~44% tamaño)
- `pip/` (no necesario en producción)
- `setuptools/` (no necesario en producción)

### Tamaños

| Componente | Tamaño Aprox. |
|-----------|--------------|
| python-embed/ completo | ~300 MB |
| Sin torch (v0.1.83+) | ~170 MB |
| Scripts python-scripts/ | ~500 KB |

### Verificación Post-Build

Después de un build, verificar:
1. `python-embed/python.exe` existe y ejecuta
2. `python-scripts/map_directory.py` funciona
3. Paquetes críticos disponibles: `openpyxl`, `fitz`, `yaml`, `win32com`

---

## 🔗 Enlaces Relacionados

- **[ipc-contratos.md](ipc-contratos.md)** - Contratos IPC para comunicación Python
- **[arquitectura-general.md](arquitectura-general.md)** - Arquitectura general del sistema
- **[../03-guias/scripts-python.md](../03-guias/scripts-python.md)** - Guía detallada de scripts Python
- **[../05-updates/IMPLEMENTACION_PYTHON_EMPAQUETADO_v0.1.80.md](../05-updates/IMPLEMENTACION_PYTHON_EMPAQUETADO_v0.1.80.md)** - Documentación v0.1.80

---

**Mantenido por:** Product Architect & Full-Stack Team
**Última actualización:** 9 de junio de 2026
**Versión:** 1.0 (v0.1.99)

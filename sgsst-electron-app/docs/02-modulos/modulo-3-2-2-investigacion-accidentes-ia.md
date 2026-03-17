# 🤖 Módulo 3.2.2: Investigación de Accidentes con IA

**Versión:** 2.0  
**Actualizado:** 17 de marzo de 2026  
**Estado:** ✅ Actualizado v0.1.75  
**Crítico:** 🔴 SI - Módulo con IA integrada

---

## 📋 Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Flujo de Trabajo Completo](#3-flujo-de-trabajo-completo)
4. [Tecnología e Integraciones](#4-tecnología-e-integraciones)
5. [Contratos IPC Relacionados](#5-contratos-ipc-relacionados)
6. [Estructura de Datos](#6-estructura-de-datos)
7. [Metodología 5 Porqués](#7-metodología-5-porqués)
8. [Categorías 5M](#8-categorías-5m)
9. [Ejemplos de Uso](#9-ejemplos-de-uso)

---

## 1. Visión General

### 1.1 Propósito del Módulo

El módulo de **Investigación de Accidentes** utiliza Inteligencia Artificial (LLM) para analizar accidentes de trabajo, identificar causas raíz mediante la metodología de los **5 Porqués**, y generar informes automáticos en formato DOCX.

### 1.2 Características Principales

| Característica | Descripción | Estado |
|----------------|-------------|--------|
| **Procesamiento de PDF** | Extracción automática de datos de PDFs de accidentes | ✅ |
| **Análisis con LLM** | Mistral 3 3B Reasoning (multimodal) | ✅ |
| **Metodología 5 Porqués** | Identificación de causas raíz estructurada | ✅ |
| **Categorías 5M** | Clasificación por Mano de obra, Máquina, Material, Método, Medio | ✅ |
| **Generación de Informes** | DOCX automático con formato profesional | ✅ |
| **Soporte Multimodal** | Análisis de texto e imágenes (opcional) | ✅ |

### 1.3 Archivos del Módulo

```
modules/gestion-salud/investigacion-accidentes/
├── index.js
├── investigacion-accidentes-logic.js    # Lógica frontend
├── investigacion-accidentes-main.js     # Punto de entrada
├── investigacion-home.js                # Portal de bienvenida
├── investigacion-home.html              # HTML del portal
├── investigacion_handlers.js            # Handlers IPC especializados
├── investigaciones-viewer.js            # Viewer de resultados
├── investigacion-accidentes-view.css    # Estilos modernizados
└── investigacion-accidentes-view.html   # Vista de resultados
```

### 1.4 Archivos Python (Portear/)

```
Portear/src/
├── llm_server.py                        # Servidor Flask (puerto 5555)
├── accident_processor.py                # Procesamiento de PDFs
├── accident_report_generator.py         # Generación de informes DOCX
├── requirements.txt                     # Dependencias Python
└── models/                              # Modelos de IA (opcional local)
```

---

## 2. Arquitectura del Sistema

### 2.1 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│  USUARIO                                                        │
│  - Sube PDF de accidente                                        │
│  - Revisa análisis de IA                                        │
│  - Descarga informe DOCX                                        │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Electron Renderer)                                   │
│  - investigacion-accidentes-logic.js                            │
│  - Interfaz de subida de archivos                               │
│  - Visualización de resultados                                  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  PRELOAD (ipcRenderer)                                          │
│  - selectAccidentPdf()                                          │
│  - processAccidentPdf()                                         │
│  - analyzeAccident()                                            │
│  - generateAccidentReport()                                     │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  MAIN PROCESS (Electron)                                        │
│  - investigacion_handlers.js                                    │
│  - Coordinación de procesos                                     │
└─────────────────────────────────────────────────────────────────┘
                    │                   │
          ┌─────────┘                   └─────────┐
          ▼                                       ▼
┌─────────────────────────┐          ┌─────────────────────────┐
│  PYTHON (accident_      │          │  PYTHON (llm_server.py) │
│  processor.py)          │          │  - Flask puerto 5555    │
│  - Extracción de datos  │          │  - Mistral 3 3B         │
│  - PDF → JSON           │          │  - Análisis 5 Porqués   │
└─────────────────────────┘          │  - Categorías 5M        │
                                     └─────────────────────────┘
                                                      │
                                                      ▼
                                     ┌─────────────────────────┐
                                     │  PYTHON (accident_      │
                                     │  report_generator.py)   │
                                     │  - Generación DOCX      │
                                     │  - Formato profesional  │
                                     └─────────────────────────┘
```

### 2.2 Componentes del Sistema

| Componente | Tecnología | Función |
|------------|------------|---------|
| **Frontend UI** | JavaScript + HTML | Interfaz de usuario, visualización |
| **IPC Handlers** | JavaScript (main.js) | Coordinación de procesos |
| **PDF Processor** | Python + pdf-parse | Extracción de datos de PDF |
| **LLM Server** | Python + Flask + Mistral | Análisis de causas raíz |
| **Report Generator** | Python + python-docx | Generación de informes DOCX |

---

## 3. Flujo de Trabajo Completo

### 3.1 Paso a Paso

```
┌─────────────────────────────────────────────────────────────────┐
│ PASO 1: Usuario sube PDF de accidente                           │
│ - Click en "Seleccionar PDF"                                    │
│ - Diálogo de archivos                                           │
│ - Validación de formato                                         │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ PASO 2: Extracción de datos con Python                          │
│ - accident_processor.py lee el PDF                              │
│ - Extrae: descripción, trabajador, fecha, cargo, empresa        │
│ - Retorna JSON con datos estructuradas                          │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ PASO 3: Usuario revisa datos extraídas                          │
│ - Muestra datos en formulario                                   │
│ - Usuario puede corregir/validar                                │
│ - Opcional: Agregar contexto adicional                          │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ PASO 4: Análisis con LLM (IA)                                   │
│ - startModelLoading() inicia carga del modelo                   │
│ - analyzeAccident() envía datos a llm_server.py                 │
│ - Mistral 3 3B analiza con metodología 5 Porqués                │
│ - Clasifica por categorías 5M                                   │
│ - Retorna análisis estructurado                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ PASO 5: Usuario revisa análisis de IA                           │
│ - Muestra causas básicas, inmediatas, causa raíz                │
│ - Muestra recomendaciones                                       │
│ - Usuario puede editar si es necesario                          │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ PASO 6: Generación de informe DOCX                              │
│ - generateAccidentReport() combina datos + análisis             │
│ - accident_report_generator.py crea DOCX                        │
│ - Formato profesional con logo de empresa                       │
│ - Guarda en carpeta de Informes                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ PASO 7: Usuario descarga/abre informe                           │
│ - openPath() abre documento automáticamente                     │
│ - Opcional: Enviar por email/WhatsApp                           │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Tiempos Estimados

| Paso | Tiempo Promedio |
|------|-----------------|
| Subida de PDF | 1-2 segundos |
| Extracción de datos | 2-5 segundos |
| Carga del modelo LLM | 5-10 segundos |
| Análisis con IA | 10-30 segundos |
| Generación de DOCX | 2-5 segundos |
| **Total** | **20-50 segundos** |

---

## 4. Tecnología e Integraciones

### 4.1 Modelo de IA

| Característica | Valor |
|----------------|-------|
| **Modelo** | Mistral 3 3B Reasoning |
| **Tipo** | Multimodal (texto + imágenes) |
| **Proveedor** | Mistral AI |
| **Endpoint** | API REST (puerto 5555) |
| **Contexto** | 8K tokens |
| **Idioma** | Español (principalmente) |

### 4.2 Servidor Flask

```python
# llm_server.py - Estructura básica

from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

MISTRAL_API_KEY = "tu-api-key"
MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions"

@app.route('/analyze', methods=['POST'])
def analyze_accident():
    data = request.json
    
    # Construir prompt para 5 Porqués
    prompt = construir_prompt_5_porques(data)
    
    # Llamar a Mistral API
    response = requests.post(
        MISTRAL_ENDPOINT,
        headers={
            'Authorization': f'Bearer {MISTRAL_API_KEY}',
            'Content-Type': 'application/json'
        },
        json={
            'model': 'mistral-medium',
            'messages': [{'role': 'user', 'content': prompt}]
        }
    )
    
    # Parsear respuesta
    analisis = parsear_respuesta(response.json())
    
    return jsonify({
        'success': True,
        'analysis': analisis
    })

def construir_prompt_5_porques(data):
    return f"""
    Analiza el siguiente accidente de trabajo usando la metodología de los 5 Porqués:
    
    Descripción: {data['texto_accidente']}
    Trabajador: {data['trabajador']}
    Cargo: {data['cargo']}
    Fecha: {data['fecha']}
    Empresa: {data['empresa']}
    
    Identifica:
    1. Causas básicas (factores personales y del trabajo)
    2. Causas inmediatas (actos inseguros y condiciones inseguras)
    3. Causa raíz
    4. Recomendaciones preventivas
    
    Clasifica por categorías 5M:
    - Mano de obra
    - Máquina
    - Material
    - Método
    - Medio
    """
```

### 4.3 Dependencias Python

```txt
# Portear/src/requirements.txt

flask==3.0.0
requests==2.31.0
pdf-parse==2.4.5
python-docx==1.1.0
mistralai==0.1.8
Pillow==10.1.0
```

---

## 5. Contratos IPC Relacionados

### 5.1 Handlers Críticos 🔴

| Método Frontend | Handler Backend | Parámetros | Retorno | Descripción |
|-----------------|-----------------|------------|---------|-------------|
| `selectAccidentPdf()` | `investigacion-accidentes-select-accident-pdf` | - | `{ success, filePath? }` | Seleccionar PDF de accidente |
| `processAccidentPdf(path)` | `investigacion-accidentes-process-accident-pdf` | `path: string` | `{ success, data }` | Extraer datos del PDF |
| `analyzeAccident(data)` | `investigacion-accidentes-analyze-accident` | `data: object` | `{ success, analysis }` | Analizar con LLM |
| `generateAccidentReport(data)` | `investigacion-accidentes-generate-accident-report` | `data: object` | `{ success, reportPath }` | Generar informe DOCX |
| `startModelLoading()` | `investigacion-accidentes-start-model-loading` | - | `{ success }` | Iniciar carga del modelo |
| `saveTempPdfFile(filename, data)` | `investigacion-accidentes-save-temp-pdf-file` | `filename, data` | `{ success, path }` | Guardar PDF temporal |

### 5.2 Ejemplo de Uso Completo

```javascript
// Frontend - investigacion-accidentes-logic.js

async function investigarAccidenteCompleto() {
  try {
    // PASO 1: Seleccionar PDF
    const pdfSelect = await window.electronAPI.selectAccidentPdf();
    if (!pdfSelect.success) {
      throw new Error('Usuario canceló la selección');
    }
    
    mostrarEstado('Procesando PDF...');
    
    // PASO 2: Extraer datos del PDF
    const extracted = await window.electronAPI.processAccidentPdf(
      pdfSelect.filePath
    );
    
    if (!extracted.success) {
      throw new Error('Error extrayendo datos del PDF');
    }
    
    // PASO 3: Mostrar datos para validación
    mostrarDatosExtraidas(extracted.data);
    
    // Esperar validación del usuario
    const datosValidados = await esperarValidacion();
    
    // PASO 4: Iniciar carga del modelo
    mostrarEstado('Cargando modelo de IA...');
    await window.electronAPI.startModelLoading();
    
    // PASO 5: Analizar con LLM
    mostrarEstado('Analizando con IA (esto puede tomar 30-60 segundos)...');
    const analysis = await window.electronAPI.analyzeAccident({
      texto_accidente: datosValidados.descripcion,
      imagenes: datosValidados.imagenes || [],
      empresa: datosValidados.empresa,
      trabajador: datosValidados.trabajador,
      fecha: datosValidados.fecha,
      cargo: datosValidados.cargo
    });
    
    if (!analysis.success) {
      throw new Error('Error en análisis de IA');
    }
    
    // PASO 6: Mostrar análisis
    mostrarAnalisis(analysis.analysis);
    
    // PASO 7: Generar informe cuando usuario confirme
    mostrarEstado('Generando informe...');
    const reportPath = await window.electronAPI.generateAccidentReport({
      ...datosValidados,
      analysis: analysis.analysis
    });
    
    // PASO 8: Abrir informe
    await window.electronAPI.openPath(reportPath);
    
    mostrarEstado('¡Investigación completada exitosamente!');
    
  } catch (error) {
    console.error('Error en investigación:', error);
    alert('Error investigando accidente: ' + error.message);
  }
}
```

---

## 6. Estructura de Datos

### 6.1 Datos de Entrada para Análisis

```javascript
{
  texto_accidente: string,      // Descripción completa del accidente
  imagenes?: string[],          // URLs o paths de imágenes (opcional)
  empresa: string,              // Nombre de la empresa
  trabajador: string,           // Nombre del trabajador
  fecha: string,                // Fecha del accidente (YYYY-MM-DD)
  cargo: string                 // Cargo del trabajador
}
```

### 6.2 Datos Extraídos del PDF

```javascript
{
  descripcion: string,
  empresa: string,
  trabajador: {
    nombre: string,
    cedula: string,
    cargo: string,
    area: string
  },
  fecha: string,
  hora: string,
  lugar: string,
  testigos: string[],
  actividades_previas: string,
  descripcion_detallada: string,
  lesiones: string,
  parte_cuerpo_afectada: string,
  agente_lesion: string,
  condiciones_ambientales: string
}
```

### 6.3 Análisis Retornado por IA

```javascript
{
  causas_basicas: {
    factores_personales: [
      "Conocimiento insuficiente",
      "Fatiga o estrés",
      "Actitud inadecuada"
    ],
    factores_trabajo: [
      "Mantenimiento deficiente",
      "Herramientas inadecuadas",
      "Supervisión insuficiente"
    ]
  },
  causas_inmediatas: {
    actos_inseguros: [
      "Operar sin autorización",
      "No usar EPP",
      "Posición incorrecta"
    ],
    condiciones_inseguras: [
      "Superficie resbaladiza",
      "Herramienta defectuosa",
      "Iluminación insuficiente"
    ]
  },
  causa_raiz: string,  // Descripción de la causa fundamental
  recomendaciones: [
    {
      tipo: "Ingeniería",
      descripcion: "Instalar barreras de protección",
      prioridad: "Alta",
      plazo: "Inmediato"
    },
    {
      tipo: "Administrativo",
      descripcion: "Capacitar en procedimiento seguro",
      prioridad: "Media",
      plazo: "1 semana"
    }
  ],
  metodologia: "5 Porqués",
  categorias: {
    mano_de_obra: ["Conocimiento insuficiente"],
    maquina: ["Herramienta defectuosa"],
    material: ["Materiales en mal estado"],
    metodo: ["Procedimiento no documentado"],
    medio: ["Iluminación insuficiente"]
  }
}
```

---

## 7. Metodología 5 Porqués

### 7.1 Descripción

La técnica de los **5 Porqués** es un método iterativo de interrogación utilizado para explorar las relaciones de causa y efecto de un problema. El objetivo principal es determinar la **causa raíz** de un defecto o problema.

### 7.2 Ejemplo Práctico

**Problema:** Trabajador se cae de escalera

| Porqué | Respuesta | Categoría |
|--------|-----------|-----------|
| **1° ¿Por qué?** | La escalera se resbaló | Medio |
| **2° ¿Por qué?** | La escalera no tenía antideslizantes | Máquina |
| **3° ¿Por qué?** | Los antideslizantes se desgastaron y no se reemplazaron | Método |
| **4° ¿Por qué?** | No hay programa de inspección de escaleras | Método |
| **5° ¿Por qué?** | La gerencia no priorizó la inversión en seguridad | Mano de obra |

**Causa Raíz:** Falta de priorización de la inversión en seguridad por parte de la gerencia

### 7.3 Prompt para IA

```
Analiza el siguiente accidente usando la metodología de los 5 Porqués:

DESCRIPCIÓN DEL ACCIDENTE:
{texto_accidente}

INFORMACIÓN ADICIONAL:
- Trabajador: {trabajador}
- Cargo: {cargo}
- Fecha: {fecha}
- Empresa: {empresa}

PROPORCIONA:

1. CAUSAS BÁSICAS:
   - Factores Personales (conocimiento, fatiga, actitud)
   - Factores del Trabajo (mantenimiento, herramientas, supervisión)

2. CAUSAS INMEDIATAS:
   - Actos Inseguros (operar sin autorización, no usar EPP)
   - Condiciones Inseguras (superficie resbaladiza, herramienta defectuosa)

3. 5 PORQUÉS:
   - Iteración 1: ¿Por qué ocurrió?
   - Iteración 2: ¿Por qué [respuesta anterior]?
   - Iteración 3: ¿Por qué [respuesta anterior]?
   - Iteración 4: ¿Por qué [respuesta anterior]?
   - Iteración 5: ¿Por qué [respuesta anterior]?

4. CAUSA RAÍZ:
   - Descripción clara y concisa

5. RECOMENDACIONES:
   - Mínimo 3 recomendaciones preventivas
   - Clasificadas por tipo (Ingeniería, Administrativo, EPP)
   - Con prioridad (Alta, Media, Baja) y plazo

6. CATEGORÍAS 5M:
   - Mano de obra: [factores humanos]
   - Máquina: [equipos, herramientas]
   - Material: [materiales usados]
   - Método: [procedimientos]
   - Medio: [ambiente de trabajo]
```

---

## 8. Categorías 5M

### 8.1 Descripción

Las **5M** son las 5 categorías principales utilizadas para clasificar las causas de un accidente:

| M | Categoría | Descripción | Ejemplos |
|---|-----------|-------------|----------|
| **Mano de obra** | Factores humanos | Conocimiento, habilidades, actitud | - Conocimiento insuficiente<br>- Fatiga o estrés<br>- Actitud inadecuada |
| **Máquina** | Equipos y herramientas | Estado y mantenimiento de equipos | - Herramienta defectuosa<br>- Falta de mantenimiento<br>- Diseño inadecuado |
| **Material** | Materiales usados | Calidad y estado de materiales | - Materiales en mal estado<br>- Material incorrecto<br>- Falta de EPP |
| **Método** | Procedimientos | Procesos y métodos de trabajo | - Procedimiento no documentado<br>- Método inseguro<br>- Falta de supervisión |
| **Medio** | Ambiente | Condiciones ambientales | - Iluminación insuficiente<br>- Ruido excesivo<br>- Temperatura extrema |

### 8.2 Ejemplo de Clasificación

**Accidente:** Caída de trabajador desde escalera

| Categoría | Causas Identificadas |
|-----------|---------------------|
| **Mano de obra** | - Conocimiento insuficiente en uso de escaleras<br>- Fatiga por turno extendido |
| **Máquina** | - Escalera sin antideslizantes<br>- Escalera de diseño inadecuado |
| **Material** | - Zapatos sin suela antideslizante |
| **Método** | - No hay procedimiento para trabajo en alturas<br>- Falta de inspección de escaleras |
| **Medio** | - Iluminación insuficiente<br>- Superficie irregular |

---

## 9. Ejemplos de Uso

### 9.1 Caso Real: Caída desde Andamio

**Datos del Accidente:**

```javascript
{
  texto_accidente: "Trabajador cae desde andamio de 3 metros de altura mientras realizaba trabajos de pintura. El andamio no contaba con barandas de protección y el trabajador no usaba arnés de seguridad. El trabajador sufrió fractura de fémur y contusiones múltiples.",
  empresa: "Constructora SAS",
  trabajador: "Juan Pérez",
  fecha: "2026-02-15",
  cargo: "Pintor"
}
```

**Análisis de IA (Resultado):**

```javascript
{
  causas_basicas: {
    factores_personales: [
      "Conocimiento insuficiente en trabajo en alturas",
      "Subestimación del riesgo",
      "Confianza excesiva"
    ],
    factores_trabajo: [
      "Andamio sin barandas de protección",
      "No se proporcionó arnés de seguridad",
      "Supervisión ausente"
    ]
  },
  causas_inmediatas: {
    actos_inseguros: [
      "Trabajar en alturas sin protección contra caídas",
      "No verificar condiciones seguras del andamio"
    ],
    condiciones_inseguras: [
      "Andamio sin barandas de protección",
      "Superficie de trabajo inestable"
    ]
  },
  causa_raiz: "La empresa no implementó un sistema de gestión de trabajo en alturas que incluya: equipos de protección adecuados, inspección de andamios, y capacitación del personal",
  recomendaciones: [
    {
      tipo: "Ingeniería",
      descripcion: "Instalar barandas en todos los andamios",
      prioridad: "Alta",
      plazo: "Inmediato"
    },
    {
      tipo: "Administrativo",
      descripcion: "Implementar procedimiento de trabajo en alturas",
      prioridad: "Alta",
      plazo: "1 semana"
    },
    {
      tipo: "EPP",
      descripcion: "Proveer y capacitar en uso de arnés de seguridad",
      prioridad: "Alta",
      plazo: "Inmediato"
    }
  ],
  categorias: {
    mano_de_obra: ["Conocimiento insuficiente", "Subestimación del riesgo"],
    maquina: ["Andamio sin barandas"],
    material: ["Falta de arnés de seguridad"],
    metodo: ["No hay procedimiento de trabajo en alturas"],
    medio: ["Trabajo en altura sin protección"]
  }
}
```

### 9.2 Generación de Informe DOCX

El informe generado incluye:

1. **Portada**
   - Logo de la empresa
   - Título: "Informe de Investigación de Accidente"
   - Fecha y número de informe

2. **Datos Generales**
   - Información del trabajador
   - Fecha, hora y lugar del accidente
   - Descripción del accidente

3. **Análisis de Causas**
   - Causas básicas
   - Causas inmediatas
   - Causa raíz (5 Porqués)

4. **Recomendaciones**
   - Listado de recomendaciones
   - Prioridades y plazos
   - Responsables asignados

5. **Anexos**
   - Fotografías (si aplica)
   - Testimonios
   - Documentos relacionados

---

## 10. Cambios Recientes

### v0.1.70 - 15 Mar 2026

| Cambio | Descripción |
|--------|-------------|
| **Soporte multimodal** | Análisis de imágenes además de texto |
| **Mejora en prompts** | Prompts más específicos para 5 Porqués |
| **Optimización de tiempos** | Reducción de 60s a 30s en análisis |

### v0.1.52 - 28 Feb 2026

| Cambio | Descripción |
|--------|-------------|
| **Generación de DOCX** | Informes automáticos con formato profesional |
| **Categorías 5M** | Clasificación estructurada de causas |
| **Recomendaciones priorizadas** | Prioridad y plazo en cada recomendación |

---

## 11. Referencias

### Normativa Colombiana

| Norma | Descripción |
|-------|-------------|
| **Decreto 1072 de 2015** | Compilación del sector trabajo |
| **Resolución 0312 de 2019** | Estándares mínimos del SG-SST |
| **Decreto 1496 de 2018** | Reglamento de seguridad en trabajo en alturas |

### Metodologías

| Metodología | Descripción |
|-------------|-------------|
| **5 Porqués** | Técnica de interrogación iterativa para causa raíz |
| **5M** | Clasificación de causas por categorías |
| **Árbol de causas** | Diagrama de relaciones causa-efecto |

---

**Mantenido por:** AI Integration Team & SST Specialists  
**Última actualización:** 17 de marzo de 2026  
**Versión:** 2.0 (v0.1.75)  
**Próxima revisión:** Al actualizar modelo de IA o metodología

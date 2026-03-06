# Módulo 3.2.2 - Investigación de Accidentes con IA

## Descripción General

El módulo de Investigación de Accidentes implementa un sistema completo para la gestión de investigaciones de accidentes laborales, integrando inteligencia artificial para el análisis automático de causa raíz.

## Arquitectura del Módulo

```
investigacion-accidentes/
├── index.js                        # Exportación del componente
├── investigacion-accidentes-logic.js # Lógica principal del módulo
├── investigacion-accidentes-main.js  # Interfaz de realización de investigación
├── investigacion-accidentes-view.html # Vista de investigación
├── investigacion-accidentes-view.css  # Estilos de la vista
├── investigacion-home.html           # Portal de bienvenida K+AIR
├── investigacion-home.js             # Lógica del portal
├── investigaciones-view.html         # Visor de investigaciones
├── investigaciones-view.css          # Estilos del visor
├── investigaciones-viewer.js         # Lógica del visor
└── investigacion_handlers.js         # Handlers IPC
```

## Funcionalidades Principales

### 1. Portal de Bienvenida

El portal presenta:
- **Header**: Logo K+AIR + botón "Volver al Menú"
- **Status Pill**: Indicador del módulo activo
- **Estadísticas**: Contador de pendientes y completadas
- **Acciones Principales**:
  - Realizar Investigación (primaria)
  - Ver Investigaciones (secundaria)
- **Acciones Secundarias**:
  - Estadísticas
  - Plantillas
  - Exportar Datos
  - Configuración

### 2. Realizar Investigación

#### Flujo de Trabajo

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Cargar PDF │───▶│  Extraer    │───▶│  Analizar   │───▶│  Generar    │
│  Reporte    │    │  Datos      │    │  con IA     │    │  Informe    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

#### Datos Extraídos del PDF
- No. Identificación
- Nombre Completo
- Fecha del Accidente
- Hora del Accidente
- Cargo
- Descripción del Accidente
- Fecha de Nacimiento
- Teléfono
- Fecha de Ingreso
- Tipo de Accidente
- Lugar del Accidente
- Sitio de Ocurrencia
- Tipo de Lesión
- Parte del Cuerpo Afectada
- Agente del Accidente
- Mecanismo del Accidente
- Jornada de Trabajo
- Tiempo de Ocupación
- Tipo de Vinculación

#### Análisis 5 Porqués

El modelo LLM genera análisis en 5 niveles:

| Nivel | Descripción |
|-------|-------------|
| PorQue1 | Causas inmediatas del accidente |
| PorQue2 | Profundización de causas nivel 1 |
| PorQue3 | Causas sistémicas |
| PorQue4 | Causas organizacionales |
| PorQue5 | Causas raíz (accionables) |

Cada nivel analiza las 5 categorías 5M:
- **Mano de Obra**: Comportamientos, decisiones, capacitación
- **Método**: Procedimientos, normas, supervisión
- **Maquinaria**: Equipos, vehículos, herramientas
- **Medio Ambiente**: Condiciones del lugar
- **Material**: Objetos, sustancias, EPP

### 3. Ver Investigaciones

- Navegación por carpetas
- Preview de documentos (PDF, DOCX, XLSX)
- Apertura con aplicación externa
- Búsqueda de archivos

## Comunicación IPC

### Mensajes Request/Response

| Tipo | Descripción |
|------|-------------|
| `investigacion-accidentes-save-temp-pdf-file-request` | Guardar PDF temporal |
| `investigacion-accidentes-process-accident-pdf-request` | Procesar PDF |
| `investigacion-accidentes-analyze-accident-request` | Análisis con IA |
| `investigacion-accidentes-generate-accident-report-request` | Generar informe |

## Servidor LLM

### Endpoints

```
GET  /health   - Verificar estado del servidor
POST /load     - Cargar modelo en memoria
POST /analyze  - Analizar accidente
GET  /status   - Estado detallado
```

### Ejemplo de Solicitud

```json
POST /analyze
{
  "descripcion": "El trabajador sufrió golpe en la cabeza...",
  "contexto": "Área de recepción, horario diurno..."
}
```

### Ejemplo de Respuesta

```json
{
  "success": true,
  "data": {
    "PorQue1": {
      "Pregunta": "¿Por qué? - Nivel 1",
      "Mano de Obra": "Decisión personal de intervenir...",
      "Método": "Ausencia de instrucciones claras...",
      "Maquinaria": "El carro de golf en reparación...",
      "Medio Ambiente": "La zona no tiene señalización...",
      "Material": "Falta de EPP..."
    },
    "PorQue2": { ... },
    "PorQue3": { ... },
    "PorQue4": { ... },
    "PorQue5": { ... }
  },
  "generation_time": 289.0
}
```

## Plantillas de Informe

### Ubicación por Empresa

```python
Config.RUTAS = {
    "ASEPLUS": {
        "investigaciones": "G:/Mi unidad/.../3. Aseplus/.../3.2.2.1. Investigaciones/",
        "plantilla": "G:/Mi unidad/.../GI-FO-020 INVESTIGACION.docx"
    },
    # Otras empresas...
}
```

### Campos del Informe

El informe DOCX se genera con 80+ campos incluyendo:
- Datos del trabajador
- Datos del accidente
- Análisis 5 Porqués (5 niveles × 5 categorías)
- Recomendaciones
- Involucrados

## Sistema Visual

El módulo utiliza el Sistema Visual Oficial K+AIR:
- Paleta de colores primaria: #174ea6
- Tipografía: Lexend (títulos) + Roboto (cuerpo)
- Animaciones fadeIn
- Tarjetas con sombra sutil
- Bordes redondeados: 0.375rem

## Dependencias Python

```
flask
torch
transformers
docxtpl
openpyxl
pypdf
python-docx
```

## Configuración

### Ruta del Modelo
```
D:\1. Estudio\1.1 IA\1.1.2. LLM's\Inv. AT\mistral-3-3B-Reasonig-2512
```

### Puerto del Servidor
```
127.0.0.1:5555
```

## Notas de Desarrollo

1. El modelo es **multimodal** (capacidad de visión) pero actualmente solo se usa para texto
2. El servidor LLM se carga al iniciar la aplicación (tarda ~4 minutos)
3. Los informes se guardan en las rutas configuradas por empresa
4. La comunicación iframe-renderer usa postMessage con patrón request/response

# PROJECT OVERVIEW - SG-SST Electron App (K+AIR)

## 🎯 Propósito del Sistema

El Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST), denominado **K+AIR**, es una aplicación Electron que implementa un sistema de gestión integral para la seguridad y salud en el trabajo, con soporte para múltiples escenarios normativos basados en el tamaño de la empresa y nivel de riesgo, e integración de inteligencia artificial para análisis de accidentes.

## 🏗️ Arquitectura del Sistema

### Capa de Presentación (Renderer)
- Componentes HTML/CSS/JavaScript
- Vistas específicas para cada módulo
- Interfaz de usuario interactiva con Sistema Visual Oficial K+AIR

### Capa de Lógica (Main)
- Procesos principales de Electron
- Manejo de eventos inter-proceso (IPC)
- Controladores de eventos
- Integración con Python para procesamiento de documentos

### Capa de Datos
- Almacenamiento local
- Archivos JSON para normativas
- Exportación a Excel y DOCX

### Capa de Inteligencia Artificial (Nueva)
- Servidor LLM persistente (Flask)
- Modelo Mistral 3 3B Reasoning (multimodal)
- Análisis de causa raíz con metodología 5 Porqués
- Extracción de datos desde PDFs
- Generación automática de informes

## 🧩 Componentes Clave

### 1. Motor Normativo
- Sistema central que aplica diferentes escenarios normativos
- Define qué módulos y requisitos debe cumplir una empresa
- Basado en archivos JSON configurables

### 2. Sistema de Renderizado
- Renderizado dinámico de módulos según escenario normativo
- Activación/desactivación de componentes según normativa
- Interfaz adaptable al tamaño y riesgo de la empresa

### 3. Gestión de Empresas
- Registro y configuración de empresas
- Asignación automática de escenarios normativos
- Gestión de responsables y permisos

### 4. Archivos Clave del Sistema
- **main.js**: Proceso principal de Electron con responsabilidades críticas
- **preload.js**: Punto de entrada seguro para la comunicación entre renderer y main
- **renderer.js**: Proceso de renderizado que gestiona la interfaz de usuario y la navegación
- **index.html**: Estructura principal de la interfaz de usuario

### 5. Sistema de Inteligencia Artificial (Nuevo)
- **llm_server.py**: Servidor Flask persistente para inferencia del modelo LLM
- **accident_processor.py**: Extracción de datos desde PDFs de accidentes
- **accident_report_generator.py**: Generación de informes DOCX con datos analizados
- Modelo: Mistral 3 3B Reasoning (multimodal, capacidad de visión)
- Metodología: Análisis 5 Porqués con categorías 5M (Mano de Obra, Método, Maquinaria, Medio Ambiente, Material)

## 🎨 Sistema Visual Oficial K+AIR

### Paleta de Colores
| Color | Hex | Uso |
|-------|-----|-----|
| Primario | #174ea6 | Botones principales, headers |
| Primario Hover | #185abd | Estados hover |
| Primario Light | #e8f0fe | Fondos de acento |
| Éxito | #28a745 | Estados positivos |
| Advertencia | #ffc107 | Alertas |
| Peligro | #dc3545 | Errores, eliminar |
| Info | #17a2b8 | Información |

### Fondos
- App: #f8f9fa
- Cards: #ffffff
- Bordes: #dee2e6

### Tipografía
- Títulos: Lexend (600)
- Cuerpo: Roboto (300, 400, 500, 700)

### Componentes
- Tarjetas con sombra sutil
- Bordes redondeados: 0.375rem
- Animaciones fadeIn consistentes

## 📋 Módulos Principales

1. **Recursos**
2. **Gestión Integral**
3. **Gestión de la Salud**
4. **Gestión de Peligros y Riesgos**
5. **Gestión de Amenazas**
6. **Verificación**
7. **Mejoramiento**

## 📋 Submódulos por Módulo

### 1. Recursos
- 1.1.1 Responsable del SG
- 1.1.2 Roles y Responsabilidades
- 1.1.3 Asignación de Recursos
- 1.1.4 Afiliación al SSSI
- 1.1.5 Trabajo de alto riesgo
- 1.1.6 Conformación de Copasst
- 1.1.7 Capacitación al Copasst
- 1.1.8 Conformación de Comite de Convivencia
- 1.2.1 Programa de capacitación Anual
- 1.2.2 Inducción y Reinducción
- 1.2.3 Curso Virtual 50 Horas
- 1.2.4 Manual de SST para Proveedores y Contratistas

### 2. Gestión Integral
- 2.1.1 Política del SG-SST
- 2.2.1 Objetivos SST
- 2.3.1 Evaluación inicial del SG-SST
- 2.4.1 Plan de Trabajo Anual
- 2.5.1 Archivo y retención documental del SG-SST
- 2.6.1 Rendición de cuentas
- 2.7.1 Matriz de requisitos legales
- 2.8.1 Mecanismos de comunicaciones
- 2.9.1 Identificación y evaluación para la adquisición de bienes y servicios
- 2.10.1 Evaluación y seleción de proveedores y contratistas
- 2.11.1 Gestión del Cambio
- 2.12.1 Equipos y Herramientas
- 2.13.1 Elementos de Protección Personal

### 3. Gestión de la Salud
- 3.1.1 Descripción Sociodemografica y diagnostico de condiciones de salud
- 3.1.2 Actividades de medicina y preventiva y promoción de la salud
- 3.1.3 Perfil de cargo y profesiograma
- 3.1.4 Evaluaciones médicas
- 3.1.5 Custodia medica ocupacional
- 3.1.6 Restricciones y recomendaciones médicas
- 3.1.7 Estilos de vida Saludables
- 3.1.8 Servicios de Higiene
- 3.1.9 Manejo de Residuos
- 3.2.1 Reporte de los accidentes de trabajo
- 3.2.2 Investigación de Accidentes, indicentes y Enfermedades
- 3.2.3 Registro y analisis estadistico de indicentes, accidentes de trabajo y enfermedades
- 3.3.1 Frecuencia de la accidentalidad
- 3.3.2 Severidad de la accidentalidad
- 3.3.3 Proporción de accidentes de trabajo mortales
- 3.3.4 Medición de la prevalencia de enfermedades laborales
- 3.3.5 Medición de la incidencia de enfermedades laborales
- 3.3.6 Medición del ausentismo por causa médica

### 4. Gestión de Peligros y Riesgos
- 4.1.1 Metodologia IPEVR
- 4.1.2 Identificación de Peligros
- 4.1.3 Identificación de Sustancias Químicas carcinogénas o con toxicidad
- 4.1.4 Mediciones ambientales
- 4.2.1 Mediciones de Prevención y Control frente a Peligros, Riesgos Identificados
- 4.2.2 Aplicación de las medidas de prevención y control por parte de los trabajadores
- 4.2.3 Evaluación de procedimientos, instructivos internos de seguridad y salud en el trabajo
- 4.2.4 Realización de inspecciones sistematicas a las instalaciones, maquinas o equipos
- 4.2.5 Mantenimiento periodico de equipos, instalaciones herramientas
- 4.2.6 Entrega de EPP

### 5. Gestión de Amenazas
- 5.1.1 Plan de Prevención de Emergencias
- 5.1.2 Examenes Medicos Brigadista

### 6. Verificación
- 6.1.1 Definición de indicadores
- 6.1.2 Auditoria Anual
- 6.1.3 Revisión de la alta Dirección
- 6.1.4 Planificación de la Auditoria

### 7. Mejoramiento
- 7.1.1 Acciones Preventivas y Correctivas
- 7.1.2 Acciones de Mejora conforme a revisiones de la alta gerencia
- 7.1.3 Acciones de Mejora con base en investigaciones de AT y EL
- 7.1.4 Elaboración de Planes de Mejoramiento de medidas y acciones correctivas por autoridades y ARL

## 📐 Decisiones Arquitectónicas

### ¿Por qué Electron?
- Permite aplicaciones de escritorio multiplataforma
- Acceso al sistema de archivos local
- Integración con herramientas de oficina (Excel)
- Seguridad adecuada para datos sensibles

### ¿Por qué JSON para normativas?
- Fácil de editar y mantener
- Permite configuraciones dinámicas
- Facilita la actualización de escenarios
- Compatible con versionado

### ¿Por qué renderizado dinámico?
- Adaptabilidad a diferentes escenarios normativos
- Cumplimiento automático de requisitos
- Reducción de código duplicado
- Facilita auditorías

## 🔄 Flujo de Trabajo

1. **Registro de Empresa** → Asignación de escenario normativo
2. **Carga de Normativas** → Configuración de requisitos
3. **Renderizado de Módulos** → Activación de componentes
4. **Gestión de Documentos** → Almacenamiento y seguimiento
5. **Generación de Reportes** → Exportación a Excel
6. **Análisis con IA** → Investigación de accidentes con LLM (Nuevo)

## 🔬 Módulos con Funcionalidad Avanzada

### 3.2.2 Investigación de Accidentes (Con IA)
- **Portal de bienvenida** con estadísticas y acciones rápidas
- **Realizar Investigación**: 
  - Carga de PDF de reporte de accidente
  - Extracción automática de datos (nombre, fecha, cargo, descripción, etc.)
  - Análisis de causa raíz con metodología 5 Porqués
  - Generación automática de informe DOCX
- **Ver Investigaciones**: Visualizador de documentos con preview integrado
- **Comunicación iframe-renderer** con patrón request/response estandarizado

### 2.4.1 Plan de Trabajo Anual
- Portal de bienvenida con año activo
- Vista de cronograma con diagrama de Gantt
- Importación desde Excel
- Clonación de planes entre años
- Exportación a Excel/PDF

## 📚 Documentación Relacionada

- [Arquitectura del Sistema](arquitectura.md) - Detalles técnicos de la estructura
- [Archivos Clave del Sistema](archivos-clave.md) - Descripción detallada de main.js, preload.js, renderer.js e index.html
- [Estado Actual de la Reorganización](ESTADO_ACTUAL_REORGANIZACION.md) - Documento consolidado con la información de todas las fases de reorganización completadas
- [Motor Normativo](motor-normativo.md) - Funcionamiento del sistema normativo
- [Escenarios Normativos](escenarios-normativos.md) - Tipos y categorías de escenarios
- [Flujo de Creación de Empresa](flujo-creacion-empresa.md) - Proceso de registro
- [Sistema de Renderizado](renderer.md) - Mecanismo de renderizado dinámico
- [Actualización de Interfaz: 1.1.1](ui-update-responsable-sg.md) - Detalles del nuevo Sistema de Diseño K+AIR
- [Actualización de Interfaz: 1.1.2](ui-update-roles-responsabilidades.md) - Detalles de migración para Roles y Responsabilidades
- [Mantenimiento de Documentación](mantenimiento-documentacion.md) - Guía para mantener la documentación actualizada
- [Módulo Investigación de Accidentes](modulo-investigacion-accidentes.md) - Documentación del módulo 3.2.2 con IA
- [Dependencias del Sistema](DEPENDENCIAS.md) - Guía completa de instalación en nuevo equipo
- [Changelog](CHANGELOG.md) - Registro de cambios por versión
- [Configuración OnlyOffice](ONLYOFFICE_SETUP.md) - Guía de configuración
- [Mantenimiento del Proyecto](README-LIMPIEZA.md) - Reducción de tamaño y limpieza
- [Scripts Python](scripts-python.md) - Documentación de scripts en Portear/src
- [Portear/README.md](../Portear/README.md) - Scripts Python de procesamiento

## 📦 Estado de Módulos Reorganizados (v0.1.46)

Al febrero de 2026, se ha completado la reorganización modular del sistema con **18 módulos migrados** a la nueva arquitectura `modules/`.

### ✅ Módulos Completados (100%)

#### Recursos (11 módulos)
| Código | Módulo | Archivos | Estado |
|--------|--------|----------|--------|
| 1.1.1 | Responsable del SG | logic, viewer, view.html, view.css | ✅ |
| 1.1.2 | Roles y Responsabilidades | logic, viewer, view.html, view.css | ✅ |
| 1.1.3 | Presupuesto | logic, view.html, selector.html | ✅ |
| 1.1.4 | Afiliación | logic, viewer, view.html, view.css | ✅ |
| 1.1.5 | Trabajo de alto riesgo | logic, viewer, view.html, view.css | ✅ |
| 1.1.6 | Copasst | logic, viewer, view.html, view.css | ✅ |
| 1.1.7 | Capacitación al Copasst | logic, viewer, view.html, view.css | ✅ |
| 1.1.8 | Comité de Convivencia | logic, viewer, view.html, view.css | ✅ |
| 1.2.1 | Capacitaciones | logic, viewer, view.html, view.css | ✅ |
| 1.2.2 | Inducciones | logic, viewer, view.html, view.css | ✅ |
| 1.2.3 | Curso Virtual | logic, viewer, view.html, view.css | ✅ |

#### Gestión Integral (5 módulos)
| Código | Módulo | Archivos | Estado |
|--------|--------|----------|--------|
| 2.1.1 | Política | logic, viewer, view.html, view.css | ✅ |
| 2.2.1 | Objetivos SST | logic, viewer, view.html, view.css | ✅ |
| 2.3.1 | Evaluación Inicial SG-SST | logic, viewer, view.html, view.css | ✅ |
| 2.4.1 | Plan de Trabajo Anual | logic, viewer, view.html, view.css | ✅ |
| 2.6.1 | Rendición de cuentas | logic, viewer, view.html, view.css | ✅ |

#### Gestión de la Salud (6 módulos)
| Código | Módulo | Archivos | Estado |
|--------|--------|----------|--------|
| 3.1.1 | Sociodemográfica | component, viewer, view.html, view.css | ✅ |
| 3.1.4 | Evaluaciones médicas | logic, viewer, view.html, view.css | ✅ |
| 3.1.6 | Restricciones médicas | logic, viewer, view.html, view.css | ✅ |
| 3.2.1 | Reportes de accidentes | logic, viewer, view.html, view.css | ✅ |
| 3.2.2 | Investigación de Accidentes | logic, viewer, view.html, view.css, home, handlers | ✅ |
| 3.3.6 | Ausentismo | logic, dashboard.html | ✅ |

### 📁 Estructura de Directorios Actual

```
modules/
├── recursos/
│   ├── responsable-sg/
│   ├── roles-responsabilidades/
│   ├── afiliacion/
│   ├── copasst/
│   ├── capacitacion-copasst/
│   ├── comite-convivencia/
│   ├── curso-virtual/
│   ├── presupuesto/
│   ├── trabajo-alto-riesgo/
│   ├── capacitaciones/
│   └── inducciones/
├── gestion-integral/
│   ├── politica/
│   ├── objetivos-sst/
│   ├── evaluacion-inicial-sg-sst/
│   ├── plan-trabajo/
│   └── rendicion-cuentas/
└── gestion-salud/
│   ├── sociodemografica/
│   ├── evaluaciones-medicas/
│   ├── restricciones-medicas/
│   ├── reportes-accidentes/
│   ├── investigacion-accidentes/
│   └── ausentismo/
```

### 🔄 Convención de Nombres

- `*-logic.js` - Lógica del componente (anteriormente `*-component.js` o `*.js`)
- `*-viewer.js` - Vista del componente (mantiene nombre)
- `*-view.html` - HTML del componente (anteriormente `*-viewer.html`)
- `*-view.css` - Estilos del componente (anteriormente `*-viewer.css`)
- `index.js` - Exportación del módulo

### 📝 Documentación Adicional

- Ver [ESTADO_ACTUAL_REORGANIZACION.md](ESTADO_ACTUAL_REORGANIZACION.md) para detalles de las 18 fases completadas
- Ver [scripts-python.md](scripts-python.md) para documentación de scripts Python


## 🤖 Sistema de Inteligencia Artificial

### Arquitectura del Servidor LLM
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Electron App  │────▶│   Flask Server   │────▶│  Mistral 3 3B   │
│   (renderer)    │     │  (llm_server.py) │     │    Reasoning    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │
        ▼                        ▼
┌─────────────────┐     ┌──────────────────┐
│   IPC Channel   │     │   HTTP :5555     │
└─────────────────┘     └──────────────────┘
```

### Endpoints del Servidor LLM
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/health` | GET | Estado del servidor |
| `/load` | POST | Cargar modelo en memoria |
| `/analyze` | POST | Analizar accidente |
| `/status` | GET | Estado detallado |

### Flujo de Análisis de Accidente
1. Usuario carga PDF de reporte de accidente
2. `accident_processor.py` extrae datos del PDF
3. Datos enviados al servidor LLM via HTTP
4. Modelo genera análisis 5 Porqués con categorías 5M
5. `accident_report_generator.py` genera informe DOCX
6. Informe guardado en ruta de la empresa

## ⚠️ Reglas de Cambio

### No se toca porque:
1. **La estructura de escenarios normativos** está alineada con la normativa colombiana actual
2. **El sistema de renderizado** está optimizado para cumplimiento automático
3. **La capa de datos** está diseñada para auditorías y trazabilidad

### Sí se puede mejorar:
1. **Nuevas funcionalidades** dentro del marco normativo existente
2. **Interfaz de usuario** manteniendo la lógica subyacente
3. **Eficiencia de procesos** sin alterar la lógica de negocio

## 🤖 Uso de IA en el Desarrollo

Antes de proponer cambios, revisa este archivo y los archivos en `/docs` para respetar la arquitectura, el motor normativo y los escenarios existentes.

## 📝 Mantenimiento

- La documentación técnica se genera desde los comentarios JSDoc
- La documentación funcional se mantiene bajo disciplina de cambios
- Cada cambio significativo debe reflejarse en la documentación correspondiente
- El CHANGELOG.md debe actualizarse con cada versión

## 🔐 Consideraciones de Seguridad

- Acceso local a datos sensibles de empresas
- Validación de entradas en todos los módulos
- Control de versiones para auditoría
- Exportación controlada de información
# Arquitectura del Sistema SG-SST

## Visión General

El sistema SG-SST (Sistema de Gestión de Seguridad y Salud en el Trabajo) es una aplicación Electron que implementa un sistema de gestión integral para la seguridad y salud en el trabajo.

## Estructura de la Aplicación

### Capa de Presentación (Renderer)
- Componentes HTML/CSS/JavaScript
- Vistas específicas para cada módulo
- Interfaz de usuario interactiva

### Capa de Lógica (Main)
- Procesos principales de Electron
- Manejo de eventos inter-proceso (IPC)
- Controladores de eventos

### Capa de Datos
- Almacenamiento local
- Archivos JSON para normativas
- Exportación a Excel

## Archivos Clave del Sistema

### main.js
- **Función**: Proceso principal de Electron
- **Responsabilidades**:
  - Creación de ventanas de la aplicación
  - Manejo de eventos inter-proceso (IPC)
  - Integración con Python para mapeo de directorios
  - Gestión de actualizaciones automáticas
  - Manejo de archivos Excel
  - Sistema de logging centralizado
  - Detección robusta de Python

### preload.js
- **Función**: Punto de entrada seguro para la comunicación entre renderer y main
- **Responsabilidades**:
  - Exposición controlada de APIs de Electron al renderer
  - Manejo de eventos inter-proceso (IPC)
  - Comunicación segura entre procesos
  - Acceso a funcionalidades del sistema operativo

### renderer.js
- **Función**: Proceso de renderizado de Electron
- **Responsabilidades**:
  - Gestión de la interfaz de usuario
  - Renderizado dinámico de módulos y submódulos
  - Navegación entre diferentes secciones
  - Comunicación con el proceso principal
  - Integración con el sistema normativo

### index.html
- **Función**: Página principal de la aplicación
- **Responsabilidades**:
  - Estructura base de la interfaz de usuario
  - Carga de estilos y scripts
  - Barra lateral con módulos
  - Área de contenido dinámico
  - Cabecera con información de la empresa
  - Sistema de logs

## Módulos Principales

1. **Recursos**
2. **Gestión Integral**
3. **Gestión de la Salud**
4. **Gestión de Peligros y Riesgos**
5. **Gestión de Amenazas**
6. **Verificación**
7. **Mejoramiento**

## Submódulos por Módulo

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

## Patrones de Diseño

- Separación de responsabilidades
- Componentes reutilizables
- Configuración basada en normativas
- Renderizado dinámico según escenarios

## Estructura Modular

- El sistema ha sido reorganizado en módulos independientes en el directorio `modules/`
- Cada módulo tiene su propia estructura de archivos lógica-vista (logic.js, viewer.js, view.html, view.css)
- La información de todas las fases de reorganización está consolidada en el archivo `ESTADO_ACTUAL_REORGANIZACION.md`
- Los módulos se integran con el sistema existente manteniendo compatibilidad
- Cada módulo tiene su propio archivo `index.js` para exportar sus componentes
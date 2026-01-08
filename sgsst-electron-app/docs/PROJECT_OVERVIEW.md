# PROJECT OVERVIEW - SG-SST Electron App

## 🎯 Propósito del Sistema

El Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) es una aplicación Electron que implementa un sistema de gestión integral para la seguridad y salud en el trabajo, con soporte para múltiples escenarios normativos basados en el tamaño de la empresa y nivel de riesgo.

## 🏗️ Arquitectura del Sistema

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

## 📚 Documentación Relacionada

- [Arquitectura del Sistema](arquitectura.md) - Detalles técnicos de la estructura
- [Archivos Clave del Sistema](archivos-clave.md) - Descripción detallada de main.js, preload.js, renderer.js e index.html
- [Motor Normativo](motor-normativo.md) - Funcionamiento del sistema normativo
- [Escenarios Normativos](escenarios-normativos.md) - Tipos y categorías de escenarios
- [Flujo de Creación de Empresa](flujo-creacion-empresa.md) - Proceso de registro
- [Sistema de Renderizado](renderer.md) - Mecanismo de renderizado dinámico
- [Mantenimiento de Documentación](mantenimiento-documentacion.md) - Guía para mantener la documentación actualizada

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
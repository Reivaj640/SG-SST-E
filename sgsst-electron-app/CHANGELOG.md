# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.39] - 2026-01-21

### Added
- Estandarización de patrones de comunicación entre Iframes y Renderer (`-request` / `-response`).
- Nueva petición `duplicate-budget-file-request` en el sistema de renderizado.

### Fixed
- Corrección del módulo **Plan de Trabajo Anual** (2.4.1):
  - Solucionado error que bloqueaba la clonación de planes de trabajo.
  - Eliminado uso de `prompt()` (incompatible con Electron/Iframe) por `confirm()`.
  - Automatización del cálculo del año siguiente para nuevos periodos.
  - Sincronización de tipos de mensajes entre `plan-viewer.js` y `renderer.js`.

## [0.1.38] - 2025-01-08

### Added
- Nuevo módulo de verificación de tamaños
- Script para verificación de tamaños de archivos
- Funcionalidad de limpieza de datos

### Changed
- Mejoras en el manejo de datos
- Actualización de dependencias
- Corrección de errores menores

## [0.1.37] - 2024-12-20

### Added
- Nuevo módulo de trabajo en alto riesgo
- Componentes para trabajo en alto riesgo
- Funcionalidades de gestión de riesgos

### Changed
- Actualización de la interfaz de usuario
- Mejoras en la navegación
- Corrección de errores menores

## [0.1.36] - 2024-12-18

### Added
- Nuevo módulo de seguimiento de incapacidades
- Dashboard de ausentismo
- Funcionalidades de reporte

### Changed
- Mejoras en el módulo de ausentismo
- Actualización de gráficos
- Corrección de errores menores

## [0.1.35] - 2024-12-15

### Added
- Nuevo módulo de investigación de accidentes
- Componentes para investigación de accidentes
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de reportes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.34] - 2024-12-10

### Added
- Nuevo módulo de evaluaciones médicas
- Componentes para evaluaciones médicas
- Funcionalidades de seguimiento

### Changed
- Mejoras en el módulo de restricciones médicas
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.33] - 2024-12-05

### Added
- Nuevo módulo de capacitación COPASST
- Componentes para capacitación COPASST
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de comité de convivencia
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.32] - 2024-11-30

### Added
- Nuevo módulo de comité de convivencia
- Componentes para comité de convivencia
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de afiliación
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.31] - 2024-11-25

### Added
- Nuevo módulo de afiliación
- Componentes para afiliación
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de política
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.30] - 2024-11-20

### Added
- Nuevo módulo de política
- Componentes para política
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de roles y responsabilidades
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.29] - 2024-11-15

### Added
- Nuevo módulo de roles y responsabilidades
- Componentes para roles y responsabilidades
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de presupuesto
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.28] - 2024-11-10

### Added
- Nuevo módulo de presupuesto
- Componentes para presupuesto
- Funcionalidades de cálculo

### Changed
- Mejoras en el módulo de reportes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.27] - 2024-11-05

### Added
- Nuevo módulo de reportes
- Componentes para reportes
- Funcionalidades de exportación

### Changed
- Mejoras en el módulo de gestión de riesgos
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.26] - 2024-10-30

### Added
- Nuevo módulo de gestión de riesgos
- Componentes para gestión de riesgos
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de gestión integral
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.25] - 2024-10-25

### Added
- Nuevo módulo de gestión integral
- Componentes para gestión integral
- Funcionalidades de coordinación

### Changed
- Mejoras en el módulo de gestión de salud
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.24] - 2024-10-20

### Added
- Nuevo módulo de gestión de salud
- Componentes para gestión de salud
- Funcionalidades de monitoreo

### Changed
- Mejoras en el módulo de gestión de amenazas
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.23] - 2024-10-15

### Added
- Nuevo módulo de gestión de amenazas
- Componentes para gestión de amenazas
- Funcionalidades de evaluación

### Changed
- Mejoras en el módulo de mejoramiento
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.22] - 2024-10-10

### Added
- Nuevo módulo de mejoramiento
- Componentes para mejoramiento
- Funcionalidades de seguimiento

### Changed
- Mejoras en el módulo de verificación
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.21] - 2024-10-05

### Added
- Nuevo módulo de verificación
- Componentes para verificación
- Funcionalidades de control

### Changed
- Mejoras en el módulo de recursos
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.20] - 2024-09-30

### Added
- Nuevo módulo de recursos
- Componentes para recursos
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de evaluaciones
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.19] - 2024-09-25

### Added
- Nuevo módulo de evaluaciones
- Componentes para evaluaciones
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de curso virtual
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.18] - 2024-09-20

### Added
- Nuevo módulo de curso virtual
- Componentes para curso virtual
- Funcionalidades de capacitación

### Changed
- Mejoras en el módulo de curso 50 horas
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.17] - 2024-09-15

### Added
- Nuevo módulo de curso 50 horas
- Componentes para curso 50 horas
- Funcionalidades de certificación

### Changed
- Mejoras en el módulo de responsable SG
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.16] - 2024-09-10

### Added
- Nuevo módulo de responsable SG
- Componentes para responsable SG
- Funcionalidades de coordinación

### Changed
- Mejoras en el módulo de restricciones
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.15] - 2024-09-05

### Added
- Nuevo módulo de restricciones
- Componentes para restricciones
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de sociodemográfica
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.14] - 2024-08-30

### Added
- Nuevo módulo de sociodemográfica
- Componentes para sociodemográfica
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de ausentismo
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.13] - 2024-08-25

### Added
- Nuevo módulo de ausentismo
- Componentes para ausentismo
- Funcionalidades de medición

### Changed
- Mejoras en el módulo de medición de ausentismo
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.12] - 2024-08-20

### Added
- Nuevo módulo de medición de ausentismo
- Componentes para medición de ausentismo
- Funcionalidades de cálculo

### Changed
- Mejoras en el módulo de investigación de accidentes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.11] - 2024-08-15

### Added
- Nuevo módulo de investigación de accidentes
- Componentes para investigación de accidentes
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de reportes de accidentes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.10] - 2024-08-10

### Added
- Nuevo módulo de reportes de accidentes
- Componentes para reportes de accidentes
- Funcionalidades de generación

### Changed
- Mejoras en el módulo de copasst
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.9] - 2024-08-05

### Added
- Nuevo módulo de copasst
- Componentes para copasst
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de comité de convivencia
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.8] - 2024-08-01

### Added
- Nuevo módulo de comité de convivencia
- Componentes para comité de convivencia
- Funcionalidades de coordinación

### Changed
- Mejoras en el módulo de política
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.7] - 2024-07-25

### Added
- Nuevo módulo de política
- Componentes para política
- Funcionalidades de definición

### Changed
- Mejoras en el módulo de roles y responsabilidades
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.6] - 2024-07-20

### Added
- Nuevo módulo de roles y responsabilidades
- Componentes para roles y responsabilidades
- Funcionalidades de asignación

### Changed
- Mejoras en el módulo de afiliación
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.5] - 2024-07-15

### Added
- Nuevo módulo de afiliación
- Componentes para afiliación
- Funcionalidades de registro

### Changed
- Mejoras en el módulo de presupuesto
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.4] - 2024-07-10

### Added
- Nuevo módulo de presupuesto
- Componentes para presupuesto
- Funcionalidades de cálculo

### Changed
- Mejoras en el módulo de reportes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.3] - 2024-07-05

### Added
- Nuevo módulo de reportes
- Componentes para reportes
- Funcionalidades de exportación

### Changed
- Mejoras en el módulo de gestión
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.2] - 2024-07-01

### Added
- Nuevo módulo de gestión
- Componentes para gestión
- Funcionalidades de administración

### Changed
- Mejoras en la estructura general
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.1] - 2024-06-25

### Added
- Estructura inicial del proyecto
- Configuración de Electron
- Módulos básicos de la aplicación

### Changed
- Configuración inicial
- Estructura de directorios
- Archivos base
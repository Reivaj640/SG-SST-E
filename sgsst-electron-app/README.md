# Sistema de Documentación Automática - SG-SST

Este proyecto implementa un sistema de documentación automática basado en JSDoc para mantener actualizada la documentación del código fuente.

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Visión General del Proyecto](#visión-general-del-proyecto)
3. [Arquitectura del Sistema](#arquitectura-del-sistema)
4. [Motor Normativo](#motor-normativo)
5. [Escenarios Normativos](#escenarios-normativos)
6. [Flujo de Creación de Empresa](#flujo-de-creación-de-empresa)
7. [Sistema de Renderizado](#sistema-de-renderizado)
8. [Generación de Documentación](#generación-de-documentación)
9. [Guía para Desarrolladores](#guía-para-desarrolladores)

## Introducción

El sistema SG-SST (Sistema de Gestión de Seguridad y Salud en el Trabajo) es una aplicación Electron que implementa un sistema de gestión integral para la seguridad y salud en el trabajo, con soporte para múltiples escenarios normativos basados en el tamaño de la empresa y nivel de riesgo.

## Visión General del Proyecto

Para entender completamente el sistema, su arquitectura y decisiones de diseño, consulta [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md). Este archivo contiene la visión general del proyecto, decisiones arquitectónicas clave y reglas de cambio.

## Arquitectura del Sistema

Para detalles sobre la arquitectura del sistema, consulta [docs/arquitectura.md](docs/arquitectura.md).

## Motor Normativo

Para información sobre el motor normativo, consulta [docs/motor-normativo.md](docs/motor-normativo.md).

## Escenarios Normativos

Para detalles sobre los escenarios normativos, consulta [docs/escenarios-normativos.md](docs/escenarios-normativos.md).

## Flujo de Creación de Empresa

Para información sobre el flujo de creación de empresa, consulta [docs/flujo-creacion-empresa.md](docs/flujo-creacion-empresa.md).

## Sistema de Renderizado

Para detalles sobre el sistema de renderizado, consulta [docs/renderer.md](docs/renderer.md).

## Generación de Documentación

### Documentación Automática (API)

La documentación de la API se genera desde los comentarios JSDoc en el código fuente.

#### Generar documentación

```bash
# Generar documentación una vez
npm run docs:generate

# Generar documentación y vigilar cambios
npm run docs:watch
```

#### Archivos de documentación generada

- Documentación de API: `docs/api/`

### Documentación Funcional

La documentación funcional se encuentra en el directorio `docs/` y describe cómo funciona la aplicación desde el punto de vista del usuario y del sistema.

## Guía para Desarrolladores

### Agregar documentación a nuevas funciones

Cuando agregues nuevas funciones o modifiques existentes, asegúrate de incluir comentarios JSDoc apropiados:

```javascript
/**
 * Renderiza los módulos y submódulos activos de una empresa
 * según el escenario normativo asignado.
 *
 * @param {Object} empresa - Objeto que representa la empresa
 * @param {string} empresa.escenario_normativo - El escenario normativo asignado
 * @param {Object} reglasNormativas - Las reglas normativas aplicables
 * @returns {void}
 */
function renderizarModulosEmpresa(empresa, reglasNormativas) {
  // lógica de la función
}
```

### Actualizar documentación funcional

Cuando realices cambios significativos en la funcionalidad, actualiza los archivos correspondientes en el directorio `docs/`:

- `docs/PROJECT_OVERVIEW.md` - Decisiones arquitectónicas y reglas de cambio
- `docs/arquitectura.md` - Cambios en la estructura del sistema
- `docs/archivos-clave.md` - Detalles de los archivos fundamentales (main.js, preload.js, renderer.js, index.html)
- `docs/motor-normativo.md` - Cambios en el motor normativo
- `docs/escenarios-normativos.md` - Nuevos escenarios o modificaciones
- `docs/flujo-creacion-empresa.md` - Cambios en el proceso de creación de empresa
- `docs/renderer.md` - Cambios en el sistema de renderizado
- `docs/mantenimiento-documentacion.md` - Actualizaciones al proceso de documentación

### Proceso de integración

Cada vez que se realice un cambio en el código:

1. Actualiza los comentarios JSDoc en el código fuente
2. Ejecuta `npm run docs:generate` para actualizar la documentación de API
3. Actualiza los archivos de documentación funcional si es necesario
4. Asegúrate de que el CHANGELOG.md refleje los cambios realizados

## Scripts Disponibles

- `npm run docs:generate` - Genera la documentación de API desde JSDoc
- `npm run docs:watch` - Vigila cambios en los archivos JS y regenera la documentación automáticamente
- `npm start` - Inicia la aplicación
- `npm run dev` - Inicia la aplicación en modo desarrollo con recarga automática
- `npm run build` - Construye la aplicación para distribución

## Contribuciones

Cuando contribuyas al proyecto:

1. Sigue las convenciones de nombrado y estilo del código existente
2. Documenta todas las funciones públicas con JSDoc
3. Actualiza la documentación funcional cuando sea necesario
4. Incluye tus cambios en el CHANGELOG.md

## Uso de IA en el Desarrollo

Antes de proponer cambios, revisa PROJECT_OVERVIEW.md y los archivos en /docs para respetar la arquitectura, el motor normativo y los escenarios existentes.

Especial atención debe darse a los archivos clave del sistema:
- **main.js**: Proceso principal con responsabilidades críticas
- **preload.js**: Punto de entrada seguro para la comunicación entre procesos
- **renderer.js**: Proceso de renderizado que gestiona la interfaz de usuario y la navegación
- **index.html**: Estructura principal de la interfaz de usuario

Estos archivos son fundamentales para el funcionamiento del sistema y deben mantenerse con cuidado.

## Nota sobre la Documentación

La documentación técnica se genera automáticamente desde los comentarios JSDoc y la documentación funcional se mantiene bajo disciplina de cambios.
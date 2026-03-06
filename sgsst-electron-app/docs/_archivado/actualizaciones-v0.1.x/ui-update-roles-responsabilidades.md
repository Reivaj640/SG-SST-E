# Actualización de Interfaz: 1.1.2 Roles y Responsabilidades

## 📅 Fecha de Actualización
**Enero 2026**

## 🎯 Objetivo
Modernizar la interfaz de usuario del submódulo **1.1.2 Roles y Responsabilidades**, alineándola con el nuevo **Sistema de Diseño K+AIR**, para asegurar consistencia visual y funcional con el módulo 1.1.1.

## 🎨 Sistema de Diseño K+AIR Implementado

Se han replicado los estándares visuales definidos:

*   **Paleta de Colores:** Institucional (`#174ea6`, `#28a745`, `#dc3545`).
*   **Layout:** Header Fijo + Sidebar de Navegación + Área de Visor.
*   **Tipografía:** Lexend y Roboto.

## 🏗️ Arquitectura del Componente

### Archivos Modificados

1.  **`modules/recursos/roles-responsabilidades/roles-responsabilidades-view.html`**
    *   **Cambio:** Adopción de la estructura semántica `app-body`.
    *   **Contenido:** Header con controles de documento, Sidebar con lista de carpetas/archivos y Viewer Stage.

2.  **`modules/recursos/roles-responsabilidades/roles-responsabilidades-view.css`**
    *   **Cambio:** Estandarización de variables CSS y estilos de componentes.

3.  **`modules/recursos/roles-responsabilidades/roles-responsabilidades-viewer.js`**
    *   **Cambio:** Lógica de cliente actualizada para manejar el nuevo DOM y el sistema de comunicación estandarizado (`type: '...-request'`).

4.  **`modules/recursos/roles-responsabilidades/roles-responsabilidades-logic.js`**
    *   **Cambio:** Refactorización del manejo de mensajes `postMessage` para usar el patrón `type/payload` y soportar todas las solicitudes del visor (PDF, Word, Excel, Descarga).

## 🚀 Funcionalidades

*   **Visualización Multiformato:** PDF, Word (convertido), Excel (convertido).
*   **Navegación:** Explorador de archivos intuitivo.
*   **Zoom y Ajuste:** Controles dedicados en toolbar.
*   **Descarga e Impresión:** Integradas y funcionales.

## 🔄 Estado de Migración

El submódulo 1.1.2 se encuentra ahora **100% migrado** al nuevo estándar visual K+AIR.

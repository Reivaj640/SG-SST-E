# Actualización de Interfaz: 1.1.1 Responsable del SG

## 📅 Fecha de Actualización
**Enero 2026**

## 🎯 Objetivo
Modernizar la interfaz de usuario del submódulo **1.1.1 Responsable del SG**, alineándola con el nuevo **Sistema de Diseño K+AIR**, para mejorar la usabilidad, la coherencia visual y la experiencia de navegación documental.

## 🎨 Sistema de Diseño K+AIR Implementado

Se ha aplicado rigurosamente el sistema visual oficial, caracterizado por:

*   **Paleta de Colores:**
    *   **Primario:** `#174ea6` (Acciones principales, encabezados, selección)
    *   **Éxito:** `#28a745` (Iconos Excel, confirmaciones)
    *   **Peligro:** `#dc3545` (Iconos PDF, errores)
    *   **Advertencia:** `#ffc107` (Carpetas)
    *   **Fondo:** `#f8f9fa` (Cuerpo), `#ffffff` (Tarjetas/Sidebar)
*   **Tipografía:**
    *   **Títulos:** `Lexend` (Moderno, legible)
    *   **Cuerpo:** `Roboto` (Estándar, claro)
*   **Layout:**
    *   Estructura flexible `Flexbox`.
    *   **Header Fijo:** Con título, badge de módulo y acciones globales.
    *   **Sidebar de Navegación:** Estilo explorador de archivos con breadcrumbs.
    *   **Área de Visor:** Espacio amplio y limpio para previsualización de documentos.

## 🏗️ Arquitectura del Componente

El submódulo mantiene su arquitectura basada en **Iframe** para aislamiento y seguridad, pero con una estructura interna renovada:

### Archivos Modificados

1.  **`modules/recursos/responsable-sg/responsable-sg-view.html`**
    *   **Cambio:** Reemplazo total del DOM.
    *   **Nueva Estructura:**
        *   `<header class="app-header">`: Barra superior con controles de cierre y descarga.
        *   `<aside class="sidebar">`: Panel lateral para navegación de carpetas y lista de archivos.
        *   `<main class="viewer-stage">`: Contenedor principal con Toolbar contextual y Iframe de visualización.

2.  **`modules/recursos/responsable-sg/responsable-sg-view.css`**
    *   **Cambio:** Reescritura completa usando variables CSS (`:root`).
    *   **Detalles:** Implementación de estilos para botones `btn-ghost`, `btn-primary`, iconos de tipo de archivo, y estados de carga (`loading-overlay`).

3.  **`modules/recursos/responsable-sg/responsable-sg-viewer.js`**
    *   **Cambio:** Actualización de la lógica de renderizado del DOM.
    *   **Mejoras:**
        *   Integración de controles de Zoom (`+`, `-`, `Ancho`).
        *   Navegación por historial (`goBack`).
        *   Iconografía dinámica según extensión de archivo.
        *   Corrección de manejo de strings con *backticks* para plantillas HTML.

4.  **`modules/recursos/responsable-sg/responsable-sg-logic.js`**
    *   **Estado:** Sin cambios lógicos mayores. Mantiene la comunicación `postMessage` con el proceso principal de Electron (`main.js`).

## 🚀 Funcionalidades Clave

*   **Navegación Jerárquica:** Exploración de carpetas y subcarpetas con ruta de migas de pan (Breadcrumbs).
*   **Previsualización:** Soporte visual para PDF (nativo) y conversión automática de Word/Excel a PDF para vista previa.
*   **Barra de Herramientas:** Controles de Zoom y ajuste de vista específicos para el documento activo.
*   **Feedback Visual:** Notificaciones toast (`.notification`) para confirmar acciones (descarga, impresión) o reportar errores.
*   **Manejo de Errores:** Pantallas de "Estado Vacío" y mensajes de error amigables cuando un archivo no puede visualizarse.

## 📸 Notas de Implementación

*   La comunicación con el backend (lectura de archivos, conversión) sigue utilizando el puente seguro `window.electronAPI` a través de mensajes.
*   Se ha priorizado la **claridad inmediata** y la **reducción de carga cognitiva**, eliminando elementos visuales innecesarios.
*   Este diseño sirve como **plantilla base** para futuras actualizaciones de otros visualizadores documentales en el sistema.

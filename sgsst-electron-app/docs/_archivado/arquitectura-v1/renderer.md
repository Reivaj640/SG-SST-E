# Sistema de Renderizado

## Descripción

El sistema de renderizado es responsable de mostrar dinámicamente los módulos y submódulos disponibles para cada empresa según su escenario normativo asignado.

## Componentes del Sistema

### 1. Motor de Renderizado
- `renderer.js`: Componente principal que coordina el renderizado
- Lee la configuración normativa
- Determina qué módulos mostrar

### 2. Componentes de Vista
- Archivos HTML para cada módulo/submódulo
- Archivos CSS para estilos específicos
- Archivos JavaScript para lógica de presentación

### 3. Componentes Reutilizables
- `afiliacion-component.js`
- `curso-virtual-component.js`
- Otros componentes genéricos

## Flujo de Renderizado

1. Carga la información de la empresa
2. Obtiene el escenario normativo asignado
3. Lee las reglas normativas desde archivos JSON
4. Determina qué módulos y submódulos deben activarse
5. Renderiza los componentes correspondientes
6. Aplica estilos y comportamientos específicos

## Personalización

El sistema permite:
- Activar/desactivar módulos según normativa
- Mostrar diferentes vistas según el escenario
- Adaptar la interfaz al tamaño de la empresa
- Cambiar comportamientos según el nivel de riesgo

## Integración con el Motor Normativo

El sistema de renderizado se integra con el motor normativo para:
- Obtener configuraciones dinámicas
- Aplicar reglas específicas por escenario
- Actualizar la interfaz según cambios normativos

## 🎨 Evolución de la Interfaz Visual (Sistema K+AIR)

A partir de Enero 2026, se ha iniciado la implementación del **Sistema de Diseño K+AIR** para modernizar la experiencia de usuario.

### Referencia de Implementación: 1.1.1 Responsable del SG
Este submódulo sirve como la implementación de referencia ("Gold Standard") para la nueva arquitectura visual:
- **Layout Moderno:** Header fijo, Sidebar de navegación y Área de contenido limpia.
- **Estilos:** Variables CSS centralizadas (`:root`), paleta de colores institucional y tipografía Lexend/Roboto.
- **Componentes:** Botones *ghost*, toolbars contextuales y feedback visual mediante notificaciones.

Para más detalles sobre esta implementación específica, consultar: [Actualización de Interfaz: 1.1.1 Responsable del SG](ui-update-responsable-sg.md).
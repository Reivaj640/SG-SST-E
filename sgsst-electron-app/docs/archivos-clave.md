# Archivos Clave del Sistema SG-SST

## Descripción

Este documento detalla los archivos fundamentales del sistema SG-SST que son esenciales para el funcionamiento de la aplicación Electron.

## main.js - Proceso Principal

### Función
El archivo `main.js` es el proceso principal de la aplicación Electron. Es el punto de entrada de la aplicación y gestiona todos los aspectos del lado del sistema operativo.

### Responsabilidades Principales

1. **Creación de Ventanas**
   - Crea la ventana principal de la aplicación
   - Configura dimensiones, iconos y preferencias de la ventana
   - Maneja el ciclo de vida de la ventana

2. **Manejo de Eventos Inter-Proceso (IPC)**
   - Define handlers para comunicación entre procesos
   - Maneja solicitudes del renderer para operaciones del sistema
   - Procesa eventos como selección de directorios, guardado de archivos, etc.

3. **Integración con Python**
   - Detección robusta de instalaciones de Python
   - Ejecución de scripts Python para mapeo de directorios
   - Gestión de entornos virtuales de Python

4. **Gestión de Actualizaciones**
   - Implementación de actualizaciones automáticas con electron-updater
   - Sistema de logging para actualizaciones
   - Manejo de errores en el proceso de actualización

5. **Manejo de Archivos Excel**
   - Lectura y procesamiento de archivos Excel
   - Integración con librerías como xlsx y ExcelJS
   - Manejo de diferentes formatos y hojas de cálculo

6. **Sistema de Logging**
   - Logging centralizado con electron-log
   - Envío de mensajes al renderer
   - Manejo de diferentes niveles de log

7. **Manejo de Configuración**
   - Carga y guardado de configuración de la aplicación
   - Gestión de rutas de empresas y estructuras de directorios
   - Persistencia de datos del usuario

## preload.js - Punto de Entrada Seguro

### Función
El archivo `preload.js` actúa como un puente seguro entre el proceso renderer (web) y el proceso main (sistema operativo), exponiendo selectivamente APIs de Electron al renderer.

### Responsabilidades Principales

1. **Comunicación Segura**
   - Define APIs seguras para el renderer
   - Previene acceso directo a funcionalidades del sistema operativo
   - Implementa canales de comunicación IPC

2. **Exposición Controlada de APIs**
   - Exposición selectiva de funcionalidades de Electron
   - Prevención de accesos no autorizados al sistema
   - Gestión de permisos y seguridad

3. **Manejo de Eventos**
   - Escucha eventos del proceso main
   - Envía eventos al renderer
   - Gestión de mensajes entre procesos

4. **Funcionalidades Comunes**
   - Acceso a sistema de archivos
   - Operaciones de directorios
   - Manejo de rutas y estructuras de datos

## renderer.js - Lógica del Renderizado

### Función
El archivo `renderer.js` es el proceso de renderizado de Electron que gestiona la interfaz de usuario, la navegación entre módulos y submódulos, y la comunicación con el proceso principal.

### Responsabilidades Principales

1. **Gestión de la Interfaz de Usuario**
   - Renderizado dinámico de módulos y submódulos según escenario normativo
   - Navegación entre diferentes secciones de la aplicación
   - Gestión del estado de la interfaz (empresa actual, módulo actual, submódulo actual)

2. **Sistema de Módulos y Submódulos**
   - Definición de la estructura de módulos y submódulos disponibles
   - Filtrado de módulos según escenario normativo aplicable
   - Gestión de la jerarquía de navegación (módulo → submódulo)

3. **Integración con el Sistema Normativo**
   - Carga y aplicación de reglas normativas desde JSON
   - Determinación del escenario normativo según datos de la empresa
   - Activación/desactivación de módulos y submódulos según normativa

4. **Comunicación con Main Process**
   - Uso de IPC para operaciones del sistema
   - Gestión de eventos entre procesos
   - Sincronización de estado entre procesos

5. **Componentes de UI**
   - Implementación de vistas para diferentes módulos
   - Gestión de componentes específicos para submódulos
   - Integración con componentes externos (calendarios, etc.)

## index.html - Estructura Principal

### Función
El archivo `index.html` es la página principal de la aplicación que define la estructura de la interfaz de usuario y carga los componentes necesarios.

### Responsabilidades Principales

1. **Estructura de la Interfaz**
   - Define la estructura base de la aplicación
   - Organiza la barra lateral, área de contenido y cabecera
   - Gestiona la distribución de elementos visuales

2. **Carga de Recursos**
   - Carga estilos CSS
   - Incluye scripts JavaScript
   - Integra librerías externas

3. **Barra Lateral**
   - Muestra los módulos disponibles
   - Implementa navegación entre módulos
   - Gestión de estado activo/inactivo

4. **Área de Contenido Dinámico**
   - Espacio donde se cargan los módulos y submódulos
   - Actualización dinámica según selección del usuario
   - Integración con componentes JavaScript

5. **Cabecera de la Aplicación**
   - Muestra información de la empresa seleccionada
   - Incluye logo y nombre de la empresa
   - Proporciona contexto al usuario

6. **Sistema de Logs**
   - Área para visualización de mensajes del sistema
   - Registro de operaciones y eventos
   - Facilita la depuración y monitoreo

## Integración entre Archivos

### Flujo de Ejecución
1. **index.html** se carga y establece la estructura de la UI
2. **preload.js** se ejecuta y establece la comunicación segura
3. **main.js** crea la ventana y gestiona el proceso principal
4. **renderer.js** gestiona la interfaz de usuario y la navegación
5. Los componentes del renderer se comunican con main.js a través de preload.js

### Patrones de Comunicación
- **Renderer → Preload → Main**: Solicitudes de operaciones del sistema
- **Main → Preload → Renderer**: Respuestas y eventos del sistema
- **Main ↔ Renderer**: Comunicación bidireccional a través de IPC

## Consideraciones de Seguridad

- El archivo `preload.js` es crucial para la seguridad de la aplicación
- Todas las operaciones del sistema deben pasar por el proceso main
- El renderer no debe tener acceso directo a APIs del sistema operativo
- Se deben validar todas las entradas desde el renderer antes de procesarlas en main.js

## Mantenimiento

- Cualquier cambio en la comunicación entre procesos debe reflejarse en ambos lados
- Las nuevas funcionalidades del sistema deben implementarse en main.js
- Las nuevas APIs disponibles para el renderer deben exponerse a través de preload.js
- El archivo index.html debe mantenerse actualizado con las dependencias necesarias
- El archivo renderer.js debe mantenerse actualizado con la lógica de interfaz y navegación
- La información sobre las fases de reorganización está consolidada en el archivo ESTADO_ACTUAL_REORGANIZACION.md
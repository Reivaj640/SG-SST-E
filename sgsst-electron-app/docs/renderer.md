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
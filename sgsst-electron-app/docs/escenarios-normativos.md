# Escenarios Normativos

## Definición

Los escenarios normativos son configuraciones que definen qué módulos y requisitos debe cumplir una empresa según su tamaño, tipo de actividad y nivel de riesgo.

## Categorías de Escenarios

### Por Tamaño de Empresa
- **Microempresas (1-10 trabajadores)**
- **Pequeñas empresas (11-50 trabajadores)**
- **Medianas empresas (51-200 trabajadores)**
- **Grandes empresas (201+ trabajadores)**

### Por Nivel de Riesgo
- **Riesgo 1**: Mínimo
- **Riesgo 2**: Bajo
- **Riesgo 3**: Medio
- **Riesgo 4**: Alto
- **Riesgo 5**: Muy alto

## Escenarios Disponibles

### Básico
- BÁSICO_1-10_R1-3: Empresas de 1-10 trabajadores con riesgos 1-3
- BÁSICO_1-10_R4-5: Empresas de 1-10 trabajadores con riesgos 4-5

### Intermedio
- INTERMEDIO_11-50_R1-3: Empresas de 11-50 trabajadores con riesgos 1-3
- INTERMEDIO_11-50_R4-5: Empresas de 11-50 trabajadores con riesgos 4-5

### Avanzado
- AVANZADO_51-200_R1-3: Empresas de 51-200 trabajadores con riesgos 1-3
- AVANZADO_51-200_R4-5: Empresas de 51-200 trabajadores con riesgos 4-5

## Asignación de Escenarios

Los escenarios se asignan automáticamente según:
- Número de trabajadores
- Nivel de riesgo del CIIU
- Actividad económica

## Gestión de Escenarios

Los escenarios se definen en archivos JSON y se pueden:
- Crear nuevos escenarios
- Modificar existentes
- Activar/desactivar según necesidades
# Motor Normativo

## Descripción

El motor normativo es el componente central del sistema SG-SST que permite aplicar diferentes escenarios normativos a las empresas según su tamaño, actividad y riesgos.

## Funcionamiento

El motor normativo se basa en archivos JSON que definen:

- Escenarios normativos
- Módulos y submódulos obligatorios
- Requisitos específicos por escenario
- Condiciones de activación

## Estructura de un Escenario Normativo

```json
{
  "nombre": "BÁSICO_1-10_R1-3",
  "descripcion": "Escenario básico para empresas de 1-10 trabajadores con riesgos 1-3",
  "modulos": [
    {
      "nombre": "Politica",
      "activo": true,
      "submodulos": [
        {
          "nombre": "Politica SG-SST",
          "activo": true
        }
      ]
    }
  ]
}
```

## Tipos de Escenarios

- BÁSICO: Para empresas pequeñas
- INTERMEDIO: Para empresas medianas
- AVANZADO: Para empresas grandes
- ESPECIALIZADO: Para actividades específicas

## Integración con Componentes

Los componentes de la aplicación se activan/desactivan según el escenario normativo asignado a cada empresa.
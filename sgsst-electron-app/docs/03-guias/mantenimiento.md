# Guía de Mantenimiento de Documentación - SG-SST

## 📋 Índice

1. [Introducción](#introducción)
2. [Documento Maestro del Proyecto](#documento-maestro-del-proyecto)
3. [Sistema de Documentación Automática](#sistema-de-documentación-automática)
4. [Flujo de Desarrollo con Documentación](#flujo-de-desarrollo-con-documentación)
5. [Cómo Documentar el Código](#cómo-documentar-el-código)
6. [Integración con el Ciclo de Vida del Desarrollo](#integración-con-el-ciclo-de-vida-del-desarrollo)
7. [Scripts Disponibles](#scripts-disponibles)
8. [Verificación de la Documentación](#verificación-de-la-documentación)
9. [Mejores Prácticas](#mejores-prácticas)

## Introducción

Esta guía explica cómo mantener la documentación del proyecto SG-SST actualizada y cómo integrarla en el flujo de desarrollo diario. El sistema implementado combina documentación automática (generada desde el código) con documentación funcional (descriptiva del sistema).

## Documento Maestro del Proyecto

Antes de realizar cualquier cambio en el sistema, es fundamental leer [_archivado/PROJECT_OVERVIEW.md](../_archivado/PROJECT_OVERVIEW.md). Este archivo contiene:

- Visión general del proyecto
- Decisiones arquitectónicas clave
- Reglas de cambio importantes
- Explicación del "por qué" del sistema

Este documento es el primero que debe leerse para entender el propósito y las restricciones del sistema.

## Sistema de Documentación Automática

El sistema de documentación consta de dos capas:

### 1. Documentación desde el código (JSDoc)
- Se genera automáticamente desde comentarios en el código fuente
- Se actualiza cada vez que se modifican los comentarios JSDoc
- Se encuentra en `docs/api/`

### 2. Documentación funcional
- Describe cómo funciona la aplicación desde el punto de vista del usuario
- Se mantiene manualmente en el directorio `docs/`
- Incluye archivos como `arquitectura.md`, `motor-normativo.md`, etc.

## Flujo de Desarrollo con Documentación

### Nuevo desarrollo o modificación

1. **Antes de comenzar**:
   - Revisa la documentación existente en `docs/` para entender el contexto
   - Asegúrate de que tu cambio esté alineado con la arquitectura actual

2. **Durante el desarrollo**:
   - Documenta todas las funciones nuevas con JSDoc
   - Actualiza los comentarios JSDoc de funciones existentes si cambias su comportamiento
   - Asegúrate de que los comentarios sean claros y precisos

3. **Después de completar el desarrollo**:
   - Ejecuta `npm run docs:generate` para actualizar la documentación de API
   - Si has cambiado funcionalidades visibles para el usuario, actualiza los archivos en `docs/`
   - Agrega una entrada en `CHANGELOG.md` describiendo los cambios
   - Prueba que la documentación generada sea correcta

### Ejemplo de ciclo de desarrollo

```bash
# 1. Realizar cambios en el código
# (editar archivos .js con nuevos comentarios JSDoc)

# 2. Generar documentación actualizada
npm run docs:generate

# 3. Verificar que la documentación se generó correctamente
# (revisar archivos en docs/api/)

# 4. Actualizar documentación funcional si es necesario
# (editar archivos en docs/)

# 5. Actualizar CHANGELOG.md
# (agregar entrada para los cambios realizados)

# 6. Confirmar cambios
git add .
git commit -m "feat: Agregar nueva funcionalidad con documentación"
```

## Cómo Documentar el Código

### Comentarios JSDoc

Cada función importante debe tener comentarios JSDoc que incluyan:

```javascript
/**
 * Descripción clara y concisa de lo que hace la función
 *
 * @param {Tipo} nombreParametro - Descripción del parámetro
 * @param {Tipo} otroParametro - Descripción de otro parámetro
 * @returns {Tipo} Descripción del valor retornado
 * @throws {TipoError} Condición que causaría el error
 */
function nombreFuncion(nombreParametro, otroParametro) {
  // Implementación
}
```

### Ejemplo completo

```javascript
/**
 * Renderiza los módulos y submódulos activos de una empresa
 * según el escenario normativo asignado.
 *
 * @param {Object} empresa - Objeto que representa la empresa
 * @param {string} empresa.escenario_normativo - El escenario normativo asignado a la empresa
 * @param {Object} reglasNormativas - Las reglas normativas aplicables al escenario
 * @returns {void}
 * @throws {Error} Si no se proporciona la empresa o las reglas normativas
 */
function renderizarModulosEmpresa(empresa, reglasNormativas) {
  if (!empresa || !reglasNormativas) {
    throw new Error('Empresa y reglas normativas son requeridas');
  }
  
  // Lógica de la función
}
```

### Clases y módulos

Para clases:

```javascript
/**
 * Representa un componente de gestión de afiliaciones
 * @class
 */
class AfiliacionComponent {
  /**
   * Crea una instancia de AfiliacionComponent
   * @param {Object} config - Configuración del componente
   */
  constructor(config) {
    // Implementación
  }
}
```

## Integración con el Ciclo de Vida del Desarrollo

### Hooks de Git (opcional)

Puedes configurar hooks de Git para verificar que la documentación se actualice:

1. Crea un archivo `.git/hooks/pre-commit`:

```bash
#!/bin/sh
# Verificar que la documentación se haya generado
npm run docs:generate
git add docs/api/
```

### Integración Continua

En tu sistema de CI/CD, puedes agregar un paso para:

1. Generar la documentación
2. Verificar que no haya errores en la generación
3. Publicar la documentación en un servidor web si es necesario

### Scripts de verificación

Puedes crear un script para verificar que la documentación esté actualizada:

```bash
# Verificar que no hay archivos JS sin documentar
# (esto dependerá de tus estándares específicos)
```

## Scripts Disponibles

### Generación de documentación

```bash
# Generar documentación de API una vez
npm run docs:generate

# Vigilar cambios y regenerar automáticamente
npm run docs:watch
```

### Scripts personalizados

Además de los scripts de npm, puedes usar directamente:

```bash
# Ejecutar el script de generación personalizado
node generate-docs.js
```

## Verificación de la Documentación

### Verificación manual

1. **Revisar documentación generada**:
   - Abre `docs/api/index.html` en un navegador
   - Verifica que las nuevas funciones aparezcan correctamente
   - Asegúrate de que los tipos y descripciones sean correctos

2. **Revisar documentación funcional**:
   - Lee los archivos en `docs/` para asegurar coherencia
   - Verifica que los nuevos cambios estén reflejados

### Verificación automática

Puedes crear un script para verificar que:

1. Todos los archivos JS tengan comentarios JSDoc en funciones importantes
2. La documentación se genere sin errores
3. No haya enlaces rotos en la documentación generada

## Mejores Prácticas

### Para comentarios JSDoc

1. **Sé descriptivo pero conciso**:
   - La primera línea debe ser una descripción clara de lo que hace la función
   - Usa lenguaje técnico preciso pero comprensible

2. **Documenta parámetros y retornos**:
   - Cada parámetro debe tener tipo y descripción
   - El valor de retorno debe estar claramente documentado

3. **Incluye ejemplos cuando sea útil**:
   ```javascript
   /**
    * Calcula el riesgo basado en el nivel y la exposición
    * @example
    * const riesgo = calcularRiesgo(3, 8); // Nivel 3, 8 horas de exposición
    * console.log(riesgo); // "MEDIO"
    */
   ```

### Para documentación funcional

1. **Mantén los archivos actualizados**:
   - Cada cambio significativo debe reflejarse en la documentación funcional
   - Usa el CHANGELOG.md para rastrear cambios importantes

2. **Estructura clara**:
   - Usa encabezados, listas y formato consistente
   - Incluye ejemplos prácticos cuando sea posible

3. **Enlaces internos**:
   - Conecta archivos relacionados dentro de la documentación
   - Usa rutas relativas para enlaces entre archivos de documentación

### Proceso de revisión

1. **Revisión por pares**:
   - Incluye revisión de documentación en el proceso de revisión de código
   - Asegúrate de que los compañeros de equipo revisen tanto el código como la documentación

2. **Actualización continua**:
   - No dejes la documentación para el final del desarrollo
   - Actualiza los comentarios JSDoc mientras escribes el código

### Mantenimiento a largo plazo

1. **Revisión periódica**:
   - Programa revisiones periódicas de la documentación
   - Verifica que la documentación coincida con el comportamiento actual del sistema

2. **Eliminación de código obsoleto**:
   - Elimina comentarios y documentación de funciones eliminadas
   - Actualiza referencias rotas en la documentación funcional

3. **Métricas de documentación**:
   - Considera herramientas para medir la cobertura de documentación
   - Establece estándares mínimos de documentación por tipo de función

## Conclusión

Este sistema de documentación automática asegura que tu proyecto SG-SST mantenga siempre una documentación actualizada y precisa. Al integrar la documentación en el flujo de desarrollo diario, se convierte en una parte natural del proceso de desarrollo y no en una tarea adicional.

Recuerda que una buena documentación no solo ayuda a nuevos desarrolladores a entender el sistema, sino que también sirve como referencia para el equipo actual y como base para que los modelos de IA comprendan el contexto completo de tu aplicación.
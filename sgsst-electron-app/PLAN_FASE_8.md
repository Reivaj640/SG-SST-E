# 📋 PLAN PARA LA FASE 8 - Reorganización del Submódulo Presupuesto

## 🎯 Objetivo
Aplicar el mismo proceso exitoso utilizado en los submódulos anteriores al submódulo "Presupuesto".

## 📦 Archivos a Reorganizar
- `presupuesto-gestion.js` → `modules/gestion-integral/presupuesto/presupuesto-logic.js`
- `presupuesto-selector.html` → `modules/gestion-integral/presupuesto/presupuesto-selector.html` (si existe)
- `presupuesto-gestion.html` → `modules/gestion-integral/presupuesto/presupuesto-gestion.html` (si existe)

## 🕵️ Verificación de Archivos

Primero, vamos a verificar qué archivos relacionados con presupuesto existen:

```bash
dir presupuesto*
```

## 🔄 Proceso a Seguir

### Paso 1: Preparación
1. Crear directorio `modules/gestion-integral/presupuesto/`
2. Crear archivo `modules/gestion-integral/presupuesto/index.js`

### Paso 2: Migración de Archivos
1. Copiar archivos a la nueva ubicación con nuevos nombres
2. Actualizar referencias internas entre archivos

### Paso 3: Actualización de Referencias
1. Actualizar `modules/gestion-integral/index.js` para incluir el nuevo submódulo
2. Actualizar `index.html` para cargar el archivo desde la nueva ubicación
3. Actualizar `jsdoc.json` y `generate-docs.js`

### Paso 4: Validación
1. Probar que el submódulo funcione correctamente
2. Verificar compatibilidad con el sistema existente

## 🧪 Consideraciones Específicas
- Asegurar que las rutas de iframe en el archivo logic.js apunten al nuevo HTML
- Verificar que el componente se exponga globalmente para compatibilidad con renderer.js
- Mantener la convención de nomenclatura establecida

## ⚠️ Riesgos Potenciales
- Conflictos con referencias existentes en renderer.js
- Problemas de rutas relativas en los archivos HTML
- Incompatibilidades con el sistema de módulos existente

## ✅ Checklist de Validación
- [ ] Archivos migrados correctamente
- [ ] Referencias actualizadas
- [ ] Componente disponible globalmente
- [ ] Funcionalidad del submódulo verificada
- [ ] Compatibilidad con sistema existente mantenida
- [ ] Documentación actualizada
# 📋 PLAN PARA LA FASE 5 - Reorganización del Submódulo Capacitación COPASST

## 🎯 Objetivo
Aplicar el mismo proceso exitoso utilizado en los submódulos anteriores al submódulo "Capacitación COPASST".

## 📦 Archivos a Reorganizar
- `capacitacion-copasst.js` → `modules/recursos/capacitacion-copasst/capacitacion-copasst-logic.js`
- `capacitacion-copasst-viewer.js` → `modules/recursos/capacitacion-copasst/capacitacion-copasst-viewer.js`
- `capacitacion-copasst-viewer.html` → `modules/recursos/capacitacion-copasst/capacitacion-copasst-view.html`
- `capacitacion-copasst-viewer.css` → `modules/recursos/capacitacion-copasst/capacitacion-copasst-view.css`

## 🔄 Proceso a Seguir

### Paso 1: Preparación
1. Crear directorio `modules/recursos/capacitacion-copasst/`
2. Crear archivo `modules/recursos/capacitacion-copasst/index.js`

### Paso 2: Migración de Archivos
1. Copiar archivos a la nueva ubicación con nuevos nombres
2. Actualizar referencias internas entre archivos

### Paso 3: Actualización de Referencias
1. Actualizar `modules/recursos/index.js` para incluir el nuevo submódulo
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
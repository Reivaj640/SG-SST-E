# 📋 PLAN PARA LA FASE 2 - Reorganización del Submódulo Roles y Responsabilidades

## 🎯 Objetivo
Aplicar el mismo proceso exitoso utilizado en el submódulo "Responsable del SG-SST" al submódulo "Roles y Responsabilidades".

## 📦 Archivos a Reorganizar
- `roles-responsabilidades-component.js` → `modules/recursos/roles-responsabilidades/roles-responsabilidades-logic.js`
- `roles-responsabilidades-viewer.js` → `modules/recursos/roles-responsabilidades/roles-responsabilidades-viewer.js`
- `roles-responsabilidades-viewer.html` → `modules/recursos/roles-responsabilidades/roles-responsabilidades-view.html`
- `roles-responsabilidades-viewer.css` → `modules/recursos/roles-responsabilidades/roles-responsabilidades-view.css`

## 🔄 Proceso a Seguir

### Paso 1: Preparación
1. Crear directorio `modules/recursos/roles-responsabilidades/`
2. Crear archivo `modules/recursos/roles-responsabilidades/index.js`

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
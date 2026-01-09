# 📋 PLAN PARA LA FASE 7 - Reorganización del Submódulo Curso Virtual 50 Horas

## 🎯 Objetivo
Aplicar el mismo proceso exitoso utilizado en los submódulos anteriores al submódulo "Curso Virtual 50 Horas".

## 📦 Archivos a Reorganizar
- `curso-50-horas.js` → `modules/gestion-integral/curso-50-horas/curso-50-horas-logic.js`
- `curso-virtual-component.js` → `modules/gestion-integral/curso-virtual/curso-virtual-logic.js`
- `curso-virtual-viewer.js` → `modules/gestion-integral/curso-virtual/curso-virtual-viewer.js`
- `curso-virtual-viewer.html` → `modules/gestion-integral/curso-virtual/curso-virtual-view.html` (si existe)
- `curso-virtual-viewer.css` → `modules/gestion-integral/curso-virtual/curso-virtual-view.css` (si existe)

## 🔄 Proceso a Seguir

### Paso 1: Preparación
1. Crear directorio `modules/gestion-integral/curso-virtual/`
2. Crear archivo `modules/gestion-integral/curso-virtual/index.js`

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

## 🕵️ Verificación de Archivos Adicionales

Primero, vamos a verificar si existen los archivos HTML y CSS para este módulo:

```bash
dir curso-virtual*
```

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
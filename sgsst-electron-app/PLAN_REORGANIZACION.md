# Plan de Reorganización del Proyecto SG-SST

## 🎯 Objetivo
Reorganizar la estructura de archivos del proyecto SG-SST para mejorar la mantenibilidad, escalabilidad y claridad del código, manteniendo la funcionalidad actual intacta.

## ✅ Aprobación
Este plan ha sido aprobado para ejecución. Si estuviera en un comité técnico, pasaría sin observaciones mayores.

## 📋 Fases de Implementación

### Fase 1: Preparación
1. **Copia de seguridad** completa del proyecto
2. **Crear estructura de directorios** con archivos `index.js` por módulo
3. **Actualizar `renderer.js`** para usar el sistema modular

### Fase 2: Migración Incremental
1. **Mover un submódulo** (por ejemplo, responsable-sg) como prueba
2. **Actualizar referencias** solo para ese submódulo
3. **Probar funcionalidad** específica
4. **Repetir** para otros submódulos

### Fase 3: Refinamiento
1. **Optimizar `renderer.js`** para que delegue carga de vistas
2. **Implementar sistema de helpers** para rutas
3. **Validar completamente** la aplicación

### Fase 4: Limpieza
1. **Eliminar archivos redundantes** si todo funciona
2. **Actualizar documentación** para reflejar nueva estructura
3. **Actualizar scripts** de automatización si es necesario

## 📦 Estructura Propuesta

```
sgsst-electron-app/
├── main.js
├── preload.js
├── renderer.js
├── index.html
├── package.json
├── package-lock.json
├── README.md
├── CHANGELOG.md
├── .gitignore
├── jsdoc.json
├── generate-docs.js
├── assets/
├── docs/
├── dist/
├── logs/
├── modules/
│   ├── recursos/
│   │   ├── index.js ← Nuevo
│   │   ├── responsable-sg/
│   │   │   ├── index.js ← Nuevo
│   │   │   ├── responsable-sg-logic.js
│   │   │   ├── responsable-sg-viewer.js
│   │   │   ├── responsable-sg-view.html
│   │   │   └── responsable-sg-view.css
│   │   ├── roles-responsabilidades/
│   │   │   ├── index.js ← Nuevo
│   │   │   ├── roles-responsabilidades-logic.js
│   │   │   ├── roles-responsabilidades-viewer.js
│   │   │   ├── roles-responsabilidades-view.html
│   │   │   └── roles-responsabilidades-view.css
│   │   ├── afiliacion/
│   │   │   ├── index.js ← Nuevo
│   │   │   ├── afiliacion-logic.js
│   │   │   ├── afiliacion-viewer.js
│   │   │   ├── afiliacion-view.html
│   │   │   └── afiliacion-view.css
│   │   └── [otros submódulos]
│   ├── gestion-integral/
│   │   ├── index.js ← Nuevo
│   │   └── [submódulos]
│   ├── gestion-salud/
│   │   ├── index.js ← Nuevo
│   │   └── [submódulos]
│   ├── gestion-riesgos/
│   ├── gestion-amenazas/
│   ├── verificacion/
│   └── mejoramiento/
├── components/
├── utils/
└── Portear/
```

## 🛠️ Implementación de Helpers Seguros

### Helper para carga de vistas (según recomendación)
```javascript
// modules/helpers/viewLoader.js
const fs = require('fs');
const path = require('path');

function loadView(modulePath, viewFile) {
  const fullPath = path.join(__dirname, '..', modulePath, viewFile);
  return fs.readFileSync(fullPath, 'utf-8');
}

module.exports = { loadView };
```

## 📌 Regla de Orquestación para renderer.js

`renderer.js` no sabe qué archivos existen, solo sabe qué módulo pedir:

```javascript
// Ejemplo ideal:
modules.recursos.responsableSg.render(container, context);
```

No:
```javascript
// No hacer:
loadView('modules/recursos/responsable-sg/archivo.html');
```

## ⚠️ Qué NO Tocar (Importante)

- No cambiar lógica funcional
- No refactorices algoritmos
- No optimices rendimiento
- No "aproveches" para mejorar UX
- Solo estructura. Todo lo demás después.

## 🧪 Orden Ideal de Migración

1. recursos/responsable-sg
2. recursos/roles-responsabilidades
3. recursos/afiliacion
4. resto de Recursos
5. Gestión Integral
6. Gestión Salud
7. Riesgos
8. Amenazas
9. Verificación
10. Mejoramiento

## 🏁 Conclusión

Este plan reduce la deuda técnica, baja el riesgo real, mejora la mantenibilidad, prepara la app para crecer y mantiene la funcionalidad actual intacta.
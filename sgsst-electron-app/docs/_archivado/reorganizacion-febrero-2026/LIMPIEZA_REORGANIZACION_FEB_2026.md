# 🧹 Limpieza y Reorganización del Proyecto - Febrero 2026

**Fecha:** 24 de febrero de 2026  
**Responsable:** Product Architect & Full-Stack Team  
**Versión afectada:** K+AIR v1.x → v2.0 (reestructuración)

---

## 📋 Resumen Ejecutivo

Se realizó una limpieza profunda de la raíz del proyecto para mejorar la organización, mantenibilidad y coherencia arquitectónica de la aplicación K+AIR.

### Objetivos logrados:
1. ✅ Mover todos los archivos `*-home.js` a sus respectivas carpetas de módulo
2. ✅ Mover archivos de ausentismo al módulo correspondiente
3. ✅ Eliminar código legacy obsoleto (`init-modular-system.js`, `compat/`)
4. ✅ Actualizar todas las referencias en `index.html`
5. ✅ Preservar historial en `backup_archivos_originales/`

---

## 📦 Archivos Movidos (Total: 11 archivos)

### Módulo: Gestión Integral
| Archivo Original | Nueva Ubicación |
|-----------------|-----------------|
| `gestion-integral-home.js` | `modules/gestion-integral/gestion-integral-home.js` |

### Módulo: Recursos
| Archivo Original | Nueva Ubicación |
|-----------------|-----------------|
| `recursos-home.js` | `modules/recursos/recursos-home.js` |

### Módulo: Gestión de la Salud
| Archivo Original | Nueva Ubicación |
|-----------------|-----------------|
| `gestion-salud-home.js` | `modules/gestion-salud/gestion-salud-home.js` |
| `medicion-ausentismo-home.js` | `modules/gestion-salud/ausentismo/medicion-ausentismo-home.js` |
| `medicion-ausentismo.js` | `modules/gestion-salud/ausentismo/medicion-ausentismo.js` |
| `registrar-ausentismo.js` | `modules/gestion-salud/ausentismo/registrar-ausentismo.js` |
| `medicion-ausentismo-home.html` | `modules/gestion-salud/ausentismo/medicion-ausentismo-home.html` |

### Módulo: Gestión de Peligros y Riesgos
| Archivo Original | Nueva Ubicación |
|-----------------|-----------------|
| `gestion-peligros-home.js` | `modules/gestion-peligros/gestion-peligros-home.js` |

### Módulo: Gestión de Amenazas
| Archivo Original | Nueva Ubicación |
|-----------------|-----------------|
| `gestion-amenazas-home.js` | `modules/gestion-amenazas/gestion-amenazas-home.js` |

### Módulo: Verificación
| Archivo Original | Nueva Ubicación |
|-----------------|-----------------|
| `verificacion-home.js` | `modules/verificacion/verificacion-home.js` |

### Módulo: Mejoramiento
| Archivo Original | Nueva Ubicación |
|-----------------|-----------------|
| `mejoramiento-home.js` | `modules/mejoramiento/mejoramiento-home.js` |

---

## 🗑️ Archivos Eliminados (Código Legacy)

### 1. `init-modular-system.js`
**Ubicación original:** Raíz del proyecto  
**Nueva ubicación:** `backup_archivos_originales/init-modular-system.js`

**Motivo de eliminación:**
- Era un archivo de inicialización para un sistema de módulos CommonJS que **no funciona en el contexto renderer** de Electron
- Solo inicializaba objetos vacíos (`window.modules = {}`)
- Los componentes reales se cargan directamente vía `<script>` tags
- No hay uso real de `window.modules` en el código principal

**Impacto:** Nulo - El código era dead code

**Referencias eliminadas:**
- `index.html` línea 105: `<script src="init-modular-system.js"></script>`
- `examples/views/prueba_modular.html` (ejemplo de desarrollo)

---

### 2. `utils/compat/compat-responsable-sg.js`
**Ubicación original:** `utils/compat/compat-responsable-sg.js`  
**Nueva ubicación:** `backup_archivos_originales/compat-responsable-sg.js`

**Motivo de eliminación:**
- Archivo de compatibilidad que **nunca se cargaba** en la aplicación
- Solo estaba referenciado en documentación
- El componente `ResponsableSgComponent` se carga directamente desde `modules/recursos/responsable-sg/responsable-sg-logic.js`

**Impacto:** Nulo - El archivo nunca se usaba

**Carpeta resultante:** `utils/compat/` fue eliminada (quedó vacía)

---

## 📝 Archivos Actualizados

### `index.html`
**Cambios realizados:**

1. **Línea 105:** Eliminada referencia a `init-modular-system.js`
```html
<!-- ANTES -->
<script src="scripts/theme-manager.js"></script>
<script src="init-modular-system.js"></script>
<!-- Cargar los componentes -->

<!-- DESPUÉS -->
<script src="scripts/theme-manager.js"></script>
<!-- Cargar los componentes -->
```

2. **Líneas 128-131:** Actualizadas rutas de scripts de ausentismo
```html
<!-- ANTES -->
<script src="medicion-ausentismo.js"></script>
<script src="modules/gestion-salud/ausentismo/medicion-ausentismo-home.js"></script>
<script src="registrar-ausentismo.js"></script>

<!-- DESPUÉS -->
<script src="modules/gestion-salud/ausentismo/medicion-ausentismo.js"></script>
<script src="modules/gestion-salud/ausentismo/medicion-ausentismo-home.js"></script>
<script src="modules/gestion-salud/ausentismo/registrar-ausentismo.js"></script>
```

3. **Líneas 107-125:** Actualizadas rutas de todos los `*-home.js`
```html
<!-- ANTES -->
<script src="gestion-integral-home.js"></script>
<script src="recursos-home.js"></script>
<script src="gestion-salud-home.js"></script>
...

<!-- DESPUÉS -->
<script src="modules/gestion-integral/gestion-integral-home.js"></script>
<script src="modules/recursos/recursos-home.js"></script>
<script src="modules/gestion-salud/gestion-salud-home.js"></script>
...
```

---

### `modules/gestion-salud/ausentismo/medicion-ausentismo.js`
**Cambio realizado:**

**Línea 64:** Actualizada ruta del iframe
```javascript
// ANTES
iframe.src = 'medicion-ausentismo-home.html';

// DESPUÉS
iframe.src = 'modules/gestion-salud/ausentismo/medicion-ausentismo-home.html';
```

**Motivo:** El archivo HTML fue movido a la misma carpeta, pero la ruta relativa necesita ser explícita desde el contexto del renderer.

---

## ✅ Verificación de Funcionamiento

### Contratos Backend Verificados
Todos los contratos IPC entre renderer y main process permanecen **intactos**:

| Contrato | Handler en main.js | Usado por | Estado |
|----------|-------------------|-----------|--------|
| `get-ausentismo-data` | Línea 2878 | `medicion-ausentismo.js` | ✅ Funcional |
| `procesar-ausentismo` | Línea 3309 | `registrar-ausentismo.js` | ✅ Funcional |
| `buscar-empleado-por-cedula` | Línea 3114 | `registrar-ausentismo.js` | ✅ Funcional |
| `buscar-cie10-descripcion` | Línea 3174 | `registrar-ausentismo.js` | ✅ Funcional |
| `getRecursosStats` | N/A (genérico) | `recursos-home.js` | ✅ Funcional |

### Componentes Globales Verificados
Todos los componentes se exponen correctamente en `window`:

| Componente | Archivo | Expuesto como | Estado |
|------------|---------|---------------|--------|
| `MedicionAusentismoComponent` | `medicion-ausentismo.js` | `window.MedicionAusentismoComponent` | ✅ Funcional |
| `RegistrarAusentismoComponent` | `registrar-ausentismo.js` | `window.RegistrarAusentismoComponent` | ✅ Funcional |
| `GestionIntegralHome` | `gestion-integral-home.js` | `window.GestionIntegralHome` | ✅ Funcional |
| `RecursosHome` | `recursos-home.js` | `window.RecursosHome` | ✅ Funcional |
| `GestionSaludHome` | `gestion-salud-home.js` | `window.GestionSaludHome` | ✅ Funcional |

---

## 📊 Estado Final del Proyecto

### Raíz del proyecto (limpia)
```
sgsst-electron-app/
├── .gitignore
├── development-styles.css
├── docker-compose.yml
├── icon-config.json
├── index.html              ← Actualizado
├── main.js
├── package-lock.json
├── package.json
├── preload.js
├── README.md
├── renderer.js
└── styles.css
```

### Módulos organizados
```
modules/
├── gestion-integral/
│   ├── gestion-integral-home.js        ← Movido
│   ├── index.js
│   ├── evaluacion-inicial-sg-sst/
│   ├── objetivos-sst/
│   ├── plan-trabajo/
│   ├── politica/
│   └── rendicion-cuentas/
│
├── recursos/
│   ├── recursos-home.js                ← Movido
│   ├── index.js
│   ├── afiliacion/
│   ├── capacitacion-copasst/
│   ├── capacitaciones/
│   ├── comite-convivencia/
│   ├── copasst/
│   ├── curso-virtual/
│   ├── inducciones/
│   ├── presupuesto/
│   ├── responsable-sg/
│   ├── roles-responsabilidades/
│   └── trabajo-alto-riesgo/
│
├── gestion-salud/
│   ├── gestion-salud-home.js           ← Movido
│   ├── index.js
│   ├── ausentismo/                     ← Todos los archivos de ausentismo
│   │   ├── medicion-ausentismo.js          ← Movido + Actualizado
│   │   ├── medicion-ausentismo-home.js     ← Movido
│   │   ├── medicion-ausentismo-home.html   ← Movido
│   │   ├── registrar-ausentismo.js         ← Movido
│   │   ├── index.js
│   │   ├── ver-ausentismo-dashboard.html
│   │   └── ver-ausentismo-logic.js
│   ├── evaluaciones-medicas/
│   ├── investigacion-accidentes/
│   ├── reportes-accidentes/
│   ├── restricciones-medicas/
│   └── sociodemografica/
│
├── gestion-peligros/
│   └── gestion-peligros-home.js        ← Movido
│
├── gestion-amenazas/
│   └── gestion-amenazas-home.js        ← Movido
│
├── verificacion/
│   └── verificacion-home.js            ← Movido
│
└── mejoramiento/
    └── mejoramiento-home.js            ← Movido
```

### Backup (historial preservado)
```
backup_archivos_originales/
├── init-modular-system.js              ← Legacy (no usar)
├── compat-responsable-sg.js            ← Legacy (no usar)
└── [otros archivos históricos...]
```

---

## 🔍 Pruebas Realizadas

### 1. ✅ Carga de la aplicación
- La aplicación inicia sin errores en consola
- No hay errores de carga de scripts en DevTools
- El sidebar y menú se renderizan correctamente

### 2. ✅ Módulo Recursos
- `RecursosHome` carga correctamente
- Widgets de inducciones, capacitaciones y EPP funcionan
- Gráficos de Chart.js se inicializan
- Contrato `getRecursosStats` responde correctamente

### 3. ✅ Módulo Ausentismo
- `MedicionAusentismoComponent` carga correctamente
- Portal de bienvenida (iframe) carga desde la nueva ruta
- Formulario de registro funciona
- Contratos IPC de ausentismo responden:
  - `buscar-empleado-por-cedula` ✅
  - `buscar-cie10-descripcion` ✅
  - `procesar-ausentismo` ✅
  - `readAusentismoData` ✅

### 4. ✅ Navegación entre módulos
- Cambiar entre módulos no produce errores
- Los componentes home de cada módulo cargan correctamente
- No hay colisiones de CSS ni JavaScript

---

## ⚠️ Consideraciones Importantes

### Para desarrolladores futuros

1. **NO usar `window.modules`**
   - El sistema de módulos CommonJS fue eliminado
   - Los componentes se acceden directamente desde `window.NombreComponente`

2. **Rutas relativas en iframes**
   - Cuando se use un iframe dentro de un módulo, la ruta debe ser relativa a la raíz del proyecto
   - Ejemplo: `iframe.src = 'modules/gestion-salud/ausentismo/medicion-ausentismo-home.html'`

3. **Componentes globales**
   - Todos los componentes se exponen en `window` para acceso global
   - Esto es intencional para mantener compatibilidad con el sistema actual

4. **Backup de archivos legacy**
   - Los archivos en `backup_archivos_originales/` NO deben usarse
   - Son solo para referencia histórica o rollback en caso de emergencia

---

## 📈 Beneficios Obtenidos

| Beneficio | Descripción |
|-----------|-------------|
| **Organización** | Cada módulo contiene todo su código relacionado |
| **Mantenibilidad** | Más fácil encontrar y modificar archivos |
| **Claridad** | La raíz del proyecto está limpia y ordenada |
| **Coherencia** | Todos los módulos siguen la misma estructura |
| **Historial** | Backup preservado para rollback si es necesario |
| **Rendimiento** | Menos archivos en la raíz = menor tiempo de escaneo |

---

## 🚀 Próximos Pasos (Opcional)

1. **Refactorizar sistema de módulos** (futuro)
   - Implementar un sistema de módulos real (ES6 modules o webpack)
   - Eliminar dependencia de variables globales

2. **Limpieza de `utils/`**
   - Mover archivos Excel y PDF de ejemplo a una carpeta `examples/data/`
   - Dejar en `utils/` solo código utilitario

3. **Documentación de contratos IPC**
   - Crear un documento centralizado de todos los handlers IPC
   - Incluir ejemplos de uso y parámetros

---

## 📞 Contacto

Para preguntas sobre esta reorganización:
- Revisar este documento primero
- Consultar `README.md` para estructura del proyecto
- Revisar `backup_archivos_originales/` para código legacy

---

**Documento creado:** 24 de febrero de 2026  
**Última actualización:** 24 de febrero de 2026  
**Versión:** 1.0

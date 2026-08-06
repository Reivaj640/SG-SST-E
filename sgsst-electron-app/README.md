# K+AIR - Sistema de Gestión SG-SST

**Versión:** 0.1.157 (próximo) — publicado v0.1.146
**Última actualización:** 6 de agosto de 2026
**Autor:** Javier Robles F. Prof. SG-SST - Esp. Gerencia de Proyectos

---

## 📋 Descripción General

**K+AIR** es una aplicación empresarial Electron que implementa un Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) completo, diseñado para cumplir con la normativa colombiana (Resolución 0312 de 2019).

### Características Principales

- ✅ **Bandeja Integrada: Cliente Gmail Completo** 🆕 (v0.1.120, `📦563`): Cliente de correo profesional integrado con OAuth + SQLite cache + Gmail-look UI + 7 features. Búsqueda con operadores (`from:javier`, `has:adjunto`), adjuntos reales descargables, firma automática, sync bidireccional con Gmail, auto-refresh cada 5 min, BEM refactor con 4 componentes (`email-row`, `thread-header`, `quoted-thread`, `compose-panel` minimizable). Coexiste con K+AIR Calendar. Ver `AGENTS.md` (sección "🆕 Bandeja Integrada") para el detalle.
- ✅ **Menú nativo de Electron oculto** 🆕 (v0.1.130, `📦579`): La barra de menú de Windows (File / Edit / View / Window / Help) ya no se muestra por defecto. En desarrollo aparece con la tecla **Alt**; en producción está oculta totalmente. La app se ve limpia y profesional tipo SaaS (Discord, Slack, VSCode). Ver `AGENTS.md` (sección "🆕 Menú nativo de Electron oculto") para el detalle.
- ✅ **Update UX completo** 🆕 (v0.1.131, `📦581`): Sistema de actualizaciones rediseñado estilo Claude, no invasivo. Botón-dot en el footer (OCULTO al día, azul con pulse cuando hay update, verde con halo cuando está descargado). Click en el dot abre el dropdown anclado arriba del footer. Modal "Información de actualizaciones" con badge de estado + versión instalada + última versión + última verificación + release notes de GitHub. Panel "Actualizaciones" en Configuración. Sin toasts invasivos. Ver `AGENTS.md` (sección "🆕 Update UX") para el detalle.
- ✅ **Release flow automatizado** 🆕 (v0.1.131+, `📦585`): Scripts `scripts/release.ps1` (flujo completo: push branch → tag → push tag → build) y `scripts/fix-release.ps1` (fallback con curl si electron-builder falla). Evitan el error 422 de "Published releases must have a valid tag". Ver `AGENTS.md` (sección "🆕 Release flow automatizado") para el detalle.
- ✅ **Multi-empresa**: Gestión de múltiples empresas con una sola experiencia UX/UI
- ✅ **Motor Normativo Inteligente**: Escenarios normativos basados en tamaño y riesgo
- ✅ **9 Módulos Principales + 48 Submódulos con lógica**: Recursos (12), Gestión Integral (9), Salud (12), Peligros (4), Amenazas (2), Verificación (3), Mejoramiento (4), más `helpers` y `shared`
- ✅ **IA Integrada**: Análisis de accidentes con LLM (Mistral 3 3B)
- ✅ **Seguimiento PRIC**: Gestión completa de casos de incapacidad y rehabilitación
- ✅ **Calificación PCL Dual**: Secciones separadas para Calificación Regional y Nacional (14 campos)
- ✅ **Sistema Dual de Archivos**: PI-FO-076 (lista general) + PRI.xlsx (seguimiento)
- ✅ **Alertas Inteligentes**: Detección de registros duplicados con modal interactivo
- ✅ **Cálculos Automáticos**: Edad, IMC, Estado Nutricional, Días Trabajados, Antigüedad, Días Acumulados de Incapacidad
- ✅ **Seguimientos Múltiples**: Hasta 5 seguimientos por caso con fecha y descripción
- ✅ **Etapas de Reincorporación y Cierre**: Gestión completa de reincorporación laboral y cierre de casos
- ✅ **Diagnósticos Múltiples**: Hasta 3 diagnósticos CIE-10 por caso (DX principal + DX2 + DX3)
- ✅ **KPIs en Tiempo Real**: Actualización dinámica con filtros de año/mes
- ✅ **Inducciones con Sincronización Automática**: Google Forms → Excel → App sin intervención manual
- ✅ **Búsqueda Inteligente de Archivos**: Normalización de tildes y múltiples variaciones de nombres
- ✅ **COM Automation**: VBScript para controlar Excel y actualizar Power Query automáticamente
- ✅ **Sistema de Skeleton Screens** (v0.1.110): API `KairSkeleton.*` con 10 componentes que reemplazan spinners genéricos por placeholders que imitan la forma del componente. Cubierto en 25 loaders en 13 vistas + 7 homes de módulo. Ver `AGENTS.md` (sección "🎨 Sistema de Skeleton Screens") para el detalle.
- ✅ **Solo 13 archivos en raíz**: Proyecto limpio y organizado
- ✅ **Tabla de Ausentismo 17 Columnas**: Año, Fecha Inicio, Fecha Fin, Código
- ✅ **Filtros Dinámicos Inteligentes**: Año y tipo basados en datos reales
- ✅ **Información de Mapeo**: Fecha y tipo de mapeo en tarjetas de empresas
- ✅ **Portales de Bienvenida (Antesalas)**: Interfaz moderna tipo portal para submódulos clave
- ✅ **Sistema de Notificaciones Toast**: Notificaciones modernas no intrusivas
- ✅ **Modales Modernizados**: Diseño centrado, animaciones suaves, UX mejorada
- ✅ **Detección Automática de Año Activo**: El sistema detecta automáticamente el año más reciente
- ✅ **Autenticación de Usuarios**: Login obligatorio por sesión con control de acceso
- ✅ **Stats extendidas de Ausentismo** 🆕 (v0.1.110): 16 métricas calculadas en una sola pasada (Tasa Ausentismo, Índice Frecuencia, Índice Severidad, Tasa Accidentalidad, Top 10 por días/casos/CIE-10, heatmap día-semana × mes, etc.)
- ✅ **Roles por Empresa** 🆕: Asignación de perfiles por empresa (incluye Recursos Humanos)
- ✅ **Base de Datos Local (SQLite)** 🆕: Persistencia de usuarios, roles, sesiones y asignaciones
- ✅ **Alerta de Afiliación SSSI** 🆕: Detección automática de planillas faltantes del mes en curso
- ✅ **Dashboard con Filtros por Módulo** 🆕: Panel lateral interactivo con resaltado de módulo activo
- ✅ **Sidebar Inteligente** 🆕: Limpieza automática de estado activo al cambiar de empresa/módulo
- ✅ **Visualizadores Modernizados (9 submódulos)** 🆕: Drag&Drop, menú contextual, toast, modal confirmación

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    K+AIR Electron App                    │
├─────────────────────────────────────────────────────────┤
│  RENDERER (Frontend)                                    │
│  ├── index.html (Estructura principal)                  │
│  ├── renderer.js (Lógica de UI - 5869 líneas)           │
│  ├── styles.css (Sistema Visual Oficial)                │
│  └── modules/ (27 submódulos organizados)               │
├─────────────────────────────────────────────────────────┤
│  PRELOAD (Puente Seguro)                                │
│  └── preload.js (143 contratos IPC expuestos)           │
├─────────────────────────────────────────────────────────┤
│  MAIN (Backend Electron)                                │
│  └── main.js (143 handlers IPC - 17254 líneas)          │
├─────────────────────────────────────────────────────────┤
│  DATABASE                                                │
│  └── SQLite (kair.db) en app.getPath('userData')         │
├─────────────────────────────────────────────────────────┤
│  PYTHON (Portear/)                                      │
│  ├── llm_server.py (Servidor Flask puerto 5555)         │
│  ├── accident_processor.py (Procesamiento PDF)          │
│  └── [15+ scripts especializados]                       │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura del Proyecto

### Raíz del Proyecto (13 archivos)

| Archivo                  | Líneas | Propósito                  |
|--------------------------|--------|----------------------------|
| `index.html`             | 143    | Punto de entrada HTML      |
| `main.js`                | 17254  | Proceso principal Electron |
| `preload.js`             | 445    | Puente IPC seguro          |
| `renderer.js`            | 5869   | Lógica de renderizado      |
| `styles.css`             | ~2500  | Estilos globales           |
| `development-styles.css` | ~500   | Estilos desarrollo         |
| `package.json`           | 85     | Configuración npm          |
| `package-lock.json`      | -      | Bloqueo dependencias       |
| `README.md`              | -      | Este archivo               |
| `docker-compose.yml`     | -      | Configuración Docker       |
| `icon-config.json`       | -      | Configuración iconos       |

### Módulos Principales (8 módulos)

```
modules/
├── gestion-integral/          # Módulo 2: Política, Objetivos, Evaluación
│   ├── gestion-integral-home.js
│   ├── index.js
│   ├── evaluacion-inicial-sg-sst/
│   ├── objetivos-sst/
│   ├── plan-trabajo/
│   ├── politica/
│   └── rendicion-cuentas/
│
├── recursos/                  # Módulo 1: Responsable, Roles, Capacitación
│   ├── recursos-home.js
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
├── gestion-salud/             # Módulo 3: Evaluaciones, Accidentes, Ausentismo
│   ├── gestion-salud-home.js
│   ├── index.js
│   ├── ausentismo/            # 3.3.6 Medición del ausentismo
│   ├── evaluaciones-medicas/  # 3.1.4 Evaluaciones médicas
│   ├── incidencia-enfermedad-laboral/ # 3.3.5 Incidencia de enf. laboral 🆕
│   ├── investigacion-accidentes/ # 3.2.2 Investigación accidentes
│   ├── prevalencia-enfermedad-laboral/ # 3.3.4 Prevalencia de enf. laboral 🆕
│   ├── reportes-accidentes/   # 3.2.1 Reporte accidentes
│   ├── restricciones-medicas/ # 3.1.6 Restricciones médicas
│   └── sociodemografica/      # 3.1.1 Diagnóstico sociodemográfico
│
├── gestion-peligros/          # Módulo 4: Identificación de peligros
│   └── gestion-peligros-home.js
│
├── gestion-amenazas/          # Módulo 5: Plan de emergencias
│   └── gestion-amenazas-home.js
│
├── verificacion/              # Módulo 6: Auditorías, Indicadores
│   └── verificacion-home.js
│
├── mejoramiento/              # Módulo 7: Acciones correctivas
│   └── mejoramiento-home.js
│
└── helpers/                   # Utilidades del sistema
    └── viewLoader.js
```

### Directorios Adicionales

| Directorio                     | Propósito                                       |
|--------------------------------|-------------------------------------------------|
| `assets/`                      | Iconos, imágenes y recursos gráficos            |
| `backup_archivos_originales/`  | Respaldo histórico (67 archivos)                |
| `components/`                  | Componentes reutilizables (config, seguimiento) |
| `docs/`                        | Documentación completa (137 archivos)           |
| `examples/`                    | Ejemplos de código y vistas de prueba           |
| `logs/`                        | Registros de la aplicación                      |
| `Portear/`                     | Módulo Python con 15+ scripts especializados    |
| `scripts/`                     | Scripts de utilidad (generar docs, temas)       |
| `test/`                        | Archivos de prueba                              |
| `utils/`                       | Utilidades y archivos de soporte                |

---

## 🚀 Instalación y Configuración

### Requisitos del Sistema

| Componente          | Versión Mínima | Recomendada     | Crítico |
|---------------------|----------------|-----------------|---------|
| **Node.js**         | 18.x           | 20.x            | ✅ Sí - Para desarrollo |
| **Python**          | 3.10           | 3.11-3.12       | ⚠️ **Incluido en installer** |
| **Microsoft Office**| 2016+          | 365             | ⚠️ Solo Word para convertir DOCX→PDF |
| **RAM**             | 8 GB           | 16 GB           | ✅ Sí |
| **Almacenamiento**  | 2 GB           | 5 GB SSD        | ✅ Sí |
| **CUDA** (opcional) | 12.x           | Para IA con GPU | ❌ No - Solo para LLM con GPU |

### ⚠️ IMPORTANTE: Python Incluido

**La aplicación K+AIR AHORA INCLUYE Python 3.11 empaquetado.**

✅ **Ventajas:**
- No necesitas instalar Python manualmente
- Todas las funciones están disponibles inmediatamente
- Versión de Python controlada y compatible

⚠️ **Excepciones (instalar Python manualmente solo si):**
- Quieres usar tu propia instalación de Python
- Hay errores con Python empaquetado (fallback automático)

### Instalación Paso a Paso (Desarrollo)

```bash
# 1. Clonar repositorio
git clone https://github.com/Reivaj640/SG-SST-E.git
cd SG-SST-E

# 2. Instalar dependencias Node.js
npm install

# 2.1. Recompilar better-sqlite3 si hay error NODE_MODULE_VERSION
# (solo si aparece el mensaje en consola)
npm rebuild better-sqlite3 --runtime=electron --target=37.3.0 --disturl=https://electronjs.org/headers

# 3. Configurar entorno virtual Python
cd Portear
python -m venv .venv

# 4. Activar entorno virtual
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# 5. Instalar dependencias Python
pip install -r requirements.txt

# 6. Volver al directorio raíz
cd ..

# 7. Ejecutar aplicación
npm start
```

### Comandos Disponibles

```bash
# Ejecutar aplicación
npm start

# Modo desarrollo con recarga automática
npm run dev

# Depuración
npm run debug         # Debug completo
npm run debug-main    # Solo proceso principal
npm run debug-full    # Debug extendido

# Construir para distribución
npm run build         # Plataforma actual
npm run build:win     # Windows
npm run build:mac     # macOS
npm run build:linux   # Linux

# Generar documentación
npm run docs:generate  # Generar documentación API
npm run docs:watch     # Vigilar cambios y regenerar
```

---

## 🔐 Autenticación y Usuarios

### Resumen
- **Login obligatorio en cada arranque** (no se reutilizan sesiones anteriores).
- **Asignación de empresas y roles por usuario** desde Configuración.
- **Roles actuales**: Administrador, SST, Auditoría, Gerencia, Recursos Humanos.
- **Base de datos local**: `kair.db` en `app.getPath('userData')`.

### Usuario Admin Inicial
- **Correo:** `admin@kair.local`
- **Clave:** `Admin123!`

---

## 📊 Módulos y Funcionalidades

### Módulo 1: Recursos (11 submódulos)

| Código | Submódulo                 | Archivos Principales                                |
|--------|---------------------------|-----------------------------------------------------|
| 1.1.1  | Responsable del SG        | `responsable-sg-logic.js`, `viewer.js`, `view.html` |
| 1.1.2  | Roles y Responsabilidades | `roles-responsabilidades-logic.js`, `viewer.js`     |
| 1.1.3  | Asignación de Recursos    | `presupuesto-logic.js`, `presupuesto-gestion.html`  |
| 1.1.4  | Afiliación al SSSI 🆕     | `afiliacion-logic.js`, `viewer.js` - **Detección automática de planillas faltantes** |
| 1.1.5  | Trabajo de Alto Riesgo    | `trabajo-alto-riesgo-logic.js`, `viewer.js`         |
| 1.1.6  | Conformación de Copasst   | `copasst-logic.js`, `viewer.js`                     |
| 1.1.7  | Capacitación al Copasst   | `capacitacion-copasst-logic.js`, `viewer.js`        |
| 1.1.8  | Comité de Convivencia     | `comite-convivencia-logic.js`, `viewer.js`          |
| 1.2.1  | Programa de Capacitación  | `capacitaciones-logic.js`, `capacitaciones-viewer.js`, `capacitaciones-portal-logic.js` 🆕, `cap-home.html` 🆕, `cap-home.js` 🆕 |
| 1.2.2  | Inducción y Reinducción   | `inducciones-logic.js`, `viewer.js`                 |
| 1.2.3  | Curso Virtual 50 Horas    | `curso-virtual-logic.js`, `viewer.js`               |
| 1.2.4  | Manual SST Proveedores    | `manual-proveedores-logic.js`, `viewer.js` 🆕       |

### 🆕 Visualizadores Modernizados (v0.1.93)

**Descripción:** Sistema unificado de gestión documental con funciones modernas replicadas en 9 submódulos.

**Submódulos Actualizados:**
| Código | Submódulo | Funciones Implementadas |
|--------|-----------|------------------------|
| 1.1.1 | Responsable SG | ✅ Drag&Drop, ✅ Context Menu, ✅ Toast, ✅ Confirm Modal |
| 1.1.2 | Roles y Responsabilidades | ✅ Drag&Drop, ✅ Context Menu, ✅ Toast, ✅ Confirm Modal |
| 1.1.4 | Afiliación al SSSI | ✅ Drag&Drop, ✅ Context Menu, ✅ Toast, ✅ Confirm Modal |
| 1.1.5 | Trabajo de Alto Riesgo | ✅ Drag&Drop, ✅ Context Menu, ✅ Toast, ✅ Confirm Modal |
| 1.1.6 | Conformación de Copasst | ✅ Drag&Drop, ✅ Context Menu, ✅ Toast, ✅ Confirm Modal |
| 1.1.7 | Capacitación al Copasst | ✅ Drag&Drop, ✅ Context Menu, ✅ Toast, ✅ Confirm Modal |
| 1.1.8 | Comité de Convivencia | ✅ Drag&Drop, ✅ Context Menu, ✅ Toast, ✅ Confirm Modal |
| 1.2.3 | Curso Virtual 50 Horas | ✅ Drag&Drop, ✅ Context Menu, ✅ Toast, ✅ Confirm Modal |
| 1.2.4 | Manual SST Proveedores | ✅ Drag&Drop, ✅ Context Menu, ✅ Toast, ✅ Confirm Modal |

**Funciones Implementadas:**

1. **Drag & Drop de Archivos** 🆕
   - Overlay visual con ícono animado bounce
   - Subida automática de archivos soltados
   - Manejo de múltiples archivos simultáneos
   - Feedback con notificaciones toast

2. **Menú Contextual (Clic Derecho)** 🆕
   - Menú flotante con opciones:
     - 📂 Abrir archivo
     - 🗑️ Eliminar archivo
   - Posicionamiento inteligente (no sale de pantalla)
   - Cierre con clic fuera o tecla Escape

3. **Modal de Confirmación Moderno** 🆕
   - Diseño centrado con animación slideUp
   - Header amarillo con ícono de advertencia
   - Nombre del archivo en caja destacada
   - Botones Cancelar / Eliminar estilizados

4. **Notificaciones Toast Modernas** 🆕
   - 4 tipos: success, error, warning, info
   - Iconos FontAwesome por tipo
   - Auto-eliminación con animación fade-out (300ms)
   - Contenedor en esquina superior derecha

5. **Abrir Archivo con Aplicación Predeterminada** 🆕
   - Opción en menú contextual
   - Usa `electronAPI.open-file`
   - Manejo de errores específico (EPERM, ENOENT, EACCES)

**Archivos Modificados por Submódulo:**

| Archivo | Líneas agregadas | Funciones |
|---------|-----------------|-----------|
| `[submodulo]-view.html` | ~40 | contextMenu, confirmModal, kToastContainer |
| `[submodulo]-view.css` | ~280 | Estilos para modales, toast, drag&drop |
| `[submodulo]-viewer.js` | ~450 | Todas las funciones modernas |

**Funciones JavaScript Agregadas:**

```javascript
// Drag & Drop
- setupDragAndDrop()
- setupFolderDragAndDrop(folderElement, folderPath)
- preventDefaults(e)
- handleDragOver(e)
- uploadFile(file, folderPath)
- fileToBase64(file)

// Context Menu
- showContextMenu(x, y, doc)
- hideContextMenu()
- deleteDocument()
- setupContextMenu()
- openFile()

// Toast Notifications
- showToast(message, type, duration)

// Confirm Modal
- showConfirmModal(fileName, callback)
- hideConfirmModal()
- acceptConfirm()
- cancelConfirm()
- setupConfirmModal()
```

**Funciones Actualizadas:**

| Función | Cambio |
|---------|--------|
| `setupEventListeners()` | Ahora llama a `setupDragAndDrop()` y `setupContextMenu()` |
| `renderFolders()` | Agrega clase 'folder' y llama a `setupFolderDragAndDrop()` |
| `renderDocuments()` | Agrega evento 'contextmenu' para clic derecho |

**Validación Esperada:**

| Acción | Resultado esperado |
|--------|-------------------|
| Arrastrar archivo → carpeta | Overlay aparece, archivo se sube, toast success |
| Clic derecho en archivo | Menú contextual con "Abrir" y "Eliminar" |
| Click en "Eliminar" | Modal moderno con nombre del archivo |
| Click en "Cancelar" | Modal se cierra sin acción |
| Click en "Eliminar" (modal) | Archivo eliminado, toast success, lista recargada |
| Click en "Abrir archivo" | Archivo se abre con aplicación predeterminada |

### 🆕 Módulo 1.1.4 - Afiliación al SSSI (v0.1.92)

**Descripción:** Sistema de detección automática de planillas de afiliación al SSSI faltantes del mes en curso.

**Archivos Principales:**
- `afiliacion-logic.js` - Lógica del componente viewer
- `afiliacion-viewer.js` - Wrapper del componente viewer
- `afiliacion-view.html` - Vista del explorador de archivos
- `afiliacion-view.css` - Estilos del viewer

**Características Implementadas:**
- ✅ **Detección Automática**: Busca archivos PDF/XLSX con "planilla" en el nombre
- ✅ **Validación por Mes**: Compara mes actual vs mes en nombre del archivo
- ✅ **Alerta en Dashboard**: Muestra alerta crítica si no hay planilla del mes en curso
- ✅ **Widget en Recursos**: Muestra estado "Al día" o "Pendiente" con último mes registrado
- ✅ **Logs de Depuración**: Registra detalladamente archivos encontrados y estado

**Funcionamiento:**
```javascript
// Backend (main.js)
calculateAfiliacionStats() {
  // 1. Buscar carpeta 1.1.4 Afiliación al SSSI
  // 2. Filtrar archivos con "planilla" en nombre
  // 3. Extraer mes del nombre (ej: "planilla_marzo_2026.pdf")
  // 4. Comparar con mes actual
  // 5. Generar alerta si no coincide
}

// Frontend (recursos-home.js)
calculateAfiliacionClientSide() {
  // 1. Leer archivos en carpeta
  // 2. Filtrar planillas
  // 3. Detectar mes más reciente
  // 4. Actualizar widget con estado
}
```

**Alertas Generadas:**
| Estado | Mensaje | Prioridad |
|--------|---------|-----------|
| Sin planilla del mes | "No se encontró planilla de [mes] [año]" | Crítica |
| Planilla encontrada | "Afiliación SSSI: Al día" | Informativo |

**Widget en Recursos:**
- Muestra total de planillas registradas
- Indica mes actual y último mes registrado
- Badge verde "Al día" o rojo "Pendiente"
- Diseño consistente con widget de presupuesto

### 🆕 Módulo 1.2.1 - Programa de Capacitaciones (Actualizado v0.1.71)

**Archivos Principales:**
- `capacitaciones-logic.js` - Lógica del componente viewer (tabla de capacitaciones)
- `capacitaciones-viewer.js` - Wrapper del componente viewer
- `capacitaciones-portal-logic.js` 🆕 - Componente portal de bienvenida (antesala)
- `cap-home.html` 🆕 - Interfaz del portal de bienvenida
- `cap-home.js` 🆕 - Lógica del portal
- `capacitaciones-view.html` - Vista de la tabla de capacitaciones (modales modernizados)
- `capacitaciones-view.css` - Estilos modernizados (modales centrados)

**Características Implementadas:**
- ✅ **Portal de Bienvenida (Antesala)**: Interfaz moderna tipo portal similar a Plan de Trabajo (2.4.1)
- ✅ **Clonar Cronograma**: Duplica hojas dentro del mismo archivo Excel (Matriz Cap. YYYY → Matriz Cap. YYYY+1)
- ✅ **Detección Automática de Año Activo**: El sistema detecta automáticamente el año más reciente en las hojas del Excel
- ✅ **Notificaciones Toast Modernas**: Reemplazan los `alert()` nativos por notificaciones no intrusivas
- ✅ **Modales Modernizados**: Diseño centrado, animaciones suaves, header/footer con fondo gris claro
- ✅ **Soporte para Archivos .xlsx**: La función de clonado requiere formato .xlsx (Excel 2007+)

**Flujo de Navegación:**
```
Menú Principal → 1.2.1 Programa de Capacitaciones
                ↓
        [Portal cap-home.html]
        - Ver Cronograma → Viewer existente
        - Importar desde Excel
        - Clonar Cronograma → Nueva hoja Matriz Cap. (Año+1)
        - Exportar, Matriz de Formación, etc.
```

**Funciones Clave:**
| Función | Descripción |
|---------|-------------|
| `cloneCronograma()` | Clona la hoja del año actual al siguiente año, reseteando fechas y estados |
| `loadActiveYear()` | Detecta automáticamente el año más reciente en las hojas disponibles |
| `showNotification()` | Muestra notificaciones toast modernas (success, danger, warning, info) |
| `enterViewer()` | Navega al viewer de capacitaciones existente |

**Requisitos:**
- 📄 Formato de archivo: `.xlsx` (requerido para clonado de hojas)
- 📊 Estructura de hojas: `Matriz Cap. YYYY` (ej: `Matriz Cap. 2025`, `Matriz Cap. 2026`)
- 🔄 Función backend: `duplicate-capacitaciones-sheet` (main.js)

### Módulo 2: Gestión Integral (6 submódulos)

| Código | Submódulo                      | Archivos Principales                                     |
|--------|--------------------------------|----------------------------------------------------------|
| 2.1.1  | Política del SG-SST            | `politica-logic.js`, `viewer.js`, `onlyoffice-bridge.js` |
| 2.2.1  | Objetivos SST                  | `objetivos-sst-logic.js`, `viewer.js`                    |
| 2.3.1  | Evaluación Inicial SG-SST      | `evaluacion-inicial-sg-sst-logic.js`, `test.html`        |
| 2.4.1 | Plan de Trabajo Anual | `plan-trabajo-logic.js`, `plan-home.js`, `plan-home.html`, `plan-viewer.js`, `plan-view.html`, `plan-view.css` |
| 2.5.1  | Archivo y Retención Documental | En `renderer.js`                                         |
| 2.6.1  | Rendición de Cuentas           | `rendicion-logic.js`, `viewer.js`                        |

### Módulo 3: Gestión de la Salud (8 submódulos)

| Código | Submódulo                    | Archivos Principales                                   |
|--------|------------------------------|--------------------------------------------------------|
| 3.1.1  | Diagnóstico Sociodemográfico | `sociodemografica-component.js`, `viewer.js`           |
| 3.1.4  | Evaluaciones Médicas         | `evaluaciones-medicas-logic.js`, `component.js`        |
| 3.1.6  | Restricciones Médicas        | `restricciones-medicas-logic.js`, `component.js`       |
| 3.2.1  | Reporte de Accidentes        | `reportes-accidentes-logic.js`, `viewer.js`            |
| 3.2.2  | Investigación de Accidentes  | `investigacion-accidentes-logic.js`, `handlers.js`  🤖|
| 3.3.4  | Prevalencia de Enf. Laboral  | `prevalencia-enfermedad-laboral/` (4 archivos) 🆕      |
| 3.3.5  | Incidencia de Enf. Laboral   | `incidencia-enfermedad-laboral/` (4 archivos) 🆕       |
| 3.3.6  | Medición del Ausentismo      | `medicion-ausentismo.js`, `registrar-ausentismo.js`    |

### Módulos 4-7 (Resumen)

| Módulo                           | Submódulos  | Estado    |
|----------------------------------|-------------|-----------|
| 4. Gestión de Peligros y Riesgos | Home module | ✅ Activo |
| 5. Gestión de Amenazas           | Home module | ✅ Activo |
| 6. Verificación                  | Home module | ✅ Activo |
| 7. Mejoramiento                  | Home module | ✅ Activo |

---

## 🤖 Integración de Inteligencia Artificial

### Módulo de Investigación de Accidentes (3.2.2)

**Tecnología:**
- **Modelo LLM**: Mistral 3 3B Reasoning (multimodal)
- **Servidor**: Flask en puerto 5555
- **Metodología**: 5 Porqués con categorías 5M

**Flujo de Trabajo:**
```
1. Usuario sube PDF de accidente
   ↓
2. Python extrae datos (accident_processor.py)
   ↓
3. LLM analiza causas raíz (llm_server.py)
   ↓
4. Genera informe DOCX automático (accident_report_generator.py)
   ↓
5. Usuario descarga informe
```

**Archivos Clave:**
- `modules/gestion-salud/investigacion-accidentes/investigacion_handlers.js`
- `Portear/src/llm_server.py`
- `Portear/src/accident_processor.py`
- `Portear/src/accident_report_generator.py`

**Documentación Completa:**
- 📖 [docs/modulo-investigacion-accidentes.md](docs/modulo-investigacion-accidentes.md)

---

## 🏥 Módulo de Ausentismo y Seguimiento PRIC (3.3.6)

### Descripción General

El módulo de **Medición del Ausentismo** permite gestionar, registrar y hacer seguimiento a las incapacidades de los empleados, con detección automática de casos que requieren atención especial según criterios de la normativa SG-SST.

### Funcionalidades Principales

#### 1. Registro de Incapacidades
- ✅ Búsqueda automática de empleados por cédula
- ✅ Autocompletado de información laboral (cargo, área, empresa usuaria)
- ✅ Búsqueda de códigos CIE-10 con descripción
- ✅ Validación de pertenencia a la empresa
- ✅ Soporte para múltiples tipos de incapacidad:
  - Enfermedad General (EPS)
  - Accidente de Trabajo (ARL)
  - Enfermedad Laboral
  - Licencias (Maternidad, Paternidad, Luto)
  - Calamidad Doméstica

#### 2. Detección Automática de Casos en Seguimiento

El sistema identifica automáticamente empleados que cumplen **una de dos condiciones**:

| Condición       | Criterio                                          | Ejemplo                                                 |
|-----------------|---------------------------------------------------|---------------------------------------------------------|
| **Condición 1** | Incapacidad individual ≥ 10 días                  | Incapacidad de 15 días por cirugía                      |
| **Condición 2** | Suma de incapacidades ≥ 10 días con gaps ≤ 3 días | 3 incapacidades de 4, 3 y 5 días con 2 días entre ellas |

**Algoritmo de Detección:**
```javascript
// Pseudocódigo del algoritmo
1. Agrupar incapacidades por empleado (céedula)
2. Para cada empleado:
   a. Verificar si alguna incapacidad >= 10 días → Condición 1 CUMPLE
   b. Si no, sumar todas las incapacidades
   c. Verificar gaps entre incapacidades consecutivas
   d. Si suma >= 10 Y gaps <= 3 → Condición 2 CUMPLE
3. Mostrar en tabla de seguimiento solo empleados que cumplen condiciones
```

#### 3. Tabla de Seguimiento de Incapacidades

**Columnas:**
- Empleado (nombre + cédula)
- Tipo (EPS/ARL)
- Periodo (fechas inicio-fin)
- Avance (barra de progreso con días transcurridos)
- Estado (En curso / Próximo a vencer / Finalizado)
- Acciones (Ver detalles, Agregar nota, Adjuntar archivo)

**KPIs en Tiempo Real:**
- 📊 Casos Activos
- ⏳ Próximos a Vencer (< 2 días)
- 📄 Docs Pendientes
- ✅ Cerrados (Mes)

**Filtros Disponibles:**
- Buscar por nombre o cédula
- Estado (En curso, Próximo a vencer, Finalizado)
- Tipo (EPS, ARL)
- Año de inicio de incapacidad
- Mes de inicio de incapacidad

#### 3.1. Tabla de Ausentismo - Vista Completa 🆕

**Columnas de la Tabla (17 columnas):**

| # | Columna | Nombre Técnico | Índice | Ancho Máx. |
|---|---------|----------------|--------|------------|
| 1 | No | `no` | - | Auto |
| 2 | Nombre | `NOMBRE` | 2 | 180px |
| 3 | Cédula | `CEDULA` | 3 | Auto |
| 4 | Cargo | `CARGO` | 5 | 120px |
| 5 | Empresa Usuaria | `EMPRESA USUARIA` | 6 | 150px |
| 6 | Área/Dpto | `ÁREA O DPTO` | 7 | 120px |
| 7 | Género | `GENERO` | 8 | Auto |
| 8 | Mes | `MES` | 9 | Auto |
| 9 | N° Días | `N° DIAS DE INCAPACIDAD` | 10 | Auto |
| 10 | Clase | `CLASE DE INCAPACIDAD` | 11 | Auto |
| 11 | Tipo | `TIPO DE INCAPACIDAD` | 12 | 150px |
| 12 | Entidad | `ENTIDAD` | 13 | Auto |
| 13 | **Año** 🆕 | `AÑO` | 14 | Auto |
| 14 | **Fecha Inicio** 🆕 | `F. INICIO` | 15 | Auto |
| 15 | **Fecha Fin** 🆕 | `F. FIN` | 16 | Auto |
| 16 | **Código** 🆕 | `CODIGO` | 17 | Auto |
| 17 | Descripción | `DESCRIPCION` | 18 | 200px |

**Características de la Tabla:**
- ✅ **Scroll horizontal responsivo** - Se expande cuando hay espacio
- ✅ **Columnas sticky** - Header fijo al hacer scroll vertical
- ✅ **Hover effects** - Resalta fila al pasar el mouse
- ✅ **Text truncation** - Elipsis para texto largo con tooltip
- ✅ **Badges de colores** - Clase (EPS, ARL, Licencia) con colores distintivos

**Filtros Dinámicos:**

| Filtro | Funcionamiento |
|--------|----------------|
| **Buscar** | Nombre o cédula (búsqueda parcial) |
| **Año** | Todos los años presentes en datos (descendente) |
| **Mes** | 12 meses (Enero-Diciembre) |
| **Tipo** | Todos los tipos únicos de "CLASE DE INCAPACIDAD" |
| **Botones** | "Filtrar" y "Limpiar" |

#### 4. Modal de Detalles del Caso con Incapacidades Seleccionables 🆕

Al hacer clic en "Ver Detalles", se muestra un modal con:

**Características Nuevas:**
- ✅ **Checkboxes en todas las incapacidades** - Usuario puede seleccionar incapacidades específicas para seguimiento
- ✅ **Código CIE-10 y diagnóstico en TODAS las incapacidades** - No solo en la principal
- ✅ **Diseño visual mejorado** - Hover effects, transiciones suaves
- ✅ **Filtro de año aplicado** - Solo muestra incapacidades del año seleccionado

**Para Condición 1 (Incapacidad ≥ 10 días):**
- Encabezado con datos del empleado
- Lista de incapacidades ≥ 10 días con checkboxes
- Cada incapacidad muestra:
  - Checkbox de selección
  - Fechas de inicio y fin
  - Días de duración
  - Tipo (EPS/ARL/EMPRESA)
  - Estado (En curso/Próximo a vencer/Finalizado)
  - Código CIE-10 y descripción del diagnóstico

**Para Condición 2 (Suma ≥ 10 días con gaps ≤ 3):**
- Encabezado con datos del empleado
- Secuencia completa de incapacidades con checkboxes
- Cálculo y visualización de gaps entre incapacidades
- Total acumulado de días
- Código CIE-10 y diagnóstico de cada incapacidad

#### 5. Flujo de Selección de Casos 🆕

**Nuevo Comportamiento al hacer "Abrir Seguimiento":**

```
1. Click en "Abrir Seguimiento" desde modal de detalles
   ↓
2. Sistema busca registros existentes en PRI.xlsx por cédula
   ↓
3. Si hay registros → Modal "Registros Existentes Detectados"
   - Muestra lista de casos encontrados
   - Usuario selecciona caso existente → Panel abre con datos cargados
   - Usuario selecciona "Crear nuevo registro" → Panel abre vacío
   ↓
4. Si no hay registros → Panel abre directamente para crear nuevo
   ↓
5. Panel de gestión muestra TODAS las secciones con datos cargados
```

**Modal "Registros Existentes Detectados":**
- Muestra casos encontrados con: fecha, días, diagnóstico
- Indica cuál es el más reciente
- Botón "Crear nuevo registro" para caso nuevo
- Botón "Cancelar" para cerrar sin acción

#### 6. Formulario Maestro de Seguimiento PRIC Mejorado 🆕

**Mejoras Implementadas:**

| Mejora | Descripción |
|--------|-------------|
| **Cálculo automático de antigüedad** | Al ingresar fecha de ingreso, calcula años automáticamente |
| **Cálculo automático de días acumulados** | Al ingresar fechas de inicio/fin de incapacidad, calcula días totales |
| **Carga automática de CIE-10 y diagnóstico** | Desde la incapacidad seleccionada en el modal de detalles |
| **Sección de Seguimientos Múltiples** | Hasta 5 seguimientos con fecha y descripción, agregables dinámicamente |

**Nueva Sección: Seguimientos Múltiples**

```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Seguimientos                          [+ Agregar]       │
├─────────────────────────────────────────────────────────────┤
│ [Fecha] [Descripción del seguimiento..............] [🗑️]   │
│ [Fecha] [Descripción del seguimiento..............] [🗑️]   │
│ [Fecha] [Descripción del seguimiento..............] [🗑️]   │
└─────────────────────────────────────────────────────────────┘
```

**Funciones de Seguimientos:**
- Click "+ Agregar Seguimiento" → Agrega nueva fila con fecha y descripción
- Click "🗑️" → Elimina ese seguimiento específico
- Al guardar → Todos los seguimientos se indexan en PRI.xlsx

**Columnas de Indexación en PRI.xlsx:**

| Seguimiento | Fecha (Columna) | Índice | Descripción (Columna) | Índice |
|-------------|-----------------|--------|-----------------------|--------|
| 1           | AB              | 27     | AC                    | 28     |
| 2           | AD              | 29     | AE                    | 30     |
| 3           | AF              | 31     | AG                    | 32     |
| 4           | AH              | 33     | AI                    | 34     |
| 5           | AJ              | 35     | AK                    | 36     |

**Lógica de Actualización vs Creación:**

El sistema ahora usa **criterio inteligente** para determinar si actualiza o crea:

| Condición                                | Acción                           |
|------------------------------------------|----------------------------------|
| MISMA cédula + MISMAS fechas (fecha_fin) | ✅ ACTUALIZA registro existente |
| MISMA cédula + DIFERENTES fechas         | ✅ CREA NUEVO registro          |
| Cédula diferente                         | ✅ CREA NUEVO registro          |

Esto permite que un mismo empleado tenga **múltiples registros** en PRI.xlsx, uno por cada incapacidad diferente.

### Archivos Principales del Módulo

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `modules/gestion-salud/ausentismo/medicion-ausentismo.js` | ~4465 | Componente principal con seguimiento PRIC |
| `modules/gestion-salud/ausentismo/registrar-ausentismo.js` | ~1200 | Formulario de registro de incapacidades |
| `modules/gestion-salud/ausentismo/medicion-ausentismo-home.html` | ~300 | Portal de bienvenida del módulo |

### Estructura de Datos

**Objeto Empleado:**
```javascript
{
  cedula: "12345678",
  nombre: "Juan Pérez",
  cargo: "Operario de Producción",
  departamento: "Planta",
  empresaUsuaria: "Empresa SAS",
  genero: "Masculino",
  fechaNacimiento: "1985-05-15",  // 🆕
  fechaIngreso: "2020-01-10",      // 🆕
  incapacidades: [
    {
      fechaInicio: Date,
      fechaFin: Date,
      diasIncapacidad: 15,
      record: { /* datos crudos del Excel */ }
    }
  ]
}
```

**Datos de Seguimiento PRIC (Actualizado 🆕):**
```javascript
{
  trabajador: {
    nombre: "Juan Pérez",
    cedula: "12345678",
    fechaNacimiento: "1985-05-15",
    genero: "Masculino",
    cargo: "Operario",
    area: "Planta",
    fechaIngreso: "2020-01-10",
    antiguedad: 5,  // Calculado automáticamente
    tipoContrato: "Término Indefinido",
    salario: 1500000,
    eps: "Sanitas",
    afp: "Porvenir",
    tipoEvento: "Enfermedad General",
    tipoCargo: "Operativo"
  },
  incapacidad: {
    fechaInicio: "2025-02-01",
    fechaFin: "2025-02-28",
    diasAcumulados: 28,  // Calculado automáticamente
    clase: "EPS",
    codigoCie10: "S801",
    descripcionDiagnostico: "Contusión de pierna",
    numeroProrrogas: 0,
    // 🆕 Seguimientos múltiples (hasta 5)
    seguimientos: [
      {
        fecha: "2025-02-27",
        descripcion: "Revisión médica inicial"
      },
      {
        fecha: "2025-03-05",
        descripcion: "Seguimiento por terapia física"
      },
      {
        fecha: "2025-03-12",
        descripcion: "Evaluación de reincorporación"
      }
    ]
  },
  pric: { /* 5 etapas PRIC */ },
  calificacion: { /* datos de calificación PCL */ },
  recomendaciones: [
    {
      recomendacion: "Reposo absoluto 15 días",
      entidad: "ARL",
      fechaLimite: "2026-03-15",
      cumple: "SI",
      observacion: "Cumplido según certificado"
    }
  ]
}
```

### Criterios Normativos

El módulo se basa en los lineamientos de la **Resolución 0312 de 2019** para el seguimiento de incapacidades:

- **Seguimiento especial**: Incapacidades ≥ 10 días (origen común o laboral)
- **Secuencia de incapacidades**: Múltiples incapacidades con gaps ≤ 3 días que suman ≥ 10 días
- **Proceso PRIC**: Proceso de Rehabilitación y Reincorporación Laboral con 5 etapas estructuradas

**Documentación Completa:**
- 📖 [docs/modulo-ausentismo.md](docs/modulo-ausentismo.md) - **Tabla de 17 columnas y filtros dinámicos** 🆕
- 📖 [docs/informacion-mapeo.md](docs/informacion-mapeo.md) - **Información de mapeo en tarjetas** 🆕
- 📖 [docs/ARQUITECTURA_AUSENTISMO_DUAL.md](docs/ARQUITECTURA_AUSENTISMO_DUAL.md) - Sistema dual de archivos

---

## 🔌 Sistema de Comunicación IPC

### Contratos Principales (60+ handlers)

#### App & Configuración
| Método | Descripción |
|--------|-------------|
| `getAppVersion()` | Obtener versión de la aplicación |
| `getRecursosStats(companyName)` | Estadísticas de recursos |
| `saveConfig(config)` / `loadConfig()` | Guardar/Cargar configuración |
| `loadNormativa()` | Cargar normativa 0312 |

#### Autenticación y Usuarios (v1) 🆕
| Método | Descripción |
|--------|-------------|
| `authLoginV1(credentials)` | Login y creación de sesión |
| `authLogoutV1()` | Cerrar sesión |
| `companiesSyncV1()` | Sincronizar empresas config.json → DB |
| `usersListV1()` | Listar usuarios |
| `usersCreateV1(payload)` | Crear usuario |
| `usersUpdateV1(payload)` | Actualizar usuario |
| `usersDisableV1(id)` | Desactivar usuario |
| `assignmentsSetV1(payload)` | Asignar empresas y rol por usuario |
| `assignmentsListV1()` | Listar asignaciones del usuario autenticado |
| `assignmentsListByUserV1(userId)` | Listar asignaciones por usuario |

#### Sistema de Temas
| Método | Descripción |
|--------|-------------|
| `getSystemTheme()` | Obtener tema del SO |
| `saveThemePreference(themeMode)` | Guardar preferencia |
| `getEffectiveTheme()` | Obtener tema efectivo |

#### Archivos y Directorios
| Método | Descripción |
|--------|-------------|
| `selectDirectory()` | Seleccionar directorio |
| `mapDirectory(path)` | Mapear estructura con Python |
| `readDirectory(path)` | Leer contenido |
| `openPath(filePath)` | Abrir archivo/carpeta |

#### Excel y Documentos
| Método | Descripción |
|--------|-------------|
| `readExcelFile(filePath)` | Leer Excel |
| `updateCapacitacionesExcel(data)` | Actualizar capacitaciones |
| `convertExcelToPdf(filePath)` | Convertir Excel a PDF |
| `getPresupuestoFiles(companyName)` | Obtener archivos de presupuesto |

#### Ausentismo y Seguimiento PRIC
| Método | Descripción |
|--------|-------------|
| `readAusentismoData(companyName)` | Leer datos de ausentismo desde Excel (PI-FO-076 / PG-FO-076 / GI-FO-076) |
| `getPriSeguimientoData(companyName)` | Leer datos de seguimiento de casos desde PRI.xlsx (hoja "Casos en seguimiento") |
| `buscarEmpleadoPorCedula(cedula, empresa)` | Buscar empleado por cédula |
| `buscarCie10Descripcion(empresa, code)` | Buscar descripción CIE-10 |
| `procesarAusentismo(companyName, formData)` | Registrar nueva incapacidad |
| `saveFollowUp(followUpData, companyName)` | Guardar seguimiento de caso individual en PRI.xlsx (incluye hasta 5 seguimientos) |
| `buscarRegistrosCedula(cedula, companyName)` | 🆕 Buscar registros existentes por cédula en PRI.xlsx |
| `leerCasosPRI(companyName)` | 🆕 Leer todos los casos desde PRI.xlsx para selección |

**📖 Ver documentación completa:** [docs/ARQUITECTURA_AUSENTISMO_DUAL.md](docs/ARQUITECTURA_AUSENTISMO_DUAL.md)

#### Investigación de Accidentes
| Método | Descripción |
|--------|-------------|
| `selectAccidentPdf()` | Seleccionar PDF |
| `processAccidentPdf(path)` | Procesar PDF |
| `analyzeAccident(data)` | Analizar con LLM |
| `generateAccidentReport(data)` | Generar informe |

**Lista Completa:** 📖 [preload.js](preload.js) y 📖 [main.js](main.js)

---

## 🎨 Sistema Visual Oficial K+AIR

### Colores Corporativos

| Tipo | Color | Hex | Uso |
|------|-------|-----|-----|
| **Primario** | Azul K+AIR | `#174ea6` | Botones, enlaces, headers |
| **Hover** | Azul claro | `#185abd` | Hover de elementos primarios |
| **Éxito** | Verde | `#28a745` | Mensajes positivos, completados |
| **Advertencia** | Amarillo | `#ffc107` | Alertas, pendientes |
| **Peligro** | Rojo | `#dc3545` | Errores, urgencias |

### Fondos

| Elemento | Color | Hex |
|----------|-------|-----|
| App | Gris claro | `#f8f9fa` |
| Cards | Blanco | `#ffffff` |
| Bordes | Gris medio | `#dee2e6` |

### Componentes

- **Tarjetas**: Sombra sutil, bordes 0.375rem
- **Tipografía**: Segoe UI / Roboto
- **Jerarquía**: Títulos claros, contenido organizado

**Documentación UI:** 📖 [docs/ui-update-responsable-sg.md](docs/ui-update-responsable-sg.md)

---

## 📚 Documentación

### Documentación Funcional

| Archivo | Descripción |
|---------|-------------|
| [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) | Visión general y decisiones arquitectónicas |
| [docs/arquitectura.md](docs/arquitectura.md) | Detalles de arquitectura del sistema |
| [docs/ARQUITECTURA_AUSENTISMO_DUAL.md](docs/ARQUITECTURA_AUSENTISMO_DUAL.md) | **🆕 Sistema dual de archivos (PI-FO-076 y PRI.xlsx)** |
| [docs/motor-normativo.md](docs/motor-normativo.md) | Funcionamiento del motor normativo |
| [docs/escenarios-normativos.md](docs/escenarios-normativos.md) | Escenarios normativos aplicables |
| [docs/flujo-creacion-empresa.md](docs/flujo-creacion-empresa.md) | Proceso de creación de empresa |
| [docs/renderer.md](docs/renderer.md) | Sistema de renderizado |
| [docs/modulo-investigacion-accidentes.md](docs/modulo-investigacion-accidentes.md) | Módulo de investigación con IA |
| [docs/LIMPIEZA_REORGANIZACION_FEB_2026.md](docs/LIMPIEZA_REORGANIZACION_FEB_2026.md) | Última reorganización (Feb 2026) |

### Documentación de API (JSDoc)

La documentación de API se genera automáticamente desde los comentarios JSDoc:

```bash
# Generar documentación
npm run docs:generate

# Vigilar cambios y regenerar automáticamente
npm run docs:watch
```

**Ubicación:** `docs-api/` (se regenera cada vez que se corre el comando) — NO se commitea

### Estado del Proyecto

| Archivo | Descripción |
|---------|-------------|
| [CHANGELOG.md](CHANGELOG.md) | Historial completo de cambios por versión |
| [CONTEXT.md](CONTEXT.md) | Contexto del proyecto para IAs y nuevos devs |
| [AGENTS.md](AGENTS.md) | Convenciones, arquitectura y features clave |

---

## 🧪 Pruebas y Depuración

### Comandos de Depuración

```bash
# Depuración completa
npm run debug

# Solo proceso principal
npm run debug-main

# Depuración extendida
npm run debug-full
```

### Archivos de Test

| Archivo | Propósito |
|---------|-----------|
| `test/test-jsdoc.js` | Pruebas de generación JSDoc |
| `test/test-module-cards.js` | Pruebas de tarjetas de módulo |
| `test/test_remision_utils.py` | Pruebas de utilidades de remisión |

### Logs

Los registros de la aplicación se encuentran en:
- `logs/dev_log.txt` - Log de desarrollo
- `main.js` usa `electron-log` para logging centralizado

---

## 📦 Distribución

### Configuración de Build

El proyecto usa `electron-builder` para crear distribuciones:

```json
{
  "appId": "com.jrfsoluciones.sgsst",
  "productName": "K+AIR",
  "win": {
    "target": "nsis",
    "icon": "assets/KIAR256.ico"
  },
  "mac": {
    "target": "dmg",
    "category": "public.app-category.business"
  },
  "linux": {
    "target": "AppImage"
  }
}
```

### Publicación

La aplicación se publica en GitHub Releases:
- **Repositorio:** https://github.com/Reivaj640/SG-SST-E
- **Tipo de release:** Draft
- **Auto-updates:** Habilitadas con `electron-updater`

**Flujo de release automatizado (v0.1.131+):**

```powershell
#流程 completo (con tests):
.\scripts\release.ps1

#流程 sin tests:
.\scripts\release.ps1 -SkipTests
```

El script ejecuta 7 pasos: pre-checks → tests → `git push` branch → crea tag → **`git push` tag** (evita el 422) → verifica visibilidad → `electron-builder --publish=always`. Si electron-builder falla al subir, llama automáticamente a `fix-release.ps1` que sube los assets con `curl` directo a `uploads.github.com`. Ver `AGENTS.md` (sección "🆕 Release flow automatizado") para el detalle completo.

**Publicación manual de emergencia** (si los scripts no funcionan):

```powershell
# Tag y push manual primero:
git tag v0.1.133
git push origin v0.1.133
npx electron-builder --win --publish=always

# Si electron-builder falla al subir el .exe (timeout):
.\scripts\fix-release.ps1
```

---

## 🔧 Mantenimiento

### Actualización de Dependencias

```bash
# Verificar dependencias desactualizadas
npm outdated

# Actualizar dependencias
npm update

# Actualizar dependencias específicas
npm install package-name@latest
```

### Limpieza del Proyecto

El proyecto mantiene una raíz limpia:
- ✅ **13 archivos en raíz** (solo esenciales)
- ✅ **Módulos organizados** en `modules/`
- ✅ **Backup histórico** en `backup_archivos_originales/`

### Scripts de Utilidad

```bash
# Verificar tamaños de archivos
scripts/verificar-tamanos.bat

# Generar documentación automáticamente
npm run docs:watch

# Limpiar caché
npm run clean  # (si está configurado)
```

---

## 🤝 Contribuciones

### Flujo de Trabajo

1. **Crear rama** desde `main`
2. **Implementar cambios** siguiendo convenciones existentes
3. **Agregar documentación JSDoc** a nuevas funciones
4. **Ejecutar pruebas** locales
5. **Generar documentación**: `npm run docs:generate`
6. **Actualizar CHANGELOG.md**
7. **Crear Pull Request**

### Convenciones de Código

- **Nombrado**: `nombre-component.js`, `nombre-logic.js`, `nombre-viewer.js`
- **Comentarios**: JSDoc para funciones públicas
- **Estilos**: Seguir Sistema Visual Oficial K+AIR
- **Módulos**: Organizar en `modules/[categoria]/[submodulo]/`

### Documentación de Cambios

Cuando realices cambios:

1. **Actualiza comentarios JSDoc** en el código
2. **Ejecuta** `npm run docs:generate`
3. **Actualiza documentación funcional** en `docs/`
4. **Registra cambios** en `CHANGELOG.md`

---

## 📞 Soporte y Contacto

### Recursos de Ayuda

- 📖 **Documentación Completa:** `/docs`
- 🐛 **Reportar Bugs:** GitHub Issues
- 💬 **Discusiones:** GitHub Discussions

### Información del Autor

**Javier Robles F.**
- Prof. SG-SST
- Esp. Gerencia de Proyectos
- © 2025-2026 Todos los derechos reservados

---

## 📄 Licencia

**Copyright © 2025 Javier Robles F.**

Este software es propietario y confidencial. No se permite la reproducción, distribución o modificación sin autorización escrita del autor.

---

## 🎯 Hoja de Ruta (Próximos Pasos)

### Corto Plazo
- [ ] Completar módulos 4-7 (Peligros, Amenazas, Verificación, Mejoramiento)
- [ ] Mejorar documentación de contratos IPC
- [ ] Optimizar carga de módulos dinámicos
- [x] Implementar seguimiento PRIC con interfaz slideover 🆕
- [x] Implementar selección de incapacidades con checkboxes 🆕
- [x] Implementar flujo de selección de casos al abrir seguimiento 🆕
- [x] Implementar cálculos automáticos (antigüedad, días acumulados) 🆕
- [x] Implementar seguimientos múltiples (hasta 5) con indexación en PRI.xlsx 🆕
- [x] Implementar lógica inteligente actualización vs creación 🆕

### Mediano Plazo
- [ ] Implementar sistema de módulos ES6
- [ ] Migrar a webpack para bundling
- [ ] Agregar tests unitarios

### Largo Plazo
- [ ] Versión web (sin Electron)
- [ ] Sincronización multiusuario en nube
- [ ] Sincronización en la nube

---

## 📝 Cambios Recientes

### v0.1.100 - 11 Jun 2026 🆕

#### Estandarización de Headers - Patrón k-section-card

**1. Header Card Pattern** 🎯
- Patrón canónico `k-section-card` para todos los módulos K+AIR
- Reemplaza BEM `kair-header__*` legacy
- Estructura: card → icon + title + subtitle + actions

**2. Migración Masiva** 📋
- 22 submódulos migrados (42 archivos)
- Módulo 1: Presupuesto, COPASST, Comité, Capacitaciones, Inducciones
- Módulo 2: Objetivos, Evaluación Inicial, Plan de Trabajo, Archivo, Rendición, Proveedores, Selección, Cambio
- Módulo 3: Evaluaciones Médicas, Remisiones, Reportes, Investigación, Registro, Frecuencia, Severidad, Mortalidad

**3. Beneficios** ✅
- Tabs integrados dentro del card
- Responsive: company oculta en mobile
- Dark theme soportado
- IDs preservados (compatibilidad JS)

**Archivos Modificados:**

| Módulo | Archivos |
|--------|----------|
| 1. Recursos | 10 archivos |
| 2. Gestión Integral | 14 archivos |
| 3. Gestión Salud | 18 archivos |
| **Total** | **42 archivos** |

---

### v0.1.99 - 9 Jun 2026 🆕

#### Módulo 2.4.1 - Plan de Trabajo Anual: Dashboard y Navegación

**1. KPIs Estandarizados** 🆕
- Migrado `.kpi-grid`/`.kpi-card` → `k-stats-ribbon` canónico (KPI Strip Enterprise v1.0)
- Nomenclatura alineada a Capacitaciones: Programadas/Realizadas/Pendientes/Vencidas
- KPI Avance % integrado como pill badge en primer item

**2. Dashboard Reestructurado** 🎨
- Eliminado page-header legacy
- Tabs-header con empresa y periodo activo
- Charts-grid 3x2 con 6 gráficas:
  - Estado (bar) — Programadas vs Realizadas vs Pendientes vs Vencidas
  - Progreso Mensual (line) — Evolución mes a mes
  - Cumplimiento Trimestral (bar agrupado) — Q1-Q4 Programadas vs Ejecutadas
  - Estado Mensual (stacked bar) — Distribución por mes
  - Categoría (horizontal bar) — Cumplimiento por grupo padre (level===1)
  - Radar Anual (radar) — Distribución 12 meses

**3. Modal Selector de Periodo** 🆕
- Cierra con botón X (esquina superior derecha)
- Cierra con clic en fondo (patrón UX estándar)
- Función `hidePeriodSelector()` expuesta en `window`

**4. Navegación Corregida** 🔧
- **Cronograma → Volver**: postMessage → renderer → `planPortalComponent.goBackToHome()` → portal home
- **Portal Home → Volver al Menú**: `goBackToModule()` → `planPortalComponent.goBackToModuleHome()` → `destroy()` + `onBackToModuleHome()` → menú Gestión Integral
- Patrón destroy consistente con COPASST (`window.planPortalComponent = null`, cleanup script, clear container)

**5. Fix Visual** 🎨
- Eliminado subrayado en hover/focus/active del botón "Volver al Menú" (`.back-btn-internal`)

**Archivos Modificados:**
| Archivo | Cambios |
|---------|---------|
| `plan-trabajo/plan-view.html` | Dashboard HTML con tabs-header, k-stats-ribbon, 6 chart-cards, canvas ids |
| `plan-trabajo/plan-view.css` | ~1080 líneas, k-stats-ribbon, tabs-header BEM, charts-grid 3 cols, period-card__close |
| `plan-trabajo/plan-viewer.js` | ~1573 líneas, 6 funciones render chart, updateKPIs(), hidePeriodSelector(), K_COLORS |
| `plan-trabajo/plan-trabajo-logic.js` | `destroy()`, `goBackToModuleHome()`, `portalScript` ref |
| `plan-trabajo/plan-home.js` | `goBackToModule()` → `planPortalComponent.goBackToModuleHome()` directo |
| `plan-trabajo/plan-home.html` | `.back-btn-internal:hover/focus/active` text-decoration: none |
| `renderer.js` | 2 handlers `back-to-module-request` con delegación `goBackToHome()` |

### v0.1.53 - 4 Mar 2026 🆕

#### Módulo de Ausentismo - Mejoras en Tabla y Estadísticas

**1. Tabla de Ausentismo - Nuevas Columnas** 🆕

Se agregaron 4 columnas adicionales entre "Entidad" y "Descripción":

| Columna | Índice | Nombre Técnico | Fuente |
|---------|--------|----------------|--------|
| **Año** | 14 (O) | `AÑO` | Columna O del Excel o extraído de F. Inicio |
| **Fecha Inicio** | 15 (P) | `F. INICIO` | Columna P del Excel |
| **Fecha Fin** | 16 (Q) | `F. FIN` | Columna Q del Excel |
| **Código** | 17 (R) | `CODIGO` | Columna R del Excel (Código CIE-10) |

**Características:**
- ✅ **Scroll horizontal responsivo** - La tabla se expande cuando hay espacio
- ✅ **Año automático** - Si la columna O está vacía, extrae año de la fecha de inicio
- ✅ **Índices fijos** - Búsqueda prioritaria por índice (14, 15, 16, 17) con fallback por nombre
- ✅ **17 columnas en total** - Tabla completa con todas las datos relevantes

**2. Filtros Dinámicos Mejorados** 🆕

| Filtro | Comportamiento Anterior | Comportamiento Nuevo |
|--------|------------------------|----------------------|
| **Año** | 3 años hardcodeados (2024, 2023, 2022) | **Todos los años presentes** en datos (orden descendente) |
| **Tipo (Clase)** | 3 opciones fijas (EPS, ARL, EMPRESA) | **Todos los tipos únicos** de "CLASE DE INCAPACIDAD" (orden alfabético) |
| **Búsqueda** | Nombre y cédula | Igual (sin cambios) |
| **Mes** | 12 meses fijos | Igual (sin cambios) |

**Función nueva:** `populateDynamicFilters()`
- Escanea todos los registros al cargar
- Extrae valores únicos de año y tipo
- Actualiza selects dinámicamente
- Fallback para registros antiguos sin columna AÑO

**3. Estadísticas de Ausentismo - Filtros y Género** 🆕

**Corrección de Género:**
- ❌ Antes: "MUJER", "HOMBRE" (no coincidía con datos)
- ✅ Ahora: "FEMENINO", "MASCULINO" (coincide con Excel)

**Filtros Dinámicos en Estadísticas:**
- **Año**: Todos los años presentes en datos
- **Mes**: Solo meses con registros
- **Género**: FEMENINO, MASCULINO
- **Clase**: Todos los tipos únicos de incapacidad

**Gráfico de Género Actualizado:**
- Etiquetas: "Femenino", "Masculino", "Otro"
- Colores: Rosa (#e91e63), Azul (#2196f3), Gris (#9e9e9e)
- Cálculo: Filtra por `row.GENERO.toUpperCase() === 'FEMENINO'`

**4. Scroll Horizontal Modernizado** 🎨

**Sección Configuración de Empresas:**
- Scrollbar horizontal y vertical con mismo estilo
- Ancho: 10px, bordes redondeados 8px
- Colores: Track #f1f5f9, Thumb #cbd5e1, Hover #94a3b8
- Soporte completo para temas oscuro y dark-legacy

**Sección Ausentismo:**
- Tabla con `width: 100%` + `min-width: fit-content`
- Contenedor con `max-width: 100%`
- Scroll solo aparece cuando es necesario

**5. Información de Mapeo en Tarjetas** 🆕

**Nueva sección en tarjetas de empresas:**

```
┌─────────────────────────────────────┐
│  Tempoactiva        [Riesgo IV]    │
│  ... stats y botones ...            │
│  ─────────────────────────────────  │
│  📅 Último mapeo: 4 mar 2026 10:30 │
│                      [Primera vez]  │
└─────────────────────────────────────┘
```

**Datos almacenados:**
- `fechaMapeo`: Timestamp ISO de cuándo se mapeó
- `tipoMapeo`: 'primera_vez' o 'reconfiguracion'

**Badge de tipo:**
- 🟢 **Primera vez** (verde) - Mapeo inicial
- 🟡 **Reconfiguración** (ámbar) - Reconfiguración de ruta existente

**Archivos Modificados:**

| Archivo | Cambios |
|---------|---------|
| `modules/gestion-salud/ausentismo/medicion-ausentismo.js` | +4 columnas, filtros dinámicos, corrección género, estadísticas |
| `components/config/config-viewer.html` | + Info de mapeo en tarjetas, scroll modernizado |
| `renderer.js` | + Guardado de `fechaMapeo` y `tipoMapeo` |

---

### v0.1.52 - 28 Feb 2026

#### Módulo de Ausentismo PRIC - Actualización Mayor

**Nuevas Funcionalidades:**

1. **Etapas 4 y 5 en Incapacidad Temporal** 🆕
   - **Etapa 4: Reincorporación Laboral**
     - Fecha de Reincorporación
     - Tipo de Reintegro (Mismo Cargo, Funciones Restrictivas, Otro Oficio)
     - Adaptaciones en el Puesto de Trabajo
   - **Etapa 5: Cierre de Caso**
     - Fecha de Cierre
     - Motivo de Cierre (Alta Médica, Calificación PCL, Retiro Voluntario)
     - Observaciones Finales

2. **Nuevas Columnas en PRI.xlsx** 🆕

| Columna | Índice | Campo | Descripción |
|---------|--------|-------|-------------|
| L | 11 | Salario Básico | Salario del empleado |
| Z | 25 | Fecha Inicio | Fecha de inicio de incapacidad |
| AA | 26 | Fecha Fin | Fecha de finalización |
| AB | 27 | Código CIE-10 | Código del diagnóstico |
| AC | 28 | Descripción | Descripción del diagnóstico |
| AD-AE | 29-30 | Seguimiento 1 | Fecha y descripción |
| AF-AG | 31-32 | Seguimiento 2 | Fecha y descripción |
| AH-AI | 33-34 | Seguimiento 3 | Fecha y descripción |
| AJ-AK | 35-36 | Seguimiento 4 | Fecha y descripción |
| AL-AM | 37-38 | Seguimiento 5 | Fecha y descripción |
| AM | 39 | Clase | LABORAL/COMÚN |
| AN | 40 | CIE-10 DX2 | Segundo diagnóstico |
| AO | 41 | Origen DX2 | Origen del DX2 |
| AP | 42 | CIE-10 DX3 | Tercer diagnóstico |
| AQ | 43 | Origen DX3 | Origen del DX3 |
| AS | 44 | Fecha Reincorporación | Etapa 4 |
| AT | 45 | Tipo Reintegro | Etapa 4 |
| AU | 46 | Adaptaciones | Etapa 4 |
| AV | 47 | Fecha Cierre | Etapa 5 |
| AW | 48 | Motivo Cierre | Etapa 5 |
| AX | 49 | Observaciones Finales | Etapa 5 |

3. **Mejoras en Carga de Casos Existentes** 🆕
   - Carga TODOS los campos del registro
   - Carga seguimientos múltiples automáticamente
   - Carga Etapas 4 y 5 completas
   - Cálculo automático de días al cargar fechas

4. **Modal de Registros Existentes Mejorado** 🆕
   - Muestra código CIE-10 + descripción completa
   - Permite seleccionar caso específico para cargar
   - Opción "Crear nuevo registro" disponible

5. **Eliminado Campo Obsoleto** 🗑️
   - Caja de Compensación removido de Seguridad Social

**Archivos Modificados:**

| Archivo | Cambios |
|---------|---------|
| `modules/gestion-salud/ausentismo/medicion-ausentismo.js` | + Etapas 4 y 5, + carga completa de registros, + campos followUpData |
| `Portear/src/actualizar_ausentismo.py` | + Columnas L, Z-AX, + lectura/escritura Etapas 4 y 5, + seguimientos |
| `main.js` | Handler `leer-casos-pri` para búsqueda |
| `preload.js` | API `leerCasosPRI()` expuesta |

**Estructura de Datos Actualizada:**

```javascript
{
  // Datos básicos
  nombre, cedula, genero, fechaNacimiento, fechaIngreso
  // Información laboral
  cargo, area, tipoEvento, tipoCargo, tipoContrato, salario
  // Seguridad social
  eps, afp
  // Salud
  peso, talla, imc, dominancia, actividadesExtralaborales
  // Incapacidad
  fechaInicio, fechaFin, diasAcumulados, clase, codigoCie10, descripcionDiagnostico
  cie10Dx2, origenDx2, cie10Dx3, origenDx3
  // Etapa 4: Reincorporación
  fechaReincorporacion, tipoReintegro, adaptaciones
  // Etapa 5: Cierre
  fechaCierre, motivoCierre, observacionesFinales
  // Seguimientos (hasta 5)
  seguimientos: [{fecha, descripcion}, ...]
}
```

---

### v0.1.51 - 27 Feb 2026

#### Módulo de Ausentismo PRIC

1. **Incapacidades Seleccionables** - Checkboxes en modal de detalles
2. **Flujo de Selección de Casos** - Modal después de "Abrir Seguimiento"
3. **Cálculos Automáticos** - Antigüedad y días acumulados
4. **Seguimientos Múltiples** - Hasta 5 seguimientos por caso
5. **Lógica Inteligente** - Actualiza o crea según fechas
6. **Carga Automática** - Datos desde incapacidad seleccionada

**Archivos Modificados:**

- `modules/gestion-salud/ausentismo/medicion-ausentismo.js` - +12 funciones nuevas
- `Portear/src/actualizar_ausentismo.py` - Seguimientos múltiples en columnas AB-AK
- `main.js` - Handler `leer-casos-pri`
- `preload.js` - API `leerCasosPRI()`

---

**Última actualización:** 11 de junio de 2026  
**Versión del documento:** 2.5 (Estandarización de Headers - v0.1.100)  
**Versión de la aplicación:** 0.1.100

---

## 📚 Documentación

La documentación del proyecto está consolidada en **4 archivos** en la raíz:

| Archivo | Para quién | Qué tiene |
|---|---|---|
| **[README.md](README.md)** | Vos (cliente) y devs nuevos | Qué es K+AIR, cómo se instala, características |
| **[AGENTS.md](AGENTS.md)** | IAs (yo) | Convenciones, arquitectura, Bandeja, menú nativo, etc. |
| **[CONTEXT.md](CONTEXT.md)** | IAs y devs | Contexto general del proyecto |
| **[CHANGELOG.md](CHANGELOG.md)** | Todos | Historial completo de cambios por versión |

**Ruta recomendada según quién sos:**

- **👤 Cliente / usuario final:** este `README.md`
- **👨‍💻 Dev nuevo:** `README.md` → `AGENTS.md` (sección arquitectura) → código
- **🤖 IA (Mavis, Cursor, etc.):** `AGENTS.md` (principal) + `CONTEXT.md` (contexto)
- **🔧 Mantenedor:** `CHANGELOG.md` + commits en git

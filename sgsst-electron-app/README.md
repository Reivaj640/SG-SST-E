# K+AIR - Sistema de Gestión SG-SST

**Versión:** 0.1.49
**Última actualización:** 26 de febrero de 2026
**Autor:** Javier Robles F. Prof. SG-SST - Esp. Gerencia de Proyectos

---

## 📋 Descripción General

**K+AIR** es una aplicación empresarial Electron que implementa un Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) completo, diseñado para cumplir con la normativa colombiana (Resolución 0312 de 2019).

### Características Principales

- ✅ **Multi-empresa**: Gestión de múltiples empresas con una sola experiencia UX/UI
- ✅ **Motor Normativo Inteligente**: Escenarios normativos basados en tamaño y riesgo
- ✅ **7 Módulos Principales**: Recursos, Gestión Integral, Salud, Peligros, Amenazas, Verificación, Mejoramiento
- ✅ **27 Submódulos**: Cada uno con su propia lógica y vistas especializadas
- ✅ **IA Integrada**: Análisis de accidentes con LLM (Mistral 3 3B)
- ✅ **Seguimiento PRIC**: Gestión completa de casos de incapacidad y rehabilitación
- ✅ **Solo 13 archivos en raíz**: Proyecto limpio y organizado

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    K+AIR Electron App                    │
├─────────────────────────────────────────────────────────┤
│  RENDERER (Frontend)                                    │
│  ├── index.html (Estructura principal)                  │
│  ├── renderer.js (Lógica de UI - 3170 líneas)           │
│  ├── styles.css (Sistema Visual Oficial)                │
│  └── modules/ (27 submódulos organizados)               │
├─────────────────────────────────────────────────────────┤
│  PRELOAD (Puente Seguro)                                │
│  └── preload.js (60+ contratos IPC expuestos)           │
├─────────────────────────────────────────────────────────┤
│  MAIN (Backend Electron)                                │
│  └── main.js (55+ handlers IPC - 4766 líneas)           │
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

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `index.html` | 143 | Punto de entrada HTML |
| `main.js` | 4766 | Proceso principal Electron |
| `preload.js` | ~180 | Puente IPC seguro |
| `renderer.js` | 3170 | Lógica de renderizado |
| `styles.css` | ~2500 | Estilos globales |
| `development-styles.css` | ~500 | Estilos desarrollo |
| `package.json` | 85 | Configuración npm |
| `package-lock.json` | - | Bloqueo dependencias |
| `README.md` | - | Este archivo |
| `docker-compose.yml` | - | Configuración Docker |
| `icon-config.json` | - | Configuración iconos |

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
│   ├── investigacion-accidentes/ # 3.2.2 Investigación accidentes
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

| Directorio | Propósito |
|------------|-----------|
| `assets/` | Iconos, imágenes y recursos gráficos |
| `backup_archivos_originales/` | Respaldo histórico (67 archivos) |
| `components/` | Componentes reutilizables (config, seguimiento) |
| `docs/` | Documentación completa (137 archivos) |
| `examples/` | Ejemplos de código y vistas de prueba |
| `logs/` | Registros de la aplicación |
| `Portear/` | Módulo Python con 15+ scripts especializados |
| `scripts/` | Scripts de utilidad (generar docs, temas) |
| `test/` | Archivos de prueba |
| `utils/` | Utilidades y archivos de soporte |

---

## 🚀 Instalación y Configuración

### Requisitos del Sistema

| Componente | Versión Mínima | Recomendada |
|------------|----------------|-------------|
| **Node.js** | 18.x | 20.x |
| **Python** | 3.10 | 3.11-3.12 |
| **RAM** | 8 GB | 16 GB |
| **Almacenamiento** | 2 GB | 5 GB SSD |
| **CUDA** (opcional) | 12.x | Para IA con GPU |

### Instalación Paso a Paso

```bash
# 1. Clonar repositorio
git clone https://github.com/Reivaj640/SG-SST-E.git
cd SG-SST-E

# 2. Instalar dependencias Node.js
npm install

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

## 📊 Módulos y Funcionalidades

### Módulo 1: Recursos (11 submódulos)

| Código | Submódulo | Archivos Principales |
|--------|-----------|---------------------|
| 1.1.1 | Responsable del SG | `responsable-sg-logic.js`, `viewer.js`, `view.html` |
| 1.1.2 | Roles y Responsabilidades | `roles-responsabilidades-logic.js`, `viewer.js` |
| 1.1.3 | Asignación de Recursos | `presupuesto-logic.js`, `presupuesto-gestion.html` |
| 1.1.4 | Afiliación al SSSI | `afiliacion-logic.js`, `viewer.js` |
| 1.1.5 | Trabajo de Alto Riesgo | `trabajo-alto-riesgo-logic.js`, `viewer.js` |
| 1.1.6 | Conformación de Copasst | `copasst-logic.js`, `viewer.js` |
| 1.1.7 | Capacitación al Copasst | `capacitacion-copasst-logic.js`, `viewer.js` |
| 1.1.8 | Comité de Convivencia | `comite-convivencia-logic.js`, `viewer.js` |
| 1.2.1 | Programa de Capacitación | `capacitaciones-logic.js`, `viewer.js` |
| 1.2.2 | Inducción y Reinducción | `inducciones-logic.js`, `viewer.js` |
| 1.2.3 | Curso Virtual 50 Horas | `curso-virtual-logic.js`, `viewer.js` |

### Módulo 2: Gestión Integral (6 submódulos)

| Código | Submódulo | Archivos Principales |
|--------|-----------|---------------------|
| 2.1.1 | Política del SG-SST | `politica-logic.js`, `viewer.js`, `onlyoffice-bridge.js` |
| 2.2.1 | Objetivos SST | `objetivos-sst-logic.js`, `viewer.js` |
| 2.3.1 | Evaluación Inicial SG-SST | `evaluacion-inicial-sg-sst-logic.js`, `test.html` |
| 2.4.1 | Plan de Trabajo Anual | `plan-trabajo-logic.js`, `plan-home.js` |
| 2.5.1 | Archivo y Retención Documental | En `renderer.js` |
| 2.6.1 | Rendición de Cuentas | `rendicion-logic.js`, `viewer.js` |

### Módulo 3: Gestión de la Salud (6 submódulos)

| Código | Submódulo | Archivos Principales |
|--------|-----------|---------------------|
| 3.1.1 | Diagnóstico Sociodemográfico | `sociodemografica-component.js`, `viewer.js` |
| 3.1.4 | Evaluaciones Médicas | `evaluaciones-medicas-logic.js`, `component.js` |
| 3.1.6 | Restricciones Médicas | `restricciones-medicas-logic.js`, `component.js` |
| 3.2.1 | Reporte de Accidentes | `reportes-accidentes-logic.js`, `viewer.js` |
| 3.2.2 | Investigación de Accidentes | `investigacion-accidentes-logic.js`, `handlers.js` 🤖 |
| 3.3.6 | Medición del Ausentismo | `medicion-ausentismo.js`, `registrar-ausentismo.js` |

### Módulos 4-7 (Resumen)

| Módulo | Submódulos | Estado |
|--------|-----------|--------|
| 4. Gestión de Peligros y Riesgos | Home module | ✅ Activo |
| 5. Gestión de Amenazas | Home module | ✅ Activo |
| 6. Verificación | Home module | ✅ Activo |
| 7. Mejoramiento | Home module | ✅ Activo |

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

| Condición | Criterio | Ejemplo |
|-----------|----------|---------|
| **Condición 1** | Incapacidad individual ≥ 10 días | Incapacidad de 15 días por cirugía |
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

#### 4. Modal de Detalles del Caso

Al hacer clic en "Ver Detalles", se muestra:

**Para Condición 1 (Incapacidad ≥ 10 días):**
- Encabezado con datos del empleado
- Lista de incapacidades ≥ 10 días ordenadas de más reciente a más antigua
- Cada incapacidad muestra:
  - Fechas de inicio y fin
  - Días de duración
  - Tipo (EPS/ARL/EMPRESA)
  - Estado (En curso/Próximo a vencer/Finalizado)
  - Código CIE-10
  - Descripción del diagnóstico

**Para Condición 2 (Suma ≥ 10 días con gaps ≤ 3):**
- Encabezado con datos del empleado
- Secuencia completa de incapacidades
- Cálculo y visualización de gaps entre incapacidades
- Total acumulado de días
- Código CIE-10 y diagnóstico de cada incapacidad

#### 5. Formulario Maestro de Seguimiento PRIC 🆕

**Interfaz:** Panel slideover que emerge desde la derecha (95% ancho, máx 1100px)

**Secciones del Formulario:**

| Sección | Campos Principales |
|---------|-------------------|
| **1. Datos Generales** | Nombre, cédula, fecha nacimiento, género, cargo, área, fecha ingreso, antigüedad, tipo contrato, salario, EPS, AFP, ARL, caja compensación |
| **2. Incapacidad Temporal** | Fechas inicio/fin, días acumulados, clase, código CIE-10, descripción diagnóstico, contingencia, prórrogas |
| **3. Etapas PRIC** | 5 etapas: Captura, Plan de Tratamiento, Ejecución, Reincorporación, Cierre |
| **4. Seguimiento Recomendaciones** | Tabla dinámica para listar recomendaciones de ARL/EPS con estado de cumplimiento |
| **5. Calificación PCL** | Estado del proceso, fechas solicitud/dictamen, % PCL, origen, fecha estructuración |

**Características de la Interfaz:**
- ✅ Navegación horizontal por pestañas con animaciones fade-in
- ✅ Carga automática de datos del empleado desde la tabla de seguimiento
- ✅ Campos de solo lectura para datos que vienen del empleado
- ✅ ARL prellenado con "COLMENA SEGUROS"
- ✅ Tabla de recomendaciones con botones para agregar/eliminar filas
- ✅ Botón "Guardar en Excel" que recopila todos los datos
- ✅ Cierre al hacer clic en backdrop o botón cerrar

**Flujo de Trabajo:**
```
1. Usuario hace clic en "Abrir Seguimiento" en modal de detalles
   ↓
2. Panel slideover se abre con datos del empleado precargados
   ↓
3. Usuario navega entre 5 pestañas y completa información
   ↓
4. Usuario puede agregar recomendaciones dinámicamente
   ↓
5. Usuario hace clic en "Guardar en Excel"
   ↓
6. Sistema recopila datos y muestra notificación de éxito
   ↓
7. Panel se cierra automáticamente
```

**Métodos del Componente:**
```javascript
// Principales métodos implementados
- createSeguimientoPanel()       // Crea HTML y CSS del panel
- closeSeguimientoPanel()        // Cierra el panel
- showSeguimientoPanelSection()  // Navegación entre pestañas
- cargarDatosEnPanelSeguimiento() // Carga datos del empleado
- addRecomRow()                  // Agrega fila a tabla de recomendaciones
- removeRecomRow()               // Elimina fila de recomendaciones
- saveSeguimientoData()          // Recopila y guarda datos
```

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

**Datos de Seguimiento PRIC:**
```javascript
{
  trabajador: { /* datos generales */ },
  incapacidad: { /* detalles de incapacidad */ },
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
- 📖 [docs/modulo-ausentismo-pric.md](docs/modulo-ausentismo-pric.md) (pendiente)

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
| `saveFollowUp(followUpData, companyName)` | Guardar seguimiento de caso individual en PRI.xlsx |

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

**Ubicación:** `docs/api/`

### Estado del Proyecto

| Archivo | Descripción |
|---------|-------------|
| [docs/ESTADO_ACTUAL_REORGANIZACION.md](docs/ESTADO_ACTUAL_REORGANIZACION.md) | 18 fases de reorganización completadas |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Historial de cambios por versión |
| [docs/DEPENDENCIAS.md](docs/DEPENDENCIAS.md) | Guía completa de dependencias |

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

### Mediano Plazo
- [ ] Implementar sistema de módulos ES6
- [ ] Migrar a webpack para bundling
- [ ] Agregar tests unitarios
- [ ] Implementar guardado real de seguimiento PRIC en Excel

### Largo Plazo
- [ ] Versión web (sin Electron)
- [ ] Base de datos SQL/NoSQL
- [ ] Sincronización en la nube

---

**Última actualización:** 25 de febrero de 2026
**Versión del documento:** 2.1 (Seguimiento PRIC implementado)

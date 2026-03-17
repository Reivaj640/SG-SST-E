# 📊 Resumen de Arquitectura K+AIR v0.1.75

**Versión:** 1.0  
**Actualizado:** 17 de marzo de 2026  
**Estado:** ✅ Nuevo documento de referencia rápida

---

## 📋 Métricas del Proyecto

### Archivos y Líneas de Código

| Componente | Archivos | Líneas | Descripción |
|------------|----------|--------|-------------|
| **Proyecto JS total** | 162 | ~50,000+ | Todos los archivos JavaScript |
| **main.js** | 1 | 7,852 | Proceso principal Electron |
| **renderer.js** | 1 | 3,170 | Lógica de renderizado |
| **preload.js** | 1 | ~180 | Puente IPC seguro |
| **index.html** | 1 | 143 | Estructura principal |
| **styles.css** | 1 | ~2,500 | Estilos globales |
| **modules/** | 50+ | ~30,000+ | Todos los módulos |

### Handlers IPC

| Categoría | Handlers | Prioridad |
|-----------|----------|-----------|
| Autenticación y Usuarios | 10 | 🔴 Crítico |
| Ausentismo y PRI | 12 | 🔴 Crítico |
| Investigación de Accidentes | 6 | 🔴 Crítico |
| Capacitaciones | 7 | ✅ Normal |
| Archivos y Documentos | 11 | ✅ Normal |
| Presupuesto | 4 | ✅ Normal |
| Otros | 28 | ✅ Normal |
| **TOTAL** | **78** | - |

### Python Integration

| Script | Función | Puerto |
|--------|---------|--------|
| `llm_server.py` | Servidor Flask para IA | 5555 |
| `accident_processor.py` | Procesamiento de PDFs | - |
| `accident_report_generator.py` | Generación de DOCX | - |
| `ausentismo_utils.py` | Utilidades de ausentismo | - |
| `inducciones_sync.py` | Sincronización Google Forms | - |
| **Total scripts** | **15+** | - |

---

## 🏗️ Arquitectura de Capas

```
┌───────────────────────────────────────────────────────────────┐
│  CAPA 1: PRESENTACIÓN (Renderer Process)                      │
│  ├── index.html (143 líneas)                                  │
│  ├── renderer.js (3,170 líneas)                               │
│  ├── styles.css (~2,500 líneas)                               │
│  └── modules/ (27+ submódulos)                                │
├───────────────────────────────────────────────────────────────┤
│  CAPA 2: PUENTE SEGURO (Preload Script)                       │
│  └── preload.js (~180 líneas, 78 contratos)                   │
├───────────────────────────────────────────────────────────────┤
│  CAPA 3: LÓGICA DE NEGOCIO (Main Process)                     │
│  ├── main.js (7,852 líneas, 78 handlers)                      │
│  ├── handlers/ (investigacion_handlers.js, etc.)              │
│  └── utils/ (utilidades varias)                               │
├───────────────────────────────────────────────────────────────┤
│  CAPA 4: DATOS (Persistencia)                                 │
│  ├── SQLite (kair.db) - Usuarios, roles, sesiones             │
│  ├── Excel files - Datos de empresas                          │
│  └── config.json - Configuración global                       │
├───────────────────────────────────────────────────────────────┤
│  CAPA 5: INTEGRACIÓN PYTHON                                   │
│  ├── llm_server.py (Flask:5555)                               │
│  ├── accident_processor.py                                    │
│  ├── accident_report_generator.py                             │
│  └── 12+ scripts adicionales                                  │
└───────────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura de Directorios

### Raíz del Proyecto (13 archivos)

```
sgsst-electron-app/
├── index.html              # Punto de entrada
├── main.js                 # Proceso principal (7,852 líneas)
├── preload.js              # Puente IPC (78 contratos)
├── renderer.js             # Renderizado (3,170 líneas)
├── styles.css              # Estilos globales
├── development-styles.css  # Estilos desarrollo
├── package.json            # Configuración npm
├── package-lock.json       # Lock de dependencias
├── README.md               # Documentación principal
├── docker-compose.yml      # Configuración Docker
└── icon-config.json        # Configuración de iconos
```

### Módulos (50+ archivos)

```
modules/
├── gestion-integral/           # Módulo 2 (6 submódulos)
│   ├── gestion-integral-home.js
│   ├── politica/
│   ├── objetivos-sst/
│   ├── plan-trabajo/
│   ├── evaluacion-inicial-sg-sst/
│   ├── rendicion-cuentas/
│   └── evaluacion-proveedores/
│
├── recursos/                   # Módulo 1 (11 submódulos)
│   ├── recursos-home.js
│   ├── responsable-sg/
│   ├── roles-responsabilidades/
│   ├── presupuesto/
│   ├── afiliacion/
│   ├── trabajo-alto-riesgo/
│   ├── copasst/
│   ├── capacitacion-copasst/
│   ├── comite-convivencia/
│   ├── capacitaciones/         # 🆕 Portal + clonado
│   ├── inducciones/            # 🆕 Sincronización automática
│   ├── curso-virtual/
│   └── manual-proveedores/
│
├── gestion-salud/              # Módulo 3 (6 submódulos)
│   ├── gestion-salud-home.js
│   ├── sociodemografica/
│   ├── evaluaciones-medicas/
│   ├── restricciones-medicas/
│   ├── reportes-accidentes/
│   ├── investigacion-accidentes/  # 🤖 IA integrada
│   └── ausentismo/                # 🆕 Sistema dual + 5 seguimientos
│
├── gestion-peligros/           # Módulo 4
│   └── gestion-peligros-home.js
│
├── gestion-amenazas/           # Módulo 5
│   └── gestion-amenazas-home.js
│
├── verificacion/               # Módulo 6
│   └── verificacion-home.js
│
├── mejoramiento/               # Módulo 7
│   └── mejoramiento-home.js
│
└── helpers/                    # Utilidades
    └── viewLoader.js
```

### Python (Portear/)

```
Portear/
└── src/
    ├── llm_server.py                        # Servidor Flask (puerto 5555)
    ├── accident_processor.py                # Procesamiento de PDFs
    ├── accident_report_generator.py         # Generación de informes DOCX
    ├── ausentismo_utils.py                  # Utilidades de ausentismo
    ├── inducciones_sync.py                  # Sincronización Google Forms
    ├── evaluacion_processor.py              # Procesamiento de evaluaciones
    ├── acta_generator.py                    # Generación de actas
    ├── remision_utils.py                    # Utilidades de remisiones
    ├── requirements.txt                     # Dependencias Python
    └── models/                              # Modelos de IA (opcional)
```

### Documentación (docs/)

```
docs/
├── 01-arquitectura/
│   ├── arquitectura-general.md
│   ├── ipc-contratos.md           # 🆕 78 handlers documentados
│   └── motor-normativo.md
│
├── 02-modulos/
│   ├── modulo-1-recursos.md       # 🆕 Actualizado v0.1.75
│   ├── modulo-2-4-5-6-7-gestion-integral-y-restantes.md
│   ├── modulo-3-gestion-salud.md
│   ├── modulo-3-3-6-ausentismo.md     # 🆕 Nuevo (sistema dual)
│   └── modulo-3-2-2-investigacion-accidentes-ia.md  # 🆕 Nuevo (IA)
│
├── 03-guias/
│   └── (pendientes de creación)
│
├── api/                            # Documentación JSDoc auto-generada
├── ARQUITECTURA_AUSENTISMO_DUAL.md
├── CHANGELOG.md
├── roles-permisos-rbac.md
└── README.md
```

---

## 🔌 Flujo de Datos Típico

### Ejemplo: Registro de Incapacidad

```
1. Usuario en frontend (renderer.js)
   ↓
2. Click en "Guardar Incapacidad"
   ↓
3. renderer.js llama a window.electronAPI.procesarAusentismo(formData)
   ↓
4. preload.js envía IPC: 'procesar-ausentismo'
   ↓
5. main.js recibe handler 'procesar-ausentismo'
   ↓
6. main.js valida permisos y datos
   ↓
7. main.js llama a Python (ausentismo_utils.py)
   ↓
8. Python actualiza PI-FO-076.xlsx
   ↓
9. Python verifica si cumple criterios para PRI.xlsx
   ↓
10. Si cumple → Python actualiza PRI.xlsx con seguimientos
    ↓
11. main.js retorna { success: true, data: {...} }
    ↓
12. preload.js recibe respuesta
    ↓
13. renderer.js actualiza UI y muestra notificación toast
```

---

## 🔐 Sistema de Autenticación

### Flujo de Login

```
1. Usuario ingresa email y password
   ↓
2. renderer.js → window.electronAPI.authLoginV1({ email, password })
   ↓
3. preload.js → ipcRenderer.invoke('auth-login-v1', ...)
   ↓
4. main.js handler 'auth-login-v1':
   - Busca usuario en SQLite (kair.db)
   - Valida password con bcryptjs
   - Genera token de sesión
   - Obtiene asignaciones (empresas + roles)
   ↓
5. Retorna: { success: true, data: { token, user, companies } }
   ↓
6. renderer.js guarda token y actualiza estado de sesión
```

### Tablas SQLite

```sql
-- Usuarios
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT,
  password_hash TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Asignaciones (user-company-role)
CREATE TABLE assignments (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  company_key TEXT,
  role TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Sesiones
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  token TEXT UNIQUE,
  expires_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 📊 Handlers IPC por Módulo

### Módulo 1: Recursos (14 handlers)

| Handler | Función |
|---------|---------|
| `get-recursos-stats` | Estadísticas en tiempo real |
| `getPresupuestoFiles` | Obtener archivos de presupuesto |
| `readPresupuestoData` | Leer datos de presupuesto |
| `saveBudgetFile` | Guardar presupuesto |
| `duplicate-budget-file` | Duplicar presupuesto para nuevo año |
| `get-capacitaciones-sheets` | Obtener hojas de Excel |
| `update-capacitaciones-excel` | Actualizar capacitaciones |
| `duplicate-capacitaciones-sheet` | Clonar cronograma |
| `sync-inducciones-from-forms` | Sincronizar desde Google Forms |
| `check-inducciones-changes` | Verificar cambios |
| `get-inducciones-data` | Obtener datos de inducciones |
| `get-acta-data` | Datos para acta COPASST |
| `generate-copasst-acta` | Generar acta DOCX |
| `getConvivenciaActaData` | Datos para acta convivencia |

### Módulo 3: Gestión de la Salud (25+ handlers)

| Handler | Función |
|---------|---------|
| `get-ausentismo-data` | Leer PI-FO-076 |
| `get-pri-seguimiento-data` | Leer PRI.xlsx |
| `buscar-empleado-por-cedula` | Buscar en PI-FO-001 |
| `buscar-cie10-descripcion` | Buscar código CIE-10 |
| `procesar-ausentismo` | Registrar incapacidad |
| `save-follow-up` | Guardar seguimiento PRIC |
| `buscar-registros-cedula` | Buscar en PRI.xlsx |
| `export-incapacity-data` | Exportar a Excel |
| `get-follow-up-history` | Historial de seguimientos |
| `load-follow-up-data` | Cargar casos PRI |
| `investigacion-accidentes-select-accident-pdf` | Seleccionar PDF |
| `investigacion-accidentes-process-accident-pdf` | Procesar PDF |
| `investigacion-accidentes-analyze-accident` | Analizar con IA |
| `investigacion-accidentes-generate-accident-report` | Generar DOCX |
| ... | ... |

---

## 🎯 Decisiones Arquitectónicas Clave

### 1. Sistema Dual de Archivos (Ausentismo)

**Decisión:** Usar DOS archivos Excel complementarios (PI-FO-076 + PRI.xlsx)

**Razón:**
- PI-FO-076: Todas las incapacidades (lista general)
- PRI.xlsx: Solo casos especiales (≥ 10 días) con seguimientos detallados

**Ventajas:**
- Separación de responsabilidades
- Mejor rendimiento en búsquedas
- Seguimiento detallado sin sobrecargar archivo principal

### 2. Seguimientos Múltiples (Hasta 5)

**Decisión:** Indexar hasta 5 seguimientos por caso en columnas separadas

**Razón:**
- Casos complejos requieren múltiples seguimientos
- Columnas fijas (AB-AK) permiten fácil exportación
- Compatible con Power Query existente

### 3. IA con Mistral 3 3B

**Decisión:** Usar Mistral 3 3B Reasoning para análisis de accidentes

**Razón:**
- Multimodal (texto + imágenes)
- Buen rendimiento en español
- Costo-efectivo vs alternativas
- Soporte para contexto largo (8K tokens)

### 4. Sincronización Automática (Inducciones)

**Decisión:** Google Forms → Excel → App sin intervención manual

**Razón:**
- Elimina entrada manual de datos
- Reduce errores humanos
- Mantiene datos actualizados en tiempo real

### 5. Autenticación Local con SQLite

**Decisión:** Base de datos local para usuarios y roles

**Razón:**
- Sin dependencia de servidores externos
- Mayor seguridad (datos locales)
- Rendimiento óptimo

---

## 📈 Evolución de Métricas

| Versión | main.js (L) | renderer.js (L) | Handlers IPC | Módulos |
|---------|-------------|-----------------|--------------|---------|
| v0.1.50 | 4,766 | 3,170 | 55+ | 27 |
| v0.1.70 | 6,500 | 3,170 | 65+ | 27 |
| v0.1.75 | 7,852 | 3,170 | 78 | 27+ |

---

**Mantenido por:** Architecture Team  
**Última actualización:** 17 de marzo de 2026  
**Versión:** 1.0 (v0.1.75)  
**Próxima revisión:** Al alcanzar v0.1.80

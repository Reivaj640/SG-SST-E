# 👋 Bienvenido a la Documentación de K+AIR

**Tiempo de lectura:** 5 minutos
**Última actualización:** 18 de julio de 2026
**Versión:** 0.1.120

---

## 🎯 ¿Qué es K+AIR?

K+AIR es una aplicación empresarial Electron que implementa un Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) para empresas colombianas. Cumple con la Resolución 0312 de 2019.

**Características principales:**
- ✅ **Bandeja Integrada: Cliente Gmail completo** (v0.1.120) — OAuth + SQLite cache + Gmail-look UI + búsqueda con operadores + adjuntos reales + firma automática + auto-refresh
- ✅ Multi-empresa (una sola UX/UI)
- ✅ Motor normativo inteligente
- ✅ 9 módulos principales + 48 submódulos
- ✅ Python empaquetado (sin instalación manual)
- ✅ Autenticación con SQLite
- ✅ Actualizaciones automáticas
- ✅ Dashboard interactivo con KPIs y gráficas
- ✅ Sistema de alertas por vencimiento (COPASST/Convivencia)
- ✅ Generación automática de actas con autofill
- ✅ Login modernizado con animaciones
- ✅ Soporte responsive 1366x768+
- ✅ **Sistema de Skeleton Screens** (placeholders que imitan la forma del componente mientras carga)
- ✅ **Dual-tree workflow** (instalador built ↔ git clone, sincronización periódica)

---

## 📍 ¿Quién eres? Selecciona tu ruta:

### 👨‍💻 Soy Nuevo Desarrollador

**Ruta recomendada (30-45 minutos):**

1. **docs/03-guias/instalacion-configuracion.md** (10 min)
   - Instalar Node.js, Python (ya incluido)
   - Clonar repositorio
   - Ejecutar en modo desarrollo

2. **docs/02-architecture/arquitectura-general.md** (15 min)
   - Entender arquitectura Electron
   - Flujo Renderer ↔️ Preload ↔️ Main
   - Contratos IPC

3. **docs/02-architecture/ipc-contratos.md** (10 min)
   - **CRÍTICO:** Todos los handlers IPC
   - Formato de requests/responses
   - Ejemplos de uso

4. **docs/02-modulos/** (según tu módulo)
   - Cada módulo tiene su propia documentación
   - Incluye ejemplos de código

---

### 🤖 Soy IA (Cursor, Copilot, etc.)

**Ruta recomendada (15 minutos):**

1. **CONTEXT.md** (raíz del proyecto) - **LEER PRIMERO**
   - Contexto completo del proyecto
   - Arquitectura resumida
   - Estado actual (v0.1.110)
   - Enlaces críticos

2. **AGENTS.md** (raíz del proyecto) - **Convención de IA**
   - Skills disponibles (ui-ux-pro-max, code-architect, etc.)
   - Convención de commits (`📦<numero>`)
   - Patrón arquitectónico (prefijo `kair-`, BEM, vanilla JS)
   - Gotchas del proyecto (dark/light, estructura plana, actas semestrales)

3. **docs/02-architecture/ipc-contratos.md**
   - Todos los 137 handlers IPC (133+ `ipcMain.handle()` + 4 `ipcMain.on()`)
   - Formato de requests/responses
   - Ejemplos de uso

4. **docs/SKELETON-SYSTEM.md** + **docs/SKELETON-HOMES.md** (si vas a tocar loaders/UX)
   - Sistema centralizado de placeholders de carga
   - API `KairSkeleton.*` con 10 componentes
   - Patrón para homes de módulo (orden crítico: skeleton → appendChild → setTimeout(200) → loadStats)
   - Troubleshooting de bugs comunes

5. **docs/02-modulos/[módulo específico]**
   - Documentación del módulo relevante
   - Lógica de negocio específica

6. **CHANGELOG.md**
   - Historial de cambios por versión
   - Últimos cambios en v0.1.110

---

### 👤 Soy Usuario Final

**Ruta recomendada (10 minutos):**

1. **README.md** (raíz del proyecto)
   - Visión general
   - Características principales
   - Uso básico

2. **docs/03-guias/instalacion-configuracion.md** (sección 5)
- Solución de problemas comunes
- Errores de Python

3. **docs/acerca-de-actualizacion.md**
   - Cómo actualizar el sistema
   - Actualizaciones automáticas

---

### 🔧 Soy Mantenedor del Proyecto

**Ruta recomendada (20 minutos):**

1. **docs/03-guias/mantenimiento.md**
- Mantenimiento de documentación
- Convenciones de código
- Checklist de releases

2. **docs/05-updates/**
   - Cambios por versión
   - Decisiones técnicas
   - Migraciones requeridas

3. **CHANGELOG.md**
   - Historial completo
   - Formato Keep a Changelog

---

## 📁 Estructura de la Documentación

```
docs/
├── START_HERE.md                # Este archivo - Punto de entrada
│
├── 01-quick-start/              # Inicio rápido
│ ├── instalacion-configuracion.md # Instalación y configuración
│   ├── first-company.md         # Crear primera empresa
│ └── REQUISITOS.md # Requisitos del sistema
│
├── 02-architecture/ # Arquitectura
│ ├── arquitectura-general.md # Arquitectura general
│ ├── ipc-contratos.md # ⚠️ CRÍTICO - Contratos IPC
│ ├── infraestructura-cross-cutting.md # Componentes compartidos (Toast, Loading, KPI Ribbon)
│ ├── motor-normativo.md # Motor normativo 0312
│ ├── python-embedded.md # Python empaquetado
│ └── roles-permisos-rbac.md # Roles y permisos RBAC
│
├── 02-modulos/ # Módulos
│ ├── modulo-1-recursos.md # Módulo 1: Recursos (12 submódulos)
│ ├── modulo-2-4-5-6-7-gestion-integral-y-restantes.md # Módulo 2: Gestión Integral (13 submódulos)
│ ├── modulo-2-3-1-evaluacion-inicial-sg-sst.md # Submód 2.3.1: Evaluación Inicial
│ ├── modulo-2-5-1-archivo-retencion.md # Submód 2.5.1: Archivo y Retención
│ ├── modulo-2-10-1-evaluacion-seleccion.md # Submód 2.10.1: Evaluación y Selección
│ ├── modulo-2-11-1-gestion-del-cambio.md # Submód 2.11.1: Gestión del Cambio
│ ├── modulo-3-gestion-salud.md # Módulo 3: Gestión de la Salud (19 submódulos)
│ ├── modulo-4-gestion-peligros.md # Módulo 4: Gestión de Peligros (10 submódulos)
│ ├── modulo-5-gestion-amenazas.md # Módulo 5: Gestión de Amenazas (2 submódulos)
│ ├── modulo-6-verificacion.md # Módulo 6: Verificación (4 submódulos)
│ ├── modulo-7-mejoramiento.md # Módulo 7: Mejoramiento (4 submódulos)
│ └── alertas-recursos-dashboard.md # Alertas y Dashboard
│
├── 03-guias/ # Guías
│ ├── instalacion-configuracion.md # Instalación y configuración
│ ├── guia-contratos-backend.md # Contratos backend
│ ├── scripts-python.md # Scripts Python
│ ├── mantenimiento.md # Mantenimiento
│
├── 05-updates/                  # Actualizaciones por versión
│   ├── v0.1.83-python-optimization.md  # Esta semana
│   ├── v0.1.82-checksum-removal.md
│   ├── v0.1.81-cdn-resources.md
│   └── v0.1.80-python-embedded.md
│
└── _archivado/ # Archivado (nada eliminado)
    ├── reorganizacion-febrero-2026/
    ├── actualizaciones-v0.1.x/
    ├── arquitectura-v1/
    └── modulos-legacy/
```

---

## 🔗 Enlaces Rápidos

### Esenciales
| Documento | Propósito | Tiempo |
|-----------|-----------|--------|
| [CONTEXT.md](../CONTEXT.md) | Contexto para IA | 15 min |
| [README.md](../README.md) | Visión general | 10 min |
| [CHANGELOG.md](CHANGELOG.md) | Historial de cambios | Variable |

### Para Desarrolladores
| Documento | Propósito | Tiempo |
|-----------|-----------|--------|
| [docs/03-guias/instalacion-configuracion.md](03-guias/instalacion-configuracion.md) | Instalación | 10 min |
| [docs/02-architecture/arquitectura-general.md](02-architecture/arquitectura-general.md) | Arquitectura | 15 min |
| [docs/02-architecture/ipc-contratos.md](02-architecture/ipc-contratos.md) | Contratos IPC | 10 min |

### Para Mantenimiento
| Documento | Propósito | Tiempo |
|-----------|-----------|--------|
| [docs/03-guias/mantenimiento.md](03-guias/mantenimiento.md) | Mantenimiento | 10 min |
| [docs/05-updates/](05-updates/) | Actualizaciones | Variable |

---

## 🚀 Comandos Útiles

```bash
# Desarrollo
npm start

# Build (producción)
export GH_TOKEN=<tu_token>
npx electron-builder --win --publish=always

# Generar documentación API
npm run docs:generate

# Ver logs
npm run debug
```

---

## 📞 Recursos Adicionales

- **Repositorio:** https://github.com/Reivaj640/SG-SST-E
- **Releases:** https://github.com/Reivaj640/SG-SST-E/releases
- **API (JSDoc):** `/docs/api/` (generado automáticamente)

---

## ❓ ¿Necesitas Ayuda?

1. **Problemas técnicos:** Ver `docs/03-guias/instalacion-configuracion.md` (sección 5)
2. **Dudas de arquitectura:** Ver `docs/02-architecture/arquitectura-general.md`
3. **Dudas de módulos:** Ver `docs/02-modulos/[módulo]`
4. **Cambios recientes:** Ver `docs/05-updates/` o `CHANGELOG.md`

---

**Documento creado:** 19 de marzo de 2026  
**Propósito:** Punto de entrada único para toda la documentación  
**Mantenimiento:** Actualizar con nuevos enlaces y rutas

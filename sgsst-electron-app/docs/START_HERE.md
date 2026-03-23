# 👋 Bienvenido a la Documentación de K+AIR

**Tiempo de lectura:** 5 minutos
**Última actualización:** 22 de marzo de 2026
**Versión:** 0.1.91

---

## 🎯 ¿Qué es K+AIR?

K+AIR es una aplicación empresarial Electron que implementa un Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) para empresas colombianas. Cumple con la Resolución 0312 de 2019.

**Características principales:**
- ✅ Multi-empresa (una sola UX/UI)
- ✅ Motor normativo inteligente
- ✅ 7 módulos principales + 27 submódulos
- ✅ Python empaquetado (sin instalación manual)
- ✅ Autenticación con SQLite
- ✅ Actualizaciones automáticas

---

## 📍 ¿Quién eres? Selecciona tu ruta:

### 👨‍💻 Soy Nuevo Desarrollador

**Ruta recomendada (30-45 minutos):**

1. **docs/01-quick-start/installation.md** (10 min)
   - Instalar Node.js, Python (ya incluido)
   - Clonar repositorio
   - Ejecutar en modo desarrollo

2. **docs/02-architecture/overview.md** (15 min)
   - Entender arquitectura Electron
   - Flujo Renderer ↔️ Preload ↔️ Main
   - Contratos IPC

3. **docs/02-architecture/ipc-contracts.md** (10 min)
   - **CRÍTICO:** Todos los handlers IPC
   - Formato de requests/responses
   - Ejemplos de uso

4. **docs/03-modules/** (según tu módulo)
   - Cada módulo tiene su propia documentación
   - Incluye ejemplos de código

---

### 🤖 Soy IA (Cursor, Copilot, etc.)

**Ruta recomendada (15 minutos):**

1. **CONTEXT.md** (raíz del proyecto) - **LEER PRIMERO**
   - Contexto completo del proyecto
   - Arquitectura resumida
   - Estado actual (v0.1.85)
   - Enlaces críticos

2. **docs/02-architecture/ipc-contracts.md**
   - Todos los 78 handlers IPC
   - Formato de requests/responses
   - Ejemplos de uso

3. **docs/03-modules/[módulo específico]**
   - Documentación del módulo relevante
   - Lógica de negocio específica

4. **CHANGELOG.md**
   - Historial de cambios por versión
   - Últimos cambios en v0.1.87

---

### 👤 Soy Usuario Final

**Ruta recomendada (10 minutos):**

1. **README.md** (raíz del proyecto)
   - Visión general
   - Características principales
   - Uso básico

2. **docs/01-quick-start/troubleshooting.md**
   - Problemas comunes
   - Soluciones paso a paso
   - FAQs

3. **docs/acerca-de-actualizacion.md**
   - Cómo actualizar el sistema
   - Actualizaciones automáticas

---

### 🔧 Soy Mantenedor del Proyecto

**Ruta recomendada (20 minutos):**

1. **docs/04-guides/maintenance.md**
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
│   ├── installation.md          # Instalación y configuración
│   ├── first-company.md         # Crear primera empresa
│   └── troubleshooting.md       # Problemas comunes
│
├── 02-architecture/             # Arquitectura
│   ├── overview.md              # Arquitectura general
│   ├── ipc-contracts.md         # ⚠️ CRÍTICO - Contratos IPC
│   ├── normative-engine.md      # Motor normativo 0312
│   └── python-embedded.md       # Python empaquetado
│
├── 03-modules/                  # Módulos
│   ├── module-1-resources.md    # Módulo 1: Recursos
│   ├── module-2-health.md       # Módulo 2: Gestión de la Salud
│   ├── module-3-integral.md     # Módulo 3: Gestión Integral
│   └── ...                      # Resto de módulos
│
├── 04-guides/                   # Guías
│   ├── backend-contracts.md     # Contratos backend
│   ├── python-scripts.md        # Scripts Python
│   └── maintenance.md           # Mantenimiento
│
├── 05-updates/                  # Actualizaciones por versión
│   ├── v0.1.83-python-optimization.md  # Esta semana
│   ├── v0.1.82-checksum-removal.md
│   ├── v0.1.81-cdn-resources.md
│   └── v0.1.80-python-embedded.md
│
└── _archived/                   # Archivado (nada eliminado)
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
| [CHANGELOG.md](../CHANGELOG.md) | Historial de cambios | Variable |

### Para Desarrolladores
| Documento | Propósito | Tiempo |
|-----------|-----------|--------|
| [docs/01-quick-start/installation.md](01-quick-start/installation.md) | Instalación | 10 min |
| [docs/02-architecture/overview.md](02-architecture/overview.md) | Arquitectura | 15 min |
| [docs/02-architecture/ipc-contracts.md](02-architecture/ipc-contracts.md) | Contratos IPC | 10 min |

### Para Mantenimiento
| Documento | Propósito | Tiempo |
|-----------|-----------|--------|
| [docs/04-guides/maintenance.md](04-guides/maintenance.md) | Mantenimiento | 10 min |
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

1. **Problemas técnicos:** Ver `docs/01-quick-start/troubleshooting.md`
2. **Dudas de arquitectura:** Ver `docs/02-architecture/overview.md`
3. **Dudas de módulos:** Ver `docs/03-modules/[módulo]`
4. **Cambios recientes:** Ver `docs/05-updates/` o `CHANGELOG.md`

---

**Documento creado:** 19 de marzo de 2026  
**Propósito:** Punto de entrada único para toda la documentación  
**Mantenimiento:** Actualizar con nuevos enlaces y rutas

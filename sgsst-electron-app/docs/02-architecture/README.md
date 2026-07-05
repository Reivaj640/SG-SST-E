# 🏗️ Arquitectura - K+AIR

Este directorio contiene documentación sobre la arquitectura del sistema.

**Versión:** 1.1
**Actualizado:** 4 de julio de 2026
**Estado:** ✅ Actualizado v0.1.110

---

## 📋 Documentos Disponibles

### [arquitectura-general.md](arquitectura-general.md) - Arquitectura General
**Tiempo de lectura:** 15 minutos

**Contenido:**
- Arquitectura Electron completa
- Flujo Renderer ↔️ Preload ↔️ Main
- Base de datos SQLite
- Python empaquetado

---

### [ipc-contratos.md](ipc-contratos.md) - Contratos IPC
**Tiempo de lectura:** 10 minutos

**Contenido:**
- **CRÍTICO:** Todos los 137+ handlers IPC
- Formato de requests/responses
- Ejemplos de uso
- Contratos backend

---

### [motor-normativo.md](motor-normativo.md) - Motor Normativo
**Tiempo de lectura:** 10 minutos

**Contenido:**
- Motor normativo 0312
- Escenarios normativos
- Reglas de evaluación

---

### [ARQUITECTURA_AUSENTISMO_DUAL.md](ARQUITECTURA_AUSENTISMO_DUAL.md) - Sistema Dual de Ausentismo
**Tiempo de lectura:** 10 minutos

**Contenido:**
- Sistema PI-FO-076 + PRI.xlsx
- Flujo de archivos
- Sincronización automática

---

## 🆕 Sistema de Skeleton Screens (v0.1.110+)

Desde v0.1.110, el proyecto tiene un sistema centralizado de skeleton screens que reemplaza los spinners genéricos por placeholders que imitan la forma del componente real. Documentación:

- **Ver:** [../SKELETON-SYSTEM.md](../SKELETON-SYSTEM.md) — API completa (`KairSkeleton.*`) con 10 componentes
- **Ver:** [../SKELETON-HOMES.md](../SKELETON-HOMES.md) — Patrón para homes de módulo principales

### Resumen

- **API:** `window.KairSkeleton.kpiStrip(N)`, `.table(rows, cols)`, `.chartBars(12)`, `.chartDonut()`, etc.
- **Cobertura:** 25 loaders migrados en 13 vistas específicas + 7 homes de módulo principales
- **Auto-themed:** light/dark/dark-legacy via CSS variables (`--ks-base`, `--ks-highlight`)
- **Respeta `prefers-reduced-motion`:** animaciones se desactivan automáticamente

### Patrón crítico (homes)

```js
// 1. Inyectar skeleton
mainArea.innerHTML = KairSkeleton.kpiStrip(5) + KairSkeleton.chartBars(12);

// 2. Agregar al DOM (skeleton visible)
contentContainer.appendChild(mainArea);
layout.appendChild(contentContainer);
this.container.appendChild(layout);

// 3. Retardo 200ms (ojo registra el skeleton)
await new Promise(r => setTimeout(r, 200));

// 4. Cargar datos (skeleton visible mientras espera)
await this.refreshStats();

// 5. Renderizar widgets (limpia skeleton primero)
await this.renderMainArea(mainArea);  // container.innerHTML = '' al inicio
```

---

### [roles-permisos-rbac.md](roles-permisos-rbac.md) - Roles y Permisos (RBAC)
**Tiempo de lectura:** 10 minutos

**Contenido:**
- Sistema de roles por empresa
- Permisos por módulo
- Flujo de autenticación

---

### [infraestructura-cross-cutting.md](infraestructura-cross-cutting.md) - Componentes Cross-Cutting
**Tiempo de lectura:** 10 minutos

**Contenido:**
- ViewLoader (carga dinámica de vistas)
- KAIRToast (notificaciones, 4 tipos)
- UpdateNotificationManager (actualizaciones con progreso)
- Auto-Update (6 eventos, doble registro)
- Loading System (2 fases: ventana + overlay)
- KPI Stats Ribbon (`.k-stats-ribbon` BEM, diseño canónico)
- Header Card Pattern (`.k-section-card` v0.1.100, 22 módulos migrados)

---

### [python-embedded.md](python-embedded.md) - Python Empaquetado
**Tiempo de lectura:** 8 minutos

**Contenido:**
- Python 3.11.9 empaquetado desde v0.1.80
- Estructura de python-embed/
- Paquetes incluidos y excluidos
- Comunicación con Main Process
- Configuración para desarrollo local

---

## 🔗 Enlaces Relacionados

- **[START_HERE.md](../START_HERE.md)** - Punto de entrada principal
- **[CONTEXT.md](../../CONTEXT.md)** - Contexto del proyecto
- **[docs/02-modulos/](../02-modulos/)** - Documentación de módulos
  - [Módulo 4: Gestión de Peligros](../02-modulos/modulo-4-gestion-peligros.md) - 10 submódulos
  - [Módulo 5: Gestión de Amenazas](../02-modulos/modulo-5-gestion-amenazas.md) - 2 submódulos
  - [Módulo 6: Verificación](../02-modulos/modulo-6-verificacion.md) - 4 submódulos
  - [Módulo 7: Mejoramiento](../02-modulos/modulo-7-mejoramiento.md) - 4 submódulos

---

**Última actualización:** 9 de junio de 2026

# 📦 Documentación de Módulos K+AIR

**Versión:** 1.1
**Actualizado:** 4 de julio de 2026
**Estado:** ✅ Actualizado v0.1.110

---

## 📋 Índice de Módulos

| Módulo | Documentación | Submódulos | Componentes Reales |
|--------|---------------|------------|-------------------|
| **1. Recursos** | [modulo-1-recursos.md](modulo-1-recursos.md) | 12 | 12 ✅ |
| **2. Gestión Integral** | [modulo-2-4-5-6-7-gestion-integral-y-restantes.md](modulo-2-4-5-6-7-gestion-integral-y-restantes.md) | 9 | 8 ✅ / 1 🟡 |
| **3. Gestión de la Salud** | [modulo-3-gestion-salud.md](modulo-3-gestion-salud.md) | 12 | 10 ✅ / 2 🟡 |
| **4. Gestión de Peligros** | [modulo-4-gestion-peligros.md](modulo-4-gestion-peligros.md) | 4 | 4 ✅ |
| **5. Gestión de Amenazas** | [modulo-5-gestion-amenazas.md](modulo-5-gestion-amenazas.md) | 2 | 2 ✅ |
| **6. Verificación** | [modulo-6-verificacion.md](modulo-6-verificacion.md) | 3 | 3 ✅ |
| **7. Mejoramiento** | [modulo-7-mejoramiento.md](modulo-7-mejoramiento.md) | 4 | 4 ✅ |

**Total:** 7 módulos principales (con `helpers` y `shared` aparte), 48 submódulos con lógica, ~58 submódulos menú

> **Leyenda:** ✅ = Componente dedicado implementado, 🟡 = Generic fallback (redirige a vista del módulo)

### Skeleton Screens por módulo (📦483-491)

Los homes de los 7 módulos principales tienen skeleton screens implementados:

| Módulo | Home | Skeleton | Doc |
|---|---|---|---|
| Gestión Integral | `gestion-integral-home.js` | `kpiStrip(5) + 2×chartBars(12)` | [SKELETON-HOMES.md](SKELETON-HOMES.md) |
| Recursos | `recursos-home.js` | `kpiStrip(6) + 3×chartBars(12)` | idem |
| Gestión de la Salud | `gestion-salud-home.js` | `kpiStrip(6) + 2×chartBars(12)` | idem |
| Gestión de Peligros | `gestion-peligros-home.js` | `kpiStrip(5) + chartBars(12) + chartDonut()` | idem |
| Gestión de Amenazas | `gestion-amenazas-home.js` | `kpiStrip(2) + chartBars(12) + chartDonut()` | idem |
| Verificación | `verificacion-home.js` | `kpiStrip(6) + chartBars(12) + chartDonut()` | idem |
| Mejoramiento | `mejoramiento-home.js` | `kpiStrip(5) + chartBars(12) + chartDonut()` | idem |

---

## 📄 Documentos Especializados

| Documento | Propósito |
|-----------|-----------|
| [modulo-2-3-1-evaluacion-inicial-sg-sst.md](modulo-2-3-1-evaluacion-inicial-sg-sst.md) | Evaluación Inicial SG-SST (detallado) |
| [modulo-2-5-1-archivo-retencion.md](modulo-2-5-1-archivo-retencion.md) | Archivo y Retención Documental (detallado) |
| [modulo-2-10-1-evaluacion-seleccion.md](modulo-2-10-1-evaluacion-seleccion.md) | Evaluación y Selección Proveedores (detallado) |
| [modulo-2-11-1-gestion-del-cambio.md](modulo-2-11-1-gestion-del-cambio.md) | Gestión del Cambio — Wizard 4 pasos (detallado) |
| [modulo-3-2-2-investigacion-accidentes-ia.md](modulo-3-2-2-investigacion-accidentes-ia.md) | Investigación de Accidentes con IA (detallado) |
| [modulo-3-3-6-ausentismo.md](modulo-3-3-6-ausentismo.md) | Medición del Ausentismo (detallado) |
| [alertas-recursos-dashboard.md](alertas-recursos-dashboard.md) | Sistema de alertas y dashboard |

---

## 🔗 Arquitectura Relacionada

| Documento | Propósito |
|-----------|-----------|
| [../02-architecture/arquitectura-general.md](../02-architecture/arquitectura-general.md) | Arquitectura general del sistema |
| [../02-architecture/ipc-contratos.md](../02-architecture/ipc-contratos.md) | Contratos IPC (NO TOCAR) |
| [../02-architecture/roles-permisos-rbac.md](../02-architecture/roles-permisos-rbac.md) | Roles y permisos RBAC |
| [../02-architecture/infraestructura-cross-cutting.md](../02-architecture/infraestructura-cross-cutting.md) | Componentes cross-cutting (viewLoader, Toast, Auto-Update, Loading, KPI Ribbon) |
| [../02-architecture/python-embedded.md](../02-architecture/python-embedded.md) | Python 3.11.9 empaquetado |

---

**Mantenido por:** Product Architect & Full-Stack Team
**Última actualización:** 9 de junio de 2026
**Versión:** 1.0 (v0.1.99)

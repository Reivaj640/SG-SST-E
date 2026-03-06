# 📚 Archivado de Documentación K+AIR

**Propósito:** Preservar documentación histórica que ha sido reemplazada por versiones actualizadas.

**Política:** NO eliminar documentación, solo archivar cuando sea reemplazada por versión nueva.

---

## 📁 Estructura de Archivado

```
_archivado/
├── reorganizacion-febrero-2026/    # Documentación de reorganización Feb 2026
├── actualizaciones-v0.1.x/          # Actualizaciones por versión (legacy)
├── arquitectura-v1/                 # Arquitectura legacy (v1)
└── modulos-legacy/                  # Documentación de módulos legacy
```

---

## 📦 Archivos Archivados

### Reorganización Febrero 2026

| Archivo Original | Nueva Ubicación | Razón |
|-----------------|-----------------|-------|
| `ESTADO_ACTUAL_REORGANIZACION.md` | `_archivado/reorganizacion-febrero-2026/` | Reemplazado por nueva estructura |
| `LIMPIEZA_REORGANIZACION_FEB_2026.md` | `_archivado/reorganizacion-febrero-2026/` | Documentación histórica |
| `README-LIMPIEZA.md` | `_archivado/reorganizacion-febrero-2026/` | Documentación histórica |

### Actualizaciones por Versión

| Archivo Original | Nueva Ubicación | Razón |
|-----------------|-----------------|-------|
| `ACTUALIZACION_v0.1.48_SEGUIMIENTO_PRIC.md` | `_archivado/actualizaciones-v0.1.x/` | Reemplazado por docs de módulo consolidadas |
| `ACTUALIZACION_v0.1.49_SEGUIMIENTO.md` | `_archivado/actualizaciones-v0.1.x/` | Reemplazado |
| `ACTUALIZACION_v0.1.51_CALIFICACION_PCL.md` | `_archivado/actualizaciones-v0.1.x/` | Reemplazado |
| `ACTUALIZACION_v0.1.52_INFORME_PRI_BUILDER.md` | `_archivado/actualizaciones-v0.1.x/` | Reemplazado |
| `RESUMEN_CAMBIOS_v0.1.49.md` | `_archivado/actualizaciones-v0.1.x/` | Reemplazado |
| `RESUMEN_CAMBIOS_v0.1.50.md` | `_archivado/actualizaciones-v0.1.x/` | Reemplazado |
| `RESUMEN_CAMBIOS_v0.1.70_INDUCCIONES.md` | `_archivado/actualizaciones-v0.1.x/` | Reemplazado |

### Arquitectura Legacy

| Archivo Original | Nueva Ubicación | Razón |
|-----------------|-----------------|-------|
| `arquitectura.md` | `_archivado/arquitectura-v1/` | Reemplazado por `01-arquitectura/arquitectura-general.md` |
| `ARQUITECTURA_V2.md` | `_archivado/arquitectura-v1/` | Consolidado en arquitectura-general.md |
| `archivos-clave.md` | `_archivado/arquitectura-v1/` | Contenido migrado |

### Módulos Legacy

| Archivo Original | Nueva Ubicación | Razón |
|-----------------|-----------------|-------|
| `modulo-ausentismo.md` | `_archivado/modulos-legacy/` | Consolidado en `02-modulos/modulo-3-gestion-salud.md` |
| `modulo-inducciones.md` | `_archivado/modulos-legacy/` | Consolidado en `02-modulos/modulo-1-recursos.md` |
| `modulo-investigacion-accidentes.md` | `_archivado/modulos-legacy/` | Consolidado |
| `ui-update-responsable-sg.md` | `_archivado/modulos-legacy/` | Reemplazado |
| `ui-update-roles-responsabilidades.md` | `_archivado/modulos-legacy/` | Reemplazado |

### Índices y Resúmenes Legacy

| Archivo Original | Nueva Ubicación | Razón |
|-----------------|-----------------|-------|
| `INDICE_DOCUMENTACION.md` | `_archivado/` | Reemplazado por nuevo README.md |
| `RESUMEN_EJECUTIVO.md` | `_archivado/` | Contenido migrado |
| `PROJECT_OVERVIEW.md` | `_archivado/` | Contenido migrado |
| `analisis-evaluacion-inicial-sg-sst.md` | `_archivado/modulos-legacy/` | Consolidado |
| `analisis-evaluacion-inicial-sg-sst-actualizado.md` | `_archivado/modulos-legacy/` | Consolidado |

### Documentación Técnica Legacy

| Archivo Original | Nueva Ubicación | Razón |
|-----------------|-----------------|-------|
| `renderer.md` | `_archivado/arquitectura-v1/` | Contenido migrado |
| `motor-normativo.md` | `_archivado/arquitectura-v1/` | Reemplazado por `01-arquitectura/motor-normativo.md` |
| `escenarios-normativos.md` | `_archivado/arquitectura-v1/` | Consolidado |
| `flujo-creacion-empresa.md` | `_archivado/` | Reemplazado por `03-guias/flujo-creacion-empresa.md` |
| `scripts-python.md` | `_archivado/` | Reemplazado por `03-guias/scripts-python.md` |
| `mantenimiento-documentacion.md` | `_archivado/` | Reemplazado por `03-guias/mantenimiento.md` |
| `DEPENDENCIAS.md` | `_archivado/` | Reemplazado por `03-guias/instalacion-configuracion.md` |

### Documentación de API Test

| Archivo Original | Nueva Ubicación | Razón |
|-----------------|-----------------|-------|
| `api-test/` | `_archivado/api-test/` | Tests legacy |

---

## 🔄 Proceso de Archivado

### Cuando Archivar

1. Documentación es reemplazada por versión nueva
2. Documentación es de versión anterior (v0.1.x)
3. Documentación ya no es precisa pero tiene valor histórico

### Cuándo NO Archivar

1. Documentación aún es precisa y útil
2. Documentación es complementaria (no duplicada)
3. Documentación es de referencia técnica (contratos IPC)

### Pasos para Archivar

```bash
# 1. Crear directorio de archivado si no existe
mkdir docs/_archivado/[categoria]

# 2. Mover archivos
mv docs/archivo-legacy.md docs/_archivado/[categoria]/

# 3. Actualizar referencias en docs actuales
#    (si hay enlaces que apuntan al archivo movido)

# 4. Commit
git add docs/
git commit -m "docs: Archivar documentación legacy de [categoria]"
```

---

## 📝 Notas Importantes

1. **Preservar histórico:** Los archivos archivados NO se eliminan
2. **Referencias claras:** Documentar dónde está el reemplazo actualizado
3. **Acceso fácil:** Mantener estructura de archivado organizada
4. **Búsqueda:** Los archivos archivados siguen siendo buscables en Git

---

**Última actualización:** 6 de marzo de 2026  
**Responsable:** Product Architect

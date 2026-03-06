# 📊 Reorganización de Documentación - Marzo 2026

**Fecha:** 6 de marzo de 2026  
**Responsable:** Product Architect & Full-Stack Team  
**Estado:** ✅ Completado

---

## 🎯 Objetivo

Reorganizar la documentación del proyecto K+AIR para:
1. Tener un **único archivo de entrada** para IA y nuevos desarrolladores
2. **Consolidar documentación** dispersa en archivos modulares
3. **Archivar documentación obsoleta** sin eliminarla
4. **Facilitar mantenimiento** futuro

---

## 📁 Nueva Estructura

### Raíz de docs/ (11 archivos → 7 archivos)

**Antes:** 137 archivos dispersos en raíz  
**Ahora:** 7 archivos en raíz + estructura organizada

```
docs/
├── README.md                        # 📍 ARCHIVO MAESTRO - Leer primero
├── CHANGELOG.md                     # Historial de versiones
├── acerca-de-actualizacion.md       # (pendiente de migrar)
├── ARQUITECTURA_AUSENTISMO_DUAL.md  # (pendiente de migrar)
├── informacion-mapeo.md             # (pendiente de migrar)
├── jsdoc.json                       # Configuración JSDoc
├── ONLYOFFICE_SETUP.md              # (pendiente de migrar)
│
├── 01-arquitectura/                 # ✅ Nueva
│   ├── arquitectura-general.md      # Arquitectura consolidada
│   ├── ipc-contratos.md             # ⚠️ CRÍTICO - Contratos IPC
│   └── motor-normativo.md           # Motor normativo
│
├── 02-modulos/                      # ✅ Nueva
│   ├── modulo-1-recursos.md         # Módulo 1 completo
│   ├── modulo-2-4-5-6-7-*.md        # Módulos 2,4,5,6,7
│   └── modulo-3-gestion-salud.md    # Módulo 3 (IA + Ausentismo)
│
├── 03-guias/                        # ✅ Nueva
│   ├── instalacion-configuracion.md # Setup completo
│   ├── mantenimiento.md             # Mantenimiento de docs
│   ├── flujo-creacion-empresa.md    # Crear empresa
│   └── scripts-python.md            # Scripts Python
│
├── 04-api/                          # Generada automáticamente
│   └── [JSDoc generado]
│
└── _archivado/                      # ✅ Nueva
    ├── README.md                    # Índice de archivado
    ├── reorganizacion-febrero-2026/ # Reorganización Feb 2026
    ├── actualizaciones-v0.1.x/      # Actualizaciones por versión
    ├── arquitectura-v1/             # Arquitectura legacy
    └── modulos-legacy/              # Módulos legacy
```

---

## 📊 Estadísticas de Migración

### Archivos Creados (Nuevos)

| Directorio | Archivos | Descripción |
|------------|----------|-------------|
| `01-arquitectura/` | 3 | Arquitectura, IPC Contratos, Motor Normativo |
| `02-modulos/` | 3 | Módulos 1, 3, y 2-4-5-6-7 consolidados |
| `03-guias/` | 4 | Instalación, Mantenimiento, Flujo, Scripts |
| `_archivado/` | 1 | README de archivado |
| **Total** | **11** | Archivos nuevos creados |

### Archivos Movidos a Archivado

| Categoría | Cantidad | Ejemplos |
|-----------|----------|----------|
| Reorganización Feb 2026 | 3 | ESTADO_ACTUAL_REORGANIZACION.md, etc. |
| Actualizaciones v0.1.x | 9 | ACTUALIZACION_*.md, RESUMEN_CAMBIOS_*.md |
| Arquitectura v1 | 6 | arquitectura.md, ARQUITECTURA_V2.md, etc. |
| Módulos Legacy | 5 | modulo-*.md, analisis-*.md |
| Varios | 6 | INDICE_DOCUMENTACION.md, PROJECT_OVERVIEW.md, etc. |
| **Total** | **29** | Archivos movidos a archivado |

### Archivos en Raíz (Conservados)

| Archivo | Estado | Notas |
|---------|--------|-------|
| `README.md` | ✅ Nuevo | Archivo maestro unificado |
| `CHANGELOG.md` | ✅ Conservado | Historial de versiones |
| `acerca-de-actualizacion.md` | ⚠️ Pendiente | Migrar a 03-guias/ |
| `ARQUITECTURA_AUSENTISMO_DUAL.md` | ⚠️ Pendiente | Migrar a 01-arquitectura/ |
| `informacion-mapeo.md` | ⚠️ Pendiente | Migrar a 03-guias/ |
| `ONLYOFFICE_SETUP.md` | ⚠️ Pendiente | Migrar a 03-guias/ |
| `jsdoc.json` | ✅ Conservado | Configuración JSDoc |

---

## 🔄 Cambios Principales

### 1. Archivo Maestro Único

**Antes:**
- 137 archivos en raíz
- No había un punto de entrada claro
- IA tenía que buscar entre muchos archivos

**Ahora:**
- `README.md` (raíz) es el ÚNICO archivo de entrada
- Estructura clara de navegación
- IA lee primero README.md (raíz), luego va a docs/ específicos

### 2. Documentación de Arquitectura Consolidada

**Antes:**
- `arquitectura.md` (v1 legacy)
- `ARQUITECTURA_V2.md` (v2)
- `archivos-clave.md` (descripción de archivos)
- Información dispersa

**Ahora:**
- `01-arquitectura/arquitectura-general.md` (consolida v1 + v2 + archivos-clave)
- `01-arquitectura/ipc-contratos.md` (CRÍTICO - todos los contratos IPC)
- `01-arquitectura/motor-normativo.md` (motor normativo completo)

### 3. Documentación de Módulos Consolidada

**Antes:**
- `modulo-ausentismo.md`
- `modulo-inducciones.md`
- `modulo-investigacion-accidentes.md`
- Información de módulos dispersa

**Ahora:**
- `02-modulos/modulo-1-recursos.md` (todos los submódulos de Recursos)
- `02-modulos/modulo-3-gestion-salud.md` (Salud con IA y Ausentismo)
- `02-modulos/modulo-2-4-5-6-7-gestion-integral-y-restantes.md`

### 4. Guías Prácticas

**Antes:**
- `DEPENDENCIAS.md` (instalación)
- `mantenimiento-documentacion.md`
- `scripts-python.md`
- `flujo-creacion-empresa.md`

**Ahora:**
- `03-guias/instalacion-configuracion.md` (consolida DEPENDENCIAS + setup)
- `03-guias/mantenimiento.md` (mantenimiento de docs)
- `03-guias/flujo-creacion-empresa.md`
- `03-guias/scripts-python.md`

---

## 📋 Reglas de Mantenimiento Futuro

### Para Nuevos Desarrolladores / IA

```
1. Leer docs/README.md (5 min)
2. Leer docs/01-arquitectura/arquitectura-general.md (15 min)
3. Leer docs/01-arquitectura/ipc-contratos.md (si toca backend) (10 min)
4. Leer docs/02-modulos/modulo-X.md (módulo específico) (10 min)
```

### Para Actualizaciones

| Tipo de Cambio | Archivo a Actualizar |
|----------------|---------------------|
| Nuevo handler IPC | `01-arquitectura/ipc-contratos.md` |
| Cambio en módulo | `02-modulos/modulo-X.md` + sección "Cambios Recientes" |
| Nueva dependencia | `03-guias/instalacion-configuracion.md` |
| Cambio arquitectónico | `01-arquitectura/arquitectura-general.md` |
| Feature mayor | `CHANGELOG.md` |

### Para Archivado

```bash
# Cuando documentación queda obsoleta
mkdir docs/_archivado/[categoria]
mv docs/archivo-legacy.md docs/_archivado/[categoria]/
# NO eliminar, solo archivar
```

---

## ✅ Verificación Final

### Estructura de Directorios

- [x] `docs/01-arquitectura/` creada con 3 archivos
- [x] `docs/02-modulos/` creada con 3 archivos
- [x] `docs/03-guias/` creada con 4 archivos
- [x] `docs/_archivado/` creada con subcarpetas
- [x] `docs/README.md` maestro creado

### Archivos Críticos

- [x] README.md - Archivo de entrada único
- [x] ipc-contratos.md - Contratos IPC (NO TOCAR)
- [x] arquitectura-general.md - Arquitectura consolidada
- [x] modulo-3-gestion-salud.md - Módulo más crítico (IA + Ausentismo)
- [x] modulo-1-recursos.md - Módulo Recursos (con Inducciones 🆕)

### Scripts y Configuración

- [x] `npm run docs:generate` - Funciona con jsdoc.json existente
- [x] `jsdoc.json` - Apunta a `docs/04-api/`
- [x] `package.json` - Scripts de docs correctos

### Archivado

- [x] 29 archivos movidos a `_archivado/`
- [x] Subcarpetas organizadas por categoría
- [x] README.md en `_archivado/` explica estructura
- [x] Nada eliminado, todo preservado

---

## 🎯 Próximos Pasos (Opcional)

### Migraciones Pendientes

Los siguientes archivos en raíz podrían migrarse:

| Archivo | Destino Sugerido | Prioridad |
|---------|------------------|-----------|
| `acerca-de-actualizacion.md` | `_archivado/` | 🟢 Baja |
| `ARQUITECTURA_AUSENTISMO_DUAL.md` | `01-arquitectura/` | 🟡 Media |
| `informacion-mapeo.md` | `03-guias/` | 🟡 Media |
| `ONLYOFFICE_SETUP.md` | `03-guias/` | 🟢 Baja |

### Mejoras Futuras

- [ ] Migrar archivos pendientes de raíz
- [ ] Consolidar `informacion-mapeo.md` en guía de creación de empresa
- [ ] Agregar diagramas de secuencia IPC en `01-arquitectura/`
- [ ] Crear script de verificación de enlaces rotos

---

## 📝 Conclusión

La documentación de K+AIR ahora está:

✅ **Organizada** - Estructura clara de 4 carpetas principales  
✅ **Accesible** - Único archivo de entrada (README.md)  
✅ **Mantenible** - Fácil de actualizar y extender  
✅ **Preservada** - Nada eliminado, todo archivado  
✅ **Lista para IA** - IA puede entender el sistema leyendo docs en orden

**Tiempo estimado de migración:** 2 horas  
**Archivos creados:** 11 nuevos  
**Archivos migrados:** 29 a archivado  
**Reducción de complejidad:** De 137 archivos en raíz a 7 + estructura organizada

---

**Documentado por:** Product Architect & Full-Stack Team  
**Fecha:** 6 de marzo de 2026  
**Versión:** 1.0

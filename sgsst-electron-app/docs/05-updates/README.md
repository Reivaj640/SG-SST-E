# 📬 Actualizaciones de K+AIR

Este directorio contiene la documentación detallada de cada versión de K+AIR.

---

## 📋 Versiones Disponibles

### v0.1.83 - 19 de marzo de 2026
**[v0.1.83-python-optimization.md](v0.1.83-python-optimization.md)**

**Cambios principales:**
- ✅ Exclusión de torch del build (reduce tamaño en 44%)
- ✅ Eliminación de checksum en map_directory.py (mapeo 150x más rápido)
- ✅ Recursos locales (bootstrap-icons, font-awesome, Roboto)
- ✅ waitForElement mejorado con retry logic

**Impacto:**
- Build: 15-25 min → 8-12 min (-50%)
- Tamaño installer: ~800 MB → ~450 MB (-44%)
- Mapeo: 1500s → <10s (-99.3%)

---

### v0.1.80 - 18 de marzo de 2026
**[IMPLEMENTACION_PYTHON_EMPAQUETADO_v0.1.80.md](IMPLEMENTACION_PYTHON_EMPAQUETADO_v0.1.80.md)**

**Cambios principales:**
- ✅ Python 3.11.9 empaquetado en el installer
- ✅ 79+ paquetes Python pre-instalados
- ✅ Sin instalación manual de Python requerida

**Impacto:**
- Tamaño installer: ~50 MB → ~300 MB
- Cero configuración para el cliente final

---

## 📝 Formato de Documentación

Cada archivo de actualización debe incluir:

1. **Resumen Ejecutivo** - Cambios principales e impacto
2. **Cambios Detallados** - Código modificado, archivos afectados
3. **Métricas** - Tiempos, tamaños, mejoras cuantificadas
4. **Breaking Changes** - Funciones deshabilitadas o modificadas
5. **Checklist de Verificación** - Pasos para probar post-build
6. **Lecciones Aprendidas** - Qué funcionó, qué no, recomendaciones

---

## 🔗 Enlaces Relacionados

- **[CHANGELOG.md](../CHANGELOG.md)** - Historial completo de cambios
- **[CONTEXT.md](../CONTEXT.md)** - Contexto del proyecto
- **[docs/START_HERE.md](../START_HERE.md)** - Punto de entrada

---

**Última actualización:** 19 de marzo de 2026

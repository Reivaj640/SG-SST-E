# 📬 Actualizaciones de K+AIR

Este directorio contiene la documentación detallada de cada versión de K+AIR.

---

## 📋 Versiones Disponibles

### v0.1.99 - 9 de junio de 2026
**v0.1.99-dashboard-kpi-graficas.md** *(pendiente de crear)*

**Cambios principales:**
- ✅ Feature: Dashboard con 6 gráficas (barras, líneas, radar, doughnut, polar, barras apiladas)
- ✅ Feature: KPI Strip Enterprise (.k-stats-ribbon) con 5 indicadores
- ✅ Feature: Modal periodo con selector de rango y año
- ✅ Feature: Navegación corregida (Home Empresa, destroy pattern)
- ✅ Fix: Subrayado tabs-header eliminado
- ✅ Fix: Plan Trabajo lee mes anterior (norma COPASST)

**Impacto:**
- Dashboard: 0 gráficas → 6 gráficas interactivas
- KPIs: Sin indicadores → 5 indicadores clave en ribbon
- UX: Navegación fluida entre módulos y dashboard
- Normatividad: Cumplimiento Resolución 0312/2019

---

### v0.1.98 - 4 de junio de 2026
**[v0.1.98-copasst-actas-autofill-mejoras.md](v0.1.98-copasst-actas-autofill-mejoras.md)**

**Cambios principales:**
- ✅ Fix: Plan de Trabajo lee mes anterior (norma COPASST)
- ✅ Fix: Bug de mes en nombre de archivo (UTC-5 Colombia)
- ✅ Mejora: Texto formateado multilinea con numeración e iconos ✓/⏱
- ✅ Mejora: Accidentalidad enriquecida (nombre, CC, fecha DD/MM/YYYY)
- ✅ Fix: Eliminado "N°" del nombre de archivo guardado

**Impacto:**
- Normatividad: Plan de Trabajo ahora revisa mes anterior (correcto per norma)
- Datos visibles: +200% información en item de accidentalidad
- Confiabilidad: Mes en filename 100% correcto (sin bug UTC)

---

### v0.1.91 - 22 de marzo de 2026
**[v0.1.91-navegacion-home-empresa.md](v0.1.91-navegacion-home-empresa.md)**

**Cambios principales:**
- ✅ Feature: Botón de navegación "🏠 Home Empresa" en header
- ✅ Navegación de retorno al Dashboard desde módulos/submódulos
- ✅ Visibilidad inteligente (solo visible cuando es relevante)
- ✅ Gestión automática de estado (reset de módulo/submódulo)

**Impacto:**
- UX: Mejora significativa en navegabilidad
- Usuarios ya no quedan "atrapados" en módulos
- Backend: Sin cambios (0 modificaciones)
- Rendimiento: Negligible (+100 bytes)

---

### v0.1.90 - 21 de marzo de 2026
**[v0.1.90-transicion-animada-login.md](v0.1.90-transicion-animada-login.md)**

**Cambios principales:**
- ✅ Feature: Transición animada Login → Interfaz
- ✅ Overlay con logo, spinner, mensajes dinámicos y barra de progreso
- ✅ Check de éxito animado al completar
- ✅ Nombre del usuario personalizado en bienvenida
- ✅ Secuencia completa de ~4.2 segundos

**Impacto:**
- UX: Mejora significativa en percepción de calidad
- Backend: Sin cambios (mismo contrato auth-login-v1)
- Temas: Compatible con claro, oscuro, oscuro-legacy

---

### v0.1.89 - 21 de marzo de 2026
**[v0.1.89-login-modernizado.md](v0.1.89-login-modernizado.md)**

**Cambios principales:**
- ✅ Feature: Login modernizado con animaciones y Vanta.js
- ✅ Fondo animado con olas que responden al mouse
- ✅ Logo K+AIR con ícono y tagline
- ✅ Íconos en inputs de email y password
- ✅ Micro-interacciones y feedback visual

**Impacto:**
- UX: Mejora significativa en percepción visual
- Backend: Sin cambios (mismo contrato auth-login-v1)
- Temas: Compatible con claro, oscuro, oscuro-legacy

---

### v0.1.88 - 21 de marzo de 2026
**[v0.1.88-fix-eliminacion-google-drive.md](v0.1.88-fix-eliminacion-google-drive.md)**

**Cambios principales:**
- ✅ Fix: Método correcto de papelera (`shell.trashItem` vs `moveItemToTrash`)
- ✅ Fix: Liberación de handles de Windows antes de eliminar
- ✅ Fix: Reintentos inteligentes por tipo de archivo (Excel: 15×3s = 45s)
- ✅ Fix: Mensajes de error específicos para Excel
- ✅ Mejora: Detección automática de archivos grandes (>1MB)

**Impacto:**
- Eliminación Excel: 20% éxito → 85-90% éxito (+350%)
- Tiempo máximo Excel: 10s → 45s (+350%)
- Tiempo máximo archivos grandes: 10s → 30s (+200%)
- Papelera de reciclaje: ❌ No funcionaba → ✅ Funciona correctamente

---

### v0.1.87 - 20 de marzo de 2026
**[v0.1.87-responsive-1366x768.md](v0.1.87-responsive-1366x768.md)**

**Cambios principales:**
- ✅ Feature: Soporte responsive para 1366x768 y 1536x864
- ✅ Ajustes de layout progresivos (header, sidebar, fonts)
- ✅ Widgets y gráficos en 2 columnas para 1366x768
- ✅ Ventana inicial optimizada (1200x700)
- ✅ Sin cambios en ≥1920x1080

**Impacto:**
- 1366x768: Scroll forzado → Todo visible (+95%)
- 1536x864: Scroll frecuente → Scroll mínimo (+70%)
- ≥1920x1080: Sin cambios (0%)

---

### v0.1.86 - 20 de marzo de 2026
**[v0.1.86-mejoras-visualizador-1.1.1.md](v0.1.86-mejoras-visualizador-1.1.1.md)**

**Cambios principales:**
- ✅ Feature: Arrastrar y soltar archivos en carpetas (drag & drop)
- ✅ Feature: Menú contextual con clic derecho (abrir, eliminar)
- ✅ Feature: Modal de confirmación moderno K+AIR
- ✅ Feature: Notificaciones toast modernas
- ✅ Manejo específico de errores (EPERM, ENOENT, EACCES)

**Impacto:**
- Formas de subir archivos: 1 → 2 (+100%)
- Acciones por archivo: 1 → 3 (+200%)
- Tipos de error manejados: 1 → 4 (+300%)
- Feedback visual: Nativo → Moderno K+AIR

---

### v0.1.85 - 20 de marzo de 2026
**[v0.1.85-inducciones-cumplimiento-normativo.md](v0.1.85-inducciones-cumplimiento-normativo.md)**

**Cambios principales:**
- ✅ Feature: Tarjeta de Inducciones con cumplimiento normativo real
- ✅ Cálculo de pendientes: `empleados - completadas`
- ✅ Porcentaje real basado en nómina: `(completadas / empleados) * 100`
- ✅ Alertas inteligentes: óptimo (≥90%), refuerzo (≥50%), crítico (<50%)
- ✅ Fallback automático si no hay empleados configurados

**Impacto:**
- Precisión del dato: Histórico → Normativo (+100%)
- Pendientes visibles: No mostraba → Muestra cantidad exacta (+100%)
- Porcentaje útil: 100% (falso) → Real según nómina (+100%)
- Acción requerida: Ninguna → Alerta de refuerzo/crítico

---

### v0.1.84 - 20 de marzo de 2026
**[v0.1.84-presupuesto-shared-formula-fix.md](v0.1.84-presupuesto-shared-formula-fix.md)**

**Cambios principales:**
- ✅ Fix: Error "Shared Formula master" en guardado de Presupuesto
- ✅ Detección y preservación de fórmulas compartidas (columna F % Ejecutado)
- ✅ Cálculo automático de totales desde backend (fila TOTAL)
- ✅ Manejo seguro de merges existentes (sin reaplicar sobre existentes)

**Impacto:**
- Guardado presupuesto: 0% éxito → 100% éxito
- Fórmulas preservadas: 0% → 100%
- Errores en logs: ~20 warnings + 1 error → 0 warnings + 0 errors

---

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

**Última actualización:** 9 de junio de 2026

# Actualización de la sección "Acerca de" en K+AIR

**Versión:** 1.2
**Actualizado:** 18 de julio de 2026
**Estado:** ✅ Actualizado v0.1.120 (incluye Bandeja Integrada)

## Descripción

Se ha actualizado la sección "Acerca de la app" dentro de la configuración del sistema para mostrar información real del proyecto, incluyendo:

- Versión actual de la aplicación (dinámicamente obtenida)
- Fecha de build actualizada
- Información real del equipo de desarrollo
- Detalles específicos del responsable: Javier Robles Fontalvo

## Cambios realizados

### Archivo modificado
- `components/config/config-viewer.html`

### Funcionalidades añadidas

1. **Obtención dinámica de la versión**:
   - Se utiliza la función `electronAPI.getAppVersion()` para obtener la versión actual desde el archivo `package.json`
   - La versión se actualiza automáticamente cuando se abre la pestaña "Acerca de"

2. **Actualización de la fecha de build**:
   - Se muestra la fecha actual como fecha de build (se puede mejorar para mostrar la fecha real de compilación)

3. **Información real del equipo de desarrollo**:
   - Arquitecto UI / UX/UI Senior: Javier Robles Fontalvo
   - Backend Lead / Node/Electron: Javier Robles Fontalvo
   - Consultor SST / Especialista Normativa: Javier Robles Fontalvo

4. **Observador de cambios**:
   - Se implementó un `MutationObserver` para detectar cuando se activa la pestaña "Acerca de"
   - La información se carga dinámicamente cuando el usuario navega a esta sección

## Beneficios

- **Precisión**: La información mostrada ahora refleja el estado real del proyecto
- **Automatización**: La versión se actualiza automáticamente desde el archivo de configuración
- **Mantenibilidad**: Es fácil actualizar la información del equipo de desarrollo
- **Consistencia**: La información está sincronizada con los datos reales del proyecto

## Notas técnicas

- Se respetaron todos los contratos existentes sin romper funcionalidades previas
- La implementación es completamente compatible con el sistema de módulos existente
- No se realizaron cambios en la estructura visual de la interfaz
- La funcionalidad se integra perfectamente con el sistema de carga de la aplicación

## Próximos pasos sugeridos

1. Conectar la fecha de build con el proceso real de compilación del proyecto
2. Añadir posibilidad de mostrar contribuidores adicionales si el equipo crece
3. Considerar la inclusión de información sobre las tecnologías utilizadas
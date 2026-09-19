# K+AIR v0.1.207

## 🎨 Migración premium v2 de los submódulos (📦739-777)

Segunda gran ola del rediseño visual: después de los **homes de módulo** (📦730-738, v0.1.197-205), se migraron al dialecto **premium v2** todos los submódulos con interfaz propia. El objetivo fue que TODO el sistema comparta la misma paleta, tipografía y patrones de componentes.

### Sistema de diseño

- **Paleta canónica** (`shared/kair-design-tokens.css`): azul `#2057b8`, tinta `#14213d`, muted `#748096`, borde `#e8ebee`, canvas `#fbfcfb`, verde `#1bb888`, ámbar `#e7a224`, rojo `#da5563`.
- **Tipografía**: DM Sans (UI) + Manrope (títulos, 800).
- **Radios**: tarjetas 20px, controles 12px, pills 999px.
- **Header System v2**: breadcrumb + icon chip + título Manrope + subtítulo + acciones, transparente sobre el canvas.
- **Tabs con subrayado**: la activa lleva una línea azul de 2px montada sobre la línea gris.
- **Modo oscuro**: cubre los DOS atributos que aplica la app (`data-theme="dark"` y `dark-legacy`).
- **`shared/kair-premium.css`** (📦749): dialecto compartido reutilizable.

### Submódulos migrados

| Submódulo | Novedad principal |
|-----------|-------------------|
| Inducciones | Gráficos SVG nativos (sin Chart.js) + KPI cards con chips |
| Capacitaciones / Presupuesto | Modal de período + rediseño de 3 vistas |
| COPASST + Comité de Convivencia | Portal sin caja |
| Bandeja Integrada | Premium v2 + firma con imagen (CID) + toolbar compacta + paginación |
| Dashboard principal | Piloto del dialecto (hero + KPI + módulos + pendientes) |
| Configuración | Capa scoped `.kair-config` + remapeo de tokens |
| Archivo y Retención | Vista con fila expandible + edición en línea |
| Evaluación Inicial del SG-SST | Reescritura premium v2 recableada al backend |
| Evaluaciones Médicas (EMO) | Certificados persistidos + ancho completo + adjuntar PDF |
| Rendición de Cuentas | Rediseño premium completo |
| Identificación de Bienes (2.9.1) | Rediseño premium |
| Evaluación y Selección (2.10.1) | Rediseño + tabs con subrayado + fix del botón Volver |
| Perfil de Cargo (3.1.3) | Tokens premium + Header System v2 |
| Reportes de Accidentes / FURAT (3.2.1) | Tokens premium + tabs con subrayado |
| Gestión del Cambio (2.11.1) | De 6 archivos a 1 par CSS+JS (marcado embebido) |
| Restricciones / Remisiones (3.1.6) | Portal scoped (fix de fuga) + flujo completo de 3 pasos + vista previa del informe + cancelar + alineación de paleta |

### Correcciones destacadas

- **Fuga de tokens globales** (portal de EMO y de Remisiones): su `<style>` inyectado con `innerHTML` pisaba `:root` y `*` de TODA la app. Ahora todo va scoped.
- **Gráficos deformados** en los homes: las barras se dibujan con cajas HTML, no con un SVG estirado.
- **Skeleton que no encajaba**: el esqueleto de carga ahora reutiliza las clases reales (radio, borde, padding y alto coinciden).
- **Bandeja Integrada**: sync con Gmail arreglado (rate limiter 40→120/min), correos leídos que "revivían", paginación real de todos los correos.

### Limpieza

- Decenas de archivos muertos eliminados (p. ej. `restricciones-medicas-logic.js` pasó de ~60 KB a ~19 KB; Gestión del Cambio de 6 archivos a 1 par).
- Regla documentada: al migrar una pantalla, borrar los archivos que reemplaza y sus loaders.

### Para validar

1. Recorrer los submódulos migrados en claro y oscuro → todo debe compartir la misma paleta y tipografía.
2. Confirmar que abrir un submódulo **NO** cambia los colores del resto de la app (fuga de tokens).
3. En "Enviar Remisión" (3.1.6): cargar PDF → revisar datos → generar informe → ver la vista previa → cancelar (vuelve al paso 1 sin borrar archivos).

### Docs

- `AGENTS.md` — playbook de migración + specs técnicas ST-01 a ST-08 + lecciones por migración.
- `CHANGELOG.md` — entrada `[0.1.207]`.
- `CONTEXT.md` y `README.md` — actualizados.

### Archivos

- `package.json` (versión 0.1.207)
- `shared/kair-premium.css`, `shared/kair-design-tokens.css`, `shared/kair-components.css`
- `AGENTS.md`, `README.md`, `CONTEXT.md`, `CHANGELOG.md`, `release-notes.md`

# K+AIR v0.1.207

## 🎨 Migración premium v2 de los submódulos (📦739-783)

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
| Control de Remisiones (3.1.6) | Descarta filas vacías y encabezados repetidos del Excel (`rowNumbers`) |
| Estadísticas de Remisiones (3.1.6) | Nueva sección: KPIs + 6 gráficos derivados del Control |
| Investigación de Accidentes (3.2.2) | Las 3 vistas al premium v2 + fix de fuga global + ancho completo + lista en 2 columnas en maximizada |
| Registro y Análisis Estadístico (3.2.3) | Header System v2 + CSS scopado (sin clases globales) + los 9 gráficos Chart.js con colores de tema |

### Correcciones destacadas

- **Fuga de tokens globales** (portal de EMO y de Remisiones): su `<style>` inyectado con `innerHTML` pisaba `:root` y `*` de TODA la app. Ahora todo va scoped.
- **Fuga de estilos global** (Investigación de Accidentes): `investigacion-accidentes-view.css` estaba linkeada **también** en `index.html` y traía `html, body { height:100vh; overflow:hidden }` + un `.k-section-card` sin scope. Se quitó el `<link>` global (el submódulo ya la carga dentro de su iframe).
- **Excel con filas basura** (Control de Remisiones): el `GI-FO-012` real trae encabezados repetidos y filas vacías en el medio (18 → **8 registros reales**); ahora se filtran y se devuelve el nº de fila real (`rowNumbers`) para que el guardado por celda no se desalinee.
- **Clases globales redefinidas por un módulo** (Registro Estadístico 3.2.3): su header usaba `.k-section-card` (clase compartida por ~20 módulos) y el CSS la redefinía mientras el módulo estaba abierto. Ahora tiene header propio y **ninguna** regla de una clase genérica ajena.
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
4. En "Ver Investigaciones" (3.2.2): con la ventana **maximizada** la lista debe verse en **2 columnas**; al achicarla, en 1. La vista de cuadrícula no cambia.
5. En "Control de Remisiones" (3.1.6): el listado debe traer **8** registros (no 18).
6. En "Registro y Análisis Estadístico" (3.2.3): abrir la pestaña **Tablero** y confirmar los 9 gráficos en claro y en oscuro (con los dos temas de la app).

### Docs

- `AGENTS.md` — playbook de migración + specs técnicas ST-01 a ST-08 + lecciones por migración.
- `CHANGELOG.md` — entrada `[0.1.207]`.
- `CONTEXT.md` y `README.md` — actualizados.

### Archivos

- `package.json` (versión 0.1.207)
- `shared/kair-premium.css`, `shared/kair-design-tokens.css`, `shared/kair-components.css`
- `AGENTS.md`, `README.md`, `CONTEXT.md`, `CHANGELOG.md`, `release-notes.md`

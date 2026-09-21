# K+AIR v0.1.208

## 🎨 Migración premium v2 de los submódulos (📦739-790)

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
| Frecuencia de la Accidentalidad (3.3.1) | Header System v2 + tokens `--freq-*` scoped (se quitó el `:root`/`*`/`body` GLOBALES) + el gráfico SVG lee la paleta + gráfico y tabla en paralelo (anchos de columna fijos y blindados) + filas de 35px + gráfico a todo el alto + los 12 meses en una fila en maximizada |
| Severidad de la Accidentalidad (3.3.2) | Header System v2 + tokens `--sev-*` scoped (se quitó el `:root`/`*`/`body` GLOBALES) + 125 selectores scopados + tabla blindada (`min-width:0 !important` + `table-layout:fixed`) con 7 anchos fijos que suman 100% + gráfico SVG leyendo la paleta + wrapper `.sev-duo` en paralelo (gráfico+tabla) en maximizada + meses grid 6/12 + código muerto eliminado + renderer.js parcheado con TOKEN + cache-bust en 2 niveles + test 21/21 |
| Índice de Mortalidad (3.3.3) | Header System v2 + tokens `--mort-*` scoped (se quitó el `:root`/`*`/`body` GLOBALES) + tabla blindada (`min-width:0 !important` + `table-layout:fixed`) con 7 anchos fijos que suman 100% + Chart.js theme-aware con gradientes dark/light + `tok()`/`palette()` en getStatusBadge/getValueColor/renderizar/renderizarTabla + resize handler con cleanup + código muerto eliminado (`escapeHtml`) + renderer.js parcheado con TOKEN + cache-bust en 2 niveles + sanitizar `<link>` CDN + **gráfico y tabla en paralelo en maximizada** (`📦786-fix`) + test 46/46 |
| Prevalencia de Enfermedad Laboral (3.3.4) | Header System v2 + tokens `--prev-*` scoped (se quitó el `:root`/`*`/`body` GLOBALES) + tabla blindada (`min-width:0 !important` + `table-layout:fixed`) con 6 anchos fijos que suman 100% + Chart.js theme-aware + `tok()`/`palette()` en getStatusBadge/getValueColor/renderizar/renderizarTabla/renderFallbackChart + resize handler con cleanup + iconos SVG inline (se quitó el CDN de Bootstrap Icons) + código muerto eliminado (`escapeHtml` + 15 `console.log`) + renderer.js parcheado con TOKEN + cache-bust en 2 niveles + sanitizar `<link>` CDN + **gráfico y tabla en paralelo en maximizada** (`.prev-duo`) + test 46/46 |
| Incidencia de Enfermedad Laboral (3.3.5) | Módulo hermano de Prevalencia generado con renombres **case-sensitive** (`casosEL`→`casosNuevosEL` sin romper `totalCasosEL`) + Header System v2 + tokens `--inc-*` scoped + tabla blindada con 6 anchos fijos que suman 100% + Chart.js theme-aware + `tok()`/`palette()` + resize con cleanup + **estilos del error que la hoja vieja no definía** (`.kair-error-icon`/`.kair-error-msg`/`.kair-retry-btn`) + iconos SVG inline + código muerto eliminado + renderer.js con TOKEN + cache-bust en 2 niveles + **gráfico y tabla en paralelo** (`.inc-duo`) + test 46/46 |
| Medición del Ausentismo (3.3.6) | **Fase 1**: home premium v2 (Header v2 + SVG + dark + `initThemeSync`) + **blindaje de los 7 bloques `<style>`** inyectados en el `<head>` global (~684 líneas) scopados bajo `.aus-scope` (con `:root` movido y `@keyframes` genéricos renombrados) + `.aus-scope` en contenedor y 6 nodos de `<body>` + **fix del panel** (variante *self* `.aus-scope.seguimiento-backdrop`). **Vistas**: Registrar/Ver reescritas (0 colores inline, 0 FA) + Seguimiento (KPIs/filtros/tabla/avatar/progress/badges) + Estadísticas (tokens `--aus-*` → dark automático) + Consulta (tokens + Header v2 + SVG) + Generar Informe (**CDN → local**, ya funciona offline) + **2 CDN de Font Awesome eliminados** + test 110/110 |
| Seguimiento de Gestación (3.3.6) | **Home** migrado: tokens `--v3-*` → canónica + dark (2 atributos) + Header System v2 (transparente, Manrope 800 20px, icon chip 44×44) + contraste del botón en oscuro. Quedan antesala/mensual/reportes |

### Correcciones destacadas

- **Fuga de tokens globales** (portal de EMO y de Remisiones): su `<style>` inyectado con `innerHTML` pisaba `:root` y `*` de TODA la app. Ahora todo va scoped.
- **Fuga de estilos global** (Investigación de Accidentes): `investigacion-accidentes-view.css` estaba linkeada **también** en `index.html` y traía `html, body { height:100vh; overflow:hidden }` + un `.k-section-card` sin scope. Se quitó el `<link>` global (el submódulo ya la carga dentro de su iframe).
- **Excel con filas basura** (Control de Remisiones): el `GI-FO-012` real trae encabezados repetidos y filas vacías en el medio (18 → **8 registros reales**); ahora se filtran y se devuelve el nº de fila real (`rowNumbers`) para que el guardado por celda no se desalinee.
- **Clases globales redefinidas por un módulo** (Registro Estadístico 3.2.3): su header usaba `.k-section-card` (clase compartida por ~20 módulos) y el CSS la redefinía mientras el módulo estaba abierto. Ahora tiene header propio y **ninguna** regla de una clase genérica ajena.
- **`:root` + reset `*` globales** (Frecuencia de la Accidentalidad 3.3.1): la hoja del módulo declaraba tokens en `:root` (pisaba `--kair-card`/`--kair-text` de la app y podía romper el modo oscuro) y un `* { margin:0; padding:0 }` que borraba los márgenes de toda la aplicación. Ahora todo vive scoped en `.frecuencia-container`.
- **Ancho mínimo AJENO en una tabla** (Frecuencia de la Accidentalidad 3.3.1): la tabla medía 900px dentro de un contenedor de 584px (con scroll horizontal y la última columna cortada) porque otro módulo define `table.kair-table { min-width: 1080px }` **sin scope** y su hoja se inyecta en el `<head>` global. Se blindó con `min-width: 0 !important` + `max-width: 100% !important`. **Lección**: si un módulo usa una clase genérica del design system (`.kair-table`, `.kair-card`…), otro módulo puede estar redefiniéndola globalmente.
- **Estilo en línea que le gana al CSS** (Índice de Mortalidad 3.3.3): el JS fijaba `chartSection.style.display = 'block'` y eso impedía que el `display: flex` de la media query (gráfico y tabla en paralelo en maximizada) se aplicara. Ahora el JS pone `display = ''` (quita la propiedad) y el CSS decide. **Lección**: si un módulo fija `display` con `style.display`, cualquier layout que necesite otro `display` (flex/grid) tiene que quitarse esa propiedad primero.
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
7. En "Frecuencia de la Accidentalidad" (3.3.1): confirmar que **con la ventana maximizada el gráfico y la tabla se ven lado a lado y la tabla se ve COMPLETA** (sin scroll horizontal: las 6 columnas, incluida "Estado"), que el **gráfico ocupa todo el alto** de su tarjeta, que las filas son **compactas** y que los **12 meses** van en **1 fila** en maximizada y en **2 filas de 6** en ventana. Y que **abrir este módulo NO cambie los márgenes ni los colores del resto de la app** (era su fuga).
8. En "Índice de Mortalidad" (3.3.3): con la ventana **maximizada** el gráfico y la tabla deben verse **lado a lado** (cada uno la mitad del ancho, al mismo alto); al achicar la ventana, uno debajo del otro. La tabla debe verse **completa** (sin scroll horizontal) y el gráfico debe **llenar el alto** de su tarjeta.
9. En "Prevalencia de Enfermedad Laboral" (3.3.4): igual que el anterior — con la ventana **maximizada** el gráfico y la tabla se ven **lado a lado** y al achicarla se apilan. El encabezado debe mostrar el icono, el título y el botón Volver con **iconos dibujados** (no deben aparecer cuadros vacíos aunque no haya internet), y en tema **oscuro** (los dos: "Sistema" y "Oscuro") todo debe verse oscuro.
10. En "Incidencia de Enfermedad Laboral" (3.3.5): mismo comportamiento que Prevalencia (gráfico y tabla lado a lado en maximizada). Verificar además que las etiquetas propias del módulo estén intactas: "CASOS NUEVOS EL (AÑO)", Meta "<5 (Coordinador SST)", el párrafo **Meta** de la metodología y el botón **Reintentar** (que ahora sí tiene estilo, antes salía sin él).

### Docs

- `AGENTS.md` — playbook de migración + specs técnicas ST-01 a ST-08 + lecciones por migración.
- `CHANGELOG.md` — entrada `[0.1.208]` (📦785 Severidad, 📦786 Mortalidad, 📦786-fix, 📦787 Prevalencia y 📦788 Incidencia).
- `CONTEXT.md` y `README.md` — actualizados.

### Archivos

- `package.json` (versión 0.1.207)
- `shared/kair-premium.css`, `shared/kair-design-tokens.css`, `shared/kair-components.css`
- `AGENTS.md`, `README.md`, `CONTEXT.md`, `CHANGELOG.md`, `release-notes.md`

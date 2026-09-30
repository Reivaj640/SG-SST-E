# K+AIR v0.1.225

## 🩺 Medicina Preventiva: tus programas SVE, DME y de promoción ya se crean y se gestionan (📦825)

El home de **Actividades de medicina preventiva y promoción de la salud** ya no es un anuncio: ahora administra programas de verdad.

### (a) Crea un programa en dos pasos

Haz clic en **SVE**, **DME** o **Programas**. Si la línea está vacía, la app te propone **crear tu primer programa**. El asistente te pide los datos (nombre, descripción y periodo) y luego te deja elegir: **usar la plantilla estándar** — con las secciones ya definidas, por ejemplo la del SVE según su documentación técnica: Dashboard, Gestión de casos, Centro de alertas, Reportes, Administración y Auditoría — o **empezar en blanco**.

Puedes tener **varios programas por línea** (por ejemplo "SVE COVID-19" y "SVE Psicosocial"), cada uno con su propio periodo y avance.

### (b) Avance por secciones

Cada programa muestra sus secciones con un estado que puedes marcar: **Pendiente → En curso → Completo**, con barra de progreso general. Las interfaces operativas de cada sección (los formularios, indicadores y reportes) llegan en las próximas fases; por ahora el esqueleto te deja organizar el programa y registrar su avance.

### (c) Ciclo de vida completo

Pausa, reanuda, cierra o elimina un programa con confirmación. Todo queda guardado por empresa, así que los programas de cada organización son independientes.

---

# K+AIR v0.1.224

## 🎨 Presupuesto: pantallas llenas, bloques parejos y sin la franja misteriosa (📦824-ui)

Los datos de tu presupuesto ya no se perdían (eso fue lo anterior). Esta vez fue la **interfaz**: tres cosas que se veían raras y que ahora están corregidas.

### (a) Los años cargados también iban en su recuadro

Los archivos que tenías en Drive para importar salían dentro de una caja, pero los años que ya estaban cargados en la app iban **sueltos sobre el fondo**, sin caja. Se veía desparejo: un bloque enmarcado y otro no.

Ahora los dos van dentro del mismo tipo de caja, con el mismo borde, la misma esquinas y la misma sombra.

### (b) La pantalla usaba todo el ancho

Tu ventana es ancha, pero la aplicación se quedaba en el medio como una columna angosta y dejaba **espacio vacío a los dos lados**. Además, dentro de las cajas ese vacío volvía a aparecer en el lado derecho cuando había pocos años cargados.

**Ahora:** la pantalla ocupa todo el ancho disponible, y los años y las herramientas reparten ese ancho. Cuando hay muchos años, cada tarjeta es pequeña como siempre; cuando hay pocos, se agrandan y la información se reparte en dos columnas en vez de quedar estirada.

**La flechita** que aparece a la derecha de "Gestionar Presupuesto" y "Histórico de Años" es para que se note que son botones y que hay algo al otro lado.

### (c) La franja del borde inferior

Viste una franja blanca muy delgada abajo. No era una falla de la imagen ni un resto de una ventana: era **la caja de los avisos "oculto" asomando unos 4 píxeles**. Cuando se escondía, bajaba 1,5 veces su propia altura, y eso no alcanzaba sacarla de la pantalla.

Ya no puede asomar. Y los avisos **sí siguen apareciendo** cuando corresponde, con su animación.

### (d) Limpieza interna

- El recuadro estaba escrito **dos veces** (una en cada pantalla) y se veían iguales por casualidad. Ahora está escrito **una sola vez** en el archivo de estilos compartidos, así que ya no pueden quedar distintos entre pantallas.
- Se borraron estilos del home que ya no se usaban y un ajuste de tamaño de pantalla que nunca se activaba.
- Se documentaron en el manual del proyecto las 5 reglas que explican estos cambios, para que no se repitan.

**Sin cambios en los datos:** importar, exportar, guardar y el historial del presupuesto siguen exactamente igual que antes.

## 💰 Presupuesto SG-SST: los datos ya no se pierden, y las columnas muestran lo real (📦824)

El submódulo 1.1.3 (Asignación de Recursos) tenía un problema serio: **cada vez que guardabas, se perdía información sin avisar**. En tu presupuesto 2026 eso había dejado las categorías en blanco y el total descuadrado. Ya está corregido, con respaldo previo de tu base de datos.

### (a) Se había borrado parte de tu presupuesto 2026

Guardabas el período y la app **borraba todo y reescribía desde la pantalla**. Como la pantalla no conoce la información de a qué categoría pertenece cada partida (esa información vive en una columna del Excel que ahí no se muestra), al reescribir se perdía.

**Cómo quedó:**

| | Antes de guardar | Ahora |
|---|---|---|
| Categorías (ASESORIAS SST, SISTEMA INTEGRAL, PAPELERIA) | se borraban | **se conservan** |
| Asignación anual | se perdía | **se conserva** |
| Dinero ya gastado | se conservaba | se conserva |

Y como se conservaba lo que ya habías gastado, **no se notaba que faltaba algo** — hasta que las tarjetas dejaron de cuadrar.

**Tu presupuesto 2026 ya fue reimportado** y quedó con las 14 partidas, las 3 categorías y $19.696.874 de ejecución (71%).

### (b) Las columnas de mes mostraban un número inventado

El formato ACT-FO-043 tiene el presupuesto del año en **una sola columna** y, aparte, el **gasto real de cada mes**. No tiene "cuánto se debe gastar en marzo".

La app llenaba ese dato que no existe repartiendo el total entre 12 meses, y lo mostraba como si fuera real: `208.333,33` repetido doce veces en partidas que en tu Excel tienen el mes en cero. Y mientras ocupaba ese espacio, **el dato que sí importa — cuánto gastaste de verdad cada mes — no se veía en ningún lado**.

**Ahora las columnas ENE–DIC muestran el gasto real de cada mes**, tal como dice tu Excel. Por ejemplo, en "Realización de Diagnóstico Psicosocial" vas a ver los $2.000.000 de abril, que antes no aparecían.

### (c) El total sale del Excel, no de un cálculo

El total asignado ahora se lee **directamente de la columna del Excel** (la que dice "ASIGNACION PRESUPUESTO ANUAL"), que es el número bueno. Antes se armaba sumando los meses, y un solo mes en cero hacía que el total quedara corto — por eso faltaban $20.000 en una partida.

También se corrigió que las sumas no cuadraban por centavos: al repartir $10.000.000 entre 12 meses, la calculadora dejaba $9.999.999,999999998.

### (d) Exportar a Excel usa tu archivo original

Antes de exportar se generaba una tabla pelada, sin el formato oficial. Ahora el botón **Exportar** toma tu archivo de Drive como base: conserva el encabezado, el código ACT-FO-043, los rótulos, las celdas combinadas y el área de firmas.

La fila de totales se escribe con **la suma real de las partidas**. Tu Excel de origen trae esa fila con un error (declara el doble de lo que suman las partidas); al exportar se corrige y te avisas por consola qué encontró.

### (e) Períodos independientes y duplicado rápido

- El **año activo siempre se ve** arriba (ya no aparece "Presupuesto Desconocido").
- Al elegir un año del historial ves **lo que ya está cargado en la app**, no el archivo de Drive.
- **Cada año está aislado**: tocar el 2026 no daña el 2025.
- Botón **Duplicar** para crear el año siguiente con las partidas ya escritas — la ejecución arranca en cero y el IPC (inflación) queda vacío porque cambia cada año.
- **IPC** por período, editable, y **no altera el total**.

### (f) Otros fixes

- Cambiar de año ya no rompe la app (un error de nombre impedía abrir otro período).
- La tabla es más angosta: **1.510px en vez de 1.810px**, ya casi no se desplaza de lado.
- Se corrigió un error en el autollenado de actas de COPASST que no mostraba aviso al usuario.

---


## 📬 Notificaciones: ahora sabes QUIÉN te escribió, y "Ver" te lleva al correo (📦823)

El aviso de "1 correo nuevo" mejoró en dos frentes: te dice **de quién** es el correo, y el botón **"Ver"** ahora realmente te lleva a esa notificación (antes no).

### (a) El toast muestra el remitente

Antes el toast solo decía el asunto. Ahora:

```
1 correo nuevo
De: Pausas Activas (pausas@acme.com)
RV: Lista de asistencia de actividades Pausas activas
                                    [ Ver ]
```

Cómo se arma el nombre:
- con nombre y correo → `Pausas Activas (pausas@acme.com)`
- sin nombre (típico de los `noreply`) → `noreply@acme.com`
- si el nombre es el mismo correo → no lo repite
- si no hay nada → la línea no aparece (no inventa texto)

También se agregó **"De: …" en la lista de Notificaciones** (la pestaña del panel), encima del asunto.

### (b) Se corrigió el `*` que salía bajo el título

En la captura anterior, debajo de "1 correo nuevo" aparecía un asterisco suelto. Era un error: el toast mostraba la "empresa" del correo, y como la bandeja de Gmail es global esa empresa es `*`. Ya no sale. Para los eventos de calendario sí se sigue mostrando la empresa, que ahí sí sirve.

### (c) El botón "Ver" ahora funciona como dice

Tenía tres problemas, los tres corregidos:

| Antes | Ahora |
|---|---|
| Abría la pestaña de **eventos**, no la del correo | Abre directo en **Notificaciones**, donde está el correo |
| Si el panel ya estaba abierto, lo **cerraba** | Si ya está abierto, se queda abierto en la pestaña correcta |
| El toast se quedaba **flotando** tapando la pantalla | El toast se cierra al hacer clic |

Además, la pestaña que elegiste queda memorizada: la próxima vez que abras el panel con el botón del calendario, abre donde lo dejaste.

### (d) Corrección técnica importante

Se agregó una columna nueva a la base de datos para guardar el remitente. La migración es automática y segura: se aplica sola al abrir la app, no hay que hacer nada, y no se pierde ninguna notificación existente.

### Cómo validarlo

1. Reinicia la app (para que se aplique la migración y carguen los cambios).
2. Pide que te llegue un correo nuevo a la cuenta conectada, sin abrirlo.
3. Debe salir el toast con **"De: …"** y sin el asterisco.
4. Dale **Ver** → debe abrirse el panel en la pestaña **Notificaciones** y el toast desaparece.
5. Vuelve a abrir el panel con el botón del calendario → debe seguir en **Notificaciones**.
6. Repite con el panel ya abierto → debe cambiar a Notificaciones sin cerrarse.

**Nota:** las notificaciones que ya estaban guardadas salen sin el remitente (la columna se creó hoy). A partir de los correos nuevos se ven completas.

### Archivos modificados

- `main/notifications-email.js`, `main/notifications-bridge.js`, `main/notifications-service.js` — detectar, guardar y entregar el remitente
- `renderer.js` — el subtítulo del toast y el botón Ver
- `shared/kair-alerts.js` — línea del remitente en la lista + `openTab()` / `openFromToast()`
- `styles.css`, `index.html` — estilo de la línea y cache-bust
- `tests/notificaciones-toast-e2e.js` — **nueva** E2E del flujo completo (25 checks)
- `main/test-notificaciones-{ui,bridge,email}.js` — actualizados (+30 checks)
- `package.json` — bump 0.1.221 → 0.1.222
- `AGENTS.md`, `CHANGELOG.md`, `CONTEXT.md`, `PRD.md`, `README.md`, `release-notes.md` — sincronizados

### Sin cambios

- La detección de correos, el deduplicado y el gate de seguridad
- La sincronización con Gmail y la bandeja integrada
- El layout de las dos pestañas del panel

### Pruebas

**222/222 en verde** (eran 155): E2E nueva 25/25, más las 7 suites de notificaciones (bridge 32, service 10, email 17, wiring 11, fuentes 52, ui 52, seguridad 23).

---

# K+AIR v0.1.221

## 🖨️ Informe de Gestión PRI: imprimir un caso o el consolidado, y volver al portal (📦819-822)

Cuatro mejoras al Informe de Gestión PRI (submódulo **3.3.6 Medición del ausentismo por causa médica**): la impresión ahora depende de dónde estés parado, y el botón de volver te devuelve exactamente al portal de donde saliste — sin romper la aplicación.

### (a) Impresión: consolidado o caso individual (📦819)

El botón de imprimir (y `Ctrl+P`) ahora hace **lo que corresponde según la vista activa**:

| Dónde estás | Qué sale en el PDF | Cómo se llama el archivo |
|---|---|---|
| **Resumen General** | Resumen ejecutivo + todos los casos del periodo | `Resumen_General_2026-09-28_17-25-58.pdf` |
| **Un caso seleccionado** | Solo ese caso, sin el resumen | `CARELIS_DEL_CARMEN_CARIDAD_CALDERON_1047239028_2026-09-28_17-25-58.pdf` |

Antes el botón decía siempre "Imprimir informe" y generaba el consolidado completo aunque tuvieras un caso abierto.

Detalles de la implementación:
- El texto del botón cambia según el contexto: **"Imprimir informe"** o **"Imprimir este caso"**.
- Si cambias el filtro de fechas y el caso que tenías abierto ya no existe, el builder avisa en vez de sacar un PDF en blanco.
- Con un solo caso, la paginación muestra "Página 1 de 1" sin flechas.
- Los nombres de archivo se limpian de acentos y espacios (`_slug()`), para que no se rompan al guardarse.

### (b) Botón "Volver al Módulo" (📦820)

El header del informe ahora tiene un botón visible **← Volver al Módulo**, al lado del X. La X y la tecla `ESC` hacen exactamente lo mismo: una sola ruta de salida para los tres.

Funciona en los tres casos en que se puede abrir el informe:
- en una ventana nueva (vuelve a la anterior y la cierra),
- embebido en un iframe,
- cargado dentro de la misma pantalla del módulo.

### (c) Fix: la aplicación se colgaba al pulsar Volver (📦821)

**Esto es lo que reportaste y ya está resuelto.** Al pulsar Volver salía en consola:

```text
TypeError: Cannot set properties of undefined (setting 'innerHTML')
    at render (rendicion-viewer.js:138:29)
```

y la app quedaba muerta.

**Por qué pasaba:** el informe, cuando se carga dentro de la pantalla del módulo, comparte documento con toda la app. El código pedía "volver" llamando a `window.render()` — pero ese nombre lo define un módulo **completamente diferente** (Rendición de Cuentas, del Módulo Gestión Integral). Llamado así, sin contexto, reventaba y antes de morir tocaba el HTML de otras pantallas.

**Arreglo:** el informe ahora le pide al shell que lo repinte usando la API correcta, y `window.render()` desapareció por completo del archivo.

> **Nota técnica para futuras sesiones:** nunca llamar a un global genérico como `render`, `init` o `load` desde código que se inyecte en la app. Como todos los módulos se cargan en el mismo documento, esos nombres se pisan. Usar siempre las funciones con nombre propio del shell: `showModuleContent`, `showSubmoduleContent`, `showHomePage`.

### (d) El retorno lleva al portal, no al módulo completo (📦822)

Después de arreglar el error, el botón volvía pero te dejaba en la **pantalla de tarjetas de Gestión de la Salud**, no en el portal de Medición del Ausentismo. Ahora vuelve al portal correcto (Registrar Ausentismo, Ver Ausentismo, Seguimiento, Estadísticas, Informe, Consulta de Trabajadores), que es de donde abriste el informe.

### Archivos modificados

- `modules/gestion-salud/ausentismo/informe-pri-builder.html` — impresión bifurcada, `_slug()`, botón Volver, `closeReportBuilder()` reescrito
- `package.json` — bump 0.1.217 → 0.1.221
- `AGENTS.md`, `CHANGELOG.md`, `CONTEXT.md`, `PRD.md`, `README.md`, `release-notes.md` — sincronizados

### Sin cambios

- Backend IPC y base de datos
- `renderer.js` (el shell no se tocó)
- La lectura del `PRI.xlsx` y el mapeo de columnas
- Filtros por fechas y configuración del informe

### Cómo validarlo

1. Abre **Gestión de la Salud → 3.3.6 Medición del ausentismo** y entra al portal.
2. Dale **Generar Informe PRI**.
3. Con el **Resumen General** abierto, pulsa "Imprimir informe" → debe salir `Resumen_General_<fecha>.pdf` con el resumen y los 2 casos.
4. Selecciona un caso (p. ej. **Carelis del Carmen Caridad Calderón**) → el botón debe decir "Imprimir este caso" y el PDF debe salir con nombre `CARELIS_..._1047239028_<fecha>.pdf` con un solo caso.
5. Pulsa **← Volver al Módulo** → debes volver al portal de ausentismo, sin errores en consola.
6. Repite con la **X** y con la tecla **ESC** → mismo resultado.

---

# K+AIR v0.1.217

## 🎨 Home de Gestión Humana — hero + métricas en fila + progress bars (📦818)

El home (Resumen) del módulo 8 se reorganiza al patrón premium v2 estándar: **hero + 3 métricas en una sola fila** de 4 cards (maximizado), y las métricas ahora muestran formato `X/Y` con barra de progreso horizontal color-coded al fondo.

### Cambios principales

#### (a) Hero + métricas en fila de 4 columnas
- Layout de 2 niveles: `.gh-hero-row` con grid `1fr 3fr` (hero izquierda, métricas derecha con grid interno `repeat(3, 1fr)`)
- En maximizado: 4 cards lado a lado (1 hero + 3 metrics)
- En ventana (<900px): todo a 1 columna

#### (b) Hero compacto
- Removido subtítulo "Personal, contratación, ausencias y documentos del equipo en un solo lugar — Tempoactiva." (redundante con el título)
- Padding reducido (`clamp(14px, 1.5vw, 20px)`) + font del título `clamp(16px, 1.4vw, 19px)`
- Stat (número grande + labels) anclado al fondo del card con `margin-top: auto` + `height: 100%`

#### (c) Métricas con barra de progreso (estilo "INDUCCIONES 104/108")
- `_renderMetric()` soporta 3 variantes: `{value,total}`, `{value,percent}`, `{value}` legacy
- **Removido el icono** del `.gh-metric__top` (la referencia no tiene icono)
- Fraction pegada al número (sin espacio): `0/1`
- Progress bar horizontal al fondo (`margin-top: auto`), color del `--gh-m-tone` (warn=ámbar, ok=verde, neutral=gris)

### Datos de las 3 métricas del home

| Card | Antes | Ahora |
|---|---|---|
| Contrataciones en proceso | `0` + sub | `0/1` + barra ámbar al fondo |
| Onboarding completados | `1` + sub | `1/1` + barra verde al fondo |
| Procesos cancelados | `0` + sub | `0/1` + barra gris al fondo |

### Archivos modificados

- `modules/gestion-humana/gestion-humana-home.js` — wrapper `.gh-hero-row`, `_renderMetric()` reescrito con variantes, llamadas con `{value,total}`
- `modules/gestion-humana/gestion-humana-home.css` — layout 4-col, hero compacto, métricas sin icono + progress bar al fondo
- `index.html` — cache-bust CSS + JS `?v=GH-20260927-metrics-no-icon`
- `package.json` — bump 0.1.216 → 0.1.217
- `AGENTS.md`, `CHANGELOG.md`, `CONTEXT.md`, `PRD.md`, `README.md`, `release-notes.md` — sincronizados

### Funcionalidad preservada

- 9 vistas del shell intactas
- Tabs del shell sin cambios
- Backend IPC `gh:listPersonal`, `gh:listContrataciones` sin tocar
- Dark mode + dark-legacy vía tokens

### Para validar

1. Abrir la app y navegar a **Gestión Humana → Resumen**.
2. El hero y las 3 métricas deben estar en la misma fila en maximizado (4 cards lado a lado).
3. El hero muestra: "RESUMEN DEL MÓDULO" / "Talento humano bajo control" / stat `1 trabajadores activos / de 1 registrados` anclado al fondo.
4. Las métricas muestran: label uppercase + número `X/Y` con fraction pegada + sub + barra de progreso al fondo (color según estado).
5. Validar en claro y los 2 oscuros.

---

# K+AIR v0.1.216

## 🎨 Shell de Gestión Humana — header premium v2 con breadcrumb + pill (📦817)

El header del shell del módulo 8 migró al patrón premium v2 replicado del viewer de Capacitaciones: **breadcrumb 3 niveles** (`Inicio › Gestión › Gestión Humana`), **pill "Empresa activa"** dinámica con SVG icono casa + nombre de la empresa, **fondo `var(--bg-color)` continuo** sin bordes (header + tabs + content forman un solo bloque gris claro, mismo tono que el resto de la app).

### Decisiones explícitas del owner (sesión 2026-09-27)

- ❌ Sin botón **Volver** en el shell (el sidebar ya provee navegación al menú)
- ❌ Sin botón **Nueva Contratación** en el shell (las vistas individuales lo agregan si lo necesitan)
- ✅ Sí pill **"Empresa activa: <nombre>"** (da contexto de la empresa activa al entrar al módulo)
- ✅ Fondo `var(--bg-color)` en header + tabs (mismo gris que el contenido, sin distinción visual)
- ✅ Sin `border-bottom` divisorios (header → tabs → content en un solo bloque continuo)

### Cambios técnicos

- **HTML**: breadcrumb 3 niveles + pill `#gh-company-pill` con SVG icono casa + `<strong id="gh-company-name">`; eliminado botón bell de notificaciones.
- **CSS**: tokens `--bg-color` en header y tabs (mismo gris que el resto); estilos `.gh-pill` y `.gh-breadcrumb` con tokens `--gh-accent` / `--gh-accent-soft`; hover de tab usa `--gh-accent-soft` para destacar; removidos `.gh-bell-*` styles y `border-bottom` divisorios.
- **JS**: nueva función `_updateCompanyPill()` (análoga a `_updateSubtitle()`); fallback inline en `_fetchShellHtml` actualizado para coincidir con el HTML nuevo; llamada en `_renderShell()` junto a `_updateSubtitle()`.
- **Cache-bust**: `gestion-humana-home.css?v=GH-20260927-shell-no-borders` + JS `?v=GH-20260927-shell-no-borders`.

### Archivos modificados

- `modules/gestion-humana/gestion-humana-home.html` — breadcrumb + pill, removido bell
- `modules/gestion-humana/gestion-humana-home.css` — tokens `--bg-color`, pill styles, removidos bordes y bell styles
- `modules/gestion-humana/gestion-humana-home.js` — nueva función `_updateCompanyPill()`, fallback inline actualizado
- `index.html` — cache-bust CSS + JS
- `package.json` — bump 0.1.215 → 0.1.216
- `AGENTS.md`, `CHANGELOG.md`, `CONTEXT.md`, `PRD.md`, `README.md`, `release-notes.md` — sincronizados

### Funcionalidad preservada

- 9 vistas del shell intactas (Resumen, Dashboard, Contratación, Carpetas, Firma, Afiliaciones, Base Personal, Vacaciones, Permisos, Comunicación)
- Sistema de tabs con underline (indicador de tab activa) sin cambios
- Subtítulo dinámico con la empresa (`#gh-subtitle`) sigue funcionando, complementado por el pill
- Dark mode + dark-legacy funcionan vía tokens sin override extra (el token `--bg-color` cambia solo en cada tema)

### Para validar

1. Abrir la app y navegar al módulo **Gestión Humana**.
2. El header debe verse con fondo gris continuo (mismo tono que el contenido).
3. Breadcrumb visible arriba: `Inicio › Gestión › Gestión Humana`.
4. Pill a la derecha mostrando "Empresa activa: <nombre de la empresa>".
5. Sin líneas grises divisorias entre header/tabs ni entre tabs/content.
6. Tab activa (Resumen por default) con subrayado azul.
7. Validar en los 3 temas (claro / oscuro sistema / oscuro legacy).

---

# K+AIR v0.1.215

## 🎨 Home de Capacitaciones al patrón premium v2 estilo Presupuesto (📦816)

El portal legacy del submódulo 1.2.1 (con prefijo `cap-portal__*`, tokens `--cp-*` propios, header con logo K+AIR y botón Volver redundantes) se reemplazó por el patrón premium v2 replicado de `pres-home`: header con breadcrumb + icon chip + título Manrope + pill "Año Activo" + botón "Volver al Menú", y 2 main cards (Ver Cronograma gradient + Clonar Cronograma blanca).

### Cambios principales

- **Header premium v2**: breadcrumb "Recursos / Capacitaciones" + icon chip SVG 🎓 + título "Capacitaciones" + subtítulo + pill "Año Activo: 2026" + botón "Volver al Menú" (consistente con el shell).
- **2 main cards** (reemplazan las 6 anteriores):
  - **PRIMARY** (gradient azul): "Ver Cronograma de Capacitaciones" → abre el viewer
  - **SECUNDARIA** (blanca con ícono naranja): "Clonar Cronograma" → IPC `duplicate-capacitaciones-sheet`
- **Sin sección "Gestión y Configuración"**: las 4 cards placeholder con `alert()` (Importar, Exportar, Matriz, Asistencia, Informe, Certificados) se removieron porque no tienen contraparte funcional.
- **Tokens `--kair-*` del design system** (sin tokens `--cp-*` propios).
- **Iconos SVG inline** (sin dependencia de Bootstrap Icons CDN).
- **Dark mode completo** con `[data-theme^="dark"]` (cubre dark + dark-legacy).

### Bug detectado y corregido durante validación

La primera versión del refactor usaba paths `../../../shared/...` válidas para iframe (como Presupuesto) pero **NO** para HTML inyectado vía `fetch + innerHTML`. Las URLs relativas se resuelven desde el documento padre (`index.html`), no desde el archivo fetched. **Fix**: paths relativas a `index.html` (`./shared/...`, `./modules/...`) + `<link>` explícito a `cap-home.css` (que se había omitido por error).

### E2E nuevo

`tests/cap-home-e2e.js` con jsdom (validación estructural sin display):
- 18/18 checks DOM OK
- 15/15 reglas CSS requeridas presentes
- 9/9 tokens kair presentes
- 11/11 estilos clave validados
- Callbacks `enterCronograma()` + `cloneCronograma()` + `goBackToModule()` correctos

### Archivos

- `modules/recursos/capacitaciones/cap-home.html` — reescrito (71 líneas)
- `modules/recursos/capacitaciones/cap-home.css` — reescrito (259 líneas, 100% scoped)
- `index.html` — cache-bust `?v=CAP-20260927-cap-home-premium-v2` en `capacitaciones-portal-logic.js`
- `package.json` — bump 0.1.214 → 0.1.215 + `jsdom` devDep
- `tests/cap-home-e2e.js` — nuevo E2E con jsdom
- `AGENTS.md` — gotcha 13 añadido (URLs en fetch + innerHTML)
- `CHANGELOG.md` — entrada `[0.1.215]`
- `CONTEXT.md`, `PRD.md`, `README.md`, `release-notes.md` — sincronizados

### Para validar

1. Abrir la app y navegar a Módulo **Recursos** → **1.2.1 Capacitaciones**.
2. El render debe coincidir con el home de **Presupuesto** (mismo patrón premium v2).
3. Click en "Ver Cronograma" debe abrir el viewer de capacitaciones.
4. Click en "Clonar Cronograma" debe mostrar el toast de éxito.
5. Validar en claro y los dos oscuros (Sistema + Oscuro).

---

# K+AIR v0.1.214

## 🎉 Splash de bienvenida con confetti estilo Stripe (📦815)

El check verde Bootstrap hardcoded (`#28a745`) del splash de bienvenida se reemplazó por una animación moderna consistente con el design system premium v2.

### Cambios visibles

- **SVG rediseñado** con `<defs><linearGradient id="kairSuccessGrad">` (verde→azul) para el círculo y el check.
- **Halo pulsante** (`<circle r="52">`) con animación `success-halo` 2s ease-out infinite.
- **Check con stroke gradiente** (4.5px round caps) sobre el círculo.
- **6 cuadrados confetti** (`rect 6×6`) rotando ±180° mientras vuelan ±42px en 3 colores premium v2 (`--kair-blue`, `--kair-green`, `--kair-amber`).
- **ViewBox 52 → 120** para que el confetti respire.
- **Glow drop-shadow** dark mode más intenso.

### Tokens nuevos en `:root`

- `--kair-blue`, `--kair-green`, `--kair-amber` (reutilizados del design system; antes no existían como custom properties).

### Patrón transferible (estilo Stripe)

- NO usar colores hardcoded (`#28a745` Bootstrap) → exponer como tokens `--kair-X` y consumir desde `stroke`/`fill` del SVG y desde los keyframes CSS.
- Migrar AMBOS overlays (`#kair-loading-success.active` activo + `.kair-transition-success` legado CSS huérfano) por consistencia si el componente se reactiva.
- ViewBox generoso (≥120) para que el confetti respire.
- Detalles completos en `design_system.md §15`.

### Archivos

- `renderer.js` (~líneas 3150+) — SVG del success con `<defs>`, halo, 6 confetti rects, check premium.
- `styles.css` — bloques `.loading-success-*` activo + `.kair-transition-success-*` espejo (CSS huérfano por consistencia).
- `index.html` — cache-bust `styles.css?v=20260926-confetti-success`.
- `package.json` — bump 0.1.213 → 0.1.214.
- `AGENTS.md` — gotcha 12 añadido.
- `CHANGELOG.md` — entrada `[0.1.214]`.
- `CONTEXT.md`, `PRD.md`, `design_system.md`, `README.md` — sincronizados.

### Para validar

1. Reiniciar la app y hacer login → el splash debe mostrar el check con confetti en lugar del verde plano.
2. Validar en claro y los dos oscuros (Sistema + Oscuro) que los colores del confetti son los premium v2 (no Bootstrap).
3. Confirmar que el halo pulsa y los 6 cuadrados rotan mientras vuelan.

---

# K+AIR v0.1.213

## 🧠 Investigación de Accidentes con IA — prompts del 5 Porqués alineados al dataset v5 (📦814)

Migración metodología vertical por columna: cada celda M explica la causa de la MISMA M del nivel anterior (cadena causal INDEPENDIENTE por columna).

### Reglas v5 implementadas

- **HERENCIA DE N/A**: si una categoría es N/A en el nivel anterior, sigue siendo N/A en el siguiente.
- **DETENCIÓN POR CAUSA RAÍZ**: cuando una celda identifica la causa raíz, no se pregunta más en esa columna.
- **CERO CRUCES**: las categorías NO se mezclan entre sí.

### Cambios técnicos

- `INSTRUCCIONES_PROMPT` en `llm_server.py` ahora es la plantilla v5 VERBATIM (metodología vertical con encabezado "ANÁLISIS VERTICAL POR CATEGORÍA").
- Secciones del accidente en texto plano (`\n\nDescripción del accidente:\n…\n\nContexto Adicional:\n…\n\nAnálisis de 5 Porqués:`) — el v5 eliminó los asteriscos del v4.
- Parser acepta encabezados encadenados (`2. ¿Por qué ocurrieron las causas del Nivel 1?`).
- `_uniform_preguntas` ELIMINADA (existió 1 día, chocaba con el formato v5).
- Aviso de calidad visible: banner ámbar `.inv-quality-warn` si `validation_warning` o `score < 70`.

### Pendiente

- Re-entrenar el modelo con regla columnar nueva (pipeline en `docs/opencode/plans/20260925-entrenamiento-5porques-v5.md`, Unsloth + SFT sobre v5+train, export F16 — NO Q4 porque destruye fine-tunes pequeños).

### Archivos

- `Portear/src/llm_server.py` — `INSTRUCCIONES_PROMPT` reescrito a v5.
- `Portear/src/config.json` — `llmSystemPrompt` sincronizado.
- `modules/investigacion-accidentes/investigacion-accidentes-main.js` — parser v5 + banner de calidad.
- `modules/investigacion-accidentes/view.css` — estilos `.inv-quality-warn` + dark.
- `tests/investigacion-accidentes/test-hf-llm-canales.js` — 144/144 OK.
- `package.json` — bump 0.1.212 → 0.1.213.
- `AGENTS.md` — gotcha 11 añadido.
- `CHANGELOG.md` — entrada `[0.1.213]`.

---

# K+AIR v0.1.212

## 📬 Notificaciones Persistentes (📦807-812)

Sistema completo de notificaciones in-app que detecta eventos desde el main process y los entrega al usuario sin depender de que la Bandeja Integrada esté abierta.

### Cambios principales

- **Bridge IPC** (`main/notifications-bridge.js`) con tabla `notificaciones` (tipo `correo`/`evento`, `dedupe_key` UNIQUE + índice único compuesto `COALESCE(fecha_evento,'')`).
- **Service** (`main/notifications-service.js`): tick 60s, ventana configurable (15min/1h/6h/24h default 24h), guard de reentrada `_tickEnCurso`, backoff exponencial.
- **Detector de correos** (`main/notifications-email.js`) sin fan-out: 1 fila global `company_key='*'` por thread.
- **Gate** (`main/notifications-gate.js`): fail-closed, admin bypass.
- **12 fuentes de calendario** (1 stub: plan-trabajo).
- **UI completa**: badge en header + toast persistente (autoClose:0) + tabs Pendientes/Notificaciones + marcar leída individual/todas + selector de ventana.

### Tests 155/155 OK

- bridge 28/28, email 7/7, service 10/10, wiring 11/11, fuentes 52/52, ui 36/36, seguridad 23/23.

### Fix de duplicación (📦809)

- El buzón Gmail es global; antes cada correo se insertaba 1× por empresa con bandeja habilitada (47×5=235 no leídos). Ahora **UNA fila global** `company_key='*'` por thread.

### Sincronización de docs (📦808)

- README corregido: "11 fuentes" → "12 fuentes (1 stub: plan-trabajo)".
- `PRD.md` (27 KB, 480 líneas): vision, 3 roles usuarios, stack, 10 convenciones, 9 módulos con 67 entradas, sistema notificaciones detallado.
- `design_system.md` (27 KB, 430 líneas): 15 secciones cubriendo premium v2.

### Archivos

- `main/notifications-{bridge,service,email,gate}.js` — 4 archivos nuevos.
- `shared/kair-alerts.js` — UI tabs + tamaño estable.
- `assets/js/update-notifications.js` — adaptadores de toast.
- `package.json` — bump 0.1.211 → 0.1.212.
- `AGENTS.md`, `README.md`, `CHANGELOG.md`, `CONTEXT.md`, `PRD.md`, `design_system.md` — sincronizados.

---

# K+AIR v0.1.211

## 🎨 Cierre de la migración premium v2 — Peligros + Inspecciones + Mantenimiento + Verificación + Mejoramiento (📦793-804)

Tercera ola (y cierre) del rediseño premium v2: tras los homes de módulo (📦730-738, v0.1.197-205) y los submódulos iniciales (📦739-790, v0.1.208), se cierran los 5 módulos principales que faltaban con UI propia y sus submódulos de Verificación + Mejoramiento. **Submódulos finalizados en este rango**:

### Inspecciones Sistemáticas (4.2.4) — 📦793 + 📦796 + 📦798

- **Hub premium**: score compuesto (3 componentes: cumplimiento programa, % cerradas a tiempo, % categorías evaluadas) + 3 metric cards (Inspecciones del mes / NC abiertas / Próximas a vencer 7d) + chart SVG nativo de distribución por tipo + module grid con flecha.
- **11 clases premium nuevas** scopeadas bajo `.kair-app` con tokens locales y dark cubriendo `dark + dark-legacy` con `[data-theme^="dark"]`.
- **Las 7 vistas funcionales** migran al header premium v7 (`buildHeader` con clases `kmi-*`: transparente, breadcrumb, píldora "Sincronizado", botón Volver) manteniendo intacto el flujo de datos. Historial con píldoras de filtro por tipo + buscador; Dashboard/Programa con tabla mensual; Detalle + 4 formularios con tokens del sistema premium.
- **Reconexión a `PROGRAMA DE INSPECCIONES.xlsx` real** (conexión que existió en 📦332/338 y quedó desactivada en la reconstrucción 📦500). Detección de encabezados de mes **por texto** (Ene…Dic), códigos `p`=programado / `c`=cumplido, respaldo automático en `backup/` antes de cada escritura.

### Identificación de Peligros (4.1.2) — 📦794 + 📦795

- Bridge IPC `identificacion-peligros-bridge.js` + 4 sub-componentes + service + CSS scopado bajo `.km-wrapper` con tokens propios `--km-*`.
- Header System v2 con badge-ico + título Manrope + subtítulo + acciones (header transparente v7 con botón Volver).
- Donut theme-aware con helpers `tok()`/`palette()`.
- Modo oscuro en los DOS atributos `[data-theme^="dark"]`.
- Test de 9 contratos (`test-identificacion-peligros.js`).

### Mantenimiento Periódico (4.2.5) — 📦797

- Header premium con badge-ico + título + subtítulo + botones ghost/outline alineado al lenguaje visual premium.
- Tipografía del sistema aplicada en `mantenimiento.css` (Manrope/DM Sans).

### Home Gestión de Peligros y Riesgos — 📦799

- **Fix de datos reales** en hero, tarjetas y gráficas: el home premium (📦754) se veía todo en cero aunque la empresa tuviera datos reales.
- **Causa doble**: `refreshStats()` guardaba las respuestas en la caché global pero nunca asignaba `this.peligrosStats` (datos morían en la bodega) + nombres de campos incompatibles con los puentes.
- Ahora Inspecciones muestra **29/39** con el Excel real de Tempoactiva.
- Mediciones y EPP marcados como `null` para que el score compuesto los excluya en vez de arrastrarlo a 0.

### Auditoría Anual (6.1.2) — 📦800

- **Fix del botón "Nueva auditoría"** que abría un modal sin estilo: el modal existía en el DOM pero tenía cero reglas CSS.
- **`auditoria-anual.css` +432 líneas**: estilos del modal (oculto por defecto, `--open` flex, backdrop, panel radio 20, formulario 2 columnas, botones ghost/primary), diálogo de confirmación y toast de respaldo.
- Tokens `--aud-*` scopados sobre el propio modal (vive en `<body>`, fuera de `.kair-v3-module`) + dark con `[data-theme^="dark"]`.
- Fachada `openAuditoriaForm` con `console.warn` + updateNotifier si `__kairAudInstance` es null (antes fallaba en silencio).
- Fix del guard `_clickBound` del hub que impedía re-bindear tras `destroy()` + re-render.

### Matriz de Control Operacional (7.1.1) — 📦801

- Premium v2 (Header System v2, tokens canónicos, dark completo).
- **Fix del scroll roto del editor** reportado con captura. **3 causas diagnosticadas**: (1) `.kair-editor` tenía `align-items: start` que impedía estirar la fila `main` del grid → `overflow-y: auto` nunca se activaba; (2) faltaba `min-height: 0` en `.kair-editor__main`; (3) la vista de lista usaba `class="kair-app-main"` huérfana (la correcta es `.kair-main` con `flex:1; min-height:0; overflow-y:auto`).

### Verificación — Definición de Indicadores (6.1.1) + Despliegue Estratégico (6.1.3) — 📦802

- **6.1.1**: bridge IPC `indicadores-verificacion-bridge` lee `INDICADORES <año>.xlsx` con resolución de carpetas por variantes de acento + hojas RESULTADO/ESTRUCTURA/PROCESO + series mensuales doble fila valor/denominador + match por nombre normalizado. Header premium con badge de origen Excel vs ejemplo + tabs prominentes con subrayado azul + tokens canónicos. Test 37/37 OK.
- **6.1.3**: Header v2 con Volver al hub + Refrescar + 4 metric cards + tabla blindada con 10 columnas + chart SVG nativo de barras horizontales + IPC `revisionAltaDireccion.listarIndicadores` con fallback mock + tokens `--rad-desp-*` scoped + dark unificado. Test 38/38 OK.

### Herramientas y DX — 📦803 + 📦804

- **📦803**: 7 skills de calidad/testing instaladas en `.agents/skills/` (2 de `agents-inc/spacecake-labs` + 5 de `addyosmani/agent-skills`).
- **📦804**: normalización de EOL en 211 archivos (CRLF↔LF sin cambios de contenido, verificado con `git diff -w` vacío).

### Documentación — 📦805

- Auditoría módulo por módulo del README. **Realidad oculta**: el README decía "8 módulos / 48 submódulos" cuando en realidad son **9 módulos / 51 con UI + 16 placeholder en roadmap = 67 declarados en sidebar oficial**. Se añadió el Módulo 8 **Gestión Humana** (top-level nuevo v0.1.191, 12 vistas) y se expandieron las tablas de los Módulos 2 (6→13), 3 (8→18), 4 (0→11), 5 (0→2), 6 (0→4) y 7 (0→4 vistas) con columna Estado (✅ implementado / 🚧 Roadmap). Solo commit `📦805` (172 inserciones / 40 borrados en `README.md`).

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

- `package.json` (versión 0.1.211)
- `shared/kair-premium.css`, `shared/kair-design-tokens.css`, `shared/kair-components.css`
- `AGENTS.md`, `README.md`, `CONTEXT.md`, `CHANGELOG.md`, `release-notes.md`

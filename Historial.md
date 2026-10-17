# K+AIR — Historial de trabajo

> **Para qué existe este archivo:** que cualquier modelo o persona que retome el desarrollo
> sepa **exactamente dónde quedó todo**, sin tener que leer 4 800 líneas de bitácora.
>
> No reemplaza a ningún otro documento, se suma:
>
> | Archivo | Responde a… |
> |---|---|
> | `PROMPT.md` | ¿Cómo se trabaja aquí? |
> | `CHANGELOG.md` | ¿Qué cambió en cada versión publicada? |
> | `BITACORA.md` | ¿Por qué el código es como es? (bitácora de bugs) |
> | `CONTEXT.md` | ¿De qué va el proyecto? |
> | **`Historial.md`** | **¿Dónde quedó el trabajo y qué falta?** ← este |

---

## 🚦 ESTADO AL CIERRE

> **Este bloque se actualiza en CADA cierre de trabajo, sin excepción.**
> Es lo primero que debe leer quien retome. Si está desactualizado, el archivo perdió su razón de ser.

| Campo | Valor |
|---|---|
| **Fecha de cierre** | 2026-10-16 (jornada del enlace reabierto, cerrada 22:10 hora Colombia) |
| **Rama** | `Dev` en el escritorio, sobre un `origin/Dev` que **ya traía fusionado `Dev-Pc`** (`264da708`, merge de la otra rama). El push de 📦903 hubo que integrarlo primero con un **rebase sobre `origin/Dev`**: el remoto traía 4 commits (`898`, `899`, `900` y el merge) y dejó **2 conflictos, los dos de documentación** (`Historial.md` y `BITACORA.md`); los archivos de código fusionaron solos. 🔴 **La numeración de paquetes chocó**: las dos ramas usaron 📦898, 📦899 y 📦900 para trabajos distintos, así que hoy hay **6 commits compartiendo 3 números**. El siguiente número libre es **903**. |
| **Último commit de código** | 📦 **903** (2026-10-16, commiteado y **pusheado** a `Dev`): **reabrir el enlace de firma deja de ser un callejón sin salida**. El trabajador que ya firmó y vuelve a abrir el correo del primer día ahora encuentra, en los tres casos, la salida hacia la verificación de autenticidad —que nunca caduca— en vez de un JSON crudo o de un "Enlace no disponible" sin a dónde ir. Incluye el deep-link `/s/<token>?verificar=1`, el `errorHandler` negociando contenido **solo** en la superficie del firmante, y `no-store` en los errores de esa superficie porque un `410` sin `Cache-Control` dejaba el **token en el caché del navegador**. Verificado en producción con el token real `Eq7TC...`. Detalle y "por qué se rompió" en `sgsst-electron-app/BITACORA.md`, entrada 📦903. Antes, 📦 **898** (2026-10-16, desde `Dev-Pc`, commiteado y pusheado): **el gate de consentimiento re-preguntaba por el motivo equivocado, al revés**. Decidía comparando `app_version` (o sea, cada release volvía a preguntar a todo el mundo aunque el texto legal no hubiera cambiado) contra `cfg.consentDocumentVersion`, una clave de `config.json` que **nadie escribía** y que siempre caía en `'v1'` (o sea, editar el texto legal no preguntaba nada). Y `version_terminos`, `version_privacidad` y `texto_hash` se guardaban en cada aceptación y **no los leía nadie**. La máquina estaba construida — el renderer ya enviaba la versión del documento y un SHA-256 real del texto leído (`renderer.js:4046-4048`) — y le faltaba un cable. Arreglo: una sola fuente de verdad, `CONSENT_DOCUMENT_VERSION` en `main.js`, usada por los dos canales, y `app_version` fuera del cálculo (se sigue guardando como evidencia de con qué build aceptó cada persona). Regresión: `main/test-consent-version-898.js`, **22 checks, verificado por mutación real**. Antes, 📦 **894** (2026-10-15, commiteado desde `Dev` a fin de jornada, **sin push**): dos defectos
que el owner reportó en un mismo mensaje. **(a) El submódulo 1.2.1 Programa de Capacitación Anual no aplicaba los
temas**: no es un error de CSS, es que el contenedor **nunca recibió `data-theme`**. El shell lo escribe sobre `<html>` y
sobre los iframes, pero capacitaciones se monta **en línea** con `fetch` + `innerHTML`, así que no hay
`contentDocument` al que escribirle. En todo el módulo habíA **0 escrituras** del atributo y **1 sola lectura**
(`capacitaciones-logic.js:1543`, la que decide el color de los gráficos), así que `isDark` daba `false` siempre. De
ahí salían las **47 reglas `[data-theme="dark"]`** que ya estaban registradas como "reglas muertas" desde antes:
no eran basura, eran el tema entero del módulo, escrito bien y **jamás ejecutado**. El defecto se veíA "a
medias" porque las tarjetas **sí** salíAN oscuras: leen los tokens globales `--kair-*` de `:root`, que el shell
sí actualiza; solo se rompían el fondo (leíA `--k-bg-app`, que solo cambia en el bloque muerto), el texto del
cuerpo y los gráficos. Medido sobre los colores reales de las capturas: el número del donut daba **1.10:1** sobre
`#292929` y **1.55:1** sobre `#384151`, y el texto de "En tu radar" **2.19:1**. Después del arreglo, **5.78:1** y
**13.76:1**. Arreglo de dos piezas, **sin tocar el shell**: un espejo del atributo desde `documentElement` hacia el
contenedor (con `MutationObserver` para cambios en vivo) y los 47 selectores a `[data-theme^="dark"]`, que es el
prefijo y no la igualdad exacta porque **`dark-legacy` no es alias de `dark`**. Había un tercer defecto en la misma
línea: `isDark` comparaba con `=== 'dark'`, así que ni con el atributo presente habríA reconocido
`dark-legacy`. Y una trampa del repinte: los gráficos llevan el color horneado al crearse, así que hay que
**recrearlos**, pero `initializeCharts()` los deja con los datos en cero — sin el `updateCharts()` que va justo
después, cambiar de tema deja los gráficos vacíos. **(b) El `console.warn` de "Cambio de módulo bloqueado"**
tapaba un botón muerto: `showSettingsPage()` monta su iframe sobre `contentArea` y **no registraba que tomó el
control de la vista**, así que `currentModule` decíA "Recursos" y `currentSubmodule` "1.2.1", y el candado de
`showModuleContent` descartaba todo cambio de módulo. El `warn` era cosmético; lo que pasaba es que el clic
siguiente en el menú **no hacíA nada**, sin error. El arreglo registra la salida **antes** de borrar
`contentArea`, reusando `_salirDeSubmodulo()` (la teardown del 📦843, con `try/finally`, la misma que usan el menú
y el botón Volver) y anulando **`currentModule` también**: si solo se limpiara el submódulo, el bloque de
refresco de tema lo usaría para recargar "el módulo visible" y **expulsaríA al usuario de Configuración al tocar
el selector de tema**.  El owner detectó **una segunda mitad que yo no había visto**: mandó una captura del home de Recursos en `dark-legacy` y preguntó si tenía negros. Tenía: `dark-legacy` es el gris neutro (`#121212` / `#292929`, `kair-design-tokens.css:201`), no un alias de `dark`. Mi prefijo `^="dark"` hacía que las 47 reglas aplicaran a los dos temas, **pero el bloque que las declara solo trae los valores de `dark`**, que es la azul: 1.2.1 iba a quedar **azul dentro de un shell negro**. Se corrigió con un bloque `[data-theme="dark-legacy"]` al final (misma especificidad, gana por orden), leído del shell y no de una tabla escrita a mano, más las 3 únicas superficies que el módulo escribe a mano. El test **compara el módulo contra el shell**, así que si la paleta del shell cambia, el módulo tiene que seguirla.El candado **no se quita**: evita perder el estado del submódulo en una recarga espuria.
**El owner llegó diciendo que no sabíA qué decisión tomar porque no queríA dañar nada de lo que ya
funciona**, así que no se tocó nada hasta terminar el diagnóstico y presentarle las dos opciones con la evidencia.
Tests nuevos: `test-capacitaciones-tema-894.js` (**42 checks, 16/16 mutaciones**, con el contraste leído de los
tokens que declara el propio CSS) y `test-guard-modulo-894.js` (**27 checks, 13/13 mutaciones**, con el check del
**orden** de la teardown respecto al borrado). Batería 884–894 en verde y el 861 sigue en 614/614. Antes, 📦 **893**: la pantalla de selección de empresa vuelve al dialecto
premium y **dejó de tapar la animación de Vanta**. El defecto lo encontró el owner mirando la app,
no un test: el contenedor llevaba la clase `kair-premium`, que no es una clase de contenedor sino
el **envoltorio de página** del premium, y por eso pinta fondo (`--kair-canvas` en claro,
`#2d3748` en oscuro), fija `height:100%` y `overflow-y:auto`. Montada sobre el overlay, tapaba la
animación. Un `background:transparent` en la regla del 893 lo cancelaba y dejaba el CSS
**correcto**, por lo que ningún test cantaba nada —ni lo habría cantado con la causa presente, que
no cambiaba el resultado del check. El arreglo fue dejar de usar la clase y **declarar en el
componente lo que antes tomaba prestado**: fuente, `box-sizing` y las bases de la tarjeta, que
viven todas bajo `.kair-premium`. En el camino se perdió el centrado al semar los estilos en línea:
el `alignItems = 'center'` de la pantalla vieja no era decoración sino comportamiento, y un
contenedor sin `align-items` sigue siendo válido para cualquier test. La pantalla tenía además
**tres bloques `[data-theme="dark"]` a secas**, sin su par `dark-legacy`, así que en el oscuro
manual los botones salían con el aspecto del claro; y su texto blanco sobre Vanta daba
**1.93:1**, rescueso solo por un `text-shadow` que WCAG no cuenta: por eso ahora va sobre un panel
de vidrio, que compuesto da **7.59:1**. Nuevo `main/test-empresa-893.js` con **72 checks y 26/26
mutaciones**, con el contraste leído de los tokens reales y compuesto sobre el punto más claro de
Vanta antes de medir. Se reparó `test-panel-tema-885.js`, que exigía el sello `panel885` literal y
se rompió solo con este bumpeo: ahora ancla a la **fecha**. Batería 884–893 en verde (11 tests).
Antes, 📦 **892**: el visualizador de 1.1.1 volvió a abrir documentos; antes, en el mismo turno, 📦 **891** hizo que 1.1.1 sí siga el tema elegido. **En el 891 el sincronizador era una copia de la lógica de `scripts/theme-manager.js`, que NO está cargado en el shell.** Se notaba en el contrato: leía `event.data.mode`, y `renderer.js:1755` manda `theme` y `effectiveTheme`, nunca `mode`. Con `mode` siempre `undefined` caía en el fallback y devolvía `dark` en todos los casos, así que en modo **sistema** devolvía `null` y terminaba **borrando** el atributo que `renderer.js:1746` acababa de escribir: el `postMessage` es asíncrono y siempre gana el último en escribir. El CSS de 1.1.1 estaba bien (58 reglas oscuras, 29 y 29, y 322 usos de tokens): el fallo era el atributo que las dispara, no las reglas. Además, el panel de vista previa tenía `background: #fff` sin contraparte oscura — **el panel blanco que se veía solapado sobre el oscuro** — y diez sitios con `color: #fff` sobre superficies de acento, con el botón "Subir" en **2.56:1** en oscuro. **En el 892 el padre rutea el preview del PDF por `__fileViewerBytes`, que NO es una función del preload** sino una bandera para llegar al bloque que lee bytes con `readFileBytes`. La guarda de existencia la mataba **antes** del ruteo: el PDF fallaba siempre con `API function __fileViewerBytes not found` y unas 40 líneas quedaron como código muerto. La red de seguridad de abajo tampoco se alcanzaba, y el test 861 comprobaba esa sin notar la de arriba. El panel tampoco limpiaba el estado anterior, así que el error de un archivo quedaba pintado sobre el siguiente: de ahí el "error de PDF" con un DOCX en pantalla. Tests nuevos: `test-responsable-tema-891.js` (58 checks, 20/20 mutaciones) y `test-visor-carga-892.js` (26 checks, 16/16 mutaciones, con el check que faltaba: que la red de seguridad sea **alcanzable**). Batería 884–892 en verde (10 tests) y el 861 sigue en 614/614. Antes, 📦 **890** (1.1.5), 📦 **889** (1.1.2 y 1.1.3) y 📦 **887** (el home de Recursos). El hash del commit actual no se escribe dentro del propio commit: un `--amend` lo cambiaría y la referencia quedaría apuntando a un commit fantasma |
| **Commits sin pushear** | **0** después del merge del 2026-10-16. 🔴 Recordatorio permanente de `gh-pages`: se publica **archivo por archivo**, nunca con `git add -A`, porque el árbol de trabajo tiene 45 743 archivos sin rastrear. |
| **Ramas remotas** | Quedan **4**: `Dev`, `Dev-Pc`, `backup-numeracion-2026-09-05` y `gh-pages`. 🔴 **El 2026-10-07 se borraron `feat/e2e-integration-25-tests` e `i-e2e-7-pdf-failure-paths`**, por decisión del owner, después de verificar que **no tenían ni un commit propio fuera de `Dev`** (medido con `git cherry`, o sea por *patch-id*, no por conteo). Antes de borrarlas se publicaron los tags `respaldo/feat-e2e-2026-10-07` (`61edb2c8`) y `respaldo/i-e2e-7-2026-10-07` (`aa6c41b0`), así que el borrado es reversible. **El conteo de commits mentía**: esas ramas parecían tener 302 commits sin integrar, y en realidad era historia duplicada de un trabajo que ya estaba mergeado. `Dev-Pc` **quedó absorbida**: el 2026-10-07 el portátil hizo `edf3d61d` (trajo los 22 commits del escritorio) y `77d1e98b` (la devolvió a `Dev`), así que tiene **0 commits propios fuera de `Dev`**. `backup-numeracion-2026-09-05` **no se toca**: es el respaldo. `gh-pages` **tampoco se mergea**: es el sitio web, se regenera copiando `sitio/`, y un merge de `Dev` ahí metería el código de la app en la página. 🔴 **Al regenerarla, nunca usar `git add -A`**: el árbol de trabajo tiene **45 743 archivos sin rastrear** (`node_modules`, `Temp/`, `backups/` y un `.env`), y un `add -A` publicaría el código de la app y las credenciales de Google en el sitio público. Agregar archivo por archivo |
| **Versión** | `0.1.251` (desarrollo). 🔴 **Regla nueva del owner (2026-10-07): la versión SOLO se bumpea cuando él lo diga.** Antes decía "siempre bumpear en el mismo commit" y por eso este bumpProvocó que la pantalla de consentimiento reapareciera a todos los usuarios sin que el texto legal hubiera cambiado. Ver `PROMPT.md` §5.2 |
| **Suite (portátil)** | **123 tests · 122 verdes · 1 con fallos · 1 sin resumen verificable.** **Cero regresiones.** Medición real del 2026-10-07, **anterior a 📦876**. El rojo era `test-google-oauth-868.js` [54/57], que exige `main/_verificar-credenciales-build.js`, archivo que **no existía en ninguna rama**: lo tragaba la regla `_*.js` de `sgsst-electron-app/.gitignore:80`, que sin ancla se aplica en cualquier directorio y no solo en la raíz. **Ya está corregido en 📦876** y probado por mutación (54/57 sin el archivo, 57/57 con él). 🔴 **Falta volver a medir en el portátil**: no se afirma aquí que esté verde, solo que la causa identificada ya no existe. `test-init-order-bug.js` sigue sin resumen verificable |
| **Suite (escritorio)** | **131 tests · 130 verdes · 1 con fallos · 1 sin resumen verificable.** **Cero regresiones.** Medida el 2026-10-14, ya con 📦886. El único rojo es `test-firma-constancia-consolidada.js` [83/83 en lo estático], que muere esperando `INTERNAL_API_KEY`; `test-init-order-bug.js` sigue sin resumen verificable. 🔴 **Corrección importante: el bloqueo por ABI de `better-sqlite3` YA NO EXISTE.** Este bloque decía que 14 tests no arrancaban en esta máquina, 13 de ellos por `ERR_DLOPEN_FAILED` al cargar `better_sqlite3.node` (compilado para Electron 37 mientras el `node` pelado corre v26.10.0). **Hoy corren todos**: el runner usa el Node de Electron (`ELECTRON_RUN_AS_NODE=1`), que es justamente el runtime para el que está compilado el binario. El diagnóstico viejo era correcto sobre el `node` pelado, pero **la medición se hacía por la vía equivocada**. Subió de 130 a 131 por `test-scrollbar-tema-886.js` (88 checks, 16/16 mutaciones). 🔴 **Durante este paquete se destapó una regresión propia y ya está corregida**: 📦886 bumpea el token de `styles.css`, y `test-sidebar-tonos-884.js` exigía que ese token contuviera "884", así que se rompió solo, sin que hubiera ningún error de verdad. Ese check quedó anclado al token **anterior** a su paquete |
| **Entorno del escritorio** | ✅ `core.autocrlf=false` + 2277 archivos renormalizados · ✅ **913 paquetes npm instalados** (Aclarado: NO son paquetes del changelog. El último `📦n` real es **872**, no 913 — la cifra se leía como si fueran lo mismo) · ✅ Electron 37.10.3 · ✅ `better-sqlite3` compilado para ABI 136 y verificado con un `SELECT` real · ✅ Python 3.14.8 en PATH (`python`, `py`, `python3` probados por el test) |
| **Datos en el escritorio** | ✅ **La BD tiene las 2 empresas restauradas** (medido 2026-10-06 con `better-sqlite3` bajo el Node de Electron, que es la única forma de leerla — el `node` pelado pide ABI 147 y el módulo está en 136): `companies` = **2** filas (Tempoactiva, Temposum), `user_company_roles` = **2**, 76 tablas. `config.json` **sí tiene `companyPaths`** con las 2 empresas (`scan_date` real, sync activo, 110 y 90 empleados). El usuario `admin@kair.local` existe y `isAdmin` sale `true`. 🔴 **Este bloque antes decía "0 filas y sin `companyPaths`": era viejo y ya se corrigió.** 🔴 **Los tokens de Google ya NO están en `config.json`**: ahora viven cifrados en `google-tokens.enc`. Al leer por primera vez, la app los migra y borra la copia en texto plano sola |
| **Validaciones visuales** | ✅ **Cerrado por el owner:** 📦879, 📦880, 📨860, 📨861, 📨868, 📨867 y el ancho de la tarjeta de ingreso (📨869). 🔴 **Pendiente en la app instalada: 📦881, 📦882, 📦883, 📦884, 📦885, 📦886, 📦887, 📦889, 📦890, 📦891, 📦892 y 📦893.**, 📦894.** De 882, 884, 885, 886, 889, 890, 891 y 892 el owner aprobó artefactos, y los de 884, 885 y 886 **sí** usan el CSS real leído del disco (con sus huellas SHA-256 en el pie), pero **ninguno corre el `renderer.js` de verdad ni el IPC**. **Los de 887, 889 y 890 sí se midieron en un navegador real**, pero contra un arnés que monta el CSS y el JS del disco por HTTP, **no contra la app instalada**: no hay `electronAPI` ni IPC detrás. 🟡 **El 893 SÍ se midió en un navegador real**, con los CSS leídos del disco y los tres
temas a la vez: el Vanta se ve detrás, panel y tarjetas centrados, y las tarjetas cambian de
superficie en claro, `dark` y `dark-legacy`. **No es la app instalada**: es una página que monta
los estilos reales sobre un degradado que representa el punto más claro de Vanta, sin
`electronAPI` ni IPC. Alcanza para el diseño y para la cascada; **no alcanza para el shell**.
📦 **El 894 Sí se midió en un navegador real**, con el CSS y el HTML **del disco**: seis paneles, tres
temas por (sin espejo / con espejo). Las dos columnas "sin espejo" **reproducen exactamente las capturas del
owner** — marco blanco con tarjetas oscuras — y las "con espejo" salen con el fondo oscuro y el texto legible.
La columna **Claro sale idéntica antes y después**: el arreglo no toca el tema claro. Sigue **sin ser la app
instalada**: no hay `electronAPI` ni IPC. Alcanza para la cascada de estilos y el contraste; **no alcanza para el
shell, ni para los gráficos**, que dependen de Chart.js y de los datos del Excel. La segunda ronda agregó la paleta `dark-legacy`: los seis paneles vuelven a salir con el panel 6 en gris neutro, igual que el home de Recursos de la captura del owner, y el panel 4 sigue azul. U0001F534 **El 895 no se midió en ninguna parte**: el arnés con iframe saturó el navegador con tres timeouts (el mismo síntoma del 891) y se sustituyó por ejecutar la función real en Node con `vm`, que valida la lógica del scroll pero **no** el comportamiento en el navegador.
🔴 **Los de 891 y 892 NO se midieron en ningún navegador.** El arnés del 891 llegó a una conclusión útil —que el iframe no cargaba el módulo compartido— pero se colgó después por el `load` del iframe, que no dispara con el bundle del file-viewer montado, y el browser se saturó. Se cambió de método: **el 891 se verificó por análisis del código y el 892 íntegramente por test en Node**. De 883 no hay revisión: el fix está razonado sobre la especificación de CSS, **que es un razonamiento, no haberlo visto**. Al abrir la app: Configuración sin la barrita del extremo derecho, menú lateral legible en Sistema y Oscuro, Panel de Control oscuro en los dos, **la barra de desplazamiento del color del fondo y no blanca** en los dos modos oscuros, y en Recursos: el home sin tarjetas blancas, **1.1.2, 1.1.3 y 1.1.5 legibles en Sistema y en Oscuro**. Lo nuevo: **1.1.1 debe verse oscuro en modo Sistema**, y **abrir un PDF y un DOCX en 1.1.1 debe mostrar el documento**, no un error. Si algo falla, el mensaje ahora nombra el archivo y su extensión. Ver los pendientes 16 y 17 |
| **Jornada** | **En curso** (2026-10-16). Hoy: 📦898 (gate de consentimiento), 📦899 (skill de asesoría legal) y 📦900 (K+AIR sin CDN, documento para el abogado, notas de Incidencia/Prevalencia). Al cierre se fusionó `origin/Dev` del escritorio (📦898 a 📦902) sobre `Dev-Pc`: **2 conflictos, ambos de documentación**, y **0 líneas perdidas** (verificado línea por línea contra cada lado antes de comitear). La suite quedó en **141 tests · 138 verdes · 3 con fallos**, y **ninguno de los 3 fallos lo causó el merge**: uno es una regresión del propio 📦900 del portátil, otro ya fallaba en las dos ramas antes de fusionar, y el tercero lo introdujo el 📦901 del escritorio. |
**894**, el submódulo 1.2.1 Capacitaciones y el botón muerto del menú. El owner reportó los dos defectos
en un mismo mensaje y añadió que no sabíA qué decisión tomar porque no queríA dañar nada de lo que ya
funciona: **se investigó antes de tocar nada** y se le presentaron las opciones con evidencia, no una propuesta.
El hallazgo de fondo es que el tema **sí llega a `<html>` y a los iframes**, y como Capacitaciones se monta en
línea con `fetch` + `innerHTML`, el contenedor nunca recibe el atributo: habíA **0 escrituras** y **1 lectura** en
todo el módulo, y `isDark` daba `false` siempre. Las "47 reglas muertas" que estaban anotadas como deuda eran
precisamente el tema del módulo, escrito bien y nunca ejecutado. El arreglo no tocó el shell: espejo del atributo
en el contenedor y los 47 selectores a `^=`. El `console.warn` de "Cambio de módulo bloqueado" resultó ser
**cosmético**: lo que pasaba es que el clic siguiente en "Recursos" no hacíA nada, porque
`showSettingsPage()` no registraba que habíA tomado la vista. Antes, 📦891, 📦892 y 📦893. **893**, la pantalla de los dos sobre 1.1.1 Responsable del SG-SST. **891**, el tema: el sincronizador del viewer era una copia de la lógica de `scripts/theme-manager.js`, que **no está cargado**, y leía una clave (`mode`) que el shell nunca manda. El CSS estaba bien —58 reglas oscuras, 29 y 29—: lo que faltaba era el atributo que las dispara. En paralelo, el panel de vista previa tenía fondo blanco fijo y **diez** `color: #fff` sobre acentos, que en oscuro se quedaban en 2.56:1. Se resolvieron con tokens `on-acento` por tema, y los checks de contraste del test **leen los tokens reales del CSS y calculan luminancia**, para que un cambio de `--kair-primary` se note solo. **892**, la carga de documentos: el preview del PDF se rutea por `__fileViewerBytes`, que **no existe en el preload** porque es una bandera, no una función; la guarda de existencia lo mataba antes del ruteo, así que el PDF fallaba siempre y el bloque de ruteo era código muerto. Y el panel no limpiaba el estado anterior, de modo que el fallo de un archivo quedaba pintado sobre el siguiente. **Un incidente propio que quedó anotado:** un script mío leyó un CSS como UTF-8 y lo escribió como `latin1`, convirtiendo cada `═══` y `—` en basura: 64 caracteres de reemplazo y el archivo **seguía funcionando**, porque el navegador ignora los comentarios. Lo detectó un test al leer 0 tokens; se restauró desde git y se reaplicó con un script que **aborta si aparece `U+FFFD` antes de escribir**. Es la trampa 24 de `PROMPT.md`. Tests nuevos: `test-responsable-tema-891.js` (58 checks, 20/20 mutaciones) y `test-visor-carga-892.js` (26 checks, 16/16). Batería 884–892 en verde (10 tests); el 861 sigue en 614/614. Antes, del 2026-10-14: 📦890 (1.1.5), 📦889 (1.1.2 y 1.1.3), 📦887 (el home), 📦886, 📦885, 📦884 y 📦883. **Sin bump de versión**: sigue en `0.1.251` |


### 🛠️ Pendientes abiertos (al 2026-10-15, cierre 20:00 — actualizado con la sesion de migracion a kair-server)

#### De la sesion del 2026-10-15 (migracion a kair-server)

1. **🔴 Ningun equipo cliente le habla todavia al servidor.** El servicio esta desplegado y
   respondiendo en `https://firma.kair.fyi`, pero **no hay ninguna empresa registrada en el backend**,
   asi que todavia no se puede firmar de punta a punta. Falta, en cada equipo que firme, la secuencia
   `firma:config:set-url` -> `firma:config:set-admin-key` -> `firma:empresa:create` ->
   `firma:empresa:set-api-key`. El admin key esta en `/opt/kair-firma/admin-key.txt`. **No usar
   `firma:config:set-api-key`**: esta deprecado (`main/firma-bridge.js:647`), guarda en
   `empresas["__default__"]` por compatibilidad legacy y el propio codigo pide migrar al per-empresa,
   que exige K+AIR v0.1.192 o superior.
2. **🔴 No se ha probado una firma real de extremo a extremo.** Los 973 tests usaban `jsonTransport`,
   que no envia correo. Se confirmo que el envio funciona (`messageId` de Gmail), pero **nadie ha
   creado un sign request, recibido la invitacion, firmado desde el celular ni descargado la
   constancia**.
3. **🟡 La tarea `KairFirmaTunnel` del portatil quedo deshabilitada pero no borrada, y esta MUERTA.**
   El script corre `cloudflared tunnel run kair-firma`, que lee `~/.cloudflared/config.yml`, y ese
   directorio ya no existe en ninguna maquina (verificado en `C:\Users\Usuario\.cloudflared`,
   `ProgramData` y `systemprofile`: ninguno existe). Ademas `scripts/firma-tunnel/` describe una
   arquitectura que ya no es la vigente: conviene decidir si se borra o se archiva.
4. **🟡 No hay backup automatico.** `/opt/kair-firma/backups` existe y hay una copia manual
   (`firma-20261016-0250.sqlite`), pero no hay cron. La guia vieja (`deploy/README-DESPLIEGUE.md`,
   paso 9) tiene el script que nunca se instalo.
5. **🟡 No hay monitorizacion.** Nada avisa si el servidor se cae o si el tunnel se desconecta. El panel
   de Cloudflare muestra el estado, pero no hay alerta activa.
6. **🟡 6 vulnerabilidades de `npm audit`** sin revisar, reportadas al desplegar. No se corrio
   `npm audit fix` a proposito.
7. **🟡 Dos tests fallan en el servidor, ninguno por bug de codigo.** `idempotency-isolation` caso 2
   falla porque su propio helper genera un PDF nuevo por llamada y pdf-lib escribe `CreationDate`,
   asi que los dos requests llevan SHA-256 distinto y el `409` del servidor es lo correcto. El otro,
   `pdfValidator` §6.2, mide un timeout de 200 ms y tarda 326 ms con 973 tests en serie sobre 2 vCPU;
   el test busca detectar un hang (que seria >5 s). Ver `docs/MIGRACION-SERVIDOR-FIRMA.md` seccion 7.
8. **🟡 `origin/Dev-Pc` quedo 4 commits atras** (`875e58d2`, 📦897). Falta
   `git push origin Dev:Dev-Pc`; no existe rama local `Dev-Pc`.

#### Del 2026-10-13 (siguen abiertos)

1. **🔴 El gate de consentimiento re-pregunta por el motivo equivocado.** `consent:estado` compara
   contra `app.getVersion()`, así que **cada bump de versión le repite el consentimiento a todos**,
   aunque el texto legal no haya cambiado. Y al revés: editar la política **no** vuelve a preguntar,
   porque `version_terminos` y `version_privacidad` se guardan pero **nadie los vuelve a leer** (solo
   aparecen en el CREATE y en el INSERT). `config.consentDocumentVersion` se lee en dos lugares y
   **nadie lo escribe**, así que siempre vale `'v1'`. El `texto_hash` tampoco protege nada: no se
   compara contra nada. *Evidencia viva: el 2026-10-07 se aceptó dos veces con el mismo
   `texto_hash` (`8bf9b25d43a1`), solo porque entre una y otra hubo un bump de versión.*

2. **🔴 El consentimiento es por EQUIPO, no por persona.** La consulta es
   `SELECT ... ORDER BY aceptado_en DESC LIMIT 1` **sin `WHERE email = ?`**: toma la aceptación más
   reciente de quien sea. En un equipo compartido el primero que acepta silencia el gate para los
   demás. Y hay un problema de fondo que **no se arregla con código**: quien marca las casillas es el
   admin del SG-SST, y los datos que se registran son de sus subordinados, que nunca ven esa pantalla.
   El registro prueba que *alguien* aceptó, no que lo aceptó el titular. **Esto necesita asesoría
   jurídica**, no un parche.

3. **🟡 Los Términos y Condiciones de USO ya existen** (`sitio/terminos.html`, 13 secciones,
   publicados y verificados 200 el 2026-10-07, commit 📦877). Se/arregló el defecto de fondo: el gate
   hacía aceptar unos Términos que no existían en ningún lado. Sigue pendiente, y **es trabajo del
   asesor, no del código**: (a) la **base legal real**, que para seguimiento de incapacidades es
   **obligación legal** (Decreto 1072 / Res 0312), NO consentimiento — el gate hoy dice "lícito
   **únicamente** con su autorización", que es incorrecto a la luz del art. 7 de la Ley 1581;
   (b) el gate dice que la autorización es "facultativa y revocable", lo que **contradice** el
   carácter obligatorio del tratamiento en el SG-SST: si es facultaria, el administrador puede
   renunciarla y el sistema deja de cumplir. **Ninguno de los dos textos se tocaron a propósito**;
   cambiarlos es decisión del owner con asesoría. 🔴 **Tensión entre los dos documentos**: `privacidad.html`
   §1 declara a **JRFSoluciones** responsable del tratamiento "de los datos personales descrito en este
   documento", mientras `terminos.html` §4 declara responsable a **la empresa que usa K+AIR**. Se
   pueden conciliar si se précise que son responsables de cosas distintas (los correos y la web, una;
   los datos laborales que la empresa registra, la otra), pero hoy el lector lo va a leer como una
   contradicción. Armonizarlo también es del asesor |

4. **🟡 El gate pide autorización de "datos sensibles de salud" y el módulo sí los guarda.** La tabla
   `seguimiento_incapacidad_caso` tiene CIE-10 (`codigo_cie10`, `cie10_dx2/3`), porcentajes de PCL,
   resultados de examen médico y dictámenes medicolegales, junto con identificación completa del
   trabajador. **Hoy tiene 0 filas**, pero el esquema dice lo que hará. Definir con el asesor si el
   consentimiento es el instrumento correcto o si debe ser aviso de privacidad.

5. **🟡 Validación visual del gate por CDP.** Se validó por evidencia en disco (creó
   `auth-credentials.enc` cifrado de verdad, y el gate no reapareció porque correspondía), pero **no
   quedaron capturas** del overlay ni del chequeo de Escape. El driver quedó en
   `%TEMP%\validar-consent-cdp.js` y `playwright-core` ya se desinstaló.

6. **🟡 `test-firma-constancia-consolidada.js`** — el único test que queda en rojo en el escritorio:
   83/83 estáticos verdes, y el bloque runtime muere con el mensaje literal
   `FAIL runtime: Variable de entorno requerida: INTERNAL_API_KEY`. El test no menciona esa variable en
   su código, pero al cargar `firma-service/src/config.js` es `required()` sin fallback. Se resuelve con
   el `.env` del PC viejo (aquí existe `.env` pero solo trae las credenciales de Google OAuth). **No se
   pide esa clave por chat.**

7. **🟢 `Update-EnvPublicUrl`** ya se borró (código muerto tras el túnel con URL fija). Los checks
   que dependían de él se invirtieron. Los 3 CJK de `firma-service/tests/logger.test.js` y
   `tests/notificaciones-toast-e2e.js` también están fuera.

8. **🟡 Falta volver a medir la suite en el portátil**, después de traer 📦876 y 📦877. Se espera que
   `test-google-oauth-868.js` pase a **57/57** (el guardia ya está commiteado; se probó por mutación
   que sin él da 54/57, que es exactamente el rojo que veía). **No se afirma que esté verde: hay que
   medirlo.** Este es el único punto donde el escritorio y el portátil tenían bloqueos distintos del
   mismo test, y por eso conviene volver a medir en ambos lados |

9. **🟡 Falta validar a ojo el popup del calendario grande (📦878).** Los 26 checks de
   `test-calendar-chip-hover-878.js` comprueban el cableado y que la función respete el `hint`,
   ejecutándola en una VM; **no comprueban dónde queda el popup en pantalla**. El calendario
   grande es mucho más ancho que el minicalendario, y el popup se ancla a la derecha del
   elemento con volteo automático si no cabe. Es lo único de 📦878 que no se puede verificar
   sin que alguien lo mire.

10. **🔴 13 tests no arrancan en el escritorio por el ABI de `better-sqlite3`, y no es cosa de un
    rebuild.** El binario `node_modules/better-sqlite3/build/Release/better_sqlite3.node` está
    compilado para **Electron 37**, y el `node` pelado de la línea de comandos corre **v26.10.0**, así
    que los 13 tests que abren la base de datos mueren en `ERR_DLOPEN_FAILED`. *Se intentó arreglar el
    2026-10-07 y falló por dos capas:* `prebuild-install` dice `No prebuilt binaries found
    (target=26.10.0)` — no hay binario para esa versión — y al caer al compilado, `node-gyp` no puede
    ni hacer `clean`: `EPERM ... unlink 'better_sqlite3.node'`, porque el archivo lo tiene abierto un
    proceso vivo. *Lo que NO se hizo y es lo importante:* **no se cerraron los procesos `electron`, a
    propósito**, porque uno de ellos es la sesión de MCode y otro puede ser la app del owner abierta.
    Matar procesos del usuario sin permiso no se hace solo. **Y aunque se cerraran, el rebuild solo
    cambiaría el problema de lugar:** un binario sirve para un runtime o para el otro, y
    `package.json` **no tiene `electron-rebuild`**, así que no hay forma de tener los dos. La
    solución de verdad son **dos copias del binario** según el contexto, que es un cambio de
    arquitectura del proyecto y merece su propia tarea, no un comando suelto.

11. **🟡 Barrido en la Bandeja: 10 selectores más con el mismo desborde que el de 📦880, y NO se
    tocaron.** El patrón que se arregló en 📦880 es `width: 100%` + `padding` sin
    `box-sizing: border-box`. Salió en `premium.css`: `.tipos__i`, `.tipos__volver`, `.tuday__i`,
    `.kair-mail-folders-menu__item`; y en `styles.css`: `.kair-legend__item`, `.compose-panel__chip`,
    `.compose-panel__input`, `.compose-panel__textarea`, `.kair-mail-search__chip`. **Que el patrón
    esté no significa que se vean mal**: con `overflow: hidden` en el padre el desborde no se nota, y
    en los inputs el ancho extra es inofensivo. Se dejan así a propósito hasta que alguien los vea feos
    en pantalla, porque cambiarlos a ciegas es cambiar cosas que quizá el owner quiere así.

12. **🟠 El degradado del chip del mes se probó y se quitó, para que conste.** Durante 📦880 se
    implementó `mask-image` sobre el texto de la pastilla (en vez del `text-overflow: ellipsis`),
    con degradado a `calc(100% - 44px)` que terminaba en `transparent calc(100% - 10px)`. El owner
    lo vio en pantalla y dijo que no lo quería: **se leía como que el título se estaba apagando, no
    como "hay más"**, y se volvió al "...". Queda escrito para que nadie lo reintente creyendo que es
    mejor. El `box-sizing` de la misma tanda **sí se quedó**, porque ese era un bug de verdad.

13. **🟢 Iniciativa Hermes: la instalación YA ESTÁ COMPLETA (verificada el 2026-10-11). Lo que
    sigue son decisiones y trabajo nuevo.** Empezó el 2026-10-11. **No toca K+AIR todavía: no hay
    ni un commit de esta iniciativa**, y todo lo que sigue son decisiones, no código.

    *Servidor.* `kair-server` = Ubuntu 24.04.5 LTS, 2 núcleos **AMD C-70**, **3,5 GB de RAM**, 96 GB
    libres, **sin GPU**. Panel: Cockpit en `http://192.168.1.11:9090` — **HTTP plano, sin cifrar**;
    entrar ahí manda usuario y contraseña sin proteger. SSH abierto en el 22.

    *✅ Instalado y funcionando.* `bash ~/hermes-install.sh --non-interactive --skip-browser`.
    Python 3.14.7, uv 0.12.3, el comando en `~/.local/bin/hermes` y el PATH parcheado en `.bashrc`.
    Herramientas activas: `file`, `terminal`, `memory`, `skills`, `cronjob`, `code_execution`,
    `todo`, `web search`, entre otras 18.

    *✅ Ya es un servicio, no una terminal.* `sudo loginctl enable-linger $USER` dado y
    **confirmado** (`Linger=yes`), `hermes gateway install` + `start`. `hermes-gateway.service`
    instalado como user service de systemd, `enabled` y `active (running)`. Logs:
    `journalctl --user -u hermes-gateway -f`. **Por eso no sigue el patrón de K+AIR**: en la app
    todo servicio local nace hijo y `cleanupProcesses()` lo mata con `taskkill` al cerrar; Hermes
    está en otra máquina y sobrevive a que la app esté cerrada.

    *✅ Telegram, restringido al owner.* Bot creado con `@BotFather`; el token se pegó
    **directamente en el servidor y nunca debe compartirse por chat**. `TELEGRAM_ALLOWED_USERS`
    quedó con el ID del owner. El error inicial `Chat not found` se resolvió cuando el owner
    mandó `/start`; después Hermes avisó solo: *"Gateway online — Hermes is back and ready."*

    *✅ Modelo elegido.* `nvidia/nemotron-3.5-lightning:free` vía **OpenRouter**, reasoning
    `medium`. La API key se cargó en el servidor, no en el repo. El owner confirmó que el bot
    respondió una pregunta real. **Ojo con por qué no es local**: 3,5 GB de RAM no alcanzan para
    un 2B con el contexto de 64K que Hermes exige —el KV cache solo de 64K se come la memoria—, y
    🔴 **el propio repo ya lo dejó demostrado con logs del 2026-09-24**: en `llm_server.py` está
    escrito que el modelo chico copia la plantilla literal, repite las mismas causas en los 5
    niveles, genera "6, 10 o hasta 36 porqués" y que **el feedback no lo mueve**. La solución que
    implementaron fue **sustituir la causa ellos mismos y dejarle al modelo un solo nivel**. Ese
    es el diseño a seguir: mecánica determinista en Python, modelo solo donde hay texto libre o
    juicio.

    *Decisiones tomadas, para no volver a discutirlas:*
    - **Un número de WhatsApp por empresa (BYON)**, no uno central. Coherente con el art. 25 del 📦881
      (la empresa es responsable, K+AIR encargado), evita perder el número de todos los clientes por
      un error de uno, y el trabajador recibe del número de su propia empresa. El precio: cada cliente
      verifica su negocio ante Meta y registra sus plantillas a su nombre.
    - **El modelo razona en la nube y los datos sensibles no salen**: el script hace la mecánica y
      Hermes solo recibe datos anonimizados.
    - **El mensaje de WhatsApp NO debe hablar de la incapacidad**: texto genérico, y el detalle por
      otro canal. Es el precio de no depender de una GPU.

    *Números, según el owner (2026-10-13):* administra el sistema para **4 empresas** y hoy hace
    los seguimientos **a mano desde su cuenta personal**. De esas empresas, **2 tienen número de
    teléfono propio** y 🔴 **los números ya están en la app de WhatsApp Business** (confirmado el
    2026-10-13), que es requisito de Coexistence. Ver el **pendiente 15**, que tiene el estado
    final de esa decisión.

    *🔴 Hallazgos de la investigación del 2026-10-13 — verificados contra la documentación de Meta,
    no de memoria. Cambian el orden del plan:*
    - **El WhatsApp Business Tools MCP NO se puede instalar en Hermes.** Meta lo-annunció el
      2026-09-15 en `https://mcp.facebook.com/whatsapp_business_tools` (Streamable HTTP + OAuth),
      pero **solo está disponible en Claude, Codex y ChatGPT**. Es un cliente lo que se conecta, no
      algo que se clone al servidor. **El MCP se usa desde el escritorio, en Claude Code.**
    - **El MCP tampoco entrega el token de producción.** Lo dice la propia referencia de Meta: el
      token lo genera el System User en Business Settings, a mano. El MCP acelera crear la WABA,
      verificar el número y redactar plantillas; **el envío real es la Cloud API**.
    - 🔴 **El webhook es el bloqueo de infraestructura, no el código.** Meta tiene que llamar a
      `kair-server` para entregar "enviado / entregado / leído" y recibir respuestas. El servidor
      está en `192.168.1.11`, en la LAN y **sin IP pública: Meta no puede alcanzarlo**. ✅ **Ya
      está resuelto una vez en este repo y es el molde**: `scripts/firma-tunnel/start-firma-tunnel.ps1`
      arranca un túnel **nominado** de cloudflared (`kair-firma`) con URL fija, y
      `main/test-firma-tunnel-kit.js` lo vigila.
    - 🔴 **JRFSoluciones NO puede verificar su negocio ante Meta todavía.** `sitio/privacidad.html:56`
      sigue con el aviso de que **la razón social, el NIT y el domicilio están pendientes de
      legalizar**, y Meta exige certificado de existencia y representación legal + RUT, con que el
      **nombre legal, el domicilio y el dominio coincidan entre sí**. Para los clientes con RUT es
      trámite rutinario; para el owner es un bloqueo.
    - **Nivel sin verificar de negocio: 250 destinatarios únicos por 24 horas.** Para un SG-SST de
      ~100-110 empleados por empresa alcanza de sobra y sirve para arrancar sin legalizar.
    - **Meta ya no cobra solo plantillas.** Desde el **2026-10-01** también cobra las respuestas
      libres dentro de la ventana de 24 horas (esto pasó hace dos semanas).
    - **Ventana de 24 horas**: fuera de ella **solo salen plantillas aprobadas por Meta**, que se
      revisan una por una, **hasta 24 h cada una, y pueden rechazarse**.
    - La **On-Premises API expiró el 2025-10-23**: la única vía es Cloud API.
    - 🔴 **UN número NO puede autenticarse en DOS empresas.** Un teléfono pertenece a **una sola
      WABA**, en **un solo portafolio de negocio**. No es recomendación, es restricción, y trae
      errores propios: `3441030` ("ya registrado en WhatsApp Business Platform"), `2655093` ("la
      empresa ya está compartiendo esta cuenta con un partner") y el "este número está registrado en
      una cuenta existente: desconéctelo primero". Braze lo dice literal: **"Un número de teléfono
      no se puede compartir entre varias WABA."**
    - ✅ **Un número SÍ puede mandar a trabajadores de empresas distintas.** La plataforma no valida
      a quién le mandás: el destinatario solo tiene que haber dado su opt-in. Eso es lo que hace
      viable "un número, 4 empresas" en la práctica — **pero solo en el envío, no en la cuenta.**

    *🔴 Coexistence: qué exige de verdad (investigado el 2026-10-13). NO es el registro de número
    de siempre:*
    - 🔴 **La vía directa de Meta NO permite Coexistence. Hay que pasar por un BSP** (YCloud,
      360Dialog, Twilio, Woztell…), que es un tercero. Y es un BSP que **no tiene API propia para
      esta operación**: se conecta a mano por su plataforma. **Esto decide el camino entero.**
    - El número tiene que estar en la **app de WhatsApp Business**, no en la personal.
      Coexistence solo aplica a la app de empresas. ✅ **Cumplido**: los números ya están ahí.
    - App **v2.24.17 o superior**, y el número **usado activamente al menos 7 días**.
    - **Keep-alive**: hay que abrir la app **al menos una vez cada 13 días**. Si se pasa, la
      coexistencia se cae.
    - **Colombia NO está en la lista de países no soportados** (Australia, Japón, Nigeria, Filipinas,
      Rusia, Corea del Sur, Sudáfrica, Turquía). Es lo único que sale bien de todo esto.
    - Limitaciones: **5 mensajes por segundo** fijos (irrelevante acá), sin insignia azul, no se
      puede migrar entre WABAs, **la Calling API no funciona**, y quedan fuera Edit/Undo, mensajes
      efímeros, confirmaciones de lectura y ubicación en tiempo real.
    - Al hacer el alta **se desconectan los dispositivos vinculados** y hay que revincular los
      soportados; los que no lo son dejan de disparar webhook.
    - **Los mensajes enviados desde la app siguen siendo gratis**; los de la API se cobran normal.
    - **El precio de fondo: por Coexistence paga un tercero con los mensajes.** Como el mensaje de
      WhatsApp no habla de la incapacidad, ese tercero vería "un recordatorio a este número", no un
      diagnóstico — pero **la protección depende de que el texto siga siendo genérico**.

    *🔴 Números físicos: la eSIM sí sirve, y por qué* (investigado el 2026-10-13).*
    - La lista de números que WhatsApp **no** soporta es: **VoIP, toll-free (0800), premium,
      centrales (UAN) y "personal numbers"**. Una **eSIM de operador móvil NO es ninguno de esos**:
      es una SIM real con numeración móvil normal, y debería pasar el registro.
    - ⚠️ La trampa: existen "números virtuales" por internet (Hushed, TextNow y similares). **Esos
      SÍ son VoIP y Meta los rechaza** salvo que estén en la lista que mantiene el BSP. Si comprás
      de **Claro, Tigo, Movistar o WOM**, es otra cosa.
    - **Precios verificados en las páginas de los operadores (oct-2026):** la eSIM de **Claro es
      gratis de activar**, pero **solo para pospago** y **se activa presencial** en un CAV, con
      cédula y el celular. Pospago desde **$42.900/mes** (60 GB). **Tigo** vende la eSIM **directo
      en la web**: prepago desde **$3.000** y pospago desde **$45.900/mes** (60 GB) o $69.900
      (ilimitado). Un celular moderno admite varias eSIM a la vez: no hace falta un equipo por línea.
    - 🔴 **El prepago se RECICLA.** Un número prepago sin recargas devuelve su numeración al pool y
      se la reasignan. Si ese número ya estaba registrado en una WABA, **la cuenta queda apuntando
      a un número que ya no es tuyo**, y no se nota hasta que otro recibe tus mensajes. **Por eso
      pospago**: un plan pospago no se recicla porque la línea está activa.
    - ✅ **Con eSIM nueva + vía directa se CAEN cuatro cosas**: Coexistence, el BSP entero, los 7
      días de actividad y el keep-alive de 13 días. Queda solo verificación de negocio (documentos
      que las empresas ya tienen), registro del número por SMS, display name y plantillas.

    *Plantillas: dónde se redactan.* En el **WhatsApp Manager** de `business.facebook.com`, o por
    API. Cada una lleva nombre interno (que el trabajador nunca ve), **categoría** (Utilidad,
    Marketing o Autenticación), idioma `es-CO`, cuerpo con variables `{{1}}` y opcionalmente
    encabezado, pie y botones. Se envían a revisión desde ahí mismo, y la página muestra los
    errores de formato al instante. **El MCP de Meta sí sirve para redactar y editar plantillas:**
    eso es lo útil del MCP para el owner. La aprobación sigue siendo de Meta.
    🔴 **La trampa de la categoría:** si la plantilla dice Utilidad y el texto es promocional, **Meta
    la reclasifica a Marketing** y te cobra distinto. Un recordatorio de trámite de SG-SST es
    Utilidad porque continúa una gestión que el trabajador ya inició — pero eso lo define el asesor
    jurídico con el texto, no el owner solo.

    *🔴 El orden correcto, y por qué NO se compra la línea primero:*
    - **Paso 0, hoy y gratis:** crear el portafolio de negocio y una app en `developers.facebook.com`
      con el producto WhatsApp. **Meta crea automáticamente una WABA y un número de prueba**, y da un
      token temporal de 24 h.
    - **Paso 1, hoy y gratis:** mandar la plantilla `hello_world` ya aprobada al propio celular. Con
      los activos de prueba **no se paga nada**. Queda probado el token, la plantilla y la entrega.
      (El número de prueba solo deja escribir a **5 destinatarios verificados**: sirve para probar el
      flujo, no para un piloto real.)
    - **Paso 2, gratis:** redactar las plantillas reales y meterlas a revisión.
    - **Paso 3, recién acá:** comprar **una** eSIM, registrar el número real y cambiar el token
      temporal por el de System User.
    - **Por qué este orden:** **las plantillas son lo que puede fallar, y ninguna SIM lo arregla.**
      Así, cuando se llega a la tienda ya se sabe que el canal funciona, y el costo de aprender pasa
      de "una línea por mes mientras se descubre qué falla" a "cero".
    - 🔴 **Comprar 1 eSIM, probarla, y solo después la segunda.** El registro no cuesta nada; si el
      rango del operador no pasa, con una sola se pierde una y no cuatro. Con prepago, confirmar
      saldo para **recibir** SMS: sin saldo a veces se rechaza la verificación en silencio y Meta
      marca el número como no verificado.

    *Lo que falta, en orden — y el orden importa:*
    - 🔴 **Decidir el remitente** (pendiente 15). Es lo único que bloquea todo lo demás de WhatsApp,
      y es una decisión del owner, no de código.
    - 🔴 **Túnel HTTPS público para el webhook.** No depende de Meta: se puede montar ya.
    - 🔴 **El puente K+AIR → Hermes** (webhook firmado, mecánica determinista). **Tampoco depende de
      Meta, y es el trabajo de fondo real.** La razón de empezar por acá y no por el MCP: si se arma
      el puente contra el MCP y después Meta dice que producción va por la Cloud API —que es lo que
      va a pasar—, se tocó todo dos veces.
    - Alta de la WABA y del número **desde Claude Code con el MCP**, con **número de prueba**.
    - System User + token permanente, y el webhook de estados.
    - Plantillas: las redacta el asesor jurídico, las aprueba Meta.
    - 🔴 **Acceso al servidor desde el escritorio.** SSH da `Permission denied (publickey,password)`
      porque acá no hay clave privada, solo el rastro en `known_hosts`. Hay que generar un par de
      claves o pegar salidas a mano. **La contraseña no se pide ni se manda por chat**, nunca.

    *Lo que ya está resuelto del lado de K+AIR, para cuando llegue el momento:*
    - El submódulo de seguimiento es **`seguimiento-incapacidades`** (📦701): `main/seguimiento-incapacidad-bridge.js`
      (968 líneas) y las tablas `seguimiento_incapacidad_caso` y `seguimiento_incapacidad_registro`.
      El `_registro` ya es el histórico de seguimientos múltiples: es donde Hermes escribiría.
    - `utils/whatsappSender.js` **NO es la API de WhatsApp Business**: abre `web.whatsapp.com/send`
      con el mensaje copiado y el usuario tiene que hacer clic. Es el patrón "relay", no envío
      automático. Lo que se quiere (envío programático) es trabajo nuevo.
    - La app ya tiene el patrón app↔servidor por HTTP (`llm_server.py` en el 5555), pero **todo
      servicio local nace hijo de la app y `cleanupProcesses()` lo mata con `taskkill` al cerrar**.
      Hermes en el servidor **no debe seguir ese patrón**, y de hecho no lo sigue: al estar en otra
      máquina, no depende de que la app esté abierta.
    - Para avisar, se eligio **Telegram**; para hablar con Hermes, se eligió el **gateway de
      mensajería**, no la app.

14. **🔴 REVISIÓN PENDIENTE: 📦881 y 📦882 no se han visto en la app instalada. Es lo único
    que falta de esta tanda, y es trabajo de una persona, no de un test.**
    De 882 se revisó el artefacto `%TEMP%\preview-consent-882.html`, que reproduce el gate, el
    scroll y el revelado de las casillas, y el owner lo aprobó. **Pero el artefacto lleva los
    documentos incrustados y no ejecuta el IPC real**: no prueba que `consent:documento` entregue
    los cuatro desde `legal/` en el build empaquetado, ni que el CSS llegue sin cache.

    - **Por qué el gate no aparece hoy en la app del owner:** ya existe una fila en
      `consent_acceptance` con `document_version` en `v1` y `app_version` igual a la actual, así
      que `consent:estado` devuelve `requiere: false`. Para verlo hay que **borrar esa fila** o
      subir `consentDocumentVersion` en `config.json`. **No se hizo ninguna de las dos**: tocar
      `consentDocumentVersion` tiene el efecto colateral de que el texto legal cambie de verdad,
      y eso es decisión del owner junto con el asesor.
    - **Lo que hay que mirar, en orden:** (1) que los cuatro documentos aparezcan completos y en
      ese orden; (2) que la barra llegue al final y las dos casillas aparezcan; (3) que *No
      acepto* siga disponible en todo momento; (4) que los links entre documentos salten dentro
      de la pantalla y que *Soporte* abra el navegador y no una ventana en blanco.
    - **Ojo con el redimensionado:** el revelado depende de medir `scrollHeight` después de
      inyectar, y se hace con doble `requestAnimationFrame`. En una pantalla muy alta el
      contenido puede caber entero, y en ese caso las casillas deben aparecer **de una**, sin
      scroll. Es la rama que el código toma (`recorrido <= 4`), pero conviene confirmarla con la
      ventana maximizada.
    - **Y sigue en pie lo de 881:** el texto exacto que el consentimiento muestra en pantalla, el
      rol de responsable y encargado, y los dos documentos nuevos de `sitio/`. Que estén bien
      escritos en el repo no significa que se vean bien en pantalla.

15. **🟡 DECISIÓN DEL OWNER EN PAUSA (2026-10-13): "lo dejamos para otro momento, ahora estoy
    investigando y procesando la información". No hay nada que ejecutar hasta que la retome.**
    Lo de abajo quedó investigado y documentado para no volver a tropezar con ello. Lo que sigue
    NO es una tarea: es el estado del asunto.

    *Lo que se sabe hoy, en corto:*
    - El owner administra **4 empresas**, hoy hace los seguimientos **a mano desde su cuenta
      personal**, **2 empresas ya tienen número** y **los números están en WhatsApp Business**.
    - **Un número no puede estar en dos empresas** (una sola WABA por teléfono). En cambio **un
      número sí puede mandar a trabajadores de varias empresas**, porque la plataforma no valida el
      destinatario, solo que haya opt-in.
    - 🔴 **La contradicción que hay que resolver cuando se retome:** si el número queda bajo
      **JRFSoluciones**, las plantillas quedan a nombre de Javier y **JRFSoluciones trata esos datos
      por cuenta propia**. Eso es **justo lo contrario de lo que firmaste en 📦881**, donde el Anexo
      de Encargo dice que **la empresa cliente es responsable** y JRFSoluciones es encargado. Un
      mensaje a un trabajador de la empresa B desde una cuenta de JRFSoluciones es a Javier tratando
      datos de un tercero por su cuenta.
    - **Y JRFSoluciones además no puede verificar su negocio ante Meta**, porque `privacidad.html:56`
      sigue diciendo que la razón social, el NIT y el domicilio están **pendientes de legalizar**.

    *Las dos salidas, que son excluyentes:*
    1. **Legalizar JRFSoluciones** y quedarse con el rol de responsable del canal. Si el número es
       suyo y las plantillas suyas, **los documentos legales de 📦881 hay que rehacerlos**, porque
       hoy dicen lo contrario. Es trabajo del asesor, no de código.
    2. **Cada empresa con su propio número** en su propio portafolio. Cada una responsable de lo
       suyo, **los Anexos de Encargo de 📦881 se sostienen sin cambios**, y el mensaje sale "de la
       empresa". Cuesta un trámite y una línea por empresa — y el owner ya tiene 2 de las 4.

    *Lo que sobrevivió de la discusión anterior y sigue valiendo:*
    - **Coexistence = un BSP de por medio**, porque la vía directa de Meta no lo permite. Con eSIM
      nueva y vía directa **se cae el BSP entero** y con él los 7 días de actividad y el keep-alive.
    - **Un solo número concentra el riesgo**: si Meta degrada la calidad del número porque alguien
      bloquea un mensaje, caen los cuatro canales de golpe. Con números separados, el daño queda en
      una empresa.
    - **El display name es uno solo**: no podés poner "Empresa A" en un mensaje y "Empresa B" en
      otro. Se resuelve escribiendo la empresa en el texto de la plantilla, que es el punto que ya
      estaba pendiente desde 📦881 y que le toca al asesor jurídico.
    - **Lo que sí sobrevivió de la idea de "usar mi número personal":** es legítimo y es como
      trabaja mucha consultoría SG-SST, pero es un **producto distinto**, con su propia figura legal,
      y no encaja con los Anexos de Encargo firmados. No es descartado: vive en otro carril.

    **Lo que NO está en discusión y no se vuelve a preguntar:** los números de las 2 empresas con
    línea propia se registran después, uno por uno, cada empresa verificando su negocio. No es un
    trámite único de K+AIR: es un trámite por empresa, porque el responsable es cada una.

16. **🔴 PENDIENTE 16 (2026-10-14): validar 📦883 en la app, y el barrido del mismo bug en el resto
    del repo.**
    - **Qué falta:** entrar a Configuración y confirmar que la barrita del extremo derecho de las
      tabs ya no está. El fix está razonado sobre la especificación de CSS y cubierto por un test,
      **pero un test puede comprobar la regla y no comprobar la pantalla.** Es exactamente lo que
      le pasó a 📦880: el `box-sizing` estaba bien en el código y la pastilla se seguía viendo mal.
    - 🟡 **Barrido preventivo, todavía NO hecho.** Al buscar la causa apareció que el patrón
      `overflow-x: auto` sin declarar `overflow-y` está en **más de 100 reglas del repo**. Casi
      ninguna muestra barra porque no desbordan, pero **cuatro son barras de tabs**, con el mismo
      riesgo de que aparezca en cuanto la ventana se ponga angosta:
      - `modules/verificacion/definicion-indicadores/definicion-indicadores.css:839` — `.kair-ind-tabs`
      - `modules/recursos/roles-responsabilidades/roles-responsabilidades-view.css:142` — `.kair-rr-tabs`
      - `modules/recursos/inducciones/inducciones-view.css:360` — `.kair-tabs`
      - `modules/gestion-salud/medicina-preventiva/sve/sve.css:705` — `.sve-tabs`
      No se tocaron porque el owner pidió solo el de Configuración. **Cada una necesita `overflow-y:
      hidden`, no basta con una regla global**, porque las cuatro tienen su propio contexto.
17. **✅ RESUELTO (2026-10-14): el Panel de Control ya sigue el tema elegido** (📦885).
    - **Causa:** `shared/kair-premium.css` no tenía ni una regla de tema. Arreglado con un bloque
      `[data-theme^="dark"]` aditivo al final del archivo.
    - **Lo que queda:** **validarlo en la app instalada.** El owner aprobó el artefacto, que usa el CSS
      real leído del disco, pero no corre el `renderer.js`. Entrá al Panel de Control en Sistema y en
      Oscuro y confirmá que las tarjetas quedan oscuras.
    - **Nota para el futuro:** `.kair-premium` como clase wrapper solo la usa `renderer.js:4766`. Si
      algún día otro módulo la necesita, el bloque oscuro le sirve sin tocar nada.


### ▶️ Retomar desde acá — siguiente paso concreto

0. **✅ TERMINADO: plan de 5 fases para que "Mapeando Estructura de Documentos" termine**
   (760+ s por corrida y fallaba siempre: el SHA-256 sobre 1,73 GB era ≈99,6 % del tiempo, y el
   JSON de ~2,98 MB se pasaba del tope de 1 MiB del `stdout` de `execFile`, así que `JSON.parse`
   reventaba al final). **Commiteado en `33d40d90` y pusheado.** Detalle completo en `AGENTS.md`,
   sección "Mapeando Estructura de Documentos".
   - ✅ **Fase 0 (📦863) HECHA**: `main/test-mapeo-estructura-863.js`
     (36/36, corrida real de Python + fallback), docs §5.8 actualizados, versión 0.1.242,
     `renderer.js?v=20261006-mapeo-fase0`.
   - ✅ **Fase 1 (📦864) HECHA**: `main.js:4311` con
     `maxBuffer: 64 MB` + `timeout: 30 min` en `execFilePromise`; `node --check` OK,
     test de Fase 0 **36/36**, suite **121 · 103 verdes · 18 preexistentes (0 regresiones)**,
     docs §5.8 actualizados, versión 0.1.243, `renderer.js?v=20261006-mapeo-fase1`.
   - ✅ **Fase 2 (📦865) HECHA**: `Portear/src/map_directory.py`
     sin `hashlib`/`_calculate_checksum`/`checksum`, recorrido con `os.scandir` en un solo pase,
     `scan_date` real, errores reportados, semántica de symlink conservada; `py_compile` OK,
     test de Fase 0 **36/36**, test nuevo `main/test-mapeo-estructura-865.js` **15/15** con
     prueba de mordida (los 6 checks de cambio fallan contra el código viejo), suite
     **122 · 104 verdes · 18 preexistentes (0 regresiones)**, docs §5.8 actualizados,
     versión 0.1.244, `renderer.js?v=20261006-mapeo-fase2`.
   - ✅ **Fase 3 (📦866) HECHA**: `Portear/src/map_directory.py`
     sin `files[]`, sin `file_count`/`dir_count`, sin `indent=2` y con los errores de lectura
     saliendo por `file=sys.stderr` (el stdout queda **solo** JSON); los totales `total_files`/
     `total_folders` **se conservan** porque los consumen `renderer.js:7158/7160` y
     `main.js:4337/4338` (ahora se llenan con el contador global `_contador`); `py_compile` OK,
     tests **863 36/36 + 865 15/15 + 866 20/20**; medición con fixture de 2000 archivos:
     **934.437 bytes / 19.219 líneas / 2.941 ms → 20.877 bytes / 1 línea / 162 ms (−97,8 %)**;
     suite **123 · 105 verdes · 18 preexistentes (0 regresiones)**, docs §5.8 actualizados,
     versión 0.1.245, `renderer.js?v=20261006-mapeo-fase3`.
    - ✅ **Fase 4 (📦867) HECHA**: progreso real de punta a punta.
      `Portear/src/map_directory.py` suma `_avisar_progreso()` (stderr, amortiguado a 250 ms con
      `time.monotonic()`, forzado al arrancar y al cerrar); `main.js` envuelve `execFilePromise`
      para que cuelgue `.child` (la de `promisify` no expone el proceso), engancha `child.stderr`
      y reenvía `mapeo-progreso` con guard de `isDestroyed()`; `preload.js` expone
      `onMapDirectoryProgress(cb)` con su baja; `config-viewer.html` pinta el contador real,
      suelta el listener en los **tres** caminos de salida y desaparece el "10-60 segundos"
      (`:3128`). `py_compile` + `node --check` OK, test nuevo
      `main/test-mapeo-estructura-867.js` **44/44** con **11 mutaciones que muerden**, tests
      **863 36/36 + 865 15/15 + 866 20/20**, suite **124 · 106 verdes · 18 preexistentes
      (0 regresiones)**, docs §5.8 actualizados, versión 0.1.246,
      `renderer.js?v=20261006-mapeo-fase4`.
      Además, una **prueba de integración fuera del repo** ejecutó el wrapper y la regex reales
      de `main.js` contra un fixture de 2.500 archivos (15/15): el progreso llegó a los 81 ms y
      114 ms, antes de que el proceso terminara (125 ms), o sea en vivo y no bufferizado.
      **Queda consultado al owner:** ¿esa prueba entra al repo como test?
    - ✅ **El plan de 5 fases está completo.**
    - 🔴 **📦868 — Conectar Gmail: ARREGLADO DE FONDO. Las credenciales son de la APP, no
      del usuario.**
      **El bug real:** las credenciales vivían solo en un `.env`, que **no viaja con el
      instalador**. Por eso el portátil del owner funcionaba y cualquier otra máquina no —
      la app no tenía correo para sus clientes, y el único síntoma era un error de Google
      ("Missing required parameter: client_id") que no menciona K+AIR, más un flow de
      autorización que quedaba colgado.
      **El arreglo:** que la app traiga las credenciales encima. El `client_id` de una app
      instalada es un identificador público. El `client_secret` también viaja embebido,
      pero no porque sea secreto: K+AIR es un binario que cualquiera puede abrir y el mismo
      Google lo entrega aparte en su `client_secret_*.json` de escritorio. Ahora viven en
      `shared/google-oauth-config.js`, que se versiona; el `.env` quedó como override de
      desarrollo. **El usuario final no tiene que hacer nada:** cada persona y cada cliente
      autoriza su PROPIA cuenta con el mismo `client_id`, como cualquier botón "iniciar
      sesión con Google".
      **El `client_id` y el `client_secret` ya están cargados y la conexión funciona**
      (proyecto "KAIR Calendar Sync", credencial de escritorio). **Probado de punta a punta
      contra Google:** el owner autorizó con su cuenta real y la bandeja conectó.
      🚨 **La creencia que casi pierde el paquete: "el `client_secret` es opcional".**
      Se concluyó leyendo `google-auth-library`: tiene `ClientAuthentication.None`, que hace
      que la librería NO mande el secreto. Todo cuadraba en el código — **pero leer la
      librería no es verificar el servicio.** Al probarlo de verdad, Google aceptó los 5
      permisos y el canje devolvió `client_secret is missing`. El síntoma era el peor: el
      navegador decía "Autorización exitosa" y la conexión se perdía igual. Media
      conexión. Un enum que existe en el código no significa que el endpoint lo acepte.
      🚨 **Y lo que lo dejó invisible:** los handlers de OAuth usaban `console.error`,
      que no escribe en `main.log`, así que el fallo no dejaba rastro en ningún lado —
      hubo que reproducir la petición a mano con un código falso para verlo. Ahora los tres
      escriben en `sendLog` y hay un check que lo vigila.
      🚨 **Y el repo es PÚBLICO, así que el secret tampoco puede ir en el config
      versionado.** Al commitear, GitHub rechazó el push: `GH013 — Push cannot contain
      secrets`. Hacerlo privado NO era la salida: `package.json` declara
      `publish: {provider: "github"}` y electron-updater pega a la API de releases de GitHub
      **sin token**, así que en un repo privado esa API devuelve 404 y **todos los clientes
      dejarían de recibir actualizaciones**. Repo público ⇒ el secret no puede estar en el
      historial. Solución: `shared/google-oauth-config.js` se versiona **vacío** y las
      credenciales viven en `sgsst-electron-app/.env` (en `.gitignore`). Verificado que
      electron-builder **no excluye `.env`** de los archivos del app: un `.env` en la máquina
      que compila **viaja dentro del instalador** y le llega al cliente sin que configure nada.
      **NUEVO** `main/_verificar-credenciales-build.js` como hook `prebuild`/`prebuild:win`/
      `prebuild:mac`/`prebuild:linux`: si faltan las dos credenciales **corta el build con
      exit 1**. Mejor que el build falle ahí a que salga un instalador donde el correo no
      conecta — que es exactamente el bug que costó la jornada.
      **Trampa del día:** el owner pegó el `client_id` **sin** el sufijo
      `.apps.googleusercontent.com` (creyó que era decorativo). Google devuelve 400 igual,
      así que el síntoma se habría repetido en la app. Al pegar una credencial hay que
      validar el **formato entero**, no que no esté vacía.
      **Pendiente:** el proyecto sigue en modo "Testing", así que la autorización vence a
      los 7 días y el cliente reconecta cada semana. Pasarlo a "Production" exige una **URL
      de política de privacidad pública**, que todavía no existe. Los 5 scopes ya están
      declarados en Google y coinciden con los que pide el código.

1. **Owner tiene que validar visualmente 📦858**: en la pestaña Correo, el mini debe dejar ir a
   septiembre con las flechas, y al elegir el **14 de septiembre tiene que mostrar los 12 correos**
   (no "sin correos ese día": de los 131 de la carpeta, solo 25 están en memoria, y ese día no está
   cargado). También: que funcione con Enviados y con No leídos, que al pasar a Agenda se limpie el
   filtro, y que la fila con la X se vea bien con el sidebar plegado. **Es la validación más
   valiosa que queda abierta**, porque 📦858 nunca se ha mirado en la app.
2. **Owner tiene que confirmar 📦861 en pantalla**: en el 1.1.1, que el botón **Subir** ya
   sale azul como la barra superior, que el **PDF** se abre con el visor de K+AIR (barra
   clara, no la oscura del navegador) y que **"Ver completo"** aparece en el PDF. Y que
   arrastrar un archivo al **centro** de la pantalla lo suba a la carpeta que está viendo.
   Ojo: estos módulos **no llevan token de caché**, así que si no cambia hay que cerrar y
   abrir la app.
3. **Owner tiene que validar el estado de error de 📦861**: borrar o renombrar la carpeta
   base desde el Explorador de Windows con la app abierta y hacer clic en otra carpeta.
   Antes quedaban bloques grises para siempre; ahora debe salir "No se pudo leer esta
   carpeta" con botón **Reintentar**, y "Carpeta vacía" solo cuando la carpeta está
   realmente vacía.
> ~~**Decisión pendiente del owner**: el mini congelado en el mes real~~ — **CERRADO 2026-10-04
> por 📦858**. En Agenda sigue congelado (📦844 intacto); en Correo navegó con estado propio, y al
> cambiar de pestaña vuelve al mes presente. Las dos behaviors quedan aisladas, que es lo que se
> pidió. (Va sin número a propósito: estaba como "3." duplicado y partía la serie.)
4. **Owner tiene que validar visualmente 📦856/857**: en vista Mes, "Tipos de evento" debe contar
   **octubre** (no el año) y **sin las seis filas en 0**. Al hacer clic en un día del mini, la
   sección debe pasar a ese día y salir el botón "Ver el mes completo". Y **"Tu día" debe seguir
   visible** abajo con la lista larga. Todo probado con tests, **nunca mirado en la app**.
7. **Owner tiene que validar visualmente 📦855**: que la bandeja abra **en blanco** (sin correo
   abierto), que al hacer clic abra y marque leído, y que al cambiar de filtro con un correo
   abierto que no está en la lista nueva, el panel se limpie.
8. **Owner tiene que validar visualmente 📦853/854**: el pillón rojo de novedad en la esquina de la
   fila "Correos no leídos", el tinte rojo de la fila, el filtro "No leídos" en la barra y el clic
   que baja el 99+. Ojo: hay que **cerrar y reabrir** la app primero, para que se siembre la línea
   base con el estado actual. En la captura de 📦855 el aviso rojo **no aparecía**, y era lo
   correcto: la línea base se había sembrado con lo que ya había y no había llegado nada nuevo.
9. **Cerrar el bypass de `gh:update-personal`** (bloqueante #2). Es el único de severidad crítica
   que sigue abierto, y lleva desde v0.1.212.
10. **Decidir sobre los borrados que necesitan autorización**: los 4 `.bak-*` (bloqueante #5) y los
   12 JS huérfanos de la Bandeja (bloqueante #4). Editar código que no se carga es trabajo perdido.
11. **Arreglar los tokens faltantes de `styles.css`** (bloqueante #1), o decidir que el panel de
   pendientes se queda así y no se le toca.

### 🔴 Bloqueantes y deudas conocidas

| # | Qué | Dónde | Impacto |
|---|---|---|---|
| 1 | **`styles.css` usa 6 tokens premium que nadie define** en el shell; 4 sin respaldo quedan sin estilo | `styles.css:6159-6470` (`.kair-pendientes-popover*`) | El panel de pendientes del dashboard se ve con bordes y colores inválidos |
| 2 | **El bridge acepta campos que el módulo declara protegidos.** `PROTECTED_FIELDS` en el renderer marca `estado`, `fechaIngreso` y `fechaRetiro` como no editables, pero el `fieldMap` de `_handlerUpdatePersonal` **sí los acepta**. Llamar el handler con `{estado:"retirado"}` los escribe. | `main/gestion-humana-bridge.js` (`_handlerUpdatePersonal`) vs `modules/gestion-humana/base-personal/index.js` | La protección es solo de UI. Cualquiera que llegue al handler la salta. Marcado como pendiente desde v0.1.212 y sigue abierto |
| 3 | `no such column: actualizado_en` en el sync | `sync-serializer.js:138,302,391,734` | BDs instaladas **antes** de la migración no sincronizan esos dominios. El schema sí declara la columna: falta una migración, no es un typo |
| 4 | **12 archivos JS huérfanos** en la Bandeja | `renderer/bandeja-integrada/` | No se cargan. Editarlos es trabajo perdido. `compose-modal.js` además tiene lógica duplicada viva en `app.js` |
| 5 | 4 archivos `.bak-*` en la raíz del app | `main.js.bak-*`, `renderer.js.bak-*`, `preload.js.bak-*`, `index.html.bak-*` | Ruido. Candidatos a borrar, **pero no sin autorización** |
| 6 | 30 tests en `tests/` que el runner no ejecuta | `sgsst-electron-app/tests/` (en subdirectorios por módulo) | Cobertura que parece existir y no corre. El runner solo mira `main/` |
| 7 | `CHANGELOG.md` afirma 22/22 mutaciones en `test-swapview-841.js`, pero ese archivo no tiene array `MUT` | `CHANGELOG.md` | O el mutation se perdió en un refactor, o el CHANGELOG describe un estado intermedio |
| 8 | ~~2 validaciones visuales abiertas~~ — **CERRADO 2026-10-03** | `CONTEXT.md` v0.1.214 (confetti del splash) y v0.1.215 (home de Capacitaciones) | El owner las revisó en la app y no registró observaciones. Ya no bloquean. Las dos referencias en `CONTEXT.md` quedaron actualizadas |
| 9 | 📦850 y 📦851 implementados y probados, pero nunca vistos en la app — **CERRADO 2026-10-03** | Botón del borde y encabezado sin etiqueta de fecha | El owner los revisó |
| 10 | 🔴 **La bandeja solo tiene 25 correos en memoria de los 131 de INBOX** (`PAGE_SIZE = 25`), y se agrandan con scroll infinito. Cualquier filtro que mire `state.mails` da "vacío" en **25 días que sí tienen correo** (el 14 de septiembre tiene 12 y ninguno está cargado) | `app.js` `PAGE_SIZE`, `loadMailsFromCache` | 📦858 lo resolvió con un rango de fechas en la caché local. **El mismo riesgo queda para cualquier filtro nuevo que se escriba sin eso** |
| 11 | 🔴 **Ningún test del repo abre la base de datos.** 📦860 tenía 34 checks en verde y el feature podía no dibujar nada en pantalla, según qué tipo devolviera la BD para `last_message_date` | `main/test-*.js` | Verificado a mano contra la BD real (`Temp/verif-fecha-bd-860.js`: 150 filas, 0 sin fecha, `INTEGER` y llega como `number`). **La brecha sigue abierta**: todo feature de datos necesita ese paso a mano hasta que la suite tenga un juego de datos de prueba |
| 12 | 🔴 **Los 15 exploradores de archivos NO comparten la arquitectura del preview.** Hay **4 variantes** de `_loadPDF` y **3 formas** de enrutar el PDF en el archivo de conexión; 3 módulos no tienen archivo de conexión | `modules/**/*-viewer.js`, `*-logic.js` | 📦861 arregló el PDF **solo en el 1.1.1**. Replicar sin abrir la app sería cambiar 15 módulos a ciegas, y el PDF es lo que más se nota si se rompe. **Pendiente: Owner valida el 1.1.1 y se replican los otros 14** |
| 13 | 🔴 **Incidencia (3.3.5) y Prevalencia (3.3.4) no tienen de dónde leer datos.** Esperan un Excel `Indicadores*.xlsx` dentro de la carpeta del submódulo, y esa carpeta está **vacía (0 elementos)** en las 4 empresas de Drive. Sin archivo, el backend **no avisa**: devuelve `success:true` con 12 meses en cero y `meta:0`, así que la pantalla pinta una tabla inventada que parece real, y la edición manual revienta con "Ruta de INDICADORES no configurada" | `main/excel-bridge.js:191,226,890-906,981-985` | La sección no muestra datos reales **ni permite cargarlos**. El owner decidió dejarlo así: hay que **crear las tablas en SQLite** y conectarlas, como ya se hizo con Ausentismo en `main/medprev-sve-datos-bridge.js` |

### 📋 Cola de trabajo acordada

| Orden | Tema | Estado |
|---|---|---|
| 1 | 📦828 · Matriz de requisitos legales 2.7.1 | Pendiente |
| 2 | 📦841 fase 2 · Tabs del dashboard | Pendiente |
| 3 | 🔴 Cerrar el bypass de `gh:update-personal` (bloqueante #2) | Pendiente, abierto desde v0.1.212 |
| 4 | Arreglar los tokens faltantes de `styles.css` (bloqueante #1) | Pendiente, sin autorizar |
| 5 | Migración de `actualizado_en` para BDs previas (bloqueante #3) | Pendiente |
| 6 | Limpiar código muerto de la Bandeja (bloqueantes #4 y #5) | Pendiente, esperando autorización de borrado |
| 7 | 🔴 **Crear las tablas SQLite de Incidencia (3.3.5) y Prevalencia (3.3.4)** para que la sección consulte la BD y deje de depender del Excel (bloqueante #13) | Pendiente. **Decidido por el owner el 2026-10-16**: se deja así por ahora, se anota y se sigue |

### 🧠 Lo que la regla de cero presunciones evitó hoy

Se agregó al `PROMPT.md` (§5.9) después de encontrar **reglas "OBLIGATORIAS" que no existen**:

- `KairUI.esc()` y `KairHelpers.formatDate()` — **0 archivos** en todo el repo. Un modelo que las
  hubiera seguido habría escrito una llamada inexistente y la vista se habría caído.
- `kair-canonical.css` — referenciado en `AGENTS.md` como fuente de las clases BEM. **No existe.**
- "el último paquete es `📦579`" — van 850+.
- "`var`, no `let`/`const`" — `main.js` tiene 2 608 `const`.

Y la misma regla, aplicada al propio trabajo: al medir este documento, **2 de mis propias cifras
en `PROMPT.md` estaban mal** (27 bridges en vez de 30, y un conteo de `tests/` mal hecho por no
bajar a los subdirectorios). Las dos quedaron corregidas con el número medido.

### 🧠 Reglas que se aprendieron en esta sesión

Se guardan como comentarios `📦n` en el código, como lecciones al final de `AGENTS.md`, y acá
solo va el resumen de las que **cambian cómo se trabaja mañana**:

- Un **check que matchea su propio comentario** no guarda nada. Leer solo código con `soloCodigo()`.
- Una **mutación que no cambia nada siempre "pasa"**. Normalizar a LF antes de mutar y contar los
  mutantes vacíos por separado, o se pierde la señal.
- Un **regex con rango fijo** (`{0,300}`) se rompe al agregar un comentario. Acotar a la misma llave.
- Un check de "este texto tiene que estar" **solo vale si además dice dónde**.
- Cuando se borra algo, **invertir los checks que lo afirman**, y si son varios, todos.
- Un botón que **pliega la columna que lo contiene** no puede vivir dentro de ella.
- Un **ancla de reemplazo** tiene que llevar el contexto que la rodea, no solo la primera línea. Al
  insertar "antes de X", el texto nuevo debe **reponer X completo**. Si X es un encabezado de
  sección, perderlo no es perder una línea: deja huérfano todo lo que venía después.
- **"El script dijo OK" no es verificación.** Un script que hace `replace` y reporta éxito puede
  haber matcheado 0 veces y dejado el archivo intacto. El guard que salva es exigir exactamente
  1 coincidencia, y después comprobar por estructura dónde cayó cada cosa.
- Un script que **escribe archivo por archivo no es atómico**: si el CHANGELOG sale bien y el README
  falla, quedan estados mezclados. **Respaldar antes de correr.**
- Un verificador de "inglés colado" con listas largas produce falsos positivos tan molestos como los
  typos que busca. Listar solo lo que es **inequívocamente** error en ese documento.
- Los documentos nuevos viven en la **raíz del repo**, junto a `PRODUCT.md`; los de la app, en
  `sgsst-electron-app/`. Un script que los agrupe mal marca "FALTA" sobre archivos que sí existen.

---

### 2026-10-16 · 📦898 · El consentimiento no declaraba lo que la app sí hace

**El hallazgo.** El owner preguntó, antes de publicar los documentos legales, si
**todo lo que la app muestra o envía aparecía ya en las páginas**. La respuesta fue **no**, y
no por un detalle: **dos rutas de salida no estaban declaradas en ningún lado.**

| Ruta | Qué sale | Dónde vive el código | ¿Declarado antes? |
|---|---|---|---|
| **WhatsApp** | nombre, cédula, cargo, fecha de atención y **evaluación ocupacional** | `enviar-remision-v2.js:602` → `whatsappSender.js:41` → `web.whatsapp.com/send?phone=…&text=…` | **No, en ningún documento** |
| **Correo saliente** | destinatario, nombre, fecha y el **documento adjunto**, y sale **sin confirmación** | `main.js:21035` → `emailSender.js:178` (SMTP de Gmail con `user`/`password` guardados) | **A medias**: "Google" sí estaba, pero solo para *leer* el correo, no para *enviar* |

Y lo peor: el modal de consentimiento decía, textualmente, *"Transferencias: solo al conectar su
cuenta de Google o al usar firma electrónica"*. **Esa frase era falsa.**

**Lo que sí estaba bien, verificado (no asumido):** Google, el servidor de firma, GitHub y los CDN
coinciden con lo declarado. Las URLs `firma.kair.fyi` / `firma.k-air.com` que aparecen en el grep
están **solo en archivos de test**, no en código que se distribuye. Y `doc.file-viewer.app` es un
comentario de documentación, no una llamada de red.

**Qué se cambió:**

- `sitio/anexo-encargo.html` §5 — dos filas nuevas en la tabla de subencargos.
- `sitio/privacidad.html` §4 — dos filas nuevas en "Transferencias a terceros".
- `sitio/terminos.html` §7 — dos viñetas nuevas en "Servicios de terceros".
- `sgsst-electron-app/index.html` — corregida la viñeta falsa del modal.
- Fechas de versión de los tres documentos al **2026-10-16**, en las **tres** apariciones de cada
  uno (encabezado, pie y la referencia interna que dice cuál es la vigente).

**🔴 La incoherencia de fondo que destapó esto.** Corregir un texto legal no sirve si la app no
puede avisar que cambió. Y no podía: `consent:estado` comparaba contra
`cfg.consentDocumentVersion`, una clave de `config.json` **que nadie escribía** (siempre `'v1'`),
mientras `version_terminos`, `version_privacidad` y `texto_hash` **se guardaban y no los leía
nadie**. El renderer ya enviaba la versión del documento y un SHA-256 real del texto leído
(`renderer.js:4046-4048`): **la máquina estaba construida y le faltaba un cable.**

El defecto era doble y en direcciones opuestas: editar el texto legal **no** re-preguntaba, y cada
bump de versión de la app **sí** re-preguntaba a todo el mundo. Como el bump solo pasa cuando el
owner lo dice, publicar el texto nuevo no habría llegado a nadie.

**Decisión de diseño: una sola fuente de verdad, no dos.** Se evaluaron dos caminos —
(a) subir un número a mano y (b) comparar el `texto_hash` — y **hacer los dos se pisan**: dos
mecanismos decidiendo lo mismo divergen solos. Se hizo (a) bien, con una constante en `main.js` en
lugar de una clave de config que se puede perder, y (b) quedó aplazado: solo compra detectar
ediciones que no bumpeen la versión, y el test de este commit ya cubre eso con un test rojo en vez
de un reclamo de un cliente.

**Tests** — `main/test-consent-version-898.js`, **22 checks**, con 5 mutaciones internas y
**2 mutaciones reales verificadas**:

| Mutación aplicada | Resultado |
|---|---|
| Renderer desincronizado a `2026-10-17` | 21/22, sale con código 1 |
| Reintroducido `aceptado.app_version !== appV` en `requiere` | 20/22, 2 checks rojos |

`test-consent-gate.js` (existente) queda **48/48**. `node --check` limpio en `main.js` y
`renderer.js`. La suite completa **no se remedió**.

**Lo que NO se arregló, y sigue pendiente:** el gate es **por equipo, no por persona**
(`SELECT … LIMIT 1` sin `WHERE email = ?`): en un equipo compartido el primero que acepta silencia
el gate para todos. Eso **necesita asesoría jurídica**, no un parche de código.

**Decisiones del owner** — "procede" en dos momentos: el primero autorizó **editar, no commitear**;
este autorizó **documentación, commit y push**. La versión **no se bumpea** (sigue `0.1.251`, por
la regla del owner). El CHANGELOG no se toca: registra versiones publicadas y esto no lo está.

**Commits** — uno solo, `898`, desde `Dev-Pc`.

### 2026-10-16 · Publicación de `sitio/` en `gh-pages` (cerrando los 404)

`anexo-encargo.html` y `autorizacion-trabajadores.html` estaban en el repo desde el 9 de octubre y
**nunca se publicaron**. Como `privacidad.html` y `terminos.html` sí estaban publicadas y los
enlazaban, el sitio legal llevaba **8 días** con dos enlaces rotos en producción, y desde hoy
decía además que su versión vigente era la del 16 de octubre. Publicado en `8fe93985`.

**Cómo se hizo, y por qué así:**

- Se usó un **`git worktree` aparte** (`%TEMP%\kair-ghpages`) en vez de cambiar de rama en la
  carpeta de trabajo. Motivo: al hacer `git checkout gh-pages` sobre el árbol real, los 45 743
  archivos sin rastrear (`node_modules`, `Temp/`, `backups/` y **un `.env`**) siguen ahí y un
  `git add -A` los publicaría. El worktree hace que ese error sea **estructuralmente imposible**,
  no solo una regla que hay que recordar.
- Se copiaron los **8 archivos del sitio** y se stagearon **4**, uno por uno. De los 8, solo 4
  cambiaron de verdad: `.nojekyll`, `index.html`, `soporte.html` y `assets/estilo.css` no habían
  derivado desde el 7 de octubre. El diff de los 2 modificados trae **las dos fechas**: el rewrite
  de `881` y las adiciones de hoy.
- **Escaneo de secretos sobre lo publicado**, con 8 patrones (API key de Google, token OAuth,
  refresh token, llave privada, `client_secret`, password con valor, `INTERNAL_API_KEY`, y si
  existía un `.env`): **limpio** en los 8 archivos. Sin BOM, finales de línea LF.

**El detalle que casi se reporta como fallo:** el primer `HEAD` a `anexo-encargo.html` **siguió
dando 404** con el push recién hecho. El commit estaba en `origin/gh-pages` (verificado con
`git ls-tree`), así que era **propagación de la CDN de GitHub Pages**: a los ~2 minutos devolvió
200 y el documento se sirvió **completo y con las filas nuevas**. Se verifica contra producción,
no contra el repositorio.

**Commits** — `8fe93985` en `gh-pages`. No lleva número de 📦: es una rama de despliegue, no un
paquete de producto.

### 2026-10-16 · 📦899 · Asesoría legal de K+AIR como skill portable y agente de OpenCode

**Qué se hizo** — por pedido del owner, tooling para consultar normativa sin salir del entorno de
desarrollo:

- `.opencode/skills/asesoria-legal-sg-sst/SKILL.md` — **fuente única de verdad** del asesor legal:
  alcance (SG-SST Colombia + normativa de software), jerarquía de fuentes, método obligatorio
  (verificar en fuente oficial antes de afirmar; `⚠️ No verificado` antes que inventar), formato de
  respuesta y descargo.
- `.opencode/agents/legal-sg-sst.md` — agente modo `all` que **carga el skill**; sin `edit` ni `shell`
  (`deny`), para que solo asesore.

**Por qué skill y no solo agente.** El formato `SKILL.md` es portable: OpenCode lo descubre en
`.opencode/skills/` y además lee `.claude/skills/` y `.agents/skills/` por compatibilidad; **MiniMax usa
el mismo formato** (`name` debe coincidir con la carpeta, más `description`/`license`/`metadata`). El
agente quedó como envoltorio para no tener dos copias del contenido que se desincronicen.

**Alcance normativo:** Resolución 0312 de 2019 y Decreto 1072 de 2015 (SG-SST); Ley 1581 de 2012 y
Decreto 1377 de 2013 (datos personales); Ley 527 de 1999 (comercio electrónico y firma digital);
Ley 23 de 1982 y Ley 44 de 1993 (derechos de autor de software); Ley 1273 de 2009. Fuentes oficiales:
Gestor Normativo, SUIN-Juriscol, MinTrabajo, MinSalud y SIC.

**Regla dura:** no sustituye asesoría jurídica profesional.

**Documentación:** la skill y el agente se registraron en `sgsst-electron-app/AGENTS.md` (sección
"Skill del proyecto — Asesoría legal SG-SST"). **La versión no se bumpea** (sigue `0.1.251`): es tooling
de desarrollo, no código de producto, así que el CHANGELOG no se toca.

**Commits** — uno solo, `899`, desde `Dev-Pc`.

---

## 📅 Bitácora por jornada

### 2026-10-15 (noche) · El servicio de firmas se mudó del portátil al servidor (📦901)

**Objetivo de la sesión:** que `firma-service` funcione 24/7 sin depender del portátil de trabajo.

**Lo que quedó:** `https://firma.kair.fyi` responde desde `kair-server` (Ubuntu Server 24.04.5, detrás
de NAT, túnel nombrado de Cloudflare). Los dos servicios arrancan solos tras un reinicio de kernel.
El correo sale con `messageId` de Gmail. **La migración está completa.**

#### El commit 📦901

`firma-service` escuchaba en todas las interfaces: `config.js` no leía variable de host y `server.js`
hacía `app.listen(port)` a secas. Con el servidor detrás de NAT no era explotable de inmediato, pero
en cuanto el túnel expusiera el puerto el servicio quedaba alcanzable desde la red local. El arreglo
 mete `HOST=127.0.0.1` con default en `config.js`, lo pasa a `app.listen`, lo imprime en el log de
arranque y lo documenta en `deploy/.env.production.example`. Verificado con
`ss -tulpn | grep 3001`: devuelve `127.0.0.1:3001`, no `*:3001`.

#### Los cinco hallazgos que costaron la tarde

1. **Falta `/etc/cloudflared/config.yml` y el sintoma miente.** El túnel `kair-firma` es
   *locally-managed*: sus rutas viven en el archivo local del servidor, no en Cloudflare. Sin ese
   archivo el túnel conecta, el panel dice "Buen estado" con una réplica activa, `systemctl` dice
   `active`, y `curl` a la URL pública devuelve cuerpo **vacío**. El log lo avisaba desde el primer
   intento (`No ingress rules were defined... will return 503`), y pasó inadvertido. El archivo debe
   terminar en `service: http_status:404`: cloudflared exige un catch-all.
2. **Un token truncado se disfraza de problema de credenciales.** El token es base64, así que **su
   largo siempre es múltiplo de 4**. Una copia a medias daba 180 bytes, que no es múltiplo de 4, y
   el error era `Invalid tunnel secret` — que parece un secret roto en Cloudflare y en realidad era
   transporte. El bueno mide 248 + salto de línea = 249.
3. **`Type=notify` convierte un token invalido en un "timeout".** Con `TimeoutStartSec=15`, un proceso
   que nunca manda `READY=1` produce `Job ... failed because a timeout was exceeded`, que esconde el
   error real. Lo que sirvio fue correr `cloudflared tunnel run --token-file ...` en primer plano: ahi
   si se vio `Unauthorized: Invalid tunnel secret`.
4. **El botón "Rotar token" sí funciona, pero la UI cachea el comando.** El owner lo presionó varias
   veces y el texto no cambiaba, lo que llevó a pensar que la rotación estaba rota. No lo estaba: el
   comando queda cacheado en el DOM de la página. Con `Ctrl+Shift+R` (o saliendo y volviendo a entrar)
   aparece el nuevo. Se rotó al final y el token expuesto quedó invalidado.
5. **`GET /health` no prueba el correo.** En `src/routes/health.js` el check marca `ok` si `SMTP_PASS`
   existe; no abre conexion ni autentica. Por eso `smtp: "configured"` aparecio en verde mientras el
   `.env` todavia tenia el placeholder del ejemplo y `SMTP_HOST=localhost`. La prueba real es un
   `verify()` de nodemailer, y la prueba de fuego un `sendMail()` con `messageId`.

**Dos trampas de shell que tambien costaron tiempo:** `read -rs` en un bloque pegado de varias lineas
se come la linea siguiente como entrada, asi que el archivo terminaba conteniendo un comando de bash
en vez del token; y un `!` en el `node -e` dispara *history expansion* de bash (`!l.trim: event not
found`), que se evita con `set +H`.

**Verificacion de la suite en el servidor:** `npm test` → `tests 973 | pass 969 | fail 2 | skipped 2`.
Para correrla hacen falta dos cosas que no viajan en el despliegue: copiar `tests/` al servidor, y
`npm install --include=dev` porque `supertest` es devDependency. Sin eso fallan ~60 archivos con
`Cannot find module 'supertest'`. Los dos que fallan **no son bugs**: uno es el helper del test que
genera un PDF distinto por llamada (pdf-lib escribe `CreationDate`, y el fingerprint de idempotencia
incluye el SHA-256 del PDF — el `409` del servidor es correcto); el otro mide un timeout de 200 ms
contra 326 ms reales con la CPU saturada, y el objetivo del test es detectar un hang de mas de 5 s.

**Por que los tests corren en el servidor y no en el portatil:** el `better-sqlite3` de alla esta
compilado para Electron 37 (`NODE_MODULE_VERSION 136`) y el Node local es v26 (`147`), asi que no
carga. En el servidor hay Node 20 limpio.

**Documentacion actualizada:** `docs/MIGRACION-SERVIDOR-FIRMA.md` se reescribio completa con la
arquitectura real (la anterior describia una VM de Oracle con Caddy y `sslip.io`, que no se uso).
`CHANGELOG.md` tiene la entrada de 📦901 con los cinco hallazgos. `README-DESPLIEGUE.md` queda
como guia historica y apunta al documento vigente.

### 2026-10-15 (tarde 5) · La barra del scroll arrancaba en el borde superior de la ventana (📦898)

**Qué se hizo** — por pedido del owner: que la barra vertical del costado derecho de la ventana empiece
al mismo alto que la tarjeta "Actividad ID", que está a la derecha. Ese scroll lo llevaba **el
documento entero**, que no tenía `overflow` declarado, así que su barra arrancaba en el borde superior
del visor, muy por encima del contenido.

**El arreglo** es el patrón de app shell: `html` y `body` con `height:100%`, `body` con
`overflow:hidden`, `.kair-page` como columna flex de altura completa con `min-height:0`, cabecera y
pestañas con `flex:0 0 auto`, y un contenedor nuevo `#plan-scroll` con `flex:1 1 auto` y `overflow:auto`.
Las dos vistas quedaron dentro; los modales, que ya estaban fuera, no se movieron.

**ME EQUIVOCÉ DOS VECES ANTES DE ACERTAR, Y LAS DOS IMPORTAN.**

La primera, de código: puse `height:100%` en `html` y **no en `body`**. Sin base definitiva en el padre
directo, el `height:100%` de `.kair-page` cae a `auto`, la columna flex no se acota, el contenedor
crece a la altura del contenido y **nunca scrollea**, mientras `overflow:hidden` recorta. La barra
desapareció. El owner lo reportó como *"quitaste por completo el auto scroll"* — y el auto-scroll
estaba intacto todo el tiempo. **La regla: una cadena de alturas porcentuales no acota nada si le falta
un eslabón.** Y el síntoma que lo delata: un contenedor con `overflow:auto` que no muestra barra no
está roto, no tiene nada que scrollear.

La segunda, de comunicación: "la barra del autoscroll" era ambiguo. Hay **tres** barras scrolleables en
esa pantalla —la del Gantt, la horizontal al pie de la tabla y la del borde de la ventana— y se trabajó
sobre la equivocada dos veces. Cuando se preguntó nombrándolas por posición, la respuesta fue la que
menos se sospechaba. **"La barra de scroll" no identifica una barra cuando hay más de un contenedor
scrolleable en pantalla.**

**Lo que sí quedó verificado**, en navegador real: la barra aparece en el borde derecho con la punta
superior justo debajo de las pestañas, y el pulgar ocupa menos de la mitad del carril, así que hay
contenido real para scrollear. Estructuralmente: 92 pares de `div` balanceados, llaves de CSS en cero,
modales fuera del contenedor y en `position:fixed`. Y el auto-scroll del 895 intacto:
`scrollActIntoView()`, `SCROLL_MARGIN = 24` y `.kair-gantt__scroll{max-height:560px}` sin tocar.

**Lo que no se pudo verificar.** La pestaña Cronograma dentro del contenedor nuevo: el navegador
embebido se colgó dos veces con timeout de 275 s, el mismo síntoma del 891 y del 895. Queda pendiente
que el owner lo confirme en la app instalada.

**Pendiente de decisión.** Quedan ~20 px entre el inicio de la barra y la tarjeta, por el
`margin-top:20px` que ya traían los bloques de contenido. Quitarlo alinea exacto, pero cierra el aire
entre las pestañas y las tarjetas.

**Lección para el repo.** El detalle completo está en `BITACORA.md` § 📦898, y la trampa como fila 36
de la tabla de `PROMPT.md` § 9.

### 2026-10-15 (tarde 4) · AGENTS.md dejó de ser un archivo de 11.000 líneas (📦896, 897)

**Qué se hizo** — por pedido del owner: el archivo que se carga al arrancar cada sesión tenía 10.993
líneas y su propio encabezado avisaba que era "89 % bitácora de bugs". Todo ese peso se pagaba antes de
empezar a trabajar. Se partió en dos **sin reescribir ni resumir**: copiar tal cual, solo mover de archivo.

**El corte** cae en 1125/1127, exactamente donde termina la última sección operativa (el protocolo de
autorización de commits) y arranca la primera entrada de bitácora (Menú nativo de Electron, 📦579).

- `AGENTS.md` → **1.099 líneas**: arranque, tabla de Skills con sus seis subsecciones, convención de
  commits, regla de comunicación y la arquitectura completa del proyecto.
- `BITACORA.md` → **4.797 líneas**: snapshots, playbooks, releases, trampas y las entradas 📦579 a 📦895.

Carga al arrancar: **−90 %** respecto al archivo original.

**El archivo tenía 4.200 líneas duplicadas byte a byte.** No era una impresión: en el mapa de
encabezados, las secciones 0-58 y 59-117 eran el mismo contenido repetido con offset constante de 5.335.
Cada copia se comprobó con SHA-1 antes de borrar nada.

**El duplicado estaba en dos capas, y la segunda se escapaba.** La primera (4.203 líneas) estaba entera
dentro de BITACORA.md y se quitó con un diff línea por línea. La segunda no: **cruza el corte**, así que
una copia quedó en AGENTS.md y la otra en BITACORA.md, donde ningún dedup por rango la ve. Era una segunda
copia completa de "Arquitectura del Proyecto" (909 líneas). Un dedup por rango no la encuentra; hay que
buscar el duplicado **por contenido**.

**Una línea casi se pierde, y la comprobación la salvó.** La fila de la tabla de `test-google-oauth-868.js`
existía en dos variantes. La de la copia duplicada era la versión **reducida**: a la que sobrevive le falta
la cláusula *"y no hay forma de diagnosticarlo"*. El script abortó dos veces antes de dejarme borrar,
y las dos veces tenía razón.

**Dos invariantes que costaron escribir, y las dos importan:**

- En un **dedup**, el conteo de cada línea tiene que BAJAR. La comprobación intuitiva ("nada desapareció")
  aborta siempre. La correcta es `final = original − borrado`.
- Una línea no es "contenido único" solo si no aparece como subcadena. Una versión **reducida** de otra es
  redundante, y la superconjunta que sobrevive la contiene. Sin esa prueba, el borrado se negaba solo.

**Lo que casi se va y no se va.** El arranque decía "no lo leas entero" para un archivo que ahora sí se
lee entero, y quedaban 61 líneas de relato dentro de `AGENTS.md`. De esas 61 se movieron las que
describen un bug con su resolución; **se quedó** la "Lección crítica: reescritura de archivos grandes con
scripts Python" porque es un procedimiento activo de 8 pasos, no un relato. Y al revés: los puntos 2 a 6
de los Gotchas CSS eran reglas generales escondidas en la bitácora, y el owner los promovió a sección
propia `### Reglas CSS generales` en `AGENTS.md`.

**Los 9 punteros.** `PROMPT.md`, `CLAUDE.md`, `PRODUCT.md` e `Historial.md` mandaban a buscar la bitácora
en `AGENTS.md`. Sin arreglarlos la división no servía: el agente iba al archivo reducido y no encontraba
lo que buscaba. Se cambiaron por `BITACORA.md` **sin números de línea escritos a mano** — esos conteos ya
se pudrieron tres veces (4.800 → 10.993 → 9.873 → 5.706) y un número a mano es una mentira que a veces
resulta cierta por accidente.

**Verificación.** Cada paso releyendo del disco, nunca confiado en la memoria del proceso.

| Comprobación | Resultado |
|---|---|
| Corte inicial: diferencia de multiconjuntos, línea por línea | 0 líneas perdidas |
| Dedup interno: SHA-1 de ambas copias antes de borrar | idénticas, 4.203 líneas |
| Dedup cruzado: cada renglón del bloque, normalizado | 0 renglones únicos |
| Invariante global sobre los 4.220 textos distintos del original | 0 desaparecidos |
| Los 18 renglones que no aparecen íntegros | 17 con otro nivel/numeración · 1 con versión mejor sobreviviendo |
| EOL y caracteres prohibidos en los 2 archivos | LF, 0 CR, 0 CJK/cirílico/hangul |

**Lo que sigue abierto.** El bloque de arranque y el `## Protocolo` de `AGENTS.md` no se tocaron más de lo
acordado. Sigue en pie la deuda vieja: el botón "Recursos" encendido en Configuración, y la decisión de
borrar o no `plan-viewer.js` (código muerto, 1.605 líneas).

### 2026-10-15 (tarde 2) · Capacitaciones aplicaba los temas a medias y el menú quedaba muerto (📦894)

**Qué se hizo** — por pedido del owner, que reportó en un mismo mensaje dos cosas: que el submódulo
1.2.1 Programa de Capacitación Anual no aplica bien los temas Sistema y Oscuro, y el `console.warn` de
"Cambio de módulo bloqueado". Su frase textual: *"realmente no se aue ecicion tomar no quiero dañar nada de lo que ya
funciona"*. Esa frase se tomó en serio: **no se tocó una línea** hasta terminar el diagnóstico y
presentarle las opciones con la evidencia medida.

**El diagnóstico** — el del tema resultó ser un solo defecto, no dos. El contenedor de capacitaciones
**nunca recibíA `data-theme`**: el shell lo escribe sobre `<html>` y sobre los iframes, y capacitaciones se monta
**en línea** con `fetch` + `innerHTML`, así que no hay `contentDocument` al que escribirle. En todo el
módulo: **0 `setAttribute`** y **1 `getAttribute`**. De ahí salían tres síntomas que parecían bugs
distintos — el fondo blanco, el texto gris y los gráficos con la paleta de tema claro — y que eran uno.

Lo que lo hacíA confuso es que **las tarjetas sí salíAN oscuras**, porque leen los tokens globales
`--kair-*` de `:root` y esos sí se actualizan. Solo se rompía lo que el módulo declara por su cuenta.
Y la prueba de que era código muerto y no código malo: las **47 reglas `[data-theme="dark"]`** que ya
estaban registradas como deuda. Estaban bien escritas. Nunca pudieron calzar.

**Medido sobre los colores reales de las capturas del owner:**

```
donut "19 actividades"  #14213d sobre #292929 (dark-legacy)   1.10:1   FALLA
donut "19 actividades"  #14213d sobre #384151 (dark)          1.55:1   FALLA
"En tu radar"           #6c757d sobre #384151                 2.19:1   FALLA
```

El **1.10:1** es el número gris lost del centro de la dona. Después del arreglo: **5.78:1** y **13.76:1**.

**El `console.warn`** resultó ser la punta de algo peor. `showSettingsPage()` monta su iframe sobre
`contentArea` y no registraba que habíA tomado el control de la vista, así que el estado seguíA diciendo
"Recursos / 1.2.1" mientras la pantalla ya era Configuración. El candado de `showModuleContent` veíA ese
`currentSubmodule` truthy y se descartaba. El aviso era cosmético: **el clic siguiente en "Recursos" no
hacíA nada**, en silencio. Bajar el `warn` a `info` lo dejaba igual de muerto.

**Lo que se cambió**

- `capacitaciones-view.css`: los 47 selectores a `[data-theme^="dark"]`. Cero literales exactos quedan.
- `capacitaciones-logic.js`: `_syncTheme()` y `_watchTheme()`, la llamada en `render()` y la desconexión en
  `destroy()`; `isDark` pasa a prefijo para reconocer `dark-legacy`.
- `renderer.js`: **dos líneas** en `showSettingsPage()`. No se tocó la lógica de navegación, y el candado
  de `showModuleContent` sigue en su sitio.

**Una tercera, y esta la mostró una imagen.** El prefijo `^="dark"` hace que las 47 reglas apliquen a los
dos temas oscuros, pero el bloque que las declara solo trae los **valores de `dark`**. El owner mandó una
captura del home de Recursos en `dark-legacy` y preguntó si tenía negros: tenía, es el gris neutro
`#121212` / `#292929`. Mi arreglo, sin esa segunda mitad, habríA dejado 1.2.1 **azul dentro de un shell
negro**. Se añadió el bloque `dark-legacy` al final del CSS (misma especificidad, gana por orden), con los
valores **leídos de `kair-design-tokens.css`** y no de una tabla escrita a mano, más las 3 únicas
superficies que el módulo escribe a mano. El test compara módulo contra shell: si la paleta del shell cambia,
el módulo tiene que seguirla. Contraste de la paleta neutra: **5.56:1** a **14.19:1**, cero fallas. El test
pasó de 42 a **63 checks** y de 16 a **22 mutaciones**.

### 2026-10-15 (tarde 3) · La lista del Cronograma sigue a la actividad elegida, sin mover la página (📦895)

**Qué se hizo** — por pedido del owner: el scroll del Cronograma del Plan de Trabajo se quedaba "hasta
arriba del todo" y debería empezar desde la actividad ID seleccionada, con un **techo** marcado justo debajo
de las tabs.

**El hallazgo que habríA costado el trabajo:** `plan-viewer.js` es código muerto. Espera
`#treeContainer` y `#ganttRows`, que **no existen en ninguna parte del repo**, y sus funciones salen en la
primera línea con un `if (!container) return;`: se ejecutan sin error y sin dejar aviso. La pantalla real la
pinta el script **inline de `plan-view.html`**. Parchear el archivo equivocado habríA dado un arreglo que no
hace nada con el test en verde.

**La causa:** `renderGantt()` vacíA `#gantt-table`, que está dentro de `#gantt-scroll`, y eso recorta el
`scrollTop` del contenedor a 0. No habíA ninguna línea que lo devolviera.

**El techo, por construcción.** `scrollIntoView()` recorre todos los ancestros scrolleables, incluido el
documento, y habríA movido la página escondiendo el título y las tabs. Así que lo único que se escribe
es `sc.scrollTop` del contenedor. El test cuenta las escrituras de `scrollTop` de todo el archivo y exige que
sean **una**.

**Un incidente de proceso que conviene saber:** a mitad de trabajo **un proceso externo revirtió
`plan-view.html` a su estado original y borró tres scripts nuevos**, todos sin commitear. Se detectó porque
el test de golpe pasó de 26/26 a 9/28. El 894 no se perdió porque ya estaba commiteado; el 895 sí, y se
reconstruyó. Desde entonces el script de aplicación **verifica el resultado releyéndolo del disco en el
mismo paso**. SeZYó el 894 como red: mientras algo esté sin commitear, está expuesto.

**Tests** — `main/test-plan-scroll-895.js` (**31 checks, 17/17 mutaciones**). Tiene dos mitades: mira el
código, y además **extrae la función real del archivo y la ejecuta con `vm`** contra un DOM simulado, para
comprobar la aritmética y no solo la forma. Un check de texto no demuestra que el scroll calcule bien.

**Sin bump de versión**: sigue en `0.1.251`.


**Dos trampas que casi se caen por el camino**

1. El espejo quedó primero como `initializeCharts()` a secas, y eso **vacía los gráficos**: los colores van
   horneados al crearlos, as­ que hay que recrearlos, pero recrearlos deja las series en cero. El orden
   correcto es `initializeCharts()` **y después** `updateCharts()`. Hay check del orden y mutación que lo invierte.
2. El espejo mal hecho se realimenta: si leyera el atributo del propio contenedor en vez de
   `documentElement`, quedaría en `null` para siempre y el defecto volvería con código nuevo. El test exige
   que lea de `documentElement` **y** que no lea de `this.container` en el mismo método.

**Tests** — `test-capacitaciones-tema-894.js` (**42 checks, 16/16 mutaciones**) y
`test-guard-modulo-894.js` (**27 checks, 13/13 mutaciones**). Batería 884–894 en verde; el 861 sigue en
614/614 con 9/9 mutaciones.

**Verificación visual** — navegador real con el CSS y el HTML del disco: seis paneles, tres temas por
(sin espejo / con espejo). Las columnas "sin espejo" reproducen exactamente las capturas del owner; la columna
**Claro sale idéntica antes y después**. No es la app instalada: sin `electronAPI` ni IPC, y sin gráficos
(Chart.js y datos del Excel). Alcanza para la cascada y el contraste, **no para el shell**.

**Sin bump de versión**: sigue en `0.1.251`.

### 2026-10-15 (tarde) · La pantalla de empresa vuelve al premium y deja de tapar Vanta (📦893)

**Qué se hizo** — por pedido del owner: rediseñar la pantalla con la que arranca la app,
conservando la animación de Vanta y con las tarjetas de borde redondeado. La propuesta se
aprobó y se implementó.

**El diagnóstico de partida.** La pantalla la construía `renderer.js` con doce estilos **en línea**,
los tokens viejos del shell (`--white-color`, `--border-color`, `--secondary-color`) y tres
bloques de tema escritos `[data-theme="dark"]` a secas. Como `dark-legacy` no es alias de `dark`,
en el **oscuro manual** los botones salían con el aspecto del claro. Y el texto blanco sobre
Vanta daba **1.93:1**, que se leía a ojo por el `text-shadow` y que **WCAG no cuenta**: por eso
el texto ahora va dentro de un panel de vidrio, que compuesto da **7.59:1**.

**Lo que encontró el owner mirando la app, y ningún test.** El primer montaje usaba la clase
`kair-premium` en el contenedor para no perder la fuente del premium. Pero esa clase no es de
contenedor: es el **envoltorio de página**, y pinta fondo, fija `height:100%` y `overflow-y:auto`.
Sobre la animación, eso es un bloque opaco. Un `background:transparent` en la regla del 893 lo
cancelaba y dejaba el CSS **correcto** — por eso el test pasaba con la causa presente y con la
ausente, y por eso no cantaba nada. El arreglo fue **dejar de usar la clase** y declarar en el
componente lo que antes tomaba prestado: fuente, `box-sizing` y las bases de la tarjeta, que
viven todas bajo `.kair-premium`. **El diseño no cambió; cambió la dependencia.**

**El centrado se perdió en el camino.** Al quitar los estilos en línea se fue el
`alignItems = 'center'` de la pantalla vieja. Un contenedor sin `align-items` sigue siendo válido
para cualquier test; solo se nota mirando. Va documentado como la tercera trampa del 893.

**Lo que sí se midió.** En navegador real, con los CSS del disco y los tres temas a la vez: el
Vanta se ve detrás, panel y tarjetas centrados, y las tarjetas cambian de superficie en claro
(`#ffffff`), `dark` (`#384151`) y `dark-legacy` (`#292929`). **No es la app instalada**: falta
confirmar con la app abierta.

**Tests** — nuevo `main/test-empresa-893.js`: **72 checks y 26/26 mutaciones**. El contraste se
calcula componiendo los `rgba` sobre el punto más claro de Vanta y leyendo los tokens reales de
`kair-design-tokens.css`, para los tres temas. Al volver autosuficiente el componente, seis
mutaciones quedaron apuntando a selectores que ya no existían y se volvieron **vacías sin avisar**:
se re-anclaron y se exigió `mutaciones vacias: 0`. Se reparó además `test-panel-tema-885.js`,
que exigía el sello `panel885` literal y se rompió solo con este bumpeo; ahora ancla a la **fecha**.
**Batería 884–893 en verde (11 tests).**

**Sin bump de versión**: sigue en `0.1.251`.


### 2026-10-15 (mañana) · 1.1.1 sigue el tema y su visor vuelve a abrir documentos (📦891, 892)

**Qué se hizo** — el submódulo 1.1.1 Responsable del SG-SST, por pedido del owner: primero el tema, después un
error que apareció al hacer clic en un documento.

**📦891 · El tema.** El owner reportó que en modo oscuro seguía viendo "el tema de sistema solapado".
Eran dos defectos distintos:

1. El sincronizador de `responsable-sg-viewer.js` era una copia de la lógica de `scripts/theme-manager.js`, que
   **no está cargado en el shell**. Se notaba en el contrato: leía `event.data.mode`, y `renderer.js:1755`
   manda `theme` y `effectiveTheme`. Con `mode` siempre `undefined` devolvía `null` en modo **sistema** y
   borraba el atributo que `renderer.js:1746` acababa de poner. El `postMessage` es asíncrono: gana el último
   en escribir. Se sustituyó por `shared/kair-iframe-theme.js`, igual que en 889 y 890.
2. `.kair-preview__body:has(flyfish-file-viewer)` y `.kair-pdf-frame` tenían `background: #fff` **sin
   contraparte oscura**. Ese es el panel blanco solapado sobre el oscuro que se veía al abrir un documento.

El CSS de 1.1.1 estaba bien: 58 reglas oscuras, 29 para `dark` y 29 para `dark-legacy`, y 322 usos de tokens.
El fallo era el atributo que dispara esas reglas, no las reglas.

**WCAG 2.1 AA.** Diez sitios tenían `color: #fff` sobre superficies de acento. El botón "Subir" quedaba en
**2.56:1** en oscuro. Se agregaron tres tokens (`--kair-on-accent`, `--kair-on-danger`, `--kair-on-warning`)
con valor por tema: el botón pasó a **6.53:1**. El ícono de advertencia del modal usaba blanco sobre ámbar y
daba **1.63:1 ya en claro** — ilegible antes de este trabajo, no solo en oscuro.

**El `?v=` tiene tres niveles**: el script dentro del iframe, el CSS del iframe y el `iframe.src` en el
padre. Falta cualquiera de los tres y Electron sirve del caché.

**📦892 · La carga de documentos.** El owner hizo clic en un documento y obtuvo
`API function __fileViewerBytes not found`.

El padre rutea el preview del PDF por `__fileViewerBytes` (`responsable-sg-logic.js:69`). Ese nombre **no
es una función de `window.electronAPI`**: es una bandera para llegar al bloque que lee bytes con
`readFileBytes`. El preload expone `readFileBytes`, `getPDFPreview` y `getWordPreview` — no
`__fileViewerBytes`. Y `handleStandardRequest` validaba **antes** de rutear, así que la guarda mataba el
canal y el bloque de ruteo nunca se ejecutaba para el PDF. El bloque que responde "Ruteo del visor de
archivos roto" era la red de seguridad, pero tampoco se alcanzaba. Los dos mecanismos se contradecían, y el
test 861 comprobaba el de abajo sin notar el de arriba.

El segundo defecto explicaba lo extraño del reporte: el panel **no limpiaba el estado anterior**, así que el
error de un archivo quedaba pintado debajo del overlay del siguiente. Con un `.docx` en pantalla y un error
de PDF encima, no había forma de saber cuál fallaba. El mensaje de error ahora nombra el archivo y su
extensión.

**Tests** — `test-responsable-tema-891.js` (58 checks, 20/20 mutaciones) y `test-visor-carga-892.js`
(26 checks, 16/16 mutaciones). Batería 884–892 en verde (10 tests); el 861 sigue en 614/614.

**🔴 Incidente anotado.** Un script mío leyó un CSS como UTF-8 y lo escribió como `latin1`: cada `═══` y
cada `—` pasaron a `P` o `?`, 64 caracteres de reemplazo. **El archivo seguía funcionando**, porque el
navegador ignora los comentarios: el daño era invisible salvo que alguien leyera el archivo. Lo detectó un
test al encontrar 0 tokens. Se restauró desde git y se reaplicó con un script que **aborta si aparece
`U+FFFD` antes de escribir**. Queda como trampa 24 de `PROMPT.md`.

**🔴 Lo que NO se verificó** — ni el 891 ni el 892 se miraron en la app instalada. El arnés HTTP del 891
llegó a una conclusión útil (el iframe no cargaba el módulo compartido) pero se colgó después: el `load`
del iframe no dispara con el bundle del file-viewer montado, y el browser se saturó. Se cambió de método a
análisis de código y test en Node. **El owner tiene que reiniciar Electron y confirmar**: 1.1.1 oscuro en
modo Sistema, y que un PDF y un DOCX abran en el visor.

**Pendientes que no se tocaron** — `--kair-text-muted` queda en 3.09:1 en claro y 3.88:1 en oscuro, bajo el
mínimo en los dos temas: deuda de accesibilidad preexistente, ajena al tema. Y `_printConvertedDocument
manda `get-pdf-preview` por defecto para cualquier extensión desconocida, así que imprimir un `.txt`
intentaría convertirlo con LibreOffice.

**Sin bump de versión** — sigue en `0.1.251`.

---

### 2026-10-14 (tarde) · Recursos: el home, 1.1.2, 1.1.3 y 1.1.5 siguen el tema (📦887, 889, 890)

**Qué se hizo** — los submódulos del módulo Recursos, uno por uno y por pedido explícito del owner.
Tres paquetes, y **cada uno resultó ser una forma distinta del mismo fallo de fondo: el color no tenía
tema.** La app nunca se abrió en esta sesión.

| Paquete | Qué | Forma del fallo |
|---|---|---|
| 📦887 | El home de Recursos | Dos `:root` de módulo se llevaban los tokens del shell por delante |
| 📦889 | 1.1.2 Roles y 1.1.3 Asignación de Recursos | **Son iframes**: el `data-theme` no cruza la frontera |
| 📦890 | 1.1.5 Gestión del COPASST | Cero reglas por tema, un `:root` global y **48 reglas muertas** |

| Qué | Resultado |
|---|---|
| Test nuevo | `test-alcance-tokens-889.js` (37 checks, 21/21 mutaciones) y `test-copasst-tema-890.js` (47 checks, 23/23 mutaciones) |
| Módulo nuevo | `shared/kair-iframe-theme.js`, el sync de tema para iframes |
| Batería | 884–890 completa en verde; integridad OK |
| Versión | Sin bump: sigue en `0.1.251` |

**El detalle que más costó de ver: `dark-legacy`.** El shell manda el tema resuelto por tres vías, y una
trae el **oscuro manual** como `dark-legacy`, que **no** es alias de `dark`. Un código que solo acepta
`'dark'` lo da por claro y **le quita el atributo**: el modo manual queda sin pintar mientras el de sistema
funciona. La mitad de las pruebas pasa y parece que el arreglo funcionó.

**Las tres formas que el shell manda de verdad** (y las que **no** llegan, que son las que el código viejo
esperaba):

1. `get-theme-response` → `{theme: <ya resuelto>}` — `renderer.js:2006`
2. `theme-changed` → `{theme: <preferencia>, effectiveTheme: <resuelto>}` — `renderer.js:1756` y `7445`
3. escritura directa en `iframe.contentDocument.documentElement` — `renderer.js:1746` y `7418`

Las que **no** llegan son las de `scripts/theme-manager.js`, que espera `{theme, mode}`: ese archivo existe
en disco y **no está cargado en el shell**. Cualquier código que dependa de su forma de mensaje está roto,
y no por poco.

🔴 **Tres hallazgos del 📦890 que nadie había reportado, y que eran peores que el síntoma reportado:**

1. **El formulario escribía en el shell entero.** `showRealizarActasInterface()` inyecta un `<style>` que
   abría un `:root` con `--widget-bg-color: #ffffff`. **Un `:root` que no está en el `<head>` sigue siendo
   el `<html>`**, así que ese valor se leía en los 44 lugares de `styles.css` que lo usan y, como la hoja
   entra después, ganaba por orden contra `[data-theme="dark"]` (empate 0,1,0). Mientras el formulario
   estaba abierto, el shell completo se leía con superficies blancas.
2. **El bloque oscuro del formulario era código muerto.** Sus 13 selectores pedían
   `.copasst-actas-container[data-theme="dark"]` y ese atributo vive en el `<html>`, nunca en el contenedor.
   Nunca se ejecutó. Es el mismo error que el 887 encontró en `capacitaciones-view.css` (47 reglas) y
   `objetivos-sst-view.css` (48).
3. **El Repositorio de Actas BORRABA el tema.** `renderer.js:1743-1759` escribe el atributo **ya resuelto**
   en el `contentDocument` y **después** manda `theme-changed`. El sincronizador del visor traducía eso con
   la forma `{theme, mode}` equivocada, así que con `theme:'system'` devolvía `null` y hacía
   `removeAttribute`. Como el `postMessage` es asíncrono, **ganaba siempre el paso que rompía**.

**La lección del arnés, que se aplicó a sí mismo.** La primera versión del arnés mutaba `data-theme` con el
DOM ya montado y medía con `getComputedStyle`: reportaba **16 fallas que no existían**, porque sin un ciclo
de render la lectura devuelve el estilo del estado anterior. Se rehízo para que el tema viaje en el HTML
**desde el parseo**. Antes de eso se persiguió una causa que era el arnés mintiendo: se llegó a leer, en un
mismo elemento y en el mismo instante, la variable de tema ya oscura y el fondo todavía claro. **Eso solo
significa que el que mide está mal, no que el CSS esté mal.**

**Pendiente de decisión del owner:** 1.1.2 y 1.1.3 usan **paletas distintas** entre oscuro de sistema y oscuro
manual. `dark` es azul K+AIR (`--kair-card: #384151`) y `dark-legacy` es gris neutro (`#292929`). 1.1.3 lee
tokens, así que sigue esa diferencia; 1.1.2 usa su propia paleta explícita y sale azul en los dos. Hay que
decidir en qué dirección alinear.

**Lección operativa: `copasst-home.css` es de EOL mixto a propósito** (el bloque legacy es CRLF y el premium
del final es LF). La herramienta de edición lo normalizó a CRLF entero la primera vez y hubo que restaurar
desde git y rehacer el cambio por bytes. El test 890 lo vigila con dos mutaciones que lo normalizan a
propósito.

### 2026-10-06 (madrugada) · El admin quedaba encerrado en "contacta a administración" (📦862)

**Qué se hizo** — un bug de permisos en `renderer.js`, con su test y sus documentos. La app
**no se abrió** en esta sesión: el owner autorizó editar y commitear por separado.

| Qué | Resultado |
|---|---|
| Filtrado de empresas | Se decide **por rol primero**. Antes la rama del admin era código muerto |
| Mensaje de "sin empresas" | Decide por rol: un admin nunca ve "contacta a administración" |
| Test nuevo | `main/test-admin-empresas-862.js`, **17 checks**, con prueba de mutación |
| Versionado | 0.1.240 → **0.1.241**, cache-bust `renderer.js?v=20261006-admin-empresas-2` |
| Documentos | CHANGELOG + README + CONTEXT + release-notes + AGENTS (los 5, §5.8) |

**Por qué** — el owner reportedó que al entrar le decía *"No tienes empresas asignadas. Contacta a
administración"*, y él **es** administración. El mensaje lo hizo creer que era un tema de permisos
y lo tuvo un rato agarrado.

**El bug, en una línea.** `showHomePage` filtraba las empresas así:

```js
if (Array.isArray(overrideCompanies)) { ... }              // SIEMPRE true
else if (assignedCompanies && ... && !checkIsAdmin()) { ... }
else { /* ADMIN: todas las empresas */ }                     // NUNCA se ejecutaba
```

`Array.isArray([])` es **`true`**, y `initializeApp()` se llama en **un solo** sitio
(`renderer.js:3604`) pasando siempre `assignedCompanies`, que es un array. La primera rama ganaba
**siempre**. Verificado con grep: `initializeApp(` aparece una vez en `renderer.js` (el otro hit
es una función homónima dentro de `seguimiento-incapacidades.html`).

Arrastraba tres cosas: el admin sin empresas veía cero empresas y el mensaje de un usuario normal;
el `else` del admin era inalcanzable, así que el fallback `["Tempoactiva","Temposum","Aseplus","Asel"]`
tampoco era código real; y `checkIsAdmin()` **nunca se consultaba**.

**La trampa del arreglo obvio.** Agregar `&& overrideCompanies.length > 0` **abre una escalada de
privilegios**: un no-admin sin empresas caería en el `else`, que carga `config.companyPaths` entero,
y vería **todas**. El bug visible se arregla y se crea uno peor. El arreglo correcto decide por rol
primero, y el test cubre ese caso explícitamente.

**El backend estaba bien.** `validateSession` (`main.js:1021`) reconoce `admin@kair.local` y
devuelve `isAdmin: true`. El diagnóstico por la app daba la pista equivocada porque el mensaje
**parecía** de permisos.

**El primer fix no alcanzó, y el owner lo reportó con una captura.** Arreglé el orden de las
ramas, subí la versión a 0.1.241 y el mensaje **seguía siendo el viejo**. La captura lo dejó
claro: la app corría el código nuevo (el pie decía `v0.1.241`) pero `esAdmin` valía `false`.

Había una segunda causa, más profunda: **`checkIsAdmin()` derivaba el rol solo de
`currentUser.companies`**. Con `companies = []` —el caso del admin global, que por definición no
tiene empresas asignadas— `[].some()` da `false`. El backend ya mandaba `user.isAdmin` resuelto
(`main.js:1628`) y el renderer lo ignoraba. Ahora `checkIsAdmin()` respeta `currentUser.isAdmin`
primero y solo recalcula por `companies` cuando el backend no resolvió el caso global.

Y el admin quedaba **sin salida**: el Inicio oculta el sidebar siempre (`sidebar-hidden`), así que
con cero empresas no había forma de llegar a la configuración. Se agregó un botón **Ir a
Configuración** cuando es admin y la lista está vacía.

**El cache-bust se bumpeó dos veces.** El primer token (`20261006-admin-empresas`) ya lo había
descargado la app en ese arranque, así que la segunda vuelta necesitaba uno nuevo
(`20261006-admin-empresas-2`). Es §5.3: **un token repetido no sirve para nada**.

**Tests** — el nuevo test **extrae el bloque de decisión de `renderer.js` y lo ejecuta** con roles
distintos, en vez de buscar cadenas: cubre los cinco combinatorios de (admin, asignadas, override)
más los dos del mensaje. Lo que le da valor es la **mutación**: reintroduciendo el orden del bug
**sobre el código nuevo** (conservando `const esAdmin`, para que el check estructural siga
pasando) fallan los dos checks de comportamiento — `admin sin empresas recibió []` y
`admin con override recibió ["Solo"]`. Un detector de cadenas habría pasado ese mutante.

**Suite:** 120 tests · 99 verdes · 21 con fallos. Las 21 son **las mismas preexistentes**: cero
regresiones. Repetida justo antes del commit: **120 tests · 102 verdes · 18 con fallos**. De esos
18, los 5 que leen archivos tocados por 📦862 (`auditoria-visual`, `compose-bem`,
`evaluacion-inicial-bootstrap`, `skeleton-encaje`, `auto-download-flow`) **fallan también en HEAD
limpio** — stash, corrida, pop, árbol idéntico al de antes (§7.4) — y los otros 13 no leen ningún
archivo que haya cambiado. Preexistencia probada, no supuesta.

**Una fricción que encontró el suite.** `test-hero-fila-840` tiene el token de cache-bust
**escrito a mano** (`renderer.js?v=20261002-hero-oculto`), así que **se cae con cada bump legítimo**.
Falló al subir el `?v=` de 📦862 y hubo que actualizar el literal. No se rediseñó el check para que
no se rompa: eso es decisión del owner, no un efecto colateral de este paquete.

**Decisiones del owner**

- Autorizó editar ("ok procede"). **No autorizó commit**: 📦862 queda en el working tree.
- Confirmó que el rol lo tenía bien y que el problema era que no le aparecían las opciones.

**Datos: por qué el fix solo no alcanza**

El escritorio tiene la base creada (76 tablas) pero **sin empresas**:

| Fuente | Estado |
|---|---|
| `companies` | 0 filas |
| `user_company_roles` | 0 filas |
| `config.json` → `companyPaths` | **no existe** |
| `roles` | 5 filas (Administrador, SST, Auditoría, Gerencia, RRHH) |
| `users` | 1: `admin@kair.local`, activo, `bandeja_integrada_enabled: 0` |

Con 📦862 el admin ya **no** ve el mensaje equivocado: ve el correcto ("no hay empresas
registradas, crea una en configuración"). Pero **sigue sin ver empresas**, porque no hay ninguna.
Esto no se arregla con código: hay que restaurar el `kair.db` y el `config.json` del portátil.
Y registrar empresas desde la UI ("Vincular Rutas de Archivos por Empresa",
`config-viewer.html:6853`) **exige Python 3.10–3.12**, que esta máquina no tiene (tiene 3.14.8).

**Commits**

| Hash | Qué | Estado |
|---|---|---|
| `e2f6adaf` | docs(entorno): puesta a punto del escritorio | pusheado |
| `📦862` | fix admin empresas + test + los 5 documentos | commiteado y pusheado |

---

### 2026-10-05 (tarde) · Escritorio recién formateado: puesta a punto (sin paquete de código)

**Qué se hizo** — esta sesión **no cambió una línea de la app**. El árbol quedó idéntico a `HEAD`
(`e6a98d98`). Lo que se hizo fue dejar un escritorio recién formateado capaz de correr y probar el
proyecto, y dejar escrito lo aprendido.

| Qué | Resultado |
|---|---|
| Fusionar `Dev-Pc` en `Dev` | El owner lo hizo a mano. `Dev` quedó en `e6a98d98`, que ya contiene 📦861 |
| `node_modules` | 913 paquetes. `npm install` normal **falla y revierte todo**: compila `better-sqlite3` contra Node 26 y revienta |
| Electron 37.10.3 | Extraído a mano. El `install.js` oficial salió con código 0 tres veces sin extraer nada |
| `better-sqlite3` | Compilado para **Electron** (`--runtime=electron --target=37.10.3`), verificado con un `SELECT` real: `OK 37.10.3, sqlite 3.49.2` |
| **`core.autocrlf`** | **El hallazgo grande.** 2277 archivos en CRLF y `git status` diciendo "limpio" |
| `setup-file-viewer.js` | Corrió, pero **borró 2624 archivos versionados**. Revertido: es paso de packaging, no de desarrollo |

**Por qué** — el owner formateó el PC y pidió validar que no le faltara nada para probar la app.

**El problema de fondo: `autocrlf`**

El instalador de Git for Windows dejó `core.autocrlf=true` en `C:\Program Files\Git\etc\gitconfig`.
Es config de **sistema**, así que `git config --global` sale **vacío** y parece que no hay nada
configurado. Ese `true` convierte LF→CRLF en el checkout, y como el repo guarda en LF a propósito
`main.js`, `preload.js`, `index.html`, `main/*-bridge.js`, `shared/*.css` y `premium.css` (los tests
lo verifican uno por uno), el clon dejó **2277 archivos en CRLF**.

Lo peligroso: **`git status` dice que el árbol está limpio**. Miente por dos razones que se refuerzan
— el stat-cache ya registró los tamaños convertidos, y al commitear Git normaliza CRLF→LF. El
archivo está mal en disco y Git no lo ve. El próximo `git add` sube CRLF y aparece el diff de ~7000
líneas.

Cinco tests fallaban con el mismo mensaje (`premium.css sigue en LF [CRLF, esperado LF]`) — un solo
síntoma repetido, que es la firma de un problema de entorno y no de UI.

**El fix que costó encontrar.** `git config --local core.autocrlf false` no alcanza por sí solo:

| Comando | Resultado |
|---|---|
| `git checkout-index -a -f` | 0 cambios. No reescribe |
| `git update-index --really-refresh` | 0 cambios. No reescribe |
| `git read-tree --reset -u HEAD` | 0 cambios. No reescribe |
| **`git reset` + `git checkout -- .`** | **Funciona.** El `reset` rehace el índice sin stat-cache; recién ahí Git ve los 2277 |

Renormalizar **no** uniforma: **restaura**. `main.js` quedó en LF y `app.js` quedó en CRLF, que es lo
que el repo pide. **De 88 a 98 tests en verde sobre 119**; los 10 recuperados eran todos de EOL.

**Segundo problema: `better-sqlite3` se compiló contra el Node equivocado.** La app nunca corre con
Node 26 — corre dentro de Electron 37.10.3, que usa Node 22.21.1 y ABI 136. `npm install` corrió
`node-gyp` contra Node 26 y falló con APIs de V8 eliminadas (`"GetIsolate": no es un miembro de
"v8::Context"`). No faltaba el compilador: `cl.exe` estaba instalado. Al fallar, npm **revirtió el
install entero** (913 paquetes → 2). El orden que funciona está en `PROMPT.md` §5.17 y §9.

**Un tercer defecto del repo, no del entorno:** `CONTEXT.md` tiene separadores **CR CR CR LF** (tres
CR) en 1337 de sus 1354 líneas. Viene así del repo. Cualquiera que lo edite con `Edit` o lo reescriba
con `ReadAllText` rompe el diff entero. Por eso la sección nueva se insertó con un script que **detecta
el separador real** en vez de suponerlo, y se verificó por estructura: 40 adiciones, 0 eliminaciones.

**Tests** — 119 corridos en el escritorio: 98 verdes, 21 con fallos, **no comparables** con los del
portátil (101 verdes). Las 21 se reparten en:

| Grupo | Cuántas | Por qué |
|---|---|---|
| Requieren Electron con ventana | 5 | Hacen `require('electron').app.whenReady()`, que no existe con `ELECTRON_RUN_AS_NODE=1` |
| Requieren `kair.db` | 4 | La BD vive en `%APPDATA%`, fuera del repo. Esta máquina no la tiene |
| Aserciones reales contra el código commiteado | ~12 | `header-zindex`, `compose-bem`, `skeleton-encaje`, `auditoria-visual`. **No se verificó si también fallan en el portátil** — no hay acceso a esa máquina |

**Decisiones del owner**

- Ante el hallazgo del upgrade a Electron 44 sin commitear, eligió **revertir a Electron 37** y dejar
  el escritorio funcionando, en vez de subir `better-sqlite3` a 13.x. El patch quedó en
  `backups/electron44-upgrade-2026-10-05.patch` (10.4 KB, gitignored) por si lo retoma.
- Autorizó commit y push el 2026-10-05.

**Commits**

| Hash | Qué | Pusheado |
|---|---|---|
| `e6a98d98` | `Merge branch 'Dev-Pc' into Dev` (lo hizo el owner) | sí, ya estaba en `origin/Dev` |
| este | Documentación de la puesta a punto + 4 trampas nuevas | sí |

**Lo que sigue pendiente en este escritorio**

1. **Datos:** copiar un backup a `%APPDATA%\sgsst-electron-app\kair.db`. Sin eso la app abre vacía.
2. **Google Calendar:** `Copy-Item .env.example .env` y completar `GOOGLE_OAUTH_CLIENT_ID` /
   `_SECRET`. Credenciales del owner, no inventables.
3. **Python:** está en 3.14.8 y el README pide 3.10–3.12. Afecta 5 Porqués y análisis de accidentes,
   no el arranque (hay fallback al Python del sistema).

---

### 2026-10-03 · Bandeja Integrada (📦844-851) + Prompt operacional v2.0

**Qué se hizo**

| Paquete | Qué |
|---|---|
| 📦844 | El mini-calendar queda fijo en el mes actual y cruza la medianoche sin congelar "hoy" |
| 📦845 | Doble clic lleva al calendario grande a la vista Día del día elegido |
| 📦846 | Popup de categorías al pasar el mouse, agrupado, tope de 8 |
| 📦847 | Se quita el tooltip nativo duplicado y se corrigen las horas que salían `00:00` |
| 📦848 | Se corrige "Todo el día": ahora usa la misma regla que la grilla |
| 📦849 | Los 3 indicadores bajan al sidebar en **"Tu día"**; fuera "Eventos críticos"; el correo gana el alto |
| 📦850 | **Botón en el borde para plegar la columna lateral**, con estado persistente |
| 📦851 | Se va la etiqueta con el mes del encabezado (repetía lo que ya dice el calendario) |
| — | `PROMPT.md` v2.0: auditoría completa del prompt viejo contra el código real |
| — | `PRODUCT.md` corregido (paleta, tipografía, dark mode, "no hay README") |
| — | 3 trampas internas de `AGENTS.md` corregidas (ver abajo) |

**Por qué**

El sidebar de la Bandeja se comía un quinto de la pantalla, y los indicadores vivían arriba
robándole espacio al correo. El owner pidió plegar la columna y bajar los indicadores.

**Tests**

| Archivo | Checks | Mutation |
|---|---|---|
| `test-minical-844.js` | 27/27 | — |
| `test-minical-dblclick-845.js` | 24/24 | — |
| `test-minical-reloj-844.js` | 29/29 | — |
| `test-minical-hover-846.js` | 49/49 | 12/12 |
| `test-minical-hora-847.js` | 23/23 | 2 bugs + 8 guards |
| `test-minical-allday-848.js` | 22/22 | 3/3 + 5 guards |
| `test-bandeja-tudia-849.js` | 47/47 | 3/3 + 10 guards |
| `test-bandeja-sidebar-850.js` | 48/48 | **20/20** |
| `test-bandeja-chip-851.js` | 16/16 | **9/9** + 1 equivalente declarada |

Suite completa: 111 tests, 93 verdes, 18 preexistentes, 0 regresiones.

**Decisiones que el owner confirmó** (no volver a preguntar)

- El botón del borde va **fuera** del `<aside>`, en el borde de la columna.
- El sidebar **empieza abierto** y la app **se acuerda** de cómo se dejó.
- Se **elimina por completo** "Eventos críticos", no se oculta.
- Se borran el texto y el botón de "Integración correo"; los indicadores ocupan ese lugar.
- `PROMPT.md` **referencia** los documentos del repo en vez de duplicar sus valores.
- Va en la **raíz del repo**, versionado junto a `PRODUCT.md`.

**Los 4 bugs que aparecieron durante el trabajo** (importante: ninguno estaba en el código,
todos los encontró el test o la validación)

1. 📦848 — el fix de 📦847 inventó el criterio "si el rango es 00:00–23:59 es todo el día", pero
   **5 generadores en `main.js` crean eventos exactamente así**. La verdad ya existía y la usaba
   la vista Día. El test de 📦847 afirmaba el bug como correcto: se invirtió, no se borró.
2. 📦850 — un handler que borra y reinserta preservaba un campo leyendo la tabla **después** del
   borrado. Resultado real en la BD del owner: el 2026 de Tempoactiva quedó con `0/14` categorías.
3. 📦850 — el popup decía "Todo el día" para todo, y las horas salían `00:00`, porque leía los
   eventos con nombres de campo que no son los reales.
4. Documentación — `PROMPT.md` viejo, `PRODUCT.md` y 3 secciones de `AGENTS.md` describían un
   sistema visual que no existe. Origen probable: `AGENTS.md:235` referenciaba un archivo
   (`kair-canonical.css`) que **nunca estuvo en el repo**.

**Archivos tocados en la jornada**

```
PRODUCT.md                                        (corregido)
PROMPT.md                                         (nuevo)
Historial.md                                      (nuevo)
CLAUDE.md                                         (nuevo)
sgsst-electron-app/AGENTS.md                      (3 trampas corregidas)
sgsst-electron-app/README.md                      (0.1.233)
sgsst-electron-app/CHANGELOG.md                   (0.1.233)
sgsst-electron-app/CONTEXT.md                     (0.1.233)
sgsst-electron-app/release-notes.md               (0.1.233)
sgsst-electron-app/package.json                   (0.1.233)
sgsst-electron-app/renderer/bandeja-integrada/    (index.html, app.js, data.js, premium.css)
sgsst-electron-app/main/test-bandeja-*.js         (nuevos y actualizados)
sgsst-electron-app/main/test-minical-*.js         (nuevos)
```

**Commits de la jornada**

| Hash | Paquete | Push |
|---|---|---|
| `42cce42e` | 📦844-849 | Sí |
| `47779352` | 📦850-851 | Sí |
| `2926b8ea` | 📦852 documentación | Sí |
| (36dcc1eb) | 📦853-854 aviso de correo en "Tu día" | Sí |
| (c953462b) | 📦855 la bandeja abre en blanco | Sí |
| (este commit) | 📦856-857 "Tipos de evento" cuenta lo que se ve | Sí |

---

### 2026-10-03 · "Tipos de evento" cuenta lo que se está mirando (📦856-857)

**El bug reportado (📦856)**

Las seis categorías marcaban 0, siempre. **No faltaban datos**: el panel iteraba sobre
`D.EVENT_CATEGORIES` y comparaba `e.category === cat.id`, pero las dos únicas fuentes de eventos
devuelven `rapido`:

| Fuente | Devuelve | Archivo |
|---|---|---|
| Eventos rápidos | `type: row.tipo \|\| 'rapido'` | `main/eventos-rapidos-bridge.js:101` |
| Google Calendar | `category: kairCategory \|\| 'rapido'` | `shared/google-calendar.js:107` |

**Verificado contra las 75 tablas de la BD real: ninguna guarda las 6 categorías oficiales.** La
única tabla de eventos tiene `tipo='rapido'` y 5 filas de julio-agosto.

Pista extra en la captura: **todos los puntitos del mini eran del mismo azul**, que es
`categoryColor[ev.category] || "#2057B8"` — el color de respaldo de "no reconocí esta categoría".

**No-op silencioso encontrado de paso**

El mini hacía `if (D.FALLBACK_CATEGORIES)`, pero **`D.FALLBACK_CATEGORIES` no existe**: es una `const`
local de `app.js`. El `if` protegía un crash y dejaba el bloque vacío, así que las categorías no
oficiales nunca entraban al mapa de colores.

**Lo que pidió el owner después (📦857)**

Mostrar solo los tipos con eventos, contar el mes en vista Mes, el día al elegirlo en el mini, y que
**las tres secciones existan siempre**.

**El footer del calendario también mentía**: decía "224 evento(s) en el rango visible" y eran 224
del **año entero**. La suma de los contadores daba exactamente 224: panel y footer coincidían, y los
dos estaban mal.

**El alcance ahora sigue a la vista** (`alcanceFechas`, pura): Mes usa las celdas de la grilla
**incluidos los días en gris del mes vecino** (porque están en pantalla); Día y Programar usan el día
seleccionado; Semana usa los 7 días desde el lunes; y un clic en el mini fija ese día aunque la vista
siga en Mes.

**Por qué `alcanceTipos` es un estado aparte de `selectedDate`**

`selectedDate` **siempre** tiene valor (init lo pone en hoy): no distingue "hoy por defecto" de "el
owner eligió este día". Y un clic simple en el mini **no** cambia `calView`, así que sin la bandera
no había forma de saber que señaló un día. Se fija en `seleccionarDiaDelMini` y en el "+N más"; se
suelta al navegar de mes, con "Hoy", al cambiar de vista, o con el botón emergente **"Ver el mes
completo"**.

**"Tu día" desaparecía por dos motivos de layout**

1. `.kair-sidebar` con `overflow: hidden` → la tercera tarjeta se salía **recortada, sin scroll**.
2. Sin `min-height: 0`, un hijo flexible no baja de su altura mínima y el padre se desborda.

Reparto final: `.mini` y `.tuday` con `flex: none` (altura fija), `.tipos` con `flex: 1 1 auto` +
`min-height: 0` y su lista scrolleando por dentro. El `overflow-x: hidden` del sidebar **se conserva**
(📦850: evita el derrame de tarjetas durante los 240ms del plegado); el `overflow-y` pasó a `auto`.

**Bug propio que casi revirtió 📦844**

Metí `buildMonthGrid(state.viewYear, ...)` **dentro** de `renderSidebar`, que es exactamente el
acoplamiento que 844 eliminó (el mini está congelado en el mes real). Lo detectó
`test-minical-844` (26/27) y está en su razón de ser. El cálculo se movió a `celdasDelMesVisible()`,
**fuera** de `renderSidebar`.

**Código muerto que se borró**: `calcularTiposEvento` quedó huérfana al reemplazarla 857. El repo
arrastra 12 JS huérfanos; no se suma otro.

**La lección del paquete: un check que se satisface a sí mismo**

El comentario que explica el arreglo en el CSS dice literalmente `` `overflow-y: auto` ``, y el check
buscaba ese texto sobre el CSS crudo: **se encontraba a sí mismo en la nota al lado** y pasaba
aunque la declaración real estuviera rota. Lo delató una mutación que decía "no muerde". Documentado
en `PROMPT.md` §5.15.

**Tests**

| Archivo | Checks | Mutation |
|---|---|---|
| `test-tipos-evento-857.js` | 37/37 | **14/14** (4 de CSS: el layout es media parte del bug) |
| `test-tipos-evento-856.js` | 32/32 | **10/10** |
| `test-bandeja-sidebar-850.js` | 49/49 | **21/21** (check de overflow invertido) |
| `test-minical-844.js` | 27/27 | — sin cambios |
| Los otros 6 de bandeja | todos verdes | — |

Suite completa: 115 tests, 97 verdes, 18 preexistentes, **0 regresiones**.

---

---

### 2026-10-03 · La bandeja abre en blanco (📦855)

**Qué se hizo**

| Qué | Detalle |
|---|---|
| `init()` | Ya no hace `selectMail(state.mails[0].id)`. Arranca con `selectedMailId = null` |
| Respaldo `"m1"` | Fuera. Era un id de mock: sin correos la app apuntaba a un mensaje inexistente |
| Filtro | El predicado vive en `mailPasaFiltroActual(m)`, en un solo lugar y al nivel correcto |
| Cambio de filtro | `setMailFilter(f)` centraliza los 3 caminos; suelta la selección que quedó fuera |

**Los dos bugs que lo causaban**

1. `init()` elegía el primer correo y `selectMail` lo marcaba como leído: **abrir la app metía un
   correo a leídos sin que nadie lo abriera**, y no era el más reciente sino `mails[0]`.
2. `renderMailDetail` buscaba el seleccionado en `state.mails` **sin mirar el filtro**, mientras la
   lista sí lo miraba. De ahí que el panel mostrara un correo que la lista ya no enseñaba — literal,
   la captura: "Prueba 5" abierta con otros cuatro en la lista.

**La lección — un error de alcance no lo caza `node --check`**

El predicado se declaró primero **dentro** de `renderMailList`, y `setMailFilter` vive en otro
nivel. Sintácticamente válido, se ve bien al leerlo… y al tocar un chip de filtro saltaba un
`ReferenceError` que congelaba la bandeja. Lo detectó el test, al no poder armar su sandbox. Quedó
un check que falla si alguien vuelve a anidarlo.

**La lección — un check que reconoce la redacción de un bug no verifica el comportamiento**

Dos checks de 📦853 buscaban el texto exacto `state.mailFilter = "unread";`. Si alguien
reintrodujera el auto-selección con otra redacción, el check pasaba igual. Se reemplazaron por uno
que pregunta *"¿la selección se deriva alguna vez de `state.mails`?"*, que no depende de cómo esté
escrito.

**Ojo con esto al retomar**: la validación de la selección vive en `setMailFilter`, **no** en
`renderMailDetail`, a propósito. Si se mueve al render, al hacer clic en un no leído —que al
abrirse marca leído— el correo se borra de la pantalla en el mismo clic en que se lo está leyendo.
Hay un check que lo impide.

**Tests**

| Archivo | Checks | Mutation |
|---|---|---|
| `test-bandeja-seleccion-855.js` | 25/25 | **10/10** |
| `test-bandeja-tudia-853.js` | 76/76 | **35/35** |
| `test-bandeja-tudia-849.js` | 50/50 | — (check invertido) |
| `test-bandeja-premium-v2.js` | 48/48 | — |
| `test-bandeja-toolbar-compacta.js` | 51/51 | — |
| `test-bandeja-chip-851.js` | 16/16 | 9/9 |

Suite completa: 113 tests, 95 verdes, 18 preexistentes, **0 regresiones**.

---

### 2026-10-03 · Alertas de "Tu día" (📦853)

**Qué se hizo**

| Qué | Detalle |
|---|---|
| Clic de "Correos no leídos" | Antes solo cambiaba de vista; ahora aplica `setMailFilter("unread")` y marca lo visto |
| Filtro "No leídos" | Subió del menú "Más" a la barra visible: `PRIMARY_FILTERS = ["all","unread","sent"]` |
| Aviso de novedad | **Réplica exacta del 99+** del shell, colgada de la esquina de la fila |
| Al hacer clic | Marca las notificaciones de **correo** como leídas → **baja el pillón y el 99+** |
| "Invitaciones pendientes" | **Retirada** |

**Por qué** — El owner pidió que "Tu día" avisara lo que llega "como se ve arriba en el icono de la
Bandeja Integrada", y al hacer clic en los no leídos se mostrara esa lista y no la bandeja completa.

**📦854 · Lo que cambió cuando el owner mandó a investigar de verdad**

Las dos primeras versiones del aviso se hicieron "a ojo", copiando lo que se veía en la captura. El
owner las rechazó y dijo: *"investigá cómo está construido ese sistema y replicálo"*. Al investigar:

- **El 99+ no es un badge, es un servicio.** `main/notifications-service.js` corre cada 60s;
  `main/notifications-email.js` busca `email_threads WHERE has_unread = 1` e inserta filas en la
  tabla `notificaciones` con `dedupe_key` única; emite `notificaciones:changed`; el `renderer.js`
  pinta el badge y el toast. El número viene de esa tabla, no de Gmail.
- **Lo que yo había hecho era un contador paralelo.** Usaba `localStorage` sobre `state.mails`: no
  tocaba la tabla, no hablaba con el 99+, y mostraba un número distinto al de arriba. Con lo cual
  el aviso de "Tu día" y el del botón **no podían bajar juntos**, porque eran dos cosas sin relación.

**La réplica quedó en tres piezas:**

| Pieza | Qué hace |
|---|---|
| El pillón | Cuelga de la **esquina de la fila** (como el 99+ del botón) con los **9 valores** copiados de `.kair-cal-badge` |
| El clic | `_marcarNotifsCorreoLeidas()` lista con `soloNoLeidas` + `limit: 50` (el mismo payload de `kair-alerts.js:206-212`), filtra `tipo === "correo"` y marca por `notificaciones:marcarLeida` |
| El refresco | `KA.refresh()` después de marcar, para que el 99+ baje ya y no al próximo tick de 60s |

**A propósito NO se usa `marcarTodas`**: taparía también los eventos, y mirar el correo no es lo
mismo que decir "ya vi los eventos". El número grande sigue viniendo de **Gmail**, independiente del
servicio de notificaciones (decisión del owner).

**El bug de fondo que destapó la investigación** — la tabla `notificaciones` tenía:

| | |
|---|---|
| Filas | 78 |
| Sin leer | **77** — de las cuales **61 correos** |
| Marcadas como leídas | **1 en toda la historia** |

**El 99+ no podía bajar nunca**, porque nada marcaba esas filas. Ahora "Tu día" es donde se marcan.

**Corrección de rumbo** — La primera implementación metió un **switch** para encender/apagar las
alertas. El owner lo rechazó: *"no quiero un switch, quiero este tipo de alerta visual"* (con la
captura del pillón 99+). Se quitó el switch completo —botón, `role="switch"`, `aria-checked`, clave
`TUDIA_ALERTAS`, helpers `_alertasTuDiaOn`/`_setAlertasTuDia` y sus reglas CSS— y se puso el pillón.
La **línea base de lo visto** (`kair-bandeja.tuDiaVistos`) sí se conservó: es lo que hace que el
número sea "cuántos son nuevos" y no "cuántos hay en total".

**El pillón se ve igual que el 99+ del shell a propósito.** Copió de `.kair-cal-badge`
(`styles.css:6121`): mismo rojo `#dc3545`, misma proporción de radio, misma sombra
`0 1px 3px rgba(0,0,0,.25)`, mismo número blanco bold, y tope 99+. El owner ya reconoce ese rojo
como "llegó algo"; uno nuevo habría tenido que aprenderlo. Va dentro de un envoltorio con
`position: relative` porque si se anclara a la fila quedaría en la esquina de las 250px del sidebar
en vez de encima del ícono, que es donde el ojo ya está mirando.

**Diagnóstico hecho ANTES de codear** (esto es lo que sostuvo el trabajo)

1. `render-mail-list.js` **ya tenía** un filtro "No leídos" escrito — y **no está cargado** en
   `index.html`. Es uno de los 12 JS huérfanos (bloqueante #4). La lógica buena existía en dos
   lugares: la muerta y la viva.
2. `PRIMARY_FILTERS = ["all", "sent"]` era lo que escondía el filtro. El filtro estaba en
   `filterDefs` y la lista lo respetaba; lo que faltaba era un camino desde la pantalla.
3. **"Invitaciones pendientes" nunca pudo tener dato.** `meetingSuggestion` se lee en 4 lugares y
   **no se escribe en ninguno**: solo existe en los correos de ejemplo de `data.js`.
4. **La BD real no tiene eventos de hoy.** Se consultaron las **76 tablas** de `kair.db`: 0 filas
   con la fecha de hoy. `eventos_rapidos` tiene 5 filas, la última del 12 de agosto. Los eventos
   del calendario vienen de **Google Calendar**.
5. **Bomba armada en `app.js:1286`:** si el adaptador local devuelve 0 eventos, hace
   `return D.EVENTS.slice()` — los **datos de ejemplo de julio** — y nunca llega a consultar
   Google. No se dispara hoy, pero si la BD queda vacía el calendario muestra mails de ejemplo.

**Bugs que salieron de los tests, no de mirar la pantalla**

1. La animación del badge quedó en **420ms**, violando la regla del repo de "<300ms". El check lo
   detectó y se bajó a 240ms.
2. **3 regresiones** al cambiar el contrato: `test-bandeja-tudia-849.js`,
   `test-bandeja-premium-v2.js` y `test-bandeja-toolbar-compacta.js` afirmaban "los 3 indicadores"
   y "solo Recibidos y Enviados". Los 3 se **invirtieron**, no se borraron.
3. `test-bandeja-tudia-849.js` crasheó: corre `calcularIndicadores` en un sandbox y la función pasó
   a depender de 4 helpers nuevos. Se traen los **helpers reales** desde `app.js` en vez de
   stubearlos: un stub que devolviera 0 siempre haría pasar el cálculo de "nuevo" sin comprobarlo.
4. Un check de "detiene la propagación" **no miraba `stopPropagation`**: miraba que
   `_setAlertasTuDia` siguiera a `renderSidebar`. Existía y nunca comprobó lo que decía comprobar.
   Lo detectó la mutación que saca el `stopPropagation`.
5. Un check **constante-falso**: se escribió `\bspill\b` cuando la variable se llama `pill`. Como
   nunca matcheaba, fallaba siempre — y las mutaciones se reportaban como "detectadas" aunque el
   check no comprobaba nada. Se vio porque el test quedó rojo sobre el código **correcto**.

**El bug que solo apareció probando la app** (y que los tests NO cazaron)

El owner lo probó y el pillón **no apareció** al llegar un correo. La causa era de diseño:

- La línea base de "lo visto" **solo se escribía al hacer clic** en el indicador.
- Un owner que nunca hace clic se queda **sin línea base para siempre**.
- Sin línea base, `nuevo` da 0 siempre → el aviso era indistinguible de "no hay nada".
- Los tests estaban en verde porque **todos sembraban el `localStorage` antes de mirar el
  resultado**: probaban el caso fácil y dejaban el difícil sin ver.

**La solución tiene dos partes, y la segunda es la que faltaba:**

1. `init()` siembra la línea base con el número actual, **después** de cargar correos y eventos
   (sembrarla antes leería un `state.mails` vacío y guardaría 0, con lo cual todo lo que el owner
   ya tenía se le contaría como nuevo al abrir).
2. Un **escenario funcional** que arranca de un `localStorage` **vacío**, siembra, simula la
   llegada de un correo y exige que marque 1. Más un check que ata la siembra a `init()`, porque el
   bloque funcional llama a `_sembrarVistos()` a mano y por sí solo no comprueba que nadie la
   invoque en el arranque.

**El segundo bug que solo apareció probando la app** (este NO era lógica, era visual)

El owner volvió a probar y dijo: *"se actualiza correctamente mostrando los nuevos correos, pero no
se refleja lo deseado... muestre el contador 2, 3, 4 y el efecto rojo"*. O sea: el número llega
bien, **pero no se ve**.

- La primera versión tenía **una sola capa de aviso**: el número, a 9.5px, sobre un ícono de fondo
  azul clarito, sin sombra que lo despegara.
- Con una sola capa hace falta que el ojo **ya esté en esa fila**. Y "Tu día" se mira de reojo.
- El badge del shell que el owner señaló como referencia es 18px de alto, con sombra fuerte y
  tipografía pesada. Lo que hace que se note no es el número, es el **peso visual** del bloque.

**Ahora hay tres capas**, y con que se vea una sola ya se nota:

| Capa | Qué hace |
|---|---|
| 1 | La **fila completa** se tiñe de `--kair-red-soft` con una barra roja de 3px a la izquierda |
| 2 | El **ícono** se tiñe más fuerte (`#f8d3d8` con glifo `#a3212f`) |
| 3 | El **pillón**: 22×19px, `font-size: 11px`, `font-weight: 800`, **anillo blanco de 2px** |

El **anillo blanco** fue la pieza que faltaba: un rojo sobre un azul clarito se pierde, y el blanco
es lo que lo despega del fondo. La barra roja va inset (`top/bottom: 4px`) con radio de un solo
lado, porque pegada a los bordes asomaba por las esquinas redondeadas de la fila. Y la fila con
novedad conserva su feedback de hover, que el fondo rojo tapaba.

**La lección**: "el número está bien" y "se ve" son dos cosas distintas, y ningún test de lógica
distingue entre ellas. Un aviso que solo cambia un texto de 9.5px puede ser **correcto y
perceptualmente invisible**. La prueba de un aviso visual es que el owner lo vea, y la primera
prueba manual es la que lo destapó.

**La lección**: un test que siembra el estado antes de arrancar prueba el camino feliz por
construcción. El escenario que hay que probar es el que empieza **sin nada**.

**La segunda corrección del mismo bug: la línea base solo subía**

La primera corrección (sembrarla en `init()`) era necesaria pero no alcanzaba. Quedaba esta: el aviso
marcaba bien mientras el número **subiera**, y se apagaba en cuanto bajaba. La causa era que la
línea base guardada nunca se ajustaba hacia abajo.

| Momento | Sin leídos | Línea base | `nuevo` | Lo que veía el owner |
|---|---|---|---|---|
| Hizo clic | 4 | 4 | 0 | normal |
| Leyó en el celular | 0 | **4** (congelada) | 0 | normal |
| Llegó un correo nuevo | 1 | **4** | `max(0, 1-4)` = **0** | **no avisaba** |

Tenía que juntar **5 sin leídos** para que el aviso volviera a prender. Y despachar el correo
fuera de la app es exactamente como el owner lo hace: no era un caso raro, era el camino de todos
los días. El arreglo son dos líneas: cuando `actual < visto`, la base se reancla a `actual`, porque
si el número actual cayó por debajo de lo visto, ya no hay nada pendiente de su lado.

**Cómo se destapó, que es la parte importante**: el test ya tenía la comprobación *"si baja de la
línea base el aviso es 0, nunca negativo"*, y pasaba. El bug estaba **después** de ese `0`: la
comprobación miraba el valor instantáneo y se detenía ahí, sin preguntar qué pasaba en el paso
siguiente. Un test que afirma una propiedad en un instante no dice nada sobre la transición.

**La lección general**: cuando un contador o un aviso dependa de un valor previo, comprobar `f(x)`
no basta — hay que comprobar `f(x)` **y** `f(lo que viene después de x)`. El valor en sí puede ser
correcto y la transición estar rota. Es el mismo patrón del "mutante vacío": el test verde sobre
un caso que nunca se ejerce.

**Decisiones del owner** (no volver a preguntar)

- El toggle es un **switch que enciende/apaga las alertas**, no un filtro.
  → **CORREGIDO en la revisión siguiente**: el owner rechazó el switch y pidió el pillón.
- **"Invitaciones pendientes" se oculta** hasta que tenga fuente real (parseo del `.ics`).
- El aviso es el **PILLÓN rojo, no un switch**. La primera versión con switch fue rechazada.
- El **número grande sigue viniendo de Gmail**, independiente del servicio de notificaciones
  (*"este es independiente de las notificaciones, es para el correo"*).
- Al hacer clic se **marcan como leídas, y el 99+ también baja**.
- Cuando un aviso **parezca** a otro, hay que **investigar cómo está construido el otro**, no copiar
  lo que se ve. Tres versiones seguidas salieron de "copiar la captura" y las tres quedaron mal; la
  cuarta salió de leer el servicio.
- Se preguntó antes de codear y se procedió a ejecutar después del OK.
- **El aviso es el PILLÓN rojo, no un switch.** La primera versión con switch fue rechazada.

**Tests**

| Archivo | Checks | Mutation |
|---|---|---|
| `test-bandeja-tudia-853.js` | 75/75 | **35/35** |
| `test-bandeja-tudia-849.js` | 49/49 | — (checks invertidos + sandbox con el helper de 📦854) |
| `test-bandeja-premium-v2.js` | 48/48 | — (check invertido) |
| `test-bandeja-toolbar-compacta.js` | 51/51 | — (check invertido) |

Suite completa: 112 tests, 94 verdes, 18 preexistentes, **0 regresiones**.

---

### 2026-10-03 · Documentación (📦852)

**Qué se hizo** — tanda de mantenimiento documental puro. **Cero cambios en la app.**

| Qué | Detalle |
|---|---|
| Auditoría completa | Toda la documentación contrastada contra el código real |
| Reglas falsas eliminadas | `KairUI.esc()`, `KairHelpers.formatDate()`, "var no let/const", "último 📦579" |
| `PROMPT.md` v2.0 | Índice que referencia en vez de duplicar; documenta las 3 islas de paleta |
| `Historial.md` y `CLAUDE.md` | Nuevos, en la raíz del repo |
| `CONTEXT.md` | 68 líneas gigantes → 1 318 legibles, **md5 idéntico**, 0 caracteres perdidos |
| 3 trampas de `AGENTS.md` | Corregidas, incluida la del CSS que nunca existió |
| `PRODUCT.md` | Paleta, tipografía, dark mode y 2 afirmaciones falsas |
| Bump | `0.1.233` → `0.1.234` |

**Por qué** — la documentación era la fuente de verdad y mentía. Un modelo que siguiera sus reglas
al pie de la letra escribía llamadas a funciones inexistentes y la vista se caía.

**Bugs encontrados** — ninguno estaba en el código, todos los encontró la verificación:

1. **Un script de documentación iba a destruir el CHANGELOG.** Reemplazaba el encabezado
   `## [0.1.233]` sin reponerlo: las entradas 📦850 y 📦851 quedaban sin encabezado, absorbidas
   dentro de 0.1.234, y el script reportaba `OK`. Un encabezado no es una línea más — perderlo
   deja huérfano todo lo que viene después.
2. **La afirmación "ese CSS nunca estuvo en el repo" se verificó contra los 1 244 commits** de
   todas las ramas, no solo contra el árbol actual. Sin eso habría sido una presunción.
3. **Mi propio verificador mintió**: marcó "FALTA" a 3 documentos que sí existían, porque los
   buscó en `sgsst-electron-app/` y están en la raíz del repo.
4. **Dos palabras pegadas y dos términos en inglés** que casi van al CHANGELOG público.

**Decisiones del owner** (no volver a preguntar)

- Las **validaciones visuales** de v0.1.214, v0.1.215, 📦850 y 📦851 **ya fueron revisadas** y no
  tienen observaciones registradas. **No queda ninguna abierta.**
- Documentos nuevos en la **raíz del repo**, versionados junto a `PRODUCT.md`.
- "Nada es una regla hasta comprobarlo en el código" — regla de primer orden, no opcional.

**Tests** — ninguno nuevo. Suite sin cambios: 111 tests, 93 verdes, 18 preexistentes.

---

### 2026-10-09 · 📦881 · Bloque legal de la Ley 1581 (sin bump de versión)

**Qué se hizo** — una sola línea de trabajo con dos caras:

| Zona | Qué |
|---|---|
| `sgsst-electron-app/index.html` | El texto del consentimiento decía tratar **"historias clínicas, audiometrías, electrocardiogramas"**. K+AIR no maneja esos datos. Reemplazado por los que sí registra: **seguimientos médicos, consultas y certificados de aptitud médica** |
| `sgsst-electron-app/index.html` | Se separaron las dos autorizaciones del **art. 6**: datos personales → *previa*, expresa e informada; datos sensibles → *expresa e informada*. Antes decía que ambas eran "previas" |
| `sgsst-electron-app/index.html` | Se declaró el **art. 25**: la empresa que usa K+AIR es **responsable**, K+AIR es **encargado** |
| `sgsst-electron-app/styles.css` | Nueva clase `.kair-consent__aviso` (caja ámbar con borde izquierdo) |
| `sitio/anexo-encargo.html` | **Nuevo.** Anexo de Encargo de Tratamiento de Datos Personales (Decreto 1377) |
| `sitio/autorizacion-trabajadores.html` | **Nuevo.** Formato de autorización de trabajadores |
| `sitio/privacidad.html` | +127/-: párrafos de encargado y enlaces a los dos documentos nuevos |
| `sitio/terminos.html` | +85/-: párrafos de encargado y enlaces a los dos documentos nuevos |

**Por qué** — el consentimiento describía una app que atiende historias clínicas y ECG, y K+AIR no es eso. Un texto legal que miente sobre el tratamiento de datos sensibles es peor que uno vago: es el que se puedecuestionar.

**Verificaciones hechas antes de commitear** — ninguna asumida:

1. Los dos documentos nuevos **no están huérfanos**: ambos aparecen en la barra de navegación de `privacidad.html` y `terminos.html` (líneas 25-26) y se enlazan entre sí.
2. `sitio/index.html` **no** los enlaza. Aceptado: el par privacidad/términos actúa de hub, igual que ya pasaba con `soporte.html`.
3. `Dev` y `Dev-Pc` están **idénticas** (`git rev-list --count` da 0 en cada dirección), así que commitear en `Dev-Pc` no genera divergencia.
4. Local y remoto estaban sincronizados **antes** de tocar nada (0 y 0), lo que descarta que estos cambios vinieran de otra máquina.

**🔴 Hallazgo pendiente — CSS muerto.** `.kair-consent__aviso` se define en `styles.css:8961` y **no se referencia en ningún archivo del repo** (`grep` sobre `sgsst-electron-app/` devuelve un solo resultado: su propia definición). La clase parece creada para una caja de aviso en el modal que **nunca se agregó al HTML**. Se decidió **no borrarla ni usarla** en este commit: borrarla sería interpretar una intención que no está escrita, y usarla sería meter UI nueva en un flujo legal sin consultar. **Decisión del owner pendiente:** ¿se agrega el aviso al modal o se quita la clase?

**Tests** — ninguno nuevo. No hay suite que corra sobre `sitio/`, y la app solo cambió texto y una clase CSS sin uso. El estado de la suite sigue siendo el del 2026-10-07: **no se remedido**.

**Decisiones del owner** — la versión **no se bumpea**: `0.1.251` sigue igual, por la regla del 2026-10-07 ("la versión SOLO se bumpea cuando él lo diga"). El CHANGELOG tampoco se tocó: registra **versiones publicadas**, y esto todavía no está publicado — igual que el commit legal anterior `2ace3131`, que solo tocó `sitio/`.

**Commits** — uno solo, en `Dev-Pc`, con este mismo bloque de documentación.
---

### 2026-10-14 · 📦885 · El Panel de Control sigue el tema elegido (sin bump de versión)

**Qué se hizo** — el Panel de Control deja de estar pintado con la paleta clara en los dos modos
oscuros:

| Zona | Qué |
|---|---|
| `shared/kair-premium.css` | Nuevo bloque `[data-theme^="dark"]` al final del archivo. **141 líneas, puramente aditivo** |
| `index.html` | Cache-bust de `shared/kair-premium.css` a `20261014-panel885` |
| `main/test-panel-tema-885.js` | Test nuevo, 54 checks base |

**La causa, medida** — `shared/kair-premium.css` tenía **30 colores literales en 120 lugares y ni una
sola regla de tema**: cero `[data-theme]`, cero `prefers-color-scheme`. Las dos únicas reglas que sí
usaban tokens (`--kair-canvas` y `--kair-ink` en la raíz del bloque) los leían de `:root`, y
`kair-design-tokens.css` define la paleta **solo en `:root`**. El shell de alrededor sí tenía **439
bloques de tema** en `styles.css`: de ahí el marco oscuro rodeando un panel completamente blanco.

**Alcance verificado, no supuesto.** `.kair-premium` como clase wrapper se usa en **un solo sitio** de
todo el repo: `renderer.js:4766`. Los demás resultados del grep son `.kair-premium-strip`, que es otra
clase en módulos que no tienen que ver. El radio de impacto es exactamente el Panel de Control.

**Tres cosas que salieron mal al medirlas y quedaron corregidas.** No se escribió ningún color sin
comprobarlo, y las tres correcciones cambiaron el resultado:

1. **`--widget-bg-color` NO servía para la tarjeta.** En los dos temas oscuros es el **mismo color** que
   `--content-area-bg`, así que la tarjeta se fundía con el fondo. Las superficies se derivan de un velo
   de blanco al 5 % sobre el fondo del tema: da `#384151` en Sistema y `#292929` en Oscuro.
2. **`--text-lighter-color` NO pasa AA**: 3.61 en Sistema y 2.65 en Oscuro. Se dejó de usarlo y se
   redefinio `--kair-faint` por tema.
3. **Los tintes de chip al 18 % no pasaban**: el texto del chip caía a 4.23-4.35. Bajados al **8 %**, el
   peor caso es 4.73.

**El fondo usa el token del shell, `--content-area-bg`**, y no un hex propio: así el panel se pega al
chrome de su tema sin duplicar ningún valor.

**Sin `!important` en ninguna regla del bloque.** `[data-theme^="dark"] .kair-premium .x` es (0,2,1) contra
(0,2,0) de la regla clara, así que gana sola. El test falla si aparece uno.

**El tema claro no se tocó** y el bloque es aditivo: un check lee la parte clara del archivo y falla si
alguna vez declara una regla de tema. **`.kair-hero` tampoco**: su fondo es `#14213D` con texto blanco y
ya funciona en los tres temas.

**Contrastes medidos** (WCAG 2.1 AA, componiendo el `rgba()` antes de medir):

| | Sistema / Oscuro |
|---|---|
| título sobre tarjeta | 8.67 / 11.02 |
| subtítulo sobre tarjeta | 4.95 / 5.56 |
| terciario sobre tarjeta | 4.64 / 5.17 |
| acento sobre tarjeta | 4.02 / 5.43 |
| chip rojo (el peor caso) | 4.73 / 6.53 |

**Tests** — `test-panel-tema-885.js`: **54 checks base**, **15/15 mutaciones**, 0 vacías. El test no
comprueba "existe el bloque": **extrae las 58 clases que declaran color en la parte clara y exige que
cada una tenga contraparte oscura**, porque un check de existencia pasaría aunque se olvidara la mitad
de las tarjetas. Suite completa: **130 tests · 129 verdes · 1 con fallos**, cero regresiones.

**Artefacto** — `preview-panel-885.html` y `preview-panel-885-bajo.html`, generados por un script que lee
los archivos del disco y saca los iconos SVG de `renderer.js`. Cuatro paneles: ANTES (con el CSS de
HEAD), Sistema, Oscuro y Claro. El owner lo aprobó antes de commitear.

**Decisiones del owner** — se llevó el oscuro **completo**: superficies, texto, bordes y también los
tintes de los chips. Y se revisó **con artefacto antes de tocar el repo**, no directo en la app. La
versión **no se bumpea**: `0.1.251` sigue igual.

**Commits** — uno solo, con el código y la documentación juntos, en `Dev`. El hash no se escribe
aquí dentro del propio commit: un `--amend` lo cambiaría y la referencia quedaría apuntando a un
commit fantasma.

---

### 2026-10-14 · 📦887 · El módulo Recursos también sigue el tema (sin bump de versión)

**Qué se hizo** — el home de Recursos deja de quedar blanco en los dos modos oscuros, y con
él todo lo que consume los tokens `--kair-*`:

| Zona | Qué |
|---|---|
| `shared/kair-design-tokens.css` | **Dos bloques de tema nuevos**, `[data-theme="dark"]` y `[data-theme="dark-legacy"]`. **32 tokens de color, los dos.** Aditivos: `:root` no cambia |
| `shared/kair-components.css` | **Bloque `[data-theme^="dark"]`** para los once selectores que tenían el color escrito a mano. Ese archivo no tenía ni una regla de tema |
| `modules/recursos/recursos-home.js` | Ocho colores **inline** pasados a token. Un estilo en línea gana a cualquier hoja de estilo, así que por muchos tokens que se definan, esos ocho seguían grises sobre la tarjeta oscura |
| `index.html` | Cache-bust de los tres a `20261014-recursos887` y `RECURSOS-20261014-tema887` |
| `main/test-tokens-tema-887.js` | Test nuevo |

**La causa, medida** — no faltaban estilos oscuros: **el color nunca se definía por tema**.
`shared/kair-design-tokens.css` definía **treinta tokens de color en `:root` y cero
variantes**, y `shared/kair-components.css`, donde viven 25 de las 46 clases del home,
**no tenía ni una regla de tema**. Los dos archivos se cargan en `index.html` en las
líneas 71 y 72, o sea que **el módulo Recursos no carga ni un CSS propio**: lo que se ve
ahí viene entero de la base compartida.

**LA CAUSA DE VERDAD: LA CASCADA (esto es lo que faltó en el primer diagnóstico)**
— el diagnóstico de arriba es cierto pero **no era la razón de que las tarjetas salieran
blancas**. Los tokens oscuros sí se estaban entregando. Lo que pasaba es que **dos CSS de
módulo le ganaban la cascada**:

| Archivo | Qué declara | Se carga en |
|---|---|---|
| `modules/gestion-peligros/inspecciones/inspeccion.css` | `:root { --kair-card:#ffffff; --kair-text:#1a1a2e; --kair-shadow-card:… }` | `index.html:552` |
| `modules/verificacion/revision-alta-direccion/revision-alta-direccion.css` | `:root { --kair-surface:#ffffff; --kair-text:#212529; … }` | `index.html:490` |

`:root` y `[data-theme="dark"]` **empatan en especificidad (0,1,0)** y los dos matchean
`<html>`, así que **gana el que se carga último**. Los tokens del 887 se cargan en la línea
71; esos dos, en la 490 y la 552. Resultado: en los dos modos oscuros `--kair-card`
resolvía a `#ffffff` y `--kair-text` a `#1a1a2e`. Por eso las tarjetas salían blancas
**con el rótulo gris encima**: el `.kair-metric-head` sí tomaba `--kair-faint`, pero
`#9fb0c4` sobre blanco es casi ilegible. Es exactamente lo que se vio en las capturas.

Lo que lo prueba es que el **preview se veía bien y la app no**, y la diferencia estaba en
el preview: la primera versión armaba un bloque oscuro escrito a mano y **no cargaba el
`<style>` que `recursos-home.js` inyecta en runtime**, ni los `:root` tardíos. Era media
app. El artefacto se rehizo para usar los archivos reales en el orden real de `index.html`;
con esa corrección, el panel "antes" reproduce la captura del owner y el "después" ya sale
bien.

**El arreglo** — los dos bloques oscuros de `shared/kair-design-tokens.css` llevan ahora
también `:root[data-theme="dark"]` / `:root[data-theme="dark-legacy"]`, que valen **(0,2,0)**
y ganan contra cualquier `:root` sin importar el orden de carga. Se conserva el selector
pelado por si algún contenedor (y no `<html>`) lleva el atributo. El tema claro no se toca.

> La fuga de scope es de esos dos módulos, no de los tokens: el propio encabezado de
> `inspeccion.css` dice *"Scope en `.kair-app`"* y su bloque oscuro sí está scopado a
> `.kair-app`; lo que se escapa es el `:root` **claro**. Se corrige del lado de los tokens
> porque es el que no depende de ningún módulo.

Del home: 46 clases, **31 sin contraparte oscura**. De esas, **17 leen tokens** — o sea que
definir el token las arregla — y 6 tenían el color escrito a mano.

**El hallazgo más grande, y es de otro submódulo** — `capacitaciones-view.css` tiene **47
reglas de tema que no existen**. Apuntan a `.capacitaciones-container[data-theme="dark"]` y
fallan por partida doble:

1. El atributo `data-theme` se aplica a `document.documentElement` (`renderer.js`
   líneas 756, 762, 812, 820, 1719 y 1726), o sea a **`<html>`**. Nunca al contenedor.
2. La clase `.capacitaciones-container` **no existe** en el HTML de la vista.

O sea que **alguien ya había escrito el arreglo oscuro completo y no aplicaba nada** —
incluidos `--kair-card: #2d3748` y el `.kair-metric-head` que se ve gris sobre blanco. El
mismo error aparece una vez en `objetivos-sst-view.css`. **48 reglas muertas en el repo.**

En cambio **17 viewers sí hacen bien lo de poner el atributo en su contenedor**, y por eso
10 de los 14 CSS de submódulos sí tienen tema y funcionan. Los cuatro que no:
`copasst-home.css`, `comite-convivencia-home.css`, `inducciones-view.css` y
`roles-responsabilidades-view.css` (este último con **147 colores literales y cero
tokens**).

**La paleta, medida** — el thumb, el texto y el terciario se Taking del 📦884 y el 📦885, que
ya los midieron, para que el tema oscuro sea uno solo y no tres paletas parecidas. La
tarjeta usa **el mismo velo de blanco al 5 % que el Panel de Control desde el 885**, así que
el home y el panel se ven iguales. Contra la tarjeta real de cada tema:

| Medida | Sistema | Negro/Gris | Mínimo |
|---|---|---|---|
| Texto principal | 8.67 | 11.02 | 4.5 |
| Texto secundario | 4.95 | 5.56 | 4.5 |
| Texto auxiliar | 4.64 | 5.17 | 4.5 |
| Chip sobre su tinte | 7.34 | 7.34 | 4.5 |
| Acento azul | 3.95 | 6.96 | 3 |

Los bordes quedan por debajo de 3:1 (1.37 y 1.40) **a propósito**: WCAG 1.4.11 pide eso para
componentes de interfaz y estados, y un borde decorativo de tarjeta no es ninguno de los
dos. La separación la hace la propia superficie.

**Sobre 884 y 885** — estos tokens son de alcance general y los dos paquetes anteriores pisan
con selectores **más específicos** (`[data-theme^="dark"] #sidebar` y `[data-theme="dark"]
.kair-premium`). Los dos siguen mandando en su scope. El test lo comprueba.

**Un tropiezo propio, anotado para que no se repita** — al cambiar un color dentro de un
`style="..."` de `recursos-home.js`, un Edit metió el comentario **dentro del string** y
partió la línea de JavaScript en dos. Se detectó leyendo el diff, se restauró con
`git checkout` y se rehizo con el valor solo. **`node --check` sobre el archivo es la
verificación que faltaba** y ahora está en el flujo.

**Un segundo test frágil, este ya venía del repo** — bumpear el token de `recursos-home.js`
tumbó `test-chart-overflow.js` (19/20), porque su check tenía **el literal del token de los
siete homes** escrito a mano. El mismo repo ya había detectado y arreglado ese defecto en el
check vecino de `kair-components.css` — el comentario de las líneas 156-157 lo dice — pero no
lo aplicó al de los homes. Se aplicó el mismo criterio: ahora se pregunta si el token **tiene
forma** `PREFIJO-AAAAMMDD-descripcion`, no si es un valor concreto. Sigue detectando un home
sin versionar, que es lo que importa, y ya no se cae con el próximo paquete que toque uno.

**Tests** — `test-tokens-tema-887.js`: **100 checks base**, **22/22 mutaciones**, 0 vacías.
Contra el código anterior da **30/69**: el test detecta el bug. Cuatro cosas que un check de
"existe el bloque oscuro" no comprobaría:

1. **Cobertura.** Extrae los 32 tokens de color de `:root` y exige que **cada uno** tenga
   variante en los dos temas, y que **sea distinta** del claro. Si no, el bloque "existe" y
   media pantalla sigue blanca. Este check encontró un hueco real: `--kair-mint` se había
   quedado sin definir.
2. **Que el tema claro no se tocara.** Verifica uno por uno los doce valores originales de
   `:root`. Es un bloque aditivo y esto lo blinda.
3. **Que el contraste siga pasando.** Recalculado contra la tarjeta real, componiendo el velo.
4. **La cascada.** Exige que los dos bloques oscuros lleven `:root[data-theme=...]` (o sea,
   (0,2,0)) y que el selector pelado se conserve. Hay dos mutaciones que lo desarman y las dos
   muerden.

**Artefacto** — `preview-recursos-887.html`, generado por un script que lee los archivos del
disco y pone sus huellas SHA-256 en el pie. Cada tema en su propio `iframe` con `srcdoc`
porque el atributo vive en `<html>` y poner dos temas en una página mostraría algo que la app
nunca muestra. El owner lo aprobó antes de que se escribiera nada.

> **El artefacto se rehizo después de ver la app.** La primera versión se veía bien y la app
> no, y la diferencia estaba en el preview: armaba un bloque oscuro a mano y **no cargaba el
> `<style>` que `recursos-home.js` inyecta en runtime**, ni los dos `:root` tardíos. Era media
> app. El generador nuevo carga los archivos reales **en el orden real de `index.html`** y trae
> la hoja inyectada del módulo tal cual (16 506 caracteres leídos del disco). Con eso, el panel
> "antes" reproduce exactamente las capturas del owner y el "después" sale bien. Verificado en
> el navegador.

**Hallazgo colateral que NO se tocó** — en el **tema claro** hay texto que no pasa AA sobre
tarjeta blanca: `--kair-muted` da 3.98:1, `--kair-faint` **2.16:1** y `--kair-text-3`
2.58:1. El breadcrumb usa `--kair-faint`, o sea que hoy es casi ilegible en claro. Es
preexistente y de otro alcance: este paquete solo define las variantes oscuras. En el tema
Negro/Gris la tarjeta queda a **1.29:1** del fondo — es el mismo valor que ya aprobó el 885,
así que se mantiene igual y queda anotado como mejora futura.

**Commits** — uno solo, con el código y la documentación juntos, en `Dev`. El hash no se
escribe aquí dentro del propio commit: un `--amend` lo cambiaría y la referencia quedaría
apuntando a un commit fantasma.

---

### 2026-10-14 · 📦886 · Las barras de desplazamiento siguen el tema elegido (sin bump de versión)

**Qué se hizo** — la barra blanca sobre el fondo oscuro desaparece. La barra de
desplazamiento ahora toma su color de tokens que sí tienen variante por tema:

| Zona | Qué |
|---|---|
| `styles.css` | Tokens `--kair-scrollbar-thumb` / `--kair-scrollbar-track` en los tres bloques de tema; la regla global pasa a leerlos; los homes de los cuatro módulos principales dejan el `rgba(0,0,0,0.25)` fijo; y un override para Carpetas. Se **borraron 9** reglas `::-webkit-scrollbar` |
| `development-styles.css` | **7** reglas borradas, incluidas las tres `[data-theme="dark"]` que ya pretendían el oscuro |
| `modules/verificacion/definicion-indicadores/definicion-indicadores.css` | **12** reglas borradas |
| `modules/gestion-humana/carpetas/index.css` | **4** reglas borradas |
| `modules/gestion-humana/dashboard/index.css` | **4** reglas borradas |
| `modules/gestion-peligros/inspecciones/inspeccion.css` | **4** reglas borradas |
| `modules/gestion-peligros/mantenimiento/mantenimiento.css` | **4** reglas borradas |
| `index.html` | Cache-bust de los seis CSS a `20261014-scrollbar886` |
| `main/test-scrollbar-tema-886.js` | Test nuevo |

**La causa, medida** — no faltaba una regla oscura: **faltaba el concepto**. La
regla global de `styles.css` traía el par `#c1c9d0 / #f8f9fa` fijo, sin variante,
y ese par era lo que se veía en los tres temas.

Lo que hace el bug confuso es que **el archivo sí parecía tener el arreglo**:
había **44 reglas `::-webkit-scrollbar`** repartidas en los 7 CSS que `index.html`
carga, tres de ellas con su bloque `[data-theme="dark"]` propio. **Ninguna se
dibujaba.** La razón se comprobó en el navegador y no es de especificidad:
**cuando existe `scrollbar-color`, Chromium ignora todos los pseudo-elementos
`::-webkit-scrollbar`**, sin importar qué tan específico sea el selector. Se
montaron dos cajas idénticas salvo por tener, además del global, un thumb verde y
una pista negra: **se vieron iguales**. El `width: 8px` tampoco se aplicaba.

Por eso el arreglo fue **borrar** esas 44 reglas y no corregirlas: no se dibujaban,
y suhover y su `:active` no podían pasar de 2:1 de contraste.

**La paleta, medida** — el thumb de cada tema oscuro es su `--kair-faint`, el mismo
gris que el 📦885 dejó como texto secundario. Contra la superficie **más clara** de
cada tema, que es lo que importa (WCAG 1.4.11 pide 3:1 en componentes de interfaz):

| Tema | Thumb | Peor superficie | Resto |
|---|---|---|---|
| Oscuro (Sistema) | `#9fb0c4` | **3.40** contra `--border-color` #4a5568 | 4.64 tarjeta #384151 · 5.41 área #2d3748 · 7.37 fondo #1a202c |
| Oscuro (Negro/Gris) | `#9a9a9a` | **3.68** contra `--border-color` #404040 | 5.17 tarjeta #292929 · 5.92 área #1e1e1e · 6.66 fondo #121212 |

Las tarjetas del Panel se miden **componiendo** el velo de blanco al 5 % sobre el
fondo del área; sin componer, el número es falso. La **pista va transparente** en
los dos temas oscuros: así se ve la superficie real en vez de taparla con un
rectángulo de color, y de paso no aparece el problema de una pista casi invisible
contra el fondo. En **tema claro no se cambió nada**: el par sigue siendo
`#c1c9d0 / #f8f9fa`.

**Un detalle de especificidad** — `.carp-scope .carp-wrapper` (Carpetas) trae su
propio `scrollbar-color: #c1c8d0` con especificidad (0,2,0), que le gana al global.
Por eso en `styles.css` hay un bloque `[data-theme^="dark"] .carp-scope .carp-wrapper`
de (0,3,0): solo actúa en oscuro y **no toca el tema claro**, donde sigue mandando
el valor del módulo.

**Lo que NO se tocó, y por qué** — borrar de más rompe páginas enteras. El inventario
se rehízo **sin lista escrita a mano**: se recorren los 82 CSS y los 89 HTML del
proyecto, y cada CSS con `::-webkit-scrollbar` se clasifica según qué documento lo
cargue y si ese documento trae `styles.css`.

- **25 archivos con reglas VIVAS**: son las vistas `*-view.css`. Se abren como
  página aparte (`politica-logic.js` construye la URL y la navega), no se inyectan
  en el shell, así que **no reciben `styles.css`** y ahí sus reglas sí pintan.
- **5 archivos huérfanos**: nadie los carga. Uno de ellos es
  `modules/gestion-humana/documentos/index.css`, y no es un descuido: `index.html`
  lo dice en su propio comentario, 📦810 retiró esa vista y la carpeta se conserva a
  propósito.
- **La bandeja integrada**: ventana propia con su propio CSS. Se verificó que su
  `href="styles.css"` es el de **su** carpeta, no el de la raíz, así que es una isla
  aparte. Además no recibe `data-theme`.
- **El iframe de Configuración**: fuera del alcance por decisión del owner. Ya
  sigue el tema; se anota aparte que sus valores no llegan a 3:1.

**Tests** — `test-scrollbar-tema-886.js`: **88 checks**, **16/16 mutaciones**, 0
vacías. Contra el código previo al paquete da **45/78**: el test detecta el bug.
Tres cosas que el test hace y que un check de existencia no haría:

1. **Recalcula el contraste** desde los tokens del archivo, componiendo el velo del
   Panel. Si alguien sube la superficie más clara y no toca el thumb, se cae solo.
2. **Clasifica los 82 CSS solo**, sin lista escrita a mano, y exige que los que se
   pueden tocar queden en cero **y que los que no, sigan con sus reglas**.
3. **Exige que el thumb oscuro difiera del claro.** Que el contraste pase no basta:
   con el thumb claro `#c1c9d0` el ratio da 4.49, o sea que un test que solo mirara
   el contraste lo daría por bueno — pero el owner seguiría viendo una barra clara.

**Artefacto** — `preview-scrollbar-886.html`, generado por un script que lee los
archivos del disco y pone sus huellas SHA-256 en el pie. Muestra el antes y el
después por tema con cajas de scroll reales, la tabla de contrastes y la lista de lo
que se dejó quieto.

**Decisiones del owner** — alcance limitado al documento principal y borrado de las
reglas anuladas; el iframe de Configuración se deja como está. **Sin bump de
versión**: `0.1.251` sigue igual.
**Commits** — dos, ambos ya pusheados a `Dev` y `Dev-Pc`: `ed59ba80` (📦885) y `e5f95ae4` (📦886).

---

### 2026-10-14 · 📦884 · Los tonos del menú lateral en los dos modos oscuros (sin bump de versión)

**Qué se hizo** — el arreglo del menú lateral, rehecho desde la causa real:

| Zona | Qué |
|---|---|
| `shared/kair-sidebar.css` | Nuevo bloque `[data-theme^="dark"] #sidebar` con los seis tokens que el componente consume, más la jerarquía de peso del estado activo |
| `styles.css` | `--sidebar-text-color` en los dos bloques de tema oscuro. **14 líneas, todo aditivo** |
| `index.html` | Cache-bust de `shared/kair-sidebar.css` a `SIDEBAR-20261014-dark-tokens884` |
| `main/test-sidebar-tonos-884.js` | Test nuevo, 82 checks |

**Por qué el arreglo anterior no se veía** — aplicó el cambio sobre `.k-module-title` y
`.sidebar-module-card`, **dos clases que el menú actual no produce**. El menú se renderiza con
`kair-nav-*` (`renderer.js:4167-4187`) y se estiliza en `shared/kair-sidebar.css`; en
`renderer.js` no hay ni una coincidencia de `k-module-title`, y la clase `active` a secas solo se
**quita** (`renderer.js:4539`), nunca se pone. El CSS estaba bien escrito y no movía nada de lo que
se ve en pantalla. Peor: el preview anterior se construyó con esas mismas clases, así que
**mostraba el arreglo en vez de la app**.

**La causa real** — `shared/kair-design-tokens.css` define la paleta **solo en `:root`**. El bloque
`[data-theme^="dark"]` que documenta `design_system.md:335` **nunca se escribió en el CSS**. Como
`kair-sidebar.css` usa únicamente esos tokens, en los dos temas oscuros el menú se pintaba con los
valores del tema claro, mientras el fondo sí cambiaba (viene de `--sidebar-bg-color`, que sí tiene
bloques de tema). **Dos sistemas de tokens mezclados.**

**La otra mitad del bug, invisible hasta que se miró la pantalla** — `--kair-soft` la usan tanto
`:hover` como `--active`, y en claro es `#f3f6f6`, un casi blanco. Sobre fondo oscuro pintaba un
bloque claro. **Esa era la "tarjeta blanca duplicada"**: no era un elemento duplicado, era el
estado activo. El fix la elimina porque el velo pasa a ser 12 % de blanco.

**Contrastes medidos** — WCAG 2.1 AA, componiendo el `rgba()` sobre su fondo opaco antes de medir:

| | antes Sistema / Oscuro | después Sistema / Oscuro |
|---|---|---|
| título inactivo | 1.02 / 1.24 | **13.62 / 16.53** |
| subtítulo y header de sección | 4.10 / 4.97 | **7.93 / 9.62** |
| título activo | 2.42 / 2.94 | **7.90 / 10.46** |
| icono inactivo | 1.17 / 1.42 | **9.44 / 11.46** |

**Dos decisiones que se apartan de lo acordado, y por qué**

1. **El título inactivo baja a 600 y el activo queda en 700.** `.kair-nav-card__title` ya era 700
   para *todos* los ítems, así que subir solo el activo a 700 no habría marcado nada.
2. **No se apagó el subtítulo activo al 75 %.** Medido: cae a **3.81**, por debajo del 4.5 que AA
   exige a texto de 12 px. Un cambio de estado no puede dejar ilegible el ítem que el usuario
   está mirando. La señal la pasan el peso y la superficie.

**Alcance deliberado: `#sidebar`, no `:root`** — esos tokens se usan 287 veces en 27 archivos y
muchos módulos traen superficie blanca propia; redefinirlos globalmente pondría texto claro
sobre tarjeta blanca. Cuando esos módulos migren a superficie oscura, el bloque puede subir a
`:root` sin más.

**Tests** — `test-sidebar-tonos-884.js`: **82/82**, **15/15 mutaciones**, 0 vacías. Incluye el
check que habría atrapado el error anterior: toda clase que toca el bloque oscuro tiene que
existir en el marcado que produce `renderer.js`. Además se corrrió **contra el código viejo**
(HEAD, sin el arreglo) en un laboratorio aparte y da **37/77**: el test sí muerde.
Suite completa: **129 tests · 128 verdes · 1 con fallos**, cero regresiones; el rojo sigue siendo
`test-firma-constancia-consolidada.js` esperando `INTERNAL_API_KEY`.

**Artefacto** — `preview-tonos-884.html`, generado por un script que **lee los archivos del disco**
y trae sus huellas SHA-256 en el pie. Cuatro paneles: ANTES (con el CSS de HEAD), Sistema,
Oscuro y Claro. El owner lo aprobó.

**Decisiones del owner** — la versión **no se bumpea**: `0.1.251` sigue igual.

**Commits** — **uno solo**, con el código y la documentación juntos, en `Dev`, pusheado a `Dev` y `Dev-Pc`. El hash no se escribe dentro del propio commit: un `--amend` lo cambiaría y la referencia quedaría apuntando a un commit fantasma.


---

## 📝 Plantilla para una entrada nueva

```markdown
### AAAA-MM-DD · <tema> (📦<n>)

**Qué se hizo** — tabla: paquete → qué
**Por qué** — el pedido o el síntoma, en una frase
**Tests** — archivos, checks y mutaciones
**Decisiones del owner** — lo que confirmó, para no volver a preguntar
**Bugs encontrados** — los que no estaban en el código, y cómo los cazó el test
**Archivos tocados**
**Commits** — hash, paquete, y si se pusheó
```

---

## 🔻 Regla de cierre (obligatoria)

**Antes de terminar cualquier trabajo o sección, el modelo DEBE preguntar al owner:**

> "¿Querés que actualice los documentos (`Historial.md`, `PROMPT.md`, `CONTEXT.md`) para la próxima jornada?"

**No cerrar la sesión sin haberlo preguntado.** Sin esa pregunta, el próximo modelo arranca sin
saber qué se hizo, qué quedó a medias ni qué está bloqueado — y ese es exactamente el problema
que este archivo existe para evitar.

Al owner le corresponde responder. Si dice que sí, se actualizan:

| Documento | Qué se escribe |
|---|---|
| `Historial.md` | Bloque de estado + entrada de la jornada |
| `PROMPT.md` | Si apareció una regla nueva de proceso o una trampa nueva |
| `CONTEXT.md` | Si cambió el estado del proyecto o el foco |
| `BITACORA.md` | La lección del bug, con su "por qué se rompió" |
| `CHANGELOG.md` + `README.md` + `release-notes.md` | Al commitear, no al cerrar |

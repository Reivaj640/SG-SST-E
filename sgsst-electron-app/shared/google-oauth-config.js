/* 📦868 · Configuración OAuth de la APLICACIÓN (no del usuario).
 *
 * ⚠️  ESTE ARCHIVO VA VACÍO A PROPÓSITO. No pegues las credenciales acá.
 *
 * Esto NO es una credencial de la persona que usa K+AIR: es la identificación de
 * K+AIR ante Google. Todos —vos y cada cliente— conectan SU PROPIA cuenta de
 * Gmail con este mismo par, igual que cualquier botón "iniciar sesión con Google".
 *
 * ── Por qué este archivo está vacío y las credenciales viven en el `.env` ──────
 *
 * El bug original: las credenciales vivían solo en un `.env`, que está en
 * `.gitignore`, así que NO viajaba con el instalador. En la máquina del owner
 * andaba porque alguien había creado ese archivo a mano; en cualquier otra máquina
 * no. El único síntoma era un error de Google que no menciona K+AIR, más un flow
 * de autorización que quedaba colgado.
 *
 * La tentación obvious fue pegar las credenciales acá y versionarlas. GitHub la
 * bloqueó: el repo es PÚBLICO y el push protection detecta el `client_secret`
 * (GH013, "Push cannot contain secrets").
 *
 * Y el repo no puede quedar privado así, porque eso rompería el auto-updater:
 * `package.json` declara `publish: {provider: "github"}` y electron-updater pega
 * a la API de releases de GitHub SIN token. En un repo privado esa API devuelve
 * 404 y TODOS los clientes dejarían de recibir actualizaciones.
 *
 * O sea: repo público ⇒ el secret no puede estar en el historial.
 *
 * ── La solución: el `.env` de la máquina que compila ─────────────────────────
 *
 * Las credenciales reales viven en `sgsst-electron-app/.env`, que:
 *   - está en `.gitignore`, así que nunca entran al repo;
 *   - electron-builder NO lo excluye de los archivos del app (verificado: 0 reglas
 *     de `build.files` lo filtran), así que VIAJA DENTRO del instalador;
 *   - por lo tanto le llega al cliente final sin que configure nada.
 *
 * Para desarrollo en esta misma máquina, el mismo `.env` sirve.
 *
 * Si se compila en una máquina sin ese archivo, `npm run build` se CORTA solo
 * (`prebuild` → `main/_verificar-credenciales-build.js`). Es preferible que el
 * build falle ahí a que salga un instalador donde el correo no conecta.
 *
 * ── Sobre el `client_secret` — CORREGIDO 2026-10-06 ──────────────────────────
 *
 * Durante un rato se creyó que el secret era OPCIONAL, y quedó escrito así
 * en este mismo archivo y en `.env.example`. La razón era `google-auth-library`:
 * tiene `ClientAuthentication.None`, que hace que la librería NO mande el
 * secreto en el body. Todo cuadraba leyendo el código.
 *
 * **Pero leer la librería no es verificar el servicio.** El día que se probó la
 * autorización real, Google aceptó los 5 permisos y el canje devolvió:
 *     {"error":"invalid_request","error_description":"client_secret is missing."}
 * El síntoma era el peor: el navegador decía "Autorización exitosa", el cliente
 * había autorizado todo, y al final se perdía la conexión. Media conexión.
 *
 * Que Google entregue un secreto "de escritorio" no lo vuelve secreto: la app es
 * un binario que cualquiera puede abrir, y el mismo Google lo baja junto con su
 * `client_secret_*.json`. El problema nunca fue la seguridad del valor, sino que
 * faltaba y la app fingía que no.
 */

var OAUTH_CONFIG = {
  // Las credenciales van en el `.env` de la máquina que compila (ver la cabecera).
  clientId: '',

  // El endpoint de canje de Google lo EXIGE. Mismo `.env`.
  clientSecret: '',

  // Puerto y callback del servidor local que recibe la autorización.
  // El puerto tiene que coincidir con el "Authorized redirect URI" de Google:
  // http://127.0.0.1:42813/oauth2callback
  redirectPort: 42813,
  redirectUri: 'http://127.0.0.1:42813/oauth2callback'
};

/** ¿Se puede completar el flujo de Google? Necesita LAS DOS credenciales.
 *
 *  Con solo el client_id el flujo arrancaba igual —el navegador se abría, el
 *  usuario autorizaba los 5 permisos— y moría en el último paso. Mejor que la
 *  opción de correo no se ofrezca antes que ofrecerla y romperla al final.
 *
 *  OJO: este `available` es el de las credenciales EN ARCHIVO. El que manda es el
 *  de `google-auth.js`, que ya aplicó el override del `.env` antes de leer este
 *  archivo. Acá está vacío a propósito (repo público), así que este valor
 *  describe el archivo, no la app en ejecución.
 */
OAUTH_CONFIG.available = !!(OAUTH_CONFIG.clientId && OAUTH_CONFIG.clientSecret);

module.exports = OAUTH_CONFIG;
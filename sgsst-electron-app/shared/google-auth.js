// F3.A — Google OAuth2 client + Authorization Code flow con PKCE.
// Patrón: app de escritorio (Electron) usa "installed app" flow con
// loopback redirect (http://127.0.0.1) y servidor HTTP temporal
// que captura el callback.
//
// CREDENCIALES: configuradas en el proyecto "KAIR Calendar Sync"
// de Google Cloud (organización adminkair-org).
//   - Client ID: TU_NUEVO_CLIENT_ID_AQUI.apps.googleusercontent.com
//   - Scopes: calendar + gmail.readonly
//
// FLUJO:
//   1. UI llama a googleAuth.startAuth() → devuelve { authUrl, port }
//   2. UI abre la URL en el browser (shell.openExternal) y arranca
//      un listener HTTP en `port` para el callback
//   3. Google redirige a http://127.0.0.1:port/?code=XXX&scope=YYY
//   4. El listener captura el code, llama a googleAuth.exchangeCode(code, port)
//   5. exchangeCode() intercambia el code por tokens (access + refresh)
//   6. Tokens se persisten en config.json via google-tokens.js

const { google } = require('googleapis');
const crypto = require('crypto');
const http = require('http');
const url = require('url');
const tokensStore = require('./google-tokens');

// CREDENCIALES — Proyecto "KAIR Calendar Sync" en Google Cloud
const CLIENT_ID = 'TU_NUEVO_CLIENT_ID_AQUI.apps.googleusercontent.com';
const CLIENT_SECRET = 'TU_NUEVO_CLIENT_SECRET_AQUI';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.readonly',
  // F1.B-fix — Scopes necesarios para ENVIAR correos (Reply / Reply all / Forward / Nuevo)
  'https://www.googleapis.com/auth/gmail.send',
  // F1.B-fix — Para crear/editar/eliminar borradores (futuro: drafts)
  'https://www.googleapis.com/auth/gmail.compose'
];

// Puerto fijo para el loopback redirect (debe estar registrado en Google Cloud Console)
// IMPORTANTE: en Google Cloud Console > Credentials > OAuth 2.0 Client IDs >
// el client "Desktop app" debe tener agregado "http://127.0.0.1:42813" como
// Authorized redirect URI. Si no está, el flujo falla con "redirect_uri_mismatch".
const REDIRECT_PORT = 42813;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/oauth2callback`;

/**
 * Genera un code_verifier + code_challenge para PKCE (recomendado por Google
 * para apps de escritorio que no pueden guardar un client secret de forma segura).
 */
function generatePKCE() {
  const verifier = crypto.randomBytes(64).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/**
 * Construye un OAuth2 client con las credenciales del proyecto.
 * No requiere que haya tokens aún — se pueden setear después.
 */
function createOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

/**
 * Inicia el flujo de autorización. Genera:
 *   - authUrl: URL para abrir en el browser (con PKCE challenge)
 *   - verifier: code_verifier (hay que guardarlo hasta el exchange)
 *   - state: token CSRF para validar el callback
 *   - port: puerto del loopback redirect
 *
 * El caller (main process) debe:
 *   1. Guardar `verifier` y `state` en memoria
 *   2. Abrir `authUrl` en el browser del usuario
 *   3. Levantar un HTTP server en `port` que escuche el callback
 *   4. Cuando llegue el callback, validar `state` y llamar a `exchangeCode`
 */
function startAuth() {
  const oauth2Client = createOAuth2Client();
  const { verifier, challenge } = generatePKCE();
  const state = crypto.randomBytes(16).toString('hex');

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',          // Pedir refresh_token
    prompt: 'consent',                // Forzar pantalla de consentimiento (para refresh_token)
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: state,
    // include_granted_scopes: 'true' // opcional
  });

  return {
    authUrl: authUrl,
    verifier: verifier,
    state: state,
    port: REDIRECT_PORT,
    redirectUri: REDIRECT_URI
  };
}

/**
 * Intercambia el `code` de autorización por tokens (access + refresh).
 * Setea los tokens en el `oauth2Client` y los persiste en config.json.
 *
 * @param {Object} options
 * @param {string} options.code - code recibido en el callback
 * @param {string} options.verifier - PKCE verifier (del startAuth)
 * @param {string} options.expectedState - state que se generó (validar contra el del callback)
 * @param {string} options.actualState - state recibido en el callback
 * @param {string} options.configPath - ruta al config.json para persistir tokens
 *
 * @returns {Promise<{success: boolean, tokens?: object, error?: string}>}
 */
async function exchangeCode(options) {
  const { code, verifier, expectedState, actualState, configPath } = options;

  // Validar state (CSRF protection)
  if (expectedState && actualState && expectedState !== actualState) {
    return { success: false, error: 'State mismatch (posible CSRF attack)' };
  }

  const oauth2Client = createOAuth2Client();
  try {
    const { tokens } = await oauth2Client.getToken({
      code: code,
      codeVerifier: verifier
    });

    // Persistir en config.json
    if (configPath) {
      tokensStore.saveTokens(configPath, tokens);
    }

    return { success: true, tokens: tokens };
  } catch (e) {
    console.error('[GoogleAuth] Error en exchangeCode:', e.message);
    return { success: false, error: e.message || 'Error desconocido en token exchange' };
  }
}

/**
 * Refresca el access_token usando el refresh_token guardado.
 * Devuelve los nuevos tokens o null si falla.
 */
async function refreshAccessToken(configPath) {
  const stored = tokensStore.loadTokens(configPath);
  if (!stored || !stored.refresh_token) {
    return { success: false, error: 'No hay refresh_token guardado. Re-autorizar.' };
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: stored.refresh_token,
    access_token: stored.access_token
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    // credentials puede no incluir refresh_token (Google no lo devuelve en refresh)
    // preservamos el refresh_token viejo
    if (!credentials.refresh_token && stored.refresh_token) {
      credentials.refresh_token = stored.refresh_token;
    }
    tokensStore.saveTokens(configPath, credentials);
    return { success: true, tokens: credentials };
  } catch (e) {
    console.error('[GoogleAuth] Error refrescando token:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Helper para crear un OAuth2Client ya autorizado (con tokens cargados).
 * Si los tokens están expirados, intenta refrescarlos automáticamente.
 * Devuelve null si no hay tokens guardados.
 */
async function getAuthorizedClient(configPath) {
  const stored = tokensStore.loadTokens(configPath);
  if (!stored || !stored.access_token) return null;

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(stored);

  // Si el token está expirado, refrescar
  if (stored.expiry_date && Date.now() > stored.expiry_date) {
    if (!stored.refresh_token) {
      console.warn('[GoogleAuth] Token expirado y no hay refresh_token. Re-autorizar.');
      return null;
    }
    const refreshResult = await refreshAccessToken(configPath);
    if (!refreshResult.success) return null;
    oauth2Client.setCredentials(refreshResult.tokens);
  }

  return oauth2Client;
}

/**
 * Crea un HTTP server temporal que escucha el callback OAuth en
 * `http://127.0.0.1:port/oauth2callback`. Cuando llega, captura el
 * `code` y `state`, y resuelve la promise.
 *
 * Devuelve un objeto { promise, close() }. El caller debe llamar a
 * close() después de procesar el callback para liberar el puerto.
 */
function createCallbackServer(port) {
  let server = null;
  let resolveCallback;
  const promise = new Promise((resolve) => {
    resolveCallback = resolve;
  });

  function handle(req, res) {
    const parsed = url.parse(req.url, true);
    if (parsed.pathname !== '/oauth2callback') {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const code = parsed.query.code;
    const state = parsed.query.state;
    const error = parsed.query.error;

    // Página de éxito/error que se muestra al usuario en el browser
    const html = error
      ? `<html><body style="font-family:system-ui;padding:40px;text-align:center;"><h1>❌ Error de autorización</h1><p>${error}</p><p>Podés cerrar esta ventana.</p></body></html>`
      : `<html><body style="font-family:system-ui;padding:40px;text-align:center;"><h1>✅ Autorización exitosa</h1><p>Ya podés cerrar esta ventana y volver a K+AIR.</p><script>setTimeout(()=>window.close(),1500);</script></body></html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);

    if (resolveCallback) {
      resolveCallback({ code, state, error });
      resolveCallback = null;
    }

    // Auto-cerrar el server después de 1 segundo
    setTimeout(() => {
      try { if (server) server.close(); } catch (e) {}
    }, 1000);
  }

  server = http.createServer(handle);
  server.listen(port, '127.0.0.1', () => {
    console.log(`[GoogleAuth] Callback server escuchando en http://127.0.0.1:${port}/oauth2callback`);
  });

  // Timeout de seguridad: 5 min sin callback → cerrar
  const timeoutId = setTimeout(() => {
    if (resolveCallback) {
      resolveCallback({ code: null, state: null, error: 'timeout' });
      resolveCallback = null;
    }
    try { if (server) server.close(); } catch (e) {}
  }, 5 * 60 * 1000);

  return {
    promise,
    close() {
      clearTimeout(timeoutId);
      try { if (server) server.close(); } catch (e) {}
    }
  };
}

module.exports = {
  CLIENT_ID,
  CLIENT_SECRET,
  SCOPES,
  REDIRECT_URI,
  REDIRECT_PORT,
  startAuth,
  exchangeCode,
  refreshAccessToken,
  getAuthorizedClient,
  createCallbackServer
};

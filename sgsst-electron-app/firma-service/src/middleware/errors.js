/**
 * Middleware: manejador de errores central.
 *
 * - Captura errores thrown o next(err).
 * - Devuelve JSON con el formato estándar de error.
 * - EXCEPCIÓN en la superficie pública del firmante (/s/* y /api/sign/*):
 *   si el cliente prefiere HTML, devuelve una página legible en vez de JSON
 *   crudo. Fuera de ahí siempre JSON (ver isPublicSignerPath).
 * - Loguea el error completo server-side; al cliente solo lo seguro.
 */
'use strict';

const logger = require('../utils/logger');

class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.expose = true;
  }
}

// =============================================================================
// Superficie pública del firmante: página HTML en vez de JSON crudo
// =============================================================================

/**
 * Rutas donde el destinatario de la respuesta puede ser un NAVEGADOR.
 *
 * En estas rutas, un error se puede servir como una página legible (que es lo
 * que necesita el firmante que reabre el enlace) o como el sobre JSON (que es
 * lo que necesita cualquier programa).
 *
 * La elección la hace `prefersHtml`, que mira el `Accept`.
 *
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isPublicSignerPath(req) {
  const path = (req.path || '').split('?')[0];
  return path === '/s' || path.indexOf('/s/') === 0 || path.indexOf('/api/sign/') === 0;
}

/**
 * ¿El cliente quiere la página HTML en vez del sobre JSON?
 *
 * EL ORDEN DE LA LISTA ES LA DECISIÓN
 * ----------------------------------
 * Express devuelve el primer tipo de la lista que el cliente acepte, y
 * desempata por el orden cuando las calidades son iguales. Por eso el orden
 * importa, y por eso la lista empieza por 'json':
 *
 *   - Un navegador manda `text/html,application/xhtml+xml,application/xml;q=0.9`
 *     y un comodín con q=0.8. Para 'text/html' la calidad es 1; para
 *     'application/json' el comodín da 0.8. Gana HTML: el firmante ve la
 *     página. ✓
 *   - Un cliente de programa manda un Accept comodín (lo que hacen curl y
 *     fetch por defecto) o no manda nada. Para los dos tipos la calidad es
 *     1, y el desempate es por orden: gana JSON. ✓
 *   - Un cliente que pide `application/json` explícitamente recibe JSON. ✓
 *
 * Con la lista al revés ('html' primero) un Accept comodín se llevaba HTML
 * donde esperaba JSON: el parseo fallaba en silencio y lejos de la causa
 * real. La mini-app se salvaba porque ponía el header a mano, pero el
 * siguiente cliente programático que no lo pusiera se comía una página.
 *
 * @returns {boolean} true si el cliente acepta HTML antes que JSON.
 */
function prefersHtml(req) {
  if (typeof req.accepts !== 'function') return false;
  try {
    return req.accepts(['json', 'html']) === 'html';
  } catch (_) {
    return false;
  }
}

/** Escapa cualquier valor antes de interpolarlo en HTML. */
function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Copy por código de error. El texto es para una persona, no para un
 * integrator: los AppError de dominio llevan mensajes internos en inglés
 * ("La solicitud está en estado terminal 'SIGNED'") que aquí NO se usan.
 *
 * `canVerify` indica si tiene sentido ofrecer la verificación de autenticidad.
 * El endpoint /verify usa `permitirHistorico`, así que sigue respondiendo
 * para enlaces vencidos o ya usados. Para TOKEN_NOT_FOUND no hay nada que
 * verificar y ofrecerlo sería una promesa falsa; para CONSERVACION_VENCIDA
 * la verificación responde lo mismo, así que ofrecerla también sería falso.
 *
 * 8A.1: se añadieron tres estados que el sistema antes mezclaba.
 *
 *   TOKEN_NOT_FOUND        No se confirma la existencia: la misma respuesta
 *                          para un token que nunca existió y para uno que ya
 *                          no se puede mostrar.
 *   TOKEN_EXPIRED          Venció la VENTANA PARA FIRMAR. El documento que
 *                          se firmó antes sigue verificable.
 *   CONSERVACION_VENCIDA   Venció el PLAZO DE CONSERVACIÓN (numeral 10.6):
 *                          el dato se debe suprimir y el sistema no puede
 *                          seguir afirmando que la firma está vigente.
 */
const PUBLIC_ERROR_COPY = {
  TOKEN_NOT_FOUND: {
    title: 'No disponible',
    body: 'Este enlace no está disponible. No se puede confirmar si corresponde a alguna solicitud de firma: puede que se haya copiado incompleto al reenviarlo o al abrirlo desde el correo.',
    hint: 'Revisa el enlace completo que llegó a tu correo o pide uno nuevo al área de Recursos Humanos.',
    canVerify: false,
  },
  TOKEN_EXPIRED: {
    title: 'Este enlace ya venció',
    body: 'La solicitud de firma tenía una fecha límite y ya pasó. Que se venza el enlace no afecta lo que habías firmado antes.',
    hint: 'Si ya habías firmado, abre la verificación del documento: sigue disponible aunque el enlace haya vencido. Si no alcanzaste a firmar, pide un enlace nuevo al área de Recursos Humanos.',
    canVerify: true,
  },
  TOKEN_ALREADY_USED: {
    title: 'Este enlace ya se usó',
    body: 'La firma asociada a este enlace ya se completó. Cada enlace de firma sirve para una sola vez.',
    hint: 'Puedes abrir la verificación del documento para confirmar su autenticidad. Si no fuiste tú quien firmó, comunícate con el área de Recursos Humanos.',
    canVerify: true,
  },
  CONSERVACION_VENCIDA: {
    title: 'No disponible por vencimiento del plazo',
    body: 'Venció el plazo de conservación que la empresa fijó para este documento, así que la evidencia de la firma ya no está disponible. El plazo lo declara la empresa y K+AIR lo respeta.',
    hint: 'Si necesitas una copia de lo que firmaste, pídela al área de Recursos Humanos de la empresa: es quien conserva la información.',
    canVerify: false,
  },
};

const PUBLIC_GENERIC_COPY = {
  title: 'No pudimos mostrarte esta información',
  body: 'Ocurrió un problema al procesar tu solicitud. Esto no afecta la validez de tus documentos.',
  hint: 'Intenta abrir el enlace de nuevo en unos minutos. Si el problema continúa, comunícate con el área de Recursos Humanos.',
  canVerify: false,
};

/** Un token es base64url. Cualquier otra cosa no es un token y no se refleja. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

/**
 * Construye el enlace a la verificación de autenticidad, o null si no aplica.
 *
 * Desde /s/<token> se usa una URL RELATIVA (?verificar=1): el token ya está en
 * la barra de direcciones del firmante y no hace falta volver a escribirlo en
 * el HTML que se le devuelve.
 *
 * @param {string} path ruta ya normalizada de la petición
 * @returns {string|null}
 */
function buildVerifyUrl(path) {
  // No ofrecer verificación desde la propia pantalla de verificación: el botón
  // llevaría a sí mismo y, si el fallo se repite, a un bucle.
  if (/^\/api\/sign\/[A-Za-z0-9_-]{1,256}\/verify(?:-pdf)?$/.test(path)) return null;

  const fromApi = path.match(/^\/api\/sign\/([A-Za-z0-9_-]{1,256})(?:\/|$)/);
  if (fromApi && TOKEN_PATTERN.test(fromApi[1])) {
    return '/s/' + fromApi[1] + '?verificar=1';
  }

  const fromSigner = path.match(/^\/s\/([A-Za-z0-9_-]{1,256})$/);
  if (fromSigner && TOKEN_PATTERN.test(fromSigner[1])) {
    return '?verificar=1';
  }

  return null;
}

/**
 * Renderiza la página de error y la envía con cabeceras defensivas.
 *
 * La página es autocontenida: estilos inline, cero recursos externos. El
 * errorHandler puede dispararse en cualquier ruta —incluidas las de /api/*,
 * donde un <link> relativo a styles.css apuntaría a un lugar que no existe—,
 * así que no puede depender de la mini-app.
 *
 * @param {import('express').Response} res
 * @param {{ statusCode: number, code: string|null, requestId: string }} ctx
 */
function renderPublicHtml(res, ctx) {
  const copy = (ctx.code && PUBLIC_ERROR_COPY[ctx.code]) || PUBLIC_GENERIC_COPY;
  const verifyUrl = copy.canVerify ? buildVerifyUrl(ctx.path || '') : null;

  const cta = verifyUrl
    ? '      <a class="btn" href="' + escapeHtml(verifyUrl) + '">Verificar mi documento</a>'
    : '';

  const html = [
    '<!DOCTYPE html>',
    '<html lang="es">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<meta name="robots" content="noindex, nofollow">',
    '<title>K+AIR - Firma electrónica</title>',
    '<style>',
    '  :root {',
    '    --primary: #1e40af; --text: #1f2937; --muted: #6b7280; --bg: #f9fafb;',
    '    --card: #ffffff; --border: #e5e7eb;',
    '    --error-bg: #fee2e2; --error-text: #991b1b;',
    '  }',
    '  * { box-sizing: border-box; }',
    '  body {',
    '    margin: 0; background: var(--bg); color: var(--text);',
    '    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
    '    line-height: 1.5; -webkit-font-smoothing: antialiased;',
    '  }',
    '  main { max-width: 640px; margin: 0 auto; padding: 24px 16px 48px; }',
    '  header { text-align: center; margin-bottom: 32px; padding: 24px 0;',
    '           border-bottom: 1px solid var(--border); }',
    '  h1 { margin: 0; font-size: 32px; font-weight: 700; color: var(--primary);',
    '       letter-spacing: -0.02em; }',
    '  .subtitle { margin: 4px 0 0; font-size: 14px; color: var(--muted);',
    '              text-transform: uppercase; letter-spacing: 0.05em; }',
    '  .card { background: var(--card); border-radius: 8px; padding: 24px;',
    '          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); }',
    '  .alert { background: var(--error-bg); color: var(--error-text);',
    '           padding: 16px; border-radius: 8px; }',
    '  .alert h2 { margin: 0 0 8px; font-size: 20px; font-weight: 600; }',
    '  .alert p { margin: 0; }',
    '  .hint { color: var(--muted); font-size: 14px; margin: 16px 0 0; }',
    '  .btn { display: inline-block; margin-top: 20px; padding: 12px 20px;',
    '         background: var(--primary); color: #ffffff; text-decoration: none;',
    '         font-weight: 600; font-size: 15px; border-radius: 8px;',
    '         border-bottom: 3px solid #1e3a8a; }',
    '  .btn:hover { background: #1d4ed8; }',
    '  .foot { color: var(--muted); font-size: 12px; margin: 24px 0 0;',
    '          border-top: 1px solid var(--border); padding-top: 12px; }',
    '  code { font-size: 12px; }',
    '</style>',
    '</head>',
    '<body>',
    '<main>',
    '  <header>',
    '    <h1>K+AIR</h1>',
    '    <p class="subtitle">Firma electrónica</p>',
    '  </header>',
    '  <div class="card">',
    '    <div class="alert" role="alert">',
    '      <h2>' + escapeHtml(copy.title) + '</h2>',
    '      <p>' + escapeHtml(copy.body) + '</p>',
    '    </div>',
    '    <p class="hint">' + escapeHtml(copy.hint) + '</p>',
    cta,
    '    <p class="foot">Referencia: <code>' + escapeHtml(ctx.requestId) + '</code></p>',
    '  </div>',
    '</main>',
    '</body>',
    '</html>',
  ].join('\n');

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  // La URL que abrió el firmante contiene el token, que es una credencial
  // de un solo uso. Sin esto, al seguir un enlace de esta página se lo
  // filtraríamos al Referer del destino.
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'");
  res.status(ctx.statusCode).send(html);
}

/**
 * Marca la respuesta JSON de error como no cacheable, pero SOLO en la
 * superficie pública del firmante.
 *
 * Sin esto, un 404/410 de /s/<token> se queda guardado en el navegador: lo
 * comprobamos en producción, un trabajador que firmó y volvió a abrir el
 * enlace en el mismo navegador siguió viendo el JSON crudo desde el caché,
 * aunque el servidor ya respondiera con la mini-app. La URL lleva el token,
 * que es una credencial de un solo uso, y no debería quedar en disco.
 *
 * Fuera de la superficie pública no se toca: K+AIR consume esos endpoints con
 * fetch y cambiarles las cabeceras de caché no aporta nada aquí.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function noStoreIfPublic(req, res) {
  if (!isPublicSignerPath(req)) return;
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
}

function errorHandler() {
  // eslint-disable-next-line no-unused-vars
  return function (err, req, res, next) {
    const requestId = req.id || 'unknown';
    const asHtml = isPublicSignerPath(req) && prefersHtml(req);

    // AppError: error de aplicación conocido
    if (err instanceof AppError) {
      logger.warn('Error de aplicación', {
        request_id: requestId,
        code: err.code,
        status: err.statusCode,
        message: err.message,
        details: err.details,
      });
      if (asHtml) {
        return renderPublicHtml(res, {
          statusCode: err.statusCode,
          code: err.code,
          requestId: requestId,
          path: (req.path || '').split('?')[0],
        });
      }
      noStoreIfPublic(req, res);
      return res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
          request_id: requestId,
        },
      });
    }

    // Error inesperado
    logger.error('Error no controlado', {
      request_id: requestId,
      error: err.message,
      stack: err.stack,
    });
    if (asHtml) {
      return renderPublicHtml(res, {
        statusCode: 500,
        code: null,
        requestId: requestId,
        path: (req.path || '').split('?')[0],
      });
    }
    noStoreIfPublic(req, res);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor',
        request_id: requestId,
      },
    });
  };
}

module.exports = { AppError, errorHandler };
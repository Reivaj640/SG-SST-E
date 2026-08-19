/**
 * Servicio de Firma Electrónica K+AIR v1 — Entry point.
 *
 * - Configura Express con middlewares de seguridad.
 * - Registra rutas (healthcheck por ahora).
 * - Ejecuta migraciones al arrancar.
 * - Inicia el servidor.
 *
 * Ver ARCHITECTURE.md, API.md, SECURITY.md.
 */
'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const config = require('./config');
const logger = require('./utils/logger');
const requestId = require('./middleware/requestId');
const { errorHandler } = require('./middleware/errors');
const {
  globalLimiter,
  otpLimiter,
  commitLimiter,
  signRequestLimiter,
} = require('./middleware/rateLimit');
const healthRouter = require('./routes/health');
const agreementRouter = require('./routes/agreement');
const consentRouter = require('./routes/consent');
const signRequestRouter = require('./routes/signRequest');
const publicRouter = require('./routes/public');
const adminRouter = require('./routes/admin');
const internalAuditRouter = require('./routes/internal-audit');
const { migrate } = require('./db/migrate');

// Ruta a la mini-app estática (HTML+CSS+JS)
const MINI_APP_DIR = path.resolve(__dirname, '..', 'web', 'firma');

function createApp() {
  const app = express();

  // SEGURIDAD (P1-6): 'true' confía en CUALQUIER proxy → permite spoofing
  // de X-Forwarded-For y bypass de rate limit (E9.1) y de la cadena de
  // custodia forense de ip_origen. Usar config.trustProxy (env TRUST_PROXY).
  // Default 'loopback' (solo 127.0.0.1, ::1). En prod: TRUST_PROXY=1 (último hop)
  // o TRUST_PROXY=<ip-del-proxy>.
  app.set('trust proxy', config.trustProxy);

  // Seguridad: headers HTTP estrictos
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        // Permitir iframes del mismo origen para mostrar el PDF del documento
        // en la mini-app. Mantenemos object-src 'none' (no plugins).
        // No se permite contenido cross-origin.
        frameSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        // NOTA: frame-ancestors se mantiene 'none' globalmente.
        // El endpoint /api/sign/:token/document.pdf lo sobreescribe a 'self'
        // porque la mini-app SÍ necesita incrustar ese PDF.
        // Ver src/routes/public.js (router.get('/api/sign/:token/document.pdf', ...))
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    referrerPolicy: { policy: 'no-referrer' },
  }));

  // Request ID
  app.use(requestId());

  // Body parsing
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  // Log de cada request
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info('request', {
        request_id: req.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: Date.now() - start,
        ip: req.ip,
      });
    });
    next();
  });

  // Rate limiting global por IP (E9.1). skip salta /health (monitoring).
  // Se registra ANTES de las rutas para que aplique a todo.
  app.use(globalLimiter);

  // Rutas
  app.use('/', healthRouter);

  // Mini-app estática servida bajo /s (mismo origen que el endpoint /s/:token).
  // Esto permite que el HTML con paths relativos ("styles.css", "app.js")
  // se resuelvan a /s/styles.css y /s/app.js. Si la URL no coincide con un
  // archivo estático, la petición pasa al publicRouter (que sirve el HTML
  // cuando el Accept es text/html, o JSON cuando es application/json).
  app.use('/s', express.static(MINI_APP_DIR, {
    index: false, // no servir index.html automáticamente
    fallthrough: true,
    setHeaders: (res) => {
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Cache-Control', 'no-cache');
    },
  }));

  // Rate limiters por endpoint público (E9.1).
  // Se registran ANTES de publicRouter para que limiten el acceso.
  // otp: 10/h por IP+token — anti fuerza bruta de OTP.
  // commit: 3/min por IP+token — anti spam de commits.
  app.use('/api/sign/:token/verify-otp', otpLimiter);
  app.use('/api/sign/:token/commit', commitLimiter);

  app.use('/', publicRouter);
  app.use('/internal', agreementRouter);
  app.use('/internal', consentRouter);
  // Rate limiter para creación de sign requests (E9.1): 30/min por IP.
  // Anti-abuso de creación masiva. Se registra ANTES de signRequestRouter.
  app.use('/internal/sign-requests', signRequestLimiter);
  app.use('/internal', signRequestRouter);
  app.use('/internal', internalAuditRouter);
  // Endpoints administrativos: protegidos por X-Admin-API-Key
  // (no expuestos a K+AIR, solo operador humano con acceso físico).
  app.use('/internal/admin', adminRouter);

  // 404 para rutas no existentes
  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Ruta no encontrada: ${req.method} ${req.path}`,
        request_id: req.id,
      },
    });
  });

  // Error handler
  app.use(errorHandler());

  return app;
}

function start() {
  try {
    // Ejecutar migraciones antes de iniciar
    logger.info('Ejecutando migraciones al arranque');
    migrate();

    const app = createApp();
    const server = app.listen(config.port, () => {
      logger.info('Servicio de Firma escuchando', {
        port: config.port,
        env: config.env,
        public_url: config.publicUrl,
      });
    });

    // Cierre limpio
    function shutdown(signal) {
      logger.info('Señal recibida, cerrando', { signal });
      server.close(() => {
        logger.info('Servidor cerrado');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    }
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return server;
  } catch (err) {
    logger.error('Error fatal al iniciar', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { createApp, start };

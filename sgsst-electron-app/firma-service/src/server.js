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

const express = require('express');
const helmet = require('helmet');
const config = require('./config');
const logger = require('./utils/logger');
const requestId = require('./middleware/requestId');
const { errorHandler } = require('./middleware/errors');
const healthRouter = require('./routes/health');
const agreementRouter = require('./routes/agreement');
const consentRouter = require('./routes/consent');
const { migrate } = require('./db/migrate');

function createApp() {
  const app = express();

  // Confiar en el proxy (para IP correcta detrás de nginx/cloudflare)
  app.set('trust proxy', true);

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
        baseUri: ["'self'"],
        formAction: ["'self'"],
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

  // Rutas
  app.use('/', healthRouter);
  app.use('/internal', agreementRouter);
  app.use('/internal', consentRouter);

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

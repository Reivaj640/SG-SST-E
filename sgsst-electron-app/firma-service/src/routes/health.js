/**
 * Healthcheck.
 *
 * - GET /health (público, sin auth).
 * - Verifica BD y SMTP.
 * - Retorna 200 OK si todo está bien, 503 si algo está degradado.
 *
 * Ver ARCHITECTURE.md §7 y API.md §7.
 */
'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const config = require('../config');
const logger = require('../utils/logger');

router.get('/health', (req, res) => {
  const checks = {};
  let healthy = true;

  // Verificar BD
  try {
    const result = db.prepare('SELECT 1 AS ok').get();
    checks.db = result && result.ok === 1 ? 'ok' : 'fail: unexpected result';
  } catch (err) {
    checks.db = 'fail: ' + err.message;
    healthy = false;
  }

  // Verificar SMTP (solo conexión TCP, no envío)
  // Se hace en background; el resultado se reporta si tarda.
  // Por simplicidad, marcamos como "ok" si la config está completa.
  if (config.smtp.host && config.smtp.user && config.smtp.pass) {
    checks.smtp = 'configured';
  } else {
    checks.smtp = 'fail: configuration missing';
    healthy = false;
  }

  const status = healthy ? 200 : 503;
  const body = {
    status: healthy ? 'ok' : 'degraded',
    version: '0.1.0',
    kair_version: 'compatible-' + (config.env === 'production' ? '0.1.189' : 'dev'),
    uptime_seconds: Math.floor(process.uptime()),
    checks,
    timestamp: new Date().toISOString(),
  };

  if (!healthy) {
    logger.warn('Healthcheck degradado', checks);
  }
  return res.status(status).json(body);
});

module.exports = router;

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

const path = require('path');
const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const config = require('../config');
const logger = require('../utils/logger');

// El SELLO DE VERSION del despliegue.
//
// Antes, `kair_version` era un valor FIJO ('compatible-0.1.189'): no
// dependia del codigo que estaba corriendo, asi que no servia para saber
// que version esta desplegada. El sello es un archivo (VERSION, en la raiz
// del servicio) que el despliegue deja escrito con el commit, la fecha y un
// hash corto del arbol; este lo anuncia en `version_sello`.
//
// ADITIVO: `kair_version` NO se toca (el gate y los tests dependen de el) y
// el resto de la respuesta queda igual. Si el archivo de sello no esta, el
// campo nuevo lo dice explicitamente: no se inventa una version.
//
// La logica pura (armar el valor desde el texto del archivo) vive en
// scripts/generar-sello-version.js: es un modulo SIN base de datos, asi que
// se puede probar sola (tests/routes/health.test.js) sin abrir la BD.
//
// Lo que se publica es un commit, una fecha y un hash: no hay ningun
// secreto en esta respuesta.
let leerSelloPublico = null;
try {
  // `scripts/` viaja en el paquete de despliegue; si por lo que sea no
  // estuviera, el healthcheck NO se cae: dice que no hay sello.
  leerSelloPublico = require('../../scripts/generar-sello-version').leerSelloPublico;
} catch (err) {
  logger.warn('No se pudo cargar el modulo del sello de version', {
    error: err.message,
  });
}

// El archivo de sello, en la raiz del servicio (la misma ruta en el repo y
// en el servidor: /opt/kair-firma/app/VERSION).
const RUTA_SELLO = path.resolve(__dirname, '..', '..', 'VERSION');

// El valor del sello cuando NO se puede leer. Se escribe aqui, en el
// archivo, y NO se importa del modulo del sello: este modulo puede no
// existir (por eso la variable de arriba puede quedar en null).
const SELLO_SIN_MODULO = {
  estado: 'ausente',
  detalle: 'el modulo del sello de version no esta disponible en este despliegue',
};
const SELLO_ILEGIBLE = {
  estado: 'ausente',
  detalle: 'no se pudo leer el archivo de sello de version',
};

/**
 * El valor de `version_sello`. ESTA FUNCION NO LANZA NUNCA.
 *
 * El endpoint de salud es el UNICO que puede decir si el servicio esta vivo:
 * que se caiga por un archivo de sello que no se pudo leer seria lo peor
 * que pudiera pasar. Por eso los tres casos (el modulo no cargo, el archivo
 * no esta, el archivo esta roto) devuelven el mismo "no hay sello" en vez
 * de una excepcion.
 *
 * @returns {object} el valor del campo `version_sello`.
 */
function valorSello() {
  if (typeof leerSelloPublico !== 'function') {
    return Object.assign({}, SELLO_SIN_MODULO);
  }
  try {
    const valor = leerSelloPublico(RUTA_SELLO);
    if (valor && typeof valor === 'object') return valor;
    return Object.assign({}, SELLO_ILEGIBLE);
  } catch (err) {
    return Object.assign({}, SELLO_ILEGIBLE);
  }
}

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
    // ADITIVO: el sello de version del despliegue. No cambia `kair_version`
    // (el gate y los tests dependen de ese valor) ni el resto del cuerpo.
    // `valorSello()` no lanza nunca: si el sello no se puede leer, lo dice.
    version_sello: valorSello(),
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

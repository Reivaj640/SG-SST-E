/**
 * Test smoke — botón "Recrear vínculo" en el modal de Firma Electrónica.
 *
 * Valida la estructura (regexes sobre el HTML/JS) de la feature que cubre el
 * estado "vínculo huérfano": la app tiene firma local pero firma-service no
 * reconoce al cliente per-empresa → Rotar y Eliminar fallan con
 * CLIENT_NOT_FOUND y el usuario quedaba bloqueado sin consola.
 *
 * La feature agrega:
 *   - Detección del huérfano en prepareFirmaModal (consulta list-backend
 *     también cuando hasFirma=true).
 *   - Bloque #firma-modal-orphan-block + botón #firma-modal-recreate-btn.
 *   - recreateFirmaFromModal(): revoke local-only (revokeRemote:false)
 *     seguido de firmaEmpresaCreate.
 *
 * Sin asserts de runtime: solo presencia estructural, como test-fixes-loopN.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'components', 'config', 'config-viewer.html');
const src = fs.readFileSync(htmlPath, 'utf8');

const checks = [];

function check(name, ok) {
  checks.push({ name, ok: !!ok });
}

// --- Markup ---
check('markup: bloque #firma-modal-orphan-block existe',
  /id="firma-modal-orphan-block"/.test(src));
check('markup: bloque orphan está oculto por defecto',
  /id="firma-modal-orphan-block"[^>]*display:none/.test(src));
check('markup: botón #firma-modal-recreate-btn existe',
  /id="firma-modal-recreate-btn"/.test(src));
check('markup: botón recreate está oculto por defecto',
  /id="firma-modal-recreate-btn"[^>]*display:none/.test(src));
check('markup: texto del botón es "Recrear vínculo"',
  /Recrear vínculo/.test(src));

// --- Detección del huérfano ---
check('detección: list-backend se consulta también cuando hasFirma=true',
  /if \(firmaState\.hasFirma && nit && window\.electronAPI\.firmaEmpresaListBackend\)/.test(src));
check('detección: _firmaModalCtx.isOrphan se calcula',
  /_firmaModalCtx\.isOrphan\s*=/.test(src));
check('detección: huérfano = no hay item con is_active',
  /!\s*activo/.test(src) || /\.find\(function \(it\) \{ return it && it\.is_active; \}\)/.test(src));
check('ui: rama orphan oculta Rotar/Eliminar y muestra Recrear',
  /if \(_firmaModalCtx\.isOrphan\)/.test(src) &&
  /if \(recreateBtn\) recreateBtn\.style\.display = ''/.test(src));

// --- Función recreate ---
check('función: recreateFirmaFromModal existe',
  /async function recreateFirmaFromModal\(\)/.test(src));
check('recreate: guard anti doble-click (_firmaModalBusy)',
  /recreateFirmaFromModal\(\)[\s\S]{0,200}if \(!_firmaModalCtx \|\| _firmaModalBusy\) return/.test(src));
check('recreate: usa KairConfirm (moderno) con fallback a confirm nativo',
  /recreateFirmaFromModal[\s\S]*?_kairConfirm\(\)[\s\S]*?kc\.confirm\(\{[\s\S]*?window\.confirm\(/.test(src));
check('recreate: KairConfirm con type warning y confirmText "Recrear vínculo"',
  /recreateFirmaFromModal[\s\S]*?type: 'warning'/.test(src) &&
  /recreateFirmaFromModal[\s\S]*?confirmText: 'Recrear vínculo'/.test(src));
check('helper: _kairConfirm accede al parent con fallback defensivo',
  /function _kairConfirm\(\)[\s\S]*?window\.parent && window\.parent\.KairConfirm/.test(src));
check('revoke: también usa KairConfirm moderno (type danger)',
  /revokeFirmaFromModal[\s\S]*?kc\.confirm\(\{[\s\S]*?type: 'danger'/.test(src));
check('recreate: paso 1 — revoke SOLO local (revokeRemote: false)',
  /recreateFirmaFromModal[\s\S]*?revokeRemote:\s*false/.test(src));
check('recreate: paso 1 tolera CLIENT_NOT_FOUND (ya limpio)',
  /recreateFirmaFromModal[\s\S]*?rvCode !== 'CLIENT_NOT_FOUND'/.test(src));
check('recreate: paso 2 — firmaEmpresaCreate después del revoke',
  /recreateFirmaFromModal[\s\S]*?firmaEmpresaCreate\(/.test(src));
check('recreate: el orden es revoke ANTES que create',
  src.indexOf('firmaEmpresaRevokeApiKey') > 0 &&
  src.indexOf('firmaEmpresaCreate', src.indexOf('recreateFirmaFromModal')) >
  src.indexOf('firmaEmpresaRevokeApiKey', src.indexOf('recreateFirmaFromModal')));

// --- Wireup ---
check('wireup: botón recreate tiene onclick a recreateFirmaFromModal',
  /firmaRecreateBtn\.onclick = recreateFirmaFromModal/.test(src));

// --- Mensaje de error ---
check('mensaje: CLIENT_NOT_FOUND guía a usar "Recrear vínculo"',
  /CLIENT_NOT_FOUND[\s\S]{0,300}Recrear vínculo/.test(src));

// Reporte
let failed = 0;
checks.forEach(function (c) {
  if (!c.ok) { failed++; }
  console.log((c.ok ? '  OK ' : 'FAIL ') + c.name);
});
console.log(failed === 0
  ? '\n' + checks.length + '/' + checks.length + ' OK'
  : '\n' + (checks.length - failed) + '/' + checks.length + ' OK — ' + failed + ' FAILED');
process.exit(failed === 0 ? 0 : 1);

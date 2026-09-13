// =====================================================================
// Test smoke — Kit de despliegue Fase 1 (firma-service a producción $0)
// Valida que los artefactos de deploy existan y contengan lo esencial
// de seguridad y operación. Ejecutar: node main/test-firma-deploy-kit.js
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'firma-service', 'deploy');
const checks = [];

function add(name, cond) { checks.push({ name, ok: !!cond }); }

const files = {
  env: path.join(root, '.env.production.example'),
  setup: path.join(root, 'setup-vm.sh'),
  systemd: path.join(root, 'kair-firma.service'),
  caddy: path.join(root, 'Caddyfile'),
  backup: path.join(root, 'backup-firma.sh'),
  readme: path.join(root, 'README-DESPLIEGUE.md'),
};

Object.keys(files).forEach(function (k) {
  add('deploy: existe ' + path.basename(files[k]), fs.existsSync(files[k]));
});

const src = {};
Object.keys(files).forEach(function (k) {
  if (fs.existsSync(files[k])) src[k] = fs.readFileSync(files[k], 'utf8');
});

// .env de producción
if (src.env) {
  [
    [/NODE_ENV=production/, 'env: NODE_ENV=production'],
    [/^PUBLIC_URL=https:/m, 'env: PUBLIC_URL con HTTPS'],
    [/TRUST_PROXY=loopback/, 'env: trust proxy loopback (detrás de Caddy)'],
    [/no copiar la de desarrollo/i, 'env: advierte no reusar keys de dev'],
    [/INTERNAL_API_KEY=generar-nueva/, 'env: INTERNAL_API_KEY placeholder (sin secretos reales)'],
    [/ADMIN_API_KEY=generar-nueva/, 'env: ADMIN_API_KEY placeholder (sin secretos reales)'],
    [/DB_PATH=\/opt\/kair-firma/, 'env: rutas absolutas de producción'],
  ].forEach(function (c) { add(c[1], c[0].test(src.env)); });
}

// Script de setup
if (src.setup) {
  [
    [/set -euo pipefail/, 'setup: falla rápido ante errores'],
    [/setup_20\.x/, 'setup: instala Node 20'],
    [/caddy/, 'setup: instala Caddy (HTTPS)'],
    [/useradd.*kairfirma/s, 'setup: usuario de servicio sin privilegios'],
    [/ufw deny 3001/, 'setup: el puerto del servicio NO queda expuesto'],
    [/ufw allow 443/, 'setup: abre solo HTTPS'],
  ].forEach(function (c) { add(c[1], c[0].test(src.setup)); });
}

// Systemd unit
if (src.systemd) {
  [
    [/User=kairfirma/, 'systemd: corre como usuario sin privilegios'],
    [/Restart=always/, 'systemd: reinicio automático ante caída'],
    [/EnvironmentFile=\/opt\/kair-firma\/\.env/, 'systemd: .env externo al código'],
    [/NoNewPrivileges=true/, 'systemd: endurecimiento NoNewPrivileges'],
  ].forEach(function (c) { add(c[1], c[0].test(src.systemd)); });
}

// Caddy
if (src.caddy) {
  [
    [/reverse_proxy 127\.0\.0\.1:3001/, 'caddy: proxy solo a localhost'],
    [/Strict-Transport-Security/, 'caddy: HSTS'],
    [/X-Forwarded-Proto/, 'caddy: propaga esquema (para URLs correctas)'],
    [/X-Real-IP/, 'caddy: propaga IP real del firmante'],
    [/CAMBIAR-ME\.sslip\.io/, 'caddy: placeholder de dominio documentado'],
  ].forEach(function (c) { add(c[1], c[0].test(src.caddy)); });
}

// Backup
if (src.backup) {
  [
    [/\.backup/, 'backup: usa sqlite3 .backup (seguro en WAL)'],
    [/mtime \+14/, 'backup: retención 14 días'],
    [/rclone/, 'backup: opción de nube documentada (rclone)'],
    [/cron/, 'backup: instrucción de cron'],
  ].forEach(function (c) { add(c[1], c[0].test(src.backup)); });
}

// README
if (src.readme) {
  [
    [/sslip\.io/, 'readme: propuesta de dominio gratis (sslip.io)'],
    [/Oracle/i, 'readme: VM gratis (Oracle)'],
    [/IP pública real/i, 'readme: verificación de IPs reales'],
    [/no copies la BD de desarrollo|BD de desarrollo/i, 'readme: no mezclar BD dev con prod'],
    [/Paso [0-9]/, 'readme: guía numerada paso a paso'],
  ].forEach(function (c) { add(c[1], c[0].test(src.readme)); });
}

let failed = 0;
checks.forEach(function (c) {
  if (c.ok) console.log('OK   ' + c.name);
  else { failed++; console.log('FAIL ' + c.name); }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
process.exit(failed === 0 ? 0 : 1);

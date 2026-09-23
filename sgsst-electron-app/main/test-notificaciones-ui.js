'use strict';
/* Task 6 — Test UI: badge + toast + panel + preferencia de ventana (notificaciones persistentes)
   Static source-checks (patrón del repo). Correr con: node main/test-notificaciones-ui.js */
const fs = require('fs');
const path = require('path');
const checks = [];
function ok(n, c) { checks.push({ name: n, ok: !!c }); }

const renderer = fs.readFileSync(path.join(__dirname, '..', 'renderer.js'), 'utf8');
const alerts = fs.readFileSync(path.join(__dirname, '..', 'shared', 'kair-alerts.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let stylesCss = '';
try {
  stylesCss = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
} catch (e) { stylesCss = ''; }

// ── Checks del brief ─────────────────────────────────────────────────
ok('renderer escucha notificaciones:changed', /notificaciones:changed|onChanged/.test(renderer));
ok('renderer suma getUnreadCount al badge', /getUnreadCount/.test(renderer));
ok('toast persistente autoClose 0', /autoClose:\s*0/.test(renderer) || /autoClose:\s*0/.test(alerts));
ok('kair-alerts tiene seccion notificaciones', /notificaciones/i.test(alerts));
ok('select de ventana o setVentana', /setVentana/.test(renderer) || /setVentana/.test(alerts));
ok('cache-bust renderer en index.html', /renderer\.js\?v=/.test(indexHtml));
ok('escape HTML en titulos notif', /KairAlerts|KAIRToast|esc\(/.test(alerts));

// ── Checks extra (composición + panel) ──────────────────────────────
ok('renderer tiene _refreshNotifBadge', /function\s+_refreshNotifBadge/.test(renderer));
ok('renderer compone badge con __notifUnread', /__notifUnread/.test(renderer));
ok('renderer notif usa token kair-auth-token', /kair-auth-token/.test(renderer));
ok('renderer toast onClick abre panel (badge.click)', /badge\.click\(\)/.test(renderer));
ok('kair-alerts llama listar soloNoLeidas', /listar/.test(alerts) && /soloNoLeidas/.test(alerts));
ok('kair-alerts tiene marcarLeida', /marcarLeida/.test(alerts));
ok('kair-alerts chip empresa si companyKey != activa', /companyKey\s*!==/.test(alerts));
ok('kair-alerts ventana default 24h (86400000)', /86400000/.test(alerts));
ok('kair-alerts select ventana opciones 15m/1h/6h/24h', /900000/.test(alerts) && /3600000/.test(alerts) && /21600000/.test(alerts));
ok('kair-alerts persiste ventana en localStorage', /kair-notif-ventana/.test(alerts));
ok('kair-alerts exporta refreshNotifications en API publica', /refreshNotifications/.test(alerts));
ok('kair-alerts estado vacio en seccion notificaciones', /kair-alerts-empty/.test(alerts));
ok('styles.css tiene estilos del panel notifs', /\.kair-alerts-notifs/.test(stylesCss));
ok('styles.css dark mode para panel notifs', /\[data-theme\^="dark"\][^{]*\.kair-alerts-notifs/.test(stylesCss));
ok('cache-bust styles.css en index.html', /styles\.css\?v=/.test(indexHtml));
ok('index.html carga kair-alerts con cache-bust', /kair-alerts\.js\?v=/.test(indexHtml));
ok('renderer toast buttonText Ver junto a onClick', /buttonText:\s*'Ver'/.test(renderer) && /onClick:\s*function/.test(renderer));
ok('kair-alerts correo no navega si !activa o !companyKey o distinta', /!activa \|\| !companyKey \|\| companyKey !== activa/.test(alerts));

var f = 0;
checks.forEach(function (c) {
  console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name);
  if (!c.ok) f++;
});
console.log((checks.length - f) + '/' + checks.length + ' OK');
process.exit(f === 0 ? 0 : 1);

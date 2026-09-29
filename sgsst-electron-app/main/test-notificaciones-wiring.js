'use strict';
const fs = require('fs');
const path = require('path');
const checks = [];
function ok(n, c) { checks.push({ name: n, ok: !!c }); }

const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const preSrc = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
const svcSrc = fs.readFileSync(path.join(__dirname, 'notifications-service.js'), 'utf8');

ok('main require notifications-bridge', /notifications-bridge/.test(mainSrc));
ok('main require notifications-service', /notifications-service/.test(mainSrc));
ok('main registerNotificationsHandlers', /registerNotificationsHandlers/.test(mainSrc));
ok('main notificationsService.start', /notificationsService\.start/.test(mainSrc));
ok('main notificationsService.stopAll', /notificationsService\.stopAll/.test(mainSrc));
ok('preload expone notifications', /notifications\s*:\s*\{/.test(preSrc) || /electronAPI\.notifications/.test(preSrc) || /notificaciones:listar/.test(preSrc));
ok('preload tiene getUnreadCount', /getUnreadCount/.test(preSrc));
ok('service tiene stopAll export', /stopAll/.test(svcSrc));
ok('service init recibe sources', /sources/.test(svcSrc));
ok('preload setVentana via payload (token + ventanaMs)', /setVentana\s*:\s*\(payload\)\s*=>/.test(preSrc));
ok('main setVentana con validateSession', /notificaciones:setVentana[\s\S]{0,200}validateSession/.test(mainSrc));

var f = 0;
checks.forEach(function (c) {
  console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name);
  if (!c.ok) f++;
});
console.log((checks.length - f) + '/' + checks.length + ' OK');
process.exit(f === 0 ? 0 : 1);

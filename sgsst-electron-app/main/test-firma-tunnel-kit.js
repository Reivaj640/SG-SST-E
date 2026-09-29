// =====================================================================
// Test smoke — kit de túnel casero (Cloudflare quick tunnel, Ruta B)
// Valida scripts/powerShell del kit de publicación del firma-service.
// Ejecutar: node main/test-firma-tunnel-kit.js
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'scripts', 'firma-tunnel');
const checks = [];
const add = (name, ok) => checks.push({ name, ok: !!ok });

const start = path.join(dir, 'start-firma-tunnel.ps1');
const reg = path.join(dir, 'registrar-tarea.ps1');
const doc = path.join(__dirname, '..', 'docs', 'MIGRACION-SERVIDOR-FIRMA.md');

add('start-firma-tunnel.ps1 existe', fs.existsSync(start));
add('registrar-tarea.ps1 existe', fs.existsSync(reg));
add('MIGRACION-SERVIDOR-FIRMA.md existe', fs.existsSync(doc));

if (fs.existsSync(start)) {
  const s = fs.readFileSync(start, 'utf8');
  [
    [/cloudflared\\cloudflared\.exe|cloudflared.exe/, 'start: localiza el binario cloudflared'],
    [/tunnel','--url','http:\/\/localhost:3001/, 'start: quick tunnel hacia 3001'],
    [/Wait-TunnelUrl/, 'start: espera la URL del túnel leyendo el log'],
    [/trycloudflare\.com/, 'start: captura URL *.trycloudflare.com'],
    [/function Test-Port3001Free/, 'start: verifica que el 3001 esté libre antes de arrancar'],
    [/Stop-FirmaService/, 'start: reinicia el servicio tras actualizar el .env'],
    [/Update-EnvPublicUrl/, 'start: actualiza PUBLIC_URL en .env'],
    [/Copy-Item \$EnvFile \$bak/, 'start: backup del .env antes de tocar'],
    [/PUBLIC_URL/ , 'start: maneja PUBLIC_URL'],
    [/PUBLIC_URL_FIRMA/, 'start: maneja PUBLIC_URL_FIRMA'],
    [/Start-FirmaService/, 'start: arranca firma-service con node'],
    [/Invoke-WebRequest -Uri "\$url\/health"/, 'start: verifica /health por el túnel'],
    [/while \(\$true\)/, 'start: bucle supervisor'],
    [/60 segundos|Start-Sleep -Seconds 60/, 'start: supervisor cicla cada 60s'],
    [/estado\.txt/, 'start: escribe estado para diagnóstico'],
  ].forEach(function (c) { add(c[1], c[0].test(s)); });

  // Orden crítico: túnel → .env → servicio, en Start-CicloCompleto
  const idxT = s.indexOf('$script:TunnelProc = Start-Tunnel');
  const idxEnv = s.indexOf('Update-EnvPublicUrl -Url $url');
  const idxSvc = s.indexOf('Stop-FirmaService', idxEnv);
  add('start: ORDEN crítico (túnel antes de .env antes de servicio)', idxT > 0 && idxEnv > idxT && idxSvc > idxEnv);
}

if (fs.existsSync(reg)) {
  const s = fs.readFileSync(reg, 'utf8');
  [
    [/New-ScheduledTaskTrigger -AtLogOn/, 'tarea: al iniciar sesión'],
    [/RestartCount 3/, 'tarea: reintenta si falla'],
    [/-WindowStyle Hidden/, 'tarea: oculta (sin ventana molesta)'],
    [/-DontStopIfGoingOnBatteries/, 'tarea: no se apaga con batería'],
    [/-Desinstalar/, 'tarea: modo desinstalación'],
  ].forEach(function (c) { add(c[1], c[0].test(s)); });
}

if (fs.existsSync(doc)) {
  const s = fs.readFileSync(doc, 'utf8');
  [
    [/sqlite3 .*\.backup/, 'migración: usa sqlite3 .backup (WAL-safe)'],
    [/storage/, 'migración: incluye los PDFs de evidencia'],
    [/Ruta B/, 'migración: documenta limitación de Ruta B'],
  ].forEach(function (c) { add(c[1], c[0].test(s)); });
}

let failed = 0;
checks.forEach(function (c) {
  if (c.ok) console.log('OK   ' + c.name);
  else { failed++; console.log('FAIL ' + c.name); }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
process.exit(failed === 0 ? 0 : 1);

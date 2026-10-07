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
    // El script migró de QUICK tunnels (URL temporal *.trycloudflare.com, capturada del
    // log) a un TÚNEL NOMINADO y FIJO (kair-firma → firma.kair.fyi). Estos checks exigían
    // el patrón viejo, que ya no existe en el script: daba rojo sobre código sano.
    [/tunnel','run','kair-firma/, 'start: arranca el túnel NOMINADO (kair-firma)'],
    [/Wait-TunnelUrl/, 'start: espera la URL del túnel leyendo el log'],
    [/firma\.kair\.fyi/, 'start: la URL del túnel es FIJA, no se captura del log'],
    [/-ArgumentList 'tunnel','run'/, 'start: cloudflared en modo run, no quick tunnel'],
    [/function Test-Port3001Free/, 'start: verifica que el 3001 esté libre antes de arrancar'],
    [/Stop-FirmaService/, 'start: reinicia el servicio para que adopte la URL fija'],
    // Con la URL FIJA del túnel nombrado ya no se reescribe el .env: no hay backup que
    // hacer ni PUBLIC_URL que actualizar. Update-EnvPublicUrl se eliminó por quedar sin
    // uso, y con ella los checks que exigían precisamente eso.
    [/Start-FirmaService/, 'start: arranca firma-service con node'],
    [/Invoke-WebRequest -Uri "\$url\/health"/, 'start: verifica /health por el túnel'],
    [/while \(\$true\)/, 'start: bucle supervisor'],
    [/60 segundos|Start-Sleep -Seconds 60/, 'start: supervisor cicla cada 60s'],
    [/estado\.txt/, 'start: escribe estado para diagnóstico'],
  ].forEach(function (c) { add(c[1], c[0].test(s)); });

  // Orden crítico dentro de Start-CicloCompleto.
  //
  // Con el TÚNEL NOMINADO la URL es FIJA (firma.kair.fyi), así que el ciclo ya no
  // reescribe PUBLIC_URL en el .env: no hay nada que cambiar entre corridas. El orden
  // que sigue importando es túnel → reinicio del servicio (para que adopte el .env).
  // El check viejo exigía "túnel → .env → servicio" y buscaba la llamada con el texto
  // exacto 'Update-EnvPublicUrl -Url $url'; esa llamada ya no existe y daba rojo.
  const iCiclo = s.indexOf('function Start-CicloCompleto');
  const cuerpo = iCiclo > 0 ? s.slice(iCiclo) : '';
  const idxT = cuerpo.indexOf('Start-Tunnel');
  const idxSvc = cuerpo.indexOf('Stop-FirmaService');
  add('start: ORDEN crítico (túnel antes de reiniciar el servicio)',
    iCiclo > 0 && idxT >= 0 && idxSvc > idxT,
    'ciclo=' + iCiclo + ' tunel=' + idxT + ' servicio=' + idxSvc);
  // La función de reescritura del .env quedó sin uso con la URL fija. Se verifica que
  // el ciclo NO la use: si alguien la vuelve a meter, es que el túnel dejó de ser fijo.
  add('start: el ciclo NO reescribe el .env (la URL del túnel es fija)',
    cuerpo.indexOf('Update-EnvPublicUrl') < 0,
    'si aparece, el túnel nombrado volvió a ser de URL variable');
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

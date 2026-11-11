/* 📦1047 — El árbol versionado no puede volver a llevar un secreto.
 *
 * Qué verifica:
 *   1. El detector MUERDE: encuentra un token de GitHub, un fine-grained y una
 *      app password de Google en textos de prueba.
 *   2. El detector NO molesta: los placeholders que el repo usa a propósito
 *      ("xxxx xxxx xxxx xxxx", "github_pat_TU_TOKEN_AQUI") no son hallazgos.
 *   3. CHECK INVERTIDO sobre el árbol REAL: cero secretos en los archivos
 *      versionados. Este es el check que habría cazado P11 y P12.
 *   4. Los `.env` (los únicos lugares donde los valores DEBEN vivir) siguen
 *      ignorados por git, y los ejemplos versionados no traen valores.
 *   5. La autoexclusión del detector es de DOS archivos y nada más: si alguien
 *      la agranda, este test se cae.
 *
 * Se corre con: node main/test-secretos-1047.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const detector = require('./detector-secretos.js');

const checks = [];
function chk(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra || '' });
}
function correr() {
  let failed = 0;
  checks.forEach(function (c) {
    if (!c.ok) failed++;
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  process.exit(failed === 0 ? 0 : 1);
}

// ── 1. El detector muerde ───────────────────────────────────────────────────
// Las muestras se arman por concatenación: el archivo de test no lleva un
// secreto literal (ni siquiera de mentira).
const TOKEN_CLASICO = 'ghp_' + 'a1b2c3d4e5'.repeat(3) + 'xyz9';
const TOKEN_FINE = 'github_pat_' + 'A'.repeat(22) + '_' + 'b'.repeat(22);
const APP_PASSWORD = 'abcd efgh ijkl mnop';
/* La misma forma, pero con letras que no aparecen en las palabras corrientes:
 * asi es como se ve una clave de verdad. */
const APP_PASSWORD_REAL = 'kqzt xmwr pjvn bhgf';

chk('el detector encuentra un token clasico de GitHub',
  detector.detectarEnTexto('const t = "' + TOKEN_CLASICO + '";').some(function (h) {
    return h.regla === 'token_github_clasico';
  }));

chk('el detector encuentra un token fine-grained de GitHub',
  detector.detectarEnTexto('GH_TOKEN=' + TOKEN_FINE).some(function (h) {
    return h.regla === 'token_github_fine_grained';
  }));

chk('el detector encuentra una app password de Google asignada',
  detector.detectarEnTexto('KAIR_EMAIL_ASEPLUS_PASSWORD="' + APP_PASSWORD + '"').some(function (h) {
    return h.regla === 'app_password_gmail';
  }));

chk('el detector encuentra una app password escrita entre comillas',
  detector.detectarEnTexto('la contrasena del gmail es "' + APP_PASSWORD_REAL + '"').some(function (h) {
    return h.regla === 'app_password_gmail_en_texto';
  }));

chk('el detector NO marca una frase en prosa de 4 palabras de 4 letras',
  detector.detectarEnTexto('"cada html sean byte"').length === 0 &&
  detector.detectarEnTexto('"solo esta capa deja"').length === 0);

chk('el detector SI marca una app password con la forma de clave real',
  detector.detectarEnTexto('"' + APP_PASSWORD_REAL + '"').length === 1);

chk('el detector encuentra una llave privada',
  detector.detectarEnTexto('-----BEGIN RSA PRIVATE KEY-----').some(function (h) {
    return h.regla === 'llave_privada';
  }));

// ── 2. El detector no molesta ──────────────────────────────────────────────
chk('"xxxx xxxx xxxx xxxx" NO es un hallazgo (es el placeholder del repo)',
  detector.detectarEnTexto('KAIR_EMAIL_ASEPLUS_PASSWORD="xxxx xxxx xxxx xxxx"').length === 0);

chk('"github_pat_TU_TOKEN_AQUI" NO es un hallazgo',
  detector.detectarEnTexto('export GH_TOKEN=github_pat_TU_TOKEN_AQUI').length === 0);

chk('una variable de contrasena VACIA no es un hallazgo',
  detector.detectarEnTexto('KAIR_EMAIL_ASEPLUS_PASSWORD=').length === 0);

// ── 3. CHECK INVERTIDO sobre el árbol real ─────────────────────────────────
const escaneo = detector.escanear();
chk('git esta disponible: el barrido del arbol versionado se pudo hacer',
  escaneo.disponible === true,
  escaneo.disponible ? escaneo.archivos + ' archivos leidos' : 'git no respondio');

chk('CERO secretos en los archivos versionados',
  escaneo.disponible && escaneo.hallazgos.length === 0,
  escaneo.hallazgos.length === 0
    ? escaneo.archivos + ' archivos barridos'
    : escaneo.hallazgos.map(function (h) {
        return h.archivo + ':' + h.linea + ' (' + h.regla + ')';
      }).join(', '));

// ── 4. Donde los valores SI pueden vivir ───────────────────────────────────
function ignorado(rel) {
  try {
    const salida = require('child_process').execFileSync(
      'git', ['check-ignore', '-q', rel], { cwd: detector.REPO_ROOT }
    );
    return true;
  } catch (e) {
    return e.status === 0;
  }
}
chk('el .env de la app esta ignorado por git',
  ignorado('sgsst-electron-app/.env'));
chk('el .env del firma-service esta ignorado por git',
  ignorado('sgsst-electron-app/firma-service/.env'));

const envExample = path.join(detector.APP, '.env.example');
let ejemplo = '';
try { ejemplo = fs.readFileSync(envExample, 'utf8'); } catch (e) { ejemplo = ''; }
chk('el .env.example versionado NO trae valores de contrasena',
  !/KAIR_EMAIL_[A-Z_]+_PASSWORD=[ \t]*\S/.test(ejemplo),
  'ejemplo leido: ' + (ejemplo ? 'si' : 'no'));

// ── 5. La autoexclusión es mínima ──────────────────────────────────────────
chk('la autoexclusion del detector son exactamente DOS archivos',
  detector.AUTOEXCLUIDOS.length === 2 &&
  detector.AUTOEXCLUIDOS.indexOf('sgsst-electron-app/main/detector-secretos.js') !== -1 &&
  detector.AUTOEXCLUIDOS.indexOf('sgsst-electron-app/main/test-secretos-1047.js') !== -1,
  detector.AUTOEXCLUIDOS.join(', '));

correr();

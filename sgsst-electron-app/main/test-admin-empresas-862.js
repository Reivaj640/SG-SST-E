/* Test de 📦862: un administrador nunca puede quedar sin empresas ni ver el
 * mensaje de "contacta a administración".
 *
 * Dos bugs, la misma raíz: el admin se detectable solo a través de empresas.
 *
 *   1) La rama del admin era CÓDIGO MUERTO. El filtrado arrancaba con
 *      `Array.isArray(overrideCompanies)`, que es true incluso para `[]`, y como
 *      initializeApp() SIEMPRE recibe un array (renderer.js:3604) esa ganaba
 *      siempre.
 *   2) checkIsAdmin() solo miraba `currentUser.companies`. Con companies = [] eso
 *      da FALSE, aunque el backend ya habia resuelto isAdmin = true. O sea: el
 *      admin caia en el mensaje del usuario normal.
 *
 * Este test NO comprueba que exista una cadena: extrae las funciones reales de
 * renderer.js y las EJECUTA con entradas controladas.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const rendererPath = path.join(ROOT, 'renderer.js');

const checks = [];
function chk(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra || '' });
}

if (!fs.existsSync(rendererPath)) {
  console.error('FAIL: renderer.js no existe');
  process.exit(1);
}

const src = fs.readFileSync(rendererPath, 'utf8');

function correr(checksList, total, titulo) {
  let failed = 0;
  console.log('\n=======================================');
  console.log('  ' + titulo);
  console.log('=======================================');
  checksList.forEach(function (c) {
    if (!c.ok) failed++;
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
  });
  console.log('---');
  console.log((total - failed) + '/' + total + ' OK');
  console.log('=======================================');
  process.exit(failed === 0 ? 0 : 1);
}

// ───────────────────────── checkIsAdmin, ejecutado de verdad
const fnCheck = src.match(
  /function checkIsAdmin\(\)\s*\{[\s\S]*?\n  \}/
);

chk('checkIsAdmin() sigue existiendo en renderer.js', !!fnCheck);

if (fnCheck) {
  const simularAdmin = new Function('currentUser', 'return (' + fnCheck[0] + ')(currentUser);');

  // El caso que rompia: admin global, sin empresas asignadas.
  // El backend manda isAdmin = true (main.js:1628) y companies = [].
  chk(
    'admin global SIN empresas (isAdmin:true, companies:[]) se detecta como admin',
    simularAdmin({ isAdmin: true, companies: [] }) === true,
    'recibio companies=[] e isAdmin=true'
  );

  chk(
    'admin resuelto por rol en companies tambien se detecta',
    simularAdmin({ isAdmin: false, companies: [{ role: 'Administrador' }] }) === true
  );

  chk(
    'admin por rol con variante de nombre tambien',
    simularAdmin({ isAdmin: false, companies: [{ role: 'administrador del sistema' }] }) === true
  );

  chk(
    'usuario normal con rol SST NO es admin',
    simularAdmin({ isAdmin: false, companies: [{ role: 'SST' }] }) === false
  );

  chk(
    'usuario sin empresas y sin isAdmin NO es admin',
    simularAdmin({ isAdmin: false, companies: [] }) === false
  );

  chk(
    'currentUser null no rompe',
    simularAdmin(null) === false
  );
}

// ───────────────────────── el boton de salida
chk(
  'el admin recibe un boton para llegar a Configuracion',
  /if \(esAdmin\)\s*\{\s*const goConfig = document\.createElement\('button'\)/.test(src)
);

chk(
  'ese boton llama a showSettingsPage()',
  /goConfig\.addEventListener\('click',\s*\(\)\s*=>\s*\{\s*if \(typeof showSettingsPage === 'function'\) showSettingsPage\(\);/.test(src)
);

// ───────────────────────── el filtrado se decide por rol
const bloque = src.match(
  /const esAdmin = checkIsAdmin\(\);[\s\S]*?mostrando solo empresas asignadas:', dynamicCompanies\.length\);\s*\}/
);

chk('el bloque de filtrado por rol existe en renderer.js', !!bloque);

if (bloque) {
  const simular = new Function(
    'checkIsAdmin', 'assignedCompanies', 'window', 'overrideCompanies',
    'return (async () => {' + bloque[0] + '\nreturn dynamicCompanies;})();'
  );
  const configConDos = { companyPaths: { 'Tempoactiva': {}, 'Temposum': {} } };

  return (async function () {
    let r;

    r = await simular(() => true, [], { electronAPI: { loadConfig: async () => configConDos } }, []);
    chk(
      'admin sin empresas asignadas ve TODAS las del config',
      Array.isArray(r) && r.length === 2 && r.indexOf('Tempoactiva') !== -1,
      'recibio: ' + JSON.stringify(r)
    );

    r = await simular(() => true, ['Solo'], { electronAPI: { loadConfig: async () => configConDos } }, ['Solo']);
    chk(
      'admin ignora el override y ve todas las del config',
      Array.isArray(r) && r.length === 2,
      'recibio: ' + JSON.stringify(r)
    );

    r = await simular(() => false, [], { electronAPI: { loadConfig: async () => configConDos } }, []);
    chk(
      'no-admin sin empresas NO ve todas (sin escalada de privilegios)',
      Array.isArray(r) && r.length === 0,
      'recibio: ' + JSON.stringify(r)
    );

    r = await simular(() => false, ['Aseplus'], { electronAPI: { loadConfig: async () => configConDos } }, ['Aseplus']);
    chk(
      'no-admin ve solo sus empresas asignadas',
      Array.isArray(r) && r.length === 1 && r[0] === 'Aseplus',
      'recibio: ' + JSON.stringify(r)
    );

    r = await simular(() => false, [], { electronAPI: { loadConfig: async () => configConDos } }, ['Temposum']);
    chk(
      'no-admin con override usa ese override',
      Array.isArray(r) && r.length === 1 && r[0] === 'Temposum',
      'recibio: ' + JSON.stringify(r)
    );
  })().then(function () {
    chk(
      'el mensaje de "sin empresas" decide por rol, no por Array.isArray',
      /noCompaniesMessage\.textContent = esAdmin/.test(src) &&
      !/noCompaniesMessage\.textContent = Array\.isArray\(overrideCompanies\)/.test(src)
    );

    const msg = src.match(/noCompaniesMessage\.textContent\s*=\s*esAdmin[\s\S]{0,320}?;/);
    chk(
      'el admin recibe "no hay empresas registradas", no "contacta a administracion"',
      !!msg && /=\s*esAdmin\s*\?\s*'No hay empresas registradas/.test(msg[0])
    );

    correr(checks, checks.length, '📦862 · El admin nunca queda sin empresas ni sin salida');
  });
} else {
  correr(checks, checks.length, '📦862 · El admin nunca queda sin empresas ni sin salida');
}
// =====================================================================
// 📦828-T0 · El shell del dashboard: que ningún submódulo se pierda en silencio
//
// El problema que este test resuelve: un submódulo que está en ALL_SUBMODULES
// pero no tiene caso en el dispatch NO da error. Cae en
// showGenericSubmoduleContent() y muestra "Funcionalidad en Desarrollo" para
// siempre, sin que nadie lo note. Hoy son 15 de 62, y 4 de ellos son los
// pendientes de Gestión Integral (2.7.1, 2.8.1, 2.12.1, 2.13.1).
//
// Las guardas:
//   1) La lista de pendientes es EXACTA. Agregar un submódulo sin dispatch falla.
//      Terminar uno también falla, y el mensaje dice que hay que sacarlo de la
//      lista a propósito: el cambio es consciente, no un olvido.
//   2) Todo componente que el dispatch instancia está cargado en index.html.
//      Si se sube un -logic.js y se olvida el <script>, el submódulo queda mudo
//      aunque el código exista.
//   3) Cada submódulo 2.x tiene su PROPIA clave de permiso: si dos comparten,
//      darle permiso a uno abre el otro.
//   4) Ningún archivo suelto de main/ declara window.XxxComponent.
//   5) index.js de gestion-integral exporta todas las carpetas que existen.
//
// Uso (los tests funcionales se corren con Electron, no con node):
//   $env:ELECTRON_RUN_AS_NODE="1"
//   .\node_modules\electron\dist\electron.exe main\test-shell-submodulos.js
// =====================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..');
const leer = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };

const checks = [];
const ok = (n, c, e) => checks.push({ name: n, ok: !!c, extra: e });

const renderer = leer(path.join(APP, 'renderer.js'));
const indexHtml = leer(path.join(APP, 'index.html'));

/* ── Línea base a 2026-10-02 ──────────────────────────────────────────────
   Se midió sobre 62 submódulos. Cuando uno se construya, se borra de acá
   en el mismo commit: el test obliga a acknowledging. */
const PENDIENTES_CONOCIDOS = [
  'Gestión Integral » 2.7.1 Matriz de requisitos legales',
  'Gestión Integral » 2.8.1 Mecanismos de comunicaciones',
  'Gestión Integral » 2.12.1 Equipos y Herramientas',
  'Gestión Integral » 2.13.1 Elementos de Protección Personal',
  'Gestión de la Salud » 3.1.5 Custodia medica ocupacional',
  'Gestión de la Salud » 3.1.7 Estilos de vida Saludables',
  'Gestión de la Salud » 3.1.8 Servicios de Higiene',
  'Gestión de la Salud » 3.1.9 Manejo de Residuos',
  'Gestión de Peligros y Riesgos » 4.1.3 Identificación de Sustancias Químicas carcinogénas o con toxicidad',
  'Gestión de Peligros y Riesgos » 4.1.4 Mediciones ambientales',
  'Gestión de Peligros y Riesgos » 4.2.1 Mediciones de Prevención y Control frente a Peligros, Riesgos Identificados',
  'Gestión de Peligros y Riesgos » 4.2.2 Aplicación de las medidas de prevención y control por parte de los trabajadores',
  'Gestión de Peligros y Riesgos » 4.2.3 Evaluación de procedimientos, instructivos internos de seguridad y salud en el trabajo',
  'Gestión de Peligros y Riesgos » 4.2.6 Entrega de EPP',
  'Verificación » 6.1.4 Planificación de la Auditoria'
];

/* ── El maestro ── */
const maestro = [];
{
  const bloque = (renderer.split('const ALL_SUBMODULES')[1] || '').split('};')[0];
  const reModulo = /"([^"]+)":\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = reModulo.exec(bloque))) {
    (m[2].match(/"[^"]+"/g) || []).forEach(s => maestro.push({ modulo: m[1], sub: s.replace(/"/g, '') }));
  }
}
ok('0) el maestro se pudo leer (si no, todo lo de abajo es decorado)', maestro.length > 50, maestro.length + ' submódulos');

/* ── El dispatch ── */
const conDispatch = new Map();
{
  const re = /submoduleName === "([^"]+)"/g;
  let m;
  while ((m = re.exec(renderer))) {
    if (conDispatch.has(m[1])) continue;
    const comp = (renderer.slice(m.index, m.index + 900).match(/window\.([A-Za-z0-9_]+)/) || [])[1];
    conDispatch.set(m[1], comp || null);
  }
}

/* ══ 1) La lista de pendientes es exacta ══ */
const pendientesAhora = maestro
  .filter(x => !conDispatch.has(x.sub))
  .map(x => x.modulo + ' » ' + x.sub)
  .sort();
const nuevos = pendientesAhora.filter(p => PENDIENTES_CONOCIDOS.indexOf(p) === -1);
const resueltos = PENDIENTES_CONOCIDOS.filter(p => pendientesAhora.indexOf(p) === -1);

ok('1) ningún submódulo NUEVO quedó sin dispatch (caería en "Funcionalidad en Desarrollo")',
  nuevos.length === 0,
  nuevos.length ? 'FALTARON: ' + nuevos.join(' | ') : 'pendientes=' + pendientesAhora.length);
ok('1) ningún submódulo se dio por terminado sin avisar (si ya tiene dispatch, bórralo de la lista a propósito)',
  resueltos.length === 0,
  resueltos.length ? 'YA TIENEN DISPATCH, sácalos de la lista: ' + resueltos.join(' | ') : PENDIENTES_CONOCIDOS.length + ' pendientes conocidos');

/* ══ 2) Todo componente del dispatch está cargado en index.html ══ */
// Un <script> cuenta solo si el navegador lo EJECUTA. Con type="text/plain"
// el src está pero el archivo no se carga: la guarda lo daba por bueno y el
// submódulo quedaba mudo. (M2 lo encontró.)
const TIPOS_QUE_NO_EJECUTAN = ['text/plain', 'text/template', 'application/json', 'text/x-template'];
const scriptsDeIndex = new Set();
{
  const re = /<script[^>]+src=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(indexHtml))) {
    const tag = m[0];
    const tipo = (tag.match(/\stype=["']([^"']+)["']/i) || [])[1];
    if (tipo && TIPOS_QUE_NO_EJECUTAN.indexOf(tipo.toLowerCase()) !== -1) continue;
    scriptsDeIndex.add(m[1].split('?')[0].replace(/^\.?\//, ''));
  }
}
function archivoQueDeclara(nombre) {
  if (!nombre) return [];
  // `global.X = X` en el navegador ES `window.X = X`: los dos cuentan.
  const re = new RegExp('(?:window|global)\\.' + nombre + '\\s*=');
  const out = [];
  (function recorre(dir, prof) {
    if (prof > 4) return;
    let es;
    try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const en of es) {
      if (['node_modules', '.git', 'Temp', 'tools', 'docs'].indexOf(en.name) !== -1) continue;
      if (/\.bak/.test(en.name)) continue;
      const p = path.join(dir, en.name);
      if (en.isDirectory()) { recorre(p, prof + 1); continue; }
      if (!/\.(js|html)$/.test(en.name)) continue;
      let st; try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.size > 1200000) continue;
      if (re.test(leer(p))) out.push(path.relative(APP, p).replace(/\\/g, '/'));
    }
  })(APP, 0);
  return out;
}
const usados = [...conDispatch.entries()].filter(e => e[1]);
const sinCargar = usados.filter(e => {
  const archs = archivoQueDeclara(e[1]);
  return !archs.some(a => scriptsDeIndex.has(a));
});
ok('2) todo componente que el dispatch instancia está cargado en index.html',
  usados.length >= 40 && sinCargar.length === 0,
  sinCargar.length
    ? sinCargar.map(e => e[0] + ' -> ' + e[1] + ' (lo declara: ' + (archivoQueDeclara(e[1]).join(',') || 'NADIE') + ')').join(' | ')
    : usados.length + ' componentes OK');
ok('2) la guarda encontró suficientes componentes (si fuera 0, la de arriba no probaría nada)',
  usados.length >= 40, usados.length + ' con componente');

/* ══ 3) Cada 2.x con su propia clave de permiso ══ */
const bloquePerm = (renderer.split('const SUBMODULE_PERMISSION_MAP_UI')[1] || '').split(']);')[0];
const claves2x = new Map();
{
  const re = /\[\s*'([^']+)'\s*,\s*'([^']+)'\s*\]/g;
  let m;
  while ((m = re.exec(bloquePerm))) {
    if (/^2\./.test(m[1])) claves2x.set(m[1], m[2]);
  }
}
// La MISMA normalizacion que normalizeTextKey() del shell (renderer.js): quita
// acentos, pasa a minusculas y compacta espacios. OJO: deja los puntos y los
// guiones, que son parte de la clave ('2.1.1 politica del sg-sst').
const normalizar = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().trim().replace(/\s+/g, ' ');
const sub2x = maestro.filter(x => /^2\./.test(x.sub));
const sinClave = sub2x.filter(x => !claves2x.has(normalizar(x.sub)));
ok('3) los ' + sub2x.length + ' submódulos de Gestión Integral tienen clave de permiso propia',
  sub2x.length === 13 && sinClave.length === 0 && claves2x.size === sub2x.length,
  sinClave.length ? 'sin clave: ' + sinClave.map(x => x.sub).join(' | ') : claves2x.size + ' claves');
const compartidos = [];
const recursoVisto = new Map();
claves2x.forEach((recurso, sub) => {
  if (recursoVisto.has(recurso)) compartidos.push(sub + ' y ' + recursoVisto.get(recurso) + ' -> ' + recurso);
  else recursoVisto.set(recurso, sub);
});
ok('3) ningún submódulo de Gestión Integral comparte clave con otro (si comparten, abrir uno abre el otro)',
  compartidos.length === 0,
  compartidos.length ? compartidos.join(' | ') : 'las ' + claves2x.size + ' son propias');

/* ══ 4) Ningún archivo suelto de main/ declara un componente ══ */
const SUELTOS = [];
{
  const dirMain = path.join(APP, 'main');
  let es; try { es = fs.readdirSync(dirMain); } catch (e) { es = []; }
  es.forEach(f => {
    if (!/\.js$/.test(f) || /^test-/.test(f)) return;
    const t = leer(path.join(dirMain, f));
    const m = t.match(/window\.[A-Z][A-Za-z]*(Component|View)\s*=/);
    if (m) SUELTOS.push(f + ' declara ' + m[0]);
  });
}
ok('4) ningún archivo suelto de main/ declara window.XxxComponent (se confunde con el dispatch)',
  SUELTOS.length === 0,
  SUELTOS.length ? SUELTOS.join(' | ') : 'main/ limpio');

/* ══ 5) index.js exporta todas las carpetas ══ */
const FALTAN_EXPORT = (() => {
  const base = path.join(APP, 'modules', 'gestion-integral');
  let carpetas = []; try { carpetas = fs.readdirSync(base).filter(d => fs.statSync(path.join(base, d)).isDirectory()); } catch (e) { return ['<no existe modules/gestion-integral>']; }
  const idx = leer(path.join(base, 'index.js'));
  return carpetas.filter(c => idx.indexOf("require('./" + c + "')") === -1);
})();
ok('5) modules/gestion-integral/index.js exporta TODAS las carpetas que existen',
  FALTAN_EXPORT.length === 0,
  FALTAN_EXPORT.length ? 'no exporta: ' + FALTAN_EXPORT.join(', ') : 'todas exportadas');

/* ══ Resultado ══ */
let failed = 0;
console.log('\n=======================================');
console.log('  📦828-T0 · El shell del dashboard');
console.log('=======================================');
checks.forEach(c => {
  if (!c.ok) failed++;
  console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
});
console.log('---');
console.log((checks.length - failed) + '/' + checks.length + ' OK');
console.log('=======================================');
process.exit(failed === 0 ? 0 : 1);

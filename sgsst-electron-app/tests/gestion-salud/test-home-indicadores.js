const fs = require('fs');
const path = require('path');

const checks = [];
function ok(name, cond) { checks.push({ name, ok: !!cond }); }

const f = path.join(__dirname, '..', '..', 'modules', 'gestion-salud', 'gestion-salud-home.js');
const src = fs.readFileSync(f, 'utf8');

// 📦791 — La gráfica de Indicadores de Salud leía campos que el backend NO devuelve
// (`frecuencia`/`severidad`/`prevalencia`/`incidencia` escalares) y mostraba 0.00.
ok('HOME: NO lee indicadores.frecuencia directo', !/value:\s*Number\(indicadores\.frecuencia\)\s*\|\|\s*0/.test(src));
ok('HOME: deriva frecuencia de frecuenciaMensual', /indicadores\.frecuenciaMensual/.test(src) && /indiceFrecuencia/.test(src));
ok('HOME: deriva severidad de severidadMensual', /indicadores\.severidadMensual/.test(src) && /indiceSeveridad/.test(src));
ok('HOME: prevalencia desde config.prevalenciaEL', /cfg\.prevalenciaEL|config\.prevalenciaEL/.test(src));
ok('HOME: incidencia desde config.incidenciaEL', /cfg\.incidenciaEL|config\.incidenciaEL/.test(src));
ok('HOME: sigue aceptando el escalar (backward-compat)', /Number\(indicadores\.frecuencia\)/.test(src) && /Number\(indicadores\.severidad\)/.test(src));
ok('HOME: promedio de meses no-cero (criterio 3.3.1)', /fNZ\.length[\s\S]{0,120}?reduce/.test(src));
ok('HOME: comentario con la causa raiz', /📦791/.test(src));

var failed = 0;
checks.forEach(function (c) { console.log((c.ok ? '\u2705' : '\u274C') + ' ' + c.name); if (!c.ok) failed++; });
console.log('\n' + checks.length + ' checks, ' + (checks.length - failed) + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);

// test-panel-cards-v2.js
// Las 4 tarjetas de indicador del Panel de Control deben seguir el diseño
// "card dentro de card" (el mismo de Recursos 📦1113, Inducciones 📦1114 y
// Presupuesto 📦1117).
//
// ── Por qué este test existe ────────────────────────────────────────────────
// La ronda del 28-nov-2026 llevó el diseño al Panel de Control. Lo que cambia
// respecto del patrón viejo:
//   1. La BARRA de progreso sale (su % ya estaba en el valor) y entra la CURVA
//      de 12 meses, con dato REAL: accidentes por mes, vencidas por mes y avance
//      del plan mes a mes.
//   2. Aparece el pie "Ver detalle →" en la tarjeta EXTERNA, que lleva al módulo
//      donde vive el dato.
//   3. El HERO (bloque .kair-hero con su % de cumplimiento) NO se toca.
//
// Qué comprueba, por CONTENIDO (nunca por número de línea) y con el JS REAL
// ejecutado en un vm (no mirando el texto):
//   1. Las 4 tarjetas son card dentro de card y el pie queda FUERA de la interna.
//   2. Las barras se fueron de verdad.
//   3. El hero sigue intacto.
//   4. La curva escala uniforme, no se estira y no inventa dato.
//   5. La ventana de la curva es de enero al mes en curso.
//   6. Las series llegan del backend (main.js) y el renderer las usa.
//   7. El pie lleva al módulo correcto de cada indicador.
//   8. El CSS es scopeado, tiene contraparte oscura y usa tokens.
//   9. Mordidas: el test se cae cuando se rompe el diseño a propósito.
//
// Uso: node main/test-panel-cards-v2.js

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const RENDERER = path.join(RAIZ, 'renderer.js');
const CSS = path.join(RAIZ, 'shared', 'kair-premium.css');
const MAIN = path.join(RAIZ, 'main.js');

const ORIGINAL = {
    rend: fs.readFileSync(RENDERER, 'utf8'),
    css: fs.readFileSync(CSS, 'utf8'),
    main: fs.readFileSync(MAIN, 'utf8')
};

// ── Utilidades ──────────────────────────────────────────────────────────────

// El cuerpo de una función: se cuenta el balance de llaves y se saltan las comillas.
function cuerpoDeFuncion(codigo, nombre) {
    const i = codigo.indexOf('function ' + nombre + '(');
    if (i === -1) return '';
    let j = codigo.indexOf('{', i);
    let depth = 0, k = j, comilla = null;
    for (; k < codigo.length; k++) {
        const ch = codigo[k];
        if (comilla) {
            if (ch === '\\') { k++; continue; }
            if (ch === comilla) comilla = null;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { comilla = ch; continue; }
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) break; }
    }
    return codigo.slice(i, k + 1);
}

// El codigo SIN comentarios (un check que busca "preserveAspectRatio" no puede
// encontrarlo en la frase que explica por que no se usa).
function sinComentarios(codigo) {
    let salida = '', estado = 'codigo', delim = '';
    for (let i = 0; i < codigo.length; i++) {
        const ch = codigo[i], sig = codigo[i + 1];
        if (estado === 'codigo') {
            if (ch === '/' && sig === '/') { estado = 'linea'; i++; continue; }
            if (ch === '/' && sig === '*') { estado = 'bloque'; i++; continue; }
            if (ch === '"' || ch === "'" || ch === '`') { estado = 'cadena'; delim = ch; salida += ch; continue; }
            salida += ch; continue;
        }
        if (estado === 'linea') { if (ch === '\n') { estado = 'codigo'; salida += ch; } continue; }
        if (estado === 'bloque') { if (ch === '*' && sig === '/') { estado = 'codigo'; i++; } continue; }
        if (estado === 'cadena') {
            if (ch === '\\') { salida += codigo.slice(i, i + 2); i++; continue; }
            salida += ch;
            if (ch === delim) estado = 'codigo';
            continue;
        }
    }
    return salida;
}

// ── La bateria de checks (se puede correr sobre los archivos mutados) ───────
function correrChecks(fuentes, conVm) {
    const checks = [];
    const ok = (n, c, e) => checks.push({ name: n, ok: !!c, extra: e });
    const rend = fuentes.rend, css = fuentes.css, main = fuentes.main;

    const fnSpark = cuerpoDeFuncion(rend, 'dashSparkline');
    const fnKpis = cuerpoDeFuncion(rend, 'renderDashKpis');
    const fnHero = cuerpoDeFuncion(rend, 'renderDashHero');
    const codigo = sinComentarios(fnSpark + '\n' + fnKpis + '\n' + fnHero);

    // ── 1) La estructura: card dentro de card ───────────────────────────────
    const MARCAS = [
        '<article class="kair-kpi kair-kpi--v2">',
        '<div class="kair-kpi__inner">',
        '<div class="kair-kpi__top">',
        '<div class="kair-kpi__valuerow">',
        '<div class="kair-kpi__value',
        '<p class="kair-kpi__sub">',
        '<div class="kair-kpi__spark kair-kpi__spark',
        '<button type="button" class="kair-kpi__foot"'
    ];
    for (const m of MARCAS) {
        ok('1) el render usa ' + m, fnKpis.indexOf(m) !== -1, m);
    }
    // El pie FUERA de la interna se verifica en el HTML GENERADO (abajo): en el
    // código las piezas van sueltas, concatenadas.

    // ── 2) Las barras se fueron ─────────────────────────────────────────────
    ok('2) la barra de progreso sale de las tarjetas',
        fnKpis.indexOf('kair-kpi__bar') === -1 && fnKpis.indexOf('kair-kpi__fill') === -1);
    ok('2) el render ya no pinta el ancho de la barra',
        fnKpis.indexOf('data-pct') === -1 && fnKpis.indexOf('requestAnimationFrame') === -1);

    // ── 3) El hero no se tocó ───────────────────────────────────────────────
    ok('3) el hero sigue con su score y su medidor',
        fnHero.indexOf("getElementById('hero-title')") !== -1 &&
        fnHero.indexOf("getElementById('hero-sub')") !== -1 &&
        fnHero.indexOf("getElementById('hero-pct')") !== -1 &&
        fnHero.indexOf("getElementById('hero-meter')") !== -1);
    ok('3) al hero no le colgaron curva, chip ni pie',
        fnHero.indexOf('spark') === -1 && fnHero.indexOf('kpi__foot') === -1 && fnHero.indexOf('kpi__inner') === -1);
    ok('3) el hero conserva su fondo oscuro en los tres temas',
        /\.kair-premium \.kair-hero\{[^}]*background:#14213D/.test(css));

    // ── 4) La curva ─────────────────────────────────────────────────────────
    ok('4) la curva usa un viewBox fijo (escala uniforme)',
        fnSpark.indexOf('viewBox="0 0 ') !== -1 && /var W = 200, H = 34/.test(fnSpark));
    ok('4) la curva NO estira el dibujo', codigo.indexOf('preserveAspectRatio') === -1);
    ok('4) el SVG escala con width:100% + height:auto',
        /\.kair-kpi__spark__svg\{[^}]*width:100%[^}]*height:auto/.test(css));
    ok('4) sin dato no hay curva: se dibuja una linea de puntos',
        fnSpark.indexOf('if (!(max > 0)) {') !== -1 && fnSpark.indexOf('stroke-dasharray="3 4"') !== -1);

    // ── 5) La ventana de la curva ───────────────────────────────────────────
    ok('5) la ventana va de enero al mes en curso',
        /var ventana = Math\.min\(12, new Date\(\)\.getMonth\(\) \+ 1\)/.test(fnKpis) &&
        fnKpis.indexOf('.slice(0, ventana)') !== -1);

    // ── 6) El dato: el renderer lo pide y el backend lo manda ───────────────
    for (const k of ['accidents_monthly', 'overdue_docs_monthly', 'plan_monthly']) {
        ok('6) el renderer usa la serie ' + k, fnKpis.indexOf('k.' + k) !== -1);
        ok('6) el backend manda la serie ' + k, main.indexOf('dashboard_data.kpis.' + k) !== -1);
    }
    ok('6) la serie de accidentes se arma por mes (no inventada)',
        main.indexOf('monthlyCount[mesIdx]++') !== -1 &&
        main.indexOf('dashboard_data.kpis.accidents_monthly = monthlyCount;') !== -1);
    ok('6) la serie de vencidas se arma por mes de vencimiento',
        main.indexOf('vencidasPorMes[m]++') !== -1);
    ok('6) la serie del plan termina en el mismo % que el KPI',
        main.indexOf('stats.avancePorMes[m] = stats.totalActividades > 0') !== -1 &&
        main.indexOf('dashboard_data.kpis.plan_monthly = planTrabajoStats.avancePorMes;') !== -1);

    // ── 7) El pie lleva al módulo correcto ─────────────────────────────────
    const NAVEGA = [
        ['accidentes', 'investigacion', '3.2.3'],
        ['pric', 'ausentismo', '3.3.6'],
        ['documentos', 'capacitaciones', '1.2.1'],
        ['plan', 'plan-trabajo', '2.4.1']
    ];
    for (const [id, mod, sub] of NAVEGA) {
        ok('7) la card ' + id + ' apunta al módulo ' + mod + ' > ' + sub,
            new RegExp("id: '" + id + "'[\\s\\S]{0,700}?mod: '" + mod + "'[\\s\\S]{0,200}?sub2: '" + sub).test(fnKpis),
            id);
    }
    ok('7) el pie navega con la función del shell (no con postMessage)',
        fnKpis.indexOf('navigateToModule(') !== -1 && fnKpis.indexOf('postMessage') === -1);

    // ── 8) El CSS: scopeado, con contraparte oscura y con tokens ───────────
    ok('8) las reglas nuevas viven bajo .kair-premium',
        /\.kair-premium \.kair-kpi--v2\{/.test(css) && /\.kair-premium \.kair-kpi--v2 \.kair-kpi__inner\{/.test(css));
    ok('8) la parte clara no declara reglas de tema (el bloque oscuro es aditivo)',
        css.indexOf('[data-theme') > css.indexOf('.kair-premium .kair-kpi--v2{'));
    ok('8) la card externa y la interna tienen contraparte oscura',
        /\[data-theme\^="dark"\] \.kair-premium \.kair-kpi--v2\{/.test(css) &&
        /\[data-theme\^="dark"\] \.kair-premium \.kair-kpi--v2 \.kair-kpi__inner\{/.test(css) &&
        /\[data-theme\^="dark"\] \.kair-premium \.kair-kpi--v2 \.kair-kpi__foot\{/.test(css));
    ok('8) los tonos de la curva salen de tokens (no de colores fijos)',
        /\.kair-premium \.kair-kpi__spark--red\{color:var\(--kair-red\)\}/.test(css) &&
        /\.kair-premium \.kair-kpi__spark--green\{color:var\(--kair-green\)\}/.test(css) &&
        /\.kair-premium \.kair-kpi__spark--amber\{color:var\(--kair-amber\)\}/.test(css));
    const iOscuro = css.indexOf('[data-theme^="dark"] .kair-premium{background:var(--content-area-bg');
    ok('8) el bloque oscuro no usa !important',
        iOscuro !== -1 && (css.slice(iOscuro).match(/!important/g) || []).length === 0);

    // ── 9) El JS de verdad ──────────────────────────────────────────────────
    if (conVm !== false) {
        try {
            const slot = { innerHTML: '', querySelectorAll: () => [] };
            const sandbox = {
                document: { getElementById: (id) => (id === 'kpi-slot' ? slot : null) },
                Date: Date, Math: Math, Number: Number, String: String, Array: Array,
                Object: Object, JSON: JSON, isFinite: isFinite,
                DASH_GLYPH: { activity: '<svg a/>', users: '<svg b/>', filex: '<svg c/>', trend: '<svg d/>' },
                dashEsc: (v) => String(v == null ? '' : v),
                navigateToModule: () => {},
                console: console
            };
            sandbox.globalThis = sandbox;
            vm.createContext(sandbox);
            vm.runInContext(fnSpark, sandbox);
            vm.runInContext(fnKpis, sandbox);

            const kpis = {
                accidents_year: 3, accidents_month: 1,
                accidents_monthly: [0, 1, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0],
                pric_active: 0,
                overdue_docs: 2,
                overdue_docs_monthly: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
                compliance: 36,
                plan_monthly: [0, 5, 10, 15, 20, 25, 30, 36, 36, 36, 36, 36]
            };
            vm.runInContext('renderDashKpis({ kpis: ' + JSON.stringify(kpis) + ' });', sandbox);
            const html = slot.innerHTML;

            const ventana = Math.min(12, new Date().getMonth() + 1);
            const arts = html.split('<article class="kair-kpi kair-kpi--v2">');
            ok('9) el render produce 4 tarjetas', arts.length === 5, (arts.length - 1) + ' tarjetas');
            ok('9) cada tarjeta trae el pie', (html.match(/class="kair-kpi__foot"/g) || []).length === 4);
            ok('9) cada tarjeta trae la curva', (html.match(/class="kair-kpi__spark /g) || []).length === 4);
            ok('9) el pie de la card dice "Ver detalle"', (html.match(/<span>Ver detalle<\/span>/g) || []).length === 4);
            ok('9) el chip del plan dice "En ejecución"', html.indexOf('En ejecución') !== -1);
            ok('9) el chip de los documentos dice "Requieren gestión"', html.indexOf('Requieren gestión') !== -1);
            ok('9) el chip del PRIC dice "Bajo control"', html.indexOf('Bajo control') !== -1);
            ok('9) el chip de los accidentes trae el total del mes', html.indexOf('1 este mes') !== -1);
            ok('9) el pie queda FUERA de la card interna (la interna se cierra antes)',
                /<div class="kair-kpi__spark[^"]*"><svg[\s\S]*?<\/svg><\/div><\/div><button type="button" class="kair-kpi__foot"/.test(html),
                'el orden de las piezas en el HTML generado');

            const dAcc = (html.match(/class="kair-kpi__spark__line" d="([^"]*)"/) || [])[1] || '';
            const tramosAcc = (dAcc.match(/Q /g) || []).length;
            ok('9) la curva tiene un tramo por cada mes de la ventana',
                tramosAcc === Math.max(0, ventana - 1), tramosAcc + ' tramos (ventana ' + ventana + ')');

            // La serie del PRIC no existe: la curva tiene que ser la linea de puntos.
            ok('9) sin serie, la curva es una linea de puntos (no un invento)',
                html.indexOf('stroke-dasharray="3 4"') !== -1);
        } catch (err) {
            ok('9) el render del panel se puede ejecutar en un vm', false,
                'error: ' + (err && err.message ? err.message : String(err)));
        }
    }

    return checks;
}

// ── La corrida normal ──────────────────────────────────────────────────────
const checks = correrChecks(ORIGINAL, true);
let failed = 0;
console.log('\n=======================================');
checks.forEach(c => {
    if (!c.ok) failed++;
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
});

// ── Mordidas ────────────────────────────────────────────────────────────────
const MUTACIONES = [
    {
        nombre: 'se quita el scope del CSS',
        aplicar: f => { f.css = f.css.split('.kair-premium .kair-kpi--v2{').join('.kair-kpi--v2{'); },
        check: '8) las reglas nuevas viven bajo .kair-premium'
    },
    {
        nombre: 'se saca la contraparte oscura',
        aplicar: f => { f.css = f.css.split('[data-theme^="dark"] .kair-premium .kair-kpi--v2{').join('[data-theme^="dark"] .kair-fuera{'); },
        check: '8) la card externa y la interna tienen contraparte oscura'
    },
    {
        nombre: 'vuelve la barra',
        aplicar: f => { f.rend = f.rend.split('kair-kpi__spark kair-kpi__spark').join('kair-kpi__bar kair-kpi__spark'); },
        check: '2) la barra de progreso sale de las tarjetas'
    },
    {
        nombre: 'se estira el SVG',
        aplicar: f => { f.rend = f.rend.split('class="kair-kpi__spark__svg"').join('class="kair-kpi__spark__svg" preserveAspectRatio="none"'); },
        check: '4) la curva NO estira el dibujo'
    },
    {
        nombre: 'la curva se inventa el dato',
        aplicar: f => { f.rend = f.rend.split('if (!(max > 0)) {').join('if (false) {'); },
        check: '4) sin dato no hay curva: se dibuja una linea de puntos'
    },
    {
        nombre: 'se le cuelga una curva al hero',
        aplicar: f => { f.rend = f.rend.split('function renderDashHero(data) {').join('function renderDashHero(data) { var spark = "x";'); },
        check: '3) al hero no le colgaron curva, chip ni pie'
    },
    {
        nombre: 'el pie deja de navegar',
        aplicar: f => { f.rend = f.rend.split('navigateToModule(').join('sinNavegar('); },
        check: '7) el pie navega con la función del shell (no con postMessage)'
    },
    {
        nombre: 'la ventana se come todo el año',
        aplicar: f => { f.rend = f.rend.split('Math.min(12, new Date().getMonth() + 1)').join('12'); },
        check: '5) la ventana va de enero al mes en curso'
    },
    {
        nombre: 'el backend deja de mandar la serie',
        aplicar: f => { f.main = f.main.split('dashboard_data.kpis.plan_monthly = planTrabajoStats.avancePorMes;').join(''); },
        check: '6) el backend manda la serie plan_monthly'
    }
];

console.log('\n--- Mordidas ---');
let fallosMordidas = 0;
for (const m of MUTACIONES) {
    const f = { rend: ORIGINAL.rend, css: ORIGINAL.css, main: ORIGINAL.main };
    m.aplicar(f);
    if (f.rend === ORIGINAL.rend && f.css === ORIGINAL.css && f.main === ORIGINAL.main) {
        fallosMordidas++;
        console.log('FAIL  mordida "' + m.nombre + '": la mutación no cambió nada (mutante vacío)');
        continue;
    }
    const res = correrChecks(f, false);
    const objetivo = res.find(c => c.name === m.check);
    if (!objetivo) {
        fallosMordidas++;
        console.log('FAIL  mordida "' + m.nombre + '": no existe el check que tenía que caer');
        continue;
    }
    if (objetivo.ok) {
        fallosMordidas++;
        console.log('FAIL  mordida "' + m.nombre + '": el check "' + m.check + '" siguió en verde');
        continue;
    }
    console.log('OK    mordida "' + m.nombre + '" → cae "' + m.check + '"');
}

const fallosChecks = checks.filter(c => !c.ok).length;
console.log('---');
console.log((checks.length - fallosChecks) + '/' + checks.length + ' OK (checks)');
console.log((MUTACIONES.length - fallosMordidas) + '/' + MUTACIONES.length + ' OK (mordidas)');
console.log('=======================================');
process.exit((fallosChecks === 0 && fallosMordidas === 0) ? 0 : 1);

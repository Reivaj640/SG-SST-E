// test-presupuesto-cards-v2.js
// Las 3 métricas de la vista de gestión de presupuesto deben seguir el diseño
// "card dentro de card" (el mismo del piloto de Recursos 📦1113 y de Inducciones 📦1114).
//
// ── Por qué este test existe ────────────────────────────────────────────────
// La ronda del 28-nov-2026 llevó el diseño de "card dentro de card" al módulo de
// Presupuesto. Lo que cambia respecto del patrón viejo de 4 piezas:
//   1. La BARRA de progreso sale y su dato (el %) pasa al chip de la card.
//   2. Entra la CURVA de 12 meses, con dato real (ejecutado por mes, acumulado y saldo).
//   3. Aparece el pie "Ver detalle →" en la card EXTERNA.
//   4. El HERO (bloque .kair-hero-card con su % de cumplimiento) NO se toca.
//
// Qué comprueba, todo por CONTENIDO (nunca por número de línea: un control que
// apunta a una posición se rompe en cuanto el documento crece) y con el JS REAL
// ejecutado en un vm (no mirando el texto):
//   1. Cada card es una externa con la interna adentro, y la interna lleva las 4 piezas.
//   2. Las barras se fueron de verdad.
//   3. Los ids existen y son únicos.
//   4. updateSummary() escribe los valores, los chips y pinta las curvas.
//   5. El semáforo sigue siendo el de Recursos (>=70 verde, >=40 ámbar, <40 rojo).
//   6. El hero sigue intacto.
//   7. La curva es SVG nativo, escala uniforme y no se inventa sin dato.
//   8. Las reglas nuevas viven en un ámbito propio: la clase compartida no se toca.
//   9. Cero colores fijos: todo sale de tokens (el modo oscuro sale solo).
//  10. El pie "Ver detalle" es navegación interna: no habla con el padre.
//  11. El sello (cache-bust) del iframe tiene forma de sello.
//  12. Con el JS de verdad: los chips, el semáforo y las 3 curvas salen bien.
//  13. Mordidas: el test se cae cuando se rompe el diseño a propósito.
//
// Uso: node main/test-presupuesto-cards-v2.js

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const GESTION = path.join(RAIZ, 'modules', 'recursos', 'presupuesto', 'presupuesto-gestion.html');
const LOGICA = path.join(RAIZ, 'modules', 'recursos', 'presupuesto', 'presupuesto-logic.js');
const INDEX = path.join(RAIZ, 'index.html');

const htmlOriginal = fs.readFileSync(GESTION, 'utf8');
const logicaOriginal = fs.readFileSync(LOGICA, 'utf8');
const indexOriginal = fs.readFileSync(INDEX, 'utf8');

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
    return codigo.slice(j + 1, k);
}

// El bloque de CSS nuevo (📦1117): va del comentario hasta las reglas del hero.
function bloqueCss(html) {
    const a = html.indexOf('/* 📦1117 · CARDS KPI v2');
    const b = html.indexOf('.pres-hero-score {');
    if (a === -1 || b === -1 || b < a) return '';
    return html.slice(a, b);
}

// La zona del strip: el hero + las 3 cards (termina donde empieza la tabla).
function zonaStrip(html) {
    const a = html.indexOf('<div class="kair-premium-strip');
    const b = html.indexOf('<div class="k-section-card');
    if (a === -1 || b === -1 || b < a) return '';
    return html.slice(a, b);
}

// La zona del hero: del inicio del hero hasta la primera card de métrica.
function zonaHero(html) {
    const a = html.indexOf('<div class="kair-hero-card">');
    const b = html.indexOf('<div class="kair-metric-card');
    if (a === -1 || b === -1 || b < a) return '';
    return html.slice(a, b);
}

// El script en linea de la vista (el unico <script> sin atributos).
function scriptInline(html) {
    const m = html.match(/<script>([\s\S]*?)<\/script>/);
    return m ? m[1] : '';
}

// El codigo SIN comentarios: un check que busca "preserveAspectRatio" no puede
// encontrarlo en la frase que explica por que no se usa.
function sinComentarios(codigo) {
    let salida = '';
    let estado = 'codigo';
    let delim = '';
    for (let i = 0; i < codigo.length; i++) {
        const ch = codigo[i];
        const sig = codigo[i + 1];
        if (estado === 'codigo') {
            if (ch === '/' && sig === '/') { estado = 'linea'; i++; continue; }
            if (ch === '/' && sig === '*') { estado = 'bloque'; i++; continue; }
            if (ch === '"' || ch === "'" || ch === '`') { estado = 'cadena'; delim = ch; salida += ch; continue; }
            salida += ch;
            continue;
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

// ── La bateria de checks ────────────────────────────────────────────────────
const CARDS = [
    { nombre: 'Presupuesto Total', valor: 'totalPresupuesto', desc: 'descTotalPresupuesto', spark: 'sparkTotal', detalle: 'asignacion' },
    { nombre: 'Ejecutado', valor: 'totalEmpresa', desc: 'descEjecutado', spark: 'sparkEjecutado', detalle: 'ejecutado' },
    { nombre: 'Saldo Disponible', valor: 'saldoDisponible', desc: 'descSaldo', spark: 'sparkSaldo', detalle: 'saldo' }
];

function correrChecks(html, logica, opciones) {
    const opts = opciones || {};
    const checks = [];
    const ok = (n, c, e) => checks.push({ name: n, ok: !!c, extra: e });

    const css = bloqueCss(html);
    const strip = zonaStrip(html);
    const hero = zonaHero(html);
    const js = scriptInline(html);
    const jsCodigo = sinComentarios(js);

    // ── 1) Card dentro de card ──────────────────────────────────────────────
    CARDS.forEach(c => {
        const re = new RegExp(
            '<div class="kair-metric-card[^"]*kair-metric-card--v2[^"]*"[^>]*>\\s*' +
            '<div class="kair-metric-inner">\\s*' +
            '<span class="kair-metric-head">[^<]*</span>\\s*' +
            '<div class="kair-metric-value">\\s*' +
            '<span id="' + c.valor + '">[^<]*</span>\\s*' +
            '<span class="kair-metric-badge[^"]*"[^>]*>[^<]*</span>\\s*' +
            '</div>\\s*' +
            '<p class="kair-metric-desc" id="' + c.desc + '">[^<]*</p>\\s*' +
            '<div class="kair-spark" id="' + c.spark + '"[^>]*></div>\\s*' +
            '</div>\\s*' +
            '<button type="button" class="kair-metric-foot" data-kair-pres-detalle="' + c.detalle + '">'
        );
        ok('1) la card de ' + c.nombre + ' es card dentro de card y trae las 4 piezas',
            re.test(html), c.nombre);
    });

    // ── 2) Las barras se fueron ─────────────────────────────────────────────
    ok('2) las barras de progreso salieron de las 3 cards', strip.indexOf('kair-progress') === -1);
    ok('2) los ids barra* ya no existen en la vista',
        ['barraTotalPresupuesto', 'barraEjecutado', 'barraSaldo'].every(id => html.indexOf(id) === -1));

    // ── 3) Los ids existen y son únicos ────────────────────────────────────
    const IDS = ['totalPresupuesto', 'totalEmpresa', 'saldoDisponible', 'badgeEjecutado', 'badgeSaldo',
        'sparkTotal', 'sparkEjecutado', 'sparkSaldo', 'cardEjecutado', 'descTotalPresupuesto',
        'descEjecutado', 'descSaldo', 'totalArl'];
    const repetidos = IDS.filter(id => (html.match(new RegExp('id="' + id + '"', 'g')) || []).length !== 1);
    ok('3) cada id de la vista existe exactamente una vez', repetidos.length === 0, repetidos.join(', '));

    // ── 4) updateSummary() ──────────────────────────────────────────────────
    const cuerpoUpd = cuerpoDeFuncion(js, 'updateSummary');
    ok('4) updateSummary() escribe los 3 valores',
        ['totalPresupuesto', 'totalEmpresa', 'saldoDisponible']
            .every(id => cuerpoUpd.indexOf("getElementById('" + id + "').textContent") !== -1));
    ok('4) updateSummary() escribe el % en los 2 chips',
        ['badgeEjecutado', 'badgeSaldo']
            .every(id => cuerpoUpd.indexOf("getElementById('" + id + "').textContent") !== -1));
    ok('4) updateSummary() sigue escribiendo el % del hero',
        cuerpoUpd.indexOf("getElementById('totalArl').textContent") !== -1);
    ok('4) updateSummary() pinta las 3 curvas', cuerpoUpd.indexOf('pintarCurvas(') !== -1);

    // ── 5) El semáforo ──────────────────────────────────────────────────────
    ok('5) el semáforo quita las dos variantes antes de volver a ponerlas',
        /classList\.remove\([^)]*--warning[^)]*--danger/.test(cuerpoUpd));
    ok('5) el semáforo usa los umbrales 40 (rojo) y 70 (ámbar)',
        /pctEjecucion\s*<\s*40/.test(cuerpoUpd) && /pctEjecucion\s*<\s*70/.test(cuerpoUpd));

    // ── 6) El hero no se tocó ───────────────────────────────────────────────
    ok('6) el hero conserva su score (% de cumplimiento)',
        hero.indexOf('pres-hero-score') !== -1 && hero.indexOf('id="totalArl"') !== -1, 'hero=' + hero.length + ' chars');
    ok('6) al hero no le colgaron curva, chip, pie ni barra',
        hero.indexOf('kair-spark') === -1 && hero.indexOf('kair-metric-badge') === -1 &&
        hero.indexOf('kair-metric-foot') === -1 && hero.indexOf('kair-progress') === -1);

    // ── 7) La curva ─────────────────────────────────────────────────────────
    const cuerpoSpark = cuerpoDeFuncion(js, 'buildPresSpark');
    const cuerpoCurvas = cuerpoDeFuncion(js, 'pintarCurvas');
    ok('7) la curva usa un viewBox fijo (escala uniforme)',
        cuerpoSpark.indexOf('viewBox="0 0 ') !== -1 && /const W = 200, H = 34/.test(cuerpoSpark));
    ok('7) la curva NO estira el dibujo', jsCodigo.indexOf('preserveAspectRatio') === -1);
    ok('7) el SVG escala con width:100% + height:auto',
        /\.kair-spark__svg\s*\{[^}]*width:\s*100%[^}]*height:\s*auto/.test(css));
    ok('7) las 3 curvas se pintan en los 3 contenedores',
        ['sparkTotal', 'sparkEjecutado', 'sparkSaldo'].every(id => cuerpoCurvas.indexOf("'" + id + "'") !== -1));
    ok('7) sin dato no hay curva: se dibuja una línea de puntos',
        cuerpoSpark.indexOf('stroke-dasharray="3 4"') !== -1);
    ok('7) la serie sale de las 12 columnas de mes',
        cuerpoDeFuncion(js, 'ejecutadoPorMes').indexOf('MESES_PRES.forEach') !== -1);
    ok('7) el saldo de la curva no puede ser negativo',
        cuerpoCurvas.indexOf('Math.max(0, totalP - v)') !== -1);

    // ── 8) Ámbito propio: la clase compartida no se toca ────────────────────
    const reglas = css.match(/^[^\n{}]*\{[^}]*\}/gm) || [];
    const sinAmbito = reglas.filter(r => {
        const sel = r.split('{')[0];
        return /kair-metric-card--v2|kair-metric-inner|kair-metric-badge|kair-metric-foot|kair-spark/.test(sel) &&
            sel.indexOf('.kair-presupuesto-strip') === -1;
    });
    ok('8) ninguna regla nueva se sale del ámbito .kair-presupuesto-strip',
        sinAmbito.length === 0, sinAmbito.join(' | '));
    ok('8) el strip lleva la clase de ámbito',
        /<div class="kair-premium-strip kair-presupuesto-strip">/.test(html));
    ok('8) el strip conserva su grid de 4 columnas (hero + 3 cards)',
        /\.kair-premium-strip\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*1\.25fr repeat\(3,\s*1fr\)/.test(html));

    // ── 9) Cero colores fijos ───────────────────────────────────────────────
    ok('9) el CSS nuevo no tiene colores fijos',
        !/#[0-9a-fA-F]{3,8}\b/.test(css) && css.indexOf('rgb(') === -1 && css.indexOf('hsl(') === -1);

    // ── 10) El pie es navegación interna ────────────────────────────────────
    const cuerpoIr = cuerpoDeFuncion(js, 'irAPartidas');
    ok('10) el pie "Ver detalle" no hace postMessage (es navegación interna)',
        cuerpoIr.indexOf('postMessage') === -1);
    ok('10) el pie baja a la tabla de partidas',
        cuerpoIr.indexOf('budgetTable') !== -1 && cuerpoIr.indexOf('scrollIntoView') !== -1);
    ok('10) el pie se conecta a los 3 botones',
        /\[data-kair-pres-detalle\]/.test(js) &&
        js.indexOf("irAPartidas(btn.getAttribute('data-kair-pres-detalle'))") !== -1);

    // ── 11) El sello del iframe ─────────────────────────────────────────────
    ok('11) el iframe de la vista de gestión lleva sello de cache-bust',
        /presupuesto-gestion\.html\?v=(?:[A-Z]+-)?\d{8}-[A-Za-z0-9-]+/.test(logica));
    ok('11) el sello viejo (presupuesto-barras) ya no está',
        logica.indexOf('PRE-20261126-presupuesto-barras') === -1);
    // El sello vive en DOS sitios: la URL del iframe (en la logica) y el <script> que
    // carga esa logica (en index.html). Si sube uno y no el otro, la app se queda con
    // el HTML viejo: el archivo viejo pide el iframe viejo.
    ok('11) el sello de presupuesto-logic.js en index.html tiene forma de sello',
        /presupuesto-logic\.js\?v=(?:[A-Z]+-)?\d{8}-[A-Za-z0-9-]+/.test(indexOriginal));
    ok('11) el sello viejo de presupuesto-logic.js en index.html ya no está',
        indexOriginal.indexOf('PRE-20260930-toast-realm-fix') === -1);

    // ── 12) El JS de verdad ─────────────────────────────────────────────────
    if (opts.vm !== false) {
        let detalle = '';
        let vmOk = false;
        try {
            const els = new Map();
            const mkEl = (id) => ({
                id: id, textContent: '', innerHTML: '', style: {}, children: [],
                classList: {
                    _c: [],
                    add(c) { if (this._c.indexOf(c) === -1) this._c.push(c); },
                    remove() {
                        const cs = Array.prototype.slice.call(arguments);
                        this._c = this._c.filter(c => cs.indexOf(c) === -1);
                    },
                    contains(c) { return this._c.indexOf(c) !== -1; }
                }
            });
            const doc = {
                getElementById(id) { if (!els.has(id)) els.set(id, mkEl(id)); return els.get(id); },
                querySelectorAll() { return []; },
                createElement(tag) { return mkEl(tag); },
                addEventListener() {}
            };
            const caja = {
                document: doc, console: console,
                window: { parent: {}, addEventListener() {}, KAIRToast: null, KairConfirm: null },
                setTimeout: setTimeout, clearTimeout: clearTimeout,
                Math: Math, Number: Number, String: String, Array: Array, Object: Object,
                JSON: JSON, Date: Date, Intl: Intl, isFinite: isFinite,
                parseFloat: parseFloat, parseInt: parseInt
            };
            caja.globalThis = caja;
            vm.createContext(caja);
            vm.runInContext(js, caja);

            const correr = (filas) => {
                vm.runInContext('budgetData = ' + JSON.stringify(filas), caja);
                vm.runInContext('updateSummary()', caja);
            };
            const texto = (id) => els.get(id) ? els.get(id).textContent : '';
            const html2 = (id) => els.get(id) ? els.get(id).innerHTML : '';

            // 1000 asignados, 500 ejecutados (50% → ámbar)
            correr([
                { detalle: 'A', asignacion: 600, ejecutado_acumulado: 300, enero: 100, febrero: 200 },
                { detalle: 'B', asignacion: 400, ejecutado_acumulado: 200, marzo: 200 }
            ]);

            const esperadoTotal = '$' + (1000).toLocaleString('es-CO', { maximumFractionDigits: 0 });
            vmOk = texto('totalPresupuesto') === esperadoTotal;
            ok('12) con el JS real, el total sale de las asignaciones', vmOk,
                texto('totalPresupuesto') + ' (se esperaba ' + esperadoTotal + ')');
            ok('12) con el JS real, el chip de ejecutado trae el %', texto('badgeEjecutado') === '50%',
                texto('badgeEjecutado'));
            ok('12) con el JS real, el chip del saldo trae el %', texto('badgeSaldo') === '50%',
                texto('badgeSaldo'));
            ok('12) con el JS real, el hero sigue con su %', texto('totalArl') === '50%', texto('totalArl'));

            const card = els.get('cardEjecutado');
            ok('12) con el JS real, al 50% la card queda en ámbar',
                !!card && card.classList.contains('kair-metric-card--warning') &&
                !card.classList.contains('kair-metric-card--danger'),
                card ? card.classList._c.join(',') : 'sin card');

            const curvaTotal = html2('sparkTotal');
            // El area repite el mismo trazo: se cuenta SOLO el d de la linea.
            const dLinea = (curvaTotal.match(/class="kair-spark__line" d="([^"]*)"/) || [])[1] || '';
            const nSegmentos = (dLinea.match(/Q /g) || []).length;
            // El dato de prueba tiene 3 meses con ejecucion (enero, febrero, marzo):
            // la curva se recorta a esa ventana y no inventa los meses que faltan.
            ok('12) con el JS real, la curva tiene un tramo por cada mes con dato',
                curvaTotal.indexOf('viewBox="0 0 200 34"') !== -1 && nSegmentos === 2,
                nSegmentos + ' tramos (se esperaban 2)');
            ok('12) con el JS real, las 3 curvas son distintas entre sí',
                curvaTotal !== html2('sparkEjecutado') && curvaTotal !== html2('sparkSaldo') &&
                html2('sparkEjecutado') !== html2('sparkSaldo'));

            // Con los 12 meses con ejecucion, la curva completa tiene 11 tramos.
            const doceMeses = [100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320];
            correr([{
                detalle: 'A', asignacion: 1000000, ejecutado_acumulado: 252000,
                enero: 100, febrero: 120, marzo: 140, abril: 160, mayo: 180, junio: 200,
                julio: 220, agosto: 240, septiembre: 260, octubre: 280, noviembre: 300, diciembre: 320
            }]);
            const dDoce = (html2('sparkTotal').match(/class="kair-spark__line" d="([^"]*)"/) || [])[1] || '';
            ok('12) con el JS real, con 12 meses la curva completa tiene 11 tramos',
                (dDoce.match(/Q /g) || []).length === 11,
                (dDoce.match(/Q /g) || []).length + ' tramos');

            // 90% → verde: las variantes del semáforo tienen que QUITARSE
            correr([
                { detalle: 'A', asignacion: 1000, ejecutado_acumulado: 900, enero: 900 }
            ]);
            ok('12) con el JS real, al 90% se quitan ámbar y rojo',
                !card.classList.contains('kair-metric-card--warning') &&
                !card.classList.contains('kair-metric-card--danger'),
                card.classList._c.join(','));
            ok('12) con el JS real, al 90% el chip dice 90%', texto('badgeEjecutado') === '90%',
                texto('badgeEjecutado'));

            // 20% → rojo
            correr([
                { detalle: 'A', asignacion: 1000, ejecutado_acumulado: 200, enero: 200 }
            ]);
            ok('12) con el JS real, al 20% la card queda en rojo',
                card.classList.contains('kair-metric-card--danger') &&
                !card.classList.contains('kair-metric-card--warning'),
                card.classList._c.join(','));

            // Sin datos: no hay curva inventada
            correr([]);
            ok('12) con el JS real, sin datos la curva es una línea de puntos',
                html2('sparkTotal').indexOf('stroke-dasharray="3 4"') !== -1 &&
                html2('sparkTotal').indexOf('<path') === -1);
        } catch (err) {
            detalle = 'error: ' + (err && err.message ? err.message : String(err));
            ok('12) con el JS real, la vista se puede ejecutar en un vm', false, detalle);
        }
    }

    return checks;
}

// ── La corrida normal ──────────────────────────────────────────────────────
const checks = correrChecks(htmlOriginal, logicaOriginal, {});
let failed = 0;
console.log('\n=======================================');
checks.forEach(c => {
    if (!c.ok) failed++;
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
});

// ── Mordidas: el test se tiene que caer cuando se rompe el diseño ──────────
const MUTACIONES = [
    {
        nombre: 'se quita el ámbito propio',
        buscar: '.kair-presupuesto-strip .kair-metric-card--v2 {',
        cambio: '.kair-metric-card--v2 {',
        check: '8) ninguna regla nueva se sale del ámbito .kair-presupuesto-strip'
    },
    {
        nombre: 'se mete un color fijo',
        buscar: 'background: var(--kair-soft);',
        cambio: 'background: #f2f2f2;',
        check: '9) el CSS nuevo no tiene colores fijos'
    },
    {
        nombre: 'se deja de pintar la curva',
        buscar: 'pintarCurvas(totalP);',
        cambio: '// curva apagada',
        check: '4) updateSummary() pinta las 3 curvas'
    },
    {
        nombre: 'se estira el SVG',
        buscar: 'class="kair-spark__svg"',
        cambio: 'class="kair-spark__svg" preserveAspectRatio="none"',
        check: '7) la curva NO estira el dibujo'
    },
    {
        nombre: 'vuelve la barra',
        buscar: '<div class="kair-spark" id="sparkTotal" aria-hidden="true"></div>',
        cambio: '<div class="kair-spark" id="sparkTotal" aria-hidden="true"></div>'
            + '<div class="kair-progress"><i id="barraEjecutado"></i></div>',
        check: '2) las barras de progreso salieron de las 3 cards'
    },
    {
        nombre: 'se le cuelga una curva al hero',
        buscar: '<div class="pres-hero-score">',
        cambio: '<div class="kair-spark"></div><div class="pres-hero-score">',
        check: '6) al hero no le colgaron curva, chip, pie ni barra'
    },
    {
        nombre: 'se rompe el semáforo',
        buscar: 'if (pctEjecucion < 40)',
        cambio: 'if (pctEjecucion < 0)',
        check: '5) el semáforo usa los umbrales 40 (rojo) y 70 (ámbar)'
    },
    {
        nombre: 'se queda sin grid el strip',
        buscar: '  display: grid; grid-template-columns: 1.25fr repeat(3, 1fr);',
        cambio: '  display: block;',
        check: '8) el strip conserva su grid de 4 columnas (hero + 3 cards)'
    },
    {
        nombre: 'el pie habla con el padre',
        buscar: 'function irAPartidas(columna) {',
        cambio: 'function irAPartidas(columna) { window.parent.postMessage({ action: "ir" }, "*");',
        check: '10) el pie "Ver detalle" no hace postMessage (es navegación interna)'
    }
];

console.log('\n--- Mordidas ---');
let fallosMordidas = 0;
MUTACIONES.forEach(m => {
    if (htmlOriginal.indexOf(m.buscar) === -1) {
        fallosMordidas++;
        failed++;
        console.log('FAIL  mordida "' + m.nombre + '": no se encontró el texto que se iba a romper');
        return;
    }
    const mutado = htmlOriginal.split(m.buscar).join(m.cambio);
    if (mutado === htmlOriginal) {
        fallosMordidas++;
        failed++;
        console.log('FAIL  mordida "' + m.nombre + '": la mutación no cambió nada (mutante vacío)');
        return;
    }
    const res = correrChecks(mutado, logicaOriginal, { vm: false });
    const objetivo = res.find(c => c.name === m.check);
    if (!objetivo) {
        fallosMordidas++;
        failed++;
        console.log('FAIL  mordida "' + m.nombre + '": no existe el check que tenía que caer');
        return;
    }
    if (objetivo.ok) {
        fallosMordidas++;
        failed++;
        console.log('FAIL  mordida "' + m.nombre + '": el check "' + m.check + '" siguió en verde');
        return;
    }
    console.log('OK    mordida "' + m.nombre + '" → cae "' + m.check + '"');
});

const fallosChecks = checks.filter(c => !c.ok).length;
console.log('---');
console.log((checks.length - fallosChecks) + '/' + checks.length + ' OK (checks)');
console.log((MUTACIONES.length - fallosMordidas) + '/' + MUTACIONES.length + ' OK (mordidas)');
console.log('=======================================');
process.exit(failed === 0 ? 0 : 1);

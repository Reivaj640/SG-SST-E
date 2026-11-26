/* Regression test · Modal de inducción (📦1093)
   Verifica que el velo cubra la ventana, que el panel quede centrado, que
   cabecera y pie permanezcan fijos y que solo el cuerpo se desplace.
   Uso: node main/test-inducciones-modal-1093.js */
'use strict';

const fs = require('fs');
const path = require('path');

const appRoot = path.join(__dirname, '..');
const induccionesRoot = path.join(appRoot, 'modules', 'recursos', 'inducciones');
const revisionCssPath = path.join(appRoot, 'modules', 'verificacion', 'revision-alta-direccion', 'revision-alta-direccion.css');

const html = fs.readFileSync(path.join(induccionesRoot, 'inducciones-view.html'), 'utf8');
const css = fs.readFileSync(path.join(induccionesRoot, 'inducciones-view.css'), 'utf8');
const js = fs.readFileSync(path.join(induccionesRoot, 'inducciones-logic.js'), 'utf8');
const revisionCss = fs.readFileSync(revisionCssPath, 'utf8');
const indexHtml = fs.readFileSync(path.join(appRoot, 'index.html'), 'utf8');

const TOKEN = 'INDUCCIONES-20261126-v23-pickers';
const VIEWER_TOKEN = 'INDUCCIONES-20260915-v21-chart-scope-fix';
const RAD_TOKEN = '20261120-modal-scope-1093';

function sinComentariosCss(src) {
  return String(src || '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function sinComentariosJs(src) {
  return String(src || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function escaparRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function reglas(source) {
  const src = sinComentariosCss(source);
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = re.exec(src))) {
    const selector = match[1].trim().replace(/\s+/g, ' ');
    if (!selector || selector.charAt(0) === '@') continue;
    out.push({ selector: selector, body: match[2] });
  }
  return out;
}

const cacheCuerpos = new Map();

function cuerpoRegla(source, selector) {
  let cuerposPorSelector = cacheCuerpos.get(source);
  if (!cuerposPorSelector) {
    cuerposPorSelector = new Map();
    reglas(source).forEach(function (rule) {
      if (!cuerposPorSelector.has(rule.selector)) cuerposPorSelector.set(rule.selector, []);
      cuerposPorSelector.get(rule.selector).push(rule.body);
    });
    cacheCuerpos.set(source, cuerposPorSelector);
  }
  const cuerpos = cuerposPorSelector.get(selector) || [];
  return cuerpos.join(';');
}

function declaracion(source, selector, property) {
  const body = cuerpoRegla(source, selector);
  const re = new RegExp('(?:^|;)\\s*' + escaparRe(property) + '\\s*:\\s*([^;]+)', 'i');
  const match = body.match(re);
  return match ? match[1].trim().replace(/\s+/g, ' ') : '';
}

function metodo(source, name) {
  const src = sinComentariosJs(source);
  const marker = new RegExp('^\\s{2}' + escaparRe(name) + '\\s*\\([^\\n]*\\)\\s*\\{', 'm');
  const match = src.match(marker);
  if (!match) return '';
  const start = src.indexOf('{', match.index);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src.charAt(i) === '{') depth++;
    if (src.charAt(i) === '}') {
      depth--;
      if (depth === 0) return src.slice(match.index, i + 1);
    }
  }
  return '';
}

function evaluar(input) {
  const results = [];
  function check(name, condition) {
    results.push({ name: name, ok: !!condition });
  }
  function decl(label, source, selector, property, expected) {
    const actual = declaracion(source, selector, property);
    check(label + ': ' + property + ' = ' + expected, actual === expected);
  }

  const modalSelector = '.inducciones-container .kair-modal';
  decl('CSS modal completo', input.css, modalSelector, 'position', 'fixed');
  decl('CSS modal completo', input.css, modalSelector, 'inset', '0');
  decl('CSS modal completo', input.css, modalSelector, 'z-index', '500000');
  decl('CSS modal completo', input.css, modalSelector, 'display', 'none');
  decl('CSS modal completo', input.css, modalSelector, 'align-items', 'center');
  decl('CSS modal completo', input.css, modalSelector, 'justify-content', 'center');
  decl('CSS modal completo', input.css, modalSelector, 'width', 'auto');
  decl('CSS modal completo', input.css, modalSelector, 'max-width', 'none');
  decl('CSS modal completo', input.css, modalSelector, 'height', 'auto');
  decl('CSS modal completo', input.css, modalSelector, 'max-height', 'none');
  decl('CSS modal completo', input.css, modalSelector, 'flex-direction', 'row');
  decl('CSS modal completo', input.css, modalSelector, 'overflow', 'visible');
  decl('CSS modal completo', input.css, modalSelector, 'border-radius', '0');
  decl('CSS modal completo', input.css, modalSelector, 'box-shadow', 'none');
  decl('CSS modal completo', input.css, modalSelector, 'animation', 'none');
  decl('CSS modal completo', input.css, modalSelector, 'margin', '0');
  decl('CSS modal completo', input.css, modalSelector, 'transform', 'none');
  decl('CSS modal abierto', input.css, '.inducciones-container .kair-modal.is-open', 'display', 'flex');

  const panelSelector = '.inducciones-container .kair-modal__panel';
  decl('CSS panel', input.css, panelSelector, 'display', 'flex');
  decl('CSS panel', input.css, panelSelector, 'flex-direction', 'column');
  decl('CSS panel', input.css, panelSelector, 'max-height', 'calc(100vh - 48px)');
  decl('CSS panel', input.css, panelSelector, 'overflow', 'hidden');

  const formSelector = '.inducciones-container .kair-modal__panel > form';
  decl('CSS formulario', input.css, formSelector, 'display', 'flex');
  decl('CSS formulario', input.css, formSelector, 'flex-direction', 'column');
  decl('CSS formulario', input.css, formSelector, 'flex', '1');
  decl('CSS formulario', input.css, formSelector, 'min-height', '0');
  decl('CSS formulario', input.css, formSelector, 'overflow', 'hidden');

  const headSelector = '.inducciones-container .kair-modal__head';
  decl('CSS cabecera', input.css, headSelector, 'flex-shrink', '0');
  decl('CSS cabecera', input.css, headSelector, 'padding', '0');
  decl('CSS cabecera', input.css, headSelector, 'border-bottom', 'none');

  const bodySelector = '.inducciones-container .kair-modal__body';
  decl('CSS cuerpo', input.css, bodySelector, 'flex', '1');
  decl('CSS cuerpo', input.css, bodySelector, 'min-height', '0');
  decl('CSS cuerpo', input.css, bodySelector, 'overflow-y', 'auto');
  decl('CSS cuerpo', input.css, bodySelector, 'padding', '0');
  decl('CSS cuerpo', input.css, bodySelector, 'margin-top', '20px');

  const footSelector = '.inducciones-container .kair-modal__foot';
  decl('CSS pie', input.css, footSelector, 'flex-shrink', '0');
  decl('CSS pie', input.css, footSelector, 'padding', '0');
  decl('CSS pie', input.css, footSelector, 'border-top', 'none');
  decl('CSS pie', input.css, footSelector, 'margin-top', '24px');

  const closeSelector = '.inducciones-container .kair-modal__close';
  decl('CSS cierre', input.css, closeSelector, 'background', 'none');
  decl('CSS cierre', input.css, closeSelector, 'border', '0');
  decl('CSS cierre', input.css, closeSelector, 'padding', '0');
  decl('CSS cierre', input.css, closeSelector, 'font-size', 'inherit');
  decl('CSS cierre', input.css, closeSelector, 'line-height', '1');
  decl('CSS cierre', input.css, closeSelector, 'cursor', 'pointer');

  decl('CSS fondo bloqueado', input.css, '.inducciones-container.kair-modal-open', 'overflow', 'hidden!important');

  const leaking = [];
  reglas(input.revisionCss).forEach(function (rule) {
    rule.selector.split(',').forEach(function (part) {
      const selector = part.trim();
      if (/^\.kair-modal(?:-|__|$)/.test(selector) && !/^\.kair-rad-module\s+\.kair-modal/.test(selector)) {
        leaking.push(selector);
      }
    });
  });
  check('CSS 6.1.3: ningun modal global sin scope', leaking.length === 0);

  check('HTML modal inicialmente oculto para lectores de pantalla', /class="kair-modal" id="modal-induccion"[^>]*aria-hidden="true"/.test(input.html));
  const bodyPos = input.html.indexOf('class="kair-modal__body"');
  const footPos = input.html.indexOf('class="kair-modal__foot"');
  check('HTML modal: cuerpo antes del pie', bodyPos > -1 && footPos > bodyPos);
  check('HTML modal: formulario existe', /<form id="form-induccion" novalidate>/.test(input.html));
  check('HTML modal: nombre sin corrector ortografico', /id="ind-nombre"[^>]*spellcheck="false"/.test(input.html));
  check('HTML modal: cedula sin corrector ortografico', /id="ind-cedula"[^>]*spellcheck="false"/.test(input.html));
  check('HTML modal: cargo sin corrector ortografico', /id="ind-cargo"[^>]*spellcheck="false"/.test(input.html));

  const open = metodo(input.js, 'openModal');
  const close = metodo(input.js, 'closeModal');
  check('JS modal abierto: bloquea el fondo', /classList\.add\('kair-modal-open'\)/.test(open));
  check('JS modal abierto: anuncia que esta visible', /setAttribute\('aria-hidden',\s*'false'\)/.test(open));
  check('JS modal cerrado: libera el fondo', /classList\.remove\('kair-modal-open'\)/.test(close));
  check('JS modal cerrado: oculta para lectores de pantalla', /setAttribute\('aria-hidden',\s*'true'\)/.test(close));

  check('JS token de cache vigente', input.js.indexOf(TOKEN) > -1);
  check('HTML token de cache vigente', input.html.indexOf(TOKEN) > -1);
  check('index token de cache vigente para logic.js', new RegExp('inducciones-logic\\.js\\?v=' + TOKEN).test(input.indexHtml));
  check('index conserva el token del viewer.js sin cambios', new RegExp('inducciones-viewer\\.js\\?v=' + VIEWER_TOKEN).test(input.indexHtml));
  check('index token de cache vigente para la hoja global de 6.1.3', new RegExp('revision-alta-direccion\\.css\\?v=' + RAD_TOKEN).test(input.indexHtml));
  check('index: sin token viejo de la hoja global de 6.1.3', input.indexHtml.indexOf('20261014-tokens889-modulo') === -1);

  return results;
}

function mutarDeclaracion(source, selector, property, replacement) {
  const re = new RegExp('(' + escaparRe(selector) + '\\s*\\{)([^}]*)(\\})');
  const match = source.match(re);
  if (!match) return source;
  const declRe = new RegExp('(^|;)(\\s*)' + escaparRe(property) + '\\s*:[^;]*');
  const body = match[2].replace(declRe, '$1$2' + replacement);
  if (body === match[2]) return source;
  return source.slice(0, match.index) + match[1] + body + match[3] + source.slice(match.index + match[0].length);
}

const baseInput = {
  html: html,
  css: css,
  js: js,
  revisionCss: revisionCss,
  indexHtml: indexHtml
};

const checks = [];
evaluar(baseInput).forEach(function (result) {
  checks.push(result);
});

const mutations = [
  {
    name: 'mutante: velo vuelve a ancho maximo de 640px',
    apply: function (input) {
      const mutatedCss = mutarDeclaracion(input.css, '.inducciones-container .kair-modal', 'max-width', '640px');
      return Object.assign({}, input, { css: mutatedCss });
    }
  },
  {
    name: 'mutante: velo queda debajo del header',
    apply: function (input) {
      const mutatedCss = mutarDeclaracion(input.css, '.inducciones-container .kair-modal', 'z-index', '200');
      return Object.assign({}, input, { css: mutatedCss });
    }
  },
  {
    name: 'mutante: panel vuelve a scrollear entero',
    apply: function (input) {
      const mutatedCss = mutarDeclaracion(input.css, '.inducciones-container .kair-modal__panel', 'overflow', 'auto');
      return Object.assign({}, input, { css: mutatedCss });
    }
  },
  {
    name: 'mutante: cuerpo deja de scrollear',
    apply: function (input) {
      const mutatedCss = mutarDeclaracion(input.css, '.inducciones-container .kair-modal__body', 'overflow-y', 'visible');
      return Object.assign({}, input, { css: mutatedCss });
    }
  },
  {
    name: 'mutante: reglas de 6.1.3 vuelven a ser globales',
    apply: function (input) {
      const mutatedCss = input.revisionCss.replace('.kair-rad-module .kair-modal {', '.kair-modal {');
      return Object.assign({}, input, { revisionCss: mutatedCss });
    }
  },
  {
    name: 'mutante: reglas hijas de 6.1.3 vuelven a ser globales',
    apply: function (input) {
      const mutatedCss = input.revisionCss.replace('.kair-rad-module .kair-modal__head {', '.kair-modal__head {');
      return Object.assign({}, input, { revisionCss: mutatedCss });
    }
  },
  {
    name: 'mutante: el fondo queda scrolleable con el modal abierto',
    apply: function (input) {
      const mutatedJs = input.js.replace("this.container.classList.add('kair-modal-open');", '');
      return Object.assign({}, input, { js: mutatedJs });
    }
  }
];

mutations.forEach(function (mutation) {
  const mutated = mutation.apply(baseInput);
  const changed = mutated.css !== baseInput.css ||
    mutated.js !== baseInput.js ||
    mutated.revisionCss !== baseInput.revisionCss;
  if (!changed) {
    checks.push({ name: mutation.name + ' (mutante no vacio)', ok: false });
    return;
  }
  const detected = evaluar(mutated).some(function (result) { return !result.ok; });
  checks.push({ name: mutation.name + ' (detectado)', ok: detected });
});

let failed = 0;
checks.forEach(function (check) {
  if (!check.ok) {
    failed++;
    console.log('FAIL:', check.name);
  }
});
console.log((checks.length - failed) + '/' + checks.length + ' OK');
process.exit(failed === 0 ? 0 : 1);

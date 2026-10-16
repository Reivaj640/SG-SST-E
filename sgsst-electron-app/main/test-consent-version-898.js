/* Test de la versión del documento legal (898).
 *
 * Qué protege este archivo, y por qué existe:
 *
 * El gate de consentimiento decide si hay que volver a mostrar los términos. Durante
 * años decidió AL REVÉS de lo que corresponde: leía `cfg.consentDocumentVersion`,
 * una clave de config.json que nadie escribía (siempre caía en 'v1'), así que
 *   · editar el texto legal NO re-preguntaba nada, y
 *   · cada bump de versión de la app SÍ re-preguntaba a todo el mundo.
 *
 * Mientras tanto el renderer ya enviaba `versionTerminos` / `versionPrivacidad` y un
 * SHA-256 real del texto leído, y el backend los guardaba en cada aceptación. O sea:
 * la máquina estaba construida y le faltaba un cable.
 *
 * El arreglo mete UNA fuente de verdad (`CONSENT_DOCUMENT_VERSION` en main.js) y saca
 * del cálculo la versión de la app. Eso arregla el defecto de fondo, pero abre otro
 * riesgo: que alguien edite un texto legal y se olvide de subir el número. Ahí nadie
 * se entera hasta que un cliente pregunta.
 *
 * Este archivo es el que se entera antes. Ata la constante de main.js a las del
 * renderer y a la "Versión" que se imprime en los documentos publicados, así que el
 * olvido se convierte en un test rojo acá y no en un reclamo.
 *
 * Qué se verifica:
 *   A. Las cuatro copias del número dicen lo mismo (main, renderer x2, HTML x2).
 *   B. El gate usa la constante y NO la clave muerta de config.
 *   C. El gate NO vuelve a comparar por versión de la app (el defecto original).
 *   D. Que los extractores muerden: se prueban contra entradas mutadas a propósito.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const SITIO = path.join(APP, '..', 'sitio');

const mainSrc = fs.readFileSync(path.join(APP, 'main.js'), 'utf8');
const rendererSrc = fs.readFileSync(path.join(APP, 'renderer.js'), 'utf8');

const checks = [];
function chk(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra || '' });
}

// ───────────────────────── Extractores

const RE_MAIN = /const\s+CONSENT_DOCUMENT_VERSION\s*=\s*'([0-9]{4}-[0-9]{2}-[0-9]{2})'/;
const RE_TERMINOS = /const\s+CONSENT_VERSION_TERMINOS\s*=\s*'([0-9]{4}-[0-9]{2}-[0-9]{2})'/;
const RE_PRIVACIDAD = /const\s+CONSENT_VERSION_PRIVACIDAD\s*=\s*'([0-9]{4}-[0-9]{2}-[0-9]{2})'/;
// El HTML publica "Versi&oacute;n 2026-10-16"; se acepta también la 'ó' literal.
const RE_HTML = /Versi(?:&oacute;|ó)n\s+([0-9]{4}-[0-9]{2}-[0-9]{2})/;

function versionMain(src) { const m = src.match(RE_MAIN); return m ? m[1] : null; }
function versionTerminos(src) { const m = src.match(RE_TERMINOS); return m ? m[1] : null; }
function versionPrivacidad(src) { const m = src.match(RE_PRIVACIDAD); return m ? m[1] : null; }
function versionHtml(html) { const m = html.match(RE_HTML); return m ? m[1] : null; }

function leerVersionHtml(nombre) {
  const p = path.join(SITIO, nombre);
  if (!fs.existsSync(p)) return null;
  return versionHtml(fs.readFileSync(p, 'utf8'));
}

// ───────────────────────── A. Una sola fuente de verdad

function chkVersionUnica() {
  const vMain = versionMain(mainSrc);
  const vTerm = versionTerminos(rendererSrc);
  const vPriv = versionPrivacidad(rendererSrc);
  const vHtmlTerm = leerVersionHtml('terminos.html');
  const vHtmlPriv = leerVersionHtml('privacidad.html');

  chk('main.js define CONSENT_DOCUMENT_VERSION con una fecha',
    !!vMain, 'vMain=' + JSON.stringify(vMain));
  chk('renderer.js define CONSENT_VERSION_TERMINOS',
    !!vTerm, 'vTerm=' + JSON.stringify(vTerm));
  chk('renderer.js define CONSENT_VERSION_PRIVACIDAD',
    !!vPriv, 'vPriv=' + JSON.stringify(vPriv));
  chk('sitio/terminos.html publica una versión',
    !!vHtmlTerm, 'htmlTerminos=' + JSON.stringify(vHtmlTerm));
  chk('sitio/privacidad.html publica una versión',
    !!vHtmlPriv, 'htmlPrivacidad=' + JSON.stringify(vHtmlPriv));

  if (!vMain) return;

  chk('la versión del renderer (Términos) es la MISMA que la de main.js',
    vTerm === vMain, 'main=' + vMain + ' renderer=' + vTerm);
  chk('la versión del renderer (Privacidad) es la MISMA que la de main.js',
    vPriv === vMain, 'main=' + vMain + ' renderer=' + vPriv);
  chk('la versión publicada en sitio/terminos.html es la MISMA que la de main.js',
    vHtmlTerm === vMain, 'main=' + vMain + ' html=' + vHtmlTerm);
  chk('la versión publicada en sitio/privacidad.html es la MISMA que la de main.js',
    vHtmlPriv === vMain, 'main=' + vMain + ' html=' + vHtmlPriv);

  // La fecha no puede ser futura respecto a la del documento: si alguien sube el
  // número sin tocar el texto, el gate re-pregunta por un cambio que no ocurrió.
  chk('la versión no es una fecha imposible (AAAA-MM-DD real)',
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(vMain), 'vMain=' + vMain);
}

// ───────────────────────── B. El gate usa la constante, no la clave muerta

function chkGateUsaConstante() {
  chk('consent:estado calcula `requiere` con la constante de documento',
    /requiere:\s*!aceptado\s*\|\|\s*aceptado\.document_version\s*!==\s*docV/.test(mainSrc));

  // El cable roto: una clave de config.json que nadie escribe.
  chk('consent:estado YA NO lee cfg.consentDocumentVersion (la clave que nadie escribía)',
    !/String\(\s*\(\s*cfg\s*&&\s*cfg\.consentDocumentVersion\s*\)/.test(mainSrc));

  // Y el que sí debe usar la constante: el registro, para que lo guardado sea
  // comparable con lo que el gate va a pedir después.
  const usos = (mainSrc.match(/const\s+docV\s*=\s*CONSENT_DOCUMENT_VERSION\s*;/g) || []).length;
  chk('la constante se usa en los DOS canales (estado y registro)',
    usos === 2, 'usos=' + usos);
  chk('ya no queda ningún docV salido de la config',
    !/const\s+docV\s*=\s*String\(/.test(mainSrc));
}

// ───────────────────────── C. El defecto original no vuelve

function chkSinVersionDeApp() {
  // Comparar por app_version es lo que hacía que CADA release re-preguntara a todo
  // el mundo aunque el texto legal no hubiera cambiado.
  chk('`requiere` NO vuelve a comparar por app_version (el defecto original)',
    !/requiere:[^\n]*app_version/.test(mainSrc));

  // Sigue guardando la versión de la app: es evidencia de con qué build aceptó
  // cada persona. Lo que no debe es ser el criterio para re-preguntar.
  chk('la versión de la app SEGUIE guardando como evidencia',
    /app_version\s+TEXT\s+NOT\s+NULL/.test(mainSrc) &&
    /\(device_id,\s*app_version,\s*document_version/.test(mainSrc));

  chk('la respuesta del gate sigue exponiendo appVersion (no se rompe el contrato)',
    /appVersion:\s*appV/.test(mainSrc) && /documentVersion:\s*docV/.test(mainSrc));
}

// ───────────────────────── D. Que los extractores muerdan

// Un check que nunca falla es peor que no tener check: parece verde y no protege
// nada. Aquí se rompe cada fuente a propósito y se verifica que el extractor deja
// de devolver la fecha, o que la comparación da falso.
function chkExtractoresMuerden() {
  chk('mutación 1 — main.js con otra fecha: el extractor devuelve la nueva, no la vieja',
    versionMain(mainSrc.replace(RE_MAIN, "const CONSENT_DOCUMENT_VERSION = '2026-10-17'")) === '2026-10-17');

  chk('mutación 2 — renderer desincronizado: la comparación da falso',
    (function () {
      const mutado = rendererSrc.replace(RE_TERMINOS, "const CONSENT_VERSION_TERMINOS = '2026-10-17'");
      return versionTerminos(mutado) !== versionMain(mainSrc);
    })());

  chk('mutación 3 — HTML sin "Versión": el extractor devuelve null',
    versionHtml('<p>Documento sin fecha</p>') === null);

  chk('mutación 4 — HTML con la entidad &oacute;: se lee igual',
    versionHtml('<p class="fecha">Versi&oacute;n 2026-10-16</p>') === '2026-10-16');

  chk('mutación 5 — main.js sin la constante: el extractor devuelve null',
    versionMain(mainSrc.replace(RE_MAIN, 'const OTRA = 1;')) === null);
}

// ───────────────────────── Correr

console.log('\n=======================================');
console.log('  898 · Version del documento legal');
console.log('=======================================');
chkVersionUnica();
chkGateUsaConstante();
chkSinVersionDeApp();
chkExtractoresMuerden();

let failed = 0;
checks.forEach(function (c) {
  if (!c.ok) failed++;
  console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
});
console.log('---');
console.log((checks.length - failed) + '/' + checks.length + ' OK');
if (failed > 0) {
  console.log('FALLO — Hay tests que no pasaron.');
  process.exitCode = 1;
}
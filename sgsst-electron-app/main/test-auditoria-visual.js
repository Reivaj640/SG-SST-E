// Test de smoke: valida auditoría visual Gmail-style
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');
const cssPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'styles.css');

const appSrc = fs.readFileSync(appPath, 'utf8');
const cssSrc = fs.readFileSync(cssPath, 'utf8');

// 🔴 Para verificar hay que quitar los comentarios (§5.15). Los checks de abajo se
// invierten contra `appSinComentarios` porque el código que vigilan aparece NOMBRADO en
// comentarios larguísimos, y un check que leyera el archivo crudo lo encontraría ahí y
// daría verde. OJO: hay que quitar TRES tipos, no uno. En app.js los comentarios `/* */`
// y `//` no alcanzan: `kair-mail-detail__actions` sobrevive dentro de un comentario
// HTML `<!-- -->` que va embebido en un template literal (app.js:6222). La primera
// versión de este stripper solo limpiaba los dos primeros y el check invertido daba rojo
// sin motivo.
const appSinComentarios = appSrc
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const checks = [];

// === AUDITORÍA 2026-07-18: Thread grouping Gmail-style compacto ===

// 1. Thread header principal compacto
checks.push({ name: 'JS: sender-row tiene avatar 40x40 (no 56x56)', ok: /kair-mail-detail__avatar[^}]*background:[^}]*\}/.test(appSrc) && !/kair-mail-detail__avatar[\s\S]{0,500}width:\s*"56px"/.test(appSrc) });
checks.push({ name: 'JS: sender-row tiene fecha + formatRelativeTime', ok: /kair-mail-detail__time[\s\S]{0,300}formatRelativeTime/.test(appSrc) });

// 📦752 · INVERTIDOS 2 checks. Pedían que existieran `data-action="archive|star|more"` y el
// `archiveBtn.addEventListener`. Los dos se BORRARON A PROPÓSITO: la segunda toolbar
// (`kair-mail-detail__actions`) duplicaba la principal ("Gmail tiene UNA sola toolbar
// arriba"), y el setTimeout que buscaba esos selectores era código zombie de 75 líneas
// (loop 28: "Esos selectores NO EXISTEN en el HTML generado"). Invertidos, no borrados
// (§7.3): ahora exigen que ese código muerto no vuelva.
// Los `data-action` que SÍ existen (close, edit, delete, cancel) son del modal de eventos.
checks.push({ name: 'JS: NO volvió la toolbar duplicada de acciones', ok: !/kair-mail-detail__actions/.test(appSinComentarios) });
checks.push({ name: 'JS: NO volvió el setTimeout zombie (loop 28)', ok: !/archiveBtn\.addEventListener/.test(appSinComentarios) && !/data-action=["']archive["']/.test(appSinComentarios) });
// El modal de eventos sí debe seguir usando data-action: el borrado fue del header.
checks.push({ name: 'JS: el modal de eventos conserva sus data-action', ok: /data-action=["']delete["']/.test(appSinComentarios) });

// 3. Mensajes colapsados a 1 línea con avatar 40x40.
// 📦752 lo pasó de 32px a 40px. AGENTS.md:2637 decía que la regla "no existe en el
// repo": es falso, existe y mide 40px. El check apuntaba al valor viejo.
checks.push({ name: 'CSS: .kair-mail-message__avatar width: 40px', ok: /\.kair-mail-message__avatar\s*\{[^}]*width:\s*40px/.test(cssSrc) });
checks.push({ name: 'JS: kair-mail-message usa nueva estructura de head/line', ok: /kair-mail-message__line/.test(appSrc) });

// 4. Snippet: hoy lo que se hace es QUITAR el prefijo Re:/Fwd:, no elegir entre msg.subject
// y mail.subject. Ese ternario era del agrupamiento por hilo, que 📦752 reemplazó.
checks.push({ name: 'JS: msgSubject quita el prefijo Re:/Fwd:', ok: /msgSubject\s*=\s*\(rawSubject\s*\|\|\s*""\)\.replace\(\/\^/.test(appSrc) });

// 5. Dropdown "para: jrf2011 ▼" colapsable
checks.push({ name: 'JS: recipientsDetails es un <details>', ok: /recipientsDetails\s*=\s*el\("details"/.test(appSrc) });
checks.push({ name: 'JS: muestra primer destinatario + count', ok: /firstRecipientLabel/.test(appSrc) && /moreCount/.test(appSrc) });
checks.push({ name: 'CSS: .kair-mail-message__recipients existe', ok: /\.kair-mail-message__recipients\s*\{/.test(cssSrc) });

// 6. "···" indicator
checks.push({ name: 'JS: "···" indicator si body tiene más de 1 línea', ok: /kair-mail-message__more/.test(appSrc) && /bodyLines\.length > 1/.test(appSrc) });

// 7. Action icons del mensaje (responder, más) en hover
checks.push({ name: 'JS: msgActions con msgReplyBtn', ok: /msgActions[\s\S]{0,500}msgReplyBtn/.test(appSrc) });
// 📦752 · INVERTIDO. Pedía que las acciones del mensaje aparecieran al hacer hover. Se
// cambiaron a SIEMPRE visibles ("FIX loop 15: siempre visibles", styles.css:4201; loop 26
// las movió al HEAD estilo Gmail). Invertido para que el hover no vuelva a gatear nada.
checks.push({ name: 'CSS: las acciones del mensaje NO dependen de :hover', ok: !/\.kair-mail-message:hover\s+\.kair-mail-message__actions/.test(cssSrc) });

// === Cache-bust ===
const rendPath = path.join(__dirname, '..', 'renderer.js');
const rendSrc = fs.readFileSync(rendPath, 'utf8');
const m = rendSrc.match(/bandeja-integrada\/index\.html\?v=(\d+)/);
checks.push({ name: 'Cache-bust >= 614', ok: m && parseInt(m[1], 10) >= 614, val: m ? m[1] : 'none' });

// Reporte
console.log('\n=== TEST AUDITORÍA VISUAL ===');
var failed = 0;
checks.forEach(function (c) {
  const mark = c.ok ? 'OK  ' : 'FAIL';
  const val = c.val !== undefined ? ' (' + c.val + ')' : '';
  console.log('[' + mark + '] ' + c.name + val);
  if (!c.ok) failed++;
});
console.log('\n' + (failed === 0 ? 'TODOS LOS FIXES APLICADOS' : failed + ' FIXES FALLARON'));
process.exit(failed === 0 ? 0 : 1);

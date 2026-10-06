/* ============================================================
 * K+AIR · Smoke test — Firma de correo con imagen (📦753)
 * ============================================================
 * Dos partes:
 *  1) RUNTIME: llama a `buildRawMessage()` (shared/google-gmail.js) — la
 *     función que arma el MIME crudo — y verifica la ESTRUCTURA del mensaje
 *     en los 4 casos posibles. No necesita OAuth.
 *  2) ESTÁTICO: verifica que la UI (app.js) y los estilos (premium.css)
 *     tengan la sección de imagen y el cableado con el backend.
 *
 * Correr con: node main/test-firma-imagen.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');

const gmail = require(path.join(__dirname, '..', 'shared', 'google-gmail.js'));
const dir = path.join(__dirname, '..', 'renderer', 'bandeja-integrada');
const app = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
const premium = fs.readFileSync(path.join(dir, 'premium.css'), 'utf8');

const checks = [];
function check(name, ok) { checks.push({ name: name, ok: !!ok }); }

const HDRS = ['From: a@b.co', 'To: c@d.co', 'Subject: Prueba'];
const IMG = { name: 'firma.png', mimeType: 'image/png', data: 'A'.repeat(200) };  // 200 chars de base64
const ATT = { name: 'doc.pdf', mimeType: 'application/pdf', data: 'B'.repeat(90) };

// ── 1. Sin adjuntos ni imagen (comportamiento original intacto) ──────────
const raw1 = gmail.buildRawMessage({ headers: HDRS, body: 'Hola', htmlBody: '<div>Hola</div>' });
check('base: usa multipart/alternative', /Content-Type: multipart\/alternative; boundary="/.test(raw1));
check('base: NO usa related ni CID', !/multipart\/related/.test(raw1) && !/Content-ID/.test(raw1));
check('base: incluye text/plain y text/html', /text\/plain; charset=UTF-8/.test(raw1) && /text\/html; charset=UTF-8/.test(raw1));
check('base: cierra el boundary final', /--[^\r\n]+--\r\n$/.test(raw1));
check('base: conserva los headers', /^From: a@b\.co\r\nTo: c@d\.co\r\nSubject: Prueba/.test(raw1));

// ── 2. Con imagen de firma (el caso nuevo) ───────────────────────────────
const raw2 = gmail.buildRawMessage({ headers: HDRS, body: 'Hola', htmlBody: '<div>Hola</div>', signatureImage: IMG });
check('imagen: envuelve en multipart/related con type=alternative',
  /Content-Type: multipart\/related; boundary="[^"]+"; type="multipart\/alternative"/.test(raw2));
check('imagen: parte inline con Content-Disposition inline',
  /Content-Disposition: inline; filename="firma\.png"/.test(raw2));
check('imagen: declara Content-ID <kair-firma@kair>', /Content-ID: <kair-firma@kair>/.test(raw2));
check('imagen: el HTML la referencia con src="cid:"', /src="cid:kair-firma@kair"/.test(raw2));
check('imagen: el mimeType viaja en la parte', /Content-Type: image\/png; name="firma\.png"/.test(raw2));
check('imagen: NO se usa multipart/mixed (no hay adjuntos)', !/multipart\/mixed/.test(raw2));
check('imagen: mantiene el multipart/alternative adentro', /Content-Type: multipart\/alternative; boundary="/.test(raw2));

// El base64 de 200 chars debe quedar partido en líneas de <= 76 (estándar MIME)
const b64lines = raw2.split('\r\n').filter(function (l) { return /^A+$/.test(l); });
check('imagen: base64 partido en líneas de <=76 (' + (b64lines[0] ? b64lines[0].length : 0) + ' chars, ' + b64lines.length + ' líneas)',
  b64lines.length >= 3 && b64lines.every(function (l) { return l.length <= 76; }));
check('imagen: el texto plano NO lleva la imagen (solo el HTML)',
  raw2.indexOf('src="cid:') < raw2.indexOf('text/html') ? true : raw2.lastIndexOf('src="cid:') > raw2.indexOf('text/html'));

// ── 3. Con imagen + adjuntos ─────────────────────────────────────────────
const raw3 = gmail.buildRawMessage({ headers: HDRS, body: 'Hola', htmlBody: '<div>Hola</div>', signatureImage: IMG, attachments: [ATT] });
check('imagen+adjuntos: multipart/mixed envuelve al related',
  /Content-Type: multipart\/mixed; boundary="/.test(raw3) && /multipart\/related/.test(raw3));
check('imagen+adjuntos: el adjunto sigue siendo attachment',
  /Content-Disposition: attachment; filename="doc\.pdf"/.test(raw3));
check('imagen+adjuntos: related va ANTES del adjunto',
  raw3.indexOf('multipart/related') < raw3.indexOf('Content-Disposition: attachment'));
check('imagen+adjuntos: la imagen queda inline (noattachment)',
  /Content-Disposition: inline; filename="firma\.png"/.test(raw3));

// ── 4. Solo adjuntos (sin imagen) ────────────────────────────────────────
const raw4 = gmail.buildRawMessage({ headers: HDRS, body: 'Hola', htmlBody: '<div>Hola</div>', attachments: [ATT] });
check('solo adjuntos: mixed + attachment y sin related',
  /Content-Type: multipart\/mixed/.test(raw4) && /Content-Disposition: attachment; filename="doc\.pdf"/.test(raw4) && !/multipart\/related/.test(raw4));

// ── 5. Seguridad / robustez ──────────────────────────────────────────────
const raw5 = gmail.buildRawMessage({ headers: HDRS, body: 'Hola', htmlBody: '<div>Hola</div>', signatureImage: { name: 'x.txt', mimeType: 'text/plain', data: 'AAAA' } });
check('seguridad: un mimeType que no es imagen se ignora',
  !/multipart\/related/.test(raw5) && !/Content-ID/.test(raw5));
const raw6 = gmail.buildRawMessage({ headers: HDRS, body: '', htmlBody: '', attachments: [{ name: 'vacio.bin', mimeType: 'application/octet-stream', data: '' }] });
check('robustez: adjunto con data vacía no rompe', typeof raw6 === 'string' && /vacio\.bin/.test(raw6));
const raw7 = gmail.buildRawMessage({ headers: HDRS, body: 'Sin imagen', htmlBody: '', signatureImage: { name: 'a"b.png', mimeType: 'image/png', data: 'AAAA' } });
check('robustez: comillas en el nombre de archivo se sanean', /filename="ab\.png"/.test(raw7) || /filename="a"b\.png"/.test(raw7) === false);

// ── 6. UI: app.js ────────────────────────────────────────────────────────
check('JS: helper getSignatureImage() existe', /function getSignatureImage\(\)/.test(app));
check('JS: la clave de la imagen es kair.emailSignatureImage', /kair\.emailSignatureImage/.test(app));
check('JS: sendMessage recibe signatureImage', /signatureImage: signatureImage \|\| undefined/.test(app));
check('JS: la firma-imagen NO se manda en reenvíos', /var signatureImage = opts\.isForward \? null : getSignatureImage\(\)/.test(app));
check('JS: el modal tiene input de imagen con tipos válidos',
  /id="sig-image-input"/.test(app) && /accept="image\/png,image\/jpeg,image\/webp,image\/gif"/.test(app));
check('JS: valida el peso máximo (400 KB)', /SIG_IMAGE_MAX_BYTES = 400 \* 1024/.test(app));
check('JS: avisa si el formato no es imagen', /toast\("Formato no soportado"/.test(app) && /toast\("Imagen muy pesada"/.test(app));
check('JS: lee el archivo como data URL', /reader\.readAsDataURL\(file\)/.test(app));
check('JS: la vista previa muestra la imagen', /kair-signature-modal__preview-img/.test(app));
check('JS: guardar persiste texto e imagen por separado', /localStorage\.setItem\(SIG_IMAGE_KEY/.test(app) && /localStorage\.setItem\("kair\.emailSignature", newSig\)/.test(app));
check('JS: "Borrar firma" limpia también la imagen', /textarea\.value = "";\s*\n\s*draftImage = null;/.test(app));

// ── 7. UI: premium.css ───────────────────────────────────────────────────
const headerRule = (premium.match(/\.kair-signature-modal__header\s*\{[^}]*\}/) || [''])[0];
check('CSS: el header del modal es claro (background premium, no #404040)',
  /background:\s*var\(--kair-surface\)/.test(headerRule) && !/#404040/.test(headerRule));
check('CSS: el modal tiene radio premium (20px)', /\.kair-signature-modal\s*\{[^}]*border-radius:\s*var\(--kair-r-md\)/.test(premium));
check('CSS: estilos de la caja de imagen', /\.kair-signature-modal__imgbox/.test(premium) && /\.kair-signature-modal__thumb/.test(premium) && /\.kair-signature-modal__imgpick/.test(premium));
check('CSS: estilos de vista previa con imagen', /\.kair-signature-modal__preview-img/.test(premium));
check('CSS: botón de borrar con tono de peligro', /\.kair-signature-modal__btn--danger/.test(premium));
check('CSS: el overlay del modal de firma está por debajo del de eventos', /\.kair-signature-modal-overlay\s*\{[^}]*z-index:\s*450000/.test(premium));

// ── 8. Imagen en línea EN EL LECTOR (📦753-fix) ──────────────────────────
// El parser debe distinguir las partes en línea (firma/logos) de los adjuntos.
const payloadConFirma = {
  parts: [
    { mimeType: 'multipart/alternative', parts: [
      { mimeType: 'text/plain', filename: '', body: { size: 10 } },
      { mimeType: 'text/html', filename: '', body: { size: 40 } }
    ]},
    {
      mimeType: 'image/png',
      filename: 'firma.png',
      body: { size: 4096, attachmentId: 'ATT-INLINE' },
      headers: [
        { name: 'Content-ID', value: '<kair-firma@kair>' },
        { name: 'Content-Disposition', value: 'inline; filename="firma.png"' }
      ]
    },
    {
      mimeType: 'application/pdf',
      filename: 'informe.pdf',
      body: { size: 90000, attachmentId: 'ATT-REAL' },
      headers: [{ name: 'Content-Disposition', value: 'attachment; filename="informe.pdf"' }]
    }
  ]
};
const parsed = gmail.extractAttachments(payloadConFirma);
check('parser: detecta 2 partes', parsed.length === 2);
const inlinePart = parsed.filter(function (a) { return a.attachmentId === 'ATT-INLINE'; })[0] || {};
const realPart = parsed.filter(function (a) { return a.attachmentId === 'ATT-REAL'; })[0] || {};
check('parser: la imagen con Content-ID queda como inline',
  inlinePart.isInline === true && inlinePart.disposition === 'inline' && inlinePart.contentId === 'kair-firma@kair');
check('parser: el PDF queda como attachment', realPart.isInline === false && realPart.disposition === 'attachment');
check('parser: sin Content-ID ni inline no se marca por error', !realPart.contentId);

check('JS: sanitizeHtml marca las imágenes cid: con data-kair-cid', /el\.setAttribute\("data-kair-cid", cidRef\)/.test(app));
check('JS: existe hydrateInlineImages()', /function hydrateInlineImages\(root, mail\)/.test(app));
check('JS: el lector hidrata las imágenes al montar el detalle', /container\.appendChild\(detail\);\s*\n\s*\/\/ 📦753[\s\S]{0,200}hydrateInlineImages\(detail, mail\)/.test(app));
check('JS: la hidratación usa el attachmentId + el data URL',
  /attachmentId: attId/.test(app) && /"data:" \+ mime \+ ";base64," \+ b64/.test(app));
check('JS: el listado de adjuntos excluye las partes en línea',
  /a\.content_id && disp !== "attachment"\) return false/.test(app));
const gmailSrc = fs.readFileSync(path.join(__dirname, '..', 'shared', 'google-gmail.js'), 'utf8');
check('parser: hasAttachment excluye las partes en línea (no muestra el clip por una firma)',
  /hasAttachment: extractAttachments\(msg\.payload\)\.some\(function \(a\) \{ return !a\.isInline; \}\)/.test(gmailSrc));
check('JS: las columnas nuevas viajan del parser al cache',
  /content_id: att\.contentId \|\| null/.test(fs.readFileSync(path.join(__dirname, '..', 'main', 'email-sync.js'), 'utf8')));
const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'main', 'email-schema-sql.js'), 'utf8');
check('DB: email_attachments tiene content_id + disposition', /content_id TEXT/.test(schemaSql) && /disposition TEXT/.test(schemaSql));
check('DB: migración idempotente para las columnas nuevas',
  /ALTER TABLE email_attachments ADD COLUMN content_id TEXT;/.test(schemaSql) && /ALTER TABLE email_attachments ADD COLUMN disposition TEXT;/.test(schemaSql));
check('DB: saveAttachment inserta content_id + disposition',
  /content_id: att\.content_id \|\| null/.test(fs.readFileSync(path.join(__dirname, '..', 'main', 'email-db.js'), 'utf8')));

// ── 9. Refresco inmediato de la bandeja (📦753-fix) ──────────────────────
check('refresh: existe applyThreadsToState() compartido', /function applyThreadsToState\(threadsData\)/.test(app));
check('refresh: existe refreshFolderNow()', /function refreshFolderNow\(folder, opts\)/.test(app));
check('refresh: el post-envío refresca la carpeta visible + Enviados',
  /if \(foldersToRefresh\.indexOf\('SENT'\) === -1\) foldersToRefresh\.push\('SENT'\);/.test(app));
check('refresh: el post-envío ya NO sincroniza solo INBOX',
  !/api\.emailCache\.syncInbox\(\{ folder: 'INBOX', maxResults: 25 \}\)\.then\(function \(\) \{ \/\/ 📦 P1-2/.test(app));
check('refresh: el auto-refresh corre cada 30s (antes 60s)', /}, 30 \* 1000\);/.test(app) && !/\}, 60 \* 1000\); \/\/ 1 minuto/.test(app));
check('refresh: al volver a la app sincroniza de inmediato',
  /startAutoRefresh\(\);\s*\n\s*\/\/ 📦753-fix[\s\S]{0,200}syncInboxInBackground\(\)/.test(app));
check('refresh: syncInboxInBackground usa el merge compartido',
  /applyThreadsToState\(cacheResult\.data\);/.test(app));

// ── 10. Cache de adjuntos + prioridad del rate limiter (📦753-fix2) ──────
const limiterState = gmail.GmailRateLimiter && gmail.GmailRateLimiter._state ? gmail.GmailRateLimiter._state() : null;
check('limiter: existe la reserva para acciones del user',
  !!limiterState && limiterState.reserve > 0);
check('limiter: expone tokens disponibles para diagnóstico', !!limiterState && typeof limiterState.tokens === 'number');
check('limiter: la imagen de firma se pide con prioridad',
  /messages\.attachments\.get\(\{[\s\S]{0,700}\}, \{ priority: true \}\);/.test(gmailSrc));
check('limiter: enviar un correo también va con prioridad',
  /messages\.send\(\{[\s\S]{0,400}\}, \{ priority: true \}\);/.test(gmailSrc));
check('limiter: el sync de fondo queda SIN prioridad',
  !/users\.messages\.list\(\{[\s\S]{0,300}\}, \{ priority: true \}\)/.test(gmailSrc));

const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
check('cache disco: el handler de adjuntos lee del cache antes de la API',
  /if \(fs\.existsSync\(cacheFile\)\)/.test(mainSrc) && /email-attachments/.test(mainSrc));
check('cache disco: guarda el adjunto descargado', /fs\.writeFileSync\(cacheFile, result\.data\.data/.test(mainSrc));
check('JS: de-duplica pedidos de la misma imagen en vuelo', /_inlineImgPending\[cacheKey\]/.test(app));
check('JS: muestra placeholder mientras carga la imagen',
  /kair-inline-img--loading/.test(app) && /kair-inline-img--loading/.test(premium));

// ── 11. El "no leído" debe respetar lo que el user ya leyó (📦753-fix2) ──
const dbSrc = fs.readFileSync(path.join(__dirname, '..', 'main', 'email-db.js'), 'utf8');
check('unread: saveMessage YA NO fuerza has_unread = 1',
  !/SET has_unread = 1 WHERE id = \?/.test(dbSrc));
check('unread: existe recomputeThreadUnread()', /function recomputeThreadUnread\(threadId\)/.test(dbSrc));
check('unread: recalcula desde el label UNREAD de los mensajes',
  /label_ids LIKE '%"UNREAD"%'/.test(dbSrc));
check('unread: ignora los mensajes enviados y los borradores',
  /is_sent = 0[\s\S]{0,80}is_draft = 0/.test(dbSrc));
check('unread: se recalcula DESPUÉS de guardar el mensaje',
  /const result = stmt\.run\(\{[\s\S]*?\}\);\s*\n\s*\/\/ Recalcular[\s\S]{0,160}recomputeThreadUnread\(msg\.thread_id\)/.test(dbSrc));
check('unread: el recálculo está exportado', /recomputeThreadUnread,/.test(dbSrc));

// ── 12. Respuesta rápida: el botón "Enviar" debe ENVIAR (📦753-fix3) ─────
const quickReplyBlock = (app.match(/sendBtn\.addEventListener\("click", function \(\) \{[\s\S]{0,2600}?\n    \}\);/) || [''])[0];
check('respuesta rápida: el botón Enviar llama a sendComposedMail()',
  /sendComposedMail\(\{/.test(quickReplyBlock));
check('respuesta rápida: ya NO abre el redactor con el texto',
  !/openComposeModal\("reply", mail\)/.test(quickReplyBlock));
check('respuesta rápida: envía como respuesta del mismo hilo',
  /isReply: true/.test(quickReplyBlock) && /threadId: mail\.threadId \|\| mail\.id/.test(quickReplyBlock));
check('respuesta rápida: resuelve el destinatario con getMailDisplayContact()',
  /getMailDisplayContact\(mail\)/.test(quickReplyBlock) && /asunto\.indexOf\("RV:"\) !== 0/.test(quickReplyBlock));
check('respuesta rápida: deshabilita el botón mientras envía',
  /sendBtn\.disabled = true/.test(quickReplyBlock) && /Enviando…/.test(quickReplyBlock));
check('response: sendComposedMail devuelve true en éxito',
  /foldersToRefresh\.forEach\(function \(f\) \{[\s\S]{0,300}\}\);\s*\n\s*\/\/ 📦753-fix3[\s\S]{0,220}return true;/.test(app));
check('response: sendComposedMail devuelve false en los errores',
  (app.match(/return false;/g) || []).length >= 3);
check('response: closeModal es opcional (la respuesta rápida no tiene modal)',
  /if \(typeof opts\.closeModal === 'function'\) opts\.closeModal\(\);/.test(app));

// ── 13. Cupo de Gmail suficiente para el refresco (📦753-fix4) ───────────
// El sync cuesta ~26 requests (1 list + 1 get por mensaje). Con el cupo viejo
// (40/min, 32 para el fondo) dos syncs ya lo agotaban → vencían a los 120s y
// Enviados quedaba sin actualizar. El cupo real de Gmail es ~3000 lecturas/min.
check('cupo: la ventana permite >= 120 requests (era 40)',
  !!limiterState && limiterState.tokens >= 120);
check('cupo: el fondo tiene margen para 3 syncs por minuto',
  !!limiterState && (limiterState.tokens - limiterState.reserve) >= 78);
check('cupo: la reserva del user creció a >= 25 (era 8)',
  !!limiterState && limiterState.reserve >= 25);
check('sync: refreshFolderNow acepta opciones y evita apilar syncs por carpeta',
  /function refreshFolderNow\(folder, opts\)/.test(app) && /if \(_folderSyncInFlight\[target\]\) return _folderSyncInFlight\[target\];/.test(app));
check('sync: el refresco de Enviados pide solo los últimos hilos (más barato)',
  /refreshFolderNow\(f, f === 'SENT' \? \{ maxResults: 8 \} : null\)/.test(app));

// ── Reporte ──────────────────────────────────────────────────────────────
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) { console.log('[OK  ] ' + c.name); }
  else { failed++; console.log('[FAIL] ' + c.name); }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
console.log('✅ Firma con imagen OK');

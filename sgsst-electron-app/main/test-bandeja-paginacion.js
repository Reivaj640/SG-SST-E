/* ============================================================
 * K+AIR · Smoke test — Bandeja Integrada: ver TODOS los correos (📦755)
 * ============================================================
 * Valida la paginación completa (antes solo se veían los primeros 25 correos):
 *   - DB: lectura con LIMIT/OFFSET + contador con el MISMO filtro + estado de
 *     paginación por carpeta (nextPageToken).
 *   - Sync: modo `append` (página siguiente) que NO borra lo ya cargado, guarda el
 *     token de la próxima página y protege los correos viejos en la limpieza.
 *   - IPC/preload: count-threads + get-sync-state expuestos.
 *   - UI: scroll infinito + botón "Cargar más correos" + "Mostrando X de Y".
 *
 * Es un test de estructura (no de runtime): lee los archivos y verifica
 * patrones. Correr con: node main/test-bandeja-paginacion.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const schema = fs.readFileSync(path.join(root, 'main', 'email-schema-sql.js'), 'utf8');
const dbSrc = fs.readFileSync(path.join(root, 'main', 'email-db.js'), 'utf8');
const syncSrc = fs.readFileSync(path.join(root, 'main', 'email-sync.js'), 'utf8');
const mainSrc = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const preloadSrc = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'renderer', 'bandeja-integrada', 'app.js'), 'utf8');
const premium = fs.readFileSync(path.join(root, 'renderer', 'bandeja-integrada', 'premium.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'renderer', 'bandeja-integrada', 'index.html'), 'utf8');
const rendererJs = fs.readFileSync(path.join(root, 'renderer.js'), 'utf8');
const gmail = fs.readFileSync(path.join(root, 'shared', 'google-gmail.js'), 'utf8');

const checks = [];
function check(name, ok) { checks.push({ name: name, ok: !!ok }); }

// ── 1. Esquema: tabla de estado de paginación ────────────────────
check('SCHEMA: tabla email_sync_state (page_token por carpeta)',
  /CREATE TABLE IF NOT EXISTS email_sync_state/.test(schema) &&
  /page_token TEXT/.test(schema) &&
  /folder TEXT PRIMARY KEY/.test(schema));
check('SCHEMA: la tabla es idempotente (IF NOT EXISTS)', /CREATE TABLE IF NOT EXISTS email_sync_state/.test(schema));

// ── 2. DB: lectura paginada + contador ───────────────────────────
check('DB: getThreadsFromCache soporta LIMIT + OFFSET',
  /LIMIT @maxResults OFFSET @offset/.test(dbSrc) &&
  /const offset = options\.offset \|\| 0;/.test(dbSrc));
check('DB: el WHERE se extrajo a buildThreadsWhere() (lista y contador comparten filtro)',
  /function buildThreadsWhere\(options\)/.test(dbSrc) &&
  /const built = buildThreadsWhere\(options\);/.test(dbSrc) &&
  (dbSrc.match(/buildThreadsWhere\(options\)/g) || []).length >= 3);
check('DB: countThreadsFromCache existe y cuenta con el mismo WHERE',
  /function countThreadsFromCache\(options\)/.test(dbSrc) &&
  /SELECT COUNT\(\*\) AS c FROM \(/.test(dbSrc));
check('DB: estado de paginación (save/get/reset)',
  /function saveSyncState\(state\)/.test(dbSrc) &&
  /function getSyncState\(folder\)/.test(dbSrc) &&
  /function resetSyncState\(folder\)/.test(dbSrc));
check('DB: el upsert del estado usa ON CONFLICT(folder)',
  /INSERT INTO email_sync_state[\s\S]{0,260}ON CONFLICT\(folder\) DO UPDATE/.test(dbSrc));
check('DB: los nuevos helpers se exportan',
  /countThreadsFromCache, getThreadFromCache/.test(dbSrc) &&
  /saveSyncState, getSyncState, resetSyncState/.test(dbSrc));

// ── 3. Sync: modo "cargar más" (append) ──────────────────────────
check('SYNC: syncInbox acepta { append } y { pageToken }',
  /var append = options\.append === true;/.test(syncSrc) &&
  /var requestedPageToken = options\.pageToken \|\| null;/.test(syncSrc));
check('SYNC: en modo append reusa el token guardado (email_sync_state)',
  /if \(append && !requestedPageToken\)[\s\S]{0,220}emailDb\.getSyncState\(folder\)/.test(syncSrc));
check('SYNC: pasa el pageToken a listInbox',
  /pageToken: requestedPageToken \|\| undefined/.test(syncSrc));
check('SYNC: una página por vez (fetchAll: false)',
  /fetchAll: false,/.test(syncSrc));
check('SYNC: devuelve nextPageToken + hasMore',
  /var nextPageToken = listResult\.nextPageToken \|\| null;/.test(syncSrc) &&
  /nextPageToken: nextPageToken,/.test(syncSrc) &&
  /hasMore: hasMore/.test(syncSrc));
check('SYNC: guarda el estado de paginación al terminar',
  /emailDb\.saveSyncState\(\{/.test(syncSrc) &&
  /pageToken: nextPageToken,/.test(syncSrc));

// ── 4. La limpieza de huérfanos NO borra los correos ya cargados ──
// Un sync normal trae SOLO la página 1; si considerara huérfano a todo lo que no
// está en esa página, borraría las páginas viejas que el user pidió con "Cargar más".
check('SYNC: la limpieza se salta en modo append', /if \(!append\) \{[\s\S]{0,900}deleteThreadsByIds/.test(syncSrc));
check('SYNC: usa ventana de fechas (cutoff) para decidir huérfanos',
  /var cutoff = null;/.test(syncSrc) &&
  /cthread\.last_message_date < cutoff\) continue;/.test(syncSrc));
check('SYNC: lee más de una página del cache para la limpieza (5000)',
  /getThreadsFromCache\(\{ folder: folder, maxResults: 5000 \}\)/.test(syncSrc));

// ── 5. Gmail API: listInbox ya soporta paginación ────────────────
check('GMAIL: listInbox acepta pageToken y devuelve nextPageToken',
  /var pageToken = options\.pageToken \|\| null;/.test(gmail) &&
  /return \{ success: true, data: normalized, nextPageToken: nextPageToken \}/.test(gmail));

// ── 6. IPC + preload ─────────────────────────────────────────────
check('IPC: email-cache:count-threads', /ipcMain\.handle\('email-cache:count-threads'/.test(mainSrc));
check('IPC: email-cache:get-sync-state', /ipcMain\.handle\('email-cache:get-sync-state'/.test(mainSrc));
check('PRELOAD: countThreads + getSyncState expuestos',
  /countThreads: \(options\) => ipcRenderer\.invoke\('email-cache:count-threads', options\)/.test(preloadSrc) &&
  /getSyncState: \(folder\) => ipcRenderer\.invoke\('email-cache:get-sync-state', folder\)/.test(preloadSrc));

// ── 7. UI: estado de paginación ──────────────────────────────────
check('UI: PAGE_SIZE = 25', /const PAGE_SIZE = 25;/.test(app));
check('UI: estado mailLoaded/mailTotal/mailHasMore/mailLoadingMore',
  /mailLoaded: 25,/.test(app) && /mailTotal: 0,/.test(app) &&
  /mailHasMore: false,/.test(app) && /mailLoadingMore: false,/.test(app));
check('UI: la lista se lee con state.mailLoaded (no 25 fijo)',
  /var limit = Math\.max\(PAGE_SIZE, state\.mailLoaded \|\| PAGE_SIZE\);/.test(app) &&
  /getThreads\(\{ folder: folder, maxResults: limit \}\)/.test(app));
check('UI: el sync en background NO pisa las páginas cargadas',
  (app.match(/maxResults: Math\.max\(PAGE_SIZE, state\.mailLoaded\)/g) || []).length >= 2);

// ── 8. UI: botón "Cargar más" + scroll infinito ─────────────────
check('UI: loadMoreMails() existe', /function loadMoreMails\(\)/.test(app));
check('UI: camino 1 = leer del cache local sin gastar API',
  /if \(state\.mailTotal > shown\) \{/.test(app) &&
  /state\.mailLoaded = shown \+ PAGE_SIZE;/.test(app));
check('UI: camino 2 = pedir la página siguiente a Gmail (append)',
  /syncInbox\(\{ folder: folder, maxResults: PAGE_SIZE, append: true \}\)/.test(app));
check('UI: guard anti doble click (mailLoadingMore)',
  /if \(state\.mailLoadingMore\) return Promise\.resolve\(false\);/.test(app));
check('UI: SCROLL INFINITO al llegar cerca del final',
  /list\.addEventListener\("scroll", function \(\) \{/.test(app) &&
  /if \(sinceLast < 1500\) return;\s*\n\s*state\._autoLoadArmed = false;\s*\n\s*loadMoreMails\(\);/.test(app) &&
  /var remaining = list\.scrollHeight - list\.scrollTop - list\.clientHeight;/.test(app));
check('UI: el scroll infinito no se activa sin más correos',
  /var canLoadMore = state\.mailHasMore \|\| state\.mailTotal > shown;/.test(app) &&
  /if \(state\.mailLoadingMore \|\| !canLoadMore\) return;/.test(app));
check('UI: botón visible "Cargar más correos" (acción explícita)',
  /id="mail-loadmore"/.test(app) && /Cargar más correos/.test(app));
check('UI: contador "Mostrando X de Y"',
  /Mostrando <b>' \+ shown \+ '<\/b> de <b>' \+ total \+ '<\/b>'/.test(app));
check('UI: mensaje de fin de lista',
  /No hay más correos/.test(app) && /kair-mail-pager__end/.test(app));
check('UI: el pie se repinta SOLO él (no re-renderiza las filas → no salta el scroll)',
  /function updateMailPagerFooter\(\)/.test(app) &&
  /var foot = document\.getElementById\("mail-pager"\);/.test(app));
check('UI: total del cache se pide en paralelo (refreshMailTotal)',
  /function refreshMailTotal\(folder, opts\)/.test(app) &&
  /api\.emailCache\.countThreads\(\{ folder: target \}\)/.test(app));
check('UI: al cambiar de carpeta se reinicia la paginación',
  /function resetMailPagination\(folder\)/.test(app) &&
  /state\.mailLoaded = PAGE_SIZE;/.test(app) &&
  (app.match(/resetMailPagination\(/g) || []).length >= 3);

// ── 8.b fix tras la prueba real (📦755-fix) ──────────────────────
// El log del user mostró 10+ "Cargando la página siguiente" encadenados y un toast
// "No se pudo obtener el perfil de Gmail": el scroll infinito cargaba páginas una
// tras otra (26 requests cada una) y el cupo de Gmail (120/min) se agotaba.
check('FIX 📦755: el scroll infinito se "arma" (una página por llegada al final)',
  /if \(remaining > 400 \|\| sinceLast > 5000\) state\._autoLoadArmed = true;/.test(app) &&
  /if \(!state\._autoLoadArmed\) return;/.test(app));
check('FIX 📦755: cooldown de 1,5s entre cargas automáticas',
  /if \(sinceLast < 1500\) return;/.test(app));
check('FIX 📦755: "Cargar más" no se apila con otro sync en curso',
  /function isAnySyncInFlight\(\)/.test(app) &&
  /if \(typeof isAnySyncInFlight === "function" && isAnySyncInFlight\(\)\)/.test(app));
check('FIX 📦755: el auto-refresh se posterga si se acaba de cargar una página',
  /state\.mailLoadingMore \|\| \(Date\.now\(\) - \(state\._lastLoadMoreAt \|\| 0\) < 15000\)/.test(app));
check('FIX 📦755: el error de "cargar más" tiene throttle (no spamea toasts)',
  /function notifyLoadMoreError\(errorMsg\)/.test(app) &&
  /\(now - state\._lastLoadMoreErrorAt\) < 30000/.test(app));

// ── 8.c El sync NO muere si falla getProfile ─────────────────────
// "No se pudo obtener el perfil de Gmail" abortaba el sync entero (y el user veía
// el error al pedir más correos). Ahora se usa el email de la conexión guardada.
check('SYNC: si getProfile falla usa el email de la conexión guardada',
  /var conns = emailDb\.getAllConnections\(\);/.test(syncSrc) &&
  /getProfile falló[\s\S]{0,120}conexión guardada/.test(syncSrc));
check('SYNC: solo aborta si tampoco hay conexión guardada',
  /if \(!userEmail\) \{\s*return \{ success: false, error: 'No se pudo obtener el perfil de Gmail' \};/.test(syncSrc));

// ── 9. CSS del pie de paginación ─────────────────────────────────
check('CSS: .kair-mail-pager + botón + fin de lista',
  /\.kair-mail-pager\s*\{/.test(premium) &&
  /\.kair-mail-pager__btn/.test(premium) &&
  /\.kair-mail-pager__info/.test(premium) &&
  /\.kair-mail-pager__end/.test(premium));
check('CSS: el botón tiene estado deshabilitado (mientras carga)',
  /\.kair-mail-pager__btn\[disabled\]/.test(premium));

// ── 10. Cache-bust ───────────────────────────────────────────────
const iframeV = parseInt((rendererJs.match(/bandeja-integrada\/index\.html\?v=(\d+)/) || [0, 0])[1], 10);
check('Cache-bust: iframe ?v= >= 695 (actual: ' + iframeV + ')', iframeV >= 695);
check('Cache-bust: premium.css y app.js con ?v= nuevo',
  /premium\.css\?v=20260918-paginacion-correos/.test(html) &&
  /app\.js\?v=20260918-paginacion-correos/.test(html));

// ── Reporte ──────────────────────────────────────────────────────
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) { console.log('[OK  ] ' + c.name); }
  else { failed++; console.log('[FAIL] ' + c.name); }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
console.log('✅ Bandeja Integrada — paginación de correos OK');

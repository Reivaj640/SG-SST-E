/* ============================================================
 * K+AIR · Test FUNCIONAL — Paginación del cache de correos (📦755)
 * ============================================================
 * A diferencia del smoke test (que lee patrones con regex), este test EJECUTA
 * la capa de datos contra un SQLite en memoria con el schema real:
 *
 *   1. Crea el schema (EMAIL_SCHEMA_SQL) en :memory:
 *   2. Inserta 60 threads en INBOX + 5 en SENT
 *   3. Verifica la lectura paginada (LIMIT/OFFSET) y el contador
 *   4. Verifica que el contador y la lista usen el MISMO filtro
 *   5. Verifica el estado de paginación (save/get/reset)
 *
 * Correr con (IMPORTANTE: better-sqlite3 está compilado para el ABI de Electron,
 * así que con `node` a secas falla con ERR_DLOPEN_FAILED):
 *   $env:ELECTRON_RUN_AS_NODE=1; npx electron main/test-bandeja-paginacion-funcional.js
 * ============================================================ */

const Database = require('better-sqlite3');
const dbInstance = require('./db-instance');
const { EMAIL_SCHEMA_SQL } = require('./email-schema-sql');

const db = new Database(':memory:');
db.exec(EMAIL_SCHEMA_SQL);
dbInstance.setDb(db);

const emailDb = require('./email-db');

let failed = 0;
function check(name, ok, extra) {
  if (ok) console.log('[OK  ] ' + name);
  else { failed++; console.log('[FAIL] ' + name + (extra ? ' → ' + extra : '')); }
}

// ── Semilla: 60 threads en INBOX (fechas decrecientes) + 5 en SENT ──
const now = Date.now();
for (let i = 0; i < 60; i++) {
  emailDb.saveThread({
    id: 'inbox-' + i,
    connection_id: 'test@kair.co',
    subject: 'Asunto ' + i,
    snippet: 'preview ' + i,
    participants: ['test@kair.co'],
    message_count: 1,
    has_unread: i % 3 === 0 ? 1 : 0,
    has_attachment: 0,
    is_starred: i % 5 === 0 ? 1 : 0,
    is_important: 0,
    folder: 'INBOX',
    label_ids: ['INBOX'],
    last_message_date: now - i * 3600000,   // 1 hora entre cada uno
    last_sender_email: 'remitente' + i + '@mail.com',
    last_sender_name: 'Remitente ' + i
  });
}
for (let i = 0; i < 5; i++) {
  emailDb.saveThread({
    id: 'sent-' + i,
    connection_id: 'test@kair.co',
    subject: 'Enviado ' + i,
    snippet: 'preview sent ' + i,
    participants: ['test@kair.co'],
    message_count: 1,
    has_unread: 0,
    has_attachment: 0,
    is_starred: 0,
    is_important: 0,
    folder: 'SENT',
    label_ids: ['SENT'],
    last_message_date: now - i * 3600000,
    last_sender_email: 'test@kair.co',
    last_sender_name: 'Yo'
  });
}
console.log('Semilla: 60 threads INBOX + 5 SENT\n');

// ── 1. Lectura paginada ─────────────────────────────────────────
const page1 = emailDb.getThreadsFromCache({ folder: 'INBOX', maxResults: 25 });
check('Página 1 devuelve 25 threads', page1.length === 25, 'length=' + page1.length);
check('Página 1 arranca por el más nuevo', page1[0].id === 'inbox-0', page1[0] && page1[0].id);
check('Página 1 termina en el 24', page1[24].id === 'inbox-24', page1[24] && page1[24].id);

const page2 = emailDb.getThreadsFromCache({ folder: 'INBOX', maxResults: 25, offset: 25 });
check('Página 2 (offset 25) devuelve 25 threads', page2.length === 25, 'length=' + page2.length);
check('Página 2 arranca en el 25 y no repite la página 1',
  page2[0].id === 'inbox-25' && !page1.some(function (t) { return t.id === page2[0].id; }),
  page2[0] && page2[0].id);

const page3 = emailDb.getThreadsFromCache({ folder: 'INBOX', maxResults: 25, offset: 50 });
check('Página 3 (offset 50) trae los 10 restantes', page3.length === 10, 'length=' + page3.length);

const todo = emailDb.getThreadsFromCache({ folder: 'INBOX', maxResults: 100 });
check('Sin paginar trae los 60 (maxResults alto)', todo.length === 60, 'length=' + todo.length);

// ── 2. Contador con el mismo filtro ─────────────────────────────
check('countThreadsFromCache cuenta 60 en INBOX',
  emailDb.countThreadsFromCache({ folder: 'INBOX' }) === 60,
  'total=' + emailDb.countThreadsFromCache({ folder: 'INBOX' }));
check('countThreadsFromCache cuenta 5 en SENT',
  emailDb.countThreadsFromCache({ folder: 'SENT' }) === 5);
check('El contador respeta el filtro onlyUnread',
  emailDb.countThreadsFromCache({ folder: 'INBOX', onlyUnread: true }) === 20,
  'unread=' + emailDb.countThreadsFromCache({ folder: 'INBOX', onlyUnread: true }));
check('El contador respeta la búsqueda por texto',
  emailDb.countThreadsFromCache({ folder: 'INBOX', searchQuery: 'Asunto 1' }) === 11,
  'busqueda=' + emailDb.countThreadsFromCache({ folder: 'INBOX', searchQuery: 'Asunto 1' }));
check('El contador NO se rompe con el operador to: (last_to_list via subquery)',
  emailDb.countThreadsFromCache({ folder: 'INBOX', searchQuery: 'to:test@kair.co' }) >= 0);
check('El contador coincide con la lista sin paginar',
  emailDb.countThreadsFromCache({ folder: 'INBOX' }) ===
  emailDb.getThreadsFromCache({ folder: 'INBOX', maxResults: 500 }).length);

// ── 3. Estado de paginación ─────────────────────────────────────
check('Sin estado previo, getSyncState devuelve null', emailDb.getSyncState('INBOX') === null);

emailDb.saveSyncState({ folder: 'INBOX', connectionId: 'test@kair.co', pageToken: 'TOKEN-PAGINA-2', loadedCount: 25, pagesLoaded: 1 });
const st = emailDb.getSyncState('INBOX');
check('Guarda el nextPageToken de la carpeta', !!st && st.pageToken === 'TOKEN-PAGINA-2', st && st.pageToken);
check('Guarda cuántos threads se trajeron', !!st && st.loadedCount === 25);
check('Guarda cuántas páginas se pidieron', !!st && st.pagesLoaded === 1);

emailDb.saveSyncState({ folder: 'INBOX', connectionId: 'test@kair.co', pageToken: 'TOKEN-PAGINA-3', loadedCount: 50, pagesLoaded: 2 });
const st2 = emailDb.getSyncState('INBOX');
check('El upsert actualiza el token (no duplica filas)',
  st2.pageToken === 'TOKEN-PAGINA-3' && st2.pagesLoaded === 2 &&
  db.prepare('SELECT COUNT(*) AS c FROM email_sync_state').get().c === 1);

emailDb.saveSyncState({ folder: 'SENT', pageToken: null, loadedCount: 5, pagesLoaded: 1 });
check('El estado es POR CARPETA (INBOX y SENT independientes)',
  emailDb.getSyncState('INBOX').pageToken === 'TOKEN-PAGINA-3' &&
  emailDb.getSyncState('SENT').pageToken === null);

emailDb.resetSyncState('INBOX');
check('resetSyncState borra solo esa carpeta',
  emailDb.getSyncState('INBOX') === null && emailDb.getSyncState('SENT') !== null);

// ── 4. La limpieza de huérfanos con ventana de fechas ────────────
// Simula lo que hace syncInbox: la página 1 trae los 25 más nuevos; los threads
// viejos (página 2+) NO deben considerarse huérfanos.
const cached = emailDb.getThreadsFromCache({ folder: 'INBOX', maxResults: 5000 });
const fetchedIds = new Set(page1.map(function (t) { return t.id; }));
const cutoff = page1[page1.length - 1].last_message_date;
const orphans = cached.filter(function (t) {
  return !fetchedIds.has(t.id) && !(t.last_message_date < cutoff);
});
check('Con la ventana de fechas, la limpieza NO borra las páginas viejas',
  orphans.length === 0, 'huerfanos=' + orphans.length);

const orphansSinVentana = cached.filter(function (t) { return !fetchedIds.has(t.id); });
check('Control: SIN ventana de fechas se habrían borrado 35 (el bug que evitamos)',
  orphansSinVentana.length === 35, 'serian=' + orphansSinVentana.length);

// ── Reporte ──────────────────────────────────────────────────────
console.log('\n' + (failed === 0 ? '✅' : '❌') + ' ' + (failed === 0 ? 'Paginación funcional OK' : failed + ' checks FALLARON'));
db.close();
process.exit(failed === 0 ? 0 : 1);

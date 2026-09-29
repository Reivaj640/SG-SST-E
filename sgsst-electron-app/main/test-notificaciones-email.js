'use strict';
const checks = [];
function ok(name, c) { checks.push({ name: name, ok: !!c }); }

const emailMod = require('./notifications-email.js');

const dbStub = {
  prepare: function (sql) {
    if (/has_unread/.test(sql) && /SELECT/.test(sql)) {
      return {
        all: function () {
          return [
            { thread_id: 't1', subject: 'Asunto 1', snippet: 'hola', company_key: 'emp1', last_message_date: '2026-09-22T11:00:00Z', last_sender_name: 'Pausas Activas', last_sender_email: 'pausas@acme.com' },
            { thread_id: 't2', subject: 'Asunto 2', snippet: 'x', company_key: 'emp1', last_message_date: '2026-09-22T11:00:00Z', last_sender_name: '', last_sender_email: 'noreply@acme.com' },
            { thread_id: 't3', subject: 'Asunto 3', snippet: 'y', company_key: 'emp1', last_message_date: '2026-09-22T11:00:00Z', last_sender_name: '', last_sender_email: '' }
          ];
        }
      };
    }
    if (/email_connections/.test(sql)) {
      return { all: function () { return []; } };
    }
    return { all: function () { return []; }, get: function () { return null; }, run: function () { return { changes: 0 }; } };
  }
};

(async function () {
  const det = emailMod.createEmailDetector({
    getDb: function () { return dbStub; },
    bandejaEnabledFor: function (ck) { return ck === 'emp1'; },
    trySync: async function () { return false; }
  });
  const res = await det({ companies: ['emp1', 'emp2'] });
  ok('detecta 3 no leidos', res.nuevas.length === 3);
  ok('tipo correo', res.nuevas[0].tipo === 'correo');
  // Buzón global: UNA fila por thread con company_key='*' (sin fan-out por empresa)
  ok('dedupe_key global', res.nuevas[0].dedupe_key.indexOf('correo:*:t1:') === 0);
  ok('company_key global *', res.nuevas.every(function (n) { return n.companyKey === '*' && n.company_key === '*'; }));
  ok('sin duplicado por empresa', res.nuevas.length === 3 && res.nuevas[0].ref_id !== res.nuevas[1].ref_id);
  ok('no loguea snippet largo en titulo', res.nuevas[0].titulo.length <= 200);

  // ── 📦823 · remitente ──
  ok('remitente: nombre + email', res.nuevas[0].remitente === 'Pausas Activas (pausas@acme.com)');
  ok('remitente: sin nombre cae al email', res.nuevas[1].remitente === 'noreply@acme.com');
  ok('remitente: sin datos queda vacio (no inventa)', res.nuevas[2].remitente === '');
  ok('remitente_nombre/email crudos tambien', res.nuevas[0].remitente_nombre === 'Pausas Activas' && res.nuevas[0].remitente_email === 'pausas@acme.com');

  // El SQL real debe traer las columnas del remitente (si no, siempre vacío).
  ok('SQL trae last_sender_name', /last_sender_name/.test(emailMod.SQL_NO_LEIDOS));
  ok('SQL trae last_sender_email', /last_sender_email/.test(emailMod.SQL_NO_LEIDOS));

  // formateo: nombre == email no se duplica, espacios colapsan, recorta largo
  const fR = emailMod.formatRemitente;
  ok('formatRemitente: nombre igual al email no repite', fR('juan@acme.com', 'juan@acme.com') === 'juan@acme.com');
  ok('formatRemitente: colapsa espacios', fR('  Juan   Pérez ', 'j@acme.com') === 'Juan Pérez (j@acme.com)');
  ok('formatRemitente: recorta largo con elipsis', fR('a'.repeat(200), '', 40).length === 40 && /…$/.test(fR('a'.repeat(200), '', 40)));
  ok('formatRemitente: nulls no rompen', fR(null, null) === '');

  const detOff = emailMod.createEmailDetector({
    getDb: function () { return dbStub; },
    bandejaEnabledFor: function () { return false; },
    trySync: async function () { return false; }
  });
  const res2 = await detOff({ companies: ['emp1'] });
  ok('bandeja disabled → 0 correos', res2.nuevas.length === 0);

  var f = 0;
  checks.forEach(function (c) {
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name);
    if (!c.ok) f++;
  });
  console.log((checks.length - f) + '/' + checks.length + ' OK');
  process.exit(f === 0 ? 0 : 1);
})().catch(function (e) { console.error(e); process.exit(1); });

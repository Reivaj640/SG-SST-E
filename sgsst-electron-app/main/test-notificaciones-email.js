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
            { thread_id: 't1', subject: 'Asunto 1', snippet: 'hola', company_key: 'emp1', last_message_date: '2026-09-22T11:00:00Z' },
            { thread_id: 't2', subject: 'Asunto 2', snippet: 'x', company_key: 'emp1', last_message_date: '2026-09-22T11:00:00Z' }
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
  ok('detecta 2 no leidos', res.nuevas.length === 2);
  ok('tipo correo', res.nuevas[0].tipo === 'correo');
  // Buzón global: UNA fila por thread con company_key='*' (sin fan-out por empresa)
  ok('dedupe_key global', res.nuevas[0].dedupe_key.indexOf('correo:*:t1:') === 0);
  ok('company_key global *', res.nuevas.every(function (n) { return n.companyKey === '*' && n.company_key === '*'; }));
  ok('sin duplicado por empresa', res.nuevas.length === 2 && res.nuevas[0].ref_id !== res.nuevas[1].ref_id);
  ok('no loguea snippet largo en titulo', res.nuevas[0].titulo.length <= 200);

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

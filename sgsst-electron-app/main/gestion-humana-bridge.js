// main/gestion-humana-bridge.js
// Bridge IPC del módulo Gestión Humana (v0.1.191) — FASE 0
//
// Patrón: mismo que main/presupuesto-bridge.js
// Firma: registerGestionHumanaHandlers(app, deps)
//   - app: electron app instance (en producción, contiene ipcMain via app.on o se pasa por .init())
//   - deps: { getDb, validateSession }
//
// En Fase 0 todos los handlers (excepto diag) son STUB. Retornan NOT_IMPLEMENTED.
// Fases siguientes implementan:
//   - Fase 1: read handlers (5)
//   - Fase 2: write contratacion (4)
//   - Fase 3: write personal (4) + write sedes (2)
//   - Fases 4-6: integración UI
//   - Fase 7: tests end-to-end

const MOD = 'GESTION-HUMANA';

let _getDb = null;
let _validateSession = null;

function _err(code, message, extra) {
  var e = { success: false, error: { code: code, message: message } };
  if (extra) e.error.extra = extra;
  return e;
}
function _ok(data) {
  return { success: true, data: data || {} };
}
function _stub(payload) {
  // 📦709 · Fase 0: stub para todos los handlers (excepto diag)
  console.log('[' + MOD + '] (Fase 0 stub) payload:', JSON.stringify(payload || {}));
  return _err('NOT_IMPLEMENTED', 'Handler pendiente de implementación (Fase 0)', { phase: 0 });
}

function registerGestionHumanaHandlers(app, deps) {
  _getDb = (deps && typeof deps.getDb === 'function') ? deps.getDb : null;
  _validateSession = (deps && typeof deps.validateSession === 'function') ? deps.validateSession : null;

  // El bridge requiere que init(ipcMain) haya sido llamado antes
  if (!registerGestionHumanaHandlers._ipcMain) {
    throw new Error('ipcMain no configurado. Usar registerGestionHumanaHandlers.init(ipcMain) primero.');
  }
  var ipcMainHandle = registerGestionHumanaHandlers._ipcMain.handle.bind(registerGestionHumanaHandlers._ipcMain);

  // ========== READ (5) ==========
  ipcMainHandle('gh:list-contrataciones', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:get-contratacion', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:list-personal', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:get-personal', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:list-sedes', function (event, payload) {
    return _stub(payload);
  });

  // ========== WRITE CONTRATACIÓN (4) ==========
  ipcMainHandle('gh:create-contratacion', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:update-contratacion', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:delete-contratacion', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:marcar-paso', function (event, payload) {
    return _stub(payload);
  });

  // ========== WRITE PERSONAL (4) ==========
  ipcMainHandle('gh:create-personal', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:update-personal', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:delete-personal', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:cambiar-estado', function (event, payload) {
    return _stub(payload);
  });

  // ========== WRITE SEDES (2) ==========
  ipcMainHandle('gh:create-sede', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:update-sede', function (event, payload) {
    return _stub(payload);
  });

  // ========== DIAG (1) — único handler real en Fase 0 ==========
  ipcMainHandle('gh:diag', function (event, payload) {
    return _ok({
      bridge: 'gestion-humana',
      phase: 0,
      has_getDb: !!_getDb,
      has_validateSession: !!_validateSession,
      message: 'Gestión Humana bridge en Fase 0 (15 stubs + 1 diag)'
    });
  });

  console.log('[' + MOD + '][INIT][SUCCESS] Bridge registrado · 5 read + 4 write-contratacion + 4 write-personal + 2 write-sedes + 1 diag · 16 handlers totales · Fase 0 (15 stubs + 1 diag)');
}

// Inicializa el bridge con el ipcMain real (llamado desde main.js)
registerGestionHumanaHandlers.init = function(ipcMain) {
  registerGestionHumanaHandlers._ipcMain = ipcMain;
};

module.exports = {
  registerGestionHumanaHandlers: registerGestionHumanaHandlers
};

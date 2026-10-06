// =====================================================================
// 📦827 (2026-09-30) — Test COMPORTAMENTAL del store SVE y su capa de
// persistencia.
//
// Por qué existe: los guards estáticos de 📦827 (sección 8j de
// test-medprev-3-1-2.js) comprueban el CABLEADO — que el archivo se cargue,
// que los canales estén registrados, que las vistas no toquen la base. Eso
// está bien y es barato. Pero la LÓGICA del store (hidratar, decidir si
// siembra, diffear el plan, revertir una escritura que falló, encolar) no la
// puede verificar un regex: cuatro de ocho mutaciones se escaparon justamente
// por eso. Este test la ejecuta de verdad.
//
// Cómo: se carga `sve-persistencia.js` y `sve-app.js` REALES dentro de un
// contexto `vm` con un `window.electronAPI` FALSO que implementa los 13
// canales como lo haría el bridge (misma forma `{success, data|error}`), y se
// habla con el store por su API pública — la misma que usan las 1.400 líneas
// de vistas, que no se tocan.
//
// No necesita Electron ni better-sqlite3: corre con node pelado.
// =====================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SVE_DIR = path.join(__dirname, '..', 'modules', 'gestion-salud', 'medicina-preventiva', 'sve');

const checks = [];
function ok(n, c, e) { checks.push({ n: n, ok: !!c, e: e }); }
const tick = () => new Promise(r => setImmediate(r));

// ---------- semilla minima (no la del prototipo: la que interesa es la forma) ----------
function seed() {
  return {
    meta: { empresa: 'Acme', anio: 2026, objetivo: 'OBJ' },
    fases: [{ id: 'planear', n: 1, name: 'PLANEAR', color: '#174ea6' }],
    plan: [
      { id: 'act-1', fase: 'planear', actividad: 'A1', responsable: 'R1', meses: [[1, 1], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]] },
      { id: 'act-2', fase: 'hacer', actividad: 'A2', responsable: 'R2', meses: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]] }
    ],
    seguimientos: [{ id: 'viejo-1', orden: 0, trabajador: 'Juan', anio: 2026 }],
    indicadores: {}, morbilidad: { anios: [], filas: [] }, analisis: [],
    catalogos: { areas: ['A'], cargos: ['C'], eps: ['E'], afp: ['F'] }
  };
}

// ---------- base de datos falsa, con la MISMA forma de contrato que el bridge ----------
function fakeDb() {
  return {
    meta: null, plan: [], seguimientos: [], indicadores: {}, morbilidad: null, analisis: [],
    llamadas: [], migrados: 0, idsUsados: {},
    reset: function () {
      this.meta = null; this.plan = []; this.seguimientos = []; this.indicadores = {};
      this.morbilidad = null; this.analisis = []; this.llamadas = []; this.migrados = 0; this.idsUsados = {};
    },
    initFrom: function (d) {
      this.meta = d.meta || null;
      this.plan = JSON.parse(JSON.stringify(d.plan || []));
      this.seguimientos = JSON.parse(JSON.stringify(d.seguimientos || []));
      this.indicadores = JSON.parse(JSON.stringify(d.indicadores || {}));
      this.morbilidad = JSON.parse(JSON.stringify(d.morbilidad || { anios: [], filas: [] }));
      this.analisis = JSON.parse(JSON.stringify(d.analisis || []));
    }
  };
}

// ---------- entorno: window falso con localStorage y electronAPI ----------
function montar({ conPuente = true, bus = null, storage = null, programaId = 'pg-1', empresa = 'Acme' } = {}) {
  const db = fakeDb();
  const store = {};
  const fallos = {};

  function canal(nombre, fn) {
    return function (payload) {
      db.llamadas.push({ canal: nombre, payload: payload });
      if (fallos[nombre]) {
        return Promise.resolve({ success: false, error: { code: fallos[nombre], message: 'fallo simulado' } });
      }
      try { return Promise.resolve(fn(payload || {})); } catch (e) {
        return Promise.resolve({ success: false, error: { code: 'EXCEPCION', message: e.message } });
      }
    };
  }

  const api = {
    medprevSveDatosGet: canal('datos:get', p => ({ success: true, data: {
      meta: db.meta, plan: db.plan, seguimientos: db.seguimientos,
      indicadores: db.indicadores, morbilidad: db.morbilidad || { anios: [], filas: [] },
      analisis: db.analisis
    }})),
    medprevSveMigrar: canal('migrar', p => {
      db.migrados++;
      const d = p.datos || {};
      if (db.seguimientos.length + db.plan.length > 0) {
        return { success: true, data: { migrado: false, motivo: 'la-base-ya-tiene-datos' } };
      }
      db.initFrom(d);
      return { success: true, data: { migrado: true, resumen: { casos: db.seguimientos.length, actividades: db.plan.length } } };
    }),
    medprevSveCasosCrear: canal('casos:crear', p => {
      const c = Object.assign({}, p.caso);
      c.id = p.idOpcional || ('msc-auto-' + (db.seguimientos.length + 1));
      if (db.idsUsados[c.id]) c.id = c.id + '-2';
      db.idsUsados[c.id] = 1;
      c.orden = db.seguimientos.length + 1;
      db.seguimientos.push(c);
      return { success: true, data: { caso: c } };
    }),
    medprevSveCasosActualizar: canal('casos:actualizar', p => {
      const i = db.seguimientos.findIndex(x => String(x.id) === String(p.casoId));
      if (i === -1) return { success: false, error: { code: 'NOT_FOUND', message: 'Caso no encontrado' } };
      Object.assign(db.seguimientos[i], p.caso);
      return { success: true, data: { caso: db.seguimientos[i] } };
    }),
    medprevSveCasosEliminar: canal('casos:eliminar', p => {
      const i = db.seguimientos.findIndex(x => String(x.id) === String(p.casoId));
      if (i === -1) return { success: false, error: { code: 'NOT_FOUND', message: 'Caso no encontrado' } };
      db.seguimientos.splice(i, 1);
      return { success: true, data: { eliminado: 1 } };
    }),
    medprevSvePlanActividadCrear: canal('plan:actividad:crear', p => {
      const usados = {};
      db.plan.forEach(a => { usados[a.id] = 1; });
      let n = 1; while (usados['act-' + n]) n++;
      const id = p.idOpcional || ('act-' + n);
      db.plan.push({ id: id, fase: p.fase, actividad: '', responsable: '', meses: Array.from({ length: 12 }, () => [0, 0]) });
      return { success: true, data: { id: id } };
    }),
    medprevSvePlanActividadGuardar: canal('plan:actividad:guardar', p => {
      const a = db.plan.find(x => String(x.id) === String(p.actividadId));
      if (!a) return { success: false, error: { code: 'NOT_FOUND', message: 'Actividad no encontrada' } };
      if (p.actividad !== undefined) a.actividad = p.actividad;
      if (p.responsable !== undefined) a.responsable = p.responsable;
      if (p.fase !== undefined) a.fase = p.fase;
      return { success: true, data: { actividadId: p.actividadId } };
    }),
    medprevSvePlanActividadEliminar: canal('plan:actividad:eliminar', p => {
      const i = db.plan.findIndex(x => String(x.id) === String(p.actividadId));
      if (i === -1) return { success: false, error: { code: 'NOT_FOUND', message: 'Actividad no encontrada' } };
      db.plan.splice(i, 1);
      return { success: true, data: { eliminado: 1 } };
    }),
    medprevSvePlanCeldaGuardar: canal('plan:celda:guardar', p => {
      const a = db.plan.find(x => String(x.id) === String(p.actividadId));
      if (!a) return { success: false, error: { code: 'NOT_FOUND', message: 'Actividad no encontrada' } };
      a.meses[p.mes - 1] = [p.ap ? 1 : 0, p.ae ? 1 : 0];
      return { success: true, data: { ok: 1 } };
    }),
    medprevSveMetaGuardar: canal('meta:guardar', p => { db.meta = p.meta; return { success: true, data: { guardado: 1 } }; }),
    medprevSveIndicadoresGuardar: canal('indicadores:guardar', p => { db.indicadores = p.indicadores; return { success: true, data: {} }; }),
    medprevSveMorbilidadGuardar: canal('morbilidad:guardar', p => { db.morbilidad = p.morbilidad; return { success: true, data: {} }; }),
    medprevSveAnalisisGuardar: canal('analisis:guardar', p => { db.analisis = p.analisis; return { success: true, data: {} }; })
  };

  if (conPuente) {
    for (const k in api) { if (typeof api[k] === 'function') api[k]._canal = k; }
  }

  // localStorage falso
  const ls = {
    _d: Object.assign({}, storage || {}),
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; }
  };

  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.console = { log() {}, warn() {}, error() {} };
  sandbox.localStorage = ls;
  sandbox.location = { search: '?modo=detalle&tipo=sve&id=' + programaId + '&empresa=' + encodeURIComponent(empresa), hash: '' };
  sandbox.document = {
    createElement: () => ({
      style: {}, setAttribute() {}, addEventListener() {},
      set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h || ''; },
      appendChild() {}, insertBefore() {}, querySelector: () => null, firstChild: null
    }),
    querySelector: () => null, getElementById: () => null, head: { appendChild() {} }
  };
  sandbox.addEventListener = () => {};
  sandbox.removeEventListener = () => {};
  sandbox.setTimeout = setTimeout; sandbox.clearTimeout = clearTimeout;
  if (conPuente) sandbox.electronAPI = api;
  sandbox.SVE_PROGRAMA_KEY = programaId;
  sandbox.SveSeed = seed();

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(SVE_DIR, 'sve-persistencia.js'), 'utf8'), sandbox, { filename: 'sve-persistencia.js' });
  vm.runInContext(fs.readFileSync(path.join(SVE_DIR, 'sve-app.js'), 'utf8'), sandbox, { filename: 'sve-app.js' });

  return { w: sandbox, db: db, ls: ls, fallos: fallos, api: api };
}

(async function () {
  // ================= 1. Hidratación desde la base =================
  {
    const e = montar();
    e.db.initFrom(seed());
    const r = await e.w.SveStore.init();
    ok('1) hidrata desde SQLite y queda en modo sqlite', r.ok && e.w.SveStore.modo() === 'sqlite', JSON.stringify(r));
    ok('1) el dataset hidratado trae los casos y el plan',
      e.w.SveStore.getState().seguimientos.length === 1 &&
      e.w.SveStore.getState().plan.length === 2 &&
      e.w.SveStore.getState().plan[0].meses.length === 12);
    ok('1) fases y catalogos vienen del seed (configuracion, no datos)',
      e.w.SveStore.getState().fases.length === 1 && e.w.SveStore.getState().catalogos.areas[0] === 'A');
    ok('1) NO se sembró (la base ya tenia datos)', e.db.migrados === 0, 'migrados=' + e.db.migrados);
  }

  // ================= 2. Primera vez: migra el localStorage =================
  {
    const previo = { meta: { empresa: 'Acme', anio: 2025 }, plan: [{ id: 'act-1', fase: 'planear', actividad: 'Vieja', meses: [] }], seguimientos: [{ id: 'x1', trabajador: 'Ana' }] };
    const e = montar({ storage: { 'kair.sve.data.v1:pg-1': JSON.stringify(previo) } });
    const r = await e.w.SveStore.init();
    ok('2) programa nuevo: migra el localStorage a la base', r.ok && e.db.migrados === 1, 'migrados=' + e.db.migrados);
    ok('2) lo migrado conserva el contenido capturado', e.db.plan[0].actividad === 'Vieja' && e.db.seguimientos[0].trabajador === 'Ana');
    ok('2) el localStorage se borra (la base ya es la duena real)', e.ls.getItem('kair.sve.data.v1:pg-1') === null);
  }

  // ================= 3. Primera vez sin nada: siembra la demo =================
  {
    const e = montar();
    const r = await e.w.SveStore.init();
    ok('3) programa nuevo sin datos: siembra la plantilla', r.ok && e.db.migrados === 1 && e.db.plan.length === 2);
    ok('3) tras sembrar, el meta queda guardado (marcador de inicializado)', !!e.db.meta);
  }

  // ================= 4. Programa VACIO no se vuelve a sembrar =================
  // Este es el caso que un "¿tiene registros?" no cubre: el usuario borro
  // todos los casos y actividades, y la demo volvería a aparecerle.
  {
    const e = montar();
    e.db.initFrom({ meta: { empresa: 'Acme', anio: 2026 }, plan: [], seguimientos: [], indicadores: {}, morbilidad: { anios: [], filas: [] }, analisis: [] });
    const r = await e.w.SveStore.init();
    ok('4) programa vacio (con meta) NO se vuelve a sembrar', r.ok && e.db.migrados === 0, 'migrados=' + e.db.migrados);
    ok('4) sigue showing vacio, sin actividad fantasma', e.w.SveStore.getState().plan.length === 0);
  }

  // ================= 5. Error de base: NO cae a localStorage =================
  {
    const e = montar();
    e.fallos['datos:get'] = 'AUTH_INVALID_SESSION';
    const r = await e.w.SveStore.init();
    ok('5) si la base falla, init lo reporta y no se degrada solo',
      r.ok === false && r.error && r.error.code === 'AUTH_INVALID_SESSION', JSON.stringify(r));
    ok('5) en ese caso no se escribe ni se siembra nada', e.db.migrados === 0);
  }

  // ================= 6. Sin puente: modo local (prototipo suelto) =================
  {
    const e = montar({ conPuente: false });
    const r = await e.w.SveStore.init();
    ok('6) sin puente (electronAPI) el store funciona en modo local', r.ok && e.w.SveStore.modo() === 'local');
    ok('6) en modo local siembra en localStorage', !!e.ls.getItem('kair.sve.data.v1:pg-1'));
  }

  // ================= 7. Crear caso: id de texto, devuelto al instante =================
  {
    const e = montar();
    e.db.initFrom(seed());
    await e.w.SveStore.init();
    const id = e.w.SveStore.addSeguimiento({ trabajador: 'Nuevo', anio: 2026 });
    ok('7) addSeguimiento devuelve el id de TEXTO en el mismo tick', typeof id === 'string' && /^msc-/.test(id), String(id));
    ok('7) el caso queda en memoria de inmediato (la vista navega al instante)',
      e.w.SveStore.getState().seguimientos.some(s => String(s.id) === String(id)));
    await tick();
    ok('7) y tambien llega a la base con ese mismo id',
      e.db.seguimientos.some(s => String(s.id) === String(id) && s.trabajador === 'Nuevo'));
  }

  // ================= 8. save() manda SOLO la celda que cambio =================
  {
    const e = montar();
    e.db.initFrom(seed());
    await e.w.SveStore.init();
    const st = e.w.SveStore.getState();
    st.plan[0].meses[2][0] = 1;          // marzo programado (celda 3)
    e.w.SveStore.save();
    await tick();
    const celdas = e.db.llamadas.filter(c => c.canal === 'plan:celda:guardar');
    ok('8) save() escribe una sola celda, no las 12 de la fila', celdas.length === 1, 'envios=' + celdas.length);
    ok('8) y es la celda correcta (mes 3)', celdas.length === 1 && celdas[0].payload.mes === 3);
    ok('8) el valor llega bien a la base', e.db.plan[0].meses[2][0] === 1);

    // segunda llamada sin cambios: no debe reescribir nada
    const antes = e.db.llamadas.length;
    e.w.SveStore.save();
    await tick();
    ok('8) save() sin cambios no manda nada (idempotente)', e.db.llamadas.length === antes,
      'envios extra=' + (e.db.llamadas.length - antes));
  }

  // ================= 9. Una celda que falla NO queda como guardada =================
  // La garantia que importa no es "que se revierta la variable" (eso es un
  // detalle interno) sino lo que ve el usuario: si la escritura fallo, la
  // celda no puede quedar marcada como guardada, y al volver a marcarla tiene
  // que LLEGAR a la base. Ojo: hay que releer `getState()` en cada paso, porque
  // tras un fallo el store se recarga desde la base y las referencias viejas
  // quedan desactualizadas — un test que muta el `st` capturado estaria
  // escribiendo sobre un objeto que ya no manda.
  {
    const e = montar();
    e.db.initFrom(seed());
    await e.w.SveStore.init();
    e.fallos['plan:celda:guardar'] = 'INTERNAL';
    e.w.SveStore.getState().plan[0].meses[2][0] = 1;
    e.w.SveStore.save();
    await tick();
    ok('9) la celda que fallo no queda marcada como guardada',
      e.w.SveStore.getState().plan[0].meses[2][0] === 0,
      'quedo=' + e.w.SveStore.getState().plan[0].meses[2][0]);
    ok('9) y la base sigue con el valor anterior', e.db.plan[0].meses[2][0] === 0);

    // Ahora sin fallo: tiene que REENVIARSE. Si la sombra hubiera quedado
    // dando el cambio por aplicado, el diff no enviaria nada y el dato se
    // perderia en silencio para siempre.
    delete e.fallos['plan:celda:guardar'];
    e.w.SveStore.getState().plan[0].meses[2][0] = 1;
    e.w.SveStore.save();
    await tick();
    ok('9) al reintentarla, se guarda de verdad', e.db.plan[0].meses[2][0] === 1,
      'base=' + e.db.plan[0].meses[2][0]);

    // Y al recargar en frio, lo guardado se lee igual (ida y vuelta).
    const r = await e.w.SveStore.recargar();
    ok('9) recarga en frio: lo guardado se lee igual',
      r.ok && e.w.SveStore.getState().plan[0].meses[2][0] === 1);
  }

  // ================= 10. Editar texto de actividad: una sola llamada =================
  {
    const e = montar();
    e.db.initFrom(seed());
    await e.w.SveStore.init();
    const st = e.w.SveStore.getState();
    st.plan[0].actividad = 'A';
    e.w.SveStore.updateActividad('act-1', { actividad: 'A' });
    e.w.SveStore.updateActividad('act-1', { actividad: 'AB' });
    e.w.SveStore.updateActividad('act-1', { actividad: 'ABC' });
    await tick();
    const acts = e.db.llamadas.filter(c => c.canal === 'plan:actividad:guardar');
    ok('10) tres pulsaciones se resuelven en una sola escritura', acts.length === 1, 'envios=' + acts.length);
    ok('10) y se guarda el ULTIMO valor, no el primero', acts.length === 1 && acts[0].payload.actividad === 'ABC');
    ok('10) el texto llega a la base', e.db.plan[0].actividad === 'ABC');
  }

  // ================= 11. Borrar actividad que falla: la fila vuelve =================
  {
    const e = montar();
    e.db.initFrom(seed());
    await e.w.SveStore.init();
    e.fallos['plan:actividad:eliminar'] = 'INTERNAL';
    e.w.SveStore.removeActividad('act-1');
    ok('11) al borrar, la fila sale de inmediato', e.w.SveStore.getState().plan.length === 1);
    await tick();
    ok('11) si el borrado falla, la fila vuelve a su lugar', e.w.SveStore.getState().plan.length === 2,
      'plan=' + e.w.SveStore.getState().plan.length);
    ok('11) y la base sigue teniendo las 2 actividades', e.db.plan.length === 2);
  }

  // ================= 12. Analisis se guarda completo =================
  {
    const e = montar();
    e.db.initFrom(seed());
    e.db.analisis = [{ periodo: '1', hallazgos: '', propuestas: '', responsable: '' }];
    await e.w.SveStore.init();
    e.w.SveStore.updateAnalisis(0, { hallazgos: 'H' });
    await tick();
    ok('12) updateAnalisis manda el bloque completo (el bridge lo reemplaza)',
      e.db.analisis.length === 1 && e.db.analisis[0].hallazgos === 'H' && e.db.analisis[0].periodo === '1');
  }

  // ================= 13. setUi NO toca la base =================
  {
    const e = montar();
    e.db.initFrom(seed());
    await e.w.SveStore.init();
    const antes = e.db.llamadas.length;
    e.w.SveStore.setUi({ anioDash: 2024 });
    await tick();
    ok('13) setUi no escribe en la base (es estado de vista)', e.db.llamadas.length === antes);
    ok('13) pero se recuerda para el proximo arranque', e.ls.getItem('kair.sve.ui.v1:pg-1') &&
      JSON.parse(e.ls.getItem('kair.sve.ui.v1:pg-1')).anioDash === 2024);
  }

  // ================= 14. Aislamiento por empresa/programa =================
  {
    const e = montar({ empresa: 'Otra' });
    e.db.initFrom(seed());
    await e.w.SveStore.init();
    const lectura = e.db.llamadas.find(c => c.canal === 'datos:get');
    ok('14) cada llamada viaja con empresa y programa', lectura &&
      lectura.payload.companyName === 'Otra' && lectura.payload.programaId === 'pg-1',
      JSON.stringify(lectura && lectura.payload));
  }

  // ================= 15. La migracion es idempotente (se puede llamar siempre) =================
  {
    const e = montar();
    const previo = { meta: { empresa: 'Acme' }, plan: [], seguimientos: [{ id: 'x', trabajador: 'Ana' }] };
    e.ls.setItem('kair.sve.data.v1:pg-1', JSON.stringify(previo));
    await e.w.SveStore.init();
    e.ls.setItem('kair.sve.data.v1:pg-1', JSON.stringify(previo));
    await e.w.SveStore.init();
    ok('15) una segunda pasada no duplica lo ya migrado',
      e.db.seguimientos.length === 1, 'casos=' + e.db.seguimientos.length);
  }

  let failed = 0;
  console.log('\n=======================================');
  console.log('  📦827 · Test comportamental del store SVE');
  console.log('=======================================');
  checks.forEach(c => {
    if (!c.ok) failed++;
    console.log((c.ok ? 'OK   ' : 'FAIL ') + c.n + (c.e ? '  [' + c.e + ']' : ''));
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  console.log('=======================================');
  process.exit(failed === 0 ? 0 : 1);
})();

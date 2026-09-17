// test-cambio-stats.js
// Tests para calculateCambioStats (2.11.1 Gestión del Cambio)
// Verifica la agregación de pipeline (5 etapas) y aging (4 buckets de antigüedad).

const path = require('path');
const assert = require('assert');

// ============================================================
// Replicar la función aggregateCambioStats que vivirá en main.js
// (mismo patrón usado en test-politica-stats.js con isPoliticaSSTFile).
// Esto se elimina cuando movamos los helpers a un módulo compartido.
// ============================================================

function normEstado(estado) {
  return String(estado || '').toLowerCase().trim();
}

function classifyPipeline(estado) {
  const e = normEstado(estado);
  if (e === 'solicitud' || e === 'pendiente') return 'solicitud';
  if (e === 'en evaluación' || e === 'en evaluacion') return 'evaluacion';
  if (e === 'aprobado' || e === 'aprobada') return 'aprobado';
  if (e === 'en ejecución' || e === 'en ejecucion' || e === 'en proceso' || e === 'en ejecucción') return 'ejecucion';
  if (e === 'cerrado' || e === 'cerrada' || e === 'cancelado' || e === 'cancelada' ||
      e === 'no aprobado' || e === 'no aprobada' || e === 'completado' || e === 'completada') return 'cerrado';
  return 'solicitud'; // catch-all
}

function classifyAging(fecha, hoy) {
  if (!fecha) return null;
  let d;
  try {
    d = new Date(fecha);
    if (isNaN(d.getTime())) return null;
  } catch (e) {
    return null;
  }
  const ms = hoy.getTime() - d.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return '0_15'; // fechas futuras: tratar como recientes
  if (days <= 15) return '0_15';
  if (days <= 30) return '16_30';
  if (days <= 60) return '31_60';
  return '60_plus';
}

function aggregateCambioStats(changes, hoy) {
  hoy = hoy || new Date();
  const pipeline = { solicitud: 0, evaluacion: 0, aprobado: 0, ejecucion: 0, cerrado: 0 };
  const aging = { '0_15': 0, '16_30': 0, '31_60': 0, '60_plus': 0 };

  let total = 0;
  let pending = 0;

  if (!Array.isArray(changes)) return { pipeline, aging, total: 0, pending: 0 };

  for (const ch of changes) {
    total++;
    const stage = classifyPipeline(ch.estado);
    pipeline[stage]++;

    // aging: solo aplica a cambios que NO están cerrados
    if (stage !== 'cerrado') {
      pending++;
      const bucket = classifyAging(ch.fecha, hoy);
      if (bucket) aging[bucket]++;
    }
  }

  return { pipeline, aging, total, pending };
}

// ============================================================
// Tests
// ============================================================

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  OK     ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL   ${name}`);
    console.log(`         ${err.message}`);
    failed++;
  }
}

console.log('========================================');
console.log('Test: Gestión del Cambio stats (Pipeline + Aging)');
console.log('========================================\n');

console.log('classifyPipeline:');
test('estado "Solicitud" → solicitud', () => {
  assert.strictEqual(classifyPipeline('Solicitud'), 'solicitud');
});
test('estado "Pendiente" → solicitud', () => {
  assert.strictEqual(classifyPipeline('Pendiente'), 'solicitud');
});
test('estado "En Evaluación" → evaluacion (con tilde)', () => {
  assert.strictEqual(classifyPipeline('En Evaluación'), 'evaluacion');
});
test('estado "En Evaluacion" → evaluacion (sin tilde)', () => {
  assert.strictEqual(classifyPipeline('En Evaluacion'), 'evaluacion');
});
test('estado "Aprobado" → aprobado', () => {
  assert.strictEqual(classifyPipeline('Aprobado'), 'aprobado');
});
test('estado "Aprobada" → aprobado', () => {
  assert.strictEqual(classifyPipeline('Aprobada'), 'aprobado');
});
test('estado "En Ejecución" → ejecucion', () => {
  assert.strictEqual(classifyPipeline('En Ejecución'), 'ejecucion');
});
test('estado "En Proceso" → ejecucion', () => {
  assert.strictEqual(classifyPipeline('En Proceso'), 'ejecucion');
});
test('estado "Cerrado" → cerrado', () => {
  assert.strictEqual(classifyPipeline('Cerrado'), 'cerrado');
});
test('estado "No Aprobado" → cerrado', () => {
  assert.strictEqual(classifyPipeline('No Aprobado'), 'cerrado');
});
test('estado "Cancelado" → cerrado', () => {
  assert.strictEqual(classifyPipeline('Cancelado'), 'cerrado');
});
test('estado "Completado" → cerrado', () => {
  assert.strictEqual(classifyPipeline('Completado'), 'cerrado');
});
test('estado vacío → solicitud (catch-all)', () => {
  assert.strictEqual(classifyPipeline(''), 'solicitud');
});
test('estado null → solicitud (catch-all)', () => {
  assert.strictEqual(classifyPipeline(null), 'solicitud');
});
test('estado minúsculas "solicitud" → solicitud', () => {
  assert.strictEqual(classifyPipeline('solicitud'), 'solicitud');
});
test('estado "CERRADO" mayúsculas → cerrado', () => {
  assert.strictEqual(classifyPipeline('CERRADO'), 'cerrado');
});

console.log('\nclassifyAging:');
const HOY = new Date('2026-07-15T12:00:00Z');
const dia = (n) => {
  const d = new Date(HOY);
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};
test('fecha de hoy → 0_15', () => {
  assert.strictEqual(classifyAging(dia(0), HOY), '0_15');
});
test('fecha de hace 5 días → 0_15', () => {
  assert.strictEqual(classifyAging(dia(5), HOY), '0_15');
});
test('fecha de hace 15 días → 0_15 (boundary)', () => {
  assert.strictEqual(classifyAging(dia(15), HOY), '0_15');
});
test('fecha de hace 16 días → 16_30 (boundary)', () => {
  assert.strictEqual(classifyAging(dia(16), HOY), '16_30');
});
test('fecha de hace 25 días → 16_30', () => {
  assert.strictEqual(classifyAging(dia(25), HOY), '16_30');
});
test('fecha de hace 30 días → 16_30 (boundary)', () => {
  assert.strictEqual(classifyAging(dia(30), HOY), '16_30');
});
test('fecha de hace 31 días → 31_60 (boundary)', () => {
  assert.strictEqual(classifyAging(dia(31), HOY), '31_60');
});
test('fecha de hace 45 días → 31_60', () => {
  assert.strictEqual(classifyAging(dia(45), HOY), '31_60');
});
test('fecha de hace 60 días → 31_60 (boundary)', () => {
  assert.strictEqual(classifyAging(dia(60), HOY), '31_60');
});
test('fecha de hace 61 días → 60_plus (boundary)', () => {
  assert.strictEqual(classifyAging(dia(61), HOY), '60_plus');
});
test('fecha de hace 365 días → 60_plus', () => {
  assert.strictEqual(classifyAging(dia(365), HOY), '60_plus');
});
test('fecha futura → 0_15 (catch)', () => {
  const d = new Date(HOY);
  d.setDate(d.getDate() + 5);
  assert.strictEqual(classifyAging(d.toISOString().split('T')[0], HOY), '0_15');
});
test('fecha null → null', () => {
  assert.strictEqual(classifyAging(null, HOY), null);
});
test('fecha vacía → null', () => {
  assert.strictEqual(classifyAging('', HOY), null);
});
test('fecha inválida "no-fecha" → null', () => {
  assert.strictEqual(classifyAging('no-fecha', HOY), null);
});

console.log('\naggregateCambioStats:');
test('array vacío → todo en cero', () => {
  const r = aggregateCambioStats([], HOY);
  assert.deepStrictEqual(r.pipeline, { solicitud: 0, evaluacion: 0, aprobado: 0, ejecucion: 0, cerrado: 0 });
  assert.deepStrictEqual(r.aging, { '0_15': 0, '16_30': 0, '31_60': 0, '60_plus': 0 });
  assert.strictEqual(r.total, 0);
  assert.strictEqual(r.pending, 0);
});
test('null/undefined → todo en cero (no crash)', () => {
  assert.strictEqual(aggregateCambioStats(null, HOY).total, 0);
  assert.strictEqual(aggregateCambioStats(undefined, HOY).total, 0);
});
test('5 cambios: 1 en cada etapa del pipeline', () => {
  const r = aggregateCambioStats([
    { id: 'CHG-2026-001', estado: 'Solicitud', fecha: dia(5) },
    { id: 'CHG-2026-002', estado: 'En Evaluación', fecha: dia(10) },
    { id: 'CHG-2026-003', estado: 'Aprobado', fecha: dia(20) },
    { id: 'CHG-2026-004', estado: 'En Ejecución', fecha: dia(35) },
    { id: 'CHG-2026-005', estado: 'Cerrado', fecha: dia(100) }
  ], HOY);
  assert.deepStrictEqual(r.pipeline, { solicitud: 1, evaluacion: 1, aprobado: 1, ejecucion: 1, cerrado: 1 });
  assert.strictEqual(r.total, 5);
});
test('aging NO cuenta cambios cerrados', () => {
  const r = aggregateCambioStats([
    { id: 'A', estado: 'Solicitud', fecha: dia(5) },
    { id: 'B', estado: 'Cerrado', fecha: dia(100) },
    { id: 'C', estado: 'No Aprobado', fecha: dia(80) },
    { id: 'D', estado: 'Cancelado', fecha: dia(50) }
  ], HOY);
  assert.strictEqual(r.pending, 1); // solo A está pendiente
  assert.strictEqual(r.aging['0_15'], 1);
  assert.strictEqual(r.aging['16_30'], 0);
  assert.strictEqual(r.aging['31_60'], 0);
  assert.strictEqual(r.aging['60_plus'], 0);
});
test('aging buckets con mezcla realista', () => {
  const r = aggregateCambioStats([
    { id: 'A', estado: 'Solicitud', fecha: dia(3) },      // 0_15
    { id: 'B', estado: 'Pendiente', fecha: dia(20) },     // 16_30
    { id: 'C', estado: 'Aprobado', fecha: dia(50) },      // 31_60
    { id: 'D', estado: 'En Ejecución', fecha: dia(120) }, // 60_plus
    { id: 'E', estado: 'En Evaluación', fecha: null },    // skip aging (sin fecha)
  ], HOY);
  assert.strictEqual(r.aging['0_15'], 1);
  assert.strictEqual(r.aging['16_30'], 1);
  assert.strictEqual(r.aging['31_60'], 1);
  assert.strictEqual(r.aging['60_plus'], 1);
  assert.strictEqual(r.pending, 5); // todos pendientes (E no cerrado)
});
test('estado vacío/null se cuenta como solicitud (no se pierde)', () => {
  const r = aggregateCambioStats([
    { id: 'A', estado: '', fecha: dia(5) },
    { id: 'B', estado: null, fecha: dia(10) },
    { id: 'C', fecha: dia(15) }  // sin campo estado
  ], HOY);
  assert.strictEqual(r.pipeline.solicitud, 3);
  assert.strictEqual(r.total, 3);
});
test('mixed: respeta todos los buckets correctamente', () => {
  const r = aggregateCambioStats([
    { id: 'A', estado: 'Solicitud', fecha: dia(2) },      // solicitud, 0_15
    { id: 'B', estado: 'En Evaluación', fecha: dia(28) }, // evaluacion, 16_30
    { id: 'C', estado: 'Aprobado', fecha: dia(45) },      // aprobado, 31_60
    { id: 'D', estado: 'En Ejecución', fecha: dia(80) },  // ejecucion, 60_plus
    { id: 'E', estado: 'Cerrado', fecha: dia(200) },      // cerrado (no aging)
    { id: 'F', estado: 'Aprobada', fecha: dia(40) },      // aprobado, 31_60
    { id: 'G', estado: 'No Aprobado', fecha: dia(70) },   // cerrado (no aging)
  ], HOY);
  assert.deepStrictEqual(r.pipeline, { solicitud: 1, evaluacion: 1, aprobado: 2, ejecucion: 1, cerrado: 2 });
  assert.strictEqual(r.aging['0_15'], 1);
  assert.strictEqual(r.aging['16_30'], 1);
  assert.strictEqual(r.aging['31_60'], 2);
  assert.strictEqual(r.aging['60_plus'], 1);
  assert.strictEqual(r.total, 7);
  assert.strictEqual(r.pending, 5);
});

console.log('\n========================================');
console.log(`Resultado: ${passed} OK / ${failed} FAIL`);
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);

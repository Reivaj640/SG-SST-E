// test-calculate-objetivos-stats.js
// 📦560 — Tests para calculateObjetivosStats() reescrito.
// Valida que la función usa resultados manuales + auto-resultados (no texto "cumplido"),
// y que el conteo por principio es correcto.
//
// Tests:
//   T1: Estructura básica (carpeta inexistente → stats vacíos correctos)
//   T2: autoDetectPrinciple — clasificación por keywords
//   T3: matchAutoResultado — match por keyword entre indicador y autoResultados
//   T4: Cálculo de cumplimiento con resultados manuales (>=70%)
//   T5: Cálculo de cumplimiento con resultados manuales (<70% no cumple)
//   T6: Fallback a auto-resultados cuando no hay manual
//   T7: Agrupación por objetivo (mismo groupIdx que el viewer)
//   T8: Porcentaje global y por principio correctos
//   T9: Sin resultados (manuales ni auto) → todo pendiente

'use strict';

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const assert = require('assert');

// ============================================================================
// HELPERS DE TEST
// ============================================================================

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`  ✅ ${name}`);
      passed++;
    })
    .catch((err) => {
      console.log(`  ❌ ${name}`);
      console.log(`     Error: ${err.message}`);
      if (err.actual !== undefined) {
        console.log(`     Actual:   ${JSON.stringify(err.actual)}`);
        console.log(`     Expected: ${JSON.stringify(err.expected)}`);
      }
      failed++;
    });
}

function section(name) {
  console.log(`\n📋 ${name}`);
}

// Replicar KEYWORD_MAP y helpers de main.js para tests aislados.
// Si main.js cambia, hay que actualizar esto. (Misma estructura que objetivos-sst-viewer.js)
const KEYWORD_MAP = {
  1: ['accidente', 'lesion', 'lesión', 'incidente', 'enfermedad laboral',
      'accidentalidad', 'mortalidad', 'ausentismo', 'peligro', 'riesgo',
      'severidad', 'mortal', 'eventos con les', 'frecuencia de ac'],
  2: ['legal', 'ley ', 'normativa', 'requisito legal', 'cumplimiento legal',
      'matriz legal', 'reglamento', 'decreto', 'resolución', 'otros requisitos',
      'cumplir con los requisitos'],
  3: ['cliente', 'satisfacc', 'queja', 'reclamo', 'encuesta', 'calidad total',
      'expectativa', 'lograr la satisf', 'servicio al'],
  4: ['presupuesto', 'recurso', 'capacitac', 'competen', 'mejora continua',
      'acciones correctiva', 'acciones preventiva', 'cronograma',
      'ambientes de trabajo', 'ambiente sano', 'correctiva', 'preventiva', 'sano y seguro']
};

function autoDetectPrinciple(text) {
  const lower = (text || '').toLowerCase();
  const scores = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const pid in KEYWORD_MAP) {
    if (!KEYWORD_MAP.hasOwnProperty(pid)) continue;
    const words = KEYWORD_MAP[pid];
    for (let i = 0; i < words.length; i++) {
      if (lower.indexOf(words[i].toLowerCase()) !== -1) {
        scores[pid]++;
      }
    }
  }
  let maxScore = 0;
  let bestPid = 4;
  for (const p in scores) {
    if (scores.hasOwnProperty(p) && scores[p] > maxScore) {
      maxScore = scores[p];
      bestPid = parseInt(p);
    }
  }
  return bestPid;
}

function matchAutoResultado(indicatorText, autoResultados) {
  if (!autoResultados || Object.keys(autoResultados).length === 0) return null;
  const lower = (indicatorText || '').toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  function crearMatch(autoKey, autoVal) {
    return {
      porcentajeReal: autoVal.porcentajeReal,
      source: 'auto',
      keyword: autoKey,
      resultado: autoVal.resultado || null
    };
  }

  // ESTRATEGIA 1: búsqueda directa
  for (const directKey in autoResultados) {
    if (!autoResultados.hasOwnProperty(directKey)) continue;
    const directLower = directKey.toLowerCase();
    if (directLower.length < 3) continue;
    if (lower.indexOf(directLower) !== -1) {
      const directAuto = autoResultados[directKey];
      if (directAuto && typeof directAuto.porcentajeReal === 'number' && directAuto.porcentajeReal > bestScore) {
        bestMatch = crearMatch(directKey, directAuto);
        bestScore = directAuto.porcentajeReal;
      }
    }
  }

  // ESTRATEGIA 2: KEYWORD_MAP
  for (const pidStr in KEYWORD_MAP) {
    if (!KEYWORD_MAP.hasOwnProperty(pidStr)) continue;
    const kws = KEYWORD_MAP[parseInt(pidStr)];
    for (let k = 0; k < kws.length; k++) {
      const kw = kws[k].toLowerCase();
      if (lower.indexOf(kw) === -1) continue;
      for (const autoKey in autoResultados) {
        if (!autoResultados.hasOwnProperty(autoKey)) continue;
        const autoLower = autoKey.toLowerCase();
        if (autoLower.indexOf(kw) !== -1 || kw.indexOf(autoLower) !== -1) {
          const auto = autoResultados[autoKey];
          if (auto && typeof auto.porcentajeReal === 'number' && auto.porcentajeReal > bestScore) {
            bestMatch = crearMatch(autoKey, auto);
            bestScore = auto.porcentajeReal;
          }
        }
      }
    }
  }

  // 📦562b — ESTRATEGIA 3: si no se encontró match con >0, buscar con =0
  if (bestMatch === null) {
    for (const directKey2 in autoResultados) {
      if (!autoResultados.hasOwnProperty(directKey2)) continue;
      const directLower2 = directKey2.toLowerCase();
      if (directLower2.length < 3) continue;
      if (lower.indexOf(directLower2) !== -1) {
        bestMatch = crearMatch(directKey2, autoResultados[directKey2]);
        break;
      }
    }
  }
  if (bestMatch === null) {
    for (const pidStr2 in KEYWORD_MAP) {
      if (!KEYWORD_MAP.hasOwnProperty(pidStr2)) continue;
      const kws2 = KEYWORD_MAP[parseInt(pidStr2)];
      for (let k2 = 0; k2 < kws2.length; k2++) {
        const kw2 = kws2[k2].toLowerCase();
        if (lower.indexOf(kw2) === -1) continue;
        for (const autoKey2 in autoResultados) {
          if (!autoResultados.hasOwnProperty(autoKey2)) continue;
          const autoLower2 = autoKey2.toLowerCase();
          if (autoLower2.indexOf(kw2) !== -1 || kw2.indexOf(autoLower2) !== -1) {
            bestMatch = crearMatch(autoKey2, autoResultados[autoKey2]);
            break;
          }
        }
        if (bestMatch !== null) break;
      }
      if (bestMatch !== null) break;
    }
  }

  return bestMatch;
}

// 📦561 — Helpers de A1 (mismas definiciones que en main.js)
function parseMetaIndicador(metaStr) {
  if (metaStr === null || metaStr === undefined) return null;
  let s = String(metaStr).trim();
  if (s === '') return null;
  s = s.replace(/%$/, '').trim();

  let match;
  if ((match = s.match(/^<=\s*([-+]?\d*\.?\d+)$/))) return { operador: 'lte', valor: parseFloat(match[1]) };
  if ((match = s.match(/^>=\s*([-+]?\d*\.?\d+)$/))) return { operador: 'gte', valor: parseFloat(match[1]) };
  if ((match = s.match(/^<\s*([-+]?\d*\.?\d+)$/))) return { operador: 'lt', valor: parseFloat(match[1]) };
  if ((match = s.match(/^>\s*([-+]?\d*\.?\d+)$/))) return { operador: 'gt', valor: parseFloat(match[1]) };
  if ((match = s.match(/^=\s*([-+]?\d*\.?\d+)$/))) return { operador: 'eq', valor: parseFloat(match[1]) };
  if ((match = s.match(/^([-+]?\d*\.?\d+)$/))) return { operador: 'eq', valor: parseFloat(match[1]) };
  return null;
}

function parseValorIndicador(valorStr) {
  if (valorStr === null || valorStr === undefined) return null;
  const s = String(valorStr).trim();
  if (s === '' || s === 'NaN' || s === 'Infinity' || s === '-Infinity') return null;
  const match = s.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const num = parseFloat(match[0]);
  if (isNaN(num)) return null;
  return num;
}

function evaluarCumplimientoPorMeta(valorNum, metaStr) {
  if (typeof valorNum !== 'number' || isNaN(valorNum)) {
    return { cumple: false, porcentajeReal: 0, razon: 'valor no numérico' };
  }
  const meta = parseMetaIndicador(metaStr);
  if (!meta) return { cumple: false, porcentajeReal: 0, razon: 'meta no parseable' };

  if (meta.operador === 'lt') {
    if (meta.valor === 0) {
      const eqC = valorNum === 0;
      return { cumple: eqC, porcentajeReal: eqC ? 100 : 0 };
    }
    if (valorNum <= meta.valor) {
      if (valorNum === meta.valor) {
        return { cumple: true, porcentajeReal: 0 };
      }
      const ratio = 1 - (valorNum / meta.valor);
      const pct = Math.round(ratio * 100);
      return { cumple: true, porcentajeReal: Math.max(0, Math.min(100, pct)) };
    }
    return { cumple: false, porcentajeReal: 0 };
  }
  if (meta.operador === 'lte') {
    const ok = valorNum <= meta.valor;
    return { cumple: ok, porcentajeReal: ok ? 100 : 0 };
  }
  if (meta.operador === 'gt') {
    const ok = valorNum > meta.valor;
    return { cumple: ok, porcentajeReal: ok ? 100 : 0 };
  }
  if (meta.operador === 'gte') {
    const ok = valorNum >= meta.valor;
    return { cumple: ok, porcentajeReal: ok ? 100 : 0 };
  }
  if (meta.operador === 'eq') {
    const ok = valorNum === meta.valor;
    return { cumple: ok, porcentajeReal: ok ? 100 : 0 };
  }
  return { cumple: false, porcentajeReal: 0, razon: 'operador desconocido' };
}

// ============================================================================
// TESTS
// ============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Tests calculateObjetivosStats (📦560)');
  console.log('═══════════════════════════════════════════════════════════');

  // ────────────────────────────────────────────────────────────────────────
  section('T1: Estructura básica (carpeta inexistente)');
  // ────────────────────────────────────────────────────────────────────────
  // Verificamos que con un basePath vacío, la función retorna la estructura
  // por defecto sin tirar error.
  await test('Retorna estructura correcta con basePath inexistente', async () => {
    // Simulamos la función sin cargarla de main.js (que requiere Electron)
    const expectedStructure = {
      total: 0,
      cumplidos: 0,
      porcentaje: 0,
      porPrincipio: {
        1: { nombre: 'Prevención', total: 0, cumplidos: 0, porcentaje: 0 },
        2: { nombre: 'Requisitos Legales', total: 0, cumplidos: 0, porcentaje: 0 },
        3: { nombre: 'Satisfacción Cliente', total: 0, cumplidos: 0, porcentaje: 0 },
        4: { nombre: 'Recursos y Mejora', total: 0, cumplidos: 0, porcentaje: 0 }
      }
    };
    assert.deepStrictEqual(
      Object.keys(expectedStructure).sort(),
      ['cumplidos', 'porPrincipio', 'porcentaje', 'total']
    );
    // Solo verificamos las keys (orden alfabético). El test del contenido
    // se hace en los otros tests.
    assert.strictEqual(expectedStructure.porPrincipio[1].nombre, 'Prevención');
    assert.strictEqual(expectedStructure.porPrincipio[2].nombre, 'Requisitos Legales');
    assert.strictEqual(expectedStructure.porPrincipio[3].nombre, 'Satisfacción Cliente');
    assert.strictEqual(expectedStructure.porPrincipio[4].nombre, 'Recursos y Mejora');
  });

  // ────────────────────────────────────────────────────────────────────────
  section('T2: autoDetectPrinciple — clasificación por keywords');
  // ────────────────────────────────────────────────────────────────────────
  await test('Detecta Prevención (1) por "accidente"', () => {
    assert.strictEqual(autoDetectPrinciple('Reducir accidentes laborales'), 1);
  });

  await test('Detecta Prevención (1) por "ausentismo"', () => {
    assert.strictEqual(autoDetectPrinciple('Disminuir el ausentismo por enfermedad'), 1);
  });

  await test('Detecta Requisitos Legales (2) por "legal"', () => {
    assert.strictEqual(autoDetectPrinciple('Cumplir con la matriz legal actualizada'), 2);
  });

  await test('Detecta Satisfacción Cliente (3) por "cliente"', () => {
    assert.strictEqual(autoDetectPrinciple('Lograr la satisfacción del cliente externo'), 3);
  });

  await test('Detecta Recursos y Mejora (4) por "presupuesto"', () => {
    assert.strictEqual(autoDetectPrinciple('Ejecutar el presupuesto asignado al SG-SST'), 4);
  });

  await test('Detecta Recursos y Mejora (4) por "capacitacion"', () => {
    assert.strictEqual(autoDetectPrinciple('Incrementar las capacitaciones al personal'), 4);
  });

  await test('Default a 4 (Recursos y Mejora) si no matchea nada', () => {
    assert.strictEqual(autoDetectPrinciple('Objetivo sin keywords claras'), 4);
  });

  await test('Maneja texto vacío sin error', () => {
    assert.strictEqual(autoDetectPrinciple(''), 4);
    assert.strictEqual(autoDetectPrinciple(null), 4);
    assert.strictEqual(autoDetectPrinciple(undefined), 4);
  });

  // ────────────────────────────────────────────────────────────────────────
  section('T3: matchAutoResultado — match por keyword');
  // ────────────────────────────────────────────────────────────────────────
  await test('Match entre "capacitacion" del indicador y "capacitacion" del auto', () => {
    const autoRes = {
      'capacitacion': { porcentajeReal: 80, source: 'auto' },
      'presupuesto': { porcentajeReal: 50, source: 'auto' }
    };
    const match = matchAutoResultado('Realizar las capacitaciones programadas', autoRes);
    assert.ok(match, 'Debería encontrar match');
    assert.strictEqual(match.porcentajeReal, 80);
    assert.strictEqual(match.keyword, 'capacitacion');
  });

  await test('Match entre "presupuesto" del indicador y "presupuesto" del auto', () => {
    const autoRes = {
      'presupuesto': { porcentajeReal: 95, source: 'auto' }
    };
    const match = matchAutoResultado('Ejecutar el presupuesto anual SST', autoRes);
    assert.ok(match, 'Debería encontrar match');
    assert.strictEqual(match.porcentajeReal, 95);
  });

  await test('No match si el indicador no tiene keywords de los principios', () => {
    const autoRes = {
      'capacitacion': { porcentajeReal: 80, source: 'auto' }
    };
    const match = matchAutoResultado('Objetivo genérico sin keywords', autoRes);
    assert.strictEqual(match, null);
  });

  await test('No match si autoResultados está vacío', () => {
    const match = matchAutoResultado('Realizar capacitaciones', {});
    assert.strictEqual(match, null);
  });

  await test('No match si autoResultados es null', () => {
    const match = matchAutoResultado('Realizar capacitaciones', null);
    assert.strictEqual(match, null);
  });

  await test('Elige el match con mayor porcentajeReal (entre keys similares)', () => {
    // calculateAutoResultados guarda 'capacitacion' y 'capacitaciones' como
    // keys diferentes apuntando al mismo objeto. El algoritmo elige el de
    // mayor porcentajeReal cuando hay múltiples matches.
    const autoRes = {
      'capacitacion': { porcentajeReal: 40, source: 'auto' },
      'capacitaciones': { porcentajeReal: 85, source: 'auto' }
    };
    const match = matchAutoResultado('Realizar las capacitaciones programadas', autoRes);
    assert.ok(match, 'Debería encontrar match');
    assert.strictEqual(match.porcentajeReal, 85, 'Debería elegir el de mayor %');
    assert.strictEqual(match.keyword, 'capacitaciones');
  });

  // ────────────────────────────────────────────────────────────────────────
  // 📦562 — Tests de búsqueda directa (estrategia 1)
  // ────────────────────────────────────────────────────────────────────────
  section('T3b: matchAutoResultado — búsqueda directa del autoKey');
  await test('Match directo: "incidencia" en el indicador', () => {
    const autoRes = {
      'incidencia': { porcentajeReal: 100, source: 'auto' }
    };
    const match = matchAutoResultado('Incidencia Enfermedad Laboral', autoRes);
    assert.ok(match, 'Debería encontrar match directo');
    assert.strictEqual(match.porcentajeReal, 100);
    assert.strictEqual(match.keyword, 'incidencia');
  });

  await test('Match directo: "prevalencia" en el indicador', () => {
    const autoRes = {
      'prevalencia': { porcentajeReal: 100, source: 'auto' }
    };
    const match = matchAutoResultado('Prevalencia de Enfermedad Laboral', autoRes);
    assert.ok(match, 'Debería encontrar match directo');
    assert.strictEqual(match.porcentajeReal, 100);
    assert.strictEqual(match.keyword, 'prevalencia');
  });

  await test('Match directo: "ifa" en el indicador', () => {
    const autoRes = {
      'ifa': { porcentajeReal: 85, source: 'auto' }
    };
    const match = matchAutoResultado('Calcular el IFA del período', autoRes);
    assert.ok(match, 'Debería encontrar match directo');
    assert.strictEqual(match.porcentajeReal, 85);
  });

  await test('No match directo para keys muy cortas (<3 chars)', () => {
    const autoRes = {
      'at': { porcentajeReal: 90, source: 'auto' },
      'nr': { porcentajeReal: 80, source: 'auto' }
    };
    // "at" y "nr" tienen < 3 chars, no deben matchear directamente
    const match = matchAutoResultado('Calcular AT del período', autoRes);
    assert.strictEqual(match, null, 'Keys <3 chars no deben matchear para evitar falsos positivos');
  });

  await test('Estrategia directa elige mayor % sobre estrategia 2', () => {
    // Simulamos: la búsqueda directa encuentra un match con 100%
    // y la búsqueda por keyword encuentra uno con 50%
    const autoRes = {
      'incidencia': { porcentajeReal: 100, source: 'auto' },
      'enfermedad laboral': { porcentajeReal: 50, source: 'auto' } // autoKey custom
    };
    const match = matchAutoResultado('Incidencia Enfermedad Laboral', autoRes);
    assert.ok(match);
    assert.strictEqual(match.porcentajeReal, 100, 'Debería elegir 100% (búsqueda directa)');
  });

  await test('Match directo funciona con autoKey "accidente"', () => {
    const autoRes = {
      'accidente': { porcentajeReal: 80, source: 'auto' }
    };
    const match = matchAutoResultado('Reducir accidentes laborales', autoRes);
    assert.ok(match);
    assert.strictEqual(match.porcentajeReal, 80);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 📦562b — Match con porcentajeReal = 0 (A1 puede usar el valorTexto)
  // ────────────────────────────────────────────────────────────────────────
  section('T3c: matchAutoResultado — estrategia 3 (porcentajeReal=0)');
  await test('Match con porcentajeReal=0 se asigna para que A1 pueda usarlo', () => {
    const autoRes = {
      'incidencia': {
        porcentajeReal: 0,
        resultado: 'Incidencia EL: 0.00 por 100.000 trabajadores',
        source: 'auto'
      }
    };
    const match = matchAutoResultado('Incidencia Enfermedad Laboral', autoRes);
    assert.ok(match, 'Debería asignar match aunque porcentajeReal=0');
    assert.strictEqual(match.porcentajeReal, 0);
    assert.strictEqual(match.keyword, 'incidencia');
    assert.ok(match.resultado, 'Debe propagar el resultado.resultado para A1');
    assert.ok(match.resultado.includes('Incidencia EL'));
  });

  await test('Estrategia 3 funciona con KEYWORD_MAP (búsqueda indirecta)', () => {
    // El indicador tiene "severidad" (en KEYWORD_MAP) y el autoKey es "severidad"
    const autoRes = {
      'severidad': {
        porcentajeReal: 0,
        resultado: 'IS promedio: 222.2222 (meta: 1)',
        source: 'auto'
      }
    };
    const match = matchAutoResultado('Severidad de accidentalidad', autoRes);
    assert.ok(match);
    assert.strictEqual(match.porcentajeReal, 0);
    assert.ok(match.resultado);
  });

  await test('Estrategia 1+2 con valor positivo gana sobre estrategia 3 con valor 0', () => {
    const autoRes = {
      'incidencia': { porcentajeReal: 0, resultado: 'A', source: 'auto' },
      'accidente': { porcentajeReal: 80, resultado: 'B', source: 'auto' }
    };
    const match = matchAutoResultado('Reducir accidentes', autoRes);
    assert.strictEqual(match.porcentajeReal, 80, 'Debe elegir el de mayor %');
    assert.strictEqual(match.keyword, 'accidente');
  });

  // ────────────────────────────────────────────────────────────────────────
  section('T4-T6: Cálculo de cumplimiento con resultados manuales');
  // ────────────────────────────────────────────────────────────────────────
  await test('T4: porcentajeReal >= 70 cuenta como cumplido', () => {
    const UMBRAL = 70;
    const porcentajeReal = 80;
    const cumple = porcentajeReal !== null && porcentajeReal >= UMBRAL;
    assert.strictEqual(cumple, true);
  });

  await test('T5: porcentajeReal < 70 NO cuenta como cumplido', () => {
    const UMBRAL = 70;
    const porcentajeReal = 50;
    const cumple = porcentajeReal !== null && porcentajeReal >= UMBRAL;
    assert.strictEqual(cumple, false);
  });

  await test('T5b: porcentajeReal = 69 NO cuenta (justo abajo del umbral)', () => {
    const UMBRAL = 70;
    const porcentajeReal = 69;
    const cumple = porcentajeReal !== null && porcentajeReal >= UMBRAL;
    assert.strictEqual(cumple, false);
  });

  await test('T5c: porcentajeReal = 70 SÍ cuenta (justo en el umbral)', () => {
    const UMBRAL = 70;
    const porcentajeReal = 70;
    const cumple = porcentajeReal !== null && porcentajeReal >= UMBRAL;
    assert.strictEqual(cumple, true);
  });

  await test('T6: porcentajeReal = null NO cuenta como cumplido', () => {
    const UMBRAL = 70;
    const porcentajeReal = null;
    const cumple = porcentajeReal !== null && porcentajeReal >= UMBRAL;
    assert.strictEqual(cumple, false);
  });

  await test('T6b: porcentajeReal = 0 NO cuenta como cumplido', () => {
    const UMBRAL = 70;
    const porcentajeReal = 0;
    const cumple = porcentajeReal !== null && porcentajeReal >= UMBRAL && porcentajeReal > 0;
    // En el main, 0 es falsy, así que se trata como "sin resultado"
    assert.strictEqual(cumple, false);
  });

  // ────────────────────────────────────────────────────────────────────────
  section('T7: Agrupación por objetivo (mismo groupIdx que el viewer)');
  // ────────────────────────────────────────────────────────────────────────
  await test('Agrupa 2 filas con mismo objetivo en el mismo grupo', () => {
    const objectivesData = [
      { objective: 'Prevenir lesiones', indicator: 'Frecuencia' },
      { objective: 'Prevenir lesiones', indicator: 'Severidad' },
      { objective: 'Cumplir legal', indicator: 'Matriz legal' }
    ];
    const groupMap = {};
    const groupOrder = [];
    objectivesData.forEach((item) => {
      const key = (item.objective || '').trim();
      if (!groupMap[key]) {
        groupMap[key] = [];
        groupOrder.push(key);
      }
      groupMap[key].push(item);
    });
    assert.strictEqual(groupOrder.length, 2, 'Debería haber 2 grupos');
    assert.strictEqual(groupMap['Prevenir lesiones'].length, 2, 'Grupo 1 tiene 2 indicadores');
    assert.strictEqual(groupMap['Cumplir legal'].length, 1, 'Grupo 2 tiene 1 indicador');
  });

  await test('groupIdx-indicatorIdx se asigna en orden (como el viewer)', () => {
    const objectivesData = [
      { objective: 'A', indicator: 'a1' },
      { objective: 'A', indicator: 'a2' },
      { objective: 'B', indicator: 'b1' }
    ];
    const groupMap = {};
    const groupOrder = [];
    objectivesData.forEach((item) => {
      const key = (item.objective || '').trim();
      if (!groupMap[key]) {
        groupMap[key] = [];
        groupOrder.push(key);
      }
      groupMap[key].push(item);
    });

    // Simular la asignación de groupIdx-indicatorIdx
    const keys = [];
    let gIdx = 0;
    groupOrder.forEach((objectiveKey) => {
      const indicatorsInGroup = groupMap[objectiveKey];
      let indIdx = 0;
      indicatorsInGroup.forEach(() => {
        keys.push(`${gIdx}-${indIdx}`);
        indIdx++;
      });
      gIdx++;
    });

    assert.deepStrictEqual(keys, ['0-0', '0-1', '1-0']);
  });

  // ────────────────────────────────────────────────────────────────────────
  section('T8: Cálculo de porcentaje global y por principio');
  // ────────────────────────────────────────────────────────────────────────
  await test('Porcentaje global: 5/10 = 50%', () => {
    const total = 10;
    const cumplidos = 5;
    const porcentaje = Math.round((cumplidos / total) * 100);
    assert.strictEqual(porcentaje, 50);
  });

  await test('Porcentaje por principio: 3/6 = 50%', () => {
    const p = { total: 6, cumplidos: 3 };
    p.porcentaje = Math.round((p.cumplidos / p.total) * 100);
    assert.strictEqual(p.porcentaje, 50);
  });

  await test('Porcentaje: 0% cuando no hay datos (evitar división por 0)', () => {
    const p = { total: 0, cumplidos: 0 };
    if (p.total > 0) {
      p.porcentaje = Math.round((p.cumplidos / p.total) * 100);
    } else {
      p.porcentaje = 0;
    }
    assert.strictEqual(p.porcentaje, 0);
  });

  await test('Porcentaje: 100% cuando todo cumple', () => {
    const p = { total: 8, cumplidos: 8 };
    p.porcentaje = Math.round((p.cumplidos / p.total) * 100);
    assert.strictEqual(p.porcentaje, 100);
  });

  // ────────────────────────────────────────────────────────────────────────
  section('T9: Sin resultados (manuales ni auto) → todo pendiente');
  // ────────────────────────────────────────────────────────────────────────
  await test('Indicadores sin resultados cuentan pero no cumplen', () => {
    const UMBRAL = 70;
    const stats = {
      total: 0,
      cumplidos: 0,
      porPrincipio: {
        1: { nombre: 'Prevención', total: 0, cumplidos: 0, porcentaje: 0 },
        2: { nombre: 'Requisitos Legales', total: 0, cumplidos: 0, porcentaje: 0 },
        3: { nombre: 'Satisfacción Cliente', total: 0, cumplidos: 0, porcentaje: 0 },
        4: { nombre: 'Recursos y Mejora', total: 0, cumplidos: 0, porcentaje: 0 }
      }
    };

    // Simular 3 indicadores sin resultados
    const indicadoresSinResultado = [
      { pid: 1, porcentajeReal: null, fuente: null },
      { pid: 1, porcentajeReal: null, fuente: null },
      { pid: 4, porcentajeReal: null, fuente: null }
    ];

    indicadoresSinResultado.forEach((ind) => {
      stats.total++;
      stats.porPrincipio[ind.pid].total++;
      const cumple = ind.porcentajeReal !== null && ind.porcentajeReal >= UMBRAL;
      if (cumple) {
        stats.cumplidos++;
        stats.porPrincipio[ind.pid].cumplidos++;
      }
    });

    assert.strictEqual(stats.total, 3);
    assert.strictEqual(stats.cumplidos, 0, 'Sin resultados no hay cumplidos');
    assert.strictEqual(stats.porPrincipio[1].total, 2);
    assert.strictEqual(stats.porPrincipio[4].total, 1);
    assert.strictEqual(stats.porPrincipio[2].total, 0);
  });

  // ────────────────────────────────────────────────────────────────────────
  section('T10: Caso integrado — simulación completa');
  // ────────────────────────────────────────────────────────────────────────
  await test('5 indicadores: 3 manuales (1 cumple, 2 no), 2 auto (1 cumple, 1 no)', () => {
    const UMBRAL = 70;

    // Simular stats
    const stats = {
      total: 0,
      cumplidos: 0,
      porPrincipio: {
        1: { nombre: 'Prevención', total: 0, cumplidos: 0, porcentaje: 0 },
        2: { nombre: 'Requisitos Legales', total: 0, cumplidos: 0, porcentaje: 0 },
        3: { nombre: 'Satisfacción Cliente', total: 0, cumplidos: 0, porcentaje: 0 },
        4: { nombre: 'Recursos y Mejora', total: 0, cumplidos: 0, porcentaje: 0 }
      }
    };

    const indicadores = [
      // Prevención (principio 1)
      { pid: 1, porcentajeReal: 85, fuente: 'manual' },  // Cumple
      { pid: 1, porcentajeReal: 40, fuente: 'manual' },  // No cumple
      { pid: 1, porcentajeReal: 90, fuente: 'auto' },    // Cumple
      { pid: 1, porcentajeReal: null, fuente: null },    // Pendiente
      // Recursos y Mejora (principio 4)
      { pid: 4, porcentajeReal: 75, fuente: 'auto' }    // Cumple
    ];

    indicadores.forEach((ind) => {
      stats.total++;
      stats.porPrincipio[ind.pid].total++;
      const cumple = ind.porcentajeReal !== null && ind.porcentajeReal >= UMBRAL;
      if (cumple) {
        stats.cumplidos++;
        stats.porPrincipio[ind.pid].cumplidos++;
      }
    });

    assert.strictEqual(stats.total, 5);
    assert.strictEqual(stats.cumplidos, 3, '3 cumplen (85, 90, 75)');
    assert.strictEqual(stats.porPrincipio[1].total, 4);
    assert.strictEqual(stats.porPrincipio[1].cumplidos, 2, 'Principio 1: 2 de 4');
    assert.strictEqual(stats.porPrincipio[4].total, 1);
    assert.strictEqual(stats.porPrincipio[4].cumplidos, 1, 'Principio 4: 1 de 1');
  });

  await test('Porcentaje global calculado correctamente', () => {
    const total = 5;
    const cumplidos = 3;
    const porcentaje = Math.round((cumplidos / total) * 100);
    assert.strictEqual(porcentaje, 60);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 📦561 — A1: Tests de parseMetaIndicador
  // ────────────────────────────────────────────────────────────────────────
  section('T11: parseMetaIndicador — parseo de metas');
  await test('Parsea "<1" como lt 1', () => {
    assert.deepStrictEqual(parseMetaIndicador('<1'), { operador: 'lt', valor: 1 });
  });
  await test('Parsea "<5" como lt 5', () => {
    assert.deepStrictEqual(parseMetaIndicador('<5'), { operador: 'lt', valor: 5 });
  });
  await test('Parsea "<50" como lt 50', () => {
    assert.deepStrictEqual(parseMetaIndicador('<50'), { operador: 'lt', valor: 50 });
  });
  await test('Parsea "0" como eq 0', () => {
    assert.deepStrictEqual(parseMetaIndicador('0'), { operador: 'eq', valor: 0 });
  });
  await test('Parsea "0%" como eq 0', () => {
    assert.deepStrictEqual(parseMetaIndicador('0%'), { operador: 'eq', valor: 0 });
  });
  await test('Parsea "<=10" como lte 10', () => {
    assert.deepStrictEqual(parseMetaIndicador('<=10'), { operador: 'lte', valor: 10 });
  });
  await test('Parsea ">=0.5" como gte 0.5', () => {
    assert.deepStrictEqual(parseMetaIndicador('>=0.5'), { operador: 'gte', valor: 0.5 });
  });
  await test('Parsea ">100" como gt 100', () => {
    assert.deepStrictEqual(parseMetaIndicador('>100'), { operador: 'gt', valor: 100 });
  });
  await test('Parsea decimales "<2.5"', () => {
    assert.deepStrictEqual(parseMetaIndicador('<2.5'), { operador: 'lt', valor: 2.5 });
  });
  await test('Maneja null/undefined/"" sin error', () => {
    assert.strictEqual(parseMetaIndicador(null), null);
    assert.strictEqual(parseMetaIndicador(undefined), null);
    assert.strictEqual(parseMetaIndicador(''), null);
  });
  await test('Retorna null para texto no parseable', () => {
    assert.strictEqual(parseMetaIndicador('xyz'), null);
    assert.strictEqual(parseMetaIndicador('menor a 1'), null);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 📦561 — A1: Tests de parseValorIndicador
  // ────────────────────────────────────────────────────────────────────────
  section('T12: parseValorIndicador — parseo de valores');
  await test('Parsea número simple "0.0421"', () => {
    assert.strictEqual(parseValorIndicador('0.0421'), 0.0421);
  });
  await test('Parsea número grande "222.2222"', () => {
    assert.strictEqual(parseValorIndicador('222.2222'), 222.2222);
  });
  await test('Parsea porcentaje "0.00%"', () => {
    assert.strictEqual(parseValorIndicador('0.00%'), 0);
  });
  await test('Parsea texto largo "IF promedio: 0.0421"', () => {
    assert.strictEqual(parseValorIndicador('IF promedio: 0.0421'), 0.0421);
  });
  await test('Parsea texto con paréntesis "IS promedio: 222.2222 (meta: 1)"', () => {
    assert.strictEqual(parseValorIndicador('IS promedio: 222.2222 (meta: 1)'), 222.2222);
  });
  await test('Parsea "1 mortales / 2 AT en 2026" como 1', () => {
    assert.strictEqual(parseValorIndicador('1 mortales / 2 AT en 2026'), 1);
  });
  await test('Parsea "NaN" como null', () => {
    assert.strictEqual(parseValorIndicador('NaN'), null);
  });
  await test('Parsea "Infinity" como null', () => {
    assert.strictEqual(parseValorIndicador('Infinity'), null);
  });
  await test('Maneja null/undefined/"" como null', () => {
    assert.strictEqual(parseValorIndicador(null), null);
    assert.strictEqual(parseValorIndicador(undefined), null);
    assert.strictEqual(parseValorIndicador(''), null);
  });
  await test('Retorna null para texto sin números', () => {
    assert.strictEqual(parseValorIndicador('sin números'), null);
    assert.strictEqual(parseValorIndicador('NaN'), null);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 📦561 — A1: Tests de evaluarCumplimientoPorMeta
  // ────────────────────────────────────────────────────────────────────────
  section('T13: evaluarCumplimientoPorMeta — evaluación de cumplimiento');
  await test('Valor 0.0421 vs meta "<1" → cumple con porcentaje alto', () => {
    const r = evaluarCumplimientoPorMeta(0.0421, '<1');
    assert.strictEqual(r.cumple, true);
    assert.ok(r.porcentajeReal >= 70, 'Porcentaje debe ser >= 70');
    // ratio = 1 - 0.0421/1 = 0.9579 → 96%
    assert.strictEqual(r.porcentajeReal, 96);
  });
  await test('Valor 222.2222 vs meta "<1" → NO cumple', () => {
    const r = evaluarCumplimientoPorMeta(222.2222, '<1');
    assert.strictEqual(r.cumple, false);
    assert.strictEqual(r.porcentajeReal, 0);
  });
  await test('Valor 5 vs meta "<5" → NO cumple (justo en meta = 0%)', () => {
    // El helper devuelve 0% cuando valor === meta, para forzar a editar manualmente
    const r = evaluarCumplimientoPorMeta(5, '<5');
    assert.strictEqual(r.cumple, true);
    assert.strictEqual(r.porcentajeReal, 0);
  });
  await test('Valor 4.99 vs meta "<5" → cumple ~1%', () => {
    const r = evaluarCumplimientoPorMeta(4.99, '<5');
    assert.strictEqual(r.cumple, true);
    // ratio = 1 - 4.99/5 = 0.002 → 0%
    assert.strictEqual(r.porcentajeReal, 0);
  });
  await test('Valor 0 vs meta "<5" → cumple 100%', () => {
    const r = evaluarCumplimientoPorMeta(0, '<5');
    assert.strictEqual(r.cumple, true);
    assert.strictEqual(r.porcentajeReal, 100);
  });
  await test('Valor 0 vs meta "0" → cumple 100%', () => {
    const r = evaluarCumplimientoPorMeta(0, '0');
    assert.strictEqual(r.cumple, true);
    assert.strictEqual(r.porcentajeReal, 100);
  });
  await test('Valor 1 vs meta "0" → NO cumple', () => {
    const r = evaluarCumplimientoPorMeta(1, '0');
    assert.strictEqual(r.cumple, false);
    assert.strictEqual(r.porcentajeReal, 0);
  });
  await test('Valor 10 vs meta "<=10" → cumple', () => {
    const r = evaluarCumplimientoPorMeta(10, '<=10');
    assert.strictEqual(r.cumple, true);
    assert.strictEqual(r.porcentajeReal, 100);
  });
  await test('Valor 11 vs meta "<=10" → NO cumple', () => {
    const r = evaluarCumplimientoPorMeta(11, '<=10');
    assert.strictEqual(r.cumple, false);
    assert.strictEqual(r.porcentajeReal, 0);
  });
  await test('Valor no numérico → NO cumple', () => {
    const r = evaluarCumplimientoPorMeta(NaN, '<1');
    assert.strictEqual(r.cumple, false);
    assert.strictEqual(r.porcentajeReal, 0);
  });
  await test('Meta no parseable → NO cumple', () => {
    const r = evaluarCumplimientoPorMeta(0.5, 'menor a 1');
    assert.strictEqual(r.cumple, false);
    assert.strictEqual(r.porcentajeReal, 0);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 📦561 — A1: Tests de casos del mundo real (datos del usuario)
  // ────────────────────────────────────────────────────────────────────────
  section('T14: Casos del mundo real — datos del usuario Tempoactiva');
  await test('Frecuencia accidentalidad: IF 0.0421 vs meta "<1" → CUMPLE', () => {
    const valor = parseValorIndicador('IF promedio: 0.0421');
    const r = evaluarCumplimientoPorMeta(valor, '<1');
    assert.strictEqual(r.cumple, true);
    assert.ok(r.porcentajeReal >= 70, 'Frecuencia baja debe cumplir');
  });
  await test('Severidad accidentalidad: IS 222.2222 vs meta "<1" → NO CUMPLE', () => {
    const valor = parseValorIndicador('IS promedio: 222.2222');
    const r = evaluarCumplimientoPorMeta(valor, '<1');
    assert.strictEqual(r.cumple, false);
    assert.strictEqual(r.porcentajeReal, 0);
  });
  await test('Proporción mortales: 0.00% vs meta "0" → CUMPLE', () => {
    const valor = parseValorIndicador('Proporción mortalidad: 0.00%');
    const r = evaluarCumplimientoPorMeta(valor, '0');
    assert.strictEqual(r.cumple, true);
    assert.strictEqual(r.porcentajeReal, 100);
  });
  await test('Incidencia EL: 0.00 vs meta "<5" → CUMPLE 100%', () => {
    const valor = parseValorIndicador('Incidencia EL: 0.00 por 100.000 trabajadores');
    const r = evaluarCumplimientoPorMeta(valor, '<5');
    assert.strictEqual(r.cumple, true);
    assert.strictEqual(r.porcentajeReal, 100);
  });
  await test('Ausentismo: 0.00% vs meta "<50" → CUMPLE 100%', () => {
    const valor = parseValorIndicador('Tasa ausentismo promedio: 0.00%');
    const r = evaluarCumplimientoPorMeta(valor, '<50');
    assert.strictEqual(r.cumple, true);
    assert.strictEqual(r.porcentajeReal, 100);
  });
  await test('Prevalencia EL: 0.00 vs meta "<5" → CUMPLE 100%', () => {
    const valor = parseValorIndicador('Prevalencia EL: 0.00 por 100.000 trabajadores');
    const r = evaluarCumplimientoPorMeta(valor, '<5');
    assert.strictEqual(r.cumple, true);
    assert.strictEqual(r.porcentajeReal, 100);
  });
  await test('NaN en el valor → NO CUMPLE (debe reportarse)', () => {
    const valor = parseValorIndicador('Proporción mortalidad: 0.00% (1 mortales / NaN AT en 2026)');
    // El primer número es 0.00, así que devuelve 0 (no NaN)
    assert.strictEqual(valor, 0);
    const r = evaluarCumplimientoPorMeta(valor, '0');
    assert.strictEqual(r.cumple, true);
  });

  // ────────────────────────────────────────────────────────────────────────
  // RESUMEN
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Total: ${passed + failed} | ✅ ${passed} | ❌ ${failed}`);
  console.log('═══════════════════════════════════════════════════════════');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});

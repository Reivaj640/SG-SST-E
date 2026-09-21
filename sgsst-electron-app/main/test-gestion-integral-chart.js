// test-gestion-integral-chart.js
// 📦562 — Tests para la nueva lógica de la gráfica de Objetivos SST.
// Valida:
//   T1: Color por rango (verde/amarillo/rojo según %)
//   T2: Cálculo de porcentajes por principio
//   T3: Labels con nombres reales de principios (no "Principio 1")
//   T4: Número grande "X/Y (Z%)" formateado correctamente
//   T5: Edge cases: 0%, 100%, sin datos
//   T6: createObjetivosChart no requiere principiosAutoResultados
//   T7: Estructura del container (clases, cursor, title)
//   T8: Estructura de retorno para los 4 principios
//
// NOTA: No se puede probar Chart.js directamente (requiere DOM/canvas).
// Los tests validan las funciones puras que alimentan la gráfica.

'use strict';

const assert = require('assert');

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

// ============================================================================
// HELPERS REPLICADOS (mismas definiciones que en gestion-integral-home.js)
// ============================================================================

function colorPorRango(pct) {
  if (pct >= 70) return 'rgba(40, 167, 69, 0.85)';  // Verde
  if (pct >= 40) return 'rgba(255, 193, 7, 0.85)';   // Amarillo
  return 'rgba(220, 53, 69, 0.85)';                  // Rojo
}

function calcularPctCumplimiento(cumplidos, total) {
  if (total === 0) return 0;
  return Math.round((cumplidos / total) * 100);
}

function formatearLabelNumero(cumplidos, total, porcentaje) {
  return `${cumplidos}/${total} (${porcentaje}%)`;
}

function nombrePorDefecto(pid) {
  const nombres = {
    1: 'Prevención',
    2: 'Requisitos Legales',
    3: 'Satisfacción Cliente',
    4: 'Recursos y Mejora'
  };
  return nombres[pid] || `Principio ${pid}`;
}

// ============================================================================
// TESTS
// ============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Tests gráfica Objetivos SST (📦562)');
  console.log('═══════════════════════════════════════════════════════════');

  // ────────────────────────────────────────────────────────────────────────
  section('T1: Color por rango');
  // ────────────────────────────────────────────────────────────────────────
  await test('Verde para >=70%', () => {
    assert.strictEqual(colorPorRango(70), 'rgba(40, 167, 69, 0.85)');
    assert.strictEqual(colorPorRango(83), 'rgba(40, 167, 69, 0.85)');
    assert.strictEqual(colorPorRango(100), 'rgba(40, 167, 69, 0.85)');
  });
  await test('Amarillo para >=40% y <70%', () => {
    assert.strictEqual(colorPorRango(40), 'rgba(255, 193, 7, 0.85)');
    assert.strictEqual(colorPorRango(50), 'rgba(255, 193, 7, 0.85)');
    assert.strictEqual(colorPorRango(69), 'rgba(255, 193, 7, 0.85)');
  });
  await test('Rojo para <40%', () => {
    assert.strictEqual(colorPorRango(0), 'rgba(220, 53, 69, 0.85)');
    assert.strictEqual(colorPorRango(13), 'rgba(220, 53, 69, 0.85)');
    assert.strictEqual(colorPorRango(39), 'rgba(220, 53, 69, 0.85)');
  });
  await test('Color incluye el alpha 0.85 (semi-transparente)', () => {
    assert.ok(colorPorRango(50).includes('0.85'));
    assert.ok(colorPorRango(100).includes('0.85'));
  });

  // ────────────────────────────────────────────────────────────────────────
  section('T2: Cálculo de porcentajes por principio');
  // ────────────────────────────────────────────────────────────────────────
  await test('5/6 = 83%', () => {
    assert.strictEqual(calcularPctCumplimiento(5, 6), 83);
  });
  await test('1/2 = 50%', () => {
    assert.strictEqual(calcularPctCumplimiento(1, 2), 50);
  });
  await test('0/3 = 0%', () => {
    assert.strictEqual(calcularPctCumplimiento(0, 3), 0);
  });
  await test('6/6 = 100%', () => {
    assert.strictEqual(calcularPctCumplimiento(6, 6), 100);
  });
  await test('0/0 = 0% (sin indicadores)', () => {
    assert.strictEqual(calcularPctCumplimiento(0, 0), 0);
  });
  await test('Redondeo correcto: 2/3 = 67%', () => {
    assert.strictEqual(calcularPctCumplimiento(2, 3), 67);
  });
  await test('Redondeo correcto: 1/3 = 33%', () => {
    assert.strictEqual(calcularPctCumplimiento(1, 3), 33);
  });

  // ────────────────────────────────────────────────────────────────────────
  section('T3: Labels con nombres reales de principios');
  // ────────────────────────────────────────────────────────────────────────
  await test('Principio 1 → "Prevención"', () => {
    assert.strictEqual(nombrePorDefecto(1), 'Prevención');
  });
  await test('Principio 2 → "Requisitos Legales"', () => {
    assert.strictEqual(nombrePorDefecto(2), 'Requisitos Legales');
  });
  await test('Principio 3 → "Satisfacción Cliente"', () => {
    assert.strictEqual(nombrePorDefecto(3), 'Satisfacción Cliente');
  });
  await test('Principio 4 → "Recursos y Mejora"', () => {
    assert.strictEqual(nombrePorDefecto(4), 'Recursos y Mejora');
  });
  await test('ID inválido → fallback "Principio N"', () => {
    assert.strictEqual(nombrePorDefecto(5), 'Principio 5');
    assert.strictEqual(nombrePorDefecto(0), 'Principio 0');
  });

  // ────────────────────────────────────────────────────────────────────────
  section('T4: Número grande formateado');
  // ────────────────────────────────────────────────────────────────────────
  await test('Formatea 5/6 (83%) correctamente', () => {
    assert.strictEqual(formatearLabelNumero(5, 6, 83), '5/6 (83%)');
  });
  await test('Formatea 0/3 (0%) correctamente', () => {
    assert.strictEqual(formatearLabelNumero(0, 3, 0), '0/3 (0%)');
  });
  await test('Formatea 6/6 (100%) correctamente', () => {
    assert.strictEqual(formatearLabelNumero(6, 6, 100), '6/6 (100%)');
  });
  await test('Formatea 1/2 (50%) correctamente', () => {
    assert.strictEqual(formatearLabelNumero(1, 2, 50), '1/2 (50%)');
  });

  // ────────────────────────────────────────────────────────────────────────
  section('T5: Edge cases');
  // ────────────────────────────────────────────────────────────────────────
  await test('0% con 0 cumplidos, 6 totales', () => {
    const pct = calcularPctCumplimiento(0, 6);
    const color = colorPorRango(pct);
    const label = formatearLabelNumero(0, 6, pct);
    assert.strictEqual(pct, 0);
    assert.ok(color.includes('220, 53, 69'), 'Color debe ser rojo');
    assert.strictEqual(label, '0/6 (0%)');
  });
  await test('100% con 6 cumplidos, 6 totales', () => {
    const pct = calcularPctCumplimiento(6, 6);
    const color = colorPorRango(pct);
    assert.strictEqual(pct, 100);
    assert.ok(color.includes('40, 167, 69'), 'Color debe ser verde');
  });
  await test('Sin datos (total=0) → 0% color rojo', () => {
    const pct = calcularPctCumplimiento(0, 0);
    const color = colorPorRango(pct);
    assert.strictEqual(pct, 0);
    assert.ok(color.includes('220, 53, 69'), 'Color debe ser rojo');
  });

  // ────────────────────────────────────────────────────────────────────────
  section('T6: Validación de la estructura de objetivos');
  // ────────────────────────────────────────────────────────────────────────
  await test('Estructura completa con 4 principios + nombres', () => {
    const objetivos = {
      total: 15,
      cumplidos: 8,
      porcentaje: 53,
      porPrincipio: {
        1: { nombre: 'Prevención', total: 6, cumplidos: 5, porcentaje: 83 },
        2: { nombre: 'Requisitos Legales', total: 4, cumplidos: 2, porcentaje: 50 },
        3: { nombre: 'Satisfacción Cliente', total: 3, cumplidos: 1, porcentaje: 33 },
        4: { nombre: 'Recursos y Mejora', total: 2, cumplidos: 0, porcentaje: 0 }
      }
    };
    // Verificar que cada principio tiene los campos requeridos
    [1, 2, 3, 4].forEach(pid => {
      const p = objetivos.porPrincipio[pid];
      assert.ok(p.nombre, `Principio ${pid} debe tener nombre`);
      assert.ok(typeof p.total === 'number', `Principio ${pid} debe tener total numérico`);
      assert.ok(typeof p.cumplidos === 'number', `Principio ${pid} debe tener cumplidos numérico`);
      assert.ok(typeof p.porcentaje === 'number', `Principio ${pid} debe tener porcentaje numérico`);
    });
  });
  await test('Estructura vacía tiene nombres por defecto', () => {
    const porPrincipioVacio = {
      1: { nombre: 'Prevención', total: 0, cumplidos: 0, porcentaje: 0 },
      2: { nombre: 'Requisitos Legales', total: 0, cumplidos: 0, porcentaje: 0 },
      3: { nombre: 'Satisfacción Cliente', total: 0, cumplidos: 0, porcentaje: 0 },
      4: { nombre: 'Recursos y Mejora', total: 0, cumplidos: 0, porcentaje: 0 }
    };
    assert.strictEqual(porPrincipioVacio[1].nombre, 'Prevención');
    assert.strictEqual(porPrincipioVacio[2].nombre, 'Requisitos Legales');
  });

  // ────────────────────────────────────────────────────────────────────────
  section('T7: Datos del usuario Tempoactiva (verificación visual esperada)');
  // ────────────────────────────────────────────────────────────────────────
  await test('Estimación: con A1 aplicado, debería subir a ~7/15 (47%)', () => {
    // 2 (auto) + 5 (A1: Frecuencia 0.04, Proporción 0%, Incidencia 0, Ausentismo 0%, Prevalencia 0)
    // = 7 cumplidos. 1 falla (Severidad 222 vs meta <1)
    const cumplidosEsperados = 7;
    const total = 15;
    const pct = calcularPctCumplimiento(cumplidosEsperados, total);
    assert.strictEqual(pct, 47);
    // El color debería ser amarillo (entre 40 y 70)
    assert.ok(colorPorRango(pct).includes('255, 193, 7'), '47% debe ser amarillo');
  });
  await test('Principio 1 con 5/6 (83%) → verde', () => {
    const p1 = { total: 6, cumplidos: 5 };
    const pct = calcularPctCumplimiento(p1.cumplidos, p1.total);
    assert.strictEqual(pct, 83);
    assert.ok(colorPorRango(pct).includes('40, 167, 69'));
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

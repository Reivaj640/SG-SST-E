#!/usr/bin/env node
/**
 * scripts/inventario-empresas-no-habilitadas.js
 *
 * INVENTARIO DE SOLO LECTURA: qué Empresas no pueden pedir firmas porque les
 * falta el Anexo de Encargo firmado o el plazo de conservación declarado.
 *
 * POR QUÉ EXISTE
 * --------------
 * D-03: desde que existe, la creación de una solicitud de firma de una
 * Empresa **registrada** sin Anexo de Encargo firmado o sin plazo declarado
 * se bloquea con un 409. Ese bloqueo es correcto (el 1.4 y el 8.6 del
 * Acuerdo), pero activarlo de golpe en producción dejaría a esos clientes
 * sin poder firmar.
 *
 * Por eso, ANTES de encender el bloqueo, hay que saber:
 *
 *   1. Qué empresas están en ese estado (este script).
 *   2. Cuántas firmas tiene cada una (para saber el tamaño del problema).
 *   3. Avisar a esas Empresas (eso no lo hace un script).
 *
 * El script NO escribe nada. Ni una fila, ni una bandera.
 *
 * Uso:
 *   node scripts/inventario-empresas-no-habilitadas.js
 *   node scripts/inventario-empresas-no-habilitadas.js --json
 *   node scripts/inventario-empresas-no-habilitadas.js --todas
 *
 * Exit codes:
 *   0 = inventario hecho (haya o no empresas afectadas)
 *   1 = error de ejecución
 */
'use strict';

const db = require('../src/db/connection');
const empresaService = require('../src/services/empresa');

const args = process.argv.slice(2);
const comoJson = args.includes('--json');
const todas = args.includes('--todas');

function main() {
  const empresas = empresaService.list();
  const filas = [];

  for (const e of empresas) {
    const h = empresaService.verificarHabilitacionFirma(e.id_empresa);
    let firmas = null;
    try {
      firmas = db.prepare(
        'SELECT COUNT(*) AS n FROM gh_firmas_electronicas WHERE id_empresa = ?'
      ).get(e.id_empresa).n;
    } catch (err) {
      firmas = null;
    }
    filas.push({
      id_empresa: e.id_empresa,
      razon_social: e.razon_social,
      activo: e.activo,
      tiene_anexo: Boolean(e.anexo_encargo_firmado_at),
      tiene_plazo: Boolean(e.plazo_retencion_dias),
      plazo_retencion_dias: e.plazo_retencion_dias || null,
      habilitada: h.ok,
      pendientes: h.pendientes,
      firmas_registradas: firmas,
    });
  }

  const afectadas = filas.filter((f) => !f.habilitada);
  const conFirmas = afectadas.filter((f) => (f.firmas_registradas || 0) > 0);

  if (comoJson) {
    console.log(JSON.stringify({
      total_empresas: filas.length,
      total_no_habilitadas: afectadas.length,
      total_no_habilitadas_con_firmas: conFirmas.length,
      empresas: todas ? filas : afectadas,
    }, null, 2));
    return;
  }

  console.log('=== Inventario de habilitación de Empresas (solo lectura) ===');
  console.log('  empresas registradas :', filas.length);
  console.log('  NO habilitadas       :', afectadas.length);
  console.log('  ...de esas, con firmas ya registradas:',
    conFirmas.length);
  console.log('');

  if (afectadas.length === 0) {
    console.log('  Todas las empresas registradas están habilitadas.');
    return;
  }

  console.log('  id_empresa        | firmas | falta');
  console.log('  ------------------+--------+-------------------------------');
  for (const f of afectadas) {
    console.log('  ' + String(f.id_empresa).padEnd(17)
      + ' | ' + String(f.firmas_registradas == null ? '?' : f.firmas_registradas).padStart(6)
      + ' | ' + f.pendientes.join(' + '));
  }
  console.log('');
  console.log('  Para habilitar una empresa:');
  console.log('    POST /internal/admin/empresas/{id}/anexo-firmado  {"fecha":"YYYY-MM-DD"}');
  console.log('    PUT  /internal/admin/empresas/{id}  {...,"canal_pqrs":"correo@empresa"}');
  console.log('');
  console.log('  El bloqueo ya esta ENCENDIDO y es incondicional (📦933): no hay');
  console.log('  bandera que lo apague. La unica salida es la excepcion auditable:');
  console.log('    POST /internal/admin/excepciones-habilitacion');
  console.log('  (exige autorizacion escrita, alcance de firmas, ruta en papel');
  console.log('   operativa y un plazo cierto de maximo 30 dias).');
  console.log('  Antes de una excepcion: avisar a estas empresas y dejarlas habilitarse.');
}

try {
  main();
} catch (e) {
  console.error('ERROR:', e && e.message ? e.message : e);
  process.exit(1);
}

#!/usr/bin/env node
/**
 * scripts/inventario-buzon-corporativo.js
 *
 * INVENTARIO DE SOLO LECTURA (D-2).
 *
 * EL NÚMERO QUE FALTA
 * -------------------
 * El 2.2.2.47.4 num. 1 dice que "los datos de creación de la firma, en el
 * contexto en que son utilizados, corresponden exclusivamente al firmante". El
 * OTP ES un dato de creación. Hoy el OTP va a `correo_verificacion`, que la
 * app de escritorio precarga con el correo del trabajador en el registro de la
 * Empresa: en la práctica, el código le llega a un buzón que la Empresa puede
 * leer.
 *
 * Para ENCENDER el rechazo (D2) hace falta saber cuántos casos hay. Sin ese
 * número, activar el rechazo es un salto al vacío: se rompe el flujo de
 * clientes que hoy funcionan.
 *
 * LO QUE CUENTA
 * --------------
 * Por cada solicitud de firma:
 *
 *   - Si el OTP habría ido a un buzón corporativo (el contacto registrado).
 *   - Si el Trabajador declaró un medio personal (`correo_otp`) y ese medio
 *     también es corporativo.
 *
 * "Corporativo" = el dominio está en la lista EXPRESA de la empresa
 * (`dominios_corporativos`) o se deduce de los correos que la empresa ya
 * registró (canales de PQRS y de incidentes, responsable de tratamiento,
 * canal para pedir copia). Ver `empresaService.dominiosCorporativos`.
 *
 * EL RESULTADO NO ES UNA DECISIÓN: es el insumo para activarlo con el
 * inventario, el aviso a las empresas y la 9A (la firma en papel) lista.
 *
 * Uso:
 *   node scripts/inventario-buzon-corporativo.js
 *   node scripts/inventario-buzon-corporativo.js --json
 *   node scripts/inventario-buzon-corporativo.js --id-empresa=900123456
 *
 * Exit codes:
 *   0 = inventario hecho (haya o no casos de riesgo)
 *   1 = error de ejecución
 */
'use strict';

const db = require('../src/db/connection');
const empresaService = require('../src/services/empresa');

const args = process.argv.slice(2);
const comoJson = args.includes('--json');
const filtroEmpresa = (args.find((a) => a.startsWith('--id-empresa=')) || '').split('=')[1] || null;

function dominioDe(correo) {
  if (typeof correo !== 'string') return null;
  const s = correo.trim().toLowerCase();
  if (!s.includes('@')) return null;
  const d = s.split('@').pop();
  return d && d.includes('.') ? d : null;
}

function main() {
  const where = filtroEmpresa ? 'WHERE id_empresa = ?' : '';
  const params = filtroEmpresa ? [filtroEmpresa] : [];

  const filas = db.prepare(`
    SELECT id, id_solicitud, id_empresa, estado, correo_verificacion,
           correo_otp, fecha_creacion
    FROM gh_firmas_electronicas
    ${where}
    ORDER BY id ASC
  `).all(...params);

  const casos = [];
  for (const f of filas) {
    // El dominio declarado en la ficha de la empresa (si existe).
    let corporativoContacto = false;
    let corporativoDeclarado = false;
    try {
      corporativoContacto = empresaService.esDominioCorporativo(
        f.correo_verificacion, f.id_empresa
      );
      if (f.correo_otp) {
        corporativoDeclarado = empresaService.esDominioCorporativo(
          f.correo_otp, f.id_empresa
        );
      }
    } catch (e) {
      // Sin la ficha de la empresa no se puede deducir: se cuenta como
      // "corporativo" para que el operador lo revise a mano.
      corporativoContacto = true;
    }

    // El caso de riesgo es el que NO tiene medio personal declarado, o lo
    // tiene corporativo.
    if (corporativoContacto || corporativoDeclarado) {
      casos.push({
        id: f.id,
        id_solicitud: f.id_solicitud,
        id_empresa: f.id_empresa,
        estado: f.estado,
        fecha_creacion: f.fecha_creacion,
        contacto_registrado: f.correo_verificacion,
        contacto_es_corporativo: corporativoContacto,
        medio_personal_declarado: f.correo_otp || null,
        medio_personal_es_corporativo: corporativoDeclarado,
        donde_llegaria_el_codigo: f.correo_otp || f.correo_verificacion,
      });
    }
  }

  const porEmpresa = {};
  for (const c of casos) {
    porEmpresa[c.id_empresa] = (porEmpresa[c.id_empresa] || 0) + 1;
  }

  if (comoJson) {
    console.log(JSON.stringify({
      total_solicitudes: filas.length,
      total_en_riesgo: casos.length,
      por_empresa: porEmpresa,
      casos,
    }, null, 2));
    return;
  }

  console.log('=== Inventario de buzón corporativo para el OTP (D-2) ===');
  console.log('  solicitudes revisadas :', filas.length);
  console.log('  en riesgo (47.4)      :', casos.length);
  if (filtroEmpresa) console.log('  empresa               :', filtroEmpresa);
  console.log('');

  if (casos.length === 0) {
    console.log('  Ninguna solicitud tiene el OTP en un buzón corporativo.');
    console.log('  (Ojo: esto es sobre el directorio de empresas actual. Si una');
    console.log('  empresa no está registrada, su dominio no se puede deducir.)');
    return;
  }

  console.log('  por empresa:');
  for (const [emp, n] of Object.entries(porEmpresa).sort((a, b) => b[1] - a[1])) {
    console.log('    ' + emp + ': ' + n);
  }
  console.log('');
  console.log('  detalle (id_solicitud | empresa | a dónde llegaría el código):');
  for (const c of casos.slice(0, 50)) {
    console.log('    ' + c.id_solicitud + ' | ' + c.id_empresa + ' | '
      + c.donde_llegaria_el_codigo
      + (c.medio_personal_declarado ? ' (declarado por el trabajador)' : ' (contacto de la empresa)'));
  }
  if (casos.length > 50) {
    console.log('    ... y ' + (casos.length - 50) + ' más (usá --json para el detalle)');
  }
  console.log('');
  console.log('  Recordatorio: el rechazo (D2) está APAGADO hasta que exista la 9A');
  console.log('  (la firma en papel). Exigir un medio personal sin esa salida sería');
  console.log('  una barrera de acceso al empleo (2.2.1.1.11).');
}

try {
  main();
} catch (e) {
  console.error('ERROR:', e && e.message ? e.message : e);
  process.exit(1);
}

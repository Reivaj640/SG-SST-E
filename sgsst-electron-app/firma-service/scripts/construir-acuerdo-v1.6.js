#!/usr/bin/env node
/**
 * Construye el Acuerdo v1.6 a partir de los archivos de la v1.5 y de las
 * correcciones del dictamen legal del 11-nov-2026.
 *
 * Reproducible e idempotente: lee siempre la v1.5 (nunca su propia salida),
 * asi que correrlo dos veces deja los mismos archivos.
 *
 * QUE CORRIGE, Y POR QUE
 * ----------------------
 * La v1.5 afirma que el canal de correo se presta mediante una cuenta
 * gratuita de Gmail para consumidores y que no existe DPA empresarial ni
 * contrato de transmision con Google. Desde el 10-nov-2026 el canal es una
 * cuenta empresarial de Google Workspace con el CDPA aceptado, y esa
 * evidencia esta en el manifiesto (mail_provider.aceptacion).
 *
 * El cambio no borra que Google sea Responsable del Tratamiento: lo
 * delimita en dos planos, que es lo que faltaba. La version nueva es la via
 * que exige el propio 9.4 del Acuerdo, y no hay atajo por un otrosi: el
 * otrosi no llega al Titular y la Constancia no lo identifica (9.6).
 *
 * Lo que NO se toca: los demas numerales, los diez reemplazos de texto
 * libre de la v1.5 (sus anclas no quedan afectadas) y los datos del owner.
 */

const fs = require('fs');
const path = require('path');

const FIXTURES = path.join(__dirname, '..', 'scripts', 'fixtures');
const V5_CAMBIOS = path.join(FIXTURES, 'acuerdo-v1.5-cambios.json');
const V5_DATOS = path.join(FIXTURES, 'acuerdo-v1.5-datos.json');
const CORRECCIONES = path.join(FIXTURES, 'acuerdo-v1.6-correcciones.json');
const V6_CAMBIOS = path.join(FIXTURES, 'acuerdo-v1.6-cambios.json');
const V6_DATOS = path.join(FIXTURES, 'acuerdo-v1.6-datos.json');

/**
 * Aplica una correccion sobre un texto y exige que el ancla aparezca
 * EXACTAMENTE una vez. Si aparece cero o mas de una vez, el script aborta:
 * una correccion que no se aplica es una correccion que no se nota (PROMPT
 * 5.11 y 5.16).
 */
function aplicarCorreccion(texto, correccion, contexto) {
  const { motivo, antiguo, nuevo } = correccion;
  const partes = texto.split(antiguo);
  if (partes.length !== 2) {
    throw new Error(
      'Ancla con ' + (partes.length - 1) + ' coincidencias en ' + contexto +
      ': ' + motivo
    );
  }
  return partes[0] + nuevo + partes[1];
}

function construir() {
  const v5 = JSON.parse(fs.readFileSync(V5_CAMBIOS, 'utf8'));
  const datos5 = JSON.parse(fs.readFileSync(V5_DATOS, 'utf8'));
  const corr = JSON.parse(fs.readFileSync(CORRECCIONES, 'utf8'));

  if (corr.version_origen !== v5.version) {
    throw new Error(
      'El JSON de correcciones parte de ' + corr.version_origen +
      ' y el archivo de origen es ' + v5.version + '.'
    );
  }

  const cambios = Object.assign({}, v5.cambios);
  let aplicados = 0;

  for (const numeral of Object.keys(corr.numerales)) {
    if (typeof cambios[numeral] !== 'string') {
      throw new Error('El numeral ' + numeral + ' no esta en los cambios de la v1.5.');
    }
    let texto = cambios[numeral];
    for (const correccion of corr.numerales[numeral]) {
      texto = aplicarCorreccion(texto, correccion, numeral);
      aplicados += 1;
    }
    cambios[numeral] = texto;
  }

  const v6 = Object.assign({}, v5);
  v6.version = corr.version_destino;
  v6.fuente = corr.fuente;
  v6.fuente_ruta = corr.fuente_ruta;
  v6.nota = corr.nota;
  v6.fecha_vigencia = corr.fecha_vigencia;
  v6.cambios = cambios;

  const d6 = Object.assign({}, datos5);
  d6.version = corr.version_destino;

  fs.writeFileSync(V6_CAMBIOS, JSON.stringify(v6, null, 2) + '\n', 'utf8');
  fs.writeFileSync(V6_DATOS, JSON.stringify(d6, null, 2) + '\n', 'utf8');

  console.log('acuerdo-v1.6-correcciones.json: ' + aplicados + ' correcciones aplicadas');
  console.log('acuerdo-v1.6-cambios.json: version ' + v6.version +
    ', fecha de vigencia ' + v6.fecha_vigencia);
  console.log('acuerdo-v1.6-datos.json: version ' + d6.version);
}

if (require.main === module) construir();

module.exports = { construir, aplicarCorreccion };

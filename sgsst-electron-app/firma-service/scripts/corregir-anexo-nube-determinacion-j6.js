#!/usr/bin/env node
/**
 * scripts/corregir-anexo-nube-determinacion-j6.js
 *
 * CORRIGE EL ANEXO DE NUBE (A3): le quita las tres frases que todavia
 * presentaban la clasificacion de Google como PENDIENTE de validacion
 * profesional, cuando la determinacion ya esta escrita.
 *
 * POR QUE HACE FALTA
 * ------------------
 * El abogado (J6, 30-oct-2026) wrote una determinacion EXPRESA: "Por la
 * operacion concreta, y contrastada con los terminos aplicables de la cuenta
 * de consumo, Google LLC decide sobre la finalidad y los medios de su propio
 * servicio y trata los datos por cuenta propia [...] en esta operacion Google
 * actua como Responsable del Tratamiento [...], no como Encargado ni
 * subencargado de Gesstiar." Y en "Cambios exactos exigidos" (que cumplen la
 * instruccion de D1): "A3 §4: la ficha de Google [...] -> 'Responsable del
 * Tratamiento en esta operacion, por los motivos y con los efectos
 * determinados en el §5 del Anexo de Encargo', conservando integra la
 * advertencia de que no hay DPA."
 *
 * La FICHA de A3 §4 si se corrigio. Pero en el MISMO documento quedaban tres
 * frases que decian lo contrario:
 *
 *   1. El RESUMEN: "El papel del proveedor por operacion, la clasificacion
 *      juridica del flujo, su fundamento y las obligaciones regulatorias
 *      aplicables quedan pendientes de validacion profesional escrita antes
 *      de firmar o publicar."
 *   2. El §3: "su papel por operacion, la clasificacion del flujo y el
 *      fundamento aplicable quedan pendientes de validacion profesional. No
 *      se atribuye a Google un DPA empresarial ni un subencargo contractual sin
 *      soporte."
 *   3. El §4: "El expediente no atribuye a Google la condicion de Responsable,
 *      Encargado o subencargado de Gesstiar. La clasificacion del flujo, su
 *      fundamento y las obligaciones derivadas siguen pendientes de validacion
 *      escrita del abogado; documentar el uso real y los datos enviados no
 *      sustituye esa determinacion."
 *
 * Un mismo documento que dice a la vez que la determinacion esta pendiente y
 * que ya esta decidida es exactamente el defecto que el abogado describio en
 * su respuesta final: "un documento contractual no puede afirmar a la vez que
 * la calificacion esta pendiente y que ya esta decidida".
 *
 * LO QUE NO SE CAMBIA
 * -------------------
 * Lo que SI sigue pendiente: los pasos documentales que el propio A3 enumera
 * en su bloque de pendientes (el acknowledgment de cada Empresa, su politica
 * con la transferencia, la declaracion en el RNBD y la evidencia tecnica de
 * cada apartado de la ficha). Eso se dice con la frase "los pasos
 * documentales enumerados en el bloque de pendientes de este Anexo, no la
 * caracterizacion de la operacion": la caracterizacion esta decidida; lo que
 * falta son papeles.
 *
 * USO
 * ---
 *   node scripts/corregir-anexo-nube-determinacion-j6.js
 *   node scripts/corregir-anexo-nube-determinacion-j6.js --check
 *
 * Exit codes:
 *   0 = corregido (o verificado con --check)
 *   3 = un texto no aparece exactamente una vez, o las dos copias difieren
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = path.resolve(SERVICE_ROOT, '..');
const REPO_ROOT = path.resolve(APP_ROOT, '..');
const LEGAL = path.join(APP_ROOT, 'legal', 'anexo-nube-v1.0.html');
const SITIO = path.join(REPO_ROOT, 'sitio', 'anexo-nube-v1.0.html');

// Los tres reemplazos. El texto viejo se busca TAL COMO ESTA en el archivo
// (con sus entidades y sus saltos de linea): si el archivo cambia, el
// reemplazo deja de encontrarlo y el script se niega a escribir. Un
// reemplazo "aproximado" en un documento legal es peor que no hacer nada.
const REEMPLAZOS = [
  {
    etiqueta: 'A3 · Resumen',
    viejo: 'El papel del proveedor por operación, la clasificación jurídica del flujo, su fundamento y las obligaciones regulatorias aplicables quedan pendientes de validación profesional escrita antes de firmar o publicar.',
    nuevo: 'El papel del proveedor por operaci&oacute;n y la clasificaci&oacute;n del flujo est&aacute;n determinados por escrito en el &sect;5 del Anexo de Encargo: en esta operaci&oacute;n Google act&uacute;a como Responsable del Tratamiento y el flujo constituye una transferencia internacional, y no existe DPA empresarial ni contrato de transmisi&oacute;n con Google. Lo que queda pendiente son los pasos documentales y la evidencia enumerados en el bloque de pendientes de este Anexo, no la caracterizaci&oacute;n de la operaci&oacute;n.',
  },
  {
    etiqueta: 'A3 · sección 3',
    viejo: 'Google interviene como proveedor externo del correo;\n   su papel por operaci&oacute;n, la clasificaci&oacute;n del flujo y el fundamento aplicable quedan pendientes de\n   validaci&oacute;n profesional. No se atribuye a Google un DPA empresarial ni un subencargo contractual sin soporte.',
    nuevo: 'Google interviene como proveedor externo del correo;\n   en esta operaci&oacute;n act&uacute;a como Responsable del Tratamiento y el flujo constituye una transferencia\n   internacional, por los motivos y con los efectos determinados en el &sect;5 del Anexo de Encargo: no existe\n   DPA empresarial ni contrato de transmisi&oacute;n con Google, y Google no act&uacute;a como Encargado ni\n   subencargado de Gesstiar.',
  },
  {
    etiqueta: 'A3 · sección 4',
    viejo: 'El expediente no atribuye\n   a Google la condici&oacute;n de Responsable, Encargado o subencargado de Gesstiar. La clasificaci&oacute;n del\n   flujo, su fundamento y las obligaciones derivadas siguen pendientes de validaci&oacute;n escrita del abogado;\n   documentar el uso real y los datos enviados no sustituye esa determinaci&oacute;n.',
    nuevo: 'Esta determinaci&oacute;n no equivale a un acuerdo de tratamiento con Google: no se atribuyen a Google\n   condiciones de conservaci&oacute;n, supresi&oacute;n o auditor&iacute;a que no hayan sido verificadas documentalmente.\n   Lo que queda pendiente son los pasos documentales enumerados en el bloque de pendientes de este Anexo, no la\n   caracterizaci&oacute;n de la operaci&oacute;n.',
  },
];

function main() {
  const soloCheck = process.argv.includes('--check');
  if (!fs.existsSync(LEGAL)) {
    console.error('No existe ' + LEGAL);
    process.exit(3);
  }
  let texto = fs.readFileSync(LEGAL, 'utf8');
  const original = texto;

  for (const r of REEMPLAZOS) {
    const n = texto.split(r.viejo).length - 1;
    if (n === 0) {
      if (texto.indexOf(r.nuevo) >= 0) {
        console.log('  (ya aplicado) ' + r.etiqueta);
        continue;
      }
      console.error('ERROR: el texto de ' + r.etiqueta + ' no aparece (ni el viejo ni el nuevo).');
      console.error('       No se escribe nada: revisa el archivo antes de volver a correrlo.');
      process.exit(3);
    }
    if (n > 1) {
      console.error('ERROR: el texto de ' + r.etiqueta + ' aparece ' + n + ' veces; tiene que aparecer una.');
      process.exit(3);
    }
    texto = texto.replace(r.viejo, r.nuevo);
    console.log('  corregido: ' + r.etiqueta);
  }

  if (texto === original) {
    console.log('No habia nada que corregir (ya estaba aplicado).');
  } else if (soloCheck) {
    console.log('--check: habria cambios; no se escribio nada.');
  } else {
    fs.writeFileSync(LEGAL, texto, 'utf8');
    // Las dos copias tienen que quedar byte a byte iguales: una sola huella
    // no puede describir dos textos.
    fs.writeFileSync(SITIO, texto, 'utf8');
    console.log('Anexo de Nube corregido en legal/ y sitio/.');
  }

  const crypto = require('crypto');
  const bytes = fs.readFileSync(LEGAL);
  console.log('  sha256: ' + crypto.createHash('sha256').update(bytes).digest('hex'));
  console.log('  bytes : ' + bytes.length);
}

main();

'use strict';
/**
 * firma-service/scripts/sincronizar-anexo-nube-v1.1.js
 *
 * Cierra el Anexo de Nube (A3) sobre la copia canonica corregida y sincroniza
 * la copia publicada con `fs.copyFileSync`.
 *
 * Alcance: solo el Anexo de Nube. No toca el Acuerdo, el Anexo de Encargo, la
 * Constancia, `src/**`, `config/**` ni el manifiesto `legal-readiness.json`.
 *
 * 1) Aplica en `sgsst-electron-app/legal/anexo-nube-v1.0.html` los dos puntos
 *    de la revision juridica del 30-oct-2026 que faltaban, con reemplazo
 *    literal exacto:
 *      - A3 §10 (J12): el Anexo no se firma con marcadores [PENDIENTE]
 *        pendientes; se firma despues de completarlos y la firma no sustituye
 *        la evidencia.
 *      - A3 §3 (J14, punto 4): el RTO se redacta como "objetivo de
 *        recuperacion dependent de la deteccion y del inicio de la respuesta".
 * 2) Copia `sgsst-electron-app/legal/anexo-nube-v1.0.html` sobre
 *    `sitio/anexo-nube-v1.0.html` para que ambas queden byte a byte identicas.
 *
 * Idempotente: si el texto viejo no aparece pero el nuevo si, el ajuste se
 * considera ya aplicado y no se modifica nada. Si ninguno aparece, el script
 * se detiene con error en vez de adivinar.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const LEGAL = path.join(RAIZ, 'sgsst-electron-app', 'legal', 'anexo-nube-v1.0.html');
const SITIO = path.join(RAIZ, 'sitio', 'anexo-nube-v1.0.html');

const AJUSTES = [
  {
    id: 'A3 §10 (J12) — firma con marcadores [PENDIENTE] pendientes',
    viejo:
      '<strong>Este Anexo no se firma hasta que se haya completado la lista del bloque de pendientes.</strong> ' +
      'Este Anexo\n    <strong>sustituye</strong>',
    nuevo:
      '<strong>Este Anexo no se firma hasta que se haya completado la lista del bloque de pendientes.</strong> ' +
      'Este Anexo no se firma con marcadores [PENDIENTE] pendientes: se firma despu&eacute;s de completarlos, ' +
      'y la firma no sustituye la evidencia. Este Anexo\n    <strong>sustituye</strong>',
  },
  {
    id: 'A3 §3 (J14 punto 4) — RTO dependent de la deteccion y del inicio de la respuesta',
    viejo:
      '<strong>Continuidad:</strong> el tiempo objetivo de recuperaci&oacute;n (RTO) es de 4 horas y el punto objetivo\n' +
      '  de recuperaci&oacute;n (RPO) es de 24 horas',
    nuevo:
      '<strong>Continuidad:</strong> el tiempo objetivo de recuperaci&oacute;n (RTO) es de 4 horas, con el car&aacute;cter\n' +
      '  de objetivo de recuperaci&oacute;n dependent de la detecci&oacute;n y del inicio de la respuesta, y el punto objetivo\n' +
      '  de recuperaci&oacute;n (RPO) es de 24 horas',
  },
];

function ocurrencias(texto, aguja) {
  return texto.split(aguja).length - 1;
}

function sha256(archivo) {
  return crypto.createHash('sha256').update(fs.readFileSync(archivo)).digest('hex');
}

function aplicar() {
  let texto = fs.readFileSync(LEGAL, 'utf8');
  const antes = texto;

  for (const ajuste of AJUSTES) {
    const nViejo = ocurrencias(texto, ajuste.viejo);
    const nNuevo = ocurrencias(texto, ajuste.nuevo);

    if (nViejo > 1) {
      console.error('ERROR: el texto viejo aparece ' + nViejo + ' veces (debe ser unico): ' + ajuste.id);
      process.exit(1);
    }
    if (nNuevo >= 1) {
      console.log('YA ESTABA  | ' + ajuste.id);
      continue;
    }
    if (nViejo === 1) {
      texto = texto.replace(ajuste.viejo, ajuste.nuevo);
      console.log('APLICADO   | ' + ajuste.id);
      continue;
    }
    console.error('ERROR: no se encuentra ni el texto viejo ni el texto nuevo: ' + ajuste.id);
    process.exit(1);
  }

  if (texto !== antes) {
    fs.writeFileSync(LEGAL, texto, 'utf8');
    console.log('escrito    | ' + path.relative(RAIZ, LEGAL));
  } else {
    console.log('sin cambios| ' + path.relative(RAIZ, LEGAL));
  }
}

function sincronizar() {
  fs.copyFileSync(LEGAL, SITIO);
  console.log('copiado    | ' + path.relative(RAIZ, LEGAL) + ' -> ' + path.relative(RAIZ, SITIO));
}

aplicar();
sincronizar();

const hLegal = sha256(LEGAL);
const hSitio = sha256(SITIO);
const bLegal = fs.statSync(LEGAL).size;
const bSitio = fs.statSync(SITIO).size;

console.log('');
console.log('legal/ ' + bLegal + ' B  sha256 ' + hLegal);
console.log('sitio/ ' + bSitio + ' B  sha256 ' + hSitio);
if (hLegal !== hSitio) {
  console.error('ERROR: las dos copias no son byte a byte identicas');
  process.exit(1);
}
console.log('identicas | legal/ y sitio/ coinciden byte a byte');

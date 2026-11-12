/**
 * EL PAQUETE DEL ABOGADO NO SE DESCUADRA EN SILENCIO
 * ===================================================
 *
 * EL FALLO QUE ESTE TEST CIERRA
 * ------------------------------
 * El 12-nov-2026, al verificar el manifiesto de integridad del paquete del
 * abogado, aparecio una deriva que llevaba una ronda entera sin que nadie la
 * notara:
 *
 *   `11-checklist-definitivo-revision-juridica-y-cierre.md` se edito en la
 *   ronda anterior (la fila J12 del 📦1050) y **el `SHA256SUMS.txt` no se
 *   regenero**.
 *
 * El archivo que se habia enviado al abogado seguia cuadrando con lo que se
 * le habia enviado: por eso nadie lo noto. El repositorio ya no cuadraba con
 * el paquete, y el manifiesto de integridad del paquete **dejaba de ser la
 * garantia que decia ser**.
 *
 * POR QUE HAY UN SCRIPT Y NO SOLO UN RECORDATORIO
 * ----------------------------------------------
 * Un recordatorio depende de que alguien se acuerde. El deriva se nota sola:
 * el script recalcula las 14 sumas y sale con codigo distinto de 0 si algo no
 * cuadra. Y este test corre ese script de verdad.
 *
 * LO QUE SE VERIFICA ACA
 * ----------------------
 * - Que el paquete REAL verifica: 14 lineas, todas coinciden, codigo 0.
 * - Que el script DETECTA la deriva: una copia con un archivo alterado se
 *   reporta nombrando el archivo (no basta con que el codigo sea distinto:
 *   un check que solo mira el codigo podria estar mirando otra cosa).
 * - Que DETECTA un archivo que falta.
 * - Que NO ESCRIBE: la corrida no altera ni un byte del manifiesto. Un
 *   verificador que arregla lo que verifica no verifica nada.
 * - Que un archivo del paquete que no esta en el manifiesto se reporta (el
 *   manifiesto tiene que amortpar TODO lo que viaja).
 *
 * "nota-al-abogado-2026-10-30.md" NO esta en el manifiesto por diseno: es la
 * nota que se escribe al abogado, no un adjunto, y el propio
 * `scripts/armar-paquete-abogado.js` la conserva aparte. Este test lo tiene en
 * cuenta y no lo confunde con una deriva.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { verificar, PAQUETE_POR_DEFECTO } = require('../../scripts/verificar-sumas-paquete-abogado');

/**
 * Copia el paquete a un directorio temporal para poder romperlo sin tocar el
 * paquete real.
 * @returns {string} la ruta de la copia.
 */
function copiarPaquete() {
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), 'paquete-abogado-'));
  for (const nombre of fs.readdirSync(PAQUETE_POR_DEFECTO)) {
    fs.copyFileSync(
      path.join(PAQUETE_POR_DEFECTO, nombre),
      path.join(destino, nombre)
    );
  }
  return destino;
}

test('el paquete real verifica: las 14 sumas coinciden', () => {
  const r = verificar(PAQUETE_POR_DEFECTO);
  assert.equal(r.ok, true, 'el paquete real debe verificar sin deriva');
  assert.equal(r.codigo, 0);
  assert.equal(r.deriva.length, 0, 'sin deriva: ' + JSON.stringify(r.deriva));
  assert.equal(r.faltan.length, 0, 'sin archivos faltantes: ' + JSON.stringify(r.faltan));
  assert.ok(r.lineas >= 14, 'el manifiesto lista al menos 14 adjuntos');
});

test('detecta la deriva de un adjunto alterado y NOMBRA el archivo', () => {
  const copia = copiarPaquete();
  try {
    const objetivo = path.join(copia, '10-informe-correcciones-para-asesor-juridico.md');
    const original = fs.readFileSync(objetivo, 'utf8');
    fs.writeFileSync(objetivo, original + '\nuna linea de mas\n', 'utf8');

    const r = verificar(copia);
    assert.equal(r.ok, false, 'una copia alterada NO puede verificar');
    assert.equal(r.codigo, 1);
    assert.equal(r.deriva.length, 1, 'exactamente un archivo con deriva');
    assert.equal(
      r.deriva[0].archivo,
      '10-informe-correcciones-para-asesor-juridico.md',
      'la deriva se reporta nombrando el archivo'
    );
    assert.notEqual(r.deriva[0].real, r.deriva[0].esperado);
  } finally {
    fs.rmSync(copia, { recursive: true, force: true });
  }
});

test('detecta un adjunto que esta en el manifiesto y no en el paquete', () => {
  const copia = copiarPaquete();
  try {
    fs.unlinkSync(path.join(copia, '11-checklist-definitivo-revision-juridica-y-cierre.md'));
    const r = verificar(copia);
    assert.equal(r.ok, false);
    assert.equal(r.codigo, 1);
    assert.equal(r.faltan.length, 1);
    assert.equal(r.faltan[0], '11-checklist-definitivo-revision-juridica-y-cierre.md');
  } finally {
    fs.rmSync(copia, { recursive: true, force: true });
  }
});

test('el verificador NO escribe: la corrida no altera el manifiesto', () => {
  const copia = copiarPaquete();
  try {
    const rutaManifiesto = path.join(copia, 'SHA256SUMS.txt');
    const antes = fs.readFileSync(rutaManifiesto);
    const antesMtime = fs.statSync(rutaManifiesto).mtimeMs;

    verificar(copia);

    const despues = fs.readFileSync(rutaManifiesto);
    assert.ok(
      antes.equals(despues),
      'el verificador no puede alterar el manifiesto que verifica'
    );
    assert.equal(fs.statSync(rutaManifiesto).mtimeMs, antesMtime);
  } finally {
    fs.rmSync(copia, { recursive: true, force: true });
  }
});

test('un archivo del paquete que no esta en el manifiesto se reporta', () => {
  const copia = copiarPaquete();
  try {
    fs.writeFileSync(path.join(copia, '99-adjunto-nuevo.md'), 'nuevo\n', 'utf8');
    const r = verificar(copia);
    // El manifiesto no lo ampara: eso es deriva aunque el codigo de salida
    // siga siendo 0 (el archivo no esta listado, no hay suma que comparar).
    assert.ok(
      r.sobran.indexOf('99-adjunto-nuevo.md') >= 0,
      'un adjunto sin amortpar se reporta: ' + JSON.stringify(r.sobran)
    );
  } finally {
    fs.rmSync(copia, { recursive: true, force: true });
  }
});

test('la nota al abogado no es una deriva: no esta en el manifiesto por diseno', () => {
  const r = verificar(PAQUETE_POR_DEFECTO);
  assert.ok(
    r.sobran.indexOf('nota-al-abogado-2026-10-30.md') >= 0,
    'la nota se conserva aparte del manifiesto, por diseno del paquete'
  );
  assert.equal(r.ok, true, 'y eso NO es motivo de falla');
});

/**
 * EL VERIFICADOR DE RUNTIME NO PUEDE CONTAR COMO FALLO EL ESTADO DE LA VENTANA
 * ==========================================================================
 *
 * EL CASO REAL (14-nov-2026), la ronda 24
 * -----------------------------------------
 * La ventana de Node 22 se ejecutó y **funcionó**: el servicio quedó corriendo
 * con el runtime propio (`/opt/kair-firma/node22/bin/node`, v22.23.5, ABI 127)
 * y con el binario nativo ABI 127 (`d7d9272b…da37`), `/health` en 200 y
 * `checks.db == "ok"`, `NRestarts = 0`. Y sin embargo el verificador devolvió
 * **1** y la ventana **se abortó y se hizo rollback** de una ventana correcta.
 *
 * POR QUÉ
 * -------
 * El paso 4 del verificador ("el node del PATH contra el mismo modulo") solo
 * se ejecuta cuando el node del PATH **es un binario distinto** del del
 * servicio: es decir, **justo en el estado que deja la ventana** (el servicio
 * con su runtime propio, `/usr/bin/node` sin tocar). Y ahí, el node de la
 * consola **no puede** cargar el modulo, porque el binario nativo es del ABI
 * del runtime del servicio. El script contaba eso como **fallo**, cuando es
 * exactamente el estado que la ventana produce a propósito.
 *
 * La incoherencia real la sigue detectando el paso 3: si el node **del
 * servicio** no puede cargar el modulo, ese sigue siendo un fallo.
 *
 * QUE PRUEBA ESTE TEST
 * --------------------
 * La **decision** del paso 4 se ejecuta de verdad: se extrae el bloque del
 * script y se corre en `bash` con los dos codigos de salida simulados. Se
 * comprueban los DOS casos:
 *
 *   - el node del PATH falla pero el del servicio carga → **aviso**, 0 fallos;
 *   - el node del PATH falla y el del servicio tambien → **fallo**.
 *
 * Si `bash` no esta disponible, las pruebas funcionales se **omiten** (con el
 * motivo) y quedan las estructurales, que miran el texto del script.
 *
 * POR QUE VIVE EN `tests/scripts/`
 * --------------------------------
 * El corredor oficial (`npm test`) descubre `tests/scripts/*.test.js`; el
 * script que prueba vive en `deploy/`, pero su prueba va aqui para que la
 * suite oficial la corra sin tocar la lista de patrones.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RUTA_SCRIPT = path.resolve(
  __dirname, '..', '..', 'deploy', 'verificar-runtime-node.sh'
);
const texto = fs.readFileSync(RUTA_SCRIPT, 'utf8');

/**
 * El bloque del paso 4: el que decide que hacer cuando el node del PATH no
 * carga el modulo.
 *
 * @returns {string|null}
 */
function bloquePaso4() {
  const m = /if \[ "\$CODIGO_PATH" -eq 0 \]; then[\s\S]*?\n {2}fi\n/.exec(texto);
  return m ? m[0] : null;
}

/**
 * Busca un `bash` usable en esta maquina.
 *
 * @returns {string|null}
 */
function buscarBash() {
  const candidatos = ['bash', '/bin/bash', '/usr/bin/bash'];
  if (process.platform === 'win32') {
    candidatos.unshift(
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files\\Git\\usr\\bin\\bash.exe'
    );
  }
  for (const c of candidatos) {
    const r = spawnSync(c, ['-c', 'echo ok'], { encoding: 'utf8' });
    if (!r.error && r.status === 0) return c;
  }
  return null;
}

const BASH = buscarBash();

/**
 * Corre el bloque del paso 4 con los codigos de salida simulados.
 *
 * @param {number} codigoPath - codigo de salida de la carga con el node del PATH.
 * @param {number} codigoServicio - codigo de salida de la carga con el node del servicio.
 * @returns {{fallas: number, avisos: number, salida: string}|null}
 */
function correrPaso4(codigoPath, codigoServicio) {
  const bloque = bloquePaso4();
  if (!bloque || !BASH) return null;
  const guion = [
    'FALLAS=0; AVISOS=0',
    'ok() { echo "[ OK ] $*"; }',
    'aviso(){ echo "[aviso] $*"; AVISOS=$((AVISOS+1)); }',
    'fallo(){ echo "[FALLA] $*"; FALLAS=$((FALLAS+1)); }',
    'CODIGO_PATH=' + codigoPath,
    'CODIGO_CARGA=' + codigoServicio,
    'VERSION_PATH="v20.20.2"',
    'ABI_PATH=115',
    'ABI_SERV=127',
    'VERSION_SERV="v22.23.5"',
    'NODE_SERVICIO="/opt/kair-firma/node22/bin/node"',
    'SALIDA_PATH=""',
    bloque,
    'echo "FALLAS=$FALLAS AVISOS=$AVISOS"',
  ].join('\n');
  const r = spawnSync(BASH, ['-c', guion], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  const m = /FALLAS=(\d+) AVISOS=(\d+)/.exec(r.stdout || '');
  if (!m) return null;
  return { fallos: Number(m[1]), avisos: Number(m[2]), salida: r.stdout || '' };
}

test('el nodo del PATH que no carga el modulo es un AVISO cuando el del servicio SI lo carga', (t) => {
  if (!BASH) {
    t.skip('no hay bash en esta maquina: la decision no se puede ejecutar');
    return;
  }
  const r = correrPaso4(1, 0);
  assert.ok(r, 'el bloque del paso 4 tiene que estar en el script y ser ejecutable');
  assert.equal(r.fallos, 0,
    'el desajuste del node de la consola NO es un fallo: es el estado de la ventana');
  assert.ok(r.avisos >= 1,
    'el desajuste tiene que quedar avisado (encontrados ' + r.avisos + ')');
  assert.ok(r.salida.indexOf('ABI 127') >= 0,
    'el aviso dice de que ABI es el binario nativo');
});

test('cuando el nodo del SERVICIO tampoco carga el modulo, eso SI es un fallo', (t) => {
  if (!BASH) {
    t.skip('no hay bash en esta maquina: la decision no se puede ejecutar');
    return;
  }
  const r = correrPaso4(1, 1);
  assert.ok(r, 'el bloque del paso 4 tiene que estar en el script y ser ejecutable');
  assert.ok(r.fallos >= 1,
    'la incoherencia real (el servicio tampoco carga) tiene que seguir fallando');
});

test('el paso 3 sigue contando como fallo la carga que falla con el node del SERVICIO', () => {
  assert.ok(
    texto.indexOf('fallo "el modulo NO carga con el node del servicio') >= 0,
    'el verificador tiene que seguir fallando cuando el node del servicio no carga el modulo'
  );
  // El mensaje VIEJO (el que abortaba la ventana) no puede volver: contaba
  // como fallo el desajuste del node de la consola, que es el estado de la
  // ventana. El mensaje NUEVO solo aparece en la rama donde el node del
  // SERVICIO tampoco carga, y dice las dos cosas.
  assert.ok(
    texto.indexOf('fallo "el node del PATH NO carga el modulo (codigo $CODIGO_PATH): el runtime de la consola') < 0,
    'el mensaje viejo del node del PATH no puede volver: hacia abortar una ventana correcta'
  );
  assert.ok(
    texto.indexOf('fallo "el node del PATH NO carga el modulo (codigo $CODIGO_PATH) y tampoco el node del servicio') >= 0,
    'la rama que si falla es la que dice que tampoco lo carga el node del servicio'
  );
  assert.ok(
    texto.indexOf('aviso "el node del PATH ($VERSION_PATH, ABI $ABI_PATH) NO carga el modulo') >= 0,
    'el desajuste del node de la consola tiene que quedar avisado'
  );
});

test('el verificador sale con 1 cuando hay fallos y con 0 cuando no', () => {
  assert.ok(
    /if \[ "\$FALLAS" -gt 0 \]; then[\s\S]*?exit 1/.test(texto),
    'con fallos, el codigo de salida es 1 (es el codigo que hace fallar la ventana)'
  );
  assert.ok(
    /RESULTADO: coherente \(codigo 0\)\.["\s\S]*?exit 0/.test(texto),
    'sin fallos, el codigo de salida es 0'
  );
});

test('el paso 4 solo se ejecuta cuando el node del PATH es un binario DISTINTO', () => {
  assert.ok(
    /if \[ -n "\$NODE_PATH" \] && \[ -x "\$NODE_PATH" \] && \[ "\$NODE_PATH" != "\$NODE_SERVICIO" \]; then/.test(texto),
    'el paso 4 se salta cuando el node del PATH es el mismo archivo que el del servicio'
  );
});

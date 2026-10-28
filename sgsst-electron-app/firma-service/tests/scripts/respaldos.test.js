/**
 * Tests de los RESPALDOS cifrados y de la purga que alcanza a los respaldos.
 *
 * Estos tests son ESTATICOS: leen los scripts de `deploy/` y comprueban que
 * el código dice lo que el Acuerdo de uso promete. No ejecutan bash sobre
 * el servidor (aun asi, si hay un bash disponible, se corre `bash -n` para
 * comprobar la SINTAXIS de los tres scripts).
 *
 * El problema que estos tests cubren:
 *
 *   - El 8.7 del Acuerdo promete que la supresion alcanza a los respaldos.
 *     El codigo guardaba las copias SIN CIFRAR y las podaba por EDAD, lo que
 *     borra el ARCHIVO de respaldo y NO el REGISTRO suprimido de las copias
 *     que siguen existiendo: el dato suprimido seguia ahi, en claro.
 *   - Los respaldos tenian que quedar cifrados en reposo.
 *   - La poda no puede violar un HOLD (deber legal de conservacion).
 *   - La retencion de 30 dias es de COPIAS, no de registros.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SERVICE = path.resolve(__dirname, '..', '..');
const DEPLOY = path.join(SERVICE, 'deploy');

function leer(nombre) {
  return fs.readFileSync(path.join(DEPLOY, nombre), 'utf8');
}

/**
 * El script SIN los comentarios: lo que se ejecuta de verdad. Sirve para
 * distinguir "el script genera la frase" de "el comentario explica como
 * generarla a mano".
 */
function codigo(t) {
  return t.split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
}

/**
 * El bash disponible (si hay). En Windows suele estar el de Git; en Linux,
 * /bin/bash. Si no hay ninguno, la prueba de sintaxis se omite: las
 * aserciones estaticas son el minimo aceptable.
 */
function buscarBash() {
  if (process.platform === 'win32') {
    const candidatos = [
      process.env.KAIR_BASH,
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'usr', 'bin', 'bash.exe'),
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
    ].filter(Boolean);
    return candidatos.find((p) => fs.existsSync(p)) || null;
  }
  for (const p of ['/bin/bash', '/usr/bin/bash']) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// =============================================================================
// A. backup-firma.sh: nada en claro, y aborta si falta lo que hace falta.
// =============================================================================

test('respaldos · backup-firma.sh no escribe ningun archivo en claro', () => {
  const t = leer('backup-firma.sh');

  // Los artefactos que quedan en $BACKUPS terminan en .enc.
  assert.match(t, /COPIA_ENC=\$BACKUPS\/firma-\$STAMP\.sqlite\.enc/,
    'la copia de la base se guarda cifrada');
  assert.match(t, /PDFS_ENC=\$BACKUPS\/storage-\$STAMP\.tar\.gz\.enc/,
    'el tarball de los PDF se guarda cifrado');

  // La copia EN CLARO nunca se escribe en $BACKUPS: vive en un temporal.
  const lineasBackup = t.split('\n').filter((l) => l.includes(".backup '"));
  assert.equal(lineasBackup.length, 1, 'hay una sola copia de la base de datos');
  assert.ok(!lineasBackup[0].includes('$BACKUPS'),
    'la copia en claro NO se escribe en $BACKUPS');
  assert.ok(lineasBackup[0].includes('$COPIA_PLAIN'),
    'la copia en claro va al temporal');

  // Y ese temporal se borra siempre (trap).
  assert.match(t, /trap 'rm -rf "\$WORK"' EXIT/,
    'el temporal con la copia en claro se borra con trap');

  // La poda busca los archivos CIFRADOS, no los en claro.
  assert.match(t, /find "\$BACKUPS" -name 'firma-\*\.sqlite\.enc' -mtime \+\$RETENCION_DIAS -delete/);
  assert.match(t, /find "\$BACKUPS" -name 'storage-\*\.tar\.gz\.enc' -mtime \+\$RETENCION_DIAS -delete/);

  // Y no queda ninguna copia en claro con un nombre sin cifrar.
  assert.ok(!/\.backup '\$COPIA'/.test(t),
    'no hay una copia de la base sin cifrar');
  assert.ok(!/sqlite3 "\$DB" "\.backup '[^']*\.sqlite'"/.test(t),
    'no hay un .backup a un destino sin cifrar');
});

test('respaldos · backup-firma.sh aborta si falta la frase', () => {
  const t = leer('backup-firma.sh');
  assert.match(t, /no existe el archivo de frase/,
    'el script dice que la frase no existe');
  assert.match(t, /no se puede leer el archivo de frase/,
    'el script dice que la frase no se puede leer');

  // El mensaje de la frase va seguido de un exit 1 (fail closed).
  const lineas = t.split('\n');
  const iFrase = lineas.findIndex((l) => l.includes('no existe el archivo de frase'));
  assert.ok(iFrase >= 0, 'esta el mensaje de la frase ausente');
  const ventana = lineas.slice(iFrase, iFrase + 6).join('\n');
  assert.match(ventana, /exit 1/,
    'la falta de frase aborta el respaldo con exit 1');
});

test('respaldos · backup-firma.sh aborta si no hay herramienta de cifrado', () => {
  const t = leer('backup-firma.sh');
  assert.match(t, /no hay ninguna herramienta de cifrado disponible/,
    'el script dice que no hay herramienta de cifrado');

  const lineas = t.split('\n');
  const i = lineas.findIndex((l) => l.includes('no hay ninguna herramienta de cifrado'));
  assert.ok(i >= 0);
  const ventana = lineas.slice(i, i + 6).join('\n');
  assert.match(ventana, /exit 1/,
    'sin herramienta de cifrado el script aborta (fail closed)');
});

test('respaldos · la frase no se escribe en el codigo, ni en el log', () => {
  const t = leer('backup-firma.sh');
  const c = codigo(t);
  // La frase se LEE de un archivo; el script no la genera ni la imprime.
  assert.match(t, /FRASE=\$\{KAIR_BACKUP_PASSPHRASE_FILE:-\$BASE\/backup\.passphrase\}/,
    'la frase se lee de un archivo, no esta en el codigo');
  assert.ok(!/echo .*\$\(cat "\$FRASE"\)/.test(c), 'la frase no se imprime');
  assert.ok(!/openssl rand/.test(c),
    'el script NO genera la frase (solo el comentario le dice al operador como generarla)');
  assert.ok(!/FRASE=.*["'][^"']*["']\s*$/m.test(c) || /FRASE=\$\{/.test(c),
    'la frase no esta escrita en el codigo');
});

// =============================================================================
// B. probar-restauracion.sh: descifra antes de abrir y borra el temporal.
// =============================================================================

test('respaldos · probar-restauracion.sh descifra antes de abrir y borra el temporal', () => {
  const t = leer('probar-restauracion.sh');

  // Descifrar ANTES de abrir: el indice de la llamada va antes del
  // integrity_check.
  const iDescifra = t.indexOf('desencriptar "$COPIA"');
  const iAbre = t.indexOf('PRAGMA integrity_check');
  assert.ok(iDescifra > 0, 'el script descifra el respaldo');
  assert.ok(iAbre > 0, 'el script abre el respaldo');
  assert.ok(iDescifra < iAbre, 'primero se descifra y despues se abre');

  // El temporal se borra con trap, pase lo que pase.
  assert.match(t, /trap 'rm -rf "\$WORK"' EXIT/,
    'el temporal descifrado se borra con trap');

  // El selector del "ultimo respaldo" es el del archivo cifrado.
  assert.match(t, /firma-\*\.sqlite\.enc/,
    'el ultimo respaldo se busca entre los archivos cifrados');
  assert.ok(!/firma-\*\.sqlite"/.test(t),
    'no se busca un respaldo en claro');
});

// =============================================================================
// C. purgar-respaldos.sh: existe, es atomico y borra el temporal.
// =============================================================================

test('respaldos · purgar-respaldos.sh existe y reemplaza los archivos de forma atomica', () => {
  const t = leer('purgar-respaldos.sh');

  assert.match(t, /mv -f "\$TMP_ENC" "\$RESPALDO"/,
    'el respaldo se reemplaza con mv (atomico)');
  assert.match(t, /trap 'rm -rf "\$WORK"/,
    'el temporal descifrado se borra con trap');
  assert.match(t, /rm -f "\$TMP_ENC"/,
    'el cifrado temporal tambien se borra');

  // La supresion es a NIVEL DE REGISTRO sobre la copia, no un borrado del
  // archivo de respaldo.
  assert.match(t, /DELETE FROM gh_firmas_electronicas WHERE id\s*=\s*\$fid/,
    'la supresion borra la fila dentro de la copia');
  assert.ok(!/rm -f "\$RESPALDO"/.test(t),
    'el archivo de respaldo no se borra: se re-cifra y se reemplaza');
});

test('respaldos · purgar-respaldos.sh borra el temporal con trap y no deja datos en claro', () => {
  const t = leer('purgar-respaldos.sh');
  assert.match(t, /mktemp -d \/tmp\/kair-purga-XXXXXX/,
    'el trabajo se hace en un temporal privado');
  assert.match(t, /chmod 700 "\$WORK"/,
    'el temporal es privado');
});

// =============================================================================
// D. El hold: la poda no puede violar un deber legal de conservacion.
// =============================================================================

test('respaldos · la poda respeta el hold', () => {
  const backup = leer('backup-firma.sh');
  const purga = leer('purgar-respaldos.sh');

  // La poda mira el hold antes de borrar.
  assert.match(backup, /hold_legal/, 'la poda mira el hold legal');
  assert.match(backup, /PODA RETENIDA/,
    'la poda dice que se retiene cuando hay hold');
  const lineas = backup.split('\n');
  const iConsulta = lineas.findIndex((l) => l.includes('COALESCE(hold_legal,0)=1'));
  const iBorra = lineas.findIndex((l) => l.includes("-mtime +$RETENCION_DIAS -delete"));
  assert.ok(iConsulta >= 0 && iBorra >= 0, 'estan la consulta del hold y la poda');
  assert.ok(iConsulta < iBorra, 'el hold se comprueba ANTES de podar');

  // Y la purga tambien respeta el hold dentro de cada copia.
  assert.match(purga, /hold_legal/,
    'la purga de respaldos tambien comprueba el hold');
  assert.match(purga, /tiene hold vigente/,
    'la purga dice que un hold obligatorio conserva el dato');
});

test('respaldos · la retencion de 30 dias es de COPIAS, no de registros', () => {
  const backup = leer('backup-firma.sh');
  assert.match(backup, /RETENCION DE COPIAS, NO DE REGISTROS/,
    'el script explica que la retencion es de copias');
  assert.match(backup, /fecha_conservacion/,
    'el script distingue el plazo de conservacion del registro');
  assert.match(backup, /hold_legal/,
    'el script nombra el hold');
});

// =============================================================================
// E. legal-readiness.json: el manifiesto tiene que decir la verdad nueva.
// =============================================================================

test('respaldos · legal-readiness.json dice la verdad sobre los respaldos', () => {
  const ruta = path.join(SERVICE, 'legal-readiness.json');
  const texto = fs.readFileSync(ruta, 'utf8');
  const readiness = JSON.parse(texto);

  const respaldos = readiness.infraestructura.respaldos;
  const plan = readiness.infraestructura.plan_continuidad;

  assert.match(respaldos, /cifrad/i, 'los respaldos se declaran cifrados');
  assert.match(respaldos, /COPIAS/, 'la retencion se declara de COPIAS');
  assert.match(respaldos, /nivel de registro/, 'la supresion alcanza a las copias');
  assert.match(respaldos, /fuera del servidor/, 'la frase se conserva fuera del servidor');
  assert.ok(!/con retencion de 30 dias$/.test(respaldos),
    'ya no dice "con retencion de 30 dias" a secas');

  assert.match(plan, /cifrad/i, 'el plan de continuidad dice que se cifra');
  assert.match(plan, /COPIAS/, 'el plan distingue copias de registros');
  assert.match(plan, /hold/i, 'el plan menciona el hold');
  assert.match(plan, /nivel de registro/, 'el plan dice que la supresion llega a las copias');

  // Las dos cadenas que este trabajo toca van en ASCII (el gate compara).
  assert.ok(!/[^\x00-\x7F]/.test(respaldos), 'respaldos en ASCII');
  assert.ok(!/[^\x00-\x7F]/.test(plan), 'plan_continuidad en ASCII');
});

// =============================================================================
// F. Sintaxis de los tres scripts (si hay bash en esta maquina).
// =============================================================================

test('respaldos · los tres scripts tienen sintaxis valida (bash -n)', (t) => {
  const bash = buscarBash();
  if (!bash) {
    t.skip('no hay bash en esta maquina: la sintaxis no se puede comprobar aqui');
    return;
  }
  for (const nombre of ['backup-firma.sh', 'probar-restauracion.sh', 'purgar-respaldos.sh']) {
    const ruta = path.join(DEPLOY, nombre);
    try {
      execFileSync(bash, ['-n', ruta], { stdio: 'pipe' });
    } catch (e) {
      const salida = (e.stderr ? e.stderr.toString() : '') + (e.stdout ? e.stdout.toString() : '');
      throw new Error('bash -n fallo en ' + nombre + ': ' + salida);
    }
  }
});

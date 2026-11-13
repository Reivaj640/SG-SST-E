/**
 * EL MAPA DE LA META SE COMPRUEBA A SI MISMO
 * ==========================================
 *
 * QUE HACE ESTE TEST
 * ------------------
 * El mapa de la meta (`meta-para-abrir-a-empresas-reales-2026-11-12.md`) es
 * un documento que declara el estado de los bloques que el verificador exige.
 * Un documento asi solo sirve si **alguien puede comprobarlo**: de lo contrario
 * es una afirmacion sobre lo que falta, escrita a mano, que se pudre.
 *
 * El mecanismo es `scripts/contar-estados-meta-apertura.js`: el estado va en la
 * clave del encabezado, con una palabra (PROMPT.md §5.30), y la tabla resumen
 * se REGENERA desde el conteo real. Si el documento no cuadra con su propio
 * conteo, el script sale con codigo distinto de 0.
 *
 * LO QUE SE VERIFICA ACA
 * ----------------------
 * - Que el mapa real cuadra (codigo 0) y que el conteo coincide con lo que el
 *   documento declara.
 * - Que se DETECTA un estado que no es una de las cuatro palabras.
 * - Que se DETECTA un bloque que falta.
 * - Que se DETECTA una tabla editada a mano (los numeros que no cuadran con el
 *   conteo).
 * - Que `--escribir` regenera la tabla y que la segunda corrida **no cambia
 *   nada** (es idempotente).
 * - Que **todos** los bloques declaran su origen: un bloque sin origen no es
 *   trazable, y este mapa existe para ser trazado.
 * - Que la TABLA DE SOLICITUDES esta atada al mapa: un bloque que invoca una
 *   solicitud que no existe hace fallar la verificacion, y una solicitud que
 *   no invoca ningun bloque tambien (es un pedido que nadie pidio).
 *
 * - Que las CINCO decisiones del owner estan ESCRITAS en el procedimiento del
 *   canal de `fecha_terminacion`, y que la S-22 este CERRADA. Una decision
 *   que no esta escrita no esta tomada (PROMPT.md 5.41).
 *
 * NADA DE ESTO TOCA EL DOCUMENTO REAL: todas las pruebas trabajan sobre una
 * COPIA en un directorio temporal.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  correr,
  _parsear,
  _parsearSolicitudes,
  SECCIONES,
  RUTA_SOLICITUDES,
} = require('../../scripts/contar-estados-meta-apertura');

/** El mapa real, relativo a este test. */
const MAPA_REAL = path.resolve(
  __dirname, '..', '..', '..', 'docs', 'gestion-humana', 'firma-electronica',
  'meta-para-abrir-a-empresas-reales-2026-11-12.md'
);

/** La tabla de solicitudes real. */
const RUTA_SOLICITUDES_REAL = RUTA_SOLICITUDES;

/**
 * El procedimiento del canal de `fecha_terminacion`, relativo a este test.
 *
 * Es el documento donde el owner escribio las cinco decisiones que la S-22
 * pedia. Si el procedimiento vuelve a quedar sin ellas, la solicitud esta
 * cerrada y la decision no: eso es un verde falso.
 */
const RUTA_PROCEDIMIENTO = path.resolve(
  __dirname, '..', '..', '..', 'docs', 'gestion-humana', 'firma-electronica',
  'procedimiento-canal-fecha-terminacion-2026-10-31.md'
);

/**
 * El documento de la S-23: el pedido al abogado para que valide el
 * procedimiento del canal. Va aparte del escrito de S-01 a S-04 porque no
 * pide una determinacion sino una validacion.
 */
const RUTA_SOLICITUD23 = path.resolve(
  __dirname, '..', '..', '..', 'docs', 'gestion-humana', 'firma-electronica',
  'solicitud-al-abogado-validacion-procedimiento-2026-11-13.md'
);

/**
 * El CONTEXT, relativo a este test.
 *
 * Es el documento que se lee antes de tocar nada, y publica la cifra vigente
 * de solicitudes en su linea viva (la que describe la META). Un guard que
 * busca la cifra en TODO el documento se satisface con una entrada
 * historica: asi es como la linea viva pudo quedar vieja sin que nadie lo
 * viera. Por eso el guard de esta ronda busca la LINEA, no cualquier
 * coincidencia.
 */
const RUTA_CONTEXT = path.resolve(__dirname, '..', '..', '..', 'CONTEXT.md');

/**
 * Copia el mapa a un directorio temporal para poder romperlo sin tocar el
 * documento real.
 * @returns {string} la ruta de la copia.
 */
function copiarMapa() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-apertura-'));
  const destino = path.join(dir, path.basename(MAPA_REAL));
  fs.copyFileSync(MAPA_REAL, destino);
  return destino;
}

/**
 * Cuenta los bloques declarados por el script.
 * @returns {number}
 */
function totalDeclarado() {
  return SECCIONES.reduce((a, s) => a + s.requisitos, 0);
}

/**
 * Cambia el numero de cerrados de la fila TOTAL por uno imposible.
 *
 * La fila se deriva del propio documento, no se escribe a mano: si el mapa
 * cambia de tamaño, el test sigue probando lo que dice probar. Antes
 * llevaba los numeros fijos y, cuando el mapa cambio, el `replace` no
 * encontraba nada: el test de "tabla editada a mano" pasaba en falso y el de
 * idempotencia comprobaba una cadena que nunca se habia escrito.
 *
 * @param {string} texto
 * @returns {{texto: string, alterado: boolean}} el texto alterado y si se
 *   pudo alterar de verdad.
 */
function alterarTotal(texto) {
  const m = /^\| \*\*TOTAL\*\* \| \*\*(\d+)\*\* \|.*$/m.exec(texto);
  if (!m) return { texto: texto, alterado: false };
  const fila = m[0];
  const nueva = fila.replace('**' + m[1] + '**', '**99**');
  return { texto: texto.replace(fila, nueva), alterado: nueva !== fila };
}

test('el mapa real cuadra: el codigo de salida es 0', () => {
  const codigo = correr(MAPA_REAL, false);
  assert.equal(codigo, 0, 'el mapa real debe cuadrar con su propio conteo');
});

test('el mapa tiene todos los bloques que el verificador declara', () => {
  const texto = fs.readFileSync(MAPA_REAL, 'utf8');
  const encontrados = (texto.match(/^###\s+M\.\d+\s+-\s+/gm) || []).length;
  assert.equal(
    encontrados,
    totalDeclarado(),
    'el documento tiene ' + encontrados + ' bloques y el verificador declara ' + totalDeclarado()
  );
});

test('detecta un estado que no es una de las cuatro palabras', () => {
  const copia = copiarMapa();
  try {
    const texto = fs.readFileSync(copia, 'utf8');
    // El estado se altera en el PRIMER bloque, sea el que sea: el mapa ya no
    // tiene ningun "PENDIENTE" (todos se cerraron por solicitud el
    // 13-nov-2026), y una mutacion que no encuentra nada pasa en falso.
    const alterado = texto.replace(/^(###\s+M\.\d+\s+-\s+.*?) — CERRADO/m, '$1 — CASI LISTO');
    assert.notEqual(alterado, texto, 'el mapa tiene que traer un encabezado al que alterarle el estado');
    fs.writeFileSync(copia, alterado, 'utf8');
    const codigo = correr(copia, false);
    assert.notEqual(codigo, 0, 'un estado inventado tiene que hacer fallar la verificacion');
  } finally {
    fs.rmSync(path.dirname(copia), { recursive: true, force: true });
  }
});

test('detecta un bloque que falta', () => {
  const copia = copiarMapa();
  try {
    const texto = fs.readFileSync(copia, 'utf8');
    // Se borra un encabezado y su bloque entero.
    const i = texto.indexOf('### M.1 ');
    const j = texto.indexOf('### M.2 ');
    fs.writeFileSync(copia, texto.slice(0, i) + texto.slice(j), 'utf8');
    const codigo = correr(copia, false);
    assert.notEqual(codigo, 0, 'un bloque faltante tiene que hacer fallar la verificacion');
  } finally {
    fs.rmSync(path.dirname(copia), { recursive: true, force: true });
  }
});

test('detecta una tabla editada a mano', () => {
  const copia = copiarMapa();
  try {
    const texto = fs.readFileSync(copia, 'utf8');
    const r = alterarTotal(texto);
    assert.ok(r.alterado, 'el mapa tiene que traer una fila TOTAL que se pueda alterar');
    fs.writeFileSync(copia, r.texto, 'utf8');
    const codigo = correr(copia, false);
    assert.notEqual(codigo, 0, 'una tabla con numeros escritos a mano tiene que hacer fallar');
  } finally {
    fs.rmSync(path.dirname(copia), { recursive: true, force: true });
  }
});

test('--escribir regenera la tabla y es idempotente', () => {
  const copia = copiarMapa();
  try {
    const texto = fs.readFileSync(copia, 'utf8');
    const r = alterarTotal(texto);
    assert.ok(r.alterado, 'el mapa tiene que traer una fila TOTAL que se pueda alterar');
    fs.writeFileSync(copia, r.texto, 'utf8');
    // La alteracion tiene que estar de verdad en el archivo: si no, la
    // regeneracion no se estaria probando sobre una tabla rota.
    assert.ok(
      fs.readFileSync(copia, 'utf8').indexOf('**99**') >= 0,
      'la tabla de la copia quedo alterada a mano antes de regenerarla'
    );

    correr(copia, true);
    const despues = fs.readFileSync(copia, 'utf8');
    assert.ok(
      despues.indexOf('| **TOTAL** | **99**') < 0,
      'la tabla se regenera desde el conteo real, no desde lo que estaba escrito'
    );
    assert.ok(
      /\| \*\*TOTAL\*\* \| \*\*\d+\*\* \| \*\*\d+\*\* \| \*\*\d+\*\* \| \*\*\d+\*\* \|/.test(despues),
      'la fila de total tiene la forma que el verificador genera'
    );

    const bytesAntes = fs.readFileSync(copia);
    correr(copia, true);
    assert.ok(
      bytesAntes.equals(fs.readFileSync(copia)),
      'la segunda corrida no cambia nada: el verificador es idempotente'
    );
  } finally {
    fs.rmSync(path.dirname(copia), { recursive: true, force: true });
  }
});

test('todos los bloques declaran su origen', () => {
  const texto = fs.readFileSync(MAPA_REAL, 'utf8');
  const partes = texto.split(/^###\s+M\.\d+\s+-\s+/m).slice(1);
  assert.ok(partes.length > 0, 'el mapa tiene bloques');
  partes.forEach((bloque, i) => {
    assert.ok(
      /^\s*\n?[\s\S]*?\*\*Origen\.\*\*/.test(bloque),
      'el bloque ' + (i + 1) + ' no declara su linea de **Origen.**'
    );
  });
});

// ---------------------------------------------------------------- solicitudes

test('la tabla de solicitudes declara 24 filas: 23 EMITIDA y 1 CERRADA, y el mapa las nombra todas', () => {
  const texto = fs.readFileSync(RUTA_SOLICITUDES_REAL, 'utf8');
  const ps = _parsearSolicitudes(texto);
  assert.equal(ps.errores.length, 0, 'la tabla de solicitudes no tiene errores: ' + ps.errores.join('; '));
  assert.equal(ps.solicitudes.length, 24, 'hay 24 solicitudes');
  const estados = {};
  for (const s of ps.solicitudes) estados[s.estado] = (estados[s.estado] || 0) + 1;
  assert.equal(estados.EMITIDA, 23, 'las 23 que nadie ha respondido estan EMITIDA');
  assert.equal(estados.CERRADA, 1, 'la S-22, respondida y aplicada, esta CERRADA');
  assert.equal(estados.RESPONDIDA || 0, 0, 'ninguna quedo en RESPONDIDA: la que se respondio se aplico y se verifico');
  assert.equal(estados.PREPARADA || 0, 0, 'ninguna quedo PREPARADA: las 24 salieron');

  // Cada bloque que dice "CERRADO. Solicitud S-XX" tiene que invocar una
  // solicitud que exista.
  const mapa = fs.readFileSync(MAPA_REAL, 'utf8');
  const bloques = _parsear(mapa).bloques;
  const ids = new Set(ps.solicitudes.map((s) => s.id));
  let conSolicitud = 0;
  for (const b of bloques) {
    for (const id of b.solicitudes) {
      assert.ok(ids.has(id), 'el bloque ' + b.id + ' invoca ' + id + ', que no existe');
    }
    if (b.solicitudes.length) conSolicitud++;
  }
  assert.equal(conSolicitud, 22, 'los 22 bloques cerrados por solicitud invocan su fila');
});

test('la S-23 pide al abogado la validacion del procedimiento, y el documento de ese pedido existe', () => {
  const texto = fs.readFileSync(RUTA_SOLICITUDES_REAL, 'utf8');
  const ps = _parsearSolicitudes(texto);
  const s23 = ps.solicitudes.filter((s) => s.id === 'S-23')[0];
  assert.ok(s23, 'la tabla tiene la fila S-23');
  assert.equal(s23.estado, 'EMITIDA', 'la S-23 esta EMITIDA: el escrito todavia no sale');
  assert.equal(s23.bloque, 'M.31', 'la S-23 es del bloque M.31');

  // El pedido de la S-23 tiene su propio documento, y ese documento declara el
  // insumo con su huella REAL: si el procedimiento cambia, el escrito que se
  // envia declara una huella vieja y hay que volver a medirlo.
  assert.ok(fs.existsSync(RUTA_SOLICITUD23), 'existe el documento de la S-23');
  const doc = fs.readFileSync(RUTA_SOLICITUD23, 'utf8');
  assert.ok(doc.indexOf('5a817b38b504aa1f14cb63e41ff87607d8873587a45235704d318e529131e04e') >= 0,
    'el documento de la S-23 declara la huella del procedimiento que se envia');
  const proc = fs.readFileSync(RUTA_PROCEDIMIENTO);
  const real = require('crypto').createHash('sha256').update(proc).digest('hex');
  assert.equal(real, '5a817b38b504aa1f14cb63e41ff87607d8873587a45235704d318e529131e04e',
    'la huella declarada del procedimiento es la real: si el procedimiento cambia, el escrito se vuelve a medir');
});

test('detecta un bloque que invoca una solicitud que no existe', () => {
  const copia = copiarMapa();
  try {
    const texto = fs.readFileSync(copia, 'utf8');
    const alterado = texto.replace('Solicitud S-01 emitida', 'Solicitud S-99 emitida');
    assert.notEqual(alterado, texto, 'el mapa tiene que traer una solicitud que se pueda cambiar');
    fs.writeFileSync(copia, alterado, 'utf8');
    const codigo = correr(copia, false);
    assert.notEqual(codigo, 0, 'una solicitud inexistente tiene que hacer fallar la verificacion');
  } finally {
    fs.rmSync(path.dirname(copia), { recursive: true, force: true });
  }
});

test('detecta una solicitud huerfana (en la tabla, pero en ningun bloque)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-solicitudes-'));
  const copiaSol = path.join(dir, 'solicitudes.md');
  const texto = fs.readFileSync(RUTA_SOLICITUDES_REAL, 'utf8');
  // Se agrega una fila que no invoca ningun bloque.
  const fila = '| S-99 | M.1 | Nadie | Una solicitud huerfana | Nada | EMITIDA | 2026-11-30 |';
  fs.writeFileSync(copiaSol, texto + '\n' + fila + '\n', 'utf8');
  try {
    const codigo = correr(MAPA_REAL, false, copiaSol);
    assert.notEqual(codigo, 0, 'una solicitud huerfana tiene que hacer fallar la verificacion');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('la frase de conciliacion nombra las solicitudes y dice que cerrado no es acto cumplido', () => {
  const texto = fs.readFileSync(MAPA_REAL, 'utf8');
  assert.ok(texto.indexOf('Las 24 solicitudes de la tabla') >= 0,
    'la frase nombra las solicitudes');
  assert.ok(texto.indexOf('no que el acto este cumplido') >= 0,
    'la frase aclara que cerrado no significa acto cumplido');
  assert.ok(texto.indexOf('23 EMITIDA') >= 0, 'la frase dice cuantas hay emitidas');
  assert.ok(texto.indexOf('1 CERRADA') >= 0, 'la frase dice cuantas hay cerradas');
});

test('las cinco decisiones del owner estan escritas en el procedimiento y la S-22 esta CERRADA', () => {
  const proc = fs.readFileSync(RUTA_PROCEDIMIENTO, 'utf8');

  // Las cinco decisiones: cada una lleva su marca de escrita y su fecha. Se
  // cuenta el fragmento en ASCII puro para no depender de las tildes.
  const marcas = proc.match(/del owner, escrita el 13-nov-2026/g) || [];
  assert.ok(
    marcas.length >= 5,
    'el procedimiento tiene que declarar las cinco decisiones escritas: halladas ' + marcas.length
  );

  // Y ninguna puede seguir marcada como pendiente.
  assert.ok(
    proc.indexOf('operativa pendiente') < 0,
    'el procedimiento ya no puede decir que una decision operativa sigue pendiente'
  );

  // Las anclas de las cinco decisiones: el operador (3.1), el origen de la
  // llamada (3.2) y los dos plazos (5a y 5b).
  assert.ok(proc.indexOf('### 3.1 ') >= 0, 'el procedimiento tiene la seccion 3.1 (quien es el operador)');
  assert.ok(proc.indexOf('### 3.2 ') >= 0, 'el procedimiento tiene la seccion 3.2 (el origen de la llamada)');
  assert.ok(proc.indexOf('X-Admin-Actor') >= 0, 'la decision del operador dice quien queda nombrado');
  assert.ok(proc.indexOf('(a): el plazo') >= 0, 'el procedimiento tiene el plazo maximo de espera (5a)');
  assert.ok(proc.indexOf('(b): la frecuencia') >= 0, 'el procedimiento tiene la frecuencia de revision (5b)');
  assert.ok(proc.indexOf('Treinta (30)') >= 0, 'el plazo maximo de espera esta escrito con su numero');

  // La guia de aceptacion de la evidencia va como Anexo A, con los cuatro
  // datos minimos y un ejemplo.
  assert.ok(proc.indexOf('## Anexo A.') >= 0, 'el procedimiento tiene el Anexo A de la guia de aceptacion');
  assert.ok(proc.indexOf('cuatro datos') >= 0, 'la guia de aceptacion declara los cuatro datos minimos');

  // Y la S-22 esta cerrada en la tabla: respuesta aplicada y verificada.
  const tabla = fs.readFileSync(RUTA_SOLICITUDES_REAL, 'utf8');
  const ps = _parsearSolicitudes(tabla);
  const s22 = ps.solicitudes.filter((s) => s.id === 'S-22')[0];
  assert.ok(s22, 'la tabla tiene la fila S-22');
  assert.equal(s22.estado, 'CERRADA', 'la S-22 esta CERRADA: el owner respondio y se aplico');
});

test('la S-24 registra la firma del owner sobre el procedimiento, y el procedimiento la nombra', () => {
  const tabla = fs.readFileSync(RUTA_SOLICITUDES_REAL, 'utf8');
  const ps = _parsearSolicitudes(tabla);
  const s24 = ps.solicitudes.filter((s) => s.id === 'S-24')[0];
  assert.ok(s24, 'la tabla tiene la fila S-24');
  assert.equal(s24.estado, 'EMITIDA', 'la S-24 esta EMITIDA: la firma todavia no esta');
  assert.equal(s24.bloque, 'M.31', 'la S-24 es del bloque M.31');

  // El procedimiento declara el estado que genera la fila: si el encabezado
  // dijera que ya esta firmado, la S-24 seria una fila de papel.
  const proc = fs.readFileSync(RUTA_PROCEDIMIENTO, 'utf8');
  assert.ok(proc.indexOf('pendiente de firma del owner') >= 0,
    'el procedimiento declara que falta la firma del owner');
});

test('la linea viva del CONTEXT publica la cifra vigente de solicitudes', () => {
  // La cifra sale de la tabla, que es la fuente de la verdad: asi el guard no
  // hay que tocarlo cada vez que el conteo se mueve.
  const tabla = fs.readFileSync(RUTA_SOLICITUDES_REAL, 'utf8');
  const ps = _parsearSolicitudes(tabla);
  const estados = {};
  for (const s of ps.solicitudes) estados[s.estado] = (estados[s.estado] || 0) + 1;
  const total = ps.solicitudes.length;
  const emitidas = estados.EMITIDA || 0;
  const cerradas = estados.CERRADA || 0;

  // Se busca la LINEA VIVA (la que describe la META, la que se lee antes de
  // tocar nada), no cualquier coincidencia del documento: un guard que busca
  // en todo el archivo se satisface con una entrada historica, y asi es como
  // la linea viva quedo vieja (22 solicitudes: 21 EMITIDA y 1 CERRADA) sin que
  // nadie lo viera, con la tabla ya en 23.
  const ctx = fs.readFileSync(RUTA_CONTEXT, 'utf8');
  const marca = ctx.indexOf('**La META (el documento que hay que leer antes de tocar nada).**');
  assert.ok(marca >= 0, 'el CONTEXT describe la META');
  const tramo = ctx.slice(marca, marca + 2500);
  const vigente = '**' + total + ' solicitudes: ' + emitidas + ' `EMITIDA` y ' + cerradas + ' `CERRADA`**';
  assert.ok(tramo.indexOf(vigente) >= 0,
    'la linea viva de la META publica la cifra de la tabla: ' + vigente);
  assert.ok(ctx.indexOf('**22 solicitudes: 21 `EMITIDA` y 1 `CERRADA**') < 0,
    'el CONTEXT ya no publica la cifra de la ronda anterior');
});

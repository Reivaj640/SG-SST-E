#!/usr/bin/env node
/**
 * scripts/correspondencia-texto-codigo.js
 *
 * GENERA la tabla de correspondencia entre el texto del Acuerdo v1.3 y el
 * codigo que lo hace cierto. Es la evidencia que pidio el abogado: para cada
 * numeral, que exige el texto y DONDE vive eso en el codigo.
 *
 * POR QUE SE GENERA Y NO SE ESCRIBE A MANO
 * ----------------------------------------
 * Una tabla escrita a mano se desactualiza en la siguiente version y sigue
 * afirmandolo. Esta se arma buscando cada ancla en el codigo real y poniendo
 * la linea donde esta: si el codigo se mueve, la tabla lo sigue. Y si un
 * ancla NO aparece, la fila queda PENDIENTE a la vista, que es exactamente lo
 * que el abogado necesita ver: lo que el texto promete y el codigo todavia
 * no cumple.
 *
 * Uso:
 *   node scripts/correspondencia-texto-codigo.js
 *   node scripts/correspondencia-texto-codigo.js --salida=ruta.md
 *
 * Exit codes:
 *   0 = tabla generada (puede tener filas PENDIENTE: se reportan)
 *   3 = falta un archivo que el propio script necesita para calcular las huellas
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SERVICE_ROOT, '..');
const SALIDA_DEFAULT = path.join(
  REPO_ROOT, 'docs', 'gestion-humana', 'firma-electronica', 'correspondencia-texto-codigo-v1.3.md'
);

// ---------------------------------------------------------------------------
// Las filas. Cada una: que exige el texto, que ancla lo implementa y que test
// lo prueba. La columna de linea la pone el script, no el autor.
// ---------------------------------------------------------------------------
const FILAS = [
  {
    numeral: '8.6(a)',
    exige: 'El plazo de conservacion se determina por categoria documental, con la precedencia: primero las reglas legales especiales que no pueden rebajarse, luego la tabla de retencion documental de la Empresa y, a falta de plazo declarado por ella, la tabla supletoria de conservacion que administra K+AIR.',
    donde: [
      { archivo: 'src/services/retencion.js', ancla: 'function planificar' },
      { archivo: 'src/services/retencion.js', ancla: 'tabla-conservacion' },
      { archivo: 'src/services/conservacion.js', ancla: 'aplicarPlanRetencion' },
      { archivo: 'config/tabla-conservacion.json', ancla: 'DOCUMENTO_FIRMADO' },
    ],
    test: ['tests/services/conservacion-supletoria.test.js', 'tests/plazo-retencion.test.js'],
  },
  {
    numeral: '8.6(b)',
    exige: 'Los registros del SG-SST del 2.2.4.6.13 se conservan como minimo veinte (20) anos contados desde el cese, y ese minimo no se puede bajar.',
    donde: [
      { archivo: 'src/services/retencion.js', ancla: 'NORMA_SST' },
      { archivo: 'src/services/retencion.js', ancla: "base: 'cese'" },
      { archivo: 'src/services/retencion.js', ancla: 'piso_legal' },
      { archivo: 'config/tabla-conservacion.json', ancla: 'SST_ESPECIAL' },
    ],
    test: ['tests/conservacion-purga.test.js', 'tests/services/conservacion-supletoria.test.js'],
  },
  {
    numeral: '8.6(c)',
    exige: 'El contrato y sus anexos firmados electronicamente se conservan con autenticidad, integridad y disponibilidad; el sistema les asigna un hold mientras subsista la relacion laboral.',
    donde: [
      { archivo: 'src/services/conservacion.js', ancla: 'function ponerHold' },
    ],
    test: 'tests/conservacion-deber-legal.test.js',
  },
  {
    numeral: '8.6(e)',
    exige: 'La supresion procede solo cuando concurren: (i) vencimiento del plazo; (ii) ausencia de deber legal o contractual; (iii) ausencia de solicitud de copia pendiente; y (iv) ausencia de hold vigente.',
    donde: [
      { archivo: 'src/services/conservacion.js', ancla: 'function esElegible' },
      { archivo: 'src/services/conservacion.js', ancla: 'tieneCopiaPendiente' },
    ],
    test: 'tests/conservacion-purga.test.js',
  },  {
    numeral: '8.6(h)',
    exige: 'No hay retencion indefinida: la tabla supletoria fija un plazo por defecto para cada categoria documental, con su fundamento y su punto de inicio; a falta de plazo declarado por la Empresa se aplica ese plazo por defecto, y los plazos legales especiales se aplican por encima del plazo declarado y no se bajan. Un cambio de la tabla no altera los plazos ya calculados: el recalculo exige una operacion expresa, autorizada y auditada.',
    donde: [
      { archivo: 'src/services/retencion.js', ancla: 'tabla-conservacion' },
      { archivo: 'src/services/retencion.js', ancla: 'piso_legal' },
      { archivo: 'src/services/conservacion.js', ancla: 'tabla supletoria' },
      { archivo: 'src/services/conservacion.js', ancla: 'function recalcularPlazosDeclarados' },
      { archivo: 'src/services/conservacion.js', ancla: 'fecha_inicio_conservacion' },
      // La COMPUERTA: la tabla declara su propia activacion, y el codigo la
      // respeta. El mecanismo esta; los plazos de diez (10) y cinco (5) anos
      // no se activan hasta que el abogado los valide.
      { archivo: 'src/services/retencion.js', ancla: 'function _tablaActivada' },
      { archivo: 'config/tabla-conservacion.json', ancla: '"activada": false' },
      // AUSENCIA: el planificador no crea el hold por plazo no declarado. El
      // mecanismo de liberacion se conserva para las filas que ya lo tienen, pero
      // el alta de una firma nueva no lo pone.
      { archivo: 'src/services/retencion.js', ancla: 'plazo_no_declarado', tipo: 'ausencia' },
    ],
    test: ['tests/conservacion-8-6-h.test.js', 'tests/services/conservacion-supletoria.test.js'],
  },
  {
    numeral: '5.1 (deberes del firmante)',
    exige: 'El Firmante ve el Acuerdo que acepta, con su version, y la aceptacion queda registrada contra ese texto.',
    donde: [
      { archivo: 'web/firma/app.js', ancla: 'acuerdo-version' },
      { archivo: 'src/services/publicFlow.js', ancla: 'manifestacion_voluntad' },
      { archivo: 'src/services/publicFlow.js', ancla: 'fecha_manifestacion' },
    ],
    test: 'tests/readiness-legal.test.js',
  },
  {
    numeral: '5.6 (politicas de seguridad)',
    exige: 'Las politicas de seguridad que regulan el uso del mecanismo solo obligan si fueron informadas y puestas a disposicion antes de su aplicacion: el sistema muestra la version junto con el texto y registra el texto aceptado, su huella SHA-256 y la fecha y hora. Una version nueva no altera las aceptaciones ya registradas.',
    donde: [
      { archivo: 'web/firma/app.js', ancla: 'acuerdo.texto_hash' },
      { archivo: 'src/services/publicFlow.js', ancla: 'hash_texto_acuerdo' },
      { archivo: 'src/services/publicFlow.js', ancla: 'manifestacion_voluntad_hash' },
    ],
    test: 'tests/readiness-legal.test.js',
  },
  {
    numeral: '10.6 (precedencia de plazos)',
    exige: 'Los plazos se determinan por categoria, con la precedencia del 8.6(a): el plazo que declare la Empresa y, a falta de plazo declarado por ella, el plazo por defecto de la tabla supletoria que administra K+AIR.',
    donde: [
      { archivo: 'src/services/conservacion.js', ancla: 'aplicarPlanRetencion' },
      { archivo: 'src/services/conservacion.js', ancla: 'plazo_conservacion_fuente' },
      { archivo: 'src/services/retencion.js', ancla: 'tabla supletoria' },
    ],
    test: ['tests/services/conservacion-supletoria.test.js', 'tests/conservacion-purga.test.js'],
  },
  {
    numeral: '3.6(g) (bitacora)',
    exige: 'El registro de eventos del servicio esta protegido en la base de datos con disparadores que impiden las sentencias de actualizacion y de eliminacion: es de solo anexado.',
    donde: [
      { archivo: 'src/db/schema/020_eventos_append_only.sql', ancla: 'CREATE TRIGGER' },
    ],
    test: 'tests/eventos-append-only.test.js',
  },
  {
    numeral: '3.6(g) (lapida y recibo)',
    exige: 'La supresion dentro de la ventana de purga da lugar a una lapida que identifica la solicitud, la fecha y hora, las categorias suprimidas y el fundamento del plazo, y a un recibo que la Empresa entrega al Trabajador si lo solicita.',
    donde: [
      { archivo: 'src/services/supresion.js', ancla: 'gh_firma_purgadas' },
      { archivo: 'src/services/supresion.js', ancla: 'gh_firma_purga_registro' },
      { archivo: 'src/services/reciboSupresion.js', ancla: 'porSolicitud' },
    ],
    test: 'tests/recibo-supresion.test.js',
  },
  {
    numeral: '3.6(g) (retencion)',
    exige: 'Mientras subsista un deber legal o contractual de conservacion, el registro queda retenido por esa razon y no se suprime.',
    donde: [
      { archivo: 'src/services/conservacion.js', ancla: 'function ponerHold' },
      { archivo: 'src/services/conservacion.js', ancla: 'function liberarHold' },
    ],
    test: 'tests/conservacion-deber-legal.test.js',
  },
  {
    numeral: '10.5(d)',
    exige: 'Los registros de auditoria no se alteran; su supresion en la ventana de purga deja la lapida y el recibo del 3.6(g) y no afecta la prueba de aceptacion del 12.7.',
    donde: [
      { archivo: 'src/db/schema/020_eventos_append_only.sql', ancla: 'CREATE TRIGGER' },
      { archivo: 'src/services/readinessLegal.js', ancla: 'codigo_20' },
    ],
    test: 'tests/readiness-legal.test.js',
  },
  {
    numeral: '12.7',
    exige: 'La prueba de aceptacion se sujeta al plazo que declare la Empresa y, a falta de plazo declarado, al plazo por defecto de la tabla supletoria que administra K+AIR.',
    donde: [
      { archivo: 'src/services/supresion.js', ancla: 'pruebaAceptacion' },
    ],
    test: 'tests/recibo-supresion.test.js',
  },
  {
    numeral: '10.8(a)',
    exige: 'La Empresa declara, de manera expresa y por cada documento, que el documento que entrega a firma no contiene datos sensibles de salud; esa declaracion es obligatoria para crear la solicitud y queda atada a la huella del PDF.',
    donde: [
      { archivo: 'src/services/declaracionSalud.js', ancla: 'DECLARACION_SALUD' },
      { archivo: 'src/services/publicFlow.js', ancla: 'function resolverDatoSensible' },
    ],
    test: 'tests/datos-sensibles.test.js',
  },
  {
    numeral: '10.8(d)(i) bloqueo',
    exige: 'Ante una carga accidental, K+AIR bloquea la solicitud y su enlace de firma, de modo que no pueda firmarse ni reimprimirse, y lo deja retenido mientras se resuelve el reporte.',
    donde: [
      { archivo: 'src/services/incidenteSalud.js', ancla: 'INCIDENTE_DATOS_SENSIBLES' },
    ],
    test: ['tests/services/incidente-datos-sensibles.test.js', 'tests/datos-sensibles.test.js'],
  },
  {
    numeral: '10.8(d)(iii) registro',
    exige: 'El reporte queda en el registro de eventos del servicio, con fecha y hora, quien lo reporta, la causa invocada y las medidas adoptadas.',
    donde: [
      { archivo: 'src/services/incidenteSalud.js', ancla: 'INCIDENTE_DATOS_SENSIBLES' },
      { archivo: 'src/services/pdfGen.js', ancla: 'INCIDENTE_DATOS_SENSIBLES' },
    ],
    test: ['tests/services/incidente-datos-sensibles.test.js', 'tests/datos-sensibles.test.js'],
  },
  {
    numeral: '10.8(d)(iv) notificacion',
    exige: 'K+AIR avisa a la Empresa por su canal de incidentes y la informa de que la solicitud quedo bloqueada.',
    donde: [
      { archivo: 'src/services/mailer.js', ancla: 'canal_incidentes' },
    ],
    test: ['tests/services/incidente-datos-sensibles.test.js', 'tests/datos-sensibles.test.js'],
  },
  {
    numeral: '10.8(d)(v) supresion',
    exige: 'Resuelto el reporte, el documento y sus derivados se suprimen conforme al 8.6, con la lapida y el recibo del 3.6(g).',
    donde: [
      { archivo: 'src/services/supresion.js', ancla: 'function suprimir' },
      { archivo: 'src/services/incidenteSalud.js', ancla: 'liberarHold' },
    ],
    test: ['tests/services/incidente-datos-sensibles.test.js', 'tests/datos-sensibles.test.js'],
  },
  {
    numeral: '1.2 (pantalla)',
    exige: 'En la pantalla de firma se muestra el tipo de documento del representante legal y sus ultimos cuatro (4) digitos, no el numero completo de la identificacion.',
    donde: [
      { archivo: 'src/services/representante.js', ancla: 'function numeroEnmascarado' },
      { archivo: 'src/services/empresa.js', ancla: 'numeroEnmascarado' },
      { archivo: 'src/services/empresa.js', ancla: 'representante_legal_identificacion: snap.datos.representante_legal_identificacion', tipo: 'ausencia' },
      { archivo: 'web/firma/app.js', ancla: 'representante_legal_identificacion' },
    ],
    test: ['tests/services/empresa-documento-representante.test.js', 'tests/ultimos4-constancia.test.js'],
  },
  {
    numeral: '3.4(e) (buzon corporativo)',
    exige: 'El sistema comprueba si el medio al que va a salir el codigo pertenece a un dominio que la Empresa pueda leer; ese control es incondicional y no existe ninguna opcion que lo desactive.',
    donde: [
      { archivo: 'src/services/publicFlow.js', ancla: '_controlarMedioCorporativo' },
    ],
    test: 'tests/d02-medio-otp.test.js',
  },
  {
    numeral: '3.4(e) y 10.5(f) (aviso OTP)',
    exige: 'El aviso OTP_MEDIO_CORPORATIVO no puede corregirse ni alterarse, pero SI se suprime en la ventana del 8.6, con la lapida y el recibo del 3.6(g).',
    donde: [
      { archivo: 'src/services/readinessLegal.js', ancla: 'OTP_MEDIO_CORPORATIVO' },
      { archivo: 'src/services/supresion.js', ancla: 'gh_firma_purgadas' },
    ],
    test: 'tests/recibo-supresion.test.js',
  },
];

// ---------------------------------------------------------------------------

function lineaDe(archivoRel, ancla) {
  const abs = path.join(SERVICE_ROOT, archivoRel);
  if (!fs.existsSync(abs)) return { ok: false, motivo: 'el archivo no existe' };
  const lineas = fs.readFileSync(abs, 'utf8').split('\n');
  for (let i = 0; i < lineas.length; i++) {
    if (lineas[i].indexOf(ancla) >= 0) return { ok: true, linea: i + 1, ruta: archivoRel };
  }
  return { ok: false, motivo: 'el ancla no aparece en el archivo' };
}

// ---------------------------------------------------------------------------

function sha256De(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function main() {
  const args = process.argv;
  let salida = SALIDA_DEFAULT;
  for (let i = 2; i < args.length; i++) {
    if (args[i].startsWith('--salida=')) salida = path.resolve(args[i].slice('--salida='.length).trim());
  }

  const acuerdo = path.join(SERVICE_ROOT, 'scripts', 'fixtures', 'acuerdo-v1.3.txt');
  const anexo = path.join(REPO_ROOT, 'legal', 'anexo-encargo.html');
  if (!fs.existsSync(acuerdo) || !fs.existsSync(anexo)) {
    console.error('Faltan los archivos de los que se sacan las huellas.');
    process.exit(3);
  }
  const hAcuerdo = sha256De(acuerdo);
  const hAnexo = sha256De(anexo);
  const fecha = new Date().toISOString().slice(0, 10);

  let pendientes = 0;
  const cuerpo = [];
  cuerpo.push('# Correspondencia texto <-> codigo — Acuerdo v1.3');
  cuerpo.push('');
  cuerpo.push('> **Generado, no escrito a mano.** Lo produce `firma-service/scripts/correspondencia-texto-codigo.js`,');
  cuerpo.push('> que busca cada ancla en el codigo real y pone la linea donde esta. Si un ancla no aparece, la');
  cuerpo.push('> fila queda **PENDIENTE** a la vista: eso es lo que el texto promete y el codigo todavia no');
  cuerpo.push('> cumple. Una tabla escrita a mano se desactualiza y sigue afirmandolo; esta no.');
  cuerpo.push('');
  cuerpo.push('| Documento | SHA-256 |');
  cuerpo.push('|---|---|');
  cuerpo.push('| Acuerdo de uso v1.3 | `' + hAcuerdo + '` |');
  cuerpo.push('| Anexo de Encargo | `' + hAnexo + '` |');
  cuerpo.push('');
  cuerpo.push('Generada el ' + fecha + '.');
  cuerpo.push('');
  cuerpo.push('## Como leer esta tabla');
  cuerpo.push('');
  cuerpo.push('Cada fila es un numeral del Acuerdo y lo que el texto exige de ese numeral. La columna');
  cuerpo.push('*Donde vive en el codigo* da el archivo y la linea, con la forma `archivo:linea`. La columna');
  cuerpo.push('*Estado* dice si el ancla se encontro.');
  cuerpo.push('');
  cuerpo.push('- **Implementado**: el ancla esta en el codigo, en la linea que se indica.');
  cuerpo.push('- **PENDIENTE**: el ancla no se encontro. El texto promete algo que el codigo todavia no hace.');
  cuerpo.push('');
  cuerpo.push('Hay dos tipos de control. El de **presencia** comprueba que la implementacion esta (el ancla');
  cuerpo.push('tiene que aparecer). El de **ausencia** comprueba que lo que el texto prohibe no esta (el ancla');
  cuerpo.push('tiene que NO aparecer). El control de ausencia es el que distingue "el texto esta escrito en el');
  cuerpo.push('codigo" de "el codigo hace lo que el texto dice": sin el, una fila podria dar por bueno un');
  cuerpo.push('comportamiento que el propio codigo contradice.');
  cuerpo.push('');
  cuerpo.push('Limite del metodo, dicho de una vez: el control es textual. Que el ancla aparezca prueba que');
  cuerpo.push('la forma prohibida no esta; no prueba por si solo que la forma nueva sea la correcta. Por eso');
  cuerpo.push('cada fila lista tambien la presencia del comportamiento que la reemplaza.');
  cuerpo.push('');
  cuerpo.push('| Numeral | Que exige el texto | Donde vive en el codigo | Que lo prueba | Estado |');
  cuerpo.push('|---|---|---|---|---|');

  FILAS.forEach(function (f) {
    const bases = [];
    let falta = false;
    f.donde.forEach(function (d) {
      // tipo 'presencia': el ancla TIENE que estar (el comportamiento existe).
      // tipo 'ausencia': el ancla NO tiene que estar (el texto prohibe que
      // exista). Que el ancla aparezca es, en ese caso, un incumplimiento.
      const tipo = d.tipo || 'presencia';
      const r = lineaDe(d.archivo, d.ancla);
      if (tipo === 'ausencia') {
        if (r.ok) {
          falta = true;
          bases.push('`' + d.archivo + ':' + r.linea + '` — **el texto prohibe esto y sigue aqui**');
        } else {
          bases.push('`' + d.archivo + '` — correcto: no expone el dato crudo');
        }
        return;
      }
      if (r.ok) bases.push('`' + d.archivo + ':' + r.linea + '`');
      else { falta = true; bases.push('`' + d.archivo + '` — ' + r.motivo); }
    });
    const tests = Array.isArray(f.test) ? f.test : [f.test];
    const testCeldas = tests.map(function (t) {
      return fs.existsSync(path.join(SERVICE_ROOT, t)) ? '`' + t + '`' : '`' + t + '` — **NO EXISTE**';
    });
    const testFalta = tests.some(function (t) { return !fs.existsSync(path.join(SERVICE_ROOT, t)); });
    const testCelda = testCeldas.join('<br>');
    if (testFalta) falta = true;
    if (falta) pendientes++;
    cuerpo.push('| **' + f.numeral + '** | ' + f.exige + ' | ' + bases.join('<br>') + ' | ' + testCelda + ' | '
      + (falta ? '**PENDIENTE**' : 'Implementado') + ' |');
  });

  cuerpo.push('');
  cuerpo.push('## Resumen');
  cuerpo.push('');
  cuerpo.push('- Filas: ' + FILAS.length);
  cuerpo.push('- Implementadas: ' + (FILAS.length - pendientes));
  cuerpo.push('- Pendientes: ' + pendientes);
  cuerpo.push('');
  if (pendientes) {
    cuerpo.push('Las filas **PENDIENTE** son las que el texto de la v1.3 promete y que el codigo todavia no');
    cuerpo.push('hace cierto. Son la lista de trabajo que queda, no un defecto de esta tabla.');
    cuerpo.push('');
  }
  cuerpo.push('El texto que estas filas citan se arma desde la v1.0 sellada con');
  cuerpo.push('`scripts/empalmar-acuerdo-v1.1.js --version=v1.3 --cambios=scripts/fixtures/acuerdo-v1.3-cambios.json`.');
  cuerpo.push('');
  cuerpo.push('La v1.3 cambio la regla de conservacion: la retencion indefinida por falta de plazo declarado');
  cuerpo.push('desaparecio y la sustituyo la tabla supletoria que administra K+AIR. Las filas del 8.6 lo');
  cuerpo.push('comprueban con controles de AUSENCIA: el ancla prohibida tiene que NO aparecer.');
  cuerpo.push('');
  cuerpo.push('## La compuerta de activacion (estado real de los plazos de la tabla)');
  cuerpo.push('');
  cuerpo.push('El MECANISMO que pide el 8.6 esta construido y probado. Lo que NO esta hecho es su');
  cuerpo.push('ACTIVACION, y es deliberado:');
  cuerpo.push('');
  cuerpo.push('- La tabla supletoria declara su propia activacion en `config/tabla-conservacion.json`');
  cuerpo.push('  (`aplicacion.activada`), y el codigo la lee y la respeta: no hay forma de que el sistema');
  cuerpo.push('  aplique sus plazos sin que esa fuente legal lo autorice.');
  cuerpo.push('- Con la compuerta CERRADA (que es como viene), el plazo por defecto que aplica el sistema');
  cuerpo.push('  es el de custodia del catalogo (veinte (20) anos desde la firma), que es el que estaba en');
  cuerpo.push('  vigor. La fuente queda registrada en la fila como `catalogo_sistema`.');
  cuerpo.push('- Las EXCEPCIONES LEGALES no dependen de la tabla y siguen aplicando con la compuerta');
  cuerpo.push('  cerrada: el piso de veinte (20) anos desde el cese de los registros del 8.6(b), y el hold');
  cuerpo.push('  sin termino del contrato del 8.6(c).');
  cuerpo.push('- Abrir la compuerta es un acto expreso del owner, con la validacion escrita del abogado sobre');
  cuerpo.push('  los plazos de diez (10) y cinco (5) anos. Ni el codigo ni una actualizacion automatica lo');
  cuerpo.push('  hacen.');
  cuerpo.push('');
  cuerpo.push('La razon es juridica, no tecnica: el Acuerdo vigente en produccion es la v1.0, cuyo 8.6');
  cuerpo.push('remite a la tabla de retencion documental de la Empresa y no describe estos plazos. Aplicar');
  cuerpo.push('en produccion un plazo que el Acuerdo en vigor no dice seria exactamente el defecto que el');
  cuerpo.push('texto no puede prometer lo que el codigo no cumple.');
  cuerpo.push('');

  fs.writeFileSync(salida, cuerpo.join('\n'), 'utf8');
  console.log('Tabla generada: ' + salida);
  console.log('  filas: ' + FILAS.length + ' | implementadas: ' + (FILAS.length - pendientes) + ' | pendientes: ' + pendientes);
  if (pendientes) {
    console.log('\n  Las pendientes son las que el texto promete y el codigo no cumple todavia.');
    console.log('  Se listan como PENDIENTE en el documento, no se inventan.');
  }
}

main();

#!/usr/bin/env node
/**
 * scripts/correspondencia-texto-codigo.js
 *
 * GENERA la tabla de correspondencia entre el texto del Acuerdo y el codigo
 * que lo hace cierto. Es la evidencia que pidio el abogado: para cada
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
 *   node scripts/correspondencia-texto-codigo.js --version=v1.4
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
    numeral: '8.6(b) y Anexo de Encargo 6 (canal de la fecha de terminacion)',
    exige: 'La Empresa comunica al Encargado la fecha de terminacion de la relacion laboral por el canal habilitado en el servicio, con su evidencia; el Encargado registra la fecha, recalcula el plazo de las filas afectadas y deja registro de la operacion. Mientras la fecha no se reciba, la fila permanece retenida, no se calcula fecha de supresion y se revisa periodicamente.',
    donde: [
      { archivo: 'src/services/fechaTerminacion.js', ancla: 'function registrar' },
      { archivo: 'src/services/fechaTerminacion.js', ancla: 'gh_firma_fecha_terminacion' },
      { archivo: 'src/services/fechaTerminacion.js', ancla: 'function pendientes' },
      { archivo: 'src/db/schema/052_fecha_terminacion_canal.sql', ancla: 'gh_firma_fecha_terminacion_eventos' },
      { archivo: 'src/db/schema/053_fecha_terminacion_append_only.sql', ancla: 'CREATE TRIGGER' },
      { archivo: 'src/routes/admin-empresas.js', ancla: '/fecha-terminacion' },
      // El RECALCULO ACOTADO: la comunicacion de un trabajador no mueve los
      // plazos de los demas.
      { archivo: 'src/services/conservacion.js', ancla: 'opciones.firmas' },
    ],
    test: 'tests/fecha-terminacion-canal.test.js',
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
      // respeta. Desde el 13-nov-2026 la abre el owner con un acto expreso y
      // fechado (la S-25), sin que la validacion escrita de un tercero sea
      // requisito: el estado vigente es `activada: true` con su `activado_at`.
      // Si ese estado cambia, esta fila hay que actualizarla: la tabla de
      // correspondencia no puede mentir en silencio.
      { archivo: 'src/services/retencion.js', ancla: 'function _tablaActivada' },
      { archivo: 'config/tabla-conservacion.json', ancla: '"activada": true' },
      { archivo: 'config/tabla-conservacion.json', ancla: '"activado_at"' },
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
    // C-2 del abogado (30-oct-2026) y el ordinal 3 de la Manifestacion de
    // Voluntad: la matriz de finalidades delimita el alcance de la
    // autorizacion del Titular. Se pone a disposicion ANTES de habilitar la
    // casilla de aceptacion, con su version y su huella.
    numeral: '3.6(b) (matriz de finalidades)',
    exige: 'El ordinal 3 de la Manifestacion de Voluntad delega en la matriz de finalidades el alcance de la autorizacion del Titular. La matriz se pone a disposicion del Firmante ANTES de habilitar la casilla de aceptacion, con su version y su huella SHA-256; si la matriz no llega o no se lee, la casilla no se habilita y no hay forma de aceptar sin ella.',
    donde: [
      { archivo: 'web/firma/app.js', ancla: 'renderMatrizFinalidades' },
      { archivo: 'web/firma/app.js', ancla: 'leidoMatriz' },
      { archivo: 'src/services/publicFlow.js', ancla: 'registrarPuestaEnDisposicionPoliticas' },
      { archivo: 'src/services/matrizFinalidades.js', ancla: 'textoParaFirmante' },
    ],
    test: ['tests/services/aceptacion-c2-matriz.test.js', 'tests/web/matriz-finalidades.test.js'],
  },
  {
    // C-1 del abogado (30-oct-2026), con la decision C del owner del
    // 5-nov-2026: la compuerta se ENCIENDE y la Empresa tiene un canal
    // propio para suscribir el Anexo de Nube.
    numeral: '3.6(h) (Anexo de Nube suscrito por la Empresa)',
    exige: 'Si la Empresa no ha suscrito el Anexo de Nube, el servicio no permite crear solicitudes de firma y no puede emitirse Constancia sobre un modelo sin firmar. La regla va detras de la compuerta exigirAnexoNube, que el owner decidio ENCENDER el 5-nov-2026 con un orden obligatorio: publicar el Anexo de Nube v1.1, que la Empresa activa lo suscriba, encender la variable y solo entonces publicar el Acuerdo v1.4. La suscripcion se registra con version, huella SHA-256 y evidencia (fecha, correo, IP y navegador), en un rastro append-only; el texto que se suscribe es el del servidor y si cambia antes de la firma la suscripcion se rechaza. El preflight del despliegue aborta si no hay ninguna Empresa activa con el Anexo suscrito sobre el texto vigente: la excepcion auditable de habilitacion NO levanta ese bloqueo.',
    donde: [
      { archivo: 'src/services/empresa.js', ancla: 'anexo_nube_firmado' },
      { archivo: 'src/services/empresa.js', ancla: 'exigirAnexoNube' },
      { archivo: 'src/config.js', ancla: 'exigirAnexoNube' },
      { archivo: 'src/services/manifiestoLegal.js', ancla: 'nube.firmado' },
      { archivo: 'src/services/anexoNube.js', ancla: 'function suscribir' },
      { archivo: 'src/services/anexoNube.js', ancla: 'TEXTO_MODIFICADO' },
      { archivo: 'src/services/anexoNube.js', ancla: 'marcarAnexoNubeFirmado' },
      { archivo: 'src/routes/anexoNube.js', ancla: '/anexo-nube/documento' },
      { archivo: 'src/db/schema/054_anexo_nube_suscripcion.sql', ancla: 'gh_firma_anexo_nube_suscripciones' },
      { archivo: 'src/db/schema/055_anexo_nube_eventos_append_only.sql', ancla: 'trg_anexo_nube_eventos_no_update' },
      { archivo: 'scripts/preflight-anexo-nube.js', ancla: 'con_anexo_nube_vigente' },
    ],
    test: ['tests/d03-habilitacion-empresa.test.js', 'tests/routes/constancia-publica.test.js', 'tests/anexo-nube-suscripcion.test.js', 'tests/routes/anexo-nube-documento.test.js'],
  },
  {
    numeral: '9.2 (alcance de la aceptacion)',
    exige: 'La aceptacion registra la version y la huella SHA-256 del Anexo de Encargo y del Anexo de Nube suscritos por esa Empresa, y la version y la huella de la matriz que delimita el alcance de la autorizacion. Se registra lo que el Firmante vio, no lo que despues se edite en el archivo.',
    donde: [
      { archivo: 'src/services/publicFlow.js', ancla: 'anexo_encargo_version' },
      { archivo: 'src/services/publicFlow.js', ancla: 'anexo_nube_version' },
      { archivo: 'src/db/schema/051_alcance_aceptacion.sql', ancla: 'anexo_nube_hash' },
      { archivo: 'src/db/schema/051_alcance_aceptacion.sql', ancla: 'matriz_hash' },
    ],
    test: 'tests/services/aceptacion-c2-matriz.test.js',
  },
  {
    numeral: '9.6 y 5.6 (medio y fecha de puesta a disposicion)',
    exige: 'El sistema registra el MEDIO por el que se puso a disposicion la informacion y la FECHA de esa puesta a disposicion, y deja el evento que la deja trazada. Sin esa fecha no hay constancia de cuando se cumplio el deber de informacion.',
    donde: [
      { archivo: 'src/services/publicFlow.js', ancla: 'medio_disposicion' },
      { archivo: 'src/services/publicFlow.js', ancla: 'fecha_disposicion' },
      { archivo: 'src/services/publicFlow.js', ancla: 'POLITICAS_PUESTAS_A_DISPOSICION' },
    ],
    test: 'tests/services/aceptacion-c2-matriz.test.js',
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
  let version = 'v1.3';
  let salida = null;
  for (let i = 2; i < args.length; i++) {
    if (args[i].startsWith('--salida=')) salida = path.resolve(args[i].slice('--salida='.length).trim());
    else if (args[i].startsWith('--version=')) {
      version = args[i].slice('--version='.length).trim();
    }
  }
  if (!salida) {
    salida = path.join(
      REPO_ROOT, 'docs', 'gestion-humana', 'firma-electronica',
      'correspondencia-texto-codigo-' + version + '.md'
    );
  }

  const acuerdo = path.join(SERVICE_ROOT, 'scripts', 'fixtures', 'acuerdo-' + version + '.txt');
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
  cuerpo.push('# Correspondencia texto <-> codigo — Acuerdo ' + version);
  cuerpo.push('');
  cuerpo.push('> **Generado, no escrito a mano.** Lo produce `firma-service/scripts/correspondencia-texto-codigo.js`,');
  cuerpo.push('> que busca cada ancla en el codigo real y pone la linea donde esta. Si un ancla no aparece, la');
  cuerpo.push('> fila queda **PENDIENTE** a la vista: eso es lo que el texto promete y el codigo todavia no');
  cuerpo.push('> cumple. Una tabla escrita a mano se desactualiza y sigue afirmandolo; esta no.');
  cuerpo.push('');
  cuerpo.push('| Documento | SHA-256 |');
  cuerpo.push('|---|---|');
  cuerpo.push('| Acuerdo de uso ' + version + ' | `' + hAcuerdo + '` |');
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
    cuerpo.push('Las filas **PENDIENTE** son las que el texto de la ' + version + ' promete y que el codigo todavia no');
    cuerpo.push('hace cierto. Son la lista de trabajo que queda, no un defecto de esta tabla.');
    cuerpo.push('');
  }
  cuerpo.push('El texto que estas filas citan se arma desde la v1.0 sellada con');
  cuerpo.push('`scripts/empalmar-acuerdo-v1.1.js --version=' + version + ' --cambios=scripts/fixtures/acuerdo-' + version + '-cambios.json`.');
  cuerpo.push('');
  cuerpo.push('La v1.3 cambio la regla de conservacion: la retencion indefinida por falta de plazo declarado');
  cuerpo.push('desaparecio y la sustituyo la tabla supletoria que administra K+AIR. Las filas del 8.6 lo');
  cuerpo.push('comprueban con controles de AUSENCIA: el ancla prohibida tiene que NO aparecer.');
  cuerpo.push('');
  cuerpo.push('## La compuerta de activacion (estado real de los plazos de la tabla)');
  cuerpo.push('');
  cuerpo.push('El MECANISMO que pide el 8.6 esta construido y probado, y su ACTIVACION');
  cuerpo.push('ya esta hecha: el owner la abrio con un acto expreso y fechado el 13-nov-2026');
  cuerpo.push('(la S-25), sin que la validacion escrita de un tercero sea requisito:');
  cuerpo.push('');
  cuerpo.push('- La tabla supletoria declara su propia activacion en `config/tabla-conservacion.json`');
  cuerpo.push('  (`aplicacion.activada`), y el codigo la lee y la respeta: no hay forma de que el sistema');
  cuerpo.push('  aplique sus plazos sin que esa fuente legal lo autorice.');
  cuerpo.push('- Con la compuerta ABIERTA (que es como viene desde el acto del owner del 13-nov-2026),');
  cuerpo.push('  el sistema aplica el plazo por defecto de la tabla: se calcula la fecha de supresion y la');
  cuerpo.push('  fuente que queda registrada en la fila es `tabla_supletoria`. El catalogo legado de veinte');
  cuerpo.push('  (20) anos desde la firma se retiro y no aplica para nada.');
  cuerpo.push('- La rama CERRADA sigue viva en el codigo: con la compuerta cerrada el sistema NO aplica el');
  cuerpo.push('  plazo por defecto, el registro queda retenido con el hold tabla_supletoria_pendiente_validacion');
  cuerpo.push('  y no se calcula fecha de supresion.');
  cuerpo.push('- Las EXCEPCIONES LEGALES no dependen de la tabla: el piso de veinte (20) anos desde el cese');
  cuerpo.push('  de los registros del 8.6(b), y el hold sin termino del contrato del 8.6(c).');
  cuerpo.push('- Abrir la compuerta es (y fue) un acto expreso y FECHADO del owner: `aplicacion.activada` en');
  cuerpo.push('  true y `aplicacion.activado_at` con la fecha del acto (2026-11-13, la S-25). Ni el codigo ni');
  cuerpo.push('  una actualizacion automatica lo hacen. La validacion escrita de un tercero NO es requisito');
  cuerpo.push('  (decision del owner del 13-nov-2026): el codigo no la exige, y nunca exigio el nombre de un');
  cuerpo.push('  abogado.');
  cuerpo.push('');
  cuerpo.push('El Acuerdo vigente en produccion es la v1.6 (publicada y activa desde el 11-nov-2026) y su');
  cuerpo.push('numeral 8.6(a) SI describe esta tabla: la administra K+AIR, es configurable, cada regla ha de');
  cuerpo.push('tener fundamento y punto de inicio, se publica en el Anexo de Encargo y un cambio en ella no');
  cuerpo.push('altera los plazos ya calculados. La tabla cumple los cuatro requisitos. El numeral no exige');
  cuerpo.push('una validacion escrita de un tercero, y por eso la compuerta tampoco.');
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

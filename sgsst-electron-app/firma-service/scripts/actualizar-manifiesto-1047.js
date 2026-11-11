#!/usr/bin/env node
/**
 * scripts/actualizar-manifiesto-1047.js
 *
 * Deja el manifiesto `legal-readiness.json` describiendo el estado del canal de
 * correo despues de la migracion a Google Workspace con CDPA (Decision A del
 * 9-nov-2026).
 *
 * POR QUE UN SCRIPT Y NO UNA EDICION A MANO
 * ----------------------------------------
 * El manifiesto es la SALIDA de este script, no un archivo que se edita a
 * mano. Sus huellas se recalculan desde los archivos reales: si un documento no
 * existe, el script se niega a escribir. Ademas exige que las dos copias de
 * cada HTML (`legal/` y `sitio/`) sean byte a byte iguales: dos copias
 * distintas son dos textos, y un manifiesto que declara una sola huella no
 * puede declarar dos.
 *
 * El manifiesto es ASCII PURO y su formato es exactamente
 * `JSON.stringify(obj, null, 2) + "\n"` con los caracteres fuera de ASCII
 * escapados en \uXXXX. Eso permite editarlo sobre el OBJETO (structural) y
 * devolverlo con el mismo formato: el diff sale minimo y legible, y no depende
 * de que un literal aparezca exactamente una vez en el texto.
 *
 * LO QUE ESTE SCRIPT NO HACE
 * --------------------------
 * - No declara ninguna firma que no exista. Si el Anexo de Nube vigente o el
 *   Anexo de Encargo vigente no estan suscritos, el manifiesto dice que no
 *   lo estan y guarda la suscripcion anterior en `versiones_firmadas`.
 * - No declara que el CDPA este aceptado por la cuenta: eso lo verifica el
 *   owner en la consola de Workspace y lo registra en
 *   `subencargados.mail_provider.aceptacion`. Y lo que este script hace con
 *   ese bloque es CONSERVARLO: lo escribe
 *   `scripts/actualizar-manifiesto-aceptacion-cdpa.js` desde un acta. Si el
 *   1047 escribiera el estado pendiente por su cuenta, cada corrida borraria
 *   una aceptacion ya registrada.
 * - No cambia los canales de derechos, PQRS ni incidentes: no estan
 *   verificados. La excepcion queda ESCRITA, con motivo y responsable.
 *
 * USO
 * ---
 *   node scripts/actualizar-manifiesto-1047.js
 *   node scripts/actualizar-manifiesto-1047.js --check
 *
 * Exit codes:
 *   0 = manifiesto actualizado (o verificado, con --check)
 *   2 = error de uso
 *   3 = error: falta un documento, las copias difieren, el manifiesto no es
 *       JSON, o un valor no se puede calcular
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = path.resolve(SERVICE_ROOT, '..');
const REPO_ROOT = path.resolve(APP_ROOT, '..');
const MANIFIESTO = path.join(SERVICE_ROOT, 'legal-readiness.json');

const FECHA = '2026-11-11';
const VERSION_NUBE = '1.3';
const VERSION_ENCARGO = '2026-11-11';

// La fecha del MANIFIESTO (la cabecera `version` / `actualizado_at`). No es la
// fecha de ningun instrumento: los textos que el manifiesto referencia tienen su
// propia fecha, y esa no se mueve porque el manifiesto se actualice.
const FECHA_MANIFIESTO = '2026-11-11';

// La fecha de la CAPTURA del texto del CDPA. La pagina publicada por Google NO
// declara ninguna fecha de version: se verifico el 10-nov-2026 sobre el texto
// descargado y no hay ni una aparicion de "2026", "October" ni "Last modified".
// Por eso la fecha que se registra es la de la descarga verificada, y el texto
// se identifica por su SHA-256 (que se reprodujo el 10-nov-2026 con el mismo
// resultado del 9-nov-2026). La fecha de efectividad del Addendum la declara
// el acta del acto del owner, no este script.
const CDPA_CAPTURA = '2026-11-10';

// El instrumento de tratamiento de datos de Google. Verificado el 9-nov-2026
// contra el texto publico: NO se inventa ninguna de estas cuatro cosas.
const CDPA = {
  instrumento: 'Cloud Data Processing Addendum (Customers)',
  url: 'https://admin.google.com/terms/apps/8/1/en/dpa_terms.html',
  fecha: CDPA_CAPTURA,
  // La pagina no declara fecha de version: null, no una fecha inventada.
  fecha_declarada_por_google: null,
  sha256: '0e1c729406410a15758ae1ceb6d93b6b4e200208b325abf17b09ef74f0dc69b1',
  bytes: 97831,
};

/**
 * Un error de este script.
 *
 * Se LANZA, no se sale: el wrapper de abajo es el que traduce el error en un
 * codigo de salida. Asi el script se puede probar desde un test, sin matar el
 * proceso de Node que lo corre.
 *
 * @param {string} msg
 * @returns {Error}
 */
function error(msg) {
  const e = new Error(msg);
  e.codigo = 3;
  return e;
}

/**
 * Un error de USO: el codigo es 2, como en los scripts hermanos.
 *
 * @param {string} msg
 * @returns {Error}
 */
function errorUso(msg) {
  const e = new Error(msg);
  e.codigo = 2;
  return e;
}

function sha256De(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function exigirCopiasIguales(nombre, rutaA, rutaB) {
  const a = fs.readFileSync(rutaA);
  const b = fs.readFileSync(rutaB);
  if (!a.equals(b)) {
    throw new Error('las dos copias de ' + nombre + ' difieren: hay dos textos y una '
      + 'sola huella no puede describirlos');
  }
  return a.length;
}

function asciiEscape(s) {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c > 0x7f) {
      if (c > 0xffff) {
        const v = c - 0x10000;
        out += '\\u' + (0xd800 + (v >> 10)).toString(16).padStart(4, '0')
          + '\\u' + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, '0');
      } else {
        out += '\\u' + c.toString(16).padStart(4, '0');
      }
    } else {
      out += ch;
    }
  }
  return out;
}

function main(args = process.argv.slice(2)) {
  let soloCheck = false;
  let rutaManifiesto = MANIFIESTO;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--check') soloCheck = true;
    else if (a === '--manifiesto') {
      // Para los tests: el script escribe sobre una COPIA, nunca sobre el
      // manifiesto del repo. Sin esta opcion no habria forma de probarlo sin
      // tocar el archivo de verdad.
      i += 1;
      if (!args[i]) throw errorUso('--manifiesto necesita una ruta.');
      rutaManifiesto = path.resolve(args[i]);
    } else {
      throw errorUso('Argumento desconocido: ' + a);
    }
  }

  const rutaNube = path.join(APP_ROOT, 'legal', 'anexo-nube-v' + VERSION_NUBE + '.html');
  const rutaNubeSitio = path.join(REPO_ROOT, 'sitio', 'anexo-nube-v' + VERSION_NUBE + '.html');
  const rutaEncargo = path.join(APP_ROOT, 'legal', 'anexo-encargo.html');
  const rutaEncargoSitio = path.join(REPO_ROOT, 'sitio', 'anexo-encargo.html');

  for (const p of [rutaNube, rutaNubeSitio, rutaEncargo, rutaEncargoSitio]) {
    if (!fs.existsSync(p)) throw error('No existe ' + p);
  }

  let bytesNube;
  let bytesEncargo;
  try {
    bytesNube = exigirCopiasIguales('el Anexo de Nube v' + VERSION_NUBE, rutaNube, rutaNubeSitio);
    bytesEncargo = exigirCopiasIguales('el Anexo de Encargo', rutaEncargo, rutaEncargoSitio);
  } catch (e) {
    throw error(e.message);
  }

  const hashNube = sha256De(rutaNube);
  const hashEncargo = sha256De(rutaEncargo);

  // La version que declara el propio Anexo de Encargo: no se escribe a mano.
  const textoEncargo = fs.readFileSync(rutaEncargo, 'utf8');
  const declarado = textoEncargo.match(/<meta name="version" content="([^"]+)">/);
  if (!declarado) throw error('El Anexo de Encargo no declara su version en el encabezado');
  if (declarado[1] !== VERSION_ENCARGO) {
    throw error('El Anexo de Encargo declara la version ' + declarado[1] + ' y el script espera '
      + VERSION_ENCARGO);
  }

  // La matriz de finalidades es la FUENTE de la etiqueta de version del Anexo de
  // Encargo. Si su `instruccion.version` no es la del documento, hay dos textos.
  // La version y la fecha se leen del archivo: no se escriben a mano.
  const RUTA_MATRIZ = path.join(SERVICE_ROOT, 'config', 'matriz-finalidades.json');
  let matriz;
  try {
    matriz = JSON.parse(fs.readFileSync(RUTA_MATRIZ, 'utf8'));
  } catch (err) {
    throw error('La matriz de finalidades no es JSON valido: ' + err.message);
  }
  if (!matriz.instruccion || matriz.instruccion.version !== VERSION_ENCARGO) {
    throw error('La matriz de finalidades declara la version '
      + (matriz.instruccion && matriz.instruccion.version)
      + ' y el script espera ' + VERSION_ENCARGO);
  }

  let m;
  try {
    m = JSON.parse(fs.readFileSync(rutaManifiesto, 'utf8'));
  } catch (err) {
    throw error('El manifiesto no es JSON valido: ' + err.message);
  }

  // ---------------------------------------------------------------------------
  // 1 · La cabecera
  // ---------------------------------------------------------------------------
  m.version = FECHA_MANIFIESTO;
  m.actualizado_at = FECHA_MANIFIESTO;

  // ---------------------------------------------------------------------------
  // 2 · El proveedor de correo: `mail_provider`
  // ---------------------------------------------------------------------------
  // La clave `google` queda como historico del estado anterior (la cuenta de
  // consumo). No se lee para calificar nada: la califica `mail_provider`.
  //
  // 📦1047 · P1 LA ACEPTACION DEL CDPA NO LA ESCRIBE ESTE SCRIPT.
  //
  // La escribe `scripts/actualizar-manifiesto-aceptacion-cdpa.js`, leyendo un
  // acta del acto del owner. Este script solo la CONSERVA: si se limitara a
  // escribir el estado pendiente, cada corrida borraria el registro de una
  // aceptacion ya hecha y volveria a bloquear el item `mail_provider_dpa` del
  // gate. Un script que declara "el CDPA no esta aceptado" no puede decidir
  // por su cuenta que una aceptacion dejo de estarlo.
  const aceptacionPrevia = ((((m.subencargados || {}).mail_provider) || {}).aceptacion) || null;
  const aceptacion = (aceptacionPrevia && aceptacionPrevia.aceptada === true)
    ? aceptacionPrevia
    : {
      aceptada: false,
      modo: null,
      fecha: null,
      evidencia: null,
      responsable: 'owner',
      nota: 'Pendiente P1 de la Decision A del 9-nov-2026: falta que el owner acepte el CDPA '
        + 'en la consola de Workspace (Cuenta > Terminos adicionales de seguridad y privacidad > '
        + 'Cloud Data Processing Addendum > Review and Accept), o que confirme que el Acuerdo ya '
        + 'lo incorpora por referencia, y que registre la fecha de efectividad del Addendum y la '
        + 'evidencia. El item mail_provider_dpa del gate NO puede quedar en ok sin esto. Este '
        + 'bloque lo escribe scripts/actualizar-manifiesto-aceptacion-cdpa.js desde un acta.',
    };
  const mailProvider = {
    proveedor: 'Google Ireland Limited (Google Workspace)',
    servicio: 'Google Workspace: canal de correo del servicio de firma (Gmail, smtp.gmail.com:587 con STARTTLS)',
    cuenta: 'workspace',
    rol: 'subencargado',
    dpa: true,
    instrumento: CDPA.instrumento,
    version: 'CDPA, texto que NO declara fecha, capturado el ' + CDPA.fecha,
    fecha: CDPA.fecha,
    fecha_declarada_por_google: CDPA.fecha_declarada_por_google,
    url: CDPA.url,
    hash: CDPA.sha256,
    bytes: CDPA.bytes,
    devolucion_supresion: true,
    auditoria: true,
    evidencia: CDPA.url + ' (texto publico descargado el ' + CDPA_CAPTURA + ', sin sesion autenticada; la pagina no declara fecha de version, el texto se identifica por su SHA-256)',
    aceptacion: aceptacion,
    pais: 'Estados Unidos. El CDPA (seccion 10.1) permite que los datos se procesen en cualquier pais donde Google o sus subencargados tengan instalaciones.',
    nivel_adecuado: true,
    transferencia: 'Transferencia internacional a Estados Unidos, pais con nivel adecuado de proteccion (numeral 3.2 del Titulo V de la Circular Unica de la SIC). El CDPA NO la elimina: la seccion 10.1 deja abierto el procesamiento en cualquier pais de facilities de Google o de sus subencargados. El envio sigue rigiendo por el articulo 26 de la Ley 1581 de 2012.',
    nota: 'El papel del proveedor NO se afirma en forma absoluta: Google interviene como '
      + 'Subencargado de los datos del SERVICIO DE CORREO mientras el CDPA este vigente y '
      + 'aplicable a la cuenta, conforme a sus secciones 4.3, 5.1 y 5.1.3. Los datos de CUENTA '
      + 'del administrador de Workspace y la TELEMETRIA del servicio no son datos del cliente: '
      + 'Google los trata por cuenta propia conforme a sus terminos, con su propia base de '
      + 'proteccion de datos, y no quedan cubiertos por las obligaciones que K+AIR puede '
      + 'invocar contra Google en nombre de la Empresa. Decision A del 9-nov-2026, apartado 2.4.',
  };

  const sub = m.subencargados || {};
  const googleHistorico = sub.google || {};
  m.subencargados = Object.assign({}, sub, {
    mail_provider: mailProvider,
    google: Object.assign({}, googleHistorico, {
      estado: 'sustituido',
      sustituido_por: 'mail_provider',
      nota: 'ESTADO ANTERIOR, conservado como historico: la cuenta gratuita de Gmail de consumo. '
        + 'El 9-nov-2026 se sustituyo por Google Workspace con el CDPA incorporado al Acuerdo '
        + '(Decision A del 9-nov-2026, apartado 3). Este bloque NO se lee para calificar nada: '
        + 'el item vigente del gate es mail_provider_dpa, y el item google_dpa queda en no_aplica.',
    }),
  });

  // ---------------------------------------------------------------------------
  // 3 · El Anexo de Nube: el texto vigente y las versiones suscritas
  // ---------------------------------------------------------------------------
  const nubePrevio = m.anexo_nube || {};

  // Las versiones suscritas que ya constan NO se borran. A eso se le suma la
  // firma que el manifiesto declaraba, si no es la del texto vigente: cuando
  // se publica un texto nuevo, la firma del anterior deja de describir el
  // texto vigente y pasa a la historia.
  const firmadasPrevias = Array.isArray(nubePrevio.versiones_firmadas)
    ? nubePrevio.versiones_firmadas.slice()
    : [];
  if (nubePrevio.firmado === true && nubePrevio.version
    && !firmadasPrevias.some((x) => x && x.version === nubePrevio.version
      && String(x.hash || '').toLowerCase() === String(nubePrevio.hash || '').toLowerCase())) {
    firmadasPrevias.push({
      version: nubePrevio.version,
      hash: nubePrevio.hash,
      fecha: nubePrevio.fecha,
      contrafirmado: nubePrevio.contrafirmado === true,
      evidencia: nubePrevio.evidencia,
    });
  }
  const firmadoPrevio = firmadasPrevias.filter((x) => x && x.version);

  // La firma que el manifiesto declara se CONSERVA solo si describe el texto
  // vigente. Este script no decide si una firma existe: eso lo decide el
  // script que lee la base (`actualizar-manifiesto-anexo-nube.js`). Lo que
  // hace este es no borrar una firma que si describe el texto que se esta
  // publicando, para que los dos scripts se puedan correr en cualquier orden.
  const firmaDelTextoVigente = nubePrevio.firmado === true
    && String(nubePrevio.version || '').trim() === VERSION_NUBE
    && String(nubePrevio.hash || '').trim().toLowerCase() === hashNube;

  m.anexo_nube = {
    firmado: firmaDelTextoVigente,
    fecha: firmaDelTextoVigente ? nubePrevio.fecha : null,
    version: firmaDelTextoVigente ? nubePrevio.version : null,
    hash: firmaDelTextoVigente ? nubePrevio.hash : null,
    evidencia: firmaDelTextoVigente ? nubePrevio.evidencia : null,
    // El SEGUNDO acto (la contrafirma de K+AIR) viaja con la firma. El Anexo
    // de Nube es bilateral (v1.2, seccion 10): sin el segundo acto no hay
    // instrumento ejecutado. Este script no lo inventa ni lo borra: lo
    // conserva tal como lo dejo el script que lee la base.
    contrafirmado: firmaDelTextoVigente ? nubePrevio.contrafirmado === true : false,
    contrafirma_fecha: firmaDelTextoVigente ? (nubePrevio.contrafirma_fecha || null) : null,
    contrafirma_actor: firmaDelTextoVigente ? (nubePrevio.contrafirma_actor || null) : null,
    contrafirma_motivo: firmaDelTextoVigente ? (nubePrevio.contrafirma_motivo || null) : null,
    contrafirma_evidencia: firmaDelTextoVigente ? (nubePrevio.contrafirma_evidencia || null) : null,
    // La FACULTAD acreditada de quien contrafirma por Gesstiar (P7). Este
    // script no la inventa ni la borra: la conserva tal como la dejo el script
    // que lee la base (`actualizar-manifiesto-anexo-nube.js`). Sin ella, el item
    // `contrafirma_nube` del gate NO puede quedar ok: el segundo acto no dice
    // con que poder se firmo.
    contrafirma_facultad: firmaDelTextoVigente ? (nubePrevio.contrafirma_facultad || null) : null,
    modelo: {
      version: VERSION_NUBE,
      hash: hashNube,
      bytes: bytesNube,
      actualizado: FECHA,
      nota: 'Texto vigente del Anexo de Nube: la v' + VERSION_NUBE + '. Corrige el bloque de pendientes '
        + 'del texto, que declaraba como no cumplidos P1 (la aceptacion del CDPA en la consola de '
        + 'Workspace), P2 (la cuenta kair@gesstiar.com activa, con verificacion en dos pasos), P4 (SPF, '
        + 'DKIM y DMARC de gesstiar.com publicados) y P5 (el envio real desde el dominio): los cuatro se '
        + 'cerraron el 10-nov-2026, y el texto nuevo declara ese envio real con su Message-ID y su '
        + 'Authentication-Results. Siguen pendientes P3 (los alias del dominio) y P6 (revocar las app '
        + 'passwords de la cuenta anterior). La v1.2, del 9-nov-2026, nunca llego a suscribirse y queda '
        + 'como referencia. La v1.1 (suscrita por ASEPLUS el 5-nov-2026) queda en `versiones_firmadas`: '
        + 'el texto vigente todavia no esta suscrito y por eso el item firmado_nube del gate esta '
        + 'pendiente. El papel del proveedor del canal de correo sigue siendo el de Subencargado, con la '
        + 'formula condicional del dictamen legal del 11-nov-2026.'
        + ' ERRATA DEL 11-nov-2026, ANTES DE LA SUSCRIPCION: el parrafo 12 de la v1.3 decia '
        + '"Esta version 1.2 remite" al Anexo de Encargo, dentro de un texto que es la v1.3, y se corrigio '
        + 'a "Esta version 1.3 remite". Es una correccion de cita: no cambian las partes, el objeto, las '
        + 'obligaciones ni la distribucion del riesgo, y la frase siguiente del mismo parrafo ya decia que '
        + 'esta version 1.3 no sustituye ese instrumento. El texto no estaba suscrito ni publicado cuando '
        + 'se corrigio, y las versiones ya suscritas (la v1.1 del 5-nov-2026) no se tocaron. La huella '
        + 'anterior de la v1.3 era '
        + '45500569d02b876e8bc273385db934d77f5464642b75aab2a6b734e8ed3abf9f. Dictamen: '
        + 'docs/gestion-humana/firma-electronica/dictamen-legal-errata-textos-2026-11-11.md.',
    },
    versiones_firmadas: firmadoPrevio,
  };

  // ---------------------------------------------------------------------------
  // 4 · El Anexo de Encargo: la version vigente y la que esta suscrita
  // ---------------------------------------------------------------------------
  const encargoPrevio = m.anexo_encargo || {};
  const encargoFirmados = encargoPrevio.versiones_firmadas && encargoPrevio.versiones_firmadas.length
    ? encargoPrevio.versiones_firmadas
    : [{
      version: encargoPrevio.version,
      hash: encargoPrevio.hash,
      fecha: encargoPrevio.fecha,
      evidencia: encargoPrevio.evidencia,
      estado: encargoPrevio.estado,
    }].filter((x) => x && x.version);

  m.anexo_encargo = {
    estado: 'no_firmado',
    fecha: null,
    evidencia: null,
    // La FACULTAD acreditada de quien contrafirma por Gesstiar (P7). El texto
    // vigente no esta suscrito, asi que no hay segundo acto y no hay
    // facultad: la deja en null. El script que lee la base la escribe cuando
    // la contrafirma exista.
    contrafirma_facultad: null,
    version: VERSION_ENCARGO,
    hash: hashEncargo,
    nota: 'Texto vigente del Anexo de Encargo: la version ' + VERSION_ENCARGO + '. Corrige el parrafo '
      + '"Lo que queda pendiente" de la seccion 5, que declaraba como no cumplidos P5 (la aceptacion '
      + 'del CDPA en la consola de Workspace) y P6 (la cuenta empresarial activa, con la credencial del '
      + 'servidor migrada y comprobada con un envio real), los dos cerrados el 10-nov-2026: el texto '
      + 'nuevo declara los pasos cumplidos con su evidencia y deja los que siguen abiertos con su '
      + 'responsable. El paso (viii), la confirmacion escrita sobre el instrumento bilateral, la '
      + 'contrafirma, el alcance de los canales y el papel de Google para los datos de cuenta y la '
      + 'telemetria, quedo respondido el 11-nov-2026 en el dictamen legal del expediente. Mantiene las '
      + 'secciones 4 y 5 (el vinculo con el proveedor de correo), la 3.4 y la 12 (devolucion, supresion '
      + 'y auditoria conforme al CDPA) y la clausula de prevalencia del instrumento bilateral mas '
      + 'reciente, y remite ahora al Anexo de Nube v1.3. El texto vigente NO esta suscrito: la version '
      + 'suscrita por ASEPLUS el 7-nov-2026 es la 2026-11-06, que queda en `versiones_firmadas`. Por eso '
      + 'el item estado_encargo del gate esta pendiente y el flujo de suscripcion del servicio rechaza '
      + 'una nueva firma por la via directa (409 SUSCRIPCION_EXISTENTE): la re-suscripcion va por el '
      + 'canal administrativo, con su motivo. La suscripcion anterior NO se reescribe: la bitacora '
      + 'es append-only.'
      + ' ERRATA DEL 11-nov-2026, ANTES DE LA SUSCRIPCION: el menu, la seccion 1 (Partes), la seccion 5 '
      + '(Proveedores externos y subencargados) y la seccion 9 remitian al Anexo de Nube v1.2, un texto '
      + 'superado cuyo bloque de pendientes estaba desactualizado, y los cuatro puntos remiten ahora a la '
      + 'v1.3, que es el texto vigente y el que la clausula de prevalencia de la seccion 5 ya nombraba. '
      + 'No es un detalle de redaccion: la seccion 5 dice que el Anexo de Nube "forma parte integral de '
      + 'este documento", y eso es una incorporacion por remision (articulo 44 de la Ley 527 de 1999): lo '
      + 'que queda incorporado es el texto al que apunta el vinculo, y con el vinculo apuntando a la v1.2 '
      + 'este Anexo incorporaba un texto que el propio documento declara superado. Es una correccion de '
      + 'cita: no cambian las partes, el objeto, las obligaciones ni la distribucion del riesgo. El texto '
      + 'no estaba suscrito ni publicado cuando se corrigio, y la version suscrita por ASEPLUS el '
      + '7-nov-2026 (la 2026-11-06) no se toco. La huella anterior era '
      + 'c7c42a1897b44222c09cbdbfc6f8617f29b7250b9c9e0c8b12f1e502770bfd95. Dictamen: '
      + 'docs/gestion-humana/firma-electronica/dictamen-legal-errata-textos-2026-11-11.md.',
    versiones_firmadas: encargoFirmados,
  };

  // ---------------------------------------------------------------------------
  // 5 · La matriz de finalidades: su huella y su version son las del archivo
  // ---------------------------------------------------------------------------
  // El manifiesto declara la huella de la matriz, y el test del manifiesto la
  // contrasta contra el archivo real. La matriz cambio (la instruccion apunta
  // a la version 2026-11-11 del Anexo de Encargo), asi que su huella cambio
  // con ella: declarar la vieja seria una huella que no describe el archivo.
  m.matriz_finalidades = Object.assign({}, m.matriz_finalidades, {
    archivo: 'config/matriz-finalidades.json',
    hash: sha256De(RUTA_MATRIZ),
    version: matriz.version,
    actualizado_at: matriz.actualizado_at,
    nota: 'Fuente unica de la matriz de finalidades (Anexo de Encargo, seccion 2). La version y la '
      + 'huella son las que el servicio pone a disposicion del Firmante antes de habilitar la casilla '
      + 'de aceptacion, y las que la aceptacion registra junto con la version y la huella de los dos '
      + 'anexos. El 11-nov-2026 se actualizo la referencia a la version del Anexo de Encargo (bloque '
      + 'instruccion) a la ' + VERSION_ENCARGO + ', sin cambiar ninguna finalidad, ninguna base '
      + 'juridica ni ningun estado de habilitacion: la huella cambio porque cambio el documento que '
      + 'esa instruccion identifica.',
  });

  // ---------------------------------------------------------------------------
  // 6 · Los canales: la migracion y la excepcion documentada
  // ---------------------------------------------------------------------------
  m.canales = {
    transaccional: {
      cuenta: 'kair@gesstiar.com',
      proveedor: 'Google Workspace (Gmail), smtp.gmail.com:587 con STARTTLS',
      rol: 'subencargado',
      instrumento: CDPA.instrumento + ', texto del ' + CDPA.fecha,
      estado: 'migrado',
      nota: 'La cuenta y el remitente del canal transaccional (codigo OTP, enlace de acceso a la '
        + 'solicitud de firma, avisos del procedimiento e invitacion a suscribir el Anexo de Nube) '
        + 'estan en kair@gesstiar.com. P2, P4 y P5 se CERRARON el 10-nov-2026: la cuenta esta '
        + 'activa con verificacion en dos pasos y app password (P2); SPF, DKIM y DMARC estan '
        + 'publicados y visibles en el autoritativo (P4); y el ENVIO REAL quedo probado con el '
        + 'Message-ID <5db3377d-4565-e49b-0b64-cd0b5ce2b4ca@gesstiar.com> y '
        + 'Authentication-Results: dkim=pass; spf=pass; dmarc=pass (P5). Lo que queda abierto NO '
        + 'es el canal: es P11 (revocar en Google las app passwords de la cuenta anterior) y P3 '
        + '(los alias de derechos, que tienen su propia excepcion documentada mas abajo). '
        + 'Correccion del 11-nov-2026: este bloque decia "pendiente_de_migracion" y afirmaba que '
        + 'el remitente efectivo seguia siendo el anterior, cuando los tres pendientes ya estaban '
        + 'cerrados. Era un falso negativo documental: no creaba un verde falso (la compuerta '
        + 'canal_datos lee otro campo), pero dejaba en el expediente una contradiccion con '
        + 'mail_provider.aceptacion.aceptada = true.',
    },
    derechos: {
      direccion: (m.encargado && m.encargado.canal_proteccion_datos) || null,
      estado: 'excepcion_documentada',
    },
    pqrs: {
      direccion: (m.pqrs && m.pqrs.canal) || null,
      estado: 'excepcion_documentada',
    },
    incidentes: {
      direccion: (m.encargado && m.encargado.canal_proteccion_datos) || null,
      estado: 'excepcion_documentada',
    },
    excepcion_documentada: {
      motivo: 'Los alias de Workspace (privacidad@gesstiar.com, soporte@gesstiar.com, '
        + 'incidentes@gesstiar.com) NO estan verificados: no consta que existan en la consola. '
        + 'Publicar una direccion de derechos que no recibe solicitudes dejaria sin canal real a '
        + 'los titulares, y publicar un remitente que no envia dejaria al servicio sin correo.',
      responsable: 'owner',
      pendiente: 'P3',
      accion: 'Crear los alias en la consola de Workspace, verificar cada uno con un envio real y '
        + 'migrar despues los canales en los documentos publicos y en src/config.js.',
      referencia: 'decision-regularizacion-correo-2026-11-09.md, apartado 3',
      efecto: 'La ruta TRANSACCIONAL no tiene ninguna referencia a una cuenta de consumo. Los tres '
        + 'canales de esta tabla si la tienen, y su excepcion queda escrita con motivo, '
        + 'responsable y accion de cierre. La cuenta adminkair@gmail.com deja de ser la identidad '
        + 'de envio (eso lo ejecuta el owner en P6) pero sigue existiendo como buzon humano de '
        + 'soporte y PQRS.',
    },
  };

  // ---------------------------------------------------------------------------
  // 6 · Escritura
  // ---------------------------------------------------------------------------
  const salida = asciiEscape(JSON.stringify(m, null, 2)) + '\n';

  // El manifiesto tiene que seguir siendo JSON valido y ASCII puro.
  JSON.parse(salida);
  const noAscii = (salida.match(/[^\x00-\x7F]/g) || []).length;
  if (noAscii > 0) throw error('El manifiesto salio con ' + noAscii + ' caracteres no ASCII');

  if (soloCheck) {
    const actual = fs.readFileSync(rutaManifiesto, 'utf8');
    if (actual === salida) {
      console.log('[actualizar-manifiesto-1047] OK: el manifiesto ya esta al dia.');
      return { ok: true, solo_check: true, coincide: true };
    }
    throw error('El manifiesto NO esta al dia (--check).');
  }

  fs.writeFileSync(rutaManifiesto, salida, 'utf8');
  console.log('[actualizar-manifiesto-1047] Manifiesto actualizado.');
  console.log('  Anexo de Nube v' + VERSION_NUBE + ': ' + hashNube + ' (' + bytesNube + ' bytes)');
  console.log('  Anexo de Encargo ' + VERSION_ENCARGO + ': ' + hashEncargo + ' (' + bytesEncargo + ' bytes)');
  console.log('  CDPA: ' + CDPA.instrumento + ' (' + CDPA.fecha + ') ' + CDPA.sha256);
  console.log('  mail_provider.aceptacion.aceptada: ' + (aceptacion.aceptada === true)
    + (aceptacion.aceptada === true
      ? ' (modo ' + aceptacion.modo + ', ' + aceptacion.fecha + '; la conserva este script)'
      : ' (la verifica el owner: pendiente P1)'));
  return {
    ok: true,
    solo_check: false,
    hash_nube: hashNube,
    hash_encargo: hashEncargo,
    bytes_nube: bytesNube,
    bytes_encargo: bytesEncargo,
    aceptacion_aceptada: aceptacion.aceptada === true,
    aceptacion_modo: aceptacion.modo || null,
  };
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error('[actualizar-manifiesto-1047] ERROR: ' + (e && e.message ? e.message : String(e)));
    process.exit(e && e.codigo ? e.codigo : 3);
  }
}

module.exports = {
  main,
  sha256De,
  exigirCopiasIguales,
  asciiEscape,
  MANIFIESTO,
  FECHA,
  FECHA_MANIFIESTO,
  CDPA_CAPTURA,
  CDPA,
  VERSION_NUBE,
  VERSION_ENCARGO,
};

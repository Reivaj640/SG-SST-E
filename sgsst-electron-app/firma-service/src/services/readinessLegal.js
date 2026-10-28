/**
 * Auditoría de readiness legal del Servicio de Firma.
 *
 * QUÉ HACE
 * --------
 * Responde una pregunta que hasta ahora solo vivía en la cabeza del operador:
 * ¿el sistema puede publicar la v1.1 del Acuerdo y, más adelante, aceptar la
 * primera firma real? Devuelve un reporte con los 11 bloqueantes de la
 * respuesta 11A del abogado (23-oct-2026), agrupados y con una acción concreta
 * para cada uno.
 *
 * QUÉ NO HACE
 * -----------
 * No publica, no firma, no enciende D-02 y NO escribe en la base. Es una
 * fotografía. Si falta un archivo, una tabla o un dato del owner, lo marca
 * como pendiente; no lo inventa ni lo deja pasar en silencio.
 *
 * FUENTE DE VERDAD
 * ----------------
 * - El inventario de evidencias es `legal-readiness.json`.
 * - El texto y las cláusulas se leen de los documentos reales del repo.
 * - El estado de publicación y de las empresas se lee de SQLite.
 * - La configuración operativa (canales, plazo, D-02) se lee de `config`.
 *
 * El endpoint admin y el CLI comparten este mismo servicio para que no haya
 * dos listas de requisitos que se desactualicen por separado.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const db = require('../db/connection');
const config = require('../config');
const {
  listarPlaceholders,
  buscarPlaceholders,
  analizarTextoLegal,
  esPlaceholderDeLaEmpresa,
  parseVersion,
  reDeMarcador,
} = require('../utils/textoLegal');

// Raíz del Servicio (firma-service) y raíz del repo que lo contiene.
const SERVICE_ROOT = path.resolve(__dirname, '..', '..');
const REPO_ROOT = path.resolve(SERVICE_ROOT, '..');

const RUTAS_DEFAULT = {
  anexoNube: path.join(REPO_ROOT, 'legal', 'anexo-nube-v1.0.html'),
  anexoEncargo: path.join(REPO_ROOT, 'legal', 'anexo-encargo.html'),
  acuerdoV11: path.join(SERVICE_ROOT, 'scripts', 'fixtures', 'acuerdo-v1.1.txt'),
  manifiesto: path.join(SERVICE_ROOT, 'legal-readiness.json'),
  retencion: path.join(SERVICE_ROOT, 'src', 'services', 'retencion.js'),
  signRequest: path.join(SERVICE_ROOT, 'src', 'services', 'signRequest.js'),
};

const GATES = ['publicacion', 'primera_firma'];
const GATE_AMBOS = ['publicacion', 'primera_firma'];
const GATE_PRIMERA = ['primera_firma'];

const ESTADOS = {
  OK: 'ok',
  PENDIENTE: 'pendiente',
  AVISO: 'aviso',
  NO_APLICA: 'no_aplica',
};

// =============================================================================
// Helpers de datos
// =============================================================================

function _texto(valor) {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null;
}

function _fechaValida(valor) {
  if (typeof valor !== 'string' || valor.trim() === '') return false;
  return !Number.isNaN(new Date(valor).getTime());
}

function _numeroPositivo(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0;
}

function _enteroNoNegativo(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 0;
}

function _esHashSha256(valor) {
  return typeof valor === 'string' && /^[a-f0-9]{64}$/i.test(valor.trim());
}

function _nitValido(valor) {
  const s = _texto(valor);
  if (!s) return false;
  const digitos = s.replace(/\D/g, '');
  return digitos.length >= 8 && digitos.length <= 12;
}

function _normalizarCanal(valor) {
  const s = _texto(valor);
  if (!s) return null;
  const v = s.toLowerCase();
  if (v.startsWith('http://') || v.startsWith('https://')) {
    return v.replace(/\/+$/, '');
  }
  return v;
}

function _canalValido(valor) {
  const s = _texto(valor);
  if (!s) return false;
  if (/^https?:\/\/[^\s]+$/i.test(s)) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function _urlValida(valor) {
  const s = _texto(valor);
  return !!s && /^https?:\/\/[^\s]+$/i.test(s);
}

function _hash(texto) {
  return crypto.createHash('sha256').update(String(texto || ''), 'utf8').digest('hex');
}

function _rutaRelativa(ruta) {
  if (!ruta) return 'documento';
  try {
    const rel = path.relative(REPO_ROOT, ruta);
    if (!rel || rel.startsWith('..')) return path.basename(ruta);
    return rel.replace(/\\/g, '/');
  } catch (_) {
    return path.basename(String(ruta));
  }
}

/**
 * Entidades HTML que aparecen en los documentos legales del sitio.
 *
 * Solo las que el repo usa de verdad: el sitio escribe con entidades
 * (`d&iacute;as`, `Auditor&iacute;a`, `supresi&oacute;n`) y el texto que se
 * firma es el RENDERIZADO, no el HTML crudo.
 */
const ENTIDADES_HTML = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  ntilde: 'ñ', Ntilde: 'Ñ', mdash: '—', ndash: '–',
  laquo: '«', raquo: '»', middot: '·', hellip: '…',
  ordm: 'º', ordf: 'ª', copy: '©', reg: '®',
};

/**
 * Convierte un documento HTML en el TEXTO que el firmante lee: le quita las
 * etiquetas y resuelve las entidades.
 *
 * POR QUÉ: el checker de cláusulas corría sobre el HTML crudo, así que una
 * cláusula escrita con entidades no aparecía. El 24-oct-2026 eso hizo que el
 * Anexo de Nube reportara como faltantes cuatro cláusulas que el documento sí
 * tiene (los veinte (20) años, los dos (2) días hábiles, la devolución, la
 * supresión y la auditoría): "dos d&iacute;as h&aacute;biles" no matchea
 * /dos\s*\(2\)\s*días\s+hábiles/. El documento legal es el que se ve, no el
 * marcado.
 *
 * @param {string} html
 * @returns {string}
 */
function _textoRenderizado(html) {
  if (typeof html !== 'string' || html.length === 0) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&([a-zA-Z]+|#\d{1,5});/g, (match, entidad) => {
      if (entidad.charAt(0) === '#') {
        const numero = entidad.charAt(1) === 'x'
          ? parseInt(entidad.slice(2), 16)
          : parseInt(entidad.slice(1), 10);
        return Number.isFinite(numero) ? String.fromCodePoint(numero) : match;
      }
      const valor = ENTIDADES_HTML[entidad];
      return valor === undefined ? match : valor;
    })
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function _leerTexto(ruta) {
  const archivo = _rutaRelativa(ruta);
  if (!ruta || !fs.existsSync(ruta)) {
    return { existe: false, texto: '', error: 'no existe', archivo };
  }
  try {
    return {
      existe: true,
      texto: fs.readFileSync(ruta, 'utf8'),
      error: null,
      archivo,
    };
  } catch (err) {
    return { existe: false, texto: '', error: err.message, archivo };
  }
}

function _leerManifiesto(ruta) {
  const archivo = _rutaRelativa(ruta);
  if (!ruta || !fs.existsSync(ruta)) {
    return { existe: false, datos: null, error: 'no existe', archivo };
  }
  try {
    const datos = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
      throw new Error('el manifiesto no es un objeto JSON');
    }
    return { existe: true, datos, error: null, archivo };
  } catch (err) {
    return { existe: false, datos: null, error: err.message, archivo };
  }
}

function _textoDocumento(textos, clave, ruta, etiqueta) {
  if (Object.prototype.hasOwnProperty.call(textos, clave)) {
    const valor = textos[clave];
    return {
      existe: typeof valor === 'string' && valor.length > 0,
      texto: typeof valor === 'string' ? valor : '',
      error: typeof valor === 'string' ? null : 'texto no provisto',
      archivo: etiqueta,
    };
  }
  const leido = _leerTexto(ruta);
  return { ...leido, archivo: etiqueta };
}

function _tablaExiste(dbConn, nombre) {
  if (!dbConn) return false;
  try {
    const fila = dbConn.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    ).get(nombre);
    return !!fila;
  } catch (_) {
    return false;
  }
}

function _triggerExiste(dbConn, nombre) {
  if (!dbConn) return false;
  try {
    const fila = dbConn.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = ?",
    ).get(nombre);
    return !!fila;
  } catch (_) {
    return false;
  }
}

function _resumenEmpresas(dbConn) {
  const base = {
    disponible: false,
    total: 0,
    con_anexo_base: 0,
    con_anexo_nube: 0,
    con_canal_pqrs: 0,
    fechas_antes_del_alta: 0,
    columna_anexo_nube: false,
    error: null,
  };
  if (!dbConn) {
    base.error = 'sin conexión a la base';
    return base;
  }
  try {
    const columnas = dbConn.prepare('PRAGMA table_info(gh_firma_empresas)').all()
      .map((c) => c.name);
    if (!columnas.includes('anexo_encargo_firmado_at') || !columnas.includes('canal_pqrs')) {
      base.error = 'la tabla de empresas no tiene las columnas esperadas';
      return base;
    }
    const tieneNube = columnas.includes('anexo_nube_firmado_at');
    const seleccion = ['anexo_encargo_firmado_at', 'canal_pqrs', 'created_at'];
    if (tieneNube) seleccion.push('anexo_nube_firmado_at');
    const filas = dbConn.prepare(
      `SELECT ${seleccion.join(', ')} FROM gh_firma_empresas WHERE activo = 1`,
    ).all();
    // Una fecha anterior al alta en el sistema NO es un error: el contrato se
    // puede firmar antes de cargar la Empresa. Pero es una senal que el
    // reporte muestra para que el operador la confronte con el PDF.
    const antesDelAlta = filas.filter((f) => {
      if (!f.anexo_encargo_firmado_at || !f.created_at) return false;
      const anexo = new Date(f.anexo_encargo_firmado_at).getTime();
      const alta = new Date(String(f.created_at).replace(' ', 'T') + 'Z').getTime();
      return Number.isFinite(anexo) && Number.isFinite(alta) && anexo < alta;
    }).length;
    return {
      ...base,
      disponible: true,
      total: filas.length,
      con_anexo_base: filas.filter((f) => !!f.anexo_encargo_firmado_at).length,
      con_anexo_nube: tieneNube
        ? filas.filter((f) => !!f.anexo_nube_firmado_at).length
        : 0,
      con_canal_pqrs: filas.filter((f) => !!_texto(f.canal_pqrs)).length,
      fechas_antes_del_alta: antesDelAlta,
      columna_anexo_nube: tieneNube,
      error: null,
    };
  } catch (err) {
    base.error = err.message;
    return base;
  }
}

function _acuerdoActivo(dbConn) {
  if (!dbConn) return null;
  try {
    return dbConn.prepare(`
      SELECT version, texto_hash, fecha_vigencia_inicio, fecha_vigencia_fin
      FROM gh_firma_acuerdo_versiones
      WHERE activa = 1
      ORDER BY fecha_vigencia_inicio DESC
      LIMIT 1
    `).get() || null;
  } catch (_) {
    return null;
  }
}

/**
 * ¿Hay autorización OPERATIVA para la versión vigente y SU texto?
 *
 * La decisión 1.f (con el abogado): aprobar el TEXTO no autoriza a
 * publicarlo. Este item dice si la versión que está EN VIGOR hoy —la que
 * firma la gente— tiene la autorización operativa con su evidencia.
 *
 * El hash va explícito porque la autorización es sobre un texto: sin él, una
 * autorización de un texto serviría para cualquier otro.
 *
 * @param {object|null} dbConn
 * @param {object|null} acuerdoActivo - {version, texto_hash}
 * @returns {{existe: boolean, id?: number, fecha?: string, aprobado_por?: string}}
 */
function _aprobacionOperativaVigente(dbConn, acuerdoActivo) {
  if (!dbConn || !acuerdoActivo || !acuerdoActivo.version || !acuerdoActivo.texto_hash) {
    return { existe: false };
  }
  try {
    const fila = dbConn.prepare(`
      SELECT id, fecha, aprobado_por
      FROM gh_firma_aprobaciones_publicacion
      WHERE version = ? AND hash = ? AND tipo = 'OPERATIVA'
      LIMIT 1
    `).get(acuerdoActivo.version, acuerdoActivo.texto_hash);
    return fila ? { existe: true, ...fila } : { existe: false };
  } catch (_) {
    // La tabla puede no existir (una base sin la migración 044). No hay
    // autorización: esa es la respuesta segura (la publicación queda
    // bloqueada hasta que se registre).
    return { existe: false };
  }
}

function _versionEsAlMenosV11(version) {

  const v = parseVersion(version);
  if (!v) return false;
  return v.major > 1 || (v.major === 1 && v.minor >= 1);
}

function _codigoRetencion(ruta) {
  const doc = _leerTexto(ruta);
  if (!doc.existe) {
    return { existe: false, ok: false, detalle: 'No se pudo leer retencion.js', archivo: doc.archivo };
  }
  const tiene20 = /ANIOS_CUSTODIA\s*=\s*20\b/.test(doc.texto);
  const tieneNorma = /2\.2\.4\.6\.13/.test(doc.texto);
  const tieneHold = /hold\s*:\s*true/.test(doc.texto);
  const faltan = [];
  if (!tiene20) faltan.push('ANIOS_CUSTODIA = 20');
  if (!tieneNorma) faltan.push('referencia al 2.2.4.6.13');
  if (!tieneHold) faltan.push('hold sin término');
  return {
    existe: true,
    ok: faltan.length === 0,
    faltan,
    archivo: doc.archivo,
    detalle: faltan.length === 0
      ? 'El código aplica 20 años, la norma del 2.2.4.6.13 y el hold del contrato.'
      : 'Falta en el código: ' + faltan.join(', '),
  };
}

function _codigoToken(ruta) {
  const doc = _leerTexto(ruta);
  if (!doc.existe) {
    return { existe: false, ok: false, detalle: 'No se pudo leer signRequest.js', archivo: doc.archivo };
  }
  const tieneHash = /token_hash/.test(doc.texto);
  const tieneRotacion = /revocar_anteriores|token_anterior|rotaci[oó]n/i.test(doc.texto);
  const faltan = [];
  if (!tieneHash) faltan.push('token_hash');
  if (!tieneRotacion) faltan.push('rotación/revocación del token anterior');
  return {
    existe: true,
    ok: faltan.length === 0,
    faltan,
    archivo: doc.archivo,
    detalle: faltan.length === 0
      ? 'El token se guarda hasheado y la rotación invalida el anterior.'
      : 'Falta en el código: ' + faltan.join(', '),
  };
}

// =============================================================================
// Análisis de documentos
// =============================================================================

function _faltantes(texto, requeridos) {
  return requeridos
    .filter((r) => !r.re.test(texto))
    .map((r) => ({ id: r.id, titulo: r.titulo }));
}

/**
 * La frase de "no firmar" del Anexo de Nube. Vive en el modulo legal: es el
 * mismo patron que el marcador prohibido `NO_FIRMAR`, para que la exijencia
 * y el bloqueo no se desincronicen.
 */
const RE_AVISO_NO_FIRMAR = reDeMarcador('NO_FIRMAR');

const REQUERIDOS_NUBE = [
  {
    id: 'cloudflare',
    titulo: 'Cloudflare nombrado',
    re: /Cloudflare/i,
  },
  {
    id: 'google',
    titulo: 'Google nombrado',
    re: /Google/i,
  },
  {
    id: 'dpa',
    titulo: 'DPA / acuerdo de encargo de los subencargados',
    re: /(DPA|Acuerdo de Tratamiento de Datos)/i,
  },
  {
    id: 'rto',
    titulo: 'RTO declarado',
    re: /\bRTO\b/,
  },
  {
    id: 'rpo',
    titulo: 'RPO declarado',
    re: /\bRPO\b/,
  },
  {
    id: 'devolucion',
    titulo: 'Devolución de datos',
    re: /devoluci[oó]n/i,
  },
  {
    id: 'supresion',
    titulo: 'Supresión de datos',
    re: /supresi[oó]n/i,
  },
  {
    id: 'auditoria',
    titulo: 'Auditoría del Encargado',
    re: /auditor[ií]a/i,
  },
  {
    id: 'titular',
    titulo: 'Derechos del Titular',
    re: /Titular/i,
  },
  {
    id: 'transferencia',
    titulo: 'Transferencia internacional',
    re: /transferencia\s+internacional/i,
  },
  {
    id: 'veinte_anios',
    titulo: 'Piso de veinte (20) años',
    re: /(veinte\s*\(20\)|20\s*años|20\s*anos)/i,
  },
  {
    id: 'hold',
    titulo: 'Hold sin término del contrato electrónico',
    re: /\bhold\b/i,
  },
  {
    id: 'dos_dias',
    titulo: 'Traslado de PQRS en dos (2) días hábiles',
    re: /dos\s*\(2\)\s*d[ií]as\s*h[aá]biles/i,
  },
  {
    id: 'cinco_categorias',
    titulo: 'Las cinco categorías del art. 2.2.4.6.13',
    re: /2\.2\.4\.6\.13/i,
  },
];

const REQUERIDOS_ENCARGO = [
  { id: 'anexo_nube', titulo: 'Remisión al Anexo de Nube', re: /Anexo\s+de\s+Nube/i },
  {
    // La cláusula sirve para las DOS redacciones. La decisión del 24-oct-2026 fue
    // (b) REEMPLAZO: no hay un Anexo base firmado al que añadirle un otrosí, así
    // que el Anexo nuevo sustituye al anterior. El check tenía que aceptar las
    // dos formas, no solo la del otrosí: exigir una cláusula que el documento
    // final no lleva es un requisito que no puede satisfacerse.
    id: 'sustitucion',
    titulo: 'Sustitución del Anexo anterior o cláusula de otrosí',
    re: /(otros[ií]|sustitu)/i,
  },
  { id: 'cinco_categorias', titulo: 'Art. 2.2.4.6.13', re: /2\.2\.4\.6\.13/i },
  { id: 'veinte_anios', titulo: 'Veinte (20) años', re: /(veinte\s*\(20\)|20\s*años|20\s*anos)/i },
  { id: 'servicio_nube', titulo: 'Servicio en nube / firma-service', re: /firma-service|servicio\s+en\s+nube|servicio\s+de\s+firma\s+en\s+la\s+nube/i },
];

const REQUERIDOS_ACUERDO = [
  { id: 'veinte_anios', titulo: 'Piso de veinte (20) años', re: /(veinte\s*\(20\)|20\s*años|20\s*anos)/i },
  { id: 'hold', titulo: 'Hold sin término del contrato', re: /\bhold\b/i },
  { id: 'dos_dias', titulo: 'Dos (2) días hábiles', re: /dos\s*\(2\)\s*d[ií]as\s*h[aá]biles/i },
  { id: 'cinco_categorias', titulo: 'Art. 2.2.4.6.13', re: /2\.2\.4\.6\.13/i },
];

function _detalleDocumento(analisis) {
  const partes = [];
  if (!analisis.existe) {
    partes.push('El documento no está disponible.');
  }
  if (analisis.faltan && analisis.faltan.length > 0) {
    partes.push('Faltan cláusulas: ' + analisis.faltan.map((f) => f.titulo).join('; ') + '.');
  }
  if (analisis.marcadores && analisis.marcadores.length > 0) {
    partes.push('Marcadores prohibidos: ' + analisis.marcadores.map((m) => m.etiqueta).join('; ') + '.');
  }
  if (analisis.placeholders && analisis.placeholders.huecos.total > 0) {
    // Cuando el analisis separa los huecos que bloquean de los que no (el
    // Anexo de Nube), el detalle nombra SOLO los que bloquean: decir "10
    // huecos" cuando tres los diligencia la Empresa al firmar y no bloquean
    // es una cuenta que no ayuda a nadie.
    const bloqueantes = analisis.huecos_bloqueantes
      ? analisis.huecos_bloqueantes
      : analisis.placeholders.huecos;
    if (bloqueantes.total > 0) {
      const muestra = bloqueantes.unicos.slice(0, 6).join(' ');
      partes.push(
        `Huecos por llenar: ${bloqueantes.total} `
        + `(${bloqueantes.unicos.length} distintos)`
        + (muestra ? `: ${muestra}.` : '.'),
      );
    }
  }
  if (analisis.placeholders && analisis.placeholders.sistema.total > 0) {
    partes.push(
      `Campos que registra el sistema: ${analisis.placeholders.sistema.total} `
      + '(no bloquean; los llena el sistema al firmar).',
    );
  }
  if (analisis.de_la_empresa && analisis.de_la_empresa.total > 0) {
    partes.push(
      `Campos que diligencia la Empresa al firmar: ${analisis.de_la_empresa.total} `
      + `(${analisis.de_la_empresa.unicos.join(' ')}); no bloquean: cambian en cada copia.`,
    );
  }
  if (partes.length === 0) {
    partes.push('Documento completo y sin placeholders.');
  }
  return partes.join(' ');
}

/**
 * Detalle del MODELO del Anexo de Nube.
 *
 * No usa `_detalleDocumento`: ese detalle lista los marcadores prohibidos como
 * si fueran un defecto, y en un modelo el aviso de "no firmar" es parte de su
 * naturaleza, no un defecto. Lo que el operador tiene que saber es qué datos
 * faltan y de quién son.
 *
 * @param {object} analisis el resultado de `analizarAnexoNube`
 * @returns {string}
 */
function _detalleModelo(analisis) {
  if (!analisis.existe) return 'El documento no está disponible.';
  const partes = [];
  if (analisis.faltan && analisis.faltan.length > 0) {
    partes.push('Faltan cláusulas: ' + analisis.faltan.map((f) => f.titulo).join('; ') + '.');
  }
  const hb = analisis.huecos_bloqueantes || { total: 0, unicos: [] };
  if (hb.total > 0) {
    partes.push(
      `Faltan ${hb.total} datos del owner (${hb.unicos.length} distintos): `
      + hb.unicos.join(' ') + '.',
    );
  }
  if (analisis.de_la_empresa && analisis.de_la_empresa.total > 0) {
    partes.push(
      `Los ${analisis.de_la_empresa.total} campos de la Empresa los diligencia cada Empresa `
      + 'en la copia que firma: no se diligencian en el modelo.',
    );
  }
  if (partes.length === 0) {
    partes.push('El modelo tiene todas las cláusulas y no le falta ningún dato del owner.');
  }
  return partes.join(' ');
}

/**
 * Analiza el Anexo de Nube.
 *
 * El archivo del repo es el MODELO: describe la nube de K+AIR y lo firma cada
 * Empresa con sus datos. Por eso hay dos formas de mirarlo:
 *
 *   - `ok`: el archivo sirve TAL CUAL como el documento que se firma. Exige
 *     cero marcadores: un documento que dice "no firmar" no se publica.
 *   - `modeloOk`: el archivo sirve como MODELO. Exige todas las clausulas y
 *     que no le falte ningun dato del Encargado. El aviso de "no firmar" es
 *     parte de la naturaleza de un modelo y no lo penaliza: lo que no puede
 *     es que le falten datos.
 *
 * Los tres campos que diligencia cada Empresa al firmar (nombre, NIT y
 * representante legal de la Empresa) no son huecos que el Encargado pueda
 * llenar: se listan, pero no bloquean.
 */
function analizarAnexoNube(texto) {
  const t = typeof texto === 'string' ? texto : '';
  const existe = t.length > 0;
  // Las clausulas y los corchetes se miran en el TEXTO RENDERIZADO: lo que
  // firma el Titular es el documento, no el HTML con entidades. El HASH sigue
  // siendo el del archivo, byte a byte.
  const v = _textoRenderizado(t);
  const faltan = _faltantes(v, REQUERIDOS_NUBE);
  const placeholders = listarPlaceholders(v);
  const legales = analizarTextoLegal(v);
  // El aviso de "no firmar" NO es una clausula del documento final: es un
  // aviso del MODELO. Su regla es coherente en los dos sentidos:
  //   - si el documento tiene datos pendientes, TIENE que advertirlo: el
  //     aviso de no firmar o cualquier marca de borrador. Si no, alguien lo
  //     diligencia a mano y se lleva un documento con huecos sin advertencia;
  //   - si no tiene datos pendientes, NO puede llevar el aviso de no firmar:
  //     no se firma un documento que dice "no firmar" (lo bloquea el marcador
  //     `NO_FIRMAR`).
  //
  // La regla NO depende de la redaccion exacta del aviso: cualquier marca de
  // borrador es una advertencia de que el documento esta a medias.
  // Los tres campos que diligencia la Empresa en la copia que firma (nombre,
  // NIT y representante legal de la Empresa) NO son huecos que el Encargado
  // pueda llenar: cambian en cada copia. Se LISTAN, pero no bloquean el
  // modelo. Los demas huecos (los que dependen de datos del owner) si
  // bloquean, y el detalle los nombra uno por uno.
  const ocurrencias = buscarPlaceholders(v);
  const deLaEmpresa = ocurrencias.filter(esPlaceholderDeLaEmpresa);
  const huecosBloqueantes = placeholders.huecos.total - deLaEmpresa.length;
  const unicosDeLaEmpresa = [...new Set(deLaEmpresa.map((s) => s.trim()))];

  const tieneAviso = Boolean(RE_AVISO_NO_FIRMAR) && RE_AVISO_NO_FIRMAR.test(v);
  if (huecosBloqueantes > 0 && !tieneAviso && legales.marcadores.length === 0) {
    faltan.push({
      id: 'aviso_sin_datos',
      titulo: 'Aviso de no firmar (el documento tiene datos pendientes y no lo advierte)',
    });
  }
  const clausulasOk = existe && faltan.length === 0;

  return {
    existe,
    clausulasOk,
    faltan,
    placeholders,
    marcadores: legales.marcadores,
    hash: _hash(t),
    huecosBloqueantes,
    huecos_bloqueantes: {
      total: huecosBloqueantes,
      unicos: placeholders.huecos.unicos.filter((u) => !esPlaceholderDeLaEmpresa(u)),
    },
    de_la_empresa: {
      total: deLaEmpresa.length,
      unicos: unicosDeLaEmpresa,
    },
    // `ok`: el archivo sirve TAL CUAL como el documento que se firma (con sus
    //   marcadores de borrador: un documento que dice "no firmar" no se
    //   publica).
    // `modeloOk`: el archivo sirve como MODELO: tiene todas las clausulas y
    //   no le falta ningun dato del Encargado. El aviso de "no firmar" es
    //   parte de la naturaleza de un modelo y no lo penaliza: lo que no se
    //   puede es que le falten datos.
    ok: clausulasOk && huecosBloqueantes === 0 && legales.marcadores.length === 0,
    modeloOk: clausulasOk && huecosBloqueantes === 0,
    detalle: '',
  };
}

/**
 * Analiza el Anexo de Encargo base. Es una plantilla: puede tener placeholders
 * de la Empresa, pero sus cláusulas y su remisión al Anexo de Nube tienen que
 * estar completas y no puede conservar la marca de revisión pendiente.
 */
function analizarAnexoEncargo(texto) {
  const t = typeof texto === 'string' ? texto : '';
  const existe = t.length > 0;
  // Igual que el Anexo de Nube: las clausulas se miran en el texto
  // renderizado, y el hash sigue siendo el del archivo.
  const v = _textoRenderizado(t);
  const faltan = _faltantes(v, REQUERIDOS_ENCARGO);
  const placeholders = listarPlaceholders(v);
  const legales = analizarTextoLegal(v);
  const clausulasOk = existe && faltan.length === 0 && legales.marcadores.length === 0;
  return {
    existe,
    clausulasOk,
    faltan,
    placeholders,
    marcadores: legales.marcadores,
    hash: _hash(t),
    ok: clausulasOk,
    detalle: '',
  };
}

/**
 * Analiza el texto de la v1.1. Exige las cláusulas del 8.6, el hold, los dos
 * días hábiles y el art. 2.2.4.6.13, y CERO placeholders.
 */
function analizarAcuerdo(texto, version = 'v1.1') {
  const t = typeof texto === 'string' ? texto : '';
  const existe = t.length > 0;
  const faltan = _faltantes(t, REQUERIDOS_ACUERDO);
  const placeholders = listarPlaceholders(t);
  const legales = analizarTextoLegal(t);
  const versionRe = new RegExp(
    'Versi[oó]n\\s+del\\s+Acuerdo:\\s*' + String(version).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    'i',
  );
  if (!versionRe.test(t)) {
    faltan.push({ id: 'version', titulo: `Versión del Acuerdo: ${version}` });
  }
  const clausulasOk = existe && faltan.length === 0;
  return {
    existe,
    clausulasOk,
    faltan,
    placeholders,
    marcadores: legales.marcadores,
    hash: _hash(t),
    ok: clausulasOk && placeholders.huecos.total === 0 && legales.marcadores.length === 0,
    detalle: '',
  };
}

// =============================================================================
// Items y grupos
// =============================================================================

function _item(id, titulo, estado, opciones = {}) {
  return {
    id,
    titulo,
    estado,
    bloquea: opciones.bloquea || [],
    detalle: opciones.detalle || '',
    accion: opciones.accion || '',
    referencia: opciones.referencia || null,
  };
}

function _grupo(id, titulo, items) {
  return {
    id,
    titulo,
    listo: !items.some((i) => i.estado === ESTADOS.PENDIENTE),
    items,
  };
}

function _estado(condicion) {
  return condicion ? ESTADOS.OK : ESTADOS.PENDIENTE;
}

function _accionSi(condicion, accion) {
  return condicion ? '' : accion;
}

function _proveedorOk(p) {
  return !!p
    && p.dpa === true
    && typeof p.version === 'string' && p.version.trim() !== ''
    && _fechaValida(p.fecha)
    && p.devolucion_supresion === true
    && p.auditoria === true
    && _texto(p.evidencia);
}

// =============================================================================
// Carga de documentos
// =============================================================================

function _cargarDocumentos(opciones = {}) {
  const rutaManifiesto = opciones.rutaManifiesto
    || (opciones.rutas && opciones.rutas.manifiesto)
    || RUTAS_DEFAULT.manifiesto;
  const manifiesto = opciones.manifiesto
    ? { existe: true, datos: opciones.manifiesto, error: null, archivo: 'manifiesto (inyectado)' }
    : _leerManifiesto(rutaManifiesto);
  const datos = manifiesto.datos || {};
  const rutas = { ...RUTAS_DEFAULT, ...(opciones.rutas || {}) };
  const rel = datos.acuerdo && datos.acuerdo.v1_1_archivo;
  if (rel && !(opciones.rutas && opciones.rutas.acuerdoV11)) {
    rutas.acuerdoV11 = path.isAbsolute(rel) ? rel : path.resolve(SERVICE_ROOT, rel);
  }
  const textos = opciones.textos || {};
  const etiquetaAcuerdo = (datos.acuerdo && datos.acuerdo.v1_1_archivo)
    || _rutaRelativa(rutas.acuerdoV11);
  return {
    manifiesto,
    datos,
    rutas,
    docNube: _textoDocumento(
      textos, 'anexoNube', rutas.anexoNube, 'legal/anexo-nube-v1.0.html',
    ),
    docEncargo: _textoDocumento(
      textos, 'anexoEncargo', rutas.anexoEncargo, 'legal/anexo-encargo.html',
    ),
    docAcuerdo: _textoDocumento(
      textos, 'acuerdoV11', rutas.acuerdoV11, etiquetaAcuerdo,
    ),
  };
}

// =============================================================================
// Evaluación principal
// =============================================================================

/**
 * Construye el reporte completo.
 *
 * @param {object} [opciones]
 * @param {'publicacion'|'primera_firma'} [opciones.gate='primera_firma']
 * @param {object|null} [opciones.db] conexión inyectada; `null` para saltar SQLite
 * @param {object} [opciones.config] configuración inyectada
 * @param {object} [opciones.manifiesto] manifiesto inyectado (tests)
 * @param {object} [opciones.textos] textos inyectados (tests)
 * @param {object} [opciones.rutas] rutas inyectadas (tests)
 * @returns {object}
 */
function evaluar(opciones = {}) {
  const gate = GATES.includes(opciones.gate) ? opciones.gate : 'primera_firma';
  const cfg = opciones.config || config;
  const dbConn = opciones.db === undefined ? db : opciones.db;
  const { manifiesto, datos, docNube, docEncargo, docAcuerdo } = _cargarDocumentos(opciones);

  const anNube = analizarAnexoNube(docNube.texto);
  const anEncargo = analizarAnexoEncargo(docEncargo.texto);
  const anAcuerdo = analizarAcuerdo(docAcuerdo.texto, 'v1.1');
  const retencion = _codigoRetencion(RUTAS_DEFAULT.retencion);
  const token = _codigoToken(RUTAS_DEFAULT.signRequest);

  const empresas = _resumenEmpresas(dbConn);
  const acuerdoActivo = _acuerdoActivo(dbConn);
  const tablas = {
    medios_trabajador: _tablaExiste(dbConn, 'gh_firma_medios_trabajador'),
    firmas_papel: _tablaExiste(dbConn, 'gh_firma_firmas_papel'),
    excepciones: _tablaExiste(dbConn, 'gh_firma_excepciones_habilitacion'),
    excepciones_eventos: _tablaExiste(dbConn, 'gh_firma_excepciones_habilitacion_eventos'),
    // El nombre NO lleva "firma_": la 028 crea `gh_solicitudes_titular` a
    // propósito, porque esa tabla no cuelga de ninguna firma (la 5B no la
    // alcanza). Buscar `gh_firma_solicitudes_titular` hacía que este check
    // NUNCA pudiera pasar: la migración 028 llevaba aplicada y el reporte
    // pedía "aplicar las migraciones 028/029", que ya estaban aplicadas.
    solicitudes_titular: _tablaExiste(dbConn, 'gh_solicitudes_titular'),
    trigger_excepciones_append_only: _triggerExiste(
      dbConn, 'trg_excepciones_habilitacion_eventos_no_update',
    ),
  };

  const enc = datos.encargado || {};
  const inf = datos.infraestructura || {};
  const sub = datos.subencargados || {};
  const cf = sub.cloudflare || {};
  const gg = sub.google || {};
  const anexoEncargoMan = datos.anexo_encargo || {};
  const anexoNubeMan = datos.anexo_nube || {};
  const n9a = datos.n9a || {};
  const n104 = datos.n10_4 || {};
  const d03 = datos.d03 || {};
  const d02 = datos.d02 || {};
  const pqrs = datos.pqrs || {};
  const tokenMan = datos.token_unico || {};
  const acMan = datos.acuerdo || {};

  const canalConfig = _normalizarCanal(cfg.canalProteccionDatos);
  const canalManifiesto = _normalizarCanal(enc.canal_proteccion_datos);
  const canalCoincide = !!canalConfig && canalConfig === canalManifiesto;
  const canalConfigValido = _canalValido(cfg.canalProteccionDatos);

  const versionActiva = acuerdoActivo && acuerdoActivo.version;
  // La autorización operativa de la versión vigente (decisión 1.f): sin ella,
  // la versión que está en vigor no tiene la evidencia técnica que autoriza
  // su publicación.
  const aprobacionOperativa = _aprobacionOperativaVigente(dbConn, acuerdoActivo);
  const publicadoV11 = dbConn
    ? _versionEsAlMenosV11(versionActiva)
    : acMan.publicado === true;
  const hashV11Ok = _esHashSha256(acMan.v1_1_hash)
    && anAcuerdo.existe
    && _hash(docAcuerdo.texto) === acMan.v1_1_hash.toLowerCase();

  // -------------------------------------------------------------------------
  // 1. Acuerdo v1.1
  // -------------------------------------------------------------------------
  const grupoAcuerdo = _grupo('acuerdo_v1_1', 'Acuerdo de uso v1.1', [
    _item(
      'texto_v1_1',
      'Texto completo, sin placeholders ni marcas de borrador',
      _estado(anAcuerdo.ok),
      {
        bloquea: GATE_AMBOS,
        detalle: _detalleDocumento(anAcuerdo),
        accion: _accionSi(anAcuerdo.ok,
          'Montar la §2 de la respuesta 11A como archivo nuevo, quitar corchetes y publicarlo con su propia huella.'),
        referencia: docAcuerdo.archivo,
      },
    ),
    _item(
      'hash_v1_1',
      'Huella del texto registrada en el manifiesto',
      _estado(hashV11Ok),
      {
        bloquea: GATE_AMBOS,
        detalle: _esHashSha256(acMan.v1_1_hash)
          ? (!anAcuerdo.existe
            ? 'No hay archivo de la v1.1 para comparar con el hash del manifiesto.'
            : (_hash(docAcuerdo.texto).toLowerCase() === acMan.v1_1_hash.toLowerCase()
              ? 'El hash del manifiesto coincide con el archivo.'
              : 'El hash del manifiesto NO coincide con el archivo actual.'))
          : 'El manifiesto todavía no tiene la huella de la v1.1.',
        // La acción dice lo que FALTA, no lo que ya se hizo. La huella ya
        // está en el manifiesto: lo que falta es el archivo aprobado (o que
        // el archivo y la huella digan lo mismo). Antes esta acción pedía
        // "registrarlo en legal-readiness.json" cuando ya estaba registrado,
        // y mandaba al operador a hacer algo inútil.
        accion: _accionSi(
          hashV11Ok,
          _esHashSha256(acMan.v1_1_hash)
            ? (!anAcuerdo.existe
              ? 'La huella ya está en el manifiesto: falta el archivo aprobado de la v1.1 '
                + '(entra al servidor cuando el abogado apruebe el texto).'
              : 'El archivo no coincide con la huella del manifiesto: recalcular su SHA-256 '
                + 'y actualizar legal-readiness.json → acuerdo.v1_1_hash.')
            : 'Calcular el SHA-256 del texto aprobado y registrarlo en legal-readiness.json.',
        ),
        referencia: 'legal-readiness.json → acuerdo.v1_1_hash',
      },
    ),
    _item(
      'publicado',
      'Versión v1.1 activa en la base',
      _estado(publicadoV11),
      {
        bloquea: GATE_AMBOS,
        detalle: versionActiva
          ? `La versión activa es ${versionActiva}.`
          : 'No hay una versión activa del Acuerdo.',
        accion: 'Publicar la v1.1 como versión activa después de cerrar los bloqueantes de publicación.',
        referencia: 'gh_firma_acuerdo_versiones',
      },
    ),
    _item(
      // Decisión 1.f (con el abogado): aprobar el texto NO autoriza a
      // publicarlo. La publicación exige una autorización operativa con
      // evidencia, y esta es la versión que está EN VIGOR: la que firma la
      // gente hoy. Por eso bloquea los dos gates.
      'aprobacion_operativa_vigente',
      'Aprobación operativa de la versión vigente',
      _estado(aprobacionOperativa.existe),
      {
        bloquea: GATE_AMBOS,
        detalle: !versionActiva
          ? 'No hay una versión activa del Acuerdo.'
          : (aprobacionOperativa.existe
            ? `La versión ${versionActiva} tiene autorización operativa `
              + `(aprobada por ${aprobacionOperativa.aprobado_por} el ${aprobacionOperativa.fecha}).`
            : `La versión ${versionActiva} no tiene autorización operativa registrada `
              + `para su texto (huella ${(acuerdoActivo && acuerdoActivo.texto_hash) || 'sin huella'}).`),
        accion: _accionSi(aprobacionOperativa.existe,
          'Registrar la autorización operativa de la versión vigente por '
          + 'POST /internal/admin/aprobaciones-publicacion (tipo OPERATIVA, con la '
          + 'garantía, el resultado de las verificaciones y el responsable del despliegue).'),
        referencia: 'gh_firma_aprobaciones_publicacion',
      },
    ),
    _item(
      'url_anexo_encargo',
      'URL pública del Anexo de Encargo',
      _estado(_urlValida(enc.url_anexo_encargo)),
      {
        bloquea: GATE_AMBOS,
        detalle: _urlValida(enc.url_anexo_encargo)
          ? 'URL declarada.'
          : 'Falta la URL pública del Anexo de Encargo.',
        accion: 'Publicar el Anexo de Encargo y registrar su URL en el manifiesto.',
        referencia: 'legal-readiness.json → encargado.url_anexo_encargo',
      },
    ),
    _item(
      'url_politica',
      'URL pública de la política de tratamiento',
      _estado(_urlValida(enc.url_politica)),
      {
        bloquea: GATE_AMBOS,
        detalle: _urlValida(enc.url_politica)
          ? 'URL declarada.'
          : 'Falta la URL de la política de tratamiento de datos del Encargado.',
        // OJO: el 1.2 y el 10.7 del Acuerdo remiten a la política de la EMPRESA
        // (la Responsable), no a la del Encargado. Esta es la del Encargado: la
        // que declara el manifiesto y a la que K+AIR se obliga en este anexo.
        accion: 'Publicar la política de tratamiento de datos del servicio de firma '
          + 'y registrar su URL en el manifiesto.',
        referencia: 'legal-readiness.json → encargado.url_politica',
      },
    ),
    _item(
      'canal_datos',
      'Persona/área y canal de protección de datos',
      _estado(canalConfigValido && canalCoincide && enc.canal_confirmado === true),
      {
        bloquea: GATE_AMBOS,
        detalle: !canalConfigValido
          ? 'El canal configurado no es un correo o una URL válida.'
          : (!canalManifiesto
            ? 'El manifiesto no declara el canal de protección de datos.'
            : (!canalCoincide
              ? 'El canal configurado y el documentado no coinciden.'
              : (enc.canal_confirmado !== true
                ? 'El canal no está marcado como confirmado y monitoreado.'
                : 'Canal válido, documentado y confirmado.'))),
        accion: 'Definir un canal único, confirmarlo, configurarlo y documentarlo en el manifiesto.',
        referencia: 'config.canalProteccionDatos + legal-readiness.json → encargado',
      },
    ),
    _item(
      'responsable_datos',
      'Persona o área responsable de la protección de datos',
      // Lo que la ley exige es DESIGNAR una persona o área (art. 2.2.2.25.4.4
      // del Decreto 1074 de 2015, que reproduce el art. 23 del Decreto 1377 de
      // 2013). NO exige un acta de designación: la SIC ha precisado que la Ley
      // 1581 y sus normas reglamentarias "no establecen un procedimiento
      // específico para la designación" (Resolución 384 de 2026, Secretaría
      // Jurídica Distrital, que cita a la SIC). La forma de documentarla la
      // define la organización; aquí es la declaración pública en el Anexo de
      // Encargo y en la política, que es verificable por un tercero. Exigir el
      // acta era un requisito que la ley no impone y que el owner no tiene.
      _estado(!!_texto(enc.responsable_datos)),
      {
        bloquea: GATE_AMBOS,
        detalle: _texto(enc.responsable_datos)
          ? `Persona o área designada: ${enc.responsable_datos}.`
          : 'Falta designar la persona o el área que asume la función de '
            + 'protección de datos y de trámite de las solicitudes de los titulares.',
        accion: 'Designar la persona o el área que asume la función de protección '
          + 'de datos (art. 2.2.2.25.4.4 del Decreto 1074 de 2015) y declararla en el '
          + 'Anexo de Encargo y en la política de tratamiento.',
        referencia: 'legal-readiness.json → encargado.responsable_datos',
      },
    ),
    _item(
      'nit_encargado',
      'NIT del Encargado (Gesstiar S.A.S.)',
      _estado(_nitValido(enc.nit)),
      {
        bloquea: GATE_AMBOS,
        detalle: _nitValido(enc.nit)
          ? 'NIT declarado.'
          : 'Falta el NIT del Encargado; no se puede identificar en el 1.5.',
        accion: 'Registrar el NIT real de Gesstiar S.A.S. en el manifiesto.',
        referencia: 'legal-readiness.json → encargado.nit',
      },
    ),
  ]);

  // -------------------------------------------------------------------------
  // 2. 9A
  // -------------------------------------------------------------------------
  const grupo9A = _grupo('n9a', '9A · Medios autorizados y firma autográfica', [
    _item(
      'prueba_9a',
      'Prueba de la 9A en el ambiente real',
      _estado(n9a.probada === true && !!_texto(n9a.evidencia)),
      {
        bloquea: GATE_AMBOS,
        detalle: n9a.probada === true && !!_texto(n9a.evidencia)
          ? 'Prueba registrada con evidencia.'
          : 'No hay evidencia de la prueba de la 9A en el ambiente real.',
        accion: 'Ejecutar la prueba de medios autorizados y firma autográfica, y guardar el resultado.',
        referencia: 'legal-readiness.json → n9a',
      },
    ),
    _item(
      'tablas_9a',
      'Tablas de medios autorizados y firmas en papel',
      _estado(tablas.medios_trabajador && tablas.firmas_papel),
      {
        bloquea: GATE_AMBOS,
        detalle: tablas.medios_trabajador && tablas.firmas_papel
          ? 'Las dos tablas existen.'
          : 'Falta alguna de las tablas de la 9A.',
        accion: 'Aplicar la migración 032 en el ambiente.',
        referencia: 'migración 032',
      },
    ),
  ]);

  // -------------------------------------------------------------------------
  // 3. 10.4
  // -------------------------------------------------------------------------
  const grupo104 = _grupo('n10_4', '10.4 · Migración a la versión vigente', [
    _item(
      'prueba_10_4',
      'Prueba de la 10.4 en el ambiente real',
      _estado(n104.probada === true && !!_texto(n104.evidencia)),
      {
        bloquea: GATE_AMBOS,
        detalle: n104.probada === true && !!_texto(n104.evidencia)
          ? 'Prueba registrada con evidencia.'
          : 'No hay evidencia de la prueba de migración a la versión vigente.',
        accion: 'Ejecutar la prueba de la 10.4 y guardar el resultado.',
        referencia: 'legal-readiness.json → n10_4',
      },
    ),
  ]);

  // -------------------------------------------------------------------------
  // 4. D-03
  // -------------------------------------------------------------------------
  const grupoD03 = _grupo('d03', 'D-03 · Bloqueo de empresas no habilitadas', [
    _item(
      'prueba_d03',
      'Prueba de D-03 en los cuatro puntos de bloqueo',
      _estado(d03.probada === true && !!_texto(d03.evidencia)),
      {
        bloquea: GATE_AMBOS,
        detalle: d03.probada === true && !!_texto(d03.evidencia)
          ? 'Prueba registrada con evidencia.'
          : 'No hay evidencia de la prueba de D-03.',
        accion: 'Probar creación, commit, consentimiento y doble firma, y guardar el resultado.',
        referencia: 'legal-readiness.json → d03',
      },
    ),
    _item(
      'tablas_d03',
      'Tablas de excepción de habilitación',
      _estado(tablas.excepciones && tablas.excepciones_eventos),
      {
        bloquea: GATE_AMBOS,
        detalle: tablas.excepciones && tablas.excepciones_eventos
          ? 'Las dos tablas existen.'
          : 'Falta alguna de las tablas de excepciones.',
        accion: 'Aplicar las migraciones 035 y 036.',
        referencia: 'migraciones 035/036',
      },
    ),
    _item(
      'append_only_d03',
      'Bitácora de excepciones append-only',
      _estado(tablas.trigger_excepciones_append_only),
      {
        bloquea: GATE_AMBOS,
        detalle: tablas.trigger_excepciones_append_only
          ? 'El trigger de no modificación existe.'
          : 'Falta el trigger que impide modificar o borrar la bitácora.',
        accion: 'Aplicar la migración 036.',
        referencia: 'migración 036',
      },
    ),
  ]);

  // -------------------------------------------------------------------------
  // 5. 8.6
  // -------------------------------------------------------------------------
  const clausulasAcuerdo = new Set(
    REQUERIDOS_ACUERDO.filter((r) => r.re.test(docAcuerdo.texto)).map((r) => r.id),
  );
  const texto86Ok = anAcuerdo.existe
    && clausulasAcuerdo.has('veinte_anios')
    && clausulasAcuerdo.has('hold')
    && clausulasAcuerdo.has('cinco_categorias');
  const grupo86 = _grupo('n86', '8.6 · Custodia de 20 años y hold', [
    _item(
      'codigo_20',
      'Código con ANIOS_CUSTODIA = 20',
      _estado(retencion.ok),
      {
        bloquea: GATE_AMBOS,
        detalle: retencion.detalle,
        accion: 'Corregir retencion.js para que aplique 20 años, la norma del 2.2.4.6.13 y el hold.',
        referencia: retencion.archivo,
      },
    ),
    _item(
      'texto_20',
      'Texto de la v1.1 con 20 años, hold y cinco categorías',
      _estado(texto86Ok),
      {
        bloquea: GATE_AMBOS,
        detalle: !anAcuerdo.existe
          ? 'No hay texto v1.1 para verificar.'
          : (texto86Ok
            ? 'El texto contiene las tres cláusulas del 8.6.'
            : 'Al texto le falta alguna de las cláusulas del 8.6.'),
        accion: 'Incluir el 8.6 completo en el texto de la v1.1.',
        referencia: docAcuerdo.archivo,
      },
    ),
  ]);

  // -------------------------------------------------------------------------
  // 6. D-02
  // -------------------------------------------------------------------------
  const grupoD02 = _grupo('d02', 'D-02 · Medio personal del OTP', [
    _item(
      'inventario_buzones',
      'Inventario de buzones corporativos',
      _estado(_enteroNoNegativo(d02.inventario_buzones)
        && !!_texto(d02.inventario_evidencia)),
      {
        bloquea: GATE_PRIMERA,
        detalle: _enteroNoNegativo(d02.inventario_buzones)
          ? `Buzones inventariados: ${d02.inventario_buzones}.`
          : 'Falta el número de casos en los que el OTP cae en un buzón corporativo.',
        accion: 'Correr el inventario de OTP_MEDIO_CORPORATIVO y guardar la evidencia.',
        referencia: 'legal-readiness.json → d02',
      },
    ),
    _item(
      'rechazo_buzon_corporativo',
      'El OTP a un buzón corporativo se rechaza siempre',
      ESTADOS.OK,
      {
        bloquea: GATE_PRIMERA,
        // POR QUÉ dice OK y no "pendiente": el rechazo ya es INCONDICIONAL en
        // el código (no depende de ningún interruptor de configuración), así
        // que no hay nada que encender antes de la primera firma real. Lo que
        // hay que PODER AUDITAR es el rastro: cada caso rechazado queda como
        // evento OTP_MEDIO_CORPORATIVO en gh_firma_eventos, que es append-only
        // (la migración 020 impide UPDATE y DELETE) y por eso no se puede
        // suprimir ni corregir.
        detalle: 'El rechazo del buzón corporativo es incondicional y el caso queda '
          + 'en el registro append-only de eventos (OTP_MEDIO_CORPORATIVO en '
          + 'gh_firma_eventos): se verifica en services/publicFlow.js, función '
          + '_controlarMedioCorporativo.',
        accion: 'Revisar que cada rechazo quedó en gh_firma_eventos antes de la primera firma real.',
        referencia: 'services/publicFlow.js · _controlarMedioCorporativo',
      },
    ),
    _item(
      'canal_papel',
      'Canal de firma en papel disponible para todas las empresas activas',
      empresas.total === 0
        ? ESTADOS.NO_APLICA
        : _estado(empresas.con_canal_pqrs === empresas.total),
      {
        bloquea: GATE_PRIMERA,
        detalle: empresas.total === 0
          ? 'No hay empresas activas: no hay primera firma posible.'
          : (empresas.con_canal_pqrs === empresas.total
            ? 'Todas las empresas activas tienen canal de atención.'
            : `${empresas.total - empresas.con_canal_pqrs} empresa(s) no tienen canal de atención.`),
        accion: 'Completar el canal de atención de cada empresa: con el rechazo del buzón corporativo ya incondicional, la vía en papel es la salida real del Trabajador y necesita un canal que funcione.',
        referencia: 'gh_firma_empresas.canal_pqrs',
      },
    ),
  ]);

  // -------------------------------------------------------------------------
  // 7. Anexo de Nube
  // -------------------------------------------------------------------------
  const nubeDocumentoOk = anNube.modeloOk;
  const partesOk = _nitValido(enc.nit)
    && !!_texto(enc.representante_legal)
    && !!_texto(enc.domicilio);
  const firmadoOk = anexoNubeMan.firmado === true
    && _fechaValida(anexoNubeMan.fecha)
    && !!_texto(anexoNubeMan.version)
    && _esHashSha256(anexoNubeMan.hash)
    && !!_texto(anexoNubeMan.evidencia);
  const ubicacionOk = !!_texto(inf.ubicacion_servidor);
  const operacionOk = !!_texto(inf.respaldos)
    && !!_texto(inf.monitoreo)
    && !!_texto(inf.soporte);
  const seguridadFisicaOk = !!_texto(inf.seguridad_fisica);
  const rtoRpoOk = _numeroPositivo(inf.rto_horas)
    && _numeroPositivo(inf.rpo_horas)
    && !!_texto(inf.plan_continuidad);
  const cfOk = _proveedorOk(cf);
  // 📦956 Una cuenta de Google de CONSUMIDOR no es subencargado: una cuenta
  // gratuita no tiene Data Processing Addendum, y el envio de correo con
  // datos personales es una transferencia internacional (art. 26 de la Ley
  // 1581). Antes el check exigia las clausulas de los DOS subencargados
  // (`cf && gg`), asi que con una cuenta de consumidor estos tres items no
  // podian quedar `ok` nunca: el gate no abria por mas que se llenara todo
  // lo demas. Google cuenta como subencargado solo si la cuenta es
  // Workspace/Cloud; en ese caso le aplican las mismas clausulas.
  //
  // 📦957 Y con una cuenta de consumidor el item de Google NO puede quedar
  // ok: el Acuerdo (10.1 y 10.5(f)) condiciona el papel de subencargado al
  // vinculo por contrato o DPA y prohibe transmitir datos personales a un
  // proveedor no vinculado. La cuenta de correo de consumo no habilita el
  // servicio: el item sigue pendiente, pero con el motivo real y las tres
  // salidas (cuenta Workspace/Cloud con DPA, otro proveedor de correo, o un
  // otrosi del Acuerdo aprobado por el abogado).
  const ggCuentaOk = gg.cuenta === 'workspace' || gg.cuenta === 'cloud';
  const ggEsConsumidor = gg.cuenta === 'consumidor';
  const ggOk = ggCuentaOk && _proveedorOk(gg);
  const googleOk = ggOk;
  const devolucionOk = cf.devolucion_supresion === true
    && (ggEsConsumidor || (ggCuentaOk && gg.devolucion_supresion === true));
  const auditoriaOk = cf.auditoria === true
    && (ggEsConsumidor || (ggCuentaOk && gg.auditoria === true));
  const exigirNube = cfg.exigirAnexoNube === true;
  const empresasNubeOk = !exigirNube
    ? true
    : (empresas.total > 0 && empresas.con_anexo_nube === empresas.total);

  const grupoNube = _grupo('anexo_nube', 'Anexo de Nube y subencargados', [
    _item(
      'documento_nube',
      'Anexo de Nube: el modelo con todas las cláusulas y sin datos pendientes',
      _estado(nubeDocumentoOk),
      {
        bloquea: GATE_PRIMERA,
        detalle: _detalleModelo(anNube),
        accion: 'Diligenciar en el modelo los datos que nombra el bloque de pendientes (los del owner). Los tres campos de la Empresa los llena cada Empresa en la copia que firma: no se diligencian en el modelo.',
        referencia: docNube.archivo,
      },
    ),
    _item(
      'partes_encargado',
      'Identificación del Encargado en el Anexo',
      _estado(partesOk),
      {
        bloquea: GATE_PRIMERA,
        detalle: partesOk
          ? 'NIT, representante y domicilio declarados.'
          : 'Falta NIT, representante legal o domicilio del Encargado.',
        accion: 'Registrar los datos reales del Encargado en el manifiesto.',
        referencia: 'legal-readiness.json → encargado',
      },
    ),
    _item(
      'firmado_nube',
      'Anexo de Nube firmado, con versión y hash',
      _estado(firmadoOk),
      {
        bloquea: GATE_PRIMERA,
        detalle: firmadoOk
          ? 'Anexo firmado con fecha, versión, hash y evidencia.'
          : 'Falta el Anexo de Nube firmado o su evidencia (fecha, versión, hash).',
        accion: 'Firmar el Anexo de Nube y registrar la evidencia en el manifiesto.',
        referencia: 'legal-readiness.json → anexo_nube',
      },
    ),
    _item(
      'ubicacion_servidor',
      'Ubicación física del servidor',
      _estado(ubicacionOk),
      {
        bloquea: GATE_PRIMERA,
        detalle: ubicacionOk
          ? 'Ubicación declarada.'
          : 'Falta la ciudad y el país del servidor.',
        accion: 'Declarar la ubicación real del servidor y su soporte contractual.',
        referencia: 'legal-readiness.json → infraestructura.ubicacion_servidor',
      },
    ),
    _item(
      'operacion',
      'Respaldos, monitoreo y soporte',
      _estado(operacionOk),
      {
        bloquea: GATE_PRIMERA,
        detalle: operacionOk
          ? 'Responsables de respaldos, monitoreo y soporte declarados.'
          : 'Falta el responsable de respaldos, monitoreo o soporte.',
        accion: 'Designar responsables y documentar la operación.',
        referencia: 'legal-readiness.json → infraestructura',
      },
    ),
    _item(
      'seguridad_fisica',
      'Seguridad física del local del servidor',
      _estado(seguridadFisicaOk),
      {
        bloquea: GATE_PRIMERA,
        detalle: seguridadFisicaOk
          ? 'Seguridad física declarada.'
          : 'Falta la seguridad física del local donde está el servidor.',
        accion: 'Declarar quién responde por el control de acceso al local, la energía y la conectividad.',
        referencia: 'legal-readiness.json → infraestructura.seguridad_fisica',
      },
    ),
    _item(
      'rto_rpo',
      'RTO, RPO y plan de continuidad',
      _estado(rtoRpoOk),
      {
        bloquea: GATE_PRIMERA,
        detalle: rtoRpoOk
          ? `RTO ${inf.rto_horas} h, RPO ${inf.rpo_horas} h y plan de continuidad.`
          : 'Falta RTO, RPO o plan de continuidad.',
        accion: 'Definir RTO/RPO y el plan de continuidad del servicio.',
        referencia: 'legal-readiness.json → infraestructura',
      },
    ),
    _item(
      'cloudflare_dpa',
      'DPA de Cloudflare',
      _estado(cfOk),
      {
        bloquea: GATE_PRIMERA,
        detalle: cfOk
          ? 'DPA de Cloudflare con versión, fecha, evidencia y cláusulas de devolución/auditoría.'
          : 'Falta el DPA de Cloudflare o alguna de sus cláusulas de devolución/auditoría.',
        accion: 'Adjuntar el DPA vigente de Cloudflare y registrar su evidencia.',
        referencia: 'legal-readiness.json → subencargados.cloudflare',
      },
    ),
    _item(
      'google_dpa',
      'DPA de Google y tipo de cuenta',
      _estado(googleOk),
      {
        bloquea: GATE_PRIMERA,
        detalle: ggEsConsumidor
          ? 'La cuenta es de consumidor: no hay DPA y el Acuerdo (10.5(f)) no permite transmitir datos personales a un proveedor sin contrato o DPA, así que la cuenta de correo no habilita el servicio. Google no actúa como subencargado y el envío sería una transferencia internacional (art. 26 de la Ley 1581).'
          : (ggOk
            ? 'DPA de Google con cuenta Workspace/Cloud y evidencia.'
            : (ggCuentaOk
              ? 'Falta el DPA de Google o alguna de sus cláusulas (devolución/supresión o auditoría).'
              : 'Falta declarar el tipo de cuenta de Google (Workspace/Cloud o de consumidor).')),
        accion: ggEsConsumidor
          ? 'Usar una cuenta Workspace/Cloud con DPA, cambiar el proveedor de correo, o un otrosí del Acuerdo aprobado por el abogado.'
          : 'Usar una cuenta Workspace/Cloud con DPA, o documentar la transferencia y la autorización.',
        referencia: 'legal-readiness.json → subencargados.google',
      },
    ),
    _item(
      'devolucion_supresion',
      'Devolución y supresión en los subencargados',
      _estado(devolucionOk),
      {
        bloquea: GATE_PRIMERA,
        detalle: devolucionOk
          ? (ggEsConsumidor
            ? 'Cloudflare acepta devolución y supresión; Google no es subencargado en una cuenta de consumidor.'
            : 'Cloudflare y Google aceptan devolución y supresión.')
          : 'Falta la cláusula de devolución/supresión en Cloudflare o Google.',
        accion: 'Verificar y documentar la devolución/supresión en los DPAs de los subencargados.',
        referencia: 'legal-readiness.json → subencargados',
      },
    ),
    _item(
      'auditoria',
      'Auditoría en los subencargados',
      _estado(auditoriaOk),
      {
        bloquea: GATE_PRIMERA,
        detalle: auditoriaOk
          ? (ggEsConsumidor
            ? 'Cloudflare permite auditoría; Google no es subencargado en una cuenta de consumidor.'
            : 'Cloudflare y Google permiten auditoría.')
          : 'Falta la cláusula de auditoría en Cloudflare o Google.',
        accion: 'Verificar y documentar la auditoría en los DPAs de los subencargados.',
        referencia: 'legal-readiness.json → subencargados',
      },
    ),
    _item(
      'empresas_nube',
      'Anexo de Nube registrado por empresa',
      exigirNube
        ? (empresas.total === 0
          ? ESTADOS.NO_APLICA
          : _estado(empresasNubeOk))
        : ESTADOS.AVISO,
      {
        bloquea: exigirNube ? GATE_PRIMERA : [],
        detalle: !exigirNube
          ? 'En este ambiente no se exige el Anexo de Nube; en producción se exigirá a cada empresa activa.'
          : (empresas.total === 0
            ? 'No hay empresas activas: no hay primera firma posible.'
            : (empresasNubeOk
              ? 'Todas las empresas activas tienen Anexo de Nube registrado.'
              : `${empresas.total - empresas.con_anexo_nube} empresa(s) no tienen Anexo de Nube registrado.`)),
        accion: 'Registrar el Anexo de Nube firmado por cada empresa antes de la primera firma.',
        referencia: 'gh_firma_empresas.anexo_nube_firmado_at',
      },
    ),
  ]);

  // -------------------------------------------------------------------------
  // 8. Anexo de Encargo
  // -------------------------------------------------------------------------
  const estadoEncargo = _texto(anexoEncargoMan.estado) || 'desconocido';
  const encargoFirmadoOk = estadoEncargo === 'firmado'
    && _fechaValida(anexoEncargoMan.fecha)
    && !!_texto(anexoEncargoMan.evidencia);
  const encargoEstadoOk = encargoFirmadoOk;
  const encargoDocumentoOk = anEncargo.clausulasOk;
  // Una fecha no nula en la ficha NO es evidencia por si sola: puede ser una
  // marca de prueba o un dato cargado a mano. La evidencia vive en el
  // manifiesto (`anexo_encargo.estado === 'firmado'` + fecha + archivo). Sin
  // esa evidencia, el item no puede salir OK: queda en AVISO, que tambien
  // bloquea el gate de primera firma.
  const faltanAnexoBase = Math.max(0, empresas.total - empresas.con_anexo_base);
  let estadoEmpresasBase = ESTADOS.NO_APLICA;
  if (empresas.total > 0) {
    if (faltanAnexoBase > 0) estadoEmpresasBase = ESTADOS.PENDIENTE;
    else if (!encargoFirmadoOk) estadoEmpresasBase = ESTADOS.AVISO;
    else estadoEmpresasBase = ESTADOS.OK;
  }
  const empresasBaseOk = estadoEmpresasBase === ESTADOS.OK;
  const detalleEmpresasBase = [];
  if (faltanAnexoBase > 0) {
    detalleEmpresasBase.push(`${faltanAnexoBase} empresa(s) sin fecha de Anexo registrada`);
  }
  if (!encargoFirmadoOk && empresas.con_anexo_base > 0) {
    detalleEmpresasBase.push(
      'hay fechas en la ficha pero el manifiesto no tiene la evidencia del Anexo firmado',
    );
  }
  if (empresas.fechas_antes_del_alta > 0) {
    detalleEmpresasBase.push(
      `${empresas.fechas_antes_del_alta} fecha(s) anterior(es) al alta en el sistema; confirmar contra el PDF`,
    );
  }
  const detalleOkEmpresasBase = 'Todas las empresas activas tienen Anexo de Encargo firmado '
    + 'y la evidencia esta en el manifiesto.'
    + (empresas.fechas_antes_del_alta > 0
      ? ` ${empresas.fechas_antes_del_alta} fecha(s) anterior(es) al alta en el sistema; confirmar contra el PDF.`
      : '');

  const grupoEncargo = _grupo('anexo_encargo', 'Anexo de Encargo base', [
    _item(
      'estado_encargo',
      'Estado real del Anexo de Encargo resuelto',
      _estado(encargoEstadoOk),
      {
        bloquea: GATE_PRIMERA,
        detalle: estadoEncargo === 'firmado'
          ? (encargoFirmadoOk
            ? 'Firmado con fecha y evidencia.'
            : 'Está marcado como firmado, pero falta la fecha o la evidencia.')
          : (estadoEncargo === 'no_firmado'
            ? 'No está firmado.'
            : 'El estado es desconocido.'),
        accion: estadoEncargo === 'firmado'
          ? 'Adjuntar la fecha y la evidencia del Anexo firmado.'
          : 'Resolver el estado real: firmar el Anexo de Encargo vigente (el que incorpora '
            + 'el Anexo de Nube) y registrar la fecha y la evidencia en el manifiesto.',
        referencia: 'legal-readiness.json → anexo_encargo',
      },
    ),
    _item(
      'documento_encargo',
      'Plantilla alineada con el Anexo de Nube',
      encargoDocumentoOk
        ? (anEncargo.placeholders.huecos.total > 0 ? ESTADOS.AVISO : ESTADOS.OK)
        : ESTADOS.PENDIENTE,
      {
        bloquea: encargoDocumentoOk ? [] : GATE_PRIMERA,
        detalle: _detalleDocumento(anEncargo),
        accion: encargoDocumentoOk
          ? ''
          : (anEncargo.faltan.length === 0
            ? 'Quitar la marca de revisión pendiente: las cláusulas y la remisión al Anexo '
              + 'de Nube ya están. La marca solo se quita cuando el abogado revise el documento.'
            : 'Agregar las cláusulas que faltan (remisión al Anexo de Nube, sustitución u '
              + 'otrosí, art. 2.2.4.6.13, veinte años y servicio en la nube) y quitar la '
              + 'marca de revisión pendiente.'),
        referencia: docEncargo.archivo,
      },
    ),
    _item(
      'empresas_base',
      'Anexo de Encargo firmado por cada empresa activa',
      estadoEmpresasBase,
      {
        bloquea: GATE_PRIMERA,
        detalle: empresas.total === 0
          ? 'No hay empresas activas: no hay primera firma posible.'
          : (empresasBaseOk
            ? detalleOkEmpresasBase
            : `${detalleEmpresasBase.join('; ')}.`),
        accion: empresasBaseOk
          ? ''
          : 'Completar la fecha de cada empresa y adjuntar el PDF firmado con su '
            + 'fecha y evidencia en legal-readiness.json → anexo_encargo.',
        referencia: 'gh_firma_empresas.anexo_encargo_firmado_at + legal-readiness.json → anexo_encargo',
      },
    ),
  ]);

  // -------------------------------------------------------------------------
  // 9. PQRS
  // -------------------------------------------------------------------------
  const pqrsCanalValido = _canalValido(pqrs.canal);
  const pqrsPlazoOk = cfg.plazoTramiteDias === 2 && Number(pqrs.plazo_dias) === 2;
  const grupoPqrs = _grupo('pqrs', 'PQRS y canal de atención', [
    _item(
      'canal_pqrs',
      'Canal único de PQRS',
      _estado(pqrsCanalValido && !!_texto(pqrs.responsable)),
      {
        bloquea: GATE_AMBOS,
        detalle: !pqrsCanalValido
          ? 'Falta el canal único de PQRS (correo o URL).'
          : (!_texto(pqrs.responsable)
            ? 'Falta la persona o área responsable del canal.'
            : 'Canal y responsable declarados.'),
        accion: 'Definir un canal único (formulario o endpoint) con responsable y publicarlo.',
        referencia: 'legal-readiness.json → pqrs',
      },
    ),
    _item(
      'plazo_pqrs',
      'Plazo de traslado de dos (2) días hábiles',
      _estado(pqrsPlazoOk),
      {
        bloquea: GATE_AMBOS,
        detalle: pqrsPlazoOk
          ? 'El sistema y el manifiesto usan 2 días hábiles.'
          : `El sistema usa ${cfg.plazoTramiteDias} día(s) y el manifiesto ${pqrs.plazo_dias}.`,
        accion: 'Alinear el plazo a 2 días hábiles (art. 15.1 de la Ley 1581).',
        referencia: 'config.plazoTramiteDias + legal-readiness.json → pqrs.plazo_dias',
      },
    ),
    _item(
      'tabla_solicitudes',
      'Tabla de solicitudes del Titular',
      _estado(tablas.solicitudes_titular),
      {
        bloquea: GATE_AMBOS,
        detalle: tablas.solicitudes_titular
          ? 'La tabla existe.'
          : 'Falta la tabla gh_solicitudes_titular en la base.',
        accion: 'Aplicar la migración 028, que crea la tabla gh_solicitudes_titular.',
        referencia: 'migración 028',
      },
    ),
  ]);

  // -------------------------------------------------------------------------
  // 10. Token único (informativo, no bloquea)
  // -------------------------------------------------------------------------
  const grupoToken = _grupo('token_unico', 'Token único y rotación', [
    _item(
      'codigo_token',
      'Código con token hasheado y rotación',
      _estado(token.ok),
      {
        bloquea: [],
        detalle: token.detalle,
        accion: token.ok ? '' : 'Revisar la rotación y el almacenamiento del token.',
        referencia: token.archivo,
      },
    ),
    _item(
      'prueba_token',
      'Prueba de token único en el ambiente real',
      _estado(tokenMan.probada === true && !!_texto(tokenMan.evidencia)),
      {
        bloquea: [],
        detalle: tokenMan.probada === true && !!_texto(tokenMan.evidencia)
          ? 'Prueba registrada con evidencia.'
          : 'Falta la evidencia de la prueba de token único.',
        accion: 'Probar que el token anterior no se puede reutilizar y guardar el resultado.',
        referencia: 'legal-readiness.json → token_unico',
      },
    ),
  ]);

  const grupos = [
    grupoAcuerdo,
    grupo9A,
    grupo104,
    grupoD03,
    grupo86,
    grupoD02,
    grupoNube,
    grupoEncargo,
    grupoPqrs,
    grupoToken,
  ];
  const items = grupos.flatMap((g) => g.items);
  const bloqueantes = items.filter((i) => i.bloquea.includes(gate));
  const bloqueantesPendientes = bloqueantes.filter(
    (i) => i.estado !== ESTADOS.OK && i.estado !== ESTADOS.NO_APLICA,
  );
  const contar = (estado) => items.filter((i) => i.estado === estado).length;

  return {
    generado_at: new Date().toISOString(),
    gate,
    listo: bloqueantesPendientes.length === 0,
    resumen: {
      total_items: items.length,
      ok: contar(ESTADOS.OK),
      pendientes: contar(ESTADOS.PENDIENTE),
      avisos: contar(ESTADOS.AVISO),
      no_aplica: contar(ESTADOS.NO_APLICA),
      bloqueantes: bloqueantes.length,
      bloqueantes_pendientes: bloqueantesPendientes.length,
    },
    manifiesto: {
      existe: manifiesto.existe,
      archivo: manifiesto.archivo,
      error: manifiesto.error,
      version: datos.version || null,
      actualizado_at: datos.actualizado_at || null,
    },
    db: {
      disponible: empresas.disponible,
      acuerdo_activo: acuerdoActivo
        ? {
          version: acuerdoActivo.version,
          texto_hash: acuerdoActivo.texto_hash,
          fecha_vigencia_inicio: acuerdoActivo.fecha_vigencia_inicio,
        }
        : null,
      empresas,
      tablas,
    },
    documentos: {
      acuerdo_v1_1: {
        archivo: docAcuerdo.archivo,
        existe: anAcuerdo.existe,
        hash: anAcuerdo.hash,
        placeholders: anAcuerdo.placeholders,
        marcadores: anAcuerdo.marcadores,
        clausulas_ok: anAcuerdo.clausulasOk,
        faltan: anAcuerdo.faltan,
      },
      anexo_nube: {
        archivo: docNube.archivo,
        existe: anNube.existe,
        hash: anNube.hash,
        placeholders: anNube.placeholders,
        marcadores: anNube.marcadores,
        clausulas_ok: anNube.clausulasOk,
        faltan: anNube.faltan,
      },
      anexo_encargo: {
        archivo: docEncargo.archivo,
        existe: anEncargo.existe,
        hash: anEncargo.hash,
        placeholders: anEncargo.placeholders,
        marcadores: anEncargo.marcadores,
        clausulas_ok: anEncargo.clausulasOk,
        faltan: anEncargo.faltan,
      },
    },
    grupos,
    bloqueantes: bloqueantes.map((i) => ({
      grupo: (grupos.find((g) => g.items.includes(i)) || {}).id || null,
      id: i.id,
      titulo: i.titulo,
      estado: i.estado,
      detalle: i.detalle,
      accion: i.accion,
    })),
    pendientes: bloqueantesPendientes.map((i) => ({
      grupo: (grupos.find((g) => g.items.includes(i)) || {}).id || null,
      id: i.id,
      titulo: i.titulo,
      detalle: i.detalle,
      accion: i.accion,
    })),
  };
}

/**
 * Analiza solo los documentos, sin tocar la base ni la configuración. Es lo
 * que usa el validador de anexos para responder rápido en un pre-commit.
 *
 * @param {object} [opciones] mismas opciones de rutas/textos/manifiesto
 * @returns {{acuerdo_v1_1: object, anexo_nube: object, anexo_encargo: object}}
 */
function analizarAnexos(opciones = {}) {
  const { docNube, docEncargo, docAcuerdo } = _cargarDocumentos(opciones);
  const nube = analizarAnexoNube(docNube.texto);
  const encargo = analizarAnexoEncargo(docEncargo.texto);
  const acuerdo = analizarAcuerdo(docAcuerdo.texto, 'v1.1');
  return {
    acuerdo_v1_1: { archivo: docAcuerdo.archivo, ...acuerdo },
    anexo_nube: { archivo: docNube.archivo, ...nube },
    anexo_encargo: { archivo: docEncargo.archivo, ...encargo },
  };
}

// =============================================================================
// Reporte de texto
// =============================================================================

function _marca(estado) {
  if (estado === ESTADOS.OK) return '[OK]';
  if (estado === ESTADOS.PENDIENTE) return '[PENDIENTE]';
  if (estado === ESTADOS.AVISO) return '[AVISO]';
  return '[N/A]';
}

function _resumenDocumento(doc) {
  if (!doc || !doc.existe) return 'no disponible';
  const partes = [];
  if (doc.clausulas_ok) partes.push('cláusulas ok');
  else partes.push(`faltan ${doc.faltan.length} cláusula(s)`);
  if (doc.placeholders && doc.placeholders.huecos.total > 0) {
    partes.push(`${doc.placeholders.huecos.total} hueco(s) por llenar`);
  }
  if (doc.placeholders && doc.placeholders.sistema.total > 0) {
    partes.push(`${doc.placeholders.sistema.total} campo(s) del sistema`);
  }
  if (doc.marcadores && doc.marcadores.length > 0) {
    partes.push(`${doc.marcadores.length} marca(s) prohibida(s)`);
  }
  return partes.join(', ');
}

/**
 * Genera una salida legible para la consola.
 *
 * @param {object} reporte
 * @returns {string}
 */
function generarReporteTexto(reporte) {
  const r = reporte || {};
  const lineas = [];
  lineas.push('='.repeat(78));
  lineas.push('AUDITORÍA DE READINESS LEGAL — K+AIR');
  lineas.push('='.repeat(78));
  lineas.push(`Generado: ${r.generado_at || 'sin fecha'}`);
  lineas.push(`Gate: ${r.gate || 'primera_firma'} — ${r.listo ? 'LISTO' : 'NO LISTO'}`);
  if (r.resumen) {
    lineas.push(
      `Items: ${r.resumen.total_items} · OK: ${r.resumen.ok} · `
      + `Pendientes: ${r.resumen.pendientes} · Avisos: ${r.resumen.avisos} · `
      + `N/A: ${r.resumen.no_aplica}`,
    );
    lineas.push(
      `Bloqueantes de este gate: ${r.resumen.bloqueantes} · `
      + `Pendientes: ${r.resumen.bloqueantes_pendientes}`,
    );
  }
  lineas.push('');
  lineas.push('Documentos:');
  lineas.push(`  v1.1:           ${_resumenDocumento(r.documentos && r.documentos.acuerdo_v1_1)}`);
  lineas.push(`  Anexo de Nube:  ${_resumenDocumento(r.documentos && r.documentos.anexo_nube)}`);
  lineas.push(`  Anexo Encargo:  ${_resumenDocumento(r.documentos && r.documentos.anexo_encargo)}`);
  lineas.push('');

  for (const grupo of (r.grupos || [])) {
    lineas.push(`-- ${grupo.titulo} (${grupo.id}) --`);
    for (const item of grupo.items) {
      const bloquea = item.bloquea && item.bloquea.includes(r.gate) ? ' *' : '';
      lineas.push(`  ${_marca(item.estado)} ${item.titulo}${bloquea}`);
      if (item.detalle) lineas.push(`      ${item.detalle}`);
      if (item.estado !== ESTADOS.OK
        && item.estado !== ESTADOS.NO_APLICA
        && item.accion) {
        lineas.push(`      -> ${item.accion}`);
      }
    }
    lineas.push('');
  }

  lineas.push('(*) Bloquea el gate consultado.');
  lineas.push('');
  if (r.listo) {
    lineas.push('No hay bloqueantes pendientes para este gate.');
  } else {
    lineas.push(`Faltan ${r.pendientes.length} bloqueante(s) para este gate:`);
    for (const p of r.pendientes) {
      lineas.push(`  - [${p.grupo}] ${p.titulo}`);
      if (p.accion) lineas.push(`    ${p.accion}`);
    }
  }
  lineas.push('');
  lineas.push('Este reporte no publica, no firma y no enciende D-02.');
  return lineas.join('\n');
}

module.exports = {
  GATES,
  ESTADOS,
  RUTAS_DEFAULT,
  analizarAnexoNube,
  analizarAnexoEncargo,
  analizarAcuerdo,
  analizarAnexos,
  evaluar,
  generarReporteTexto,
  // Exportadas para tests y para el validador.
  _internos: {
    _hash,
    _nitValido,
    _canalValido,
    _urlValida,
    _fechaValida,
    _resumenEmpresas,
    _codigoRetencion,
    _codigoToken,
    _cargarDocumentos,
  },
};

'use strict';
/**
 * main/gh-plantilla-campos.js — 📦GPE · Mapa de campos a etiquetas de la plantilla.
 *
 * POR QUE EXISTE: el editor (plantillas-editar) guarda los datos corregidos
 * en `contenido.datosEditados.valores`, con claves estables
 * (TRABAJADOR_NOMBRE, TRABAJADOR_CEDULA, …). Para que esos datos lleguen al
 * PDF que se firma, el motor (gh-render-plantilla) tiene que saber DONDE
 * va cada valor: la etiqueta de la plantilla donde se dibuja.
 *
 * Las plantillas que se suben son formularios EN BLANCO (etiqueta y espacio
 * vacío), no documentos con marcadores: por eso el mapa es de ETIQUETAS y no
 * de marcadores. Cada campo declara VARIAS etiquetas candidatas (el mismo
 * dato aparece con nombres distintos según el formato y la versión) y gana la
 * PRIMERA que se encuentre en el PDF.
 *
 * REGLA: gana la primera etiqueta que se encuentre; si ninguna aparece, el
 * motor lo REPORTA (no falla en silencio): un valor que no se aplicó es un
 * dato que no llegó al documento, y eso hay que verlo.
 *
 * PARA AJUSTAR UNA PLANTILLA NUEVA: agregar la etiqueta que usa el formato
 * (la que se ve impresa en el PDF) al final de la lista del campo. No hay
 * que tocar código.
 */

// Normaliza para COMPARAR: mayusculas, sin tildes, espacios colapsados.
// ("No. CEDULA:" == "NO CEDULA" == "NÚMERO DE CÉDULA")
function normalizar(texto) {
  return String(texto == null ? '' : texto)
    .toUpperCase()
    .replace(/[\u00C0-\u00D6]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 32); })
    .replace(/[\u00F8-\u00FF]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 32); })
    .replace(/[\u00DF\u00F7]/g, 'S')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

// Etiquetas candidatas por tipo de documento.
// La clave es el tipo de gh_templates (tipo_documento) y del documento.
var CAMPOS_POR_TIPO = {
  // ── Contrato laboral ────────────────────────────────────────────────────
  contrato: {
    TRABAJADOR_NOMBRE: ['NOMBRE COMPLETO', 'NOMBRES Y APELLIDOS', 'NOMBRE DEL TRABAJADOR', 'NOMBRES'],
    TRABAJADOR_CEDULA: ['NUMERO DE CEDULA', 'N DE CEDULA', 'CEDULA DEL TRABAJADOR', 'CEDULA'],
    TRABAJADOR_CARGO: ['CARGO DEL TRABAJADOR', 'CARGO'],
    TRABAJADOR_SALARIO: ['SUELDO MENSUAL', 'SALARIO MENSUAL', 'SALARIO'],
    TRABAJADOR_FECHA_INGRESO: ['FECHA DE INGRESO A LA EMPRESA', 'FECHA DE INGRESO'],
    TRABAJADOR_SEDE: ['SEDE DE TRABAJO', 'LUGAR DE TRABAJO', 'SEDE'],
    TRABAJADOR_EMPRESA_USUARIA: ['EMPRESA USUARIA'],
    EMPRESA_NOMBRE: ['RAZON SOCIAL', 'EMPRESA CONTRATANTE', 'NOMBRE DE LA EMPRESA'],
    DOC_TIPO: ['TIPO DE CONTRATO', 'TIPO DE DOCUMENTO']
  },

  // ── Actualización de datos ───────────────────────────────────────────────
  actualizacion_datos: {
    TRABAJADOR_NOMBRE: ['NOMBRES', 'NOMBRE COMPLETO'],
    TRABAJADOR_CEDULA: ['NO CEDULA', 'NUMERO DE CEDULA', 'CEDULA'],
    TRABAJADOR_CARGO: ['CARGO'],
    TRABAJADOR_SALARIO: ['SUELDO', 'SALARIO'],
    TRABAJADOR_FECHA_INGRESO: ['FECHA DE INGRESO'],
    TRABAJADOR_SEDE: ['CIUDAD MUNICIPIO', 'SEDE'],
    TRABAJADOR_EMPRESA_USUARIA: ['EMPRESA USUARIA'],
    EMPRESA_NOMBRE: ['EMPRESA CONTRATANTE', 'RAZON SOCIAL']
  },

  // ── Autorización de datos sensibles ─────────────────────────────────────
  autorizacion_datos: {
    TRABAJADOR_NOMBRE: ['NOMBRE COMPLETO', 'NOMBRES Y APELLIDOS', 'NOMBRE'],
    TRABAJADOR_CEDULA: ['NUMERO DE CEDULA', 'CEDULA', 'NIT'],
    TRABAJADOR_CARGO: ['CARGO'],
    TRABAJADOR_SALARIO: ['SALARIO', 'SUELDO'],
    TRABAJADOR_FECHA_INGRESO: ['FECHA DE INGRESO'],
    TRABAJADOR_SEDE: ['SEDE', 'CIUDAD'],
    TRABAJADOR_EMPRESA_USUARIA: ['EMPRESA USUARIA', 'NOMBRE EMPRESA'],
    EMPRESA_NOMBRE: ['NOMBRE EMPRESA', 'RAZON SOCIAL']
  }
};

// Tipos que todavía no tienen mapa: el motor los reporta y no aplica nada.
var TIPOS_CON_MAPA = Object.keys(CAMPOS_POR_TIPO);

/**
 * Devuelve las etiquetas candidatas de un campo para un tipo de documento.
 * Si el tipo no tiene mapa, se cae al mapa generico (contrato) para que la
 * edicion siga siendo posible y el reporte diga que el mapa es provisional.
 */
function etiquetasDe(tipoDocumento, clave) {
  var mapa = CAMPOS_POR_TIPO[tipoDocumento] || CAMPOS_POR_TIPO.contrato;
  return mapa[clave] || [];
}

function tieneMapa(tipoDocumento) {
  return TIPOS_CON_MAPA.indexOf(tipoDocumento) >= 0;
}

module.exports = {
  CAMPOS_POR_TIPO: CAMPOS_POR_TIPO,
  TIPOS_CON_MAPA: TIPOS_CON_MAPA,
  normalizar: normalizar,
  etiquetasDe: etiquetasDe,
  tieneMapa: tieneMapa
};

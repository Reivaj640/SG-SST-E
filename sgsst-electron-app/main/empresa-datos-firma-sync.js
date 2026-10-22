/**
 * 📦927 · Mezcla pura entre los datos locales de identificación de la empresa
 * y la fila que ya existe en el firma-service.
 *
 * POR QUÉ EXISTE
 * -------------
 * `empresaService.update()` del firma-service NO hace merge: todos los campos
 * de `EDITABLE_FIELDS` que no lleguen en el body se guardan como `null`, y
 * `plazo_retencion_dias` se escribe siempre. Si el PC mandara solo lo que el
 * formulario muestra, borraría `razon_social`, el plazo de conservación, el
 * canal de copia y el deber legal.
 *
 * Por eso el bridge hace GET + esta mezcla + PUT. Este archivo no toca red ni
 * base de datos: recibe la fila existente, los datos locales y el
 * representante legal, y devuelve el body exacto del PUT.
 *
 * REGLAS
 * ------
 * - Los campos que el formulario no maneja se copian de la fila existente.
 * - Un campo local vacío NO borra el valor del servidor: se preserva.
 * - `dominios_corporativos` no se incluye (el service lo preserva si falta).
 * - Si el documento del representante ya está cifrado en el servidor
 *   (`enc:...`), no se reemplaza por texto plano.
 */
'use strict';

function _txt(v) {
  if (typeof v !== 'string') return '';
  return v.trim();
}

function _first() {
  for (let i = 0; i < arguments.length; i++) {
    const v = _txt(arguments[i]);
    if (v) return v;
  }
  return '';
}

function _joinDomicilio(local) {
  const partes = [
    _txt(local && local.domicilio),
    _txt(local && local.domicilioMunicipio),
    _txt(local && local.domicilioDepartamento),
  ].filter(Boolean);
  return partes.join(', ');
}

function _formatRepId(representante) {
  const numero = _txt(representante && representante.numeroIdentificacion);
  if (!numero) return '';
  const tipo = _txt(representante && representante.tipoIdentificacion) || 'CC';
  return (tipo + ' ' + numero).trim();
}

function _limite(campo, valor, max) {
  if (valor && valor.length > max) {
    throw new Error(campo + ' excede ' + max + ' caracteres');
  }
  return valor || null;
}

/**
 * Construye el body del PUT /internal/admin/empresas/:id.
 *
 * @param {object} existing - fila actual del firma-service (GET admin)
 * @param {object} local - datos del formulario local
 * @param {object} representante - { nombre, tipoIdentificacion, numeroIdentificacion }
 * @returns {object} body con los 12 campos editables + plazo/deber legal
 */
function buildEmpresaUpdate(existing, local, representante) {
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
    throw new Error('existing es requerido (fila de la empresa en el servidor)');
  }
  local = local || {};
  representante = representante || {};

  const existenteRepId = _txt(existing.representante_legal_identificacion);
  const localRepId = _formatRepId(representante);
  const repId = existenteRepId.indexOf('enc:') === 0
    ? existenteRepId
    : (localRepId || existenteRepId);

  const domicilio = _joinDomicilio(local);
  if (domicilio.length > 300) {
    throw new Error('El domicilio completo excede 300 caracteres');
  }

  const body = {
    // La razón social NO se toma del nombre corto de la empresa local
    // ("Aseplus" no es una razón social). Se conserva la del servidor.
    razon_social: _first(existing.razon_social, local.razonSocial),
    nit: _first(local.nit, existing.nit),
    domicilio: _first(domicilio, existing.domicilio),
    representante_legal: _first(representante.nombre, existing.representante_legal),
    representante_legal_identificacion: repId,
    responsable_tratamiento: _first(local.responsableNombre, existing.responsable_tratamiento),
    responsable_tratamiento_correo: _first(
      local.responsableCorreo,
      local.canalContacto,
      existing.responsable_tratamiento_correo
    ),
    canal_pqrs: _first(local.canalPqrs, local.canalContacto, existing.canal_pqrs),
    canal_incidentes: _first(local.canalIncidentes, local.canalContacto, existing.canal_incidentes),
    politica_datos_url: _first(local.politicaDatosUrl, existing.politica_datos_url),
    // Campos que el formulario NO edita: se copian tal cual para que el PUT
    // no los borre. `plazo_retencion_dias` es obligatorio incluirlo porque
    // el service lo escribe siempre.
    plazo_retencion: existing.plazo_retencion === undefined ? null : existing.plazo_retencion,
    canal_solicitud_copia: existing.canal_solicitud_copia === undefined
      ? null
      : existing.canal_solicitud_copia,
    plazo_retencion_dias: existing.plazo_retencion_dias === undefined
      ? null
      : existing.plazo_retencion_dias,
    conservacion_por_deber_legal: existing.conservacion_por_deber_legal === true
      || existing.conservacion_por_deber_legal === 1,
    norma_conservacion: existing.norma_conservacion === undefined
      ? null
      : existing.norma_conservacion,
  };

  // Límites del zod del firma-service, para fallar acá con un mensaje claro
  // en vez de un 400 genérico después de haber hecho el GET.
  _limite('razon_social', body.razon_social, 200);
  _limite('nit', body.nit, 64);
  _limite('representante_legal', body.representante_legal, 200);
  _limite('representante_legal_identificacion', body.representante_legal_identificacion, 64);
  _limite('responsable_tratamiento', body.responsable_tratamiento, 200);
  _limite('responsable_tratamiento_correo', body.responsable_tratamiento_correo, 200);
  _limite('canal_pqrs', body.canal_pqrs, 300);
  _limite('canal_incidentes', body.canal_incidentes, 300);
  _limite('politica_datos_url', body.politica_datos_url, 500);
  _limite('plazo_retencion', body.plazo_retencion, 500);
  _limite('canal_solicitud_copia', body.canal_solicitud_copia, 300);
  _limite('norma_conservacion', body.norma_conservacion, 300);

  return body;
}

module.exports = { buildEmpresaUpdate };

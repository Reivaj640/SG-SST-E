const Database = require('C:/Proyectos de programación/SG-SST-E/sgsst-electron-app/firma-service/node_modules/better-sqlite3');
const db = new Database('C:/Proyectos de programación/SG-SST-E/sgsst-electron-app/firma-service/data/firma.sqlite', { readonly: true });

const sql = [
  'SELECT id, id_solicitud, id_empresa, id_trabajador, id_documento,',
  'tipo_firma, estado, metadata,',
  'consent_id, agreement_version,',
  'fecha_creacion, fecha_expiracion, fecha_apertura,',
  'fecha_otp_enviado, fecha_otp_verificado, fecha_documento_visto,',
  'fecha_manifestacion, fecha_firma,',
  'correo_verificacion,',
  'id_constancia, pdf_firmado_path, constancia_path,',
  'document_hash_firmado',
  'FROM gh_firmas_electronicas WHERE id_solicitud = ? LIMIT 1'
].join(' ');

const r = db.prepare(sql).get('SIGN-2026-112173');
if (!r) { console.log('NO ENCONTRADO'); process.exit(0); }
const out = {
  id_solicitud: r.id_solicitud,
  id_empresa: r.id_empresa,
  id_trabajador: r.id_trabajador,
  tipo_firma: r.tipo_firma,
  estado: r.estado,
  consent_id: r.consent_id,
  agreement_version: r.agreement_version,
  fecha_creacion: r.fecha_creacion,
  fecha_firma: r.fecha_firma,
  fecha_apertura: r.fecha_apertura,
  fecha_otp_enviado: r.fecha_otp_enviado,
  fecha_otp_verificado: r.fecha_otp_verificado,
  correo_verificacion: r.correo_verificacion,
  id_constancia: r.id_constancia,
  pdf_firmado_path: r.pdf_firmado_path,
  constancia_path: r.constancia_path,
  document_hash_firmado: r.document_hash_firmado ? '(presente, ' + r.document_hash_firmado.length + ' chars)' : null
};
console.log(JSON.stringify(out, null, 2));

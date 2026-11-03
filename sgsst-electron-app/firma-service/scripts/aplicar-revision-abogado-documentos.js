#!/usr/bin/env node
'use strict';

// Aplica a los borradores HTML las correcciones expresas del asesor jurídico.
// El script exige que cada ancla aparezca una vez para no editar otra versión.
const fs = require('fs');
const path = require('path');
const app = path.resolve(__dirname, '..', '..');

function replaceOnce(file, before, after, label) {
  const full = path.join(app, file);
  let text = fs.readFileSync(full, 'utf8');
  const at = text.indexOf(before);
  if (at < 0 && text.includes(after)) return;
  if (at < 0 || text.indexOf(before, at + before.length) >= 0) {
    throw new Error(`${label}: ancla ausente o repetida en ${file}`);
  }
  text = text.slice(0, at) + after + text.slice(at + before.length);
  fs.writeFileSync(full, text, 'utf8');
}

const nube = 'legal/anexo-nube-v1.0.html';
replaceOnce(nube,
  '<td><strong>Proveedor externo de correo; papel jur&iacute;dico pendiente de validaci&oacute;n.</strong> La\n        cuenta de consumidor no tiene un DPA empresarial identificado en el expediente. No se atribuye a Google\n        la condici&oacute;n de Responsable, Encargado o subencargado de Gesstiar. La clasificaci&oacute;n del flujo,\n        su fundamento y las obligaciones aplicables requieren determinaci&oacute;n escrita del abogado antes de\n        firmar o publicar. Esta ficha documenta los datos y el proveedor, pero no resuelve la calificaci&oacute;n.</td>',
  '<td><strong>Responsable del Tratamiento en esta operaci&oacute;n, por los motivos y con los efectos determinados en el &sect;5 del Anexo de Encargo.</strong> No existe DPA empresarial ni contrato de transmisi&oacute;n con Google. Esta determinaci&oacute;n no atribuye a Google condiciones de conservaci&oacute;n, supresi&oacute;n o auditor&iacute;a que no hayan sido verificadas documentalmente.</td>', 'A3 §4 fila Google');
replaceOnce(nube,
  'El papel por operaci&oacute;n,\n  la clasificaci&oacute;n del flujo, su fundamento y las medidas regulatorias que correspondan quedan pendientes\n  de validaci&oacute;n profesional escrita.',
  'En la operaci&oacute;n descrita, Google LLC act&uacute;a como Responsable del Tratamiento y el flujo constituye una transferencia internacional a Estados Unidos, pa&iacute;s con nivel adecuado de protecci&oacute;n, seg&uacute;n la determinaci&oacute;n escrita incorporada al &sect;5 del Anexo de Encargo. No existe DPA empresarial ni contrato de transmisi&oacute;n con Google.', 'A3 §4 clasificación');
replaceOnce(nube,
  'Personales y prevalece sobre las cl&aacute;usulas de ese Anexo que contradigan el Servicio.',
  'Personales y prevalece sobre las cl&aacute;usulas de ese Anexo que contradigan el Servicio, tambi&eacute;n en materia de conservaci&oacute;n, devoluci&oacute;n, supresi&oacute;n y auditor&iacute;a.', 'A3 §1 prevalencia');
replaceOnce(nube,
  '<p>Se aplica el 8.6 del Acuerdo: tabla de la Empresa; 20 a&ntilde;os para los registros del 2.2.4.6.13; hold sin\n  t&eacute;rmino para el contrato; deber legal declarado. Al terminar, el Encargado devuelve los datos en formato\n  JSON (exportaci&oacute;n de la base de datos del servicio) y los suprime de sistemas y respaldos en\n  30 d&iacute;as calendario, salvo norma que exija conservarlos, y entrega\n  certificaci&oacute;n de supresi&oacute;n.</p>',
  '<p>Se aplica el numeral 8.6 del Acuerdo. El piso de veinte (20) a&ntilde;os, contado desde el cese y nunca desde la firma, aplica exclusivamente a las cinco categor&iacute;as taxativas de registros SG-SST del literal 8.6(b). Los dem&aacute;s documentos SG-SST se rigen por la tabla de retenci&oacute;n documental de la Empresa o, a falta de plazo declarado, por la tabla supletoria. Un documento SG-SST que a&uacute;n no est&eacute; clasificado queda retenido y no recibe un plazo por defecto. El contrato individual de trabajo y sus anexos llevan el hold previsto en el 8.6(c). Si no se conoce la fecha real de cese, no se calcula fecha de supresi&oacute;n y la Empresa debe comunicarla al Encargado. Al terminar el encargo, el Encargado devuelve los datos en formato JSON y suprime los registros bajo su control y los respaldos en los plazos del Anexo, salvo deber legal de conservaci&oacute;n, y certifica la supresi&oacute;n. Cloudflare no almacena copias de los registros de la aplicaci&oacute;n.</p>', 'A3 §6 conservación');

// Corrige la cita y las condiciones contractuales expresamente indicadas.
replaceOnce(nube,
  'actualizada por la Circular 001 del 9 de enero de\n    2026',
  'actualizada por la Circular 001 del 9 de enero de 2026, que modific&oacute; el numeral 3.3 del T&iacute;tulo V', 'A3 §11 referencia Circular');
replaceOnce(nube,
  'El Encargado permite auditor&iacute;a anual o entrega, sobre la infraestructura en la nube, los informes SOC 2\n  Tipo II, ISO/IEC 27001 e ISO/IEC 27701 de Cloudflare, y la documentaci&oacute;n t&eacute;cnica del servicio.',
  'El Encargado permite auditor&iacute;a o entrega, en cuanto Cloudflare los ponga a disposici&oacute;n y sin que su disponibilidad altere las obligaciones de este Anexo, los informes SOC 2 Tipo II, ISO/IEC 27001 e ISO/IEC 27701 de Cloudflare, y la documentaci&oacute;n t&eacute;cnica del servicio.', 'A3 §8 auditoría');
replaceOnce(nube,
  '<strong>Versi&oacute;n:</strong> 1.0. Firmas: Responsable y\n  Encargado, con NIT y representante legal.</p>',
  '<strong>Versi&oacute;n:</strong> 1.0. Toda modificaci&oacute;n de este Anexo se publica como versi&oacute;n nueva con su propia huella SHA-256, se suscribe nuevamente por ambas partes y no altera las versiones ya suscritas ni sus efectos sobre los registros ya generados. Firmas: Responsable y Encargado, con NIT y representante legal.</p>', 'A3 §9 modificación');

const constancia = 'legal/constancia-aprobacion-acuerdo.html';
let c = fs.readFileSync(path.join(app, constancia), 'utf8');
c = c.replace(/v1\.3/g, 'v1.4');
c = c.replace('con sus Cap&iacute;tulos I a XIII', 'con sus Cap&iacute;tulos I a XII');
const oldAntecedente = /<p><strong>Antecedente\.<\/strong>[\s\S]*?<\/p>/;
const newAntecedente = '<p><strong>Antecedente.</strong> La versi&oacute;n v1.1 del Acuerdo de uso (huella SHA-256 09d69065b60000bb215be8f28fd67d0fb6fad7d32cb5a8e9c3afb45d817123d2) fue la candidata sometida a revisi&oacute;n el 27 de octubre de 2026; su aprobaci&oacute;n y su autorizaci&oacute;n operativa constan, en su caso, en la constancia propia de esa versi&oacute;n, que el owner debe incorporar a este expediente. Si no existe esa constancia, esta Constancia se abre sin antecedente y sin sobrescribir una versi&oacute;n anterior.</p>';
if (!oldAntecedente.test(c)) throw new Error('A4: no se encontró el párrafo de antecedente');
c = c.replace(oldAntecedente, newAntecedente);
fs.writeFileSync(path.join(app, constancia), c, 'utf8');

console.log('Aplicadas las correcciones HTML indicadas; los documentos siguen siendo borradores no firmados.');

'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const pkg = path.join(root, 'docs', 'gestion-humana', 'firma-electronica', 'paquete-abogado-2026-10-30');
function edit(file, pairs) {
  let s = fs.readFileSync(file, 'utf8');
  for (const [a,b] of pairs) {
    if (!s.includes(a)) { if (s.includes(b)) continue; throw new Error('No se encontró texto esperado en '+file+': '+a.slice(0,90)); }
    s = s.replace(a,b);
  }
  fs.writeFileSync(file,s,'utf8');
}
const nube = path.join(root,'legal','anexo-nube-v1.0.html');
edit(nube,[
['Gesstiar S.A.S. no est&aacute; inscrita y no tiene obligaci&oacute;n de inscripci&oacute;n por no superar el umbral de activos;','Gesstiar S.A.S. no est&aacute; inscrita seg&uacute;n declaraci&oacute;n del owner. La posible no obligaci&oacute;n por no superar el umbral es condicional a verificar los activos totales a la fecha de corte mediante certificado y estados financieros;'],
['<strong>Con los activos declarados a la fecha, la sociedad no supera el umbral; la confirmaci&oacute;n de\n        la no obligaci&oacute;n de inscripci&oacute;n queda con el abogado y con el certificado.</strong>','<strong>Si los activos totales a la fecha de corte son los declarados, no se supera el umbral; esta conclusi&oacute;n es condicional y requiere confirmaci&oacute;n documental mediante certificado y estados financieros.</strong>'],
['<strong>La calificaci&oacute;n de esa cifra como\n        &laquo;activos totales a la fecha de corte&raquo; y la fecha de corte misma son determinaci&oacute;n del\n        abogado</strong>, porque la sociedad est&aacute; reci&eacute;n creada y a&uacute;n no tiene estados financieros: los\n        $1.000.000 son capital o activo declarado, no un balance.','<strong>La cifra de $1.000.000 es una declaraci&oacute;n del owner y no sustituye los estados financieros ni acredita por s&iacute; sola los activos totales a la fecha de corte.</strong>'],
['<strong>Este Anexo no cierra la obligaci&oacute;n de\n        inscripci&oacute;n por la aritm&eacute;tica</strong>: la confirman el certificado de existencia y\n        representaci&oacute;n y los estados financieros.','<strong>La posible exclusi&oacute;n por no superar el umbral queda condicionada a la verificaci&oacute;n del certificado de existencia y representaci&oacute;n y de los estados financieros a la fecha de corte.</strong>'],
['<strong>el sistema de archivos del despliegue est&aacute; en\n  correcci&oacute;n</strong> (permisos 750/755 con propietario el usuario del servicio, y retirada de la base de datos\n  de prueba del despliegue), a cargo del owner, con fecha 31-oct-2026, y esa correcci&oacute;n es condici&oacute;n del\n  despliegue del candidato:','<strong>la correcci&oacute;n del sistema de archivos del despliegue est&aacute; pendiente</strong> (permisos 750/755 con propietario el usuario del servicio y retirada de la base de datos de prueba), a cargo del owner, sin fecha de ejecución confirmada y como condición del despliegue del candidato:']
]);
const sitio=path.join(root,'..','sitio','anexo-nube-v1.0.html'); fs.copyFileSync(nube,sitio);
const checklist=path.join(pkg,'11-checklist-definitivo-revision-juridica-y-cierre.md');
edit(checklist,[
['**Pendiente de usted:** la determinación escrita del papel de Google por operación (2.7), la Circular 002 de 2025 (2.8) y el RNBD (2.9).','**Pendiente de usted:** aprobar o formular observaciones a la determinación escrita sobre Google y la Circular 002 (2.7–2.8). Para RNBD, confirmar la aplicación con certificado societario y estados financieros (2.9).'],
['2 078 pruebas · 2 076 verdes · 0 rojas · 2 omitidas','2 090 pruebas · 2 088 verdes · 0 rojas · 2 omitidas'],
['Sin copia firmada, el C-1 impide crear solicitudes de firma y emitir Constancia','La compuerta C-1 está apagada hoy: el bloqueo de solicitudes y Constancia se aplicará cuando se active, una vez satisfechas sus condiciones']
]);
const d9=path.join(root,'docs','gestion-humana','firma-electronica','respuesta-checklist-cierre-2026-10-30.md');
let s=fs.readFileSync(d9,'utf8').replace(/2 078/g,'2 090').replace(/2 076/g,'2 088');
s=s.replace('la corrida del **31-oct-2026** da **2 090','el resultado reportado para la revisión del **1-nov-2026** es **2 090');
s=s.replace('**2 090 · 2 088 · 0 · 2**','**2 090 · 2 088 · 0 · 2** (cifra reportada por el equipo; no repetida en esta intervención)');
s=s.replace('Una S.A.S. es sociedad comercial y, por tanto, no está en el ámbito de inscripción','Una S.A.S. es una sociedad comercial; por ello sí pertenece a la categoría de sociedades del literal (a). La posible exclusión depende de que sus activos totales no superen 100.000 UVT a la fecha de corte, verificados con certificado y estados financieros');
s=s.replace('una S.A.S. es sociedad comercial y, en\nprincipio, no está en el ámbito de inscripción','una S.A.S. es una sociedad comercial y sí pertenece a la categoría de sociedades del literal (a); la posible exclusión depende de que sus activos totales no superen 100.000 UVT a la fecha de corte, verificados con certificado y estados financieros');
s=s.replace('aritmêcute;tica','aritmética');
s=s.replace('impide crear solicitudes de firma y emitir Constancia','se aplicará al activar la compuerta; hoy está apagada y no impide solicitudes ni Constancias por sí sola');
s=s.replace('La corrida del **31-oct-2026** da **2 090','El resultado reportado por el equipo para la revisión del **1-nov-2026** es **2 090');
s=s.replace('**PENDIENTE:** la regeneración del `SHA256SUMS.txt` del paquete corresponde al owner y se hace al cerrar, con el paquete completo','**Cerrado en esta ronda:** paquete reconstruido y `SHA256SUMS.txt` regenerado después de las correcciones');
fs.writeFileSync(d9,s,'utf8');
const report=path.join(pkg,'10-informe-correcciones-para-asesor-juridico.md');
edit(report,[
['**PENDIENTE, y es del owner.** El paquete se arma','**Corregido en esta ronda:** el paquete se reconstruyó y su `SHA256SUMS.txt` se regeneró. El paquete se arma'],
['2 078 del servicio (2 076 verdes, 0 rojas, 2 omitidas)','2 090 del servicio (2 088 verdes, 0 rojas, 2 omitidas, resultado reportado por el equipo para 1-nov-2026; no reejecutado en esta intervención)']
]);
edit(report,[
['**PENDIENTE: depende del servidor.** No hay acceso desde esta ronda','**Ejecutada el 31-oct-2026, solo lectura.** Detectó producción en v1.0, nueve migraciones atrás, permisos 777, base de prueba dentro del despliegue y disco sin cifrar; corregir permisos y retirar base sigue pendiente'],
['**PENDIENTE: depende del servidor, en sus 8 apartados.** Lo que sí se hizo en el repositorio: el canal de correo ahora exige cifrado en tránsito, y el canal del código de verificación no puede degradar a texto claro. La ficha del §5 conserva los marcadores donde falta evidencia','**Diligenciada el 31-oct-2026:** los 14 marcadores quedaron completados con los datos y evidencias descritos en el §1.9 del adjunto 09. Siguen pendientes decisiones operativas del owner, documentos RNBD y cifrado de disco, que está sin implementar'],
['Sin copia firmada, el C-1 impide crear solicitudes de firma y emitir Constancia','La compuerta C-1 está apagada hoy; el bloqueo se aplicará cuando se active']
]);
const note=path.join(pkg,'nota-al-abogado-2026-10-30.md');
edit(note,[
['sin copia firmada, el C-1 impide crear solicitudes de firma y emitir\n  Constancia.','la compuerta C-1 está apagada actualmente: el bloqueo de solicitudes y Constancia se aplicará cuando se active.'],
['2 078 pruebas','2 090 pruebas'],['2 078 pruebas · 2 076 verdes · 0 rojas · 2 omitidas**: esa es la cifra vigente.','2 090 pruebas · 2 088 verdes · 0 rojas · 2 omitidas**: resultado reportado por el equipo para la revisión del 1-nov-2026; no repetido en esta intervención.'],
['S.A.S. ordinaria\n  queda sin confirmar.','caracterización societaria inicial imprecisa queda retirada; el certificado confirmará el tipo exacto.'],
['aritmêcute;tica','aritmética']
]);
edit(path.join(root,'docs','MIGRACION-SERVIDOR-FIRMA.md'),[['acuerdo-v1.3.txt','acuerdo-v1.4.txt']]);
const newerHash='c9e29220e805720fde4860ec8655ae3bd59afe444a5ecd7ec8473dabe6f6e125';
const oldHash='9087753d6519c9f8d0a8374ed527e80ca6b2be5be71ffd652c53901a0da8948f';
for (const file of [d9,report,checklist,note]) {
  let t=fs.readFileSync(file,'utf8').replaceAll(oldHash,newerHash).replaceAll('59 990','59 840').replaceAll('9087753d…a8948f','c9e29220…6e125').replaceAll('2 078','2 090').replaceAll('2 076','2 088');
  t=t.replace('2 090 · 2 088 · 0 · 2** (cifra reportada por el equipo; no repetida en esta intervención) (cifra reportada por el equipo; no repetida en esta intervención)','2 090 · 2 088 · 0 · 2** (cifra reportada por el equipo; no repetida en esta intervención)');
  t=t.replace('el 31-oct-2026 por la\n    mañana, después de aplicar las seis puertas, con un test rojo que se corrigió esa misma\n    tarde','según resultado reportado por el equipo en la revisión del 1-nov-2026; no repetido en esta intervención');
  t=t.replace('**2 090 pruebas** el 31-oct-2026 por la\n    mañana, después de aplicar las seis puertas, con un test rojo que se corrigió esa misma\n    tarde','**2 090 pruebas** reportadas por el equipo el 1-nov-2026; no repetidas en esta intervención');
  t=t.replace('**La del 31-oct-2026, después de las seis puertas, repitió la batería**: 2 090 del servicio (2 088 verdes, 0 rojas, 2 omitidas, resultado reportado por el equipo para 1-nov-2026; no reejecutado en esta intervención)','**Cifra reportada por el equipo para la revisión del 1-nov-2026 (no reejecutada en esta intervención):** 2 090 del servicio (2 088 verdes, 0 rojas, 2 omitidas)');
  t=t.replace('la segunda, después de las seis puertas de la segunda revisión, dio **2 090 pruebas · 2 088 verdes · 0 rojas · 2 omitidas** (los +16 son los del canal de la fecha de terminación, y ninguna prueba anterior cambió de resultado)','el resultado actualizado que reporta el equipo para la revisión del 1-nov-2026 es **2 090 pruebas · 2 088 verdes · 0 rojas · 2 omitidas**; no se repitió en esta intervención');
  t=t.replace('C-1 sigue\n    impidiendo crear solicitudes de firma y emitir Constancia','la compuerta C-1 está apagada hoy; el bloqueo se aplicará al activarla');
  t=t.replace('recalculado el 31-oct-2026 sobre','recalculado el 1-nov-2026 sobre');
  t=t.replace('| 03 | **Anexo de Nube v1.0** | `03-anexo-de-nube-v1.0.html` | `sgsst-electron-app/legal/anexo-nube-v1.0.html` | 60 023 | `'+newerHash+'` |','| 03 | **Anexo de Nube v1.0** | `03-anexo-de-nube-v1.0.html` | `sgsst-electron-app/legal/anexo-nube-v1.0.html` | 60 023 | `'+newerHash+'` |');
  fs.writeFileSync(file,t,'utf8');
}
let n=fs.readFileSync(note,'utf8');
n=n.replace('El paquete tiene **trece (13) adjuntos**','El paquete tiene **catorce (14) adjuntos**').replace('**Fecha:** 30 de octubre de 2026','**Fecha:** 1 de noviembre de 2026');
if (!n.includes('13-adenda-rnbd-2026-11-01.md')) n=n.replace('\n**Sobre el adjunto 00.**','\n| 13 | **Adenda de precisión jurídica: RNBD** | `13-adenda-rnbd-2026-11-01.md` | `sgsst-electron-app/docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/13-adenda-rnbd-2026-11-01.md` | PENDIENTE | PENDIENTE |\n\n**Sobre el adjunto 00.**');
fs.writeFileSync(note,n,'utf8');
console.log('Correcciones textuales aplicadas.');

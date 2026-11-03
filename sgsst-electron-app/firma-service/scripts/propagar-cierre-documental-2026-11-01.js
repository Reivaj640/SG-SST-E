'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..','..');
const pkg=path.join(root,'docs','gestion-humana','firma-electronica','paquete-abogado-2026-10-30');
const files=[
  path.join(root,'docs','gestion-humana','firma-electronica','respuesta-checklist-cierre-2026-10-30.md'),
  path.join(pkg,'10-informe-correcciones-para-asesor-juridico.md'),
  path.join(pkg,'11-checklist-definitivo-revision-juridica-y-cierre.md'),
  path.join(pkg,'nota-al-abogado-2026-10-30.md'),
  path.join(root,'CONTEXT.md'),
];
const old='9087753d6519c9f8d0a8374ed527e80ca6b2be5be71ffd652c53901a0da8948f';
const current='c9e29220e805720fde4860ec8655ae3bd59afe444a5ecd7ec8473dabe6f6e125';
for(const f of files){
  let s=fs.readFileSync(f,'utf8');
  s=s.replaceAll(old,current)
    .replaceAll('9087753d…a8948f','c9e29220…6f6e125')
    .replaceAll('59 990','59 840')
    .replaceAll('recalculado el 31-oct-2026 sobre','recalculado el 1-nov-2026 sobre')
    .replaceAll('**v1.0 (31-oct-2026)**','**v1.0 (1-nov-2026)**')
    .replaceAll('trece adjuntos','catorce adjuntos')
    .replaceAll('las trece huellas','las catorce huellas')
    .replaceAll('con los trece adjuntos','con los catorce adjuntos')
    .replaceAll('13/13','14/14')
    .replaceAll('las trece filas','las catorce filas')
    .replaceAll('d810bbb0b476f61fb94a4835c02be5a7e32f11a5291dfd5cd5b20dc0492d277e','8c1784352f74a09ee805ac42de4234fa0c66c8207ead4cbe8b7c927dec3d3498');
  fs.writeFileSync(f,s,'utf8');
}
const checklist=path.join(pkg,'11-checklist-definitivo-revision-juridica-y-cierre.md');
let rows=fs.readFileSync(checklist,'utf8').split(/\r?\n/);
rows=rows.map(line=>{
  if(line.startsWith('| T1 | Reejecución de pruebas')) return '| T1 | Reejecución de pruebas afectadas por el cambio SG-SST; resultados y fallos comparados con línea base | **Cifra reportada por el equipo el 1-nov-2026; no reejecutada aquí:** 2 090 pruebas · 2 088 verdes · 0 rojas · 2 omitidas. Reconciliación reportada: base 2 062 +16 por canal de fecha de terminación = 2 078; +12 por control de huellas = 2 090 (**+28** total). No se atribuye duración. El resultado histórico de 30-oct-2026 fue 2 062 pruebas · 2 059 verdes · 1 roja · 2 omitidas. La falla histórica `ADVE6.7: zod acepta "5"` se corrigió en el test, no en código de producción. | |';
  if(line.startsWith('| D6 | La respuesta al checklist conserva referencias históricas')) return '| D6 | La respuesta al checklist conserva referencias históricas a nueve adjuntos; el paquete actual incluye diez adjuntos más este checklist. | Owner debe mantener la distinción entre documento histórico y manifiesto vigente, y regenerar el paquete/hash al cerrar. | **Aplicada.** El paquete se regenera con **14 adjuntos, del 00 al 13**, y su `SHA256SUMS.txt`; la nota al abogado distingue lo vigente de lo histórico y el manifiesto del servicio es el que dice qué versión está vigente. |';
  return line;
});
fs.writeFileSync(checklist,rows.join('\n'),'utf8');
console.log('Referencias del paquete alineadas con A3 y conteo 14.');

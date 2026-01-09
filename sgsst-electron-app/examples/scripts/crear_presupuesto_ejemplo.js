const { Workbook } = require('exceljs');

// Crear un nuevo libro de trabajo
const workbook = new Workbook();
const worksheet = workbook.addWorksheet('PRESUPUESTO SG-SST');

// Definir los encabezados
const headers = [
  'ID',
  'Concepto',
  'Unidad',
  'Cantidad',
  'Valor Unitario',
  'Total',
  'Fuente de Financiación'
];

// Agregar encabezados a la primera fila
worksheet.addRow(headers);

// Establecer estilos para los encabezados
const headerRow = worksheet.getRow(1);
headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
headerRow.fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: '4A6BDF' }
};

// Agregar datos de ejemplo
const data = [
  [1, 'Personal de Seguridad', 'Mes', 12, 3500000, 42000000, 'Empresa'],
  [2, 'Elementos de Protección Personal (EPP)', 'Unidad', 100, 85000, 8500000, 'Empresa'],
  [3, 'Capacitaciones SST', 'Persona', 50, 120000, 6000000, 'Empresa'],
  [4, 'Medicina Ocupacional', 'Examen', 30, 180000, 5400000, 'ARL'],
  [5, 'Implementos de Limpieza', 'Mes', 12, 450000, 5400000, 'Empresa']
];

// Agregar datos a la hoja
data.forEach(row => {
  worksheet.addRow(row);
});

// Ajustar el ancho de las columnas
worksheet.columns = [
  { width: 10 },   // ID
  { width: 40 },   // Concepto
  { width: 15 },   // Unidad
  { width: 15 },   // Cantidad
  { width: 20 },   // Valor Unitario
  { width: 20 },   // Total
  { width: 25 }    // Fuente de Financiación
];

// Calcular fórmula para la columna Total
worksheet.eachRow((row, rowNumber) => {
  if (rowNumber > 1) { // Saltar encabezados
    // Cantidad * Valor Unitario
    const cantidad = row.getCell(4).value;
    const valorUnitario = row.getCell(5).value;
    if (typeof cantidad === 'number' && typeof valorUnitario === 'number') {
      row.getCell(6).value = cantidad * valorUnitario;
    }
  }
});

// Guardar el archivo
workbook.xlsx.writeFile('utils/Presupuesto SG-SST.xlsx')
  .then(() => {
    console.log('Archivo de presupuesto creado exitosamente en utils/Presupuesto SG-SST.xlsx');
  })
  .catch(err => {
    console.error('Error al crear el archivo:', err);
  });
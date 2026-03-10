const XLSX = require('xlsx');
const path = require('path');

const basePath = __dirname;
const fileName = 'GI-FO-045 PLAN DE TRABAJO ANUAL 2025 SST.xls';
const fullPath = path.join(basePath, fileName);

console.log('=== LEYENDO ESTRUCTURA DEL ARCHIVO ===\n');
console.log('Ruta:', fullPath);
console.log('');

try {
    const wb = XLSX.readFile(fullPath);
    
    console.log('📑 HOJAS ENCONTRADAS:', wb.SheetNames);
    console.log('');
    
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, {header: 1, defval: ''});
    
    console.log('📊 TOTAL DE FILAS:', data.length);
    console.log('');
    
    console.log('=== PRIMERAS 30 FILAS ===');
    data.slice(0, 30).forEach((row, i) => {
        console.log('Fila ' + i + ':', JSON.stringify(row));
    });
    
    console.log('');
    console.log('=== ÚLTIMAS 10 FILAS ===');
    data.slice(-10).forEach((row, i) => {
        console.log('Fila ' + (data.length - 10 + i) + ':', JSON.stringify(row));
    });
    
    // Buscar fila de encabezados
    console.log('');
    console.log('=== BUSCANDO ENCABEZADOS ===');
    const keywords = ['actividad', 'responsable', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    
    for (let i = 0; i < Math.min(20, data.length); i++) {
        const row = data[i];
        const rowStr = row.join(' ').toLowerCase();
        const matches = keywords.filter(k => rowStr.includes(k));
        if (matches.length >= 3) {
            console.log('✅ Fila ' + i + ' parece ser encabezado. Coincidencias: ' + matches.length);
            console.log('   Palabras encontradas:', matches);
            console.log('   Contenido:', JSON.stringify(row));
        }
    }
} catch (error) {
    console.error('ERROR:', error.message);
}

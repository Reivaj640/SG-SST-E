/**
 * Script para probar el parser de PDFs de evaluación inicial
 */

const EvaluacionPdfParser = require('./evaluacionPdfParser');
const path = require('path');

async function testParser() {
    console.log('='.repeat(80));
    console.log('PRUEBA DEL PARSER DE PDFs - EVALUACIÓN INICIAL SG-SST');
    console.log('='.repeat(80));
    
    const parser = new EvaluacionPdfParser();
    
    const tests = [
        {
            path: path.join(__dirname, 'Resultados Calificacion de Estandares Minimos 2024.pdf'),
            type: 'ministerio',
            name: 'PDF del Ministerio'
        },
        {
            path: path.join(__dirname, 'Informe Res 0312 - TEMPOACTIVA EST SAS - 09-12-2024.pdf'),
            type: 'arl',
            name: 'PDF de ARL'
        }
    ];
    
    for (const test of tests) {
        console.log('\n' + '='.repeat(80));
        console.log(`PROBANDO: ${test.name}`);
        console.log('='.repeat(80));
        console.log(`Ruta: ${test.path}`);
        console.log(`Tipo: ${test.type}`);
        
        const result = await parser.parsePdf(test.path, test.type);
        
        console.log('\n--- RESULTADO ---');
        console.log(`Success: ${result.success}`);
        
        if (result.success) {
            console.log(`Año: ${result.year}`);
            console.log(`Fuente: ${result.source}`);
            console.log(`Archivo: ${result.fileName}`);
            console.log(`\n--- MÉTRICAS ---`);
            console.log(`Cumplimiento: ${result.metrics.cumplimiento}%`);
            console.log(`Total de ítems: ${result.metrics.totalItems}`);
            console.log(`Cumplidos: ${result.metrics.cumplidos}`);
            console.log(`No cumplidos: ${result.metrics.noCumplidos}`);
            console.log(`Parcial: ${result.metrics.parcial}`);
            
            console.log(`\n--- PRIMEROS 10 HALLAZGOS ---`);
            result.findings.slice(0, 10).forEach((finding, index) => {
                console.log(`\n${index + 1}. ID: ${finding.id}`);
                console.log(`   Descripción: ${finding.description.substring(0, 100)}...`);
                console.log(`   Valor: ${finding.value}`);
                console.log(`   Estado: ${finding.status}`);
                console.log(`   Puntaje: ${finding.score}`);
                console.log(`   Requiere revisión manual: ${finding.requiresManualReview}`);
            });
            
            if (result.findings.length > 10) {
                console.log(`\n... y ${result.findings.length - 10} hallazgos más`);
            }
        } else {
            console.log(`Error: ${result.error}`);
        }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('PRUEBA COMPLETADA');
    console.log('='.repeat(80));
}

testParser().catch(console.error);

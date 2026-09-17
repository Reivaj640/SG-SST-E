/**
 * Script para analizar la estructura de los PDFs de evaluación inicial
 * Este script extrae el texto de ambos PDFs y muestra su estructura
 */

const fs = require('fs');
const path = require('path');

// Intentar cargar pdf-parse primero
let pdfParse;
try {
    pdfParse = require('./pdfjs-shim').default;
    console.log('[AnalyzePDF] Usando pdf-parse');
} catch (error) {
    console.error('[AnalyzePDF] Error cargando pdf-parse:', error.message);
    process.exit(1);
}

async function analyzePdf(filePath, name) {
    console.log('\n' + '='.repeat(80));
    console.log(`ANALIZANDO: ${name}`);
    console.log('='.repeat(80));
    console.log(`Ruta: ${filePath}`);
    
    try {
        // Verificar que el archivo existe
        if (!fs.existsSync(filePath)) {
            console.error('❌ Archivo no encontrado');
            return;
        }
        
        // Leer el archivo
        const dataBuffer = fs.readFileSync(filePath);
        console.log(`✓ Tamaño del archivo: ${dataBuffer.length} bytes`);
        
        // Parsear el PDF
        console.log('\n📖 Extrayendo texto del PDF...');
        const data = await pdfParse(dataBuffer);
        
        console.log(`✓ Número de páginas: ${data.numpages}`);
        console.log(`✓ Longitud del texto: ${data.text.length} caracteres`);
        
        // Mostrar las primeras 500 líneas del texto
        const lines = data.text.split('\n');
        console.log(`\n📄 Total de líneas: ${lines.length}`);
        console.log('\n--- PRIMERAS 100 LÍNEAS ---');
        for (let i = 0; i < Math.min(100, lines.length); i++) {
            const line = lines[i].trim();
            if (line) {
                console.log(`[${i.toString().padStart(3, '0')}] ${line}`);
            }
        }
        
        // Buscar patrones específicos
        console.log('\n--- PATRONES ENCONTRADOS ---');
        
        // Buscar estándares o ítems
        const standardPattern = /(?:estándar|ítem|item|criterio|requisito)\s*(\d+[\.\d]*)/gi;
        const standards = data.text.match(standardPattern);
        if (standards) {
            console.log(`✓ Estándares/ítems encontrados: ${standards.length}`);
            console.log('  Ejemplos:', standards.slice(0, 10).join(', '));
        }
        
        // Buscar estados de cumplimiento
        const statusPattern = /(?:cumple|no cumple|parcial|cumplimiento|estado)[:\s]*(?:si|no|parcial|cumple|no cumple)/gi;
        const statuses = data.text.match(statusPattern);
        if (statuses) {
            console.log(`✓ Estados de cumplimiento encontrados: ${statuses.length}`);
            console.log('  Ejemplos:', statuses.slice(0, 10).join(', '));
        }
        
        // Buscar porcentajes
        const percentPattern = /\d+[\.,]?\d*%/g;
        const percentages = data.text.match(percentPattern);
        if (percentages) {
            console.log(`✓ Porcentajes encontrados: ${percentages.length}`);
            console.log('  Ejemplos:', percentages.slice(0, 10).join(', '));
        }
        
        // Buscar años
        const yearPattern = /\b(20[1-2][0-9])\b/g;
        const years = data.text.match(yearPattern);
        if (years) {
            const uniqueYears = [...new Set(years)];
            console.log(`✓ Años encontrados: ${uniqueYears.join(', ')}`);
        }
        
        // Buscar palabras clave
        const keywords = ['diagnóstico', 'evaluación', 'estándar', 'cumplimiento', 'riesgo', 'peligro', 'medida', 'control'];
        console.log('\n--- PALABRAS CLAVE ---');
        keywords.forEach(keyword => {
            const regex = new RegExp(keyword, 'gi');
            const matches = data.text.match(regex);
            if (matches) {
                console.log(`  ${keyword}: ${matches.length} ocurrencias`);
            }
        });
        
        // Guardar el texto completo en un archivo para análisis posterior
        const outputFileName = path.join(__dirname, `${name.replace(/\s+/g, '_')}_texto_extraido.txt`);
        fs.writeFileSync(outputFileName, data.text, 'utf-8');
        console.log(`\n✓ Texto completo guardado en: ${outputFileName}`);
        
        return {
            success: true,
            numpages: data.numpages,
            textLength: data.text.length,
            lines: lines.length,
            text: data.text
        };
        
    } catch (error) {
        console.error(`❌ Error analizando PDF: ${error.message}`);
        console.error(error.stack);
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('='.repeat(80));
    console.log('ANALIZADOR DE ESTRUCTURA DE PDFs - EVALUACIÓN INICIAL SG-SST');
    console.log('='.repeat(80));
    
    const pdfs = [
        {
            path: path.join(__dirname, 'Resultados Calificacion de Estandares Minimos 2024.pdf'),
            name: 'Resultados Calificacion de Estandares Minimos 2024'
        },
        {
            path: path.join(__dirname, 'Informe Res 0312 - TEMPOACTIVA EST SAS - 09-12-2024.pdf'),
            name: 'Informe Res 0312 - TEMPOACTIVA EST SAS - 09-12-2024'
        }
    ];
    
    const results = [];
    for (const pdf of pdfs) {
        const result = await analyzePdf(pdf.path, pdf.name);
        results.push({ ...pdf, ...result });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('RESUMEN DEL ANÁLISIS');
    console.log('='.repeat(80));
    
    results.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.name}`);
        if (result.success) {
            console.log(`   ✓ Páginas: ${result.numpages}`);
            console.log(`   ✓ Líneas: ${result.lines}`);
            console.log(`   ✓ Caracteres: ${result.textLength}`);
        } else {
            console.log(`   ❌ Error: ${result.error}`);
        }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('Análisis completado. Revisa los archivos de texto extraídos para más detalles.');
    console.log('='.repeat(80));
}

main().catch(console.error);

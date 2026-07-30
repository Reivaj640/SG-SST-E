/**
 * Script para probar el análisis de PDFs usando pdf-parse v2.4.5
 */

const fs = require('fs');
const path = require('path');
const pdf = require('./pdfjs-shim');

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
        
        // Leer el archivo como Uint8Array
        const dataBuffer = fs.readFileSync(filePath);
        const data = new Uint8Array(dataBuffer);
        console.log(`✓ Tamaño del archivo: ${dataBuffer.length} bytes`);
        
        // Crear el parser
        const parser = new pdf.PDFParse(data);
        
        // Obtener el texto
        console.log('\n📖 Extrayendo texto del PDF...');
        const result = await parser.getText();
        
        console.log(`✓ Total: ${result.total}`);
        console.log(`✓ Páginas: ${result.pages}`);
        console.log(`✓ Longitud del texto: ${result.text.length} caracteres`);
        
        // Mostrar las primeras 100 líneas del texto
        const lines = result.text.split('\n');
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
        const standards = result.text.match(standardPattern);
        if (standards) {
            console.log(`✓ Estándares/ítems encontrados: ${standards.length}`);
            console.log('  Ejemplos:', standards.slice(0, 10).join(', '));
        }
        
        // Buscar estados de cumplimiento
        const statusPattern = /(?:cumple|no cumple|parcial|cumplimiento|estado)[:\s]*(?:si|no|parcial|cumple|no cumple)/gi;
        const statuses = result.text.match(statusPattern);
        if (statuses) {
            console.log(`✓ Estados de cumplimiento encontrados: ${statuses.length}`);
            console.log('  Ejemplos:', statuses.slice(0, 10).join(', '));
        }
        
        // Buscar porcentajes
        const percentPattern = /\d+[\.,]?\d*%/g;
        const percentages = result.text.match(percentPattern);
        if (percentages) {
            console.log(`✓ Porcentajes encontrados: ${percentages.length}`);
            console.log('  Ejemplos:', percentages.slice(0, 10).join(', '));
        }
        
        // Buscar años
        const yearPattern = /\b(20[1-2][0-9])\b/g;
        const years = result.text.match(yearPattern);
        if (years) {
            const uniqueYears = [...new Set(years)];
            console.log(`✓ Años encontrados: ${uniqueYears.join(', ')}`);
        }
        
        // Buscar palabras clave
        const keywords = ['diagnóstico', 'evaluación', 'estándar', 'cumplimiento', 'riesgo', 'peligro', 'medida', 'control'];
        console.log('\n--- PALABRAS CLAVE ---');
        keywords.forEach(keyword => {
            const regex = new RegExp(keyword, 'gi');
            const matches = result.text.match(regex);
            if (matches) {
                console.log(`  ${keyword}: ${matches.length} ocurrencias`);
            }
        });
        
        // Guardar el texto completo en un archivo para análisis posterior
        const outputFileName = path.join(__dirname, `${name.replace(/\s+/g, '_')}_texto_extraido.txt`);
        fs.writeFileSync(outputFileName, result.text, 'utf-8');
        console.log(`\n✓ Texto completo guardado en: ${outputFileName}`);
        
        return {
            success: true,
            total: result.total,
            pages: result.pages,
            textLength: result.text.length,
            lines: lines.length,
            text: result.text
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
            console.log(`   ✓ Total: ${result.total}`);
            console.log(`   ✓ Páginas: ${result.pages}`);
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

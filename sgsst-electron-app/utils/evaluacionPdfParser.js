// utils/evaluacionPdfParser.js - Parser para PDFs de evaluación inicial SG-SST

const pdfParse = require('pdf-parse');
const fs = require('fs');

class EvaluacionPdfParser {
    constructor() {
        // Patrones para detectar estructura del PDF
        this.patterns = {
            itemCode: /(\d+\.\d+\.\d+)/,  // Ej: 1.1.1, 2.10.1
            cycle: /(PLANEAR|HACER|VERIFICAR|ACTUAR)/i,
            standard: /(?:Estándar|Estandar|Standard)[:\s]*(.+?)(?=\n|$)/i,
            maxScore: /(?:Máximo|Maximo|Max)[:\s]*(\d+\.?\d*)/i,
            scoreObtained: /(?:Obtenido|Obt|Puntaje)[:\s]*(\d+\.?\d*)/i,
            status: /(?:Cumple|No Cumple|Parcial|No Aplica)/i,
            year: /20(2[0-9]|3[0-9])/
        };
    }

    /**
     * Extrae datos de un PDF de evaluación inicial
     * @param {string} pdfPath - Ruta del archivo PDF
     * @param {string} sourceType - Tipo de fuente ('ministerio' o 'arl')
     * @returns {Promise<Object>} Datos extraídos del PDF
     */
    async parsePdf(pdfPath, sourceType) {
        try {
            console.log(`[EvaluacionPdfParser] Procesando PDF: ${pdfPath}`);
            
            // Verificar que el archivo existe
            if (!fs.existsSync(pdfPath)) {
                throw new Error(`Archivo no encontrado: ${pdfPath}`);
            }

            // Leer el archivo PDF
            const dataBuffer = fs.readFileSync(pdfPath);
            const pdfData = await pdfParse(dataBuffer);
            
            console.log(`[EvaluacionPdfParser] PDF leído, ${pdfData.numpages} páginas`);
            
            // Extraer el texto completo
            const fullText = pdfData.text;
            
            // Extraer el año del nombre del archivo o del contenido
            const year = this.extractYear(pdfPath, fullText);
            
            // Extraer datos según el tipo de fuente
            const extractedData = sourceType === 'ministerio' 
                ? this.parseMinisterioPdf(fullText, pdfPath)
                : this.parseArlPdf(fullText, pdfPath);
            
            // Calcular métricas
            const metrics = this.calculateMetrics(extractedData.findings);
            
            return {
                success: true,
                year: year,
                source: sourceType,
                fileName: this.extractFileName(pdfPath),
                filePath: pdfPath,
                findings: extractedData.findings,
                metrics: metrics,
                rawData: extractedData.rawData
            };
            
        } catch (error) {
            console.error('[EvaluacionPdfParser] Error procesando PDF:', error);
            return {
                success: false,
                error: error.message,
                year: new Date().getFullYear().toString(),
                source: sourceType,
                findings: [],
                metrics: { cumplimiento: 0, totalItems: 0, cumplidos: 0, noCumplidos: 0, parcial: 0 }
            };
        }
    }

    /**
     * Extrae el año del nombre del archivo o del contenido
     */
    extractYear(filePath, text) {
        // Primero intentar del nombre del archivo
        const fileName = this.extractFileName(filePath);
        const yearMatch = fileName.match(/20(2[0-9]|3[0-9])/);
        if (yearMatch) return yearMatch[0];
        
        // Si no, intentar del contenido
        const textMatch = text.match(/20(2[0-9]|3[0-9])/);
        if (textMatch) return textMatch[0];
        
        // Fallback al año actual
        return new Date().getFullYear().toString();
    }

    /**
     * Extrae el nombre del archivo de la ruta
     */
    extractFileName(filePath) {
        return filePath.split(/[/\\]/).pop();
    }

    /**
     * Parsea PDF del Ministerio de Trabajo
     * Método mejorado: Usa contexto en lugar de look-ahead de líneas
     */
    parseMinisterioPdf(text, filePath) {
        const findings = [];
        
        // Detectar ciclos PHVA en el texto completo
        let currentCycle = '';
        const cycleMatches = text.matchAll(/(?:Ciclo|CICLO)[:\s]*(PLANEAR|HACER|VERIFICAR|ACTUAR)/gi);
        const cycles = Array.from(cycleMatches);
        
        // Patrón mejorado: Busca código + todo el contexto hasta el próximo código o final
        // Usa [\s\S] para incluir saltos de línea (multiline tolerant)
        const itemPattern = /(\d+\.\d+\.\d+)[\s\S]+?(?=\d+\.\d+\.\d+|$)/g;
        
        const itemMatches = text.matchAll(itemPattern);
        
        for (const match of itemMatches) {
            const code = match[1];
            const itemText = match[0].trim();
            
            // Determinar el ciclo actual basado en la posición del ítem
            currentCycle = this.determineCycleForPosition(text, match.index, cycles);
            
            // Extraer descripción (todo después del código hasta el primer número o patrón de puntaje)
            const descMatch = itemText.match(/\d+\.\d+\.\d+[\s\S]+?(?=\d+\.?\d*[\s\/]*\d+\.?\d*|Cumple|No Cumple|Parcial|$)/i);
            const desc = descMatch ? descMatch[0].replace(/^\d+\.\d+\.\d+/, '').trim().substring(0, 200) : code;
            
            // Extraer puntajes del contexto del ítem
            const scores = itemText.match(/(\d+\.?\d*)/g) || [];
            let maxScore = 0;
            let obtainedScore = 0;
            let status = 'No Cumple';
            let requiereRevisionManual = false;
            
            // Buscar patrón de puntaje (ej: 0.5 / 0.5 o 0.5 de 0.5)
            const scorePattern = /(\d+\.?\d*)\s*(?:\/|de)\s*(\d+\.?\d*)/i;
            const scoreMatch = itemText.match(scorePattern);
            
            if (scoreMatch) {
                obtainedScore = parseFloat(scoreMatch[1]);
                maxScore = parseFloat(scoreMatch[2]);
            } else if (scores.length >= 2) {
                // Fallback: usar los últimos dos números encontrados
                maxScore = parseFloat(scores[scores.length - 1]);
                obtainedScore = parseFloat(scores[scores.length - 2]);
            }
            
            // Detectar estado del texto
            const lowerText = itemText.toLowerCase();
            if (lowerText.includes('cumple totalmente') || lowerText.includes('cumple') && !lowerText.includes('no cumple')) {
                status = 'Cumple';
                // Si cumple pero no hay puntaje, asumir puntaje máximo
                if (maxScore > 0 && obtainedScore === 0) {
                    obtainedScore = maxScore;
                }
            } else if (lowerText.includes('no cumple')) {
                status = 'No Cumple';
                obtainedScore = 0;
            } else if (lowerText.includes('parcial')) {
                status = 'Parcial';
            }
            
            // Validación cruzada: Marcar para revisión manual si hay inconsistencias
            if (status === 'No Cumple' && maxScore === 0) {
                requiereRevisionManual = true;
            } else if (status === 'Cumple' && obtainedScore === 0 && maxScore > 0) {
                requiereRevisionManual = true;
            } else if (obtainedScore > maxScore) {
                requiereRevisionManual = true;
            }
            
            findings.push({
                code: code,
                cycle: currentCycle,
                standard: '', // Se puede extraer si es necesario
                desc: desc,
                max: maxScore,
                grade: obtainedScore,
                status: status,
                requiereRevisionManual: requiereRevisionManual
            });
        }
        
        // Si no se encontraron hallazgos, intentar método genérico
        if (findings.length === 0) {
            console.log('[EvaluacionPdfParser] No se encontraron hallazgos con método principal, usando genérico');
            return this.parseGenericPdf(text);
        }
        
        console.log(`[EvaluacionPdfParser] Se encontraron ${findings.length} hallazgos`);
        return { findings, rawData: text };
    }

    /**
     * Determina el ciclo PHVA basado en la posición del ítem en el texto
     */
    determineCycleForPosition(text, position, cycles) {
        for (let i = cycles.length - 1; i >= 0; i--) {
            if (position > cycles[i].index) {
                return cycles[i][1].toUpperCase();
            }
        }
        return '';
    }

    /**
     * Parsea PDF de ARL
     * Método mejorado: Usa contexto en lugar de look-ahead de líneas
     */
    parseArlPdf(text, filePath) {
        const findings = [];
        
        // Patrón mejorado para riesgos: Busca código de riesgo + todo el contexto hasta el próximo riesgo o final
        // Usa [\s\S] para incluir saltos de línea (multiline tolerant)
        const riskPattern = /(?:Riesgo|R-)([A-Z]+)[\s\S]+?(?=(?:Riesgo|R-)[A-Z]+|$)/gi;
        
        const riskMatches = text.matchAll(riskPattern);
        
        for (const match of riskMatches) {
            const riskCode = match[1].toUpperCase();
            const code = `R-${riskCode}`;
            const riskText = match[0].trim();
            
            // Extraer descripción (todo después del código hasta el primer número o patrón de puntaje)
            const descMatch = riskText.match(/(?:Riesgo|R-)[A-Z]+[\s\S]+?(?=\d+\.?\d*[\s\/]*\d+\.?\d*|Cumple|No Cumple|Parcial|$)/i);
            const desc = descMatch ? descMatch[0].replace(/(?:Riesgo|R-)[A-Z]+/, '').trim().substring(0, 200) : `Riesgo ${riskCode}`;
            
            // Extraer puntajes del contexto del riesgo
            const scores = riskText.match(/(\d+\.?\d*)/g) || [];
            let maxScore = 10; // Valor por defecto para riesgos
            let obtainedScore = 0;
            let status = 'No Cumple';
            let requiereRevisionManual = false;
            
            // Buscar patrón de puntaje (ej: 5 / 10 o 5 de 10)
            const scorePattern = /(\d+\.?\d*)\s*(?:\/|de)\s*(\d+\.?\d*)/i;
            const scoreMatch = riskText.match(scorePattern);
            
            if (scoreMatch) {
                obtainedScore = parseFloat(scoreMatch[1]);
                maxScore = parseFloat(scoreMatch[2]);
            } else if (scores.length >= 1) {
                // Fallback: usar el último número como puntaje obtenido
                obtainedScore = parseFloat(scores[scores.length - 1]);
            }
            
            // Detectar estado del texto
            const lowerText = riskText.toLowerCase();
            if (lowerText.includes('cumple totalmente') || lowerText.includes('cumple') && !lowerText.includes('no cumple')) {
                status = 'Cumple';
                // Si cumple pero no hay puntaje, asumir puntaje máximo
                if (maxScore > 0 && obtainedScore === 0) {
                    obtainedScore = maxScore;
                }
            } else if (lowerText.includes('no cumple')) {
                status = 'No Cumple';
                obtainedScore = 0;
            } else if (lowerText.includes('parcial')) {
                status = 'Parcial';
            }
            
            // Validación cruzada: Marcar para revisión manual si hay inconsistencias
            if (status === 'No Cumple' && maxScore === 0) {
                requiereRevisionManual = true;
            } else if (status === 'Cumple' && obtainedScore === 0 && maxScore > 0) {
                requiereRevisionManual = true;
            } else if (obtainedScore > maxScore) {
                requiereRevisionManual = true;
            }
            
            findings.push({
                code: code,
                cycle: '',
                standard: '',
                desc: desc,
                max: maxScore,
                grade: obtainedScore,
                status: status,
                requiereRevisionManual: requiereRevisionManual
            });
        }
        
        // Si no se encontraron hallazgos, intentar método genérico
        if (findings.length === 0) {
            console.log('[EvaluacionPdfParser] No se encontraron riesgos con método principal, usando genérico');
            return this.parseGenericPdf(text);
        }
        
        console.log(`[EvaluacionPdfParser] Se encontraron ${findings.length} riesgos`);
        return { findings, rawData: text };
    }

    /**
     * Método genérico para parsear PDFs cuando no se detecta patrón específico
     */
    parseGenericPdf(text) {
        const findings = [];
        
        // Buscar patrones de código y descripción
        const patterns = [
            /(\d+\.\d+\.\d+)\s+([^\n]+?)(?=\n\d+\.\d+\.\d+|\n*$)/g,
            /([A-Z]-\w+)\s+([^\n]+?)(?=\n[A-Z]-\w+|\n*$)/g
        ];
        
        for (const pattern of patterns) {
            const matches = text.matchAll(pattern);
            
            for (const match of matches) {
                const code = match[1];
                const desc = match[2].trim();
                
                // Buscar números en la descripción para inferir puntaje
                const numbers = desc.match(/(\d+\.?\d*)/g) || [];
                let maxScore = 1;
                let obtainedScore = 0;
                let status = 'No Cumple';
                
                if (numbers.length >= 1) {
                    maxScore = parseFloat(numbers[numbers.length - 1]);
                    if (numbers.length >= 2) {
                        obtainedScore = parseFloat(numbers[numbers.length - 2]);
                    }
                }
                
                // Detectar estado del texto
                const lowerDesc = desc.toLowerCase();
                if (lowerDesc.includes('cumple')) {
                    status = 'Cumple';
                    if (obtainedScore === 0 && maxScore > 0) {
                        obtainedScore = maxScore;
                    }
                } else if (lowerDesc.includes('no cumple')) {
                    status = 'No Cumple';
                    obtainedScore = 0;
                } else if (lowerDesc.includes('parcial')) {
                    status = 'Parcial';
                }
                
                findings.push({
                    code: code,
                    cycle: '',
                    standard: '',
                    desc: desc.substring(0, 100), // Limitar longitud
                    max: maxScore,
                    grade: obtainedScore,
                    status: status
                });
            }
        }
        
        return { findings, rawData: text };
    }

    /**
     * Calcula métricas a partir de los hallazgos
     */
    calculateMetrics(findings) {
        if (!findings || findings.length === 0) {
            return {
                cumplimiento: 0,
                totalItems: 0,
                cumplidos: 0,
                noCumplidos: 0,
                parcial: 0
            };
        }
        
        const totalItems = findings.length;
        const cumplidos = findings.filter(f => f.status === 'Cumple').length;
        const noCumplidos = findings.filter(f => f.status === 'No Cumple').length;
        const parcial = findings.filter(f => f.status === 'Parcial').length;
        
        const totalGrade = findings.reduce((sum, f) => sum + (f.grade || 0), 0);
        const totalMax = findings.reduce((sum, f) => sum + (f.max || 0), 0);
        
        const cumplimiento = totalMax > 0 ? Math.round((totalGrade / totalMax) * 100) : 0;
        
        return {
            cumplimiento,
            totalItems,
            cumplidos,
            noCumplidos,
            parcial
        };
    }
}

module.exports = EvaluacionPdfParser;
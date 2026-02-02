/**
 * Parser para extraer datos de PDFs de evaluación inicial del SG-SST
 * Soporta dos formatos:
 * 1. PDF del Ministerio (Resultados Calificación de Estándares Mínimos)
 * 2. PDF de ARL (Informe Res 0312)
 */

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

class EvaluacionPdfParser {
    constructor() {
        this.pdfLib = pdf;
    }

    /**
     * Valida el formato del PDF según el tipo de fuente
     * @param {string} text - Texto extraído del PDF
     * @param {string} sourceType - Tipo de fuente ('ministerio' o 'arl')
     * @returns {Object} Resultado de la validación
     */
    validatePdfFormat(text, sourceType) {
        if (sourceType === 'ministerio') {
            // Validar formato del Ministerio
            const hasHeader = text.includes('Número Radicado:') || 
                             text.includes('Nombre de la Empresa :');
            const hasTable = text.includes('ESTÁNDARES MÍNIMOS SGSST') ||
                           text.includes('TABLA DE VALORES Y CALIFICACIÓN');
            const hasItems = /\d+\.\d+\.\d+/.test(text); // Busca patrones como 1.1.1
            
            if (!hasHeader) {
                return { isValid: false, reason: 'No se encontró el encabezado del Ministerio' };
            }
            if (!hasTable) {
                return { isValid: false, reason: 'No se encontró la tabla de valores y calificación' };
            }
            if (!hasItems) {
                return { isValid: false, reason: 'No se encontraron ítems de evaluación' };
            }
            
            return { isValid: true };
        } else if (sourceType === 'arl') {
            // Validar formato de ARL
            const hasHeader = text.includes('INFORME DE ESTANDARES MÍNIMOS') ||
                             text.includes('Resolución 312');
            const hasTable = text.includes('TABLA DE VALORES Y CALIFICACIÓN');
            const hasItems = /\d+\.\d+\.\d+/.test(text);
            
            if (!hasHeader) {
                return { isValid: false, reason: 'No se encontró el encabezado del informe ARL' };
            }
            if (!hasTable) {
                return { isValid: false, reason: 'No se encontró la tabla de valores y calificación' };
            }
            if (!hasItems) {
                return { isValid: false, reason: 'No se encontraron ítems de evaluación' };
            }
            
            return { isValid: true };
        }
        
        return { isValid: false, reason: 'Tipo de fuente no reconocido' };
    }

    /**
     * Extrae el año del nombre del archivo o del contenido
     * @param {string} filePath - Ruta del archivo
     * @param {string} text - Texto del PDF
     * @returns {string} Año extraído
     */
    extractYear(filePath, text) {
        // Primero intentar del nombre del archivo
        const fileName = path.basename(filePath);
        const yearMatch = fileName.match(/20[1-2][0-9]/);
        if (yearMatch) {
            return yearMatch[0];
        }
        
        // Luego intentar del contenido
        const contentMatch = text.match(/(?:Periodo Correspondiente|Periodo)\s*:\s*(20[1-2][0-9])/);
        if (contentMatch) {
            return contentMatch[1];
        }
        
        // Por defecto, usar el año actual
        return new Date().getFullYear().toString();
    }

    /**
     * Extrae el nombre del archivo sin extensión
     * @param {string} filePath - Ruta del archivo
     * @returns {string} Nombre del archivo
     */
    extractFileName(filePath) {
        return path.basename(filePath, path.extname(filePath));
    }

    /**
     * Parsea un PDF del Ministerio
     * @param {string} text - Texto extraído del PDF
     * @param {string} filePath - Ruta del archivo
     * @returns {Object} Datos extraídos
     */
    parseMinisterioPdf(text, filePath) {
        const findings = [];
        const lines = text.split('\n');
        
        let currentItem = null;
        let descriptionLines = [];
        let inItem = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Ignorar líneas de página
            if (line.match(/^-- \d+ of \d+ --$/)) {
                continue;
            }
            
            // Ignorar líneas de encabezado de tabla
            if (line.includes('CICLO') && line.includes('ESTÁNDAR')) {
                continue;
            }
            
            // Detectar inicio de un ítem (línea que empieza con patrón como 1.1.1)
            const itemMatch = line.match(/^(\d+\.\d+\.\d+)\s+(.+)$/);
            
            if (itemMatch) {
                // Guardar el ítem anterior si existe
                if (currentItem && inItem) {
                    currentItem.desc = descriptionLines.join(' ').trim();
                    findings.push(currentItem);
                }
                
                // Crear nuevo ítem con nombres de propiedades compatibles con la interfaz
                currentItem = {
                    code: itemMatch[1],           // ID del ítem
                    desc: '',                    // Descripción
                    max: 0,                     // Valor máximo
                    grade: 0,                   // Puntaje obtenido
                    status: 'no_cumple',
                    requiereRevisionManual: true,  // Requiere revisión manual
                    errores: []                  // Lista de errores
                };
                descriptionLines = [itemMatch[2]];
                inItem = true;
            } else if (inItem && currentItem) {
                // Buscar línea con valor y estado (ej: 0.50 	Cumple)
                const valueMatch = line.match(/^(\d+[\.,]?\d*)\s+(.+?)\s*$/);
                
                if (valueMatch) {
                    const value = parseFloat(valueMatch[1].replace(',', '.'));
                    const statusText = valueMatch[2];
                    
                    currentItem.max = value;
                    currentItem.status = this.parseStatus(statusText);
                    currentItem.grade = value;
                    currentItem.requiereRevisionManual = currentItem.status === 'no_cumple' || currentItem.status === 'parcial';
                    
                    // La siguiente línea podría tener el puntaje (ej: totalmente 0.50)
                    if (i + 1 < lines.length) {
                        const nextLine = lines[i + 1].trim();
                        const scoreMatch = nextLine.match(/^.+?\s+(\d+[\.,]?\d*)$/);
                        if (scoreMatch) {
                            currentItem.grade = parseFloat(scoreMatch[1].replace(',', '.'));
                        }
                    }
                    
                    // Guardar el ítem
                    currentItem.desc = descriptionLines.join(' ').trim();
                    findings.push(currentItem);
                    
                    // Resetear para el siguiente ítem
                    currentItem = null;
                    descriptionLines = [];
                    inItem = false;
                } else if (line && !line.match(/^(Planear|Hacer|Verificar|Actuar)/)) {
                    // Acumular líneas de descripción
                    descriptionLines.push(line);
                }
            }
        }
        
        // Guardar el último ítem si existe
        if (currentItem && inItem) {
            currentItem.desc = descriptionLines.join(' ').trim();
            findings.push(currentItem);
        }
        
        return {
            findings: findings,
            rawData: { text, lines }
        };
    }

    /**
     * Parsea un PDF de ARL
     * @param {string} text - Texto extraído del PDF
     * @param {string} filePath - Ruta del archivo
     * @returns {Object} Datos extraídos
     */
    parseArlPdf(text, filePath) {
        const findings = [];
        const lines = text.split('\n');
        
        let currentItem = null;
        let descriptionLines = [];
        let inItem = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Ignorar líneas de página
            if (line.match(/^-- \d+ of \d+ --$/)) {
                continue;
            }
            
            // Ignorar líneas de encabezado de tabla
            if (line.includes('CICLO') && line.includes('ESTÁNDAR')) {
                continue;
            }
            
            // Detectar inicio de un ítem (línea que empieza con patrón como 1.1.1)
            const itemMatch = line.match(/^(\d+\.\d+\.\d+)\s+(.+)$/);
            
            if (itemMatch) {
                // Guardar el ítem anterior si existe
                if (currentItem && inItem) {
                    currentItem.desc = descriptionLines.join(' ').trim();
                    findings.push(currentItem);
                }
                
                // Crear nuevo ítem con nombres de propiedades compatibles con la interfaz
                currentItem = {
                    code: itemMatch[1],           // ID del ítem
                    desc: '',                    // Descripción
                    max: 0,                     // Valor máximo
                    grade: 0,                   // Puntaje obtenido
                    status: 'no_cumple',
                    requiereRevisionManual: true,  // Requiere revisión manual
                    errores: []                  // Lista de errores
                };
                descriptionLines = [itemMatch[2]];
                inItem = true;
            } else if (inItem && currentItem) {
                // Buscar línea con valor y marca X (ej: 0,5 X)
                const valueMatch = line.match(/^(\d+[\.,]?\d*)\s*(X)?$/);
                
                if (valueMatch) {
                    const value = parseFloat(valueMatch[1].replace(',', '.'));
                    const hasX = valueMatch[2] === 'X';
                    
                    currentItem.max = value;
                    currentItem.status = hasX ? 'cumple' : 'no_cumple';
                    currentItem.grade = hasX ? value : 0;
                    currentItem.requiereRevisionManual = !hasX;
                    
                    // Guardar el ítem
                    currentItem.desc = descriptionLines.join(' ').trim();
                    findings.push(currentItem);
                    
                    // Resetear para el siguiente ítem
                    currentItem = null;
                    descriptionLines = [];
                    inItem = false;
                } else if (line && !line.match(/^(Planear|Hacer|Verificar|Actuar)/)) {
                    // Acumular líneas de descripción
                    descriptionLines.push(line);
                }
            }
        }
        
        // Guardar el último ítem si existe
        if (currentItem && inItem) {
            currentItem.desc = descriptionLines.join(' ').trim();
            findings.push(currentItem);
        }
        
        return {
            findings: findings,
            rawData: { text, lines }
        };
    }

    /**
     * Parsea el estado de cumplimiento
     * @param {string} statusText - Texto del estado
     * @returns {string} Estado normalizado
     */
    parseStatus(statusText) {
        if (!statusText) return 'no_cumple';
        
        const normalized = statusText.toLowerCase().trim();
        
        if (normalized.includes('cumple totalmente') || normalized === 'cumple') {
            return 'cumple';
        } else if (normalized.includes('parcial')) {
            return 'parcial';
        } else if (normalized.includes('no cumple') || normalized === 'no cumple') {
            return 'no_cumple';
        } else if (normalized === 'x') {
            return 'cumple';
        }
        
        return 'no_cumple';
    }

    /**
     * Calcula métricas de los hallazgos
     * @param {Array} findings - Lista de hallazgos
     * @returns {Object} Métricas calculadas
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
        const cumplidos = findings.filter(f => f.status === 'cumple').length;
        const noCumplidos = findings.filter(f => f.status === 'no_cumple').length;
        const parcial = findings.filter(f => f.status === 'parcial').length;
        
        const cumplimiento = totalItems > 0 ? Math.round((cumplidos / totalItems) * 100) : 0;
        
        return {
            cumplimiento,
            totalItems,
            cumplidos,
            noCumplidos,
            parcial
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

            // Leer el archivo PDF como Uint8Array
            const dataBuffer = fs.readFileSync(pdfPath);
            const data = new Uint8Array(dataBuffer);
            
            console.log(`[EvaluacionPdfParser] Tamaño del archivo: ${dataBuffer.length} bytes`);
            
            // Crear el parser usando pdf-parse v2.4.5
            console.log('[EvaluacionPdfParser] Creando parser PDF...');
            const parser = new this.pdfLib.PDFParse(data);
            
            // Obtener el texto del PDF
            console.log('[EvaluacionPdfParser] Extrayendo texto del PDF...');
            const result = await parser.getText();
            
            console.log(`[EvaluacionPdfParser] PDF leído, ${result.total} páginas`);
            console.log(`[EvaluacionPdfParser] Longitud del texto: ${result.text.length} caracteres`);
            
            // Validar formato preliminar
            const formatValidation = this.validatePdfFormat(result.text, sourceType);
            if (!formatValidation.isValid) {
                console.warn(`[EvaluacionPdfParser] Formato de PDF no reconocido: ${formatValidation.reason}`);
                return {
                    success: false,
                    error: `Formato de PDF no reconocido: ${formatValidation.reason}`,
                    year: new Date().getFullYear().toString(),
                    source: sourceType,
                    fileName: this.extractFileName(pdfPath),
                    filePath: pdfPath,
                    findings: [],
                    metrics: { cumplimiento: 0, totalItems: 0, cumplidos: 0, noCumplidos: 0, parcial: 0 }
                };
            }

            // Extraer el año del nombre del archivo o del contenido
            const year = this.extractYear(pdfPath, result.text);

            // Extraer datos según el tipo de fuente
            const extractedData = sourceType === 'ministerio' 
                ? this.parseMinisterioPdf(result.text, pdfPath)
                : this.parseArlPdf(result.text, pdfPath);

            console.log(`[EvaluacionPdfParser] Hallazgos extraídos: ${extractedData.findings.length}`);

            // Calcular métricas
            const metrics = this.calculateMetrics(extractedData.findings);
            
            console.log(`[EvaluacionPdfParser] Métricas:`, metrics);

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
}

module.exports = EvaluacionPdfParser;

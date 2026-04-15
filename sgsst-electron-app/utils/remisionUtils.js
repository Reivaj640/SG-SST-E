/**
 * @fileoverview RemisionUtils — Procesamiento multi-formato de remisiones médicas
 * @description Portado desde Remisiones_v1.0.py + process_pdf_cli.py (Portear/src).
 *              Soporta 4 formatos: formato_1 (Santiago Algarin), formato_2 (Ortiz Galindo),
 *              vemedic (biofile.com.co) y formato_generico (fallback universal).
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const pdf  = require('pdf-parse');
const XLSX = require('xlsx');

class RemisionUtils {
  constructor() {
    this.pdfLib = pdf;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // API PÚBLICA
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Extrae el texto completo de un PDF usando pdf-parse v2.4.5
   */
  async extractTextFromPDF(pdfPath) {
    console.log(`[RemisionUtils] Leyendo PDF: ${pdfPath}`);
    const dataBuffer = fs.readFileSync(pdfPath);
    const data       = new Uint8Array(dataBuffer);
    const parser     = new this.pdfLib.PDFParse(data);
    const result     = await parser.getText();
    console.log(`[RemisionUtils] ${result.total} página(s), ${result.text.length} chars`);
    return result.text;
  }

  /**
   * Extrae datos estructurados del texto con detección automática de formato.
   * @param {string} text - Texto completo del PDF
   * @returns {Object} Datos extraídos (21 campos + metadata)
   */
  extractDataFromText(text) {
    // 1. Pre-procesar texto
    const cleanText = this._preprocessText(text);

    // 2. Detectar formato
    const fmt = this._detectFormat(cleanText);
    console.log(`[RemisionUtils] Formato detectado: ${fmt}`);

    // 3. Extraer según formato
    let data;
    switch (fmt) {
      case 'formato_1':  data = this._extractFormato1(cleanText);  break;
      case 'formato_2':  data = this._extractFormato2(cleanText);  break;
      case 'vemedic':    data = this._extractFormatoVemedic(cleanText); break;
      default:           data = this._extractFormatoGenerico(cleanText);
    }

    // 4. Post-procesar
    data = this._postProcess(data);

    console.log(`[RemisionUtils] Campos extraídos: ${Object.keys(data).length}`);
    return data;
  }

  /**
   * Valida que los campos críticos estén presentes.
   * @returns {boolean}
   */
  validateCriticalData(data) {
    const required = ['No. Identificación', 'Fecha de Atención'];
    const missing  = required.filter(f => !data[f] || data[f] === 'NO_DISPONIBLE');
    if (missing.length > 0) {
      console.warn('[RemisionUtils] Campos requeridos ausentes:', missing);
    }
    return missing.length === 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRE-PROCESAMIENTO
  // ═══════════════════════════════════════════════════════════════════════════

  _preprocessText(text) {
    // Eliminar patrones de paginación y ruido
    let t = text
      .replace(/P[áa]gina\s*\d+\s*de\s*\d+/gi, '')
      .replace(/DATOS DEL PACIENTE/gi, '')
      .replace(/\.{3,}/g, '');

    // Si hay LEVANTAMIENTO DE RESTRICCIONES: conservar datos del inicio + último bloque relevante
    if (/LEVANTAMIENTO\s+DE\s+RESTRICCIONES/i.test(t)) {
      const parts = t.split(/LEVANTAMIENTO\s+DE\s+RESTRICCIONES/i);
      t = parts[0] + parts[parts.length - 1];
    }

    return t;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DETECCIÓN DE FORMATO
  // ═══════════════════════════════════════════════════════════════════════════

  _detectFormat(text) {
    const upper = text.toUpperCase();
    if (text.includes('www.biofile.com.co'))                                          return 'vemedic';
    if (upper.includes('DOCUMENTO : CC') && upper.includes('PACIENTE:'))              return 'formato_1';
    if (upper.includes('NOMBRE COMPLETO:') && upper.includes('TIPO DE EVALUACION'))  return 'formato_2';
    return 'formato_generico';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMATO 1 — Santiago Algarin (PACIENTE: / DOCUMENTO: CC)
  // ═══════════════════════════════════════════════════════════════════════════

  _extractFormato1(text) {
    const data = {};

    // Nombre Completo — limpieza avanzada
    let nombreMatch = text.match(/PACIENTE[:\s]*([^:\n]+?)(?=(?:EDAD|SEXO|DOCUMENTO|FECHA|\n|$))/i);
    if (!nombreMatch) {
      nombreMatch = text.match(/PACIENTE:\s*\n([A-ZÁÉÍÓÚÑ\s]+)\b/i);
    }
    if (nombreMatch) {
      let nombre = nombreMatch[1].trim().toUpperCase();
      nombre = nombre.replace(/\b(?:DOCUMENTO|CC|PACIENTE|FECHA|EDAD|SEXO|NAC)\b/gi, '');
      nombre = nombre.replace(/[^A-ZÁÉÍÓÚÑ ]/g, '').replace(/\s+/g, ' ').trim();
      if (nombre.split(' ').length >= 2) {
        data['Nombre Completo'] = nombre;
      } else {
        const lineMatch = text.match(/PACIENTE[:\s]*(.*?)\n/i);
        if (lineMatch) {
          const words = lineMatch[1].split(' ').filter(w => w.length > 3 && /^[a-záéíóúñA-ZÁÉÍÓÚÑ]+$/.test(w));
          data['Nombre Completo'] = words.length > 0 ? words.join(' ').toUpperCase() : 'NO DISPONIBLE';
        } else {
          data['Nombre Completo'] = 'NO DISPONIBLE';
        }
      }
    } else {
      data['Nombre Completo'] = 'NO DISPONIBLE';
    }

    // Cédula
    const docMatch = text.match(/DOCUMENTO[:\s]*CC[:\s]*(\d+)/i);
    if (docMatch) data['No. Identificación'] = docMatch[1].trim();

    // Fecha de nacimiento
    const fechaNacMatch = text.match(/FECHA\s*(?:DE)?\s*NAC[:\s]*([\d/-]+)/i);
    if (fechaNacMatch) data['Fecha Nac'] = this._formatDate(fechaNacMatch[1].trim());

    // Edad
    const edadMatch = text.match(/EDAD[:\s]*(\d+)/i);
    if (edadMatch) data['Edad'] = edadMatch[1].trim();

    // Sexo
    const sexoMatch = text.match(/SEXO[:\s]*([A-Za-záéíóúñÁÉÍÓÚÑ]+)/i);
    if (sexoMatch) data['Sexo'] = this._capitalizeFirst(sexoMatch[1].trim());

    // Afiliación
    const afilMatch = text.match(/AFILIACI[OÓ]N[:\s]*(.*?)(?=\s*(?:OCUPACI[ÓO]N|$))/is);
    if (afilMatch) {
      data['Afiliación'] = afilMatch[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
    }

    // Estado civil
    const ecMatch = text.match(/ESTADO\s*CIVIL[:\s]*(.*?)(?:\n|$)/i);
    if (ecMatch) data['Estado civil'] = this._capitalizeFirst(ecMatch[1].trim());

    // Evaluación Ocupacional
    const evalMatch = text.match(/Evaluaci[óo]n\s*Ocupacional[:\s]*([^:\n]+?)(?=\s*Fecha\s*de\s*atenci[óo]n:|$)/i);
    if (evalMatch) data['Evaluación Ocupacional'] = evalMatch[1].trim().toUpperCase();

    // Fecha de Atención
    const fechaAtMatch = text.match(/Fecha\s*de\s*atenci[óo]n[:\s]*([\d/-]+)/i);
    if (fechaAtMatch) data['Fecha de Atención'] = this._formatDate(fechaAtMatch[1].trim());

    // Cargo
    const cargoMatch = text.match(/Cargo[:\s]*([^:\n]+?)(?:\s*Fecha\s*de\s*atenci[óo]n:|$)/i);
    if (cargoMatch) data['Cargo'] = cargoMatch[1].trim().toUpperCase();

    // Exámenes realizados
    const examMatch = text.match(/EX[ÁA]MENES\s*REALIZADOS[:\s]*(.*?)(?=RECOMENDACIONES|$)/is);
    if (examMatch) data['Exámenes realizados'] = examMatch[1].trim().toUpperCase();

    // Recomendaciones Laborales
    const recomMatch = text.match(/RECOMENDACIONES\s*LABORALES[:\s]*(.*?)(?=MANEJO\s*EPS\/ARL|$)/is);
    if (recomMatch) data['Recomendaciones Laborales'] = recomMatch[1].trim().toUpperCase();

    // Incluir SVE
    const sveMatch = text.match(/Incluir\s*SVE[:\s]*([^\n:]+?)(?=\s*(?:RESTRICCIONES|Concepto|$))/i);
    if (sveMatch && !sveMatch[1].trim().startsWith('RESTRICCIONES')) {
      data['Incluir SVE'] = sveMatch[1].trim().toUpperCase();
    }

    // Restricciones Laborales
    const restricMatch = text.match(/RESTRICCIONES\s*LABORALES[:\s]*(.*?)(?=Para\s*la\s*revisi[óo]n|CONCEPTO|$)/is);
    if (restricMatch) data['Restricciones Laborales'] = restricMatch[1].trim() || 'NINGUNO';

    // Concepto Medico — última ocurrencia válida (no LEVANTAMIENTO)
    const conceptoAll = [...text.matchAll(/Concepto\s*Medico[:\s]*((?!LEVANTAMIENTO)[^:\n]+)/gi)];
    if (conceptoAll.length > 0) {
      data['Concepto Medico'] = conceptoAll[conceptoAll.length - 1][1].trim().toUpperCase();
    }

    // Concepto Manipulación Alimento
    const alimMatch = text.match(/Concepto\s*Manipulaci[óo]n\s*Alimento[:\s]*(.*?)(?:\n|$)/i);
    if (alimMatch) data['Concepto Manipulación Alimento'] = alimMatch[1].trim() || 'NINGUNO';

    // Concepto Altura
    const alturaMatch = text.match(/Concepto\s*Altura[:\s]*(.*?)(?:\n|$)/i);
    if (alturaMatch) data['Concepto Altura'] = alturaMatch[1].trim() || 'NINGUNO';

    // Concepto trabajo espacios confinados
    const espMatch = text.match(/Concepto\s*de\s*trabajo\s*en\s*espacios\s*confinados[:\s]*([^\n:]+?)(?=\s*(?:MOTIVO|$))/i);
    if (espMatch && !espMatch[1].trim().startsWith('MOTIVO')) {
      data['Concepto de trabajo en espacios confinados'] = espMatch[1].trim().toUpperCase();
    }

    // Motivo de Restricción — última ocurrencia
    const motivoAll = [...text.matchAll(/MOTIVO\s*DE\s*RESTRICCI[OÓ]N[:\s]*(.*?)(?=FIRMA|$)/gis)];
    if (motivoAll.length > 0) {
      const motivo = motivoAll[motivoAll.length - 1][1].trim();
      data['Motivo de Restricción'] = (motivo && !motivo.includes('Página')) ? motivo : 'NINGUNO';
    }

    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMATO 2 — Ortiz Galindo (Nombre Completo: / No. Identificación:)
  // ═══════════════════════════════════════════════════════════════════════════

  _extractFormato2(text) {
    const data = {};

    const nombreMatch = text.match(/Nombre\s*Completo[:\s]*(.*?)(?:\n|$)/i);
    if (nombreMatch) data['Nombre Completo'] = nombreMatch[1].trim().toUpperCase();

    const idMatch = text.match(/(?:No\.|N[úu]mero)\s*Identificaci[óo]n[:\s]*(?:CC\s*-\s*)?(\d+)/i);
    if (idMatch) data['No. Identificación'] = idMatch[1].trim();

    const fnMatch = text.match(/Fecha\s*Nac[:\s]*([\d/-]+)/i);
    if (fnMatch) data['Fecha Nac'] = this._formatDate(fnMatch[1].trim());

    const edadMatch = text.match(/Edad[:\s]*(\d+)/i);
    if (edadMatch) data['Edad'] = edadMatch[1].trim();

    const sexoMatch = text.match(/Sexo[:\s]*(.*?)(?:\n|$)/i);
    if (sexoMatch) data['Sexo'] = this._capitalizeFirst(sexoMatch[1].trim());

    const afilMatch = text.match(/Afiliaci[óo]n[:\s]*(.*?)(?:\n|$)/i);
    if (afilMatch) data['Afiliación'] = afilMatch[1].trim().toUpperCase();

    const ecMatch = text.match(/Estado\s*civil[:\s]*(.*?)(?:\n|$)/i);
    if (ecMatch) data['Estado civil'] = this._capitalizeFirst(ecMatch[1].trim());

    const evalMatch = text.match(/Evaluaci[óo]n\s*Ocupacional[:\s]*([^:\n]+?)(?=\s*Fecha\s*de\s*atenci[óo]n:|$)/i);
    if (evalMatch) data['Evaluación Ocupacional'] = evalMatch[1].trim().toUpperCase();

    const fechaAtMatch = text.match(/Fecha\s*de\s*atenci[óo]n[:\s]*([\d/-]+)/i);
    if (fechaAtMatch) data['Fecha de Atención'] = this._formatDate(fechaAtMatch[1].trim());

    const cargoMatch = text.match(/Cargo[:\s]*([^:\n]+?)(?:\s*Fecha\s*de|$)/i);
    if (cargoMatch) data['Cargo'] = cargoMatch[1].trim().toUpperCase();

    const examMatch = text.match(/EX[ÁA]MENES\s*REALIZADOS[:\s]*(.*?)(?=RECOMENDACIONES|$)/is);
    if (examMatch) data['Exámenes realizados'] = examMatch[1].trim().toUpperCase();

    const recomMatch = text.match(/RECOMENDACIONES\s*LABORALES[:\s]*(.*?)(?=MANEJO\s*EPS\/ARL|$)/is);
    if (recomMatch) data['Recomendaciones Laborales'] = recomMatch[1].trim().toUpperCase();

    const sveMatch = text.match(/Incluir\s*SVE[:\s]*(.*?)(?:\n|$)/i);
    if (sveMatch) data['Incluir SVE'] = sveMatch[1].trim() || 'NINGUNO';

    const restricMatch = text.match(/RESTRICCIONES\s*LABORALES[:\s]*(.*?)(?=Para\s*la\s*revisi[óo]n|CONCEPTO|$)/is);
    if (restricMatch) data['Restricciones Laborales'] = restricMatch[1].trim() || 'NINGUNO';

    const conceptoMatch = text.match(/Concepto\s*Medico[:\s]*([^:\n]+)/i);
    if (conceptoMatch) data['Concepto Medico'] = conceptoMatch[1].trim().toUpperCase();

    const alimMatch = text.match(/Concepto\s*Manipulaci[óo]n\s*Alimento[:\s]*(.*?)(?:\n|$)/i);
    if (alimMatch) data['Concepto Manipulación Alimento'] = alimMatch[1].trim() || 'NINGUNO';

    const altMatch = text.match(/Concepto\s*Altura[:\s]*(.*?)(?:\n|$)/i);
    if (altMatch) data['Concepto Altura'] = altMatch[1].trim() || 'NINGUNO';

    const espMatch = text.match(/Concepto\s*de\s*trabajo\s*en\s*espacios\s*confinados[:\s]*(.*?)(?:\n|$)/i);
    if (espMatch) data['Concepto de trabajo en espacios confinados'] = espMatch[1].trim() || 'NINGUNO';

    const motivoMatch = text.match(/MOTIVO\s*DE\s*RESTRICCI[OÓ]N[:\s]*(.*?)(?=FIRMA|$)/is);
    if (motivoMatch) data['Motivo de Restricción'] = motivoMatch[1].trim() || 'NINGUNO';

    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMATO VEMEDIC — biofile.com.co
  // ═══════════════════════════════════════════════════════════════════════════

  _extractFormatoVemedic(text) {
    const data = {};

    // Nombre
    const nomMatch = text.match(/G[eé]nero\s+Edad\s+Documento\s+de\s+Identificaci[óo]n\n([^\n]+)/i);
    if (nomMatch) data['Nombre Completo'] = nomMatch[1].trim().toUpperCase();

    // Cédula
    const ccMatch = text.match(/CC\s+([\d]+)/i);
    if (ccMatch) data['No. Identificación'] = ccMatch[1].trim();

    // Edad
    const edadMatch = text.match(/(\d+)\s*A[ÑN]OS/i);
    if (edadMatch) data['Edad'] = edadMatch[1].trim();

    // Sexo
    const sexoMatch = text.match(/\n(FEMENINO|MASCULINO)/i);
    if (sexoMatch) data['Sexo'] = this._capitalizeFirst(sexoMatch[1].trim());

    // Afiliación
    const afilMatch = text.match(/DATOS DE LA EMPRESA[^\n]*\n([^\n]+)/i);
    if (afilMatch) data['Afiliación'] = afilMatch[1].trim().toUpperCase();

    // Cargo
    const cargoMatch = text.match(/Cargo\n([^\n]+)/i);
    if (cargoMatch) data['Cargo'] = cargoMatch[1].trim().toUpperCase();

    // Evaluación Ocupacional
    const evalMatch = text.match(/TIPO DE EX[ÁA]MEN\s+M[ÉE]DICO OCUPACIONAL\s*([^\n]+)/i);
    if (evalMatch) data['Evaluación Ocupacional'] = evalMatch[1].trim().toUpperCase();

    // Fecha de Atención
    const fechaMatch = text.match(/FECHA Y CIUDAD DE REALIZACI[ÓO]N DEL EX[ÁA]MEN[\s\S]*?(\d{2}\s+\d{2}\s+\d{4})/i);
    if (fechaMatch) {
      const partes = fechaMatch[1].split(/\s+/);
      if (partes.length === 3) data['Fecha de Atención'] = `${partes[0]}/${partes[1]}/${partes[2]}`;
    }

    // Restricciones
    const restricMatch = text.match(/RESTRICCIONES LABORALES\s*([^\n]+)/i);
    if (restricMatch) data['Restricciones Laborales'] = restricMatch[1].trim().toUpperCase();

    // Concepto Medico
    const conceptoMatch = text.match(/CONCEPTO DE APTITUD OCUPACIONAL\s*([^\n]+)/i);
    if (conceptoMatch) data['Concepto Medico'] = conceptoMatch[1].trim().toUpperCase();

    // Recomendaciones — extracción 3 columnas
    data['Recomendaciones Laborales'] = this._extractVemedicRecomendaciones(text);

    return data;
  }

  _extractVemedicRecomendaciones(text) {
    const lines = text.split('\n');
    let headerIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const upper = lines[i].toUpperCase();
      if (upper.includes('RECOMENDACIONES MÉDICAS') && upper.includes('RECOMENDACIONES OCUPACIONALES') && upper.includes('HABITOS')) {
        headerIdx = i;
        break;
      }
    }

    let medicas = '', ocupacionales = '', habitos = '';

    if (headerIdx !== -1) {
      for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i].trimEnd();
        const upper = line.toUpperCase();
        if (['OTRAS OBSERVACIONES', 'CONCEPTO DE APTITUD', 'RESTRICCIONES'].some(s => upper.includes(s))) break;
        if (!line.trim() || ['—', '-', '--', '---', 'N/A'].includes(line.trim())) continue;

        const partes = line.split(/\s{3,}/);
        if (partes.length >= 2) {
          if (partes[0].trim()) medicas     += (medicas     ? ' ' : '') + partes[0].trim();
          if (partes[1].trim()) ocupacionales += (ocupacionales ? ' ' : '') + partes[1].trim();
          if (partes[2] && partes[2].trim()) habitos += (habitos ? ' ' : '') + partes[2].trim();
        } else {
          // fallback: dividir en tercios
          const words = line.trim().split(' ');
          if (words.length >= 3) {
            const t1 = Math.floor(words.length / 3);
            const t2 = 2 * t1;
            const p1 = words.slice(0, t1).join(' ');
            const p2 = words.slice(t1, t2).join(' ');
            const p3 = words.slice(t2).join(' ');
            if (p1) medicas      += (medicas      ? ' ' : '') + p1;
            if (p2) ocupacionales+= (ocupacionales? ' ' : '') + p2;
            if (p3) habitos      += (habitos      ? ' ' : '') + p3;
          } else {
            habitos += (habitos ? ' ' : '') + line.trim();
          }
        }
      }
    } else {
      // Fallback: buscar secciones por separado
      const mMatch = text.match(/RECOMENDACIONES\s+M[ÉE]DICAS[\s\n]*([^.]*?)(?=RECOMENDACIONES OCUPACIONALES|HABITOS|RESTRICCIONES|\Z)/is);
      if (mMatch) medicas = mMatch[1].trim();
      const oMatch = text.match(/RECOMENDACIONES\s+OCUPACIONALES[\s\n]*([^.]*?)(?=HABITOS|RESTRICCIONES|\Z)/is);
      if (oMatch) ocupacionales = oMatch[1].trim();
      const hMatch = text.match(/HABITOS\s+Y\s+ESTILO[\s\n]*([^.]*?)(?=OTRAS OBSERVACIONES|RESTRICCIONES|\Z)/is);
      if (hMatch) habitos = hMatch[1].trim();
    }

    const partes = [];
    if (medicas)      partes.push(`RECOMENDACIONES MEDICAS: ${medicas.toUpperCase()}`);
    if (ocupacionales)partes.push(`RECOMENDACIONES OCUPACIONALES: ${ocupacionales.toUpperCase()}`);
    if (habitos)      partes.push(`HABITOS Y ESTILO DE VIDA SALUDABLES: ${habitos.toUpperCase()}`);
    return partes.length > 0 ? partes.join(' — ') : 'NINGUNO';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMATO GENÉRICO — fallback universal
  // ═══════════════════════════════════════════════════════════════════════════

  _extractFormatoGenerico(text) {
    const rules = {
      'Nombre Completo': {
        patterns: [
          /(?:Nombre\s*Completo|Paciente|Nombre)[:\s]*(.*?)(?:\n|SEXO:|DOCUMENTO|IDENTIFICACI[ÓO]N|$)/i,
          /^([A-ZÁÉÍÓÚÑ]{2}[A-ZÁÉÍÓÚÑ\s]{3,40})\s*$/m,
        ],
        proc: (m, i) => i === 0 ? m[1].trim().toUpperCase() : m[1].trim().toUpperCase()
      },
      'No. Identificación': {
        patterns: [
          /(?:Documento[:\s]*CC[:\s]*(\d+))/i,
          /(?:No\.|N[úu]mero)\s*(?:de)?\s*Identificaci[óo]n[:\s]*(?:CC\s*-\s*)?(\d{7,12})/i,
          /(?:CC|TI|CE)[:\s-]*(\d{7,12})/i,
          /(?:c[ée]dula|documento|identificaci[óo]n)[:\s]*(\d{7,12})/i,
        ],
        proc: m => m[1].replace(/[^\d]/g, '')
      },
      'Fecha Nac': {
        patterns: [/Fecha\s*(?:de)?\s*Nac(?:imiento)?[:\s]*([\d/\-]+)/i],
        proc: m => this._formatDate(m[1].trim())
      },
      'Edad': {
        patterns: [/Edad[:\s]*(\d+)/i],
        proc: m => m[1].trim()
      },
      'Sexo': {
        patterns: [/(?:Sexo|G[ée]nero)[:\s]*([A-Za-záéíóúñÁÉÍÓÚÑ]+)/i],
        proc: m => this._capitalizeFirst(m[1].trim())
      },
      'Afiliación': {
        patterns: [/(?:Afiliaci[óo]n|Empresa)[:\s]*(.*?)(?:\n|$)/i],
        proc: m => m[1].trim().toUpperCase()
      },
      'Estado civil': {
        patterns: [/Estado\s*civil[:\s]*(.*?)(?:\n|$)/i],
        proc: m => this._capitalizeFirst(m[1].trim())
      },
      'Evaluación Ocupacional': {
        patterns: [/(?:TIPO\s*DE\s*EVALUACI[ÓO]N\s*REALIZADA|Tipo\s*de\s*Examen|Evaluaci[óo]n\s*Ocupacional)[:\s]*([^:\n]+?)(?=\s*Fecha\s*de\s*atenci[óo]n:|$)/i],
        proc: m => m[1].trim().toUpperCase()
      },
      'Fecha de Atención': {
        patterns: [/Fecha\s*(?:de)?\s*atenci[óo]n[:\s]*([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{2,4})/i],
        proc: m => this._formatDate(m[1].trim())
      },
      'Cargo': {
        patterns: [/Cargo[:\s]*([^:\n]+?)(?=\s*Fecha\s*de|$)/i],
        proc: m => m[1].trim().toUpperCase()
      },
      'Exámenes realizados': {
        patterns: [/EX[ÁA]MENES\s*REALIZADOS[:\s]*(.*?)(?=RECOMENDACIONES|INCLUIR|RESTRICCIONES|MANEJO|$)/is],
        proc: m => m[1].trim().replace(/\n/g, ' ').toUpperCase()
      },
      'Recomendaciones Laborales': {
        patterns: [/RECOMENDACIONES\s*LABORALES[:\s]*(.*?)(?=MANEJO\s*EPS\/ARL|$)/is],
        proc: m => m[1].trim().toUpperCase() || 'NINGUNO'
      },
      'Incluir SVE': {
        patterns: [/Incluir\s*SVE[:\s]*([^\n:]+?)(?=\s*(?:RESTRICCIONES|Concepto|$))/i],
        proc: m => !m[1].trim().startsWith('RESTRICCIONES') ? m[1].trim().toUpperCase() : 'NINGUNO'
      },
      'Restricciones Laborales': {
        patterns: [/RESTRICCIONES\s*LABORALES[:\s]*(.*?)(?=Para\s*la\s*revisi[óo]n|INCLUIR|CONCEPTO|[A-ZÁ-Ú]+:|$)/is],
        proc: m => m[1].trim().toUpperCase() || 'NINGUNO'
      },
      'Concepto Medico': {
        patterns: [/Concepto\s*Medico[:\s]*((?!LEVANTAMIENTO)[^:\n]+)/i],
        proc: m => m[1].trim().toUpperCase() || 'NINGUNO'
      },
      'Concepto Manipulación Alimento': {
        patterns: [/Concepto\s*(?:Manipulaci[óo]n)?\s*Alimento[:\s]*(.*?)(?:\n|$)/i],
        proc: m => m[1].trim().toUpperCase() || 'NINGUNO'
      },
      'Concepto Altura': {
        patterns: [/Concepto\s*Altura[:\s]*(.*?)(?:\n|$)/i],
        proc: m => m[1].trim().toUpperCase() || 'NINGUNO'
      },
      'Concepto de trabajo en espacios confinados': {
        patterns: [/Concepto\s*de\s*trabajo\s*en\s*espacios\s*confinados[:\s]*([^\n:]+?)(?=\s*(?:MOTIVO|$))/i],
        proc: m => !m[1].trim().startsWith('MOTIVO') ? m[1].trim().toUpperCase() : 'NINGUNO'
      },
      'Motivo de Restricción': {
        patterns: [/MOTIVO\s*DE\s*RESTRICCI[OÓ]N[:\s]*(.*?)(?=FIRMA|$)/is],
        proc: m => m[1].trim().toUpperCase() || 'NINGUNO'
      },
    };

    const data = {};
    for (const [key, rule] of Object.entries(rules)) {
      let found = false;
      for (let i = 0; i < rule.patterns.length; i++) {
        const m = text.match(rule.patterns[i]);
        if (m) {
          try { data[key] = rule.proc(m, i); } catch { data[key] = ''; }
          found = true;
          break;
        }
      }
      if (!found) data[key] = '';
    }

    // Nombre: post-check "SEXO:" residual
    if (data['Nombre Completo'] && data['Nombre Completo'].includes('SEXO:')) {
      data['Nombre Completo'] = data['Nombre Completo'].split('SEXO:')[0].trim();
    }

    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POST-PROCESAMIENTO
  // ═══════════════════════════════════════════════════════════════════════════

  _postProcess(data) {
    // Normalizar todos los strings
    for (const key of Object.keys(data)) {
      if (typeof data[key] === 'string') {
        data[key] = data[key].toUpperCase().replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }

    // Re-formatear fechas (pueden haber llegado como strings ya)
    if (data['Fecha Nac'])        data['Fecha Nac']        = this._formatDate(data['Fecha Nac']);
    if (data['Fecha de Atención']) data['Fecha de Atención'] = this._formatDate(data['Fecha de Atención']);

    // ── Limpiar campos que capturaron encabezados en vez de valores reales ──

    // 1. Incluir SVE: si contiene "RESTRICCIONES" o "LABORALES" es encabezado residual
    if (data['Incluir SVE'] && /RESTRICCIONES|LABORALES/.test(data['Incluir SVE'])) {
      data['Incluir SVE'] = 'NINGUNO';
    }

    // 2. Espacios confinados: si contiene "MOTIVO DE" es encabezado residual
    if (data['Concepto de trabajo en espacios confinados'] && /MOTIVO\s+DE/.test(data['Concepto de trabajo en espacios confinados'])) {
      data['Concepto de trabajo en espacios confinados'] = 'NINGUNO';
    }

    // 3. Motivo de Restricción: si contiene firma, nombres o encabezados en vez de motivo real
    if (data['Motivo de Restricción']) {
      const v = data['Motivo de Restricción'];
      // Patrón: nombre + "SALUD OCUPACIONAL" + cédula (firma del médico)
      if (/SALUD\s+OCUPACIONAL/.test(v)) {
        data['Motivo de Restricción'] = 'NINGUNO';
      }
      // Patrón: empieza con encabezados de sección
      else if (/^RESTRICCIONES|^MOTIVO\s+DE|^CONCEPTO\s+MEDICO/i.test(v.trim())) {
        data['Motivo de Restricción'] = 'NINGUNO';
      }
      // Patrón: solo nombres propios en mayúscula (3+ palabras) sin concepto médico válido
      else if (/^[A-ZÁÉÍÓÚÑ\s]{10,}$/.test(v.trim()) && v.trim().split(/\s+/).length >= 3 && !/APTO|NO\s+APTO|CON\s+RESTRICC|SIN\s+RESTRICC|NINGUNO|RECOMIENDA/.test(v)) {
        data['Motivo de Restricción'] = 'NINGUNO';
      }
    }

    // Defaults para campos opcionales
    const defaults = [
      'Concepto Altura', 'Concepto de trabajo en espacios confinados',
      'Motivo de Restricción', 'Incluir SVE', 'Restricciones Laborales',
      'Concepto Manipulación Alimento', 'Recomendaciones Laborales',
      'Concepto Medico',
    ];
    for (const field of defaults) {
      if (!data[field]) data[field] = 'NINGUNO';
    }

    // Defaults para campos críticos ausentes
    if (!data['Nombre Completo'])  data['Nombre Completo']  = 'NO DISPONIBLE';
    if (!data['No. Identificación']) data['No. Identificación'] = '';

    // Metadata
    data['fecha_procesamiento'] = new Date().toISOString().replace('T', ' ').slice(0, 19);

    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERAR DOCUMENTO
  // ═══════════════════════════════════════════════════════════════════════════

  async generateRemision(data, templatePath, outputDir) {
    const PizZip        = require('pizzip');
    const Docxtemplater = require('docxtemplater');
    const fsP           = require('fs').promises;

    const content = await fsP.readFile(templatePath, 'binary');
    const zip     = new PizZip(content);
    
    // Configuración permisiva para manejar tags fragmentados en XML
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
      nullGetter: function() { return ''; },
    });

    doc.setData({
      fecha:                     new Date().toLocaleDateString('es-CO'),
      nombre_destinatario:       data['Nombre Completo']          || 'N/A',
      cc:                        data['No. Identificación']        || 'N/A',
      cargo:                     data['Cargo']                     || 'N/A',
      evaluacion_ocupacional:    data['Evaluación Ocupacional']    || 'N/A',
      recomendaciones_laborales: data['Recomendaciones Laborales'] || 'N/A',
    });
    doc.render();

    const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

    // Guardar en el MISMO directorio donde está la plantilla
    const templateDir = path.dirname(templatePath);
    await fsP.mkdir(templateDir, { recursive: true });
    
    const fecha            = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const nombreSanitizado = (data['Nombre Completo'] || 'sin_nombre').replace(/[<>:"/\\|?*]/g, '_');
    let outputFileName     = `GI-OD-007 REMISION A EPS ${nombreSanitizado} ${fecha}.docx`;
    let outputPath         = path.join(templateDir, outputFileName);
    let counter            = 1;

    while (fs.existsSync(outputPath)) {
      outputFileName = `GI-OD-007 REMISION A EPS ${nombreSanitizado} ${fecha}_${counter}.docx`;
      outputPath     = path.join(templateDir, outputFileName);
      counter++;
    }

    fs.writeFileSync(outputPath, buf);
    return outputPath;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTUALIZAR CONTROL EXCEL
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICAR ARCHIVO BLOQUEADO (Windows EBUSY)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Verifica si un archivo está bloqueado por otro proceso (ej: Excel abierto).
   * @param {string} filePath - Ruta del archivo
   * @returns {Promise<boolean>} - true si está bloqueado
   */
  async isFileLocked(filePath) {
    const fsP = require('fs').promises;
    try {
      const fd = await fsP.open(filePath, 'r+');
      await fd.close();
      return false; // No está bloqueado
    } catch (err) {
      if (err.code === 'EBUSY' || err.code === 'EPERM') {
        return true; // Está bloqueado por otro proceso
      }
      return false; // Otro error, asumimos que no está bloqueado
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTUALIZAR ARCHIVO DE CONTROL (Excel GI-FO-012)
  // ═══════════════════════════════════════════════════════════════════════════

  async updateControlFile(data, controlPath) {
    const expectedColumns = [
      'Item', 'Nombre Completo', 'No. Identificación', 'Fecha Nac', 'Edad', 'Sexo',
      'Afiliación', 'Estado civil', 'Evaluación Ocupacional', 'Fecha de Atención',
      'Cargo', 'Exámenes realizados', 'Recomendaciones Laborales', 'Incluir SVE',
      'Restricciones Laborales', 'Concepto medico laboral', 'Concepto Medico',
      'Concepto Manipulación Alimento', 'Concepto Altura',
      'Concepto de trabajo en espacios confinados', 'Motivo de Restricción',
    ];
    const headerRow = 0; // Encabezados en fila 1 (índice 0), datos desde fila 2
    let workbook, worksheet;

    if (fs.existsSync(controlPath)) {
      workbook  = XLSX.readFile(controlPath);
      worksheet = workbook.Sheets[workbook.SheetNames[0]];
    } else {
      workbook  = XLSX.utils.book_new();
      worksheet = XLSX.utils.aoa_to_sheet([expectedColumns]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Control');
      XLSX.writeFile(workbook, controlPath);
      workbook  = XLSX.readFile(controlPath);
      worksheet = workbook.Sheets[workbook.SheetNames[0]];
    }

    // ── Reintento con backoff para EBUSY ──
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (fs.existsSync(controlPath)) {
          // Verificar si el archivo está bloqueado (ej: Excel abierto)
          const locked = await this.isFileLocked(controlPath);
          if (locked) {
            console.warn(`[RemisionUtils] Archivo bloqueado por otro proceso (intento ${attempt}/${maxRetries}): ${controlPath}`);
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Backoff progresivo
              continue;
            }
            throw new Error('EBUSY: El archivo de control está abierto en Excel. Cierre el archivo y vuelva a intentar.');
          }

          workbook  = XLSX.readFile(controlPath);
          worksheet = workbook.Sheets[workbook.SheetNames[0]];
        } else {
          workbook  = XLSX.utils.book_new();
          worksheet = XLSX.utils.aoa_to_sheet([expectedColumns]);
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Control');
          XLSX.writeFile(workbook, controlPath);
          workbook  = XLSX.readFile(controlPath);
          worksheet = workbook.Sheets[workbook.SheetNames[0]];
        }

        // Éxito al leer — salir del loop de reintentos
        break;

      } catch (err) {
        lastError = err;
        if (err.message && err.message.includes('EBUSY')) {
          console.warn(`[RemisionUtils] EBUSY en intento ${attempt}/${maxRetries}`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
        }
        // Error no-EBUSY o último intento fallido — lanzar
        throw lastError;
      }
    }

    // Leer todos los datos existentes (desde fila 1 = encabezados)
    const allRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    // Construir nueva fila con los datos extraídos
    const newRow = {};
    expectedColumns.forEach(col => { newRow[col] = data[col] || ''; });

    // Calcular siguiente numeración de Item
    const items = allRows.map(r => parseInt(String(r['Item']).replace(/[^\d]/g, ''), 10))
                         .filter(n => !isNaN(n));
    newRow['Item'] = (items.length > 0 ? Math.max(...items) : 0) + 1;

    // Verificar si ya existe un registro con la misma cédula y fecha
    const existIdx = allRows.findIndex(r =>
      String(r['No. Identificación']).trim() === String(data['No. Identificación']).trim() &&
      String(r['Fecha de Atención']).trim()   === String(data['Fecha de Atención']).trim()
    );

    if (existIdx !== -1) {
      // Actualizar fila existente (preservando posición)
      Object.assign(allRows[existIdx], newRow);
      console.log(`[RemisionUtils] Registro actualizado (Item: ${newRow['Item']})`);
    } else {
      // Agregar nueva fila al final
      allRows.push(newRow);
      console.log(`[RemisionUtils] Nueva fila agregada (Item: ${newRow['Item']})`);
    }

    // ── Reconstruir la hoja: encabezados + datos ──
    const newData = [expectedColumns]; // Fila 1: encabezados
    allRows.forEach(rowObj => {
      const row = expectedColumns.map(col => {
        const val = rowObj[col];
        return val !== undefined && val !== null ? String(val) : '';
      });
      newData.push(row);
    });

    // Sobrescribir la hoja con los datos reconstruidos
    const newSheet = XLSX.utils.aoa_to_sheet(newData);
    workbook.Sheets[workbook.SheetNames[0]] = newSheet;
    XLSX.writeFile(workbook, controlPath);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORZAR AFILIACIÓN (como Python: data["Afiliación"] = empresa_seleccionada)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fuerza el campo Afiliación según la empresa seleccionada por el usuario.
   * Corrige casos donde el PDF tiene información del IPS en vez de la empresa.
   */
  forceAfiliacion(data, empresa) {
    if (!empresa) return data;
    data['Afiliación'] = empresa.toUpperCase();
    console.log(`[RemisionUtils] Afiliación forzada a '${empresa}' según selección del usuario.`);
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUSCAR ARCHIVO RECURSIVAMENTE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Busca un archivo recursivamente desde basePath.
   * @param {string} basePath - Directorio base
   * @param {string} fileName - Nombre del archivo a buscar
   * @returns {string|null} Ruta completa o null si no encontrado
   */
  findFileRecursive(basePath, fileName) {
    const fsP = require('fs');
    const pathP = require('path');

    if (!fsP.existsSync(basePath)) return null;

    const entries = fsP.readdirSync(basePath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = pathP.join(basePath, entry.name);
      if (entry.isFile() && entry.name.toUpperCase() === fileName.toUpperCase()) {
        return fullPath;
      }
      if (entry.isDirectory()) {
        const found = this.findFileRecursive(fullPath, fileName);
        if (found) return found;
      }
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERAR DOCUMENTO + ACTUALIZAR CONTROL (API unificada para handler IPC)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Genera documento Word desde plantilla oficial y actualiza Excel de control.
   * @param {Object} data - Datos extraídos del PDF
   * @param {string} templatePath - Ruta de la plantilla .docx
   * @param {string} outputDir - Directorio de salida
   * @param {string|null} controlPath - Ruta del Excel de control (opcional, se busca si es null)
   * @returns {Object} { success, documentPath, controlPath, error }
   */
  async generateRemisionDocument(data, templatePath, outputDir, controlPath) {
    try {
      // 1. Generar documento Word
      const docPath = await this.generateRemision(data, templatePath, outputDir);
      console.log(`[RemisionUtils] Documento generado: ${docPath}`);

      // 2. Actualizar Excel de control (con manejo independiente de errores)
      let ctrlPath = controlPath;
      let controlUpdated = false;
      let controlWarning = null;

      if (!ctrlPath) {
        // Buscar el archivo de control en outputDir o su padre
        const searchDir = outputDir;
        ctrlPath = this.findFileRecursive(searchDir, 'GI-FO-012 CONTROL DE REMISIONES.xlsx');
        if (!ctrlPath) {
          // Buscar en el directorio padre
          const parentDir = require('path').dirname(searchDir);
          ctrlPath = this.findFileRecursive(parentDir, 'GI-FO-012 CONTROL DE REMISIONES.xlsx');
        }
      }

      if (ctrlPath && require('fs').existsSync(ctrlPath)) {
        try {
          await this.updateControlFile(data, ctrlPath);
          controlUpdated = true;
          console.log(`[RemisionUtils] Control actualizado: ${ctrlPath}`);
        } catch (controlError) {
          controlWarning = `Documento generado, pero el archivo de control no se pudo actualizar: ${controlError.message}`;
          console.warn(`[RemisionUtils] ${controlWarning}`);
        }
      } else {
        controlWarning = 'Archivo de control no encontrado. El documento se generó pero no se registró en el control.';
        console.warn(`[RemisionUtils] ${controlWarning}`);
      }

      return {
        success: true,
        documentPath: docPath,
        controlPath: ctrlPath || null,
        controlUpdated: controlUpdated,
        controlWarning: controlWarning
      };
    } catch (error) {
      // Manejo mejorado de errores de docxtemplater
      let errorMessage = error.message;
      
      // Si es un error de template de docxtemplater, extraer información útil
      if (error.name === 'TemplateError' || error.message.includes('Multi error')) {
        console.error('[RemisionUtils] Error de template detectado:');
        console.error('  - Tipo:', error.name || 'Unknown');
        console.error('  - Mensaje:', errorMessage);
        
        // Si hay propiedades de error, mostrarlas
        if (error.properties && error.properties.errors) {
          console.error('  - Errores detallados:');
          error.properties.errors.forEach((err, i) => {
            console.error(`    [${i}] ${err.message} (tag: ${err.properties?.xtag || 'N/A'})`);
          });
        }
        
        errorMessage = `Error en la plantilla: algunos tags pueden estar corruptos. 
        Por favor, abra la plantilla en Word y guárdela como nuevo archivo para reconstruir el XML interno.`;
      }
      
      console.error(`[RemisionUtils] Error en generateRemisionDocument: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  _formatDate(dateStr) {
    if (!dateStr) return '';
    const fmts = [
      { re: /^(\d{2})\/(\d{2})\/(\d{4})$/, fn: m => `${m[3]}/${m[2]}/${m[1]}` },
      { re: /^(\d{4})-(\d{2})-(\d{2})$/,   fn: m => `${m[1]}/${m[2]}/${m[3]}` },
      { re: /^(\d{2})-(\d{2})-(\d{4})$/,   fn: m => `${m[3]}/${m[2]}/${m[1]}` },
      { re: /^(\d{4})\/(\d{2})\/(\d{2})$/,  fn: m => dateStr },
    ];
    for (const { re, fn } of fmts) {
      const m = dateStr.match(re);
      if (m) return fn(m);
    }
    return dateStr;
  }

  _capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
}

module.exports = RemisionUtils;

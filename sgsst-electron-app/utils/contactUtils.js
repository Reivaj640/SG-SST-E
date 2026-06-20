/**
 * @fileoverview contactUtils.js - Utilidades para obtener contacto de trabajadores
 * @description Lee bases de datos Excel por empresa para encontrar teléfono y email
 */

'use strict';

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

// Configuración de bases de datos por empresa
const BASES_DATOS = {
  "TEMPOACTIVA": "G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\2. Temporales Comfa\\Base de Datos Personal Temporales.xlsx",
  "TEMPOSUM": "G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\2. Temporales Comfa\\Base de Datos Personal Temporales.xlsx",
  "ASEPLUS": "G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\2. Temporales Comfa\\Base de Datos Personal Temporales.xlsx",
  "ASEL": "G:/Mi unidad/2. Trabajo/1. SG-SST/19. Asel S.A.S/Formato - Base de datos personal ASEL.xlsx",
  "COOTRACOM": "G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\2. Temporales Comfa\\Base de Datos Personal Temporales.xlsx"
};

// Nombres de hojas por empresa
const SHEET_NAMES = {
  "ASEL": "FORMATO",
  "DEFAULT": "COMPLETO"
};

class ContactFinder {
  /**
   * Obtiene contacto de un trabajador por cédula
   * @param {string} cedula - Número de identificación
   * @param {string} empresa - Nombre de la empresa
   * @returns {Object} { telefono: string|null, email: string|null }
   */
  obtenerContacto(cedula, empresa) {
    try {
      const empresaNormalizada = empresa.toUpperCase();
      const bdPath = BASES_DATOS[empresaNormalizada];

      if (!bdPath || !fs.existsSync(bdPath)) {
        console.warn(`[ContactUtils] Base de datos no encontrada: ${bdPath}`);
        return { telefono: null, email: null };
      }

      // Determinar nombre de hoja
      const sheetName = SHEET_NAMES[empresaNormalizada] || SHEET_NAMES.DEFAULT;

      // Leer Excel
      const workbook = XLSX.readFile(bdPath);
      const sheet = workbook.Sheets[sheetName];
      
      if (!sheet) {
        console.warn(`[ContactUtils] Hoja "${sheetName}" no encontrada en ${bdPath}`);
        return { telefono: null, email: null };
      }

      // Convertir a JSON
      const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      // Buscar columnas relevantes
      if (data.length === 0) {
        console.warn('[ContactUtils] Base de datos vacía');
        return { telefono: null, email: null };
      }

      const headers = Object.keys(data[0]);
      
      const colCedula = headers.find(h => 
        h.toUpperCase().includes('CEDULA') || 
        h.toUpperCase().includes('IDENTIFICACIÓN') ||
        h.toUpperCase().includes('IDENTIFICACION')
      );

      const colCelular = headers.find(h => 
        h.toUpperCase().includes('CELULAR') || 
        h.toUpperCase().includes('TELÉFONO') ||
        h.toUpperCase().includes('TELEFONO') ||
        h.toUpperCase().includes('MÓVIL') ||
        h.toUpperCase().includes('MOVIL')
      );

      const colEmail = headers.find(h => 
        h.toUpperCase().includes('CORREO') || 
        h.toUpperCase().includes('EMAIL') ||
        h.toUpperCase().includes('E-MAIL')
      );

      if (!colCedula || !colCelular) {
        console.error('[ContactUtils] Columnas críticas no encontradas');
        return { telefono: null, email: null };
      }

      // Buscar trabajador por cédula
      const cedulaStr = String(cedula).trim();
      const registro = data.find(row => {
        const valor = String(row[colCedula]).trim();
        return valor === cedulaStr || valor.replace(/[,.]/g, '') === cedulaStr;
      });

      if (!registro) {
        console.warn(`[ContactUtils] Trabajador con cédula ${cedula} no encontrado`);
        return { telefono: null, email: null };
      }

      // Extraer datos
      let telefono = registro[colCelular] ? String(registro[colCelular]).trim() : null;
      let email = colEmail && registro[colEmail] ? String(registro[colEmail]).trim() : null;

      // Limpiar teléfono (quitar caracteres no numéricos)
      if (telefono) {
        telefono = telefono.replace(/[^\d]/g, '');
      }

      console.log(`[ContactUtils] Contacto encontrado -> Tel: ${telefono}, Email: ${email || 'Ninguno'}`);

      return { telefono, email };

    } catch (error) {
      console.error(`[ContactUtils] Error al obtener contacto: ${error.message}`);
      return { telefono: null, email: null };
    }
  }
}

module.exports = ContactFinder;

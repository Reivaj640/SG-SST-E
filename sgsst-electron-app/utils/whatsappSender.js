/**
 * @fileoverview whatsappSender.js - Envío de mensajes por WhatsApp Web
 * @description Abre WhatsApp Web con mensaje preparado y facilita adjuntar archivo
 */

'use strict';

const { shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { clipboard } = require('electron');
const { URLSearchParams } = require('url');

class WhatsAppSender {
  /**
   * Prepara y envía mensaje por WhatsApp Web
   * @param {Object} options
   * @param {string} options.phoneNumber - Número de teléfono con código de país
   * @param {string} options.message - Mensaje a enviar
   * @param {string} [options.filePath] - Ruta del archivo a adjuntar (opcional)
   * @returns {Object} { success: boolean, url: string, error?: string }
   */
  sendMessage({ phoneNumber, message, filePath }) {
    try {
      // Validar teléfono
      if (!phoneNumber) {
        throw new Error('Número de teléfono no proporcionado');
      }

      // Limpiar número (quitar espacios, guiones, paréntesis)
      const cleanPhone = phoneNumber.replace(/[^\d]/g, '');

      // Copiar mensaje al portapapeles
      clipboard.writeText(message);
      console.log('[WhatsAppSender] Mensaje copiado al portapapeles');

      // Codificar mensaje para URL
      const encodedMessage = encodeURIComponent(message);
      
      // Construir URL de WhatsApp Web
      const url = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;

      // Abrir WhatsApp Web en navegador por defecto
      shell.openExternal(url);
      console.log(`[WhatsAppSender] Abriendo WhatsApp Web para ${cleanPhone}`);

      // Si hay archivo, abrir carpeta contenedora para facilitar adjuntar
      if (filePath && fs.existsSync(filePath)) {
        const folderPath = path.dirname(filePath);
        shell.openPath(folderPath);
        console.log(`[WhatsAppSender] Abriendo carpeta: ${folderPath}`);
      }

      return {
        success: true,
        url: url,
        message: 'WhatsApp Web abierto con mensaje preparado'
      };

    } catch (error) {
      console.error(`[WhatsAppSender] Error al enviar WhatsApp: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Construye mensaje de remisión para WhatsApp
   * @param {Object} data - Datos de la remisión
   * @returns {string} Mensaje formateado
   */
  buildRemisionMessage(data) {
    const nombre = data['Nombre Completo'] || 'N/A';
    const cedula = data['No. Identificación'] || 'N/A';
    const cargo = data['Cargo'] || 'N/A';
    const fecha = data['Fecha de Atención'] || 'N/A';
    const evaluacion = data['Evaluación Ocupacional'] || 'N/A';

    return `*REMISIÓN MÉDICA - SST*

Estimado/a ${nombre},

Se ha generado su remisión médica con la siguiente información:

📋 *Datos del Trabajador:*
• Nombre: ${nombre}
• C.C.: ${cedula}
• Cargo: ${cargo}
• Fecha: ${fecha}

🏥 *Evaluación:*
${evaluacion}

📎 *Documento adjunto:* 
Por favor adjunta el archivo .docx generado.

✅ Confirmar recepción del documento.

---
_Este mensaje es generado automáticamente por el sistema SG-SST_`;
  }
}

module.exports = WhatsAppSender;

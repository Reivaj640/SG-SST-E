/**
 * @fileoverview emailSender.js - Envío de correos electrónicos con plantillas
 * @description Envía remisiones médicas por correo SMTP con plantillas personalizadas
 */

'use strict';

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class EmailSender {
  // Plantillas de email por empresa
  static PLANTILLAS = {
    "TEMPOACTIVA": {
      asunto: "Seguimiento a Recomendaciones Médicas Laborales",
      cuerpo: `Estimado/a {nombre},

Conforme al resultado del examen médico ocupacional realizado el día {fecha}, te compartimos la carta de remisiones médicas, en la cual se detallan recomendaciones específicas relacionadas con tu estado de salud y tu actividad laboral.

📎 Adjunto encontrarás el documento oficial con las recomendaciones.

Te solicitamos por favor:

✅ Leer atentamente las recomendaciones.
✅ Confirmar la recepción de este mensaje y del documento.
✅ Informarnos si ya estás realizando los controles médicos indicados (si aplica).

Estas recomendaciones serán tenidas en cuenta por el área de Seguridad y Salud en el Trabajo para realizar el seguimiento correspondiente y tomar las acciones necesarias en el marco del Sistema de Gestión SST, tal como lo establece la Resolución 0312 de 2019 y el Decreto 1072 de 2015.

Tu salud es una prioridad para nosotros, y el cumplimiento de estas recomendaciones ayuda a prevenir posibles afectaciones laborales.

Si tienes alguna duda, estamos atentos para aclararla.

Saludos cordiales,

Atentamente,
Equipo {empresa}
Correo: {remitente}`
    },
    "TEMPOSUM": {
      asunto: "Seguimiento a Recomendaciones Médicas Laborales",
      cuerpo: `Estimado/a {nombre},

Conforme al resultado del examen médico ocupacional realizado el día {fecha}, te compartimos la carta de remisiones médicas, en la cual se detallan recomendaciones específicas relacionadas con tu estado de salud y tu actividad laboral.

📎 Adjunto encontrarás el documento oficial con las recomendaciones.

Te solicitamos por favor:

✅ Leer atentamente las recomendaciones.
✅ Confirmar la recepción de este mensaje y del documento.
✅ Informarnos si ya estás realizando los controles médicos indicados (si aplica).

Estas recomendaciones serán tenidas en cuenta por el área de Seguridad y Salud en el Trabajo para realizar el seguimiento correspondiente y tomar las acciones necesarias en el marco del Sistema de Gestión SST, tal como lo establece la Resolución 0312 de 2019 y el Decreto 1072 de 2015.

Tu salud es una prioridad para nosotros, y el cumplimiento de estas recomendaciones ayuda a prevenir posibles afectaciones laborales.

Si tienes alguna duda, estamos atentos para aclararla.

Saludos cordiales,

Atentamente,
Equipo {empresa}
Correo: {remitente}`
    },
    "ASEPLUS": {
      asunto: "Seguimiento a Recomendaciones Médicas Laborales",
      cuerpo: `Estimado/a {nombre},

Conforme al resultado del examen médico ocupacional realizado el día {fecha}, te compartimos la carta de remisiones médicas, en la cual se detallan recomendaciones específicas relacionadas con tu estado de salud y tu actividad laboral.

📎 Adjunto encontrarás el documento oficial con las recomendaciones.

Te solicitamos por favor:

✅ Leer atentamente las recomendaciones.
✅ Confirmar la recepción de este mensaje y del documento.
✅ Informarnos si ya estás realizando los controles médicos indicados (si aplica).

Estas recomendaciones serán tenidas en cuenta por el área de Seguridad y Salud en el Trabajo para realizar el seguimiento correspondiente y tomar las acciones necesarias en el marco del Sistema de Gestión SST, tal como lo establece la Resolución 0312 de 2019 y el Decreto 1072 de 2015.

Tu salud es una prioridad para nosotros, y el cumplimiento de estas recomendaciones ayuda a prevenir posibles afectaciones laborales.

Si tienes alguna duda, estamos atentos para aclararla.

Saludos cordiales,

Atentamente,
Equipo {empresa}
Correo: {remitente}`
    },
    "ASEL": {
      asunto: "Seguimiento a Recomendaciones Médicas Laborales",
      cuerpo: `Estimado/a {nombre},

Conforme al resultado del examen médico ocupacional realizado el día {fecha}, te compartimos la carta de remisiones médicas, en la cual se detallan recomendaciones específicas relacionadas con tu estado de salud y tu actividad laboral.

📎 Adjunto encontrarás el documento oficial con las recomendaciones.

Te solicitamos por favor:

✅ Leer atentamente las recomendaciones.
✅ Confirmar la recepción de este mensaje y del documento.
✅ Informarnos si ya estás realizando los controles médicos indicados (si aplica).

Estas recomendaciones serán tenidas en cuenta por el área de Seguridad y Salud en el Trabajo para realizar el seguimiento correspondiente y tomar las acciones necesarias en el marco del Sistema de Gestión SST, tal como lo establece la Resolución 0312 de 2019 y el Decreto 1072 de 2015.

Tu salud es una prioridad para nosotros, y el cumplimiento de estas recomendaciones ayuda a prevenir posibles afectaciones laborales.

Si tienes alguna duda, estamos atentos para aclararla.

Saludos cordiales,

Atentamente,
Equipo {empresa}
Correo: {remitente}`
    },
    "COOTRACOM": {
      asunto: "Seguimiento a Recomendaciones Médicas Laborales",
      cuerpo: `Estimado/a {nombre},

Conforme al resultado del examen médico ocupacional realizado el día {fecha}, te compartimos la carta de remisiones médicas, en la cual se detallan recomendaciones específicas relacionadas con tu estado de salud y tu actividad laboral.

📎 Adjunto encontrarás el documento oficial con las recomendaciones.

Te solicitamos por favor:

✅ Leer atentamente las recomendaciones.
✅ Confirmar la recepción de este mensaje y del documento.
✅ Informarnos si ya estás realizando los controles médicos indicados (si aplica).

Estas recomendaciones serán tenidas en cuenta por el área de Seguridad y Salud en el Trabajo para realizar el seguimiento correspondiente y tomar las acciones necesarias en el marco del Sistema de Gestión SST, tal como lo establece la Resolución 0312 de 2019 y el Decreto 1072 de 2015.

Tu salud es una prioridad para nosotros, y el cumplimiento de estas recomendaciones ayuda a prevenir posibles afectaciones laborales.

Si tienes alguna duda, estamos atentos para aclararla.

Saludos cordiales,

Atentamente,
Equipo {empresa}
Correo: {remitente}`
    }
  };

  // Credenciales de correo por empresa
  static CREDENCIALES = {
    "TEMPOACTIVA": { email: "tempoactivaestsas@gmail.com", password: "pxfu wxit wpjf svxd" },
    "TEMPOSUM": { email: "temposumestsas@gmail.com", password: "bcfw rzxh ksob ddns" },
    "ASEPLUS": { email: "asepluscaribesas@gmail.com", password: "yudh myrl zjpk eoej" },
    "ASEL": { email: "asel.contratacion@gmail.com", password: "kdyh degt juwf tuqd" },
    "COOTRACOM": { email: "tempoactivaestsas@gmail.com", password: "pxfu wxit wpjf svxd" }
  };

  /**
   * Inicializa el enviador de correos para una empresa específica
   * @param {string} empresa - Nombre de la empresa
   */
  constructor(empresa) {
    this.empresa = empresa.toUpperCase();
    this.credenciales = EmailSender.CREDENCIALES[this.empresa];
    this.plantilla = EmailSender.PLANTILLAS[this.empresa] || EmailSender.PLANTILLAS["TEMPOACTIVA"];

    if (!this.credenciales) {
      throw new Error(`No hay credenciales configuradas para ${this.empresa}`);
    }

    this.transporter = null;
  }

  /**
   * Crea el transporter SMTP para Gmail
   * @returns {object} Transporter de nodemailer
   */
  getTransporter() {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: this.credenciales.email,
          pass: this.credenciales.password
        }
      });
    }
    return this.transporter;
  }

  /**
   * Envía un correo electrónico con documento adjunto
   * @param {Object} options
   * @param {string} options.destinatario - Correo del destinatario
   * @param {string} options.nombre - Nombre del trabajador
   * @param {string} options.fechaAtencion - Fecha de atención
   * @param {string} options.archivoAdjunto - Ruta del archivo a adjuntar
   * @returns {Object} { success: boolean, message?: string, error?: string }
   */
  async enviarCorreo({ destinatario, nombre, fechaAtencion, archivoAdjunto }) {
    try {
      // Validar parámetros
      if (!destinatario || !nombre || !fechaAtencion || !archivoAdjunto) {
        throw new Error('Faltan parámetros requeridos para enviar el correo');
      }

      if (!fs.existsSync(archivoAdjunto)) {
        throw new Error(`Archivo adjunto no encontrado: ${archivoAdjunto}`);
      }

      // Construir mensaje personalizado
      const asunto = this.plantilla.asunto;
      const cuerpo = this.plantilla.cuerpo
        .replace('{nombre}', nombre)
        .replace('{fecha}', fechaAtencion)
        .replace('{empresa}', this.empresa)
        .replace('{remitente}', this.credenciales.email);

      // Configurar mensaje
      const mailOptions = {
        from: `"${this.empresa}" <${this.credenciales.email}>`,
        to: destinatario,
        subject: asunto,
        text: cuerpo,
        attachments: [
          {
            filename: path.basename(archivoAdjunto),
            path: archivoAdjunto
          }
        ]
      };

      // Enviar correo
      const transporter = this.getTransporter();
      const info = await transporter.sendMail(mailOptions);

      console.log(`[EmailSender] Correo enviado exitosamente a ${destinatario}. Message ID: ${info.messageId}`);

      return {
        success: true,
        message: 'Correo enviado exitosamente',
        messageId: info.messageId
      };

    } catch (error) {
      console.error(`[EmailSender] Error al enviar correo: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = EmailSender;

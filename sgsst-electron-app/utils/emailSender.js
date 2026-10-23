/**
 * @fileoverview emailSender.js - Envío de correos electrónicos con plantillas
 * @description Envía remisiones médicas por correo SMTP con plantillas personalizadas
 */

'use strict';

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const envLoader = require('../shared/env-loader');

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

  // Cuentas de correo por empresa.
  //
  // 📦931 — SOLO la direccion de correo, que no es un secreto: es un
  // identificador que ya estaba en el repo y en los correos que salen. La
  // CONTRASENA no vive mas en el codigo: se lee del entorno (`.env` de la
  // maquina que compila, o variable de entorno del sistema) en cada envio.
  //
  // Por que la contrasena no puede seguir aca: este repo es PUBLICO y estas
  // app passwords de Gmail quedaron en el historial de git. Sacarlas del
  // codigo NO las invalida (eso es rotarlas, en Google Account), pero si
  // evita que sigan por ahi para siempre y que se puedan cambiar sin tocar
  // codigo.
  //
  // `variable` es el nombre de la variable de entorno que guarda la contrasena.
  // La contrasena de Gmail es "xxxx xxxx xxxx xxxx": SIEMPRE entre comillas en
  // el `.env`, porque el parser no hace trim interno.
  static CUENTAS = {
    "TEMPOACTIVA": { email: "tempoactivaestsas@gmail.com", variable: "KAIR_EMAIL_TEMPOACTIVA_PASSWORD" },
    "TEMPOSUM": { email: "temposumestsas@gmail.com", variable: "KAIR_EMAIL_TEMPOSUM_PASSWORD" },
    "ASEPLUS": { email: "asepluscaribesas@gmail.com", variable: "KAIR_EMAIL_ASEPLUS_PASSWORD" },
    "ASEL": { email: "asel.contratacion@gmail.com", variable: "KAIR_EMAIL_ASEL_PASSWORD" },
    "COOTRACOM": { email: "tempoactivaestsas@gmail.com", variable: "KAIR_EMAIL_COOTRACOM_PASSWORD" }
  };

  /**
   * Inicializa el enviador de correos para una empresa específica
   * @param {string} empresa - Nombre de la empresa
   */
  constructor(empresa) {
    this.empresa = empresa.toUpperCase();
    const cuenta = EmailSender.CUENTAS[this.empresa];
    this.plantilla = EmailSender.PLANTILLAS[this.empresa] || EmailSender.PLANTILLAS["TEMPOACTIVA"];

    this.transporter = null;

    if (!cuenta) {
      throw new Error(`No hay credenciales configuradas para ${this.empresa}`);
    }

    // La contrasena se resuelve en CADA construccion: la app crea un
    // EmailSender por envio, asi que una contrasena rotada aplica al
    // siguiente envio sin reiniciar la app.
    const password = envLoader.resolverVariables([cuenta.variable])[cuenta.variable] || '';
    if (!password) {
      // El mensaje de este error LLEGA AL USUARIO FINAL (el renderer lo
      // muestra), asi que no puede mencionar `.env` ni nombres de variable.
      // El detalle tecnico va en `detalle`, que el main escribe al log.
      const error = new Error(
        'El envio por correo no esta disponible en esta instalacion. Contacte al administrador de K+AIR.'
      );
      error.detalle = `falta la credencial de correo de ${this.empresa} (${cuenta.variable})`;
      throw error;
    }

    this.credenciales = { email: cuenta.email, password };
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

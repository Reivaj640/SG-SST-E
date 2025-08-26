# -*- coding: utf-8 -*-
"""
Sistema Integrado de Gestión de Remisiones EPS - Módulo de Utilidades
Módulo optimizado de procesamiento de PDFs y generación de remisiones
"""

import os
import re
import json
import logging
import traceback
import unicodedata
from pathlib import Path
from datetime import datetime
import pdfplumber
import pandas as pd
from docxtpl import DocxTemplate
import warnings
import smtplib
import webbrowser
import pyperclip
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from email.header import Header
from email.utils import formataddr
from urllib.parse import quote
import sys

warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")

# Configuración de logging centralizada.
# Los logs se enviarán a stderr por defecto, y el resultado JSON a stdout.
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', stream=sys.stderr)

def log(message, level='INFO'):
    """Función de logging para enviar mensajes al logger configurado."""
    level = level.upper()
    if level == 'DEBUG':
        logging.debug(message)
    elif level == 'INFO':
        logging.info(message)
    elif level == 'WARNING':
        logging.warning(message)
    elif level == 'ERROR':
        logging.error(message)
    else:
        logging.info(message)

class Config:
    # Columnas para el archivo de control
    COLUMNAS_CONTROL = [
        "Item", "Nombre Completo", "No. Identificación", "Fecha Nac", "Edad", "Sexo",
        "Afiliación", "Estado civil", "Evaluación Ocupacional", "Fecha de Atención",
        "Cargo", "Exámenes realizados", "Recomendaciones Laborales", "Incluir SVE",
        "Restricciones Laborales", "Concepto medico laboral", "Concepto Medico",
        "Concepto Manipulación Alimento", "Concepto Altura",
        "Concepto de trabajo en espacios confinados", "Motivo de Restricción"
    ]
    
    # Plantillas de email por tipo de empresa
    PLANTILLAS = {
        "TEMPOACTIVA": {
            "asunto": "Seguimiento a Recomendaciones Médicas Laborales",
            "cuerpo": """Estimado/a {nombre},
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
Correo: {remitente}"""
        },
        "TEMPOSUM": {
            "asunto": "Seguimiento a Recomendaciones Médicas Laborales",
            "cuerpo": """Estimado/a {nombre},
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
Correo: {remitente}"""
        },
        "ASEPLUS": {
            "asunto": "Seguimiento a Recomendaciones Médicas Laborales",
            "cuerpo": """Estimado/a {nombre},
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
Correo: {remitente}"""
        },
        "ASEL": {
            "asunto": "Seguimiento a Recomendaciones Médicas Laborales",
            "cuerpo": """Estimado/a {nombre},
Conforme al resultado del examen médico ocupacional realizado el día {fecha}, te compartimos la carta de remisiones médicas, en la cual se detallan recomendaciones específicas relacionadas con tu estado de salud y tu actividad laboral.

📎 Adjunto encontrarás el documento oficial con las recomendaciones.

Te solicitamos por favor:

✅ Leer atentamente las recomendaciones.  
✅ Confirmar la recepción de este mensaje y del documento.  
✅ Informarnos si ya estás realizando los controles médicos indicados (si aplica).  

Estas recomendaciones serán tenidas en cuenta por el área de Seguridad y Salud en el Trabajo para realizar el seguimiento correspondiente y tomar las acciones necesarias en el marco del Sistema de Gestión SST, tal como lo establece la Resolución 0312 de 2019 y el Decreto 1072 de 2015.

Tu salud es una prioridad para nosotros, y el cumplimiento de estas recomendaciones ayuda a prevenir posibles afectaciones laborales.

Si tienes alguna duda, estamos atentos para aclararla.

Atentamente,
Equipo ASEL
Correo: {remitente}"""
        },
        "DEFAULT": {
            "asunto": "Documento de Remisión EPS",
            "cuerpo": """Estimado/a {nombre},
Adjunto encontrarás tu documento de remisión EPS.
Atentamente,
Equipo {empresa}
Correo: {remitente}"""
        }
    }

    # Rutas a las bases de datos de personal
    BASES_DATOS = {
        "TEMPOACTIVA": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/Base de Datos Personal Temporales.xlsx",
        "TEMPOSUM": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/Base de Datos Personal Temporales.xlsx",
        "ASEPLUS": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/Base de Datos Personal Temporales.xlsx",
        "ASEL": "G:/Mi unidad/2. Trabajo/1. SG-SST/19. Asel S.A.S/Formato - Base de datos personal ASEL.xlsx"
    }

    # Credenciales de correo por empresa
    CREDENCIALES = {
        "TEMPOACTIVA": {"email": "tempoactivaestsas@gmail.com", "password": "pxfu wxit wpjf svxd"},
        "TEMPOSUM": {"email": "temposumestsas@gmail.com", "password": "bcfw rzxh ksob ddns"},
        "ASEPLUS": {"email": "asepluscaribesas@gmail.com", "password": "yudh myrl zjpk eoej"},
        "ASEL": {"email": "asel.contratacion@gmail.com", "password": "kdyh degt juwf tuqd"}
    }
    
    # Rutas por empresa para plantillas, remisiones y control
    RUTAS = {
        "TEMPOACTIVA": {
            "base": Path("G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud"),
            "plantilla": Path("G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS/GI-OD-007 REMISION A EPS.docx"),
            "remisiones": Path("G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS"),
            "control": Path("G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS/GI-FO-012 CONTROL DE REMISIONES.xlsx")
        },
        "TEMPOSUM": {
            "base": Path("G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/2. Temposum Est SAS/3. Gestión de la Salud"),
            "plantilla": Path("G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/2. Temposum Est SAS/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS/GI-OD-007 REMISION A EPS.docx"),
            "remisiones": Path("G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/2. Temposum Est SAS/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS"),
            "control": Path("G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/2. Temposum Est SAS/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS/GI-FO-012 CONTROL DE REMISIONES.xlsx")
        },
        "ASEPLUS": {
            "base": Path("G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/3. Aseplus/3. Gestión de la Salud"),
            "plantilla": Path("G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/3. Aseplus/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS/GI-OD-007 REMISION A EPS.docx"),
            "remisiones": Path("G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/3. Aseplus/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS"),
            "control": Path("G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/3. Aseplus/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS/GI-FO-012 CONTROL DE REMISIONES.xlsx")
        },
        "ASEL": {
            "base": Path("G:/Mi unidad/2. Trabajo/1. SG-SST/19. Asel S.A.S/3. Gestión de la Salud"),
            "remisiones": Path("G:/Mi unidad/2. Trabajo/1. SG-SST/19. Asel S.A.S/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS"),
            "plantilla": Path("G:/Mi unidad/2. Trabajo/1. SG-SST/19. Asel S.A.S/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS/GI-OD-007 REMISION A EPS.docx"),
            "control": Path("G:/Mi unidad/2. Trabajo/1. SG-SST/19. Asel S.A.S/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS/GI-FO-012 CONTROL DE REMISIONES.xlsx")
        }
    }

    @classmethod
    def get_empresa_paths(cls, afiliacion):
        """Obtiene las rutas para una empresa específica de forma más flexible."""
        afiliacion_normalizada = afiliacion.strip().upper()
        
        mapeo_afiliaciones = {
            "TEMPOACTIVA": "TEMPOACTIVA",
            "TEMPOSUM": "TEMPOSUM",
            "ASEPLUS": "ASEPLUS",
            "ASEL": "ASEL"
        }
        
        for clave, empresa in mapeo_afiliaciones.items():
            if clave in afiliacion_normalizada:
                log(f"Afiliación '{afiliacion}' mapeada a la empresa '{empresa}'")
                return cls.RUTAS.get(empresa, cls.RUTAS["TEMPOACTIVA"])
        
        log(f"No se encontró empresa para afiliación '{afiliacion}', usando TEMPOACTIVA por defecto", level='WARNING')
        return cls.RUTAS["TEMPOACTIVA"]

class WhatsAppSender:
    def send_message(self, phone_number, message, file_path=None):
        try:
            pyperclip.copy(message)
            log("Mensaje copiado al portapapeles.")

            encoded_message = quote(message)
            url = f"https://api.whatsapp.com/send?phone={phone_number}&text={encoded_message}"
            
            webbrowser.open(url)

            if file_path and Path(file_path).exists():
                os.startfile(file_path)
                folder_path = os.path.dirname(file_path)
                os.startfile(folder_path)

            log(f"Mensaje de WhatsApp enviado a y carpeta de archivo abierto para {phone_number}")
        except Exception as e:
            log(f"Error al enviar WhatsApp: {str(e)}", level='ERROR')
            raise

class EmailSender:
    def __init__(self, empresa):
        self.empresa = empresa.upper()
        self.credenciales = Config.CREDENCIALES.get(self.empresa)
        self.plantilla = Config.PLANTILLAS.get(self.empresa, Config.PLANTILLAS["DEFAULT"])
        self.base_datos = Config.BASES_DATOS.get(self.empresa)
        
        if not self.credenciales:
            raise ValueError(f"No hay credenciales configuradas para {self.empresa}")

    def obtener_contacto(self, cedula):
        try:
            if not self.base_datos or not Path(self.base_datos).exists():
                log(f"Base de datos no encontrada: {self.base_datos}", level='WARNING')
                return None, None
                
            df = pd.read_excel(
                self.base_datos,
                sheet_name="FORMATO" if self.empresa == "ASEL" else "COMPLETO",
                dtype=str
            )
            
            col_cedula = next((col for col in df.columns if 'CEDULA' in col.upper() or 'IDENTIFICACIÓN' in col.upper()), None)
            col_celular = next((col for col in df.columns if 'CELULAR' in col.upper() or 'TELÉFONO' in col.upper()), None)
            col_email = next((col for col in df.columns if 'CORREO' in col.upper() or 'EMAIL' in col.upper()), None)
            
            if not col_cedula or not col_celular:
                log("Columnas críticas no encontradas en la base de datos", level='ERROR')
                return None, None
                
            registro = df[df[col_cedula].astype(str).str.strip() == str(cedula).strip()]
            
            if not registro.empty:
                telefono = registro.iloc[0][col_celular]
                email = registro.iloc[0][col_email] if col_email else None
                return telefono, email
                
            return None, None
        except Exception as e:
            log(f"Error al obtener contacto: {str(e)}", level='ERROR')
            return None, None

    def enviar_correo(self, destinatario, nombre, fecha_atencion, archivo_adjunto):
        try:
            if not all([destinatario, nombre, archivo_adjunto]):
                raise ValueError("Faltan parámetros requeridos (destinatario, nombre o adjunto) para enviar el correo")
                
            if not Path(archivo_adjunto).exists():
                raise FileNotFoundError(f"Archivo adjunto no encontrado: {archivo_adjunto}")

            asunto = self.plantilla["asunto"]
            cuerpo = self.plantilla["cuerpo"].format(
                nombre=nombre,
                fecha=fecha_atencion or 'N/A',
                empresa=self.empresa,
                remitente=self.credenciales["email"]
            )

            msg = MIMEMultipart()
            encoded_empresa = Header(self.empresa, 'utf-8').encode()
            email_address = self.credenciales["email"].encode('ascii', errors='ignore').decode('ascii')
            msg['From'] = formataddr((encoded_empresa, email_address))
            msg['To'] = destinatario
            msg['Subject'] = Header(asunto, 'utf-8').encode()
            msg.attach(MIMEText(cuerpo, 'plain', 'utf-8'))

            with open(archivo_adjunto, "rb") as adjunto:
                parte = MIMEBase('application', 'octet-stream')
                parte.set_payload(adjunto.read())
                encoders.encode_base64(parte)
                nombre_archivo = os.path.basename(archivo_adjunto)
                parte.add_header('Content-Disposition', f'attachment; filename= {nombre_archivo}')
                msg.attach(parte)

            servidor = smtplib.SMTP('smtp.gmail.com', 587)
            servidor.starttls()
            servidor.login(self.credenciales["email"], self.credenciales["password"])
            texto = msg.as_string()
            servidor.sendmail(self.credenciales["email"], destinatario, texto)
            servidor.quit()

            log(f"Correo enviado exitosamente a {destinatario}")
            return True

        except Exception as e:
            log(f"Error al enviar correo: {str(e)}", level='ERROR')
            return False

class PdfProcessor:
    def extract_pdf_data(self, pdf_path):
        try:
            pdf_path = Path(pdf_path)
            if not pdf_path.exists():
                raise FileNotFoundError(f"El archivo PDF no existe: {pdf_path}")

            with pdfplumber.open(pdf_path) as pdf:
                text = ""
                for page in pdf.pages:
                    page_text = page.extract_text() or ""
                    text += page_text + "\n"
            text = unicodedata.normalize('NFC', text)

            data = self._extract_formato_generico(text)
            data = self._post_process_data(data)
            self._validate_critical_data(data, pdf_path.name)

            for campo in ['No. Identificacion', 'Nombre_Completo', 'Concepto Altura', 'Concepto de trabajo en espacios confinados','Motivo de Restricción', 'Incluir SVE', 'Restricciones Laborales', 'Concepto Manipulación Alimento']:
                if not data.get(campo):
                    data[campo] = "NINGUNO"

            data['archivo_origen'] = str(pdf_path)
            data['fecha_procesamiento'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            return data
        except Exception as e:
            log(f"Error en extract_pdf_data para {pdf_path}: {str(e)}", level='ERROR')
            raise ValueError(f"Errores en la extracción de datos en {pdf_path.name}: {str(e)}")

    def _extract_formato_generico(self, text):
        extraction_rules = {
            'Nombre Completo': {'pattern': r'(?:Nombre\s*Completo|Paciente|Nombre)[:\s]*(.*?)(?:\n|SEXO:|DOCUMENTO|IDENTIFICACI[ÓO]N|$)', 'processor': lambda x: x.strip().upper() if x else ""},
            'No. Identificacion': {'pattern': r'(?:Documento[:\s]*CC[:\s]*(\d+))|(?:(?:No\.|N[úu]mero)\s*(?:de)?\s*Identificaci[óo]n[:\s]*(?:CC\s*-\s*)?(\d{7,12}))|(?:(?:CC|TI|CE)[:\s-]*(\d{7,12}))|(?:(?:c[ée]dula|documento|identificaci[óo]n)[:\s]*(\d{7,12}))', 'processor': lambda x: re.sub(r'[^\d]', '', x.strip()) if x else ""},
            'Fecha Nac': {'pattern': r'Fecha\s*(?:de)?\s*Nac(?:imiento)?[:\s]*([\d/-]+)', 'processor': lambda x: self._format_date(x.strip()) if x else ""},
            'Edad': {'pattern': r'Edad[:\s]*(\d+)', 'processor': lambda x: int(x.strip()) if x and x.strip().isdigit() else ""},
            'Sexo': {'pattern': r'(?:Sexo|G[ée]nero)[:\s]*([A-Za-zÁ-Úá-ú]+)', 'processor': lambda x: x.strip().capitalize() if x else ""},
            'Afiliación': {'pattern': r'(?:Afiliaci[óo]n|Empresa)[:\s]*(.*?)(?:\n|$)', 'processor': lambda x: self._process_afiliacion(x.strip()) if x else ""},
            'Estado civil': {'pattern': r'Estado\s*civil[:\s]*(.*?)(?:\n|$)', 'processor': lambda x: x.strip().capitalize() if x else ""},
            'Evaluación Ocupacional': {'pattern': r'(?:TIPO\s*DE\s*EVALUACI[ÓO]N\s*REALIZADA|Tipo\s*de\s*Examen|Evaluaci[óo]n\s*Ocupacional)[:\s]*([^:\n]+?)(?=\s*Fecha\s*de\s*atenci[óo]n:|$)', 'processor': lambda x: x.strip().upper() if x else ""},
            'Fecha de Atención': {'pattern': r'Fecha\s*(?:de)?\s*atenc[\w\s]*[:\s]*([\d]{1,2}[\-/][\d]{1,2}[\-/][\d]{2,4})','processor': lambda x: self._format_date(x.strip()) if x else ""},
            'Cargo': {'pattern': r'Cargo[:\s]*([^:\n]+?)(?=\s*Fecha\s*de|$)', 'processor': self._process_cargo},
            'Exámenes realizados': {'pattern': r'EX[ÁA]MENES\s*REALIZADOS[:\s]*(.*?)(?=\s*(?:RECOMENDACIONES|INCLUIR|RESTRICCIONES|MANEJO|$))', 'processor': lambda x: x.strip().replace('\n', ' ').strip().upper() if x else ""},
            'Recomendaciones Laborales': {'pattern': r'RECOMENDACIONES\s*LABORALES[:\s]*(.*?)(?=MANEJO\s*EPS/ARL|\Z)', 'processor': lambda x: x.strip().upper() if x else "NINGUNO"},
            'Incluir SVE': {'pattern': r'Incluir\s*SVE[:\s]*([^\n:]+?)(?=\s*(?:RESTRICCIONES|Concepto|$))', 'processor': lambda x: x.strip().upper() if x and not x.strip().startswith('RESTRICCIONES') else "NINGUNO"},
            'Restricciones Laborales': {'pattern': r'RESTRICCIONES\s*LABORALES[:\s]*(.*?)(?=\s*(?:Para\s*la\s*revisi[óo]n|INCLUIR|CONCEPTO|[A-ZÁ-Ú]+:|$))', 'processor': lambda x: x.strip().upper() if x else "NINGUNO"},
            'Concepto Medico': {'pattern': r'Concepto\s*Medico[:\s]*((?!LEVANTAMIENTO)[^:\n]+)', 'processor': lambda x: x.strip().upper() if x else "NINGUNO"},
            'Concepto Manipulación Alimento': {'pattern': r'Concepto\s*(?:Manipulaci[óo]n)?\s*Alimento[:\s]*(.*?)(?:\n|$)', 'processor': lambda x: x.strip().upper() if x else "NINGUNO"},
            'Concepto Altura': {'pattern': r'Concepto\s*Altura[:\s]*(.*?)(?:\n|$)', 'processor': lambda x: x.strip().upper() if x else "NINGUNO"},
            'Concepto de trabajo en espacios confinados': {'pattern': r'Concepto\s*de\s*trabajo\s*en\s*espacios\s*confinados[:\s]*([^:\n]+?)(?=\s*(?:MOTIVO|$))', 'processor': lambda x: x.strip().upper() if x and not x.strip().startswith('MOTIVO') else "NINGUNO"},
            'Motivo de Restricción': {'pattern': r'MOTIVO\s*DE\s*RESTRICCI[OÓ]N[:\s]*(.*?)(?:\nFIRMA|\Z)', 'processor': lambda x: x.strip().upper() if x else "NINGUNO"},
        }

        data = {}
        for key, rule in extraction_rules.items():
            match = re.search(rule['pattern'], text, re.IGNORECASE | re.DOTALL)
            if match:
                value = next((g for g in match.groups() if g is not None), "")
                data[key] = rule['processor'](value)
            else:
                data[key] = ""
                log(f"No se encontró el campo '{key}' usando regex genérico", level='WARNING')

        return data

    def _post_process_data(self, data):
        if data.get('Nombre Completo') and 'SEXO:' in data['Nombre Completo'].upper():
            data['Nombre Completo'] = data['Nombre Completo'].split('SEXO:')[0].strip()
        return data

    def _validate_critical_data(self, data, filename):
        required_fields = {
            'No. Identificacion': "No Identificacion no encontrado",
            'Fecha de Atención': "Fecha de Atención no encontrada"
        }
        errors = []
        for field, message in required_fields.items():
            if not data.get(field):
                errors.append(message)
        if errors:
            raise ValueError(", ".join(errors))

    def _format_date(self, date_str):
        if not date_str: return ""
        date_formats = ['%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%Y/%m/%d']
        for fmt in date_formats:
            try:
                return datetime.strptime(date_str, fmt).strftime('%Y/%m/%d')
            except ValueError:
                continue
        return date_str

    def _process_afiliacion(self, value):
        return value.strip().upper() if value else ""

    def _process_cargo(self, value):
        return value.strip().upper() if value else ""

class ExcelHandler:
    def update_control_file(self, data, control_path):
        try:
            control_path = Path(control_path)
            logging.info(f"Actualizando archivo de control: {control_path}")

            # 🔹 Normalizar claves antes de validar - CORRECCIÓN
            # Mapear todas las variantes posibles de claves
            key_mapping = {
                'No. Identificacion': 'No. Identificación',
                'No Identificacion': 'No. Identificación', 
                'No_Identificacion': 'No. Identificación',
                'Cedula': 'No. Identificación',
                'Cédula': 'No. Identificación',
                'Fecha de Atencion': 'Fecha de Atención',
                'Fecha_Atencion': 'Fecha de Atención',
                'Fecha de AtenciÃ³n': 'Fecha de Atención',  # Esta es la clave que viene del PDF
                'Fecha_de_Atencion': 'Fecha de Atención'
            }

            # Aplicar el mapeo
            for old_key, new_key in key_mapping.items():
                if old_key in data:
                    data[new_key] = data.pop(old_key)
                    logging.info(f"Clave normalizada: {old_key} -> {new_key} = {data[new_key]}")

            
            # 🔹 Validar datos críticos CON LOGGING DETALLADO
            cedula = data.get('No. Identificación', '')
            fecha = data.get('Fecha de Atención', '')

            logging.info(f"Validando datos críticos:")
            logging.info(f"  - Cédula encontrada: '{cedula}' (tipo: {type(cedula)})")
            logging.info(f"  - Fecha encontrada: '{fecha}' (tipo: {type(fecha)})")
            logging.info(f"  - Todas las claves en data: {list(data.keys())}")

            # Solo validar que la cédula exista, la fecha es opcional
            if not cedula:
                error_msg = f"Cédula no válida en los datos extraídos. Cédula: '{cedula}'"
                logging.error(error_msg)
                raise ValueError(error_msg)

            # Si hay fecha, intentar convertirla
            if fecha:
                try:
                    # Intentar diferentes formatos de fecha
                    if ' ' in fecha and len(fecha.split()) == 3:  # Formato "15 08 2025"
                        data_date = pd.to_datetime(fecha, format='%d %m %Y', errors='raise')
                        logging.info(f"Fecha convertida usando formato '%d %m %Y': {data_date}")
                    else:
                        data_date = pd.to_datetime(fecha, dayfirst=True, errors='raise')
                        logging.info(f"Fecha convertida usando dayfirst=True: {data_date}")
                except Exception as e:
                    error_msg = f"Error al convertir la fecha '{fecha}': {str(e)}"
                    logging.warning(error_msg)  # Usar warning en lugar de error
                    data_date = None  # Permitir continuar sin fecha válida
            else:
                data_date = None
                logging.info("No se encontró fecha de atención, continuando sin ella")

            # 🔹 Cargar o crear el archivo
            header_row = 6
            if not control_path.exists():
                logging.info(f"Archivo de control no existe. Creando nuevo en: {control_path}")
                df = pd.DataFrame(columns=Config.COLUMNAS_CONTROL)
            else:
                try:
                    df = pd.read_excel(control_path, engine='openpyxl', header=header_row, dtype={'No. Identificación': str})
                except ValueError:
                    df = pd.read_excel(control_path, engine='openpyxl', header=None, dtype={'No. Identificación': str})
                    df.columns = Config.COLUMNAS_CONTROL
                    df = df.iloc[header_row + 1:].reset_index(drop=True)

            df = df.dropna(how='all')

            if not df.empty:
                if 'No. Identificación' in df.columns:
                    df['No. Identificación'] = df['No. Identificación'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip()
                if 'Fecha de Atención' in df.columns:
                    df['Fecha de Atención'] = pd.to_datetime(df['Fecha de Atención'], format='%Y/%m/%d', errors='coerce')

            # 🔹 Generar nuevo Item
            if 'Item' in df.columns and not df['Item'].isnull().all():
                max_item = df['Item'].dropna().astype(int).max()
                new_item = max_item + 1
            else:
                new_item = 1

            # 🔹 Buscar si ya existe el mismo registro
            data_id = str(data['No. Identificación']).strip()
            # Buscar si ya existe el mismo registro (solo por cédula si no hay fecha)
            if data_date is not None:
                same_person = (df['No. Identificación'] == data_id) & (df['Fecha de Atención'] == data_date)
            else:
                same_person = (df['No. Identificación'] == data_id)

            # 🔹 Mapear nombres de campos a columnas del Excel
            field_to_column_map = {
                'Nombre_Completo': 'Nombre Completo',
                # CORRECCIÓN: Mapear la clave interna 'No. Identificación' a la columna Excel 'No. Identificación' (con tilde)
                'No. Identificación': 'No. Identificación',
                'Fecha_Nac': 'Fecha Nac',
                'Edad': 'Edad',
                'Sexo': 'Sexo',
                'Afiliacion': 'Afiliación',
                'Estado_civil': 'Estado civil',
                'Evaluacion_Ocupacional': 'Evaluación Ocupacional',
                'Fecha de Atención': 'Fecha de Atención',
                'Cargo': 'Cargo',
                'Examenes_realizados': 'Exámenes realizados',
                'Recomendaciones_Laborales': 'Recomendaciones Laborales',
                'Incluir SVE': 'Incluir SVE',
                'Restricciones_Laborales': 'Restricciones Laborales',
                'Concepto_Medico': 'Concepto medico laboral',
                'Concepto Medico': 'Concepto Medico',
                'Concepto Manipulación Alimento': 'Concepto Manipulación Alimento',
                'Concepto Altura': 'Concepto Altura',
                'Concepto de trabajo en espacios confinados': 'Concepto de trabajo en espacios confinados',
                'Motivo de Restricción': 'Motivo de Restricción'
            }

            # Crear new_row_data usando el mapeo correcto
            new_row_data = {'Item': new_item}
            for excel_col in Config.COLUMNAS_CONTROL:
                if excel_col != 'Item':
                    # Buscar el valor en data usando el mapeo inverso
                    data_key = None
                    for data_field, excel_field in field_to_column_map.items():
                        if excel_field == excel_col and data_field in data:
                            data_key = data_field
                            break

                    if data_key:
                        new_row_data[excel_col] = data[data_key]
                    else:
                        # Si no encuentra el mapeo, buscar directamente
                        new_row_data[excel_col] = data.get(excel_col, '')

            # Asegurar que la cédula no tenga .0 - Asignar a la columna CORRECTA del Excel
            # La clave interna normalizada es 'No. Identificación', y ahora debe ir a la columna 'No. Identificación' (con tilde) del Excel.
            cedula_valor = data.get('No. Identificación', '') # Obtener desde la clave normalizada
            # CORRECCIÓN: Asignar a la columna del Excel con tilde
            new_row_data['No. Identificación'] = str(cedula_valor).replace('.0', '')

            # Asegurarse de que la clave sin tilde no se incluya accidentalmente en new_row_data si el mapeo falla
            # (Esto es menos probable ahora, pero puede ser una medida de seguridad si otras partes del código la agregan)
            # new_row_data.pop('No. Identificacion', None) # Descomentar si es necesario 

            if same_person.any():
                idx = df[same_person].index[0]
                for col, value in new_row_data.items():
                    if col in data and data[col]:
                        if col == 'Edad':
                            try:
                                value = int(value)
                            except (ValueError, TypeError):
                                value = pd.NA
                        elif col in df.columns and df[col].dtype in ['int64', 'float64']:
                            value = pd.to_numeric(value, errors='coerce')
                        elif col in df.columns and df[col].dtype == 'object':
                            value = str(value)
                        df.loc[idx, col] = value
                action = "actualizado"
                row_number = idx + header_row + 2
            else:
                new_row = pd.Series(new_row_data)
                df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
                row_number = len(df) + header_row + 1
                action = f"añadido en la fila {row_number}"

            # 🔹 Guardar archivo
            with pd.ExcelWriter(control_path, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, header=True, startrow=header_row)
                logging.info(f"Archivo de control {action}: {control_path}")

            return str(control_path)

        except Exception as e:
            logging.error(f"Error al actualizar archivo de control: {str(e)}")
            logging.debug(traceback.format_exc())
            raise


class DocumentGenerator:
    def generate_remision(self, data, template_path, output_dir):
        try:
            template_path = Path(template_path)
            doc = DocxTemplate(template_path)
            context = {
                'fecha': datetime.now().strftime('%d/%m/%Y'),
                'nombre_destinatario': data.get('Nombre_Completo', 'N/A'),
                'cc': data.get('No. Identificacion', 'N/A'),
                'cargo': data.get('Cargo', 'N/A'),
                'evaluación_ocupacional': data.get('Evaluacion_Ocupacional', 'N/A'),
                'recomendaciones_laborales': data.get('Recomendaciones_Laborales', 'N/A')
            }
            doc.render(context)

            output_dir = Path(output_dir)
            output_dir.mkdir(parents=True, exist_ok=True)
            fecha = datetime.now().strftime('%Y%m%d')
            nombre_sanitizado = re.sub(r'[<>:"/\\|?*]', '_', data.get('Nombre_Completo', 'sin_nombre'))
            output_path = output_dir / f"GI-OD-007 REMISION A EPS {nombre_sanitizado} {fecha}.docx"

            counter = 1
            while output_path.exists():
                output_path = output_dir / f"GI-OD-007 REMISION A EPS {nombre_sanitizado} {fecha}_{counter}.docx"
                counter += 1

            doc.save(output_path)
            return str(output_path)
        except Exception as e:
            log(f"Error en generate_remision: {str(e)}", level='ERROR')
            raise

def generate_remision_document(data, empresa):
    try:
        log(f"Iniciando generación de documento para la empresa: {empresa}")
        doc_generator = DocumentGenerator()
        excel_handler = ExcelHandler()
        
        empresa_rutas = Config.get_empresa_paths(empresa)
        log(f"Rutas obtenidas para {empresa}: {empresa_rutas}")
        
        template_path = empresa_rutas["plantilla"]
        output_dir = empresa_rutas["remisiones"]
        
        log(f"Usando plantilla: {template_path}")
        doc_path = doc_generator.generate_remision(data, template_path, output_dir)
        log(f"Documento de remisión generado en: {doc_path}")
        
        control_path = empresa_rutas["control"]
        log(f"Actualizando archivo de control: {control_path}")
        excel_path = excel_handler.update_control_file(data, control_path)
        log(f"Archivo de control actualizado en: {excel_path}")
        
        return {"success": True, "documentPath": doc_path, "controlPath": excel_path}
    except Exception as e:
        log(f"Error al generar documento de remisión: {str(e)}", level='ERROR')
        return {"success": False, "error": str(e)}

def send_remision_by_email(doc_path, data, empresa):
    try:
        log(f"Iniciando envío de email para la empresa {empresa} con el documento {doc_path}")
        email_sender = EmailSender(empresa)
        
        cedula = data.get('No. Identificación', '')  #Correcto, usar la clave normalizada
        nombre = data.get('Nombre Completo', 'Trabajador')
        fecha_atencion = data.get('Fecha de Atención', '')
        
        if not cedula:
            raise ValueError("No se encontró el número de identificación en los datos para el email")
            
        telefono, destinatario = email_sender.obtener_contacto(cedula)
        
        if not destinatario:
            raise ValueError("No se encontró la dirección de correo para el destinatario")
            
        success = email_sender.enviar_correo(destinatario, nombre, fecha_atencion, doc_path)
        
        if success:
            log(f"Documento enviado exitosamente por email a {destinatario}")
            return {"success": True, "message": "Documento enviado exitosamente por email"}
        else:
            log("Error al enviar el documento por email", level='ERROR')
            return {"success": False, "error": "Error interno al enviar el documento por email"}
    except Exception as e:
        log(f"Error al enviar documento por email: {str(e)}", level='ERROR')
        return {"success": False, "error": str(e)}

def send_remision_by_whatsapp(doc_path, data, empresa):
    try:
        log(f"Iniciando preparación de documento para WhatsApp: {doc_path}")
        email_sender = EmailSender(empresa)
        cedula = data.get('No. Identificación', '') #Correcto, usar la clave normalizada
        if not cedula:
            raise ValueError("No se encontró Cédula para buscar contacto de WhatsApp.")
        
        telefono, _ = email_sender.obtener_contacto(cedula)
        
        if not telefono:
            raise ValueError("No se encontró teléfono para el contacto.")

        if os.path.exists(doc_path):
            log(f"Documento preparado para WhatsApp: {doc_path}")
            return {
                "success": True,
                "documentPath": doc_path,
                "phoneNumber": telefono,
                "message": "Documento preparado para enviar por WhatsApp"
            }
        else:
            log(f"Documento no encontrado para enviar por WhatsApp: {doc_path}", level='ERROR')
            return {"success": False, "error": "Documento no encontrado"}
    except Exception as e:
        log(f"Error al preparar documento para WhatsApp: {str(e)}", level='ERROR')
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) > 2:
        command = sys.argv[1]
        data_file = sys.argv[2]
        result = {}

        try:
            log(f"Comando '{command}' recibido con el archivo de datos: {data_file}")
            with open(data_file, 'r', encoding='utf-8') as f:
                temp_data = json.load(f)

            data = temp_data.get('data', {})
            
            if command == "--generate-remision":
                result = generate_remision_document(data, temp_data['empresa'])
            elif command == "--send-email":
                result = send_remision_by_email(temp_data['docPath'], data, temp_data['empresa'])
            elif command == "--send-whatsapp":
                result = send_remision_by_whatsapp(temp_data['docPath'], data, temp_data['empresa'])
            else:
                result = {"success": False, "error": "Comando no reconocido"}

        except Exception as e:
            log(f"Error crítico en la ejecución del script: {str(e)}", level='ERROR')
            result = {"success": False, "error": str(e), "traceback": traceback.format_exc()}

        # Imprimir el resultado final a stdout
        final_output = {'type': 'result', 'payload': result}
        print(json.dumps(final_output, ensure_ascii=False), file=sys.stdout)

    else:
        log("Script iniciado sin argumentos para la línea de comandos.")
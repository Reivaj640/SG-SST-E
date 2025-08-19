# -*- coding: utf-8 -*-
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

warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")

# Configurar el logger para que no muestre mensajes en la terminal
logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)  # Solo mostrar advertencias y errores

# Si ya hay handlers, limpiarlos
if logger.hasHandlers():
    logger.handlers.clear()

# Crear un handler que descarte los mensajes
class NullHandler(logging.Handler):
    def emit(self, record):
        pass

logger.addHandler(NullHandler())

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
        "TEMPOACTIVA": "G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\2. Temporales Comfa\\Base de Datos Personal Temporales.xlsx",
        "TEMPOSUM": "G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\2. Temporales Comfa\\Base de Datos Personal Temporales.xlsx",
        "ASEPLUS": "G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\2. Temporales Comfa\\Base de Datos Personal Temporales.xlsx",
        "ASEL": "G:/Mi unidad/2. Trabajo/1. SG-SST/19. Asel S.A.S/Formato - Base de datos personal ASEL.xlsx"
    }

    # Credenciales de correo por empresa
    CREDENCIALES = {
        "TEMPOACTIVA": {"email": "tempoactivaestsas@gmail.com", "password": "pxfu wxit wpjf svxd"},
        "TEMPOSUM": {"email": "temposumestsas@gmail.com", "password": "bcfw rzxh ksob ddns"},
        "ASEPLUS": {"email": "asepluscaribesas@gmail.com", "password": "yudh myrl zjpk eoej"},
        "ASEL": {"email": "asel.contratacion@gmail.com", "password": "kdyh degt juwf tuqd"}
    }

class WhatsAppSender:
    def send_message(self, phone_number, message, file_path=None):
        try:
            # Copiar el mensaje al portapapeles
            pyperclip.copy(message)
            logger.info("Mensaje copiado al portapapeles.")

            # Codificar el mensaje para URL
            encoded_message = quote(message)
            url = f"https://api.whatsapp.com/send?phone={phone_number}&text={encoded_message}"
            
            webbrowser.open(url)

            # Abrir el archivo en el navegador para facilitar el adjunto
            if file_path and Path(file_path).exists():
                os.startfile(file_path)

                # Abrir carpeta contenedora del archivo automáticamente
                folder_path = os.path.dirname(file_path)
                os.startfile(folder_path)  # Windows

            logger.info(f"Mensaje de WhatsApp enviado a y carpeta de archivo abierto para {phone_number}")
        except Exception as e:
            logger.error(f"Error al enviar WhatsApp: {str(e)}")
            raise

class EmailSender:
    def __init__(self, empresa):
        self.empresa = empresa.upper()
        self.credenciales = Config.CREDENCIALES.get(self.empresa)
        self.plantilla = Config.PLANTILLAS.get(self.empresa, Config.PLANTILLAS["DEFAULT"])
        self.base_datos = Config.BASES_DATOS.get(self.empresa)
        
        if not self.credenciales:
            raise ValueError(f"No hay credenciales configuradas para {self.empresa}")
        
        self.logger = logging.getLogger("EmailSender")

    def obtener_contacto(self, cedula):
        try:
            if not self.base_datos or not Path(self.base_datos).exists():
                self.logger.warning(f"Base de datos no encontrada: {self.base_datos}")
                return None, None
                
            df = pd.read_excel(
                self.base_datos,
                sheet_name="FORMATO" if self.empresa == "ASEL" else "COMPLETO",
                dtype=str
            )
            
            # Buscar columnas relevantes
            col_cedula = next((col for col in df.columns if 'CEDULA' in col.upper() or 'IDENTIFICACIÓN' in col.upper()), None)
            col_celular = next((col for col in df.columns if 'CELULAR' in col.upper() or 'TELÉFONO' in col.upper()), None)
            col_email = next((col for col in df.columns if 'CORREO' in col.upper() or 'EMAIL' in col.upper()), None)
            
            if not col_cedula or not col_celular:
                self.logger.error("Columnas críticas no encontradas en la base de datos")
                return None, None
                
            # Buscar el registro
            registro = df[df[col_cedula].astype(str).str.strip() == str(cedula).strip()]
            
            if not registro.empty:
                telefono = registro.iloc[0][col_celular]
                email = registro.iloc[0][col_email] if col_email else None
                return telefono, email
                
            return None, None
        except Exception as e:
            self.logger.error(f"Error al obtener contacto: {str(e)}")
            return None, None

    def enviar_correo(self, destinatario, nombre, fecha_atencion, archivo_adjunto):
        try:
            # Validación básica de parámetros
            if not all([destinatario, nombre, fecha_atencion, archivo_adjunto]):
                raise ValueError("Faltan parámetros requeridos para enviar el correo")
                
            if not Path(archivo_adjunto).exists():
                raise FileNotFoundError(f"Archivo adjunto no encontrado: {archivo_adjunto}")

            # Construir mensaje personalizado
            asunto = self.plantilla["asunto"]
            cuerpo = self.plantilla["cuerpo"].format(
                nombre=nombre,
                fecha=fecha_atencion,
                empresa=self.empresa,
                remitente=self.credenciales["email"]
            )

            # Configurar mensaje MIME
            msg = MIMEMultipart()
            # Encode both the empresa name and email address to handle non-ASCII characters
            encoded_empresa = Header(self.empresa, 'utf-8').encode()
            email_address = self.credenciales["email"].encode('ascii', errors='ignore').decode('ascii')
            msg['From'] = formataddr((encoded_empresa, email_address))
            msg['To'] = destinatario
            msg['Subject'] = Header(asunto, 'utf-8').encode()
            msg.attach(MIMEText(cuerpo, 'plain', 'utf-8'))

            # Adjuntar documento
            with open(archivo_adjunto, "rb") as adjunto:
                parte = MIMEBase('application', 'octet-stream')
                parte.set_payload(adjunto.read())
                encoders.encode_base64(parte)
                nombre_archivo = os.path.basename(archivo_adjunto)
                parte.add_header(
                    'Content-Disposition',
                    f'attachment; filename= {nombre_archivo}'
                )
                msg.attach(parte)

            # Enviar correo
            servidor = smtplib.SMTP('smtp.gmail.com', 587)
            servidor.starttls()
            servidor.login(self.credenciales["email"], self.credenciales["password"])
            texto = msg.as_string()
            servidor.sendmail(self.credenciales["email"], destinatario, texto)
            servidor.quit()

            self.logger.info(f"Correo enviado exitosamente a {destinatario}")
            return True

        except Exception as e:
            self.logger.error(f"Error al enviar correo: {str(e)}")
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

            for campo in ['Concepto Altura', 'Concepto de trabajo en espacios confinados', 'Motivo de Restricción', 'Incluir SVE', 'Restricciones Laborales', 'Concepto Manipulación Alimento']:
                if not data.get(campo):
                    data[campo] = "NINGUNO"

            data['archivo_origen'] = str(pdf_path)
            data['fecha_procesamiento'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            return data
        except Exception as e:
            logger.error(f"Error en extract_pdf_data para {pdf_path}: {str(e)}")
            raise ValueError(f"Errores en la extracción de datos en {pdf_path.name}: {str(e)}")

    def _extract_formato_generico(self, text):
        """Extracción genérica para manejar otros formatos posibles"""
        extraction_rules = {
            'Nombre Completo': {
                'pattern': r'(?:Nombre\s*Completo|Paciente|Nombre)[:\s]*(.*?)(?:\n|SEXO:|DOCUMENTO|IDENTIFICACI[ÓO]N|$)',
                'processor': lambda x: x.strip().upper() if x else ""
            },
            'No. Identificación': {
                'pattern': r'(?:Documento[:\s]*CC[:\s]*(\d+))|' 
                           r'(?:(?:No\.|N[úu]mero)\s*(?:de)?\s*Identificaci[óo]n[:\s]*(?:CC\s*-\s*)?(\d{7,12}))|' 
                           r'(?:(?:CC|TI|CE)[:\s-]*(\d{7,12}))|' 
                           r'(?:(?:c[ée]dula|documento|identificaci[óo]n)[:\s]*(\d{7,12}))',
                'processor': lambda x: re.sub(r'[^\d]', '', x.strip()) if x else ""
            },
            'Fecha Nac': {
                'pattern': r'Fecha\s*(?:de)?\s*Nac(?:imiento)?[:\s]*([\d/-]+)',
                'processor': lambda x: self._format_date(x.strip()) if x else ""
            },
            'Edad': {
                'pattern': r'Edad[:\s]*(\d+)',
                'processor': lambda x: int(x.strip()) if x and x.strip().isdigit() else ""
            },
            'Sexo': {
                'pattern': r'(?:Sexo|G[ée]nero)[:\s]*([A-Za-zÁ-Úá-ú]+)',
                'processor': lambda x: x.strip().capitalize() if x else ""
            },
            'Afiliación': {
                'pattern': r'(?:Afiliaci[óo]n|Empresa)[:\s]*(.*?)(?:\n|$)',
                'processor': lambda x: self._process_afiliacion(x.strip()) if x else ""
            },
            'Estado civil': {
                'pattern': r'Estado\s*civil[:\s]*(.*?)(?:\n|$)',
                'processor': lambda x: x.strip().capitalize() if x else ""
            },
            'Evaluación Ocupacional': {
                'pattern': r'(?:TIPO\s*DE\s*EVALUACI[ÓO]N\s*REALIZADA|Tipo\s*de\s*Examen|Evaluaci[óo]n\s*Ocupacional)[:\s]*([^:\n]+?)(?=\s*Fecha\s*de\s*atenci[óo]n:|$)',
                'processor': lambda x: x.strip().upper() if x else ""
            },
            'Fecha de Atención': {
                'pattern': r'Fecha\s*(?:de)?\s*atenci[óo]n[:\s]*([\d/-]+)',
                'processor': lambda x: self._format_date(x.strip()) if x else ""
            },
            'Cargo': {
                'pattern': r'Cargo[:\s]*([^:\n]+?)(?=\s*Fecha\s*de|$)',
                'processor': self._process_cargo
            },
            'Exámenes realizados': {
                'pattern': r'EX[ÁA]MENES\s*REALIZADOS[:\s]*(.*?)(?=\s*(?:RECOMENDACIONES|INCLUIR|RESTRICCIONES|MANEJO|$))',
                'processor': lambda x: x.strip().replace('\n', ' ').strip().upper() if x else ""
            },
            'Recomendaciones Laborales': {
                'pattern': r'RECOMENDACIONES\s*LABORALES[:\s]*(.*?)(?=MANEJO\s*EPS/ARL|\Z)',
                'processor': lambda x: x.strip().upper() if x else "NINGUNO"
            },
            'Incluir SVE': {
                'pattern': r'Incluir\s*SVE[:\s]*([^\n:]+?)(?=\s*(?:RESTRICCIONES|Concepto|$))',
                'processor': lambda x: x.strip().upper() if x and not x.strip().startswith('RESTRICCIONES') else "NINGUNO"
            },
            'Restricciones Laborales': {
                'pattern': r'RESTRICCIONES\s*LABORALES[:\s]*(.*?)(?=\s*(?:Para\s*la\s*revisi[óo]n|INCLUIR|CONCEPTO|[A-ZÁ-Ú]+:|$))',
                'processor': lambda x: x.strip().upper() if x else "NINGUNO"
            },
            'Concepto Medico': {
                'pattern': r'Concepto\s*Medico[:\s]*((?!LEVANTAMIENTO)[^:\n]+)',
                'processor': lambda x: x.strip().upper() if x else "NINGUNO"
            },
            'Concepto Manipulación Alimento': {
                'pattern': r'Concepto\s*(?:Manipulaci[óo]n)?\s*Alimento[:\s]*(.*?)(?:\n|$)',
                'processor': lambda x: x.strip().upper() if x else "NINGUNO"
            },
            'Concepto Altura': {
                'pattern': r'Concepto\s*Altura[:\s]*(.*?)(?:\n|$)',
                'processor': lambda x: x.strip().upper() if x else "NINGUNO"
            },
            'Concepto de trabajo en espacios confinados': {
                'pattern': r'Concepto\s*de\s*trabajo\s*en\s*espacios\s*confinados[:\s]*([^\n:]+?)(?=\s*(?:MOTIVO|$))',
                'processor': lambda x: x.strip().upper() if x and not x.strip().startswith('MOTIVO') else "NINGUNO"
            },
            'Motivo de Restricción': {
                'pattern': r'MOTIVO\s*DE\s*RESTRICCI[OÓ]N[:\s]*(.*?)(?:\nFIRMA|\Z)',
                'processor': lambda x: x.strip().upper() if x else "NINGUNO"
            },
        }

        data = {}
        for key, rule in extraction_rules.items():
            match = re.search(rule['pattern'], text, re.IGNORECASE | re.DOTALL)
            if match:
                value = next((g for g in match.groups() if g is not None), "")
                data[key] = rule['processor'](value)
            else:
                data[key] = ""
                logging.warning(f"No se encontró el campo '{key}' usando regex genérico")

        return data

    def _post_process_data(self, data):
        if data.get('Nombre Completo') and 'SEXO:' in data['Nombre Completo'].upper():
            data['Nombre Completo'] = data['Nombre Completo'].split('SEXO:')[0].strip()
        return data

    def _validate_critical_data(self, data, filename):
        required_fields = {
            'No. Identificación': "No Identificacion no encontrado",
            'Fecha de Atención': "Fecha de Atención no encontrada",
        }
        errors = []
        for field, message in required_fields.items():
            if not data.get(field):
                errors.append(message)
        if errors:
            raise ValueError(", ".join(errors))

    def _format_date(self, date_str):
        if not date_str:
            return ""
        date_formats = ['%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%Y/%m/%d']
        for fmt in date_formats:
            try:
                date_obj = datetime.strptime(date_str, fmt)
                return date_obj.strftime('%Y/%m/%d')
            except ValueError:
                continue
        return date_str

    def _process_afiliacion(self, value):
        if not value:
            return ""
        return value.strip().upper()

    def _process_cargo(self, value):
        if not value:
            return ""
        return value.strip().upper()

class ExcelHandler:
    def update_control_file(self, data, control_path):
        try:
            control_path = Path(control_path)
            if not control_path.exists():
                df = pd.DataFrame(columns=Config.COLUMNAS_CONTROL)
                header_row = 6
            else:
                df = pd.read_excel(control_path, engine='openpyxl', header=6, dtype={'No. Identificación': str})
                header_row = 6

            df = df.dropna(how='all')
            if not df.empty:
                df['No. Identificación'] = df['No. Identificación'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip()
                if 'Fecha de Atención' in df.columns:
                    df['Fecha de Atención'] = pd.to_datetime(df['Fecha de Atención'], errors='coerce')

            data_id = str(data['No. Identificación']).strip()
            data_date = pd.to_datetime(data['Fecha de Atención'], errors='coerce')

            same_person = (df['No. Identificación'] == data_id) & (df['Fecha de Atención'] == data_date)
            
            new_row_data = {col: data.get(col, '') for col in df.columns}
            if 'Item' in df.columns and not df['Item'].isnull().all():
                new_row_data['Item'] = int(df['Item'].dropna().max()) + 1
            else:
                new_row_data['Item'] = 1

            if same_person.any():
                df.update(pd.DataFrame(new_row_data, index=df[same_person].index))
            else:
                df = pd.concat([df, pd.DataFrame([new_row_data])], ignore_index=True)

            with pd.ExcelWriter(control_path, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, header=True, startrow=header_row)

        except Exception as e:
            logger.error(f"Error al actualizar archivo de control: {str(e)}")
            raise

class DocumentGenerator:
    def generate_remision(self, data, template_path, output_dir):
        try:
            template_path = Path(template_path)
            doc = DocxTemplate(template_path)
            context = {
                'fecha': datetime.now().strftime('%d/%m/%Y'),
                'nombre_destinatario': data.get('Nombre Completo', 'N/A'),
                'cc': data.get('No. Identificación', 'N/A'),
                'cargo': data.get('Cargo', 'N/A'),
                'evaluación_ocupacional': data.get('Evaluación Ocupacional', 'N/A'),
                'recomendaciones_laborales': data.get('Recomendaciones Laborales', 'N/A')
            }
            doc.render(context)

            output_dir = Path(output_dir)
            output_dir.mkdir(parents=True, exist_ok=True)
            fecha = datetime.now().strftime('%Y%m%d')
            nombre_sanitizado = re.sub(r'[<>:"/\\|?*]', '_', data.get('Nombre Completo', 'sin_nombre'))
            output_path = output_dir / f"GI-OD-007 REMISION A EPS {nombre_sanitizado} {fecha}.docx"

            counter = 1
            while output_path.exists():
                output_path = output_dir / f"GI-OD-007 REMISION A EPS {nombre_sanitizado} {fecha}_{counter}.docx"
                counter += 1

            doc.save(output_path)
            return str(output_path)
        except Exception as e:
            logger.error(f"Error en generate_remision: {str(e)}")
            raise
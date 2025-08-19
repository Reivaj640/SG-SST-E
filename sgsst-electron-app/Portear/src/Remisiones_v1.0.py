# -*- coding: utf-8 -*-
"""
Sistema Integrado de Gestión de Remisiones EPS v1.1
Versión Completa Funcional
"""

import os
import re
import json
import logging
import traceback
import threading
import unicodedata
from pathlib import Path
from datetime import datetime
from urllib.parse import quote
from tkinter import messagebox, filedialog, StringVar, BooleanVar, Tk, Button
import ttkbootstrap as ttk
from ttkbootstrap.constants import *
from ttkbootstrap.scrolled import ScrolledFrame
import pdfplumber
import pandas as pd
from docxtpl import DocxTemplate
import webbrowser
import pyperclip
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from email.header import Header
from email.utils import formataddr
import warnings
from logging.handlers import RotatingFileHandler

warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")

# Configuración de logging
logger = logging.getLogger('remisiones_app')
logger.setLevel(logging.DEBUG)

# Limpiar handlers existentes para evitar duplicados
if logger.hasHandlers():
    logger.handlers.clear()

# Formato del log
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(module)s.%(funcName)s - %(message)s')

# Handler para archivo (rotativo)
log_file = 'remisiones_app.log'
file_handler = None

try:
    # Intentar crear el handler principal
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=5*1024*1024,  # 5 MB
        backupCount=3,
        encoding='utf-8'
    )
    file_handler.setFormatter(formatter)
except PermissionError as e:
    print(f"Error de permisos al crear el archivo de log: {e}")
    # Fallback: Crear el archivo en el directorio temporal del sistema
    import tempfile
    temp_log_file = os.path.join(tempfile.gettempdir(), 'remisiones_app.log')
    print(f"Creando archivo de log en: {temp_log_file}")
    try:
        file_handler = RotatingFileHandler(
            temp_log_file,
            maxBytes=5*1024*1024,
            backupCount=3,
            encoding='utf-8'
        )
        file_handler.setFormatter(formatter)
    except Exception as fallback_error:
        print(f"Error crítico al crear log de respaldo: {fallback_error}")
        # Si todo falla, usar solo consola
        file_handler = None

# Agregar handler de archivo si se creó correctamente
if file_handler:
    logger.addHandler(file_handler)

# Handler para consola (siempre disponible)
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

# Registrar mensaje de inicio para verificar que funciona
logger.info("Inicialización del sistema de logging completada")

# Clase Config para manejar rutas y configuraciones
class Config:
    RUTA_BASE = Path("G:/Mi unidad")

    RUTAS = {
        "TEMPOACTIVA": {
            "base": RUTA_BASE / "2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud",
            "certificados": RUTA_BASE / "2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.1.4 Evaluaciónes médicas/3.1.4.1. Certificados de Aptitud Medica",
            "remisiones": RUTA_BASE / "2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS",
            "plantilla": RUTA_BASE / "2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS/GI-OD-007 REMISION A EPS.docx",
            "control": RUTA_BASE / "2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS/GI-FO-012 CONTROL DE REMISIONES.xlsx"
        },
        "TEMPOSUM": {
            "base": RUTA_BASE / "2. Trabajo/1. SG-SST/2. Temporales Comfa/2. Temposum Est SAS/3. Gestión de la Salud",
            "certificados": RUTA_BASE / "2. Trabajo/1. SG-SST/2. Temporales Comfa/2. Temposum Est SAS/3. Gestión de la Salud/3.1.4 Evaluaciónes médicas/3.1.4.1. Certificados de Aptitud Medica",
            "remisiones": RUTA_BASE / "2. Trabajo/1. SG-SST/2. Temporales Comfa/2. Temposum Est SAS/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS",
            "plantilla": RUTA_BASE / "2. Trabajo/1. SG-SST/2. Temporales Comfa/2. Temposum Est SAS/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS/GI-OD-007 REMISION A EPS.docx",
            "control": RUTA_BASE / "2. Trabajo/1. SG-SST/2. Temporales Comfa/2. Temposum Est SAS/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS/GI-FO-012 CONTROL DE REMISIONES.xlsx"
        },
        "ASEPLUS": {
            "base": RUTA_BASE / "2. Trabajo/1. SG-SST/2. Temporales Comfa/3. Aseplus/3. Gestión de la Salud",
            "certificados": RUTA_BASE / "2. Trabajo/1. SG-SST/2. Temporales Comfa/3. Aseplus/3. Gestión de la Salud/3.1.4 Evaluaciones médicas/3.1.4.1. Certificados de Aptitud Medica",
            "remisiones": RUTA_BASE / "2. Trabajo/1. SG-SST/2. Temporales Comfa/3. Aseplus/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS",
            "plantilla": RUTA_BASE / "2. Trabajo/1. SG-SST/2. Temporales Comfa/3. Aseplus/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS/GI-OD-007 REMISION A EPS.docx",
            "control": RUTA_BASE / "2. Trabajo/1. SG-SST/2. Temporales Comfa/3. Aseplus/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS/GI-FO-012 CONTROL DE REMISIONES.xlsx"
        },
        "ASEL": {
            "base": RUTA_BASE / "2. Trabajo/1. SG-SST/19. Asel S.A.S/3. Gestión de la Salud",
            "certificados": RUTA_BASE / "/2. Trabajo/1. SG-SST/19. Asel S.A.S/3. Gestión de la Salud/3.1.4 Evaluaciónes médicas/3.1.4.1. Certificados de Aptitud Medica",
            "remisiones": RUTA_BASE / "/2. Trabajo/1. SG-SST/19. Asel S.A.S/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS",
            "plantilla": RUTA_BASE / "/2. Trabajo/1. SG-SST/19. Asel S.A.S/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS/GI-OD-007 REMISION A EPS.docx",
            "control": RUTA_BASE / "/2. Trabajo/1. SG-SST/19. Asel S.A.S/3. Gestión de la Salud/3.1.6 Restricciones y recomendaciones médicas/3.1.6.1. Remisiones EPS/GI-FO-012 CONTROL DE REMISIONES.xlsx"
        }
    }

    COLUMNAS_CONTROL = [
        "Item", "Nombre Completo", "No. Identificación", "Fecha Nac", "Edad", "Sexo",
        "Afiliación", "Estado civil", "Evaluación Ocupacional", "Fecha de Atención",
        "Cargo", "Exámenes realizados", "Recomendaciones Laborales", "Incluir SVE",
        "Restricciones Laborales", "Concepto medico laboral", "Concepto Medico",
        "Concepto Manipulación Alimento", "Concepto Altura",
        "Concepto de trabajo en espacios confinados", "Motivo de Restricción"
    ]

    CACHE_FILE = Path("processed_files_cache.json")

    @classmethod
    def load_from_file(cls, path="config.json"):
        try:
            config_path = Path(path)
            if config_path.exists():
                with open(config_path, "r", encoding="utf-8") as f:
                    config = json.load(f)
                    for key, value in config.items():
                        if hasattr(cls, key):
                            if isinstance(value, dict):
                                for k, v in value.items():
                                    if isinstance(v, dict):
                                        for subk, subv in v.items():
                                            v[subk] = Path(subv)
                                    setattr(cls, key, value)
                            elif "RUTA" in key or "FILE" in key:
                                setattr(cls, key, Path(value))
                            else:
                                setattr(cls, key, value)
                    logging.info(f"Configuración cargada desde {path}")
            else:
                logging.warning(f"Archivo de configuración {path} no encontrado. Usando valores por defecto.")
                cls.save_to_file(path)
        except json.JSONDecodeError as e:
            logging.error(f"Error de decodificación JSON en {path}: {str(e)}")
            logging.debug(f"Posición del error: línea {e.lineno}, columna {e.colno}")
            raise
        except Exception as e:
            logging.error(f"Error inesperado al cargar configuración: {str(e)}")
            logging.debug(traceback.format_exc())
            raise

    @classmethod
    def save_to_file(cls, path="config.json"):
        try:
            config = {}
            for key, value in cls.__dict__.items():
                if not key.startswith("__") and not callable(value):
                    if isinstance(value, dict):
                        new_dict = {}
                        for k, v in value.items():
                            if isinstance(v, dict):
                                new_subdict = {}
                                for subk, subv in v.items():
                                    new_subdict[subk] = str(subv) if isinstance(subv, Path) else subv
                                new_dict[k] = new_subdict
                            else:
                                new_dict[k] = str(v) if isinstance(v, Path) else v
                        config[key] = new_dict
                    elif isinstance(value, Path):
                        config[key] = str(value)
                    else:
                        config[key] = value
            with open(path, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=2)
            logging.info(f"Configuración guardada en {path}")
        except Exception as e:
            logging.error(f"Error al guardar configuración: {str(e)}")
            logging.debug(traceback.format_exc())

    @classmethod
    def get_empresa_paths(cls, afiliacion):
        afiliacion_upper = afiliacion.upper()
        if afiliacion_upper in cls.RUTAS:
            return cls.RUTAS[afiliacion_upper]
        else:
            logging.warning(f"Afiliación '{afiliacion}' no encontrada, usando TEMPOACTIVA por defecto.")
            return cls.RUTAS["TEMPOACTIVA"]

# Clase PdfProcessor para extraer datos de PDFs
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
            logging.debug(f"Texto extraído del PDF {pdf_path.name}:\n{text[:1000]}...")
            text = unicodedata.normalize('NFC', text)

            # Determinar el formato del PDF
            pdf_format = self._detect_pdf_format(text)
            logging.info(f"Formato de PDF detectado: {pdf_format} para {pdf_path.name}")

            # Extraer datos según el formato
            data = self._extract_data_based_on_format(text, pdf_format)

            # Pre-procesamiento: Eliminar secciones irrelevantes
            text = self._remove_header_footer(text)

            # Pre-procesamiento: Eliminar encabezados redundantes
            text = self._remove_redundant_headers(text)

            # Detectar y procesar solo la última sección relevante
            if "LEVANTAMIENTO DE RESTRICCIONES" in text:
                # Conservar solo texto después del último levantamiento
                relevant_section = text.split("LEVANTAMIENTO DE RESTRICCIONES")[-1]
                # Combinar con el inicio (para mantener datos básicos)
                text = text.split("LEVANTAMIENTO DE RESTRICCIONES")[0] + relevant_section

            # Post-procesamiento
            data = self._post_process_data(data)

            # Validación de datos críticos con manejo más suave
            self._validate_critical_data(data, pdf_path)

            # Agregar campos faltantes con NINGUNO
            for campo in ['Concepto Altura', 'Concepto de trabajo en espacios confinados',
                          'Motivo de Restricción', 'Incluir SVE', 'Restricciones Laborales',
                          'Concepto Manipulación Alimento']:
                if not data.get(campo):
                    data[campo] = "NINGUNO"

            data['archivo_origen'] = str(pdf_path)
            data['fecha_procesamiento'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            return data

        except Exception as e:
            logging.error(f"Error en extract_pdf_data para {pdf_path}: {str(e)}")
            logging.debug(traceback.format_exc())
            raise

    def _remove_redundant_headers(self, text):
        """Elimina encabezados redundantes que interfieren con la extracción"""
        headers_to_remove = [
            "RESTRICCIONES LABORALES:",
            "MOTIVO DE RESTRICCI[OÓ]N:",
            "CONCEPTO MEDICO:",
            "INCLUIR SVE:"
        ]
        
        for header in headers_to_remove:
            text = re.sub(header, '', text, flags=re.IGNORECASE)
        
        return text

    def _remove_header_footer(self, text):
        """Elimina encabezados/pies de página repetitivos"""
        patterns_to_remove = [
            r'Página\s*\d+\s*de\s*\d+',
            r'DATOS DEL PACIENTE',
            r'\.{3,}'  # Líneas divisorias
        ]
        
        for pattern in patterns_to_remove:
            text = re.sub(pattern, '', text, flags=re.IGNORECASE)

        return text

    def _detect_pdf_format(self, text):
        """Detecta el formato del PDF basado en patrones específicos en el texto"""
        text_upper = text.upper()
        if "DOCUMENTO : CC" in text_upper and "PACIENTE:" in text_upper:
            return "formato_1"
        elif "NOMBRE COMPLETO:" in text_upper and "TIPO DE EVALUACION REALIZADA" in text_upper:
            return "formato_2"
        elif any(keyword in text_upper for keyword in ["CÉDULA", "IDENTIFICACIÓN", "NOMBRE", "FECHA"]):
            return "formato_generico"
        else:
            return "formato_desconocido"

    def _extract_data_based_on_format(self, text, pdf_format):
        """Extrae datos basados en el formato detectado del PDF"""
        if pdf_format == "formato_1":
            return self._extract_formato_1(text)
        elif pdf_format == "formato_2":
            return self._extract_formato_2(text)
        elif pdf_format == "formato_generico":
            return self._extract_formato_generico(text)
        else:
            logging.warning(f"Formato desconocido para el PDF, intentando extracción genérica")
            return self._extract_formato_generico(text)

    def _extract_formato_1(self, text):
        """Extracción para formato 1 (como Santiago Algarin)"""
        data = {}
        # Patrón mejorado que maneja múltiples formatos
        paciente_match = re.search(
            r'PACIENTE[:\s]*([^:\n]+?)\s*(?=(?:EDAD|SEXO|DOCUMENTO|FECHA|\n|$))',
            text,
            re.IGNORECASE
        )
        
        if not paciente_match:
            # Patrón alternativo para formato con nombre en línea independiente
            paciente_match = re.search(
                r'PACIENTE:\s*\n([A-ZÁÉÍÓÚÑ\s]+)\b',
                text,
                re.IGNORECASE
            )
        
        if paciente_match:
            nombre_completo = paciente_match.group(1).strip().upper()
            
            # Limpieza avanzada de texto residual
            nombre_completo = re.sub(
                r'\b(?:DOCUMENTO|CC|PACIENTE|FECHA|EDAD|SEXO|NAC)\b', 
                '', 
                nombre_completo, 
                flags=re.IGNORECASE
            )
            
            # Remover caracteres no válidos y espacios múltiples
            nombre_completo = re.sub(r'[^A-ZÁÉÍÓÚÑ ]', '', nombre_completo)
            nombre_completo = re.sub(r'\s+', ' ', nombre_completo).strip()
            
            # Validación final
            if len(nombre_completo.split()) >= 2:  # Nombre + Apellido
                data['Nombre Completo'] = nombre_completo
            else:
                # Último recurso: extraer toda la línea y tomar las palabras válidas
                line_match = re.search(r'PACIENTE[:\s]*(.*?)\n', text, re.IGNORECASE)
                if line_match:
                    words = [word for word in line_match.group(1).split() 
                            if len(word) > 3 and word.isalpha()]
                    data['Nombre Completo'] = ' '.join(words).upper() if words else "NO DISPONIBLE"
                else:
                    data['Nombre Completo'] = "NO DISPONIBLE"
        else:
            data['Nombre Completo'] = "NO DISPONIBLE"
        
        logging.debug(f"Texto analizado: {text[:500]}")
        logging.debug(f"Match encontrado: {paciente_match.group(0) if paciente_match else 'Ninguno'}")

        # Cédula
        documento_match = re.search(r'DOCUMENTO[:\s]*CC[:\s]*(\d+)', text, re.IGNORECASE)
        if documento_match:
            data['No. Identificación'] = documento_match.group(1).strip()

        # Fecha de nacimiento
        fecha_nac_match = re.search(r'FECHA\s*(?:DE)?\s*NAC[:\s]*([\d/-]+)', text, re.IGNORECASE)
        if fecha_nac_match:
            data['Fecha Nac'] = self._format_date(fecha_nac_match.group(1).strip())

        # Edad
        edad_match = re.search(r'EDAD[:\s]*(\d+)', text, re.IGNORECASE)
        if edad_match:
            data['Edad'] = edad_match.group(1).strip()

        # Sexo
        sexo_match = re.search(r'SEXO[:\s]*([A-Za-zÁ-Úá-ú]+)', text, re.IGNORECASE)
        if sexo_match:
            data['Sexo'] = sexo_match.group(1).strip().capitalize()

        # Afiliación
        afiliacion_match = re.search(
            r'AFILIACI[OÓ]N[:\s]*(.*?)(?=\s*(?:ACOMPAÑANTE|MOVIL|TELEFONO|$))',
            text,
            re.IGNORECASE | re.DOTALL  # Permitir múltiples líneas
        )
        if afiliacion_match:
            afiliacion = afiliacion_match.group(1).strip()
            # Limpiar texto residual y normalizar
            afiliacion = re.sub(r'\n', ' ', afiliacion)  # Reemplazar saltos de línea
            afiliacion = re.sub(r'\s+', ' ', afiliacion)  # Eliminar espacios múltiples
            data['Afiliación'] = self._process_afiliacion(afiliacion)

        # Estado civil
        estado_civil_match = re.search(r'ESTADO\s*CIVIL[:\s]*(.*?)(?:\n|$)', text, re.IGNORECASE)
        if estado_civil_match:
            data['Estado civil'] = estado_civil_match.group(1).strip().capitalize()

        # Evaluación ocupacional
        evaluacion_match = re.search(r'Evaluaci[óo]n\s*Ocupacional[:\s]*([^:\n]+?)(?=\s*Fecha\s*de\s*atenci[óo]n:|$)', text, re.IGNORECASE)
        if evaluacion_match:
            data['Evaluación Ocupacional'] = evaluacion_match.group(1).strip().upper()

        # Fecha de atención
        fecha_atencion_match = re.search(r'Fecha\s*de\s*atenci[óo]n[:\s]*([\d/-]+)', text, re.IGNORECASE)
        if fecha_atencion_match:
            data['Fecha de Atención'] = self._format_date(fecha_atencion_match.group(1).strip())

        # Cargo
        cargo_match = re.search(r'Cargo[:\s]*([^:\n]+?)(?:\s*Fecha\s*de\s*atenci[óo]n:|$)', text, re.IGNORECASE)
        if cargo_match:
            data['Cargo'] = cargo_match.group(1).strip().upper()

        # Exámenes realizados
        examenes_match = re.search(r'EX[ÁA]MENES\s*REALIZADOS[:\s]*(.*?)(?=RECOMENDACIONES|$)', text, re.DOTALL | re.IGNORECASE)
        if examenes_match:
            data['Exámenes realizados'] = examenes_match.group(1).strip().upper()

        # Recomendaciones laborales
        recomendaciones_match = re.search(r'RECOMENDACIONES\s*LABORALES[:\s]*(.*?)(?=MANEJO\s*EPS/ARL|$)', text, re.DOTALL | re.IGNORECASE)
        if recomendaciones_match:
            data['Recomendaciones Laborales'] = recomendaciones_match.group(1).strip().upper()

        # Incluir SVE - Buscar solo valores válidos
        sve_match = re.search(
            r'Incluir\s*SVE[:\s]*([^\n:]+?)(?=\s*(?:RESTRICCIONES|Concepto|$))', 
            text, 
            re.IGNORECASE
        )
        if sve_match and sve_match.group(1).strip() and not sve_match.group(1).strip().startswith("RESTRICCIONES"):
            data['Incluir SVE'] = sve_match.group(1).strip().upper()
        else:
            data['Incluir SVE'] = "NINGUNO"

        # Restricciones laborales
        restricciones_match = re.search(r'RESTRICCIONES\s*LABORALES[:\s]*(.*?)(?=Para\s*la\s*revisi[óo]n|CONCEPTO|$)', text, re.DOTALL | re.IGNORECASE)
        if restricciones_match:
            data['Restricciones Laborales'] = restricciones_match.group(1).strip() or "NINGUNO"

        # Concepto médico - Buscar la ÚLTIMA ocurrencia válida
        concepto_matches = re.findall(
            r'Concepto\s*Medico[:\s]*((?!LEVANTAMIENTO)[^:\n]+)', 
            text, 
            re.IGNORECASE
        )
        if concepto_matches:
            # Tomar el último valor válido (ignorando encabezados)
            data['Concepto Medico'] = concepto_matches[-1].strip().upper()
        else:
            data['Concepto Medico'] = "NINGUNO"

        # Concepto manipulación alimentos
        alimentos_match = re.search(r'Concepto\s*Manipulaci[óo]n\s*Alimento[:\s]*(.*?)(?:\n|$)', text, re.IGNORECASE)
        if alimentos_match:
            data['Concepto Manipulación Alimento'] = alimentos_match.group(1).strip() or "NINGUNO"

        # Concepto altura
        altura_match = re.search(r'Concepto\s*Altura[:\s]*(.*?)(?:\n|$)', text, re.IGNORECASE)
        if altura_match:
            data['Concepto Altura'] = altura_match.group(1).strip() or "NINGUNO"

        # Concepto de trabajo en espacios confinados - Buscar solo valores válidos
        espacios_match = re.search(
            r'Concepto\s*de\s*trabajo\s*en\s*espacios\s*confinados[:\s]*([^\n:]+?)(?=\s*(?:MOTIVO|$))', 
            text, 
            re.IGNORECASE
        )
        if espacios_match and espacios_match.group(1).strip() and not espacios_match.group(1).strip().startswith("MOTIVO"):
            data['Concepto de trabajo en espacios confinados'] = espacios_match.group(1).strip().upper()
        else:
            data['Concepto de trabajo en espacios confinados'] = "NINGUNO"

        # Motivo de restricción - Buscar la ÚLTIMA ocurrencia
        motivo_matches = re.findall(
            r'MOTIVO\s*DE\s*RESTRICCI[OÓ]N[:\s]*(.*?)(?=FIRMA|$)',
            text,
            re.IGNORECASE | re.DOTALL
        )
        if motivo_matches:
            # Tomar el último match y limpiarlo
            motivo = motivo_matches[-1].strip()
            # Si está vacío o es texto no relevante, usar "NINGUNO"
            if not motivo or "Página" in motivo:
                data['Motivo de Restricción'] = "NINGUNO"
            else:
                data['Motivo de Restricción'] = motivo
        else:
            data['Motivo de Restricción'] = "NINGUNO"

        return data

    def _extract_formato_2(self, text):
        """Extracción para formato 2 (como Ortiz Galindo)"""
        data = {}
        # Nombre Completo
        nombre_match = re.search(r'Nombre\s*Completo[:\s]*(.*?)(?:\n|$)', text, re.IGNORECASE)
        if nombre_match:
            data['Nombre Completo'] = nombre_match.group(1).strip().upper()

        # Cédula
        identificacion_match = re.search(r'(?:No\.|N[úu]mero)\s*Identificaci[óo]n[:\s]*(?:CC\s*-\s*)?(\d+)', text, re.IGNORECASE)
        if identificacion_match:
            data['No. Identificación'] = identificacion_match.group(1).strip()

        # Fecha de nacimiento
        fecha_nac_match = re.search(r'Fecha\s*Nac[:\s]*([\d/-]+)', text, re.IGNORECASE)
        if fecha_nac_match:
            data['Fecha Nac'] = self._format_date(fecha_nac_match.group(1).strip())

        # Edad
        edad_match = re.search(r'Edad[:\s]*(\d+)', text, re.IGNORECASE)
        if edad_match:
            data['Edad'] = edad_match.group(1).strip()

        # Sexo
        sexo_match = re.search(r'Sexo[:\s]*(.*?)(?:\n|$)', text, re.IGNORECASE)
        if sexo_match:
            data['Sexo'] = sexo_match.group(1).strip().capitalize()

        # Afiliación
        afiliacion_match = re.search(r'Afiliaci[óo]n[:\s]*(.*?)(?:\n|$)', text, re.IGNORECASE)
        if afiliacion_match:
            afiliacion = afiliacion_match.group(1).strip()
            data['Afiliación'] = self._process_afiliacion(afiliacion)

        # Estado civil
        estado_civil_match = re.search(r'Estado\s*civil[:\s]*(.*?)(?:\n|$)', text, re.IGNORECASE)
        if estado_civil_match:
            data['Estado civil'] = estado_civil_match.group(1).strip().capitalize()

        # Evaluación ocupacional
        evaluacion_match = re.search(r'Evaluaci[óo]n\s*Ocupacional[:\s]*([^:\n]+?)(?=\s*Fecha\s*de\s*atenci[óo]n:|$)', text, re.IGNORECASE)
        if evaluacion_match:
            data['Evaluación Ocupacional'] = evaluacion_match.group(1).strip().upper()

        # Fecha de atención
        fecha_atencion_match = re.search(r'Fecha\s*de\s*atenci[óo]n[:\s]*([\d/-]+)', text, re.IGNORECASE)
        if fecha_atencion_match:
            data['Fecha de Atención'] = self._format_date(fecha_atencion_match.group(1).strip())

        # Cargo
        cargo_match = re.search(r'Cargo[:\s]*([^:\n]+?)(?:\s*Fecha\s*de|$)', text, re.IGNORECASE)
        if cargo_match:
            data['Cargo'] = cargo_match.group(1).strip().upper()

        # Exámenes realizados
        examenes_match = re.search(r'EX[ÁA]MENES\s*REALIZADOS[:\s]*(.*?)(?=RECOMENDACIONES|$)', text, re.DOTALL | re.IGNORECASE)
        if examenes_match:
            data['Exámenes realizados'] = examenes_match.group(1).strip().upper()

        # Recomendaciones laborales
        recomendaciones_match = re.search(r'RECOMENDACIONES\s*LABORALES[:\s]*(.*?)(?=MANEJO\s*EPS/ARL|$)', text, re.DOTALL | re.IGNORECASE)
        if recomendaciones_match:
            data['Recomendaciones Laborales'] = recomendaciones_match.group(1).strip().upper()

        # Incluir SVE
        sve_match = re.search(r'Incluir\s*SVE[:\s]*(.*?)(?:\n|$)', text, re.IGNORECASE)
        if sve_match:
            data['Incluir SVE'] = sve_match.group(1).strip() or "NINGUNO"

        # Restricciones laborales
        restricciones_match = re.search(r'RESTRICCIONES\s*LABORALES[:\s]*(.*?)(?=Para\s*la\s*revisi[óo]n|CONCEPTO|$)', text, re.DOTALL | re.IGNORECASE)
        if restricciones_match:
            data['Restricciones Laborales'] = restricciones_match.group(1).strip() or "NINGUNO"

        # Concepto médico
        concepto_match = re.search(r'Concepto\s*Medico[:\s]*([^:\n]+)', text, re.IGNORECASE)
        if concepto_match:
            data['Concepto Medico'] = concepto_match.group(1).strip().upper()

        # Concepto manipulación alimentos
        alimentos_match = re.search(r'Concepto\s*Manipulaci[óo]n\s*Alimento[:\s]*(.*?)(?:\n|$)', text, re.IGNORECASE)
        if alimentos_match:
            data['Concepto Manipulación Alimento'] = alimentos_match.group(1).strip() or "NINGUNO"

        # Concepto altura
        altura_match = re.search(r'Concepto\s*Altura[:\s]*(.*?)(?:\n|$)', text, re.IGNORECASE)
        if altura_match:
            data['Concepto Altura'] = altura_match.group(1).strip() or "NINGUNO"

        # Concepto espacios confinados
        espacios_match = re.search(r'Concepto\s*de\s*trabajo\s*en\s*espacios\s*confinados[:\s]*(.*?)(?:\n|$)', text, re.IGNORECASE)
        if espacios_match:
            data['Concepto de trabajo en espacios confinados'] = espacios_match.group(1).strip() or "NINGUNO"

        # Motivo de restricción
        motivo_match = re.search(r'MOTIVO\s*DE\s*RESTRICCI[OÓ]N[:\s]*(.*?)(?=FIRMA|$)', text, re.DOTALL | re.IGNORECASE)
        if motivo_match:
            data['Motivo de Restricción'] = motivo_match.group(1).strip() or "NINGUNO"

        return data

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
                'processor': lambda x: self._format_date(x.strip(), 'YYYY/MM/DD') if x else ""
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
                'processor': lambda x: self._format_date(x.strip(), 'YYYY/MM/DD') if x else ""
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
                'processor': lambda x: x.strip().upper() if x else ""
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
                'pattern': r'MOTIVO\s*DE\s*RESTRICCI[OÓ]N[:\s]*(.*?)(?=\nFIRMA|\Z)',
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
        """Realiza post-procesamiento en los datos extraídos"""
        # Corregir nombre si contiene SEXO
        if data.get('Nombre Completo') and 'SEXO:' in data['Nombre Completo'].upper():
            data['Nombre Completo'] = data['Nombre Completo'].split('SEXO:')[0].strip()

        # Extraer valores razonables de edad
        if data.get('Edad') and isinstance(data['Edad'], str):
            edad_match = re.search(r'(\d+)', data['Edad'])
            if edad_match:
                data['Edad'] = edad_match.group(1)

        # Manejar formatos de Estado Civil
        if data.get('Estado civil'):
            if 'UNION LIBRE' in data['Estado civil'].upper():
                data['Estado civil'] = 'Union'
            elif 'SOLTERO' in data['Estado civil'].upper():
                data['Estado civil'] = 'Soltero'

        # Garantizar que los campos requeridos estén en mayúscula
        for field in ['Evaluación Ocupacional', 'Cargo', 'Concepto Medico']:
            if data.get(field):
                data[field] = data[field].upper()

        # Verificar si "Evaluación Ocupacional" contiene "FECHA DE ATENCIÓN"
        if data.get('Evaluación Ocupacional') and 'FECHA DE ATENCIÓN' in data['Evaluación Ocupacional'].upper():
            data['Evaluación Ocupacional'] = data['Evaluación Ocupacional'].split('FECHA DE ATENCIÓN')[0].strip()

        # Limpieza adicional de campos críticos
        for field in ['Concepto Medico', 'Motivo de Restricción']:
            if field in data:
                # Eliminar valores que son encabezados
                if "OCUPACIONAL:" in data[field] or "RESTRICCI" in data[field]:
                    data[field] = "NINGUNO"
        
        # Validación especial para "Concepto Medico"
        if data.get('Concepto Medico') == "OCUPACIONAL":
            data['Concepto Medico'] = "NINGUNO"

        # Limpieza específica para campos problemáticos
        problematic_fields = [
            'Incluir SVE', 
            'Concepto de trabajo en espacios confinados',
            'Restricciones Laborales',
            'Motivo de Restricción'
        ]
        
        for field in problematic_fields:
            if field in data:
                value = data[field].strip()
                # Eliminar valores que son encabezados
                if any(keyword in value for keyword in ["RESTRICCIONES", "MOTIVO", "CONCEPTO"]):
                    data[field] = "NINGUNO"
                
                # Normalizar valores vacíos
                if value in [":", "-", "N/A", "NA"]:
                    data[field] = "NINGUNO"
        
        # Validación especial para campos médicos
        for field in ['Concepto Medico', 'Incluir SVE']:
            if data.get(field) == "OCUPACIONAL":
                data[field] = "NINGUNO"

        return data

    def _process_afiliacion(self, value):
        if not value:
            return ""
        
        value = re.sub(r'\s+', ' ', value).strip().upper()
        
        # Mapeo de variaciones comunes
        empresas_map = {
            "TEMPOACTIVA": ["TEMPOACTIVA", "TEMPO ACTIVA"],
            "TEMPOSUM": ["TEMPOSUM", "TEMPO SUM"],
            "ASEPLUS": ["ASEPLUS", "ASE PLUS"],
            "ASEL": ["ASEL", "ASEL S.A.S"],
            "COMFAMILIAR": ["COMFAMILIAR", "COMFAMILIA", "CAJACOMFAMILIAR"]
        }
        
        for empresa, variantes in empresas_map.items():
            for variante in variantes:
                if variante in value:
                    return empresa
        
        # Búsqueda por siglas conocidas
        siglas_match = re.search(r'\b([A-Z]{4,})\b', value)
        if siglas_match:
            return siglas_match.group(1)
        
        return "NO DISPONIBLE"

    def _process_cargo(self, value):
        """Procesa el campo de cargo"""
        if not value:
            return ""
        value = value.strip().upper()
        value = re.sub(r'FECHA\s*DE\s*ATENCI[ÓO]N.*', '', value, flags=re.IGNORECASE).strip()
        return value

    def _validate_critical_data(self, data, pdf_path):
        """Valida datos críticos con manejo más suave"""
        required_fields = {
            'No. Identificación': f"Cédula no encontrada en el PDF {pdf_path.name}",
            'Nombre Completo': f"Nombre no encontrado en el PDF {pdf_path.name}",
            'Fecha de Atención': f"Fecha de atención no encontrada en el PDF {pdf_path.name}"
        }
        errors = []
        for field, message in required_fields.items():
            if not data.get(field):
                data[field] = "NO_DISPONIBLE"  # Valor predeterminado
                errors.append(message)
        if errors:
            error_msg = f"Errores en la extracción de datos: {', '.join(errors)}"
            logging.error(error_msg)
            # No lanzar excepción, permitir que continúe con valores predeterminados
            # raise ValueError(error_msg)

    def _format_date(self, date_str, output_format='YYYY/MM/DD'):
        """Formatea fechas"""
        if not date_str:
            return ""
        date_formats = ['%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%Y/%m/%d']
        for fmt in date_formats:
            try:
                date_obj = datetime.strptime(date_str, fmt)
                return date_obj.strftime('%Y/%m/%d')
            except ValueError:
                continue
        logging.warning(f"No se pudo formatear la fecha: {date_str}")
        return date_str

# Clase ExcelHandler para manejar archivos Excel
class ExcelHandler:
    def update_control_file(self, data, control_path):
        try:
            control_path = Path(control_path)
            logging.info(f"Actualizando archivo de control: {control_path}")

            if not data.get('No. Identificación') or not data.get('Fecha de Atención'):
                error_msg = "Cédula o fecha de atención no válidos en los datos extraídos"
                logging.error(error_msg)
                raise ValueError(error_msg)

            data_date = pd.to_datetime(data['Fecha de Atención'], format='%Y/%m/%d', errors='coerce')
            if pd.isna(data_date):
                error_msg = f"Fecha de atención inválida: {data['Fecha de Atención']}"
                logging.error(error_msg)
                raise ValueError(error_msg)

            if not control_path.exists():
                logging.info(f"Archivo de control no existe. Creando nuevo en: {control_path}")
                df = pd.DataFrame(columns=Config.COLUMNAS_CONTROL)
                header_row = 6
            else:
                try:
                    df = pd.read_excel(control_path, engine='openpyxl', header=6, dtype={'No. Identificación': str})
                    header_row = 6
                    logging.info(f"Archivo de control leído con encabezados en la fila 7: {control_path}")
                except ValueError:
                    df = pd.read_excel(control_path, engine='openpyxl', header=None, dtype={'No. Identificación': str})
                    header_row = 6
                    df.columns = Config.COLUMNAS_CONTROL
                    df = df.iloc[header_row + 1:].reset_index(drop=True)
                    logging.info(f"Encabezados ajustados en la fila {header_row + 1}.")

            df = df.dropna(how='all')
            if not df.empty:
                df['No. Identificación'] = df['No. Identificación'].astype(str).str.replace(r'\\.0$', '', regex=True).str.strip()
                if 'Fecha de Atención' in df.columns:
                    df['Fecha de Atención'] = pd.to_datetime(df['Fecha de Atención'], format='%Y/%m/%d', errors='coerce')

            if 'Item' in df.columns and not df['Item'].isnull().all():
                max_item = df['Item'].dropna().astype(int).max()
                new_item = max_item + 1
            else:
                new_item = 1

            data_id = str(data['No. Identificación']).strip()
            same_person = (df['No. Identificación'] == data_id) & (df['Fecha de Atención'] == data_date)

            new_row_data = {'Item': new_item}
            new_row_data.update({col: data.get(col, '') for col in Config.COLUMNAS_CONTROL if col != 'Item'})
            new_row_data['No. Identificación'] = str(new_row_data['No. Identificación']).replace('.0', '')

            if same_person.any():
                idx = df[same_person].index[0]
                for col, value in new_row_data.items():
                    if col in data and data[col]:
                        # Cast value to match column dtype
                        if col == 'Edad' and value:
                            try:
                                value = int(value)  # Convert to int for Edad
                            except (ValueError, TypeError):
                                value = pd.NA
                        elif df[col].dtype in ['int64', 'float64'] and value:
                            try:
                                value = pd.to_numeric(value, errors='coerce')  # Convert to numeric if column is numeric
                                if pd.isna(value):
                                    value = pd.NA
                            except (ValueError, TypeError):
                                value = pd.NA
                        elif df[col].dtype == 'object':
                            value = str(value)  # Ensure string for object columns
                        df.loc[idx, col] = value
                action = "actualizado"
                row_number = idx + header_row + 2
            else:
                new_row = pd.Series(new_row_data)
                df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
                row_number = len(df) + header_row + 1
                action = f"añadido en la fila {row_number}"

            with pd.ExcelWriter(control_path, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, header=True, startrow=header_row)
                logging.info(f"Archivo de control {action}: {control_path}")

            return str(control_path)

        except Exception as e:
            logging.error(f"Error al actualizar archivo de control: {str(e)}")
            logging.debug(traceback.format_exc())
            raise

# Clase DocumentGenerator para generar documentos Word
class DocumentGenerator:
    def generate_remision(self, data, template_path, output_dir):
        try:
            template_path = Path(template_path)
            if not template_path.exists():
                raise FileNotFoundError(f"Plantilla no encontrada: {template_path}")

            if template_path.suffix.lower() not in ['.doc', '.docx']:
                raise ValueError(f"La plantilla debe ser un archivo .doc o .docx: {template_path}")

            doc = DocxTemplate(template_path)
            context = {
                'fecha': datetime.now().strftime('%d/%m/%Y'),
                'nombre_destinatario': data.get('Nombre Completo', 'N/A'),
                'cc': data.get('No. Identificación', 'N/A'),
                'cargo': data.get('Cargo', 'N/A'),
                'evaluación_ocupacional': data.get('Evaluación Ocupacional', 'N/A'),
                'recomendaciones_laborales': data.get('Recomendaciones Laborales', 'N/A')
            }

            for key, value in context.items():
                if value == 'N/A' and key in ['nombre_destinatario', 'cc', 'evaluación_ocupacional', 'recomendaciones_laborales']:
                    context[key] = "Información no disponible"

            doc.render(context)

            output_dir = Path(output_dir)
            output_dir.mkdir(parents=True, exist_ok=True)

            fecha = datetime.now().strftime('%Y%m%d')
            nombre_sanitizado = self._sanitize_filename(data.get('Nombre Completo', 'sin_nombre'))
            output_path = output_dir / f"GI-OD-007 REMISION A EPS {nombre_sanitizado} {fecha}.docx"

            counter = 1
            while output_path.exists():
                output_path = output_dir / f"GI-OD-007 REMISION A EPS {nombre_sanitizado} {fecha}_{counter}.docx"
                counter += 1

            doc.save(output_path)
            logging.info(f"Documento creado: {output_path}")
            return str(output_path)

        except Exception as e:
            logging.error(f"Error en generate_remision: {str(e)}")
            logging.debug(traceback.format_exc())
            raise

    def _sanitize_filename(self, filename):
        if not filename:
            return "sin_nombre"
        valid_filename = re.sub(r'[<>:"/\\\\|?*]', '_', filename)
        valid_filename = valid_filename.replace(' ', '_')
        valid_filename = ''.join(c for c in unicodedata.normalize('NFD', valid_filename)
                                 if unicodedata.category(c) != 'Mn')
        return valid_filename

# Clase CacheManager para gestionar caché
class CacheManager:
    def __init__(self, cache_file=None):
        self.cache_file = cache_file or Config.CACHE_FILE
        self._load_cache()

    def _load_cache(self):
        try:
            cache_path = Path(self.cache_file)
            if cache_path.exists():
                with open(cache_path, "r", encoding="utf-8") as f:
                    self.cache = json.load(f)
                logging.info(f"Caché cargada desde {self.cache_file}")
            else:
                self.cache = {}
                logging.info("Caché inicializada (nueva, archivo no encontrado)")
        except Exception as e:
            logging.error(f"Error al cargar caché: {str(e)}")
            self.cache = {}

    def _save_cache(self):
        try:
            with open(self.cache_file, "w") as f:
                json.dump(self.cache, f, indent=2)
            logging.info(f"Caché guardada en {self.cache_file}")
        except Exception as e:
            logging.error(f"Error al guardar caché: {str(e)}")

    def check_cache(self, pdf_path):
        pdf_hash = self._get_file_hash(pdf_path)
        if pdf_hash in self.cache:
            logging.info(f"Archivo encontrado en caché: {pdf_path}")
            return self.cache[pdf_hash]
        logging.info(f"Archivo no encontrado en caché: {pdf_path}")
        return None

    def update_cache(self, pdf_path, output_paths):
        pdf_hash = self._get_file_hash(pdf_path)
        self.cache[pdf_hash] = output_paths
        self._save_cache()
        logging.info(f"Caché actualizada para {pdf_path}")

    def _get_file_hash(self, file_path):
        try:
            import hashlib
            file_path = Path(file_path)
            stats = file_path.stat()
            unique_id = f"{file_path}|{stats.st_size}|{stats.st_mtime}"
            with open(file_path, "rb") as f:
                file_hash = hashlib.md5(f.read()).hexdigest()
            return f"{file_hash}|{unique_id}"
        except Exception as e:
            logging.error(f"Error al generar hash para {file_path}: {str(e)}")
            return str(file_path)

    def remove_from_cache(self, pdf_path):
        pdf_hash = self._get_file_hash(pdf_path)
        if pdf_hash in self.cache:
            del self.cache[pdf_hash]
            self._save_cache()
            logging.info(f"Archivo {pdf_path} eliminado del caché")

class WhatsAppSender:
    def send_message(self, phone_number, message, file_path=None):
        try:
            # Copiar el mensaje al portapapeles
            pyperclip.copy(message)
            logging.info("Mensaje copiado al portapapeles.")

            # Codificar el mensaje para URL
            encoded_message = quote(message)
            url = f"https://api.whatsapp.com/send?phone={phone_number}&text={encoded_message}" #si quieres que se abra en el navegador cambia api a web.
            
            webbrowser.open(url)

                        # Abrir el archivo en el navegador para facilitar el adjunto
            if file_path and Path(file_path).exists():
                os.startfile(file_path)

                # 2. Abrir carpeta contenedora del archivo automáticamente
                folder_path = os.path.dirname(file_path)
                os.startfile(folder_path)  # Windows
                # Para Linux/Mac: os.system(f'open "{folder_path}"')

            logging.info(f"Mensaje de WhatsApp enviado a y carpeta de archivo abierto para {phone_number}")
        except Exception as e:
            logging.error(f"Error al enviar WhatsApp: {str(e)}")
            raise

# Clase EmailSender para enviar correos electrónicos

class EmailSender:
    """Clase para enviar correos electrónicos con plantillas personalizadas y adjuntos."""
    
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
        "ASEPLUS": {"email": "asepluscaribesas@gmail.com", "password": "yudh myrlpalabras clave zjpk eoej"},
        "ASEL": {"email": "asel.contratacion@gmail.com", "password": "kdyh degt juwf tuqd"}
    }

    def __init__(self, empresa):
        """
        Inicializa el enviador de correos para una empresa específica.
        
        Args:
            empresa (str): Nombre de la empresa (TEMPOACTIVA, TEMPOSUM, etc.)
        """
        self.empresa = empresa.upper()
        self.credenciales = self.CREDENCIALES.get(self.empresa)
        self.plantilla = self.PLANTILLAS.get(self.empresa, self.PLANTILLAS["DEFAULT"])
        self.base_datos = self.BASES_DATOS.get(self.empresa)
        
        if not self.credenciales:
            raise ValueError(f"No hay credenciales configuradas para {self.empresa}")
        
        self.logger = logging.getLogger("EmailSender")

    def obtener_contacto(self, cedula):
        """
        Obtiene la información de contacto de un trabajador desde la base de datos.
        
        Args:
            cedula (str): Número de identificación del trabajador
            
        Returns:
            tuple: (telefono, email) o (None, None) si no se encuentra
        """
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
        """
        Envía un correo electrónico con un documento adjunto.
        
        Args:
            destinatario (str): Correo electrónico del destinatario
            nombre (str): Nombre del trabajador
            fecha_atencion (str): Fecha de atención médica
            archivo_adjunto (str): Ruta al archivo a adjuntar
            
        Returns:
            bool: True si el envío fue exitoso, False en caso contrario
        """
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
                    f'attachment; filename="{Header(nombre_archivo, "utf-8").encode()}"'
                )
                msg.attach(parte)

            # Enviar correo usando SMTP
            with smtplib.SMTP('smtp.gmail.com', 587) as servidor:
                servidor.starttls()
                servidor.login(self.credenciales["email"], self.credenciales["password"])
                servidor.send_message(msg)
                
            self.logger.info(f"Correo enviado exitosamente a {destinatario}")
            return True
            
        except smtplib.SMTPAuthenticationError:
            self.logger.error("Error de autenticación: Credenciales inválidas")
            return False
        except smtplib.SMTPException as e:
            self.logger.error(f"Error SMTP: {str(e)}")
            return False
        except Exception as e:
            self.logger.error(f"Error inesperado: {str(e)}\n{traceback.format_exc()}")
            return False

# Clase principal de la aplicación
class RemisionesApp(ttk.Window):
    
        
    def __init__(self):
        super().__init__(themename="flatly")
        self.title("Sistema de Gestión de Remisiones EPS")
        self.geometry("800x650")
        
        Config.load_from_file()
        self.pdf_processor = PdfProcessor()
        self.excel_handler = ExcelHandler()
        self.doc_generator = DocumentGenerator()
        self.cache_manager = CacheManager()
        self.whatsapp_sender = WhatsAppSender()
        # ELIMINADO: self.email_sender = ... 

        self.pdf_path = StringVar()
        self.template_path = StringVar(value=str(Config.RUTAS["TEMPOACTIVA"]["plantilla"]))
        self.output_path = StringVar(value=str(Config.RUTAS["TEMPOACTIVA"]["remisiones"]))
        self.processing = BooleanVar(value=False)
        self.extracted_data = {}
        self.empresa = StringVar(value="TEMPOACTIVA")
        self.last_generated_doc = None

        self._create_widgets()
        self.stats = {"processed": 0, "errors": 0, "cached": 0}

    def _create_widgets(self):
        main_frame = ttk.Frame(self)
        main_frame.grid(row=0, column=0, sticky=NSEW, padx=10, pady=10)
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)

        main_frame.grid_rowconfigure(0, weight=0)
        main_frame.grid_rowconfigure(1, weight=0)
        main_frame.grid_rowconfigure(2, weight=3)
        main_frame.grid_rowconfigure(3, weight=1)
        main_frame.grid_rowconfigure(4, weight=0)
        main_frame.grid_columnconfigure(0, weight=1)

        header_frame = ttk.Frame(main_frame)
        header_frame.grid(row=0, column=0, sticky=EW, pady=5)
        ttk.Label(header_frame, text="SISTEMA DE GESTIÓN DE REMISIONES EPS",
                  font=("TkDefaultFont", 16, "bold")).pack(side=LEFT, padx=5)

        file_frame = ttk.LabelFrame(main_frame, text="Selección de Archivos")
        file_frame.grid(row=1, column=0, sticky=EW, pady=5)

        pdf_row = ttk.Frame(file_frame)
        pdf_row.pack(fill=X, pady=3)
        ttk.Label(pdf_row, text="Archivo PDF:").pack(side=LEFT, padx=5)
        ttk.Entry(pdf_row, textvariable=self.pdf_path, width=64).pack(side=LEFT, padx=5, fill=X, expand=YES)
        ttk.Button(pdf_row, text="Buscar", command=self._browse_pdf).pack(side=LEFT, padx=5)
        ttk.Button(pdf_row, text="Procesar", command=self._process_pdf, bootstyle=SUCCESS).pack(side=LEFT, padx=5)

        template_row = ttk.Frame(file_frame)
        template_row.pack(fill=X, pady=3)
        ttk.Label(template_row, text="Plantilla:").pack(side=LEFT, padx=5)
        ttk.Entry(template_row, textvariable=self.template_path, width=64).pack(side=LEFT, padx=5, fill=X, expand=YES)
        ttk.Button(template_row, text="Buscar", command=self._browse_template).pack(side=LEFT, padx=5)

        output_row = ttk.Frame(file_frame)
        output_row.pack(fill=X, pady=3)
        ttk.Label(output_row, text="Carpeta de salida:").pack(side=LEFT, padx=5)
        ttk.Entry(output_row, textvariable=self.output_path, width=64).pack(side=LEFT, padx=5, fill=X, expand=YES)
        ttk.Button(output_row, text="Buscar", command=self._browse_output).pack(side=LEFT, padx=5)

        empresa_row = ttk.Frame(file_frame)
        empresa_row.pack(fill=X, pady=3)
        ttk.Label(empresa_row, text="Empresa:").pack(side=LEFT, padx=5)
        empresa_combo = ttk.Combobox(empresa_row, textvariable=self.empresa,
                                     values=list(Config.RUTAS.keys()), state="readonly")
        empresa_combo.pack(side=LEFT, padx=5)
        empresa_combo.bind('<<ComboboxSelected>>', self._update_paths)

        send_buttons_row = ttk.Frame(file_frame)
        send_buttons_row.pack(fill=X, pady=3)
        self.send_whatsapp_btn = ttk.Button(send_buttons_row, text="Enviar por WhatsApp",
                                            command=self._send_whatsapp, state=DISABLED, bootstyle=INFO)
        self.send_whatsapp_btn.pack(side=LEFT, padx=5)
        self.send_email_btn = ttk.Button(send_buttons_row, text="Enviar por Correo",
                                         command=self._send_email, state=DISABLED, bootstyle=INFO)
        self.send_email_btn.pack(side=LEFT, padx=5)

        data_frame = ttk.LabelFrame(main_frame, text="Datos Extraídos")
        data_frame.grid(row=2, column=0, sticky=NSEW, pady=5)
        self.scrolled_frame = ScrolledFrame(data_frame, autohide=False)
        self.scrolled_frame.pack(fill=BOTH, expand=YES, padx=5, pady=5)
        self.scrolled_frame.container.config(height=200)

        self.data_widgets = {}

        results_frame = ttk.LabelFrame(main_frame, text="Resultados")
        results_frame.grid(row=3, column=0, sticky=NSEW, pady=5)
        self.results_text = ttk.Text(results_frame, height=4, width=64, wrap=WORD)
        self.results_text.pack(fill=BOTH, expand=YES, padx=5, pady=3)

        status_frame = ttk.Frame(main_frame)
        status_frame.grid(row=5, column=0, sticky=EW, pady=5)
        self.status_label = ttk.Label(status_frame, text="Listo")
        self.status_label.pack(side=LEFT, padx=5)

        batch_frame = ttk.LabelFrame(main_frame, text="Procesamiento en Lote")
        batch_frame.grid(row=4, column=0, sticky=EW, pady=3)
        ttk.Button(batch_frame, text="Procesar Carpeta",
                   command=self._batch_process,
                   bootstyle=WARNING).pack(padx=5, pady=3)

    def _update_paths(self, event=None):
        empresa = self.empresa.get()
        if empresa in Config.RUTAS:
            rutas = Config.RUTAS[empresa]
            self.template_path.set(str(rutas["plantilla"]))
            self.output_path.set(str(rutas["remisiones"]))
            self.log_message(f"Rutas actualizadas para {empresa}")

    def _browse_pdf(self):
        file = filedialog.askopenfilename(
            title="Seleccionar PDF",
            filetypes=[("Archivos PDF", "*.pdf")]
        )
        if file:
            self.cache_manager.remove_from_cache(file)
            self.pdf_path.set(file)
            self.log_message(f"Archivo seleccionado: {file}")
            self._clear_displayed_data()
            self.send_whatsapp_btn.config(state=DISABLED)
            self.send_email_btn.config(state=DISABLED)

    def _browse_template(self):
        file = filedialog.askopenfilename(
            title="Seleccionar Plantilla",
            filetypes=[("Archivos Word", "*.doc;*.docx")]
        )
        if file:
            self.template_path.set(file)
            self.log_message(f"Plantilla seleccionada: {file}")

    def _browse_output(self):
        folder = filedialog.askdirectory(
            title="Seleccionar Carpeta de Salida"
        )
        if folder:
            self.output_path.set(folder)
            self.log_message(f"Carpeta de salida: {folder}")

    def _process_pdf(self):
        if not self.pdf_path.get():
            if self.winfo_exists():
                try:
                    messagebox.showerror("Error", "Por favor seleccione un archivo PDF")
                except Exception:
                    pass
            return
        self.processing.set(True)
        if self.winfo_exists():
            try:
                self.status_label.config(text="Procesando...")
                self.update_idletasks()
            except Exception:
                pass
        threading.Thread(target=self._process_pdf_thread, daemon=True).start()

    def _process_pdf_thread(self):
        try:
            pdf_path = Path(self.pdf_path.get())
            template_path = Path(self.template_path.get())
            output_dir = Path(self.output_path.get())

            # Punto 1: Inicio del procesamiento
            logger.debug(f"Iniciando procesamiento de PDF: {pdf_path}")
            
            cached_result = self.cache_manager.check_cache(pdf_path)
            if cached_result:
                logger.info(f"Archivo encontrado en caché: {pdf_path.name}")
                self.log_message(f"Archivo ya procesado: {pdf_path.name}")
                self.log_message(f"Documento: {cached_result['remision']}")
                self.log_message(f"Control: {cached_result['control']}")
                self.stats["cached"] += 1
                self.last_generated_doc = cached_result['remision']
                if self.winfo_exists():
                    try:
                        self.send_whatsapp_btn.config(state=NORMAL)
                        self.send_email_btn.config(state=NORMAL)
                        if not hasattr(self, '_cache_msg_shown'):
                            self._cache_msg_shown = True
                            if messagebox.askyesno("Archivo en caché", "¿Desea abrir el documento de remisión generado?"):
                                pass
                    except Exception as e:
                        logger.error(f"Error en interfaz de caché: {str(e)}", exc_info=True)
                return

            # Punto 2: Antes de extraer datos
            logger.debug(f"Extrayendo datos de {pdf_path.name}")
            self.log_message(f"Extrayendo datos de {pdf_path.name}...")
            data = self.pdf_processor.extract_pdf_data(pdf_path)
            
            if self.winfo_exists():
                try:
                    self._display_extracted_data(data)
                except Exception as e:
                    logger.error(f"Error al mostrar datos extraídos: {str(e)}", exc_info=True)
            
            self.extracted_data = data

            empresa_seleccionada = self.empresa.get()
            if empresa_seleccionada == "ASEL":
                data["Afiliación"] = "ASEL"
                logger.info("Forzando afiliación a ASEL por selección de empresa")
                self.log_message("Afiliación forzada a 'ASEL' porque la empresa seleccionada es ASEL.")

            empresa_rutas = Config.get_empresa_paths(data.get('Afiliación', ''))
            if empresa_rutas != Config.RUTAS[self.empresa.get()]:
                empresa_detectada = next((k for k, v in Config.RUTAS.items() if v == empresa_rutas), self.empresa.get())
                mensaje = f"Se detectó afiliación a {empresa_detectada}. ¿Desea usar esas rutas?"
                logger.warning(f"Conflicto de rutas: seleccionada {self.empresa.get()}, detectada {empresa_detectada}")
                if self.winfo_exists():
                    try:
                        if messagebox.askyesno("Cambiar empresa", mensaje):
                            self.empresa.set(empresa_detectada)
                            self._update_paths()
                            template_path = Path(self.template_path.get())
                            output_dir = Path(self.output_path.get())
                            empresa_rutas = Config.RUTAS[empresa_detectada]
                    except Exception as e:
                        logger.error(f"Error en diálogo de cambio de empresa: {str(e)}", exc_info=True)

            # Punto 3: Generación de documento
            logger.info("Generando documento de remisión")
            self.log_message("Generando documento de remisión...")
            doc_path = self.doc_generator.generate_remision(data, template_path, output_dir)

            control_path = empresa_rutas["control"]
            logger.info("Actualizando archivo de control")
            self.log_message("Actualizando archivo de control...")
            excel_path = self.excel_handler.update_control_file(data, control_path)

            self.cache_manager.update_cache(pdf_path, {
                "remision": doc_path,
                "control": excel_path
            })
            logger.debug(f"Cache actualizado para {pdf_path.name}")

            # Punto 4: Proceso completado
            logger.info(f"Proceso completado. Documento: {doc_path}, Control: {excel_path}")
            self.log_message("¡Proceso completado exitosamente!")
            self.log_message(f"Documento generado: {doc_path}")
            self.log_message(f"Archivo de control actualizado: {excel_path}")
            self.stats["processed"] += 1
            self.last_generated_doc = doc_path
            
            if self.winfo_exists():
                try:
                    self.send_whatsapp_btn.config(state=NORMAL)
                    self.send_email_btn.config(state=NORMAL)
                    if not hasattr(self, '_done_msg_shown'):
                        self._done_msg_shown = True
                        if messagebox.askyesno("Proceso completado", "¿Desea abrir el documento de remisión generado?"):
                            pass
                except Exception as e:
                    logger.error(f"Error en interfaz post-proceso: {str(e)}", exc_info=True)

        except PermissionError as e:
            error_msg = str(e)
            logger.critical(f"Error de permisos: {error_msg}")
            self.log_message(error_msg, error=True)
            if self.winfo_exists():
                try:
                    messagebox.showerror("Error", error_msg)
                except Exception:
                    pass
            self.stats["errors"] += 1
        except ValueError as e:
            error_msg = str(e)
            logger.error(f"Error de valor: {error_msg}")
            self.log_message(error_msg, error=True)
            if self.winfo_exists():
                try:
                    messagebox.showerror("Error", error_msg)
                except Exception:
                    pass
            self.stats["errors"] += 1
        except Exception as e:
            error_msg = f"Error inesperado al procesar el archivo: {str(e)}\n{traceback.format_exc()}"
            logger.critical(f"Error inesperado: {error_msg}", exc_info=True)
            self.log_message(error_msg, error=True)
            if self.winfo_exists():
                try:
                    messagebox.showerror("Error", f"Error inesperado: {str(e)}")
                except Exception:
                    pass
            self.stats["errors"] += 1
        finally:
            self.processing.set(False)
            logger.debug("Proceso finalizado, reiniciando estado")
            if self.winfo_exists():
                try:
                    self.status_label.config(text="Listo")
                except Exception:
                    pass

    def _get_contact_info(self, empresa, cedula):
        """
        Busca el teléfono y correo del personal según la empresa y cédula.
        Para ASEL, busca en el archivo de personal de ASEL (Excel en la carpeta "G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\2. Temporales Comfa").
        Para otras empresas, busca en la base de datos correspondiente.
        Retorna una tupla: (telefono, correo)
        """
        try:
            cedula = str(cedula).strip()
            import pandas as pd
            if empresa in ["TEMPOACTIVA", "TEMPOSUM", "ASEPLUS"]:
                excel_path = "G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\2. Temporales Comfa\\Base de Datos Personal Temporales.xlsx"
                sheet_name = "COMPLETO"
                df = pd.read_excel(
                    excel_path,
                    sheet_name=sheet_name,
                    dtype=str
                )
                cedula_col = [col for col in df.columns if 'CEDULA' in col.upper()][0]
                celular_col = [col for col in df.columns if 'CELULAR' in col.upper()][0]
                correo_col = [col for col in df.columns if any(kw in col.upper() for kw in ['CORREO', 'EMAIL'])][0]
                row = df[df[cedula_col] == cedula]
                if not row.empty:
                    phone = str(row.iloc[0][celular_col]).strip()
                    email = str(row.iloc[0][correo_col]).strip()
                    phone = f"+57{phone}" if phone and not phone.startswith('+') else phone
                    return phone, email
            elif empresa == "ASEL":
                excel_path = "G:/Mi unidad/2. Trabajo/1. SG-SST/19. Asel S.A.S/Formato - Base de datos personal ASEL.xlsx"
                sheet_name = "FORMATO"
                try:
                    df = pd.read_excel(
                        excel_path,
                        sheet_name=sheet_name,
                        dtype=str
                    )
                    self.log_message(f"Se encontraron {len(df.columns)} columnas y {len(df)} filas en el Excel de ASEL")
                    cedula_cols = [col for col in df.columns if 'CEDULA' in str(col).upper() or 'IDENTIFICACIÓN' in str(col).upper()]
                    celular_cols = [col for col in df.columns if 'CELULAR' in str(col).upper() or 'TELÉFONO' in str(col).upper() or 'TELEFONO' in str(col).upper()]
                    correo_cols = [col for col in df.columns if 'CORREO' in str(col).upper() or 'EMAIL' in str(col).upper()]
                    if cedula_cols and celular_cols:
                        cedula_col = cedula_cols[0]
                        celular_col = celular_cols[0]
                        correo_col = correo_cols[0] if correo_cols else None
                        row = df[df[cedula_col].astype(str).str.strip() == cedula]
                        if not row.empty:
                            phone = str(row.iloc[0][celular_col]).strip()
                            phone = f"+57{phone}" if phone and not phone.startswith('+') else phone
                            email = str(row.iloc[0][correo_col]).strip() if correo_col else None
                            return phone, email
                    if len(df.columns) >= 25:
                        cedula_col = df.columns[3]
                        celular_col = df.columns[24]
                        row = df[df[cedula_col].astype(str).str.strip() == cedula]
                        if not row.empty:
                            phone = str(row.iloc[0][celular_col]).strip()
                            phone = f"+57{phone}" if phone and not phone.startswith('+') else phone
                            return phone, None
                    self.log_message(f"No se encontró información para la cédula {cedula} en ASEL")
                    return None, None
                except Exception as e:
                    self.log_message(f"Error al procesar Excel de ASEL: {str(e)}", error=True)
                    try:
                        df = pd.read_excel(
                            excel_path,
                            sheet_name=sheet_name,
                            usecols=[3, 24],
                            dtype=str
                        )
                        df.columns = ['CEDULA', 'CELULAR']
                        row = df[df['CEDULA'].astype(str).str.strip() == cedula]
                        if not row.empty:
                            phone = str(row.iloc[0]['CELULAR']).strip()
                            phone = f"+57{phone}" if phone and not phone.startswith('+') else phone
                            return phone, None
                    except Exception as sub_e:
                        self.log_message(f"Error alternativo para ASEL: {str(sub_e)}", error=True)
            return None, None
        except Exception as e:
            self.log_message(f"Error al obtener contacto: {str(e)}", error=True)
            return None, None

    def _send_whatsapp(self):
        if not self.last_generated_doc:
            logger.error("Intento de enviar WhatsApp sin documento generado")
            messagebox.showerror("Error", "No hay documento generado para enviar")
            return

        # Obtener datos relevantes
        cedula = self.extracted_data.get('No. Identificación', 'N/A')
        nombre = self.extracted_data.get('Nombre Completo', 'Trabajador')
        fecha_atencion = self.extracted_data.get('Fecha de Atención', 'N/A')
        afiliacion = self.extracted_data.get('Afiliación', self.empresa.get())

        # Punto 1: Inicio del proceso
        logger.info(f"Iniciando envío WhatsApp para {nombre} (Cédula: {cedula})")

        # Construir mensaje estructurado
        mensaje = f"""*Remisión EPS - {afiliacion}*

    *Trabajador:* {nombre}
    *Cédula:* {cedula}
    *Fecha de atención:* {fecha_atencion}

    Adjunto encontrará su documento de remisión EPS con las recomendaciones médicas.

    Por favor:
    1. Revise el documento adjunto ✅
    2. Siga las indicaciones del profesional de salud ✅
    3. Confirme recepción ✅

    _Cualquier duda estamos disponibles para resolverla_"""

        try:
            # Punto 2: Antes de buscar información de contacto
            logger.debug(f"Buscando contacto para cédula {cedula}")
            phone, _ = self._get_contact_info(afiliacion, cedula)
            
            if not phone or phone == "nan":
                logger.error(f"No se encontró teléfono para cédula {cedula}")
                messagebox.showerror("Error", "No se encontró el número de teléfono")
                return

            # Punto 3: Antes de enviar el mensaje
            logger.info(f"Preparando envío WhatsApp a {phone} (Documento: {self.last_generated_doc})")
            
            self.whatsapp_sender.send_message(
                phone_number=phone,
                message=mensaje,
                file_path=self.last_generated_doc
            )

            # Punto 4: Envío exitoso
            logger.info(f"WhatsApp enviado exitosamente a {phone} para {nombre}")

        except Exception as e:
            # Punto 5: Error en el proceso
            logger.error(f"Error al enviar WhatsApp a {cedula}: {str(e)}", exc_info=True)
            messagebox.showerror("Error", f"No se pudo enviar WhatsApp: {str(e)}")
            self.log_message(f"Error en WhatsApp: {str(e)}", error=True)
    def _send_email(self):
        """Envía la remisión por correo electrónico usando la nueva clase EmailSender."""
        if not self.last_generated_doc:
            messagebox.showerror("Error", "No hay documento generado para enviar")
            return

        # Obtener datos relevantes
        afiliacion = self.extracted_data.get('Afiliación', self.empresa.get())
        cedula = self.extracted_data.get('No. Identificación', 'N/A')
        nombre = self.extracted_data.get('Nombre Completo', 'Trabajador')
        fecha_atencion = self.extracted_data.get('Fecha de Atención', 'N/A')

        if not cedula or cedula == "N/A":
            messagebox.showerror("Error", "No se encontró el número de identificación")
            return

        try:
            # Crear instancia de EmailSender para la afiliación correspondiente
            email_sender = EmailSender(afiliacion)
            
            # Obtener información de contacto del trabajador
            telefono, email_destino = email_sender.obtener_contacto(cedula)
            
            if not email_destino:
                messagebox.showerror("Error", "No se encontró el correo electrónico para este trabajador")
                return

            # Enviar el correo con el documento adjunto
            if email_sender.enviar_correo(
                destinatario=email_destino,
                nombre=nombre,
                fecha_atencion=fecha_atencion,
                archivo_adjunto=self.last_generated_doc
            ):
                messagebox.showinfo("Éxito", "Correo enviado correctamente")
                self.log_message(f"Correo enviado a {email_destino}")
            else:
                messagebox.showerror("Error", "No se pudo enviar el correo. Consulte los logs para más detalles.")
                
        except ValueError as e:
            messagebox.showerror("Error", f"Error de configuración: {str(e)}")
            self.log_message(f"Error en configuración de correo: {str(e)}", error=True)
        except Exception as e:
            messagebox.showerror("Error", f"Error inesperado: {str(e)}")
            self.log_message(f"Error al enviar correo: {str(e)}", error=True)

    def _display_extracted_data(self, data):
        for widget in self.data_widgets.values():
            for w in widget:
                w.destroy()
        self.data_widgets = {}

        row = 0
        for key, value in data.items():
            if key in ['archivo_origen', 'fecha_procesamiento']:
                continue
            label = ttk.Label(self.scrolled_frame, text=f"{key}:", anchor=E)
            label.grid(row=row, column=0, sticky=E, padx=5, pady=1)

            if key in ['Recomendaciones Laborales', 'Restricciones Laborales', 'Motivo de Restricción']:
                text = ttk.Text(self.scrolled_frame, height=2, width=50, wrap=WORD)
                text.insert(END, value)
                text.grid(row=row, column=1, sticky=W+E, padx=5, pady=1)
                self.data_widgets[key] = [label, text]
            else:
                var = StringVar(value=value)
                entry = ttk.Entry(self.scrolled_frame, textvariable=var, width=50)
                entry.grid(row=row, column=1, sticky=W+E, padx=5, pady=1)
                self.data_widgets[key] = [label, entry, var]
            row += 1

    def _clear_displayed_data(self):
        # Solo destruir los widgets (Label, Entry, Text), no las StringVar
        for widgets in self.data_widgets.values():
            for widget in widgets:
                if isinstance(widget, (ttk.Label, ttk.Entry, ttk.Text)):
                    widget.destroy()
        self.data_widgets = {}
        self.results_text.delete(1.0, END)

    def log_message(self, message, error=False):
        timestamp = datetime.now().strftime('%H:%M:%S')
        prefix = "[ERROR]" if error else "[INFO]"
        formatted_message = f"{timestamp} {prefix} {message}\n"
        
        # Mostrar en la UI
        self.results_text.insert(END, formatted_message)
        self.results_text.see(END)
        
        # Usar el logger configurado
        if error:
            logger.error(message)
        else:
            logger.info(message)

    def _batch_process(self):
        folder = filedialog.askdirectory(
            title="Seleccionar Carpeta con PDFs"
        )
        if not folder:
            return
        pdf_files = list(Path(folder).glob("*.pdf"))
        if not pdf_files:
            messagebox.showinfo("Información", "No se encontraron archivos PDF en la carpeta seleccionada")
            return
        if not messagebox.askyesno("Confirmar", f"¿Desea procesar {len(pdf_files)} archivos PDF?"):
            return
        self.processing.set(True)
        self.status_label.config(text=f"Procesando lote de {len(pdf_files)} archivos...")
        threading.Thread(target=self._batch_process_thread,
                         args=(pdf_files,),
                         daemon=True).start()

    def _batch_process_thread(self, pdf_files):
        total = len(pdf_files)
        processed = 0
        errors = 0
        cached = 0
        self.stats = {"processed": 0, "errors": 0, "cached": 0}

        for i, pdf_path in enumerate(pdf_files):
            try:
                self.status_label.config(text=f"Procesando archivo {i+1} de {total}...")
                self.log_message(f"Procesando {pdf_path.name} ({i+1}/{total})...")

                cached_result = self.cache_manager.check_cache(pdf_path)
                if cached_result:
                    self.log_message(f"Archivo ya procesado: {pdf_path.name}")
                    self.stats["cached"] += 1
                    cached += 1
                    continue

                data = self.pdf_processor.extract_pdf_data(pdf_path)
                empresa_rutas = Config.get_empresa_paths(data.get('Afiliación', ''))

                doc_path = self.doc_generator.generate_remision(
                    data,
                    empresa_rutas["plantilla"],
                    empresa_rutas["remisiones"]
                )

                excel_path = self.excel_handler.update_control_file(
                    data,
                    empresa_rutas["control"]
                )

                self.cache_manager.update_cache(pdf_path, {
                    "remision": doc_path,
                    "control": excel_path
                })

                self.log_message(f"Completado: {pdf_path.name}")
                self.stats["processed"] += 1
                processed += 1

            except Exception as e:
                error_msg = f"Error al procesar {pdf_path.name}: {str(e)}"
                self.log_message(error_msg, error=True)
                self.stats["errors"] += 1
                errors += 1

        self.status_label.config(text="Lote completado")
        summary = (f"Procesamiento completado.\n"
                   f"- Archivos procesados: {processed}\n"
                   f"- Omitidos (en caché): {cached}\n"
                   f"- Errores: {errors}\n"
                   f"- Total: {total}")

        self.log_message(summary)
        messagebox.showinfo("Procesamiento completado", summary)
        self.processing.set(False)
        self.status_label.config(text="Listo")

    def _sanitize_text(self, text):
        """
        Asegura que el texto tenga codificación UTF-8 válida.
        Args:
            text (str, bytes, any): Texto a sanitizar.
        Returns:
            str: Texto asegurado con codificación UTF-8.
        """
        try:
            if isinstance(text, bytes):
                return text.decode('utf-8', errors='replace')
            elif isinstance(text, str):
                return text.encode('utf-8', errors='replace').decode('utf-8')
            else:
                return str(text).encode('utf-8', errors='replace').decode('utf-8')
        except Exception as e:
            logging.error(f"Error al sanitizar texto: {str(e)}")
            return str(text)
            
if __name__ == "__main__":
    app = RemisionesApp()
    app.mainloop()

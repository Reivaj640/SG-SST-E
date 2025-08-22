# -*- coding: utf-8 -*-
import sys
import json
import traceback
import re
import unicodedata
import pdfplumber
from datetime import datetime
import logging

# --- Clases y Lógica de Extracción ---

class PdfProcessor:
    def extract_pdf_data(self, pdf_path, full_text=None):
        try:
            if full_text:
                text = full_text
            else:
                with pdfplumber.open(pdf_path) as pdf:
                    text = "".join(page.extract_text() or "" for page in pdf.pages)
            
            text = unicodedata.normalize('NFC', text)
            pdf_format = self._detect_pdf_format(text)
            data = self._extract_data_based_on_format(text, pdf_format)
            data = self._post_process_data(data)
            self._validate_critical_data(data, pdf_path)
            
            # Agregar campos faltantes con NINGUNO
            for campo in ['Concepto Altura', 'Concepto de trabajo en espacios confinados', 'Motivo de Restricción', 'Incluir SVE', 'Restricciones Laborales', 'Concepto Manipulación Alimento']:
                if not data.get(campo):
                    data[campo] = "NINGUNO"
            
            return data
        except Exception as e:
            logging.error(f"Error en extract_pdf_data para {pdf_path}: {str(e)}")
            raise

    def _detect_pdf_format(self, text):
        text_upper = text.upper()
        if "DOCUMENTO : CC" in text_upper and "PACIENTE:" in text_upper:
            return "formato_1"
        elif "NOMBRE COMPLETO:" in text_upper and "TIPO DE EVALUACION REALIZADA" in text_upper:
            return "formato_2"
        return "formato_generico"

    def _extract_data_based_on_format(self, text, pdf_format):
        return self._extract_formato_generico(text)

    def _extract_formato_generico(self, text):
        extraction_rules = {
            'Nombre_Completo': r'(?:PACIENTE|Nombre Completo|Nombre)[:\s]*([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|SEXO:|DOCUMENTO|IDENTIFICACI[ÓO]N|$)',
            'No_Identificacion': r'(?:Documento[:\s]*CC[:\s]*(\d+))|(?:(?:No\.|N[úu]mero)\s*(?:de)?\s*Identificaci[óo]n[:\s]*(?:CC\s*-\s*)?(\d{7,12}))|(?:(?:CC|TI|CE)[:\s-]*(\d{7,12}))|(?:(?:c[ée]dula|documento|identificaci[óo]n)[:\s]*(\d{7,12}))',
            'Fecha_Nac': r'Fecha\s*(?:de)?\s*Nac(?:imiento)?[:\s]*([\d/-]+)',
            'Edad': r'Edad[:\s]*(\d+)',
            'Sexo': r'(?:Sexo|G[ée]nero)[:\s]*([A-Za-zÁ-Úá-ú]+)',
            'Afiliacion': r'Afiliaci[óo]n[:\s]*(.*?)(?:Estado civil|Ocupacion)',
            'Estado_civil': r'Estado\s*civil[:\s]*(.*?)(?:\n|$)',
            'Evaluacion_Ocupacional': r'(?:TIPO\s*DE\s*EVALUACI[ÓO]N\s*REALIZADA|Tipo\s*de\s*Examen|Evaluaci[óo]n\s*Ocupacional)[:\s]*([^:\n]+?)(?=\s*Fecha\s*de\s*atenci[óo]n:|$)',
            'Fecha_Atencion': r'Fecha\s*(?:de)?\s*atenci[óo]n[:\s]*([\d/-]+)',
            'Cargo': r'Cargo[:\s]*([^:\n]+?)(?=\s*Fecha\s*de|$)',
            'Examenes_realizados': r'EX[ÁA]MENES\s*REALIZADOS[:\s]*(.*?)(?=\s*(?:RECOMENDACIONES|INCLUIR|RESTRICCIONES|MANEJO|$))',
            'Recomendaciones_Laborales': r'RECOMENDACIONES\s*LABORALES[:\s]*(.*?)(?=MANEJO\s*EPS/ARL|\Z)',
            'Incluir_SVE': r'Incluir\s*SVE[:\s]*([^\n:]+?)(?=\s*(?:RESTRICCIONES|Concepto|$))',
            'Restricciones_Laborales': r'RESTRICCIONES\s*LABORALES[:\s]*(.*?)(?=\s*(?:Para\s*la\s*revisi[óo]n|INCLUIR|CONCEPTO|[A-ZÁ-Ú]+:|$))',
            'Concepto_Medico': r'Concepto\s*Medico[:\s]*((?!LEVANTAMIENTO)[^:\n]+)',
            'Concepto_Manipulacion_Alimento': r'Concepto\s*(?:Manipulaci[óo]n)?\s*Alimento[:\s]*(.*?)(?:\n|$)',
            'Concepto_Altura': r'Concepto\s*Altura[:\s]*(.*?)(?:\n|$)',
            'Concepto_trabajo_en_espacios_confinados': r'Concepto\s*de\s*trabajo\s*en\s*espacios\s*confinados[:\s]*([^\n:]+?)(?=\s*(?:MOTIVO|$))',
            'Motivo_de_Restriccion': r'MOTIVO\s*DE\s*RESTRICCI[OÓ]N[:\s]*(.*?)(?=\nFIRMA|\Z)',
        }
        data = {}
        for key, pattern in extraction_rules.items():
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            value = ""
            if match:
                value = next((g for g in match.groups() if g is not None), "")
            data[key] = value.strip()
        return data

    def _post_process_data(self, data):
        for key, value in data.items():
            if isinstance(value, str):
                data[key] = value.upper().replace('\n', ' ').strip()
        
        if data.get('Fecha Nac'):
            data['Fecha Nac'] = self._format_date(data['Fecha Nac'])
        if data.get('Fecha de Atención'):
            data['Fecha de Atención'] = self._format_date(data['Fecha de Atención'])
            
        return data

    def _validate_critical_data(self, data, pdf_path):
        if not data.get('No_Identificacion'):
            data['No_Identificacion'] = "NO_DISPONIBLE"
        if not data.get('Nombre_Completo'):
            data['Nombre_Completo'] = "NO_DISPONIBLE"

    def _format_date(self, date_str):
        for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%Y/%m/%d'):
            try:
                return datetime.strptime(date_str, fmt).strftime('%Y/%m/%d')
            except ValueError:
                pass
        return date_str

# --- Lógica Principal ---

def log(message, level='INFO'):
    log_entry = {
        'type': 'log',
        'level': level,
        'message': message
    }
    print(json.dumps(log_entry))

def main():
    # Este es el manejador de errores de más alto nivel.
    # Su propósito es asegurar que el script SIEMPRE devuelva un JSON de resultado.
    try:
        if len(sys.argv) < 2:
            raise ValueError("No se proporcionó la ruta del archivo PDF.")
        
        pdf_path = sys.argv[1]
        log(f"Iniciando procesamiento para el archivo: {pdf_path}")
        
        processor = PdfProcessor()
        
        log("Extrayendo texto del PDF...")
        try:
            with pdfplumber.open(pdf_path) as pdf:
                full_text = "".join(page.extract_text() or "" for page in pdf.pages)
        except Exception as pdf_error:
            raise RuntimeError(f"Error al leer el archivo PDF con pdfplumber: {pdf_error}")
        log("Texto extraído exitosamente.")

        extracted_data = processor.extract_pdf_data(pdf_path, full_text)
        log("Datos estructurados extraídos del texto.")
        
        result = {
            'type': 'result',
            'payload': {
                'success': True,
                'data': extracted_data,
                'debug_full_text': full_text
            }
        }
        #Imprimir el resultado final en una sola línea (sin indent=2)
        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        log(f"Ha ocurrido un error crítico: {str(e)}", level='ERROR')
        error_info = {
            'type': 'result',
            'payload': {
                'success': False,
                'error': str(e),
                'traceback': traceback.format_exc()
            }
        }
        # Imprimir el error final en una sola línea (sin indent=2)
        print(json.dumps(error_info, ensure_ascii=False))

if __name__ == "__main__":
    main()
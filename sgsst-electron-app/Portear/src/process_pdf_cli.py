# -*- coding: utf-8 -*-
import sys
import json
import traceback
import re
import unicodedata
import pdfplumber
from datetime import datetime
import logging

# --- Clases y Lógica de Extracción (Copiado de Remisiones_v1.0.py) ---

class PdfProcessor:
    def extract_pdf_data(self, pdf_path):
        try:
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
        # Para simplicidad, usamos el genérico que es el más robusto.
        # Las funciones _extract_formato_1 y _extract_formato_2 se omiten aquí
        # pero la lógica principal está en _extract_formato_generico.
        return self._extract_formato_generico(text)

    def _extract_formato_generico(self, text):
        extraction_rules = {
            'Nombre Completo': r'(?:Nombre\s*Completo|Paciente|Nombre)[:\s]*(.*?)(?:\n|SEXO:|DOCUMENTO|IDENTIFICACI[ÓO]N|$)',
            'No. Identificación': r'(?:Documento[:\s]*CC[:\s]*(\d+))|(?:(?:No\.|N[úu]mero)\s*(?:de)?\s*Identificaci[óo]n[:\s]*(?:CC\s*-\s*)?(\d{7,12}))|(?:(?:CC|TI|CE)[:\s-]*(\d{7,12}))|(?:(?:c[ée]dula|documento|identificaci[óo]n)[:\s]*(\d{7,12}))',
            'Fecha Nac': r'Fecha\s*(?:de)?\s*Nac(?:imiento)?[:\s]*([\d/-]+)',
            'Edad': r'Edad[:\s]*(\d+)',
            'Sexo': r'(?:Sexo|G[ée]nero)[:\s]*([A-Za-zÁ-Úá-ú]+)',
            'Afiliación': r'(?:Afiliaci[óo]n|Empresa)[:\s]*(.*?)(?:\n|$)',
            'Estado civil': r'Estado\s*civil[:\s]*(.*?)(?:\n|$)',
            'Evaluación Ocupacional': r'(?:TIPO\s*DE\s*EVALUACI[ÓO]N\s*REALIZADA|Tipo\s*de\s*Examen|Evaluaci[óo]n\s*Ocupacional)[:\s]*([^:\n]+?)(?=\s*Fecha\s*de\s*atenci[óo]n:|$)',
            'Fecha de Atención': r'Fecha\s*(?:de)?\s*atenci[óo]n[:\s]*([\d/-]+)',
            'Cargo': r'Cargo[:\s]*([^:\n]+?)(?=\s*Fecha\s*de|$)',
            'Exámenes realizados': r'EX[ÁA]MENES\s*REALIZADOS[:\s]*(.*?)(?=\s*(?:RECOMENDACIONES|INCLUIR|RESTRICCIONES|MANEJO|$))',
            'Recomendaciones Laborales': r'RECOMENDACIONES\s*LABORALES[:\s]*(.*?)(?=MANEJO\s*EPS/ARL|\Z)',
            'Incluir SVE': r'Incluir\s*SVE[:\s]*([^\n:]+?)(?=\s*(?:RESTRICCIONES|Concepto|$))',
            'Restricciones Laborales': r'RESTRICCIONES\s*LABORALES[:\s]*(.*?)(?=\s*(?:Para\s*la\s*revisi[óo]n|INCLUIR|CONCEPTO|[A-ZÁ-Ú]+:|$))',
            'Concepto Medico': r'Concepto\s*Medico[:\s]*((?!LEVANTAMIENTO)[^:\n]+)',
            'Concepto Manipulación Alimento': r'Concepto\s*(?:Manipulaci[óo]n)?\s*Alimento[:\s]*(.*?)(?:\n|$)',
            'Concepto Altura': r'Concepto\s*Altura[:\s]*(.*?)(?:\n|$)',
            'Concepto de trabajo en espacios confinados': r'Concepto\s*de\s*trabajo\s*en\s*espacios\s*confinados[:\s]*([^\n:]+?)(?=\s*(?:MOTIVO|$))',
            'Motivo de Restricción': r'MOTIVO\s*DE\s*RESTRICCI[OÓ]N[:\s]*(.*?)(?=\nFIRMA|\Z)',
        }
        data = {}
        for key, pattern in extraction_rules.items():
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            value = ""
            if match:
                # Encontrar el primer grupo que no sea None
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
        if not data.get('No. Identificación'):
            data['No. Identificación'] = "NO_DISPONIBLE"
        if not data.get('Nombre Completo'):
            data['Nombre Completo'] = "NO_DISPONIBLE"

    def _format_date(self, date_str):
        for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%Y/%m/%d'):
            try:
                return datetime.strptime(date_str, fmt).strftime('%Y/%m/%d')
            except ValueError:
                pass
        return date_str

# --- Lógica Principal para Ejecución desde Línea de Comandos ---

def main():
    """
    Punto de entrada para ejecutar el script desde la línea de comandos.
    Espera un argumento: la ruta al archivo PDF.
    Devuelve un JSON con los datos extraídos o un JSON de error.
    """
    try:
        if len(sys.argv) < 2:
            raise ValueError("No se proporcionó la ruta del archivo PDF.")
        
        pdf_path = sys.argv[1]
        
        processor = PdfProcessor()
        extracted_data = processor.extract_pdf_data(pdf_path)
        
        # Imprimir el resultado como JSON a stdout
        print(json.dumps({"success": True, "data": extracted_data}, indent=2))

    except Exception as e:
        # Capturar cualquier error e imprimirlo como un JSON de error a stdout
        error_info = {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_info, indent=2))

if __name__ == "__main__":
    main()

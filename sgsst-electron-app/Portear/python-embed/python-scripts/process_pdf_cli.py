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
            log(f"Formato de PDF detectado: {pdf_format}")
            data = self._extract_data_based_on_format(text, pdf_format)
            data = self._post_process_data(data)
            self._validate_critical_data(data, pdf_path)
            
            # Agregar campos faltantes con NINGUNO
            for campo in ['No. Identificacion', 'Nombre_Completo', 'Concepto Altura', 'Concepto de trabajo en espacios confinados','Motivo de Restricción', 'Incluir SVE', 'Restricciones Laborales', 'Concepto Manipulación Alimento']:
                if not data.get(campo):
                    data[campo] = "NINGUNO"
            
            return data
        except Exception as e:
            logging.error(f"Error en extract_pdf_data para {pdf_path}: {str(e)}")
            raise

    def _detect_pdf_format(self, text):
        # Se cambia el detector para que busque un identificador más fiable del formato.
        if "www.biofile.com.co" in text:
            return "vemedic"
        if "DOCUMENTO : CC" in text.upper() and "PACIENTE:" in text.upper():
            return "formato_generico"
        return "formato_generico"


    def _extract_data_based_on_format(self, text, pdf_format):
        if pdf_format == "vemedic":
            return self._extract_formato_vemedic(text)
        else:
            return self._extract_formato_generico(text)


    def _extract_formato_vemedic(self, text):
        print(f"DEBUG: Iniciando extracción para formato Vemedic")  # Mensaje de depuración
        
        # Reglas de extracción mejoradas para el formato Vemedic (biofile)
        extraction_rules = {
            'Nombre_Completo': r'Genero Edad Documento de Identificaci[óo]n\n([^\n]+)',
            'No. Identificacion': r'CC\s+([\d]+)',
            'Edad': r'(\d+)\s*AÑOS',
            'Sexo': r'\n(FEMENINO|MASCULINO)',
            'Afiliacion': r'DATOS DE LA EMPRESA[^\n]*\n([^\n]+)',
            'Cargo': r'Cargo\n([^\n]+)',
            'Fecha de AtenciÃ³n': r'FECHA Y CIUDAD DE REALIZACI[ÓO]N DEL EX[ÁA]MEN[\s\S]*?(\d{2}\s+\d{2}\s+\d{4})',
            'Restricciones_Laborales': r'RESTRICCIONES LABORALES\s*([^\n]+)',
            'Concepto_Medico': r'CONCEPTO DE APTITUD OCUPACIONAL\s*([^\n]+)',
            'Evaluacion_Ocupacional': r'TIPO DE EX[ÁA]MEN M[ÉE]DICO OCUPACIONAL\s*([^\n]+)',
        }

        data = {}  # Inicializamos el diccionario antes del bucle
        
        # Extraer todos los campos excepto las recomendaciones
        for key, pattern in extraction_rules.items():
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL | re.UNICODE)
            value = ""
            if match:
                value = next((g for g in match.groups() if g is not None), "")
            
            # Asegurar que value sea string antes de aplicar strip()
            if isinstance(value, str):
                data[key] = value.strip()
            else:
                data[key] = str(value).strip() if value else ""
        
        # Extraer las tres secciones de recomendaciones basándonos en el formato de columna
        # Buscar la sección que contiene las tres áreas de recomendaciones
        lineas = text.split('\n')
        recomendaciones_medicas = ""
        recomendaciones_ocupacionales = ""
        habitos_estilo = ""
        
        # Encontrar la línea donde aparecen los encabezados de las tres secciones
        encabezados_linea_idx = -1
        for idx, linea in enumerate(lineas):
            if 'RECOMENDACIONES MÉDICAS' in linea.upper() and 'RECOMENDACIONES OCUPACIONALES' in linea.upper() and 'HABITOS Y ESTILO' in linea.upper():
                encabezados_linea_idx = idx
                break
        
        if encabezados_linea_idx != -1:
            # Extraer contenido de las líneas siguientes hasta encontrar otra sección
            lineas_recomendaciones = []
            for idx in range(encabezados_linea_idx + 1, len(lineas)):
                linea = lineas[idx].rstrip()  # Eliminar espacios finales
                
                # Si encontramos otra sección, detenemos la extracción
                if any(seccion in linea.upper() for seccion in ['OTRAS OBSERVACIONES', 'CONCEPTO DE APTITUD', 'RESTRICCIONES']):
                    break
                
                # Si la línea no está vacía o solo contiene guiones, la añadimos
                if linea.strip() and linea.strip() not in ['-', '--', '---', 'N/A', 'N/A ', ' N/A']:
                    lineas_recomendaciones.append(linea)
            
            # Ahora vamos a extraer el contenido de las columnas
            # Basándonos en el ejemplo proporcionado:
            # "EXAMEN VISUAL DE CONTROL EN UN AÑO USO DE EPP HÁBITOS SALUDABLES"
            # "PÚSAS ACTIVAS E HIGIENE POSTURAL FORTALECIMIENTO MUSCULAR"
            # "SVE OSTEOMUSCULAR HACER DEPORTE"
            # "DIETA BALANCEADA"
            
            for linea in lineas_recomendaciones:
                # Dividimos la línea en segmentos usando patrones de espacios grandes
                # Buscamos segmentos de texto separados por múltiples espacios o tabuladores
                import re as regex
                # Dividir por 3 o más espacios seguidos (método más confiable)
                partes = regex.split(r'\s{3,}', linea)
                
                # Si no hay divisiones claras con espacios múltiples, intentamos otra estrategia
                if len(partes) <= 1:
                    # Usamos la posición de las palabras clave como guía
                    # Dividimos la línea en 3 partes aproximadas
                    palabras = linea.split()
                    if len(palabras) >= 3:
                        tercio1 = len(palabras) // 3
                        tercio2 = 2 * len(palabras) // 3
                        
                        parte1 = ' '.join(palabras[0:tercio1]).strip()
                        parte2 = ' '.join(palabras[tercio1:tercio2]).strip() 
                        parte3 = ' '.join(palabras[tercio2:]).strip()
                        
                        if parte1 and parte1 not in ['-', '--', '']:
                            recomendaciones_medicas += (" " + parte1) if recomendaciones_medicas else parte1
                        if parte2 and parte2 not in ['-', '--', '']:
                            recomendaciones_ocupacionales += (" " + parte2) if recomendaciones_ocupacionales else parte2
                        if parte3 and parte3 not in ['-', '--', '']:
                            habitos_estilo += (" " + parte3) if habitos_estilo else parte3
                    elif len(palabras) == 2 and len(palabras[0]) > 0 and len(palabras[1]) > 0:
                        # Puede ser ocupacionales y hábitos
                        parte2 = palabras[0].strip()
                        parte3 = palabras[1].strip()
                        if parte2 and parte2 not in ['-', '--', '']:
                            recomendaciones_ocupacionales += (" " + parte2) if recomendaciones_ocupacionales else parte2
                        if parte3 and parte3 not in ['-', '--', '']:
                            habitos_estilo += (" " + parte3) if habitos_estilo else parte3
                    else:
                        # Si solo hay una parte significativa, probablemente sea de la tercera columna
                        parte = linea.strip()
                        if parte and parte not in ['-', '--', ''] and len(parte) > 2:  # Filtrar partes muy cortas
                            habitos_estilo += (" " + parte) if habitos_estilo else parte
                else:
                    # Si se encontraron partes usando espacios múltiples
                    for i, parte in enumerate(partes):
                        parte_limpia = parte.strip()
                        if parte_limpia and parte_limpia not in ['-', '--', '']:
                            if i == 0:
                                recomendaciones_medicas += (" " + parte_limpia) if recomendaciones_medicas else parte_limpia
                            elif i == 1:
                                recomendaciones_ocupacionales += (" " + parte_limpia) if recomendaciones_ocupacionales else parte_limpia
                            elif i >= 2:  # Tercera columna y siguientes
                                habitos_estilo += (" " + parte_limpia) if habitos_estilo else parte_limpia
        else:
            # Si no encontramos la línea de encabezados, buscamos directamente las secciones
            # Buscar RECOMENDACIONES MEDICAS
            medicas_match = re.search(r'RECOMENDACIONES M[ÉE]DICAS[\s\n]*([^.]*?)(?=RECOMENDACIONES OCUPACIONALES|HABITOS Y ESTILO|RESTRICCIONES|OTRAS OBSERVACIONES|CONCEPTO|\Z)', text, re.IGNORECASE | re.DOTALL)
            if medicas_match:
                recomendaciones_medicas = medicas_match.group(1).strip()

            # Buscar RECOMENDACIONES OCUPACIONALES
            ocupacionales_match = re.search(r'RECOMENDACIONES OCUPACIONALES[\s\n]*([^.]*?)(?=HABITOS Y ESTILO|RESTRICCIONES|OTRAS OBSERVACIONES|CONCEPTO|\Z)', text, re.IGNORECASE | re.DOTALL)
            if ocupacionales_match:
                recomendaciones_ocupacionales = ocupacionales_match.group(1).strip()

            # Buscar HABITOS Y ESTILO DE VIDA SALUDABLES
            habitos_match = re.search(r'HABITOS Y ESTILO DE VIDA SALUDABLES[\s\n]*([^.]*?)(?=OTRAS OBSERVACIONES|RESTRICCIONES|CONCEPTO|\Z)', text, re.IGNORECASE | re.DOTALL)
            if habitos_match:
                habitos_estilo = habitos_match.group(1).strip()

        print(f"DEBUG: Recomendaciones Medicas: '{recomendaciones_medicas}'")  # Mensaje de depuración
        print(f"DEBUG: Recomendaciones Ocupacionales: '{recomendaciones_ocupacionales}'")  # Mensaje de depuración
        print(f"DEBUG: Habitos y Estilo: '{habitos_estilo}'")  # Mensaje de depuración
        
        # Combinar todas las recomendaciones en el campo Recomendaciones_Laborales para la plantilla
        todas_recomendaciones = []
        if recomendaciones_medicas:
            todas_recomendaciones.append(f"RECOMENDACIONES MEDICAS: {recomendaciones_medicas}")
        if recomendaciones_ocupacionales:
            todas_recomendaciones.append(f"RECOMENDACIONES OCUPACIONALES: {recomendaciones_ocupacionales}")
        if habitos_estilo:
            todas_recomendaciones.append(f"HABITOS Y ESTILO DE VIDA SALUDABLES: {habitos_estilo}")
        
        # Asignar las recomendaciones combinadas al campo Recomendaciones_Laborales
        data['Recomendaciones_Laborales'] = " - ".join(todas_recomendaciones) if todas_recomendaciones else "NINGUNO"
        
        print(f"DEBUG: Recomendaciones combinadas: '{data['Recomendaciones_Laborales']}'")  # Mensaje de depuración
        
        # Si no se encontraron secciones específicas, intentar la antigua expresión regular como fallback
        if data['Recomendaciones_Laborales'] == "NINGUNO" or data['Recomendaciones_Laborales'] == "":
            old_match = re.search(r'(?:RECOMENDACIONES OCUPACIONALES|recomendaciones ocupacionales)[\s\n:]*([^\n]+)', text, re.IGNORECASE)
            if old_match:
                data['Recomendaciones_Laborales'] = old_match.group(1).strip()

        return data



    def _extract_formato_generico(self, text):
        extraction_rules = {
            'Nombre_Completo': r'(?:Nombre\s*Completo[:\s]*|PACIENTE[:\s]*)([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|Fecha Nac|SEXO:|$)',
            'No. Identificacion': r'(?:No\.\s*Identificacion[:\s]*CC\s*-\s*|DOCUMENTO\s*:\s*CC\s+)(\d+)',
            'Fecha_Nac': r'Fecha\s*(?:de)?\s*Nac(?:imiento)?[:\s]*([\d/-]+)',
            'Edad': r'Edad[:\s]*(\d+)',
            'Sexo': r'(?:Sexo|G[ée]nero)[:\s]*([A-Za-zÁ-Úá-ú]+)',
            'Afiliacion': r'Afiliaci[óo]n[:\s]*(.*?)(?:Estado civil|Ocupacion)',
            'Estado_civil': r'Estado\s*civil[:\s]*(.*?)(?:\n|$)',
            'Evaluacion_Ocupacional': r'(?:TIPO\s*DE\s*EVALUACI[ÓO]N\s*REALIZADA|Tipo\s*de\s*Examen|Evaluaci[óo]n\s*Ocupacional)[:\s]*([^:\n]+?)(?=\s*Fecha\s*de\s*atenci[óo]n:|$)',
            'Fecha de Atención': r'Fecha\s*(?:de)?\s*atenci[óo]n[:\s]*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})',
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
        # Normaliza las claves para que siempre tengan los mismos nombres
        key_map = {
            'No. Identificacion': 'No. Identificacion',
            'No Identificacion': 'No. Identificacion',
            'No_Identificación': 'No. Identificacion',
            'Nombre Completo': 'Nombre_Completo',
            'Fecha Nac': 'Fecha_Nac',
            'Estado civil': 'Estado_civil',
            'Evaluación Ocupacional': 'Evaluacion_Ocupacional',
            'Fecha de Atención': 'Fecha de Atención',
            'Exámenes realizados': 'Examenes_realizados',
            'Recomendaciones Laborales': 'Recomendaciones_Laborales',
            'Concepto Medico': 'Concepto_Medico',
            'Concepto Manipulación Alimento': 'Concepto_Manipulacion_Alimento',
            'Concepto Altura': 'Concepto_Altura',
            'Concepto de trabajo en espacios confinados': 'Concepto_trabajo_en_espacios_confinados',
            'Motivo de Restricción': 'Motivo_de_Restriccion',
        }
        # Usar list(data.keys()) para evitar errores de ejecución al cambiar el tamaño del diccionario
        for old_key in list(data.keys()):
            if old_key in key_map:
                new_key = key_map[old_key]
                if old_key != new_key:
                    data[new_key] = data.pop(old_key)
        
        for key, value in data.items():
            if isinstance(value, str):
                data[key] = value.upper().replace('\n', ' ').strip()
        
        if data.get('Fecha_Nac'):
            data['Fecha_Nac'] = self._format_date(data.get('Fecha_Nac', ''))
        if data.get('Fecha de Atención'):
            data['Fecha de Atención'] = self._format_date(data.get('Fecha de Atención', ''))
            
        return data

    def _validate_critical_data(self, data, pdf_path):
        if not data.get('No. Identificacion'):
            data['No. Identificacion'] = "NO_DISPONIBLE"
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
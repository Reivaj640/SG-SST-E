#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Módulo para procesar accidentes desde la interfaz web
Mantiene toda la funcionalidad existente de invest_APP_V.3.py
"""

import sys
import json
import traceback
from pathlib import Path
import logging
import argparse

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def send_progress(step, percentage, message):
    """Sends a progress update to stdout."""
    progress = {
        "type": "progress",
        "step": step,
        "percentage": percentage,
        "message": message
    }
    print(json.dumps(progress, ensure_ascii=False))
    sys.stdout.flush()

def extract_data_from_pdf(pdf_path):
    """
    Extrae los datos de un PDF de accidente.
    """
    try:
        sys.path.append(str(Path(__file__).parent))
        from Invest_APP_V_3 import PdfProcessor

        send_progress("setup", 20, "Inicializando extractor de PDF...")
        pdf_processor = PdfProcessor()

        send_progress("extraction", 50, f"Extrayendo datos del PDF: {Path(pdf_path).name}")
        extracted_data = pdf_processor.extract_pdf_data(pdf_path)

        send_progress("finished", 100, "Extracción completada.")
        return {"success": True, "data": extracted_data}

    except Exception as e:
        logging.error(f"Error al extraer datos del PDF: {str(e)}")
        logging.error(traceback.format_exc())
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}

def analyze_accident(extracted_data, contexto_adicional=""):
    """
    Analiza los datos de un accidente para determinar las causas.
    """
    try:
        sys.path.append(str(Path(__file__).parent))
        from Invest_APP_V_3 import AccidentAnalyzer

        send_progress("setup", 10, "Inicializando analizador de IA...")
        analyzer = AccidentAnalyzer()

        send_progress("analysis", 50, "Analizando causas con IA...")
        descripcion = extracted_data.get("Descripcion del Accidente", "")
        analysis = analyzer.analyze_5whys(descripcion, contexto_adicional)

        send_progress("finished", 100, "Análisis completado.")
        return {"success": True, "analysis": analysis}

    except Exception as e:
        logging.error(f"Error al analizar el accidente: {str(e)}")
        logging.error(traceback.format_exc())
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}

def main():
    """
    Punto de entrada CLI para el procesamiento de accidentes.
    """
    parser = argparse.ArgumentParser(description="Procesador de accidentes.")
    parser.add_argument("action", choices=["extract", "analyze"], help="La acción a realizar.")
    parser.add_argument("--pdf_path", help="Ruta al archivo PDF para la acción 'extract'.")
    parser.add_argument("--json_data", help="String JSON con datos extraídos para la acción 'analyze'.")
    parser.add_argument("--contexto", default="", help="Contexto adicional para el análisis.")

    args = parser.parse_args()

    result = {}
    try:
        if args.action == "extract":
            if not args.pdf_path:
                raise ValueError("La acción 'extract' requiere --pdf_path.")
            result = extract_data_from_pdf(args.pdf_path)
        
        elif args.action == "analyze":
            if not args.json_data:
                raise ValueError("La acción 'analyze' requiere --json_data.")
            extracted_data = json.loads(args.json_data)
            result = analyze_accident(extracted_data, args.contexto)

    except Exception as e:
        result = {"success": False, "error": str(e), "traceback": traceback.format_exc()}

    # Reconfigurar stdout para asegurar la codificación UTF-8
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps({"type": "result", "payload": result}, ensure_ascii=False))

if __name__ == "__main__":
    main()

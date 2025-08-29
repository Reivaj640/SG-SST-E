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

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def process_accident_pdf(pdf_path, empresa="TEMPOACTIVA", contexto_adicional=""):
    """
    Procesa un PDF de accidente y devuelve los resultados en formato JSON
    Esta función replica la lógica de procesamiento de la aplicación GUI
    """
    try:
        # Importar las clases necesarias del script original
        sys.path.append(str(Path(__file__).parent))
        from Invest_APP_V_3 import PdfProcessor, AccidentAnalyzer, DocumentGenerator, Config
        
        # Crear instancias de los procesadores
        pdf_processor = PdfProcessor()
        analyzer = AccidentAnalyzer()
        doc_generator = DocumentGenerator()
        
        # 1. Extraer datos del PDF
        logging.info(f"Extrayendo datos del PDF: {pdf_path}")
        extracted_data = pdf_processor.extract_pdf_data(pdf_path)
        
        # 2. Analizar causas con IA
        logging.info("Analizando causas con IA...")
        descripcion = extracted_data.get("Descripcion del Accidente", "")
        analysis = analyzer.analyze_5whys(descripcion, contexto_adicional)
        
        # 3. Combinar datos
        combined_data = {**extracted_data, **analysis}
        
        # 4. Preparar rutas
        empresa_paths = Config.get_empresa_paths(empresa)
        template_path = empresa_paths["plantilla"]
        output_dir = empresa_paths["investigaciones"]
        
        # 5. Generar informe (opcional, solo para obtener la ruta)
        # No generamos el informe completo aquí para ahorrar tiempo
        # Solo preparamos la información necesaria
        
        result = {
            "success": True,
            "data": extracted_data,
            "analysis": analysis,
            "metadata": {
                "pdf_path": str(pdf_path),
                "empresa": empresa,
                "template_path": str(template_path),
                "output_dir": str(output_dir),
                "contexto_adicional": contexto_adicional
            }
        }
        
        return result
        
    except Exception as e:
        logging.error(f"Error al procesar el PDF: {str(e)}")
        logging.error(traceback.format_exc())
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

def main():
    """
    Punto de entrada CLI para el procesamiento de accidentes
    """
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No se proporcionó la ruta del PDF"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    empresa = sys.argv[2] if len(sys.argv) > 2 else "TEMPOACTIVA"
    contexto_adicional = sys.argv[3] if len(sys.argv) > 3 else ""
    
    result = process_accident_pdf(pdf_path, empresa, contexto_adicional)
    # Reconfigurar stdout para asegurar la codificación UTF-8
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
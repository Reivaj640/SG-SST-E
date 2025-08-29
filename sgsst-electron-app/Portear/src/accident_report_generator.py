#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script para generar el informe de accidente Word (.docx) a partir de datos JSON.
"""

import sys
import json
import traceback
from pathlib import Path
import logging
from docxtpl import DocxTemplate
import re
from datetime import datetime

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_empresa_paths(empresa):
    """
    Devuelve las rutas configuradas para una empresa específica.
    Debe coincidir con la configuración en Config.py de Invest_APP_V_3.py
    """
    RUTA_BASE = Path("G:/Mi unidad/2. Trabajo/1. SG-SST")
    RUTAS = {
        "TEMPOACTIVA": {
            "investigaciones": RUTA_BASE / "2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/2. Accidentes",
            "plantilla": RUTA_BASE / "2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/4. Procedimientos/GI-FO-020 INVESTIGACION.docx"
        },
        # Añade otras empresas si es necesario
    }
    return RUTAS.get(empresa.upper(), RUTAS["TEMPOACTIVA"])


def generate_informe_accidente(combined_data, template_path, output_dir):
    """
    Genera el informe de accidente usando DocxTemplate.
    """
    try:
        logging.info(f"Cargando plantilla desde: {template_path}")
        doc = DocxTemplate(str(template_path)) # DocxTemplate necesita un string

        # Preparar el contexto para la plantilla
        # Aplanar las claves complejas y adaptar los nombres a los de la plantilla .docx
        context = combined_data.copy() 
        
        # Aplanar las claves del análisis 5P 5M para que coincidan con la plantilla
        # Suponiendo que la plantilla usa nombres como `por_que_1_causa`, `por_que_1_mano_de_obra`, etc.
        for i in range(1, 6):
            pq_key = f"Por Qué {i}"
            pq_data = combined_data.get(pq_key, {})
            
            # Clave base para la plantilla
            base_key = f"por_que_{i}".lower().replace(' ', '_').replace('é', 'e').replace('á', 'a').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
            
            # Causa principal
            context[f"{base_key}_causa"] = pq_data.get("causa", "N/A")
            
            # Las 5M
            m_categories = ["Mano de Obra", "Método", "Maquinaria", "Medio Ambiente", "Material"]
            for m_cat in m_categories:
                # Convertir nombre de categoría a clave compatible con Jinja2/Word
                m_key_clean = m_cat.lower().replace(' ', '_').replace('é', 'e').replace('á', 'a').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
                context[f"{base_key}_{m_key_clean}"] = pq_data.get(m_cat, "N/A")
        
        # Asegurar que las claves simples también estén presentes con nombres limpios
        # (esto puede no ser necesario si combined_data ya las tiene limpias)
        # Puedes añadir más mapeos si la plantilla usa nombres específicos
        # Ejemplo:
        # context['nombre_completo'] = combined_data.get('Nombre Completo', 'N/A')
        # context['fecha_del_accidente'] = combined_data.get('Fecha del Accidente', 'N/A')
        # ... etc ...

        logging.info("Renderizando documento...")
        doc.render(context)
        
        # Generar nombre de archivo de salida
        nombre_sanitizado = re.sub(r'[^\w\s-]', '', combined_data.get('Nombre Completo', 'sin_nombre')).replace(' ', '_')
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S') # Añadir timestamp para unicidad
        output_filename = f"GI-FO-020_INVESTIGACION_{nombre_sanitizado}_{timestamp}.docx"
        output_path = Path(output_dir) / output_filename
        
        logging.info(f"Guardando informe en: {output_path}")
        doc.save(str(output_path)) # DocxTemplate.save necesita un string
        
        logging.info(f"Informe creado exitosamente: {output_path}")
        return str(output_path)
        
    except Exception as e:
        logging.error(f"Error al generar el informe: {e}")
        logging.error(traceback.format_exc())
        raise


def main():
    """
    Punto de entrada principal.
    """
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False, 
            "error": "No se proporcionó la ruta del archivo de datos."
        }))
        sys.exit(1)

    data_file_path = sys.argv[1]
    
    try:
        logging.info(f"Leyendo datos desde: {data_file_path}")
        with open(data_file_path, 'r', encoding='utf-8') as f:
            input_data = json.load(f)
        
        combined_data = input_data.get("data", {})
        empresa = input_data.get("empresa", "TEMPOACTIVA")
        
        logging.info(f"Obteniendo rutas para la empresa: {empresa}")
        empresa_paths = get_empresa_paths(empresa)
        template_path = empresa_paths["plantilla"]
        output_dir = empresa_paths["investigaciones"]
        
        # Asegurar que el directorio de salida exista
        output_dir.mkdir(parents=True, exist_ok=True)
        
        logging.info("Iniciando generación del informe...")
        document_path = generate_informe_accidente(combined_data, template_path, output_dir)
        
        print(json.dumps({
            "success": True,
            "documentPath": document_path,
            "message": "Informe generado correctamente."
        }, ensure_ascii=False))
        
    except Exception as e:
        logging.error(f"Error fatal en el script: {e}")
        logging.error(traceback.format_exc())
        print(json.dumps({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main()

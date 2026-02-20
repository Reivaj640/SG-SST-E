#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Servidor de Inferencia LLM para Análisis de Accidentes
Mantiene el modelo en memoria para respuestas rápidas
"""

import os
import sys
import json
import logging
import threading
import time
from datetime import datetime

# Configurar logging a archivo y consola
LOG_FILE = os.path.join(os.path.dirname(__file__), "llm_server.log")

# Crear logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Handler para archivo
file_handler = logging.FileHandler(LOG_FILE, encoding='utf-8')
file_handler.setLevel(logging.INFO)
file_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(file_formatter)

# Handler para consola
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
console_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
console_handler.setFormatter(console_formatter)

# Agregar handlers
logger.addHandler(file_handler)
logger.addHandler(console_handler)

# Intentar importar Flask
try:
    from flask import Flask, request, jsonify
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    logger.warning("Flask no disponible. Instalar con: pip install flask")

# Intentar importar torch y transformers
try:
    import torch
    from transformers import Mistral3ForConditionalGeneration, AutoTokenizer
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    logger.warning("Transformers no disponible")

# Configuración del modelo - Usar la misma ruta que Invest_APP_V_3.py
MODEL_PATH = r"D:\1. Estudio\1.1 IA\1.1.2. LLM's\Inv. AT\mistral-3-3B-Reasonig-2512"
SERVER_PORT = 5555
SERVER_HOST = "127.0.0.1"

# Variable global para el modelo
_model = None
_tokenizer = None
_model_loading = False
_model_loaded = False
_loading_error = None

# Prompt para análisis 5 Porqués
PROMPT_TEMPLATE = """INSTRUCCIONES: Genera un análisis 5 Porqués COMPLETO para el siguiente accidente laboral.

METODOLOGÍA 5 PORQUÉS:
- Cada nivel pregunta "¿Por qué?" al resultado del nivel anterior
- El objetivo es llegar a la CAUSA RAÍZ que la empresa puede corregir con acciones concretas
- Los niveles deben formar una CADENA CAUSAL COHERENTE (5→4→3→2→1→accidente)

CATEGORÍAS 5M (analiza TODAS en CADA nivel):
- Mano de Obra: acciones/comportamientos del trabajador (distracción, error, decisión, capacitación)
- Método: procedimientos/normas/supervisión (falta de procedimiento, procedimiento inadecuado)
- Maquinaria: equipos/vehículos/herramientas (falla mecánica, falta de mantenimiento)
- Medio Ambiente: condiciones del lugar (iluminación, orden, señalización, temperatura)
- Material: objetos/sustancias/EPP (material defectuoso, falta de EPP)

REGLAS OBLIGATORIAS:
1. Genera EXACTAMENTE 5 niveles de análisis
2. En CADA nivel, analiza TODAS las 5 categorías 5M (no solo una)
3. Si una categoría NO contribuye a la causa en ese nivel, marca N/A
4. La causa principal de cada nivel debe ser CONSECUENCIA del nivel anterior
5. El último nivel debe identificar causas RAÍZ accionables por la empresa
6. NO agregues explicaciones, introducciones, conclusiones, notas adicionales ni texto fuera del formato
7. NO uses "**", "###", ni otros marcadores de formato markdown
8. Detente inmediatamente después del nivel 5

FORMATO DE RESPUESTA ESTRICTO (usa ESTE formato exacto):

1. ¿Por qué ocurrió el accidente?
   • Mano de Obra: [causa específica o N/A]
   • Método: [causa específica o N/A]
   • Maquinaria: [causa específica o N/A]
   • Medio Ambiente: [causa específica o N/A]
   • Material: [causa específica o N/A]

2. ¿Por qué [causa principal del nivel 1]?
   • Mano de Obra: [causa específica o N/A]
   • Método: [causa específica o N/A]
   • Maquinaria: [causa específica o N/A]
   • Medio Ambiente: [causa específica o N/A]
   • Material: [causa específica o N/A]

3. ¿Por qué [causa principal del nivel 2]?
   • Mano de Obra: [causa específica o N/A]
   • Método: [causa específica o N/A]
   • Maquinaria: [causa específica o N/A]
   • Medio Ambiente: [causa específica o N/A]
   • Material: [causa específica o N/A]

4. ¿Por qué [causa principal del nivel 3]?
   • Mano de Obra: [causa específica o N/A]
   • Método: [causa específica o N/A]
   • Maquinaria: [causa específica o N/A]
   • Medio Ambiente: [causa específica o N/A]
   • Material: [causa específica o N/A]

5. ¿Por qué [causa principal del nivel 4]?
   • Mano de Obra: [causa específica o N/A]
   • Método: [causa específica o N/A]
   • Maquinaria: [causa específica o N/A]
   • Medio Ambiente: [causa específica o N/A]
   • Material: [causa específica o N/A]

ACCIDENTE A ANALIZAR:

**Descripción del accidente:**
{descripcion}

**Contexto Adicional:**
{contexto}

**Análisis de 5 Porqués:**"""


def load_model():
    """Carga el modelo y tokenizer en memoria."""
    global _model, _tokenizer, _model_loading, _model_loaded
    
    if _model_loaded:
        return True
    
    if _model_loading:
        logger.info("Modelo ya está cargando...")
        return False
    
    _model_loading = True
    start_time = datetime.now()
    
    try:
        logger.info(f"Cargando modelo desde: {MODEL_PATH}")
        
        # Verificar que el modelo existe
        if not os.path.exists(MODEL_PATH):
            logger.error(f"Modelo no encontrado en: {MODEL_PATH}")
            _model_loading = False
            return False
        
        # Cargar tokenizer
        logger.info("Cargando tokenizer...")
        _tokenizer = AutoTokenizer.from_pretrained(
            MODEL_PATH,
            local_files_only=True,
            trust_remote_code=True
        )
        _tokenizer.pad_token = _tokenizer.eos_token
        
        # Detectar dispositivo
        if torch.cuda.is_available():
            device = "cuda"
            gpu_name = torch.cuda.get_device_name(0)
            vram = torch.cuda.get_device_properties(0).total_memory / 1024**3
            logger.info(f"GPU detectada: {gpu_name} ({vram:.1f} GB VRAM)")
        else:
            device = "cpu"
            logger.warning("CUDA no disponible, usando CPU")
        
        # Cargar modelo (usar bfloat16 como en Invest_APP_V_3.py)
        logger.info("Cargando modelo en bfloat16...")
        _model = Mistral3ForConditionalGeneration.from_pretrained(
            MODEL_PATH,
            local_files_only=True,
            trust_remote_code=True,
            torch_dtype=torch.bfloat16,
            device_map=device,
            low_cpu_mem_usage=True
        )
        
        _model.eval()
        
        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"[MODEL] Modelo cargado exitosamente en {elapsed:.1f} segundos")
        
        _model_loaded = True
        _model_loading = False
        return True
        
    except Exception as e:
        logger.error(f"Error cargando modelo: {e}")
        _model_loading = False
        return False


def analyze_accident(descripcion: str, contexto: str = "") -> dict:
    """Analiza un accidente usando el modelo LLM."""
    global _model, _tokenizer, _model_loaded
    
    if not _model_loaded:
        return {
            "success": False,
            "error": "Modelo no cargado"
        }
    
    try:
        # Construir prompt
        prompt = PROMPT_TEMPLATE.format(
            descripcion=descripcion,
            contexto=contexto if contexto else "No se proporcionó contexto adicional."
        )
        
        logger.info("Generando análisis...")
        start_time = datetime.now()
        
        # Tokenizar
        inputs = _tokenizer(prompt, return_tensors="pt", truncation=True, max_length=4096)
        inputs = {k: v.to(_model.device) for k, v in inputs.items()}
        
        # Generar
        with torch.no_grad():
            outputs = _model.generate(
                **inputs,
                max_new_tokens=4000,
                temperature=0.7,
                do_sample=True,
                pad_token_id=_tokenizer.eos_token_id
            )
        
        # Decodificar
        generated_text = _tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Extraer solo la respuesta generada (después del prompt)
        if "**Análisis de 5 Porqués:**" in generated_text:
            analysis_text = generated_text.split("**Análisis de 5 Porqués:**")[-1].strip()
        else:
            analysis_text = generated_text[len(prompt):].strip()
        
        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"Análisis generado en {elapsed:.1f} segundos")
        
        # Parsear el análisis
        parsed_result = parse_5_whys(analysis_text)
        
        return {
            "success": True,
            "data": parsed_result,
            "raw_text": analysis_text,
            "generation_time": elapsed
        }
        
    except Exception as e:
        logger.error(f"Error en análisis: {e}")
        return {
            "success": False,
            "error": str(e)
        }


def parse_5_whys(text: str) -> dict:
    """Parsea el texto del análisis 5 Porqués a estructura JSON."""
    import re
    
    result = {}
    
    # Normalizar nombres de categorías
    category_map = {
        "mano de obra": "Mano de Obra",
        "mano de obra:": "Mano de Obra",
        "método": "Método",
        "metodo": "Método",
        "método:": "Método",
        "metodo:": "Método",
        "maquinaria": "Maquinaria",
        "maquinaria:": "Maquinaria",
        "medio ambiente": "Medio Ambiente",
        "medio ambiente:": "Medio Ambiente",
        "material": "Material",
        "material:": "Material"
    }
    
    # Patrón para cada nivel
    level_pattern = r'(\d+)\.\s*[¿?]?\s*Por\s*qu[eé][¿?]?\s*(?:ocurrió\s*el\s*accidente)?[:\s]*(.*?)(?=\d+\.\s*[¿?]?\s*Por\s*qu[eé][¿?]?|$)'
    
    # Buscar niveles
    levels = re.findall(level_pattern, text, re.DOTALL | re.IGNORECASE)
    
    for level_num, level_content in levels:
        level_key = f"PorQue{level_num}"
        level_data = {
            "Pregunta": f"¿Por qué? - Nivel {level_num}",
            "Mano de Obra": "N/A",
            "Método": "N/A",
            "Maquinaria": "N/A",
            "Medio Ambiente": "N/A",
            "Material": "N/A"
        }
        
        # Buscar categorías en el contenido del nivel
        for cat_key, cat_name in category_map.items():
            # Patrón para encontrar la categoría y su valor
            cat_pattern = rf'[•\-\*]\s*{re.escape(cat_key)}\s*[:\-]?\s*(.*?)(?=[•\-\*]\s*(?:Mano|M[eé]todo|Maquinaria|Medio|Material)|$)'
            match = re.search(cat_pattern, level_content, re.IGNORECASE | re.DOTALL)
            
            if match:
                value = match.group(1).strip()
                # Limpiar valor
                value = re.sub(r'^[:\-\s]+', '', value)
                value = re.sub(r'\s+$', '', value)
                if value and len(value) > 2 and value.upper() != "N/A":
                    level_data[cat_name] = value
        
        result[level_key] = level_data
    
    # Si no se encontraron niveles con el patrón, intentar parseo alternativo
    if not result:
        logger.warning("No se encontraron niveles con patrón estándar, intentando parseo alternativo")
        result = parse_5_whys_alternative(text)
    
    return result


def parse_5_whys_alternative(text: str) -> dict:
    """Parseo alternativo para análisis 5 Porqués."""
    import re
    
    result = {}
    categories = ["Mano de Obra", "Método", "Maquinaria", "Medio Ambiente", "Material"]
    
    # Dividir por líneas que empiezan con número
    lines = text.split('\n')
    current_level = None
    current_data = {}
    
    for line in lines:
        line = line.strip()
        
        # Detectar inicio de nivel
        level_match = re.match(r'^(\d+)\.', line)
        if level_match:
            # Guardar nivel anterior si existe
            if current_level and current_data:
                result[f"PorQue{current_level}"] = current_data
            
            current_level = level_match.group(1)
            current_data = {cat: "N/A" for cat in categories}
            current_data["Pregunta"] = line
            continue
        
        # Buscar categoría en la línea
        for cat in categories:
            if cat.lower() in line.lower():
                # Extraer valor después de los dos puntos
                if ':' in line:
                    value = line.split(':', 1)[-1].strip()
                    if value and len(value) > 2:
                        current_data[cat] = value
                break
    
    # Guardar último nivel
    if current_level and current_data:
        result[f"PorQue{current_level}"] = current_data
    
    return result


# Crear aplicación Flask
app = Flask(__name__) if FLASK_AVAILABLE else None

if app:
    @app.route('/health', methods=['GET'])
    def health_check():
        """Verifica el estado del servidor."""
        # Solo retornar "ok" si el modelo está cargado
        if _model_loaded:
            return jsonify({
                "status": "ok",
                "model_loaded": True,
                "model_loading": False,
                "timestamp": datetime.now().isoformat()
            })
        else:
            return jsonify({
                "status": "loading",
                "model_loaded": False,
                "model_loading": _model_loading,
                "timestamp": datetime.now().isoformat()
            })
    
    @app.route('/load', methods=['POST'])
    def load_model_endpoint():
        """Inicia la carga del modelo."""
        success = load_model()
        return jsonify({
            "success": success,
            "model_loaded": _model_loaded,
            "message": "Modelo cargado" if success else "Error cargando modelo"
        })
    
    @app.route('/analyze', methods=['POST'])
    def analyze_endpoint():
        """Analiza un accidente."""
        data = request.get_json()

        if not data:
            return jsonify({
                "success": False,
                "error": "No se proporcionaron datos"
            }), 400

        descripcion = data.get('descripcion', '')
        contexto = data.get('contexto', '')

        if not descripcion:
            return jsonify({
                "success": False,
                "error": "Se requiere descripción del accidente"
            }), 400

        # Esperar a que el modelo esté cargado (máximo 15 minutos)
        if not _model_loaded:
            logger.info("[ANALYZE] Modelo no cargado, esperando...")
            max_attempts = 450  # 15 minutos máximo (450 * 2s = 900s)
            
            for i in range(max_attempts):
                if _model_loaded:
                    logger.info("[ANALYZE] Modelo cargado, procediendo con análisis")
                    break
                if _loading_error:
                    return jsonify({
                        "success": False,
                        "error": f"Error cargando modelo: {_loading_error}"
                    }), 503
                    
                time.sleep(2)
                
                # Log de progreso cada 30 segundos
                if i % 15 == 0 and i > 0:
                    logger.info(f"[ANALYZE] Esperando modelo... ({i * 2 // 60}min {i * 2 % 60}s)")
            
            if not _model_loaded:
                return jsonify({
                    "success": False,
                    "error": "Timeout esperando carga del modelo"
                }), 503

        result = analyze_accident(descripcion, contexto)
        return jsonify(result)
    
    @app.route('/status', methods=['GET'])
    def status_endpoint():
        """Retorna el estado detallado del servidor."""
        return jsonify({
            "model_loaded": _model_loaded,
            "model_loading": _model_loading,
            "model_path": MODEL_PATH,
            "server_port": SERVER_PORT
        })


def run_server():
    """Inicia el servidor Flask."""
    if not FLASK_AVAILABLE:
        logger.error("Flask no está disponible. Instalar con: pip install flask")
        return
    
    logger.info(f"Iniciando servidor de inferencia en http://{SERVER_HOST}:{SERVER_PORT}")
    logger.info("Endpoints disponibles:")
    logger.info("  GET  /health - Verificar estado")
    logger.info("  POST /load   - Cargar modelo")
    logger.info("  POST /analyze - Analizar accidente")
    logger.info("  GET  /status - Estado detallado")
    
    # Cargar modelo al inicio EN UN THREAD SEPARADO para no bloquear el servidor
    import threading
    model_thread = threading.Thread(target=load_model, daemon=True)
    model_thread.start()
    
    # Iniciar servidor (el modelo se carga en paralelo)
    app.run(host=SERVER_HOST, port=SERVER_PORT, threaded=True)


if __name__ == "__main__":
    run_server()

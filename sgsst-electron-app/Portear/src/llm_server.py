#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Servidor de Inferencia LLM para Análisis de Accidentes (wrapper Ollama)

Este servidor actúa como PROXY entre la app Electron (que espera Flask en :5555)
y Ollama (que corre el modelo Qwen3.5-2B-MTP-GGUF en :11434).

Mantiene la MISMA interfaz que el servidor anterior basado en transformers:
- GET  /health  → estado del modelo
- POST /load    → inicia carga del modelo
- POST /analyze → analiza accidente
- GET  /status  → estado detallado

Ventajas vs servidor con transformers directo:
- Carga del modelo en <30s (vs 4-5 min con transformers BF16)
- 1.38 GB en disco (vs 7.7 GB)
- 3 GB VRAM (vs 6-8 GB)
- Acelera con MTP (Multi-Token Prediction) cuando está disponible
"""

import os
import sys
import json
import time
import re
import logging
from datetime import datetime
from urllib import request as urllib_request
from urllib.error import URLError, HTTPError

# Configurar logging a archivo y consola
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "llm_server.log")

logger = logging.getLogger("llm_server_ollama")
logger.setLevel(logging.INFO)
# Evitar duplicar handlers si se reimporta
logger.handlers.clear()

file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))

logger.addHandler(file_handler)
logger.addHandler(console_handler)

# Intentar importar Flask
try:
    from flask import Flask, request, jsonify
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    logger.warning("Flask no disponible. Instalar con: pip install flask")

# ============================================================================
# Configuración Ollama
# ============================================================================
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "127.0.0.1")
OLLAMA_PORT = int(os.environ.get("OLLAMA_PORT", "11434"))
OLLAMA_BASE_URL = f"http://{OLLAMA_HOST}:{OLLAMA_PORT}"
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen-inv-at")  # Creado desde Modelfile

# Configuración del servidor Flask (mismo puerto que antes para compatibilidad)
SERVER_PORT = int(os.environ.get("LLM_SERVER_PORT", "5555"))
SERVER_HOST = "127.0.0.1"

# Variable global para estado del modelo (Ollama mantiene el modelo en memoria,
# solo necesitamos saber si está listo y cargado)
_model_ready = False
_last_check_ts = 0.0
_CHECK_INTERVAL = 5.0  # segundos entre health checks a Ollama

# ============================================================================
# Prompt template para 5 Porqués
# Separado en SYSTEM (instrucciones al modelo) y USER (datos del accidente).
# Se envía vía Ollama /api/chat con messages separados para formato chat nativo.
# ============================================================================

SYSTEM_PROMPT = """Eres un analista experto en Seguridad y Salud en el Trabajo (SG-SST) especializado en investigación de accidentes laborales en Colombia, con conocimiento de la Resolución 0312 de 2019.

Tu tarea es analizar la descripción de un accidente laboral y generar un análisis de causa raíz usando la metodología de los 5 Porqués combinada con el diagrama de Ishikawa (espina de pescado) clasificado en 5 categorías M.

REGLAS OBLIGATORIAS:
1. Responde SIEMPRE en español colombiano, de forma técnica y objetiva.
2. Genera EXACTAMENTE 5 niveles de "¿Por qué?".
3. En CADA nivel analiza las 5 categorías 5M (si una categoría no aplica, marca "N/A").
4. La causa principal de cada nivel debe ser CONSECUENCIA directa del nivel anterior (cadena causal coherente 5→4→3→2→1).
5. El nivel 5 debe identificar causas raíz ACCIONABLES que la empresa puede corregir.
6. NO agregues explicaciones, introducciones, conclusiones, notas adicionales ni texto fuera del formato.
7. NO uses "**", "###", ni otros marcadores de formato markdown.
8. NO escribas los prompts de ejemplo ni las instrucciones de formato; responde SOLO con el análisis.
9. Detente inmediatamente después del nivel 5.

CATEGORÍAS 5M (definiciones):
- Mano de Obra: acciones/comportamientos del trabajador (distracción, error, decisión, capacitación, EPP usado)
- Método: procedimientos/normas/supervisión (falta de procedimiento, procedimiento inadecuado, falta de capacitación)
- Maquinaria: equipos/vehículos/herramientas (falla mecánica, falta de mantenimiento, diseño inadecuado)
- Medio Ambiente: condiciones del lugar (iluminación, orden, aseo, señalización, temperatura, ruido)
- Material: objetos/sustancias/EPP (material defectuoso, falta de EPP, almacenamiento)

FORMATO DE RESPUESTA ESTRICTO (usa este formato exacto, sin preámbulos):

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
   • Material: [causa específica o N/A]"""


def build_user_prompt(descripcion: str, contexto: str) -> str:
    """Construye el mensaje del usuario con los datos del accidente."""
    contexto_str = contexto if contexto else "No se proporcionó contexto adicional."
    return f"Descripción del accidente:\n{descripcion}\n\nContexto Adicional:\n{contexto_str}"


# ============================================================================
# Funciones de comunicación con Ollama
# ============================================================================

def _ollama_request(path: str, method: str = "GET", payload: dict = None, timeout: int = 600):
    """Hace una petición HTTP a Ollama. Retorna dict o lanza excepción."""
    url = f"{OLLAMA_BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}

    if method == "POST" and payload is not None:
        data = json.dumps(payload).encode("utf-8")
        req = urllib_request.Request(url, data=data, headers=headers, method="POST")
    else:
        req = urllib_request.Request(url, headers=headers, method=method)

    try:
        with urllib_request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        logger.error(f"HTTP {e.code} en {path}: {body}")
        raise
    except URLError as e:
        logger.error(f"Error de conexión con Ollama en {url}: {e}")
        raise


def check_ollama_alive() -> bool:
    """Verifica si Ollama está corriendo.

    NOTA: NO usamos _ollama_request porque GET / devuelve texto plano
    "Ollama is running" (no JSON), y json.loads() fallaría y reportaría
    Ollama como caído cuando en realidad está vivo.
    """
    url = f"{OLLAMA_BASE_URL}/"
    try:
        req = urllib_request.Request(url, method="GET")
        with urllib_request.urlopen(req, timeout=3) as resp:
            # Cualquier respuesta HTTP válida (incluso 4xx) cuenta como "vivo"
            return True
    except Exception:
        return False


def check_model_loaded() -> bool:
    """Verifica si el modelo está cargado y listo en Ollama.

    Ollama carga modelos bajo demanda. La primera llamada a /api/generate o
    /api/chat puede tardar unos segundos (carga desde disco). Una vez cargado,
    queda en memoria.
    """
    global _model_ready, _last_check_ts
    now = time.time()
    if now - _last_check_ts < _CHECK_INTERVAL and _model_ready:
        return True

    try:
        # /api/show devuelve info del modelo sin cargarlo necesariamente.
        # Si el modelo no existe, devuelve error.
        _ollama_request("/api/show", "POST", {"name": OLLAMA_MODEL}, timeout=5)
        _model_ready = True
        _last_check_ts = now
        logger.info(f"[OLLAMA] Modelo '{OLLAMA_MODEL}' listo")
        return True
    except HTTPError as e:
        if e.code == 404:
            logger.warning(f"[OLLAMA] Modelo '{OLLAMA_MODEL}' no existe. Ejecuta setup_ollama.ps1")
            _model_ready = False
        else:
            _model_ready = False
        return False
    except Exception as e:
        logger.warning(f"[OLLAMA] Error verificando modelo: {e}")
        _model_ready = False
        return False


def warmup_model() -> bool:
    """Hace una llamada trivial para forzar la carga del modelo en Ollama.

    Ollama carga modelos en la primera inferencia real. Hacemos una llamada
    'dummy' para que esa carga pase durante /load en vez de durante /analyze.
    """
    try:
        _ollama_request(
            "/api/generate",
            "POST",
            {
                "model": OLLAMA_MODEL,
                "prompt": "ok",
                "stream": False,
                "options": {"num_predict": 1},
            },
            timeout=120,
        )
        _model_ready = True
        logger.info(f"[OLLAMA] Modelo '{OLLAMA_MODEL}' cargado en memoria")
        return True
    except Exception as e:
        logger.error(f"[OLLAMA] Error en warmup: {e}")
        return False


def analyze_via_ollama(descripcion: str, contexto: str = "") -> dict:
    """Llama a Ollama /api/chat para generar el análisis 5 Porqués."""
    user_prompt = build_user_prompt(descripcion, contexto)

    start_time = datetime.now()
    logger.info(f"[OLLAMA] Generando análisis ({len(descripcion)} chars desc, {len(contexto)} chars contexto)...")

    try:
        # Usar /api/chat con system + user separados (formato nativo Qwen3.5).
        # El system va en el Modelfile; el user lleva los datos del accidente.
        # IMPORTANTE: think=false desactiva thinking mode (Qwen3.5 entra en modo
        # razonamiento por defecto y gasta todos los tokens pensando en lugar
        # de generar respuesta). Ver: https://huggingface.co/unsloth/Qwen3.5-2B-MTP-GGUF
        response = _ollama_request(
            "/api/chat",
            "POST",
            {
                "model": OLLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                "stream": False,
                "think": False,
                "options": {
                    "temperature": 0.4,
                    "top_p": 0.9,
                    "top_k": 20,
                    "num_predict": 4000,
                    "repeat_penalty": 1.1,
                    "stop": ["<|im_end|>", "<|endoftext|>"],
                },
            },
            timeout=600,
        )

        # /api/chat retorna {"message": {"role": "assistant", "content": "..."}}
        msg = response.get("message", {}) or {}
        analysis_text = (msg.get("content") or "").strip()
        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"[OLLAMA] Análisis generado en {elapsed:.1f}s ({len(analysis_text)} chars)")

        # Parsear el análisis (mismo parser que antes)
        parsed_result = parse_5_whys(analysis_text)

        return {
            "success": True,
            "data": parsed_result,
            "raw_text": analysis_text,
            "generation_time": elapsed,
        }
    except Exception as e:
        logger.error(f"[OLLAMA] Error en análisis: {e}")
        return {
            "success": False,
            "error": str(e),
        }


# ============================================================================
# Parser de 5 Porqués (idéntico al servidor anterior)
# ============================================================================

def parse_5_whys(text: str) -> dict:
    """Parsea el texto del análisis 5 Porqués a estructura JSON."""
    result = {}

    category_map = {
        "mano de obra": "Mano de Obra",
        "método": "Método",
        "metodo": "Método",
        "maquinaria": "Maquinaria",
        "medio ambiente": "Medio Ambiente",
        "material": "Material",
    }

    level_pattern = r"(\d+)\.\s*[¿?]?\s*Por\s*qu[eé][¿?]?\s*(?:ocurrió\s*el\s*accidente)?[:\s]*(.*?)(?=\d+\.\s*[¿?]?\s*Por\s*qu[eé][¿?]?|$)"
    levels = re.findall(level_pattern, text, re.DOTALL | re.IGNORECASE)

    for level_num, level_content in levels:
        level_key = f"PorQue{level_num}"
        level_data = {
            "Pregunta": f"¿Por qué? - Nivel {level_num}",
            "Mano de Obra": "N/A",
            "Método": "N/A",
            "Maquinaria": "N/A",
            "Medio Ambiente": "N/A",
            "Material": "N/A",
        }

        for cat_key, cat_name in category_map.items():
            # Aceptar bullets: • (Unicode), -, *, o . (Qwen3.5 a veces usa "• Mano" como ". Mano")
            cat_pattern = rf"[•\-\*\.\u2022]\s*{re.escape(cat_key)}\s*[:\-]?\s*(.*?)(?=[•\-\*\.\u2022]\s*(?:Mano|M[eé]todo|Maquinaria|Medio|Material)|$)"
            match = re.search(cat_pattern, level_content, re.IGNORECASE | re.DOTALL)
            if match:
                value = match.group(1).strip()
                value = re.sub(r"^[:\-\s]+", "", value)
                value = re.sub(r"\s+$", "", value)
                # Limpiar corchetes decorativos que pone el modelo (ej: [texto] -> texto)
                value = re.sub(r"^\[(.*)\]$", r"\1", value).strip()
                if value and len(value) > 2 and value.upper() != "N/A":
                    level_data[cat_name] = value

        result[level_key] = level_data

    if not result:
        logger.warning("No se encontraron niveles con patrón estándar, intentando parseo alternativo")
        result = parse_5_whys_alternative(text)

    return result


def parse_5_whys_alternative(text: str) -> dict:
    """Parseo alternativo para análisis 5 Porqués."""
    result = {}
    categories = ["Mano de Obra", "Método", "Maquinaria", "Medio Ambiente", "Material"]
    lines = text.split("\n")
    current_level = None
    current_data = {}

    for line in lines:
        line = line.strip()
        level_match = re.match(r"^(\d+)\.", line)
        if level_match:
            if current_level and current_data:
                result[f"PorQue{current_level}"] = current_data
            current_level = level_match.group(1)
            current_data = {cat: "N/A" for cat in categories}
            current_data["Pregunta"] = line
            continue

        for cat in categories:
            if cat.lower() in line.lower():
                if ":" in line:
                    value = line.split(":", 1)[-1].strip()
                    if value and len(value) > 2:
                        current_data[cat] = value
                break

    if current_level and current_data:
        result[f"PorQue{current_level}"] = current_data

    return result


# ============================================================================
# Flask app (mismos endpoints que el servidor anterior)
# ============================================================================

app = Flask(__name__) if FLASK_AVAILABLE else None


@app.route("/health", methods=["GET"]) if app else None
def health_check():
    """Verifica el estado del servidor y Ollama."""
    ollama_alive = check_ollama_alive()
    model_ready = check_model_loaded() if ollama_alive else False
    return jsonify({
        "status": "ok" if model_ready else ("loading" if ollama_alive else "ollama_down"),
        "model_loaded": model_ready,
        "model_loading": False,
        "ollama_alive": ollama_alive,
        "ollama_model": OLLAMA_MODEL,
        "timestamp": datetime.now().isoformat(),
    })


@app.route("/load", methods=["POST"]) if app else None
def load_model_endpoint():
    """Inicia la carga del modelo en Ollama (warmup)."""
    if not check_ollama_alive():
        return jsonify({
            "success": False,
            "model_loaded": False,
            "error": "Ollama no está corriendo. Ejecuta setup_ollama.ps1 o 'ollama serve'",
        }), 503

    if not check_model_loaded():
        return jsonify({
            "success": False,
            "model_loaded": False,
            "error": f"Modelo '{OLLAMA_MODEL}' no existe en Ollama. Ejecuta setup_ollama.ps1",
        }), 503

    # Forzar warmup
    success = warmup_model()
    return jsonify({
        "success": success,
        "model_loaded": _model_ready,
        "message": "Modelo cargado" if success else "Error en warmup",
    })


# Prompt para REGENERACIÓN: incluye el análisis actual, el feedback del
# usuario y opcionalmente el nivel específico a regenerar. Mantiene el formato
# exacto de salida (mismas reglas que el prompt inicial).
REGENERATE_PROMPT_TEMPLATE = """INSTRUCCIONES: Eres un analista experto en Seguridad y Salud en el Trabajo (SG-SST).

Vas a REGENERAR {scope} de un análisis 5 Porqués existente para un accidente laboral en Colombia.

{context_block}

REGLAS OBLIGATORIAS:
1. Responde SIEMPRE en español colombiano, técnico y objetivo.
2. {regenerate_rule}
3. Mantén las REGLAS del análisis original (5 niveles, 5 categorías 5M por nivel, cadena causal, sin markdown, sin preámbulos).
4. SOLO responde con el análisis nuevo en el formato exacto pedido.

FORMATO DE RESPUESTA ESTRICTO (igual que el análisis original):

{numbered_format}
"""


def build_regenerate_user_prompt(descripcion, contexto, feedback, current_analysis, level):
    """Construye el prompt del usuario para regeneración parcial o total."""
    parts = []
    parts.append(f"Descripción del accidente:\n{descripcion}")
    parts.append(f"\nContexto Adicional:\n{contexto if contexto else 'No se proporcionó contexto adicional.'}")

    if level is not None and isinstance(level, int) and 1 <= level <= 5:
        scope = f"SOLO el nivel {level}"
        regenerate_rule = (
            f"Regenera SOLO el nivel {level} del análisis. "
            f"Los niveles 1 a {level-1} (causas previas) y {level+1} a 5 (causas siguientes) NO se regeneran — deben quedar como están para mantener la cadena causal coherente."
        )
    else:
        scope = "el análisis COMPLETO"
        regenerate_rule = "Regenera los 5 niveles completos del análisis, aplicando el feedback del usuario."

    parts.append(f"\nFeedback del usuario (SG-SST profesional):\n{feedback if feedback else '(sin feedback específico, regenerar para mejorar la calidad)'}")

    if current_analysis:
        parts.append(f"\nAnálisis actual (referencia):\n{json.dumps(current_analysis, indent=2, ensure_ascii=False)}")

    parts.append(f"\nGenera {scope} con el feedback aplicado.")
    return "\n".join(parts)


def build_numbered_format(start_level, end_level):
    """Genera el bloque 'FORMATO DE RESPUESTA' para N niveles."""
    blocks = []
    for level in range(start_level, end_level + 1):
        if level == 1:
            header = "1. ¿Por qué ocurrió el accidente?"
        else:
            header = f"{level}. ¿Por qué [causa principal del nivel {level-1}]?"
        blocks.append(f"{header}\n   • Mano de Obra: [causa específica o N/A]\n   • Método: [causa específica o N/A]\n   • Maquinaria: [causa específica o N/A]\n   • Medio Ambiente: [causa específica o N/A]\n   • Material: [causa específica o N/A]\n")
    return "\n".join(blocks).strip()


@app.route("/regenerate", methods=["POST"]) if app else None
def regenerate_endpoint():
    """Regenera el análisis 5 Porqués (total o parcial) con feedback del usuario.

    Request body:
      - descripcion: descripción del accidente (requerido)
      - contexto: contexto adicional (opcional)
      - feedback: comentario del usuario para guiar la regeneración (opcional)
      - level: 1-5 para regenerar SOLO ese nivel; null/ausente para regenerar todo
      - current_analysis: análisis actual (referencia)

    Response: {success, data: {...}, raw_text, regeneration_scope, regenerated_level}
    """
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "No se proporcionaron datos"}), 400

    descripcion = data.get("descripcion", "").strip()
    contexto = data.get("contexto", "")
    feedback = data.get("feedback", "").strip()
    level = data.get("level", None)
    current_analysis = data.get("current_analysis", {})

    if not descripcion:
        return jsonify({"success": False, "error": "Se requiere descripción del accidente"}), 400

    if level is not None and not (isinstance(level, int) and 1 <= level <= 5):
        return jsonify({"success": False, "error": f"level debe ser 1-5 o null, recibido: {level}"}), 400

    if not check_ollama_alive():
        return jsonify({"success": False, "error": "Ollama no está corriendo"}), 503

    # Construir el prompt específico para regeneración
    user_prompt = build_regenerate_user_prompt(descripcion, contexto, feedback, current_analysis, level)

    # Si regenera un solo nivel, el formato solo pide ese nivel. Si regenera todo, pide los 5.
    if level is not None:
        numbered_format = build_numbered_format(level, level)
        context_block = f"Este análisis es sobre el nivel {level} de un 5 Porqués completo. El usuario quiere regenerar SOLO este nivel aplicando feedback específico."
    else:
        numbered_format = build_numbered_format(1, 5)
        context_block = "El usuario quiere regenerar el análisis 5 Porqués COMPLETO aplicando feedback específico."

    system_prompt_regen = SYSTEM_PROMPT + "\n\n" + REGENERATE_PROMPT_TEMPLATE.format(
        scope=("el nivel " + str(level)) if level else "el análisis completo",
        context_block=context_block,
        regenerate_rule=(
            f"Regenera SOLO el nivel {level} del análisis." if level
            else "Regenera los 5 niveles completos del análisis."
        ),
        numbered_format=numbered_format,
    )

    start_time = datetime.now()
    logger.info(f"[OLLAMA] Regenerando análisis (level={level}, feedback={len(feedback)} chars)...")

    try:
        response = _ollama_request(
            "/api/chat",
            "POST",
            {
                "model": OLLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt_regen},
                    {"role": "user", "content": user_prompt},
                ],
                "stream": False,
                "think": False,
                "options": {
                    "temperature": 0.4,
                    "top_p": 0.9,
                    "top_k": 20,
                    "num_predict": 4000 if level is None else 1500,
                    "repeat_penalty": 1.1,
                    "stop": ["<|im_end|>", "<|endoftext|>"],
                },
            },
            timeout=600,
        )
        msg = response.get("message", {}) or {}
        analysis_text = (msg.get("content") or "").strip()
        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"[OLLAMA] Regeneración completada en {elapsed:.1f}s ({len(analysis_text)} chars)")

        parsed_result = parse_5_whys(analysis_text)

        return jsonify({
            "success": True,
            "data": parsed_result,
            "raw_text": analysis_text,
            "generation_time": elapsed,
            "regenerated_level": level,  # None = regeneró todo, 1-5 = regeneró solo ese nivel
        })
    except Exception as e:
        logger.error(f"[OLLAMA] Error en regeneración: {e}")
        return jsonify({"success": False, "error": str(e)})


@app.route("/analyze", methods=["POST"]) if app else None
def analyze_endpoint():
    """Analiza un accidente vía Ollama."""
    data = request.get_json()

    if not data:
        return jsonify({"success": False, "error": "No se proporcionaron datos"}), 400

    descripcion = data.get("descripcion", "")
    contexto = data.get("contexto", "")

    if not descripcion:
        return jsonify({"success": False, "error": "Se requiere descripción del accidente"}), 400

    # Esperar a que Ollama y el modelo estén listos (máx 2 min)
    if not check_ollama_alive():
        return jsonify({
            "success": False,
            "error": "Ollama no está corriendo",
        }), 503

    max_attempts = 60  # 2 minutos (60 * 2s)
    for i in range(max_attempts):
        if check_model_loaded():
            break
        if i % 10 == 0 and i > 0:
            logger.info(f"[ANALYZE] Esperando modelo... ({i * 2}s)")
        time.sleep(2)
    else:
        return jsonify({
            "success": False,
            "error": f"Modelo '{OLLAMA_MODEL}' no responde",
        }), 503

    result = analyze_via_ollama(descripcion, contexto)
    return jsonify(result)


@app.route("/status", methods=["GET"]) if app else None
def status_endpoint():
    """Estado detallado del servidor."""
    ollama_alive = check_ollama_alive()
    return jsonify({
        "model_loaded": _model_ready if ollama_alive else False,
        "model_loading": False,
        "ollama_alive": ollama_alive,
        "ollama_model": OLLAMA_MODEL,
        "server_port": SERVER_PORT,
    })


def run_server():
    """Inicia el servidor Flask."""
    if not FLASK_AVAILABLE:
        logger.error("Flask no está disponible. Instalar con: pip install flask")
        return

    logger.info(f"=== K+AIR · LLM Server (wrapper Ollama) ===")
    logger.info(f"Servidor Flask: http://{SERVER_HOST}:{SERVER_PORT}")
    logger.info(f"Ollama: {OLLAMA_BASE_URL} | Modelo: {OLLAMA_MODEL}")
    logger.info("Endpoints: GET /health, POST /load, POST /analyze, GET /status")

    # Verificar Ollama al inicio (no bloquea)
    if check_ollama_alive():
        logger.info("[OK] Ollama responde")
        if check_model_loaded():
            logger.info(f"[OK] Modelo '{OLLAMA_MODEL}' disponible")
        else:
            logger.warning(
                f"[WARN] Modelo '{OLLAMA_MODEL}' no encontrado. "
                "Ejecuta setup_ollama.ps1 primero."
            )
    else:
        logger.warning(
            f"[WARN] Ollama no responde en {OLLAMA_BASE_URL}. "
            "Ejecuta 'ollama serve' antes de iniciar este servidor."
        )

    app.run(host=SERVER_HOST, port=SERVER_PORT, threaded=True)


if __name__ == "__main__":
    run_server()

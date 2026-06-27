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

# Modelo activo — VARIABLE MUTABLE para permitir cambios en caliente desde la UI.
# Antes era constante, ahora se puede cambiar via POST /models/select sin reiniciar.
_current_model_name = os.environ.get("OLLAMA_MODEL", "qwen-inv-at")  # Creado desde Modelfile

# Lock para serializar cambios de modelo (evita race conditions entre threads)
_model_lock = __import__('threading').Lock()

def get_current_model_name() -> str:
    """Devuelve el nombre del modelo actualmente activo."""
    return _current_model_name

def set_current_model_name(name: str) -> None:
    """Cambia el modelo activo en caliente (thread-safe)."""
    global _current_model_name, _model_ready, _last_check_ts
    with _model_lock:
        _current_model_name = name
        # Forzar re-verificación con el nuevo modelo
        _model_ready = False
        _last_check_ts = 0.0

# Configuración del servidor Flask (mismo puerto que antes para compatibilidad)
SERVER_PORT = int(os.environ.get("LLM_SERVER_PORT", "5555"))
SERVER_HOST = "127.0.0.1"

# Variable global para estado del modelo (Ollama mantiene el modelo en memoria,
# solo necesitamos saber si está listo y cargado)
_model_ready = False
_last_check_ts = 0.0
_CHECK_INTERVAL = 5.0  # segundos entre health checks a Ollama

# ============================================================================
# Configuración persistente (se lee/escribe desde config.json)
# El usuario puede editar temperatura, max_tokens, prompt y modelo desde la UI.
#
# NOTA: El SYSTEM_PROMPT por defecto se resuelve LAZY (cuando se llama a
# _get_default_llm_config()) porque este bloque se ejecuta ANTES de la
# definición de SYSTEM_PROMPT (línea ~175). Usar lazy evita el NameError.
# ============================================================================
import json as _json
_CONFIG_PATH = os.environ.get(
    "KPLUS_CONFIG_PATH",
    os.path.join(os.path.expanduser("~"), "AppData", "Roaming", "sgsst-electron-app", "config.json")
)

def _get_default_llm_config() -> dict:
    """Devuelve la config LLM por defecto. SYSTEM_PROMPT se resuelve aquí (lazy)."""
    return {
        "llmModel": get_current_model_name(),
        "llmTemperature": 0.4,
        "llmMaxTokens": 4000,
        "llmSystemPrompt": SYSTEM_PROMPT if "SYSTEM_PROMPT" in globals() else "",
    }

def _load_llm_config() -> dict:
    """Lee config.json y devuelve la sección LLM. Si no existe, devuelve defaults."""
    defaults = _get_default_llm_config()
    try:
        if os.path.isfile(_CONFIG_PATH):
            with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
                full = _json.load(f) or {}
            llm_cfg = full.get("llm", {})
            merged = dict(defaults)
            merged.update({k: v for k, v in llm_cfg.items() if v is not None})
            return merged
    except Exception as e:
        logger.warning(f"[CONFIG] No pude leer config LLM: {e}")
    return defaults


def _save_llm_config(cfg: dict) -> None:
    """Guarda la sección LLM en config.json. Fusiona con el resto del config existente."""
    try:
        full = {}
        if os.path.isfile(_CONFIG_PATH):
            with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
                full = _json.load(f) or {}
        full["llm"] = cfg
        os.makedirs(os.path.dirname(_CONFIG_PATH), exist_ok=True)
        with open(_CONFIG_PATH, "w", encoding="utf-8") as f:
            _json.dump(full, f, ensure_ascii=False, indent=2)
        logger.info(f"[CONFIG] LLM config guardada en {_CONFIG_PATH}")
    except Exception as e:
        logger.error(f"[CONFIG] Error guardando config LLM: {e}")
        raise


def get_llm_config() -> dict:
    """Devuelve la config LLM actual (incluyendo modelo activo)."""
    cfg = _load_llm_config()
    # El modelo activo puede diferir del guardado (cambios en caliente)
    cfg["llmModel"] = get_current_model_name()
    return cfg


def update_llm_config(cfg: dict) -> dict:
    """Actualiza config LLM y aplica cambios en caliente. Devuelve config efectiva."""
    current = _load_llm_config()
    # Solo actualizar campos provistos
    for key in ("llmTemperature", "llmMaxTokens", "llmSystemPrompt"):
        if key in cfg:
            current[key] = cfg[key]
    # Modelo: si cambia, aplicar en caliente
    if "llmModel" in cfg and cfg["llmModel"] and cfg["llmModel"] != get_current_model_name():
        new_model = cfg["llmModel"].strip()
        logger.info(f"[CONFIG] Cambiando modelo: {get_current_model_name()} → {new_model}")
        set_current_model_name(new_model)
        current["llmModel"] = new_model
    _save_llm_config(current)
    current["llmModel"] = get_current_model_name()  # reflejar el activo
    return current

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
4. CADENA CAUSAL OBLIGATORIA — la pregunta de cada nivel es "¿Por qué ocurrió [causa principal del nivel anterior]?". Por lo tanto:
   4a. Si en el nivel N una categoría X tiene una causa identificada, los niveles N+1, N+2, ... también deben responder a "¿por qué ocurrió esa causa?" — NO puedes dejar esa categoría en "N/A" en niveles intermedios (rompería la cadena).
   4b. Solo se permite "N/A" en una categoría de un nivel intermedio si la causa ya quedó completamente resuelta y NO aplica seguir preguntando.
   4c. Si en un nivel TODAS las categorías son "N/A", todos los niveles siguientes también deben ser "N/A" (no hay causa raíz para profundizar).
   4d. La causa principal de cada nivel debe ser CONSECUENCIA directa de la causa del nivel anterior (cadena coherente 5→4→3→2→1).
5. El nivel 5 debe identificar causas raíz ACCIONABLES que la empresa puede corregir.
6. NO agregues explicaciones, introducciones, conclusiones, notas adicionales ni texto fuera del formato.
7. NO uses "**", "###", ni otros marcadores de formato markdown.
8. NO escribas los prompts de ejemplo ni las instrucciones de formato; responde SOLO con el análisis.
9. Detente inmediatamente después del nivel 5.

VALIDACIÓN OBLIGATORIA POR LECTURA INVERSA (BACKWARD TEST):
Antes de entregar tu respuesta, DEBES leer tu propio análisis de nivel 5 hacia nivel 1 (de abajo hacia arriba) y verificar:

  • ¿La causa raíz del nivel 5 explica por qué existe la causa del nivel 4?
  • ¿La causa del nivel 4 explica por qué existe la causa del nivel 3?
  • ¿La causa del nivel 3 explica por qué existe la causa del nivel 2?
  • ¿La causa del nivel 2 explica por qué existe la causa del nivel 1?
  • ¿La causa del nivel 1 es la causa inmediata del accidente?

Aplica también la MATRIZ DE VALIDACIÓN al nivel 5 (causa raíz):
  • COHERENCIA: ¿La lectura inversa tiene sentido completo?
  • EVIDENCIA: ¿La causa es observable y verificable en la empresa?
  • CONTROL: ¿La organización puede intervenir esa causa con un plan de acción?
  • RECURRENCIA: ¿Esta causa podría explicar otros accidentes similares?
  • EFECTIVIDAD: ¿Eliminar esta causa evitaría la repetición del accidente?

Si encuentras saltos lógicos, identifica el nivel problemático y corrígelo INTERNAMENTE antes de responder. Solo entrega el análisis cuando la cadena inversa sea perfectamente coherente.

IMPORTANTE SOBRE LA VALIDACIÓN: Tu validación interna es solo para tu control de calidad. NO la escribas en la respuesta final. NO escribas "Validación Inversa", "Matriz de Validación", ni ningún comentario sobre coherencia, evidencia, control o efectividad. El usuario solo quiere ver los 5 niveles del análisis. La validación es invisible — la haces en tu cabeza pero no la imprimes.

EJEMPLO DE CADENA CORRECTA (Método):
  Nivel 1: "No existe procedimiento escrito para manipular objetos cortantes"
  Nivel 2: "No se realizó capacitación sobre el procedimiento existente"  ← contesta ¿por qué?
  Nivel 3: "El supervisor no verificó la competencia del personal"       ← contesta ¿por qué?
  Nivel 4: "La empresa carece de un programa de inducción específico"    ← contesta ¿por qué?
  Nivel 5: "Falta de asignación presupuestal para formación en SST"     ← causa raíz accionable
  → Lectura inversa: "Sin presupuesto para formación → sin inducción → sin verificar → sin capacitación → sin procedimiento → accidente" ✅ COHERENTE

EJEMPLO DE CADENA INCORRECTA (NO hacer esto — N/A rompe la cadena):
  Nivel 1: "No existe procedimiento escrito para manipular objetos cortantes"
  Nivel 2: N/A           ← ❌ ROMPE LA CADENA. Nivel 2 DEBE responder ¿por qué no existe procedimiento?
  Nivel 3: N/A
  Nivel 4: "La empresa carece de un programa de inducción"  ← llega "de la nada"
  Nivel 5: "Falta de presupuesto"
  → Lectura inversa: "Sin presupuesto → inducción (sin conexión con niveles 2-3) → ..." ❌ SALTO LÓGICO

EJEMPLO DE BACKWARD TEST EXITOSO (caso real de mesera con lesión lumbar):
  Nivel 5: "No se estableció un sistema de supervisión y control de calidad en tareas de alto riesgo."
    ↓ explica por qué
  Nivel 4: "No existió un programa de inducción formal al cargo para la nueva trabajadora."
    ↓ explica por qué
  Nivel 3: "No hubo asignación presupuestal para la elaboración del documento técnico de seguridad."
    ↓ explica por qué
  Nivel 2: "No se creó o no se actualizó el manual de trabajo para cubrir esta operación específica."
    ↓ explica por qué
  Nivel 1: "No existía un procedimiento escrito que describiera la postura y técnica segura."
    ↓ explica por qué
  Accidente: "La trabajadora aplicó fuerza excesiva con mala técnica para levantar cubiertos."
  → Cadena perfectamente coherente. ✅

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
        _ollama_request("/api/show", "POST", {"name": get_current_model_name()}, timeout=5)
        _model_ready = True
        _last_check_ts = now
        logger.info(f"[OLLAMA] Modelo '{get_current_model_name()}' listo")
        return True
    except HTTPError as e:
        if e.code == 404:
            logger.warning(f"[OLLAMA] Modelo '{get_current_model_name()}' no existe. Ejecuta setup_ollama.ps1")
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
                "model": get_current_model_name(),
                "prompt": "ok",
                "stream": False,
                "options": {"num_predict": 1},
            },
            timeout=120,
        )
        _model_ready = True
        logger.info(f"[OLLAMA] Modelo '{get_current_model_name()}' cargado en memoria")
        return True
    except Exception as e:
        logger.error(f"[OLLAMA] Error en warmup: {e}")
        return False


def analyze_via_ollama(descripcion: str, contexto: str = "") -> dict:
    """Llama a Ollama /api/chat para generar el análisis 5 Porqués.

    Implementa el flujo de Backward Test con auto-regeneración:
      1. Genera el análisis inicial
      2. Lo valida con la matriz de 5 criterios (continuidad, accionabilidad,
         evidencia, recurrencia, efectividad)
      3. Si falla (score < 70), regenera con feedback específico
      4. Repite hasta MAX_RETRIES o hasta que pase la validación
      5. Siempre devuelve el mejor análisis encontrado
    """
    user_prompt = build_user_prompt(descripcion, contexto)
    start_time = datetime.now()
    logger.info(f"[OLLAMA] Generando análisis ({len(descripcion)} chars desc, {len(contexto)} chars contexto)...")

    MAX_RETRIES = 1  # 1 intento inicial + 1 regeneración = 2 total (~10s máx)
    best_result = None
    best_score = -1
    last_validation = None
    accumulated_feedback = ""

    for attempt in range(MAX_RETRIES + 1):
        try:
            # Construir prompt con feedback acumulado si hay regeneración
            user_content = user_prompt
            if accumulated_feedback:
                user_content = (
                    user_prompt
                    + "\n\n--- CORRECCIÓN REQUERIDA (intento "
                    + str(attempt + 1)
                    + "/"
                    + str(MAX_RETRIES + 1)
                    + ") ---\n"
                    + accumulated_feedback
                )

            logger.info(
                f"[OLLAMA] Intento {attempt + 1}/{MAX_RETRIES + 1}"
                + (" (regeneración con feedback)" if attempt > 0 else "")
            )

            response = _ollama_request(
                "/api/chat",
                "POST",
                {
                    "model": get_current_model_name(),
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_content},
                    ],
                    "stream": False,
                    "think": False,
                    "options": {
                        "temperature": 0.4,
                        "top_p": 0.9,
                        "top_k": 20,
                        "num_predict": 4000,
                        "repeat_penalty": 1.1,
                    },
                },
                timeout=600,
            )

            msg = response.get("message", {}) or {}
            analysis_text = (msg.get("content") or "").strip()

            # Parsear + reforzar cadena causal + validar Backward Test
            parsed_result = parse_5_whys(analysis_text)
            parsed_result = _enforce_causal_chain(parsed_result)
            validation = _validate_backward_chain(parsed_result)
            last_validation = validation

            logger.info(
                f"[OLLAMA] Intento {attempt + 1}: score={validation['score']}/100 valid={validation['valid']}"
            )

            # Guardar el mejor resultado
            if validation["score"] > best_score:
                best_score = validation["score"]
                best_result = {
                    "parsed": parsed_result,
                    "raw_text": analysis_text,
                    "validation": validation,
                }

            # Si pasó la validación, devolvemos ya
            if validation["valid"]:
                elapsed = (datetime.now() - start_time).total_seconds()
                logger.info(
                    f"[OLLAMA] Análisis validado en intento {attempt + 1} "
                    f"(score={validation['score']}, tiempo={elapsed:.1f}s)"
                )
                return {
                    "success": True,
                    "data": parsed_result,
                    "raw_text": analysis_text,
                    "generation_time": elapsed,
                    "validation": validation,
                    "attempts": attempt + 1,
                }

            # No pasó: preparar feedback para siguiente intento
            accumulated_feedback = _build_regeneration_feedback(validation)

        except Exception as e:
            logger.error(f"[OLLAMA] Error en intento {attempt + 1}: {e}")
            if best_result is None:
                return {"success": False, "error": str(e)}
            break

    # Se agotaron los reintentos: devolver el mejor resultado con warning
    elapsed = (datetime.now() - start_time).total_seconds()
    if best_result:
        logger.warning(
            f"[OLLAMA] Backward Test no aprobado tras {MAX_RETRIES + 1} intentos. "
            f"Mejor score: {best_score}/100"
        )
        return {
            "success": True,
            "data": best_result["parsed"],
            "raw_text": best_result["raw_text"],
            "generation_time": elapsed,
            "validation": best_result["validation"],
            "attempts": MAX_RETRIES + 1,
            "validation_warning": (
                f"Análisis entregado con score {best_score}/100 — "
                "recomendamos revisar manualmente. Issues: "
                + "; ".join(best_result["validation"].get("issues", [])[:3])
            ),
        }

    return {
        "success": False,
        "error": "No se pudo generar el análisis tras múltiples intentos",
        "validation": last_validation,
    }

# ============================================================================
# ============================================================================
# Parser de 5 Porqués (idéntico al servidor anterior)
# ============================================================================

def _strip_post_level5_content(text: str) -> str:
    """Corta todo el contenido que el modelo escribe DESPUÉS del bloque del nivel 5.

    El modelo 2B a veces incluye su "Backward Test interno", "Matriz de Validación"
    u otros comentarios fuera del formato esperado. Eso contamina la última celda
    del nivel 5 (porque es donde el parser deja de encontrar categorías).

    Estrategia: encontrar el inicio del nivel 5, capturar solo hasta la última
    categoría esperada (Material:), descartar el resto.
    """
    # Buscar el inicio del nivel 5
    m = re.search(r'5\.\s*[¿?]?\s*Por\s*qu[eé][¿?]?', text, re.IGNORECASE)
    if not m:
        return text
    start_level5 = m.start()
    after = text[start_level5:]

    # Encontrar la posición donde termina el bloque válido del nivel 5
    # (justo después de la última línea "Material:" o "• Material:")
    last_category_end = None
    for pattern in [
        r'[•\-\*\.\u2022]?\s*material\s*[:\-][^\n]*',  # "Material: ..." o "• Material: ..."
        r'[•\-\*\.\u2022]?\s*medio ambiente\s*[:\-][^\n]*',  # fallback
    ]:
        for m2 in re.finditer(pattern, after, re.IGNORECASE | re.MULTILINE):
            last_category_end = m2.end()

    if last_category_end:
        cleaned = text[:start_level5] + after[:last_category_end]
        if len(cleaned) < len(text):
            logger.info(
                f"[PARSER] Stripped {len(text) - len(cleaned)} chars de contenido "
                f"extra después del nivel 5"
            )
        return cleaned
    return text


def parse_5_whys(text: str) -> dict:
    """Parsea el texto del análisis 5 Porqués a estructura JSON."""
    # Primero limpiar contenido extra que el modelo pueda haber agregado
    # fuera del formato (ej: "Validación Inversa", "Matriz de Validación")
    text = _strip_post_level5_content(text)

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


def _is_na(value) -> bool:
    """Detecta si un valor es N/A en cualquiera de sus variantes comunes."""
    if not value:
        return True
    v = str(value).strip().upper()
    return v in ("N/A", "NA", "N.A.", "N.A", "-", "--", "")


def _enforce_causal_chain(parsed: dict) -> dict:
    """
    Post-procesa el resultado del parser 5 Porqués para reforzar la cadena causal.

    Problema que resuelve: modelos pequeños (2B parámetros) tienden a generar cada
    nivel de forma independiente, lo que rompe la cadena causal (saltos a N/A en
    medio de columnas que sí tienen causa en niveles superior e inferior).

    Reglas aplicadas:
      1. Forward-fill por columna (categoría 5M): si una columna tiene causa en
         nivel N pero N+1 está en N/A, y luego vuelve a tener causa en N+2 o
         posteriores → se rellena el hueco N+1 con la causa más cercana que
         mantenga coherencia causal (se prefiere la causa del nivel anterior
         porque la pregunta del nivel N+1 es "¿por qué ocurrió [causa N]?").

      2. Propagación de niveles vacíos: si un nivel tiene TODAS sus categorías
         en N/A, todos los niveles siguientes en todas las categorías también
         deben ser N/A (no tiene sentido seguir preguntando "¿por qué?" cuando
         no hay causa para profundizar).

      3. Se preserva la causa raíz del nivel 1: si nivel 1 tiene causa, los
         niveles 2-5 deben continuar la cadena en al menos una columna.
    """
    if not parsed:
        return parsed

    categories = ["Mano de Obra", "Método", "Maquinaria", "Medio Ambiente", "Material"]
    levels = sorted(parsed.keys(), key=lambda k: int(k.replace("PorQue", "")) if k.replace("PorQue", "").isdigit() else 999)

    # ── Regla 2: propagación de niveles vacíos ──
    # Si un nivel tiene TODAS sus categorías en N/A, marcar todos los siguientes.
    last_filled_level_idx = -1
    for idx, level_key in enumerate(levels):
        level_data = parsed[level_key]
        all_na = all(_is_na(level_data.get(cat, "N/A")) for cat in categories)
        if all_na and last_filled_level_idx == -1:
            # Encontramos el primer nivel completamente vacío. Todo lo de después también debe estar vacío.
            pass
        elif not all_na:
            last_filled_level_idx = idx

    # Si hay un nivel completamente vacío entre niveles con causa, es una rotura.
    # Buscar gaps y rellenarlos según las siguientes reglas.
    if last_filled_level_idx > 0:
        for idx in range(last_filled_level_idx + 1, len(levels)):
            level_data = parsed[levels[idx]]
            all_na = all(_is_na(level_data.get(cat, "N/A")) for cat in categories)
            if not all_na:
                # Este nivel tiene causa pero hay gap anterior. Verificar gap.
                pass

    # ── Regla 1: forward-fill y backward-fill por columna ──
    for cat in categories:
        # Forward-pass: encontrar la última causa antes de un N/A y rellenar huecos.
        last_value = None
        last_idx_with_value = -1
        for idx, level_key in enumerate(levels):
            value = parsed[level_key].get(cat, "N/A")
            if not _is_na(value):
                # Hay una causa. Rellenar huecos entre last_idx_with_value+1 e idx-1.
                if last_idx_with_value >= 0 and idx - last_idx_with_value > 1:
                    for gap_idx in range(last_idx_with_value + 1, idx):
                        gap_level = levels[gap_idx]
                        if _is_na(parsed[gap_level].get(cat, "N/A")):
                            # Solo rellenar si NO hemos encontrado el final de la cadena
                            # (si el gap está antes del final del análisis, es una rotura)
                            parsed[gap_level][cat] = last_value
                last_value = value
                last_idx_with_value = idx

        # Backward-fill: si los primeros niveles están en N/A pero los últimos tienen causa,
        # propagar la causa más temprana hacia atrás (es raro pero puede pasar).
        first_value = None
        first_idx_with_value = -1
        for idx, level_key in enumerate(levels):
            value = parsed[level_key].get(cat, "N/A")
            if not _is_na(value):
                first_value = value
                first_idx_with_value = idx
                break
        # (No aplicamos backward-fill agresivo — solo rellenamos huecos intermedios)

    # ── Regla 2 (final): forzar N/A en cascada si un nivel está completamente vacío ──
    # Buscar el primer nivel que tenga TODAS las categorías en N/A. Si existe y hay
    # niveles anteriores con causa, vaciar todos los niveles siguientes.
    first_empty_idx = None
    for idx, level_key in enumerate(levels):
        level_data = parsed[level_key]
        if all(_is_na(level_data.get(cat, "N/A")) for cat in categories):
            first_empty_idx = idx
            break

    if first_empty_idx is not None and first_empty_idx > 0:
        # Verificar que niveles anteriores tengan causa real (al menos una categoría con causa)
        prev_has_cause = any(
            not _is_na(parsed[levels[i]].get(cat, "N/A"))
            for i in range(first_empty_idx)
            for cat in categories
        )
        if prev_has_cause:
            # Vaciar todos los niveles desde first_empty_idx en adelante
            for idx in range(first_empty_idx, len(levels)):
                for cat in categories:
                    parsed[levels[idx]][cat] = "N/A"

    logger.info(f"[CADENA_CAUSAL] Post-procesamiento aplicado a {len(levels)} niveles")
    return parsed


# ============================================================================
# Validación por Lectura Inversa (Backward Test)
# ============================================================================

# Stopwords para español (palabras a ignorar en el análisis de coherencia léxica)
_STOPWORDS_ES = {
    "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al",
    "y", "o", "u", "en", "a", "por", "para", "con", "sin", "sobre", "entre",
    "que", "se", "es", "son", "fue", "ser", "estar", "esta", "este", "estos",
    "estas", "no", "si", "le", "les", "lo", "su", "sus", "mi", "mis", "tu",
    "tus", "como", "más", "menos", "muy", "ya", "ha", "han", "hay", "había",
    "ser", "estar", "tener", "haber", "ir", "ver", "dar", "saber", "querer",
    "porque", "porqué", "porque", "nivel", "ocurrió", "ocurre",
}

# Patrones que indican causa raíz ACCIONABLE en nivel 5
_ACTIONABLE_PATTERNS = [
    "falta de", "ausencia de", "no existe", "no hay", "no se",
    "carencia de", "deficiencia de", "no realizó", "no se realizó",
    "no se asignó", "no se estableció", "no se creó", "no se elaboró",
    "no se implementó", "no se definió", "no se hizo", "insuficiente",
    "inexistente", "no contaba con", "no se contaba", "sin programa",
    "sin procedimiento", "sin protocolo", "sin supervisión",
]


def _extract_keywords(text: str) -> list:
    """Extrae palabras significativas (>3 chars, no stopwords) en minúsculas."""
    import re as _re
    # Normalizar: minúsculas, sin tildes para matching
    text_norm = text.lower()
    # Quitar acentos para matching más robusto
    text_norm = _re.sub(r'[áàäâ]', 'a', text_norm)
    text_norm = _re.sub(r'[éèëê]', 'e', text_norm)
    text_norm = _re.sub(r'[íìïî]', 'i', text_norm)
    text_norm = _re.sub(r'[óòöô]', 'o', text_norm)
    text_norm = _re.sub(r'[úùüû]', 'u', text_norm)
    text_norm = _re.sub(r'[ñ]', 'n', text_norm)
    # Tokenizar
    tokens = _re.findall(r'\b[a-z]{4,}\b', text_norm)
    return [t for t in tokens if t not in _STOPWORDS_ES]


def _validate_backward_chain(parsed: dict) -> dict:
    """
    Aplica el Backward Test al análisis 5 Porqués.

    Matriz de validación:
      1. COHERENCIA (peso 40): lectura inversa tiene sentido completo
         - Continuidad por columna: no debe haber N/A entre niveles con causa
         - Continuidad léxica inversa: cada nivel N+1 debe compartir palabras
           clave con el nivel N (overlap mínimo del 15%)
      2. ACCIONABILIDAD (peso 25): el nivel 5 identifica causa raíz accionable
         - Debe contener patrones de causa raíz ("falta de", "no existe", etc.)
      3. EVIDENCIA (peso 15): existe al menos un nivel con causa específica
         y verificable
      4. RECURRENCIA (peso 10): la causa raíz es generalizable
      5. EFECTIVIDAD (peso 10): la causa raíz puede ser intervenida

    Retorna:
        {
            "valid": bool,            # True si score >= 70
            "score": int (0-100),     # calidad global del análisis
            "issues": list[str],      # problemas detectados
            "details": dict           # score por criterio
        }
    """
    if not parsed:
        return {"valid": False, "score": 0, "issues": ["Análisis vacío"], "details": {}}

    categories = ["Mano de Obra", "Método", "Maquinaria", "Medio Ambiente", "Material"]
    levels = sorted(
        parsed.keys(),
        key=lambda k: int(k.replace("PorQue", "")) if k.replace("PorQue", "").isdigit() else 999
    )

    issues = []
    details = {}

    # ── 1. COHERENCIA (40 pts) ──

    # 1a. Continuidad estructural (30 pts): no debe haber N/A entre niveles con causa
    structural_score = 30
    for cat in categories:
        # Detectar gaps de N/A rodeados por causas
        for i in range(len(levels)):
            if _is_na(parsed[levels[i]].get(cat, "N/A")):
                # Buscar si hay causa arriba y abajo
                has_above = any(
                    not _is_na(parsed[levels[j]].get(cat, "N/A"))
                    for j in range(i)
                )
                has_below = any(
                    not _is_na(parsed[levels[j]].get(cat, "N/A"))
                    for j in range(i + 1, len(levels))
                )
                if has_above and has_below:
                    issues.append(f"Ruptura causal en {cat}: nivel {i+1} en N/A pero niveles anteriores y posteriores tienen causa")
                    structural_score -= 5

    # 1b. Continuidad léxica inversa (10 pts, máximo): heurística suave.
    # No penaliza fuertemente — solo aporta info. La verdadera coherencia causal
    # la verifica el LLM en su re-generación, no este validador de keywords.
    lexical_score = 0
    lexical_total = 0
    lexical_overlaps = []
    for i in range(len(levels) - 1):
        level_n = parsed[levels[i]]
        level_n1 = parsed[levels[i + 1]]
        # Texto de todas las categorías no-N/A de cada nivel
        text_n = " ".join(
            str(level_n.get(c, ""))
            for c in categories
            if not _is_na(level_n.get(c, "N/A"))
        )
        text_n1 = " ".join(
            str(level_n1.get(c, ""))
            for c in categories
            if not _is_na(level_n1.get(c, "N/A"))
        )
        if text_n.strip() and text_n1.strip():
            keywords_n = set(_extract_keywords(text_n))
            keywords_n1 = set(_extract_keywords(text_n1))
            if keywords_n and keywords_n1:
                overlap = keywords_n & keywords_n1
                overlap_ratio = len(overlap) / max(len(keywords_n), len(keywords_n1))
                lexical_total += 1
                lexical_overlaps.append(overlap_ratio)
                # Solo informativo — no penaliza el score.
                if overlap_ratio < 0.10:
                    issues.append(
                        f"Posible salto lógico entre nivel {i+1} y nivel {i+2} "
                        f"(overlap léxico={overlap_ratio:.0%}, informativo)"
                    )

    # Asignar 0-10 pts al overlap promedio (heurística suave)
    if lexical_total > 0:
        avg_overlap = sum(lexical_overlaps) / lexical_total
        lexical_score = int(avg_overlap * 10)  # 0-10 pts
    continuity_score = max(0, structural_score) + lexical_score
    details["continuity"] = continuity_score
    details["continuity_structural"] = structural_score
    details["continuity_lexical"] = lexical_score

    # ── 2. ACCIONABILIDAD del nivel 5 (25 pts) ──
    actionability_score = 0
    last_level_key = levels[-1]
    last_data = parsed[last_level_key]
    actionable_found = []
    for cat in categories:
        value = last_data.get(cat, "N/A")
        if not _is_na(value):
            value_lower = value.lower()
            for pattern in _ACTIONABLE_PATTERNS:
                if pattern in value_lower:
                    actionable_found.append(f"{cat}: '{pattern}'")
                    break
    if actionable_found:
        actionability_score = 25
    else:
        actionability_score = 10  # El nivel 5 existe pero no es accionable
        issues.append("Nivel 5 (causa raíz) no contiene patrones accionables ('falta de', 'no existe', etc.)")
    details["actionability"] = actionability_score

    # ── 3. EVIDENCIA (15 pts) ──
    evidence_score = 0
    total_non_na = 0
    for level_key in levels:
        for cat in categories:
            value = parsed[level_key].get(cat, "N/A")
            if not _is_na(value):
                total_non_na += 1
    # Análisis con al menos 5 causas reales (1 por nivel) = evidencia sólida
    if total_non_na >= 5:
        evidence_score = 15
    elif total_non_na >= 3:
        evidence_score = 10
    elif total_non_na >= 1:
        evidence_score = 5
    else:
        issues.append("Análisis sin causas específicas (todas las celdas en N/A)")
    details["evidence"] = evidence_score

    # ── 4. RECURRENCIA (10 pts) ──
    # La causa raíz debería ser generalizable (no un caso único).
    # Heurística: que la causa del nivel 5 no contenga detalles muy específicos
    # (fechas, nombres propios, números de documento).
    recurrence_score = 10
    if actionable_found:
        last_text = " ".join(
            str(last_data.get(c, "")) for c in categories if not _is_na(last_data.get(c, "N/A"))
        ).lower()
        specific_markers = ["laura", "martinez", "garcia", "2026", "1143263"]
        if any(marker in last_text for marker in specific_markers):
            recurrence_score = 5
            issues.append("Nivel 5 muy específico (nombres/fechas propios) — difícilmente recurrente")
    details["recurrence"] = recurrence_score

    # ── 5. EFECTIVIDAD (10 pts) ──
    # La causa raíz debería ser eliminable con un plan de acción.
    effectiveness_score = 10
    if not actionable_found:
        effectiveness_score = 0
        issues.append("Causa raíz no accionable — la empresa no puede intervenir")
    details["effectiveness"] = effectiveness_score

    # Score total
    total_score = continuity_score + actionability_score + evidence_score + recurrence_score + effectiveness_score
    total_score = max(0, min(100, total_score))

    is_valid = total_score >= 70

    logger.info(
        f"[BACKWARD_TEST] Score={total_score}/100 valid={is_valid} "
        f"continuity={continuity_score} actionability={actionability_score} "
        f"evidence={evidence_score} recurrence={recurrence_score} effectiveness={effectiveness_score}"
    )
    if issues:
        logger.warning(f"[BACKWARD_TEST] Issues: {issues}")

    return {
        "valid": is_valid,
        "score": total_score,
        "issues": issues,
        "details": details,
    }


def _build_regeneration_feedback(validation: dict) -> str:
    """Construye un mensaje de feedback específico para regenerar el análisis."""
    issues = validation.get("issues", [])
    if not issues:
        return ""
    # Feedback corto y directo: el prompt largo puede hacer que el modelo entre en loop.
    feedback = "Mejoras requeridas:\n"
    for issue in issues[:3]:  # máximo 3 issues
        feedback += f"- {issue}\n"
    feedback += "Regenera corrigiendo."
    return feedback


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
        "ollama_model": get_current_model_name(),
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
            "error": f"Modelo '{get_current_model_name()}' no existe en Ollama. Ejecuta setup_ollama.ps1",
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
                "model": get_current_model_name(),
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
                },
            },
            timeout=600,
        )
        msg = response.get("message", {}) or {}
        analysis_text = (msg.get("content") or "").strip()
        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"[OLLAMA] Regeneración completada en {elapsed:.1f}s ({len(analysis_text)} chars)")

        parsed_result = parse_5_whys(analysis_text)
        # Post-procesar para reforzar la cadena causal (fill-forward de N/A rotos)
        parsed_result = _enforce_causal_chain(parsed_result)

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
            "error": f"Modelo '{get_current_model_name()}' no responde",
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
        "ollama_model": get_current_model_name(),
        "server_port": SERVER_PORT,
    })


# ============================================================================
# Endpoints de Gestión de Modelo + Configuración (UI de Configuración IA)
# ============================================================================

@app.route("/models", methods=["GET"]) if app else None
def list_models_endpoint():
    """Lista los modelos Ollama disponibles usando /api/tags."""
    try:
        response = _ollama_request("/api/tags", "GET", timeout=10)
        models = response.get("models", []) if isinstance(response, dict) else []
        return jsonify({
            "success": True,
            "models": [
                {
                    "name": m.get("name"),
                    "size": m.get("size"),
                    "modified_at": m.get("modified_at"),
                    "details": m.get("details", {}),
                }
                for m in models
                if m.get("name")
            ],
            "active_model": get_current_model_name(),
        })
    except Exception as e:
        logger.error(f"[MODELS] Error listando modelos Ollama: {e}")
        return jsonify({
            "success": False,
            "error": str(e),
            "models": [],
            "active_model": get_current_model_name(),
        }), 500


@app.route("/models/select", methods=["POST"]) if app else None
def select_model_endpoint():
    """Cambia el modelo activo en caliente. Body: { "model": "nombre" }"""
    try:
        payload = request.get_json(silent=True) or {}
        new_model = (payload.get("model") or "").strip()
        if not new_model:
            return jsonify({"success": False, "error": "Se requiere el nombre del modelo"}), 400

        old_model = get_current_model_name()
        set_current_model_name(new_model)
        logger.info(f"[MODELS] Modelo cambiado en caliente: {old_model} → {new_model}")

        # Verificar que el modelo existe en Ollama
        model_exists = False
        try:
            _ollama_request("/api/show", "POST", {"name": new_model}, timeout=5)
            model_exists = True
        except HTTPError as e:
            if e.code == 404:
                model_exists = False
            else:
                raise

        return jsonify({
            "success": True,
            "active_model": get_current_model_name(),
            "previous_model": old_model,
            "model_exists_in_ollama": model_exists,
            "warning": None if model_exists else (
                f"El modelo '{new_model}' no existe en Ollama. "
                "Ejecuta setup_ollama.ps1 para crearlo desde el .gguf correspondiente."
            ),
        })
    except Exception as e:
        logger.error(f"[MODELS] Error cambiando modelo: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/llm-config", methods=["GET"]) if app else None
def get_llm_config_endpoint():
    """Devuelve la configuración LLM actual (modelo + temperatura + max_tokens + prompt)."""
    try:
        return jsonify({"success": True, "config": get_llm_config()})
    except Exception as e:
        logger.error(f"[LLM-CONFIG] Error leyendo config: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/llm-config", methods=["POST"]) if app else None
def save_llm_config_endpoint():
    """Actualiza la configuración LLM y persiste en config.json.
    Body: { "llmModel"?, "llmTemperature"?, "llmMaxTokens"?, "llmSystemPrompt"? }
    El cambio de modelo se aplica en caliente.
    """
    try:
        payload = request.get_json(silent=True) or {}
        updated = update_llm_config(payload)
        logger.info(
            f"[LLM-CONFIG] Config actualizada: model={updated.get('llmModel')}, "
            f"temp={updated.get('llmTemperature')}, max_tokens={updated.get('llmMaxTokens')}"
        )
        return jsonify({"success": True, "config": updated})
    except Exception as e:
        logger.error(f"[LLM-CONFIG] Error guardando config: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


def run_server():
    """Inicia el servidor Flask."""
    if not FLASK_AVAILABLE:
        logger.error("Flask no está disponible. Instalar con: pip install flask")
        return

    # Cargar config persistente (modelo, temperatura, etc.) ANTES del primer request
    try:
        persisted = _load_llm_config()
        if persisted.get("llmModel") and persisted["llmModel"] != _current_model_name:
            logger.info(f"[CONFIG] Aplicando modelo persistido: {persisted['llmModel']}")
            set_current_model_name(persisted["llmModel"])
    except Exception as e:
        logger.warning(f"[CONFIG] No pude aplicar config persistida: {e}")

    logger.info(f"=== K+AIR · LLM Server (wrapper Ollama) ===")
    logger.info(f"Servidor Flask: http://{SERVER_HOST}:{SERVER_PORT}")
    logger.info(f"Ollama: {OLLAMA_BASE_URL} | Modelo: {get_current_model_name()}")
    logger.info("Endpoints: GET /health, POST /load, POST /analyze, GET /status, GET /models, POST /models/select, GET /llm-config, POST /llm-config")

    # Verificar Ollama al inicio (no bloquea)
    if check_ollama_alive():
        logger.info("[OK] Ollama responde")
        if check_model_loaded():
            logger.info(f"[OK] Modelo '{get_current_model_name()}' disponible")
        else:
            logger.warning(
                f"[WARN] Modelo '{get_current_model_name()}' no encontrado. "
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

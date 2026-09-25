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
import threading
import subprocess
import shutil
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
# Sin fallback silencioso: vacío = sin modelo configurado; la UI avisa y el
# usuario descarga uno desde Configuración › IA (HuggingFace).
_current_model_name = os.environ.get("OLLAMA_MODEL", "")

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
        # Entrenamiento del modelo (Qwen3.5-0.8b-ia): temp 0.1, top_p 0.8,
        # repeat_penalty 1.15, presence_penalty 0 (ver options en analyze/regenerate).
        "llmTemperature": 0.1,
        "llmMaxTokens": 1216,
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
    # Repo HF activo (selector del panel Configuración › IA)
    if "llmHfRepo" in cfg:
        current["llmHfRepo"] = str(cfg["llmHfRepo"] or "").strip()[:200]
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
# SYSTEM = reglas de investigación; USER = plantilla entrenada + datos (verbatim).
# Se envía vía Ollama /api/chat con messages separados para formato chat nativo.
# ============================================================================

SYSTEM_PROMPT = """Eres un asistente de investigación de accidentes de trabajo. Analiza cada caso
con la metodología 5 Porqués y las categorías 5M, respondiendo exactamente en
el formato solicitado, sin texto adicional.

Regla de exoneración: si el texto indica que el trabajador realizaba la tarea
de forma normal (sin fuerza excesiva, sin prisa, sin golpes previos), Mano de
Obra permanece N/A en todos los niveles y la cadena causal se desarrolla por
Método, Maquinaria o Material.

Regla de atribución: si el texto describe actos u omisiones del trabajador que
contribuyen al evento (intervenir sin desenergizar, no usar EPP disponible,
alimentar máquinas con manos en zona de peligro), regístralos en Mano de Obra
del nivel 1; y registra en Material el EPP o herramienta faltante que el texto
mencione.

Nunca inventes comportamientos, fuerzas o prisa que el texto no mencione.

**Regla de incertidumbre: si el contexto indica que una condición no está
documentada o es incierta (ej: "no se reporta si estaba húmedo o seco"),
regístralo como falla de Método en la investigación (investigación incompleta)
en lugar de afirmar una condición específica no verificada.**"""

# Plantilla entrenada (verbatim) del mensaje del USUARIO: instrucciones,
# metodología 5 Porqués, reglas, formato estricto y cierre.
# NO parafrasear: el modelo (Qwen3.5-0.8b-ia) fue afinado con ESTE texto exacto.
INSTRUCCIONES_PROMPT = """INSTRUCCIONES: Genera un análisis 5 Porqués COMPLETO para el siguiente accidente laboral.

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

ACCIDENTE A ANALIZAR:"""


def build_user_prompt(descripcion: str, contexto: str) -> str:
    """Construye el mensaje del usuario: plantilla entrenada + datos del accidente.

    NOTA (dataset v4_final): las secciones del accidente van en negrita
    (**Descripción...**, **Contexto Adicional:**, **Análisis de 5 Porqués:**)
    — el modelo se entrenó con ESE formato; sin los asteriscos queda fuera de
    distribución (copia la plantilla literal en vez de analizar).
    """
    contexto_str = contexto if contexto else "No se proporcionó contexto adicional."
    return (
        INSTRUCCIONES_PROMPT
        + "\n\n**Descripción del accidente:**\n"
        + descripcion
        + "\n\n**Contexto Adicional:**\n"
        + contexto_str
        + "\n\n**Análisis de 5 Porqués:**"
    )


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
    if not get_current_model_name():
        return False
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
            logger.warning(
                f"[OLLAMA] Modelo '{get_current_model_name()}' no existe. "
                "Descárgalo desde Configuración › IA (HuggingFace)."
            )
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
    if not get_current_model_name():
        return {
            "success": False,
            "error": (
                "No hay modelo de IA configurado. Ve a Configuración › IA "
                "y descarga un modelo (HuggingFace)."
            ),
        }

    llm_cfg = get_llm_config()
    system_prompt = llm_cfg.get("llmSystemPrompt") or SYSTEM_PROMPT
    temperature = float(llm_cfg.get("llmTemperature", 0.1))
    max_tokens = int(llm_cfg.get("llmMaxTokens", 1216))

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
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content},
                    ],
                    "stream": False,
                    "think": False,
                    "options": {
                        # Muestreo del entrenamiento: temp 0.1, top_p 0.8,
                        # top_k 20, min_p 0, repeat_penalty 1.15, presence 0.
                        "temperature": temperature,
                        "top_p": 0.8,
                        "top_k": 20,
                        "min_p": 0,
                        "num_predict": max_tokens,
                        "repeat_penalty": 1.15,
                        "presence_penalty": 0,
                        # Corte duro: si el modelo ignora "EXACTAMENTE 5 niveles"
                        # y empieza a escribir el nivel 6, Ollama deja de generar.
                        "stop": ["6. ¿Por qué", "6. Por qué", "6.¿Por qué"],
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
                _uniform_preguntas(parsed_result)
                return {
                    "success": True,
                    "data": parsed_result,
                    "raw_text": analysis_text,
                    "generation_time": elapsed,
                    "validation": validation,
                    "attempts": attempt + 1,
                }

            # No pasó: si el fallo es CADENA ESTANCADA, el feedback no mueve a
            # los modelos chiquitos (log 2026-09-24 19:58: intento 2 con
            # feedback siguió en 19 celdas repetidas) → construir la cadena
            # nivel por nivel, sustituyendo NOSOTROS la causa real.
            if validation["details"].get("repetition_cells", 0) >= 6:
                parsed_it, val_it, raw_it = _analyze_iterative_chain(
                    descripcion, contexto, llm_cfg, system_prompt,
                    seed_level1=parsed_result.get("PorQue1"),
                )
                rep_ss = validation["details"].get("repetition_cells", 999)
                rep_it = val_it["details"].get("repetition_cells", 999)
                # La calidad de la cadena va primero: el single-shot estancado
                # puede ganar por score (el overlap léxico premia lo idéntico
                # y el relleno genérico), así que si la iterativa repite MENOS
                # celdas se devuelve AUNQUE su score sea menor. A igual
                # repetición, gana el score. (Caso real 21:16: single-shot
                # score=70 / 20 repetidas vs iterativa 68 / 10 repetidas.)
                if rep_it < rep_ss or (rep_it == rep_ss and val_it["score"] > best_score):
                    best_score = val_it["score"]
                    best_result = {"parsed": parsed_it, "raw_text": raw_it, "validation": val_it, "iterative": True}
                if val_it["valid"]:
                    elapsed = (datetime.now() - start_time).total_seconds()
                    logger.info(
                        f"[OLLAMA] Cadena iterativa validada "
                        f"(score={val_it['score']}, tiempo={elapsed:.1f}s)"
                    )
                    _uniform_preguntas(parsed_it)
                    return {
                        "success": True,
                        "data": parsed_it,
                        "raw_text": raw_it,
                        "generation_time": elapsed,
                        "validation": val_it,
                        "attempts": attempt + 2,
                        "mode": "iterativo",
                    }
                # La iterativa tampoco validó: el feedback retry tampoco serviría
                # (mismo modelo, mismo problema). Devolver el mejor resultado.
                break

            # No pasó por otro motivo: preparar feedback para siguiente intento
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
        _uniform_preguntas(best_result["parsed"])
        return {
            "success": True,
            "data": best_result["parsed"],
            "raw_text": best_result["raw_text"],
            "generation_time": elapsed,
            "validation": best_result["validation"],
            "attempts": MAX_RETRIES + 1,
            "mode": "iterativo" if best_result.get("iterative") else "single-shot",
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

    # El bloque del nivel 5 termina en el PRÓXIMO encabezado de nivel ("6. ¿Por qué...").
    # SIN este corte, si el modelo escribe niveles 6+, la búsqueda de categorías
    # recorría todo el texto restante hasta el ÚLTIMO nivel y no cortaba nada.
    next_level = re.search(
        r'\n\s*\d+\.\s*[¿?]?\s*Por\s*qu[eé]',
        after,
        re.IGNORECASE,
    )
    level5_region = after[: next_level.start()] if next_level else after

    # Encontrar la posición donde termina el bloque válido del nivel 5
    # (justo después de la última línea "Material:" o "• Material:")
    # OJO: se toma el MÁXIMO entre patrones — "Medio Ambiente" aparece ANTES
    # que "Material" en cada nivel y antes sobrescribía el fin de corte,
    # comiéndose la línea Material del nivel 5.
    last_category_end = None
    for pattern in [
        r'[•\-\*\.\u2022]?\s*material\s*[:\-][^\n]*',  # "Material: ..." o "• Material: ..."
        r'[•\-\*\.\u2022]?\s*medio ambiente\s*[:\-][^\n]*',  # fallback
    ]:
        for m2 in re.finditer(pattern, level5_region, re.IGNORECASE | re.MULTILINE):
            if last_category_end is None or m2.end() > last_category_end:
                last_category_end = m2.end()

    if last_category_end:
        cleaned = text[:start_level5] + level5_region[:last_category_end]
        if len(cleaned) < len(text):
            logger.info(
                f"[PARSER] Stripped {len(text) - len(cleaned)} chars de contenido "
                f"extra después del nivel 5"
            )
        return cleaned
    if next_level:
        cleaned = text[:start_level5] + level5_region
        if len(cleaned) < len(text):
            logger.info(
                f"[PARSER] Stripped {len(text) - len(cleaned)} chars de contenido "
                f"extra después del nivel 5"
            )
        return cleaned
    return text


_CATEGORIES_ORDER = ("Mano de Obra", "Método", "Maquinaria", "Medio Ambiente", "Material")


def _extract_categories(level_content: str) -> dict:
    """Extrae los valores 5M de un bloque de nivel (dict catálogo → texto).

    Aceptar bullets: • (Unicode), -, *, o . (Qwen3.5 a veces usa "• Mano" como ". Mano").
    Solo devuelve categorías con texto real (N/A y vacíos quedan fuera).
    """
    values = {}
    category_map = {
        "mano de obra": "Mano de Obra",
        "método": "Método",
        "metodo": "Método",
        "maquinaria": "Maquinaria",
        "medio ambiente": "Medio Ambiente",
        "material": "Material",
    }
    for cat_key, cat_name in category_map.items():
        cat_pattern = rf"[•\-\*\.\u2022]\s*{re.escape(cat_key)}\s*[:\-]?\s*(.*?)(?=[•\-\*\.\u2022]\s*(?:Mano|M[eé]todo|Maquinaria|Medio|Material)|$)"
        match = re.search(cat_pattern, level_content, re.IGNORECASE | re.DOTALL)
        if match:
            value = match.group(1).strip()
            value = re.sub(r"^[:\-\s]+", "", value)
            value = re.sub(r"\s+$", "", value)
            # Limpiar corchetes decorativos que pone el modelo (ej: [texto] -> texto)
            value = re.sub(r"^\[(.*)\]$", r"\1", value).strip()
            if value and len(value) > 2 and value.upper() != "N/A":
                values[cat_name] = value
    return values


def parse_5_whys(text: str) -> dict:
    """Parsea el texto del análisis 5 Porqués a estructura JSON."""
    # Primero limpiar contenido extra que el modelo pueda haber agregado
    # fuera del formato (ej: "Validación Inversa", "Matriz de Validación")
    text = _strip_post_level5_content(text)

    result = {}

    level_pattern = r"(\d+)\.\s*[¿?]?\s*Por\s*qu[eé][¿?]?\s*(?:ocurrió\s*el\s*accidente)?[:\s]*(.*?)(?=\d+\.\s*[¿?]?\s*Por\s*qu[eé][¿?]?|$)"
    levels = re.findall(level_pattern, text, re.DOTALL | re.IGNORECASE)

    dropped_out_of_range = 0
    for level_num, level_content in levels:
        try:
            level_n = int(level_num)
        except ValueError:
            continue
        # Tope duro de la metodología: SOLO niveles 1-5. Modelos pequeños a veces
        # generan 6, 10 o hasta 36 "porqués" y antes se pasaban al frontend entero.
        if level_n < 1 or level_n > 5:
            dropped_out_of_range += 1
            continue
        level_key = f"PorQue{level_n}"
        level_data = {
            "Pregunta": f"¿Por qué? - Nivel {level_n}",
            "Mano de Obra": "N/A",
            "Método": "N/A",
            "Maquinaria": "N/A",
            "Medio Ambiente": "N/A",
            "Material": "N/A",
        }

        level_data.update(_extract_categories(level_content))

        # Pregunta real de la cadena causal (extraída del texto del modelo o
        # sintetizada con la causa principal del nivel anterior) — la UI la
        # muestra como encabezado en lugar del genérico "¿Por qué? - Nivel N".
        level_data["Pregunta"] = _build_pregunta(level_n, level_content, result)

        result[level_key] = level_data

    if dropped_out_of_range:
        logger.warning(
            f"[PARSER] Descartados {dropped_out_of_range} niveles fuera de 1-5 "
            f"(el modelo desbordó la metodología 5 Porqués)"
        )

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
            if current_level is not None and current_data:
                result[f"PorQue{current_level}"] = current_data
            level_n = int(level_match.group(1))
            # Tope duro: la metodología es 1-5. Si el modelo sigue numerando
            # (6, 7, ...) se corta acá y no se generan niveles extra.
            if level_n > 5:
                current_level = None
                current_data = {}
                break
            current_level = level_n
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


def _norm_cmp(value) -> str:
    """Normaliza un texto de causa para comparar repeticiones entre niveles
    (minúsculas, sin tildes, espacios colapsados, sin puntuación final)."""
    v = re.sub(r"\s+", " ", str(value or "")).strip().lower()
    v = re.sub(r"[áàäâ]", "a", v)
    v = re.sub(r"[éèëê]", "e", v)
    v = re.sub(r"[íìïî]", "i", v)
    v = re.sub(r"[óòöô]", "o", v)
    v = re.sub(r"[úùüû]", "u", v)
    v = re.sub(r"[ñ]", "n", v)
    return v.strip(" .;:,-")


# Primer bullet de categoría 5M: separa la pregunta de las causas dentro del
# contenido de un nivel (lo usa _build_pregunta para extraer la pregunta real).
_CAT_SPLIT_RE = re.compile(
    r"[•\-\*\.\u2022]\s*(?:mano de obra|m[eé]todo|maquinaria|medio ambiente|material)\s*[:\-]",
    re.IGNORECASE,
)


def _build_pregunta(level_n: int, level_content: str, parsed_so_far: dict) -> str:
    """Arma la pregunta (cadena causal) de un nivel para la UI.

    1. Si el modelo escribió la pregunta ("2. ¿Por qué [causa nivel 1]?"), se
       extrae el texto que quedó antes del primer bullet de categoría.
    2. Si no la escribió, se sintetiza con la causa principal del nivel anterior
       ("¿Por qué [causa]?") — así la UI muestra la cadena encadenada en vez
       del título genérico "¿Por qué? - Nivel N".
    """
    head = _CAT_SPLIT_RE.split(level_content, maxsplit=1)[0]
    head = re.sub(r"\s+", " ", head).strip(" \t\r\n:;\u2022-")
    # El modelo chiquito copia la plantilla LITERAL ("¿Por qué [causa principal
    # del nivel 1]?" sin sustituir la causa — captura 2026-09-24). Se trata como
    # pregunta ausente y se sintetiza con la causa real del nivel anterior.
    if re.search(r"causa principal del nivel", head, re.IGNORECASE):
        head = ""
    if len(head) >= 8:
        # El parser ya consumió "Por qué", así que el resto es el complemento
        # ("no hubo capacitación?"). Se reconstruye la pregunta completa.
        q = head if head.startswith("¿") else "¿Por qué " + head
        if "?" not in q:
            q += "?"
        return re.sub(r"\s+", " ", q)
    if level_n == 1:
        return "¿Por qué ocurrió el accidente?"
    prev = parsed_so_far.get(f"PorQue{level_n - 1}") or {}
    for cat in ("Mano de Obra", "Método", "Maquinaria", "Medio Ambiente", "Material"):
        v = prev.get(cat, "N/A")
        if not _is_na(v):
            causa = re.sub(r"\s+", " ", str(v)).strip(" .;:,-")
            return f"¿Por qué {causa}?"
    return f"¿Por qué? - Nivel {level_n}"


# Turno user de la cadena iterativa: pide SOLO el siguiente nivel, con la causa
# real ya sustituida por nosotros (el modelo chiquito no sabe hacerlo).
_CONTINUATION_PROMPT = (
    "Continúa el análisis con el nivel {n}. Pregunta del nivel {n}: {pregunta}\n"
    "Responde ÚNICAMENTE con el bloque del nivel {n}: las 5 categorías "
    "(• Mano de Obra, • Método, • Maquinaria, • Medio Ambiente, • Material), "
    "una línea por categoría. Escribe N/A si una categoría no contribuye a la "
    "causa. NO repitas las causas del nivel anterior: cada causa debe ser NUEVA "
    "y derivarse de la pregunta del nivel."
)


def _parse_single_level(text: str) -> dict:
    """Parsea la respuesta de UN nivel de la cadena iterativa (categorías sin numerar)."""
    data = {c: "N/A" for c in _CATEGORIES_ORDER}
    data.update(_extract_categories(text))
    return data


def _pregunta_from_causa(level_data: dict) -> str:
    """Arma "¿Por qué [causa principal]?" con la primera causa real del nivel.

    Retorna "" si el nivel no tiene ninguna causa (la cadena termina ahí).
    """
    for cat in _CATEGORIES_ORDER:
        v = level_data.get(cat, "N/A")
        if not _is_na(v):
            causa = re.sub(r"\s+", " ", str(v)).strip(" .;:,-")
            return f"¿Por qué {causa}?"
    return ""


def _has_real_causes(level_data: dict) -> bool:
    """True si el nivel tiene al menos una categoría con causa real (no N/A)."""
    return any(not _is_na(level_data.get(c, "N/A")) for c in _CATEGORIES_ORDER)


def _is_stagnant_vs(data: dict, prev: dict) -> bool:
    """True si el nivel repite TODAS las causas del nivel anterior (copia).

    Solo es estancamiento cuando NO aporta ni una causa nueva: si profundizó
    aunque sea en una categoría, se acepta.
    """
    hits = 0
    total = 0
    for cat in _CATEGORIES_ORDER:
        v = data.get(cat, "N/A")
        p = prev.get(cat, "N/A")
        if _is_na(v) and _is_na(p):
            continue
        total += 1
        if not _is_na(v) and not _is_na(p) and _norm_cmp(v) == _norm_cmp(p):
            hits += 1
    return total > 0 and hits == total


def _format_level_block(level_n: int, level_data: dict) -> str:
    """Reconstruye el bloque de un nivel en el formato entrenado (para los
    mensajes de asistente de la cadena iterativa y el raw_text)."""
    pregunta = level_data.get("Pregunta") or f"¿Por qué? - Nivel {level_n}"
    lines = [f"{level_n}. {pregunta}"]
    for cat in _CATEGORIES_ORDER:
        lines.append(f"   • {cat}: {level_data.get(cat, 'N/A') or 'N/A'}")
    return "\n".join(lines)


def _uniform_preguntas(parsed: dict) -> dict:
    """Criterio del formato: el encabezado de cada nivel SIEMPRE es la pregunta
    maestra "¿Por qué ocurrió el accidente?" — la cadena causal vive en el
    CONTENIDO de cada categoría (cada celda debe derivarse de la misma "M" del
    nivel anterior), no en el título del nivel. Antes el título saltaba a
    cualquier causa del nivel anterior ("¿Por qué no había herramientas de
    corte disponibles?"), lo que el usuario reportó como confuso (captura
    2026-09-25)."""
    for n in range(1, 6):
        key = f"PorQue{n}"
        if key in parsed:
            parsed[key]["Pregunta"] = "¿Por qué ocurrió el accidente?"
    return parsed


def _analyze_iterative_chain(descripcion: str, contexto: str, llm_cfg: dict,
                             system_prompt: str, seed_level1: dict = None):
    """Construye la cadena causal NIVEL POR NIVEL (multi-turn chat).

    Por qué existe: los modelos chiquitos (0.8B) copian la plantilla LITERAL en
    el single-shot ("¿Por qué [causa principal del nivel 1]?") y repiten las
    mismas causas en los 5 niveles, incluso cuando el feedback de regeneración
    se lo dice explícito (log 2026-09-24 19:58: intento 1 con 20 celdas
    repetidas e intento 2 con 19 tras feedback). Acá NOSOTROS sustituimos la
    causa real en cada pregunta: el modelo solo tiene que responder UN nivel.

    Flujo:
      Turno 1: plantilla entrenada + accidente → el bloque del nivel 1 del
               intento single-shot va como respuesta del asistente (seed).
      Turnos 2-5: user pide el siguiente nivel con la causa REAL ya sustituida;
               si el modelo regenera el análisis completo, se adoptan todos los
               niveles que devolvió (desde el pedido en adelante).

    Retorna (parsed, validation, raw_text).
    """
    temperature = float(llm_cfg.get("llmTemperature", 0.1))
    max_tokens = int(llm_cfg.get("llmMaxTokens", 1216))

    parsed = {}
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": build_user_prompt(descripcion, contexto)},
    ]

    # Seed: nivel 1 del intento single-shot (sus causas salen de la descripción
    # y son válidas — la repetición empieza en el nivel 2).
    if seed_level1 and _has_real_causes(seed_level1):
        parsed["PorQue1"] = dict(seed_level1)
        messages.append({"role": "assistant", "content": _format_level_block(1, seed_level1)})

    for n in range(2, 6):
        prev = parsed.get(f"PorQue{n - 1}")
        if not prev:
            break
        pregunta = _pregunta_from_causa(prev)
        if not pregunta:
            break  # el nivel anterior quedó sin causas → la cadena termina
        messages.append({
            "role": "user",
            "content": _CONTINUATION_PROMPT.format(n=n, pregunta=pregunta),
        })

        try:
            response = _ollama_request(
                "/api/chat",
                "POST",
                {
                    "model": get_current_model_name(),
                    "messages": messages,
                    "stream": False,
                    "think": False,
                    "options": {
                        "temperature": temperature,
                        "top_p": 0.8,
                        "top_k": 20,
                        "min_p": 0,
                        "num_predict": min(max_tokens, 512),
                        "repeat_penalty": 1.15,
                        "presence_penalty": 0,
                        "stop": ["6. ¿Por qué", "6. Por qué", "6.¿Por qué"],
                    },
                },
                timeout=600,
            )
        except Exception as e:
            logger.error(f"[CADENA] Error generando el nivel {n}: {e}")
            break

        msg = response.get("message", {}) or {}
        text = (msg.get("content") or "").strip()
        if not text:
            logger.warning(f"[CADENA] Nivel {n} llegó vacío — cadena cortada")
            break

        # Resolver los datos del nivel n: (1) regeneración numerada (se toman
        # desde n en adelante), (2) bloque de un solo nivel (categorías sin numerar).
        parsed_resp = parse_5_whys(text)
        data_n = parsed_resp.get(f"PorQue{n}")
        if not (data_n and _has_real_causes(data_n)):
            single = _parse_single_level(text)
            data_n = single if _has_real_causes(single) else None
        if data_n is None:
            logger.warning(f"[CADENA] Nivel {n} sin categorías legibles — cadena cortada")
            break

        # Anti-copia: si el bloque repite TODAS las causas del nivel anterior,
        # un reintento del nivel (misma pregunta, más temperatura) puede romper
        # la copia — temp 0.1 es casi determinístico y repite igual.
        if _is_stagnant_vs(data_n, prev):
            retry_msgs = messages[:-1] + [{
                "role": "user",
                "content": (
                    "CORRECCIÓN: el nivel " + str(n) + " repitió las mismas causas del nivel anterior. "
                    "Responde con causas NUEVAS que profundicen la pregunta: " + pregunta + "\n"
                    "Responde ÚNICAMENTE con el bloque del nivel " + str(n)
                    + " (las 5 categorías 5M), una línea por categoría."
                ),
            }]
            try:
                response2 = _ollama_request(
                    "/api/chat",
                    "POST",
                    {
                        "model": get_current_model_name(),
                        "messages": retry_msgs,
                        "stream": False,
                        "think": False,
                        "options": {
                            "temperature": max(0.35, temperature),
                            "top_p": 0.8,
                            "top_k": 20,
                            "min_p": 0,
                            "num_predict": min(max_tokens, 512),
                            "repeat_penalty": 1.15,
                            "presence_penalty": 0,
                            "stop": ["6. ¿Por qué", "6. Por qué", "6.¿Por qué"],
                        },
                    },
                    timeout=600,
                )
                text2 = ((response2.get("message", {}) or {}).get("content") or "").strip()
                cand2 = parse_5_whys(text2).get(f"PorQue{n}")
                if not (cand2 and _has_real_causes(cand2)):
                    single2 = _parse_single_level(text2)
                    cand2 = single2 if _has_real_causes(single2) else None
                if cand2 and _has_real_causes(cand2) and not _is_stagnant_vs(cand2, prev):
                    data_n = cand2
                    retry_msgs.append({"role": "assistant", "content": _format_level_block(n, data_n)})
                    messages = retry_msgs
                    logger.info(f"[CADENA] Nivel {n} re-generado tras copia (temp alta)")
            except Exception as e:
                logger.warning(f"[CADENA] Reintento del nivel {n} falló: {e}")

        # Adoptar el nivel n y los que vengan en la misma respuesta (regeneración)
        data_n["Pregunta"] = pregunta
        parsed[f"PorQue{n}"] = data_n
        for m in range(n + 1, 6):
            data = parsed_resp.get(f"PorQue{m}")
            if data and _has_real_causes(data):
                data["Pregunta"] = (
                    _pregunta_from_causa(parsed[f"PorQue{m - 1}"]) or data.get("Pregunta", "")
                )
                parsed[f"PorQue{m}"] = data

        messages.append({"role": "assistant", "content": _format_level_block(n, parsed[f"PorQue{n}"])})
        logger.info(f"[CADENA] Nivel {n} generado (modo iterativo)")

    # Completar niveles faltantes con N/A (la cadena terminó antes del nivel 5)
    for m in range(1, 6):
        parsed.setdefault(f"PorQue{m}", {
            "Pregunta": f"¿Por qué? - Nivel {m}",
            **{c: "N/A" for c in _CATEGORIES_ORDER},
        })

    parsed = _enforce_causal_chain(parsed)

    # Dedupe anti-relleno: si una categoría repite textualmente la del nivel
    # anterior, el modelo no aportó nada nuevo ahí (log 2026-09-24 21:16: la
    # iterativa vino bien en Mano de Obra/Método pero repetía Maquinaria/Medio
    # Ambiente/Material en todos los niveles). La metodología 5M pide N/A en
    # ese caso — más honesto que una copia que sugiere una causa distinta.
    # Va DESPUÉS de _enforce_causal_chain (el fill copia el nivel anterior en
    # los huecos; el dedupe revierte ese tipo de relleno engañoso).
    deduped_cells = 0
    for n in range(2, 6):
        cur = parsed[f"PorQue{n}"]
        prev = parsed[f"PorQue{n - 1}"]
        for cat in _CATEGORIES_ORDER:
            v = cur.get(cat, "N/A")
            p = prev.get(cat, "N/A")
            if not _is_na(v) and not _is_na(p) and _norm_cmp(v) == _norm_cmp(p):
                cur[cat] = "N/A"
                deduped_cells += 1
    if deduped_cells:
        logger.info(f"[CADENA] Dedupe: {deduped_cells} celda(s) repetidas pasaron a N/A")

    validation = _validate_backward_chain(parsed)
    logger.info(
        f"[CADENA] Cadena iterativa completa: score={validation['score']}/100 "
        f"valid={validation['valid']} repetition_cells={validation['details'].get('repetition_cells', 0)}"
    )
    # Encabezado constante por criterio del formato (antes de reconstruir el raw)
    _uniform_preguntas(parsed)
    _uniform_preguntas(parsed)  # encabezado constante: "¿Por qué ocurrió el accidente?" en los 5 niveles
    raw_text = "\n\n".join(_format_level_block(m, parsed[f"PorQue{m}"]) for m in range(1, 6))
    return parsed, validation, raw_text


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

    # 1c. Anti-repetición: un nivel que repite textualmente la causa del nivel
    # anterior NO está profundizando (cadena estancada). Ojo: la repetición
    # MAXIMIZA el overlap de 1b (texto idéntico = 100%), así que sin este
    # castigo un análisis estancado sacaba ~98/100 y pasaba en el intento 1,
    # sin disparar nunca la regeneración con feedback.
    repeated_cells = []
    for i in range(len(levels) - 1):
        for cat in categories:
            v_prev = parsed[levels[i]].get(cat, "N/A")
            v_now = parsed[levels[i + 1]].get(cat, "N/A")
            if _is_na(v_prev) or _is_na(v_now):
                continue
            if _norm_cmp(v_prev) == _norm_cmp(v_now):
                repeated_cells.append(f"{cat} (nivel {i+2} = nivel {i+1})")
    repetition_penalty = 0
    if repeated_cells:
        repetition_penalty = min(5 * len(repeated_cells), 30)
        ejemplos = ", ".join(repeated_cells[:3])
        # issues[0]: _build_regeneration_feedback toma los primeros 3, y este
        # es el problema principal cuando la cadena está estancada.
        issues.insert(
            0,
            f"Cadena estancada: {len(repeated_cells)} celda(s) repiten textualmente el nivel anterior "
            f"({ejemplos}). Cada nivel debe responder ¿por qué? con una causa NUEVA derivada de la "
            f"causa principal del nivel anterior, no repetir la misma.",
        )
    details["repetition_cells"] = len(repeated_cells)

    continuity_score = max(0, structural_score - repetition_penalty) + lexical_score
    details["continuity"] = continuity_score
    details["continuity_repetition"] = repetition_penalty
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

    # Gate anti-estancamiento: con 6+ celdas repetidas la cadena NO progresa
    # aunque el puntaje de otros criterios llegue a 70 (los otros 4 criterios
    # suman hasta 60 y el overlap léxico premia lo idéntico).
    is_valid = total_score >= 70 and len(repeated_cells) < 6

    logger.info(
        f"[BACKWARD_TEST] Score={total_score}/100 valid={is_valid} "
        f"continuity={continuity_score} actionability={actionability_score} "
        f"evidence={evidence_score} recurrence={recurrence_score} effectiveness={effectiveness_score} "
        f"repetition_cells={len(repeated_cells)}"
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
            "error": "Ollama no está corriendo. Instálalo desde https://ollama.com/download e inténtalo de nuevo",
        }), 503

    if not get_current_model_name():
        return jsonify({
            "success": False,
            "error": (
                "No hay modelo de IA configurado. Ve a Configuración › IA "
                "y descarga un modelo (HuggingFace)."
            ),
        }), 400

    if not check_model_loaded():
        return jsonify({
            "success": False,
            "error": f"Modelo '{get_current_model_name()}' no existe en Ollama. Descárgalo desde Configuración › IA",
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

    if not get_current_model_name():
        return jsonify({
            "success": False,
            "error": (
                "No hay modelo de IA configurado. Ve a Configuración › IA "
                "y descarga un modelo (HuggingFace)."
            ),
        }), 400

    llm_cfg = get_llm_config()
    base_system_prompt = llm_cfg.get("llmSystemPrompt") or SYSTEM_PROMPT
    regen_temperature = float(llm_cfg.get("llmTemperature", 0.1))
    regen_max_tokens = int(llm_cfg.get("llmMaxTokens", 1216))

    # Construir el prompt específico para regeneración
    user_prompt = build_regenerate_user_prompt(descripcion, contexto, feedback, current_analysis, level)

    # Si regenera un solo nivel, el formato solo pide ese nivel. Si regenera todo, pide los 5.
    if level is not None:
        numbered_format = build_numbered_format(level, level)
        context_block = f"Este análisis es sobre el nivel {level} de un 5 Porqués completo. El usuario quiere regenerar SOLO este nivel aplicando feedback específico."
    else:
        numbered_format = build_numbered_format(1, 5)
        context_block = "El usuario quiere regenerar el análisis 5 Porqués COMPLETO aplicando feedback específico."

    system_prompt_regen = base_system_prompt + "\n\n" + REGENERATE_PROMPT_TEMPLATE.format(
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
                    # Muestreo del entrenamiento (igual que analyze).
                    "temperature": regen_temperature,
                    "top_p": 0.8,
                    "top_k": 20,
                    "min_p": 0,
                    "num_predict": regen_max_tokens if level is None else min(regen_max_tokens, 1500),
                    "repeat_penalty": 1.15,
                    "presence_penalty": 0,
                    # Corte duro: el análisis solo tiene niveles 1-5.
                    "stop": ["6. ¿Por qué", "6. Por qué", "6.¿Por qué"],
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
        _uniform_preguntas(parsed_result)

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
                "Descárgalo desde Configuración › IA (HuggingFace)."
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


# ============================================================================
# Endpoints HuggingFace (modelos GGUF privados — Fase 1)
# Token SOLO via header X-HF-Token (memoria por request; nunca en config.json
# ni en logs). Descarga async con job + progreso; luego Modelfile + ollama create.
# ============================================================================

_HF_DEFAULT_REPO = "Reivaj640/qwen3.5-0.8b-ia-v1"
_HF_JOBS = {}  # job_id -> dict (status/stage/progress/error/...)
_HF_JOBS_LOCK = threading.Lock()
_CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0


def _hf_effective_repo(repo_id=None) -> str:
    """Repo HF a usar: el pedido por el cliente > el guardado (llmHfRepo) > el default."""
    if repo_id and str(repo_id).strip():
        return str(repo_id).strip()
    saved = str((_load_llm_config() or {}).get("llmHfRepo") or "").strip()
    return saved or _HF_DEFAULT_REPO


def _hf_models_dir() -> str:
    """Carpeta local de modelos HF: <userData>/hf-models/."""
    d = os.path.join(os.path.dirname(_CONFIG_PATH), "hf-models")
    os.makedirs(d, exist_ok=True)
    return d


def _find_ollama_cli():
    """Resuelve el ejecutable de ollama (PATH o instalación local Windows)."""
    exe = shutil.which("ollama")
    if exe:
        return exe
    local = os.path.join(
        os.environ.get("LOCALAPPDATA", ""), "Programs", "Ollama", "ollama.exe"
    )
    if os.path.isfile(local):
        return local
    return None


def _hf_repo_tag_suffix(repo_id: str) -> str:
    """Sufijo de etiqueta Ollama derivado del repo (evita colisiones v1/v2).

    'Reivaj640/qwen3.5-0.8b-ia-v2' → '-v2' (repo termina en -vN).
    Si no termina en -vN, usa el nombre del repo sanitizado → '-mi-repo'.
    Sin repo → '' (compatibilidad con llamadas antiguas).
    """
    name = (repo_id or "").strip().split("/")[-1].lower()
    if not name:
        return ""
    m = re.search(r"-v(\d+)$", name)
    if m:
        return f"-v{m.group(1)}"
    clean = re.sub(r"[^a-z0-9._-]+", "-", name).strip("-. ")
    return f"-{clean}" if clean else ""


def _hf_model_tag(filename: str, repo_id: str = "") -> str:
    """Nombre de modelo Ollama derivado del .gguf + versión del repo (prefijo hf-).

    Dos repos con el mismo .gguf (p.ej. ia-v1 e ia-v2) generan etiquetas
    distintas: hf-<archivo>-v1 vs hf-<archivo>-v2 — no se pisan entre sí.
    """
    base = os.path.splitext(os.path.basename(filename))[0]
    tag = re.sub(r"[^a-z0-9._-]+", "-", base.lower()).strip("-")
    return f"hf-{tag}{_hf_repo_tag_suffix(repo_id)}"


def _hf_download_worker(job_id: str, repo_id: str, filename: str, token: str) -> None:
    """Hilo: descarga .gguf → Modelfile → ollama create → activar modelo."""
    job = _HF_JOBS.get(job_id)
    if not job:
        return
    try:
        from huggingface_hub import hf_hub_download, HfApi

        with _HF_JOBS_LOCK:
            job["status"] = "downloading"
            job["stage"] = "downloading"
            job["progress"] = 1.0

        dest_dir = _hf_models_dir()

        # Tamaño esperado (para progreso)
        total_size = 0
        try:
            api = HfApi(token=token)
            info = api.model_info(repo_id, files_metadata=True)
            for s in (info.siblings or []):
                if s.rfilename == filename:
                    total_size = s.size or 0
                    break
        except Exception as e:
            logger.warning(f"[HF] No pude obtener tamaño de {filename}: {e}")

        stop_monitor = threading.Event()

        def _monitor():
            while not stop_monitor.is_set():
                try:
                    base = os.path.basename(filename)
                    found = 0
                    for root, _dirs, files in os.walk(dest_dir):
                        for f in files:
                            if base in f or f.endswith(".incomplete"):
                                try:
                                    found = max(
                                        found, os.path.getsize(os.path.join(root, f))
                                    )
                                except OSError:
                                    pass
                    if total_size > 0 and found > 0:
                        pct = min(99.0, (found / total_size) * 100.0)
                        with _HF_JOBS_LOCK:
                            if pct > job["progress"]:
                                job["progress"] = round(pct, 1)
                except Exception:
                    pass
                stop_monitor.wait(1.0)

        mon = threading.Thread(target=_monitor, daemon=True)
        mon.start()

        local_path = hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            token=token,
            local_dir=dest_dir,
        )
        stop_monitor.set()

        with _HF_JOBS_LOCK:
            job["progress"] = 90.0
            job["status"] = "creating"
            job["stage"] = "creating"
            job["local_path"] = local_path

        tag = _hf_model_tag(filename, repo_id)
        modelfile = os.path.join(dest_dir, f"Modelfile.{tag}")
        with open(modelfile, "w", encoding="utf-8") as f:
            f.write(f"FROM {local_path}\n")
            f.write("PARAMETER temperature 0.1\n")
            f.write("PARAMETER top_p 0.8\n")
            f.write("PARAMETER top_k 20\n")
            f.write("PARAMETER min_p 0\n")
            f.write("PARAMETER repeat_penalty 1.15\n")
            f.write("PARAMETER presence_penalty 0\n")
            f.write("PARAMETER num_ctx 8192\n")

        ollama = _find_ollama_cli()
        if not ollama:
            raise RuntimeError(
                "No se encontró el ejecutable de Ollama. Instálalo desde https://ollama.com/download"
            )

        result = subprocess.run(
            [ollama, "create", tag, "-f", modelfile],
            capture_output=True,
            text=True,
            timeout=600,
            creationflags=_CREATE_NO_WINDOW,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"ollama create falló: {(result.stderr or result.stdout or '').strip()}"
            )

        # Activar como modelo actual (hot) + persistir en config.json
        set_current_model_name(tag)
        try:
            update_llm_config({"llmModel": tag})
        except Exception as e:
            logger.warning(f"[HF] No pude persistir llmModel={tag}: {e}")

        with _HF_JOBS_LOCK:
            job["progress"] = 100.0
            job["status"] = "done"
            job["stage"] = "done"
            job["model_tag"] = tag
            job["finished_at"] = datetime.now().isoformat()
        logger.info(f"[HF] Modelo {tag} creado y activado desde {repo_id}/{filename}")

    except Exception as e:
        logger.error(f"[HF] Error en job {job_id}: {e}")
        with _HF_JOBS_LOCK:
            job["status"] = "error"
            job["stage"] = "error"
            job["error"] = str(e)
            job["finished_at"] = datetime.now().isoformat()


@app.route("/hf/repos", methods=["GET"]) if app else None
def hf_repos_endpoint():
    """Lista los repos propios de la cuenta del token (selector del panel IA).
    GET · Header: X-HF-Token (requerido).
    → { success, repos: [{repo_id, last_modified, private}], selected? }
    """
    token = (request.headers.get("X-HF-Token") or "").strip()
    if not token:
        return jsonify({"success": False, "error": "Se requiere X-HF-Token"}), 401
    try:
        from huggingface_hub import HfApi

        api = HfApi(token=token)
        me = api.whoami(token=token) or {}
        author = str(me.get("name") or (me.get("user") or {}).get("name") or "").strip()
        if not author:
            return jsonify({"success": False, "error": "El token no identifica una cuenta"}), 401
        repos = []
        for m in api.list_models(author=author, sort="lastModified", token=token):
            lm = getattr(m, "lastModified", None)
            repos.append({
                "repo_id": m.id,
                "last_modified": lm.isoformat() if lm else None,
                "private": bool(getattr(m, "private", False)),
            })
        # Garantiza siempre el repo efectivo (config o default) aunque el
        # listado del Hub salga vacío (p.ej. token con permisos acotados).
        effective = _hf_effective_repo()
        if effective and not any(r["repo_id"] == effective for r in repos):
            repos.insert(0, {
                "repo_id": effective,
                "last_modified": None,
                "private": True,
            })
        payload_out = {"success": True, "repos": repos}
        saved = str((_load_llm_config() or {}).get("llmHfRepo") or "").strip()
        if saved:
            payload_out["selected"] = saved
        return jsonify(payload_out)
    except Exception as e:
        logger.error(f"[HF] Error listando repos: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/hf/list", methods=["POST"]) if app else None
def hf_list_endpoint():
    """Lista archivos .gguf de un repo HF (por defecto el repo guardado o el default).
    Body: { "repo_id"? } · Header: X-HF-Token (requerido).
    """
    token = (request.headers.get("X-HF-Token") or "").strip()
    if not token:
        return jsonify({"success": False, "error": "Se requiere X-HF-Token"}), 401
    payload = request.get_json(silent=True) or {}
    repo_id = _hf_effective_repo(payload.get("repo_id"))
    try:
        from huggingface_hub import HfApi

        api = HfApi(token=token)
        info = api.model_info(repo_id, files_metadata=True)
        files = []
        for s in (info.siblings or []):
            name = s.rfilename or ""
            if name.lower().endswith(".gguf"):
                files.append({"filename": name, "size": s.size or 0})
        return jsonify({"success": True, "repo_id": repo_id, "files": files})
    except Exception as e:
        logger.error(f"[HF] Error listando {repo_id}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/hf/download", methods=["POST"]) if app else None
def hf_download_endpoint():
    """Inicia descarga async de un .gguf. Devuelve { job_id } al instante.
    Body: { "repo_id"?, "filename" } · Header: X-HF-Token (requerido).
    """
    token = (request.headers.get("X-HF-Token") or "").strip()
    if not token:
        return jsonify({"success": False, "error": "Se requiere X-HF-Token"}), 401
    payload = request.get_json(silent=True) or {}
    filename = (payload.get("filename") or "").strip()
    repo_id = _hf_effective_repo(payload.get("repo_id"))
    if not filename or not filename.lower().endswith(".gguf"):
        return jsonify({"success": False, "error": "filename .gguf requerido"}), 400

    job_id = f"hf-{int(time.time() * 1000)}-{os.urandom(3).hex()}"
    with _HF_JOBS_LOCK:
        _HF_JOBS[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "stage": "queued",
            "progress": 0.0,
            "repo_id": repo_id,
            "filename": filename,
            "model_tag": None,
            "local_path": None,
            "error": None,
            "started_at": datetime.now().isoformat(),
            "finished_at": None,
        }
    t = threading.Thread(
        target=_hf_download_worker, args=(job_id, repo_id, filename, token), daemon=True
    )
    t.start()
    return jsonify({"success": True, "job_id": job_id})


@app.route("/hf/progress", methods=["GET"]) if app else None
def hf_progress_endpoint():
    """Estado de un job de descarga. Query: job_id=..."""
    job_id = (request.args.get("job_id") or "").strip()
    with _HF_JOBS_LOCK:
        job = _HF_JOBS.get(job_id)
        snapshot = dict(job) if job else None
    if not snapshot:
        return jsonify({"success": False, "error": "Job no encontrado"}), 404
    return jsonify({"success": True, "job": snapshot})


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
    logger.info("Endpoints: GET /health, POST /load, POST /analyze, GET /status, GET /models, POST /models/select, GET /llm-config, POST /llm-config, GET /hf/repos, POST /hf/list, POST /hf/download, GET /hf/progress")

    # Verificar Ollama al inicio (no bloquea)
    if not get_current_model_name():
        logger.warning(
            "[WARN] No hay modelo de IA configurado. "
            "Ve a Configuración › IA y descarga un modelo (HuggingFace)."
        )
    elif check_ollama_alive():
        logger.info("[OK] Ollama responde")
        if check_model_loaded():
            logger.info(f"[OK] Modelo '{get_current_model_name()}' disponible")
        else:
            logger.warning(
                f"[WARN] Modelo '{get_current_model_name()}' no encontrado. "
                "Descárgalo desde Configuración › IA (HuggingFace)."
            )
    else:
        logger.warning(
            f"[WARN] Ollama no responde en {OLLAMA_BASE_URL}. "
            "Instálalo desde https://ollama.com/download e inténtalo de nuevo."
        )

    app.run(host=SERVER_HOST, port=SERVER_PORT, threaded=True)


if __name__ == "__main__":
    run_server()

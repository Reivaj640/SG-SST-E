# Esta Es la Versión 0.7 de la Aplicación de Inversión de Accidentes
#
# MIGRACIÓN A GGUF/OLLAMA: A partir de esta versión, el análisis con IA se realiza
# contra un servidor Ollama local (modelo GGUF) en lugar de cargar el modelo con
# transformers + torch en este proceso. Esto reduce el tiempo de carga de ~5 min a
# ~30s y la memoria de ~8 GB a ~3 GB. NO se requieren las dependencias
# `transformers` ni `torch`.

import os
import re
import json
import logging
import traceback
import threading
import unicodedata
from pathlib import Path
from datetime import datetime
from docxtpl import DocxTemplate
import warnings
import fitz
import sys
import gc
import urllib.request
import urllib.error

# NOTA: Los imports de ttkbootstrap se mueven a lazy imports dentro de RemisionesApp
# para evitar errores cuando el módulo se usa desde el backend de Electron
# que no necesita la GUI. Las clases PdfProcessor y AccidentAnalyzer NO usan ttkbootstrap.

# -------------------------------------------------------------------------------------------------------------------
# Configuración de la GPU y advertencias
warnings.filterwarnings("ignore")
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["CUDA_DEVICE_ORDER"] = "PCI_BUS_ID"
os.environ["CUDA_VISIBLE_DEVICES"] = "0"


# -------------------------------------------------------------------------------------------------------------------
# MIGRACIÓN A GGUF/OLLAMA: La clase `ModelManager` original (que cargaba el modelo
# Ministral con transformers + torch en este proceso) fue eliminada. El modelo
# ahora se gestiona externamente con Ollama (formato GGUF). Ver AccidentAnalyzer
# más abajo para los detalles de la nueva implementación.


class AccidentAnalyzer:
    """Genera la metodologia '5 Por Que' usando un LLM via Ollama (modelo GGUF).

    En lugar de cargar el modelo con transformers/torch en este proceso, se hace
    una llamada HTTP a Ollama (que mantiene el modelo en memoria y entrega respuestas
    mucho más rápido: ~30s de carga vs ~5min, y ~3GB VRAM vs ~8GB).

    Configuración por variables de entorno:
      - OLLAMA_HOST  (default: 127.0.0.1)
      - OLLAMA_PORT  (default: 11434)
      - OLLAMA_MODEL (default: qwen-inv-at — modelo creado desde el Modelfile del proyecto)
    """

    OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "127.0.0.1")
    OLLAMA_PORT = int(os.environ.get("OLLAMA_PORT", "11434"))
    OLLAMA_BASE_URL = f"http://{OLLAMA_HOST}:{OLLAMA_PORT}"
    OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen-inv-at")
    REQUEST_TIMEOUT = 600  # segundos — el análisis 5 Porqués puede tardar

    def __init__(self):
        # NO cargamos modelo local. Ollama gestiona el modelo en su propio proceso.
        # Mantenemos estos atributos por compatibilidad con callers que los leían.
        self.model = None
        self.tokenizer = None
        self.model_path = f"ollama://{self.OLLAMA_HOST}:{self.OLLAMA_PORT}/{self.OLLAMA_MODEL}"

    def _ollama_chat(self, messages: list, options: dict = None) -> str:
        """Llama a Ollama /api/chat (no streaming) y devuelve el texto de la respuesta.

        Lanza RuntimeError con mensaje claro si Ollama no está disponible.
        """
        url = f"{self.OLLAMA_BASE_URL}/api/chat"
        payload = {
            "model": self.OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
            "think": False,  # los modelos qwen3-<think> contaminan la respuesta con el razonamiento
            "options": options
            or {"temperature": 0.7, "num_predict": 4000, "top_p": 0.9, "top_k": 20},
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.REQUEST_TIMEOUT) as resp:
                body = resp.read().decode("utf-8")
        except urllib.error.URLError as e:
            raise RuntimeError(
                f"No se pudo conectar con Ollama en {self.OLLAMA_BASE_URL}: {e}. "
                f"Asegurate de que Ollama este corriendo y que el modelo "
                f"'{self.OLLAMA_MODEL}' este disponible (ejecuta setup_ollama.ps1 "
                f"o 'ollama pull {self.OLLAMA_MODEL}')."
            ) from e
        response = json.loads(body) if body else {}
        msg = response.get("message", {}) or {}
        content = (msg.get("content") or "").strip()
        if not content:
            raise RuntimeError(
                f"Ollama devolvio una respuesta vacia. Revisa que el modelo "
                f"'{self.OLLAMA_MODEL}' este cargado y respondiendo correctamente."
            )
        return content

    def analyze_5whys(
        self, descripcion_accidente: str, contexto_adicional: str = ""
    ) -> dict:
        if not descripcion_accidente or descripcion_accidente.strip() == "N/A":
            logging.warning(
                "No se proporciono descripcion del accidente para el analisis. Saltando."
            )
            return self._generate_fallback_analysis()

        # Prompt refinado (mismo que se usaba con transformers — validado en producción)
        prompt_rules = """INSTRUCCIONES: Genera un analisis 5 Porques COMPLETO para el siguiente accidente laboral.

METODOLOGIA 5 PORQUES:
- Cada nivel pregunta "¿Por que?" al resultado del nivel anterior
- El objetivo es llegar a la CAUSA RAIZ que la empresa puede corregir con acciones concretas
- Los niveles deben formar una CADENA CAUSAL COHERENTE (5→4→3→2→1→accidente)

CATEGORIAS 5M (analiza TODAS en CADA nivel):
- Mano de Obra: acciones/comportamientos del trabajador (distraccion, error, decision, capacitacion)
- Metodo: procedimientos/normas/supervision (falta de procedimiento, procedimiento inadecuado)
- Maquinaria: equipos/vehiculos/herramientas (falla mecanica, falta de mantenimiento)
- Medio Ambiente: condiciones del lugar (iluminacion, orden, senalizacion, temperatura)
- Material: objetos/sustancias/EPP (material defectuoso, falta de EPP)

REGLAS OBLIGATORIAS:
1. Genera EXACTAMENTE 5 niveles de analisis
2. En CADA nivel, analiza TODAS las 5 categorias 5M (no solo una)
3. Si una categoria NO contribuye a la causa en ese nivel, marca N/A
4. La causa principal de cada nivel debe ser CONSECUENCIA del nivel anterior
5. El ultimo nivel debe identificar causas RAIZ accionables por la empresa
6. NO agregues explicaciones, introducciones ni conclusiones

FORMATO DE RESPUESTA:

1. ¿Por que ocurrio el accidente?
   • Mano de Obra: [causa especifica o N/A]
   • Metodo: [causa especifica o N/A]
   • Maquinaria: [causa especifica o N/A]
   • Medio Ambiente: [causa especifica o N/A]
   • Material: [causa especifica o N/A]

2. ¿Por que [causa principal del nivel 1]?
   • Mano de Obra: [causa especifica o N/A]
   • Metodo: [causa especifica o N/A]
   • Maquinaria: [causa especifica o N/A]
   • Medio Ambiente: [causa especifica o N/A]
   • Material: [causa especifica o N/A]

(Continua hasta el nivel 5, donde se identifican las causas raiz)

ACCIDENTE A ANALIZAR:"""
        descripcion_str = f"**Descripcion del accidente:**\n{descripcion_accidente}"
        contexto_str = (
            f"\n\n**Contexto Adicional:**\n{contexto_adicional}"
            if contexto_adicional and "Anade aqui" not in contexto_adicional
            else ""
        )
        final_user_prompt = f"{prompt_rules}\n\n{descripcion_str}{contexto_str}\n\n**Analisis de 5 Porques:**"
        messages = [{"role": "user", "content": final_user_prompt}]

        logging.info(
            f"Enviando prompt a Ollama ({self.OLLAMA_BASE_URL}, modelo={self.OLLAMA_MODEL})..."
        )

        try:
            analysis = self._ollama_chat(messages)
            logging.info(f"Respuesta cruda del modelo:\n---\n{analysis}\n---")

            parsed_analysis = self._parse_structured_analysis(analysis)
            logging.info(
                f"Analisis parseado: {json.dumps(parsed_analysis, indent=2, ensure_ascii=False)}"
            )

            return parsed_analysis
        except Exception as e:
            logging.error(
                f"Error en analisis '5 Por Que': {e}\n{traceback.format_exc()}"
            )
            return self._generate_fallback_analysis()

    def _parse_structured_analysis(self, text: str) -> dict:
        logging.info(f"Iniciando parseo del siguiente texto:\n---\n{text}\n---")
        causas = {}

        # 🔧 SIMPLIFICADO: El nuevo prompt no tiene ejemplo, buscar directamente el análisis
        # Buscar el primer "1. ¿Por qué" que es donde empieza el análisis
        first_match = re.search(r"1\.\s*¿Por qué", text, re.IGNORECASE)
        if first_match:
            text = text[first_match.start() :]
            logging.info(f"Texto cortado desde '1. ¿Por qué': {text[:100]}...")

        level_pattern = r"(\d+)\.\s*¿Por qué(.*?)(?=\n\d+\. ¿Por qué|\Z)"
        matches = list(re.finditer(level_pattern, text, re.DOTALL | re.IGNORECASE))

        found_matches = False
        for match in matches:
            found_matches = True
            level = int(match.group(1))
            if 1 <= level <= 5:
                level_content = match.group(2).strip()
                logging.info(
                    f"Encontrado 'Por Qué {level}': Contenido='{level_content[:100]}...'"
                )
                parsed_level = self._parse_level_content(level_content)

                # 🔧 NUEVO: Validar que el nivel tenga al menos una causa no-N/A
                parsed_level = self._validate_level(level, parsed_level)
                causas[f"Por Qué {level}"] = parsed_level

        if not found_matches:
            logging.warning(
                "No se encontraron coincidencias para el patrón de 'Por Qué' en la respuesta del modelo."
            )

        # Asegurar que existan los 5 niveles
        for i in range(1, 6):
            if f"Por Qué {i}" not in causas:
                causas[f"Por Qué {i}"] = {
                    "causa": "Análisis no generado",
                    "Mano de Obra": "N/A",
                    "Método": "N/A",
                    "Maquinaria": "N/A",
                    "Medio Ambiente": "N/A",
                    "Material": "N/A",
                }

        logging.info(
            f"Resultado final del parseo: {json.dumps(causas, indent=2, ensure_ascii=False)}"
        )
        return causas

    def _validate_level(self, level: int, level_data: dict) -> dict:
        """Valida que un nivel tenga causas significativas en las categorías 5M.

        El objetivo es que cada nivel tenga análisis en múltiples categorías 5M,
        no solo una. Si todas son N/A, se marca como requiere investigación.
        """
        categories = [
            "Mano de Obra",
            "Método",
            "Maquinaria",
            "Medio Ambiente",
            "Material",
        ]
        valid_causes = []

        for cat in categories:
            value = level_data.get(cat, "N/A")
            if value and value != "N/A" and len(value) > 3:
                valid_causes.append(cat)

        # Si no hay ninguna causa válida, marcar para investigación
        if not valid_causes:
            logging.warning(f"Nivel {level} sin causas válidas en ninguna categoría 5M")
            if level_data.get("causa") == "N/A" or not level_data.get("causa"):
                level_data["causa"] = "Causa no identificada - requiere investigación"
            # Marcar Método como categoría por defecto para investigación
            level_data["Método"] = "Requiere investigación adicional"
        else:
            logging.info(f"Nivel {level} tiene causas válidas en: {valid_causes}")

        return level_data

    def _clean_value(self, value: str) -> str:
        """Limpia el valor extraído eliminando backticks de markdown y contenido basura."""
        if not value:
            return "N/A"

        # Eliminar bloques de código markdown (``` ... ```)
        value = re.sub(r"```.*?```", "", value, flags=re.DOTALL)

        # Eliminar backticks sueltos
        value = value.replace("```", "").replace("``", "").replace("`", "")

        # 🔧 NUEVO: Si el valor empieza con "N/A", tomar SOLO "N/A"
        na_match = re.match(r"^(N/A)\s*[\*\-\•\n]", value.strip(), re.IGNORECASE)
        if na_match:
            return "N/A"

        # Si el valor contiene "N/A" en cualquier parte, verificar si es el valor real
        if "N/A" in value.upper():
            na_at_start = re.match(r"^(N/A)\s*", value.strip(), re.IGNORECASE)
            if na_at_start:
                return "N/A"

        # 🔧 MEJORADO: Eliminar texto que parece ser pensamiento del modelo o siguiente nivel
        # Patrones que indican texto basura del modelo
        garbage_patterns = [
            r"\*\*Nivel\s*\d+.*",  # **Nivel 2:...
            r"¿Por qué.*",  # ¿Por qué...
            r"Pero el ejemplo.*",  # Pensamiento del modelo
            r"En el ejemplo.*",
            r"Espera.*",
            r"Revisemos.*",
            r"Procedemos.*",
            r"Por lo tanto.*",
            r"NOTA:.*",
            r"IMPORTANTE:.*",
            r"\bPero\b.*",  # "Pero" al final de una frase
            r"\bSin embargo\b.*",  # "Sin embargo" continuaciones
            r"\bQuizá.*",  # "Quizá" pensamientos
            r"\bQuizás.*",
            r"\bTal vez.*",
            r"\bPodría ser.*",
            r"\bDebemos.*",
            r"\bVamos a.*",
            r"\bAhora\b.*",  # "Ahora" transiciones
        ]
        for pattern in garbage_patterns:
            value = re.split(pattern, value, flags=re.IGNORECASE)[0]

        # 🔧 NUEVO: Eliminar palabras sueltas al final que son conectores sin sentido
        # Ejemplo: "Falta de política de actualización de procedimientos (no tienen un sistema para actualizar) Pero,"
        connector_words = [
            "Pero",
            "Sin embargo",
            "Además",
            "También",
            "Aunque",
            "No obstante",
            "Por eso",
            "Por ello",
        ]
        for connector in connector_words:
            # Si el valor termina con el conector (con o sin puntuación)
            pattern = rf"\s*\b{connector}\s*[,\.\;\:]?\s*$"
            value = re.sub(pattern, "", value, flags=re.IGNORECASE)

        # Eliminar paréntesis vacíos o con solo puntuación
        value = re.sub(r"\(\s*\)", "", value)
        value = re.sub(r"\(\s*[,\.\;\:]\s*\)", "", value)

        # Eliminar saltos de línea múltiples y espacios extra
        value = re.sub(r"\n+", " ", value)
        value = re.sub(r"\s+", " ", value).strip()

        # Eliminar puntuación al final que no pertenece
        value = re.sub(r"[\,\;\:\s]+$", "", value)

        # Limitar longitud máxima (un valor razonable para un análisis)
        if len(value) > 300:
            value = value[:300].rsplit(" ", 1)[0] + "..."

        return value if value else "N/A"

    def _parse_level_content(self, content: str) -> dict:
        lines = content.split("\n")
        causa_principal = lines[0].strip()

        # 🔧 NUEVO: Limpiar la causa principal
        # Eliminar signos de interrogación y texto basura
        causa_principal = causa_principal.rstrip("?").strip()
        # Si la causa contiene texto del ejemplo o pensamiento del modelo, limpiarla
        garbage_in_causa = ["escalera", "ejemplo", "Pero", "Espera", "Revisemos"]
        for garbage in garbage_in_causa:
            if (
                garbage.lower() in causa_principal.lower()
                and len(causa_principal) > 100
            ):
                # La causa parece contener texto basura, tomar solo la primera parte
                causa_principal = causa_principal.split(".")[0] + "."
                break

        level_data = {
            "causa": causa_principal,
            "Mano de Obra": "N/A",
            "Método": "N/A",
            "Maquinaria": "N/A",
            "Medio Ambiente": "N/A",
            "Material": "N/A",
        }

        # Patrón más flexible: acepta •, -, *, o números como bullets
        # Y acepta variaciones en los nombres de categorías (con/sin acentos, mayúsculas/minúsculas)
        category_pattern = r"(?:^|\n)\s*(?:•|\-|\*|\d+\.)\s*(Mano\s*de\s*Obra|M[eé]todo|Maquinaria|Medio\s*Ambiente|Material)\s*:\s*(.*?)(?=(?:\n\s*(?:•|\-|\*|\d+\.)\s*(?:Mano|M[eé]todo|Maquinaria|Medio|Material))|\Z)"

        for match in re.finditer(category_pattern, content, re.DOTALL | re.IGNORECASE):
            category_raw = match.group(1).strip().lower()
            value_raw = match.group(2).strip()

            # Limpiar el valor de backticks y basura
            value = self._clean_value(value_raw)

            # Normalizar el nombre de la categoría
            category_map = {
                "mano de obra": "Mano de Obra",
                "manodeobra": "Mano de Obra",
                "método": "Método",
                "metodo": "Método",
                "maquinaria": "Maquinaria",
                "medio ambiente": "Medio Ambiente",
                "medioambiente": "Medio Ambiente",
                "material": "Material",
            }

            # Buscar la categoría normalizada (con y sin espacios)
            category = category_map.get(category_raw) or category_map.get(
                category_raw.replace(" ", "")
            )

            if category and value:
                level_data[category] = value
                logging.info(f"[PARSER] Extraído: {category} = {value[:50]}...")

        return level_data

    def _generate_fallback_analysis(self) -> dict:
        return {
            f"Por Qué {i}": {
                "causa": "Análisis no disponible",
                "Mano de Obra": "N/A",
                "Método": "N/A",
                "Maquinaria": "N/A",
                "Medio Ambiente": "N/A",
                "Material": "N/A",
            }
            for i in range(1, 6)
        }


# -------------------------------------------------------------------------------------------------------------------
logging.basicConfig(
    filename="accidentes_app.log",
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(message)s",
    encoding="utf-8",
)


class Config:
    RUTA_BASE = Path("G:/Mi unidad/2. Trabajo/1. SG-SST")
    RUTAS = {
        "TEMPOACTIVA": {
            "investigaciones": RUTA_BASE
            / "2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/2. Accidentes",
            "plantilla": RUTA_BASE
            / "2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/4. Procedimientos/GI-FO-020 INVESTIGACION.docx",
        },
        "TEMPOSUM": {
            "investigaciones": RUTA_BASE
            / "2. Temporales Comfa/2. Temposum Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades",
            "plantilla": RUTA_BASE
            / "2. Temporales Comfa/2. Temposum Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/4. Procedimientos/GI-FO-020 INVESTIGACION.docx",
        },
        "ASEPLUS": {
            "investigaciones": RUTA_BASE
            / "2. Temporales Comfa/3. Aseplus/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/3.2.2.1. Investigaciones",
            "plantilla": RUTA_BASE
            / "2. Temporales Comfa/3. Aseplus/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/4. Procedimientos/GI-FO-020 INVESTIGACION.docx",
        },
        "ASEL": {
            "investigaciones": RUTA_BASE
            / "19. Asel S.A.S/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/2. Accidentes",
            "plantilla": RUTA_BASE
            / "19. Asel S.A.S/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/4. Procedimientos/GI-FO-020 INVESTIGACION.docx",
        },
    }  # se ilimino una coma que causaba un problema de duppla.

    @classmethod
    def get_empresa_paths(cls, empresa):
        return cls.RUTAS.get(empresa.upper(), cls.RUTAS["TEMPOACTIVA"])

    @classmethod
    def get_template_path(cls, empresa):
        return str(cls.get_empresa_paths(empresa)["plantilla"])

    @classmethod
    def get_output_dir(cls, empresa):
        return str(
            cls.get_empresa_paths(empresa)["investigaciones"]
        )  # se cambio "generated_reports" por "investigaciones".


# -------------------------------------------------------------------------------------------------------------------
class PdfProcessor:
    def _format_date(self, date_str):
        if not date_str:
            return ""
        formats = [
            "%d/%m/%Y %I:%M:%S %p",
            "%Y-%m-%d %H:%M:%S",
            "%d/%m/%Y %H:%M",
            "%d/%m/%Y",
            "%Y-%m-%d",
            "%d-%m-%Y %H:%M:%S",
            "%d-%m-%Y",
        ]
        for fmt in formats:
            try:
                date_obj = datetime.strptime(date_str, fmt)
                return date_obj.strftime("%Y-%m-%d")
            except ValueError:
                continue
        date_parts = re.findall(r"\b(\d{2}/\d{2}/\d{4})\b", date_str)
        if date_parts:
            try:
                date_obj = datetime.strptime(date_parts[0], "%d/%m/%Y")
                return date_obj.strftime("%Y-%m-%d")
            except ValueError:
                pass
        logging.warning(f"No se pudo formatear la fecha: {date_str}")
        return date_str

    def extract_pdf_data(self, pdf_path):
        try:
            pdf_path = Path(pdf_path)
            if not pdf_path.exists():
                raise FileNotFoundError(f"El archivo PDF no existe: {pdf_path}")
            doc = fitz.open(pdf_path)
            text = ""
            for page in doc:
                text += page.get_text() + "\n"

            # Guardar el texto extraído para depuración
            log_dir = Path("logs")
            log_dir.mkdir(exist_ok=True)
            with open(
                log_dir / f"{pdf_path.stem}_extracted_text.log", "w", encoding="utf-8"
            ) as f:
                f.write(text)

            text = unicodedata.normalize("NFC", text)

            extraction_rules = {
                "No. Identificación": {
                    "patterns": [
                        r"Identificación\n+C\.C\.\s*([\d\.]+)",
                        r"(?:No\.?\s+Identificación|Identificación|Cédula de Ciudadanía|C\.C\.)\s*[:\s]*\n?(\d[\d\.\s]{5,11}\d)",
                        r"(\d{1,3}(?:\.\d{3})*-\d)",
                    ],
                    "processor": lambda x: re.sub(r"[^\d]", "", x.strip()) if x else "",
                },
                "Nombre Completo": {
                    "patterns": [
                        r"Primer Apellido\n(.*?)\nNombres\n(.*?)\n",
                        r"Primer Apellido\s*([\w\s]+?)\s*Segundo Apellido\s*([\w\s]+?)\s*Nombres\s*([\w\s]+?)(?=\n)",
                        r"Nombre(?:s y|\s+)Apellidos\s*[:\s]*([\w\s]+?)(?=\n)",
                        r"Nombre Completo\s*[:\s]*([\w\s]+?)(?=\n)",
                    ],
                    "processor": lambda x: " ".join(x).strip().upper()
                    if isinstance(x, tuple)
                    else x.strip().upper(),
                },
                "Fecha del Accidente": {
                    "patterns": [
                        r"Fecha y Hora del Accidente\n(\d{2}/\d{2}/\d{4})",
                        r"(?:Fecha y Hora del Accidente|Fecha del Accidente|Fecha de Ocurrencia|Fecha Accidente)\s*[:\s]*\b(\d{2}/\d{2}/\d{4})",
                        r"Fecha del evento:\s*(\d{2}/\d{2}/\d{4})",
                    ],
                    "processor": lambda x: self._format_date(x.strip()),
                },
                "Hora del Accidente": {
                    "patterns": [
                        r"Fecha y Hora del Accidente\n\d{2}/\d{2}/\d{4}\s*([0-9:]+\s*[AP]M)",
                        r"(?:Fecha y Hora del Accidente|Hora del Accidente|Hora de Ocurrencia)\s*[:\s]*.*?(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)",
                        r"Hora del evento:\s*(\d{1,2}:\d{2})",
                    ],
                    "processor": lambda x: x.strip(),
                },
                "Cargo": {
                    "patterns": [
                        r"Cargo\n([A-Z\s]+?)\nOcupación Habitual",
                        r"Cargo\s*\n.*?\n([\w\s]+?)\n",
                        r"Ocupación Habitual\s*[:\s]*([\w\s]+?)(?=\n|Código)",
                    ],
                    "processor": lambda x: x.strip().upper(),
                },
                "Descripcion del Accidente": {
                    "patterns": [
                        r"IV. DESCRIPCIÓN DEL ACCIDENTE\nObservaciones\n(.*?)(?=\nPersonas que Presenciaron)",
                        r"IV\.\s*DESCRIPCIÓN\s+DEL\s+ACCIDENTE\s*\n(.*?)(?=\nPersonas|V\.\s*DATOS)",
                        r"Descripción detallada del Accidente\s*[:\s]*(.*?)(?=\n\n|Firma)",
                    ],
                    "processor": lambda x: x.strip().replace("\n", " ") if x else "",
                },
                "Fecha de Nacimiento": {
                    "patterns": [
                        r"Fecha de Nacimiento\s+Sexo\n(?:.|)*?(\d{2}/\d{2}/\d{4})",
                        r"Fecha\s+de\s+Nacimiento\s*[:\s]*([\d/]+)",
                        r"Nacimiento\s*[:\s]*([\d/]+)",
                    ],
                    "processor": self._format_date,
                },
                "Telefono Domicilio": {
                    "patterns": [
                        r"Teléfono Domicilio(?:.|)*?(\d{10})",
                        r"Teléfono:\s*([\d\s()-]+)",
                    ],
                    "processor": lambda x: x.strip() if x else "N/A",
                },
                "Fecha de Ingreso a la Empresa": {
                    "patterns": [
                        r"Fecha de Ingreso a la Empresa\s+Salario(?:.|)*?(\d{2}/\d{2}/\d{4})",
                        r"Fecha de Ingreso\s*[:\s]*([\d/]+)",
                    ],
                    "processor": self._format_date,
                },
                "Tipo de Accidente": {
                    "patterns": [
                        r"Tipo de Accidente\n([^\n]+)",
                        r"Propios del trabajo\s*[:\s]*(.*?)(?:\n|$)",
                    ],
                    "processor": lambda x: x.strip(),
                },
                "Lugar del Accidente": {
                    "patterns": [r"Lugar donde Ocurrio el accidente\n([^\n]+)"],
                    "processor": lambda x: x.strip(),
                },
                "Sitio de Ocurrencia": {
                    "patterns": [
                        r"Sitio de Ocurrencia\n([^\n]+)",
                        r"AREAS DE PRODUCCION\s*[:\s]*(.*?)(?:\n|$)",
                    ],
                    "processor": lambda x: x.strip(),
                },
                "Tipo de Lesion": {
                    "patterns": [r"Tipo de Lesión\n([^\n]+)"],
                    "processor": lambda x: x.strip(),
                },
                "Parte del Cuerpo Afectada": {
                    "patterns": [r"Parte del Cuerpo Aparentemente Afectada\n([^\n]+)"],
                    "processor": lambda x: x.strip(),
                },
                "Agente del Accidente": {
                    "patterns": [r"Agente del Accidente\n([^\n]+)"],
                    "processor": lambda x: x.strip(),
                },
                "Mecanismo o Forma del Accidente": {
                    "patterns": [r"Mecanismo o Forma del Accidente\n([^\n]+)"],
                    "processor": lambda x: x.strip(),
                },
                "Jornada de Trabajo Habitual": {
                    "patterns": [
                        r"Jornada de Trabajo Habitual(?:.|)+?([A-Za-z]+)\n+III",
                        r"Jornada de Trabajo\s*[:\s]*([a-zA-Z\s]+)",
                    ],
                    "processor": lambda x: x.strip() if x else "N/A",
                },
                "Tiempo de Ocupacion": {
                    "patterns": [
                        r"Tiempo de Ocupación Habitual al Momento del Accidente\n([^\n]+)",
                        r"Tiempo de Ocupación Habitual\s*[:\s]*([\w\s.,]+)",
                    ],
                    "processor": lambda x: x.strip() if x else "N/A",
                },
                "Tipo de Vinculacion": {
                    "patterns": [
                        r"Tipo de Vinculación\n([^\n]+)",
                        r"Vinculación\s*[:\s]*([\w\s]+)",
                    ],
                    "processor": lambda x: x.strip() if x else "N/A",
                },
            }
            data = {}
            for key, rule in extraction_rules.items():
                value = ""
                for pattern in rule["patterns"]:
                    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
                    if match:
                        groups = match.groups()
                        if isinstance(groups, tuple) and len(groups) > 1:
                            value = rule["processor"](groups)
                        else:
                            value = rule["processor"](groups[0])
                        logging.debug(
                            f"Campo '{key}' extraído con patrón '{pattern}': {value}"
                        )
                        break
                data[key] = value or "N/A"

            self._validate_critical_data(data, pdf_path)
            return data
        except Exception as e:
            logging.error(f"Error en extract_pdf_data: {e}")
            raise

    def _validate_critical_data(self, data, pdf_path):
        errors = [
            f"{field} no encontrado"
            for field, value in data.items()
            if value == "N/A"
            and field in ["No Identificacion", "Nombre Completo", "Fecha del Accidente"]
        ]
        if errors:
            raise ValueError(
                f"Errores en la extracción de datos en {pdf_path.name}: {', '.join(errors)}"
            )


# -------------------------------------------------------------------------------------------------------------------
class DocumentGenerator:
    def generate_informe_accidente(self, data, template_path, output_dir):
        try:
            doc = DocxTemplate(template_path)
            context = data.copy()
            context = {k.replace(" ", "_").replace(".", ""): v for k, v in data.items()}

            for i in range(1, 6):
                por_que_key = f"Por Qué {i}"
                context[f"por_que_{i}"] = data.get(por_que_key, {}).get("causa", "N/A")
                for m in [
                    "Mano de Obra",
                    "Método",
                    "Maquinaria",
                    "Medio Ambiente",
                    "Material",
                ]:
                    context[f"por_que_{i}_{m.lower().replace(' ', '_')}"] = data.get(
                        por_que_key, {}
                    ).get(m, "N/A")

            doc.render(context)
            nombre_sanitizado = re.sub(
                r"[^\w\s-]", "", data.get("Nombre_Completo", "sin_nombre")
            ).replace(" ", "_")
            output_path = (
                Path(output_dir)
                / f"GI-FO-020_INVESTIGACION_{nombre_sanitizado}_{datetime.now().strftime('%Y%m%d')}.docx"
            )
            doc.save(output_path)
            logging.info(f"Informe creado: {output_path}")
            return str(output_path)
        except Exception as e:
            logging.error(f"Error en generate_informe_accidente: {e}")
            raise


# -------------------------------------------------------------------------------------------------------------------
# Intentar importar tkinter y ttkbootstrap para la GUI
# Si no está disponible (ej: cuando se usa desde el backend de Electron),
# las clases de procesamiento (PdfProcessor, AccidentAnalyzer) seguirán funcionando
try:
    from tkinter import messagebox, filedialog, StringVar
    from tkinter.font import Font
    import ttkbootstrap as ttk
    from ttkbootstrap.constants import *
    from ttkbootstrap.scrolled import ScrolledFrame

    TTKBOOTSTRAP_AVAILABLE = True
except ImportError:
    ttk = None
    TTKBOOTSTRAP_AVAILABLE = False
    Font = None
    StringVar = None
    messagebox = None
    filedialog = None
    # Definir constantes dummy para evitar errores de sintaxis
    YES = True
    NO = False
    BOTH = "both"
    EW = "ew"
    NS = "ns"
    NSEW = "nsew"
    SOLID = "solid"
    HORIZONTAL = "horizontal"
    WORD = "word"
    LEFT = "left"
    RIGHT = "right"
    CENTER = "center"
    NORMAL = "normal"
    DISABLED = "disabled"
    SUCCESS = "success"
    INFO = "info"
    END = "end"


# Solo definir la clase GUI si ttkbootstrap está disponible
if TTKBOOTSTRAP_AVAILABLE:

    class RemisionesApp(ttk.Window):
        """Aplicación GUI para gestión de investigaciones de accidentes."""

        def __init__(self):
            super().__init__(
                themename="minty", title="Gestor de Investigaciones de Accidentes"
            )
            self.geometry("1210x800")
            self.configure(background="#f5f5f5")  # Un gris ligeramente más claro

            self.pdf_processor = PdfProcessor()
            self.doc_generator = DocumentGenerator()
            self.analyzer = None
            self.pdf_path = StringVar()
            self.output_path = StringVar()
            self.empresa = StringVar(value="TEMPOACTIVA")
            self.extracted_data_vars = {}

            self._setup_styles()
            self._create_widgets()
            self._update_paths()
            self.after(100, self._load_model_async)

        def _setup_styles(self):
            self.title_font = Font(family="Segoe UI Variable", size=16, weight="bold")
            self.header_font = Font(family="Segoe UI Variable", size=12, weight="bold")
            self.body_font = Font(family="Segoe UI Variable", size=10)
            self.bold_body_font = Font(
                family="Segoe UI Variable", size=10, weight="bold"
            )

            # Estilo de fondo principal
            self.style.configure("TFrame", background="#f5f5f5")
            self.style.configure("TLabel", background="#f5f5f5")

            # Estilo para las tarjetas principales (simulando suavidad)
            self.style.configure(
                "Card.TFrame",
                background="white",
                borderwidth=1,
                relief=SOLID,
                bordercolor="#eeeeee",
            )

            # Estilo para los contenedores internos (invisibles)
            self.style.configure("Inner.TFrame", background="white")

            # Estilos de texto con fondo blanco para que se integren a las tarjetas
            self.style.configure(
                "CardTitle.TLabel", font=self.header_font, background="white"
            )
            self.style.configure(
                "CardBody.TLabel", font=self.body_font, background="white"
            )
            self.style.configure(
                "5MHeader.TLabel",
                font=self.bold_body_font,
                foreground=self.style.colors.primary,
                background="white",
            )
            self.style.configure("TProgressbar", background=self.style.colors.primary)

        def _load_model_async(self):
            self.log_message("Cargando modelo de IA...")
            self.process_button.config(state=DISABLED)
            self.status_label.config(text="Cargando modelo de IA, por favor espere...")
            self.progress_bar.start(10)
            threading.Thread(target=self._initialize_analyzer, daemon=True).start()

        def _initialize_analyzer(self):
            try:
                self.analyzer = AccidentAnalyzer()
                self.after(0, self._on_model_loaded)
            except Exception as e:
                self.after(0, self._on_model_load_error, e)

        def _on_model_loaded(self):
            self.log_message("Modelo de IA cargado.", success=True)
            self.process_button.config(state=NORMAL)
            self.status_label.config(text="Listo para procesar")
            self.progress_bar.stop()

        def _on_model_load_error(self, error):
            self.log_message(f"Error al cargar modelo: {error}", error=True)
            messagebox.showerror(
                "Error Crítico de Modelo",
                f"No se pudo inicializar el modelo de IA: {error}",
            )
            self.status_label.config(text="Error de modelo")
            self.progress_bar.stop()

        def _create_widgets(self):
            main_frame = ttk.Frame(self, padding=25)
            main_frame.pack(fill=BOTH, expand=YES)
            main_frame.grid_rowconfigure(0, weight=1)
            main_frame.grid_columnconfigure(0, weight=2, minsize=450)
            main_frame.grid_columnconfigure(1, weight=5)

            # --- Columna Izquierda (Config y Datos) ---
            left_column = ttk.Frame(main_frame)
            left_column.grid(row=0, column=0, sticky="nsew", padx=(0, 25))
            left_column.grid_rowconfigure(1, weight=1)

            # Card de Configuración
            config_card = ttk.Frame(left_column, style="Card.TFrame", padding=20)
            config_card.grid(row=0, column=0, sticky="new", pady=(0, 20))
            config_card.grid_columnconfigure(1, weight=1)
            ttk.Label(
                config_card, text="1. Configuración", style="CardTitle.TLabel"
            ).grid(row=0, column=0, columnspan=3, sticky="w", pady=(0, 15))

            ttk.Label(config_card, text="Archivo PDF:", style="CardBody.TLabel").grid(
                row=1, column=0, sticky="w", padx=(0, 10)
            )
            pdf_entry = ttk.Entry(config_card, textvariable=self.pdf_path)
            pdf_entry.grid(row=1, column=1, sticky="ew")
            ttk.Button(
                config_card,
                text="Buscar...",
                command=self._browse_pdf,
                bootstyle="primary-outline",
            ).grid(row=1, column=2, padx=(10, 0))

            ttk.Label(config_card, text="Empresa:", style="CardBody.TLabel").grid(
                row=2, column=0, sticky="w", pady=(15, 0), padx=(0, 10)
            )
            empresa_combo = ttk.Combobox(
                config_card,
                textvariable=self.empresa,
                values=list(Config.RUTAS.keys()),
                state="readonly",
            )
            empresa_combo.grid(row=2, column=1, columnspan=2, sticky="ew", pady=(15, 0))
            empresa_combo.bind("<<ComboboxSelected>>", self._update_paths)

            # Card de Datos del Accidente
            data_card = ttk.Frame(left_column, style="Card.TFrame", padding=20)
            data_card.grid(row=1, column=0, sticky="nsew")
            data_card.grid_rowconfigure(1, weight=1)
            data_card.grid_columnconfigure(0, weight=1)
            ttk.Label(
                data_card, text="2. Datos del Accidente", style="CardTitle.TLabel"
            ).grid(row=0, column=0, sticky="w", pady=(0, 10))
            self._create_extracted_data_widgets(data_card)

            # --- Columna Derecha (Análisis y Logs) ---
            right_column = ttk.Frame(main_frame)
            right_column.grid(row=0, column=1, sticky="nsew")
            right_column.grid_rowconfigure(1, weight=1)
            right_column.grid_columnconfigure(0, weight=1)

            # Card de Contexto Adicional
            context_card = ttk.Frame(right_column, style="Card.TFrame", padding=20)
            context_card.grid(row=0, column=0, sticky="new", pady=(0, 20))
            context_card.grid_columnconfigure(0, weight=1)
            ttk.Label(
                context_card,
                text="3. Contexto Adicional (Opcional)",
                style="CardTitle.TLabel",
            ).grid(row=0, column=0, sticky="w", pady=(0, 15))
            self.context_text = ttk.Text(
                context_card,
                height=4,
                wrap=WORD,
                font=self.body_font,
                relief=SOLID,
                borderwidth=1,
                highlightthickness=0,
                border="1px solid #ccc",
            )
            self.context_text.grid(row=1, column=0, sticky="ew")
            self.context_text.insert(
                END, "Añade aquí cualquier detalle no presente en el FURAT..."
            )

            # Card de Análisis de Causa Raíz
            five_whys_card = ttk.Frame(right_column, style="Card.TFrame", padding=20)
            five_whys_card.grid(row=1, column=0, sticky="nsew")
            five_whys_card.grid_rowconfigure(1, weight=1)
            five_whys_card.grid_columnconfigure(0, weight=1)
            ttk.Label(
                five_whys_card,
                text="4. Análisis de Causa Raíz",
                style="CardTitle.TLabel",
            ).grid(row=0, column=0, sticky="w", pady=(0, 10))
            self.five_whys_scroll = ScrolledFrame(
                five_whys_card, autohide=True, style="Inner.TFrame"
            )
            self.five_whys_scroll.grid(row=1, column=0, sticky="nsew", pady=(5, 0))
            self.five_whys_container = self.five_whys_scroll.container
            self.five_whys_container.configure(style="Inner.TFrame")
            self._display_five_whys({})

            # Card de Registro de Actividad
            results_card = ttk.Frame(right_column, style="Card.TFrame", padding=20)
            results_card.grid(row=2, column=0, sticky="new", pady=(20, 0))
            results_card.grid_columnconfigure(0, weight=1)
            ttk.Label(
                results_card, text="5. Registro de Actividad", style="CardTitle.TLabel"
            ).grid(row=0, column=0, sticky="w", pady=(0, 15))
            self.results_text = ttk.Text(
                results_card,
                height=6,
                wrap=WORD,
                font=self.body_font,
                relief=SOLID,
                borderwidth=1,
                highlightthickness=0,
                border="1px solid #ccc",
            )
            self.results_text.grid(row=1, column=0, sticky="ew")

            # --- Barra de Estado y Botones ---
            status_frame = ttk.Frame(self, padding=(20, 15))
            status_frame.pack(side=BOTTOM, fill=X)
            status_frame.grid_columnconfigure(1, weight=1)

            self.status_label = ttk.Label(status_frame, text="Inicializando...")
            self.status_label.grid(row=0, column=0, sticky="w")
            self.progress_bar = ttk.Progressbar(status_frame, mode="indeterminate")
            self.progress_bar.grid(row=0, column=1, sticky="ew", padx=20)

            action_frame = ttk.Frame(status_frame)
            action_frame.grid(row=0, column=2, sticky="e")
            self.process_button = ttk.Button(
                action_frame,
                text="PROCESAR Y GENERAR INFORME",
                command=self._process_pdf,
                bootstyle="success",
            )
            self.process_button.pack(side=LEFT, padx=5)
            ttk.Button(
                action_frame,
                text="LIMPIAR",
                command=self._clear_data,
                bootstyle="secondary-outline",
            ).pack(side=LEFT)

        def _create_extracted_data_widgets(self, parent):
            container = ttk.Frame(parent, style="Inner.TFrame")
            container.grid(row=1, column=0, sticky="nsew", pady=(5, 0))
            container.grid_columnconfigure(1, weight=1)

            fields = [
                "Nombre Completo",
                "No Identificacion",
                "Fecha del Accidente",
                "Hora del Accidente",
                "Empresa",
                "Cargo",
                "Tipo de Accidente",
                "Lugar del Accidente",
                "Sitio de Ocurrencia",
                "Tipo de Lesion",
                "Parte del Cuerpo Afectada",
                "Agente del Accidente",
                "Mecanismo o Forma del Accidente",
                "Descripcion del Accidente",
            ]

            for i, field in enumerate(fields):
                key = field.replace(" ", "_")
                label = ttk.Label(container, text=f"{field}:", style="CardBody.TLabel")
                label.grid(row=i, column=0, sticky="ne", padx=(0, 10), pady=4)

                if field == "Descripcion del Accidente":
                    text_widget = ttk.Text(
                        container,
                        height=5,
                        wrap=WORD,
                        state="disabled",
                        width=35,
                        font=self.body_font,
                        relief=SOLID,
                        borderwidth=1,
                        highlightthickness=0,
                        border="1px solid #ccc",
                    )
                    text_widget.grid(row=i, column=1, sticky="ew", pady=4)
                    self.extracted_data_vars[key] = text_widget
                else:
                    self.extracted_data_vars[key] = StringVar(value="N/A")
                    entry = ttk.Entry(
                        container,
                        textvariable=self.extracted_data_vars[key],
                        state="readonly",
                        width=35,
                    )
                    entry.grid(row=i, column=1, sticky="ew", pady=4)

        def _update_paths(self, event=None):
            empresa = self.empresa.get()
            paths = Config.get_empresa_paths(empresa)
            self.output_path.set(str(paths["investigaciones"]))
            self.log_message(f"Rutas actualizadas para {empresa}")

        def _browse_pdf(self):
            file = filedialog.askopenfilename(
                title="Seleccionar PDF", filetypes=[("Archivos PDF", "*.pdf")]
            )
            if file:
                self.pdf_path.set(file)

        def _process_pdf(self):
            if not self.pdf_path.get():
                messagebox.showerror("Error", "Por favor, seleccione un archivo PDF.")
                return
            if not self.analyzer:
                messagebox.showerror(
                    "Modelo no listo", "El modelo de IA aún se está cargando."
                )
                return

            self._clear_data()
            self.process_button.config(state=DISABLED)
            self.progress_bar.start(10)
            self.log_message("Iniciando proceso...")
            threading.Thread(target=self._process_pdf_thread, daemon=True).start()

        def _process_pdf_thread(self):
            try:
                pdf_path = Path(self.pdf_path.get())
                output_dir = Path(self.output_path.get())
                template_path = Config.get_empresa_paths(self.empresa.get())[
                    "plantilla"
                ]
                contexto_adicional = self.context_text.get(1.0, END).strip()

                self.log_message(f"Extrayendo datos de {pdf_path.name}...")
                data = self.pdf_processor.extract_pdf_data(pdf_path)
                self.after(0, lambda: self._display_extracted_data(data))

                self.log_message("Analizando causas con el modelo de IA...")
                descripcion = data.get("Descripcion del Accidente", "")
                cinco_whys = self.analyzer.analyze_5whys(
                    descripcion, contexto_adicional
                )
                data.update(cinco_whys)
                self.after(0, lambda: self._display_five_whys(data))

                self.log_message("Generando informe...")
                informe_path = self.doc_generator.generate_informe_accidente(
                    data, template_path, output_dir
                )
                self.log_message(f"Informe generado: {informe_path}", success=True)
                if messagebox.askyesno(
                    "Proceso Completado",
                    f"Informe generado en:\n{informe_path}\n\n¿Desea abrir el archivo ahora?",
                ):
                    os.startfile(informe_path)

            except Exception as e:
                error_msg = f"Ha ocurrido un error: {str(e)}"
                self.log_message(error_msg, error=True)
                messagebox.showerror("Error en el Proceso", error_msg)
            finally:
                self.after(0, self.progress_bar.stop)
                self.after(0, lambda: self.process_button.config(state=NORMAL))

        def _display_extracted_data(self, data):
            for field, value in data.items():
                key = field.replace(" ", "_")
                if key in self.extracted_data_vars:
                    widget = self.extracted_data_vars[key]
                    if isinstance(widget, ttk.Text):
                        widget.config(state="normal")
                        widget.delete(1.0, END)
                        widget.insert(END, value or "N/A")
                        widget.config(state="disabled")
                    elif isinstance(widget, StringVar):
                        widget.set(value or "N/A")

        def _display_five_whys(self, data):
            for widget in self.five_whys_container.winfo_children():
                widget.destroy()

            container = self.five_whys_container
            container.grid_columnconfigure(0, weight=1)

            m_categories = [
                "Mano de Obra",
                "Método",
                "Maquinaria",
                "Medio Ambiente",
                "Material",
            ]

            for i in range(1, 6):
                por_que_key = f"Por Qué {i}"
                row_data = data.get(por_que_key, {})

                card = ttk.Frame(container, style="Card.TFrame", padding=(15, 10))
                card.grid(row=i - 1, column=0, sticky="ew", pady=(0, 15))
                card.grid_columnconfigure(0, weight=1)

                # --- Fila de Causa Principal ---
                header_frame = ttk.Frame(card, style="Inner.TFrame")
                header_frame.grid(row=0, column=0, sticky="ew", pady=(0, 10))
                header_frame.grid_columnconfigure(1, weight=1)

                ttk.Label(header_frame, text=f"{i}.", style="CardTitle.TLabel").grid(
                    row=0, column=0, sticky="nw", padx=(0, 10)
                )
                causa_text = row_data.get("causa", "Análisis no disponible")
                if "?" not in causa_text and "no disponible" not in causa_text:
                    causa_text = f"¿Por qué {causa_text.lower()}?"

                causa_label = ttk.Label(
                    header_frame,
                    text=causa_text,
                    wraplength=900,
                    style="Header.TLabel",
                    background="white",
                )
                causa_label.grid(row=0, column=1, sticky="w")

                ttk.Separator(card, orient=HORIZONTAL).grid(
                    row=1, column=0, sticky="ew", pady=5
                )

                # --- Grid de 5M ---
                m_frame = ttk.Frame(card, style="Inner.TFrame")
                m_frame.grid(row=2, column=0, sticky="ew", padx=5)
                m_frame.grid_columnconfigure(list(range(5)), weight=1)

                for j, m_category in enumerate(m_categories):
                    m_cell = ttk.Frame(m_frame, style="Inner.TFrame")
                    m_cell.grid(row=0, column=j, sticky="nsew", padx=5, pady=5)

                    ttk.Label(m_cell, text=m_category, style="5MHeader.TLabel").pack(
                        anchor="w", pady=(0, 3)
                    )

                    m_text = row_data.get(m_category, "N/A")
                    m_label = ttk.Label(
                        m_cell, text=m_text, wraplength=180, style="CardBody.TLabel"
                    )
                    m_label.pack(anchor="w", fill=X)

        def _clear_data(self):
            self.log_message("Limpiando datos...")
            for key, var in self.extracted_data_vars.items():
                if isinstance(var, ttk.Text):
                    var.config(state="normal")
                    var.delete(1.0, END)
                    var.config(state="disabled")
                else:
                    var.set("N/A")
            self._display_five_whys({})
            self.context_text.delete(1.0, END)
            self.context_text.insert(
                END, "Añade aquí cualquier detalle no presente en el FURAT..."
            )
            self.results_text.delete(1.0, END)
            self.log_message("Datos limpiados.")

        def log_message(self, message, error=False, success=False):
            timestamp = datetime.now().strftime("%H:%M:%S")
            tag = "info"
            if error:
                tag = "error"
            elif success:
                tag = "success"

            self.results_text.tag_config("error", foreground=self.style.colors.danger)
            self.results_text.tag_config(
                "success", foreground=self.style.colors.success
            )
            self.results_text.tag_config("info", foreground=self.style.colors.secondary)

            self.results_text.insert(END, f"{timestamp} ")
            self.results_text.insert(END, f"[{tag.upper()}] ", tag)
            self.results_text.insert(END, f"{message}\n")
            self.results_text.see(END)
            logging.info(message)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--get-template-path" and len(sys.argv) > 2:
        empresa = sys.argv[2]
        paths = Config.get_empresa_paths(empresa)
        print(json.dumps({"template_path": str(paths["plantilla"])}))
        sys.exit(0)

    if len(sys.argv) > 1 and sys.argv[1] == "--get-config" and len(sys.argv) > 2:
        empresa = sys.argv[2]
        paths = Config.get_empresa_paths(empresa)
        config = {
            "investigaciones": str(paths["investigaciones"]),
            "plantilla": str(paths["plantilla"]),
        }
        print(json.dumps(config))
        sys.exit(0)

    # Nota: la verificacion de GPU ya no es necesaria aca. Ollama gestiona la
    # seleccion de dispositivo (GPU vs CPU) internamente. Si Ollama no detecta
    # GPU, mostrara su propia advertencia al usuario. La GPU/CPU de este
    # proceso Python es irrelevante porque la inferencia ocurre en otro proceso.
    try:
        app = RemisionesApp()
        app.mainloop()
    except Exception as e:
        logging.critical(
            f"Error fatal al iniciar la aplicación: {e}\n{traceback.format_exc()}"
        )
        messagebox.showerror(
            "Error Fatal",
            f"No se pudo iniciar la aplicación. Revise el archivo 'accidentes_app.log' para más detalles.\n\nError: {e}",
        )

# Esta Es la Versión 0.7 de la Aplicación de Inversión de Accidentes

import os
import re
import json
import logging
import traceback
import threading
import unicodedata
from pathlib import Path
from datetime import datetime
from tkinter import messagebox, filedialog, StringVar
import ttkbootstrap as ttk
from ttkbootstrap.constants import *
from ttkbootstrap.scrolled import ScrolledFrame
from docxtpl import DocxTemplate
import jinja2
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import torch
import warnings
import fitz
import sys

#-------------------------------------------------------------------------------------------------------------------
# Configuración de la GPU y advertencias
warnings.filterwarnings("ignore")
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["CUDA_DEVICE_ORDER"] = "PCI_BUS_ID"
os.environ["CUDA_VISIBLE_DEVICES"] = "0"

#-------------------------------------------------------------------------------------------------------------------
class AccidentAnalyzer:
    """Genera la metodología '5 Por Qué' usando un LLM (Mistral-7B-Instruct-v0.3)."""
    def __init__(self):
        self.model_path = r"D:\1. Estudio\1.1 IA\1.1.2. LLM's\Inv. AT\models--mistralai--Mistral-7B-Instruct-v0.3\snapshots\e0bc86c23ce5aae1db576c8cca6f06f1f73af2db"
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"No se encontró el modelo en la ruta: {self.model_path}")
        try:
            print("Cargando tokenizer...", file=sys.stderr)
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
            self.tokenizer.pad_token = self.tokenizer.eos_token
            print("Modelo cargado.", file=sys.stderr)
            
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            print(f"Usando dispositivo: {device}", file=sys.stderr)
            quantization_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True
            )
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_path,
                quantization_config=quantization_config,
                device_map="auto",
                torch_dtype=torch.float16,
                trust_remote_code=True,
                low_cpu_mem_usage=True
            )
            print(" Modelo cargado exitosamente.", file=sys.stderr)
        except Exception as e:
            raise RuntimeError(f"No se pudo cargar el modelo: {e}")

    def analyze_5whys(self, descripcion_accidente: str, contexto_adicional: str = "") -> dict:
        if not descripcion_accidente or descripcion_accidente.strip() == "N/A":
            logging.warning("No se proporcionó descripción del accidente para el análisis. Saltando.")
            return self._generate_fallback_analysis()

        prompt_rules = ("""
Tu rol es ser un analista experto en seguridad laboral. Tu única tarea es realizar un análisis '5 Porqués' para un accidente, siguiendo el formato 5M.
REGLA ABSOLUTA: Debes responder exclusivamente en español y seguir el formato del ejemplo al pie de la letra.

EJEMPLO DE RESPUESTA ESTRUCTURADA:
1. ¿Por qué el trabajador se cayó de la escalera? [Causa Directa]
   • Mano de Obra: El trabajador no mantuvo tres puntos de contacto.
   • Método: El procedimiento de trabajo en alturas era ambiguo.
   • Maquinaria: La escalera tenía un peldaño dañado.
   • Medio Ambiente: El suelo estaba resbaladizo por un derrame.
   • Material: N/A
2. ¿Por qué el trabajador no mantuvo tres puntos de contacto?
   • Mano de Obra: Intentaba cargar una caja mientras subía.
   • Método: No se prohibió explícitamente subir con objetos en las manos.
   • Maquinaria: N/A
   • Medio Ambiente: N/A
   • Material: La caja era pesada y voluminosa.
3. ¿Por qué intentaba cargar una caja mientras subía?
   • Mano de Obra: Quería terminar la tarea más rápido.
   • Método: La planificación del trabajo no incluyó un sistema de izado.
   • Maquinaria: No había montacargas disponible en esa área.
   • Medio Ambiente: N/A
   • Material: N/A
4. ¿Por qué la planificación no incluyó un sistema de izado?
   • Mano de Obra: El supervisor no evaluó correctamente los riesgos.
   • Método: El formato de permiso de trabajo no tiene un campo para equipos de izado.
   • Maquinaria: N/A
   • Medio Ambiente: N/A
   • Material: N/A
5. ¿Por qué el supervisor no evaluó correctamente los riesgos?
   • Mano de Obra: Falta de capacitación en identificación de peligros.
   • Método: La empresa no tiene un programa de capacitación continua.
   • Maquinaria: N/A
   • Medio Ambiente: N/A
   • Material: N/A

Ahora, realiza el análisis para el siguiente accidente, imitando el formato del ejemplo y siguiendo las reglas.
- Basa tu análisis en la información proporcionada.
- Completa los 5 niveles del porqué.
- Para cada nivel, analiza las 5M (Mano de Obra, Método, Maquinaria, Medio Ambiente, Material). Si una categoría no aplica, indica "N/A".
- Sé conciso y accionable.""")
        descripcion_str = f"**Descripción del accidente:**\n{descripcion_accidente}"
        contexto_str = f"\n\n**Contexto Adicional:**\n{contexto_adicional}" if contexto_adicional and "Añade aquí" not in contexto_adicional else ""
        final_user_prompt = f"{prompt_rules}\n\n{descripcion_str}{contexto_str}\n\n**Análisis de 5 Porqués:**"
        messages = [{"role": "user", "content": final_user_prompt}]
        
        logging.info(f"Enviando el siguiente prompt al modelo:\n{final_user_prompt}")

        try:
            input_ids = self.tokenizer.apply_chat_template(messages, add_generation_prompt=True, return_tensors="pt").to(self.model.device)
            outputs = self.model.generate(input_ids=input_ids, max_new_tokens=1024, temperature=0.7, do_sample=True, pad_token_id=self.tokenizer.eos_token_id)
            analysis = self.tokenizer.decode(outputs[0][input_ids.shape[-1]:], skip_special_tokens=True)
            
            logging.info(f"Respuesta cruda del modelo:\n---\n{analysis}\n---")

            parsed_analysis = self._parse_structured_analysis(analysis)
            logging.info(f"Análisis parseado: {json.dumps(parsed_analysis, indent=2, ensure_ascii=False)}")
            
            return parsed_analysis
        except Exception as e:
            logging.error(f"Error en análisis '5 Por Qué': {e}\n{traceback.format_exc()}")
            return self._generate_fallback_analysis()

    def _parse_structured_analysis(self, text: str) -> dict:
        logging.info(f"Iniciando parseo del siguiente texto:\n---\n{text}\n---")
        causas = {}
        level_pattern = r'(\d+)\.\s*¿Por qué(.*?)(?=\n\d+\. ¿Por qué|\Z)'
        matches = re.finditer(level_pattern, text, re.DOTALL | re.IGNORECASE)
        
        found_matches = False
        for match in matches:
            found_matches = True
            level = int(match.group(1))
            if 1 <= level <= 5:
                level_content = match.group(2).strip()
                logging.info(f"Encontrado 'Por Qué {level}': Contenido='{level_content[:100]}...' صلصل")
                causas[f"Por Qué {level}"] = self._parse_level_content(level_content)
        
        if not found_matches:
            logging.warning("No se encontraron coincidencias para el patrón de 'Por Qué' en la respuesta del modelo.")

        for i in range(1, 6):
            if f"Por Qué {i}" not in causas:
                causas[f"Por Qué {i}"] = {"causa": "Análisis no generado", "Mano de Obra": "N/A", "Método": "N/A", "Maquinaria": "N/A", "Medio Ambiente": "N/A", "Material": "N/A"}
        
        logging.info(f"Resultado final del parseo: {json.dumps(causas, indent=2, ensure_ascii=False)}")
        return causas

    def _parse_level_content(self, content: str) -> dict:
        lines = content.split('\n')
        causa_principal = lines[0].strip()
        level_data = {"causa": causa_principal, "Mano de Obra": "N/A", "Método": "N/A", "Maquinaria": "N/A", "Medio Ambiente": "N/A", "Material": "N/A"}
        category_pattern = r'•\s*(Mano de Obra|Método|Maquinaria|Medio Ambiente|Material):\s*(.*?)(?=\n\s*•|\Z)'
        for match in re.finditer(category_pattern, content, re.DOTALL | re.IGNORECASE):
            category_map = {"mano de obra": "Mano de Obra", "método": "Método", "maquinaria": "Maquinaria", "medio ambiente": "Medio Ambiente", "material": "Material"}
            category = next((v for k, v in category_map.items() if k in match.group(1).lower()), None)
            if category: level_data[category] = match.group(2).strip()
        return level_data

    def _generate_fallback_analysis(self) -> dict:
        return {f"Por Qué {i}": {"causa": "Análisis no disponible", "Mano de Obra": "N/A", "Método": "N/A", "Maquinaria": "N/A", "Medio Ambiente": "N/A", "Material": "N/A"} for i in range(1, 6)}

#-------------------------------------------------------------------------------------------------------------------
logging.basicConfig(filename='accidentes_app.log', level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s', encoding='utf-8')

class Config:
    RUTA_BASE = Path("G:/Mi unidad/2. Trabajo/1. SG-SST")
    RUTAS = {
        "TEMPOACTIVA": {
            "investigaciones": RUTA_BASE / "2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/2. Accidentes",
            "plantilla": RUTA_BASE / "2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/4. Procedimientos/GI-FO-020 INVESTIGACION.docx"
        },
        "TEMPOSUM": {
            "investigaciones": RUTA_BASE / "2. Temporales Comfa/2. Temposum Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades",
            "plantilla": RUTA_BASE / "2. Temporales Comfa/2. Temposum Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/4. Procedimientos/GI-FO-020 INVESTIGACION.docx"
        },
        "ASEPLUS": {
            "investigaciones": RUTA_BASE / "2. Temporales Comfa/3. Aseplus/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/3.2.2.1. Investigaciones",
            "plantilla": RUTA_BASE / "2. Temporales Comfa/3. Aseplus/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/4. Procedimientos/GI-FO-020 INVESTIGACION.docx"
        },
        "ASEL": {
            "investigaciones": RUTA_BASE / "19. Asel S.A.S/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/2. Accidentes",
            "plantilla": RUTA_BASE / "19. Asel S.A.S/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/4. Procedimientos/GI-FO-020 INVESTIGACION.docx"
        }
    },
    
    @classmethod
    def get_empresa_paths(cls, empresa):
        return cls.RUTAS.get(empresa.upper(), cls.RUTAS["TEMPOACTIVA"])

    @classmethod
    def get_template_path(cls, empresa):
        return str(cls.get_empresa_paths(empresa)["plantilla"])

    @classmethod
    def get_output_dir(cls, empresa):
        return str(cls.get_empresa_paths(empresa)["generated_reports"])

#-------------------------------------------------------------------------------------------------------------------
class PdfProcessor:
    def _format_date(self, date_str):
        if not date_str:
            return ""
        formats = [
            '%d/%m/%Y %I:%M:%S %p', '%Y-%m-%d %H:%M:%S',
            '%d/%m/%Y %H:%M', '%d/%m/%Y', '%Y-%m-%d',
            '%d-%m-%Y %H:%M:%S', '%d-%m-%Y'
        ]
        for fmt in formats:
            try:
                date_obj = datetime.strptime(date_str, fmt)
                return date_obj.strftime('%Y-%m-%d')
            except ValueError:
                continue
        date_parts = re.findall(r'\b(\d{2}/\d{2}/\d{4})\b', date_str)
        if date_parts:
            try:
                date_obj = datetime.strptime(date_parts[0], '%d/%m/%Y')
                return date_obj.strftime('%Y-%m-%d')
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
            with open(log_dir / f"{pdf_path.stem}_extracted_text.log", "w", encoding="utf-8") as f:
                f.write(text)

            text = unicodedata.normalize('NFC', text)
            
            extraction_rules = {
                'No Identificacion': {
                    'patterns': [
                        r'Identificación\s*\n.*?C\.C\. \s*(\d[\d\.\s]+)',
                        r'C\.C\. \s*([\d\.\s]+)',
                        r'Identificaci[oó]n\s*[:\s]*(\d[\d\.\s]+?)\s'
                    ],
                    'processor': lambda x: re.sub(r'[^\d]', '', x) if x else ""
                },
                'Nombre Completo': {
                    'patterns': [
                        r'Primer Apellido\s*([\w\s]+?)\s*Segundo Apellido\s*([\w\s]+?)\s*Nombres\s*([\w\s]+?)(?=\n)',
                        r'Nombre Completo\s*[:\s]*([\w\s]+?)(?=\n)'
                    ],
                    'processor': lambda x: " ".join(x).strip().upper() if isinstance(x, tuple) else x.strip().upper()
                },
                'Fecha del Accidente': {
                    'patterns': [
                        r'Fecha\s+y\s+Hora\s+del\s+Accidente\s*(\d{2}/\d{2}/\d{4})',
                        r'Fecha\s+del\s+Accidente\s*[:\s]*(\d{2}/\d{2}/\d{4})\b'
                    ],
                    'processor': self._format_date
                },
                'Hora del Accidente': {
                    'patterns': [r'Fecha\s+y\s+Hora\s+del\s+Accidente\s.*?(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM))'],
                    'processor': lambda x: x.strip()
                },
                'Cargo': {
                    'patterns': [r'Cargo\s*\n.*?\n([\w\s]+?)\n'],
                    'processor': lambda x: x.strip().upper()
                },
                'Tipo de Accidente': {
                    'patterns': [r'Tipo\s+de\s+Accidente\s*\n([\w\s]+?)(?=\n)'],
                    'processor': lambda x: x.strip()
                },
                'Lugar del Accidente': {
                    'patterns': [r'Lugar\s+donde\s+Ocurrio\s+el\s+accidente\s*\n([\w\s]+?)(?=\n)'],
                    'processor': lambda x: x.strip()
                },
                'Sitio de Ocurrencia': {
                    'patterns': [r'Sitio\s+de\s+Ocurrencia\s*\n([\w\s]+?)(?=\n)'],
                    'processor': lambda x: x.strip()
                },
                'Tipo de Lesion': {
                    'patterns': [r'Tipo\s+de\s+Lesión\s*\n([\w\s]+?)(?=\n)'],
                    'processor': lambda x: x.strip()
                },
                'Parte del Cuerpo Afectada': {
                    'patterns': [r'Parte\s+del\s+Cuerpo\s+Aparentemente\s+Afectada\s*\n([\w\s]+?)(?=\n)'],
                    'processor': lambda x: x.strip()
                },
                'Agente del Accidente': {
                    'patterns': [r'Agente\s+del\s+Accidente\s*\n([\w\s\(\)]+?)(?=\n)'],
                    'processor': lambda x: x.strip()
                },
                'Mecanismo o Forma del Accidente': {
                    'patterns': [r'Mecanismo\s+o\s+Forma\s+del\s+Accidente\s*\n([\w\s]+?)(?=\n)'],
                    'processor': lambda x: x.strip()
                },
                'Descripcion del Accidente': {
                    'patterns': [
                        r'IV\.\s*DESCRIPCIÓN\s+DEL\s+ACCIDENTE\s*\n(.*?)(?=\nPersonas)'],
                    'processor': lambda x: x.strip().replace('\n', ' ') if x else ''
                },
                'Fecha de Nacimiento': {
                    'patterns': [
                        r'Fecha\s+de\s+Nacimiento\s*[:\s]*([^\n]+)'], # Captura toda la línea después de "Fecha de Nacimiento:"
                    'processor': self._format_date # Reutiliza el formateador existente
                },
                'Telefono Domicilio': {
                    'patterns': [
                        r'Teléfono\s+Domicilio\s*[:\s]*([^\n]+)'],
                    'processor': lambda x: x.strip() if x else "N/A"
                },
                'Fecha de Ingreso a la Empresa': {
                    'patterns': [
                        r'Fecha\s+de\s+Ingreso\s+a\s+la\s+Empresa\s*[:\s]*([^\n]+)'],
                    'processor': self._format_date # Reutiliza el formateador existente
                },
                'Jornada de Trabajo Habitual': {
                    'patterns': [
                        r'Jornada\s+de\s+Trabajo\s+Habitual\s*[:\s]*([^\n]+)'],
                    'processor': lambda x: x.strip() if x else "N/A"
                },
                'Tiempo de Ocupacion': { # Clave normalizada
                    'patterns': [
                        r'Tiempo\s+de\s+Ocupación\s+Habitual\s+al\s+Momento\s+del\s+Accidente\s*[:\s]*([^\n]+)'],
                    'processor': lambda x: x.strip() if x else "N/A"
                },
                'Tipo de Vinculacion': { # Clave normalizada
                    'patterns': [
                        r'Tipo\s+de\s+Vinculaci[oó]n\s*[:\s]*([^\n]+)'],
                    'processor': lambda x: x.strip() if x else "N/A"
                },
                
            }
            data = {}
            for key, rule in extraction_rules.items():
                value = ""
                for pattern in rule['patterns']:
                    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
                    if match:
                        groups = match.groups()
                        if isinstance(groups, tuple) and len(groups) > 1:
                            value = rule['processor'](groups)
                        else:
                            value = rule['processor'](groups[0])
                        logging.debug(f"Campo '{key}' extraído con patrón '{pattern}': {value}")
                        break
                data[key] = value or "N/A"

            self._validate_critical_data(data, pdf_path)
            return data
        except Exception as e:
            logging.error(f"Error en extract_pdf_data: {e}")
            raise

    def _validate_critical_data(self, data, pdf_path):
        errors = [f"{field} no encontrado" for field, value in data.items() if value == "N/A" and field in ['No Identificacion', 'Nombre Completo', 'Fecha del Accidente']]
        if errors:
            raise ValueError(f"Errores en la extracción de datos en {pdf_path.name}: {', '.join(errors)}")

#-------------------------------------------------------------------------------------------------------------------
class DocumentGenerator:
    def generate_informe_accidente(self, data, template_path, output_dir):
        try:
            doc = DocxTemplate(template_path)
            context = data.copy()
            context = {k.replace(' ', '_').replace('.', ''): v for k, v in data.items()}

            for i in range(1, 6):
                por_que_key = f"Por Qué {i}"
                context[f"por_que_{i}"] = data.get(por_que_key, {}).get("causa", "N/A")
                for m in ["Mano de Obra", "Método", "Maquinaria", "Medio Ambiente", "Material"]:
                    context[f"por_que_{i}_{m.lower().replace(' ', '_')}"] = data.get(por_que_key, {}).get(m, "N/A")
            
            doc.render(context)
            nombre_sanitizado = re.sub(r'[^\w\s-]', '', data.get('Nombre_Completo', 'sin_nombre')).replace(' ', '_')
            output_path = Path(output_dir) / f"GI-FO-020_INVESTIGACION_{nombre_sanitizado}_{datetime.now().strftime('%Y%m%d')}.docx"
            doc.save(output_path)
            logging.info(f"Informe creado: {output_path}")
            return str(output_path)
        except Exception as e:
            logging.error(f"Error en generate_informe_accidente: {e}")
            raise

#-------------------------------------------------------------------------------------------------------------------
from tkinter.font import Font


class RemisionesApp(ttk.Window):
    def __init__(self):
        super().__init__(themename="minty", title="Gestor de Investigaciones de Accidentes")
        self.geometry("1210x800")
        self.configure(background='#f5f5f5') # Un gris ligeramente más claro

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
        self.bold_body_font = Font(family="Segoe UI Variable", size=10, weight="bold")

        # Estilo de fondo principal
        self.style.configure('TFrame', background='#f5f5f5')
        self.style.configure('TLabel', background='#f5f5f5')

        # Estilo para las tarjetas principales (simulando suavidad)
        self.style.configure('Card.TFrame', background='white', borderwidth=1, relief=SOLID, bordercolor='#eeeeee')
        
        # Estilo para los contenedores internos (invisibles)
        self.style.configure('Inner.TFrame', background='white')

        # Estilos de texto con fondo blanco para que se integren a las tarjetas
        self.style.configure('CardTitle.TLabel', font=self.header_font, background='white')
        self.style.configure('CardBody.TLabel', font=self.body_font, background='white')
        self.style.configure('5MHeader.TLabel', font=self.bold_body_font, foreground=self.style.colors.primary, background='white')
        self.style.configure('TProgressbar', background=self.style.colors.primary)

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
        messagebox.showerror("Error Crítico de Modelo", f"No se pudo inicializar el modelo de IA: {error}")
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
        config_card = ttk.Frame(left_column, style='Card.TFrame', padding=20)
        config_card.grid(row=0, column=0, sticky="new", pady=(0, 20))
        config_card.grid_columnconfigure(1, weight=1)
        ttk.Label(config_card, text="1. Configuración", style='CardTitle.TLabel').grid(row=0, column=0, columnspan=3, sticky="w", pady=(0, 15))
        
        ttk.Label(config_card, text="Archivo PDF:", style='CardBody.TLabel').grid(row=1, column=0, sticky="w", padx=(0,10))
        pdf_entry = ttk.Entry(config_card, textvariable=self.pdf_path)
        pdf_entry.grid(row=1, column=1, sticky="ew")
        ttk.Button(config_card, text="Buscar...", command=self._browse_pdf, bootstyle="primary-outline").grid(row=1, column=2, padx=(10,0))

        ttk.Label(config_card, text="Empresa:", style='CardBody.TLabel').grid(row=2, column=0, sticky="w", pady=(15, 0), padx=(0,10))
        empresa_combo = ttk.Combobox(config_card, textvariable=self.empresa, values=list(Config.RUTAS.keys()), state="readonly")
        empresa_combo.grid(row=2, column=1, columnspan=2, sticky="ew", pady=(15, 0))
        empresa_combo.bind('<<ComboboxSelected>>', self._update_paths)

        # Card de Datos del Accidente
        data_card = ttk.Frame(left_column, style='Card.TFrame', padding=20)
        data_card.grid(row=1, column=0, sticky="nsew")
        data_card.grid_rowconfigure(1, weight=1)
        data_card.grid_columnconfigure(0, weight=1)
        ttk.Label(data_card, text="2. Datos del Accidente", style='CardTitle.TLabel').grid(row=0, column=0, sticky="w", pady=(0, 10))
        self._create_extracted_data_widgets(data_card)

        # --- Columna Derecha (Análisis y Logs) ---
        right_column = ttk.Frame(main_frame)
        right_column.grid(row=0, column=1, sticky="nsew")
        right_column.grid_rowconfigure(1, weight=1)
        right_column.grid_columnconfigure(0, weight=1)

        # Card de Contexto Adicional
        context_card = ttk.Frame(right_column, style='Card.TFrame', padding=20)
        context_card.grid(row=0, column=0, sticky="new", pady=(0, 20))
        context_card.grid_columnconfigure(0, weight=1)
        ttk.Label(context_card, text="3. Contexto Adicional (Opcional)", style='CardTitle.TLabel').grid(row=0, column=0, sticky="w", pady=(0, 15))
        self.context_text = ttk.Text(context_card, height=4, wrap=WORD, font=self.body_font, relief=SOLID, borderwidth=1, highlightthickness=0, border='1px solid #ccc')
        self.context_text.grid(row=1, column=0, sticky="ew")
        self.context_text.insert(END, "Añade aquí cualquier detalle no presente en el FURAT...")

        # Card de Análisis de Causa Raíz
        five_whys_card = ttk.Frame(right_column, style='Card.TFrame', padding=20)
        five_whys_card.grid(row=1, column=0, sticky="nsew")
        five_whys_card.grid_rowconfigure(1, weight=1)
        five_whys_card.grid_columnconfigure(0, weight=1)
        ttk.Label(five_whys_card, text="4. Análisis de Causa Raíz", style='CardTitle.TLabel').grid(row=0, column=0, sticky="w", pady=(0, 10))
        self.five_whys_scroll = ScrolledFrame(five_whys_card, autohide=True, style='Inner.TFrame')
        self.five_whys_scroll.grid(row=1, column=0, sticky="nsew", pady=(5,0))
        self.five_whys_container = self.five_whys_scroll.container
        self.five_whys_container.configure(style='Inner.TFrame')
        self._display_five_whys({})

        # Card de Registro de Actividad
        results_card = ttk.Frame(right_column, style='Card.TFrame', padding=20)
        results_card.grid(row=2, column=0, sticky="new", pady=(20, 0))
        results_card.grid_columnconfigure(0, weight=1)
        ttk.Label(results_card, text="5. Registro de Actividad", style='CardTitle.TLabel').grid(row=0, column=0, sticky="w", pady=(0, 15))
        self.results_text = ttk.Text(results_card, height=6, wrap=WORD, font=self.body_font, relief=SOLID, borderwidth=1, highlightthickness=0, border='1px solid #ccc')
        self.results_text.grid(row=1, column=0, sticky="ew")

        # --- Barra de Estado y Botones ---
        status_frame = ttk.Frame(self, padding=(20,15))
        status_frame.pack(side=BOTTOM, fill=X)
        status_frame.grid_columnconfigure(1, weight=1)
        
        self.status_label = ttk.Label(status_frame, text="Inicializando...")
        self.status_label.grid(row=0, column=0, sticky="w")
        self.progress_bar = ttk.Progressbar(status_frame, mode='indeterminate')
        self.progress_bar.grid(row=0, column=1, sticky="ew", padx=20)
        
        action_frame = ttk.Frame(status_frame)
        action_frame.grid(row=0, column=2, sticky="e")
        self.process_button = ttk.Button(action_frame, text="PROCESAR Y GENERAR INFORME", command=self._process_pdf, bootstyle="success")
        self.process_button.pack(side=LEFT, padx=5)
        ttk.Button(action_frame, text="LIMPIAR", command=self._clear_data, bootstyle="secondary-outline").pack(side=LEFT)

    def _create_extracted_data_widgets(self, parent):
        container = ttk.Frame(parent, style='Inner.TFrame')
        container.grid(row=1, column=0, sticky="nsew", pady=(5,0))
        container.grid_columnconfigure(1, weight=1)

        fields = ['Nombre Completo', 'No Identificacion', 'Fecha del Accidente', 'Hora del Accidente', 'Empresa', 'Cargo', 'Tipo de Accidente', 'Lugar del Accidente', 'Sitio de Ocurrencia', 'Tipo de Lesion', 'Parte del Cuerpo Afectada', 'Agente del Accidente', 'Mecanismo o Forma del Accidente', 'Descripcion del Accidente']
        
        for i, field in enumerate(fields):
            key = field.replace(' ', '_')
            label = ttk.Label(container, text=f"{field}:", style='CardBody.TLabel')
            label.grid(row=i, column=0, sticky="ne", padx=(0,10), pady=4)
            
            if field == 'Descripcion del Accidente':
                text_widget = ttk.Text(container, height=5, wrap=WORD, state="disabled", width=35, font=self.body_font, relief=SOLID, borderwidth=1, highlightthickness=0, border='1px solid #ccc')
                text_widget.grid(row=i, column=1, sticky="ew", pady=4)
                self.extracted_data_vars[key] = text_widget
            else:
                self.extracted_data_vars[key] = StringVar(value="N/A")
                entry = ttk.Entry(container, textvariable=self.extracted_data_vars[key], state="readonly", width=35)
                entry.grid(row=i, column=1, sticky="ew", pady=4)

    def _update_paths(self, event=None):
        empresa = self.empresa.get()
        paths = Config.get_empresa_paths(empresa)
        self.output_path.set(str(paths["investigaciones"]))
        self.log_message(f"Rutas actualizadas para {empresa}")

    def _browse_pdf(self):
        file = filedialog.askopenfilename(title="Seleccionar PDF", filetypes=[("Archivos PDF", "*.pdf")])
        if file: self.pdf_path.set(file)

    def _process_pdf(self):
        if not self.pdf_path.get():
            messagebox.showerror("Error", "Por favor, seleccione un archivo PDF.")
            return
        if not self.analyzer:
            messagebox.showerror("Modelo no listo", "El modelo de IA aún se está cargando.")
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
            template_path = Config.get_empresa_paths(self.empresa.get())["plantilla"]
            contexto_adicional = self.context_text.get(1.0, END).strip()

            self.log_message(f"Extrayendo datos de {pdf_path.name}...")
            data = self.pdf_processor.extract_pdf_data(pdf_path)
            self.after(0, lambda: self._display_extracted_data(data))
            
            self.log_message("Analizando causas con el modelo de IA...")
            descripcion = data.get("Descripcion del Accidente", "")
            cinco_whys = self.analyzer.analyze_5whys(descripcion, contexto_adicional)
            data.update(cinco_whys)
            self.after(0, lambda: self._display_five_whys(data))
            
            self.log_message("Generando informe...")
            informe_path = self.doc_generator.generate_informe_accidente(data, template_path, output_dir)
            self.log_message(f"Informe generado: {informe_path}", success=True)
            if messagebox.askyesno("Proceso Completado", f"Informe generado en:\n{informe_path}\n\n¿Desea abrir el archivo ahora?"):
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
            key = field.replace(' ', '_')
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

        m_categories = ["Mano de Obra", "Método", "Maquinaria", "Medio Ambiente", "Material"]

        for i in range(1, 6):
            por_que_key = f"Por Qué {i}"
            row_data = data.get(por_que_key, {})
            
            card = ttk.Frame(container, style="Card.TFrame", padding=(15, 10))
            card.grid(row=i-1, column=0, sticky="ew", pady=(0, 15))
            card.grid_columnconfigure(0, weight=1)

            # --- Fila de Causa Principal ---
            header_frame = ttk.Frame(card, style="Inner.TFrame")
            header_frame.grid(row=0, column=0, sticky="ew", pady=(0, 10))
            header_frame.grid_columnconfigure(1, weight=1)

            ttk.Label(header_frame, text=f"{i}.", style='CardTitle.TLabel').grid(row=0, column=0, sticky="nw", padx=(0, 10))
            causa_text = row_data.get('causa', 'Análisis no disponible')
            if "?" not in causa_text and "no disponible" not in causa_text:
                causa_text = f"¿Por qué {causa_text.lower()}?"
            
            causa_label = ttk.Label(header_frame, text=causa_text, wraplength=900, style='Header.TLabel', background='white')
            causa_label.grid(row=0, column=1, sticky="w")
            
            ttk.Separator(card, orient=HORIZONTAL).grid(row=1, column=0, sticky="ew", pady=5)

            # --- Grid de 5M ---
            m_frame = ttk.Frame(card, style="Inner.TFrame")
            m_frame.grid(row=2, column=0, sticky="ew", padx=5)
            m_frame.grid_columnconfigure(list(range(5)), weight=1)

            for j, m_category in enumerate(m_categories):
                m_cell = ttk.Frame(m_frame, style="Inner.TFrame")
                m_cell.grid(row=0, column=j, sticky="nsew", padx=5, pady=5)
                
                ttk.Label(m_cell, text=m_category, style="5MHeader.TLabel").pack(anchor="w", pady=(0, 3))
                
                m_text = row_data.get(m_category, 'N/A')
                m_label = ttk.Label(m_cell, text=m_text, wraplength=180, style='CardBody.TLabel')
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
        self.context_text.insert(END, "Añade aquí cualquier detalle no presente en el FURAT...")
        self.results_text.delete(1.0, END)
        self.log_message("Datos limpiados.")

    def log_message(self, message, error=False, success=False):
        timestamp = datetime.now().strftime('%H:%M:%S')
        tag = "info"
        if error: tag = "error"
        elif success: tag = "success"
        
        self.results_text.tag_config("error", foreground=self.style.colors.danger)
        self.results_text.tag_config("success", foreground=self.style.colors.success)
        self.results_text.tag_config("info", foreground=self.style.colors.secondary)
        
        self.results_text.insert(END, f"{timestamp} ")
        self.results_text.insert(END, f"[{tag.upper()}] ", tag)
        self.results_text.insert(END, f"{message}\n")
        self.results_text.see(END)
        logging.info(message)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == '--get-template-path' and len(sys.argv) > 2:
        empresa = sys.argv[2]
        paths = Config.get_empresa_paths(empresa)
        print(json.dumps({"template_path": str(paths["plantilla"]) }))
        sys.exit(0)

    if not torch.cuda.is_available():
        messagebox.showwarning("Advertencia de GPU", "No se ha detectado una GPU compatible con CUDA. El análisis se ejecutará en la CPU, lo que puede ser significativamente más lento.")
    try:
        app = RemisionesApp()
        app.mainloop()
    except Exception as e:
        logging.critical(f"Error fatal al iniciar la aplicación: {e}\n{traceback.format_exc()}")
        messagebox.showerror("Error Fatal", f"No se pudo iniciar la aplicación. Revise el archivo 'accidentes_app.log' para más detalles.\n\nError: {e}")

"""--------------------------------------------------------------------"""
    #Esta es la Versión 0.1 del código de la aplicación SG-SST. 
"""--------------------------------------------------------------------"""


import customtkinter
from PIL import Image
import os
import tempfile
from CTkMessagebox import CTkMessagebox
import threading
import json
from pathlib import Path
from Mapeo import DocumentMapper
from remision_utils import PdfProcessor as RemisionPdfProcessor, DocumentGenerator as RemisionDocumentGenerator, ExcelHandler as RemisionExcelHandler, WhatsAppSender, EmailSender
import re
import logging
import traceback
import unicodedata
from datetime import datetime
from tkinter import messagebox, filedialog, StringVar
from tkcalendar import DateEntry
from docxtpl import DocxTemplate
import jinja2
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import torch
import warnings
import fitz
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import pandas as pd


# --- Constantes ---
# Define colores y fuentes para un tema consistente
PRIMARY_COLOR = "#FEFEFE"               # Azul para acciones primarias/estados activos
SECONDARY_COLOR = "#6c757d"             # Gris para elementos secundarios
ACCENT_COLOR = "#dc3545"                # Rojo para advertencias/acciones importantes (como el chat LLM)
TEXT_COLOR = "#343a40"                  # Texto oscuro
BUTTON_ACTIVE_COLOR = "#0056b3"         # Azul más oscuro cuando está activo
BUTTON_INACTIVE_COLOR = "#e9ecef"       # Gris claro para botones inactivos
BUTTON_TEXT_COLOR = "#ffffff"           # Texto blanco para botones primarios
BUTTON_INACTIVE_TEXT_COLOR = "#343a40"  # Texto oscuro para botones inactivos
HEADER_BG_COLOR = "#4B545D"             # f8f9fa" # Fondo claro para el encabezado
SIDEBAR_BG_COLOR = "#343a40"            # Fondo oscuro para la barra lateral
MAIN_CONTENT_BG_COLOR = "#ffffff"       # Fondo blanco para el contenido principal
CANVAS_BORDER_COLOR = "#dee2e6"         # Gris claro para los bordes

FONT_FAMILY = "Roboto Condensed"  # Fuente principal de la aplicación
FONT_SIZE_TITLE = 20
FONT_SIZE_SUBTITLE = 16
FONT_SIZE_BUTTON = 12
FONT_SIZE_LABEL = 12
FONT_SIZE_TEXT = 12

# Elementos del menú de la barra lateral (icon_path es un marcador de posición, serían archivos de imagen reales)
SIDEBAR_BUTTONS = [
    {"name": "Recursos", "icon": "kpi.png"},
    {"name": "Gestión Integral", "icon": "gestion.png"},                    
    {"name": "Gestión de la Salud", "icon": "medico.png"},                     
    {"name": "Gestión de Peligros y Riesgos", "icon": "identificar.png"},   
    {"name": "Gestión de Amenazas", "icon": "amenaza.png"},                 
    {"name": "Verificación", "icon": "seguro-de-salud.png"},
    {"name": "Mejoramiento", "icon": "ventas.png"},
    {"name": "Salir", "icon": "superacion-personal.png"},
]

# Botones de selección de empresa
COMPANY_BUTTONS = ["Tempoactiva", "Temposum", "Aseplus", "Asel"]

# Submódulos para cada sección principal
# Este diccionario estructura el contenido que aparece en InternalPage
RESOURCES_SUBMODULES = {
    "Recursos": [
        "1.1.1 Responsable del SG",
        "1.1.2 Roles y Responsabilidades",
        "1.1.3 Asignación de Recursos",
        "1.1.4 Afiliación al SSSI",
        "1.1.5 Trabajo de alto riesgo",
        "1.1.6 Conformación de Copasst",
        "1.1.7 Capacitación al Copasst",
        "1.1.8 Conformación de Comite de Convivencia",
        "1.2.1 Programa de capacitación Anual",
        "1.2.2 Inducción y Reinducción",
        "1.2.3 Curso Virtual 50 Horas",
        "1.2.4 Manual de SST para Proveedores y Contratistas",
    ],
    "Gestión Integral": [
        "2.1.1 Politica del SG-SST",
        "2.2.1 Objetivos SST",
        "2.3.1 Evaluación inicial del SG-SST",
        "2.4.1 Plan de Trabajo Anual",
        "2.5.1 Archivo y retención documental del SG-SST",
        "2.6.1 Rendición de cuentas",
        "2.7.1 Matriz de requisitos legales",
        "2.8.1 Mecanismos de comunicaciones",
        "2.9.1 Identificación y evaluación para la adquisición de bienes y servicios",
        "2.10.1 Evaluación y seleción de proveedores y contratistas",
        "2.11.1 Gestión del Cambio",
        "2.12.1 Equipos y Herramientas",
        "2.13.1 Elementos de Protección Personal",
    ],
    "Gestión de la Salud": [
        "3.1.1 Descripción Sociodemografica y diagnostico de condiciones de salud",
        "3.1.2 Actividades de medicina y preventiva y promoción de la salud",
        "3.1.3 Perfil de cargo y profesiograma",
        "3.1.4 Evaluaciones médicas",
        "3.1.5 Custodia medica ocupacional",
        "3.1.6 Restricciones y recomendaciones médicas",
        "3.1.6.1 Control de Remisiones",
        "3.1.7 Estilos de vida Saludables",
        "3.1.8 Servicios de Higiene",
        "3.1.9 Manejo de Residuos",
        "3.2.1 Reporte de los accidentes de trabajo",
        "3.2.2 Investigación de Accidentes, indicentes y Enfermedades",
        "3.2.3 Registro y analisis estadistico de indicentes, accidentes de trabajo y enfermedades",
        "3.3.1 Frecuencia de la accidentalidad",
        "3.3.2 Severidad de la accidentalidad",
        "3.3.3 Proporción de accidentes de trabajo mortales",
        "3.3.4 Medición de la prevalencia de enfermedades laborales",
        "3.3.5 Medición de la incidencia de enfermedades laborales",
        "3.3.6 Medición del ausentismo por causa médica",
    ],
    "Gestión de Peligros y Riesgos": [
        "4.1.1 Metodologia IPEVR",
        "4.1.2 Identificación de Peligros",
        "4.1.3 Identificación de Sustancias Químicas carcinogénas o con toxicidad",
        "4.1.4 Mediciones ambientales",
        "4.2.1 Mediciones de Prevención y Control frente a Peligros, Riesgos Identificados",
        "4.2.2 Aplicación de las medidas de prevención y control por parte de los trabajadores",
        "4.2.3 Evaluación de procedimientos, instructivos internos de seguridad y salud en el trabajo",
        "4.2.4 Realización de inspecciones sistematicas a las instalaciones, maquinas o equipos",
        "4.2.5 Mantenimiento periodico de equipos, instalaciones herramientas",
        "4.2.6 Entrega de EPP",   
    ],
    "Gestión de Amenazas": [
        "5.1.1 Plan de Prevención de Emergencias",
        "5.1.2 Examenes Medicos Brigadista",
    ],
    "Verificación": [
        "6.1.1 Definición de indicadores",
        "6.1.2 Auditoria Anual",
        "6.1.3 Revisión de la alta Dirección",
        "6.1.4 Planificación de la Auditoria",
    ],
    "Mejoramiento": [
        "7.1.1 Acciones Preventivas y Correctivas",
        "7.1.2 Acciones de Mejora conforme a revisiones de la alta gerencia",
        "7.1.3 Acciones de Mejora con base en investigaciones de AT y EL",
        "7.1.4 Elaboración de Planes de Mejoramiento de medidas y acciones correctivas por autoridades y ARL",
    ]
}

class DirectoryChangeHandler(FileSystemEventHandler):
    def __init__(self, callback):
        super().__init__()
        self.callback = callback

    def on_any_event(self, event):
        # Se ignora eventos en directorios de cache
        if '__pycache__' in event.src_path:
            return
        # Llama al callback principal de la app
        self.callback()

class DirectoryWatcher:
    def __init__(self, path_to_watch, change_callback):
        self.path_to_watch = path_to_watch
        self.change_callback = change_callback
        self.observer = Observer()
        self.handler = DirectoryChangeHandler(self.change_callback)
        self.thread = None

    def start(self):
        if not os.path.isdir(self.path_to_watch):
            # print(f"[Watcher] Error: La ruta no es un directorio válido: {self.path_to_watch}")
            return
        
        self.observer.schedule(self.handler, self.path_to_watch, recursive=True)
        self.thread = threading.Thread(target=self.observer.start, daemon=True)
        self.thread.start()
        # print(f"[Watcher] Vigilante iniciado en: {self.path_to_watch}")

    def stop(self):
        if self.observer.is_alive():
            self.observer.stop()
            self.observer.join() # Espera a que el hilo del observador termine
            # print(f"[Watcher] Vigilante detenido para: {self.path_to_watch}")


# --- Componentes de UI Compartidos ---

class Header(customtkinter.CTkFrame):
    """
    Encabezado de la aplicación que contiene el logo, título y botones de acción.
    """
    def __init__(self, master, settings_callback, llm_callback):
        super().__init__(master, fg_color=HEADER_BG_COLOR, corner_radius=0)
        self.grid(row=0, column=0, columnspan=2, sticky="new", padx=0, pady=0)
        self.grid_columnconfigure(1, weight=1) # Columna del título
        self.grid_columnconfigure(2, weight=0) # Columna de botones
        self.grid_rowconfigure(0, weight=1)
        self.configure(height=80) # Altura fija para el encabezado
        self.grid_propagate(False) # Evita que el frame se ajuste a su contenido

        # 1. Título y Logo
        title_frame = customtkinter.CTkFrame(self, fg_color="transparent")
        title_frame.grid(row=0, column=1, padx=20, pady=5, sticky="nsew")
        title_frame.grid_columnconfigure(0, weight=0)
        title_frame.grid_columnconfigure(1, weight=1)

        try:
            logo_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "productividad.png")
            logo_image = customtkinter.CTkImage(Image.open(logo_path), size=(40, 40))
            self.logo_label = customtkinter.CTkLabel(title_frame, image=logo_image, text="")
            self.logo_label.grid(row=0, column=0, padx=(0, 10))
        except FileNotFoundError:
            print("Productivity image not found: assets/productividad.png. Using placeholder.")
            self.logo_placeholder = customtkinter.CTkLabel(title_frame, text="IMG",
                                                        font=(FONT_FAMILY, 10, "bold"), text_color=TEXT_COLOR)
            self.logo_placeholder.grid(row=0, column=0, padx=(0, 10))

        self.title_label = customtkinter.CTkLabel(title_frame,
                                                 text="Sistema de Gestión de Seguridad y Salud en el Trabajo",
                                                 font=(FONT_FAMILY, FONT_SIZE_TITLE, "bold"),
                                                 text_color=PRIMARY_COLOR)
        self.title_label.grid(row=0, column=1, sticky="w")

        # 2. Botones del lado derecho
        self.buttons_frame = customtkinter.CTkFrame(self, fg_color="transparent")
        self.buttons_frame.grid(row=0, column=2, padx=(10, 20), pady=5, sticky="e")
        self.buttons_frame.grid_columnconfigure(0, weight=1)
        self.buttons_frame.grid_columnconfigure(1, weight=1)
        self.buttons_frame.grid_rowconfigure(0, weight=1)

        # --- Cargar iconos para los botones ---
        try:
            config_icon_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "agregar-usuario.png")
            config_icon = customtkinter.CTkImage(Image.open(config_icon_path), size=(20, 20))
        except FileNotFoundError:
            print("Icono 'agregar-usuario.png' no encontrado.")
            config_icon = None

        try:
            llm_icon_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "tecnologia.png")
            llm_icon = customtkinter.CTkImage(Image.open(llm_icon_path), size=(20, 20))
        except FileNotFoundError:
            print("Icono 'tecnologia.png' no encontrado.")
            llm_icon = None

        self.config_button = customtkinter.CTkButton(self.buttons_frame,
                                                    text="Configuraciones",
                                                    image=config_icon,
                                                    compound="left",
                                                    command=settings_callback,
                                                    fg_color="white",
                                                    text_color=HEADER_BG_COLOR,
                                                    hover_color=BUTTON_INACTIVE_COLOR,
                                                    font=(FONT_FAMILY, FONT_SIZE_BUTTON))
        self.config_button.grid(row=0, column=0, padx=5, pady=10)

        self.llm_button = customtkinter.CTkButton(self.buttons_frame,
                                                 text="Chat LLM",
                                                 image=llm_icon,
                                                 compound="left",
                                                 command=llm_callback,
                                                 fg_color="white",
                                                 text_color=HEADER_BG_COLOR,
                                                 hover_color=BUTTON_INACTIVE_COLOR,
                                                 font=(FONT_FAMILY, FONT_SIZE_BUTTON))
        self.llm_button.grid(row=0, column=1, padx=5, pady=10)


class Sidebar(customtkinter.CTkFrame):
    """
    Menú lateral izquierdo con botones de navegación.
    Gestiona la creación de botones, la carga de íconos, el estado activo y la información de la empresa.
    """
    def __init__(self, master, page_change_callback, width, initial_company=None):
        super().__init__(master, fg_color=SIDEBAR_BG_COLOR, corner_radius=0, width=width)
        self.sidebar_width = width
        self.grid(row=1, column=0, sticky="nswe", padx=0, pady=0)
        self.grid_rowconfigure(0, weight=0)
        self.grid_columnconfigure(0, weight=1)
        
        self.page_change_callback = page_change_callback
        self.sidebar_buttons = {}
        self.active_button_name = None
        self.current_company = initial_company
        self.company_button_widget = None

        self._create_buttons()
        
        if self.current_company:
            self.update_company_info(self.current_company)

    def update_company_info(self, company_name):
        self.current_company = company_name
        if self.company_button_widget:
            self.company_button_widget.grid_forget()
            self.company_button_widget.destroy()
            self.company_button_widget = None

        if not self.current_company:
            self._reconfigure_button_rows(start_row=0)
            return

        try:
            empresa_icon_name = f"{self.current_company}.png"
            empresa_icon_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", empresa_icon_name)
            empresa_image = customtkinter.CTkImage(Image.open(empresa_icon_path), size=(40, 40))
        except FileNotFoundError:
            empresa_image = None 

        self.company_button_widget = customtkinter.CTkButton(
            self,
            text=self.current_company,
            image=empresa_image,
            compound="top",
            state="disabled",
            fg_color="transparent",
            text_color=BUTTON_TEXT_COLOR,
            font=(FONT_FAMILY, FONT_SIZE_LABEL, "bold"),
            anchor="center",
            hover=False,
            corner_radius=6,
            height=70
        )
        self.company_button_widget.grid(row=0, column=0, padx=10, pady=(10, 5), sticky="ew")
        self._reconfigure_button_rows(start_row=1)

    def _reconfigure_button_rows(self, start_row):
        total_buttons = len(SIDEBAR_BUTTONS)
        for i in range(total_buttons + 2):
            self.grid_rowconfigure(i, weight=0)

        for i, item in enumerate(SIDEBAR_BUTTONS):
            row_index = start_row + i
            self.grid_rowconfigure(row_index, weight=0)

        self.grid_rowconfigure(start_row + total_buttons, weight=1)

        for i, item in enumerate(SIDEBAR_BUTTONS):
            button_name = item["name"]
            if button_name in self.sidebar_buttons:
                 self.sidebar_buttons[button_name].grid(row=start_row + i, column=0, padx=10, pady=5, sticky="ew")

    def _load_icon(self, icon_name, size=(32, 32)):
        try:
            icon_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", icon_name)
            return customtkinter.CTkImage(Image.open(icon_path), size=size)
        except FileNotFoundError:
            return None

    def _create_buttons(self):
        for i, item in enumerate(SIDEBAR_BUTTONS):
            button_name = item["name"]
            icon_image = self._load_icon(item.get("icon"))
            button = customtkinter.CTkButton(
                self, 
                text=button_name,
                image=icon_image,
                compound="top",
                command=lambda name=button_name: self._on_button_click(name),
                fg_color="transparent", 
                text_color=BUTTON_TEXT_COLOR,
                hover_color="#4B545D",
                font=(FONT_FAMILY, FONT_SIZE_BUTTON),
                anchor="center"
            )
            
            # --- Efecto Zoom (Simulado con Fuente) ---
            def on_enter(event, btn=button, name=button_name):
                # No aplicar efecto si el botón ya está activo
                if self.active_button_name != name:
                    btn.configure(font=(FONT_FAMILY, FONT_SIZE_BUTTON + 1, "bold"))

            def on_leave(event, btn=button):
                # Siempre volver a la fuente normal al salir
                btn.configure(font=(FONT_FAMILY, FONT_SIZE_BUTTON))

            button.bind("<Enter>", on_enter)
            button.bind("<Leave>", on_leave)

            button.grid(row=i, column=0, padx=10, pady=5, sticky="ew")
            self.sidebar_buttons[button_name] = button

    def _on_button_click(self, module_name):
        self.set_active_button(module_name)
        self.page_change_callback(module_name)

    def set_active_button(self, module_name):
        if self.active_button_name and self.active_button_name in self.sidebar_buttons:
            self.sidebar_buttons[self.active_button_name].configure(fg_color="transparent", text_color=BUTTON_TEXT_COLOR, hover_color="#4B545D")
        self.active_button_name = module_name
        if module_name and module_name in self.sidebar_buttons:
            self.sidebar_buttons[module_name].configure(fg_color=MAIN_CONTENT_BG_COLOR, text_color=HEADER_BG_COLOR, hover_color=MAIN_CONTENT_BG_COLOR)


# --- Clases de Página ---

class HomePage(customtkinter.CTkFrame):
    """
    Representa la pantalla principal (Home) con contenido centrado dinámicamente.
    """
    def __init__(self, master, select_company_callback, current_company):
        super().__init__(master, fg_color=MAIN_CONTENT_BG_COLOR, corner_radius=0)
        # La HomePage se coloca en su master con .grid(), por lo que no usamos .pack() aquí.

        self.select_company_callback = select_company_callback
        self.current_company = current_company
        self.company_buttons = {}

        # --- Estrategia de Centrado Dinámico (Horizontal y Vertical) ---
        # 1. Configurar una única celda (0,0) en la rejilla de HomePage para que se expanda.
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # 2. Crear el contenedor para la imagen y los botones.
        self.main_container = customtkinter.CTkFrame(self, fg_color="transparent")
        
        # 3. Colocar el contenedor en la celda expandible. Al no usar 'sticky',
        #    el gestor 'grid' lo centrará automáticamente por defecto.
        self.main_container.grid(row=0, column=0)

        # 4. Configurar la rejilla interna del 'main_container' para organizar su contenido.
        self.main_container.grid_columnconfigure(0, weight=1)

        self._create_widgets()

    def _create_widgets(self):
        """Crea y posiciona los widgets dentro del 'main_container'."""
        try:
            welcome_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "Persona.trabajando.png")
            welcome_image = customtkinter.CTkImage(Image.open(welcome_path), size=(600, 500))
            self.welcome_label = customtkinter.CTkLabel(self.main_container, image=welcome_image, text="")
            self.welcome_label.grid(row=0, column=0, pady=(0, 20))
        except FileNotFoundError:
            self.welcome_placeholder = customtkinter.CTkLabel(self.main_container, text="¡Bienvenido al SG-SST!\nSelecciona una empresa para comenzar.", font=(FONT_FAMILY, FONT_SIZE_TITLE, "bold"), text_color=TEXT_COLOR, wraplength=400)
            self.welcome_placeholder.grid(row=0, column=0, pady=(0, 20))

        self.company_buttons_frame = customtkinter.CTkFrame(self.main_container, fg_color="transparent")
        self.company_buttons_frame.grid(row=1, column=0, pady=10)

        for company_name in COMPANY_BUTTONS:
            is_selected = company_name == self.current_company
            fg_color = HEADER_BG_COLOR if is_selected else "#ffffff"
            text_color = BUTTON_TEXT_COLOR if is_selected else HEADER_BG_COLOR
            button = customtkinter.CTkButton(self.company_buttons_frame, text=company_name, command=lambda name=company_name: self._on_company_select(name), fg_color=fg_color, text_color=text_color, font=(FONT_FAMILY, FONT_SIZE_BUTTON), border_width=2, border_color=HEADER_BG_COLOR)
            button.pack(side="left", padx=10, pady=10)
            self.company_buttons[company_name] = button


    def _on_company_select(self, company_name):
        for name, button in self.company_buttons.items():
            is_selected = name == company_name
            button.configure(fg_color=HEADER_BG_COLOR if is_selected else "#ffffff", text_color=BUTTON_TEXT_COLOR if is_selected else HEADER_BG_COLOR)
        self.current_company = company_name
        self.select_company_callback(company_name)


class Tooltip:
    def __init__(self, widget, text):
        self.widget = widget
        self.text = text
        self.tooltip_window = None
        self.widget.bind("<Enter>", self.show_tooltip)
        self.widget.bind("<Leave>", self.hide_tooltip)

    def show_tooltip(self, event=None):
        if self.tooltip_window:
            return
        x, y, _, _ = self.widget.bbox("insert")
        x += self.widget.winfo_rootx() + 20
        y += self.widget.winfo_rooty() + 20

        self.tooltip_window = customtkinter.CTkToplevel(self.widget)
        self.tooltip_window.wm_overrideredirect(True)
        self.tooltip_window.wm_geometry(f"+{x}+{y}")

        label = customtkinter.CTkLabel(self.tooltip_window, text=self.text, fg_color="#4B545D", text_color="white", corner_radius=6, padx=10, pady=5, font=(FONT_FAMILY, 12))
        label.pack()

    def hide_tooltip(self, event=None):
        if self.tooltip_window:
            self.tooltip_window.destroy()
        self.tooltip_window = None

class AsignacionRecursosPage(customtkinter.CTkFrame):
    def __init__(self, master, app_instance):
        super().__init__(master, fg_color="transparent")
        self.app = app_instance

        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)
        
        main_container = customtkinter.CTkFrame(self, fg_color="transparent")
        main_container.grid(row=0, column=0, sticky="nsew", padx=50, pady=20)
        main_container.grid_columnconfigure(0, weight=1)

        title_label = customtkinter.CTkLabel(main_container, text="Asignación de Recursos", font=(FONT_FAMILY, FONT_SIZE_TITLE, "bold"), text_color=HEADER_BG_COLOR)
        title_label.pack(pady=(0, 30), anchor="center")

        cards_frame = customtkinter.CTkFrame(main_container, fg_color="transparent")
        cards_frame.pack(pady=10, padx=20, fill="x", expand=True)
        cards_frame.grid_columnconfigure((0, 1, 2), weight=1)

        card1 = self._create_card(cards_frame, "Mostrar Presupuesto", "Visualiza el presupuesto actual del SG-SST.", lambda: self.show_placeholder("Mostrar Presupuesto"))
        card1.grid(row=0, column=0, padx=15, pady=15, sticky="nsew")

        card2 = self._create_card(cards_frame, "Editar Presupuesto", "Modifica o actualiza las partidas del presupuesto.", lambda: self.show_placeholder("Editar Presupuesto"))
        card2.grid(row=0, column=1, padx=15, pady=15, sticky="nsew")

        card3 = self._create_card(cards_frame, "Próxima Función", "Una nueva funcionalidad estará disponible aquí pronto.", lambda: self.show_placeholder("Próxima Función"))
        card3.grid(row=0, column=2, padx=15, pady=15, sticky="nsew")

    def _create_card(self, master, title, tooltip_text, command):
        card = customtkinter.CTkFrame(master, fg_color="#F8F9FA", corner_radius=12, border_width=1, border_color="#DEE2E6")
        card.grid_rowconfigure(0, weight=1)
        card.grid_columnconfigure(0, weight=1)

        button = customtkinter.CTkButton(
            card, text=title, command=command, font=(FONT_FAMILY, FONT_SIZE_SUBTITLE, "bold"),
            fg_color="transparent", text_color=TEXT_COLOR, hover_color="#E9ECEF", height=180
        )
        button.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)
        Tooltip(button, text=tooltip_text)
        return card

    def show_placeholder(self, feature_name):
        show_custom_messagebox(self, "En Desarrollo", f"La funcionalidad '{feature_name}' se implementará en el futuro.", icon_type="ajustes")


class RestriccionesMedicasPage(customtkinter.CTkFrame):
    def __init__(self, master, app_instance):
        super().__init__(master, fg_color="transparent")
        self.app = app_instance
        self._show_main_menu()

    def _clear_frame(self):
        for widget in self.winfo_children():
            widget.destroy()

    def _show_main_menu(self):
        self._clear_frame()
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)
        
        main_container = customtkinter.CTkFrame(self, fg_color="transparent")
        main_container.grid(row=0, column=0, sticky="nsew", padx=50, pady=20)
        main_container.grid_columnconfigure(0, weight=1)

        title_label = customtkinter.CTkLabel(main_container, text="Restricciones y Recomendaciones Médicas", font=(FONT_FAMILY, FONT_SIZE_TITLE, "bold"), text_color=HEADER_BG_COLOR)
        title_label.pack(pady=(0, 30), anchor="center")

        cards_frame = customtkinter.CTkFrame(main_container, fg_color="transparent")
        cards_frame.pack(pady=10, padx=20, fill="both", expand=True)
        cards_frame.grid_columnconfigure((0, 1), weight=1)

        card1 = self._create_card(cards_frame, "Ver Remisiones Médicas", "Visualizar el historial de remisiones médicas.", lambda: self.show_placeholder("Ver Remisiones Médicas"))
        card1.grid(row=0, column=0, padx=15, pady=15, sticky="nsew")

        card2 = self._create_card(cards_frame, "Enviar Remisiones", "Crear y enviar nuevas remisiones y recomendaciones.", self._show_enviar_remision_page)
        card2.grid(row=0, column=1, padx=15, pady=15, sticky="nsew")

        card3 = self._create_card(cards_frame, "Control de Remisiones", "Realizar seguimiento al estado de las remisiones enviadas.", lambda: self.show_placeholder("Control de Remisiones"))
        card3.grid(row=1, column=0, padx=15, pady=15, sticky="nsew")

        card4 = self._create_card(cards_frame, "Próxima Función", "Una nueva funcionalidad estará disponible aquí pronto.", lambda: self.show_placeholder("Próxima Función"))
        card4.grid(row=1, column=1, padx=15, pady=15, sticky="nsew")

    def _show_enviar_remision_page(self):
        self._clear_frame()
        enviar_page = EnviarRemisionFrame(self, self.app, back_callback=self._show_main_menu)
        enviar_page.pack(fill="both", expand=True)

    def _create_card(self, master, title, tooltip_text, command):
        card = customtkinter.CTkFrame(master, fg_color="#F8F9FA", corner_radius=12, border_width=1, border_color="#DEE2E6")
        card.grid_rowconfigure(0, weight=1)
        card.grid_columnconfigure(0, weight=1)

        button = customtkinter.CTkButton(
            card, text=title, command=command, font=(FONT_FAMILY, FONT_SIZE_SUBTITLE, "bold"),
            fg_color="transparent", text_color=TEXT_COLOR, hover_color="#E9ECEF", height=180
        )
        button.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)
        Tooltip(button, text=tooltip_text)
        return card

    def show_placeholder(self, feature_name):
        show_custom_messagebox(self, "En Desarrollo", f"La funcionalidad '{feature_name}' se implementará en el futuro.", icon_type="ajustes")


class EnviarRemisionFrame(customtkinter.CTkFrame):
    def __init__(self, master, app_instance, back_callback):
        super().__init__(master, fg_color=MAIN_CONTENT_BG_COLOR)
        self.app = app_instance
        self.back_callback = back_callback

        # StringVars
        self.pdf_path = customtkinter.StringVar()
        self.empresa = customtkinter.StringVar(value="TEMPOACTIVA")

        # Logic Processors
        self.pdf_processor = RemisionPdfProcessor()
        self.doc_generator = RemisionDocumentGenerator()
        self.excel_handler = RemisionExcelHandler()
        self.extracted_data = {}
        
        # Senders
        self.whatsapp_sender = WhatsAppSender()
        self.email_sender = None

        self._create_widgets()

    def _create_widgets(self):
        header_frame = customtkinter.CTkFrame(self, fg_color="transparent")
        header_frame.pack(fill="x", padx=10, pady=(5, 10))
        back_button = customtkinter.CTkButton(header_frame, text="< Volver", command=self.back_callback, width=100)
        back_button.pack(side="left")

        main_container = customtkinter.CTkFrame(self, fg_color="transparent")
        main_container.pack(fill="both", expand=True, padx=10, pady=0)
        main_container.grid_columnconfigure(0, weight=1)
        main_container.grid_rowconfigure(2, weight=1)  # Cambiado de 1 a 2 para acomodar la nueva sección

        settings_frame = customtkinter.CTkFrame(main_container)
        settings_frame.grid(row=0, column=0, sticky="ew", padx=5, pady=5)
        settings_frame.grid_columnconfigure(1, weight=1)

        pdf_label = customtkinter.CTkLabel(settings_frame, text="Certificado Médico (PDF):")
        pdf_label.grid(row=0, column=0, padx=10, pady=10, sticky="w")
        pdf_entry = customtkinter.CTkEntry(settings_frame, textvariable=self.pdf_path, state="disabled")
        pdf_entry.grid(row=0, column=1, padx=5, pady=10, sticky="ew")
        pdf_button = customtkinter.CTkButton(settings_frame, text="Buscar...", command=self._browse_pdf)
        pdf_button.grid(row=0, column=2, padx=10, pady=10)

        empresa_label = customtkinter.CTkLabel(settings_frame, text="Empresa:")
        empresa_label.grid(row=1, column=0, padx=10, pady=10, sticky="w")
        empresa_combo = customtkinter.CTkComboBox(settings_frame, variable=self.empresa, values=["TEMPOACTIVA", "TEMPOSUM", "ASEPLUS", "ASEL"], state="readonly")
        empresa_combo.grid(row=1, column=1, padx=5, pady=10, sticky="w")

        # Frame para datos extraídos y log
        results_container = customtkinter.CTkFrame(main_container, fg_color="transparent")
        results_container.grid(row=1, column=0, sticky="nsew", padx=5, pady=5)
        results_container.grid_rowconfigure(0, weight=1)
        results_container.grid_columnconfigure(0, weight=1)
        results_container.grid_columnconfigure(1, weight=1)

        self.data_display_frame = customtkinter.CTkScrollableFrame(results_container, label_text="Datos Extraídos", height=300)
        self.data_display_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 5))
        
        self.log_textbox = customtkinter.CTkTextbox(results_container, wrap="word", state="disabled", height=300)
        self.log_textbox.grid(row=0, column=1, sticky="nsew", padx=(5, 0))

        # Nueva sección para mostrar el archivo generado y botones de notificación
        self.output_frame = customtkinter.CTkFrame(main_container, fg_color="transparent")
        self.output_frame.grid(row=2, column=0, sticky="ew", padx=5, pady=(5, 0))
        self.output_frame.grid_columnconfigure(1, weight=1)
        self.output_frame.grid_remove()  # Ocultar inicialmente

        output_label = customtkinter.CTkLabel(self.output_frame, text="Documento Generado:", font=(FONT_FAMILY, FONT_SIZE_LABEL, "bold"))
        output_label.grid(row=0, column=0, padx=10, pady=10, sticky="w")

        self.output_path_var = customtkinter.StringVar()
        self.output_entry = customtkinter.CTkEntry(self.output_frame, textvariable=self.output_path_var, state="disabled")
        self.output_entry.grid(row=0, column=1, padx=5, pady=10, sticky="ew")

        self.open_button = customtkinter.CTkButton(self.output_frame, text="Abrir", command=self._open_document, state="disabled")
        self.open_button.grid(row=0, column=2, padx=5, pady=10)

        # Botones para enviar notificaciones (inicialmente deshabilitados)
        self.notification_frame = customtkinter.CTkFrame(main_container, fg_color="transparent")
        self.notification_frame.grid(row=3, column=0, sticky="ew", padx=5, pady=5)
        self.notification_frame.grid_columnconfigure((0, 1), weight=1)
        self.notification_frame.grid_remove()  # Ocultar inicialmente

        self.email_button = customtkinter.CTkButton(self.notification_frame, text="Enviar por Email", command=self._send_email, state="disabled")
        self.email_button.grid(row=0, column=0, padx=5, pady=10, sticky="ew")

        self.whatsapp_button = customtkinter.CTkButton(self.notification_frame, text="Enviar por WhatsApp", command=self._send_whatsapp, state="disabled")
        self.whatsapp_button.grid(row=0, column=1, padx=5, pady=10, sticky="ew")

        action_bar = customtkinter.CTkFrame(main_container)
        action_bar.grid(row=4, column=0, sticky="ew", padx=5, pady=10)
        
        self.status_label = customtkinter.CTkLabel(action_bar, text="Listo.")
        self.status_label.pack(side="left", padx=10)

        self.process_button = customtkinter.CTkButton(action_bar, text="Procesar y Generar Remisión", command=self._process_pdf)
        self.process_button.pack(side="right", padx=10)

    def _browse_pdf(self):
        file_path = filedialog.askopenfilename(title="Seleccionar Certificado Médico PDF", filetypes=[("Archivos PDF", "*.pdf")])
        if file_path:
            self.pdf_path.set(file_path)
            self.log_message(f"Archivo seleccionado: {os.path.basename(file_path)}")

    def _process_pdf(self):
        if not self.pdf_path.get():
            show_custom_messagebox(self, "Error", "Por favor, seleccione un archivo PDF para procesar.", icon_type="alerta")
            return
        
        self.process_button.configure(state="disabled")
        self.status_label.configure(text="Procesando...")
        processing_thread = threading.Thread(target=self._process_pdf_thread, daemon=True)
        processing_thread.start()

    def _process_pdf_thread(self):
        try:
            pdf_path = self.pdf_path.get()
            empresa = self.empresa.get()
            self.log_message(f"Iniciando procesamiento para la empresa: {empresa}")

            # 1. Get paths from the main app's config
            remisiones_base_path, msg = self.app._find_path_for_submodule("Gestión de la Salud", "3.1.6 Restricciones y recomendaciones médicas")
            if not remisiones_base_path:
                raise ValueError(f"No se encontró la ruta para el módulo de remisiones. Verifique la configuración.")

            # Construct specific paths based on the submodule folder
            # This assumes a fixed structure inside the submodule folder
            remisiones_eps_path = os.path.join(remisiones_base_path, "3.1.6.1. Remisiones EPS")
            plantilla_path = os.path.join(remisiones_eps_path, "GI-OD-007 REMISION A EPS.docx")
            control_path = os.path.join(remisiones_eps_path, "GI-FO-012 CONTROL DE REMISIONES.xlsx")
            output_dir = remisiones_eps_path

            self.log_message(f"Ruta de plantilla: {plantilla_path}")
            self.log_message(f"Ruta de control: {control_path}")

            # 2. Execute processing logic
            self.log_message("Extrayendo datos del PDF...")
            self.extracted_data = self.pdf_processor.extract_pdf_data(pdf_path)
            
            # Agregar mensaje de depuración detallado
            self.log_message(f"Datos extraídos completos: {self.extracted_data}")
            self.log_message(f"Número de campos extraídos: {len(self.extracted_data)}")
            
            # Mostrar los datos en la interfaz
            self.after(0, self._display_data, self.extracted_data)

            self.log_message("Generando documento de remisión...")
            doc_path = self.doc_generator.generate_remision(self.extracted_data, plantilla_path, output_dir)
            self.log_message(f"Documento generado: {os.path.basename(doc_path)}")

            # Actualizar la interfaz con el archivo generado
            self.after(0, self._update_output_section, doc_path)

            self.log_message("Actualizando archivo de control...")
            self.excel_handler.update_control_file(self.extracted_data, control_path)
            self.log_message("Archivo de control actualizado.")

            self.log_message("¡Proceso completado exitosamente!", error=False)
            show_custom_messagebox(self, "Éxito", f"Proceso completado. El documento se guardó en: {doc_path}")

        except Exception as e:
            self.log_message(f"ERROR: {str(e)}", error=True)
            traceback.print_exc()
            show_custom_messagebox(self, "Error", f"Ha ocurrido un error: {str(e)}", icon_type="alerta")
        finally:
            self.process_button.configure(state="normal")
            self.status_label.configure(text="Listo.")

    def _display_data(self, data):
        # Limpiar el frame de datos
        for widget in self.data_display_frame.winfo_children():
            widget.destroy()

        # Verificar si hay datos para mostrar
        if not data or not isinstance(data, dict):
            no_data_label = customtkinter.CTkLabel(
                self.data_display_frame, 
                text="No se encontraron datos para mostrar.", 
                font=(FONT_FAMILY, FONT_SIZE_TEXT),
                text_color=TEXT_COLOR
            )
            no_data_label.pack(padx=20, pady=20)
            return

        # Mostrar los datos extraídos de forma simple y directa
        # Crear un frame para contener todos los campos
        container_frame = customtkinter.CTkFrame(self.data_display_frame, fg_color="transparent")
        container_frame.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Mostrar cada campo con su valor
        row = 0
        for key, value in data.items():
            # Saltar campos técnicos
            if key in ['archivo_origen', 'fecha_procesamiento']:
                continue
                
            # Crear un frame para cada campo
            field_frame = customtkinter.CTkFrame(container_frame, fg_color="transparent")
            field_frame.grid(row=row, column=0, sticky="ew", padx=5, pady=2)
            field_frame.grid_columnconfigure(1, weight=1)
            
            # Etiqueta del campo
            key_label = customtkinter.CTkLabel(
                field_frame,
                text=f"{key}:",
                font=(FONT_FAMILY, FONT_SIZE_TEXT, "bold"),
                text_color=HEADER_BG_COLOR,
                anchor="w"
            )
            key_label.grid(row=0, column=0, sticky="w", padx=(0, 10))
            
            # Valor del campo
            val_text = str(value if value is not None else "N/A")
            val_label = customtkinter.CTkLabel(
                field_frame,
                text=val_text,
                font=(FONT_FAMILY, FONT_SIZE_TEXT),
                text_color=TEXT_COLOR,
                anchor="w",
                wraplength=400,  # Ajustar el ancho para que el texto se envuelva
                justify="left"
            )
            val_label.grid(row=0, column=1, sticky="w")
            
            row += 1
            
        container_frame.grid_columnconfigure(0, weight=1)
        
        # Si no se mostró ningún campo, mostrar mensaje
        if row == 0:
            no_data_label = customtkinter.CTkLabel(
                container_frame,
                text="No hay datos relevantes para mostrar.",
                font=(FONT_FAMILY, FONT_SIZE_TEXT),
                text_color=TEXT_COLOR
            )
            no_data_label.pack(padx=20, pady=20)

    def _update_output_section(self, doc_path):
        """Actualizar la sección de salida con el archivo generado y habilitar botones."""
        self.output_path_var.set(doc_path)
        self.open_button.configure(state="normal")
        self.email_button.configure(state="normal")
        self.whatsapp_button.configure(state="normal")
        
        # Mostrar las secciones ocultas
        self.output_frame.grid()
        self.notification_frame.grid()

    def _open_document(self):
        """Abrir el documento generado."""
        doc_path = self.output_path_var.get()
        if doc_path and os.path.exists(doc_path):
            os.startfile(doc_path)
        else:
            show_custom_messagebox(self, "Error", "No se pudo abrir el documento. Verifique que el archivo exista.", icon_type="alerta")

    def _send_email(self):
        """Enviar el documento por email."""
        doc_path = self.output_path_var.get()
        if not doc_path or not os.path.exists(doc_path):
            show_custom_messagebox(self, "Error", "No se encontró el documento para enviar.", icon_type="alerta")
            return
            
        try:
            # Crear el sender de email para la empresa seleccionada
            empresa = self.empresa.get()
            self.email_sender = EmailSender(empresa)
            
            # Obtener datos necesarios
            cedula = self.extracted_data.get('No. Identificación', '')
            nombre = self.extracted_data.get('Nombre Completo', '')
            fecha_atencion = self.extracted_data.get('Fecha de Atención', datetime.now().strftime('%d/%m/%Y'))
            
            if not cedula:
                show_custom_messagebox(self, "Error", "No se encontró el número de identificación del trabajador.", icon_type="alerta")
                return
                
            # Obtener contacto desde la base de datos
            telefono, email = self.email_sender.obtener_contacto(cedula)
            
            if not email:
                show_custom_messagebox(self, "Error", 
                                      f"No se encontró el correo electrónico para la cédula {cedula}. "
                                      "Verifique que el trabajador esté registrado en la base de datos.", 
                                      icon_type="alerta")
                return
                
            # Enviar el correo
            success = self.email_sender.enviar_correo(email, nombre, fecha_atencion, doc_path)
            
            if success:
                show_custom_messagebox(self, "Éxito", 
                                      f"Correo enviado exitosamente a {email}", 
                                      icon_type="ajustes")
            else:
                show_custom_messagebox(self, "Error", 
                                      "No se pudo enviar el correo. Por favor, inténtelo de nuevo.", 
                                      icon_type="alerta")
                
        except Exception as e:
            show_custom_messagebox(self, "Error", 
                                  f"Error al enviar el correo: {str(e)}", 
                                  icon_type="alerta")

    def _send_whatsapp(self):
        """Enviar el documento por WhatsApp."""
        doc_path = self.output_path_var.get()
        if not doc_path or not os.path.exists(doc_path):
            show_custom_messagebox(self, "Error", "No se encontró el documento para enviar.", icon_type="alerta")
            return
            
        try:
            # Obtener datos necesarios
            cedula = self.extracted_data.get('No. Identificación', '')
            nombre = self.extracted_data.get('Nombre Completo', '')
            fecha_atencion = self.extracted_data.get('Fecha de Atención', datetime.now().strftime('%d/%m/%Y'))
            
            if not cedula:
                show_custom_messagebox(self, "Error", "No se encontró el número de identificación del trabajador.", icon_type="alerta")
                return
                
            # Crear el sender de email para obtener el contacto (necesitamos la base de datos)
            empresa = self.empresa.get()
            temp_email_sender = EmailSender(empresa)
            telefono, email = temp_email_sender.obtener_contacto(cedula)
            
            if not telefono:
                show_custom_messagebox(self, "Error", 
                                      f"No se encontró el número de teléfono para la cédula {cedula}. "
                                      "Verifique que el trabajador esté registrado en la base de datos.", 
                                      icon_type="alerta")
                return
                
            # Formatear el número de teléfono (quitar espacios, guiones, etc.)
            telefono_limpio = re.sub(r'[^\d]', '', telefono)
            
            # Si el número no tiene código de país, agregarlo (Colombia: 57)
            if not telefono_limpio.startswith('57'):
                telefono_limpio = '57' + telefono_limpio
                
            # Crear mensaje personalizado
            mensaje = f"""Hola {nombre},
            
Conforme al resultado del examen médico ocupacional realizado el día {fecha_atencion}, te compartimos la carta de remisiones médicas, en la cual se detallan recomendaciones específicas relacionadas con tu estado de salud y tu actividad laboral.

📎 Adjunto encontrarás el documento oficial con las recomendaciones.

Te solicitamos por favor:
✅ Leer atentamente las recomendaciones.
✅ Confirmar la recepción de este mensaje y del documento.
✅ Informarnos si ya estás realizando los controles médicos indicados (si aplica).

Tu salud es una prioridad para nosotros.

Atentamente,
Equipo {empresa}"""
                
            # Enviar el mensaje por WhatsApp
            self.whatsapp_sender.send_message(telefono_limpio, mensaje, doc_path)
            
            show_custom_messagebox(self, "Éxito", 
                                  f"Mensaje de WhatsApp preparado para enviar a {telefono_limpio}. "
                                  "Se abrirá WhatsApp Web y se copiará el mensaje al portapapeles.", 
                                  icon_type="ajustes")
                
        except Exception as e:
            show_custom_messagebox(self, "Error", 
                                  f"Error al preparar el mensaje de WhatsApp: {str(e)}", 
                                  icon_type="alerta")

    def log_message(self, message, error=False):
        self.log_textbox.configure(state="normal")
        timestamp = datetime.now().strftime('%H:%M:%S')
        prefix = "[ERROR]" if error else "[INFO]"
        self.log_textbox.insert("end", f"{timestamp} {prefix} {message}\n")
        self.log_textbox.see("end")
        self.log_textbox.configure(state="disabled")




class ControlRemisionesPage(customtkinter.CTkFrame):
    def __init__(self, master, app_instance):
        super().__init__(master, fg_color=MAIN_CONTENT_BG_COLOR, corner_radius=0)
        self.app = app_instance
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)
        
        # Crear widgets
        self._create_widgets()
        # Cargar datos iniciales
        self._load_control_data()

    def _create_widgets(self):
        # Frame principal
        main_frame = customtkinter.CTkFrame(self, fg_color="transparent")
        main_frame.grid(row=0, column=0, sticky="nsew", padx=20, pady=20)
        main_frame.grid_rowconfigure(1, weight=1)
        main_frame.grid_columnconfigure(0, weight=1)
        
        # Título
        title_label = customtkinter.CTkLabel(
            main_frame, 
            text="Control de Remisiones", 
            font=(FONT_FAMILY, FONT_SIZE_TITLE, "bold"),
            text_color=HEADER_BG_COLOR
        )
        title_label.grid(row=0, column=0, pady=(0, 20), sticky="w")
        
        # Frame para controles
        controls_frame = customtkinter.CTkFrame(main_frame, fg_color="transparent")
        controls_frame.grid(row=1, column=0, sticky="ew", pady=(0, 10))
        controls_frame.grid_columnconfigure(1, weight=1)
        
        # Botón para refrescar datos
        self.refresh_button = customtkinter.CTkButton(
            controls_frame,
            text="Refrescar",
            command=self._load_control_data,
            font=(FONT_FAMILY, FONT_SIZE_BUTTON),
            fg_color=HEADER_BG_COLOR,
            hover_color=BUTTON_ACTIVE_COLOR
        )
        self.refresh_button.grid(row=0, column=0, padx=(0, 10))
        
        # Etiqueta de estado
        self.status_label = customtkinter.CTkLabel(
            controls_frame,
            text="Cargando datos...",
            font=(FONT_FAMILY, FONT_SIZE_TEXT),
            text_color=TEXT_COLOR
        )
        self.status_label.grid(row=0, column=1, sticky="w")
        
        # Frame para la tabla
        self.table_frame = customtkinter.CTkFrame(main_frame, fg_color="white", border_width=2, border_color=CANVAS_BORDER_COLOR, corner_radius=10)
        self.table_frame.grid(row=2, column=0, sticky="nsew", pady=(0, 20))
        self.table_frame.grid_rowconfigure(0, weight=1)
        self.table_frame.grid_columnconfigure(0, weight=1)
        
        # Canvas y Scrollbar para la tabla
        self.canvas = customtkinter.CTkCanvas(self.table_frame, bg="white", highlightthickness=0)
        self.scrollbar = customtkinter.CTkScrollbar(self.table_frame, orientation="vertical", command=self.canvas.yview)
        self.scrollable_frame = customtkinter.CTkFrame(self.canvas, fg_color="white")
        
        self.scrollable_frame.bind(
            "<Configure>",
            lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        )
        
        self.canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=self.scrollbar.set)
        
        self.canvas.grid(row=0, column=0, sticky="nsew")
        self.scrollbar.grid(row=0, column=1, sticky="ns")
        
        # Bind mousewheel to canvas
        self.canvas.bind("<MouseWheel>", self._on_mousewheel)
        
    def _on_mousewheel(self, event):
        self.canvas.yview_scroll(int(-1*(event.delta/120)), "units")

    def _load_control_data(self):
        try:
            self.status_label.configure(text="Cargando datos...")
            self.refresh_button.configure(state="disabled")
            
            # Obtener la ruta del archivo de control
            base_path, msg = self.app._find_path_for_submodule("Gestión de la Salud", "3.1.6 Restricciones y recomendaciones médicas")
            if not base_path:
                self.status_label.configure(text=f"Error: {msg}")
                self.refresh_button.configure(state="normal")
                return
                
            control_path = os.path.join(base_path, "3.1.6.1. Remisiones EPS", "GI-FO-012 CONTROL DE REMISIONES.xlsx")
            
            if not os.path.exists(control_path):
                self.status_label.configure(text="Archivo de control no encontrado")
                self.refresh_button.configure(state="normal")
                return
            
            # Cargar datos del archivo Excel
            df = pd.read_excel(control_path, engine='openpyxl', header=6, dtype=str)
            
            # Limpiar datos
            df = df.dropna(how='all')
            if df.empty:
                self.status_label.configure(text="No hay datos en el archivo de control")
                self.refresh_button.configure(state="normal")
                return
            
            # Mostrar datos en la tabla
            self._display_table(df)
            self.status_label.configure(text=f"Datos cargados: {len(df)} registros")
            
        except Exception as e:
            self.status_label.configure(text=f"Error al cargar datos: {str(e)}")
            print(f"Error al cargar datos de control: {e}")
        finally:
            self.refresh_button.configure(state="normal")

    def _display_table(self, df):
        # Limpiar frame existente
        for widget in self.scrollable_frame.winfo_children():
            widget.destroy()
            
        if df.empty:
            no_data_label = customtkinter.CTkLabel(
                self.scrollable_frame,
                text="No hay datos para mostrar",
                font=(FONT_FAMILY, FONT_SIZE_TEXT),
                text_color=TEXT_COLOR
            )
            no_data_label.pack(padx=20, pady=20)
            return
            
        # Crear encabezados
        headers = df.columns.tolist()
        header_frame = customtkinter.CTkFrame(self.scrollable_frame, fg_color=HEADER_BG_COLOR)
        header_frame.pack(fill="x", padx=5, pady=2)
        header_frame.grid_columnconfigure(tuple(range(len(headers))), weight=1)
        
        for i, header in enumerate(headers):
            header_label = customtkinter.CTkLabel(
                header_frame,
                text=header,
                font=(FONT_FAMILY, FONT_SIZE_LABEL, "bold"),
                text_color=BUTTON_TEXT_COLOR
            )
            header_label.grid(row=0, column=i, padx=5, pady=5, sticky="w")
        
        # Crear filas de datos
        for index, row in df.iterrows():
            row_frame = customtkinter.CTkFrame(self.scrollable_frame, fg_color="transparent" if index % 2 == 0 else "#f0f0f0")
            row_frame.pack(fill="x", padx=5, pady=1)
            row_frame.grid_columnconfigure(tuple(range(len(headers))), weight=1)
            
            for i, (header, value) in enumerate(row.items()):
                cell_value = str(value) if pd.notna(value) else "N/A"
                # Limitar el tamaño del texto para celdas muy largas
                if len(cell_value) > 50:
                    cell_value = cell_value[:47] + "..."
                    
                cell_label = customtkinter.CTkLabel(
                    row_frame,
                    text=cell_value,
                    font=(FONT_FAMILY, FONT_SIZE_TEXT),
                    text_color=TEXT_COLOR,
                    anchor="w"
                )
                cell_label.grid(row=0, column=i, padx=5, pady=2, sticky="w")


class ModuleWelcomePage(customtkinter.CTkFrame):
    """
    Pantalla de bienvenida para cada módulo principal.
    """
    def __init__(self, master, module_name, on_continue_callback):
        super().__init__(master, fg_color=MAIN_CONTENT_BG_COLOR, corner_radius=0)
        self.module_name = module_name
        self.on_continue_callback = on_continue_callback
        
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)
        
        # Contenedor principal centrado
        container = customtkinter.CTkFrame(self, fg_color="transparent")
        container.grid(row=0, column=0, sticky="nsew")
        container.grid_rowconfigure(1, weight=1)
        container.grid_columnconfigure(0, weight=1)
        
        # Título
        title_label = customtkinter.CTkLabel(
            container, 
            text=f"Bienvenido al módulo:\n{module_name}",
            font=(FONT_FAMILY, FONT_SIZE_TITLE, "bold"),
            text_color=HEADER_BG_COLOR,
            justify="center"
        )
        title_label.grid(row=0, column=0, pady=(20, 30), sticky="n")
        
        # Mensaje de bienvenida
        welcome_text = f"Has seleccionado el módulo '{module_name}'.\n\nEste módulo contiene herramientas y recursos para gestionar eficazmente los aspectos relacionados con {module_name.lower()} en tu organización.\n\nExplora las diferentes secciones utilizando el menú desplegable para acceder a funcionalidades específicas."
        welcome_label = customtkinter.CTkLabel(
            container,
            text=welcome_text,
            font=(FONT_FAMILY, FONT_SIZE_TEXT),
            text_color=TEXT_COLOR,
            wraplength=600,
            justify="center"
        )
        welcome_label.grid(row=1, column=0, pady=(0, 30), sticky="n")
        
        # Botón para continuar
        continue_button = customtkinter.CTkButton(
            container,
            text="Continuar al módulo",
            command=self.on_continue_callback,
            font=(FONT_FAMILY, FONT_SIZE_BUTTON, "bold"),
            fg_color=HEADER_BG_COLOR,
            hover_color=BUTTON_ACTIVE_COLOR,
            corner_radius=10,
            width=200,
            height=40
        )
        continue_button.grid(row=2, column=0, pady=(0, 20), sticky="s")

class InternalPage(customtkinter.CTkFrame):
    def __init__(self, master, module_name, app_instance):
        super().__init__(master, fg_color=MAIN_CONTENT_BG_COLOR, corner_radius=0)
        self.module_name = module_name
        self.app = app_instance
        self.current_company = app_instance.current_company
        self.active_submodule_name = None
        self.showing_welcome = True  # Nuevo atributo para controlar qué vista se muestra

        self.grid_rowconfigure(1, weight=1) # Fila para el contenido principal
        self.grid_columnconfigure(0, weight=1)

        self._create_widgets()
        # Mostrar la pantalla de bienvenida inicialmente
        self._show_welcome_screen()

    def _create_widgets(self):
        # --- Contenedor para el selector de submódulo ---
        self.selector_frame = customtkinter.CTkFrame(self, fg_color="transparent")
        self.selector_frame.grid(row=0, column=0, padx=20, pady=(10, 5), sticky="ew")
        self.selector_frame.grid_columnconfigure(0, weight=1)

        submodules = RESOURCES_SUBMODULES.get(self.module_name, [])
        
        self.submodule_menu = customtkinter.CTkOptionMenu(
            self.selector_frame,
            values=submodules,
            command=self._on_submodule_click,
            fg_color="white",
            text_color=TEXT_COLOR,
            button_color=HEADER_BG_COLOR,
            button_hover_color=BUTTON_ACTIVE_COLOR,
            dropdown_fg_color="white",
            dropdown_hover_color=BUTTON_INACTIVE_COLOR,
            dropdown_text_color=TEXT_COLOR,
            font=(FONT_FAMILY, FONT_SIZE_BUTTON, "bold"),
            anchor="center"
        )
        self.submodule_menu.grid(row=0, column=0, sticky="w")

        # --- Lienzo de contenido principal ---
        self.content_canvas = customtkinter.CTkFrame(self, fg_color="white", border_width=2, border_color=CANVAS_BORDER_COLOR, corner_radius=10)
        self.content_canvas.grid(row=1, column=0, padx=20, pady=(0, 20), sticky="nsew")
        self.content_canvas.grid_rowconfigure(0, weight=1)
        self.content_canvas.grid_columnconfigure(0, weight=1)
        # El contenido inicial se maneja en _show_welcome_screen()

    def _show_welcome_screen(self):
        """Muestra la pantalla de bienvenida del módulo."""
        self.showing_welcome = True
        # Limpiar el contenido actual
        for widget in self.content_canvas.winfo_children():
            widget.destroy()
        
        # Crear y mostrar la pantalla de bienvenida
        welcome_page = ModuleWelcomePage(self.content_canvas, self.module_name, self._continue_to_module)
        welcome_page.grid(row=0, column=0, sticky="nsew")
        
        # Ocultar el selector de submódulo
        self.selector_frame.grid_remove()

    def _continue_to_module(self):
        """Callback para cuando el usuario quiere continuar al contenido del módulo."""
        self.showing_welcome = False
        # Limpiar el contenido actual
        for widget in self.content_canvas.winfo_children():
            widget.destroy()
        
        # Mostrar el selector de submódulo
        self.selector_frame.grid()
        
        # Cargar los submódulos y mostrar el contenido del primero
        self._load_submodules()

    def _load_submodules(self):
        submodules = RESOURCES_SUBMODULES.get(self.module_name, [])
        if submodules:
            # Establecer el valor por defecto y cargar el primer ítem
            default_selection = submodules[0]
            self.submodule_menu.set(default_selection)
            self._on_submodule_click(default_selection)

    def _on_submodule_click(self, submodule_name):
        # Si estamos en la pantalla de bienvenida, no hacer nada
        if self.showing_welcome:
            return
            
        self.active_submodule_name = submodule_name
        self._show_submodule_content(submodule_name)

    def _show_submodule_content(self, submodule_name):
        # Si estamos en la pantalla de bienvenida, no hacer nada
        if self.showing_welcome:
            return
            
        for widget in self.content_canvas.winfo_children():
            widget.destroy()

        self.content_canvas.grid_rowconfigure(0, weight=1)
        self.content_canvas.grid_columnconfigure(0, weight=1)

        if submodule_name == "1.1.1 Responsable del SG":
            responsable_page = ResponsableSgPage(self.content_canvas, self.app)
            responsable_page.grid(row=0, column=0, sticky="nsew")
        elif submodule_name == "1.1.2 Roles y Responsabilidades":            
            roles_page = RolesResponsabilidadesPage(self.content_canvas, self.app)
            roles_page.grid(row=0, column=0, sticky="nsew")
        elif submodule_name == "1.1.3 Asignación de Recursos":
            recursos_page = AsignacionRecursosPage(self.content_canvas, self.app)
            recursos_page.grid(row=0, column=0, sticky="nsew")
        elif submodule_name == "3.1.6 Restricciones y recomendaciones médicas":
            restricciones_page = RestriccionesMedicasPage(self.content_canvas, self.app)
            restricciones_page.grid(row=0, column=0, sticky="nsew")
        elif submodule_name == "3.1.6.1 Control de Remisiones":
            control_page = ControlRemisionesPage(self.content_canvas, self.app)
            control_page.grid(row=0, column=0, sticky="nsew")
        elif submodule_name == "3.2.2 Investigación de Accidentes, indicentes y Enfermedades":
            investigacion_page = InvestigacionAccidentesPage(self.content_canvas, self.app)
            investigacion_page.grid(row=0, column=0, sticky="nsew")
        elif submodule_name == "3.2.1 Reporte de los accidentes de trabajo":
            ver_furat_page = VerFuratPage(self.content_canvas, self.app, lambda: self._show_submodule_content(None))
            ver_furat_page.grid(row=0, column=0, sticky="nsew")
        else:
            path, message = self.app._find_path_for_submodule(self.module_name, submodule_name)

            if path:
                content_text = (f"Conexión exitosa para: '{submodule_name}'
\n\n" 
                                f"{message}
\n\n" 
                                f"Desde aquí, puedes cargar y mostrar el contenido del archivo o listar los archivos de la carpeta.")
            else:
                content_text = (f"Error de conexión para: '{submodule_name}'
\n\n" 
                                f"{message}
\n\n" 
                                f"Verifica que el mapeo de archivos de la empresa esté completo y que los nombres coincidan.")

            content_label = customtkinter.CTkLabel(self.content_canvas, text=content_text, font=(FONT_FAMILY, FONT_SIZE_TEXT), text_color=TEXT_COLOR, justify="left")
            content_label.grid(row=0, column=0, padx=30, pady=30, sticky="nsew")



class ResponsableSgPage(customtkinter.CTkFrame):
    def __init__(self, master, app_instance):
        super().__init__(master, fg_color=MAIN_CONTENT_BG_COLOR, corner_radius=0)
        self.app = app_instance
        self.doc_path = None
        self.temp_pdf_path = None
        self.current_doc_type = None

        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        self._create_widgets()
        self._load_document("designacion_sst")  # Load the first document by default
        self.bind("<Destroy>", self._on_destroy)

    def _load_designacion_document(self, selection):
        if selection == "Designación Sg-SST":
            self._load_document("designacion_sst")
        elif selection == "Designación SG-PESV":
            self._load_document("designacion_pesv")

    def _create_widgets(self):
        # --- Top Frame for document selection and action buttons ---
        top_frame = customtkinter.CTkFrame(self, fg_color="transparent")
        top_frame.grid(row=0, column=0, padx=20, pady=10, sticky="ew")

        # Document selection buttons
        self.designacion_menu = customtkinter.CTkOptionMenu(top_frame, 
                                                            values=["Designación Sg-SST", "Designación SG-PESV"], 
                                                            command=self._load_designacion_document)
        self.designacion_menu.pack(side="left", padx=(0, 10))

        self.licencia_button = customtkinter.CTkButton(top_frame, text="Ver Licencia", command=lambda: self._load_document("licencia"))
        self.licencia_button.pack(side="left", padx=(0, 10))

        # Spacer
        spacer = customtkinter.CTkFrame(top_frame, fg_color="transparent", width=40)
        spacer.pack(side="left", expand=True, fill="x")

        # Action button
        self.edit_button = customtkinter.CTkButton(top_frame, text="Editar en Word", command=self._open_in_word, state="disabled")
        self.edit_button.pack(side="right", padx=(0, 10))

        # --- PDF Viewer Canvas ---
        self.pdf_canvas = customtkinter.CTkScrollableFrame(self, fg_color="transparent")
        self.pdf_canvas.grid(row=1, column=0, padx=20, pady=(0, 20), sticky="nsew")
        self.pdf_label = customtkinter.CTkLabel(self.pdf_canvas, text="")
        self.pdf_label.pack(expand=True)

    def _load_document(self, doc_type):
        self.current_doc_type = doc_type
        self._cleanup_temp_file() # Clean up previous temp file
        
        base_path, message = self.app._find_path_for_submodule("Recursos", "1.1.1 Responsable del SG")

        if not base_path or not os.path.isdir(base_path):
            self.pdf_label.configure(text="No se encontró la carpeta del responsable del SG.")
            self.edit_button.configure(state="disabled")
            return

        self.doc_path = None
        if doc_type == "designacion_sst" or doc_type == "designacion_pesv":
            designacion_folder_path = None
            if base_path and os.path.isdir(base_path):
                for item in os.listdir(base_path):
                    if item.lower().startswith("2. des") and "responsable" in item.lower() and os.path.isdir(os.path.join(base_path, item)):
                        designacion_folder_path = os.path.join(base_path, item)
                        break
            
            if designacion_folder_path:
                if doc_type == "designacion_sst":
                    for file in os.listdir(designacion_folder_path):
                        # Look for the base designation file, making sure it's not the PESV one.
                        # Based on debug log, searching for "carta de desigancion".
                        if "carta de desigancion" in file.lower() and "pesv" not in file.lower() and file.lower().endswith((".docx", ".doc")):
                            self.doc_path = os.path.join(designacion_folder_path, file)
                            break
                elif doc_type == "designacion_pesv":
                    for file in os.listdir(designacion_folder_path):
                        # Look for the PESV designation file.
                        if "carta de desigancion pesv" in file.lower() and file.lower().endswith((".docx", ".doc")):
                            self.doc_path = os.path.join(designacion_folder_path, file)
                            break

        elif doc_type == "licencia":
            licencia_folder_path = None
            if base_path and os.path.isdir(base_path):
                for item in os.listdir(base_path):
                    if item.startswith("1. Licencia Responsable del SG") and os.path.isdir(os.path.join(base_path, item)):
                        licencia_folder_path = os.path.join(base_path, item)
                        break

            if licencia_folder_path:
                for file in os.listdir(licencia_folder_path):
                    if file.lower().endswith(".pdf"):
                        self.doc_path = os.path.join(licencia_folder_path, file)
                        break
        
        if not self.doc_path:
            self.pdf_label.configure(text=f"No se encontró el documento de '{doc_type}'.")
            self.edit_button.configure(state="disabled")
            return

        if self.doc_path.lower().endswith((".docx", ".doc")):
            self.edit_button.configure(state="normal")
            self._convert_and_display_docx()
        elif self.doc_path.lower().endswith(".pdf"):
            self.edit_button.configure(state="disabled")
            self._display_pdf(self.doc_path)

    def _convert_and_display_docx(self):
        # Primero, verificar la extensión del archivo.
        if self.doc_path.lower().endswith(".doc"):
            error_message = (
                f"Formato de archivo no compatible.\n\n"
                f"El archivo:\n{os.path.basename(self.doc_path)}\n"
                f"es un archivo .doc antiguo.\n\n"
                f"Por favor, ábralo en Microsoft Word y guárdelo como un archivo .docx para poder visualizarlo aquí."
            )
            self.pdf_label.configure(text=error_message)
            self.edit_button.configure(state="normal") # Permitir que lo abran en Word para arreglarlo
            return

        try:
            from docx2pdf import convert
            temp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp")
            os.makedirs(temp_dir, exist_ok=True)
            
            base_name = os.path.basename(self.doc_path)
            sanitized_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', os.path.splitext(base_name)[0])
            self.temp_pdf_path = os.path.join(temp_dir, f"{sanitized_name}.pdf")
            
            convert(self.doc_path, self.temp_pdf_path)
            self._display_pdf(self.temp_pdf_path)
        except Exception as e:
            # Mantener un error detallado para fallos inesperados con .docx
            error_message = (
                f"Error al convertir el documento .docx a PDF.\n\n"
                f"Archivo: {self.doc_path}\n\n"
                f"Detalles del error:\n{traceback.format_exc()}"
            )
            self.pdf_label.configure(text=error_message)
            print(error_message)

    def _display_pdf(self, pdf_path):
        try:
            self.pdf_images = []
            doc = fitz.open(pdf_path)
            for page in doc:
                pix = page.get_pixmap(dpi=150)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                ctk_img = customtkinter.CTkImage(light_image=img, size=(pix.width, pix.height))
                self.pdf_images.append(ctk_img)
            
            if self.pdf_images:
                self.pdf_label.configure(image=self.pdf_images[0])
            else:
                self.pdf_label.configure(text="No se pudo renderizar el PDF.")
        except Exception as e:
            self.pdf_label.configure(text=f"Error al cargar el PDF: {e}")

    def _open_in_word(self):
        if self.doc_path:
            os.startfile(self.doc_path)

    def _cleanup_temp_file(self):
        if self.temp_pdf_path and os.path.exists(self.temp_pdf_path):
            os.remove(self.temp_pdf_path)
            self.temp_pdf_path = None

    def _on_destroy(self, event=None):
        self._cleanup_temp_file()



class RolesResponsabilidadesPage(customtkinter.CTkFrame):
    def __init__(self, master, app_instance):
        super().__init__(master, fg_color=MAIN_CONTENT_BG_COLOR, corner_radius=0)
        self.app = app_instance
        self.docx_path = None
        self.temp_pdf_path = None # Para almacenar la ruta del PDF temporal
        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)
        self._create_widgets()
        self._load_document() # Cargar el documento por defecto
        self.bind("<Destroy>", self._on_destroy) # Limpiar archivos temporales al cerrar

    def _create_widgets(self):
         # Frame para mostrar el PDF (reutiliza tu PdfViewerFrame o uno similar)
         # Asumiremos un frame simple por ahora
         self.viewer_frame = customtkinter.CTkFrame(self, fg_color="lightgray")
         self.viewer_frame.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)
         self.viewer_label = customtkinter.CTkLabel(self.viewer_frame, text="Cargando documento...")
         self.viewer_label.pack(expand=True)

    def _load_document(self):
        """Carga y muestra el documento .docx."""
        # 1. Encontrar la ruta base usando el mapeo existente
        # Ajusta el nombre del submódulo según tu estructura exacta
        base_path, message = self.app._find_path_for_submodule("Recursos", "1.1.2 Roles y Responsabilidades")

        if not base_path or not os.path.isdir(base_path):
            self.viewer_label.configure(text=f"Error: Carpeta no encontrada. {message}")
            return

        # 2. Buscar el archivo .docx (puedes hacerlo más específico si hay un nombre fijo)
        docx_file_path = None
        for item in os.listdir(base_path):
            if item.lower().endswith('.docx'):
                docx_file_path = os.path.join(base_path, item)
                break

        if not docx_file_path:
            self.viewer_label.configure(text="Error: No se encontró ningún archivo .docx en la carpeta.")
            return

        self.docx_path = docx_file_path

        # 3. Convertir el .docx a PDF temporal
        try:
            # Crear un archivo temporal .pdf
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
                self.temp_pdf_path = temp_pdf.name
            # Realizar la conversión
            # convert(source, destination)
            convert(self.docx_path, self.temp_pdf_path)

            # 4. Mostrar el PDF (aquí iría la lógica de tu PdfViewer)
            # Ejemplo básico de cómo podrías integrarlo:
            # Destruye el contenido anterior del viewer_frame
            for widget in self.viewer_frame.winfo_children():
                widget.destroy()

            # Importa PdfViewerFrame si está en otro archivo
            # from PdfViewer import PdfViewerFrame # Asegúrate de la ruta correcta
            # pdf_viewer = PdfViewerFrame(self.viewer_frame, self.temp_pdf_path)
            # pdf_viewer.pack(fill="both", expand=True)

            # Placeholder: Mostrar mensaje de éxito o integrar PdfViewerFrame
            self.viewer_label = customtkinter.CTkLabel(self.viewer_frame, text=f"Documento convertido y listo para mostrar: {os.path.basename(self.temp_pdf_path)}")
            self.viewer_label.pack(expand=True)
            print(f"Documento convertido a: {self.temp_pdf_path}")

            # *** Aquí es donde integrarías tu PdfViewerFrame ***
            # Ejemplo de integración (asumiendo PdfViewerFrame existe):
            # try:
            #     from PdfViewer import PdfViewerFrame # Asegúrate de la importación correcta
            #     self.pdf_viewer = PdfViewerFrame(self.viewer_frame, self.temp_pdf_path)
            #     self.pdf_viewer.pack(fill="both", expand=True)
            # except Exception as e:
            #     self.viewer_label.configure(text=f"Error al cargar el visor de PDF: {e}")
            #     print(f"Error al cargar PdfViewerFrame: {e}")

        except Exception as e:
            self.viewer_label.configure(text=f"Error al convertir el documento: {e}")
            print(f"Error en _load_document (conversión): {e}")

    def _on_destroy(self, event=None):
        """Limpia el archivo PDF temporal al cerrar la página."""
        if self.temp_pdf_path and os.path.exists(self.temp_pdf_path):
            try:
                os.remove(self.temp_pdf_path)
                print(f"Archivo temporal eliminado: {self.temp_pdf_path}")
            except Exception as e:
                print(f"Error al eliminar archivo temporal {self.temp_pdf_path}: {e}")
        # Llamar al método destroy del padre si es necesario
        # super()._on_destroy(event) # Si ResponsableSgPage tiene este método

class SettingsPage(customtkinter.CTkFrame):
    """
    Acts as a manager for the different settings sub-pages.
    It shows the main settings menu and handles navigation between sub-pages.
    """
    def __init__(self, master, map_generator_callback, app_instance):
        super().__init__(master, fg_color=MAIN_CONTENT_BG_COLOR, corner_radius=0)
        self.map_generator_callback = map_generator_callback
        self.app = app_instance
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)
        self.show_settings_home()

    def _clear_frame(self):
        for widget in self.winfo_children():
            widget.destroy()

    def show_settings_home(self):
        self._clear_frame()
        home = SettingsHomePage(self, self.show_path_linking_page, self.show_chat_settings_page, self.show_user_settings_page, self.app.show_home_page)
        home.grid(row=0, column=0, sticky="nsew")

    def show_path_linking_page(self):
        self._clear_frame()
        path_page = PathLinkingPage(self, self.map_generator_callback, self.app, self.show_settings_home)
        path_page.grid(row=0, column=0, sticky="nsew")

    def show_chat_settings_page(self):
        self._clear_frame()
        chat_page = ChatSettingsPage(self, self.show_settings_home)
        chat_page.grid(row=0, column=0, sticky="nsew")

    def show_user_settings_page(self):
        self._clear_frame()
        user_page = UserSettingsPage(self, self.show_settings_home)
        user_page.grid(row=0, column=0, sticky="nsew")


class SettingsHomePage(customtkinter.CTkFrame):
    """
    The main menu for all settings. Displays options as large, clickable cards.
    """
    def __init__(self, master, show_path_linking_callback, show_chat_settings_callback, show_user_settings_callback, back_to_home_callback):
        super().__init__(master, fg_color="transparent")
        self.grid_columnconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=0)
        self.grid_rowconfigure(1, weight=1)

        # --- Frame para el título y el botón de volver ---
        top_frame = customtkinter.CTkFrame(self, fg_color="transparent")
        top_frame.grid(row=0, column=0, columnspan=2, pady=(20, 25), sticky="ew", padx=20)
        top_frame.grid_columnconfigure(1, weight=1)

        back_button = customtkinter.CTkButton(top_frame, text="< Volver al Inicio", command=back_to_home_callback, width=150)
        back_button.grid(row=0, column=0, sticky="w")

        title_label = customtkinter.CTkLabel(top_frame, text="Panel de Configuraciones", font=(FONT_FAMILY, FONT_SIZE_TITLE, "bold"), text_color=HEADER_BG_COLOR)
        title_label.grid(row=0, column=1, sticky="n")

        # --- Settings Cards ---
        path_card = self._create_card("Vincular Empresas", "Conecta las carpetas de cada empresa para el análisis.", show_path_linking_callback)
        path_card.grid(row=1, column=0, padx=(20, 10), pady=10, sticky="nsew")

        chat_card = self._create_card("Ajustes de Chat", "Configura el comportamiento y la apariencia del asistente LLM.", show_chat_settings_callback)
        chat_card.grid(row=1, column=1, padx=(10, 20), pady=10, sticky="nsew")

        user_card = self._create_card("Ajustes de Usuario", "Gestiona la información y preferencias del usuario.", show_user_settings_callback)
        user_card.grid(row=2, column=0, padx=(20, 10), pady=10, sticky="nsew")
        
        # You can add more cards here for future settings
        # future_card = self._create_card("Future Setting", "Description for a future setting.", some_callback)
        # future_card.grid(row=2, column=0, padx=(20, 10), pady=10, sticky="nsew")

    def _create_card(self, title, description, command):
        card = customtkinter.CTkFrame(self, corner_radius=10, fg_color="#F0F0F0", border_width=1, border_color="#D0D0D0")
        card.grid_rowconfigure(1, weight=1)
        card.grid_columnconfigure(0, weight=1)

        card_title = customtkinter.CTkLabel(card, text=title, font=(FONT_FAMILY, FONT_SIZE_SUBTITLE, "bold"), text_color=TEXT_COLOR)
        card_title.grid(row=0, column=0, padx=20, pady=(20, 10))

        card_desc = customtkinter.CTkLabel(card, text=description, wraplength=220, font=(FONT_FAMILY, FONT_SIZE_TEXT), text_color=SECONDARY_COLOR)
        card_desc.grid(row=1, column=0, padx=20, pady=5, sticky="n")

        card_button = customtkinter.CTkButton(card, text="Abrir", command=command, fg_color=HEADER_BG_COLOR, hover_color=BUTTON_ACTIVE_COLOR)
        card_button.grid(row=2, column=0, padx=20, pady=(15, 20))
        
        return card


class PathLinkingPage(customtkinter.CTkFrame):
    """
    The sub-page for linking company paths. This is the refactored original SettingsPage.
    """
    def __init__(self, master, map_generator_callback, app_instance, back_callback):
        super().__init__(master, fg_color=MAIN_CONTENT_BG_COLOR, corner_radius=0)
        self.map_generator_callback = map_generator_callback
        self.app = app_instance
        self.back_callback = back_callback
        self.company_widgets = {}
        self.checkmark_icon = None

        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        self._load_icons()
        self._create_widgets()
        self._load_existing_paths()

    def _load_icons(self):
        try:
            icon_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "verificacion.png")
            img = Image.open(icon_path)
            self.checkmark_icon = customtkinter.CTkImage(img, size=(24, 24))
        except FileNotFoundError:
            print("Icono 'verificacion.png' no encontrado.")

    def _create_widgets(self):
        top_frame = customtkinter.CTkFrame(self, fg_color="transparent")
        top_frame.grid(row=0, column=0, padx=10, pady=(10, 5), sticky="ew")
        
        back_button = customtkinter.CTkButton(top_frame, text="< Volver", command=self.back_callback, width=100)
        back_button.pack(side="left")

        title_label = customtkinter.CTkLabel(top_frame, text="Vincular Rutas de Archivos por Empresa", font=(FONT_FAMILY, FONT_SIZE_SUBTITLE, "bold"), text_color=HEADER_BG_COLOR)
        title_label.pack(side="left", expand=True)

        main_container = customtkinter.CTkFrame(self, fg_color="white", border_width=2, border_color=CANVAS_BORDER_COLOR, corner_radius=10)
        main_container.grid(row=1, column=0, padx=10, pady=(0, 10), sticky="nsew")
        main_container.grid_columnconfigure(0, weight=1)

        for i, company_name in enumerate(COMPANY_BUTTONS):
            self._create_company_row(main_container, company_name, i)

        self.log_display = customtkinter.CTkTextbox(main_container, height=150, state="disabled", wrap="word", font=(FONT_FAMILY, 10))
        self.log_display.grid(row=len(COMPANY_BUTTONS), column=0, padx=20, pady=(15, 10), sticky="ew")

        self.progress_bar = customtkinter.CTkProgressBar(main_container, orientation="horizontal", mode="determinate")
        self.progress_bar.set(0)
        self.progress_bar.grid(row=len(COMPANY_BUTTONS) + 1, column=0, padx=20, pady=(5, 10), sticky="ew")
        self.progress_bar.grid_remove()

        spacer_row_index = len(COMPANY_BUTTONS) + 2
        main_container.grid_rowconfigure(spacer_row_index, weight=1)

        button_row_index = spacer_row_index + 1
        self.save_button = customtkinter.CTkButton(main_container, text="Asegurar Configuración", command=self._assure_configuration)
        self.save_button.grid(row=button_row_index, column=0, padx=20, pady=20, sticky="e")

    def _update_log(self, message):
        self.log_display.configure(state="normal")
        self.log_display.insert("end", message + "\n")
        self.log_display.see("end")
        self.log_display.configure(state="disabled")

    def _create_company_row(self, master, company_name, row_index):
        company_frame = customtkinter.CTkFrame(master, fg_color="transparent")
        company_frame.grid(row=row_index, column=0, padx=20, pady=15, sticky="ew")
        company_frame.grid_columnconfigure(1, weight=1)
        
        label = customtkinter.CTkLabel(company_frame, text=company_name, font=(FONT_FAMILY, FONT_SIZE_LABEL, "bold"))
        label.grid(row=0, column=0, padx=(0, 15), sticky="w")
        
        path_entry = customtkinter.CTkEntry(company_frame, placeholder_text="No se ha seleccionado ninguna ruta...", state="disabled")
        path_entry.grid(row=0, column=1, sticky="ew")
        
        select_button = customtkinter.CTkButton(company_frame, text="Seleccionar Ruta...", width=140, command=lambda cn=company_name: self._select_path_for_company(cn))
        select_button.grid(row=0, column=2, padx=(10, 5), sticky="e")
        
        load_button = customtkinter.CTkButton(company_frame, text="Cargar Vínculo", width=130, state="disabled", command=lambda cn=company_name: self._load_link_for_company(cn))
        load_button.grid(row=0, column=3, padx=(0, 10), sticky="e")
        
        checkmark_label = customtkinter.CTkLabel(company_frame, text="", width=24)
        checkmark_label.grid(row=0, column=4, sticky="e")
        
        self.company_widgets[company_name] = {"entry": path_entry, "load_button": load_button, "checkmark_label": checkmark_label, "select_button": select_button}

    def _load_existing_paths(self):
        # Carga solo las rutas de configuraciones que ya han sido mapeadas y guardadas.
        for company_name, mapping_data in self.app.company_path_maps.items():
            if company_name in self.company_widgets and isinstance(mapping_data, dict) and 'root' in mapping_data:
                widgets = self.company_widgets[company_name]
                path = mapping_data['root']
                
                widgets["entry"].configure(state="normal")
                widgets["entry"].insert(0, path)
                widgets["entry"].configure(state="disabled")
                
                # El vínculo ya fue cargado y guardado, así que deshabilitamos el botón de cargar.
                widgets["load_button"].configure(state="disabled")
                
                # Mostramos la marca de verificación.
                if self.checkmark_icon:
                    widgets["checkmark_label"].configure(image=self.checkmark_icon)
                else:
                    widgets["checkmark_label"].configure(text="✔", font=(FONT_FAMILY, 24, "bold"), text_color="green")

    def _select_path_for_company(self, company_name):
        from customtkinter import filedialog
        path = filedialog.askdirectory(title=f"Seleccione la carpeta para {company_name}")
        if path:
            widgets = self.company_widgets[company_name]
            widgets["entry"].configure(state="normal")
            widgets["entry"].delete(0, "end")
            widgets["entry"].insert(0, path)
            widgets["entry"].configure(state="disabled")
            widgets["load_button"].configure(state="normal")
            widgets["checkmark_label"].configure(image=None, text="")

    def _load_link_for_company(self, company_name):
        widgets = self.company_widgets[company_name]
        path = widgets["entry"].get()
        if not path:
            show_custom_messagebox(self, "Ruta no válida", "Por favor, seleccione una ruta antes de cargar.", icon_type="alerta")
            return
        
        self.log_display.configure(state="normal")
        self.log_display.delete("1.0", "end")
        self.log_display.configure(state="disabled")

        self._toggle_all_buttons(False)
        self.progress_bar.grid()
        self.progress_bar.set(0)
        self.map_generator_callback(company_name, path, self._on_mapping_complete, self._update_log)
        self._update_progress(0)

    def _update_progress(self, value):
        if value < 1:
            new_value = value + 0.05
            self.progress_bar.set(new_value)
            self.after(50, lambda: self._update_progress(new_value))

    def _on_mapping_complete(self, company_name, success, error_message):
        self.progress_bar.grid_remove()
        self._toggle_all_buttons(True)
        if success:
            widgets = self.company_widgets[company_name]
            if self.checkmark_icon:
                widgets["checkmark_label"].configure(image=self.checkmark_icon)
            else:
                widgets["checkmark_label"].configure(text="✔", font=(FONT_FAMILY, 24, "bold"), text_color="green")
            widgets["load_button"].configure(state="disabled")
            show_custom_messagebox(self, "Vínculo Creado", f"El mapa de archivos para {company_name} ha sido generado.", icon_type="ajustes")
        else:
            show_custom_messagebox(self, "Error de Mapeo", f" No se pudo generar el mapa para {company_name}.")
            show_custom_messagebox(self, "Error de Mapeo", f"Error: {error_message}", icon_type="alerta")


    def _toggle_all_buttons(self, enabled):
        state = "normal" if enabled else "disabled"
        for company, widgets in self.company_widgets.items():
            widgets["select_button"].configure(state=state)
            is_linked = widgets["checkmark_label"].cget("image") is not None or widgets["checkmark_label"].cget("text") != ""
            if widgets["entry"].get() and enabled and not is_linked:
                widgets["load_button"].configure(state="normal")
            else:
                widgets["load_button"].configure(state="disabled")

    def _assure_configuration(self):
        # Verifica que todas las empresas tengan un mapeo válido en el estado de la aplicación.
        all_mapped = all(
            company_name in self.app.company_path_maps and
            isinstance(self.app.company_path_maps.get(company_name), dict)
            for company_name in COMPANY_BUTTONS
        )

        if not all_mapped:
            show_custom_messagebox(self, "Configuración Incompleta", "Por favor, asegúrese de que todas las empresas tengan una ruta de archivo vinculada y cargada.", icon_type="alerta")
            return

        self.app.save_configuration()  # Guarda el estado actual de los mapeos
        show_custom_messagebox(self, "Configuración Guardada", "Las rutas de las empresas han sido guardadas de forma segura.", icon_type="ajustes")
        
        for company_name in self.company_widgets:
            self.company_widgets[company_name]["select_button"].configure(state="disabled")
            self.company_widgets[company_name]["load_button"].configure(state="disabled")
        self.save_button.configure(state="disabled")

        # 1. Regresar al menú de configuraciones después de guardar.
        self.back_callback()



class ChatSettingsPage(customtkinter.CTkFrame):
    """
    A placeholder sub-page for future chat settings.
    """
    def __init__(self, master, back_callback):
        super().__init__(master, fg_color=MAIN_CONTENT_BG_COLOR, corner_radius=0)
        self.back_callback = back_callback
        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        top_frame = customtkinter.CTkFrame(self, fg_color="transparent")
        top_frame.grid(row=0, column=0, padx=10, pady=(10, 5), sticky="ew")
        
        back_button = customtkinter.CTkButton(top_frame, text="< Volver", command=self.back_callback, width=100)
        back_button.pack(side="left")

        title_label = customtkinter.CTkLabel(top_frame, text="Ajustes de Chat", font=(FONT_FAMILY, FONT_SIZE_SUBTITLE, "bold"), text_color=HEADER_BG_COLOR)
        title_label.pack(side="left", expand=True)

        main_container = customtkinter.CTkFrame(self, fg_color="white", border_width=2, border_color=CANVAS_BORDER_COLOR, corner_radius=10)
        main_container.grid(row=1, column=0, padx=10, pady=(0, 10), sticky="nsew")
        main_container.grid_rowconfigure(0, weight=1)
        main_container.grid_columnconfigure(0, weight=1)

        placeholder_label = customtkinter.CTkLabel(main_container, text="Esta sección estará disponible próximamente.", font=(FONT_FAMILY, FONT_SIZE_TEXT))
        placeholder_label.grid(row=0, column=0, sticky="nsew")


class UserSettingsPage(customtkinter.CTkFrame):
    """
    A placeholder sub-page for future user settings.
    """
    def __init__(self, master, back_callback):
        super().__init__(master, fg_color=MAIN_CONTENT_BG_COLOR, corner_radius=0)
        self.back_callback = back_callback
        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        top_frame = customtkinter.CTkFrame(self, fg_color="transparent")
        top_frame.grid(row=0, column=0, padx=10, pady=(10, 5), sticky="ew")
        
        back_button = customtkinter.CTkButton(top_frame, text="< Volver", command=self.back_callback, width=100)
        back_button.pack(side="left")

        title_label = customtkinter.CTkLabel(top_frame, text="Ajustes de Usuario", font=(FONT_FAMILY, FONT_SIZE_SUBTITLE, "bold"), text_color=HEADER_BG_COLOR)
        title_label.pack(side="left", expand=True)

        main_container = customtkinter.CTkFrame(self, fg_color="white", border_width=2, border_color=CANVAS_BORDER_COLOR, corner_radius=10)
        main_container.grid(row=1, column=0, padx=10, pady=(0, 10), sticky="nsew")
        main_container.grid_rowconfigure(0, weight=1)
        main_container.grid_columnconfigure(0, weight=1)

        placeholder_label = customtkinter.CTkLabel(main_container, text="Esta sección estará disponible próximamente.", font=(FONT_FAMILY, FONT_SIZE_TEXT))
        placeholder_label.grid(row=0, column=0, sticky="nsew")


class InvestigacionAccidentesPage(customtkinter.CTkFrame):
    """
    Página para la gestión de investigación de accidentes.
    """
    def __init__(self, master, app_instance):
        super().__init__(master, fg_color=MAIN_CONTENT_BG_COLOR, corner_radius=0)
        self.app = app_instance
        self.pack(fill="both", expand=True)
        self._show_menu_opciones()

    def _clear_frame(self):
        for widget in self.winfo_children():
            widget.destroy()

    def _show_menu_opciones(self):
        self._clear_frame()

        main_container = customtkinter.CTkFrame(self, fg_color="transparent")
        main_container.pack(fill="both", expand=True, padx=20, pady=20)
        main_container.grid_columnconfigure(0, weight=1)
        main_container.grid_columnconfigure(1, weight=1)
        main_container.grid_rowconfigure(1, weight=1)

        title_label = customtkinter.CTkLabel(main_container, text="Investigación de Accidentes, Incidentes y Enfermedades", font=(FONT_FAMILY, FONT_SIZE_TITLE, "bold"), text_color=HEADER_BG_COLOR)
        title_label.grid(row=0, column=0, columnspan=2, pady=(0, 20), sticky="w")

        # --- Tarjetas de Opciones ---
        card2 = self._create_card(main_container, "Visualizar Investigación", "Buscar y visualizar una investigación guardada.", self.visualizar_investigacion)
        card2.grid(row=1, column=1, padx=(10, 0), pady=10, sticky="nsew")

        card3 = self._create_card(main_container, "Realizar Investigación", "Crear un nuevo registro de investigación.", self.show_realizar_investigacion)
        card3.grid(row=1, column=0, padx=(0, 10), pady=10, sticky="nsew")

        card4 = self._create_card(main_container, "Otra Opción", "Futura funcionalidad.", self.otra_opcion)
        card4.grid(row=2, column=0, columnspan=2, padx=(0, 0), pady=10, sticky="nsew")

    def _create_card(self, master, title, description, command):
        card = customtkinter.CTkFrame(master, corner_radius=10, fg_color="#F0F0F0", border_width=1, border_color="#D0D0D0")
        card.grid_rowconfigure(1, weight=1)
        card.grid_columnconfigure(0, weight=1)

        card_title = customtkinter.CTkLabel(card, text=title, font=(FONT_FAMILY, FONT_SIZE_SUBTITLE, "bold"), text_color=TEXT_COLOR)
        card_title.grid(row=0, column=0, padx=20, pady=(20, 10))

        card_desc = customtkinter.CTkLabel(card, text=description, wraplength=220, font=(FONT_FAMILY, FONT_SIZE_TEXT), text_color=SECONDARY_COLOR)
        card_desc.grid(row=1, column=0, padx=20, pady=5, sticky="n")

        card_button = customtkinter.CTkButton(card, text="Abrir", command=command, fg_color=HEADER_BG_COLOR, hover_color=BUTTON_ACTIVE_COLOR)
        card_button.grid(row=2, column=0, padx=20, pady=(15, 20))
        
        return card

    def show_realizar_investigacion(self):
        self._clear_frame()
        realizar_page = RealizarInvestigacionFrame(self, self._show_menu_opciones)
        realizar_page.grid(row=0, column=0, sticky="nsew")

    

    def visualizar_investigacion(self):
        show_custom_messagebox(self, "Funcionalidad en Desarrollo", "La opción para visualizar investigaciones estará disponible próximamente.")

    def otra_opcion(self):
        show_custom_messagebox(self, "Funcionalidad en Desarrollo", "Esta opción estará disponible próximamente.")

class VerFuratPage(customtkinter.CTkFrame):
    def __init__(self, master, app_instance, back_callback):
        super().__init__(master, fg_color=MAIN_CONTENT_BG_COLOR, corner_radius=0)
        self.app = app_instance
        self.back_callback = back_callback
        self.pdf_document = None
        self.current_page = 0
        self.pdf_images = []
        self.search_results = []  # Lista para almacenar los resultados de la búsqueda
        self.current_search_index = 0  # Índice actual de la página de resultados
        self.results_per_page = 10  # Número de resultados por página

        # --- Layout ---
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(1, weight=1)
        # --- Header ---
        header_frame = customtkinter.CTkFrame(self, fg_color="transparent")
        header_frame.grid(row=0, column=0, columnspan=2, sticky="ew", padx=20, pady=(10, 0))
        header_frame.grid_columnconfigure(1, weight=1)
        customtkinter.CTkButton(header_frame, text="< Volver", command=self.back_callback, width=100).grid(row=0, column=0, sticky="w")
        customtkinter.CTkLabel(header_frame, text="Visualizador de FURAT", font=(FONT_FAMILY, FONT_SIZE_TITLE, "bold"), text_color=HEADER_BG_COLOR).grid(row=0, column=1, sticky="w", padx=20)

        # --- Left Column (Controls) ---
        left_panel = customtkinter.CTkFrame(self, fg_color="transparent")
        left_panel.grid(row=1, column=0, sticky="nsew", padx=20, pady=20)
        left_panel.grid_rowconfigure(2, weight=1)

        # Botón "Buscar desde"
        self.start_date_button = customtkinter.CTkButton(left_panel, text="Buscar desde", command=self.select_start_date)
        self.start_date_button.pack(fill="x", pady=(0, 5))

        # Botón "Buscar hasta"
        self.end_date_button = customtkinter.CTkButton(left_panel, text="Buscar hasta", command=self.select_end_date)
        self.end_date_button.pack(fill="x")

        # Botón "Buscar"
        customtkinter.CTkButton(left_panel, text="Buscar", command=self.search_furats).pack(fill="x", pady=(10, 5))

        # Resultados
        customtkinter.CTkLabel(left_panel, text="Resultados:", font=(FONT_FAMILY, FONT_SIZE_SUBTITLE)).pack(fill="x", pady=(15, 5))
        self.file_list_frame = customtkinter.CTkScrollableFrame(left_panel, label_text="")
        self.file_list_frame.pack(fill="both", expand=True)

        # --- Right Column (PDF Viewer) ---
        right_panel = customtkinter.CTkScrollableFrame(self, fg_color="#E0E0E0")
        right_panel.grid(row=1, column=1, sticky="nsew", padx=(0, 20), pady=20)
        self.pdf_display_canvas = customtkinter.CTkLabel(right_panel, text="Seleccione un archivo FURAT para visualizarlo aquí.", text_color=SECONDARY_COLOR)
        self.pdf_display_canvas.pack(expand=True)

        # --- PDF Navigation ---
        nav_frame = customtkinter.CTkFrame(self, fg_color="transparent")
        nav_frame.grid(row=2, column=1, sticky="e", padx=(0, 20), pady=(0, 10))
        self.page_label = customtkinter.CTkLabel(nav_frame, text="Página 0/0")
        self.page_label.pack(side="left", padx=10)
        self.prev_button = customtkinter.CTkButton(nav_frame, text="< Anterior", command=self.show_previous_page, state="disabled")
        self.prev_button.pack(side="left", padx=5)
        self.next_button = customtkinter.CTkButton(nav_frame, text="Siguiente >", command=self.show_next_page, state="disabled")
        self.next_button.pack(side="left", padx=5)

        # Variables para fechas
        self.start_date = None
        self.end_date = None

    def get_furats_path(self):
        """
        Obtiene la ruta de la carpeta de FURATs.
        Intenta primero con el sistema de mapeo dinámico (config.json).
        Si falla, usa la ruta hardcodeada en la clase Config como respaldo.
        """
        submodule_name = "3.2.1 Reporte de los accidentes de trabajo"
        module_name = "Gestión de la Salud"
        
        # --- Intento 1: Usar el sistema principal de mapeo (config.json) ---
        try:
            path_from_map, message = self.app._find_path_for_submodule(module_name, submodule_name)
            if path_from_map and os.path.isdir(path_from_map):
                print(f"Ruta de FURATs encontrada por mapeo: {path_from_map}")
                return path_from_map
        except Exception as e:
            print(f"Error buscando ruta en config.json: {e}")

        # --- Intento 2: Usar la clase Config como respaldo ---
        try:
            print("El mapeo de config.json falló. Usando la clase Config como respaldo.")
            current_company = self.app.current_company
            if not current_company:
                show_custom_messagebox(self, "Error de Configuración", "No se ha seleccionado ninguna empresa.", icon_type="alerta")
                return None

            company_paths = Config.get_empresa_paths(current_company)
            path_from_config = company_paths.get("furats")

            if path_from_config and os.path.isdir(path_from_config):
                print(f"Ruta de FURATs encontrada por Config: {path_from_config}")
                return path_from_config
        except Exception as e:
            print(f"Error buscando ruta en la clase Config: {e}")

        # --- Si ambos fallan ---
        show_custom_messagebox(self, "Error de Configuración", f"La ruta para '{submodule_name}' no pudo ser encontrada. Verifique la configuración en 'Ajustes -> Vincular Empresas' o la ruta en el código fuente.", icon_type="alerta")
        return None

    def _open_date_dialog(self, date_type):
        """Función genérica para abrir el diálogo de selección de fecha."""
        top = customtkinter.CTkToplevel(self)
        top.title(f"Seleccionar Fecha {'Inicial' if date_type == 'start' else 'Final'}")
        top.geometry("300x250")
        top.resizable(False, False)
        top.transient(self)
        top.grab_set()

        cal = DateEntry(top, width=12, background='darkblue', foreground='white', borderwidth=2, date_pattern='y-mm-dd')
        cal.pack(padx=20, pady=20)

        def on_confirm():
            selected_date = cal.get_date().strftime("%Y-%m-%d")
            if date_type == "start":
                self.set_start_date(selected_date)
            else:
                self.set_end_date(selected_date)
            top.destroy()

        confirm_button = customtkinter.CTkButton(top, text="Confirmar", command=on_confirm)
        confirm_button.pack(pady=10)

    def select_start_date(self):
        """Abre un diálogo para seleccionar la fecha de inicio."""
        self._open_date_dialog("start")

    def set_start_date(self, date):
        """Establece la fecha de inicio y actualiza el botón."""
        self.start_date = date
        self.start_date_button.configure(text=f"Desde: {self.start_date}")
        print(f"Fecha inicial seleccionada: {self.start_date}")

    def select_end_date(self):
        """Abre un diálogo para seleccionar la fecha de fin."""
        self._open_date_dialog("end")

    def set_end_date(self, date):
        """Establece la fecha de fin y actualiza el botón."""
        self.end_date = date
        self.end_date_button.configure(text=f"Hasta: {self.end_date}")
        print(f"Fecha final seleccionada: {self.end_date}")

    def search_furats(self):
        """Buscar FURATs en la ruta vinculada y sus subcarpetas según las fechas seleccionadas."""
        furats_path = self.get_furats_path()
        if not furats_path:
            return

        self.search_results = []
        # Usar os.walk para recorrer el directorio de forma recursiva
        for root, dirs, files in os.walk(furats_path):
            for file in files:
                if file.lower().endswith(".pdf"):
                    file_path = os.path.join(root, file)
                    try:
                        file_date = datetime.fromtimestamp(os.path.getmtime(file_path)).strftime("%Y-%m-%d")
                        
                        # Lógica de filtrado por fecha
                        match = False
                        if self.start_date and self.end_date:
                            if self.start_date <= file_date <= self.end_date:
                                match = True
                        elif self.start_date:
                            if file_date >= self.start_date:
                                match = True
                        elif self.end_date:
                            if file_date <= self.end_date:
                                match = True
                        else: # Si no hay fechas, incluir todos los PDFs
                            match = True
                        
                        if match:
                            self.search_results.append(file_path)
                    except FileNotFoundError:
                        print(f"Advertencia: El archivo no fue encontrado, puede haber sido eliminado: {file_path}")
                        continue

        # Mostrar resultados
        if self.search_results:
            self.update_file_list(self.search_results)
            # Opcional: Cargar el primer PDF encontrado automáticamente
            # self.load_pdf(self.search_results[0]) 
        else:
            # Limpiar la lista si no se encontraron resultados
            self.update_file_list([])
            show_custom_messagebox(self, "Sin Resultados", "No se encontraron archivos FURAT en el rango de fechas seleccionado.", icon_type="alerta")

        # Limpiar la vista previa del PDF si no hay resultados
        if not self.search_results:
            self.pdf_display_canvas.configure(image=None, text="No hay resultados para mostrar.")
            self.page_label.configure(text="Página 0/0")
            self.prev_button.configure(state="disabled")
            self.next_button.configure(state="disabled")

    def update_file_list(self, file_paths):
        """Actualizar la lista de archivos en la interfaz."""
        for widget in self.file_list_frame.winfo_children():
            widget.destroy()
        for i, path in enumerate(file_paths):
            filename = os.path.basename(path)
            btn = customtkinter.CTkButton(self.file_list_frame, text=filename, 
                                         command=lambda p=path: self.load_pdf(p),
                                         anchor="w", fg_color="transparent", text_color=TEXT_COLOR)
            btn.pack(fill="x", padx=5, pady=2)

    def load_pdf(self, filepath):
        """Cargar y mostrar el PDF seleccionado."""
        try:
            self.pdf_document = fitz.open(filepath)
            self.pdf_images = []
            for page_num in range(len(self.pdf_document)):
                page = self.pdf_document.load_page(page_num)
                pix = page.get_pixmap(dpi=150)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                ctk_img = customtkinter.CTkImage(light_image=img, size=(pix.width, pix.height))
                self.pdf_images.append(ctk_img)
            self.current_page = 0
            self.show_page()
        except Exception as e:
            show_custom_messagebox(self, "Error", f"No se pudo cargar el archivo PDF: {e}", icon_type="alerta")
            self.pdf_document = None

    def show_page(self):
        """Mostrar la página actual del PDF."""
        if not self.pdf_images:
            return
        self.pdf_display_canvas.configure(image=self.pdf_images[self.current_page], text="")
        total_pages = len(self.pdf_images)
        self.page_label.configure(text=f"Página {self.current_page + 1}/{total_pages}")
        self.prev_button.configure(state="normal" if self.current_page > 0 else "disabled")
        self.next_button.configure(state="normal" if self.current_page < total_pages - 1 else "disabled")

    def show_previous_page(self):
        """Mostrar la página anterior del PDF."""
        if self.current_page > 0:
            self.current_page -= 1
            self.show_page()

    def show_next_page(self):
        """Mostrar la página siguiente del PDF."""
        if self.current_page < len(self.pdf_images) - 1:
            self.current_page += 1
            self.show_page()
    


class RealizarInvestigacionFrame(customtkinter.CTkFrame):
    def __init__(self, master, back_callback):
        super().__init__(master, fg_color=MAIN_CONTENT_BG_COLOR, corner_radius=0)
        self.back_callback = back_callback

        self.pdf_processor = PdfProcessor()
        self.doc_generator = DocumentGenerator()
        self.analyzer = None
        self.pdf_path = customtkinter.StringVar()
        self.output_path = customtkinter.StringVar()
        self.empresa = customtkinter.StringVar(value="TEMPOACTIVA")
        self.extracted_data_vars = {}

        self._create_widgets()
        self._update_paths()
        self.after(100, self._load_model_async)

    def _create_widgets(self):
        # El frame principal (self) ahora usa grid.
        # Se elimina el main_frame intermedio que usaba .pack()
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1) # Columna Izquierda con peso 1
        self.grid_columnconfigure(1, weight=4) # Columna Derecha con peso 4 (más ancha)

        # --- Columna Izquierda (Config y Datos) ---
        left_column = customtkinter.CTkFrame(self, fg_color="transparent")
        left_column.grid(row=0, column=0, sticky="nsew", padx=(25, 15), pady=25)
        left_column.grid_rowconfigure(1, weight=1)
        left_column.grid_columnconfigure(0, weight=1)

        # Card de Configuración
        config_card = customtkinter.CTkFrame(left_column, fg_color="white", corner_radius=10)
        config_card.grid(row=0, column=0, sticky="new", pady=(0, 20))
        config_card.grid_columnconfigure(1, weight=1)
        customtkinter.CTkLabel(config_card, text="1. Configuración", font=(FONT_FAMILY, FONT_SIZE_SUBTITLE, "bold")).grid(row=0, column=0, columnspan=3, sticky="w", pady=(15, 15), padx=20)
        
        customtkinter.CTkLabel(config_card, text="Archivo PDF:", font=(FONT_FAMILY, FONT_SIZE_LABEL)).grid(row=1, column=0, sticky="w", padx=20)
        pdf_entry = customtkinter.CTkEntry(config_card, textvariable=self.pdf_path)
        pdf_entry.grid(row=1, column=1, sticky="ew", padx=(0, 20))
        customtkinter.CTkButton(config_card, text="Buscar...", command=self._browse_pdf).grid(row=1, column=2, padx=(0,20))

        customtkinter.CTkLabel(config_card, text="Empresa:", font=(FONT_FAMILY, FONT_SIZE_LABEL)).grid(row=2, column=0, sticky="w", pady=(15, 20), padx=20)
        empresa_combo = customtkinter.CTkComboBox(config_card, variable=self.empresa, values=list(Config.RUTAS.keys()), state="readonly")
        empresa_combo.grid(row=2, column=1, columnspan=2, sticky="ew", pady=(15, 20), padx=(0,20))
        empresa_combo.bind('<<ComboboxSelected>>', self._update_paths)

        # Card de Datos del Accidente
        data_card = customtkinter.CTkFrame(left_column, fg_color="white", corner_radius=10)
        data_card.grid(row=1, column=0, sticky="nsew")
        data_card.grid_rowconfigure(1, weight=1)
        data_card.grid_columnconfigure(0, weight=1)
        customtkinter.CTkLabel(data_card, text="2. Datos del Accidente", font=(FONT_FAMILY, FONT_SIZE_SUBTITLE, "bold")).grid(row=0, column=0, sticky="w", pady=(10, 10), padx=20)
        self._create_extracted_data_widgets(data_card)

        # --- Columna Derecha (Análisis y Logs) ---
        right_column = customtkinter.CTkFrame(self, fg_color="transparent")
        right_column.grid(row=0, column=1, sticky="nsew", pady=25, padx=(0, 25))
        right_column.grid_rowconfigure(1, weight=1)
        right_column.grid_columnconfigure(0, weight=1)

        # Card de Contexto Adicional
        context_card = customtkinter.CTkFrame(right_column, fg_color="white", corner_radius=10)
        context_card.grid(row=0, column=0, sticky="new", pady=(0, 20))
        context_card.grid_columnconfigure(0, weight=1)
        customtkinter.CTkLabel(context_card, text="3. Contexto Adicional (Opcional)", font=(FONT_FAMILY, FONT_SIZE_SUBTITLE, "bold")).grid(row=0, column=0, sticky="w", pady=(15, 15), padx=20)
        self.context_text = customtkinter.CTkTextbox(context_card, height=4, wrap="word", font=(FONT_FAMILY, FONT_SIZE_TEXT), border_width=1, border_color=CANVAS_BORDER_COLOR)
        self.context_text.grid(row=1, column=0, sticky="ew", padx=20, pady=(0,20))
        self.context_text.insert("end", "Añade aquí cualquier detalle no presente en el FURAT...")

        # Card de Análisis de Causa Raíz
        five_whys_card = customtkinter.CTkFrame(right_column, fg_color="white", corner_radius=10)
        five_whys_card.grid(row=1, column=0, sticky="nsew")
        five_whys_card.grid_rowconfigure(1, weight=1)
        five_whys_card.grid_columnconfigure(0, weight=1)
        customtkinter.CTkLabel(five_whys_card, text="4. Análisis de Causa Raíz", font=(FONT_FAMILY, FONT_SIZE_SUBTITLE, "bold")).grid(row=0, column=0, sticky="w", pady=(10, 10), padx=20)
        self.five_whys_scroll = customtkinter.CTkScrollableFrame(five_whys_card, fg_color="transparent")
        self.five_whys_scroll.grid(row=1, column=0, sticky="nsew", pady=(5,20), padx=20)
        self.five_whys_container = self.five_whys_scroll
        self._display_five_whys({})

        # Card de Registro de Actividad
        results_card = customtkinter.CTkFrame(right_column, fg_color="white", corner_radius=10)
        results_card.grid(row=2, column=0, sticky="new", pady=(20, 0))
        results_card.grid_columnconfigure(0, weight=1)
        customtkinter.CTkLabel(results_card, text="5. Registro de Actividad", font=(FONT_FAMILY, FONT_SIZE_SUBTITLE, "bold")).grid(row=0, column=0, sticky="w", pady=(15, 15), padx=20)
        self.results_text = customtkinter.CTkTextbox(results_card, height=6, wrap="word", font=(FONT_FAMILY, FONT_SIZE_TEXT), border_width=1, border_color=CANVAS_BORDER_COLOR)
        self.results_text.grid(row=1, column=0, sticky="ew", padx=20, pady=(0,20))

        # --- Barra de Estado y Botones ---
        # Esta barra de estado ahora debe estar fuera de la parrilla principal de 2 columnas.
        # La colocaremos en la fila 1 del grid de RealizarInvestigacionFrame.
        self.grid_rowconfigure(1, weight=0) # La fila de botones no se expande
        status_frame = customtkinter.CTkFrame(self, fg_color="transparent", corner_radius=0)
        status_frame.grid(row=1, column=0, columnspan=2, sticky="ew", padx=20, pady=15)
        status_frame.grid_columnconfigure(1, weight=1)
        
        self.status_label = customtkinter.CTkLabel(status_frame, text="Inicializando...")
        self.status_label.grid(row=0, column=0, sticky="w")
        self.progress_bar = customtkinter.CTkProgressBar(status_frame, mode='indeterminate')
        self.progress_bar.grid(row=0, column=1, sticky="ew", padx=20)
        
        action_frame = customtkinter.CTkFrame(status_frame, fg_color="transparent")
        action_frame.grid(row=0, column=2, sticky="e")
        self.process_button = customtkinter.CTkButton(action_frame, text="PROCESAR Y GENERAR INFORME", command=self._process_pdf)
        self.process_button.pack(side="left", padx=5)
        customtkinter.CTkButton(action_frame, text="LIMPIAR", command=self._clear_data, fg_color=SECONDARY_COLOR).pack(side="left")
        customtkinter.CTkButton(action_frame, text="< Volver", command=self.back_callback).pack(side="left", padx=5)

    def _create_extracted_data_widgets(self, parent):
        container = customtkinter.CTkFrame(parent, fg_color="transparent")
        container.grid(row=1, column=0, sticky="nsew", pady=(5,0), padx=20)
        container.grid_columnconfigure(1, weight=1)

        fields = ['Nombre Completo', 'No Identificacion', 'Fecha del Accidente', 'Hora del Accidente', 'Empresa', 'Cargo', 'Tipo de Accidente', 'Lugar del Accidente', 'Sitio de Ocurrencia', 'Tipo de Lesion', 'Parte del Cuerpo Afectada', 'Agente del Accidente', 'Mecanismo o Forma del Accidente', 'Descripcion del Accidente']
        
        for i, field in enumerate(fields):
            key = field.replace(' ', '_')
            label = customtkinter.CTkLabel(container, text=f"{field}:", font=(FONT_FAMILY, FONT_SIZE_LABEL))
            label.grid(row=i, column=0, sticky="ne", padx=(0,10), pady=4)
            
            if field == 'Descripcion del Accidente':
                text_widget = customtkinter.CTkTextbox(container, height=5, wrap="word", state="disabled", font=(FONT_FAMILY, FONT_SIZE_TEXT), border_width=1, border_color=CANVAS_BORDER_COLOR)
                text_widget.grid(row=i, column=1, sticky="ew", pady=4)
                self.extracted_data_vars[key] = text_widget
            else:
                self.extracted_data_vars[key] = customtkinter.StringVar(value="N/A")
                entry = customtkinter.CTkEntry(container, textvariable=self.extracted_data_vars[key], state="readonly")
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
        self.process_button.configure(state="disabled")
        self.progress_bar.start()
        self.log_message("Iniciando proceso...")
        threading.Thread(target=self._process_pdf_thread, daemon=True).start()

    def _process_pdf_thread(self):
        try:
            pdf_path = Path(self.pdf_path.get())
            output_dir = Path(self.output_path.get())
            template_path = Config.get_empresa_paths(self.empresa.get())["plantilla"]
            contexto_adicional = self.context_text.get(1.0, "end-1c").strip()

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
            self.after(0, lambda: self.process_button.configure(state="normal"))

    def _display_extracted_data(self, data):
        for field, value in data.items():
            key = field.replace(' ', '_')
            if key in self.extracted_data_vars:
                widget = self.extracted_data_vars[key]
                if isinstance(widget, customtkinter.CTkTextbox):
                    widget.configure(state="normal")
                    widget.delete(1.0, "end")
                    widget.insert("end", value or "N/A")
                    widget.configure(state="disabled")
                elif isinstance(widget, customtkinter.StringVar):
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
            
            card = customtkinter.CTkFrame(container, fg_color="white", corner_radius=10, border_width=1, border_color=CANVAS_BORDER_COLOR)
            card.grid(row=i-1, column=0, sticky="ew", pady=(0, 15))
            card.grid_columnconfigure(0, weight=1)

            # --- Fila de Causa Principal ---
            header_frame = customtkinter.CTkFrame(card, fg_color="transparent")
            header_frame.grid(row=0, column=0, sticky="ew", pady=(0, 10), padx=15)
            header_frame.grid_columnconfigure(1, weight=1)

            customtkinter.CTkLabel(header_frame, text=f"{i}.", font=(FONT_FAMILY, FONT_SIZE_SUBTITLE, "bold")).grid(row=0, column=0, sticky="nw", padx=(0, 10))
            causa_text = row_data.get('causa', 'Análisis no disponible')
            if "?" not in causa_text and "no disponible" not in causa_text:
                causa_text = f"¿Por qué {causa_text.lower()}?"
            
            causa_label = customtkinter.CTkLabel(header_frame, text=causa_text, wraplength=1000, font=(FONT_FAMILY, FONT_SIZE_LABEL, "bold"), justify="left")
            causa_label.grid(row=0, column=1, sticky="w")
            
            customtkinter.CTkFrame(card, height=1, fg_color=CANVAS_BORDER_COLOR).grid(row=1, column=0, sticky="ew", pady=5)

            # --- Grid de 5M (5 columnas horizontales) ---
            m_frame = customtkinter.CTkFrame(card, fg_color="transparent")
            m_frame.grid(row=2, column=0, sticky="ew", padx=5)
            m_frame.grid_columnconfigure(list(range(5)), weight=1)

            for j, m_category in enumerate(m_categories):
                m_cell = customtkinter.CTkFrame(m_frame, fg_color="transparent")
                m_cell.grid(row=0, column=j, sticky="nsew", padx=5, pady=5)
                
                customtkinter.CTkLabel(m_cell, text=m_category, font=(FONT_FAMILY, FONT_SIZE_LABEL, "bold"), text_color=BUTTON_ACTIVE_COLOR).pack(anchor="w", pady=(0, 3))
                
                m_text = row_data.get(m_category, 'N/A')
                m_label = customtkinter.CTkLabel(m_cell, text=m_text, wraplength=300, font=(FONT_FAMILY, FONT_SIZE_TEXT), justify="left")
                m_label.pack(anchor="w", fill="x")

    def _clear_data(self):
        self.log_message("Limpiando datos...")
        for key, var in self.extracted_data_vars.items():
            if isinstance(var, customtkinter.CTkTextbox):
                var.configure(state="normal")
                var.delete(1.0, "end")
                var.configure(state="disabled")
            else:
                var.set("N/A")
        self._display_five_whys({})
        self.context_text.delete(1.0, "end")
        self.context_text.insert("end", "Añade aquí cualquier detalle no presente en el FURAT...")
        self.results_text.delete(1.0, "end")
        self.log_message("Datos limpiados.")

    def log_message(self, message, error=False, success=False):
        timestamp = datetime.now().strftime('%H:%M:%S')
        
        self.results_text.configure(state="normal")
        self.results_text.insert("end", f"{timestamp} ")
        if error:
            self.results_text.insert("end", f"[ERROR] {message}\n", "error")
        elif success:
            self.results_text.insert("end", f"[SUCCESS] {message}\n", "success")
        else:
            self.results_text.insert("end", f"[INFO] {message}\n", "info")
        self.results_text.see("end")
        self.results_text.configure(state="disabled")
        logging.info(message)

    def _load_model_async(self):
        self.log_message("Cargando modelo de IA...")
        self.process_button.configure(state="disabled")
        self.status_label.configure(text="Cargando modelo de IA, por favor espere...")
        self.progress_bar.start()
        threading.Thread(target=self._initialize_analyzer, daemon=True).start()

    def _initialize_analyzer(self):
        try:
            self.analyzer = AccidentAnalyzer()
            self.after(0, self._on_model_loaded)
        except Exception as e:
            self.after(0, self._on_model_load_error, e)

    def _on_model_loaded(self):
        self.log_message("Modelo de IA cargado.", success=True)
        self.process_button.configure(state="normal")
        self.status_label.configure(text="Listo para procesar")
        self.progress_bar.stop()

    def _on_model_load_error(self, error):
        self.log_message(f"Error al cargar modelo: {error}", error=True)
        messagebox.showerror("Error Crítico de Modelo", f"No se pudo inicializar el modelo de IA: {error}")
        self.status_label.configure(text="Error de modelo")
        self.progress_bar.stop()

class Config:
    RUTA_BASE = Path("G:/Mi unidad/2. Trabajo/1. SG-SST")
    RUTAS = {
        "TEMPOACTIVA": {
            "investigaciones": RUTA_BASE / "2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/2. Accidentes",
            "plantilla": RUTA_BASE / "2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/4. Procedimientos/GI-FO-020 INVESTIGACION.docx",
            "furats": RUTA_BASE / "2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.2.1 Reporte de Accidentes de Trabajo"
        }
    }
    @classmethod
    def get_empresa_paths(cls, empresa):
        return cls.RUTAS.get(empresa.upper(), cls.RUTAS["TEMPOACTIVA"])


class LLMChatWindow(customtkinter.CTkToplevel):
    def __init__(self, master):
        super().__init__(master)
        self.title("Asistente LLM")
        self.geometry("500x600")
        self.protocol("WM_DELETE_WINDOW", self.hide_window)
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)
        self.chat_history = customtkinter.CTkTextbox(self, wrap="word", state="disabled")
        self.chat_history.grid(row=0, column=0, columnspan=2, padx=10, pady=10, sticky="nsew")
        self.user_input = customtkinter.CTkEntry(self, placeholder_text="Escribe tu pregunta...")
        self.user_input.grid(row=1, column=0, padx=10, pady=(0, 10), sticky="ew")
        self.user_input.bind("<Return>", self._on_send_message)
        self.send_button = customtkinter.CTkButton(self, text="Enviar", command=self._on_send_message)
        self.send_button.grid(row=1, column=1, padx=10, pady=(0, 10), sticky="ew")

    def _on_send_message(self, event=None):
        pass
    def hide_window(self):
        self.withdraw()
    def show_window(self):
        self.deiconify()


class CustomAlertDialog(customtkinter.CTkToplevel):
    """
    Una ventana de diálogo de alerta personalizada con un icono animado como encabezado.
    """
    def __init__(self, master, title, message, icon_type="info"):
        super().__init__(master)

        self.title(title) # Mantiene el título en la barra de la ventana del S.O.
        self.geometry("400x220")
        self.resizable(False, False)
        self.transient(master)
        self.grab_set()

        # --- Diseño y Colores ---
        self.configure(fg_color="#FFFFFF")
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(0, weight=1) # Fila del icono
        self.grid_rowconfigure(1, weight=1) # Fila del mensaje

        # 1. Área del Icono Animado (en la parte superior)
        self.icon_frame = customtkinter.CTkFrame(self, fg_color="transparent")
        self.icon_frame.grid(row=0, column=0, sticky="nsew", pady=(15, 5))
        self.icon_label = customtkinter.CTkLabel(self.icon_frame, text="")
        self.icon_label.pack(expand=True)
        self._load_and_animate_icon(icon_type)

        # 2. Área del Mensaje (debajo del icono)
        self.message_frame = customtkinter.CTkFrame(self, fg_color="transparent")
        self.message_frame.grid(row=1, column=0, sticky="nsew", pady=(0, 10))
        self.message_label = customtkinter.CTkLabel(self.message_frame, text=message, font=(FONT_FAMILY, FONT_SIZE_TEXT), wraplength=380, justify="center")
        self.message_label.pack(padx=20, expand=True)

        # 3. Botón de Aceptar
        self.button_frame = customtkinter.CTkFrame(self, fg_color="transparent")
        self.button_frame.grid(row=2, column=0, sticky="ew", pady=(0, 20))
        self.ok_button = customtkinter.CTkButton(self.button_frame, text="Aceptar", command=self.destroy, fg_color="#EAEAEA", text_color=TEXT_COLOR, hover_color="#D5D5D5")
        self.ok_button.pack()

        self.after(10, self._center_window)

    def _load_and_animate_icon(self, icon_type):
        """Carga un GIF, lo redimensiona y comienza la animación."""
        try:
            gif_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", f"{icon_type}.gif")
            self.gif_image = Image.open(gif_path)
            self.frames = []
            new_size = (55, 55)
            for i in range(self.gif_image.n_frames):
                self.gif_image.seek(i)
                self.frames.append(customtkinter.CTkImage(self.gif_image.copy(), size=new_size))

            self.frame_index = 0
            self.delay = 40
            self._update_animation()

        except FileNotFoundError:
            print(f"Icono animado no encontrado: {icon_type}.gif")
        except Exception as e:
            print(f"No se pudo cargar el icono animado: {e}")

    def _update_animation(self):
        """Actualiza el fotograma del icono y programa la siguiente actualización."""
        if hasattr(self, 'frames'):
            self.icon_label.configure(image=self.frames[self.frame_index])
            self.frame_index = (self.frame_index + 1) % len(self.frames)
            self.after(self.delay, self._update_animation)

    def _center_window(self):
        self.update_idletasks()
        master = self.master
        x = master.winfo_x() + (master.winfo_width() // 2) - (self.winfo_width() // 2)
        y = master.winfo_y() + (master.winfo_height() // 2) - (self.winfo_height() // 2)
        self.geometry(f"{self.winfo_width()}x{self.winfo_height()}+{x}+{y}")
        self.lift()


def show_custom_messagebox(master, title, message, icon_type="info"):
    dialog = CustomAlertDialog(master=master, title=title, message=message, icon_type=icon_type)
    dialog.wait_window()


class AccidentAnalyzer:
    """Genera la metodología '5 Por Qué' usando un LLM (Mistral-7B-Instruct-v0.3)."""
    def __init__(self):
        self.model_path = r"D:\1. Estudio\1.1 IA\1.1.2. LLM's\Inv. AT\models--mistralai--Mistral-7B-Instruct-v0.3\snapshots\e0bc86c23ce5aae1db576c8cca6f06f1f73af2db"
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"No se encontró el modelo en la ruta: {self.model_path}")
        try:
            print("Cargando tokenizer...")
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
            self.tokenizer.pad_token = self.tokenizer.eos_token
            print("Cargando modelo...")
            
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            print(f"Usando dispositivo: {device}")
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
            print("Modelo cargado exitosamente.")
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
                        r'No\.?\s*Identificacion:CC\s*-\s*(\d+)',
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
                        r'Fecha\s+del\s+Accidente\s*[:\s]*(\d{2}/\d{2}/\d{4})\b',
                        r'Fecha de atención:\s*(\d{2}/\d{2}/\d{4})'
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
                        r'IV\.\s*DESCRIPCIÓN\s+DEL\s+ACCIDENTE\s*\n(.*?)(?=\nPersonas)'
                    ],
                    'processor': lambda x: x.strip().replace('\n', ' ') if x else ''
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


class App(customtkinter.CTk):
    def __init__(self):
        super().__init__()
        self.title("SG-SST - Sistema de Gestión de Seguridad y Salud en el Trabajo")
        self.geometry("1500x1050") #Ancho total de la ventana de la APP.
        self.minsize(1000, 800)
        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(1, weight=1)
        
        self.company_path_maps = {}
        self.config_file = "config.json"
        self.load_configuration()

        self.current_company = None
        self.current_sidebar_selection = None
        self.llm_chat_window = None
        self.directory_watcher = None
        self.last_update_time = 0
        self.update_lock = threading.Lock()
        
        self.header = Header(self, self.open_settings, self.open_llm_chat)
        
        sidebar_width = 140
        self.sidebar = Sidebar(self, self.change_page, width=sidebar_width, initial_company=self.current_company)
        self.sidebar.grid(row=1, column=0, sticky="nswe")
        self.sidebar.grid_propagate(False)
        
        self.content_frame = customtkinter.CTkFrame(self, fg_color=MAIN_CONTENT_BG_COLOR, corner_radius=0)
        self.content_frame.grid(row=1, column=1, sticky="nsew")
        self.content_frame.grid_rowconfigure(0, weight=1)
        self.content_frame.grid_columnconfigure(0, weight=1)
        
        self.show_home_page()
        
        self.grid_rowconfigure(2, weight=0)
        self.footer_frame = customtkinter.CTkFrame(self, fg_color=HEADER_BG_COLOR, corner_radius=0)
        self.footer_frame.grid(row=2, column=0, columnspan=2, sticky="ew")
        self.footer_frame.grid_columnconfigure(0, weight=1)
        
        copyright_text = "© 2025 Javier Robles F. Prof. SG-SST - Esp. Gerencia de Proyectos."
        self.copyright_label = customtkinter.CTkLabel(self.footer_frame, text=copyright_text, font=(FONT_FAMILY, 10), text_color=BUTTON_TEXT_COLOR)
        self.copyright_label.grid(row=0, column=0, padx=10, pady=5, sticky="")
        
        self.protocol("WM_DELETE_WINDOW", self._on_closing)

    def _on_closing(self):
        if self.directory_watcher:
            self.directory_watcher.stop()
        self.destroy()

    def load_configuration(self):
        try:
            with open(self.config_file, 'r') as f:
                self.company_path_maps = json.load(f)
            # print("Configuración cargada desde", self.config_file)
        except (FileNotFoundError, json.JSONDecodeError):
            # print("No se encontró un archivo de configuración válido. Se creará uno nuevo.")
            self.company_path_maps = {}

    def save_configuration(self):
        # Simplemente guarda el diccionario actual que ya contiene los mapeos completos.
        with open(self.config_file, 'w') as f:
            json.dump(self.company_path_maps, f, indent=4)
        # print("Configuración guardada en", self.config_file)

    def _clear_content_frame(self):
        for widget in self.content_frame.winfo_children():
            widget.destroy()

    def show_home_page(self):
        self._clear_content_frame()
        self.current_sidebar_selection = None
        self.sidebar.set_active_button(None)
        home_page = HomePage(self.content_frame, self.select_company, self.current_company)
        home_page.grid(row=0, column=0, sticky="nsew")

    def show_internal_page(self, module_name):
        self._clear_content_frame()
        internal_page = InternalPage(self.content_frame, module_name, self)
        internal_page.grid(row=0, column=0, sticky="nsew")

    def select_company(self, company_name):
        if self.current_company != company_name:
            self.current_company = company_name
            self.sidebar.update_company_info(self.current_company)
            show_custom_messagebox(master=self, title="Empresa Seleccionada", message=f"Ha seleccionado: {company_name}", icon_type="seleccionar")
            
            if self.directory_watcher:
                self.directory_watcher.stop()

            if company_name not in self.company_path_maps or not isinstance(self.company_path_maps.get(company_name), dict):
                show_custom_messagebox(self, "Ruta no Vinculada", f"La empresa '{company_name}' no tiene una ruta de archivos vinculada. Por favor, configúrela en Ajustes.", icon_type="alerta")
                self.open_settings()
            else:
                root_path = self.company_path_maps[company_name].get("root")
                if root_path:
                    self.directory_watcher = DirectoryWatcher(root_path, self._handle_directory_change)
                    self.directory_watcher.start()
                self.change_page("Recursos")

    def _handle_directory_change(self):
        with self.update_lock:
            # Evita actualizaciones muy seguidas (debounce)
            if time.time() - self.last_update_time < 2:
                return
            
            # print(f"Detectado cambio en el directorio de {self.current_company}. Actualizando...")
            
            # Lógica para actualizar el mapa de la empresa
            root_path = self.company_path_maps[self.current_company].get("root")
            if not root_path:
                return

            try:
                # No se necesita un hilo separado aquí si la operación es rápida
                mapper = DocumentMapper(root_path)
                structure = mapper.generate_structure()
                self.company_path_maps[self.current_company] = structure
                self.save_configuration() # Guardar el nuevo mapa
                # print("Mapa de archivos actualizado y guardado.")

                # En lugar de recargar toda la página, solo actualizamos el mapa en memoria
                # No llamamos a change_page para evitar interrumpir al usuario
                # La interfaz se actualizará naturalmente cuando el usuario navegue

            except Exception as e:
                # print(f"Error actualizando el mapa de archivos: {e}")
                pass  # Silenciosamente ignorar errores en modo producción

            self.last_update_time = time.time()


    def change_page(self, module_name):
        if module_name == "Salir":
            if self.directory_watcher:
                self.directory_watcher.stop()
                self.directory_watcher = None
            self.current_company = None
            self.sidebar.update_company_info(None)
            self.show_home_page()
            return

        if not self.current_company:
            show_custom_messagebox(self, "Advertencia", "Por favor, selecciona una empresa primero en la pantalla de inicio.", icon_type="alerta")
            self.show_home_page()
            return
        
        # Actualiza la selección ANTES de crear la página
        self.current_sidebar_selection = module_name
        self.show_internal_page(module_name)
        self.sidebar.set_active_button(module_name)


    def open_settings(self):
        self.show_settings_page()

    def show_settings_page(self):
        self._clear_content_frame()
        self.current_sidebar_selection = None
        self.sidebar.set_active_button(None)
        settings_page = SettingsPage(self.content_frame, self.generate_company_map, self)
        settings_page.grid(row=0, column=0, sticky="nsew")

    def generate_company_map(self, company_name, root_path, callback_on_finish, log_callback):
        def mapping_thread():
            try:
                # No mostrar mensajes en la terminal durante el mapeo
                mapper = DocumentMapper(root_path)  # Sin callback para evitar mensajes
                structure = mapper.generate_structure()
                self.company_path_maps[company_name] = structure
                # Solo registrar en el log interno, no en la terminal
                # self.after(0, lambda: log_callback(f"Mapa para '{company_name}' generado con {structure['total_files']} archivos y {structure['total_folders']} carpetas."))
                self.after(0, lambda: callback_on_finish(company_name, True, None))
            except Exception as e:
                error_msg = f"No se pudo generar el mapa para '{company_name}': {str(e)}"
                # show_custom_messagebox(self, "Error de Mapeo", f"Error: {error_msg}", icon_type="alerta")
                self.after(0, lambda: callback_on_finish(company_name, False, error_msg))
        thread = threading.Thread(target=mapping_thread, daemon=True)
        thread.start()

    def _find_path_for_submodule(self, module_name, submodule_name):
    # --- MENSAJES DE DEPURACIÓN SOLICITADOS ---
        # print(f"[DEBUG] submodule_name solicitado: '{submodule_name}'")
    # ------------------------------------------

        # 1. Extraer el código numérico
        match = re.match(r'^([\d\.]+)', submodule_name)
        if not match:
            # print(f"[ERROR] No se pudo extraer el código de '{submodule_name}'")
            return None, "Formato de submódulo inválido."
        
        submodule_code = match.group(1)
        # print(f"Código extraído: '{submodule_code}'")

        # 2. Obtener el mapa
        if not self.current_company:
            # print("[ERROR] No hay empresa seleccionada.")
            return None, "No se ha seleccionado ninguna empresa."
       
        company_map = self.company_path_maps.get(self.current_company)
        if not company_map or 'structure' not in company_map:
            # print(f"[ERROR] No se encontró mapa para la empresa '{self.current_company}'.")
            return None, f"No se encontró mapa para '{self.current_company}'."

        # 3. Función de búsqueda recursiva con depuración
        def _recursive_search(directory_node, depth=0):
            indent = "  " * depth
            
            # Itera sobre los archivos del nodo actual
            for file_info in directory_node.get('files', []):
                file_name = file_info.get('name', '')
                # Solución: Filtrar caracteres no ASCII para evitar UnicodeEncodeError en terminales cp1252
                safe_file_name = ''.join(char if ord(char) < 128 else '?' for char in file_name)
                # print(f"{indent} -> Comparando nombre de archivo '{safe_file_name}' con código '{submodule_code}'")
                if file_name.startswith(submodule_code):
                    path = file_info.get('path')
                    # print(f"{indent}   [ÉXITO] Coincidencia de archivo encontrada! Ruta: {path}")
                    return path

            # Itera sobre los subdirectorios del nodo actual
            for subdir_name, subdir_node in directory_node.get('subdirectories', {}).items():
                # print(f"{indent} -> Comparando nombre de carpeta '{subdir_name}' con código '{submodule_code}'")
                # Comprueba si el nombre del subdirectorio comienza con el código
                if subdir_name.startswith(submodule_code):
                    path = subdir_node.get('path')
                    # print(f"{indent}   [ÉXITO] Coincidencia de carpeta encontrada! Ruta: {path}")
                    return path
                
                # Si no, sigue buscando recursivamente dentro de ese subdirectorio
                found_path = _recursive_search(subdir_node, depth + 1)
                if found_path:
                    return found_path
            
            return None

        # 4. Iniciar la búsqueda
        # print(f"Iniciando búsqueda recursiva en la estructura de '{company_map['structure'].get('name', 'RAIZ')}'")
        found_path = _recursive_search(company_map['structure'])

        if found_path:
            # print(f"--- Búsqueda finalizada. Ruta final: {found_path} ---")
            return found_path, f"Ruta encontrada para {submodule_code}."
        else:
            # print(f"--- Búsqueda finalizada. No se encontró ruta para el código '{submodule_code}'. ---")
            return None, f"Código '{submodule_code}' no encontrado en el mapa."

    def open_llm_chat(self):
        if self.llm_chat_window is None or not self.llm_chat_window.winfo_exists():
            self.llm_chat_window = LLMChatWindow(self)
        else:
            self.llm_chat_window.show_window()
        self.llm_chat_window.focus()

    
    #def _find_path_for_submodule(self, module_name, submodule_name):
    #   try:
    #        company_map = self.company_path_maps.get(self.current_company, {})
    #        if not company_map or 'submodules' not in company_map:
    #            return None, "No se encontró el mapeo de submódulos para esta empresa."

    #        submodule_key = submodule_name
    #        path = company_map.get('submodules', {}).get(submodule_key)

    #        if path and os.path.exists(path):
    #            return path, f"Ruta encontrada: {path}"
    #        else:
    #            return None, f"Ruta no encontrada o inválida para '{submodule_name}'."
    #    except Exception as e:
    #        return None, f"Error al buscar la ruta: {str(e)}"

if __name__ == "__main__":
    customtkinter.set_appearance_mode("light")
    customtkinter.set_default_color_theme("blue")
    app = App()
    app.mainloop()
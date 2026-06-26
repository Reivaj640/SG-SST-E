#!/usr/bin/env python
# -*- coding: utf-8 -*-
# accident_report_generator.py

import json
import sys
import logging
from pathlib import Path
from docxtpl import DocxTemplate
from datetime import datetime
import re
import os
import traceback

# Configurar logging con codificación explícita para evitar problemas en Windows
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)],
)


class Config:
    RUTAS = {
        "TEMPOACTIVA": {
            "investigaciones": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/2. Accidentes",
            "plantilla": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/4. Procedimientos/GI-FO-020 INVESTIGACION.docx",
        },
        "TEMPOSUM": {
            "investigaciones": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/2. Temposum Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades",
            "plantilla": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/2. Temposum Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/4. Procedimientos/GI-FO-020 INVESTIGACION.docx",
        },
        "ASEPLUS": {
            "investigaciones": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/3. Aseplus/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/3.2.2.1. Investigaciones",
            "plantilla": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/3. Aseplus/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/4. Procedimientos/GI-FO-020 INVESTIGACION.docx",
        },
        "ASEL": {
            "investigaciones": "G:/Mi unidad/2. Trabajo/1. SG-SST/19. Asel S.A.S/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/2. Accidentes",
            "plantilla": "G:/Mi unidad/2. Trabajo/1. SG-SST/19. Asel S.A.S/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/4. Procedimientos/A-FR-28 Investigación AT.docx",
        },
    }


def send_progress(step, percentage, message):
    progress = {
        "type": "progress",
        "step": step,
        "percentage": percentage,
        "message": message,
    }
    print(json.dumps(progress, ensure_ascii=False), file=sys.stderr)
    sys.stderr.flush()


def get_normalized_value(data_dict, possible_keys, default="N/A"):
    for key in possible_keys:
        if key in data_dict and data_dict[key] not in ("", None, "N/A"):
            value = str(data_dict[key])
            # 🔧 Limpiar texto extra que el modelo puede agregar después del valor
            # Eliminar todo después de '<' o 'verificaci' o 'POR ESO'
            for marker in ["<", "verificaci", "POR ESO", "---"]:
                if marker in value:
                    value = value.split(marker)[0].strip()
            return value if value else default
    return default


# Normaliza el valor de un campo del FURAT para corregir artefactos del script
# de extracción (Invest_APP_V_3.extract_pdf_data). Misma lógica que el fix
# aplicado en el frontend (investigacion-accidentes-main.js → normalizeFieldValue).
#
# Problemas conocidos en datos crudos:
#   - "No. Identificación": concatenación con dígitos basura del campo siguiente
#     (ej: id="114326350408" 12 dígitos → debería ser "1143263504" 10 dígitos).
#   - "Nombre Completo": el PDF tiene etiqueta "SEGUNDO APELLIDO" como primera
#     línea + 4 partes (1er apellido, 2do apellido, 1er nombre, 2do nombre)
#     a veces separadas por \n y otras por 3+ espacios. Se debe reordenar a
#     "Nombre1 Nombre2 Apellido1 Apellido2".
#   - "Cargo": el PDF antepone categoría de zona (URBANA/RURAL/ADMINISTRATIVO/
#     OPERATIVO/etc.) antes del cargo real. Solo se debe mostrar el cargo real.
def normalize_field_value(key, value):
    if value is None or value == "N/A":
        return value or "N/A"
    s = str(value)

    if key == "No. Identificación":
        # Cédula colombiana: 6-10 dígitos. Si tiene más, descartar del final.
        digits = re.sub(r"\D", "", s)
        if len(digits) > 10 and re.match(r"^\d+$", digits):
            return digits[:10]
        return s

    if key == "Nombre Completo":
        # 1) Separar por saltos de línea Y por secuencias de 3+ espacios
        tokens = re.split(r"\r?\n+|\s{3,}", s)
        tokens = [re.sub(r"\s+", " ", t).strip() for t in tokens]
        tokens = [t for t in tokens if t]
        if not tokens:
            return s
        # 2) Quitar etiqueta "SEGUNDO APELLIDO" si aparece como primer elemento
        label_patterns = re.compile(
            r"^(PRIMER|SEGUNDO|PRIMER/SECUNDARIO|PRIMER\/SEGUNDO)\s+APELLIDO$",
            re.IGNORECASE,
        )
        name_tokens = tokens[1:] if label_patterns.match(tokens[0]) else tokens
        if len(name_tokens) < 2:
            return " ".join(name_tokens)
        # 3) Asumir formato PDF: [Apellidos | Nombres] y mostrar [Nombres | Apellidos]
        half = len(name_tokens) // 2
        apellidos = name_tokens[:half]
        nombres = name_tokens[half:]
        return " ".join(nombres + apellidos)

    if key == "Cargo":
        # Quitar categoría de zona (URBANA/RURAL/ADMINISTRATIVO/OPERATIVO/etc.)
        lines = re.split(r"\r?\n+", s)
        lines = [re.sub(r"\s+", " ", ln).strip() for ln in lines]
        lines = [ln for ln in lines if ln]
        if len(lines) <= 1:
            return s
        zonas = re.compile(
            r"^(URBANA|RURAL|ADMINISTRATIVO?|OPERATIVO?|MIXTA|COMERCIAL|INDUSTRIAL|SERVICIOS?|PRODUCCI[ÓO]N|DIRECCI[ÓO]N|GERENCIA)$",
            re.IGNORECASE,
        )
        filtered = lines[1:] if zonas.match(lines[0]) else lines
        return " ".join(filtered)

    # Otros campos: unir saltos de línea en una sola línea
    if "\n" in s:
        return " ".join(re.sub(r"\s+", " ", ln).strip() for ln in s.split("\n") if ln.strip())
    return s


def preparar_datos_para_plantilla(combined_data):
    logging.info("=== CLAVES RECIBIDAS ===")
    for key, value in combined_data.items():
        logging.info(f"Clave original: '{key}' -> Valor: '{str(value)[:100]}...'")

    # Desanidar datos si tienen estructura anidada (success, data)
    actual_data = combined_data
    if isinstance(combined_data, dict):
        # Si tiene success=True y data, desanidar
        if combined_data.get("success") == True and "data" in combined_data:
            inner_data = combined_data["data"]
            if isinstance(inner_data, dict):
                # Verificar si data tiene campos reales o está anidado
                if inner_data.get("success") == True and "data" in inner_data:
                    # Doble anidamiento, desanidar segundo nivel
                    actual_data = inner_data["data"]
                else:
                    # Un solo nivel de anidamiento
                    actual_data = inner_data
                logging.info(
                    f"Datos desanidados, claves: {list(actual_data.keys()) if isinstance(actual_data, dict) else 'no es dict'}"
                )

    # Usar los datos desanidados
    combined_data = actual_data if isinstance(actual_data, dict) else combined_data

    logging.info("=== DATOS DESANIDADOS ===")
    for key, value in combined_data.items():
        logging.info(f"Campo: '{key}' -> Valor: '{str(value)[:100]}...'")

    key_map = {
        "no_identificacion": [
            "No. Identificación",
            "No. Identificacion",
            "no_identificacion",
            "no identificacion",
        ],
        "nombre_completo": ["Nombre Completo", "nombre_completo", "nombre completo"],
        "fecha_accidente": [
            "Fecha del Accidente",
            "Fecha del Accidente",
            "fecha_accidente",
            "fecha del accidente",
        ],
        "hora_del_accidente": [
            "Hora del Accidente",
            "Hora del Accidente",
            "hora_del_accidente",
            "hora del accidente",
        ],
        "cargo": ["Cargo", "cargo"],
        "tipo_accidente": [
            "Tipo de Accidente",
            "Tipo de Accidente",
            "tipo_accidente",
            "tipo de accidente",
        ],
        "lugar_accidente": [
            "Lugar del Accidente",
            "Lugar del Accidente",
            "lugar_accidente",
            "lugar del accidente",
        ],
        "sitio_ocurrencia": [
            "Sitio de Ocurrencia",
            "Sitio de Ocurrencia",
            "sitio_ocurrencia",
            "sitio de ocurrencia",
        ],
        "tipo_lesion": [
            "Tipo de Lesion",
            "Tipo de Lesión",
            "tipo_lesion",
            "tipo de lesion",
        ],
        "parte_cuerpo_afectada": [
            "Parte del Cuerpo Afectada",
            "parte_cuerpo_afectada",
            "parte del cuerpo afectada",
        ],
        "agente_accidente": [
            "Agente del Accidente",
            "Agente del Accidente",
            "agente_accidente",
            "agente del accidente",
        ],
        "mecanismo_accidente": [
            "Mecanismo o Forma del Accidente",
            "Mecanismo o Forma del Accidente",
            "mecanismo_accidente",
            "mecanismo o forma del accidente",
        ],
        "descripcion_accidente": [
            "Descripcion del Accidente",
            "Descripción del Accidente",
            "descripcion_accidente",
            "descripcion del accidente",
        ],
        "fecha_de_nacimiento": [
            "Fecha de Nacimiento",
            "Fecha de Nacimiento",
            "fecha_de_nacimiento",
            "fecha de nacimiento",
        ],
        "telefono_domicilio": [
            "Telefono Domicilio",
            "Teléfono Domicilio",
            "telefono_domicilio",
            "telefono domicilio",
        ],
        "telefono_celular": [
            "Telefono Celular",
            "Teléfono Celular",
            "telefono_celular",
            "telefono celular",
        ],
        "fecha_de_ingreso": [
            "Fecha de Ingreso a la Empresa",
            "Fecha de Ingreso a la Empresa",
            "fecha_de_ingreso_a_la_empresa",
            "fecha de ingreso a la empresa",
            "fecha_de_ingreso",
        ],
        "jornada_de_trabajo": [
            "Jornada de Trabajo Habitual",
            "Jornada de Trabajo Habitual",
            "jornada_de_trabajo_habitual",
            "jornada de trabajo habitual",
            "jornada_de_trabajo",
        ],
        "experiencia_en_el_cargo": [
            "Tiempo de Ocupacion",
            "Tiempo de Ocupación",
            "tiempo_de_ocupacion",
            "tiempo de ocupacion",
            "experiencia_en_el_cargo",
        ],
        "tipo_de_vinculacion": [
            "Tipo de Vinculacion",
            "Tipo de Vinculación",
            "tipo_de_vinculacion",
            "tipo de vinculacion",
        ],
    }
    normalized_data = {}
    for standard_key, possible_keys in key_map.items():
        normalized_data[standard_key] = get_normalized_value(
            combined_data, possible_keys
        )

    # Aplicar normalización específica a los 3 campos problemáticos del script
    # de extracción (mismo fix que el frontend).
    for std_key, src_key in (
        ("no_identificacion", "No. Identificación"),
        ("nombre_completo", "Nombre Completo"),
        ("cargo", "Cargo"),
    ):
        if normalized_data.get(std_key) and normalized_data[std_key] != "N/A":
            normalized_data[std_key] = normalize_field_value(
                src_key, normalized_data[std_key]
            )
    for key, value in combined_data.items():
        if key not in key_map and key.replace(" ", "_").lower() not in key_map:
            normalized_key = (
                key.lower()
                .replace(" ", "_")
                .replace("á", "a")
                .replace("é", "e")
                .replace("í", "i")
                .replace("ó", "o")
                .replace("ú", "u")
                .replace("ñ", "n")
            )
            if normalized_key not in normalized_data:
                normalized_data[normalized_key] = (
                    str(value) if value is not None else "N/A"
                )
    try:
        fecha_nac_str = normalized_data.get("fecha_de_nacimiento")
        fecha_acc_str = normalized_data.get("fecha_accidente")
        if fecha_nac_str != "N/A" and fecha_acc_str != "N/A":
            fecha_nac, fecha_acc = None, None
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
                try:
                    fecha_nac = datetime.strptime(fecha_nac_str.split()[0], fmt)
                    break
                except (ValueError, TypeError):
                    continue
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
                try:
                    fecha_acc = datetime.strptime(fecha_acc_str.split()[0], fmt)
                    break
                except (ValueError, TypeError):
                    continue
            if fecha_nac and fecha_acc:
                edad = (
                    fecha_acc.year
                    - fecha_nac.year
                    - (
                        (fecha_acc.month, fecha_acc.day)
                        < (fecha_nac.month, fecha_nac.day)
                    )
                )
                normalized_data["edad"] = str(edad)
                logging.info(f"Edad calculada: {edad} años")
            else:
                normalized_data["edad"] = "N/A"
        else:
            normalized_data["edad"] = "N/A"
    except Exception as e:
        normalized_data["edad"] = "N/A"
        logging.error(f"Error al calcular la edad: {e}")
    telefono = get_normalized_value(
        normalized_data, ["telefono_celular", "telefono_domicilio"]
    )
    normalized_data["telefono_celular"] = telefono
    for key in ["fecha_accidente", "fecha_de_ingreso", "fecha_de_nacimiento"]:
        date_str = normalized_data.get(key, "N/A")
        if date_str != "N/A" and "-" in date_str:
            try:
                normalized_data[key] = datetime.strptime(date_str, "%Y-%m-%d").strftime(
                    "%d/%m/%Y"
                )
            except ValueError:
                logging.warning(
                    f"No se pudo re-formatear la fecha '{date_str}' en la clave '{key}'."
                )
    desc = normalized_data.get("descripcion_accidente", "").lower()
    equipo_keywords = [
        "balon",
        "balón",
        "jarra",
        "mesa",
        "equipo",
        "maquina",
        "herramienta",
        "objeto",
        "futbol",
        "pelota",
    ]
    equipo_encontrado = "N/A"
    for keyword in equipo_keywords:
        if keyword in desc:
            match = re.search(rf".{{0,30}}{keyword}.{{0,30}}", desc)
            if match:
                equipo_encontrado = match.group(0).strip()
                break
    normalized_data["equipo_que_operaba_reparaba"] = (
        equipo_encontrado if equipo_encontrado != "N/A" else "No especificado"
    )

    # Extraer análisis si viene en clave 'analysis' (puede estar anidado)
    analysis_data = combined_data.get("analysis", {})
    if isinstance(analysis_data, dict):
        # Desanidar análisis si tiene estructura {success, data: {...}}
        if analysis_data.get("success") == True and "data" in analysis_data:
            inner_data = analysis_data.get("data")
            if isinstance(inner_data, dict):
                analysis_data = inner_data
                logging.info(
                    f"Análisis desanidado desde 'data', claves: {list(analysis_data.keys()) if isinstance(analysis_data, dict) else 'no es dict'}"
                )

        # Agregar las claves del análisis al combined_data para procesarlas
        if isinstance(analysis_data, dict):
            for key, value in analysis_data.items():
                if key not in combined_data:
                    combined_data[key] = value
                    logging.info(f"Agregando desde analysis: '{key}'")

    por_que_levels = ["1", "2", "3", "4", "5"]
    component_map = {
        "mano_obra": ["Mano de Obra", "Mano de obra"],
        "metodo": ["Método", "Metodo"],
        "maquinaria": ["Maquinaria"],
        "medio_ambiente": ["Medio Ambiente", "Medio ambiente"],
        "material": ["Material"],
    }
    for level in por_que_levels:
        por_que_key_variants = [
            f"PorQue{level}",
            f"Por Qué {level}",
            f"Por que {level}",
            f"por_que_{level}",
            f"porque{level}",
        ]
        por_que_data = None
        por_que_key_used = None
        for key_variant in por_que_key_variants:
            if key_variant in combined_data and isinstance(
                combined_data.get(key_variant), dict
            ):
                por_que_data = combined_data.get(key_variant)
                por_que_key_used = key_variant
                break
        if isinstance(por_que_data, dict):
            logging.info(
                f"Procesando 5P Nivel {level} desde clave '{por_que_key_used}'"
            )
            # 🔧 Limpiar el campo causa también
            causa_value = por_que_data.get("causa", "N/A")
            if isinstance(causa_value, str):
                for marker in ["<", "verificaci", "POR ESO", "---"]:
                    if marker in causa_value:
                        causa_value = causa_value.split(marker)[0].strip()
            normalized_data[f"por_que_{level}_causa"] = (
                causa_value if causa_value else "N/A"
            )
            for comp_std, comp_vars in component_map.items():
                flat_key = f"por_que_{level}_{comp_std}"
                normalized_data[flat_key] = get_normalized_value(
                    por_que_data, comp_vars
                )
        else:
            normalized_data[f"por_que_{level}_causa"] = "N/A"
            for comp_std in component_map.keys():
                normalized_data[f"por_que_{level}_{comp_std}"] = "N/A"
    final_keys = [
        "edad",
        "estado_civil",
        "tiempo_en_el_contrato",
        "dia_de_turno",
        "supervisor_inmediato",
        "incidente_con_lesion",
        "incidente_grave",
        "casi_accidente",
        "genero_muerte",
        "dano_a_la_propiedad",
        "recomendacion_1",
        "recomendacion_2",
        "recomendacion_3",
    ]
    for key in final_keys:
        if key not in normalized_data or normalized_data[key] in ("", None, "N/A"):
            normalized_data[key] = ""
    if normalized_data.get("tipo_accidente") != "N/A":
        normalized_data["incidente_con_lesion"] = "X"
    normalized_data["involucrados"] = [
        {
            "nombre_involucrado": normalized_data.get("nombre_completo", "N/A"),
            "cargo": normalized_data.get("cargo", "N/A"),
            "cedula": normalized_data.get("no_identificacion", "N/A"),
            "proceso": "N/A",
            "equipo_involucrado": normalized_data.get(
                "equipo_que_operaba_reparaba", "N/A"
            ),
        }
    ]
    logging.info("=== DATOS NORMALIZADOS Y PROCESADOS ===")
    for key, value in normalized_data.items():
        logging.info(f"Campo final: '{key}' = '{str(value)[:100]}...'")
    logging.info(f"Total de campos preparados: {len(normalized_data)}")
    return normalized_data


def guardar_documento_seguro(doc, preferred_dir, filename):
    """Intenta guardar el documento en el directorio preferido, con un fallback a una ruta local."""
    # Normalizar la ruta: Reemplaza / por \ y limpia barras extras
    preferred_dir = os.path.normpath(preferred_dir.replace("/", "\\"))

    # Construir la ruta completa para verificar su longitud
    full_path_str = os.path.join(preferred_dir, filename)

    # Agregar prefijo para long paths solo si es Windows y la ruta es larga
    if os.name == "nt" and len(full_path_str) > 248:
        # El prefijo se aplica a la ruta ya validada y normalizada
        if not full_path_str.startswith(r"\\?\\"):
            full_path_str = r"\\?\\" + full_path_str

    try:
        # Crear el directorio usando la ruta sin el nombre de archivo
        output_dir = os.path.dirname(full_path_str)
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        # Guardar el documento en la ruta completa (con prefijo si fue necesario)
        output_path = Path(full_path_str)
        logging.info(f"Intentando guardar en la ruta preferida: {output_path}")
        doc.save(str(output_path))  # Usar str() para asegurar compatibilidad
        logging.info(f"Guardado exitoso en: {output_path}")
        return str(output_path)
    except Exception as e1:
        logging.warning(
            f"Fallo al guardar en la ruta preferida '{full_path_str}': {e1}"
        )

    # Lógica de respaldo sin cambios
    try:
        backup_dir = Path.home() / "Documents" / "Informes_Accidentes"
        backup_dir.mkdir(parents=True, exist_ok=True)
        output_path = backup_dir / filename
        logging.info(f"Intentando guardar en la ruta de respaldo: {output_path}")
        doc.save(output_path)
        logging.info(f"Guardado exitoso en la ruta de respaldo: {output_path}")
        return str(output_path)
    except Exception as e2:
        logging.error(f"Fallo crítico al guardar en la ruta de respaldo: {e2}")
        raise e2


def main():
    try:
        if len(sys.argv) < 2:
            raise ValueError("No se proporcionó la ruta del archivo de datos")
        data_path = sys.argv[1]
        send_progress("setup", 10, "Cargando datos...")
        with open(data_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if "combinedData" not in data:
            raise ValueError("No se encontraron 'combinedData' en el archivo JSON")
        combined_data = data["combinedData"]
        empresa = data.get("empresa", "TEMPOACTIVA").upper()
        logging.info(f"Procesando para empresa: {empresa}")
        empresa_config = Config.RUTAS.get(empresa)
        if not empresa_config:
            raise ValueError(f"No se encontró configuración para la empresa: {empresa}")
        template_path = Path(empresa_config.get("plantilla"))
        preferred_output_dir = empresa_config.get("investigaciones")

        # Override de ruta de salida si el usuario la eligió desde el modal
        user_output_dir = data.get("outputDir")
        user_output_filename = data.get("outputFilename")
        if user_output_dir:
            preferred_output_dir = user_output_dir
            logging.info(f"Output dir override desde modal: {preferred_output_dir}")
        if user_output_filename:
            logging.info(f"Output filename override desde modal: {user_output_filename}")

        if not template_path.exists():
            raise FileNotFoundError(f"Plantilla no encontrada en: {template_path}")
        if not preferred_output_dir:
            raise ValueError(
                f"No se encontró configuración de carpeta de salida para la empresa: {empresa}"
            )
        send_progress("rendering", 50, "Renderizando plantilla...")
        normalized_data = preparar_datos_para_plantilla(combined_data)
        logging.info(f"Datos preparados para docxtpl con {len(normalized_data)} campos")
        doc = DocxTemplate(template_path)
        doc.render(normalized_data)
        logging.info("Plantilla renderizada exitosamente")
        send_progress("saving", 80, "Preparando para guardar informe...")
        # --- Nueva lógica para generar nombre de archivo corto y seguro ---
        nombre_completo = normalized_data.get("nombre_completo", "sin_nombre")

        # Procesamiento inteligente del nombre para acortarlo
        name_parts = [
            part.strip() for part in nombre_completo.split("\n") if part.strip()
        ]
        if len(name_parts) > 1:
            # Asume formatos como "SEGUNDO APELLIDO\nAPELLIDO1 APELLIDO2\nNOMBRES" y toma los últimos elementos
            nombre_base = "_".join(name_parts[-2:])
        else:
            # Fallback para nombres en una sola línea
            nombre_base = nombre_completo

        # Sanitización final del nombre
        nombre_sanitizado = (
            re.sub(r"[^\w\s.-]", "", nombre_base).replace(" ", "_").replace("__", "_")
        )

        fecha = datetime.now().strftime("%Y%m%d")

        # Lógica para añadir contador si el archivo ya existe
        if user_output_filename:
            output_filename = user_output_filename
            if not output_filename.lower().endswith(".docx"):
                output_filename += ".docx"
            base_filename = output_filename.rsplit(".docx", 1)[0]
        else:
            base_filename = f"GI-FO-020_INVESTIGACION_{nombre_sanitizado}_{fecha}"
            output_filename = f"{base_filename}.docx"

        # Para la comprobación, usamos una ruta normalizada que Path.exists() pueda manejar
        # La función de guardado se encargará del prefijo \\?\ si es necesario
        check_path = Path(os.path.normpath(preferred_output_dir))

        output_path_check = check_path / output_filename
        counter = 1
        while output_path_check.exists():
            counter += 1
            output_filename = f"{base_filename}_{counter}.docx"
            output_path_check = check_path / output_filename

        logging.info(f"Nombre de archivo final (corto y seguro): {output_filename}")

        final_path = guardar_documento_seguro(
            doc, preferred_output_dir, output_filename
        )
        send_progress("finished", 100, f"Informe guardado en: {final_path}")
        logging.info(f"Informe generado exitosamente: {final_path}")
        result = {
            "success": True,
            "documentPath": final_path,
            "message": "Informe generado correctamente.",
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.stdout.flush()
    except Exception as e:
        error_msg = f"Error general en el proceso: {str(e)}"
        logging.error(error_msg, exc_info=True)
        error_result = {
            "success": False,
            "error": error_msg,
            "traceback": traceback.format_exc(),
        }
        print(json.dumps(error_result, ensure_ascii=False))
        sys.stdout.flush()
        sys.exit(1)


if __name__ == "__main__":
    main()

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
from datetime import datetime

# Configurar logging con codificación explícita para evitar problemas en Windows
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stderr) # Logs van a stderr
    ]
)

class Config:
    # Rutas corregidas con barras normales y sin caracteres especiales problemáticos en cadenas crudas
    RUTAS = {
        "TEMPOACTIVA": {
            "investigaciones": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/2. Accidentes",
            "plantilla": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/4. Procedimientos/GI-FO-020 INVESTIGACION.docx"
        },
        "TEMPOSUM": {
            "investigaciones": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/2. Temposum Est SAS/3. Gestion de la Salud/3.2.2 Investigacion de Accidentes, incidentes y Enfermedades",
            "plantilla": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/2. Temposum Est SAS/3. Gestion de la Salud/3.2.2 Investigacion de Accidentes, incidentes y Enfermedades/4. Procedimientos/GI-FO-020 INVESTIGACION.docx"
        },
        "ASEPLUS": {
            "investigaciones": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/3. Aseplus/3. Gestion de la Salud/3.2.2 Investigacion de Accidentes, incidentes y Enfermedades/3.2.2.1. Investigaciones",
            "plantilla": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/3. Aseplus/3. Gestion de la Salud/3.2.2 Investigacion de Accidentes, incidentes y Enfermedades/4. Procedimientos/GI-FO-020 INVESTIGACION.docx"
        },
        "ASEL": {
            "investigaciones": "G:/Mi unidad/2. Trabajo/1. SG-SST/19. Asel S.A.S/3. Gestion de la Salud/3.2.2 Investigacion de Accidentes, incidentes y Enfermedades/Investigaciones/2. Accidentes",
            "plantilla": "G:/Mi unidad/2. Trabajo/1. SG-SST/19. Asel S.A.S/3. Gestion de la Salud/3.2.2 Investigacion de Accidentes, incidentes y Enfermedades/Investigaciones/4. Procedimientos/GI-FO-020 INVESTIGACION.docx"
        }
    }

def validar_ruta_google_drive(ruta):
    """Valida si la ruta de Google Drive está accesible"""
    try:
        # Limpiar la ruta de caracteres problemáticos específicos observados
        # Reemplazar caracteres de control o corruptos que puedan haber pasado
        ruta_limpia = ruta.encode('utf-8', errors='ignore').decode('utf-8')
        # Reemplazar secuencias específicas observadas en logs
        ruta_limpia = ruta_limpia.replace('\x02', '').replace('\x01', '').replace('\x03', '')
        ruta_path = Path(ruta_limpia)
        
        logging.info(f"Validando ruta: {ruta_limpia}")

        # Verificar si la unidad G: existe en Windows
        if (ruta_limpia.startswith('G:/') or ruta_limpia.startswith('G:\\')) and os.name == 'nt':
            import subprocess
            try:
                # Verificar si G: está montada
                result = subprocess.run(['wmic', 'logicaldisk', 'get', 'caption'], capture_output=True, text=True, timeout=10)
                if result.returncode != 0:
                    logging.warning("No se pudo ejecutar wmic para verificar unidades")
                elif 'G:' not in result.stdout:
                    logging.warning("La unidad G: (Google Drive) no está montada")
                    return False, "Google Drive no está montado"
            except Exception as e:
                logging.warning(f"No se pudo verificar la unidad G: {e}")
                # No retornamos False aquí, solo advertimos, ya que guardar_documento_seguro manejará el respaldo
        
        # Verificar si podemos acceder al directorio o crearlo
        if not ruta_path.exists():
            try:
                ruta_path.mkdir(parents=True, exist_ok=True)
                logging.info(f"Directorio creado o verificado: {ruta_limpia}")
            except Exception as mkdir_error:
                logging.warning(f"No se pudo crear el directorio {ruta_limpia}: {mkdir_error}")
                return False, f"No se puede crear el directorio: {mkdir_error}"
        else:
             logging.info(f"Directorio ya existe: {ruta_limpia}")
        
        # Verificar permisos de escritura con un archivo de prueba
        test_file = ruta_path / ".sgsst_test_write_access.tmp"
        try:
            test_file.write_text("test")
            test_file.unlink()
            logging.info("Permisos de escritura verificados")
        except Exception as perm_error:
            logging.warning(f"Problemas de permisos en {ruta_limpia}: {perm_error}")
            return False, f"Problemas de permisos: {perm_error}"
        
        return True, ruta_limpia
    except Exception as e:
        logging.error(f"Error validando ruta {ruta}: {e}", exc_info=True)
        return False, str(e)

def send_progress(step, percentage, message):
    """Envía progreso al stderr para no interferir con la salida JSON principal"""
    progress = {
        "type": "progress",
        "step": step,
        "percentage": percentage,
        "message": message
    }
    # Enviar progreso a stderr
    print(json.dumps(progress, ensure_ascii=False), file=sys.stderr)
    sys.stderr.flush()

def preparar_datos_para_plantilla(combined_data):
    """Prepara y normaliza todos los datos necesarios para la plantilla"""
    
    logging.info("=== CLAVES RECIBIDAS ===")
    for key, value in combined_data.items():
        logging.info(f"Clave original: '{key}' -> Valor: '{str(value)[:100]}...'")

    # --- PASO 1: Mapeo Inicial de Claves Simples ---
    # Este mapeo es para claves directas que no requieren procesamiento especial
    key_mapping_simple = {
        # Datos del accidente
        'no_identificacion': 'no_identificacion',
        'nombre_completo': 'nombre_completo',
        'fecha_accidente': 'fecha_accidente',
        'hora_del_accidente': 'hora_del_accidente',
        'cargo': 'cargo',
        'tipo_accidente': 'tipo_accidente',
        'lugar_accidente': 'lugar_accidente',
        'sitio_ocurrencia': 'sitio_ocurrencia',
        'tipo_lesion': 'tipo_lesion',
        'parte_cuerpo_afectada': 'parte_cuerpo_afectada',
        'agente_accidente': 'agente_accidente',
        'mecanismo_accidente': 'mecanismo_accidente',
        'descripcion_accidente': 'descripcion_accidente',
        
        # Clasificación del incidente
        'incidente_con_lesion': 'incidente_con_lesion',
        'incidente_grave': 'incidente_grave',
        'casi_accidente': 'casi_accidente',
        'genero_muerte': 'genero_muerte',
        'dano_a_la_propiedad': 'dano_a_la_propiedad',
        
        # Recomendaciones
        'recomendacion_1': 'recomendacion_1',
        'recomendacion_2': 'recomendacion_2',
        'recomendacion_3': 'recomendacion_3',
        
        # Datos personales potenciales (si vienen del PDF del trabajador)
        'fecha_de_nacimiento': 'fecha_de_nacimiento',
        'telefono_domicilio': 'telefono_domicilio',
        'fecha_de_ingreso_a_la_empresa': 'fecha_de_ingreso',
        'tiempo_de_ocupacion_habitual_al_momento_del_accidente': 'tiempo_de_ocupacion',
        'jornada_de_trabajo_habitual': 'jornada_de_trabajo',
        'tipo_de_vinculacion': 'tipo_de_vinculacion',
    }
    
    # Normalizar datos existentes simples
    normalized_data = {}
    for k, v in combined_data.items():
        # Normalizar la clave
        # Primero, intentamos mapear con el key_mapping_simple usando la clave original
        mapped_k = key_mapping_simple.get(k, None)
        if mapped_k is None:
            # Si no se encuentra, normalizamos la clave original
            lower_k = k.lower().replace(' ', '_').replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u').replace('ñ', 'n')
            # Intentamos mapear la clave normalizada
            mapped_k = key_mapping_simple.get(lower_k, lower_k)
        
        # Normalizar el valor
        normalized_data[mapped_k] = str(v) if v is not None else 'N/A'
        logging.debug(f"Mapeo simple: '{k}' -> '{mapped_k}' = '{normalized_data[mapped_k]}'")

    # --- PASO 2: INFERENCIA Y CÁLCULO DE DATOS ADICIONALES ---
    
    # Función auxiliar para manejar claves con caracteres corruptos
    def get_normalized_value(data_dict, possible_keys, default='N/A'):
        """Busca un valor usando múltiples claves posibles, incluyendo versiones corruptas."""
        for key in possible_keys:
            if key in data_dict and data_dict[key] not in ('', None, 'N/A'):
                return str(data_dict[key])
        return default

    # 1. Calcular Edad
    try:
        # Buscar posibles claves para fecha de nacimiento
        fecha_nac_keys = ['fecha_de_nacimiento']
        fecha_nac_str = get_normalized_value(normalized_data, fecha_nac_keys)
        fecha_acc_str = normalized_data.get('fecha_accidente')
        
        if fecha_nac_str and fecha_acc_str and fecha_nac_str != 'N/A' and fecha_acc_str != 'N/A':
            # Limpiar posibles duplicados en la fecha (como en el PDF de ejemplo)
            fecha_nac_str_clean = fecha_nac_str.split()[0] if fecha_nac_str else ''
            fecha_acc_str_clean = fecha_acc_str.split()[0] if fecha_acc_str else ''
            
            # Asumimos formato DD/MM/YYYY o YYYY-MM-DD para ambas fechas
            fecha_nac = None
            fecha_acc = None
            for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
                try:
                    fecha_nac = datetime.strptime(fecha_nac_str_clean, fmt)
                    break
                except ValueError:
                    continue
            for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
                try:
                    fecha_acc = datetime.strptime(fecha_acc_str_clean, fmt)
                    break
                except ValueError:
                    continue
            
            if fecha_nac and fecha_acc:
                edad = fecha_acc.year - fecha_nac.year - ((fecha_acc.month, fecha_acc.day) < (fecha_nac.month, fecha_nac.day))
                normalized_data['edad'] = str(edad)
                logging.info(f"Edad calculada: {edad} años (Nac: {fecha_nac_str_clean}, Acc: {fecha_acc_str_clean})")
            else:
                normalized_data['edad'] = 'N/A'
                logging.warning(f"No se pudo parsear una de las fechas para calcular la edad. Fecha Nac: {fecha_nac_str_clean}, Fecha Acc: {fecha_acc_str_clean}")
        else:
            normalized_data['edad'] = 'N/A'
            logging.info("No se encontraron datos suficientes para calcular la edad.")
    except Exception as e:
        normalized_data['edad'] = 'N/A'
        logging.error(f"Error al calcular la edad: {e}")

    # 2. Mapear Teléfono Domicilio a Teléfono/Celular
    telefono_keys = ['telefono_domicilio', 'telefono/celular', 'telefono_celular', 'teléfono_domicilio']
    normalized_data['telefono_celular'] = get_normalized_value(normalized_data, telefono_keys)

    # 3. Mapear Tiempo de Ocupación a Experiencia en el Cargo
    ocupacion_keys = ['tiempo_de_ocupacion', 'tiempo_de_ocupacion_habitual_al_momento_del_accidente', 'experiencia_en_el_cargo']
    normalized_data['experiencia_en_el_cargo'] = get_normalized_value(normalized_data, ocupacion_keys)

    # 4. Mapear Fecha de Ingreso a Tiempo en el Contrato
    ingreso_keys = ['fecha_de_ingreso', 'fecha_de_ingreso_a_la_empresa']
    normalized_data['tiempo_en_el_contrato'] = get_normalized_value(normalized_data, ingreso_keys)
    normalized_data['fecha_de_ingreso'] = get_normalized_value(normalized_data, ingreso_keys) # En caso de que se necesite directamente

    # 5. Mapear Jornada de Trabajo a Día de Turno
    jornada_keys = ['jornada_de_trabajo', 'jornada_de_trabajo_habitual']
    normalized_data['dia_de_turno'] = get_normalized_value(normalized_data, jornada_keys)
    normalized_data['jornada_de_trabajo'] = get_normalized_value(normalized_data, jornada_keys)

    # 6. Inferir Equipo que Operaba/Reparaba
    equipo_actual = normalized_data.get('equipo_que_operaba_reparaba', 'N/A')
    if equipo_actual in ('N/A', ''):
        desc = normalized_data.get('descripcion_accidente', '').lower()
        equipo_encontrado = 'N/A'
        # Palabras clave más específicas del contexto del accidente
        equipo_keywords = ["balon", "balón", "jarra", "mesa", "equipo", "maquina", "herramienta", "objeto"]
        for keyword in equipo_keywords:
            if keyword in desc:
                # Capitalizar la primera letra
                equipo_encontrado = keyword[0].upper() + keyword[1:] if len(keyword) > 1 else keyword.upper()
                break
        normalized_data['equipo_que_operaba_reparaba'] = equipo_encontrado
        logging.info(f"Equipo inferido: {equipo_encontrado}")
    # Si ya tenía un valor, lo dejamos.

    # 7. Mapeo de Tipo de Vinculación a Estado Civil (si es relevante o se desea)
    # Nota: 'Tipo de Vinculación' (ej: Misión) no es 'Estado Civil' (ej: Soltero).
    # Se deja como 'N/A' o se puede usar el valor directo si se considera apropiado.
    vinculacion_keys = ['tipo_de_vinculacion']
    # Opción 1: Dejar como 'N/A'
    # normalized_data['estado_civil'] = 'N/A'
    # Opción 2: Usar tipo_de_vinculacion si se desea mostrar algo
    vinculacion_value = get_normalized_value(normalized_data, vinculacion_keys, 'N/A')
    if vinculacion_value != 'N/A':
        normalized_data['estado_civil'] = vinculacion_value
    else:
        normalized_data['estado_civil'] = 'N/A'

    # 8. Supervisor Inmediato (dejar como 'N/A' como solicitaste)
    normalized_data['supervisor_inmediato'] = 'N/A'
    
    # --- PASO 3: Mapeo Especial de Análisis 5 Porqués ---
    # Esta es la parte crítica corregida. Buscamos las claves originales en combined_data
    # y creamos las variables planas requeridas por la plantilla.
    
    por_que_levels = ['1', '2', '3', '4', '5']
    por_que_components = ['mano_obra', 'metodo', 'maquinaria', 'medio_ambiente', 'material']

    for level in por_que_levels:
        # Buscar las claves posibles para este nivel en combined_data original
        # Incluimos variaciones observadas en logs y datos reales
        possible_original_keys = [
            f'Por Qué {level}',      # Formato ideal
            f'Por Qu {level}',      # Formato con caracter corrupto 
            f'Por Qu {level}',       # Otra posible corrupción (observada en logs)
            f'Por Que {level}',      # Sin acento
            f'por qué {level}',      # Minúsculas
            f'por_qué_{level}',      # Ya normalizado
            f'por_que_{level}'       # Ya normalizado
        ]
        
        por_que_data = None
        found_original_key = None
        # Buscar en combined_data (los datos originales) la clave que contiene los datos 5P
        for orig_key in possible_original_keys:
            if orig_key in combined_data and isinstance(combined_data[orig_key], dict):
                por_que_data = combined_data[orig_key]
                found_original_key = orig_key
                logging.info(f"Encontrado 5P nivel {level} con clave original '{orig_key}': {list(por_que_data.keys())}")
                break
        
        if por_que_data:
            # Mapear componentes con nombres más flexibles, incluyendo versiones corruptas
            # Este mapeo conecta lo que puede venir en el dict anidado con las variables planas
            component_mapping = {
                'mano_obra': ['Mano de Obra', 'Mano de obra', 'mano de obra', 'Mano de Obra', 'mano_de_obra'],
                'metodo': ['Método', 'Mtodo', 'Metodo', 'método', 'mtodo', 'metodo'],
                'maquinaria': ['Maquinaria', 'Maquinaria', 'maquinaria'],
                'medio_ambiente': ['Medio Ambiente', 'Medio ambiente', 'Medio ambiente', 'medio ambiente', 'medio_ambiente'],
                'material': ['Material', 'material']
            }
            
            for component in por_que_components:
                found_value = 'N/A'
                
                # Buscar el valor con diferentes variaciones de nombre en el dict anidado
                for possible_name in component_mapping.get(component, [component]):
                    for data_key, data_value in por_que_data.items():
                        # Comparar normalizando ambas partes para ser más tolerantes
                        norm_data_key = data_key.strip().lower().replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
                        norm_possible_name = possible_name.strip().lower().replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
                        if norm_data_key == norm_possible_name:
                            found_value = str(data_value) if data_value is not None else 'N/A'
                            logging.info(f"Mapeado 5P: nivel {level}, componente {component} = '{found_value}' (de '{data_key}')")
                            break
                    if found_value != 'N/A':
                        break # Salir del loop si ya encontramos el valor
                
                # Crear la clave plana requerida por la plantilla
                flat_key = f'por_que_{level}_{component}'
                normalized_data[flat_key] = found_value
                # logging.debug(f"Variable final creada: {flat_key} = {normalized_data[flat_key]}")
        else:
            logging.warning(f"No se encontró datos válidos para 5P nivel {level} con ninguna de las claves posibles: {possible_original_keys}")
            # Asegurar que las variables planas estén como 'N/A' si no se encontraron datos
            for component in por_que_components:
                flat_key = f'por_que_{level}_{component}'
                normalized_data[flat_key] = 'N/A'
                # logging.debug(f"Variable final N/A creada: {flat_key} = {normalized_data[flat_key]}")

    # --- PASO 4: Asegurar Valores por Defecto para Campos Requeridos ---
    # Aunque ya hemos intentado mapear/inferir, aseguramos que todas las claves requeridas por la plantilla estén presentes
    required_defaults = {
        # Datos personales
        'edad': 'N/A',
        'estado_civil': 'N/A',
        'telefono_celular': 'N/A',
        'tiempo_en_el_contrato': 'N/A',
        'experiencia_en_el_cargo': 'N/A',
        'dia_de_turno': 'N/A',
        'equipo_que_operaba_reparaba': 'N/A',
        'supervisor_inmediato': 'N/A',
        
        # Datos del accidente (ya deberían estar, pero por si acaso)
        'nombre_completo': normalized_data.get('nombre_completo', 'N/A'),
        'no_identificacion': normalized_data.get('no_identificacion', 'N/A'),
        'cargo': normalized_data.get('cargo', 'N/A'),
        'fecha_accidente': normalized_data.get('fecha_accidente', 'N/A'),
        'hora_del_accidente': normalized_data.get('hora_del_accidente', 'N/A'),
        'lugar_accidente': normalized_data.get('lugar_accidente', 'N/A'),
        'sitio_ocurrencia': normalized_data.get('sitio_ocurrencia', 'N/A'),
        'tipo_accidente': normalized_data.get('tipo_accidente', 'N/A'),
        'agente_accidente': normalized_data.get('agente_accidente', 'N/A'),
        'mecanismo_accidente': normalized_data.get('mecanismo_accidente', 'N/A'),
        'tipo_lesion': normalized_data.get('tipo_lesion', 'N/A'),
        'parte_cuerpo_afectada': normalized_data.get('parte_cuerpo_afectada', 'N/A'),
        'descripcion_accidente': normalized_data.get('descripcion_accidente', 'N/A'),
        
        # Clasificación del incidente (ya deberían estar)
        'incidente_con_lesion': normalized_data.get('incidente_con_lesion', 'X'), # Por defecto 'X' para accidente con lesión
        'incidente_grave': normalized_data.get('incidente_grave', ''),
        'casi_accidente': normalized_data.get('casi_accidente', ''),
        'genero_muerte': normalized_data.get('genero_muerte', ''),
        'dano_a_la_propiedad': normalized_data.get('dano_a_la_propiedad', ''),
        
        # Recomendaciones (ya deberían estar)
        'recomendacion_1': normalized_data.get('recomendacion_1', 'N/A'),
        'recomendacion_2': normalized_data.get('recomendacion_2', 'N/A'),
        'recomendacion_3': normalized_data.get('recomendacion_3', 'N/A'),
    }
    
    # Asegurar que todos los valores requeridos estén presentes
    for key, value in required_defaults.items():
        if key not in normalized_data or normalized_data[key] in ('', None):
            normalized_data[key] = value
            # logging.debug(f"Valor por defecto aplicado: {key} = {value}")

    # --- PASO 5: Manejar tablas (como antes) ---
    normalized_data['involucrados'] = [
        {
            'nombre_involucrado': normalized_data.get('nombre_completo', 'N/A'),
            'cargo': normalized_data.get('cargo', 'N/A'),
            'cedula': normalized_data.get('no_identificacion', 'N/A'),
            'proceso': 'N/A',
            'equipo_involucrado': normalized_data.get('equipo_que_operaba_reparaba', 'N/A')
        }
    ]
    
    logging.info(f"=== DATOS NORMALIZADOS Y PROCESADOS ===")
    # Log solo algunas claves para no saturar, excluyendo las muchas claves 5P
    keys_to_log = [k for k in normalized_data.keys() if not k.startswith('por_que_') or k.endswith('_mano_obra')]
    for key in keys_to_log:
        logging.info(f"Campo final: '{key}' = '{str(normalized_data[key])[:100]}...'")
    
    logging.info(f"Total de campos preparados: {len(normalized_data)}")
    return normalized_data

def guardar_documento_seguro(doc, output_dir, filename):
    """Guarda el documento con múltiples intentos y verificaciones"""
    
    # Intento 1: Ruta original (limpia)
    try:
        # Limpiar la ruta de salida de caracteres problemáticos antes de usarla
        output_dir_path = Path(output_dir.encode('utf-8', errors='ignore').decode('utf-8'))
        output_dir_path = Path(str(output_dir_path).replace('\x02', '').replace('\x01', '').replace('\x03', ''))
        
        output_path = output_dir_path / filename
        logging.info(f"Intentando guardar en: {output_path}")
        
        # Verificar que el directorio padre exista
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Intentar guardar
        doc.save(str(output_path))
        if output_path.exists():
            logging.info(f"Guardado exitoso en intento 1: {output_path}")
            return str(output_path)
    except Exception as e1:
        logging.warning(f"Intento 1 fallido: {e1}")

    # Intento 2: Ruta con codificación limpia y nombre de archivo limpio
    try:
        # Limpiar nombre de archivo
        clean_filename = re.sub(r'[^\w\s.-]', '', filename).replace(' ', '_')
        output_path = output_dir_path / clean_filename
        logging.info(f"Intentando guardar (limpio) en: {output_path}")
        
        doc.save(str(output_path))
        if output_path.exists():
            logging.info(f"Guardado exitoso en intento 2: {output_path}")
            return str(output_path)
    except Exception as e2:
        logging.warning(f"Intento 2 fallido: {e2}")

    # Intento 3: Ruta local de respaldo
    try:
        backup_dir = Path.home() / "Documents" / "Informes_Accidentes"
        backup_dir.mkdir(parents=True, exist_ok=True)
        output_path = backup_dir / clean_filename
        logging.info(f"Intentando guardar (respaldo) en: {output_path}")
        
        doc.save(str(output_path))
        logging.info(f"Guardado exitoso en intento 3 (respaldo): {output_path}")
        return str(output_path)
    except Exception as e3:
        logging.error(f"Todos los intentos fallaron: {e3}")
        raise e3

def main():
    try:
        if len(sys.argv) < 2:
            error_msg = "No se proporcionó la ruta del archivo de datos"
            logging.error(error_msg)
            print(json.dumps({"success": False, "error": error_msg}, ensure_ascii=False), file=sys.stderr)
            sys.exit(1)

        data_path = sys.argv[1]
        output_base_dir = sys.argv[2] if len(sys.argv) > 2 else None
        
        send_progress("setup", 10, "Cargando datos...")
        
        # Verificar que el archivo de datos existe
        data_path_obj = Path(data_path)
        if not data_path_obj.exists():
            error_msg = f"Archivo de datos no encontrado: {data_path}"
            logging.error(error_msg)
            print(json.dumps({"success": False, "error": error_msg}, ensure_ascii=False), file=sys.stderr)
            sys.exit(1)
        
        with open(data_path_obj, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'combinedData' not in data:
            error_msg = "No se encontraron 'combinedData' en el archivo JSON"
            logging.error(error_msg)
            print(json.dumps({"success": False, "error": error_msg}, ensure_ascii=False), file=sys.stderr)
            sys.exit(1)
        
        combined_data = data['combinedData']
        empresa = data.get('empresa', 'TEMPOACTIVA').upper()
        logging.info(f"Procesando para empresa: {empresa}")

        # Obtener rutas desde la configuración
        empresa_config = Config.RUTAS.get(empresa)
        if not empresa_config:
            error_msg = f"No se encontró configuración para la empresa: {empresa}"
            logging.error(error_msg)
            print(json.dumps({"success": False, "error": error_msg}, ensure_ascii=False), file=sys.stderr)
            sys.exit(1)
            
        template_path = empresa_config.get('plantilla')
        config_output_dir = empresa_config.get('investigaciones')

        # Usar el directorio de salida proporcionado o el de configuración
        if output_base_dir:
            output_dir = output_base_dir
            send_progress("setup", 15, f"Usando directorio de salida proporcionado: {output_dir}")
        else:
            output_dir = config_output_dir
            send_progress("setup", 15, f"Usando directorio de configuración: {output_dir}")

        if not template_path:
            error_msg = f"No se encontró configuración de plantilla para la empresa: {empresa}"
            logging.error(error_msg)
            print(json.dumps({"success": False, "error": error_msg}, ensure_ascii=False), file=sys.stderr)
            sys.exit(1)
            
        if not output_dir:
            error_msg = f"No se encontró configuración de carpeta de salida para la empresa: {empresa}"
            logging.error(error_msg)
            print(json.dumps({"success": False, "error": error_msg}, ensure_ascii=False), file=sys.stderr)
            sys.exit(1)

        # Verificar que la plantilla existe
        template_path_obj = Path(template_path)
        if not template_path_obj.exists():
            error_msg = f"Plantilla no encontrada en: {template_path}"
            logging.error(error_msg)
            print(json.dumps({"success": False, "error": error_msg}, ensure_ascii=False), file=sys.stderr)
            sys.exit(1)

        # Verificar acceso al directorio de salida
        is_accessible, access_result = validar_ruta_google_drive(output_dir)
        if not is_accessible:
            logging.warning(f"Problema con directorio de salida: {access_result}. Continuando con estrategia de respaldo.")
            # No salimos, guardar_documento_seguro manejará el respaldo

        send_progress("rendering", 50, "Renderizando plantilla...")
        
        # Preparar datos para la plantilla
        normalized_data = preparar_datos_para_plantilla(combined_data)
        logging.info(f"Datos preparados para docxtpl con {len(normalized_data)} campos")
        
        # Cargar y renderizar la plantilla
        try:
            doc = DocxTemplate(str(template_path_obj))
            doc.render(normalized_data)
            logging.info("Plantilla renderizada exitosamente")
        except Exception as render_error:
            error_msg = f"Error al renderizar la plantilla: {render_error}"
            logging.error(error_msg, exc_info=True)
            print(json.dumps({"success": False, "error": error_msg}, ensure_ascii=False), file=sys.stderr)
            sys.exit(1)

        # Guardar el documento
        send_progress("saving", 80, "Preparando para guardar informe...")
        
        # Crear nombre de archivo sanitizado
        nombre_sanitizado = re.sub(r'[^\w\s-]', '', normalized_data.get('nombre_completo', 'sin_nombre')).replace(' ', '_')
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_filename = f"GI-FO-020_INVESTIGACION_{nombre_sanitizado}_{timestamp}.docx"
        
        logging.info(f"Nombre de archivo: {output_filename}")
        
        try:
            final_path = guardar_documento_seguro(doc, output_dir, output_filename)
            
            send_progress("finished", 100, f"Informe guardado en: {final_path}")
            logging.info(f"Informe generado exitosamente: {final_path}")
            
            # CRÍTICO: Esta es la salida principal que el proceso padre espera
            # VA A STDOUT PARA QUE ELECTRON LA PUEDA LEER
            result = {
                "success": True,
                "documentPath": final_path,
                "message": "Informe generado correctamente."
            }
            # Asegurar que la salida JSON vaya a stdout sin caracteres adicionales y se fuerze la escritura
            print(json.dumps(result, ensure_ascii=False))
            sys.stdout.flush()
            
        except Exception as save_error:
            error_msg = f"Error crítico al guardar informe: {str(save_error)}"
            logging.error(error_msg, exc_info=True)
            error_result = {"success": False, "error": error_msg}
            print(json.dumps(error_result, ensure_ascii=False)) # A stdout
            sys.stdout.flush()
            sys.exit(1)

    except Exception as e:
        error_msg = f"Error general en el proceso: {str(e)}"
        logging.error(error_msg, exc_info=True)
        error_result = {"success": False, "error": error_msg}
        print(json.dumps(error_result, ensure_ascii=False)) # A stdout
        sys.stdout.flush()
        sys.exit(1)

if __name__ == "__main__":
    main()
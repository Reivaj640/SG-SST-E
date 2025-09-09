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

# Configurar logging con codificación explícita para evitar problemas en Windows
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)]
)

class Config:
    RUTAS = {
        "TEMPOACTIVA": {
            "investigaciones": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/2. Accidentes",
            "plantilla": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/4. Procedimientos/GI-FO-020 INVESTIGACION.docx"
        },
        "TEMPOSUM": {
            "investigaciones": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/2. Temposum Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades",
            "plantilla": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/2. Temposum Est SAS/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/4. Procedimientos/GI-FO-020 INVESTIGACION.docx"
        },
        "ASEPLUS": {
            "investigaciones": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/3. Aseplus/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/3.2.2.1. Investigaciones",
            "plantilla": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/3. Aseplus/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/4. Procedimientos/GI-FO-020 INVESTIGACION.docx"
        },
        "ASEL": {
            "investigaciones": "G:/Mi unidad/2. Trabajo/1. SG-SST/19. Asel S.A.S/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/2. Accidentes",
            "plantilla": "G:/Mi unidad/2. Trabajo/1. SG-SST/19. Asel S.A.S/3. Gestión de la Salud/3.2.2 Investigación de Accidentes, incidentes y Enfermedades/Investigaciones/4. Procedimientos/GI-FO-020 INVESTIGACION.docx"
        }
    }

def validar_ruta_google_drive(ruta):
    try:
        ruta_limpia = ruta.encode('utf-8', errors='ignore').decode('utf-8')
        ruta_limpia = ruta_limpia.replace('\x02', '').replace('\x01', '').replace('\x03', '')
        ruta_path = Path(ruta_limpia)
        logging.info(f"Validando ruta: {ruta_limpia}")

        if not ruta_path.exists():
            try:
                ruta_path.mkdir(parents=True, exist_ok=True)
                logging.info(f"Directorio creado o verificado: {ruta_limpia}")
            except Exception as mkdir_error:
                logging.warning(f"No se pudo crear el directorio {ruta_limpia}: {mkdir_error}")
                return False, f"No se puede crear el directorio: {mkdir_error}"
        else:
            logging.info(f"Directorio ya existe: {ruta_limpia}")

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
    progress = {
        "type": "progress",
        "step": step,
        "percentage": percentage,
        "message": message
    }
    print(json.dumps(progress, ensure_ascii=False), file=sys.stderr)
    sys.stderr.flush()

def get_normalized_value(data_dict, possible_keys, default='N/A'):
    for key in possible_keys:
        if key in data_dict and data_dict[key] not in ('', None, 'N/A'):
            return str(data_dict[key])
    return default

def preparar_datos_para_plantilla(combined_data):
    logging.info("=== CLAVES RECIBIDAS ===")
    for key, value in combined_data.items():
        logging.info(f"Clave original: '{key}' -> Valor: '{str(value)[:100]}...'")

    # --- PASO 1: Normalización robusta de claves ---
    # Mapeo de posibles claves de entrada a una clave interna estándar
    key_map = {
        'no_identificacion': ['No. Identificación', 'no_identificacion', 'no identificacion'],
        'nombre_completo': ['Nombre Completo', 'nombre_completo', 'nombre completo'],
        'fecha_accidente': ['Fecha del Accidente', 'fecha_accidente', 'fecha del accidente'],
        'hora_del_accidente': ['Hora del Accidente', 'hora_del_accidente', 'hora del accidente'],
        'cargo': ['Cargo', 'cargo'],
        'tipo_accidente': ['Tipo de Accidente', 'tipo_accidente', 'tipo de accidente'],
        'lugar_accidente': ['Lugar del Accidente', 'lugar_accidente', 'lugar del accidente'],
        'sitio_ocurrencia': ['Sitio de Ocurrencia', 'sitio_ocurrencia', 'sitio de ocurrencia'],
        'tipo_lesion': ['Tipo de Lesion', 'tipo_lesion', 'tipo de lesion'],
        'parte_cuerpo_afectada': ['Parte del Cuerpo Afectada', 'parte_cuerpo_afectada', 'parte del cuerpo afectada'],
        'agente_accidente': ['Agente del Accidente', 'agente_accidente', 'agente del accidente'],
        'mecanismo_accidente': ['Mecanismo o Forma del Accidente', 'mecanismo_accidente', 'mecanismo o forma del accidente'],
        'descripcion_accidente': ['Descripcion del Accidente', 'descripcion_accidente', 'descripcion del accidente'],
        'fecha_de_nacimiento': ['Fecha de Nacimiento', 'fecha_de_nacimiento', 'fecha de nacimiento'],
        'telefono_domicilio': ['Telefono Domicilio', 'telefono_domicilio', 'telefono domicilio'],
        'telefono_celular': ['Telefono Celular', 'telefono_celular', 'telefono celular'],
        'fecha_de_ingreso': ['Fecha de Ingreso a la Empresa', 'fecha_de_ingreso_a_la_empresa', 'fecha de ingreso a la empresa', 'fecha_de_ingreso'],
        'jornada_de_trabajo': ['Jornada de Trabajo Habitual', 'jornada_de_trabajo_habitual', 'jornada de trabajo habitual', 'jornada_de_trabajo'],
        'experiencia_en_el_cargo': ['Tiempo de Ocupacion', 'tiempo_de_ocupacion', 'tiempo de ocupacion', 'experiencia_en_el_cargo'],
        'tipo_de_vinculacion': ['Tipo de Vinculacion', 'tipo_de_vinculacion', 'tipo de vinculacion'],
    }

    normalized_data = {}
    # Llenar normalized_data usando el key_map
    for standard_key, possible_keys in key_map.items():
        normalized_data[standard_key] = get_normalized_value(combined_data, possible_keys)

    # Copiar datos que no están en el mapeo principal (como los 5 porqués)
    for key, value in combined_data.items():
        if key not in key_map and key.replace(' ', '_').lower() not in key_map:
             # Normalizar clave antes de insertarla si no es una de las estándar
            normalized_key = key.lower().replace(' ', '_').replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u').replace('ñ', 'n')
            if normalized_key not in normalized_data:
                 normalized_data[normalized_key] = str(value) if value is not None else 'N/A'

    # --- PASO 2: Procesamiento y enriquecimiento de datos ---

    # 2.1. Calcular Edad
    try:
        fecha_nac_str = normalized_data.get('fecha_de_nacimiento')
        fecha_acc_str = normalized_data.get('fecha_accidente')
        if fecha_nac_str != 'N/A' and fecha_acc_str != 'N/A':
            fecha_nac = None
            fecha_acc = None
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
                edad = fecha_acc.year - fecha_nac.year - ((fecha_acc.month, fecha_acc.day) < (fecha_nac.month, fecha_nac.day))
                normalized_data['edad'] = str(edad)
                logging.info(f"Edad calculada: {edad} años")
            else:
                normalized_data['edad'] = 'N/A'
        else:
            normalized_data['edad'] = 'N/A'
    except Exception as e:
        normalized_data['edad'] = 'N/A'
        logging.error(f"Error al calcular la edad: {e}")

    # 2.2. Unificar Teléfono
    telefono = get_normalized_value(normalized_data, ['telefono_celular', 'telefono_domicilio'])
    normalized_data['telefono_celular'] = telefono

    # 2.3. Formatear Fechas a DD/MM/YYYY
    for key in ['fecha_accidente', 'fecha_de_ingreso', 'fecha_de_nacimiento']:
        date_str = normalized_data.get(key, 'N/A')
        if date_str != 'N/A' and '-' in date_str: # Asume que si hay guion es AAAA-MM-DD
            try:
                normalized_data[key] = datetime.strptime(date_str, '%Y-%m-%d').strftime('%d/%m/%Y')
            except ValueError:
                logging.warning(f"No se pudo re-formatear la fecha '{date_str}' en la clave '{key}'.")

    # 2.4. Inferir equipo que operaba
    desc = normalized_data.get('descripcion_accidente', '').lower()
    equipo_keywords = ["balon", "balón", "jarra", "mesa", "equipo", "maquina", "herramienta", "objeto", "futbol", "pelota"]
    equipo_encontrado = 'N/A'
    for keyword in equipo_keywords:
        if keyword in desc:
            match = re.search(rf'.{{0,30}}{keyword}.{{0,30}}', desc)
            if match:
                equipo_encontrado = match.group(0).strip()
                break
    normalized_data['equipo_que_operaba_reparaba'] = equipo_encontrado if equipo_encontrado != 'N/A' else 'No especificado'

    # --- PASO 3: Mapeo de Análisis 5 Porqués ---
    por_que_levels = ['1', '2', '3', '4', '5']
    por_que_components = ['mano_obra', 'metodo', 'maquinaria', 'medio_ambiente', 'material']
    component_map = {
        'mano_obra': ['Mano de Obra', 'Mano de obra'],
        'metodo': ['Método', 'Metodo'],
        'maquinaria': ['Maquinaria'],
        'medio_ambiente': ['Medio Ambiente', 'Medio ambiente'],
        'material': ['Material']
    }

    for level in por_que_levels:
        por_que_key_orig = f'Por Qué {level}'
        por_que_data = combined_data.get(por_que_key_orig)

        if isinstance(por_que_data, dict):
            logging.info(f"Procesando 5P Nivel {level} desde clave '{por_que_key_orig}'")
            # Causa principal
            normalized_data[f'por_que_{level}_causa'] = por_que_data.get('causa', 'N/A')
            # Componentes 5M
            for comp_std, comp_vars in component_map.items():
                flat_key = f'por_que_{level}_{comp_std}'
                normalized_data[flat_key] = get_normalized_value(por_que_data, comp_vars)
        else:
            # Si no se encuentran datos, asegurar que las claves existan como N/A
            normalized_data[f'por_que_{level}_causa'] = 'N/A'
            for comp_std in component_map.keys():
                normalized_data[f'por_que_{level}_{comp_std}'] = 'N/A'

    # --- PASO 4: Asegurar Valores por Defecto Finales ---
    final_keys = [
        'edad', 'estado_civil', 'tiempo_en_el_contrato', 'dia_de_turno', 'supervisor_inmediato',
        'incidente_con_lesion', 'incidente_grave', 'casi_accidente', 'genero_muerte', 'dano_a_la_propiedad',
        'recomendacion_1', 'recomendacion_2', 'recomendacion_3'
    ]
    for key in final_keys:
        if key not in normalized_data or normalized_data[key] in ('', None, 'N/A'):
            normalized_data[key] = '' # Usar '' en vez de 'N/A' para campos opcionales en la plantilla
    
    # Forzar 'X' en incidente con lesión si es un accidente
    if normalized_data.get('tipo_accidente') != 'N/A':
        normalized_data['incidente_con_lesion'] = 'X'


    # --- PASO 5: Estructura para tablas (si aplica) ---
    normalized_data['involucrados'] = [{
        'nombre_involucrado': normalized_data.get('nombre_completo', 'N/A'),
        'cargo': normalized_data.get('cargo', 'N/A'),
        'cedula': normalized_data.get('no_identificacion', 'N/A'),
        'proceso': 'N/A',
        'equipo_involucrado': normalized_data.get('equipo_que_operaba_reparaba', 'N/A')
    }]

    logging.info("=== DATOS NORMALIZADOS Y PROCESADOS ===")
    for key, value in normalized_data.items():
        logging.info(f"Campo final: '{key}' = '{str(value)[:100]}...'")
    
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

        empresa_config = Config.RUTAS.get(empresa)
        if not empresa_config:
            error_msg = f"No se encontró configuración para la empresa: {empresa}"
            logging.error(error_msg)
            print(json.dumps({"success": False, "error": error_msg}, ensure_ascii=False), file=sys.stderr)
            sys.exit(1)
            
        template_path = empresa_config.get('plantilla')
        config_output_dir = empresa_config.get('investigaciones')

        if output_base_dir:
            output_dir = output_base_dir
            send_progress("setup", 15, f"Usando directorio de salida proporcionado: {output_dir}")
        else:
            output_dir = config_output_dir
            send_progress("setup", 15, f"Usando directorio de configuración: {output_dir}")

        if not template_path or not Path(template_path).exists():
            error_msg = f"Plantilla no encontrada en: {template_path}"
            logging.error(error_msg)
            print(json.dumps({"success": False, "error": error_msg}, ensure_ascii=False), file=sys.stderr)
            sys.exit(1)
            
        if not output_dir:
            error_msg = f"No se encontró configuración de carpeta de salida para la empresa: {empresa}"
            logging.error(error_msg)
            print(json.dumps({"success": False, "error": error_msg}, ensure_ascii=False), file=sys.stderr)
            sys.exit(1)

        is_accessible, access_result = validar_ruta_google_drive(output_dir)
        if not is_accessible:
            logging.warning(f"Problema con directorio de salida: {access_result}. Continuando con estrategia de respaldo.")

        send_progress("rendering", 50, "Renderizando plantilla...")
        
        normalized_data = preparar_datos_para_plantilla(combined_data)
        logging.info(f"Datos preparados para docxtpl con {len(normalized_data)} campos")
        
        try:
            doc = DocxTemplate(str(template_path))
            doc.render(normalized_data)
            logging.info("Plantilla renderizada exitosamente")
        except Exception as render_error:
            error_msg = f"Error al renderizar la plantilla: {render_error}"
            logging.error(error_msg, exc_info=True)
            print(json.dumps({"success": False, "error": error_msg}, ensure_ascii=False), file=sys.stderr)
            sys.exit(1)

        send_progress("saving", 80, "Preparando para guardar informe...")
        
        # --- FIX: Sanitize newline characters from the name for the filename ---
        nombre_completo = normalized_data.get('nombre_completo', 'sin_nombre')
        # Replace newlines and carriage returns with a space, then sanitize other characters
        nombre_sanitizado = nombre_completo.replace('\n', ' ').replace('\r', '')
        nombre_sanitizado = re.sub(r'[^\w\s-]', '', nombre_sanitizado).replace(' ', '_')
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_filename = f"GI-FO-020_INVESTIGACION_{nombre_sanitizado}_{timestamp}.docx"
        
        logging.info(f"Nombre de archivo: {output_filename}")
        
        try:
            final_path = guardar_documento_seguro(doc, output_dir, output_filename)
            
            send_progress("finished", 100, f"Informe guardado en: {final_path}")
            logging.info(f"Informe generado exitosamente: {final_path}")
            
            result = {
                "success": True,
                "documentPath": final_path,
                "message": "Informe generado correctamente."
            }
            print(json.dumps(result, ensure_ascii=False))
            sys.stdout.flush()
            
        except Exception as save_error:
            error_msg = f"Error crítico al guardar informe: {str(save_error)}"
            logging.error(error_msg, exc_info=True)
            error_result = {"success": False, "error": error_msg}
            print(json.dumps(error_result, ensure_ascii=False))
            sys.stdout.flush()
            sys.exit(1)

    except Exception as e:
        error_msg = f"Error general en el proceso: {str(e)}"
        logging.error(error_msg, exc_info=True)
        error_result = {"success": False, "error": error_msg}
        print(json.dumps(error_result, ensure_ascii=False))
        sys.stdout.flush()
        sys.exit(1)


if __name__ == "__main__":
    main()
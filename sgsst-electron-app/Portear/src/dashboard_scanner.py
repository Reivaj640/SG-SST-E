# Portear/python-embed/python-scripts/dashboard_scanner.py
import pandas as pd
import json
import sys
import os
import re
from datetime import datetime, timedelta


# ============================================================================
# FUNCIONES AUXILIARES PARA VERIFICACIÓN DE COPASST Y COMITÉ DE CONVIVENCIA
# ============================================================================

def extract_latest_year_from_files(folder_path, file_patterns):
    """
    Extrae el año más reciente desde nombres de archivos en una carpeta
    """
    try:
        if not os.path.exists(folder_path):
            return None
        
        archivos = os.listdir(folder_path)
        years = []
        
        for archivo in archivos:
            upper_name = archivo.upper()
            matches_pattern = any(pattern.upper() in upper_name for pattern in file_patterns)
            
            if matches_pattern:
                year_match = re.search(r'(20\d{2}|202\d)', archivo)
                if year_match:
                    years.append(int(year_match.group(1)))
        
        return max(years) if years else None
    except Exception as e:
        print(f"Error extrayendo año desde {folder_path}: {e}", file=sys.stderr)
        return None


def extract_month_from_file_name(file_name):
    """
    Extrae el mes desde un nombre de archivo de acta
    """
    months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]
    
    upper_name = file_name.upper()
    for month in months:
        if month.upper() in upper_name:
            return month
    return None


def get_actas_in_year_folder(folder_path):
    """
    Obtiene las actas encontradas en una carpeta de año específico
    """
    result = []
    try:
        if not os.path.exists(folder_path):
            return result

        archivos = os.listdir(folder_path)
        for archivo in archivos:
            if archivo.startswith('~$'):
                continue

            month = extract_month_from_file_name(archivo)
            if month:
                result.append({'file_name': archivo, 'month': month})
    except Exception as e:
        print(f"Error leyendo actas en {folder_path}: {e}", file=sys.stderr)
    return result


def month_to_number(month_name):
    """
    Convierte nombre de mes a número (1-12)
    """
    months = {
        'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4,
        'Mayo': 5, 'Junio': 6, 'Julio': 7, 'Agosto': 8,
        'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12
    }
    return months.get(month_name, 0)


def number_to_month(month_number):
    """
    Convierte número de mes a nombre
    """
    months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]
    return months[month_number - 1] if 1 <= month_number <= 12 else ''


def get_actas_with_modification_date(folder_path):
    """
    Obtiene actas con fecha de modificación para verificar registro real
    """
    result = []
    try:
        if not os.path.exists(folder_path):
            return result

        archivos = os.listdir(folder_path)
        for archivo in archivos:
            if archivo.startswith('~$'):
                continue

            month = extract_month_from_file_name(archivo)
            if month:
                file_path = os.path.join(folder_path, archivo)
                modified_time = os.path.getmtime(file_path)
                modified_date = datetime.fromtimestamp(modified_time)
                result.append({
                    'file_name': archivo,
                    'month': month,
                    'month_number': month_to_number(month),
                    'modified': modified_date
                })
    except Exception as e:
        print(f"Error leyendo actas con fecha en {folder_path}: {e}", file=sys.stderr)
    return result


def get_actas_by_file_name(folder_path):
    """
    Obtiene actas por nombre de archivo (sin considerar fecha de modificación)
    """
    result = []
    try:
        if not os.path.exists(folder_path):
            return result

        archivos = os.listdir(folder_path)
        for archivo in archivos:
            if archivo.startswith('~$'):
                continue

            month = extract_month_from_file_name(archivo)
            if month:
                result.append({
                    'file_name': archivo,
                    'month': month,
                    'month_number': month_to_number(month)
                })
    except Exception as e:
        print(f"Error leyendo actas por nombre en {folder_path}: {e}", file=sys.stderr)
    return result


def verify_committee_period(constitucion_path, committee_name):
    """
    Verifica el período vigente de un comité (COPASST o Convivencia)
    """
    current_year = datetime.now().year
    current_month = datetime.now().month

    file_patterns = [
        'ACTA DE ESCRUTINIO',
        'ACTA DE VOTACION',
        'ACTA DE CONSTITUCIÓN',
        'ACTA DE CONSTITUCION'
    ]

    latest_year = extract_latest_year_from_files(constitucion_path, file_patterns)

    if not latest_year:
        return {
            'vigente': False,
            'year_ultima': None,
            'anos_transcurridos': 999,
            'por_vencer': False,
            'message': f'No se encontró acta de elección/constitución de {committee_name}'
        }

    end_year = latest_year + 2  # El período termina en diciembre de end_year
    end_month = 12  # Diciembre
    
    # Vigente si: año actual < end_year O (año actual == end_year Y mes <= diciembre)
    vigente = (current_year < end_year) or (current_year == end_year and current_month <= end_month)
    
    anos_transcurridos = current_year - latest_year
    
    # Por vencer: alerta temprana cuando faltan 3 meses o menos para terminar el período
    meses_restantes = (end_year - current_year) * 12 + (end_month - current_month)
    por_vencer = 0 < meses_restantes <= 3

    return {
        'vigente': vigente,
        'year_ultima': latest_year,
        'anos_transcurridos': anos_transcurridos,
        'por_vencer': por_vencer,
        'message': f'Período {latest_year}-{latest_year + 2}'
    }


def verify_copasst_meetings(base_path, year):
    """
    Verifica reuniones mensuales de COPASST usando nombre de archivo
    """
    current_date = datetime.now()
    current_month = current_date.month  # 1-12
    current_year = current_date.year

    # Buscar carpetas del año actual y año anterior
    year_folder = os.path.join(base_path, f"COPASST {year}")
    prev_year_folder = os.path.join(base_path, f"COPASST {year - 1}")

    # Obtener actas por nombre de archivo (NO por fecha de modificación)
    actas_year = get_actas_by_file_name(year_folder)
    actas_prev_year = get_actas_by_file_name(prev_year_folder)

    # Combinar todas las actas encontradas y ordenar por año y mes
    all_actas = [
        {**a, 'year': year - 1} for a in actas_prev_year
    ] + [
        {**a, 'year': year} for a in actas_year
    ]

    # Ordenar por año y luego por mes (descendente para obtener el último primero)
    all_actas.sort(key=lambda a: (a['year'], a['month_number']), reverse=True)

    # Obtener último mes registrado
    ultimo_acta = all_actas[0] if all_actas else None
    ultimo_mes_registrado = ultimo_acta['month_number'] if ultimo_acta else 0
    ultimo_mes_nombre = ultimo_acta['month'] if ultimo_acta else None
    ultimo_mes_year = ultimo_acta['year'] if ultimo_acta else year - 1

    # Calcular meses faltantes desde el último registrado hasta el mes actual
    meses_faltantes = []
    
    if ultimo_mes_year == year - 1:
        # El último acta es del año anterior, faltan todos los meses de Enero hasta el mes actual
        for m in range(1, current_month + 1):
            meses_faltantes.append(number_to_month(m))
    else:
        # El último acta es del año actual, faltan desde el mes siguiente hasta el mes actual
        for m in range(ultimo_mes_registrado + 1, current_month + 1):
            meses_faltantes.append(number_to_month(m))

    cumple = len(meses_faltantes) == 0

    return {
        'cumple': cumple,
        'ultimo_mes': ultimo_mes_nombre,
        'ultimo_mes_numero': ultimo_mes_registrado,
        'meses_faltantes': meses_faltantes,
        'message': f"Reuniones al día (última: {ultimo_mes_nombre} {ultimo_mes_year})" if cumple else f"Sin reunión desde {ultimo_mes_nombre or 'Ninguna'} {ultimo_mes_year}"
    }


def verify_convivencia_meetings(base_path, year):
    """
    Verifica reuniones mensuales del Comité de Convivencia
    """
    current_month = datetime.now().month
    last_complete_month = current_month - 1 if current_month > 1 else 12
    
    month_names = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]
    
    year_folder = os.path.join(base_path, f"CONVIVENCIA {year}")
    actas = get_actas_in_year_folder(year_folder)
    months_found = [a['month'] for a in actas]
    
    last_month_name = month_names[last_complete_month - 1]
    tiene_ultimo_mes = last_month_name in months_found
    
    meses_sin_acta = [month_names[i] for i in range(last_complete_month) if month_names[i] not in months_found]
    
    cumple = tiene_ultimo_mes and len(meses_sin_acta) == 0
    
    return {
        'cumple': cumple,
        'ultimo_mes': last_month_name if tiene_ultimo_mes else None,
        'meses_sin_acta': meses_sin_acta,
        'message': f"Reuniones al día (última: {last_month_name} {year})" if cumple else f"Sin reunión desde {meses_sin_acta[0] if meses_sin_acta else last_month_name}"
    }


def scan_company(company_path):
    """
    Escanea los archivos Excel de una empresa y devuelve un JSON
    con KPIs y Tareas pendientes para el Dashboard.

    Incluye alertas específicas para el módulo de Recursos:
    - Capacitaciones por tipo (COPASST, Comité, Inducciones, etc.)
    - EPP por entregar
    - Cumplimiento de programa de capacitaciones
    - Alertas preventivas (próximos a vencer)
    """
    dashboard_data = {
        "kpis": {
            "accidents_month": 0,
            "pric_active": 0,
            "overdue_docs": 0,
            "compliance": 0,  # % cumplimiento capacitaciones
            "recursos_alerts": 0  # Total alertas módulo Recursos
        },
        "tasks": [],
        "module_status": {
            "recursos": "ok",
            "gestion-integral": "ok",
            "gestion-salud": "ok",
            "peligros": "ok",
            "amenazas": "ok",
            "verificacion": "ok",
            "mejoramiento": "ok"
        },
        "recursos_detail": {
            "capacitaciones_vencidas": {
                "total": 0,
                "copasst": 0,
                "comite_convivencia": 0,
                "inducciones": 0,
                "curso_50_horas": 0,
                "otros": 0
            },
            "capacitaciones_proximas": {
                "total": 0,
                "en_7_dias": 0,
                "en_15_dias": 0
            },
            "epp_por_entregar": 0,
            "cumplimiento_porcentaje": 0
        }
    }

    today = datetime.now()
    current_month = today.month
    current_year = today.year

    # ---------------------------------------------------------
    # 1. ESCANEAR AUSENTISMO Y PRIC (PRI.xlsx)
    # ---------------------------------------------------------
    pri_path = os.path.join(company_path, "PRI.xlsx")
    if os.path.exists(pri_path):
        try:
            # Leer hoja de seguimiento
            df_pri = pd.read_excel(pri_path, sheet_name="Casos en seguimiento")

            # Convertir fechas
            df_pri['FECHA FIN'] = pd.to_datetime(df_pri['FECHA FIN'], errors='coerce')

            # KPI: Casos Activos (PRIC) - Fecha fin >= hoy
            activos = df_pri[df_pri['FECHA FIN'] >= today]
            dashboard_data['kpis']['pric_active'] = len(activos)

            # TAREAS: Casos Vencidos (Fecha Fin < Hoy y no cerrado)
            vencidos = df_pri[df_pri['FECHA FIN'] < today]

            for _, row in vencidos.iterrows():
                dashboard_data['tasks'].append({
                    "title": f"Seguimiento vencido: {row.get('NOMBRE', 'N/A')}",
                    "desc": f"Incapacidad vencida desde el {row['FECHA FIN'].strftime('%d/%m/%Y')}. Requiere cierre o prórroga.",
                    "priority": "critical",
                    "module": "ausentismo",
                    "icon": "fas fa-user-injured"
                })

            # Actualizar estado del módulo
            if len(vencidos) > 0:
                dashboard_data['module_status']['gestion-salud'] = "danger"

        except Exception as e:
            print(f"Error leyendo PRI.xlsx: {e}", file=sys.stderr)

    # ---------------------------------------------------------
    # 2. ESCANEAR ACCIDENTES (ReporteAccidentes.xlsx)
    # ---------------------------------------------------------
    at_path = os.path.join(company_path, "ReporteAccidentes.xlsx")
    if os.path.exists(at_path):
        try:
            df_at = pd.read_excel(at_path)

            # KPI: Accidentes del mes actual
            if 'FECHA ACCIDENTE' in df_at.columns:
                df_at['FECHA ACCIDENTE'] = pd.to_datetime(df_at['FECHA ACCIDENTE'], errors='coerce')
                accidents_this_month = df_at[
                    (df_at['FECHA ACCIDENTE'].dt.month == current_month) &
                    (df_at['FECHA ACCIDENTE'].dt.year == current_year)
                ]
                dashboard_data['kpis']['accidents_month'] = len(accidents_this_month)

            # TAREA: ¿Investigaciones pendientes?
            # Si no tiene 'INFORME' lleno
            if 'INFORME' in df_at.columns:
                pendientes = df_at[df_at['INFORME'].isna()]
                if len(pendientes) > 0:
                    dashboard_data['tasks'].append({
                        "title": f"{len(pendientes)} Investigaciones Pendientes",
                        "desc": "Accidentes reportados sin cierre de investigación.",
                        "priority": "warning",
                        "module": "investigacion",
                        "icon": "fas fa-hard-hat"
                    })
                    dashboard_data['module_status']['gestion-salud'] = "warning"

        except Exception as e:
            print(f"Error leyendo ReporteAccidentes: {e}", file=sys.stderr)

    # ---------------------------------------------------------
    # 3. ESCANEAR CAPACITACIONES (Capacitaciones.xlsx)
    # ---------------------------------------------------------
    cap_path = os.path.join(company_path, "Capacitaciones.xlsx")
    if os.path.exists(cap_path):
        try:
            df_cap = pd.read_excel(cap_path)

            # KPI: Capacitaciones vencidas (FECHA < hoy y ESTADO != 'Realizado')
            if 'FECHA' in df_cap.columns and 'ESTADO' in df_cap.columns:
                df_cap['FECHA'] = pd.to_datetime(df_cap['FECHA'], errors='coerce')

                # Capacitaciones vencidas
                vencidas = df_cap[
                    (df_cap['FECHA'] < today) &
                    (~df_cap['ESTADO'].str.contains('Realizado|Completado', case=False, na=False))
                ]

                # Capacitaciones próximas (en próximos 7 y 15 días) - ALERTA PREVENTIVA
                proximas_7 = df_cap[
                    (df_cap['FECHA'] >= today) &
                    (df_cap['FECHA'] <= today + timedelta(days=7)) &
                    (~df_cap['ESTADO'].str.contains('Realizado|Completado', case=False, na=False))
                ]

                proximas_15 = df_cap[
                    (df_cap['FECHA'] > today + timedelta(days=7)) &
                    (df_cap['FECHA'] <= today + timedelta(days=15)) &
                    (~df_cap['ESTADO'].str.contains('Realizado|Completado', case=False, na=False))
                ]

                # Calcular cumplimiento
                total_capacitaciones = len(df_cap)
                completadas = len(df_cap[
                    df_cap['ESTADO'].str.contains('Realizado|Completado', case=False, na=False)
                ])
                cumplimiento = (completadas / total_capacitaciones * 100) if total_capacitaciones > 0 else 0

                # Clasificar capacitaciones vencidas por tipo
                vencidas_por_tipo = {
                    'copasst': 0,
                    'comite_convivencia': 0,
                    'inducciones': 0,
                    'curso_50_horas': 0,
                    'otros': 0
                }

                for _, row in vencidas.iterrows():
                    tema = str(row.get('TEMA', '')).lower()
                    if 'copasst' in tema or 'copas' in tema:
                        vencidas_por_tipo['copasst'] += 1
                    elif 'comite' in tema or 'convivencia' in tema:
                        vencidas_por_tipo['comite_convivencia'] += 1
                    elif 'induccion' in tema or 'reinduccion' in tema:
                        vencidas_por_tipo['inducciones'] += 1
                    elif '50 horas' in tema or 'curso 50' in tema:
                        vencidas_por_tipo['curso_50_horas'] += 1
                    else:
                        vencidas_por_tipo['otros'] += 1

                # Actualizar dashboard_data
                dashboard_data['kpis']['overdue_docs'] = len(vencidas)
                dashboard_data['kpis']['compliance'] = round(cumplimiento, 1)
                dashboard_data['kpis']['recursos_alerts'] = len(vencidas) + len(proximas_7)

                dashboard_data['recursos_detail']['capacitaciones_vencidas'] = {
                    'total': len(vencidas),
                    'copasst': vencidas_por_tipo['copasst'],
                    'comite_convivencia': vencidas_por_tipo['comite_convivencia'],
                    'inducciones': vencidas_por_tipo['inducciones'],
                    'curso_50_horas': vencidas_por_tipo['curso_50_horas'],
                    'otros': vencidas_por_tipo['otros']
                }

                dashboard_data['recursos_detail']['capacitaciones_proximas'] = {
                    'total': len(proximas_7) + len(proximas_15),
                    'en_7_dias': len(proximas_7),
                    'en_15_dias': len(proximas_15)
                }

                dashboard_data['recursos_detail']['cumplimiento_porcentaje'] = cumplimiento

                # TAREA CRÍTICA: Capacitaciones vencidas (si hay)
                if len(vencidas) > 0:
                    # Construir mensaje específico
                    detalles = []
                    if vencidas_por_tipo['copasst'] > 0:
                        detalles.append(f"{vencidas_por_tipo['copasst']} COPASST")
                    if vencidas_por_tipo['comite_convivencia'] > 0:
                        detalles.append(f"{vencidas_por_tipo['comite_convivencia']} Comité Convivencia")
                    if vencidas_por_tipo['inducciones'] > 0:
                        detalles.append(f"{vencidas_por_tipo['inducciones']} Inducciones")
                    if vencidas_por_tipo['curso_50_horas'] > 0:
                        detalles.append(f"{vencidas_por_tipo['curso_50_horas']} Curso 50 Horas")
                    if vencidas_por_tipo['otros'] > 0:
                        detalles.append(f"{vencidas_por_tipo['otros']} Otras")

                    mensaje_detalles = " (" + ", ".join(detalles) + ")" if detalles else ""

                    dashboard_data['tasks'].append({
                        "title": f"{len(vencidas)} Capacitaciones Vencidas{mensaje_detalles}",
                        "desc": f"Sesiones programadas sin ejecutar o sin registrar. Cumplimiento actual: {cumplimiento:.1f}%",
                        "priority": "critical" if cumplimiento < 50 else "warning",
                        "module": "capacitaciones",
                        "icon": "fas fa-chalkboard-teacher",
                        "submodule": "1.2.1 Programa de Capacitación"
                    })

                    # Actualizar estado del módulo
                    if cumplimiento < 50:
                        dashboard_data['module_status']['recursos'] = "danger"
                    else:
                        dashboard_data['module_status']['recursos'] = "warning"

                # TAREA PREVENTIVA: Capacitaciones próximas a vencer (7 días)
                elif len(proximas_7) > 0:
                    dashboard_data['tasks'].append({
                        "title": f"{len(proximas_7)} Capacitaciones Próximas (7 días)",
                        "desc": "Sesiones programadas para esta semana. Verificar logística y participantes.",
                        "priority": "info",
                        "module": "capacitaciones",
                        "icon": "fas fa-calendar-alt",
                        "submodule": "1.2.1 Programa de Capacitación"
                    })

        except Exception as e:
            print(f"Error leyendo Capacitaciones: {e}", file=sys.stderr)

    # ---------------------------------------------------------
    # 4. ESCANEAR EPP (EntregaEPP.xlsx)
    # ---------------------------------------------------------
    epp_path = os.path.join(company_path, "EntregaEPP.xlsx")
    if os.path.exists(epp_path):
        try:
            df_epp = pd.read_excel(epp_path)

            # TAREA: EPP por entregar (FECHA ENTREGA < hoy y ESTADO != 'Entregado')
            if 'FECHA ENTREGA' in df_epp.columns and 'ESTADO' in df_epp.columns:
                df_epp['FECHA ENTREGA'] = pd.to_datetime(df_epp['FECHA ENTREGA'], errors='coerce')

                # EPP vencidos (fecha < hoy)
                por_entregar_vencidos = df_epp[
                    (df_epp['FECHA ENTREGA'] < today) &
                    (~df_epp['ESTADO'].str.contains('Entregado', case=False, na=False))
                ]

                # EPP próximos a entregar (próximos 7 días) - ALERTA PREVENTIVA
                por_entregar_proximos = df_epp[
                    (df_epp['FECHA ENTREGA'] >= today) &
                    (df_epp['FECHA ENTREGA'] <= today + timedelta(days=7)) &
                    (~df_epp['ESTADO'].str.contains('Entregado', case=False, na=False))
                ]

                total_por_entregar = len(por_entregar_vencidos) + len(por_entregar_proximos)
                dashboard_data['recursos_detail']['epp_por_entregar'] = total_por_entregar
                dashboard_data['kpis']['recursos_alerts'] += total_por_entregar

                # TAREA CRÍTICA: EPP vencidos
                if len(por_entregar_vencidos) > 0:
                    dashboard_data['tasks'].append({
                        "title": f"{len(por_entregar_vencidos)} EPP Sin Entregar (Vencidos)",
                        "desc": "Equipos de protección programados sin registro de entrega. Riesgo de incumplimiento normativo.",
                        "priority": "critical",
                        "module": "epp",
                        "icon": "fas fa-vest",
                        "submodule": "2.13.1 Elementos de Protección Personal"
                    })
                    dashboard_data['module_status']['recursos'] = "danger"

                # TAREA PREVENTIVA: EPP próximos a entregar
                elif len(por_entregar_proximos) > 0:
                    dashboard_data['tasks'].append({
                        "title": f"{len(por_entregar_proximos)} EPP Próximos a Entregar (7 días)",
                        "desc": "Equipos programados para esta semana. Verificar disponibilidad y agendar entregas.",
                        "priority": "info",
                        "module": "epp",
                        "icon": "fas fa-hard-hat",
                        "submodule": "2.13.1 Elementos de Protección Personal"
                    })

        except Exception as e:
            print(f"Error leyendo EPP: {e}", file=sys.stderr)

    # ---------------------------------------------------------
    # 5. ESCANEAR AUDITORÍAS (Auditorias.xlsx)
    # ---------------------------------------------------------
    aud_path = os.path.join(company_path, "Auditorias.xlsx")
    if os.path.exists(aud_path):
        try:
            df_aud = pd.read_excel(aud_path)

            # TAREA: Auditorías próximas (en los próximos 30 días)
            if 'FECHA PROGRAMADA' in df_aud.columns:
                df_aud['FECHA PROGRAMADA'] = pd.to_datetime(df_aud['FECHA PROGRAMADA'], errors='coerce')
                from datetime import timedelta
                proximas = df_aud[
                    (df_aud['FECHA PROGRAMADA'] >= today) &
                    (df_aud['FECHA PROGRAMADA'] <= today + timedelta(days=30))
                ]

                if len(proximas) > 0:
                    dashboard_data['tasks'].append({
                        "title": f"{len(proximas)} Auditorías Próximas",
                        "desc": "Auditorías programadas en los próximos 30 días.",
                        "priority": "info",
                        "module": "auditorias",
                        "icon": "fas fa-clipboard-check"
                    })
                    dashboard_data['module_status']['verificacion'] = "warning"

        except Exception as e:
            print(f"Error leyendo Auditorias: {e}", file=sys.stderr)

    # ---------------------------------------------------------
    # 6. VERIFICAR ACTAS COPASST Y COMITÉ DE CONVIVENCIA
    # ---------------------------------------------------------
    actas_path = os.path.join(company_path, "1. Recursos")
    current_year = datetime.now().year

    # 6.1 VERIFICAR COPASST
    actas_copasst_path = os.path.join(actas_path, "1.1.6 Conformación de Copasst")
    
    if os.path.exists(actas_copasst_path):
        # 6.1.1 Verificar período vigente (elección cada 2 años)
        constitucion_path = os.path.join(actas_copasst_path, "Constitución")
        periodo_copasst = verify_committee_period(constitucion_path, "COPASST")
        
        print(f"[DASHBOARD] 🔍 [COPASST] Período verificado: {periodo_copasst}", file=sys.stderr)
        
        if not periodo_copasst['year_ultima']:
            dashboard_data['tasks'].append({
                "title": "COPASST: Sin Acta de Elección/Constitución",
                "desc": "No se encontró acta de elección o constitución de COPASST. Requisito normativo obligatorio.",
                "priority": "critical",
                "module": "copasst",
                "icon": "fas fa-users",
                "submodule": "1.1.6 Conformación de Copasst"
            })
            dashboard_data['module_status']['recursos'] = "danger"
            dashboard_data['kpis']['recursos_alerts'] += 1
        elif not periodo_copasst['vigente']:
            dashboard_data['tasks'].append({
                "title": f"COPASST: Período vencido ({periodo_copasst['year_ultima']}-{periodo_copasst['year_ultima'] + 2})",
                "desc": f"Última elección: {periodo_copasst['year_ultima']}. Período máximo: 2 años. Próxima elección requerida: Antes de diciembre {periodo_copasst['year_ultima'] + 2}",
                "priority": "critical",
                "module": "copasst",
                "icon": "fas fa-users",
                "submodule": "1.1.6 Conformación de Copasst"
            })
            dashboard_data['module_status']['recursos'] = "danger"
            dashboard_data['kpis']['recursos_alerts'] += 1
        elif periodo_copasst['por_vencer']:
            dashboard_data['tasks'].append({
                "title": f"COPASST: Período por vencer ({periodo_copasst['year_ultima']}-{periodo_copasst['year_ultima'] + 2})",
                "desc": f"Última elección: {periodo_copasst['year_ultima']}. Renovación requerida antes de diciembre {periodo_copasst['year_ultima'] + 2}",
                "priority": "warning",
                "module": "copasst",
                "icon": "fas fa-users",
                "submodule": "1.1.6 Conformación de Copasst"
            })
            dashboard_data['kpis']['recursos_alerts'] += 1

        # 6.1.2 Verificar reuniones mensuales (SIEMPRE, independientemente del período)
        reuniones_copasst = verify_copasst_meetings(actas_copasst_path, current_year)
        print(f"[DASHBOARD] 🔍 [COPASST] Reuniones verificadas: {reuniones_copasst}", file=sys.stderr)

        if not reuniones_copasst['cumple'] and len(reuniones_copasst['meses_faltantes']) > 0:
            meses_faltantes_str = ', '.join(reuniones_copasst['meses_faltantes'])
            ultimo_mes = reuniones_copasst['ultimo_mes'] or 'Enero'
            dashboard_data['tasks'].append({
                "title": f"COPASST: Sin reunión desde {ultimo_mes} {current_year}",
                "desc": f"Última acta registrada: {ultimo_mes} {current_year}. Mes actual: {number_to_month(current_month)} {current_year}. Requisito: Reuniones mensuales. Meses sin acta: {meses_faltantes_str}",
                "priority": "critical",
                "module": "copasst",
                "icon": "fas fa-calendar-times",
                "submodule": "1.1.6 Conformación de Copasst"
            })
            dashboard_data['module_status']['recursos'] = "danger"
            dashboard_data['kpis']['recursos_alerts'] += 1
        elif not reuniones_copasst['cumple'] and reuniones_copasst['ultimo_mes_numero'] == 0:
            # No hay ninguna acta registrada en el año
            dashboard_data['tasks'].append({
                "title": f"COPASST: Sin reuniones registradas en {current_year}",
                "desc": f"No se encontró ninguna acta de reunión registrada en {current_year}. Requisito: Reuniones mensuales.",
                "priority": "critical",
                "module": "copasst",
                "icon": "fas fa-calendar-times",
                "submodule": "1.1.6 Conformación de Copasst"
            })
            dashboard_data['module_status']['recursos'] = "danger"
            dashboard_data['kpis']['recursos_alerts'] += 1

    # 6.2 VERIFICAR COMITÉ DE CONVIVENCIA
    actas_convivencia_path1 = os.path.join(actas_path, "1.1.8 Comité de Convivencia")
    actas_convivencia_path2 = os.path.join(actas_path, "1.1.8 Conformación de Comite de Convivencia")
    actas_convivencia_path = actas_convivencia_path1 if os.path.exists(actas_convivencia_path1) else actas_convivencia_path2
    
    if os.path.exists(actas_convivencia_path):
        # 6.2.1 Verificar período vigente (elección cada 2 años)
        constitucion_path = os.path.join(actas_convivencia_path, "Constitución")
        periodo_convivencia = verify_committee_period(constitucion_path, "COMITÉ CONVIVENCIA")
        
        print(f"[DASHBOARD] 🔍 [COMITÉ CONVIVENCIA] Período verificado: {periodo_convivencia}", file=sys.stderr)
        
        if not periodo_convivencia['year_ultima']:
            dashboard_data['tasks'].append({
                "title": "Comité: Sin Acta de Elección/Constitución",
                "desc": "No se encontró acta de elección o constitución del Comité. Requisito normativo obligatorio.",
                "priority": "critical",
                "module": "comite_convivencia",
                "icon": "fas fa-handshake",
                "submodule": "1.1.8 Conformación de Comite de Convivencia"
            })
            dashboard_data['module_status']['recursos'] = "danger"
            dashboard_data['kpis']['recursos_alerts'] += 1
        elif not periodo_convivencia['vigente']:
            dashboard_data['tasks'].append({
                "title": f"Comité: Período vencido ({periodo_convivencia['year_ultima']}-{periodo_convivencia['year_ultima'] + 2})",
                "desc": f"Última elección: {periodo_convivencia['year_ultima']}. Período máximo: 2 años. Próxima elección requerida: Antes de diciembre {periodo_convivencia['year_ultima'] + 2}",
                "priority": "critical",
                "module": "comite_convivencia",
                "icon": "fas fa-handshake",
                "submodule": "1.1.8 Conformación de Comite de Convivencia"
            })
            dashboard_data['module_status']['recursos'] = "danger"
            dashboard_data['kpis']['recursos_alerts'] += 1
        elif periodo_convivencia['por_vencer']:
            dashboard_data['tasks'].append({
                "title": f"Comité: Período por vencer ({periodo_convivencia['year_ultima']}-{periodo_convivencia['year_ultima'] + 2})",
                "desc": f"Última elección: {periodo_convivencia['year_ultima']}. Renovación requerida antes de diciembre {periodo_convivencia['year_ultima'] + 2}",
                "priority": "warning",
                "module": "comite_convivencia",
                "icon": "fas fa-handshake",
                "submodule": "1.1.8 Conformación de Comite de Convivencia"
            })
            dashboard_data['kpis']['recursos_alerts'] += 1
        
        # 6.2.2 Verificar reuniones mensuales (solo si el período está vigente)
        if periodo_convivencia['vigente']:
            reuniones_convivencia = verify_convivencia_meetings(actas_convivencia_path, current_year)
            print(f"[DASHBOARD] 🔍 [COMITÉ CONVIVENCIA] Reuniones verificadas: {reuniones_convivencia}", file=sys.stderr)
            
            if not reuniones_convivencia['cumple'] and len(reuniones_convivencia['meses_sin_acta']) > 0:
                primer_mes_sin_acta = reuniones_convivencia['meses_sin_acta'][0]
                dashboard_data['tasks'].append({
                    "title": f"Comité: Sin reunión desde {primer_mes_sin_acta} {current_year}",
                    "desc": f"No se encontró acta de reunión mensual. Requisito: Mínimo 1 reunión mensual. Meses sin acta: {', '.join(reuniones_convivencia['meses_sin_acta'])}",
                    "priority": "critical",
                    "module": "comite_convivencia",
                    "icon": "fas fa-calendar-times",
                    "submodule": "1.1.8 Conformación de Comite de Convivencia"
                })
                dashboard_data['module_status']['recursos'] = "danger"
                dashboard_data['kpis']['recursos_alerts'] += 1

    # ---------------------------------------------------------
    # ORDENAR TAREAS POR PRIORIDAD
    # ---------------------------------------------------------
    priority_map = {'critical': 0, 'warning': 1, 'info': 2}
    dashboard_data['tasks'].sort(key=lambda x: priority_map.get(x['priority'], 3))

    # ---------------------------------------------------------
    # ACTUALIZAR ESTADO DEL MÓDULO RECURSOS SEGÚN ALERTAS
    # ---------------------------------------------------------
    # Si no hay alertas críticas pero hay alertas de recursos, marcar como ok
    recursos_alerts = dashboard_data['kpis'].get('recursos_alerts', 0)
    if recursos_alerts == 0 and dashboard_data['module_status']['recursos'] == 'ok':
        # Sin alertas - todo bien
        pass
    elif recursos_alerts > 0 and dashboard_data['module_status']['recursos'] == 'ok':
        # Hay alertas pero no se estableció estado - marcar como warning
        dashboard_data['module_status']['recursos'] = 'warning'

    # ---------------------------------------------------------
    # CONTAR TAREAS TOTALES PARA OVERALL STATUS
    # ---------------------------------------------------------
    critical_count = len([t for t in dashboard_data['tasks'] if t['priority'] == 'critical'])
    if critical_count > 0:
        dashboard_data['overall_status'] = 'critical'
    elif len(dashboard_data['tasks']) > 0:
        dashboard_data['overall_status'] = 'warning'
    else:
        dashboard_data['overall_status'] = 'ok'

    return dashboard_data

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Falta argumento: ruta_empresa"}))
        sys.exit(1)

    company_path_arg = sys.argv[1]

    if not os.path.exists(company_path_arg):
        print(json.dumps({"error": f"Ruta no encontrada: {company_path_arg}"}))
        sys.exit(1)

    data = scan_company(company_path_arg)
    print(json.dumps(data, ensure_ascii=False))

# Portear/python-embed/python-scripts/dashboard_scanner.py
import pandas as pd
import json
import sys
import os
from datetime import datetime, timedelta

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
    # Verificar existencia de actas constitutivas en carpetas
    actas_copasst_path = os.path.join(company_path, "1.1.6 Conformación de Copasst")
    actas_convivencia_path = os.path.join(company_path, "1.1.8 Comité de Convivencia")

    # Verificar COPASST
    if os.path.exists(actas_copasst_path):
        try:
            archivos_copasst = os.listdir(actas_copasst_path)
            acta_constitutiva = any(
                'acta' in f.lower() and ('constitutiva' in f.lower() or 'constitucion' in f.lower())
                for f in archivos_copasst
            )

            if not acta_constitutiva:
                dashboard_data['tasks'].append({
                    "title": "COPASST: Sin Acta Constitutiva",
                    "desc": "No se encontró el acta constitutiva de COPASST. Requisito normativo obligatorio.",
                    "priority": "critical",
                    "module": "copasst",
                    "icon": "fas fa-users",
                    "submodule": "1.1.6 Conformación de Copasst"
                })
                dashboard_data['module_status']['recursos'] = "danger"
                dashboard_data['kpis']['recursos_alerts'] += 1
        except Exception as e:
            print(f"Error verificando COPASST: {e}", file=sys.stderr)

    # Verificar Comité de Convivencia
    if os.path.exists(actas_convivencia_path):
        try:
            archivos_convivencia = os.listdir(actas_convivencia_path)
            acta_constitutiva = any(
                'acta' in f.lower() and ('constitutiva' in f.lower() or 'constitucion' in f.lower())
                for f in archivos_convivencia
            )

            if not acta_constitutiva:
                dashboard_data['tasks'].append({
                    "title": "Comité de Convivencia: Sin Acta Constitutiva",
                    "desc": "No se encontró el acta constitutiva del Comité. Requisito normativo obligatorio.",
                    "priority": "critical",
                    "module": "comite_convivencia",
                    "icon": "fas fa-handshake",
                    "submodule": "1.1.8 Comité de Convivencia"
                })
                dashboard_data['module_status']['recursos'] = "danger"
                dashboard_data['kpis']['recursos_alerts'] += 1
        except Exception as e:
            print(f"Error verificando Comité de Convivencia: {e}", file=sys.stderr)

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

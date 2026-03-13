# Portear/src/dashboard_scanner.py
import pandas as pd
import json
import sys
import os
from datetime import datetime

def scan_company(company_path):
    """
    Escanea los archivos Excel de una empresa y devuelve un JSON
    con KPIs y Tareas pendientes para el Dashboard.
    """
    dashboard_data = {
        "kpis": {
            "accidents_month": 0,
            "pric_active": 0,
            "overdue_docs": 0,
            "compliance": 85  # Placeholder - se puede calcular después
        },
        "tasks": [],
        "module_status": {
            "recursos": "ok",
            "gestion-salud": "ok",
            "peligros": "ok",
            "amenazas": "ok",
            "verificacion": "ok",
            "mejoramiento": "ok"
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
                vencidas = df_cap[
                    (df_cap['FECHA'] < today) & 
                    (~df_cap['ESTADO'].str.contains('Realizado|Completado', case=False, na=False))
                ]
                dashboard_data['kpis']['overdue_docs'] = len(vencidas)
                
                # Tarea si hay vencidas
                if len(vencidas) > 0:
                    dashboard_data['tasks'].append({
                        "title": f"{len(vencidas)} Capacitaciones Vencidas",
                        "desc": "Sesiones programadas sin ejecutar o sin registrar.",
                        "priority": "warning",
                        "module": "capacitaciones",
                        "icon": "fas fa-chalkboard-teacher"
                    })
                    dashboard_data['module_status']['recursos'] = "warning"

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
                por_entregar = df_epp[
                    (df_epp['FECHA ENTREGA'] < today) & 
                    (~df_epp['ESTADO'].str.contains('Entregado', case=False, na=False))
                ]
                
                if len(por_entregar) > 0:
                    dashboard_data['tasks'].append({
                        "title": f"{len(por_entregar)} EPP Sin Entregar",
                        "desc": "Equipos de protección programados sin registro de entrega.",
                        "priority": "warning",
                        "module": "epp",
                        "icon": "fas fa-hard-hat"
                    })
                    dashboard_data['module_status']['recursos'] = "warning"

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
    # ORDENAR TAREAS POR PRIORIDAD
    # ---------------------------------------------------------
    priority_map = {'critical': 0, 'warning': 1, 'info': 2}
    dashboard_data['tasks'].sort(key=lambda x: priority_map.get(x['priority'], 3))

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

import json
import sys
import os
import datetime

def log_message(message, level="INFO"):
    print(json.dumps({"type": "log", "message": message, "level": level}), file=sys.stderr)

def excel_serial_to_date(serial):
    try:
        serial = float(serial)
        if serial < 1:
            return None
        base = datetime.datetime(1899, 12, 30)
        return base + datetime.timedelta(days=serial)
    except (ValueError, TypeError, OverflowError):
        return None

def read_acoso_sheet(xlsb_path, current_year, date_from=None, date_to=None):
    import pandas as pd
    try:
        df = pd.read_excel(xlsb_path, sheet_name='BASE DATOS REP. ACOSO.', engine='pyxlsb', header=0)
    except Exception:
        try:
            df = pd.read_excel(xlsb_path, sheet_name='BASE DATOS REP. ACOSO', engine='pyxlsb', header=0)
        except Exception as e2:
            log_message(f"No se pudo leer hoja BASE DATOS REP. ACOSO: {e2}", "ERROR")
            return {"totalComplaints": 0, "complaints": [], "recentComplaints": [], "periodComplaints": []}

    complaints = []
    recent_complaints = []
    period_complaints = []
    col_vinculo = df.columns[1] if len(df.columns) > 1 else None
    col_nombre_trabajador = df.columns[2] if len(df.columns) > 2 else None
    col_identificacion = df.columns[3] if len(df.columns) > 3 else None
    col_nombre_contratista = df.columns[9] if len(df.columns) > 9 else None
    col_identificacion_contratista = df.columns[10] if len(df.columns) > 10 else None
    col_tipo_situacion = df.columns[41] if len(df.columns) > 41 else None
    col_descripcion = df.columns[42] if len(df.columns) > 42 else None
    col_fecha_ocurrencia = df.columns[43] if len(df.columns) > 43 else None
    col_lugar = df.columns[44] if len(df.columns) > 44 else None
    col_evidencias = df.columns[45] if len(df.columns) > 45 else None
    col_testigo_nombre = df.columns[48] if len(df.columns) > 48 else None
    col_involucrado = df.columns[53] if len(df.columns) > 53 else None

    for idx, row in df.iterrows():
        vinculo = str(row.get(col_vinculo, '') or '').strip() if col_vinculo else ''
        is_trabajador = 'trabajador' in vinculo.lower() if vinculo else False
        nombre = str(row.get(col_nombre_trabajador, '') or '').strip() if col_nombre_trabajador and is_trabajador else ''
        identificacion = str(row.get(col_identificacion, '') or '').strip() if col_identificacion and is_trabajador else ''
        if not nombre and col_nombre_contratista:
            nombre = str(row.get(col_nombre_contratista, '') or '').strip()
            identificacion = str(row.get(col_identificacion_contratista, '') or '').strip() if col_identificacion_contratista else ''

        tipo_situacion = str(row.get(col_tipo_situacion, '') or '').strip() if col_tipo_situacion else ''
        descripcion = str(row.get(col_descripcion, '') or '').strip() if col_descripcion else ''
        fecha_ocurrencia_raw = row.get(col_fecha_ocurrencia) if col_fecha_ocurrencia else None
        lugar = str(row.get(col_lugar, '') or '').strip() if col_lugar else ''
        testigo = str(row.get(col_testigo_nombre, '') or '').strip() if col_testigo_nombre else ''
        involucrado_raw = str(row.get(col_involucrado, '') or '').strip() if col_involucrado else ''
        involucrado = '' if involucrado_raw.lower() == 'nan' else involucrado_raw

        fecha_ocurrencia = None
        if fecha_ocurrencia_raw is not None:
            fecha_dt = excel_serial_to_date(fecha_ocurrencia_raw)
            if fecha_dt:
                fecha_ocurrencia = fecha_dt.strftime('%Y-%m-%d')

        complaint = {
            "vinculo": vinculo,
            "nombre": nombre,
            "identificacion": identificacion,
            "tipoSituacion": tipo_situacion,
            "descripcion": descripcion,
            "fechaOcurrencia": fecha_ocurrencia or "",
            "lugar": lugar,
            "testigo": testigo,
            "involucrado": involucrado
        }
        complaints.append(complaint)

        is_recent = False
        if fecha_ocurrencia:
            try:
                year = int(fecha_ocurrencia[:4])
                if year >= current_year - 1:
                    is_recent = True
            except (ValueError, IndexError):
                pass
        elif not fecha_ocurrencia:
            is_recent = True

        if is_recent:
            recent_complaints.append(complaint)

        if fecha_ocurrencia and date_from and date_to:
            try:
                from datetime import date as dt_date
                complaint_date = dt_date.fromisoformat(fecha_ocurrencia)
                from_date = dt_date.fromisoformat(date_from)
                to_date = dt_date.fromisoformat(date_to)
                if from_date <= complaint_date <= to_date:
                    period_complaints.append(complaint)
            except (ValueError, IndexError):
                pass

    return {
        "totalComplaints": len(complaints),
        "complaints": complaints,
        "recentComplaints": recent_complaints,
        "periodComplaints": period_complaints
    }

def read_clima_results(xlsb_path):
    import pandas as pd
    try:
        df = pd.read_excel(xlsb_path, sheet_name='Resultados', engine='pyxlsb', header=None)
    except Exception as e:
        log_message(f"No se pudo leer hoja Resultados: {e}", "ERROR")
        return {"totalCumplimiento": 0, "calificacion": "Sin datos", "dimensiones": []}

    dimensiones = []
    total_cumplimiento = 0
    calificacion = "Sin datos"

    for i in range(15, 23):
        if i >= len(df):
            break
        row = df.iloc[i]
        dim_nombre = str(row.iloc[2] if pd.notna(row.iloc[2]) else '').strip() if len(row) > 2 else ''
        promedio = float(row.iloc[3]) if len(row) > 3 and pd.notna(row.iloc[3]) else 0
        meta = float(row.iloc[4]) if len(row) > 4 and pd.notna(row.iloc[4]) else 5
        cumplimiento = float(row.iloc[5]) if len(row) > 5 and pd.notna(row.iloc[5]) else 0
        if dim_nombre:
            cumplimiento_pct = round(cumplimiento * 100, 1)
            dim_calificacion = clasificar_cumplimiento(cumplimiento_pct)
            dimensiones.append({
                "nombre": dim_nombre,
                "promedio": round(promedio, 2),
                "meta": meta,
                "cumplimiento": cumplimiento_pct,
                "calificacion": dim_calificacion
            })

    if len(df) > 23 and pd.notna(df.iloc[23].iloc[5]) if len(df.iloc[23]) > 5 else False:
        total_cumplimiento = round(float(df.iloc[23].iloc[5]) * 100, 1)
        calificacion = clasificar_cumplimiento(total_cumplimiento)

    return {
        "totalCumplimiento": total_cumplimiento,
        "calificacion": calificacion,
        "dimensiones": dimensiones
    }

def clasificar_cumplimiento(pct):
    if pct >= 86:
        return "Excelente"
    elif pct >= 71:
        return "Bueno"
    elif pct >= 56:
        return "Regular"
    else:
        return "Deficiente"

def read_plan_trabajo_sheet(xlsb_path, start_month, end_month):
    import pandas as pd
    month_map = {
        1: (3, 4), 2: (5, 6), 3: (7, 8), 4: (9, 10), 5: (11, 12), 6: (13, 14),
        7: (15, 16), 8: (17, 18), 9: (19, 20), 10: (21, 22), 11: (23, 24), 12: (25, 26)
    }
    phva_keywords = ['1. PLANEAR', '2. HACER', '3. VERIFICAR', '4. ACTUAR']
    try:
        df = pd.read_excel(xlsb_path, sheet_name='PLAN DE TRABAJO', engine='pyxlsb', header=None)
    except Exception as e:
        log_message(f"No se pudo leer hoja PLAN DE TRABAJO: {e}", "ERROR")
        return {"activities": [], "totalProgramadas": 0, "totalEjecutadas": 0}

    if start_month < 1 or start_month > 12 or end_month < 1 or end_month > 12:
        log_message(f"Meses invalidos: start={start_month}, end={end_month}", "ERROR")
        return {"activities": [], "totalProgramadas": 0, "totalEjecutadas": 0}

    if start_month <= end_month:
        months_in_range = list(range(start_month, end_month + 1))
    else:
        months_in_range = list(range(start_month, 13)) + list(range(1, end_month + 1))

    activities = []
    current_phva = ""

    for i in range(25, min(60, len(df))):
        row = df.iloc[i]
        col0 = str(row.iloc[0] if pd.notna(row.iloc[0]) else '').strip()
        if not col0:
            continue
        col0_upper = col0.upper().strip()
        is_phva = False
        for kw in phva_keywords:
            if col0_upper.startswith(kw) or col0_upper == kw:
                current_phva = kw
                is_phva = True
                break
        if is_phva:
            continue
        if col0_upper.startswith('TOTAL') or col0_upper.startswith('CUMPLIMIENTO'):
            continue
        responsable = str(row.iloc[2] if pd.notna(row.iloc[2]) else '').strip() if len(row) > 2 else ''
        if responsable.lower() == 'nan':
            responsable = ''
        any_ap = 0
        any_ae = 0
        months_ap = []
        months_ae = []
        for m in months_in_range:
            ap_col, ae_col = month_map[m]
            try:
                ap_val = int(float(row.iloc[ap_col])) if pd.notna(row.iloc[ap_col]) and str(row.iloc[ap_col]).strip() not in ('', 'nan') else 0
            except (ValueError, TypeError):
                ap_val = 0
            try:
                ae_val = int(float(row.iloc[ae_col])) if pd.notna(row.iloc[ae_col]) and str(row.iloc[ae_col]).strip() not in ('', 'nan') else 0
            except (ValueError, TypeError):
                ae_val = 0
            if ap_val == 1:
                any_ap = 1
                months_ap.append(m)
            if ae_val == 1:
                any_ae = 1
                months_ae.append(m)
        if any_ap == 0 and any_ae == 0:
            continue
        activities.append({
            "name": col0,
            "responsable": responsable,
            "phvaCycle": current_phva,
            "ap": any_ap,
            "ae": any_ae,
            "monthsProgramadas": months_ap,
            "monthsEjecutadas": months_ae
        })

    total_programadas = sum(1 for a in activities if a["ap"] == 1)
    total_ejecutadas = sum(1 for a in activities if a["ae"] == 1)
    log_message(f"Plan SVE Psicosocial: {len(activities)} actividades para meses {start_month}-{end_month}, AP={total_programadas}, AE={total_ejecutadas}", "INFO")
    return {
        "activities": activities,
        "totalProgramadas": total_programadas,
        "totalEjecutadas": total_ejecutadas
    }

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"type": "error", "message": "Uso: read_sve_psicosocial.py <xlsb_path> <output_json_path> [start_month] [end_month] [date_from] [date_to]"}))
        sys.exit(1)

    xlsb_path = sys.argv[1]
    output_json_path = sys.argv[2]
    start_month = int(sys.argv[3]) if len(sys.argv) >= 4 else 0
    end_month = int(sys.argv[4]) if len(sys.argv) >= 5 else start_month
    date_from = sys.argv[5] if len(sys.argv) >= 6 else None
    date_to = sys.argv[6] if len(sys.argv) >= 7 else None

    if not os.path.exists(xlsb_path):
        print(json.dumps({"type": "error", "message": f"Archivo no encontrado: {xlsb_path}"}))
        sys.exit(1)

    log_message(f"Leyendo SVE Psicosocial: {xlsb_path}", "INFO")

    current_year = datetime.datetime.now().year

    acoso_data = read_acoso_sheet(xlsb_path, current_year, date_from, date_to)
    clima_data = read_clima_results(xlsb_path)

    plan_data = {"activities": [], "totalProgramadas": 0, "totalEjecutadas": 0}
    if start_month >= 1 and start_month <= 12 and end_month >= 1 and end_month <= 12:
        plan_data = read_plan_trabajo_sheet(xlsb_path, start_month, end_month)

    result = {
        "type": "result",
        "payload": {
            "success": True,
            "acosoData": acoso_data,
            "climaData": clima_data,
            "planData": plan_data
        }
    }

    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(json.dumps({"type": "result", "payload": {"success": True, "outputPath": output_json_path}}))

if __name__ == '__main__':
    main()

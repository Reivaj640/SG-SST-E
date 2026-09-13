# -*- coding: utf-8 -*-
"""
Actualiza el archivo de ausentismo SIN usar fórmulas de Excel.
Mantiene el formato visual y genera una copia *_actualizado.xlsx.
"""
import os
import sys
import json
import pandas as pd
from openpyxl import load_workbook
from pathlib import Path
from datetime import datetime

def log(message):
    print(json.dumps({"type": "log", "message": message}))

def buscar_empleado_por_cedula(cedula, empresa):
    """
    Busca un empleado por cédula en la base de datos de la empresa.
    Devuelve un diccionario con los datos del empleado o None si no se encuentra.
    """
    try:
        log(f"Inicio buscar_empleado_por_cedula: cedula={cedula}, empresa={empresa}")

        # --- 1. Rutas de bases de datos ---
        BASES_DATOS = {
            "TEMPOACTIVA": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/Base de Datos Personal Temporales.xlsx",
            "TEMPOSUM": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/Base de Datos Personal Temporales.xlsx",
            "ASEPLUS": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/Base de Datos Personal Temporales.xlsx",
            "ASEL": "G:/Mi unidad/2. Trabajo/1. SG-SST/19. Asel S.A.S/Formato - Base de datos personal ASEL.xlsx",
            "ASEL": "G:/Mi unidad/2. Trabajo/1. SG-SST/19. Asel S.A.S/Formato - Base de datos personal ASEL.xlsx"
        }

        db_path = BASES_DATOS.get(str(empresa).upper())
        log(f"Ruta resolvida para empresa '{empresa}': {db_path}")

        if not db_path:
            log("ERROR: No existe ruta configurada para la empresa solicitada.")
            print(json.dumps({"type": "result", "payload": {"success": False, "error": "Ruta base de datos no configurada"}}))
            return None

        log(f"DEBUG: Verificando ruta: {db_path}")
        log(f"DEBUG: os.path.exists(db_path): {os.path.exists(db_path)}")
        log(f"DEBUG: os.path.isfile(db_path): {os.path.isfile(db_path)}")
        log(f"DEBUG: os.path.isdir(os.path.dirname(db_path)): {os.path.isdir(os.path.dirname(db_path))}")
        log(f"DEBUG: os.getcwd(): {os.getcwd()}")
        log(f"DEBUG: sys.version: {sys.version}")
        log(f"DEBUG: sys.executable: {sys.executable}")

        if not os.path.exists(db_path):
            log(f"ERROR: Archivo no encontrado en ruta: {db_path}")
            print(json.dumps({"type": "result", "payload": {"success": False, "error": f"Archivo no encontrado: {db_path}"}}))
            return None

        # --- 2. Intentar leer nombres de hojas para debug ---
        try:
            from openpyxl import load_workbook as _load_wb
            wb_tmp = _load_wb(db_path, read_only=True)
            hojas = wb_tmp.sheetnames
            log(f"Hojas detectadas en el archivo: {hojas}")
        except Exception as e:
            log(f"WARNING: no se pudieron listar hojas con openpyxl: {e}")

        # --- 3. Leer la hoja correspondiente ---
        sheet_name = "FORMATO" if str(empresa).upper() == "ASEL" else "COMPLETO"
        log(f"Hoja que intentaremos leer: {sheet_name}")

        try:
            df = pd.read_excel(db_path, sheet_name=sheet_name, dtype=str)
        except Exception as e:
            log(f"ERROR al leer Excel con pandas: {e}")
            # intentar leer sin sheet_name para obtener un error más claro
            try:
                pd.read_excel(db_path, dtype=str)
            except Exception as e2:
                log(f"DEBUG lectura alternativa falló: {e2}")
            print(json.dumps({"type": "result", "payload": {"success": False, "error": f"Error leyendo hoja {sheet_name}: {str(e)}"}}))
            return None

        log(f"Excel leído. Columnas ({len(df.columns)}): {list(df.columns)[:10]}{'...' if len(df.columns)>10 else ''}")
        log(f"Filas en dataframe: {len(df)}")
        # Mostrar primeras 3 filas (para debug sin exponer todo)
        try:
            sample_rows = df.head(3).fillna("").to_dict(orient="records")
            log(f"Primeras filas (muestra): {sample_rows}")
        except Exception as e:
            log(f"WARNING al serializar primeras filas: {e}")

        # --- 4. Detectar la columna de cédula (más tolerante) ---
        col_cedula = next(
            (col for col in df.columns if 'CEDULA' in str(col).upper() or 'IDENTIFICACI' in str(col).upper()),
            None
        )
        log(f"Columna de cédula detectada: {col_cedula}")

        if not col_cedula:
            log("ERROR: No se encontró columna de cédula/identificación en el archivo.")
            print(json.dumps({"type": "result", "payload": {"success": False, "error": "Columna de cédula no encontrada"}}))
            return None

        # --- 5. Normalizar cédulas en la tabla ---
        try:
            df['_cedula_norm'] = (
                df[col_cedula]
                .astype(str)
                .fillna("")
                .str.replace(r'[^0-9]', '', regex=True)
                .str.strip()
            )
            log(f"Valores únicos (muestra) en columna normalizada _cedula_norm: {df['_cedula_norm'].dropna().unique()[:5].tolist()}")
        except Exception as e:
            log(f"ERROR normalizando columna de cédula: {e}")
            print(json.dumps({"type": "result", "payload": {"success": False, "error": "Error normalizando columna de cédula"}}))
            return None

        cedula_limpia = str(cedula).strip()
        cedula_limpia = cedula_limpia.replace('.', '').replace(',', '').replace(' ', '')
        log(f"Cédula de búsqueda normalizada: '{cedula_limpia}'")

        # --- 6. Búsqueda ---
        coinc = df[df['_cedula_norm'] == cedula_limpia]
        log(f"Número de coincidencias encontradas: {len(coinc)}")

        if coinc.empty:
            log(f"No se encontró registro con cédula {cedula_limpia}")
            print(json.dumps({"type": "result", "payload": {"success": False, "error": f"No encontrado: {cedula_limpia}"}}))
            return None

        row = coinc.iloc[0]
        # Mostrar la fila encontrada parcialmente (debug)
        try:
            row_preview = {k: (v if len(str(v))<50 else str(v)[:47]+"...") for k,v in row.to_dict().items()}
            log(f"Fila encontrada (preview): {row_preview}")
        except Exception:
            log("WARNING: no se pudo serializar fila encontrada para preview")

        # Reconstruir nombre si necesario
        posibles_nombres = ["Nombre Completo", "NOMBRE COMPLETO", "NOMBRE", "NOMBRES", "NOMBRES Y APELLIDOS", "NOMBRES COMPLETOS FORMATO"]
        col_nombre = next((c for c in df.columns if c.strip().upper() in [p.upper() for p in posibles_nombres]), None)
        nombre_completo = row.get(col_nombre) if col_nombre else None
        if not nombre_completo or pd.isna(nombre_completo) or not str(nombre_completo).strip():
            partes = [
                row.get("PR. APE.", ""),
                row.get("SEG. APE.", ""),
                row.get("PR. NOM.", ""),
                row.get("SEG. NOM", "")
            ]
            nombre_completo = " ".join([p for p in partes if p]).strip()
            log(f"Nombre reconstruido: {nombre_completo}")

        # Mapear columnas tolerantes
        def buscar_columna(candidatos):
            return next((c for c in df.columns if any(palabra in str(c).upper() for palabra in candidatos)), None)

        col_cargo = buscar_columna(["CARGO"])
        col_empresa_empleadora = next((c for c in df.columns if str(c).strip().upper() == 'EMPRESA'), None)
        col_empresa_usuaria = buscar_columna(["EMPRESA DONDE PRESTA SERVICIO", "EMPRESA USUARIA"])
        col_area = buscar_columna(["UBICACION", "UBICACIÓN", "AREA", "ÁREA", "DEPARTAMENTO"])
        col_genero = buscar_columna(["GENERO", "SEXO"])
        col_entidad = buscar_columna(["EPS", "SURA","EPS/SURA", "ENTIDAD"])
        # 📦467 (2026-07-03) — ARL para autollenado en modal de Gestación (Salud Materna)
        # Antes solo retornaba entidad/EPS; ahora también ARL si la columna existe.
        col_arl = buscar_columna(["ARL"])

        result = {
            "nombre": nombre_completo or "",
            "cargo": (row.get(col_cargo) or "") if col_cargo else "",
            "empresa": (row.get(col_empresa_empleadora) or "") if col_empresa_empleadora else "",
            "empresa_usuaria": (row.get(col_empresa_usuaria) or "") if col_empresa_usuaria else "",
            "area": (row.get(col_area) or "") if col_area else "",  # Departamento/Ubicación
            "genero": (row.get(col_genero) or "") if col_genero else "",
            "entidad": (row.get(col_entidad) or "") if col_entidad else "",  # EPS/SURA
            "arl": (row.get(col_arl) or "") if col_arl else "",  # 📦467
            "_fila_index": int(row.name)
        }

        # Lógica específica para la empresa ASEL
        if str(empresa).upper() == "ASEL":
            result["empresa_usuaria"] = "Comfamiliar"
            col_sede = next((c for c in df.columns if 'SEDE' in str(c).upper()), None)
            if col_sede:
                result["area"] = row.get(col_sede) or ""
            log(f"DEBUG ASEL: empresa_usuaria='{result['empresa_usuaria']}', area='{result['area']}'")

        # Emitir resultado final como JSON (línea única para que Node lo parsee)
        print(json.dumps({"type": "result", "payload": {"success": True, "datos": result}}, ensure_ascii=False))
        log("Busqueda completada y resultado impreso (result).")
        return result

    except Exception as e:
        log(f"EXCEPCIÓN en buscar_empleado_por_cedula: {str(e)}")
        import traceback
        log(traceback.format_exc())
        print(json.dumps({"type": "result", "payload": {"success": False, "error": str(e)}}))
        return None


def buscar_cie10_descripcion(file_path, cie10_code):
    """
    Busca la descripción de un código CIE-10 en el archivo de ausentismo.
    """
    try:
        log(f"Inicio buscar_cie10_descripcion: file_path={file_path}, cie10_code={cie10_code}")

        if not os.path.exists(file_path):
            log(f"ERROR: Archivo no encontrado en ruta: {file_path}")
            print(json.dumps({"type": "result", "payload": {"success": False, "error": f"Archivo no encontrado: {file_path}"}}))
            return None

        # Intentar leer la hoja específica, pero con detección más flexible de hojas CIE-10
        sheet_name = "CIE-10 PARA RIPS"
        log(f"Hoja que intentaremos leer: {sheet_name}")

        # --- 1. Intentar leer la hoja específica ---
        try:
            df = pd.read_excel(file_path, sheet_name=sheet_name, dtype=str, header=None)
        except Exception as e:
            log(f"ERROR al leer hoja '{sheet_name}': {e}")

            # --- 2. Intentar detectar la hoja correcta ---
            try:
                from openpyxl import load_workbook as _load_wb
                wb_tmp = _load_wb(file_path, read_only=True)
                hojas = wb_tmp.sheetnames
                log(f"Hojas detectadas en el archivo: {hojas}")

                # Buscar hoja que contenga "CIE", "CIE-10", "DIAGNOSTICO", "DIAGNÓSTICO"
                sheet_candidates = [s for s in hojas if any(keyword in s.upper() for keyword in ["CIE", "DIAGNOST", "DIAGNÓST", "ENFERM"])]
                log(f"Candidatos para hoja CIE-10: {sheet_candidates}")

                if sheet_candidates:
                    # Tomar el primer candidato que contenga "CIE"
                    cie_candidates = [s for s in sheet_candidates if "CIE" in s.upper()]
                    sheet_name = cie_candidates[0] if cie_candidates else sheet_candidates[0]
                    log(f"Usando hoja detectada: {sheet_name}")

                    df = pd.read_excel(file_path, sheet_name=sheet_name, dtype=str, header=None)
                else:
                    # Si no encontramos hoja candidata, intentar leer la primera hoja
                    log("No se encontraron hojas candidatas para CIE-10, intentando primera hoja")
                    df = pd.read_excel(file_path, sheet_name=hojas[0], dtype=str, header=None)
                    sheet_name = hojas[0]

            except Exception as e2:
                log(f"ERROR al leer archivo Excel con detección automática: {e2}")
                print(json.dumps({"type": "result", "payload": {"success": False, "error": f"Error leyendo hoja {sheet_name}: {str(e2)}"}}))
                return None

        log(f"Excel leído. {len(df)} filas, {len(df.columns)} columnas.")

        # Determinar columnas de código y descripción
        # Suponemos que la primera columna tiene códigos y la segunda tiene descripciones
        if len(df.columns) >= 2:
            df.columns = ['codigo', 'descripcion'] + [f'col_{i}' for i in range(2, len(df.columns))]
        else:
            log("ERROR: No hay suficientes columnas en la hoja para código y descripción")
            print(json.dumps({"type": "result", "payload": {"success": False, "error": "No hay suficientes columnas en la hoja CIE-10"}}))
            return None

        # Normalizar código de búsqueda
        codigo_limpio = str(cie10_code).strip().upper()
        log(f"Código CIE-10 de búsqueda normalizado: '{codigo_limpio}'")

        # Normalizar columna de códigos en el dataframe
        df['codigo_norm'] = df['codigo'].astype(str).str.strip().str.upper()

        coinc = df[df['codigo_norm'] == codigo_limpio]
        log(f"Número de coincidencias encontradas: {len(coinc)}")

        if coinc.empty:
            # Intentar con variaciones del código (ej. con y sin puntos)
            codigo_limpio_puntos = codigo_limpio.replace('.', '')
            coinc = df[df['codigo_norm'].str.replace('.', '') == codigo_limpio_puntos]
            log(f"Intentando con código sin puntos, coincidencias: {len(coinc)}")

            if coinc.empty:
                log(f"No se encontró registro con código CIE-10 {codigo_limpio} (ni sin puntos)")
                print(json.dumps({"type": "result", "payload": {"success": False, "error": f"No encontrado: {codigo_limpio}"}}))
                return None

        descripcion = coinc.iloc[0]['descripcion']
        log(f"Descripción encontrada: {descripcion}")

        result = {
            "descripcion": descripcion
        }

        print(json.dumps({"type": "result", "payload": {"success": True, "datos": result}}, ensure_ascii=False))
        log("Búsqueda de CIE-10 completada y resultado impreso.")
        return result

    except Exception as e:
        log(f"EXCEPCIÓN en buscar_cie10_descripcion: {str(e)}")
        import traceback
        log(traceback.format_exc())
        print(json.dumps({"type": "result", "payload": {"success": False, "error": str(e)}}))
        return None


def actualizar_ausentismo(empresa, input_path):
    try:
        log(f"Iniciando actualización de ausentismo para: {empresa}")
        input_path = Path(input_path)
        if not input_path.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {input_path}")

        # --- 1. Cargar el archivo original como PLANTILLA (para preservar formato) ---
        wb = load_workbook(input_path)
        ws = wb.active

        # --- 2. Leer los datos actuales (desde la fila 8 en adelante) ---
        df = pd.read_excel(input_path, header=6, dtype=str)  # Fila 7 = encabezados
        log(f"Datos leídos: {len(df)} filas")

        # --- 3. Realizar cálculos en Python (ejemplo: limpiar y recalcular) ---
        # Asegurar que "N° DIAS DE INCAPACIDAD" sea numérico
        if 'N° DIAS DE INCAPACIDAD' in df.columns:
            df['N° DIAS DE INCAPACIDAD'] = pd.to_numeric(
                df['N° DIAS DE INCAPACIDAD'].astype(str).str.replace(',', ''),
                errors='coerce'
            ).fillna(0).astype(int)

        # Ejemplo: Rellenar columna "> 10 Dias"
        if '> 10 Dias' in df.columns and 'N° DIAS DE INCAPACIDAD' in df.columns:
            df['> 10 Dias'] = df['N° DIAS DE INCAPACIDAD'].apply(
                lambda x: str(x) if x > 10 else ""
            )

        # Ejemplo: Columna "A. Inc." = Año de incapacidad
        if 'A. Inc.' in df.columns and 'AÑO' in df.columns:
            df['A. Inc.'] = df['AÑO']

        # Ejemplo: Columna "M. Inc." = Mes en minúsculas
        if 'M. Inc.' in df.columns and 'MES' in df.columns:
            df['M. Inc.'] = df['MES'].str.lower()

        # Ejemplo: Recalcular "Concepto" basado en otras columnas
        if 'Concepto' in df.columns:
            df['Concepto'] = df.apply(lambda row: f"{row.get('CODIGO', '')}, {row.get('DESCRIPCION', '')}" if pd.notna(row.get('CODIGO')) else "", axis=1)

        # Ejemplo: Recalcular "Descripción" si es necesario
        if 'Descripción' in df.columns:
            df['Descripción'] = df.apply(lambda row: f"{row.get('DESCRIPCION', '')}" if pd.notna(row.get('DESCRIPCION')) else "", axis=1)

        # Otros cálculos específicos que puedan estar en tus fórmulas
        # Por ejemplo, cálculo de totales o promedios si están en columnas calculadas
        if 'CLASE DE INCAPACIDAD' in df.columns:
            # Contar tipos de incapacidades
            incapacidades_por_tipo = df['CLASE DE INCAPACIDAD'].value_counts()
            log(f"Incapacidades por tipo: {incapacidades_por_tipo.to_dict()}")

        # Calcular total de días de incapacidades
        total_dias = df['N° DIAS DE INCAPACIDAD'].sum() if 'N° DIAS DE INCAPACIDAD' in df.columns else 0
        log(f"Total días de incapacidad: {total_dias}")

        # Agrupar por mes si la columna existe
        if 'MES' in df.columns:
            incapacidades_por_mes = df.groupby('MES')['N° DIAS DE INCAPACIDAD'].sum()
            log(f"Incapacidades por mes: {incapacidades_por_mes.to_dict()}")

        log("Cálculos completados en memoria")

        # --- 4. Sobrescribir SOLO las filas de datos (fila 8 en adelante) ---
        start_row = 8
        for r_idx, row in enumerate(df.values, start=start_row):
            for c_idx, value in enumerate(row, start=1):
                # Convertir valores NaN a cadena vacía para evitar problemas en Excel
                cell_value = value if pd.notna(value) else ""
                ws.cell(row=r_idx, column=c_idx, value=cell_value)

        # --- 5. Actualizar posibles totales o resúmenes en otras partes de la hoja ---
        # Actualizar celdas específicas que normalmente contendrían fórmulas de resumen
        # Por ejemplo, si hay totales en celdas específicas, aquí puedes actualizarlos

        # Ejemplo: Actualizar celda con total de días (ajusta según tu archivo)
        try:
            # Buscar y actualizar celda de totales si están en posiciones fijas
            for row in range(1, ws.max_row + 1):
                for col in range(1, ws.max_column + 1):
                    cell = ws.cell(row=row, column=col)
                    if cell.value and isinstance(cell.value, str):
                        # Si hay celdas con fórmulas como texto, podrías actualizarlas aquí
                        # Por ejemplo, si hay una celda que debe mostrar el total de incapacidades
                        if 'TOTAL' in cell.value.upper():
                            cell.value = f"TOTAL INCAPACIDADES: {len(df)}"
        except Exception as e:
            log(f"Advertencia al actualizar celdas específicas: {str(e)}")

        # --- 5. Guardar copia actualizada ---
        output_path = input_path.parent / f"{input_path.stem}_actualizado{input_path.suffix}"
        wb.save(output_path)
        log(f"✅ Archivo actualizado guardado: {output_path}")

        return str(output_path)

    except Exception as e:
        log(f"❌ Error: {str(e)}")
        raise

def buscar_empleado_main(cedula, empresa):
    """
    Función principal para buscar empleado, usada por el IPC handler
    """
    try:
        resultado = buscar_empleado_por_cedula(cedula, empresa)
        if resultado:
            return {
                "success": True,
                "datos": resultado
            }
        else:
            return {
                "success": False,
                "error": f"No se encontró empleado con cédula {cedula} en la base de datos de {empresa}"
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def cargar_todos_registros_pri(empresa, file_path):
    """
    Carga TODOS los registros de PRI.xlsx (hoja "Casos en seguimiento")
    Retorna lista de todos los registros con TODA su información (trabajador, incapacidad, pric, calificacion, recomendaciones)
    """
    try:
        log(f"📥 Cargando todos los registros de PRI.xlsx para empresa: {empresa}")

        if not os.path.exists(file_path):
            return {"success": False, "error": "El archivo PRI.xlsx no existe"}

        wb = load_workbook(file_path)
        SHEET_NAME = "Casos en seguimiento"

        if SHEET_NAME not in wb.sheetnames:
            return {"success": False, "error": f"La hoja '{SHEET_NAME}' no existe"}

        ws = wb[SHEET_NAME]
        registros_encontrados = []

        # Buscar desde fila 7 (datos comienzan ahí)
        for fila_idx in range(7, ws.max_row + 1):
            celda_cedula = ws[f"D{fila_idx}"].value
            if not celda_cedula:
                continue  # Saltar filas vacías

            # ============================================
            # LEER TODOS LOS DATOS DEL REGISTRO
            # ============================================

            # --- 1. Datos del Trabajador (columnas B-W) ---
            tipo_evento = ws[f"B{fila_idx}"].value or ""
            nombre = ws[f"C{fila_idx}"].value or ""
            genero = ws[f"E{fila_idx}"].value or ""
            fecha_nacimiento = str(ws[f"F{fila_idx}"].value) if ws[f"F{fila_idx}"].value else ""
            fecha_ingreso = str(ws[f"H{fila_idx}"].value) if ws[f"H{fila_idx}"].value else ""
            salario = ws[f"L{fila_idx}"].value or ""
            area = ws[f"M{fila_idx}"].value or ""
            cargo = ws[f"N{fila_idx}"].value or ""
            tipo_cargo = ws[f"O{fila_idx}"].value or ""
            tipo_contrato = ws[f"P{fila_idx}"].value or ""
            eps = ws[f"Q{fila_idx}"].value or ""
            afp = ws[f"R{fila_idx}"].value or ""
            peso = ws[f"S{fila_idx}"].value or ""
            talla = ws[f"T{fila_idx}"].value or ""
            imc = ws[f"U{fila_idx}"].value or ""
            dominancia = ws[f"W{fila_idx}"].value or ""
            actividades_extralaborales = ws[f"X{fila_idx}"].value or ""

            # --- 2. Incapacidad Temporal (columnas Y-AX) ---
            dias_acumulados = ws[f"Y{fila_idx}"].value or ""
            fecha_inicio = str(ws[f"Z{fila_idx}"].value) if ws[f"Z{fila_idx}"].value else ""
            fecha_fin = str(ws[f"AA{fila_idx}"].value) if ws[f"AA{fila_idx}"].value else ""
            codigo_cie10 = ws[f"AB{fila_idx}"].value or ""
            descripcion_diagnostico = ws[f"AC{fila_idx}"].value or ""
            clase = ws[f"AM{fila_idx}"].value or ""

            # CIE-10 DX2, DX3 y orígenes (columnas AO-AR)
            cie10_dx2 = ws[f"AO{fila_idx}"].value or ""
            origen_dx2 = ws[f"AP{fila_idx}"].value or ""
            cie10_dx3 = ws[f"AQ{fila_idx}"].value or ""
            origen_dx3 = ws[f"AR{fila_idx}"].value or ""

            # Número de prórrogas y fecha última prórroga
            numero_prorrogas = ws[f"AD{fila_idx}"].value or ""
            fecha_ultima_prorroga = str(ws[f"AE{fila_idx}"].value) if ws[f"AE{fila_idx}"].value else ""

            # Leer seguimientos múltiples (columnas AD-AE, AF-AG, AH-AI, AJ-AK, AL-AM)
            seguimientos = []
            for i in range(5):
                idx_fecha = 29 + (i * 2)  # 29, 31, 33, 35, 37
                idx_desc = 30 + (i * 2)   # 30, 32, 34, 36, 38
                col_fecha = chr(65 + idx_fecha) if idx_fecha < 26 else chr(65 + (idx_fecha // 26 - 1)) + chr(65 + (idx_fecha % 26))
                col_desc = chr(65 + idx_desc) if idx_desc < 26 else chr(65 + (idx_desc // 26 - 1)) + chr(65 + (idx_desc % 26))
                
                fecha_seg = ws[f"{col_fecha}{fila_idx}"].value
                desc_seg = ws[f"{col_desc}{fila_idx}"].value
                
                if fecha_seg or desc_seg:
                    seguimientos.append({
                        "fecha": str(fecha_seg) if fecha_seg else "",
                        "descripcion": desc_seg or ""
                    })

            # --- 3. PRIC (columnas AY-CU) ---
            # Condiciones de Salud (columnas AY-BD)
            fecha_examen_medico = str(ws[f"AY{fila_idx}"].value) if ws[f"AY{fila_idx}"].value else ""
            resultado_examen_medico = ws[f"AZ{fila_idx}"].value or ""
            fecha_examen_periodico = str(ws[f"BA{fila_idx}"].value) if ws[f"BA{fila_idx}"].value else ""
            resultado_examen_post_incapacidad = ws[f"BB{fila_idx}"].value or ""
            trabajador_remoto = ws[f"BC{fila_idx}"].value or ""
            fecha_inicio_remoto = str(ws[f"BD{fila_idx}"].value) if ws[f"BD{fila_idx}"].value else ""

            # Etapa 1: Captura de Caso (columnas BE-BG)
            caso_ingresado_pric = ws[f"BE{fila_idx}"].value or ""
            mecanismo_deteccion = ws[f"BF{fila_idx}"].value or ""
            fecha_ingreso_pric = str(ws[f"BG{fila_idx}"].value) if ws[f"BG{fila_idx}"].value else ""

            # Etapa 2: Plan de Tratamiento (columnas BH-BK)
            trabajador_plan_tratamiento = ws[f"BH{fila_idx}"].value or ""
            meta_rehabilitacion = ws[f"BI{fila_idx}"].value or ""
            fecha_emision_plan = str(ws[f"BJ{fila_idx}"].value) if ws[f"BJ{fila_idx}"].value else ""
            fecha_probable_reintegro = str(ws[f"BK{fila_idx}"].value) if ws[f"BK{fila_idx}"].value else ""

            # Etapa 3: Ejecución y Seguimiento (columnas BL-BW)
            fecha_proxima_cita = str(ws[f"BL{fila_idx}"].value) if ws[f"BL{fila_idx}"].value else ""
            observaciones_seguimiento = ws[f"BM{fila_idx}"].value or ""
            fecha_apt_reincorporacion = str(ws[f"BN{fila_idx}"].value) if ws[f"BN{fila_idx}"].value else ""
            modalidad_reincorporacion = ws[f"BO{fila_idx}"].value or ""
            fecha_reintegro = str(ws[f"BP{fila_idx}"].value) if ws[f"BP{fila_idx}"].value else ""
            periodicidad_seguimiento = ws[f"BQ{fila_idx}"].value or ""
            recomendaciones_laborales = ws[f"BR{fila_idx}"].value or ""
            fecha_vencimiento_recomendaciones = str(ws[f"BS{fila_idx}"].value) if ws[f"BS{fila_idx}"].value else ""
            descripcion_recomendaciones = ws[f"BT{fila_idx}"].value or ""
            fecha_proximo_seguimiento_recomendaciones = str(ws[f"BU{fila_idx}"].value) if ws[f"BU{fila_idx}"].value else ""
            tiene_desercion = ws[f"BV{fila_idx}"].value or ""
            logro_mejoria_medica = ws[f"BW{fila_idx}"].value or ""

            # Seguimientos adicionales (columnas BX-CA)
            fecha_seguimiento_1 = str(ws[f"BX{fila_idx}"].value) if ws[f"BX{fila_idx}"].value else ""
            descripcion_seguimiento_1 = ws[f"BY{fila_idx}"].value or ""
            fecha_seguimiento_2 = str(ws[f"BZ{fila_idx}"].value) if ws[f"BZ{fila_idx}"].value else ""
            descripcion_seguimiento_2 = ws[f"CA{fila_idx}"].value or ""

            # Etapa 4: Reincorporación Laboral (columnas CB-CD)
            fecha_reincorporacion = str(ws[f"CB{fila_idx}"].value) if ws[f"CB{fila_idx}"].value else ""
            tipo_reintegro = ws[f"CC{fila_idx}"].value or ""
            adaptaciones = ws[f"CD{fila_idx}"].value or ""

            # 📦459 (2026-07-02) — FIX: leer de AV/AW en vez de CE/CF.
            # BUG RAÍZ: guardar_seguimiento escribe fechaCierre/motivoCierre en AV/AW
            # (índice 47-48, desde incapacidad.fechaCierre). Pero este handler
            # leía de CE/CF (índice 82-83, desde pric.fechaCierre que el frontend
            # nunca envía). Resultado: siempre retornaba vacío aunque los datos
            # estuvieran escritos en el Excel. Ahora lee de las columnas correctas.
            fecha_cierre = str(ws[f"AV{fila_idx}"].value) if ws[f"AV{fila_idx}"].value else ""
            motivo_cierre = ws[f"AW{fila_idx}"].value or ""
            fecha_calificacion_pcl = str(ws[f"CG{fila_idx}"].value) if ws[f"CG{fila_idx}"].value else ""
            porcentaje_pcl_calificacion = ws[f"CH{fila_idx}"].value or ""

            # Historial de Diagnóstico (columnas CI-CT)
            cie10_calificada_dx1 = ws[f"CI{fila_idx}"].value or ""
            origen_dx1 = ws[f"CJ{fila_idx}"].value or ""
            cie10_calificada_dx2 = ws[f"CK{fila_idx}"].value or ""
            origen_dx2_calificada = ws[f"CL{fila_idx}"].value or ""
            cie10_calificada_dx3 = ws[f"CM{fila_idx}"].value or ""
            origen_dx3_calificada = ws[f"CN{fila_idx}"].value or ""
            cie10_calificada_dx4 = ws[f"CO{fila_idx}"].value or ""
            origen_dx4_calificada = ws[f"CP{fila_idx}"].value or ""
            origen_caso = ws[f"CQ{fila_idx}"].value or ""
            ingreso_sve = ws[f"CR{fila_idx}"].value or ""
            anio_ultima_calificacion_pcl = ws[f"CS{fila_idx}"].value or ""
            anio_seguimiento_empresa = ws[f"CT{fila_idx}"].value or ""

            # --- 4. Calificación PCL (columnas FC-FP) ---
            # Calificación Regional (columnas FC-FI)
            estado_proceso_regional = ws[f"FC{fila_idx}"].value or ""
            fecha_solicitud_regional = str(ws[f"FD{fila_idx}"].value) if ws[f"FD{fila_idx}"].value else ""
            fecha_dictamen_regional = str(ws[f"FE{fila_idx}"].value) if ws[f"FE{fila_idx}"].value else ""
            porcentaje_pcl_regional = ws[f"FF{fila_idx}"].value or ""
            origen_calificacion_regional = ws[f"FG{fila_idx}"].value or ""
            fecha_estructuracion_regional = str(ws[f"FH{fila_idx}"].value) if ws[f"FH{fila_idx}"].value else ""
            observaciones_calificacion_regional = ws[f"FI{fila_idx}"].value or ""

            # Calificación Nacional (columnas FJ-FP)
            estado_proceso_nacional = ws[f"FJ{fila_idx}"].value or ""
            fecha_solicitud_nacional = str(ws[f"FK{fila_idx}"].value) if ws[f"FK{fila_idx}"].value else ""
            fecha_dictamen_nacional = str(ws[f"FL{fila_idx}"].value) if ws[f"FL{fila_idx}"].value else ""
            porcentaje_pcl_nacional = ws[f"FM{fila_idx}"].value or ""
            origen_calificacion_nacional = ws[f"FN{fila_idx}"].value or ""
            fecha_estructuracion_nacional = str(ws[f"FO{fila_idx}"].value) if ws[f"FO{fila_idx}"].value else ""
            observaciones_calificacion_nacional = ws[f"FP{fila_idx}"].value or ""

            # --- 5. Recomendaciones (columnas FQ en adelante, una fila por recomendación) ---
            # Las recomendaciones están en filas separadas, asociadas por cédula en columna D
            recomendaciones = []
            cedula_limpia_actual = str(celda_cedula).replace(',', '').replace('.', '').replace(' ', '').strip()
            for rec_fila_idx in range(7, ws.max_row + 1):
                celda_cedula_rec = ws[f"D{rec_fila_idx}"].value
                if celda_cedula_rec:
                    cedula_rec_str = str(celda_cedula_rec).replace(',', '').replace('.', '').replace(' ', '').strip()
                    if cedula_rec_str == cedula_limpia_actual:
                        # Verificar si es una fila de recomendación (tiene valor en columna FQ o posterior)
                        recomendacion_texto = ws[f"FQ{rec_fila_idx}"].value
                        if recomendacion_texto:
                            recomendaciones.append({
                                "item": len(recomendaciones) + 1,
                                "recomendacion": recomendacion_texto or "",
                                "entidad": ws[f"FR{rec_fila_idx}"].value or "",
                                "fecha_limite": str(ws[f"FS{rec_fila_idx}"].value) if ws[f"FS{rec_fila_idx}"].value else "",
                                "cumple": ws[f"FT{rec_fila_idx}"].value or "",
                                "observacion": ws[f"FU{rec_fila_idx}"].value or ""
                            })

            # ============================================
            # CONSTRUIR OBJETO REGISTRO
            # ============================================
            registro = {
                "fila": fila_idx,
                "cedula": str(celda_cedula),
                "nombre": nombre,
                "tipo_evento": tipo_evento,
                "genero": genero,
                "fecha_nacimiento": fecha_nacimiento,
                "fecha_ingreso": fecha_ingreso,
                "salario": salario,
                "area": area,
                "cargo": cargo,
                "tipo_cargo": tipo_cargo,
                "tipo_contrato": tipo_contrato,
                "eps": eps,
                "afp": afp,
                "peso": peso,
                "talla": talla,
                "imc": imc,
                "dominancia": dominancia,
                "actividades_extralaborales": actividades_extralaborales,
                "dias_acumulados": dias_acumulados,
                "fecha_inicio": fecha_inicio,
                "fecha_fin": fecha_fin,
                "codigo_cie10": codigo_cie10,
                "descripcion_diagnostico": descripcion_diagnostico,
                "clase": clase,
                "cie10_dx2": cie10_dx2,
                "origen_dx2": origen_dx2,
                "cie10_dx3": cie10_dx3,
                "origen_dx3": origen_dx3,
                "numero_prorrogas": numero_prorrogas,
                "fecha_ultima_prorroga": fecha_ultima_prorroga,
                "seguimientos": seguimientos,
                "pric": {
                    "fechaExamenMedico": fecha_examen_medico,
                    "resultadoExamenMedico": resultado_examen_medico,
                    "fechaExamenPeriodico": fecha_examen_periodico,
                    "resultadoExamenPostIncapacidad": resultado_examen_post_incapacidad,
                    "trabajadorRemoto": trabajador_remoto,
                    "fechaInicioRemoto": fecha_inicio_remoto,
                    "casoIngresadoPRIC": caso_ingresado_pric,
                    "mecanismoDeteccion": mecanismo_deteccion,
                    "fechaIngresoPRIC": fecha_ingreso_pric,
                    "trabajadorPlanTratamiento": trabajador_plan_tratamiento,
                    "metaRehabilitacion": meta_rehabilitacion,
                    "fechaEmisionPlan": fecha_emision_plan,
                    "fechaProbableReintegro": fecha_probable_reintegro,
                    "fechaProximaCita": fecha_proxima_cita,
                    "observacionesSeguimiento": observaciones_seguimiento,
                    "fechaAPTReincorporacion": fecha_apt_reincorporacion,
                    "modalidadReincorporacion": modalidad_reincorporacion,
                    "fechaReintegro": fecha_reintegro,
                    "periodicidadSeguimiento": periodicidad_seguimiento,
                    "recomendacionesLaborales": recomendaciones_laborales,
                    "fechaVencimientoRecomendaciones": fecha_vencimiento_recomendaciones,
                    "descripcionRecomendaciones": descripcion_recomendaciones,
                    "fechaProximoSeguimientoRecomendaciones": fecha_proximo_seguimiento_recomendaciones,
                    "tieneDesercion": tiene_desercion,
                    "logroMejoriaMedica": logro_mejoria_medica,
                    "fechaSeguimiento1": fecha_seguimiento_1,
                    "descripcionSeguimiento1": descripcion_seguimiento_1,
                    "fechaSeguimiento2": fecha_seguimiento_2,
                    "descripcionSeguimiento2": descripcion_seguimiento_2,
                    "fechaReincorporacion": fecha_reincorporacion,
                    "tipoReintegro": tipo_reintegro,
                    "adaptaciones": adaptaciones,
                    "fechaCierre": fecha_cierre,
                    "motivoCierre": motivo_cierre,
                    "fechaCalificacionPCL": fecha_calificacion_pcl,
                    "porcentajePCLCalificacion": porcentaje_pcl_calificacion,
                    "cie10CalificadaDX1": cie10_calificada_dx1,
                    "origenDX1": origen_dx1,
                    "cie10CalificadaDX2": cie10_calificada_dx2,
                    "origenDX2": origen_dx2_calificada,
                    "cie10CalificadaDX3": cie10_calificada_dx3,
                    "origenDX3": origen_dx3_calificada,
                    "cie10CalificadaDX4": cie10_calificada_dx4,
                    "origenDX4": origen_dx4_calificada,
                    "origenCaso": origen_caso,
                    "ingresoSVE": ingreso_sve,
                    "anioUltimaCalificacionPCL": anio_ultima_calificacion_pcl,
                    "anioSeguimientoEmpresa": anio_seguimiento_empresa
                },
                "calificacion": {
                    "estadoProcesoRegional": estado_proceso_regional,
                    "fechaSolicitudRegional": fecha_solicitud_regional,
                    "fechaDictamenRegional": fecha_dictamen_regional,
                    "porcentajePclRegional": porcentaje_pcl_regional,
                    "origenCalificacionRegional": origen_calificacion_regional,
                    "fechaEstructuracionRegional": fecha_estructuracion_regional,
                    "observacionesCalificacionRegional": observaciones_calificacion_regional,
                    "estadoProcesoNacional": estado_proceso_nacional,
                    "fechaSolicitudNacional": fecha_solicitud_nacional,
                    "fechaDictamenNacional": fecha_dictamen_nacional,
                    "porcentajePclNacional": porcentaje_pcl_nacional,
                    "origenCalificacionNacional": origen_calificacion_nacional,
                    "fechaEstructuracionNacional": fecha_estructuracion_nacional,
                    "observacionesCalificacionNacional": observaciones_calificacion_nacional
                },
                "recomendaciones": recomendaciones
            }

            registros_encontrados.append(registro)

        log(f"✅ Se encontraron {len(registros_encontrados)} registros en PRI.xlsx")
        return {"success": True, "registros": registros_encontrados, "total": len(registros_encontrados)}

    except Exception as e:
        log(f"❌ Error cargando todos los registros: {str(e)}")
        import traceback
        log(traceback.format_exc())
        return {"success": False, "error": f"Error al cargar registros: {str(e)}"}


def buscar_registros_por_cedula(empresa, file_path, cedula):
    """
    Busca todos los registros existentes con la misma cédula en PRI.xlsx
    Retorna lista de registros encontrados con TODA su información (trabajador, incapacidad, pric, calificacion, recomendaciones)
    """
    try:
        log(f"🔍 Buscando registros con cédula {cedula} en {file_path}")

        if not os.path.exists(file_path):
            return {"success": False, "error": "El archivo PRI.xlsx no existe"}

        wb = load_workbook(file_path)
        SHEET_NAME = "Casos en seguimiento"

        if SHEET_NAME not in wb.sheetnames:
            return {"success": False, "error": f"La hoja '{SHEET_NAME}' no existe"}

        ws = wb[SHEET_NAME]

        # Normalizar cédula buscada
        cedula_busqueda = str(cedula).replace(',', '').replace('.', '').replace(' ', '').strip()

        registros_encontrados = []

        # Buscar desde fila 7 (datos comienzan ahí)
        for fila_idx in range(7, ws.max_row + 1):
            celda_cedula = ws[f"D{fila_idx}"].value
            if celda_cedula:
                celda_cedula_str = str(celda_cedula).replace(',', '').replace('.', '').replace(' ', '').strip()
                if celda_cedula_str == cedula_busqueda:
                    # ============================================
                    # LEER TODOS LOS DATOS DEL REGISTRO
                    # ============================================
                    
                    # --- 1. Datos del Trabajador (columnas B-W) ---
                    tipo_evento = ws[f"B{fila_idx}"].value or ""
                    nombre = ws[f"C{fila_idx}"].value or ""
                    genero = ws[f"E{fila_idx}"].value or ""
                    fecha_nacimiento = str(ws[f"F{fila_idx}"].value) if ws[f"F{fila_idx}"].value else ""
                    fecha_ingreso = str(ws[f"H{fila_idx}"].value) if ws[f"H{fila_idx}"].value else ""
                    salario = ws[f"L{fila_idx}"].value or ""
                    area = ws[f"M{fila_idx}"].value or ""
                    cargo = ws[f"N{fila_idx}"].value or ""
                    tipo_cargo = ws[f"O{fila_idx}"].value or ""
                    tipo_contrato = ws[f"P{fila_idx}"].value or ""
                    eps = ws[f"Q{fila_idx}"].value or ""
                    afp = ws[f"R{fila_idx}"].value or ""
                    peso = ws[f"S{fila_idx}"].value or ""
                    talla = ws[f"T{fila_idx}"].value or ""
                    imc = ws[f"U{fila_idx}"].value or ""
                    dominancia = ws[f"W{fila_idx}"].value or ""
                    actividades_extralaborales = ws[f"X{fila_idx}"].value or ""

                    # --- 2. Incapacidad Temporal (columnas Y-AX) ---
                    dias_acumulados = ws[f"Y{fila_idx}"].value or ""
                    fecha_inicio = str(ws[f"Z{fila_idx}"].value) if ws[f"Z{fila_idx}"].value else ""
                    fecha_fin = str(ws[f"AA{fila_idx}"].value) if ws[f"AA{fila_idx}"].value else ""
                    codigo_cie10 = ws[f"AB{fila_idx}"].value or ""
                    descripcion_diagnostico = ws[f"AC{fila_idx}"].value or ""
                    clase = ws[f"AM{fila_idx}"].value or ""
                    
                    # CIE-10 DX2, DX3 y orígenes (columnas AO-AR)
                    cie10_dx2 = ws[f"AO{fila_idx}"].value or ""
                    origen_dx2 = ws[f"AP{fila_idx}"].value or ""
                    cie10_dx3 = ws[f"AQ{fila_idx}"].value or ""
                    origen_dx3 = ws[f"AR{fila_idx}"].value or ""
                    
                    # Número de prórrogas y fecha última prórroga (columnas AD-AE, se asume)
                    numero_prorrogas = ws[f"AD{fila_idx}"].value or ""
                    fecha_ultima_prorroga = str(ws[f"AE{fila_idx}"].value) if ws[f"AE{fila_idx}"].value else ""

                    # Leer seguimientos múltiples (columnas AD-AE, AF-AG, AH-AI, AJ-AK, AL-AM)
                    seguimientos = []
                    for i in range(5):
                        idx_fecha = 29 + (i * 2)  # 29, 31, 33, 35, 37
                        idx_desc = 30 + (i * 2)   # 30, 32, 34, 36, 38
                        col_fecha = chr(65 + idx_fecha) if idx_fecha < 26 else chr(65 + (idx_fecha // 26 - 1)) + chr(65 + (idx_fecha % 26))
                        col_desc = chr(65 + idx_desc) if idx_desc < 26 else chr(65 + (idx_desc // 26 - 1)) + chr(65 + (idx_desc % 26))

                        fecha_val = ws[f"{col_fecha}{fila_idx}"].value
                        desc_val = ws[f"{col_desc}{fila_idx}"].value

                        if fecha_val or desc_val:
                            seguimientos.append({
                                "fecha": str(fecha_val) if fecha_val else "",
                                "descripcion": str(desc_val) if desc_val else ""
                            })

                    # Etapa 4: Reincorporación Laboral - de incapacidad (columnas AS-AU)
                    fecha_reincorporacion_inc = ws[f"AS{fila_idx}"].value or ""
                    tipo_reintegro_inc = ws[f"AT{fila_idx}"].value or ""
                    adaptaciones_inc = ws[f"AU{fila_idx}"].value or ""

                    # Etapa 5: Cierre de Caso - de incapacidad (columnas AV-AX)
                    fecha_cierre_inc = ws[f"AV{fila_idx}"].value or ""
                    motivo_cierre_inc = ws[f"AW{fila_idx}"].value or ""
                    observaciones_finales_inc = ws[f"AX{fila_idx}"].value or ""

                    # --- 3. Etapas PRIC (columnas AY-BW) ---
                    # Condiciones de Salud (AY-BD)
                    fecha_examen_medico = ws[f"AY{fila_idx}"].value or ""
                    resultado_examen_medico = ws[f"AZ{fila_idx}"].value or ""
                    fecha_examen_periodico = ws[f"BA{fila_idx}"].value or ""
                    resultado_examen_post_incapacidad = ws[f"BB{fila_idx}"].value or ""
                    trabajador_remoto = ws[f"BC{fila_idx}"].value or ""
                    fecha_inicio_remoto = ws[f"BD{fila_idx}"].value or ""
                    
                    # Etapa 1: Captura de Caso (BE-BG)
                    caso_ingresado_pric = ws[f"BE{fila_idx}"].value or ""
                    mecanismo_deteccion = ws[f"BF{fila_idx}"].value or ""
                    fecha_ingreso_pric = ws[f"BG{fila_idx}"].value or ""
                    
                    # Etapa 2: Plan de Tratamiento (BH-BK)
                    trabajador_plan_tratamiento = ws[f"BH{fila_idx}"].value or ""
                    meta_rehabilitacion = ws[f"BI{fila_idx}"].value or ""
                    fecha_emision_plan = ws[f"BJ{fila_idx}"].value or ""
                    fecha_probable_reintegro = ws[f"BK{fila_idx}"].value or ""
                    
                    # Etapa 3: Ejecución y Seguimiento (BL-BW)
                    fecha_proxima_cita = ws[f"BL{fila_idx}"].value or ""
                    observaciones_seguimiento = ws[f"BM{fila_idx}"].value or ""
                    fecha_apt_reincorporacion = ws[f"BN{fila_idx}"].value or ""
                    modalidad_reincorporacion = ws[f"BO{fila_idx}"].value or ""
                    fecha_reintegro = ws[f"BP{fila_idx}"].value or ""
                    periodicidad_seguimiento = ws[f"BQ{fila_idx}"].value or ""
                    recomendaciones_laborales = ws[f"BR{fila_idx}"].value or ""
                    fecha_vencimiento_recomendaciones = ws[f"BS{fila_idx}"].value or ""
                    descripcion_recomendaciones = ws[f"BT{fila_idx}"].value or ""
                    fecha_proximo_seguimiento_recomendaciones = ws[f"BU{fila_idx}"].value or ""
                    tiene_desercion = ws[f"BV{fila_idx}"].value or ""
                    logro_mejoria_medica = ws[f"BW{fila_idx}"].value or ""
                    
                    # Seguimientos adicionales (BX-CA)
                    fecha_seguimiento_1 = ws[f"BX{fila_idx}"].value or ""
                    descripcion_seguimiento_1 = ws[f"BY{fila_idx}"].value or ""
                    fecha_seguimiento_2 = ws[f"BZ{fila_idx}"].value or ""
                    descripcion_seguimiento_2 = ws[f"CA{fila_idx}"].value or ""
                    
                    # Etapa 4: Reincorporación Laboral - de pric (CB-CD)
                    fecha_reincorporacion_pric = ws[f"CB{fila_idx}"].value or ""
                    tipo_reintegro_pric = ws[f"CC{fila_idx}"].value or ""
                    adaptaciones_pric = ws[f"CD{fila_idx}"].value or ""
                    
                    # Etapa 5: Cierre de Caso - de pric (CE-CH)
                    fecha_cierre_pric = ws[f"CE{fila_idx}"].value or ""
                    motivo_cierre_pric = ws[f"CF{fila_idx}"].value or ""
                    fecha_calificacion_pcl = ws[f"CG{fila_idx}"].value or ""
                    porcentaje_pcl_calificacion = ws[f"CH{fila_idx}"].value or ""
                    
                    # Historial de Diagnóstico (CI-CT)
                    cie10_calificada_dx1 = ws[f"CI{fila_idx}"].value or ""
                    origen_dx1 = ws[f"CJ{fila_idx}"].value or ""
                    cie10_calificada_dx2 = ws[f"CK{fila_idx}"].value or ""
                    origen_dx2 = ws[f"CL{fila_idx}"].value or ""
                    cie10_calificada_dx3 = ws[f"CM{fila_idx}"].value or ""
                    origen_dx3 = ws[f"CN{fila_idx}"].value or ""
                    cie10_calificada_dx4 = ws[f"CO{fila_idx}"].value or ""
                    origen_dx4 = ws[f"CP{fila_idx}"].value or ""
                    origen_caso = ws[f"CQ{fila_idx}"].value or ""
                    ingreso_sve = ws[f"CR{fila_idx}"].value or ""
                    anio_ultima_calificacion_pcl = ws[f"CS{fila_idx}"].value or ""
                    anio_seguimiento_empresa = ws[f"CT{fila_idx}"].value or ""

                    # --- 4. Calificación PCL (se asume columnas después de CT, verificar) ---
                    # Nota: Si Calificación PCL tiene su propia sección, agregar aquí

                    # --- 5. Recomendaciones Médico Laborales (tabla desde CU en adelante) ---
                    # Cada fila tiene 6 columnas: Item, Recomendación, Entidad, Fecha Límite, Cumple, Observación
                    recomendaciones = []
                    for i in range(10):  # Máximo 10 recomendaciones
                        base_idx = 98 + (i * 6)  # 98, 104, 110, 116, 122, 128, 134, 140, 146, 152
                        col_item = chr(65 + base_idx) if base_idx < 26 else chr(65 + (base_idx // 26 - 1)) + chr(65 + (base_idx % 26))
                        col_rec = chr(65 + base_idx + 1) if base_idx + 1 < 26 else chr(65 + ((base_idx + 1) // 26 - 1)) + chr(65 + ((base_idx + 1) % 26))
                        col_ent = chr(65 + base_idx + 2) if base_idx + 2 < 26 else chr(65 + ((base_idx + 2) // 26 - 1)) + chr(65 + ((base_idx + 2) % 26))
                        col_fecha = chr(65 + base_idx + 3) if base_idx + 3 < 26 else chr(65 + ((base_idx + 3) // 26 - 1)) + chr(65 + ((base_idx + 3) % 26))
                        col_cumple = chr(65 + base_idx + 4) if base_idx + 4 < 26 else chr(65 + ((base_idx + 4) // 26 - 1)) + chr(65 + ((base_idx + 4) % 26))
                        col_obs = chr(65 + base_idx + 5) if base_idx + 5 < 26 else chr(65 + ((base_idx + 5) // 26 - 1)) + chr(65 + ((base_idx + 5) % 26))
                        
                        item_val = ws[f"{col_item}{fila_idx}"].value
                        rec_val = ws[f"{col_rec}{fila_idx}"].value
                        ent_val = ws[f"{col_ent}{fila_idx}"].value
                        fecha_limite_val = str(ws[f"{col_fecha}{fila_idx}"].value) if ws[f"{col_fecha}{fila_idx}"].value else ""
                        cumple_val = ws[f"{col_cumple}{fila_idx}"].value
                        obs_val = ws[f"{col_obs}{fila_idx}"].value
                        
                        # Si al menos hay recomendación o entidad, agregar la fila
                        if rec_val or ent_val:
                            recomendaciones.append({
                                "item": int(item_val) if item_val else i + 1,
                                "recomendacion": rec_val or "",
                                "entidad": ent_val or "",
                                "fechaLimite": fecha_limite_val,
                                "cumple": cumple_val or "",
                                "observacion": obs_val or ""
                            })

                    # Construir el registro completo con TODOS los datos
                    registro = {
                        "fila": fila_idx,
                        # Datos del trabajador
                        "tipo_evento": tipo_evento,
                        "nombre": nombre,
                        "cedula": ws[f"D{fila_idx}"].value or "",
                        "genero": genero,
                        "fecha_nacimiento": fecha_nacimiento,
                        "fecha_ingreso": fecha_ingreso,
                        "salario": salario,
                        "area": area,
                        "cargo": cargo,
                        "tipo_cargo": tipo_cargo,
                        "tipo_contrato": tipo_contrato,
                        "eps": eps,
                        "afp": afp,
                        "peso": peso,
                        "talla": talla,
                        "imc": imc,
                        "dominancia": dominancia,
                        "actividades_extralaborales": actividades_extralaborales,
                        # Datos de incapacidad
                        "fecha_inicio": fecha_inicio,
                        "fecha_fin": fecha_fin,
                        "dias": dias_acumulados,
                        "cie10": codigo_cie10,
                        "clase": clase,
                        "diagnostico": descripcion_diagnostico,
                        "cie10_dx2": cie10_dx2,
                        "origen_dx2": origen_dx2,
                        "cie10_dx3": cie10_dx3,
                        "origen_dx3": origen_dx3,
                        "numero_prorrogas": numero_prorrogas,
                        "fecha_ultima_prorroga": fecha_ultima_prorroga,
                        "seguimientos": seguimientos,
                        # Etapa 4 y 5 - de incapacidad
                        "fecha_reincorporacion": fecha_reincorporacion_inc,
                        "tipo_reintegro": tipo_reintegro_inc,
                        "adaptaciones": adaptaciones_inc,
                        "fecha_cierre": fecha_cierre_inc,
                        "motivo_cierre": motivo_cierre_inc,
                        "observaciones_finales": observaciones_finales_inc,
                        # Datos de PRIC (todos los campos)
                        "pric": {
                            # Condiciones de Salud
                            "fechaExamenMedico": fecha_examen_medico,
                            "resultadoExamenMedico": resultado_examen_medico,
                            "fechaExamenPeriodico": fecha_examen_periodico,
                            "resultadoExamenPostIncapacidad": resultado_examen_post_incapacidad,
                            "trabajadorRemoto": trabajador_remoto,
                            "fechaInicioRemoto": fecha_inicio_remoto,
                            # Etapa 1
                            "casoIngresadoPRIC": caso_ingresado_pric,
                            "mecanismoDeteccion": mecanismo_deteccion,
                            "fechaIngresoPRIC": fecha_ingreso_pric,
                            # Etapa 2
                            "trabajadorPlanTratamiento": trabajador_plan_tratamiento,
                            "metaRehabilitacion": meta_rehabilitacion,
                            "fechaEmisionPlan": fecha_emision_plan,
                            "fechaProbableReintegro": fecha_probable_reintegro,
                            # Etapa 3
                            "fechaProximaCita": fecha_proxima_cita,
                            "observacionesSeguimiento": observaciones_seguimiento,
                            "fechaAPTReincorporacion": fecha_apt_reincorporacion,
                            "modalidadReincorporacion": modalidad_reincorporacion,
                            "fechaReintegro": fecha_reintegro,
                            "periodicidadSeguimiento": periodicidad_seguimiento,
                            "recomendacionesLaborales": recomendaciones_laborales,
                            "fechaVencimientoRecomendaciones": fecha_vencimiento_recomendaciones,
                            "descripcionRecomendaciones": descripcion_recomendaciones,
                            "fechaProximoSeguimientoRecomendaciones": fecha_proximo_seguimiento_recomendaciones,
                            "tieneDesercion": tiene_desercion,
                            "logroMejoriaMedica": logro_mejoria_medica,
                            # Seguimientos adicionales
                            "fechaSeguimiento1": fecha_seguimiento_1,
                            "descripcionSeguimiento1": descripcion_seguimiento_1,
                            "fechaSeguimiento2": fecha_seguimiento_2,
                            "descripcionSeguimiento2": descripcion_seguimiento_2,
                            # Etapa 4 - de pric
                            "fechaReincorporacion": fecha_reincorporacion_pric,
                            "tipoReintegro": tipo_reintegro_pric,
                            "adaptaciones": adaptaciones_pric,
                            # Etapa 5 - de pric
                            "fechaCierre": fecha_cierre_pric,
                            "motivoCierre": motivo_cierre_pric,
                            "fechaCalificacionPCL": fecha_calificacion_pcl,
                            "porcentajePCLCalificacion": porcentaje_pcl_calificacion,
                            # Historial de Diagnóstico
                            "cie10CalificadaDX1": cie10_calificada_dx1,
                            "origenDX1": origen_dx1,
                            "cie10CalificadaDX2": cie10_calificada_dx2,
                            "origenDX2": origen_dx2,
                            "cie10CalificadaDX3": cie10_calificada_dx3,
                            "origenDX3": origen_dx3,
                            "cie10CalificadaDX4": cie10_calificada_dx4,
                            "origenDX4": origen_dx4,
                            "origenCaso": origen_caso,
                            "ingresoSVE": ingreso_sve,
                            "anioUltimaCalificacionPCL": anio_ultima_calificacion_pcl,
                            "anioSeguimientoEmpresa": anio_seguimiento_empresa
                        },
                        # Recomendaciones (tabla)
                        "recomendaciones": recomendaciones
                    }
                    registros_encontrados.append(registro)
                    log(f"   ✅ Registro encontrado en fila {fila_idx}: {nombre}, seguimientos: {len(seguimientos)}, recomendaciones: {len(recomendaciones)}")

        log(f"🔍 Total registros encontrados: {len(registros_encontrados)}")

        return {
            "success": True,
            "cedula": cedula,
            "registros": registros_encontrados,
            "total": len(registros_encontrados)
        }
        
    except Exception as e:
        log(f"❌ Error buscando registros: {str(e)}")
        import traceback
        log(traceback.format_exc())
        return {"success": False, "error": str(e)}


def guardar_seguimiento(empresa, file_path, datos):
    """
    Guarda un seguimiento de incapacidad en el archivo PRI.xlsx,
    en la hoja 'Casos en seguimiento', organizando los datos en las columnas correctas.
    Los encabezados están en filas 5-6, los datos comienzan en fila 7.
    Busca si ya existe un registro con la misma cédula Y las mismas fechas para actualizar.
    Si las fechas son diferentes, crea un nuevo registro.
    """
    try:
        # USAR el archivo que se pasa como parámetro (PRI.xlsx)
        seguimiento_file_path = file_path
        log(f"Guardando seguimiento en archivo: {seguimiento_file_path}")
        log(f"Datos de seguimiento recibidos: {datos}")

        SHEET_NAME = "Casos en seguimiento"

        # Verificar si el archivo existe
        if not os.path.exists(seguimiento_file_path):
            log(f"❌ El archivo PRI.xlsx no existe: {seguimiento_file_path}")
            return {"success": False, "error": "El archivo PRI.xlsx no existe"}

        # Cargar el libro de trabajo
        wb = load_workbook(seguimiento_file_path)

        # Verificar si la hoja existe
        if SHEET_NAME not in wb.sheetnames:
            log(f"❌ La hoja '{SHEET_NAME}' no existe en PRI.xlsx")
            return {"success": False, "error": f"La hoja '{SHEET_NAME}' no existe en PRI.xlsx"}

        ws = wb[SHEET_NAME]
        log(f"✅ Usando hoja: {SHEET_NAME}")
        log(f"✅ Filas totales actuales: {ws.max_row}")

        # Extraer cédula del empleado
        empleado_id = str(datos.get("employeeId", "")).replace(',', '').replace('.', '').replace(' ', '').strip()
        empleado_nombre = datos.get("employeeName", "")
        
        # Extraer fecha_fin (identificador único de incapacidad)
        fecha_fin_datos = str(datos.get("fechaFin", "")).strip()
        dias_acumulados_datos = str(datos.get("diasAcumulados", "")).strip()

        log(f"🔍 Buscando registro con cédula: {empleado_id}, fecha_fin: {fecha_fin_datos}")

        # Los encabezados están en filas 5-6, los datos comienzan en fila 7
        primera_fila_datos = 7

        # BUSCAR si ya existe un registro con esta cédula Y las mismas fechas
        fila_existente = None
        for fila_idx in range(primera_fila_datos, ws.max_row + 1):
            celda_cedula = ws[f"D{fila_idx}"].value
            celda_fecha_fin = ws[f"Z{fila_idx}"].value  # Columna Z = Fecha Fin
            
            if celda_cedula:
                cedula_en_celda = str(celda_cedula).replace(',', '').replace('.', '').replace(' ', '').strip()
                
                # Verificar cédula
                if cedula_en_celda == empleado_id:
                    # Verificar fecha_fin (si existe en ambos)
                    if fecha_fin_datos and celda_fecha_fin:
                        celda_fecha_fin_str = str(celda_fecha_fin).strip()
                        # Comparar fechas (normalizar formato)
                        misma_fecha = False
                        try:
                            # Intentar comparar como fechas
                            from datetime import datetime
                            fecha_datos = datetime.strptime(fecha_fin_datos, "%Y-%m-%d")
                            fecha_celda = datetime.strptime(celda_fecha_fin_str, "%Y-%m-%d")
                            misma_fecha = (fecha_datos == fecha_celda)
                        except:
                            # Si falla, comparar como strings
                            misma_fecha = (fecha_fin_datos == celda_fecha_fin_str)
                        
                        if misma_fecha:
                            fila_existente = fila_idx
                            log(f"⚠️ YA EXISTE registro con cédula {empleado_id} Y fecha_fin {fecha_fin_datos} en fila {fila_existente}")
                            log(f"   Nombre: {ws[f'C{fila_existente}'].value}")
                            log(f"   Diagnóstico: {ws[f'AA{fila_existente}'].value}")
                            break
                    else:
                        # Si no hay fecha_fin, solo usar cédula (comportamiento legacy)
                        fila_existente = fila_idx
                        log(f"⚠️ YA EXISTE registro con cédula {empleado_id} (sin fecha) en fila {fila_existente}")
                        break

        # Determinar qué fila usar
        if fila_existente:
            # ACTUALIZAR registro existente (mismas fechas)
            log(f"📝 ACTUALIZANDO registro existente en fila {fila_existente}")
            siguiente_fila = int(fila_existente)
        else:
            # CREAR NUEVO registro (cédula existe pero fechas diferentes, o es nuevo empleado)
            log(f"➕ CREANDO NUEVO registro para cédula {empleado_id} (fechas diferentes o nuevo)")
            
            # Buscar la primera fila vacía comenzando desde la fila 7
            siguiente_fila = int(primera_fila_datos)
            while siguiente_fila <= ws.max_row:
                # Verificar si la fila está vacía (revisar columna C - Nombre)
                if ws[f"C{siguiente_fila}"].value is None or ws[f"C{siguiente_fila}"].value == "":
                    log(f"✅ Primera fila vacía encontrada: {siguiente_fila}")
                    break
                siguiente_fila = int(siguiente_fila) + 1

            # Si todas las filas tienen datos, usar la siguiente fila después de max_row
            if siguiente_fila > ws.max_row:
                log(f"✅ Usando nueva fila: {siguiente_fila}")

        # Debug: Verificar tipo de dato
        log(f"🔍 DEBUG: siguiente_fila = {siguiente_fila}, tipo = {type(siguiente_fila)}")
        
        # ============================================
        # APLANAR DATOS: Extraer todos los campos de los objetos anidados
        # ============================================
        # Los datos vienen anidados: {trabajador: {...}, incapacidad: {...}, pric: {...}, calificacion: {...}}
        # Necesitamos extraerlos al nivel superior para acceder fácilmente
        
        trabajador = datos.get("trabajador", {})
        incapacidad = datos.get("incapacidad", {})
        pric = datos.get("pric", {})
        calificacion = datos.get("calificacion", {})
        recomendaciones = datos.get("recommendations", [])  # Este viene en el nivel superior
        
        log(f"🔍 DEBUG: trabajador={trabajador}")
        log(f"🔍 DEBUG: incapacidad={incapacidad}")
        log(f"🔍 DEBUG: pric={pric}")
        log(f"🔍 DEBUG: recomendaciones count={len(recomendaciones) if recomendaciones else 0}")
        
        # Calcular edad desde fecha de nacimiento
        def calcular_edad(fecha_nacimiento_str):
            if not fecha_nacimiento_str:
                return ""
            try:
                from datetime import datetime
                fecha_nac = datetime.strptime(str(fecha_nacimiento_str), "%Y-%m-%d")
                hoy = datetime.now()
                edad = hoy.year - fecha_nac.year - ((hoy.month, hoy.day) < (fecha_nac.month, fecha_nac.day))
                return str(edad)
            except:
                return ""
        
        # Calcular antigüedad desde fecha de ingreso
        def calcular_antiguedad(fecha_ingreso_str):
            if not fecha_ingreso_str:
                return ""
            try:
                from datetime import datetime
                fecha_ing = datetime.strptime(str(fecha_ingreso_str), "%Y-%m-%d")
                hoy = datetime.now()
                anios = hoy.year - fecha_ing.year - ((hoy.month, hoy.day) < (fecha_ing.month, fecha_ing.day))
                return str(anios)
            except:
                return ""
        
        # Calcular estado nutricional desde IMC
        def calcular_estado_nutricional(imc_str):
            if not imc_str:
                return ""
            try:
                imc = float(imc_str)
                if imc < 18.5:
                    return "Bajo peso"
                elif imc < 25:
                    return "Normal"
                elif imc < 30:
                    return "Sobrepeso"
                elif imc < 35:
                    return "Obesidad Tipo I"
                elif imc < 40:
                    return "Obesidad Tipo II"
                else:
                    return "Obesidad Tipo III"
            except:
                return ""
        
        # Calcular días trabajados desde fecha de ingreso (6 días trabajo, 1 descanso)
        def calcular_dias_trabajados(fecha_ingreso_str):
            if not fecha_ingreso_str:
                return ""
            try:
                from datetime import datetime, timedelta
                fecha_ing = datetime.strptime(str(fecha_ingreso_str), "%Y-%m-%d")
                hoy = datetime.now()
                
                # Calcular días totales desde ingreso
                dias_totales = (hoy - fecha_ing).days
                
                # Calcular semanas completas y días restantes
                semanas = dias_totales // 7
                dias_restantes = dias_totales % 7
                
                # 6 días de trabajo por semana
                dias_trabajados = (semanas * 6) + min(dias_restantes, 6)
                
                return str(dias_trabajados)
            except:
                return ""
        
        # Calcular valores derivados usando datos anidados
        edad = calcular_edad(trabajador.get("fechaNacimiento", ""))
        antiguedad = calcular_antiguedad(trabajador.get("fechaIngreso", ""))
        estado_nutricional = calcular_estado_nutricional(trabajador.get("imc", ""))
        dias_trabajados = calcular_dias_trabajados(trabajador.get("fechaIngreso", ""))
        
        # Construir la fila de datos ORGANIZADA POR COLUMNAS
        # Estructura de columnas según PRI.xlsx (ACTUALIZADA con todas las columnas hasta ER = índice 147):
        # A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10, L=11 (Salario), M=12, N=13, O=14, P=15, Q=16, R=17, S=18, T=19, U=20, V=21, W=22, X=23, Y=24, Z=25 (Fecha Inicio), AA=26 (Fecha Fin), AB=27 (Código CIE-10), AC=28 (Descripción Diagnóstico), AD=29, AE=30, AF=31, AG=32, AH=33, AI=34, AJ=35, AK=36, AL=37, AM=38, AN=39, AO=40, AP=41, AQ=42, AR=43, AS=44, AT=45, AU=46, AV=47, AW=48, AX=49
        # Etapas PRIC: AY=50, AZ=51, BA=52, BB=53, BC=54, BD=55, BE=56, BF=57, BG=58, BH=59, BI=60, BJ=61, BK=62, BL=63, BM=64, BN=65, BO=66, BP=67, BQ=68, BR=69, BS=70, BT=71, BU=72, BV=73, BW=74
        # Seguimientos: BX=75, BY=76, BZ=77, CA=78
        # Etapa 4: CB=79, CC=80, CD=81
        # Etapa 5: CE=82, CF=83, CG=84, CH=85
        # Historial DX: CI=86, CJ=87, CK=88, CL=89, CM=90, CN=91, CO=92, CP=93, CQ=94, CR=95, CS=96, CT=97
        # Recomendaciones (tabla hasta 10 filas): CU=98, CV=99, CW=100, CX=101, CY=102, CZ=103, DA=104, DB=105, DC=106, DD=107, DE=108, DF=109, DG=110, DH=111, DI=112, DJ=113, DK=114, DL=115, DM=116, DN=117, DO=118, DP=119, DQ=120, DR=121, DS=122, DT=123, DU=124, DV=125, DW=126, DX=127, DY=128, DZ=129, EA=130, EB=131, EC=132, ED=133, EE=134, EF=135, EG=136, EH=137, EI=138, EJ=139, EK=140, EL=141, EM=142, EN=143, EO=144, EP=145, EQ=146, ER=147, ES=148, ET=149, EU=150, EV=151, EW=152, EX=153, EY=154, EZ=155, FA=156, FB=157

        # Crear una lista con todas las columnas (hasta FB = índice 157)
        fila_completa = [""] * 158  # 158 columnas de A a FB (para soportar 10 recomendaciones de 6 columnas c/u)

        # Asignar valores a las columnas específicas USANDO LOS OBJETOS ANIDADOS
        fila_completa[0] = ""  # A - Índice/Consecutivo (vacío)
        fila_completa[1] = trabajador.get("tipoEvento", "")  # B - TIPO DE EVENTO (índice 1)
        fila_completa[2] = empleado_nombre  # C - Nombre (índice 2)
        fila_completa[3] = empleado_id  # D - Cédula (índice 3)
        fila_completa[4] = trabajador.get("genero", "")  # E - Género (índice 4)
        fila_completa[5] = trabajador.get("fechaNacimiento", "")  # F - Fecha Nacimiento (índice 5)
        fila_completa[6] = edad  # G - Edad (índice 6)
        fila_completa[7] = trabajador.get("fechaIngreso", "")  # H - Fecha Ingreso (índice 7)
        fila_completa[8] = dias_trabajados  # I - Días Trabajados (índice 8)
        fila_completa[9] = antiguedad  # J - Antigüedad (índice 9)
        fila_completa[11] = trabajador.get("salario", "")  # L - Salario Básico (índice 11) 🆕
        fila_completa[12] = trabajador.get("area", "")  # M - Sede/Área (índice 12)
        fila_completa[13] = trabajador.get("cargo", "")  # N - Cargo (índice 13)
        fila_completa[14] = trabajador.get("tipoCargo", "")  # O - Tipo de Cargo (índice 14)
        fila_completa[15] = trabajador.get("tipoContrato", "")  # P - Tipo de Vinculación (índice 15)
        fila_completa[16] = trabajador.get("eps", "")  # Q - EPS (índice 16)
        fila_completa[17] = trabajador.get("afp", "")  # R - AFP (índice 17)
        fila_completa[18] = trabajador.get("peso", "")  # S - Peso (índice 18)
        fila_completa[19] = trabajador.get("talla", "")  # T - Talla (índice 19)
        fila_completa[20] = trabajador.get("imc", "")  # U - IMC (índice 20)
        fila_completa[21] = estado_nutricional  # V - Estado Nutricional (índice 21)
        fila_completa[22] = trabajador.get("dominancia", "")  # W - Dominancia (índice 22)
        fila_completa[23] = trabajador.get("actividadesExtralaborales", "")  # X - Actividades Extralaborales (índice 23)
        fila_completa[24] = incapacidad.get("diasAcumulados", "")  # Y - Total Días Acumulados (índice 24)
        fila_completa[25] = incapacidad.get("fechaInicio", "")  # Z - Fecha Inicio de Incapacidad (índice 25) 🆕
        fila_completa[26] = incapacidad.get("fechaFin", "")  # AA - Fecha Finalización Incapacidad (índice 26)
        fila_completa[27] = incapacidad.get("codigoCie10", "")  # AB - Código CIE-10 (índice 27)
        fila_completa[28] = incapacidad.get("descripcionDiagnostico", "")  # AC - Descripción Diagnóstico (índice 28)
        fila_completa[38] = incapacidad.get("clase", "")  # AM - Clase de Incapacidad (LABORAL/COMÚN) (índice 38)
        fila_completa[40] = incapacidad.get("cie10Dx2", "")  # AO - CIE-10 Incapacidad Temporal DX 2 (índice 40)
        fila_completa[41] = incapacidad.get("origenDx2", "")  # AP - Origen Incapacidad DX 2 (índice 41)
        fila_completa[42] = incapacidad.get("cie10Dx3", "")  # AQ - CIE-10 Incapacidad Temporal DX 3 (índice 42)
        fila_completa[43] = incapacidad.get("origenDx3", "")  # AR - Origen Incapacidad DX 3 (índice 43)

        # Seguimientos (hasta 5 seguimientos con fecha y descripción) - de incapacidad
        seguimientos = incapacidad.get("seguimientos", [])
        if seguimientos and isinstance(seguimientos, list):
            for i, seg in enumerate(seguimientos[:5]):  # Máximo 5 seguimientos
                idx_fecha = 29 + (i * 2)  # 29, 31, 33, 35, 37
                idx_desc = 30 + (i * 2)   # 30, 32, 34, 36, 38
                fila_completa[idx_fecha] = seg.get("fecha", "")
                fila_completa[idx_desc] = seg.get("descripcion", "")
                log(f"   Seguimiento {i+1}: fecha={seg.get('fecha', '')}, desc={seg.get('descripcion', '')[:50]}")

        # 🆕 Etapa 4: Reincorporación Laboral - de incapacidad
        fila_completa[44] = incapacidad.get("fechaReincorporacion", "")  # AS - Fecha Reincorporación (índice 44)
        fila_completa[45] = incapacidad.get("tipoReintegro", "")  # AT - Tipo Reintegro (índice 45)
        fila_completa[46] = incapacidad.get("adaptaciones", "")  # AU - Adaptaciones (índice 46)

        # 🆕 Etapa 5: Cierre de Caso - de incapacidad
        fila_completa[47] = incapacidad.get("fechaCierre", "")  # AV - Fecha Cierre (índice 47)
        fila_completa[48] = incapacidad.get("motivoCierre", "")  # AW - Motivo Cierre (índice 48)
        fila_completa[49] = incapacidad.get("observacionesFinales", "")  # AX - Observaciones Finales (índice 49)

        # 🆕 Condiciones de Salud (índices 50-55) - de pric
        fila_completa[50] = pric.get("fechaExamenMedico", "")  # AY - Fecha Examen Médico Periódico
        fila_completa[51] = pric.get("resultadoExamenMedico", "")  # AZ - Resultado Examen Médico
        fila_completa[52] = pric.get("fechaExamenPeriodico", "")  # BA - Fecha Examen Post Incapacidad
        fila_completa[53] = pric.get("resultadoExamenPostIncapacidad", "")  # BB - Resultado Examen Post Incapacidad
        fila_completa[54] = pric.get("trabajadorRemoto", "")  # BC - Trabajador Remoto (SI/NO)
        fila_completa[55] = pric.get("fechaInicioRemoto", "")  # BD - Fecha Inicio Remoto

        # 🆕 Etapa 1: Captura de Caso (índices 56-58) - de pric
        fila_completa[56] = pric.get("casoIngresadoPRIC", "")  # BE - Caso Ingresado PRIC (SI/NO)
        fila_completa[57] = pric.get("mecanismoDeteccion", "")  # BF - Mecanismo Detección
        fila_completa[58] = pric.get("fechaIngresoPRIC", "")  # BG - Fecha Ingreso PRIC

        # 🆕 Etapa 2: Plan de Tratamiento (índices 59-62) - de pric
        fila_completa[59] = pric.get("trabajadorPlanTratamiento", "")  # BH - Trabajador Plan Tratamiento
        fila_completa[60] = pric.get("metaRehabilitacion", "")  # BI - Meta Rehabilitación
        fila_completa[61] = pric.get("fechaEmisionPlan", "")  # BJ - Fecha Emisión Plan
        fila_completa[62] = pric.get("fechaProbableReintegro", "")  # BK - Fecha Probable Reintegro

        # 🆕 Etapa 3: Ejecución y Seguimiento (índices 63-74) - de pric
        fila_completa[63] = pric.get("fechaProximaCita", "")  # BL - Fecha Próxima Cita
        fila_completa[64] = pric.get("observacionesSeguimiento", "")  # BM - Observaciones Seguimiento
        fila_completa[65] = pric.get("fechaAPTReincorporacion", "")  # BN - Fecha APT Reincorporación
        fila_completa[66] = pric.get("modalidadReincorporacion", "")  # BO - Modalidad Reincorporación
        fila_completa[67] = pric.get("fechaReintegro", "")  # BP - Fecha Reintegro
        fila_completa[68] = pric.get("periodicidadSeguimiento", "")  # BQ - Periodicidad Seguimiento
        fila_completa[69] = pric.get("recomendacionesLaborales", "")  # BR - Recomendaciones Laborales (SI/NO)
        fila_completa[70] = pric.get("fechaVencimientoRecomendaciones", "")  # BS - Fecha Vencimiento Recomendaciones
        fila_completa[71] = pric.get("descripcionRecomendaciones", "")  # BT - Descripción Recomendaciones
        fila_completa[72] = pric.get("fechaProximoSeguimientoRecomendaciones", "")  # BU - Fecha Próximo Seguimiento
        fila_completa[73] = pric.get("tieneDesercion", "")  # BV - Tiene Deserción (SI/NO)
        fila_completa[74] = pric.get("logroMejoriaMedica", "")  # BW - Logró Mejoría Médica (SI/NO)

        # 🆕 Seguimientos adicionales (índices 75-78) - de pric
        fila_completa[75] = pric.get("fechaSeguimiento1", "")  # BX - Fecha Seguimiento 1
        fila_completa[76] = pric.get("descripcionSeguimiento1", "")  # BY - Descripción Seguimiento 1
        fila_completa[77] = pric.get("fechaSeguimiento2", "")  # BZ - Fecha Seguimiento 2
        fila_completa[78] = pric.get("descripcionSeguimiento2", "")  # CA - Descripción Seguimiento 2

        # 🆕 Etapa 4: Reincorporación Laboral (índices 79-81) - de pric
        fila_completa[79] = pric.get("fechaReincorporacion", "")  # CB - Fecha Reincorporación
        fila_completa[80] = pric.get("tipoReintegro", "")  # CC - Tipo Reintegro
        fila_completa[81] = pric.get("adaptaciones", "")  # CD - Adaptaciones

        # 🆕 Etapa 5: Cierre de Caso (índices 82-85) - de pric
        fila_completa[82] = pric.get("fechaCierre", "")  # CE - Fecha Cierre PRIC
        fila_completa[83] = pric.get("motivoCierre", "")  # CF - Motivo Cierre (SI/NO)
        fila_completa[84] = pric.get("fechaCalificacionPCL", "")  # CG - Fecha Calificación PCL
        fila_completa[85] = pric.get("porcentajePCLCalificacion", "")  # CH - Porcentaje PCL

        # 🆕 Historial de Diagnóstico (índices 86-97) - de pric
        fila_completa[86] = pric.get("cie10CalificadaDX1", "")  # CI - CIE-10 DX1 Calificada
        fila_completa[87] = pric.get("origenDX1", "")  # CJ - Origen DX1 (AT/EL)
        fila_completa[88] = pric.get("cie10CalificadaDX2", "")  # CK - CIE-10 DX2 Calificada
        fila_completa[89] = pric.get("origenDX2", "")  # CL - Origen DX2 (AT/EL)
        fila_completa[90] = pric.get("cie10CalificadaDX3", "")  # CM - CIE-10 DX3 Calificada
        fila_completa[91] = pric.get("origenDX3", "")  # CN - Origen DX3 (AT/EL)
        fila_completa[92] = pric.get("cie10CalificadaDX4", "")  # CO - CIE-10 DX4 Calificada
        fila_completa[93] = pric.get("origenDX4", "")  # CP - Origen DX4 (AT/EL)
        fila_completa[94] = pric.get("origenCaso", "")  # CQ - Origen del Caso
        fila_completa[95] = pric.get("ingresoSVE", "")  # CR - Ingreso SVE (SI/NO)
        fila_completa[96] = pric.get("anioUltimaCalificacionPCL", "")  # CS - Año Última Calificación PCL
        fila_completa[97] = pric.get("anioSeguimientoEmpresa", "")  # CT - Año Seguimiento Empresa

        # Extender la lista para soportar columnas hasta FP (índice 171)
        if len(fila_completa) < 172:
            fila_completa.extend([""] * (172 - len(fila_completa)))

        # 🆕 Calificación Regional (índices 158-164) - de calificacion
        # Columnas FC(158), FD(159), FE(160), FF(161), FG(162), FH(163), FI(164)
        fila_completa[158] = calificacion.get("estadoProcesoRegional", "")  # FC - Estado del Proceso Regional
        fila_completa[159] = calificacion.get("fechaSolicitudRegional", "")  # FD - Fecha de Solicitud Regional
        fila_completa[160] = calificacion.get("fechaDictamenRegional", "")  # FE - Fecha de Dictamen Regional
        fila_completa[161] = calificacion.get("porcentajePclRegional", "")  # FF - % PCL Regional
        fila_completa[162] = calificacion.get("origenCalificacionRegional", "")  # FG - Origen Calificado Regional
        fila_completa[163] = calificacion.get("fechaEstructuracionRegional", "")  # FH - Fecha de Estructuración Regional
        fila_completa[164] = calificacion.get("observacionesCalificacionRegional", "")  # FI - Observaciones Calificación Regional

        # 🆕 Calificación Nacional (índices 165-171) - de calificacion
        # Columnas FJ(165), FK(166), FL(167), FM(168), FN(169), FO(170), FP(171)
        fila_completa[165] = calificacion.get("estadoProcesoNacional", "")  # FJ - Estado del Proceso Nacional
        fila_completa[166] = calificacion.get("fechaSolicitudNacional", "")  # FK - Fecha de Solicitud Nacional
        fila_completa[167] = calificacion.get("fechaDictamenNacional", "")  # FL - Fecha de Dictamen Nacional
        fila_completa[168] = calificacion.get("porcentajePclNacional", "")  # FM - % PCL Nacional
        fila_completa[169] = calificacion.get("origenCalificacionNacional", "")  # FN - Origen Calificado Nacional
        fila_completa[170] = calificacion.get("fechaEstructuracionNacional", "")  # FO - Fecha de Estructuración Nacional
        fila_completa[171] = calificacion.get("observacionesCalificacionNacional", "")  # FP - Observaciones Calificación Nacional

        # 🆕 Recomendaciones Médico Laborales (tabla hasta 10 filas, índices 98-147)
        # Cada fila tiene 6 columnas: Item, Recomendación, Entidad, Fecha Límite, Cumple, Observación
        # Fila 1: CU(98), CV(99), CW(100), CX(101), CY(102), CZ(103)
        # Fila 2: DA(104), DB(105), DC(106), DD(107), DE(108), DF(109)
        # Fila 3: DG(110), DH(111), DI(112), DJ(113), DK(114), DL(115)
        # ... hasta Fila 10 (índices 98-147 = 60 columnas totales)

        log(f"🔍 DEBUG: recomendaciones tipo={type(recomendaciones)}, valor={recomendaciones}")
        
        if recomendaciones and isinstance(recomendaciones, list) and len(recomendaciones) > 0:
            for i, rec in enumerate(recomendaciones[:10]):  # Máximo 10 recomendaciones
                # Calcular índices para esta fila de recomendaciones
                # Cada fila usa 6 columnas consecutivas (Item + 5 campos)
                base_idx = 98 + (i * 6)  # 98, 104, 110, 116, 122, 128, 134, 140, 146, 152

                # Asignar valores (6 campos por fila)
                # El Item se calcula automáticamente como i+1
                fila_completa[base_idx] = str(i + 1) if rec.get("item") is None else str(rec.get("item", i + 1))  # Item (numeración automática) - CU, DA, DG, etc.
                fila_completa[base_idx + 1] = rec.get("recomendacion", "")  # Recomendación Emitida - CV, DB, DH, etc.
                fila_completa[base_idx + 2] = rec.get("entidad", "")  # Entidad que Emite - CW, DC, DI, etc.
                fila_completa[base_idx + 3] = rec.get("fechaLimite", "")  # Fecha Límite - CX, DD, DJ, etc.
                fila_completa[base_idx + 4] = rec.get("cumple", "")  # Cumple? (SI/NO/EN PROCESO) - CY, DE, DK, etc.
                fila_completa[base_idx + 5] = rec.get("observacion", "")  # Observación / Evidencia - CZ, DF, DL, etc.

                log(f"   Recomendación {i+1}: item={fila_completa[base_idx]}, rec={rec.get('recomendacion', '')[:30]}, entidad={rec.get('entidad', '')}, cumple={rec.get('cumple', '')}")
        else:
            log("   No hay recomendaciones para guardar")

        # Insertar la fila en la posición correcta
        log(f"📝 {'ACTUALIZANDO' if fila_existente else 'CREANDO'} registro en fila {siguiente_fila}:")
        log(f"   Nombre: {fila_completa[2]}, Cédula: {fila_completa[3]}, Edad: {fila_completa[6]}")
        
        # Insertar datos celda por celda
        def indice_a_columna(idx):
            """Convierte índice numérico a letra de columna Excel (0=A, 25=Z, 26=AA, 27=AB, etc.)"""
            if idx < 26:
                return chr(65 + idx)  # A-Z
            else:
                # Para columnas después de Z: AA, AB, AC, etc.
                return chr(65 + (idx // 26 - 1)) + chr(65 + (idx % 26))
        
        for col_idx, valor in enumerate(fila_completa):
            col_letter = indice_a_columna(col_idx)
            # Asegurar que siguiente_fila sea entero
            fila_num = int(siguiente_fila)
            coordenada = f"{col_letter}{fila_num}"
            log(f"   Escribiendo {coordenada} = {valor if len(str(valor)) < 50 else str(valor)[:50] + '...'}")
            try:
                ws[coordenada] = valor
            except Exception as e:
                log(f"   ❌ Error escribiendo en {coordenada}: {str(e)}")
                raise
        
        wb.save(seguimiento_file_path)
        
        if fila_existente:
            log(f"✅ Registro ACTUALIZADO correctamente en la hoja '{SHEET_NAME}' fila {siguiente_fila}")
        else:
            log(f"✅ Registro CREADO correctamente en la hoja '{SHEET_NAME}' fila {siguiente_fila}")

        return {
            "success": True, 
            "message": "Seguimiento guardado.",
            "fila": siguiente_fila,
            "actualizado": fila_existente is not None,
            **datos
        }

    except Exception as e:
        log(f"❌ Error al guardar seguimiento: {str(e)}")
        import traceback
        log(traceback.format_exc())
        return {"success": False, "error": str(e)}


def normalizar_header(header):
    """
    Normaliza un header para comparación tolerante.
    Elimina espacios, convierte a mayúsculas, normaliza caracteres especiales.
    """
    if not header:
        return ""
    import unicodedata
    # Convertir a mayúsculas, eliminar espacios y normalizar caracteres
    normalized = str(header).upper().strip()
    # Eliminar acentos y caracteres especiales
    normalized = unicodedata.normalize('NFD', normalized)
    normalized = ''.join(c for c in normalized if unicodedata.category(c) != 'Mn')
    # Eliminar espacios adicionales
    normalized = normalized.replace(' ', '').replace('_', '')
    return normalized


def match_header(header, target):
    """
    Compara dos headers de forma tolerante.
    Retorna True si header coincide con target (insensitive, sin espacios, parcial).
    """
    if not header or not target:
        return False
    norm_header = normalizar_header(header)
    norm_target = normalizar_header(target)
    # Coincidencia exacta después de normalizar
    result = norm_header == norm_target
    # Log solo para debugging de área (puedes remover después)
    if "AREA" in norm_header or "DPTO" in norm_header:
        log(f"  [DEBUG match_header] header='{header}' ({norm_header}) vs target='{target}' ({norm_target}) -> {result}")
    return result


def registrar_incapacidad(empresa, file_path, datos):
    """
    Agrega una nueva fila de incapacidad al archivo de ausentismo.
    """
    try:
        log(f"Registrando nueva incapacidad en: {file_path}")
        log(f"Datos recibidos: {datos}")

        # === NORMALIZAR DATOS DEL FRONTEND (camelCase -> snake_case) ===
        # El frontend envía camelCase, normalizamos a snake_case para compatibilidad
        datos_normalizados = {
            "cedula": datos.get("cedula", ""),
            "nombre": datos.get("nombre", ""),
            "cargo": datos.get("cargo", ""),
            "area": datos.get("area", "") or datos.get("departamento", ""),
            "departamento": datos.get("area", "") or datos.get("departamento", ""),
            "empresa_usuaria": datos.get("empresa_usuaria", ""),
            "genero": datos.get("genero", ""),
            "fecha_inicio": datos.get("fechaInicio", "") or datos.get("fecha_inicio", ""),
            "fecha_finalizacion": datos.get("fechaFin", "") or datos.get("fecha_finalizacion", "") or datos.get("fecha_finalización", ""),
            "dias_incapacidad": datos.get("diasIncapacidad", "") or datos.get("dias_incapacidad", ""),
            "tipo_incapacidad": datos.get("tipoIncapacidad", "") or datos.get("tipo_incapacidad", ""),
            "clase_incapacidad": datos.get("claseIncapacidad", "") or datos.get("clase_incapacidad", ""),
            "entidad": datos.get("entidad", ""),
            "codigo": datos.get("codigo", "") or datos.get("codigo_cie10", ""),
            "descripcion": datos.get("descripcion", "") or datos.get("diagnostico", "") or datos.get("diagnóstico", ""),
            "diagnostico": datos.get("descripcion", "") or datos.get("diagnostico", "") or datos.get("diagnóstico", ""),
            "observaciones": datos.get("observaciones", ""),
        }
        # Usar datos normalizados
        datos = datos_normalizados
        log(f"Datos normalizados: {datos}")

        # Cargar el archivo con openpyxl para preservar formato
        wb = load_workbook(file_path)

        # 1. Intentar construir el nombre de la hoja a partir de la empresa
        empresa_normalizada = empresa.strip().upper()
        nombre_hoja_esperado = f"{empresa_normalizada} 2024"

        # 2. Buscar la hoja correcta con lógica de fallback
        nombre_hoja_datos = None

        # a) Primero, intentar con el nombre esperado
        if nombre_hoja_esperado in wb.sheetnames:
            nombre_hoja_datos = nombre_hoja_esperado
            log(f"✅ Hoja encontrada por nombre esperado: {nombre_hoja_datos}")
        else:
            # b) Si no, buscar una hoja que contenga el nombre de la empresa (ignorando mayúsculas)
            candidatos_empresa = [
                name for name in wb.sheetnames
                if empresa_normalizada in name.upper()
            ]
            if candidatos_empresa:
                nombre_hoja_datos = candidatos_empresa[0]
                log(f"✅ Hoja encontrada por coincidencia con empresa: {nombre_hoja_datos}")
            else:
                # c) Si no, buscar una hoja que contenga "2024"
                candidatos_2024 = [
                    name for name in wb.sheetnames
                    if "2024" in name
                ]
                if candidatos_2024:
                    nombre_hoja_datos = candidatos_2024[0]
                    log(f"✅ Hoja encontrada por año 2024: {nombre_hoja_datos}")
                else:
                    # d) Último recurso: usar la primera hoja
                    nombre_hoja_datos = wb.sheetnames[0]
                    log(f"⚠️ Advertencia: usando primera hoja disponible: {nombre_hoja_datos}")

        # 3. Seleccionar la hoja
        ws = wb[nombre_hoja_datos]

        # Leer encabezados desde la fila 7 (índice 6 en 0-based)
        headers = []
        for col in range(1, ws.max_column + 1):
            cell = ws.cell(row=7, column=col).value
            headers.append(cell if cell else f"Columna{col}")

        log(f"Encabezados detectados: {headers}")

        # === DEBUG: Mostrar headers normalizados para diagnóstico ===
        log("=== HEADERS NORMALIZADOS PARA DIAGNÓSTICO ===")
        for idx, h in enumerate(headers):
            norm_h = normalizar_header(h)
            col_letter = chr(65 + idx) if idx < 26 else chr(65 + (idx // 26 - 1)) + chr(65 + (idx % 26))
            log(f"  Columna {idx + 1} ({col_letter}): '{h}' -> '{norm_h}'")
        log("=============================================")

        # Mapear los datos del formulario a las columnas correctas
        # Calcular días de incapacidad desde fecha_inicio hasta fecha_finalizacion
        dias_incapacidad = 0
        if datos.get("fecha_inicio") and datos.get("fecha_finalizacion"):
            try:
                from datetime import datetime
                fecha_inicio = datetime.strptime(datos["fecha_inicio"], "%Y-%m-%d")
                fecha_fin = datetime.strptime(datos["fecha_finalizacion"], "%Y-%m-%d")
                # Calcular diferencia en días (inclusive)
                dias_incapacidad = (fecha_fin - fecha_inicio).days + 1
                log(f"Días de incapacidad calculados: {dias_incapacidad}")
            except Exception as e:
                log(f"Advertencia: No se pudo calcular días de incapacidad: {e}")
                dias_incapacidad = 0

        nueva_fila = []
        for header in headers:
            # === USAR MATCH TOLERANTE PARA TODOS LOS HEADERS ===
            if match_header(header, "No"):
                # Contar filas existentes para asignar número
                num_filas_datos = sum(1 for r in range(8, ws.max_row + 1) if ws.cell(row=r, column=1).value)
                nueva_fila.append(str(num_filas_datos + 1))
            elif match_header(header, "EMPRESA"):
                # Columna B (índice 1) - Empresa del empleado
                nueva_fila.append(empresa)
            elif match_header(header, "NOMBRE"):
                # Columna C (índice 2) - Nombre del empleado
                nueva_fila.append(datos.get("nombre", ""))
            elif match_header(header, "CEDULA"):
                # Columna D (índice 3) - Cédula del empleado
                nueva_fila.append(datos.get("cedula", ""))
            elif match_header(header, "CARGO"):
                # Columna F (índice 5) - Cargo del empleado
                nueva_fila.append(datos.get("cargo", ""))
            elif match_header(header, "EMPRESA USUARIA"):
                # Columna G (índice 6) - Empresa usuaria donde presta el servicio
                nueva_fila.append(datos.get("empresa_usuaria", ""))
            elif match_header(header, "ÁREA O DPTO") or match_header(header, "AREA O DPTO") or match_header(header, "ÁREA") or match_header(header, "AREA") or match_header(header, "DPTO") or match_header(header, "DEPARTAMENTO") or match_header(header, "UBICACION") or match_header(header, "UBICACIÓN"):
                # Columna H (índice 7) - Área o Departamento
                area_valor = datos.get("area", "") or datos.get("departamento", "")
                log(f"🔵 MATCH ÁREA encontrado: header='{header}', area_valor='{area_valor}'")
                nueva_fila.append(area_valor)
            elif match_header(header, "GENERO") or match_header(header, "GÉNERO") or match_header(header, "SEXO"):
                # Columna I (índice 8) - Género del empleado
                nueva_fila.append(datos.get("genero", ""))
            elif match_header(header, "MES"):
                if datos.get("fecha_inicio"):
                    try:
                        mes_num = int(datos["fecha_inicio"].split("-")[1])
                        meses = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
                                 "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"]
                        nueva_fila.append(meses[mes_num - 1] if 1 <= mes_num <= 12 else "")
                    except:
                        nueva_fila.append("")
                else:
                    nueva_fila.append("")
            elif match_header(header, "N° DIAS DE INCAPACIDAD") or match_header(header, "NUM DIAS") or match_header(header, "DIAS INCAPACIDAD"):
                # Columna K (índice 10) - Días de incapacidad CALCULADOS
                nueva_fila.append(str(dias_incapacidad) if dias_incapacidad > 0 else "")
            elif match_header(header, "CLASE DE INCAPACIDAD") or match_header(header, "CLASE"):
                nueva_fila.append(datos.get("clase_incapacidad", ""))
            elif match_header(header, "TIPO DE INCAPACIDAD") or match_header(header, "TIPO"):
                nueva_fila.append(datos.get("tipo_incapacidad", ""))
            elif match_header(header, "ENTIDAD"):
                nueva_fila.append(datos.get("entidad", ""))
            elif match_header(header, "AÑO") or match_header(header, "ANO"):
                nueva_fila.append(datos.get("fecha_inicio", "")[:4] if datos.get("fecha_inicio") else "")
            elif match_header(header, "F. INICIO") or match_header(header, "FECHA INICIO"):
                nueva_fila.append(datos.get("fecha_inicio", ""))
            elif match_header(header, "F. FIN") or match_header(header, "FECHA FIN"):
                nueva_fila.append(datos.get("fecha_finalizacion", ""))
            elif match_header(header, "CODIGO") or match_header(header, "CÓDIGO") or match_header(header, "COD. CIE10"):
                nueva_fila.append(datos.get("codigo", ""))
            elif match_header(header, "DESCRIPCION") or match_header(header, "DESCRIPCIÓN") or match_header(header, "DIAGNÓSTICO") or match_header(header, "DIAGNOSTICO"):
                nueva_fila.append(datos.get("descripcion", "") or datos.get("diagnostico", ""))
            elif match_header(header, "OBSERVACIONES") or match_header(header, "OBSERVACIÓN"):
                nueva_fila.append(datos.get("observaciones", ""))
            else:
                # Columnas calculadas o no mapeadas: dejar vacío
                nueva_fila.append("")

        # === CORRECCIÓN: Asegurar que la columna E (índice 4) tenga la cédula duplicada ===
        # Si hay al menos 4 columnas y la columna D (índice 3) tiene cédula, copiar a columna E
        if len(nueva_fila) >= 4:
            cedula_valor = nueva_fila[3] if len(nueva_fila) > 3 else ""
            if cedula_valor and len(nueva_fila) > 4:
                # Copiar cédula a columna E (índice 4)
                nueva_fila[4] = cedula_valor
            elif cedula_valor and len(nueva_fila) == 4:
                # Agregar cédula en columna E
                nueva_fila.append(cedula_valor)

        # === LOG: Verificar datos antes de escribir ===
        log(f"📋 Datos a escribir - area: '{datos.get('area', '')}', departamento: '{datos.get('departamento', '')}'")

        # Encontrar la primera fila vacía (después de los datos existentes)
        fila_destino = ws.max_row + 1
        for r in range(8, ws.max_row + 1):
            if not ws.cell(row=r, column=1).value:
                fila_destino = r
                break

        # Escribir la nueva fila
        log(f"📝 Escribiendo fila {fila_destino}:")
        for col_idx, valor in enumerate(nueva_fila, start=1):
            ws.cell(row=fila_destino, column=col_idx, value=valor)
            if col_idx <= 12:  # Log primeras 12 columnas para depuración
                col_letter = chr(64 + col_idx) if col_idx <= 26 else chr(65 + (col_idx // 26 - 1)) + chr(65 + (col_idx % 26))
                log(f"  Columna {col_idx} ({col_letter}): '{valor}'")

        # Guardar
        wb.save(file_path)
        log(f"✅ Nueva incapacidad registrada en fila {fila_destino}")
        return {"success": True, "fila": fila_destino}

    except Exception as e:
        log(f"❌ Error al registrar incapacidad: {str(e)}")
        import traceback
        log(traceback.format_exc())
        return {"success": False, "error": str(e)}


def buscar_cie10_en_hoja(file_path, cie10_code):
    """
    Versión silenciosa de buscar_cie10_descripcion: retorna la descripción
    directamente, sin imprimir JSON. Usada por actualizar_incapacidad para
    auto-completar la descripción cuando el user cambia el código CIE-10.
    Retorna None si no encuentra el código o si hay error.
    """
    try:
        if not os.path.exists(file_path) or not cie10_code:
            return None
        # Intentar hoja "CIE-10 PARA RIPS" primero; si no, buscar por keyword
        sheet_name = "CIE-10 PARA RIPS"
        try:
            df = pd.read_excel(file_path, sheet_name=sheet_name, dtype=str, header=None)
        except Exception:
            # Buscar hoja alternativa que contenga CIE/DIAGNOST/ENFERM
            try:
                from openpyxl import load_workbook as _load_wb
                wb_tmp = _load_wb(file_path, read_only=True)
                candidatos = [s for s in wb_tmp.sheetnames
                              if any(k in s.upper() for k in ["CIE", "DIAGNOST", "DIAGNÓST", "ENFERM"])]
                wb_tmp.close()
                if not candidatos:
                    return None
                cie_pref = [s for s in candidatos if "CIE" in s.upper()]
                sheet_name = cie_pref[0] if cie_pref else candidatos[0]
                df = pd.read_excel(file_path, sheet_name=sheet_name, dtype=str, header=None)
            except Exception:
                return None

        if len(df.columns) < 2:
            return None

        # Normalizar código a buscar
        codigo_limpio = str(cie10_code).strip().upper()
        df['_cod_norm'] = df.iloc[:, 0].astype(str).str.strip().str.upper()
        coinc = df[df['_cod_norm'] == codigo_limpio]
        if coinc.empty:
            # Intentar sin puntos
            coinc = df[df['_cod_norm'].str.replace('.', '', regex=False) == codigo_limpio.replace('.', '')]
        if coinc.empty:
            return None
        descripcion = coinc.iloc[0, 1]
        return str(descripcion).strip() if descripcion and str(descripcion).strip() else None
    except Exception as e:
        log(f"[AUS-EDIT] Error en buscar_cie10_en_hoja: {e}")
        return None


def actualizar_incapacidad(empresa, file_path, row_index, datos):
    """
    Modifica una fila existente de incapacidad en el archivo de ausentismo.

    Mismo patrón que `registrar_incapacidad`:
    - Usa openpyxl para preservar formato
    - Misma búsqueda de hoja (nombre empresa → año 2024 → primera hoja)
    - Mismo `match_header` tolerante para mapear campos
    - Lee headers de fila 7 (consistente con el form de registro)

    Args:
        empresa: nombre de la empresa
        file_path: ruta absoluta al .xlsx
        row_index: índice 0-based de la fila a modificar (NO incluye el header)
        datos: dict con los campos a actualizar (mismas keys que registrar_incapacidad)
    """
    try:
        log(f"[AUS-EDIT] Actualizando fila rowIndex={row_index} en: {file_path}")
        log(f"[AUS-EDIT] Empresa: {empresa}, datos: {datos}")

        # Normalizar datos del frontend (camelCase -> snake_case), igual que registrar_incapacidad
        datos_normalizados = {
            "cedula": datos.get("cedula", ""),
            "nombre": datos.get("nombre", ""),
            "cargo": datos.get("cargo", ""),
            "area": datos.get("area", "") or datos.get("departamento", ""),
            "departamento": datos.get("area", "") or datos.get("departamento", ""),
            "empresa_usuaria": datos.get("empresa_usuaria", ""),
            "genero": datos.get("genero", ""),
            "fecha_inicio": datos.get("fecha_inicio", "") or datos.get("fechaInicio", ""),
            "fecha_finalizacion": datos.get("fecha_finalizacion", "") or datos.get("fechaFin", ""),
            "dias_incapacidad": datos.get("dias_incapacidad", "") or datos.get("diasIncapacidad", ""),
            "tipo_incapacidad": datos.get("tipo_incapacidad", "") or datos.get("tipoIncapacidad", ""),
            "clase_incapacidad": datos.get("clase_incapacidad", "") or datos.get("claseIncapacidad", ""),
            "entidad": datos.get("entidad", ""),
            "codigo": datos.get("codigo", ""),
            "descripcion": datos.get("descripcion", "") or datos.get("diagnostico", ""),
        }
        datos = datos_normalizados
        log(f"[AUS-EDIT] Datos normalizados: {datos}")

        # Cargar el archivo con openpyxl (preserva formato)
        wb = load_workbook(file_path)

        # Buscar la hoja correcta con la misma lógica que registrar_incapacidad
        empresa_normalizada = empresa.strip().upper()
        nombre_hoja_esperado = f"{empresa_normalizada} 2024"

        nombre_hoja_datos = None
        if nombre_hoja_esperado in wb.sheetnames:
            nombre_hoja_datos = nombre_hoja_esperado
        else:
            candidatos_empresa = [name for name in wb.sheetnames if empresa_normalizada in name.upper()]
            if candidatos_empresa:
                nombre_hoja_datos = candidatos_empresa[0]
            else:
                candidatos_2024 = [name for name in wb.sheetnames if "2024" in name]
                if candidatos_2024:
                    nombre_hoja_datos = candidatos_2024[0]
                else:
                    nombre_hoja_datos = wb.sheetnames[0]
        log(f"[AUS-EDIT] Hoja seleccionada: '{nombre_hoja_datos}'")
        ws = wb[nombre_hoja_datos]

        # Leer headers de fila 7 (mismo que registrar_incapacidad)
        headers = []
        for col in range(1, ws.max_column + 1):
            cell = ws.cell(row=7, column=col).value
            headers.append(cell if cell else f"Columna{col}")
        log(f"[AUS-EDIT] Headers: {headers}")

        # Calcular la fila real en Excel (row_index es 0-based sin contar header)
        # Igual que registrar_incapacidad: datos empiezan en fila 8
        fila_excel = 8 + row_index
        log(f"[AUS-EDIT] rowIndex={row_index} → fila Excel={fila_excel}")

        if fila_excel > ws.max_row:
            return {"success": False, "error": f"rowIndex {row_index} fuera de rango. La hoja tiene {ws.max_row - 7} filas de datos."}

        # 🆕 Validación: la fila debe tener datos reales (cédula O nombre no vacíos).
        # Bug evitado: ws.max_row incluye filas con solo formato, así que un rowIndex
        # alto pero en zona muerta pasaba la validación anterior. Ahora verificamos
        # que la fila realmente tenga datos antes de tocarla.
        cedula_fila = ws.cell(row=fila_excel, column=4).value  # Columna D = CÉDULA
        nombre_fila = ws.cell(row=fila_excel, column=3).value  # Columna C = NOMBRE
        if not (cedula_fila and str(cedula_fila).strip()) and not (nombre_fila and str(nombre_fila).strip()):
            return {"success": False, "error": f"rowIndex {row_index} apunta a una fila vacía (sin cédula ni nombre). No se puede modificar."}

        # 🆕 Recalcular N° DIAS DE INCAPACIDAD si vienen fechas en el payload.
        # Mismo cálculo que `registrar_incapacidad`: (fecha_fin - fecha_inicio).days + 1
        # Acepta fechas en formato "YYYY-MM-DD" (frontend) o "M/D/YY" (Excel).
        dias_recalculados = None
        fi_str = datos.get("fecha_inicio", "")
        ff_str = datos.get("fecha_finalizacion", "")
        if fi_str and ff_str:
            from datetime import datetime
            # Intentar varios formatos
            formatos = ["%Y-%m-%d", "%m/%d/%y", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"]
            fi_dt, ff_dt = None, None
            for fmt in formatos:
                try:
                    fi_dt = datetime.strptime(str(fi_str).strip(), fmt)
                    break
                except ValueError:
                    continue
            for fmt in formatos:
                try:
                    ff_dt = datetime.strptime(str(ff_str).strip(), fmt)
                    break
                except ValueError:
                    continue
            if fi_dt and ff_dt and ff_dt >= fi_dt:
                dias_recalculados = (ff_dt - fi_dt).days + 1
                log(f"[AUS-EDIT] Días recalculados desde F.INICIO={fi_str} y F.FIN={ff_str}: {dias_recalculados}")

        # 🆕 Auto-completar DESCRIPCION si el user cambió el CÓDIGO CIE-10 y NO
        # envió una descripción manual. Mismo comportamiento que el form de
        # registro: al elegir un CIE-10, la descripción se busca
        # automáticamente en la hoja "CIE-10 PARA RIPS" del mismo archivo.
        # Si el user escribió su propia descripción, esa tiene prioridad.
        if datos.get("codigo") and not datos.get("descripcion"):
            desc_auto = buscar_cie10_en_hoja(file_path, datos["codigo"])
            if desc_auto:
                datos["descripcion"] = desc_auto
                log(f"[AUS-EDIT] Auto-completado: codigo='{datos['codigo']}' → descripcion='{desc_auto}'")
            else:
                log(f"[AUS-EDIT] No se encontró descripción automática para código='{datos.get('codigo')}'. Campo DESCRIPCION queda como está.")

        # Aplicar cambios usando match_header (mismo patrón que registrar_incapacidad)
        applied = []
        skipped = []
        for col_idx, header in enumerate(headers, start=1):
            if match_header(header, "GENERO") or match_header(header, "GÉNERO") or match_header(header, "SEXO"):
                old = ws.cell(row=fila_excel, column=col_idx).value
                new = datos.get("genero", "")
                if new and new != "-":
                    ws.cell(row=fila_excel, column=col_idx, value=new)
                    applied.append(f"col {col_idx} ({header}): '{old}' → '{new}'")
                    log(f"[AUS-EDIT]   ✓ col {col_idx} GENERO: '{old}' → '{new}'")
            elif match_header(header, "CLASE DE INCAPACIDAD") or match_header(header, "CLASE"):
                old = ws.cell(row=fila_excel, column=col_idx).value
                new = datos.get("clase_incapacidad", "")
                if new and new != "-":
                    ws.cell(row=fila_excel, column=col_idx, value=new)
                    applied.append(f"col {col_idx} ({header}): '{old}' → '{new}'")
                    log(f"[AUS-EDIT]   ✓ col {col_idx} CLASE: '{old}' → '{new}'")
            elif match_header(header, "TIPO DE INCAPACIDAD") or match_header(header, "TIPO"):
                old = ws.cell(row=fila_excel, column=col_idx).value
                new = datos.get("tipo_incapacidad", "")
                if new and new != "-":
                    ws.cell(row=fila_excel, column=col_idx, value=new)
                    applied.append(f"col {col_idx} ({header}): '{old}' → '{new}'")
                    log(f"[AUS-EDIT]   ✓ col {col_idx} TIPO: '{old}' → '{new}'")
            elif match_header(header, "F. INICIO") or match_header(header, "FECHA INICIO"):
                old = ws.cell(row=fila_excel, column=col_idx).value
                new = datos.get("fecha_inicio", "")
                if new and new != "-":
                    ws.cell(row=fila_excel, column=col_idx, value=new)
                    applied.append(f"col {col_idx} ({header}): '{old}' → '{new}'")
                    log(f"[AUS-EDIT]   ✓ col {col_idx} F.INICIO: '{old}' → '{new}'")
            elif match_header(header, "F. FIN") or match_header(header, "FECHA FIN"):
                old = ws.cell(row=fila_excel, column=col_idx).value
                new = datos.get("fecha_finalizacion", "")
                if new and new != "-":
                    ws.cell(row=fila_excel, column=col_idx, value=new)
                    applied.append(f"col {col_idx} ({header}): '{old}' → '{new}'")
                    log(f"[AUS-EDIT]   ✓ col {col_idx} F.FIN: '{old}' → '{new}'")
            elif match_header(header, "CODIGO") or match_header(header, "CÓDIGO"):
                old = ws.cell(row=fila_excel, column=col_idx).value
                new = datos.get("codigo", "")
                if new and new != "-":
                    ws.cell(row=fila_excel, column=col_idx, value=new)
                    applied.append(f"col {col_idx} ({header}): '{old}' → '{new}'")
                    log(f"[AUS-EDIT]   ✓ col {col_idx} CODIGO: '{old}' → '{new}'")
            elif match_header(header, "DESCRIPCION") or match_header(header, "DESCRIPCIÓN") or match_header(header, "DIAGNÓSTICO") or match_header(header, "DIAGNOSTICO"):
                # 🆕 Diagnóstico editable desde el modal
                # Solo escribir si el user envió `descripcion` (key presente Y no vacía).
                # Si el user NO tocó este campo, preservar el valor existente.
                # Esto evita que se borre accidentalmente cuando el auto-complete
                # del CIE-10 no encuentra match.
                desc_val = datos.get("descripcion", None)
                if desc_val is not None and str(desc_val).strip() != "" and desc_val != "-":
                    old = ws.cell(row=fila_excel, column=col_idx).value
                    new = str(desc_val)
                    ws.cell(row=fila_excel, column=col_idx, value=new)
                    applied.append(f"col {col_idx} ({header}): '{old}' → '{new}'")
                    log(f"[AUS-EDIT]   ✓ col {col_idx} DESCRIPCION: '{old}' → '{new}'")
            elif match_header(header, "N° DIAS DE INCAPACIDAD") or match_header(header, "NUM DIAS") or match_header(header, "DIAS INCAPACIDAD"):
                # 🆕 Si recalculamos días desde las fechas, escribir en la columna K
                if dias_recalculados is not None:
                    old = ws.cell(row=fila_excel, column=col_idx).value
                    new = str(dias_recalculados)
                    if str(old) != new:
                        ws.cell(row=fila_excel, column=col_idx, value=new)
                        applied.append(f"col {col_idx} ({header}): '{old}' → '{new}'")
                        log(f"[AUS-EDIT]   ✓ col {col_idx} DIAS: '{old}' → '{new}' (auto)")
            # Los demás campos son readonly (no se modifican)

        log(f"[AUS-EDIT] Aplicados={len(applied)}, Saltados={len(skipped)}")

        # Guardar
        wb.save(file_path)
        log(f"[AUS-EDIT] ✅ Fila {fila_excel} actualizada, {len(applied)} campos")
        return {"success": True, "fila": fila_excel, "applied": applied, "skipped": skipped}

    except Exception as e:
        log(f"[AUS-EDIT] ❌ Error: {str(e)}")
        import traceback
        log(traceback.format_exc())
        return {"success": False, "error": str(e)}


def eliminar_incapacidad(empresa, file_path, row_index):
    """
    Elimina una fila existente de incapacidad del archivo de ausentismo.
    Mismo patrón que actualizar_incapacidad.
    """
    try:
        log(f"[AUS-DEL] Eliminando fila rowIndex={row_index} en: {file_path}")

        wb = load_workbook(file_path)

        # Buscar la hoja con la misma lógica
        empresa_normalizada = empresa.strip().upper()
        nombre_hoja_esperado = f"{empresa_normalizada} 2024"

        nombre_hoja_datos = None
        if nombre_hoja_esperado in wb.sheetnames:
            nombre_hoja_datos = nombre_hoja_esperado
        else:
            candidatos_empresa = [name for name in wb.sheetnames if empresa_normalizada in name.upper()]
            if candidatos_empresa:
                nombre_hoja_datos = candidatos_empresa[0]
            else:
                candidatos_2024 = [name for name in wb.sheetnames if "2024" in name]
                if candidatos_2024:
                    nombre_hoja_datos = candidatos_2024[0]
                else:
                    nombre_hoja_datos = wb.sheetnames[0]
        log(f"[AUS-DEL] Hoja seleccionada: '{nombre_hoja_datos}'")
        ws = wb[nombre_hoja_datos]

        # Calcular fila real (datos empiezan en fila 8)
        fila_excel = 8 + row_index
        log(f"[AUS-DEL] rowIndex={row_index} → fila Excel={fila_excel}")

        if fila_excel > ws.max_row:
            return {"success": False, "error": f"rowIndex {row_index} fuera de rango."}

        # 🆕 Validación: la fila debe tener datos reales (cédula O nombre no vacíos).
        # Bug evitado: ws.max_row incluye filas con solo formato, así que un rowIndex
        # alto pero en zona muerta pasaba la validación anterior. Ahora verificamos
        # que la fila realmente tenga datos antes de borrarla.
        cedula_fila = ws.cell(row=fila_excel, column=4).value  # Columna D = CÉDULA
        nombre_fila = ws.cell(row=fila_excel, column=3).value  # Columna C = NOMBRE
        if not (cedula_fila and str(cedula_fila).strip()) and not (nombre_fila and str(nombre_fila).strip()):
            return {"success": False, "error": f"rowIndex {row_index} apunta a una fila vacía (sin cédula ni nombre). No se puede eliminar."}

        # Capturar info antes de eliminar (para devolver en el resultado)
        nombre_eliminado = ws.cell(row=fila_excel, column=3).value or "(sin nombre)"

        # Eliminar la fila (openpyxl: delete_rows es 1-based)
        ws.delete_rows(fila_excel, 1)
        log(f"[AUS-DEL] Fila {fila_excel} ({nombre_eliminado}) eliminada")

        # Guardar
        wb.save(file_path)
        return {"success": True, "fila": fila_excel, "nombre": nombre_eliminado}

    except Exception as e:
        log(f"[AUS-DEL] ❌ Error: {str(e)}")
        import traceback
        log(traceback.format_exc())
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"type": "result", "payload": {"success": False, "error": "Uso: python actualizar_ausentismo.py <comando> [argumentos...]"}}))
        sys.exit(1)

    comando = sys.argv[1]

    if comando == "actualizar":
        if len(sys.argv) != 4:
            print(json.dumps({"type": "result", "payload": {"success": False, "error": "Uso: python actualizar_ausentismo.py actualizar <empresa> <ruta_archivo>"}}))
            sys.exit(1)

        empresa = sys.argv[2]
        archivo = sys.argv[3]

        try:
            output_file = actualizar_ausentismo(empresa, archivo)
            print(json.dumps({
                "type": "result",
                "payload": {
                    "success": True,
                    "outputPath": output_file
                }
            }))
        except Exception as e:
            print(json.dumps({
                "type": "result",
                "payload": {
                    "success": False,
                    "error": str(e)
                }
            }))

    elif comando == "buscar_empleado":
        if len(sys.argv) != 4:
            print(json.dumps({"type": "result", "payload": {"success": False, "error": "Uso: python actualizar_ausentismo.py buscar_empleado <cedula> <empresa>"}}))
            sys.exit(1)

        cedula = sys.argv[2]
        empresa = sys.argv[3]

        try:
            resultado = buscar_empleado_por_cedula(cedula, empresa)
            if resultado:
                print(json.dumps({
                    "type": "result",
                    "payload": {
                        "success": True,
                        "datos": resultado
                    }
                }))
            else:
                print(json.dumps({
                    "type": "result",
                    "payload": {
                        "success": False,
                        "error": f"No se encontró empleado con cédula {cedula} en la base de datos de {empresa}"
                    }
                }))
        except Exception as e:
            print(json.dumps({
                "type": "result",
                "payload": {
                    "success": False,
                    "error": str(e)
                }
            }))

    elif comando == "buscar_cie10":
        if len(sys.argv) != 4:
            print(json.dumps({"type": "result", "payload": {"success": False, "error": "Uso: python actualizar_ausentismo.py buscar_cie10 <ruta_archivo> <codigo_cie10>"}}))
            sys.exit(1)

        file_path = sys.argv[2]
        cie10_code = sys.argv[3]

        try:
            resultado = buscar_cie10_descripcion(file_path, cie10_code)
            # The result is already printed inside the function
        except Exception as e:
            print(json.dumps({
                "type": "result",
                "payload": {
                    "success": False,
                    "error": str(e)
                }
            }))

    elif comando == "registrar_incapacidad":
        if len(sys.argv) != 5:
            print(json.dumps({"type": "result", "payload": {"success": False, "error": "Uso: python actualizar_ausentismo.py registrar_incapacidad <empresa> <ruta_archivo> <json_datos>"}}))
            sys.exit(1)

        empresa = sys.argv[2]
        file_path = sys.argv[3]
        datos_json = sys.argv[4]
        try:
            datos = json.loads(datos_json)
            resultado = registrar_incapacidad(empresa, file_path, datos) #✅ 3 argumentos
            print(json.dumps({"type": "result", "payload": resultado}, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({"type": "result", "payload": {"success": False, "error": f"Error parsing JSON: {str(e)}"}}))

    elif comando == "actualizar_incapacidad":
        if len(sys.argv) != 6:
            print(json.dumps({"type": "result", "payload": {"success": False, "error": "Uso: python actualizar_ausentismo.py actualizar_incapacidad <empresa> <ruta_archivo> <row_index> <json_datos>"}}))
            sys.exit(1)

        empresa = sys.argv[2]
        file_path = sys.argv[3]
        try:
            row_index = int(sys.argv[4])
        except ValueError:
            print(json.dumps({"type": "result", "payload": {"success": False, "error": f"row_index debe ser un número entero, recibí: {sys.argv[4]}"}}))
            sys.exit(1)
        datos_json = sys.argv[5]
        try:
            datos = json.loads(datos_json)
            resultado = actualizar_incapacidad(empresa, file_path, row_index, datos)
            print(json.dumps({"type": "result", "payload": resultado}, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({"type": "result", "payload": {"success": False, "error": f"Error parsing JSON: {str(e)}"}}))

    elif comando == "eliminar_incapacidad":
        if len(sys.argv) != 5:
            print(json.dumps({"type": "result", "payload": {"success": False, "error": "Uso: python actualizar_ausentismo.py eliminar_incapacidad <empresa> <ruta_archivo> <row_index>"}}))
            sys.exit(1)

        empresa = sys.argv[2]
        file_path = sys.argv[3]
        try:
            row_index = int(sys.argv[4])
        except ValueError:
            print(json.dumps({"type": "result", "payload": {"success": False, "error": f"row_index debe ser un número entero, recibí: {sys.argv[4]}"}}))
            sys.exit(1)
        try:
            resultado = eliminar_incapacidad(empresa, file_path, row_index)
            print(json.dumps({"type": "result", "payload": resultado}, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({"type": "result", "payload": {"success": False, "error": f"Error en eliminar: {str(e)}"}}))
    elif comando == "guardar_seguimiento":
        if len(sys.argv) != 5:
            print(json.dumps({"type": "result", "payload": {"success": False, "error": "Uso: python actualizar_ausentismo.py guardar_seguimiento <empresa> <ruta_archivo> <json_datos_seguimiento>"}}))
            sys.exit(1)

        empresa = sys.argv[2]
        file_path = sys.argv[3]
        datos_json = sys.argv[4]
        try:
            datos = json.loads(datos_json)
            resultado = guardar_seguimiento(empresa, file_path, datos)
            print(json.dumps({"type": "result", "payload": resultado}, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({"type": "result", "payload": {"success": False, "error": f"Error parsing JSON: {str(e)}"}}))
    elif comando == "cargar_seguimientos":
        if len(sys.argv) != 4:
            print(json.dumps({"type": "result", "payload": {"success": False, "error": "Uso: python actualizar_ausentismo.py cargar_seguimientos <empresa> <ruta_archivo_seguimientos>"}}))
            sys.exit(1)

        empresa = sys.argv[2]
        seguimiento_file_path = sys.argv[3]

        try:
            log(f"Cargando seguimientos desde: {seguimiento_file_path}")
            SHEET_NAME = "Seguimientos"
            
            if not os.path.exists(seguimiento_file_path):
                log(f"ADVERTENCIA: El archivo de seguimientos no existe en '{seguimiento_file_path}'. No se cargarán datos.")
                print(json.dumps({"type": "result", "payload": {"success": True, "followUps": {}}}))
                sys.exit(0)

            workbook = load_workbook(seguimiento_file_path, read_only=True)
            log(f"Hojas encontradas en el archivo: {workbook.sheetnames}")

            if SHEET_NAME not in workbook.sheetnames:
                log(f"ERROR: No se encontró la hoja '{SHEET_NAME}' en el archivo de seguimientos.")
                print(json.dumps({"type": "result", "payload": {"success": False, "error": f"No se encontró la hoja '{SHEET_NAME}'."}}))
                sys.exit(1)

            sheet = workbook[SHEET_NAME]
            
            # Leer encabezados (primera fila)
            headers = [cell.value for cell in sheet[1]]
            if not headers or not any(headers):
                log("ERROR: La hoja de seguimientos no tiene encabezados en la primera fila.")
                print(json.dumps({"type": "result", "payload": {"success": False, "error": "La hoja de seguimientos no tiene encabezados."}}))
                sys.exit(1)
            log(f"Encabezados leídos: {headers}")

            # Encontrar el índice de la columna "ID Empleado"
            try:
                id_empleado_col_name = "ID Empleado"
                id_empleado_col_index = headers.index(id_empleado_col_name)
                log(f"Índice de la columna '{id_empleado_col_name}' es: {id_empleado_col_index}")
            except ValueError:
                log(f"ERROR: No se encontró la columna '{id_empleado_col_name}' en los encabezados.")
                print(json.dumps({"type": "result", "payload": {"success": False, "error": f"Columna '{id_empleado_col_name}' no encontrada."}}))
                sys.exit(1)

            # Leer datos y agrupar por ID de empleado
            follow_up_data = {}
            for row in sheet.iter_rows(min_row=2, values_only=True):
                row_dict = dict(zip(headers, row))
                case_id = row_dict.get(id_empleado_col_name)
                
                if case_id:
                    case_id_str = str(case_id).strip()
                    if case_id_str not in follow_up_data:
                        follow_up_data[case_id_str] = []
                    follow_up_data[case_id_str].append(row_dict)
                else:
                    log(f"ADVERTENCIA: Fila encontrada sin ID de empleado. Saltando.")

            log(f"Carga de seguimientos completada. {len(follow_up_data)} empleados con seguimiento encontrados.")
            print(json.dumps({"type": "result", "payload": {"success": True, "followUps": follow_up_data}}, ensure_ascii=False, default=str))

        except Exception as e:
            log(f"Error crítico al leer archivo de seguimientos: {str(e)}")
            import traceback
            log(traceback.format_exc())
            print(json.dumps({"type": "result", "payload": {"success": False, "error": f"Error al leer archivo de seguimientos: {str(e)}"}}))
    
    elif comando == "buscar_registros_por_cedula":
        if len(sys.argv) != 5:
            print(json.dumps({"type": "result", "payload": {"success": False, "error": "Uso: python actualizar_ausentismo.py buscar_registros_por_cedula <empresa> <ruta_archivo> <cedula>"}}))
            sys.exit(1)

        empresa = sys.argv[2]
        file_path = sys.argv[3]
        cedula = sys.argv[4]

        try:
            resultado = buscar_registros_por_cedula(empresa, file_path, cedula)
            print(json.dumps({"type": "result", "payload": resultado}, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({"type": "result", "payload": {"success": False, "error": str(e)}}))
    
    elif comando == "cargar_todos_registros_pri":
        if len(sys.argv) != 4:
            print(json.dumps({"type": "result", "payload": {"success": False, "error": "Uso: python actualizar_ausentismo.py cargar_todos_registros_pri <empresa> <ruta_archivo>"}}))
            sys.exit(1)

        empresa = sys.argv[2]
        file_path = sys.argv[3]

        try:
            resultado = cargar_todos_registros_pri(empresa, file_path)
            print(json.dumps({"type": "result", "payload": resultado}, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({"type": "result", "payload": {"success": False, "error": str(e)}}))
    
    else:
        print(json.dumps({"type": "result", "payload": {"success": False, "error": f"Comando desconocido: {comando}. Comandos válidos: 'actualizar', 'buscar_empleado', 'buscar_cie10', 'registrar_incapacidad', 'actualizar_incapacidad', 'eliminar_incapacidad', 'guardar_seguimiento', 'cargar_seguimientos', 'buscar_registros_por_cedula', 'cargar_todos_registros_pri'"}}))
        sys.exit(1)
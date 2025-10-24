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
            "TEMPOSUM": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Temposum Est SAS/Base de Datos Personal Temporales.xlsx",
            "ASEPLUS": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Aseplus/Base de Datos Personal Temporales.xlsx",
            "ASEL": "G:/Mi unidad/2. Trabajo/1. SG-SST/19. Asel S.A.S/Formato - Base de datos personal ASEL.xlsx"
        }

        db_path = BASES_DATOS.get(str(empresa).upper())
        log(f"Ruta resolvida para empresa '{empresa}': {db_path}")

        if not db_path:
            log("ERROR: No existe ruta configurada para la empresa solicitada.")
            print(json.dumps({"type": "result", "payload": {"success": False, "error": "Ruta base de datos no configurada"}}))
            return None

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
        posibles_nombres = ["Nombre Completo", "NOMBRE COMPLETO", "NOMBRE", "NOMBRES", "NOMBRES Y APELLIDOS"]
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
        col_empresa = buscar_columna(["EMPRESA", "EMPRESA DONDE PRESTA"])
        col_area = buscar_columna(["UBICACION", "UBICACIÓN", "AREA", "ÁREA"])
        col_genero = buscar_columna(["GENERO", "SEXO"])

        result = {
            "nombre": nombre_completo or "",
            "cargo": (row.get(col_cargo) or "") if col_cargo else "",
            "empresa_usuaria": (row.get(col_empresa) or "") if col_empresa else "",
            "area": (row.get(col_area) or "") if col_area else "",
            "genero": (row.get(col_genero) or "") if col_genero else "",
            "_fila_index": int(row.name)
        }

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
    
    else:
        print(json.dumps({"type": "result", "payload": {"success": False, "error": f"Comando desconocido: {comando}. Comandos válidos: 'actualizar', 'buscar_empleado'"}}))
        sys.exit(1)
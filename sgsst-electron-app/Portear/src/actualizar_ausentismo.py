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
        col_empresa_empleadora = next((c for c in df.columns if str(c).strip().upper() == 'EMPRESA'), None)
        col_empresa_usuaria = buscar_columna(["EMPRESA DONDE PRESTA SERVICIO", "EMPRESA USUARIA"])
        col_area = buscar_columna(["UBICACION", "UBICACIÓN", "AREA", "ÁREA", "DEPARTAMENTO"])
        col_genero = buscar_columna(["GENERO", "SEXO"])
        col_entidad = buscar_columna(["EPS", "SURA","EPS/SURA", "ENTIDAD"])

        result = {
            "nombre": nombre_completo or "",
            "cargo": (row.get(col_cargo) or "") if col_cargo else "",
            "empresa": (row.get(col_empresa_empleadora) or "") if col_empresa_empleadora else "",
            "empresa_usuaria": (row.get(col_empresa_usuaria) or "") if col_empresa_usuaria else "",
            "area": (row.get(col_area) or "") if col_area else "",  # Departamento/Ubicación
            "genero": (row.get(col_genero) or "") if col_genero else "",
            "entidad": (row.get(col_entidad) or "") if col_entidad else "",  # EPS/SURA
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

def registrar_incapacidad(empresa, file_path, datos):
    """
    Agrega una nueva fila de incapacidad al archivo de ausentismo.
    """
    try:
        log(f"Registrando nueva incapacidad en: {file_path}")
        log(f"Datos recibidos: {datos}")

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

        # Mapear los datos del formulario a las columnas correctas
        nueva_fila = []
        for header in headers:
            if header == "No":
                # Contar filas existentes para asignar número
                num_filas_datos = sum(1 for r in range(8, ws.max_row + 1) if ws.cell(row=r, column=1).value)
                nueva_fila.append(str(num_filas_datos + 1))
            elif header == "EMPRESA":
                nueva_fila.append(datos.get("empresa", ""))
            elif header == "NOMBRE ":
                nueva_fila.append(datos.get("nombre", ""))
            elif header == "CEDULA ":
                nueva_fila.append(datos.get("cedula", ""))
            elif header == "CARGO":
                nueva_fila.append(datos.get("cargo", ""))
            elif header == "EMPRESA USUARIA":
                nueva_fila.append(datos.get("empresa_usuaria", ""))
            elif header == "ÁREA O DPTO":
                nueva_fila.append(datos.get("departamento", ""))
            elif header == "GENERO":
                nueva_fila.append(datos.get("genero", ""))
            elif header == "CLASE DE INCAPACIDAD":
                nueva_fila.append(datos.get("clase_incapacidad", ""))
            elif header == "TIPO DE INCAPACIDAD":
                nueva_fila.append(datos.get("tipo_incapacidad", ""))
            elif header == "F. INICIO":
                nueva_fila.append(datos.get("fecha_inicio", ""))
            elif header == "F. FIN":
                nueva_fila.append(datos.get("fecha_finalizacion", ""))
            elif header == "CODIGO":
                nueva_fila.append(datos.get("codigo", ""))
            elif header == "DESCRIPCION":
                nueva_fila.append(datos.get("descripcion", ""))
            elif header == "ENTIDAD":
                nueva_fila.append(datos.get("entidad", ""))
            elif header == "AÑO":
                nueva_fila.append(datos.get("fecha_inicio", "")[:4] if datos.get("fecha_inicio") else "")
            elif header == "MES":
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
            else:
                # Columnas calculadas o no mapeadas: dejar vacío
                nueva_fila.append("")

        # Encontrar la primera fila vacía (después de los datos existentes)
        fila_destino = ws.max_row + 1
        for r in range(8, ws.max_row + 1):
            if not ws.cell(row=r, column=1).value:
                fila_destino = r
                break

        # Escribir la nueva fila
        for col_idx, valor in enumerate(nueva_fila, start=1):
            ws.cell(row=fila_destino, column=col_idx, value=valor)

        # Guardar
        wb.save(file_path)
        log(f"✅ Nueva incapacidad registrada en fila {fila_destino}")
        return {"success": True, "fila": fila_destino}

    except Exception as e:
        log(f"❌ Error al registrar incapacidad: {str(e)}")
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
    else:
        print(json.dumps({"type": "result", "payload": {"success": False, "error": f"Comando desconocido: {comando}. Comandos válidos: 'actualizar', 'buscar_empleado', 'buscar_cie10', 'registrar_incapacidad'"}}))
        sys.exit(1)
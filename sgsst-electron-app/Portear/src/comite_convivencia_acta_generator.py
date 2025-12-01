import json
import sys
import os

def log_message(message, level="INFO"):
    """Generates a JSON-formatted log message."""
    print(json.dumps({"type": "log", "message": message, "level": level}))

# NUEVO: ====================================================================
# Función de depuración para identificar coordenadas de celdas
def debug_cell_coordinates(ws):
    """
    Imprime información detallada sobre las celdas y sus coordenadas
    para ayudar a mapear los datos correctamente.
    """
    from openpyxl.utils import get_column_letter
    
    print("\n" + "="*50)
    print("      MODO DEPURACIÓN: COORDENADAS DE CELDAS")
    print("="*50)
    
    # 1. Imprimir información sobre celdas combinadas (Merged Cells)
    print("\n--- CELDAS COMBINADAS ENCONTRADAS ---")
    if not ws.merged_cells.ranges:
        print("No se encontraron celdas combinadas.")
    else:
        for merged_range in ws.merged_cells.ranges:
            # Obtenemos la celda superior izquierda del rango combinado
            top_left_cell = ws.cell(row=merged_range.min_row, column=merged_range.min_col)
            print(f"Rango combinado: {merged_range} -> Celda principal: {top_left_cell.coordinate} -> Valor actual: '{top_left_cell.value}'")

    # 2. Imprimir información sobre celdas con contenido relevante
    print("\n--- CELDAS CON CONTENIDO (para mapeo) ---")
    for row in range(1, ws.max_row + 1):
        for col in range(1, ws.max_column + 1):
            cell = ws.cell(row=row, column=col)
            # Ignoramos celdas vacías, con solo asteriscos o que son parte de un rango combinado (pero no la principal)
            is_merged_main = False
            for merged_range in ws.merged_cells.ranges:
                if row == merged_range.min_row and col == merged_range.min_col:
                    is_merged_main = True
                    break
            
            if cell.value and str(cell.value).strip() and "*" not in str(cell.value) and not is_merged_main:
                print(f"Celda individual: {get_column_letter(col)}{row} (Fila:{row}, Col:{col}) -> Valor: '{cell.value}'")
    print("="*50 + "\n")
# FIN NUEVO ==================================================================


def main(temp_data_path, output_path):
    """
    Loads an Excel template, applies changes from a JSON file,
    and saves the result to a new file, preserving styles.
    """
    try:
        log_message("Iniciando generación de acta de Comite de Convivencia...")

        # 1. Importar openpyxl dentro del main para manejar error si no está instalado
        try:
            from openpyxl import load_workbook
            from openpyxl.utils import get_column_letter
        except ImportError:
            raise ImportError("La biblioteca 'openpyxl' no está instalada. Ejecute: pip install openpyxl")

        # 2. Cargar datos del JSON temporal
        with open(temp_data_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        changes = data.get('changes', [])
        log_message(f"Cambios a aplicar: {len(changes)}")

        # 3. Ruta a la plantilla
        template_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'utils', 'GI-FO-029 ACTA DE REUNION CONVIVENCIA Mayo.xlsx')
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Plantilla no encontrada en: {template_path}")

        log_message(f"Cargando plantilla desde: {template_path}")

        # 4. Cargar la plantilla con openpyxl
        wb = load_workbook(template_path)
        ws = wb.active

        # MODIFICADO: Añadir la llamada a la función de depuración aquí
        # Si el script se ejecuta con el argumento "--debug", imprimirá las coordenadas y se detendrá.
        if "--debug" in sys.argv:
            print("Ejecutando en modo depuración...")
            debug_cell_coordinates(ws)
            print("Modo depuración finalizado. El script se detendrá ahora.")
            sys.exit(0) # Salimos del script después de depurar

        # 5. Identificar rangos de celdas unificadas para evitar conflictos
        merged_ranges = list(ws.merged_cells.ranges)  # Obtener todas las celdas unificadas
        log_message(f"Se encontraron {len(merged_ranges)} rangos de celdas unificadas")

        # Crear un diccionario para mapear celdas a sus rangos combinados
        merged_cell_map = {}
        for merged_range in merged_ranges:
            for row_idx in range(merged_range.min_row, merged_range.max_row + 1):
                for col_idx in range(merged_range.min_col, merged_range.max_col + 1):
                    merged_cell_map[(row_idx, col_idx)] = merged_range

        # 6. Aplicar cambios a las celdas, manejando celdas unificadas
        for change in changes:
            row = change.get('row', None)
            col = change.get('col', None)
            value = change.get('value', None)

            if row is not None and col is not None and value is not None:
                try:
                    # Convertir a enteros y sumar 1 para la indexación de Excel (1-indexed)
                    row_excel = int(row) + 1
                    col_excel = int(col) + 1

                    # Verificar si la celda está en un rango unificado
                    if (row_excel, col_excel) in merged_cell_map:
                        merged_range = merged_cell_map[(row_excel, col_excel)]
                        # Escribir siempre en la celda superior izquierda del rango combinado
                        target_cell = ws.cell(row=merged_range.min_row, column=merged_range.min_col)
                        target_cell.value = value
                        log_message(f"Celda unificada ({target_cell.coordinate}) actualizada con valor: {value}")
                    else:
                        # Escribir en la celda individual normalmente
                        ws.cell(row=row_excel, column=col_excel, value=value)
                        log_message(f"Celda ({row_excel}, {get_column_letter(col_excel)}) actualizada con valor: {value}")

                except ValueError as ve:
                    log_message(f"Error al convertir índices a enteros: row={row}, col={col}, error: {ve}", "ERROR")
                    continue
                except Exception as e:
                    log_message(f"Error al actualizar celda ({row+1}, {col+1}): {e}", "ERROR")
                    continue

        log_message("Todos los cambios válidos han sido aplicados a la plantilla en memoria.")

        # 7. Asegurarse de que el directorio de salida exista
        output_dir = os.path.dirname(output_path)
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        # 8. Guardar el nuevo archivo en la ruta de salida especificada por el usuario
        wb.save(output_path)
        log_message(f"Acta generada exitosamente en: {output_path}")

        # 9. Devolver resultado de éxito
        print(json.dumps({
            "type": "result",
            "payload": {
                "success": True,
                "documentPath": output_path
            }
        }))

    except Exception as e:
        log_message(f"Error crítico generando el acta: {str(e)}", "ERROR")
        print(json.dumps({
            "type": "result",
            "payload": {
                "success": False,
                "error": str(e)
            }
        }))
        sys.exit(1)

if __name__ == "__main__":
    # MODIFICADO: Añadimos soporte para el flag --debug
    # El script espera 2 argumentos + el flag opcional: <ruta_json_temporal> <ruta_salida_excel> [--debug]
    if len(sys.argv) < 3:
        log_message("Uso: python comite_convivencia_acta_generator.py <ruta_json_temporal> <ruta_salida_excel> [--debug]", "ERROR")
        sys.exit(1)

    temp_json_path = sys.argv[1]
    final_output_path = sys.argv[2]
    main(temp_json_path, final_output_path)
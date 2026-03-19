# convert_xlsx_to_pdf.py - Script para convertir archivos XLSX a PDF
import sys
import json
import os
from pathlib import Path
import tempfile
import subprocess
from contextlib import redirect_stderr
import io

def main(xlsx_path_str, pdf_output_path_str=None):
    try:
        # Usar rutas absolutas para mayor compatibilidad
        xlsx_path = Path(xlsx_path_str).resolve()
        
        # Si no se proporciona ruta de salida, usar una temporal
        if pdf_output_path_str is None:
            temp_dir = Path(tempfile.gettempdir())
            pdf_output_path = (temp_dir / f"{xlsx_path.stem}_{os.urandom(4).hex()}.pdf").resolve()
        else:
            pdf_output_path = Path(pdf_output_path_str).resolve()

        # 1. Validar que el archivo existe y es un formato compatible
        if not xlsx_path.exists() or not xlsx_path.is_file():
            raise FileNotFoundError(f"El archivo no se encuentra: {xlsx_path}")

        file_extension = xlsx_path.suffix.lower()
        if file_extension not in ['.xls', '.xlsx']:
            raise ValueError(f"Formato '{file_extension}' no compatible. Solo se admiten .xls y .xlsx.")

        # 2. Realizar la conversión usando libreoffice en modo headless (método más confiable)
        try:
            # Comando para convertir usando LibreOffice
            cmd = [
                'libreoffice', 
                '--headless', 
                '--convert-to', 'pdf',
                '--outdir', str(pdf_output_path.parent),
                str(xlsx_path)
            ]
            
            # Ejecutar el comando
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0:
                # Encontrar el archivo PDF generado (mismo nombre, extensión .pdf)
                expected_pdf_path = pdf_output_path.parent / f"{xlsx_path.stem}.pdf"
                
                # Verificar si se generó el PDF y renombrarlo si es necesario
                if expected_pdf_path.exists():
                    if str(expected_pdf_path) != str(pdf_output_path):
                        expected_pdf_path.rename(pdf_output_path)
                else:
                    # Si no se encuentra con el nombre esperado, buscar cualquier PDF recién creado
                    pdf_files = list(pdf_output_path.parent.glob(f"{xlsx_path.stem}*.pdf"))
                    if pdf_files:
                        pdf_files[0].rename(pdf_output_path)
                    else:
                        raise Exception("No se encontró el archivo PDF generado por LibreOffice")
            else:
                raise Exception(f"Error de LibreOffice: {result.stderr}")
                
        except (subprocess.TimeoutExpired, FileNotFoundError):
            # Si LibreOffice no está disponible, intentar con openpyxl y reportlab
            convert_with_python(xlsx_path, pdf_output_path)

        if not pdf_output_path.exists():
            raise Exception("La conversión falló y el archivo PDF no fue creado.")

        # 3. Devolver la ruta del PDF
        print(json.dumps({"success": True, "pdf_path": str(pdf_output_path)}))

    except Exception as e:
        # 4. Devolver un error JSON claro
        error_message = str(e) if str(e) else "Ocurrió un error desconocido durante la conversión."
        print(json.dumps({"success": False, "error": error_message}), file=sys.stderr)
        sys.exit(1)

def convert_with_python(xlsx_path, pdf_output_path):
    """Método alternativo usando openpyxl y reportlab para convertir Excel a PDF"""
    try:
        from openpyxl import load_workbook
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter, A4
        from reportlab.lib.units import inch
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        # Cargar el archivo Excel
        wb = load_workbook(xlsx_path)
        ws = wb.active
        
        # Crear el PDF
        c = canvas.Canvas(str(pdf_output_path), pagesize=A4)
        width, height = A4
        left_margin = 50
        top_margin = height - 50
        row_height = 18
        col_width = 80
        
        current_y = top_margin
        page_num = 1
        
        # Iterar sobre las filas del Excel
        for row_idx, row in enumerate(ws.iter_rows()):
            # Verificar si necesitamos una nueva página (dejando espacio para el borde inferior)
            if current_y < 80:
                c.showPage()
                current_y = top_margin
                page_num += 1
            
            current_x = left_margin
            
            for col_idx, cell in enumerate(row):
                # Obtener el valor de la celda
                cell_value = str(cell.value) if cell.value is not None else ""
                
                # Limitar la longitud del texto para que quepa
                if len(cell_value) > 18:
                    cell_value = cell_value[:18] + "..."
                
                # Dibujar el texto en el PDF con tamaño de fuente reducido
                c.setFont("Helvetica", 6)
                c.drawString(current_x, current_y, cell_value[:25])
                
                current_x += col_width
                # Ajustar el ancho de columna si es necesario
                if current_x > width - 50:
                    break  # No dibujar más columnas que el espacio disponible
            
            current_y -= row_height
        
        # Guardar el PDF
        c.save()
        
    except ImportError:
        # Si no se pueden importar las librerías necesarias
        raise Exception("No se pudo encontrar LibreOffice ni las librerías Python necesarias para convertir Excel a PDF")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Uso: python convert_xlsx_to_pdf.py <ruta_xlsx> [ruta_salida_pdf]"}), file=sys.stderr)
        sys.exit(1)

    xlsx_path = sys.argv[1]
    pdf_output_path = sys.argv[2] if len(sys.argv) > 2 else None
    
    main(xlsx_path, pdf_output_path)
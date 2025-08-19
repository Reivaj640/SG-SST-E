# convert_docx_to_pdf.py - Script para convertir un archivo DOCX a PDF temporalmente
import sys
import json
import os
from pathlib import Path
import tempfile
from contextlib import redirect_stdout, redirect_stderr
from docx2pdf import convert

def main(docx_path_str):
    try:
        docx_path = Path(docx_path_str)
        if not docx_path.exists() or not docx_path.is_file():
            raise FileNotFoundError(f"El archivo DOCX no se encuentra: {docx_path}")

        # Usar el directorio temporal del sistema para la salida
        temp_dir = Path(tempfile.gettempdir())
        # Crear un nombre de archivo único para evitar colisiones
        pdf_path = temp_dir / f"{docx_path.stem}_{os.urandom(4).hex()}.pdf"

        # Realizar la conversión, suprimiendo la salida de la librería a stdout/stderr
        with open(os.devnull, 'w') as f, redirect_stdout(f), redirect_stderr(f):
            convert(str(docx_path), str(pdf_path))

        if not pdf_path.exists():
            raise Exception("La conversión falló y el archivo PDF no fue creado.")

        # Devolver la ruta del PDF como JSON al stdout original
        print(json.dumps({"success": True, "pdfPath": str(pdf_path)}))

    except Exception as e:
        # Imprimir errores como JSON para que el proceso principal los capture
        # sys.stdout original ya está restaurado aquí
        print(json.dumps({"success": False, "error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"success": False, "error": "Uso incorrecto: se requiere la ruta al archivo DOCX."}), file=sys.stderr)
        sys.exit(1)
    
    main(sys.argv[1])
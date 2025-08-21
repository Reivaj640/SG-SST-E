# convert_docx_to_pdf.py - Script para convertir archivos DOC y DOCX a PDF
import sys
import json
import os
from pathlib import Path
import tempfile
from contextlib import redirect_stderr

def main(doc_path_str):
    try:
        # Usar rutas absolutas para mayor compatibilidad con COM
        doc_path = Path(doc_path_str).resolve()
        file_suffix = doc_path.suffix.lower()

        # 1. Validar que el archivo existe y es un formato compatible
        if not doc_path.exists() or not doc_path.is_file():
            raise FileNotFoundError(f"El archivo no se encuentra: {doc_path}")
            
        if file_suffix not in ['.doc', '.docx']:
            raise ValueError(f"Formato '{file_suffix}' no compatible. Solo se admiten .doc y .docx.")

        # 2. Crear ruta para el PDF temporal
        temp_dir = Path(tempfile.gettempdir())
        pdf_path = (temp_dir / f"{doc_path.stem}_{os.urandom(4).hex()}.pdf").resolve()

        # 3. Realizar la conversión según el tipo de archivo
        
        # Para .docx, usamos la librería directa (método rápido)
        if file_suffix == '.docx':
            from docx2pdf import convert
            # Suprimir la barra de progreso que imprime la librería
            with open(os.devnull, 'w') as f, redirect_stderr(f):
                convert(str(doc_path), str(pdf_path))
        
        # Para .doc, usamos automatización COM con MS Word (requiere Word instalado)
        elif file_suffix == '.doc':
            word = None
            try:
                import win32com.client
                word = win32com.client.Dispatch("Word.Application")
                word.Visible = False
                doc = word.Documents.Open(str(doc_path))
                # El valor 17 corresponde al formato wdFormatPDF de Word
                doc.SaveAs(str(pdf_path), FileFormat=17)
                doc.Close()
            except ImportError:
                raise RuntimeError("La librería 'pywin32' es necesaria para esta función. Si no está instalada, ejecute: pip install pywin32")
            except Exception as e:
                raise RuntimeError(f"Error al convertir con MS Word. ¿Está instalado? Detalle: {e}")
            finally:
                if word:
                    word.Quit()

        if not pdf_path.exists():
            raise Exception("La conversión falló y el archivo PDF no fue creado.")

        # 4. Devolver la ruta del PDF
        print(json.dumps({"success": True, "pdf_path": str(pdf_path)}))

    except Exception as e:
        # 5. Devolver un error JSON claro
        error_message = str(e) if str(e) else "Ocurrió un error desconocido durante la conversión."
        print(json.dumps({"success": False, "error": error_message}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"success": False, "error": "Uso incorrecto: se requiere la ruta al archivo."}), file=sys.stderr)
        sys.exit(1)
    
    main(sys.argv[1])

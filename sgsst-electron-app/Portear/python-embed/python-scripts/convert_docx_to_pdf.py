# convert_docx_to_pdf.py - Script para convertir archivos DOC y DOCX a PDF
# Usa automatización COM de Word en modo invisible para evitar que el documento se abra visiblemente

import sys
import json
import os
from pathlib import Path
import tempfile
import time

def send_log(message):
    """Función auxiliar para enviar logs a stderr"""
    print(f"[CONVERT_DOCX] {message}", file=sys.stderr)

def main(doc_path_str, output_path=None):
    word = None
    try:
        # Usar rutas absolutas para mayor compatibilidad con COM
        doc_path = Path(doc_path_str).resolve()
        file_suffix = doc_path.suffix.lower()

        # 1. Validar que el archivo existe y es un formato compatible
        if not doc_path.exists() or not doc_path.is_file():
            raise FileNotFoundError(f"El archivo no se encuentra: {doc_path}")

        if file_suffix not in ['.doc', '.docx']:
            raise ValueError(f"Formato '{file_suffix}' no compatible. Solo se admiten .doc y .docx.")

        # 2. Crear ruta para el PDF, usando la ruta de salida si se proporciona
        if output_path:
            pdf_path = Path(output_path).resolve()
        else:
            temp_dir = Path(tempfile.gettempdir())
            pdf_path = (temp_dir / f"{doc_path.stem}_{os.urandom(4).hex()}.pdf").resolve()

        send_log(f"Iniciando conversión: {doc_path}")
        send_log(f"Archivo de salida: {pdf_path}")

        # 3. Importar win32com para automatización COM
        try:
            import win32com.client
        except ImportError:
            raise RuntimeError("La librería 'pywin32' es necesaria. Ejecute: pip install pywin32")

        # 4. Iniciar Word en modo INVISIBLE
        send_log("Iniciando Word.Application en modo invisible...")
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False  # CRUCIAL: Word no debe ser visible
        word.ScreenUpdating = False  # Deshabilitar actualizaciones de pantalla
        word.DisplayAlerts = False  # No mostrar alertas
        
        # 5. Abrir documento en modo solo lectura
        send_log(f"Abriendo documento: {doc_path}")
        doc = None
        try:
            # Parámetros para abrir en modo seguro y sin bloquear
            doc = word.Documents.Open(
                str(doc_path),
                ConfirmConversions=False,
                ReadOnly=True,           # Solo lectura
                AddToRecentFiles=False,  # No agregar a recientes
                Revert=False,
                Visible=False            # No mostrar el documento
            )
            send_log("Documento abierto exitosamente")
            
            # Pequeña pausa para asegurar que el documento se cargó completamente
            time.sleep(0.2)
            
            # 6. Guardar como PDF (17 = wdFormatPDF)
            send_log(f"Convirtiendo a PDF: {pdf_path}")
            
            # Usar SaveAs2 si está disponible (Word 2010+), sino usar SaveAs
            try:
                doc.SaveAs2(str(pdf_path), FileFormat=17)
            except AttributeError:
                # Fallback para versiones antiguas de Word
                doc.SaveAs(str(pdf_path), FileFormat=17)
            
            send_log(f"PDF creado: {pdf_path.exists()}")
            
            # 7. Verificar que el PDF se creó correctamente
            if not pdf_path.exists():
                raise Exception("La conversión falló y el archivo PDF no fue creado.")
            
            # Pequeña pausa para asegurar que el archivo se escribió completamente
            time.sleep(0.1)
            
            # 8. Cerrar documento
            doc.Close(SaveChanges=False)
            doc = None
            send_log("Documento cerrado")
            
        except Exception as doc_error:
            send_log(f"Error al procesar documento: {doc_error}")
            if doc:
                try:
                    doc.Close(SaveChanges=False)
                except:
                    pass
            raise doc_error
            
        # 9. Devolver la ruta del PDF
        print(json.dumps({"success": True, "pdf_path": str(pdf_path)}))
        send_log("Conversión completada exitosamente")

    except Exception as e:
        # 10. Devolver un error JSON claro
        error_message = str(e) if str(e) else "Ocurrió un error desconocido durante la conversión."
        send_log(f"ERROR: {error_message}")
        print(json.dumps({"success": False, "error": error_message}), file=sys.stderr)
        sys.exit(1)
        
    finally:
        # 11. Limpieza SIEMPRE ocurre
        if word:
            try:
                word.Quit()
                send_log("Word cerrado")
            except Exception as cleanup_error:
                send_log(f"Error al cerrar Word: {cleanup_error}")
        # Pequeña pausa para asegurar que Word se cerró completamente
        time.sleep(0.1)

if __name__ == "__main__":
    if len(sys.argv) < 2 or len(sys.argv) > 3:
        print(json.dumps({"success": False, "error": "Uso incorrecto: se requiere la ruta al archivo y opcionalmente la ruta de salida."}), file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) == 3 else None
    main(input_path, output_path)

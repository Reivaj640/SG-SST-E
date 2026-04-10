# convert_docx_to_pdf.py - Script para convertir archivos DOC y DOCX a PDF
# Múltiples métodos de conversión con fallback automático

import sys
import json
import os
import base64
import subprocess
import tempfile
import time
from pathlib import Path


def send_log(message):
    """Función auxiliar para enviar logs a stderr"""
    print(f"[CONVERT_DOCX] {message}", file=sys.stderr)


# ─── Método 1: pywin32 (COM directo) ─────────────────────────────────────────

def convert_via_pywin32(doc_path, pdf_path):
    """Convierte usando pywin32 (COM in-process). Lanza ImportError si no está instalado."""
    import win32com.client  # puede lanzar ImportError

    send_log("Método 1: Usando backend pywin32 (COM directo)...")
    word = None
    try:
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        word.ScreenUpdating = False
        word.DisplayAlerts = False

        doc = word.Documents.Open(
            str(doc_path),
            ConfirmConversions=False,
            ReadOnly=True,
            AddToRecentFiles=False,
            Revert=False,
            Visible=False
        )
        time.sleep(0.2)

        try:
            doc.SaveAs2(str(pdf_path), FileFormat=17)
        except AttributeError:
            doc.SaveAs(str(pdf_path), FileFormat=17)

        doc.Close(SaveChanges=False)
        send_log("Conversión pywin32 completada")
    finally:
        if word:
            try:
                word.Quit()
            except Exception:
                pass
        time.sleep(0.1)


# ─── Método 2: PowerShell + Word COM ─────────────────────────────────────────

def convert_via_powershell(doc_path, pdf_path):
    """
    Convierte usando PowerShell + Word COM.
    Las rutas se pasan via variables de entorno para evitar problemas de
    codificación con caracteres especiales (tildes, ñ, espacios, etc.)
    """
    send_log("Método 2: Usando backend PowerShell (pywin32 no disponible)...")

    ps_script = """
$ErrorActionPreference = 'Stop'
$inputPath  = $env:CONV_INPUT
$outputPath = $env:CONV_OUTPUT
$word = $null
try {
    $word = New-Object -ComObject 'Word.Application'
    $word.Visible        = $false
    $word.ScreenUpdating = $false
    $word.DisplayAlerts  = 0
    $doc = $word.Documents.Open($inputPath, $false, $true, $false)
    try {
        try   { $doc.SaveAs2($outputPath, 17) }
        catch { $doc.SaveAs($outputPath,  17) }
        $doc.Close($false)
    } catch {
        try { $doc.Close($false) } catch {}
        throw $_
    }
} finally {
    if ($word) { try { $word.Quit() } catch {} }
}
"""

    encoded_cmd = base64.b64encode(ps_script.encode("utf-16-le")).decode("ascii")

    env = os.environ.copy()
    env["CONV_INPUT"]  = str(doc_path)
    env["CONV_OUTPUT"] = str(pdf_path)

    result = subprocess.run(
        [
            "powershell",
            "-ExecutionPolicy", "Bypass",
            "-NonInteractive",
            "-EncodedCommand", encoded_cmd,
        ],
        capture_output=True,
        text=True,
        timeout=120,
        env=env,
    )

    if result.returncode != 0:
        err = (result.stderr or result.stdout or "Error desconocido en PowerShell").strip()
        raise RuntimeError(f"PowerShell falló (código {result.returncode}): {err}")

    send_log("Conversión PowerShell completada")


# ─── Método 3: comtypes (COM alternativo) ────────────────────────────────────

def convert_via_comtypes(doc_path, pdf_path):
    """Convierte usando comtypes en lugar de pywin32."""
    send_log("Método 3: Usando comtypes (COM alternativo)...")
    
    import comtypes.client
    
    word = None
    try:
        word = comtypes.client.CreateObject("Word.Application")
        word.Visible = False
        word.ScreenUpdating = False
        word.DisplayAlerts = 0

        doc = word.Documents.Open(
            str(doc_path),
            ConfirmConversions=False,
            ReadOnly=True,
            AddToRecentFiles=False,
            Revert=False,
            Visible=False
        )
        time.sleep(0.2)

        doc.SaveAs2(str(pdf_path), FileFormat=17)
        doc.Close(SaveChanges=False)
        send_log("Conversión comtypes completada")
    finally:
        if word:
            try:
                word.Quit()
            except Exception:
                pass
        time.sleep(0.1)


# ─── Método 4: docx2pdf (wrapper COM) ────────────────────────────────────────

def convert_via_docx2pdf(doc_path, pdf_path):
    """Convierte usando docx2pdf (usa COM internamente pero a veces funciona)."""
    send_log("Método 4: Usando docx2pdf...")
    
    from docx2pdf import convert
    
    # docx2pdf usa COM internamente pero con su propio manejo
    convert(str(doc_path), str(pdf_path))
    send_log("Conversión docx2pdf completada")


# ─── Método 5: pandoc (conversor universal, sin COM) ─────────────────────────

def find_pandoc_path():
    """Busca pandoc.exe en rutas comunes."""
    candidates = [
        os.environ.get("PANDOC_PATH"),
        r"C:\Program Files\Pandoc\pandoc.exe",
        r"C:\Program Files (x86)\Pandoc\pandoc.exe",
        r"C:\Users\Javier RF\AppData\Local\Pandoc\pandoc.exe",
    ]
    
    for p in candidates:
        if p and Path(p).exists():
            return Path(p)
    
    # Buscar en PATH
    try:
        result = subprocess.run(["where", "pandoc"], capture_output=True, text=True)
        if result.returncode == 0:
            return Path(result.stdout.strip().split("\n")[0])
    except:
        pass
    
    return None


def convert_via_pandoc(doc_path, pdf_path):
    """Convierte usando pandoc (sin dependencia de COM ni Office)."""
    send_log("Método 5: Buscando pandoc...")
    
    pandoc = find_pandoc_path()
    if not pandoc:
        raise RuntimeError(
            "Pandoc no encontrado. Instalar desde: https://pandoc.org/installing.html\n"
            "O agregar al PATH: setx PANDOC_PATH \"ruta\\a\\pandoc.exe\""
        )
    
    send_log(f"Usando pandoc: {pandoc}")
    
    result = subprocess.run(
        [
            str(pandoc),
            str(doc_path),
            "-o", str(pdf_path),
        ],
        capture_output=True,
        text=True,
        timeout=120,
        cwd=str(doc_path.parent)
    )
    
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "Error desconocido en pandoc").strip()
        raise RuntimeError(f"Pandoc falló: {err}")
    
    if not pdf_path.exists():
        raise RuntimeError("Pandoc finalizó pero no creó el PDF")
    
    send_log("Conversión pandoc completada")


# ─── Método 6: python-docx + reportlab (puro Python, sin COM) ────────────────

def convert_via_python_libs(doc_path, pdf_path):
    """
    Conversión pura Python sin COM ni herramientas externas.
    Usa python-docx para leer DOCX y reportlab para generar PDF.
    Nota: No preserva formato perfectamente pero funciona sin dependencias externas.
    """
    send_log("Método 6: Usando python-docx + reportlab (puro Python)...")
    
    from docx import Document
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    
    # Leer DOCX
    doc = Document(str(doc_path))
    
    # Crear PDF
    pdf = SimpleDocTemplate(
        str(pdf_path),
        pagesize=letter,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72
    )
    
    styles = getSampleStyleSheet()
    
    # Crear estilos personalizados
    styles.add(ParagraphStyle(
        name='CustomHeading1',
        parent=styles['Heading1'],
        fontSize=16,
        spaceAfter=12
    ))
    styles.add(ParagraphStyle(
        name='CustomHeading2',
        parent=styles['Heading2'],
        fontSize=14,
        spaceAfter=10
    ))
    
    story = []
    
    for para in doc.paragraphs:
        if not para.text.strip():
            story.append(Spacer(1, 6))
            continue
        
        # Determinar estilo según nivel de encabezado
        if para.style.name.startswith('Heading 1'):
            story.append(Paragraph(para.text, styles['CustomHeading1']))
        elif para.style.name.startswith('Heading 2'):
            story.append(Paragraph(para.text, styles['CustomHeading2']))
        else:
            story.append(Paragraph(para.text, styles['Normal']))
        
        story.append(Spacer(1, 3))
    
    # Agregar tablas si existen
    for table in doc.tables:
        from reportlab.lib import colors
        from reportlab.platypus import Table as RLTable, TableStyle
        
        data = []
        for row in table.rows:
            row_data = []
            for cell in row.cells:
                row_data.append(cell.text.strip())
            data.append(row_data)
        
        if data:
            rl_table = RLTable(data, colWidths=[2*inch] * len(data[0]))
            rl_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(rl_table)
            story.append(Spacer(1, 12))
    
    pdf.build(story)
    send_log("Conversión python-docx + reportlab completada")


# ─── Main: Cadena de fallback ────────────────────────────────────────────────

def main(doc_path_str, output_path=None):
    try:
        doc_path    = Path(doc_path_str).resolve()
        file_suffix = doc_path.suffix.lower()

        if not doc_path.exists() or not doc_path.is_file():
            raise FileNotFoundError(f"El archivo no se encuentra: {doc_path}")

        if file_suffix not in [".doc", ".docx"]:
            raise ValueError(f"Formato '{file_suffix}' no compatible. Solo se admiten .doc y .docx.")

        if output_path:
            pdf_path = Path(output_path).resolve()
        else:
            temp_dir = Path(tempfile.gettempdir())
            pdf_path = (temp_dir / f"{doc_path.stem}_{os.urandom(4).hex()}.pdf").resolve()

        send_log(f"Iniciando conversión: {doc_path}")
        send_log(f"Archivo de salida: {pdf_path}")

        # ── Cadena de fallback (7 métodos) ─────────────────────────────────
        
        errors = []
        
        # Método 1: pywin32
        try:
            convert_via_pywin32(doc_path, pdf_path)
            send_log("✅ Conversión exitosa con pywin32")
        except Exception as e1:
            err_msg = str(e1)
            send_log(f"✗ Método 1 falló: {err_msg[:100]}")
            errors.append(("pywin32", err_msg))
            
            # Verificar si es error de biblioteca de tipo COM
            is_com_library_error = "TYPE_E_CANTLOADLIBRARY" in err_msg or "80029C4A" in err_msg or "QueryInterface" in err_msg
            
            if is_com_library_error:
                send_log("   → Detectado error TYPE_E_CANTLOADLIBRARY (biblioteca COM corrupta)")
                send_log("   → Intentando reparar COM automáticamente...")
                
                # Intentar reparación COM antes de continuar
                try:
                    repair_script = Path(__file__).parent / "repair_word_com.py"
                    if repair_script.exists():
                        result = subprocess.run(
                            [sys.executable, str(repair_script)],
                            capture_output=True,
                            text=True,
                            timeout=180
                        )
                        send_log(f"   Reparación: {result.stdout[:200] if result.stdout else 'sin salida'}")
                        
                        # Reintentar pywin32 después de reparación
                        send_log("   Reintentando pywin32 después de reparación...")
                        try:
                            convert_via_pywin32(doc_path, pdf_path)
                            send_log("✅ Conversión exitosa con pywin32 (después de reparación)")
                        except Exception as e1_retry:
                            send_log(f"   ✗ pywin32 sigue fallando después de reparación")
                            errors.append(("pywin32 (post-repair)", str(e1_retry)))
                except Exception as repair_err:
                    send_log(f"   ✗ Reparación falló: {repair_err}")
                    errors.append(("repair", str(repair_err)))
            
            # Método 2: PowerShell COM
            if not pdf_path.exists():
                try:
                    convert_via_powershell(doc_path, pdf_path)
                    send_log("✅ Conversión exitosa con PowerShell COM")
                except Exception as e2:
                    send_log(f"✗ Método 2 falló: {str(e2)[:100]}")
                    errors.append(("powershell", str(e2)))
            
            # Método 3: comtypes
            if not pdf_path.exists():
                try:
                    convert_via_comtypes(doc_path, pdf_path)
                    send_log("✅ Conversión exitosa con comtypes")
                except Exception as e3:
                    send_log(f"✗ Método 3 falló: {str(e3)[:100]}")
                    errors.append(("comtypes", str(e3)))
            
            # Método 4: docx2pdf
            if not pdf_path.exists():
                try:
                    convert_via_docx2pdf(doc_path, pdf_path)
                    send_log("✅ Conversión exitosa con docx2pdf")
                except Exception as e4:
                    send_log(f"✗ Método 4 falló: {str(e4)[:100]}")
                    errors.append(("docx2pdf", str(e4)))
            
            # Método 5: pandoc
            if not pdf_path.exists():
                try:
                    convert_via_pandoc(doc_path, pdf_path)
                    send_log("✅ Conversión exitosa con pandoc")
                except Exception as e5:
                    send_log(f"✗ Método 5 falló: {str(e5)[:100]}")
                    errors.append(("pandoc", str(e5)))
            
            # Método 6: python-docx + reportlab
            if not pdf_path.exists():
                try:
                    convert_via_python_libs(doc_path, pdf_path)
                    send_log("✅ Conversión exitosa con python-docx + reportlab")
                except Exception as e6:
                    send_log(f"✗ Método 6 falló: {str(e6)[:100]}")
                    errors.append(("python-docx+reportlab", str(e6)))

        # ── Verificar resultado ──────────────────────────────────────────────
        if not pdf_path.exists():
            # Todos los métodos fallaron - generar informe de error
            error_report = "\n".join(
                f"  - {method}: {err[:150]}" for method, err in errors
            )
            
            raise RuntimeError(
                f"Todos los métodos de conversión fallaron.\n"
                f"Errores:\n{error_report}\n\n"
                f"SOLUCIONES:\n"
                f"1. Reparar COM: python repair_word_com.py\n"
                f"2. Instalar pandoc: https://pandoc.org/installing.html\n"
                f"3. Reparación de Office: Panel de Control → Programas → Office → Cambiar → Reparar\n"
                f"4. Verificar arquitecturas: Python y Office deben ser del mismo tipo (32/64-bit)"
            )

        send_log(f"PDF generado ({pdf_path.stat().st_size} bytes): {pdf_path}")
        print(json.dumps({"success": True, "pdf_path": str(pdf_path)}))

    except Exception as e:
        error_message = str(e) if str(e) else "Error desconocido durante la conversión."
        send_log(f"ERROR: {error_message}")
        print(json.dumps({"success": False, "error": error_message}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 2 or len(sys.argv) > 3:
        print(json.dumps({"success": False, "error": "Uso: convert_docx_to_pdf.py <input> [output]"}),
              file=sys.stderr)
        sys.exit(1)

    main(sys.argv[1], sys.argv[2] if len(sys.argv) == 3 else None)

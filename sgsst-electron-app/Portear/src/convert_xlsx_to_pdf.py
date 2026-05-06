# convert_xlsx_to_pdf.py - Script para convertir archivos XLS/XLSX a PDF
# Multiples metodos de conversion con fallback automatico

import sys
import json
import os
import base64
import subprocess
import tempfile
import time
from pathlib import Path


def send_log(message):
    print(f"[CONVERT_XLSX] {message}", file=sys.stderr)


# ─── Metodo 1: pywin32 (COM directo) ─────────────────────────────────────────

def convert_via_pywin32(xlsx_path, pdf_path):
    """Convierte usando pywin32 (COM in-process). Lanza ImportError si no esta instalado."""
    import win32com.client

    send_log("Metodo 1: Usando backend pywin32 (COM directo)...")
    excel = None
    try:
        excel = win32com.client.Dispatch("Excel.Application")
        excel.Visible = False
        excel.DisplayAlerts = False

        wb = excel.Workbooks.Open(
            str(xlsx_path),
            UpdateLinks=0,
            ReadOnly=True
        )
        time.sleep(0.3)

        wb.ExportAsFixedFormat(0, str(pdf_path))
        wb.Close(SaveChanges=False)
        send_log("Conversion pywin32 completada")
    finally:
        if excel:
            try:
                excel.Quit()
            except Exception:
                pass
        time.sleep(0.1)


# ─── Metodo 2: PowerShell + Excel COM ────────────────────────────────────────

def convert_via_powershell(xlsx_path, pdf_path):
    """
    Convierte usando PowerShell + Excel COM.
    Las rutas se pasan via variables de entorno para evitar problemas de
    codificacion con caracteres especiales (tildes, enye, espacios, etc.)
    """
    send_log("Metodo 2: Usando backend PowerShell (pywin32 no disponible)...")

    ps_script = """
$ErrorActionPreference = 'Stop'
$inputPath = $env:CONV_INPUT
$outputPath = $env:CONV_OUTPUT
$excel = $null
try {
    $excel = New-Object -ComObject 'Excel.Application'
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $wb = $excel.Workbooks.Open($inputPath, 0, $true)
    try {
        $wb.ExportAsFixedFormat(0, $outputPath)
        $wb.Close($false)
    } catch {
        try { $wb.Close($false) } catch {}
        throw $_
    }
} finally {
    if ($excel) { try { $excel.Quit() } catch {} }
}
"""

    encoded_cmd = base64.b64encode(ps_script.encode("utf-16-le")).decode("ascii")

    env = os.environ.copy()
    env["CONV_INPUT"] = str(xlsx_path)
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
        raise RuntimeError(f"PowerShell fallo (codigo {result.returncode}): {err}")

    send_log("Conversion PowerShell completada")


# ─── Metodo 3: comtypes (COM alternativo) ────────────────────────────────────

def convert_via_comtypes(xlsx_path, pdf_path):
    """Convierte usando comtypes en lugar de pywin32."""
    send_log("Metodo 3: Usando comtypes (COM alternativo)...")

    import comtypes.client

    excel = None
    try:
        excel = comtypes.client.CreateObject("Excel.Application")
        excel.Visible = False
        excel.DisplayAlerts = 0

        wb = excel.Workbooks.Open(
            str(xlsx_path),
            UpdateLinks=0,
            ReadOnly=True
        )
        time.sleep(0.3)

        wb.ExportAsFixedFormat(0, str(pdf_path))
        wb.Close(SaveChanges=False)
        send_log("Conversion comtypes completada")
    finally:
        if excel:
            try:
                excel.Quit()
            except Exception:
                pass
        time.sleep(0.1)


# ─── Metodo 4: LibreOffice headless ──────────────────────────────────────────

def convert_via_libreoffice(xlsx_path, pdf_path):
    """Convierte usando LibreOffice en modo headless."""
    send_log("Metodo 4: Usando LibreOffice headless...")

    candidates = [
        "libreoffice",
        "soffice",
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ]

    lo_path = None
    for candidate in candidates:
        try:
            if os.path.isabs(candidate):
                if Path(candidate).exists():
                    lo_path = candidate
                    break
            else:
                test_result = subprocess.run(
                    ["where", candidate],
                    capture_output=True, text=True, timeout=5
                )
                if test_result.returncode == 0:
                    lo_path = candidate
                    break
        except Exception:
            continue

    if not lo_path:
        raise FileNotFoundError("LibreOffice no encontrado en el sistema")

    send_log(f"Usando LibreOffice: {lo_path}")

    cmd = [
        lo_path,
        '--headless',
        '--convert-to', 'pdf',
        '--outdir', str(pdf_path.parent),
        str(xlsx_path)
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

    if result.returncode == 0:
        expected_pdf = pdf_path.parent / f"{xlsx_path.stem}.pdf"
        if expected_pdf.exists():
            if str(expected_pdf) != str(pdf_path):
                expected_pdf.rename(pdf_path)
        else:
            pdf_files = list(pdf_path.parent.glob(f"{xlsx_path.stem}*.pdf"))
            if pdf_files:
                pdf_files[0].rename(pdf_path)
            else:
                raise RuntimeError("LibreOffice finalizo pero no creo el PDF")
    else:
        raise RuntimeError(f"LibreOffice fallo: {result.stderr}")

    send_log("Conversion LibreOffice completada")


# ─── Metodo 5: openpyxl + reportlab (mejorado) ──────────────────────────────

def convert_via_openpyxl_enhanced(xlsx_path, pdf_path):
    """
    Conversion usando openpyxl + reportlab con mejor calidad.
    - Fuente legible (8pt)
    - Multiples hojas
    - Anchos de columna dinamicos
    - Headers con estilo K+AIR
    - Bordes de celda
    """
    send_log("Metodo 5: Usando openpyxl + reportlab (mejorado)...")

    from openpyxl import load_workbook
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    wb = load_workbook(str(xlsx_path), read_only=True, data_only=True)

    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    width, height = A4
    left_margin = 15 * mm
    top_margin = 15 * mm
    right_margin = 15 * mm
    bottom_margin = 15 * mm
    usable_width = width - left_margin - right_margin
    row_height = 5 * mm
    font_size = 7
    header_font_size = 8
    max_rows_per_page = int((height - top_margin - bottom_margin) / row_height)

    try:
        font_path = r"C:\Windows\Fonts\segoeui.ttf"
        if Path(font_path).exists():
            pdfmetrics.registerFont(TTFont('SegoeUI', font_path))
            body_font = 'SegoeUI'
        else:
            body_font = 'Helvetica'
    except Exception:
        body_font = 'Helvetica'

    header_font = body_font.replace('SegoeUI', 'SegoeUI-Bold') if 'SegoeUI' in body_font else 'Helvetica-Bold'

    for sheet_idx, ws in enumerate(wb.worksheets):
        if sheet_idx > 0:
            c.showPage()

        current_y = height - top_margin

        c.setFont(header_font, 10)
        c.drawString(left_margin, current_y, f"Hoja: {ws.title}")
        current_y -= row_height * 1.5

        col_count = 0
        for col in ws.iter_cols(min_row=1, max_row=1):
            col_count += 1

        if col_count == 0:
            continue

        col_width = min(usable_width / max(col_count, 1), 60 * mm)

        if col_count * col_width > usable_width:
            col_width = usable_width / col_count

        max_chars = int(col_width / (font_size * 0.45))

        first_row = True
        rows_on_page = 0

        for row in ws.iter_rows():
            if rows_on_page >= max_rows_per_page:
                c.showPage()
                current_y = height - top_margin
                rows_on_page = 0

            current_x = left_margin

            for col_idx, cell in enumerate(row):
                cell_x_end = current_x + col_width

                if cell_x_end > width - right_margin:
                    break

                cell_value = str(cell.value) if cell.value is not None else ""

                if len(cell_value) > max_chars:
                    cell_value = cell_value[:max_chars - 2] + ".."

                if first_row:
                    c.setFillColor(colors.HexColor("#174ea6"))
                    c.rect(current_x, current_y - 2 * mm, col_width, row_height, fill=True, stroke=False)
                    c.setFillColor(colors.white)
                    c.setFont(header_font, header_font_size)
                    c.drawString(current_x + 1 * mm, current_y, cell_value)
                    c.setFillColor(colors.black)
                else:
                    c.setStrokeColor(colors.HexColor("#dee2e6"))
                    c.setLineWidth(0.3)
                    c.line(current_x, current_y - 2 * mm, current_x, current_y + row_height - 2 * mm)
                    c.line(current_x, current_y - 2 * mm, current_x + col_width, current_y - 2 * mm)

                    c.setFont(body_font, font_size)
                    c.drawString(current_x + 1 * mm, current_y, cell_value)

                current_x += col_width

            first_row = False
            current_y -= row_height
            rows_on_page += 1

    c.save()
    send_log("Conversion openpyxl mejorada completada")


# ─── Metodo 6: openpyxl + reportlab (basico - ultimo recurso) ────────────────

def convert_via_openpyxl_basic(xlsx_path, pdf_path):
    """
    Conversion basica usando openpyxl + reportlab.
    Solo hoja activa, sin estilos. Ultimo recurso si todo lo demas falla.
    """
    send_log("Metodo 6: Usando openpyxl + reportlab (basico)...")

    from openpyxl import load_workbook
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4

    wb = load_workbook(str(xlsx_path))
    ws = wb.active

    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    width, height = A4
    left_margin = 50
    top_margin = height - 50
    row_height = 18
    col_width = 80
    current_y = top_margin

    for row_idx, row in enumerate(ws.iter_rows()):
        if current_y < 80:
            c.showPage()
            current_y = top_margin

        current_x = left_margin

        for col_idx, cell in enumerate(row):
            cell_value = str(cell.value) if cell.value is not None else ""

            if len(cell_value) > 18:
                cell_value = cell_value[:18] + "..."

            c.setFont("Helvetica", 6)
            c.drawString(current_x, current_y, cell_value[:25])

            current_x += col_width
            if current_x > width - 50:
                break

        current_y -= row_height

    c.save()
    send_log("Conversion openpyxl basica completada")


# ─── Main: Cadena de fallback ────────────────────────────────────────────────

def main(xlsx_path_str, pdf_output_path_str=None):
    try:
        xlsx_path = Path(xlsx_path_str).resolve()

        if pdf_output_path_str is None:
            temp_dir = Path(tempfile.gettempdir())
            pdf_output_path = (temp_dir / f"{xlsx_path.stem}_{os.urandom(4).hex()}.pdf").resolve()
        else:
            pdf_output_path = Path(pdf_output_path_str).resolve()

        if not xlsx_path.exists() or not xlsx_path.is_file():
            raise FileNotFoundError(f"El archivo no se encuentra: {xlsx_path}")

        file_extension = xlsx_path.suffix.lower()
        if file_extension not in ['.xls', '.xlsx']:
            raise ValueError(f"Formato '{file_extension}' no compatible. Solo se admiten .xls y .xlsx.")

        send_log(f"Iniciando conversion: {xlsx_path}")
        send_log(f"Archivo de salida: {pdf_output_path}")

        errors = []

        # Metodo 1: pywin32
        try:
            convert_via_pywin32(xlsx_path, pdf_output_path)
            send_log("Conversion exitosa con pywin32")
        except Exception as e1:
            err_msg = str(e1)
            send_log(f"Metodo 1 fallo: {err_msg[:100]}")
            errors.append(("pywin32", err_msg))

            is_com_library_error = "TYPE_E_CANTLOADLIBRARY" in err_msg or "80029C4A" in err_msg or "QueryInterface" in err_msg
            if is_com_library_error:
                send_log("Detectado error TYPE_E_CANTLOADLIBRARY (biblioteca COM corrupta)")
                try:
                    repair_script = Path(__file__).parent / "repair_word_com.py"
                    if repair_script.exists():
                        send_log("Intentando reparar COM automaticamente...")
                        result = subprocess.run(
                            [sys.executable, str(repair_script)],
                            capture_output=True, text=True, timeout=180
                        )
                        send_log(f"Reparacion: {result.stdout[:200] if result.stdout else 'sin salida'}")
                        try:
                            convert_via_pywin32(xlsx_path, pdf_output_path)
                            send_log("Conversion exitosa con pywin32 (despues de reparacion)")
                        except Exception as e1_retry:
                            send_log(f"pywin32 sigue fallando despues de reparacion")
                            errors.append(("pywin32 (post-repair)", str(e1_retry)))
                except Exception as repair_err:
                    send_log(f"Reparacion fallo: {repair_err}")
                    errors.append(("repair", str(repair_err)))

        # Metodo 2: PowerShell COM
        if not pdf_output_path.exists():
            try:
                convert_via_powershell(xlsx_path, pdf_output_path)
                send_log("Conversion exitosa con PowerShell COM")
            except Exception as e2:
                send_log(f"Metodo 2 fallo: {str(e2)[:100]}")
                errors.append(("powershell", str(e2)))

        # Metodo 3: comtypes
        if not pdf_output_path.exists():
            try:
                convert_via_comtypes(xlsx_path, pdf_output_path)
                send_log("Conversion exitosa con comtypes")
            except Exception as e3:
                send_log(f"Metodo 3 fallo: {str(e3)[:100]}")
                errors.append(("comtypes", str(e3)))

        # Metodo 4: LibreOffice
        if not pdf_output_path.exists():
            try:
                convert_via_libreoffice(xlsx_path, pdf_output_path)
                send_log("Conversion exitosa con LibreOffice")
            except Exception as e4:
                send_log(f"Metodo 4 fallo: {str(e4)[:100]}")
                errors.append(("libreoffice", str(e4)))

        # Metodo 5: openpyxl + reportlab (mejorado)
        if not pdf_output_path.exists():
            try:
                convert_via_openpyxl_enhanced(xlsx_path, pdf_output_path)
                send_log("Conversion exitosa con openpyxl mejorado")
            except Exception as e5:
                send_log(f"Metodo 5 fallo: {str(e5)[:100]}")
                errors.append(("openpyxl-enhanced", str(e5)))

        # Metodo 6: openpyxl + reportlab (basico)
        if not pdf_output_path.exists():
            try:
                convert_via_openpyxl_basic(xlsx_path, pdf_output_path)
                send_log("Conversion exitosa con openpyxl basico")
            except Exception as e6:
                send_log(f"Metodo 6 fallo: {str(e6)[:100]}")
                errors.append(("openpyxl-basic", str(e6)))

        # Verificar resultado
        if not pdf_output_path.exists():
            error_report = "\n".join(
                f"  - {method}: {err[:150]}" for method, err in errors
            )
            raise RuntimeError(
                f"Todos los metodos de conversion fallaron.\n"
                f"Errores:\n{error_report}\n\n"
                f"SOLUCIONES:\n"
                f"1. Instalar Microsoft Excel (COM)\n"
                f"2. Instalar LibreOffice: https://www.libreoffice.org/download\n"
                f"3. Verificar arquitecturas: Python y Office deben ser del mismo tipo (32/64-bit)\n"
                f"4. Instalar openpyxl y reportlab: pip install openpyxl reportlab"
            )

        send_log(f"PDF generado ({pdf_output_path.stat().st_size} bytes): {pdf_output_path}")
        print(json.dumps({"success": True, "pdf_path": str(pdf_output_path)}))

    except Exception as e:
        error_message = str(e) if str(e) else "Error desconocido durante la conversion."
        send_log(f"ERROR: {error_message}")
        print(json.dumps({"success": False, "error": error_message}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Uso: python convert_xlsx_to_pdf.py <ruta_xlsx> [ruta_salida_pdf]"}), file=sys.stderr)
        sys.exit(1)

    xlsx_path = sys.argv[1]
    pdf_output_path = sys.argv[2] if len(sys.argv) > 2 else None

    main(xlsx_path, pdf_output_path)

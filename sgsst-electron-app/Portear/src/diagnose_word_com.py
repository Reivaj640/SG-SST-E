# diagnose_word_com.py - Diagnóstico completo del estado de Word COM
# Reporta estado de pywin32, registro COM, arquitectura y versión de Office

import sys
import json
import os
from pathlib import Path


def send_log(message):
    """Función auxiliar para enviar logs a stderr"""
    print(f"[DIAGNOSE] {message}", file=sys.stderr)


def diagnose():
    """Ejecuta diagnóstico completo de Word COM."""
    results = {
        "python_version": sys.version,
        "python_arch": "64-bit" if sys.maxsize > 2**32 else "32-bit",
        "pywin32_installed": False,
        "pywin32_version": None,
        "com_working": False,
        "com_error": None,
        "office_version": None,
        "office_arch": None,
        "word_path": None,
        "registry_ok": False,
        "recommendations": []
    }
    
    # 1. Verificar pywin32
    send_log("1. Verificando pywin32...")
    try:
        import win32com.client
        import win32com
        results["pywin32_installed"] = True
        results["pywin32_version"] = getattr(win32com, "__version__", "desconocida")
        send_log(f"   ✓ pywin32 instalado (versión: {results['pywin32_version']})")
    except ImportError as e:
        results["com_error"] = f"pywin32 no instalado: {e}"
        results["recommendations"].append(
            "Instalar pywin32: pip install pywin32\n"
            "  Luego ejecutar: python Scripts/pywin32_postinstall.py -install"
        )
        send_log(f"   ✗ pywin32 NO instalado: {e}")
        return results
    
    # 2. Verificar registro COM
    send_log("2. Verificando registro COM...")
    try:
        import winreg
        key = winreg.OpenKey(
            winreg.HKEY_CLASSES_ROOT,
            "Word.Application\\CLSID",
            0,
            winreg.KEY_READ
        )
        clsid, _ = winreg.QueryValueEx(key, "")
        winreg.CloseKey(key)
        results["registry_ok"] = True
        send_log(f"   ✓ Word.Application registrado (CLSID: {clsid})")
        
        # Verificar biblioteca de tipo
        try:
            type_lib_key = winreg.OpenKey(
                winreg.HKEY_CLASSES_ROOT,
                f"TypeLib\\{{{clsid}}}",
                0,
                winreg.KEY_READ
            )
            winreg.CloseKey(type_lib_key)
            send_log("   ✓ Biblioteca de tipo encontrada")
        except WindowsError:
            send_log("   ⚠ Biblioteca de tipo NO encontrada (posible causa del error)")
            results["recommendations"].append(
                "Biblioteca de tipo faltante. Ejecutar: winword.exe /r"
            )
    except FileNotFoundError:
        results["registry_ok"] = False
        send_log("   ✗ Word.Application NO está registrado")
        results["recommendations"].append(
            "Registro COM corrupto. Opciones:\n"
            "  1. Ejecutar: winword.exe /r\n"
            "  2. Reparación Rápida de Office (Panel de Control)\n"
            "  3. Reparación en Línea de Office"
        )
    except Exception as e:
        results["registry_ok"] = False
        send_log(f"   ✗ Error verificando registro: {e}")
    
    # 3. Buscar WINWORD.EXE
    send_log("3. Buscando WINWORD.EXE...")
    word_paths = [
        r"C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE",
        r"C:\Program Files (x86)\Microsoft Office\root\Office16\WINWORD.EXE",
        r"C:\Program Files\Microsoft Office\Office16\WINWORD.EXE",
        r"C:\Program Files (x86)\Microsoft Office\Office16\WINWORD.EXE",
        r"C:\Program Files\Microsoft Office\root\Office15\WINWORD.EXE",
        r"C:\Program Files (x86)\Microsoft Office\root\Office15\WINWORD.EXE",
    ]
    
    word_exe = None
    for p in word_paths:
        if Path(p).exists():
            word_exe = p
            break
    
    if word_exe:
        results["word_path"] = word_exe
        # Detectar arquitectura de Office
        if "Program Files (x86)" in word_exe:
            results["office_arch"] = "32-bit"
        else:
            results["office_arch"] = "64-bit"
        send_log(f"   ✓ Word encontrado: {word_exe}")
        send_log(f"   Arquitectura Office: {results['office_arch']}")
        
        # Verificar coincidencia de arquitecturas
        if results["python_arch"] != results["office_arch"]:
            send_log(f"   ⚠ ADVERTENCIA: Python {results['python_arch']} != Office {results['office_arch']}")
            results["recommendations"].append(
                f"Arquitecturas no coinciden: Python {results['python_arch']} vs Office {results['office_arch']}\n"
                "  Esto puede causar errores COM. Instalar Python del mismo arco que Office."
            )
    else:
        send_log("   ✗ WINWORD.EXE no encontrado")
        results["recommendations"].append(
            "Microsoft Word no está instalado o no se encontró en rutas estándar."
        )
    
    # 4. Intentar crear instancia de Word.Application
    send_log("4. Intentando crear Word.Application...")
    try:
        import win32com.client
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        word.ScreenUpdating = False
        
        results["com_working"] = True
        results["office_version"] = word.Version
        send_log(f"   ✓ Word.Application creado exitosamente")
        send_log(f"   ✓ Versión de Word: {results['office_version']}")
        
        word.Quit()
        
    except Exception as e:
        error_str = str(e)
        results["com_working"] = False
        results["com_error"] = error_str
        send_log(f"   ✗ Error creando Word.Application: {error_str}")
        
        # Analizar tipo de error
        if "TYPE_E_CANTLOADLIBRARY" in error_str or "80029C4A" in error_str:
            send_log("   → Error TYPE_E_CANTLOADLIBRARY detectado")
            results["recommendations"].append(
                "Error TYPE_E_CANTLOADLIBRARY: Biblioteca de tipo COM corrupta.\n"
                "  SOLUCIÓN 1 (Recomendada): Ejecutar repair_word_com.py\n"
                "  SOLUCIÓN 2: Reparación Rápida de Office desde Panel de Control\n"
                "  SOLUCIÓN 3: Ejecutar manualmente: \"C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE\" /r"
            )
        elif "Class not registered" in error_str or "80040154" in error_str:
            send_log("   → Error Class not registered detectado")
            results["recommendations"].append(
                "Clase COM no registrada. Word puede no estar instalado correctamente.\n"
                "  SOLUCIÓN: Reparación en Línea de Office desde Panel de Control"
            )
        else:
            results["recommendations"].append(
                f"Error COM desconocido: {error_str}\n"
                "  Intentar: winword.exe /r o reparación de Office"
            )
    
    # 5. Verificar alternativas
    send_log("5. Verificando alternativas de conversión...")
    
    # docx2pdf
    try:
        import docx2pdf
        send_log("   ✓ docx2pdf disponible")
    except ImportError:
        send_log("   ✗ docx2pdf no instalado")
        results["recommendations"].append(
            "Alternativa: Instalar docx2pdf (pip install docx2pdf)"
        )
    
    # comtypes
    try:
        import comtypes
        send_log("   ✓ comtypes disponible")
    except ImportError:
        send_log("   ✗ comtypes no instalado")
        results["recommendations"].append(
            "Alternativa: Instalar comtypes (pip install comtypes)"
        )
    
    # pandoc
    pandoc_paths = [
        r"C:\Program Files\Pandoc\pandoc.exe",
        r"C:\Program Files (x86)\Pandoc\pandoc.exe",
    ]
    pandoc_found = any(Path(p).exists() for p in pandoc_paths if p)
    if pandoc_found:
        send_log("   ✓ pandoc encontrado")
    else:
        send_log("   ✗ pandoc no instalado")
        results["recommendations"].append(
            "Alternativa: Instalar pandoc desde https://pandoc.org/installing.html"
        )
    
    # python-docx
    try:
        import docx
        send_log("   ✓ python-docx disponible")
    except ImportError:
        send_log("   ✗ python-docx no instalado")
    
    # reportlab
    try:
        import reportlab
        send_log("   ✓ reportlab disponible")
    except ImportError:
        send_log("   ✗ reportlab no instalado")
    
    # Resumen final
    send_log("\n" + "=" * 60)
    if results["com_working"]:
        send_log("✅ WORD COM FUNCIONA CORRECTAMENTE")
        send_log("   El error puede ser temporal o específico del archivo.")
    else:
        send_log("❌ WORD COM NO FUNCIONA")
        send_log(f"   Error: {results['com_error']}")
        send_log("\n   RECOMENDACIONES:")
        for i, rec in enumerate(results["recommendations"], 1):
            send_log(f"   {i}. {rec}")
    send_log("=" * 60)
    
    return results


if __name__ == "__main__":
    results = diagnose()
    print(json.dumps(results, indent=2))

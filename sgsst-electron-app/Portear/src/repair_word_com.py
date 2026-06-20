# repair_word_com.py - Repara el registro COM de Microsoft Word
# Intenta múltiples métodos para restaurar Word.Application

import sys
import json
import os
import subprocess
import time
from pathlib import Path


def send_log(message):
    """Función auxiliar para enviar logs a stderr"""
    print(f"[REPAIR] {message}", file=sys.stderr)


def find_word_exe():
    """Busca WINWORD.EXE en rutas comunes."""
    word_paths = [
        r"C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE",
        r"C:\Program Files (x86)\Microsoft Office\root\Office16\WINWORD.EXE",
        r"C:\Program Files\Microsoft Office\Office16\WINWORD.EXE",
        r"C:\Program Files (x86)\Microsoft Office\Office16\WINWORD.EXE",
        r"C:\Program Files\Microsoft Office\root\Office15\WINWORD.EXE",
        r"C:\Program Files (x86)\Microsoft Office\root\Office15\WINWORD.EXE",
        r"C:\Program Files\Microsoft Office\Office15\WINWORD.EXE",
        r"C:\Program Files (x86)\Microsoft Office\Office15\WINWORD.EXE",
    ]
    
    for p in word_paths:
        if Path(p).exists():
            return Path(p)
    
    return None


def repair_method_1_winword_r():
    """
    Método 1: Ejecutar WINWORD.EXE /r para re-registrar COM.
    Este es el método oficial de Microsoft para reparar registro COM.
    """
    send_log("MÉTODO 1: winword.exe /r (re-registrar COM)")
    
    word_exe = find_word_exe()
    if not word_exe:
        send_log("   ✗ WINWORD.EXE no encontrado")
        return False, "WINWORD.EXE no encontrado"
    
    send_log(f"   Word encontrado en: {word_exe}")
    send_log("   Ejecutando: winword.exe /r")
    
    try:
        # Ejecutar Word con /r (register)
        # /r fuerza a Word a re-registrar todas sus entradas COM
        process = subprocess.Popen(
            [str(word_exe), "/r"],
            creationflags=subprocess.CREATE_NO_WINDOW
        )
        
        # Esperar a que termine (puede tardar 10-30 segundos)
        send_log("   Esperando que termine el registro (máx 60s)...")
        try:
            process.wait(timeout=60)
        except subprocess.TimeoutExpired:
            send_log("   ⚠ Proceso tardó más de 60s, matando...")
            process.kill()
            return False, "Timeout en winword.exe /r"
        
        send_log(f"   Proceso terminó con código: {process.returncode}")
        
        # Verificar si funcionó
        time.sleep(2)  # Esperar que el registro se actualice
        
        try:
            import win32com.client
            word = win32com.client.Dispatch("Word.Application")
            word.Visible = False
            version = word.Version
            word.Quit()
            send_log(f"   ✓ ¡REPARACIÓN EXITOSA! Word {version} COM funciona")
            return True, f"Word {version} COM reparado"
        except Exception as e:
            send_log(f"   ✗ COM sigue fallando después de /r: {e}")
            return False, f"winword.exe /r no reparó COM: {e}"
            
    except Exception as e:
        send_log(f"   ✗ Error ejecutando winword.exe /r: {e}")
        return False, f"Error ejecutando winword.exe /r: {e}"


def repair_method_2_reregister_mso_dll():
    """
    Método 2: Re-registrar mso.dll (biblioteca principal de Office).
    Requiere privilegios de administrador.
    """
    send_log("MÉTODO 2: Re-registrar mso.dll")
    
    # Buscar mso.dll
    mso_paths = [
        r"C:\Program Files\Microsoft Office\root\VFS\ProgramFilesCommonX64\Microsoft Shared\OFFICE16\mso.dll",
        r"C:\Program Files (x86)\Microsoft Office\root\VFS\ProgramFilesCommonX86\Microsoft Shared\OFFICE16\mso.dll",
        r"C:\Program Files\Common Files\Microsoft Shared\OFFICE16\mso.dll",
        r"C:\Program Files (x86)\Common Files\Microsoft Shared\OFFICE16\mso.dll",
    ]
    
    mso_dll = None
    for p in mso_paths:
        if Path(p).exists():
            mso_dll = Path(p)
            break
    
    if not mso_dll:
        send_log("   ✗ mso.dll no encontrado")
        return False, "mso.dll no encontrado"
    
    send_log(f"   mso.dll encontrado: {mso_dll}")
    send_log("   ⚠ Este método requiere privilegios de administrador")
    
    try:
        # Intentar re-registrar con regsvr32
        # Nota: regsvr32 puede no funcionar con mso.dll directamente
        # pero vale la pena intentar
        result = subprocess.run(
            ["regsvr32", "/s", str(mso_dll)],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            send_log("   ✓ mso.dll re-registrado")
            
            # Verificar COM
            try:
                import win32com.client
                word = win32com.client.Dispatch("Word.Application")
                word.Quit()
                send_log("   ✓ COM funciona después de re-registrar mso.dll")
                return True, "mso.dll re-registrado exitosamente"
            except:
                pass
        
        return False, "regsvr32 falló o no reparó COM"
        
    except Exception as e:
        send_log(f"   ✗ Error re-registrando mso.dll: {e}")
        return False, f"Error: {e}"


def repair_method_3_office_repair():
    """
    Método 3: Sugerir reparación de Office desde Panel de Control.
    No podemos ejecutarlo automáticamente, pero podemos guiar al usuario.
    """
    send_log("MÉTODO 3: Reparación de Office (manual)")
    send_log("   Este método requiere intervención del usuario:")
    send_log("   1. Abrir Panel de Control → Programas y características")
    send_log("   2. Buscar Microsoft Office o Microsoft 365")
    send_log("   3. Click derecho → Cambiar")
    send_log("   4. Seleccionar 'Reparación Rápida' o 'Reparación en Línea'")
    send_log("   5. Esperar a que termine y reiniciar el PC")
    
    # Abrir automáticamente appwiz.cpl para facilitar
    try:
        send_log("   Abriendo Panel de Control de programas...")
        subprocess.Popen(["control", "appwiz.cpl"])
        send_log("   ✓ Panel de Control abierto. Sigue las instrucciones arriba.")
    except Exception as e:
        send_log(f"   ✗ No se pudo abrir Panel de Control: {e}")
    
    return False, "Reparación manual requerida"


def run_all_repairs():
    """Ejecuta todos los métodos de reparación en orden."""
    send_log("=" * 60)
    send_log("INICIANDO REPARACIÓN DE WORD COM")
    send_log("=" * 60)
    
    results = {
        "method_1_winword_r": {"success": False, "message": None},
        "method_2_reregister_mso": {"success": False, "message": None},
        "method_3_office_repair": {"success": False, "message": None},
        "final_com_working": False,
        "recommendations": []
    }
    
    # Método 1: winword.exe /r
    success, message = repair_method_1_winword_r()
    results["method_1_winword_r"]["success"] = success
    results["method_1_winword_r"]["message"] = message
    
    if success:
        send_log("\n✅ MÉTODO 1 EXITOSO - No se necesitan más métodos")
        results["final_com_working"] = True
        return results
    
    # Método 2: re-registrar mso.dll
    send_log("\n" + "-" * 60)
    success, message = repair_method_2_reregister_mso_dll()
    results["method_2_reregister_mso"]["success"] = success
    results["method_2_reregister_mso"]["message"] = message
    
    if success:
        send_log("\n✅ MÉTODO 2 EXITOSO - No se necesitan más métodos")
        results["final_com_working"] = True
        return results
    
    # Método 3: sugerir reparación manual
    send_log("\n" + "-" * 60)
    repair_method_3_office_repair()
    results["method_3_office_repair"]["success"] = False
    results["method_3_office_repair"]["message"] = "Reparación manual requerida"
    
    # Verificación final
    send_log("\n" + "=" * 60)
    send_log("VERIFICACIÓN FINAL")
    send_log("=" * 60)
    
    try:
        import win32com.client
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        version = word.Version
        word.Quit()
        results["final_com_working"] = True
        send_log(f"✅ WORD COM FUNCIONA después de reparación (Word {version})")
    except Exception as e:
        results["final_com_working"] = False
        send_log(f"❌ WORD COM SIGUE FALLANDO: {e}")
        results["recommendations"].append(
            "Si la reparación automática falló, intenta:\n"
            "1. Ejecutar este script como Administrador\n"
            "2. Reparación en Línea de Office (Panel de Control)\n"
            "3. Reinstalar Microsoft Office completamente\n"
            "4. Verificar que Python y Office tengan la misma arquitectura (32/64-bit)"
        )
    
    return results


if __name__ == "__main__":
    results = run_all_repairs()
    print(json.dumps(results, indent=2))

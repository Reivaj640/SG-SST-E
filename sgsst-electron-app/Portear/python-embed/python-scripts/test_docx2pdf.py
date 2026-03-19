import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    import docx2pdf
    print("SUCCESS: docx2pdf importado correctamente")
    print(f"Versión: {getattr(docx2pdf, '__version__', 'desconocida')}")
    print(f"Módulo ubicado en: {docx2pdf.__file__ if hasattr(docx2pdf, '__file__') else 'ubicación desconocida'}")
except ImportError as e:
    print(f"ERROR: No se pudo importar docx2pdf - {e}")
    print("Ruta de Python:", sys.path)
    
    # Intentar listar los paquetes instalados
    try:
        import subprocess
        result = subprocess.run([sys.executable, "-m", "pip", "list"], capture_output=True, text=True)
        print("\nPaquetes instalados:")
        print(result.stdout)
    except Exception as ex:
        print(f"Error al listar paquetes: {ex}")
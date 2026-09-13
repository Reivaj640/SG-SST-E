import json
import os
from pathlib import Path
import sys

# Añadir el directorio al path para poder importar remision_utils
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'Portear', 'src'))

try:
    import remision_utils
    print("Módulo remision_utils importado correctamente")
    
    # Verificar que las funciones principales existen
    if hasattr(remision_utils, 'generate_remision_document'):
        print("Función generate_remision_document disponible")
    else:
        print("Función generate_remision_document NO disponible")
        
    if hasattr(remision_utils, 'send_remision_by_email'):
        print("Función send_remision_by_email disponible")
    else:
        print("Función send_remision_by_email NO disponible")
        
    if hasattr(remision_utils, 'send_remision_by_whatsapp'):
        print("Función send_remision_by_whatsapp disponible")
    else:
        print("Función send_remision_by_whatsapp NO disponible")
        
    print("Prueba completada con éxito")
    
except ImportError as e:
    print(f"Error al importar remision_utils: {e}")
except Exception as e:
    print(f"Error durante la prueba: {e}")
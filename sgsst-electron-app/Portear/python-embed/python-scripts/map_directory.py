# map_directory.py - Script para mapear la estructura de un directorio y devolverla como JSON
import os
import sys
import json
from pathlib import Path
import unicodedata
import hashlib

def _calculate_checksum(file_path):
    """Calcula el checksum SHA-256 de un archivo."""
    sha256_hash = hashlib.sha256()
    try:
        with open(file_path, "rb") as f:
            # Leer y actualizar el hash en bloques de 4K para no consumir mucha memoria
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    except IOError:
        # Puede fallar si el archivo es eliminado mientras se lee o por permisos
        return None

def map_directory(root_path):
    """Mapea la estructura de un directorio y devuelve un diccionario con la información."""
    root_path = Path(root_path)
    
    if not root_path.exists():
        raise FileNotFoundError(f"El directorio {root_path} no existe.")
    
    structure = {
        'root': str(root_path),
        'scan_date': None, # Placeholder, se reemplazará con la fecha real
        'total_files': 0,
        'total_folders': 0,
        'errors': [],
        'structure': _map_directory_recursive(root_path)
    }
    
    # Contar archivos y carpetas
    structure['total_files'] = _count_files(structure['structure'])
    structure['total_folders'] = _count_folders(structure['structure'])
    
    return structure

def _clean_string_for_json(s):
    """Limpia una cadena para asegurarse de que sea segura para JSON."""
    if s is None:
        return None
    # Normalizar Unicode
    s = unicodedata.normalize('NFKD', s)
    return s

def _map_directory_recursive(directory_path):
    """Función recursiva para mapear un directorio."""
    try:
        dir_stat = directory_path.stat()
        directory_info = {
            'name': _clean_string_for_json(directory_path.name),
            'path': _clean_string_for_json(str(directory_path)),
            'created': getattr(dir_stat, 'st_birthtime', dir_stat.st_ctime),
            'modified': dir_stat.st_mtime,
            'files': [],
            'subdirectories': {},
            'file_count': 0,
            'dir_count': 0,
            'errors': [] # Initialize errors list for the node
        }
    except Exception as e:
        # If we can't even stat the directory, return a minimal error node
        return {
            'name': _clean_string_for_json(directory_path.name),
            'path': _clean_string_for_json(str(directory_path)),
            'created': None,
            'modified': None,
            'files': [],
            'subdirectories': {},
            'file_count': 0,
            'dir_count': 0,
            'errors': [f"Error getting stats for directory {directory_path}: {str(e)}"]
        }

    try:
        items = list(directory_path.iterdir())
    except PermissionError as e:
        directory_info['errors'].append(f"Permiso denegado: {directory_path}")
        return directory_info
    except Exception as e:
        directory_info['errors'].append(f"Error accediendo a {directory_path}: {str(e)}")
        return directory_info
    
    for item in items:
        try:
            if item.is_file():
                file_stat = item.stat()
                file_info = {
                    'name': _clean_string_for_json(item.name),
                    'path': _clean_string_for_json(str(item)),
                    'size': file_stat.st_size,
                    'created': getattr(file_stat, 'st_birthtime', file_stat.st_ctime),
                    'modified': file_stat.st_mtime,
                    'extension': _clean_string_for_json(item.suffix),
                    'checksum': _calculate_checksum(item)
                }
                directory_info['files'].append(file_info)
            
            elif item.is_dir():
                subdir_info = _map_directory_recursive(item)
                # Usar una versión limpia del nombre para la clave del diccionario
                clean_name = _clean_string_for_json(item.name)
                directory_info['subdirectories'][clean_name] = subdir_info
                
        except Exception as e:
            error_message = f"Error procesando {item}: {str(e)}"
            print(error_message, file=sys.stderr) # Imprimir error a stderr
            directory_info['errors'].append(error_message)
            continue
    
    directory_info['file_count'] = len(directory_info['files'])
    directory_info['dir_count'] = len(directory_info['subdirectories'])
    
    return directory_info

def _count_files(directory_node):
    """Cuenta recursivamente el número de archivos en un nodo de directorio."""
    count = len(directory_node.get('files', []))
    for subdir in directory_node.get('subdirectories', {}).values():
        count += _count_files(subdir)
    return count

def _count_folders(directory_node):
    """Cuenta recursivamente el número de carpetas en un nodo de directorio."""
    count = len(directory_node.get('subdirectories', {}))
    for subdir in directory_node.get('subdirectories', {}).values():
        count += _count_folders(subdir)
    return count

if __name__ == "__main__":
    # Configurar la codificación de salida para evitar problemas con caracteres Unicode
    if sys.stdout.encoding != 'utf-8':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    
    if len(sys.argv) != 2:
        print("Uso: python map_directory.py <ruta_del_directorio>", file=sys.stderr)
        sys.exit(1)
    
    directory_path = sys.argv[1]
    
    try:
        structure = map_directory(directory_path)
        # Imprimir el resultado como JSON con ensure_ascii=False para mantener caracteres Unicode
        print(json.dumps(structure, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
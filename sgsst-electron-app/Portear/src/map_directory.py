# map_directory.py - Script para mapear la estructura de un directorio y devolverla como JSON
import os
import sys
import json
from pathlib import Path
import unicodedata
import time
from datetime import datetime

# 📦865 (Fase 2) — se quitaron el `import hashlib` y _calculate_checksum(...): el
# SHA-256 de cada archivo (1,73 GB leídos byte a byte) era ~99,6 % del tiempo total
# del escaneo, y el campo `checksum` que producía no lo lee ningún consumidor
# (grep: 0 lecturas fuera de este script). La carpeta se recorre, se anota y ya.
#
# 📦866 (Fase 3) — se quitaron `files[]`, `file_count`, `dir_count`, `errors` y el
# indentado del JSON: mismos 0 consumidores (grep) y hacían que la salida pesara
# ~2,98 MB en cientos de líneas. Ahora sale una sola línea compacta. Los problemas
# ya no viajan dentro del JSON: se imprimen a stderr con print(..., file=sys.stderr).
# Los totales `total_files`/`total_folders` SÍ se conservan (los leen renderer.js y
# main.js) y ahora salen de `_contador`, porque el árbol ya no guarda los archivos
# adentro para poder contarlos después.

# Contadores del escaneo en curso (se reinician en cada llamada). Están a nivel de
# módulo porque la llamada a `_map_directory_recursive(root_path)` tiene que seguir
# siendo exactamente esa (contrato del test de la Fase 0).
_contador = {'archivos': 0, 'carpetas': 0}

# 📦867 (Fase 4) — progreso REAL hacia la UI, que hasta ahora mostraba un estimado
# fijo de "10-60 segundos" (copia literal, nunca calculado) mientras el proceso llevaba
# 760 s. Va por stderr a propósito: stdout tiene que quedar con UNA sola línea de JSON
# (contrato de 📦866) y es lo único que lee main.js para armar la estructura.
# Se amortigua a ~250 ms: el recorrido puede pasar por cientos de miles de entradas y
# una línea por cada una saturaría el pipe sin aportarle nada a quien lee.
_ultimo_progreso = [0.0]

def _avisar_progreso(forzar=False):
    """Escribe una línea [PROGRESO] a stderr, como mucho una vez cada 250 ms.

    Se usa %-formatting y no f-string porque el repo declara soporte de Python 3.10-3.12
    y las comillas del mismo tipo anidadas dentro de un f-string solo son válidas desde 3.12.
    """
    ahora = time.monotonic()
    if not forzar and (ahora - _ultimo_progreso[0]) < 0.25:
        return
    _ultimo_progreso[0] = ahora
    print('[PROGRESO] archivos=%d carpetas=%d' % (_contador['archivos'], _contador['carpetas']),
          file=sys.stderr, flush=True)

def map_directory(root_path):
    """Mapea la estructura de un directorio y devuelve un diccionario con la información."""
    root_path = Path(root_path)
    
    if not root_path.exists():
        raise FileNotFoundError(f"El directorio {root_path} no existe.")
    
    _contador['archivos'] = 0
    _contador['carpetas'] = 0
    # Primera línea de progreso al instante: sin esto la UI no muestra nada hasta que el
    # recorrido ya viene empezado.
    _avisar_progreso(forzar=True)
    structure = {
        'root': str(root_path),
        'scan_date': datetime.now().isoformat(), # 📦865: fecha y hora reales del escaneo (antes quedaba en null)
        'total_files': 0,
        'total_folders': 0,
        'structure': _map_directory_recursive(root_path)
    }
    
    # Los totales salen de los contadores del recorrido (nadie relee el JSON armado)
    structure['total_files'] = _contador['archivos']
    structure['total_folders'] = _contador['carpetas']
    
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
            'subdirectories': {}
        }
    except Exception as e:
        # If we can't even stat the directory, return a minimal error node
        print(f"Error getting stats for directory {directory_path}: {str(e)}", file=sys.stderr)
        return {
            'name': _clean_string_for_json(directory_path.name),
            'path': _clean_string_for_json(str(directory_path)),
            'created': None,
            'modified': None,
            'subdirectories': {}
        }

    # 📦865 (Fase 2) — un solo pase con os.scandir: en Windows el tipo y los tiempos de
    # cada entrada vienen en el propio listado, así que no hay que volver a preguntar
    # por cada archivo (antes eran ~3 consultas por entrada, más 1 por subcarpeta).
    try:
        with os.scandir(directory_path) as scandir_it:
            entries = list(scandir_it)
    except PermissionError:
        print(f"Permiso denegado: {directory_path}", file=sys.stderr)
        return directory_info
    except Exception as e:
        print(f"Error accediendo a {directory_path}: {str(e)}", file=sys.stderr)
        return directory_info
    
    for entry in entries:
        try:
            _avisar_progreso()
            if entry.is_symlink():
                # Atajo (symlink) — misma semántica que os.walk(followlinks=False):
                # una carpeta de atajo se lista VACÍA sin bajar a ella (corta bucles
                # infinitos) y un atajo a archivo se lista como archivo normal.
                if entry.is_dir():
                    clean_name = _clean_string_for_json(entry.name)
                    directory_info['subdirectories'][clean_name] = _directorio_vacio(entry)
                    _contador['carpetas'] += 1
                    continue
                if not entry.is_file():
                    continue  # atajo roto: se ignora, como antes
            elif entry.is_dir():
                subdir_info = _map_directory_recursive(Path(entry.path))
                # Usar una versión limpia del nombre para la clave del diccionario
                clean_name = _clean_string_for_json(entry.name)
                directory_info['subdirectories'][clean_name] = subdir_info
                _contador['carpetas'] += 1
                continue
            elif not entry.is_file():
                continue  # tipos especiales (tuberías, sockets): se ignoran, como antes

            # Archivo (real o atajo a archivo): solo se CUENTA. 📦866 (Fase 3) quitó
            # la ficha con tamaño, fechas y extensión que se guardaba en `files[]` —
            # ese detalle no lo lee nadie y era lo que hacía pesar megas al JSON
            # (el SHA-256 de esa misma ficha ya se había ido en 📦865).
            _contador['archivos'] += 1

        except Exception as e:
            print(f"Error procesando {entry.path}: {str(e)}", file=sys.stderr)
            continue
    
    return directory_info

def _directorio_vacio(entry):
    """Nodo de carpeta para un atajo (symlink): se lista pero NO se recorre."""
    info = {
        'name': _clean_string_for_json(entry.name),
        'path': _clean_string_for_json(entry.path),
        'created': None,
        'modified': None,
        'subdirectories': {}
    }
    try:
        dir_stat = entry.stat()  # sigue el atajo: tiempos de la carpeta real
        info['created'] = getattr(dir_stat, 'st_birthtime', dir_stat.st_ctime)
        info['modified'] = dir_stat.st_mtime
    except OSError:
        pass  # atajo ilegible: se queda sin tiempos, no tumba el mapeo
    return info

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
        # Cierre del contador con el total real: la última muestra amortiguada puede ir
        # hasta 250 ms atrasada, y sin esta línea la UI cerraría con un número viejo.
        _avisar_progreso(forzar=True)
        # Imprimir el resultado como JSON con ensure_ascii=False para mantener caracteres Unicode
        # 📦866: sin indent= — el JSON sale en UNA sola línea (con indent=2 eran cientos)
        print(json.dumps(structure, ensure_ascii=False))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
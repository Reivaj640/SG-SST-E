import os
import json
import hashlib
from datetime import datetime
from pathlib import Path
import mimetypes

class DocumentMapper:
    def __init__(self, root_path, update_callback=None):
        self.root_path = Path(root_path)
        self.update_callback = update_callback
        self.structure = {
            'root': str(self.root_path),
            'scan_date': datetime.now().isoformat(),
            'total_files': 0,
            'total_folders': 0,
            'errors': [],
            'structure': {}
        }
        # No mostrar mensaje de inicio en la terminal
        # self._log(f"Iniciando mapeo de: {self.root_path}")

    def _log(self, message):
        if self.update_callback:
            self.update_callback(message)
        # En la aplicación principal, no mostramos mensajes en la terminal
        # Solo se muestran si hay un callback de actualización

    def get_file_info(self, file_path):
        try:
            stat = file_path.stat()
            mime_type, _ = mimetypes.guess_type(str(file_path))
            
            return {
                'name': file_path.name,
                'path': str(file_path),
                'size': stat.st_size,
                'created': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'extension': file_path.suffix,
                'mime_type': mime_type,
                'checksum': self.calculate_checksum(file_path)
            }
        except Exception as e:
            error_msg = f"Error procesando archivo {file_path}: {str(e)}"
            self.structure['errors'].append(error_msg)
            self._log(f"  ⚠️  {error_msg}")
            return None
    
    def calculate_checksum(self, file_path):
        try:
            hash_md5 = hashlib.md5()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except Exception:
            return None
    
    def map_directory(self, directory_path, max_depth=10, current_depth=0):
        if current_depth > max_depth:
            return {}
        
        self._log(f"Mapeando: {directory_path}")
        
        if not directory_path.exists():
            error_msg = f"Directorio no encontrado: {directory_path}"
            self.structure['errors'].append(error_msg)
            self._log(f"  ❌ {error_msg}")
            return None
            
        dir_info = {
            'name': directory_path.name,
            'path': str(directory_path),
            'created': datetime.fromtimestamp(directory_path.stat().st_ctime).isoformat(),
            'files': [],
            'subdirectories': {},
            'file_count': 0,
            'dir_count': 0
        }
        
        try:
            items = list(directory_path.iterdir())
        except PermissionError:
            error_msg = f"Permiso denegado: {directory_path}"
            self.structure['errors'].append(error_msg)
            self._log(f"  ⚠️  {error_msg}")
            return dir_info
        except Exception as e:
            error_msg = f"Error accediendo a {directory_path}: {str(e)}"
            self.structure['errors'].append(error_msg)
            self._log(f"  ⚠️  {error_msg}")
            return dir_info
        
        for item in items:
            try:
                if item.is_file():
                    file_info = self.get_file_info(item)
                    if file_info:
                        dir_info['files'].append(file_info)
                        self.structure['total_files'] += 1
                        self._log(f"  📄 Archivo: {item.name}")
                
                elif item.is_dir():
                    subdir_info = self.map_directory(item, max_depth, current_depth + 1)
                    if subdir_info is not None:
                        dir_info['subdirectories'][item.name] = subdir_info
                        self.structure['total_folders'] += 1
                        self._log(f"  📁 Carpeta: {item.name}")
                        
            except Exception as e:
                error_msg = f"Error procesando {item}: {str(e)}"
                self.structure['errors'].append(error_msg)
                self._log(f"  ⚠️  {error_msg}")
                continue
        
        dir_info['file_count'] = len(dir_info['files'])
        dir_info['dir_count'] = len(dir_info['subdirectories'])
        return dir_info
    
    def generate_structure(self):
        self.structure['structure'] = self.map_directory(self.root_path)
        return self.structure
    
    def save_structure(self, output_path, format='json'):
        try:
            structure = self.generate_structure()
            
            # Asegurarse de que el directorio existe
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            if format.lower() == 'json':
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(structure, f, indent=2, ensure_ascii=False)
                print(f"✅ Estructura guardada en: {Path(output_path).absolute()}")
            elif format.lower() == 'txt':
                self.save_as_txt(structure, output_path)
            
            return structure
        except Exception as e:
            print(f"❌ Error guardando estructura: {str(e)}")
            # Guardar al menos lo que se pudo mapear
            try:
                backup_path = f"document_structure_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                with open(backup_path, 'w', encoding='utf-8') as f:
                    json.dump(self.structure, f, indent=2, ensure_ascii=False)
                print(f"💾 Backup guardado como: {backup_path}")
            except:
                print("❌ No se pudo guardar ningún backup")
            raise e

# Ejecución con manejo de errores
if __name__ == "__main__":
    print("🚀 Iniciando mapeo del sistema de documentos SST...")
    print("=" * 60)
    
    try:
        # Ruta de origen (tus documentos SST)
        mapper = DocumentMapper('G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa')
        
        # Ruta de destino específica (donde quieres que se guarde el JSON)
        destino_json = 'D:/1. Estudio/1.1 IA/1.1.4. Proyectos/Investigación de AT/docs/document_structure.json'
        
        structure = mapper.save_structure(destino_json, 'json')
        
        print("=" * 60)
        print(f"📊 Total de archivos mapeados: {structure['total_files']}")
        print(f"📁 Total de carpetas mapeadas: {structure['total_folders']}")
        if structure['errors']:
            print(f"⚠️  Errores encontrados: {len(structure['errors'])}")
            for error in structure['errors'][:5]:  # Mostrar solo los primeros 5
                print(f"   - {error}")
            if len(structure['errors']) > 5:
                print(f"   ... y {len(structure['errors']) - 5} errores más")
        print("🎉 ¡Mapeo completado!")
        print(f"📁 Archivo JSON guardado en: {destino_json}")
        
    except Exception as e:
        print(f"💥 Error crítico: {str(e)}")
        print("El script encontró un error que detuvo la ejecución.")
# SG-SST Desktop App

## Reducción de tamaño del proyecto

El proyecto estaba ocupando más de 10GB debido a archivos innecesarios. Para mantener un tamaño manejable, sigue estas instrucciones:

### Archivos y carpetas ignoradas en Git

El archivo `.gitignore` incluye patrones para ignorar:
- `node_modules/`: Dependencias de Node.js
- `Portear/.venv/`: Entorno virtual de Python
- Archivos temporales, logs, y cachés

### Scripts de mantenimiento

1. **limpiar-proyecto.bat**: Elimina archivos innecesarios
   - node_modules
   - Entornos virtuales de Python
   - Archivos temporales y cachés

2. **verificar-tamanos.bat**: Muestra el tamaño de las carpetas principales

### Recomendaciones

1. **No incluir node_modules en el repositorio**:
   - Elimina `node_modules` del repositorio si ya está incluido
   - Ejecuta `npm install` después de clonar para reinstalar dependencias

2. **No incluir entornos virtuales**:
   - El entorno virtual `.venv` no debe estar en el repositorio
   - Crea un nuevo entorno virtual con `python -m venv .venv`

3. **Lista de dependencias de Python**:
   - Usa `pip freeze > requirements.txt` para mantener actualizada la lista

4. **Construcción de releases**:
   - Usa `npm run build` para crear versiones distribuibles
   - Estas versiones son las que se deben compartir, no el código fuente completo

### Dependencias actuales

**Node.js (package.json)**:
- electron: ^37.3.0
- xlsx: ^0.18.5

**Python (Portear/requirements.txt)**:
- Contiene muchas dependencias, posiblemente más de las necesarias
- Revisar si todas son realmente utilizadas por la aplicación

### Problemas identificados

1. **Carpeta Portear/.venv**: Ocupa ~12GB
   - Esta carpeta contiene el entorno virtual de Python
   - No debe incluirse en el repositorio

2. **node_modules**: Ocupa ~600MB
   - Se puede regenerar con `npm install`
   - No debe incluirse en el repositorio

### Solución aplicada

Se han creado archivos de configuración y scripts para:
1. Ignorar archivos innecesarios en Git
2. Limpiar el proyecto de archivos temporales
3. Verificar tamaños de carpetas

Ejecuta `limpiar-proyecto.bat` para reducir significativamente el tamaño del proyecto.
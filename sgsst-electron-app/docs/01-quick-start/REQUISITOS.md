# 📋 Requisitos de Instalación - K+AIR SG-SST

**Versión del documento:** 2.0  
**Fecha:** 18 de marzo de 2026  
**Aplicación:** K+AIR - Sistema de Gestión SG-SST v0.1.78+

---

## ✅ BUENAS NOTICIAS: ¡PYTHON YA ESTÁ INCLUIDO!

### A partir de la versión 0.1.79

**El installer de K+AIR ahora incluye Python 3.11 empaquetado.**

Esto significa que:
- ✅ **NO necesitas instalar Python manualmente**
- ✅ **Todas las funciones estarán disponibles inmediatamente**
- ✅ **La instalación es más rápida y sencilla**

---

## 📦 INSTALACIÓN TÍPICA (RECOMENDADA)

### Paso 1: Descargar el Installer

Descarga `K+AIR-Setup-0.1.xx.exe` desde el repositorio oficial.

### Paso 2: Ejecutar el Installer

1. Haz doble clic en el installer
2. La instalación se realiza automáticamente
3. Tamaño del installer: ~200-300 MB (incluye Python)
4. Espacio en disco requerido: ~400-500 MB

### Paso 3: Ejecutar K+AIR

1. Abre K+AIR desde el menú Inicio
2. Inicia sesión con:
   - **Correo:** `admin@kair.local`
   - **Contraseña:** `Admin123!`

### ¡Listo!

No necesitas instalar nada más. Python está incluido y configurado automáticamente.

---

## 🔧 INSTALACIÓN MANUAL DE PYTHON (OPCIONAL)

Solo necesitas instalar Python manualmente si:

- ⚠️ Quieres usar tu propia instalación de Python
- ⚠️ Hay errores con Python empaquetado (casos excepcionales)
- ⚠️ Eres desarrollador y quieres modificar scripts

### ¿Cómo instalar Python manualmente?

---

## 📘 2. MICROSOFT WORD (OPCIONAL PERO RECOMENDADO)

### ¿Para qué necesito Word?

K+AIR usa Microsoft Word para:
- 📄 Convertir documentos `.docx` a `.pdf` para visualización
- 📋 Generar informes en formato Word

### ¿Qué pasa si no tengo Word?

- La conversión de Word a PDF **no funcionará**
- Podrá seguir usando todas las demás funciones
- Los documentos Word se descargarán pero no se previsualizarán

### Versiones compatibles

| Versión | Compatible |
|---------|------------|
| Office 2016 | ✅ Sí |
| Office 2019 | ✅ Sí |
| Office 2021 | ✅ Sí |
| Microsoft 365 | ✅ Sí |
| LibreOffice | ❌ No (no es compatible con automatización COM) |

---

## 📦 3. K+AIR - LA APLICACIÓN PRINCIPAL

### Instalación de K+AIR

1. Descargue el instalador desde el repositorio oficial
2. Ejecute `K+AIR-Setup-0.1.xx.exe`
3. El instalador se ejecutará automáticamente
4. Espere a que termine la instalación
5. K+AIR se abrirá automáticamente

### Primer uso

1. Ingrese con el usuario administrador por defecto:
   - **Correo:** `admin@kair.local`
   - **Contraseña:** `Admin123!`
2. **Cambie la contraseña inmediatamente** después del primer inicio de sesión

---

## 🔍 VERIFICAR QUE TODO ESTÁ INSTALADO

### Desde K+AIR

1. Abra K+AIR
2. Vaya a **Configuración** (engranaje en la esquina inferior izquierda)
3. Busque la sección **"Estado del Sistema"** o **"Verificar Dependencias"**
4. El sistema le indicará si falta algo

### Manualmente

Abra una terminal (CMD) y ejecute:

```cmd
# Verificar Python
python --version

# Debe mostrar: Python 3.x.x
```

---

## ❓ PREGUNTAS FRECUENTES

### "Me aparece un error diciendo 'Python no está instalado'"

**Solución:**
1. Verifique que Python esté instalado ejecutando `python --version` en CMD
2. Si no está instalado, siga las instrucciones de instalación arriba
3. Si está instalado pero aparece el error, Python no está en el PATH:
   - Desinstale Python
   - Vuelva a instalar marcando **"Add Python to PATH"**
   - Reinicie K+AIR

### "¿Puedo usar K+AIR sin Python?"

**Respuesta:** Parcialmente. Podrá:
- ✅ Iniciar sesión
- ✅ Ver empresas configuradas
- ✅ Navegar por la interfaz

**NO podrá:**
- ❌ Vincular nuevas empresas
- ❌ Mapear estructuras de archivos
- ❌ Generar reportes
- ❌ Gestionar incapacidades
- ❌ Convertir documentos

### "¿Python es gratuito?"

**Sí**, Python es completamente gratuito y de código abierto. Puede descargarlo sin costo desde python.org.

### "¿Necesito pagar Microsoft Office?"

Depende de su situación:
- Si ya tiene Office instalado: ✅ No necesita pagar nada adicional
- Si no tiene Office: ⚠️ Necesitará una licencia de Microsoft 365 o Office perpetuo
- Alternativa: Puede usar K+AIR sin Word, pero no podrá previsualizar documentos DOCX

### "¿Cuánto espacio ocupa todo?"

| Componente | Espacio requerido |
|------------|-------------------|
| Python | ~100 MB |
| K+AIR | ~300 MB |
| Office (si no lo tiene) | ~3-4 GB |

---

## 🆘 SOPORTE TÉCNICO

Si después de seguir estas instrucciones aún tiene problemas:

1. **Verifique los logs de K+AIR:**
   - Presione `F12` dentro de K+AIR para abrir la consola
   - Busque mensajes de error relacionados con Python

2. **Reinicie la aplicación:**
   - Cierre completamente K+AIR
   - Vuelva a abrirlo

3. **Reinstale Python:**
   - Desinstale Python desde el Panel de Control
   - Descargue la última versión desde python.org
   - Instale marcando "Add Python to PATH"

---

## 📝 CHECKLIST DE INSTALACIÓN

Marque cada elemento una vez completado:

- [ ] Python 3.11 o 3.12 descargado
- [ ] Python instalado con "Add Python to PATH" marcado
- [ ] Verificado `python --version` en CMD
- [ ] K+AIR Installer descargado
- [ ] K+AIR instalado
- [ ] Primer inicio de sesión completado
- [ ] Contraseña de administrador cambiada
- [ ] Microsoft Word verificado (opcional)

---

**Documento elaborado por:** Equipo de Desarrollo K+AIR  
**Contacto:** soporte@kair.local  
**Última actualización:** 18 de marzo de 2026

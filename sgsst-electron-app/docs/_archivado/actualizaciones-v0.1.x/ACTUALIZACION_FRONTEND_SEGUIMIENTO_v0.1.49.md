# 📝 Actualización Frontend Seguimiento de Incapacidades - v0.1.49

**Fecha:** 26 de febrero de 2026  
**Estado:** ✅ COMPLETADO

---

## 🎯 Objetivo

Actualizar el frontend para que:
1. **Cargue datos desde PRI.xlsx** cuando se abre el seguimiento de un caso individual
2. **Guarde los datos en PRI.xlsx** cuando se registra un seguimiento

---

## 🔧 Cambios Realizados

### **1. `viewCase()` - Ahora carga datos desde PRI.xlsx**

**Antes:**
```javascript
function viewCase(caseId) {
    currentCaseId = caseId;
    const caseItem = allCasesData.find(c => c.id === caseId);
    
    // Solo cargaba datos básicos
    document.getElementById('employeeId').value = caseItem.employeeId;
    document.getElementById('employeeName').value = caseItem.employeeName;
    document.getElementById('diagnosis').value = caseItem.diagnosis;
}
```

**Ahora:**
```javascript
async function viewCase(caseId) {
    currentCaseId = caseId;
    const caseItem = allCasesData.find(c => c.id === caseId);
    
    // Resetear formulario
    document.getElementById('followUpForm').reset();
    
    // Cargar datos básicos desde PI-FO-076
    document.getElementById('employeeId').value = caseItem.employeeId;
    document.getElementById('employeeName').value = caseItem.employeeName;
    document.getElementById('diagnosis').value = caseItem.diagnosis;
    
    // === CARGAR DATOS ADICIONALES DESDE PRI.xlsx ===
    await loadPriDataForCase(caseItem);
    
    // Mostrar historial y abrir modal
    showFollowUpHistory(caseId);
    document.getElementById('followUpModal').classList.add('active');
}
```

**Nueva Función `loadPriDataForCase()`:**
```javascript
async function loadPriDataForCase(caseItem) {
    try {
        // Llamar a la API de Electron
        const priResult = await window.electronAPI.getPriSeguimientoData(currentCompany);
        
        if (!priResult.success) return;
        
        // Buscar el caso específico en el PRI por cédula o nombre
        const priCase = priResult.rows.find(row => {
            const rowId = (row[0] || '').toString().replace(/,/g, '');
            const rowName = (row[1] || '').toString().toUpperCase();
            const searchId = caseItem.employeeId.toString().replace(/,/g, '');
            const searchName = caseItem.employeeName.toUpperCase();
            
            return rowId.includes(searchId) || rowName.includes(searchName);
        });
        
        if (priCase) {
            // Cargar datos específicos del PRI
            if (priCase[2]) document.getElementById('cargo').value = priCase[2];
            if (priCase[6]) document.getElementById('area').value = priCase[6];
            if (priCase[12]) document.getElementById('eps').value = priCase[12];
            if (priCase[13]) document.getElementById('arl').value = priCase[13];
        }
    } catch (error) {
        console.error('[SEGUIMIENTO][PRI] Error cargando datos:', error);
    }
}
```

---

### **2. `saveFollowUp()` - Ahora usa la API de Electron directamente**

**Antes:**
```javascript
async function saveFollowUp() {
    const followUpData = { ... };
    
    // Enviaba mensaje al contenedor principal (postMessage)
    sendMessageToParent({
        type: 'SAVE_FOLLOW_UP',
        payload: { followUpData, companyName: currentCompany }
    });
}
```

**Ahora:**
```javascript
async function saveFollowUp() {
    const followUpData = { ... };
    
    // === VERIFICAR API DE ELECTRON ===
    let apiToUse = window.electronAPI?.saveFollowUp || 
                   window.parent?.electronAPI?.saveFollowUp;
    
    if (!apiToUse) {
        showNotification('Error: Función de guardado no disponible', 'error');
        return;
    }
    
    // === MOSTRAR INDICADOR DE CARGA ===
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    
    // === LLAMAR A LA API ===
    const result = await apiToUse(followUpData, currentCompany);
    
    // === MANEJAR RESULTADO ===
    if (result && result.success) {
        closeFollowUpModal();
        await loadData();
        showNotification('Seguimiento guardado correctamente en PRI.xlsx', 'success');
    }
}
```

---

## 📊 Flujo de Datos Actualizado

### **Abrir Seguimiento de Caso Individual**
```
1. Usuario hace click en "Ver detalles" (icono ojo)
   ↓
2. viewCase(caseId)
   ↓
3. Carga datos básicos desde PI-FO-076 (allCasesData)
   ↓
4. loadPriDataForCase(caseItem)
   ↓
5. window.electronAPI.getPriSeguimientoData(currentCompany)
   ↓
6. main.js → get-pri-seguimiento-data
   ↓
7. Lee PRI.xlsx, hoja "Casos en seguimiento"
   ↓
8. Busca caso por cédula/nombre
   ↓
9. Si encuentra → Carga cargo, área, EPS, ARL desde PRI
   ↓
10. Muestra modal con todos los datos
```

### **Guardar Seguimiento**
```
1. Usuario llena formulario y click "Guardar Seguimiento"
   ↓
2. saveFollowUp()
   ↓
3. window.electronAPI.saveFollowUp(followUpData, currentCompany)
   ↓
4. main.js → save-follow-up
   ↓
5. Busca específicamente PRI.xlsx
   ↓
6. Llama Python: guardar_seguimiento
   ↓
7. Python escribe en PRI.xlsx, hoja "Seguimiento a recomendaciones"
   ↓
8. Devuelve resultado
   ↓
9. Cierra modal y recarga tabla
   ↓
10. Muestra notificación de éxito
```

---

## 🐛 Logs de Depuración

### **Cuando se abre un caso:**
```log
[SEGUIMIENTO][VIEW] === Abriendo caso: INC-ASE-001 ===
[SEGUIMIENTO][VIEW] Empleado: VLADIMIR ESCORCIA JARAMILLO
[SEGUIMIENTO][VIEW] Cédula: 3,729,847
[SEGUIMIENTO][PRI] Intentando cargar datos desde PRI.xlsx...
[SEGUIMIENTO][PRI] Llamando a getPriSeguimientoData...
[SEGUIMIENTO][PRI] ✅ 73 registros cargados desde PRI.xlsx
[SEGUIMIENTO][PRI] ✅ Caso encontrado en PRI.xlsx
[SEGUIMIENTO][PRI] Datos: [3729847, 'VLADIMIR ESCORCIA JARAMILLO', 'No Existe', ...]
```

### **Cuando se guarda un seguimiento:**
```log
[SEGUIMIENTO][GUARDAR] === Iniciando guardado ===
[SEGUIMIENTO][GUARDAR] Datos: {employeeId: '3,729,847', ...}
[SEGUIMIENTO][GUARDAR] Empresa: Aseplus
[SEGUIMIENTO][GUARDAR] Usando window.electronAPI.saveFollowUp
[SEGUIMIENTO][GUARDAR] Llamando a saveFollowUp API...
[PRI][GUARDAR] Handler save-follow-up llamado para empresa: Aseplus
[PRI][GUARDAR] ✅ Archivo PRI.xlsx encontrado: G:\...\PRI.xlsx
[PRI][GUARDAR] Llamando script Python: guardar_seguimiento
[Python Seguimiento] Guardando seguimiento en PRI.xlsx
[SEGUIMIENTO][GUARDAR] ✅ Seguimiento guardado exitosamente
```

---

## ⚠️ Consideraciones Importantes

### **1. Estructura del PRI.xlsx**

La función `loadPriDataForCase()` asume la siguiente estructura en la hoja "Casos en seguimiento":

| Índice | Columna | Dato |
|--------|---------|------|
| 0 | A | Identificación / Cédula |
| 1 | B | Nombre completo |
| 2 | C | Cargo |
| 6 | G | Área / Dependencia |
| 12 | M | EPS |
| 13 | N | ARL |

**Si la estructura real es diferente**, ajustar los índices en:
```javascript
if (priCase[2]) document.getElementById('cargo').value = priCase[2];
if (priCase[6]) document.getElementById('area').value = priCase[6];
if (priCase[12]) document.getElementById('eps').value = priCase[12];
if (priCase[13]) document.getElementById('arl').value = priCase[13];
```

### **2. Archivos de Seguimientos**

El sistema usa **DOS fuentes de datos** para el seguimiento:

1. **PRI.xlsx** → Datos específicos del caso (cargo, área, EPS, ARL)
2. **Seguimiento Casos Medicos.xlsx** → Historial de seguimientos (fechas, evoluciones, recomendaciones)

El historial que se muestra en el modal viene del archivo de seguimientos, NO del PRI.xlsx.

---

## 🧪 Pruebas

### **Prueba 1: Abrir caso existente**
1. Ir a **Seguimiento de Incapacidades**
2. Click en **"Ver detalles"** (icono ojo) de cualquier caso
3. Verificar en consola:
   ```
   [SEGUIMIENTO][PRI] ✅ Caso encontrado en PRI.xlsx
   ```
4. Verificar que el formulario muestra cargo, área, EPS, ARL

### **Prueba 2: Abrir caso nuevo (no existe en PRI)**
1. Ir a **Seguimiento de Incapacidades**
2. Click en **"Ver detalles"** de un caso reciente
3. Verificar en consola:
   ```
   [SEGUIMIENTO][PRI] ⚠️ Caso nuevo - No existe en PRI.xlsx
   ```
4. El formulario debe mostrar solo datos básicos (desde PI-FO-076)

### **Prueba 3: Guardar seguimiento**
1. Abrir un caso
2. Llenar formulario (evolución, recomendaciones, etc.)
3. Click en **"Guardar Seguimiento"**
4. Verificar en consola:
   ```
   [SEGUIMIENTO][GUARDAR] ✅ Seguimiento guardado exitosamente
   [PRI][GUARDAR] ✅ Archivo PRI.xlsx encontrado
   ```
5. La tabla debe recargarse con los datos actualizados

---

## 📝 Próximos Pasos (Opcionales)

- [ ] Agregar validación de campos obligatorios antes de guardar
- [ ] Mostrar confirmación antes de guardar cambios
- [ ] Agregar botón "Cancelar" que descarte cambios
- [ ] Implementar historial de cambios (quién modificó qué y cuándo)

---

## 📞 Contacto

**Autor:** Javier Robles F.  
**Cargo:** Prof. SG-SST - Esp. Gerencia de Proyectos

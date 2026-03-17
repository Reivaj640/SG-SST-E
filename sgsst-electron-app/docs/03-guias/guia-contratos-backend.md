# 🔌 Guía de Contratos Backend K+AIR

**Versión:** 1.0  
**Actualizado:** 17 de marzo de 2026  
**Estado:** ✅ Nueva guía de mejores prácticas

---

## 📋 Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Principios de Diseño](#2-principios-de-diseño)
3. [Estructura de Contratos](#3-estructura-de-contratos)
4. [Patrones de Implementación](#4-patrones-de-implementación)
5. [Manejo de Errores](#5-manejo-de-errores)
6. [Versionamiento](#6-versionamiento)
7. [Ejemplos Prácticos](#7-ejemplos-prácticos)
8. [Checklist de Implementación](#8-checklist-de-implementación)

---

## 1. Introducción

### 1.1 Propósito

Esta guía establece los patrones y mejores prácticas para implementar contratos backend (handlers IPC) en la aplicación K+AIR.

### 1.2 Alcance

Aplica para todos los handlers registrados con `ipcMain.handle()` en `main.js` y expuestos vía `preload.js`.

### 1.3 Responsabilidades

| Rol | Responsabilidad |
|-----|-----------------|
| **Backend Developer** | Implementar handlers siguiendo esta guía |
| **Frontend Developer** | Consumir contratos según documentación |
| **Architect** | Validar cumplimiento de patrones |
| **QA** | Verificar contratos en pruebas |

---

## 2. Principios de Diseño

### 2.1 Principios Fundamentales

| Principio | Descripción | Ejemplo |
|-----------|-------------|---------|
| **Inquebrantable** | No modificar contratos sin versionar | ❌ Cambiar `{ data }` → `{ success, data }` sin versión |
| **Explícito** | Nombres claros y descriptivos | ✅ `get-ausentismo-data` |
| **Consistente** | Mismo patrón de retorno | ✅ `{ success, data?, error? }` |
| **Validado** | Validar todos los inputs | ✅ `if (!companyName) throw new Error()` |
| **Documentado** | JSDoc en todos los handlers | ✅ `/** Handler para... */` |

### 2.2 Regla de Oro

> ❗ **SOLO puedes modificar lo que se te solicite explícitamente.**
>
> **PROHIBIDO:**
> - Cambiar comportamiento no pedido
> - Refactorizar "aprovechando"
> - Alterar otros módulos
> - Introducir patrones nuevos
> - Romper contratos frontend ↔ backend

---

## 3. Estructura de Contratos

### 3.1 Formato Estándar de Retorno

**Todos** los handlers deben retornar este formato:

```javascript
// Éxito
{
  success: true,
  data: { /* datos */ }
}

// Error
{
  success: false,
  error: {
    code: 'ERROR_CODE',
    message: 'Mensaje descriptivo'
  }
}
```

### 3.2 Excepciones

Algunos handlers pueden retornar formatos simplificados:

```javascript
// Handlers de solo lectura que retornan dato directo
await ipcRenderer.invoke('get-app-version');  // Retorna: string

// Handlers de acción que solo necesitan success
await ipcRenderer.invoke('restart_app');  // Retorna: void
```

### 3.3 Estructura de Error

```javascript
{
  success: false,
  error: {
    code: string,      // Código único en MAYÚSCULAS
    message: string    // Mensaje en español para usuario
  }
}
```

### 3.4 Códigos de Error Estándar

| Código | Uso | Ejemplo |
|--------|-----|---------|
| `FILE_NOT_FOUND` | Archivo no existe | `error.code = 'FILE_NOT_FOUND'` |
| `INVALID_FORMAT` | Formato inválido | `error.code = 'INVALID_FORMAT'` |
| `PERMISSION_DENIED` | Sin permisos | `error.code = 'PERMISSION_DENIED'` |
| `PYTHON_NOT_FOUND` | Python no instalado | `error.code = 'PYTHON_NOT_FOUND'` |
| `EXCEL_LOCKED` | Excel bloqueado | `error.code = 'EXCEL_LOCKED'` |
| `INVALID_DATA` | Datos inválidos | `error.code = 'INVALID_DATA'` |
| `NETWORK_ERROR` | Error de red | `error.code = 'NETWORK_ERROR'` |
| `DATABASE_ERROR` | Error de DB | `error.code = 'DATABASE_ERROR'` |

---

## 4. Patrones de Implementación

### 4.1 Patrón Básico de Handler

```javascript
// main.js

/**
 * Obtiene datos de ausentismo para una empresa
 * @param {Event} event - Evento IPC
 * @param {string} companyName - Nombre de la empresa
 * @returns {Promise<{success: boolean, data?: object, error?: object}>}
 */
ipcMain.handle('get-ausentismo-data', async (event, companyName) => {
  try {
    // 1. Validar parámetros
    if (!companyName || typeof companyName !== 'string') {
      return {
        success: false,
        error: {
          code: 'INVALID_DATA',
          message: 'Nombre de empresa inválido'
        }
      };
    }
    
    // 2. Validar permisos (si aplica)
    // const hasPermission = await validatePermission(event, 'read-ausentismo');
    // if (!hasPermission) { ... }
    
    // 3. Ejecutar lógica de negocio
    const data = await readAusentismoData(companyName);
    
    // 4. Retornar éxito
    return {
      success: true,
      data
    };
    
  } catch (error) {
    // 5. Manejar error
    console.error('[get-ausentismo-data] Error:', error);
    
    return {
      success: false,
      error: {
        code: 'READ_ERROR',
        message: error.message || 'Error leyendo datos'
      }
    };
  }
});
```

### 4.2 Patrón con Python

```javascript
// main.js

ipcMain.handle('procesar-ausentismo', async (event, empresa, formData) => {
  try {
    // 1. Validar datos
    if (!empresa || !formData?.cedula) {
      throw new Error('Datos incompletos');
    }
    
    // 2. Obtener ruta de Python
    const pythonPath = await getPython();
    
    // 3. Ejecutar script Python
    const result = await execFilePromise(pythonPath, [
      path.join(__dirname, 'Portear/src/ausentismo_utils.py'),
      empresa,
      JSON.stringify(formData)
    ]);
    
    // 4. Parsear resultado
    const data = JSON.parse(result.stdout);
    
    return { success: true, data };
    
  } catch (error) {
    console.error('[procesar-ausentismo] Error:', error);
    
    return {
      success: false,
      error: {
        code: 'PYTHON_ERROR',
        message: error.message
      }
    };
  }
});
```

### 4.3 Patrón con Base de Datos

```javascript
// main.js

ipcMain.handle('auth-login-v1', async (event, { email, password }) => {
  try {
    // 1. Validar credenciales
    if (!email || !password) {
      return {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email y contraseña son requeridos'
        }
      };
    }
    
    // 2. Conectar a SQLite
    const db = getDatabase();
    
    // 3. Buscar usuario
    const user = db.get(
      'SELECT * FROM users WHERE email = ? AND status = ?',
      [email, 'active']
    );
    
    if (!user) {
      return {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado o inactivo'
        }
      };
    }
    
    // 4. Validar password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return {
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Contraseña incorrecta'
        }
      };
    }
    
    // 5. Generar token
    const token = crypto.randomBytes(32).toString('hex');
    
    // 6. Guardar sesión
    db.run(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, Date.now() + 24 * 60 * 60 * 1000]
    );
    
    // 7. Obtener asignaciones
    const assignments = db.all(
      'SELECT company_key, role FROM assignments WHERE user_id = ?',
      [user.id]
    );
    
    // 8. Retornar éxito (sin password_hash)
    const { password_hash, ...userWithoutPassword } = user;
    
    return {
      success: true,
      data: {
        token,
        user: userWithoutPassword,
        companies: assignments
      }
    };
    
  } catch (error) {
    console.error('[auth-login-v1] Error:', error);
    
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: error.message
      }
    };
  }
});
```

### 4.4 Patrón con Validación de Permisos

```javascript
// main.js

/**
 * Valida permisos para un recurso
 * @param {Event} event - Evento IPC
 * @param {string} resource - Recurso solicitado
 * @returns {Promise<boolean>}
 */
async function validatePermission(event, resource) {
  // Obtener token del evento
  const token = event.sender.session.token;
  
  if (!token) {
    return false;
  }
  
  // Validar sesión en DB
  const db = getDatabase();
  const session = db.get('SELECT * FROM sessions WHERE token = ?', [token]);
  
  if (!session || session.expires_at < Date.now()) {
    return false;
  }
  
  // Validar permisos del usuario
  const assignment = db.get(
    'SELECT * FROM assignments WHERE user_id = ? AND resource = ?',
    [session.user_id, resource]
  );
  
  return !!assignment;
}

// Uso en handler
ipcMain.handle('save-budget-file', async (event, filePath, data) => {
  try {
    // Validar permisos
    const hasPermission = await validatePermission(event, 'write-presupuesto');
    
    if (!hasPermission) {
      return {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tiene permisos para guardar presupuesto'
        }
      };
    }
    
    // ... lógica de guardado
    
  } catch (error) {
    // ... manejo de error
  }
});
```

---

## 5. Manejo de Errores

### 5.1 Niveles de Error

| Nivel | Tipo | Manejo |
|-------|------|--------|
| **Crítico** | Crash de app | `process.on('unhandledRejection')` |
| **Grave** | Error de handler | `try/catch` en handler |
| **Leve** | Validación fallida | Retorno con `error.code` |

### 5.2 Patrones de Manejo

#### Patrón 1: Try-Catch Estándar

```javascript
ipcMain.handle('handler-name', async (event, params) => {
  try {
    // Lógica
    return { success: true, data: result };
  } catch (error) {
    console.error('[handler-name] Error:', error);
    return {
      success: false,
      error: {
        code: 'OPERATION_FAILED',
        message: error.message
      }
    };
  }
});
```

#### Patrón 2: Validación Temprana

```javascript
ipcMain.handle('handler-name', async (event, params) => {
  // Validaciones tempranas
  if (!params?.id) {
    return {
      success: false,
      error: {
        code: 'INVALID_DATA',
        message: 'ID es requerido'
      }
    };
  }
  
  try {
    // Lógica
    return { success: true, data: result };
  } catch (error) {
    // ...
  }
});
```

#### Patrón 3: Error Específico por Tipo

```javascript
ipcMain.handle('read-excel-file', async (event, filePath) => {
  try {
    const data = await readExcel(filePath);
    return { success: true, data };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Archivo no encontrado'
        }
      };
    }
    
    if (error.message.includes('locked')) {
      return {
        success: false,
        error: {
          code: 'EXCEL_LOCKED',
          message: 'Excel está abierto en otro proceso'
        }
      };
    }
    
    // Error genérico
    return {
      success: false,
      error: {
        code: 'READ_ERROR',
        message: error.message
      }
    };
  }
});
```

### 5.3 Logging de Errores

```javascript
// Usar electron-log para logging consistente
const log = require('electron-log');

ipcMain.handle('handler-name', async (event, params) => {
  try {
    log.info('[handler-name] Iniciando con params:', params);
    
    const result = await someOperation(params);
    
    log.info('[handler-name] Completado exitosamente');
    return { success: true, data: result };
    
  } catch (error) {
    log.error('[handler-name] Error:', {
      message: error.message,
      stack: error.stack,
      params
    });
    
    return {
      success: false,
      error: {
        code: 'OPERATION_FAILED',
        message: error.message
      }
    };
  }
});
```

---

## 6. Versionamiento

### 6.1 Cuándo Versionar

| Escenario | Acción | Ejemplo |
|-----------|--------|---------|
| Agregar campo opcional | ✅ NO versionar | Agregar `params.optionalField` |
| Cambiar tipo de dato | 🔴 Versionar | `string` → `number` |
| Renombrar campo | 🔴 Versionar | `userId` → `user_id` |
| Cambiar estructura de retorno | 🔴 Versionar | `{ data }` → `{ success, data }` |
| Agregar nuevo handler | ✅ NO versionar | `get-data-v2` |

### 6.2 Convención de Nombres

```javascript
// ✅ Correcto - Versión explícita
ipcMain.handle('get-presupuesto', ...);      // Versión original
ipcMain.handle('get-presupuesto-v2', ...);   // Nueva versión

// ❌ Incorrecto - Cambiar sin versionar
ipcMain.handle('get-presupuesto', ...);      // Antes: { data }
ipcMain.handle('get-presupuesto', ...);      // Ahora: { success, data, error }
                                             // ¡ROMPE frontend existente!
```

### 6.3 Estrategia de Migración

```javascript
// Mantener ambas versiones durante transición
ipcMain.handle('get-presupuesto', async (event, company) => {
  // Versión 1 (legacy)
  const data = await leerPresupuesto(company);
  return { data };  // Formato antiguo
});

ipcMain.handle('get-presupuesto-v2', async (event, company) => {
  // Versión 2 (nuevo contrato)
  try {
    const data = await leerPresupuesto(company);
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: { code: 'READ_ERROR', message: error.message } 
    };
  }
});

// En preload.js
module.exports = {
  // Versión 1 (mantener para compatibilidad)
  getPresupuesto: (company) => ipcRenderer.invoke('get-presupuesto', company),
  
  // Versión 2 (nuevo)
  getPresupuestoV2: (company) => ipcRenderer.invoke('get-presupuesto-v2', company)
};
```

---

## 7. Ejemplos Prácticos

### 7.1 Ejemplo 1: Handler Simple

```javascript
/**
 * Obtiene la versión de la aplicación
 * @returns {Promise<string>}
 */
ipcMain.handle('get-app-version', async () => {
  const packageJson = require('./package.json');
  return packageJson.version;
});
```

### 7.2 Ejemplo 2: Handler con Archivos

```javascript
/**
 * Lee contenido de un directorio
 * @param {Event} event
 * @param {string} directoryPath
 * @returns {Promise<{success: boolean, files?: string[], folders?: string[], error?: object}>}
 */
ipcMain.handle('read-directory', async (event, directoryPath) => {
  try {
    if (!directoryPath || !fs.existsSync(directoryPath)) {
      throw new Error('Directorio inválido');
    }
    
    const items = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    
    const files = [];
    const folders = [];
    
    for (const item of items) {
      if (item.isDirectory()) {
        folders.push(item.name);
      } else {
        files.push(item.name);
      }
    }
    
    return {
      success: true,
      files,
      folders
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'READ_ERROR',
        message: error.message
      }
    };
  }
});
```

### 7.3 Ejemplo 3: Handler Complejo con Múltiples Operaciones

```javascript
/**
 * Guarda seguimiento de caso PRIC en PRI.xlsx
 * @param {Event} event
 * @param {object} followUpData - Datos del seguimiento
 * @param {string} companyName - Nombre de la empresa
 * @returns {Promise<{success: boolean, error?: object}>}
 */
ipcMain.handle('save-follow-up', async (event, followUpData, companyName) => {
  try {
    // 1. Validar datos mínimos
    if (!followUpData?.trabajador?.cedula || !followUpData?.incapacidad?.fechaFin) {
      return {
        success: false,
        error: {
          code: 'INVALID_DATA',
          message: 'Datos incompletos: cédula y fecha fin son requeridos'
        }
      };
    }
    
    // 2. Obtener ruta de PRI.xlsx
    const priPath = getPriPath(companyName);
    
    if (!fs.existsSync(priPath)) {
      return {
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Archivo PRI.xlsx no encontrado'
        }
      };
    }
    
    // 3. Leer Excel existente
    const workbook = await ExcelJS.stream.xlsx.readFile(priPath);
    const worksheet = workbook.getWorksheet('Casos en seguimiento');
    
    // 4. Buscar si ya existe el caso (misma cédula + mismas fechas)
    let existingRow = null;
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Saltar header
      
      const cedula = row.getCell(3).value;
      const fechaFin = row.getCell(28).value;
      
      if (cedula === followUpData.trabajador.cedula && 
          fechaFin === followUpData.incapacidad.fechaFin) {
        existingRow = row;
      }
    });
    
    // 5. Actualizar o crear
    if (existingRow) {
      // Actualizar registro existente
      updateFollowUpRow(existingRow, followUpData);
    } else {
      // Crear nuevo registro
      createFollowUpRow(worksheet, followUpData);
    }
    
    // 6. Guardar archivo
    await workbook.xlsx.writeFile(priPath);
    
    return { success: true };
    
  } catch (error) {
    console.error('[save-follow-up] Error:', error);
    
    return {
      success: false,
      error: {
        code: 'SAVE_ERROR',
        message: error.message
      }
    };
  }
});

/**
 * Actualiza fila existente con nuevos datos
 */
function updateFollowUpRow(row, data) {
  // Buscar primer seguimiento vacío (columnas AB-AK)
  for (let i = 1; i <= 5; i++) {
    const fechaCol = 27 + (i - 1) * 2;  // AB=27, AD=29, ...
    const descCol = fechaCol + 1;
    
    if (!row.getCell(fechaCol).value) {
      row.getCell(fechaCol).value = data.seguimientos[i - 1]?.fecha;
      row.getCell(descCol).value = data.seguimientos[i - 1]?.descripcion;
      return;
    }
  }
  
  throw new Error('Máximo de 5 seguimientos alcanzado');
}

/**
 * Crea nueva fila con datos de seguimiento
 */
function createFollowUpRow(worksheet, data) {
  const newRow = worksheet.addRow({
    // Columnas básicas (A-V)
    nombre: data.trabajador.nombre,
    cedula: data.trabajador.cedula,
    // ... más campos
    
    // Primer seguimiento (columnas AB-AK)
    seguimiento_1_fecha: data.seguimientos[0]?.fecha,
    seguimiento_1_descripcion: data.seguimientos[0]?.descripcion
  });
  
  return newRow;
}
```

---

## 8. Checklist de Implementación

### 8.1 Antes de Implementar

- [ ] Entender requerimiento completo
- [ ] Verificar si existe handler similar
- [ ] Definir nombre del contrato (seguir convenciones)
- [ ] Definir estructura de parámetros
- [ ] Definir estructura de retorno
- [ ] Identificar códigos de error posibles

### 8.2 Durante Implementación

- [ ] Agregar JSDoc con descripción
- [ ] Validar todos los parámetros de entrada
- [ ] Usar try-catch para manejar errores
- [ ] Retornar formato estándar `{ success, data?, error? }`
- [ ] Usar códigos de error estandarizados
- [ ] Agregar logging con `console.error` o `log.error`
- [ ] No exponer detalles internos en mensajes de error

### 8.3 Después de Implementar

- [ ] Actualizar `preload.js` con nuevo contrato
- [ ] Actualizar documentación en `ipc-contratos.md`
- [ ] Agregar tipos JSDoc en frontend
- [ ] Probar casos de éxito y error
- [ ] Verificar que no rompe frontend existente

### 8.4 Checklist de Código

```javascript
// ✅ Checklist visual de handler completo

/**
 * Descripción clara del propósito
 * @param {Type} param - Descripción
 * @returns {Promise<Type>} Descripción de retorno
 */
ipcMain.handle('handler-name', async (event, param) => {
  // ✅ Validación de parámetros
  if (!param) {
    return { success: false, error: { code: '...', message: '...' } };
  }
  
  try {
    // ✅ Lógica de negocio
    const result = await doSomething(param);
    
    // ✅ Retorno exitoso
    return { success: true, data: result };
    
  } catch (error) {
    // ✅ Logging de error
    console.error('[handler-name] Error:', error);
    
    // ✅ Retorno de error
    return {
      success: false,
      error: {
        code: 'ERROR_CODE',
        message: error.message
      }
    };
  }
});
```

---

## 9. Referencias

### 9.1 Documentos Relacionados

| Documento | Propósito |
|-----------|-----------|
| `docs/01-arquitectura/ipc-contratos.md` | Lista completa de contratos |
| `docs/01-arquitectura/resumen-arquitectura-v0.1.75.md` | Resumen de arquitectura |
| `main.js` | Implementación de handlers |
| `preload.js` | Exposición de contratos |

### 9.2 Recursos Externos

- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [better-sqlite3 Documentation](https://github.com/JoshuaWise/better-sqlite3)
- [ExcelJS Documentation](https://github.com/exceljs/exceljs)

---

**Mantenido por:** Backend Architecture Team  
**Última actualización:** 17 de marzo de 2026  
**Versión:** 1.0 (v0.1.75)  
**Próxima revisión:** Al agregar 10+ handlers nuevos

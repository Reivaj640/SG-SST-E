# Actualización v0.1.51 - Calificación PCL Regional y Nacional

**Fecha:** 28 de febrero de 2026  
**Versión:** 0.1.51  
**Módulo:** Gestión de la Salud → 3.3.6 Medición del Ausentismo por Causa Médica

---

## 📋 Resumen

Esta actualización implementa la reorganización de la sección de **Calificación PCL** en dos secciones separadas:
- **Calificación Regional** (ícono marcador, color azul índigo)
- **Calificación Nacional** (ícono edificio, color azul oscuro)

Cada sección contiene 7 campos independientes que se guardan en columnas separadas del archivo Excel PRI.xlsx.

---

## 🎯 Objetivos

1. Separar visualmente los procesos de calificación regional y nacional en la UI
2. Indexar correctamente los datos en las columnas FC-FP (índices 158-171) del Excel
3. Mantener compatibilidad con registros existentes
4. Mejorar la experiencia de usuario con identificación visual clara

---

## 📁 Archivos Modificados

### Frontend

| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| `modules/gestion-salud/ausentismo/medicion-ausentismo.js` | ~2743-2845 | UI de Calificación PCL con dos secciones separadas |
| `modules/gestion-salud/ausentismo/medicion-ausentismo.js` | ~3600-3620 | `saveSeguimientoData()` - Envío de datos Regional/Nacional |
| `modules/gestion-salud/ausentismo/medicion-ausentismo.js` | ~4070-4095 | `cargarRegistroYAbrirPanel()` - Carga de datos Regional/Nacional |
| `modules/gestion-salud/ausentismo/medicion-ausentismo.js` | ~4311-4328 | `ejecutarGuardadoReal()` - Estructura de datos para Python |

### Backend (Python)

| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| `Portear/src/actualizar_ausentismo.py` | ~985-1000 | Índices de columnas para Calificación Regional (FC-FI) y Nacional (FJ-FP) |
| `Portear/src/actualizar_ausentismo.py` | ~1073-1075 | Extensión de lista `fila_completa` antes de asignaciones |

---

## 🗂️ Estructura de Datos

### Calificación Regional (Columnas FC-FI, Índices 158-164)

| Campo | ID HTML | Columna Excel | Índice |
|-------|---------|---------------|--------|
| Estado del Proceso | `sp-estado-proceso-regional` | FC | 158 |
| Fecha de Solicitud | `sp-fecha-solicitud-regional` | FD | 159 |
| Fecha Dictamen | `sp-fecha-dictamen-regional` | FE | 160 |
| % PCL Regional | `sp-porcentaje-pcl-regional` | FF | 161 |
| Origen Calificado | `sp-origen-calificacion-regional` | FG | 162 |
| Fecha de Estructuración | `sp-fecha-estructuracion-regional` | FH | 163 |
| Observaciones Calificación Regional | `sp-observaciones-calificacion-regional` | FI | 164 |

### Calificación Nacional (Columnas FJ-FP, Índices 165-171)

| Campo | ID HTML | Columna Excel | Índice |
|-------|---------|---------------|--------|
| Estado del Proceso | `sp-estado-proceso-nacional` | FJ | 165 |
| Fecha de Solicitud | `sp-fecha-solicitud-nacional` | FK | 166 |
| Fecha Dictamen | `sp-fecha-dictamen-nacional` | FL | 167 |
| % PCL Nacional | `sp-porcentaje-pcl-nacional` | FM | 168 |
| Origen Calificado | `sp-origen-calificacion-nacional` | FN | 169 |
| Fecha de Estructuración | `sp-fecha-estructuracion-nacional` | FO | 170 |
| Observaciones Calificación Nacional | `sp-observaciones-calificacion` | FP | 171 |

> **Nota:** El campo de observaciones nacional usa el ID `sp-observaciones-calificacion` por compatibilidad con la implementación original.

---

## 🔧 Cambios Técnicos

### 1. Frontend - UI (medicion-ausentismo.js)

```javascript
// SECCIÓN 5: CALIFICACIÓN PCL
<div id="sp-section-calificacion" class="sp-form-section">
    <div class="sp-section-title">
        <i class="fas fa-balance-scale"></i> 5. Proceso de Calificación / PCL
    </div>
    
    <div class="sp-form-grid">
        <!-- CALIFICACIÓN REGIONAL -->
        <div class="sp-form-group full-width" style="margin-top: 10px; padding-top: 15px; border-top: 2px solid #E2E8F0;">
            <label class="sp-form-label" style="color: #4F46E5; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                <i class="fas fa-map-marker-alt"></i> Calificación Regional
            </label>
        </div>
        
        <!-- 7 campos de Calificación Regional -->
        
        <!-- CALIFICACIÓN NACIONAL -->
        <div class="sp-form-group full-width" style="margin-top: 10px; padding-top: 15px; border-top: 2px solid #E2E8F0;">
            <label class="sp-form-label" style="color: #174ea6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                <i class="fas fa-building"></i> Calificación Nacional
            </label>
        </div>
        
        <!-- 7 campos de Calificación Nacional -->
    </div>
</div>
```

### 2. Frontend - Envío de Datos (ejecutarGuardadoReal)

```javascript
const followUpData = {
    // ... otros campos
    calificacion: {
        // 🆕 Calificación Regional (columnas FC-FI, índices 158-164)
        estadoProcesoRegional: seguimientoData.calificacion.estadoProcesoRegional || '',
        fechaSolicitudRegional: seguimientoData.calificacion.fechaSolicitudRegional || '',
        fechaDictamenRegional: seguimientoData.calificacion.fechaDictamenRegional || '',
        porcentajePclRegional: seguimientoData.calificacion.porcentajePclRegional || '',
        origenCalificacionRegional: seguimientoData.calificacion.origenCalificacionRegional || '',
        fechaEstructuracionRegional: seguimientoData.calificacion.fechaEstructuracionRegional || '',
        observacionesCalificacionRegional: seguimientoData.calificacion.observacionesCalificacionRegional || '',
        
        // 🆕 Calificación Nacional (columnas FJ-FP, índices 165-171)
        estadoProcesoNacional: seguimientoData.calificacion.estadoProcesoNacional || '',
        fechaSolicitudNacional: seguimientoData.calificacion.fechaSolicitudNacional || '',
        fechaDictamenNacional: seguimientoData.calificacion.fechaDictamenNacional || '',
        porcentajePclNacional: seguimientoData.calificacion.porcentajePclNacional || '',
        origenCalificacionNacional: seguimientoData.calificacion.origenCalificacionNacional || '',
        fechaEstructuracionNacional: seguimientoData.calificacion.fechaEstructuracionNacional || '',
        observacionesCalificacionNacional: seguimientoData.calificacion.observacionesCalificacionNacional || ''
    }
};
```

### 3. Backend - Python (actualizar_ausentismo.py)

```python
# Extender la lista para soportar columnas hasta FP (índice 171)
if len(fila_completa) < 172:
    fila_completa.extend([""] * (172 - len(fila_completa)))

# 🆕 Calificación Regional (índices 158-164) - de calificacion
# Columnas FC(158), FD(159), FE(160), FF(161), FG(162), FH(163), FI(164)
fila_completa[158] = calificacion.get("estadoProcesoRegional", "")
fila_completa[159] = calificacion.get("fechaSolicitudRegional", "")
fila_completa[160] = calificacion.get("fechaDictamenRegional", "")
fila_completa[161] = calificacion.get("porcentajePclRegional", "")
fila_completa[162] = calificacion.get("origenCalificacionRegional", "")
fila_completa[163] = calificacion.get("fechaEstructuracionRegional", "")
fila_completa[164] = calificacion.get("observacionesCalificacionRegional", "")

# 🆕 Calificación Nacional (índices 165-171) - de calificacion
# Columnas FJ(165), FK(166), FL(167), FM(168), FN(169), FO(170), FP(171)
fila_completa[165] = calificacion.get("estadoProcesoNacional", "")
fila_completa[166] = calificacion.get("fechaSolicitudNacional", "")
fila_completa[167] = calificacion.get("fechaDictamenNacional", "")
fila_completa[168] = calificacion.get("porcentajePclNacional", "")
fila_completa[169] = calificacion.get("origenCalificacionNacional", "")
fila_completa[170] = calificacion.get("fechaEstructuracionNacional", "")
fila_completa[171] = calificacion.get("observacionesCalificacionNacional", "")
```

> **⚠️ Importante:** La extensión de la lista `fila_completa` debe realizarse **ANTES** de las asignaciones de Calificación para evitar el error `list assignment index out of range`.

---

## 🐛 Errores Corregidos

### Error: `list assignment index out of range`

**Causa:** La lista `fila_completa` se inicializaba con 158 elementos (índices 0-157) pero se intentaba asignar valores en los índices 158-171 sin extenderla primero.

**Solución:** Mover la extensión de la lista antes de las asignaciones:

```python
# ❌ ANTES (incorrecto)
fila_completa[158] = calificacion.get("estadoProcesoRegional", "")  # Error!
# ... más asignaciones ...
if len(fila_completa) < 172:  # Demasiado tarde
    fila_completa.extend([""] * (172 - len(fila_completa)))

# ✅ DESPUÉS (correcto)
if len(fila_completa) < 172:  # Primero extender
    fila_completa.extend([""] * (172 - len(fila_completa)))
fila_completa[158] = calificacion.get("estadoProcesoRegional", "")  # Ahora sí funciona
# ... más asignaciones ...
```

### Error: Datos de calificación no se guardaban en Excel

**Causa:** El objeto `followUpData.calificacion` en JavaScript usaba campos legacy vacíos en lugar de los campos Regional/Nacional.

**Solución:** Actualizar la función `ejecutarGuardadoReal()` para mapear correctamente los campos:

```javascript
// ❌ ANTES (incorrecto)
calificacion: {
    estadoProceso: seguimientoData.calificacion.estadoProceso || '',  // Vacío
    // ...
}

// ✅ DESPUÉS (correcto)
calificacion: {
    estadoProcesoRegional: seguimientoData.calificacion.estadoProcesoRegional || '',
    estadoProcesoNacional: seguimientoData.calificacion.estadoProcesoNacional || '',
    // ... todos los campos Regional y Nacional
}
```

---

## 📊 Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────┐
│  UI Panel de Seguimiento                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Calificación Regional (7 campos)                         │  │
│  │ - Estado del Proceso                                     │  │
│  │ - Fecha de Solicitud                                     │  │
│  │ - Fecha Dictamen                                         │  │
│  │ - % PCL Regional                                         │  │
│  │ - Origen Calificado                                      │  │
│  │ - Fecha de Estructuración                                │  │
│  │ - Observaciones Calificación Regional                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Calificación Nacional (7 campos)                         │  │
│  │ - Estado del Proceso                                     │  │
│  │ - Fecha de Solicitud                                     │  │
│  │ - Fecha Dictamen                                         │  │
│  │ - % PCL Nacional                                         │  │
│  │ - Origen Calificado                                      │  │
│  │ - Fecha de Estructuración                                │  │
│  │ - Observaciones Calificación Nacional                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  JavaScript (medicion-ausentismo.js)                            │
│  saveSeguimientoData() → ejecutarGuardadoReal()                 │
│  - Recopila datos de 14 campos (7 Regional + 7 Nacional)        │
│  - Construye objeto followUpData.calificacion                   │
│  - Envía vía IPC a Python                                       │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Python (actualizar_ausentismo.py)                              │
│  guardar_seguimiento()                                          │
│  - Recibe datos anidados: calificacion.{campoRegional, campoNacional}  │
│  - Extiende fila_completa a 172 elementos                       │
│  - Asigna Regional a índices 158-164 (FC-FI)                    │
│  - Asigna Nacional a índices 165-171 (FJ-FP)                    │
│  - Guarda en PRI.xlsx                                           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Excel (PRI.xlsx) - Hoja "Casos en seguimiento"                 │
│  Columnas FC-FI: Calificación Regional                          │
│  Columnas FJ-FP: Calificación Nacional                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ Pruebas Realizadas

### 1. Guardado de Datos
- ✅ Datos de Calificación Regional se guardan en columnas FC-FI
- ✅ Datos de Calificación Nacional se guardan en columnas FJ-FP
- ✅ No hay error `list assignment index out of range`
- ✅ Los 14 campos se indexan correctamente

### 2. Carga de Datos
- ✅ Al cargar un registro existente, los campos Regional se muestran en la sección Regional
- ✅ Al cargar un registro existente, los campos Nacional se muestran en la sección Nacional
- ✅ Los valores persisten después de recargar la aplicación

### 3. UI/UX
- ✅ Sección Regional identificada con ícono de marcador y color azul índigo (#4F46E5)
- ✅ Sección Nacional identificada con ícono de edificio y color azul oscuro (#174ea6)
- ✅ Separación visual clara entre ambas secciones

---

## 📝 Notas de Implementación

### Compatibilidad con Registros Existentes

Los registros creados antes de esta actualización pueden tener datos en el objeto `calificacionLegacy`. El sistema mantiene compatibilidad leyendo ambos conjuntos de campos:

```javascript
// En cargarRegistroYAbrirPanel()
if (registro.calificacion) {
    const calificacion = registro.calificacion;
    
    // 🆕 Calificación Regional
    document.getElementById('sp-estado-proceso-regional').value = calificacion.estadoProcesoRegional || '';
    // ... más campos Regional
    
    // 🆕 Calificación Nacional
    document.getElementById('sp-estado-proceso-nacional').value = calificacion.estadoProcesoNacional || '';
    // ... más campos Nacional
}
```

### Convenciones de Nomenclatura

- **Regional:** Todos los campos terminan en `Regional` (ej: `estadoProcesoRegional`)
- **Nacional:** Todos los campos terminan en `Nacional` (ej: `estadoProcesoNacional`)
- **IDs HTML:** Siguen el patrón `sp-{campo}-{regional|nacional}` (ej: `sp-estado-proceso-regional`)

### Consideraciones de Diseño

- Las secciones están separadas visualmente con bordes superiores de 2px
- Los títulos de sección usan colores distintivos:
  - Regional: `#4F46E5` (azul índigo)
  - Nacional: `#174ea6` (azul oscuro)
- Cada sección tiene su propio ícono para identificación rápida

---

## 🔗 Referencias

- [Arquitectura del Módulo de Ausentismo](./ARQUITECTURA_AUSENTISMO_DUAL.md)
- [Scripts Python](./scripts-python.md)
- [Resumen de Cambios v0.1.49](./RESUMEN_CAMBIOS_v0.1.49.md)
- [Resumen de Cambios v0.1.50](./RESUMEN_CAMBIOS_v0.1.50.md)

---

## 📌 Estado

- [x] UI implementada con dos secciones separadas
- [x] Campos Regional y Nacional en JavaScript
- [x] Envío de datos desde frontend a backend
- [x] Recepción y guardado en Python
- [x] Corrección de error `list assignment index out of range`
- [x] Carga de datos desde Excel
- [x] Documentación actualizada
- [x] Pruebas de guardado y carga completadas

**Estado:** ✅ **COMPLETADO**

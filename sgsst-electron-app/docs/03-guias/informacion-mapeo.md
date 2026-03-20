# Información de Mapeo en Tarjetas de Empresas

**Versión:** 1.0.0  
**Última actualización:** 4 de marzo de 2026  
**Archivos:** `components/config/config-viewer.html`, `renderer.js`

---

## 📋 Descripción

Las tarjetas de empresas en la sección de **Configuración → Gestión de Empresas** ahora muestran información detallada sobre el último mapeo realizado, incluyendo fecha, hora y tipo de mapeo.

---

## 🎯 Funcionalidad

### Información Mostrada

```
┌─────────────────────────────────────┐
│  Tempoactiva        [Riesgo IV]    │
│                                     │
│  Empleados: 120    Agropecuaria: Sí │
│  Normativa: 45     Estado: Vinculada│
│                                     │
│  [Ver Detalles] [Reconfigurar] [X]  │
│  ─────────────────────────────────  │
│  📅 Último mapeo: 4 mar 2026 10:30 │
│                      [Primera vez]  │
└─────────────────────────────────────┘
```

### Datos Almacenados

Cada empresa en `config.companyPaths` ahora incluye:

```javascript
{
  "Tempoactiva": {
    "root": "G:/Mi unidad/.../Tempoactiva",
    "structure": { /* estructura mapeada */ },
    "fechaMapeo": "2026-03-04T15:30:00.000Z",  // 🆕
    "tipoMapeo": "primera_vez"                  // 🆕
  }
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `fechaMapeo` | ISO 8601 | Timestamp exacto del mapeo |
| `tipoMapeo` | String | `'primera_vez'` o `'reconfiguracion'` |

---

## 🏗️ Implementación Técnica

### 1. Guardado del Mapeo (`renderer.js`)

```javascript
// Línea ~3088
async function mapDirectoryForCompany(companyName, path, result) {
    const config = await window.electronAPI.loadConfig();
    
    if (!config.companyPaths) {
        config.companyPaths = {};
    }

    // Determinar si es primera vez o reconfiguración
    const esPrimeraVez = !config.companyPaths[companyName];
    const tipoMapeo = esPrimeraVez ? 'primera_vez' : 'reconfiguracion';
    const fechaMapeo = new Date().toISOString();

    // Guardar con nueva información
    config.companyPaths[companyName] = {
        root: path,
        structure: result.structure,
        fechaMapeo,      // 🆕
        tipoMapeo        // 🆕
    };

    await window.electronAPI.saveConfig(config);
}
```

### 2. Renderizado en Tarjetas (`config-viewer.html`)

```javascript
// Línea ~1553
function renderCompanyCards() {
    companies.forEach(comp => {
        // ... crear tarjeta ...

        // Sección de información de mapeo
        if (currentConfig && currentConfig.companyPaths) {
            const companyConfig = currentConfig.companyPaths[comp.name];
            
            if (companyConfig && companyConfig.root) {
                const mapInfoSection = document.createElement('div');
                mapInfoSection.className = 'map-info-section';

                const fechaMapeo = companyConfig.fechaMapeo;
                const tipoMapeo = companyConfig.tipoMapeo;

                // Formatear fecha
                let fechaDisplay = 'N/A';
                if (fechaMapeo) {
                    const fechaDate = new Date(fechaMapeo);
                    fechaDisplay = fechaDate.toLocaleDateString('es-CO', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    }) + ' ' + fechaDate.toLocaleTimeString('es-CO', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }

                // Badge de tipo
                let tipoBadge = '';
                if (tipoMapeo === 'primera_vez') {
                    tipoBadge = '<span class="map-type-badge map-type-first">Primera vez</span>';
                } else if (tipoMapeo === 'reconfiguracion') {
                    tipoBadge = '<span class="map-type-badge map-type-reconfig">Reconfiguración</span>';
                }

                mapInfoSection.innerHTML = `
                    <div class="map-info-item">
                        <i class="fas fa-calendar-check map-info-icon"></i>
                        <span class="map-info-label">Último mapeo:</span>
                        <span class="map-info-value">${fechaDisplay}${tipoBadge}</span>
                    </div>
                `;

                cardBody.appendChild(mapInfoSection);
            }
        }
    });
}
```

### 3. Estilos CSS (`config-viewer.html`)

```css
/* Línea ~817 */
.map-info-section {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
}

.map-info-item {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    font-size: 0.75rem;
}

.map-info-icon {
    color: var(--primary);
    flex-shrink: 0;
    margin-top: 2px;
}

.map-info-label {
    color: var(--text-muted);
    font-weight: 500;
    white-space: nowrap;
}

.map-info-value {
    color: var(--text-main);
    font-weight: 400;
}

.map-type-badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    margin-left: 0.25rem;
}

.map-type-first {
    background-color: #d1fae5;
    color: #059669;
}

.map-type-reconfig {
    background-color: #fef3c7;
    color: #d97706;
}
```

---

## 🎨 Diseño Visual

### Badge de Tipo de Mapeo

| Tipo | Color | Uso |
|------|-------|-----|
| **Primera vez** | Verde (#059669) | Mapeo inicial de la empresa |
| **Reconfiguración** | Ámbar (#d97706) | Reconfiguración de ruta existente |

### Formato de Fecha

```
Formato: "4 mar 2026 10:30"
- Día: numérico sin cero inicial
- Mes: abreviado (3 letras)
- Año: 4 dígitos
- Hora: 24h con minutos
```

---

## 📊 Flujo de Actualización

```
1. Usuario hace mapeo de empresa
   ↓
2. renderer.js: mapDirectoryForCompany()
   ↓
3. Determinar tipo (primera_vez vs reconfiguracion)
   ↓
4. Guardar fechaMapeo + tipoMapeo en config
   ↓
5. Recargar lista de empresas
   ↓
6. renderCompanyCards() muestra nueva información
```

---

## 🔧 Funciones Relacionadas

### `mapDirectoryForCompany(companyName, path, result)`
Guarda el mapeo con fecha y tipo.

### `renderCompanyCards()`
Renderiza tarjetas con información de mapeo.

### `eliminarEmpresa(nombreEmpresa)`
Elimina empresa (incluyendo fechaMapeo y tipoMapeo).

### `prepareLinkModal(companyName)`
Prepara modal de vinculación/reconfiguración.

---

## 🐛 Solución de Problemas

### Problema: No muestra fecha de mapeo

**Causa:** Empresa mapeada antes de la actualización

**Solución:** La fecha muestra "N/A" para empresas sin `fechaMapeo`

### Problema: Badge no muestra color

**Causa:** `tipoMapeo` no es 'primera_vez' o 'reconfiguracion'

**Solución:** Verificar que el guardado use valores exactos

### Problema: Fecha en formato incorrecto

**Causa:** Timestamp no es ISO 8601 válido

**Solución:** Usar `new Date().toISOString()` al guardar

---

## 📝 Ejemplos

### Empresa con Primera Vez

```javascript
{
  "name": "Temposum",
  "path": {
    "root": "G:/Mi unidad/.../Temposum",
    "structure": {...},
    "fechaMapeo": "2026-03-04T15:30:00.000Z",
    "tipoMapeo": "primera_vez"
  }
}

// Visualización:
// 📅 Último mapeo: 4 mar 2026 15:30 [Primera vez] 🟢
```

### Empresa con Reconfiguración

```javascript
{
  "name": "Aseplus",
  "path": {
    "root": "G:/Mi unidad/.../Aseplus",
    "structure": {...},
    "fechaMapeo": "2026-03-05T09:15:00.000Z",
    "tipoMapeo": "reconfiguracion"
  }
}

// Visualización:
// 📅 Último mapeo: 5 mar 2026 09:15 [Reconfiguración] 🟡
```

### Empresa sin Información

```javascript
{
  "name": "Asel",
  "path": {
    "root": "G:/Mi unidad/.../Asel",
    "structure": {...}
    // Sin fechaMapeo ni tipoMapeo
  }
}

// Visualización:
// 📅 Último mapeo: N/A
```

---

## 📖 Referencias

- **Archivo HTML:** `components/config/config-viewer.html` (líneas 817-873, 1553-1598)
- **Archivo JS:** `renderer.js` (líneas 3088-3095)
- **Config:** `icon-config.json` (estructura de configuración)

---

## 📋 Changelog

### v1.0.0 - 4 Mar 2026
- ✅ Agregada información de mapeo en tarjetas
- ✅ Campo `fechaMapeo` en configuración
- ✅ Campo `tipoMapeo` (primera_vez / reconfiguracion)
- ✅ Badge visual para tipo de mapeo
- ✅ Formato de fecha legible (es-CO)
- ✅ Estilos CSS específicos y aislados

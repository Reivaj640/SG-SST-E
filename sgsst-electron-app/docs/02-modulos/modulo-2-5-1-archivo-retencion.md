# Submódulo 2.5.1 — Archivo y Retención Documental del SG-SST

**Versión:** 1.0
**Actualizado:** 9 de junio de 2026
**Módulo padre:** Gestión Integral (Módulo 2)
**Código SG-SST:** 2.5.1

---

## Descripción

Sistema de gestión documental del SG-SST que permite administrar el listado maestro de control de documentos y registros, con tablas de retención y disposición documental. Implementa CRUD completo sobre archivo Excel y un dashboard con gráficas Chart.js.

## Arquitectura

### Patrón: Iframe-Wrapper + postMessage

El submódulo usa un patrón de iframe aislado: el componente `ArchivoRetencionComponent` crea un `<iframe>` que carga una página HTML autocontenida (`index.html`). La comunicación con el proceso main se realiza vía `postMessage` puenteado por el wrapper.

### Separación de código Main

Los 7 handlers IPC están en un archivo separado `archivo-retencion-main.js` con función `registerArchivoRetencionHandlers()`, importado en `main.js:29`.

## Archivos

| Archivo | Líneas | Propósito |
|---|---|---|
| `modules/gestion-integral/archivo-retencion/archivo-retencion.js` | - | Wrapper component `ArchivoRetencionComponent` (iframe + postMessage bridge) |
| `modules/gestion-integral/archivo-retencion/archivo-retencion-main.js` | - | 7 IPC handlers, ExcelJS CRUD |
| `modules/gestion-integral/archivo-retencion/index.html` | ~2100 | CRUD UI autocontenida con CSS inline (prefijo `.kair-ar-`) |
| `modules/gestion-integral/archivo-retencion/archivo-retencion-dashboard.js` | - | IIFE, 4 gráficas Chart.js |
| `modules/gestion-integral/archivo-retencion/archivo-retencion-dashboard.html` | - | Dashboard con Bootstrap Icons + Chart.js CDN |

## Contratos IPC

| Canal | Método Preload | Descripción |
|---|---|---|
| `archivo-retencion:get-stats` | `archivoRetencion.getStats(company)` | Estadísticas para dashboard |
| `archivo-retencion:get-excel-path` | `archivoRetencion.getExcelPath(company)` | Ruta del Excel por empresa |
| `archivo-retencion:leer-todos` | `archivoRetencion.leerTodos(company)` | Leer todos los registros |
| `archivo-retencion:guardar` | `archivoRetencion.guardar(company, docs)` | Guardar dataset completo |
| `archivo-retencion:crear` | `archivoRetencion.crear(company, doc)` | Crear nuevo registro |
| `archivo-retencion:actualizar` | `archivoRetencion.actualizar(company, doc)` | Actualizar registro |
| `archivo-retencion:eliminar` | `archivoRetencion.eliminar(company, { numero })` | Eliminar registro por numero |

## Estructura de Datos

### Almacenamiento: Excel `GI-FO-010 LISTADO MAESTRO DE CONTROL DE DOCUMENTOS Y REGISTROS.xlsx`

**Estructura de documento:**

```javascript
{
  numero: string,
  tipoDocumental: string,
  descripcion: string,
  tiempoRetencion: number,  // Años
  responsable: string,
  ubicacion: string,
  estado: 'Activo' | 'Inactivo',
  origen: string,
  disposicion: string,  // Conservar / Eliminar / Microfilmar
}
```

## UI — CRUD Viewer (iframe)

- **Prefijo CSS:** `.kair-ar-`
- **Features:** paginación, búsqueda, selector multi-hoja, modal crear/editar, diálogo confirmación, toast, dirty-state tracking
- **Tema:** claro/oscuro vía `data-theme`

## UI — Dashboard

- **4 gráficas Chart.js:** por tipo documental, por origen, por disposición, por anualidad
- **Bootstrap Icons** + Chart.js CDN
- **Tema:** claro/oscuro

## Navegación

- **Módulo:** Gestión Integral
- **Sidebar:** "2.5.1 Archivo y Retención Documental del SG-SST"
- **Ruta:** `gestion-integral.archivo-retencion`
- **Script:** `index.html` línea 125
- **Main import:** `main.js` línea 29

## Observaciones

1. Aislamiento completo vía iframe (DOM/CSS separado del parent)
2. Handlers IPC en archivo separado (patrón limpio, diferente a otros submódulos)
3. No exportado en `modules/gestion-integral/index.js` (barrel file) — gap menor
4. El viewer HTML es ~2100 líneas autocontenidas con CSS inline
5. Comunicación postMessage bridgeada por el wrapper component

---

**Mantenido por:** Frontend Team
**Última actualización:** 9 de junio de 2026
**Versión doc:** 1.0 (v0.1.99)

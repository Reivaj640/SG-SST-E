# Diseño: Actas de Reunión (G-FO-009) — Datos reales + Editor

**Fecha:** 2026-06-18
**Estado:** Pendiente revisión del usuario
**Módulo:** 6.1.3 — Revisión por la Alta Dirección
**Subsección:** Actas de Reunión Gerencial (G-FO-009)

## Contexto

La vista de Actas de Reunión (`actas-reunion.js`) mostraba datos hardcodeados en `ACTAS_MOCK` (2 actas inventadas). La tabla `actas` de SQLite existe pero está vacía. El usuario quiere que la vista refleje datos reales y permita crear nuevas actas desde la app.

Ya existen en el código:
- Parser XLSX (`_parserGFO009` en `main/revision-alta-direccion-bridge.js`)
- Auto-import desde XLSX al inicio (`_autoImportXlsx`)
- Handler IPC `guardarActa` que persiste a SQLite con `metadata_json`
- Schema de tabla `actas` (id, empresa_id, numero, fecha, estado, archivo_path, metadata_json, creado_en, actualizado_en)

Archivo real presente en la carpeta de la empresa:
- `GG-FO-009 ACTA DE REUNION GERENCIAL.xlsx` (24.9 KB, enero 2017)

## Decisión

Enfoque **A**: vista nueva con editor en ruta propia, replicando el patrón de `revision-editor.js`. Sin modales ni edición inline.

## Arquitectura

```
hub
 └─ "Actas de Reunión" → vista `actas-reunion.js` (master-detail)
                           ├─ Click "Nueva acta" → navega a editor
                           ├─ Click "Editar acta" → navega a editor (con id)
                           └─ Click en item del master → cambia activeId
                                            ↓
                              editor `actas-editor.js` (formulario completo)
                                            ↓
                                    Click "Guardar"
                                            ↓
                                bridge.guardarActa → SQLite
```

## Archivos a modificar / crear

### Modificar

- **`modules/verificacion/.../vistas/actas-reunion.js`**
  - Quitar `ACTAS_MOCK` y el fallback de la línea 63.
  - Leer `acta.metadata` para campos ricos.
  - Mapear shape DB → shape vista (ver tabla de transformación).
  - Empty state si no hay actas (botón "Crear primera acta").
  - Botón "Editar acta" navega a `'actas-editor'` con id.
  - Botón "Nueva acta" navega a `'actas-editor'` sin id.

- **`modules/verificacion/.../revision-alta-direccion-component.js`**
  - Agregar `'actas-editor'` al enum `currentView`.
  - Nuevo caso en `_renderCurrentView()` que llame a `_renderActasEditorView()`.
  - Volver desde editor → `'actas'`.
  - Breadcrumb actualizado para incluir `'actas-editor'`.

### Crear

- **`modules/verificacion/.../vistas/actas-editor.js`**
  - Formulario estructurado en secciones laterales (igual que `revision-editor.js`).
  - Secciones: Generalidades, Datos generales, Participantes, Orden del día, Desarrollo/Compromisos.
  - Validación mínima (fecha, preside, al menos 1 participante).
  - `_collectFormData()` → objeto con shape de envío.
  - Listeners para agregar/quitar participantes y filas de compromisos.

## Forma de datos

### DB → vista (lectura)

| Vista pide              | DB tiene (en `metadata_json` salvo id/fecha/estado) | Transformación                          |
|-------------------------|-----------------------------------------------------|------------------------------------------|
| `id`                    | `actas.id`                                          | directo                                  |
| `fecha`                 | `actas.fecha`                                       | directo                                  |
| `estado`                | `actas.estado`                                      | directo                                  |
| `numero`                | `actas.numero`                                      | directo                                  |
| `hora` (rango)          | `metadata.horaInicio` + `metadata.horaFin`          | `${horaInicio} - ${horaFin}` o `—`       |
| `lugar`                 | `metadata.ciudad`                                   | directo                                  |
| `responsable`           | `metadata.preside`                                  | directo                                  |
| `tema` (subtítulo)      | `metadata.tema`                                     | directo                                  |
| `participantes` (nombres) | `metadata.participantes[].nombre`                 | map → `String[]`                         |
| `ordenDelDia`           | `metadata.ordenDia`                                 | directo                                  |
| `compromisos` (tabla)   | `metadata.desarrollo[]`                             | map → `{id, tema, responsable, fechaLimite, estado}` |

### Editor → bridge (escritura)

```javascript
{
  id: 'ACT-2025-12',  // generado si es nuevo
  empresaId: 'tempoactiva',
  numero: 11,
  fecha: '2025-12-01',
  estado: 'Cerrada',
  archivo: null,  // opcional
  metadata: {
    tema: 'Reunión de Seguimiento',
    preside: 'Sergina Orozco',
    ciudad: 'Sala de Juntas TEMPOSUM',
    horaInicio: '09:00',
    horaFin: '11:30',
    participantes: [
      { nombre: 'Sergina Orozco', cargo: 'Gerente', empresa: 'Tempoactiva', correo: '', telefono: '', presente: true }
    ],
    ordenDia: '1. ...\n2. ...',
    desarrollo: [
      { numero: 1, temaTratado: '...', compromiso: '...', responsable: '...', fecha: '2025-12-15', verificacion: '', estado: 'En proceso' }
    ]
  }
}
```

## Auto-import XLSX

Ya existe. `_autoImportXlsx()` corre al inicio si NO existe `G-FO-009.json`. Filtra archivos `GG-FO-009*.xlsx` y los parsea con `_parserGFO009`.

**Acción de prueba:** renombrar `G-FO-009.json` (si existiera) o vaciar tabla `actas` antes del primer arranque, para forzar el import desde el XLSX de 2017.

**Riesgo:** el parser asume layout fijo (filas 7-15 headers, 34-43 tabla). Si el XLSX real tiene otra estructura, fallará. Verificar al primer import.

## Empty state (sin actas)

```
🗒️  Sin actas registradas
Crea la primera acta de reunión conforme al formato G-FO-009.
[+ Crear primera acta]
```

## Plan de prueba

1. **Import:** renombrar/eliminar cualquier `G-FO-009.json`, reiniciar app, verificar que aparece 1 acta importada del XLSX de 2017.
2. **Vista:** confirmar que lista y detalle muestran los campos del XLSX real (no los del mock).
3. **Crear:** click "Nueva acta" → llenar formulario → guardar → aparece en la lista.
4. **Editar:** click "Editar acta" → modificar un campo → guardar → cambio persiste tras recargar.
5. **Empty state:** con tabla `actas` vacía y sin XLSX, verificar que se muestra el empty state.
6. **Persistencia:** reiniciar app y verificar que las actas creadas siguen ahí.

## Fuera de alcance

- Exportación XLSX desde la app (botón "Exportar" del mock → toast "Próximamente").
- Edición de campos de archivos adjuntos.
- Versionado / historial de cambios.
- Permisos por usuario sobre actas específicas.

## Riesgos

1. **Layout del XLSX 2017 puede no coincidir con el parser.** Mitigación: probar al primer import y ajustar `_parserGFO009` si es necesario.
2. **Forma de la tabla `desarrollo` es fija en el parser (10 filas).** El editor debe permitir agregar/quitar filas dinámicamente sin depender del parser.
3. **Botón "Exportar"** sigue mostrando toast hasta que se implemente la exportación G-FO-009 (fuera de alcance).
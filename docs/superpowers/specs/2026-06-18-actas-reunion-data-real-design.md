# Diseño: Actas de Reunión (G-FO-009) — Datos reales + Editor

**Fecha:** 2026-06-18 (actualizado 2026-06-19 con modelo semestral)
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

## Modelo de negocio (2 actas por año, mismo periodo que las revisiones)

El usuario aclaró que las actas NO son mensuales ni independientes, sino que siguen el **mismo periodo semestral que las revisiones gerenciales**. Por cada año se generan exactamente **2 actas**:

| Tipo | Cuándo se crea | Vincular con |
|---|---|---|
| **Principal** | Semestre 1 (Ene-Jun): reunión donde se firma la revisión gerencial del **periodo anterior** | Revisión G-FO-006 del año anterior |
| **Seguimiento** | Semestre 2 (Jul-Dic): primer seguimiento a mitad de año (~junio) | (Opcional) Acta principal del mismo año |

**Resultado:** 2 actas/año × N años = 2N actas.

### IDs generados

```
ACT-2025-S1       ← Principal 2025 (revisión del periodo 2024)
ACT-2025-S2-SEG   ← Seguimiento 2025
ACT-2026-S1       ← Principal 2026 (revisión del periodo 2025)
ACT-2026-S2-SEG   ← Seguimiento 2026
```

### Reglas de validación

1. **Una sola acta Principal por año** — si ya existe `ACT-YYYY-S1`, bloquear creación de otra Principal ese año.
2. **Una sola acta Seguimiento por año** — mismo principio.
3. **Seguimiento sin Principal** — permitido pero con warning (toast informativo).
4. **Si `tipo=Principal`, `revisionId` es obligatorio** y debe corresponder a una revisión del **año anterior**.

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
| `numero`                | `actas.numero`                                      | directo                                  |
| `fecha`                 | `actas.fecha`                                       | directo                                  |
| `estado`                | `actas.estado`                                      | directo                                  |
| `tipo`                  | `metadata.tipo`                                     | directo (`'Principal'` \| `'Seguimiento'`) |
| `año`                   | `metadata.año`                                      | directo (calculado de fecha si falta)    |
| `semestre`              | `metadata.semestre`                                 | directo (`1` \| `2`)                     |
| `revisionId`            | `metadata.revisionId`                               | directo (vínculo a revisión)             |
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
  id: 'ACT-2025-S1',          // generado si es nuevo: ACT-YYYY-S1 o ACT-YYYY-S2-SEG
  empresaId: 'tempoactiva',
  numero: 1,                  // 1 para Principal, 2 para Seguimiento
  fecha: '2025-06-15',
  estado: 'Cerrada',
  archivo: null,              // opcional
  metadata: {
    tipo: 'Principal',        // 'Principal' | 'Seguimiento'
    año: 2025,
    semestre: 1,              // 1 | 2
    revisionId: 'RG-2024-01', // solo si tipo=Principal
    tema: 'Revisión gerencial del periodo anterior',
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
📄  Sin actas registradas

El formato G-FO-009 se usa 2 veces por año para registrar las
reuniones gerenciales: 1 acta principal (con la revisión) y
1 acta de seguimiento.

[+ Crear primera acta]
```

## Plan de prueba

1. **Import XLSX:** renombrar/eliminar cualquier `G-FO-009.json`, reiniciar app, verificar que aparece 1 acta importada del XLSX de 2017 (tipo: Principal, año: 2017, semestre: 1).
2. **Vista agrupada:** confirmar que la lista agrupa por año y semestre (no por mes), y muestra el badge de tipo (`Principal` / `Seguimiento`).
3. **Crear Principal:** click "Nueva acta" → tipo Principal (default) → llenar formulario → vincular con revisión del año anterior → guardar → aparece en Semestre 1.
4. **Bloqueo de 2 Principales:** intentar crear otra Principal para el mismo año → toast de error "Ya existe el acta principal de YYYY".
5. **Crear Seguimiento:** cambiar tipo a Seguimiento → llenar formulario → guardar → aparece en Semestre 2.
6. **Seguimiento sin Principal:** eliminar la Principal → intentar crear Seguimiento → warning informativo "No hay acta principal de este año" pero permite continuar.
7. **Editar:** click "Editar acta" → modificar un campo → guardar → cambio persiste tras recargar.
8. **Persistencia:** reiniciar app y verificar que las actas creadas siguen ahí con su tipo/semestre correctos.
9. **Empty state:** con tabla `actas` vacía y sin XLSX, verificar que se muestra el empty state actualizado con la explicación semestral.

## Fuera de alcance

- Exportación XLSX desde la app (botón "Exportar" del mock → toast "Próximamente").
- Edición de campos de archivos adjuntos.
- Versionado / historial de cambios.
- Permisos por usuario sobre actas específicas.
- Múltiples actas de seguimiento por semestre (modelo actual: máximo 1 por semestre).

## Riesgos

1. **Layout del XLSX 2017 puede no coincidir con el parser.** Mitigación: probar al primer import y ajustar `_parserGFO009` si es necesario. Como el XLSX es de 2017, debería mapear a `ACT-2017-S1` (Principal).
2. **Forma de la tabla `desarrollo` es fija en el parser (10 filas).** El editor debe permitir agregar/quitar filas dinámicamente sin depender del parser.
3. **Botón "Exportar"** sigue mostrando toast hasta que se implemente la exportación G-FO-009 (fuera de alcance).
4. **El XLSX de 2017 no tiene campo `tipo`** — al importarlo, asumir Principal (es la única que existía en ese modelo mental). Si el usuario después crea Seguimientos, coexistirán.
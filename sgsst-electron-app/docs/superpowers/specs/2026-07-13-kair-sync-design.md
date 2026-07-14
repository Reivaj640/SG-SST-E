# K+AIR Sync Multi-PC — Design Spec

**Fecha:** 2026-07-13
**Autor:** brainstorming con el usuario (Prof. SST, K+AIR)
**Estado:** Borrador para revisión

---

## 1. Resumen

Implementar sincronización automática de la **información de una empresa específica** (planes, seguimientos, gestantes, ausentismo, eventos) entre múltiples PCs que tengan K+AIR instalado, usando una **carpeta de Google Drive** como "hub" de sincronización. Hoy cada PC tiene su propia BD SQLite local (`%APPDATA%\K+AIR\kair.db`) y son **islas independientes** — un seguimiento registrado en la PC del escritorio no se ve en las laptops ni en la PC del cliente, y viceversa.

### Contexto del usuario (validado)

- 1 escritorio + 2 laptops del admin (todas en su apartamento, ocasionalmente conectadas a la red del cliente cada ~15 días)
- 1 PC del cliente con usuario "gestión humana" que SOLO gestiona ausentismo por ahora
- Las 4 PCs tienen **Google Drive File Stream** instalado y la misma carpeta sincronizada
- Las 3 PCs del admin están casi siempre en LAN del apartamento; el cliente ocasionalmente

### Por qué este approach y no otros

- ❌ **Backend central (Node + Postgres)**: sobredimensionado para 4 PCs. Costo mensual, mantenimiento, internet obligatorio.
- ❌ **Mover el `kair.db` a Google Drive**: SQLite con WAL en red cloud **se corrompe** (confirmado por casos históricos en otros proyectos, además de v0.1.88 en este repo que ya documenta problemas de GDrive con archivos Office).
- ❌ **Carpeta compartida de red (LAN)**: si el admin lleva la laptop a la oficina del cliente cada 15 días, se rompe.
- ✅ **Sync por JSON + Google Drive File Stream**: simple, robusto, offline-first, sin servidor, gratis, ya tenés el cliente instalado.

---

## 2. Objetivos

- Que las 3 PCs del admin (escritorio + 2 laptops) **vean los mismos datos de la empresa del cliente** automáticamente.
- Que la PC del cliente (gestión humana) **sincronice su ausentismo** al hub y reciba los datos que el admin cargue (planes con sus seguimientos, gestantes, etc.).
- Que funcione **offline** sin conexión: cada PC sigue 100% funcional con su BD local; al reconectar, sincroniza.
- Que las 4 PCs puedan trabajar **simultáneamente** con resolución de conflictos razonable.
- Que la BD local SQLite **NO se toque** (riesgo de corrupción); se sincroniza solo la **empresa activa**, no la config ni usuarios ni otras empresas.

---

## 3. No-objetivos (out of scope v1)

- Sincronización entre **diferentes empresas** (cada empresa tiene su propio hub si el admin decide).
- Sincronización de **usuarios, roles, sesiones, config** (estos quedan locales por PC).
- Sincronización de **otras empresas** que el admin pueda tener cargadas (ej: si tiene 5 clientes, cada cliente-empresa es un sync independiente).
- Resolución de conflictos 3-way merge (last-write-wins por timestamp es suficiente para 4 PCs; merges complejos quedan para v2 si se necesitan).
- Sincronización con Google Calendar / Outlook / iCloud.
- Compresión/optimización del JSON (v1 manda JSON plain; si el bundle crece a >5MB se evalúa gzip en v2).
- Cifrado del hub (los datos del cliente quedan en una carpeta Drive que YA está cifrada por Google; cifrado adicional queda para v2 si se requiere).
- Sincronización de **archivos Excel grandes** abiertos por Office (riesgo de bloqueo de GDrive File Stream — ver §10).

---

## 4. Arquitectura

### 4.1 Vista general

```
┌──────────────────────────────────────────────────────────────────────┐
│  📁 Google Drive File Stream (carpeta compartida en las 4 PCs)        │
│  └── 📁 K+AIR Sync/                          ← raíz del hub            │
│      ├── 📁 <empresa-key>/                   ← 1 carpeta por empresa   │
│      │   ├── 📄 empresa.kairsync             ← JSON consolidado        │
│      │   ├── 📁 archivos/                    ← PDFs, Excels, etc.      │
│      │   │   ├── 📄 eval-min.pdf                                       │
│      │   │   └── 📄 matriz-2026.xlsx                                   │
│      │   └── 📁 .meta/                       ← metadata de sync        │
│      │       └── 📄 last-sync.json           ← timestamps por PC       │
│      └── 📁 <otra-empresa-key>/              ← si el admin tiene +1    │
└──────────────────────────────────────────────────────────────────────┘
        ▲                ▲                ▲                ▲
        │ pull+push      │ pull+push      │ pull+push      │ pull+push
   ┌────┴────┐     ┌─────┴────┐     ┌─────┴────┐     ┌─────┴────┐
   │Escritorio│    │ Laptop 1 │    │ Laptop 2 │    │ Cliente  │
   │(kair.db) │    │(kair.db) │    │(kair.db) │    │(kair.db) │
   └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### 4.2 Estructura de archivos (código)

```
sgsst-electron-app/
  main/
    sync-service.js                    ← NUEVO — orquestador de sync
    sync-bridge.js                     ← NUEVO — IPC handler
    sync-merge.js                      ← NUEVO — merge con last-write-wins
  shared/
    kair-sync.js                       ← NUEVO — cliente (renderer side)
  modules/
    shared/
      sync-config.js                   ← NUEVO — UI de configuración
  preload.js                           ← MODIFICADO — expone sync API
  main.js                              ← MODIFICADO — registra handler
  renderer.js                          ← MODIFICADO — trigger pull al init
  config.json                          ← MODIFICADO — campo sync por empresa
docs/superpowers/specs/
  2026-07-13-kair-sync-design.md       ← este documento
```

### 4.3 Patrón de componente

`sync-service.js` (main process) sigue el mismo patrón de los bridges existentes (`evaluacion-action-plans-bridge.js`): módulo CommonJS con `registerSyncHandlers(app, deps)` que recibe `getDb()` por inyección, expone IPC handlers, y mantiene estado privado.

`kair-sync.js` (renderer side) es IIFE con `window.KairSync.init(options)`, igual que `kair-calendar.js` o `kair-alerts.js`.

---

## 5. Formato `.kairsync` (contrato de datos)

### 5.1 Estructura del JSON

```json
{
  "version": 1,
  "companyKey": "cliente-xyz",
  "lastWriteAt": "2026-07-13T18:45:23.124Z",
  "lastWriter": {
    "pcId": "escritorio-jrf",
    "userName": "admin",
    "appVersion": "0.1.114"
  },
  "entities": {
    "planes_accion": [
      {
        "id": "uuid-...",
        "year": "2026",
        "source": "ministerio",
        "plan": { /* objeto plan completo (incluye seguimientos+responsables) */ },
        "updatedAt": "2026-07-13T18:45:23.124Z"
      }
    ],
    "gestaciones": [
      {
        "id": "uuid-...",
        "gestante": { /* objeto gestante */ },
        "seguimientos": [ /* array de seguimientos */ ],
        "updatedAt": "2026-07-13T18:45:23.124Z"
      }
    ],
    "eventos_cumplidos": [ ... ],
    "eventos_rapidos": [ ... ],
    "ausentismo": [ ... ]
  }
}
```

### 5.2 Reglas del contrato

- **version**: entero, hoy `1`. Cambia si hay breaking change en la forma del JSON.
- **lastWriteAt**: ISO timestamp del último writer. Es la "verdad" para resolver conflictos.
- **lastWriter.pcId**: identificador único por PC (generado en primer arranque, guardado en config). Permite saber quién escribió último.
- **entities**: cada array contiene TODOS los registros de ese tipo para la empresa (no diffs). Pequeño para empresa típica (<1MB); aceptable.
- **updatedAt por registro**: cada entidad lleva su propio timestamp. Es el que se usa para last-write-wins POR REGISTRO (no por archivo entero).

### 5.3 Lo que NO se mete en el .kairsync

- Usuarios, roles, sesiones (locales)
- Configuración de UI (local)
- Otras empresas (van a su propio hub)
- Tokens, passwords (nunca)
- Logs (locales)

---

## 6. Resolución de conflictos

### 6.1 Last-write-wins por registro (estrategia principal)

Cuando llega un pull del hub y el `.kairsync` remoto tiene `lastWriteAt` MAYOR que el local:

1. Por cada registro en `entities.planes_accion[]`, comparar `updatedAt` con el registro local (buscar por `id`).
2. Si remoto.updatedAt > local.updatedAt → **sobrescribir local** con remoto.
3. Si remoto.updatedAt < local.updatedAt → **mantener local** (subir al hub).
4. Si remoto.updatedAt === local.updatedAt → **idempotente**, no hacer nada.
5. Si el registro existe en remoto pero no en local → **insertar**.
6. Si el registro existe en local pero no en remoto → **mantener** (probablemente es más nuevo).
7. Al final del merge, recalcular `lastWriteAt` del archivo y subir.

### 6.2 Manejo de "Conflicto de copia" de Google Drive

Google Drive File Stream genera archivos `empresa (Conflicto de copia 2026-07-13 18-45-23).kairsync` cuando detecta modificación concurrente. El SyncService debe:

1. **Detectar** el archivo "Conflicto de copia" al hacer pull.
2. **Leer AMBOS** archivos (el original y el conflicto).
3. **Hacer merge registro por registro** (last-write-wins por `updatedAt`).
4. **Escribir** el resultado consolidado al `empresa.kairsync` (sobreescribiendo).
5. **Borrar** el archivo "Conflicto de copia" (con `shell.trashItem` — método correcto Electron 10+, aprendido en v0.1.88).
6. **Loggear** el evento con warning.

### 6.3 Merge de archivos (carpeta `archivos/`)

Los archivos de la empresa (PDFs, Excels) son **binarios opacos** — no se mergean. Estrategia:

- Cada PC registra en `last-sync.json` los archivos que tiene localmente (hash + nombre).
- Al hacer pull, comparar con la lista del hub. Si un archivo está en el hub pero no local → descargar. Si está local pero no en el hub → subir. Si está en ambos con hashes distintos → **gana el más reciente** (por mtime del archivo en cada PC, embedded en `last-sync.json`).
- **NO** sincronizar archivos Excel que estén siendo editados en Office (verificar lock de Windows, misma estrategia que v0.1.88).

---

## 7. Trigger de sync

### 7.1 Pull (descargar del hub)

- **Al iniciar la app** (después del login + selección de empresa): pull completo.
- **Cada 5 minutos en background** (configurable): pull delta (solo descargar si `lastWriteAt` remoto > local).
- **Al volver de background** (app recupera foco): pull delta.
- **Botón manual "Sincronizar ahora"** en Configuración.

### 7.2 Push (subir al hub)

- **Inmediato después** de cualquier mutación de una entidad sincronizable (después de `_persistActionPlan`, `saveActionPlan`, `saveFollowUp`, etc.).
- **Debounced 2 segundos** si hay varias mutaciones rápidas (evitar spamear GDrive).
- **Al cerrar la app** (best-effort, no bloqueante): push final.

### 7.3 Exclusión por permisos (importante para PC del cliente)

El usuario "gestión humana" del cliente:
- ✅ PUEDE sincronizar ausentismo (es su módulo principal)
- ✅ PUEDE sincronizar planes de acción (puede ver el plan)
- ❌ NO debe sincronizar configuración sensible del admin
- La UI filtra qué entidades están disponibles para el rol del usuario

---

## 8. Configuración

### 8.1 Por empresa (en `config.json`)

```json
{
  "companies": [
    {
      "key": "cliente-xyz",
      "displayName": "Cliente XYZ S.A.S.",
      "sync": {
        "enabled": true,
        "hubPath": "G:/Mi unidad/K+AIR Sync/cliente-xyz",
        "pcId": "escritorio-jrf",
        "userName": "admin",
        "intervalMinutes": 5,
        "autoSync": true
      }
    }
  ]
}
```

### 8.2 Por PC (generado en primer arranque)

`pcId` = hash corto del hostname + sufijo random. Se guarda en `config.json` la primera vez que la app arranca en esa PC. Ej: `escritorio-jrf-7a3f`.

### 8.3 UI de Configuración

Nueva sección en la pantalla de Configuración existente:

```
┌─ Sincronización ─────────────────────────────────────┐
│ Empresa: Cliente XYZ S.A.S.                            │
│ Hub: G:/Mi unidad/K+AIR Sync/cliente-xyz [Cambiar]    │
│ Estado: ✅ Sincronizado hace 2 minutos                 │
│ PC: escritorio-jrf-7a3f (admin)                       │
│                                                        │
│ [Sincronizar ahora]  [Pausar sync]  [Ver log]        │
│                                                        │
│ Últimas operaciones:                                   │
│ • 18:45  Pull: 2 planes, 1 gestación actualizada      │
│ • 18:42  Push: nuevo seguimiento plan #abc            │
│ • 18:30  Pull: conflicto de copia resuelto (3 regs)   │
└────────────────────────────────────────────────────────┘
```

---

## 9. Manejo de errores

| Escenario | Comportamiento |
|---|---|
| Google Drive no está disponible (Drive File Stream caído) | Sync se SKIP. Log warning. Toast NO molesto. Reintento en próximo tick. |
| Hub path no existe (carpeta no creada aún) | Primera vez: crear la carpeta vacía. Si falla, toast de error con instrucciones. |
| Archivo .kairsync corrupto (JSON inválido) | Mover a `.kairsync.bak` + log error. Puller no rompe, solo no sincroniza. Toast al admin. |
| Permiso denegado al escribir hub | Log error. Toast: "Google Drive bloqueó la escritura, reintentando en 1 min". |
| Conflicto de copia detectado | Merge automático (ver §6.2). Log info. |
| 2 PCs modifican MISMO plan a la vez | Last-write-wins por registro. El que tenga `updatedAt` mayor gana. El "perdedor" lo ve en su próximo pull (su cambio local se sobreescribe por el remoto más nuevo). |
| Archivo Excel bloqueado por Office | Skip con warning (mismo patrón v0.1.88). Reintento en próximo sync. |
| PC del cliente sin internet por días | Cuando vuelva internet, pull completo. Si hay conflictos con cambios del admin, last-write-wins. |
| Espacio en Drive lleno | Detectar antes de push, log error, toast actionable. |

---

## 10. Riesgos conocidos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Google Drive File Stream bloquea archivos grandes** (caso v0.1.88 con Excel) | NO sincronizamos `kair.db` directamente, solo JSON liviano (<1MB típico) + archivos sueltos con reintentos (patrón v0.1.88). |
| **Conflicto de copia de GDrive** | Manejo explícito en §6.2. |
| **SQLite local queda atrás de la realidad** | El SyncService escribe directo a la BD via los mismos handlers IPC que usa el módulo. Garantiza consistencia. |
| **PC del cliente con internet lento/inestable** | Sync es delta, no full. Si el JSON pesa 500KB, sube rápido incluso en 3G. |
| **Admin tiene 2GB de archivos de empresa** | La carpeta `archivos/` puede ser grande. Sincronización de archivos es opcional (toggle en config) y puede ser desactivada. |
| **Cambio de esquema futuro en .kairsync** | Campo `version` permite detectar y migrar. Migraciones se documentan en este spec. |
| **Crecimiento futuro a 10+ PCs** | El approach escala bien (last-write-wins funciona). Si llega a ser problema, se evalúa migrar a backend central (D de la conversación inicial). |

---

## 11. Plan de implementación (commits)

### 📦536 — Spec + helper de serialización (no-funcional)

- Este spec queda en `docs/superpowers/specs/`
- Crear `main/sync-serializer.js` con funciones `serializeEmpresaToSync(db, companyKey)` y `deserializeSyncToDb(db, syncData, mergeStrategy)`. Sin IPC, sin UI, solo el contrato de datos.
- Test manual con un JSON de ejemplo.
- **No toca la app en producción**. Es la base.

### 📦537 — SyncService en main process

- Crear `main/sync-service.js` con orquestador: `pull(empresaId)`, `push(empresaId)`, `mergeConflictFiles(empresaId)`, manejo de errores §9.
- Crear `main/sync-bridge.js` con 4 handlers IPC: `sync:pull`, `sync:push`, `sync:status`, `sync:configure`.
- Modificar `main.js`: registrar handlers después de los existentes (~línea 8780).
- Modificar `preload.js`: exponer `electronAPI.sync.{pull,push,status,configure}`.
- **Sigue sin integración con la app** — los IPC están listos pero nadie los llama.

### 📦538 — Integración con los bridges existentes

- Modificar `evaluacion-action-plans-bridge.js`: después de guardar un plan, trigger push async (debounced 2s).
- Modificar `gestacion-bridge.js`: mismo patrón.
- Modificar `eventos-cumplidos-bridge.js`, `eventos-rapidos-bridge.js`: mismo patrón.
- Modificar `medicion-ausentismo` o bridge equivalente de ausentismo: mismo patrón.
- Modificar `renderer.js`: trigger pull al seleccionar empresa (`selectCompany` línea ~2922), trigger pull al recuperar foco.
- Modificar `config.json`: agregar `sync` por empresa (estructura §8.1).
- Modificar bootstrap de la app: generar `pcId` si no existe en config.

### 📦539 — UI de Sincronización

- Crear `modules/shared/sync-config.js` (IIFE con `window.KairSyncConfig.mount(container, options)`).
- Modificar pantalla de Configuración existente para incluir la nueva sección (§8.3).
- Botones: "Sincronizar ahora", "Pausar sync", "Ver log", "Cambiar hub".
- Indicador visual de estado en el header (icono sutil con tooltip "Última sync: hace 2 min").
- Documentación en `docs/03-guias/sincronizacion-multipc.md`.

**Estimación total:** ~1200-1500 líneas nuevas, 4 commits, ~3-4 horas de trabajo.

---

## 12. Cómo se prueba (acceptance criteria)

### 📦536 (no-funcional)
- [ ] `node --check main/sync-serializer.js` exit 0
- [ ] Serializar una empresa de prueba genera JSON con la estructura de §5.1
- [ ] Deserializar hace merge correcto con un JSON de prueba

### 📦537
- [ ] Los 4 handlers IPC se registran sin error
- [ ] `sync:status` devuelve estado actual (enabled, lastSync, etc.)
- [ ] Pull manual contra un hub de prueba trae datos
- [ ] Push manual sube datos al hub
- [ ] Detección de "Conflicto de copia" funciona (crear uno manual y verificar)

### 📦538
- [ ] Guardar un plan en PC1 → en 10s, PC2 ve el plan al hacer pull
- [ ] Registrar gestante en PC del cliente → en 10s, admin la ve en su escritorio
- [ ] Funciona offline: cerrar internet en PC1, guardar 3 seguimientos, abrir internet, sync automático en 5 min
- [ ] Conflicto 2-way: editar mismo plan en PC1 y PC2 simultáneamente → last-write-wins funciona

### 📦539
- [ ] Sección de sync aparece en Configuración
- [ ] Botón "Sincronizar ahora" funciona y muestra log
- [ ] Indicador de última sync en el header
- [ ] Cambio de hub path funciona sin reinstalar

---

## 13. Preguntas abiertas para revisar antes de aprobar

1. **¿Path del hub por defecto?** Sugerencia: `<Google Drive>/K+AIR Sync/<empresa-key>/`. ¿Te sirve o querés otro path?
2. **¿Auto-sync activado por defecto o pide confirmación al primer arranque?** Sugerencia: activado por defecto, con un toast "Sincronización activada" + link a Configuración.
3. **¿El campo `pcId` se muestra al usuario en algún lado?** Sugerencia: sí, en Configuración para que el admin sepa distinguir sus PCs.
4. **¿Querés que se sincronice también la lista de empleados** (BD de personal) o solo las entidades mencionadas? v1 deja empleados fuera por simplicidad; se evalúa en v2.
5. **¿Manejamos retención de backups del .kairsync?** Sugerencia: guardar las últimas 5 versiones en `.kairsync.bak.{timestamp}` para recuperación.

---

**Próximos pasos:**
1. Revisás este spec y decís si hay ajustes.
2. Una vez aprobado, escribo el plan de implementación en `docs/superpowers/plans/2026-07-13-kair-sync.md`.
3. Arrancamos con el 📦536.

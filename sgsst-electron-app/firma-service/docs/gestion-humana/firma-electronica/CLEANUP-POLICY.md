# Política de limpieza de Sign Requests

> **Estado**: documento vivo. Define cómo se gestionan los Sign Requests que, por motivos operativos o de pruebas, requieren ser marcados como cancelados sin destruir la evidencia asociada.

> **Marco normativo**: Ley 527/1999, Decreto 2364/2012, Decreto 526/2021, Decreto 1072/2015 (arts. 2.2.1.1.8-13), Ley 1581/2012. Pendiente de validación jurídica externa antes de uso en producción con trabajadores reales.

---

## 1. Principio general

**Nunca se destruye evidencia. Se marca.**

Un Sign Request, una vez creado, conserva su registro, sus eventos y sus artefactos físicos (PDF original) durante todo el plazo de retención documental. La "limpieza" significa **cambiar el estado** del registro a uno terminal y **registrar un evento de auditoría** con la justificación. Nunca se ejecuta `DELETE` sobre un Sign Request como parte de una limpieza operativa o técnica.

El único caso en que se contempla destrucción de un Sign Request es por **decisión humana explícita y documentada**, fuera del alcance de esta política, y siempre después de validación jurídica externa.

## 2. Alcance

Esta política aplica a Sign Requests de `gh_firmas_electronicas` que:

- Tienen un `agreement_hash` que no corresponde a ninguna versión activa de `gh_firma_acuerdo_versiones` (es decir, son **huérfanos** del Acuerdo).
- Presentan características de artefactos de prueba: documento con nombre placeholder (`doc-0`, `doc-1`, `CONTRATO-TEMPOACTIVA-001`, etc.), cédula placeholder (`1234567890`), PDF sin contenido significativo, eventos mínimos (solo `CREATED`), creación en ráfaga temporal.

No aplica a Sign Requests con:
- Cédulas reales (no placeholder).
- Nombres de documento semánticos con valor contractual.
- Actividad real del firmante (más allá del evento `CREATED`).
- PDF con contenido (>200 bytes, contiene texto, etc.).
- Estados `OPENED`, `IDENTIFIED`, `OTP_SENT`, `OTP_VERIFIED`, `DOCUMENT_VIEWED`, `SIGNED`, `REJECTED`, `EXPIRED`, `OTP_LOCKED`.

## 3. Política por estado

| Estado | Política | Justificación |
|---|---|---|
| `PENDING` claramente generado por tests | **CANCELLED** permitido | Sin intento de firma. Riesgo legal bajo. PDF y eventos se preservan. |
| `PENDING` con datos plausibles | **PRESERVAR** | No se puede distinguir de solicitud real. Conservar hasta validación. |
| `OPENED` | **PRESERVAR** | Hay prueba de acceso. Conservar para auditoría. |
| `IDENTIFIED` | **PRESERVAR** | Cédula cotejada. Prueba de verificación de identidad. |
| `OTP_SENT` | **PRESERVAR** | Segundo factor despachado. Evidencia de intento de autenticación. |
| `OTP_VERIFIED` | **PRESERVAR obligatorio** | MFA completada. Borrar es **destrucción de prueba legal** (Ley 527/1999 art. 6, Decreto 2364/2012 art. 3). |
| `DOCUMENT_OPENED` | **PRESERVAR** | Carga del visor PDF. Evidencia de acceso al contenido. |
| `DOCUMENT_VIEWED` | **PRESERVAR** | Scroll al final. Manifestación implícita de lectura. |
| `MANIFESTATION_RECORDED` | **PRESERVAR** | Aceptación del texto de voluntad. |
| `SIGNED` | **PRESERVAR absoluto** | Firma legalmente válida. Plazo de retención mínimo 10 años (pendiente validación jurídica). Artefactos físicos (`pdf_firmado_path`, `constancia_path`). |
| `REJECTED` | **PRESERVAR** | Decisión explícita del firmante, con `motivo_rechazo`. |
| `EXPIRED` | **PRESERVAR** | La solicitud fue emitida; el sistema intentó presentarla. |
| `REVOKED` | **PRESERVAR** | Decisión de RH, con `motivo_revocacion` poblado. |
| `CANCELLED` | **PRESERVAR** | Estado terminal usado por esta política. |
| `OTP_LOCKED` | **PRESERVAR** | Indicio de intento de fuerza bruta. Evidencia de seguridad. |

## 4. Reglas duras

Las siguientes reglas son **inviolables** y no admiten excepción sin validación jurídica externa:

1. **`DELETE FROM gh_firmas_electronicas` está PROHIBIDO** como parte de cualquier limpieza operativa o técnica.
2. **`OTP_VERIFIED` nunca se elimina ni se cancela automáticamente.** Es el estado más sensible del modelo y requiere decisión humana caso por caso.
3. **`SIGNED` nunca se toca**, ni se modifica, ni se cancela, bajo ninguna circunstancia operativa.
4. **Los PDFs en `storage/pdfs/` nunca se eliminan** por un script de limpieza. Solo cambia el estado del registro.
5. **Los eventos de `gh_firma_eventos` son append-only.** Un cleanup solo añade eventos, nunca modifica ni borra los existentes.
6. **`gh_firma_sesiones`, `gh_consentimientos_firma` y `gh_firma_acuerdo_versiones` no se tocan** durante un cleanup.

## 5. Procedimiento operativo

### 5.1 Identificación de candidatos

La identificación de Sign Requests a cancelar debe hacerse mediante **lista explícita de `id_solicitud`**, no mediante condiciones genéricas sobre `agreement_hash` u otros campos.

Ejemplo de lista explícita:
```js
const TARGET_IDS = [
  'SIGN-2026-702349',
  'SIGN-2026-531707',
];

// EXPLÍCITAMENTE excluidos (no tocar):
// - SIGN-2026-823506: estado=OTP_VERIFIED, MFA completa, política=PRESERVAR
```

### 5.2 Validación de criterios

Antes de modificar un Sign Request, el script debe verificar que cumple **todos** los criterios esperados:

- `estado = 'PENDING'`.
- Número de eventos en `gh_firma_eventos` igual a 1.
- El único evento es `CREATED` con `id_actor = 'rh:system'`.
- `agreement_hash = 'aaaa...aaaa'` (placeholder, 64 caracteres `'a'`).
- `metadata` es NULL o contiene solo campos placeholder.
- El PDF en `storage/pdfs/originales/{id}.pdf` existe y pesa <200 bytes (PDF dummy).

Si **cualquiera** falla para un id, el script aborta **sin tocar nada** y reporta.

### 5.3 Backup

Antes de cualquier escritura:

1. Crear `data/backup/pre-cleanup-<timestamp>.sqlite` con copia de la BD.
2. Calcular SHA-256 del original y del backup.
3. Verificar que coincidan.
4. Si no coinciden, abortar inmediatamente y eliminar el backup corrupto.

### 5.4 Cancelación

En una transacción atómica (`db.transaction()` de better-sqlite3), para cada id validado:

```sql
-- Verificar una vez más que el estado sigue siendo PENDING
UPDATE gh_firmas_electronicas
   SET estado = 'CANCELLED'
 WHERE id_solicitud = ?  -- el id específico
   AND estado = 'PENDING';  -- defensa adicional

INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, id_actor, metadata)
VALUES (?, 'CANCELLED', datetime('now'), 'rh:cleanup-script', ?);
```

Si la transacción falla por cualquier razón, `better-sqlite3` hace rollback automático. La BD queda en su estado original.

### 5.5 Verificación post-ejecución

Después de la cancelación:

1. Confirmar que el número de filas actualizadas es exactamente igual al número de ids esperados.
2. Confirmar que cada `id_solicitud` ahora tiene `estado = 'CANCELLED'`.
3. Confirmar que cada id tiene un nuevo evento `CANCELLED` en `gh_firma_eventos` con `id_actor = 'rh:cleanup-script'`.
4. Confirmar que los PDFs en disco siguen existiendo.
5. Confirmar que ningún otro registro fue tocado (especialmente los excluidos).
6. Confirmar que `gh_firma_sesiones`, `gh_consentimientos_firma`, `gh_firma_acuerdo_versiones` no cambiaron.

## 6. Defensas del script

El script `scripts/cleanup-orphan-sign-requests.js` implementa las siguientes defensas:

| Defensa | Mecanismo | Salida si falla |
|---|---|---|
| Modo `--dry-run` por defecto | Flag `--yes` obligatorio para escritura | Mensaje claro + exit 0 sin tocar nada |
| Hard-block producción | `NODE_ENV === 'production'` aborta inmediatamente | exit 1 con mensaje |
| Idempotencia | Si un id ya está en `CANCELLED`, se salta con aviso | No hace doble cancelación |
| Validación por registro | Criterios estrictos por id antes de modificar | exit 2, ningún cambio |
| Backup + checksum | SHA-256 del backup debe coincidir con la BD original | exit 3, backup eliminado |
| Transacción atómica | `db.transaction()` de better-sqlite3 | Rollback automático |
| Verificación post | Comprueba filas actualizadas y eventos insertados | exit 4 si no coincide |
| Exclusión explícita | Lista de IDs excluidos verificada antes de cualquier cambio | Mensaje claro en dry-run, no tocados en ejecución |
| PDFs preservados | El script no llama `unlink` ni `rm` sobre storage | Confirmación post-ejecución |
| Output JSON opcional | Flag `--json` para integraciones | No afecta comportamiento |

## 7. Caso de uso: limpieza pre-v1.1 (3 huérfanos identificados)

**Fecha de identificación**: 2026-08-18
**Origen**: artefactos creados durante pruebas manuales y de la suite de tests contra `data/firma.sqlite`.

| `id_solicitud` | Estado | Eventos | PDF | Política |
|---|---|---|---|---|
| `SIGN-2026-702349` | `PENDING` | 1 (`CREATED`) | 77 bytes (dummy) | **CANCELLED** |
| `SIGN-2026-531707` | `PENDING` | 1 (`CREATED`) | 77 bytes (dummy) | **CANCELLED** |
| `SIGN-2026-823506` | `OTP_VERIFIED` | 16 (MFA completa) | 2113 bytes (real) | **PRESERVAR** |

### 7.1 Evidencia de `SIGN-2026-823506` (preservar)

- Cédula `79123456` cotejada con éxito 4 veces.
- 4 OTPs generados y verificados al primer intento.
- 16 eventos en `gh_firma_eventos` con 70 minutos de actividad.
- `metadata` contiene correo real `adminkair@gmail.com` (no placeholder).
- `id_documento = 'CONTRATO-TEMPOACTIVA-001'` (no es placeholder).
- PDF de 2113 bytes con contenido.
- Estado `OTP_VERIFIED` con MFA completada.

**Conclusión**: es una sesión real de prueba manual. NO es artefacto de test automatizado. La política es **PRESERVAR**.

### 7.2 Evidencia de los 2 PENDING (candidatos a cancelar)

- Cédula `1234567890` (placeholder de `tests/helpers.js`).
- `id_documento = 'doc-0'` y `'doc-1'` (placeholders literales).
- Mismo SHA-256 entre ambos PDFs.
- 77 bytes, PDF estructuralmente válido pero sin contenido (solo `/Catalog` y `%%EOF`).
- Mismo `document_hash_original = 68d3dbe2...`.
- Creados con 6 ms de diferencia (mismo bucle).
- Único evento: `CREATED`.

**Conclusión**: son artefactos de tests. La política es **CANCELLED**.

## 8. Auditoría de la propia limpieza

Toda ejecución del script de limpieza debe quedar registrada con:

- `id_actor = 'rh:cleanup-script'` en el evento `CANCELLED`.
- `metadata` del evento con: motivo, script, script_version, kair_version, criterios validados, ejecutor.
- Backup de la BD previo a la cancelación.
- Output del script (en logs o archivo).

## 9. Cambios futuros

Cualquier cambio a esta política (nuevos estados terminales, nuevas defensas, nuevos criterios) debe:

1. Discutirse antes de implementación.
2. Actualizar este documento en el mismo commit que el cambio.
3. Mantener compatibilidad con el script existente.
4. Documentarse en `docs/gestion-humana/firma-electronica/CHANGELOG.md` (a crear si no existe).

## 10. Referencias

- `docs/gestion-humana/firma-electronica/DATA_MODEL.md` — modelo de datos.
- `docs/gestion-humana/firma-electronica/API.md` — endpoints (incluye los no implementados).
- `scripts/cleanup-orphan-sign-requests.js` — implementación.
- `tests/scripts/cleanup-orphan-sign-requests.test.js` — tests aislados.
- Marco legal colombiano (Ley 527/1999, Decreto 2364/2012, Decreto 526/2021, Decreto 1072/2015 arts. 2.2.1.1.8-13, Ley 1581/2012).

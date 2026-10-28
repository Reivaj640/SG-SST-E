-- =============================================================================
-- Migración 046: la cola de purgas que alcanza a los RESPALDOS (numeral 8.7)
-- =============================================================================
-- Esta migración es ADITIVA (no breaking para datos existentes).
--
-- EL PROBLEMA QUE RESUELVE
-- -------------------------
-- El numeral 8.6 del Acuerdo de uso manda suprimir el dato cuando se vence el
-- plazo de conservación. El 8.7 dice que esa supresión ALCANZA A LOS RESPALDOS
-- dentro del plazo allí previsto.
--
-- El código NO cumplía esa promesa: `deploy/backup-firma.sh` guardaba la copia
-- de la base y el tarball de los PDF SIN CIFRAR y los podaba por EDAD
-- (`find ... -mtime +30 -delete`). Eso borra el ARCHIVO de respaldo entero a
-- los 30 días; NO borra el REGISTRO suprimido de los respaldos que siguen
-- existiendo. Un dato suprimido hoy seguía presente, en claro, en el
-- respaldo de ayer y en el de hace 29 días.
--
-- Lo que hace esta migración es darle al SERVICIO una forma de dejar
-- constancia de lo que suprimió, para que un proceso con privilegios
-- (root, que es el único que puede descifrar y re-cifrar las copias) pueda
-- aplicar la misma supresión A NIVEL DE REGISTRO sobre cada copia que sigue
-- existiendo.
--
-- POR QUÉ UNA TABLA Y NO UN ARCHIVO JSON
-- --------------------------------------
-- El servicio corre como `kairfirma` (sin privilegios de root) y el script
-- `deploy/purgar-respaldos.sh` corre como root. Las dos opciones eran:
--
--   (a) una fila en esta tabla, escrita DENTRO de la misma transacción en que
--       el servicio suprime la fila de la firma;
--   (b) un archivo JSON en un directorio que el servicio puede escribir.
--
-- Se elige (a) por una razón concreta: la escritura del archivo quedaría
-- FUERA de la transacción de la base. Una caída entre el COMMIT (la fila ya
-- está borrada) y la escritura del archivo (la solicitud de purga) dejaría el
-- dato suprimido en los respaldos PARA SIEMPRE, y en silencio. Ese es
-- justamente el bug que esta migración viene a cerrar: no conviene repetirlo
-- un nivel más abajo. Con la tabla, o se borra la fila y queda la solicitud,
-- o no se borra nada.
--
-- Además, la tabla deja un lugar donde queda la constancia de que la purga
-- se aplicó a las copias (`estado`, `aplicada_at`, `detalle`) y donde el
-- servicio puede preguntar "¿queda algo por purgar en los respaldos?".
--
-- EL CONTRATO CON EL SERVICIO
-- ---------------------------
-- `src/services/supresion.js` escribe UNA fila por firma suprimida, dentro de
-- la transacción que ya borra la fila de la firma:
--
--   INSERT INTO gh_firma_purgas_pendientes
--     (firma_id, id_empresa, id_solicitud, categorias, archivos,
--      purgado_at, actor, motivo)
--   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
--
--   - firma_id     : el id de la fila suprimida (el que usa la copia del
--                    respaldo: los ids son los mismos en la copia).
--   - id_empresa   : la empresa, sin dato personal.
--   - id_solicitud : el identificador de la solicitud (lo usa la lápida y el
--                    recibo; no es un dato personal).
--   - categorias   : JSON con las categorías de dato suprimidas (las mismas
--                    de CATEGORIAS_DATOS en supresion.js).
--   - archivos     : JSON con las rutas de los archivos que salieron del
--                    storage, RELATIVAS a la raíz del servicio
--                    (por ejemplo `storage/pdfs/firmados/SIGN-2026-000123.pdf`).
--                    Son las rutas exactas que el tarball de storage guarda
--                    como miembros (`tar -C /opt/kair-firma ... storage`), así
--                    que el script puede sacarlas del tar sin adivinar.
--                    NUNCA una ruta absoluta: el tar no las tiene.
--   - purgado_at   : el momento de la supresión (ISO-8601).
--   - actor, motivo : los mismos que quedan en la lápida.
--
-- Por qué NO hay triggers append-only como en las demás tablas de evidencia:
-- esta tabla es una COLA, no un registro de evidencia. El script de purga
-- (root) tiene que poder marcar cada solicitud como aplicada; si la tabla
-- fuera append-only, la fila se quedaría 'pendiente' para siempre y la cola
-- crecería sin control. La evidencia de la purga vive en otros sitios:
-- la lápida (`gh_firma_purgadas`), el recibo (`gh_firma_purga_registro`) y el
-- log de `purgar-respaldos.sh` (qué copia se tocó, qué se suprimió y el
-- hash del resultado).
-- =============================================================================

CREATE TABLE IF NOT EXISTS gh_firma_purgas_pendientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- La firma cuya fila se suprimió en la base viva. En una copia de respaldo
  -- es el mismo id: el script usa este número para borrar la fila.
  firma_id INTEGER NOT NULL,
  id_empresa TEXT,
  id_solicitud TEXT,
  -- JSON con las categorías de dato suprimidas (fila_firma, pdf_original, ...).
  categorias TEXT NOT NULL DEFAULT '[]',
  -- JSON con las rutas RELATIVAS a la raíz del servicio de los archivos que
  -- salieron del storage. El script las saca del tarball de storage.
  archivos TEXT NOT NULL DEFAULT '[]',
  -- Cuándo lo suprimió el servicio.
  purgado_at TEXT NOT NULL,
  -- QUIÉN y POR QUÉ, igual que en la lápida y en el recibo.
  actor TEXT NOT NULL,
  motivo TEXT NOT NULL,
  -- 'pendiente' = todavía no se aplicó a todas las copias que existen.
  -- 'aplicada'   = ya se aplicó a nivel de registro en las copias existentes.
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aplicada')),
  -- Cuándo la marcó el script de purga y con qué resultado.
  aplicada_at TEXT,
  detalle TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- El script de purga lee las pendientes y el servicio puede listarlas.
CREATE INDEX IF NOT EXISTS idx_purgas_respaldo_estado
  ON gh_firma_purgas_pendientes(estado, id);

CREATE INDEX IF NOT EXISTS idx_purgas_respaldo_firma
  ON gh_firma_purgas_pendientes(firma_id);

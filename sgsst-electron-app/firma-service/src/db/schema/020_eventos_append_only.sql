-- @skip-when-env test
-- =============================================================================
-- Migración 020: el registro de auditoría es inalterable, salvo dentro de una
--                ventana de purga gobernada
-- =============================================================================
--
-- Esta migración es ADITIVA (no breaking para datos existentes).
--
-- PROBLEMA QUE RESUELVE
-- ---------------------
-- El numeral 3.6(g) del Acuerdo de uso dice:
--
--   "g) El registro de auditoría de los eventos del proceso de firma, que no
--    puede ser alterado ni eliminado una vez registrado."
--
-- La tabla `gh_firma_eventos` no tenía NINGUNA protección: el código de la
-- aplicación nunca modificaba ni borraba eventos, pero cualquier UPDATE o
-- DELETE directo sobre la base de datos (un bug, una migración mal escrita,
-- un acceso con la llave del archivo) pasaba desapercibido. El texto promete
-- una garantía que la base de datos no hacía cumplir.
--
-- Y al revés: los numerales 8.6 y 10.6 obligan a suprimir el dato una vez
-- vencido su plazo y sin deber legal de conservación. Sin una vía legítima
-- para hacerlo, la promesa del 3.6(g) y la del 8.6 son incompatibles: o la
-- base de datos miente sobre la inalterabilidad, o nunca se puede cumplir el
-- deber de supresión.
--
-- DECISIÓN
-- --------
-- La inalterabilidad es el PISO, no una excepción que se abre a diario. Se
-- mantiene con dos triggers de SQLite que abortan la operación:
--
--   BEFORE UPDATE ON gh_firma_eventos -> RAISE(ABORT)
--   BEFORE DELETE ON gh_firma_eventos -> RAISE(ABORT)
--
-- Es la forma más barata y más difícil de evadir: la garantía vive en la
-- base de datos, no en el código de aplicación. Si mañana alguien escribe
-- `DELETE FROM gh_firma_eventos` en un script de mantenimiento, la base de
-- datos lo rechaza.
--
-- LAS CINCO CONDICIONES DE LA EXCEPCIÓN
-- ------------------------------------
-- La aborta tiene UNA excepción, y la excepción tiene cinco condiciones. Las
-- cinco las hace cumplir ESTA base de datos, no el código de la aplicación:
--
--   1. VENTANA. Alguien abrió una ventana de purga: queda registrado quién
--      la abre, por qué y hasta cuándo. La ventana tiene fecha de cierre: sola,
--      se vence.
--   2. LOTE. La firma está en el lote habilitado para esa ventana. Solo se
--      pueden añadir firmas al lote mientras hay una ventana abierta (trigger
--      propio sobre la tabla del lote).
--   3. PLAZO VENCIDO. La firma tiene fecha de conservación y esa fecha ya
--      pasó. "Sin plazo declarado" NO habilita nada: no se puede borrar antes
--      de tiempo lo que todavía no venció.
--   4. SIN DEBER LEGAL. La firma NO tiene un hold legal activo. El 8.6 y el
--      10.6 dicen "sin que exista un deber legal o contractual de
--      conservación": el hold es la forma operativa de ese deber (una
--      reclamación, un proceso judicial, un requerimiento de una autoridad).
--      Con hold activo, la base de datos se niega, aunque haya ventana y lote.
--   5. (la condición de la ventana, ya incluida en el punto 1)
--
-- Faltando CUALQUIERA de ellas, el trigger aborta. La ventana sola no
-- habilita; el lote solo tampoco; y el hold es la condición que impide
-- destruir la prueba de una firma que está en discusión.
--
-- POR QUÉ EL HOLD LO IMPONE LA BASE Y NO EL CÓDIGO
-- -----------------------------------------------
-- El hold lo declara la Empresa (es la Responsable del tratamiento), pero
-- quien opera la purga es K+AIR (el Encargado) o un operador. Si la
-- comprobación del hold viviera en el código del script, bastaría un `UPDATE`
-- manual para esquivarla. Viviendo en el trigger, es imposible: la base de
-- datos se niega.
--
-- EL ALCANCE DE ESTA MIGRACIÓN
-- -----------------------------
-- Esta migración protege EL REGISTRO DE AUDITORÍA. No suprime los datos
-- personales de la fila de la firma (correo, huellas, manifestación de
-- voluntad) ni los archivos (PDF original, PDF firmado, constancia). Esa es
-- otra capa —"purga de los datos personales"— que es un paquete aparte y que
-- debe dejar su propio recibo. La operación completa, en orden, es:
--
--     1. chequeo de hold
--     2. datos personales
--     3. eventos de auditoría      <- lo que hace ESTA migración
--     4. registro de purga
--
-- Ejecutar solo esta capa deja el estado inverso al deseable: se destruye la
-- prueba y se conservan los datos. Por eso el script de purga lo dice en voz
-- alta, y por eso esta capa no se puede presentar como cumplimiento del 8.6.
--
-- POR QUÉ SE APLICA SOLO FUERA DE LOS TESTS
-- -------------------------------------------
-- Varios tests limpian la tabla con `DELETE FROM gh_firma_eventos` entre
-- casos. Con el trigger, esas limpiezas abortarían. En vez de debilitar el
-- trigger "para que los tests pasen" (que es dejar la puerta abierta en
-- producción por comodidad), la migración se salta en el ambiente de test
-- mediante la directiva `-- @skip-when-env test`, que el runner de
-- migraciones respeta (ver src/db/migrate.js).
--
-- BRECHA DE COBERTURA, Y POR QUÉ ES DELIBERADA
-- --------------------------------------------
-- El trigger no se prueba en la base de tests. SÍ se prueba, de otra manera:
-- `tests/conservacion-purga.test.js` aplica ESTE ARCHIVO REAL en una base de
-- datos aislada (en memoria) y ejercita las cinco condiciones, incluida la
-- del hold. La cobertura existe en CI; lo que no existe es la base de tests
-- compartida con el trigger instalado, porque instalarlo haría abortar las
-- limpiezas de los demás archivos de test. En STAGING la migración se aplica
-- de verdad y el trigger queda activo sobre la base real: ahí se valida
-- además, con datos reales, que aborta como debe.
--
-- CONSECUENCIA OPERATIVA
-- -----------------------
-- A partir de esta migración, la depuración de la base de datos requiere
-- `DROP TRIGGER` explícito. Es intencional.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Control de la ventana de purga. Una sola fila (id = 1): la ventana vigente.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gh_firma_purga_control (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ventana_activa INTEGER NOT NULL DEFAULT 0,
  abierta_at TEXT,
  abierta_hasta TEXT,
  abierta_por TEXT,
  motivo TEXT,
  cerrada_at TEXT
);

-- -----------------------------------------------------------------------------
-- Lote de firmas habilitadas para la purga en la ventana vigente.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gh_firma_purga_lote (
  firma_id INTEGER PRIMARY KEY REFERENCES gh_firmas_electronicas(id),
  anadida_at TEXT NOT NULL DEFAULT (datetime('now')),
  anadida_por TEXT,
  motivo TEXT
);

-- -----------------------------------------------------------------------------
-- Log de ventanas y purgas. Append-only: no se altera ni se borra.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gh_firma_purga_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha_hora TEXT NOT NULL DEFAULT (datetime('now')),
  evento TEXT NOT NULL,
  actor TEXT,
  motivo TEXT,
  ventana_hasta TEXT,
  firmas_en_lote INTEGER,
  eventos_purgados INTEGER,
  -- El conteo del chequeo de hold: cuántas firmas se revisaron y cuántas
  -- quedaron afuera por un deber legal de conservación. Es la prueba de que
  -- el hold se comprobó, no de que se pasó por alto.
  hold_revisados INTEGER,
  hold_bloqueados INTEGER
);

-- -----------------------------------------------------------------------------
-- Recibo de purga, UNA FILA POR FIRMA.
--
-- Es la PRUEBA DE CUMPLIMIENTO: dice qué firma, qué empresa, cuándo, quién,
-- por qué, en qué ventana, qué categorías se suprimieron y si se comprobó que
-- no había un hold activo. NO contiene datos personales: ni el correo, ni la
-- huella del documento, ni la manifestación, ni la IP. Solo identificadores
-- internos y la constancia de la decisión.
--
-- Append-only, como el log: si la supresión borrara su propio recibo, no
-- habría forma de demostrar qué se suprimió.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gh_firma_purga_registro (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firma_id INTEGER NOT NULL,
  id_empresa TEXT NOT NULL,
  purgado_at TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL,
  motivo TEXT NOT NULL,
  ventana_hasta TEXT,
  lote INTEGER,
  categorias TEXT NOT NULL,
  hold_verificado INTEGER NOT NULL DEFAULT 0,
  eventos_purgados INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_purga_registro_firma
  ON gh_firma_purga_registro(firma_id);

-- -----------------------------------------------------------------------------
-- El log y el recibo de purgas son append-only, igual que el registro de
-- auditoría. No hay ventana que los abra: la prueba de la supresión no se
-- suprime con la supresión.
-- -----------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_firma_purga_log_no_update
BEFORE UPDATE ON gh_firma_purga_log
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_purga_log es append-only: no se puede UPDATE');
END;

CREATE TRIGGER IF NOT EXISTS trg_firma_purga_log_no_delete
BEFORE DELETE ON gh_firma_purga_log
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_purga_log es append-only: no se puede DELETE');
END;

CREATE TRIGGER IF NOT EXISTS trg_firma_purga_registro_no_update
BEFORE UPDATE ON gh_firma_purga_registro
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_purga_registro es append-only: no se puede UPDATE');
END;

CREATE TRIGGER IF NOT EXISTS trg_firma_purga_registro_no_delete
BEFORE DELETE ON gh_firma_purga_registro
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_purga_registro es append-only: no se puede DELETE');
END;

-- -----------------------------------------------------------------------------
-- Solo se puede ampliar el lote mientras hay una ventana abierta.
-- -----------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_firma_purga_lote_solo_ventana
BEFORE INSERT ON gh_firma_purga_lote
BEGIN
  SELECT RAISE(ABORT, 'no hay ventana de purga abierta: no se puede ampliar el lote')
  WHERE NOT EXISTS (
    SELECT 1 FROM gh_firma_purga_control
     WHERE id = 1 AND ventana_activa = 1
       AND abierta_hasta IS NOT NULL
       AND datetime('now') <= datetime(abierta_hasta)
  );
END;

-- -----------------------------------------------------------------------------
-- El registro de auditoría. Inalterable, salvo ventana + lote + plazo vencido
-- + sin deber legal de conservación.
--
-- Cada condición aborta con su propio mensaje: el operador tiene que saber
-- cuál falló, para no ampliar la ventana y volver a intentarlo.
-- -----------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_firma_eventos_no_update
BEFORE UPDATE ON gh_firma_eventos
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_eventos es append-only: no hay ventana de purga abierta')
  WHERE NOT EXISTS (
    SELECT 1 FROM gh_firma_purga_control
     WHERE id = 1 AND ventana_activa = 1
       AND abierta_hasta IS NOT NULL
       AND datetime('now') <= datetime(abierta_hasta)
  );
  SELECT RAISE(ABORT, 'gh_firma_eventos es append-only: la firma no esta en el lote de purga')
  WHERE NOT EXISTS (
    SELECT 1 FROM gh_firma_purga_lote WHERE firma_id = OLD.firma_id
  );
  SELECT RAISE(ABORT, 'gh_firma_eventos es append-only: la firma tiene un deber legal de conservacion (hold)')
  WHERE EXISTS (
    SELECT 1 FROM gh_firmas_electronicas f
     WHERE f.id = OLD.firma_id AND COALESCE(f.hold_legal, 0) = 1
  );
  SELECT RAISE(ABORT, 'gh_firma_eventos es append-only: la firma no ha vencido su plazo de conservacion')
  WHERE EXISTS (
    SELECT 1 FROM gh_firmas_electronicas f
     WHERE f.id = OLD.firma_id
       AND (f.fecha_conservacion IS NULL
            OR datetime(f.fecha_conservacion) > datetime('now'))
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_firma_eventos_no_delete
BEFORE DELETE ON gh_firma_eventos
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_eventos es append-only: no hay ventana de purga abierta')
  WHERE NOT EXISTS (
    SELECT 1 FROM gh_firma_purga_control
     WHERE id = 1 AND ventana_activa = 1
       AND abierta_hasta IS NOT NULL
       AND datetime('now') <= datetime(abierta_hasta)
  );
  SELECT RAISE(ABORT, 'gh_firma_eventos es append-only: la firma no esta en el lote de purga')
  WHERE NOT EXISTS (
    SELECT 1 FROM gh_firma_purga_lote WHERE firma_id = OLD.firma_id
  );
  SELECT RAISE(ABORT, 'gh_firma_eventos es append-only: la firma tiene un deber legal de conservacion (hold)')
  WHERE EXISTS (
    SELECT 1 FROM gh_firmas_electronicas f
     WHERE f.id = OLD.firma_id AND COALESCE(f.hold_legal, 0) = 1
  );
  SELECT RAISE(ABORT, 'gh_firma_eventos es append-only: la firma no ha vencido su plazo de conservacion')
  WHERE EXISTS (
    SELECT 1 FROM gh_firmas_electronicas f
     WHERE f.id = OLD.firma_id
       AND (f.fecha_conservacion IS NULL
            OR datetime(f.fecha_conservacion) > datetime('now'))
  );
END;

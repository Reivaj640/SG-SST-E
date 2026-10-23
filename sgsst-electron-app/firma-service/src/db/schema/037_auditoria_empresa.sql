-- ============================================================================
-- 037 · RASTRO DE LOS CAMBIOS DE LA FICHA DE LA EMPRESA
-- ============================================================================
--
-- POR QUÉ
-- -------
-- `PUT /internal/admin/empresas/:id` es un REEMPLAZO de la ficha completa: lo
-- que no se manda queda en NULL. Eso significa que un canal de PQRS declarado
-- por via administrativa puede ser pisado por un guardado de escritorio, sin
-- que quede rastro de quien lo cambio ni de cuando.
--
-- El abogado lo pone como bloqueante de la publicacion de la v1.1:
--
--   "Canal de PQRS unico (formulario o endpoint) | Si - sin el, el override no
--    deja rastro"
--
-- O sea: el problema no es que se pueda cambiar (cambiar el canal de una
-- Empresa es legitimo), es que el cambio SEA INVISIBLE. Sin rastro no hay
-- forma de responder "de donde salio este canal" ni de demostrar que el
-- titular del dato cambio.
--
-- QUE SE GUARDA
-- -------------
-- Un renglon por CAMPO QUE REALMENTE CAMBIO (no por guardado): con el valor
-- anterior, el valor nuevo, quien lo hizo, desde donde, y el motivo que
-- declaro.
--
-- Lo que NO se guarda: los guardados que no cambian nada. Un guardado que
-- re-manda lo mismo no es un cambio y ensuciaria el rastro.
--
-- LA TABLA ES APPEND-ONLY
-- -----------------------
-- Lo que se escribe una vez, no se altera: los triggers de la migracion 038.
-- Es el mismo criterio de la bitacora de eventos (migracion 020) y de la
-- bitacora de excepciones (036).
-- ============================================================================

CREATE TABLE IF NOT EXISTS gh_firma_empresas_auditoria (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,

  -- La Empresa cuya ficha cambio.
  id_empresa      TEXT    NOT NULL,

  -- Cuando.
  fecha_hora      TEXT    NOT NULL,

  -- Quien: el actor declarado por el operador. `admin` cuando no se declara.
  id_actor        TEXT    NOT NULL,

  -- Desde donde (la peticion HTTP).
  ip              TEXT,
  user_agent      TEXT,

  -- Que campo cambio y de que valor a que valor.
  campo           TEXT    NOT NULL,
  valor_anterior  TEXT,
  valor_nuevo     TEXT,

  -- Por que (lo declara el operador).
  motivo          TEXT
);

CREATE INDEX IF NOT EXISTS idx_empresas_auditoria_empresa
  ON gh_firma_empresas_auditoria(id_empresa, id);

CREATE INDEX IF NOT EXISTS idx_empresas_auditoria_fecha
  ON gh_firma_empresas_auditoria(fecha_hora);

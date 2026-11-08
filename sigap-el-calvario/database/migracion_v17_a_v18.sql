-- =====================================================================
--  SIGAP · Migración de la versión 17 a la versión 18 (EPS en la base)
--
--  Úsala SOLO si ya tienes datos reales de la versión 17 y quieres conservarlos.
--  Si instalas desde cero, importa database/sigap.sql en su lugar.
--  Ejecútala UNA sola vez, y antes haz una copia de seguridad de la base «sigap».
--
--  Qué hace:
--   · Crea la tabla «eps»: la lista de EPS que sugiere el formulario de persona.
--   · La llena con las EPS que antes estaban escritas en la página.
--     Desde el catálogo, el administrador puede agregar, renombrar o desactivar EPS.
-- =====================================================================
SET NAMES utf8mb4;

CREATE TABLE eps (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(80) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY ux_eps_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO eps (nombre, activo) VALUES
  ('Nueva EPS', 1),
  ('Sanitas', 1),
  ('Sura', 1),
  ('Salud Total', 1),
  ('Compensar', 1),
  ('Coosalud', 1),
  ('Famisanar', 1),
  ('Mutual Ser', 1),
  ('Capital Salud', 1),
  ('Savia Salud', 1),
  ('Asmet Salud', 1),
  ('Emssanar', 1),
  ('Cajacopi', 1),
  ('Salud Mía', 1),
  ('SOS', 1),
  ('Aliansalud', 1);

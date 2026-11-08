-- =====================================================================
--  SIGAP · Migración de la versión 16 a la versión 17 (asistentes de las actividades por persona)
--
--  Úsala SOLO si ya tienes datos reales de la versión 16 y quieres conservarlos.
--  Si instalas desde cero, importa database/sigap.sql en su lugar.
--  Ejecútala UNA sola vez, y antes haz una copia de seguridad de la base «sigap».
--
--  Qué hace:
--   · Agrega la tabla «actividad_asistentes»: la persona que asistió a cada actividad general.
--   · Agrega la columna «lista_registrada» a las actividades. Las que ya existen quedan en 0 («sin lista»):
--     conservan su total de asistentes, y ese total se reemplaza al marcar a las personas.
-- =====================================================================
SET NAMES utf8mb4;

ALTER TABLE actividades_generales
  ADD COLUMN lista_registrada TINYINT(1) NOT NULL DEFAULT 0 AFTER observaciones;

CREATE TABLE actividad_asistentes (
  actividad_id INT UNSIGNED NOT NULL,
  persona_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (actividad_id, persona_id),
  KEY ix_act_asist_persona (persona_id),
  CONSTRAINT fk_act_asist_actividad FOREIGN KEY (actividad_id) REFERENCES actividades_generales (id) ON DELETE CASCADE,
  CONSTRAINT fk_act_asist_persona FOREIGN KEY (persona_id) REFERENCES personas (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

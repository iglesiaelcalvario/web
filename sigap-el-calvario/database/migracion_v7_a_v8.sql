-- =====================================================================
--  SIGAP · Migración de la versión 7 a la versión 8 (usuarios y permisos en pantalla)
--
--  Úsala SOLO si ya tienes datos reales de la versión 7 y quieres conservarlos.
--  Si instalas desde cero, importa database/sigap.sql en su lugar.
--  Ejecútala UNA sola vez, y antes haz una copia de seguridad de la base «sigap».
--
--  Qué hace:
--   · Agrega a cada cuenta una versión de sesión: al cambiar una clave se cierran las
--     sesiones abiertas con la clave anterior.
--   · Crea la tabla de acciones que aplican a cada módulo, con las que ya están en la matriz.
--   · No cambia cuentas, personas ni permisos existentes.
--
--  Después de actualizar, las personas siguen con su sesión abierta; no hace falta volver a entrar.
-- =====================================================================
SET NAMES utf8mb4;
USE `sigap`;

ALTER TABLE usuarios
  ADD COLUMN sesion_version INT UNSIGNED NOT NULL DEFAULT 1
  COMMENT 'Sube al cambiar la clave: cierra las sesiones anteriores'
  AFTER ultimo_acceso;

CREATE TABLE modulo_acciones (
  modulo_id TINYINT UNSIGNED NOT NULL,
  accion_id TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (modulo_id, accion_id),
  CONSTRAINT fk_modac_modulo FOREIGN KEY (modulo_id) REFERENCES modulos (id) ON DELETE CASCADE,
  CONSTRAINT fk_modac_accion FOREIGN KEY (accion_id) REFERENCES acciones (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Las acciones que aplican a cada módulo son las que ya aparecen en la matriz de permisos
INSERT INTO modulo_acciones (modulo_id, accion_id)
  SELECT DISTINCT modulo_id, accion_id FROM permisos;

-- Migración de la versión 26 a la versión 27
-- Campos nuevos de personas (grupo sanguíneo, identificación, contacto de emergencia, sede, grupo de adiestramiento y niveles),
-- tabla de sedes y comentario de la fecha de cumpleaños. No borra ni cambia datos existentes.
-- Se puede ejecutar más de una vez sin dañar nada.
USE sigap;

ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS grupo_sanguineo ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NULL,
  ADD COLUMN IF NOT EXISTS tipo_identificacion ENUM('CC','TI') NULL,
  ADD COLUMN IF NOT EXISTS numero_identificacion VARCHAR(11) NULL,
  ADD COLUMN IF NOT EXISTS nombre_emergencia VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS sede_id INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS grupo_adiestramiento VARCHAR(80) NULL,
  ADD COLUMN IF NOT EXISTS nivel_discipulado VARCHAR(80) NULL,
  ADD COLUMN IF NOT EXISTS nivel_adiestramiento VARCHAR(80) NULL;

CREATE TABLE IF NOT EXISTS sedes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(80) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado DATE NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sedes_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO sedes (nombre, activo, creado) VALUES ('Sede principal', 1, CURDATE());

ALTER TABLE personas ADD UNIQUE INDEX IF NOT EXISTS uq_personas_identificacion (numero_identificacion);

SET @fk = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
           WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'personas' AND CONSTRAINT_NAME = 'fk_personas_sede');
SET @sql = IF(@fk = 0, 'ALTER TABLE personas ADD CONSTRAINT fk_personas_sede FOREIGN KEY (sede_id) REFERENCES sedes (id) ON DELETE SET NULL', 'SELECT 1');
PREPARE st FROM @sql;
EXECUTE st;
DEALLOCATE PREPARE st;

ALTER TABLE personas MODIFY COLUMN nacimiento DATE NOT NULL COMMENT 'Fecha de cumpleanos (dia, mes y ano). Antes se llamaba Fecha de nacimiento.';

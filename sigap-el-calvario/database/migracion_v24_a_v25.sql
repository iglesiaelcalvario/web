-- Migración de la versión 24 a la versión 25: campos nuevos de personas, grupos de Adiestramiento y otros, y módulo Grupos.
-- Haz una copia de la base antes de ejecutarla. Se ejecuta una sola vez.
USE sigap;
ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS bautizado TINYINT(1) NOT NULL DEFAULT 0 AFTER direccion,
  ADD COLUMN IF NOT EXISTS cargo_iglesia VARCHAR(30) NULL AFTER bautizado,
  ADD COLUMN IF NOT EXISTS telefono_emergencia VARCHAR(10) NULL AFTER cargo_iglesia,
  ADD COLUMN IF NOT EXISTS foto_tipo VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS foto MEDIUMBLOB NULL;
CREATE TABLE IF NOT EXISTS grupos_otros (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tipo ENUM('adiestramiento','otro') NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  lugar VARCHAR(160) NOT NULL,
  fecha_inicio DATE NOT NULL,
  responsable VARCHAR(120) NOT NULL DEFAULT '',
  observaciones TEXT NOT NULL,
  estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  creado DATE NOT NULL,
  creado_por INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_grupos_otros_tipo (tipo, estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO modulos (id, clave, nombre) VALUES (19, 'grupos', 'Grupos');
INSERT IGNORE INTO modulo_acciones (modulo_id, accion_id) VALUES (19, 1), (19, 3), (19, 5);
INSERT IGNORE INTO permisos (rol_id, modulo_id, accion_id) VALUES (1, 19, 1), (1, 19, 3), (1, 19, 5), (3, 19, 1), (3, 19, 3), (3, 19, 5);

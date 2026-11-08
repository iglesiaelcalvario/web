-- Migración de la versión 27 a la versión 28
-- Módulo Sedes: catálogo de departamentos y barrios, datos de ubicación de cada sede y permisos del módulo.
-- No borra ni cambia las sedes que ya existen. Se puede ejecutar más de una vez sin dañar nada.
USE sigap;

CREATE TABLE IF NOT EXISTS departamentos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(60) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_departamentos_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO departamentos (nombre) VALUES
  ('Amazonas'), ('Antioquia'), ('Arauca'), ('Atlántico'), ('Bolívar'), ('Boyacá'), ('Caldas'), ('Caquetá'),
  ('Casanare'), ('Cauca'), ('Cesar'), ('Chocó'), ('Córdoba'), ('Cundinamarca'), ('Guainía'), ('Guaviare'),
  ('Huila'), ('La Guajira'), ('Magdalena'), ('Meta'), ('Nariño'), ('Norte de Santander'), ('Putumayo'),
  ('Quindío'), ('Risaralda'), ('San Andrés y Providencia'), ('Santander'), ('Sucre'), ('Tolima'),
  ('Valle del Cauca'), ('Vaupés'), ('Vichada'), ('Bogotá, D.C.');

CREATE TABLE IF NOT EXISTS barrios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ciudad VARCHAR(60) NOT NULL DEFAULT 'Villavicencio',
  nombre VARCHAR(80) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_barrios_ciudad_nombre (ciudad, nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lista de ejemplo: reemplazar con la lista oficial de barrios de Villavicencio
INSERT IGNORE INTO barrios (ciudad, nombre) VALUES
  ('Villavicencio', 'Centro'), ('Villavicencio', 'Barzal'), ('Villavicencio', 'La Esperanza'),
  ('Villavicencio', 'Ciudadela Llanocentro'), ('Villavicencio', 'Porfía');

ALTER TABLE sedes
  ADD COLUMN IF NOT EXISTS direccion VARCHAR(160) NULL,
  ADD COLUMN IF NOT EXISTS pais VARCHAR(40) NOT NULL DEFAULT 'Colombia',
  ADD COLUMN IF NOT EXISTS ciudad VARCHAR(60) NOT NULL DEFAULT 'Villavicencio',
  ADD COLUMN IF NOT EXISTS barrio_id INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS departamento_id INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS actualizado DATE NULL;

SET @fk1 = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'sedes' AND CONSTRAINT_NAME = 'fk_sedes_barrio');
SET @sql1 = IF(@fk1 = 0, 'ALTER TABLE sedes ADD CONSTRAINT fk_sedes_barrio FOREIGN KEY (barrio_id) REFERENCES barrios (id) ON DELETE SET NULL', 'SELECT 1');
PREPARE s1 FROM @sql1;
EXECUTE s1;
DEALLOCATE PREPARE s1;

SET @fk2 = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'sedes' AND CONSTRAINT_NAME = 'fk_sedes_departamento');
SET @sql2 = IF(@fk2 = 0, 'ALTER TABLE sedes ADD CONSTRAINT fk_sedes_departamento FOREIGN KEY (departamento_id) REFERENCES departamentos (id) ON DELETE SET NULL', 'SELECT 1');
PREPARE s2 FROM @sql2;
EXECUTE s2;
DEALLOCATE PREPARE s2;

INSERT IGNORE INTO modulos (id, clave, nombre) VALUES (20, 'sedes', 'Sedes');
INSERT IGNORE INTO modulo_acciones (modulo_id, accion_id) VALUES (20, 1), (20, 3), (20, 5);
INSERT IGNORE INTO permisos (rol_id, modulo_id, accion_id) VALUES (1, 20, 1), (1, 20, 3), (1, 20, 5);

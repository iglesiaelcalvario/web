-- =====================================================================
--  SIGAP · Migración de la versión 4 a la versión 5
--  Los nacidos de nuevo y los bautismos pasan a ser registros propios
--  (uno por persona y tipo, con fecha, responsable y observaciones).
--
--  Úsala SOLO si ya tienes datos reales de la versión 4 y quieres conservarlos.
--  Si instalas desde cero, importa database/sigap.sql en su lugar.
--  Ejecútala UNA sola vez, y antes haz una copia de seguridad de la base «sigap»
--  (en phpMyAdmin: Exportar → Rápido → Continuar).
-- =====================================================================
SET NAMES utf8mb4;
USE `sigap`;

CREATE TABLE nacidos_de_nuevo (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  persona_id INT UNSIGNED NOT NULL,
  fecha DATE NOT NULL,
  responsable_persona_id INT UNSIGNED NULL,
  observaciones TEXT NOT NULL,
  registrado_por INT UNSIGNED NULL,
  registrada DATE NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_nacido_persona (persona_id),
  KEY ix_nacido_fecha (fecha),
  CONSTRAINT fk_nn_persona FOREIGN KEY (persona_id) REFERENCES personas (id),
  CONSTRAINT fk_nn_responsable FOREIGN KEY (responsable_persona_id) REFERENCES personas (id) ON DELETE SET NULL,
  CONSTRAINT fk_nn_registrador FOREIGN KEY (registrado_por) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bautismos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  persona_id INT UNSIGNED NOT NULL,
  fecha DATE NOT NULL,
  responsable_persona_id INT UNSIGNED NULL,
  observaciones TEXT NOT NULL,
  registrado_por INT UNSIGNED NULL,
  registrada DATE NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bautismo_persona (persona_id),
  KEY ix_bautismo_fecha (fecha),
  CONSTRAINT fk_bau_persona FOREIGN KEY (persona_id) REFERENCES personas (id),
  CONSTRAINT fk_bau_responsable FOREIGN KEY (responsable_persona_id) REFERENCES personas (id) ON DELETE SET NULL,
  CONSTRAINT fk_bau_registrador FOREIGN KEY (registrado_por) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1) Las fechas que hoy están en personas pasan a sus registros (sin responsable ni observaciones)
INSERT INTO nacidos_de_nuevo (persona_id, fecha, responsable_persona_id, observaciones, registrado_por, registrada)
  SELECT id, nacido_nuevo, NULL, '', NULL, CURDATE() FROM personas WHERE nacido_nuevo IS NOT NULL;
INSERT INTO bautismos (persona_id, fecha, responsable_persona_id, observaciones, registrado_por, registrada)
  SELECT id, bautismo, NULL, '', NULL, CURDATE() FROM personas WHERE bautismo IS NOT NULL;

-- 2) Módulo nuevo y sus permisos (administrador: todo; Asistente Pastor: registrar, editar, consultar; pastor: consultar)
INSERT INTO modulos (clave, nombre) VALUES ('nacidos-bautizados', 'Nacidos de nuevo y bautizados');
INSERT INTO permisos (rol_id, modulo_id, accion_id)
  SELECT r.id, m.id, a.id
  FROM roles r
  JOIN modulos m ON m.clave = 'nacidos-bautizados'
  JOIN acciones a ON 1 = 1
  WHERE (r.clave = 'admin' AND a.clave IN ('registrar', 'editar', 'eliminar', 'consultar'))
     OR (r.clave = 'asistente' AND a.clave IN ('registrar', 'editar', 'consultar'))
     OR (r.clave = 'pastor' AND a.clave = 'consultar');

-- 3) Se quitan los campos viejos de personas (sus datos ya están en los registros de arriba)
ALTER TABLE personas DROP CONSTRAINT chk_personas_nacido_nuevo;
ALTER TABLE personas DROP CONSTRAINT chk_personas_bautismo;
ALTER TABLE personas DROP COLUMN nacido_nuevo, DROP COLUMN bautismo;

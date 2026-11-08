-- =====================================================================
--  SIGAP · Migración de la versión 9 a la versión 10 (actividades generales)
--
--  Úsala SOLO si ya tienes datos reales de la versión 9 y quieres conservarlos.
--  Si instalas desde cero, importa database/sigap.sql en su lugar.
--  Ejecútala UNA sola vez, y antes haz una copia de seguridad de la base «sigap».
--
--  Qué hace:
--   · Crea el catálogo de tipos de actividad, con los cuatro tipos que pidió la iglesia:
--     servicio dominical, discipulado de mujeres, seminario y actividad especial.
--   · Crea las actividades generales (servicios, discipulados, seminarios y otras).
--   · Da los permisos de los módulos «Actividades generales» y «Tipos de actividad».
--   · No cambia ninguna persona, grupo, reunión, cuenta ni permiso existente.
-- =====================================================================
SET NAMES utf8mb4;
USE `sigap`;

CREATE TABLE tipos_actividad (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  orden SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tipo_actividad_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE actividades_generales (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tipo_id INT UNSIGNED NOT NULL,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NULL,
  lugar VARCHAR(160) NOT NULL DEFAULT '',
  responsable_persona_id INT UNSIGNED NULL,
  asistentes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  observaciones TEXT NOT NULL,
  registrado_por INT UNSIGNED NULL,
  registrado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_act_gen_fecha (fecha),
  KEY ix_act_gen_tipo (tipo_id, fecha),
  CONSTRAINT fk_act_gen_tipo FOREIGN KEY (tipo_id) REFERENCES tipos_actividad (id),
  CONSTRAINT fk_act_gen_responsable FOREIGN KEY (responsable_persona_id) REFERENCES personas (id) ON DELETE SET NULL,
  CONSTRAINT fk_act_gen_registrador FOREIGN KEY (registrado_por) REFERENCES usuarios (id) ON DELETE SET NULL,
  CONSTRAINT chk_act_gen_horas CHECK (hora_fin IS NULL OR hora_fin > hora_inicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tipos iniciales: los que pidió la iglesia (puede cambiarlos después en «Tipos de actividad»)
INSERT INTO tipos_actividad (nombre, activo, orden) VALUES
  ('Servicio dominical', 1, 1),
  ('Discipulado de mujeres', 1, 2),
  ('Seminario', 1, 3),
  ('Actividad especial', 1, 4);

INSERT INTO modulos (clave, nombre) VALUES
  ('actividades', 'Actividades generales'),
  ('tipos-actividad', 'Tipos de actividad');

INSERT INTO permisos (rol_id, modulo_id, accion_id)
  SELECT r.id, m.id, a.id
  FROM roles r
  JOIN modulos m ON m.clave IN ('actividades', 'tipos-actividad')
  JOIN acciones a ON 1 = 1
  WHERE (m.clave = 'actividades' AND r.clave = 'admin' AND a.clave IN ('registrar', 'editar', 'eliminar', 'consultar'))
     OR (m.clave = 'actividades' AND r.clave = 'pastor' AND a.clave = 'consultar')
     OR (m.clave = 'actividades' AND r.clave = 'asistente' AND a.clave IN ('registrar', 'editar', 'consultar'))
     OR (m.clave = 'actividades' AND r.clave = 'discipulador' AND a.clave = 'consultar')
     OR (m.clave = 'tipos-actividad' AND r.clave = 'admin' AND a.clave IN ('registrar', 'editar', 'consultar'))
     OR (m.clave = 'tipos-actividad' AND r.clave IN ('pastor', 'asistente', 'discipulador') AND a.clave = 'consultar');

-- Las acciones que aplican a cada módulo nuevo son las que quedaron en la matriz
INSERT INTO modulo_acciones (modulo_id, accion_id)
  SELECT DISTINCT p.modulo_id, p.accion_id
  FROM permisos p
  WHERE p.modulo_id IN (SELECT id FROM modulos WHERE clave IN ('actividades', 'tipos-actividad'));

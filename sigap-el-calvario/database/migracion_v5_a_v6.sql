-- =====================================================================
--  SIGAP · Migración de la versión 5 a la versión 6 (Asistencia Pastoral con historial)
--
--  Úsala SOLO si ya tienes datos reales de la versión 5 y quieres conservarlos.
--  Si instalas desde cero, importa database/sigap.sql en su lugar.
--  Ejecútala UNA sola vez, y antes haz una copia de seguridad de la base «sigap»
--  (en phpMyAdmin: Exportar → Rápido → Continuar).
--
--  Qué hace:
--   · Cada seguimiento de la versión 5 pasa a ser un caso ligado a su persona registrada,
--     y su contenido se convierte en la primera actuación de su historial.
--   · Las categorías que ya se escribían como texto se vuelven categorías configurables.
--   · Los seguimientos cuyo nombre no coincide con ninguna persona registrada NO se pierden:
--     solo quedan en la tabla seguimientos_v5 (copia original completa), para vincularlos a mano.
-- =====================================================================
SET NAMES utf8mb4;
USE `sigap`;

CREATE TABLE categorias_pastorales (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  orden SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categoria_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE casos_pastorales (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  persona_id INT UNSIGNED NOT NULL,
  categoria_id INT UNSIGNED NOT NULL,
  descripcion TEXT NOT NULL,
  fecha_apertura DATE NOT NULL,
  responsable_usuario_id INT UNSIGNED NULL,
  estado ENUM('Pendiente','En seguimiento','Atendido','Cerrado') NOT NULL DEFAULT 'Pendiente',
  proximo_seguimiento DATE NULL,
  creado_por INT UNSIGNED NULL,
  creado DATE NOT NULL,
  PRIMARY KEY (id),
  KEY ix_casos_persona (persona_id),
  KEY ix_casos_estado (estado, proximo_seguimiento),
  CONSTRAINT fk_casos_persona FOREIGN KEY (persona_id) REFERENCES personas (id),
  CONSTRAINT fk_casos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias_pastorales (id),
  CONSTRAINT fk_casos_responsable FOREIGN KEY (responsable_usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL,
  CONSTRAINT fk_casos_creador FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE actuaciones_pastorales (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  caso_id INT UNSIGNED NOT NULL,
  fecha DATE NOT NULL,
  responsable_usuario_id INT UNSIGNED NULL,
  actividad TEXT NOT NULL,
  observaciones TEXT NOT NULL,
  estado ENUM('Pendiente','En seguimiento','Atendido','Cerrado') NOT NULL,
  proximo_seguimiento DATE NULL,
  registrada_por INT UNSIGNED NULL,
  registrada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_act_caso (caso_id, fecha, id),
  CONSTRAINT fk_act_caso FOREIGN KEY (caso_id) REFERENCES casos_pastorales (id),
  CONSTRAINT fk_act_responsable FOREIGN KEY (responsable_usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL,
  CONSTRAINT fk_act_registrador FOREIGN KEY (registrada_por) REFERENCES usuarios (id) ON DELETE SET NULL,
  CONSTRAINT chk_act_proximo CHECK (proximo_seguimiento IS NULL OR proximo_seguimiento >= fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TRIGGER trg_actuaciones_no_editar BEFORE UPDATE ON actuaciones_pastorales FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial pastoral no se puede modificar: solo se agregan actuaciones.';
CREATE TRIGGER trg_actuaciones_no_borrar BEFORE DELETE ON actuaciones_pastorales FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial pastoral no se puede borrar.';

-- 1) Categorías: las que ya se escribían como texto, más la que pidió la iglesia
INSERT IGNORE INTO categorias_pastorales (nombre, activo, orden)
  SELECT DISTINCT TRIM(tipo), 1, 0 FROM seguimientos WHERE TRIM(tipo) <> '';
INSERT IGNORE INTO categorias_pastorales (nombre, activo, orden) VALUES ('Pérdida de un ser querido', 1, 0);

-- 2) Casos: solo de las personas registradas (coincidencia por nombre completo)
INSERT INTO casos_pastorales (persona_id, categoria_id, descripcion, fecha_apertura, responsable_usuario_id,
                              estado, proximo_seguimiento, creado_por, creado)
  SELECT p.id, c.id, s.descripcion, s.fecha, s.responsable_id, s.estado, s.proximo_seguimiento, s.responsable_id, s.registrado
  FROM seguimientos s
  JOIN personas p ON CONCAT(p.nombres, ' ', p.apellidos) = s.persona
  JOIN categorias_pastorales c ON c.nombre = TRIM(s.tipo);

-- 3) Historial: el seguimiento anterior pasa a ser la primera actuación de su caso
INSERT INTO actuaciones_pastorales (caso_id, fecha, responsable_usuario_id, actividad, observaciones, estado,
                                    proximo_seguimiento, registrada_por, registrada)
  SELECT k.id, s.fecha, s.responsable_id, s.actividad, s.observaciones, s.estado, s.proximo_seguimiento,
         s.responsable_id, s.registrado
  FROM seguimientos s
  JOIN personas p ON CONCAT(p.nombres, ' ', p.apellidos) = s.persona
  JOIN categorias_pastorales c ON c.nombre = TRIM(s.tipo)
  JOIN casos_pastorales k ON k.persona_id = p.id AND k.fecha_apertura = s.fecha
                         AND k.descripcion = s.descripcion AND k.categoria_id = c.id;

-- 4) Se conserva la tabla original como respaldo (seguimientos_v5); no se borra nada
RENAME TABLE seguimientos TO seguimientos_v5;

-- 5) Permisos: el historial no se borra, así que «eliminar» sale de Asistencia Pastoral;
--    las categorías las administra el administrador
DELETE p FROM permisos p
  JOIN modulos m ON m.id = p.modulo_id
  JOIN acciones a ON a.id = p.accion_id
  WHERE m.clave = 'asistencia-pastoral' AND a.clave = 'eliminar';
INSERT INTO modulos (clave, nombre) VALUES ('categorias-pastorales', 'Categorías de situación pastoral');
INSERT INTO permisos (rol_id, modulo_id, accion_id)
  SELECT r.id, m.id, a.id
  FROM roles r
  JOIN modulos m ON m.clave = 'categorias-pastorales'
  JOIN acciones a ON 1 = 1
  WHERE (r.clave = 'admin' AND a.clave IN ('registrar', 'editar', 'consultar'))
     OR (r.clave IN ('pastor', 'asistente') AND a.clave = 'consultar');

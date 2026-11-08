SET time_zone = '-05:00';

-- SIGAP v3 · parte A del esquema. Se une con schema_b.sql al generar (sigap y ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci se reemplazan).
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
CREATE DATABASE IF NOT EXISTS `sigap` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `sigap`;
DROP VIEW IF EXISTS v_permisos;
DROP TABLE IF EXISTS sedes, barrios, departamentos, grupos_otros, eps, actividad_asistentes, actividades_generales, tipos_actividad, nacidos_de_nuevo, bautismos, auditoria, reunion_visitantes, reunion_asistencia, reuniones, grupo_participantes, grupos,
  sesion_asistencia, sesiones_adiestramiento, curso_participantes,
  temas, niveles, cursos, procesos, persona_funciones, funciones, asistencias, adiestramientos, finanzas,
  seguimientos, actuaciones_pastorales, casos_pastorales, categorias_pastorales, intentos_login, usuarios, personas, modulo_acciones, permisos, acciones, modulos, roles;

-- Seguridad: rol → permisos → módulos → acciones
CREATE TABLE roles (
  id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  clave VARCHAR(20) NOT NULL,
  nombre VARCHAR(40) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_clave (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE modulos (
  id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  clave VARCHAR(40) NOT NULL,
  nombre VARCHAR(60) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_modulos_clave (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE acciones (
  id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  clave VARCHAR(20) NOT NULL,
  nombre VARCHAR(40) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_acciones_clave (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE permisos (
  rol_id TINYINT UNSIGNED NOT NULL,
  modulo_id TINYINT UNSIGNED NOT NULL,
  accion_id TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (rol_id, modulo_id, accion_id),
  CONSTRAINT fk_permisos_rol FOREIGN KEY (rol_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_permisos_modulo FOREIGN KEY (modulo_id) REFERENCES modulos (id) ON DELETE CASCADE,
  CONSTRAINT fk_permisos_accion FOREIGN KEY (accion_id) REFERENCES acciones (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Acciones que aplican a cada módulo: la matriz de permisos solo ofrece estas casillas
CREATE TABLE modulo_acciones (
  modulo_id TINYINT UNSIGNED NOT NULL,
  accion_id TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (modulo_id, accion_id),
  CONSTRAINT fk_modac_modulo FOREIGN KEY (modulo_id) REFERENCES modulos (id) ON DELETE CASCADE,
  CONSTRAINT fk_modac_accion FOREIGN KEY (accion_id) REFERENCES acciones (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Persona registrada (una sola vez; se reutiliza en todos los módulos)
CREATE TABLE personas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombres VARCHAR(80) NOT NULL,
  apellidos VARCHAR(80) NOT NULL,
  nacimiento DATE NOT NULL,
  telefono VARCHAR(20) NOT NULL,
  correo VARCHAR(120) NOT NULL DEFAULT '',
  eps VARCHAR(60) NOT NULL DEFAULT '',
  direccion VARCHAR(160) NOT NULL DEFAULT '',
  registrada DATE NOT NULL,
  creado_por INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_personas_identidad (nombres, apellidos, nacimiento),
  KEY ix_personas_registrada (registrada)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE personas
  ADD COLUMN bautizado TINYINT(1) NOT NULL DEFAULT 0 AFTER direccion,
  ADD COLUMN cargo_iglesia VARCHAR(30) NULL AFTER bautizado,
  ADD COLUMN telefono_emergencia VARCHAR(10) NULL AFTER cargo_iglesia,
  ADD COLUMN foto_tipo VARCHAR(30) NULL,
  ADD COLUMN foto MEDIUMBLOB NULL;

CREATE TABLE grupos_otros (
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

-- Cuenta de acceso al sistema (rol). Es independiente de la función que la persona cumple en la iglesia.
CREATE TABLE usuarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario VARCHAR(30) NOT NULL,
  clave_hash VARCHAR(255) NOT NULL,
  nombres VARCHAR(80) NOT NULL,
  apellidos VARCHAR(80) NOT NULL,
  rol_id TINYINT UNSIGNED NOT NULL,
  persona_id INT UNSIGNED NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  ultimo_acceso DATETIME NULL,
  sesion_version INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Sube al cambiar la clave: cierra las sesiones anteriores',
  creado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_usuario (usuario),
  KEY ix_usuarios_rol (rol_id),
  KEY ix_usuarios_persona (persona_id),
  CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol_id) REFERENCES roles (id),
  CONSTRAINT fk_usuarios_persona FOREIGN KEY (persona_id) REFERENCES personas (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE personas ADD CONSTRAINT fk_personas_creador FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE SET NULL;

CREATE TABLE intentos_login (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario VARCHAR(30) NOT NULL,
  ip VARCHAR(45) NOT NULL,
  creado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_intentos_login (usuario, ip, creado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Funciones que una persona cumple en la iglesia (una persona puede tener varias)
CREATE TABLE funciones (
  id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  clave VARCHAR(20) NOT NULL,
  nombre VARCHAR(40) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_funciones_clave (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE persona_funciones (
  persona_id INT UNSIGNED NOT NULL,
  funcion_id TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (persona_id, funcion_id),
  CONSTRAINT fk_pf_persona FOREIGN KEY (persona_id) REFERENCES personas (id) ON DELETE CASCADE,
  CONSTRAINT fk_pf_funcion FOREIGN KEY (funcion_id) REFERENCES funciones (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Catálogo de formación: proceso → curso → nivel o etapa → tema (todo configurable; nada inventado)
CREATE TABLE procesos (
  id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  clave VARCHAR(40) NOT NULL,
  nombre VARCHAR(60) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_procesos_clave (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cursos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  proceso_id TINYINT UNSIGNED NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  responsable_persona_id INT UNSIGNED NULL COMMENT 'Adiestrador habitual del curso (solo Adiestramiento)',
  PRIMARY KEY (id),
  UNIQUE KEY uq_cursos_nombre (proceso_id, nombre),
  KEY ix_cursos_responsable (responsable_persona_id),
  CONSTRAINT fk_cursos_proceso FOREIGN KEY (proceso_id) REFERENCES procesos (id),
  CONSTRAINT fk_cursos_responsable FOREIGN KEY (responsable_persona_id) REFERENCES personas (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE niveles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  curso_id INT UNSIGNED NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  orden SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_niveles_nombre (curso_id, nombre),
  CONSTRAINT fk_niveles_curso FOREIGN KEY (curso_id) REFERENCES cursos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE temas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  curso_id INT UNSIGNED NOT NULL,
  nivel_id INT UNSIGNED NULL,
  nombre VARCHAR(160) NOT NULL,
  orden SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY ix_temas_curso (curso_id),
  KEY ix_temas_nivel (nivel_id),
  CONSTRAINT fk_temas_curso FOREIGN KEY (curso_id) REFERENCES cursos (id),
  CONSTRAINT fk_temas_nivel FOREIGN KEY (nivel_id) REFERENCES niveles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SIGAP v3 · parte B del esquema (continúa schema_a.sql).

-- Comunión Familiar: grupo (casa) con anfitrión y discipulador como personas
CREATE TABLE grupos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(80) NOT NULL,
  direccion VARCHAR(160) NOT NULL,
  fecha_inicio DATE NOT NULL,
  anfitrion_persona_id INT UNSIGNED NOT NULL,
  discipulador_persona_id INT UNSIGNED NOT NULL,
  estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  observaciones TEXT NOT NULL,
  creado DATE NOT NULL,
  creado_por INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY ix_grupos_discipulador (discipulador_persona_id),
  CONSTRAINT fk_grupos_anfitrion FOREIGN KEY (anfitrion_persona_id) REFERENCES personas (id),
  CONSTRAINT fk_grupos_discipulador FOREIGN KEY (discipulador_persona_id) REFERENCES personas (id),
  CONSTRAINT fk_grupos_creador FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Participantes vinculados al grupo (personas registradas una sola vez)
CREATE TABLE grupo_participantes (
  grupo_id INT UNSIGNED NOT NULL,
  persona_id INT UNSIGNED NOT NULL,
  desde DATE NOT NULL,
  PRIMARY KEY (grupo_id, persona_id),
  KEY ix_gp_persona (persona_id),
  CONSTRAINT fk_gp_grupo FOREIGN KEY (grupo_id) REFERENCES grupos (id) ON DELETE CASCADE,
  CONSTRAINT fk_gp_persona FOREIGN KEY (persona_id) REFERENCES personas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reunión: fecha, horario, dirección si cambió, anfitrión, quién impartió, tema
CREATE TABLE reuniones (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  grupo_id INT UNSIGNED NOT NULL,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NULL,
  direccion VARCHAR(160) NOT NULL DEFAULT '',
  anfitrion_persona_id INT UNSIGNED NULL,
  discipulador_persona_id INT UNSIGNED NULL,
  impartido_por_persona_id INT UNSIGNED NULL,
  tema_id INT UNSIGNED NULL,
  cantidad SMALLINT UNSIGNED NOT NULL,
  ofrenda DECIMAL(12,0) NOT NULL DEFAULT 0,
  novedades TEXT NOT NULL,
  registrado_por INT UNSIGNED NULL,
  registrada DATE NOT NULL,
  PRIMARY KEY (id),
  KEY ix_reuniones_grupo_fecha (grupo_id, fecha),
  CONSTRAINT fk_reuniones_grupo FOREIGN KEY (grupo_id) REFERENCES grupos (id),
  CONSTRAINT fk_reuniones_anfitrion FOREIGN KEY (anfitrion_persona_id) REFERENCES personas (id),
  CONSTRAINT fk_reuniones_discipulador FOREIGN KEY (discipulador_persona_id) REFERENCES personas (id),
  CONSTRAINT fk_reuniones_impartido FOREIGN KEY (impartido_por_persona_id) REFERENCES personas (id),
  CONSTRAINT fk_reuniones_tema FOREIGN KEY (tema_id) REFERENCES temas (id),
  CONSTRAINT fk_reuniones_registrador FOREIGN KEY (registrado_por) REFERENCES usuarios (id) ON DELETE SET NULL,
  CONSTRAINT chk_reuniones_horas CHECK (hora_fin IS NULL OR hora_fin > hora_inicio),
  CONSTRAINT chk_reuniones_ofrenda CHECK (ofrenda >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Asistencia: solo participantes vinculados (la fila existe = asistió)
CREATE TABLE reunion_asistencia (
  reunion_id INT UNSIGNED NOT NULL,
  persona_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (reunion_id, persona_id),
  KEY ix_ra_persona (persona_id),
  CONSTRAINT fk_ra_reunion FOREIGN KEY (reunion_id) REFERENCES reuniones (id) ON DELETE CASCADE,
  CONSTRAINT fk_ra_persona FOREIGN KEY (persona_id) REFERENCES personas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Visitantes que asistieron por primera vez; luego pueden vincularse a su ficha
CREATE TABLE reunion_visitantes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reunion_id INT UNSIGNED NOT NULL,
  nombre VARCHAR(160) NOT NULL,
  persona_id INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY ix_rv_reunion (reunion_id),
  KEY ix_rv_persona (persona_id),
  CONSTRAINT fk_rv_reunion FOREIGN KEY (reunion_id) REFERENCES reuniones (id) ON DELETE CASCADE,
  CONSTRAINT fk_rv_persona FOREIGN KEY (persona_id) REFERENCES personas (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Asistencia general (lista de asistencia)
CREATE TABLE asistencias (
  persona_id INT UNSIGNED NOT NULL,
  fecha DATE NOT NULL,
  estado ENUM('P','F','E') NOT NULL,
  PRIMARY KEY (persona_id, fecha),
  CONSTRAINT fk_asistencias_persona FOREIGN KEY (persona_id) REFERENCES personas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Asistencia Pastoral (estados según el prompt: Pendiente, En seguimiento, Atendido, Cerrado)
-- Asistencia Pastoral: categorías de situación (configurables; se desactivan, no se borran)
CREATE TABLE categorias_pastorales (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  orden SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categoria_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Asistencia Pastoral: cada caso pertenece a una persona registrada
CREATE TABLE casos_pastorales (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  persona_id INT UNSIGNED NOT NULL,
  categoria_id INT UNSIGNED NOT NULL,
  descripcion TEXT NOT NULL COMMENT 'Descripción de la situación',
  fecha_apertura DATE NOT NULL,
  responsable_usuario_id INT UNSIGNED NULL,
  estado ENUM('Pendiente','En seguimiento','Atendido','Cerrado') NOT NULL DEFAULT 'Pendiente',
  proximo_seguimiento DATE NULL COMMENT 'Próxima atención (la de la última actuación)',
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

-- Historial de actuaciones: solo se agregan. Los triggers impiden modificarlas o borrarlas.
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

-- Adiestramiento: participantes inscritos en un curso
CREATE TABLE curso_participantes (
  curso_id INT UNSIGNED NOT NULL,
  persona_id INT UNSIGNED NOT NULL,
  desde DATE NOT NULL,
  PRIMARY KEY (curso_id, persona_id),
  KEY ix_cp_persona (persona_id),
  CONSTRAINT fk_cp_curso FOREIGN KEY (curso_id) REFERENCES cursos (id) ON DELETE CASCADE,
  CONSTRAINT fk_cp_persona FOREIGN KEY (persona_id) REFERENCES personas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Adiestramiento: cada sesión, con su curso, nivel, tema, horario, lugar y quién la impartió
CREATE TABLE sesiones_adiestramiento (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  curso_id INT UNSIGNED NOT NULL,
  nivel_id INT UNSIGNED NULL,
  tema_id INT UNSIGNED NULL,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NULL,
  lugar VARCHAR(160) NOT NULL DEFAULT 'Iglesia',
  adiestrador_persona_id INT UNSIGNED NOT NULL,
  es_sustitucion TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Lo impartió alguien distinto al adiestrador habitual (se fija al guardar)',
  novedades TEXT NOT NULL,
  observaciones TEXT NOT NULL,
  registrado_por INT UNSIGNED NULL,
  registrada DATE NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sesion_curso_fecha_hora (curso_id, fecha, hora_inicio),
  KEY ix_sesiones_fecha (fecha),
  KEY ix_sesiones_adiestrador (adiestrador_persona_id),
  CONSTRAINT fk_ses_curso FOREIGN KEY (curso_id) REFERENCES cursos (id),
  CONSTRAINT fk_ses_nivel FOREIGN KEY (nivel_id) REFERENCES niveles (id),
  CONSTRAINT fk_ses_tema FOREIGN KEY (tema_id) REFERENCES temas (id),
  CONSTRAINT fk_ses_adiestrador FOREIGN KEY (adiestrador_persona_id) REFERENCES personas (id),
  CONSTRAINT fk_ses_registrador FOREIGN KEY (registrado_por) REFERENCES usuarios (id) ON DELETE SET NULL,
  CONSTRAINT chk_ses_horas CHECK (hora_fin IS NULL OR hora_fin > hora_inicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Adiestramiento: asistencia por sesión (la fila existe = asistió)
CREATE TABLE sesion_asistencia (
  sesion_id INT UNSIGNED NOT NULL,
  persona_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (sesion_id, persona_id),
  KEY ix_sa_persona (persona_id),
  CONSTRAINT fk_sa_sesion FOREIGN KEY (sesion_id) REFERENCES sesiones_adiestramiento (id) ON DELETE CASCADE,
  CONSTRAINT fk_sa_persona FOREIGN KEY (persona_id) REFERENCES personas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE finanzas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tipo ENUM('Ofrenda','Diezmo','Primicia','Siembra') NOT NULL,
  fecha DATE NOT NULL,
  valor DECIMAL(12,0) NOT NULL,
  persona VARCHAR(120) NOT NULL DEFAULT '',
  motivo VARCHAR(255) NOT NULL DEFAULT '',
  observaciones TEXT NOT NULL,
  registrado_por INT UNSIGNED NULL,
  registrado DATE NOT NULL,
  PRIMARY KEY (id),
  KEY ix_finanzas_fecha_tipo (fecha, tipo),
  CONSTRAINT fk_finanzas_registrador FOREIGN KEY (registrado_por) REFERENCES usuarios (id) ON DELETE SET NULL,
  CONSTRAINT chk_finanzas_valor CHECK (valor > 0),
  CONSTRAINT chk_finanzas_motivo CHECK (tipo IN ('Ofrenda','Diezmo') OR CHAR_LENGTH(TRIM(motivo)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Auditoría: quién hizo qué y cuándo (acciones importantes)
CREATE TABLE auditoria (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NULL,
  accion ENUM('crear','editar','eliminar','exportar','consultar') NOT NULL,
  entidad VARCHAR(40) NOT NULL,
  registro_id INT UNSIGNED NULL,
  detalle VARCHAR(255) NOT NULL DEFAULT '',
  creado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_auditoria_entidad (entidad, registro_id),
  KEY ix_auditoria_creado (creado),
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE VIEW v_permisos AS
  SELECT r.nombre AS rol, m.nombre AS modulo, GROUP_CONCAT(a.nombre ORDER BY a.id SEPARATOR ', ') AS acciones
  FROM permisos p
  JOIN roles r ON r.id = p.rol_id
  JOIN modulos m ON m.id = p.modulo_id
  JOIN acciones a ON a.id = p.accion_id
  GROUP BY r.id, r.nombre, m.id, m.nombre
  ORDER BY r.id, m.id;

-- Nacido de nuevo: un registro por persona (no implica bautismo)
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

-- Bautismo: un registro por persona (no implica nacimiento de nuevo)
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

-- Actividades generales: tipos configurables (servicios, discipulados de mujeres, seminarios, especiales)
CREATE TABLE tipos_actividad (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  orden SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tipo_actividad_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Actividades generales de la iglesia (no son reuniones de Comunión Familiar)
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
  lista_registrada TINYINT(1) NOT NULL DEFAULT 0,
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

-- Personas que asistieron a cada actividad general: la lista por persona; el total sale de aquí
CREATE TABLE actividad_asistentes (
  actividad_id INT UNSIGNED NOT NULL,
  persona_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (actividad_id, persona_id),
  KEY ix_act_asist_persona (persona_id),
  CONSTRAINT fk_act_asist_actividad FOREIGN KEY (actividad_id) REFERENCES actividades_generales (id) ON DELETE CASCADE,
  CONSTRAINT fk_act_asist_persona FOREIGN KEY (persona_id) REFERENCES personas (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Listado de asistencia: une la lista general, las reuniones de Comunión Familiar y las sesiones de
-- adiestramiento. Solo cuenta a quien asistió (estado P en la lista general; en las otras dos, la presencia
-- registrada). Los reportes consultan esta vista en lugar de recorrer todo el historial en pantalla.
SET NAMES utf8mb4;
DROP VIEW IF EXISTS v_listado_asistencia;
CREATE VIEW v_listado_asistencia AS
  SELECT a.persona_id, p.nombres, p.apellidos, a.fecha,
         'Lista general' AS tipo, 'Lista de asistencia' AS evento
  FROM asistencias a
  JOIN personas p ON p.id = a.persona_id
  WHERE a.estado = 'P'
UNION ALL
  SELECT ra.persona_id, p.nombres, p.apellidos, r.fecha,
         'Comunión Familiar' AS tipo, g.nombre AS evento
  FROM reunion_asistencia ra
  JOIN reuniones r ON r.id = ra.reunion_id
  JOIN grupos g ON g.id = r.grupo_id
  JOIN personas p ON p.id = ra.persona_id
UNION ALL
  SELECT sa.persona_id, p.nombres, p.apellidos, s.fecha,
         'Adiestramiento' AS tipo, c.nombre AS evento
  FROM sesion_asistencia sa
  JOIN sesiones_adiestramiento s ON s.id = sa.sesion_id
  JOIN cursos c ON c.id = s.curso_id
  JOIN personas p ON p.id = sa.persona_id;

-- Entidades promotoras de salud (EPS): lista administrable que sugiere el formulario de persona
CREATE TABLE eps (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(80) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY ux_eps_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles (id, clave, nombre) VALUES
  (1, 'admin', 'Administrador'),
  (2, 'pastor', 'Pastor'),
  (3, 'asistente', 'Asistente Pastor'),
  (4, 'discipulador', 'Discipulador');

INSERT INTO modulos (id, clave, nombre) VALUES
  (1, 'registrar-personas', 'Registrar personas'),
  (2, 'lista-asistencia', 'Lista de asistencia'),
  (3, 'comunion-familiar', 'Comunión Familiar'),
  (4, 'asistencia-pastoral', 'Asistencia Pastoral'),
  (5, 'adiestramiento', 'Adiestramiento'),
  (6, 'finanzas', 'Finanzas'),
  (7, 'tomar-asistencia', 'Tomar asistencia'),
  (8, 'reportes', 'Reportes'),
  (9, 'usuarios-accesos', 'Usuarios y accesos'),
  (10, 'ubicaciones', 'Ubicaciones'),
  (11, 'cumpleanos', 'Cumpleaños'),
  (12, 'catalogo', 'Catálogo de formación'),
  (13, 'nacidos-bautizados', 'Nacidos de nuevo y bautizados'),
  (14, 'categorias-pastorales', 'Categorías de situación pastoral'),
  (15, 'actividades', 'Actividades generales'),
  (16, 'tipos-actividad', 'Tipos de actividad'),
  (17, 'ficha-persona', 'Ficha de persona'),
  (18, 'datos-sensibles', 'Datos sensibles (EPS)');

INSERT INTO acciones (id, clave, nombre) VALUES
  (1, 'registrar', 'Registrar'),
  (2, 'masivo', 'Registro masivo'),
  (3, 'editar', 'Editar'),
  (4, 'eliminar', 'Eliminar'),
  (5, 'consultar', 'Consultar'),
  (6, 'seguimiento', 'Seguimiento'),
  (7, 'reportes', 'Reportes'),
  (8, 'exportar', 'Exportar');

INSERT INTO funciones (id, clave, nombre) VALUES
  (1, 'discipulador', 'Discipulador'),
  (2, 'adiestrador', 'Adiestrador');

INSERT INTO procesos (id, clave, nombre) VALUES
  (1, 'comunion-familiar', 'Comunión Familiar'),
  (2, 'adiestramiento', 'Adiestramiento');

INSERT INTO eps (id, nombre, activo) VALUES
  (1, 'Nueva EPS', 1),
  (2, 'Sanitas', 1),
  (3, 'Sura', 1),
  (4, 'Salud Total', 1),
  (5, 'Compensar', 1),
  (6, 'Coosalud', 1),
  (7, 'Famisanar', 1),
  (8, 'Mutual Ser', 1),
  (9, 'Capital Salud', 1),
  (10, 'Savia Salud', 1),
  (11, 'Asmet Salud', 1),
  (12, 'Emssanar', 1),
  (13, 'Cajacopi', 1),
  (14, 'Salud Mía', 1),
  (15, 'SOS', 1),
  (16, 'Aliansalud', 1);

INSERT INTO cursos (id, proceso_id, nombre, activo) VALUES
  (1, 1, 'Identidad', 1),
  (2, 1, 'Carácter', 1),
  (3, 2, 'Iniciando la vida', 1);

INSERT INTO permisos (rol_id, modulo_id, accion_id) VALUES
  (1, 1, 1),
  (1, 1, 3),
  (1, 1, 4),
  (1, 1, 5),
  (1, 2, 5),
  (1, 2, 1),
  (2, 2, 5),
  (3, 2, 5),
  (3, 2, 1),
  (4, 2, 5),
  (1, 3, 1),
  (1, 3, 3),
  (1, 3, 4),
  (1, 3, 5),
  (1, 3, 7),
  (2, 3, 5),
  (2, 3, 7),
  (3, 3, 5),
  (3, 3, 7),
  (4, 3, 1),
  (4, 3, 5),
  (1, 4, 1),
  (1, 4, 2),
  (1, 4, 3),
  (1, 4, 5),
  (1, 4, 6),
  (1, 4, 7),
  (2, 4, 5),
  (2, 4, 7),
  (3, 4, 1),
  (3, 4, 2),
  (3, 4, 3),
  (3, 4, 5),
  (3, 4, 6),
  (1, 5, 1),
  (1, 5, 2),
  (1, 5, 3),
  (1, 5, 4),
  (1, 5, 5),
  (2, 5, 5),
  (3, 5, 1),
  (3, 5, 2),
  (3, 5, 3),
  (3, 5, 4),
  (3, 5, 5),
  (1, 6, 1),
  (1, 6, 3),
  (1, 6, 4),
  (1, 6, 5),
  (1, 6, 7),
  (2, 6, 5),
  (2, 6, 7),
  (3, 6, 1),
  (3, 6, 5),
  (3, 7, 1),
  (4, 7, 1),
  (1, 8, 5),
  (1, 8, 8),
  (2, 8, 5),
  (2, 8, 8),
  (1, 9, 1),
  (1, 9, 3),
  (1, 9, 4),
  (1, 9, 5),
  (1, 10, 5),
  (2, 10, 5),
  (3, 10, 5),
  (4, 10, 5),
  (1, 11, 5),
  (2, 11, 5),
  (3, 11, 5),
  (4, 11, 5),
  (1, 12, 1),
  (1, 12, 3),
  (1, 12, 5),
  (2, 12, 5),
  (3, 12, 5),
  (4, 12, 5),
  (1, 13, 1),
  (1, 13, 3),
  (1, 13, 4),
  (1, 13, 5),
  (3, 13, 1),
  (3, 13, 3),
  (3, 13, 5),
  (2, 13, 5),
  (1, 14, 1),
  (1, 14, 3),
  (1, 14, 5),
  (2, 14, 5),
  (3, 14, 5),
  (1, 15, 1),
  (1, 15, 3),
  (1, 15, 4),
  (1, 15, 5),
  (2, 15, 5),
  (3, 15, 1),
  (3, 15, 3),
  (3, 15, 5),
  (4, 15, 5),
  (1, 16, 1),
  (1, 16, 3),
  (1, 16, 5),
  (2, 16, 5),
  (3, 16, 5),
  (4, 16, 5),
  (1, 17, 5),
  (2, 17, 5),
  (3, 17, 5),
  (1, 18, 5);

INSERT INTO modulos (id, clave, nombre) VALUES (19, 'grupos', 'Grupos');
INSERT INTO modulo_acciones (modulo_id, accion_id) VALUES (19, 1), (19, 3), (19, 5);
INSERT INTO permisos (rol_id, modulo_id, accion_id) VALUES (1, 19, 1), (1, 19, 3), (1, 19, 5), (3, 19, 1), (3, 19, 3), (3, 19, 5);

INSERT INTO personas (id, nombres, apellidos, nacimiento, telefono, correo, eps, direccion, registrada, creado_por) VALUES
  (1, 'Valentina', 'Rodríguez Silva', '2003-04-12', '310 555 0101', 'valentina.rodriguez@example.com', 'Sanitas', 'Barrio La Esperanza, Cll 12 # 5-30', CURDATE() - INTERVAL 120 DAY, 1),
  (2, 'Mateo', 'Gómez Pardo', '2001-09-30', '311 555 0102', 'mateo.gomez@example.com', 'Nueva EPS', 'Barrio Centro, Cra 20 # 8-14', CURDATE() - INTERVAL 118 DAY, 1),
  (3, 'Sofía', 'Hernández Cruz', '2005-01-22', '312 555 0103', '', 'Sura', 'Barrio Los Pinos, Cll 30 # 14-02', CURDATE() - INTERVAL 100 DAY, 1),
  (4, 'Julián David', 'Castro Ramírez', '1999-11-05', '313 555 0104', 'julian.castro@example.com', 'Compensar', 'Barrio La Vega, Cra 33 # 21-40', CURDATE() - INTERVAL 95 DAY, 1),
  (5, 'Camila', 'Ríos Duarte', '2002-06-18', '314 555 0105', 'camila.rios@example.com', 'Salud Total', 'Barrio Villa Nueva, Cll 8 # 3-27', CURDATE() - INTERVAL 90 DAY, 1),
  (6, 'Daniel Alejandro', 'Herrera León', '2000-02-09', '315 555 0106', 'daniel.herrera@example.com', 'Sanitas', 'Barrio El Recreo, Cra 15 # 11-08', CURDATE() - INTERVAL 88 DAY, 1),
  (7, 'Isabella', 'Moreno Vega', '2004-12-01', '316 555 0107', '', 'Famisanar', 'Barrio Primavera, Cll 22 # 9-16', CURDATE() - INTERVAL 80 DAY, 1),
  (8, 'Nicolás', 'Vargas Prieto', '1997-07-25', '317 555 0108', 'nicolas.vargas@example.com', 'Nueva EPS', 'Barrio Santa Rita, Cra 27 # 18-33', CURDATE() - INTERVAL 75 DAY, 1),
  (9, 'Gabriela', 'Ortega Mora', '2003-10-14', '318 555 0109', 'gabriela.ortega@example.com', 'Coosalud', 'Barrio Buenavista, Cll 40 # 25-11', CURDATE() - INTERVAL 70 DAY, 1),
  (10, 'Samuel', 'Aguirre Bernal', '2006-03-03', '319 555 0110', '', 'Sura', 'Barrio Nuevo Horizonte, Cra 12 # 6-45', CURDATE() - INTERVAL 60 DAY, 1),
  (11, 'Luciana', 'Barrera Soto', '1995-08-19', '320 555 0111', 'luciana.barrera@example.com', 'Salud Total', 'Barrio San José, Cll 15 # 12-20', CURDATE() - INTERVAL 45 DAY, 1),
  (12, 'Emmanuel', 'Ospina Acosta', '2001-05-27', '321 555 0112', 'emmanuel.ospina@example.com', 'Compensar', 'Barrio El Prado, Cra 8 # 30-05', CURDATE() - INTERVAL 30 DAY, 1),
  (13, 'Laura Camila', 'Ortiz', '1990-06-15', '311 555 0123', 'laura.ortiz@example.com', 'Sanitas', 'Barrio Centro, Cll 10 # 4-22', CURDATE() - INTERVAL 150 DAY, 1);

INSERT INTO nacidos_de_nuevo (persona_id, fecha, responsable_persona_id, observaciones, registrado_por, registrada) VALUES
  (1, CURDATE() - INTERVAL 40 DAY, 13, '', 3, CURDATE() - INTERVAL 40 DAY),
  (2, CURDATE() - INTERVAL 15 DAY, 13, '', 3, CURDATE() - INTERVAL 15 DAY);

INSERT INTO bautismos (persona_id, fecha, responsable_persona_id, observaciones, registrado_por, registrada) VALUES
  (1, CURDATE() - INTERVAL 20 DAY, 2, '', 3, CURDATE() - INTERVAL 20 DAY),
  (5, CURDATE() - INTERVAL 5 DAY, 13, '', 3, CURDATE() - INTERVAL 5 DAY);

INSERT INTO usuarios (id, usuario, clave_hash, nombres, apellidos, rol_id, persona_id, activo) VALUES
  (1, 'admin', '$2y$10$bUNi9e9OAILVTTYY3iFSUelmxr6kiQalalkv/5CVYk/ZsGMaFQKnO', 'Sandra Milena', 'Torres', 1, NULL, 1),
  (2, 'pastor', '$2y$10$38VHzPa9Yd9OBRX7sEG/Z.r2G9zpEATvLX14uMpWsYyHBHyQbc3OK', 'Carlos Andrés', 'Mendoza', 2, NULL, 1),
  (3, 'asistente', '$2y$10$1LQWNIDP/wrvZKuKzZoGfe9nkCtd.l3ZQzNc1t2G9cHYRPPHGVsHm', 'Marta Lucía', 'Vargas', 3, NULL, 1),
  (4, 'discipulador', '$2y$10$q2Cq9dPlMNzTjPZqgPe3Ou7A2fmlpxI2cVwtfi2.0ZiJLZHTOSlIq', 'Laura Camila', 'Ortiz', 4, 13, 1);

INSERT INTO persona_funciones (persona_id, funcion_id) VALUES
  (13, 1),
  (13, 2),
  (2, 2);

INSERT INTO asistencias (persona_id, fecha, estado) VALUES
  (1, CURDATE() - INTERVAL 28 DAY, 'P'),
  (1, CURDATE() - INTERVAL 21 DAY, 'P'),
  (1, CURDATE() - INTERVAL 14 DAY, 'P'),
  (1, CURDATE() - INTERVAL 7 DAY, 'P'),
  (2, CURDATE() - INTERVAL 28 DAY, 'P'),
  (2, CURDATE() - INTERVAL 21 DAY, 'P'),
  (2, CURDATE() - INTERVAL 14 DAY, 'F'),
  (2, CURDATE() - INTERVAL 7 DAY, 'P'),
  (3, CURDATE() - INTERVAL 28 DAY, 'P'),
  (3, CURDATE() - INTERVAL 21 DAY, 'P'),
  (3, CURDATE() - INTERVAL 14 DAY, 'P'),
  (3, CURDATE() - INTERVAL 7 DAY, 'E'),
  (4, CURDATE() - INTERVAL 28 DAY, 'F'),
  (4, CURDATE() - INTERVAL 21 DAY, 'F'),
  (4, CURDATE() - INTERVAL 14 DAY, 'P'),
  (4, CURDATE() - INTERVAL 7 DAY, 'F'),
  (5, CURDATE() - INTERVAL 28 DAY, 'P'),
  (5, CURDATE() - INTERVAL 21 DAY, 'P'),
  (5, CURDATE() - INTERVAL 14 DAY, 'P'),
  (5, CURDATE() - INTERVAL 7 DAY, 'P'),
  (6, CURDATE() - INTERVAL 28 DAY, 'P'),
  (6, CURDATE() - INTERVAL 21 DAY, 'P'),
  (6, CURDATE() - INTERVAL 14 DAY, 'P'),
  (6, CURDATE() - INTERVAL 7 DAY, 'P'),
  (7, CURDATE() - INTERVAL 28 DAY, 'P'),
  (7, CURDATE() - INTERVAL 21 DAY, 'F'),
  (7, CURDATE() - INTERVAL 14 DAY, 'P'),
  (7, CURDATE() - INTERVAL 7 DAY, 'P'),
  (8, CURDATE() - INTERVAL 28 DAY, 'P'),
  (8, CURDATE() - INTERVAL 21 DAY, 'P'),
  (8, CURDATE() - INTERVAL 14 DAY, 'E'),
  (8, CURDATE() - INTERVAL 7 DAY, 'P'),
  (9, CURDATE() - INTERVAL 28 DAY, 'P'),
  (9, CURDATE() - INTERVAL 21 DAY, 'F'),
  (9, CURDATE() - INTERVAL 14 DAY, 'F'),
  (9, CURDATE() - INTERVAL 7 DAY, 'P'),
  (10, CURDATE() - INTERVAL 28 DAY, 'F'),
  (10, CURDATE() - INTERVAL 21 DAY, 'P'),
  (10, CURDATE() - INTERVAL 14 DAY, 'F'),
  (10, CURDATE() - INTERVAL 7 DAY, 'P'),
  (11, CURDATE() - INTERVAL 28 DAY, 'P'),
  (11, CURDATE() - INTERVAL 21 DAY, 'P'),
  (11, CURDATE() - INTERVAL 14 DAY, 'P'),
  (11, CURDATE() - INTERVAL 7 DAY, 'F'),
  (12, CURDATE() - INTERVAL 28 DAY, 'E'),
  (12, CURDATE() - INTERVAL 21 DAY, 'P'),
  (12, CURDATE() - INTERVAL 14 DAY, 'F'),
  (12, CURDATE() - INTERVAL 7 DAY, 'P');

INSERT INTO grupos (id, nombre, direccion, fecha_inicio, anfitrion_persona_id, discipulador_persona_id, estado, observaciones, creado, creado_por) VALUES
  (1, 'Casa Rodríguez', 'Barrio La Esperanza, Cll 12 # 5-30', CURDATE() - INTERVAL 200 DAY, 1, 13, 'Activo', '', CURDATE() - INTERVAL 200 DAY, 1),
  (2, 'Casa Herrera', 'Barrio El Recreo, Cra 15 # 11-08', CURDATE() - INTERVAL 150 DAY, 6, 13, 'Activo', '', CURDATE() - INTERVAL 150 DAY, 1);

INSERT INTO grupo_participantes (grupo_id, persona_id, desde) VALUES
  (1, 1, CURDATE() - INTERVAL 200 DAY),
  (1, 2, CURDATE() - INTERVAL 200 DAY),
  (1, 3, CURDATE() - INTERVAL 200 DAY),
  (1, 4, CURDATE() - INTERVAL 200 DAY),
  (2, 6, CURDATE() - INTERVAL 150 DAY),
  (2, 7, CURDATE() - INTERVAL 150 DAY),
  (2, 8, CURDATE() - INTERVAL 150 DAY);

INSERT INTO reuniones (id, grupo_id, fecha, hora_inicio, hora_fin, direccion, anfitrion_persona_id, discipulador_persona_id, impartido_por_persona_id, tema_id, cantidad, ofrenda, novedades, registrado_por, registrada) VALUES
  (1, 1, CURDATE() - INTERVAL 28 DAY, '19:00', '21:00', '', NULL, NULL, NULL, NULL, 4, 45000, 'Asistió además una persona no registrada.', 4, CURDATE() - INTERVAL 28 DAY),
  (2, 1, CURDATE() - INTERVAL 21 DAY, '19:00', '21:00', '', NULL, NULL, NULL, NULL, 5, 38000, '', 4, CURDATE() - INTERVAL 21 DAY),
  (3, 1, CURDATE() - INTERVAL 7 DAY, '19:00', '21:00', '', NULL, NULL, NULL, NULL, 3, 52000, '', 4, CURDATE() - INTERVAL 7 DAY),
  (4, 2, CURDATE() - INTERVAL 20 DAY, '18:30', '20:30', '', NULL, NULL, NULL, NULL, 3, 60000, '', 4, CURDATE() - INTERVAL 20 DAY),
  (5, 2, CURDATE() - INTERVAL 6 DAY, '18:30', '20:30', '', NULL, NULL, NULL, NULL, 2, 41000, '', 4, CURDATE() - INTERVAL 6 DAY);

INSERT INTO reunion_asistencia (reunion_id, persona_id) VALUES
  (1, 1),
  (1, 2),
  (1, 3),
  (2, 1),
  (2, 2),
  (2, 4),
  (3, 1),
  (3, 2),
  (3, 3),
  (4, 6),
  (4, 7),
  (4, 8),
  (5, 6),
  (5, 7);

INSERT INTO reunion_visitantes (reunion_id, nombre, persona_id) VALUES
  (2, 'Una visita', NULL);

INSERT INTO modulo_acciones (modulo_id, accion_id) VALUES
  (1, 1),
  (1, 3),
  (1, 4),
  (1, 5),
  (2, 1),
  (2, 5),
  (3, 1),
  (3, 3),
  (3, 4),
  (3, 5),
  (3, 7),
  (4, 1),
  (4, 2),
  (4, 3),
  (4, 5),
  (4, 6),
  (4, 7),
  (5, 1),
  (5, 2),
  (5, 3),
  (5, 4),
  (5, 5),
  (6, 1),
  (6, 3),
  (6, 4),
  (6, 5),
  (6, 7),
  (7, 1),
  (8, 5),
  (8, 8),
  (9, 1),
  (9, 3),
  (9, 4),
  (9, 5),
  (10, 5),
  (11, 5),
  (12, 1),
  (12, 3),
  (12, 5),
  (13, 1),
  (13, 3),
  (13, 4),
  (13, 5),
  (14, 1),
  (14, 3),
  (14, 5),
  (15, 1),
  (15, 3),
  (15, 4),
  (15, 5),
  (16, 1),
  (16, 3),
  (16, 5),
  (17, 5),
  (18, 5);

INSERT INTO tipos_actividad (id, nombre, activo, orden) VALUES
  (1, 'Servicio dominical', 1, 1),
  (2, 'Discipulado de mujeres', 1, 2),
  (3, 'Seminario', 1, 3),
  (4, 'Actividad especial', 1, 4);

INSERT INTO actividades_generales (id, tipo_id, fecha, hora_inicio, hora_fin, lugar, responsable_persona_id, asistentes, observaciones, registrado_por, registrado) VALUES
  (1, 1, '2026-10-11', '09:00', '11:30', 'Templo principal', NULL, 92, '', 1, NOW()),
  (2, 1, '2026-10-04', '09:00', '11:30', 'Templo principal', NULL, 85, '', 3, NOW()),
  (3, 2, '2026-10-08', '18:30', '20:00', 'Salón 2', 3, 24, '', 3, NOW()),
  (4, 3, '2026-09-19', '08:00', '16:00', 'Salón principal', 4, 40, '', 1, NOW()),
  (5, 4, '2026-08-29', '19:00', '21:00', 'Parque central', NULL, 60, '', 1, NOW());

INSERT INTO categorias_pastorales (id, nombre, activo, orden) VALUES
  (1, 'Pérdida de un ser querido', 1, 1),
  (2, 'Enfermedad de un familiar', 1, 2),
  (3, 'Crisis familiar', 1, 3),
  (4, 'Restauración espiritual', 1, 4);

INSERT INTO casos_pastorales (id, persona_id, categoria_id, descripcion, fecha_apertura, responsable_usuario_id, estado, proximo_seguimiento, creado_por, creado) VALUES
  (1, 4, 2, 'El papá de Julián está delicado de salud y la familia ha faltado a las últimas reuniones.', CURDATE() - INTERVAL 25 DAY, 3, 'En seguimiento', CURDATE() + INTERVAL 2 DAY, 3, CURDATE() - INTERVAL 25 DAY),
  (2, 9, 3, 'Dificultades económicas y personales en el hogar.', CURDATE() - INTERVAL 18 DAY, 3, 'Cerrado', NULL, 3, CURDATE() - INTERVAL 18 DAY),
  (3, 10, 4, 'Ha estado alejado de las reuniones; se le visitó para animarlo a regresar.', CURDATE() - INTERVAL 10 DAY, 3, 'Pendiente', CURDATE() + INTERVAL 2 DAY, 3, CURDATE() - INTERVAL 10 DAY),
  (4, 11, 1, 'Falleció su madre; se acompañó a la familia en el velorio.', CURDATE() - INTERVAL 35 DAY, 1, 'Atendido', NULL, 1, CURDATE() - INTERVAL 35 DAY),
  (5, 12, 3, 'Familia en situación de dificultad.', CURDATE() - INTERVAL 12 DAY, 3, 'En seguimiento', CURDATE() - INTERVAL 2 DAY, 3, CURDATE() - INTERVAL 12 DAY);

INSERT INTO actuaciones_pastorales (id, caso_id, fecha, responsable_usuario_id, actividad, observaciones, estado, proximo_seguimiento, registrada_por, registrada) VALUES
  (1, 1, CURDATE() - INTERVAL 25 DAY, 3, 'Visita a la casa y oración por la familia.', 'Se coordinó llevarles un mercado.', 'En seguimiento', CURDATE() - INTERVAL 22 DAY, 3, NOW()),
  (2, 1, CURDATE() - INTERVAL 3 DAY, 3, 'Llamada de seguimiento.', 'Su papá sigue en casa; se acordó otra visita.', 'En seguimiento', CURDATE() + INTERVAL 2 DAY, 3, NOW()),
  (3, 2, CURDATE() - INTERVAL 18 DAY, 3, 'Consejería y oración.', '', 'Cerrado', NULL, 3, NOW()),
  (4, 3, CURDATE() - INTERVAL 10 DAY, 3, 'Visita y oración.', 'Prometió volver la próxima semana.', 'Pendiente', CURDATE() + INTERVAL 2 DAY, 3, NOW()),
  (5, 4, CURDATE() - INTERVAL 35 DAY, 1, 'Acompañamiento y palabra de consuelo.', '', 'Atendido', NULL, 1, NOW()),
  (6, 5, CURDATE() - INTERVAL 12 DAY, 3, 'Llamada de acompañamiento.', '', 'En seguimiento', CURDATE() - INTERVAL 2 DAY, 3, NOW());

UPDATE cursos SET responsable_persona_id = 2 WHERE id = 3;

INSERT INTO curso_participantes (curso_id, persona_id, desde) VALUES
  (3, 1, CURDATE() - INTERVAL 30 DAY),
  (3, 2, CURDATE() - INTERVAL 30 DAY),
  (3, 3, CURDATE() - INTERVAL 30 DAY),
  (3, 4, CURDATE() - INTERVAL 30 DAY),
  (3, 5, CURDATE() - INTERVAL 30 DAY);

INSERT INTO sesiones_adiestramiento (id, curso_id, nivel_id, tema_id, fecha, hora_inicio, hora_fin, lugar, adiestrador_persona_id, es_sustitucion, novedades, observaciones, registrado_por, registrada) VALUES
  (1, 3, NULL, NULL, '2026-10-01', '18:00', '19:30', 'Iglesia', 2, 0, '', 'Primera sesión de la serie.', 3, '2026-10-01'),
  (2, 3, NULL, NULL, '2026-10-08', '18:00', '19:30', 'Iglesia', 2, 0, '', '', 3, '2026-10-08'),
  (3, 3, NULL, NULL, '2026-10-15', '18:00', '19:30', 'Iglesia', 13, 1, 'Mateo no pudo asistir; la clase la impartió Laura Camila Ortiz.', '', 3, '2026-10-15');

INSERT INTO sesion_asistencia (sesion_id, persona_id) VALUES
  (1, 1),
  (1, 2),
  (1, 3),
  (2, 1),
  (2, 2),
  (2, 4),
  (2, 5),
  (3, 1),
  (3, 3),
  (3, 5);

INSERT INTO finanzas (tipo, fecha, valor, persona, motivo, observaciones, registrado_por, registrado) VALUES
  ('Diezmo', CURDATE() - INTERVAL 6 DAY, 150000, 'Valentina Rodríguez', '', '', 3, CURDATE() - INTERVAL 6 DAY),
  ('Ofrenda', CURDATE() - INTERVAL 6 DAY, 320000, '', '', 'Ofrenda general del culto.', 3, CURDATE() - INTERVAL 6 DAY),
  ('Diezmo', CURDATE() - INTERVAL 13 DAY, 180000, 'Daniel Herrera', '', '', 3, CURDATE() - INTERVAL 13 DAY),
  ('Primicia', CURDATE() - INTERVAL 20 DAY, 100000, 'Camila Ríos', 'Primicias de su nuevo empleo.', '', 1, CURDATE() - INTERVAL 20 DAY),
  ('Siembra', CURDATE() - INTERVAL 9 DAY, 200000, 'Mateo Gómez', 'Siembra para el proyecto de remodelación del templo.', '', 3, CURDATE() - INTERVAL 9 DAY),
  ('Ofrenda', CURDATE() - INTERVAL 1 DAY, 275000, '', '', '', 3, CURDATE() - INTERVAL 1 DAY);

SET FOREIGN_KEY_CHECKS = 1;

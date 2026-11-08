-- =====================================================================
--  SIGAP · Migración de la versión 11 a la versión 12 (ficha de persona)
--
--  Úsala SOLO si ya tienes datos reales de la versión 11 y quieres conservarlos.
--  Si instalas desde cero, importa database/sigap.sql en su lugar.
--  Ejecútala UNA sola vez, y antes haz una copia de seguridad de la base «sigap».
--
--  Qué hace:
--   · Agrega el módulo «Ficha de persona» (Administrador, Pastor y Asistente Pastor).
--   · Agrega el permiso «Datos sensibles», que muestra la EPS solo al Administrador.
--   · Hace que la auditoría registre cada consulta de una ficha (acción «consultar»).
--   · No cambia ningún dato existente.
-- =====================================================================

USE sigap;

ALTER TABLE auditoria
  MODIFY accion ENUM('crear','editar','eliminar','exportar','consultar') NOT NULL;

INSERT INTO modulos (clave, nombre) VALUES
  ('ficha-persona', 'Ficha de persona'),
  ('datos-sensibles', 'Datos sensibles (EPS)');

INSERT INTO modulo_acciones (modulo_id, accion_id)
SELECT m.id, a.id
FROM modulos m
JOIN acciones a ON a.clave = 'consultar'
WHERE m.clave IN ('ficha-persona', 'datos-sensibles');

INSERT INTO permisos (rol_id, modulo_id, accion_id)
SELECT r.id, m.id, a.id
FROM roles r
JOIN modulos m ON m.clave = 'ficha-persona'
JOIN acciones a ON a.clave = 'consultar'
WHERE r.clave IN ('admin', 'pastor', 'asistente');

INSERT INTO permisos (rol_id, modulo_id, accion_id)
SELECT r.id, m.id, a.id
FROM roles r
JOIN modulos m ON m.clave = 'datos-sensibles'
JOIN acciones a ON a.clave = 'consultar'
WHERE r.clave = 'admin';

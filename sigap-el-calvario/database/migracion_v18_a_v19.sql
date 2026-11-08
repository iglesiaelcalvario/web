-- =====================================================================
--  SIGAP · Migración de la versión 18 a la versión 19 (registro de la asistencia del día)
--
--  Úsala SOLO si ya tienes datos reales de la versión 18 y quieres conservarlos.
--  Si instalas desde cero, importa database/sigap.sql en su lugar.
--  Ejecútala UNA sola vez, y antes haz una copia de seguridad de la base «sigap».
--
--  Qué hace:
--   · Da al administrador y al asistente pastor el permiso de registrar en «Lista de asistencia».
--   · No cambia la tabla asistencias: las marcas diarias ya tienen su lugar.
-- =====================================================================
SET NAMES utf8mb4;

INSERT INTO modulo_acciones (modulo_id, accion_id)
SELECT m.id, a.id FROM modulos m JOIN acciones a ON a.clave = 'registrar'
WHERE m.clave = 'lista-asistencia'
  AND NOT EXISTS (SELECT 1 FROM modulo_acciones x WHERE x.modulo_id = m.id AND x.accion_id = a.id);

INSERT INTO permisos (rol_id, modulo_id, accion_id)
SELECT r.id, m.id, a.id FROM roles r
JOIN modulos m ON m.clave = 'lista-asistencia'
JOIN acciones a ON a.clave = 'registrar'
WHERE r.clave IN ('admin', 'asistente')
  AND NOT EXISTS (SELECT 1 FROM permisos p WHERE p.rol_id = r.id AND p.modulo_id = m.id AND p.accion_id = a.id);

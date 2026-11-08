-- =====================================================================
--  SIGAP · Migración de la versión 12 a la versión 13 (listado de asistencia)
--
--  Úsala SOLO si ya tienes datos reales de la versión 12 y quieres conservarlos.
--  Si instalas desde cero, importa database/sigap.sql en su lugar.
--  Ejecútala UNA sola vez, y antes haz una copia de seguridad de la base «sigap».
--
--  Qué hace:
--   · Crea la vista v_listado_asistencia, que une la lista general, las reuniones de
--     Comunión Familiar y las sesiones de adiestramiento: nombre, fecha, tipo y evento.
--     Los reportes la consultan en lugar de recorrer todo el historial.
--   · No cambia ningún dato existente.
-- =====================================================================

USE sigap;

-- Fija la codificación UTF-8 antes de crear la vista, para que los textos con tilde (Comunión) se guarden bien.
SET NAMES utf8mb4;

CREATE OR REPLACE VIEW v_listado_asistencia AS
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

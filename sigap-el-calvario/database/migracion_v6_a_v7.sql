-- =====================================================================
--  SIGAP · Migración de la versión 6 a la versión 7 (reportes en PDF)
--
--  Úsala SOLO si ya tienes datos reales de la versión 6 y quieres conservarlos.
--  Si instalas desde cero, importa database/sigap.sql en su lugar.
--  Ejecútala UNA sola vez, y antes haz una copia de seguridad de la base «sigap».
--
--  Qué hace:
--   · Agrega la acción «Exportar» y se la da al administrador y al pastor en Reportes:
--     así pueden descargar el reporte general en PDF.
--   · La auditoría registra también cada descarga de reporte.
--   · No cambia ningún dato existente.
-- =====================================================================
SET NAMES utf8mb4;
USE `sigap`;

ALTER TABLE auditoria MODIFY accion ENUM('crear','editar','eliminar','exportar') NOT NULL;

INSERT INTO acciones (clave, nombre) VALUES ('exportar', 'Exportar');

INSERT INTO permisos (rol_id, modulo_id, accion_id)
  SELECT r.id, m.id, a.id
  FROM roles r
  JOIN modulos m ON m.clave = 'reportes'
  JOIN acciones a ON a.clave = 'exportar'
  WHERE r.clave IN ('admin', 'pastor');

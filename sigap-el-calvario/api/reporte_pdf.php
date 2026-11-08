<?php
/* GET api/reporte_pdf.php?periodo=semana|mes|anio|rango|todo[&desde=AAAA-MM-DD][&hasta=AAAA-MM-DD]
   Descarga el reporte general en PDF con los mismos datos y filtros de la pantalla de Reportes.
   Requiere el permiso «exportar» en Reportes (administrador y pastor). Cada descarga queda en la auditoría. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';
require __DIR__ . '/lib/reporte.php';
require __DIR__ . '/lib/reporte_pdf.php';
require __DIR__ . '/lib/cumple.php';
require __DIR__ . '/lib/reporte_asistencia.php';
require __DIR__ . '/lib/reporte_secciones.php';

solo_metodos(['GET']);
$u = exigir_usuario();
exigir_permiso($u, 'reportes', 'exportar', 'Tu cargo no puede descargar reportes.');

$periodo = isset($_GET['periodo']) && is_string($_GET['periodo']) ? $_GET['periodo'] : 'mes';
if (!isset(ETIQUETAS_PERIODO[$periodo])) {
    fallar_validacion([['campo' => 'periodo', 'texto' => 'El período no es válido.']]);
}
$desde = isset($_GET['desde']) && is_string($_GET['desde']) ? trim($_GET['desde']) : '';
$hasta = isset($_GET['hasta']) && is_string($_GET['hasta']) ? trim($_GET['hasta']) : '';
if ($periodo === 'rango') {
    $e = [];
    if ($desde !== '' && !es_fecha($desde)) {
        $e[] = ['campo' => 'desde', 'texto' => 'La fecha inicial no es válida.'];
    }
    if ($hasta !== '' && !es_fecha($hasta)) {
        $e[] = ['campo' => 'hasta', 'texto' => 'La fecha final no es válida.'];
    }
    if (!$e && $desde !== '' && $hasta !== '' && $desde > $hasta) {
        $e[] = ['campo' => 'hasta', 'texto' => 'La fecha final no puede ser anterior a la inicial.'];
    }
    if ($e) {
        fallar_validacion($e);
    }
} else {
    $desde = '';
    $hasta = '';
}

// Mes y año de la lista de cumpleaños (el que se elige en la sección Cumpleaños)
$mes = isset($_GET['mes']) ? (int)$_GET['mes'] : (int)substr(hoy(), 5, 2);
$anio = isset($_GET['anio']) ? (int)$_GET['anio'] : (int)substr(hoy(), 0, 4);
if ($mes < 1 || $mes > 12) {
    fallar_validacion([['campo' => 'mes', 'texto' => 'El mes no es válido.']]);
}
if ($anio < 2000 || $anio > 2100) {
    fallar_validacion([['campo' => 'anio', 'texto' => 'El año no es válido.']]);
}

$datos = reporte_datos($u, $periodo, $desde, $hasta);
$datos['extras'] = [
    seccion_datos('cumpleanos', $u, $periodo, $desde, $hasta, $mes, $anio),
    seccion_datos('lista', $u, $periodo, $desde, $hasta, $mes, $anio),
];
$pdf = reporte_pdf(reporte_html($datos));
auditar($u, 'exportar', 'reportes', null, 'PDF · ' . $periodo
    . ($desde !== '' ? ' desde ' . $desde : '') . ($hasta !== '' ? ' hasta ' . $hasta : ''));

$nombre = 'reporte-sigap-' . $periodo . '-' . hoy() . '.pdf';
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $nombre . '"');
header('Content-Length: ' . strlen($pdf));
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
echo $pdf;
exit;

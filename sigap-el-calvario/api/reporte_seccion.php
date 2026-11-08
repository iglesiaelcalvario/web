<?php
/* api/reporte_seccion.php  (Reportes por sección: una sección de la pantalla de Reportes, sola)
   GET ?seccion=comunion|actividades|pastoral|adiestramiento|nacidos|bautizados|pendientes|finanzas|cumpleanos|listado|lista
       [&periodo=semana|mes|anio|rango|todo][&desde=AAAA-MM-DD&hasta=AAAA-MM-DD]
       [&mes=1..12&anio=AAAA]           (solo para cumpleanos)
       [&formato=pdf|csv|json]
   PDF y CSV para descargar (permiso «exportar» en Reportes). JSON para consultar (permiso «consultar»). */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';
require __DIR__ . '/lib/reporte.php';
require __DIR__ . '/lib/reporte_pdf.php';
require __DIR__ . '/lib/cumple.php';
require __DIR__ . '/lib/reporte_asistencia.php';
require __DIR__ . '/lib/reporte_secciones.php';

$metodo = solo_metodos(['GET']);
$u = exigir_usuario();

$formato = isset($_GET['formato']) && is_string($_GET['formato']) ? trim($_GET['formato']) : 'pdf';
if (!in_array($formato, ['pdf', 'csv', 'json'], true)) {
    fallar_validacion([['campo' => 'formato', 'texto' => 'El formato no es válido.']]);
}
if ($formato === 'json') {
    exigir_permiso($u, 'reportes', 'consultar', 'Tu cargo no puede ver reportes.');
} else {
    exigir_permiso($u, 'reportes', 'exportar', 'Tu cargo no puede descargar reportes.');
}

$e = [];
$clave = isset($_GET['seccion']) && is_string($_GET['seccion']) ? trim($_GET['seccion']) : '';
if (!isset(SECCIONES_REPORTE[$clave])) {
    $e[] = ['campo' => 'seccion', 'texto' => 'Elige una sección del reporte.'];
}

$periodo = isset($_GET['periodo']) && is_string($_GET['periodo']) ? $_GET['periodo'] : 'mes';
if (!isset(ETIQUETAS_PERIODO[$periodo])) {
    $e[] = ['campo' => 'periodo', 'texto' => 'El período no es válido.'];
}

$desde = '';
$hasta = '';
if ($periodo === 'rango') {
    $desde = isset($_GET['desde']) && is_string($_GET['desde']) ? trim($_GET['desde']) : '';
    $hasta = isset($_GET['hasta']) && is_string($_GET['hasta']) ? trim($_GET['hasta']) : '';
    if ($desde === '' || !es_fecha($desde)) {
        $e[] = ['campo' => 'desde', 'texto' => 'La fecha inicial no es válida.'];
    }
    if ($hasta === '' || !es_fecha($hasta)) {
        $e[] = ['campo' => 'hasta', 'texto' => 'La fecha final no es válida.'];
    }
    if (!$e && $desde > $hasta) {
        $e[] = ['campo' => 'hasta', 'texto' => 'La fecha final no puede ser anterior a la inicial.'];
    }
}

$mes = isset($_GET['mes']) ? (int)$_GET['mes'] : (int)substr(hoy(), 5, 2);
$anio = isset($_GET['anio']) ? (int)$_GET['anio'] : (int)substr(hoy(), 0, 4);
if ($clave === 'cumpleanos') {
    if ($mes < 1 || $mes > 12) {
        $e[] = ['campo' => 'mes', 'texto' => 'El mes no es válido.'];
    }
    if ($anio < 2000 || $anio > 2100) {
        $e[] = ['campo' => 'anio', 'texto' => 'El año no es válido.'];
    }
}

if ($e) {
    fallar_validacion($e);
}

$datos = seccion_datos($clave, $u, $periodo, $desde, $hasta, $mes, $anio);

if ($formato === 'json') {
    responder(200, $datos + ['total' => count($datos['filas'])]);
}

auditar($u, 'exportar', 'reporte-seccion', null, 'seccion=' . $clave . ' periodo=' . $periodo . ' formato=' . $formato . ' filas=' . count($datos['filas']));
$nombre = 'reporte-' . $clave . '-' . hoy();

if ($formato === 'csv') {
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="' . $nombre . '.csv"');
    header('Cache-Control: no-store');
    echo "\xEF\xBB\xBF";
    $salida = fopen('php://output', 'w');
    $titulos = array_map(function ($c) { return $c['t']; }, $datos['columnas']);
    fputcsv($salida, $titulos, ';');
    foreach ($datos['filas'] as $fila) {
        fputcsv($salida, $fila, ';');
    }
    fclose($salida);
    exit;
}

$pdf = reporte_pdf(seccion_html($datos));
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $nombre . '.pdf"');
header('Content-Length: ' . strlen($pdf));
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
echo $pdf;
exit;

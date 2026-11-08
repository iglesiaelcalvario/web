<?php
/* api/reporte_asistencia.php  (reporte de la lista de asistencia: una persona, un día o en general)
   GET ?modo=general|persona|dia[&desde=AAAA-MM-DD&hasta=AAAA-MM-DD][&personaId=N][&fecha=AAAA-MM-DD]
       [&filtro=todas|faltas2][&formato=json|csv|pdf]
   JSON para la pantalla (permiso «consultar» en Reportes). CSV o PDF para descargar (permiso «exportar»).
   Sin fechas, el período general son los últimos 30 días. Las excusas cuentan como falta. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';
require __DIR__ . '/lib/reporte.php';
require __DIR__ . '/lib/reporte_pdf.php';
require __DIR__ . '/lib/reporte_asistencia.php';

$metodo = solo_metodos(['GET']);
$u = exigir_usuario();

$formato = isset($_GET['formato']) ? trim((string)$_GET['formato']) : 'json';
if (!in_array($formato, ['json', 'csv', 'pdf'], true)) {
    fallar_validacion([['campo' => 'formato', 'texto' => 'El formato no es válido.']]);
}
// Ver en pantalla pide consultar; descargar (CSV o PDF) pide exportar
if ($formato === 'json') {
    exigir_permiso($u, 'reportes', 'consultar', 'Tu cargo no puede ver reportes.');
} else {
    exigir_permiso($u, 'reportes', 'exportar', 'Tu cargo no puede descargar reportes.');
}

$modo = isset($_GET['modo']) ? trim((string)$_GET['modo']) : 'general';
$hoy = hoy();
$e = [];
if (!in_array($modo, ['general', 'persona', 'dia'], true)) {
    $e[] = ['campo' => 'modo', 'texto' => 'El tipo de reporte no es válido.'];
}

$p = ['modo' => $modo];
if ($modo === 'dia') {
    $fecha = isset($_GET['fecha']) && trim((string)$_GET['fecha']) !== '' ? trim((string)$_GET['fecha']) : $hoy;
    if (!es_fecha($fecha)) {
        $e[] = ['campo' => 'fecha', 'texto' => 'La fecha no es válida.'];
    } elseif ($fecha > $hoy) {
        $e[] = ['campo' => 'fecha', 'texto' => 'La fecha no puede ser futura.'];
    }
    $p['fecha'] = $fecha;
} elseif (in_array($modo, ['general', 'persona'], true)) {
    $hasta = isset($_GET['hasta']) && trim((string)$_GET['hasta']) !== '' ? trim((string)$_GET['hasta']) : $hoy;
    $desde = isset($_GET['desde']) && trim((string)$_GET['desde']) !== '' ? trim((string)$_GET['desde']) : null;
    if (!es_fecha($hasta)) {
        $e[] = ['campo' => 'hasta', 'texto' => 'La fecha final no es válida.'];
    } elseif ($hasta > $hoy) {
        $e[] = ['campo' => 'hasta', 'texto' => 'La fecha final no puede ser futura.'];
    }
    if ($desde === null && es_fecha($hasta)) {
        $desde = date('Y-m-d', strtotime($hasta . ' -29 days'));
    }
    if ($desde === null || !es_fecha($desde)) {
        $e[] = ['campo' => 'desde', 'texto' => 'La fecha inicial no es válida.'];
    } elseif (es_fecha($hasta) && $desde > $hasta) {
        $e[] = ['campo' => 'hasta', 'texto' => 'La fecha final debe ser igual o posterior a la inicial.'];
    } elseif (es_fecha($hasta) && (strtotime($hasta) - strtotime($desde)) / 86400 > DIAS_MAXIMOS_REPORTE) {
        $e[] = ['campo' => 'desde', 'texto' => 'El período no puede pasar de dos años.'];
    }
    $p['desde'] = $desde;
    $p['hasta'] = $hasta;

    if ($modo === 'persona') {
        $pid = isset($_GET['personaId']) ? (int)$_GET['personaId'] : 0;
        $existe = false;
        if ($pid > 0) {
            $st = bd()->prepare('SELECT 1 FROM personas WHERE id = ?');
            $st->execute([$pid]);
            $existe = (bool)$st->fetchColumn();
        }
        if (!$existe) {
            $e[] = ['campo' => 'personaId', 'texto' => 'Elige una persona que exista.'];
        }
        $p['personaId'] = $pid;
    }

    $filtro = isset($_GET['filtro']) ? trim((string)$_GET['filtro']) : 'todas';
    if (!in_array($filtro, ['todas', 'faltas2'], true)) {
        $e[] = ['campo' => 'filtro', 'texto' => 'El filtro no es válido.'];
    }
    $p['filtro'] = $filtro;
}

if ($e) {
    fallar_validacion($e);
}

$datos = asistencia_datos($p);

if ($formato === 'json') {
    responder(200, $datos + ['total' => count($datos['filas'])]);
}

$nombre = 'asistencia_' . $modo . '_' . hoy();
auditar($u, 'exportar', 'reporte-asistencia', null, 'modo=' . $modo . ' formato=' . $formato . ' filas=' . count($datos['filas']));

if ($formato === 'csv') {
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="' . $nombre . '.csv"');
    header('Cache-Control: no-store');
    echo "\xEF\xBB\xBF";
    $salida = fopen('php://output', 'w');
    fputcsv($salida, $datos['columnas'], ';');
    foreach ($datos['filas'] as $fila) {
        fputcsv($salida, $fila, ';');
    }
    fclose($salida);
    exit;
}

$pdf = reporte_pdf(asistencia_html($datos));
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $nombre . '.pdf"');
header('Content-Length: ' . strlen($pdf));
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
echo $pdf;
exit;

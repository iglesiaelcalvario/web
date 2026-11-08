<?php
/* api/listado_asistencia.php  (módulo «reportes»: Administrador y Pastor)
   GET ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&tipo=todos|Lista general|Comunión Familiar|Adiestramiento&formato=json|csv
   El listado sale de la vista v_listado_asistencia: quien asistió, cuándo y a qué evento.
   Cada consulta trae solo las filas del período y del tipo que se piden; la exportación CSV trae todas. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'reportes';
const TIPOS_LISTADO = ['todos', 'Lista general', 'Comunión Familiar', 'Adiestramiento'];
const MAXIMO_EN_PANTALLA = 5000;

$metodo = solo_metodos(['GET']);
$u = exigir_usuario();
exigir_permiso($u, MODULO, 'consultar', 'Tu cargo no puede ver reportes.');

$desde = isset($_GET['desde']) ? trim((string)$_GET['desde']) : '';
$hasta = isset($_GET['hasta']) ? trim((string)$_GET['hasta']) : '';
$tipo = isset($_GET['tipo']) ? trim((string)$_GET['tipo']) : 'todos';
$formato = isset($_GET['formato']) ? trim((string)$_GET['formato']) : 'json';

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
if (!in_array($tipo, TIPOS_LISTADO, true)) {
    $e[] = ['campo' => 'tipo', 'texto' => 'El tipo de listado no es válido.'];
}
if (!in_array($formato, ['json', 'csv'], true)) {
    $e[] = ['campo' => 'formato', 'texto' => 'El formato no es válido.'];
}
if ($e) {
    fallar_validacion($e);
}
if ($formato === 'csv' && !tiene_permiso($u, MODULO, 'exportar')) {
    fallar(403, 'permiso', 'Tu cargo no puede exportar reportes.');
}

$condiciones = [];
$params = [];
if ($desde !== '') {
    $condiciones[] = 'fecha >= ?';
    $params[] = $desde;
}
if ($hasta !== '') {
    $condiciones[] = 'fecha <= ?';
    $params[] = $hasta;
}
if ($tipo !== 'todos') {
    $condiciones[] = 'tipo = ?';
    $params[] = $tipo;
}
$donde = $condiciones ? ' WHERE ' . implode(' AND ', $condiciones) : '';

// Cuántas filas hay por tipo, dentro del período y del tipo pedidos
$st = bd()->prepare('SELECT tipo, COUNT(*) AS n FROM v_listado_asistencia' . $donde . ' GROUP BY tipo');
$st->execute($params);
$porTipo = ['Lista general' => 0, 'Comunión Familiar' => 0, 'Adiestramiento' => 0];
$total = 0;
foreach ($st->fetchAll() as $f) {
    $porTipo[$f['tipo']] = (int)$f['n'];
    $total += (int)$f['n'];
}

$orden = ' ORDER BY fecha DESC, apellidos, nombres, tipo';

if ($formato === 'csv') {
    /* ---------- Exportación para Excel: todas las filas, separadas por punto y coma ---------- */
    $st = bd()->prepare('SELECT apellidos, nombres, fecha, tipo, evento FROM v_listado_asistencia' . $donde . $orden);
    $st->execute($params);
    $nombre = 'listado_asistencia_' . hoy() . '.csv';
    auditar($u, 'exportar', 'listado-asistencia', null, "tipo=$tipo desde=" . ($desde ?: '-') . ' hasta=' . ($hasta ?: '-') . " filas=$total");
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="' . $nombre . '"');
    header('Cache-Control: no-store');
    echo "\xEF\xBB\xBF";
    $salida = fopen('php://output', 'w');
    fputcsv($salida, ['Apellidos', 'Nombres', 'Fecha', 'Tipo', 'Evento'], ';');
    foreach ($st as $f) {
        fputcsv($salida, [$f['apellidos'], $f['nombres'], $f['fecha'], $f['tipo'], $f['evento']], ';');
    }
    fclose($salida);
    exit;
}

/* ---------- Listado en pantalla: como máximo MAXIMO_EN_PANTALLA filas ---------- */
$st = bd()->prepare('SELECT persona_id, apellidos, nombres, fecha, tipo, evento FROM v_listado_asistencia'
                    . $donde . $orden . ' LIMIT ' . MAXIMO_EN_PANTALLA);
$st->execute($params);
$filas = [];
foreach ($st->fetchAll() as $f) {
    $filas[] = ['personaId' => (int)$f['persona_id'], 'apellidos' => $f['apellidos'], 'nombres' => $f['nombres'],
                'fecha' => $f['fecha'], 'tipo' => $f['tipo'], 'evento' => $f['evento']];
}
responder(200, [
    'filas' => $filas,
    'total' => $total,
    'porTipo' => $porTipo,
    'truncado' => $total > MAXIMO_EN_PANTALLA,
]);

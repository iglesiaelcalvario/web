<?php
/* api/asistencias.php  (lista de asistencia general: la marca de cada persona para un día)
   PUT  {fecha, marcas: [{personaId, estado: "P" | "F" | "E" | null}, …]}  → registrar o corregir la asistencia de un día
                                                                             (permiso «registrar» en Lista de asistencia)
   Solo se guardan las marcas enviadas. Un estado null quita la marca de esa persona en ese día.
   Todo se valida antes de guardar: si una marca no es válida, no se cambia nada. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'lista-asistencia';
const ESTADOS = ['P', 'F', 'E'];
const MAX_MARCAS = 1000;

$metodo = solo_metodos(['PUT']);
$u = exigir_usuario();
exigir_csrf();
exigir_permiso($u, MODULO, 'registrar', 'Tu cargo no puede registrar la asistencia.');

$d = leer_json();
$e = [];

// Fecha: obligatoria, válida y no futura
$fecha = linea(dato($d, 'fecha'));
if ($fecha === '' || !es_fecha($fecha)) {
    $e[] = ['campo' => 'fecha', 'texto' => 'Elige una fecha válida.'];
} elseif ($fecha > hoy()) {
    $e[] = ['campo' => 'fecha', 'texto' => 'La fecha no puede ser futura.'];
}

// Marcas: una lista con una entrada por persona
$limpias = [];
$marcas = isset($d['marcas']) && is_array($d['marcas']) ? $d['marcas'] : null;
if ($marcas === null) {
    $e[] = ['campo' => 'marcas', 'texto' => 'La lista de marcas no es válida.'];
} elseif (count($marcas) > MAX_MARCAS) {
    $e[] = ['campo' => 'marcas', 'texto' => 'Hay demasiadas marcas en un solo envío.'];
} else {
    $vistos = [];
    foreach ($marcas as $m) {
        $pid = is_array($m) && isset($m['personaId']) ? $m['personaId'] : null;
        $estado = is_array($m) && array_key_exists('estado', $m) ? $m['estado'] : 'no-valido';
        if (!(is_int($pid) || (is_string($pid) && ctype_digit($pid))) || (int)$pid <= 0) {
            $e[] = ['campo' => 'marcas', 'texto' => 'Una marca no tiene una persona válida.'];
            break;
        }
        if (!($estado === null || (is_string($estado) && in_array($estado, ESTADOS, true)))) {
            $e[] = ['campo' => 'marcas', 'texto' => 'Una marca tiene un estado que no existe (usa P, F, E o nada para quitarla).'];
            break;
        }
        if (isset($vistos[(int)$pid])) {
            $e[] = ['campo' => 'marcas', 'texto' => 'Una persona aparece dos veces en el mismo envío.'];
            break;
        }
        $vistos[(int)$pid] = true;
        $limpias[] = ['persona' => (int)$pid, 'estado' => $estado];
    }
}

// Las personas marcadas deben existir
$pdo = bd();
if (!$e && $limpias) {
    $ids = array_map(function ($m) { return $m['persona']; }, $limpias);
    $marcasSql = implode(',', array_fill(0, count($ids), '?'));
    $st = $pdo->prepare("SELECT id FROM personas WHERE id IN ($marcasSql)");
    $st->execute($ids);
    $existen = array_map('intval', array_column($st->fetchAll(), 'id'));
    foreach ($ids as $pid) {
        if (!in_array((int)$pid, $existen, true)) {
            $e[] = ['campo' => 'marcas', 'texto' => 'Una de las personas marcadas ya no existe. Recarga la lista y vuelve a marcar.'];
            break;
        }
    }
}

if ($e) {
    fallar_validacion($e);
}

// Guardado en una sola operación: si algo falla, no queda nada a medias
$conteo = ['P' => 0, 'F' => 0, 'E' => 0, 'quitadas' => 0];
$pdo->beginTransaction();
try {
    $ins = $pdo->prepare('INSERT INTO asistencias (persona_id, fecha, estado) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE estado = VALUES(estado)');
    $del = $pdo->prepare('DELETE FROM asistencias WHERE persona_id = ? AND fecha = ?');
    foreach ($limpias as $m) {
        if ($m['estado'] === null) {
            $del->execute([$m['persona'], $fecha]);
            $conteo['quitadas'] += $del->rowCount();
        } else {
            $ins->execute([$m['persona'], $fecha, $m['estado']]);
            $conteo[$m['estado']]++;
        }
    }
    $pdo->commit();
} catch (Throwable $ex) {
    $pdo->rollBack();
    throw $ex;
}

auditar($u, 'editar', 'asistencias', 0, 'lista del ' . $fecha . ': P ' . $conteo['P'] . ', F ' . $conteo['F'] . ', E ' . $conteo['E'] . ', quitadas ' . $conteo['quitadas']);
responder(200, [
    'fecha' => $fecha,
    'presentes' => $conteo['P'],
    'faltas' => $conteo['F'],
    'excusas' => $conteo['E'],
    'quitadas' => $conteo['quitadas'],
]);

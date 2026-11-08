<?php
/* api/tomar_asistencia.php  (campo «Tomar asistencia»: Asistente Pastor y Discipulador)
   GET                                  → grupos activos que puede atender quien consulta
   GET ?grupo=ID&fecha=AAAA-MM-DD       → participantes del grupo y quién asistió ese día
   POST {grupoId, fecha, horaInicio, asistentes:[personaId, ...]}
                                        → guarda la asistencia de ese día en la reunión del grupo
   La asistencia se guarda en la misma reunión que usa Comunión Familiar: si el grupo no tuvo reunión
   ese día, se crea; si ya existe, se actualiza. El discipulador solo atiende sus propios grupos.
   Los visitantes y los demás datos de la reunión se registran en Comunión Familiar. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'tomar-asistencia';
const PATRON_HORA = '/^([01]\d|2[0-3]):[0-5]\d$/';

$metodo = solo_metodos(['GET', 'POST']);
$u = exigir_usuario();
if ($metodo === 'POST') {
    exigir_csrf();
}
exigir_permiso($u, MODULO, 'registrar', 'Tu cargo no puede tomar asistencia.');

// Ve todos los grupos quien puede ver los reportes de Comunión Familiar; los demás, solo los que discipula
function ta_alcance(array $u)
{
    return [
        'todos' => tiene_permiso($u, 'comunion-familiar', 'reportes'),
        'persona' => isset($u['persona_id']) && $u['persona_id'] !== null ? (int)$u['persona_id'] : null,
    ];
}

// Devuelve el grupo si existe y quien consulta puede atenderlo; si no, responde con el error correspondiente
function ta_grupo_permitido(array $u, $grupoId)
{
    $st = bd()->prepare('SELECT id, nombre, direccion, anfitrion_persona_id, discipulador_persona_id FROM grupos WHERE id = ?');
    $st->execute([(int)$grupoId]);
    $g = $st->fetch();
    if (!$g) {
        fallar(404, 'no_existe', 'El grupo no existe.');
    }
    $alcance = ta_alcance($u);
    if (!$alcance['todos'] && (int)$g['discipulador_persona_id'] !== (int)$alcance['persona']) {
        fallar(403, 'alcance', 'Solo puedes tomar asistencia de los grupos que discipulas.');
    }
    return $g;
}

function ta_participantes($grupoId)
{
    $st = bd()->prepare("SELECT p.id, p.nombres, p.apellidos FROM grupo_participantes gp
                         JOIN personas p ON p.id = gp.persona_id WHERE gp.grupo_id = ?
                         ORDER BY p.apellidos, p.nombres");
    $st->execute([(int)$grupoId]);
    return $st->fetchAll();
}

function ta_reunion_del_dia($grupoId, $fecha)
{
    $st = bd()->prepare('SELECT id, hora_inicio FROM reuniones WHERE grupo_id = ? AND fecha = ? ORDER BY id LIMIT 1');
    $st->execute([(int)$grupoId, $fecha]);
    return $st->fetch() ?: null;
}

if ($metodo === 'GET' && !isset($_GET['grupo'])) {
    /* ---------- Grupos que puede atender ---------- */
    $alcance = ta_alcance($u);
    $filtro = $alcance['todos'] ? '' : ' AND g.discipulador_persona_id = ?';
    $params = $alcance['todos'] ? [] : [(int)$alcance['persona']];
    $st = bd()->prepare("SELECT g.id, g.nombre, g.direccion FROM grupos g WHERE g.estado = 'Activo'" . $filtro . ' ORDER BY g.nombre');
    $st->execute($params);
    $grupos = [];
    foreach ($st->fetchAll() as $g) {
        $grupos[] = ['id' => (int)$g['id'], 'nombre' => $g['nombre'], 'direccion' => $g['direccion']];
    }
    responder(200, ['grupos' => $grupos]);
}

if ($metodo === 'GET') {
    /* ---------- Participantes del grupo y asistencia de ese día ---------- */
    $grupoId = filter_var($_GET['grupo'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $fecha = isset($_GET['fecha']) && is_string($_GET['fecha']) ? trim($_GET['fecha']) : '';
    if ($grupoId === false) {
        fallar_validacion([['campo' => 'grupoId', 'texto' => 'El grupo no es válido.']]);
    }
    if (!es_fecha($fecha)) {
        fallar_validacion([['campo' => 'fecha', 'texto' => 'La fecha no es válida.']]);
    }
    $g = ta_grupo_permitido($u, $grupoId);
    $reunion = ta_reunion_del_dia($g['id'], $fecha);
    $presentes = [];
    $visitantes = 0;
    if ($reunion) {
        $st = bd()->prepare('SELECT persona_id FROM reunion_asistencia WHERE reunion_id = ?');
        $st->execute([(int)$reunion['id']]);
        $presentes = array_map('intval', array_column($st->fetchAll(), 'persona_id'));
        $st = bd()->prepare('SELECT COUNT(*) FROM reunion_visitantes WHERE reunion_id = ?');
        $st->execute([(int)$reunion['id']]);
        $visitantes = (int)$st->fetchColumn();
    }
    $participantes = [];
    foreach (ta_participantes($g['id']) as $p) {
        $participantes[] = ['id' => (int)$p['id'], 'nombre' => trim($p['nombres'] . ' ' . $p['apellidos']),
                            'presente' => in_array((int)$p['id'], $presentes, true)];
    }
    responder(200, [
        'grupo' => ['id' => (int)$g['id'], 'nombre' => $g['nombre'], 'direccion' => $g['direccion']],
        'fecha' => $fecha,
        'horaInicio' => $reunion ? substr($reunion['hora_inicio'], 0, 5) : null,
        'reunionId' => $reunion ? (int)$reunion['id'] : null,
        'visitantes' => $visitantes,
        'participantes' => $participantes,
    ]);
}

/* ---------- Guardar la asistencia del día ---------- */
$d = leer_json();
$e = [];
$grupoId = entero(dato($d, 'grupoId'));
if ($grupoId === null || $grupoId <= 0) {
    $e[] = ['campo' => 'grupoId', 'texto' => 'Elige el grupo.'];
}
$fecha = linea(dato($d, 'fecha'));
if ($fecha === '') {
    $e[] = ['campo' => 'fecha', 'texto' => 'Elige la fecha.'];
} elseif (!es_fecha($fecha)) {
    $e[] = ['campo' => 'fecha', 'texto' => 'La fecha no es válida.'];
} elseif ($fecha > hoy()) {
    $e[] = ['campo' => 'fecha', 'texto' => 'La fecha no puede ser futura.'];
}
$hora = is_string(dato($d, 'horaInicio')) ? trim(dato($d, 'horaInicio')) : '';
if (!preg_match(PATRON_HORA, $hora)) {
    $e[] = ['campo' => 'horaInicio', 'texto' => 'Escribe la hora de inicio (por ejemplo 19:30).'];
}
$pedidos = dato($d, 'asistentes');
$marcados = [];
if (!is_array($pedidos)) {
    $e[] = ['campo' => 'asistentes', 'texto' => 'Indica quién asistió.'];
} else {
    foreach ($pedidos as $x) {
        $n = entero($x);
        if ($n === null || $n <= 0) {
            $e[] = ['campo' => 'asistentes', 'texto' => 'Una de las personas marcadas no es válida.'];
            break;
        }
        if (!in_array($n, $marcados, true)) {
            $marcados[] = $n;
        }
    }
}
if ($e) {
    fallar_validacion($e);
}

$g = ta_grupo_permitido($u, $grupoId);
$participantes = array_map(function ($p) { return (int)$p['id']; }, ta_participantes($g['id']));
foreach ($marcados as $pid) {
    if (!in_array($pid, $participantes, true)) {
        fallar_validacion([['campo' => 'asistentes', 'texto' => 'Una de las personas marcadas no forma parte de este grupo.']]);
    }
}

$pdo = bd();
$pdo->beginTransaction();
try {
    $reunion = ta_reunion_del_dia($g['id'], $fecha);
    if ($reunion) {
        // Reemplaza solo la asistencia de los participantes actuales: quien ya no está en el grupo conserva su registro
        if ($participantes) {
            $marcas = implode(',', array_fill(0, count($participantes), '?'));
            $pdo->prepare("DELETE FROM reunion_asistencia WHERE reunion_id = ? AND persona_id IN ($marcas)")
                ->execute(array_merge([(int)$reunion['id']], $participantes));
        }
        $ins = $pdo->prepare('INSERT INTO reunion_asistencia (reunion_id, persona_id) VALUES (?, ?)');
        foreach ($marcados as $pid) {
            $ins->execute([(int)$reunion['id'], $pid]);
        }
        $st = $pdo->prepare('SELECT COUNT(*) FROM reunion_visitantes WHERE reunion_id = ?');
        $st->execute([(int)$reunion['id']]);
        $cantidad = count($marcados) + (int)$st->fetchColumn();
        $pdo->prepare('UPDATE reuniones SET hora_inicio = ?, cantidad = ? WHERE id = ?')
            ->execute([$hora, $cantidad, (int)$reunion['id']]);
        $rid = (int)$reunion['id'];
        $accion = 'editar';
        $codigo = 200;
    } else {
        // Reunión nueva: los datos del grupo se toman del grupo; la ofrenda y las novedades se completan en Comunión Familiar
        $pdo->prepare('INSERT INTO reuniones (grupo_id, fecha, hora_inicio, hora_fin, direccion, anfitrion_persona_id,
                       discipulador_persona_id, impartido_por_persona_id, tema_id, cantidad, ofrenda, novedades,
                       registrado_por, registrada) VALUES (?, ?, ?, NULL, ?, ?, ?, NULL, NULL, ?, 0, \'\', ?, ?)')
            ->execute([(int)$g['id'], $fecha, $hora, (string)$g['direccion'], $g['anfitrion_persona_id'] ?: null,
                       (int)$g['discipulador_persona_id'], count($marcados), (int)$u['id'], hoy()]);
        $rid = (int)$pdo->lastInsertId();
        $ins = $pdo->prepare('INSERT INTO reunion_asistencia (reunion_id, persona_id) VALUES (?, ?)');
        foreach ($marcados as $pid) {
            $ins->execute([$rid, $pid]);
        }
        $cantidad = count($marcados);
        $accion = 'crear';
        $codigo = 201;
    }
    $pdo->commit();
} catch (Throwable $ex) {
    $pdo->rollBack();
    throw $ex;
}
auditar($u, $accion, 'reuniones', $rid, 'asistencia de ' . $g['nombre'] . ' · ' . $fecha . ' · ' . count($marcados) . ' personas');
responder($codigo, ['reunionId' => $rid, 'asistentes' => count($marcados), 'cantidad' => $cantidad]);

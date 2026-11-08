<?php
/* api/sesiones.php  —  POST crear · PUT ?id= editar · DELETE ?id= eliminar   (módulo «adiestramiento»)
   Una sesión pertenece a un curso de Adiestramiento. Si quien la impartió no es el adiestrador
   habitual del curso, la sesión queda marcada como sustitución y debe llevar novedad.
   Solo pueden asistir personas inscritas en el curso. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'adiestramiento';
const LUGAR_HABITUAL = 'Iglesia';

$metodo = solo_metodos(['POST', 'PUT', 'DELETE']);
$u = exigir_usuario();
exigir_csrf();

function validar_sesion(array $d, $idActual)
{
    $e = [];
    $cursoId = entero(dato($d, 'cursoId'));
    $nivelId = entero(dato($d, 'nivelId'));
    $temaId = entero(dato($d, 'temaId'));
    $fecha = linea(dato($d, 'fecha'));
    $inicio = linea(dato($d, 'horaInicio'));
    $fin = linea(dato($d, 'horaFin'));
    $lugar = linea(dato($d, 'lugar'));
    $adiestrador = entero(dato($d, 'adiestradorId'));
    $novedades = bloque(dato($d, 'novedades'));
    $observaciones = bloque(dato($d, 'observaciones'));
    if ($lugar === '') {
        $lugar = LUGAR_HABITUAL;
    }
    $asistencia = [];
    $ba = dato($d, 'asistencia');
    if ($ba !== null && !is_array($ba)) {
        $e[] = ['campo' => 'asistencia', 'texto' => 'La lista de asistentes no es válida.'];
    } else {
        foreach ((array)$ba as $x) {
            $n = entero($x);
            if ($n === null || $n <= 0) {
                $e[] = ['campo' => 'asistencia', 'texto' => 'Una de las personas marcadas no es válida.'];
                break;
            }
            if (!in_array($n, $asistencia, true)) {
                $asistencia[] = $n;
            }
        }
    }

    // Curso: debe existir, estar activo y ser de Adiestramiento
    $curso = null;
    if ($cursoId === null || $cursoId <= 0) {
        $e[] = ['campo' => 'cursoId', 'texto' => 'Elige el curso.'];
    } else {
        $st = bd()->prepare('SELECT c.id, c.activo, c.responsable_persona_id, p.clave AS proceso
                             FROM cursos c JOIN procesos p ON p.id = c.proceso_id WHERE c.id = ?');
        $st->execute([$cursoId]);
        $curso = $st->fetch();
        if (!$curso || $curso['proceso'] !== 'adiestramiento') {
            $e[] = ['campo' => 'cursoId', 'texto' => 'El curso elegido no pertenece a Adiestramiento.'];
            $curso = null;
        } elseif (!(int)$curso['activo']) {
            $e[] = ['campo' => 'cursoId', 'texto' => 'Ese curso está desactivado en el catálogo.'];
            $curso = null;
        }
    }
    $cid = (int)($cursoId ?: 0);

    // Nivel: debe pertenecer al curso y estar activo
    if ($nivelId !== null && $nivelId > 0) {
        $st = bd()->prepare('SELECT 1 FROM niveles WHERE id = ? AND curso_id = ? AND activo = 1');
        $st->execute([$nivelId, $cid]);
        if (!$st->fetchColumn()) {
            $e[] = ['campo' => 'nivelId', 'texto' => 'El nivel elegido no pertenece a ese curso o está desactivado.'];
        }
    } else {
        $nivelId = null;
    }

    // Tema: debe pertenecer al curso, estar activo y coincidir con el nivel
    if ($temaId !== null && $temaId > 0) {
        $st = bd()->prepare('SELECT nivel_id, activo FROM temas WHERE id = ? AND curso_id = ?');
        $st->execute([$temaId, $cid]);
        $t = $st->fetch();
        if (!$t || !(int)$t['activo']) {
            $e[] = ['campo' => 'temaId', 'texto' => 'El tema elegido no pertenece a ese curso o está desactivado.'];
        } elseif ($t['nivel_id'] !== null && (int)$t['nivel_id'] !== (int)$nivelId) {
            $e[] = ['campo' => 'temaId', 'texto' => 'El tema no pertenece al nivel elegido.'];
        } elseif ($t['nivel_id'] === null && $nivelId !== null) {
            $e[] = ['campo' => 'temaId', 'texto' => 'Ese tema no pertenece a un nivel: quita el nivel o elige otro tema.'];
        }
    } else {
        $temaId = null;
    }

    if ($fecha === '') {
        $e[] = ['campo' => 'fecha', 'texto' => 'Elige la fecha de la sesión.'];
    } elseif (!es_fecha($fecha)) {
        $e[] = ['campo' => 'fecha', 'texto' => 'La fecha no es válida.'];
    } elseif ($fecha > hoy()) {
        $e[] = ['campo' => 'fecha', 'texto' => 'La fecha no puede ser futura.'];
    }
    if ($inicio === '') {
        $e[] = ['campo' => 'horaInicio', 'texto' => 'Elige la hora de inicio.'];
    } elseif (!hora_valida($inicio)) {
        $e[] = ['campo' => 'horaInicio', 'texto' => 'La hora de inicio no es válida.'];
    }
    if ($fin !== '') {
        if (!hora_valida($fin)) {
            $e[] = ['campo' => 'horaFin', 'texto' => 'La hora de fin no es válida.'];
        } elseif (hora_valida($inicio) && $fin <= $inicio) {
            $e[] = ['campo' => 'horaFin', 'texto' => 'La hora de fin debe ser posterior a la de inicio.'];
        }
    }
    if (largo($lugar) > 160) {
        $e[] = ['campo' => 'lugar', 'texto' => 'El lugar es demasiado largo (máximo 160 caracteres).'];
    }

    // Quién impartió la sesión: debe existir y tener la función de adiestrador
    if ($adiestrador === null || $adiestrador <= 0) {
        $e[] = ['campo' => 'adiestradorId', 'texto' => 'Elige quién impartió la sesión.'];
    } elseif (!existe_persona($adiestrador)) {
        $e[] = ['campo' => 'adiestradorId', 'texto' => 'La persona elegida no existe.'];
    } elseif (!persona_con_funcion($adiestrador, 'adiestrador')) {
        $e[] = ['campo' => 'adiestradorId', 'texto' => 'La persona elegida no tiene la función de adiestrador. Asígnasela en su ficha.'];
    }

    // Sustitución: no imparte el adiestrador habitual del curso → hace falta novedad
    $sustitucion = false;
    if ($curso && $curso['responsable_persona_id'] !== null && $adiestrador && (int)$curso['responsable_persona_id'] !== $adiestrador) {
        $sustitucion = true;
        if ($novedades === '') {
            $e[] = ['campo' => 'novedades', 'texto' => 'Como otra persona impartió la sesión, escribe la novedad (quién la impartió y por qué).'];
        }
    }

    // Asistencia: solo personas inscritas en el curso
    if ($curso && $asistencia) {
        $st = bd()->prepare('SELECT persona_id FROM curso_participantes WHERE curso_id = ?');
        $st->execute([$cid]);
        $inscritos = array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
        if (array_diff($asistencia, $inscritos)) {
            $e[] = ['campo' => 'asistencia', 'texto' => 'Hay personas marcadas que no están inscritas en el curso. Inscríbelas primero.'];
        }
    }

    // Una sesión por curso, fecha y hora: evita registrar dos veces la misma
    if ($curso && es_fecha($fecha) && hora_valida($inicio)) {
        $st = bd()->prepare('SELECT id FROM sesiones_adiestramiento WHERE curso_id = ? AND fecha = ? AND hora_inicio = ? AND id <> ?');
        $st->execute([$cid, $fecha, $inicio, (int)$idActual]);
        if ($st->fetch()) {
            $e[] = ['campo' => 'horaInicio', 'texto' => 'Ya hay una sesión de este curso en esa fecha y hora.'];
        }
    }

    if (largo($novedades) > 2000) {
        $e[] = ['campo' => 'novedades', 'texto' => 'Las novedades son demasiado largas (máximo 2000 caracteres).'];
    }
    if (largo($observaciones) > 2000) {
        $e[] = ['campo' => 'observaciones', 'texto' => 'Las observaciones son demasiado largas (máximo 2000 caracteres).'];
    }
    if ($e) {
        fallar_validacion($e);
    }
    return [
        'cursoId' => $cid, 'nivelId' => $nivelId, 'temaId' => $temaId, 'fecha' => $fecha,
        'horaInicio' => $inicio, 'horaFin' => $fin === '' ? null : $fin, 'lugar' => $lugar,
        'adiestrador' => $adiestrador, 'sustitucion' => $sustitucion ? 1 : 0,
        'novedades' => $novedades, 'observaciones' => $observaciones, 'asistencia' => $asistencia,
    ];
}

function guardar_asistencia_sesion($sid, array $c)
{
    $pdo = bd();
    $pdo->prepare('DELETE FROM sesion_asistencia WHERE sesion_id = ?')->execute([(int)$sid]);
    $st = $pdo->prepare('INSERT INTO sesion_asistencia (sesion_id, persona_id) VALUES (?, ?)');
    foreach ($c['asistencia'] as $pid) {
        $st->execute([(int)$sid, (int)$pid]);
    }
}

function fallar_si_duplicada(Throwable $ex)
{
    if ($ex instanceof PDOException && codigo_mysql($ex) === 1062) {
        fallar_validacion([['campo' => 'horaInicio', 'texto' => 'Ya hay una sesión de este curso en esa fecha y hora.']]);
    }
    throw $ex;
}

if ($metodo === 'POST') {
    exigir_permiso($u, MODULO, 'registrar', 'Tu cargo no puede registrar sesiones de Adiestramiento.');
    $c = validar_sesion(leer_json(), 0);
    $pdo = bd();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO sesiones_adiestramiento (curso_id, nivel_id, tema_id, fecha, hora_inicio, hora_fin, lugar,
                       adiestrador_persona_id, es_sustitucion, novedades, observaciones, registrado_por, registrada)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$c['cursoId'], $c['nivelId'], $c['temaId'], $c['fecha'], $c['horaInicio'], $c['horaFin'], $c['lugar'],
                       $c['adiestrador'], $c['sustitucion'], $c['novedades'], $c['observaciones'], $u['id'], hoy()]);
        $sid = (int)$pdo->lastInsertId();
        guardar_asistencia_sesion($sid, $c);
        auditar($u, 'crear', 'sesiones', $sid, $c['fecha'] . ' ' . $c['horaInicio']);
        $pdo->commit();
    } catch (Throwable $ex) {
        $pdo->rollBack();
        fallar_si_duplicada($ex);
    }
    responder(201, ['id' => $sid]);
}

if ($metodo === 'PUT') {
    exigir_permiso($u, MODULO, 'editar', 'Tu cargo no puede editar sesiones de Adiestramiento.');
} else {
    exigir_permiso($u, MODULO, 'eliminar', 'Tu cargo no puede eliminar sesiones de Adiestramiento.');
}
$id = id_de_url();
$st = bd()->prepare('SELECT id FROM sesiones_adiestramiento WHERE id = ?');
$st->execute([$id]);
if (!$st->fetch()) {
    fallar(404, 'no_existe', 'La sesión no existe.');
}

if ($metodo === 'PUT') {
    $c = validar_sesion(leer_json(), $id);
    $pdo = bd();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE sesiones_adiestramiento SET curso_id = ?, nivel_id = ?, tema_id = ?, fecha = ?, hora_inicio = ?,
                       hora_fin = ?, lugar = ?, adiestrador_persona_id = ?, es_sustitucion = ?, novedades = ?, observaciones = ?
                       WHERE id = ?')
            ->execute([$c['cursoId'], $c['nivelId'], $c['temaId'], $c['fecha'], $c['horaInicio'], $c['horaFin'], $c['lugar'],
                       $c['adiestrador'], $c['sustitucion'], $c['novedades'], $c['observaciones'], $id]);
        guardar_asistencia_sesion($id, $c);
        auditar($u, 'editar', 'sesiones', $id, $c['fecha'] . ' ' . $c['horaInicio']);
        $pdo->commit();
    } catch (Throwable $ex) {
        $pdo->rollBack();
        fallar_si_duplicada($ex);
    }
    responder(200, ['id' => $id]);
}

// DELETE: una sesión con asistencia registrada no se borra, para conservar el historial
$st = bd()->prepare('SELECT COUNT(*) FROM sesion_asistencia WHERE sesion_id = ?');
$st->execute([$id]);
if ((int)$st->fetchColumn() > 0) {
    fallar(409, 'dependencias', 'Esta sesión tiene asistencia registrada: no se puede eliminar para conservar el historial. Puedes editarla.');
}
bd()->prepare('DELETE FROM sesiones_adiestramiento WHERE id = ?')->execute([$id]);
auditar($u, 'eliminar', 'sesiones', $id, '');
responder(200, ['ok' => true]);

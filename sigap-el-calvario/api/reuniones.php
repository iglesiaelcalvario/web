<?php
/* api/reuniones.php  —  POST crear · PUT ?id= editar · DELETE ?id= eliminar   (módulo «comunion-familiar») */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'comunion-familiar';

$metodo = solo_metodos(['POST', 'PUT', 'DELETE']);
$u = exigir_usuario();
exigir_csrf();

function validar_reunion(array $d, $grupoId)
{
    $e = [];
    $fecha = linea(dato($d, 'fecha'));
    $horaInicio = linea(dato($d, 'horaInicio'));
    $horaFin = linea(dato($d, 'horaFin'));
    $direccion = linea(dato($d, 'direccion'));
    $novedades = bloque(dato($d, 'novedades'));

    if ($fecha === '') {
        $e[] = ['campo' => 'fecha', 'texto' => 'Elige la fecha de la reunión.'];
    } elseif (!es_fecha($fecha)) {
        $e[] = ['campo' => 'fecha', 'texto' => 'La fecha no es válida.'];
    } elseif ($fecha > hoy()) {
        $e[] = ['campo' => 'fecha', 'texto' => 'La fecha no puede ser futura.'];
    }
    if ($horaInicio === '') {
        $e[] = ['campo' => 'horaInicio', 'texto' => 'Elige la hora de inicio.'];
    } elseif (!hora_valida($horaInicio)) {
        $e[] = ['campo' => 'horaInicio', 'texto' => 'La hora de inicio no es válida.'];
    }
    if ($horaFin !== '') {
        if (!hora_valida($horaFin)) {
            $e[] = ['campo' => 'horaFin', 'texto' => 'La hora de fin no es válida.'];
        } elseif (hora_valida($horaInicio) && $horaFin <= $horaInicio) {
            $e[] = ['campo' => 'horaFin', 'texto' => 'La hora de fin debe ser posterior a la de inicio.'];
        }
    }
    if (largo($direccion) > 160) {
        $e[] = ['campo' => 'direccion', 'texto' => 'La dirección es demasiado larga (máximo 160 caracteres).'];
    }
    if (largo($novedades) > 2000) {
        $e[] = ['campo' => 'novedades', 'texto' => 'Las novedades son demasiado largas (máximo 2000 caracteres).'];
    }

    // Personas opcionales: anfitrión, discipulador responsable, quien impartió la lección
    $anfitrion = entero(dato($d, 'anfitrionId'));
    if ($anfitrion !== null && $anfitrion > 0 && !existe_persona($anfitrion)) {
        $e[] = ['campo' => 'anfitrionId', 'texto' => 'La persona elegida como anfitrión no existe.'];
    }
    $discipulador = entero(dato($d, 'discipuladorId'));
    if ($discipulador !== null && $discipulador > 0) {
        if (!existe_persona($discipulador)) {
            $e[] = ['campo' => 'discipuladorId', 'texto' => 'La persona elegida como discipulador no existe.'];
        } elseif (!persona_con_funcion($discipulador, 'discipulador')) {
            $e[] = ['campo' => 'discipuladorId', 'texto' => 'La persona elegida no tiene la función de discipulador.'];
        }
    } else {
        $discipulador = null;
    }
    $impartido = entero(dato($d, 'impartidoPorId'));
    if ($impartido !== null && $impartido > 0) {
        if (!existe_persona($impartido)) {
            $e[] = ['campo' => 'impartidoPorId', 'texto' => 'La persona que impartió la lección no existe.'];
        } elseif (!persona_con_funcion($impartido, 'discipulador')) {
            $e[] = ['campo' => 'impartidoPorId', 'texto' => 'Quien impartió la lección debe tener la función de discipulador.'];
        }
    } else {
        $impartido = null;
    }

    // Tema: debe existir, estar activo y pertenecer a Comunión Familiar
    $tema = entero(dato($d, 'temaId'));
    if ($tema !== null && $tema > 0) {
        $st = bd()->prepare('SELECT t.activo AS tema_activo, c.activo AS curso_activo, p.clave AS proceso
                             FROM temas t JOIN cursos c ON c.id = t.curso_id JOIN procesos p ON p.id = c.proceso_id WHERE t.id = ?');
        $st->execute([$tema]);
        $t = $st->fetch();
        if (!$t) {
            $e[] = ['campo' => 'temaId', 'texto' => 'El tema elegido no existe.'];
        } elseif (!(int)$t['tema_activo'] || !(int)$t['curso_activo']) {
            $e[] = ['campo' => 'temaId', 'texto' => 'Ese tema está desactivado en el catálogo.'];
        } elseif ($t['proceso'] !== 'comunion-familiar') {
            $e[] = ['campo' => 'temaId', 'texto' => 'Ese tema pertenece a otro proceso de formación.'];
        }
    } else {
        $tema = null;
    }

    // Asistencia: solo participantes vinculados al grupo
    $asistencia = [];
    $ba = dato($d, 'asistencia');
    if ($ba === null) {
        $ba = [];
    }
    if (!is_array($ba)) {
        $e[] = ['campo' => 'asistencia', 'texto' => 'La lista de asistentes no es válida.'];
    } else {
        foreach ($ba as $x) {
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
    $st = bd()->prepare('SELECT persona_id FROM grupo_participantes WHERE grupo_id = ?');
    $st->execute([(int)$grupoId]);
    $vinculados = array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
    if (array_diff($asistencia, $vinculados)) {
        $e[] = ['campo' => 'asistencia', 'texto' => 'Hay personas marcadas como asistentes que no están vinculadas al grupo. Vincúlalas al grupo o regístralas como visitantes.'];
    }

    // Visitantes: nombre propio, o vinculados a una persona existente
    $visitantes = [];
    $bv = dato($d, 'visitantes');
    if ($bv === null) {
        $bv = [];
    }
    if (!is_array($bv)) {
        $e[] = ['campo' => 'visitantes', 'texto' => 'La lista de visitantes no es válida.'];
    } elseif (count($bv) > 50) {
        $e[] = ['campo' => 'visitantes', 'texto' => 'Puedes registrar hasta 50 visitantes por reunión.'];
    } else {
        foreach ($bv as $v) {
            $nom = is_array($v) ? linea(dato($v, 'nombre')) : '';
            $pid = is_array($v) ? entero(dato($v, 'personaId')) : null;
            if ($pid !== null && $pid > 0) {
                if (!existe_persona($pid)) {
                    $e[] = ['campo' => 'visitantes', 'texto' => 'Un visitante está vinculado a una persona que no existe.'];
                    break;
                }
                if ($nom === '') {
                    $st = bd()->prepare('SELECT nombres, apellidos FROM personas WHERE id = ?');
                    $st->execute([$pid]);
                    $pp = $st->fetch();
                    $nom = $pp ? trim($pp['nombres'] . ' ' . $pp['apellidos']) : '';
                }
                $visitantes[] = ['nombre' => $nom, 'personaId' => $pid];
            } elseif ($nom === '') {
                $e[] = ['campo' => 'visitantes', 'texto' => 'Un visitante no tiene nombre.'];
                break;
            } elseif (largo($nom) > 160) {
                $e[] = ['campo' => 'visitantes', 'texto' => 'Un nombre de visitante es demasiado largo (máximo 160 caracteres).'];
                break;
            } else {
                $visitantes[] = ['nombre' => $nom, 'personaId' => null];
            }
        }
    }

    $cantidad = entero(dato($d, 'cantidad'));
    $marcados = count($asistencia) + count($visitantes);
    if ($cantidad === null || $cantidad < 0 || $cantidad > 5000) {
        $e[] = ['campo' => 'cantidad', 'texto' => 'Escribe la cantidad de personas (0 o más).'];
    } elseif ($cantidad < $marcados) {
        $e[] = ['campo' => 'cantidad', 'texto' => "La cantidad ($cantidad) es menor que los asistentes y visitantes marcados ($marcados)."];
    }
    $bo = dato($d, 'ofrenda');
    $ofrenda = ($bo === null || $bo === '') ? 0 : entero($bo);
    if ($ofrenda === null || $ofrenda < 0 || $ofrenda > 999999999999) {
        $e[] = ['campo' => 'ofrenda', 'texto' => 'La ofrenda no es válida: escribe 0 o un valor positivo en pesos.'];
    }
    if ($e) {
        fallar_validacion($e);
    }
    return ['fecha' => $fecha, 'hora' => $horaInicio, 'horaFin' => $horaFin === '' ? null : $horaFin, 'direccion' => $direccion,
            'anfitrion' => $anfitrion, 'discipulador' => $discipulador, 'impartido' => $impartido, 'tema' => $tema,
            'asistencia' => $asistencia, 'visitantes' => $visitantes, 'cantidad' => $cantidad, 'ofrenda' => $ofrenda,
            'novedades' => $novedades];
}

// Reemplaza la asistencia y los visitantes de una reunión (todo dentro de la transacción de quien llama)
function guardar_asistencia_visitantes($reunionId, array $c)
{
    $pdo = bd();
    $pdo->prepare('DELETE FROM reunion_asistencia WHERE reunion_id = ?')->execute([(int)$reunionId]);
    $pdo->prepare('DELETE FROM reunion_visitantes WHERE reunion_id = ?')->execute([(int)$reunionId]);
    $sa = $pdo->prepare('INSERT INTO reunion_asistencia (reunion_id, persona_id) VALUES (?, ?)');
    foreach ($c['asistencia'] as $pid) {
        $sa->execute([(int)$reunionId, (int)$pid]);
    }
    $sv = $pdo->prepare('INSERT INTO reunion_visitantes (reunion_id, nombre, persona_id) VALUES (?, ?, ?)');
    foreach ($c['visitantes'] as $v) {
        $sv->execute([(int)$reunionId, $v['nombre'], $v['personaId']]);
    }
}

if ($metodo === 'POST') {
    exigir_permiso($u, MODULO, 'registrar', 'Tu cargo no puede registrar reuniones.');
    $d = leer_json();
    $grupoId = entero(dato($d, 'grupoId'));
    $st = bd()->prepare('SELECT id, discipulador_persona_id FROM grupos WHERE id = ?');
    $st->execute([$grupoId === null ? 0 : $grupoId]);
    $g = $st->fetch();
    if (!$g) {
        fallar(404, 'no_existe', 'El grupo no existe.');
    }
    if ($u['rol'] === 'discipulador' && (int)$g['discipulador_persona_id'] !== (isset($u['persona_id']) ? (int)$u['persona_id'] : 0)) {
        fallar(403, 'prohibido', 'Ese grupo no está a tu cargo.');
    }
    $c = validar_reunion($d, (int)$g['id']);
    $pdo = bd();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO reuniones (grupo_id, fecha, hora_inicio, hora_fin, direccion, anfitrion_persona_id, discipulador_persona_id,
                       impartido_por_persona_id, tema_id, cantidad, ofrenda, novedades, registrado_por, registrada)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([(int)$g['id'], $c['fecha'], $c['hora'], $c['horaFin'], $c['direccion'], $c['anfitrion'], $c['discipulador'],
                       $c['impartido'], $c['tema'], $c['cantidad'], $c['ofrenda'], $c['novedades'], $u['id'], hoy()]);
        $rid = (int)$pdo->lastInsertId();
        guardar_asistencia_visitantes($rid, $c);
        auditar($u, 'crear', 'reuniones', $rid, $c['fecha'] . ' ' . $c['hora']);
        $pdo->commit();
    } catch (Throwable $ex) {
        $pdo->rollBack();
        throw $ex;
    }
    responder(201, ['id' => $rid]);
}

if ($metodo === 'PUT') {
    exigir_permiso($u, MODULO, 'editar', 'Tu cargo no puede editar reuniones.');
} else {
    exigir_permiso($u, MODULO, 'eliminar', 'Tu cargo no puede eliminar reuniones.');
}
$id = id_de_url();
$st = bd()->prepare('SELECT id, grupo_id FROM reuniones WHERE id = ?');
$st->execute([$id]);
$existente = $st->fetch();
if (!$existente) {
    fallar(404, 'no_existe', 'La reunión no existe.');
}

if ($metodo === 'PUT') {
    $c = validar_reunion(leer_json(), (int)$existente['grupo_id']);
    $pdo = bd();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE reuniones SET fecha = ?, hora_inicio = ?, hora_fin = ?, direccion = ?, anfitrion_persona_id = ?,
                       discipulador_persona_id = ?, impartido_por_persona_id = ?, tema_id = ?, cantidad = ?, ofrenda = ?, novedades = ?
                       WHERE id = ?')
            ->execute([$c['fecha'], $c['hora'], $c['horaFin'], $c['direccion'], $c['anfitrion'], $c['discipulador'], $c['impartido'],
                       $c['tema'], $c['cantidad'], $c['ofrenda'], $c['novedades'], $id]);
        guardar_asistencia_visitantes($id, $c);
        auditar($u, 'editar', 'reuniones', $id, $c['fecha'] . ' ' . $c['hora']);
        $pdo->commit();
    } catch (Throwable $ex) {
        $pdo->rollBack();
        throw $ex;
    }
    responder(200, ['id' => $id]);
}

bd()->prepare('DELETE FROM reuniones WHERE id = ?')->execute([$id]);
auditar($u, 'eliminar', 'reuniones', $id, '');
responder(200, ['ok' => true]);

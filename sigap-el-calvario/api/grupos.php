<?php
/* api/grupos.php  —  POST crear · PUT ?id= editar · DELETE ?id= eliminar   (módulo «comunion-familiar») */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'comunion-familiar';
const ESTADOS_GRUPO = ['Activo', 'Inactivo'];

$metodo = solo_metodos(['POST', 'PUT', 'DELETE']);
$u = exigir_usuario();
exigir_csrf();

function validar_grupo(array $d, array $u)
{
    $e = [];
    $nombre = linea(dato($d, 'nombre'));
    $direccion = linea(dato($d, 'direccion'));
    $observaciones = bloque(dato($d, 'observaciones'));
    $fechaInicio = linea(dato($d, 'fechaInicio'));
    $estado = linea(dato($d, 'estado'));
    if ($estado === '') {
        $estado = 'Activo';
    }
    $anfitrion = entero(dato($d, 'anfitrionId'));

    $participantes = [];
    $bp = dato($d, 'participantes');
    if ($bp === null) {
        $bp = [];
    }
    if (!is_array($bp)) {
        $e[] = ['campo' => 'participantes', 'texto' => 'La lista de participantes no es válida.'];
    } else {
        foreach ($bp as $x) {
            $n = entero($x);
            if ($n === null || $n <= 0) {
                $e[] = ['campo' => 'participantes', 'texto' => 'Una de las personas participantes no es válida.'];
                break;
            }
            if (!in_array($n, $participantes, true)) {
                $participantes[] = $n;
            }
        }
    }

    if ($nombre === '') {
        $e[] = ['campo' => 'nombre', 'texto' => 'Escribe el nombre o identificación de la casa.'];
    } elseif (largo($nombre) > 80) {
        $e[] = ['campo' => 'nombre', 'texto' => 'El nombre de la casa es demasiado largo (máximo 80 caracteres).'];
    }
    if ($direccion === '') {
        $e[] = ['campo' => 'direccion', 'texto' => 'Escribe la dirección de la casa.'];
    } elseif (largo($direccion) > 160) {
        $e[] = ['campo' => 'direccion', 'texto' => 'La dirección es demasiado larga (máximo 160 caracteres).'];
    }
    if ($anfitrion === null || $anfitrion <= 0) {
        $e[] = ['campo' => 'anfitrionId', 'texto' => 'Elige la persona que es anfitriona de la casa.'];
    } elseif (!existe_persona($anfitrion)) {
        $e[] = ['campo' => 'anfitrionId', 'texto' => 'La persona elegida como anfitrión no existe.'];
    }
    if ($fechaInicio === '') {
        $e[] = ['campo' => 'fechaInicio', 'texto' => 'Elige la fecha de inicio del grupo.'];
    } elseif (!es_fecha($fechaInicio)) {
        $e[] = ['campo' => 'fechaInicio', 'texto' => 'La fecha de inicio no es válida.'];
    } elseif ($fechaInicio > hoy()) {
        $e[] = ['campo' => 'fechaInicio', 'texto' => 'La fecha de inicio no puede ser futura.'];
    }
    if (!in_array($estado, ESTADOS_GRUPO, true)) {
        $e[] = ['campo' => 'estado', 'texto' => 'El estado del grupo no es válido.'];
    }
    if (largo($observaciones) > 2000) {
        $e[] = ['campo' => 'observaciones', 'texto' => 'Las observaciones son demasiado largas (máximo 2000 caracteres).'];
    }

    // Discipulador responsable: siempre una persona con la función «discipulador»
    $disc = 0;
    if ($u['rol'] === 'discipulador') {
        $disc = isset($u['persona_id']) ? (int)$u['persona_id'] : 0;
        if ($disc <= 0) {
            $e[] = ['campo' => 'discipuladorId', 'texto' => 'Tu cuenta no está vinculada a una persona. Pide al administrador que la vincule antes de registrar grupos.'];
        } elseif (!persona_con_funcion($disc, 'discipulador')) {
            $e[] = ['campo' => 'discipuladorId', 'texto' => 'Tu persona no tiene la función de discipulador. Pide al administrador que se la asigne.'];
        }
    } else {
        $disc = entero(dato($d, 'discipuladorId'));
        if ($disc === null || $disc <= 0) {
            $e[] = ['campo' => 'discipuladorId', 'texto' => 'Elige el discipulador responsable.'];
        } elseif (!existe_persona($disc)) {
            $e[] = ['campo' => 'discipuladorId', 'texto' => 'La persona elegida como discipulador no existe.'];
        } elseif (!persona_con_funcion($disc, 'discipulador')) {
            $e[] = ['campo' => 'discipuladorId', 'texto' => 'La persona elegida no tiene la función de discipulador. Asígnasela en su ficha.'];
        }
    }
    foreach ($participantes as $pid) {
        if (!existe_persona($pid)) {
            $e[] = ['campo' => 'participantes', 'texto' => 'Uno de los participantes no existe.'];
            break;
        }
    }
    if ($e) {
        fallar_validacion($e);
    }
    return ['nombre' => $nombre, 'direccion' => $direccion, 'fechaInicio' => $fechaInicio, 'anfitrion' => $anfitrion,
            'discipulador' => $disc, 'estado' => $estado, 'observaciones' => $observaciones, 'participantes' => $participantes];
}

// Agrega y quita participantes sin borrar el historial de asistencia de las reuniones
function sincronizar_participantes($grupoId, array $nuevos)
{
    $pdo = bd();
    $st = $pdo->prepare('SELECT persona_id FROM grupo_participantes WHERE grupo_id = ?');
    $st->execute([(int)$grupoId]);
    $actuales = array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
    $quitar = $pdo->prepare('DELETE FROM grupo_participantes WHERE grupo_id = ? AND persona_id = ?');
    foreach (array_diff($actuales, $nuevos) as $p) {
        $quitar->execute([(int)$grupoId, (int)$p]);
    }
    $agregar = $pdo->prepare('INSERT INTO grupo_participantes (grupo_id, persona_id, desde) VALUES (?, ?, ?)');
    foreach (array_diff($nuevos, $actuales) as $p) {
        $agregar->execute([(int)$grupoId, (int)$p, hoy()]);
    }
}

if ($metodo === 'POST') {
    exigir_permiso($u, MODULO, 'registrar', 'Tu cargo no puede registrar grupos.');
    $c = validar_grupo(leer_json(), $u);
    $pdo = bd();
    $pdo->beginTransaction();
    try {
        $st = $pdo->prepare('INSERT INTO grupos (nombre, direccion, fecha_inicio, anfitrion_persona_id, discipulador_persona_id, estado, observaciones, creado, creado_por)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $st->execute([$c['nombre'], $c['direccion'], $c['fechaInicio'], $c['anfitrion'], $c['discipulador'], $c['estado'], $c['observaciones'], hoy(), $u['id']]);
        $gid = (int)$pdo->lastInsertId();
        sincronizar_participantes($gid, $c['participantes']);
        auditar($u, 'crear', 'grupos', $gid, $c['nombre']);
        $pdo->commit();
    } catch (Throwable $ex) {
        $pdo->rollBack();
        throw $ex;
    }
    responder(201, ['id' => $gid]);
}

if ($metodo === 'PUT') {
    exigir_permiso($u, MODULO, 'editar', 'Tu cargo no puede editar grupos.');
} else {
    exigir_permiso($u, MODULO, 'eliminar', 'Tu cargo no puede eliminar grupos.');
}
$id = id_de_url();
$st = bd()->prepare('SELECT id, nombre FROM grupos WHERE id = ?');
$st->execute([$id]);
$existente = $st->fetch();
if (!$existente) {
    fallar(404, 'no_existe', 'El grupo no existe.');
}

if ($metodo === 'PUT') {
    $c = validar_grupo(leer_json(), $u);
    $pdo = bd();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE grupos SET nombre = ?, direccion = ?, fecha_inicio = ?, anfitrion_persona_id = ?,
                       discipulador_persona_id = ?, estado = ?, observaciones = ? WHERE id = ?')
            ->execute([$c['nombre'], $c['direccion'], $c['fechaInicio'], $c['anfitrion'], $c['discipulador'], $c['estado'], $c['observaciones'], $id]);
        sincronizar_participantes($id, $c['participantes']);
        auditar($u, 'editar', 'grupos', $id, $c['nombre']);
        $pdo->commit();
    } catch (Throwable $ex) {
        $pdo->rollBack();
        throw $ex;
    }
    responder(200, ['id' => $id]);
}

$st = bd()->prepare('SELECT COUNT(*) FROM reuniones WHERE grupo_id = ?');
$st->execute([$id]);
if ((int)$st->fetchColumn() > 0) {
    fallar(409, 'dependencias', 'Este grupo ya tiene reuniones registradas: no se puede eliminar.');
}
bd()->prepare('DELETE FROM grupos WHERE id = ?')->execute([$id]);
auditar($u, 'eliminar', 'grupos', $id, $existente['nombre']);
responder(200, ['ok' => true]);

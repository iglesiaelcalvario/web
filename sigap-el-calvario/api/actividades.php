<?php
/* api/actividades.php  (módulo «actividades»: servicios, discipulados de mujeres, seminarios y otras actividades)
   POST          {tipoId, fecha, horaInicio, horaFin?, lugar?, responsableId?, asistentes: [personaId, …], observaciones?}
                                                                                            → registrar (permiso «registrar»)
   PUT  ?id=     mismos campos                                                             → corregir (permiso «editar»)
   DELETE ?id=                                                                             → eliminar (permiso «eliminar»)
   Los asistentes se marcan por persona: el total de la actividad es el número de personas marcadas.
   Las fechas no pueden ser futuras. Solo se usan tipos activos. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'actividades';
const PATRON_HORA = '/^([01]\d|2[0-3]):[0-5]\d$/';

$metodo = solo_metodos(['POST', 'PUT', 'DELETE']);
$u = exigir_usuario();
exigir_csrf();

// Hora «HH:MM» o null si no es una hora válida
function act_hora($v)
{
    $t = is_string($v) ? trim($v) : '';
    return preg_match(PATRON_HORA, $t) ? $t : null;
}

function act_tipo_activo($id)
{
    $st = bd()->prepare('SELECT 1 FROM tipos_actividad WHERE id = ? AND activo = 1');
    $st->execute([(int)$id]);
    return (bool)$st->fetchColumn();
}

function act_persona_existe($id)
{
    $st = bd()->prepare('SELECT 1 FROM personas WHERE id = ?');
    $st->execute([(int)$id]);
    return (bool)$st->fetchColumn();
}

// Lista de personas que asistieron: números positivos sin repetir, o null si la lista no es válida
function act_asistentes(array $d)
{
    if (!isset($d['asistentes']) || !is_array($d['asistentes'])) {
        return null;
    }
    $ids = [];
    foreach ($d['asistentes'] as $x) {
        if (!is_int($x) && !(is_string($x) && ctype_digit($x))) {
            return null;
        }
        $n = (int)$x;
        if ($n <= 0) {
            return null;
        }
        $ids[$n] = true;
    }
    return array_keys($ids);
}

// Valida y normaliza una actividad. Devuelve [errores, valores]. Reporta todos los errores a la vez.
function act_validar(array $d)
{
    $e = [];
    $tipo = entero(dato($d, 'tipoId'));
    if ($tipo === null || $tipo <= 0 || !act_tipo_activo($tipo)) {
        $e[] = ['campo' => 'tipoId', 'texto' => 'Elige un tipo de actividad disponible.'];
    }
    $fecha = linea(dato($d, 'fecha'));
    if ($fecha === '') {
        $e[] = ['campo' => 'fecha', 'texto' => 'Elige la fecha de la actividad.'];
    } elseif (!es_fecha($fecha)) {
        $e[] = ['campo' => 'fecha', 'texto' => 'La fecha no es válida.'];
    } elseif ($fecha > hoy()) {
        $e[] = ['campo' => 'fecha', 'texto' => 'La fecha no puede ser futura.'];
    }
    $inicio = act_hora(dato($d, 'horaInicio'));
    if ($inicio === null) {
        $e[] = ['campo' => 'horaInicio', 'texto' => 'Escribe la hora de inicio (por ejemplo 09:00).'];
    }
    $fin = trim((string)(isset($d['horaFin']) && is_string($d['horaFin']) ? $d['horaFin'] : ''));
    $finValor = null;
    if ($fin !== '') {
        $finValor = act_hora($fin);
        if ($finValor === null) {
            $e[] = ['campo' => 'horaFin', 'texto' => 'La hora de fin no es válida (por ejemplo 11:30).'];
        } elseif ($inicio !== null && $finValor <= $inicio) {
            $e[] = ['campo' => 'horaFin', 'texto' => 'La hora de fin debe ser posterior a la de inicio.'];
        }
    }
    $lugar = linea(dato($d, 'lugar'));
    if (largo($lugar) > 160) {
        $e[] = ['campo' => 'lugar', 'texto' => 'El lugar es demasiado largo (máximo 160 caracteres).'];
    }
    $resp = entero(dato($d, 'responsableId'));
    if ($resp !== null && $resp > 0 && !act_persona_existe($resp)) {
        $e[] = ['campo' => 'responsableId', 'texto' => 'La persona responsable no existe.'];
    }
    $asistentes = act_asistentes($d);
    if ($asistentes === null) {
        $e[] = ['campo' => 'asistentes', 'texto' => 'Marca a las personas que asistieron (la lista no es válida).'];
    } else {
        foreach ($asistentes as $pid) {
            if (!act_persona_existe($pid)) {
                $e[] = ['campo' => 'asistentes', 'texto' => 'Una de las personas marcadas ya no existe. Vuelve a marcar la lista.'];
                break;
            }
        }
    }
    $obs = bloque(dato($d, 'observaciones'));
    if (largo($obs) > 2000) {
        $e[] = ['campo' => 'observaciones', 'texto' => 'Las observaciones son demasiado largas (máximo 2000 caracteres).'];
    }
    return [$e, [
        'tipoId' => $tipo, 'fecha' => $fecha, 'horaInicio' => $inicio, 'horaFin' => $finValor,
        'lugar' => $lugar, 'responsableId' => ($resp !== null && $resp > 0) ? $resp : null,
        'asistentes' => $asistentes ?? [], 'observaciones' => $obs,
    ]];
}

// Reemplaza la lista de asistentes de una actividad (dentro de la misma operación que la guarda)
function act_guardar_asistentes($id, array $ids)
{
    bd()->prepare('DELETE FROM actividad_asistentes WHERE actividad_id = ?')->execute([(int)$id]);
    $st = bd()->prepare('INSERT INTO actividad_asistentes (actividad_id, persona_id) VALUES (?, ?)');
    foreach ($ids as $pid) {
        $st->execute([(int)$id, (int)$pid]);
    }
}

function act_existe($id)
{
    $st = bd()->prepare('SELECT id FROM actividades_generales WHERE id = ?');
    $st->execute([(int)$id]);
    return (bool)$st->fetchColumn();
}

if ($metodo === 'POST') {
    /* ---------- Registrar una actividad con sus asistentes ---------- */
    exigir_permiso($u, MODULO, 'registrar', 'Tu cargo no puede registrar actividades.');
    [$e, $v] = act_validar(leer_json());
    if ($e) {
        fallar_validacion($e);
    }
    bd()->beginTransaction();
    try {
        bd()->prepare('INSERT INTO actividades_generales (tipo_id, fecha, hora_inicio, hora_fin, lugar, responsable_persona_id,
                       asistentes, lista_registrada, observaciones, registrado_por, registrado) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NOW())')
            ->execute([$v['tipoId'], $v['fecha'], $v['horaInicio'], $v['horaFin'], $v['lugar'], $v['responsableId'],
                       count($v['asistentes']), $v['observaciones'], (int)$u['id']]);
        $id = (int)bd()->lastInsertId();
        act_guardar_asistentes($id, $v['asistentes']);
        bd()->commit();
    } catch (Throwable $ex) {
        bd()->rollBack();
        throw $ex;
    }
    auditar($u, 'crear', 'actividades', $id, $v['fecha'] . ' · asistentes ' . count($v['asistentes']));
    responder(201, ['id' => $id]);
}

$id = id_de_url();
if (!act_existe($id)) {
    fallar(404, 'no_existe', 'La actividad no existe.');
}

if ($metodo === 'PUT') {
    /* ---------- Corregir una actividad y su lista de asistentes ---------- */
    exigir_permiso($u, MODULO, 'editar', 'Tu cargo no puede corregir actividades.');
    [$e, $v] = act_validar(leer_json());
    if ($e) {
        fallar_validacion($e);
    }
    bd()->beginTransaction();
    try {
        bd()->prepare('UPDATE actividades_generales SET tipo_id = ?, fecha = ?, hora_inicio = ?, hora_fin = ?, lugar = ?,
                       responsable_persona_id = ?, asistentes = ?, lista_registrada = 1, observaciones = ? WHERE id = ?')
            ->execute([$v['tipoId'], $v['fecha'], $v['horaInicio'], $v['horaFin'], $v['lugar'], $v['responsableId'],
                       count($v['asistentes']), $v['observaciones'], $id]);
        act_guardar_asistentes($id, $v['asistentes']);
        bd()->commit();
    } catch (Throwable $ex) {
        bd()->rollBack();
        throw $ex;
    }
    auditar($u, 'editar', 'actividades', $id, $v['fecha'] . ' · asistentes ' . count($v['asistentes']));
    responder(200, ['id' => $id]);
}

/* ---------- Eliminar una actividad (su lista se borra con ella) ---------- */
exigir_permiso($u, MODULO, 'eliminar', 'Tu cargo no puede eliminar actividades.');
bd()->prepare('DELETE FROM actividades_generales WHERE id = ?')->execute([$id]);
auditar($u, 'eliminar', 'actividades', $id, 'actividad eliminada');
responder(200, ['id' => $id]);

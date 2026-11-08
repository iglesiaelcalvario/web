<?php
/* api/asistencia_pastoral.php  (módulo «asistencia-pastoral»)
   POST                        {personas:[ids], categoriaId, descripcion, responsableId, fecha,
                                 actividad, observaciones, estado, proximoSeguimiento}
                               → abre un caso por cada persona y registra su primera actuación.
                                 Permiso «registrar»; «masivo» si son varias personas.
   POST ?caso=ID               {fecha, responsableId, actividad, observaciones, estado, proximoSeguimiento}
                               → agrega una actuación al historial del caso (permiso «seguimiento»).
   PUT  ?id=                   {categoriaId, descripcion, responsableId}
                               → corrige los datos del caso (permiso «editar»). El historial no cambia.
   Los casos y sus actuaciones nunca se borran. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'asistencia-pastoral';
const ESTADOS_CASO = ['Pendiente', 'En seguimiento', 'Atendido', 'Cerrado'];

$metodo = solo_metodos(['POST', 'PUT']);
$u = exigir_usuario();
exigir_csrf();

// Solo quienes atienden casos pueden ser responsables de ellos
function responsable_valido($id)
{
    $st = bd()->prepare("SELECT u.id FROM usuarios u JOIN roles r ON r.id = u.rol_id
                         WHERE u.id = ? AND u.activo = 1 AND r.clave IN ('admin', 'pastor', 'asistente')");
    $st->execute([(int)$id]);
    return (bool)$st->fetchColumn();
}

function categoria_activa($id)
{
    $st = bd()->prepare('SELECT 1 FROM categorias_pastorales WHERE id = ? AND activo = 1');
    $st->execute([(int)$id]);
    return (bool)$st->fetchColumn();
}

// Datos básicos del caso: categoría, descripción y responsable (opcional)
function errores_caso(array $d)
{
    $e = [];
    $cat = entero(dato($d, 'categoriaId'));
    $desc = bloque(dato($d, 'descripcion'));
    $resp = entero(dato($d, 'responsableId'));
    if ($cat === null || $cat <= 0 || !categoria_activa($cat)) {
        $e[] = ['campo' => 'categoriaId', 'texto' => 'Elige la categoría de la situación.'];
    }
    if ($desc === '') {
        $e[] = ['campo' => 'descripcion', 'texto' => 'Escribe la descripción de la situación.'];
    } elseif (largo($desc) > 2000) {
        $e[] = ['campo' => 'descripcion', 'texto' => 'La descripción es demasiado larga (máximo 2000 caracteres).'];
    }
    if ($resp !== null && $resp > 0 && !responsable_valido($resp)) {
        $e[] = ['campo' => 'responsableId', 'texto' => 'La persona elegida no puede atender casos pastorales.'];
    }
    return $e;
}

// Una atención: la primera de un caso o una actuación nueva.
// $minima: no antes de la apertura del caso. $maxima: no antes de la última actuación registrada.
function errores_actuacion($fecha, $actividad, $observaciones, $estado, $proximo, $minima, $maxima = null)
{
    $e = [];
    if ($fecha === '') {
        $e[] = ['campo' => 'fecha', 'texto' => 'Elige la fecha de la atención.'];
    } elseif (!es_fecha($fecha)) {
        $e[] = ['campo' => 'fecha', 'texto' => 'La fecha no es válida.'];
    } elseif ($fecha > hoy()) {
        $e[] = ['campo' => 'fecha', 'texto' => 'La fecha no puede ser futura.'];
    } elseif ($minima !== null && $fecha < $minima) {
        $e[] = ['campo' => 'fecha', 'texto' => 'La fecha es anterior a la apertura del caso.'];
    } elseif ($maxima !== null && $fecha < $maxima) {
        $e[] = ['campo' => 'fecha', 'texto' => 'La fecha es anterior a la última actuación registrada.'];
    }
    if ($actividad === '') {
        $e[] = ['campo' => 'actividad', 'texto' => 'Escribe la actividad o atención realizada.'];
    } elseif (largo($actividad) > 2000) {
        $e[] = ['campo' => 'actividad', 'texto' => 'La actividad es demasiado larga (máximo 2000 caracteres).'];
    }
    if (largo($observaciones) > 2000) {
        $e[] = ['campo' => 'observaciones', 'texto' => 'Las observaciones son demasiado largas (máximo 2000 caracteres).'];
    }
    if (!in_array($estado, ESTADOS_CASO, true)) {
        $e[] = ['campo' => 'estado', 'texto' => 'El estado no es válido.'];
    }
    if ($proximo !== '') {
        if ($estado === 'Cerrado') {
            $e[] = ['campo' => 'proximoSeguimiento', 'texto' => 'Un caso cerrado no tiene próximo seguimiento.'];
        } elseif (!es_fecha($proximo)) {
            $e[] = ['campo' => 'proximoSeguimiento', 'texto' => 'La fecha del próximo seguimiento no es válida.'];
        } elseif (es_fecha($fecha) && $proximo < $fecha) {
            $e[] = ['campo' => 'proximoSeguimiento', 'texto' => 'El próximo seguimiento no puede ser anterior a esta atención.'];
        }
    }
    return $e;
}

if ($metodo === 'POST' && !isset($_GET['caso'])) {
    /* ---------- Abrir uno o varios casos ---------- */
    $d = leer_json();
    $personas = [];
    if (is_array(dato($d, 'personas'))) {
        foreach (dato($d, 'personas') as $x) {
            $n = entero($x);
            if ($n !== null && $n > 0 && !in_array($n, $personas, true)) {
                $personas[] = $n;
            }
        }
    }
    if (count($personas) > 1) {
        exigir_permiso($u, MODULO, 'masivo', 'Tu cargo no puede abrir casos para varias personas a la vez.');
    } else {
        exigir_permiso($u, MODULO, 'registrar', 'Tu cargo no puede abrir casos pastorales.');
    }
    // Se reportan todos los errores a la vez, para que la persona los corrija de una sola vez
    $e = errores_caso($d);
    if (!$personas) {
        $e[] = ['campo' => 'personas', 'texto' => 'Elige al menos una persona atendida.'];
    }
    $cat = entero(dato($d, 'categoriaId'));
    $desc = bloque(dato($d, 'descripcion'));
    $fecha = linea(dato($d, 'fecha'));
    $actividad = bloque(dato($d, 'actividad'));
    $obs = bloque(dato($d, 'observaciones'));
    $estado = linea(dato($d, 'estado'));
    if ($estado === '') {
        $estado = 'Pendiente';
    }
    $proximo = linea(dato($d, 'proximoSeguimiento'));
    $resp = entero(dato($d, 'responsableId'));
    if ($resp === null || $resp <= 0) {
        $resp = (int)$u['id'];
    }
    foreach ($personas as $pid) {
        if (!existe_persona($pid)) {
            $e[] = ['campo' => 'personas', 'texto' => 'Una de las personas elegidas no existe.'];
            break;
        }
    }
    $e = array_merge($e, errores_actuacion($fecha, $actividad, $obs, $estado, $proximo, null));
    if (es_fecha($fecha) && !$e) {
        foreach ($personas as $pid) {
            $st = bd()->prepare('SELECT nacimiento FROM personas WHERE id = ?');
            $st->execute([$pid]);
            $nac = $st->fetchColumn();
            if ($nac && $fecha < $nac) {
                $e[] = ['campo' => 'fecha', 'texto' => 'La fecha es anterior al nacimiento de una de las personas.'];
                break;
            }
        }
    }
    if ($e) {
        fallar_validacion($e);
    }
    $sigProx = $proximo === '' ? null : $proximo;
    $pdo = bd();
    $pdo->beginTransaction();
    $ids = [];
    try {
        $caso = $pdo->prepare('INSERT INTO casos_pastorales (persona_id, categoria_id, descripcion, fecha_apertura, responsable_usuario_id,
                               estado, proximo_seguimiento, creado_por, creado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $act = $pdo->prepare('INSERT INTO actuaciones_pastorales (caso_id, fecha, responsable_usuario_id, actividad, observaciones,
                              estado, proximo_seguimiento, registrada_por, registrada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())');
        foreach ($personas as $pid) {
            $caso->execute([$pid, (int)$cat, $desc, $fecha, $resp, $estado, $sigProx, (int)$u['id'], hoy()]);
            $cid = (int)$pdo->lastInsertId();
            $act->execute([$cid, $fecha, $resp, $actividad, $obs, $estado, $sigProx, (int)$u['id']]);
            $ids[] = $cid;
            auditar($u, 'crear', 'casos', $cid, 'persona ' . $pid);
        }
        $pdo->commit();
    } catch (Throwable $ex) {
        $pdo->rollBack();
        throw $ex;
    }
    responder(201, ['ids' => $ids]);
}

if ($metodo === 'POST') {
    /* ---------- Agregar una actuación al historial de un caso ---------- */
    exigir_permiso($u, MODULO, 'seguimiento', 'Tu cargo no puede registrar actuaciones.');
    $cid = filter_var($_GET['caso'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($cid === false || $cid === null) {
        fallar(400, 'caso', 'Falta el identificador del caso.');
    }
    $st = bd()->prepare('SELECT id, fecha_apertura FROM casos_pastorales WHERE id = ?');
    $st->execute([$cid]);
    $caso = $st->fetch();
    if (!$caso) {
        fallar(404, 'no_existe', 'El caso no existe.');
    }
    $d = leer_json();
    $fecha = linea(dato($d, 'fecha'));
    $actividad = bloque(dato($d, 'actividad'));
    $obs = bloque(dato($d, 'observaciones'));
    $estado = linea(dato($d, 'estado'));
    if ($estado === '') {
        $estado = 'En seguimiento';
    }
    $proximo = linea(dato($d, 'proximoSeguimiento'));
    $resp = entero(dato($d, 'responsableId'));
    if ($resp === null || $resp <= 0) {
        $resp = (int)$u['id'];
    }
    $e = [];
    if (!responsable_valido($resp)) {
        $e[] = ['campo' => 'responsableId', 'texto' => 'La persona elegida no puede atender casos pastorales.'];
    }
    $ult = bd()->prepare('SELECT MAX(fecha) FROM actuaciones_pastorales WHERE caso_id = ?');
    $ult->execute([$cid]);
    $maxima = $ult->fetchColumn() ?: null;
    $e = array_merge($e, errores_actuacion($fecha, $actividad, $obs, $estado, $proximo, $caso['fecha_apertura'], $maxima));
    if ($e) {
        fallar_validacion($e);
    }
    $sigProx = $proximo === '' ? null : $proximo;
    $pdo = bd();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO actuaciones_pastorales (caso_id, fecha, responsable_usuario_id, actividad, observaciones,
                       estado, proximo_seguimiento, registrada_por, registrada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())')
            ->execute([$cid, $fecha, $resp, $actividad, $obs, $estado, $sigProx, (int)$u['id']]);
        $actId = (int)$pdo->lastInsertId();
        // El caso muestra el estado, la próxima atención y el responsable de su última actuación
        $pdo->prepare('UPDATE casos_pastorales SET estado = ?, proximo_seguimiento = ?, responsable_usuario_id = ? WHERE id = ?')
            ->execute([$estado, $sigProx, $resp, $cid]);
        auditar($u, 'crear', 'actuaciones', $actId, 'caso ' . $cid . ' · ' . $estado);
        $pdo->commit();
    } catch (Throwable $ex) {
        $pdo->rollBack();
        throw $ex;
    }
    responder(201, ['id' => $actId]);
}

/* ---------- Corregir los datos básicos del caso ---------- */
exigir_permiso($u, MODULO, 'editar', 'Tu cargo no puede editar casos pastorales.');
$id = id_de_url();
$st = bd()->prepare('SELECT id, responsable_usuario_id FROM casos_pastorales WHERE id = ?');
$st->execute([$id]);
$caso = $st->fetch();
if (!$caso) {
    fallar(404, 'no_existe', 'El caso no existe.');
}
$d = leer_json();
$e = errores_caso($d);
if ($e) {
    fallar_validacion($e);
}
$cat = entero(dato($d, 'categoriaId'));
$desc = bloque(dato($d, 'descripcion'));
$resp = entero(dato($d, 'responsableId'));
if ($resp === null || $resp <= 0) {
    $resp = $caso['responsable_usuario_id'] !== null ? (int)$caso['responsable_usuario_id'] : null;
}
bd()->prepare('UPDATE casos_pastorales SET categoria_id = ?, descripcion = ?, responsable_usuario_id = ? WHERE id = ?')
    ->execute([(int)$cat, $desc, $resp, $id]);
auditar($u, 'editar', 'casos', $id, 'datos del caso');
responder(200, ['id' => $id]);

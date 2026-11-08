<?php
/* api/adiestramiento.php  (módulo «adiestramiento»)
   PUT    ?curso=ID                  {responsableId}   → adiestrador habitual del curso (permiso «editar»)
   POST   ?curso=ID                  {personas:[ids]}  → inscribir personas (permiso «registrar»; «masivo» si son varias)
   DELETE ?curso=ID&persona=ID                         → quitar a una persona del curso (permiso «eliminar»;
                                                          no se permite si ya tiene asistencias en el curso) */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'adiestramiento';

$metodo = solo_metodos(['POST', 'PUT', 'DELETE']);
$u = exigir_usuario();
exigir_csrf();

$cursoId = filter_var(isset($_GET['curso']) ? $_GET['curso'] : null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if ($cursoId === false || $cursoId === null) {
    fallar(400, 'curso', 'Falta el identificador del curso.');
}
$st = bd()->prepare('SELECT c.id, c.nombre, p.clave AS proceso FROM cursos c JOIN procesos p ON p.id = c.proceso_id WHERE c.id = ?');
$st->execute([$cursoId]);
$curso = $st->fetch();
if (!$curso || $curso['proceso'] !== 'adiestramiento') {
    fallar(404, 'no_existe', 'El curso de Adiestramiento no existe.');
}

if ($metodo === 'PUT') {
    exigir_permiso($u, MODULO, 'editar', 'Tu cargo no puede cambiar el adiestrador habitual.');
    $d = leer_json();
    if (!array_key_exists('responsableId', $d)) {
        fallar_validacion([['campo' => 'responsableId', 'texto' => 'Indica el adiestrador habitual o «Sin adiestrador habitual».']]);
    }
    $rid = null;
    if ($d['responsableId'] !== null && $d['responsableId'] !== '') {
        $rid = entero($d['responsableId']);
        if ($rid === null || $rid <= 0 || !existe_persona($rid)) {
            fallar_validacion([['campo' => 'responsableId', 'texto' => 'La persona elegida no existe.']]);
        }
        if (!persona_con_funcion($rid, 'adiestrador')) {
            fallar_validacion([['campo' => 'responsableId', 'texto' => 'La persona elegida no tiene la función de adiestrador. Asígnasela en su ficha.']]);
        }
    }
    bd()->prepare('UPDATE cursos SET responsable_persona_id = ? WHERE id = ?')->execute([$rid, $cursoId]);
    auditar($u, 'editar', 'cursos', $cursoId, 'adiestrador habitual: ' . ($rid === null ? 'ninguno' : $rid));
    responder(200, ['id' => $cursoId]);
}

if ($metodo === 'POST') {
    $d = leer_json();
    $personas = [];
    $bp = dato($d, 'personas');
    if (is_array($bp)) {
        foreach ($bp as $x) {
            $n = entero($x);
            if ($n !== null && $n > 0 && !in_array($n, $personas, true)) {
                $personas[] = $n;
            }
        }
    }
    if (!$personas) {
        fallar_validacion([['campo' => 'personas', 'texto' => 'Marca al menos una persona.']]);
    }
    if (count($personas) > 1) {
        exigir_permiso($u, MODULO, 'masivo', 'Tu cargo no puede inscribir varias personas a la vez.');
    } else {
        exigir_permiso($u, MODULO, 'registrar', 'Tu cargo no puede inscribir personas.');
    }
    foreach ($personas as $pid) {
        if (!existe_persona($pid)) {
            fallar_validacion([['campo' => 'personas', 'texto' => 'Una de las personas marcadas no existe.']]);
        }
    }
    $pdo = bd();
    $pdo->beginTransaction();
    try {
        $existe = $pdo->prepare('SELECT 1 FROM curso_participantes WHERE curso_id = ? AND persona_id = ?');
        $ins = $pdo->prepare('INSERT INTO curso_participantes (curso_id, persona_id, desde) VALUES (?, ?, ?)');
        $agregados = 0;
        foreach ($personas as $pid) {
            $existe->execute([$cursoId, $pid]);
            $ya = $existe->fetchColumn();
            $existe->closeCursor();
            if (!$ya) {
                $ins->execute([$cursoId, $pid, hoy()]);
                $agregados++;
            }
        }
        $pdo->commit();
    } catch (Throwable $ex) {
        $pdo->rollBack();
        throw $ex;
    }
    if ($agregados > 0) {
        auditar($u, 'crear', 'curso_participantes', $cursoId, $agregados . ' inscritos');
    }
    responder(201, ['agregados' => $agregados, 'yaEstaban' => count($personas) - $agregados]);
}

// DELETE
exigir_permiso($u, MODULO, 'eliminar', 'Tu cargo no puede quitar participantes.');
$personaId = entero(isset($_GET['persona']) ? $_GET['persona'] : null);
if ($personaId === null || $personaId <= 0) {
    fallar(400, 'persona', 'Falta la persona.');
}
$st = bd()->prepare('SELECT COUNT(*) FROM sesion_asistencia sa JOIN sesiones_adiestramiento s ON s.id = sa.sesion_id
                     WHERE s.curso_id = ? AND sa.persona_id = ?');
$st->execute([$cursoId, $personaId]);
if ((int)$st->fetchColumn() > 0) {
    fallar(409, 'dependencias', 'Esta persona ya tiene asistencias en el curso: no se puede quitar para conservar el historial.');
}
bd()->prepare('DELETE FROM curso_participantes WHERE curso_id = ? AND persona_id = ?')->execute([$cursoId, $personaId]);
auditar($u, 'eliminar', 'curso_participantes', $cursoId, 'persona ' . $personaId);
responder(200, ['ok' => true]);

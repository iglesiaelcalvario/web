<?php
/* api/nacidos_bautizados.php  (módulo «nacidos-bautizados»)
   POST                       {tipo, personaId, fecha, responsableId, observaciones}  → registrar
   PUT    ?tipo=&id=          {fecha, responsableId, observaciones}                   → editar
   DELETE ?tipo=&id=                                                                  → eliminar
   tipo = «nacido» (nacido de nuevo) o «bautismo». Cada persona tiene como máximo un registro de cada tipo.
   Un tipo no implica el otro: un registro de nacido de nuevo NO crea un bautismo, ni al revés. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'nacidos-bautizados';
const TIPOS = [
    'nacido'   => ['tabla' => 'nacidos_de_nuevo', 'nombre' => 'nacimiento de nuevo', 'coleccion' => 'nacidos'],
    'bautismo' => ['tabla' => 'bautismos', 'nombre' => 'bautismo', 'coleccion' => 'bautismos'],
];

$metodo = solo_metodos(['POST', 'PUT', 'DELETE']);
$u = exigir_usuario();
exigir_csrf();

function tipo_de(array $fuente)
{
    $t = isset($fuente['tipo']) && is_string($fuente['tipo']) ? $fuente['tipo'] : '';
    if (!isset(TIPOS[$t])) {
        fallar_validacion([['campo' => 'tipo', 'texto' => 'El tipo de registro no es válido.']]);
    }
    return TIPOS[$t];
}

function validar_registro(array $d, array $tipo, $personaId)
{
    $e = [];
    $fecha = linea(dato($d, 'fecha'));
    $obs = bloque(dato($d, 'observaciones'));
    $resp = entero(dato($d, 'responsableId'));
    if ($fecha === '') {
        $e[] = ['campo' => 'fecha', 'texto' => 'Elige la fecha del ' . $tipo['nombre'] . '.'];
    } elseif (!es_fecha($fecha)) {
        $e[] = ['campo' => 'fecha', 'texto' => 'La fecha no es válida.'];
    } elseif ($fecha > hoy()) {
        $e[] = ['campo' => 'fecha', 'texto' => 'La fecha no puede ser futura.'];
    } else {
        $st = bd()->prepare('SELECT nacimiento FROM personas WHERE id = ?');
        $st->execute([(int)$personaId]);
        $nac = $st->fetchColumn();
        if ($nac && $fecha < $nac) {
            $e[] = ['campo' => 'fecha', 'texto' => 'La fecha es anterior al nacimiento de la persona.'];
        }
    }
    if ($resp !== null && $resp > 0 && !existe_persona($resp)) {
        $e[] = ['campo' => 'responsableId', 'texto' => 'La persona responsable no existe.'];
    }
    if (largo($obs) > 2000) {
        $e[] = ['campo' => 'observaciones', 'texto' => 'Las observaciones son demasiado largas (máximo 2000 caracteres).'];
    }
    if ($e) {
        fallar_validacion($e);
    }
    return [$fecha, ($resp !== null && $resp > 0) ? $resp : null, $obs];
}

function ya_tiene_registro(array $tipo, $personaId, $idActual)
{
    $st = bd()->prepare('SELECT id FROM ' . $tipo['tabla'] . ' WHERE persona_id = ? AND id <> ?');
    $st->execute([(int)$personaId, (int)$idActual]);
    return (bool)$st->fetch();
}

if ($metodo === 'POST') {
    $d = leer_json();
    $tipo = tipo_de($d);
    exigir_permiso($u, MODULO, 'registrar', 'Tu cargo no puede registrar nacidos de nuevo ni bautismos.');
    $personaId = entero(dato($d, 'personaId'));
    if ($personaId === null || $personaId <= 0 || !existe_persona($personaId)) {
        fallar_validacion([['campo' => 'personaId', 'texto' => 'Elige la persona.']]);
    }
    if (ya_tiene_registro($tipo, $personaId, 0)) {
        fallar_validacion([['campo' => 'personaId', 'texto' => 'Esta persona ya tiene un registro de ' . $tipo['nombre'] . '. Edítalo en lugar de crear otro.']]);
    }
    list($fecha, $resp, $obs) = validar_registro($d, $tipo, $personaId);
    try {
        bd()->prepare('INSERT INTO ' . $tipo['tabla'] . ' (persona_id, fecha, responsable_persona_id, observaciones, registrado_por, registrada)
                       VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$personaId, $fecha, $resp, $obs, $u['id'], hoy()]);
    } catch (PDOException $ex) {
        if (codigo_mysql($ex) === 1062) {
            fallar_validacion([['campo' => 'personaId', 'texto' => 'Esta persona ya tiene un registro de ' . $tipo['nombre'] . '.']]);
        }
        throw $ex;
    }
    $id = (int)bd()->lastInsertId();
    auditar($u, 'crear', $tipo['coleccion'], $id, 'persona ' . $personaId);
    responder(201, ['id' => $id]);
}

$tipo = tipo_de(['tipo' => isset($_GET['tipo']) ? $_GET['tipo'] : '']);
if ($metodo === 'PUT') {
    exigir_permiso($u, MODULO, 'editar', 'Tu cargo no puede editar estos registros.');
} else {
    exigir_permiso($u, MODULO, 'eliminar', 'Tu cargo no puede eliminar estos registros.');
}
$id = id_de_url();
$st = bd()->prepare('SELECT id, persona_id FROM ' . $tipo['tabla'] . ' WHERE id = ?');
$st->execute([$id]);
$reg = $st->fetch();
if (!$reg) {
    fallar(404, 'no_existe', 'El registro no existe.');
}

if ($metodo === 'PUT') {
    list($fecha, $resp, $obs) = validar_registro(leer_json(), $tipo, $reg['persona_id']);
    bd()->prepare('UPDATE ' . $tipo['tabla'] . ' SET fecha = ?, responsable_persona_id = ?, observaciones = ? WHERE id = ?')
        ->execute([$fecha, $resp, $obs, $id]);
    auditar($u, 'editar', $tipo['coleccion'], $id, 'persona ' . $reg['persona_id']);
    responder(200, ['id' => $id]);
}

bd()->prepare('DELETE FROM ' . $tipo['tabla'] . ' WHERE id = ?')->execute([$id]);
auditar($u, 'eliminar', $tipo['coleccion'], $id, 'persona ' . $reg['persona_id']);
responder(200, ['ok' => true]);

<?php
/* api/grupos_otros.php  —  GET ?tipo= listar · POST crear · PUT ?id= editar   (módulo «grupos»: Adiestramiento y otros grupos) */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'grupos';
const TIPOS_GRUPO_OTRO = ['adiestramiento' => 'Adiestramiento', 'otro' => 'Otros grupos'];
const ESTADOS_GRUPO_OTRO = ['Activo', 'Inactivo'];

$metodo = solo_metodos(['GET', 'POST', 'PUT']);
$u = exigir_usuario();
if ($metodo !== 'GET') {
    exigir_csrf();
}

function validar_grupo_otro(array $d)
{
    $e = [];
    $tipo = linea(dato($d, 'tipo'));
    $nombre = linea(dato($d, 'nombre'));
    $lugar = linea(dato($d, 'lugar'));
    $fechaInicio = linea(dato($d, 'fechaInicio'));
    $responsable = linea(dato($d, 'responsable'));
    $observaciones = bloque(dato($d, 'observaciones'));
    $estado = linea(dato($d, 'estado'));
    if ($estado === '') {
        $estado = 'Activo';
    }
    if (!array_key_exists($tipo, TIPOS_GRUPO_OTRO)) {
        $e[] = ['campo' => 'tipo', 'texto' => 'El tipo de grupo no es válido.'];
    }
    if ($nombre === '') {
        $e[] = ['campo' => 'nombre', 'texto' => 'Escribe el nombre del grupo.'];
    } elseif (largo($nombre) > 80) {
        $e[] = ['campo' => 'nombre', 'texto' => 'El nombre es demasiado largo (máximo 80 caracteres).'];
    }
    if ($lugar === '') {
        $e[] = ['campo' => 'lugar', 'texto' => 'Escribe el lugar donde se reúne el grupo.'];
    } elseif (largo($lugar) > 160) {
        $e[] = ['campo' => 'lugar', 'texto' => 'El lugar es demasiado largo (máximo 160 caracteres).'];
    }
    if ($fechaInicio === '') {
        $e[] = ['campo' => 'fechaInicio', 'texto' => 'Elige la fecha de inicio del grupo.'];
    } elseif (!es_fecha($fechaInicio)) {
        $e[] = ['campo' => 'fechaInicio', 'texto' => 'La fecha de inicio no es válida.'];
    } elseif ($fechaInicio > hoy()) {
        $e[] = ['campo' => 'fechaInicio', 'texto' => 'La fecha de inicio no puede ser futura.'];
    }
    if (largo($responsable) > 120) {
        $e[] = ['campo' => 'responsable', 'texto' => 'El responsable es demasiado largo (máximo 120 caracteres).'];
    }
    if (!in_array($estado, ESTADOS_GRUPO_OTRO, true)) {
        $e[] = ['campo' => 'estado', 'texto' => 'El estado del grupo no es válido.'];
    }
    if (largo($observaciones) > 2000) {
        $e[] = ['campo' => 'observaciones', 'texto' => 'Las observaciones son demasiado largas (máximo 2000 caracteres).'];
    }
    if ($e) {
        fallar_validacion($e);
    }
    return ['tipo' => $tipo, 'nombre' => $nombre, 'lugar' => $lugar, 'fechaInicio' => $fechaInicio,
            'responsable' => $responsable, 'observaciones' => $observaciones, 'estado' => $estado];
}

if ($metodo === 'GET') {
    exigir_permiso($u, MODULO, 'consultar', 'No tienes acceso a los grupos.');
    $tipo = linea($_GET['tipo'] ?? '');
    if (!array_key_exists($tipo, TIPOS_GRUPO_OTRO)) {
        fallar_validacion([['campo' => 'tipo', 'texto' => 'El tipo de grupo no es válido.']]);
    }
    $st = bd()->prepare('SELECT id, tipo, nombre, lugar, fecha_inicio, responsable, observaciones, estado
                         FROM grupos_otros WHERE tipo = ? ORDER BY estado, nombre');
    $st->execute([$tipo]);
    $grupos = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $grupos[] = ['id' => (int)$r['id'], 'tipo' => $r['tipo'], 'nombre' => $r['nombre'], 'lugar' => $r['lugar'],
                     'fechaInicio' => $r['fecha_inicio'], 'responsable' => $r['responsable'],
                     'observaciones' => $r['observaciones'], 'estado' => $r['estado']];
    }
    responder(200, ['grupos' => $grupos]);
}

if ($metodo === 'POST') {
    exigir_permiso($u, MODULO, 'registrar', 'No tienes permiso para crear grupos.');
    $c = validar_grupo_otro(leer_json());
    $st = bd()->prepare('INSERT INTO grupos_otros (tipo, nombre, lugar, fecha_inicio, responsable, observaciones, estado, creado, creado_por)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $st->execute([$c['tipo'], $c['nombre'], $c['lugar'], $c['fechaInicio'], $c['responsable'], $c['observaciones'],
                  $c['estado'], hoy(), $u['id']]);
    $id = (int)bd()->lastInsertId();
    auditar($u, 'crear', 'grupos_otros', $id, $c['nombre']);
    responder(201, ['id' => $id]);
}

// PUT: editar o inactivar. El tipo no cambia: se conserva el que ya tiene el grupo.
exigir_permiso($u, MODULO, 'editar', 'No tienes permiso para editar grupos.');
$id = id_de_url();
$st = bd()->prepare('SELECT tipo FROM grupos_otros WHERE id = ?');
$st->execute([$id]);
$actual = $st->fetch(PDO::FETCH_ASSOC);
if (!$actual) {
    fallar(404, 'no_existe', 'El grupo no existe.');
}
$cuerpo = leer_json();
$cuerpo['tipo'] = $actual['tipo'];
$c = validar_grupo_otro($cuerpo);
bd()->prepare('UPDATE grupos_otros SET nombre = ?, lugar = ?, fecha_inicio = ?, responsable = ?, observaciones = ?, estado = ?
               WHERE id = ?')
    ->execute([$c['nombre'], $c['lugar'], $c['fechaInicio'], $c['responsable'], $c['observaciones'], $c['estado'], $id]);
auditar($u, 'editar', 'grupos_otros', $id, $c['nombre'] . ' · ' . $c['estado']);
responder(200, ['id' => $id]);

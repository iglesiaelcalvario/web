<?php
/* api/tipos_actividad.php  (módulo «tipos-actividad», solo el administrador)
   POST              {nombre, orden?}                    → agregar un tipo (permiso «registrar»)
   PUT  ?id=         {nombre?, activo?, orden?}          → renombrar, ordenar, activar o desactivar (permiso «editar»)
   Los tipos no se borran: se desactivan, y las actividades anteriores conservan su tipo. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'tipos-actividad';

$metodo = solo_metodos(['POST', 'PUT']);
$u = exigir_usuario();
exigir_csrf();

function errores_nombre_tipo($v)
{
    $n = linea($v);
    if ($n === '') {
        return [['campo' => 'nombre', 'texto' => 'Escribe el nombre del tipo.']];
    }
    if (largo($n) < 3) {
        return [['campo' => 'nombre', 'texto' => 'El nombre es demasiado corto.']];
    }
    if (largo($n) > 120) {
        return [['campo' => 'nombre', 'texto' => 'El nombre es demasiado largo (máximo 120 caracteres).']];
    }
    return [];
}

function responder_tipo_repetido()
{
    fallar_validacion([['campo' => 'nombre', 'texto' => 'Ya existe un tipo con ese nombre.']]);
}

if ($metodo === 'POST') {
    exigir_permiso($u, MODULO, 'registrar', 'Solo el administrador puede agregar tipos de actividad.');
    $d = leer_json();
    $e = errores_nombre_tipo(dato($d, 'nombre'));
    if ($e) {
        fallar_validacion($e);
    }
    $nombre = linea(dato($d, 'nombre'));
    $orden = entero(dato($d, 'orden'));
    if ($orden === null || $orden < 0 || $orden > 999) {
        $orden = 0;
    }
    try {
        bd()->prepare('INSERT INTO tipos_actividad (nombre, activo, orden) VALUES (?, 1, ?)')->execute([$nombre, $orden]);
    } catch (PDOException $ex) {
        if (codigo_mysql($ex) === 1062) {
            responder_tipo_repetido();
        }
        throw $ex;
    }
    $id = (int)bd()->lastInsertId();
    auditar($u, 'crear', 'tipos-actividad', $id, $nombre);
    responder(201, ['id' => $id]);
}

exigir_permiso($u, MODULO, 'editar', 'Solo el administrador puede cambiar los tipos de actividad.');
$id = id_de_url();
$st = bd()->prepare('SELECT id FROM tipos_actividad WHERE id = ?');
$st->execute([$id]);
if (!$st->fetch()) {
    fallar(404, 'no_existe', 'El tipo no existe.');
}
$d = leer_json();
$sets = [];
$params = [];
if (array_key_exists('nombre', $d)) {
    $e = errores_nombre_tipo($d['nombre']);
    if ($e) {
        fallar_validacion($e);
    }
    $sets[] = 'nombre = ?';
    $params[] = linea($d['nombre']);
}
if (array_key_exists('activo', $d)) {
    if (!is_bool($d['activo'])) {
        fallar_validacion([['campo' => 'activo', 'texto' => 'El estado no es válido.']]);
    }
    $sets[] = 'activo = ?';
    $params[] = $d['activo'] ? 1 : 0;
}
if (array_key_exists('orden', $d)) {
    $o = entero($d['orden']);
    if ($o === null || $o < 0 || $o > 999) {
        fallar_validacion([['campo' => 'orden', 'texto' => 'El orden no es válido.']]);
    }
    $sets[] = 'orden = ?';
    $params[] = $o;
}
if (!$sets) {
    fallar_validacion([['campo' => 'nombre', 'texto' => 'No hay cambios que guardar.']]);
}
$params[] = $id;
try {
    bd()->prepare('UPDATE tipos_actividad SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
} catch (PDOException $ex) {
    if (codigo_mysql($ex) === 1062) {
        responder_tipo_repetido();
    }
    throw $ex;
}
auditar($u, 'editar', 'tipos-actividad', $id, implode(', ', array_keys($d)));
responder(200, ['id' => $id]);

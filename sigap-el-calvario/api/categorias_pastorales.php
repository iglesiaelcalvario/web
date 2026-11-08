<?php
/* api/categorias_pastorales.php  (módulo «categorias-pastorales», solo el administrador)
   POST               {nombre, orden}                 → agregar una categoría (permiso «registrar»)
   PUT  ?id=          {nombre?, activo?, orden?}      → renombrar, activar o desactivar (permiso «editar»)
   Las categorías no se borran: se desactivan, y los casos anteriores conservan su categoría. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'categorias-pastorales';

$metodo = solo_metodos(['POST', 'PUT']);
$u = exigir_usuario();
exigir_csrf();

function errores_nombre_categoria($v)
{
    $n = linea($v);
    if ($n === '') {
        return [['campo' => 'nombre', 'texto' => 'Escribe el nombre de la categoría.']];
    }
    if (largo($n) < 3) {
        return [['campo' => 'nombre', 'texto' => 'El nombre es demasiado corto.']];
    }
    if (largo($n) > 120) {
        return [['campo' => 'nombre', 'texto' => 'El nombre es demasiado largo (máximo 120 caracteres).']];
    }
    return [];
}

function responder_repetida()
{
    fallar_validacion([['campo' => 'nombre', 'texto' => 'Ya existe una categoría con ese nombre.']]);
}

if ($metodo === 'POST') {
    exigir_permiso($u, MODULO, 'registrar', 'Solo el administrador puede agregar categorías.');
    $d = leer_json();
    $e = errores_nombre_categoria(dato($d, 'nombre'));
    if ($e) {
        fallar_validacion($e);
    }
    $nombre = linea(dato($d, 'nombre'));
    $orden = entero(dato($d, 'orden'));
    if ($orden === null || $orden < 0 || $orden > 999) {
        $orden = 0;
    }
    try {
        bd()->prepare('INSERT INTO categorias_pastorales (nombre, activo, orden) VALUES (?, 1, ?)')->execute([$nombre, $orden]);
    } catch (PDOException $ex) {
        if (codigo_mysql($ex) === 1062) {
            responder_repetida();
        }
        throw $ex;
    }
    $id = (int)bd()->lastInsertId();
    auditar($u, 'crear', 'categorias', $id, $nombre);
    responder(201, ['id' => $id]);
}

exigir_permiso($u, MODULO, 'editar', 'Solo el administrador puede cambiar las categorías.');
$id = id_de_url();
$st = bd()->prepare('SELECT id FROM categorias_pastorales WHERE id = ?');
$st->execute([$id]);
if (!$st->fetch()) {
    fallar(404, 'no_existe', 'La categoría no existe.');
}
$d = leer_json();
$sets = [];
$params = [];
if (array_key_exists('nombre', $d)) {
    $e = errores_nombre_categoria($d['nombre']);
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
    bd()->prepare('UPDATE categorias_pastorales SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
} catch (PDOException $ex) {
    if (codigo_mysql($ex) === 1062) {
        responder_repetida();
    }
    throw $ex;
}
auditar($u, 'editar', 'categorias', $id, implode(', ', array_keys($d)));
responder(200, ['id' => $id]);

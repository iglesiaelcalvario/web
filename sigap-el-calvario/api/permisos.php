<?php
/* api/permisos.php  (módulo «usuarios-accesos», solo el administrador)
   PUT {rol, modulo, acciones:[...]}  → deja exactamente esas acciones para ese cargo en ese módulo.
   Solo se aceptan las acciones que aplican al módulo (tabla modulo_acciones).
   El administrador conserva lo necesario para administrar las cuentas (no se le puede quitar). */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'usuarios-accesos';
const NECESARIOS_ADMIN = ['consultar', 'registrar', 'editar'];

solo_metodos(['PUT']);
$u = exigir_usuario();
exigir_csrf();
exigir_permiso($u, MODULO, 'editar', 'Tu cargo no puede cambiar los permisos.');

$d = leer_json();
$rolClave = linea(dato($d, 'rol'));
$moduloClave = linea(dato($d, 'modulo'));
$pedidas = dato($d, 'acciones');
if (!is_array($pedidas)) {
    fallar_validacion([['campo' => 'acciones', 'texto' => 'Indica las acciones que tendrá el cargo.']]);
}
$acciones = array_values(array_unique(array_map('strval', $pedidas)));

$st = bd()->prepare('SELECT id FROM roles WHERE clave = ?');
$st->execute([$rolClave]);
$rolId = $st->fetchColumn();
if ($rolId === false) {
    fallar_validacion([['campo' => 'rol', 'texto' => 'El cargo no existe.']]);
}
$st = bd()->prepare('SELECT id FROM modulos WHERE clave = ?');
$st->execute([$moduloClave]);
$moduloId = $st->fetchColumn();
if ($moduloId === false) {
    fallar_validacion([['campo' => 'modulo', 'texto' => 'El módulo no existe.']]);
}

// Acciones que aplican a este módulo (clave → id)
$st = bd()->prepare('SELECT a.id, a.clave FROM modulo_acciones ma JOIN acciones a ON a.id = ma.accion_id WHERE ma.modulo_id = ?');
$st->execute([(int)$moduloId]);
$aplican = [];
foreach ($st->fetchAll() as $f) {
    $aplican[$f['clave']] = (int)$f['id'];
}
$e = [];
foreach ($acciones as $a) {
    if (!isset($aplican[$a])) {
        $e[] = ['campo' => 'acciones', 'texto' => "La acción «{$a}» no aplica a este módulo."];
    }
}
if ($rolClave === 'admin' && $moduloClave === MODULO) {
    $faltan = array_diff(NECESARIOS_ADMIN, $acciones);
    if ($faltan) {
        $e[] = ['campo' => 'acciones', 'texto' => 'Al administrador no se le pueden quitar Consultar, Registrar ni Editar en Usuarios y accesos: sin ellas no podría administrar las cuentas.'];
    }
}
if ($e) {
    fallar_validacion($e);
}

$pdo = bd();
$pdo->beginTransaction();
try {
    $pdo->prepare('DELETE FROM permisos WHERE rol_id = ? AND modulo_id = ?')->execute([(int)$rolId, (int)$moduloId]);
    $ins = $pdo->prepare('INSERT INTO permisos (rol_id, modulo_id, accion_id) VALUES (?, ?, ?)');
    foreach ($acciones as $a) {
        $ins->execute([(int)$rolId, (int)$moduloId, $aplican[$a]]);
    }
    $pdo->commit();
} catch (Throwable $ex) {
    $pdo->rollBack();
    throw $ex;
}
auditar($u, 'editar', 'permisos', null, "$rolClave · $moduloClave: " . ($acciones ? implode(', ', $acciones) : 'ninguna'));
responder(200, ['acciones' => $acciones]);

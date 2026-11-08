<?php
/* api/foto.php  —  GET ?id=  devuelve la foto de una persona (módulo «registrar-personas», consultar) */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

solo_metodos(['GET']);
$u = exigir_usuario();
if (!tiene_permiso($u, 'registrar-personas', 'consultar') && !tiene_permiso($u, 'ficha-persona', 'consultar')) {
    fallar(403, 'permiso', 'No tienes acceso a las fotos de las personas.');
}
$id = entero($_GET['id'] ?? null);
if ($id === null || $id <= 0) {
    fallar(404, 'no_existe', 'La persona no existe.');
}
$st = bd()->prepare('SELECT foto, foto_tipo FROM personas WHERE id = ?');
$st->execute([$id]);
$f = $st->fetch(PDO::FETCH_ASSOC);
if (!$f || $f['foto'] === null) {
    fallar(404, 'no_existe', 'La persona no tiene foto.');
}
header('Content-Type: ' . $f['foto_tipo']);
header('Cache-Control: private, max-age=300');
header('X-Content-Type-Options: nosniff');
echo $f['foto'];

<?php
/* GET api/sesion.php  →  ¿hay sesión iniciada? También avisa si la base de datos no está lista. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';

solo_metodos(['GET']);
$diag = diagnosticar_bd();
if (!$diag['ok']) {
    fallar(503, 'bd', $diag['mensaje']);
}
$u = usuario_actual();
if (!$u) {
    responder(200, ['autenticado' => false]);
}
responder(200, ['autenticado' => true, 'usuario' => usuario_publico($u), 'csrf' => $_SESSION['csrf']]);

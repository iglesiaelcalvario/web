<?php
/* POST api/logout.php  →  cierra la sesión */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';

solo_metodos(['POST']);
destruir_sesion();
responder(200, ['ok' => true]);

<?php
/* GET api/datos.php  →  todos los datos que el cargo del usuario puede ver, más la matriz de permisos */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';
require __DIR__ . '/lib/modelo.php';

solo_metodos(['GET']);
$u = exigir_usuario();
responder(200, cargar_datos($u));

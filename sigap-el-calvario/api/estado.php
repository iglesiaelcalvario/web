<?php
/* GET api/estado.php  →  revisión rápida: ¿funciona PHP y se conecta a MySQL? Ábrelo en el navegador si algo falla. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';

solo_metodos(['GET']);
$diag = diagnosticar_bd();
responder($diag['ok'] ? 200 : 503, ['servidor' => 'ok', 'baseDeDatos' => $diag['ok'] ? 'ok' : $diag['mensaje']]);

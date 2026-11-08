<?php
/* GET api/panel.php → datos del panel de Inicio para el cargo de quien consulta: tarjetas, gráficos y tablas
   de los campos que puede consultar. Los grupos y los cumpleaños se limitan a los de quien discipula cuando corresponde.
   No cambia nada en la base de datos. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';
require __DIR__ . '/lib/reporte.php';
require __DIR__ . '/lib/cumple.php';
require __DIR__ . '/lib/panel.php';

solo_metodos(['GET']);
$u = exigir_usuario();
responder(200, panel_datos($u));

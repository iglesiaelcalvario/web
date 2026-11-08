<?php
/* GET api/cumpleanos.php?mes=1..12&anio=AAAA   →  cumpleaños del mes
   GET api/cumpleanos.php?proximos=N            →  cumpleaños de los próximos N días (1 a 366)
   Solo se envían nombres, fecha y la edad que se cumple: nunca teléfono ni correo. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';
require __DIR__ . '/lib/cumple.php';   // la misma regla de fechas y edades que el panel por rol

solo_metodos(['GET']);
$u = exigir_usuario();
exigir_permiso($u, 'cumpleanos', 'consultar', 'Tu cargo no puede consultar los cumpleaños.');
// La lista completa (un mes, o más de 7 días) es para el administrador, el pastor y la discipuladora.
// El asistente solo ve los cumpleaños de los próximos 7 días, que también muestra su Inicio.
$completa = in_array($u['rol'], ['admin', 'pastor', 'discipulador'], true);
$sinAlcance = 'Tu cargo solo puede ver los cumpleaños de los próximos 7 días.';

$personas = bd()->query('SELECT id, nombres, apellidos, nacimiento FROM personas')->fetchAll();
$hoyD = hoy();

if (isset($_GET['proximos'])) {
    $n = entero($_GET['proximos']);
    if ($n === null || $n < 1 || $n > 366) {
        fallar_validacion([['campo' => 'proximos', 'texto' => 'Elige entre 1 y 366 días.']]);
    }
    if (!$completa && $n > 7) {
        fallar(403, 'sin_alcance', $sinAlcance);
    }
    $hasta = (new DateTime($hoyD))->modify("+$n days")->format('Y-m-d');
    $anio = (int)substr($hoyD, 0, 4);
    $lista = [];
    foreach ($personas as $p) {
        $f = fecha_en_anio($p['nacimiento'], $anio);
        if ($f < $hoyD) {
            $f = fecha_en_anio($p['nacimiento'], $anio + 1);
        }
        if ($f <= $hasta) {
            $lista[] = persona_cumple($p, $f);
        }
    }
    ordenar_cumples($lista);
    responder(200, ['desde' => $hoyD, 'hasta' => $hasta, 'personas' => $lista]);
}

if (!$completa) {
    fallar(403, 'sin_alcance', $sinAlcance);
}
$mes = entero(isset($_GET['mes']) ? $_GET['mes'] : (int)substr($hoyD, 5, 2));
if ($mes === null || $mes < 1 || $mes > 12) {
    fallar_validacion([['campo' => 'mes', 'texto' => 'El mes debe estar entre 1 y 12.']]);
}
$anio = entero(isset($_GET['anio']) ? $_GET['anio'] : (int)substr($hoyD, 0, 4));
if ($anio === null || $anio < 1900 || $anio > 2100) {
    fallar_validacion([['campo' => 'anio', 'texto' => 'El año no es válido.']]);
}
$lista = [];
foreach ($personas as $p) {
    $f = fecha_en_anio($p['nacimiento'], $anio);
    if ((int)substr($f, 5, 2) === $mes) {
        $lista[] = persona_cumple($p, $f);
    }
}
ordenar_cumples($lista);
responder(200, ['mes' => $mes, 'anio' => $anio, 'personas' => $lista]);

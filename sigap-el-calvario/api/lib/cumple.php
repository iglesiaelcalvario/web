<?php
/* SIGAP · Cumpleaños: fecha de cumpleaños, edad que se cumple y orden.
   La misma regla la usan el módulo de Cumpleaños y el panel por rol. */
defined('SIGAP') or exit;

// Fecha de cumpleaños en un año concreto. El 29 de febrero cae el 28 en los años que no son bisiestos.
function fecha_en_anio($nacimiento, $anio)
{
    $m = (int)substr($nacimiento, 5, 2);
    $d = (int)substr($nacimiento, 8, 2);
    if ($m === 2 && $d === 29 && !checkdate(2, 29, (int)$anio)) {
        $d = 28;
    }
    return sprintf('%04d-%02d-%02d', (int)$anio, $m, $d);
}

function persona_cumple(array $p, $fecha)
{
    return ['personaId' => (int)$p['id'], 'nombres' => $p['nombres'], 'apellidos' => $p['apellidos'],
            'fecha' => $fecha, 'dia' => (int)substr($fecha, 8, 2),
            'cumple' => (int)substr($fecha, 0, 4) - (int)substr($p['nacimiento'], 0, 4)];
}

function ordenar_cumples(array &$lista)
{
    usort($lista, function ($a, $b) {
        return [$a['fecha'], $a['apellidos'], $a['nombres']] <=> [$b['fecha'], $b['apellidos'], $b['nombres']];
    });
}

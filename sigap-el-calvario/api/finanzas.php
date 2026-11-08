<?php
/* api/finanzas.php  —  POST crear · PUT ?id= editar · DELETE ?id= eliminar   (módulo «finanzas») */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'finanzas';
const TIPOS = ['Ofrenda', 'Diezmo', 'Primicia', 'Siembra'];

$metodo = solo_metodos(['POST', 'PUT', 'DELETE']);
$u = exigir_usuario();
exigir_csrf();

function validar_finanza(array $d)
{
    $e = [];
    $tipo = linea(dato($d, 'tipo'));
    $fecha = linea(dato($d, 'fecha'));
    $valor = entero(dato($d, 'valor'));
    $persona = linea(dato($d, 'persona'));
    $motivo = linea(dato($d, 'motivo'));
    $observaciones = bloque(dato($d, 'observaciones'));
    $pideMotivo = ($tipo === 'Primicia' || $tipo === 'Siembra');

    if (!in_array($tipo, TIPOS, true)) {
        $e[] = ['campo' => 'tipo', 'texto' => 'Elige el tipo.'];
    }
    if ($fecha === '') {
        $e[] = ['campo' => 'fecha', 'texto' => 'Elige la fecha.'];
    } elseif (!es_fecha($fecha)) {
        $e[] = ['campo' => 'fecha', 'texto' => 'La fecha no es válida.'];
    } elseif ($fecha > hoy()) {
        $e[] = ['campo' => 'fecha', 'texto' => 'La fecha no puede ser futura.'];
    }
    if ($valor === null || $valor <= 0 || $valor > 999999999999) {
        $e[] = ['campo' => 'valor', 'texto' => 'Escribe un valor entero mayor que 0 (en pesos).'];
    }
    if (largo($persona) > 120) {
        $e[] = ['campo' => 'persona', 'texto' => 'El nombre es demasiado largo (máximo 120 caracteres).'];
    }
    if ($pideMotivo && $motivo === '') {
        $e[] = ['campo' => 'motivo', 'texto' => 'Escribe el motivo, propósito o razón: es obligatorio para ' . ($tipo === 'Primicia' ? 'primicias' : 'siembras') . '.'];
    } elseif (largo($motivo) > 255) {
        $e[] = ['campo' => 'motivo', 'texto' => 'El motivo es demasiado largo (máximo 255 caracteres).'];
    }
    if (largo($observaciones) > 2000) {
        $e[] = ['campo' => 'observaciones', 'texto' => 'Las observaciones son demasiado largas (máximo 2000 caracteres).'];
    }
    if ($e) {
        fallar_validacion($e);
    }
    return [$tipo, $fecha, $valor, $persona, $pideMotivo ? $motivo : '', $observaciones];
}

if ($metodo === 'POST') {
    exigir_permiso($u, MODULO, 'registrar', 'Tu cargo no puede registrar movimientos financieros.');
    $c = validar_finanza(leer_json());
    bd()->prepare('INSERT INTO finanzas (tipo, fecha, valor, persona, motivo, observaciones, registrado_por, registrado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute(array_merge($c, [$u['id'], hoy()]));
    responder(201, ['id' => (int)bd()->lastInsertId()]);
}

if ($metodo === 'PUT') {
    exigir_permiso($u, MODULO, 'editar', 'Tu cargo no puede editar movimientos financieros.');
} else {
    exigir_permiso($u, MODULO, 'eliminar', 'Tu cargo no puede eliminar movimientos financieros.');
}
$id = id_de_url();
$st = bd()->prepare('SELECT id FROM finanzas WHERE id = ?');
$st->execute([$id]);
if (!$st->fetch()) {
    fallar(404, 'no_existe', 'El registro no existe.');
}
if ($metodo === 'PUT') {
    $c = validar_finanza(leer_json());
    bd()->prepare('UPDATE finanzas SET tipo = ?, fecha = ?, valor = ?, persona = ?, motivo = ?, observaciones = ? WHERE id = ?')->execute(array_merge($c, [$id]));
    responder(200, ['id' => $id]);
}
bd()->prepare('DELETE FROM finanzas WHERE id = ?')->execute([$id]);
responder(200, ['ok' => true]);

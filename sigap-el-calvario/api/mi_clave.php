<?php
/* api/mi_clave.php  (cualquier cuenta que haya iniciado sesión)
   POST {claveActual, claveNueva}  → cambia la clave de la propia cuenta.
   Las demás sesiones de la cuenta se cierran; la sesión desde la que se cambió sigue abierta. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

solo_metodos(['POST']);
$u = exigir_usuario();
exigir_csrf();

$d = leer_json();
$actual = isset($d['claveActual']) && is_string($d['claveActual']) ? $d['claveActual'] : '';
$nueva = isset($d['claveNueva']) && is_string($d['claveNueva']) ? $d['claveNueva'] : '';

$st = bd()->prepare('SELECT usuario, clave_hash FROM usuarios WHERE id = ?');
$st->execute([(int)$u['id']]);
$cuenta = $st->fetch();
$e = [];
$actualCorrecta = $actual !== '' && password_verify($actual, $cuenta['clave_hash']);
if (!$actualCorrecta) {
    $e[] = ['campo' => 'claveActual', 'texto' => 'La clave actual no es correcta.'];
}
if ($nueva === '') {
    $e[] = ['campo' => 'claveNueva', 'texto' => 'Escribe tu nueva clave.'];
} elseif (mb_strlen($nueva, 'UTF-8') < 8) {
    $e[] = ['campo' => 'claveNueva', 'texto' => 'La nueva clave debe tener al menos 8 caracteres.'];
} elseif (mb_strlen($nueva, 'UTF-8') > 200) {
    $e[] = ['campo' => 'claveNueva', 'texto' => 'La nueva clave es demasiado larga (máximo 200 caracteres).'];
} elseif (mb_strtolower($nueva, 'UTF-8') === mb_strtolower($cuenta['usuario'], 'UTF-8')) {
    $e[] = ['campo' => 'claveNueva', 'texto' => 'La nueva clave no puede ser igual a tu usuario.'];
} elseif (password_verify($nueva, $cuenta['clave_hash'])) {
    $e[] = ['campo' => 'claveNueva', 'texto' => 'La nueva clave debe ser distinta de la actual.'];
}
if ($e) {
    fallar_validacion($e);
}

bd()->prepare('UPDATE usuarios SET clave_hash = ?, sesion_version = sesion_version + 1 WHERE id = ?')
    ->execute([password_hash($nueva, PASSWORD_DEFAULT), (int)$u['id']]);
$st = bd()->prepare('SELECT sesion_version FROM usuarios WHERE id = ?');
$st->execute([(int)$u['id']]);
$_SESSION['version'] = (int)$st->fetchColumn();   // esta sesión sigue válida; las demás quedan cerradas
auditar($u, 'editar', 'usuarios', (int)$u['id'], 'cambió su clave (se cerraron sus otras sesiones)');
responder(200, ['ok' => true]);

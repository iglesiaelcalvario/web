<?php
/* POST api/login.php  { usuario, clave }  →  inicia la sesión y entrega el token CSRF */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

solo_metodos(['POST']);
$d = leer_json();
$usuario = mb_substr(linea(dato($d, 'usuario')), 0, 30, 'UTF-8');
$clave = (isset($d['clave']) && is_string($d['clave'])) ? $d['clave'] : '';
if ($usuario === '' || $clave === '') {
    fallar_validacion([['campo' => 'usuario', 'texto' => 'Escribe tu usuario y tu contraseña.']]);
}
if (strlen($clave) > 200) {
    fallar(401, 'credenciales', MSG_CREDENCIALES);
}

$cfg = configuracion();
$ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';
$pdo = bd();

// Bloqueo por intentos fallidos seguidos (mismo usuario desde la misma dirección)
$pdo->exec('DELETE FROM intentos_login WHERE creado < (NOW() - INTERVAL 1 DAY)');
$st = $pdo->prepare('SELECT COUNT(*) FROM intentos_login WHERE usuario = ? AND ip = ? AND creado > (NOW() - INTERVAL ' . (int)$cfg['minutos_bloqueo'] . ' MINUTE)');
$st->execute([$usuario, $ip]);
if ((int)$st->fetchColumn() >= (int)$cfg['max_intentos_login']) {
    fallar(429, 'bloqueado', 'Demasiados intentos fallidos. Espera ' . (int)$cfg['minutos_bloqueo'] . ' minutos e inténtalo de nuevo.');
}

$st = $pdo->prepare('SELECT u.id, u.usuario, u.nombres, u.apellidos, u.clave_hash, u.activo, u.sesion_version, r.clave AS rol
                     FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.usuario = ?');
$st->execute([$usuario]);
$fila = $st->fetch();
$correcta = password_verify($clave, $fila ? $fila['clave_hash'] : HASH_FALSO);   // se verifica siempre, exista o no el usuario
if (!$fila || !$correcta) {
    usleep(250000);
    $pdo->prepare('INSERT INTO intentos_login (usuario, ip) VALUES (?, ?)')->execute([$usuario, $ip]);
    fallar(401, 'credenciales', MSG_CREDENCIALES);
}
if (!(int)$fila['activo']) {
    fallar(403, 'inactivo', 'Tu usuario está inactivo. Comunícate con un administrador de la iglesia.');
}

iniciar_sesion();
session_regenerate_id(true);               // nuevo identificador de sesión al ingresar (evita fijación de sesión)
$_SESSION = [];
$_SESSION['uid'] = (int)$fila['id'];
$_SESSION['version'] = (int)$fila['sesion_version'];
$_SESSION['csrf'] = bin2hex(random_bytes(32));
$_SESSION['ultima'] = time();

$pdo->prepare('DELETE FROM intentos_login WHERE usuario = ? AND ip = ?')->execute([$usuario, $ip]);
$pdo->prepare('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?')->execute([(int)$fila['id']]);
if (password_needs_rehash($fila['clave_hash'], PASSWORD_DEFAULT)) {
    $pdo->prepare('UPDATE usuarios SET clave_hash = ? WHERE id = ?')->execute([password_hash($clave, PASSWORD_DEFAULT), (int)$fila['id']]);
}
// (no se usa usuario_actual() aquí: en este primer ingreso el navegador todavía no trae la cookie de sesión)
responder(200, ['usuario' => usuario_publico($fila), 'csrf' => $_SESSION['csrf']]);

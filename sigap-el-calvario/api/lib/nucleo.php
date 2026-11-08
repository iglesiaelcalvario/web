<?php
/* SIGAP · Núcleo de la API
   Conexión a MySQL, sesión, respuestas JSON, protección CSRF y control de permisos.
   Este archivo no se abre desde el navegador: lo cargan los archivos de api/. */
defined('SIGAP') or exit;

ini_set('display_errors', '0');   // los errores van al registro de PHP, no a la respuesta (romperían el JSON)
error_reporting(E_ALL);

const TABLAS_REQUERIDAS = ['roles', 'modulos', 'acciones', 'permisos', 'usuarios', 'personas', 'asistencias',
                           'funciones', 'persona_funciones', 'procesos', 'cursos', 'niveles', 'temas', 'curso_participantes',
                           'sesiones_adiestramiento', 'sesion_asistencia', 'grupos', 'grupo_participantes', 'reuniones',
                           'reunion_asistencia', 'reunion_visitantes', 'categorias_pastorales', 'casos_pastorales', 'actuaciones_pastorales', 'finanzas', 'intentos_login', 'auditoria',
                           'nacidos_de_nuevo', 'bautismos'];
const MSG_CREDENCIALES = 'Usuario o contraseña incorrectos. Revisa los datos e inténtalo de nuevo.';
// Hash de relleno: sirve para que el tiempo de respuesta sea igual cuando el usuario no existe (evita adivinar usuarios)
const HASH_FALSO = '$2y$10$CG82.8hLyG/sBS/VdkLtzeB1do3d9vMSSh0M89kYM9djOrCzSgTXa';

function configuracion()
{
    static $c = null;
    if ($c === null) {
        $c = require __DIR__ . '/config.php';
    }
    return $c;
}
// La zona horaria se fija ANTES de cualquier fecha: si no, PHP usa UTC y «hoy» cambia a medianoche de Colombia
date_default_timezone_set(configuracion()['zona_horaria']);
mb_internal_encoding('UTF-8');

/* ---------------------------------------------------------------------
   Respuestas JSON
   --------------------------------------------------------------------- */
function responder($codigo, $datos)
{
    http_response_code($codigo);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function fallar($codigo, $error, $mensaje, array $extra = [])
{
    responder($codigo, array_merge(['error' => $error, 'mensaje' => $mensaje], $extra));
}
// $errores: lista de ['campo' => nombre del campo, 'texto' => mensaje para la persona]
function fallar_validacion(array $errores)
{
    responder(422, ['error' => 'validacion', 'mensaje' => $errores[0]['texto'], 'errores' => $errores]);
}
function solo_metodos(array $permitidos)
{
    $m = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
    if (!in_array($m, $permitidos, true)) {
        header('Allow: ' . implode(', ', $permitidos));
        fallar(405, 'metodo', 'Método no permitido.');
    }
    return $m;
}
set_exception_handler(function ($e) {
    error_log('[SIGAP] ' . get_class($e) . ': ' . $e->getMessage() . ' en ' . $e->getFile() . ':' . $e->getLine());
    $dep = !empty(configuracion()['depurar']);
    fallar(500, 'servidor', $dep ? $e->getMessage() : 'Ocurrió un error en el servidor. Inténtalo de nuevo.');
});

/* ---------------------------------------------------------------------
   Base de datos
   --------------------------------------------------------------------- */
function bd()
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    $b = configuracion()['bd'];
    $dsn = 'mysql:host=' . $b['host'] . ';port=' . (int)$b['puerto'] . ';dbname=' . $b['nombre'] . ';charset=' . $b['charset'];
    $pdo = new PDO($dsn, $b['usuario'], $b['clave'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    // Modo estricto: si un dato no cabe o es inválido, MySQL da error en vez de recortarlo o cambiarlo en silencio
    $pdo->exec("SET sql_mode='STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
    $pdo->exec("SET time_zone = '-05:00'"); // hora de Colombia (sin horario de verano): CURDATE() y NOW() coinciden con PHP
    return $pdo;
}
function codigo_mysql(PDOException $e)
{
    if (isset($e->errorInfo[1])) {
        return (int)$e->errorInfo[1];
    }
    if (is_numeric($e->getCode())) {
        return (int)$e->getCode();
    }
    return preg_match('/\[(\d{4})\]/', $e->getMessage(), $m) ? (int)$m[1] : 0;
}
// Dice, en lenguaje de persona, qué le pasa a la base de datos (se usa en estado.php y al abrir la página)
function diagnosticar_bd()
{
    $nombre = configuracion()['bd']['nombre'];
    try {
        $existentes = array_map('strtolower', bd()->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN));
        $faltan = array_values(array_diff(TABLAS_REQUERIDAS, $existentes));
        if ($faltan) {
            return ['ok' => false, 'mensaje' => 'A la base de datos «' . $nombre . '» le faltan tablas (' . implode(', ', $faltan) . '). Si tiene datos de la versión 4, importa database/migracion_v4_a_v5.sql (una sola vez). Si es una instalación nueva, importa database/sigap.sql. Ambos se importan con phpMyAdmin.'];
        }
        return ['ok' => true, 'mensaje' => ''];
    } catch (PDOException $e) {
        error_log('[SIGAP] diagnóstico de la base de datos: ' . $e->getMessage());
        $codigo = codigo_mysql($e);
        switch ($codigo) {
            case 1049:
                $m = 'No existe la base de datos «' . $nombre . '». Impórtala con phpMyAdmin usando el archivo database/sigap.sql.';
                break;
            case 1045:
                $m = 'MySQL rechazó el usuario o la contraseña. Revísalos en api/lib/config.php.';
                break;
            case 2002:
            case 2003:
                $m = 'No se pudo conectar con MySQL. Enciéndelo en el panel de XAMPP (botón Start de MySQL).';
                break;
            default:
                $m = 'No se pudo usar la base de datos (código ' . $codigo . ').';
        }
        return ['ok' => false, 'mensaje' => $m];
    }
}

/* ---------------------------------------------------------------------
   Sesión de usuario
   --------------------------------------------------------------------- */
function ruta_cookie()
{
    $dir = str_replace('\\', '/', dirname(dirname(isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '/api/x.php')));
    return rtrim($dir, '/') . '/';   // la cookie solo viaja a la carpeta del sistema, no a otros proyectos de localhost
}
function iniciar_sesion()
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name(configuracion()['sesion_nombre']);
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => ruta_cookie(),
        'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,           // JavaScript no puede leer la cookie
        'samesite' => 'Lax',          // no se envía desde otros sitios
    ]);
    session_start();
}
function destruir_sesion()
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        if (empty($_COOKIE[configuracion()['sesion_nombre']])) {
            return;
        }
        iniciar_sesion();
    }
    $_SESSION = [];
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    session_destroy();
}
// Devuelve el usuario con sesión iniciada (leído de la base en cada petición: si lo desactivan, pierde el acceso al instante)
function usuario_actual()
{
    static $cache = false;
    if ($cache !== false) {
        return $cache;
    }
    $cache = null;
    if (empty($_COOKIE[configuracion()['sesion_nombre']])) {
        return null;   // visitante sin cookie: ni siquiera se crea una sesión
    }
    iniciar_sesion();
    if (empty($_SESSION['uid'])) {
        return null;
    }
    $limite = (int)configuracion()['inactividad_minutos'] * 60;
    if (isset($_SESSION['ultima']) && time() - (int)$_SESSION['ultima'] > $limite) {
        destruir_sesion();
        return null;
    }
    $st = bd()->prepare('SELECT u.id, u.usuario, u.nombres, u.apellidos, u.activo, u.persona_id, u.sesion_version, r.id AS rol_id, r.clave AS rol
                         FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ?');
    $st->execute([(int)$_SESSION['uid']]);
    $f = $st->fetch();
    if (!$f || !(int)$f['activo']) {
        destruir_sesion();
        return null;
    }
    // Si la clave cambió (o se restableció) después de abrir esta sesión, la sesión queda cerrada.
    // Las sesiones anteriores a esta versión no tienen el dato: se toman como versión 1.
    $versionSesion = isset($_SESSION['version']) ? (int)$_SESSION['version'] : 1;
    if ($versionSesion !== (int)$f['sesion_version']) {
        destruir_sesion();
        return null;
    }
    $_SESSION['ultima'] = time();
    $cache = ['id' => (int)$f['id'], 'usuario' => $f['usuario'], 'nombres' => $f['nombres'], 'apellidos' => $f['apellidos'],
              'rol' => $f['rol'], 'rol_id' => (int)$f['rol_id'], 'persona_id' => $f['persona_id'] === null ? null : (int)$f['persona_id']];
    return $cache;
}
function usuario_publico(array $u)
{
    return ['usuario' => $u['usuario'], 'nombres' => $u['nombres'], 'apellidos' => $u['apellidos'], 'rol' => $u['rol']];
}
function exigir_usuario()
{
    $u = usuario_actual();
    if (!$u) {
        fallar(401, 'sin_sesion', 'Tu sesión terminó o no has iniciado sesión.');
    }
    return $u;
}
// Protección CSRF: toda petición que modifica datos debe traer el token que se entregó al iniciar sesión
function exigir_csrf()
{
    $enviado = isset($_SERVER['HTTP_X_CSRF_TOKEN']) ? $_SERVER['HTTP_X_CSRF_TOKEN'] : '';
    $esperado = isset($_SESSION['csrf']) ? $_SESSION['csrf'] : '';
    if ($esperado === '' || !is_string($enviado) || !hash_equals($esperado, $enviado)) {
        fallar(403, 'csrf', 'La solicitud no es válida. Recarga la página e inténtalo de nuevo.');
    }
}

/* ---------------------------------------------------------------------
   Permisos: Rol → Módulo → Acciones (tabla «permisos» de la base de datos)
   --------------------------------------------------------------------- */
function matriz_permisos()
{
    static $m = null;
    if ($m !== null) {
        return $m;
    }
    $m = [];
    $filas = bd()->query('SELECT r.clave AS rol, m.clave AS modulo, a.clave AS accion
                          FROM permisos p
                          JOIN roles r ON r.id = p.rol_id JOIN modulos m ON m.id = p.modulo_id JOIN acciones a ON a.id = p.accion_id
                          ORDER BY m.id, r.id, a.id')->fetchAll();
    foreach ($filas as $f) {
        $m[$f['modulo']][$f['rol']][] = $f['accion'];
    }
    return $m;
}
function acciones_de(array $u, $modulo)
{
    $m = matriz_permisos();
    return isset($m[$modulo][$u['rol']]) ? $m[$modulo][$u['rol']] : [];
}
function tiene_permiso(array $u, $modulo, $accion)
{
    return in_array($accion, acciones_de($u, $modulo), true);
}
function exigir_permiso(array $u, $modulo, $accion, $mensaje = '')
{
    if (!tiene_permiso($u, $modulo, $accion)) {
        fallar(403, 'prohibido', $mensaje !== '' ? $mensaje : 'Tu cargo no tiene permiso para hacer esto.');
    }
}

/* Registro de acciones importantes (auditoría). No detiene la operación si falla. */
function auditar(array $u, $accion, $entidad, $registroId, $detalle = '')
{
    try {
        bd()->prepare('INSERT INTO auditoria (usuario_id, accion, entidad, registro_id, detalle) VALUES (?, ?, ?, ?, ?)')
            ->execute([(int)$u['id'], $accion, $entidad, $registroId === null ? null : (int)$registroId, mb_substr((string)$detalle, 0, 250, 'UTF-8')]);
    } catch (PDOException $e) {
        error_log('[SIGAP] auditoría: ' . $e->getMessage());
    }
}

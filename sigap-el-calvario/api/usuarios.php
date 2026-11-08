<?php
/* api/usuarios.php  (módulo «usuarios-accesos», solo el administrador)
   POST          {personaId, usuario, rol, clave}           → crea la cuenta de una persona registrada (permiso «registrar»)
   PUT  ?id=     {usuario?, rol?, activo?, clave?}          → corrige la cuenta (permiso «editar»)
   Las cuentas no se borran: se desactivan, para conservar el historial de casos, reuniones y auditoría.
   Nadie cambia su propio cargo, se desactiva ni restablece su propia clave desde aquí: para eso está «Cambiar mi clave». */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'usuarios-accesos';
const PATRON_USUARIO = '/^[a-z0-9][a-z0-9._-]{2,29}$/';

$metodo = solo_metodos(['POST', 'PUT']);
$u = exigir_usuario();
exigir_csrf();

function cuenta_usuario_normalizado($v)
{
    return mb_strtolower(trim((string)$v), 'UTF-8');
}

function cuenta_rol_id($clave)
{
    $st = bd()->prepare('SELECT id FROM roles WHERE clave = ?');
    $st->execute([(string)$clave]);
    $id = $st->fetchColumn();
    return $id === false ? null : (int)$id;
}

function cuenta_usuario_ocupado($usuario, $excepto = 0)
{
    $st = bd()->prepare('SELECT COUNT(*) FROM usuarios WHERE usuario = ? AND id <> ?');
    $st->execute([$usuario, (int)$excepto]);
    return (int)$st->fetchColumn() > 0;
}

function cuenta_errores_clave($c)
{
    if (!is_string($c) || $c === '') {
        return [['campo' => 'clave', 'texto' => 'Escribe una clave.']];
    }
    if (mb_strlen($c, 'UTF-8') < 8) {
        return [['campo' => 'clave', 'texto' => 'La clave debe tener al menos 8 caracteres.']];
    }
    if (mb_strlen($c, 'UTF-8') > 200) {
        return [['campo' => 'clave', 'texto' => 'La clave es demasiado larga (máximo 200 caracteres).']];
    }
    return [];
}

function cuenta_errores_usuario($usuario)
{
    if ($usuario === '') {
        return [['campo' => 'usuario', 'texto' => 'Escribe el nombre de usuario.']];
    }
    if (!preg_match(PATRON_USUARIO, $usuario)) {
        return [['campo' => 'usuario', 'texto' => 'Usa entre 3 y 30 letras minúsculas, números, puntos, guiones o guiones bajos.']];
    }
    return [];
}

if ($metodo === 'POST') {
    /* ---------- Crear la cuenta de una persona registrada ---------- */
    exigir_permiso($u, MODULO, 'registrar', 'Tu cargo no puede crear cuentas de acceso.');
    $d = leer_json();
    $e = [];
    $personaId = entero(dato($d, 'personaId'));
    $usuario = cuenta_usuario_normalizado(dato($d, 'usuario'));
    $rolClave = linea(dato($d, 'rol'));
    $clave = isset($d['clave']) ? $d['clave'] : '';
    $persona = null;
    if ($personaId === null || $personaId <= 0) {
        $e[] = ['campo' => 'personaId', 'texto' => 'Elige la persona a la que pertenece la cuenta.'];
    } else {
        $st = bd()->prepare('SELECT nombres, apellidos FROM personas WHERE id = ?');
        $st->execute([$personaId]);
        $persona = $st->fetch();
        if (!$persona) {
            $e[] = ['campo' => 'personaId', 'texto' => 'La persona elegida no existe.'];
        }
    }
    $e = array_merge($e, cuenta_errores_usuario($usuario));
    $rolId = $rolClave !== '' ? cuenta_rol_id($rolClave) : null;
    if ($rolId === null) {
        $e[] = ['campo' => 'rol', 'texto' => 'Elige el cargo de la cuenta.'];
    }
    $e = array_merge($e, cuenta_errores_clave($clave));
    if (!$e) {
        $st = bd()->prepare('SELECT COUNT(*) FROM usuarios WHERE persona_id = ?');
        $st->execute([$personaId]);
        if ((int)$st->fetchColumn() > 0) {
            $e[] = ['campo' => 'personaId', 'texto' => 'Esta persona ya tiene una cuenta de acceso.'];
        }
        if (cuenta_usuario_ocupado($usuario)) {
            $e[] = ['campo' => 'usuario', 'texto' => 'Ese nombre de usuario ya existe. Elige otro.'];
        }
    }
    if ($e) {
        fallar_validacion($e);
    }
    try {
        bd()->prepare('INSERT INTO usuarios (usuario, clave_hash, nombres, apellidos, rol_id, persona_id, activo)
                       VALUES (?, ?, ?, ?, ?, ?, 1)')
            ->execute([$usuario, password_hash($clave, PASSWORD_DEFAULT), $persona['nombres'], $persona['apellidos'], $rolId, $personaId]);
    } catch (PDOException $ex) {
        if (codigo_mysql($ex) === 1062) {
            fallar_validacion([['campo' => 'usuario', 'texto' => 'Ese nombre de usuario ya existe. Elige otro.']]);
        }
        throw $ex;
    }
    $id = (int)bd()->lastInsertId();
    auditar($u, 'crear', 'usuarios', $id, "usuario $usuario · cargo $rolClave · persona $personaId");
    responder(201, ['id' => $id]);
}

/* ---------- Corregir la cuenta (usuario, cargo, estado o clave) ---------- */
exigir_permiso($u, MODULO, 'editar', 'Tu cargo no puede corregir cuentas de acceso.');
$id = id_de_url();
$st = bd()->prepare('SELECT u.id, u.usuario, u.activo, u.rol_id, r.clave AS rol
                     FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ?');
$st->execute([$id]);
$actual = $st->fetch();
if (!$actual) {
    fallar(404, 'no_existe', 'La cuenta no existe.');
}
$d = leer_json();
$tieneUsuario = array_key_exists('usuario', $d);
$tieneRol = array_key_exists('rol', $d);
$tieneActivo = array_key_exists('activo', $d);
$tieneClave = array_key_exists('clave', $d);
if (!$tieneUsuario && !$tieneRol && !$tieneActivo && !$tieneClave) {
    fallar_validacion([['campo' => 'usuario', 'texto' => 'No hay cambios que guardar.']]);
}
$yo = (int)$u['id'] === $id;
$e = [];
$usuario = $tieneUsuario ? cuenta_usuario_normalizado($d['usuario']) : null;
$rolClave = $tieneRol ? linea($d['rol']) : null;
$rolId = null;
if ($tieneUsuario) {
    $e = array_merge($e, cuenta_errores_usuario($usuario));
    if (!$e && cuenta_usuario_ocupado($usuario, $id)) {
        $e[] = ['campo' => 'usuario', 'texto' => 'Ese nombre de usuario ya existe. Elige otro.'];
    }
}
if ($tieneRol) {
    $rolId = cuenta_rol_id($rolClave);
    if ($rolId === null) {
        $e[] = ['campo' => 'rol', 'texto' => 'El cargo no existe.'];
    }
}
if ($tieneActivo && !is_bool($d['activo'])) {
    $e[] = ['campo' => 'activo', 'texto' => 'El estado no es válido.'];
}
if ($tieneClave) {
    $e = array_merge($e, cuenta_errores_clave($d['clave']));
}
if ($yo) {
    if (($tieneRol && $rolClave !== $actual['rol']) || ($tieneActivo && $d['activo'] === false)) {
        $e[] = ['campo' => 'rol', 'texto' => 'No puedes cambiar tu propio cargo ni desactivar tu cuenta. Pídelo a otro administrador.'];
    }
    if ($tieneClave) {
        $e[] = ['campo' => 'clave', 'texto' => 'Para tu propia clave usa «Cambiar mi clave».'];
    }
}
if ($e) {
    fallar_validacion($e);
}

$sets = [];
$params = [];
$detalle = [];
if ($tieneUsuario && $usuario !== $actual['usuario']) {
    $sets[] = 'usuario = ?';
    $params[] = $usuario;
    $detalle[] = "usuario: {$actual['usuario']} → $usuario";
}
if ($tieneRol && $rolClave !== $actual['rol']) {
    $sets[] = 'rol_id = ?';
    $params[] = $rolId;
    $detalle[] = "cargo: {$actual['rol']} → $rolClave";
}
if ($tieneActivo && (bool)(int)$actual['activo'] !== $d['activo']) {
    $sets[] = 'activo = ?';
    $params[] = $d['activo'] ? 1 : 0;
    $detalle[] = $d['activo'] ? 'estado: activa' : 'estado: inactiva';
}
if ($tieneClave) {
    // Sube la versión de la sesión: las sesiones abiertas con la clave anterior dejan de valer
    $sets[] = 'clave_hash = ?';
    $params[] = password_hash($d['clave'], PASSWORD_DEFAULT);
    $sets[] = 'sesion_version = sesion_version + 1';
    $detalle[] = 'clave restablecida (se cerraron sus sesiones abiertas)';
}
if ($sets) {
    $params[] = $id;
    try {
        bd()->prepare('UPDATE usuarios SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
    } catch (PDOException $ex) {
        if (codigo_mysql($ex) === 1062) {
            fallar_validacion([['campo' => 'usuario', 'texto' => 'Ese nombre de usuario ya existe. Elige otro.']]);
        }
        throw $ex;
    }
    auditar($u, 'editar', 'usuarios', $id, implode(' · ', $detalle));
}
responder(200, ['id' => $id]);

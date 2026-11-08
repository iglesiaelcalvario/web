<?php
/* api/sedes.php  —  GET listar · POST crear · PUT ?id= actualizar · PUT ?id=&accion=inactivar
   Sedes de la congregación en Villavicencio, Meta (módulo «sedes»; por defecto solo el administrador). */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'sedes';
const PAIS_FIJO = 'Colombia';
const CIUDAD_FIJA = 'Villavicencio';
const MSG_NOMBRE_REPETIDO = 'Ya existe una sede con ese nombre.';

$metodo = solo_metodos(['GET', 'POST', 'PUT']);
$u = exigir_usuario();
if ($metodo !== 'GET') {
    exigir_csrf();
}

/* Identificador: int, o null si viene vacío o no es un número entero. */
function id_de_campo($x)
{
    if ($x === null || $x === '' || !(is_int($x) || (is_string($x) && ctype_digit($x)))) {
        return null;
    }
    return (int)$x;
}

function listar_sedes(PDO $pdo)
{
    $st = $pdo->query('SELECT s.id, s.nombre, s.activo, s.direccion, s.pais, s.ciudad, s.barrio_id, b.nombre AS barrio,
                              s.departamento_id, d.nombre AS departamento
                       FROM sedes s
                       LEFT JOIN barrios b ON b.id = s.barrio_id
                       LEFT JOIN departamentos d ON d.id = s.departamento_id
                       ORDER BY s.activo DESC, s.nombre');
    $out = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $out[] = [
            'id' => (int)$r['id'], 'nombre' => $r['nombre'], 'activo' => (int)$r['activo'] === 1,
            'direccion' => $r['direccion'], 'pais' => $r['pais'], 'ciudad' => $r['ciudad'],
            'barrioId' => $r['barrio_id'] === null ? null : (int)$r['barrio_id'], 'barrio' => $r['barrio'],
            'departamentoId' => $r['departamento_id'] === null ? null : (int)$r['departamento_id'],
            'departamento' => $r['departamento'],
        ];
    }
    return $out;
}

function catalogo_departamentos(PDO $pdo)
{
    $out = [];
    foreach ($pdo->query('SELECT id, nombre FROM departamentos WHERE activo = 1 ORDER BY nombre') as $r) {
        $out[] = ['id' => (int)$r['id'], 'nombre' => $r['nombre']];
    }
    return $out;
}

function catalogo_barrios(PDO $pdo)
{
    $st = $pdo->prepare('SELECT id, nombre FROM barrios WHERE activo = 1 AND ciudad = ? ORDER BY nombre');
    $st->execute([CIUDAD_FIJA]);
    $out = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $out[] = ['id' => (int)$r['id'], 'nombre' => $r['nombre']];
    }
    return $out;
}

function existe_activo(PDO $pdo, $id, $esBarrio)
{
    if ($esBarrio) {
        $st = $pdo->prepare('SELECT id FROM barrios WHERE id = ? AND activo = 1 AND ciudad = ?');
        $st->execute([$id, CIUDAD_FIJA]);
    } else {
        $st = $pdo->prepare('SELECT id FROM departamentos WHERE id = ? AND activo = 1');
        $st->execute([$id]);
    }
    return (bool)$st->fetch();
}

function validar_sede(array $d)
{
    $e = [];
    $nombre = linea(dato($d, 'nombre'));
    $direccion = linea(dato($d, 'direccion'));
    $barrioId = id_de_campo(dato($d, 'barrioId'));
    $departamentoId = id_de_campo(dato($d, 'departamentoId'));
    if ($nombre === '') {
        $e[] = ['campo' => 'nombre', 'texto' => 'Escribe el nombre de la sede.'];
    } elseif (largo($nombre) > 80) {
        $e[] = ['campo' => 'nombre', 'texto' => 'El nombre es demasiado largo (máximo 80 caracteres).'];
    }
    if ($direccion === '') {
        $e[] = ['campo' => 'direccion', 'texto' => 'Escribe la dirección de la sede.'];
    } elseif (largo($direccion) > 160) {
        $e[] = ['campo' => 'direccion', 'texto' => 'La dirección es demasiado larga (máximo 160 caracteres).'];
    }
    if ($barrioId === null || !existe_activo(bd(), $barrioId, true)) {
        $e[] = ['campo' => 'barrioId', 'texto' => 'Elige un barrio de la lista.'];
    }
    if ($departamentoId === null || !existe_activo(bd(), $departamentoId, false)) {
        $e[] = ['campo' => 'departamentoId', 'texto' => 'Elige un departamento de la lista.'];
    }
    if ($e) {
        fallar_validacion($e);
    }
    return ['nombre' => $nombre, 'direccion' => $direccion, 'barrio_id' => $barrioId, 'departamento_id' => $departamentoId];
}

if ($metodo === 'GET') {
    exigir_permiso($u, MODULO, 'consultar', 'No tienes acceso a las sedes.');
    responder(200, [
        'sedes' => listar_sedes(bd()),
        'departamentos' => catalogo_departamentos(bd()),
        'barrios' => catalogo_barrios(bd()),
        'pais' => PAIS_FIJO,
        'ciudad' => CIUDAD_FIJA,
    ]);
}

if ($metodo === 'POST') {
    exigir_permiso($u, MODULO, 'registrar', 'No tienes permiso para crear sedes.');
    $c = validar_sede(leer_json());
    try {
        bd()->prepare('INSERT INTO sedes (nombre, activo, creado, direccion, pais, ciudad, barrio_id, departamento_id, actualizado)
                       VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$c['nombre'], hoy(), $c['direccion'], PAIS_FIJO, CIUDAD_FIJA, $c['barrio_id'], $c['departamento_id'], hoy()]);
    } catch (PDOException $ex) {
        if (codigo_mysql($ex) === 1062) {
            fallar_validacion([['campo' => 'nombre', 'texto' => MSG_NOMBRE_REPETIDO]]);
        }
        throw $ex;
    }
    $id = (int)bd()->lastInsertId();
    auditar($u, 'crear', 'sedes', $id, $c['nombre']);
    responder(201, ['id' => $id]);
}

// PUT: actualizar, o inactivar con ?accion=inactivar
exigir_permiso($u, MODULO, 'editar', 'No tienes permiso para editar sedes.');
$id = id_de_url();
$st = bd()->prepare('SELECT nombre FROM sedes WHERE id = ?');
$st->execute([$id]);
$actual = $st->fetch(PDO::FETCH_ASSOC);
if (!$actual) {
    fallar(404, 'no_existe', 'La sede no existe.');
}

if (($_GET['accion'] ?? '') === 'inactivar') {
    bd()->prepare('UPDATE sedes SET activo = 0, actualizado = ? WHERE id = ?')->execute([hoy(), $id]);
    auditar($u, 'editar', 'sedes', $id, 'Inactivada: ' . $actual['nombre']);
    responder(200, ['id' => $id, 'activo' => false]);
}

$cuerpo = leer_json();
$c = validar_sede($cuerpo);
$activo = (dato($cuerpo, 'activo') === false || dato($cuerpo, 'activo') === 0 || dato($cuerpo, 'activo') === '0') ? 0 : 1;
try {
    bd()->prepare('UPDATE sedes SET nombre = ?, direccion = ?, barrio_id = ?, departamento_id = ?, activo = ?, actualizado = ?
                   WHERE id = ?')
        ->execute([$c['nombre'], $c['direccion'], $c['barrio_id'], $c['departamento_id'], $activo, hoy(), $id]);
} catch (PDOException $ex) {
    if (codigo_mysql($ex) === 1062) {
        fallar_validacion([['campo' => 'nombre', 'texto' => MSG_NOMBRE_REPETIDO]]);
    }
    throw $ex;
}
auditar($u, 'editar', 'sedes', $id, $c['nombre']);
responder(200, ['id' => $id]);

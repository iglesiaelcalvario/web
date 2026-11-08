<?php
/* api/catalogo.php
   POST                       crear curso, nivel o tema      (módulo «catalogo», permiso «registrar»)
   PUT ?tipo=curso|nivel|tema&id=   cambiar nombre, orden o activo (permiso «editar»). Nunca se borra: se desactiva. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'catalogo';
const TABLAS = ['curso' => 'cursos', 'nivel' => 'niveles', 'tema' => 'temas', 'eps' => 'eps'];

$metodo = solo_metodos(['POST', 'PUT']);
$u = exigir_usuario();
exigir_csrf();

function validar_nombre($nombre)
{
    if ($nombre === '') {
        return [['campo' => 'nombre', 'texto' => 'Escribe el nombre.']];
    }
    if (largo($nombre) < 2) {
        return [['campo' => 'nombre', 'texto' => 'El nombre es demasiado corto.']];
    }
    if (largo($nombre) > 120) {
        return [['campo' => 'nombre', 'texto' => 'El nombre es demasiado largo (máximo 120 caracteres).']];
    }
    return [];
}
function ya_existe()
{
    fallar_validacion([['campo' => 'nombre', 'texto' => 'Ya existe un elemento con ese nombre en este lugar del catálogo.']]);
}

if ($metodo === 'POST') {
    exigir_permiso($u, MODULO, 'registrar', 'Solo el administrador puede agregar elementos al catálogo.');
    $d = leer_json();
    $tipo = linea(dato($d, 'tipo'));
    $nombre = linea(dato($d, 'nombre'));
    $orden = entero(dato($d, 'orden'));
    if ($orden === null || $orden < 0 || $orden > 999) {
        $orden = 0;
    }
    $pdo = bd();
    $e = validar_nombre($nombre);

    if ($tipo === 'curso') {
        $proceso = entero(dato($d, 'procesoId'));
        $st = $pdo->prepare('SELECT 1 FROM procesos WHERE id = ?');
        $st->execute([(int)$proceso]);
        if (!$st->fetchColumn()) {
            $e[] = ['campo' => 'procesoId', 'texto' => 'Elige el proceso de formación.'];
        }
        if ($e) {
            fallar_validacion($e);
        }
        $ins = $pdo->prepare('INSERT INTO cursos (proceso_id, nombre) VALUES (?, ?)');
        $params = [(int)$proceso, $nombre];
    } elseif ($tipo === 'nivel') {
        $curso = entero(dato($d, 'cursoId'));
        $st = $pdo->prepare('SELECT 1 FROM cursos WHERE id = ?');
        $st->execute([(int)$curso]);
        if (!$st->fetchColumn()) {
            $e[] = ['campo' => 'cursoId', 'texto' => 'Elige el curso.'];
        }
        if ($e) {
            fallar_validacion($e);
        }
        $ins = $pdo->prepare('INSERT INTO niveles (curso_id, nombre, orden) VALUES (?, ?, ?)');
        $params = [(int)$curso, $nombre, $orden];
    } elseif ($tipo === 'tema') {
        $curso = entero(dato($d, 'cursoId'));
        $nivel = entero(dato($d, 'nivelId'));
        $st = $pdo->prepare('SELECT 1 FROM cursos WHERE id = ?');
        $st->execute([(int)$curso]);
        if (!$st->fetchColumn()) {
            $e[] = ['campo' => 'cursoId', 'texto' => 'Elige el curso.'];
        }
        if ($nivel !== null && $nivel > 0) {
            $st = $pdo->prepare('SELECT 1 FROM niveles WHERE id = ? AND curso_id = ?');
            $st->execute([$nivel, (int)$curso]);
            if (!$st->fetchColumn()) {
                $e[] = ['campo' => 'nivelId', 'texto' => 'El nivel elegido no pertenece a ese curso.'];
            }
        } else {
            $nivel = null;
        }
        if ($e) {
            fallar_validacion($e);
        }
        $st = $pdo->prepare('SELECT 1 FROM temas WHERE curso_id = ? AND (nivel_id <=> ?) AND nombre = ?');
        $st->execute([(int)$curso, $nivel, $nombre]);
        if ($st->fetchColumn()) {
            ya_existe();
        }
        $ins = $pdo->prepare('INSERT INTO temas (curso_id, nivel_id, nombre, orden) VALUES (?, ?, ?, ?)');
        $params = [(int)$curso, $nivel, $nombre, $orden];
    } elseif ($tipo === 'eps') {
        if ($e) {
            fallar_validacion($e);
        }
        $ins = $pdo->prepare('INSERT INTO eps (nombre, activo) VALUES (?, 1)');
        $params = [$nombre];
    } else {
        fallar_validacion([['campo' => 'tipo', 'texto' => 'El tipo de elemento no es válido.']]);
    }

    try {
        $ins->execute($params);
    } catch (PDOException $ex) {
        if (codigo_mysql($ex) === 1062) {
            ya_existe();
        }
        throw $ex;
    }
    $nuevo = (int)$pdo->lastInsertId();
    auditar($u, 'crear', 'catalogo', $nuevo, $tipo . ': ' . $nombre);
    responder(201, ['id' => $nuevo]);
}

// PUT: cambios de nombre, orden o activo
exigir_permiso($u, MODULO, 'editar', 'Solo el administrador puede cambiar el catálogo.');
$tipo = linea(isset($_GET['tipo']) ? $_GET['tipo'] : '');
if (!isset(TABLAS[$tipo])) {
    fallar_validacion([['campo' => 'tipo', 'texto' => 'El tipo de elemento no es válido.']]);
}
$tabla = TABLAS[$tipo];
$id = id_de_url();
$st = bd()->prepare("SELECT id FROM $tabla WHERE id = ?");
$st->execute([$id]);
if (!$st->fetch()) {
    fallar(404, 'no_existe', 'El elemento no existe en el catálogo.');
}
$d = leer_json();
$sets = [];
$params = [];
if (array_key_exists('nombre', $d)) {
    $nombre = linea($d['nombre']);
    $e = validar_nombre($nombre);
    if ($e) {
        fallar_validacion($e);
    }
    $sets[] = 'nombre = ?';
    $params[] = $nombre;
}
if (array_key_exists('activo', $d)) {
    if (!is_bool($d['activo'])) {
        fallar_validacion([['campo' => 'activo', 'texto' => 'El estado no es válido.']]);
    }
    $sets[] = 'activo = ?';
    $params[] = $d['activo'] ? 1 : 0;
}
if (array_key_exists('orden', $d)) {
    $o = entero($d['orden']);
    if ($o === null || $o < 0 || $o > 999) {
        fallar_validacion([['campo' => 'orden', 'texto' => 'El orden no es válido.']]);
    }
    $sets[] = 'orden = ?';
    $params[] = $o;
}
if (!$sets) {
    fallar_validacion([['campo' => 'nombre', 'texto' => 'No hay cambios que guardar.']]);
}
$params[] = $id;
try {
    bd()->prepare("UPDATE $tabla SET " . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
} catch (PDOException $ex) {
    if (codigo_mysql($ex) === 1062) {
        ya_existe();
    }
    throw $ex;
}
auditar($u, 'editar', 'catalogo', $id, $tipo . ' (' . implode(', ', array_keys($d)) . ')');
responder(200, ['id' => $id]);

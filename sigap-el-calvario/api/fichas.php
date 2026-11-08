<?php
/* api/fichas.php  (campo «Ficha de persona»: Administrador, Pastor y Asistente Pastor)
   GET ?buscar=texto  → personas cuyo nombre contiene el texto (al menos 2 letras)
   GET ?id=ID         → la ficha: datos y las secciones que puede ver quien consulta
   Cada ficha consultada queda en la auditoría. La EPS solo la ve quien tiene el permiso «Datos sensibles».
   Cada sección depende del permiso de su campo: quien no ve Asistencia Pastoral no recibe esa sección. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'ficha-persona';

$metodo = solo_metodos(['GET']);
$u = exigir_usuario();
exigir_permiso($u, MODULO, 'consultar', 'Tu cargo no puede ver fichas de personas.');

function ficha_edad($nacimiento)
{
    return (new DateTime($nacimiento))->diff(new DateTime(hoy()))->y;
}

if (isset($_GET['buscar'])) {
    /* ---------- Buscar personas por nombre ---------- */
    $texto = trim((string)$_GET['buscar']);
    if (mb_strlen($texto, 'UTF-8') < 2) {
        fallar_validacion([['campo' => 'buscar', 'texto' => 'Escribe al menos 2 letras del nombre.']]);
    }
    $patron = '%' . addcslashes($texto, '%_\\') . '%';
    $st = bd()->prepare("SELECT id, nombres, apellidos, nacimiento FROM personas
                         WHERE CONCAT(nombres, ' ', apellidos) LIKE ? ORDER BY apellidos, nombres LIMIT 20");
    $st->execute([$patron]);
    $resultados = [];
    foreach ($st->fetchAll() as $p) {
        $resultados[] = ['id' => (int)$p['id'], 'nombre' => trim($p['nombres'] . ' ' . $p['apellidos']),
                         'edad' => ficha_edad($p['nacimiento'])];
    }
    responder(200, ['resultados' => $resultados]);
}

/* ---------- La ficha de una persona ---------- */
$id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if ($id === false || $id === null) {
    fallar_validacion([['campo' => 'id', 'texto' => 'La persona no es válida.']]);
}
$st = bd()->prepare('SELECT id, nombres, apellidos, nacimiento, telefono, correo, direccion, eps, bautizado, cargo_iglesia, telefono_emergencia, (foto IS NOT NULL) AS tiene_foto FROM personas WHERE id = ?');
$st->execute([$id]);
$p = $st->fetch();
if (!$p) {
    fallar(404, 'no_existe', 'La persona no existe.');
}

$st = bd()->prepare('SELECT f.nombre FROM persona_funciones pf JOIN funciones f ON f.id = pf.funcion_id
                     WHERE pf.persona_id = ? ORDER BY f.nombre');
$st->execute([$id]);
$funciones = array_column($st->fetchAll(), 'nombre');
$st = bd()->prepare('SELECT u.usuario, u.activo, r.nombre AS cargo FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.persona_id = ?');
$st->execute([$id]);
$c = $st->fetch();

$persona = [
    'id' => (int)$p['id'], 'nombre' => trim($p['nombres'] . ' ' . $p['apellidos']),
    'nacimiento' => $p['nacimiento'], 'edad' => ficha_edad($p['nacimiento']),
    'telefono' => $p['telefono'], 'correo' => $p['correo'], 'direccion' => $p['direccion'],
    'telefonoEmergencia' => $p['telefono_emergencia'], 'cargoIglesia' => $p['cargo_iglesia'],
    'bautizado' => (bool)$p['bautizado'], 'tieneFoto' => (bool)$p['tiene_foto'],
    'funciones' => $funciones,
    'cuenta' => $c ? ['usuario' => $c['usuario'], 'activa' => (int)$c['activo'] === 1, 'cargo' => $c['cargo']] : null,
];
if (tiene_permiso($u, 'datos-sensibles', 'consultar')) {
    $persona['eps'] = $p['eps'];
}

$secciones = ['datos' => ['persona' => $persona]];
$ocultas = [];

/* ---------- Comunión Familiar: grupos, reuniones y asistencia ---------- */
if (tiene_permiso($u, 'comunion-familiar', 'consultar')) {
    $st = bd()->prepare("SELECT g.id, g.nombre, g.anfitrion_persona_id, g.discipulador_persona_id, gp.desde,
                         (gp.persona_id IS NOT NULL) AS participa
                         FROM grupos g LEFT JOIN grupo_participantes gp ON gp.grupo_id = g.id AND gp.persona_id = ?
                         WHERE gp.persona_id IS NOT NULL OR g.discipulador_persona_id = ? OR g.anfitrion_persona_id = ?
                         ORDER BY g.nombre");
    $st->execute([$id, $id, $id]);
    $grupos = [];
    foreach ($st->fetchAll() as $g) {
        $roles = [];
        if ((int)$g['participa'] === 1) {
            $roles[] = 'Participante';
        }
        if ((int)$g['discipulador_persona_id'] === $id) {
            $roles[] = 'Discipulador';
        }
        if ((int)$g['anfitrion_persona_id'] === $id) {
            $roles[] = 'Anfitrión';
        }
        $grupos[] = ['id' => (int)$g['id'], 'nombre' => $g['nombre'], 'roles' => $roles, 'desde' => $g['desde']];
    }
    $st = bd()->prepare("SELECT r.fecha, g.nombre AS grupo,
                         EXISTS(SELECT 1 FROM reunion_asistencia ra WHERE ra.reunion_id = r.id AND ra.persona_id = ?) AS asistio
                         FROM reuniones r
                         JOIN grupos g ON g.id = r.grupo_id
                         JOIN grupo_participantes gp ON gp.grupo_id = r.grupo_id AND gp.persona_id = ?
                         WHERE r.fecha >= gp.desde ORDER BY r.fecha DESC, r.id DESC");
    $st->execute([$id, $id]);
    $reuniones = $st->fetchAll();
    $asistio = 0;
    foreach ($reuniones as $r) {
        if ((int)$r['asistio'] === 1) {
            $asistio++;
        }
    }
    $ultimas = array_map(function ($r) {
        return ['fecha' => $r['fecha'], 'grupo' => $r['grupo'], 'asistio' => (int)$r['asistio'] === 1];
    }, array_slice($reuniones, 0, 10));
    $secciones['comunion'] = ['grupos' => $grupos,
        'reuniones' => ['total' => count($reuniones), 'asistio' => $asistio], 'ultimas' => $ultimas];
} else {
    $ocultas[] = 'Comunión Familiar';
}

/* ---------- Adiestramiento: cursos y sesiones a las que asistió ---------- */
if (tiene_permiso($u, 'adiestramiento', 'consultar')) {
    $st = bd()->prepare('SELECT c.nombre, cp.desde FROM curso_participantes cp JOIN cursos c ON c.id = cp.curso_id
                         WHERE cp.persona_id = ? ORDER BY c.nombre');
    $st->execute([$id]);
    $cursos = $st->fetchAll();
    $st = bd()->prepare('SELECT COUNT(*) FROM sesion_asistencia WHERE persona_id = ?');
    $st->execute([$id]);
    $asistidas = (int)$st->fetchColumn();
    $st = bd()->prepare("SELECT s.fecha, c.nombre AS curso, TRIM(CONCAT(pa.nombres, ' ', pa.apellidos)) AS adiestrador
                         FROM sesion_asistencia sa
                         JOIN sesiones_adiestramiento s ON s.id = sa.sesion_id
                         JOIN cursos c ON c.id = s.curso_id
                         JOIN personas pa ON pa.id = s.adiestrador_persona_id
                         WHERE sa.persona_id = ? ORDER BY s.fecha DESC, s.hora_inicio DESC LIMIT 10");
    $st->execute([$id]);
    $secciones['adiestramiento'] = ['cursos' => $cursos, 'sesionesAsistidas' => $asistidas, 'ultimas' => $st->fetchAll()];
} else {
    $ocultas[] = 'Adiestramiento';
}

/* ---------- Asistencia Pastoral: casos y su situación actual (el historial completo está en el módulo) ---------- */
if (tiene_permiso($u, 'asistencia-pastoral', 'consultar')) {
    $st = bd()->prepare("SELECT c.nombre AS categoria, k.estado, k.fecha_apertura, k.proximo_seguimiento,
                         TRIM(CONCAT(u.nombres, ' ', u.apellidos)) AS responsable,
                         (SELECT COUNT(*) FROM actuaciones_pastorales a WHERE a.caso_id = k.id) AS actuaciones,
                         (SELECT MAX(a.fecha) FROM actuaciones_pastorales a WHERE a.caso_id = k.id) AS ultima
                         FROM casos_pastorales k
                         JOIN categorias_pastorales c ON c.id = k.categoria_id
                         LEFT JOIN usuarios u ON u.id = k.responsable_usuario_id
                         WHERE k.persona_id = ? ORDER BY k.fecha_apertura DESC, k.id DESC");
    $st->execute([$id]);
    $secciones['pastoral'] = ['casos' => $st->fetchAll()];
} else {
    $ocultas[] = 'Asistencia Pastoral';
}

/* ---------- Nacido de nuevo y bautismo: fechas, detalle editable y lo que puede hacer quien consulta ---------- */
if (tiene_permiso($u, 'nacidos-bautizados', 'consultar')) {
    $detalle = [];
    foreach (['nacido' => 'nacidos_de_nuevo', 'bautismo' => 'bautismos'] as $tipo => $tabla) {
        $st = bd()->prepare("SELECT r.id, r.fecha, r.responsable_persona_id, r.observaciones,
                             TRIM(CONCAT(rp.nombres, ' ', rp.apellidos)) AS responsable
                             FROM $tabla r LEFT JOIN personas rp ON rp.id = r.responsable_persona_id
                             WHERE r.persona_id = ?");
        $st->execute([$id]);
        $f = $st->fetch();
        $detalle[$tipo] = $f ? [
            'id' => (int)$f['id'],
            'fecha' => $f['fecha'],
            'responsableId' => $f['responsable_persona_id'] !== null ? (int)$f['responsable_persona_id'] : null,
            'responsable' => $f['responsable_persona_id'] !== null ? $f['responsable'] : null,
            'observaciones' => $f['observaciones'],
        ] : null;
    }
    $nacido = $detalle['nacido'] ? $detalle['nacido']['fecha'] : null;
    $bautizado = $detalle['bautismo'] ? $detalle['bautismo']['fecha'] : null;
    $secciones['registros'] = [
        'nacido' => $nacido,
        'bautizado' => $bautizado,
        'pendienteBautismo' => $nacido !== null && $bautizado === null,
        'detalle' => $detalle,
        'puede' => [
            'registrar' => tiene_permiso($u, 'nacidos-bautizados', 'registrar'),
            'editar' => tiene_permiso($u, 'nacidos-bautizados', 'editar'),
            'eliminar' => tiene_permiso($u, 'nacidos-bautizados', 'eliminar'),
        ],
    ];
} else {
    $ocultas[] = 'Nacido de nuevo y bautismo';
}

auditar($u, 'consultar', 'fichas', $id, 'secciones: ' . implode(', ', array_keys($secciones)));
responder(200, ['secciones' => $secciones, 'ocultas' => $ocultas]);

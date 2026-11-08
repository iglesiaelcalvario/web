<?php
/* api/ubicaciones.php  (campo «Ubicaciones»: todos los cargos consultan; el discipulador ve solo sus grupos)
   GET → tablero de los grupos activos de Comunión Familiar: dónde se reúne cada casa, su discipulador,
   sus discípulos y la última reunión. Todo sale de la base: grupos, participantes y reuniones.
   Las sedes de la iglesia se agregarán cuando la iglesia las defina. */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'ubicaciones';
// Las direcciones se buscan en Google Maps con la ciudad, para no confundir barrios con otras ciudades.
const CIUDAD_MAPAS = 'Villavicencio, Meta, Colombia';

$metodo = solo_metodos(['GET']);
$u = exigir_usuario();
exigir_permiso($u, MODULO, 'consultar', 'Tu cargo no puede ver las ubicaciones.');

// Ve todos los grupos quien puede ver los reportes de Comunión Familiar; los demás, solo los que discipula
$todos = tiene_permiso($u, 'comunion-familiar', 'reportes');
$persona = isset($u['persona_id']) && $u['persona_id'] !== null ? (int)$u['persona_id'] : 0;

$donde = "g.estado = 'Activo'";
$params = [];
if (!$todos) {
    $donde .= ' AND g.discipulador_persona_id = ?';
    $params[] = $persona;
}
$st = bd()->prepare("SELECT g.id, g.nombre, g.direccion, g.estado,
                     TRIM(CONCAT(d.nombres, ' ', d.apellidos)) AS discipulador,
                     TRIM(CONCAT(a.nombres, ' ', a.apellidos)) AS anfitrion
                     FROM grupos g
                     JOIN personas d ON d.id = g.discipulador_persona_id
                     JOIN personas a ON a.id = g.anfitrion_persona_id
                     WHERE $donde ORDER BY g.nombre");
$st->execute($params);
$grupos = $st->fetchAll();
$ids = array_map(function ($g) { return (int)$g['id']; }, $grupos);

$discipulosPorGrupo = [];
$ultimaPorGrupo = [];
$personasEnGrupos = [];
if ($ids) {
    $marcas = implode(',', array_fill(0, count($ids), '?'));

    // Discípulos: las personas que participan en cada grupo
    $st = bd()->prepare("SELECT gp.grupo_id, p.id, p.nombres, p.apellidos
                         FROM grupo_participantes gp JOIN personas p ON p.id = gp.persona_id
                         WHERE gp.grupo_id IN ($marcas) ORDER BY p.apellidos, p.nombres");
    $st->execute($ids);
    foreach ($st->fetchAll() as $p) {
        $gid = (int)$p['grupo_id'];
        $discipulosPorGrupo[$gid][] = ['id' => (int)$p['id'], 'nombre' => trim($p['nombres'] . ' ' . $p['apellidos'])];
        $personasEnGrupos[(int)$p['id']] = true;
    }

    // Última reunión de cada grupo (la más reciente por fecha) y cuántos asistieron
    $st = bd()->prepare("SELECT id, grupo_id, fecha FROM reuniones WHERE grupo_id IN ($marcas) ORDER BY fecha DESC, id DESC");
    $st->execute($ids);
    foreach ($st->fetchAll() as $r) {
        $gid = (int)$r['grupo_id'];
        if (!isset($ultimaPorGrupo[$gid])) {
            $ultimaPorGrupo[$gid] = ['id' => (int)$r['id'], 'fecha' => $r['fecha'], 'asistentes' => 0];
        }
    }
    if ($ultimaPorGrupo) {
        $reunionesUltimas = array_column($ultimaPorGrupo, 'id');
        $marcasR = implode(',', array_fill(0, count($reunionesUltimas), '?'));
        $st = bd()->prepare("SELECT reunion_id, COUNT(*) AS n FROM reunion_asistencia WHERE reunion_id IN ($marcasR) GROUP BY reunion_id");
        $st->execute($reunionesUltimas);
        $conteo = [];
        foreach ($st->fetchAll() as $c) {
            $conteo[(int)$c['reunion_id']] = (int)$c['n'];
        }
        foreach ($ultimaPorGrupo as $gid => $ult) {
            $ultimaPorGrupo[$gid]['asistentes'] = $conteo[$ult['id']] ?? 0;
        }
    }
}

$lista = [];
foreach ($grupos as $g) {
    $gid = (int)$g['id'];
    $ult = $ultimaPorGrupo[$gid] ?? null;
    $lista[] = [
        'id' => $gid,
        'nombre' => $g['nombre'],
        'direccion' => $g['direccion'],
        'mapaUrl' => 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode($g['direccion'] . ', ' . CIUDAD_MAPAS),
        'discipulador' => $g['discipulador'],
        'anfitrion' => $g['anfitrion'],
        'discipulos' => $discipulosPorGrupo[$gid] ?? [],
        'ultimaReunion' => $ult ? ['fecha' => $ult['fecha'], 'asistentes' => $ult['asistentes']] : null,
    ];
}

// Resumen: personas sin ningún grupo activo, solo para quien ve a todos los grupos
$personasSinGrupo = null;
if ($todos) {
    $st = bd()->query("SELECT COUNT(*) FROM personas p WHERE NOT EXISTS (
                         SELECT 1 FROM grupo_participantes gp JOIN grupos g ON g.id = gp.grupo_id
                         WHERE gp.persona_id = p.id AND g.estado = 'Activo')");
    $personasSinGrupo = (int)$st->fetchColumn();
}

responder(200, [
    'todos' => $todos,
    'ciudad' => CIUDAD_MAPAS,
    'resumen' => [
        'gruposActivos' => count($lista),
        'discipulos' => count($personasEnGrupos),
        'personasSinGrupo' => $personasSinGrupo,
    ],
    'grupos' => $lista,
]);

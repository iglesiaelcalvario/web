<?php
/* SIGAP · Lectura de datos para la página (versión 3).
   Convierte las filas de MySQL a la forma que usa js/app.js y decide QUÉ ve cada cargo. */
defined('SIGAP') or exit;

function fecha_o_vacio($v)
{
    return $v === null ? '' : (string)$v;
}
function hora_hm($v)
{
    return $v === null ? '' : substr((string)$v, 0, 5);
}
function id_o_null($v)
{
    return $v === null ? null : (int)$v;
}
function nombre_completo_sql($nom, $ape)
{
    return trim($nom . ' ' . $ape);
}

function cargar_datos(array $u)
{
    $pdo = bd();
    $miPersona = isset($u['persona_id']) ? (int)$u['persona_id'] : 0;
    $datos = [
        'usuario' => array_merge(usuario_publico($u), ['personaId' => id_o_null(isset($u['persona_id']) ? $u['persona_id'] : null)]),
        'permisos' => matriz_permisos(), 'administracion' => null, 'tiposActividad' => [], 'actividadesGenerales' => [], 'usuarios' => [], 'personas' => [], 'procesos' => [], 'eps' => [], 'cursos' => [],
        'niveles' => [], 'temas' => [], 'grupos' => [], 'reuniones' => [],
        'categoriasPastorales' => [], 'casosPastorales' => [], 'actuacionesPastorales' => [], 'sesiones' => [], 'nacidos' => [], 'bautismos' => [], 'finanzas' => [],
    ];

    foreach ($pdo->query('SELECT u.id, u.usuario, u.nombres, u.apellidos, u.activo, r.clave AS rol FROM usuarios u JOIN roles r ON r.id = u.rol_id ORDER BY u.id') as $f) {
        $datos['usuarios'][] = ['id' => (int)$f['id'], 'usuario' => $f['usuario'], 'nombres' => $f['nombres'], 'apellidos' => $f['apellidos'],
                                'rol' => $f['rol'], 'activo' => (int)$f['activo'] === 1];
    }

    // Sedes de la iglesia (las usa el formulario de personas)
    $datos['sedes'] = [];
    foreach ($pdo->query('SELECT id, nombre, activo FROM sedes ORDER BY activo DESC, nombre') as $s) {
        $datos['sedes'][] = ['id' => (int)$s['id'], 'nombre' => $s['nombre'], 'activo' => (int)$s['activo'] === 1];
    }

    // Catálogo de formación (todos lo consultan; solo el administrador lo cambia)
    if (tiene_permiso($u, 'catalogo', 'consultar')) {
        foreach ($pdo->query('SELECT id, nombre, activo FROM eps ORDER BY nombre') as $e) {
    $datos['eps'][] = ['id' => (int)$e['id'], 'nombre' => $e['nombre'], 'activo' => (int)$e['activo'] === 1];
}
foreach ($pdo->query('SELECT id, clave, nombre FROM procesos ORDER BY id') as $p) {
            $datos['procesos'][] = ['id' => (int)$p['id'], 'clave' => $p['clave'], 'nombre' => $p['nombre']];
        }
        $cp = [];
        foreach ($pdo->query('SELECT curso_id, persona_id FROM curso_participantes ORDER BY curso_id, persona_id') as $x) {
            $cp[(int)$x['curso_id']][] = (int)$x['persona_id'];
        }
        foreach ($pdo->query('SELECT id, proceso_id, nombre, activo, responsable_persona_id FROM cursos ORDER BY proceso_id, nombre') as $c) {
            $cid = (int)$c['id'];
            $datos['cursos'][] = ['id' => $cid, 'procesoId' => (int)$c['proceso_id'], 'nombre' => $c['nombre'], 'activo' => (int)$c['activo'] === 1,
                                  'responsableId' => id_o_null($c['responsable_persona_id']), 'participantes' => isset($cp[$cid]) ? $cp[$cid] : []];
        }
        foreach ($pdo->query('SELECT id, curso_id, nombre, orden, activo FROM niveles ORDER BY curso_id, orden, nombre') as $n) {
            $datos['niveles'][] = ['id' => (int)$n['id'], 'cursoId' => (int)$n['curso_id'], 'nombre' => $n['nombre'],
                                   'orden' => (int)$n['orden'], 'activo' => (int)$n['activo'] === 1];
        }
        foreach ($pdo->query('SELECT id, curso_id, nivel_id, nombre, orden, activo FROM temas ORDER BY curso_id, nivel_id, orden, nombre') as $t) {
            $datos['temas'][] = ['id' => (int)$t['id'], 'cursoId' => (int)$t['curso_id'], 'nivelId' => id_o_null($t['nivel_id']),
                                 'nombre' => $t['nombre'], 'orden' => (int)$t['orden'], 'activo' => (int)$t['activo'] === 1];
        }
    }

    // Personas: cada cargo recibe solo los campos que le corresponden
    if (tiene_permiso($u, 'lista-asistencia', 'consultar')) {
        $completo = tiene_permiso($u, 'registrar-personas', 'consultar');
        $asistencia = [];
        foreach ($pdo->query('SELECT persona_id, fecha, estado FROM asistencias ORDER BY persona_id, fecha') as $a) {
            $asistencia[(int)$a['persona_id']][] = ['f' => $a['fecha'], 'e' => $a['estado']];
        }
        $funciones = [];
        foreach ($pdo->query('SELECT pf.persona_id, f.clave FROM persona_funciones pf JOIN funciones f ON f.id = pf.funcion_id ORDER BY f.id') as $pf) {
            $funciones[(int)$pf['persona_id']][] = $pf['clave'];
        }
        foreach ($pdo->query('SELECT id, nombres, apellidos, nacimiento, telefono, correo, eps, direccion, registrada,
                              bautizado, cargo_iglesia, telefono_emergencia, grupo_sanguineo, tipo_identificacion, numero_identificacion,
                              nombre_emergencia, sede_id, grupo_adiestramiento, nivel_discipulado, nivel_adiestramiento,
                              (foto IS NOT NULL) AS tiene_foto
                       FROM personas ORDER BY id') as $p) {
            $id = (int)$p['id'];
            $x = ['num' => $id, 'nombres' => $p['nombres'], 'apellidos' => $p['apellidos'], 'telefono' => $p['telefono'],
                  'registrada' => $p['registrada'], 'asistencia' => isset($asistencia[$id]) ? $asistencia[$id] : [],
                  'funciones' => isset($funciones[$id]) ? $funciones[$id] : []];
            if ($completo) {
                $x['nacimiento'] = $p['nacimiento'];
                $x['correo'] = $p['correo'];
                $x['eps'] = $p['eps'];
                $x['direccion'] = $p['direccion'];
                $x['bautizado'] = (bool)$p['bautizado'];
                $x['cargoIglesia'] = $p['cargo_iglesia'];
                $x['telefonoEmergencia'] = $p['telefono_emergencia'];
                $x['tieneFoto'] = (bool)$p['tiene_foto'];
                $x['grupoSanguineo'] = $p['grupo_sanguineo'];
                $x['tipoIdentificacion'] = $p['tipo_identificacion'];
                $x['numeroIdentificacion'] = $p['numero_identificacion'];
                $x['nombreEmergencia'] = $p['nombre_emergencia'];
                $x['sedeId'] = $p['sede_id'] === null ? null : (int)$p['sede_id'];
                $x['grupoAdiestramiento'] = $p['grupo_adiestramiento'];
                $x['nivelDiscipulado'] = $p['nivel_discipulado'];
                $x['nivelAdiestramiento'] = $p['nivel_adiestramiento'];
            }
            $datos['personas'][] = $x;
        }
    }

    // Comunión Familiar: el discipulador solo recibe los grupos donde es el responsable
    if (tiene_permiso($u, 'comunion-familiar', 'consultar')) {
        $propio = $u['rol'] === 'discipulador';
        $sql = 'SELECT g.*, a.nombres AS a_nom, a.apellidos AS a_ape, d.nombres AS d_nom, d.apellidos AS d_ape
                FROM grupos g
                JOIN personas a ON a.id = g.anfitrion_persona_id
                JOIN personas d ON d.id = g.discipulador_persona_id'
              . ($propio ? ' WHERE g.discipulador_persona_id = ?' : '') . ' ORDER BY g.id';
        $st = $pdo->prepare($sql);
        $st->execute($propio ? [$miPersona] : []);
        $gruposRows = $st->fetchAll();

        $part = [];
        foreach ($pdo->query('SELECT grupo_id, persona_id FROM grupo_participantes ORDER BY grupo_id, persona_id') as $pp) {
            $part[(int)$pp['grupo_id']][] = (int)$pp['persona_id'];
        }
        $gruposPorId = [];
        foreach ($gruposRows as $g) {
            $gid = (int)$g['id'];
            $gruposPorId[$gid] = ['discipuladorId' => (int)$g['discipulador_persona_id']];
            $datos['grupos'][] = ['id' => $gid, 'nombre' => $g['nombre'], 'direccion' => $g['direccion'],
                'fechaInicio' => $g['fecha_inicio'], 'estado' => $g['estado'], 'observaciones' => $g['observaciones'],
                'anfitrionId' => (int)$g['anfitrion_persona_id'], 'anfitrion' => nombre_completo_sql($g['a_nom'], $g['a_ape']),
                'discipuladorId' => (int)$g['discipulador_persona_id'], 'discipulador' => nombre_completo_sql($g['d_nom'], $g['d_ape']),
                'participantes' => isset($part[$gid]) ? $part[$gid] : [], 'creado' => $g['creado']];
        }

        // Reuniones visibles: las de los grupos que se mostraron
        $sqlR = 'SELECT r.*, ur.usuario AS reg FROM reuniones r LEFT JOIN usuarios ur ON ur.id = r.registrado_por'
              . ($propio ? ' JOIN grupos g ON g.id = r.grupo_id WHERE g.discipulador_persona_id = ?' : '') . ' ORDER BY r.id';
        $sr = $pdo->prepare($sqlR);
        $sr->execute($propio ? [$miPersona] : []);
        $reunionesRows = $sr->fetchAll();
        $visibles = [];
        foreach ($reunionesRows as $r) {
            $visibles[(int)$r['id']] = true;
        }
        $asis = [];
        foreach ($pdo->query('SELECT reunion_id, persona_id FROM reunion_asistencia ORDER BY reunion_id, persona_id') as $a) {
            if (isset($visibles[(int)$a['reunion_id']])) {
                $asis[(int)$a['reunion_id']][] = (int)$a['persona_id'];
            }
        }
        $vis = [];
        foreach ($pdo->query('SELECT id, reunion_id, nombre, persona_id FROM reunion_visitantes ORDER BY id') as $v) {
            if (isset($visibles[(int)$v['reunion_id']])) {
                $vis[(int)$v['reunion_id']][] = ['id' => (int)$v['id'], 'nombre' => $v['nombre'], 'personaId' => id_o_null($v['persona_id'])];
            }
        }
        foreach ($reunionesRows as $r) {
            $rid = (int)$r['id'];
            $gid = (int)$r['grupo_id'];
            $datos['reuniones'][] = ['id' => $rid, 'grupoId' => $gid, 'fecha' => $r['fecha'],
                'hora' => hora_hm($r['hora_inicio']), 'horaFin' => hora_hm($r['hora_fin']),
                'direccion' => $r['direccion'], 'anfitrionId' => id_o_null($r['anfitrion_persona_id']),
                'discipuladorId' => $r['discipulador_persona_id'] !== null ? (int)$r['discipulador_persona_id'] : (isset($gruposPorId[$gid]) ? $gruposPorId[$gid]['discipuladorId'] : null),
                'impartidoPorId' => id_o_null($r['impartido_por_persona_id']), 'temaId' => id_o_null($r['tema_id']),
                'asistencia' => isset($asis[$rid]) ? $asis[$rid] : [], 'visitantes' => isset($vis[$rid]) ? $vis[$rid] : [],
                'cantidad' => (int)$r['cantidad'], 'ofrenda' => (int)$r['ofrenda'], 'novedades' => $r['novedades'],
                'registradoPor' => fecha_o_vacio($r['reg']), 'registrada' => $r['registrada']];
        }
    }

    // Asistencia Pastoral: categorías, casos y su historial (solo quienes consultan el módulo)
    if (tiene_permiso($u, 'asistencia-pastoral', 'consultar')) {
        foreach ($pdo->query('SELECT id, nombre, activo, orden FROM categorias_pastorales ORDER BY orden, nombre') as $c) {
            $datos['categoriasPastorales'][] = ['id' => (int)$c['id'], 'nombre' => $c['nombre'], 'activo' => (int)$c['activo'] === 1, 'orden' => (int)$c['orden']];
        }
        foreach ($pdo->query('SELECT k.*, ur.usuario AS creador FROM casos_pastorales k LEFT JOIN usuarios ur ON ur.id = k.creado_por ORDER BY k.id') as $k) {
            $datos['casosPastorales'][] = ['id' => (int)$k['id'], 'personaId' => (int)$k['persona_id'], 'categoriaId' => (int)$k['categoria_id'],
                'descripcion' => $k['descripcion'], 'fechaApertura' => $k['fecha_apertura'], 'responsableId' => id_o_null($k['responsable_usuario_id']),
                'estado' => $k['estado'], 'proximoSeguimiento' => fecha_o_vacio($k['proximo_seguimiento']),
                'creadoPor' => fecha_o_vacio($k['creador']), 'creado' => $k['creado']];
        }
        foreach ($pdo->query('SELECT a.*, ur.usuario AS reg FROM actuaciones_pastorales a LEFT JOIN usuarios ur ON ur.id = a.registrada_por ORDER BY a.caso_id, a.fecha, a.id') as $a) {
            $datos['actuacionesPastorales'][] = ['id' => (int)$a['id'], 'casoId' => (int)$a['caso_id'], 'fecha' => $a['fecha'],
                'responsableId' => id_o_null($a['responsable_usuario_id']), 'actividad' => $a['actividad'], 'observaciones' => $a['observaciones'],
                'estado' => $a['estado'], 'proximoSeguimiento' => fecha_o_vacio($a['proximo_seguimiento']),
                'registradaPor' => fecha_o_vacio($a['reg']), 'registrada' => $a['registrada']];
        }
    }
    if (tiene_permiso($u, 'adiestramiento', 'consultar')) {
        $asis = [];
        foreach ($pdo->query('SELECT sesion_id, persona_id FROM sesion_asistencia ORDER BY sesion_id, persona_id') as $a) {
            $asis[(int)$a['sesion_id']][] = (int)$a['persona_id'];
        }
        foreach ($pdo->query('SELECT s.*, ur.usuario AS reg FROM sesiones_adiestramiento s
                              LEFT JOIN usuarios ur ON ur.id = s.registrado_por ORDER BY s.fecha, s.hora_inicio, s.id') as $s) {
            $sid = (int)$s['id'];
            $datos['sesiones'][] = ['id' => $sid, 'cursoId' => (int)$s['curso_id'], 'nivelId' => id_o_null($s['nivel_id']),
                'temaId' => id_o_null($s['tema_id']), 'fecha' => $s['fecha'], 'horaInicio' => hora_hm($s['hora_inicio']),
                'horaFin' => hora_hm($s['hora_fin']), 'lugar' => $s['lugar'], 'adiestradorId' => (int)$s['adiestrador_persona_id'],
                'esSustitucion' => (int)$s['es_sustitucion'] === 1, 'novedades' => $s['novedades'], 'observaciones' => $s['observaciones'],
                'asistencia' => isset($asis[$sid]) ? $asis[$sid] : [], 'registradoPor' => fecha_o_vacio($s['reg']),
                'registrada' => $s['registrada']];
        }
    }
    if (tiene_permiso($u, 'nacidos-bautizados', 'consultar')) {
        foreach (['nacidos_de_nuevo' => 'nacidos', 'bautismos' => 'bautismos'] as $tabla => $clave) {
            foreach ($pdo->query("SELECT r.*, ur.usuario AS reg FROM $tabla r
                                  LEFT JOIN usuarios ur ON ur.id = r.registrado_por ORDER BY r.fecha, r.id") as $r) {
                $datos[$clave][] = ['id' => (int)$r['id'], 'personaId' => (int)$r['persona_id'], 'fecha' => $r['fecha'],
                    'responsableId' => id_o_null($r['responsable_persona_id']), 'observaciones' => $r['observaciones'],
                    'registradoPor' => fecha_o_vacio($r['reg']), 'registrada' => $r['registrada']];
            }
        }
    }
    if (tiene_permiso($u, 'finanzas', 'consultar')) {
        foreach ($pdo->query('SELECT f.*, ur.usuario AS reg FROM finanzas f LEFT JOIN usuarios ur ON ur.id = f.registrado_por ORDER BY f.id') as $f) {
            $datos['finanzas'][] = ['id' => (int)$f['id'], 'tipo' => $f['tipo'], 'fecha' => $f['fecha'], 'valor' => (int)$f['valor'],
                'persona' => $f['persona'], 'motivo' => $f['motivo'], 'observaciones' => $f['observaciones'],
                'registradoPor' => fecha_o_vacio($f['reg']), 'registrado' => $f['registrado']];
        }
    }
    // Administración de cuentas y permisos (solo quien puede consultar «Usuarios y accesos»)
    if (tiene_permiso($u, 'usuarios-accesos', 'consultar')) {
        $admin = ['roles' => [], 'modulos' => [], 'acciones' => [], 'aplicables' => [], 'cuentas' => []];
        foreach ($pdo->query('SELECT clave, nombre FROM roles ORDER BY id') as $r) {
            $admin['roles'][] = ['clave' => $r['clave'], 'nombre' => $r['nombre']];
        }
        foreach ($pdo->query('SELECT clave, nombre FROM modulos ORDER BY id') as $mo) {
            $admin['modulos'][] = ['clave' => $mo['clave'], 'nombre' => $mo['nombre']];
        }
        foreach ($pdo->query('SELECT clave, nombre FROM acciones ORDER BY id') as $ac) {
            $admin['acciones'][] = ['clave' => $ac['clave'], 'nombre' => $ac['nombre']];
        }
        foreach ($pdo->query('SELECT m.clave AS modulo, a.clave AS accion FROM modulo_acciones ma
                              JOIN modulos m ON m.id = ma.modulo_id JOIN acciones a ON a.id = ma.accion_id
                              ORDER BY m.id, a.id') as $f) {
            $admin['aplicables'][$f['modulo']][] = $f['accion'];
        }
        foreach ($pdo->query('SELECT u.id, u.usuario, u.nombres, u.apellidos, u.activo, u.persona_id, u.ultimo_acceso, u.creado,
                              r.clave AS rol FROM usuarios u JOIN roles r ON r.id = u.rol_id ORDER BY u.id') as $f) {
            $admin['cuentas'][] = ['id' => (int)$f['id'], 'usuario' => $f['usuario'], 'nombres' => $f['nombres'],
                'apellidos' => $f['apellidos'], 'rol' => $f['rol'], 'activo' => (int)$f['activo'] === 1,
                'personaId' => id_o_null($f['persona_id']), 'ultimoAcceso' => (string)($f['ultimo_acceso'] ?? ''),
                'creado' => (string)$f['creado']];
        }
        $datos['administracion'] = $admin;
    }

    // Actividades generales: catálogo de tipos (quien consulta actividades o tipos) y actividades (quien consulta actividades)
    if (tiene_permiso($u, 'actividades', 'consultar') || tiene_permiso($u, 'tipos-actividad', 'consultar')) {
        foreach ($pdo->query('SELECT id, nombre, activo, orden FROM tipos_actividad ORDER BY orden, nombre') as $t) {
            $datos['tiposActividad'][] = ['id' => (int)$t['id'], 'nombre' => $t['nombre'], 'activo' => (int)$t['activo'] === 1, 'orden' => (int)$t['orden']];
        }
    }
    if (tiene_permiso($u, 'actividades', 'consultar')) {
        // Personas que asistieron a cada actividad, para marcarlas de nuevo al corregir
        $asistenciaAct = [];
        foreach ($pdo->query('SELECT actividad_id, persona_id FROM actividad_asistentes ORDER BY persona_id') as $r) {
            $asistenciaAct[(int)$r['actividad_id']][] = (int)$r['persona_id'];
        }
        foreach ($pdo->query('SELECT a.*, ur.usuario AS reg FROM actividades_generales a LEFT JOIN usuarios ur ON ur.id = a.registrado_por
                              ORDER BY a.fecha DESC, a.hora_inicio DESC, a.id DESC') as $a) {
            $datos['actividadesGenerales'][] = ['id' => (int)$a['id'], 'tipoId' => (int)$a['tipo_id'], 'fecha' => $a['fecha'],
                'horaInicio' => substr($a['hora_inicio'], 0, 5), 'horaFin' => $a['hora_fin'] ? substr($a['hora_fin'], 0, 5) : '',
                'lugar' => $a['lugar'], 'responsableId' => id_o_null($a['responsable_persona_id']),
                'asistentes' => (int)$a['asistentes'], 'asistentesIds' => $asistenciaAct[(int)$a['id']] ?? [],
                'listaRegistrada' => (int)$a['lista_registrada'] === 1, 'observaciones' => $a['observaciones'], 'registradoPor' => fecha_o_vacio($a['reg'])];
        }
    }

    return $datos;
}

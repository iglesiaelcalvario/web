<?php
/* SIGAP · Panel por rol (datos de Inicio).
   Cada bloque aparece solo si el cargo tiene permiso para consultar su campo.
   Los grupos y los cumpleaños se limitan a los de quien discipula cuando el cargo no ve todos los grupos
   (es decir, cuando no tiene el permiso «reportes» en Comunión Familiar). */
defined('SIGAP') or exit;

const ROLES_PANEL = [
    'admin' => 'Administrador', 'pastor' => 'Pastor',
    'asistente' => 'Asistente Pastor', 'discipulador' => 'Discipulador',
];

// Orden de los bloques en el panel de cada cargo: primero lo que más necesita
const PANEL_ORDEN = [
    'admin' => ['cuentas', 'personas', 'grupos', 'pastoral', 'finanzas', 'adiestramiento', 'registros', 'cumpleanos'],
    'pastor' => ['pastoral', 'grupos', 'registros', 'adiestramiento', 'finanzas', 'personas', 'cumpleanos'],
    'asistente' => ['pastoral', 'cumpleanos', 'grupos', 'registros', 'adiestramiento', 'personas', 'finanzas'],
    'discipulador' => ['grupos', 'cumpleanos', 'personas'],
];

function panel_bloque($id, $titulo)
{
    return ['id' => $id, 'titulo' => $titulo, 'nota' => '', 'aviso' => '', 'tarjetas' => [], 'graficos' => [], 'tablas' => []];
}

function panel_tarjeta($titulo, $valor)
{
    return ['titulo' => $titulo, 'valor' => (string)$valor];
}

function panel_mes_largo($ymd)
{
    $t = strtotime($ymd);
    return ucfirst(MESES_LARGOS[(int)date('n', $t) - 1]) . ' de ' . date('Y', $t);
}

function panel_hora_corta($datetime)
{
    return $datetime ? fecha_corta_es(substr($datetime, 0, 10)) . ' · ' . substr($datetime, 11, 5) : 'Nunca';
}

// Ve todos los grupos quien puede ver los reportes de Comunión Familiar; los demás, solo los grupos que discipulan
function panel_alcance(array $u)
{
    return [
        'todos' => tiene_permiso($u, 'comunion-familiar', 'reportes'),
        'persona' => $u['persona_id'] !== null ? (int)$u['persona_id'] : null,
        'rol' => $u['rol'],
    ];
}

function panel_personas($d1, $d2)
{
    $b = panel_bloque('personas', 'Personas');
    $p = [];
    $total = (int)consultar('SELECT COUNT(*) AS n FROM personas', [])[0]['n'];
    $nuevas = (int)consultar('SELECT COUNT(*) AS n FROM personas WHERE 1=1' . condicion_rango('registrada', $d1, $d2, $p), $p)[0]['n'];
    $b['tarjetas'][] = panel_tarjeta('Personas registradas', $total);
    $b['tarjetas'][] = panel_tarjeta('Registradas este mes', $nuevas);
    return $b;
}

function panel_grupos(array $alcance, $d1, $d2)
{
    $b = panel_bloque('grupos', $alcance['todos'] ? 'Comunión Familiar' : 'Tus grupos');
    if (!$alcance['todos']) {
        if ($alcance['persona'] === null) {
            $b['aviso'] = 'Tu cuenta no está ligada a una persona registrada, así que no hay grupos que mostrar. Pide al administrador que la vincule.';
            return $b;
        }
        $b['nota'] = 'Solo ves los grupos de los que eres discipulador.';
    }
    $filtro = $alcance['todos'] ? '' : ' AND g.discipulador_persona_id = ?';
    $params = $alcance['todos'] ? [] : [$alcance['persona']];
    $grupos = consultar("SELECT g.id, g.nombre, (SELECT COUNT(*) FROM grupo_participantes gp WHERE gp.grupo_id = g.id) AS participantes
                         FROM grupos g WHERE g.estado = 'Activo'" . $filtro . ' ORDER BY g.nombre', $params);
    $ids = array_map(function ($g) { return (int)$g['id']; }, $grupos);
    $reuniones = [];
    if ($ids) {
        $marcas = implode(',', array_fill(0, count($ids), '?'));
        $reuniones = consultar("SELECT r.grupo_id, r.fecha, r.cantidad, r.ofrenda FROM reuniones r
                                WHERE r.grupo_id IN ($marcas) ORDER BY r.fecha DESC, r.id DESC", $ids);
    }
    $delMes = array_values(array_filter($reuniones, function ($r) use ($d1, $d2) {
        return $r['fecha'] >= $d1 && $r['fecha'] <= $d2;
    }));
    $asistencia = $delMes ? array_sum(array_map(function ($r) { return (int)$r['cantidad']; }, $delMes)) / count($delMes) : null;
    $ofrenda = array_sum(array_map(function ($r) { return (float)$r['ofrenda']; }, $delMes));
    $b['tarjetas'][] = panel_tarjeta('Grupos activos', count($grupos));
    $b['tarjetas'][] = panel_tarjeta('Reuniones este mes', count($delMes));
    $b['tarjetas'][] = panel_tarjeta('Asistencia promedio este mes', $asistencia === null ? '—' : number_format($asistencia, 1, ',', '.'));
    $b['tarjetas'][] = panel_tarjeta('Ofrenda de este mes', dinero_cop($ofrenda));

    // Última reunión y ofrenda del mes, por grupo
    $ultima = [];
    foreach ($reuniones as $r) {
        if (!isset($ultima[$r['grupo_id']])) {
            $ultima[$r['grupo_id']] = $r;
        }
    }
    $ofrendaPorGrupo = [];
    foreach ($delMes as $r) {
        $ofrendaPorGrupo[$r['grupo_id']] = ($ofrendaPorGrupo[$r['grupo_id']] ?? 0) + (float)$r['ofrenda'];
    }
    $filas = [];
    foreach ($grupos as $g) {
        $gid = (int)$g['id'];
        $u1 = $ultima[$gid] ?? null;
        $filas[] = ['celdas' => [$g['nombre'], (string)$g['participantes'],
            $u1 ? fecha_corta_es($u1['fecha']) . ' · ' . $u1['cantidad'] . ' asistentes' : 'Sin reuniones',
            dinero_cop($ofrendaPorGrupo[$gid] ?? 0)], 'marca' => ''];
    }
    $b['tablas'][] = ['titulo' => 'Grupos', 'columnas' => ['Grupo', 'Participantes', 'Última reunión', 'Ofrenda del mes'],
                      'filas' => $filas, 'vacio' => 'No hay grupos activos.'];

    // Asistentes de las últimas reuniones, en orden cronológico
    $ultimas = array_reverse(array_slice($reuniones, 0, 8));
    $b['graficos'][] = ['titulo' => 'Asistentes en las últimas reuniones',
        'etiquetas' => array_map(function ($r) { return fecha_corta_es($r['fecha']); }, $ultimas),
        'valores' => array_map(function ($r) { return (int)$r['cantidad']; }, $ultimas), 'formato' => 'numero'];
    return $b;
}

function panel_pastoral($d1, $d2, $hoy)
{
    $b = panel_bloque('pastoral', 'Asistencia Pastoral');
    $abiertos = "estado IN ('Pendiente', 'En seguimiento')";
    $casosAbiertos = (int)consultar("SELECT COUNT(*) AS n FROM casos_pastorales WHERE $abiertos", [])[0]['n'];
    $vencidos = (int)consultar("SELECT COUNT(*) AS n FROM casos_pastorales WHERE $abiertos
                                AND proximo_seguimiento IS NOT NULL AND proximo_seguimiento < ?", [$hoy])[0]['n'];
    $p = [];
    $casosMes = (int)consultar('SELECT COUNT(*) AS n FROM casos_pastorales WHERE 1=1'
        . condicion_rango('fecha_apertura', $d1, $d2, $p), $p)[0]['n'];
    $p = [];
    $actos = consultar("SELECT a.fecha, CONCAT(SUBSTRING_INDEX(u.nombres, ' ', 1), ' ', SUBSTRING_INDEX(u.apellidos, ' ', 1)) AS responsable
                        FROM actuaciones_pastorales a LEFT JOIN usuarios u ON u.id = a.responsable_usuario_id
                        WHERE 1=1" . condicion_rango('a.fecha', $d1, $d2, $p), $p);
    $b['tarjetas'][] = panel_tarjeta('Casos abiertos', $casosAbiertos);
    $b['tarjetas'][] = panel_tarjeta('Seguimientos vencidos', $vencidos);
    $b['tarjetas'][] = panel_tarjeta('Acompañamientos este mes', count($actos));
    $b['tarjetas'][] = panel_tarjeta('Casos nuevos este mes', $casosMes);

    $proximas = consultar("SELECT k.proximo_seguimiento, k.estado, p.nombres, p.apellidos, c.nombre AS categoria,
                           TRIM(CONCAT(u.nombres, ' ', u.apellidos)) AS responsable
                           FROM casos_pastorales k
                           JOIN personas p ON p.id = k.persona_id
                           JOIN categorias_pastorales c ON c.id = k.categoria_id
                           LEFT JOIN usuarios u ON u.id = k.responsable_usuario_id
                           WHERE $abiertos
                           ORDER BY (k.proximo_seguimiento IS NULL), k.proximo_seguimiento, k.id LIMIT 8", []);
    $filas = [];
    foreach ($proximas as $k) {
        $vencido = $k['proximo_seguimiento'] !== null && $k['proximo_seguimiento'] < $hoy;
        $filas[] = ['celdas' => [trim($k['nombres'] . ' ' . $k['apellidos']), $k['categoria'],
            $k['proximo_seguimiento'] ? fecha_corta_es($k['proximo_seguimiento']) . ($vencido ? ' · vencido' : '') : 'Sin fecha',
            $k['estado'], $k['responsable'] ?: '—'], 'marca' => $vencido ? 'vencido' : ''];
    }
    $b['tablas'][] = ['titulo' => 'Próximas atenciones', 'columnas' => ['Persona', 'Categoría', 'Próxima atención', 'Estado', 'Responsable'],
                      'filas' => $filas, 'vacio' => 'No hay casos abiertos.'];

    $porResponsable = [];
    foreach ($actos as $a) {
        $nombre = $a['responsable'] ?: '—';
        $porResponsable[$nombre] = ($porResponsable[$nombre] ?? 0) + 1;
    }
    arsort($porResponsable);
    $porResponsable = array_slice($porResponsable, 0, 6, true);
    $b['graficos'][] = ['titulo' => 'Acompañamientos por responsable este mes', 'etiquetas' => array_keys($porResponsable),
                        'valores' => array_values($porResponsable), 'formato' => 'numero'];
    return $b;
}

function panel_adiestramiento($d1, $d2)
{
    $b = panel_bloque('adiestramiento', 'Adiestramiento');
    $p = [];
    $sesiones = consultar('SELECT s.id, (SELECT COUNT(*) FROM sesion_asistencia sa WHERE sa.sesion_id = s.id) AS asistieron
                           FROM sesiones_adiestramiento s WHERE 1=1' . condicion_rango('s.fecha', $d1, $d2, $p), $p);
    $asistencias = array_sum(array_map(function ($s) { return (int)$s['asistieron']; }, $sesiones));
    $cursos = (int)consultar('SELECT COUNT(*) AS n FROM cursos', [])[0]['n'];
    $b['tarjetas'][] = panel_tarjeta('Sesiones este mes', count($sesiones));
    $b['tarjetas'][] = panel_tarjeta('Asistencias este mes', $asistencias);
    $b['tarjetas'][] = panel_tarjeta('Cursos', $cursos);

    $ultimas = consultar("SELECT s.fecha, c.nombre AS curso, TRIM(CONCAT(pa.nombres, ' ', pa.apellidos)) AS adiestrador,
                          (SELECT COUNT(*) FROM sesion_asistencia sa WHERE sa.sesion_id = s.id) AS asistieron
                          FROM sesiones_adiestramiento s
                          JOIN cursos c ON c.id = s.curso_id
                          JOIN personas pa ON pa.id = s.adiestrador_persona_id
                          ORDER BY s.fecha DESC, s.hora_inicio DESC LIMIT 6", []);
    $filas = array_map(function ($s) {
        return ['celdas' => [$s['curso'], fecha_corta_es($s['fecha']), $s['adiestrador'], (string)$s['asistieron']], 'marca' => ''];
    }, $ultimas);
    $b['tablas'][] = ['titulo' => 'Últimas sesiones', 'columnas' => ['Curso', 'Fecha', 'Adiestrador', 'Asistieron'],
                      'filas' => $filas, 'vacio' => 'Todavía no hay sesiones registradas.'];
    return $b;
}

function panel_registros($d1, $d2)
{
    $b = panel_bloque('registros', 'Nacidos de nuevo y bautizados');
    $p = [];
    $nacidos = (int)consultar('SELECT COUNT(*) AS n FROM nacidos_de_nuevo WHERE 1=1' . condicion_rango('fecha', $d1, $d2, $p), $p)[0]['n'];
    $p = [];
    $bautizados = (int)consultar('SELECT COUNT(*) AS n FROM bautismos WHERE 1=1' . condicion_rango('fecha', $d1, $d2, $p), $p)[0]['n'];
    $pendientes = consultar("SELECT n.fecha, CONCAT(p.nombres, ' ', p.apellidos) AS persona
                             FROM nacidos_de_nuevo n JOIN personas p ON p.id = n.persona_id
                             WHERE n.persona_id NOT IN (SELECT persona_id FROM bautismos)
                             ORDER BY n.fecha DESC", []);
    $b['tarjetas'][] = panel_tarjeta('Nacidos de nuevo este mes', $nacidos);
    $b['tarjetas'][] = panel_tarjeta('Bautizados este mes', $bautizados);
    $b['tarjetas'][] = panel_tarjeta('Nacidos sin bautismo', count($pendientes));
    $filas = array_map(function ($r) {
        return ['celdas' => [$r['persona'], fecha_corta_es($r['fecha'])], 'marca' => ''];
    }, array_slice($pendientes, 0, 8));
    $b['tablas'][] = ['titulo' => 'Pendientes de bautismo', 'columnas' => ['Persona', 'Nacido de nuevo el'],
                      'filas' => $filas, 'vacio' => 'Nadie está pendiente de bautismo.'];
    return $b;
}

// Solo totales, como en Reportes: el panel no muestra movimientos de personas
function panel_finanzas($d1, $d2)
{
    $b = panel_bloque('finanzas', 'Finanzas');
    $p = [];
    $fila = consultar('SELECT COUNT(*) AS n, COALESCE(SUM(valor), 0) AS total FROM finanzas WHERE 1=1'
        . condicion_rango('fecha', $d1, $d2, $p), $p)[0];
    $b['tarjetas'][] = panel_tarjeta('Ingresos de este mes', dinero_cop($fila['total']));
    $b['tarjetas'][] = panel_tarjeta('Registros de este mes', (int)$fila['n']);

    $inicio = (new DateTime($d1))->modify('-5 months')->format('Y-m-01');
    $porMes = [];
    foreach (consultar("SELECT DATE_FORMAT(fecha, '%Y-%m') AS ym, SUM(valor) AS total FROM finanzas
                        WHERE fecha >= ? GROUP BY ym", [$inicio]) as $f) {
        $porMes[$f['ym']] = (float)$f['total'];
    }
    $etiquetas = [];
    $valores = [];
    $cursor = new DateTime($inicio);
    for ($i = 0; $i < 6; $i++) {
        $etiquetas[] = MESES_CORTOS[(int)$cursor->format('n') - 1];
        $valores[] = $porMes[$cursor->format('Y-m')] ?? 0;
        $cursor->modify('+1 month');
    }
    $b['graficos'][] = ['titulo' => 'Ingresos de los últimos seis meses', 'etiquetas' => $etiquetas,
                        'valores' => $valores, 'formato' => 'cop'];
    return $b;
}

function panel_cumpleanos(array $alcance, $hoy)
{
    // La discipuladora ve la lista completa de cumpleaños de la iglesia (mes y próximos 30 días):
    // la página la arma con la misma pantalla de Reportes, así que aquí solo se marca el componente.
    if ($alcance['rol'] === 'discipulador') {
        $b = panel_bloque('cumpleanos', 'Cumpleaños');
        $b['nota'] = 'Lista completa de cumpleaños de la iglesia: del mes y de los próximos 30 días.';
        $b['componente'] = 'cumpleanos';
        return $b;
    }
    // El administrador, el pastor y el asistente ven los cumpleaños de toda la iglesia de los próximos 7 días
    $b = panel_bloque('cumpleanos', 'Cumpleaños de los próximos 7 días');
    $personas = consultar('SELECT id, nombres, apellidos, nacimiento FROM personas', []);
    $hasta = (new DateTime($hoy))->modify('+7 days')->format('Y-m-d');
    $anio = (int)substr($hoy, 0, 4);
    $lista = [];
    foreach ($personas as $p) {
        $f = fecha_en_anio($p['nacimiento'], $anio);
        if ($f < $hoy) {
            $f = fecha_en_anio($p['nacimiento'], $anio + 1);
        }
        if ($f <= $hasta) {
            $lista[] = persona_cumple($p, $f);
        }
    }
    ordenar_cumples($lista);
    $b['tarjetas'][] = panel_tarjeta('Cumpleaños en los próximos 7 días', count($lista));
    $filas = array_map(function ($c) {
        return ['celdas' => [trim($c['nombres'] . ' ' . $c['apellidos']), fecha_corta_es($c['fecha']), (string)$c['cumple']], 'marca' => ''];
    }, array_slice($lista, 0, 8));
    $b['tablas'][] = ['titulo' => 'Próximos cumpleaños', 'columnas' => ['Persona', 'Cumple', 'Años'],
                      'filas' => $filas, 'vacio' => 'No hay cumpleaños en los próximos 7 días.'];
    return $b;
}

// Solo para quien administra las cuentas
function panel_cuentas()
{
    $b = panel_bloque('cuentas', 'Cuentas de acceso');
    $activas = (int)consultar('SELECT COUNT(*) AS n FROM usuarios WHERE activo = 1', [])[0]['n'];
    $inactivas = (int)consultar('SELECT COUNT(*) AS n FROM usuarios WHERE activo = 0', [])[0]['n'];
    $sinCuenta = (int)consultar('SELECT COUNT(*) AS n FROM personas
                                 WHERE id NOT IN (SELECT persona_id FROM usuarios WHERE persona_id IS NOT NULL)', [])[0]['n'];
    $b['tarjetas'][] = panel_tarjeta('Cuentas activas', $activas);
    $b['tarjetas'][] = panel_tarjeta('Cuentas inactivas', $inactivas);
    $b['tarjetas'][] = panel_tarjeta('Personas sin cuenta', $sinCuenta);
    $ultimos = consultar("SELECT u.nombres, u.apellidos, u.usuario, r.nombre AS cargo, u.ultimo_acceso
                          FROM usuarios u JOIN roles r ON r.id = u.rol_id
                          ORDER BY (u.ultimo_acceso IS NULL), u.ultimo_acceso DESC LIMIT 6", []);
    $filas = array_map(function ($c) {
        return ['celdas' => [trim($c['nombres'] . ' ' . $c['apellidos']), $c['usuario'], $c['cargo'],
            panel_hora_corta($c['ultimo_acceso'])], 'marca' => ''];
    }, $ultimos);
    $b['tablas'][] = ['titulo' => 'Últimos ingresos', 'columnas' => ['Persona', 'Usuario', 'Cargo', 'Último ingreso'],
                      'filas' => $filas, 'vacio' => 'Nadie ha entrado todavía.'];
    return $b;
}

// Datos del panel de Inicio para el cargo de quien consulta. Solo se construyen los bloques permitidos.
function panel_datos(array $u)
{
    $hoy = hoy();
    [$d1, $d2] = rango_periodo('mes', '', '');
    $alcance = panel_alcance($u);
    $bloques = [];
    if (tiene_permiso($u, 'usuarios-accesos', 'consultar')) {
        $bloques['cuentas'] = panel_cuentas();
    }
    if (tiene_permiso($u, 'lista-asistencia', 'consultar')) {
        $bloques['personas'] = panel_personas($d1, $d2);
    }
    if (tiene_permiso($u, 'comunion-familiar', 'consultar')) {
        $bloques['grupos'] = panel_grupos($alcance, $d1, $d2);
    }
    if (tiene_permiso($u, 'asistencia-pastoral', 'consultar')) {
        $bloques['pastoral'] = panel_pastoral($d1, $d2, $hoy);
    }
    if (tiene_permiso($u, 'finanzas', 'consultar')) {
        $bloques['finanzas'] = panel_finanzas($d1, $d2);
    }
    if (tiene_permiso($u, 'adiestramiento', 'consultar')) {
        $bloques['adiestramiento'] = panel_adiestramiento($d1, $d2);
    }
    if (tiene_permiso($u, 'nacidos-bautizados', 'consultar')) {
        $bloques['registros'] = panel_registros($d1, $d2);
    }
    if (tiene_permiso($u, 'cumpleanos', 'consultar')) {
        $bloques['cumpleanos'] = panel_cumpleanos($alcance, $hoy);
    }
    $orden = PANEL_ORDEN[$u['rol']] ?? PANEL_ORDEN['admin'];
    $salida = [];
    foreach ($orden as $id) {
        if (isset($bloques[$id])) {
            $salida[] = $bloques[$id];
            unset($bloques[$id]);
        }
    }
    foreach ($bloques as $b) {
        $salida[] = $b;
    }
    return ['cargo' => ROLES_PANEL[$u['rol']] ?? $u['rol'], 'periodo' => panel_mes_largo($hoy), 'bloques' => $salida];
}

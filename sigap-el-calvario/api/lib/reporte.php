<?php
/* SIGAP · Datos del reporte general (los mismos cálculos de la pantalla de Reportes).
   Cada sección solo se calcula si quien descarga tiene permiso para consultarla. */
defined('SIGAP') or exit;

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ETIQUETAS_PERIODO = [
    'semana' => 'Semana actual', 'mes' => 'Mes actual', 'anio' => 'Año actual',
    'rango' => 'Rango de fechas', 'todo' => 'Todo el historial',
];

function fecha_corta_es($ymd)
{
    if (!$ymd) {
        return '—';
    }
    $t = strtotime($ymd);
    return (int)date('j', $t) . ' ' . MESES_CORTOS[(int)date('n', $t) - 1];
}

function fecha_larga_es($ymd)
{
    $t = strtotime($ymd);
    return (int)date('j', $t) . ' de ' . MESES_LARGOS[(int)date('n', $t) - 1] . ' de ' . date('Y', $t);
}

function dinero_cop($v)
{
    return '$ ' . number_format((float)$v, 0, ',', '.');
}

// Mismo criterio que la pantalla: semana de lunes a domingo, mes, año, rango elegido o todo el historial.
function rango_periodo($periodo, $desde, $hasta)
{
    $hoy = new DateTimeImmutable(hoy());
    if ($periodo === 'semana') {
        $lunes = $hoy->modify('-' . ((int)$hoy->format('N') - 1) . ' days');
        return [$lunes->format('Y-m-d'), $lunes->modify('+6 days')->format('Y-m-d')];
    }
    if ($periodo === 'mes') {
        return [$hoy->format('Y-m-01'), $hoy->format('Y-m-t')];
    }
    if ($periodo === 'anio') {
        return [$hoy->format('Y') . '-01-01', $hoy->format('Y') . '-12-31'];
    }
    if ($periodo === 'rango') {
        return [$desde !== '' ? $desde : null, $hasta !== '' ? $hasta : null];
    }
    return [null, null];
}

function etiqueta_periodo($periodo, $d1, $d2)
{
    $base = ETIQUETAS_PERIODO[$periodo];
    if ($periodo === 'todo') {
        return $base;
    }
    if ($periodo === 'rango') {
        if ($d1 === null && $d2 === null) {
            return $base . ' (sin límite de fechas)';
        }
        return $base . ' (' . ($d1 ? 'desde el ' . fecha_larga_es($d1) : 'sin fecha inicial')
            . ', ' . ($d2 ? 'hasta el ' . fecha_larga_es($d2) : 'sin fecha final') . ')';
    }
    return $base . ' (del ' . fecha_larga_es($d1) . ' al ' . fecha_larga_es($d2) . ')';
}

// Agrega «AND columna >= ? AND columna <= ?» solo para los límites que existan. La columna siempre es un valor fijo del código.
function condicion_rango($columna, $d1, $d2, array &$params)
{
    $c = '';
    if ($d1 !== null) {
        $c .= " AND $columna >= ?";
        $params[] = $d1;
    }
    if ($d2 !== null) {
        $c .= " AND $columna <= ?";
        $params[] = $d2;
    }
    return $c;
}

function consultar(string $sql, array $params)
{
    $st = bd()->prepare($sql);
    $st->execute($params);
    return $st->fetchAll();
}

function reporte_datos(array $u, $periodo, $desde, $hasta)
{
    [$d1, $d2] = rango_periodo($periodo, $desde, $hasta);
    $hoy = hoy();
    $out = [
        'periodo' => etiqueta_periodo($periodo, $d1, $d2),
        'generado' => fecha_larga_es($hoy),
        'resumen' => [],
        'comunion' => null, 'actividades' => null, 'pastoral' => null, 'adiestramiento' => null,
        'nacidos' => null, 'bautizados' => null, 'pendientes' => null, 'finanzas' => null,
    ];

    // Personas y grupos (las cifras generales)
    if (tiene_permiso($u, 'lista-asistencia', 'consultar')) {
        $p = [];
        $nuevas = consultar('SELECT COUNT(*) FROM personas WHERE 1=1' . condicion_rango('registrada', $d1, $d2, $p), $p)[0]['COUNT(*)'];
        $total = consultar('SELECT COUNT(*) FROM personas', [])[0]['COUNT(*)'];
        $out['resumen'][] = ['n' => $total, 'l' => "Personas registradas ($nuevas nuevas en el período)"];
    }

    // Comunión Familiar
    if (tiene_permiso($u, 'comunion-familiar', 'consultar')) {
        $p = [];
        $reuniones = consultar('SELECT r.fecha, r.cantidad, r.ofrenda, g.nombre AS grupo FROM reuniones r
                                JOIN grupos g ON g.id = r.grupo_id WHERE 1=1' . condicion_rango('r.fecha', $d1, $d2, $p)
                               . ' ORDER BY r.fecha DESC, r.id DESC', $p);
        $grupos = consultar('SELECT COUNT(*) AS n FROM grupos', [])[0]['n'];
        $asistentes = array_sum(array_map(fn($r) => (int)$r['cantidad'], $reuniones));
        $ofrenda = array_sum(array_map(fn($r) => (float)$r['ofrenda'], $reuniones));
        $out['resumen'][] = ['n' => $grupos, 'l' => 'Grupos de Comunión Familiar'];
        $out['resumen'][] = ['n' => count($reuniones), 'l' => 'Reuniones en el período'];
        $out['resumen'][] = ['n' => $asistentes, 'l' => 'Asistentes a esas reuniones'];
        $out['comunion'] = ['reuniones' => $reuniones, 'ofrenda' => $ofrenda];
    }

    // Actividades generales: por tipo, en el período (los tipos activos siempre; los inactivos si tuvieron actividades)
    if (tiene_permiso($u, 'actividades', 'consultar')) {
        $p = [];
        $filas = consultar('SELECT t.nombre, COUNT(a.id) AS n, COALESCE(SUM(a.asistentes), 0) AS asistentes
                            FROM tipos_actividad t LEFT JOIN actividades_generales a ON a.tipo_id = t.id'
                           . condicion_rango('a.fecha', $d1, $d2, $p)
                           . ' WHERE t.activo = 1 OR a.id IS NOT NULL
                               GROUP BY t.id, t.nombre, t.orden ORDER BY t.orden, t.nombre', $p);
        $total = 0;
        $asistentes = 0;
        $tabla = [];
        foreach ($filas as $f) {
            $n = (int)$f['n'];
            $a = (int)$f['asistentes'];
            $total += $n;
            $asistentes += $a;
            $tabla[] = ['tipo' => $f['nombre'], 'n' => $n, 'asistentes' => $a, 'promedio' => $n > 0 ? (int)round($a / $n) : null];
        }
        $out['actividades'] = ['filas' => $tabla, 'total' => $total, 'asistentes' => $asistentes];
    }

    // Asistencia Pastoral: solo cifras y actividad por responsable, sin nombres de personas ni de casos
    if (tiene_permiso($u, 'asistencia-pastoral', 'consultar')) {
        $p = [];
        $casosPeriodo = (int)consultar('SELECT COUNT(*) AS n FROM casos_pastorales WHERE 1=1' . condicion_rango('fecha_apertura', $d1, $d2, $p), $p)[0]['n'];
        $p = [];
        $actos = consultar('SELECT a.fecha, u.nombres, u.apellidos FROM actuaciones_pastorales a
                            LEFT JOIN usuarios u ON u.id = a.responsable_usuario_id WHERE 1=1'
                           . condicion_rango('a.fecha', $d1, $d2, $p), $p);
        $porResponsable = [];
        foreach ($actos as $a) {
            $nombre = trim(($a['nombres'] ?? '') . ' ' . ($a['apellidos'] ?? ''));
            $nombre = $nombre !== '' ? $nombre : '—';
            $porResponsable[$nombre] = ($porResponsable[$nombre] ?? 0) + 1;
        }
        arsort($porResponsable);
        $abiertos = (int)consultar("SELECT COUNT(*) AS n FROM casos_pastorales WHERE estado IN ('Pendiente', 'En seguimiento')", [])[0]['n'];
        $vencidos = (int)consultar("SELECT COUNT(*) AS n FROM casos_pastorales WHERE estado IN ('Pendiente', 'En seguimiento')
                                    AND proximo_seguimiento IS NOT NULL AND proximo_seguimiento < ?", [$hoy])[0]['n'];
        $out['pastoral'] = [
            'casosPeriodo' => $casosPeriodo, 'actosPeriodo' => count($actos),
            'abiertos' => $abiertos, 'vencidos' => $vencidos, 'porResponsable' => $porResponsable,
        ];
    }

    // Adiestramiento
    if (tiene_permiso($u, 'adiestramiento', 'consultar')) {
        $p = [];
        $sesiones = consultar("SELECT s.fecha, c.nombre AS curso, CONCAT(pa.nombres, ' ', pa.apellidos) AS adiestrador,
                               (SELECT COUNT(*) FROM sesion_asistencia sa WHERE sa.sesion_id = s.id) AS asistieron
                               FROM sesiones_adiestramiento s
                               JOIN cursos c ON c.id = s.curso_id
                               JOIN personas pa ON pa.id = s.adiestrador_persona_id
                               WHERE 1=1" . condicion_rango('s.fecha', $d1, $d2, $p)
                              . ' ORDER BY s.fecha DESC, s.hora_inicio DESC', $p);
        $out['adiestramiento'] = ['sesiones' => $sesiones];
    }

    // Nacidos de nuevo y bautizados (registros de cada persona)
    if (tiene_permiso($u, 'nacidos-bautizados', 'consultar')) {
        $p = [];
        $out['nacidos'] = consultar("SELECT n.fecha, CONCAT(p.nombres, ' ', p.apellidos) AS persona FROM nacidos_de_nuevo n
                                     JOIN personas p ON p.id = n.persona_id WHERE 1=1"
                                    . condicion_rango('n.fecha', $d1, $d2, $p) . ' ORDER BY n.fecha DESC', $p);
        $p = [];
        $out['bautizados'] = consultar("SELECT b.fecha, CONCAT(p.nombres, ' ', p.apellidos) AS persona FROM bautismos b
                                        JOIN personas p ON p.id = b.persona_id WHERE 1=1"
                                       . condicion_rango('b.fecha', $d1, $d2, $p) . ' ORDER BY b.fecha DESC', $p);
        // Pendientes de bautismo: nacidos de nuevo sin bautismo registrado. No depende del período.
        $out['pendientes'] = consultar("SELECT n.fecha, CONCAT(p.nombres, ' ', p.apellidos) AS persona FROM nacidos_de_nuevo n
                                        JOIN personas p ON p.id = n.persona_id
                                        LEFT JOIN bautismos b ON b.persona_id = n.persona_id
                                        WHERE b.persona_id IS NULL ORDER BY n.fecha DESC", []);
    }

    // Finanzas: solo totales, como en la pantalla de Reportes
    if (tiene_permiso($u, 'finanzas', 'consultar')) {
        $p = [];
        $fila = consultar('SELECT COUNT(*) AS n, COALESCE(SUM(valor), 0) AS total FROM finanzas WHERE 1=1'
                          . condicion_rango('fecha', $d1, $d2, $p), $p)[0];
        $out['finanzas'] = ['registros' => (int)$fila['n'], 'total' => (float)$fila['total']];
    }
    return $out;
}

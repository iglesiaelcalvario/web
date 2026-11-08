<?php
/* SIGAP · Reportes por sección: cada bloque de la pantalla de Reportes puede salir solo, en PDF, CSV o JSON.
   Usa los mismos datos que el reporte general (reporte_datos) para que las cifras coincidan. */
defined('SIGAP') or exit;

const SECCIONES_REPORTE = [
    'comunion' => 'Comunión Familiar',
    'actividades' => 'Actividades generales',
    'pastoral' => 'Asistencia Pastoral',
    'adiestramiento' => 'Adiestramiento',
    'nacidos' => 'Nacidos de nuevo (Bautizados)',
    'bautizados' => 'Bautizados',
    'pendientes' => 'Pendientes de bautismo',
    'finanzas' => 'Finanzas',
    'cumpleanos' => 'Cumpleaños del mes',
    'listado' => 'Listado de asistencia',
    'lista' => 'Lista de asistencia por persona (en general)',
];

const MESES_SECCION = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Devuelve: clave, titulo, periodo, nota, resumen [[l, v]], columnas [[t, num]] y filas (celdas ya en texto)
function seccion_datos(string $clave, array $u, string $periodo, string $desde, string $hasta, int $mes, int $anio)
{
    [$d1, $d2] = rango_periodo($periodo, $desde, $hasta);
    $base = [
        'clave' => $clave,
        'titulo' => SECCIONES_REPORTE[$clave],
        'periodo' => etiqueta_periodo($periodo, $d1, $d2),
        'nota' => '',
        'resumen' => [],
        'columnas' => [],
        'filas' => [],
    ];

    // Cumpleaños: el mes que se pide, no el período
    if ($clave === 'cumpleanos') {
        $base['titulo'] = 'Cumpleaños de ' . MESES_SECCION[$mes] . ' ' . $anio;
        $base['periodo'] = 'Mes de ' . MESES_SECCION[$mes] . ' de ' . $anio;
        $lista = [];
        foreach (consultar('SELECT id, nombres, apellidos, nacimiento FROM personas', []) as $p) {
            if (empty($p['nacimiento'])) {
                continue;
            }
            $f = fecha_en_anio($p['nacimiento'], $anio);
            if ((int)substr($f, 5, 2) === $mes) {
                $lista[] = persona_cumple($p, $f);
            }
        }
        ordenar_cumples($lista);
        $base['resumen'] = [['l' => 'Cumpleaños en el mes', 'v' => count($lista)]];
        $base['columnas'] = [['t' => 'Día', 'num' => true], ['t' => 'Nombre'], ['t' => 'Cumple (años)', 'num' => true]];
        foreach ($lista as $c) {
            $base['filas'][] = [(string)$c['dia'], trim($c['nombres'] . ' ' . $c['apellidos']), (string)$c['cumple']];
        }
        return $base;
    }

    // Listado de asistencia: los registros de la vista del período
    if ($clave === 'listado') {
        $params = [];
        $sql = 'SELECT apellidos, nombres, fecha, tipo, evento FROM v_listado_asistencia WHERE 1=1'
            . condicion_rango('fecha', $d1, $d2, $params) . ' ORDER BY fecha DESC, apellidos, nombres';
        $filas = consultar($sql, $params);
        $base['resumen'] = [['l' => 'Registros de asistencia', 'v' => count($filas)]];
        $base['columnas'] = [['t' => 'Apellidos'], ['t' => 'Nombres'], ['t' => 'Fecha'], ['t' => 'Tipo'], ['t' => 'Evento']];
        foreach ($filas as $f) {
            $base['filas'][] = [(string)$f['apellidos'], (string)$f['nombres'], fecha_corta_es($f['fecha']), (string)$f['tipo'], (string)$f['evento']];
        }
        return $base;
    }

    // Lista de asistencia por persona, en general: el mismo cálculo del reporte de la lista
    if ($clave === 'lista') {
        $a = asistencia_datos([
            'modo' => 'general',
            'desde' => $d1 ?? '1900-01-01',
            'hasta' => $d2 ?? hoy(),
            'filtro' => 'todas',
        ]);
        $base['nota'] = $a['nota'];
        $base['resumen'] = [
            ['l' => 'Presentes', 'v' => $a['resumen']['presentes']],
            ['l' => 'Faltas', 'v' => $a['resumen']['faltas']],
            ['l' => 'Excusas', 'v' => $a['resumen']['excusas']],
            ['l' => '% asistencia', 'v' => $a['resumen']['porcentaje']],
        ];
        $numericas = ['Presentes', 'Faltas', 'Excusas', '% asistencia'];
        foreach ($a['columnas'] as $t) {
            $base['columnas'][] = ['t' => $t, 'num' => in_array($t, $numericas, true)];
        }
        $base['filas'] = $a['filas'];
        return $base;
    }

    // Las secciones del reporte general
    $datos = reporte_datos($u, $periodo, $desde, $hasta);
    switch ($clave) {
        case 'comunion':
            $c = $datos['comunion'] ?? ['reuniones' => [], 'ofrenda' => 0];
            $asistentes = 0;
            foreach ($c['reuniones'] as $r) {
                $asistentes += (int)$r['cantidad'];
            }
            $base['resumen'] = [
                ['l' => 'Reuniones', 'v' => count($c['reuniones'])],
                ['l' => 'Asistentes', 'v' => $asistentes],
                ['l' => 'Ofrenda acumulada', 'v' => dinero_cop($c['ofrenda'])],
            ];
            $base['columnas'] = [['t' => 'Grupo'], ['t' => 'Fecha'], ['t' => 'Asistentes', 'num' => true], ['t' => 'Ofrenda', 'num' => true]];
            foreach ($c['reuniones'] as $r) {
                $base['filas'][] = [(string)$r['grupo'], fecha_corta_es($r['fecha']), (string)(int)$r['cantidad'], dinero_cop($r['ofrenda'])];
            }
            break;

        case 'actividades':
            $a = $datos['actividades'] ?? ['filas' => [], 'total' => 0, 'asistentes' => 0];
            $base['resumen'] = [
                ['l' => 'Actividades', 'v' => $a['total']],
                ['l' => 'Asistentes', 'v' => $a['asistentes']],
            ];
            $base['columnas'] = [['t' => 'Tipo'], ['t' => 'Actividades', 'num' => true], ['t' => 'Asistentes', 'num' => true], ['t' => 'Promedio', 'num' => true]];
            foreach ($a['filas'] as $f) {
                $base['filas'][] = [(string)$f['tipo'], (string)$f['n'], (string)$f['asistentes'], $f['promedio'] === null ? '—' : (string)$f['promedio']];
            }
            break;

        case 'pastoral':
            $p = $datos['pastoral'] ?? ['casosPeriodo' => 0, 'actosPeriodo' => 0, 'abiertos' => 0, 'vencidos' => 0, 'porResponsable' => []];
            $base['nota'] = 'Resumen sin datos personales. Los casos y su historial se revisan en el módulo «Asistencia Pastoral».';
            $base['resumen'] = [
                ['l' => 'Casos del período', 'v' => $p['casosPeriodo']],
                ['l' => 'Actuaciones', 'v' => $p['actosPeriodo']],
                ['l' => 'Casos abiertos', 'v' => $p['abiertos']],
                ['l' => 'Vencidos', 'v' => $p['vencidos']],
            ];
            $base['columnas'] = [['t' => 'Responsable'], ['t' => 'Actuaciones en el período', 'num' => true]];
            foreach ($p['porResponsable'] as $nombre => $n) {
                $base['filas'][] = [(string)$nombre, (string)$n];
            }
            break;

        case 'adiestramiento':
            $sesiones = $datos['adiestramiento']['sesiones'] ?? [];
            $base['resumen'] = [['l' => 'Sesiones', 'v' => count($sesiones)]];
            $base['columnas'] = [['t' => 'Curso'], ['t' => 'Fecha'], ['t' => 'Adiestrador'], ['t' => 'Asistieron', 'num' => true]];
            foreach ($sesiones as $s) {
                $base['filas'][] = [(string)$s['curso'], fecha_corta_es($s['fecha']), (string)$s['adiestrador'], (string)$s['asistieron']];
            }
            break;

        case 'nacidos':
        case 'bautizados':
            $mezcla = [];
            foreach ($datos['nacidos'] ?? [] as $x) {
                $mezcla[] = ['Nacido de nuevo', $x];
            }
            foreach ($datos['bautizados'] ?? [] as $x) {
                $mezcla[] = ['Bautizado', $x];
            }
            usort($mezcla, fn($a, $b) => strcmp($b[1]['fecha'], $a[1]['fecha']));
            $base['resumen'] = [['l' => 'Nacidos de nuevo', 'v' => count($datos['nacidos'] ?? [])],
                                ['l' => 'Bautizados', 'v' => count($datos['bautizados'] ?? [])]];
            $base['columnas'] = [['t' => 'Persona'], ['t' => 'Registro'], ['t' => 'Fecha']];
            foreach ($mezcla as [$tipo, $x]) {
                $base['filas'][] = [(string)$x['persona'], $tipo, fecha_corta_es($x['fecha'])];
            }
            break;

        case 'pendientes':
            $lista = $datos[$clave] ?? [];
            $base['resumen'] = [['l' => 'Personas', 'v' => count($lista)]];
            $base['columnas'] = [['t' => 'Persona'], ['t' => 'Fecha']];
            foreach ($lista as $x) {
                $base['filas'][] = [(string)$x['persona'], fecha_corta_es($x['fecha'])];
            }
            break;

        case 'finanzas':
            $params = [];
            $sql = 'SELECT tipo, COUNT(*) AS n, COALESCE(SUM(valor), 0) AS total FROM finanzas WHERE 1=1'
                . condicion_rango('fecha', $d1, $d2, $params) . ' GROUP BY tipo ORDER BY tipo';
            $filas = consultar($sql, $params);
            $registros = 0;
            $total = 0;
            foreach ($filas as $f) {
                $registros += (int)$f['n'];
                $total += (float)$f['total'];
            }
            $base['resumen'] = [
                ['l' => 'Registros', 'v' => $registros],
                ['l' => 'Total del período', 'v' => dinero_cop($total)],
            ];
            $base['columnas'] = [['t' => 'Tipo'], ['t' => 'Registros', 'num' => true], ['t' => 'Total', 'num' => true]];
            foreach ($filas as $f) {
                $base['filas'][] = [(string)$f['tipo'], (string)(int)$f['n'], dinero_cop($f['total'])];
            }
            break;
    }
    return $base;
}

// HTML del PDF de una sección: título, período, resumen en celdas y la tabla de detalle
function seccion_html(array $d)
{
    $celdas = '';
    foreach ($d['resumen'] as $r) {
        $celdas .= '<td><div class="n">' . esc_pdf($r['v']) . '</div><div class="l">' . esc_pdf($r['l']) . '</div></td>';
    }
    $resumen = $celdas !== '' ? '<table class="resumen"><tr>' . $celdas . '</tr></table>' : '';
    $columnas = [];
    foreach ($d['columnas'] as $c) {
        $columnas[] = ['t' => $c['t'], 'num' => !empty($c['num'])];
    }
    $filas = [];
    foreach ($d['filas'] as $f) {
        $filas[] = array_map('esc_pdf', $f);
    }
    $cuerpo = bloque_pdf('Detalle', '', tabla_pdf($columnas, $filas, 'No hay registros para este período.'));
    return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>' . ESTILO_ASISTENCIA_PDF . '</style></head><body>'
        . '<p class="iglesia">' . esc_pdf(IGLESIA_PDF) . '</p>'
        . '<h1>' . esc_pdf($d['titulo']) . '</h1>'
        . '<p class="periodo">' . esc_pdf($d['periodo']) . ($d['nota'] !== '' ? '. ' . esc_pdf($d['nota']) : '') . '</p>'
        . $resumen . $cuerpo
        . '</body></html>';
}

// Bloque de una sección dentro del PDF general: título, período, resumen y tabla
function seccion_bloque_pdf(array $d)
{
    $celdas = '';
    foreach ($d['resumen'] as $r) {
        $celdas .= '<td><div class="n">' . esc_pdf($r['v']) . '</div><div class="l">' . esc_pdf($r['l']) . '</div></td>';
    }
    $resumen = $celdas !== '' ? '<table class="resumen"><tr>' . $celdas . '</tr></table>' : '';
    $columnas = [];
    foreach ($d['columnas'] as $c) {
        $columnas[] = ['t' => $c['t'], 'num' => !empty($c['num'])];
    }
    $filas = [];
    foreach ($d['filas'] as $f) {
        $filas[] = array_map('esc_pdf', $f);
    }
    $nota = esc_pdf($d['periodo']) . ($d['nota'] !== '' ? '. ' . esc_pdf($d['nota']) : '');
    return bloque_pdf($d['titulo'], $nota, $resumen . tabla_pdf($columnas, $filas, 'No hay registros para este período.'));
}

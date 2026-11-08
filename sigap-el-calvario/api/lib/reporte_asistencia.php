<?php
/* SIGAP · Reporte de la lista de asistencia: una persona, un día o en general.
   Lo usan la pantalla (JSON), el CSV para Excel y el PDF (lib/reporte_pdf.php, Dompdf).
   Las excusas cuentan como falta: el porcentaje es presentes ÷ (presentes + faltas + excusas). */
defined('SIGAP') or exit;

const ESTADO_ASISTENCIA = ['P' => 'Presente', 'F' => 'Faltó', 'E' => 'Excusa'];
const DIAS_MAXIMOS_REPORTE = 732;
const NOTA_ASISTENCIA = 'Las excusas cuentan como falta. El porcentaje de asistencia es presentes ÷ (presentes + faltas + excusas).';
const ESTILO_ASISTENCIA_PDF = 'body { font-family: Helvetica, Arial, sans-serif; font-size: 9.5pt; color: #111; }'
    . ' .iglesia { font-size: 8.5pt; color: #555; margin: 0; }'
    . ' h1 { font-size: 16pt; margin: 2pt 0 4pt 0; }'
    . ' .periodo { font-size: 8.5pt; color: #555; margin: 0 0 10pt 0; }'
    . ' table.resumen { width: 100%; border-collapse: collapse; margin-bottom: 8pt; }'
    . ' table.resumen td { border: 1px solid #d9d9d9; padding: 6pt; width: 25%; vertical-align: top; }'
    . ' table.resumen .n { font-size: 15pt; font-weight: bold; }'
    . ' table.resumen .l { font-size: 8pt; color: #555; }'
    . ' .bloque { margin-top: 10pt; }'
    . ' h2 { font-size: 11pt; border-bottom: 2px solid #111; padding-bottom: 3pt; margin: 0 0 6pt 0; }'
    . ' p.vacio { font-size: 9pt; color: #666; font-style: italic; }'
    . ' table.datos { width: 100%; border-collapse: collapse; }'
    . ' table.datos th { background: #111; color: #fff; text-align: left; font-size: 8.5pt; padding: 4pt 5pt; }'
    . ' table.datos td { border-bottom: 1px solid #e3e3e3; padding: 4pt 5pt; font-size: 9pt; }'
    . ' table.datos td.num, table.datos th.num { text-align: right; }';

// Porcentaje con coma decimal (formato de Colombia). Un guion si no hay presentes ni faltas.
function porcentaje_asistencia($presentes, $faltas)
{
    $base = $presentes + $faltas;
    return $base > 0 ? number_format($presentes * 100 / $base, 1, ',', '') . '%' : '—';
}

// $p trae: modo ('general' | 'persona' | 'dia'), desde, hasta, fecha, personaId, filtro ('todas' | 'faltas2')
function asistencia_datos(array $p)
{
    if ($p['modo'] === 'dia') {
        $st = bd()->prepare("SELECT p.apellidos, p.nombres, a.estado
            FROM personas p LEFT JOIN asistencias a ON a.persona_id = p.id AND a.fecha = ?
            ORDER BY p.apellidos, p.nombres");
        $st->execute([$p['fecha']]);
        $filas = [];
        $cuenta = ['P' => 0, 'F' => 0, 'E' => 0, 'sin' => 0];
        foreach ($st->fetchAll() as $r) {
            $e = $r['estado'];
            if ($e === null) {
                $cuenta['sin']++;
            } else {
                $cuenta[$e]++;
            }
            $filas[] = [trim($r['apellidos'] . ' ' . $r['nombres']), $e === null ? 'Sin marcar' : ESTADO_ASISTENCIA[$e]];
        }
        return [
            'modo' => 'dia',
            'titulo' => 'Asistencia del ' . fecha_larga_es($p['fecha']),
            'periodo' => ['fecha' => $p['fecha']],
            'nota' => NOTA_ASISTENCIA,
            'resumen' => ['presentes' => $cuenta['P'], 'faltas' => $cuenta['F'], 'excusas' => $cuenta['E'], 'sinMarcar' => $cuenta['sin']],
            'columnas' => ['Persona', 'Estado'],
            'filas' => $filas,
        ];
    }

    if ($p['modo'] === 'persona') {
        $st = bd()->prepare('SELECT apellidos, nombres FROM personas WHERE id = ?');
        $st->execute([(int)$p['personaId']]);
        $per = $st->fetch();
        $nombre = trim($per['apellidos'] . ' ' . $per['nombres']);
        $st = bd()->prepare('SELECT fecha, estado FROM asistencias WHERE persona_id = ? AND fecha BETWEEN ? AND ? ORDER BY fecha DESC');
        $st->execute([(int)$p['personaId'], $p['desde'], $p['hasta']]);
        $filas = [];
        $tot = ['P' => 0, 'F' => 0, 'E' => 0];
        foreach ($st->fetchAll() as $r) {
            $tot[$r['estado']]++;
            $filas[] = [fecha_corta_es($r['fecha']), ESTADO_ASISTENCIA[$r['estado']]];
        }
        return [
            'modo' => 'persona',
            'titulo' => 'Asistencia de ' . $nombre . ' del ' . fecha_larga_es($p['desde']) . ' al ' . fecha_larga_es($p['hasta']),
            'periodo' => ['desde' => $p['desde'], 'hasta' => $p['hasta']],
            'nota' => NOTA_ASISTENCIA,
            'resumen' => ['presentes' => $tot['P'], 'faltas' => $tot['F'], 'excusas' => $tot['E'], 'porcentaje' => porcentaje_asistencia($tot['P'], $tot['F'] + $tot['E'])],
            'columnas' => ['Fecha', 'Estado'],
            'filas' => $filas,
        ];
    }

    // General: una fila por persona, con su conteo en el período
    $sql = "SELECT p.apellidos, p.nombres,
                COALESCE(SUM(a.estado = 'P'), 0) AS presentes,
                COALESCE(SUM(a.estado = 'F'), 0) AS faltas,
                COALESCE(SUM(a.estado = 'E'), 0) AS excusas
            FROM personas p
            LEFT JOIN asistencias a ON a.persona_id = p.id AND a.fecha BETWEEN ? AND ?
            GROUP BY p.id, p.apellidos, p.nombres";
    if ($p['filtro'] === 'faltas2') {
        $sql .= ' HAVING (faltas + excusas) >= 2';
    }
    $sql .= ' ORDER BY p.apellidos, p.nombres';
    $st = bd()->prepare($sql);
    $st->execute([$p['desde'], $p['hasta']]);
    $filas = [];
    $tot = ['P' => 0, 'F' => 0, 'E' => 0];
    foreach ($st->fetchAll() as $r) {
        $pr = (int)$r['presentes'];
        $fa = (int)$r['faltas'];
        $ex = (int)$r['excusas'];
        $tot['P'] += $pr;
        $tot['F'] += $fa;
        $tot['E'] += $ex;
        $filas[] = [trim($r['apellidos'] . ' ' . $r['nombres']), (string)$pr, (string)$fa, (string)$ex, porcentaje_asistencia($pr, $fa + $ex)];
    }
    return [
        'modo' => 'general',
        'titulo' => 'Asistencia en general del ' . fecha_larga_es($p['desde']) . ' al ' . fecha_larga_es($p['hasta'])
            . ($p['filtro'] === 'faltas2' ? ' (solo personas con dos o más faltas o excusas)' : ''),
        'periodo' => ['desde' => $p['desde'], 'hasta' => $p['hasta']],
        'nota' => NOTA_ASISTENCIA,
        'resumen' => ['presentes' => $tot['P'], 'faltas' => $tot['F'], 'excusas' => $tot['E'], 'porcentaje' => porcentaje_asistencia($tot['P'], $tot['F'] + $tot['E'])],
        'columnas' => ['Persona', 'Presentes', 'Faltas', 'Excusas', '% asistencia'],
        'filas' => $filas,
    ];
}

// HTML del PDF: resumen en cuatro celdas y el detalle en una tabla
function asistencia_html(array $d)
{
    $r = $d['resumen'];
    $cuarta = isset($r['porcentaje'])
        ? '<td><div class="n">' . esc_pdf($r['porcentaje']) . '</div><div class="l">% asistencia</div></td>'
        : '<td><div class="n">' . (int)$r['sinMarcar'] . '</div><div class="l">Sin marcar</div></td>';
    $resumen = '<table class="resumen"><tr>'
        . '<td><div class="n">' . (int)$r['presentes'] . '</div><div class="l">Presentes</div></td>'
        . '<td><div class="n">' . (int)$r['faltas'] . '</div><div class="l">Faltas</div></td>'
        . '<td><div class="n">' . (int)$r['excusas'] . '</div><div class="l">Excusas</div></td>'
        . $cuarta . '</tr></table>';
    $numericas = ['Presentes', 'Faltas', 'Excusas', '% asistencia'];
    $columnas = [];
    foreach ($d['columnas'] as $t) {
        $columnas[] = ['t' => $t, 'num' => in_array($t, $numericas, true)];
    }
    $filas = array_map(function ($fila) {
        return array_map('esc_pdf', $fila);
    }, $d['filas']);
    $cuerpo = bloque_pdf('Detalle', '', tabla_pdf($columnas, $filas, 'No hay registros para este reporte.'));
    return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>' . ESTILO_ASISTENCIA_PDF . '</style></head><body>'
        . '<p class="iglesia">' . esc_pdf(IGLESIA_PDF) . '</p>'
        . '<h1>' . esc_pdf($d['titulo']) . '</h1>'
        . '<p class="periodo">' . esc_pdf($d['nota']) . '</p>'
        . $resumen . $cuerpo
        . '</body></html>';
}

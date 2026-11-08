<?php
/* SIGAP · Reporte general en PDF (Dompdf, incluido en api/lib/vendor, sin instalar nada más). */
defined('SIGAP') or exit;

require_once __DIR__ . '/vendor/autoload.php';

const IGLESIA_PDF = 'Iglesia Cristiana El Calvario';

function esc_pdf($t)
{
    return htmlspecialchars((string)$t, ENT_QUOTES, 'UTF-8');
}

// Tabla de datos. $columnas: [['t' => 'Título', 'num' => bool]]. $filas: arreglos de celdas ya listos (sin escapar).
function tabla_pdf(array $columnas, array $filas, $vacio)
{
    if (!$filas) {
        return '<p class="vacio">' . esc_pdf($vacio) . '</p>';
    }
    $h = '<table class="datos"><thead><tr>';
    foreach ($columnas as $c) {
        $h .= '<th' . (!empty($c['num']) ? ' class="num"' : '') . '>' . esc_pdf($c['t']) . '</th>';
    }
    $h .= '</tr></thead><tbody>';
    foreach ($filas as $fila) {
        $h .= '<tr>';
        foreach ($fila as $i => $celda) {
            $num = !empty($columnas[$i]['num']);
            $h .= '<td' . ($num ? ' class="num"' : '') . '>' . $celda . '</td>';
        }
        $h .= '</tr>';
    }
    return $h . '</tbody></table>';
}

function bloque_pdf($titulo, $nota, $contenido)
{
    return '<div class="bloque"><h2>' . esc_pdf($titulo) . '</h2>'
        . ($nota !== '' ? '<p class="nota">' . $nota . '</p>' : '') . $contenido . '</div>';
}

// Arma el HTML del reporte a partir de los datos de reporte_datos()
function reporte_html(array $d)
{
    $h = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
        @page { margin: 1.6cm 1.6cm 2.2cm 1.6cm; }
        body { font-family: Helvetica, Arial, sans-serif; font-size: 9.5pt; color: #111; }
        .iglesia { font-size: 8.5pt; color: #555; margin: 0; }
        h1 { font-size: 18pt; margin: 2pt 0 4pt 0; }
        .periodo { font-size: 9.5pt; margin: 0 0 12pt 0; color: #333; }
        table.resumen { width: 100%; border-collapse: collapse; margin-bottom: 6pt; }
        table.resumen td { border: 1px solid #d9d9d9; padding: 7pt; width: 25%; vertical-align: top; }
        table.resumen .n { font-size: 16pt; font-weight: bold; }
        table.resumen .l { font-size: 8pt; color: #555; }
        .bloque { margin-top: 12pt; }
        h2 { font-size: 12pt; border-bottom: 2px solid #111; padding-bottom: 3pt; margin: 0 0 6pt 0; }
        p.nota { font-size: 8.5pt; color: #555; margin: 0 0 6pt 0; }
        p.vacio { font-size: 9pt; color: #666; font-style: italic; margin: 4pt 0; }
        table.datos { width: 100%; border-collapse: collapse; }
        table.datos th { background: #111; color: #fff; text-align: left; font-size: 8.5pt; padding: 4pt 5pt; }
        table.datos td { border-bottom: 1px solid #e5e5e5; padding: 4pt 5pt; font-size: 9pt; vertical-align: top; }
        table.datos th.num, table.datos td.num { text-align: right; }
        table.mini { width: 100%; border-collapse: collapse; margin-bottom: 6pt; }
        table.mini td { border: 1px solid #d9d9d9; padding: 5pt; width: 25%; }
        .aviso { font-size: 8.5pt; margin: 0 0 6pt 0; }
    </style></head><body>';
    $h .= '<p class="iglesia">' . esc_pdf(IGLESIA_PDF) . '</p>';
    $h .= '<h1>Reporte general</h1>';
    $h .= '<p class="periodo">Período: <b>' . esc_pdf($d['periodo']) . '</b>. Generado el ' . esc_pdf($d['generado']) . '.</p>';

    if ($d['resumen']) {
        $h .= '<table class="resumen"><tr>';
        foreach ($d['resumen'] as $c) {
            $h .= '<td><div class="n">' . esc_pdf($c['n']) . '</div><div class="l">' . esc_pdf($c['l']) . '</div></td>';
        }
        $h .= '</tr></table>';
    }

    if ($d['comunion'] !== null) {
        $filas = [];
        foreach ($d['comunion']['reuniones'] as $r) {
            $filas[] = [esc_pdf($r['grupo']), esc_pdf(fecha_corta_es($r['fecha'])), esc_pdf($r['cantidad']), esc_pdf(dinero_cop($r['ofrenda']))];
        }
        $h .= bloque_pdf('Comunión Familiar',
            'Reuniones del período. Ofrenda acumulada: <b>' . esc_pdf(dinero_cop($d['comunion']['ofrenda'])) . '</b>.',
            tabla_pdf([['t' => 'Grupo'], ['t' => 'Fecha'], ['t' => 'Asistentes', 'num' => true], ['t' => 'Ofrenda', 'num' => true]],
                $filas, 'Sin reuniones en este período.'));
    }

    if ($d['actividades'] !== null) {
        $a = $d['actividades'];
        $filas = [];
        foreach ($a['filas'] as $f) {
            $filas[] = [esc_pdf($f['tipo']), esc_pdf($f['n']), esc_pdf($f['asistentes']), esc_pdf($f['promedio'] === null ? '—' : $f['promedio'])];
        }
        $nota = $a['total'] > 0
            ? 'Total del período: <b>' . esc_pdf($a['total']) . '</b> actividades y <b>' . esc_pdf($a['asistentes']) . '</b> asistentes.'
            : 'Sin actividades en este período.';
        $h .= bloque_pdf('Actividades generales', $nota,
            tabla_pdf([['t' => 'Tipo'], ['t' => 'Actividades', 'num' => true], ['t' => 'Asistentes', 'num' => true], ['t' => 'Promedio', 'num' => true]],
                $filas, 'Sin actividades en este período.'));
    }

    if ($d['pastoral'] !== null) {
        $p = $d['pastoral'];
        $mini = '<table class="mini"><tr>'
            . '<td><b>' . esc_pdf($p['casosPeriodo']) . '</b><br><span class="l">Casos abiertos en el período</span></td>'
            . '<td><b>' . esc_pdf($p['actosPeriodo']) . '</b><br><span class="l">Actuaciones en el período</span></td>'
            . '<td><b>' . esc_pdf($p['abiertos']) . '</b><br><span class="l">Casos abiertos (en total)</span></td>'
            . '<td><b>' . esc_pdf($p['vencidos']) . '</b><br><span class="l">Seguimientos vencidos</span></td>'
            . '</tr></table>';
        $filas = [];
        foreach ($p['porResponsable'] as $nombre => $n) {
            $filas[] = [esc_pdf($nombre), esc_pdf($n)];
        }
        $h .= bloque_pdf('Asistencia Pastoral', 'Resumen sin datos personales. Los casos se revisan en el módulo correspondiente.',
            $mini . tabla_pdf([['t' => 'Responsable'], ['t' => 'Actuaciones en el período', 'num' => true]], $filas, 'Sin actuaciones en este período.'));
    }

    if ($d['adiestramiento'] !== null) {
        $filas = [];
        foreach ($d['adiestramiento']['sesiones'] as $s) {
            $filas[] = [esc_pdf($s['curso']), esc_pdf(fecha_corta_es($s['fecha'])), esc_pdf($s['adiestrador']), esc_pdf($s['asistieron'])];
        }
        $h .= bloque_pdf('Adiestramiento', '',
            tabla_pdf([['t' => 'Curso'], ['t' => 'Fecha'], ['t' => 'Adiestrador'], ['t' => 'Asistieron', 'num' => true]],
                $filas, 'Sin sesiones en este período.'));
    }

    foreach (['nacidos' => ['Nacidos de nuevo (Bautizados)', 'Nadie en este período.'], 'pendientes' => ['Pendientes de bautismo', 'Ningún nacido de nuevo está pendiente de bautismo.']] as $clave => [$titulo, $vacio]) {
        if ($clave === 'nacidos') {
            if ($d['nacidos'] !== null || $d['bautizados'] !== null) {
                $mezcla = [];
                foreach ($d['nacidos'] ?? [] as $r) {
                    $mezcla[] = ['Nacido de nuevo', $r];
                }
                foreach ($d['bautizados'] ?? [] as $r) {
                    $mezcla[] = ['Bautizado', $r];
                }
                usort($mezcla, fn($a, $b) => strcmp($b[1]['fecha'], $a[1]['fecha']));
                $filas = [];
                foreach ($mezcla as [$tipo, $r]) {
                    $filas[] = [esc_pdf($r['persona']), esc_pdf($tipo), esc_pdf(fecha_corta_es($r['fecha']))];
                }
                $h .= bloque_pdf($titulo, '', tabla_pdf([['t' => 'Persona'], ['t' => 'Registro'], ['t' => 'Fecha']], $filas, $vacio));
            }
        } elseif ($d[$clave] !== null) {
            $filas = [];
            foreach ($d[$clave] as $r) {
                $filas[] = [esc_pdf($r['persona']), esc_pdf(fecha_corta_es($r['fecha']))];
            }
            $h .= bloque_pdf($titulo, '', tabla_pdf([['t' => 'Persona'], ['t' => 'Fecha']], $filas, $vacio));
        }
    }

    if ($d['finanzas'] !== null) {
        $f = $d['finanzas'];
        $h .= bloque_pdf('Finanzas', '', '<p class="aviso">Total del período: <b>' . esc_pdf(dinero_cop($f['total']))
            . '</b> en ' . esc_pdf($f['registros']) . ' ' . ($f['registros'] === 1 ? 'registro' : 'registros') . '.</p>');
    }
    if ($d['resumen'] === [] && $d['comunion'] === null && $d['actividades'] === null && $d['pastoral'] === null && $d['adiestramiento'] === null
        && $d['nacidos'] === null && $d['bautizados'] === null && $d['pendientes'] === null && $d['finanzas'] === null) {
        $h .= '<p class="aviso">Tu cargo no tiene secciones disponibles en este reporte.</p>';
    }
    // Secciones extra: cumpleaños del mes y lista de asistencia por persona
    if (!empty($d['extras'])) {
        foreach ($d['extras'] as $bloque) {
            $h .= seccion_bloque_pdf($bloque);
        }
    }
    return $h . '</body></html>';
}

// Convierte el HTML en PDF A4 con número de página en el pie
function reporte_pdf($html)
{
    $tmp = sys_get_temp_dir() . '/sigap-dompdf';
    if (!is_dir($tmp)) {
        @mkdir($tmp, 0700, true);
    }
    $opciones = new Dompdf\Options();
    $opciones->set('defaultFont', 'Helvetica');
    $opciones->set('isRemoteEnabled', false);
    $opciones->set('isPhpEnabled', false);
    $opciones->set('fontCache', $tmp);
    $opciones->set('tempDir', $tmp);
    $dompdf = new Dompdf\Dompdf($opciones);
    $dompdf->loadHtml($html, 'UTF-8');
    $dompdf->setPaper('A4', 'portrait');
    $dompdf->render();

    $lienzo = $dompdf->getCanvas();
    $metricas = $dompdf->getFontMetrics();
    $fuente = $metricas->getFont('Helvetica', 'normal');
    $y = $lienzo->get_height() - 34;
    $lienzo->page_text(57, $y, 'SIGAP · Documento de uso interno', $fuente, 8, [0.4, 0.4, 0.4]);
    $texto = 'Página {PAGE_NUM} de {PAGE_COUNT}';
    $ancho = $metricas->getTextWidth($texto, $fuente, 8);
    $lienzo->page_text($lienzo->get_width() - 57 - $ancho, $y, $texto, $fuente, 8, [0.4, 0.4, 0.4]);
    return $dompdf->output();
}

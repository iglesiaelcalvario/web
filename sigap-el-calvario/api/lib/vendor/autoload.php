<?php
/* Cargador de las bibliotecas de PDF (Dompdf y sus dependencias). Se generó a partir de sus composer.json; no editar a mano. */
spl_autoload_register(function ($clase) {
    static $psr4 = [
    'Dompdf\\' => ['dompdf/dompdf/src/'],
    'FontLib\\' => ['phenx/php-font-lib/src/FontLib/'],
    'Masterminds\\' => ['masterminds/html5/src/'],
    'Svg\\' => ['phenx/php-svg-lib/src/Svg/']
    ];
    static $mapa = [
    'Dompdf\\Cpdf' => 'dompdf/dompdf/lib/Cpdf.php'
    ];
    $base = __DIR__ . '/';
    if (isset($mapa[$clase])) {
        require $base . $mapa[$clase];
        return;
    }
    foreach ($psr4 as $prefijo => $dirs) {
        $n = strlen($prefijo);
        if (strncmp($clase, $prefijo, $n) === 0) {
            $rel = str_replace('\\', '/', substr($clase, $n)) . '.php';
            foreach ($dirs as $dir) {
                if (is_file($base . $dir . $rel)) {
                    require $base . $dir . $rel;
                    return;
                }
            }
        }
    }
});

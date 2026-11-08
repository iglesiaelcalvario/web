<?php
/* SIGAP · Utilidades de validación y formato.
   El servidor NO confía en lo que valida la página: aquí se vuelve a comprobar todo y se normalizan los textos. */
defined('SIGAP') or exit;

function leer_json($maximo = 200000)
{
    $crudo = file_get_contents('php://input');
    if ($crudo === false || $crudo === '') {
        return [];
    }
    if (strlen($crudo) > $maximo) {
        fallar(413, 'grande', 'La solicitud es demasiado grande.');
    }
    $d = json_decode($crudo, true);
    if (!is_array($d)) {
        fallar(400, 'json', 'El cuerpo de la solicitud no es un JSON válido.');
    }
    return $d;
}
function dato(array $d, $clave)
{
    return array_key_exists($clave, $d) ? $d[$clave] : null;
}
// Convierte cualquier valor recibido en texto limpio (sin caracteres de control)
function texto_basico($v)
{
    if (!is_string($v) && !is_int($v) && !is_float($v)) {
        return '';
    }
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string)$v);
    return $s === null ? '' : $s;
}
// Una sola línea: espacios repetidos se vuelven uno
function linea($v)
{
    $s = preg_replace('/\s+/u', ' ', texto_basico($v));
    return $s === null ? '' : trim($s);
}
// Varias líneas (descripciones, listas de nombres)
function bloque($v)
{
    return trim(str_replace(["\r\n", "\r"], "\n", texto_basico($v)));
}
function lineas($t)
{
    $out = [];
    foreach (explode("\n", bloque($t)) as $l) {
        $l = trim($l);
        if ($l !== '') {
            $out[] = $l;
        }
    }
    return $out;
}
function largo($s)
{
    return mb_strlen($s, 'UTF-8');
}
// Si el nombre viene todo en minúsculas o todo en mayúsculas lo deja con formato de nombre propio; si ya trae mezcla, lo respeta
function formato_nombre($t)
{
    $s = linea($t);
    if ($s !== '' && $s !== mb_strtolower($s, 'UTF-8') && $s !== mb_strtoupper($s, 'UTF-8')) {
        return $s;
    }
    $particulas = ['de', 'del', 'la', 'las', 'los', 'y', 'e'];
    $palabras = explode(' ', mb_strtolower($s, 'UTF-8'));
    foreach ($palabras as $i => $p) {
        if ($i > 0 && in_array($p, $particulas, true)) {
            continue;
        }
        $palabras[$i] = mb_strtoupper(mb_substr($p, 0, 1, 'UTF-8'), 'UTF-8') . mb_substr($p, 1, null, 'UTF-8');
    }
    return implode(' ', $palabras);
}
// Celular de 10 dígitos o fijo de 7 (con o sin +57); devuelve null si no es válido
function normalizar_telefono($t)
{
    $d = preg_replace('/\D/', '', texto_basico($t));
    if (strlen($d) === 12 && substr($d, 0, 2) === '57') {
        $d = substr($d, 2);
    }
    if (strlen($d) === 10) {
        return substr($d, 0, 3) . ' ' . substr($d, 3, 3) . ' ' . substr($d, 6);
    }
    if (strlen($d) === 7) {
        return substr($d, 0, 3) . ' ' . substr($d, 3);
    }
    return null;
}
function hoy()
{
    return date('Y-m-d');
}
function es_fecha($s)
{
    return is_string($s) && preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $s, $m) === 1 && checkdate((int)$m[2], (int)$m[3], (int)$m[1]);
}
// Devuelve un entero o null si el valor no es un número entero válido (acepta 5, 5.0 y "5")
function entero($v)
{
    if (is_int($v)) {
        return $v;
    }
    if (is_float($v)) {
        return (floor($v) == $v && abs($v) < 1.0e15) ? (int)$v : null;
    }
    if (is_string($v) && preg_match('/^-?\d{1,15}$/', trim($v)) === 1) {
        return (int)trim($v);
    }
    return null;
}
function id_de_url()
{
    $id = filter_var(isset($_GET['id']) ? $_GET['id'] : null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($id === false || $id === null) {
        fallar(400, 'id', 'Falta el identificador del registro.');
    }
    return $id;
}
// Valida una fecha opcional o requerida. Devuelve la fecha ('' si no hay) y agrega el error a $errores si corresponde
function fecha_campo(array &$errores, $campo, $valor, $requerida, $nombre, $minima = null)
{
    $f = linea($valor);
    if ($f === '') {
        if ($requerida) {
            $errores[] = ['campo' => $campo, 'texto' => 'Elige ' . $nombre . '.'];
        }
        return '';
    }
    if (!es_fecha($f)) {
        $errores[] = ['campo' => $campo, 'texto' => 'La fecha no es válida (' . $nombre . ').'];
        return '';
    }
    if ($f > hoy()) {
        $errores[] = ['campo' => $campo, 'texto' => 'La fecha no puede ser futura.'];
        return '';
    }
    return $f;
}

/* Helpers de la versión 3 */
function existe_persona($id)
{
    $st = bd()->prepare('SELECT 1 FROM personas WHERE id = ?');
    $st->execute([(int)$id]);
    return (bool)$st->fetchColumn();
}
function persona_con_funcion($id, $funcion)
{
    $st = bd()->prepare('SELECT 1 FROM persona_funciones pf JOIN funciones f ON f.id = pf.funcion_id WHERE pf.persona_id = ? AND f.clave = ?');
    $st->execute([(int)$id, $funcion]);
    return (bool)$st->fetchColumn();
}
function hora_valida($t)
{
    return is_string($t) && preg_match('/^([01]\d|2[0-3]):([0-5]\d)$/', $t) === 1;
}

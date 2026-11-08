<?php
/* api/personas.php  —  POST crear · PUT ?id= editar · DELETE ?id= eliminar   (módulo «registrar-personas») */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'registrar-personas';
const MSG_DUPLICADA = 'Ya hay una persona registrada con esos nombres, apellidos y fecha de cumpleaños.';
const MSG_IDENTIFICACION_REPETIDA = 'Ese número de identificación ya está registrado para otra persona.';
const CARGOS_IGLESIA = ['Pastor local', 'Asistencia Pastoral', 'Discipulador', 'Discípulo (miembro normal)'];
const GRUPOS_SANGUINEOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const TIPOS_IDENTIFICACION = ['CC', 'TI'];
const FOTO_MAX_BYTES = 2097152;

$metodo = solo_metodos(['POST', 'PUT', 'DELETE']);
$u = exigir_usuario();
exigir_csrf();

/* Identificador opcional: null si viene vacío; false si no es un número entero válido. */
function id_opcional($x)
{
    if ($x === null || $x === '') {
        return null;
    }
    return (is_int($x) || (is_string($x) && ctype_digit($x))) ? (int)$x : false;
}

function validar_persona(array $d, $idActual)
{
    $e = [];
    $nombres = formato_nombre(dato($d, 'nombres'));
    $apellidos = formato_nombre(dato($d, 'apellidos'));
    $nacimiento = linea(dato($d, 'nacimiento'));
    $telefonoCrudo = linea(dato($d, 'telefono'));
    $telefono = normalizar_telefono($telefonoCrudo);
    $correo = mb_strtolower(linea(dato($d, 'correo')), 'UTF-8');
    $eps = linea(dato($d, 'eps'));
    $direccion = linea(dato($d, 'direccion'));
    $telEmergenciaCrudo = linea(dato($d, 'telefonoEmergencia'));
    $telEmergencia = normalizar_telefono_emergencia($telEmergenciaCrudo);
    $nombreEmergencia = linea(dato($d, 'nombreEmergencia'));
    $bautizado = dato($d, 'bautizado') === true ? 1 : 0;
    $cargo = linea(dato($d, 'cargoIglesia'));
    $sangre = linea(dato($d, 'grupoSanguineo'));
    $tipoId = linea(dato($d, 'tipoIdentificacion'));
    $numeroId = preg_replace('/[\s.]+/', '', (string)dato($d, 'numeroIdentificacion'));
    $sedeId = id_opcional(dato($d, 'sedeId'));
    $grupoAdi = linea(dato($d, 'grupoAdiestramiento'));
    $nivelDisc = linea(dato($d, 'nivelDiscipulado'));
    $nivelAdi = linea(dato($d, 'nivelAdiestramiento'));
    $grupoCfId = id_opcional(dato($d, 'grupoCfId'));
    $grupoCfOriginal = id_opcional(dato($d, 'grupoCfOriginal'));
    if ($grupoCfOriginal === false) {
        $grupoCfOriginal = null;
    }

    if ($nombres === '') {
        $e[] = ['campo' => 'nombres', 'texto' => 'Escribe los nombres.'];
    } elseif (largo($nombres) > 80) {
        $e[] = ['campo' => 'nombres', 'texto' => 'Los nombres son demasiado largos (máximo 80 caracteres).'];
    }
    if ($apellidos === '') {
        $e[] = ['campo' => 'apellidos', 'texto' => 'Escribe los apellidos.'];
    } elseif (largo($apellidos) > 80) {
        $e[] = ['campo' => 'apellidos', 'texto' => 'Los apellidos son demasiado largos (máximo 80 caracteres).'];
    }
    if ($nacimiento === '') {
        $e[] = ['campo' => 'nacimiento', 'texto' => 'Elige la fecha de cumpleaños.'];
    } elseif (!es_fecha($nacimiento)) {
        $e[] = ['campo' => 'nacimiento', 'texto' => 'La fecha de cumpleaños no es válida.'];
    } elseif ($nacimiento > hoy()) {
        $e[] = ['campo' => 'nacimiento', 'texto' => 'La fecha de cumpleaños no puede ser futura.'];
    } elseif ($nacimiento < '1900-01-01') {
        $e[] = ['campo' => 'nacimiento', 'texto' => 'Revisa la fecha de cumpleaños: es demasiado antigua.'];
    }
    if ($telefonoCrudo === '') {
        $e[] = ['campo' => 'telefono', 'texto' => 'Escribe un teléfono de contacto.'];
    } elseif ($telefono === null) {
        $e[] = ['campo' => 'telefono', 'texto' => 'El teléfono no es válido: escribe 10 dígitos si es celular o 7 si es fijo.'];
    }
    if ($telEmergenciaCrudo === '') {
        $e[] = ['campo' => 'telefonoEmergencia', 'texto' => 'Escribe el número de contacto de emergencia.'];
    } elseif ($telEmergencia === null) {
        $e[] = ['campo' => 'telefonoEmergencia', 'texto' => 'El número de emergencia no es válido: escribe el celular colombiano de 10 dígitos (empieza por 3).'];
    }
    if ($nombreEmergencia !== '' && largo($nombreEmergencia) > 120) {
        $e[] = ['campo' => 'nombreEmergencia', 'texto' => 'El nombre del contacto es demasiado largo (máximo 120 caracteres).'];
    }
    if ($cargo !== '' && !in_array($cargo, CARGOS_IGLESIA, true)) {
        $e[] = ['campo' => 'cargoIglesia', 'texto' => 'El cargo elegido no es válido.'];
    }
    if ($sangre !== '' && !in_array($sangre, GRUPOS_SANGUINEOS, true)) {
        $e[] = ['campo' => 'grupoSanguineo', 'texto' => 'El grupo sanguíneo no es válido.'];
    }
    // Tipo y número de identificación: van juntos
    if ($tipoId !== '' && !in_array($tipoId, TIPOS_IDENTIFICACION, true)) {
        $e[] = ['campo' => 'tipoIdentificacion', 'texto' => 'El tipo de identificación no es válido.'];
    }
    if ($tipoId !== '' && $numeroId === '') {
        $e[] = ['campo' => 'numeroIdentificacion', 'texto' => 'Escribe el número de identificación.'];
    }
    if ($tipoId === '' && $numeroId !== '') {
        $e[] = ['campo' => 'tipoIdentificacion', 'texto' => 'Elige el tipo de identificación.'];
    }
    if ($numeroId !== '' && (!ctype_digit($numeroId) || strlen($numeroId) < 6 || strlen($numeroId) > 11)) {
        $e[] = ['campo' => 'numeroIdentificacion', 'texto' => 'El número de identificación debe tener entre 6 y 11 dígitos, sin letras.'];
    } elseif ($numeroId !== '') {
        $st = bd()->prepare('SELECT id FROM personas WHERE numero_identificacion = ? AND id <> ? LIMIT 1');
        $st->execute([$numeroId, (int)$idActual]);
        if ($st->fetch()) {
            $e[] = ['campo' => 'numeroIdentificacion', 'texto' => MSG_IDENTIFICACION_REPETIDA];
        }
    }
    foreach ([['grupoAdiestramiento', $grupoAdi, 'El Grupo de Adiestramiento'],
              ['nivelDiscipulado', $nivelDisc, 'El nivel de discipulado'],
              ['nivelAdiestramiento', $nivelAdi, 'El nivel de adiestramiento']] as [$campo, $valor, $nombreCampo]) {
        if (largo($valor) > 80) {
            $e[] = ['campo' => $campo, 'texto' => $nombreCampo . ' es demasiado largo (máximo 80 caracteres).'];
        }
    }
    if ($sedeId === false) {
        $e[] = ['campo' => 'sedeId', 'texto' => 'La sede elegida no es válida.'];
    } elseif ($sedeId !== null) {
        // Una sede inactiva solo se conserva si ya es la sede de la persona
        $sa = null;
        if ($idActual) {
            $q = bd()->prepare('SELECT sede_id FROM personas WHERE id = ?');
            $q->execute([(int)$idActual]);
            $sa = $q->fetchColumn();
            $sa = ($sa === false || $sa === null) ? null : (int)$sa;
        }
        if ($sedeId !== $sa) {
            $st = bd()->prepare('SELECT id FROM sedes WHERE id = ? AND activo = 1');
            $st->execute([$sedeId]);
            if (!$st->fetch()) {
                $e[] = ['campo' => 'sedeId', 'texto' => 'La sede elegida no existe o está inactiva.'];
            }
        }
    }
    if ($grupoCfId === false) {
        $e[] = ['campo' => 'grupoCfId', 'texto' => 'El grupo de comunión familiar no es válido.'];
    } elseif ($grupoCfId !== null && $grupoCfId !== $grupoCfOriginal) {
        // Un grupo nuevo debe estar activo; si es el que ya tenía, no se valida otra vez
        $st = bd()->prepare("SELECT id FROM grupos WHERE id = ? AND estado = 'Activo'");
        $st->execute([$grupoCfId]);
        if (!$st->fetch()) {
            $e[] = ['campo' => 'grupoCfId', 'texto' => 'El grupo de comunión familiar elegido no existe o está inactivo.'];
        }
    }
    $foto = null; $fotoTipo = null;
    $fotoCruda = dato($d, 'foto');
    if (is_string($fotoCruda) && $fotoCruda !== '') {
        $leida = leer_foto_dataurl($fotoCruda);
        if ($leida === null) {
            $e[] = ['campo' => 'foto', 'texto' => 'La foto debe ser JPG, PNG o WEBP y pesar máximo 2 MB.'];
        } else {
            [$foto, $fotoTipo] = $leida;
        }
    }
    if ($correo !== '' && (largo($correo) > 120 || preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u', $correo) !== 1)) {
        $e[] = ['campo' => 'correo', 'texto' => 'El correo no es válido. Ejemplo: nombre@correo.com.'];
    }
    if (largo($eps) > 60) {
        $e[] = ['campo' => 'eps', 'texto' => 'La EPS es demasiado larga (máximo 60 caracteres).'];
    }
    if (largo($direccion) > 160) {
        $e[] = ['campo' => 'direccion', 'texto' => 'La dirección es demasiado larga (máximo 160 caracteres).'];
    }
    if (!$e) {   // duplicado: mismos nombres, apellidos y cumpleaños (la base compara sin distinguir mayúsculas ni tildes)
        $st = bd()->prepare('SELECT id FROM personas WHERE nombres = ? AND apellidos = ? AND nacimiento = ? AND id <> ? LIMIT 1');
        $st->execute([$nombres, $apellidos, $nacimiento, (int)$idActual]);
        if ($st->fetch()) {
            $e[] = ['campo' => 'nombres', 'texto' => MSG_DUPLICADA];
        }
    }
    if ($e) {
        fallar_validacion($e);
    }
    return [
        'nombres' => $nombres, 'apellidos' => $apellidos, 'nacimiento' => $nacimiento, 'telefono' => $telefono,
        'correo' => $correo, 'eps' => $eps, 'direccion' => $direccion,
        'telefono_emergencia' => $telEmergencia, 'nombre_emergencia' => $nombreEmergencia === '' ? null : $nombreEmergencia,
        'bautizado' => $bautizado, 'cargo_iglesia' => $cargo === '' ? null : $cargo,
        'grupo_sanguineo' => $sangre === '' ? null : $sangre,
        'tipo_identificacion' => $tipoId === '' ? null : $tipoId,
        'numero_identificacion' => $numeroId === '' ? null : $numeroId,
        'sede_id' => is_int($sedeId) ? $sedeId : null,
        'grupo_adiestramiento' => $grupoAdi === '' ? null : $grupoAdi,
        'nivel_discipulado' => $nivelDisc === '' ? null : $nivelDisc,
        'nivel_adiestramiento' => $nivelAdi === '' ? null : $nivelAdi,
        'foto' => $foto, 'foto_tipo' => $fotoTipo, 'quitar_foto' => !empty(dato($d, 'quitarFoto')),
        'grupo_cf_id' => is_int($grupoCfId) ? $grupoCfId : null,
        'grupo_cf_original' => $grupoCfOriginal,
    ];
}

/* Un duplicado de la base: distingue si choca la persona o el número de identificación. */
function campo_duplicado(PDOException $ex)
{
    if (strpos($ex->getMessage(), 'uq_personas_identificacion') !== false) {
        return [['campo' => 'numeroIdentificacion', 'texto' => MSG_IDENTIFICACION_REPETIDA]];
    }
    return [['campo' => 'nombres', 'texto' => MSG_DUPLICADA]];
}

if ($metodo === 'POST') {
    exigir_permiso($u, MODULO, 'registrar', 'Solo el administrador puede registrar personas.');
    $cuerpo = leer_json(3600000);   // cabe una foto de 2 MB en texto (base64)
    $c = validar_persona($cuerpo, 0);
    $funcs = funciones_validas($cuerpo);
    exigir_permiso_grupos_cf($u, $c['grupo_cf_id'], null);
    try {
        $st = bd()->prepare('INSERT INTO personas (nombres, apellidos, nacimiento, telefono, correo, eps, direccion,
                             telefono_emergencia, nombre_emergencia, bautizado, cargo_iglesia, grupo_sanguineo,
                             tipo_identificacion, numero_identificacion, sede_id, grupo_adiestramiento,
                             nivel_discipulado, nivel_adiestramiento, foto, foto_tipo, registrada, creado_por)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $st->execute([$c['nombres'], $c['apellidos'], $c['nacimiento'], $c['telefono'], $c['correo'], $c['eps'],
                      $c['direccion'], $c['telefono_emergencia'], $c['nombre_emergencia'], $c['bautizado'],
                      $c['cargo_iglesia'], $c['grupo_sanguineo'], $c['tipo_identificacion'], $c['numero_identificacion'],
                      $c['sede_id'], $c['grupo_adiestramiento'], $c['nivel_discipulado'], $c['nivel_adiestramiento'],
                      $c['foto'], $c['foto_tipo'], hoy(), $u['id']]);
    } catch (PDOException $ex) {
        if (codigo_mysql($ex) === 1062) {
            fallar_validacion(campo_duplicado($ex));
        }
        throw $ex;
    }
    $nuevo = (int)bd()->lastInsertId();
    sincronizar_funciones($nuevo, $funcs === null ? [] : $funcs);
    sincronizar_grupo_cf($nuevo, $c['grupo_cf_id'], null);
    auditar($u, 'crear', 'personas', $nuevo, $c['nombres'] . ' ' . $c['apellidos']);
    responder(201, ['num' => $nuevo]);
}

$id = null;
if ($metodo === 'PUT') {
    exigir_permiso($u, MODULO, 'editar', 'Solo el administrador puede editar personas.');
} else {
    exigir_permiso($u, MODULO, 'eliminar', 'Solo el administrador puede eliminar personas.');
}
$id = id_de_url();
$st = bd()->prepare('SELECT id FROM personas WHERE id = ?');
$st->execute([$id]);
if (!$st->fetch()) {
    fallar(404, 'no_existe', 'La persona no existe.');
}

if ($metodo === 'PUT') {
    $cuerpo = leer_json(3600000);
    $c = validar_persona($cuerpo, $id);
    $funcs = funciones_validas($cuerpo);
    if ($funcs !== null) {
        quitar_funcion_bloqueada($id, $funcs);
    }
    // Solo cambia el grupo de comunión familiar si el formulario lo trae
    $cambiaGrupo = array_key_exists('grupoCfId', $cuerpo);
    if ($cambiaGrupo) {
        exigir_permiso_grupos_cf($u, $c['grupo_cf_id'], $c['grupo_cf_original']);
    }
    $campos = [
        'nombres' => $c['nombres'], 'apellidos' => $c['apellidos'], 'nacimiento' => $c['nacimiento'],
        'telefono' => $c['telefono'], 'correo' => $c['correo'], 'eps' => $c['eps'], 'direccion' => $c['direccion'],
        'telefono_emergencia' => $c['telefono_emergencia'], 'nombre_emergencia' => $c['nombre_emergencia'],
        'bautizado' => $c['bautizado'], 'cargo_iglesia' => $c['cargo_iglesia'], 'grupo_sanguineo' => $c['grupo_sanguineo'],
        'tipo_identificacion' => $c['tipo_identificacion'], 'numero_identificacion' => $c['numero_identificacion'],
        'sede_id' => $c['sede_id'], 'grupo_adiestramiento' => $c['grupo_adiestramiento'],
        'nivel_discipulado' => $c['nivel_discipulado'], 'nivel_adiestramiento' => $c['nivel_adiestramiento'],
    ];
    if ($c['foto'] !== null) {
        $campos['foto'] = $c['foto'];
        $campos['foto_tipo'] = $c['foto_tipo'];
    } elseif ($c['quitar_foto']) {
        $campos['foto'] = null;
        $campos['foto_tipo'] = null;
    }
    $sets = implode(', ', array_map(function ($k) { return $k . ' = ?'; }, array_keys($campos)));
    $params = array_values($campos);
    $params[] = $id;
    try {
        $st = bd()->prepare('UPDATE personas SET ' . $sets . ' WHERE id = ?');
        $st->execute($params);
    } catch (PDOException $ex) {
        if (codigo_mysql($ex) === 1062) {
            fallar_validacion(campo_duplicado($ex));
        }
        throw $ex;
    }
    if ($funcs !== null) {
        sincronizar_funciones($id, $funcs);
    }
    if ($cambiaGrupo) {
        sincronizar_grupo_cf($id, $c['grupo_cf_id'], $c['grupo_cf_original']);
    }
    auditar($u, 'editar', 'personas', $id, $c['nombres'] . ' ' . $c['apellidos']);
    responder(200, ['num' => $id]);
}

// DELETE: no se borra a quien ya tiene historial de asistencia
$st = bd()->prepare('SELECT COUNT(*) FROM asistencias WHERE persona_id = ?');
$st->execute([$id]);
if ((int)$st->fetchColumn() > 0) {
    fallar(409, 'dependencias', 'Esta persona ya tiene asistencias registradas: no se puede eliminar para no perder el historial.');
}
try {
    bd()->prepare('DELETE FROM personas WHERE id = ?')->execute([$id]);
} catch (PDOException $ex) {
    if (codigo_mysql($ex) === 1451) {
        fallar(409, 'dependencias', 'Esta persona está vinculada a grupos, reuniones, adiestramiento, asistencia pastoral o registros de nacido de nuevo y bautismo: no se puede eliminar.');
    }
    throw $ex;
}
auditar($u, 'eliminar', 'personas', $id, '');
responder(200, ['ok' => true]);

/* Grupo de comunión familiar: cambiarlo requiere el permiso de Comunión Familiar. */
function exigir_permiso_grupos_cf($u, $nuevo, $original)
{
    if ($nuevo === $original) {
        return;
    }
    if (!tiene_permiso($u, 'comunion-familiar', 'editar')) {
        fallar(403, 'permiso', 'No tienes permiso para cambiar el grupo de comunión familiar.');
    }
}

/* Sincroniza la membresía del grupo de comunión familiar (una sola: la que elige el formulario).
   Si no cambió el grupo, no toca nada: así no se quita a nadie de otros grupos por editar otro dato. */
function sincronizar_grupo_cf($pid, $nuevo, $original)
{
    if ($nuevo === $original) {
        return;
    }
    $pdo = bd();
    if ($nuevo === null) {
        $pdo->prepare('DELETE FROM grupo_participantes WHERE persona_id = ?')->execute([(int)$pid]);
        return;
    }
    $pdo->prepare('DELETE FROM grupo_participantes WHERE persona_id = ? AND grupo_id <> ?')->execute([(int)$pid, $nuevo]);
    $pdo->prepare('INSERT IGNORE INTO grupo_participantes (grupo_id, persona_id, desde) VALUES (?, ?, ?)')
        ->execute([$nuevo, (int)$pid, hoy()]);
}

/* Funciones de la persona (discipulador, adiestrador). null = el cuerpo no las trae: no se cambian. */
function funciones_validas($d)
{
    if (!array_key_exists('funciones', $d)) {
        return null;
    }
    if (!is_array($d['funciones'])) {
        fallar_validacion([['campo' => 'funciones', 'texto' => 'Las funciones no son válidas.']]);
    }
    $out = [];
    foreach ($d['funciones'] as $x) {
        $x = linea($x);
        if (!in_array($x, ['discipulador', 'adiestrador'], true)) {
            fallar_validacion([['campo' => 'funciones', 'texto' => 'Una de las funciones no existe.']]);
        }
        if (!in_array($x, $out, true)) {
            $out[] = $x;
        }
    }
    return $out;
}
function sincronizar_funciones($pid, array $lista)
{
    $pdo = bd();
    $pdo->prepare('DELETE FROM persona_funciones WHERE persona_id = ?')->execute([(int)$pid]);
    $st = $pdo->prepare('INSERT INTO persona_funciones (persona_id, funcion_id) SELECT ?, id FROM funciones WHERE clave = ?');
    foreach ($lista as $k) {
        $st->execute([(int)$pid, $k]);
    }
}
// No se quita la función de discipulador a quien todavía es responsable de algún grupo
function quitar_funcion_bloqueada($pid, array $nuevas)
{
    $st = bd()->prepare("SELECT COUNT(*) FROM persona_funciones pf JOIN funciones f ON f.id = pf.funcion_id WHERE pf.persona_id = ? AND f.clave = 'discipulador'");
    $st->execute([(int)$pid]);
    $tenia = (int)$st->fetchColumn() > 0;
    if ($tenia && !in_array('discipulador', $nuevas, true)) {
        $g = bd()->prepare('SELECT COUNT(*) FROM grupos WHERE discipulador_persona_id = ?');
        $g->execute([(int)$pid]);
        if ((int)$g->fetchColumn() > 0) {
            fallar_validacion([['campo' => 'funciones', 'texto' => 'Esta persona es discipulador responsable de uno o más grupos. Primero asigna esos grupos a otro discipulador.']]);
        }
    }
}

/* Teléfono de emergencia: 10 dígitos de celular colombiano (empieza por 3). Acepta +57 delante. */
function normalizar_telefono_emergencia($x)
{
    $d = preg_replace('/\D+/', '', (string)$x);
    if (strlen($d) === 12 && substr($d, 0, 2) === '57') {
        $d = substr($d, 2);
    }
    return (strlen($d) === 10 && $d[0] === '3') ? $d : null;
}

/* Foto en data URL (JPG, PNG o WEBP, máximo 2 MB). Devuelve [bytes, tipo] o null si no es válida. */
function leer_foto_dataurl($s)
{
    if (!preg_match('#^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$#', $s, $m)) {
        return null;
    }
    $bin = base64_decode(preg_replace('/\s+/', '', $m[2]), true);
    if ($bin === false || $bin === '' || strlen($bin) > FOTO_MAX_BYTES) {
        return null;
    }
    $info = @getimagesizefromstring($bin);
    if (!$info || $info['mime'] !== $m[1]) {
        return null;
    }
    return [$bin, $m[1]];
}

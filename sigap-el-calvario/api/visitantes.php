<?php
/* api/visitantes.php  —  PUT ?id= vincula un visitante a una persona ya registrada (evita duplicados). */
define('SIGAP', true);
require __DIR__ . '/lib/nucleo.php';
require __DIR__ . '/lib/util.php';

const MODULO = 'comunion-familiar';

solo_metodos(['PUT']);
$u = exigir_usuario();
exigir_csrf();
exigir_permiso($u, MODULO, 'registrar', 'Tu cargo no puede vincular visitantes.');

$id = id_de_url();
$st = bd()->prepare('SELECT v.id, g.discipulador_persona_id FROM reunion_visitantes v
                     JOIN reuniones r ON r.id = v.reunion_id JOIN grupos g ON g.id = r.grupo_id WHERE v.id = ?');
$st->execute([$id]);
$v = $st->fetch();
if (!$v) {
    fallar(404, 'no_existe', 'El visitante no existe.');
}
if ($u['rol'] === 'discipulador' && (int)$v['discipulador_persona_id'] !== (isset($u['persona_id']) ? (int)$u['persona_id'] : 0)) {
    fallar(403, 'prohibido', 'Ese visitante no pertenece a un grupo a tu cargo.');
}
$pid = entero(dato(leer_json(), 'personaId'));
if ($pid === null || $pid <= 0 || !existe_persona($pid)) {
    fallar_validacion([['campo' => 'personaId', 'texto' => 'Elige la persona registrada a la que corresponde este visitante.']]);
}
bd()->prepare('UPDATE reunion_visitantes SET persona_id = ? WHERE id = ?')->execute([$pid, $id]);
auditar($u, 'editar', 'visitantes', $id, 'vinculado a la persona ' . $pid);
responder(200, ['id' => $id]);

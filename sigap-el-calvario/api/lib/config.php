<?php
/* SIGAP · Configuración.
   Con XAMPP recién instalado NO hace falta cambiar nada aquí.
   Solo toca estos valores si cambiaste la contraseña de MySQL, usas otro puerto, etc. */
defined('SIGAP') or exit;

return [
    'bd' => [
        'host'    => '127.0.0.1',
        'puerto'  => 3306,
        'nombre'  => 'sigap',
        'usuario' => 'root',
        'clave'   => '',          // XAMPP deja a «root» sin contraseña
        'charset' => 'utf8mb4',
    ],
    'zona_horaria'        => 'America/Bogota',
    'sesion_nombre'       => 'SIGAPSESSID',
    'inactividad_minutos' => 120,    // la sesión se cierra tras este tiempo sin usar la página
    'max_intentos_login'  => 5,      // intentos fallidos seguidos antes de bloquear el ingreso
    'minutos_bloqueo'     => 15,
    'depurar'             => false,  // true muestra el detalle técnico de los errores (solo mientras desarrollas)
];

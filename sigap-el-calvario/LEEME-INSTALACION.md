# SIGAP · Versión 28 (módulo Sedes)

> **Importante:** esta versión **sí cambia la base de datos**. Si vienes de la **versión 27**, ejecuta una sola vez `database/migracion_v27_a_v28.sql` en phpMyAdmin, después de hacer una copia de la base. La migración puede repetirse sin dañar nada y no borra ni cambia las sedes que ya tienes. Si instalas desde cero, importa `database/sigap.sql`.

## Qué cambió

- **Módulo Sedes (nuevo)** en el menú, con cuatro secciones:
  - **Crear Sede:** nombre, dirección, barrio y departamento. El país (Colombia) y la ciudad (Villavicencio) vienen fijos.
  - **Consultar sede:** un desplegable con todas las sedes, activas e inactivas. Al elegir una, se ve toda su información y un recuadro con su ubicación en Google Maps.
  - **Actualizar sede:** un desplegable con todas las sedes. Al elegir una, se abre para editar. Aquí también se puede reactivar una sede.
  - **Inactivar sede:** la lista de sedes, con un botón **Inactivar** al lado de cada nombre. Antes de inactivar, pide confirmar.
- **Quién lo usa:** por defecto, solo el administrador. Para dar el módulo a otro cargo, se hace en **Usuarios y accesos**.
- **Registrar personas:** una persona que ya tiene una sede inactiva la conserva. Las sedes inactivas no se ofrecen para personas nuevas.
- El mapa de Google no necesita clave: se muestra con el enlace de búsqueda de cada sede. Necesita conexión a internet.

## Antes de usar el módulo

- **Barrios:** la lista de barrios de la base es de **ejemplo** (Centro, Barzal, La Esperanza, Ciudadela Llanocentro, Porfía). Para cambiarla, edita la tabla `barrios` en phpMyAdmin. Para dejar de ofrecer un barrio, pon `activo` = 0.
- **Departamentos:** ya están los 32 departamentos de Colombia y Bogotá, D.C.
- **Sede principal:** la sede que venía de antes no tiene dirección. Ábrela en **Actualizar sede** para completar sus datos.

## Pendiente de confirmar con la iglesia

- La lista oficial de barrios de Villavicencio.
- El nombre y la dirección de cada sede.
- Si el asistente pastor también debe poder crear o editar sedes.
- Las actividades generales en el listado de asistencia por persona.
- Las cuentas de prueba siguen visibles en la pantalla de ingreso, por decisión de la coordinadora, hasta la entrega final.

# SIGAP · Instalación con XAMPP (PHP + MySQL)

Iglesia Cristiana El Calvario · Sistema de Información para la Gestión Administrativa y Pastoral

---

## 1. Requisitos

- **XAMPP** (PHP 7.4 o superior, MySQL/MariaDB). Descárgalo de https://www.apachefriends.org
- Un navegador moderno (Chrome, Edge o Firefox).

---

## 2. Colocar el proyecto

1. Copia la carpeta **`sigap-el-calvario`** dentro de la carpeta **`htdocs`** de XAMPP:
   - Windows: `C:\xampp\htdocs\sigap-el-calvario`
   - Mac: `/Applications/XAMPP/htdocs/sigap-el-calvario`
2. Si quieres el logo de la iglesia, guarda la imagen como `logo-el-calvario.png` dentro de esa carpeta.

---

## 3. Encender los servicios

Abre el **panel de control de XAMPP** y pulsa **Start** en:

- **Apache**
- **MySQL**

Las dos luces deben quedar en verde.

---

## 4. Crear la base de datos

1. Abre en el navegador: **http://localhost/phpmyadmin**
2. Ve a la pestaña **Importar**.
3. Pulsa **Seleccionar archivo** y elige **`database/sigap.sql`** (dentro de la carpeta del proyecto).
4. Pulsa **Continuar** (o **Go**) al final de la página.

Eso crea la base de datos **`sigap`** con sus tablas, los roles, los permisos y los datos de ejemplo.
Si ya existía una base `sigap`, el script la **reemplaza** (cuidado: borra los datos que tuvieras).

Comprueba con la pestaña **SQL** de phpMyAdmin:

```sql
SELECT * FROM v_permisos;
```

Debes ver una tabla con cada cargo, cada módulo y sus acciones permitidas.

---

## 5. Abrir el sistema

Entra a: **http://localhost/sigap-el-calvario/**

Cuentas de prueba (cámbialas antes de usar el sistema de verdad):

| Cargo | Usuario | Contraseña |
|---|---|---|
| Administrador | `admin` | `admin123` |
| Pastor | `pastor` | `pastor123` |
| Asistente Pastor | `asistente` | `asist123` |
| Discipulador | `discipulador` | `disc123` |

Para comprobar que la API y la base responden, abre **http://localhost/sigap-el-calvario/api/estado.php**.
Debe decir `"servidor":"ok"` y `"baseDeDatos":"ok"`.

---

## 6. Si algo no funciona

| Qué ves | Qué hacer |
|---|---|
| "No se encontró el servidor" | Abre la página **desde http://localhost** (no con doble clic en el archivo). Revisa que Apache esté en verde. |
| "No existe la base de datos «sigap»" | Repite el paso 4 (importar `database/sigap.sql`). |
| "No se pudo conectar con MySQL" | Pulsa **Start** en MySQL en el panel de XAMPP. |
| "MySQL rechazó el usuario o la contraseña" | En XAMPP `root` no tiene contraseña. Si la cambiaste, escríbela en `api/lib/config.php`, campo `clave`. |
| "A la base le faltan tablas" | Vuelve a importar `database/sigap.sql`. |
| Error 500 sin más detalle | Mira el registro de errores de Apache: `C:\xampp\apache\logs\error.log`. Para ver el detalle en pantalla, pon `'depurar' => true` en `api/lib/config.php` (solo mientras desarrollas). |

---

## 7. Configuración (`api/lib/config.php`)

Con XAMPP recién instalado **no hace falta cambiar nada**. Solo toca este archivo si:

- cambiaste la contraseña de MySQL (`clave`),
- usas otro puerto (`puerto`),
- quieres ver el detalle de los errores (`depurar`).

---

## 8. Seguridad antes de usarlo de verdad

- Cambia las contraseñas de las cuentas de prueba (con la pestaña **Usuarios** de phpMyAdmin, o pidiéndole a quien desarrolló el sistema que lo haga).
- En `js/app.js`, cambia la constante `MOSTRAR_CUENTAS_PRUEBA` a `false` para ocultar las cuentas de prueba de la pantalla de inicio.
- Crea un usuario de MySQL propio en vez de usar `root` (instrucciones comentadas al final de `database/sigap.sql`).
- Si la iglesia lo va a publicar en internet, la página debe servirse con **HTTPS**.

---

## 9. Estructura del proyecto

```
sigap-el-calvario/
├── index.html            Página principal (pantallas)
├── css/styles.css        Estilos
├── js/app.js             Lógica de la página; habla con la API
├── api/                  API en PHP (lo que consulta la página)
│   ├── login.php         Iniciar sesión
│   ├── logout.php        Cerrar sesión
│   ├── sesion.php        ¿Hay sesión iniciada?
│   ├── estado.php        Revisión de PHP y MySQL
│   ├── datos.php         Datos que el cargo puede ver
│   ├── personas.php      Registrar / editar / eliminar personas
│   ├── grupos.php        Grupos de Comunión Familiar
│   ├── reuniones.php     Reuniones de cada grupo
│   ├── asistencia_pastoral.php    Casos y su historial de Asistencia Pastoral
│   ├── categorias_pastorales.php  Categorías de situación pastoral
│   ├── sesiones.php           Sesiones de Adiestramiento (y adiestramiento.php: adiestrador habitual e inscripciones)
│   ├── finanzas.php
│   ├── nacidos_bautizados.php  Nacidos de nuevo y bautismos (registros propios)
│   └── lib/              Núcleo: conexión, sesión, permisos, validación
└── database/
    └── sigap.sql         Base de datos completa (tablas, permisos y datos de ejemplo)
```

## 10. Cómo se controlan los permisos

Cada cargo tiene **acciones** permitidas en cada **módulo**. Esa relación vive en la tabla `permisos`
de la base de datos (`rol → módulo → acción`). **Cada petición a la API** consulta esa tabla antes de
hacer algo: aunque alguien manipule la página, el servidor responde **403 Prohibido**.

Para cambiar qué puede hacer un cargo, no hace falta tocar el código: basta con agregar o quitar una fila
en la tabla `permisos`. Puedes verla con `SELECT * FROM v_permisos;`.

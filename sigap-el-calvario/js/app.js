// SIGAP · lógica de la interfaz. index.html carga este archivo al final del <body>.
(() => {
'use strict';

/* =====================================================================
   SIGAP · Iglesia Cristiana El Calvario
   Esta página habla con la API en PHP (carpeta api/), que usa la base de datos MySQL.
   Los datos y los permisos ya NO viven en el navegador: se piden al servidor al iniciar
   sesión y cada cambio se envía a la API, que lo valida de nuevo.
   ===================================================================== */

const IGLESIA = 'Iglesia Cristiana El Calvario';
const TITULO_BASE = document.title;
const LOGO_ARCHIVO = 'logo-el-calvario.png'; // logo real: guárdalo con este nombre en la misma carpeta que index.html

/* ---------- Utilidades ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // fecha local, no UTC
const haceDias = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const enDias = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); }; // fecha futura (para próximos seguimientos)
const hoyISO = () => iso(new Date());
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaCorta = f => `${Number(f.slice(8, 10))} ${MESES[Number(f.slice(5, 7)) - 1].slice(0, 3)}`;      // 13 sep
const fechaNum = f => `${f.slice(8, 10)}/${f.slice(5, 7)}`;                                                // 13/09
const fechaLarga = f => `${Number(f.slice(8, 10))} de ${MESES[Number(f.slice(5, 7)) - 1]} de ${f.slice(0, 4)}`; // 13 de septiembre de 2026
const edad = f => {
  const [a, m, d] = f.split('-').map(Number), h = new Date();
  let anios = h.getFullYear() - a;
  if (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d)) anios--;
  return anios;
};
const textoEdad = n => (n < 1 ? 'menos de 1 año' : n === 1 ? '1 año' : `${n} años`);
const norm = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const primerNombre = t => String(t).trim().split(/\s+/)[0];
const nombreCompleto = p => `${p.nombres} ${p.apellidos}`;
const listaY = a => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} y ${a[a.length - 1]}`);
const soloDigitos = t => String(t ?? '').replace(/\D/g, '');
const telHref = t => { const d = soloDigitos(t); return d.length === 10 ? `+57${d}` : d; };

/* ---------- Cargos: solo los de la iglesia, más el administrador del sistema ---------- */
const ROLES = { admin: 'Administrador', pastor: 'Pastor', asistente: 'Asistente Pastor', discipulador: 'Discipulador' };
const TODOS = Object.keys(ROLES);

// Cuentas de prueba que se muestran en la pantalla de inicio de sesión (existen en la base de datos que trae database/sigap.sql).
// En una instalación real pon MOSTRAR_CUENTAS_PRUEBA en false para ocultarlas.
const MOSTRAR_CUENTAS_PRUEBA = true;
const DEMO = [
  { rol: 'Administrador',    usuario: 'admin',        clave: 'admin123' },
  { rol: 'Pastor',           usuario: 'pastor',       clave: 'pastor123' },
  { rol: 'Asistente Pastor', usuario: 'asistente',    clave: 'asist123' },
  { rol: 'Discipulador',     usuario: 'discipulador', clave: 'disc123' },
];

/* =====================================================================
   CAMPOS DEL SISTEMA Y ACCESO POR CARGO
   listo: true  → el campo ya está construido.
   listo: false → aparece en el Inicio como «Próximamente».
   ===================================================================== */
const CAMPOS = [
  { id: 'registrar-personas',  titulo: 'Registrar personas',  icono: 'usuarioMas', roles: [], listo: true,
    desc: 'Registra a una persona nueva con sus datos. Al guardarla se añade a la lista de asistencia.' },
  { id: 'lista-asistencia',    titulo: 'Lista de asistencia', icono: 'lista',      roles: [], listo: true,
    desc: 'Control de asistencia de cada persona registrada.' },
  { id: 'ficha-persona', titulo: 'Ficha de persona', icono: 'ficha', roles: [], listo: true,
    desc: 'Busca a una persona y revisa su historial: grupos, asistencia, cursos, seguimientos y registros espirituales.' },
  { id: 'comunion-familiar',   titulo: 'Comunión Familiar',   icono: 'grupo',      roles: [], listo: true,
    desc: 'Grupos de Comunión Familiar: casa, anfitrión, discipulador responsable y las reuniones de cada grupo.' },
  { id: 'grupos', titulo: 'Grupos', icono: 'grupo', roles: [], listo: true,
    desc: 'Crea, consulta, edita e inactiva los grupos de la congregación: Comunión Familiar, Adiestramiento y otros grupos.' },
  { id: 'sedes', titulo: 'Sedes', icono: 'ubicacion', roles: [], listo: true,
    desc: 'Crea, consulta, actualiza e inactiva las sedes de la congregación en Villavicencio, Meta.' },
  { id: 'asistencia-pastoral', titulo: 'Asistencia Pastoral', icono: 'corazon',    roles: [], listo: true,
    desc: 'Acompañamientos pastorales: a quién, por qué motivo, qué se hizo y su seguimiento.' },
  { id: 'adiestramiento',      titulo: 'Adiestramiento',      icono: 'libro',      roles: [], listo: true,
    desc: 'Cursos de Adiestramiento, sus participantes y el registro de cada sesión con su adiestrador y sus asistentes.' },
  { id: 'finanzas',            titulo: 'Finanzas',            icono: 'moneda',     roles: [], listo: true,
    desc: 'Ofrendas, diezmos, primicias y siembras, con su reporte mensual.' },
  { id: 'tomar-asistencia',    titulo: 'Tomar asistencia',    icono: 'chequeo',    roles: [], listo: true,
    desc: 'Marca quién asistió a cada reunión.' },
  { id: 'actividades', titulo: 'Actividades generales', icono: 'calendario', roles: [], listo: true,
    desc: 'Servicios, discipulados de mujeres, seminarios y otras actividades de la iglesia, con su asistencia.' },
  { id: 'reportes',            titulo: 'Reportes',            icono: 'informe',    roles: [], listo: true,
    desc: 'Resumen de la iglesia por semana, mes o año: grupos, adiestramiento, asistencia pastoral, nacidos de nuevo y bautizados.' },
  { id: 'usuarios-accesos',    titulo: 'Usuarios y accesos',  icono: 'llave',      roles: [], listo: true,
    desc: 'Crea las cuentas de ingreso y asigna el cargo de cada persona.' },
  { id: 'ubicaciones',         titulo: 'Ubicaciones',         icono: 'ubicacion',  roles: [], listo: true,
    desc: 'Dónde se reúne cada grupo de Comunión Familiar: dirección, discipulador, discípulos y mapa.' },
];

/* ---------- Permisos: Rol → Módulo → Acciones ----------
   La matriz NO está escrita aquí: la entrega el servidor al iniciar sesión (tabla «permisos» de la
   base de datos). Un cargo «tiene acceso» a un módulo si aparece con alguna acción; CAMPOS.roles se
   calcula a partir de esa matriz. Para cambiar un permiso se cambia una fila en la base de datos. */
const ACCIONES = { registrar: 'Registrar', masivo: 'Registro masivo', editar: 'Editar', eliminar: 'Eliminar', consultar: 'Consultar', seguimiento: 'Seguimiento', reportes: 'Reportes', exportar: 'Exportar' };
let PERMISOS = {};
function aplicarPermisos(matriz) {
  PERMISOS = matriz || {};
  CAMPOS.forEach(c => { c.roles = Object.keys(PERMISOS[c.id] || {}); });
}
const accionesDe = campoId => (sesion && PERMISOS[campoId] && PERMISOS[campoId][sesion.rol]) || [];
const tiene = (campoId, accion) => accionesDe(campoId).includes(accion);
const soloLectura = campoId => accionesDe(campoId).every(a => a === 'consultar' || a === 'reportes');

CAMPOS.push(
  { id: 'catalogo', titulo: 'Catálogo de formación', icono: 'libro', roles: [], listo: true, desc: 'Cursos, niveles y temas de Comunión Familiar y Adiestramiento.' },
);
const RUTAS = ['inicio', ...CAMPOS.map(c => c.id)];
const acceso = roles => (roles.length === TODOS.length ? 'Todos los cargos' : listaY(roles.map(r => ROLES[r])));

/* =====================================================================
   CONEXIÓN CON EL SERVIDOR (API en PHP + base de datos MySQL)
   ===================================================================== */
const API = 'api/';   // carpeta de la API, relativa a index.html
const MSG_SIN_SERVIDOR = 'No se encontró el servidor. Abre la página desde http://localhost/sigap-el-calvario/ con Apache y MySQL encendidos en XAMPP (no con doble clic en el archivo).';
let csrf = '';        // token anti-CSRF que entrega el servidor al iniciar sesión
const db = { usuarios: [], personas: [], procesos: [], eps: [], sedes: [], cursos: [], niveles: [], temas: [], grupos: [], reuniones: [], casosPastorales: [], actuacionesPastorales: [], categoriasPastorales: [], tiposActividad: [], actividadesGenerales: [], sesiones: [], nacidos: [], bautismos: [], finanzas: [] };
const COLECCIONES = Object.keys(db);

// Llama a la API. Nunca lanza errores: devuelve { ok, estado, datos }. Sin servidor, estado = 0.
async function api(metodo, recurso, cuerpo) {
  const op = { method: metodo, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (cuerpo !== undefined) { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(cuerpo); }
  if (metodo !== 'GET') op.headers['X-CSRF-Token'] = csrf;
  let r, datos;
  try { r = await fetch(API + recurso, op); }
  catch (e) { return { ok: false, estado: 0, datos: { error: 'red', mensaje: MSG_SIN_SERVIDOR } }; }
  try { datos = await r.json(); }
  catch (e) { datos = { error: 'respuesta', mensaje: MSG_SIN_SERVIDOR }; }   // no era JSON: p. ej. se abrió el archivo sin Apache/PHP
  if (r.status === 401 && sesion && recurso !== 'login.php') sesionExpirada();
  return { ok: r.ok, estado: r.status, datos };
}

// Pide al servidor todo lo que el cargo del usuario puede ver, más la matriz de permisos.
async function cargarDatos() {
  const r = await api('GET', 'datos.php');
  if (!r.ok) return false;
  COLECCIONES.forEach(k => { db[k] = Array.isArray(r.datos[k]) ? r.datos[k] : []; });
  aplicarPermisos(r.datos.permisos);
  ADMIN = r.datos.administracion || null;
  miPersonaId = r.datos.usuario && r.datos.usuario.personaId !== undefined ? r.datos.usuario.personaId : null;
  return true;
}

// Nombre para mostrar de quien registró/es responsable de algo, a partir de su usuario de acceso.
const nombreUsuario = u => { const c = db.usuarios.find(x => x.usuario === u); return c ? `${c.nombres} ${c.apellidos}` : (u || '—'); };

// Desactiva el botón de envío mientras se espera la respuesta (evita enviar dos veces).
async function conBoton(form, accion) {
  const b = form ? form.querySelector('button[type="submit"]') : null;
  if (b) b.disabled = true;
  try { return await accion(); } finally { if (b && b.isConnected) b.disabled = false; }
}
// Muestra un error devuelto por la API. Si son errores de validación, marca los campos del formulario.
// «mapa» traduce el nombre del campo en la API al id del campo en la página.
function errorDeServidor(form, caja, r, mapa) {
  const d = r.datos || {};
  if (r.estado === 422 && Array.isArray(d.errores) && form) {
    mostrarErrores(form, caja, d.errores.map(e => ({ campo: (mapa && mapa[e.campo]) || null, texto: e.texto })));
    return;
  }
  mostrarAviso(caja, 'error', d.mensaje || 'No se pudo completar la acción. Inténtalo de nuevo.');
}
const textosDeError = r => ((r.estado === 422 && r.datos && Array.isArray(r.datos.errores)) ? r.datos.errores.map(e => e.texto) : [(r.datos && r.datos.mensaje) || 'No se pudo completar la acción. Inténtalo de nuevo.']);

/* ---------- Iconos y logo ---------- */
const ICONOS = {
  cruz: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  torta: '<path d="M20 21V8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v13"/><path d="M4 16c1.5 1 3 1 4 0s2.5-1 4 0 2.5 1 4 0 2.5-1 4 0"/><path d="M12 6V3"/>',
  inicio:     '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  usuarioMas: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>',
  lista:      '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  chequeo:    '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  informe:    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
  calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  ficha: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17c.5-1.6 1.8-2.5 3.5-2.5s3 .9 3.5 2.5"/><path d="M15 10h4M15 14h3"/>',
  llave:      '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  candado:    '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  ubicacion:  '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  grupo:      '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  corazon:    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  libro:      '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  moneda:     '<circle cx="12" cy="12" r="10"/><path d="M12 6v13M15.5 9.8c0-1.8-1.6-2.8-3.5-2.8s-3.5 1-3.5 2.6 1.6 2.1 3.5 2.6 3.5 1 3.5 2.6-1.6 2.6-3.5 2.6-3.5-1-3.5-2.8"/>',
};
const icono = k => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONOS[k]}</svg>`;
const ICONO_CANDADO = `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false" style="fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;vertical-align:-1px;margin-right:5px">${ICONOS.candado}</svg>`;
// Marcador: la llama de la beta. Si existe LOGO_ARCHIVO junto al HTML, se muestra ese logo en su lugar.
const LLAMA = '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path fill="#E8720C" d="M50 8 C55 22 60 30 68 36 C62 34 58 38 56 44 C60 40 64 42 66 48 C58 46 52 56 52 64 C52 72 48 80 40 84 C46 76 44 68 38 62 C34 66 34 72 36 78 C28 72 26 60 32 50 C24 56 22 66 26 76 C16 66 16 48 26 36 C24 42 26 46 30 48 C28 36 36 24 50 8Z"/></svg>';
const LOGO_HTML = `${LLAMA}<img src="${LOGO_ARCHIVO}" alt="Logo de la ${IGLESIA}">`;

/* ---------- Componentes reutilizables ---------- */
const avisoHTML = (tipo, contenido, accion) => {
  const items = Array.isArray(contenido) ? contenido : [contenido];
  const cuerpo = items.length > 1
    ? `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`
    : `<p>${esc(items[0])}</p>`;
  const boton = accion ? `<button class="btn btn-small" type="button" data-abrir="${esc(accion.abrir)}">${esc(accion.texto)}</button>` : '';
  return `<div class="aviso ${tipo}"${tipo === 'error' ? ' role="alert"' : ''}><div>${cuerpo}${boton}</div></div>`;
};
const mostrarAviso = (caja, tipo, contenido, accion) => { if (caja) caja.innerHTML = avisoHTML(tipo, contenido, accion); };

// Errores de formulario: se listan arriba, se marcan los campos con problema y el foco va al primero.
function mostrarErrores(form, caja, errores) {
  $$('[aria-invalid]', form).forEach(i => i.removeAttribute('aria-invalid'));
  const campos = errores.map(e => document.getElementById(e.campo)).filter(Boolean);
  campos.forEach(i => i.setAttribute('aria-invalid', 'true'));
  mostrarAviso(caja, 'error', errores.map(e => e.texto));
  if (campos[0]) campos[0].focus();
}

const vacio = (titulo, texto) => `<div class="vacio"><strong>${esc(titulo)}</strong>${esc(texto)}</div>`;
const claseCol = c => [c.num && 'num', c.centro && 'centro', c.noprint && 'no-print'].filter(Boolean).join(' ');
const tabla = (id, columnas, filas, leyenda) => `
  <div class="table-wrap">
    <table id="${id}">
      <caption class="sr-only">${esc(leyenda)}</caption>
      <thead><tr>${columnas.map(c => `<th scope="col"${claseCol(c) ? ` class="${claseCol(c)}"` : ''}>${esc(c.t)}</th>`).join('')}</tr></thead>
      <tbody>${filas.join('')}</tbody>
    </table>
  </div>
  <p class="vacio" id="sin-${id}" hidden>No hay resultados para tu búsqueda.</p>`;
function filtrarTabla(input) {
  const t = document.getElementById(input.dataset.filtro);
  if (!t) return;
  const q = norm(input.value.trim());
  let visibles = 0;
  $$('tbody tr', t).forEach(tr => {
    const ok = !q || norm(tr.textContent).includes(q);
    tr.hidden = !ok;
    if (ok) visibles++;
  });
  const sin = document.getElementById(`sin-${t.id}`);
  if (sin) sin.hidden = visibles > 0;
}
const ETQ = { P: 'Presente', F: 'Faltó', E: 'Excusa' };
const marca = (persona, fecha) => {
  const s = persona.asistencia.find(a => a.f === fecha);
  return s
    ? `<span class="dot ${s.e.toLowerCase()}" role="img" aria-label="${ETQ[s.e]}" title="${ETQ[s.e]}">${s.e}</span>`
    : '<span class="muted" role="img" aria-label="Sin registro" title="Sin registro">—</span>';
};
const LEYENDA = `<div class="legend">
  <span><span class="dot p">P</span>Presente</span>
  <span><span class="dot f">F</span>Faltó</span>
  <span><span class="dot e">E</span>Excusa</span>
  <span><span class="muted">—</span>Sin registro</span>
</div>`;

// Botón de doble paso para acciones que borran: el primer clic pide confirmar y el segundo la ejecuta.
// (Se evita window.confirm porque algunos entornos lo bloquean.)
function confirmar(btn, textoConfirmar, ejecutar) {
  if (btn.dataset.armado === '1') { clearTimeout(btn._reloj); ejecutar(); return; }
  const original = btn.textContent, etiqueta = btn.getAttribute('aria-label');
  btn.dataset.armado = '1';
  btn.classList.add('armado');
  btn.textContent = textoConfirmar;
  if (etiqueta) btn.setAttribute('aria-label', `${textoConfirmar}: ${etiqueta}`);
  btn._reloj = setTimeout(() => { // si no se confirma en 5 segundos, vuelve a su estado normal
    delete btn.dataset.armado;
    btn.classList.remove('armado');
    btn.textContent = original;
    if (etiqueta) btn.setAttribute('aria-label', etiqueta);
  }, 5000);
}

/* =====================================================================
   SESIÓN Y NAVEGACIÓN (con botón Atrás del navegador y título por pantalla)
   ===================================================================== */
let sesion = null;
let campoActual = null;
let ultimaRegistrada = null; // N.º de la última persona registrada o editada, para resaltarla en la lista
let editando = null;         // N.º de la persona que se está editando (solo el administrador)
let flash = null;            // mensaje que se muestra una sola vez al abrir la lista
let listaOrden = 'num';      // num | apellidos | faltas
let listaFiltro = 'todas';   // todas | nuevas | faltas
const puede = c => !!sesion && c.roles.includes(sesion.rol);
const VISTAS = {
  'registrar-personas': vistaRegistrarPersonas, 'lista-asistencia': vistaListaAsistencia, 'ubicaciones': vistaUbicaciones,
  'comunion-familiar': vistaComunionFamiliar, grupos: vistaGrupos, sedes: vistaSedes, 'asistencia-pastoral': vistaAsistenciaPastoral,
  'adiestramiento': vistaAdiestramiento, 'finanzas': vistaFinanzas, 'reportes': vistaReportes,
  'usuarios-accesos': vistaUsuariosAccesos,
  'actividades': vistaActividades,
  'tomar-asistencia': vistaTomarAsistencia,
  'ficha-persona': vistaFichaPersona,
};

const idDeHash = () => { try { return decodeURIComponent(location.hash.replace(/^#\/?/, '')); } catch (e) { return ''; } };
function fijarHash(id, reemplazar = false) {
  try {
    if (reemplazar) history.replaceState(null, '', `#/${id}`);
    else if (idDeHash() !== id) location.hash = `#/${id}`;
  } catch (e) { /* algunos entornos no dejan cambiar la dirección */ }
}
function limpiarHash() {
  try { history.replaceState(null, '', location.pathname + location.search); }
  catch (e) { try { location.hash = ''; } catch (e2) { /* nada */ } }
}

function mostrarApp(idInicial = 'inicio') {
  $('#vista-login').hidden = true;
  $('#vista-app').hidden = false;
  $('#rail-nombre').textContent = `${sesion.nombres} ${sesion.apellidos}`;
  $('#rail-rol').textContent = ROLES[sesion.rol];
  const items = [{ id: 'inicio', titulo: 'Inicio', icono: 'inicio' }, ...CAMPOS.filter(c => c.listo && puede(c))];
  $('#nav').innerHTML = items.map(c =>
    `<button type="button" data-abrir="${c.id}">${icono(c.icono)}<span>${esc(c.titulo)}</span></button>`).join('');
  if (idInicial === 'inicio') abrir('inicio'); else abrir(idInicial, true);   // si viene de la dirección (#/campo), no se agrega otra entrada al historial
}

// Refresca los datos desde el servidor y abre el campo (así se ven también los cambios que hicieron otras personas).
let navegando = 0;
async function navegar(id, desdeHash = false) {
  if (!sesion) return;
  const mio = ++navegando;
  await cargarDatos();                // si falla (p. ej. sin servidor), se muestra lo que ya estaba en memoria
  if (!sesion || mio !== navegando) return;   // la sesión pudo terminar, o se hizo clic en otro campo mientras tanto
  abrir(id, desdeHash);
}

function abrir(id, desdeHash = false) {
  if (!sesion) return;
  if (!RUTAS.includes(id)) {
    if (!desdeHash) return;
    id = 'inicio';
    fijarHash('inicio', true);
  }
  if (id !== 'registrar-personas') editando = null;
  campoActual = id;
  let titulo, desc, contenido = '', render = null, activo = null;
  if (id === 'inicio') {
    const n = CAMPOS.filter(puede).length;
    titulo = 'Inicio';
    desc = `Hola, ${primerNombre(sesion.nombres)}. Con tu cargo de ${ROLES[sesion.rol]} puedes entrar a ${n} de los ${CAMPOS.length} campos de SIGAP.`;
    render = vistaInicio;
    activo = 'inicio';
  } else {
    const c = CAMPOS.find(x => x.id === id);
    titulo = c.titulo;
    desc = c.desc;
    if (!puede(c)) { // cada cargo solo entra a los campos que tiene permitidos
      titulo = 'Acceso restringido';
      desc = `El campo «${c.titulo}» no está disponible para tu cargo (${ROLES[sesion.rol]}). Tienen acceso: ${acceso(c.roles)}.`;
    } else if (!c.listo) {
      contenido = vacio('Próximamente', 'Este campo se construirá en uno de los próximos pasos.');
    } else {
      render = VISTAS[c.id];
      activo = c.id;
      if (c.id === 'registrar-personas' && editando) {
        const p = db.personas.find(x => x.num === editando);
        if (p) { titulo = 'Editar persona'; desc = `Corrige los datos de ${nombreCompleto(p)} (N.º ${p.num}).`; }
        else editando = null;
      }
    }
  }
  $$('#nav button').forEach(b => {
    if (b.dataset.abrir === activo) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  const main = $('#main');
  main.innerHTML = `
    <header class="page-head"><h1>${esc(titulo)}</h1><p>${esc(desc)}</p></header>
    <div id="contenido">${contenido}</div>`;
  if (render) render($('#contenido'));
  document.title = `${titulo} · SIGAP`;
  if (!desdeHash) fijarHash(id);
  window.scrollTo(0, 0);
  const h1 = $('h1', main);
  h1.tabIndex = -1;
  h1.focus({ preventScroll: true });
  const nueva = $('#fila-nueva'); // después de registrar o editar, la lista se abre mostrando a esa persona
  if (nueva && nueva.scrollIntoView) nueva.scrollIntoView({ block: 'center' });
  ultimaRegistrada = null;
}

async function cerrarSesion(mensaje) {
  if (!mensaje) await api('POST', 'logout.php', {});   // avisa al servidor para que destruya la sesión (si ya expiró, no hace falta)
  sesion = null;
  csrf = '';
  campoActual = null;
  ultimaRegistrada = null;
  editando = null;
  flash = null;
  COLECCIONES.forEach(k => { db[k] = []; });
  aplicarPermisos({});
  $('#vista-app').hidden = true;
  $('#vista-login').hidden = false;
  $('#main').innerHTML = '';
  $('#nav').innerHTML = '';
  const r = leerRecordado();
  $('#l-usuario').value = r;
  $('#l-recordar').checked = !!r;
  $('#l-clave').value = '';
  $('#login-aviso').innerHTML = '';
  if (mensaje) mostrarAviso($('#login-aviso'), 'info', mensaje);
  limpiarHash();
  document.title = TITULO_BASE;
  window.scrollTo(0, 0);
  $('#l-usuario').focus();
}
function sesionExpirada() { if (sesion) cerrarSesion('Tu sesión terminó. Vuelve a ingresar.'); }

/* ---------- Iniciar sesión ---------- */
const CLAVE_LS = 'sigap_usuario_recordado';
function leerRecordado() { try { return localStorage.getItem(CLAVE_LS) || ''; } catch (e) { return ''; } }
function guardarRecordado(u) { try { if (u) localStorage.setItem(CLAVE_LS, u); else localStorage.removeItem(CLAVE_LS); } catch (e) { /* sin almacenamiento */ } }

async function enviarLogin() {
  const usuario = $('#l-usuario').value.trim(), clave = $('#l-clave').value, caja = $('#login-aviso');
  if (!usuario || !clave) { mostrarAviso(caja, 'error', 'Escribe tu usuario y tu contraseña.'); return; }
  const boton = $('#form-login button[type="submit"]');
  boton.disabled = true;
  try {
    const r = await api('POST', 'login.php', { usuario, clave });
    if (!r.ok) {
      mostrarAviso(caja, 'error', r.datos.mensaje || MSG_SIN_SERVIDOR);
      if (r.estado === 401) $('#l-clave').select();
      return;
    }
    csrf = r.datos.csrf;
    sesion = r.datos.usuario;
    if (!(await cargarDatos())) { sesion = null; csrf = ''; mostrarAviso(caja, 'error', MSG_SIN_SERVIDOR); return; }
    guardarRecordado($('#l-recordar').checked ? sesion.usuario : '');
    caja.innerHTML = '';
    $('#l-clave').value = '';
    mostrarApp('inicio');
  } finally { boton.disabled = false; }
}

/* =====================================================================
   INICIO: los campos del sistema y el acceso de cada cargo
   ===================================================================== */
function tarjeta(c) {
  const estado = !puede(c) ? 'bloqueado' : c.listo ? 'disponible' : 'proximo';
  const etiqueta = {
    bloqueado:  `<span class="pill lock">${ICONO_CANDADO}Sin acceso</span>`,
    disponible: '<span class="pill on">Disponible</span>',
    proximo:    '<span class="pill soon">Próximamente</span>',
  }[estado];
  const cuerpo = `
    <span class="campo-top"><span class="campo-ico">${icono(c.icono)}</span>${etiqueta}</span>
    <span class="campo-tit">${esc(c.titulo)}</span>
    <span class="campo-desc">${esc(c.desc)}</span>
    <span class="campo-acceso">Acceso: <b>${esc(acceso(c.roles))}</b></span>`;
  return estado === 'disponible'
    ? `<button type="button" class="campo ${estado}" data-abrir="${c.id}">${cuerpo}</button>`
    : `<div class="campo ${estado}">${cuerpo}</div>`;
}

function vistaInicioCampos(el) {
  const yo = k => (k === sesion.rol ? ' yo' : '');
  el.innerHTML = `
    <div class="campos">${CAMPOS.map(tarjeta).join('')}</div>
    <details class="matriz">
      <summary>Ver el acceso de todos los cargos</summary>
      <div class="table-wrap">
        <table id="tabla-acceso">
          <caption class="sr-only">Acceso de cada cargo a cada campo</caption>
          <thead><tr><th scope="col">Campo</th>${TODOS.map(k => `<th scope="col" class="centro${yo(k)}">${esc(ROLES[k])}</th>`).join('')}</tr></thead>
          <tbody>${CAMPOS.map(c => `<tr><td><b>${esc(c.titulo)}</b></td>${TODOS.map(k => `<td class="centro${yo(k)}">${c.roles.includes(k)
            ? '<span class="sr-only">Con acceso</span><span class="si" aria-hidden="true">✓</span>'
            : '<span class="sr-only">Sin acceso</span><span class="no" aria-hidden="true">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    </details>`;
}

/* =====================================================================
   CAMPO: REGISTRAR PERSONAS (solo el administrador) — también sirve para editar
   ===================================================================== */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);

// Si el nombre viene todo en minúsculas o todo en mayúsculas lo deja con formato de nombre propio; si ya trae mezcla, lo respeta.
function formatoNombre(t) {
  const s = String(t ?? '').trim().replace(/\s+/g, ' ');
  if (s && s !== s.toLowerCase() && s !== s.toUpperCase()) return s;
  return s.toLowerCase().split(' ').map((w, i) => (i && PARTICULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}
// Acepta celular de 10 dígitos o fijo de 7 (con o sin +57) y lo guarda con formato uniforme.
function normalizarTelefono(t) {
  let d = soloDigitos(t);
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  if (d.length === 7) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return null;
}
function actualizarEdad() {
  const salida = $('#p-edad'), campo = $('#p-nacimiento');
  if (!salida || !campo) return;
  const v = campo.value;
  salida.textContent = v && v <= hoyISO() && v >= '1900-01-01' ? `Edad: ${textoEdad(edad(v))}` : '';
}

/* ---------- Registrar personas · versión 25: foto, cargo y teléfono de emergencia ---------- */
const CARGOS_IGLESIA = ['Pastor local', 'Asistencia Pastoral', 'Discipulador', 'Discípulo (miembro normal)'];
const GRUPOS_SANGUINEOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
let fotoPendiente = null;
function normalizarTelefonoEmergencia(x) {
  let d = String(x || '').replace(/\D+/g, '');
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  return d.length === 10 && d[0] === '3' ? d : null;
}
function pintarFotoPreview(src) {
  const marco = $('#foto-marco');
  if (marco) marco.innerHTML = src ? `<img alt="Foto de la persona" src="${src}">` : '<span>Sin foto</span>';
}
function procesarFotoPersona(input) {
  const archivo = input.files && input.files[0];
  const aviso = $('#foto-aviso');
  if (!archivo) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type) || archivo.size > 2 * 1024 * 1024) {
    input.value = '';
    fotoPendiente = null;
    if (aviso) aviso.textContent = 'La foto debe ser JPG, PNG o WEBP y pesar máximo 2 MB.';
    return;
  }
  const lector = new FileReader();
  lector.onload = () => { fotoPendiente = lector.result; pintarFotoPreview(lector.result); if (aviso) aviso.textContent = ''; };
  lector.readAsDataURL(archivo);
}
document.addEventListener('change', e => { if (e.target && e.target.id === 'p-foto') procesarFotoPersona(e.target); });

function vistaRegistrarPersonas(el) {
  fotoPendiente = null;
  const p = editando ? db.personas.find(x => x.num === editando) : null;
  const v = k => esc(p ? (p[k] ?? '') : '');
  const conFunc = f => !!(p && Array.isArray(p.funciones) && p.funciones.includes(f));
  const gruposCfPersona = p ? db.grupos.filter(g => (g.participantes || []).includes(p.num)) : [];
  const grupoCfActual = gruposCfPersona.length ? gruposCfPersona[0].id : '';
  const gruposCfOpciones = db.grupos.filter(g => g.estado === 'Activo' || gruposCfPersona.includes(g))
    .sort((x, y) => x.nombre.localeCompare(y.nombre));
  el.innerHTML = `
    <section class="panel">
      <form id="form-persona" novalidate>
        <div class="aviso-caja" id="aviso-persona" aria-live="polite"></div>
        <div class="persona-cabecera">
          <p class="form-intro">${p ? `Editando el registro N.º ${p.num}. ` : ''}Los campos marcados con <span class="req">*</span> son obligatorios.</p>
          <div class="foto-box">
            <div class="foto-marco" id="foto-marco">${p && p.tieneFoto ? `<img alt="Foto de ${v('nombres')}" src="api/foto.php?id=${p.num}">` : '<span>Sin foto</span>'}</div>
            <label class="btn" for="p-foto" style="display:inline-block;cursor:pointer;margin-top:8px">Añadir foto</label>
            <input type="file" id="p-foto" accept="image/jpeg,image/png,image/webp" hidden>
            <p class="hint" style="margin:6px 0 0">JPG, PNG o WEBP, máximo 2 MB.</p>
            <p class="hint" id="foto-aviso" role="alert" style="color:#b00020;margin:4px 0 0"></p>
            ${p && p.tieneFoto ? '<label class="check-pequeno" style="margin-top:6px"><input type="checkbox" id="p-quitar-foto"> Quitar foto</label>' : ''}
          </div>
        </div>
        <div class="form-grid">
          <div class="field">
            <label for="p-nombres">Nombres <span class="req" aria-hidden="true">*</span></label>
            <input class="control" id="p-nombres" name="nombres" value="${v('nombres')}" autocomplete="off" aria-required="true" placeholder="Ej: María Fernanda">
          </div>
          <div class="field">
            <label for="p-apellidos">Apellidos <span class="req" aria-hidden="true">*</span></label>
            <input class="control" id="p-apellidos" name="apellidos" value="${v('apellidos')}" autocomplete="off" aria-required="true" placeholder="Ej: Gómez Ríos">
          </div>
          <div class="field">
            <label for="p-nacimiento">Fecha de cumpleaños <span class="req" aria-hidden="true">*</span></label>
            <input class="control" id="p-nacimiento" name="nacimiento" type="date" value="${v('nacimiento')}" min="1900-01-01" max="${hoyISO()}" aria-required="true">
            <p class="hint" id="p-edad" aria-live="polite"></p>
          </div>
          <div class="field">
            <label for="p-tipo-id">Tipo de identificación</label>
            <select class="control" id="p-tipo-id" name="tipoIdentificacion">
              <option value="">— Elegir —</option>
              ${['CC', 'TI'].map(x => `<option value="${x}"${p && p.tipoIdentificacion === x ? ' selected' : ''}>${x}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="p-numero-id">Número de identificación</label>
            <input class="control" id="p-numero-id" name="numeroIdentificacion" inputmode="numeric" value="${v('numeroIdentificacion')}" autocomplete="off" placeholder="Ej: 1020304050">
            <p class="hint">Solo números, sin puntos.</p>
          </div>
          <div class="field">
            <label for="p-telefono">Teléfono <span class="req" aria-hidden="true">*</span></label>
            <input class="control" id="p-telefono" name="telefono" type="tel" inputmode="tel" value="${v('telefono')}" autocomplete="off" aria-required="true" placeholder="Ej: 310 555 0101">
            <p class="hint">Celular de 10 dígitos, o fijo de 7.</p>
          </div>
          <div class="field">
            <label for="p-nombre-emergencia">Nombre del contacto en caso de emergencia</label>
            <input class="control" id="p-nombre-emergencia" name="nombreEmergencia" value="${v('nombreEmergencia')}" autocomplete="off" placeholder="Ej: Laura Ríos">
          </div>
          <div class="field">
            <label for="p-tel-emergencia">Número de contacto de emergencia <span class="req" aria-hidden="true">*</span></label>
            <div class="prefijo-campo">
              <span class="prefijo" aria-hidden="true">+57</span>
              <input class="control" id="p-tel-emergencia" name="telefonoEmergencia" type="tel" inputmode="tel" value="${v('telefonoEmergencia')}" autocomplete="off" aria-required="true" placeholder="310 555 0101">
            </div>
            <p class="hint">Celular colombiano: el +57 y los 10 dígitos.</p>
          </div>
          <div class="field">
            <label for="p-correo">Correo electrónico</label>
            <input class="control" id="p-correo" name="correo" type="email" value="${v('correo')}" autocomplete="off" placeholder="nombre@correo.com">
          </div>
          <div class="field">
            <label for="p-eps">EPS</label>
            <input class="control" id="p-eps" name="eps" list="eps-lista" value="${v('eps')}" autocomplete="off" placeholder="Escribe o elige una EPS">
            <datalist id="eps-lista">${db.eps.filter(e => e.activo).map(e => `<option value="${esc(e.nombre)}"></option>`).join('')}</datalist>
          </div>
          <div class="field full">
            <label for="p-direccion">Dirección</label>
            <input class="control" id="p-direccion" name="direccion" value="${v('direccion')}" autocomplete="off" placeholder="Barrio, calle y número">
          </div>
          <div class="field">
            <label for="p-grupo-sanguineo">Grupo sanguíneo</label>
            <select class="control" id="p-grupo-sanguineo" name="grupoSanguineo">
              <option value="">— Elegir —</option>
              ${GRUPOS_SANGUINEOS.map(x => `<option value="${x}"${p && p.grupoSanguineo === x ? ' selected' : ''}>${x}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="p-sede">Sede</label>
            <select class="control" id="p-sede" name="sedeId">
              <option value="">— Elegir —</option>
              ${(db.sedes || []).filter(s => s.activo || (p && p.sedeId === s.id)).map(s => `<option value="${s.id}"${p && p.sedeId === s.id ? ' selected' : ''}>${esc(s.nombre)}${s.activo ? '' : ' (inactiva)'}</option>`).join('')}
            </select>
          </div>
          <div class="field full">
            <label for="p-grupo-cf">Grupo de comunión familiar</label>
            <select class="control" id="p-grupo-cf" name="grupoCf">
              <option value="">— Sin grupo —</option>
              ${gruposCfOpciones.map(g => `<option value="${g.id}"${String(g.id) === String(grupoCfActual) ? ' selected' : ''}>${esc(g.nombre)}${g.estado === 'Inactivo' ? ' (inactivo)' : ''}</option>`).join('')}
            </select>
            <input type="hidden" id="p-grupo-cf-original" name="grupoCfOriginal" value="${grupoCfActual}">
            <p class="hint">Si cambias el grupo, la persona deja el anterior y entra al nuevo.</p>
          </div>
          <div class="field">
            <label for="p-grupo-adiestramiento">Grupo de Adiestramiento</label>
            <input class="control" id="p-grupo-adiestramiento" name="grupoAdiestramiento" value="${v('grupoAdiestramiento')}" autocomplete="off">
          </div>
          <div class="field">
            <label for="p-nivel-discipulado">Nivel de discipulado</label>
            <input class="control" id="p-nivel-discipulado" name="nivelDiscipulado" value="${v('nivelDiscipulado')}" autocomplete="off">
          </div>
          <div class="field">
            <label for="p-nivel-adiestramiento">Nivel de adiestramiento</label>
            <input class="control" id="p-nivel-adiestramiento" name="nivelAdiestramiento" value="${v('nivelAdiestramiento')}" autocomplete="off">
          </div>
          <div class="field full">
            <label class="check-pequeno"><input type="checkbox" id="p-bautizado" name="bautizado" ${p && p.bautizado ? 'checked' : ''}> Nacido de nuevo (bautizado)</label>
          </div>
          <div class="field">
            <label for="p-cargo">Cargo</label>
            <select class="control" id="p-cargo" name="cargoIglesia">
              <option value="">Sin cargo</option>
              ${CARGOS_IGLESIA.map(c => `<option value="${esc(c)}"${p && p.cargoIglesia === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="field full"><p class="hint" style="margin-top:0">Los registros de nacido de nuevo y de bautismo se hacen en <b>Nacidos y bautizados</b>, con su fecha, su responsable y sus observaciones.</p></div>
          <h2 class="form-section">Funciones en la iglesia</h2>
          <div class="field full">
            <p class="hint" style="margin-top:0">Son funciones de servicio, separadas del acceso al sistema. Una persona puede tener las dos.</p>
            <div class="checklist checklist-corta">
              <label class="check-fila"><input type="checkbox" name="funcion" value="discipulador"${conFunc('discipulador') ? ' checked' : ''}> Discipulador (imparte los cursos de Comunión Familiar)</label>
              <label class="check-fila"><input type="checkbox" name="funcion" value="adiestrador"${conFunc('adiestrador') ? ' checked' : ''}> Adiestrador (imparte los cursos de Adiestramiento)</label>
            </div>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">${p ? 'Guardar cambios' : 'Registrar persona'}</button>
          <button class="btn" type="reset">${p ? 'Deshacer cambios' : 'Limpiar formulario'}</button>
          ${p ? '<button class="btn" type="button" data-accion="cancelar-edicion">Cancelar</button>' : ''}
        </div>
      </form>
    </section>`;
  actualizarEdad();
}

async function enviarPersona(form) {
  if (!sesion || !tiene('registrar-personas', editando ? 'editar' : 'registrar')) return;
  const f = new FormData(form), caja = $('#aviso-persona');
  const actual = editando ? db.personas.find(x => x.num === editando) : null;
  const nombres = formatoNombre(f.get('nombres')), apellidos = formatoNombre(f.get('apellidos'));
  const nacimiento = f.get('nacimiento') || '';
  const telefono = normalizarTelefono(f.get('telefono'));
  const correo = String(f.get('correo')).trim().toLowerCase();
  const eps = String(f.get('eps')).trim().replace(/\s+/g, ' ');
  const direccion = String(f.get('direccion')).trim().replace(/\s+/g, ' ');
  const telEmergencia = normalizarTelefonoEmergencia(f.get('telefonoEmergencia'));
  const bautizado = f.get('bautizado') === 'on';
  const cargoIglesia = String(f.get('cargoIglesia') || '');
  const grupoSanguineo = String(f.get('grupoSanguineo') || '');
  const tipoIdentificacion = String(f.get('tipoIdentificacion') || '');
  const numeroIdentificacion = String(f.get('numeroIdentificacion') || '').replace(/[\s.]+/g, '');
  const nombreEmergencia = String(f.get('nombreEmergencia') || '').trim().replace(/\s+/g, ' ');
  const sedeId = String(f.get('sedeId') || '');
  const grupoCf = String(f.get('grupoCf') || '');
  const grupoCfOriginal = String(f.get('grupoCfOriginal') || '');
  const grupoAdiestramiento = String(f.get('grupoAdiestramiento') || '').trim().replace(/\s+/g, ' ');
  const nivelDiscipulado = String(f.get('nivelDiscipulado') || '').trim().replace(/\s+/g, ' ');
  const nivelAdiestramiento = String(f.get('nivelAdiestramiento') || '').trim().replace(/\s+/g, ' ');
  const errores = [];
  const falla = (campo, texto) => errores.push({ campo, texto });
  if (!nombres) falla('p-nombres', 'Escribe los nombres.');
  if (!apellidos) falla('p-apellidos', 'Escribe los apellidos.');
  if (!nacimiento) falla('p-nacimiento', 'Elige la fecha de cumpleaños.');
  else if (nacimiento > hoyISO()) falla('p-nacimiento', 'La fecha de cumpleaños no puede ser futura.');
  else if (nacimiento < '1900-01-01') falla('p-nacimiento', 'Revisa la fecha de cumpleaños: es demasiado antigua.');
  if (!String(f.get('telefono')).trim()) falla('p-telefono', 'Escribe un teléfono de contacto.');
  else if (!telefono) falla('p-telefono', 'El teléfono no es válido: escribe 10 dígitos si es celular o 7 si es fijo.');
  if (!String(f.get('telefonoEmergencia') || '').trim()) falla('p-tel-emergencia', 'Escribe el número de contacto de emergencia.');
  else if (!telEmergencia) falla('p-tel-emergencia', 'El número de emergencia no es válido: escribe el celular colombiano de 10 dígitos (empieza por 3).');
  if (cargoIglesia && !CARGOS_IGLESIA.includes(cargoIglesia)) falla('p-cargo', 'El cargo elegido no es válido.');
  if (grupoSanguineo && !GRUPOS_SANGUINEOS.includes(grupoSanguineo)) falla('p-grupo-sanguineo', 'El grupo sanguíneo no es válido.');
  if (tipoIdentificacion && !['CC', 'TI'].includes(tipoIdentificacion)) falla('p-tipo-id', 'El tipo de identificación no es válido.');
  if (tipoIdentificacion && !numeroIdentificacion) falla('p-numero-id', 'Escribe el número de identificación.');
  if (!tipoIdentificacion && numeroIdentificacion) falla('p-tipo-id', 'Elige el tipo de identificación.');
  if (numeroIdentificacion && !/^\d{6,11}$/.test(numeroIdentificacion)) falla('p-numero-id', 'El número de identificación debe tener entre 6 y 11 dígitos, sin letras.');
  if (nombreEmergencia.length > 120) falla('p-nombre-emergencia', 'El nombre del contacto es demasiado largo (máximo 120 caracteres).');
  [['p-grupo-adiestramiento', grupoAdiestramiento, 'El Grupo de Adiestramiento'],
   ['p-nivel-discipulado', nivelDiscipulado, 'El nivel de discipulado'],
   ['p-nivel-adiestramiento', nivelAdiestramiento, 'El nivel de adiestramiento']]
    .forEach(([campo, valor, nombre]) => { if (valor.length > 80) falla(campo, `${nombre} es demasiado largo (máximo 80 caracteres).`); });
  if (sedeId && !(db.sedes || []).some(s => String(s.id) === sedeId && (s.activo || (actual && actual.sedeId === s.id)))) falla('p-sede', 'La sede elegida no es válida o está inactiva.');
  if (grupoCf && grupoCf !== grupoCfOriginal && !db.grupos.some(g => String(g.id) === grupoCf && g.estado === 'Activo')) {
    falla('p-grupo-cf', 'El grupo de comunión familiar elegido no está activo.');
  }
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) falla('p-correo', 'El correo no es válido. Ejemplo: nombre@correo.com.');
  if (!errores.length && db.personas.some(p => p !== actual && norm(p.nombres) === norm(nombres) && norm(p.apellidos) === norm(apellidos) && p.nacimiento === nacimiento)) {
    falla('p-nombres', 'Ya hay una persona registrada con esos nombres, apellidos y fecha de cumpleaños.');
  }
  if (!errores.length && numeroIdentificacion && db.personas.some(p => p !== actual && p.numeroIdentificacion === numeroIdentificacion)) {
    falla('p-numero-id', 'Ese número de identificación ya está registrado para otra persona.');
  }
  if (errores.length) { mostrarErrores(form, caja, errores); return; }

  const quitarFoto = !!($('#p-quitar-foto') && $('#p-quitar-foto').checked);
  const cuerpo = { nombres, apellidos, nacimiento, telefono, correo, eps, direccion, funciones: f.getAll('funcion'),
                   telefonoEmergencia: String(f.get('telefonoEmergencia') || ''), bautizado, cargoIglesia,
                   grupoSanguineo, tipoIdentificacion, numeroIdentificacion, nombreEmergencia, sedeId,
                   grupoAdiestramiento, nivelDiscipulado, nivelAdiestramiento,
                   grupoCfId: grupoCf === '' ? null : Number(grupoCf),
                   grupoCfOriginal: grupoCfOriginal === '' ? null : Number(grupoCfOriginal) };
  if (fotoPendiente) cuerpo.foto = fotoPendiente;
  if (quitarFoto) cuerpo.quitarFoto = true;
  await conBoton(form, async () => {
    const r = actual ? await api('PUT', `personas.php?id=${actual.num}`, cuerpo) : await api('POST', 'personas.php', cuerpo);
    if (!r.ok) { errorDeServidor(form, caja, r, MAPA_PERSONA); return; }
    await cargarDatos();
    if (actual) {
      flash = { tipo: 'ok', texto: `Se guardaron los cambios de ${nombres} ${apellidos}.` };
      ultimaRegistrada = actual.num;
      editando = null;
      abrir('lista-asistencia');
      return;
    }
    ultimaRegistrada = r.datos.num;
    form.reset();
    fotoPendiente = null;
    pintarFotoPreview(null);
    actualizarEdad();
    mostrarAviso(caja, 'ok', `Se registró a ${nombres} ${apellidos} y se añadió a la lista de asistencia (N.º ${r.datos.num}).`,
      { texto: 'Ver en la lista de asistencia', abrir: 'lista-asistencia' });
    $('#p-nombres').focus();
  });
}

const MAPA_PERSONA = { nombres: 'p-nombres', apellidos: 'p-apellidos', nacimiento: 'p-nacimiento', telefono: 'p-telefono', correo: 'p-correo',
                       eps: 'p-eps', direccion: 'p-direccion', telefonoEmergencia: 'p-tel-emergencia', cargoIglesia: 'p-cargo', foto: 'p-foto',
                       grupoSanguineo: 'p-grupo-sanguineo', tipoIdentificacion: 'p-tipo-id', numeroIdentificacion: 'p-numero-id',
                       nombreEmergencia: 'p-nombre-emergencia', sedeId: 'p-sede', grupoCfId: 'p-grupo-cf',
                       grupoAdiestramiento: 'p-grupo-adiestramiento', nivelDiscipulado: 'p-nivel-discipulado',
                       nivelAdiestramiento: 'p-nivel-adiestramiento' };

function iniciarEdicion(num) {
  if (!sesion || sesion.rol !== 'admin' || !db.personas.some(p => p.num === num)) return;
  editando = num;
  abrir('registrar-personas');
}

// Solo se pueden eliminar personas sin asistencias registradas (registros hechos por error); el historial no se borra.
async function eliminarPersona(num) {
  if (!sesion || !tiene('registrar-personas', 'eliminar')) return;
  const p = db.personas.find(x => x.num === num);
  if (!p || p.asistencia.length) return;
  const r = await api('DELETE', `personas.php?id=${num}`);
  await cargarDatos();
  if (!sesion) return;
  if (!db.personas.length) { vistaListaAsistencia($('#contenido')); return; }
  pintarTablaLista();
  mostrarAviso($('#aviso-lista'), r.ok ? 'ok' : 'error', r.ok ? `Se eliminó a ${nombreCompleto(p)} de la lista de asistencia.` : r.datos.mensaje);
}


/* =====================================================================
   CAMPO: LISTA DE ASISTENCIA (control de cada persona)
   ===================================================================== */
const ORDENES = { num: 'N.º (orden de registro)', apellidos: 'Apellidos (A–Z)', faltas: 'Más faltas y excusas primero' };
const FILTROS = { todas: 'Todas las personas', nuevas: 'Nuevas (registradas hoy)', faltas: 'Con 2 o más faltas o excusas' };
const cuenta = (p, e) => p.asistencia.filter(s => s.e === e).length;

function personasVisibles() {
  const hoy = hoyISO();
  const lista = db.personas.filter(p => (listaFiltro === 'nuevas' ? p.registrada === hoy : listaFiltro === 'faltas' ? cuenta(p, 'F') + cuenta(p, 'E') >= 2 : true));
  const porNombre = (a, b) => `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`, 'es', { sensitivity: 'base' });
  if (listaOrden === 'apellidos') lista.sort(porNombre);
  else if (listaOrden === 'faltas') lista.sort((a, b) => (cuenta(b, 'F') + cuenta(b, 'E')) - (cuenta(a, 'F') + cuenta(a, 'E')) || porNombre(a, b));
  else lista.sort((a, b) => a.num - b.num);
  return lista;
}

function vistaListaAsistencia(el) {
  const admin = sesion.rol === 'admin';
  el.innerHTML = '<div class="aviso-caja" id="aviso-lista" aria-live="polite"></div><div id="lista-cont"></div>';
  if (flash) { mostrarAviso($('#aviso-lista'), flash.tipo, flash.texto); flash = null; }
  const cont = $('#lista-cont');
  if (!db.personas.length) {
    cont.innerHTML = vacio('Todavía no hay personas en la lista.',
      admin ? 'Regístralas en «Registrar personas» y aparecerán aquí.' : 'El administrador las registra y aparecen aquí.');
    return;
  }
  cont.innerHTML = `
    ${tiene('lista-asistencia', 'registrar') ? '<section class="panel asd no-print" id="asist-dia" aria-labelledby="asd-titulo"></section>' : ''}
    <p class="solo-impresion" id="lista-impresion"></p>
    <div class="toolbar no-print">
      <div class="field">
        <label for="buscar-tabla-asistencia">Buscar persona</label>
        <input class="control" type="search" id="buscar-tabla-asistencia" data-filtro="tabla-asistencia" placeholder="Nombre o teléfono" autocomplete="off">
      </div>
      <div class="field corto">
        <label for="lista-orden">Ordenar por</label>
        <select class="control" id="lista-orden">${Object.entries(ORDENES).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join('')}</select>
      </div>
      <div class="field corto">
        <label for="lista-filtro">Mostrar</label>
        <select class="control" id="lista-filtro">${Object.entries(FILTROS).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join('')}</select>
      </div>
      <div class="toolbar-acciones">
        <span class="conteo" id="lista-conteo"></span>
        <button class="btn" type="button" data-accion="imprimir">Imprimir lista</button>
        ${admin ? '<button class="btn btn-primary" type="button" data-abrir="registrar-personas">Registrar persona</button>' : ''}
      </div>
    </div>
    <div id="lista-tabla"></div>
    ${LEYENDA}`;
  $('#lista-orden').value = listaOrden;
  $('#lista-filtro').value = listaFiltro;
  pintarTablaLista();
  if (tiene('lista-asistencia', 'registrar')) pintarAsistenciaDia();
}

/* ---------- Registrar la asistencia del día, lista general (versión 19) ---------- */
// asistDia guarda la fecha elegida, lo que hay guardado en la base (original) y lo marcado en pantalla (draft).
let asistDia = { fecha: '', original: {}, draft: {}, dirty: false };
const ESTADOS_ASISTENCIA = { P: 'Presente', F: 'Faltó', E: 'Excusa' };

function asistenciaDeFecha(fecha) {
  const mapa = {};
  db.personas.forEach(p => { const s = p.asistencia.find(x => x.f === fecha); mapa[p.num] = s ? s.e : null; });
  return mapa;
}
function cargarBorradorAsistencia(fecha) {
  asistDia = { fecha, original: asistenciaDeFecha(fecha), draft: asistenciaDeFecha(fecha), dirty: false };
}
function contarAsistencia(mapa) {
  const c = { P: 0, F: 0, E: 0, sin: 0 };
  Object.values(mapa).forEach(e => { if (e) c[e]++; else c.sin++; });
  return c;
}
function resumenAsistencia(c) {
  return `<b>${c.P}</b> presentes · <b>${c.F}</b> faltas · <b>${c.E}</b> excusas · <b>${c.sin}</b> sin marcar`;
}
function filaAsistencia(p) {
  const e = asistDia.draft[p.num] || null, nombre = nombreCompleto(p);
  const boton = (code) => `<button type="button" class="btn btn-small asd-btn" data-asd-estado="${code}" data-num="${p.num}" aria-pressed="${e === code}" aria-label="${ESTADOS_ASISTENCIA[code]}: ${esc(nombre)}">${ESTADOS_ASISTENCIA[code]}</button>`;
  return `<div class="asd-fila" data-buscar="${esc(ubicNormal(nombre))}"><span class="asd-nombre">${esc(nombre)}</span><span class="asd-botones">${boton('P')}${boton('F')}${boton('E')}</span></div>`;
}
function pintarAsistenciaDia() {
  const cont = $('#asist-dia');
  if (!cont) return;
  if (!asistDia.fecha) cargarBorradorAsistencia(hoyISO());
  const personas = [...db.personas].sort((a, b) => (a.apellidos || '').localeCompare(b.apellidos || '', 'es') || (a.nombres || '').localeCompare(b.nombres || '', 'es'));
  cont.innerHTML = `
    <h2 id="asd-titulo">Registrar la asistencia del día</h2>
    <p class="panel-desc">Marca a cada persona que asistió. Solo se guarda lo que marques: quien no tiene marca en esa fecha no tiene registro.</p>
    <div class="aviso-caja" id="aviso-asistencia" aria-live="polite"></div>
    <div class="toolbar">
      <div class="field corto"><label for="asd-fecha">Fecha</label>
        <input class="control" type="date" id="asd-fecha" max="${hoyISO()}" value="${asistDia.fecha}"></div>
      <div class="field"><label for="asd-buscar">Buscar persona</label>
        <input class="control" type="search" id="asd-buscar" placeholder="Nombre o apellido" autocomplete="off"></div>
      <div class="toolbar-acciones">
        <button class="btn" type="button" data-asd-accion="todas-presentes">Marcar a todas como presentes</button>
        <button class="btn" type="button" data-asd-accion="descartar">Descartar cambios</button>
        <button class="btn btn-primary" type="button" data-asd-accion="guardar">Guardar asistencia del día</button>
      </div>
    </div>
    <p class="sub-dato" id="asd-conteo">${resumenAsistencia(contarAsistencia(asistDia.draft))}</p>
    <div class="asd-lista" id="asd-lista">${personas.map(filaAsistencia).join('')}</div>`;
}
function actualizarConteoAsistencia() {
  const c = $('#asd-conteo');
  if (c) c.innerHTML = resumenAsistencia(contarAsistencia(asistDia.draft));
}
async function guardarAsistenciaDia() {
  const caja = $('#aviso-asistencia');
  const marcas = Object.keys(asistDia.draft).map(Number)
    .filter(id => (asistDia.draft[id] || null) !== (asistDia.original[id] || null))
    .map(id => ({ personaId: id, estado: asistDia.draft[id] || null }));
  if (!marcas.length) { mostrarAviso(caja, 'error', 'No hay cambios que guardar.'); return; }
  await conBoton($('[data-asd-accion="guardar"]'), async () => {
    const r = await api('PUT', 'asistencias.php', { fecha: asistDia.fecha, marcas });
    if (!r.ok) { mostrarAviso(caja, 'error', textosDeError(r)); return; }
    await cargarDatos();
    cargarBorradorAsistencia(asistDia.fecha);
    const c = contarAsistencia(asistenciaDeFecha(asistDia.fecha));
    flash = { tipo: 'ok', texto: `Se guardó la asistencia del ${fechaCorta(asistDia.fecha)}: ${c.P} presentes, ${c.F} faltas y ${c.E} excusas.` };
    abrir('lista-asistencia');
  });
}

document.addEventListener('click', e => {
  const estado = e.target.closest('[data-asd-estado]');
  if (estado) {
    const num = Number(estado.dataset.num), code = estado.dataset.asdEstado;
    asistDia.draft[num] = asistDia.draft[num] === code ? null : code;
    asistDia.dirty = true;
    estado.closest('.asd-fila').querySelectorAll('[data-asd-estado]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.asdEstado === asistDia.draft[num])));
    actualizarConteoAsistencia();
    return;
  }
  const accion = e.target.closest('[data-asd-accion]');
  if (!accion) return;
  const tipo = accion.dataset.asdAccion;
  if (tipo === 'todas-presentes') {
    db.personas.forEach(p => { asistDia.draft[p.num] = 'P'; });
    asistDia.dirty = true;
    pintarAsistenciaDia();
  } else if (tipo === 'descartar') {
    cargarBorradorAsistencia(asistDia.fecha);
    pintarAsistenciaDia();
  } else if (tipo === 'guardar') {
    guardarAsistenciaDia();
  }
});
document.addEventListener('change', e => {
  if (e.target.id !== 'asd-fecha') return;
  const nueva = e.target.value, caja = $('#aviso-asistencia');
  if (!nueva || nueva > hoyISO()) { mostrarAviso(caja, 'error', 'La fecha no puede ser futura.'); e.target.value = asistDia.fecha; return; }
  if (asistDia.dirty) { mostrarAviso(caja, 'error', 'Tienes cambios sin guardar. Guárdalos o descártalos antes de cambiar la fecha.'); e.target.value = asistDia.fecha; return; }
  cargarBorradorAsistencia(nueva);
  pintarAsistenciaDia();
});
document.addEventListener('input', e => {
  if (e.target.id !== 'asd-buscar') return;
  const texto = ubicNormal(e.target.value.trim());
  document.querySelectorAll('#asd-lista .asd-fila').forEach(f => { f.hidden = !!texto && !f.dataset.buscar.includes(texto); });
});

// Dibuja la tabla según el orden y el filtro elegidos; la búsqueda por texto se aplica después.
function pintarTablaLista() {
  const cont = $('#lista-tabla');
  if (!cont) return;
  const admin = sesion.rol === 'admin', hoy = hoyISO();
  const total = db.personas.length, visibles = personasVisibles();
  $('#lista-conteo').innerHTML = visibles.length === total
    ? `<b>${total}</b> ${total === 1 ? 'persona' : 'personas'}`
    : `<b>${visibles.length}</b> de ${total} personas`;
  $('#lista-impresion').textContent = `${IGLESIA}. Lista de asistencia generada el ${fechaLarga(hoy)}.${listaFiltro !== 'todas' ? ` Filtro: ${FILTROS[listaFiltro]}.` : ''}`;
  if (!visibles.length) {
    cont.innerHTML = vacio('Nadie cumple este filtro.', 'Cambia la opción de «Mostrar» para ver a las demás personas.');
    return;
  }
  const fechas = [...new Set(db.personas.flatMap(p => p.asistencia.map(s => s.f)))].sort().slice(-4);
  const filas = visibles.map(p => `<tr${p.num === ultimaRegistrada ? ' id="fila-nueva" class="resaltada"' : ''}>
      <td class="num">${p.num}</td>
      <td><b>${esc(nombreCompleto(p))}</b>${p.registrada === hoy ? '<span class="pill new">Nueva</span>' : ''}<div class="sub-dato"><a class="tel" href="tel:${esc(telHref(p.telefono))}">${esc(p.telefono)}</a></div></td>
      ${fechas.map(f => `<td class="centro">${marca(p, f)}</td>`).join('')}
      <td class="num">${cuenta(p, 'P')}</td>
      <td class="num">${cuenta(p, 'F')}</td>
<td class="num">${cuenta(p, 'E')}</td>
      <td>${esc(fechaCorta(p.registrada))}</td>
      ${admin ? `<td class="no-print"><div class="acciones">
        <button class="btn btn-small" type="button" data-accion="editar" data-num="${p.num}" aria-label="Editar a ${esc(nombreCompleto(p))}">Editar</button>
        <button class="btn btn-small btn-peligro" type="button" data-accion="eliminar" data-num="${p.num}" aria-label="Eliminar a ${esc(nombreCompleto(p))}"${p.asistencia.length ? ' disabled title="Tiene asistencias registradas: no se puede eliminar"' : ''}>Eliminar</button>
      </div></td>` : ''}
    </tr>`);
  cont.innerHTML = tabla('tabla-asistencia',
    [{ t: 'N.º', num: true }, { t: 'Persona' }, ...fechas.map(f => ({ t: fechaNum(f), centro: true })),
     { t: 'Asistencias', num: true }, { t: 'Faltas', num: true }, { t: 'Excusas', num: true }, { t: 'Registrada' },
     ...(admin ? [{ t: 'Acciones', noprint: true }] : [])],
    filas, 'Lista de asistencia de las personas registradas');
  const buscar = $('#buscar-tabla-asistencia');
  if (buscar && buscar.value) filtrarTabla(buscar);
}

/* =====================================================================
   CAMPO: UBICACIONES · versión 14 (tablero de los grupos de Comunión Familiar)
   Dónde se reúne cada casa, su discipulador, sus discípulos y la última reunión.
   Todo sale de la base de datos (api/ubicaciones.php). El discipulador ve solo sus grupos.
   ===================================================================== */
let ubicDatos = null;   // respuesta de la última consulta

// Quita tildes y pasa a minúsculas, para que buscar «herrera» encuentre «Herrera»
const ubicNormal = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function vistaUbicaciones(el) {
  el.innerHTML = `
    <div class="aviso-caja" id="aviso-ubicaciones" aria-live="polite"></div>
    <div id="ubic-cuerpo"><p class="vacio">Cargando las ubicaciones…</p></div>`;
  cargarUbicaciones();
}

async function cargarUbicaciones() {
  const r = await api('GET', 'ubicaciones.php');
  const cont = $('#ubic-cuerpo');
  if (!cont) return;
  if (!r.ok) {
    cont.innerHTML = vacio('No se pudieron cargar las ubicaciones', (r.datos && r.datos.mensaje) || 'Inténtalo de nuevo.');
    return;
  }
  ubicDatos = r.datos;
  pintarUbicaciones();
}

function pintarUbicaciones() {
  const cont = $('#ubic-cuerpo');
  if (!cont || !ubicDatos) return;
  const d = ubicDatos;
  const res = d.resumen;
  const resumen = `
    <div class="stats">
      <div class="stat"><div class="n">${res.gruposActivos}</div><div class="l">Grupos de Comunión Familiar activos</div></div>
      <div class="stat"><div class="n">${res.discipulos}</div><div class="l">Discípulos en esos grupos</div></div>
      ${res.personasSinGrupo !== null
        ? `<div class="stat"><div class="n">${res.personasSinGrupo}</div><div class="l">Personas sin grupo activo</div></div>`
        : ''}
    </div>`;
  if (!d.grupos.length) {
    cont.innerHTML = resumen + vacio('No hay grupos activos para mostrar',
      d.todos ? 'Crea un grupo en Comunión Familiar y aparecerá aquí con su dirección.'
              : 'Aparecen aquí los grupos que discipulas.');
    return;
  }
  cont.innerHTML = `${resumen}
    <div class="toolbar">
      <div class="field"><label for="ubic-buscar">Buscar por casa o discipulador</label>
        <input class="control" id="ubic-buscar" type="search" autocomplete="off" placeholder="ej. Herrera"></div>
    </div>
    <p class="hint">Pulsa «Abrir en Google Maps» para ver la dirección de cada casa en el mapa.</p>
    <div class="ubic-tarjetas" id="ubic-tarjetas">${d.grupos.map(tarjetaUbicacion).join('')}</div>
    <p class="vacio" id="ubic-sin" hidden>No hay casas que coincidan con la búsqueda.</p>`;
}

function tarjetaUbicacion(g) {
  const discipulos = g.discipulos.length
    ? `<details><summary>Ver discípulos (${g.discipulos.length})</summary>
         <ul class="lista-simple">${g.discipulos.map(x => `<li>${esc(x.nombre)}</li>`).join('')}</ul></details>`
    : '<p class="muted">Sin discípulos registrados.</p>';
  const ultima = g.ultimaReunion
    ? `Última reunión: ${esc(fechaFicha(g.ultimaReunion.fecha))} · asistieron ${esc(String(g.ultimaReunion.asistentes))}`
    : 'Sin reuniones registradas';
  return `
    <article class="ubic-tarjeta" data-buscar="${esc(ubicNormal(`${g.nombre} ${g.discipulador}`))}">
      <h3>${esc(g.nombre)}</h3>
      <p class="sub-dato"><b>Discipulador:</b> ${esc(g.discipulador)}</p>
      <p class="sub-dato"><b>Dirección:</b> ${esc(g.direccion)}</p>
      <p class="sub-dato"><b>Anfitrión:</b> ${esc(g.anfitrion)}</p>
      <div class="ubic-acciones">
        <a class="btn btn-small btn-primary" href="${esc(g.mapaUrl)}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a>
      </div>
      ${discipulos}
      <p class="sub-dato">${ultima}</p>
    </article>`;
}

document.addEventListener('input', e => {
  if (e.target.id !== 'ubic-buscar') return;
  const texto = ubicNormal(e.target.value.trim());
  let visibles = 0;
  document.querySelectorAll('.ubic-tarjeta').forEach(t => {
    const coincide = !texto || t.dataset.buscar.includes(texto);
    t.hidden = !coincide;
    if (coincide) visibles++;
  });
  const sin = $('#ubic-sin');
  if (sin) sin.hidden = visibles > 0;
});


/* =====================================================================
   UTILIDADES COMPARTIDAS: períodos (semana/mes/año) y dinero
   ===================================================================== */
const PERIODOS = { semana: 'Semana actual', mes: 'Mes actual', anio: 'Año actual', rango: 'Rango de fechas', todo: 'Todo el historial' };
function rangoPeriodo(p, r) {
  if (p === 'rango') return { desde: (r && r.desde) || null, hasta: (r && r.hasta) || null };
  const hoy = new Date();
  if (p === 'semana') {
    const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7)); // lunes de esta semana
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
    return { desde: iso(lunes), hasta: iso(domingo) };
  }
  if (p === 'mes') return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)) };
  if (p === 'anio') return { desde: `${hoy.getFullYear()}-01-01`, hasta: `${hoy.getFullYear()}-12-31` };
  return { desde: null, hasta: null }; // todo el historial
}
const dentroDePeriodo = (fechaISO, p, r) => { const { desde, hasta } = rangoPeriodo(p, r); return (!desde || fechaISO >= desde) && (!hasta || fechaISO <= hasta); };
// Período con «Rango de fechas»: las fechas solo se activan cuando el período es «rango»
function controlPeriodo(pref, p, r) {
  const off = p !== 'rango';
  return `<div class="field corto"><label for="${pref}-periodo">Período</label>
        <select class="control" id="${pref}-periodo">${Object.entries(PERIODOS).map(([k, t]) => `<option value="${k}"${p === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      <div class="field corto"><label for="${pref}-desde">Desde</label>
        <input class="control" type="date" id="${pref}-desde" value="${esc(r.desde)}"${off ? ' disabled' : ''}></div>
      <div class="field corto"><label for="${pref}-hasta">Hasta</label>
        <input class="control" type="date" id="${pref}-hasta" value="${esc(r.hasta)}"${off ? ' disabled' : ''}></div>`;
}
function toggleRango(pref) {
  const on = $(`#${pref}-periodo`).value === 'rango';
  ['desde', 'hasta'].forEach(x => { const i = $(`#${pref}-${x}`); if (i) i.disabled = !on; });
}
const cop = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0);
const lineas = t => String(t ?? '').split('\n').map(x => x.trim()).filter(Boolean);
const pillEstado = e => `<span class="pill ${e === 'Cerrado' ? 'on' : e === 'Pendiente' ? 'lock' : 'soon'}">${esc(e)}</span>`;

/* =====================================================================
   CAMPO: COMUNIÓN FAMILIAR (grupos, participantes y reuniones) · versión 3
   Los datos los entrega el servidor. El anfitrión y el discipulador son personas
   registradas; el discipulador debe tener la función «discipulador».
   ===================================================================== */
let grupoEditando = null;
let reunionEditando = null;
let miPersonaId = null;                 // persona vinculada a la cuenta (la entrega el servidor)
const gruposAbiertos = new Set();
const MAPA_GRUPO = { nombre: 'g-nombre', anfitrionId: 'g-anfitrion', direccion: 'g-direccion', fechaInicio: 'g-fecha-inicio',
                     discipuladorId: 'g-discipulador', estado: 'g-estado', observaciones: 'g-observaciones' };

const grupoPorId = id => db.grupos.find(g => g.id === id);
const porNombreCompleto = (a, b) => `${a.nombres} ${a.apellidos}`.localeCompare(`${b.nombres} ${b.apellidos}`, 'es', { sensitivity: 'base' });
const todasLasPersonas = () => db.personas.slice().sort(porNombreCompleto);
const conFuncion = f => db.personas.filter(p => Array.isArray(p.funciones) && p.funciones.includes(f)).sort(porNombreCompleto);
const personaNombre = id => { const p = db.personas.find(x => x.num === id); return p ? `${p.nombres} ${p.apellidos}` : '—'; };
const reunionesDe = grupoId => db.reuniones.filter(r => r.grupoId === grupoId).sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
const puedeRegistrarEn = g => tiene('comunion-familiar', 'registrar') && (sesion.rol !== 'discipulador' || g.discipuladorId === miPersonaId);

// Opciones de <select> con personas (seleccion = id o null)
function opcionesPersonas(lista, seleccion, textoVacio) {
  const vacia = textoVacio === null ? '' : `<option value="">${esc(textoVacio)}</option>`;
  return vacia + lista.map(p => `<option value="${p.num}"${p.num === seleccion ? ' selected' : ''}>${esc(`${p.nombres} ${p.apellidos}`)}</option>`).join('');
}

// Temas activos del proceso Comunión Familiar, agrupados por curso
function opcionesTema(seleccion) {
  const proceso = db.procesos.find(p => p.clave === 'comunion-familiar');
  let html = '<option value="">Sin tema (no se indica)</option>';
  if (!proceso) return html;
  for (const c of db.cursos.filter(x => x.procesoId === proceso.id && x.activo)) {
    const temas = db.temas.filter(t => t.cursoId === c.id && t.activo);
    if (!temas.length) continue;
    html += `<optgroup label="${esc(c.nombre)}">` + temas.map(t => {
      const nivel = t.nivelId ? db.niveles.find(n => n.id === t.nivelId) : null;
      const texto = nivel ? `${nivel.nombre} · ${t.nombre}` : t.nombre;
      return `<option value="${t.id}"${seleccion === t.id ? ' selected' : ''}>${esc(texto)}</option>`;
    }).join('') + '</optgroup>';
  }
  return html;
}

function vistaComunionFamiliar(el) {
  const puedeRegistrar = tiene('comunion-familiar', 'registrar');
  const g = grupoEditando ? grupoPorId(grupoEditando) : null;
  const discipulado = sesion.rol === 'discipulador';
  const personas = todasLasPersonas();
  const disc = conFuncion('discipulador');
  el.innerHTML = `
    <div class="aviso-caja" id="aviso-cf" aria-live="polite"></div>
    ${(puedeRegistrar || g) ? `
    <details class="registro-nuevo"${g ? ' open' : ''}>
      <summary>${g ? `Editando «${esc(g.nombre)}»` : '+ Registrar un nuevo grupo'}</summary>
      <form id="form-grupo" class="panel" novalidate>
        <div class="aviso-caja" id="aviso-grupo" aria-live="polite"></div>
        <p class="form-intro">Los campos marcados con <span class="req">*</span> son obligatorios.</p>
        <div class="form-grid">
          <div class="field">
            <label for="g-nombre">Nombre o identificación de la casa <span class="req" aria-hidden="true">*</span></label>
            <input class="control" id="g-nombre" name="nombre" value="${esc(g ? g.nombre : '')}" autocomplete="off" placeholder="Ej: Casa Rodríguez">
          </div>
          <div class="field">
            <label for="g-anfitrion">Anfitrión (quien recibe al grupo en su casa) <span class="req" aria-hidden="true">*</span></label>
            <select class="control" id="g-anfitrion" name="anfitrionId">${opcionesPersonas(personas, g ? g.anfitrionId : null, 'Elige una persona')}</select>
          </div>
          <div class="field full">
            <label for="g-direccion">Dirección de la casa <span class="req" aria-hidden="true">*</span></label>
            <input class="control" id="g-direccion" name="direccion" value="${esc(g ? g.direccion : '')}" autocomplete="off" placeholder="Barrio, calle y número">
          </div>
          <div class="field">
            <label for="g-fecha-inicio">Fecha de inicio del grupo <span class="req" aria-hidden="true">*</span></label>
            <input class="control" id="g-fecha-inicio" name="fechaInicio" type="date" max="${hoyISO()}" value="${esc(g ? g.fechaInicio : hoyISO())}">
          </div>
          <div class="field">
            <label for="g-estado">Estado del grupo</label>
            <select class="control" id="g-estado" name="estado">${['Activo', 'Inactivo'].map(x => `<option${(g ? g.estado : 'Activo') === x ? ' selected' : ''}>${x}</option>`).join('')}</select>
          </div>
          ${discipulado ? `
          <div class="field full"><p class="hint"><b>Discipulador responsable:</b> tú. Tu cuenta registra los grupos a tu cargo.</p></div>`
          : `
          <div class="field full">
            <label for="g-discipulador">Discipulador responsable <span class="req" aria-hidden="true">*</span></label>
            <select class="control" id="g-discipulador" name="discipuladorId">${opcionesPersonas(disc, g ? g.discipuladorId : null, 'Elige un discipulador')}</select>
            <p class="hint">Solo aparecen personas con la función «discipulador» (se asigna en su ficha).</p>
          </div>`}
          <div class="field full">
            <span class="label-like">Participantes vinculados al grupo</span>
            <div class="checklist">${personas.map(p => `<label class="check-fila"><input type="checkbox" name="participantes" value="${p.num}"${g && g.participantes.includes(p.num) ? ' checked' : ''}> ${esc(`${p.nombres} ${p.apellidos}`)}</label>`).join('')}</div>
            <p class="hint">Solo las personas vinculadas pueden marcarse como asistentes en las reuniones del grupo.</p>
          </div>
          <div class="field full">
            <label for="g-observaciones">Observaciones</label>
            <textarea class="control" id="g-observaciones" name="observaciones" rows="2">${esc(g ? g.observaciones : '')}</textarea>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">${g ? 'Guardar cambios' : 'Registrar grupo'}</button>
          <button class="btn" type="reset">${g ? 'Deshacer cambios' : 'Limpiar'}</button>
          ${g ? '<button class="btn" type="button" data-accion="cancelar-edicion-grupo">Cancelar</button>' : ''}
        </div>
      </form>
    </details>` : ''}
    <div id="grupos-lista"></div>`;
  if (flash) { mostrarAviso($('#aviso-cf'), flash.tipo, flash.texto); flash = null; }
  pintarGrupos();
}

function pintarGrupos() {
  const cont = $('#grupos-lista');
  if (!cont) return;
  const grupos = db.grupos.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  if (!grupos.length) {
    cont.innerHTML = vacio('Todavía no hay grupos de Comunión Familiar.',
      tiene('comunion-familiar', 'registrar') ? 'Regístralo arriba, en «+ Registrar un nuevo grupo».' : 'Tu cargo no tiene grupos asignados todavía.');
    return;
  }
  cont.innerHTML = grupos.map(g => {
    const reuniones = reunionesDe(g.id);
    const ofrendaTotal = reuniones.reduce((s, r) => s + (Number(r.ofrenda) || 0), 0);
    const editable = tiene('comunion-familiar', 'editar');
    const nPart = g.participantes.length;
    return `
    <details class="grupo panel" data-grupo="${g.id}"${gruposAbiertos.has(g.id) ? ' open' : ''}>
      <summary class="grupo-resumen" data-accion="alternar-grupo" data-id="${g.id}">
        <span class="grupo-tit">${esc(g.nombre)} ${g.estado === 'Inactivo' ? '<span class="pill lock">Inactivo</span>' : ''}</span>
        <span class="grupo-datos">
          <span>Anfitrión: ${esc(g.anfitrion)}</span>
          <span>${esc(g.direccion)}</span>
          <span>Discipulador: ${esc(g.discipulador)} · Inicio: ${esc(fechaCorta(g.fechaInicio))}</span>
        </span>
        <span class="grupo-resumen-num">
          <span>${nPart} ${nPart === 1 ? 'participante' : 'participantes'}</span>
          <span>${reuniones.length} ${reuniones.length === 1 ? 'reunión' : 'reuniones'}${reuniones[0] ? ` · Última: ${esc(fechaCorta(reuniones[0].fecha))}` : ''}</span>
        </span>
      </summary>
      <div class="grupo-cuerpo">
        ${editable ? `<div class="acciones" style="margin-bottom:16px">
          <button class="btn btn-small" type="button" data-accion="editar-grupo" data-id="${g.id}">Editar grupo</button>
          <button class="btn btn-small btn-peligro" type="button" data-accion="eliminar-grupo" data-id="${g.id}"${reuniones.length ? ' disabled title="Tiene reuniones registradas: no se puede eliminar"' : ''}>Eliminar grupo</button>
        </div>` : ''}
        ${g.observaciones ? `<p class="sub-dato" style="margin-bottom:12px">Observaciones: ${esc(g.observaciones)}</p>` : ''}
        <p class="sub-dato" style="margin-bottom:12px"><b>Participantes:</b> ${nPart ? g.participantes.map(id => esc(personaNombre(id))).join(', ') : 'Ninguno vinculado todavía.'}</p>
        ${reuniones.length ? tabla(`tabla-reuniones-${g.id}`,
          [{ t: 'Fecha' }, { t: 'Horario' }, { t: 'Tema' }, { t: 'Asistieron', num: true }, { t: 'Visitantes', num: true },
           { t: 'Cantidad', num: true }, { t: 'Ofrenda', num: true }, { t: 'Impartió' }, ...(editable ? [{ t: 'Acciones', noprint: true }] : [])],
          reuniones.map(r => {
            const tema = r.temaId ? db.temas.find(t => t.id === r.temaId) : null;
            const impartio = r.impartidoPorId ? personaNombre(r.impartidoPorId) : personaNombre(r.discipuladorId);
            return `<tr${r.id === reunionEditando ? ' class="resaltada"' : ''}>
              <td>${esc(fechaCorta(r.fecha))}</td>
              <td>${esc(r.hora)}${r.horaFin ? '–' + esc(r.horaFin) : ''}</td>
              <td>${tema ? esc(tema.nombre) : '<span class="muted">Sin tema</span>'}</td>
              <td class="num">${r.asistencia.length} de ${nPart}</td>
              <td class="num">${r.visitantes.length}</td>
              <td class="num">${r.cantidad}</td>
              <td class="num">${cop(r.ofrenda)}</td>
              <td>${esc(impartio)}${r.impartidoPorId ? ' <span class="sub-dato">(en lugar del responsable)</span>' : ''}</td>
              ${editable ? `<td class="no-print"><div class="acciones">
                <button class="btn btn-small" type="button" data-accion="editar-reunion" data-id="${r.id}">Editar</button>
                <button class="btn btn-small btn-peligro" type="button" data-accion="eliminar-reunion" data-id="${r.id}">Eliminar</button>
              </div></td>` : ''}
            </tr>`;
          }), `Reuniones de ${g.nombre}`) + `<p class="sub-dato" style="margin-top:8px">Ofrenda acumulada: <b>${cop(ofrendaTotal)}</b></p>`
          : vacio('Sin reuniones registradas todavía.', '')}
        ${bloqueVisitantes(g, reuniones)}
        ${puedeRegistrarEn(g) ? formularioReunion(g, reuniones.find(r => r.id === reunionEditando) || null) : ''}
      </div>
    </details>`;
  }).join('');
}

async function enviarGrupo(form) {
  const editando = grupoEditando;
  if (!tiene('comunion-familiar', editando ? 'editar' : 'registrar')) return;
  const f = new FormData(form), caja = $('#aviso-grupo');
  const nombre = String(f.get('nombre') || '').trim();
  const direccion = String(f.get('direccion') || '').trim();
  const anfitrionId = Number(f.get('anfitrionId')) || null;
  const fechaInicio = f.get('fechaInicio') || '';
  const discipuladorRaw = f.get('discipuladorId');
  const errores = [];
  const falla = (campo, texto) => errores.push({ campo, texto });
  if (!nombre) falla('g-nombre', 'Escribe el nombre o identificación de la casa.');
  if (!anfitrionId) falla('g-anfitrion', 'Elige la persona que es anfitriona de la casa.');
  if (!direccion) falla('g-direccion', 'Escribe la dirección de la casa.');
  if (!fechaInicio) falla('g-fecha-inicio', 'Elige la fecha de inicio del grupo.');
  if (sesion.rol !== 'discipulador' && !discipuladorRaw) falla('g-discipulador', 'Elige el discipulador responsable.');
  if (errores.length) { mostrarErrores(form, caja, errores); return; }
  const cuerpo = { nombre, direccion, anfitrionId, fechaInicio, estado: f.get('estado') || 'Activo',
                   observaciones: String(f.get('observaciones') || '').trim(), participantes: f.getAll('participantes').map(Number) };
  if (sesion.rol !== 'discipulador') cuerpo.discipuladorId = Number(discipuladorRaw);
  await conBoton(form, async () => {
    const r = editando ? await api('PUT', `grupos.php?id=${editando}`, cuerpo) : await api('POST', 'grupos.php', cuerpo);
    if (!r.ok) { errorDeServidor(form, caja, r, MAPA_GRUPO); return; }
    await cargarDatos();
    if (!editando) gruposAbiertos.add(r.datos.id);
    grupoEditando = null;
    flash = { tipo: 'ok', texto: editando ? `Se guardaron los cambios de «${nombre}».` : `Grupo «${nombre}» registrado. Ya puedes registrarle reuniones.` };
    abrir('comunion-familiar');
  });
}
function iniciarEdicionGrupo(id) { if (!tiene('comunion-familiar', 'editar') || !grupoPorId(id)) return; grupoEditando = id; abrir('comunion-familiar'); }
function cancelarEdicionGrupo() { grupoEditando = null; abrir('comunion-familiar'); }
async function eliminarGrupo(id) {
  if (!tiene('comunion-familiar', 'eliminar')) return;
  const g = grupoPorId(id);
  if (!g) return;
  const r = await api('DELETE', `grupos.php?id=${id}`);
  await cargarDatos();
  if (!sesion) return;
  flash = r.ok ? { tipo: 'ok', texto: `Se eliminó el grupo «${g.nombre}».` } : { tipo: 'error', texto: r.datos.mensaje || 'No se pudo eliminar el grupo.' };
  abrir('comunion-familiar');
}

// Formulario de reunión dentro de cada grupo (nueva o para editar)
function formularioReunion(g, r) {
  const marcados = new Set(r ? r.asistencia : []);
  const visitantesTexto = r ? r.visitantes.map(v => v.nombre).join('\n') : '';
  return `
    <h3 class="subtitulo-form">${r ? 'Editar la reunión' : 'Registrar una reunión'}</h3>
    <form class="form-reunion" data-grupo="${g.id}"${r ? ` data-editando="${r.id}"` : ''} novalidate>
      <div class="aviso-caja" data-aviso-reunion="${g.id}" aria-live="polite"></div>
      <div class="form-grid">
        <div class="field">
          <label for="r-fecha-${g.id}">Fecha <span class="req" aria-hidden="true">*</span></label>
          <input class="control" id="r-fecha-${g.id}" name="fecha" type="date" max="${hoyISO()}" value="${esc(r ? r.fecha : hoyISO())}">
        </div>
        <div class="field">
          <label for="r-hora-${g.id}">Hora de inicio <span class="req" aria-hidden="true">*</span></label>
          <input class="control" id="r-hora-${g.id}" name="horaInicio" type="time" value="${esc(r ? r.hora : '')}">
        </div>
        <div class="field">
          <label for="r-hora-fin-${g.id}">Hora de fin</label>
          <input class="control" id="r-hora-fin-${g.id}" name="horaFin" type="time" value="${esc(r ? r.horaFin : '')}">
        </div>
        <div class="field">
          <label for="r-tema-${g.id}">Tema o lección impartida</label>
          <select class="control" id="r-tema-${g.id}" name="temaId">${opcionesTema(r ? r.temaId : null)}</select>
          <p class="hint">Los temas se administran en «Catálogo de formación».</p>
        </div>
        <div class="field full">
          <label for="r-direccion-${g.id}">Dirección donde se realizó</label>
          <input class="control" id="r-direccion-${g.id}" name="direccion" value="${esc(r ? r.direccion : '')}" autocomplete="off" placeholder="Solo si fue en un lugar distinto a la casa del grupo">
        </div>
        <div class="field">
          <label for="r-anfitrion-${g.id}">Anfitrión</label>
          <select class="control" id="r-anfitrion-${g.id}" name="anfitrionId">${opcionesPersonas(todasLasPersonas(), r && r.anfitrionId ? r.anfitrionId : g.anfitrionId, null)}</select>
        </div>
        <div class="field">
          <label for="r-discipulador-${g.id}">Discipulador responsable</label>
          <select class="control" id="r-discipulador-${g.id}" name="discipuladorId">${opcionesPersonas(conFuncion('discipulador'), r && r.discipuladorId ? r.discipuladorId : g.discipuladorId, null)}</select>
        </div>
        <div class="field">
          <label for="r-impartido-${g.id}">Quién impartió la lección</label>
          <select class="control" id="r-impartido-${g.id}" name="impartidoPorId">${opcionesPersonas(conFuncion('discipulador'), r ? r.impartidoPorId : null, 'El mismo responsable')}</select>
          <p class="hint">Solo si la lección la impartió otra persona.</p>
        </div>
        <div class="field full">
          <span class="label-like">Asistentes (participantes del grupo que asistieron)</span>
          <div class="checklist">${g.participantes.length ? g.participantes.map(id =>
            `<label class="check-fila"><input type="checkbox" name="asistencia" value="${id}"${marcados.has(id) ? ' checked' : ''}> ${esc(personaNombre(id))}</label>`).join('')
            : '<p class="muted">Este grupo todavía no tiene participantes vinculados.</p>'}</div>
        </div>
        <div class="field full">
          <label for="r-visitantes-${g.id}">Visitantes que acudieron por primera vez</label>
          <textarea class="control" id="r-visitantes-${g.id}" name="visitantes" rows="2" placeholder="Un nombre por línea">${esc(visitantesTexto)}</textarea>
        </div>
        <div class="field">
          <label for="r-cantidad-${g.id}">Cantidad de personas <span class="req" aria-hidden="true">*</span></label>
          <input class="control" id="r-cantidad-${g.id}" name="cantidad" type="number" min="0" step="1" value="${r ? r.cantidad : ''}">
        </div>
        <div class="field">
          <label for="r-ofrenda-${g.id}">Ofrenda recibida (COP)</label>
          <input class="control" id="r-ofrenda-${g.id}" name="ofrenda" type="number" min="0" step="1000" value="${r ? r.ofrenda : ''}" placeholder="0">
        </div>
        <div class="field full">
          <label for="r-novedades-${g.id}">Novedades u observaciones</label>
          <textarea class="control" id="r-novedades-${g.id}" name="novedades" rows="2">${esc(r ? r.novedades : '')}</textarea>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" type="submit">${r ? 'Guardar cambios' : 'Registrar reunión'}</button>
        ${r ? '<button class="btn" type="button" data-accion="cancelar-edicion-reunion">Cancelar</button>' : ''}
      </div>
    </form>`;
}

// Visitantes sin vincular a su ficha: se pueden vincular a una persona ya registrada (no se duplica)
function bloqueVisitantes(g, reuniones) {
  const visitas = reuniones.flatMap(r => r.visitantes.map(v => ({ ...v, fecha: r.fecha })));
  if (!visitas.length) return '';
  const editable = puedeRegistrarEn(g);
  return `<div class="visitantes">
    <h3 class="subtitulo-form">Visitantes</h3>
    ${visitas.map(v => `<div class="visitante-fila">
      <span>${esc(fechaCorta(v.fecha))}: <b>${esc(v.nombre)}</b>
        ${v.personaId ? `<span class="pill on">Vinculado a ${esc(personaNombre(v.personaId))}</span>` : '<span class="pill soon">Sin vincular</span>'}</span>
      ${!v.personaId && editable ? `<span class="cat-acciones">
        <select class="control control-corto" aria-label="Persona a la que corresponde ${esc(v.nombre)}">
          <option value="">Elegir persona registrada…</option>${opcionesPersonas(todasLasPersonas(), null, null)}
        </select>
        <button class="btn btn-small" type="button" data-vincular-visitante="${v.id}">Vincular</button></span>` : ''}
    </div>`).join('')}
  </div>`;
}

async function enviarReunion(form) {
  const grupoId = Number(form.dataset.grupo);
  const g = grupoPorId(grupoId);
  if (!g) return;
  const editId = form.dataset.editando ? Number(form.dataset.editando) : null;
  if (!(editId ? tiene('comunion-familiar', 'editar') : puedeRegistrarEn(g))) return;
  const f = new FormData(form), caja = $(`[data-aviso-reunion="${grupoId}"]`);
  const fecha = f.get('fecha') || '', horaInicio = f.get('horaInicio') || '', horaFin = f.get('horaFin') || '';
  const asistencia = f.getAll('asistencia').map(Number);
  const nombres = String(f.get('visitantes') || '').split('\n').map(x => x.trim()).filter(Boolean);
  const cantidadTxt = f.get('cantidad');
  const cantidad = cantidadTxt === '' || cantidadTxt === null ? NaN : Number(cantidadTxt);
  const ofrenda = f.get('ofrenda') === '' || f.get('ofrenda') === null ? 0 : Number(f.get('ofrenda'));
  const errores = [];
  if (!fecha) errores.push('Elige la fecha de la reunión.');
  else if (fecha > hoyISO()) errores.push('La fecha no puede ser futura.');
  if (!horaInicio) errores.push('Elige la hora de inicio.');
  if (horaFin && horaInicio && horaFin <= horaInicio) errores.push('La hora de fin debe ser posterior a la de inicio.');
  if (!Number.isInteger(cantidad) || cantidad < 0) errores.push('Escribe la cantidad de personas (0 o más).');
  else if (cantidad < asistencia.length + nombres.length) errores.push(`La cantidad (${cantidad}) es menor que los asistentes (${asistencia.length}) y visitantes (${nombres.length}) marcados.`);
  if (!Number.isInteger(ofrenda) || ofrenda < 0) errores.push('La ofrenda debe ser 0 o un valor entero positivo.');
  if (errores.length) { mostrarAviso(caja, 'error', errores); return; }
  // Al editar se conserva la vinculación de los visitantes que ya estaban vinculados
  const previos = editId ? (db.reuniones.find(x => x.id === editId) || { visitantes: [] }).visitantes : [];
  const visitantes = nombres.map(nombre => {
    const prev = previos.find(v => v.nombre === nombre && v.personaId);
    return prev ? { nombre, personaId: prev.personaId } : { nombre };
  });
  const cuerpo = {
    fecha, horaInicio, horaFin, direccion: String(f.get('direccion') || '').trim(),
    anfitrionId: Number(f.get('anfitrionId')) || null, discipuladorId: Number(f.get('discipuladorId')) || null,
    impartidoPorId: Number(f.get('impartidoPorId')) || null, temaId: Number(f.get('temaId')) || null,
    asistencia, visitantes, cantidad, ofrenda, novedades: String(f.get('novedades') || '').trim(),
  };
  if (!editId) cuerpo.grupoId = grupoId;
  await conBoton(form, async () => {
    const r = editId ? await api('PUT', `reuniones.php?id=${editId}`, cuerpo) : await api('POST', 'reuniones.php', cuerpo);
    if (!r.ok) { mostrarAviso(caja, 'error', textosDeError(r)); return; }
    await cargarDatos();
    if (editId) reunionEditando = null;
    gruposAbiertos.add(grupoId);
    flash = { tipo: 'ok', texto: editId ? 'Se guardaron los cambios de la reunión.' : 'Reunión registrada.' };
    abrir('comunion-familiar');
  });
}
function iniciarEdicionReunion(id) {
  if (!tiene('comunion-familiar', 'editar')) return;
  const r = db.reuniones.find(x => x.id === id);
  if (!r) return;
  reunionEditando = id;
  gruposAbiertos.add(r.grupoId);
  pintarGrupos();
}
function cancelarEdicionReunion() { reunionEditando = null; pintarGrupos(); }
async function eliminarReunion(id) {
  if (!tiene('comunion-familiar', 'eliminar')) return;
  const r0 = db.reuniones.find(x => x.id === id);
  if (!r0) return;
  const r = await api('DELETE', `reuniones.php?id=${id}`);
  await cargarDatos();
  if (!sesion) return;
  gruposAbiertos.add(r0.grupoId);
  flash = r.ok ? { tipo: 'ok', texto: 'Se eliminó la reunión.' } : { tipo: 'error', texto: r.datos.mensaje || 'No se pudo eliminar la reunión.' };
  abrir('comunion-familiar');
}

// Vincular un visitante a una persona ya registrada
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-vincular-visitante]');
  if (!b) return;
  const sel = b.parentElement.querySelector('select');
  const personaId = sel ? Number(sel.value) : 0;
  if (!personaId) { mostrarAviso($('#aviso-cf'), 'error', 'Elige a la persona registrada que corresponde a este visitante.'); return; }
  const r = await api('PUT', `visitantes.php?id=${Number(b.dataset.vincularVisitante)}`, { personaId });
  if (!r.ok) { mostrarAviso($('#aviso-cf'), 'error', textosDeError(r)); return; }
  await cargarDatos();
  gruposAbiertos.add(Number(b.closest('.grupo') ? b.closest('.grupo').dataset.grupo : 0));
  flash = { tipo: 'ok', texto: 'El visitante quedó vinculado a su ficha de persona.' };
  abrir('comunion-familiar');
});

/* =====================================================================
   CAMPO: ASISTENCIA PASTORAL (casos, historial y pendientes) · versión 6
   Cada caso pertenece a una persona registrada. Su historial de actuaciones solo se agrega:
   nunca se borra ni se modifica (lo impiden también los triggers de la base de datos).
   Las categorías las administra el administrador. Las reglas están en el servidor.
   ===================================================================== */
const ESTADOS_AP = ['Pendiente', 'En seguimiento', 'Atendido', 'Cerrado'];
let apFiltro = { texto: '', estado: '', categoria: '' };
const apAbiertos = new Set();   // casos con el historial desplegado
let apEditando = null;          // caso cuyos datos básicos se corrigen
const MAPA_CASO = { personas: 'ap-personas', categoriaId: 'ap-categoria', descripcion: 'ap-descripcion', fecha: 'ap-fecha',
                    responsableId: 'ap-responsable', actividad: 'ap-actividad', observaciones: 'ap-observaciones',
                    estado: 'ap-estado', proximoSeguimiento: 'ap-proximo' };
const mapaActuacion = id => ({ fecha: `act-fecha-${id}`, responsableId: `act-responsable-${id}`, actividad: `act-actividad-${id}`,
                               observaciones: `act-observaciones-${id}`, estado: `act-estado-${id}`, proximoSeguimiento: `act-proximo-${id}` });
const mapaCasoEdit = id => ({ categoriaId: `ce-categoria-${id}`, descripcion: `ce-descripcion-${id}`, responsableId: `ce-responsable-${id}` });

const casoAp = id => db.casosPastorales.find(c => c.id === id);
const actuacionesAp = id => db.actuacionesPastorales.filter(a => a.casoId === id)
  .sort((a, b) => (a.fecha === b.fecha ? a.id - b.id : a.fecha.localeCompare(b.fecha)));
const abiertoAp = c => c.estado === 'Pendiente' || c.estado === 'En seguimiento';
const vencidoAp = c => abiertoAp(c) && !!c.proximoSeguimiento && c.proximoSeguimiento < hoyISO();
const categoriasAp = (soloActivas = true) => db.categoriasPastorales.filter(c => !soloActivas || c.activo)
  .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
const nombreCategoriaAp = id => { const c = db.categoriasPastorales.find(x => x.id === id); return c ? c.nombre : '—'; };
const usuarioPorId = id => db.usuarios.find(u => u.id === id);
const nombreUsuarioId = id => { const u = usuarioPorId(id); return u ? `${u.nombres} ${u.apellidos}` : '—'; };
const responsablesAp = () => db.usuarios.filter(u => u.activo && ['admin', 'asistente', 'pastor'].includes(u.rol));
const miUsuarioId = () => { const u = db.usuarios.find(x => x.usuario === sesion.usuario); return u ? u.id : null; };
const opcionesResponsables = (sel, textoVacio) => (textoVacio ? `<option value="">${esc(textoVacio)}</option>` : '')
  + responsablesAp().map(u => `<option value="${u.id}"${u.id === sel ? ' selected' : ''}>${esc(`${u.nombres} ${u.apellidos}`)}</option>`).join('');

function statsAp() {
  const todos = db.casosPastorales;
  return `
    <div class="stat"><div class="n">${todos.filter(abiertoAp).length}</div><div class="l">Casos abiertos</div></div>
    <div class="stat"><div class="n">${todos.filter(vencidoAp).length}</div><div class="l">Seguimientos vencidos</div></div>
    <div class="stat"><div class="n">${todos.filter(c => c.estado === 'Atendido').length}</div><div class="l">Atendidos</div></div>
    <div class="stat"><div class="n">${todos.filter(c => c.estado === 'Cerrado').length}</div><div class="l">Cerrados</div></div>`;
}

function filtrosAp() {
  return `
    <div class="field corto"><label for="ap-f-texto">Buscar</label>
      <input class="control" id="ap-f-texto" value="${esc(apFiltro.texto)}" placeholder="Persona o categoría" autocomplete="off"></div>
    <div class="field corto"><label for="ap-f-estado">Estado</label>
      <select class="control" id="ap-f-estado"><option value="">Todos</option>${ESTADOS_AP.map(x => `<option${apFiltro.estado === x ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
    <div class="field corto"><label for="ap-f-categoria">Categoría</label>
      <select class="control" id="ap-f-categoria"><option value="">Todas</option>${categoriasAp(false).map(c => `<option value="${c.id}"${apFiltro.categoria === String(c.id) ? ' selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div>`;
}

function vistaAsistenciaPastoral(el) {
  const puedeRegistrar = tiene('asistencia-pastoral', 'registrar');
  const cats = categoriasAp();
  el.innerHTML = `
    <div class="aviso-caja" id="aviso-ap" aria-live="polite"></div>
    <div class="stats" id="ap-stats"></div>
    <section class="panel">
      <h2>Pendientes y próximas fechas</h2>
      <p class="panel-desc">Casos abiertos con fecha de próxima atención. Los vencidos aparecen primero.</p>
      <div id="ap-pendientes"></div>
    </section>
    ${puedeRegistrar ? (cats.length ? formularioCasoAp(cats) : vacio('No hay categorías activas.', 'El administrador las agrega abajo, en «Categorías de situación».')) : ''}
    <section class="panel">
      <h2>Casos y su historial</h2>
      <p class="panel-desc">Cada caso guarda todas sus actuaciones, en orden. Abre un caso para ver su historial.</p>
      <div class="toolbar no-print">${filtrosAp()}</div>
      <div id="ap-casos"></div>
    </section>
    ${tiene('categorias-pastorales', 'registrar') ? panelCategoriasAp() : ''}`;
  if (flash) { mostrarAviso($('#aviso-ap'), flash.tipo, flash.texto); flash = null; }
  pintarAp();
}

function pintarAp() {
  const stats = $('#ap-stats');
  if (stats) stats.innerHTML = statsAp();
  pintarPendientesAp();
  pintarCasosAp();
  pintarCategoriasAp();
}

function pintarPendientesAp() {
  const cont = $('#ap-pendientes');
  if (!cont) return;
  const lista = db.casosPastorales.filter(abiertoAp)
    .sort((a, b) => (a.proximoSeguimiento || '9999').localeCompare(b.proximoSeguimiento || '9999'));
  if (!lista.length) {
    cont.innerHTML = vacio('No hay casos abiertos.', 'Cuando un caso quede pendiente o en seguimiento, aparecerá aquí.');
    return;
  }
  cont.innerHTML = tabla('tabla-ap-pendientes', [{ t: 'Próxima atención' }, { t: 'Persona' }, { t: 'Categoría' }, { t: 'Estado' },
      { t: 'Responsable' }, { t: 'Historial', noprint: true }],
    lista.map(c => `<tr${vencidoAp(c) ? ' class="vencido"' : ''}>
      <td>${c.proximoSeguimiento ? `${esc(fechaCorta(c.proximoSeguimiento))}${vencidoAp(c) ? ' <span class="pill lock">Vencido</span>' : ''}` : '<span class="muted">Sin fecha</span>'}</td>
      <td><b>${esc(personaNombre(c.personaId))}</b></td>
      <td>${esc(nombreCategoriaAp(c.categoriaId))}</td>
      <td>${pillEstado(c.estado)}</td>
      <td>${esc(nombreUsuarioId(c.responsableId))}</td>
      <td class="no-print"><button class="btn btn-small" type="button" data-accion="ver-caso" data-id="${c.id}">Ver historial</button></td>
    </tr>`), 'Casos abiertos');
}

function casosFiltrados() {
  const txt = apFiltro.texto.trim().toLowerCase();
  return db.casosPastorales
    .filter(c => (!apFiltro.estado || c.estado === apFiltro.estado)
      && (!apFiltro.categoria || c.categoriaId === Number(apFiltro.categoria))
      && (!txt || `${personaNombre(c.personaId)} ${nombreCategoriaAp(c.categoriaId)}`.toLowerCase().includes(txt)))
    .sort((a, b) => b.fechaApertura.localeCompare(a.fechaApertura) || b.id - a.id);
}

function pintarCasosAp() {
  const cont = $('#ap-casos');
  if (!cont) return;
  const lista = casosFiltrados();
  cont.innerHTML = lista.length ? lista.map(tarjetaCasoAp).join('')
    : vacio('No hay casos con esos filtros.', 'Cambia los filtros o abre un caso nuevo.');
}

function tarjetaCasoAp(c) {
  const acts = actuacionesAp(c.id);
  const puedeSeguir = tiene('asistencia-pastoral', 'seguimiento');
  const puedeEditar = tiene('asistencia-pastoral', 'editar');
  return `<details class="caso panel" id="caso-${c.id}" data-caso="${c.id}"${apAbiertos.has(c.id) ? ' open' : ''}>
    <summary class="caso-resumen">
      <span class="caso-tit"><b>${esc(personaNombre(c.personaId))}</b> · ${esc(nombreCategoriaAp(c.categoriaId))}</span>
      <span class="caso-datos">${pillEstado(c.estado)}${vencidoAp(c) ? ' <span class="pill lock">Vencido</span>' : ''}
        <span>Próxima atención: ${c.proximoSeguimiento ? esc(fechaCorta(c.proximoSeguimiento)) : '—'}</span>
        <span>Responsable: ${esc(nombreUsuarioId(c.responsableId))}</span>
        <span>Abierto el ${esc(fechaCorta(c.fechaApertura))} · ${acts.length} ${acts.length === 1 ? 'actuación' : 'actuaciones'}</span>
      </span>
    </summary>
    <div class="caso-cuerpo">
      ${apEditando === c.id ? formularioEditarCasoAp(c) : `
        <p class="sub-dato"><b>Descripción de la situación:</b> ${esc(c.descripcion)}</p>
        ${puedeEditar ? `<div class="acciones" style="margin:10px 0"><button class="btn btn-small" type="button" data-accion="editar-caso" data-id="${c.id}">Corregir datos del caso</button></div>` : ''}`}
      <h3 class="subtitulo-form">Historial de actuaciones</h3>
      ${acts.length ? tabla(`tabla-historial-${c.id}`, [{ t: 'Fecha' }, { t: 'Responsable' }, { t: 'Actividad' }, { t: 'Observaciones' },
          { t: 'Estado' }, { t: 'Próxima atención' }],
        acts.map(a => `<tr><td>${esc(fechaCorta(a.fecha))}</td><td>${esc(nombreUsuarioId(a.responsableId))}</td><td>${esc(a.actividad)}</td>
          <td>${a.observaciones ? esc(a.observaciones) : '<span class="muted">—</span>'}</td><td>${pillEstado(a.estado)}</td>
          <td>${a.proximoSeguimiento ? esc(fechaCorta(a.proximoSeguimiento)) : '<span class="muted">—</span>'}</td></tr>`),
        'Historial del caso') : vacio('Sin actuaciones registradas.', '')}
      ${puedeSeguir ? formularioActuacionAp(c) : ''}
    </div>
  </details>`;
}

function formularioCasoAp(cats) {
  const yo = miUsuarioId();
  return `<section class="panel">
    <form id="form-caso" novalidate>
      <div class="aviso-caja" id="aviso-caso" aria-live="polite"></div>
      <h2>Abrir un caso</h2>
      <p class="form-intro">Los campos con <span class="req">*</span> son obligatorios. Para varias personas a la vez, márcalas todas: cada una tendrá su propio caso con la misma situación.</p>
      <div class="form-grid">
        <div class="field full"><span class="label-like">Personas atendidas <span class="req" aria-hidden="true">*</span></span>
          <div class="checklist" id="ap-personas">${todasLasPersonas().map(p => `<label class="check-fila"><input type="checkbox" name="personas" value="${p.num}"> ${esc(`${p.nombres} ${p.apellidos}`)}</label>`).join('')}</div>
        </div>
        <div class="field"><label for="ap-categoria">Categoría <span class="req" aria-hidden="true">*</span></label>
          <select class="control" id="ap-categoria" name="categoriaId">${cats.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</select></div>
        <div class="field"><label for="ap-fecha">Fecha de la atención <span class="req" aria-hidden="true">*</span></label>
          <input class="control" id="ap-fecha" name="fecha" type="date" max="${hoyISO()}" value="${hoyISO()}"></div>
        <div class="field"><label for="ap-responsable">Responsable</label>
          <select class="control" id="ap-responsable" name="responsableId">${opcionesResponsables(yo)}</select></div>
        <div class="field"><label for="ap-estado">Estado <span class="req" aria-hidden="true">*</span></label>
          <select class="control" id="ap-estado" name="estado">${ESTADOS_AP.map(x => `<option${x === 'Pendiente' ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
        <div class="field"><label for="ap-proximo">Próximo seguimiento</label>
          <input class="control" id="ap-proximo" name="proximoSeguimiento" type="date"></div>
        <div class="field full"><label for="ap-descripcion">Descripción de la situación <span class="req" aria-hidden="true">*</span></label>
          <textarea class="control" id="ap-descripcion" name="descripcion" rows="2"></textarea></div>
        <div class="field full"><label for="ap-actividad">Actividad o atención realizada <span class="req" aria-hidden="true">*</span></label>
          <textarea class="control" id="ap-actividad" name="actividad" rows="2"></textarea></div>
        <div class="field full"><label for="ap-observaciones">Observaciones</label>
          <textarea class="control" id="ap-observaciones" name="observaciones" rows="2"></textarea></div>
      </div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Abrir caso</button><button class="btn" type="reset">Limpiar</button></div>
    </form>
  </section>`;
}

function formularioActuacionAp(c) {
  const id = c.id;
  return `<form class="form-actuacion" data-caso="${id}" novalidate>
    <div class="aviso-caja" data-aviso-actuacion="${id}" aria-live="polite"></div>
    <h3 class="subtitulo-form">Registrar una actuación</h3>
    <p class="hint">Se agrega al historial. Las actuaciones anteriores no se modifican.</p>
    <div class="form-grid">
      <div class="field"><label for="act-fecha-${id}">Fecha <span class="req" aria-hidden="true">*</span></label>
        <input class="control" id="act-fecha-${id}" name="fecha" type="date" max="${hoyISO()}" value="${hoyISO()}"></div>
      <div class="field"><label for="act-responsable-${id}">Responsable</label>
        <select class="control" id="act-responsable-${id}" name="responsableId">${opcionesResponsables(miUsuarioId())}</select></div>
      <div class="field"><label for="act-estado-${id}">Estado <span class="req" aria-hidden="true">*</span></label>
        <select class="control" id="act-estado-${id}" name="estado">${ESTADOS_AP.map(x => `<option${x === c.estado ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label for="act-proximo-${id}">Próximo seguimiento</label>
        <input class="control" id="act-proximo-${id}" name="proximoSeguimiento" type="date"></div>
      <div class="field full"><label for="act-actividad-${id}">Actividad o atención realizada <span class="req" aria-hidden="true">*</span></label>
        <textarea class="control" id="act-actividad-${id}" name="actividad" rows="2"></textarea></div>
      <div class="field full"><label for="act-observaciones-${id}">Observaciones</label>
        <textarea class="control" id="act-observaciones-${id}" name="observaciones" rows="2"></textarea></div>
    </div>
    <div class="form-actions"><button class="btn btn-primary" type="submit">Agregar actuación</button></div>
  </form>`;
}

function formularioEditarCasoAp(c) {
  const id = c.id;
  return `<form class="form-editar-caso" data-caso="${id}" novalidate>
    <div class="aviso-caja" data-aviso-caso-edit="${id}" aria-live="polite"></div>
    <h3 class="subtitulo-form">Corregir datos del caso</h3>
    <p class="hint">Corrige la categoría, la descripción o el responsable. El historial no cambia.</p>
    <div class="form-grid">
      <div class="field"><label for="ce-categoria-${id}">Categoría</label>
        <select class="control" id="ce-categoria-${id}" name="categoriaId">${categoriasAp(false).map(x => `<option value="${x.id}"${x.id === c.categoriaId ? ' selected' : ''}>${esc(x.nombre)}${x.activo ? '' : ' (desactivada)'}</option>`).join('')}</select></div>
      <div class="field"><label for="ce-responsable-${id}">Responsable</label>
        <select class="control" id="ce-responsable-${id}" name="responsableId">${opcionesResponsables(c.responsableId)}</select></div>
      <div class="field full"><label for="ce-descripcion-${id}">Descripción de la situación <span class="req" aria-hidden="true">*</span></label>
        <textarea class="control" id="ce-descripcion-${id}" name="descripcion" rows="2">${esc(c.descripcion)}</textarea></div>
    </div>
    <div class="form-actions"><button class="btn btn-primary" type="submit">Guardar datos</button>
      <button class="btn" type="button" data-accion="cancelar-editar-caso">Cancelar</button></div>
  </form>`;
}

function panelCategoriasAp() {
  return `<section class="panel">
    <h2>Categorías de situación</h2>
    <p class="panel-desc">Solo el administrador las administra. Una categoría desactivada deja de ofrecerse al abrir casos, pero los casos anteriores la conservan.</p>
    <form id="form-categoria" novalidate>
      <div class="aviso-caja" id="aviso-categoria" aria-live="polite"></div>
      <div class="inline">
        <input class="control" id="cat-nueva" name="nombre" placeholder="Nombre de la nueva categoría" autocomplete="off" aria-label="Nombre de la nueva categoría">
        <button class="btn btn-primary" type="submit">Agregar categoría</button>
      </div>
    </form>
    <div id="ap-categorias" style="margin-top:14px"></div>
  </section>`;
}

function pintarCategoriasAp() {
  const cont = $('#ap-categorias');
  if (!cont) return;
  cont.innerHTML = db.categoriasPastorales.length
    ? `<ul class="lista-simple">${db.categoriasPastorales.map(c => `<li><span>${esc(c.nombre)}${c.activo ? '' : ' <span class="pill lock">Desactivada</span>'}</span>
        <button class="btn btn-small" type="button" data-accion="activar-categoria" data-id="${c.id}" data-activo="${c.activo ? '0' : '1'}">${c.activo ? 'Desactivar' : 'Activar'}</button></li>`).join('')}</ul>`
    : '<p class="muted">Todavía no hay categorías.</p>';
}

async function enviarCasoAp(form) {
  if (!tiene('asistencia-pastoral', 'registrar')) return;
  const f = new FormData(form), caja = $('#aviso-caso');
  const personas = f.getAll('personas').map(Number);
  const fecha = f.get('fecha') || '', estado = f.get('estado') || 'Pendiente', proximo = f.get('proximoSeguimiento') || '';
  const descripcion = String(f.get('descripcion') || '').trim(), actividad = String(f.get('actividad') || '').trim();
  const errores = [];
  const falla = (campo, texto) => errores.push({ campo, texto });
  if (!personas.length) falla('ap-personas', 'Marca al menos una persona atendida.');
  if (!f.get('categoriaId')) falla('ap-categoria', 'Elige la categoría.');
  if (!fecha) falla('ap-fecha', 'Elige la fecha de la atención.');
  else if (fecha > hoyISO()) falla('ap-fecha', 'La fecha no puede ser futura.');
  if (!descripcion) falla('ap-descripcion', 'Escribe la descripción de la situación.');
  if (!actividad) falla('ap-actividad', 'Escribe la actividad o atención realizada.');
  if (proximo && estado === 'Cerrado') falla('ap-proximo', 'Un caso cerrado no tiene próximo seguimiento.');
  if (errores.length) { mostrarErrores(form, caja, errores); return; }
  if (personas.length > 1 && !tiene('asistencia-pastoral', 'masivo')) {
    mostrarAviso(caja, 'error', 'Tu cargo no puede abrir casos para varias personas a la vez: marca solo una.');
    return;
  }
  const cuerpo = { personas, categoriaId: Number(f.get('categoriaId')), descripcion, responsableId: Number(f.get('responsableId')) || null,
                   fecha, actividad, observaciones: String(f.get('observaciones') || '').trim(), estado, proximoSeguimiento: proximo };
  await conBoton(form, async () => {
    const r = await api('POST', 'asistencia_pastoral.php', cuerpo);
    if (!r.ok) { errorDeServidor(form, caja, r, MAPA_CASO); return; }
    await cargarDatos();
    flash = { tipo: 'ok', texto: personas.length > 1 ? `Se abrieron ${personas.length} casos con la misma situación.` : 'Se abrió el caso.' };
    abrir('asistencia-pastoral');
  });
}

async function enviarActuacionAp(form) {
  const id = Number(form.dataset.caso);
  if (!tiene('asistencia-pastoral', 'seguimiento')) return;
  const f = new FormData(form), caja = form.querySelector(`[data-aviso-actuacion="${id}"]`);
  const fecha = f.get('fecha') || '', actividad = String(f.get('actividad') || '').trim();
  const estado = f.get('estado') || 'En seguimiento', proximo = f.get('proximoSeguimiento') || '';
  const errores = [];
  const falla = (campo, texto) => errores.push({ campo, texto });
  if (!fecha) falla(`act-fecha-${id}`, 'Elige la fecha de la atención.');
  else if (fecha > hoyISO()) falla(`act-fecha-${id}`, 'La fecha no puede ser futura.');
  if (!actividad) falla(`act-actividad-${id}`, 'Escribe la actividad o atención realizada.');
  if (proximo && estado === 'Cerrado') falla(`act-proximo-${id}`, 'Un caso cerrado no tiene próximo seguimiento.');
  if (errores.length) { mostrarErrores(form, caja, errores); return; }
  const cuerpo = { fecha, responsableId: Number(f.get('responsableId')) || null, actividad,
                   observaciones: String(f.get('observaciones') || '').trim(), estado, proximoSeguimiento: proximo };
  await conBoton(form, async () => {
    const r = await api('POST', `asistencia_pastoral.php?caso=${id}`, cuerpo);
    if (!r.ok) { errorDeServidor(form, caja, r, mapaActuacion(id)); return; }
    await cargarDatos();
    apAbiertos.add(id);
    flash = { tipo: 'ok', texto: 'Se agregó la actuación al historial del caso.' };
    abrir('asistencia-pastoral');
  });
}

async function enviarEdicionCasoAp(form) {
  const id = Number(form.dataset.caso);
  if (!tiene('asistencia-pastoral', 'editar')) return;
  const f = new FormData(form), caja = form.querySelector(`[data-aviso-caso-edit="${id}"]`);
  const descripcion = String(f.get('descripcion') || '').trim();
  if (!descripcion) { mostrarErrores(form, caja, [{ campo: `ce-descripcion-${id}`, texto: 'Escribe la descripción de la situación.' }]); return; }
  const cuerpo = { categoriaId: Number(f.get('categoriaId')), descripcion, responsableId: Number(f.get('responsableId')) || null };
  await conBoton(form, async () => {
    const r = await api('PUT', `asistencia_pastoral.php?id=${id}`, cuerpo);
    if (!r.ok) { errorDeServidor(form, caja, r, mapaCasoEdit(id)); return; }
    await cargarDatos();
    apEditando = null;
    apAbiertos.add(id);
    flash = { tipo: 'ok', texto: 'Se corrigieron los datos del caso. El historial no cambió.' };
    abrir('asistencia-pastoral');
  });
}

async function enviarCategoriaAp(form) {
  const caja = $('#aviso-categoria');
  const nombre = String(new FormData(form).get('nombre') || '').trim();
  if (!nombre) { mostrarAviso(caja, 'error', 'Escribe el nombre de la categoría.'); return; }
  await conBoton(form, async () => {
    const r = await api('POST', 'categorias_pastorales.php', { nombre });
    if (!r.ok) { mostrarAviso(caja, 'error', textosDeError(r)); return; }
    await cargarDatos();
    flash = { tipo: 'ok', texto: `Se agregó la categoría «${nombre}».` };
    abrir('asistencia-pastoral');
  });
}

async function cambiarCategoriaAp(btn) {
  if (!tiene('categorias-pastorales', 'editar')) return;
  const id = Number(btn.dataset.id), activo = btn.dataset.activo === '1';
  const r = await api('PUT', `categorias_pastorales.php?id=${id}`, { activo });
  if (!r.ok) { mostrarAviso($('#aviso-categoria'), 'error', textosDeError(r)); return; }
  await cargarDatos();
  flash = { tipo: 'ok', texto: activo ? 'Se activó la categoría.' : 'Se desactivó la categoría. Los casos anteriores la conservan.' };
  abrir('asistencia-pastoral');
}

document.addEventListener('submit', e => {
  const f = e.target;
  if (f.id === 'form-caso') { e.preventDefault(); enviarCasoAp(f); }
  else if (f.id === 'form-categoria') { e.preventDefault(); enviarCategoriaAp(f); }
  else if (f.classList.contains('form-actuacion')) { e.preventDefault(); enviarActuacionAp(f); }
  else if (f.classList.contains('form-editar-caso')) { e.preventDefault(); enviarEdicionCasoAp(f); }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-accion]');
  if (!b) return;
  const id = Number(b.dataset.id);
  switch (b.dataset.accion) {
    case 'ver-caso': apAbiertos.add(id); pintarAp(); { const c = document.getElementById(`caso-${id}`); if (c) c.scrollIntoView({ block: 'start' }); } break;
    case 'editar-caso': apEditando = id; apAbiertos.add(id); pintarAp(); break;
    case 'cancelar-editar-caso': apEditando = null; pintarAp(); break;
    case 'activar-categoria': cambiarCategoriaAp(b); break;
    default: break;
  }
});
// Mantiene abiertos los casos que la persona despliega (la lista se vuelve a pintar al cambiar datos)
document.addEventListener('toggle', e => {
  const d = e.target;
  if (d.classList && d.classList.contains('caso') && d.dataset.caso) {
    const id = Number(d.dataset.caso);
    if (d.open) apAbiertos.add(id); else apAbiertos.delete(id);
  }
}, true);
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'ap-f-estado') { apFiltro.estado = t.value; pintarCasosAp(); }
  else if (t.id === 'ap-f-categoria') { apFiltro.categoria = t.value; pintarCasosAp(); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'ap-f-texto') { apFiltro.texto = e.target.value; pintarCasosAp(); }
});


/* =====================================================================
   CAMPO: ADIESTRAMIENTO (cursos, participantes y sesiones) · versión 4
   Cada curso tiene un adiestrador habitual y participantes inscritos. Cada sesión registra
   quién la impartió: si no fue el habitual, es una sustitución y lleva su novedad.
   Los datos y las reglas están en el servidor (api/sesiones.php y api/adiestramiento.php).
   ===================================================================== */
let sesionEditando = null;
let adFiltro = { curso: '', adiestrador: '', desde: '', hasta: '' };
const MAPA_SESION = { cursoId: 'se-curso', nivelId: 'se-nivel', temaId: 'se-tema', fecha: 'se-fecha', horaInicio: 'se-inicio',
                      horaFin: 'se-fin', lugar: 'se-lugar', adiestradorId: 'se-adiestrador', asistencia: 'se-asistencia',
                      novedades: 'se-novedades', observaciones: 'se-observaciones' };

const cursosAd = () => {
  const p = db.procesos.find(x => x.clave === 'adiestramiento');
  return p ? db.cursos.filter(c => c.procesoId === p.id).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) : [];
};
const cursoAd = id => db.cursos.find(c => c.id === id);
const adiestradores = () => db.personas.filter(p => Array.isArray(p.funciones) && p.funciones.includes('adiestrador')).sort(porNombreCompleto);
const inscritosAd = c => (c ? db.personas.filter(p => c.participantes.includes(p.num)).sort(porNombreCompleto) : []);
const personasNoInscritas = cursoId => {
  const c = cursoAd(cursoId);
  const ya = new Set(c ? c.participantes : []);
  return todasLasPersonas().filter(p => !ya.has(p.num));
};
// Último jueves (hoy si es jueves): día habitual de las sesiones. Se registra después de que ocurre.
function ultimoJueves() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() - 4 + 7) % 7));
  return iso(d);
}
function opcionesNivelesAd(cursoId, sel) {
  return '<option value="">Sin nivel</option>' + db.niveles
    .filter(n => n.cursoId === cursoId && n.activo)
    .map(n => `<option value="${n.id}"${n.id === sel ? ' selected' : ''}>${esc(n.nombre)}</option>`).join('');
}
function opcionesTemasAd(cursoId, nivelId, sel) {
  return '<option value="">Sin tema (pendiente de catálogo)</option>' + db.temas
    .filter(t => t.cursoId === cursoId && t.activo && (nivelId ? t.nivelId === nivelId : t.nivelId === null))
    .map(t => `<option value="${t.id}"${t.id === sel ? ' selected' : ''}>${esc(t.nombre)}</option>`).join('');
}
function checklistAd(personas, marcados, nombreCampo) {
  if (!personas.length) return '<p class="muted">No hay personas para mostrar.</p>';
  return `<div class="checklist">${personas.map(p => `<label class="check-fila"><input type="checkbox" name="${nombreCampo}" value="${p.num}"${marcados.has(p.num) ? ' checked' : ''}> ${esc(`${p.nombres} ${p.apellidos}`)}</label>`).join('')}</div>`;
}

function vistaAdiestramiento(el) {
  const cursos = cursosAd();
  const activos = cursos.filter(c => c.activo);
  const puedeRegistrar = tiene('adiestramiento', 'registrar');
  const puedeMasivo = tiene('adiestramiento', 'masivo');
  const puedeEditar = tiene('adiestramiento', 'editar');
  const puedeEliminar = tiene('adiestramiento', 'eliminar');
  const s = sesionEditando ? db.sesiones.find(x => x.id === sesionEditando) : null;
  el.innerHTML = `
    <div class="aviso-caja" id="aviso-ad" aria-live="polite"></div>
    ${cursos.length ? `
    <section class="panel">
      <h2>Cursos y participantes</h2>
      <p class="panel-desc">Cada curso tiene un adiestrador habitual. Si otra persona imparte una sesión, se registra como sustitución con su novedad.</p>
      ${cursos.map(c => tarjetaCursoAd(c, puedeEditar, puedeEliminar)).join('')}
    </section>
    ${puedeRegistrar && activos.length ? formularioInscripcionAd(activos, puedeMasivo) : ''}
    ${(puedeRegistrar || s) && activos.length ? formularioSesionAd(s) : ''}`
    : vacio('No hay cursos de Adiestramiento.', 'El administrador los agrega en «Catálogo de formación».')}
    <section class="panel">
      <h2>Historial de sesiones</h2>
      <div class="toolbar no-print">${filtrosAd(cursos)}</div>
      <div id="ad-historial"></div>
    </section>`;
  if (flash) { mostrarAviso($('#aviso-ad'), flash.tipo, flash.texto); flash = null; }
  pintarHistorialAd();
  actualizarSustitucionAd();
  if (s) { const f = $('#form-sesion'); if (f) f.scrollIntoView({ block: 'start' }); }
}

function tarjetaCursoAd(c, puedeEditar, puedeEliminar) {
  const participantes = inscritosAd(c);
  const opciones = '<option value="">Sin adiestrador habitual</option>' + adiestradores()
    .map(p => `<option value="${p.num}"${p.num === c.responsableId ? ' selected' : ''}>${esc(`${p.nombres} ${p.apellidos}`)}</option>`).join('');
  return `<div class="cat-curso">
    <div class="cat-titulo"><span class="cat-nombre">${esc(c.nombre)}</span>${c.activo ? '' : ' <span class="pill lock">Inactivo</span>'}</div>
    <div class="form-grid" style="margin-top:10px">
      <div class="field">
        <label for="resp-${c.id}">Adiestrador habitual</label>
        <div class="inline">
          <select class="control" id="resp-${c.id}"${puedeEditar ? '' : ' disabled'}>${opciones}</select>
          ${puedeEditar ? `<button class="btn btn-small" type="button" data-accion="guardar-responsable" data-curso="${c.id}">Guardar</button>` : ''}
        </div>
      </div>
      <div class="field">
        <span class="label-like">Participantes (${participantes.length})</span>
        ${participantes.length ? `<ul class="lista-simple">${participantes.map(p => `<li><span>${esc(`${p.nombres} ${p.apellidos}`)}</span>${puedeEliminar ? `<button class="btn btn-small btn-peligro" type="button" data-accion="quitar-participante" data-curso="${c.id}" data-persona="${p.num}">Quitar</button>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Nadie inscrito todavía.</p>'}
      </div>
    </div>
  </div>`;
}

function formularioInscripcionAd(activos, puedeMasivo) {
  return `<section class="panel">
    <form id="form-inscripcion" novalidate>
      <div class="aviso-caja" id="aviso-inscripcion" aria-live="polite"></div>
      <h2>Inscribir personas en un curso</h2>
      <p class="panel-desc">${puedeMasivo ? 'Puedes marcar varias personas a la vez (registro masivo).' : 'Tu cargo puede inscribir una persona a la vez.'} Las personas que ya están inscritas no aparecen.</p>
      <div class="form-grid">
        <div class="field full">
          <label for="ins-curso">Curso</label>
          <select class="control" id="ins-curso" name="cursoId">${activos.map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('')}</select>
        </div>
        <div class="field full">
          <span class="label-like">Personas</span>
          <div id="ins-lista">${checklistAd(personasNoInscritas(activos[0].id), new Set(), 'personas')}</div>
        </div>
      </div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Inscribir</button></div>
    </form>
  </section>`;
}

function formularioSesionAd(s) {
  const activos = cursosAd().filter(c => c.activo);
  const c = (s && cursoAd(s.cursoId)) || activos[0];
  const inscritos = inscritosAd(c);
  const marcados = new Set(s ? s.asistencia : []);
  const adiestradorSel = s ? s.adiestradorId : (c.responsableId || null);
  return `<section class="panel">
    <form id="form-sesion" novalidate>
      <div class="aviso-caja" id="aviso-sesion" aria-live="polite"></div>
      <h2>${s ? 'Editar la sesión' : 'Registrar una sesión'}</h2>
      <p class="form-intro">Los campos con <span class="req">*</span> son obligatorios.</p>
      <div class="form-grid">
        <div class="field"><label for="se-curso">Curso <span class="req" aria-hidden="true">*</span></label>
          <select class="control" id="se-curso" name="cursoId">${activos.map(x => `<option value="${x.id}"${x.id === c.id ? ' selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></div>
        <div class="field"><label for="se-nivel">Nivel o etapa</label>
          <select class="control" id="se-nivel" name="nivelId">${opcionesNivelesAd(c.id, s ? s.nivelId : null)}</select></div>
        <div class="field"><label for="se-tema">Tema impartido</label>
          <select class="control" id="se-tema" name="temaId">${opcionesTemasAd(c.id, s ? s.nivelId : null, s ? s.temaId : null)}</select>
          <p class="hint">Los temas se agregan en «Catálogo de formación».</p></div>
        <div class="field"><label for="se-fecha">Fecha <span class="req" aria-hidden="true">*</span></label>
          <input class="control" id="se-fecha" name="fecha" type="date" max="${hoyISO()}" value="${esc(s ? s.fecha : ultimoJueves())}"></div>
        <div class="field"><label for="se-inicio">Hora de inicio <span class="req" aria-hidden="true">*</span></label>
          <input class="control" id="se-inicio" name="horaInicio" type="time" value="${esc(s ? s.horaInicio : '19:00')}"></div>
        <div class="field"><label for="se-fin">Hora de fin</label>
          <input class="control" id="se-fin" name="horaFin" type="time" value="${esc(s ? s.horaFin : '')}"></div>
        <div class="field"><label for="se-lugar">Lugar</label>
          <input class="control" id="se-lugar" name="lugar" value="${esc(s ? s.lugar : 'Iglesia')}" autocomplete="off"></div>
        <div class="field"><label for="se-adiestrador">Quién impartió la sesión <span class="req" aria-hidden="true">*</span></label>
          <select class="control" id="se-adiestrador" name="adiestradorId">${opcionesPersonas(adiestradores(), adiestradorSel, 'Elige una persona')}</select>
          <p class="hint" id="se-sustitucion" hidden></p></div>
        <div class="field full"><span class="label-like">Asistentes (inscritos en el curso)</span>
          <div id="se-asistencia">${inscritos.length ? checklistAd(inscritos, marcados, 'asistencia') : '<p class="muted">Este curso no tiene participantes inscritos. Inscríbelos arriba.</p>'}</div></div>
        <div class="field full"><label for="se-novedades">Novedades <span class="req" id="se-novedades-req" aria-hidden="true" hidden>*</span></label>
          <textarea class="control" id="se-novedades" name="novedades" rows="2" placeholder="Por ejemplo: quién impartió la sesión y por qué no fue el adiestrador habitual">${esc(s ? s.novedades : '')}</textarea></div>
        <div class="field full"><label for="se-observaciones">Observaciones</label>
          <textarea class="control" id="se-observaciones" name="observaciones" rows="2">${esc(s ? s.observaciones : '')}</textarea></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" type="submit">${s ? 'Guardar cambios' : 'Registrar sesión'}</button>
        <button class="btn" type="reset">${s ? 'Deshacer cambios' : 'Limpiar'}</button>
        ${s ? '<button class="btn" type="button" data-accion="cancelar-edicion-sesion">Cancelar</button>' : ''}
      </div>
    </form>
  </section>`;
}

function filtrosAd(cursos) {
  return `
    <div class="field corto"><label for="ad-f-curso">Curso</label>
      <select class="control" id="ad-f-curso"><option value="">Todos</option>${cursos.map(c => `<option value="${c.id}"${adFiltro.curso === String(c.id) ? ' selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div>
    <div class="field corto"><label for="ad-f-adiestrador">Adiestrador</label>
      <select class="control" id="ad-f-adiestrador"><option value="">Todos</option>${adiestradores().map(p => `<option value="${p.num}"${adFiltro.adiestrador === String(p.num) ? ' selected' : ''}>${esc(`${p.nombres} ${p.apellidos}`)}</option>`).join('')}</select></div>
    <div class="field corto"><label for="ad-f-desde">Desde</label>
      <input class="control" type="date" id="ad-f-desde" value="${esc(adFiltro.desde)}"></div>
    <div class="field corto"><label for="ad-f-hasta">Hasta</label>
      <input class="control" type="date" id="ad-f-hasta" value="${esc(adFiltro.hasta)}"></div>`;
}

function pintarHistorialAd() {
  const cont = $('#ad-historial');
  if (!cont) return;
  const puedeEditar = tiene('adiestramiento', 'editar');
  const puedeEliminar = tiene('adiestramiento', 'eliminar');
  const lista = db.sesiones
    .filter(x => (!adFiltro.curso || x.cursoId === Number(adFiltro.curso))
      && (!adFiltro.adiestrador || x.adiestradorId === Number(adFiltro.adiestrador))
      && (!adFiltro.desde || x.fecha >= adFiltro.desde)
      && (!adFiltro.hasta || x.fecha <= adFiltro.hasta))
    .sort((a, b) => (b.fecha + b.horaInicio).localeCompare(a.fecha + a.horaInicio));
  if (!lista.length) {
    cont.innerHTML = vacio('No hay sesiones con esos filtros.', 'Cambia los filtros o registra una sesión.');
    return;
  }
  const columnas = [{ t: 'Fecha' }, { t: 'Horario' }, { t: 'Curso' }, { t: 'Nivel y tema' }, { t: 'Impartió' },
    { t: 'Asistieron', num: true }, { t: 'Lugar' }, { t: 'Novedades' }];
  if (puedeEditar || puedeEliminar) columnas.push({ t: 'Acciones', noprint: true });
  cont.innerHTML = tabla('tabla-sesiones', columnas, lista.map(s => {
    const c = cursoAd(s.cursoId);
    const tema = s.temaId ? db.temas.find(t => t.id === s.temaId) : null;
    const nivel = s.nivelId ? db.niveles.find(n => n.id === s.nivelId) : null;
    const nt = [nivel && nivel.nombre, tema && tema.nombre].filter(Boolean).join(' · ') || '<span class="muted">Sin tema</span>';
    return `<tr${s.id === sesionEditando ? ' class="resaltada"' : ''}>
      <td>${esc(fechaCorta(s.fecha))}</td>
      <td>${esc(s.horaInicio)}${s.horaFin ? '–' + esc(s.horaFin) : ''}</td>
      <td>${c ? esc(c.nombre) : '—'}</td>
      <td>${nt}</td>
      <td>${esc(personaNombre(s.adiestradorId))}${s.esSustitucion ? ' <span class="pill sustitucion">Sustitución</span>' : ''}</td>
      <td class="num">${s.asistencia.length}${c ? ` de ${c.participantes.length}` : ''}</td>
      <td>${esc(s.lugar)}</td>
      <td>${s.novedades ? esc(s.novedades) : '<span class="muted">—</span>'}</td>
      ${puedeEditar || puedeEliminar ? `<td class="no-print"><div class="acciones">
        ${puedeEditar ? `<button class="btn btn-small" type="button" data-accion="editar-sesion" data-id="${s.id}">Editar</button>` : ''}
        ${puedeEliminar ? `<button class="btn btn-small btn-peligro" type="button" data-accion="eliminar-sesion" data-id="${s.id}">Eliminar</button>` : ''}
      </div></td>` : ''}
    </tr>`;
  }), 'Historial de sesiones de Adiestramiento');
}

// Avisa cuando la sesión la imparte alguien distinto al adiestrador habitual, y exige la novedad
function actualizarSustitucionAd() {
  const sel = $('#se-adiestrador'), cursoSel = $('#se-curso'), aviso = $('#se-sustitucion'), req = $('#se-novedades-req');
  if (!sel || !cursoSel || !aviso) return;
  const curso = cursoAd(Number(cursoSel.value));
  const elegido = Number(sel.value) || 0;
  const habitual = curso ? curso.responsableId : null;
  const sust = !!(habitual && elegido && elegido !== habitual);
  aviso.hidden = !sust;
  aviso.innerHTML = sust ? `<b>Sustitución:</b> no imparte el adiestrador habitual (${esc(personaNombre(habitual))}). Escribe la novedad.` : '';
  if (req) req.hidden = !sust;
}
function refrescarFormularioSesionAd() {
  const curso = cursoAd(Number($('#se-curso').value));
  if (!curso) return;
  $('#se-nivel').innerHTML = opcionesNivelesAd(curso.id, null);
  $('#se-tema').innerHTML = opcionesTemasAd(curso.id, null, null);
  const inscritos = inscritosAd(curso);
  $('#se-asistencia').innerHTML = inscritos.length ? checklistAd(inscritos, new Set(), 'asistencia')
    : '<p class="muted">Este curso no tiene participantes inscritos. Inscríbelos arriba.</p>';
  if (curso.responsableId) $('#se-adiestrador').value = String(curso.responsableId);
  actualizarSustitucionAd();
}
function refrescarTemasAd() {
  const curso = cursoAd(Number($('#se-curso').value));
  if (curso) $('#se-tema').innerHTML = opcionesTemasAd(curso.id, Number($('#se-nivel').value) || null, null);
}

async function enviarSesion(form) {
  if (!tiene('adiestramiento', sesionEditando ? 'editar' : 'registrar')) return;
  const f = new FormData(form), caja = $('#aviso-sesion');
  const cursoId = Number(f.get('cursoId')) || 0;
  const fecha = f.get('fecha') || '', inicio = f.get('horaInicio') || '', fin = f.get('horaFin') || '';
  const adiestradorId = Number(f.get('adiestradorId')) || 0;
  const novedades = String(f.get('novedades') || '').trim();
  const curso = cursoAd(cursoId);
  const sustitucion = !!(curso && curso.responsableId && adiestradorId && adiestradorId !== curso.responsableId);
  const errores = [];
  const falla = (campo, texto) => errores.push({ campo, texto });
  if (!cursoId) falla('se-curso', 'Elige el curso.');
  if (!fecha) falla('se-fecha', 'Elige la fecha de la sesión.');
  else if (fecha > hoyISO()) falla('se-fecha', 'La fecha no puede ser futura.');
  if (!inicio) falla('se-inicio', 'Elige la hora de inicio.');
  if (fin && inicio && fin <= inicio) falla('se-fin', 'La hora de fin debe ser posterior a la de inicio.');
  if (!adiestradorId) falla('se-adiestrador', 'Elige quién impartió la sesión.');
  if (sustitucion && !novedades) falla('se-novedades', 'Como otra persona impartió la sesión, escribe la novedad.');
  if (errores.length) { mostrarErrores(form, caja, errores); return; }
  const cuerpo = {
    cursoId, nivelId: Number(f.get('nivelId')) || null, temaId: Number(f.get('temaId')) || null,
    fecha, horaInicio: inicio, horaFin: fin, lugar: String(f.get('lugar') || '').trim(), adiestradorId,
    asistencia: f.getAll('asistencia').map(Number), novedades, observaciones: String(f.get('observaciones') || '').trim(),
  };
  await conBoton(form, async () => {
    const r = sesionEditando ? await api('PUT', `sesiones.php?id=${sesionEditando}`, cuerpo) : await api('POST', 'sesiones.php', cuerpo);
    if (!r.ok) { errorDeServidor(form, caja, r, MAPA_SESION); return; }
    await cargarDatos();
    sesionEditando = null;
    flash = { tipo: 'ok', texto: 'Se guardó la sesión.' };
    abrir('adiestramiento');
  });
}

async function inscribirParticipantes(form) {
  if (!tiene('adiestramiento', 'registrar')) return;
  const f = new FormData(form), caja = $('#aviso-inscripcion');
  const cursoId = Number(f.get('cursoId')) || 0;
  const personas = f.getAll('personas').map(Number);
  if (!cursoId) { mostrarAviso(caja, 'error', 'Elige el curso.'); return; }
  if (!personas.length) { mostrarAviso(caja, 'error', 'Marca al menos una persona.'); return; }
  await conBoton(form, async () => {
    const r = await api('POST', `adiestramiento.php?curso=${cursoId}`, { personas });
    if (!r.ok) { mostrarAviso(caja, 'error', textosDeError(r)); return; }
    await cargarDatos();
    const n = r.datos.agregados, ya = r.datos.yaEstaban;
    const nombre = (cursoAd(cursoId) || {}).nombre || '';
    flash = { tipo: 'ok', texto: `Se inscribieron ${n} ${n === 1 ? 'persona' : 'personas'} en «${nombre}»${ya ? ` (${ya} ya estaban en el curso)` : ''}.` };
    abrir('adiestramiento');
  });
}

async function guardarResponsable(btn) {
  if (!tiene('adiestramiento', 'editar')) return;
  const cursoId = Number(btn.dataset.curso);
  const sel = $(`#resp-${cursoId}`);
  const valor = sel && sel.value ? Number(sel.value) : null;
  const r = await api('PUT', `adiestramiento.php?curso=${cursoId}`, { responsableId: valor });
  if (!r.ok) { mostrarAviso($('#aviso-ad'), 'error', textosDeError(r)); return; }
  await cargarDatos();
  flash = { tipo: 'ok', texto: valor ? 'Se guardó el adiestrador habitual del curso.' : 'El curso quedó sin adiestrador habitual.' };
  abrir('adiestramiento');
}

async function quitarParticipante(cursoId, personaId) {
  if (!tiene('adiestramiento', 'eliminar')) return;
  const r = await api('DELETE', `adiestramiento.php?curso=${cursoId}&persona=${personaId}`);
  await cargarDatos();
  if (!sesion) return;
  flash = r.ok ? { tipo: 'ok', texto: 'Se quitó a la persona del curso.' } : { tipo: 'error', texto: r.datos.mensaje || 'No se pudo quitar a la persona.' };
  abrir('adiestramiento');
}

function iniciarEdicionSesion(id) {
  if (!tiene('adiestramiento', 'editar') || !db.sesiones.some(s => s.id === id)) return;
  sesionEditando = id;
  abrir('adiestramiento');
}
function cancelarEdicionSesion() { sesionEditando = null; abrir('adiestramiento'); }

async function eliminarSesion(id) {
  if (!tiene('adiestramiento', 'eliminar')) return;
  const r = await api('DELETE', `sesiones.php?id=${id}`);
  await cargarDatos();
  if (!sesion) return;
  flash = r.ok ? { tipo: 'ok', texto: 'Se eliminó la sesión.' } : { tipo: 'error', texto: r.datos.mensaje || 'No se pudo eliminar la sesión.' };
  abrir('adiestramiento');
}

document.addEventListener('submit', e => {
  if (e.target.id === 'form-sesion') { e.preventDefault(); enviarSesion(e.target); }
  else if (e.target.id === 'form-inscripcion') { e.preventDefault(); inscribirParticipantes(e.target); }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-accion]');
  if (!b) return;
  switch (b.dataset.accion) {
    case 'guardar-responsable': guardarResponsable(b); break;
    case 'quitar-participante': confirmar(b, 'Confirmar', () => quitarParticipante(Number(b.dataset.curso), Number(b.dataset.persona))); break;
    case 'editar-sesion': iniciarEdicionSesion(Number(b.dataset.id)); break;
    case 'eliminar-sesion': confirmar(b, 'Confirmar', () => eliminarSesion(Number(b.dataset.id))); break;
    case 'cancelar-edicion-sesion': cancelarEdicionSesion(); break;
    default: break;
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'se-curso') refrescarFormularioSesionAd();
  else if (t.id === 'se-nivel') refrescarTemasAd();
  else if (t.id === 'se-adiestrador') actualizarSustitucionAd();
  else if (t.id === 'ins-curso') { const lista = $('#ins-lista'); if (lista) lista.innerHTML = checklistAd(personasNoInscritas(Number(t.value)), new Set(), 'personas'); }
  else if (t.id === 'ad-f-curso') { adFiltro.curso = t.value; pintarHistorialAd(); }
  else if (t.id === 'ad-f-adiestrador') { adFiltro.adiestrador = t.value; pintarHistorialAd(); }
  else if (t.id === 'ad-f-desde') { adFiltro.desde = t.value; pintarHistorialAd(); }
  else if (t.id === 'ad-f-hasta') { adFiltro.hasta = t.value; pintarHistorialAd(); }
});
document.addEventListener('reset', e => { if (e.target.id === 'form-sesion') setTimeout(actualizarSustitucionAd); });

/* =====================================================================
   CAMPO: FINANZAS (ofrendas, diezmos, primicias y siembras)
   ===================================================================== */
const TIPOS_FINANZA = ['Ofrenda', 'Diezmo', 'Primicia', 'Siembra'];
const ARTICULO_FINANZA = { Ofrenda: 'la', Diezmo: 'el', Primicia: 'la', Siembra: 'la' };
let finanzaEditando = null;
let finPeriodo = 'mes';
const finRango = { desde: '', hasta: '' };
let finFiltroTipo = '';

function vistaFinanzas(el) {
  const puedeReg = tiene('finanzas', 'registrar');
  const x = finanzaEditando ? db.finanzas.find(y => y.id === finanzaEditando) : null;
  el.innerHTML = `
    <div class="aviso-caja" id="aviso-fin" aria-live="polite"></div>
    ${(puedeReg || x) ? `
    <section class="panel">
      <form id="form-finanza" novalidate>
        <div class="aviso-caja" id="aviso-finanza" aria-live="polite"></div>
        <p class="form-intro">Los campos con <span class="req">*</span> son obligatorios.</p>
        <div class="form-grid">
          <div class="field">
            <label for="fn-tipo">Tipo <span class="req" aria-hidden="true">*</span></label>
            <select class="control" id="fn-tipo" name="tipo">${TIPOS_FINANZA.map(t => `<option${x && x.tipo === t ? ' selected' : ''}>${t}</option>`).join('')}</select>
          </div>
          <div class="field">
            <label for="fn-fecha">Fecha <span class="req" aria-hidden="true">*</span></label>
            <input class="control" id="fn-fecha" name="fecha" type="date" value="${x ? x.fecha : hoyISO()}" max="${hoyISO()}">
          </div>
          <div class="field">
            <label for="fn-valor">Valor (COP) <span class="req" aria-hidden="true">*</span></label>
            <input class="control" id="fn-valor" name="valor" type="number" min="0" step="1000" value="${x ? x.valor : ''}" placeholder="0">
          </div>
          <div class="field">
            <label for="fn-persona">Persona</label>
            <input class="control" id="fn-persona" name="persona" value="${x ? esc(x.persona) : ''}" autocomplete="off" placeholder="En blanco si es anónimo">
          </div>
          <div class="field full" id="fn-motivo-campo" hidden>
            <label for="fn-motivo">Motivo, propósito o razón <span class="req" aria-hidden="true">*</span></label>
            <input class="control" id="fn-motivo" name="motivo" value="${x ? esc(x.motivo) : ''}" autocomplete="off" placeholder="Obligatorio para primicias y siembras">
          </div>
          <div class="field full">
            <label for="fn-observaciones">Observaciones</label>
            <textarea class="control" id="fn-observaciones" name="observaciones" rows="2">${x ? esc(x.observaciones) : ''}</textarea>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">${x ? 'Guardar cambios' : 'Registrar'}</button>
          <button class="btn" type="reset">${x ? 'Deshacer cambios' : 'Limpiar formulario'}</button>
          ${x ? '<button class="btn" type="button" data-accion="cancelar-edicion-finanza">Cancelar</button>' : ''}
        </div>
      </form>
    </section>` : ''}
    <div id="finanzas-cont"></div>`;
  if (flash) { mostrarAviso($('#aviso-fin'), flash.tipo, flash.texto); flash = null; }
  actualizarMotivoFinanza();
  pintarFinanzas();
}
function actualizarMotivoFinanza() {
  const sel = $('#fn-tipo'), campo = $('#fn-motivo-campo');
  if (!sel || !campo) return;
  campo.hidden = !(sel.value === 'Primicia' || sel.value === 'Siembra');
}
function pintarFinanzas() {
  const cont = $('#finanzas-cont');
  if (!cont) return;
  const puedeEditar = tiene('finanzas', 'editar');
  const delPeriodo = db.finanzas.filter(x => dentroDePeriodo(x.fecha, finPeriodo, finRango));
  let lista = finFiltroTipo ? delPeriodo.filter(x => x.tipo === finFiltroTipo) : delPeriodo;
  lista = lista.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
  const totalPorTipo = t => delPeriodo.filter(x => x.tipo === t).reduce((s, x) => s + Number(x.valor || 0), 0);
  const totalGeneral = TIPOS_FINANZA.reduce((s, t) => s + totalPorTipo(t), 0);
  cont.innerHTML = `
    <p class="solo-impresion">${esc(IGLESIA)}. Finanzas — ${esc(PERIODOS[finPeriodo])}. Generado el ${esc(fechaLarga(hoyISO()))}.</p>
    <div class="toolbar no-print">
      ${controlPeriodo('fin', finPeriodo, finRango)}
      <div class="field corto"><label for="fin-filtro-tipo">Tipo</label>
        <select class="control" id="fin-filtro-tipo"><option value="">Todos</option>${TIPOS_FINANZA.map(t => `<option${finFiltroTipo === t ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="toolbar-acciones"><button class="btn" type="button" data-accion="imprimir">Imprimir</button></div>
    </div>
    <div class="stats">${TIPOS_FINANZA.map(t => `<div class="stat"><div class="n">${cop(totalPorTipo(t))}</div><div class="l">${t}s</div></div>`).join('')}</div>
    ${lista.length ? tabla('tabla-finanzas',
      [{ t: 'Tipo' }, { t: 'Fecha' }, { t: 'Persona' }, { t: 'Valor', num: true }, { t: 'Motivo' }, ...(puedeEditar ? [{ t: 'Acciones', noprint: true }] : [])],
      lista.map(x => `<tr>
        <td>${esc(x.tipo)}</td><td>${esc(fechaCorta(x.fecha))}</td><td>${esc(x.persona) || '<span class="muted">Anónimo</span>'}</td>
        <td class="num">${cop(x.valor)}</td><td>${esc(x.motivo) || '<span class="muted">—</span>'}</td>
        ${puedeEditar ? `<td class="no-print"><div class="acciones">
          <button class="btn btn-small" type="button" data-accion="editar-finanza" data-id="${x.id}">Editar</button>
          <button class="btn btn-small btn-peligro" type="button" data-accion="eliminar-finanza" data-id="${x.id}">Eliminar</button>
        </div></td>` : ''}
      </tr>`), 'Registros financieros') + `<p class="sub-dato" style="margin-top:8px">Total del período: <b>${cop(totalGeneral)}</b></p>`
      : vacio('No hay registros en este período.', 'Cambia el período o el tipo para ver otros registros.')}`;
}
const MAPA_FINANZA = { tipo: 'fn-tipo', fecha: 'fn-fecha', valor: 'fn-valor', persona: 'fn-persona', motivo: 'fn-motivo', observaciones: 'fn-observaciones' };
async function enviarFinanza(form) {
  const editando = finanzaEditando;
  if (!editando && !tiene('finanzas', 'registrar')) return;
  if (editando && !tiene('finanzas', 'editar')) return;
  const f = new FormData(form), caja = $('#aviso-finanza');
  const tipo = f.get('tipo'), fecha = f.get('fecha') || '', valor = Number(f.get('valor'));
  const persona = String(f.get('persona')).trim(), motivo = String(f.get('motivo')).trim();
  const observaciones = String(f.get('observaciones')).trim();
  const errores = [];
  const falla = (campo, texto) => errores.push({ campo, texto });
  if (!TIPOS_FINANZA.includes(tipo)) falla('fn-tipo', 'Elige el tipo.');
  if (!fecha) falla('fn-fecha', 'Elige la fecha.');
  else if (fecha > hoyISO()) falla('fn-fecha', 'La fecha no puede ser futura.');
  if (!Number.isInteger(valor) || valor <= 0) falla('fn-valor', 'Escribe un valor entero mayor que 0 (en pesos).');
  if ((tipo === 'Primicia' || tipo === 'Siembra') && !motivo) falla('fn-motivo', `Escribe el motivo, propósito o razón: es obligatorio para ${tipo === 'Primicia' ? 'primicias' : 'siembras'}.`);
  if (errores.length) { mostrarErrores(form, caja, errores); return; }
  await conBoton(form, async () => {
    const cuerpo = { tipo, fecha, valor, persona, motivo, observaciones };
    const r = editando ? await api('PUT', `finanzas.php?id=${editando}`, cuerpo) : await api('POST', 'finanzas.php', cuerpo);
    if (!r.ok) { errorDeServidor(form, caja, r, MAPA_FINANZA); return; }
    await cargarDatos();
    if (editando) {
      finanzaEditando = null;
      flash = { tipo: 'ok', texto: 'Se guardaron los cambios del registro financiero.' };
      abrir('finanzas');
      return;
    }
    form.reset();
    actualizarMotivoFinanza();
    mostrarAviso(caja, 'ok', `Se registró ${ARTICULO_FINANZA[tipo]} ${tipo.toLowerCase()} de ${cop(valor)}.`);
    pintarFinanzas();
  });
}
function iniciarEdicionFinanza(id) { if (!tiene('finanzas', 'editar') || !db.finanzas.some(x => x.id === id)) return; finanzaEditando = id; abrir('finanzas'); }
function cancelarEdicionFinanza() { finanzaEditando = null; abrir('finanzas'); }
async function eliminarFinanza(id) {
  if (!tiene('finanzas', 'eliminar')) return;
  const x = db.finanzas.find(y => y.id === id);
  if (!x) return;
  const r = await api('DELETE', `finanzas.php?id=${id}`);
  await cargarDatos();
  if (!sesion) return;
  mostrarAviso($('#aviso-fin'), r.ok ? 'ok' : 'error', r.ok ? 'Se eliminó el registro financiero.' : r.datos.mensaje);
  pintarFinanzas();
}

/* =====================================================================
   CAMPO: REPORTES (resumen para el pastor y el administrador)
   ===================================================================== */
let repPeriodo = 'mes';
const repRango = { desde: '', hasta: '' };
function vistaReportes(el) {
  const puedeExportar = tiene('reportes', 'exportar');
  el.innerHTML = `
    <div class="aviso-caja" id="aviso-reportes" aria-live="polite"></div>
    <div class="toolbar no-print">
      ${controlPeriodo('rep', repPeriodo, repRango)}
      <div class="toolbar-acciones">
        ${puedeExportar ? '<button class="btn btn-primary" type="button" data-accion="descargar-pdf-reporte">Descargar PDF</button>' : ''}
        <button class="btn" type="button" data-accion="imprimir">Imprimir</button>
      </div>
    </div>
    <div id="reportes-cont"></div>`;
  pintarReportes();
}
function pintarReportes() {
  const cont = $('#reportes-cont');
  if (!cont) return;
  const p = repPeriodo;
  const personasNuevas = db.personas.filter(x => dentroDePeriodo(x.registrada, p, repRango));
  const reunionesP = db.reuniones.filter(r => dentroDePeriodo(r.fecha, p, repRango)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const asistenciaTotal = reunionesP.reduce((s, r) => s + (Number(r.cantidad) || 0), 0);
  const ofrendaCF = reunionesP.reduce((s, r) => s + (Number(r.ofrenda) || 0), 0);
  const casosP = db.casosPastorales.filter(c => dentroDePeriodo(c.fechaApertura, p, repRango));
  const actosP = db.actuacionesPastorales.filter(a => dentroDePeriodo(a.fecha, p, repRango));
  const porResponsable = {};
  actosP.forEach(a => { const k = nombreUsuarioId(a.responsableId); porResponsable[k] = (porResponsable[k] || 0) + 1; });
  const sesionesP = db.sesiones.filter(a => dentroDePeriodo(a.fecha, p, repRango)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const nacidos = db.nacidos.filter(x => dentroDePeriodo(x.fecha, p, repRango)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const bautizados = db.bautismos.filter(x => dentroDePeriodo(x.fecha, p, repRango)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const mezcla = [
    ...nacidos.map(x => ({ tipo: 'Nacido de nuevo', personaId: x.personaId, fecha: x.fecha })),
    ...bautizados.map(x => ({ tipo: 'Bautizado', personaId: x.personaId, fecha: x.fecha })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const cfActivos = db.grupos.filter(g => g.estado === 'Activo').sort((a, b) => a.nombre.localeCompare(b.nombre));
  const finanzasP = db.finanzas.filter(x => dentroDePeriodo(x.fecha, p, repRango));
  const totalFin = finanzasP.reduce((s, x) => s + Number(x.valor || 0), 0);

  cont.innerHTML = `
    <p class="solo-impresion">${esc(IGLESIA)}. Reporte general — ${esc(PERIODOS[p])}. Generado el ${esc(fechaLarga(hoyISO()))}.</p>
    <div class="stats">
      <div class="stat"><div class="n">${db.personas.length}</div><div class="l">Personas registradas (${personasNuevas.length} nuevas en el período)</div></div>
      <div class="stat"><div class="n">${db.grupos.length}</div><div class="l">Grupos de Comunión Familiar</div></div>
      <div class="stat"><div class="n">${reunionesP.length}</div><div class="l">Reuniones en el período</div></div>
      <div class="stat"><div class="n">${asistenciaTotal}</div><div class="l">Asistentes a esas reuniones</div></div>
    </div>
    ${selectorSeccionesReporte()}
    <section class="panel">
      <h2>Comunión Familiar</h2>
      <p class="panel-desc">Reuniones del período. Ofrenda acumulada: <b>${cop(ofrendaCF)}</b>.</p>
      ${reunionesP.length ? tabla('tabla-rep-cf', [{ t: 'Grupo' }, { t: 'Fecha' }, { t: 'Asistentes', num: true }, { t: 'Ofrenda', num: true }],
        reunionesP.map(r => { const g = db.grupos.find(x => x.id === r.grupoId); return `<tr><td>${esc(g ? g.nombre : '—')}</td><td>${esc(fechaCorta(r.fecha))}</td><td class="num">${r.cantidad}</td><td class="num">${cop(r.ofrenda)}</td></tr>`; }),
        'Reuniones de Comunión Familiar en el período') : vacio('Sin reuniones en este período.', '')}
      <p class="nota-demo" style="margin-top:14px"><a class="link" href="#/comunion-familiar">Ver los grupos y sus reuniones →</a></p>
    </section>
    ${seccionActividadesReporte(p, repRango)}
      <section class="panel">
      <h2>Asistencia Pastoral</h2>
      <p class="panel-desc">Resumen sin datos personales. Los casos y su historial se revisan en el módulo «Asistencia Pastoral».</p>
      <div class="stats">
        <div class="stat"><div class="n">${casosP.length}</div><div class="l">Casos abiertos en el período</div></div>
        <div class="stat"><div class="n">${actosP.length}</div><div class="l">Actuaciones en el período</div></div>
        <div class="stat"><div class="n">${db.casosPastorales.filter(abiertoAp).length}</div><div class="l">Casos abiertos (en total)</div></div>
        <div class="stat"><div class="n">${db.casosPastorales.filter(vencidoAp).length}</div><div class="l">Seguimientos vencidos</div></div>
      </div>
      ${Object.keys(porResponsable).length ? tabla('tabla-rep-ap', [{ t: 'Responsable' }, { t: 'Actuaciones en el período', num: true }],
        Object.entries(porResponsable).sort((a, b) => b[1] - a[1]).map(([nombre, n]) => `<tr><td>${esc(nombre)}</td><td class="num">${n}</td></tr>`),
        'Actividad por responsable') : vacio('Sin actuaciones en este período.', '')}
      <p class="nota-demo" style="margin-top:14px"><a class="link" href="#/asistencia-pastoral">Ver los casos y su historial →</a></p>
    </section>
    <section class="panel">
      <h2>Adiestramiento</h2>
      ${sesionesP.length ? tabla('tabla-rep-ad', [{ t: 'Curso' }, { t: 'Fecha' }, { t: 'Adiestrador' }, { t: 'Asistieron', num: true }],
        sesionesP.map(a => `<tr><td>${esc(cursoAd(a.cursoId) ? cursoAd(a.cursoId).nombre : '—')}</td><td>${esc(fechaCorta(a.fecha))}</td><td>${esc(personaNombre(a.adiestradorId))}</td><td class="num">${a.asistencia.length}</td></tr>`),
        'Sesiones del período') : vacio('Sin sesiones en este período.', '')}
    </section>
    <section class="panel">
      <h2>Nacidos de nuevo (Bautizados)</h2>
      ${mezcla.length ? tabla('tabla-rep-nn', [{ t: 'Persona' }, { t: 'Registro' }, { t: 'Fecha' }], mezcla.map(x => `<tr><td>${esc(personaNombre(x.personaId))}</td><td>${esc(x.tipo)}</td><td>${esc(fechaCorta(x.fecha))}</td></tr>`), 'Registros en el período') : vacio('Nadie en este período.', '')}
    </section>
    <section class="panel" id="rep-grupo-cf">
      <h2>Grupo de comunión familiar</h2>
      <p class="panel-desc">Los grupos activos y dónde se reúnen.</p>
      ${cfActivos.length ? tabla('tabla-rep-cf', [{ t: 'Grupo' }, { t: 'Dirección' }, { t: 'Discipulador' }], cfActivos.map(g => `<tr><td>${esc(g.nombre)}</td><td>${esc(g.direccion)}</td><td>${esc(personaNombre(g.discipuladorId))}</td></tr>`), 'Grupos de comunión familiar activos') : vacio('No hay grupos de comunión familiar activos.', '')}
      <div id="mapa-cf" class="mapa-grupos" aria-label="Mapa de los grupos de comunión familiar"></div>
    </section>
    <section class="panel"><h2>Grupo de Adiestramiento</h2><p class="panel-desc">Pendiente de definir: esta sección se llenará cuando se acuerde su contenido.</p></section>
    <section class="panel"><h2>Nivel de discipulado</h2><p class="panel-desc">Pendiente de definir: esta sección se llenará cuando se acuerde su contenido.</p></section>
    <section class="panel"><h2>Nivel de adiestramiento</h2><p class="panel-desc">Pendiente de definir: esta sección se llenará cuando se acuerde su contenido.</p></section>
    <section class="panel">
      <h2>Finanzas</h2>
      <p class="panel-desc">Total del período: <b>${cop(totalFin)}</b>${finanzasP.length ? ` en ${finanzasP.length} ${finanzasP.length === 1 ? 'registro' : 'registros'}` : ''}.</p>
      <p class="nota-demo"><a class="link" href="#/finanzas">Ver el detalle en Finanzas →</a></p>
    </section>`;
  pintarListadoAsistencia();
  pintarMapaCF(cfActivos);
  pintarCumpleanosYPendientes();
  pintarReporteAsistencia();
}

/* =====================================================================
   CUMPLEAÑOS · sección de Reportes (lista del mes y próximos 30 días, para imprimir)
   ===================================================================== */
let cumMes = null;
function vistaCumpleanos(el) {
  if (cumMes === null) cumMes = Number(hoyISO().slice(5, 7));
  el.innerHTML = `
    <div class="aviso-caja" id="aviso-cum" aria-live="polite"></div>
    <div class="toolbar no-print">
      <div class="field corto">
        <label for="cum-mes">Mes</label>
        <select class="control" id="cum-mes">${MESES.map((m, i) => `<option value="${i + 1}"${i + 1 === cumMes ? ' selected' : ''}>${m.charAt(0).toUpperCase() + m.slice(1)}</option>`).join('')}</select>
      </div>
      <div class="toolbar-acciones"><button class="btn" type="button" data-accion="imprimir">Imprimir lista</button></div>
    </div>
    <section class="panel">
      <p class="solo-impresion" id="cum-impresion"></p>
      <h2 id="cum-titulo">Cumpleaños</h2>
      <div id="cum-lista"><p class="muted">Cargando…</p></div>
    </section>
    <section class="panel">
      <h2>Próximos 30 días</h2>
      <div id="cum-proximos"><p class="muted">Cargando…</p></div>
    </section>`;
  cargarCumpleanos();
}

async function cargarCumpleanos() {
  if (!$('#cum-lista')) return;
  const [m, p] = await Promise.all([api('GET', `cumpleanos.php?mes=${cumMes}`), api('GET', 'cumpleanos.php?proximos=30')]);
  if (!sesion || !$('#cum-lista')) return;   // cambió de campo mientras cargaba
  if (!m.ok) { mostrarAviso($('#aviso-cum'), 'error', m.datos.mensaje || 'No se pudo cargar la lista de cumpleaños.'); return; }
  const nombreMes = MESES[cumMes - 1];
  $('#cum-titulo').textContent = `Cumpleaños de ${nombreMes} ${m.datos.anio}`;
  $('#cum-impresion').textContent = `${IGLESIA}. Cumpleaños de ${nombreMes} ${m.datos.anio}.`;
  $('#cum-lista').innerHTML = m.datos.personas.length
    ? tabla('tabla-cumple-mes', [{ t: 'Día', num: true }, { t: 'Nombre' }, { t: 'Cumple', num: true }],
        m.datos.personas.map(x => `<tr><td class="num">${x.dia}</td><td><b>${esc(`${x.nombres} ${x.apellidos}`)}</b></td><td class="num">${x.cumple} años</td></tr>`),
        `Cumpleaños de ${nombreMes}`)
    : vacio(`Nadie cumple años en ${nombreMes}.`, 'Cambia el mes para ver otros cumpleaños.');
  if (!p.ok) { $('#cum-proximos').innerHTML = ''; return; }
  $('#cum-proximos').innerHTML = p.datos.personas.length
    ? tabla('tabla-cumple-prox', [{ t: 'Fecha' }, { t: 'Nombre' }, { t: 'Cumple', num: true }],
        p.datos.personas.map(x => `<tr><td>${esc(fechaCorta(x.fecha))}</td><td><b>${esc(`${x.nombres} ${x.apellidos}`)}</b></td><td class="num">${x.cumple} años</td></tr>`),
        'Próximos cumpleaños')
    : vacio('No hay cumpleaños en los próximos 30 días.', '');
}

/* =====================================================================
   CAMPO: CATÁLOGO DE FORMACIÓN (proceso → curso → nivel → tema)
   Solo el administrador agrega o cambia. Nada se borra: se desactiva.
   ===================================================================== */
let catRenombrando = null;   // { tipo, id } del elemento que se renombra
const procesoNombre = id => { const p = db.procesos.find(x => x.id === id); return p ? p.nombre : ''; };
const opcionesCursos = () => db.cursos.filter(c => c.activo).map(c => `<option value="${c.id}">${esc(`${procesoNombre(c.procesoId)} · ${c.nombre}`)}</option>`).join('');
function opcionesNiveles(cursoId) {
  return '<option value="">Sin nivel (tema directo del curso)</option>' + db.niveles
    .filter(n => n.cursoId === cursoId && n.activo).map(n => `<option value="${n.id}">${esc(n.nombre)}</option>`).join('');
}

function vistaCatalogo(el) {
  const puedeEditar = tiene('catalogo', 'registrar');
  el.innerHTML = `
    <div class="aviso-caja" id="aviso-catalogo" aria-live="polite"></div>
    ${puedeEditar ? `
    <section class="panel">
      <h2>Agregar al catálogo</h2>
      <p class="panel-desc">Usa los nombres que confirme la iglesia. Lo que se desactiva deja de aparecer en los formularios, pero conserva su historial.</p>
      <div class="catalogo-forms">
        <form class="panel-mini" data-catalogo="curso" novalidate>
          <h3 class="subtitulo-form">Curso</h3>
          <div class="field"><label for="cat-curso-proceso">Proceso</label>
            <select class="control" id="cat-curso-proceso" name="procesoId">${db.procesos.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></div>
          <div class="field"><label for="cat-curso-nombre">Nombre del curso <span class="req" aria-hidden="true">*</span></label>
            <input class="control" id="cat-curso-nombre" name="nombre" autocomplete="off"></div>
          <button class="btn btn-primary" type="submit">Agregar curso</button>
        </form>
        <form class="panel-mini" data-catalogo="nivel" novalidate>
          <h3 class="subtitulo-form">Nivel o etapa</h3>
          <div class="field"><label for="cat-nivel-curso">Curso</label>
            <select class="control" id="cat-nivel-curso" name="cursoId">${opcionesCursos()}</select></div>
          <div class="field"><label for="cat-nivel-nombre">Nombre del nivel <span class="req" aria-hidden="true">*</span></label>
            <input class="control" id="cat-nivel-nombre" name="nombre" autocomplete="off"></div>
          <button class="btn btn-primary" type="submit">Agregar nivel</button>
        </form>
        <form class="panel-mini" data-catalogo="tema" novalidate>
          <h3 class="subtitulo-form">Tema o lección</h3>
          <div class="field"><label for="cat-tema-curso">Curso</label>
            <select class="control" id="cat-tema-curso" name="cursoId">${opcionesCursos()}</select></div>
          <div class="field"><label for="cat-tema-nivel">Nivel (opcional)</label>
            <select class="control" id="cat-tema-nivel" name="nivelId">${opcionesNiveles(db.cursos.length ? db.cursos[0].id : 0)}</select></div>
          <div class="field"><label for="cat-tema-nombre">Nombre del tema <span class="req" aria-hidden="true">*</span></label>
            <input class="control" id="cat-tema-nombre" name="nombre" autocomplete="off"></div>
          <button class="btn btn-primary" type="submit">Agregar tema</button>
        </form>
        <form class="panel-mini" data-catalogo="eps" novalidate>
          <h3 class="subtitulo-form">EPS</h3>
          <div class="field"><label for="cat-eps-nombre">Nombre de la EPS <span class="req" aria-hidden="true">*</span></label>
            <input class="control" id="cat-eps-nombre" name="nombre" autocomplete="off"></div>
          <button class="btn btn-primary" type="submit">Agregar EPS</button>
        </form>
      </div>
    </section>` : '<p class="nota-demo">Solo el administrador puede cambiar el catálogo. Aquí puedes consultarlo.</p>'}
    <div id="catalogo-arbol"></div>`;
  if (flash) { mostrarAviso($('#aviso-catalogo'), flash.tipo, flash.texto); flash = null; }
  pintarCatalogo();
}

function pintarCatalogo() {
  const cont = $('#catalogo-arbol');
  if (!cont) return;
  const puedeEditar = tiene('catalogo', 'registrar');
  const fila = (tipo, x) => {
    const editando = catRenombrando && catRenombrando.tipo === tipo && catRenombrando.id === x.id;
    const nombre = editando
      ? `<input class="control control-corto" id="cat-renombrar-${tipo}-${x.id}" value="${esc(x.nombre)}" aria-label="Nuevo nombre">`
      : `<span class="cat-nombre">${esc(x.nombre)}</span>`;
    const acciones = !puedeEditar ? '' : editando
      ? `<button class="btn btn-small btn-primary" type="button" data-cat-accion="guardar-nombre" data-tipo="${tipo}" data-id="${x.id}">Guardar</button>
         <button class="btn btn-small" type="button" data-cat-accion="cancelar-nombre">Cancelar</button>`
      : `<button class="btn btn-small" type="button" data-cat-accion="renombrar" data-tipo="${tipo}" data-id="${x.id}">Renombrar</button>
         <button class="btn btn-small" type="button" data-cat-accion="activar" data-tipo="${tipo}" data-id="${x.id}" data-activo="${x.activo ? '0' : '1'}">${x.activo ? 'Desactivar' : 'Activar'}</button>`;
    return `<div class="cat-item${x.activo ? '' : ' inactivo'}">${nombre}${x.activo ? '' : ' <span class="pill lock">Inactivo</span>'}<span class="cat-acciones">${acciones}</span></div>`;
  };
  cont.innerHTML = db.procesos.length ? db.procesos.map(p => {
    const cursos = db.cursos.filter(c => c.procesoId === p.id);
    return `<section class="panel"><h2>${esc(p.nombre)}</h2>
      ${cursos.length ? cursos.map(c => {
        const niveles = db.niveles.filter(n => n.cursoId === c.id);
        const temasDirectos = db.temas.filter(t => t.cursoId === c.id && t.nivelId === null);
        return `<div class="cat-curso">
          <div class="cat-titulo">${fila('curso', c)}</div>
          ${niveles.map(n => `<div class="cat-nivel">${fila('nivel', n)}
            <div class="cat-lista">${db.temas.filter(t => t.nivelId === n.id).map(t => fila('tema', t)).join('') || '<p class="muted">Sin temas todavía.</p>'}</div></div>`).join('')}
          ${temasDirectos.length ? `<div class="cat-lista">${temasDirectos.map(t => fila('tema', t)).join('')}</div>` : ''}
          ${!niveles.length && !temasDirectos.length ? '<p class="muted">Sin niveles ni temas todavía.</p>' : ''}
        </div>`;
      }).join('') : vacio('Sin cursos todavía.', 'Agrégalos arriba.')}
    </section>`;
  }).join('') : vacio('No hay procesos de formación.', '');
  cont.insertAdjacentHTML('beforeend', `<section class="panel"><h2>EPS (seguros de salud)</h2>
    <p class="panel-desc">Aparecen como sugerencias al registrar a una persona. Las desactivadas dejan de sugerirse, pero no se borran.</p>
    ${db.eps.length ? db.eps.map(x => fila('eps', x)).join('') : vacio('Sin EPS todavía.', 'Agrégalas arriba.')}
  </section>`);
}

async function enviarCatalogo(form) {
  const tipo = form.dataset.catalogo;
  const f = new FormData(form), caja = $('#aviso-catalogo');
  const nombre = String(f.get('nombre') || '').trim();
  if (!nombre) { mostrarAviso(caja, 'error', 'Escribe el nombre.'); return; }
  const cuerpo = { tipo, nombre };
  if (tipo === 'curso') cuerpo.procesoId = Number(f.get('procesoId'));
  if (tipo === 'nivel') cuerpo.cursoId = Number(f.get('cursoId'));
  if (tipo === 'tema') { cuerpo.cursoId = Number(f.get('cursoId')); cuerpo.nivelId = f.get('nivelId') ? Number(f.get('nivelId')) : null; }
  await conBoton(form, async () => {
    const r = await api('POST', 'catalogo.php', cuerpo);
    if (!r.ok) { mostrarAviso(caja, 'error', textosDeError(r)); return; }
    await cargarDatos();
    flash = { tipo: 'ok', texto: `Se agregó «${nombre}».` };
    abrir('catalogo');
  });
}

document.addEventListener('submit', e => {
  if (e.target.dataset && e.target.dataset.catalogo) { e.preventDefault(); enviarCatalogo(e.target); }
});
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-cat-accion]');
  if (!b) return;
  const accion = b.dataset.catAccion, tipo = b.dataset.tipo, id = Number(b.dataset.id);
  if (accion === 'renombrar') { catRenombrando = { tipo, id }; pintarCatalogo(); return; }
  if (accion === 'cancelar-nombre') { catRenombrando = null; pintarCatalogo(); return; }
  if (accion === 'guardar-nombre') {
    const input = $(`#cat-renombrar-${tipo}-${id}`);
    const nombre = input ? input.value.trim() : '';
    if (!nombre) { mostrarAviso($('#aviso-catalogo'), 'error', 'Escribe el nombre.'); return; }
    const r = await api('PUT', `catalogo.php?tipo=${tipo}&id=${id}`, { nombre });
    if (!r.ok) { mostrarAviso($('#aviso-catalogo'), 'error', textosDeError(r)); return; }
    await cargarDatos();
    catRenombrando = null;
    flash = { tipo: 'ok', texto: 'Se cambió el nombre.' };
    abrir('catalogo');
    return;
  }
  if (accion === 'activar') {
    const activo = b.dataset.activo === '1';
    const r = await api('PUT', `catalogo.php?tipo=${tipo}&id=${id}`, { activo });
    if (!r.ok) { mostrarAviso($('#aviso-catalogo'), 'error', textosDeError(r)); return; }
    await cargarDatos();
    flash = { tipo: 'ok', texto: activo ? 'Se activó el elemento.' : 'Se desactivó el elemento.' };
    abrir('catalogo');
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'cum-mes') { cumMes = Number(e.target.value); cargarCumpleanos(); }
  if (e.target.id === 'cat-tema-curso') {
    const sel = $('#cat-tema-nivel');
    if (sel) sel.innerHTML = opcionesNiveles(Number(e.target.value));
  }
});

VISTAS.catalogo = vistaCatalogo;

/* =====================================================================
   EVENTOS
   ===================================================================== */
document.addEventListener('click', e => {
  const alt = e.target.closest('[data-accion="alternar-grupo"]');
  if (alt) {
    e.preventDefault(); // el estado abierto/cerrado lo controla gruposAbiertos, no el <details> nativo
    const id = Number(alt.dataset.id);
    if (gruposAbiertos.has(id)) gruposAbiertos.delete(id); else gruposAbiertos.add(id);
    pintarGrupos();
    return;
  }
  const ir = e.target.closest('[data-abrir]');
  if (ir) {
    if (ir.dataset.abrir === 'registrar-personas') editando = null; // desde el menú o los atajos siempre se empieza un registro nuevo
    navegar(ir.dataset.abrir);
    return;
  }
  const b = e.target.closest('[data-accion]');
  if (!b) return;
  switch (b.dataset.accion) {
    case 'saltar': e.preventDefault(); $('#main').focus(); break;
    case 'ver-clave': {
      const i = $('#l-clave'), ver = i.type === 'password';
      i.type = ver ? 'text' : 'password';
      b.textContent = ver ? 'Ocultar' : 'Mostrar';
      b.setAttribute('aria-pressed', String(ver));
      break;
    }
    case 'olvide':
      mostrarAviso($('#login-aviso'), 'info', 'Para restablecer tu contraseña, comunícate con un administrador de la iglesia.');
      break;
    case 'demo':
      $('#l-usuario').value = b.dataset.u;
      $('#l-clave').value = b.dataset.c;
      $('#login-aviso').innerHTML = '';
      $('#form-login button[type="submit"]').focus();
      break;
    case 'salir': cerrarSesion(); break;
    case 'imprimir': window.print(); break;
    case 'editar': iniciarEdicion(Number(b.dataset.num)); break;
    case 'eliminar': confirmar(b, 'Confirmar', () => eliminarPersona(Number(b.dataset.num))); break;
    case 'cancelar-edicion': editando = null; abrir('lista-asistencia'); break;
    case 'editar-grupo': iniciarEdicionGrupo(Number(b.dataset.id)); break;
    case 'eliminar-grupo': confirmar(b, 'Confirmar', () => eliminarGrupo(Number(b.dataset.id))); break;
    case 'cancelar-edicion-grupo': cancelarEdicionGrupo(); break;
    case 'editar-reunion': iniciarEdicionReunion(Number(b.dataset.id)); break;
    case 'eliminar-reunion': confirmar(b, 'Confirmar', () => eliminarReunion(Number(b.dataset.id))); break;
    case 'cancelar-edicion-reunion': cancelarEdicionReunion(); break;
    case 'editar-finanza': iniciarEdicionFinanza(Number(b.dataset.id)); break;
    case 'eliminar-finanza': confirmar(b, 'Confirmar', () => eliminarFinanza(Number(b.dataset.id))); break;
    case 'cancelar-edicion-finanza': cancelarEdicionFinanza(); break;
    case 'musica': {
      const pausa = b.classList.toggle('pausa');
      b.setAttribute('aria-pressed', String(!pausa));
      $('#np-label').textContent = pausa ? 'En pausa' : 'Alabanza en vivo';
      break;
    }
  }
});

document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.classList.contains('form-reunion')) { enviarReunion(e.target); return; }
  switch (e.target.id) {
    case 'form-login': enviarLogin(); break;
    case 'form-persona': enviarPersona(e.target); break;
    case 'form-grupo': enviarGrupo(e.target); break;
    case 'form-grupo-cf': enviarGrupoCf(e.target); break;
    case 'form-grupo-otro': enviarGrupoOtro(e.target); break;
    case 'form-sede-crear': enviarSedeCrear(e.target); break;
    case 'form-sede-editar': enviarSedeEditar(e.target); break;
    case 'form-finanza': enviarFinanza(e.target); break;
  }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset && t.dataset.filtro) filtrarTabla(t);
  if (t.getAttribute && t.getAttribute('aria-invalid')) t.removeAttribute('aria-invalid'); // al corregir un campo se quita la marca de error
  if (t.id === 'p-nacimiento') actualizarEdad();
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'lista-orden') { listaOrden = t.value; pintarTablaLista(); }
  else if (t.id === 'lista-filtro') { listaFiltro = t.value; pintarTablaLista(); }
  else if (t.id === 'p-nacimiento') actualizarEdad();
  else if (t.id === 'seg-filtro-estado') { segFiltroEstado = t.value; pintarTablaSeguimientos(); }
  else if (t.id === 'fin-periodo') { finPeriodo = t.value; pintarFinanzas(); }
  else if (t.id === 'fin-desde' || t.id === 'fin-hasta') { finRango[t.id === 'fin-desde' ? 'desde' : 'hasta'] = t.value; pintarFinanzas(); }
  else if (t.id === 'fin-filtro-tipo') { finFiltroTipo = t.value; pintarFinanzas(); }
  else if (t.id === 'fn-tipo') actualizarMotivoFinanza();
  else if (t.id === 'rep-periodo') { repPeriodo = t.value; toggleRango('rep'); pintarReportes(); }
  else if (t.id === 'rep-desde' || t.id === 'rep-hasta') { repRango[t.id === 'rep-desde' ? 'desde' : 'hasta'] = t.value; pintarReportes(); }
});

document.addEventListener('reset', e => {
  const caja = e.target.querySelector('.aviso-caja');
  if (caja) caja.innerHTML = '';
  $$('[aria-invalid]', e.target).forEach(i => i.removeAttribute('aria-invalid'));
  setTimeout(actualizarEdad);
});

// Botón Atrás / Adelante del navegador: cada campo tiene su propia dirección (#/lista-asistencia, etc.).
window.addEventListener('hashchange', () => {
  if (!sesion) return;
  const id = idDeHash();
  if (id === campoActual) return;
  if (id === '') navegar('inicio', true);
  else if (RUTAS.includes(id)) navegar(id, true);
});


/* =====================================================================
   REPORTE EN PDF · versión 7
   El PDF se genera en el servidor con los mismos datos y filtros de la pantalla.
   ===================================================================== */
// Descarga el reporte general con el período que se ve en pantalla
async function descargarPdfReporte(btn) {
  if (!tiene('reportes', 'exportar')) return;
  const caja = $('#aviso-reportes');
  const params = new URLSearchParams({ periodo: repPeriodo });
  const hoyPdf = hoyISO();
  params.set('mes', String(cumMes || Number(hoyPdf.slice(5, 7))));
  params.set('anio', hoyPdf.slice(0, 4));
  if (repPeriodo === 'rango') {
    if (repRango.desde) params.set('desde', repRango.desde);
    if (repRango.hasta) params.set('hasta', repRango.hasta);
  }
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generando PDF…';
  if (caja) caja.innerHTML = '';
  try {
    const r = await fetch(`${API}reporte_pdf.php?${params}`, { credentials: 'same-origin', headers: { Accept: 'application/pdf, application/json' } });
    if (!r.ok) {
      let mensaje = 'No se pudo generar el PDF. Inténtalo de nuevo.';
      try { const j = await r.json(); if (j.mensaje) mensaje = j.mensaje; } catch (e) { /* la respuesta no era JSON */ }
      mostrarAviso(caja, 'error', mensaje);
      return;
    }
    const blob = await r.blob();
    const cabecera = r.headers.get('Content-Disposition') || '';
    const coincide = /filename="([^"]+)"/.exec(cabecera);
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = coincide ? coincide[1] : 'reporte-sigap.pdf';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  } catch (e) {
    mostrarAviso(caja, 'error', MSG_SIN_SERVIDOR);
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-accion="descargar-pdf-reporte"]');
  if (b) descargarPdfReporte(b);
});

/* =====================================================================
   CAMPO: USUARIOS Y ACCESOS · versión 8
   Solo el administrador. Cuentas de acceso (crear, corregir, desactivar, restablecer la clave)
   y la matriz de permisos Rol → Módulo → Acciones. Las reglas están en el servidor
   (api/usuarios.php, api/permisos.php y api/mi_clave.php).
   ===================================================================== */
let ADMIN = null;                 // administración de cuentas y permisos (datos.php solo la entrega al administrador)
let cuentasTexto = '';            // búsqueda de cuentas
let cuentaNuevaAbierta = false;   // formulario «Nueva cuenta»
const ROLES_ORDEN = ['admin', 'pastor', 'asistente', 'discipulador'];
const PROTEGIDOS_ADMIN = ['consultar', 'registrar', 'editar'];   // no se le pueden quitar al administrador en Usuarios y accesos
const MAPA_CUENTA = { personaId: 'cu-persona', usuario: 'cu-usuario', rol: 'cu-rol', clave: 'cu-clave' };
const MAPA_EDICION = { usuario: 'ed-usuario', rol: 'ed-rol', activo: 'ed-activo' };
const MAPA_RESTABLECER = { clave: 'rc-clave' };
const MAPA_MI_CLAVE = { claveActual: 'mc-actual', claveNueva: 'mc-nueva' };

const textoErrorCuentas = r => (r.datos && Array.isArray(r.datos.errores) && r.datos.errores.length)
  ? r.datos.errores[0].texto : ((r.datos && r.datos.mensaje) || 'No se pudo guardar. Inténtalo de nuevo.');
const nombreRolCuenta = clave => (ROLES[clave] || clave);
const nombreModuloAdmin = clave => { const m = ADMIN && ADMIN.modulos.find(x => x.clave === clave); return m ? m.nombre : clave; };
const cuentaPorId = id => (ADMIN ? ADMIN.cuentas.find(c => c.id === id) : null);

function vistaUsuariosAccesos(el) {
  if (!ADMIN) {
    el.innerHTML = vacio('Acceso restringido', 'Solo el administrador puede administrar las cuentas y los permisos.');
    return;
  }
  asegurarDialogoCuenta();
  const puedeRegistrar = tiene('usuarios-accesos', 'registrar');
  el.innerHTML = `
    <div class="aviso-caja" id="aviso-cuentas" aria-live="polite"></div>
    <div class="stats" id="cuentas-stats"></div>
    <section class="panel">
      <div class="cabecera-seccion">
        <h2>Cuentas de acceso</h2>
        ${puedeRegistrar ? `<button class="btn btn-primary" type="button" data-accion="cuenta-nueva-toggle" aria-expanded="${cuentaNuevaAbierta}">${cuentaNuevaAbierta ? 'Cerrar' : 'Nueva cuenta'}</button>` : ''}
      </div>
      <p class="panel-desc">Cada cuenta pertenece a una persona registrada y entra con su usuario y su clave. Las cuentas no se borran: se desactivan, para conservar el historial.</p>
      ${puedeRegistrar && cuentaNuevaAbierta ? formularioCuentaNueva() : ''}
      <div class="toolbar no-print">
        <div class="field corto"><label for="cu-buscar">Buscar</label>
          <input class="control" id="cu-buscar" value="${esc(cuentasTexto)}" placeholder="Nombre o usuario" autocomplete="off"></div>
      </div>
      <div id="cuentas-lista"></div>
    </section>
    <section class="panel">
      <h2>Permisos por cargo</h2>
      <p class="panel-desc">Marca lo que puede hacer cada cargo en cada campo. Solo aparecen las acciones que aplican a cada campo. Cada casilla se guarda al marcarla o desmarcarla.</p>
      <div id="matriz-permisos"></div>
    </section>`;
  pintarStatsCuentas();
  pintarCuentas();
  pintarMatriz();
  if (flash) { mostrarAviso($('#aviso-cuentas'), flash.tipo, flash.texto); flash = null; }
}

function pintarStatsCuentas() {
  const cont = $('#cuentas-stats');
  if (!cont || !ADMIN) return;
  const activas = ADMIN.cuentas.filter(c => c.activo).length;
  const sinCuenta = db.personas.filter(p => !ADMIN.cuentas.some(c => c.personaId === p.num)).length;
  cont.innerHTML = `
    <div class="stat"><div class="n">${ADMIN.cuentas.length}</div><div class="l">Cuentas</div></div>
    <div class="stat"><div class="n">${activas}</div><div class="l">Activas</div></div>
    <div class="stat"><div class="n">${ADMIN.cuentas.length - activas}</div><div class="l">Inactivas</div></div>
    <div class="stat"><div class="n">${sinCuenta}</div><div class="l">Personas sin cuenta</div></div>`;
}

function pintarCuentas() {
  const cont = $('#cuentas-lista');
  if (!cont || !ADMIN) return;
  const t = cuentasTexto.trim().toLowerCase();
  const lista = ADMIN.cuentas
    .filter(c => !t || `${c.nombres} ${c.apellidos} ${c.usuario}`.toLowerCase().includes(t))
    .sort((a, b) => ROLES_ORDEN.indexOf(a.rol) - ROLES_ORDEN.indexOf(b.rol) || a.nombres.localeCompare(b.nombres, 'es'));
  cont.innerHTML = lista.length
    ? tabla('tabla-cuentas', [{ t: 'Persona' }, { t: 'Usuario' }, { t: 'Cargo' }, { t: 'Estado' }, { t: 'Último ingreso' }, { t: 'Acciones', noprint: true }],
      lista.map(filaCuenta), 'Cuentas de acceso')
    : vacio('Ninguna cuenta coincide con la búsqueda.', '');
}

function filaCuenta(c) {
  const soyYo = sesion && sesion.usuario === c.usuario;
  const puedeEditar = tiene('usuarios-accesos', 'editar');
  let acciones = '<span class="muted">—</span>';
  if (soyYo) {
    acciones = '<span class="pill on">Tu cuenta</span>';
  } else if (puedeEditar) {
    acciones = `<div class="acciones-fila">
      <button class="btn btn-small" type="button" data-accion="cuenta-editar" data-id="${c.id}">Editar</button>
      <button class="btn btn-small" type="button" data-accion="cuenta-clave" data-id="${c.id}">Restablecer clave</button>
      <button class="btn btn-small" type="button" data-accion="cuenta-estado" data-id="${c.id}" data-activo="${c.activo ? '0' : '1'}">${c.activo ? 'Desactivar' : 'Activar'}</button>
    </div>`;
  }
  const ultimo = c.ultimoAcceso ? `${esc(fechaCorta(c.ultimoAcceso.slice(0, 10)))} · ${esc(c.ultimoAcceso.slice(11, 16))}` : '<span class="muted">Nunca</span>';
  return `<tr>
    <td><b>${esc(`${c.nombres} ${c.apellidos}`)}</b></td>
    <td>${esc(c.usuario)}</td>
    <td>${esc(nombreRolCuenta(c.rol))}</td>
    <td>${c.activo ? '<span class="pill on">Activa</span>' : '<span class="pill lock">Inactiva</span>'}</td>
    <td>${ultimo}</td>
    <td class="no-print">${acciones}</td>
  </tr>`;
}

function formularioCuentaNueva() {
  const conCuenta = new Set(ADMIN.cuentas.map(c => c.personaId).filter(x => x !== null));
  const libres = db.personas.filter(p => !conCuenta.has(p.num));
  const opciones = libres.length
    ? '<option value="">Elige una persona…</option>' + libres.map(p => `<option value="${p.num}">${esc(`${p.nombres} ${p.apellidos}`)}</option>`).join('')
    : '<option value="">No hay personas disponibles</option>';
  return `<form id="form-cuenta" class="form-cuenta" novalidate>
    <div class="aviso-caja" id="aviso-cuenta" aria-live="polite"></div>
    <div class="form-grid">
      <div class="field full"><label for="cu-persona">Persona <span class="req" aria-hidden="true">*</span></label>
        <select class="control" id="cu-persona" name="personaId">${opciones}</select>
        <p class="hint">Solo aparecen personas registradas que aún no tienen cuenta. Si falta alguien, regístralo primero en «Registrar personas».</p></div>
      <div class="field"><label for="cu-usuario">Nombre de usuario <span class="req" aria-hidden="true">*</span></label>
        <input class="control" id="cu-usuario" name="usuario" autocomplete="off" placeholder="ej. mateo.gomez"></div>
      <div class="field"><label for="cu-rol">Cargo <span class="req" aria-hidden="true">*</span></label>
        <select class="control" id="cu-rol" name="rol">${ROLES_ORDEN.map(k => `<option value="${k}">${esc(ROLES[k])}</option>`).join('')}</select></div>
      <div class="field full"><label for="cu-clave">Clave temporal <span class="req" aria-hidden="true">*</span></label>
        <input class="control" id="cu-clave" name="clave" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres">
        <p class="hint">Entrégala en persona. Después la persona puede cambiarla con «Cambiar mi clave».</p></div>
    </div>
    <div class="form-actions"><button class="btn btn-primary" type="submit">Crear cuenta</button></div>
  </form>`;
}

async function enviarCuentaNueva(form) {
  if (!tiene('usuarios-accesos', 'registrar')) return;
  const f = new FormData(form), caja = $('#aviso-cuenta');
  const cuerpo = { personaId: Number(f.get('personaId')) || null, usuario: String(f.get('usuario') || '').trim(),
                   rol: f.get('rol') || '', clave: String(f.get('clave') || '') };
  const errores = [];
  if (!cuerpo.personaId) errores.push({ campo: 'cu-persona', texto: 'Elige la persona a la que pertenece la cuenta.' });
  if (!cuerpo.usuario) errores.push({ campo: 'cu-usuario', texto: 'Escribe el nombre de usuario.' });
  if (!cuerpo.clave) errores.push({ campo: 'cu-clave', texto: 'Escribe una clave temporal.' });
  if (errores.length) { mostrarErrores(form, caja, errores); return; }
  await conBoton(form, async () => {
    const r = await api('POST', 'usuarios.php', cuerpo);
    if (!r.ok) { errorDeServidor(form, caja, r, MAPA_CUENTA); return; }
    await cargarDatos();
    cuentaNuevaAbierta = false;
    flash = { tipo: 'ok', texto: `Se creó la cuenta «${cuerpo.usuario}». Entrega la clave temporal en persona.` };
    abrir('usuarios-accesos');
  });
}

/* ---------- Diálogo compartido: editar, restablecer clave y cambiar mi clave ---------- */
function asegurarDialogoCuenta() {
  if (document.getElementById('dlg-cuenta')) return;
  const d = document.createElement('dialog');
  d.id = 'dlg-cuenta';
  d.className = 'dialogo';
  d.setAttribute('aria-labelledby', 'dlg-cuenta-tit');
  d.addEventListener('close', () => { d.innerHTML = ''; });
  document.body.appendChild(d);
}
function abrirDialogoCuenta(titulo, cuerpo) {
  asegurarDialogoCuenta();
  const d = document.getElementById('dlg-cuenta');
  d.innerHTML = `<div class="dialogo-cab"><h2 id="dlg-cuenta-tit">${esc(titulo)}</h2>
    <button class="btn btn-small" type="button" data-accion="cerrar-dialogo" aria-label="Cerrar">Cerrar</button></div>${cuerpo}`;
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  const primero = d.querySelector('input:not([type=checkbox]), select');
  if (primero) primero.focus();
}
function cerrarDialogoCuenta() {
  const d = document.getElementById('dlg-cuenta');
  if (!d) return;
  if (typeof d.close === 'function' && d.open) d.close();
  d.removeAttribute('open');
  d.innerHTML = '';
}

function abrirEditarCuenta(id) {
  const c = cuentaPorId(id);
  if (!c) return;
  abrirDialogoCuenta(`Editar cuenta de ${c.nombres} ${c.apellidos}`, `
    <form id="form-editar-cuenta" class="form-dialogo" novalidate data-cuenta="${c.id}">
      <div class="aviso-caja" data-aviso-dialogo aria-live="polite"></div>
      <div class="field"><label for="ed-usuario">Nombre de usuario</label>
        <input class="control" id="ed-usuario" name="usuario" value="${esc(c.usuario)}" autocomplete="off"></div>
      <div class="field"><label for="ed-rol">Cargo</label>
        <select class="control" id="ed-rol" name="rol">${ROLES_ORDEN.map(k => `<option value="${k}"${k === c.rol ? ' selected' : ''}>${esc(ROLES[k])}</option>`).join('')}</select></div>
      <div class="field"><label class="casilla"><input type="checkbox" id="ed-activo" name="activo"${c.activo ? ' checked' : ''}> Cuenta activa (puede entrar)</label></div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Guardar cambios</button>
        <button class="btn" type="button" data-accion="cerrar-dialogo">Cancelar</button></div>
    </form>`);
}

async function enviarEditarCuenta(form) {
  const id = Number(form.dataset.cuenta), f = new FormData(form), caja = form.querySelector('[data-aviso-dialogo]');
  const cambios = { usuario: String(f.get('usuario') || '').trim(), rol: f.get('rol') || '', activo: form.querySelector('#ed-activo').checked };
  await conBoton(form, async () => {
    const r = await api('PUT', `usuarios.php?id=${id}`, cambios);
    if (!r.ok) { errorDeServidor(form, caja, r, MAPA_EDICION); return; }
    await cargarDatos();
    cerrarDialogoCuenta();
    flash = { tipo: 'ok', texto: 'Se guardaron los cambios de la cuenta.' };
    abrir('usuarios-accesos');
  });
}

function abrirRestablecerClave(id) {
  const c = cuentaPorId(id);
  if (!c) return;
  abrirDialogoCuenta(`Restablecer la clave de ${c.usuario}`, `
    <form id="form-restablecer-clave" class="form-dialogo" novalidate data-cuenta="${c.id}">
      <div class="aviso-caja" data-aviso-dialogo aria-live="polite"></div>
      <p class="hint">Las sesiones abiertas de esta cuenta se cerrarán. Entrega la nueva clave en persona.</p>
      <div class="field"><label for="rc-clave">Nueva clave temporal</label>
        <input class="control" id="rc-clave" name="clave" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres"></div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Restablecer clave</button>
        <button class="btn" type="button" data-accion="cerrar-dialogo">Cancelar</button></div>
    </form>`);
}

async function enviarRestablecerClave(form) {
  const id = Number(form.dataset.cuenta), caja = form.querySelector('[data-aviso-dialogo]');
  const clave = String(new FormData(form).get('clave') || '');
  if (!clave) { mostrarErrores(form, caja, [{ campo: 'rc-clave', texto: 'Escribe la nueva clave temporal.' }]); return; }
  await conBoton(form, async () => {
    const r = await api('PUT', `usuarios.php?id=${id}`, { clave });
    if (!r.ok) { errorDeServidor(form, caja, r, MAPA_RESTABLECER); return; }
    await cargarDatos();
    cerrarDialogoCuenta();
    flash = { tipo: 'ok', texto: 'Se restableció la clave. Las sesiones abiertas de esa cuenta se cerraron.' };
    abrir('usuarios-accesos');
  });
}

async function cambiarEstadoCuenta(btn) {
  if (!tiene('usuarios-accesos', 'editar')) return;
  const id = Number(btn.dataset.id), activo = btn.dataset.activo === '1';
  const c = cuentaPorId(id);
  if (!c) return;
  if (!activo && !confirm(`¿Desactivar la cuenta de ${c.nombres} ${c.apellidos}? No podrá entrar hasta que la vuelvas a activar.`)) return;
  const r = await api('PUT', `usuarios.php?id=${id}`, { activo });
  if (!r.ok) { mostrarAviso($('#aviso-cuentas'), 'error', textoErrorCuentas(r)); return; }
  await cargarDatos();
  flash = { tipo: 'ok', texto: activo ? `Se activó la cuenta de ${c.nombres} ${c.apellidos}.` : `Se desactivó la cuenta de ${c.nombres} ${c.apellidos}. Ya no podrá entrar.` };
  abrir('usuarios-accesos');
}

/* ---------- Matriz de permisos: Rol → Módulo → Acciones ---------- */
function pintarMatriz() {
  const cont = $('#matriz-permisos');
  if (!cont || !ADMIN) return;
  const roles = ROLES_ORDEN.map(k => ADMIN.roles.find(r => r.clave === k)).filter(Boolean);
  const puedeEditar = tiene('usuarios-accesos', 'editar');
  const filas = ADMIN.modulos.map(m => {
    const aplicables = ADMIN.aplicables[m.clave] || [];
    const celdas = roles.map(r => {
      const activas = (PERMISOS[m.clave] && PERMISOS[m.clave][r.clave]) || [];
      const casillas = aplicables.map(a => {
        const marcado = activas.includes(a);
        const protegido = r.clave === 'admin' && m.clave === 'usuarios-accesos' && PROTEGIDOS_ADMIN.includes(a);
        const etiqueta = (ADMIN.acciones.find(x => x.clave === a) || { nombre: a }).nombre;
        const titulo = protegido ? ' title="Este permiso no se puede quitar al administrador"' : '';
        return `<label class="casilla-permiso${protegido ? ' bloqueada' : ''}"${titulo}>
          <input type="checkbox" class="chk-permiso" data-rol="${esc(r.clave)}" data-modulo="${esc(m.clave)}" data-acc="${esc(a)}"${marcado ? ' checked' : ''}${(!puedeEditar || protegido) ? ' disabled' : ''}>
          <span>${esc(etiqueta)}</span></label>`;
      }).join('');
      return `<td>${casillas || '<span class="muted">—</span>'}</td>`;
    }).join('');
    return `<tr><th scope="row">${esc(m.nombre)}</th>${celdas}</tr>`;
  }).join('');
  cont.innerHTML = `<div style="overflow-x:auto"><table class="matriz" id="tabla-matriz">
    <thead><tr><th scope="col">Campo</th>${roles.map(r => `<th scope="col">${esc(r.nombre)}</th>`).join('')}</tr></thead>
    <tbody>${filas}</tbody></table></div>`;
}

document.addEventListener('change', async e => {
  const t = e.target;
  if (!t.classList || !t.classList.contains('chk-permiso') || !ADMIN) return;
  if (!tiene('usuarios-accesos', 'editar')) return;
  const rol = t.dataset.rol, modulo = t.dataset.modulo;
  const marcadas = [...t.closest('td').querySelectorAll('input.chk-permiso')].filter(x => x.checked).map(x => x.dataset.acc);
  t.disabled = true;
  const r = await api('PUT', 'permisos.php', { rol, modulo, acciones: marcadas });
  if (!r.ok) {
    t.checked = !t.checked;
    t.disabled = false;
    mostrarAviso($('#aviso-cuentas'), 'error', textoErrorCuentas(r));
    return;
  }
  await cargarDatos();
  flash = { tipo: 'ok', texto: `Se guardaron los permisos de ${nombreRolCuenta(rol)} en «${nombreModuloAdmin(modulo)}».` };
  abrir('usuarios-accesos');
});

/* ---------- Cambiar mi clave (cualquier cuenta) ---------- */
function abrirMiClave() {
  abrirDialogoCuenta('Cambiar mi clave', `
    <form id="form-mi-clave" class="form-dialogo" novalidate>
      <div class="aviso-caja" data-aviso-dialogo aria-live="polite"></div>
      <p class="hint">Las demás sesiones de tu cuenta se cerrarán. Esta sesión sigue abierta.</p>
      <div class="field"><label for="mc-actual">Clave actual</label>
        <input class="control" id="mc-actual" name="claveActual" type="password" autocomplete="current-password"></div>
      <div class="field"><label for="mc-nueva">Clave nueva</label>
        <input class="control" id="mc-nueva" name="claveNueva" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres"></div>
      <div class="field"><label for="mc-repetir">Repite la clave nueva</label>
        <input class="control" id="mc-repetir" name="repetir" type="password" autocomplete="new-password"></div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Cambiar clave</button>
        <button class="btn" type="button" data-accion="cerrar-dialogo">Cancelar</button></div>
    </form>`);
}

async function enviarMiClave(form) {
  const f = new FormData(form), caja = form.querySelector('[data-aviso-dialogo]');
  const nueva = String(f.get('claveNueva') || ''), repetir = String(f.get('repetir') || '');
  if (nueva !== repetir) { mostrarErrores(form, caja, [{ campo: 'mc-repetir', texto: 'Las dos claves nuevas no coinciden.' }]); return; }
  await conBoton(form, async () => {
    const r = await api('POST', 'mi_clave.php', { claveActual: String(f.get('claveActual') || ''), claveNueva: nueva });
    if (!r.ok) { errorDeServidor(form, caja, r, MAPA_MI_CLAVE); return; }
    form.reset();
    form.querySelectorAll('input').forEach(i => { i.disabled = true; });
    mostrarAviso(caja, 'ok', 'Tu clave se cambió. Las demás sesiones de tu cuenta se cerraron.');
  });
}

/* ---------- Eventos ---------- */
document.addEventListener('submit', e => {
  const f = e.target;
  if (f.id === 'form-cuenta') { e.preventDefault(); enviarCuentaNueva(f); }
  else if (f.id === 'form-editar-cuenta') { e.preventDefault(); enviarEditarCuenta(f); }
  else if (f.id === 'form-restablecer-clave') { e.preventDefault(); enviarRestablecerClave(f); }
  else if (f.id === 'form-mi-clave') { e.preventDefault(); enviarMiClave(f); }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-accion]');
  if (!b) return;
  const id = Number(b.dataset.id);
  switch (b.dataset.accion) {
    case 'cuenta-nueva-toggle': cuentaNuevaAbierta = !cuentaNuevaAbierta; abrir('usuarios-accesos'); break;
    case 'cuenta-editar': abrirEditarCuenta(id); break;
    case 'cuenta-clave': abrirRestablecerClave(id); break;
    case 'cuenta-estado': cambiarEstadoCuenta(b); break;
    case 'cerrar-dialogo': cerrarDialogoCuenta(); break;
    case 'mi-clave': abrirMiClave(); break;
    default: break;
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'cu-buscar') { cuentasTexto = e.target.value; pintarCuentas(); }
});


/* =====================================================================
   INICIO · PANEL POR ROL · versión 9
   Cada cargo ve su panel: tarjetas, gráficos y tablas de los campos que puede consultar.
   Los cálculos los hace el servidor (api/panel.php) con el alcance de cada cargo; aquí solo se dibujan.
   ===================================================================== */
const fmtNumeroPanel = n => new Intl.NumberFormat('es-CO').format(Number(n) || 0);
const fmtCopPanel = n => `$ ${new Intl.NumberFormat('es-CO').format(Math.round(Number(n) || 0))}`;
const etiquetaCorta = s => { const t = String(s); return t.length > 13 ? `${t.slice(0, 12)}…` : t; };

async function vistaInicio(el) {
  el.innerHTML = `
    <div id="panel-rol" aria-live="polite"><p class="vacio">Cargando tu panel…</p></div>
    <h2 class="subtitulo-form panel-separador">Campos de SIGAP</h2>
    <div id="panel-accesos"></div>`;
  vistaInicioCampos($('#panel-accesos'));
  const r = await api('GET', 'panel.php');
  const cont = $('#panel-rol');
  if (!cont) return;
  if (!r.ok) {
    cont.innerHTML = vacio('No se pudo cargar tu panel', (r.datos && r.datos.mensaje) || 'Revisa tu conexión e inténtalo de nuevo.');
    return;
  }
  cont.innerHTML = panelHTML(r.datos);
  const componente = cont.querySelector('[data-componente="cumpleanos"] .componente-panel');
  if (componente) vistaCumpleanos(componente);
}

function panelHTML(p) {
  const cabecera = `<p class="panel-desc panel-cab"><b>${esc(p.cargo)}</b> · ${esc(p.periodo)}</p>`;
  const bloques = p.bloques.map(bloquePanelHTML).join('');
  return cabecera + (bloques || vacio('Tu panel está vacío', 'Tu cargo no tiene campos de consulta por ahora.'));
}

function bloquePanelHTML(b) {
  // Lista completa de cumpleaños (la discipuladora): la misma pantalla de Reportes, dentro del Inicio
  if (b.componente === 'cumpleanos') {
    return `<section class="bloque-panel" id="panel-${esc(b.id)}" data-componente="${esc(b.componente)}">
      ${b.nota ? `<p class="panel-desc">${esc(b.nota)}</p>` : ''}
      <div class="componente-panel"></div>
    </section>`;
  }
  const tarjetas = b.tarjetas.length
    ? `<div class="stats">${b.tarjetas.map(t => `<div class="stat"><div class="n">${esc(t.valor)}</div><div class="l">${esc(t.titulo)}</div></div>`).join('')}</div>`
    : '';
  return `<section class="panel bloque-panel" id="panel-${esc(b.id)}" aria-labelledby="titulo-${esc(b.id)}">
    <h2 id="titulo-${esc(b.id)}">${esc(b.titulo)}</h2>
    ${b.nota ? `<p class="panel-desc">${esc(b.nota)}</p>` : ''}
    ${b.aviso ? `<p class="hint">${esc(b.aviso)}</p>` : ''}
    ${tarjetas}
    ${b.graficos.map(graficoBarrasSVG).join('')}
    ${b.tablas.map(t => tablaPanelHTML(t, b.id)).join('')}
  </section>`;
}

// Gráfico de barras en SVG: sin librerías, escala con la pantalla y cada barra dice su valor
function graficoBarrasSVG(g) {
  const fmt = g.formato === 'cop' ? fmtCopPanel : fmtNumeroPanel;
  if (!g.valores.length || g.valores.every(v => !v)) {
    return `<figure class="grafico"><figcaption>${esc(g.titulo)}</figcaption><p class="hint">Sin datos para mostrar en este período.</p></figure>`;
  }
  const W = 520, H = 240, pIzq = 14, pDer = 14, pSup = 28, pInf = 40;
  const max = Math.max(...g.valores, 1);
  const ancho = (W - pIzq - pDer) / g.valores.length;
  const barras = g.valores.map((v, i) => {
    const alto = Math.max(0, Math.round((v / max) * (H - pSup - pInf)));
    const x = pIzq + i * ancho + ancho * 0.16;
    const w = ancho * 0.68;
    const y = H - pInf - alto;
    const cx = (x + w / 2).toFixed(1);
    return `<g>
      <title>${esc(g.etiquetas[i])}: ${esc(fmt(v))}</title>
      <rect class="barra" x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${alto}" rx="3"></rect>
      <text class="barra-valor" x="${cx}" y="${y - 6}" text-anchor="middle">${esc(fmt(v))}</text>
      <text class="barra-etiqueta" x="${cx}" y="${H - pInf + 18}" text-anchor="middle">${esc(etiquetaCorta(g.etiquetas[i]))}</text>
    </g>`;
  }).join('');
  const resumen = g.etiquetas.map((e, i) => `${e}: ${fmt(g.valores[i])}`).join('; ');
  return `<figure class="grafico">
    <figcaption>${esc(g.titulo)}</figcaption>
    <svg class="grafico-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${g.titulo}. ${resumen}`)}" preserveAspectRatio="xMidYMid meet">
      <line class="eje" x1="${pIzq}" y1="${H - pInf}" x2="${W - pDer}" y2="${H - pInf}"></line>
      ${barras}
    </svg>
  </figure>`;
}

function tablaPanelHTML(t, bloqueId) {
  const slug = `${bloqueId}-${t.titulo}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
  const filas = t.filas.length
    ? t.filas.map(f => `<tr${f.marca ? ` class="${esc(f.marca)}"` : ''}>${f.celdas.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`)
    : [`<tr><td colspan="${t.columnas.length}" class="vacio">${esc(t.vacio || 'Sin datos.')}</td></tr>`];
  return `<h3 class="subtitulo-form">${esc(t.titulo)}</h3>
    ${tabla(`tabla-panel-${slug}`, t.columnas.map(c => ({ t: c })), filas, t.titulo)}`;
}


/* =====================================================================
   CAMPO: ACTIVIDADES GENERALES · versión 10
   Servicios de iglesia, discipulados de mujeres, seminarios y otras actividades especiales.
   El administrador administra los tipos. Las reglas están en el servidor
   (api/actividades.php y api/tipos_actividad.php).
   ===================================================================== */
let agFiltro = { tipo: '', periodo: 'mes' };
const MAPA_ACTIVIDAD = { tipoId: 'ag-tipo', fecha: 'ag-fecha', horaInicio: 'ag-inicio', horaFin: 'ag-fin',
  lugar: 'ag-lugar', responsableId: 'ag-responsable', asistentes: 'ag-buscar', observaciones: 'ag-obs' };
const MAPA_ACTIVIDAD_EDIT = { tipoId: 'age-tipo', fecha: 'age-fecha', horaInicio: 'age-inicio', horaFin: 'age-fin',
  lugar: 'age-lugar', responsableId: 'age-responsable', asistentes: 'age-buscar', observaciones: 'age-obs' };

const tiposTodos = () => db.tiposActividad.slice().sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
const tiposActivos = () => tiposTodos().filter(t => t.activo);
const nombreTipoAct = id => { const t = db.tiposActividad.find(x => x.id === id); return t ? t.nombre : '—'; };
const actividadPorId = id => db.actividadesGenerales.find(a => a.id === id);
const opcionesPersonasAct = sel => '<option value="">Sin responsable</option>'
  + db.personas.slice().sort((a, b) => `${a.nombres} ${a.apellidos}`.localeCompare(`${b.nombres} ${b.apellidos}`, 'es'))
    .map(p => `<option value="${p.num}"${p.num === sel ? ' selected' : ''}>${esc(`${p.nombres} ${p.apellidos}`)}</option>`).join('');

function statsActividades() {
  const mes = hoyISO().slice(0, 7);
  const delMes = db.actividadesGenerales.filter(a => a.fecha.slice(0, 7) === mes);
  const asistentes = delMes.reduce((s, a) => s + a.asistentes, 0);
  const promedio = delMes.length ? Math.round(asistentes / delMes.length) : null;
  return `
    <div class="stat"><div class="n">${delMes.length}</div><div class="l">Actividades este mes</div></div>
    <div class="stat"><div class="n">${fmtNumeroPanel(asistentes)}</div><div class="l">Asistentes este mes</div></div>
    <div class="stat"><div class="n">${promedio === null ? '—' : fmtNumeroPanel(promedio)}</div><div class="l">Asistencia promedio</div></div>
    <div class="stat"><div class="n">${tiposActivos().length}</div><div class="l">Tipos activos</div></div>`;
}

function actividadesFiltradas() {
  const hoy = hoyISO();
  return db.actividadesGenerales.filter(a => {
    if (agFiltro.tipo && a.tipoId !== Number(agFiltro.tipo)) return false;
    if (agFiltro.periodo === 'mes') return a.fecha.slice(0, 7) === hoy.slice(0, 7);
    if (agFiltro.periodo === 'anio') return a.fecha.slice(0, 4) === hoy.slice(0, 4);
    return true;
  });
}

function filtrosActividades() {
  return `
    <div class="field corto"><label for="ag-f-periodo">Período</label>
      <select class="control" id="ag-f-periodo">
        <option value="mes"${agFiltro.periodo === 'mes' ? ' selected' : ''}>Este mes</option>
        <option value="anio"${agFiltro.periodo === 'anio' ? ' selected' : ''}>Este año</option>
        <option value="todas"${agFiltro.periodo === 'todas' ? ' selected' : ''}>Todas</option>
      </select></div>
    <div class="field corto"><label for="ag-f-tipo">Tipo</label>
      <select class="control" id="ag-f-tipo"><option value="">Todos</option>${tiposTodos().map(t =>
        `<option value="${t.id}"${agFiltro.tipo === String(t.id) ? ' selected' : ''}>${esc(t.nombre)}${t.activo ? '' : ' (desactivado)'}</option>`).join('')}</select></div>`;
}

function filaActividad(a) {
  const puedeEditar = tiene('actividades', 'editar');
  const puedeEliminar = tiene('actividades', 'eliminar');
  const acciones = (puedeEditar || puedeEliminar)
    ? `<div class="acciones-fila">${puedeEditar ? `<button class="btn btn-small" type="button" data-accion="act-editar" data-id="${a.id}">Editar</button>` : ''}${puedeEliminar ? `<button class="btn btn-small" type="button" data-accion="act-eliminar" data-id="${a.id}">Eliminar</button>` : ''}</div>`
    : '<span class="muted">—</span>';
  return `<tr>
    <td>${esc(fechaCorta(a.fecha))}</td>
    <td><b>${esc(nombreTipoAct(a.tipoId))}</b></td>
    <td>${esc(a.horaInicio)}${a.horaFin ? ` – ${esc(a.horaFin)}` : ''}</td>
    <td>${a.lugar ? esc(a.lugar) : '<span class="muted">—</span>'}</td>
    <td>${a.responsableId ? esc(personaNombre(a.responsableId)) : '<span class="muted">—</span>'}</td>
    <td class="num">${esc(fmtNumeroPanel(a.asistentes))}</td>
    <td class="no-print">${acciones}</td>
  </tr>`;
}

function pintarActividades() {
  const stats = $('#act-stats');
  if (stats) stats.innerHTML = statsActividades();
  const cont = $('#act-lista');
  if (!cont) return;
  const lista = actividadesFiltradas().sort((a, b) => b.fecha.localeCompare(a.fecha) || b.horaInicio.localeCompare(a.horaInicio) || b.id - a.id);
  cont.innerHTML = lista.length
    ? tabla('tabla-actividades', [{ t: 'Fecha' }, { t: 'Tipo' }, { t: 'Horario' }, { t: 'Lugar' }, { t: 'Responsable' },
        { t: 'Asistentes', num: true }, { t: 'Acciones', noprint: true }], lista.map(filaActividad), 'Actividades generales registradas')
    : vacio('No hay actividades con estos filtros.', 'Cambia el período o el tipo, o registra una actividad.');
  pintarTiposActividad();
}

function formularioActividad(tipos) {
  const hoy = hoyISO();
  return `<section class="panel">
    <form id="form-actividad" novalidate>
      <div class="aviso-caja" id="aviso-actividad" aria-live="polite"></div>
      <h2>Registrar actividad</h2>
      <p class="form-intro">Los campos con <span class="req">*</span> son obligatorios. La fecha no puede ser futura.</p>
      <div class="form-grid">
        <div class="field"><label for="ag-tipo">Tipo <span class="req" aria-hidden="true">*</span></label>
          <select class="control" id="ag-tipo" name="tipoId">${tipos.map(t => `<option value="${t.id}">${esc(t.nombre)}</option>`).join('')}</select></div>
        <div class="field"><label for="ag-fecha">Fecha <span class="req" aria-hidden="true">*</span></label>
          <input class="control" id="ag-fecha" name="fecha" type="date" max="${hoy}" value="${hoy}"></div>
        <div class="field"><label for="ag-inicio">Hora de inicio <span class="req" aria-hidden="true">*</span></label>
          <input class="control" id="ag-inicio" name="horaInicio" type="time"></div>
        <div class="field"><label for="ag-fin">Hora de fin</label>
          <input class="control" id="ag-fin" name="horaFin" type="time"></div>
        ${bloqueAsistentesAct('ag', [], null)}
        <div class="field"><label for="ag-responsable">Responsable</label>
          <select class="control" id="ag-responsable" name="responsableId">${opcionesPersonasAct(null)}</select></div>
        <div class="field full"><label for="ag-lugar">Lugar</label>
          <input class="control" id="ag-lugar" name="lugar" maxlength="160" placeholder="ej. Templo principal" autocomplete="off"></div>
        <div class="field full"><label for="ag-obs">Observaciones</label>
          <textarea class="control" id="ag-obs" name="observaciones" rows="2"></textarea></div>
      </div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Registrar actividad</button><button class="btn" type="reset">Limpiar</button></div>
    </form>
  </section>`;
}

// Valida lo mismo que el servidor, para avisar antes de enviar. Devuelve los errores con el id del campo.
function validarActividadFront(c, mapa) {
  const e = [];
  const falla = (campo, texto) => e.push({ campo: mapa[campo], texto });
  if (!c.tipoId) falla('tipoId', 'Elige el tipo de actividad.');
  if (!c.fecha) falla('fecha', 'Elige la fecha de la actividad.');
  else if (c.fecha > hoyISO()) falla('fecha', 'La fecha no puede ser futura.');
  if (!c.horaInicio) falla('horaInicio', 'Escribe la hora de inicio.');
  if (c.horaFin && c.horaInicio && c.horaFin <= c.horaInicio) falla('horaFin', 'La hora de fin debe ser posterior a la de inicio.');
  if (!Array.isArray(c.asistentes)) falla('asistentes', 'Marca a las personas que asistieron.');
  return e;
}

function leerActividadDeFormulario(f) {
  return {
    tipoId: Number(f.get('tipoId')) || null,
    fecha: String(f.get('fecha') || ''),
    horaInicio: String(f.get('horaInicio') || ''),
    horaFin: String(f.get('horaFin') || ''),
    lugar: String(f.get('lugar') || '').trim(),
    responsableId: Number(f.get('responsableId')) || null,
    asistentes: f.getAll('asistentes').map(Number),
    observaciones: String(f.get('observaciones') || '').trim(),
  };
}

async function enviarActividad(form) {
  if (!tiene('actividades', 'registrar')) return;
  const caja = $('#aviso-actividad');
  const c = leerActividadDeFormulario(new FormData(form));
  const errores = validarActividadFront(c, MAPA_ACTIVIDAD);
  if (errores.length) { mostrarErrores(form, caja, errores); return; }
  await conBoton(form, async () => {
    const r = await api('POST', 'actividades.php', c);
    if (!r.ok) { errorDeServidor(form, caja, r, MAPA_ACTIVIDAD); return; }
    await cargarDatos();
    flash = { tipo: 'ok', texto: 'Se registró la actividad.' };
    abrir('actividades');
  });
}

/* ---------- Asistentes de las actividades, por persona (versión 17) ---------- */
// Personas para marcar, ordenadas por apellido. El id es el número de la persona.
function personasParaAsistencia() {
  return [...(db.personas || [])]
    .map(p => ({ id: p.num ?? p.id, nombre: `${p.nombres || ''} ${p.apellidos || ''}`.trim(), apellidos: p.apellidos || '', nombres: p.nombres || '' }))
    .sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es') || a.nombres.localeCompare(b.nombres, 'es'));
}

// Lista de casillas: marcar a cada persona que asistió. El total es el número de casillas marcadas.
// «legado» es el total de una actividad registrada antes de la lista por persona (sin detalle).
function bloqueAsistentesAct(pref, seleccion, legado) {
  const marcados = new Set(seleccion);
  const filas = personasParaAsistencia().map(p =>
    `<label class="act-fila"><input type="checkbox" name="asistentes" value="${p.id}"${marcados.has(p.id) ? ' checked' : ''}> <span>${esc(p.nombre)}</span></label>`).join('');
  return `<fieldset class="field full act-asistentes" id="${pref}-asistentes">
    <legend>Asistentes <span class="req" aria-hidden="true">*</span></legend>
    <p class="hint">Marca a cada persona que asistió. El total de la actividad es el número de personas marcadas.</p>
    ${legado ? `<p class="hint">Esta actividad se registró antes de la lista por persona: tiene ${esc(String(legado))} asistentes sin detalle. Si marcas la lista, el total será el de las personas marcadas.</p>` : ''}
    <div class="field"><label for="${pref}-buscar">Buscar persona</label>
      <input class="control" id="${pref}-buscar" type="search" autocomplete="off" placeholder="Nombre o apellido"></div>
    <div class="act-lista" id="${pref}-lista">${filas || '<p class="hint">No hay personas registradas todavía.</p>'}</div>
    <p class="sub-dato"><b>${marcados.size}</b> asistentes marcados</p>
  </fieldset>`;
}

document.addEventListener('input', e => {
  const m = /^(ag|age)-buscar$/.exec(e.target.id || '');
  if (!m) return;
  const texto = ubicNormal(e.target.value.trim());
  document.querySelectorAll(`#${m[1]}-lista .act-fila`).forEach(f => { f.hidden = !!texto && !ubicNormal(f.textContent).includes(texto); });
});
document.addEventListener('change', e => {
  if (!e.target.matches || !e.target.matches('.act-asistentes input[type="checkbox"]')) return;
  const fs = e.target.closest('.act-asistentes');
  const total = fs.querySelector('.sub-dato b');
  if (total) total.textContent = String(fs.querySelectorAll('input[type="checkbox"]:checked').length);
});

/* ---------- Diálogo para corregir una actividad ---------- */
function asegurarDialogoActividad() {
  if (document.getElementById('dlg-actividad')) return;
  const d = document.createElement('dialog');
  d.id = 'dlg-actividad';
  d.className = 'dialogo';
  d.addEventListener('close', () => { d.innerHTML = ''; });
  document.body.appendChild(d);
}
function cerrarDialogoActividad() {
  const d = document.getElementById('dlg-actividad');
  if (!d) return;
  if (typeof d.close === 'function' && d.open) d.close();
  d.removeAttribute('open');
  d.innerHTML = '';
}
function abrirEditarActividad(id) {
  const a = actividadPorId(id);
  if (!a) return;
  asegurarDialogoActividad();
  const tipos = tiposTodos().filter(t => t.activo || t.id === a.tipoId);
  const d = document.getElementById('dlg-actividad');
  d.innerHTML = `<div class="dialogo-cab"><h2 id="dlg-actividad-tit">Corregir actividad</h2>
      <button class="btn btn-small" type="button" data-accion="act-cerrar" aria-label="Cerrar">Cerrar</button></div>
    <form id="form-editar-actividad" class="form-dialogo" novalidate data-id="${a.id}">
      <div class="aviso-caja" data-aviso-dialogo aria-live="polite"></div>
      <div class="form-grid">
        <div class="field"><label for="age-tipo">Tipo</label>
          <select class="control" id="age-tipo" name="tipoId">${tipos.map(t => `<option value="${t.id}"${t.id === a.tipoId ? ' selected' : ''}>${esc(t.nombre)}${t.activo ? '' : ' (desactivado)'}</option>`).join('')}</select></div>
        <div class="field"><label for="age-fecha">Fecha</label>
          <input class="control" id="age-fecha" name="fecha" type="date" max="${hoyISO()}" value="${esc(a.fecha)}"></div>
        <div class="field"><label for="age-inicio">Hora de inicio</label>
          <input class="control" id="age-inicio" name="horaInicio" type="time" value="${esc(a.horaInicio)}"></div>
        <div class="field"><label for="age-fin">Hora de fin</label>
          <input class="control" id="age-fin" name="horaFin" type="time" value="${esc(a.horaFin)}"></div>
        ${bloqueAsistentesAct('age', a.asistentesIds || [], (!a.listaRegistrada && a.asistentes > 0) ? a.asistentes : null)}
        <div class="field"><label for="age-responsable">Responsable</label>
          <select class="control" id="age-responsable" name="responsableId">${opcionesPersonasAct(a.responsableId)}</select></div>
        <div class="field full"><label for="age-lugar">Lugar</label>
          <input class="control" id="age-lugar" name="lugar" maxlength="160" value="${esc(a.lugar)}" autocomplete="off"></div>
        <div class="field full"><label for="age-obs">Observaciones</label>
          <textarea class="control" id="age-obs" name="observaciones" rows="2">${esc(a.observaciones)}</textarea></div>
      </div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Guardar cambios</button>
        <button class="btn" type="button" data-accion="act-cerrar">Cancelar</button></div>
    </form>`;
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
}

async function enviarEditarActividad(form) {
  if (!tiene('actividades', 'editar')) return;
  const id = Number(form.dataset.id), caja = form.querySelector('[data-aviso-dialogo]');
  const c = leerActividadDeFormulario(new FormData(form));
  const errores = validarActividadFront(c, MAPA_ACTIVIDAD_EDIT);
  if (errores.length) { mostrarErrores(form, caja, errores); return; }
  await conBoton(form, async () => {
    const r = await api('PUT', `actividades.php?id=${id}`, c);
    if (!r.ok) { errorDeServidor(form, caja, r, MAPA_ACTIVIDAD_EDIT); return; }
    await cargarDatos();
    cerrarDialogoActividad();
    flash = { tipo: 'ok', texto: 'Se guardaron los cambios de la actividad.' };
    abrir('actividades');
  });
}

async function eliminarActividad(btn) {
  if (!tiene('actividades', 'eliminar')) return;
  const id = Number(btn.dataset.id), a = actividadPorId(id);
  if (!a) return;
  if (!confirm(`¿Eliminar la actividad «${nombreTipoAct(a.tipoId)}» del ${fechaCorta(a.fecha)}? No se puede deshacer.`)) return;
  const r = await api('DELETE', `actividades.php?id=${id}`);
  if (!r.ok) { mostrarAviso($('#aviso-actividades'), 'error', textoErrorCuentas(r)); return; }
  await cargarDatos();
  flash = { tipo: 'ok', texto: 'Se eliminó la actividad.' };
  abrir('actividades');
}

/* ---------- Catálogo de tipos (solo el administrador) ---------- */
function panelTiposActividad() {
  return `<section class="panel">
    <h2>Tipos de actividad</h2>
    <p class="panel-desc">Solo el administrador los administra. Un tipo desactivado deja de ofrecerse al registrar actividades, pero las anteriores lo conservan.</p>
    <form id="form-tipo-actividad" novalidate>
      <div class="aviso-caja" id="aviso-tipo-actividad" aria-live="polite"></div>
      <div class="inline">
        <input class="control" id="ag-nuevo-tipo" name="nombre" placeholder="Nombre del nuevo tipo" autocomplete="off" aria-label="Nombre del nuevo tipo">
        <button class="btn btn-primary" type="submit">Agregar tipo</button>
      </div>
    </form>
    <div id="ag-tipos-lista" style="margin-top:14px"></div>
  </section>`;
}

function pintarTiposActividad() {
  const cont = $('#ag-tipos-lista');
  if (!cont) return;
  cont.innerHTML = db.tiposActividad.length
    ? `<ul class="lista-simple">${tiposTodos().map(t => `<li><span>${esc(t.nombre)}${t.activo ? '' : ' <span class="pill lock">Desactivado</span>'}</span>
        <button class="btn btn-small" type="button" data-accion="tipo-activar" data-id="${t.id}" data-activo="${t.activo ? '0' : '1'}">${t.activo ? 'Desactivar' : 'Activar'}</button></li>`).join('')}</ul>`
    : '<p class="muted">Todavía no hay tipos.</p>';
}

async function enviarTipoActividad(form) {
  const caja = $('#aviso-tipo-actividad');
  const nombre = String(new FormData(form).get('nombre') || '').trim();
  if (!nombre) { mostrarAviso(caja, 'error', 'Escribe el nombre del tipo.'); return; }
  await conBoton(form, async () => {
    const r = await api('POST', 'tipos_actividad.php', { nombre });
    if (!r.ok) { mostrarAviso(caja, 'error', textoErrorCuentas(r)); return; }
    await cargarDatos();
    flash = { tipo: 'ok', texto: `Se agregó el tipo «${nombre}».` };
    abrir('actividades');
  });
}

async function cambiarTipoActividad(btn) {
  if (!tiene('tipos-actividad', 'editar')) return;
  const id = Number(btn.dataset.id), activo = btn.dataset.activo === '1';
  const r = await api('PUT', `tipos_actividad.php?id=${id}`, { activo });
  if (!r.ok) { mostrarAviso($('#aviso-tipo-actividad'), 'error', textoErrorCuentas(r)); return; }
  await cargarDatos();
  flash = { tipo: 'ok', texto: activo ? 'Se activó el tipo.' : 'Se desactivó el tipo. Las actividades anteriores lo conservan.' };
  abrir('actividades');
}

function vistaActividades(el) {
  const puedeRegistrar = tiene('actividades', 'registrar');
  const tipos = tiposActivos();
  el.innerHTML = `
    <div class="aviso-caja" id="aviso-actividades" aria-live="polite"></div>
    <div class="stats" id="act-stats"></div>
    ${puedeRegistrar ? (tipos.length ? formularioActividad(tipos)
      : vacio('No hay tipos de actividad disponibles.', 'El administrador los agrega abajo, en «Tipos de actividad».')) : ''}
    <section class="panel">
      <h2>Actividades registradas</h2>
      <p class="panel-desc">Servicios, discipulados de mujeres, seminarios y otras actividades de la iglesia, con su asistencia.</p>
      <div class="toolbar no-print">${filtrosActividades()}</div>
      <div id="act-lista"></div>
    </section>
    ${tiene('tipos-actividad', 'registrar') ? panelTiposActividad() : ''}`;
  if (flash) { mostrarAviso($('#aviso-actividades'), flash.tipo, flash.texto); flash = null; }
  pintarActividades();
}

// Sección de actividades generales para el reporte general, en el período elegido
function seccionActividadesReporte(p, r) {
  if (!tiene('actividades', 'consultar')) return '';
  const lista = db.actividadesGenerales.filter(a => dentroDePeriodo(a.fecha, p, r));
  const filas = tiposTodos().filter(t => t.activo || lista.some(a => a.tipoId === t.id)).map(t => {
    const de = lista.filter(a => a.tipoId === t.id);
    const asist = de.reduce((s, a) => s + a.asistentes, 0);
    return `<tr><td>${esc(t.nombre)}</td><td class="num">${de.length}</td><td class="num">${fmtNumeroPanel(asist)}</td>
      <td class="num">${de.length ? fmtNumeroPanel(Math.round(asist / de.length)) : '—'}</td></tr>`;
  });
  const asistTotal = lista.reduce((s, a) => s + a.asistentes, 0);
  return `<section class="panel">
    <h2>Actividades generales</h2>
    <p class="panel-desc">${lista.length
      ? `Servicios, discipulados de mujeres, seminarios y otras actividades. Total: <b>${lista.length}</b> actividades y <b>${fmtNumeroPanel(asistTotal)}</b> asistentes.`
      : 'Sin actividades en este período.'}</p>
    ${filas.length ? tabla('tabla-rep-actividades', [{ t: 'Tipo' }, { t: 'Actividades', num: true }, { t: 'Asistentes', num: true }, { t: 'Promedio', num: true }],
      filas, 'Actividades generales por tipo') : vacio('Sin actividades en este período.', '')}
  </section>`;
}

document.addEventListener('submit', e => {
  const f = e.target;
  if (f.id === 'form-actividad') { e.preventDefault(); enviarActividad(f); }
  else if (f.id === 'form-editar-actividad') { e.preventDefault(); enviarEditarActividad(f); }
  else if (f.id === 'form-tipo-actividad') { e.preventDefault(); enviarTipoActividad(f); }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-accion]');
  if (!b) return;
  const accion = b.dataset.accion;
  if (accion === 'act-editar') abrirEditarActividad(Number(b.dataset.id));
  else if (accion === 'act-eliminar') eliminarActividad(b);
  else if (accion === 'act-cerrar') cerrarDialogoActividad();
  else if (accion === 'tipo-activar') cambiarTipoActividad(b);
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'ag-f-periodo') { agFiltro.periodo = t.value; pintarActividades(); }
  else if (t.id === 'ag-f-tipo') { agFiltro.tipo = t.value; pintarActividades(); }
});


/* =====================================================================
   CAMPO: TOMAR ASISTENCIA · versión 11
   Marca quién asistió a la reunión de un grupo en un día. Se guarda en la misma reunión que
   usa Comunión Familiar (la crea si el grupo no tuvo reunión ese día). Las reglas están en
   api/tomar_asistencia.php. El discipulador solo ve sus grupos.
   ===================================================================== */
const MAPA_ASISTENCIA = { grupoId: 'asis-grupo', fecha: 'asis-fecha', horaInicio: 'asis-hora', asistentes: 'asis-lista' };
let asisDetalle = null;   // grupo, fecha, hora y participantes con su asistencia

const horaActualTexto = () => {
  const a = new Date();
  return `${String(a.getHours()).padStart(2, '0')}:${String(a.getMinutes()).padStart(2, '0')}`;
};

function vistaTomarAsistencia(el) {
  el.innerHTML = `
    <div class="aviso-caja" id="aviso-asistencia" aria-live="polite"></div>
    <div id="asis-cuerpo"><p class="vacio">Cargando tus grupos…</p></div>`;
  cargarGruposAsistencia();
}

async function cargarGruposAsistencia() {
  const r = await api('GET', 'tomar_asistencia.php');
  const cont = $('#asis-cuerpo');
  if (!cont) return;
  if (!r.ok) {
    cont.innerHTML = vacio('No se pudieron cargar tus grupos', (r.datos && r.datos.mensaje) || 'Inténtalo de nuevo.');
    return;
  }
  const grupos = r.datos.grupos || [];
  if (!grupos.length) {
    cont.innerHTML = vacio('No tienes grupos para tomar asistencia',
      'Aparecen aquí los grupos activos que discipulas. Si crees que falta alguno, pide al administrador que revise el grupo.');
    return;
  }
  cont.innerHTML = `
    <section class="panel">
      <h2>¿Quién asistió?</h2>
      <p class="panel-desc">Marca a quienes llegaron. Lo que guardes queda en la reunión del grupo de ese día, igual que en Comunión Familiar.</p>
      <div class="form-grid">
        <div class="field"><label for="asis-grupo">Grupo <span class="req" aria-hidden="true">*</span></label>
          <select class="control" id="asis-grupo">${grupos.map(g => `<option value="${g.id}">${esc(g.nombre)}</option>`).join('')}</select></div>
        <div class="field"><label for="asis-fecha">Fecha <span class="req" aria-hidden="true">*</span></label>
          <input class="control" id="asis-fecha" type="date" max="${hoyISO()}" value="${hoyISO()}"></div>
        <div class="field"><label for="asis-hora">Hora de inicio <span class="req" aria-hidden="true">*</span></label>
          <input class="control" id="asis-hora" type="time"></div>
      </div>
      <div id="asis-info"></div>
      <form id="form-tomar-asistencia" novalidate>
        <div id="asis-lista"></div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Guardar asistencia</button></div>
      </form>
    </section>`;
  await cargarDetalleAsistencia();
}

async function cargarDetalleAsistencia() {
  const grupo = $('#asis-grupo'), fecha = $('#asis-fecha');
  if (!grupo || !fecha) return;
  const r = await api('GET', `tomar_asistencia.php?grupo=${grupo.value}&fecha=${fecha.value}`);
  if (!r.ok) {
    $('#asis-lista').innerHTML = '';
    $('#asis-info').innerHTML = '';
    mostrarAviso($('#aviso-asistencia'), 'error', (r.datos && r.datos.mensaje) || 'No se pudo cargar el grupo.');
    return;
  }
  asisDetalle = r.datos;
  const hora = $('#asis-hora');
  hora.value = asisDetalle.horaInicio || horaActualTexto();
  $('#asis-info').innerHTML = asisDetalle.reunionId
    ? `<p class="hint">Ya hay una reunión de este grupo para esta fecha. Al guardar se actualizará su asistencia.${asisDetalle.visitantes ? ` Visitantes registrados: ${asisDetalle.visitantes} (se editan en Comunión Familiar).` : ''}</p>`
    : '<p class="hint">Este grupo todavía no tiene reunión para esta fecha. Al guardar se creará.</p>';
  const lista = $('#asis-lista');
  if (!asisDetalle.participantes.length) {
    lista.innerHTML = vacio('Este grupo no tiene participantes', 'Agrégalos en Comunión Familiar y luego vuelve aquí.');
    return;
  }
  lista.innerHTML = `
    <p class="hint" id="asis-contador"></p>
    <div class="lista-asistencia">${asisDetalle.participantes.map(p => `
      <label class="fila-asistencia">
        <input type="checkbox" class="chk-asistencia" name="asistentes" value="${p.id}"${p.presente ? ' checked' : ''}>
        <span>${esc(p.nombre)}</span>
      </label>`).join('')}
    </div>`;
  actualizarContadorAsistencia();
}

function actualizarContadorAsistencia() {
  const cont = $('#asis-contador');
  if (!cont || !asisDetalle) return;
  const marcados = document.querySelectorAll('.chk-asistencia:checked').length;
  cont.textContent = `Asistieron ${marcados} de ${asisDetalle.participantes.length} personas.`;
}

async function enviarAsistencia(form) {
  if (!tiene('tomar-asistencia', 'registrar')) return;
  const caja = $('#aviso-asistencia');
  const grupoId = Number($('#asis-grupo').value) || null;
  const fecha = $('#asis-fecha').value;
  const horaInicio = $('#asis-hora').value;
  const asistentes = [...document.querySelectorAll('.chk-asistencia:checked')].map(c => Number(c.value));
  const errores = [];
  if (!fecha) errores.push({ campo: 'asis-fecha', texto: 'Elige la fecha.' });
  else if (fecha > hoyISO()) errores.push({ campo: 'asis-fecha', texto: 'La fecha no puede ser futura.' });
  if (!horaInicio) errores.push({ campo: 'asis-hora', texto: 'Escribe la hora de inicio.' });
  if (errores.length) { mostrarErrores(form, caja, errores); return; }
  await conBoton(form, async () => {
    const r = await api('POST', 'tomar_asistencia.php', { grupoId, fecha, horaInicio, asistentes });
    if (!r.ok) { errorDeServidor(form, caja, r, MAPA_ASISTENCIA); return; }
    const total = asisDetalle ? asisDetalle.participantes.length : asistentes.length;
    await cargarDetalleAsistencia();
    mostrarAviso($('#aviso-asistencia'), 'ok',
      `Se guardó la asistencia: ${asistentes.length} de ${total} personas. Puedes verla en Comunión Familiar.`);
  });
}

document.addEventListener('submit', e => {
  if (e.target.id === 'form-tomar-asistencia') { e.preventDefault(); enviarAsistencia(e.target); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'asis-grupo' || t.id === 'asis-fecha') cargarDetalleAsistencia();
  else if (t.classList && t.classList.contains('chk-asistencia')) actualizarContadorAsistencia();
});


/* =====================================================================
   CAMPO: FICHA DE PERSONA · versión 12
   Busca a una persona por nombre y revisa su historial. Cada sección aparece solo si el cargo
   puede consultar su campo (las reglas están en api/fichas.php). Cada ficha abierta queda en la auditoría.
   ===================================================================== */
let fichaBusqueda = '';     // texto del buscador
let fichaActual = null;     // última ficha abierta
let fichaTimer = null;      // espera al terminar de escribir

// Fecha con año, para que las fechas de años distintos no se confundan
const fechaFicha = f => (f ? `${fechaCorta(f)} de ${String(f).slice(0, 4)}` : '—');

function vistaFichaPersona(el) {
  el.innerHTML = `
    <div class="aviso-caja" id="aviso-ficha" aria-live="polite"></div>
    <section class="panel">
      <h2>Buscar persona</h2>
      <p class="panel-desc">Escribe el nombre o el apellido. La ficha muestra solo las secciones que tu cargo puede consultar.</p>
      <div class="field"><label for="ficha-buscar">Nombre o apellido</label>
        <input class="control" id="ficha-buscar" type="search" autocomplete="off" placeholder="ej. Mateo" value="${esc(fichaBusqueda)}"></div>
      <div id="ficha-resultados"></div>
    </section>
    <div id="ficha-detalle"></div>`;
  if (fichaBusqueda.trim().length >= 2) buscarPersonasFicha(fichaBusqueda);
  if (fichaActual) pintarFicha(fichaActual);
}

async function buscarPersonasFicha(texto) {
  const cont = $('#ficha-resultados');
  if (!cont) return;
  if (texto.trim().length < 2) { cont.innerHTML = ''; return; }
  const r = await api('GET', `fichas.php?buscar=${encodeURIComponent(texto.trim())}`);
  if (!r.ok) {
    cont.innerHTML = vacio('No se pudo buscar', (r.datos && r.datos.mensaje) || 'Inténtalo de nuevo.');
    return;
  }
  const lista = r.datos.resultados;
  cont.innerHTML = lista.length
    ? `<ul class="lista-simple ficha-resultados">${lista.map(p => `<li>
        <button class="btn btn-small" type="button" data-accion="ficha-abrir" data-id="${p.id}">Ver ficha</button>
        <b>${esc(p.nombre)}</b> · ${esc(String(p.edad))} años</li>`).join('')}</ul>`
    : vacio('No encontramos a nadie con ese nombre', 'Revisa cómo se escribe o prueba solo con el apellido.');
}

async function abrirFicha(id) {
  const r = await api('GET', `fichas.php?id=${id}`);
  if (!r.ok) {
    mostrarAviso($('#aviso-ficha'), 'error', (r.datos && r.datos.mensaje) || 'No se pudo abrir la ficha.');
    return;
  }
  fichaActual = r.datos;
  pintarFicha(fichaActual);
  const d = $('#ficha-detalle');
  if (d) d.scrollIntoView({ block: 'start' });
}

function pintarFicha(f) {
  const cont = $('#ficha-detalle');
  if (!cont) return;
  const p = f.secciones.datos.persona;
  const s = f.secciones;
  cont.innerHTML = `
    <section class="panel ficha" aria-labelledby="ficha-titulo">
      <div class="ficha-cabecera">
        <div>
          <h2 id="ficha-titulo">${esc(p.nombre)}</h2>
          <p class="panel-desc">${esc(String(p.edad))} años · nació el ${esc(fechaFicha(p.nacimiento))}${p.funciones.length ? ` · ${esc(p.funciones.join(', '))}` : ''}</p>
        </div>
        <div class="ficha-foto">${p.tieneFoto ? `<img alt="Foto de ${esc(p.nombre)}" src="api/foto.php?id=${p.id}">` : '<span>Sin foto</span>'}</div>
      </div>
      ${bloqueDatosFicha(p)}
      ${s.comunion ? bloqueComunionFicha(s.comunion) : ''}
      ${s.adiestramiento ? bloqueAdiestramientoFicha(s.adiestramiento) : ''}
      ${s.pastoral ? bloquePastoralFicha(s.pastoral) : ''}
      ${s.registros ? bloqueRegistrosFicha(s.registros) : ''}
      ${f.ocultas.length ? `<p class="hint">Estas secciones no están disponibles para tu cargo: ${esc(f.ocultas.join(', '))}.</p>` : ''}
    </section>`;
}

function formatoTelefonoEmergencia(d) {
  if (!d) return '—';
  return `+57 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

function bloqueDatosFicha(p) {
  return `<h3 class="subtitulo-form">Datos de contacto</h3>
    <p class="sub-dato"><b>Teléfono:</b> ${esc(p.telefono || '—')}</p>
    <p class="sub-dato"><b>Correo:</b> ${esc(p.correo || '—')}</p>
    <p class="sub-dato"><b>Dirección:</b> ${esc(p.direccion || '—')}</p>
    <p class="sub-dato"><b>Teléfono de emergencia:</b> ${esc(formatoTelefonoEmergencia(p.telefonoEmergencia))}</p>
    <p class="sub-dato"><b>Cargo:</b> ${esc(p.cargoIglesia || '—')}</p>
    <p class="sub-dato"><b>Nacido de nuevo (bautizado):</b> ${p.bautizado ? 'Sí' : 'No'}</p>
    ${p.eps !== undefined ? `<p class="sub-dato"><b>EPS (solo administrador):</b> ${esc(p.eps || '—')}</p>` : ''}
    <p class="sub-dato"><b>Cuenta de acceso:</b> ${p.cuenta
      ? `${esc(p.cuenta.usuario)} · ${esc(p.cuenta.cargo)}${p.cuenta.activa ? '' : ' (desactivada)'}`
      : 'Sin cuenta de acceso'}</p>`;
}

function bloqueComunionFicha(c) {
  const grupos = c.grupos.length
    ? `<ul class="lista-simple">${c.grupos.map(g => `<li><b>${esc(g.nombre)}</b> · ${esc(g.roles.join(', '))}${g.desde ? ` · desde ${esc(fechaFicha(g.desde))}` : ''}</li>`).join('')}</ul>`
    : '<p class="muted">No participa en ningún grupo.</p>';
  const filas = c.ultimas.map(r => `<tr><td>${esc(fechaFicha(r.fecha))}</td><td>${esc(r.grupo)}</td><td>${r.asistio ? 'Sí' : 'No'}</td></tr>`);
  return `<h3 class="subtitulo-form">Comunión Familiar</h3>
    ${grupos}
    <p class="sub-dato"><b>Asistencia:</b> asistió a ${c.reuniones.asistio} de ${c.reuniones.total} reuniones de sus grupos.</p>
    ${filas.length
      ? tabla('tabla-ficha-reuniones', [{ t: 'Fecha' }, { t: 'Grupo' }, { t: 'Asistió' }], filas, 'Últimas reuniones')
      : vacio('Sin reuniones registradas.', '')}`;
}

function bloqueAdiestramientoFicha(a) {
  const cursos = a.cursos.length
    ? `<ul class="lista-simple">${a.cursos.map(c => `<li><b>${esc(c.nombre)}</b> · desde ${esc(fechaFicha(c.desde))}</li>`).join('')}</ul>`
    : '<p class="muted">No participa en ningún curso.</p>';
  const filas = a.ultimas.map(s => `<tr><td>${esc(fechaFicha(s.fecha))}</td><td>${esc(s.curso)}</td><td>${esc(s.adiestrador)}</td></tr>`);
  return `<h3 class="subtitulo-form">Adiestramiento</h3>
    ${cursos}
    <p class="sub-dato"><b>Sesiones a las que asistió:</b> ${a.sesionesAsistidas}</p>
    ${filas.length
      ? tabla('tabla-ficha-sesiones', [{ t: 'Fecha' }, { t: 'Curso' }, { t: 'Adiestrador' }], filas, 'Últimas sesiones')
      : vacio('Sin sesiones registradas.', '')}`;
}

function bloquePastoralFicha(p) {
  if (!p.casos.length) {
    return `<h3 class="subtitulo-form">Asistencia Pastoral</h3>${vacio('Sin casos registrados.', '')}`;
  }
  const filas = p.casos.map(k => `<tr>
    <td>${esc(k.categoria)}</td>
    <td>${pillEstado(k.estado)}</td>
    <td>${esc(fechaFicha(k.fecha_apertura))}</td>
    <td>${k.proximo_seguimiento ? esc(fechaFicha(k.proximo_seguimiento)) : '<span class="muted">—</span>'}</td>
    <td>${esc(k.responsable || '—')}</td>
    <td>${esc(String(k.actuaciones))}${k.ultima ? ` · última ${esc(fechaFicha(k.ultima))}` : ''}</td></tr>`);
  return `<h3 class="subtitulo-form">Asistencia Pastoral</h3>
    <p class="hint">Resumen de la situación. El historial completo se revisa en el módulo de Asistencia Pastoral.</p>
    ${tabla('tabla-ficha-casos', [{ t: 'Categoría' }, { t: 'Estado' }, { t: 'Apertura' }, { t: 'Próxima atención' }, { t: 'Responsable' }, { t: 'Actuaciones' }], filas, 'Casos pastorales')}`;
}

const TIPOS_NB_FICHA = {
  nacido: { campo: 'Nacido de nuevo', plural: 'nacido de nuevo' },
  bautismo: { campo: 'Bautizado', plural: 'bautismo' },
};
const MAPA_NB_FICHA = { fecha: 'nb-fecha', responsableId: 'nb-responsable', observaciones: 'nb-observaciones', personaId: 'nb-responsable' };

function bloqueRegistrosFicha(r) {
  const det = r.detalle || {};
  const puede = r.puede || {};
  const fila = tipo => {
    const x = det[tipo];
    const t = TIPOS_NB_FICHA[tipo];
    const texto = x
      ? `<b>${t.campo}:</b> ${esc(fechaFicha(x.fecha))}${x.responsable ? ` · responsable: ${esc(x.responsable)}` : ''}`
        + (x.observaciones ? `<br><span class="muted">${esc(x.observaciones)}</span>` : '')
      : `<b>${t.campo}:</b> No registrado`;
    const botones = [
      !x && puede.registrar ? `<button class="btn btn-small" type="button" data-accion="nb-nuevo" data-tipo="${tipo}">Registrar ${t.plural}</button>` : '',
      x && puede.editar ? `<button class="btn btn-small" type="button" data-accion="nb-editar" data-tipo="${tipo}">Editar</button>` : '',
      x && puede.eliminar ? `<button class="btn btn-small" type="button" data-accion="nb-eliminar" data-tipo="${tipo}" data-id="${x.id}">Eliminar</button>` : '',
    ].join('');
    return `<div class="registro-nb"><p class="sub-dato">${texto}</p>${botones ? `<div class="registro-nb-acciones">${botones}</div>` : ''}</div>`;
  };
  return `<h3 class="subtitulo-form">Nacido de nuevo y bautismo</h3>
    ${fila('nacido')}
    ${fila('bautismo')}
    ${r.pendienteBautismo ? '<p class="hint">Nacido de nuevo y todavía no bautizado.</p>' : ''}
    <div id="ficha-nb-form" class="subpanel" hidden></div>`;
}

function abrirFormNB(tipo, registro) {
  const cont = $('#ficha-nb-form');
  if (!cont || !fichaActual) return;
  const persona = fichaActual.secciones.datos.persona;
  const t = TIPOS_NB_FICHA[tipo];
  const lista = [...(db.personas || [])].sort(porNombreCompleto);
  cont.hidden = false;
  cont.innerHTML = `
    <form id="form-ficha-nb" novalidate data-tipo="${tipo}" data-id="${registro ? registro.id : ''}">
      <h4>${registro ? 'Editar' : 'Registrar'} ${t.plural} de ${esc(persona.nombre)}</h4>
      <div class="form-grid">
        <div class="field"><label for="nb-fecha">Fecha <span class="req" aria-hidden="true">*</span></label>
          <input class="control" id="nb-fecha" type="date" max="${hoyISO()}" value="${esc(registro ? registro.fecha : '')}"></div>
        <div class="field"><label for="nb-responsable">Responsable</label>
          <select class="control" id="nb-responsable">${opcionesPersonas(lista, registro ? registro.responsableId : null, 'Sin responsable')}</select></div>
        <div class="field campo-ancho"><label for="nb-observaciones">Observaciones</label>
          <textarea class="control" id="nb-observaciones" rows="3" maxlength="2000">${esc(registro ? registro.observaciones : '')}</textarea></div>
      </div>
      <div class="aviso-caja" id="aviso-nb" aria-live="polite"></div>
      <div class="form-actions">
        <button class="btn btn-primary" type="submit">Guardar</button>
        <button class="btn" type="button" data-accion="nb-cancelar">Cancelar</button>
      </div>
    </form>`;
  cont.scrollIntoView({ block: 'nearest' });
}

async function guardarFormNB(form) {
  const caja = $('#aviso-nb');
  const tipo = form.dataset.tipo;
  const id = form.dataset.id;
  const persona = fichaActual.secciones.datos.persona;
  const fecha = $('#nb-fecha').value;
  const errores = [];
  if (!fecha) errores.push({ campo: 'nb-fecha', texto: 'Elige la fecha.' });
  else if (fecha > hoyISO()) errores.push({ campo: 'nb-fecha', texto: 'La fecha no puede ser futura.' });
  if (errores.length) { mostrarErrores(form, caja, errores); return; }
  const cuerpo = { fecha, responsableId: Number($('#nb-responsable').value) || null, observaciones: $('#nb-observaciones').value };
  await conBoton(form, async () => {
    const r = id
      ? await api('PUT', `nacidos_bautizados.php?tipo=${tipo}&id=${id}`, cuerpo)
      : await api('POST', 'nacidos_bautizados.php', { tipo, personaId: persona.id, ...cuerpo });
    if (!r.ok) { errorDeServidor(form, caja, r, MAPA_NB_FICHA); return; }
    await abrirFicha(persona.id);
    mostrarAviso($('#aviso-ficha'), 'ok', `Se ${id ? 'actualizó' : 'registró'} el ${TIPOS_NB_FICHA[tipo].plural} de ${persona.nombre}.`);
  });
}

async function eliminarNBFicha(tipo, id) {
  const persona = fichaActual.secciones.datos.persona;
  const r = await api('DELETE', `nacidos_bautizados.php?tipo=${tipo}&id=${id}`);
  if (!r.ok) {
    mostrarAviso($('#aviso-ficha'), 'error', (r.datos && r.datos.mensaje) || 'No se pudo eliminar el registro.');
    return;
  }
  await abrirFicha(persona.id);
  mostrarAviso($('#aviso-ficha'), 'ok', `Se eliminó el ${TIPOS_NB_FICHA[tipo].plural} de ${persona.nombre}.`);
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-accion^="nb-"]');
  if (!b || !fichaActual) return;
  const tipo = b.dataset.tipo;
  switch (b.dataset.accion) {
    case 'nb-nuevo': abrirFormNB(tipo, null); break;
    case 'nb-editar': abrirFormNB(tipo, fichaActual.secciones.registros.detalle[tipo]); break;
    case 'nb-eliminar': confirmar(b, 'Confirmar', () => eliminarNBFicha(tipo, Number(b.dataset.id))); break;
    case 'nb-cancelar': { const c = $('#ficha-nb-form'); if (c) { c.hidden = true; c.innerHTML = ''; } break; }
    default: break;
  }
});
document.addEventListener('submit', e => {
  if (e.target.id === 'form-ficha-nb') { e.preventDefault(); guardarFormNB(e.target); }
});

document.addEventListener('click', e => {
  const b = e.target.closest('[data-accion="ficha-abrir"]');
  if (b) abrirFicha(Number(b.dataset.id));
});
document.addEventListener('input', e => {
  if (e.target.id !== 'ficha-buscar') return;
  fichaBusqueda = e.target.value;
  clearTimeout(fichaTimer);
  fichaTimer = setTimeout(() => buscarPersonasFicha(fichaBusqueda), 250);
});


/* =====================================================================
   REPORTES · LISTADO DE ASISTENCIA · versión 13
   Quién asistió, cuándo y a qué evento. Sale de la vista v_listado_asistencia en la base:
   cada cambio de período o de tipo vuelve a consultar solo las filas que se piden.
   ===================================================================== */
let listadoTipo = 'todos';
let listadoSolicitud = 0;   // evita que llegue tarde la respuesta de una consulta anterior

function bloqueListadoAsistencia() {
  const opcion = (v, t) => `<option value="${v}"${listadoTipo === v ? ' selected' : ''}>${t}</option>`;
  return `
    <section class="panel" id="listado-asistencia" aria-labelledby="listado-titulo">
      <h2 id="listado-titulo">Listado de asistencia</h2>
      <p class="panel-desc">Quién asistió, en qué fecha y a qué evento. Se consulta a la base de datos con el período elegido arriba.</p>
      <div class="toolbar no-print">
        <div class="field corto"><label for="listado-tipo">Tipo de evento</label>
          <select class="control" id="listado-tipo">
            ${opcion('todos', 'Todos')}
            ${opcion('Lista general', 'Lista general')}
            ${opcion('Comunión Familiar', 'Comunión Familiar')}
            ${opcion('Adiestramiento', 'Adiestramiento')}
          </select></div>
        ${tiene('reportes', 'exportar') ? '<button class="btn" type="button" data-accion="listado-csv">Descargar para Excel (CSV)</button>' : ''}
      </div>
      <p class="hint" id="listado-resumen"></p>
      <div id="listado-tabla"><p class="vacio">Cargando el listado…</p></div>
    </section>`;
}

function parametrosListado() {
  const { desde, hasta } = rangoPeriodo(repPeriodo, repRango);
  const params = new URLSearchParams({ tipo: listadoTipo });
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);
  return params;
}

async function cargarListadoAsistencia() {
  const solicitud = ++listadoSolicitud;
  const cont = $('#listado-tabla');
  if (!cont) return;
  const r = await api('GET', `listado_asistencia.php?${parametrosListado()}`);
  if (solicitud !== listadoSolicitud) return;   // llegó otra consulta después: esta ya no se muestra
  const cuadro = $('#listado-tabla');
  if (!cuadro) return;
  if (!r.ok) {
    cuadro.innerHTML = vacio('No se pudo cargar el listado', (r.datos && r.datos.mensaje) || 'Inténtalo de nuevo.');
    $('#listado-resumen').textContent = '';
    return;
  }
  const d = r.datos;
  const pl = n => (n === 1 ? 'asistencia' : 'asistencias');
  $('#listado-resumen').textContent =
    `${d.total} ${pl(d.total)} en el período: ${d.porTipo['Lista general']} en la lista general, ` +
    `${d.porTipo['Comunión Familiar']} en Comunión Familiar y ${d.porTipo['Adiestramiento']} en adiestramiento.` +
    (d.truncado ? ' Se muestran las primeras filas; descarga el CSV para verlas todas.' : '');
  if (!d.filas.length) {
    cuadro.innerHTML = vacio('No hay asistencias en este período', 'Cambia el período o el tipo de evento.');
    return;
  }
  const filas = d.filas.map(f => `<tr>
    <td>${esc(fechaCorta(f.fecha))}</td>
    <td>${esc(f.apellidos)}</td>
    <td>${esc(f.nombres)}</td>
    <td>${esc(f.tipo)}</td>
    <td>${esc(f.evento)}</td></tr>`);
  cuadro.innerHTML = tabla('tabla-listado-asistencia',
    [{ t: 'Fecha' }, { t: 'Apellidos' }, { t: 'Nombres' }, { t: 'Tipo' }, { t: 'Evento' }], filas, 'Asistencias');
}

function pintarListadoAsistencia() {
  const cont = $('#reportes-cont');
  if (!cont) return;
  cont.insertAdjacentHTML('beforeend', bloqueListadoAsistencia());
  cargarListadoAsistencia();
}

document.addEventListener('change', e => {
  if (e.target.id !== 'listado-tipo') return;
  listadoTipo = e.target.value;
  cargarListadoAsistencia();
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-accion="listado-csv"]');
  if (!b) return;
  const params = parametrosListado();
  params.set('formato', 'csv');
  window.location.href = `${API}listado_asistencia.php?${params}`;
});


/* ---------- Reportes: cumpleaños y pendientes de bautismo (versión 15) ---------- */
function pintarCumpleanosYPendientes() {
  const cont = $('#reportes-cont');
  if (!cont) return;
  cont.insertAdjacentHTML('beforeend', `
    <div id="reporte-cumpleanos"></div>
    <section class="panel" id="reporte-pendientes" aria-labelledby="pendientes-titulo">
      <h2 id="pendientes-titulo">Pendientes de bautismo</h2>
      <p class="panel-desc">Personas registradas como nacidas de nuevo que todavía no tienen bautismo. No depende del período.</p>
      ${tablaPendientesBautismo()}
    </section>`);
  vistaCumpleanos($('#reporte-cumpleanos'));
}

function tablaPendientesBautismo() {
  const bautizados = new Set((db.bautismos || []).map(b => b.personaId));
  const pendientes = (db.nacidos || []).filter(n => !bautizados.has(n.personaId)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (!pendientes.length) {
    return vacio('No hay pendientes de bautismo', 'Todas las personas registradas como nacidas de nuevo ya tienen bautismo.');
  }
  return tabla('tabla-pendientes-bautismo', [{ t: 'Persona' }, { t: 'Nacido de nuevo' }],
    pendientes.map(x => `<tr><td>${esc(personaNombre(x.personaId))}</td><td>${esc(fechaCorta(x.fecha))}</td></tr>`),
    'Pendientes de bautismo');
}

/* ---------- Reporte de la lista de asistencia: una persona, un día o en general (versión 20) ---------- */
// raEstado recuerda lo que eligió quien consulta mientras la página esté abierta
let raEstado = null;
function raFechaRestada(fecha, dias) {
  const [y, m, d] = fecha.split('-').map(Number);
  const x = new Date(y, m - 1, d - dias);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
function raIniciar() {
  if (raEstado) return;
  const hoyS = hoyISO();
  raEstado = { modo: 'general', desde: raFechaRestada(hoyS, 29), hasta: hoyS, fecha: hoyS, persona: '', filtro: 'todas' };
}
// Toma de la pantalla lo que haya elegido, aunque el campo esté oculto
function raLeerCampos() {
  const valor = (id, previo) => { const e = document.getElementById(id); return e ? e.value : previo; };
  raEstado.modo = valor('ra-modo', raEstado.modo);
  raEstado.persona = valor('ra-persona', raEstado.persona);
  raEstado.fecha = valor('ra-fecha', raEstado.fecha);
  raEstado.desde = valor('ra-desde', raEstado.desde);
  raEstado.hasta = valor('ra-hasta', raEstado.hasta);
  raEstado.filtro = valor('ra-filtro', raEstado.filtro);
}
function raAjustarCampos() {
  const ocultar = (id, oculto) => { const e = document.getElementById(id); if (e) e.hidden = oculto; };
  ocultar('ra-campo-persona', raEstado.modo !== 'persona');
  ocultar('ra-campo-dia', raEstado.modo !== 'dia');
  ocultar('ra-campo-periodo', raEstado.modo === 'dia');
  ocultar('ra-campo-hasta', raEstado.modo === 'dia');
  ocultar('ra-campo-filtro', raEstado.modo !== 'general');
}
function raParametros() {
  const p = new URLSearchParams({ modo: raEstado.modo });
  if (raEstado.modo === 'dia') {
    p.set('fecha', raEstado.fecha);
  } else {
    p.set('desde', raEstado.desde);
    p.set('hasta', raEstado.hasta);
    if (raEstado.modo === 'persona') p.set('personaId', raEstado.persona);
    if (raEstado.modo === 'general') p.set('filtro', raEstado.filtro);
  }
  return p;
}
function pintarReporteAsistencia() {
  const cont = $('#reportes-cont');
  if (!cont || !tiene('reportes', 'consultar')) return;
  raIniciar();
  const hoyS = hoyISO();
  const opciones = [...db.personas].sort(porNombreCompleto)
    .map(x => `<option value="${x.num}"${String(x.num) === String(raEstado.persona) ? ' selected' : ''}>${esc(nombreCompleto(x))}</option>`).join('');
  cont.insertAdjacentHTML('beforeend', `
    <section class="panel" id="rep-asistencia" aria-labelledby="ra-titulo">
      <h2 id="ra-titulo">Reporte de la lista de asistencia</h2>
      <p class="panel-desc">Saca el reporte de una persona, de un día, o de toda la lista. Las excusas cuentan como falta.</p>
      <div class="aviso-caja" id="aviso-ra" aria-live="polite"></div>
      <div class="toolbar">
        <div class="field"><label for="ra-modo">Qué reporte quieres</label>
          <select class="control" id="ra-modo">
            <option value="general"${raEstado.modo === 'general' ? ' selected' : ''}>En general (todas las personas)</option>
            <option value="persona"${raEstado.modo === 'persona' ? ' selected' : ''}>De una persona</option>
            <option value="dia"${raEstado.modo === 'dia' ? ' selected' : ''}>De un día</option>
          </select></div>
        <div class="field" id="ra-campo-persona"><label for="ra-persona">Persona</label>
          <select class="control" id="ra-persona"><option value="">Elige una persona…</option>${opciones}</select></div>
        <div class="field" id="ra-campo-dia"><label for="ra-fecha">Fecha</label>
          <input class="control" type="date" id="ra-fecha" max="${hoyS}" value="${raEstado.fecha}"></div>
        <div class="field" id="ra-campo-periodo"><label for="ra-desde">Desde</label>
          <input class="control" type="date" id="ra-desde" max="${hoyS}" value="${raEstado.desde}"></div>
        <div class="field" id="ra-campo-hasta"><label for="ra-hasta">Hasta</label>
          <input class="control" type="date" id="ra-hasta" max="${hoyS}" value="${raEstado.hasta}"></div>
        <div class="field" id="ra-campo-filtro"><label for="ra-filtro">Mostrar</label>
          <select class="control" id="ra-filtro">
            <option value="todas"${raEstado.filtro === 'todas' ? ' selected' : ''}>Todas las personas</option>
            <option value="faltas2"${raEstado.filtro === 'faltas2' ? ' selected' : ''}>Solo las que tienen dos o más faltas o excusas</option>
          </select></div>
      </div>
      <div class="toolbar-acciones">
        <button class="btn btn-primary" type="button" data-accion="ra-ver">Ver reporte</button>
        ${tiene('reportes', 'exportar') ? '<button class="btn" type="button" data-accion="ra-csv">Descargar para Excel (CSV)</button><button class="btn" type="button" data-accion="ra-pdf">Descargar PDF</button>' : ''}
      </div>
      <div id="ra-resultado"></div>
    </section>`);
  raAjustarCampos();
}
function pintarResultadoAsistencia(d) {
  const cont = $('#ra-resultado');
  if (!cont) return;
  const r = d.resumen;
  const cuarta = d.modo === 'dia'
    ? `<div class="stat"><div class="n">${r.sinMarcar}</div><div class="l">Sin marcar</div></div>`
    : `<div class="stat"><div class="n">${esc(r.porcentaje)}</div><div class="l">% asistencia</div></div>`;
  const textuales = ['Persona', 'Fecha', 'Estado'];
  const columnas = d.columnas.map(t => ({ t, num: !textuales.includes(t) }));
  const filas = d.filas.map(f => `<tr>${f.map((c, i) => `<td${columnas[i].num ? ' class="num"' : ''}>${esc(c)}</td>`).join('')}</tr>`);
  cont.innerHTML = `
    <h3 class="subtitulo-form">${esc(d.titulo)}</h3>
    <p class="hint">${esc(d.nota)}</p>
    <div class="stats">
      <div class="stat"><div class="n">${r.presentes}</div><div class="l">Presentes</div></div>
      <div class="stat"><div class="n">${r.faltas}</div><div class="l">Faltas</div></div>
      <div class="stat"><div class="n">${r.excusas}</div><div class="l">Excusas</div></div>
      ${cuarta}
    </div>
    ${d.filas.length ? tabla('tabla-reporte-asistencia', columnas, filas, d.titulo) : vacio('No hay registros para este reporte.', '')}`;
}
async function verReporteAsistencia() {
  const caja = $('#aviso-ra');
  raLeerCampos();
  if (caja) caja.innerHTML = '';
  if (raEstado.modo === 'persona' && !raEstado.persona) { mostrarAviso(caja, 'error', 'Elige una persona para ver su reporte.'); return; }
  const r = await api('GET', `reporte_asistencia.php?${raParametros()}`);
  if (!r.ok) { mostrarAviso(caja, 'error', textosDeError(r)); return; }
  pintarResultadoAsistencia(r.datos);
}
async function descargarArchivoAsistencia(formato, btn) {
  const caja = $('#aviso-ra');
  raLeerCampos();
  if (caja) caja.innerHTML = '';
  if (raEstado.modo === 'persona' && !raEstado.persona) { mostrarAviso(caja, 'error', 'Elige una persona para descargar su reporte.'); return; }
  const params = raParametros();
  params.set('formato', formato);
  if (formato === 'csv') {
    window.location.href = `${API}reporte_asistencia.php?${params}`;
    return;
  }
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generando PDF…';
  try {
    const r = await fetch(`${API}reporte_asistencia.php?${params}`, { credentials: 'same-origin', headers: { Accept: 'application/pdf, application/json' } });
    if (!r.ok) {
      let mensaje = 'No se pudo generar el PDF. Inténtalo de nuevo.';
      try { const j = await r.json(); if (j.mensaje) mensaje = j.mensaje; } catch (e) { /* la respuesta no era JSON */ }
      mostrarAviso(caja, 'error', mensaje);
      return;
    }
    const blob = await r.blob();
    const cabecera = r.headers.get('Content-Disposition') || '';
    const coincide = /filename="([^"]+)"/.exec(cabecera);
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = coincide ? coincide[1] : 'asistencia.pdf';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}
document.addEventListener('change', e => {
  if (e.target.id !== 'ra-modo') return;
  raLeerCampos();
  raAjustarCampos();
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-accion="ra-ver"], [data-accion="ra-csv"], [data-accion="ra-pdf"]');
  if (!b) return;
  if (b.dataset.accion === 'ra-ver') verReporteAsistencia();
  else descargarArchivoAsistencia(b.dataset.accion === 'ra-csv' ? 'csv' : 'pdf', b);
});

/* ---------- Reportes por sección: una sección o todo (versión 21) ---------- */
const OPCIONES_SECCIONES_REPORTE = [
  ['general', 'Reporte general (todas las secciones)'],
  ['comunion', 'Comunión Familiar'],
  ['actividades', 'Actividades generales'],
  ['pastoral', 'Asistencia Pastoral'],
  ['adiestramiento', 'Adiestramiento'],
  ['nacidos', 'Nacidos de nuevo (Bautizados)'],
  ['pendientes', 'Pendientes de bautismo'],
  ['finanzas', 'Finanzas'],
  ['cumpleanos', 'Cumpleaños del mes'],
  ['listado', 'Listado de asistencia'],
  ['lista', 'Lista de asistencia por persona (en general)'],
];
function selectorSeccionesReporte() {
  if (!tiene('reportes', 'exportar')) return '';
  const opciones = OPCIONES_SECCIONES_REPORTE.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('');
  return `
    <section class="panel" id="rep-secciones" aria-labelledby="rep-secciones-titulo">
      <h2 id="rep-secciones-titulo">Reporte de una sección o de todo</h2>
      <p class="panel-desc">Elige qué reporte quieres sacar. Usa el período que elegiste arriba. El reporte de cumpleaños usa el mes que elegiste en la sección Cumpleaños.</p>
      <div class="aviso-caja" id="aviso-rep-secciones" aria-live="polite"></div>
      <div class="toolbar">
        <div class="field"><label for="rs-seccion">Qué reporte quieres</label>
          <select class="control" id="rs-seccion">${opciones}</select></div>
      </div>
      <div class="toolbar-acciones">
        <button class="btn btn-primary" type="button" data-accion="rs-pdf">Descargar PDF</button>
        <button class="btn" type="button" data-accion="rs-csv">Descargar para Excel (CSV)</button>
      </div>
    </section>`;
}
async function descargarSeccionReporte(seccion, formato, btn) {
  const caja = $('#aviso-rep-secciones');
  if (caja) caja.innerHTML = '';
  if (seccion === 'general') {
    if (formato === 'csv') {
      mostrarAviso(caja, 'error', 'El reporte general sale en PDF. Para Excel, elige una sección.');
      return;
    }
    return descargarPdfReporte(btn);
  }
  const params = new URLSearchParams({ seccion, periodo: repPeriodo, formato });
  if (repPeriodo === 'rango') {
    if (repRango.desde) params.set('desde', repRango.desde);
    if (repRango.hasta) params.set('hasta', repRango.hasta);
  }
  if (seccion === 'cumpleanos') {
    const hoyS = hoyISO();
    params.set('mes', String(cumMes || Number(hoyS.slice(5, 7))));
    params.set('anio', hoyS.slice(0, 4));
  }
  if (formato === 'csv') {
    window.location.href = `${API}reporte_seccion.php?${params}`;
    return;
  }
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generando PDF…';
  try {
    const r = await fetch(`${API}reporte_seccion.php?${params}`, { credentials: 'same-origin', headers: { Accept: 'application/pdf, application/json' } });
    if (!r.ok) {
      let mensaje = 'No se pudo generar el PDF. Inténtalo de nuevo.';
      try { const j = await r.json(); if (j.mensaje) mensaje = j.mensaje; } catch (e) { /* la respuesta no era JSON */ }
      mostrarAviso(caja, 'error', mensaje);
      return;
    }
    const blob = await r.blob();
    const cabecera = r.headers.get('Content-Disposition') || '';
    const coincide = /filename="([^"]+)"/.exec(cabecera);
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = coincide ? coincide[1] : 'reporte-sigap.pdf';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-accion="rs-pdf"], [data-accion="rs-csv"]');
  if (!b) return;
  const sel = document.getElementById('rs-seccion');
  descargarSeccionReporte(sel ? sel.value : 'general', b.dataset.accion === 'rs-csv' ? 'csv' : 'pdf', b);
});

/* ---------- Arranque ---------- */
$$('[data-iglesia]').forEach(n => { n.textContent = IGLESIA; });
$$('[data-logo]').forEach(n => { n.innerHTML = LOGO_HTML; });
const sonda = new Image();
sonda.onload = () => document.documentElement.classList.add('tiene-logo');
sonda.src = LOGO_ARCHIVO;
if (!MOSTRAR_CUENTAS_PRUEBA) $('.demo').hidden = true;
$('#demo-list').innerHTML = DEMO.map(d => `
  <div class="demo-row">
    <div><b>${esc(d.rol)}</b><code>${esc(d.usuario)} / ${esc(d.clave)}</code></div>
    <button class="btn btn-small" type="button" data-accion="demo" data-u="${esc(d.usuario)}" data-c="${esc(d.clave)}">Usar</button>
  </div>`).join('');
const recordado = leerRecordado();
if (recordado) { $('#l-usuario').value = recordado; $('#l-recordar').checked = true; }

// Al abrir la página: ¿está lista la base de datos? ¿ya había una sesión iniciada en el servidor? (así recargar no te saca)
async function iniciar() {
  const r = await api('GET', 'sesion.php');
  if (!r.ok) { mostrarAviso($('#login-aviso'), 'error', r.datos.mensaje || MSG_SIN_SERVIDOR); return; }
  if (!r.datos.autenticado) return;
  csrf = r.datos.csrf;
  sesion = r.datos.usuario;
  if (!(await cargarDatos())) { sesion = null; csrf = ''; return; }
  const id = idDeHash();
  mostrarApp(RUTAS.includes(id) ? id : 'inicio');
}
iniciar();
/* =====================================================================
   GRUPOS · versión 25: Comunión Familiar, Adiestramiento y otros grupos
   ===================================================================== */
const TIPOS_GRUPOS = [['comunion', 'Comunión Familiar'], ['adiestramiento', 'Adiestramiento'], ['otro', 'Otros grupos']];
const ESTADOS_GRUPO_UI = ['Activo', 'Inactivo'];
let tipoGrupos = 'comunion', grupoElegido = '', accionGrupos = 'consultar', otrosGrupos = [], avisoGrupos = null, elGrupos = null;
const etiquetaTipoGrupo = t => (TIPOS_GRUPOS.find(x => x[0] === t) || [])[1] || '';
const listaGrupos = () => (tipoGrupos === 'comunion' ? db.grupos : otrosGrupos);
const MAPA_GRUPO_GESTION = { nombre: 'gc-nombre', direccion: 'gc-direccion', fechaInicio: 'gc-fecha', anfitrionId: 'gc-anfitrion',
                             discipuladorId: 'gc-discipulador', estado: 'gc-estado', observaciones: 'gc-obs' };
const MAPA_GRUPO_OTRO = { nombre: 'go-nombre', lugar: 'go-lugar', fechaInicio: 'go-fecha', responsable: 'go-responsable',
                          estado: 'go-estado', observaciones: 'go-obs' };

async function vistaGrupos(el) {
  elGrupos = el;
  if (tipoGrupos !== 'comunion') {
    const r = await api('GET', `grupos_otros.php?tipo=${tipoGrupos}`);
    otrosGrupos = r.ok ? r.datos.grupos : [];
    if (!r.ok) avisoGrupos = { tipo: 'error', texto: (r.datos && r.datos.mensaje) || 'No se pudieron cargar los grupos.' };
  }
  pintarGrupos();
}

function pintarGrupos() {
  if (!elGrupos) return;
  const lista = listaGrupos();
  const g = lista.find(x => String(x.id) === String(grupoElegido)) || null;
  const puedeEditar = tiene('grupos', 'editar');
  let cuerpo;
  if (accionGrupos === 'crear') {
    cuerpo = tipoGrupos === 'comunion' ? formCfGrupo(null) : formOtroGrupo(null);
  } else if (!g) {
    cuerpo = vacio('Elige un grupo y una acción.', 'Por ejemplo: Consultar, para ver su información.');
  } else if (accionGrupos === 'editar' && puedeEditar) {
    cuerpo = tipoGrupos === 'comunion' ? formCfGrupo(g) : formOtroGrupo(g);
  } else if (accionGrupos === 'inactivar' && puedeEditar) {
    cuerpo = `<h3 class="subtitulo-form">Inactivar grupo</h3>
      <p>¿Quieres inactivar <b>${esc(g.nombre)}</b>? Dejará de aparecer en las listas de asistencia y en el mapa. Puedes volver a activarlo editando el grupo.</p>
      <div class="acciones-form"><button class="btn btn-primary" type="button" data-grupos-confirmar-inactivar>Sí, inactivar</button>
      <button class="btn" type="button" data-grupos-cancelar>Cancelar</button></div>`;
  } else {
    cuerpo = detalleGrupo(g);
  }
  elGrupos.innerHTML = `
    <section class="panel">
      <h2>Grupos</h2>
      <p class="panel-desc">Crea, consulta, edita e inactiva los grupos de la congregación.</p>
      <div class="tabs-grupos" role="tablist" aria-label="Tipo de grupo">
        ${TIPOS_GRUPOS.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === tipoGrupos}" data-grupos-tab="${k}">${esc(t)}</button>`).join('')}
      </div>
      <div class="aviso-caja" id="aviso-grupos" aria-live="polite"></div>
      <div class="form-grid">
        <div class="field full">
          <label for="grupo-elegido">Grupo</label>
          <select class="control" id="grupo-elegido">
            <option value="">— Elige un grupo —</option>
            ${lista.map(x => `<option value="${x.id}"${String(x.id) === String(grupoElegido) ? ' selected' : ''}>${esc(x.nombre)}${x.estado === 'Inactivo' ? ' (inactivo)' : ''}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="grupo-accion">Acción</label>
          <select class="control" id="grupo-accion">
            <option value="consultar"${accionGrupos === 'consultar' ? ' selected' : ''}>Consultar</option>
            ${puedeEditar ? `<option value="editar"${accionGrupos === 'editar' ? ' selected' : ''}>Editar</option><option value="inactivar"${accionGrupos === 'inactivar' ? ' selected' : ''}>Inactivar</option>` : ''}
          </select>
        </div>
        <div class="field" style="align-self:end">
          <button class="btn btn-primary" type="button" data-grupos-aplicar>Aplicar</button>
        </div>
      </div>
      ${tiene('grupos', 'registrar') ? '<button class="btn" type="button" data-grupos-crear>Crear grupo</button>' : ''}
    </section>
    <section class="panel" id="grupos-detalle">${cuerpo}</section>`;
  if (avisoGrupos) {
    mostrarAviso($('#aviso-grupos'), avisoGrupos.tipo, avisoGrupos.texto);
    avisoGrupos = null;
  }
}

function detalleGrupo(g) {
  if (tipoGrupos === 'comunion') {
    return `<h3 class="subtitulo-form">${esc(g.nombre)}</h3>
      <p class="sub-dato"><b>Dirección:</b> ${esc(g.direccion)}</p>
      <p class="sub-dato"><b>Inicio:</b> ${esc(fechaCorta(g.fechaInicio))}</p>
      <p class="sub-dato"><b>Anfitrión:</b> ${esc(personaNombre(g.anfitrionId))}</p>
      <p class="sub-dato"><b>Discipulador:</b> ${esc(personaNombre(g.discipuladorId))}</p>
      <p class="sub-dato"><b>Participantes:</b> ${g.participantes.length ? g.participantes.map(id => esc(personaNombre(id))).join(', ') : 'Ninguno'}</p>
      <p class="sub-dato"><b>Estado:</b> ${esc(g.estado)}</p>
      ${g.observaciones ? `<p class="sub-dato"><b>Observaciones:</b> ${esc(g.observaciones)}</p>` : ''}`;
  }
  return `<h3 class="subtitulo-form">${esc(g.nombre)}</h3>
    <p class="sub-dato"><b>Lugar:</b> ${esc(g.lugar)}</p>
    <p class="sub-dato"><b>Inicio:</b> ${esc(fechaCorta(g.fechaInicio))}</p>
    <p class="sub-dato"><b>Responsable:</b> ${esc(g.responsable || '—')}</p>
    <p class="sub-dato"><b>Estado:</b> ${esc(g.estado)}</p>
    ${g.observaciones ? `<p class="sub-dato"><b>Observaciones:</b> ${esc(g.observaciones)}</p>` : ''}`;
}

function formCfGrupo(g) {
  return `<h3 class="subtitulo-form">${g ? 'Editar grupo de Comunión Familiar' : 'Crear grupo de Comunión Familiar'}</h3>
    <form id="form-grupo-cf" data-id="${g ? g.id : ''}" novalidate>
      <div class="form-grid">
        <div class="field"><label for="gc-nombre">Nombre de la casa <span class="req">*</span></label>
          <input class="control" id="gc-nombre" name="nombre" value="${esc(g ? g.nombre : '')}" autocomplete="off"></div>
        <div class="field"><label for="gc-direccion">Dirección <span class="req">*</span></label>
          <input class="control" id="gc-direccion" name="direccion" value="${esc(g ? g.direccion : '')}" autocomplete="off" placeholder="Barrio, calle y número"></div>
        <div class="field"><label for="gc-fecha">Fecha de inicio <span class="req">*</span></label>
          <input class="control" id="gc-fecha" name="fechaInicio" type="date" max="${hoyISO()}" value="${esc(g ? g.fechaInicio : hoyISO())}"></div>
        <div class="field"><label for="gc-anfitrion">Anfitrión <span class="req">*</span></label>
          <select class="control" id="gc-anfitrion" name="anfitrionId">${opcionesPersonas(todasLasPersonas(), g ? g.anfitrionId : null, 'Elige una persona')}</select></div>
        <div class="field"><label for="gc-discipulador">Discipulador responsable <span class="req">*</span></label>
          <select class="control" id="gc-discipulador" name="discipuladorId">${opcionesPersonas(conFuncion('discipulador'), g ? g.discipuladorId : null, 'Elige un discipulador')}</select></div>
        <div class="field"><label for="gc-estado">Estado</label>
          <select class="control" id="gc-estado" name="estado">${ESTADOS_GRUPO_UI.map(x => `<option${(g ? g.estado : 'Activo') === x ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
        <div class="field full"><label for="gc-obs">Observaciones</label>
          <textarea class="control" id="gc-obs" name="observaciones" rows="3">${esc(g ? g.observaciones : '')}</textarea></div>
      </div>
      <p class="hint">Los participantes del grupo se cambian en Comunión Familiar.</p>
      <div class="acciones-form"><button class="btn btn-primary" type="submit">${g ? 'Guardar cambios' : 'Crear grupo'}</button>
      <button class="btn" type="button" data-grupos-cancelar>Cancelar</button></div>
    </form>`;
}

function formOtroGrupo(g) {
  return `<h3 class="subtitulo-form">${g ? 'Editar grupo de ' + etiquetaTipoGrupo(tipoGrupos) : 'Crear grupo de ' + etiquetaTipoGrupo(tipoGrupos)}</h3>
    <form id="form-grupo-otro" data-id="${g ? g.id : ''}" data-tipo="${tipoGrupos}" novalidate>
      <div class="form-grid">
        <div class="field"><label for="go-nombre">Nombre <span class="req">*</span></label>
          <input class="control" id="go-nombre" name="nombre" value="${esc(g ? g.nombre : '')}" autocomplete="off"></div>
        <div class="field"><label for="go-lugar">Lugar donde se reúne <span class="req">*</span></label>
          <input class="control" id="go-lugar" name="lugar" value="${esc(g ? g.lugar : '')}" autocomplete="off"></div>
        <div class="field"><label for="go-fecha">Fecha de inicio <span class="req">*</span></label>
          <input class="control" id="go-fecha" name="fechaInicio" type="date" max="${hoyISO()}" value="${esc(g ? g.fechaInicio : hoyISO())}"></div>
        <div class="field"><label for="go-responsable">Responsable</label>
          <input class="control" id="go-responsable" name="responsable" value="${esc(g ? g.responsable : '')}" autocomplete="off"></div>
        <div class="field"><label for="go-estado">Estado</label>
          <select class="control" id="go-estado" name="estado">${ESTADOS_GRUPO_UI.map(x => `<option${(g ? g.estado : 'Activo') === x ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
        <div class="field full"><label for="go-obs">Observaciones</label>
          <textarea class="control" id="go-obs" name="observaciones" rows="3">${esc(g ? g.observaciones : '')}</textarea></div>
      </div>
      <div class="acciones-form"><button class="btn btn-primary" type="submit">${g ? 'Guardar cambios' : 'Crear grupo'}</button>
      <button class="btn" type="button" data-grupos-cancelar>Cancelar</button></div>
    </form>`;
}

async function enviarGrupoCf(form) {
  const f = new FormData(form), id = form.dataset.id ? Number(form.dataset.id) : null;
  const actual = id ? db.grupos.find(x => x.id === id) : null;
  const caja = $('#aviso-grupos');
  const cuerpo = {
    nombre: String(f.get('nombre') || '').trim().replace(/\s+/g, ' '),
    direccion: String(f.get('direccion') || '').trim().replace(/\s+/g, ' '),
    fechaInicio: f.get('fechaInicio') || '', anfitrionId: Number(f.get('anfitrionId')) || null,
    discipuladorId: Number(f.get('discipuladorId')) || null, estado: f.get('estado') || 'Activo',
    observaciones: String(f.get('observaciones') || '').trim(), participantes: actual ? actual.participantes : [],
  };
  const r = actual ? await api('PUT', `grupos.php?id=${id}`, cuerpo) : await api('POST', 'grupos.php', cuerpo);
  if (!r.ok) { errorDeServidor(form, caja, r, MAPA_GRUPO_GESTION); return; }
  await cargarDatos();
  grupoElegido = String((r.datos && r.datos.id) || id || '');
  accionGrupos = 'consultar';
  avisoGrupos = { tipo: 'ok', texto: actual ? 'Se guardaron los cambios del grupo.' : 'Se creó el grupo.' };
  pintarGrupos();
}

async function enviarGrupoOtro(form) {
  const f = new FormData(form), id = form.dataset.id ? Number(form.dataset.id) : null;
  const caja = $('#aviso-grupos');
  const cuerpo = {
    tipo: form.dataset.tipo, nombre: String(f.get('nombre') || '').trim().replace(/\s+/g, ' '),
    lugar: String(f.get('lugar') || '').trim().replace(/\s+/g, ' '), fechaInicio: f.get('fechaInicio') || '',
    responsable: String(f.get('responsable') || '').trim().replace(/\s+/g, ' '), estado: f.get('estado') || 'Activo',
    observaciones: String(f.get('observaciones') || '').trim(),
  };
  const r = id ? await api('PUT', `grupos_otros.php?id=${id}`, cuerpo) : await api('POST', 'grupos_otros.php', cuerpo);
  if (!r.ok) { errorDeServidor(form, caja, r, MAPA_GRUPO_OTRO); return; }
  const lr = await api('GET', `grupos_otros.php?tipo=${tipoGrupos}`);
  otrosGrupos = lr.ok ? lr.datos.grupos : [];
  grupoElegido = String((r.datos && r.datos.id) || id || '');
  accionGrupos = 'consultar';
  avisoGrupos = { tipo: 'ok', texto: id ? 'Se guardaron los cambios del grupo.' : 'Se creó el grupo.' };
  pintarGrupos();
}

async function inactivarGrupoElegido() {
  const caja = $('#aviso-grupos');
  const g = listaGrupos().find(x => String(x.id) === String(grupoElegido));
  if (!g) return;
  let r;
  if (tipoGrupos === 'comunion') {
    r = await api('PUT', `grupos.php?id=${g.id}`, { nombre: g.nombre, direccion: g.direccion, fechaInicio: g.fechaInicio,
      anfitrionId: g.anfitrionId, discipuladorId: g.discipuladorId, estado: 'Inactivo', observaciones: g.observaciones,
      participantes: g.participantes });
    if (r.ok) await cargarDatos();
  } else {
    r = await api('PUT', `grupos_otros.php?id=${g.id}`, { tipo: tipoGrupos, nombre: g.nombre, lugar: g.lugar,
      fechaInicio: g.fechaInicio, responsable: g.responsable, estado: 'Inactivo', observaciones: g.observaciones });
    if (r.ok) {
      const lr = await api('GET', `grupos_otros.php?tipo=${tipoGrupos}`);
      otrosGrupos = lr.ok ? lr.datos.grupos : [];
    }
  }
  if (!r.ok) { mostrarAviso(caja, 'error', (r.datos && r.datos.mensaje) || 'No se pudo inactivar el grupo.'); return; }
  accionGrupos = 'consultar';
  avisoGrupos = { tipo: 'ok', texto: `Se inactivó el grupo ${g.nombre}.` };
  pintarGrupos();
}

document.addEventListener('click', async e => {
  if (!elGrupos || !elGrupos.isConnected) return;
  const t = e.target.closest('[data-grupos-tab]');
  if (t) { tipoGrupos = t.dataset.gruposTab; grupoElegido = ''; accionGrupos = 'consultar'; await vistaGrupos(elGrupos); return; }
  if (e.target.closest('[data-grupos-crear]')) { grupoElegido = ''; accionGrupos = 'crear'; pintarGrupos(); return; }
  if (e.target.closest('[data-grupos-aplicar]')) {
    grupoElegido = $('#grupo-elegido') ? $('#grupo-elegido').value : grupoElegido;
    accionGrupos = $('#grupo-accion') ? $('#grupo-accion').value : accionGrupos;
    pintarGrupos();
    return;
  }
  if (e.target.closest('[data-grupos-cancelar]')) { accionGrupos = 'consultar'; pintarGrupos(); return; }
  if (e.target.closest('[data-grupos-confirmar-inactivar]')) await inactivarGrupoElegido();
});

/* ---------- Mapa de los grupos de comunión familiar (Reportes) ---------- */
// Clave de Google Maps (Maps JavaScript API y Geocoding API). Pégala aquí cuando la tengas.
const GOOGLE_MAPS_API_KEY = '';
const CENTRO_MAPA_CF = { lat: 4.1420, lng: -73.6266 };   // Villavicencio, Meta
let googleMapsCargando = null;
function cargarGoogleMaps() {
  if (window.google && window.google.maps) return Promise.resolve();
  if (googleMapsCargando) return googleMapsCargando;
  googleMapsCargando = new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;
    s.async = true;
    s.onload = ok;
    s.onerror = () => mal(new Error('No se pudo cargar Google Maps.'));
    document.head.appendChild(s);
  });
  return googleMapsCargando;
}
async function pintarMapaCF(grupos) {
  const caja = document.getElementById('mapa-cf');
  if (!caja) return;
  if (!GOOGLE_MAPS_API_KEY) {
    caja.innerHTML = `<div style="text-align:left;width:100%"><p><b>Mapa pendiente de configurar.</b></p>
      <p class="hint">Falta la clave de Google Maps. Mientras tanto, abre cada grupo en Google Maps:</p>
      <ul>${grupos.map(g => `<li><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(g.direccion + ', Villavicencio, Meta, Colombia')}">${esc(g.nombre)}</a></li>`).join('')}</ul></div>`;
    return;
  }
  try {
    await cargarGoogleMaps();
  } catch (err) {
    caja.textContent = 'No se pudo cargar el mapa. Revisa la conexión y la clave.';
    return;
  }
  caja.innerHTML = '';
  const mapa = new google.maps.Map(caja, { center: CENTRO_MAPA_CF, zoom: 12 });
  const geo = new google.maps.Geocoder();
  const ventana = new google.maps.InfoWindow();
  grupos.forEach(g => {
    geo.geocode({ address: `${g.direccion}, Villavicencio, Meta, Colombia` }, (res, estado) => {
      if (estado !== 'OK' || !res[0]) return;
      const marcador = new google.maps.Marker({ map: mapa, position: res[0].geometry.location, title: g.nombre });
      marcador.addListener('click', () => {
        ventana.setContent(`<b>${esc(g.nombre)}</b><br>${esc(g.direccion)}<br>Discipulador: ${esc(personaNombre(g.discipuladorId))}`);
        ventana.open(mapa, marcador);
      });
    });
  });
}
/* =====================================================================
   SEDES · versión 28: crear, consultar, actualizar e inactivar las sedes en Villavicencio, Meta
   ===================================================================== */
const SECCIONES_SEDES = [['crear', 'Crear Sede'], ['consultar', 'Consultar sede'], ['actualizar', 'Actualizar sede'], ['inactivar', 'Inactivar sede']];
let seccionSedes = 'crear', sedeElegida = '', confirmarSede = null, elSedes = null, avisoSedes = null;
let sedesDatos = { sedes: [], departamentos: [], barrios: [], pais: 'Colombia', ciudad: 'Villavicencio' };
const MAPA_SEDE = { nombre: 'se-nombre', direccion: 'se-direccion', barrioId: 'se-barrio', departamentoId: 'se-departamento', activo: 'se-estado' };
const sedePorId = id => sedesDatos.sedes.find(s => String(s.id) === String(id)) || null;
const opcionesCatalogo = (lista, seleccion, texto) =>
  `<option value="">${esc(texto)}</option>` + lista.map(x => `<option value="${x.id}"${String(x.id) === String(seleccion || '') ? ' selected' : ''}>${esc(x.nombre)}</option>`).join('');
const opcionesSedes = (seleccion, textoVacio) =>
  `<option value="">${esc(textoVacio)}</option>` + sedesDatos.sedes.map(x => `<option value="${x.id}"${String(x.id) === String(seleccion || '') ? ' selected' : ''}>${esc(x.nombre)} (${x.activo ? 'activa' : 'inactiva'})</option>`).join('');

async function vistaSedes(el) {
  elSedes = el;
  await recargarSedes();
  pintarSedes();
}

async function recargarSedes() {
  const r = await api('GET', 'sedes.php');
  if (r.ok) sedesDatos = r.datos;
  else avisoSedes = { tipo: 'error', texto: (r.datos && r.datos.mensaje) || 'No se pudieron cargar las sedes.' };
}

function pintarSedes() {
  if (!elSedes) return;
  const tabs = SECCIONES_SEDES.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === seccionSedes}" data-sedes-seccion="${k}">${esc(t)}</button>`).join('');
  const cuerpo = seccionSedes === 'crear' ? formSede(null, 'form-sede-crear')
    : seccionSedes === 'consultar' ? consultaSede()
    : seccionSedes === 'actualizar' ? actualizaSede()
    : inactivarSede();
  elSedes.innerHTML = `
    <section class="panel">
      <h2>Sedes</h2>
      <p class="panel-desc">Sedes de la congregación en Villavicencio, Meta.</p>
      <div class="tabs-grupos" role="tablist" aria-label="Sección de sedes">${tabs}</div>
      <div class="aviso-caja" id="aviso-sedes" aria-live="polite"></div>
      <div id="sedes-cuerpo">${cuerpo}</div>
    </section>`;
  if (avisoSedes) {
    mostrarAviso($('#aviso-sedes'), avisoSedes.tipo, avisoSedes.texto);
    avisoSedes = null;
  }
}

function formSede(s, idForm) {
  const edita = !!s;
  const depSel = edita ? s.departamentoId : ((sedesDatos.departamentos.find(d => d.nombre === 'Meta') || {}).id || '');
  return `
    <form id="${idForm}" data-id="${edita ? s.id : ''}" novalidate>
      <div class="form-grid">
        <div class="field">
          <label for="se-nombre">Nombre de la sede <span class="req" aria-hidden="true">*</span></label>
          <input class="control" id="se-nombre" name="nombre" value="${esc(edita ? s.nombre : '')}" autocomplete="off" placeholder="Ej: Sede Barzal">
        </div>
        <div class="field">
          <label for="se-direccion">Dirección de la sede <span class="req" aria-hidden="true">*</span></label>
          <input class="control" id="se-direccion" name="direccion" value="${esc(edita ? (s.direccion || '') : '')}" autocomplete="off" placeholder="Ej: Calle 10 # 20-30">
        </div>
        <div class="field">
          <label for="se-pais">País</label>
          <input class="control" id="se-pais" value="${esc(sedesDatos.pais)}" readonly>
        </div>
        <div class="field">
          <label for="se-ciudad">Ciudad</label>
          <input class="control" id="se-ciudad" value="${esc(sedesDatos.ciudad)}" readonly>
        </div>
        <div class="field">
          <label for="se-barrio">Barrio <span class="req" aria-hidden="true">*</span></label>
          <select class="control" id="se-barrio" name="barrioId">${opcionesCatalogo(sedesDatos.barrios, edita ? s.barrioId : '', 'Elige un barrio')}</select>
        </div>
        <div class="field">
          <label for="se-departamento">Departamento <span class="req" aria-hidden="true">*</span></label>
          <select class="control" id="se-departamento" name="departamentoId">${opcionesCatalogo(sedesDatos.departamentos, depSel, 'Elige un departamento')}</select>
        </div>
        ${edita ? `<div class="field">
          <label for="se-estado">Estado</label>
          <select class="control" id="se-estado" name="activo">
            <option value="1"${s.activo ? ' selected' : ''}>Activa</option>
            <option value="0"${s.activo ? '' : ' selected'}>Inactiva</option>
          </select>
        </div>` : ''}
      </div>
      <div class="acciones-form"><button class="btn btn-primary" type="submit">${edita ? 'Guardar cambios' : 'Crear sede'}</button></div>
    </form>`;
}

function consultaSede() {
  const s = sedePorId(sedeElegida);
  return `<div class="field full">
      <label for="sede-consultar">Sede</label>
      <select class="control" id="sede-consultar" data-sedes-elegir>${opcionesSedes(sedeElegida, '— Elige una sede —')}</select>
    </div>` + (s ? detalleSede(s) : vacio('Elige una sede', 'Verás su información y su ubicación en Google Maps.'));
}

function detalleSede(s) {
  const q = encodeURIComponent([s.direccion, s.barrio, s.ciudad, s.departamento, s.pais].filter(Boolean).join(', '));
  return `
    <h3 class="subtitulo-form">${esc(s.nombre)}</h3>
    <p class="sub-dato"><b>Estado:</b> ${s.activo ? 'Activa' : 'Inactiva'}</p>
    <p class="sub-dato"><b>Dirección:</b> ${esc(s.direccion || '—')}</p>
    <p class="sub-dato"><b>Barrio:</b> ${esc(s.barrio || '—')}</p>
    <p class="sub-dato"><b>Ciudad:</b> ${esc(s.ciudad)}</p>
    <p class="sub-dato"><b>Departamento:</b> ${esc(s.departamento || '—')}</p>
    <p class="sub-dato"><b>País:</b> ${esc(s.pais)}</p>
    <h3 class="subtitulo-form">Ubicación en Google Maps</h3>
    <iframe class="mapa-sede" title="Ubicación de ${esc(s.nombre)} en Google Maps" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${q}&output=embed"></iframe>
    <p class="hint"><a href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">Abrir en Google Maps</a></p>`;
}

function actualizaSede() {
  const s = sedePorId(sedeElegida);
  return `<div class="field full"><label for="sede-actualizar">Sede</label>
      <select class="control" id="sede-actualizar" data-sedes-elegir>${opcionesSedes(sedeElegida, '— Elige una sede —')}</select></div>`
    + (s ? formSede(s, 'form-sede-editar') : vacio('Elige una sede para editarla', 'Aquí puedes cambiar sus datos o reactivarla.'));
}

function inactivarSede() {
  const pendiente = confirmarSede !== null ? sedePorId(confirmarSede) : null;
  const lista = sedesDatos.sedes;
  return `${pendiente ? `<div class="aviso-caja aviso-atencion" role="alertdialog" aria-labelledby="sede-confirmar-titulo">
      <p id="sede-confirmar-titulo"><b>¿Inactivar la sede ${esc(pendiente.nombre)}?</b></p>
      <p class="hint">Dejará de aparecer para elegirla en el formulario de personas. Las personas que ya la tienen la conservan. Puedes reactivarla en Actualizar sede.</p>
      <div class="acciones-form"><button class="btn btn-primary" type="button" data-sedes-confirmar="${pendiente.id}">Sí, inactivar</button>
      <button class="btn" type="button" data-sedes-cancelar>Cancelar</button></div></div>` : ''}
    ${lista.length ? `<ul class="lista-sedes">${lista.map(x => `<li class="fila-sede">
        <span><b>${esc(x.nombre)}</b> <span class="hint">· ${x.activo ? 'activa' : 'inactiva'}</span></span>
        <button class="btn btn-small" type="button" data-sedes-inactivar="${x.id}"${x.activo ? '' : ' disabled'}>Inactivar</button>
      </li>`).join('')}</ul>` : vacio('No hay sedes registradas', 'Crea una sede en la sección Crear Sede.')}`;
}

async function enviarSedeCrear(form) { await guardarSede(form, null); }
async function enviarSedeEditar(form) { await guardarSede(form, Number(form.dataset.id)); }

async function guardarSede(form, id) {
  const f = new FormData(form), caja = $('#aviso-sedes');
  const cuerpo = {
    nombre: String(f.get('nombre') || '').trim().replace(/\s+/g, ' '),
    direccion: String(f.get('direccion') || '').trim().replace(/\s+/g, ' '),
    barrioId: f.get('barrioId') ? Number(f.get('barrioId')) : null,
    departamentoId: f.get('departamentoId') ? Number(f.get('departamentoId')) : null,
  };
  if (id !== null) cuerpo.activo = f.get('activo') !== '0';
  const r = id === null ? await api('POST', 'sedes.php', cuerpo) : await api('PUT', `sedes.php?id=${id}`, cuerpo);
  if (!r.ok) { errorDeServidor(form, caja, r, MAPA_SEDE); return; }
  await recargarSedes();
  if (id === null) {
    seccionSedes = 'crear';
    avisoSedes = { tipo: 'ok', texto: `Se creó la sede ${cuerpo.nombre}.` };
  } else {
    sedeElegida = String(id);
    avisoSedes = { tipo: 'ok', texto: 'Se guardaron los cambios de la sede.' };
  }
  pintarSedes();
}

async function inactivarSedeConfirmada(id) {
  const sede = sedePorId(id);
  const r = await api('PUT', `sedes.php?id=${id}&accion=inactivar`);
  confirmarSede = null;
  if (!r.ok) {
    avisoSedes = { tipo: 'error', texto: (r.datos && r.datos.mensaje) || 'No se pudo inactivar la sede.' };
  } else {
    await recargarSedes();
    avisoSedes = { tipo: 'ok', texto: `Se inactivó la sede ${sede ? sede.nombre : ''}.` };
  }
  pintarSedes();
}

document.addEventListener('click', async e => {
  if (!elSedes || !elSedes.isConnected) return;
  const tab = e.target.closest('[data-sedes-seccion]');
  if (tab) { seccionSedes = tab.dataset.sedesSeccion; sedeElegida = ''; confirmarSede = null; pintarSedes(); return; }
  const ina = e.target.closest('[data-sedes-inactivar]');
  if (ina) { confirmarSede = Number(ina.dataset.sedesInactivar); pintarSedes(); return; }
  if (e.target.closest('[data-sedes-cancelar]')) { confirmarSede = null; pintarSedes(); return; }
  const conf = e.target.closest('[data-sedes-confirmar]');
  if (conf) await inactivarSedeConfirmada(Number(conf.dataset.sedesConfirmar));
});

document.addEventListener('change', e => {
  if (!elSedes || !elSedes.isConnected) return;
  if (e.target && e.target.matches && e.target.matches('[data-sedes-elegir]')) { sedeElegida = e.target.value; pintarSedes(); }
});

})();


// =====================================================================
// 3.1.2 — Actividades de medicina preventiva y promocion de la salud
// medicina-preventiva-programa.js
//
// 📦825 (2026-09-29) — Vista de programa del esqueleto de gestión de
// programas. Corre DENTRO del iframe y llega al puente por _pgApi()
// (window.electronAPI del padre — los iframes sandbox no heredan el preload,
// mismo patrón que la bandeja integrada); lee el token de sesión de
// localStorage, misma clave que renderer.js.
//
// Dos modos, elegidos por query param del src del iframe (los arma
// medicina-preventiva-logic.js):
//   ?modo=lista&tipo=sve|dme|promocion&empresa=<nombre>
//   ?modo=detalle&tipo=...&id=<programaId>&empresa=<nombre>
//
// Contrato con el padre (medicina-preventiva-logic.js handleMessage):
//   - backToHome            → vuelve al home del 3.1.2
//   - open-program          → vuelve a la lista de la línea (reuse del home)
//   - open-program-id       → abre el detalle de un programa (tras crear o click)
//
// La navegación vive en el padre; esta vista solo pide datos y repinta.
// =====================================================================

'use strict';

var PG = {
    modo: 'lista',
    tipo: 'sve',
    empresa: '',
    id: null,
    programas: [],
    programa: null,
    plantillas: null,
    seccionActivaId: null,
    // 📦825-fix — Los datos del formulario viven en PG.wizard, NO solo en el
    // DOM: al pasar al paso 2 el cuerpo del modal se re-renderiza y los inputs
    // del paso 1 desaparecen. Si crearPrograma leyera el DOM, siempre
    // encontraría nombre vacío (bug reportado: toast + regreso al paso 1
    // borrando lo tecleado).
    wizard: { paso: 1, usarPlantilla: true, nombre: '', descripcion: '', fechaInicio: '', fechaFin: '' }
};

var PG_LINEAS = {
    sve: {
        etiqueta: 'SVE',
        titulo: 'SVE — Sistema de Vigilancia Epidemiologica',
        sub: 'Vigilancia en salud: psicosocial, COVID-19 y salud ocupacional. Cada programa sigue el ciclo de captura, clasificacion, analisis y respuesta.',
        icono: 'fa-user-doctor'
    },
    dme: {
        etiqueta: 'DME',
        titulo: 'DME — Diagnostico Medico Epidemiologico',
        sub: 'Caracterizacion de las condiciones de salud del personal y plan de accion resultante.',
        icono: 'fa-stethoscope'
    },
    promocion: {
        etiqueta: 'Promocion y Prevencion',
        titulo: 'Programas de promocion y prevencion',
        sub: 'Seguridad vial, protocolo de bioseguridad, estilos de vida saludables y demas programas del 3.1.2.',
        icono: 'fa-user-group'
    }
};

var PG_ESTADO_ETIQUETA = { activo: 'Activo', pausado: 'Pausado', cerrado: 'Cerrado', eliminado: 'Eliminado' };
var PG_SECCION_ETIQUETA = { pendiente: 'Pendiente', en_curso: 'En curso', completo: 'Completo' };

// 📦826 — Mapeo clave de sección del programa → ruta hash del prototipo SVE.
// Solo aplica a programas tipo 'sve'; las secciones sin ruta siguen con el
// placeholder "en construcción".
var PG_SVE_RUTAS = {
    dashboard: 'dashboard',
    casos: 'seguimiento',
    plan: 'plan',
    indicadores: 'indicadores',
    areas: 'areas'
};

// ---------- cargador del prototipo SVE (📦826) ----------
// Inyecta una sola vez los scripts del módulo SVE (orden obligatorio, ver
// README-INTEGRACION del prototipo) dentro de ESTE iframe, con cache-bust.
// El storage del prototipo queda namespaced por programa vía
// window.SVE_PROGRAMA_KEY (leído por sve-app.js al evaluarse).
var PG_SVE_CARGADOS = false;
var PG_SVE_PROMESA = null;

function _pgSveCargar() {
    if (PG_SVE_CARGADOS) return Promise.resolve(true);
    if (PG_SVE_PROMESA) return PG_SVE_PROMESA;

    var base = 'sve/';
    var v = '?v=' + ((window.parent && window.parent.MEDPREV_V) || 'sve-1');
    var archivos = [
        base + 'vendor/lucide.min.js' + v,
        base + 'vendor/xlsx.full.min.js' + v,
        base + 'sve-seed.js' + v,
        base + 'sve-core.js' + v,
        base + 'sve-views.js' + v
    ];

    if (!document.getElementById('pg-sve-css')) {
        var link = document.createElement('link');
        link.id = 'pg-sve-css';
        link.rel = 'stylesheet';
        link.href = base + 'sve.css' + v;
        document.head.appendChild(link);
    }

    PG_SVE_PROMESA = new Promise(function (resolve) {
        var i = 0;
        function siguiente() {
            if (i >= archivos.length) {
                // Antes de sve-app.js: clave de storage por programa y empresa real.
                window.SVE_PROGRAMA_KEY = PG.id || 'default';
                try {
                    if (window.SveSeed && PG.empresa) window.SveSeed.meta.empresa = PG.empresa;
                } catch (e) { /* noop */ }
                var app = document.createElement('script');
                app.src = base + 'sve-persistencia.js' + v;
                // 📦827 — sve-persistencia.js va ANTES de sve-app.js: es la capa
                // que habla con SQLite y el store la busca en window al hidratar.
                // Si no carga, se sigue igual: el store degrada a localStorage.
                app.onload = function () {
                    var app2 = document.createElement('script');
                    app2.src = base + 'sve-app.js' + v;
                    app2.onload = function () { PG_SVE_CARGADOS = true; resolve(true); };
                    app2.onerror = function () { PG_SVE_PROMESA = null; resolve(false); };
                    document.head.appendChild(app2);
                };
                app.onerror = function () {
                    var app3 = document.createElement('script');
                    app3.src = base + 'sve-app.js' + v;
                    app3.onload = function () { PG_SVE_CARGADOS = true; resolve(true); };
                    app3.onerror = function () { PG_SVE_PROMESA = null; resolve(false); };
                    document.head.appendChild(app3);
                };
                document.head.appendChild(app);
                return;
            }
            var src = archivos[i++];
            var el = document.createElement('script');
            el.src = src;
            el.onload = siguiente;
            el.onerror = function () { PG_SVE_PROMESA = null; resolve(false); };
            document.head.appendChild(el);
        }
        siguiente();
    });
    return PG_SVE_PROMESA;
}

function _pgSveMontar(clave) {
    var ruta = PG_SVE_RUTAS[clave];
    if (!ruta) return;
    _pgSveCargar().then(function (ok) {
        var host = document.getElementById('pg-sve-host');
        if (!ok || !host) {
            if (host) host.innerHTML = '<div class="mp-pg__sve-error">No se pudo cargar la interfaz SVE (sve-*.js). Revisa la instalacion del modulo.</div>';
            return;
        }
        // El host puede haber sido re-renderizado mientras cargaba: solo
        // montamos si la sección visible sigue siendo la que pidió el montaje.
        if (PG.sveHostClave !== clave) return;
        try {
            /* 📦827 — init() es ASÍNCRONO: hidrata el programa desde SQLite
               (o migra el localStorage viejo) antes de arrancar el router.
               Hay que esperar su promesa antes de navegar, o las vistas se
               pintarían contra un store todavía vacío. */
            var p = window.SveApp.init(host, {});
            if (p && typeof p.then === 'function') {
                p.then(function (r) {
                    if (!r.ok) return;   // la vista ya pintó el error de base
                    if (PG.sveHostClave !== clave) return;
                    window.SveApp.go({ name: ruta });
                });
                return;
            }
            window.SveApp.go({ name: ruta });
        } catch (e) {
            host.innerHTML = '<div class="mp-pg__sve-error">Error montando la interfaz SVE: ' + _pgEsc(e.message) + '</div>';
        }
    });
}

// ---------- utilidades ----------
function _pgParams() {
    return new URLSearchParams(window.location.search);
}

// 📦825 — Los iframes sandbox no heredan el preload: mismo patrón que la
// bandeja integrada (app.js usa window.parent.electronAPI). Mismo origen
// file://, así que el puente del padre es accesible siempre.
function _pgApi() {
    return window.electronAPI || (window.parent && window.parent.electronAPI) || null;
}

function _pgToken() {
    try { return localStorage.getItem('kair-auth-token') || ''; } catch (e) { return ''; }
}

function _pgEsc(s) {
    return String(s === undefined || s === null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _pgToast(msg, type) {
    if (window.KAIRToast && typeof window.KAIRToast.show === 'function') {
        window.KAIRToast.show(msg, type || 'info');
    } else {
        console.log('[MED-PREV-PROG][toast:' + (type || 'info') + '] ' + msg);
    }
}

function _pgFechaBonita(iso) {
    if (!iso) return 'Sin fecha';
    var partes = String(iso).split('-');
    if (partes.length !== 3) return iso;
    return partes[2] + '/' + partes[1] + '/' + partes[0];
}

function _pgBody() {
    return document.getElementById('pg-body');
}

// ---------- init ----------
document.addEventListener('DOMContentLoaded', function () {
    var params = _pgParams();
    PG.modo = params.get('modo') === 'detalle' ? 'detalle' : 'lista';
    PG.tipo = params.get('tipo') || 'sve';
    if (!PG_LINEAS[PG.tipo]) PG.tipo = 'sve';
    PG.empresa = params.get('empresa') || '';
    PG.id = params.get('id') || null;

    _pgRenderHeader();
    _pgCargarPlantillas();

    if (PG.modo === 'detalle') {
        _pgCargarDetalle();
    } else {
        _pgCargarLista();
    }
});

function _pgRenderHeader() {
    var linea = PG_LINEAS[PG.tipo];
    document.getElementById('pg-title').textContent = linea.titulo;
    document.getElementById('pg-sub').textContent = linea.sub;
    document.getElementById('pg-crumb-line').innerHTML =
        '<span>/</span><b>' + _pgEsc(linea.etiqueta) + '</b>';
    document.querySelector('#pg-line-icon i').className = 'fas ' + linea.icono;
    var btnNuevo = document.getElementById('pg-btn-nuevo');
    if (PG.modo === 'detalle') btnNuevo.style.display = 'none';

    // 📦826 — "Atrás" cambia de destino según dónde estés. Dentro de un programa
    // el salto natural es a la LISTA de la línea (¿qué otros programas hay de
    // SVE?), no al home del 3.1.2: desde un detalle largo como el Dashboard del
    // prototipo, volver al home tira al usuario dos niveles y pierde el programa
    // que estaba mirando. En la lista sí tiene sentido ir al home del 3.1.2,
    // porque la lista es el último escalón antes de las tres líneas.
    var btnVolver = document.getElementById('pg-btn-volver');
    var txtVolver = document.getElementById('pg-btn-volver-txt');
    if (btnVolver && txtVolver) {
        if (PG.modo === 'detalle') {
            btnVolver.setAttribute('onclick', 'volverALista()');
            txtVolver.textContent = 'Programas ' + linea.etiqueta;
        } else {
            btnVolver.setAttribute('onclick', 'volverAlHome()');
            txtVolver.textContent = 'Home 3.1.2';
        }
    }
}

async function _pgCargarPlantillas() {
    var api = _pgApi();
    if (!api || !api.medprevProgramasGetPlantillas) return;
    try {
        var r = await api.medprevProgramasGetPlantillas({ token: _pgToken() });
        if (r && r.success) PG.plantillas = r.data.plantillas;
    } catch (e) {
        console.warn('[MED-PREV-PROG] No se pudieron cargar las plantillas:', e.message);
    }
}

// ---------- MODO LISTA ----------
async function _pgCargarLista() {
    var api = _pgApi();
    var body = _pgBody();
    if (!api || !api.medprevProgramasList) {
        body.innerHTML = _pgHtmlEmpty('El puente de datos no esta disponible.', false);
        return;
    }
    body.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--kair-muted,#748096);">Cargando programas...</div>';
    try {
        var r = await api.medprevProgramasList({ companyName: PG.empresa, tipo: PG.tipo, token: _pgToken() });
        if (!r || !r.success) {
            body.innerHTML = _pgHtmlEmpty((r && r.error && r.error.message) || 'No se pudieron cargar los programas.', false);
            return;
        }
        PG.programas = r.data.programas || [];
        _pgRenderLista();
    } catch (e) {
        body.innerHTML = _pgHtmlEmpty('Error cargando programas: ' + _pgEsc(e.message), false);
    }
}

function _pgHtmlEmpty(mensaje, conCta) {
    return '' +
        '<div class="kair-block">' +
            '<div class="kair-block__head">' +
                '<div class="kair-block__chip"><i class="fas fa-folder-open"></i></div>' +
                '<div class="kair-block__text">' +
                    '<div class="kair-block__title">Programas</div>' +
                    '<div class="kair-block__sub">Aun no hay programas en esta linea de trabajo.</div>' +
                '</div>' +
            '</div>' +
            '<div class="kair-block__panel">' +
                '<div class="mp-pg__empty">' +
                    '<div class="mp-pg__empty-icon"><i class="fas fa-folder-open"></i></div>' +
                    '<div class="mp-pg__empty-title">Crea tu primer programa</div>' +
                    '<div class="mp-pg__empty-sub">' + _pgEsc(mensaje) + '</div>' +
                    (conCta ? '<button class="mp-pg__btn mp-pg__btn--primary" onclick="abrirWizard()"><i class="fas fa-plus"></i><span>Crear programa</span></button>' : '') +
                '</div>' +
            '</div>' +
        '</div>';
}

function _pgRenderLista() {
    var linea = PG_LINEAS[PG.tipo];
    var body = _pgBody();

    if (PG.programas.length === 0) {
        body.innerHTML = _pgHtmlEmpty(
            'Puedes partir de la plantilla estandar de la linea ' + _pgEsc(linea.etiqueta) +
            ' (con sus secciones ya definidas) o crear un programa en blanco. Lo decides en el asistente.',
            true
        );
        return;
    }

    var tarjetas = PG.programas.map(function (p) {
        var progreso = p.progreso || { total: 0, completas: 0, pct: 0 };
        var periodo = p.fechaInicio || p.fechaFin
            ? _pgEsc(_pgFechaBonita(p.fechaInicio)) + ' — ' + _pgEsc(_pgFechaBonita(p.fechaFin))
            : 'Sin periodo definido';
        var seccionesTxt = progreso.total > 0
            ? progreso.completas + ' de ' + progreso.total + ' secciones completas'
            : 'Programa en blanco (sin secciones)';
        return '' +
            '<div class="mp-pg__card" onclick="abrirDetalle(\'' + _pgEsc(p.id) + '\')">' +
                '<div class="mp-pg__card-top">' +
                    '<div class="mp-pg__card-name" title="' + _pgEsc(p.nombre) + '">' + _pgEsc(p.nombre) + '</div>' +
                    '<span class="mp-pg__chip mp-pg__chip--' + _pgEsc(p.estado) + '">' + _pgEsc(PG_ESTADO_ETIQUETA[p.estado] || p.estado) + '</span>' +
                '</div>' +
                '<div class="mp-pg__card-desc">' + (p.descripcion ? _pgEsc(p.descripcion) : '<em>Sin descripcion</em>') + '</div>' +
                '<div class="mp-pg__card-meta">' +
                    '<span><i class="fas fa-calendar-days" style="margin-right:5px;"></i>' + periodo + '</span>' +
                    '<span><i class="fas fa-list-check" style="margin-right:5px;"></i>' + _pgEsc(seccionesTxt) + '</span>' +
                '</div>' +
                '<div class="mp-pg__bar"><div class="mp-pg__bar-fill" style="width:' + (progreso.pct || 0) + '%"></div></div>' +
                '<div class="mp-pg__bar-label">' + (progreso.pct || 0) + '% de avance</div>' +
            '</div>';
    }).join('');

    body.innerHTML = '' +
        '<div class="kair-block">' +
            '<div class="kair-block__head">' +
                '<div class="kair-block__chip"><i class="fas fa-compass"></i></div>' +
                '<div class="kair-block__text">' +
                    '<div class="kair-block__title">Programas de ' + _pgEsc(linea.etiqueta) + '</div>' +
                    '<div class="kair-block__sub">' + PG.programas.length + ' programa(s) · clic en un programa para gestionarlo.</div>' +
                '</div>' +
            '</div>' +
            '<div class="kair-block__panel">' +
                '<div class="kair-block__grid mp-pg__grid">' + tarjetas + '</div>' +
            '</div>' +
        '</div>';
}

// ---------- MODO DETALLE ----------
async function _pgCargarDetalle() {
    var api = _pgApi();
    var body = _pgBody();
    if (!api || !api.medprevProgramasGet) {
        body.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--kair-muted,#748096);">El puente de datos no esta disponible.</div>';
        return;
    }
    body.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--kair-muted,#748096);">Cargando programa...</div>';
    try {
        var r = await api.medprevProgramasGet({ companyName: PG.empresa, programaId: PG.id, token: _pgToken() });
        if (!r || !r.success) {
            body.innerHTML = _pgHtmlEmpty((r && r.error && r.error.message) || 'No se encontro el programa.', true);
            return;
        }
        PG.programa = r.data.programa;
        if (!PG.seccionActivaId && PG.programa.secciones.length > 0) {
            PG.seccionActivaId = PG.programa.secciones[0].id;
        }
        _pgRenderDetalle();
    } catch (e) {
        body.innerHTML = _pgHtmlEmpty('Error cargando el programa: ' + _pgEsc(e.message), true);
    }
}

function _pgRenderDetalle() {
    var p = PG.programa;
    var progreso = p.progreso || { total: 0, completas: 0, enCurso: 0, pct: 0 };
    var periodo = p.fechaInicio || p.fechaFin
        ? _pgEsc(_pgFechaBonita(p.fechaInicio)) + ' — ' + _pgEsc(_pgFechaBonita(p.fechaFin))
        : 'Sin periodo definido';

    var tabs = p.secciones.map(function (s, idx) {
        var activa = s.id === PG.seccionActivaId;
        return '' +
            '<button class="mp-pg__tab' + (activa ? ' mp-pg__tab--active' : '') + '" onclick="seleccionarSeccion(\'' + _pgEsc(s.id) + '\')">' +
                '<span class="mp-pg__tab-num">' + (idx + 1) + '</span>' +
                _pgEsc(s.nombre) +
                '<span class="mp-pg__dot mp-pg__dot--' + _pgEsc(s.estado) + '" title="' + _pgEsc(PG_SECCION_ETIQUETA[s.estado] || s.estado) + '"></span>' +
            '</button>';
    }).join('');

    var seccionActiva = p.secciones.find(function (s) { return s.id === PG.seccionActivaId; }) || null;
    var panelSeccion = '';
    if (seccionActiva) {
        var segmento = ['pendiente', 'en_curso', 'completo'].map(function (est) {
            var activo = seccionActiva.estado === est;
            return '<button class="mp-pg__seg-btn' + (activo ? ' mp-pg__seg-btn--active' : '') + '" onclick="marcarEstado(\'' + est + '\')">' +
                _pgEsc(PG_SECCION_ETIQUETA[est]) + '</button>';
        }).join('');

        // 📦826 — Sección con interfaz real del prototipo SVE: el panel monta
        // la vista correspondiente; el placeholder queda solo para secciones
        // que todavía no tienen interfaz.
        var rutaSve = PG.tipo === 'sve' ? PG_SVE_RUTAS[seccionActiva.clave] : null;
        var contenidoSeccion;
        if (rutaSve) {
            PG.sveHostClave = seccionActiva.clave;
            // `kair-app-sve` es la raíz de tema del prototipo: es lo que le da
            // su tipografía (Inter 14px), el reset de `box-sizing: border-box` y
            // los scrollbars. Montado dentro del 3.1.2 el prototipo ya no está
            // bajo esa clase, así que sin ella heredaba Roboto del shell K+AIR y
            // —peor— sus `width: 100%` con padding medían 40px más que el panel
            // y se recortaba contenido por la derecha.
            contenidoSeccion = '<div id="pg-sve-host" class="mp-pg__sve-host kair-app-sve"><div class="mp-pg__sve-cargando">Cargando interfaz SVE...</div></div>';
        } else {
            contenidoSeccion = '' +
                '<div class="mp-pg__placeholder">' +
                    '<div class="mp-pg__placeholder-icon"><i class="fas fa-hammer"></i></div>' +
                    '<div class="mp-pg__placeholder-title">Interfaz de "' + _pgEsc(seccionActiva.nombre) + '" en construccion</div>' +
                    '<div class="mp-pg__placeholder-sub">Esta seccion pertenece al esqueleto del programa. Su interfaz operativa (formularios, indicadores y reportes) llega en la fase 2 del desarrollo del 3.1.2.</div>' +
                '</div>';
        }

        panelSeccion = '' +
            '<div class="mp-pg__panel-sec">' +
                '<div class="mp-pg__sec-head">' +
                    '<div>' +
                        '<div class="mp-pg__sec-title">' + _pgEsc(seccionActiva.nombre) + '</div>' +
                        '<div class="mp-pg__sec-desc">' + (seccionActiva.descripcion ? _pgEsc(seccionActiva.descripcion) : '<em>Sin descripcion</em>') + '</div>' +
                    '</div>' +
                    '<div class="mp-pg__seg">' + segmento + '</div>' +
                '</div>' +
                contenidoSeccion +
            '</div>';
    } else {
        panelSeccion = '' +
            '<div class="mp-pg__panel-sec">' +
                '<div class="mp-pg__empty">' +
                    '<div class="mp-pg__empty-title">Programa en blanco</div>' +
                    '<div class="mp-pg__empty-sub">Este programa se creo sin plantilla, asi que no tiene secciones. Si prefieres la estructura estandar, elimina este programa y crea uno nuevo usando la plantilla.</div>' +
                '</div>' +
            '</div>';
    }

    var acciones = '';
    if (p.estado === 'activo') {
        acciones += '<button class="mp-pg__btn" onclick="cambiarEstadoPrograma(\'pausado\')"><i class="fas fa-pause"></i><span>Pausar</span></button>';
    } else if (p.estado === 'pausado') {
        acciones += '<button class="mp-pg__btn" onclick="cambiarEstadoPrograma(\'activo\')"><i class="fas fa-play"></i><span>Reanudar</span></button>';
    }
    if (p.estado !== 'cerrado') {
        acciones += '<button class="mp-pg__btn" onclick="cambiarEstadoPrograma(\'cerrado\')"><i class="fas fa-flag-checkered"></i><span>Cerrar programa</span></button>';
    }
    // 📦827-fix — Dos acciones distintas, porque "eliminar" significaba dos
    // cosas: dejar de usar el programa (se archiva y queda el registro) o
    // quitarlo con todo lo capturado. Un solo botón obligaba a adivinar, y
    // detrás hacía una sola cosa: marcar 'eliminado' y dejar los datos.
    acciones += '<button class="mp-pg__btn" onclick="archivarPrograma()"><i class="fas fa-box-archive"></i><span>Archivar</span></button>';
    acciones += '<button class="mp-pg__btn mp-pg__btn--danger" onclick="eliminarPrograma()"><i class="fas fa-trash-can"></i><span>Eliminar de verdad</span></button>';

    _pgBody().innerHTML = '' +
        // 📦826 — Los dos bloques del detalle van SOLO con título. El subtítulo
        // repetía lo que ya se ve a 2 cm: la barra de progreso, los botones de
        // ciclo de vida y las tabs. Además empujaba la "sección activa" fuera de
        // pantalla, y con el Dashboard del prototipo (que ocupa toda la
        // pantalla) había que subir para ver las dos cosas a la vez. Sin
        // subtítulo los bloques quedan cerca sin pegarse: los separa el
        // chip + título, que es justo la separación que se pidió.
        '<div class="mp-pg__detalle">' +
        '<div class="kair-block mp-pg__bloque">' +
            '<div class="kair-block__head mp-pg__head">' +
                '<div class="kair-block__chip"><i class="fas fa-clipboard-list"></i></div>' +
                '<div class="kair-block__text">' +
                    '<div class="kair-block__title">Resumen del programa</div>' +
                '</div>' +
            '</div>' +
            '<div class="kair-block__panel">' +
                '<div class="mp-pg__resumen">' +
                    '<div>' +
                        '<div class="mp-pg__resumen-name">' + _pgEsc(p.nombre) + '</div>' +
                        '<div class="mp-pg__resumen-desc">' + (p.descripcion ? _pgEsc(p.descripcion) : '<em>Sin descripcion</em>') + '</div>' +
                        '<div class="mp-pg__resumen-meta">' +
                            '<span class="mp-pg__chip mp-pg__chip--' + _pgEsc(p.estado) + '">' + _pgEsc(PG_ESTADO_ETIQUETA[p.estado] || p.estado) + '</span>' +
                            '<span><i class="fas fa-calendar-days" style="margin-right:5px;"></i>' + periodo + '</span>' +
                            '<span><i class="fas fa-diagram-project" style="margin-right:5px;"></i>Plantilla: ' + (p.plantilla === 'estandar' ? 'estandar' : 'en blanco') + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="mp-pg__resumen-side">' +
                        '<div class="mp-pg__resumen-pct">' + (progreso.pct || 0) + '%</div>' +
                        '<div class="mp-pg__bar mp-pg__resumen-bar"><div class="mp-pg__bar-fill" style="width:' + (progreso.pct || 0) + '%"></div></div>' +
                        '<div class="mp-pg__bar-label">' + progreso.completas + ' completas · ' + (progreso.enCurso || 0) + ' en curso · ' + (progreso.total || 0) + ' secciones</div>' +
                    '</div>' +
                '</div>' +
                '<div style="display:flex;gap:0.6rem;flex-wrap:wrap;margin-top:1.1rem;">' + acciones + '</div>' +
                // 📦826 — La navegación entre secciones vive DENTRO del panel de
                // resumen: nombre, estado, progreso, acciones y secciones son
                // una sola tarjeta. Antes las tabs tenía su propio bloque
                // ("Secciones del programa") y quedaban separadas del programa
                // al que pertenecen, que es justo lo que se pierde de vista al
                // bajar a una vista larga como el Dashboard del prototipo.
                (tabs ? '<div class="mp-pg__tabs mp-pg__tabs--resumen">' + tabs + '</div>' : '') +
            '</div>' +
        '</div>' +
        '<div class="kair-block mp-pg__bloque">' +
            '<div class="kair-block__head mp-pg__head">' +
                '<div class="kair-block__chip"><i class="fas fa-list-check"></i></div>' +
                '<div class="kair-block__text">' +
                    '<div class="kair-block__title">Seccion activa</div>' +
                '</div>' +
            '</div>' +
            '<div class="kair-block__panel">' +
                panelSeccion +
            '</div>' +
        '</div>' +
        '</div>';

    // 📦826 — Tras repintar, montar la vista del prototipo SVE si toca.
    if (PG.tipo === 'sve' && seccionActiva && PG_SVE_RUTAS[seccionActiva.clave]) {
        _pgSveMontar(seccionActiva.clave);
    }
}

// ---------- acciones del detalle ----------
function seleccionarSeccion(seccionId) {
    PG.seccionActivaId = seccionId;
    _pgRenderDetalle();
}

async function marcarEstado(estado) {
    var api = _pgApi();
    if (!api || !api.medprevProgramasSetSeccionEstado || !PG.programa) return;
    var seccion = PG.programa.secciones.find(function (s) { return s.id === PG.seccionActivaId; });
    if (!seccion || seccion.estado === estado) return;
    try {
        var r = await api.medprevProgramasSetSeccionEstado({
            companyName: PG.empresa, programaId: PG.programa.id, seccionId: seccion.id,
            estado: estado, token: _pgToken()
        });
        if (r && r.success) {
            seccion.estado = estado;
            PG.programa.progreso = r.data.progreso;
            _pgRenderDetalle();
            _pgToast('Seccion "' + seccion.nombre + '" marcada como ' + PG_SECCION_ETIQUETA[estado].toLowerCase() + '.', 'success');
        } else {
            _pgToast((r && r.error && r.error.message) || 'No se pudo actualizar la seccion.', 'error');
        }
    } catch (e) {
        _pgToast('Error actualizando la seccion: ' + e.message, 'error');
    }
}

async function cambiarEstadoPrograma(nuevoEstado) {
    var api = _pgApi();
    if (!api || !api.medprevProgramasUpdate || !PG.programa) return;
    if (nuevoEstado === 'cerrado') {
        var seguir = true;
        if (window.KairConfirm && typeof window.KairConfirm.confirm === 'function') {
            seguir = await window.KairConfirm.confirm({
                title: 'Cerrar programa',
                message: 'El programa "' + PG.programa.nombre + '" quedara marcado como cerrado. Podras reabrirlo desde el listado editandolo mas adelante.',
                confirmText: 'Cerrar programa', cancelText: 'Cancelar', type: 'warning'
            });
        }
        if (!seguir) return;
    }
    try {
        var r = await api.medprevProgramasUpdate({
            companyName: PG.empresa, programaId: PG.programa.id,
            cambios: { estado: nuevoEstado }, token: _pgToken()
        });
        if (r && r.success) {
            PG.programa = r.data.programa;
            _pgRenderDetalle();
            _pgToast('Programa "' + PG.programa.nombre + '" ahora esta ' + (PG_ESTADO_ETIQUETA[nuevoEstado] || nuevoEstado).toLowerCase() + '.', 'success');
        } else {
            _pgToast((r && r.error && r.error.message) || 'No se pudo cambiar el estado.', 'error');
        }
    } catch (e) {
        _pgToast('Error cambiando el estado: ' + e.message, 'error');
    }
}

async function archivarPrograma() {
    var api = _pgApi();
    if (!api || !api.medprevProgramasDelete || !PG.programa) return;
    var seguir = true;
    if (window.KairConfirm && typeof window.KairConfirm.confirm === 'function') {
        seguir = await window.KairConfirm.confirm({
            title: 'Archivar programa',
            message: 'El programa "' + PG.programa.nombre + '" deja de aparecer en la lista, pero se QUEDA guardado ' +
                'con todo lo que capturaste (casos, plan, indicadores). Solo afecta este equipo: los demas equipos no se enteran. ' +
                'Usalo cuando el programa dejo de aplicar y su historia importa.',
            confirmText: 'Archivar', cancelText: 'Cancelar'
        });
    }
    if (!seguir) return;
    try {
        var r = await api.medprevProgramasDelete({
            companyName: PG.empresa, programaId: PG.programa.id, token: _pgToken(), modo: 'archivar'
        });
        if (r && r.success) {
            _pgToast('Programa archivado. Los datos quedaron guardados en este equipo.', 'success');
            volverALista();
        } else {
            _pgToast((r && r.error && r.error.message) || 'No se pudo archivar el programa.', 'error');
        }
    } catch (e) {
        _pgToast('Error archivando el programa: ' + e.message, 'error');
    }
}

async function eliminarPrograma() {
    var api = _pgApi();
    if (!api || !api.medprevProgramasDelete || !PG.programa) return;
    var seguir = true;
    if (window.KairConfirm && typeof window.KairConfirm.confirm === 'function') {
        seguir = await window.KairConfirm.confirm({
            title: 'Eliminar de verdad',
            message: 'Se borra el programa "' + PG.programa.nombre + '" Y TODO lo que tiene dentro: los casos de ' +
                'seguimiento con nombre, documento y telefono, el plan PHVA, los indicadores y los analisis. ' +
                'Tambien se borra en los demas equipos cuando se sincronice. No se puede deshacer.',
            confirmText: 'Si, eliminar todo', cancelText: 'Cancelar', type: 'danger'
        });
    }
    if (!seguir) return;
    try {
        // `confirmacion` es la guarda del bridge: sin ella el modo destructivo
        // se rechaza, para que un clic perdido no borre la historia de un
        // programa entero.
        var r = await api.medprevProgramasDelete({
            companyName: PG.empresa, programaId: PG.programa.id, token: _pgToken(),
            modo: 'eliminar', confirmacion: 'eliminar'
        });
        if (r && r.success) {
            var b = r.data && r.data.borrados;
            _pgToast('Programa eliminado' + (b ? ' (' + (b.sve || 0) + ' registros de datos)' : '') + '. Se propagara a los demas equipos.', 'success');
            volverALista();
        } else {
            _pgToast((r && r.error && r.error.message) || 'No se pudo eliminar el programa.', 'error');
        }
    } catch (e) {
        _pgToast('Error eliminando el programa: ' + e.message, 'error');
    }
}

// ---------- wizard de creación (2 pasos) ----------
function abrirWizard() {
    if (document.getElementById('pg-wizard')) return;
    // Cada apertura arranca limpio; los valores del usuario viven en PG.wizard
    // y se restauran en el DOM cada vez que se repinta el paso 1.
    PG.wizard = { paso: 1, usarPlantilla: true, nombre: '', descripcion: '', fechaInicio: '', fechaFin: '' };

    var overlay = document.createElement('div');
    overlay.className = 'mp-pg__overlay';
    overlay.id = 'pg-wizard';
    overlay.innerHTML = _pgHtmlWizard();
    document.body.appendChild(overlay);
    _pgRepintarWizard();
    // Foco directo al primer campo: el usuario puede escribir sin clic extra.
    var primero = document.getElementById('pg-wz-nombre');
    if (primero) primero.focus();
}

function _pgHtmlWizard() {
    return '' +
        '<div class="mp-pg__modal" role="dialog" aria-modal="true">' +
            '<div class="mp-pg__modal-head">' +
                '<div class="mp-pg__modal-title">Nuevo programa de ' + _pgEsc(PG_LINEAS[PG.tipo].etiqueta) + '</div>' +
                '<button class="mp-pg__modal-close" onclick="cerrarWizard()" title="Cerrar"><i class="fas fa-xmark"></i></button>' +
            '</div>' +
            '<div class="mp-pg__stepper" id="pg-wz-stepper"></div>' +
            '<div class="mp-pg__modal-body" id="pg-wz-body"></div>' +
            '<div class="mp-pg__modal-foot" id="pg-wz-foot"></div>' +
        '</div>';
}

function _pgRepintarWizard() {
    var paso = PG.wizard.paso;
    var stepper = document.getElementById('pg-wz-stepper');
    var cuerpo = document.getElementById('pg-wz-body');
    var pie = document.getElementById('pg-wz-foot');
    if (!stepper) return;

    stepper.innerHTML = '' +
        '<span class="mp-pg__wstep' + (paso === 1 ? ' mp-pg__wstep--active' : '') + '"><span class="mp-pg__wstep-num">1</span>Datos del programa</span>' +
        '<span class="mp-pg__wstep-sep"></span>' +
        '<span class="mp-pg__wstep' + (paso === 2 ? ' mp-pg__wstep--active' : '') + '"><span class="mp-pg__wstep-num">2</span>Plantilla</span>';

    if (paso === 1) {
        cuerpo.innerHTML = '' +
            '<div class="mp-pg__field">' +
                '<label class="mp-pg__label" for="pg-wz-nombre">Nombre del programa <span class="mp-pg__label-req">*</span></label>' +
                '<input class="mp-pg__input" id="pg-wz-nombre" type="text" maxlength="120" placeholder="Ej: SVE COVID-19" autocomplete="off">' +
                '<div class="mp-pg__hint">Debe ser unico dentro de la linea de trabajo.</div>' +
            '</div>' +
            '<div class="mp-pg__field">' +
                '<label class="mp-pg__label" for="pg-wz-desc">Descripcion</label>' +
                '<textarea class="mp-pg__textarea" id="pg-wz-desc" maxlength="1000" placeholder="Objetivo y alcance del programa (opcional)"></textarea>' +
            '</div>' +
            '<div class="mp-pg__row">' +
                '<div class="mp-pg__field">' +
                    '<label class="mp-pg__label" for="pg-wz-ini">Fecha de inicio</label>' +
                    '<input class="mp-pg__input" id="pg-wz-ini" type="date">' +
                '</div>' +
                '<div class="mp-pg__field">' +
                    '<label class="mp-pg__label" for="pg-wz-fin">Fecha de fin</label>' +
                    '<input class="mp-pg__input" id="pg-wz-fin" type="date">' +
                '</div>' +
            '</div>';
        // 📦825-fix — restaurar lo que el usuario ya había escrito (volver
        // desde el paso 2 o regreso tras un fallo): nunca se pierde tecleo.
        var inNombre = document.getElementById('pg-wz-nombre');
        var inDesc = document.getElementById('pg-wz-desc');
        var inIni = document.getElementById('pg-wz-ini');
        var inFin = document.getElementById('pg-wz-fin');
        if (inNombre) inNombre.value = PG.wizard.nombre;
        if (inDesc) inDesc.value = PG.wizard.descripcion;
        if (inIni) inIni.value = PG.wizard.fechaInicio;
        if (inFin) inFin.value = PG.wizard.fechaFin;
        if (inNombre) {
            inNombre.focus();
            inNombre.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter') { ev.preventDefault(); irPaso(2); }
            });
        }
        pie.innerHTML = '' +
            '<button class="mp-pg__btn" onclick="cerrarWizard()">Cancelar</button>' +
            '<button class="mp-pg__btn mp-pg__btn--primary" onclick="irPaso(2)"><span>Siguiente</span><i class="fas fa-chevron-right"></i></button>';
    } else {
        var plantilla = PG.plantillas ? PG.plantillas[PG.tipo] : null;
        var preview = '';
        if (PG.wizard.usarPlantilla && plantilla) {
            preview = '<div class="mp-pg__preview">' +
                '<div class="mp-pg__preview-title">Secciones que se crearan (' + plantilla.secciones.length + ')</div>' +
                plantilla.secciones.map(function (s) {
                    return '<div class="mp-pg__preview-item"><i class="fas fa-circle-check"></i>' + _pgEsc(s.nombre) + '</div>';
                }).join('') +
            '</div>';
        }
        cuerpo.innerHTML = '' +
            '<div class="mp-pg__opcion' + (PG.wizard.usarPlantilla ? ' mp-pg__opcion--active' : '') + '" onclick="elegirPlantilla(true)">' +
                '<div class="mp-pg__opcion-icon"><i class="fas fa-diagram-project"></i></div>' +
                '<div>' +
                    '<div class="mp-pg__opcion-title">Usar la plantilla estandar</div>' +
                    '<div class="mp-pg__opcion-sub">' + (plantilla ? _pgEsc(plantilla.descripcion) : 'Estructura recomendada de la linea de trabajo.') + '</div>' +
                    preview +
                '</div>' +
            '</div>' +
            '<div class="mp-pg__opcion' + (!PG.wizard.usarPlantilla ? ' mp-pg__opcion--active' : '') + '" onclick="elegirPlantilla(false)">' +
                '<div class="mp-pg__opcion-icon"><i class="fas fa-pen-to-square"></i></div>' +
                '<div>' +
                    '<div class="mp-pg__opcion-title">Empezar en blanco</div>' +
                    '<div class="mp-pg__opcion-sub">Crea el programa sin secciones; utiles cuando la estructura aun no esta definida.</div>' +
                '</div>' +
            '</div>';
        pie.innerHTML = '' +
            '<button class="mp-pg__btn" onclick="irPaso(1)"><i class="fas fa-chevron-left"></i><span>Anterior</span></button>' +
            '<button class="mp-pg__btn mp-pg__btn--primary" id="pg-wz-crear" onclick="crearPrograma()"><i class="fas fa-plus"></i><span>Crear programa</span></button>';
    }
}

// 📦825-fix — Guarda los valores del DOM en PG.wizard antes de cualquier
// cambio de paso o re-render: los inputs del paso 1 dejan de existir al
// repintar, y el dato vive en estado, no en el árbol.
function _pgWizardGuardarDesdeDom() {
    var inNombre = document.getElementById('pg-wz-nombre');
    var inDesc = document.getElementById('pg-wz-desc');
    var inIni = document.getElementById('pg-wz-ini');
    var inFin = document.getElementById('pg-wz-fin');
    if (inNombre) PG.wizard.nombre = inNombre.value.trim();
    if (inDesc) PG.wizard.descripcion = inDesc.value.trim();
    if (inIni) PG.wizard.fechaInicio = inIni.value;
    if (inFin) PG.wizard.fechaFin = inFin.value;
}

function irPaso(n) {
    if (n === 2) {
        _pgWizardGuardarDesdeDom();
        if (!PG.wizard.nombre) {
            _pgToast('Escribe el nombre del programa para continuar.', 'warning');
            var inNombre = document.getElementById('pg-wz-nombre');
            if (inNombre) inNombre.focus();
            return;
        }
        if (PG.wizard.fechaInicio && PG.wizard.fechaFin && PG.wizard.fechaFin < PG.wizard.fechaInicio) {
            _pgToast('La fecha de fin no puede ser anterior a la de inicio.', 'warning');
            return;
        }
    }
    PG.wizard.paso = n;
    _pgRepintarWizard();
}

function elegirPlantilla(usar) {
    PG.wizard.usarPlantilla = usar;
    _pgRepintarWizard();
}

function cerrarWizard() {
    var overlay = document.getElementById('pg-wizard');
    if (overlay) overlay.remove();
}

async function crearPrograma() {
    var api = _pgApi();
    if (!api || !api.medprevProgramasCreate) {
        _pgToast('El puente de datos no esta disponible.', 'error');
        return;
    }
    // 📦825-fix — leer SIEMPRE de PG.wizard: en el paso 2 los inputs del paso 1
    // ya no existen en el DOM (por eso el wizard original nunca completaba).
    var nombre = PG.wizard.nombre;
    if (!nombre) {
        // Red de seguridad: si por alguna ruta llegamos al paso 2 sin nombre,
        // regresar sin borrar nada y pedir el dato.
        _pgToast('Escribe el nombre del programa para continuar.', 'warning');
        irPaso(1);
        return;
    }
    var descripcion = PG.wizard.descripcion;
    var fechaInicio = PG.wizard.fechaInicio;
    var fechaFin = PG.wizard.fechaFin;

    var btnCrear = document.getElementById('pg-wz-crear');
    if (btnCrear) { btnCrear.disabled = true; btnCrear.style.opacity = '0.6'; }

    try {
        var r = await api.medprevProgramasCreate({
            companyName: PG.empresa, tipo: PG.tipo, nombre: nombre,
            descripcion: descripcion, fechaInicio: fechaInicio, fechaFin: fechaFin,
            usarPlantilla: PG.wizard.usarPlantilla, token: _pgToken()
        });
        if (r && r.success) {
            cerrarWizard();
            _pgToast('Programa "' + r.data.programa.nombre + '" creado con ' + r.data.programa.secciones.length + ' seccion(es).', 'success');
            window.parent.postMessage({ action: 'open-program-id', program: PG.tipo, id: r.data.programa.id }, '*');
        } else {
            _pgToast((r && r.error && r.error.message) || 'No se pudo crear el programa.', 'error');
            if (btnCrear) { btnCrear.disabled = false; btnCrear.style.opacity = '1'; }
        }
    } catch (e) {
        _pgToast('Error creando el programa: ' + e.message, 'error');
        if (btnCrear) { btnCrear.disabled = false; btnCrear.style.opacity = '1'; }
    }
}

// ---------- navegación (via padre) ----------
function abrirDetalle(programaId) {
    window.parent.postMessage({ action: 'open-program-id', program: PG.tipo, id: programaId }, '*');
}

function volverALista() {
    window.parent.postMessage({ action: 'open-program', program: PG.tipo }, '*');
}

function volverAlHome() {
    window.parent.postMessage({ action: 'backToHome' }, '*');
}

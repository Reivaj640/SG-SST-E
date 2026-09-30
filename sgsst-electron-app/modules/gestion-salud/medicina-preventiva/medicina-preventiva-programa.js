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
    wizard: { paso: 1, usarPlantilla: true }
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
        panelSeccion = '' +
            '<div class="mp-pg__panel-sec">' +
                '<div class="mp-pg__sec-head">' +
                    '<div>' +
                        '<div class="mp-pg__sec-title">' + _pgEsc(seccionActiva.nombre) + '</div>' +
                        '<div class="mp-pg__sec-desc">' + (seccionActiva.descripcion ? _pgEsc(seccionActiva.descripcion) : '<em>Sin descripcion</em>') + '</div>' +
                    '</div>' +
                    '<div class="mp-pg__seg">' + segmento + '</div>' +
                '</div>' +
                '<div class="mp-pg__placeholder">' +
                    '<div class="mp-pg__placeholder-icon"><i class="fas fa-hammer"></i></div>' +
                    '<div class="mp-pg__placeholder-title">Interfaz de "' + _pgEsc(seccionActiva.nombre) + '" en construccion</div>' +
                    '<div class="mp-pg__placeholder-sub">Esta seccion pertenece al esqueleto del programa. Su interfaz operativa (formularios, indicadores y reportes) llega en la fase 2 del desarrollo del 3.1.2.</div>' +
                '</div>' +
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
    acciones += '<button class="mp-pg__btn mp-pg__btn--danger" onclick="eliminarPrograma()"><i class="fas fa-trash-can"></i><span>Eliminar</span></button>';

    _pgBody().innerHTML = '' +
        '<div class="kair-block">' +
            '<div class="kair-block__head">' +
                '<div class="kair-block__chip"><i class="fas fa-clipboard-list"></i></div>' +
                '<div class="kair-block__text">' +
                    '<div class="kair-block__title">Resumen del programa</div>' +
                    '<div class="kair-block__sub">Ciclo de vida y progreso general.</div>' +
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
            '</div>' +
        '</div>' +
        '<div class="kair-block">' +
            '<div class="kair-block__head">' +
                '<div class="kair-block__chip"><i class="fas fa-list-check"></i></div>' +
                '<div class="kair-block__text">' +
                    '<div class="kair-block__title">Secciones del programa</div>' +
                    '<div class="kair-block__sub">Marca el avance de cada seccion; su interfaz operativa llega en la fase 2.</div>' +
                '</div>' +
            '</div>' +
            '<div class="kair-block__panel">' +
                (p.secciones.length > 0 ? '<div class="mp-pg__tabs" style="padding:1rem 1rem 0 1rem;">' + tabs + '</div>' : '') +
                panelSeccion +
            '</div>' +
        '</div>';
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

async function eliminarPrograma() {
    var api = _pgApi();
    if (!api || !api.medprevProgramasDelete || !PG.programa) return;
    var seguir = true;
    if (window.KairConfirm && typeof window.KairConfirm.confirm === 'function') {
        seguir = await window.KairConfirm.confirm({
            title: 'Eliminar programa',
            message: 'Se eliminara el programa "' + PG.programa.nombre + '" con sus ' +
                (PG.programa.secciones ? PG.programa.secciones.length : 0) + ' secciones. Esta accion no se puede deshacer desde la interfaz.',
            confirmText: 'Eliminar', cancelText: 'Cancelar', type: 'danger'
        });
    }
    if (!seguir) return;
    try {
        var r = await api.medprevProgramasDelete({
            companyName: PG.empresa, programaId: PG.programa.id, token: _pgToken()
        });
        if (r && r.success) {
            _pgToast('Programa eliminado.', 'success');
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
    PG.wizard = { paso: 1, usarPlantilla: true };

    var overlay = document.createElement('div');
    overlay.className = 'mp-pg__overlay';
    overlay.id = 'pg-wizard';
    overlay.innerHTML = _pgHtmlWizard();
    document.body.appendChild(overlay);
    _pgRepintarWizard();
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

function irPaso(n) {
    if (n === 2) {
        var nombre = document.getElementById('pg-wz-nombre');
        if (!nombre) return;
        if (!nombre.value || !nombre.value.trim()) {
            _pgToast('El nombre del programa es obligatorio.', 'warning');
            nombre.focus();
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
    var nombre = document.getElementById('pg-wz-nombre') ? document.getElementById('pg-wz-nombre').value.trim() : '';
    if (!nombre) {
        _pgToast('El nombre del programa es obligatorio.', 'warning');
        irPaso(1);
        return;
    }
    var descripcion = document.getElementById('pg-wz-desc') ? document.getElementById('pg-wz-desc').value.trim() : '';
    var fechaInicio = document.getElementById('pg-wz-ini') ? document.getElementById('pg-wz-ini').value : '';
    var fechaFin = document.getElementById('pg-wz-fin') ? document.getElementById('pg-wz-fin').value : '';

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

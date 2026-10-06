// =====================================================================
// 3.1.2 — Actividades de medicina preventiva y promocion de la salud
// medicina-preventiva-home.js
//
// Corre DENTRO del iframe del home. 📦825 (2026-09-29): además de avisarle
// al padre que se pidió abrir una línea de trabajo, carga el conteo real de
// programas por línea (bridge `medprev:programas:list`) y repinta las
// etiquetas de las tarjetas: "Sin programas — crear" o "N programas activos".
//
// La empresa llega por query param (`?empresa=`) que arma
// medicina-preventiva-logic.js; el token de sesión se lee de localStorage
// (misma clave que renderer.js) porque el iframe es mismo-origen.
// El puente se toma del padre si el iframe no hereda el preload (iframes
// sandbox), igual que hace la bandeja integrada con window.parent.electronAPI.
// =====================================================================

'use strict';

/**
 * Puente IPC: window.electronAPI propio o el del padre (mismo origen file://).
 */
function _mpApi() {
    return window.electronAPI || (window.parent && window.parent.electronAPI) || null;
}

/**
 * Pide al padre abrir la interfaz de una línea de trabajo.
 * @param {string} program - 'sve' | 'dme' | 'promocion' (alias viejo 'programas' aceptado)
 */
function abrirPrograma(program) {
    var tipo = program === 'programas' ? 'promocion' : program;
    window.parent.postMessage({ action: 'open-program', program: tipo }, '*');
}

/** Vuelve al listado de submodulos del modulo 3 (Gestion de la Salud). */
function goBackToModule() {
    window.parent.postMessage({ action: 'backToSubmodules' }, '*');
}

/**
 * 📦825 — Cuenta programas por línea y repinta las etiquetas de las tarjetas.
 * Sin puente o con error, deja un texto neutro de creación (nunca rompe el home).
 */
function cargarConteosProgramas() {
    var api = _mpApi();
    var empresa = '';
    try { empresa = new URLSearchParams(window.location.search).get('empresa') || ''; } catch (e) { /* sin params */ }

    var etiquetas = {
        sve: document.getElementById('mp-tag-sve'),
        dme: document.getElementById('mp-tag-dme'),
        promocion: document.getElementById('mp-tag-promocion')
    };
    var ponerPorDefecto = function () {
        Object.keys(etiquetas).forEach(function (k) {
            if (etiquetas[k]) etiquetas[k].textContent = 'Crear programa';
        });
    };
    if (!api || !api.medprevProgramasList) { ponerPorDefecto(); return; }

    var token = '';
    try { token = localStorage.getItem('kair-auth-token') || ''; } catch (e) { /* sin token */ }

    api.medprevProgramasList({ companyName: empresa, token: token }).then(function (r) {
        if (!r || !r.success || !r.data || !Array.isArray(r.data.programas)) { ponerPorDefecto(); return; }
        var conteos = { sve: 0, dme: 0, promocion: 0 };
        r.data.programas.forEach(function (p) {
            if (conteos[p.tipo] !== undefined) conteos[p.tipo]++;
        });
        Object.keys(etiquetas).forEach(function (k) {
            if (!etiquetas[k]) return;
            etiquetas[k].textContent = conteos[k] === 0
                ? 'Sin programas — crear'
                : conteos[k] + (conteos[k] === 1 ? ' programa activo' : ' programas activos');
        });
    }).catch(function () { ponerPorDefecto(); });
}

document.addEventListener('DOMContentLoaded', cargarConteosProgramas);

/* ==========================================================================
 * K+AIR — Consulta de Trabajadores
 * Módulo de Ausentismo — Búsqueda en la BD de personal de la empresa activa.
 *
 * Usa postMessage para comunicarse con el componente padre
 * (MedicionAusentismoComponent) que actúa como proxy al backend.
 * ========================================================================== */

const ConsultaTrabajadores = {
    empresaActiva: null,     // Se recibe via SET_COMPANY_CONTEXT
    resultados: [],
    ultimaBusqueda: null,
};

/**
 * Inicialización
 */
document.addEventListener('DOMContentLoaded', function () {
    console.log('[consulta-trabajadores] Inicializando módulo...');

    const cedulaInput = document.getElementById('ct-cedula-input');
    const nombreInput = document.getElementById('ct-nombre-input');

    if (cedulaInput) {
        cedulaInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') ejecutarBusqueda();
        });
    }
    if (nombreInput) {
        nombreInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') ejecutarBusqueda();
        });
    }

    // Escuchar respuestas del padre
    window.addEventListener('message', function (event) {
        const data = event.data;
        if (data.type === 'SET_COMPANY_CONTEXT') {
            ConsultaTrabajadores.empresaActiva = data.company;
            console.log('[consulta-trabajadores] Empresa activa:', data.company);
        }
        if (data.type === 'ct-search-response') {
            onSearchResponse(data);
        }
    });
});

/**
 * Búsqueda principal — envía petición al padre para la empresa activa
 */
function ejecutarBusqueda() {
    var cedula = (document.getElementById('ct-cedula-input').value || '').trim();
    var nombre = (document.getElementById('ct-nombre-input').value || '').trim();

    if (!cedula && !nombre) {
        mostrarToast('Ingresa al menos un criterio de búsqueda (cédula o nombre).', 'warning');
        return;
    }

    if (!ConsultaTrabajadores.empresaActiva) {
        mostrarToast('No se ha detectado la empresa activa. Vuelve al menú y selecciona una empresa.', 'warning');
        return;
    }

    var tableContainer = document.getElementById('ct-table-container');
    tableContainer.innerHTML = '<div class="ct-loading"><i class="fas fa-spinner"></i><p>Buscando en ' + ConsultaTrabajadores.empresaActiva + '...</p></div>';
    document.getElementById('ct-stats-bar').style.display = 'none';

    ConsultaTrabajadores.ultimaBusqueda = { cedula: cedula, nombre: nombre };
    ConsultaTrabajadores.resultados = [];

    // Enviar petición al padre (proxy)
    if (window.parent && window.parent.postMessage) {
        console.log('[consulta-trabajadores] 📨 Enviando búsqueda:', { cedula, nombre, empresa: ConsultaTrabajadores.empresaActiva });
        window.parent.postMessage({
            type: 'ct-search-request',
            payload: {
                cedula: cedula,
                nombre: nombre,
                empresa: ConsultaTrabajadores.empresaActiva
            },
            // Fallback para versiones de renderer que no usan payload
            cedula: cedula,
            nombre: nombre,
            empresa: ConsultaTrabajadores.empresaActiva
        }, '*');
    }
}

/**
 * Recibe resultados de búsqueda del padre
 */
function onSearchResponse(data) {
    var elapsed = Math.round(performance.now() - (ConsultaTrabajadores._searchStart || performance.now()));
    
    // El renderer suele envolver el resultado en 'payload'
    var response = data.payload || data;

    if (response.success) {
        ConsultaTrabajadores.resultados = response.data || [];
        renderizarResultados(ConsultaTrabajadores.resultados, elapsed);
    } else {
        console.error('[consulta-trabajadores] Error en respuesta:', response.error);
        renderizarError(response.error && response.error.message ? response.error.message : 'Error desconocido.');
    }
}

/**
 * Renderizado de resultados
 */
function renderizarResultados(resultados, elapsedMs) {
    var tableContainer = document.getElementById('ct-table-container');
    var statsBar = document.getElementById('ct-stats-bar');

    statsBar.style.display = 'flex';
    document.getElementById('ct-results-count').textContent = resultados.length;
    if (elapsedMs > 0) {
        document.getElementById('ct-search-time').textContent = 'Consulta en ' + elapsedMs + 'ms';
    }

    if (resultados.length === 0) {
        tableContainer.innerHTML =
            '<div class="ct-empty-state">' +
                '<i class="fas fa-user-slash"></i>' +
                '<div class="ct-empty-title">Sin resultados</div>' +
                '<p>No se encontraron trabajadores con los criterios ingresados.</p>' +
            '</div>';
        return;
    }

    var html = '<div class="ct-table-wrapper"><table class="ct-table">';
    html += '<thead><tr>';
    html += '<th>Cédula</th><th>Nombre Completo</th><th>Cargo</th><th>Empresa</th>';
    html += '<th>Estado</th><th>EPS</th><th>Fecha Ingreso</th>';
    html += '</tr></thead><tbody>';

    resultados.forEach(function (trabajador, index) {
        var estado = normalizarEstado(trabajador.estado || trabajador.estActual);
        var badgeEstado = estado === 'ACTIVO'
            ? '<span class="ct-badge ct-badge-activo"><i class="fas fa-check-circle"></i> Activo</span>'
            : '<span class="ct-badge ct-badge-retirado"><i class="fas fa-times-circle"></i> Retirado</span>';

        var esASEL = trabajador.tipoBD === 'ASEL';
        var badgeEmpresa = esASEL
            ? '<span class="ct-badge ct-badge-empresa-asel">' + escaparHTML(trabajador.empresa) + '</span>'
            : '<span class="ct-badge ct-badge-empresa">' + escaparHTML(trabajador.empresa) + '</span>';

        var fechaIngreso = formatearFecha(trabajador.fechaIngreso || trabajador.fecIng);

        html += '<tr onclick="verDetalleTrabajador(' + index + ')">';
        html += '<td style="font-weight:500;">' + escaparHTML(trabajador.cedula) + '</td>';
        html += '<td>' + escaparHTML(trabajador.nombreCompleto) + '</td>';
        html += '<td>' + escaparHTML(trabajador.cargo || '') + '</td>';
        html += '<td>' + badgeEmpresa + '</td>';
        html += '<td>' + badgeEstado + '</td>';
        html += '<td>' + escaparHTML(trabajador.eps || '') + '</td>';
        html += '<td>' + fechaIngreso + '</td>';
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    tableContainer.innerHTML = html;

    mostrarToast('Se encontraron ' + resultados.length + ' trabajador(es) en ' + (ConsultaTrabajadores.empresaActiva || '') + '.', 'success');
}

/**
 * Detalle del trabajador (modal)
 */
function verDetalleTrabajador(index) {
    var trabajador = ConsultaTrabajadores.resultados[index];
    if (!trabajador) return;

    var modal = document.getElementById('ct-detail-modal');
    var body = document.getElementById('ct-detail-body');

    var estado = normalizarEstado(trabajador.estado || trabajador.estActual);
    var esASEL = trabajador.tipoBD === 'ASEL';
    var iniciales = obtenerIniciales(trabajador.nombreCompleto);

    var campos = [];

    if (esASEL) {
        campos = [
            { label: 'Cédula', valor: trabajador.cedula },
            { label: 'Nombre Completo', valor: trabajador.nombreCompleto },
            { label: 'Empresa', valor: trabajador.empresa },
            { label: 'Estado', valor: estado },
            { label: 'Cargo', valor: trabajador.cargo },
            { label: 'Género', valor: trabajador.genero || '' },
            { label: 'Sede', valor: trabajador.sede || '' },
            { label: 'Lugar de Trabajo', valor: trabajador.lugarTrabajo || '' },
            { label: 'Tipo de Contrato', valor: trabajador.tipoContrato || '' },
            { label: 'Jornada Laboral', valor: trabajador.jornadaLaboral || '' },
            { label: 'EPS', valor: trabajador.eps || '' },
            { label: 'Fondo de Pensión', valor: trabajador.fondoPension || '' },
            { label: 'Fondo de Cesantías', valor: trabajador.fondoCesantias || '' },
            { label: 'Salario', valor: trabajador.salario ? formatearMoneda(trabajador.salario) : '' },
            { label: 'Fecha de Ingreso', valor: formatearFecha(trabajador.fechaIngreso) },
            { label: 'Fecha de Nacimiento', valor: formatearFecha(trabajador.fechaNacimiento) },
            { label: 'Tasa de Riesgo', valor: trabajador.tasaRiesgo || '' },
            { label: 'Dirección', valor: trabajador.direccion || '' },
            { label: 'Municipio', valor: trabajador.municipio || '' },
            { label: 'Celular', valor: trabajador.celular || '' },
            { label: 'Correo', valor: trabajador.correo || '' },
        ];
    } else {
        campos = [
            { label: 'Cédula', valor: trabajador.cedula },
            { label: 'Nombre Completo', valor: trabajador.nombreCompleto },
            { label: 'Empresa', valor: trabajador.empresa },
            { label: 'Estado', valor: estado },
            { label: 'Cargo', valor: trabajador.cargo },
            { label: 'Ubicación', valor: trabajador.ubicacion || '' },
            { label: 'EPS', valor: trabajador.eps || '' },
            { label: 'AFP', valor: trabajador.afp || '' },
            { label: '% ARL', valor: trabajador.porcentajeARL || '' },
            { label: 'Salario', valor: trabajador.salario ? formatearMoneda(trabajador.salario) : '' },
            { label: 'Fecha de Ingreso', valor: formatearFecha(trabajador.fechaIngreso) },
            { label: 'Fecha de Nacimiento', valor: formatearFecha(trabajador.fechaNacimiento) },
            { label: 'Fecha de Retiro', valor: formatearFecha(trabajador.fechaRetiro) },
            { label: 'Dirección', valor: trabajador.direccion || '' },
            { label: 'Celular', valor: trabajador.celular || '' },
            { label: 'Correo', valor: trabajador.correo || '' },
            { label: 'Empresa Serv.', valor: trabajador.empresaServicio || '' },
        ];
    }

    var html = '';
    var badgeEstado = estado === 'ACTIVO'
        ? '<span class="ct-badge ct-badge-activo"><i class="fas fa-check-circle"></i> Activo</span>'
        : '<span class="ct-badge ct-badge-retirado"><i class="fas fa-times-circle"></i> Retirado</span>';
    var badgeEmpresa = esASEL
        ? '<span class="ct-badge ct-badge-empresa-asel">' + escaparHTML(trabajador.empresa) + '</span>'
        : '<span class="ct-badge ct-badge-empresa">' + escaparHTML(trabajador.empresa) + '</span>';

    html += '<div class="ct-ficha-header">';
    html += '<div class="ct-ficha-avatar">' + iniciales + '</div>';
    html += '<div>';
    html += '<div class="ct-ficha-nombre">' + escaparHTML(trabajador.nombreCompleto) + '</div>';
    html += '<div class="ct-ficha-cedula">CC: ' + escaparHTML(trabajador.cedula) + '</div>';
    html += '<div class="ct-ficha-badges">' + badgeEmpresa + ' ' + badgeEstado + '</div>';
    html += '</div></div>';

    html += '<div class="ct-detail-grid">';
    campos.forEach(function (campo) {
        var valorLimpio = campo.valor || '';
        var claseVacio = valorLimpio === '' ? ' empty' : '';
        html += '<div class="ct-detail-item">';
        html += '<div class="ct-detail-label">' + escaparHTML(campo.label) + '</div>';
        html += '<div class="ct-detail-value' + claseVacio + '">' + (valorLimpio ? escaparHTML(valorLimpio) : 'No disponible') + '</div>';
        html += '</div>';
    });
    html += '</div>';

    html += '<div style="margin-top:1rem;font-size:0.72rem;color:var(--ct-text-muted);text-align:right;">';
    html += '<i class="fas fa-database"></i> Fuente: ' + (esASEL ? 'Base de datos personal ASEL' : 'Base de Datos Personal Temporales');
    html += '</div>';

    body.innerHTML = html;
    modal.classList.add('active');

    modal.onclick = function (e) {
        if (e.target === modal) cerrarModal();
    };
}

function cerrarModal() {
    document.getElementById('ct-detail-modal').classList.remove('active');
}

function limpiarBusqueda() {
    document.getElementById('ct-cedula-input').value = '';
    document.getElementById('ct-nombre-input').value = '';
    ConsultaTrabajadores.resultados = [];
    ConsultaTrabajadores.ultimaBusqueda = null;

    document.getElementById('ct-stats-bar').style.display = 'none';
    document.getElementById('ct-table-container').innerHTML =
        '<div class="ct-empty-state">' +
            '<i class="fas fa-user-search"></i>' +
            '<div class="ct-empty-title">Ingresa un criterio de búsqueda</div>' +
            '<p>Busca por cédula o nombre en la empresa activa (' + (ConsultaTrabajadores.empresaActiva || 'no detectada') + ').</p>' +
        '</div>';
}

function goBackToHome() {
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({ type: 'back-to-module-request' }, '*');
    }
}

function renderizarError(mensaje) {
    var tableContainer = document.getElementById('ct-table-container');
    tableContainer.innerHTML =
        '<div class="ct-empty-state">' +
            '<i class="fas fa-exclamation-triangle" style="color:var(--ct-danger);"></i>' +
            '<div class="ct-empty-title">Error en la consulta</div>' +
            '<p>' + escaparHTML(mensaje) + '</p>' +
        '</div>';
    mostrarToast('Error: ' + mensaje, 'error');
}

function mostrarToast(mensaje, tipo) {
    var toast = document.getElementById('ct-toast');
    var toastMessage = document.getElementById('ct-toast-message');
    toast.className = 'ct-toast toast-' + (tipo || 'info');
    toastMessage.textContent = mensaje;
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 3500);
}

function normalizarEstado(estado) {
    if (!estado) return 'ACTIVO';
    var s = String(estado).toUpperCase().trim();
    if (s === 'A' || s === 'ACTIVO' || s === 'ACTIVA') return 'ACTIVO';
    if (s === 'R' || s === 'RETIRADO' || s === 'RETIRADA' || s === 'INACTIVO') return 'RETIRADO';
    return s;
}

function formatearFecha(fecha) {
    if (!fecha) return '';
    try {
        if (fecha instanceof Date) {
            if (isNaN(fecha.getTime())) return '';
            return fecha.toLocaleDateString('es-CO');
        }
        var str = String(fecha).trim();
        if (!str) return '';
        var date = new Date(str);
        if (isNaN(date.getTime()) || date.getFullYear() < 2000) {
            var match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
            if (match) {
                var dia = parseInt(match[1], 10);
                var mes = parseInt(match[2], 10) - 1;
                var anio = parseInt(match[3], 10);
                if (anio < 100) anio = anio < 50 ? 2000 + anio : 1900 + anio;
                date = new Date(anio, mes, dia);
            }
        }
        if (isNaN(date.getTime())) return str;
        return date.toLocaleDateString('es-CO');
    } catch (e) {
        return String(fecha);
    }
}

function formatearMoneda(valor) {
    if (!valor) return '';
    var num = parseFloat(String(valor).replace(/,/g, ''));
    if (isNaN(num)) return String(valor);
    return '$ ' + num.toLocaleString('es-CO');
}

function obtenerIniciales(nombre) {
    if (!nombre) return '?';
    var partes = nombre.split(/\s+/).filter(Boolean);
    if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
    return nombre.substring(0, 2).toUpperCase();
}

function escaparHTML(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

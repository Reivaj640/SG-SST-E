// ============================================================
// K+AIR SG-SST - frecuencia-accidentalidad.js
// Lógica del renderer para el dashboard de accidentalidad
// Submódulo 3.3.1 Frecuencia de la Accidentalidad
// ============================================================

(function() {
  'use strict';
  
  var api, indicadores, caracterizacion, companyName;
  
  function getElement(id) {
    return document.getElementById(id);
  }
  
  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  
  function showToast(msg, type) {
    type = type || 'success';
    var container = getElement('toastContainer') || document.body;
    var toast = document.createElement('div');
    toast.className = 'kair-toast ' + type;
    toast.textContent = msg;
    container.appendChild(toast);
    
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(function() { toast.remove(); }, 300);
    }, 3500);
  }
  
  function fmt(n, d) {
    d = d || 2;
    if (n === undefined || n === null || isNaN(n)) return '0';
    return Number(n).toFixed(d);
  }
  
  function getCompanyName() {
    var params = new URLSearchParams(window.location.search);
    return params.get('company') || localStorage.getItem('selectedCompany') || '';
  }
  
  function buildGridLines(P, cH, W, maxV) {
    var lines = '';
    for (var i = 0; i < 6; i++) {
      var y = P.t + cH - (i / 5) * cH;
      var val = (maxV / 5 * i).toFixed(2);
      lines += '<line x1="' + P.l + '" y1="' + y + '" x2="' + (W - P.r) + '" y2="' + y + '" stroke="#dee2e6" stroke-width="0.5" stroke-dasharray="4,4"/>';
      lines += '<text x="' + (P.l - 10) + '" y="' + (y + 4) + '" text-anchor="end" fill="#6c757d" font-size="11">' + val + '</text>';
    }
    return lines;
  }
  
  function buildChartPoints(pts, P, cH) {
    var g = '';
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      g += '<g>';
      g += '<circle cx="' + p.x + '" cy="' + p.y + '" r="5" fill="#fff" stroke="#174ea6" stroke-width="2"/>';
      g += '<text x="' + p.x + '" y="' + (P.t + cH + 20) + '" text-anchor="middle" fill="#6c757d" font-size="10">' + escapeHtml(p.label) + '</text>';
      if (p.at > 0) {
        g += '<text x="' + p.x + '" y="' + (p.y - 12) + '" text-anchor="middle" fill="#2d3748" font-size="9" font-weight="600">' + p.val + '</text>';
      }
      g += '</g>';
    }
    return g;
  }
  
  function configurarRutas() {
    return new Promise(function(resolve, reject) {
      companyName = getCompanyName();
      console.log('[FrecuenciaAccidentalidad] ===== CONFIGURAR RUTAS =====');
      console.log('[FrecuenciaAccidentalidad] companyName:', companyName);
      console.log('[FrecuenciaAccidentalidad] api.configurarRutas existe:', typeof api.configurarRutas);
      
      if (!companyName) {
        showToast('No se ha seleccionado una empresa', 'warning');
        console.log('[FrecuenciaAccidentalidad] ERROR: No hay empresa seleccionada');
        resolve(false);
        return;
      }
      
      console.log('[FrecuenciaAccidentalidad] Llamando a api.configurarRutas(' + companyName + ')...');
      
      api.configurarRutas(companyName).then(function(res) {
        console.log('[FrecuenciaAccidentalidad] Respuesta de configurarRutas:', res);
        
        if (res.success) {
          console.log('[FrecuenciaAccidentalidad] SUCCESS: Rutas configuradas');
          console.log('[FrecuenciaAccidentalidad] indicadores:', res.data && res.data.indicadores);
          console.log('[FrecuenciaAccidentalidad] caracterizacion:', res.data && res.data.caracterizacion);
          resolve(true);
        } else {
          console.log('[FrecuenciaAccidentalidad] ERROR en configurarRutas:', res.error);
          showToast(res.error && res.error.message || 'Error configurando rutas', 'error');
          resolve(false);
        }
      })['catch'](function(e) {
        console.log('[FrecuenciaAccidentalidad] EXCEPTION en configurarRutas:', e.message);
        showToast('Error de conexion: ' + e.message, 'error');
        resolve(false);
      });
    });
  }
  
  function cargarDatos() {
    console.log('[FrecuenciaAccidentalidad] ===== CARGAR DATOS =====');
    
    var chartContainer = getElement('chartContainer');
    if (chartContainer) {
      chartContainer.innerHTML = '<div class="kair-loading"><div class="kair-spinner"></div><p class="kair-loading-text">Cargando datos desde Excel...</p></div>';
    }
    
    console.log('[FrecuenciaAccidentalidad] Llamando a configurarRutas()...');
    
    configurarRutas().then(function(rutasOk) {
      console.log('[FrecuenciaAccidentalidad] configurarRutas result:', rutasOk);
      
      if (!rutasOk) {
        console.log('[FrecuenciaAccidentalidad] ERROR: No se pudieron configurar las rutas');
        renderizar();
        return;
      }
      
      console.log('[FrecuenciaAccidentalidad] Llamando a api.leerIndicadores() y api.leerCaracterizacion()...');
      console.log('[FrecuenciaAccidentalidad] api.leerIndicadores existe:', typeof api.leerIndicadores);
      console.log('[FrecuenciaAccidentalidad] api.leerCaracterizacion existe:', typeof api.leerCaracterizacion);
      
      Promise.all([
        api.leerIndicadores(),
        api.leerCaracterizacion()
      ]).then(function(results) {
        console.log('[FrecuenciaAccidentalidad] Resultados completos:', results);
        
        var resInd = results[0];
        var resCar = results[1];
        
        console.log('[FrecuenciaAccidentalidad] leerIndicadores response:', resInd);
        
        if (resInd.success) {
          console.log('[FrecuenciaAccidentalidad] indicadores cargados OK');
          indicadores = resInd.data;
        } else {
          console.log('[FrecuenciaAccidentalidad] ERROR leerIndicadores:', resInd.error);
          showToast(resInd.error && resInd.error.message || 'Error al leer indicadores', 'error');
          indicadores = null;
        }
        
        console.log('[FrecuenciaAccidentalidad] leerCaracterizacion response:', resCar);
        
        if (resCar.success) {
          console.log('[FrecuenciaAccidentalidad] caracterizacion cargada OK');
          caracterizacion = resCar.data;
        } else {
          console.log('[FrecuenciaAccidentalidad] WARN leerCaracterizacion:', resCar.error);
          caracterizacion = null;
        }
        
        renderizar();
      })['catch'](function(e) {
        showToast('Error de conexion: ' + e.message, 'error');
        console.error('[FrecuenciaAccidentalidad] Error cargando datos:', e);
      });
    });
  }
  
  function renderizar() {
    if (!indicadores) {
      renderEmptyState();
      return;
    }

    renderKPIs();
    renderTargetCard();
    renderChart();
    renderTabla();
    renderMonthCards();
    renderReference();
    renderColapsables();
  }
  
  function renderEmptyState() {
    var kpiSection = getElement('kpiSection');
    var chartContainer = getElement('chartContainer');
    
    if (kpiSection) kpiSection.style.display = 'none';
    if (chartContainer) {
      chartContainer.innerHTML = '<div class="kair-empty"><svg class="kair-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg><h3>No hay datos disponibles</h3><p>No se encontro el archivo INDICADORES 2024.xlsx en la carpeta 3.2.3 de esta empresa.</p></div>';
    }
  }
  
  function renderKPIs() {
    var fM = indicadores.frecuenciaMensual;
    var sM = indicadores.severidadMensual;
    var meta = indicadores.config.metaFrecuencia;
    var metaS = indicadores.config.metaSeveridad;
    
    var fNZ = fM.filter(function(f) { return f.indiceFrecuencia > 0; });
    var promIF = fNZ.length ? fNZ.reduce(function(s, f) { return s + f.indiceFrecuencia; }, 0) / fNZ.length : 0;
    
    var sNZ = sM.filter(function(s) { return s.indiceSeveridad > 0; });
    var promIS = sNZ.length ? sNZ.reduce(function(s, f) { return s + f.indiceSeveridad; }, 0) / sNZ.length : 0;
    
    var exceden = fM.filter(function(f) { return f.indiceFrecuencia > meta; }).length;
    
    var kpiIF = getElement('kpiIF');
    if (kpiIF) {
      kpiIF.textContent = fmt(promIF, 4);
      kpiIF.className = 'kair-kpi-value ' + (promIF > meta ? 'danger' : 'success');
    }
    
    var kpiMetaF = getElement('kpiMetaF');
    if (kpiMetaF) kpiMetaF.textContent = fmt(meta, 4);
    
    var kpiTotalAT = getElement('kpiTotalAT');
    if (kpiTotalAT) kpiTotalAT.textContent = indicadores.totalAT2024;
    
    var kpiHist = getElement('kpiHist');
    if (kpiHist) kpiHist.textContent = caracterizacion ? caracterizacion.totalGeneral : '-';
    
    var kpiIS = getElement('kpiIS');
    if (kpiIS) {
      kpiIS.textContent = fmt(promIS, 4);
      kpiIS.className = 'kair-kpi-value ' + (promIS > metaS ? 'danger' : 'success');
    }
    
    var kpiMetaS = getElement('kpiMetaS');
    if (kpiMetaS) kpiMetaS.textContent = fmt(metaS, 4);
    
    var kpiExceden = getElement('kpiExceden');
    if (kpiExceden) kpiExceden.textContent = exceden + '/' + fM.length;
    
    var kpiMort = getElement('kpiMort');
    if (kpiMort) {
      kpiMort.textContent = indicadores.config.mortalidad;
      kpiMort.className = 'kair-kpi-value ' + (indicadores.config.mortalidad > 0 ? 'danger' : 'success');
    }
    
    var kpiAus = getElement('kpiAus');
    if (kpiAus) {
      var aus = indicadores.ausentismoMensual.reduce(function(s, a) { return s + a.tasaAusentismo; }, 0) / 12;
      kpiAus.textContent = fmt(aus, 2) + '%';
    }
  }
  
  function renderChart() {
    var fM = indicadores.frecuenciaMensual;
    var meta = indicadores.config.metaFrecuencia;

    var container = getElement('chartContainer');
    if (!container) return;

    // Dimensiones dinámicas basadas en el contenedor
    var containerWidth = container.offsetWidth || 800;
    var screenWidth = window.innerWidth;

    // Ajustar ancho según tamaño de pantalla
    var baseWidth = screenWidth >= 2560 ? 1400 : screenWidth >= 1920 ? 1200 : 800;
    var W = Math.max(800, Math.min(containerWidth, baseWidth));
    var H = Math.max(320, Math.round(W * 0.4));

    var P = { t: 30, r: 40, b: 50, l: 60 };
    var cW = W - P.l - P.r;
    var cH = H - P.t - P.b;
    
    var maxV = Math.max(meta * 3, fM.reduce(function(m, d) { return Math.max(m, d.indiceFrecuencia); }, 0), 0.01);
    
    var pts = fM.map(function(d, i) {
      return {
        x: P.l + (i / Math.max(fM.length - 1, 1)) * cW,
        y: P.t + cH - (d.indiceFrecuencia / maxV) * cH,
        label: d.mesLabel,
        val: d.indiceFrecuencia,
        at: d.accidentes
      };
    });
    
    var metaY = P.t + cH - (meta / maxV) * cH;
    var line = pts.map(function(p, i) { return (i === 0 ? 'M' : 'L') + ' ' + p.x + ' ' + p.y; }).join(' ');
    var area = line + ' L ' + pts[pts.length - 1].x + ' ' + (P.t + cH) + ' L ' + pts[0].x + ' ' + (P.t + cH) + ' Z';
    
    var gridLines = buildGridLines(P, cH, W, maxV);
    var chartPoints = buildChartPoints(pts, P, cH);
    
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;font-family:var(--kair-font)">';
    svg += '<defs><linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">';
    svg += '<stop offset="0%" stop-color="#174ea6" stop-opacity="0.2"/>';
    svg += '<stop offset="100%" stop-color="#174ea6" stop-opacity="0.02"/>';
    svg += '</linearGradient></defs>';
    svg += '<!-- Grid lines -->' + gridLines;
    svg += '<!-- Meta line -->';
    svg += '<line x1="' + P.l + '" y1="' + metaY + '" x2="' + (W - P.r) + '" y2="' + metaY + '" stroke="#dc3545" stroke-width="2" stroke-dasharray="8,4"/>';
    svg += '<text x="' + (W - P.r + 5) + '" y="' + (metaY + 4) + '" fill="#dc3545" font-size="10" font-weight="600">META ' + meta + '</text>';
    svg += '<!-- Area --><path d="' + area + '" fill="url(#chartGradient)"/>';
    svg += '<!-- Line --><path d="' + line + '" fill="none" stroke="#174ea6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
    svg += '<!-- Points and labels -->' + chartPoints;
    svg += '</svg>';
    
    container.innerHTML = svg;
  }
  
  function renderTabla() {
    var fM = indicadores.frecuenciaMensual;
    var sM = indicadores.severidadMensual;
    var meta = indicadores.config.metaFrecuencia;
    var metaS = indicadores.config.metaSeveridad;
    
    var tbody = getElement('tablaBody');
    if (!tbody) return;
    
    var html = '';
    
    fM.forEach(function(row, i) {
      var sev = sM[i] || {};
      var exc = row.indiceFrecuencia > meta;
      var excSev = (sev.indiceSeveridad || 0) > metaS;
      
      html += '<tr>';
      html += '<td>' + row.mesLabel + '</td>';
      html += '<td><span class="kair-editable" data-mes="' + row.mes + '" data-campo="accidentes" tabindex="0">' + row.accidentes + '</span></td>';
      html += '<td><span class="kair-editable" data-mes="' + row.mes + '" data-campo="trabajadores" tabindex="0">' + row.trabajadores + '</span></td>';
      html += '<td style="font-weight:700;color:' + (exc ? '#dc3545' : '#28a745') + '">' + fmt(row.indiceFrecuencia, 4) + '</td>';
      html += '<td><span class="kair-editable" data-mes="' + row.mes + '" data-campo="diasPerdidos" tabindex="0">' + (sev.diasPerdidos || 0) + '</span></td>';
      html += '<td style="font-weight:700;color:' + (excSev ? '#dc3545' : '#28a745') + '">' + fmt(sev.indiceSeveridad, 4) + '</td>';
      html += '<td style="color:#6c757d">' + meta + '</td>';
      html += '<td><span class="kair-badge-status ' + (exc ? 'kair-badge-excede' : 'kair-badge-cumple') + '">' + (exc ? 'EXCEDE' : 'CUMPLE') + '</span></td>';
      html += '</tr>';
    });
    
    tbody.innerHTML = html;
    
    var btns = tbody.querySelectorAll('.kair-editable');
    btns.forEach(function(el) {
      el.addEventListener('click', iniciarEdicion);
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') iniciarEdicion.call(el);
      });
    });
    
    var totalAT = fM.reduce(function(s, f) { return s + f.accidentes; }, 0);
    var totalDias = sM.reduce(function(s, f) { return s + (f.diasPerdidos || 0); }, 0);
    var tNZ = fM.filter(function(f) { return f.trabajadores > 0; });
    var promTrab = tNZ.length ? Math.round(fM.reduce(function(s, f) { return s + f.trabajadores; }, 0) / tNZ.length) : 0;
    var promIF = fM.reduce(function(s, f) { return s + f.indiceFrecuencia; }, 0) / 12;
    var promIS = sM.reduce(function(s, f) { return s + (f.indiceSeveridad || 0); }, 0) / 12;
    
    var tablaFoot = getElement('tablaFoot');
    if (tablaFoot) {
      tablaFoot.innerHTML = '<tr><td>TOTAL</td><td>' + totalAT + '</td><td>' + promTrab + '</td><td style="color:#174ea6">' + fmt(promIF, 4) + '</td><td>' + totalDias + '</td><td style="color:#174ea6">' + fmt(promIS, 4) + '</td><td>' + meta + '</td><td>-</td></tr>';
    }
  }
  
  function iniciarEdicion() {
    var el = this;
    var actual = parseInt(el.textContent) || 0;
    var mes = parseInt(el.dataset.mes);
    var campo = el.dataset.campo;
    
    var input = document.createElement('input');
    input.type = 'number';
    input.className = 'kair-input';
    input.value = actual;
    input.min = '0';
    input.step = '1';
    
    el.replaceWith(input);
    input.focus();
    input.select();
    
    var commit = function() {
      var val = parseInt(input.value) || 0;
      if (val !== actual) {
        api.escribirEnExcel(mes, (function() { var o = {}; o[campo] = val; return o; })()).then(function(res) {
          if (res.success) {
            showToast('Excel actualizado: ' + campo + ' -> ' + val);
            cargarDatos();
          } else {
            showToast(res.error && res.error.message || 'Error al guardar', 'error');
          }
        })['catch'](function(e) {
          showToast('Error: ' + e.message, 'error');
        });
      } else {
        cargarDatos();
      }
    };
    
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      }
      if (e.key === 'Escape') {
        cargarDatos();
      }
    });
    
    input.addEventListener('blur', commit);
  }
  
  function renderColapsables() {
    var seccionesContainer = getElement('seccionesColapsables');
    if (!seccionesContainer) return;
    
    if (!caracterizacion) {
      seccionesContainer.innerHTML = '';
      return;
    }
    
    var sections = [
      { title: 'Evolucion Historica por Ano', data: caracterizacion.historialAnual, key: 'anio', val: 'total' },
      { title: 'Distribucion por Empresa', data: caracterizacion.empresaDesglose, key: 'empresa', val: 'total' },
      { title: 'Tipo de Evento', data: caracterizacion.tipoEvento, key: 'tipo', val: 'total' },
      { title: 'Distribucion Mensual Historica', data: caracterizacion.mesHistorico, key: 'mes', val: 'total' },
      { title: 'Severidad de Accidentes', data: caracterizacion.severidadDesglose, key: 'severidad', val: 'total' }
    ].filter(function(s) { return s.data && s.data.length > 0; });
    
    var colors = ['#174ea6', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#20c997', '#fd7e14', '#6610f2'];
    
    var html = '';
    
    sections.forEach(function(s, idx) {
      var maxV = Math.max.apply(null, s.data.map(function(d) { return d[s.val]; }).concat([1]));
      
      var bars = '';
      s.data.forEach(function(d, i) {
        var v = d[s.val];
        var pct = (v / maxV) * 100;
        var label = String(d[s.key]).length > 28 ? String(d[s.key]).substring(0, 28) + '...' : d[s.key];
        
        bars += '<div class="kair-progress-wrap">';
        bars += '<span class="kair-progress-label" title="' + d[s.key] + '">' + label + '</span>';
        bars += '<div class="kair-progress-track">';
        bars += '<div class="kair-progress-fill" style="width:' + pct + '%;background:' + colors[i % colors.length] + '"></div>';
        bars += '</div>';
        bars += '<span class="kair-progress-value">' + v + '</span>';
        bars += '</div>';
      });
      
      html += '<div class="kair-collapsible">';
      html += '<button class="kair-collapsible-header" data-idx="' + idx + '">' + s.title + '<span class="kair-collapsible-arrow">*</span></button>';
      html += '<div class="kair-collapsible-body" id="collapsible-' + idx + '">' + bars + '</div>';
      html += '</div>';
    });
    
    seccionesContainer.innerHTML = html;
    
    var btns = seccionesContainer.querySelectorAll('.kair-collapsible-header');
    btns.forEach(function(btn) {
      btn.addEventListener('click', toggleCollapsible);
    });
  }
  
  function toggleCollapsible() {
    var idx = this.dataset.idx;
    var body = getElement('collapsible-' + idx);
    var arrow = this.querySelector('.kair-collapsible-arrow');
    
    if (!body) return;
    
    var isOpen = body.classList.contains('open');
    
    var container = getElement('seccionesColapsables');
    if (container) {
      var bodies = container.querySelectorAll('.kair-collapsible-body');
      bodies.forEach(function(b) { b.classList.remove('open'); });
      var arrows = container.querySelectorAll('.kair-collapsible-arrow');
      arrows.forEach(function(a) { a.classList.remove('open'); });
    }
    
    if (!isOpen) {
      body.classList.add('open');
      if (arrow) arrow.classList.add('open');
    }
}

  function renderTargetCard() {
    var config = indicadores.config || {};
    var meta = config.metaFrecuencia || 0;
    var fM = indicadores.frecuenciaMensual;

    var fNZ = fM.filter(function(f) { return f.indiceFrecuencia > 0; });
    var promIF = fNZ.length ? fNZ.reduce(function(s, f) { return s + f.indiceFrecuencia; }, 0) / fNZ.length : 0;

    var targetValue = getElement('targetValue');
    if (targetValue) targetValue.textContent = meta;

    var targetBadge = getElement('targetBadge');
    if (targetBadge) {
      targetBadge.textContent = 'Promedio: ' + fmt(promIF, 4);
      targetBadge.className = 'kair-target-badge ' + (promIF > meta ? 'danger' : promIF > 0 ? 'warning' : 'success');
    }
  }

  function renderMonthCards() {
    var container = getElement('monthCards');
    if (!container) return;

    var config = indicadores.config || {};
    var meta = config.metaFrecuencia || 0;
    var fM = indicadores.frecuenciaMensual;

    var html = '';

    fM.forEach(function(month) {
      var status = month.accidentes === 0 ? 'success' : month.indiceFrecuencia <= meta ? 'success' : month.indiceFrecuencia <= meta * 5 ? 'warning' : 'danger';
      var statusColor = status === 'success' ? '#28a745' : status === 'warning' ? '#856404' : '#dc3545';
      var statusLabel = status === 'success' ? 'Sin AT' : status === 'warning' ? 'Precaución' : 'Crítico';

      html += '<div class="kair-month-card" style="border-top: 3px solid ' + statusColor + '">';
      html += '<div class="kair-month-card-name">' + month.mesLabel + '</div>';
      html += '<div class="kair-month-card-value" style="color:' + statusColor + '">' + fmt(month.indiceFrecuencia, 4) + '</div>';
      html += '<div class="kair-month-card-detail">' + month.accidentes + ' AT / ' + month.trabajadores + ' trab.</div>';
      html += '<span class="kair-badge-status kair-badge-' + (status === 'success' ? 'cumple' : 'excede') + '">' + statusLabel + '</span>';
      html += '</div>';
    });

    container.innerHTML = html;
  }

  function renderReference() {
    var config = indicadores.config || {};

    var refType = getElement('refType');
    if (refType) refType.textContent = 'RESULTADO';

    var refFormula = getElement('refFormula');
    if (refFormula) refFormula.textContent = '(AT × 200,000) / (Horas-Trab. × 1,000,000)';

    var refFreq = getElement('refFreq');
    if (refFreq) refFreq.textContent = 'MENSUAL';

    var refTargetF = getElement('refTargetF');
    if (refTargetF) refTargetF.textContent = fmt(config.metaFrecuencia || 0, 4);
  }

  // Init
  api = window.electronAPI && window.electronAPI.frecuenciaAccidentalidad;
  
  if (!api) {
    var container = document.getElementById('app') || document.body;
    container.innerHTML = '<div class="kair-empty" style="padding: 3rem;"><h3>Error de Inicializacion</h3><p>electronAPI.frecuenciaAccidentalidad no disponible.</p></div>';
    return;
  }
  
  var btnRefrescar = getElement('btnRefrescar');
  if (btnRefrescar) {
    btnRefrescar.addEventListener('click', cargarDatos);
  }

  var btnVolver = getElement('btnVolver');
  if (btnVolver) {
    btnVolver.addEventListener('click', function() {
      window.parent.postMessage({ type: 'back-to-module-request' }, '*');
    });
  }
  
  setTimeout(cargarDatos, 100);
  
})();
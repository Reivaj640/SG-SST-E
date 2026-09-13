// ============================================================
// K+AIR SG-SST - severidad-accidentalidad.js
// Lógica del renderer para el dashboard de severidad
// Submódulo 3.3.2 Severidad de la Accidentalidad
// ============================================================

// === SHIM: KairSkeleton desde ventana padre si no esta definido localmente ===
// Los iframes no heredan los globales del padre automaticamente; este puente
// evita el error "KairSkeleton is not defined" en vistas cargadas dentro de iframes.
if (typeof window.KairSkeleton === 'undefined' && typeof parent !== 'undefined' && parent !== window && parent.window && parent.window.KairSkeleton) {
  window.KairSkeleton = parent.window.KairSkeleton;
}

(function() {
  'use strict';
  
  var api, indicadores, companyName;
var currentYear = null;
var availableFiles = [];
  
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
      g += '<circle cx="' + p.x + '" cy="' + p.y + '" r="5" fill="#fff" stroke="#dc3545" stroke-width="2"/>';
      g += '<text x="' + p.x + '" y="' + (P.t + cH + 20) + '" text-anchor="middle" fill="#6c757d" font-size="10">' + escapeHtml(p.label) + '</text>';
      if (p.val > 0) {
        g += '<text x="' + p.x + '" y="' + (p.y - 12) + '" text-anchor="middle" fill="#2d3748" font-size="9" font-weight="600">' + p.val + '</text>';
      }
      g += '</g>';
    }
    return g;
  }
  
function configurarRutas(year) {
  return new Promise(function(resolve, reject) {
    companyName = getCompanyName();
    console.log('[SeveridadAccidentalidad] ===== CONFIGURAR RUTAS =====');
    console.log('[SeveridadAccidentalidad] companyName:', companyName, '| year:', year);

    if (!companyName) {
      showToast('No se ha seleccionado una empresa', 'warning');
      resolve(false);
      return;
    }

    api.configurarRutas(companyName, year || undefined).then(function(res) {
      console.log('[SeveridadAccidentalidad] Respuesta de configurarRutas:', res);

      if (res.success) {
        if (res.data.availableFiles) {
          availableFiles = res.data.availableFiles;
          populateYearFilter();
        }
        if (res.data.selectedFile) {
          updateYearLabels(res.data.selectedFile);
        }
        resolve(true);
      } else {
        console.log('[SeveridadAccidentalidad] ERROR en configurarRutas:', res.error);
        showToast(res.error && res.error.message || 'Error configurando rutas', 'error');
        resolve(false);
      }
    })['catch'](function(e) {
      console.log('[SeveridadAccidentalidad] EXCEPTION en configurarRutas:', e.message);
      showToast('Error de conexion: ' + e.message, 'error');
      resolve(false);
    });
  });
}

function populateYearFilter() {
  var select = getElement('yearFilter');
  if (!select) return;

  select.innerHTML = '';

  availableFiles.forEach(function(f) {
    var opt = document.createElement('option');
    opt.value = f.year || '';
    opt.textContent = f.year ? String(f.year) : f.fileName;
    if (f.year === currentYear) opt.selected = true;
    select.appendChild(opt);
  });

  if (!currentYear && availableFiles.length > 0) {
    currentYear = availableFiles[0].year || null;
    select.value = currentYear || '';
  }
}

function updateYearLabels(fileName) {
  var syncEl = getElement('syncFileName');
  if (syncEl) syncEl.textContent = fileName;

  var yearMatch = fileName && fileName.match(/(20\d{2})/);
  var year = yearMatch ? yearMatch[1] : String(new Date().getFullYear());
  currentYear = parseInt(year) || null;

  var kpiYearEl = getElement('kpiYearLabel');
  if (kpiYearEl) kpiYearEl.textContent = year;

  var methodFileEl = getElement('methodFileName');
  if (methodFileEl) methodFileEl.textContent = fileName;

  var methodSourcesEl = getElement('methodSources');
  if (methodSourcesEl) methodSourcesEl.textContent = fileName;
}
  
function cargarDatos() {
  console.log('[SeveridadAccidentalidad] ===== CARGAR DATOS =====');

  var chartContainer = getElement('chartContainer');
  if (chartContainer) {
    chartContainer.innerHTML = KairSkeleton.chartBars(12);
  }

  var year = currentYear || undefined;

  configurarRutas(year).then(function(rutasOk) {
    console.log('[SeveridadAccidentalidad] configurarRutas result:', rutasOk);
      
      if (!rutasOk) {
        console.log('[SeveridadAccidentalidad] ERROR: No se pudieron configurar las rutas');
        renderizar();
        return;
      }
      
      console.log('[SeveridadAccidentalidad] Llamando a api.leerIndicadores()...');
      console.log('[SeveridadAccidentalidad] api.leerIndicadores existe:', typeof api.leerIndicadores);
      
      api.leerIndicadores().then(function(res) {
        console.log('[SeveridadAccidentalidad] leerIndicadores response:', res);
        
        if (res.success) {
          console.log('[SeveridadAccidentalidad] indicadores cargados OK');
          indicadores = res.data;
        } else {
          console.log('[SeveridadAccidentalidad] ERROR leerIndicadores:', res.error);
          showToast(res.error && res.error.message || 'Error al leer indicadores', 'error');
          indicadores = null;
        }
        
        // diasCargados ya viene cargado desde leerIndicadores()
        renderizar();
      })['catch'](function(e) {
        showToast('Error de conexion: ' + e.message, 'error');
        console.error('[SeveridadAccidentalidad] Error cargando datos:', e);
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
  }
  
  function renderEmptyState() {
    var kpiSection = getElement('kpiSection');
    var chartContainer = getElement('chartContainer');
    
    if (kpiSection) kpiSection.style.display = 'none';
if (chartContainer) {
    chartContainer.innerHTML = '<div class="kair-empty"><svg class="kair-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg><h3>No hay datos disponibles</h3><p>No se encontró el archivo de indicadores para el año ' + (currentYear || 'seleccionado') + ' en la carpeta de esta empresa.</p></div>';
  }
  }
  
  function renderKPIs() {
    var sM = indicadores.severidadMensual;
    var config = indicadores.config || {};
    var meta = config.metaSeveridad || 0;
    
    // Calcular estadísticas con nueva fórmula: (Días Incap + Días Cargados) / Trabajadores × 100
    var totalDiasIncap = sM.reduce(function(s, f) { return s + (f.diasPerdidos || 0); }, 0);
    var totalDiasCarg = sM.reduce(function(s, f) { return s + (f.diasCargados || 0); }, 0);
    var totalDiasBase = totalDiasIncap + totalDiasCarg;
    
    var tNZ = sM.filter(function(s) { return s.trabajadores > 0; });
    var promTrab = tNZ.length ? Math.round(sM.reduce(function(s, f) { return s + f.trabajadores; }, 0) / tNZ.length) : 0;
    
    // Promedio IS anual (suma / 12)
    var promIS = sM.reduce(function(s, f) { return s + f.indiceSeveridad; }, 0) / 12;
    
    var exceden = sM.filter(function(s) { return s.indiceSeveridad > meta; }).length;
    
    // Encontrar el mes con peor índice
    var maxIS = 0;
    var mesPeor = '-';
    sM.forEach(function(s) {
      if (s.indiceSeveridad > maxIS) {
        maxIS = s.indiceSeveridad;
        mesPeor = s.mesLabel;
      }
    });
    
    // Meses sin AT (días perdidos = 0)
    var sinAT = sM.filter(function(s) { return s.diasPerdidos === 0 && s.diasCargados === 0; }).length;
    
    // Renderizar KPIs
    var kpiIS = getElement('kpiIS');
    if (kpiIS) {
      kpiIS.textContent = fmt(promIS, 4);
      kpiIS.className = 'kair-kpi-value ' + (promIS > meta ? 'danger' : 'success');
    }
    
    var kpiMeta = getElement('kpiMeta');
    if (kpiMeta) kpiMeta.textContent = fmt(meta, 4);
    
    var kpiDias = getElement('kpiDias');
    if (kpiDias) kpiDias.textContent = totalDiasIncap + totalDiasCarg;
    
    var kpiTrab = getElement('kpiTrab');
    if (kpiTrab) kpiTrab.textContent = promTrab;
    
    var kpiExceden = getElement('kpiExceden');
    if (kpiExceden) kpiExceden.textContent = exceden + '/' + sM.length;
    
    var kpiMesPeor = getElement('kpiMesPeor');
    if (kpiMesPeor) {
      kpiMesPeor.textContent = mesPeor + ' (' + fmt(maxIS, 4) + ')';
    }
    
    var kpiSinAT = getElement('kpiSinAT');
    if (kpiSinAT) {
      kpiSinAT.textContent = sinAT + '/' + sM.length;
      kpiSinAT.className = 'kair-kpi-value ' + (sinAT >= 6 ? 'success' : sinAT >= 3 ? 'warning' : 'danger');
    }
  }
  
  function renderChart() {
    var sM = indicadores.severidadMensual;
    var config = indicadores.config || {};
    var meta = config.metaSeveridad || 0;

    var container = getElement('chartContainer');
    if (!container) return;

    var containerWidth = container.offsetWidth || 800;
    var screenWidth = window.innerWidth;

    var baseWidth = screenWidth >= 2560 ? 1400 : screenWidth >= 1920 ? 1200 : 800;
    var W = Math.max(800, Math.min(containerWidth, baseWidth));
    var H = Math.max(320, Math.round(W * 0.4));

    var P = { t: 30, r: 40, b: 50, l: 60 };
    var cW = W - P.l - P.r;
    var cH = H - P.t - P.b;

    var maxV = Math.max(meta * 3, sM.reduce(function(m, d) { return Math.max(m, d.indiceSeveridad); }, 0), 0.01);

    var barWidth = cW / 12 * 0.6;
    var gap = cW / 12;

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;font-family:var(--kair-font)">';

    // Fondo
    svg += '<rect x="' + P.l + '" y="' + P.t + '" width="' + cW + '" height="' + cH + '" fill="#fafbfc" rx="4"/>';

    // Línea de meta
    if (meta > 0) {
      var targetY = P.t + cH - (meta / maxV) * cH;
      svg += '<line x1="' + P.l + '" y1="' + targetY + '" x2="' + (W - P.r) + '" y2="' + targetY + '" stroke="#dc3545" stroke-width="1.5" stroke-dasharray="6,4"/>';
      svg += '<text x="' + (W - P.r + 5) + '" y="' + (targetY + 4) + '" fill="#dc3545" font-size="10" font-weight="600">Meta: ' + meta + '</text>';
    }

    // Grid Y axis
    for (var i = 0; i <= 5; i++) {
      var y = P.t + (i / 5) * cH;
      svg += '<line x1="' + P.l + '" y1="' + y + '" x2="' + (W - P.r) + '" y2="' + y + '" stroke="#e9ecef" stroke-width="1"/>';
      svg += '<text x="' + (P.l - 5) + '" y="' + (y + 4) + '" fill="#adb5bd" font-size="10" text-anchor="end">' + (maxV * (5 - i) / 5).toFixed(1) + '</text>';
    }

    // Barras
    sM.forEach(function(month, i) {
      var x = P.l + i * gap + gap * 0.2;
      var barHeight = (month.indiceSeveridad / maxV) * cH;
      var y = P.t + cH - barHeight;
      var status = month.indiceSeveridad === 0 ? '#28a745' : month.indiceSeveridad <= meta ? '#28a745' : month.indiceSeveridad <= meta * 5 ? '#ffc107' : '#dc3545';

      svg += '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" fill="' + status + '" rx="3" opacity="0.85"/>';

      if (month.indiceSeveridad > 0) {
        svg += '<text x="' + (x + barWidth / 2) + '" y="' + (y - 4) + '" fill="#212529" font-size="9" font-weight="600" text-anchor="middle">' + month.indiceSeveridad.toFixed(1) + '</text>';
      }

      svg += '<text x="' + (x + barWidth / 2) + '" y="' + (P.t + cH + 16) + '" fill="#6c757d" font-size="11" font-weight="500" text-anchor="middle">' + month.mesLabel + '</text>';
    });

    // Label Y
    svg += '<text x="15" y="' + (P.t + cH / 2) + '" fill="#6c757d" font-size="11" text-anchor="middle" transform="rotate(-90 15 ' + (P.t + cH / 2) + ')">Índice de Severidad</text>';

    svg += '</svg>';

    container.innerHTML = svg;
  }
  
  function renderTabla() {
    var sM = indicadores.severidadMensual;
    var config = indicadores.config || {};
    var meta = config.metaSeveridad || 0;
    
    var tbody = getElement('tablaBody');
    if (!tbody) return;
    
    var html = '';
    
    sM.forEach(function(row, i) {
      var exceed = row.indiceSeveridad > meta;
      
      html += '<tr>';
      html += '<td>' + row.mesLabel + '</td>';
      html += '<td><span class="kair-editable" data-mes="' + row.mes + '" data-campo="diasPerdidos" tabindex="0">' + (row.diasPerdidos || 0) + '</span></td>';
      html += '<td><span class="kair-editable" data-mes="' + row.mes + '" data-campo="diasCargados" tabindex="0">' + (row.diasCargados || 0) + '</span></td>';
      html += '<td><span class="kair-editable" data-mes="' + row.mes + '" data-campo="trabajadores" tabindex="0">' + row.trabajadores + '</span></td>';
      html += '<td style="font-weight:700;color:' + (exceed ? '#dc3545' : '#28a745') + '">' + fmt(row.indiceSeveridad, 4) + '</td>';
      html += '<td style="color:#6c757d">' + fmt(meta, 4) + '</td>';
      html += '<td><span class="kair-badge-status ' + (exceed ? 'kair-badge-excede' : 'kair-badge-cumple') + '">' + (exceed ? 'EXCEDE' : 'CUMPLE') + '</span></td>';
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
    
    // Totales
    var totalDiasIncap = sM.reduce(function(s, f) { return s + (f.diasPerdidos || 0); }, 0);
    var totalDiasCarg = sM.reduce(function(s, f) { return s + (f.diasCargados || 0); }, 0);
    var tNZ = sM.filter(function(s) { return s.trabajadores > 0; });
    var promTrab = tNZ.length ? Math.round(sM.reduce(function(s, f) { return s + f.trabajadores; }, 0) / tNZ.length) : 0;
    var promIS = sM.reduce(function(s, f) { return s + f.indiceSeveridad; }, 0) / 12;
    
    var tablaFoot = getElement('tablaFoot');
    if (tablaFoot) {
      tablaFoot.innerHTML = '<tr><td>TOTAL</td><td>' + totalDiasIncap + '</td><td>' + totalDiasCarg + '</td><td>' + promTrab + '</td><td style="color:#174ea6">' + fmt(promIS, 4) + '</td><td>' + fmt(meta, 4) + '</td><td>-</td></tr>';
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
              showToast(campo === 'diasCargados' ? 'Días Cargados actualizados: ' + val : 'Excel actualizado: ' + campo + ' -> ' + val);
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

  function renderTargetCard() {
    var config = indicadores.config || {};
    var meta = config.metaSeveridad || 0;
    var sM = indicadores.severidadMensual;

    // Promedio IS anual (suma / 12)
    var promIS = sM.reduce(function(s, f) { return s + f.indiceSeveridad; }, 0) / 12;

    var targetValue = getElement('targetValue');
    if (targetValue) targetValue.textContent = fmt(meta, 4);

    var targetBadge = getElement('targetBadge');
    if (targetBadge) {
      targetBadge.textContent = 'Promedio: ' + fmt(promIS, 4);
      targetBadge.className = 'kair-target-badge ' + (promIS > meta ? 'danger' : promIS > 0 ? 'warning' : 'success');
    }
  }

  function renderMonthCards() {
    var container = getElement('monthCards');
    if (!container) return;

    var config = indicadores.config || {};
    var meta = config.metaSeveridad || 0;
    var sM = indicadores.severidadMensual;

    var html = '';

    sM.forEach(function(month) {
      var status = month.indiceSeveridad === 0 ? 'success' : month.indiceSeveridad <= meta ? 'success' : month.indiceSeveridad <= meta * 5 ? 'warning' : 'danger';
      var statusColor = status === 'success' ? '#28a745' : status === 'warning' ? '#856404' : '#dc3545';
      var statusLabel = status === 'success' ? 'Sin AT' : status === 'warning' ? 'Precaución' : 'Crítico';

      html += '<div class="kair-month-card" style="border-top: 3px solid ' + statusColor + '">';
      html += '<div class="kair-month-card-name">' + month.mesLabel + '</div>';
      html += '<div class="kair-month-card-value" style="color:' + statusColor + '">' + fmt(month.indiceSeveridad, 4) + '</div>';
      html += '<div class="kair-month-card-detail">' + (month.diasPerdidos || 0) + ' incap. + ' + (month.diasCargados || 0) + ' carg. / ' + month.trabajadores + ' trab.</div>';
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
    if (refFormula) refFormula.textContent = '(Días Incap. + Días Cargados) / Trabajadores × 100';

    var refFreq = getElement('refFreq');
    if (refFreq) refFreq.textContent = 'MENSUAL';

    var refTarget = getElement('refTarget');
    if (refTarget) refTarget.textContent = fmt(config.metaSeveridad || 0, 4);
  }

  // Init
  api = window.electronAPI && window.electronAPI.severidadAccidentalidad;
  
  if (!api) {
    var container = document.getElementById('app') || document.body;
    container.innerHTML = '<div class="kair-empty" style="padding: 3rem;"><h3>Error de Inicializacion</h3><p>electronAPI.severidadAccidentalidad no disponible.</p></div>';
    return;
  }
  
var btnRefrescar = getElement('btnRefrescar');
if (btnRefrescar) {
  btnRefrescar.addEventListener('click', cargarDatos);
}

var yearFilter = getElement('yearFilter');
if (yearFilter) {
  yearFilter.addEventListener('change', function() {
    var selectedYear = parseInt(this.value) || null;
    currentYear = selectedYear;
    cargarDatos();
  });
}

var btnClone = getElement('btnCloneYear');
if (btnClone) {
  btnClone.addEventListener('click', function() {
    if (!currentYear) {
      window.updateNotifier.show({ type: 'warning', title: 'Año no seleccionado', subtitle: 'Seleccione un año primero', autoClose: 4000 });
      return;
    }
    var nextYear = currentYear + 1;

    window.updateNotifier.show({
      type: 'warning',
      title: 'Duplicar Archivo',
      subtitle: '¿Duplicar INDICADORES ' + currentYear + ' para ' + nextYear + '?',
      message: 'Se conservarán metas y trabajadores. Datos de ejecución se limpiarán.',
      buttonText: 'Duplicar',
      onClick: function() {
        window.updateNotifier.remove(window.updateNotifier.currentToast);

        var currentFile = availableFiles.find(function(f) { return f.year === currentYear; });
        if (!currentFile) {
          window.updateNotifier.show({ type: 'error', title: 'Archivo no encontrado', subtitle: 'No se encontró el archivo actual', autoClose: 5000 });
          return;
        }

        window.updateNotifier.show({ type: 'info', title: 'Duplicando Archivo', subtitle: 'Creando INDICADORES ' + nextYear + '.xlsx...', progress: { percent: 0 }, autoClose: 0 });

        window.electronAPI.duplicateIndicadoresFile({
          currentFilePath: currentFile.filePath,
          newYear: nextYear
        }).then(function(result) {
          if (result.success) {
            window.updateNotifier.show({ type: 'success', title: 'Archivo Duplicado', subtitle: result.newFileName, message: 'Metas y trabajadores conservados. Datos de ejecución limpiados.', autoClose: 5000 });
            currentYear = nextYear;
            cargarDatos();
          } else {
            window.updateNotifier.show({ type: 'error', title: 'Error al Duplicar', subtitle: result.error && result.error.message || 'Error desconocido', autoClose: 6000 });
          }
        })['catch'](function(e) {
          window.updateNotifier.show({ type: 'error', title: 'Error Inesperado', subtitle: e.message, autoClose: 6000 });
        });
      },
      autoClose: 0
    });
  });
}

  var btnVolver = getElement('btnVolver');
  if (btnVolver) {
    btnVolver.addEventListener('click', function() {
      window.parent.postMessage({ type: 'back-to-module-request' }, '*');
    });
  }
  
  setTimeout(cargarDatos, 100);
  
})();
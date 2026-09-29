// ============================================================
// K+AIR SG-SST - incidencia-enfermedad-laboral.js
// Lógica del renderer para Incidencia de Enfermedad Laboral
// Submódulo 3.3.5
// ============================================================

(function() {
  'use strict';


var api;
var indicadores;
var companyName;
var currentYear = null;
var availableFiles = [];
var chartInstance = null;
var pendingChanges = {};

  var MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

if (typeof window !== 'undefined' && window.electronAPI) {
  api = window.electronAPI.incidencia;
}

  function getElement(id) {
    var el = document.getElementById(id);
    if (el) return el;
    el = document.querySelector('#' + id);
    return el;
  }

  function tok(name, fallback) {
    var host = document.querySelector('.incidencia-container') || document.documentElement;
    return getComputedStyle(host).getPropertyValue(name).trim() || fallback;
  }

  function palette() {
    return {
      bg:          tok('--inc-bg','#fbfcfb'),
      card:        tok('--inc-card','#ffffff'),
      primary:     tok('--inc-primary','#2057b8'),
      primarySoft: tok('--inc-primary-soft','#eaf1fb'),
      success:     tok('--inc-success','#1bb888'),
      warning:     tok('--inc-warning','#e7a224'),
      danger:      tok('--inc-danger','#da5563'),
      text:        tok('--inc-text','#14213d'),
      textSec:     tok('--inc-text-sec','#748096'),
      textMuted:   tok('--inc-text-muted','#aab1bd'),
      border:      tok('--inc-border','#e8ebee'),
      borderLight: tok('--inc-border-light','#f3f4f6')
    };
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

  function toNum(val) {
    if (val === undefined || val === null || isNaN(val)) return 0;
    var n = Number(val);
    return isNaN(n) ? 0 : n;
  }

  function fmt(n, d) {
    d = d === undefined ? 2 : d;
    if (n === undefined || n === null || isNaN(n)) return '0';
    return Number(n).toFixed(d);
  }

  function display(val) {
    if (val === undefined || val === null || val === '') return '\u2014';
    return String(val);
  }

function getCompanyName() {
  var params = new URLSearchParams(window.location.search);
  return params.get('company') || localStorage.getItem('selectedCompany') || '';
}

function updateHeaderContext() {
  var companyText = document.getElementById('header-company-text');
  if (companyText) {
    companyText.textContent = companyName || '\u2014';
  }
}

// ==================== STATUS BADGE ====================
  function getStatusBadge(valor, meta) {
    valor = toNum(valor);
    meta = toNum(meta);
    var C = palette();

    if (isNaN(valor) || isNaN(meta)) {
      return { label: 'SIN DATOS', color: C.textMuted };
    }
    if (meta === 0) {
      return { label: 'CUMPLE', color: C.success };
    }
    if (valor > meta) {
      return { label: 'EXCEDE', color: C.danger };
    }
    return { label: 'CUMPLE', color: C.success };
  }

  function getValueColor(valor, meta) {
    valor = toNum(valor);
    meta = toNum(meta);
    var C = palette();

    if (meta > 0 && valor > meta) return C.danger;
    if (valor === 0) return C.success;
    return C.primary;
  }

  // ==================== CALCULAR INCIDENCIA ====================
  function calcularIncidencia(casosNuevosEL, trabajadores) {
    var c = toNum(casosNuevosEL);
    var t = toNum(trabajadores);
    if (t === 0) return 0;
    return Math.round((c / t) * 100000 * 100) / 100;
  }

  // ==================== CHART ====================
  function renderChart(meses, valores, meta, promedioAnual) {
    var ctx = getElement('incidenciaChart');
    if (!ctx) return;

    var ctx2d = ctx.getContext('2d');

    if (chartInstance) {
      chartInstance.destroy();
    }

    var chartHeight = ctx.height || 300;
    var C = palette();
    var isDark = (document.documentElement.getAttribute('data-theme') || '').indexOf('dark') === 0;
    var gradBlue = ctx2d.createLinearGradient(0, 0, 0, chartHeight);
    gradBlue.addColorStop(0, isDark ? '#8fbfff' : '#60a5fa');
    gradBlue.addColorStop(1, isDark ? '#6ea8fe' : '#2563eb');
    var gradGreen = ctx2d.createLinearGradient(0, 0, 0, chartHeight);
    gradGreen.addColorStop(0, isDark ? '#7ee8b8' : '#4ade80');
    gradGreen.addColorStop(1, isDark ? '#3ecf9a' : '#1bb888');

    var colores = valores.map(function(v) {
      return toNum(v) > 0 ? gradBlue : gradGreen;
    });

    var metaZonePlugin = {
      id: 'metaZone',
      beforeDatasetsDraw: function(chart) {
        if (meta <= 0) return;
        var yScale = chart.scales.y;
        var metaY = yScale.getPixelForValue(meta);
        var area = chart.chartArea;
        var c = chart.ctx;
        c.save();
        c.fillStyle = isDark ? 'rgba(62,207,154,0.06)' : 'rgba(27,184,136,0.04)';
        c.fillRect(area.left, metaY, area.width, area.bottom - metaY);
        c.fillStyle = isDark ? 'rgba(229,106,118,0.06)' : 'rgba(218,85,99,0.04)';
        c.fillRect(area.left, area.top, area.width, metaY - area.top);
        c.restore();
      }
    };

    var barLabelsPlugin = {
      id: 'barLabels',
      afterDatasetsDraw: function(chart) {
        var c = chart.ctx;
        var meta0 = chart.getDatasetMeta(0);
        meta0.data.forEach(function(bar, i) {
          var val = chart.data.datasets[0].data[i];
          if (val > 0) {
            c.save();
            c.fillStyle = C.text;
            c.font = 'bold 10px sans-serif';
            c.textAlign = 'center';
            c.fillText(val.toFixed(1), bar.x, bar.y - 6);
            c.restore();
          }
        });
      }
    };

    var promedioLinePlugin = {
      id: 'promedioLine',
      afterDatasetsDraw: function(chart) {
        if (promedioAnual <= 0) return;
        var yScale = chart.scales.y;
        var y = yScale.getPixelForValue(promedioAnual);
        var c = chart.ctx;
        c.save();
        c.strokeStyle = isDark ? '#c4a0fa' : '#7c3aed';
        c.setLineDash([8, 4]);
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(chart.chartArea.left, y);
        c.lineTo(chart.chartArea.right, y);
        c.stroke();
        c.fillStyle = isDark ? '#c4a0fa' : '#7c3aed';
        c.font = 'bold 11px sans-serif';
        c.fillText('Promedio: ' + promedioAnual.toFixed(1), chart.chartArea.right - 110, y - 6);
        c.restore();
      }
    };

    var metaLinePlugin = {
      id: 'metaLine',
      afterDatasetsDraw: function(chart) {
        if (meta <= 0) return;
        var yScale = chart.scales.y;
        var y = yScale.getPixelForValue(meta);
        var c = chart.ctx;
        c.save();
        c.strokeStyle = isDark ? '#3ecf9a' : '#1bb888';
        c.setLineDash([6, 4]);
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(chart.chartArea.left, y);
        c.lineTo(chart.chartArea.right, y);
        c.stroke();
        c.fillStyle = isDark ? '#3ecf9a' : '#1bb888';
        c.font = 'bold 11px sans-serif';
        c.fillText('Meta: ' + meta, chart.chartArea.right - 80, y - 6);
        c.restore();
      }
    };

    var allPlugins = [metaZonePlugin, barLabelsPlugin, promedioLinePlugin, metaLinePlugin];

    if (typeof Chart !== 'undefined') {
      Chart.defaults.color = isDark ? '#98a6bf' : C.textSec;
      Chart.defaults.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,33,61,0.08)';
      Chart.defaults.font.family = "'DM Sans', system-ui, -apple-system, sans-serif";

      chartInstance = new Chart(ctx2d, {
        type: 'bar',
        data: {
          labels: meses,
          datasets: [{
            label: 'Incidencia (x100.000)',
            data: valores,
            backgroundColor: colores,
            borderRadius: 4,
            maxBarThickness: 36,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 800,
            easing: 'easeOutQuart',
            delay: function(ctx) {
              if (ctx.type === 'data' && ctx.mode === 'default') {
                return ctx.dataIndex * 60;
              }
              return 0;
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: C.card,
              titleColor: C.text,
              bodyColor: C.textSec,
              borderColor: C.border,
              borderWidth: 1,
              cornerRadius: 6,
              padding: 10,
              displayColors: false,
              callbacks: {
                title: function(items) {
                  return items[0].label;
                },
                label: function(ctx) {
                  var val = ctx.parsed.y;
                  return 'Incidencia: ' + val.toFixed(2) + ' (x100.000)';
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 11, weight: '500' }, color: C.textMuted }
            },
            y: {
              beginAtZero: true,
              grid: { color: C.borderLight },
              ticks: {
                font: { size: 11 },
                color: C.textMuted,
                callback: function(v) { return v.toFixed(0); },
                padding: 6
              }
            }
          }
        },
        plugins: allPlugins
      });
    } else {
      renderFallbackChart(ctx, meses, valores, meta, promedioAnual);
    }
  }

  function renderFallbackChart(canvas, meses, valores, meta, promedioAnual) {
    canvas.style.display = 'none';
    var container = canvas.parentNode;
    var C = palette();

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '220');
    svg.setAttribute('viewBox', '0 0 800 220');
    svg.style.display = 'block';

    var width = 800;
    var height = 220;
    var padding = { top: 20, right: 20, bottom: 40, left: 50 };
    var chartWidth = width - padding.left - padding.right;
    var chartHeight = height - padding.top - padding.bottom;

    var maxVal = Math.max.apply(null, valores.concat([meta, promedioAnual || 0])) || 10;

    for (var i = 0; i <= 4; i++) {
      var y = padding.top + (chartHeight / 4) * i;
      var val = (maxVal / 4 * (4 - i)).toFixed(1);

      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', padding.left);
      line.setAttribute('y1', y);
      line.setAttribute('x2', width - padding.right);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', C.border);
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);

      var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', padding.left - 10);
      text.setAttribute('y', y + 4);
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('fill', C.textSec);
      text.setAttribute('font-size', '11');
      text.textContent = val;
      svg.appendChild(text);
    }

    var barWidth = chartWidth / meses.length;
    var metaY = padding.top + chartHeight * (1 - meta / maxVal);

    valores.forEach(function(val, idx) {
      var valNum = toNum(val);
      var barHeight = (valNum / maxVal) * chartHeight;
      var x = padding.left + barWidth * idx + barWidth * 0.1;
      var barW = barWidth * 0.8;

      var color = valNum > 0 ? C.primary : C.success;

      var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', padding.top + chartHeight - barHeight);
      rect.setAttribute('width', barW);
      rect.setAttribute('height', barHeight);
      rect.setAttribute('fill', color);
      rect.setAttribute('rx', '3');
      svg.appendChild(rect);

      var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', x + barW / 2);
      label.setAttribute('y', height - 10);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', C.textSec);
      label.setAttribute('font-size', '10');
      label.textContent = meses[idx];
      svg.appendChild(label);
    });

    if (promedioAnual > 0) {
      var promY = padding.top + chartHeight * (1 - promedioAnual / maxVal);
      var promLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      promLine.setAttribute('x1', padding.left);
      promLine.setAttribute('y1', promY);
      promLine.setAttribute('x2', width - padding.right);
      promLine.setAttribute('y2', promY);
      promLine.setAttribute('stroke', '#7c3aed');
      promLine.setAttribute('stroke-width', '2');
      promLine.setAttribute('stroke-dasharray', '8,4');
      svg.appendChild(promLine);
    }

    if (meta > 0) {
      var metaLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      metaLine.setAttribute('x1', padding.left);
      metaLine.setAttribute('y1', metaY);
      metaLine.setAttribute('x2', width - padding.right);
      metaLine.setAttribute('y2', metaY);
      metaLine.setAttribute('stroke', C.success);
      metaLine.setAttribute('stroke-width', '2');
      metaLine.setAttribute('stroke-dasharray', '6,4');
      svg.appendChild(metaLine);
    }

    container.appendChild(svg);
  }

// ==================== CONFIGURAR RUTAS ====================
function configurarRutas(year) {
  return new Promise(function(resolve, reject) {
    companyName = getCompanyName();

    if (!companyName) {
      showToast('No se ha seleccionado una empresa', 'warning');
      resolve(false);
      return;
    }

    if (api && api.configurarRutas) {
      api.configurarRutas(companyName, year || undefined).then(function(res) {

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
          console.error('[IncidenciaEL] ERROR en configurarRutas:', res.error);
          showToast(res.error && res.error.message || 'Error configurando rutas', 'error');
          resolve(false);
        }
      })['catch'](function(e) {
        console.error('[IncidenciaEL] EXCEPTION en configurarRutas:', e.message);
        showToast('Error de conexion: ' + e.message, 'error');
        resolve(false);
      });
    } else {
      resolve(true);
    }
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

  var methodFileEl = getElement('methodFileName');
  if (methodFileEl) methodFileEl.textContent = fileName;

  var methodSourcesEl = getElement('methodSources');
  if (methodSourcesEl) methodSourcesEl.textContent = fileName;
}

// ==================== CARGAR DATOS ====================
function cargarDatos() {

  showLoading(true);
  pendingChanges = {};

  var year = currentYear || undefined;

  configurarRutas(year).then(function(rutasOk) {
    if (!rutasOk) {
      renderEmptyState();
      return;
    }

    if (api && api.leerIndicadores) {
      api.leerIndicadores().then(function(res) {

        if (res.success) {
          indicadores = res.data;
        } else {
          showToast(res.error && res.error.message || 'Error al leer indicadores', 'error');
          indicadores = null;
        }

        renderizar();
      })['catch'](function(e) {
        indicadores = generateDemoData();
        renderizar();
      });
    } else {
      indicadores = generateDemoData();
      renderizar();
    }
  });
}

  // ==================== DATOS DEMO ====================
function generateDemoData() {
  return {
    incidenciaMensual: MESES.map(function(m, i) {
      return {
        mes: i + 1,
        mesLabel: m,
        incidenciaEL: 0,
        trabajadores: 150
      };
    }),
    meta: 0,
    totalCasosEL: 0,
    totalTrabajadores: 1800,
    promedioTrabajadores: 150
  };
}

function renderEmptyState() {
  showLoading(false);
  var kpiSection = getElement('kpiSection');
  var metaSection = getElement('metaSection');
  var chartSection = getElement('chartSection');
  var tableSection = getElement('tableSection');
  var methodologySection = getElement('methodologySection');

  if (kpiSection) kpiSection.style.display = 'none';
  if (metaSection) metaSection.style.display = 'none';
  if (chartSection) chartSection.style.display = 'none';
  if (tableSection) tableSection.style.display = 'none';
  if (methodologySection) methodologySection.style.display = 'none';

  var errorSection = getElement('errorSection');
  if (errorSection) {
    errorSection.style.display = 'flex';
    var msgEl = getElement('errorMessage');
    if (msgEl) msgEl.textContent = 'No se encontro el archivo de indicadores para el ano ' + (currentYear || 'seleccionado');
  }
}

  // ==================== RENDERIZAR ====================
function renderizar() {
  if (!indicadores) {
    renderEmptyState();
    return;
  }

    showLoading(false);

    // Extraer datos de incidencia del excel
    var incidenciaMensualBackend = indicadores.incidenciaMensual || [];
    var meta = toNum(indicadores.meta) || 0;
    var C = palette();

    // Construir incidencia mensual desde los datos del backend
    var incidenciaMensual = [];
    var totalCasosEL = 0;
    var totalTrab = 0;
    var countMeses = 0;

    incidenciaMensualBackend.forEach(function(row) {
      var trabajadores = toNum(row.trabajadores);
      var casosNuevosEL = toNum(row.incidenciaEL);

      var incidencia = calcularIncidencia(casosNuevosEL, trabajadores);

      incidenciaMensual.push({
        mes: row.mes,
        mesLabel: row.mesLabel,
        casosNuevosEL: casosNuevosEL,
        trabajadores: trabajadores,
        incidencia: incidencia
      });

      if (trabajadores > 0) {
        totalCasosEL += casosNuevosEL;
        totalTrab += trabajadores;
        countMeses++;
      }
    });

    // Si tenemos datos mensuales de incidencia del Excel, usarlos directamente
    // De lo contrario, calcular desde los datos disponibles
    var incidenciaPromedio = countMeses > 0 ? (totalCasosEL / (totalTrab / countMeses)) * 100000 : 0;
    incidenciaPromedio = Math.round(incidenciaPromedio * 100) / 100;

    var trabajadoresProm = countMeses > 0 ? Math.round(totalTrab / countMeses) : 0;

    var estado = getStatusBadge(incidenciaPromedio, meta);

    // Actualizar KPIs
    var kpiIncidencia = getElement('kpiIncidencia');
    var kpiTotalEL = getElement('kpiTotalEL');
    var kpiTrabProm = getElement('kpiTrabProm');
    var kpiMeta = getElement('kpiMeta');
    var kpiEstado = getElement('kpiEstado');
    var metaDisplay = getElement('metaDisplay');
    var promedioBadge = getElement('promedioBadge');

    if (kpiIncidencia) {
      kpiIncidencia.textContent = fmt(incidenciaPromedio, 2);
      kpiIncidencia.style.color = getValueColor(incidenciaPromedio, meta);
    }
    if (kpiTotalEL) {
      kpiTotalEL.textContent = totalCasosEL;
      kpiTotalEL.style.color = totalCasosEL > 0 ? C.warning : C.success;
      kpiTotalEL.className = 'kair-kpi-value ' + (totalCasosEL > 0 ? 'warning' : 'success');
    }
    if (kpiTrabProm) {
      kpiTrabProm.textContent = trabajadoresProm;
    }
    if (kpiMeta) {
      kpiMeta.textContent = meta;
    }
    if (kpiEstado) {
      kpiEstado.textContent = estado.label;
      kpiEstado.style.background = estado.color;
    }
    if (metaDisplay) {
      metaDisplay.textContent = meta;
    }
    if (promedioBadge) {
      promedioBadge.textContent = 'Incidencia: ' + fmt(incidenciaPromedio, 2);
      var isOk = getValueColor(incidenciaPromedio, meta) !== C.danger;
      promedioBadge.style.background = isOk ? C.successSoft : C.dangerSoft;
      promedioBadge.style.color = isOk ? C.success : C.danger;
    }

    // Actualizar metodología
    var metFrecuencia = getElement('metFrecuencia');
    if (metFrecuencia) {
      metFrecuencia.textContent = 'Mensual / Anual';
    }

    // Mostrar secciones
    var kpiSection = getElement('kpiSection');
    var metaSection = getElement('metaSection');
    var chartSection = getElement('chartSection');
    var tableSection = getElement('tableSection');
    var methodologySection = getElement('methodologySection');

    if (kpiSection) kpiSection.style.display = 'grid';
    if (metaSection) metaSection.style.display = 'flex';
    // '' (no 'block'): deja que el CSS decida el display para que en maximizada
    // el .inc-duo pueda ponerlas en flex (2 columnas) sin que el estilo en linea lo pise.
    if (chartSection) chartSection.style.display = '';
    if (tableSection) tableSection.style.display = '';
    if (methodologySection) methodologySection.style.display = 'block';

    // Renderizar tabla
    try {
      renderizarTabla(incidenciaMensual, meta);
    } catch (e) {
      console.error('[IncidenciaEL] Error renderizando tabla:', e);
    }

    // Renderizar gráfico
    try {
      var valores = incidenciaMensual.map(function(row) { return row.incidencia; });
      renderChart(MESES, valores, meta, incidenciaPromedio);

      var chartSummary = getElement('chartSummary');
      if (chartSummary) {
        chartSummary.textContent = 'Incidencia promedio anual: ' + fmt(incidenciaPromedio, 2) + ' por 100.000 trabajadores.';
        chartSummary.style.display = 'block';
      }
    } catch (e) {
      console.error('[IncidenciaEL] Error renderizando chart:', e);
    }
  }

  // ==================== RENDERIZAR TABLA ====================
  function renderizarTabla(incidenciaMensual, meta) {
    var tbody = getElement('tableBody');
    var tfoot = getElement('tableFoot');
    if (!tbody) return;
    var C = palette();

    var html = '';
    var totalCasosEL = 0;
    var totalTrab = 0;
    var totalIncidencia = 0;
    var countMeses = 0;

    incidenciaMensual.forEach(function(row) {
      var estado = getStatusBadge(row.incidencia, meta);
      var pending = pendingChanges[row.mes];

      var casosNuevosELDisplay = pending && pending.casosNuevosEL !== undefined ? pending.casosNuevosEL : row.casosNuevosEL;
      var trabDisplay = pending && pending.trabajadores !== undefined ? pending.trabajadores : row.trabajadores;
      var incidenciaCalc = calcularIncidencia(casosNuevosELDisplay, trabDisplay);

      totalCasosEL += toNum(casosNuevosELDisplay);
      totalTrab += toNum(trabDisplay);
      if (toNum(trabDisplay) > 0) {
        totalIncidencia += incidenciaCalc;
        countMeses++;
      }

      var estadoCalc = getStatusBadge(incidenciaCalc, meta);

      html += '<tr>';
      html += '<td>' + row.mesLabel + '</td>';
      html += '<td><span class="kair-editable" data-mes="' + row.mes + '" data-campo="casosNuevosEL" tabindex="0">' + toNum(casosNuevosELDisplay) + '</span></td>';
      html += '<td><span class="kair-cell-value" style="color:' + C.primary + ';font-weight:600">' + toNum(trabDisplay) + '</span></td>';
      html += '<td style="font-weight:700;color:' + getValueColor(incidenciaCalc, meta) + '">' + fmt(incidenciaCalc, 2) + '</td>';
      html += '<td style="color:' + C.textSec + '">' + meta + '</td>';
      html += '<td><span class="kair-status-badge" style="background:' + estadoCalc.color + '">' + estadoCalc.label + '</span></td>';
      html += '</tr>';
    });

    tbody.innerHTML = html;

    // Iniciar listeners de edición inline
    iniciarEdicionInline();

    // Footer con totales
    if (tfoot) {
      var incidenciaTotal = totalTrab > 0 ? ((totalCasosEL / (totalTrab / (countMeses || 1))) * 100000) : 0;
      incidenciaTotal = Math.round(incidenciaTotal * 100) / 100;
      tfoot.innerHTML = '<tr class="kair-table-total">'
        + '<td>TOTAL</td>'
        + '<td style="color:' + C.warning + ';font-weight:700">' + totalCasosEL + '</td>'
        + '<td style="color:' + C.primary + ';font-weight:700">' + (countMeses > 0 ? Math.round(totalTrab / countMeses) : 0) + '</td>'
        + '<td style="color:' + C.primary + ';font-weight:700">' + fmt(incidenciaTotal, 2) + '</td>'
        + '<td>' + meta + '</td>'
        + '<td>-</td>'
        + '</tr>';
    }
  }

  // ==================== EDICIÓN INLINE ====================
  function iniciarEdicionInline() {
    var editables = document.querySelectorAll('.incidencia-container .kair-editable');
    editables.forEach(function(el) {
      el.addEventListener('click', function() {
        iniciarCampoEdicion(this);
      });
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          iniciarCampoEdicion(this);
        }
      });
    });
  }

  function iniciarCampoEdicion(el) {
    var mes = parseInt(el.getAttribute('data-mes'));
    var campo = el.getAttribute('data-campo');
    var valorActual = toNum(el.textContent);

    var input = document.createElement('input');
    input.type = 'number';
    input.className = 'kair-input';
    input.value = valorActual;
    input.min = '0';

    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();

    function commit() {
      var nuevoValor = toNum(input.value);
      el.textContent = nuevoValor;

      // Guardar cambio pendiente
      if (!pendingChanges[mes]) pendingChanges[mes] = {};
      pendingChanges[mes][campo] = nuevoValor;

      // Persistir en Excel
      persistirCambio(mes, campo, nuevoValor);
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        el.textContent = valorActual;
      }
    });
  }

  function persistirCambio(mes, campo, valor) {
    if (!api || !api.escribirEnExcel) {
      showToast('API de escritura no disponible', 'error');
      return;
    }

    var campos = {};
    if (campo === 'casosNuevosEL') {
      campos.incidenciaEL = valor;
    }

    api.escribirEnExcel(mes, campos).then(function(res) {
      if (res.success) {
        showToast('Mes ' + MESES[mes - 1] + ' actualizado', 'success');
        // Recalcular KPIs después del cambio
        recalcularDespuesEdicion();
      } else {
        showToast('Error guardando: ' + (res.error && res.error.message || 'Error'), 'error');
      }
    })['catch'](function(e) {
      showToast('Error de conexion: ' + e.message, 'error');
    });
  }

  function recalcularDespuesEdicion() {
    // Recalcular totales desde pendingChanges
    if (!indicadores || !indicadores.incidenciaMensual) return;

    var pM = indicadores.incidenciaMensual;
    var totalCasosEL = 0;
    var totalTrab = 0;
    var countMeses = 0;

    pM.forEach(function(row) {
      var pending = pendingChanges[row.mes];
      var casosNuevosEL = pending && pending.casosNuevosEL !== undefined ? pending.casosNuevosEL : toNum(row.incidenciaEL);
      var trabajadores = toNum(row.trabajadores);

      totalCasosEL += casosNuevosEL;
      totalTrab += trabajadores;
      if (trabajadores > 0) countMeses++;
    });

    var incidenciaPromedio = countMeses > 0 ? (totalCasosEL / (totalTrab / countMeses)) * 100000 : 0;
    incidenciaPromedio = Math.round(incidenciaPromedio * 100) / 100;

    var kpiIncidencia = getElement('kpiIncidencia');
    if (kpiIncidencia) {
      kpiIncidencia.textContent = fmt(incidenciaPromedio, 2);
    }

    var kpiTotalEL = getElement('kpiTotalEL');
    if (kpiTotalEL) {
      kpiTotalEL.textContent = totalCasosEL;
    }
  }

  // ==================== SHOW/HIDE ====================
  function showLoading(show) {
    var loading = getElement('loadingSection');
    if (loading) loading.style.display = show ? 'flex' : 'none';
    var error = getElement('errorSection');
    if (error) error.style.display = 'none';
  }

  function showError(msg) {
    var loading = getElement('loadingSection');
    if (loading) loading.style.display = 'none';
    var error = getElement('errorSection');
    if (error) error.style.display = 'flex';
    var msgEl = getElement('errorMessage');
    if (msgEl) msgEl.textContent = msg || 'Error al cargar los datos';
  }

  // ==================== INICIALIZAR ====================
function init() {

  if (window.electronAPI) {
    api = window.electronAPI.incidencia;
  }

  var btnBack = getElement('btn-back-module');
  var btnRefrescar = getElement('btnRefrescar');

  if (btnBack) {
    btnBack.onclick = function() {
      if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({ type: 'back-to-module-request' }, '*');
      } else {
        window.history.back();
      }
    };
  }

  if (btnRefrescar) {
    btnRefrescar.onclick = function() {
      cargarDatos();
    };
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
      showToast('Seleccione un ano primero', 'warning');
      return;
    }
    var nextYear = currentYear + 1;

    if (window.updateNotifier) {
      window.updateNotifier.show({
        type: 'warning',
        title: 'Duplicar Archivo',
        subtitle: 'Duplicar INDICADORES ' + currentYear + ' para ' + nextYear + '?',
        message: 'Se conservaran metas y trabajadores. Datos de ejecucion se limpiaran.',
        buttonText: 'Duplicar',
        onClick: function() {
          window.updateNotifier.remove(window.updateNotifier.currentToast);

          var currentFile = availableFiles.find(function(f) { return f.year === currentYear; });
          if (!currentFile) {
            window.updateNotifier.show({ type: 'error', title: 'Archivo no encontrado', subtitle: 'No se encontro el archivo actual', autoClose: 5000 });
            return;
          }

          window.updateNotifier.show({ type: 'info', title: 'Duplicando Archivo', subtitle: 'Creando INDICADORES ' + nextYear + '.xlsx...', progress: { percent: 0 }, autoClose: 0 });

          window.electronAPI.duplicateIndicadoresFile({
            currentFilePath: currentFile.filePath,
            newYear: nextYear
          }).then(function(result) {
            if (result.success) {
              window.updateNotifier.show({ type: 'success', title: 'Archivo Duplicado', subtitle: result.newFileName, message: 'Metas y trabajadores conservados. Datos de ejecucion limpiados.', autoClose: 5000 });
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
    } else {
      showToast('Duplicar ano: ' + currentYear + ' -> ' + nextYear, 'info');
    }
  });
}

  updateHeaderContext();

  // Resize del gráfico: UN solo handler guardado en window (no acumula al reabrir)
  if (window.__incResizeHandler) {
    window.removeEventListener('resize', window.__incResizeHandler);
  }
  window.__incResizeHandler = function() {
    if (chartInstance) chartInstance.resize();
  };
  window.addEventListener('resize', window.__incResizeHandler);

  cargarDatos();
}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

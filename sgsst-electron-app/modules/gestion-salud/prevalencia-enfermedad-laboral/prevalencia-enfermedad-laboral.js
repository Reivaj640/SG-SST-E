// ============================================================
// K+AIR SG-SST - prevalencia-enfermedad-laboral.js
// Lógica del renderer para Prevalencia de Enfermedad Laboral
// Submódulo 3.3.4
// ============================================================

(function() {
  'use strict';

  console.log('[PrevalenciaEL] Módulo JS cargado');

var api;
var indicadores;
var companyName;
var currentYear = null;
var availableFiles = [];
var chartInstance = null;
var pendingChanges = {};

  var MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

if (typeof window !== 'undefined' && window.electronAPI) {
  api = window.electronAPI.prevalencia;
  console.log('[PrevalenciaEL] electronAPI asignada:', !!api);
}

  function getElement(id) {
    var el = document.getElementById(id);
    if (el) return el;
    el = document.querySelector('#' + id);
    if (el) return el;
    el = document.querySelector('[id*="' + id + '"]');
    return el;
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

    if (isNaN(valor) || isNaN(meta)) {
      return { label: 'SIN DATOS', color: '#6b7280' };
    }
    if (meta === 0 && valor === 0) {
      return { label: 'CUMPLE', color: '#16a34a' };
    }
    if (meta === 0) {
      return { label: 'CUMPLE', color: '#16a34a' };
    }
    if (valor > meta) {
      return { label: 'EXCEDE', color: '#dc2626' };
    }
    return { label: 'CUMPLE', color: '#16a34a' };
  }

  function getValueColor(valor, meta) {
    valor = toNum(valor);
    meta = toNum(meta);

    if (meta > 0 && valor > meta) return '#dc2626';
    if (valor === 0) return '#16a34a';
    return '#2563eb';
  }

  // ==================== CALCULAR PREVALENCIA ====================
  function calcularPrevalencia(casosEL, trabajadores) {
    var c = toNum(casosEL);
    var t = toNum(trabajadores);
    if (t === 0) return 0;
    return Math.round((c / t) * 100000 * 100) / 100;
  }

  // ==================== CHART ====================
  function renderChart(meses, valores, meta, promedioAnual) {
    var ctx = getElement('prevalenciaChart');
    if (!ctx) return;

    var ctx2d = ctx.getContext('2d');

    if (chartInstance) {
      chartInstance.destroy();
    }

    var chartHeight = ctx.height || 300;
    var gradBlue = ctx2d.createLinearGradient(0, 0, 0, chartHeight);
    gradBlue.addColorStop(0, '#60a5fa');
    gradBlue.addColorStop(1, '#2563eb');
    var gradGreen = ctx2d.createLinearGradient(0, 0, 0, chartHeight);
    gradGreen.addColorStop(0, '#4ade80');
    gradGreen.addColorStop(1, '#16a34a');

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
        c.fillStyle = 'rgba(40, 167, 69, 0.04)';
        c.fillRect(area.left, metaY, area.width, area.bottom - metaY);
        c.fillStyle = 'rgba(220, 53, 69, 0.04)';
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
            c.fillStyle = '#374151';
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
        c.strokeStyle = '#7c3aed';
        c.setLineDash([8, 4]);
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(chart.chartArea.left, y);
        c.lineTo(chart.chartArea.right, y);
        c.stroke();
        c.fillStyle = '#7c3aed';
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
        c.strokeStyle = '#28a745';
        c.setLineDash([6, 4]);
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(chart.chartArea.left, y);
        c.lineTo(chart.chartArea.right, y);
        c.stroke();
        c.fillStyle = '#28a745';
        c.font = 'bold 11px sans-serif';
        c.fillText('Meta: ' + meta, chart.chartArea.right - 80, y - 6);
        c.restore();
      }
    };

    var allPlugins = [metaZonePlugin, barLabelsPlugin, promedioLinePlugin, metaLinePlugin];

    if (typeof Chart !== 'undefined') {
      chartInstance = new Chart(ctx2d, {
        type: 'bar',
        data: {
          labels: meses,
          datasets: [{
            label: 'Prevalencia (x100.000)',
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
              backgroundColor: '#fff',
              titleColor: '#111827',
              bodyColor: '#374151',
              borderColor: '#e5e7eb',
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
                  return 'Prevalencia: ' + val.toFixed(2) + ' (x100.000)';
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 11, weight: '500' }, color: '#6b7280' }
            },
            y: {
              beginAtZero: true,
              grid: { color: '#f3f4f6' },
              ticks: {
                font: { size: 11 },
                color: '#6b7280',
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
      line.setAttribute('stroke', '#e5e7eb');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);

      var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', padding.left - 10);
      text.setAttribute('y', y + 4);
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('fill', '#6c757d');
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

      var color = valNum > 0 ? '#2563eb' : '#16a34a';

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
      label.setAttribute('fill', '#6c757d');
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
      metaLine.setAttribute('stroke', '#28a745');
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
    console.log('[PrevalenciaEL] ===== CONFIGURAR RUTAS =====');
    console.log('[PrevalenciaEL] companyName:', companyName, '| year:', year);

    if (!companyName) {
      showToast('No se ha seleccionado una empresa', 'warning');
      resolve(false);
      return;
    }

    if (api && api.configurarRutas) {
      api.configurarRutas(companyName, year || undefined).then(function(res) {
        console.log('[PrevalenciaEL] Respuesta de configurarRutas:', res);

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
          console.log('[PrevalenciaEL] ERROR en configurarRutas:', res.error);
          showToast(res.error && res.error.message || 'Error configurando rutas', 'error');
          resolve(false);
        }
      })['catch'](function(e) {
        console.log('[PrevalenciaEL] EXCEPTION en configurarRutas:', e.message);
        showToast('Error de conexion: ' + e.message, 'error');
        resolve(false);
      });
    } else {
      console.log('[PrevalenciaEL] API no disponible, simulando exito');
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
  console.log('[PrevalenciaEL] ===== CARGAR DATOS =====');

  showLoading(true);
  pendingChanges = {};

  var year = currentYear || undefined;

  configurarRutas(year).then(function(rutasOk) {
    if (!rutasOk) {
      console.log('[PrevalenciaEL] ERROR: No se pudieron configurar las rutas');
      renderEmptyState();
      return;
    }

    if (api && api.leerIndicadores) {
      api.leerIndicadores().then(function(res) {
        console.log('[PrevalenciaEL] leerIndicadores response:', res);

        if (res.success) {
          console.log('[PrevalenciaEL] indicadores cargados OK');
          indicadores = res.data;
        } else {
          console.log('[PrevalenciaEL] ERROR leerIndicadores:', res.error);
          showToast(res.error && res.error.message || 'Error al leer indicadores', 'error');
          indicadores = null;
        }

        renderizar();
      })['catch'](function(e) {
        console.log('[PrevalenciaEL] usando datos demo:', e.message);
        indicadores = generateDemoData();
        renderizar();
      });
    } else {
      console.log('[PrevalenciaEL] Modo demo sin API');
      indicadores = generateDemoData();
      renderizar();
    }
  });
}

  // ==================== DATOS DEMO ====================
function generateDemoData() {
  return {
    prevalenciaMensual: MESES.map(function(m, i) {
      return {
        mes: i + 1,
        mesLabel: m,
        prevalenciaEL: 0,
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

    // Extraer datos de prevalencia del excel
    var prevalenciaMensualBackend = indicadores.prevalenciaMensual || [];
    var meta = toNum(indicadores.meta) || 0;

    // Construir prevalencia mensual desde los datos del backend
    var prevalenciaMensual = [];
    var totalCasosEL = 0;
    var totalTrab = 0;
    var countMeses = 0;

    prevalenciaMensualBackend.forEach(function(row) {
      var trabajadores = toNum(row.trabajadores);
      var casosEL = toNum(row.prevalenciaEL);

      var prevalencia = calcularPrevalencia(casosEL, trabajadores);

      prevalenciaMensual.push({
        mes: row.mes,
        mesLabel: row.mesLabel,
        casosEL: casosEL,
        trabajadores: trabajadores,
        prevalencia: prevalencia
      });

      if (trabajadores > 0) {
        totalCasosEL += casosEL;
        totalTrab += trabajadores;
        countMeses++;
      }
    });

    // Si tenemos datos mensuales de prevalencia del Excel, usarlos directamente
    // De lo contrario, calcular desde los datos disponibles
    var prevalenciaPromedio = countMeses > 0 ? (totalCasosEL / (totalTrab / countMeses)) * 100000 : 0;
    prevalenciaPromedio = Math.round(prevalenciaPromedio * 100) / 100;

    var trabajadoresProm = countMeses > 0 ? Math.round(totalTrab / countMeses) : 0;

    var estado = getStatusBadge(prevalenciaPromedio, meta);

    // Actualizar KPIs
    var kpiPrevalencia = getElement('kpiPrevalencia');
    var kpiTotalEL = getElement('kpiTotalEL');
    var kpiTrabProm = getElement('kpiTrabProm');
    var kpiMeta = getElement('kpiMeta');
    var kpiEstado = getElement('kpiEstado');
    var metaDisplay = getElement('metaDisplay');
    var promedioBadge = getElement('promedioBadge');

    if (kpiPrevalencia) {
      kpiPrevalencia.textContent = fmt(prevalenciaPromedio, 2);
      kpiPrevalencia.style.color = getValueColor(prevalenciaPromedio, meta);
    }
    if (kpiTotalEL) {
      kpiTotalEL.textContent = totalCasosEL;
      kpiTotalEL.style.color = totalCasosEL > 0 ? '#f59e0b' : '#16a34a';
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
      promedioBadge.textContent = 'Prevalencia: ' + fmt(prevalenciaPromedio, 2);
      var isOk = getValueColor(prevalenciaPromedio, meta) !== '#dc2626';
      promedioBadge.style.background = isOk ? '#dcfce7' : '#fee2e2';
      promedioBadge.style.color = isOk ? '#16a34a' : '#dc2626';
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
    if (chartSection) chartSection.style.display = 'block';
    if (tableSection) tableSection.style.display = 'block';
    if (methodologySection) methodologySection.style.display = 'block';

    // Renderizar tabla
    try {
      renderizarTabla(prevalenciaMensual, meta);
    } catch (e) {
      console.error('[PrevalenciaEL] Error renderizando tabla:', e);
    }

    // Renderizar gráfico
    try {
      var valores = prevalenciaMensual.map(function(row) { return row.prevalencia; });
      renderChart(MESES, valores, meta, prevalenciaPromedio);

      var chartSummary = getElement('chartSummary');
      if (chartSummary) {
        chartSummary.textContent = 'Prevalencia promedio anual: ' + fmt(prevalenciaPromedio, 2) + ' por 100.000 trabajadores.';
        chartSummary.style.display = 'block';
      }
    } catch (e) {
      console.error('[PrevalenciaEL] Error renderizando chart:', e);
    }
  }

  // ==================== RENDERIZAR TABLA ====================
  function renderizarTabla(prevalenciaMensual, meta) {
    var tbody = getElement('tableBody');
    var tfoot = getElement('tableFoot');
    if (!tbody) return;

    var html = '';
    var totalCasosEL = 0;
    var totalTrab = 0;
    var totalPrevalencia = 0;
    var countMeses = 0;

    prevalenciaMensual.forEach(function(row) {
      var estado = getStatusBadge(row.prevalencia, meta);
      var pending = pendingChanges[row.mes];

      var casosELDisplay = pending && pending.casosEL !== undefined ? pending.casosEL : row.casosEL;
      var trabDisplay = pending && pending.trabajadores !== undefined ? pending.trabajadores : row.trabajadores;
      var prevalenciaCalc = calcularPrevalencia(casosELDisplay, trabDisplay);

      totalCasosEL += toNum(casosELDisplay);
      totalTrab += toNum(trabDisplay);
      if (toNum(trabDisplay) > 0) {
        totalPrevalencia += prevalenciaCalc;
        countMeses++;
      }

      var estadoCalc = getStatusBadge(prevalenciaCalc, meta);

      html += '<tr>';
      html += '<td>' + row.mesLabel + '</td>';
      html += '<td><span class="kair-editable" data-mes="' + row.mes + '" data-campo="casosEL" tabindex="0">' + toNum(casosELDisplay) + '</span></td>';
      html += '<td><span class="kair-cell-value" style="color:#2563eb;font-weight:600">' + toNum(trabDisplay) + '</span></td>';
      html += '<td style="font-weight:700;color:' + getValueColor(prevalenciaCalc, meta) + '">' + fmt(prevalenciaCalc, 2) + '</td>';
      html += '<td style="color:#6c757d">' + meta + '</td>';
      html += '<td><span class="kair-status-badge" style="background:' + estadoCalc.color + '">' + estadoCalc.label + '</span></td>';
      html += '</tr>';
    });

    tbody.innerHTML = html;

    // Iniciar listeners de edición inline
    iniciarEdicionInline();

    // Footer con totales
    if (tfoot) {
      var prevalenciaTotal = totalTrab > 0 ? ((totalCasosEL / (totalTrab / (countMeses || 1))) * 100000) : 0;
      prevalenciaTotal = Math.round(prevalenciaTotal * 100) / 100;
      tfoot.innerHTML = '<tr class="kair-table-total">'
        + '<td>TOTAL</td>'
        + '<td style="color:#f59e0b;font-weight:700">' + totalCasosEL + '</td>'
        + '<td style="color:#2563eb;font-weight:700">' + (countMeses > 0 ? Math.round(totalTrab / countMeses) : 0) + '</td>'
        + '<td style="color:#174ea6;font-weight:700">' + fmt(prevalenciaTotal, 2) + '</td>'
        + '<td>' + meta + '</td>'
        + '<td>-</td>'
        + '</tr>';
    }
  }

  // ==================== EDICIÓN INLINE ====================
  function iniciarEdicionInline() {
    var editables = document.querySelectorAll('.prevalencia-container .kair-editable');
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
    if (campo === 'casosEL') {
      campos.prevalenciaEL = valor;
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
    if (!indicadores || !indicadores.prevalenciaMensual) return;

    var pM = indicadores.prevalenciaMensual;
    var totalCasosEL = 0;
    var totalTrab = 0;
    var countMeses = 0;

    pM.forEach(function(row) {
      var pending = pendingChanges[row.mes];
      var casosEL = pending && pending.casosEL !== undefined ? pending.casosEL : toNum(row.prevalenciaEL);
      var trabajadores = toNum(row.trabajadores);

      totalCasosEL += casosEL;
      totalTrab += trabajadores;
      if (trabajadores > 0) countMeses++;
    });

    var prevalenciaPromedio = countMeses > 0 ? (totalCasosEL / (totalTrab / countMeses)) * 100000 : 0;
    prevalenciaPromedio = Math.round(prevalenciaPromedio * 100) / 100;

    var kpiPrevalencia = getElement('kpiPrevalencia');
    if (kpiPrevalencia) {
      kpiPrevalencia.textContent = fmt(prevalenciaPromedio, 2);
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
  console.log('[PrevalenciaEL] ===== INIT =====');

  if (window.electronAPI) {
    api = window.electronAPI.prevalencia;
    console.log('[PrevalenciaEL] electronAPI asignada:', !!api);
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

  window.addEventListener('resize', function() {
    if (chartInstance) {
      chartInstance.resize();
    }
  });

  cargarDatos();
}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

// ============================================================
// K+AIR SG-SST - indice-mortalidad.js
// Lógica del renderer para el Índice de Mortalidad
// Submódulo 3.3.3 Índice de Mortalidad
// ============================================================

(function() {
  'use strict';

  console.log('[IndiceMortalidad] 📦 Módulo JS cargado');

var api;
var mortalidadApi;
var indicadores;
var companyName;
var currentYear = null;
var availableFiles = [];
var chartInstance = null;

  var MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  // Asignar API desde window.electronAPI si existe
if (typeof window !== 'undefined' && window.electronAPI) {
  api = window.electronAPI;
  mortalidadApi = window.electronAPI.mortalidad;
  console.log('[IndiceMortalidad] electronAPI asignada, mortalidad:', !!mortalidadApi);
}

  function getElement(id) {
    // Buscar primero por ID directa
    var el = document.getElementById(id);
    if (el) return el;
    
    // Buscar por selector
    el = document.querySelector('#' + id);
    if (el) return el;
    
    // Buscar cualquier elemento que contenga el ID parcial
    el = document.querySelector('[id*="' + id + '"]');
    if (el) return el;
    
    // Buscar por clase
    var clase = id.replace('Section', '-section').replace('Section', '');
    el = document.querySelector('.' + clase);
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
    if (val === undefined || val === null || val === '') return '—';
    return String(val);
  }

function getCompanyName() {
  var params = new URLSearchParams(window.location.search);
  return params.get('company') || localStorage.getItem('selectedCompany') || '';
}

function updateHeaderContext() {
  var companyText = document.getElementById('header-company-text');
  if (companyText) {
    companyText.textContent = companyName || '—';
  }
}

// ==================== STATUS BADGE ====================
  function getStatusBadge(valor, meta) {
    valor = toNum(valor);
    meta = toNum(meta);

    if (valor === 0 && meta === 0) {
      return { label: 'CUMPLE', color: '#16a34a' };
    }
    if (isNaN(valor) || isNaN(meta)) {
      return { label: 'SIN DATOS', color: '#6b7280' };
    }
    if (valor > meta) {
      return { label: 'EXCEDE', color: '#dc2626' };
    }
    if (valor === meta) {
      return { label: 'CUMPLE', color: '#16a34a' };
    }
    if (valor === 0) {
      return { label: 'SIN AT', color: '#16a34a' };
    }
    return { label: 'CUMPLE', color: '#16a34a' };
  }

  function getValueColor(valor, meta) {
    valor = toNum(valor);
    meta = toNum(meta);

    if (valor > meta && meta > 0) return '#dc2626';
    if (valor === 0) return '#16a34a';
    return '#2563eb';
  }

  // ==================== CHART ====================
  function renderChart(meses, valores, meta, proporcionAnual) {
    var ctx = getElement('mortalityChart');
    if (!ctx) return;

    var ctx2d = ctx.getContext('2d');

    if (chartInstance) {
      chartInstance.destroy();
    }

    // Coloreado condicional por barra (proporción)
    var colores = valores.map(function(v) {
      v = toNum(v);
      if (v > 0) return '#dc2626';
      return '#16a34a';
    });

    // Intentar cargar Chart.js dinámicamente
    if (typeof Chart !== 'undefined') {
      chartInstance = new Chart(ctx2d, {
        type: 'bar',
        data: {
          labels: meses,
          datasets: [{
            label: 'Proporción %',
            data: valores,
            backgroundColor: colores,
            borderRadius: 3,
            maxBarThickness: 36
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#fff',
              titleColor: '#111827',
              bodyColor: '#374151',
              borderColor: '#e5e7eb',
              borderWidth: 1,
              cornerRadius: 4,
              callbacks: { label: function(ctx) { return ctx.parsed.y.toFixed(2) + '%'; } }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 11 }, color: '#6b7280' }
            },
            y: {
              grid: { color: '#e5e7eb' },
              ticks: { font: { size: 11 }, color: '#6b7280', callback: function(v) { return v + '%'; } }
            }
          }
        }
      });

      // Líneas de referencia: proporción anual (violeta) + meta (azul)
      var plugins = [];

      if (proporcionAnual > 0) {
        plugins.push({
          id: 'proporcionAnualLine',
          afterDraw: function(chart) {
            var yScale = chart.scales.y;
            var y = yScale.getPixelForValue(proporcionAnual);
            var ctx = chart.ctx;
            ctx.save();
            ctx.strokeStyle = '#7c3aed';
            ctx.setLineDash([8, 4]);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(chart.chartArea.left, y);
            ctx.lineTo(chart.chartArea.right, y);
            ctx.stroke();
            ctx.fillStyle = '#7c3aed';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText('Anual: ' + proporcionAnual + '%', chart.chartArea.right - 95, y - 6);
            ctx.restore();
          }
        });
      }

      if (meta > 0) {
        plugins.push({
          id: 'metaLine',
          afterDraw: function(chart) {
            var yScale = chart.scales.y;
            var y = yScale.getPixelForValue(meta);
            var ctx = chart.ctx;
            ctx.save();
            ctx.strokeStyle = '#2563eb';
            ctx.setLineDash([6, 4]);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(chart.chartArea.left, y);
            ctx.lineTo(chart.chartArea.right, y);
            ctx.stroke();
            ctx.restore();
          }
        });
      }

      if (plugins.length > 0) {
        chartInstance.config.plugins = plugins;
        chartInstance.update();
      }
    } else {
      // Fallback: Simple SVG si Chart.js no está disponible
      renderFallbackChart(ctx, meses, valores, meta, proporcionAnual);
    }
  }

  function renderFallbackChart(canvas, meses, valores, meta, proporcionAnual) {
    canvas.style.display = 'none';
    var container = canvas.parentNode;

    // Crear contenedor SVG
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

    var maxVal = Math.max.apply(null, valores.concat([meta, proporcionAnual || 0])) || 10;

    // Grid lines
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

    // Barras
    var barWidth = chartWidth / meses.length;
    var metaY = padding.top + chartHeight * (1 - meta / maxVal);

    valores.forEach(function(val, idx) {
      var valNum = toNum(val);
      var barHeight = (valNum / maxVal) * chartHeight;
      var x = padding.left + barWidth * idx + barWidth * 0.1;
      var barW = barWidth * 0.8;

      var color = valNum > 0 ? '#dc2626' : '#16a34a';

      var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', padding.top + chartHeight - barHeight);
      rect.setAttribute('width', barW);
      rect.setAttribute('height', barHeight);
      rect.setAttribute('fill', color);
      rect.setAttribute('rx', '3');
      svg.appendChild(rect);

      // Etiqueta de mes
      var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', x + barW / 2);
      label.setAttribute('y', height - 10);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', '#6c757d');
      label.setAttribute('font-size', '10');
      label.textContent = meses[idx];
      svg.appendChild(label);
    });

    // Línea de proporción anual (violeta)
    if (proporcionAnual > 0) {
      var anualY = padding.top + chartHeight * (1 - proporcionAnual / maxVal);
      var anualLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      anualLine.setAttribute('x1', padding.left);
      anualLine.setAttribute('y1', anualY);
      anualLine.setAttribute('x2', width - padding.right);
      anualLine.setAttribute('y2', anualY);
      anualLine.setAttribute('stroke', '#7c3aed');
      anualLine.setAttribute('stroke-width', '2');
      anualLine.setAttribute('stroke-dasharray', '8,4');
      svg.appendChild(anualLine);

      var anualLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      anualLabel.setAttribute('x', width - padding.right - 5);
      anualLabel.setAttribute('y', anualY - 6);
      anualLabel.setAttribute('text-anchor', 'end');
      anualLabel.setAttribute('fill', '#7c3aed');
      anualLabel.setAttribute('font-size', '11');
      anualLabel.setAttribute('font-weight', 'bold');
      anualLabel.textContent = 'Anual: ' + proporcionAnual + '%';
      svg.appendChild(anualLabel);
    }

    // Línea de meta (azul)
    if (meta > 0) {
      var metaLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      metaLine.setAttribute('x1', padding.left);
      metaLine.setAttribute('y1', metaY);
      metaLine.setAttribute('x2', width - padding.right);
      metaLine.setAttribute('y2', metaY);
      metaLine.setAttribute('stroke', '#2563eb');
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
    console.log('[IndiceMortalidad] ===== CONFIGURAR RUTAS =====');
    console.log('[IndiceMortalidad] companyName:', companyName, '| year:', year);

    if (!companyName) {
      showToast('No se ha seleccionado una empresa', 'warning');
      resolve(false);
      return;
    }

    if (mortalidadApi && mortalidadApi.configurarRutas) {
      mortalidadApi.configurarRutas(companyName, year || undefined).then(function(res) {
        console.log('[IndiceMortalidad] Respuesta de configurarRutas:', res);

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
          console.log('[IndiceMortalidad] ERROR en configurarRutas:', res.error);
          showToast(res.error && res.error.message || 'Error configurando rutas', 'error');
          resolve(false);
        }
      })['catch'](function(e) {
        console.log('[IndiceMortalidad] EXCEPTION en configurarRutas:', e.message);
        showToast('Error de conexion: ' + e.message, 'error');
        resolve(false);
      });
    } else {
      console.log('[IndiceMortalidad] API no disponible, simulando exito');
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
  console.log('[IndiceMortalidad] ===== CARGAR DATOS =====');

  showLoading(true);

  var year = currentYear || undefined;

  configurarRutas(year).then(function(rutasOk) {
    if (!rutasOk) {
      console.log('[IndiceMortalidad] ERROR: No se pudieron configurar las rutas');
      renderEmptyState();
      return;
    }

    if (mortalidadApi && mortalidadApi.leerIndicadores) {
      mortalidadApi.leerIndicadores().then(function(res) {
        console.log('[IndiceMortalidad] leerIndicadores response:', res);

        if (res.success) {
          console.log('[IndiceMortalidad] indicadores cargados OK');
          indicadores = res.data;
        } else {
          console.log('[IndiceMortalidad] ERROR leerIndicadores:', res.error);
          showToast(res.error && res.error.message || 'Error al leer indicadores', 'error');
          indicadores = null;
        }

        renderizar();
      })['catch'](function(e) {
        console.log('[IndiceMortalidad] usando datos demo:', e.message);
        indicadores = generateDemoData();
        renderizar();
      });
    } else {
      console.log('[IndiceMortalidad] Modo demo sin API');
      indicadores = generateDemoData();
      renderizar();
    }
  });
}

  // ==================== DATOS DEMO ====================
function generateDemoData() {
  return {
    eventos: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    trabajadores: 150,
    meta: 0,
    frecuencia: 'Anual'
  };
}

function renderEmptyState() {
  showLoading(false);
  var kpiSection = document.querySelector('.kair-kpis') || getElement('kpiSection');
  var metaSection = document.querySelector('.kair-meta-section') || getElement('metaSection');
  var chartSection = document.querySelector('.kair-chart-section') || getElement('chartSection');
  var tableSection = document.querySelector('.kair-table-section') || getElement('tableSection');
  var methodologySection = document.querySelector('.kair-methodology-section') || getElement('methodologySection');

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

    var mortalMensual = indicadores.eventosMortalesMensual || [];
    var meta = toNum(indicadores.meta) || 0;
    var totalAT = toNum(indicadores.totalAT) || 0;

    // Calcular métricas desde eventosMortalesMensual (fuente de verdad)
    var totalMortal = 0;
    mortalMensual.forEach(function(row) { totalMortal += toNum(row.eventosMortales); });
    var proporcion = totalAT > 0 ? ((totalMortal / totalAT) * 100).toFixed(2) : '0.00';
    var resultado = parseFloat(proporcion);
    var estado = getStatusBadge(resultado, meta);

    // Actualizar KPIs
    var kpiTotalAT = getElement('kpiTotalAT');
    var kpiEventos = getElement('kpiEventos');
    var kpiTasa = getElement('kpiTasa');
    var kpiMeta = getElement('kpiMeta');
    var kpiEstado = getElement('kpiEstado');
    var metaDisplay = getElement('metaDisplay');
    var promedioBadge = getElement('promedioBadge');

    if (kpiTotalAT) {
      kpiTotalAT.textContent = totalAT;
      kpiTotalAT.style.color = '#2563eb';
    }
    if (kpiEventos) {
      kpiEventos.textContent = totalMortal;
      kpiEventos.style.color = totalMortal > 0 ? '#dc2626' : '#16a34a';
      kpiEventos.className = 'kair-kpi-value ' + (totalMortal > 0 ? 'danger' : 'success');
    }
    // Subtítulo del KPI: fuente de datos
    var kpiEventosSev = getElement('kpiEventosSev');
    if (kpiEventosSev) {
      kpiEventosSev.textContent = 'Fuente: Severidad (días cargados = 6000)';
      kpiEventosSev.style.color = '#6c757d';
    }
    if (kpiTasa) {
      kpiTasa.textContent = proporcion + '%';
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
      promedioBadge.textContent = 'Proporción: ' + proporcion + '%';
      var isOk = getValueColor(resultado, meta) !== '#dc2626';
      promedioBadge.style.background = isOk ? '#dcfce7' : '#fee2e2';
      promedioBadge.style.color = isOk ? '#16a34a' : '#dc2626';
    }

    // Actualizar metodología
    var metFrecuencia = getElement('metFrecuencia');
    if (metFrecuencia) {
      metFrecuencia.textContent = indicadores.frecuencia || 'Anual';
    }

    // Mostrar secciones PRIMERO para que siempre sean visibles
    var kpiSection = document.querySelector('.kair-kpis') || getElement('kpiSection');
    var metaSection = document.querySelector('.kair-meta-section') || getElement('metaSection');
    var chartSection = document.querySelector('.kair-chart-section') || getElement('chartSection');
    var tableSection = document.querySelector('.kair-table-section') || getElement('tableSection');
    var methodologySection = document.querySelector('.kair-methodology-section') || getElement('methodologySection');

    if (kpiSection) kpiSection.style.display = 'grid';
    if (metaSection) metaSection.style.display = 'flex';
    if (chartSection) chartSection.style.display = 'block';
    if (tableSection) tableSection.style.display = 'block';
    if (methodologySection) methodologySection.style.display = 'block';

    // Renderizar tabla (con try-catch para no bloquear el resto)
    try {
      renderizarTabla();
    } catch (e) {
      console.error('[IndiceMortalidad] Error renderizando tabla:', e);
    }

    // Renderizar gráfico: proporción mensual + línea de proporción anual
    try {
      var valores = mortalMensual.map(function(row) {
        var totalATMes = toNum(row.totalATMes);
        return totalATMes > 0
          ? Math.round((toNum(row.eventosMortales) / totalATMes) * 100 * 100) / 100
          : 0;
      });
      var totalMortalGraf = 0;
      var totalATAnual = 0;
      mortalMensual.forEach(function(row) {
        totalMortalGraf += toNum(row.eventosMortales);
        totalATAnual += toNum(row.totalATMes);
      });
      var proporcionAnual = totalATAnual > 0
        ? Math.round((totalMortalGraf / totalATAnual) * 100 * 100) / 100
        : 0;
      renderChart(MESES, valores, meta, proporcionAnual);

      // Texto resumen del gráfico
      var chartSummary = getElement('chartSummary');
      if (chartSummary) {
        chartSummary.textContent = 'En el año, el ' + proporcionAnual.toFixed(2) + '% de accidentes de trabajo fueron mortales.';
        chartSummary.style.display = 'block';
      }
    } catch (e) {
      console.error('[IndiceMortalidad] Error renderizando chart:', e);
    }
  }

  // ==================== RENDERIZAR TABLA ====================
  function renderizarTabla() {
    var tbody = document.querySelector('.kair-table-section tbody') || getElement('tableBody');
    var tfoot = document.querySelector('.kair-table-section tfoot') || getElement('tableFoot');
    if (!tbody) return;

    var mortalMensual = indicadores.eventosMortalesMensual || [];
    var meta = toNum(indicadores.meta) || 0;
    var totalAT = toNum(indicadores.totalAT) || 0;

    var html = '';
    var totalMortal = 0;

    mortalMensual.forEach(function(row) {
      totalMortal += toNum(row.eventosMortales);
      var proporcion = toNum(row.totalATMes) > 0
        ? ((toNum(row.eventosMortales) / toNum(row.totalATMes)) * 100).toFixed(2)
        : '0.00';
      var resultado = parseFloat(proporcion);
      var estado = getStatusBadge(resultado, meta);
      var diasCargados = toNum(row.diasCargados);
      var esMortal = diasCargados === 6000;
      var rowClass = esMortal ? ' class="kair-row-mortal"' : '';

      html += '<tr' + rowClass + '>';
      html += '<td>' + row.mesLabel + '</td>';
      html += '<td><span class="kair-cell-value" style="color:#2563eb;font-weight:600">' + toNum(row.totalATMes) + '</span></td>';
      html += '<td><span class="kair-cell-value" style="color:' + (toNum(row.eventosMortales) > 0 ? '#dc2626' : '#16a34a') + ';font-weight:600">' + toNum(row.eventosMortales) + '</span></td>';
      html += '<td><span style="color:' + (esMortal ? '#dc2626' : '#6c757d') + ';font-weight:' + (esMortal ? '700' : '400') + '">' + diasCargados + (esMortal ? ' <span class="kair-badge-mortal">MORTAL</span>' : '') + '</span></td>';
      html += '<td style="font-weight:700;color:' + getValueColor(resultado, meta) + '">' + proporcion + '%</td>';
      html += '<td style="color:#6c757d">' + meta + '</td>';
      html += '<td><span class="kair-status-badge" style="background:' + estado.color + '">' + estado.label + '</span></td>';
      html += '</tr>';
    });

    tbody.innerHTML = html;

    // Footer con totales acumulados
    if (tfoot) {
      var proporcionTotal = totalAT > 0 ? ((totalMortal / totalAT) * 100).toFixed(2) : '0.00';
      tfoot.innerHTML = '<tr class="kair-table-total">'
        + '<td>TOTAL</td>'
        + '<td style="color:#2563eb;font-weight:700">' + totalAT + '</td>'
        + '<td style="color:' + (totalMortal > 0 ? '#dc2626' : '#16a34a') + ';font-weight:700">' + totalMortal + '</td>'
        + '<td style="color:#6c757d">—</td>'
        + '<td style="color:#174ea6;font-weight:700">' + proporcionTotal + '%</td>'
        + '<td>' + meta + '</td>'
        + '<td>-</td>'
        + '</tr>';
    }
  }

  // ==================== SHOW/HIDE ====================
  function showLoading(show) {
    getElement('loadingSection').style.display = show ? 'flex' : 'none';
    getElement('errorSection').style.display = 'none';
  }

  function showError(msg) {
    getElement('loadingSection').style.display = 'none';
    getElement('errorSection').style.display = 'flex';
    getElement('errorMessage').textContent = msg || 'Error al cargar los datos';
  }

  // ==================== INICIALIZAR ====================
function init() {
  console.log('[IndiceMortalidad] ===== INIT =====');

  if (window.electronAPI) {
    api = window.electronAPI;
    mortalidadApi = window.electronAPI.mortalidad;
    console.log('[IndiceMortalidad] electronAPI asignada, mortalidad:', !!mortalidadApi);
  }

  var btnBack = getElement('btn-back-module');
  var btnRefrescar = getElement('btnRefrescar');
  var btnGuardar = getElement('btnGuardar');

  // Ocultar botón guardar (edición inmediata, sin batch)
  if (btnGuardar) btnGuardar.style.display = 'none';

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

  updateHeaderContext();

  cargarDatos();
}

  // Iniciar cuando DOM listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
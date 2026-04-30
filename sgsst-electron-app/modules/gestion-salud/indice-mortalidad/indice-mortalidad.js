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
var pendingChanges = new Map();
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
  function renderChart(meses, valores, meta) {
    var ctx = getElement('mortalityChart');
    if (!ctx) return;

    var ctx2d = ctx.getContext('2d');

    if (chartInstance) {
      chartInstance.destroy();
    }

    // Coloreado condicional por barra
    var colores = valores.map(function(v) {
      v = toNum(v);
      if (v > meta && meta > 0) return '#dc2626';
      if (v === 0) return '#dcfce7';
      return '#f59e0b';
    });

    // Intentar cargar Chart.js dinámicamente
    if (typeof Chart !== 'undefined') {
      chartInstance = new Chart(ctx2d, {
        type: 'bar',
        data: {
          labels: meses,
          datasets: [{
            label: 'Índice',
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
              cornerRadius: 4
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 11 }, color: '#6b7280' }
            },
            y: {
              grid: { color: '#e5e7eb' },
              ticks: { font: { size: 11 }, color: '#6b7280' }
            }
          }
        }
      });

      // Línea de referencia para la meta
      if (meta > 0) {
        var plugin = {
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
        };
        chartInstance.config.plugins = [plugin];
        chartInstance.update();
      }
    } else {
      // Fallback: Simple SVG si Chart.js no está disponible
      renderFallbackChart(ctx, meses, valores, meta);
    }
  }

  function renderFallbackChart(canvas, meses, valores, meta) {
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

    var maxVal = Math.max.apply(null, valores.concat([meta])) || 10;

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

      var color = valNum > meta && meta > 0 ? '#dc2626' : valNum === 0 ? '#dcfce7' : '#f59e0b';

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

    // Línea de meta
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

  var kpiYearEl = getElement('kpiYearLabel');
  if (kpiYearEl) kpiYearEl.textContent = year;

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
  var editHint = document.querySelector('.kair-edit-hint') || getElement('editHint');
  var methodologySection = document.querySelector('.kair-methodology-section') || getElement('methodologySection');

  if (kpiSection) kpiSection.style.display = 'none';
  if (metaSection) metaSection.style.display = 'none';
  if (chartSection) chartSection.style.display = 'none';
  if (tableSection) tableSection.style.display = 'none';
  if (editHint) editHint.style.display = 'none';
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

    var eventos = indicadores.eventos || [];
    var trabajadores = toNum(indicadores.trabajadores) || 150;
    var meta = toNum(indicadores.meta) || 0;

    // Calcular métricas
    var totalEventos = 0;
    eventos.forEach(function(v) { totalEventos += toNum(v); });
    var tasa = trabajadores > 0 ? ((totalEventos / trabajadores) * 1000).toFixed(2) : '0.00';
    var resultado = totalEventos;
    var estado = getStatusBadge(resultado, meta);

    // Actualizar KPIs
    var kpiEventos = getElement('kpiEventos');
    var kpiTasa = getElement('kpiTasa');
    var kpiTrabajadores = getElement('kpiTrabajadores');
    var kpiMeta = getElement('kpiMeta');
    var kpiResultado = getElement('kpiResultado');
    var kpiEstado = getElement('kpiEstado');
    var metaDisplay = getElement('metaDisplay');
    var promedioBadge = getElement('promedioBadge');

    if (kpiEventos) {
      kpiEventos.textContent = totalEventos;
      kpiEventos.style.color = totalEventos > 0 ? '#dc2626' : '#16a34a';
      kpiEventos.className = 'kair-kpi-value ' + (totalEventos > 0 ? 'danger' : 'success');
    }
    if (kpiTasa) {
      kpiTasa.textContent = tasa;
    }
    if (kpiTrabajadores) {
      kpiTrabajadores.textContent = trabajadores;
    }
    if (kpiMeta) {
      kpiMeta.textContent = meta;
    }
    if (kpiResultado) {
      kpiResultado.textContent = resultado;
      kpiResultado.style.color = getValueColor(resultado, meta);
    }
    if (kpiEstado) {
      kpiEstado.textContent = estado.label;
      kpiEstado.style.background = estado.color;
    }
    if (metaDisplay) {
      metaDisplay.textContent = meta;
    }
    if (promedioBadge) {
      promedioBadge.textContent = 'Promedio: ' + resultado;
      var isOk = getValueColor(resultado, meta) !== '#dc2626';
      promedioBadge.style.background = isOk ? '#dcfce7' : '#fee2e2';
      promedioBadge.style.color = isOk ? '#16a34a' : '#dc2626';
    }

    // Actualizar metodología
    var metFrecuencia = getElement('metFrecuencia');
    if (metFrecuencia) {
      metFrecuencia.textContent = indicadores.frecuencia || 'Anual';
    }

    // Renderizar tabla
    renderizarTabla(eventos, trabajadores, meta);

    // Renderizar gráfico
    var valores = eventos.map(function(v) { return toNum(v); });
    renderChart(MESES, valores, meta);

    // Actualizar totales
    var totalEventosEl = getElement('totalEventos');
    var totalResultadoEl = getElement('totalResultado');
    if (totalEventosEl) totalEventosEl.textContent = totalEventos;
    if (totalResultadoEl) totalResultadoEl.textContent = resultado;

    // Mostrar secciones
    var kpiSection = document.querySelector('.kair-kpis') || getElement('kpiSection');
    var metaSection = document.querySelector('.kair-meta-section') || getElement('metaSection');
    var chartSection = document.querySelector('.kair-chart-section') || getElement('chartSection');
    var tableSection = document.querySelector('.kair-table-section') || getElement('tableSection');
    var editHint = document.querySelector('.kair-edit-hint') || getElement('editHint');
    var methodologySection = document.querySelector('.kair-methodology-section') || getElement('methodologySection');
    
    if (kpiSection) kpiSection.style.display = 'grid';
    if (metaSection) metaSection.style.display = 'flex';
    if (chartSection) chartSection.style.display = 'block';
    if (tableSection) {
      tableSection.style.display = 'block';
      console.log('[IndiceMortalidad] ✓ tableSection mostrada');
    } else {
      console.error('[IndiceMortalidad] ❌ tableSection NO ENCONTRADA para mostrar');
    }
    if (editHint) editHint.style.display = 'block';
    if (methodologySection) methodologySection.style.display = 'block';
  }

  // ==================== RENDERIZAR TABLA ====================
  function renderizarTabla(eventos, trabajadores, meta) {
    console.log('[IndiceMortalidad] 🎯 renderizarTabla INICIADO');
    
    // Buscar la tabla dentro del contenedor del módulo
    var tablaSection = document.querySelector('.kair-table-section');
    console.log('[IndiceMortalidad] tablaSection encontrada:', !!tablaSection);
    
    if (!tablaSection) {
      // Intentar otras formas de buscar
      tablaSection = document.getElementById('tableSection') || 
                 document.querySelector('#tableSection') ||
                 document.querySelector('[id*="table"]');
      console.log('[IndiceMortalidad] tablaSection (búsqueda alterna):', !!tablaSection);
    }
    
    if (!tablaSection) {
      console.error('[IndiceMortalidad] ❌ tablaSection NO ENCONTRADA');
      return;
    }
    
    var tbody = tablaSection.querySelector('tbody') || tablaSection.querySelector('#tableBody');
    if (!tbody) {
      // Buscar el tbody dentro de tableSection
      var tables = tablaSection.querySelectorAll('table');
      if (tables.length > 0) {
        tbody = tables[0].querySelector('tbody');
      }
    }
    console.log('[IndiceMortalidad] tbody encontrado:', !!tbody);
    
    if (!tbody) {
      console.error('[IndiceMortalidad] ❌ tbody NO ENCONTRADO');
      return;
    }

    tbody.innerHTML = '';

    var valores = eventos.map(function(v) { return toNum(v); });

    MESES.forEach(function(mes, idx) {
      var val = valores[idx];
      var resultado = val;
      var estado = getStatusBadge(resultado, meta);

      var tr = document.createElement('tr');
      tr.className = 'kair-data-row';

      // Mes
      var tdMes = document.createElement('td');
      tdMes.textContent = mes;
      tr.appendChild(tdMes);

      // Eventos Mortales (editable)
      var tdEventos = document.createElement('td');
      tdEventos.className = 'kair-cell-editable';
      tdEventos.dataset.row = 'eventos';
      tdEventos.dataset.mes = mes;
      tdEventos.dataset.original = val;
      tdEventos.innerHTML = '<span class="kair-cell-value">' + display(val) + '</span>';
      tdEventos.onclick = function() { startEdit(this); };
      tr.appendChild(tdEventos);

      // Trabajadores (referencia)
      var tdTrab = document.createElement('td');
      tdTrab.textContent = trabajadores;
      tr.appendChild(tdTrab);

      // Meta
      var tdMeta = document.createElement('td');
      tdMeta.innerHTML = '<span class="kair-cell-value" style="color:#2563eb">' + meta + '</span>';
      tr.appendChild(tdMeta);

      // Resultado
      var tdRes = document.createElement('td');
      tdRes.textContent = resultado;
      tdRes.style.color = getValueColor(resultado, meta);
      tr.appendChild(tdRes);

      // Estado
      var tdEstado = document.createElement('td');
      tdEstado.innerHTML = '<span class="kair-status-badge" style="background:' + estado.color + '">' + estado.label + '</span>';
      tr.appendChild(tdEstado);

      tbody.appendChild(tr);
    });
  }

  // ==================== EDITAR CELDA ====================
  var currentEdit = null;

  function startEdit(td) {
    if (currentEdit) {
      cancelEdit();
    }

    var span = td.querySelector('.kair-cell-value');
    var original = td.dataset.original;

    span.style.display = 'none';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'kair-edit-input';
    input.value = original;

    td.appendChild(input);
    input.focus();
    input.select();

    currentEdit = {
      td: td,
      span: span,
      input: input,
      row: td.dataset.row,
      mes: td.dataset.mes,
      original: original
    };

    input.onkeydown = function(e) {
      if (e.key === 'Enter') {
        commitEdit();
      } else if (e.key === 'Escape') {
        cancelEdit();
      }
    };

    input.onblur = function() {
      // Demorar para evitar焦点 perdidas
      setTimeout(function() {
        if (currentEdit && currentEdit.input === input) {
          commitEdit();
        }
      }, 100);
    };
  }

  function commitEdit() {
    if (!currentEdit) return;

    var val = currentEdit.input.value.trim();
    var parsed = val === '' ? '' : (isNaN(Number(val)) ? val : Number(val));

    // Guardar en cambios pendientes
    var key = 'eventos-' + currentEdit.mes;
    pendingChanges.set(key, {
      mes: currentEdit.mes,
      value: parsed
    });

    // Actualizar visual
    currentEdit.span.textContent = val === '' ? '—' : val;
    currentEdit.span.style.display = '';
    currentEdit.span.classList.add('pending');
    currentEdit.input.remove();
    currentEdit = null;

    // Actualizar botón guardar
    updateSaveButton();
  }

  function cancelEdit() {
    if (!currentEdit) return;

    currentEdit.span.style.display = '';
    currentEdit.input.remove();
    currentEdit = null;
  }

  function updateSaveButton() {
    var btn = getElement('btnGuardar');
    var label = getElement('save-label');
    var count = pendingChanges.size;

    if (count > 0) {
      btn.style.display = 'inline-flex';
      label.textContent = 'Guardar (' + count + ')';
    } else {
      btn.style.display = 'none';
    }
  }

  // ==================== GUARDAR ====================
  function guardarCambios() {
    if (pendingChanges.size === 0) return;

    var btn = getElement('btnGuardar');
    btn.disabled = true;

    var promises = [];
  pendingChanges.forEach(function(change, key) {
    if (mortalidadApi && mortalidadApi.escribirExcel) {
      promises.push(
        mortalidadApi.escribirExcel(change.mes, { eventos: change.value })
      );
    }
  });

    Promise.all(promises).then(function(results) {
      btn.disabled = false;

      var ok = results.filter(function(r) { return r.success; }).length;

      if (ok === pendingChanges.size) {
        showToast('Guardado exitoso', 'success');
        pendingChanges.clear();
        updateSaveButton();
        cargarDatos();
      } else {
        showToast('Error parcial: ' + ok + '/' + pendingChanges.size + ' guardados', 'warning');
      }
    })['catch'](function(e) {
      btn.disabled = false;
      showToast('Error al guardar: ' + e.message, 'error');
    });
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
      pendingChanges.clear();
      updateSaveButton();
      cargarDatos();
    };
  }

  if (btnGuardar) {
    btnGuardar.onclick = function() {
      guardarCambios();
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
      if (!confirm('Duplicar archivo de ' + currentYear + ' para el ano ' + nextYear + '?\nSe conservaran metas y trabajadores, se limpiaran datos de ejecucion.')) return;

      var currentFile = availableFiles.find(function(f) { return f.year === currentYear; });
      if (!currentFile) {
        showToast('No se encontro el archivo actual', 'error');
        return;
      }

      window.electronAPI.duplicateIndicadoresFile({
        currentFilePath: currentFile.filePath,
        newYear: nextYear
      }).then(function(result) {
        if (result.success) {
          showToast('Archivo duplicado: ' + result.newFileName);
          currentYear = nextYear;
          cargarDatos();
        } else {
          showToast(result.error && result.error.message || 'Error al duplicar', 'error');
        }
      })['catch'](function(e) {
        showToast('Error: ' + e.message, 'error');
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
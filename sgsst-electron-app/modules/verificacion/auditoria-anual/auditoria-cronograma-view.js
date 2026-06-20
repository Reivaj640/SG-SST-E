/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Cronograma view (replica CronogramaView.tsx del tar)
   v3.0 · 2026-06-19
   Vista simplificada: header + KPIs + tabs por fase + lista cronológica + dialog edición
   (drag&drop complejo se omite; el user puede mover vía editar)
   ═══════════════════════════════════════════════════════════════════ */

var AuditoriaCronogramaView = (function () {
  'use strict';

  /* F21.15 (2026-06-20): FASES usan la paleta de colores de la app K+AIR.
     Mapeo semántico: Preparación → primary, Realización → info,
     Plan de Acción → warning, Implementación → success. */
  var FASES = [
    { id: 'preparacion',    label: 'Preparación',     short: 'Prep',  color: 'var(--v3-primary)',         bg: 'var(--v3-primary-soft)' },
    { id: 'realizacion',    label: 'Realización',     short: 'Real',  color: 'var(--v3-info)',            bg: 'var(--v3-info-soft)' },
    { id: 'plan_accion',    label: 'Plan de acción',  short: 'Plan',  color: 'var(--v3-warning)',         bg: 'var(--v3-warning-soft)' },
    { id: 'implementacion', label: 'Implementación',  short: 'Impl',  color: 'var(--v3-success)',         bg: 'var(--v3-success-soft)' }
  ];
  var FASES_PALETTE = [
    { color: 'var(--v3-primary)',         bg: 'var(--v3-primary-soft)' },
    { color: 'var(--v3-info)',            bg: 'var(--v3-info-soft)' },
    { color: 'var(--v3-warning)',         bg: 'var(--v3-warning-soft)' },
    { color: 'var(--v3-success)',         bg: 'var(--v3-success-soft)' }
  ];

  var _state = {
    year: new Date().getFullYear(),
    faseFilter: 'todas',
    editing: null,
    excelHitos: [],      /* F18 (2026-06-20): hitos cargados del GI-FO-062 */
    excelArchivo: null, /* Nombre del archivo Excel cargado */
    excelRuta: null,    /* F21.7: ruta completa del archivo */
    excelCarpeta: null, /* F21.7: '6.1.2' o '6.1.4' */
    excelAnioDetectado: null, /* F21.7: año que detectó el parser del archivo */
    excelAnioSolicitado: null, /* F21.7: año que pidió el usuario */
    excelAviso: null,   /* F21.7: mensaje de aviso (ej: "el archivo es de 2024 no 2026") */
    excelFases: [],     /* F21.7: fases reales detectadas en el Excel */
    loading: false,     /* Estado de carga del Excel */
    aniosConArchivo: [] /* F21.11: lista de años que tienen archivo Excel en disco */
  };
  var _excelLoaded = false; /* Flag para cargar Excel solo 1 vez por instancia */

  function _esc(s) { return KairUI.esc(s); }
  function _fmtDate(iso) { return KairHelpers.formatDate(iso); }
  function _shortMonth(mes) { return KairHelpers.MONTHS_SHORT_ES[mes - 1] || '—'; }

  /* F20/F21.11 (2026-06-20): handlers del empty state — crear Excel o programar manual */
  function _bindEmptyEvents(container) {
    var btnCrear = container.querySelector('[data-action="crear-cronograma"]');
    if (btnCrear) btnCrear.addEventListener('click', function () {
      _crearCronogramaParaYear();
    });
    var btnManual = container.querySelector('[data-action="programar-manual"]');
    if (btnManual) btnManual.addEventListener('click', function () {
      /* Cambia al modo "sin archivo": muestra el calendar vacío con celdas clickeables
         para programar hitos manualmente. Se guarda en SQLite (store local). */
      _state.sinDatosParaYear = false;
      _state.excelHitos = [];
      _state.excelFases = [];
      _state.excelArchivo = null;
      _state.excelAviso = null;
      /* Crear al menos 4 fases genéricas para que el calendar tenga estructura */
      _state.excelFases = [
        { key: 'preparacion', label: 'Preparación' },
        { key: 'realizacion', label: 'Realización' },
        { key: 'plan_accion', label: 'Plan de Acción' },
        { key: 'implementacion', label: 'Implementación' }
      ];
      if (window.Sileo) Sileo.info({ title: 'Modo manual activo', description: 'Programa los hitos haciendo click en las celdas del calendario.' });
      render(_currentContainer || document.querySelector('.kair-v3-module, .kair-aud-module') || document.body);
    });
  }

  /* F18-F20 (2026-06-20): Carga el archivo GI-FO-062 del repositorio de la empresa
     Si recibe NO_DATA_FOR_YEAR, marca _state.sinDatosParaYear para mostrar el botón "Crear". */
  function _loadCronogramaFromExcel() {
    var empresaId = (window.KairMockData && window.KairMockData.ACTIVE_COMPANY && window.KairMockData.ACTIVE_COMPANY.id) || null;
    return window.electronAPI.auditoriaAnual.cargarCronograma(empresaId, _state.year).then(function (resp) {
      /* F21.11 (2026-06-20): extraer la lista de años con archivo Excel, venga de éxito o error. */
      var aniosConArchivo = [];
      if (resp && resp.data && resp.data.aniosConArchivo) {
        aniosConArchivo = resp.data.aniosConArchivo;
      } else if (resp && resp.error && resp.error.aniosDisponibles) {
        aniosConArchivo = resp.error.aniosDisponibles;
      }
      _state.aniosConArchivo = aniosConArchivo;

      if (resp && resp.success && resp.data) {
        _state.excelHitos = resp.data.hitos || [];
        _state.excelArchivo = resp.data.archivo || null;
        _state.excelRuta = resp.data.ruta || null;
        _state.excelCarpeta = resp.data.carpeta || null;
        _state.excelAnioDetectado = resp.data.anio || null;
        _state.excelAnioSolicitado = resp.data.anioSolicitado || null;
        _state.excelAviso = resp.data.avisoAnio || null;
        _state.excelFases = resp.data.fases || [];
        _state.sinDatosParaYear = false;
        /* F21.8 (2026-06-20): NO sobrescribir _state.year con el año del archivo.
           Si el usuario pidió 2026, mantenemos 2026 aunque el archivo sea de 2024.
           El aviso amarillo ya explica la situación. */
      } else if (resp && resp.error && resp.error.code === 'NO_DATA_FOR_YEAR') {
        _state.excelHitos = [];
        _state.excelArchivo = null;
        _state.excelRuta = null;
        _state.excelCarpeta = null;
        _state.excelFases = [];
        _state.sinDatosParaYear = true;
      } else {
        _state.excelHitos = [];
        _state.excelArchivo = null;
        _state.excelRuta = null;
        _state.excelCarpeta = null;
        _state.excelFases = [];
        _state.sinDatosParaYear = false;
      }
    }).catch(function (err) {
      _state.excelHitos = [];
      _state.excelArchivo = null;
      _state.excelRuta = null;
      _state.excelCarpeta = null;
      _state.excelFases = [];
      _state.aniosConArchivo = [];
      _state.sinDatosParaYear = false;
    });
  }

  /* F20 (2026-06-20): Crea un nuevo archivo de cronograma para el año actual */
  function _crearCronogramaParaYear() {
    return _crearCronogramaParaAnio(_state.year);
  }

  /* F21.29 (2026-06-20): crea el archivo Excel del cronograma para un año
     específico. Usado tanto por el botón "Crear archivo" como automáticamente
     al guardar el primer hito de un año sin archivo. */
  function _crearCronogramaParaAnio(anio) {
    var empresaId = (window.KairMockData && window.KairMockData.ACTIVE_COMPANY && window.KairMockData.ACTIVE_COMPANY.id) || null;
    if (!anio) return Promise.reject(new Error('Año no especificado'));
    if (window.Sileo) {
      Sileo.info({ title: 'Creando cronograma ' + anio + '…', description: 'Generando plantilla con 4 fases × 12 meses vacíos.' });
    }
    return window.electronAPI.auditoriaAnual.crearCronograma(empresaId, anio).then(function (resp) {
      if (resp && resp.success) {
        if (window.Sileo) Sileo.success({ title: 'Cronograma ' + anio + ' creado', description: resp.data.archivo });
        /* Marcar el año como con archivo para no volver a crearlo. */
        if (_state.aniosConArchivo.indexOf(anio) === -1) {
          _state.aniosConArchivo.push(anio);
        }
        _excelLoaded = false; /* forzar recarga para leer el nuevo archivo */
        render(_currentContainer || document.querySelector('.kair-v3-hub') || document.body);
        return resp;
      } else if (resp && resp.error) {
        if (window.Sileo) Sileo.error({ title: 'Error al crear', description: resp.error.message });
        return Promise.reject(new Error(resp.error.message));
      }
    }).catch(function (err) {
      if (window.Sileo) Sileo.error({ title: 'Error', description: err.message || 'Error desconocido' });
      return Promise.reject(err);
    });
  }

  /* F18 (2026-06-20): KPIs computados desde los items del cronograma (store + Excel) */
  function _computeKpisCronograma(items) {
    var total = items.length;
    var pendientes = items.filter(function (i) { return i.estado === 'pendiente' || (!i.estado && i.fuente === 'excel'); }).length;
    var enCurso = items.filter(function (i) { return i.estado === 'en_curso'; }).length;
    var completados = items.filter(function (i) { return i.estado === 'completado'; }).length;
    var vencidos = items.filter(function (i) { return i.estado === 'vencido'; }).length;
    return { total: total, pendientes: pendientes, enCurso: enCurso, completados: completados, vencidos: vencidos };
  }

  function _getAllItems(audits, year) {
    var all = [];
    audits.forEach(function (a) {
      (a.cronograma || []).forEach(function (c) {
        all.push(Object.assign({}, c, {
          auditCode: a.code,
          auditProcess: a.process,
          auditId: a.id
        }));
      });
    });
    /* F21.23 (2026-06-20): incluir items libres (texto sin auditoría asociada). */
    var freeItems = (KairStore.getState && KairStore.getState().freeCronograma) || [];
    freeItems.forEach(function (c) {
      all.push(Object.assign({}, c, {
        auditCode: c.auditLabel || c.auditCode || 'Libre',
        auditProcess: c.auditLabel ? '(texto libre)' : '',
        auditId: ''  // sin asociación
      }));
    });
    return all.filter(function (i) { return i.anio === year; });
  }

  function _renderHeader(year, years) {
    /* F16 (2026-06-20): Header estándar K+AIR · mismo patrón que HUB y 6.1.3.
       F21.27 (2026-06-20): el selector de año y los tabs de fase se movieron
       a _renderCronToolbar (barra separada, según mockup del usuario). */
    var company = (window.KairMockData && window.KairMockData.ACTIVE_COMPANY && window.KairMockData.ACTIVE_COMPANY.nombre) || 'Empresa';
    var anioTieneArchivo = _state.aniosConArchivo.indexOf(year) !== -1;
    return '<header class="k-module-header">' +
      '<div class="k-header-left">' +
        '<div class="k-header-title-group">' +
          '<div class="k-header-main-title">' +
            '<i class="bi bi-calendar3"></i> ' +
            'Cronograma Anual de Auditorías' +
          '</div>' +
          '<div class="k-header-breadcrumb">' +
            '<span>' + _esc(company) + '</span>' +
            '<i class="bi bi-chevron-right"></i>' +
            '<button type="button" data-back-module="1">Verificación</button>' +
            '<i class="bi bi-chevron-right"></i>' +
            '<button type="button" data-go-hub="1">6.1.2 Auditoría Anual</button>' +
            '<i class="bi bi bi-chevron-right"></i>' +
            '<span class="k-breadcrumb-item active">Cronograma</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="k-header-right">' +
        '<span class="k-sync-badge k-sync-synced" title="Datos cargados">' +
          '<i class="bi bi-check-circle-fill"></i> Sincronizado' +
        '</span>' +
        '<button type="button" class="header-back-btn" data-go-hub="1" title="Volver al Hub del submódulo">' +
          '<i class="bi bi-arrow-left"></i> Hub' +
        '</button>' +
        /* F21.11: si el año NO tiene archivo, mostrar "Crear archivo" en lugar
           de "Nuevo hito". */
        (anioTieneArchivo
          ? '<button type="button" class="k-btn k-btn-primary k-btn-sm" id="kair-v3-cron-new" title="Crear nuevo hito">' +
              '<i class="bi bi-plus-lg"></i> Nuevo hito' +
            '</button>'
          : '<button type="button" class="k-btn k-btn-success k-btn-sm" data-action="crear-cronograma" title="Crear archivo Excel plantilla oficial ' + year + '">' +
              '<i class="bi bi-file-earmark-excel"></i> Crear archivo ' + year +
            '</button>') +
      '</div>' +
    '</header>';
  }

  /* F21.27 (2026-06-20): barra de herramientas del cronograma.
       Estructura: [< año >] | FASE: [tabs] ........ [contador hitos]
       Sigue el mockup del usuario. */
  function _renderCronToolbar(items) {
    var fasesParaToolbar = _getFasesParaCalendar();
    var yearIdx = _state.years.indexOf(_state.year);
    var hasPrev = yearIdx > 0;
    var hasNext = yearIdx >= 0 && yearIdx < _state.years.length - 1;
    /* Si el año actual no está en la lista, no permitir navegar. */
    var canNavigate = yearIdx !== -1;

    var phaseTabs = '<button type="button" class="kair-v3-cron-phase' + (_state.faseFilter === 'todas' ? ' kair-v3-cron-phase--active' : '') + '" data-set-fase="todas" style="background:' + (_state.faseFilter === 'todas' ? '#1a73e8' : '#f1f3f4') + ';color:' + (_state.faseFilter === 'todas' ? '#fff' : '#3c4043') + ';">' +
      '<span class="kair-v3-cron-phase__label">Todas</span>' +
      '<span class="kair-v3-cron-phase__count" style="background:' + (_state.faseFilter === 'todas' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.1)') + ';">' + items.length + '</span>' +
    '</button>' +
    fasesParaToolbar.map(function (f) {
      var count = items.filter(function (i) { return i.fase === f.id; }).length;
      var active = _state.faseFilter === f.id;
      return '<button type="button" class="kair-v3-cron-phase' + (active ? ' kair-v3-cron-phase--active' : '') + '" data-set-fase="' + _esc(f.id) + '" ' +
        'style="background:' + (active ? f.color : f.bg) + ';color:' + (active ? '#fff' : f.color) + ';" title="' + _esc(f.label) + '">' +
        '<span class="kair-v3-cron-phase__dot" style="background:' + (active ? '#fff' : f.color) + ';"></span>' +
        '<span class="kair-v3-cron-phase__label">' + _esc(f.label) + '</span>' +
        '<span class="kair-v3-cron-phase__count" style="background:' + (active ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)') + ';">' + count + '</span>' +
      '</button>';
    }).join('');

    return '<div class="kair-v3-cron-toolbar">' +
      '<div class="kair-v3-cron-toolbar__left">' +
        '<button type="button" class="kair-v3-cron-nav" data-year-prev' +
          (hasPrev ? '' : ' disabled') +
          ' title="Año anterior"' +
          (canNavigate ? '' : ' disabled') +
          '><i class="bi bi-chevron-left"></i></button>' +
        '<div class="kair-v3-cron-year-badge">' +
          '<i class="bi bi-calendar3"></i>' +
          '<span>' + _state.year + '</span>' +
        '</div>' +
        '<button type="button" class="kair-v3-cron-nav" data-year-next' +
          (hasNext ? '' : ' disabled') +
          ' title="Año siguiente"' +
          (canNavigate ? '' : ' disabled') +
          '><i class="bi bi-chevron-right"></i></button>' +
        '<div class="kair-v3-cron-toolbar__divider"></div>' +
        '<span class="kair-v3-cron-toolbar__label">FASE:</span>' +
        phaseTabs +
      '</div>' +
      '<div class="kair-v3-cron-toolbar__right">' +
        '<span class="kair-v3-cron-toolbar__count">' + items.length + ' hitos en ' + _state.year + '</span>' +
      '</div>' +
    '</div>';
  }

  function _renderKpis(kpis) {
    var items = [
      { label: 'Total hitos', value: kpis.total, color: 'primary', icon: 'calendar-event' },
      { label: 'Pendientes', value: kpis.pendientes, color: 'neutral', icon: 'clock' },
      { label: 'En curso', value: kpis.enCurso, color: 'warning', icon: 'arrow-repeat' },
      { label: 'Completados', value: kpis.completados, color: 'success', icon: 'check-circle' },
      { label: 'Vencidos', value: kpis.vencidos, color: 'danger', icon: 'exclamation-triangle' }
    ];
    return '<div class="kair-v3-kpi-strip">' +
      items.map(function (k) {
        return '<div class="kair-v3-kpi kair-v3-kpi--' + k.color + '">' +
          '<div class="kair-v3-kpi__icon"><i class="bi bi-' + k.icon + '"></i></div>' +
          '<div class="kair-v3-kpi__content">' +
            '<div class="kair-v3-kpi__value">' + k.value + '</div>' +
            '<div class="kair-v3-kpi__label">' + k.label + '</div>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  /* F21.7 (2026-06-20): Panel con info del archivo Excel detectado.
     Muestra: archivo, ruta, carpeta, año detectado vs solicitado, fases, hitos. */
  function _renderExcelInfo() {
    if (!_state.excelArchivo) return '';
    var fasesList = _state.excelFases.map(function (f) {
      return '<span class="kair-v3-badge kair-v3-badge--soft-neutral" style="background:#e8eaed;color:#3c4043;font-size:0.6875rem;margin:2px;">' + _esc(f.label) + '</span>';
    }).join('');
    var avisoHtml = '';
    if (_state.excelAviso) {
      avisoHtml = '<div style="background:#fff3cd;border:1px solid #ffc107;color:#856004;padding:.625rem .875rem;border-radius:6px;font-size:.8125rem;margin-top:.5rem;">' +
        '<i class="bi bi-exclamation-triangle-fill"></i> ' + _esc(_state.excelAviso) +
      '</div>';
    }
    return '<section class="kair-v3-section-card" style="border-left:4px solid #1a73e8;">' +
      '<div class="kair-v3-section-card__body" style="padding:.875rem 1rem;">' +
        '<div class="kair-v3-row" style="justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.75rem;">' +
          '<div style="flex:1;min-width:280px;">' +
            '<div class="kair-v3-row" style="gap:.5rem;margin-bottom:.25rem;">' +
              '<i class="bi bi-file-earmark-excel" style="color:#1a73e8;font-size:1.125rem;"></i>' +
              '<strong style="font-size:.875rem;">' + _esc(_state.excelArchivo) + '</strong>' +
            '</div>' +
            '<div style="font-size:.75rem;color:var(--v3-muted-foreground);font-family:monospace;word-break:break-all;">' +
              'Carpeta: <strong>' + _esc(_state.excelCarpeta || '?') + '</strong> · ' +
              'Año detectado: <strong>' + _esc(String(_state.excelAnioDetectado || '?')) + '</strong>' +
              (_state.excelAnioSolicitado && _state.excelAnioSolicitado !== _state.excelAnioDetectado
                ? ' · Solicitado: <strong>' + _esc(String(_state.excelAnioSolicitado)) + '</strong>'
                : '') +
            '</div>' +
          '</div>' +
          '<div style="text-align:right;font-size:.75rem;color:var(--v3-muted-foreground);">' +
            '<div><strong style="color:var(--v3-foreground);">' + _state.excelFases.length + '</strong> fases detectadas</div>' +
            '<div><strong style="color:var(--v3-foreground);">' + _state.excelHitos.length + '</strong> hitos diligenciados</div>' +
          '</div>' +
        '</div>' +
        (fasesList ? '<div style="margin-top:.5rem;display:flex;flex-wrap:wrap;gap:2px;">' + fasesList + '</div>' : '') +
        avisoHtml +
      '</div>' +
    '</section>';
  }

  /* F21.15 (2026-06-20): Mapea el nombre de una fase a un color de la paleta.
     Usa matching semántico por palabras clave. El orden importa: las regex más
     específicas van primero (ej: "implementación" antes que "plan de acción",
     porque "Implementación de Plan de acción" contiene ambas). */
  function _mapFaseToPalette(label) {
    var lower = String(label || '').toLowerCase();
    /* 1) Implementación / seguimiento → success (verde) — evaluar primero */
    if (/implem|seguim/.test(lower))                              return FASES_PALETTE[3];
    /* 2) Plan de acción / acciones correctivas → warning (amarillo) */
    if (/plan\s+de\s+acci[oó]n|acci[oó]n\s+correct/.test(lower)) return FASES_PALETTE[2];
    /* 3) Preparación / planeación → primary (azul) */
    if (/preparac|inicial|planeaci/.test(lower))                  return FASES_PALETTE[0];
    /* 4) Realización / ejecución → info (gris) */
    if (/realiz|ejecu/.test(lower))                               return FASES_PALETTE[1];
    /* 5) Auditoría / informe / reporte → info (gris) */
    if (/auditor|informe|reporte/.test(lower))                    return FASES_PALETTE[1];
    /* 6) Mejoramiento → warning (amarillo) */
    if (/mejoram/.test(lower))                                    return FASES_PALETTE[2];
    return null; /* sin match → usar fallback por índice */
  }

  /* F21.7 (2026-06-20): Obtiene la lista de fases a usar en el calendar.
     Si el Excel tiene fases detectadas, usa esas (con sus nombres reales) +
     mapeo semántico de colores de la paleta de la app.
     Si no, usa las FASES hardcoded como fallback. */
  function _getFasesParaCalendar() {
    if (_state.excelFases && _state.excelFases.length > 0) {
      var fallbackIdx = 0;
      return _state.excelFases.map(function (f, idx) {
        var palette = _mapFaseToPalette(f.label);
        if (!palette) {
          palette = FASES_PALETTE[fallbackIdx % FASES_PALETTE.length];
          fallbackIdx++;
        }
        return {
          id: f.key || ('fase_' + (idx + 1)),
          label: f.label,
          short: f.label.substring(0, 12),
          color: palette.color,
          bg: palette.bg
        };
      });
    }
    return FASES;
  }

  function _renderCalendar(items, audits) {
    /* F21.26 (2026-06-20): FIX — _renderCalendar ahora tiene UNA sola llave de
       cierre al final (antes el cierre se duplicaba y rompía la declaración
       de _renderLeyenda). Reestructurado para early-return del empty state
       y luego el return normal del grid. */

    /* Agrupar hitos por auditId (los items libres con auditLabel se agrupan
       bajo un id sintético para que cada "fila" sea una auditoría distinta). */
    var gruposPorAudit = {};
    var ordenAuditorias = [];
    items.forEach(function (i) {
      var key = i.auditId || ('__libre__:' + (i.auditLabel || 'sin-nombre'));
      if (!gruposPorAudit[key]) {
        gruposPorAudit[key] = {
          id: i.auditId || '',
          label: i.auditLabel || '',
          code: i.auditCode || i.auditLabel || 'Sin auditoría',
          process: i.auditProcess || '',
          items: []
        };
        ordenAuditorias.push(key);
      }
      gruposPorAudit[key].items.push(i);
    });

    /* Si no hay hitos, mostrar mensaje (early return). */
    if (ordenAuditorias.length === 0) {
      return '<section class="kair-v3-section-card" style="overflow-x:auto;">' +
        '<header class="kair-v3-section-card__head">' +
          '<h3 class="kair-v3-section-card__title"><i class="bi bi-calendar3"></i> Vista anual ' + _state.year + '</h3>' +
          KairUI.Badge({ variant: 'info', children: '0 hitos' }) +
        '</header>' +
        '<div class="kair-v3-section-card__body">' +
          '<div style="text-align:center;padding:2.5rem 1rem;color:var(--v3-muted-foreground);">' +
            '<i class="bi bi-calendar-x" style="font-size:2rem;display:block;margin-bottom:.5rem;"></i>' +
            'No hay hitos registrados para ' + _state.year + '. Usa el botón "Nuevo hito" para empezar.' +
          '</div>' +
        '</div>' +
      '</section>';
    }

    return '<section class="kair-v3-section-card" style="overflow-x:auto;">' +
      '<div class="kair-v3-section-card__body" style="padding:0;">' +
        '<div class="kair-v3-cron-grid">' +
          /* Header: columna izquierda vacía + meses */
          '<div class="kair-v3-cron-grid__head">' +
            '<div class="kair-v3-cron-grid__corner">AUDITORÍA</div>' +
            KairHelpers.MONTHS_SHORT_ES.map(function (m) {
              return '<div class="kair-v3-cron-grid__month">' + m + '</div>';
            }).join('') +
          '</div>' +
          /* Filas por auditoría */
          ordenAuditorias.map(function (key) {
            var g = gruposPorAudit[key];
            var displayName = g.label
              ? '<strong>' + _esc(g.label) + '</strong>'
              : '<strong>' + _esc(g.process || g.code || '—') + '</strong>';
            var subName = g.label ? '<span style="color:var(--v3-muted-foreground);font-weight:400;">(texto libre)</span>' : _esc(g.code || '');
            return '<div class="kair-v3-cron-grid__row">' +
              '<div class="kair-v3-cron-grid__audit" title="' + _esc((g.process || '') + ' · ' + (g.code || '')) + '">' +
                '<div class="kair-v3-cron-grid__audit-icon"><i class="bi bi-clipboard-data"></i></div>' +
                '<div class="kair-v3-cron-grid__audit-body">' +
                  displayName +
                  '<div style="font-size:0.75rem;color:var(--v3-muted-foreground);font-weight:500;">' + subName + '</div>' +
                '</div>' +
              '</div>' +
              KairHelpers.MONTHS_SHORT_ES.map(function (_, mesIdx) {
                var mes = mesIdx + 1;
                var cellItems = g.items.filter(function (i) { return i.mes === mes; });
                var cards = cellItems.map(function (i) {
                  var faseInfo = _getFasesParaCalendar().find(function (f) { return f.id === i.fase; })
                    || { color: 'var(--v3-info)', bg: 'var(--v3-info-soft)', label: i.fase, short: i.fase };
                  var dia = (i.dia || i.day) ? String(i.dia || i.day).padStart(2, '0') : '—';
                  var fechaMostrar = dia + '/' + String(mes).padStart(2, '0');
                  var estadoLabel = KairHelpers.cronogramaItemStatusLabel[i.estado] || i.estado || 'pendiente';
                  return '<div class="kair-v3-cron-hito" data-edit-hito="' + _esc(i.id) + '" data-audit-id="' + _esc(i.auditId || '') + '" ' +
                    'style="background:' + faseInfo.bg + ';border:1px solid ' + faseInfo.color + ';border-left:3px solid ' + faseInfo.color + ';" ' +
                    'title="' + _esc(faseInfo.label + ' · ' + fechaMostrar + ' · ' + estadoLabel) + '">' +
                    '<div class="kair-v3-cron-hito__head">' +
                      '<span class="kair-v3-cron-hito__dot" style="background:' + faseInfo.color + ';"></span>' +
                      '<span class="kair-v3-cron-hito__fase" style="color:' + faseInfo.color + ';">' + _esc(faseInfo.short || faseInfo.label) + '</span>' +
                    '</div>' +
                    '<div class="kair-v3-cron-hito__fecha">' + fechaMostrar + '</div>' +
                    '<div class="kair-v3-cron-hito__estado">' + _esc(estadoLabel.toUpperCase()) + '</div>' +
                  '</div>';
                }).join('');
                if (cellItems.length === 0) {
                  return '<div class="kair-v3-cron-grid__cell kair-v3-cron-grid__cell--empty" ' +
                    'data-add-cell="' + _esc(g.id) + '" ' +
                    'data-add-mes="' + mes + '" ' +
                    'data-add-audit-label="' + _esc(g.label || '') + '" ' +
                    'title="Click para agregar hito en ' + KairHelpers.MONTHS_ES[mesIdx] + '">' +
                    '<span class="kair-v3-cron-grid__plus">+</span>' +
                  '</div>';
                }
                return '<div class="kair-v3-cron-grid__cell kair-v3-cron-grid__cell--has">' + cards + '</div>';
              }).join('') +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</section>';
  }

  /* F21.25 (2026-06-20): leyenda con los colores de las fases (mockup usuario). */
  function _renderLeyenda() {
    var fases = _getFasesParaCalendar();
    return '<div class="kair-v3-cron-leyenda">' +
      '<span class="kair-v3-cron-leyenda__label">LEYENDA:</span>' +
      fases.map(function (f) {
        return '<span class="kair-v3-cron-leyenda__item">' +
          '<span class="kair-v3-cron-leyenda__dot" style="background:' + f.color + ';"></span>' +
          '<span class="kair-v3-cron-leyenda__text">' + _esc(f.label) + '</span>' +
        '</span>';
      }).join('') +
    '</div>';
  }

  function _renderList(items, audits) {
    /* F21.7: usa fases dinámicas del Excel. Si no hay hitos pero hay archivo, muestra mensaje claro. */
    var fasesParaLista = _getFasesParaCalendar();
    var emptyMessage = _state.excelArchivo
      ? 'El archivo <strong>' + _esc(_state.excelArchivo) + '</strong> no tiene hitos diligenciados para ' + _state.year + '. Puedes editarlo directamente en Excel, o agregar hitos aquí haciendo click en cualquier celda vacía del calendario, o usar el botón "Nuevo hito".'
      : 'No hay hitos registrados para este año. Crea uno con el botón "Nuevo hito".';
    return '<section class="kair-v3-section-card">' +
      '<header class="kair-v3-section-card__head">' +
        '<h3 class="kair-v3-section-card__title"><i class="bi bi-list-task"></i> Listado cronológico</h3>' +
        KairUI.Badge({ variant: 'info', children: items.length + ' hitos' }) +
      '</header>' +
      '<div class="kair-v3-section-card__body">' +
        (items.length === 0
          ? '<div style="text-align:center;padding:1.5rem 1rem;color:var(--v3-muted-foreground);font-size:.875rem;">' +
              '<i class="bi bi-info-circle" style="font-size:1.5rem;display:block;margin-bottom:.5rem;"></i>' +
              emptyMessage +
            '</div>'
          : '<div class="kair-v3-stack">' +
            fasesParaLista.map(function (fase) {
              var faseItems = items.filter(function (i) { return i.fase === fase.id; });
              if (faseItems.length === 0) return '';
              return '<div class="kair-v3-stack kair-v3-stack--sm">' +
                '<div class="kair-v3-row">' +
                  '<span class="kair-v3-badge kair-v3-badge--soft-primary" style="background:' + fase.bg + ';color:' + fase.color + ';">' + _esc(fase.label) + '</span>' +
                  '<span style="font-size:0.8125rem;color:var(--v3-muted-foreground);">' + faseItems.length + ' hitos</span>' +
                '</div>' +
                faseItems.sort(function (a, b) { return a.mes - b.mes; }).map(function (i) {
                  return '<div class="kair-v3-cron-list-item" data-edit-hito="' + _esc(i.id) + '" data-audit-id="' + _esc(i.auditId) + '">' +
                    '<div class="kair-v3-cron-list-item__mes" style="background:' + fase.color + ';">' + _shortMonth(i.mes) + '</div>' +
                    '<div class="kair-v3-cron-list-item__body">' +
                      '<div class="kair-v3-cron-list-item__title">' + _esc(i.auditProcess || '—') + '</div>' +
                      '<div class="kair-v3-cron-list-item__sub">' + _esc(i.auditCode || '—') + (i.observaciones ? ' · ' + _esc(i.observaciones) : '') + '</div>' +
                    '</div>' +
                    KairUI.Badge({ variant: KairHelpers.cronogramaItemStatusBadge[i.estado] || 'neutral', dot: true, children: KairHelpers.cronogramaItemStatusLabel[i.estado] || i.estado }) +
                    '<div class="kair-v3-row">' +
                      KairUI.Button({ size: 'sm', variant: 'ghost', icon: 'pencil', dataAttrs: { 'edit-hito': i.id, 'edit-audit': i.auditId }, title: 'Editar hito' }) +
                      KairUI.Button({ size: 'sm', variant: 'ghost', icon: 'trash', dataAttrs: { 'remove-hito': i.id }, title: 'Eliminar hito' }) +
                    '</div>' +
                  '</div>';
                }).join('') +
              '</div>';
            }).join('') +
          '</div>') +
      '</div>' +
    '</section>';
  }

  function _renderEditingDialog(editing, year) {
    if (!editing) return '';
    var isNew = editing.isNew;
    /* F21.8 (2026-06-20): usar fases dinámicas del Excel cuando existan. */
    var fasesParaDialog = _getFasesParaCalendar();
    var faseDefaultId = fasesParaDialog[0] ? fasesParaDialog[0].id : 'preparacion';
    var i = editing.item || { fase: faseDefaultId, mes: 1, anio: year, estado: 'pendiente' };
    var auditOptions = KairStore.selectAudits().map(function (a) {
      return '<option value="' + _esc(a.id) + '"' + (editing.auditId === a.id ? ' selected' : '') + '>' + _esc(a.code + ' · ' + (a.process || '').substring(0, 40)) + '</option>';
    }).join('');
    var faseOptions = fasesParaDialog.map(function (f) {
      return '<option value="' + _esc(f.id) + '"' + (i.fase === f.id ? ' selected' : '') + '>' + _esc(f.label) + '</option>';
    }).join('');
    var mesOptions = KairHelpers.MONTHS_ES.map(function (m, idx) {
      return '<option value="' + (idx + 1) + '"' + (i.mes === (idx + 1) ? ' selected' : '') + '>' + m + '</option>';
    }).join('');
    var estadoOptions = ['pendiente', 'en_curso', 'completado', 'vencido'].map(function (e) {
      return '<option value="' + e + '"' + (i.estado === e ? ' selected' : '') + '>' + _esc(KairHelpers.cronogramaItemStatusLabel[e] || e) + '</option>';
    }).join('');

    /* F21.23 (2026-06-20): CAMBIO a input libre con datalist (combobox nativo).
       - El usuario puede escribir cualquier texto (auditoría nueva / libre)
       - El datalist sugiere las auditorías existentes como typeahead
       - Al guardar, si el texto coincide con una existente → vincula por id;
         si no → guarda el texto como auditLabel (texto libre).
       Esto resuelve la queja: "no debería poder escribir?" */
    var auditSuggestions = KairStore.selectAudits().map(function (a) {
      var label = (a.code || '') + ' · ' + ((a.process || '').substring(0, 50));
      return '<option value="' + _esc(label) + '" data-audit-id="' + _esc(a.id) + '"></option>';
    }).join('');

    /* F21.25 (2026-06-20): valor inicial del input al crear/editar.
       - Editar: si tiene auditLabel mostrar ese texto; si no, buscar la auditoría
         y mostrar "code · process"
       - Crear: si hay auditLabel (texto libre desde la fila) usarlo; si hay
         auditId (auditoría existente desde la fila) buscar y pre-llenar. */
    var initialAuditValue = '';
    if (!isNew) {
      if (i.auditLabel) {
        initialAuditValue = i.auditLabel;
      } else if (i.auditCode) {
        initialAuditValue = (i.auditCode || '') + ' · ' + ((i.auditProcess || '').substring(0, 50));
      }
    } else {
      if (editing.auditLabel) {
        initialAuditValue = editing.auditLabel;
      } else if (editing.auditId) {
        var preAud = KairStore.selectAudits().find(function (a) { return a.id === editing.auditId; });
        if (preAud) {
          initialAuditValue = (preAud.code || '') + ' · ' + ((preAud.process || '').substring(0, 50));
        }
      }
    }

    var auditField = isNew
      ? '<label class="kair-v3-stack kair-v3-stack--sm">' +
          '<span class="kair-v3-field__label">Auditoría <em class="kair-v3-field__required">*</em></span>' +
          '<div class="kair-v3-input-wrap">' +
            '<i class="bi bi-clipboard-data"></i>' +
            '<input type="text" class="kair-v3-input" id="kair-v3-hito-audit" ' +
              'list="kair-v3-hito-audit-list" ' +
              'autocomplete="off" ' +
              'placeholder="Escribe o selecciona una auditoría" ' +
              'value="' + _esc(initialAuditValue) + '">' +
            '<datalist id="kair-v3-hito-audit-list">' + auditSuggestions + '</datalist>' +
          '</div>' +
          '<span class="kair-v3-field__hint">Podés escribir una auditoría nueva o elegir una existente del listado.</span>' +
        '</label>'
      : '<input type="hidden" id="kair-v3-hito-audit" value="' + _esc(editing.auditId || '') + '">' +
        '<label class="kair-v3-stack kair-v3-stack--sm">' +
          '<span class="kair-v3-field__label">Auditoría</span>' +
          '<div class="kair-v3-input-wrap">' +
            '<i class="bi bi-clipboard-data"></i>' +
            '<div class="kair-v3-input" style="background:var(--v3-muted);font-weight:600;">' +
              (i.auditLabel
                ? _esc(i.auditLabel) + ' <span style="font-weight:400;color:var(--v3-muted-foreground);font-size:0.8125rem;">· (texto libre)</span>'
                : _esc(i.auditCode || '') + ' · ' + _esc((i.auditProcess || '').substring(0, 60))) +
            '</div>' +
          '</div>' +
        '</label>';

    return '<div class="kair-v3-dialog-overlay kair-v3-dialog-overlay--open" id="kair-v3-hito-dialog">' +
      '<div class="kair-v3-dialog" style="max-width:540px;">' +
        '<div class="kair-v3-dialog__header">' +
          '<div style="flex:1;min-width:0;">' +
            '<h3 class="kair-v3-dialog__title"><i class="bi bi-calendar-plus"></i> ' + (isNew ? 'Nuevo hito' : 'Editar hito') + '</h3>' +
            '<p class="kair-v3-dialog__description">' + (isNew ? 'Programa un nuevo hito en el cronograma anual.' : 'Modifica el hito del cronograma.') + '</p>' +
          '</div>' +
          '<button class="kair-v3-dialog__close" data-dialog-close aria-label="Cerrar">&times;</button>' +
        '</div>' +
        '<div class="kair-v3-dialog__body">' +
          '<div class="kair-v3-stack">' +
            auditField +
            '<div class="kair-v3-form-grid-2">' +
              '<label class="kair-v3-stack kair-v3-stack--sm">' +
                '<span class="kair-v3-field__label">Fase <em class="kair-v3-field__required">*</em></span>' +
                '<div class="kair-v3-input-wrap">' +
                  '<i class="bi bi-flag"></i>' +
                  '<select class="kair-v3-input" id="kair-v3-hito-fase" style="appearance:none;cursor:pointer;background-image:url(\'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235a6378%22 stroke-width=%222.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpolyline points=%226 9 12 15 18 9%22/%3E%3C/svg%3E\');background-repeat:no-repeat;background-position:right 0.625rem center;background-size:14px 14px;padding-right:2.25rem;">' + faseOptions + '</select>' +
                '</div>' +
              '</label>' +
              '<label class="kair-v3-stack kair-v3-stack--sm">' +
                '<span class="kair-v3-field__label">Mes <em class="kair-v3-field__required">*</em></span>' +
                '<div class="kair-v3-input-wrap">' +
                  '<i class="bi bi-calendar3"></i>' +
                  '<select class="kair-v3-input" id="kair-v3-hito-mes" style="appearance:none;cursor:pointer;background-image:url(\'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235a6378%22 stroke-width=%222.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpolyline points=%226 9 12 15 18 9%22/%3E%3C/svg%3E\');background-repeat:no-repeat;background-position:right 0.625rem center;background-size:14px 14px;padding-right:2.25rem;">' + mesOptions + '</select>' +
                '</div>' +
              '</label>' +
            '</div>' +
            '<div class="kair-v3-form-grid-2">' +
              '<label class="kair-v3-stack kair-v3-stack--sm">' +
                '<span class="kair-v3-field__label">Año <em class="kair-v3-field__required">*</em></span>' +
                '<div class="kair-v3-input-wrap">' +
                  '<i class="bi bi-hash"></i>' +
                  '<input type="number" class="kair-v3-input" id="kair-v3-hito-anio" value="' + (i.anio || year) + '" min="2020" max="2099">' +
                '</div>' +
              '</label>' +
              '<label class="kair-v3-stack kair-v3-stack--sm">' +
                '<span class="kair-v3-field__label">Estado</span>' +
                '<div class="kair-v3-input-wrap">' +
                  '<i class="bi bi-circle-fill" id="kair-v3-hito-estado-icon"></i>' +
                  '<select class="kair-v3-input" id="kair-v3-hito-estado" style="appearance:none;cursor:pointer;background-image:url(\'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235a6378%22 stroke-width=%222.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpolyline points=%226 9 12 15 18 9%22/%3E%3C/svg%3E\');background-repeat:no-repeat;background-position:right 0.625rem center;background-size:14px 14px;padding-right:2.25rem;">' + estadoOptions + '</select>' +
                '</div>' +
              '</label>' +
            '</div>' +
            '<label class="kair-v3-stack kair-v3-stack--sm">' +
              '<span class="kair-v3-field__label">Observaciones</span>' +
              '<div class="kair-v3-input-wrap" style="align-items:flex-start;">' +
                '<i class="bi bi-journal-text" style="top:0.625rem;"></i>' +
                '<textarea class="kair-v3-textarea" id="kair-v3-hito-obs" rows="2" style="padding-left:2.25rem;" placeholder="Detalles del hito, responsable, etc.">' + _esc(i.observaciones || '') + '</textarea>' +
              '</div>' +
            '</label>' +
          '</div>' +
        '</div>' +
        '<div class="kair-v3-dialog__footer">' +
          KairUI.Button({ variant: 'ghost', label: 'Cancelar', dataAttrs: { 'dialog-close': '1' } }) +
          KairUI.Button({ variant: 'primary', icon: 'check-lg', label: 'Guardar hito', dataAttrs: { 'save-hito': '1', 'hito-id': i.id || '', 'is-new': isNew ? '1' : '' } }) +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function render(container) {
    /* F18-F20 (2026-06-20): Auto-carga el GI-FO-062 del repositorio al entrar */
    if (!_excelLoaded && !_state.loading && window.electronAPI && window.electronAPI.auditoriaAnual && window.electronAPI.auditoriaAnual.cargarCronograma) {
      _state.loading = true;
      _loadCronogramaFromExcel().then(function () {
        _state.loading = false;
        _excelLoaded = true;
        render(container); // re-render con datos cargados
      });
      // Mientras carga, mostrar UI con mensaje de carga
      container.innerHTML =
        '<div class="kair-v3-hub">' +
          _renderHeader(_state.year, [_state.year]) +
          '<main class="kair-v3-hub-main" style="align-items:center;justify-content:center;">' +
            '<div style="padding:2rem;text-align:center;color:var(--v3-muted-foreground);">' +
              '<i class="bi bi-hourglass-split" style="font-size:2rem;display:block;margin-bottom:0.5rem;"></i>' +
              '<span>Cargando cronograma desde el repositorio...</span>' +
            '</div>' +
          '</main>' +
        '</div>';
      return;
    }

    /* F21.11 (2026-06-20): empty state cuando NO hay archivo Excel para el año.
       Ofrece dos caminos: crear el archivo Excel (plantilla oficial) o programar
       hitos manualmente desde la app (se guardan en SQLite). */
    if (_state.sinDatosParaYear) {
      container.innerHTML =
        '<div class="kair-v3-hub">' +
          _renderHeader(_state.year, years) +
          '<main class="kair-v3-hub-main">' +
            '<section class="kair-v3-section-card" style="padding:2.5rem 2rem;">' +
              '<div style="text-align:center;max-width:640px;margin:0 auto;">' +
                '<i class="bi bi-calendar-plus" style="font-size:2.5rem;color:var(--v3-muted-foreground);display:block;margin-bottom:.75rem;"></i>' +
                '<h3 style="margin:0 0 .5rem;font-size:1.125rem;color:var(--v3-foreground);">No hay cronograma para ' + _state.year + '</h3>' +
                '<p style="margin:0 0 1.25rem;color:var(--v3-muted-foreground);font-size:.875rem;">Puedes crear la plantilla oficial del GI-FO-062 para archivar en la empresa, o programar los hitos manualmente desde la app (se guardan en la base de datos local).</p>' +
                '<div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;">' +
                  '<button type="button" class="k-btn k-btn-primary" data-action="crear-cronograma" title="Crear archivo Excel plantilla ' + _state.year + '">' +
                    '<i class="bi bi-file-earmark-excel"></i> Crear archivo Excel ' + _state.year +
                  '</button>' +
                  '<button type="button" class="k-btn k-btn-outline" data-action="programar-manual" title="Agregar hitos manualmente desde la app">' +
                    '<i class="bi bi-plus-circle"></i> Programar hitos manualmente' +
                  '</button>' +
                '</div>' +
                (_state.aniosConArchivo.length > 0
                  ? '<p style="margin:1.5rem 0 0;color:var(--v3-muted-foreground);font-size:.8125rem;">Años con archivo existente: ' +
                    _state.aniosConArchivo.map(function (y) { return '<strong>' + y + '</strong>'; }).join(', ') +
                  '</p>'
                  : '') +
              '</div>' +
            '</section>' +
          '</main>' +
        '</div>';
      _bindEmptyEvents(container);
      return;
    }

    var audits = KairStore.selectAudits();
    var years = (function () {
      var ys = new Set();
      audits.forEach(function (a) { (a.cronograma || []).forEach(function (c) { ys.add(c.anio); }); });
      _state.excelHitos.forEach(function (h) { if (h.anio) ys.add(h.anio); });
      /* F21.9 (2026-06-20): incluir el año detectado del archivo aunque no tenga hitos,
         para que aparezca en el selector y el usuario pueda navegar a él. */
      if (_state.excelAnioDetectado) ys.add(_state.excelAnioDetectado);
      /* F21.12 (2026-06-20): incluir años que tienen archivo en disco aunque
         el año seleccionado actual no tenga (para que el selector permita navegar). */
      if (_state.aniosConArchivo && _state.aniosConArchivo.length > 0) {
        _state.aniosConArchivo.forEach(function (y) { ys.add(y); });
      }
      /* F21.28 (2026-06-20): incluir también años de hitos guardados en el store
         (incluye freeCronograma). Esto permite que después de crear un hito
         en un año que NO tiene archivo Excel, el usuario pueda navegar a ese
         año con los botones < >. */
      try {
        var freeStore = (KairStore.getState && KairStore.getState().freeCronograma) || [];
        freeStore.forEach(function (c) { if (c.anio) ys.add(c.anio); });
      } catch (e) { /* KairStore no disponible aún */ }
      /* F21.28: siempre incluir el año actual para que la navegación pueda
         volver a él aunque no tenga archivo ni hitos. */
      if (_state.year) ys.add(_state.year);
      /* F21.30 (2026-06-20): orden ASCENDENTE para que la navegación con
         botones < > sea intuitiva (atrás = menor, adelante = mayor).
         Antes era descendente y eso invertía el sentido. */
      return Array.from(ys).sort(function (a, b) { return a - b; });
    })();
    _state.years = years;
    /* F21.12: si el año seleccionado no está en el selector (porque no tiene archivo),
       forzar al año más reciente con archivo. */
    if (years.length > 0 && years.indexOf(_state.year) === -1) {
      _state.year = years[0];
    }
    var storeItems = _getAllItems(audits, _state.year);
    /* Combinar items del store + items del Excel (Excel tiene prioridad si no hay match) */
    var excelItems = _state.excelHitos.map(function (h, idx) {
      return {
        id: 'excel-' + h.anio + '-' + h.mes + '-' + h.fase + '-' + idx,
        auditId: 'excel-' + (h.anio || 'x'),
        auditCode: 'GI-FO-062',
        auditProcess: h.faseLabel || h.fase,
        anio: h.anio,
        mes: h.mes,
        fase: h.fase,
        observaciones: h.descripcion,
        estado: 'programado',
        fuente: 'excel'
      };
    });
    var allItems = storeItems.concat(excelItems);
    var items = allItems.filter(function (i) { return i.anio === _state.year; });
    var filtered = _state.faseFilter === 'todas' ? items : items.filter(function (i) { return i.fase === _state.faseFilter; });
    var kpis = _computeKpisCronograma(items);

    container.innerHTML =
      '<div class="kair-v3-hub">' +
        _renderHeader(_state.year, years) +
        '<main class="kair-v3-hub-main">' +
          _renderKpis(kpis) +
          /* F21.27 (2026-06-20): barra de herramientas del cronograma
             (selector de año con < > + tabs de fase + contador). */
          _renderCronToolbar(items) +
          _renderExcelInfo() +
          _renderCalendar(filtered, audits) +
          _renderLeyenda() +
          _renderList(filtered, audits) +
        '</main>' +
      '</div>';

    /* F21.20 (2026-06-20): montar el modal en document.body (NO dentro del
       container del view) para que ningún stacking context / filter / opacity
       del view lo afecte. Esto evita que se vea "del mismo tono que el fondo". */
    _mountDialogInBody();

    _bindEvents(container, audits);
  }

  function _openEditDialog(auditId, item) {
    _state.editing = { auditId: auditId, item: item, isNew: !item };
    render(_currentContainer || document.querySelector('.kair-v3-module, .kair-aud-module') || document.body);
  }

  /* F21.25 (2026-06-20): Abre el dialog de "Nuevo hito" con mes pre-llenado.
     - auditId y auditLabel vienen de la fila clickeada (puede ser una
       auditoría existente o un item libre / texto libre).
     - Si la fila no tiene auditId (texto libre), auditLabel es el texto
       que el usuario verá pre-llenado en el input de auditoría. */
  function _openNewHitoPreseleccionado(mes, auditId, auditLabel) {
    var fasesParaDialog = _getFasesParaCalendar();
    var faseDefaultId = fasesParaDialog[0] ? fasesParaDialog[0].id : 'preparacion';
    var item = { fase: faseDefaultId, mes: mes, anio: _state.year, estado: 'pendiente' };
    _state.editing = {
      auditId: auditId || '',
      auditLabel: auditLabel || '',
      item: item,
      isNew: true
    };
    render(_currentContainer || document.querySelector('.kair-v3-module, .kair-aud-module') || document.body);
  }

  /* F21.14 (2026-06-20): resetear estado global del cronograma al desmontar.
     Evita que listeners stale, diálogos abiertos o caché de Excel persistan
     después de navegar a otro componente. */
  function resetState() {
    _state.loading = false;
    _state.editing = null;
    _state.excelHitos = [];
    _state.excelArchivo = null;
    _state.excelRuta = null;
    _state.excelCarpeta = null;
    _state.excelAnioDetectado = null;
    _state.excelAnioSolicitado = null;
    _state.excelAviso = null;
    _state.excelFases = [];
    _state.sinDatosParaYear = false;
    _state.aniosConArchivo = [];
    _state.faseFilter = 'todas';
    _currentContainer = null;
    _excelLoaded = false;
  }

  function _closeDialog() {
    _state.editing = null;
    // F21.22: usar KairUI.closeDialog (animación de cierre estándar).
    if (typeof KairUI !== 'undefined' && KairUI.closeDialog) {
      KairUI.closeDialog('kair-v3-hito-dialog');
    } else {
      var prev = document.getElementById('kair-v3-hito-dialog');
      if (prev && prev.parentElement) prev.parentElement.removeChild(prev);
    }
    render(_currentContainer || document.body);
  }

  var _currentContainer = null;

  /* F21.22 (2026-06-20): monta el dialog en document.body usando el patrón
     canónico KairUI.openDialog. Esto garantiza:
     - Sin stacking context heredado del view (el modal vive en <body>)
     - Eventos de cierre unificados (ESC, backdrop, botón close)
     - Consistencia con el resto del proyecto */
  function _mountDialogInBody() {
    // Cerrar cualquier dialog previo para evitar duplicados.
    if (typeof KairUI !== 'undefined' && KairUI.closeDialog) {
      KairUI.closeDialog('kair-v3-hito-dialog');
    } else {
      var prev = document.getElementById('kair-v3-hito-dialog');
      if (prev && prev.parentElement) prev.parentElement.removeChild(prev);
    }
    if (!_state.editing) return;
    var html = _renderEditingDialog(_state.editing, _state.year);
    // openDialog monta en document.body y bindea eventos estándar
    // (ESC, backdrop con [data-action="dialog-backdrop"], y botón close
    // con [data-action="dialog-close"]). Pero nuestros botones usan
    // [data-dialog-close] y [data-save-hito] (atributos data-* planos),
    // así que agregamos un listener delegado para esos.
    var overlay = KairUI.openDialog(html);
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        var t = e.target;
        // Botón "Guardar hito"
        if (t.closest('[data-save-hito]')) {
          _saveHitoFromDialog(_currentContainer);
          return;
        }
        // Botón "Cancelar" o click en el backdrop (overlay directo)
        if (t.closest('[data-dialog-close]') || t === overlay) {
          _closeDialog();
          return;
        }
      });

      /* F21.24 (2026-06-20): el campo ESTADO cambia el color del icono
         dinámicamente según el valor seleccionado. */
      var estadoSelect = overlay.querySelector('#kair-v3-hito-estado');
      var estadoIcon = overlay.querySelector('#kair-v3-hito-estado-icon');
      if (estadoSelect && estadoIcon) {
        var syncEstadoColor = function () {
          var v = estadoSelect.value || 'pendiente';
          var colorMap = {
            completado: '#28a745',
            en_curso:   '#6c757d',
            pendiente:  '#ffc107',
            vencido:    '#dc3545'
          };
          estadoIcon.style.color = colorMap[v] || '#6c757d';
        };
        syncEstadoColor();
        estadoSelect.addEventListener('change', syncEstadoColor);
      }
    }
  }

  function _bindEvents(container, audits) {
    _currentContainer = container;

    /* F16: Volver al Hub (data-go-hub) */
    var goHubBtns = container.querySelectorAll('[data-go-hub]');
    goHubBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        KairStore.actions.goHub();
        if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
          window.kairAuditoriaAnual._refreshView();
        }
      });
    });
    /* F17: breadcrumb "Verificación" → regresa al módulo padre */
    var backModuleBtns = container.querySelectorAll('[data-back-module]');
    backModuleBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var inst = window.__kairAudInstance;
        if (inst && typeof inst.backToModuleCallback === 'function') {
          inst.backToModuleCallback();
        }
      });
    });

    /* Cambio de año (F20: resetear carga para recargar Excel del nuevo año) */
    var yearEl = document.getElementById('kair-v3-cron-year');
    if (yearEl) yearEl.addEventListener('change', function (e) {
      _state.year = parseInt(e.target.value, 10);
      _excelLoaded = false; /* forzar recarga del Excel del año nuevo */
      render(container);
    });

    /* Filtros de fase (tabs) */
    container.querySelectorAll('[data-set-fase]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _state.faseFilter = btn.getAttribute('data-set-fase');
        render(container);
      });
    });

    /* F21.27 (2026-06-20): navegación de año con botones < > */
    container.querySelectorAll('[data-year-prev]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var years = _state.years || [];
        var idx = years.indexOf(_state.year);
        if (idx > 0) {
          _state.year = years[idx - 1];
          _state.faseFilter = 'todas';
          render(container);
        }
      });
    });
    container.querySelectorAll('[data-year-next]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var years = _state.years || [];
        var idx = years.indexOf(_state.year);
        if (idx >= 0 && idx < years.length - 1) {
          _state.year = years[idx + 1];
          _state.faseFilter = 'todas';
          render(container);
        }
      });
    });

    /* Nuevo hito */
    var newBtn = document.getElementById('kair-v3-cron-new');
    if (newBtn) newBtn.addEventListener('click', function () {
      _openEditDialog(null, null);
    });

    /* Editar hito (desde celda o item de lista) */
    container.querySelectorAll('[data-edit-hito]').forEach(function (el) {
      el.addEventListener('click', function () {
        var hId = el.getAttribute('data-edit-hito');
        var auditId = el.getAttribute('data-audit-id');
        var item = null;
        if (hId && hId !== '') {
          var a = audits.find(function (x) { return x.id === auditId; });
          if (a) item = (a.cronograma || []).find(function (c) { return c.id === hId; });
        }
        _openEditDialog(auditId, item);
      });
    });

    /* F21.25 (2026-06-20): Click en celda vacía del calendario → abrir dialog
       "Nuevo hito" con auditoría (de la fila) y mes (de la columna) pre-llenados. */
    container.querySelectorAll('[data-add-cell]').forEach(function (cell) {
      cell.addEventListener('click', function () {
        var mes = parseInt(cell.getAttribute('data-add-mes'), 10);
        var auditId = cell.getAttribute('data-add-cell') || '';
        var auditLabel = cell.getAttribute('data-add-audit-label') || '';
        _openNewHitoPreseleccionado(mes, auditId, auditLabel);
      });
    });

    /* Eliminar hito */
    container.querySelectorAll('[data-remove-hito]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var hId = btn.getAttribute('data-remove-hito');
        if (window.Sileo) {
          Sileo.confirm({
            title: '¿Eliminar hito?',
            description: 'Esta acción no se puede deshacer.',
            confirmText: 'Eliminar', danger: true
          }).then(function (ok) {
            if (ok) {
              KairStore.actions.removeCronogramaItem(hId);
              if (window.Sileo) Sileo.success({ title: 'Hito eliminado' });
              if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
                window.kairAuditoriaAnual._refreshView();
              }
            }
          });
        }
      });
    });

    /* F21.24 (2026-06-20): el listener del modal ya se bindea en _mountDialogInBody
       (porque ahora el modal vive en document.body, no en este container).
       Aquí solo nos aseguramos de NO duplicar handlers. */
  }

  function _saveHitoFromDialog(container) {
    var auditEl = document.getElementById('kair-v3-hito-audit');
    var faseEl = document.getElementById('kair-v3-hito-fase');
    var mesEl = document.getElementById('kair-v3-hito-mes');
    var anioEl = document.getElementById('kair-v3-hito-anio');
    var estadoEl = document.getElementById('kair-v3-hito-estado');
    var obsEl = document.getElementById('kair-v3-hito-obs');
    if (!auditEl || !faseEl || !mesEl || !anioEl) return;

    /* F21.23 (2026-06-20): input libre con datalist.
       - Tomamos el texto del input
       - Buscamos si coincide con alguna auditoría existente (code + " · " + process)
       - Si coincide → auditId válido (vinculado)
       - Si NO coincide → auditId vacío + auditLabel con el texto (texto libre) */
    var auditText = (auditEl.value || '').trim();
    var fase = faseEl.value;
    var mes = parseInt(mesEl.value, 10);
    var anio = parseInt(anioEl.value, 10);
    var estado = estadoEl ? estadoEl.value : 'pendiente';
    var obs = obsEl ? obsEl.value : '';

    if (!auditText) {
      if (window.Sileo) Sileo.error({ title: 'Escribe o selecciona una auditoría' });
      auditEl.focus();
      return;
    }

    /* Buscar coincidencia con auditoría existente. */
    var audits = KairStore.selectAudits();
    var matchedAudit = audits.find(function (a) {
      var label = (a.code || '') + ' · ' + ((a.process || '').substring(0, 50));
      return label.trim() === auditText;
    });
    var auditId = matchedAudit ? matchedAudit.id : '';
    var auditLabel = matchedAudit ? null : auditText;

    var saveBtn = document.querySelector('[data-save-hito]');
    var isNew = saveBtn && saveBtn.getAttribute('data-is-new') === '1';
    var hId = saveBtn ? saveBtn.getAttribute('hito-id') : '';

    if (isNew) {
      KairStore.actions.addCronogramaItem({
        id: KairHelpers.genId('CRON'),
        auditId: auditId,
        auditLabel: auditLabel,
        fase: fase,
        mes: mes,
        anio: anio,
        estado: estado,
        observaciones: obs
      });
      if (window.Sileo) Sileo.success({
        title: auditLabel ? 'Hito creado (texto libre)' : 'Hito creado'
      });

      /* F21.29 (2026-06-20): si el año del hito NO tiene archivo Excel,
         crearlo automáticamente. Así el primer hito de un año genera el
         cronograma oficial (GI-FO-062) en el repositorio. */
      if (window.electronAPI && window.electronAPI.auditoriaAnual && window.electronAPI.auditoriaAnual.crearCronograma) {
        var anioTieneArchivo = _state.aniosConArchivo.indexOf(anio) !== -1;
        if (!anioTieneArchivo) {
          _crearCronogramaParaAnio(anio).catch(function (err) {
            console.warn('[K+AIRSST][CRONOGRAMA] No se pudo crear el archivo del año ' + anio + ':', err);
          });
        }
      }
    } else {
      KairStore.actions.updateCronogramaItem(hId, {
        auditId: auditId,
        auditLabel: auditLabel,
        fase: fase, mes: mes, anio: anio, estado: estado, observaciones: obs
      });
      if (window.Sileo) Sileo.success({ title: 'Hito actualizado' });
    }

    /* F21.24 (2026-06-20): cerrar el modal y refrescar el view. */
    _closeDialog();
    if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
      window.kairAuditoriaAnual._refreshView();
    }
  }

  return { render: render, resetState: resetState };
})();

window.AuditoriaCronogramaView = AuditoriaCronogramaView;

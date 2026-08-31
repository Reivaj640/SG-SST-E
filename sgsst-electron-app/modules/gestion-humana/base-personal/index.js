// modules/gestion-humana/base-personal/index.js
// 📦730 · Submódulo "Base de Personal" — UI con HTML+CSS+JS separados (v0.2.0)
//
// Estructura visual:
//   - KPIs (5) via #bp-kpi-bar (helper GHKPIBar)
//   - Toolbar unificada (📦730 · card única con 2 filas)
//     · Fila 1: búsqueda + 3 botones (Filtros, Exportar CSV, Nuevo Trabajador)
//     · Fila 2 (colapsable): filtros Sede/Estado + contador "Mostrando X trabajador(es)"
//   - Table container (con sticky header + acciones inline)
//
// HTML: base-personal/index.html (cargado via fetch con fallback inline)
// CSS:  base-personal/index.css (link en index.html)
// Lógica IPC: 5 read + 4 write handlers del bridge (probados con 130+ tests).

// 📦732 · Mapa de sinónimos para auto-mapeo de columnas Excel → campos BD.
// Cada campo BD tiene un array de posibles nombres en el Excel (case-insensitive,
// sin acentos, sin espacios). La función _normalize() limpia los headers.
//
// 📦733 · Cubre 3 tipos de Excel:
//   - Español genérico: cedula, nombres, apellidos, cargo, etc.
//   - Códigos de sistemas legacy (TASCED, TASPRN, TCSSAL...) — ej. "EMPLEADOS A CORTE"
//   - Variaciones regionales: sueldo, puesto, dni, movil, etc.
var BP_IMPORT_FIELD_MAP = {
  cedula:          ['cedula', 'documento', 'cc', 'dni', 'identificacion', 'id', 'tasced', 'ced'],
  nombres:         ['nombres', 'nombre', 'name', 'tasprn'],
  nombres2:        ['tassen', 'snomb', 'segundonombre'],
  apellidos:       ['apellidos', 'apellido', 'lastname', 'taspra'],
  apellidos2:      ['tassea', 'sape', 'segundoapellido'],
  cargo:           ['cargo', 'puesto', 'posicion', 'rol', 'tcgdes', 'ocupacion'],
  salario:         ['salario', 'sueldo', 'remuneracion', 'pago', 'tcssal', 'sal'],
  email:           ['email', 'correo', 'mail', 'tasmai', 'correoelectronico'],
  // 📦747 · TASTLO = legacy "teléfono local" del Excel Tempoactiva → se mapea a `telefono`
  // si no hay columna TASTLR, o a `celular` si TASTLR ya está mapeado a telefono.
  telefono:        ['telefono', 'tel', 'phone', 'contacto', 'tastlr', 'tastlo'],
  celular:         ['celular', 'movil', 'mobile', 'cel', 'tasmov'],
  fechaIngreso:    ['fechaingreso', 'fechadeingreso', 'ingreso', 'fecha_ingreso', 'tasfig'],
  fechaRetiro:     ['fecharetiro', 'fechadebaja', 'retiro', 'baja', 'tasfre'],
  fechaNacimiento: ['fechanacimiento', 'nacimiento', 'fnac', 'tasfna'],
  // 📦747 · TASDIR = dirección legacy del Excel Tempoactiva
  direccion:       ['direccion', 'residencia', 'dir', 'domicilio', 'tasdir', 'taspri'],
  // 📦747 · barrio no se mapeaba antes
  barrio:          ['barrio', 'tbasector'],
  // 📦747 · ciudad no se mapeaba antes
  ciudad:          ['ciudad', 'municipio', 'localidad', 'tciudad'],
  eps:             ['eps', 'salud', 'entidadsalud', 'tepdes'],
  pension:         ['pension', 'pensiones', 'fondodepension', 'fondopension', 'tfpdes'],
  // 📦744 · TESDES se quitó del mapa de cajaCompensacion (TESDES es la razón
  // social de la empresa cliente, no la caja). Ahora la caja se asigna como
  // valor por defecto en el emergente de "Valores por defecto" del import.
  cajaCompensacion:['cajacompensacion', 'caja', 'compensacion', 'cajadecompensacion'],
  estado:          ['estado', 'situacion', 'tasest'],
  // 📦742 · La columna TUBDES (Unidad de negocio / Área) del Excel legacy
  // se mapea al campo `sede` (string). El backend auto-crea la sede si no existe
  // y asigna el sedeId a cada trabajador.
  sede:            ['sede', 'sucursal', 'unidad', 'area', 'areadetrabajo', 'departamento', 'tubdes'],
  // 📦747 · Quité el duplicado 'arl' que había en el array
  arl:             ['arl', 'riesgos', 'administradoral']
};
var BP_IMPORT_FIELDS = [
  'cedula', 'nombres', 'apellidos', 'cargo', 'salario',
  'email', 'telefono', 'fechaIngreso', 'fechaRetiro', 'fechaNacimiento',
  'direccion', 'eps', 'pension', 'arl', 'cajaCompensacion', 'estado', 'sede'
];
// 📦746 · Valores por defecto del sistema. Cuando el user selecciona "— sin
// asignar —" en un campo con default, aparece una pequeña sección EMERGENTE
// justo debajo del select con un input pre-llenado con este valor. El user
// puede editarlo inline. Si el input queda vacío, NO se aplica el default a
// las filas vacías. Esto reemplaza tanto la sección grande inicial como la
// opción inline "★ Default: X" del select — la interfaz queda más limpia.
var BP_IMPORT_DEFAULTS = {
  cajaCompensacion: 'Caja Comfamiliar Atlántico',
  arl: 'Colmena'
};
// Campos "auxiliares" (segundo nombre/apellido) que NO se muestran en el modal
// como campos BD, pero se concatenan al confirmar. El auto-mapeo los detecta
// y concatena automáticamente con `nombres` y `apellidos`.
var BP_IMPORT_AUX_FIELDS = ['nombres2', 'apellidos2'];

// 📦734 · Sinónimos para detectar la columna de "empresa" en el Excel.
// Si el Excel tiene una columna de empresa (ej: TCPCOD, EMPRESA, CODIGO),
// el sistema ofrece un filtro por empresa en el modal de preview. La
// empresa actual del módulo se pre-selecciona si su código matchea con
// alguno de los valores únicos (case-insensitive).
var BP_IMPORT_COMPANY_SYNONYMS = [
  'tccod', 'tcpcod', 'empresa', 'codigo', 'codigoempresa', 'company',
  'companycode', 'clientecodigo', 'codigocliente', 'cliente', 'customer'
];

function _bpNormalize(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .trim()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]/g, '');
}

class BasePersonalComponent {
  constructor(container, companyName, moduleName, submoduleName, onBack, companyKey) {
    this.container = container;
    this.companyName = companyName;
    this.companyKey = companyKey || companyName; // 📦734 · companyKey para matchear TCPCOD
    this.moduleName = moduleName;
    this.submoduleName = submoduleName;
    this.onBack = onBack;
    this.personales = [];
    this.sedes = [];
    this.filtered = [];
    this.search = '';
    this.filterEstado = 'todos';  // 'todos' | 'activos' | 'retirados' (segmented control)
    this.filterSede = 'all';
    // 📦749 · Si el dashboard navegó aquí con un filtro, lo respetamos.
    // sessionStorage se limpia al consumirlo para que el filtro no "pegue"
    // en navegaciones manuales posteriores.
    // 📦762 · Migrado de 'all'/'activo'/'retirado' a 'todos'/'activos'/'retirados'
    try {
      var pre = sessionStorage.getItem('gh-dashboard-filter-personal');
      if (pre) {
        var parsed = JSON.parse(pre);
        if (parsed && parsed.filterEstado) {
          // Compatibilidad: traducir valores viejos a los nuevos
          if (parsed.filterEstado === 'all') this.filterEstado = 'todos';
          else if (parsed.filterEstado === 'activo') this.filterEstado = 'activos';
          else if (parsed.filterEstado === 'retirado') this.filterEstado = 'retirados';
          else this.filterEstado = parsed.filterEstado;
        }
        sessionStorage.removeItem('gh-dashboard-filter-personal');
      }
    } catch (e) { /* ignorar errores de sessionStorage */ }
  }

  // 📦762 · Normalizar estado a 'activo' | 'retirado' (mismo patrón que Afiliaciones)
  _normalizeEstado(e) {
    if (e == null) return 'activo';  // null / undefined / '' → activo (default conservador)
    var v = String(e).toLowerCase().trim();
    if (v === 'r' || v === 'ret' || v === 'retirado') return 'retirado';
    if (v === 'a' || v === 'act' || v === 'activo') return 'activo';
    return 'activo';  // cualquier otro valor (vacío, 'incapacitado', 'vacaciones', etc) → activo
  }

  // === HELPERS ===
  _fmt(n) {
    if (n == null) return '—';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
  }
  _toast() {
    return (window.parent && window.parent.KAIRToast) ? window.parent.KAIRToast : window.KAIRToast;
  }
  _confirmDialog() {
    return (window.parent && window.parent.KairConfirm) ? window.parent.KairConfirm : window.KairConfirm;
  }
  _showToast(msg, type) {
    var t = this._toast();
    if (t) t.show(msg, type || 'info');
  }
  _escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  _estadoColor(estado) {
    var colors = {
      'activo': '#28a745', 'incapacitado': '#dc3545', 'vacaciones': '#fd7e14',
      'permiso': '#6f42c1', 'maternidad': '#17a2b8', 'paternidad': '#17a2b8',
      'luto': '#6c757d', 'retirado': '#868e96'
    };
    return colors[estado] || '#6c757d';
  }

  // 📦741 · Normaliza el estado legacy del Excel a uno canónico.
  // 'A' / 'ACT' / 'ACTIVO' / 'a' → 'activo'
  // 'R' / 'RET' / 'RETIRADO' / 'r' → 'retirado' (SIEMPRE — el legacy ya indica el estado, no depende de fechaRetiro)
  // Otros valores se preservan tal cual.
  // 📦749 · FIX bug: el fallback "fechaRetiro ? 'retirado' : 'activo'" hacía
  // que los 625 retirados del Excel de Tempoactiva (estado='R', fechaRetiro=null)
  // se contaran como activos. El estado legacy YA ES la verdad: si dice 'R',
  // es retirado. No necesitamos fechaRetiro para confirmar.
  // 📦762 · Renombrado a _normalizePersonalEstado para no chocar con _normalizeEstado(string) del segmented control
  _normalizePersonalEstado(p) {
    if (!p || !p.estado) return p;
    var e = String(p.estado).trim().toLowerCase();
    if (e === 'a' || e === 'act' || e === 'activo') {
      p.estado = 'activo';
    } else if (e === 'r' || e === 'ret' || e === 'retirado') {
      p.estado = 'retirado';
    } else if (e === 'i' || e === 'ina' || e === 'inactivo') {
      p.estado = 'inactivo';
    } else if (e === 'v' || e === 'vac' || e === 'vacaciones') {
      p.estado = 'vacaciones';
    } else if (e === 'p' || e === 'per' || e === 'permiso') {
      p.estado = 'permiso';
    }
    return p;
  }

  // 📦733 · Normaliza una fecha de cualquier formato a YYYY-MM-DD.
  // Soporta: Date object, YYYYMMDD, YYYY-MM-DD, DD/MM/YYYY, ISO 8601, etc.
  _normalizeDate(val) {
    if (!val) return null;
    // Si es Date object (SheetJS con cellDates:true puede devolver esto)
    if (val instanceof Date && !isNaN(val.getTime())) {
      var y = val.getFullYear();
      var m = String(val.getMonth() + 1).padStart(2, '0');
      var d = String(val.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + d;
    }
    var s = String(val).trim();
    if (!s) return null;
    // YYYYMMDD (8 dígitos, ej: 20260115)
    if (/^\d{8}$/.test(s)) {
      return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
    }
    // YYYYMMDDHHMMSS (14 dígitos, ej: 20260115120000)
    if (/^\d{14}$/.test(s)) {
      return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
    }
    // YYYY-MM-DD ya está OK
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      return s.slice(0, 10);
    }
    // DD/MM/YYYY
    var dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
      return dmy[3] + '-' + String(dmy[2]).padStart(2, '0') + '-' + String(dmy[1]).padStart(2, '0');
    }
    // DD-MM-YYYY
    var dmy2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dmy2) {
      return dmy2[3] + '-' + String(dmy2[2]).padStart(2, '0') + '-' + String(dmy2[1]).padStart(2, '0');
    }
    // Si no se reconoce, devolver el string original (la BD rechazará si es inválido)
    return s;
  }

  // === HTML ===
  async _fetchHtml() {
    try {
      var r = await fetch('modules/gestion-humana/base-personal/index.html');
      if (r.ok) return await r.text();
    } catch (e) {
      console.warn('[BasePersonal] fetch HTML falló, usando fallback inline:', e.message);
    }
    // Fallback inline — debe coincidir con index.html
    return '<div class="bp-wrapper" id="bp-wrapper">' +
      '<div class="bp-kpi-section"><div id="bp-kpi-bar" class="bp-kpi-bar"></div></div>' +
      '<div class="bp-toolbar" id="bp-toolbar">' +
        '<div class="bp-toolbar__row bp-toolbar__row--main">' +
          '<div class="bp-toolbar__search">' +
            '<i class="fas fa-search bp-toolbar__search-icon"></i>' +
            '<input id="bp-search" type="text" class="bp-toolbar__search-input" placeholder="Buscar por nombre, cédula, cargo o email…" />' +
          '</div>' +
          '<div class="bp-seg" role="tablist" aria-label="Filtro por estado del trabajador">' +
            '<button id="bp-filter-todos" class="bp-seg-btn bp-seg-btn--active" type="button" data-filter="todos" role="tab" aria-selected="true">Todos <span id="bp-count-todos" class="bp-seg-count">0</span></button>' +
            '<button id="bp-filter-activos" class="bp-seg-btn" type="button" data-filter="activos" role="tab" aria-selected="false">Activos <span id="bp-count-activos" class="bp-seg-count">0</span></button>' +
            '<button id="bp-filter-retirados" class="bp-seg-btn" type="button" data-filter="retirados" role="tab" aria-selected="false">Retirados <span id="bp-count-retirados" class="bp-seg-count">0</span></button>' +
          '</div>' +
          '<div class="bp-toolbar__actions">' +
            '<div class="bp-filter-group bp-filter-group--inline">' +
              '<label class="bp-filter-group__label" for="bp-filter-sede">Sede</label>' +
              '<select id="bp-filter-sede" class="bp-filter-select"><option value="all">Todas las sedes</option></select>' +
            '</div>' +
            '<button id="bp-importar-btn" class="bp-btn bp-btn--ghost" type="button" title="Importar trabajadores desde Excel"><i class="fas fa-file-import"></i> Importar Excel</button>' +
            '<button id="bp-exportar-btn" class="bp-btn bp-btn--ghost" type="button"><i class="fas fa-download"></i> Exportar CSV</button>' +
            '<button id="bp-new-btn" class="bp-btn bp-btn--primary" type="button"><i class="fas fa-plus"></i> Nuevo Trabajador</button>' +
          '</div>' +
        '</div>' +
        '<div class="bp-toolbar__row bp-toolbar__row--count">' +
          '<div id="bp-filter-count" class="bp-filter-count">Mostrando <strong id="bp-filter-count-num">0</strong> trabajador(es)</div>' +
        '</div>' +
      '</div>' +
      '<div id="bp-table-container" class="bp-table-container"></div>' +
      // 📦732 · Modal de preview de importacion
      '<div id="bp-import-modal" class="bp-modal" hidden>' +
        '<div class="bp-modal__backdrop" data-close-modal="1"></div>' +
        '<div class="bp-modal__panel">' +
          '<header class="bp-modal__header">' +
            '<h3 class="bp-modal__title"><i class="fas fa-file-import"></i> Vista previa de importación</h3>' +
            '<button type="button" class="bp-modal__close" data-close-modal="1" aria-label="Cerrar"><i class="fas fa-times"></i></button>' +
          '</header>' +
          '<div class="bp-modal__body">' +
            '<div id="bp-import-summary" class="bp-import-summary"></div>' +
            '<h4 class="bp-import-section-title">Mapeo de columnas</h4>' +
            '<div id="bp-import-mapping" class="bp-import-mapping"></div>' +
            '<h4 class="bp-import-section-title">Primeras filas (preview)</h4>' +
            '<div id="bp-import-preview" class="bp-import-preview"></div>' +
          '</div>' +
          '<footer class="bp-modal__footer">' +
            '<fieldset class="bp-import-duplicate-mode">' +
              '<legend>Si la cédula ya existe:</legend>' +
              '<label class="bp-import-duplicate-mode__opt">' +
                '<input type="radio" name="bp-import-dup-mode" value="skip" checked />' +
                '<span class="bp-import-duplicate-mode__opt-label">Omitir</span>' +
                '<span class="bp-import-duplicate-mode__opt-hint">no crear ni actualizar</span>' +
              '</label>' +
              '<label class="bp-import-duplicate-mode__opt">' +
                '<input type="radio" name="bp-import-dup-mode" value="update" />' +
                '<span class="bp-import-duplicate-mode__opt-label">Actualizar</span>' +
                '<span class="bp-import-duplicate-mode__opt-hint">reemplaza los datos (preserva retirado)</span>' +
              '</label>' +
              '<label class="bp-import-duplicate-mode__opt">' +
                '<input type="radio" name="bp-import-dup-mode" value="error" />' +
                '<span class="bp-import-duplicate-mode__opt-label">Reportar error</span>' +
                '<span class="bp-import-duplicate-mode__opt-hint">no inserta ni actualiza</span>' +
              '</label>' +
            '</fieldset>' +
            '<div class="bp-modal__footer-actions">' +
              '<button type="button" class="bp-btn bp-btn--ghost" data-close-modal="1">Cancelar</button>' +
              '<button type="button" id="bp-import-confirm" class="bp-btn bp-btn--primary">' +
                '<i class="fas fa-file-import"></i> <span id="bp-import-confirm-text">Importar</span>' +
              '</button>' +
            '</div>' +
          '</footer>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // === DATA ===
  async _load() {
    if (!window.electronAPI || !this.companyName) return;
    try {
      // Cargar personal y sedes en paralelo
      var promises = [
        window.electronAPI.ghListPersonal({ companyName: this.companyName })
      ];
      // Solo cargar sedes si el filtro está disponible
      if (window.electronAPI.ghListSedes) {
        promises.push(window.electronAPI.ghListSedes({ companyName: this.companyName }));
      }
      var results = await Promise.all(promises);
      var rPersonal = results[0];
      var rSedes = results[1];

      if (rPersonal && rPersonal.success) {
        // 📦741 · Normalizar estados legacy ('A' → 'activo', 'R' → 'retirado')
        // para que los filtros y badges funcionen con Excels legacy.
        this.personales = (rPersonal.data.personales || []).map(this._normalizePersonalEstado, this);
      } else {
        this._showToast('Error cargando personal: ' + (rPersonal && rPersonal.error ? rPersonal.error.message : 'desconocido'), 'error');
        this.personales = [];
      }

      if (rSedes && rSedes.success) {
        this.sedes = rSedes.data.sedes || [];
      } else {
        this.sedes = [];
      }
      // 📦735 · Renderizar el filtro de Sede con las sedes que APARECEN en los
      // datos reales (no todas las registradas). Combina con el nombre desde
      // ghListSedes si está disponible.
      this._renderSedeOptions();

      this._applyFilter();
      this._renderKpiBar();
      this._renderTable();
    } catch (e) {
      this._showToast('Error: ' + e.message, 'error');
    }
  }

  _renderSedeOptions() {
    var select = this.container.querySelector('#bp-filter-sede');
    if (!select) return;
    var self = this;

    // 📦735 · Construir un mapa sedeId → nombre desde ghListSedes (si hay)
    var sedeNombre = {};
    this.sedes.forEach(function (s) { sedeNombre[s.id] = s.nombre; });

    // Extraer las sedes únicas que aparecen en los personales
    var seen = {};
    var usedSedes = [];
    this.personales.forEach(function (p) {
      if (p.sedeId && !seen[p.sedeId]) {
        seen[p.sedeId] = true;
        usedSedes.push(p.sedeId);
      }
    });
    usedSedes.sort();

    // Sin asignar (personales con sedeId null o vacío)
    var sinSedeCount = this.personales.filter(function (p) { return !p.sedeId; }).length;

    // 📦741 · Renderizar opciones. Si no hay sedes en los datos, mostrar
    // un mensaje claro (en vez de "Todas" y "(Sin sede)" con el mismo conteo).
    var opts = '';
    if (usedSedes.length === 0 && sinSedeCount === 0) {
      opts = '<option value="all" disabled>Sin trabajadores</option>';
    } else if (usedSedes.length === 0) {
      // Solo hay trabajadores sin sede
      opts = '<option value="all">Todas las sedes (' + this.personales.length + ')</option>';
      opts += '<option value="__none__">(Sin sede) (' + sinSedeCount + ')</option>';
    } else {
      opts = '<option value="all">Todas las sedes (' + this.personales.length + ')</option>';
      usedSedes.forEach(function (sid) {
        var count = self.personales.filter(function (p) { return p.sedeId === sid; }).length;
        var nombre = sedeNombre[sid] || sid;
        opts += '<option value="' + self._escHtml(sid) + '">' + self._escHtml(nombre) + ' (' + count + ')</option>';
      });
      if (sinSedeCount > 0) {
        opts += '<option value="__none__">(Sin sede) (' + sinSedeCount + ')</option>';
      }
    }
    select.innerHTML = opts;
    select.value = this.filterSede;
  }

  _applyFilter() {
    var self = this;
    var s = this.search.toLowerCase().trim();
    this.filtered = this.personales.filter(function (p) {
      var matchSearch = !s || (p.nombres && p.nombres.toLowerCase().indexOf(s) >= 0)
        || (p.apellidos && p.apellidos.toLowerCase().indexOf(s) >= 0)
        || (p.cedula && p.cedula.indexOf(s) >= 0)
        || (p.cargo && p.cargo.toLowerCase().indexOf(s) >= 0)
        || (p.email && p.email.toLowerCase().indexOf(s) >= 0);
      var matchEstado = self.filterEstado === 'todos' || self._normalizeEstado(p.estado) === self.filterEstado.replace(/s$/, '');  // 📦762 · 'activos' → 'activo'
      // 📦735 · Soporte para filtro "(Sin sede)"
      var matchSede = true;
      if (self.filterSede === 'all') matchSede = true;
      else if (self.filterSede === '__none__') matchSede = !p.sedeId;
      else matchSede = p.sedeId === self.filterSede;
      return matchSearch && matchEstado && matchSede;
    });
  }

  _updateCount() {
    var numEl = this.container.querySelector('#bp-filter-count-num');
    if (numEl) numEl.textContent = this.filtered.length;
  }

  // === HELPERS DE FORMATO (📦737 · rediseño tabla) ===
  // Devuelve las iniciales en mayúscula. ej: "Carlos" + "Beltrán" → "CB"
  _getInitials(nombres, apellidos) {
    var n = (nombres || '').trim();
    var a = (apellidos || '').trim();
    var first = n.charAt(0);
    var second = a.charAt(0) || n.charAt(1) || '';
    return (first + second).toUpperCase() || '?';
  }

  // Paleta de avatares determinística basada en la cédula (mismo color siempre)
  _avatarColor(seed) {
    var palette = [
      { bg: '#e8f0fe', fg: '#174ea6' }, // azul
      { bg: '#fce8e6', fg: '#a50e0e' }, // rojo
      { bg: '#e6f4ea', fg: '#1e8e3e' }, // verde
      { bg: '#fef7e0', fg: '#b06000' }, // ámbar
      { bg: '#f3e8fd', fg: '#681da8' }, // púrpura
      { bg: '#e0f2f1', fg: '#00796b' }, // teal
      { bg: '#fce4ec', fg: '#c2185b' }, // rosa
      { bg: '#e1f5fe', fg: '#0277bd' }  // cyan
    ];
    var s = String(seed || '0');
    var hash = 0;
    for (var i = 0; i < s.length; i++) hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    return palette[Math.abs(hash) % palette.length];
  }

  // Cédula formateada con puntos como separador de miles (ej: 1.401.4064)
  _fmtCedula(cedula) {
    var s = String(cedula || '').replace(/[^\d]/g, '');
    if (!s) return '—';
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // Moneda en formato colombiano: $ 8.335.64 (sin decimales, con punto)
  _fmtCurrency(n) {
    if (n == null || n === '' || isNaN(n)) return '—';
    var num = Math.round(Number(n));
    if (isNaN(num)) return '—';
    var formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return '$ ' + formatted;
  }

  // Fecha corta YYYY-MM-DD (o '—' si vacía)
  _fmtDateShort(iso) {
    if (!iso) return '—';
    var s = String(iso).slice(0, 10);
    return s || '—';
  }

  // 📦747 · Formato "humano" para mostrar fechas en el modal: DD/MM/YYYY.
  // Acepta YYYY-MM-DD, YYYYMMDD, Date objects, ISO 8601.
  // Si no se puede parsear, devuelve el string original o '—'.
  _fmtDateDisplay(val) {
    if (val == null || val === '') return '—';
    // Si es Date object
    if (val instanceof Date && !isNaN(val.getTime())) {
      var d = val.getDate(), m = val.getMonth() + 1, y = val.getFullYear();
      return (d < 10 ? '0' : '') + d + '/' + (m < 10 ? '0' : '') + m + '/' + y;
    }
    var s = String(val).trim();
    // YYYY-MM-DD o YYYY-MM-DDTHH:MM:SS
    var m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m1) return m1[3] + '/' + m1[2] + '/' + m1[1];
    // YYYYMMDD (legacy Excel)
    var m2 = s.match(/^(\d{4})(\d{2})(\d{2})/);
    if (m2) return m2[3] + '/' + m2[2] + '/' + m2[1];
    // DD/MM/YYYY (ya formateado, dejar igual)
    var m3 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m3) return s;
    return s;
  }

  // Lookup local de sedeId → nombre (usa this.sedes)
  _getSedeName(sedeId) {
    if (!sedeId) return '';
    var found = this.sedes.find(function (s) { return s.id === sedeId; });
    return found ? found.nombre : '';
  }

  // Badge de estado con color semántico
  _estadoBadge(estado) {
    var map = {
      'activo':        { class: 'bp-badge--success', label: 'Activo' },
      'inactivo':       { class: 'bp-badge--neutral', label: 'Inactivo' },
      'incapacitado':   { class: 'bp-badge--warning', label: 'Incapacitado' },
      'vacaciones':     { class: 'bp-badge--info',    label: 'Vacaciones' },
      'permiso':        { class: 'bp-badge--info',    label: 'Permiso' },
      'maternidad':     { class: 'bp-badge--info',    label: 'Maternidad' },
      'paternidad':     { class: 'bp-badge--info',    label: 'Paternidad' },
      'luto':           { class: 'bp-badge--neutral', label: 'Luto' },
      'retirado':       { class: 'bp-badge--muted',   label: 'Retirado' }
    };
    var entry = map[estado] || { class: 'bp-badge--neutral', label: estado || '—' };
    return '<span class="bp-badge ' + entry.class + '">' + this._escHtml(entry.label) + '</span>';
  }

  // Badge de S400 (Activo/Inactivo)
  _s400Badge(activo) {
    if (activo == null || activo === 0) {
      return '<span class="bp-badge bp-badge--muted">Inactivo</span>';
    }
    return '<span class="bp-badge bp-badge--success">Activo</span>';
  }

  // === RENDER ===
  async render() {
    var self = this;
    // Cargar HTML
    if (!this._html) this._html = await this._fetchHtml();
    this.container.innerHTML = this._html;

    // Set search value (si recargamos con filtro)
    var searchInput = this.container.querySelector('#bp-search');
    if (searchInput) searchInput.value = this.search;

    // Set sede filter
    var sedeSelect0 = this.container.querySelector('#bp-filter-sede');
    if (sedeSelect0) sedeSelect0.value = this.filterSede;

    // 📦762 · Wireup del segmented control (Todos/Activos/Retirados)
    var seg = this.container.querySelector('.bp-seg');
    if (seg) {
      var segBtns = seg.querySelectorAll('button[data-filter]');
      segBtns.forEach(function (b) {
        var isActive = b.getAttribute('data-filter') === self.filterEstado;
        if (isActive) b.classList.add('bp-seg-btn--active');
        else b.classList.remove('bp-seg-btn--active');
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
        b.onclick = function () {
          self.filterEstado = b.getAttribute('data-filter');
          // Re-aplicar clase activa
          segBtns.forEach(function (other) {
            if (other.getAttribute('data-filter') === self.filterEstado) {
              other.classList.add('bp-seg-btn--active');
              other.setAttribute('aria-selected', 'true');
            } else {
              other.classList.remove('bp-seg-btn--active');
              other.setAttribute('aria-selected', 'false');
            }
          });
          self._applyFilter();
          self._renderTable();
          self._updateCount();
        };
      });
    }

    // Wire up
    var newBtn = this.container.querySelector('#bp-new-btn');
    if (newBtn) newBtn.onclick = function () { self._openCreateModal(); };

    var exportarBtn = this.container.querySelector('#bp-exportar-btn');
    if (exportarBtn) exportarBtn.onclick = function () { self._exportarCSV(); };

    var importarBtn = this.container.querySelector('#bp-importar-btn');
    if (importarBtn) importarBtn.onclick = function () { self._openImport(); };

    // Wirear modal close (backdrop + botón X + botón Cancelar)
    var modal = this.container.querySelector('#bp-import-modal');
    if (modal) {
      modal.querySelectorAll('[data-close-modal="1"]').forEach(function (el) {
        el.onclick = function () { modal.setAttribute('hidden', ''); };
      });
    }
    var importConfirm = this.container.querySelector('#bp-import-confirm');
    if (importConfirm) importConfirm.onclick = function () { self._confirmImport(); };

    if (searchInput) {
      searchInput.oninput = function (e) { self.search = e.target.value; self._applyFilter(); self._renderTable(); self._updateCount(); };
    }

    var sedeSelect = this.container.querySelector('#bp-filter-sede');
    if (sedeSelect) {
      sedeSelect.onchange = function (e) { self.filterSede = e.target.value; self._applyFilter(); self._renderTable(); self._updateCount(); };
    }

    // Initial render + load data
    this._renderKpiBar();
    this._renderSegButtons();  // 📦762 · actualizar conteos del segmented control
    this._renderTable();
    this._load();
  }

  // 📦762 · Actualizar conteos del segmented control (Todos/Activos/Retirados)
  _renderSegButtons() {
    var self = this;
    var counts = {
      todos:     this.personales.length,
      activos:   this.personales.filter(function (p) { return self._normalizeEstado(p.estado) === 'activo'; }).length,
      retirados: this.personales.filter(function (p) { return self._normalizeEstado(p.estado) === 'retirado'; }).length
    };
    var cTodos = this.container.querySelector('#bp-count-todos');
    var cActivos = this.container.querySelector('#bp-count-activos');
    var cRetirados = this.container.querySelector('#bp-count-retirados');
    if (cTodos) cTodos.textContent = counts.todos;
    if (cActivos) cActivos.textContent = counts.activos;
    if (cRetirados) cRetirados.textContent = counts.retirados;
  }

  _renderKpiBar() {
    var bar = this.container.querySelector('#bp-kpi-bar');
    if (!bar) return;

    var total = this.personales.length;
    var activos = this.personales.filter(function (p) { return p.estado === 'activo'; }).length;
    var retirados = this.personales.filter(function (p) { return p.estado === 'retirado'; }).length;
    var vacaciones = this.personales.filter(function (p) { return p.estado === 'vacaciones'; }).length;
    var permisos = this.personales.filter(function (p) {
      return p.estado === 'permiso' || p.estado === 'maternidad' || p.estado === 'paternidad' ||
             p.estado === 'luto' || p.estado === 'incapacitado';
    }).length;

    var kpis = [
      { icon: 'fa-users',         color: '#174ea6', bg: '#e8f0fe', value: this._fmt(total),      label: 'Total' },
      { icon: 'fa-user-check',    color: '#28a745', bg: '#d4edda', value: this._fmt(activos),   label: 'Activos' },
      { icon: 'fa-umbrella-beach', color: '#fd7e14', bg: '#ffe5d0', value: this._fmt(vacaciones), label: 'Vacaciones' },
      { icon: 'fa-file-medical',   color: '#6f42c1', bg: '#e7d6ff', value: this._fmt(permisos),   label: 'Permisos / Otros' },
      { icon: 'fa-user-xmark',     color: '#868e96', bg: '#e9ecef', value: this._fmt(retirados),  label: 'Retirados' }
    ];
    window.GHKPIBar.render(bar, kpis);
  }

  _renderTable() {
    var self = this;
    var container = this.container.querySelector('#bp-table-container');
    if (!container) return;

    if (this.filtered.length === 0) {
      var emptyMsg = this.personales.length === 0
        ? 'No hay trabajadores registrados todavía.'
        : 'No se encontraron trabajadores con esos filtros.';
      var emptyHint = this.personales.length === 0
        ? '<p class="bp-empty-state__hint">Hacé click en <strong>Nuevo Trabajador</strong> para empezar.</p>'
        : '';
      container.innerHTML =
        '<div class="bp-empty-state">' +
          '<i class="fas fa-inbox bp-empty-state__icon"></i>' +
          '<p class="bp-empty-state__title">' + emptyMsg + '</p>' +
          emptyHint +
        '</div>';
      this._updateCount();
      return;
    }

    var rows = '';
    this.filtered.forEach(function (p) {
      var fullName = self._escHtml((p.nombres || '') + ' ' + (p.apellidos || ''));
      var email = p.email ? self._escHtml(p.email) : '';
      var initials = self._getInitials(p.nombres, p.apellidos);
      var avatarColor = self._avatarColor(p.cedula);
      var cedulaFmt = self._fmtCedula(p.cedula);
      var estadoBadge = self._estadoBadge(p.estado);
      var s400Badge = self._s400Badge(p.activoS400);
      var sedeName = self._getSedeName(p.sedeId);
      var salarioFmt = self._fmtCurrency(p.salario);
      var fechaIngresoFmt = self._fmtDateShort(p.fechaIngreso);
      var avatarHtml = '<div class="bp-avatar" style="background:' + avatarColor.bg + ';color:' + avatarColor.fg + ';">' +
                        initials + '</div>';
      var emailLine = email ? '<div class="bp-worker__email">' + email + '</div>' : '';
      var sedeCell = sedeName
        ? '<div class="bp-sede"><i class="fas fa-map-marker-alt"></i><span>' + self._escHtml(sedeName) + '</span></div>'
        : '<span class="bp-empty">—</span>';
      rows += '<tr>' +
        '<td>' +
          '<div class="bp-worker">' +
            avatarHtml +
            '<div class="bp-worker__info">' +
              '<div class="bp-worker__name">' + fullName + '</div>' +
              emailLine +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td class="bp-mono">' + cedulaFmt + '</td>' +
        '<td>' + self._escHtml(p.cargo || '—') + '</td>' +
        '<td>' + sedeCell + '</td>' +
        '<td>' + estadoBadge + '</td>' +
        '<td class="bp-right">' + salarioFmt + '</td>' +
        '<td class="bp-date">' + fechaIngresoFmt + '</td>' +
        '<td>' + s400Badge + '</td>' +
        '<td class="bp-actions">' +
          '<button class="bp-row-action bp-row-action--view" data-id="' + self._escHtml(p.id) + '" title="Ver detalle">' +
            '<i class="fas fa-eye"></i>' +
          '</button>' +
          '<button class="bp-row-action bp-row-action--del" data-id="' + self._escHtml(p.id) + '" data-nombre="' + self._escHtml(fullName) + '" title="Retirar">' +
            '<i class="fas fa-trash"></i>' +
          '</button>' +
        '</td>' +
      '</tr>';
    });

    container.innerHTML =
      '<table class="bp-table bp-table--modern">' +
        '<thead>' +
          '<tr>' +
            '<th>Trabajador</th>' +
            '<th>Cédula</th>' +
            '<th>Cargo</th>' +
            '<th>Sede</th>' +
            '<th>Estado</th>' +
            '<th class="bp-th-right">Salario</th>' +
            '<th>Ingreso</th>' +
            '<th>S400</th>' +
            '<th class="bp-th-right">Acciones</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>';

    // Wire up row actions
    container.querySelectorAll('.bp-row-action--view').forEach(function (btn) {
      btn.onclick = function () { self._openDetail(btn.getAttribute('data-id')); };
    });
    container.querySelectorAll('.bp-row-action--del').forEach(function (btn) {
      btn.onclick = function () { self._openOcultarConfirm(btn.getAttribute('data-id'), btn.getAttribute('data-nombre')); };
    });

    this._updateCount();
  }

  // === CREATE / EDIT MODAL via KairConfirm.input() ===
  async _openCreateModal() {
    var values = await this._confirmDialog().input({
      title: '➕ Nuevo Trabajador',
      message: 'Completá los datos del nuevo trabajador. Cédula, nombres y apellidos son obligatorios.',
      fields: [
        { key: 'nombres', label: 'Nombres', type: 'text', required: true, placeholder: 'Ej: Juan Carlos' },
        { key: 'apellidos', label: 'Apellidos', type: 'text', required: true, placeholder: 'Ej: Pérez García' },
        { key: 'cedula', label: 'Cédula', type: 'text', required: true, placeholder: '1234567890' },
        { key: 'cargo', label: 'Cargo', type: 'text', required: true, placeholder: 'Ej: Operario' },
        { key: 'salario', label: 'Salario (COP)', type: 'number', placeholder: '1500000' },
        { key: 'telefono', label: 'Teléfono', type: 'text', placeholder: '3001234567' },
        { key: 'email', label: 'Email', type: 'text', placeholder: 'email@empresa.com' },
        { key: 'fechaIngreso', label: 'Fecha de Ingreso (YYYY-MM-DD)', type: 'text', placeholder: '2026-01-15' }
      ],
      confirmText: 'Crear Trabajador',
      type: 'info'
    });
    if (!values) return;
    this._create(values);
  }

  // 📦767 · I-103.A1.0-F-1 · Acción administrativa (NO retiro laboral).
  // Solo oculta el bp. NO modifica estado ni fecha_retiro. NO genera evento.
  // El bp debe estar retirado previamente (validado en el backend con BP_NOT_RETIRED).
  async _openOcultarConfirm(personalId, nombre) {
    var confirmed = await this._confirmDialog().confirm({
      title: '🗑️ Ocultar Trabajador',
      message: '¿Querés ocultar a "' + nombre + '"?',
      details: 'Acción administrativa: solo se oculta el registro (activo=0). Su estado, fecha de retiro, vacaciones, permisos, documentos, mensajes y afiliaciones se conservan íntegros. Para retirar laboralmente, use la opción "Retirar".',
      confirmText: 'Sí, ocultar',
      cancelText: 'Cancelar',
      type: 'warning'
    });
    if (!confirmed) return;
    this._delete(personalId);
  }

  // 📦767 · FASE 1.0-G.2 · Retiro laboral via gh:cambiar-estado.
  // Esta acción es la única vía para retirar un bp en producción.
  // El backend (1.0-B/C/D-1) registra el evento RETIRO atómicamente.
  async _openRetirarConfirm(personalId, nombre, parentModal) {
    var self = this;
    var confirmed = await this._confirmDialog().confirm({
      title: '🔴 Retirar Trabajador',
      message: '¿Querés retirar a "' + nombre + '"?',
      details: 'Cambio laboral: estado → retirado, fecha_retiro → hoy, evento RETIRO registrado. La acción se puede revertir con un Reingreso posterior. Para ocultar sin retirar, use la acción administrativa "Ocultar".',
      confirmText: 'Sí, retirar',
      cancelText: 'Cancelar',
      type: 'warning'
    });
    if (!confirmed) return;
    try {
      var today = new Date().toISOString();
      var r = await window.electronAPI.ghCambiarEstado({
        personalId: personalId,
        estado: 'retirado',
        fechaRetiro: today,
        notas: 'Retiro desde Ver/Editar Trabajador'
      });
      if (!r || !r.success) {
        self._showToast('Error: ' + (r && r.error ? r.error.message : 'desconocido'), 'error');
        return;
      }
      self._showToast('🔴 Trabajador retirado. Evento RETIRO registrado.', 'success');
      // Cerrar el modal y refrescar la lista
      if (parentModal) parentModal.remove();
      await self._load();
    } catch (e) {
      self._showToast('Error: ' + e.message, 'error');
    }
  }

  // 📦767 · FASE 1.0-G.2 · Reingreso laboral via gh:cambiar-estado.
  // El backend (1.0-C/D-1) limpia fecha_retiro y registra evento REINGRESO atómicamente.
  async _openReingresarConfirm(personalId, nombre, parentModal) {
    var self = this;
    var confirmed = await this._confirmDialog().confirm({
      title: '🟢 Reingresar Trabajador',
      message: '¿Querés reingresar a "' + nombre + '"?',
      details: 'Cambio laboral: estado → activo, fecha_retiro → NULL, evento REINGRESO registrado. Si necesitás una nueva contratación, use el flujo "Nueva contratación" desde Gestión Humana → Contrataciones.',
      confirmText: 'Sí, reingresar',
      cancelText: 'Cancelar',
      type: 'info'
    });
    if (!confirmed) return;
    try {
      var r = await window.electronAPI.ghCambiarEstado({
        personalId: personalId,
        estado: 'activo',
        notas: 'Reingreso desde Ver/Editar Trabajador'
      });
      if (!r || !r.success) {
        self._showToast('Error: ' + (r && r.error ? r.error.message : 'desconocido'), 'error');
        return;
      }
      self._showToast('🟢 Trabajador reingresado. Evento REINGRESO registrado.', 'success');
      // Cerrar el modal y refrescar la lista
      if (parentModal) parentModal.remove();
      await self._load();
    } catch (e) {
      self._showToast('Error: ' + e.message, 'error');
    }
  }

  _exportarCSV() {
    if (this.filtered.length === 0) {
      this._showToast('No hay trabajadores para exportar', 'warning');
      return;
    }
    var headers = ['Cédula', 'Nombres', 'Apellidos', 'Cargo', 'Estado', 'Salario', 'Email', 'Teléfono', 'Fecha Ingreso'];
    var rows = this.filtered.map(function (p) {
      return [
        p.cedula || '',
        p.nombres || '',
        p.apellidos || '',
        p.cargo || '',
        p.estado || '',
        p.salario || '',
        p.email || '',
        p.telefono || '',
        p.fechaIngreso || ''
      ].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',');
    });
    var csv = headers.join(',') + '\n' + rows.join('\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'trabajadores_' + this.companyName + '_' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this._showToast('Exportadas ' + this.filtered.length + ' filas a CSV', 'success');
  }

  // === IPC CALLS ===
  async _create(data) {
    try {
      var r = await window.electronAPI.ghCreatePersonal({ companyName: this.companyName, data: data });
      if (r && r.success) {
        this._showToast('✅ Trabajador creado: ' + data.nombres + ' ' + data.apellidos, 'success');
        await this._load();
      } else {
        this._showToast('❌ Error: ' + (r.error ? r.error.message : 'desconocido'), 'error');
      }
    } catch (e) {
      this._showToast('❌ Error: ' + e.message, 'error');
    }
  }

  async _update(personalId, data) {
    try {
      var r = await window.electronAPI.ghUpdatePersonal({ personalId: personalId, updates: data });
      if (r && r.success) {
        this._showToast('✅ Trabajador actualizado', 'success');
        await this._load();
      } else {
        this._showToast('❌ Error: ' + (r.error ? r.error.message : 'desconocido'), 'error');
      }
    } catch (e) {
      this._showToast('❌ Error: ' + e.message, 'error');
    }
  }

  async _delete(personalId) {
    try {
      var r = await window.electronAPI.ghDeletePersonal({ personalId: personalId });
      if (r && r.success) {
        // 📦767 · F-1 · Toast refleja la nueva semántica: ocultar (no retirar)
        this._showToast('✅ Trabajador ocultado (historial preservado)', 'success');
        await this._load();
      } else {
        this._showToast('❌ Error: ' + (r.error ? r.error.message : 'desconocido'), 'error');
      }
    } catch (e) {
      this._showToast('❌ Error: ' + e.message, 'error');
    }
  }

  // === IMPORT EXCEL (📦732) ===
  async _openImport() {
    if (!window.electronAPI || !window.electronAPI.ghSelectExcel) {
      this._showToast('Función de import no disponible', 'error');
      return;
    }
    var selectRes = await window.electronAPI.ghSelectExcel({});
    if (!selectRes || !selectRes.success) {
      this._showToast('Error abriendo selector: ' + (selectRes && selectRes.error ? selectRes.error.message : 'desconocido'), 'error');
      return;
    }
    if (selectRes.data.canceled || !selectRes.data.filePath) {
      return; // user canceló
    }
    var filePath = selectRes.data.filePath;
    var parseRes = await window.electronAPI.ghParseExcel({ filePath: filePath });
    if (!parseRes || !parseRes.success) {
      this._showToast('Error leyendo Excel: ' + (parseRes && parseRes.error ? parseRes.error.message : 'desconocido'), 'error');
      return;
    }
    this._importData = parseRes.data; // { sheetName, headers, rows, totalRows }

    // 📦734 · Detectar columna de empresa (si existe en el Excel) y armar la lista
    // de empresas únicas. Esto permite filtrar el preview por empresa y dejar
    // pre-seleccionada la empresa actual del módulo.
    this._importCompanyColumn = null;
    this._importCompanyValues = [];
    this._importCompanyFilter = null; // null = "Todas las empresas"
    for (var hi = 0; hi < parseRes.data.headers.length; hi++) {
      var h = parseRes.data.headers[hi];
      var n = _bpNormalize(h);
      if (BP_IMPORT_COMPANY_SYNONYMS.indexOf(n) >= 0) {
        this._importCompanyColumn = h;
        break;
      }
    }
    if (this._importCompanyColumn) {
      var seen = {};
      parseRes.data.rows.forEach(function (row) {
        var v = row[this._importCompanyColumn];
        if (v != null && v !== '') {
          var k = String(v).trim();
          if (!seen[k]) { seen[k] = true; this._importCompanyValues.push(k); }
        }
      }.bind(this));
      this._importCompanyValues.sort();
      // Pre-seleccionar la empresa actual. Match robusto en 2 pasos:
      //  1) Match exacto (case-insensitive, normalizado)
      //  2) Match "contains" bidireccional: el código está contenido en el nombre
      //     o viceversa (útil cuando el Excel tiene solo "TEMPOACTIVA" y la
      //     empresa es "TEMPOACTIVA EST S.A.S." con sufijos)
      var currentKey = _bpNormalize(this.companyName || this.companyKey || '');
      for (var vi = 0; vi < this._importCompanyValues.length; vi++) {
        var nk = _bpNormalize(this._importCompanyValues[vi]);
        if (nk === currentKey) {
          this._importCompanyFilter = this._importCompanyValues[vi];
          break;
        }
      }
      if (!this._importCompanyFilter && currentKey) {
        for (var vj = 0; vj < this._importCompanyValues.length; vj++) {
          var nk2 = _bpNormalize(this._importCompanyValues[vj]);
          if (nk2.length >= 3 && (currentKey.indexOf(nk2) >= 0 || nk2.indexOf(currentKey) >= 0)) {
            this._importCompanyFilter = this._importCompanyValues[vj];
            break;
          }
        }
      }
    }

    this._renderImportPreview();
    var modal = this.container.querySelector('#bp-import-modal');
    if (modal) modal.removeAttribute('hidden');
  }

  _renderImportPreview() {
    var data = this._importData;
    if (!data) return;
    var self = this;

    // Auto-mapear headers a campos
    var mapping = {}; // { field: header | null }
    var usedHeaders = {};
    // 📦733 · Auto-mapear campos BD Y campos auxiliares (nombres2, apellidos2)
    var allFields = BP_IMPORT_FIELDS.concat(BP_IMPORT_AUX_FIELDS);
    allFields.forEach(function (field) {
      var synonyms = BP_IMPORT_FIELD_MAP[field] || [];
      var matched = null;
      for (var i = 0; i < data.headers.length; i++) {
        var h = data.headers[i];
        if (usedHeaders[h]) continue;
        var n = _bpNormalize(h);
        if (synonyms.indexOf(n) >= 0) {
          matched = h;
          usedHeaders[h] = true;
          break;
        }
      }
      mapping[field] = matched;
    });

    // 📦734 · Filtrar filas por empresa (si hay columna de empresa y filtro activo)
    var filteredRows = data.rows;
    var rowsByCompany = data.totalRows;
    var companyCol = this._importCompanyColumn;
    var companyFilter = this._importCompanyFilter;
    if (companyCol && companyFilter) {
      filteredRows = data.rows.filter(function (row) {
        var v = row[companyCol];
        return v != null && String(v).trim().toLowerCase() === companyFilter.toLowerCase();
      });
      rowsByCompany = filteredRows.length;
    }

    // Stats
    var mappedCount = Object.keys(mapping).filter(function (k) { return mapping[k]; }).length;
    var missingRequired = ['cedula', 'nombres', 'apellidos'].filter(function (k) { return !mapping[k]; });

    var summaryHtml =
      '<div class="bp-import-summary__row">' +
        '<span class="bp-import-summary__chip"><i class="fas fa-file-excel"></i> Hoja: <strong>' + self._escHtml(data.sheetName) + '</strong></span>' +
        '<span class="bp-import-summary__chip"><i class="fas fa-list"></i> Filas en archivo: <strong>' + data.totalRows + '</strong></span>' +
        (companyCol ? '<span class="bp-import-summary__chip"><i class="fas fa-building"></i> Empresa detectada: <strong>' + self._escHtml(companyCol) + '</strong></span>' : '') +
        '<span class="bp-import-summary__chip"><i class="fas fa-columns"></i> Columnas mapeadas: <strong>' + mappedCount + ' / ' + BP_IMPORT_FIELDS.length + '</strong></span>' +
      '</div>';

    // 📦734 · Filtro de empresa (selector + stats)
    if (companyCol && this._importCompanyValues.length > 0) {
      var opts = '<option value="">Todas las empresas (' + data.totalRows + ')</option>';
      this._importCompanyValues.forEach(function (v) {
        var count = data.rows.filter(function (r) { return r[companyCol] != null && String(r[companyCol]).trim() === v; }).length;
        var selected = (v === companyFilter) ? ' selected' : '';
        opts += '<option value="' + self._escHtml(v) + '"' + selected + '>' + self._escHtml(v) + ' (' + count + ')</option>';
      });
      summaryHtml +=
        '<div class="bp-import-company-filter">' +
          '<label class="bp-filter-group__label" for="bp-import-company-select">Filtrar por empresa</label>' +
          '<select id="bp-import-company-select" class="bp-filter-select">' + opts + '</select>' +
        '</div>';
      var omitted = data.totalRows - rowsByCompany;
      var filterClass = companyFilter ? 'bp-import-summary__info' : 'bp-import-summary__error';
      var filterIcon = companyFilter ? 'fa-filter' : 'fa-exclamation-triangle';
      var filterMsg = companyFilter
        ? 'Se importarán <strong>' + rowsByCompany + '</strong> trabajador(es) de <strong>' + self._escHtml(companyFilter) + '</strong>.' +
          (omitted > 0 ? ' Se omitirán <strong>' + omitted + '</strong> de otras empresas.' : '')
        : '<strong>Se importarán TODAS las ' + data.totalRows + ' filas</strong> (sin filtro de empresa).';
      summaryHtml +=
        '<div class="' + filterClass + '">' +
          '<i class="fas ' + filterIcon + '"></i> ' + filterMsg +
        '</div>';
    }

    // 📦734 · Actualizar texto del botón confirmar con el conteo filtrado
    var confirmTextEl = this.container.querySelector('#bp-import-confirm-text');
    if (confirmTextEl) {
      confirmTextEl.textContent = companyFilter
        ? 'Importar ' + rowsByCompany + ' de ' + companyFilter
        : 'Importar ' + data.totalRows;
    }

    if (missingRequired.length > 0) {
      summaryHtml +=
        '<div class="bp-import-summary__error">' +
          '<i class="fas fa-exclamation-triangle"></i> ' +
          'Faltan columnas obligatorias: <strong>' + missingRequired.join(', ') + '</strong>. Sin ellas no se puede importar.' +
        '</div>';
    }
    var sumEl = this.container.querySelector('#bp-import-summary');
    if (sumEl) sumEl.innerHTML = summaryHtml;

    // 📦746 · Los defaults (Caja, ARL) ya NO se muestran como opción en el
    // select ni como sección arriba. Aparecen como una pequeña sección
    // EMERGENTE (slide-down) justo debajo del select cuando el user elige
    // "— sin asignar —" en un campo con default. Esto mantiene la interfaz
    // limpia y los defaults solo aparecen cuando se necesitan.

    // Wirear el selector de empresa
    var companySel = this.container.querySelector('#bp-import-company-select');
    if (companySel) {
      companySel.onchange = function () {
        self._importCompanyFilter = companySel.value || null;
        self._renderImportPreview();
      };
    }

    // Inicializar mapa de defaults customizados por el user en este modal.
    // Si ya había algo de un render previo, lo conservamos. El formato es:
    //   customDefaults[field] = string (lo que el user tipeó en el input)
    // Si el user deja el input vacío, ese campo NO se aplica como default.
    if (!this._importCustomDefaults) this._importCustomDefaults = {};

    // Mapping: tabla de campos
    var mapHtml = '<table class="bp-import-mapping__table"><thead><tr><th>Campo BD</th><th>Requerido</th><th>Columna del Excel</th></tr></thead><tbody>';
    BP_IMPORT_FIELDS.forEach(function (field) {
      var required = ['cedula', 'nombres', 'apellidos'].indexOf(field) >= 0;
      // 📦746 · Solo "— sin asignar —" + columnas del Excel. Nada de "★ Default"
      // en el select. El default aparece como sección EMERGENTE debajo.
      var opts = '<option value="">— sin asignar —</option>';
      data.headers.forEach(function (h) {
        opts += '<option value="' + self._escHtml(h) + '"' + (mapping[field] === h ? ' selected' : '') + '>' + self._escHtml(h) + '</option>';
      });
      // Construir la celda. Si el campo tiene default y la selección actual
      // es "— sin asignar —", mostramos la sección emergente (con el valor
      // que el user haya tipeado, o el del sistema si no ha tipeado nada).
      var hasDefault = !!BP_IMPORT_DEFAULTS[field];
      var isUnassigned = !mapping[field];
      var showEmerge = hasDefault && isUnassigned;
      var sysDefault = hasDefault ? BP_IMPORT_DEFAULTS[field] : '';
      var currentCustom = (this._importCustomDefaults[field] != null)
        ? this._importCustomDefaults[field]
        : (showEmerge ? sysDefault : '');
      // La celda tiene 2 elementos stacked: el select (siempre) y el emergente
      // (solo si showEmerge). El emergente tiene animación CSS slide-down.
      var cellHtml = '<select class="bp-filter-select bp-import-mapping__select" data-field="' + field + '">' + opts + '</select>' +
        '<div class="bp-import-emerge' + (showEmerge ? ' is-open' : '') + '" data-emerge-for="' + field + '">' +
          '<i class="fas fa-magic bp-import-emerge__icon"></i>' +
          '<div class="bp-import-emerge__body">' +
            '<span class="bp-import-emerge__label">Valor por defecto (se aplica a filas vacías):</span>' +
            '<input type="text" class="bp-import-emerge__input" data-emerge-input="' + field + '"' +
              ' value="' + self._escHtml(currentCustom) + '"' +
              ' placeholder="' + self._escHtml(sysDefault) + '" />' +
          '</div>' +
          '<button type="button" class="bp-import-emerge__clear" data-emerge-clear="' + field + '" title="Quitar default">' +
            '<i class="fas fa-times"></i>' +
          '</button>' +
        '</div>';
      mapHtml += '<tr>' +
        '<td><code>' + field + '</code></td>' +
        '<td>' + (required ? '<span class="bp-badge bp-badge--required">Sí</span>' : '<span class="bp-badge bp-badge--optional">No</span>') + '</td>' +
        '<td class="bp-import-mapping__cell">' + cellHtml + '</td>' +
      '</tr>';
    }.bind(this));
    mapHtml += '</tbody></table>';
    var mapEl = this.container.querySelector('#bp-import-mapping');
    if (mapEl) mapEl.innerHTML = mapHtml;

    // Wirear los selects de mapeo
    var self2 = this;
    if (mapEl) {
      mapEl.querySelectorAll('.bp-import-mapping__select').forEach(function (sel) {
        sel.onchange = function () {
          var f = sel.getAttribute('data-field');
          var v = sel.value || null;
          mapping[f] = v;
          // 📦746 · Si el campo tiene default y el user eligió "— sin asignar —",
          // mostramos la sección emergente con el valor del sistema (o el que
          // el user haya tipeado antes). Si eligió una columna, ocultamos el
          // emergente (ya no aplica — el Excel provee el valor).
          var emerge = mapEl.querySelector('[data-emerge-for="' + f + '"]');
          if (emerge) {
            if (!v && BP_IMPORT_DEFAULTS[f]) {
              emerge.classList.add('is-open');
              var input = emerge.querySelector('[data-emerge-input="' + f + '"]');
              if (input && (!self2._importCustomDefaults[f] || self2._importCustomDefaults[f] === '')) {
                input.value = BP_IMPORT_DEFAULTS[f];
                self2._importCustomDefaults[f] = BP_IMPORT_DEFAULTS[f];
              }
            } else {
              emerge.classList.remove('is-open');
            }
          }
        };
      });
      // Wirear inputs de defaults customizados
      mapEl.querySelectorAll('.bp-import-emerge__input').forEach(function (inp) {
        inp.oninput = function () {
          var f = inp.getAttribute('data-emerge-input');
          self2._importCustomDefaults[f] = inp.value;
        };
      });
      // Wirear botón "quitar default" (X)
      mapEl.querySelectorAll('.bp-import-emerge__clear').forEach(function (btn) {
        btn.onclick = function () {
          var f = btn.getAttribute('data-emerge-clear');
          self2._importCustomDefaults[f] = '';
          var inp = mapEl.querySelector('[data-emerge-input="' + f + '"]');
          if (inp) inp.value = '';
        };
      });
    }

    // Preview: primeras 5 filas MAPEADAS (filtradas por empresa si aplica)
    var previewHtml = '<table class="bp-table"><thead><tr>';
    BP_IMPORT_FIELDS.forEach(function (f) { previewHtml += '<th>' + f + '</th>'; });
    previewHtml += '</tr></thead><tbody>';
    var previewRows = filteredRows.slice(0, 5);
    previewRows.forEach(function (row) {
      previewHtml += '<tr>';
      BP_IMPORT_FIELDS.forEach(function (f) {
        var h = mapping[f];
        var v = h ? (row[h] != null ? row[h] : '') : '';
        previewHtml += '<td>' + self._escHtml(String(v).slice(0, 50)) + '</td>';
      });
      previewHtml += '</tr>';
    });
    previewHtml += '</tbody></table>';
    if (filteredRows.length > 5) {
      previewHtml += '<div class="bp-import-preview__hint">Mostrando 5 de ' + filteredRows.length + ' filas filtradas' +
        (companyFilter ? ' (de ' + companyCol + ' = ' + self._escHtml(companyFilter) + ')' : '') + '</div>';
    } else if (companyFilter && data.totalRows > filteredRows.length) {
      previewHtml += '<div class="bp-import-preview__hint">' + (data.totalRows - filteredRows.length) +
        ' filas omitidas (de otras empresas)</div>';
    }
    var prevEl = this.container.querySelector('#bp-import-preview');
    if (prevEl) prevEl.innerHTML = previewHtml;

    // Guardar el mapping para usarlo en _confirmImport
    this._importMapping = mapping;

    // Deshabilitar botón confirmar si faltan requeridos
    var confirmBtn = this.container.querySelector('#bp-import-confirm');
    if (confirmBtn) {
      var disable = missingRequired.length > 0;
      confirmBtn.disabled = disable;
      confirmBtn.style.opacity = disable ? '0.5' : '1';
      confirmBtn.style.cursor = disable ? 'not-allowed' : 'pointer';
    }
  }

  async _confirmImport() {
    var self = this;
    var data = this._importData;
    var mapping = this._importMapping;
    if (!data || !mapping) return;

    // Validar requeridos
    var missingRequired = ['cedula', 'nombres', 'apellidos'].filter(function (k) { return !mapping[k]; });
    if (missingRequired.length > 0) {
      this._showToast('Faltan columnas obligatorias: ' + missingRequired.join(', '), 'error');
      return;
    }

    // 📦734 · Filtrar filas por empresa (si hay columna de empresa y filtro activo)
    var companyCol = this._importCompanyColumn;
    var companyFilter = this._importCompanyFilter;
    var sourceRows = data.rows;
    if (companyCol && companyFilter) {
      sourceRows = data.rows.filter(function (row) {
        var v = row[companyCol];
        return v != null && String(v).trim().toLowerCase() === companyFilter.toLowerCase();
      });
    }

    // Mapear rows + normalizar + concatenar auxiliares
    // 📦733 · Auto-concatena nombres2 + nombres, apellidos2 + apellidos
    //   y normaliza fechas YYYYMMDD → YYYY-MM-DD, cédula a string, etc.
    // 📦746 · Custom defaults: si el user eligió "— sin asignar —" en un campo
    //   con default, se usa el valor del input emergente (customDefaults[f]).
    //   Si el input está vacío, NO se aplica default a las filas vacías.
    var customDefaults = this._importCustomDefaults || {};
    var rows = sourceRows.map(function (row) {
      var out = {};
      // Campos BD principales
      BP_IMPORT_FIELDS.forEach(function (f) {
        var h = mapping[f];
        if (h && row[h] != null && row[h] !== '') {
          // Hay columna mapeada Y el Excel tiene valor → usar el del Excel
          out[f] = String(row[h]).trim();
        } else if (!h && BP_IMPORT_DEFAULTS[f]) {
          // "— sin asignar —" en un campo con default → usar el custom del user
          // (puede ser el del sistema pre-llenado, o uno que el user tipeó).
          // Si el custom es '' (user lo limpió), NO se aplica.
          var custom = customDefaults[f];
          if (custom != null && String(custom).trim() !== '') {
            out[f] = String(custom).trim();
          }
        }
      });
      // Campos auxiliares (nombres2, apellidos2) — se concatenan al final
      BP_IMPORT_AUX_FIELDS.forEach(function (f) {
        var h = mapping[f];
        if (h && row[h] != null && row[h] !== '') {
          out[f] = String(row[h]).trim();
        }
      });
      return out;
    }).filter(function (r) { return r.cedula && r.nombres && r.apellidos; });

    // Normalizar + concatenar
    rows.forEach(function (r) {
      // Concatenar nombres2 al final de nombres
      if (r.nombres2) {
        r.nombres = (r.nombres + ' ' + r.nombres2).replace(/\s+/g, ' ').trim();
        delete r.nombres2;
      }
      // Concatenar apellidos2 al final de apellidos
      if (r.apellidos2) {
        r.apellidos = (r.apellidos + ' ' + r.apellidos2).replace(/\s+/g, ' ').trim();
        delete r.apellidos2;
      }
      // Cédula: forzar a string (viene como número del Excel)
      if (r.cedula) r.cedula = String(r.cedula).replace(/[^\d]/g, '');
      // Email: lowercase + trim
      if (r.email) r.email = String(r.email).toLowerCase().trim();
      // Teléfono: solo dígitos
      if (r.telefono) r.telefono = String(r.telefono).replace(/[^\d+]/g, '');
      // Salario: parseFloat
      if (r.salario) {
        var s = String(r.salario).replace(/[^\d.-]/g, '');
        r.salario = parseFloat(s) || null;
      }
      // 📦747 · Normalizar TODAS las fechas (no solo fechaIngreso).
      // Acepta YYYYMMDD, YYYY-MM-DD, DD/MM/YYYY, Date objects, etc.
      if (r.fechaIngreso) r.fechaIngreso = self._normalizeDate(r.fechaIngreso);
      if (r.fechaRetiro) r.fechaRetiro = self._normalizeDate(r.fechaRetiro);
      if (r.fechaNacimiento) r.fechaNacimiento = self._normalizeDate(r.fechaNacimiento);
      if (r.fechaExpCedula) r.fechaExpCedula = self._normalizeDate(r.fechaExpCedula);
      // Estado: si viene "R" (código legacy) y tiene fecha de retiro → retirado
      if (r.estado && /^[Rr]$/.test(r.estado)) {
        r.estado = r.fechaRetiro ? 'retirado' : 'activo';
      }
    });

    if (rows.length === 0) {
      var msg = companyFilter
        ? 'Ninguna fila de ' + companyFilter + ' tiene los 3 campos requeridos'
        : 'Ninguna fila tiene los 3 campos requeridos (cédula, nombres, apellidos)';
      this._showToast(msg, 'warning');
      return;
    }

    // 📦736 · Leer el modo de duplicados seleccionado
    var dupModeRadio = this.container.querySelector('input[name="bp-import-dup-mode"]:checked');
    var duplicateMode = dupModeRadio ? dupModeRadio.value : 'skip';

    // Deshabilitar botón mientras se procesa
    var confirmBtn = this.container.querySelector('#bp-import-confirm');
    var confirmText = this.container.querySelector('#bp-import-confirm-text');
    if (confirmBtn) confirmBtn.disabled = true;
    if (confirmText) confirmText.textContent = 'Importando…';

    var res = await window.electronAPI.ghImportPersonal({
      companyName: this.companyName,
      rows: rows,
      duplicateMode: duplicateMode
    });

    // Rehabilitar botón
    if (confirmBtn) confirmBtn.disabled = false;
    if (confirmText) confirmText.textContent = 'Importar';

    if (!res || !res.success) {
      this._showToast('Error importando: ' + (res && res.error ? res.error.message : 'desconocido'), 'error');
      return;
    }

    var d = res.data;
    var parts = [];
    parts.push('✅ Importación completa: ' + d.created + ' creado(s)');
    if (d.updated && d.updated > 0) parts.push(d.updated + ' actualizado(s)');
    if (d.skipped && d.skipped.length > 0) parts.push(d.skipped.length + ' omitido(s)');
    if (d.errors && d.errors.length > 0) parts.push(d.errors.length + ' con error');
    var msg = parts.join(', ');
    this._showToast(msg, d.errors && d.errors.length > 0 ? 'warning' : 'success');

    // Cerrar modal
    var modal = this.container.querySelector('#bp-import-modal');
    if (modal) modal.setAttribute('hidden', '');

    // Recargar lista
    await this._load();

    // Si hubo errores, mostrarlos en consola para debug
    if (d.errors && d.errors.length > 0) {
      console.warn('[BasePersonal] Errores de import:', d.errors);
    }
  }

  // === DETAIL VIEW 360° (📦738/739 · modal con tabs + edición inline) ===
  async _openDetail(personalId) {
    var self = this;
    if (!window.electronAPI || !window.electronAPI.ghGetPersonal) {
      this._showToast('Función no disponible', 'error');
      return;
    }
    var res = await window.electronAPI.ghGetPersonal({ personalId: personalId });
    if (!res || !res.success) {
      this._showToast('Error: ' + (res && res.error ? res.error.message : 'desconocido'), 'error');
      return;
    }
    var p = res.data.personal;
    // Quitar cualquier modal de detalle previo
    var existing = document.getElementById('bp-detail-modal');
    if (existing) existing.remove();
    // Insertar el modal
    document.body.insertAdjacentHTML('beforeend', this._renderDetailModal(p));
    // Wirear los handlers
    var modal = document.getElementById('bp-detail-modal');
    if (!modal) return;
    // Cerrar con backdrop
    modal.querySelectorAll('[data-close-detail]').forEach(function (el) {
      el.onclick = function () { modal.remove(); };
    });
    // Tabs
    modal.querySelectorAll('.bp-detail-tab').forEach(function (btn) {
      btn.onclick = function () {
        var tab = btn.getAttribute('data-tab');
        modal.querySelectorAll('.bp-detail-tab').forEach(function (b) { b.classList.remove('bp-detail-tab--active'); });
        btn.classList.add('bp-detail-tab--active');
        modal.querySelectorAll('[data-panel]').forEach(function (p) { p.hidden = true; });
        var panel = modal.querySelector('[data-panel="' + tab + '"]');
        if (panel) panel.hidden = false;
      };
    });
    // 📦739 · Editar inline: mostrar/ocultar valores e inputs
    var editBtn = modal.querySelector('[data-action="edit"]');
    if (editBtn) editBtn.onclick = function () { self._setDetailMode(modal, 'edit'); };
    var cancelBtn = modal.querySelector('[data-action="cancel"]');
    if (cancelBtn) cancelBtn.onclick = function () { modal.remove(); self._openDetail(personalId); };
    var saveBtn = modal.querySelector('[data-action="save"]');
    if (saveBtn) saveBtn.onclick = function () { self._saveDetailEdit(modal, personalId); };
    // 📦767 · FASE 1.0-G.2 · Wire up de los botones de transición de ciclo.
    // Retirar trabajador / Reingresar invocan gh:cambiar-estado (no update-personal).
    var retirarBtn = modal.querySelector('[data-action="retirar-trabajador"]');
    if (retirarBtn) retirarBtn.onclick = function () {
      var pid = retirarBtn.getAttribute('data-personal-id');
      var nombre = retirarBtn.getAttribute('data-nombre') || '';
      self._openRetirarConfirm(pid, nombre, modal);
    };
    var reingresarBtn = modal.querySelector('[data-action="reingresar-trabajador"]');
    if (reingresarBtn) reingresarBtn.onclick = function () {
      var pid = reingresarBtn.getAttribute('data-personal-id');
      var nombre = reingresarBtn.getAttribute('data-nombre') || '';
      self._openReingresarConfirm(pid, nombre, modal);
    };
    // 📦748 · Cargar datos de los tabs relacionados (vacaciones, permisos, documentos) en background
    self._loadDetailTabs(modal, personalId);
  }

  // 📦748 · Carga los datos de vacaciones/permisos/documentos del worker en background.
  // Aplica a TODOS los workers (activos o retirados) — los registros se muestran por fecha.
  async _loadDetailTabs(modal, personalId) {
    var self = this;
    var companyName = self.companyName;
    var tasks = [
      { panel: 'vacaciones', fn: window.electronAPI.ghListVacaciones,
        params: { companyName: companyName, trabajadorId: personalId } },
      { panel: 'permisos', fn: window.electronAPI.ghListPermisos,
        params: { companyName: companyName, trabajadorId: personalId } },
      { panel: 'documentos', fn: window.electronAPI.ghListDocumentos,
        params: { companyName: companyName, trabajadorId: personalId } }
    ];
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      if (!t.fn) continue;
      try {
        var res = await t.fn(t.params);
        self._renderDetailTab(modal, t.panel, res);
      } catch (e) {
        // Si el handler no existe o falla, mostrar empty
        self._renderDetailTab(modal, t.panel, { success: true, data: [] });
      }
    }
  }

  // 📦748 · Renderiza la lista de un tab (vacaciones/permisos/documentos).
  // Si está vacío, muestra el empty state. Si tiene datos, muestra una tabla.
  _renderDetailTab(modal, panel, res) {
    var self = this;
    var loadingEl = modal.querySelector('[data-list-loading="' + panel + '"]');
    var listEl = modal.querySelector('[data-list="' + panel + '"]');
    var emptyEl = modal.querySelector('[data-list-empty="' + panel + '"]');
    var countEl = modal.querySelector('[data-count="' + panel + '"]');
    if (loadingEl) loadingEl.hidden = true;
    var rows = (res && res.success && Array.isArray(res.data)) ? res.data : [];
    if (countEl) countEl.textContent = rows.length;
    if (rows.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    var html = self._renderDetailTabTable(panel, rows);
    if (listEl) {
      listEl.innerHTML = html;
      listEl.hidden = false;
    }
  }

  // 📦748 · Genera la tabla HTML según el panel
  _renderDetailTabTable(panel, rows) {
    var self = this;
    if (panel === 'vacaciones') {
      var html = '<table class="bp-detail-table"><thead><tr>' +
        '<th>Solicitada</th><th>Inicio</th><th>Fin</th><th>Días</th><th>Estado</th><th>Notas</th>' +
        '</tr></thead><tbody>';
      rows.forEach(function (r) {
        html += '<tr>' +
          '<td>' + self._escHtml(self._fmtDateShort(r.fechaSolicitud)) + '</td>' +
          '<td>' + self._escHtml(self._fmtDateShort(r.fechaInicio)) + '</td>' +
          '<td>' + self._escHtml(self._fmtDateShort(r.fechaFin)) + '</td>' +
          '<td>' + self._escHtml(String(r.diasSolicitados || '')) + '</td>' +
          '<td><span class="bp-detail-table__status bp-detail-table__status--' +
            self._escHtml(r.estado || 'solicitada') + '">' + self._escHtml(r.estado || '—') + '</span></td>' +
          '<td>' + self._escHtml(r.notas || '—') + '</td>' +
        '</tr>';
      });
      return html + '</tbody></table>';
    }
    if (panel === 'permisos') {
      var html = '<table class="bp-detail-table"><thead><tr>' +
        '<th>Tipo</th><th>Inicio</th><th>Fin</th><th>Días</th><th>Estado</th><th>Motivo</th>' +
        '</tr></thead><tbody>';
      rows.forEach(function (r) {
        html += '<tr>' +
          '<td><span class="bp-detail-table__chip">' + self._escHtml(r.tipo || '—') + '</span></td>' +
          '<td>' + self._escHtml(self._fmtDateShort(r.fechaInicio)) + '</td>' +
          '<td>' + self._escHtml(self._fmtDateShort(r.fechaFin)) + '</td>' +
          '<td>' + self._escHtml(String(r.dias || '')) + '</td>' +
          '<td><span class="bp-detail-table__status bp-detail-table__status--' +
            self._escHtml(r.estado || 'activo') + '">' + self._escHtml(r.estado || '—') + '</span></td>' +
          '<td>' + self._escHtml(r.motivo || '—') + '</td>' +
        '</tr>';
      });
      return html + '</tbody></table>';
    }
    if (panel === 'documentos') {
      var html = '<table class="bp-detail-table"><thead><tr>' +
        '<th>Tipo</th><th>Título</th><th>Estado</th><th>Fecha Firma</th>' +
        '</tr></thead><tbody>';
      rows.forEach(function (r) {
        html += '<tr>' +
          '<td><span class="bp-detail-table__chip">' + self._escHtml(r.tipo || '—') + '</span></td>' +
          '<td>' + self._escHtml(r.titulo || '—') + '</td>' +
          '<td><span class="bp-detail-table__status bp-detail-table__status--' +
            self._escHtml(r.estado || 'pendiente') + '">' + self._escHtml(r.estado || '—') + '</span></td>' +
          '<td>' + self._escHtml(self._fmtDateShort(r.fechaFirma)) + '</td>' +
        '</tr>';
      });
      return html + '</tbody></table>';
    }
    return '';
  }

  // 📦739 · Cambia el modo del modal (view | edit)
  _setDetailMode(modal, mode) {
    modal.setAttribute('data-mode', mode);
    var showView = mode === 'view';
    modal.querySelectorAll('[data-view]').forEach(function (el) { el.hidden = !showView; });
    modal.querySelectorAll('[data-edit]').forEach(function (el) { el.hidden = showView; });
  }

  // 📦739 · Lee los inputs del modal y llama a ghUpdatePersonal
  // 📦767 · FASE 1.0-G.2 · Los campos de ciclo (estado, fechaRetiro, fechaIngreso)
  // NO se incluyen en `updates` — se manejan exclusivamente via Retirar/Reingresar/Recontratar.
  async _saveDetailEdit(modal, personalId) {
    var self = this;
    var updates = {};
    // 📦767 · I-103.A1.0-G.2 · Campos de ciclo excluidos explícitamente de update-personal.
    // Si la UI los incluye por error, el bridge los rechazará con PROTECTED_FIELD,
    // pero igual los limpiamos aquí para mantener el contrato claro en el frontend.
    var PROTECTED_FIELDS = ['estado', 'fechaRetiro', 'fechaIngreso'];
    modal.querySelectorAll('input[data-edit], select[data-edit]').forEach(function (inp) {
      var name = inp.getAttribute('name');
      if (!name) return;
      // Bloquear campos de ciclo aunque estén en el DOM
      if (PROTECTED_FIELDS.indexOf(name) !== -1) return;
      var v = inp.value;
      // Mapear campos a los nombres del bridge
      if (name === 'activoS400') {
        updates.activoS400 = (v === 'Si' || v === 'Sí' || v === '1') ? 1 : 0;
      } else {
        updates[name] = v;
      }
    });
    // Si cambió el nombre del header, re-renderizarlo después
    var newName = (updates.nombres || '') + ' ' + (updates.apellidos || '');
    // Deshabilitar el botón Guardar mientras se procesa
    var saveBtn = modal.querySelector('[data-action="save"]');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando…'; }
    var res = await window.electronAPI.ghUpdatePersonal({ personalId: personalId, updates: updates });
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar'; }
    if (!res || !res.success) {
      this._showToast('Error: ' + (res && res.error ? res.error.message : 'desconocido'), 'error');
      return;
    }
    this._showToast('✅ Trabajador actualizado', 'success');
    // Re-renderizar el modal con los datos frescos
    modal.remove();
    await this._openDetail(personalId);
    // Refrescar la tabla también
    await this._load();
  }

  // 📦738 · Genera el HTML del modal de detalle 360° (modo view / edit)
  _renderDetailModal(p) {
    var self = this;
    var fullName = self._escHtml((p.nombres || '') + ' ' + (p.apellidos || ''));
    var initials = self._getInitials(p.nombres, p.apellidos);
    var avatarColor = self._avatarColor(p.cedula);
    var cedulaFmt = self._fmtCedula(p.cedula);
    var sedeName = self._getSedeName(p.sedeId);
    var edad = self._calcEdad(p.fechaNacimiento);
    var antiguedad = self._calcAntiguedad(p.fechaIngreso);
    var estadoBadge = self._estadoBadge(p.estado);
    var s400Badge = self._s400Badge(p.activoS400);

    // Chips del header
    var chips = [];
    if (p.cargo) chips.push(self._chip('fa-briefcase', p.cargo));
    if (sedeName) chips.push(self._chip('fa-map-marker-alt', sedeName));
    chips.push(self._chip('fa-id-card', (p.tipoDocumento || 'CC') + ' ' + cedulaFmt));
    if (edad !== null) chips.push(self._chip('fa-birthday-cake', edad + ' años'));
    // 📦747 · _calcAntiguedad ya devuelve "...en la empresa" (ej: "7 años en la empresa"),
    // no concatenar de nuevo o se duplica ("7 años en la empresa en la empresa")
    chips.push(self._chip('fa-building', antiguedad));

    // Helper: campo con valor + input (📦739 · edición inline)
    // 📦747 · '—' cuando el valor es vacío o "0" (común en teléfono del Excel legacy).
    // Para type='date' o 'date-display', se muestra la fecha en formato DD/MM/YYYY.
    function field(icon, label, name, value, type) {
      type = type || 'text';
      var raw = (value === '' || value === null || value === undefined) ? '' : String(value);
      var isEmpty = !raw || raw === '0';
      // Para input editable: guardar SIEMPRE el valor crudo (incluso "0") para no perderlo
      var inputVal = raw;
      // Para display: aplicar formato
      var displayVal = isEmpty ? '—' : (type === 'date-display' ? self._fmtDateDisplay(raw) : raw);
      // Para input type='date' usar formato YYYY-MM-DD (que es el que acepta el input HTML)
      var inputType = type === 'date-display' ? 'date' : type;
      var inputValueForDate = (type === 'date-display' && !isEmpty) ? self._normalizeDate(raw) || raw : raw;
      return '<div class="bp-detail-field">' +
        '<div class="bp-detail-field__label"><i class="fas ' + icon + '"></i> ' + self._escHtml(label) + '</div>' +
        '<div class="bp-detail-field__value" data-view>' + self._escHtml(displayVal) + '</div>' +
        '<input type="' + inputType + '" class="bp-detail-field__input" name="' + name + '" value="' +
        self._escHtml(type === 'date-display' ? (inputValueForDate || '') : inputVal) + '" data-edit hidden />' +
      '</div>';
    }

    function select(icon, label, name, value, options) {
      var opts = '';
      options.forEach(function (o) {
        opts += '<option value="' + self._escHtml(o) + '"' + (o === value ? ' selected' : '') + '>' + self._escHtml(o) + '</option>';
      });
      return '<div class="bp-detail-field">' +
        '<div class="bp-detail-field__label"><i class="fas ' + icon + '"></i> ' + self._escHtml(label) + '</div>' +
        '<div class="bp-detail-field__value" data-view>' + self._escHtml(value || '—') + '</div>' +
        '<select class="bp-detail-field__input" name="' + name + '" data-edit hidden>' + opts + '</select>' +
      '</div>';
    }

    // Tab: Información Personal
    // 📦747 · 'date-display' = mostrar como DD/MM/YYYY en view, pero guardar como YYYY-MM-DD en edit
    var personalTab = '<div class="bp-detail-grid" data-panel="personal">' +
      field('fa-user', 'Nombres', 'nombres', p.nombres) +
      field('fa-user', 'Apellidos', 'apellidos', p.apellidos) +
      select('fa-id-card', 'Tipo de Documento', 'tipoDocumento', p.tipoDocumento || 'CC', ['CC', 'CE', 'TI', 'PAS']) +
      field('fa-id-card', 'Cédula', 'cedula', p.cedula) +
      field('fa-calendar', 'Fecha de Expedición Cédula', 'fechaExpCedula', p.fechaExpCedula, 'date-display') +
      field('fa-map-marker-alt', 'Lugar de Expedición Cédula', 'lugarExpCedula', p.lugarExpCedula) +
      field('fa-calendar', 'Fecha de Nacimiento', 'fechaNacimiento', p.fechaNacimiento, 'date-display') +
      field('fa-map-marker-alt', 'Lugar de Nacimiento', 'lugarNacimiento', p.lugarNacimiento) +
      field('fa-phone', 'Teléfono', 'telefono', p.telefono) +
      field('fa-mobile-alt', 'Celular', 'celular', p.celular) +
      field('fa-envelope', 'Email', 'email', p.email, 'email') +
      select('fa-heart', 'Estado Civil', 'estadoCivil', p.estadoCivil,
        ['', 'soltero', 'casado', 'union_libre', 'separado', 'viudo']) +
      select('fa-graduation-cap', 'Nivel Educativo', 'nivelEducativo', p.nivelEducativo,
        ['', 'primaria', 'secundaria', 'tecnico', 'tecnologo', 'profesional', 'especializacion', 'maestria']) +
      field('fa-home', 'Dirección', 'direccion', p.direccion) +
      field('fa-map', 'Barrio', 'barrio', p.barrio) +
      field('fa-city', 'Ciudad', 'ciudad', p.ciudad) +
    '</div>';

    // Tab: Datos Laborales
    // 📦767 · FASE 1.0-G.2 · Campos de ciclo (fechaIngreso, fechaRetiro, estado) son READ-ONLY
    // en este modal. La UI expone acciones (Retirar/Reingresar) en lugar de inputs.
    // El cambio de ciclo pasa por los handlers correspondientes con sus eventos atómicos.
    var estadoNorm = p.estado || 'activo';
    var fechaIngresoDisplay = p.fechaIngreso
      ? (typeof p.fechaIngreso === 'string' && p.fechaIngreso.indexOf('T') > 0
          ? p.fechaIngreso.substring(0, 10) : p.fechaIngreso)
      : '—';
    var fechaRetiroDisplay = p.fechaRetiro
      ? (typeof p.fechaRetiro === 'string' && p.fechaRetiro.indexOf('T') > 0
          ? p.fechaRetiro.substring(0, 10) : p.fechaRetiro)
      : '—';
    // Botón de acción según el estado (solo visible si no es retirado actualmente)
    // 📦767 · I-103.A1.0-G.2.1 · Estilo badge clickeable (mismo aspecto que "Retirado"/"Inactivo"):
    //   - clases bp-badge bp-badge--muted (mismo gris que el badge del estado)
    //   - cursor pointer + hover sutil (inline style, sin tocar CSS)
    //   - sin border default del navegador (border:none)
    //   - font-family:inherit para que respete la fuente del sistema
    var accionCicloBoton = '';
    if (estadoNorm === 'activo') {
      accionCicloBoton = '<button type="button" class="bp-badge bp-badge--muted" style="cursor:pointer; border:none; font-family:inherit; margin-top: 0.5rem;" data-action="retirar-trabajador" data-personal-id="' + self._escHtml(p.id) + '" data-nombre="' + self._escHtml((p.nombres || '') + ' ' + (p.apellidos || '')) + '"><i class="fas fa-user-minus"></i> Retirar trabajador</button>';
    } else if (estadoNorm === 'retirado') {
      accionCicloBoton = '<button type="button" class="bp-badge bp-badge--muted" style="cursor:pointer; border:none; font-family:inherit; margin-top: 0.5rem;" data-action="reingresar-trabajador" data-personal-id="' + self._escHtml(p.id) + '" data-nombre="' + self._escHtml((p.nombres || '') + ' ' + (p.apellidos || '')) + '"><i class="fas fa-user-plus"></i> Reingresar</button>';
    }
    var laboralTab = '<div class="bp-detail-grid" data-panel="laboral" hidden>' +
      field('fa-briefcase', 'Cargo', 'cargo', p.cargo) +
      field('fa-dollar-sign', 'Salario', 'salario', p.salario, 'number') +
      select('fa-file-contract', 'Tipo de Contrato', 'tipoContrato', p.tipoContrato,
        ['', 'indefinido', 'fijo', 'prestacion', 'obra_labor', 'aprendizaje']) +
      // 📦767 · I-103.A1.0-G.2 · fechaIngreso READ-ONLY: se muestra el valor actual, sin input.
      // 📦767 · I-103.A1.0-G.2.1 · Sin `data-view`: visible en modo view y edit (no desaparece al alternar).
      '<div class="bp-detail-field"><div class="bp-detail-field__label"><i class="fas fa-calendar-check"></i> Fecha de Ingreso</div><div class="bp-detail-field__value">' + self._escHtml(self._fmtDateDisplay(fechaIngresoDisplay) || fechaIngresoDisplay) + '</div></div>' +
      // 📦767 · I-103.A1.0-G.2 · fechaRetiro READ-ONLY.
      // 📦767 · I-103.A1.0-G.2.1 · Sin `data-view`: visible en modo view y edit.
      '<div class="bp-detail-field"><div class="bp-detail-field__label"><i class="fas fa-calendar-times"></i> Fecha de Retiro</div><div class="bp-detail-field__value">' + self._escHtml(self._fmtDateDisplay(fechaRetiroDisplay) || fechaRetiroDisplay) + '</div></div>' +
      field('fa-building', 'Empresa Usuaria', 'empresaUsuaria', p.empresaUsuaria) +
      field('fa-map-marker-alt', 'Sede', 'sedeId', sedeName) +
      // 📦767 · I-103.A1.0-G.2 · Estado READ-ONLY como badge, con botón de acción al lado.
      // 📦767 · I-103.A1.0-G.2.1 · Sin `data-view`: badge + botón Retirar/Reingresar visibles
      // en modo view Y edit, para que el usuario pueda ejecutar la transición desde cualquier modo.
      '<div class="bp-detail-field"><div class="bp-detail-field__label"><i class="fas fa-toggle-on"></i> Estado</div><div class="bp-detail-field__value">' + estadoBadge + (accionCicloBoton ? ' ' + accionCicloBoton : '') + '</div></div>' +
      field('fa-university', 'Banco', 'banco', p.banco) +
      field('fa-credit-card', 'Número de Cuenta', 'numeroCuenta', p.numeroCuenta) +
      select('fa-hard-hat', 'S400', 'activoS400', p.activoS400 == 1 ? 'Si' : 'No', ['No', 'Si']) +
    '</div>';

    // Tab: Afiliaciones (4 cards con sus datos)
    var afilCard = function (icon, title, name, value) {
      return '<div class="bp-detail-card">' +
        '<div class="bp-detail-card__title"><i class="fas ' + icon + '"></i> ' + title + '</div>' +
        '<div class="bp-detail-card__sub">' + title.split(' ')[0] + '</div>' +
        '<div class="bp-detail-card__value" data-view>' + self._escHtml(value || '—') + '</div>' +
        '<input type="text" class="bp-detail-card__input" name="' + name + '" value="' +
        self._escHtml(value || '') + '" data-edit hidden />' +
      '</div>';
    };
    var afiliacionesTab = '<div class="bp-detail-grid bp-detail-grid--cards" data-panel="afiliaciones" hidden>' +
      afilCard('fa-heartbeat', 'EPS (Salud)', 'eps', p.eps) +
      afilCard('fa-piggy-bank', 'Fondo de Pensión', 'pension', p.pension) +
      afilCard('fa-hard-hat', 'ARL', 'arl', p.arl) +
      afilCard('fa-hand-holding-usd', 'Caja de Compensación', 'cajaCompensacion', p.cajaCompensacion) +
    '</div>';

    // Tabs de datos relacionados (📦748) — cargan con datos reales en background
    // El contenedor tiene un loading state que se reemplaza después de la consulta IPC.
    var loadingTab = function (panel, icon, label) {
      return '<div class="bp-detail-tabpanel" data-panel="' + panel + '" hidden>' +
        '<div class="bp-detail-tabpanel__loading" data-list-loading="' + panel + '">' +
          '<i class="fas ' + icon + '"></i><p>Cargando ' + label + '…</p>' +
        '</div>' +
        '<div class="bp-detail-tabpanel__list" data-list="' + panel + '" hidden></div>' +
        '<div class="bp-detail-tabpanel__empty" data-list-empty="' + panel + '" hidden>' +
          '<i class="fas ' + icon + '"></i>' +
          '<p>No hay registros de ' + label + ' para este trabajador</p>' +
        '</div>' +
      '</div>';
    };
    var vacacionesTab = loadingTab('vacaciones', 'fa-umbrella-beach', 'vacaciones');
    var permisosTab   = loadingTab('permisos',   'fa-file-medical',    'permisos y estados');
    var documentosTab = loadingTab('documentos', 'fa-file-signature',  'documentos');

    return '<div class="bp-modal" id="bp-detail-modal" data-mode="view">' +
      '<div class="bp-modal__backdrop" data-close-detail></div>' +
      '<div class="bp-modal__panel bp-modal__panel--detail">' +
        // Header
        '<header class="bp-detail-header">' +
          '<div class="bp-avatar bp-avatar--lg" style="background:' + avatarColor.bg + ';color:' + avatarColor.fg + ';">' + initials + '</div>' +
          '<div class="bp-detail-header__info">' +
            '<h2 class="bp-detail-header__name" data-view>' + fullName + '</h2>' +
            '<h2 class="bp-detail-header__name" data-edit hidden>' +
              '<input type="text" class="bp-detail-field__input" name="nombres" value="' + self._escHtml(p.nombres) + '" placeholder="Nombres" /> ' +
              '<input type="text" class="bp-detail-field__input" name="apellidos" value="' + self._escHtml(p.apellidos) + '" placeholder="Apellidos" />' +
            '</h2>' +
            '<div class="bp-detail-header__badges">' + estadoBadge + ' ' + s400Badge + '</div>' +
            '<div class="bp-detail-header__chips">' + chips.join('') + '</div>' +
          '</div>' +
          '<div class="bp-detail-header__actions" data-view>' +
            '<button class="bp-btn bp-btn--ghost" data-action="edit"><i class="fas fa-edit"></i> Editar</button>' +
          '</div>' +
          '<div class="bp-detail-header__actions" data-edit hidden>' +
            '<button class="bp-btn bp-btn--ghost" data-action="cancel"><i class="fas fa-times"></i> Cancelar</button>' +
            '<button class="bp-btn bp-btn--primary" data-action="save"><i class="fas fa-save"></i> Guardar</button>' +
          '</div>' +
        '</header>' +
        // Tabs
        '<nav class="bp-detail-tabs">' +
          '<button class="bp-detail-tab bp-detail-tab--active" data-tab="personal">Información Personal</button>' +
          '<button class="bp-detail-tab" data-tab="laboral">Datos Laborales</button>' +
          '<button class="bp-detail-tab" data-tab="afiliaciones">Afiliaciones</button>' +
          '<button class="bp-detail-tab" data-tab="vacaciones" data-tab-count="vacaciones">Vacaciones (<span data-count="vacaciones">0</span>)</button>' +
          '<button class="bp-detail-tab" data-tab="permisos" data-tab-count="permisos">Permisos (<span data-count="permisos">0</span>)</button>' +
          '<button class="bp-detail-tab" data-tab="documentos" data-tab-count="documentos">Documentos (<span data-count="documentos">0</span>)</button>' +
        '</nav>' +
        // Body
        '<div class="bp-detail-body">' +
          personalTab + laboralTab + afiliacionesTab + vacacionesTab + permisosTab + documentosTab +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // 📦738 · Chip para el header del detalle
  _chip(icon, text) {
    return '<span class="bp-chip"><i class="fas ' + icon + '"></i> ' + this._escHtml(text) + '</span>';
  }

  // 📦738 · Calcula edad desde fechaNacimiento (YYYY-MM-DD o YYYYMMDD) o null
  // 📦747 · Robusto a múltiples formatos: usa _normalizeDate primero
  _calcEdad(fechaNacimiento) {
    if (!fechaNacimiento) return null;
    var norm = this._normalizeDate(fechaNacimiento);
    if (!norm) return null;
    var fn = new Date(norm);
    if (isNaN(fn.getTime())) return null;
    var hoy = new Date();
    var edad = hoy.getFullYear() - fn.getFullYear();
    var m = hoy.getMonth() - fn.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < fn.getDate())) edad--;
    return edad >= 0 ? edad : null;
  }

  // 📦738 · Calcula antigüedad desde fechaIngreso (YYYY-MM-DD o YYYYMMDD)
  // 📦747 · Robusto a múltiples formatos
  _calcAntiguedad(fechaIngreso) {
    if (!fechaIngreso) return '0 día(s) en la empresa';
    var norm = this._normalizeDate(fechaIngreso);
    if (!norm) return '0 día(s) en la empresa';
    var fi = new Date(norm);
    if (isNaN(fi.getTime())) return '0 día(s) en la empresa';
    var hoy = new Date();
    var years = hoy.getFullYear() - fi.getFullYear();
    var m = hoy.getMonth() - fi.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < fi.getDate())) years--;
    if (years < 0) years = 0;
    if (years === 0) {
      var days = Math.floor((hoy - fi) / (1000 * 60 * 60 * 24));
      if (days <= 0) return 'hoy';
      if (days === 1) return '1 día en la empresa';
      return days + ' días en la empresa';
    }
    if (years === 1) return '1 año en la empresa';
    return years + ' años en la empresa';
  }

  destroy() {
    if (this.container) this.container.innerHTML = '';
  }
}

window.BasePersonalComponent = BasePersonalComponent;

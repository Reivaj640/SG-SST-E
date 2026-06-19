# Actas de Reunión (G-FO-009) — Datos Reales + Editor · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la vista mock de Actas de Reunión (`actas-reunion.js`) por datos reales de SQLite + crear un editor funcional que cree/edite actas conforme al formato G-FO-009.

**Architecture:** Vista master-detail con datos del backend. Botones "Nueva acta"/"Editar acta" navegan a un editor dedicado (`actas-editor.js`) que sigue el patrón de `revision-editor.js` (sidebar + secciones + sticky footer). El editor llama a `RevisionAltaDireccionService.guardarActa(empresaId, acta)` que ya existe y persiste a SQLite.

**Tech Stack:** Electron + vanilla JS (sin frameworks). IPC pre-existente: `revisionAltaDireccion:guardarActa`. CSS pre-existente: `revision-alta-direccion-v2.css`.

---

## Global Constraints

- **Stack:** vanilla JS, sin React/Vue. Globales (`window.Foo = Foo`), IIFE wrappers.
- **CSS:** Reusar SOLO clases `.kair-rad-*` ya existentes en `revision-alta-direccion-v2.css`. No agregar nuevas reglas.
- **IPC:** Usar SIEMPRE `window.RevisionAltaDireccionService.guardarActa(...)` (nunca llamar `electronAPI` directo desde vistas).
- **Patrón editor:** Sidebar de navegación + main content + sticky footer (igual que `revision-editor.js:286-456`).
- **Escaping:** SIEMPRE `_esc(str)` antes de insertar texto en HTML.
- **Estado:** `ctx.state.editorActa` con la misma forma que `ctx.state.editor` (preservar entre navegaciones).
- **Forma payload:** `acta = { id, empresaId, numero, fecha, estado, archivo, metadata: { tema, preside, ciudad, horaInicio, horaFin, participantes, ordenDia, desarrollo } }`.
- **Validación mínima:** fecha no vacía + preside no vacío + ≥1 participante.
- **No romper** lo existente: `RevisionEditorView`, `RevisionesListView`, etc., deben seguir funcionando.
- **No agregar** placeholder/tareas "implementar después". Cada paso entrega código ejecutable.
- **Commits** después de cada tarea con mensaje `feat(actas): ...` o `fix(actas): ...`.

---

## File Structure

| Archivo | Estado | Responsabilidad |
|---|---|---|
| `modules/.../vistas/actas-reunion.js` | **MODIFICAR** | Quitar `ACTAS_MOCK`, leer `ctx.data.actas`, transformar DB→view, empty state, navegación a editor |
| `modules/.../vistas/actas-editor.js` | **CREAR** | Formulario completo (generalidades, participantes, orden del día, desarrollo) |
| `modules/.../revision-alta-direccion-component.js` | **MODIFICAR** | Routing, header CTA, `guardarActa()` |
| `index.html` | **MODIFICAR** | Cargar `actas-editor.js` antes de `revision-alta-direccion-component.js` |

---

## Task 1: Modificar `actas-reunion.js` — datos reales + empty state + navegación

**Files:**
- Modify: `sgsst-electron-app/modules/verificacion/revision-alta-direccion/vistas/actas-reunion.js:1-274`

**Interfaces:**
- Consumes: `ctx.data.actas` (array de actas desde SQLite, cada una con shape `{ id, numero, fecha, estado, archivo, metadata: {...} }`)
- Consumes: `ctx.navigate(view, params)` para ir al editor
- Consumes: `ctx.toast(title, msg, type)` para feedback
- Consumes: `ctx.refresh()` para forzar re-render tras cambio de activeId
- Produces: DOM con vista master-detail de actas reales

### Step 1: Reemplazar `ACTAS_MOCK` por transformación DB→view y vacío

En `actas-reunion.js`, **eliminar** la variable `ACTAS_MOCK` completa (líneas 27-59) y reemplazar con función de transformación.

Buscar y borrar:

```javascript
/* Mock data de actas (basado en formato G-FO-009) */
var ACTAS_MOCK = [
  {
    id: 'AR-2025-11',
    ...
  }
];
```

Y la línea 63 que hace fallback al mock:

```javascript
var actas = (ctx.data.actas && ctx.data.actas.length > 0) ? ctx.data.actas : ACTAS_MOCK;
```

Reemplazar por:

```javascript
/**
 * Transforma un acta del shape DB ({id, numero, fecha, estado, metadata})
 * al shape que espera la vista master-detail.
 * @param {Object} dbActa - Acta cruda desde SQLite
 * @returns {Object} Acta en shape de vista
 */
function _mapDbActaToView(dbActa) {
  var meta = dbActa.metadata || {};
  return {
    id: dbActa.id,
    numero: dbActa.numero,
    fecha: dbActa.fecha || '',
    estado: dbActa.estado || 'Abierta',
    archivo: dbActa.archivo || '',
    /* Campos derivados de metadata */
    hora: (meta.horaInicio && meta.horaFin) ? (meta.horaInicio + ' - ' + meta.horaFin) : '—',
    lugar: meta.ciudad || '—',
    responsable: meta.preside || '—',
    tema: meta.tema || '',
    participantes: Array.isArray(meta.participantes) ? meta.participantes.map(function(p) { return p.nombre || ''; }) : [],
    ordenDelDia: meta.ordenDia || '',
    compromisos: Array.isArray(meta.desarrollo) ? meta.desarrollo.map(function(c, i) {
      return {
        id: c.id || ('CO-' + String(i + 1).padStart(3, '0')),
        tema: c.temaTratado || '',
        responsable: c.responsable || '—',
        fechaLimite: c.fecha || '',
        estado: c.estado || 'Pendiente'
      };
    }) : []
  };
}
```

Y al inicio de `render(ctx)`, después de definir `wrap`, agregar la transformación ANTES del bloque de empty state:

```javascript
function render(ctx) {
  /* Transformar actas del backend al shape de vista */
  var actas = (ctx.data.actas || []).map(_mapDbActaToView);

  /* Si no hay actas, mostrar empty state con CTA para crear primera */
  if (actas.length === 0) {
    return _renderEmptyState(ctx);
  }

  /* Estado local */
  var viewState = ctx.state.actasReunion || { activeId: actas[0] ? actas[0].id : null };

  var wrap = document.createElement('div');
  wrap.className = 'kair-rad-view-actas-reunion';
  /* ... resto del código existente sigue igual desde aquí ... */
```

### Step 2: Eliminar fallback obsoleto de la línea 63 (ahora redundante)

Verificar que el bloque nuevo arriba (lines de transformación + empty state) reemplazó completamente las líneas 26-63 originales. Las líneas desde `var viewState = ctx.state.actasReunion ...` en adelante (líneas 65+) se mantienen idénticas.

### Step 3: Agregar función `_renderEmptyState()` al final del módulo

Antes del `return { render: render };` (línea 271), agregar:

```javascript
/**
 * Renderiza el empty state cuando no hay actas registradas.
 * Ofrece un CTA primario para crear la primera acta.
 * @param {Object} ctx - Contexto de la vista (para navigate/toast)
 * @returns {HTMLElement} Wrap con el empty state
 */
function _renderEmptyState(ctx) {
  var wrap = document.createElement('div');
  wrap.className = 'kair-rad-state';
  wrap.style.padding = 'var(--rad-s8) var(--rad-s6)';
  wrap.innerHTML =
    '<div class="kair-rad-state__icon kair-rad-state__icon--muted">' +
      '<i class="bi bi-file-earmark-text" style="font-size:1.75rem"></i>' +
    '</div>' +
    '<h3 class="kair-rad-state__title">Sin actas registradas</h3>' +
    '<p class="kair-rad-state__desc">Crea la primera acta de reunión conforme al formato G-FO-009.</p>' +
    '<button class="kair-rad-header__action kair-rad-header__action--primary" id="kair-rad-actas-empty-new" style="margin-top: var(--rad-s4)">' +
      '<i class="bi bi-plus-circle"></i> Crear primera acta' +
    '</button>';

  setTimeout(function() {
    var btn = document.getElementById('kair-rad-actas-empty-new');
    if (btn && typeof ctx.navigate === 'function') {
      btn.addEventListener('click', function() {
        ctx.navigate('actas-editor');
      });
    }
  }, 0);

  return wrap;
}
```

### Step 4: Cambiar botón "Editar acta" para navegar al editor (en vez de toast)

En `actas-reunion.js`, buscar el bloque `setTimeout` (líneas 227-247) que bindea los botones. Reemplazar el handler de `btnEdit`:

```javascript
if (btnEdit && typeof ctx.navigate === 'function') {
  btnEdit.addEventListener('click', function() {
    ctx.navigate('actas-editor', { id: acta.id });
  });
}
```

### Step 5: Cambiar botón "Nueva acta" para navegar al editor (en vez de toast)

En el mismo bloque `setTimeout`, reemplazar el handler de `btnNew`:

```javascript
if (btnNew && typeof ctx.navigate === 'function') {
  btnNew.addEventListener('click', function() {
    ctx.navigate('actas-editor');
  });
}
```

### Step 6: Verificar visualmente

Pasos de verificación manual:

1. **Sin actas en DB** (estado actual):
   - Recargar app → ir a Verificación → 6.1.3 → Actas de Reunión Gerencial.
   - Esperado: empty state con título "Sin actas registradas", descripción, y botón "Crear primera acta".
   - Click en "Crear primera acta" → debe navegar a la vista `actas-editor` (probablemente error "Vista de editor no disponible" porque aún no existe — eso está OK, lo arreglamos en Task 2).

2. **Con actas en DB** (futuro, tras Task 4):
   - Las actas transformadas deben mostrar: `id`, `fecha`, `estado` (badge), `participantes.length`, `hora` derivada, `lugar` derivado, etc.

### Step 7: Commit

```bash
git add sgsst-electron-app/modules/verificacion/revision-alta-direccion/vistas/actas-reunion.js
git commit -m "feat(actas): usar datos reales del backend + empty state + navegación a editor"
```

---

## Task 2: Crear `actas-editor.js` — formulario completo

**Files:**
- Create: `sgsst-electron-app/modules/verificacion/revision-alta-direccion/vistas/actas-editor.js` (~400 líneas)

**Interfaces:**
- Consumes: `ctx.params.id` (string|null) — si viene, edita existente; si no, crea nueva
- Consumes: `ctx.data.actas` (array) para buscar el acta a editar
- Consumes: `ctx.data.empresaActiva` (string) para mostrar en el header
- Consumes: `ctx.navigate(view)` para volver al listado
- Consumes: `ctx.toast(title, msg, type)` para feedback
- Consumes: `ctx.refresh()` para forzar re-render
- Consumes: `ctx.guardarActa(data, esNuevo)` (provisto por el componente en Task 3)
- Produces: DOM con formulario completo + sticky footer

### Step 1: Crear el archivo con la estructura base y helpers

Crear `actas-editor.js` con este contenido inicial (estructura del módulo, helpers, constantes):

```javascript
/**
 * =====================================================================
 * SUBMÓDULO 6.1.3 — Vista: ACTAS EDITOR (G-FO-009)
 * Editor de actas de reunión gerencial.
 * Patrón: sidebar con secciones + main content + sticky footer
 * Replica el patrón de revision-editor.js pero específico para G-FO-009.
 * =====================================================================
 */

var ActasEditorView = (function() {
  'use strict';

  /* Secciones del editor (sidebar navigation) */
  var SECCIONES = [
    { key: 'generalidades',  num: 0, title: 'Generalidades',  desc: 'Datos de cabecera del acta' },
    { key: 'participantes',  num: 1, title: 'Participantes',  desc: 'Asistentes a la reunión' },
    { key: 'ordenDelDia',    num: 2, title: 'Orden del día',  desc: 'Agenda de la reunión' },
    { key: 'desarrollo',     num: 3, title: 'Desarrollo y compromisos', desc: 'Temas tratados y acciones' }
  ];

  /* Estado de compromiso posibles */
  var ESTADOS_COMPROMISO = ['Pendiente', 'En proceso', 'Cumplido', 'Vencido'];

  /* Helpers de escape y formato (mismo patrón que revision-editor.js) */
  function _esc(str) {
    if (str === null || str === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function formatDate(d) {
    if (!d) return '';
    var months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    var parts = String(d).split('-');
    if (parts.length === 3) return parseInt(parts[2], 10) + ' ' + months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
    return String(d);
  }

  function _field(name, label, value, type, required) {
    var req = required ? ' <span style="color:var(--rad-danger)">*</span>' : '';
    return '<div class="kair-rad-field">' +
      '<label>' + _esc(label) + req + '</label>' +
      '<input type="' + (type || 'text') + '" value="' + _esc(value || '') + '" data-field="' + _esc(name) + '" id="kair-rad-acta-edit-' + _esc(name) + '"' + (required ? ' required' : '') + '>' +
    '</div>';
  }

  function _textarea(name, label, value, placeholder, required) {
    var req = required ? ' <span style="color:var(--rad-danger)">*</span>' : '';
    return '<div class="kair-rad-field">' +
      '<label>' + _esc(label) + req + '</label>' +
      '<textarea data-field="' + _esc(name) + '" id="kair-rad-acta-edit-' + _esc(name) + '" placeholder="' + _esc(placeholder || '') + '" rows="4">' + _esc(value || '') + '</textarea>' +
    '</div>';
  }

  function _select(name, label, value, options, required) {
    var req = required ? ' <span style="color:var(--rad-danger)">*</span>' : '';
    var optsHtml = options.map(function(o) {
      var selected = (String(o.value) === String(value)) ? ' selected' : '';
      return '<option value="' + _esc(o.value) + '"' + selected + '>' + _esc(o.label) + '</option>';
    }).join('');
    return '<div class="kair-rad-field">' +
      '<label>' + _esc(label) + req + '</label>' +
      '<select data-field="' + _esc(name) + '" id="kair-rad-acta-edit-' + _esc(name) + '"' + (required ? ' required' : '') + '>' +
        optsHtml +
      '</select>' +
    '</div>';
  }

  return {
    render: function(ctx) { return _render(ctx); },
    SECCIONES: SECCIONES,
    ESTADOS_COMPROMISO: ESTADOS_COMPROMISO
  };

  /* Las funciones _render, _renderSeccion, _collectFormData se definen abajo */
  /* como funciones internas del módulo. Ver Step 2-5. */

})();

window.ActasEditorView = ActasEditorView;
```

⚠️ **IMPORTANTE:** Este código retorna el módulo con `render` que llama a `_render`. Las funciones internas se definen en los siguientes pasos dentro del IIFE. La forma final las une todas.

### Step 2: Agregar función `_render(ctx)` principal

Reemplazar la línea `render: function(ctx) { return _render(ctx); }` Y agregar (dentro del IIFE, antes del `return { ... }`):

```javascript
  /**
   * Render principal del editor.
   * @param {Object} ctx - Contexto de la vista
   * @returns {HTMLElement} Wrap con el editor completo
   */
  function _render(ctx) {
    /* Resolver acta: si viene id, buscar en ctx.data.actas; sino crear nueva */
    var id = ctx.params && ctx.params.id;
    var acta = null;
    var esNuevo = true;

    if (id) {
      var dbActa = (ctx.data.actas || []).filter(function(a) { return a.id === id; })[0];
      if (dbActa) {
        acta = _dbActaToEditorShape(dbActa);
        esNuevo = false;
      }
    }
    if (!acta) {
      acta = _nuevaActa(ctx);
      esNuevo = true;
    }

    /* Estado del editor (preservar entre navegaciones) */
    var editorState = ctx.state.editorActa || _initEditorState(acta);
    if (!ctx.state.editorActa || ctx.state.editorActa._actaId !== acta.id) {
      editorState = _initEditorState(acta);
      ctx.state.editorActa = editorState;
    }

    /* Construir DOM */
    var wrap = document.createElement('div');
    wrap.className = 'kair-rad-view-actas-editor';
    wrap._editorState = editorState;
    wrap._acta = acta;
    wrap._esNuevo = esNuevo;

    /* Header del editor (título + breadcrumb-like) */
    wrap.appendChild(_renderHeader(acta, esNuevo));

    /* Grid: sidebar + main */
    var grid = document.createElement('div');
    grid.className = 'kair-rad-editor';

    var main = document.createElement('div');
    main.className = 'kair-rad-editor__main';

    /* Tabs de sección (horizontal) */
    main.appendChild(_renderTabs(editorState, ctx));

    /* Render del contenido de la sección activa */
    var seccionActiva = SECCIONES.filter(function(s) { return s.key === editorState.activeKey; })[0] || SECCIONES[0];
    main.appendChild(_renderSeccion(seccionActiva, editorState, acta, ctx));

    grid.appendChild(main);

    /* Sidebar de navegación rápida */
    var sidebar = document.createElement('div');
    sidebar.className = 'kair-rad-editor__sidebar';
    sidebar.appendChild(_renderSidebarNav(editorState, ctx));
    grid.appendChild(sidebar);

    wrap.appendChild(grid);

    /* Sticky footer */
    wrap.appendChild(_renderFooter(esNuevo, ctx));

    /* Capturar cambios del form en tiempo real */
    wrap.addEventListener('input', function(e) {
      var inp = e.target;
      if (!inp || !inp.matches || !inp.matches('[data-field]')) return;
      var key = inp.getAttribute('data-field');
      if (!key) return;
      editorState.formData[key] = inp.value;
    });

    return wrap;
  }
```

### Step 3: Agregar funciones de inicialización y transformación de datos

Dentro del IIFE, antes de `_render`:

```javascript
  /**
   * Inicializa el editorState para una nueva acta o una existente.
   * @param {Object} acta - Acta en shape de editor
   * @returns {Object} Estado inicial
   */
  function _initEditorState(acta) {
    return {
      _actaId: acta.id,
      activeKey: 'generalidades',
      completed: {},
      formData: {
        fecha: acta.fecha || new Date().toISOString().split('T')[0],
        tema: acta.metadata.tema || '',
        preside: acta.metadata.preside || '',
        ciudad: acta.metadata.ciudad || '',
        horaInicio: acta.metadata.horaInicio || '',
        horaFin: acta.metadata.horaFin || '',
        ordenDia: acta.metadata.ordenDia || '',
        estado: acta.estado || 'Abierta'
      },
      participantes: (acta.metadata.participantes || []).slice(),
      desarrollo: (acta.metadata.desarrollo || []).slice()
    };
  }

  /**
   * Crea el shape inicial de un acta nueva.
   * @param {Object} ctx - Contexto de la vista
   * @returns {Object} Acta en shape de editor
   */
  function _nuevaActa(ctx) {
    return {
      id: null,
      numero: null,
      fecha: new Date().toISOString().split('T')[0],
      estado: 'Abierta',
      archivo: '',
      metadata: {
        tema: '',
        preside: '',
        ciudad: '',
        horaInicio: '',
        horaFin: '',
        participantes: [],
        ordenDia: '',
        desarrollo: []
      }
    };
  }

  /**
   * Transforma un acta del shape DB al shape que usa el editor.
   * @param {Object} dbActa - Acta cruda
   * @returns {Object} Acta en shape de editor
   */
  function _dbActaToEditorShape(dbActa) {
    var meta = dbActa.metadata || {};
    return {
      id: dbActa.id,
      numero: dbActa.numero,
      fecha: dbActa.fecha || '',
      estado: dbActa.estado || 'Abierta',
      archivo: dbActa.archivo || '',
      metadata: {
        tema: meta.tema || '',
        preside: meta.preside || '',
        ciudad: meta.ciudad || '',
        horaInicio: meta.horaInicio || '',
        horaFin: meta.horaFin || '',
        participantes: Array.isArray(meta.participantes) ? meta.participantes.slice() : [],
        ordenDia: meta.ordenDia || '',
        desarrollo: Array.isArray(meta.desarrollo) ? meta.desarrollo.slice() : []
      }
    };
  }
```

### Step 4: Agregar funciones de render (header, tabs, sidebar, footer, sección)

Dentro del IIFE, después de `_dbActaToEditorShape`:

```javascript
  /**
   * Render del header del editor (título + meta).
   */
  function _renderHeader(acta, esNuevo) {
    var head = document.createElement('div');
    head.style.margin = 'var(--rad-s4) var(--rad-s6) 0 var(--rad-s6)';
    var idLabel = acta.id || (esNuevo ? 'Nueva acta' : 'Acta sin ID');
    head.innerHTML =
      '<div class="kair-rad-inline-counter">' +
        '<span class="kair-rad-badge kair-rad-badge--info"><span class="dot"></span>Editor · G-FO-009 · ' + _esc(idLabel) + '</span>' +
        '<span>·</span>' +
        '<span>Acta de Reunión Gerencial</span>' +
      '</div>' +
      '<h1 style="margin: var(--rad-s2) 0 0 0; font: var(--rad-title-xl); color: var(--rad-text-strong)">' +
        (esNuevo ? 'Nueva acta de reunión' : 'Editar acta ' + _esc(acta.id)) +
      '</h1>';
    return head;
  }

  /**
   * Render de los tabs horizontales de sección.
   */
  function _renderTabs(editorState, ctx) {
    var tabs = document.createElement('div');
    tabs.className = 'kair-rad-editor-tabs';
    SECCIONES.forEach(function(s) {
      var btn = document.createElement('button');
      btn.className = 'kair-rad-editor-tab' +
        (editorState.activeKey === s.key ? ' is-active' : '') +
        (editorState.completed[s.key] ? ' is-complete' : '');
      btn.setAttribute('data-tab', s.key);
      btn.innerHTML =
        '<span class="kair-rad-editor-tab__num">' + (s.num || '·') + '</span>' +
        '<span>' + _esc(s.title) + '</span>';
      btn.addEventListener('click', function() {
        editorState.activeKey = s.key;
        ctx.state.editorActa = editorState;
        ctx.refresh();
      });
      tabs.appendChild(btn);
    });
    return tabs;
  }

  /**
   * Render del sidebar de navegación rápida (mismo patrón que revision-editor).
   */
  function _renderSidebarNav(editorState, ctx) {
    var card = document.createElement('div');
    card.className = 'kair-rad-side-card';
    card.innerHTML = '<h3 class="kair-rad-side-card__title">Secciones del acta</h3>';

    var navList = document.createElement('div');
    navList.className = 'kair-rad-side-nav';
    SECCIONES.forEach(function(s) {
      var item = document.createElement('button');
      item.className = 'kair-rad-side-nav__item' +
        (editorState.activeKey === s.key ? ' is-active' : '') +
        (editorState.completed[s.key] ? ' is-complete' : '');
      item.setAttribute('data-nav', s.key);
      item.innerHTML =
        '<span class="kair-rad-side-nav__num">' + (s.num || '·') + '</span>' +
        '<span class="kair-rad-side-nav__label">' + _esc(s.title) + '</span>';
      item.addEventListener('click', function() {
        editorState.activeKey = s.key;
        ctx.state.editorActa = editorState;
        ctx.refresh();
      });
      navList.appendChild(item);
    });
    card.appendChild(navList);
    return card;
  }

  /**
   * Render del footer sticky (Volver / Guardar borrador / Guardar y cerrar).
   */
  function _renderFooter(esNuevo, ctx) {
    var footer = document.createElement('div');
    footer.className = 'kair-rad-sticky-footer';
    footer.innerHTML =
      '<div class="kair-rad-sticky-footer__hint">' +
        'Complete los datos del acta conforme al formato G-FO-009.' +
      '</div>' +
      '<div class="kair-rad-sticky-footer__actions">' +
        '<button class="kair-rad-header__action kair-rad-header__action--ghost" data-footer="cancel"><i class="bi bi-x-lg"></i> Cancelar</button>' +
        '<button class="kair-rad-header__action kair-rad-header__action--secondary" data-footer="save"><i class="bi bi-file-earmark"></i> Guardar borrador</button>' +
        '<button class="kair-rad-header__action kair-rad-header__action--primary" data-footer="save-close"><i class="bi bi-check-circle"></i> Guardar y cerrar acta</button>' +
      '</div>';

    /* Bind handlers */
    setTimeout(function() {
      var btnCancel = footer.querySelector('[data-footer="cancel"]');
      var btnSave = footer.querySelector('[data-footer="save"]');
      var btnSaveClose = footer.querySelector('[data-footer="save-close"]');

      if (btnCancel) {
        btnCancel.addEventListener('click', function() {
          if (typeof ctx.navigate === 'function') ctx.navigate('actas');
        });
      }
      if (btnSave) {
        btnSave.addEventListener('click', function() {
          _handleSave(ctx, false, btnSave);
        });
      }
      if (btnSaveClose) {
        btnSaveClose.addEventListener('click', function() {
          _handleSave(ctx, true, btnSaveClose);
        });
      }
    }, 0);

    return footer;
  }

  /**
   * Maneja el guardado del acta (botón "Guardar borrador" o "Guardar y cerrar").
   * @param {Object} ctx - Contexto
   * @param {boolean} cerrar - Si true, marca el acta como "Cerrada"
   * @param {HTMLElement} btn - Botón (para deshabilitar mientras procesa)
   */
  function _handleSave(ctx, cerrar, btn) {
    if (btn.disabled) return;
    btn.disabled = true;

    try {
      var wrap = btn.closest('.kair-rad-view-actas-editor');
      if (!wrap) {
        if (typeof ctx.toast === 'function') ctx.toast('Error', 'No se pudo acceder al formulario', 'error');
        btn.disabled = false;
        return;
      }

      var editorState = wrap._editorState;
      var acta = wrap._acta;
      var esNuevo = wrap._esNuevo;

      var data = _collectFormData(wrap, editorState, acta, esNuevo, cerrar);

      /* Validación mínima */
      var errores = _validate(data);
      if (errores.length > 0) {
        if (typeof ctx.toast === 'function') {
          ctx.toast('Datos incompletos', errores[0], 'warning');
        }
        btn.disabled = false;
        return;
      }

      if (typeof ctx.guardarActa !== 'function') {
        if (typeof ctx.toast === 'function') {
          ctx.toast('Función no disponible', 'No se puede guardar el acta en este momento', 'error');
        }
        btn.disabled = false;
        return;
      }

      ctx.guardarActa(data, esNuevo).then(function(result) {
        if (result && result.success) {
          ctx.state.editorActa = null;
          if (typeof ctx.navigate === 'function') {
            ctx.navigate('actas');
          }
        }
      }).catch(function(e) {
        if (typeof ctx.toast === 'function') {
          ctx.toast('Error al guardar', e && e.message ? e.message : 'Intente de nuevo', 'error');
        }
      }).then(function() {
        btn.disabled = false;
      });
    } catch (e) {
      if (typeof ctx.toast === 'function') {
        ctx.toast('Error', e && e.message ? e.message : 'Error inesperado', 'error');
      }
      btn.disabled = false;
    }
  }
```

### Step 5: Agregar `_renderSeccion` con dispatch por key + secciones individuales

Dentro del IIFE, después de `_handleSave`:

```javascript
  /**
   * Render de la tarjeta de la sección activa.
   * Despacha a renderizadores específicos según la sección.
   */
  function _renderSeccion(seccion, editorState, acta, ctx) {
    var card = document.createElement('div');
    card.className = 'kair-rad-section-card';

    /* Header común a todas las secciones */
    var head = document.createElement('div');
    head.className = 'kair-rad-section-card__head';
    head.innerHTML =
      '<div class="kair-rad-section-card__num"><i class="bi bi-card-text" style="font-size:1rem"></i></div>' +
      '<div class="kair-rad-section-card__title-wrap">' +
        '<h2 class="kair-rad-section-card__title">' + _esc(seccion.title) + '</h2>' +
        '<p class="kair-rad-section-card__hint">' + _esc(seccion.desc) + '</p>' +
      '</div>' +
      '<span class="kair-rad-section-card__status kair-rad-section-card__status--pending">' +
        '<span class="dot"></span>Pendiente' +
      '</span>';
    card.appendChild(head);

    /* Body de la sección */
    var body = document.createElement('div');
    body.style.marginTop = 'var(--rad-s4)';

    if (seccion.key === 'generalidades') {
      body.appendChild(_renderGeneralidadesBody(editorState, ctx));
    } else if (seccion.key === 'participantes') {
      body.appendChild(_renderParticipantesBody(editorState, ctx));
    } else if (seccion.key === 'ordenDelDia') {
      body.appendChild(_renderOrdenDelDiaBody(editorState, ctx));
    } else if (seccion.key === 'desarrollo') {
      body.appendChild(_renderDesarrolloBody(editorState, ctx));
    }

    card.appendChild(body);

    /* Footer de sección: marcar completada + navegación */
    var idx = SECCIONES.findIndex(function(s) { return s.key === seccion.key; });
    var prevS = idx > 0 ? SECCIONES[idx - 1] : null;
    var nextS = idx < SECCIONES.length - 1 ? SECCIONES[idx + 1] : null;
    var isComplete = !!editorState.completed[seccion.key];

    var footer = document.createElement('div');
    footer.className = 'kair-rad-section-footer';
    footer.innerHTML =
      '<span class="kair-rad-section-footer__hint">' +
        (isComplete ? 'Sección completa. Puedes continuar.' : 'Completa los datos antes de marcar como completada.') +
      '</span>' +
      '<div style="display:flex; gap:var(--rad-s2)">' +
        (prevS ? '<button class="kair-rad-header__action kair-rad-header__action--ghost" data-section-nav="prev"><i class="bi bi-chevron-left"></i> ' + _esc(prevS.title) + '</button>' : '<span></span>') +
        '<button class="kair-rad-header__action kair-rad-header__action--success" data-section-action="complete">' +
          '<i class="bi bi-check-circle"></i> ' + (isComplete ? 'Completada' : 'Marcar completada') +
        '</button>' +
        (nextS ? '<button class="kair-rad-header__action kair-rad-header__action--primary" data-section-nav="next">' + _esc(nextS.title) + ' <i class="bi bi-chevron-right"></i></button>' : '') +
      '</div>';
    card.appendChild(footer);

    /* Bind footer buttons */
    setTimeout(function() {
      var btnPrev = card.querySelector('[data-section-nav="prev"]');
      var btnNext = card.querySelector('[data-section-nav="next"]');
      var btnComplete = card.querySelector('[data-section-action="complete"]');

      if (btnPrev) {
        btnPrev.addEventListener('click', function() {
          editorState.activeKey = prevS.key;
          ctx.state.editorActa = editorState;
          ctx.refresh();
        });
      }
      if (btnNext) {
        btnNext.addEventListener('click', function() {
          editorState.activeKey = nextS.key;
          ctx.state.editorActa = editorState;
          ctx.refresh();
        });
      }
      if (btnComplete) {
        btnComplete.addEventListener('click', function() {
          editorState.completed[seccion.key] = !editorState.completed[seccion.key];
          if (editorState.completed[seccion.key] && nextS) {
            editorState.activeKey = nextS.key;
          }
          ctx.state.editorActa = editorState;
          ctx.refresh();
          if (typeof ctx.toast === 'function' && editorState.completed[seccion.key]) {
            ctx.toast('Sección completada', seccion.title, 'success');
          }
        });
      }
    }, 0);

    return card;
  }

  /**
   * Render del body de Generalidades (cabecera del acta).
   */
  function _renderGeneralidadesBody(editorState, ctx) {
    var wrap = document.createElement('div');
    var fd = editorState.formData;

    var row1 = document.createElement('div');
    row1.className = 'kair-rad-form-row';
    row1.innerHTML =
      _field('fecha', 'Fecha', fd.fecha, 'date', true) +
      _field('tema', 'Tema de la reunión', fd.tema, 'text', true) +
      _select('estado', 'Estado', fd.estado, [
        { value: 'Abierta', label: 'Abierta' },
        { value: 'Cerrada', label: 'Cerrada' }
      ], true);
    wrap.appendChild(row1);

    var row2 = document.createElement('div');
    row2.className = 'kair-rad-form-row';
    row2.innerHTML =
      _field('preside', 'Preside', fd.preside, 'text', true) +
      _field('ciudad', 'Lugar / Ciudad', fd.ciudad, 'text', false);
    wrap.appendChild(row2);

    var row3 = document.createElement('div');
    row3.className = 'kair-rad-form-row';
    row3.innerHTML =
      _field('horaInicio', 'Hora inicio', fd.horaInicio, 'time', false) +
      _field('horaFin', 'Hora fin', fd.horaFin, 'time', false);
    wrap.appendChild(row3);

    /* Poblar formData con valores actuales */
    wrap.querySelectorAll('[data-field]').forEach(function(inp) {
      var key = inp.getAttribute('data-field');
      if (key && editorState.formData[key] === undefined) {
        editorState.formData[key] = inp.value;
      }
    });

    return wrap;
  }

  /**
   * Render del body de Participantes (lista editable).
   */
  function _renderParticipantesBody(editorState, ctx) {
    var wrap = document.createElement('div');

    var helpText = document.createElement('p');
    helpText.style.cssText = 'font:var(--rad-caption); color:var(--rad-text-muted); margin:0 0 var(--rad-s3) 0';
    helpText.textContent = 'Agregue los asistentes a la reunión. Al menos uno es obligatorio.';
    wrap.appendChild(helpText);

    var lista = document.createElement('div');
    lista.id = 'kair-rad-acta-participantes-list';

    editorState.participantes.forEach(function(p, idx) {
      lista.appendChild(_renderParticipanteRow(p, idx, editorState));
    });

    wrap.appendChild(lista);

    var btnAdd = document.createElement('button');
    btnAdd.className = 'kair-rad-header__action kair-rad-header__action--secondary';
    btnAdd.style.marginTop = 'var(--rad-s3)';
    btnAdd.innerHTML = '<i class="bi bi-plus-circle"></i> Agregar participante';
    btnAdd.addEventListener('click', function() {
      editorState.participantes.push({
        nombre: '', cargo: '', empresa: '', correo: '', telefono: '', presente: true
      });
      ctx.state.editorActa = editorState;
      ctx.refresh();
    });
    wrap.appendChild(btnAdd);

    return wrap;
  }

  /**
   * Render de una fila de participante (con botón eliminar).
   */
  function _renderParticipanteRow(participante, idx, editorState) {
    var row = document.createElement('div');
    row.className = 'kair-rad-form-row';
    row.style.alignItems = 'flex-end';
    row.innerHTML =
      _field('part-nombre-' + idx, 'Nombre', participante.nombre, 'text', false) +
      _field('part-cargo-' + idx, 'Cargo', participante.cargo, 'text', false) +
      _field('part-empresa-' + idx, 'Empresa', participante.empresa, 'text', false) +
      '<div class="kair-rad-field" style="flex:0">' +
        '<label>&nbsp;</label>' +
        '<button class="kair-rad-header__action kair-rad-header__action--ghost" data-part-remove="' + idx + '" title="Eliminar">' +
          '<i class="bi bi-trash"></i>' +
        '</button>' +
      '</div>';

    /* Bind input changes → editorState.participantes[idx] */
    row.querySelectorAll('[data-field]').forEach(function(inp) {
      var key = inp.getAttribute('data-field');
      var match = key.match(/^part-(\w+)-(\d+)$/);
      if (match) {
        var field = match[1];
        var index = parseInt(match[2], 10);
        if (index === idx) {
          inp.addEventListener('input', function() {
            if (!editorState.participantes[index]) return;
            editorState.participantes[index][field] = inp.value;
          });
        }
      }
    });

    /* Bind remove button */
    setTimeout(function() {
      var btn = row.querySelector('[data-part-remove="' + idx + '"]');
      if (btn) {
        btn.addEventListener('click', function() {
          editorState.participantes.splice(idx, 1);
          /* Trigger refresh via evento custom para que ctx.refresh se llame */
          var ev = new CustomEvent('acta-editor-refresh');
          row.dispatchEvent(ev);
        });
      }
    }, 0);

    return row;
  }

  /**
   * Render del body de Orden del día (textarea con líneas numeradas).
   */
  function _renderOrdenDelDiaBody(editorState, ctx) {
    var wrap = document.createElement('div');
    wrap.innerHTML =
      _textarea('ordenDia', 'Orden del día',
        editorState.formData.ordenDia,
        '1. Lectura del acta anterior\n2. Revisión de compromisos\n3. Proposiciones y varios',
        false);

    wrap.querySelectorAll('[data-field]').forEach(function(inp) {
      var key = inp.getAttribute('data-field');
      if (key && editorState.formData[key] === undefined) {
        editorState.formData[key] = inp.value;
      }
    });

    return wrap;
  }

  /**
   * Render del body de Desarrollo (tabla editable de compromisos).
   */
  function _renderDesarrolloBody(editorState, ctx) {
    var wrap = document.createElement('div');

    var helpText = document.createElement('p');
    helpText.style.cssText = 'font:var(--rad-caption); color:var(--rad-text-muted); margin:0 0 var(--rad-s3) 0';
    helpText.textContent = 'Registre los temas tratados, los compromisos adquiridos, responsables y fechas límite.';
    wrap.appendChild(helpText);

    var table = document.createElement('table');
    table.className = 'kair-rad-table';
    table.style.marginTop = 'var(--rad-s3)';
    table.innerHTML =
      '<thead><tr>' +
        '<th style="width:40px">N°</th>' +
        '<th>Tema tratado</th>' +
        '<th>Compromiso</th>' +
        '<th>Responsable</th>' +
        '<th style="width:140px">Fecha límite</th>' +
        '<th style="width:140px">Estado</th>' +
        '<th style="width:50px"></th>' +
      '</tr></thead><tbody id="kair-rad-acta-desarrollo-tbody">';

    var tbody = table.querySelector('tbody');

    editorState.desarrollo.forEach(function(c, idx) {
      tbody.appendChild(_renderDesarrolloRow(c, idx, editorState));
    });

    wrap.appendChild(table);

    var btnAdd = document.createElement('button');
    btnAdd.className = 'kair-rad-header__action kair-rad-header__action--secondary';
    btnAdd.style.marginTop = 'var(--rad-s3)';
    btnAdd.innerHTML = '<i class="bi bi-plus-circle"></i> Agregar compromiso';
    btnAdd.addEventListener('click', function() {
      editorState.desarrollo.push({
        numero: editorState.desarrollo.length + 1,
        temaTratado: '',
        compromiso: '',
        responsable: '',
        fecha: '',
        verificacion: '',
        estado: 'Pendiente'
      });
      ctx.state.editorActa = editorState;
      ctx.refresh();
    });
    wrap.appendChild(btnAdd);

    return wrap;
  }

  /**
   * Render de una fila de desarrollo (compromiso editable).
   */
  function _renderDesarrolloRow(compromiso, idx, editorState) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="cell-mono">' + (idx + 1) + '</td>' +
      '<td><input type="text" value="' + _esc(compromiso.temaTratado) + '" data-dev-field="temaTratado" data-dev-idx="' + idx + '" placeholder="Tema tratado"></td>' +
      '<td><input type="text" value="' + _esc(compromiso.compromiso) + '" data-dev-field="compromiso" data-dev-idx="' + idx + '" placeholder="Compromiso"></td>' +
      '<td><input type="text" value="' + _esc(compromiso.responsable) + '" data-dev-field="responsable" data-dev-idx="' + idx + '" placeholder="Responsable"></td>' +
      '<td><input type="date" value="' + _esc(compromiso.fecha) + '" data-dev-field="fecha" data-dev-idx="' + idx + '"></td>' +
      '<td><select data-dev-field="estado" data-dev-idx="' + idx + '">' +
        ESTADOS_COMPROMISO.map(function(e) {
          var sel = (e === compromiso.estado) ? ' selected' : '';
          return '<option value="' + e + '"' + sel + '>' + e + '</option>';
        }).join('') +
      '</select></td>' +
      '<td class="cell-actions"><button class="kair-rad-header__action kair-rad-header__action--ghost" data-dev-remove="' + idx + '" title="Eliminar"><i class="bi bi-trash"></i></button></td>';

    /* Bind input changes */
    tr.querySelectorAll('[data-dev-field]').forEach(function(inp) {
      var field = inp.getAttribute('data-dev-field');
      var index = parseInt(inp.getAttribute('data-dev-idx'), 10);
      inp.addEventListener('input', function() {
        if (!editorState.desarrollo[index]) return;
        editorState.desarrollo[index][field] = inp.value;
      });
      inp.addEventListener('change', function() {
        if (!editorState.desarrollo[index]) return;
        editorState.desarrollo[index][field] = inp.value;
      });
    });

    /* Bind remove */
    setTimeout(function() {
      var btn = tr.querySelector('[data-dev-remove="' + idx + '"]');
      if (btn) {
        btn.addEventListener('click', function() {
          editorState.desarrollo.splice(idx, 1);
          editorState.desarrollo.forEach(function(c, i) { c.numero = i + 1; });
          var ev = new CustomEvent('acta-editor-refresh');
          tr.dispatchEvent(ev);
        });
      }
    }, 0);

    return tr;
  }
```

### Step 6: Agregar `_collectFormData` + `_validate`

Dentro del IIFE, después de `_renderDesarrolloRow`:

```javascript
  /**
   * Recopila los datos del formulario del editor y los une con editorState.
   * @param {HTMLElement} wrap - Contenedor del editor
   * @param {Object} editorState - Estado actual del editor
   * @param {Object} acta - Acta original (para preservar id/numero si edita)
   * @param {boolean} esNuevo - Si es nueva acta
   * @param {boolean} cerrar - Si true, marca estado como Cerrada
   * @returns {Object} Payload listo para enviar al backend
   */
  function _collectFormData(wrap, editorState, acta, esNuevo, cerrar) {
    /* Si el wrap existe en DOM, leer valores actuales del form de generalidades */
    if (wrap) {
      wrap.querySelectorAll('[data-field]').forEach(function(inp) {
        var key = inp.getAttribute('data-field');
        if (!key) return;
        editorState.formData[key] = inp.value;
      });
    }

    var fd = editorState.formData;

    return {
      id: acta.id || null,
      empresaId: acta.empresaId || null,
      numero: acta.numero || null,
      fecha: fd.fecha || '',
      estado: cerrar ? 'Cerrada' : (fd.estado || 'Abierta'),
      archivo: acta.archivo || '',
      metadata: {
        tema: fd.tema || '',
        preside: fd.preside || '',
        ciudad: fd.ciudad || '',
        horaInicio: fd.horaInicio || '',
        horaFin: fd.horaFin || '',
        participantes: (editorState.participantes || []).filter(function(p) {
          return p.nombre && p.nombre.trim();
        }).map(function(p) {
          return {
            nombre: p.nombre.trim(),
            cargo: p.cargo || '',
            empresa: p.empresa || '',
            correo: p.correo || '',
            telefono: p.telefono || '',
            presente: p.presente !== false
          };
        }),
        ordenDia: fd.ordenDia || '',
        desarrollo: (editorState.desarrollo || []).map(function(c, i) {
          return {
            numero: i + 1,
            temaTratado: c.temaTratado || '',
            compromiso: c.compromiso || '',
            responsable: c.responsable || '',
            fecha: c.fecha || '',
            verificacion: c.verificacion || '',
            estado: c.estado || 'Pendiente'
          };
        })
      }
    };
  }

  /**
   * Valida el payload antes de enviar.
   * @param {Object} data - Payload a validar
   * @returns {Array<string>} Lista de errores (vacía si OK)
   */
  function _validate(data) {
    var errores = [];
    if (!data.fecha) errores.push('La fecha es obligatoria');
    if (!data.metadata.preside || !data.metadata.preside.trim()) errores.push('El campo "Preside" es obligatorio');
    if (!data.metadata.participantes || data.metadata.participantes.length === 0) {
      errores.push('Debe registrar al menos un participante');
    }
    return errores;
  }
```

### Step 7: Bind refresh para participantes/desarrollo (custom event)

En `_render`, después del `wrap.addEventListener('input', ...)`, agregar listener para refresh desde botones remove:

```javascript
    /* Refresh desde botones remove de participantes/desarrollo */
    wrap.addEventListener('acta-editor-refresh', function() {
      ctx.state.editorActa = editorState;
      ctx.refresh();
    });
```

### Step 8: Verificar estructura final del archivo

El archivo debe terminar con:

```javascript
  return {
    render: function(ctx) { return _render(ctx); },
    SECCIONES: SECCIONES,
    ESTADOS_COMPROMISO: ESTADOS_COMPROMISO
  };

})();

window.ActasEditorView = ActasEditorView;
```

Verificar que NO hay errores de sintaxis corriendo:

```bash
node -c sgsst-electron-app/modules/verificacion/revision-alta-direccion/vistas/actas-editor.js
```

⚠️ **NOTA:** `node -c` puede fallar por el `var X = (function() { ... })(); window.X = X;` (es sintaxis válida para navegador, pero node espera módulos). Si falla, usar:

```bash
node --check sgsst-electron-app/modules/verificacion/revision-alta-direccion/vistas/actas-editor.js
```

Expected: exit code 0 (sintaxis OK).

### Step 9: Commit

```bash
git add sgsst-electron-app/modules/verificacion/revision-alta-direccion/vistas/actas-editor.js
git commit -m "feat(actas): editor de actas G-FO-009 con secciones y sticky footer"
```

---

## Task 3: Routing en `revision-alta-direccion-component.js`

**Files:**
- Modify: `sgsst-electron-app/modules/verificacion/revision-alta-direccion/revision-alta-direccion-component.js`

**Cambios necesarios:**
1. Línea 171: agregar `'actas-editor'` al enum `currentView`
2. Línea 757: agregar `case 'actas-editor':` en el switch
3. Línea 757-758: agregar `_renderActasEditorView()` (después de `_renderActasReunionView`)
4. Líneas 935-946: agregar `'actas-editor'` al mapa de `_getBackLabel`
5. Líneas 924-932: `_getBackTarget` ya devuelve `'hub'` por default (no requiere cambio)
6. Líneas 949-965: agregar `'actas-editor'` al mapa de `_getHeaderTitleForView`
7. Líneas 967-979: agregar `'actas-editor'` al mapa de `_getHeaderSubtitleForView`
8. Líneas 906-918: agregar bloque `else if (state.currentView === 'actas-editor')` para mostrar CTAs de header
9. Después de `guardarRevision` (~línea 476): agregar función `guardarActa(data, esNuevo)`
10. Línea 1400-1407: agregar `actaActiva` y `actaActivaId` al `data` del ctx (no obligatorio, ctx.data.actas ya viene)
11. Línea 1399-1420: agregar `guardarActa: guardarActa` al `_buildViewCtx()`

### Step 1: Actualizar el enum `currentView` (línea 171)

Reemplazar la línea 171:

```javascript
    currentView: 'hub',         // hub | revisiones | revisiones-list | revisiones-editor | revisiones-viewer | actas | actas-editor | despliegue | procedimiento | registro
```

### Step 2: Agregar caso en el switch (después de línea 757)

Reemplazar:

```javascript
        case 'actas':           viewHost.appendChild(_renderActasReunionView()); break;
```

Por:

```javascript
        case 'actas':           viewHost.appendChild(_renderActasReunionView()); break;
        case 'actas-editor':    viewHost.appendChild(_renderActasEditorView()); break;
```

### Step 3: Agregar función `_renderActasEditorView()` (después de línea 1448)

Después de `_renderActasReunionView`, agregar:

```javascript
  function _renderActasEditorView() {
    if (!window.ActasEditorView) {
      return _renderErrorView('Vista de editor de actas no disponible. Recargue la página.');
    }
    return window.ActasEditorView.render(_buildViewCtx());
  }
```

### Step 4: Agregar `'actas-editor'` al mapa `_getBackLabel` (línea ~935)

Reemplazar el mapa `_getBackLabel`:

```javascript
  function _getBackLabel(view) {
    var map = {
      'hub':               'Volver al módulo Verificación',
      'revisiones':        'Volver al hub del submódulo',
      'revisiones-list':   'Volver al hub del submódulo',
      'revisiones-editor': 'Volver al listado',
      'revisiones-viewer': 'Volver al listado',
      'actas':             'Volver al hub del submódulo',
      'actas-editor':      'Volver al listado de actas',
      'despliegue':        'Volver al hub del submódulo',
      'procedimiento':     'Volver al hub del submódulo',
      'registro':          'Volver al hub del submódulo'
    };
    return map[view] || 'Volver';
  }
```

⚠️ **IMPORTANTE:** Para que el botón "Volver" desde el editor lleve al listado de actas (no al hub), hay que ajustar `_getBackTarget` para que `'actas-editor'` devuelva `'actas'`.

Reemplazar la función `_getBackTarget` (líneas 924-932):

```javascript
  function _getBackTarget(view) {
    /* Lógica de navegación "Volver":
       - view === 'hub' → null (lo maneja el botón con backToModuleCallback)
       - view === 'actas-editor' → 'actas' (volver al listado de actas)
       - otros → 'hub' (pantalla principal del submódulo) */
    if (view === 'hub') return null;
    if (view === 'actas-editor') return 'actas';
    return 'hub';
  }
```

### Step 5: Agregar `'actas-editor'` a `_getHeaderTitleForView` (línea ~949)

Reemplazar el mapa `_getHeaderTitleForView`:

```javascript
  function _getHeaderTitleForView(view) {
    var map = {
      revisiones:           'Revisiones Gerenciales',
      'revisiones-list':    'Revisiones Gerenciales',
      'revisiones-editor':  state.viewParams && state.viewParams.id
        ? 'Revisión Gerencial ' + state.viewParams.id
        : 'Editor de Revisión',
      'revisiones-viewer':  state.viewParams && state.viewParams.id
        ? 'Acta ' + state.viewParams.id
        : 'Acta de Revisión Gerencial',
      actas:         'Actas de Reunión Gerencial',
      'actas-editor': state.viewParams && state.viewParams.id
        ? 'Editar Acta ' + state.viewParams.id
        : 'Nueva Acta de Reunión',
      despliegue:    'Despliegue Estratégico',
      procedimiento: 'Procedimiento G-PR-001',
      registro:      'Registro Documental'
    };
    return map[view] || MODULO.NOMBRE;
  }
```

### Step 6: Agregar `'actas-editor'` a `_getHeaderSubtitleForView` (línea ~967)

Reemplazar el mapa `_getHeaderSubtitleForView`:

```javascript
  function _getHeaderSubtitleForView(view) {
    var map = {
      revisiones:           'Ciclo anual del acta G-FO-006 con 12 secciones canónicas',
      'revisiones-list':    'Ciclo anual del acta G-FO-006 con 12 secciones canónicas',
      'revisiones-editor':  'Editor del acta conforme al formato G-FO-006 Rev. 03',
      'revisiones-viewer':  'Acta imprimible conforme a G-FO-006 Rev. 03',
      actas:         'Reuniones de seguimiento G-FO-009 con agenda y compromisos',
      'actas-editor': 'Editor del acta conforme al formato G-FO-009',
      despliegue:    'Objetivos estratégicos e indicadores G-FO-001',
      procedimiento: 'Documento normativo de referencia',
      registro:      'Correspondencia interna/externa GG-FO-005'
    };
    return map[view] || 'Gestión integral de revisiones gerenciales del SG-SST';
  }
```

### Step 7: Agregar CTAs de header para `'actas-editor'` (líneas 906-918)

Reemplazar el bloque `else if (state.currentView === 'despliegue' || ...) { ... }`:

```javascript
    } else if (state.currentView === 'actas-editor') {
      /* En el editor de actas, mostramos "Guardar" + "Volver al listado" en el header.
         Los botones específicos (Guardar borrador / Guardar y cerrar / Cancelar)
         viven en el sticky footer del editor. */
      var ctaBackEditor = document.createElement('button');
      ctaBackEditor.className = 'k-btn k-btn-ghost k-btn-sm';
      ctaBackEditor.id = 'kair-rad-cta-back-editor';
      ctaBackEditor.innerHTML = '<i class="bi bi-arrow-left"></i> Volver al listado';
      right.appendChild(ctaBackEditor);
    } else if (state.currentView === 'despliegue' || state.currentView === 'registro' || state.currentView === 'actas') {
```

### Step 8: Bind del nuevo CTA en `bindGlobalActions` (después de línea 1611)

Después del bloque del `kair-rad-cta-open-doc` (línea 1611), agregar:

```javascript
    /* CTA "Volver al listado" del editor de actas */
    var ctaBackEditor = document.getElementById('kair-rad-cta-back-editor');
    if (ctaBackEditor) {
      ctaBackEditor.addEventListener('click', function() {
        navigate('actas');
      });
    }
```

### Step 9: Agregar función `guardarActa(data, esNuevo)` (después de `guardarRevision`, ~línea 476)

Después del cierre de `guardarRevision` (línea 476), agregar:

```javascript
  /**
   * Crea o actualiza un acta de reunión (G-FO-009).
   * Conecta con IPC `revisionAltaDireccion.guardarActa` vía service.
   * @param {Object} data - Datos del acta (id opcional, fecha, estado, metadata)
   * @param {boolean} [esNuevo] - Si true, fuerza crear nueva; si false, actualiza
   * @returns {Promise<Object|null>} - {success, acta} o null en error
   */
  async function guardarActa(data, esNuevo) {
    console.log('[K+AIRSST][6.1.3][SAVE_ACTA] guardarActa() data.id=' + (data && data.id) + ' esNuevo=' + !!esNuevo);

    if (!data || typeof data !== 'object') {
      toast('Datos inválidos', 'No se puede guardar el acta', 'error');
      log('SAVE_ACTA', 'ERROR', 'data inválido');
      return null;
    }

    /* Inserta o reemplaza en state.actas (top) */
    function _upsertActa(a) {
      if (!Array.isArray(state.actas)) state.actas = [];
      state.actas = state.actas.filter(function(x) { return x.id !== a.id; });
      state.actas.unshift(a);
    }

    var empresaId = state.empresaActiva || state.empresaId || '';
    var resp = null;
    var isMock = false;

    try {
      if (window.RevisionAltaDireccionService && window.RevisionAltaDireccionService.guardarActa) {
        resp = await window.RevisionAltaDireccionService.guardarActa(empresaId, data);
      }

      if (resp && resp.success && resp.data) {
        /* El bridge devuelve {id, numero}. Combinar con data para tener el shape completo */
        var actaCompleta = Object.assign({}, data, {
          id: resp.data.id || data.id,
          numero: resp.data.numero || data.numero
        });
        _upsertActa(actaCompleta);
        toast(esNuevo ? 'Acta creada' : 'Acta actualizada', actaCompleta.id, 'success');
        log('SAVE_ACTA', 'SUCCESS', actaCompleta.id);
        return { success: true, acta: actaCompleta };
      } else if (resp && resp.error) {
        toast('Error al guardar', resp.error.message || 'No se pudo guardar el acta', 'error');
        log('SAVE_ACTA', 'ERROR', resp.error.message);
        return null;
      } else {
        /* Fallback mock · generar id determinístico */
        isMock = true;
        var year = new Date().getFullYear();
        var maxNum = (state.actas || []).reduce(function(m, a) {
          var n = parseInt(String(a.numero || 0), 10);
          return isNaN(n) ? m : Math.max(m, n);
        }, 0);
        var actaMock = Object.assign({}, data, {
          id: data.id || ('ACT-' + year + '-' + String(maxNum + 1).padStart(3, '0')),
          numero: data.numero || (maxNum + 1),
          creado_en: new Date().toISOString(),
          actualizado_en: new Date().toISOString()
        });
        _upsertActa(actaMock);
        toast('Acta guardada (demo)', actaMock.id, 'success');
        log('SAVE_ACTA', 'INFO', actaMock.id + ' (mock)');
        return { success: true, acta: actaMock };
      }
    } catch (e) {
      toast('Error al guardar', e && e.message ? e.message : 'Error inesperado', 'error');
      log('SAVE_ACTA', 'ERROR', e && e.message ? e.message : String(e));
      return null;
    }
  }
```

### Step 10: Exponer `guardarActa` en `_buildViewCtx` (línea ~1414)

En la función `_buildViewCtx`, agregar `guardarActa: guardarActa` al objeto retornado. Reemplazar:

```javascript
  function _buildViewCtx() {
    return {
      data: {
        revisiones: state.revisiones,
        cicloActivo: state.cicloActivo,
        empresaActiva: state.empresaActiva,
        actas: state.actas,
        indicadores: state.indicadores,
        documentos: state.documentos
      },
      params: state.viewParams,
      state: state,
      navigate: navigate,
      toast: toast,
      confirm: _showConfirmDialog,
      eliminarRevision: eliminarRevision,
      guardarRevision: guardarRevision,
      guardarActa: guardarActa,
      refresh: function() {
        /* Forzar re-render preservando la vista activa */
        renderAll();
      }
    };
  }
```

### Step 11: Verificar

Sintaxis (como en Task 2 step 8):

```bash
node --check sgsst-electron-app/modules/verificacion/revision-alta-direccion/revision-alta-direccion-component.js
```

Expected: exit code 0.

### Step 12: Commit

```bash
git add sgsst-electron-app/modules/verificacion/revision-alta-direccion/revision-alta-direccion-component.js
git commit -m "feat(actas): routing + guardarActa() para editor G-FO-009"
```

---

## Task 4: Registrar `actas-editor.js` en `index.html`

**Files:**
- Modify: `sgsst-electron-app/index.html:173`

### Step 1: Agregar el `<script>` antes de `actas-reunion.js`

Reemplazar la línea 173:

```html
  <script src="modules/verificacion/revision-alta-direccion/vistas/actas-reunion.js"></script>
```

Por:

```html
  <script src="modules/verificacion/revision-alta-direccion/vistas/actas-editor.js"></script>
  <script src="modules/verificacion/revision-alta-direccion/vistas/actas-reunion.js"></script>
```

⚠️ **IMPORTANTE:** El orden importa: `actas-editor.js` debe cargarse ANTES de `actas-reunion.js` (porque el componente verifica `window.ActasEditorView` cuando navega al editor).

### Step 2: Commit

```bash
git add sgsst-electron-app/index.html
git commit -m "feat(actas): cargar actas-editor.js en index.html"
```

---

## Plan de prueba end-to-end (tras Task 4)

### Paso 1: Verificar auto-import XLSX (opcional)

Si existe el archivo `GG-FO-009 ACTA DE REUNION GERENCIAL.xlsx` (2017) en la carpeta de la empresa y NO existe `G-FO-009.json`:

1. Eliminar (o renombrar) `G-FO-009.json` si existe.
2. Reiniciar la app.
3. Verificar en logs: `[K+AIRSST][6.1.3][AUTO_IMPORT] GG-FO-009: 1 actas importadas`.
4. Si el parser falla (XLSX con layout distinto), ajustar `_parserGFO009` en `revision-alta-direccion-bridge.js`.

### Paso 2: Verificar vista con datos importados

1. Reiniciar app → Verificación → 6.1.3 → "Actas de Reunión Gerencial".
2. Esperado: lista master con el acta importada del XLSX 2017.
3. Click en el item → detalle muestra campos: fecha, hora (rango), lugar, responsable, tema, participantes, orden del día, tabla de compromisos.

### Paso 3: Verificar empty state

Si NO hay actas en DB:

1. Ir a la vista → empty state con "Sin actas registradas" + botón "Crear primera acta".
2. Click → navega al editor (`actas-editor`).

### Paso 4: Crear acta nueva

1. Click "Crear primera acta" (o "Nueva acta" del header).
2. Navega al editor con `esNuevo=true`.
3. Sección Generalidades: completar fecha (obligatoria), tema, preside, lugar, horas.
4. Sección Participantes: click "Agregar participante" → llenar nombre (obligatorio), cargo, empresa.
5. Sección Orden del día: escribir texto (opcional).
6. Sección Desarrollo: click "Agregar compromiso" → llenar tema, responsable, fecha, estado.
7. Sticky footer → click "Guardar y cerrar acta".
8. Esperado: toast "Acta creada" / "Acta guardada (demo)" + navega a vista de actas.
9. La nueva acta aparece en la lista master.

### Paso 5: Editar acta existente

1. Click en un acta de la lista → click "Editar acta".
2. Modificar un campo (ej: cambiar tema).
3. Click "Guardar borrador" (sin cerrar).
4. Toast "Acta actualizada" + vuelve a la lista.
5. Verificar que el cambio persiste: el nuevo tema aparece en el detalle.

### Paso 6: Persistencia tras reload

1. Cerrar la app.
2. Abrir de nuevo.
3. Ir a Actas → las actas creadas siguen ahí.

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - DB→view mapping (Task 1, Step 1) ✓
  - Empty state con CTA (Task 1, Step 3) ✓
  - Editor con secciones (Task 2, Step 5) ✓
  - Form data collection (Task 2, Step 6) ✓
  - Validación mínima fecha/preside/participante (Task 2, Step 6) ✓
  - Routing `'actas-editor'` (Task 3, Step 1-3) ✓
  - `guardarActa` con IPC + fallback mock (Task 3, Step 9) ✓
  - Navegación desde/hacia editor (Task 1, Step 4-5 + Task 3, Step 4) ✓
  - Auto-import XLSX (no requiere cambios, ya existe) ✓

- [x] **Placeholder scan:** No hay "TODO" / "TBD" / "implementar después". Cada step entrega código ejecutable.

- [x] **Type consistency:**
  - `ctx.guardarActa(data, esNuevo)` definido en Task 3 Step 9, expuesto en Step 10, usado en Task 2 Step 4 (`_handleSave`) — match.
  - `ctx.state.editorActa` inicializado en Task 2 Step 2, preservado en Task 2 Step 3, limpiado en Task 2 Step 4 (`_handleSave`) — match.
  - `SECCIONES` exportado en Task 2 Step 1 — match.

- [x] **CSS classes:** Todos los estilos usan `.kair-rad-*` preexistentes (`kair-rad-editor`, `kair-rad-section-card`, `kair-rad-form-row`, `kair-rad-field`, `kair-rad-sticky-footer`, `kair-rad-side-card`, `kair-rad-table`). No se requieren nuevas reglas CSS.

- [x] **Sin breaking changes:** `RevisionEditorView`, `RevisionesListView`, etc., no se tocan. La variable `currentView` solo se AGREGA al enum (no se elimina ningún valor).

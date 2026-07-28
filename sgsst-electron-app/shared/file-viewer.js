/* =============================================================================
   📦608 — Helper global para abrir archivos Office/PDF/etc con @file-viewer.
   Se carga desde el index.html raíz y desde Bandeja Integrada.

   Crea un modal overlay (full-screen) en el document actual y monta dentro
   un <flyfish-file-viewer> con el archivo elegido.

   API expuesta en window.kairFV:
     - openWithFileViewerFromPath(filePath)  → usa IPC read-file-bytes
     - openFileViewerFromFile(file)           → usa File API (input file)
     - closeFileViewer()                      → cierra el modal y libera memoria

   Formatos soportados: 208 extensiones (Office, PDF, imágenes, video, audio,
   EML, ZIP, CAD, 3D, Markdown, Mermaid, draw.io, XMind, etc.). Ver
   https://doc.file-viewer.app/guide/formats
   ============================================================================= */
(function () {
  'use strict';

  if (window.kairFV) {
    // Ya inicializado — no duplicar
    return;
  }

  var _currentUrl = null;       // Blob URL actual (para revocar al cerrar)
  var _overlayId = 'kair-fv-overlay';
  var _bodyId    = 'kair-fv-body';
  var _titleId   = 'kair-fv-title';
  var _sizeId    = 'kair-fv-size';
  var _extBadgeId = 'kair-fv-ext';

  // -----------------------------------------------------------------------------
  // Crear el DOM del modal (idempotente)
  // -----------------------------------------------------------------------------
  function ensureModalDOM() {
    if (document.getElementById(_overlayId)) return;

    // Inyectar CSS básico inline (lo que se necesita para que el modal se vea)
    // — el CSS detallado vive en styles.css de Bandeja; acá solo lo mínimo
    //   para que funcione fuera de Bandeja.
    if (!document.getElementById('kair-fv-styles')) {
      var style = document.createElement('style');
      style.id = 'kair-fv-styles';
      style.textContent = [
        // 📦608-fix14 — Modal SIEMPRE en modo expandido (no hay estado compacto).
        // El user decidió que el estado compacto lateral ya no aplica — el modal
        // abre grande desde el principio, respetando el header via --kair-header-height.
        ':root{--kair-header-height:0px;}',
        '#kair-fv-overlay{position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.45);',
        'box-sizing:border-box;',
        'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;',
        'transition:background 0.15s ease;}',
        '#kair-fv-overlay[hidden]{display:none;}',
        // Modal full-screen respetando el header superior de K+AIR
        '#kair-fv-overlay .kfv-modal{display:grid;',
        'grid-template-rows:auto 1fr;',
        'position:absolute;',
        'top:calc(var(--kair-header-height, 0px) + 12px);',
        'right:24px;bottom:24px;left:24px;',
        'width:auto;max-width:1500px;margin:0 auto;',
        'background:#fff;border-radius:12px;overflow:hidden;',
        'box-shadow:0 16px 40px rgba(0,0,0,.35);}',
        '#kair-fv-overlay .kfv-header{display:flex;align-items:center;justify-content:space-between;',
        'padding:10px 14px;background:#f7f9fb;border-bottom:1px solid #e0e3e7;',
        'min-height:50px;gap:12px;',
        'grid-row:1;}',
        '#kair-fv-overlay .kfv-title{display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 auto;}',
        '#kair-fv-overlay .kfv-ext{display:inline-flex;align-items:center;justify-content:center;',
        'padding:2px 8px;font-size:11px;font-weight:700;color:#fff;background:#1a73e8;',
        'border-radius:5px;flex-shrink:0;text-transform:uppercase;}',
        '#kair-fv-overlay .kfv-ext[data-ext="pdf"]{background:#c62828;}',
        '#kair-fv-overlay .kfv-ext[data-ext="pptx"],#kair-fv-overlay .kfv-ext[data-ext="ppt"]{background:#d84315;}',
        '#kair-fv-overlay .kfv-ext[data-ext="docx"],#kair-fv-overlay .kfv-ext[data-ext="doc"]{background:#1565c0;}',
        '#kair-fv-overlay .kfv-ext[data-ext="xlsx"],#kair-fv-overlay .kfv-ext[data-ext="xls"]{background:#2e7d32;}',
        '#kair-fv-overlay .kfv-name{font-size:14px;font-weight:600;color:#1f2937;',
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}',
        '#kair-fv-overlay .kfv-size{font-size:12px;color:#6b7280;flex-shrink:0;}',
        '#kair-fv-overlay .kfv-actions{display:flex;align-items:center;gap:6px;flex-shrink:0;}',
        '#kair-fv-overlay .kfv-btn{display:inline-flex;align-items:center;gap:5px;',
        'padding:6px 11px;font-size:13px;color:#1f2937;background:transparent;',
        'border:1px solid #d1d5db;border-radius:6px;cursor:pointer;transition:background 0.12s;}',
        '#kair-fv-overlay .kfv-btn:hover{background:#f3f4f6;}',
        '#kair-fv-overlay .kfv-btn--primary{background:#1a73e8;color:#fff;border-color:#1a73e8;}',
        '#kair-fv-overlay .kfv-btn--primary:hover{background:#1557b0;}',
        '#kair-fv-overlay .kfv-body{position:relative;background:#fff;min-height:0;',
        'display:flex;flex-direction:column;grid-row:2;overflow:hidden;}',
        '#kair-fv-overlay .kfv-loading,#kair-fv-overlay .kfv-error{position:absolute;inset:0;',
        'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;',
        'background:rgba(255,255,255,.92);z-index:2;text-align:center;padding:24px;}',
        '#kair-fv-overlay .kfv-error{color:#b91c1c;background:rgba(254,242,242,.96);}',
        '#kair-fv-overlay .kfv-spinner{width:36px;height:36px;',
        'border:3px solid #e5e7eb;border-top-color:#1a73e8;border-radius:50%;',
        'animation:kfv-spin .9s linear infinite;}',
        '@keyframes kfv-spin{to{transform:rotate(360deg);}}',
        '#kair-fv-overlay flyfish-file-viewer{display:block;width:100%;height:100%;min-height:0;',
        'flex:1 1 auto;}'
      ].join('');
      document.head.appendChild(style);

      // Detectar alto del header superior y setear --kair-header-height.
      var headerEl = document.querySelector('#app-header, .kair-header, header[role="banner"]');
      if (headerEl) {
        var h = headerEl.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--kair-header-height', Math.round(h) + 'px');
      }
    }

    var overlay = document.createElement('div');
    overlay.id = _overlayId;
    overlay.setAttribute('hidden', '');
    overlay.innerHTML = [
      '<div class="kfv-modal">',
      '  <div class="kfv-header">',
      '    <div class="kfv-title">',
      '      <span class="kfv-ext" id="', _extBadgeId, '">…</span>',
      '      <span class="kfv-name" id="', _titleId,   '">Sin archivo</span>',
      '      <span class="kfv-size" id="', _sizeId,    '">—</span>',
      '    </div>',
      '    <div class="kfv-actions">',
      '      <button class="kfv-btn" id="kair-fv-close-btn" type="button" title="Cerrar (ESC)">',
      '        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      '        <span>Cerrar</span>',
      '      </button>',
      '    </div>',
      '  </div>',
      '  <div class="kfv-body" id="', _bodyId, '">',
      '    <div class="kfv-loading"><div class="kfv-spinner"></div><p>Inicializando @file-viewer…</p></div>',
      '  </div>',
      '</div>'
    ].join('');

    document.body.appendChild(overlay);

    // Listeners de cierre
    var closeBtn = document.getElementById('kair-fv-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeFileViewer);

    // Click fuera del modal cierra
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeFileViewer();
    });

    // 📦608-fix14 — ESC siempre cierra (ya no hay estado compacto al cual volver)
    if (!window._kairFvKeysBound) {
      window._kairFvKeysBound = true;
      document.addEventListener('keydown', function (e) {
        var ov = document.getElementById(_overlayId);
        if (!ov || ov.hasAttribute('hidden')) return;
        if (e.key === 'Escape') {
          closeFileViewer();
        }
      });
    }
  }

  // -----------------------------------------------------------------------------
  // Helpers de UI
  // -----------------------------------------------------------------------------
  function fmtBytes(n) {
    if (n == null) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }

  function showLoading(text) {
    var body = document.getElementById(_bodyId);
    if (!body) return;
    body.innerHTML = '';
    var d = document.createElement('div');
    d.className = 'kfv-loading';
    d.innerHTML = '<div class="kfv-spinner"></div><p>' + (text || 'Cargando…') + '</p>';
    body.appendChild(d);
  }

  function showError(msg) {
    var body = document.getElementById(_bodyId);
    if (!body) return;
    body.innerHTML = '';
    var d = document.createElement('div');
    d.className = 'kfv-error';
    d.innerHTML = '<p>' + msg + '</p>';
    body.appendChild(d);
  }

  // -----------------------------------------------------------------------------
  // 📦608-fix12 — Inyectar CSS en el shadowRoot del viewer para personalizaciones
  // que la API nativa no soporta:
  //   1) Search colapsable: el input se oculta cuando NO está en uso
  //      (más espacio para los demás botones en ventanas chicas). Se expande
  //      al `:focus-within` o cuando tiene valor.
  //   2) Toolbar flotante centrada: cuando toolbar-position="bottom-right",
  //      la toolbar queda por default pegada a la derecha — el user la quiere
  //      centrada horizontalmente (centrada abajo).
  //
  // El file-viewer usa shadow DOM (styleIsolation: 'shadow' por default), así
  // que CSS externo no entra — hay que inyectar el <style> directamente al
  // shadowRoot. Re-intenta cada 100ms hasta que el shadowRoot esté disponible
  // (el viewer lo crea de forma async al mount).
  // -----------------------------------------------------------------------------
  function _injectViewerCustomCss(viewerEl) {
    if (!viewerEl) return;
    var attempts = 0;
    var maxAttempts = 30; // ~3s
    var tryInject = function () {
      attempts++;
      var sr = viewerEl.shadowRoot;
      if (!sr) {
        if (attempts < maxAttempts) setTimeout(tryInject, 100);
        return;
      }
      // Idempotente: si ya inyectamos, salir
      if (sr.getElementById && sr.getElementById('kfv-custom-css')) return;
      if (sr.querySelector && sr.querySelector('#kfv-custom-css')) return;
      var style = document.createElement('style');
      style.id = 'kfv-custom-css';
      style.textContent = [
        '/* === kfv-custom: 1) search colapsable === */',
        '.file-viewer-web-search{',
        '  display:inline-flex;align-items:center;position:relative;',
        '  overflow:hidden;border-radius:var(--file-viewer-toolbar-radius);',
        '  transition:background 0.15s ease;',
        '}',
        '.file-viewer-web-search input{',
        '  width:0!important;',
        '  min-width:0!important;',
        '  padding-left:0!important;padding-right:0!important;',
        '  opacity:0;',
        '  border:0!important;',
        '  transition:width 0.18s ease, padding 0.18s ease, opacity 0.12s ease;',
        '}',
        '.file-viewer-web-search:focus-within input,',
        '.file-viewer-web-search input:not(:placeholder-shown){',
        '  width:180px!important;',
        '  min-width:180px!important;',
        '  padding-left:8px!important;padding-right:8px!important;',
        '  opacity:1;',
        '}',
        '.file-viewer-web-search:focus-within{',
        '  background:var(--file-viewer-input-bg,#f3f4f6);',
        '}',
        '',
        '/* === kfv-custom: 2) toolbar flotante centrada === */',
        '.file-viewer-web-toolbar[data-toolbar-position="bottom-right"]{',
        '  right:auto!important;',
        '  left:50%!important;',
        '  transform:translateX(-50%)!important;',
        '}'
      ].join('\n');
      sr.appendChild(style);
    };
    tryInject();
  }

  function setMeta(name, size, ext) {
    var titleEl = document.getElementById(_titleId);
    var sizeEl  = document.getElementById(_sizeId);
    var badge   = document.getElementById(_extBadgeId);
    if (titleEl) titleEl.textContent = name || 'Sin archivo';
    if (sizeEl)  sizeEl.textContent  = fmtBytes(size);
    if (badge) {
      var e = (ext || '').toLowerCase();
      badge.textContent = e ? e.toUpperCase() : '…';
      badge.setAttribute('data-ext', e);
    }
  }

  function mountViewer(blobUrl, fileName) {
    var body = document.getElementById(_bodyId);
    if (!body) return;
    body.innerHTML = '';

    var v = document.createElement('flyfish-file-viewer');
    v.setAttribute('src', blobUrl);
    v.setAttribute('filename', fileName || 'archivo');
    v.setAttribute('theme', 'light');
    v.setAttribute('locale', 'es-ES');
    v.setAttribute('toolbar-position', 'bottom-right');
    v.setAttribute('density', 'compact');
    v.style.cssText = 'display:block;width:100%;height:100%;min-height:480px;';
    body.appendChild(v);
    // 📦608-fix12 — Inyectar CSS colapsable del search + centrar toolbar flotante
    _injectViewerCustomCss(v);
  }

  // -----------------------------------------------------------------------------
  // 📦608-fix8 — Montar el viewer en un contenedor específico (SIN modal).
  // Usado por submódulos que quieren renderizar el file-viewer inline en su
  // propio panel de preview. Devuelve una función unmount() para liberar
  // recursos cuando el usuario selecciona otro doc o cierra el preview.
  // -----------------------------------------------------------------------------
  function _makeBlobFromBytes(bytes) {
    var ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    return new Blob([ab], { type: 'application/octet-stream' });
  }

  function mountInContainer(container, data) {
    if (!container) return null;
    if (!data || !data.bytes) return null;
    var ext = (data.ext || '').toLowerCase();
    var name = data.name || 'archivo';

    // Limpiar viewer previo
    try {
      container.querySelectorAll('flyfish-file-viewer').forEach(function (el) {
        try { if (typeof el.unload === 'function') el.unload(); } catch (_) {}
        el.remove();
      });
    } catch (_) {}

    // Crear blob URL
    var localUrl = URL.createObjectURL(_makeBlobFromBytes(data.bytes));

    // Crear el custom element con fit al ancho
    var v = document.createElement('flyfish-file-viewer');
    v.setAttribute('src', localUrl);
    v.setAttribute('filename', name);
    v.setAttribute('theme', 'light');
    v.setAttribute('locale', 'es-ES');
    // 📦608-fix11 — Toolbar arriba + modo compacto para que entre en
    // el panel de preview en modo ventana (623px) sin cortarse.
    // 📦608-fix12 — Bottom-right flotante + compact + search colapsable
    // (probando variante — antes era 'top-center').
    v.setAttribute('toolbar-position', 'bottom-right');
    v.setAttribute('density', 'compact');
    v.setAttribute('fit', JSON.stringify({ mode: 'width', resize: 'initial' }));
    v.style.cssText = 'display:block;width:100%;height:100%;';
    container.appendChild(v);

    // 📦608-fix12 — Inyectar CSS colapsable del search + centrar toolbar flotante
    _injectViewerCustomCss(v);

    return {
      el: v,
      url: localUrl,
      unmount: function () {
        try { if (typeof v.unload === 'function') v.unload(); } catch (_) {}
        try { v.remove(); } catch (_) {}
        try { URL.revokeObjectURL(localUrl); } catch (_) {}
      }
    };
  }

  // -----------------------------------------------------------------------------
  // Cierre y limpieza
  // -----------------------------------------------------------------------------
  function closeFileViewer() {
    var overlay = document.getElementById(_overlayId);
    if (overlay) overlay.setAttribute('hidden', '');
    var body = document.getElementById(_bodyId);
    if (body) {
      body.querySelectorAll('flyfish-file-viewer').forEach(function (el) {
        try { if (typeof el.unload === 'function') el.unload(); } catch (_) {}
        el.remove();
      });
    }
    if (_currentUrl) {
      try { URL.revokeObjectURL(_currentUrl); } catch (_) {}
      _currentUrl = null;
    }
  }

  // -----------------------------------------------------------------------------
  // API pública
  // -----------------------------------------------------------------------------
  async function openWithFileViewerFromPath(filePath) {
    if (!filePath) return;
    var api = window.electronAPI;
    if (!api || !api.readFileBytes) {
      // Si no hay electronAPI (raro en prod, frecuente en dev fuera de Electron),
      // mostramos un error claro
      ensureModalDOM();
      var overlay = document.getElementById(_overlayId);
      overlay.removeAttribute('hidden');
      setMeta(filePath.split(/[\\/]/).pop(), null, filePath.split('.').pop());
      showError('API readFileBytes no disponible — ¿estás corriendo fuera de Electron?');
      return;
    }

    ensureModalDOM();
    var overlay = document.getElementById(_overlayId);
    overlay.removeAttribute('hidden');
    // 📦608-fix14 — El modal SIEMPRE abre en expandido (es el único estado ahora)

    var fileName = String(filePath).split(/[\\/]/).pop();
    var ext = (fileName.split('.').pop() || '').toLowerCase();
    setMeta(fileName, null, ext);
    showLoading('Leyendo ' + fileName + '…');

    var res;
    try { res = await api.readFileBytes(filePath); }
    catch (e) {
      showError('Error llamando read-file-bytes: ' + (e && e.message || e));
      return;
    }
    if (!res || !res.success) {
      showError('No se pudo leer el archivo: ' + (res && res.error || 'error desconocido'));
      return;
    }
    var data = res.data;
    var bytes = data.bytes;
    var ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    var blob = new Blob([ab], { type: 'application/octet-stream' });
    if (_currentUrl) { try { URL.revokeObjectURL(_currentUrl); } catch (_) {} }
    _currentUrl = URL.createObjectURL(blob);
    setMeta(data.name, data.size, data.ext);
    mountViewer(_currentUrl, data.name);
    console.log('[kairFV] Viewer montado desde path:', data.name, '(' + fmtBytes(data.size) + ', .' + data.ext + ')');
  }

  function openFileViewerFromFile(file) {
    if (!file) return;
    ensureModalDOM();
    var overlay = document.getElementById(_overlayId);
    overlay.removeAttribute('hidden');
    // 📦608-fix14 — El modal SIEMPRE abre en expandido (es el único estado ahora)

    var ext = (file.name.split('.').pop() || '').toLowerCase();
    setMeta(file.name, file.size, ext);
    showLoading('Leyendo ' + file.name + '…');

    var reader = new FileReader();
    reader.onload = function (ev) {
      var blob = new Blob([ev.target.result], { type: file.type || 'application/octet-stream' });
      if (_currentUrl) { try { URL.revokeObjectURL(_currentUrl); } catch (_) {} }
      _currentUrl = URL.createObjectURL(blob);
      setMeta(file.name, file.size, ext);
      mountViewer(_currentUrl, file.name);
      console.log('[kairFV] Viewer montado desde File:', file.name, '(' + fmtBytes(file.size) + ', .' + ext + ')');
    };
    reader.onerror = function () {
      showError('Error leyendo el archivo: ' + (reader.error ? reader.error.message : 'desconocido'));
    };
    reader.readAsArrayBuffer(file);
  }

  // -----------------------------------------------------------------------------
  // Inicialización: configurar asset base si está disponible
  // -----------------------------------------------------------------------------
  function tryConfigureAssetBase() {
    try {
      var F = window.FlyfishFileViewerWeb;
      if (F && typeof F.setDefaultFullAssetBaseUrl === 'function') {
        // El bundle está en renderer/file-viewer-assets/, los workers también ahí.
        // Como este helper puede correr tanto desde el index.html raíz como desde
        // iframes de submódulos (ej. modules/recursos/responsable-sg/), necesitamos
        // calcular el path relativo correcto basado en la URL del script.
        var scriptUrl = (document.currentScript && document.currentScript.src) || '';
        // Tipicamente: file:///C:/.../shared/file-viewer.js
        // o desde un iframe: file:///C:/.../modules/recursos/responsable-sg/responsable-sg-view.html
        // Buscamos el helper y de ahí derivamos el path a renderer/file-viewer-assets/
        var helperDir = scriptUrl.substring(0, scriptUrl.lastIndexOf('/shared/') + 1); // incluye el /
        var assetBase = helperDir + 'renderer/file-viewer-assets/';
        F.setDefaultFullAssetBaseUrl(assetBase);
        console.log('[kairFV] Asset base configurado:', assetBase);
      }
    } catch (e) {
      console.warn('[kairFV] No se pudo configurar asset base:', e);
    }
  }

  // Exponer
  window.kairFV = {
    openWithFileViewerFromPath: openWithFileViewerFromPath,
    openFileViewerFromFile: openFileViewerFromFile,
    closeFileViewer: closeFileViewer,
    mountInContainer: mountInContainer
  };

  // -----------------------------------------------------------------------------
  // 📦608-fix15 — Helper genérico para visualizadores de submódulos.
  // Reemplaza el handleStandardRequest custom de cada *-logic.js y centraliza
  // el switch Office→readFileBytes + el render del preview en un solo lugar.
  //
  // Caso de uso típico (manual-proveedores, curso-virtual, etc.):
  //   // En *-logic.js
  //   case 'get-word-preview':
  //     window.KairDocPreview.handleRequest(event, 'getWordPreview');
  //     break;
  //
  //   // En *-viewer.js (donde antes había un iframe con data:application/pdf)
  //   if (result && result.mode === 'file-viewer') {
  //     window.KairDocPreview.mountInContainer(container, result);
  //   } else {
  //     // Compatibilidad con PDF viejo
  //     container.innerHTML = '<iframe ...></iframe>';
  //   }
  // -----------------------------------------------------------------------------
  window.KairDocPreview = {
    /**
     * Handler genérico para mensajes postMessage de iframes de visualizadores.
     * Switch automático a readFileBytes para Office (no PDF).
     */
    handleRequest: async function (event, apiFunctionName) {
      var requestId = event.data && event.data.requestId;
      var payload = event.data && event.data.payload;
      var filePath = (typeof payload === 'string') ? payload
        : (payload && payload.filePath) ? payload.filePath : '';
      var ext = (filePath.split('.').pop() || '').toLowerCase();
      var isOffice = (apiFunctionName === 'getExcelPreview' || apiFunctionName === 'getWordPreview')
        && ext && ext !== 'pdf';

      var responsePayload;
      try {
        if (isOffice && window.electronAPI && window.electronAPI.readFileBytes) {
          // 📦608 — Office nativo: leer bytes crudos para file-viewer
          var rfb = await window.electronAPI.readFileBytes(filePath);
          if (!rfb || !rfb.success) {
            responsePayload = {
              success: false,
              error: (rfb && rfb.error) || 'No se pudo leer el archivo'
            };
          } else {
            responsePayload = {
              success: true,
              mode: 'file-viewer',
              data: {
                bytes: rfb.data.bytes,
                name: rfb.data.name,
                ext: rfb.data.ext,
                size: rfb.data.size,
                filePath: filePath
              }
            };
          }
        } else {
          // PDF (o API sin switch): flujo viejo
          if (!window.electronAPI || typeof window.electronAPI[apiFunctionName] !== 'function') {
            throw new Error('API function ' + apiFunctionName + ' not found');
          }
          var apiArgs = (payload && typeof payload === 'object' && payload.filePath) ? payload.filePath : payload;
          var result = await window.electronAPI[apiFunctionName](apiArgs);
          responsePayload = {
            success: result.success,
            data: result.data || result,
            files: result.files,
            folders: result.folders,
            basePath: result.basePath,
            fileName: result.fileName,
            base64Data: result.base64Data,
            error: result.error
          };
        }
      } catch (error) {
        responsePayload = {
          success: false,
          error: (error && error.message) || String(error)
        };
      }

      event.source.postMessage({
        type: (event.data.type || '').replace('-request', '') + '-response',
        requestId: requestId,
        payload: responsePayload
      }, '*');
    },

    /**
     * Monta el file-viewer (o iframe PDF de fallback) en un contenedor.
     * result puede ser:
     *   - { mode: 'file-viewer', data: { bytes, name, ext, size, filePath } }
     *   - { success, data: { base64Data } } (PDF viejo)
     *   - { base64Data } directo
     */
    mountInContainer: function (container, result) {
      if (!container) return null;
      container.innerHTML = '';
      if (!result) {
        container.innerHTML = '<div style="padding:20px;color:#6b7280;">Sin datos para mostrar</div>';
        return null;
      }
      // Modo file-viewer (Office nativo)
      if (result.mode === 'file-viewer' && result.data && result.data.bytes) {
        if (window.kairFV && typeof window.kairFV.mountInContainer === 'function') {
          return window.kairFV.mountInContainer(container, result.data);
        }
        container.innerHTML = '<div style="padding:20px;color:#b91c1c;">file-viewer no disponible</div>';
        return null;
      }
      // Fallback: PDF viejo
      var base64 = result.base64Data
        || (result.data && result.data.base64Data)
        || (result.data && typeof result.data === 'string' ? result.data : null);
      if (base64) {
        container.innerHTML = '<iframe src="data:application/pdf;base64,' + base64 +
          '" style="width:100%;height:100%;border:none;"></iframe>';
        return null;
      }
      container.innerHTML = '<div style="padding:20px;color:#6b7280;">Formato no soportado para preview</div>';
      return null;
    }
  };

  // Configurar asset base apenas se carga (antes de cualquier render)
  tryConfigureAssetBase();
  console.log('[kairFV] Helper inicializado. window.kairFV + window.KairDocPreview listos.');
})();

/* ============================================================
 * K+AIR Bandeja Integrada — Mail Operations
 * ============================================================ */

(function () {
  "use strict";

  const H = window.BandejaHelpers;
  const S = window.BandejaState;

  // ====== Electron API getter ======
  function getElectronAPI() {
    if (typeof window === "undefined") return null;
    return window.electronAPI || (window.parent && window.parent.electronAPI) || null;
  }

  // ====== Helpers ======
  function threadToMail(thread) {
    var senderName = thread.last_sender_name || thread.last_sender_email || "(remitente desconocido)";
    var senderEmail = thread.last_sender_email || "";
    var computedInitials = (senderName || "?").split(" ").map(function (p) { return p[0]; }).slice(0, 2).join("").toUpperCase() || "?";
    var computedColor = "#" + stringHashColor(senderEmail || senderName);
    var computedTime = formatGmailDate(thread.last_message_date, true) || "";
    return {
      id: thread.id,
      threadId: thread.id,
      sender: senderName,
      senderEmail: senderEmail,
      subject: thread.subject || "(sin asunto)",
      snippet: thread.snippet || "",
      preview: thread.snippet || "",
      date: thread.last_message_date,
      time: computedTime,
      unread: thread.has_unread,
      star: thread.is_starred,
      avatarColor: computedColor,
      avatarInitials: computedInitials,
      label_ids: Array.isArray(thread.label_ids) ? thread.label_ids : [],
      body: "",
      thread: thread,
      messageCount: thread.message_count || 1,
      participants_list: Array.isArray(thread.participants) ? thread.participants : [],
      to_list: _coerceAddressList(thread.last_to_list),
      cc_list: _coerceAddressList(thread.last_cc_list)
    };
  }

  function stringHashColor(str) {
    if (!str) return "5f6368";
    var hash = 0;
    for (var i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
    var c = (hash & 0x00FFFFFF).toString(16);
    return ("000000" + c).slice(-6);
  }

  function formatGmailDate(dateVal, withTime) {
    return window.BandejaHelpers.formatGmailDate(dateVal, withTime);
  }

  function _coerceAddressList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try { return JSON.parse(value); } catch (e) { return []; }
  }

  // ====== Snooze ======
  function isThreadSnoozed(threadId) {
    return window.BandejaState.snoozedThreads && window.BandejaState.snoozedThreads.has(threadId);
  }

  function unsnoozeThread(threadId) {
    if (window.BandejaState.snoozedThreads) window.BandejaState.snoozedThreads.delete(threadId);
  }

  function getSnoozeRemainingLabel(wakeTime) {
    var diff = wakeTime - Date.now();
    var hrs = Math.floor(diff / 3600000);
    if (hrs < 1) return "menos de 1h";
    if (hrs < 24) return hrs + "h";
    var days = Math.floor(hrs / 24);
    return days + "d";
  }

  function snoozeThread(threadId, wakeTime) {
    if (!window.BandejaState.snoozedThreads) window.BandejaState.snoozedThreads = new Map();
    window.BandejaState.snoozedThreads.set(threadId, wakeTime);
  }

  // ====== Sync / Load ======
  function loadMailsFromCache(options) {
    options = options || {};
    var folder = options.folder || S.mailFolder || "INBOX";
    var forceSync = options.forceSync || false;
    var api = getElectronAPI();
    if (!api || !api.emailCache) {
      console.warn("[BandejaIntegrada] electronAPI.emailCache no disponible, fallback a Gmail directo");
      return loadMailsFromGmail();
    }
    try {
      var cacheResult = api.emailCache.getThreads({ folder: folder, maxResults: 25 });
      return cacheResult.then(function (cacheResult) {
        if (cacheResult && cacheResult.success && Array.isArray(cacheResult.data) && cacheResult.data.length > 0) {
          console.log("[BandejaIntegrada] Cache SQLite retorno " + cacheResult.data.length + " threads (folder=" + folder + ")");
          if (S.mails && S.mails.length > 0) {
            var oldMailsById = {};
            for (var mi = 0; mi < S.mails.length; mi++) oldMailsById[S.mails[mi].id] = S.mails[mi];
            S.mails = cacheResult.data.map(function (thread) {
              var newMail = threadToMail(thread);
              var oldMail = oldMailsById[newMail.id];
              if (oldMail) {
                if (oldMail.unread === false && newMail.unread === true) newMail.unread = false;
                if (oldMail.flagged === true && newMail.flagged === false) newMail.flagged = true;
              }
              return newMail;
            });
          } else {
            S.mails = cacheResult.data.map(threadToMail);
          }
          if (forceSync) { window.BandejaRenderMailList.render(document.getElementById("mail-list-container")); }
          syncInboxInBackground();
          return S.mails;
        }
        console.log("[BandejaIntegrada] Cache vacío, sincronizando con Gmail por primera vez (folder=" + folder + ")...");
        return api.emailCache.syncInbox({ folder: folder, maxResults: 25 }).then(function (syncResult) {
          if (syncResult && syncResult.success && syncResult.data) {
            console.log("[BandejaIntegrada] Primer sync: " + syncResult.data.synced + " threads guardados en SQLite");
            return api.emailCache.getThreads({ folder: folder, maxResults: 25 });
          }
          return loadMailsFromGmail();
        }).then(function (afterResult) {
          if (afterResult && afterResult.success && Array.isArray(afterResult.data)) return afterResult.data.map(threadToMail);
          return loadMailsFromGmail();
        });
      } catch (e) {
        console.error("[BandejaIntegrada] Error cargando desde cache, fallback a Gmail directo:", e);
        return loadMailsFromGmail();
      }
    }

    function loadMailsFromGmail() {
      var api = getElectronAPI();
      if (!api || !api.googleGmail) {
        console.warn("[BandejaIntegrada] electronAPI.googleGmail no disponible, usando mocks");
        return Promise.resolve(window.KairData.MAILS.slice());
      }
      return api.googleGmail.listInbox({ maxResults: 25 }).then(function (result) {
        if (result && result.success && Array.isArray(result.data) && result.data.length > 0) {
          console.log("[BandejaIntegrada] Gmail retorno " + result.data.length + " correos reales");
          return result.data;
        }
        return window.KairData.MAILS.slice();
      }).catch(function (e) {
        console.error("[BandejaIntegrada] Error cargando correos de Gmail, usando mocks:", e);
        return window.KairData.MAILS.slice();
      });
    }

    function syncInboxInBackground() {
      var api = getElectronAPI();
      if (!api || !api.emailCache) return;
      var currentFolder = S.mailFolder || "INBOX";
      api.emailCache.syncInbox({ folder: currentFolder, maxResults: 25 }).then(function (r) {
        if (r && r.success) {
          console.log("[BandejaIntegrada] Background sync OK: " + r.data.synced + " threads (folder=" + currentFolder + ")");
          return api.emailCache.getThreads({ folder: currentFolder, maxResults: 25 });
        } else {
          console.warn("[BandejaIntegrada] Background sync failed:", r && r.error);
          notifyGmailSyncError(r && r.error);
          return null;
        }
      }).then(function (cacheResult) {
        if (cacheResult && cacheResult.success && Array.isArray(cacheResult.data)) {
          if (S.mailFolder === currentFolder) {
            var oldMailsById = {};
            for (var mi = 0; mi < S.mails.length; mi++) oldMailsById[S.mails[mi].id] = S.mails[mi];
            S.mails = cacheResult.data.map(function (thread) {
              var newMail = threadToMail(thread);
              var oldMail = oldMailsById[newMail.id];
              if (oldMail) {
                if (oldMail.messages && oldMail.messages.length > 0) newMail.messages = oldMail.messages;
                if (oldMail.body) newMail.body = oldMail.body;
                if (oldMail.body_html) newMail.body_html = oldMail.body_html;
                if (oldMail.attachments) newMail.attachments = oldMail.attachments;
                if (oldMail.to_list) newMail.to_list = oldMail.to_list;
                if (oldMail.cc_list) newMail.cc_list = oldMail.cc_list;
                if (oldMail.unread === false && newMail.unread === true) newMail.unread = false;
                if (oldMail.flagged === true && newMail.flagged === false) newMail.flagged = true;
              }
              return newMail;
            });
            console.log("[BandejaIntegrada] Re-cargados " + S.mails.length + " threads (folder=" + currentFolder + ")");
            window.BandejaRenderMailList.render(document.getElementById("mail-list-container"));
          } else {
            console.log("[BandejaIntegrada] Sync completó pero el user ya cambió a folder " + S.mailFolder + ", no actualizo state.mails");
          }
        }
      }).catch(function (e) {
        console.warn("[BandejaIntegrada] Background sync error:", e.message);
        notifyGmailSyncError(e.message);
      });
    }

    function notifyGmailSyncError(errorMsg) {
      var now = Date.now();
      var THROTTLE_MS = 5 * 60 * 1000;
      if (S.lastGmailErrorNotifiedAt && (now - S.lastGmailErrorNotifiedAt) < THROTTLE_MS) return;
      S.lastGmailErrorNotifiedAt = now;
      var errLower = (errorMsg || "").toLowerCase();
      if (errLower.indexOf("token") !== -1 || errLower.indexOf("reconectar") !== -1 || errLower.indexOf("reconnect") !== -1) {
        window.BandejaHelpers.toast("Gmail desconectado", "Reconectá Gmail desde Configuración → Gestión de Empresas para sincronizar correos.", "warning");
      } else {
        window.BandejaHelpers.toast("Error al sincronizar correos", errorMsg || "Reintentando automáticamente. Si persiste, contactá soporte.", "error");
      }
    }

    // ====== Load body ======
    function loadMailBodyFromCache(mail) {
      var api = getElectronAPI();
      if (!api || !api.emailCache) return Promise.resolve();
      mail._loadingBody = true;
      var threadId = mail.threadId || mail.id;
      return api.emailCache.getThread(threadId).then(function (result) {
        if (result && result.success && result.data && result.data.messages && result.data.messages.length > 0) {
          mail.messages = result.data.messages;
          var lastMsg = result.data.messages[result.data.messages.length - 1];
          if (lastMsg && lastMsg.body_plain) {
            mail.body = lastMsg.body_plain;
            if (lastMsg.body_html) mail.body_html = lastMsg.body_html;
            console.log("[BandejaIntegrada] Thread " + threadId + " cargado: " + result.data.messages.length + " mensaje(s)");
          }
          if (lastMsg) {
            mail.to_list = _coerceAddressList(lastMsg.to_list);
            mail.cc_list = _coerceAddressList(lastMsg.cc_list);
          }
          return window.BandejaMailOps.loadAttachmentsForThread(mail);
        }
      }).catch(function (e) {
        console.warn("[BandejaIntegrada] Error cargando body del thread " + mail.threadId + ":", e.message);
      }).finally(function () { mail._loadingBody = false; });
    }

    function loadAttachmentsForThread(mail) {
      var api = getElectronAPI();
      if (!api || !api.emailCache || !mail.messages) return Promise.resolve();
      var attachPromises = mail.messages.map(function (msg) {
        return api.emailCache.getAttachments(msg.id).then(function (attResult) {
          if (attResult && attResult.success && Array.isArray(attResult.data)) msg.attachments = attResult.data;
          else msg.attachments = [];
        }).catch(function () { msg.attachments = []; });
      });
      return Promise.all(attachPromises).then(function () {
        var threadHasAttach = mail.messages.some(function (m) { return m.attachments && m.attachments.length > 0; });
        if (threadHasAttach) { mail.hasAttachment = true; var rowInList = document.querySelector('.email-row[data-mail-id="' + (mail.id || mail.threadId) + '"]'); if (rowInList) rowInList.setAttribute("data-has-attachment", "true"); }
      });
    }

    // ====== Attachments ======
    function formatAttachmentSize(bytes) { return window.BandejaHelpers.formatAttachmentSize(bytes); }

    function attachmentIcon(filename) { return window.BandejaHelpers.attachmentIcon(filename); }

    function downloadMailAttachment(messageId, attachmentId, filename, returnContent, returnBytes) {
      var api = getElectronAPI();
      if (!api || !api.googleGmail || !api.googleGmail.downloadAttachment) {
        window.BandejaHelpers.toast("Error", "API de descarga no disponible", "error");
        return Promise.resolve((returnContent || returnBytes) ? null : undefined);
      }
      if (!returnContent && !returnBytes) window.BandejaHelpers.toast("Descargando", filename, "info");
      return api.googleGmail.downloadAttachment({ messageId: messageId, attachmentId: attachmentId }).then(function (result) {
        if (result && result.success) {
          var base64 = result.data.data.replace(/-/g, "+").replace(/_/g, "/");
          while (base64.length % 4) base64 += "=";
          var binary = atob(base64);
          if (returnContent) {
            try {
              var bytes2 = new Uint8Array(binary.length);
              for (var k = 0; k < binary.length; k++) bytes2[k] = binary.charCodeAt(k);
              return new TextDecoder("utf-8").decode(bytes2);
            } catch (e) { return binary; }
          }
          var bytes = new Uint8Array(binary.length);
          for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          if (returnBytes) {
            var resolvedName = result.data.filename || filename || "archivo";
            var resolvedExt = (resolvedName.split(".").pop() || "").toLowerCase();
            return { bytes: bytes, name: resolvedName, ext: resolvedExt, size: bytes.byteLength, mimeType: result.data.mimeType || "application/octet-stream" };
          }
          var blob = new Blob([bytes], { type: result.data.mimeType || "application/octet-stream" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url; a.download = result.data.filename || filename || "archivo";
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          window.BandejaHelpers.toast("Descargado", a.download, "success");
        } else {
          window.BandejaHelpers.toast("Error al descargar", (result && result.error) || "Error desconocido", "error");
          return (returnContent || returnBytes) ? null : undefined;
        }
      }).catch(function (e) {
        console.error("[BandejaIntegrada] Error descargando attachment:", e);
        window.BandejaHelpers.toast("Error al descargar", e.message, "error");
        return (returnContent || returnBytes) ? null : undefined;
      });
    }

    function openAttachmentPreview(att) {
      if (!att) return;
      var overlay = document.getElementById("fv-overlay");
      var body = document.getElementById("fv-body");
      if (!overlay || !body) { window.BandejaHelpers.toast("Error", "Modal de preview no disponible", "error"); return; }
      body.querySelectorAll("flyfish-file-viewer").forEach(function (el) { el.remove(); });
      if (window.BandejaHelpers._fvCurrentUrl) { try { URL.revokeObjectURL(window.BandejaHelpers._fvCurrentUrl); } catch (_) {} window.BandejaHelpers._fvCurrentUrl = null; }
      var ext = (att.filename || "").split(".").pop() || "";
      ext = ext.toLowerCase();
      overlay.removeAttribute("hidden");
      var titleEl = document.getElementById("fv-filename");
      var sizeEl = document.getElementById("fv-filesize");
      var badge = document.getElementById("fv-ext-badge");
      if (titleEl) titleEl.textContent = att.filename || "(sin nombre)";
      if (badge) { badge.textContent = ext.toUpperCase(); badge.setAttribute("data-ext", ext); }
      if (sizeEl) sizeEl.textContent = att.size ? window.BandejaHelpers.formatAttachmentSize(att.size) : "…";
      window.BandejaHelpers._fvShowLoading("Descargando " + (att.filename || "adjunto") + "…");
      return downloadMailAttachment(att._messageId, att.attachmentId, att.filename, false, true).then(function (data) {
        if (!data || !data.bytes) { window.BandejaHelpers._fvShowError("No se pudo descargar el adjunto para preview."); return; }
        if (sizeEl) sizeEl.textContent = window.BandejaHelpers.formatAttachmentSize(data.size || data.bytes.byteLength);
        if (ext === "xls") { _fvShowXlsFallback(att.filename || "archivo.xls", body); return; }
        try {
          var blob = new Blob([data.bytes], { type: data.mimeType || "application/octet-stream" });
          window.BandejaHelpers._fvCurrentUrl = URL.createObjectURL(blob);
          body.querySelectorAll(".kair-fv-loading,.kair-fv-error").forEach(function (el) { el.remove(); });
          if (window.kairFV && typeof window.kairFV.mountInContainer === "function") {
            body.querySelectorAll("flyfish-file-viewer").forEach(function (el) { try { if (typeof el.unload === "function") el.unload(); } catch (_) {} el.remove(); });
            if (window.BandejaHelpers._fvCurrentUrl) { try { URL.revokeObjectURL(window.BandejaHelpers._fvCurrentUrl); } catch (_) {} window.BandejaHelpers._fvCurrentUrl = null; }
            var mountData = { bytes: data.bytes, name: data.name, ext: ext, size: data.size, mimeType: data.mimeType };
            var mount = window.kairFV.mountInContainer(body, mountData);
            if (mount && mount.url) window.BandejaHelpers._fvCurrentUrl = mount.url;
          } else {
            var viewer = document.createElement("flyfish-file-viewer");
            viewer.setAttribute("src", window.BandejaHelpers._fvCurrentUrl);
            viewer.setAttribute("filename", data.name);
            viewer.setAttribute("theme", "light");
            viewer.setAttribute("locale", "es-ES");
            viewer.setAttribute("toolbar-position", "bottom-right");
            viewer.style.cssText = "display:block;width:100%;height:100%;min-height:540px;";
            body.appendChild(viewer);
            if (window.kairFV && typeof window.kairFV._applyViewerCustomization === "function") window.kairFV._applyViewerCustomization(viewer);
          }
          console.log("[BandejaIntegrada] Preview attachment montado:", data.name, "(" + window.BandejaHelpers.formatAttachmentSize(data.size) + ", ." + ext + ")");
        } catch (e) { console.error("[BandejaIntegrada] Error montando file-viewer:", e); window.BandejaHelpers._fvShowError("Error mostrando el preview: " + e.message); }
      }).catch(function (e) { console.error("[BandejaIntegrada] Error en preview:", e); window.BandejaHelpers._fvShowError("Error mostrando el preview: " + e.message); });
    }

    function _fvShowXlsFallback(filename, body) {
      body.querySelectorAll(".kair-fv-loading,.kair-fv-error").forEach(function (el) { el.remove(); });
      body.innerHTML = '<div style="padding:24px 20px;text-align:center;color:#374151;max-width:480px;margin:40px auto;">' +
        '<div style="font-size:32px;margin-bottom:12px;">📊</div>' +
        '<div style="font-size:1rem;font-weight:600;margin-bottom:6px;color:#1f2937;">Formato .xls legacy</div>' +
        '<div style="font-size:0.875rem;color:#6b7280;margin-bottom:16px;line-height:1.4;">El formato Excel 97-2003 (.xls) puede tener problemas de render en el preview. Convertilo a <strong>.xlsx</strong> para mejor resultado.</div>' +
        '<div style="font-size:0.8125rem;color:#9ca3af;">Archivo: <code style="background:#f3f4f6;padding:2px 6px;border-radius:3px;">' + filename + "</code></div></div>";
    }

    function _fvShowLoading(text) {
      var body = document.getElementById("fv-body");
      if (!body) return;
      body.querySelectorAll(".kair-fv-loading,.kair-fv-error").forEach(function (el) { el.remove(); });
      var div = document.createElement("div");
      div.className = "kair-fv-loading";
      div.id = "fv-loading";
      div.innerHTML = '<div class="kair-fv-spinner"></div><p>' + (text || "Cargando…") + "</p>";
      body.appendChild(div);
    }

    function _fvShowError(msg) {
      var body = document.getElementById("fv-body");
      if (!body) return;
      body.querySelectorAll(".kair-fv-loading,.kair-fv-error").forEach(function (el) { el.remove(); });
      var div = document.createElement("div");
      div.className = "kair-fv-error";
      div.innerHTML = "<p>" + msg + "</p>";
      body.appendChild(div);
    }

    function openFileViewerFromFile(file) {
      if (!file) return;
      var overlay = document.getElementById("fv-overlay");
      var body = document.getElementById("fv-body");
      if (!overlay || !body) return;
      body.querySelectorAll("flyfish-file-viewer").forEach(function (el) { el.remove(); });
      if (window.BandejaHelpers._fvCurrentUrl) { try { URL.revokeObjectURL(window.BandejaHelpers._fvCurrentUrl); } catch (_) {} window.BandejaHelpers._fvCurrentUrl = null; }
      overlay.removeAttribute("hidden");
      var titleEl = document.getElementById("fv-filename");
      var sizeEl = document.getElementById("fv-filesize");
      var badge = document.getElementById("fv-ext-badge");
      if (titleEl) titleEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = window.BandejaHelpers._fvFormatBytes(file.size);
      var ext = (file.name.split(".").pop() || "").toLowerCase();
      if (badge) { badge.textContent = ext.toUpperCase(); badge.setAttribute("data-ext", ext); }
      window.BandejaHelpers._fvShowLoading("Leyendo " + file.name + "…");
      var reader = new FileReader();
      reader.onload = function (ev) {
        var blob = new Blob([ev.target.result], { type: file.type || "application/octet-stream" });
        window.BandejaHelpers._fvCurrentUrl = URL.createObjectURL(blob);
        body.querySelectorAll(".kair-fv-loading,.kair-fv-error").forEach(function (el) { el.remove(); });
        var viewer = document.createElement("flyfish-file-viewer");
        viewer.setAttribute("src", window.BandejaHelpers._fvCurrentUrl);
        viewer.setAttribute("filename", file.name);
        viewer.setAttribute("theme", "light");
        viewer.setAttribute("locale", "es-ES");
        viewer.setAttribute("toolbar-position", "bottom-right");
        viewer.style.cssText = "display:block;width:100%;height:100%;min-height:540px;";
        body.appendChild(viewer);
        console.log("[FV][Bandeja] Viewer montado para", file.name, "(" + window.BandejaHelpers._fvFormatBytes(file.size) + ", ." + ext + ")");
      };
      reader.onerror = function () { window.BandejaHelpers._fvShowError("Error leyendo el archivo: " + (reader.error ? reader.error.message : "error desconocido")); };
      reader.readAsArrayBuffer(file);
    }

    function openWithFileViewerFromPath(filePath) {
      var api = getElectronAPI();
      if (!api || !api.readFileBytes) { window.BandejaHelpers._fvShowError("API readFileBytes no disponible (¿preload no la expone?)."); return; }
      var overlay = document.getElementById("fv-overlay");
      var body = document.getElementById("fv-body");
      if (!overlay || !body) return;
      body.querySelectorAll("flyfish-file-viewer").forEach(function (el) { el.remove(); });
      if (window.BandejaHelpers._fvCurrentUrl) { try { URL.revokeObjectURL(window.BandejaHelpers._fvCurrentUrl); } catch (_) {} window.BandejaHelpers._fvCurrentUrl = null; }
      var fileName = filePath.split(/[\\/]/).pop();
      var ext = (fileName.split(".").pop() || "").toLowerCase();
      overlay.removeAttribute("hidden");
      var titleEl = document.getElementById("fv-filename");
      var sizeEl = document.getElementById("fv-filesize");
      var badge = document.getElementById("fv-ext-badge");
      if (titleEl) titleEl.textContent = fileName;
      if (badge) { badge.textContent = ext.toUpperCase(); badge.setAttribute("data-ext", ext); }
      if (sizeEl) sizeEl.textContent = "…";
      window.BandejaHelpers._fvShowLoading("Leyendo bytes de " + fileName + "…");
      api.readFileBytes(filePath).then(function (res) {
        if (!res || !res.success) { window.BandejaHelpers._fvShowError("No se pudo leer el archivo: " + (res && res.error || "error desconocido")); return; }
        var data = res.data;
        var bytes = data.bytes;
        var ab = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(ab).set(bytes);
        var blob = new Blob([ab], { type: "application/octet-stream" });
        window.BandejaHelpers._fvCurrentUrl = URL.createObjectURL(blob);
        if (sizeEl) sizeEl.textContent = window.BandejaHelpers._fvFormatBytes(data.size);
        body.querySelectorAll(".kair-fv-loading,.kair-fv-error").forEach(function (el) { el.remove(); });
        var viewer = document.createElement("flyfish-file-viewer");
        viewer.setAttribute("src", window.BandejaHelpers._fvCurrentUrl);
        viewer.setAttribute("filename", data.name);
        viewer.setAttribute("theme", "light");
        viewer.setAttribute("locale", "es-ES");
        viewer.setAttribute("toolbar-position", "bottom-right");
        viewer.style.cssText = "display:block;width:100%;height:100%;min-height:540px;";
        body.appendChild(viewer);
        console.log("[FV][Bandeja] Viewer montado desde path:", data.name, "(" + window.BandejaHelpers._fvFormatBytes(data.size) + ", ." + data.ext + ")");
      }).catch(function (e) { window.BandejaHelpers._fvShowError("Error llamando read-file-bytes: " + (e && e.message || e)); });
    }

    function wireFileViewerDemo() {
      try {
        var F = window.FlyfishFileViewerWebFull || window.FlyfishFileViewerWeb;
        if (F && typeof F.setDefaultFullAssetBaseUrl === "function") F.setDefaultFullAssetBaseUrl("../file-viewer-assets/");
      } catch (e) { }
      var btn = document.getElementById("btn-fv-test");
      var input = document.getElementById("fv-file-input");
      var closeBtn = document.getElementById("fv-close-btn");
      var overlay = document.getElementById("fv-overlay");
      if (btn && input) { btn.addEventListener("click", function () { input.value = ""; input.click(); }); }
      if (input) { input.addEventListener("change", function (e) { var file = e.target.files && e.target.files[0]; if (!file) return; openFileViewerFromFile(file); }); }
      if (closeBtn) closeBtn.addEventListener("click", window.BandejaHelpers.closeFileViewer);
      if (overlay) { overlay.addEventListener("click", function (e) { if (e.target === overlay) window.BandejaHelpers.closeFileViewer(); }); }
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && overlay && !overlay.hasAttribute("hidden")) window.BandejaHelpers.closeFileViewer(); });
      console.log("[FV][Bandeja] Demo de file-viewer wireado. Buscá 'Probar FV' en el header.");
    }

    window.BandejaMailOps = {
      threadToMail: threadToMail,
      stringHashColor: stringHashColor,
      formatGmailDate: formatGmailDate,
      _coerceAddressList: _coerceAddressList,
      isThreadSnoozed: isThreadSnoozed,
      unsnoozeThread: unsnoozeThread,
      getSnoozeRemainingLabel: getSnoozeRemainingLabel,
      snoozeThread: snoozeThread,
      loadMailsFromCache: loadMailsFromCache,
      loadMailsFromGmail: loadMailsFromGmail,
      syncInboxInBackground: syncInboxInBackground,
      notifyGmailSyncError: notifyGmailSyncError,
      loadMailBodyFromCache: loadMailBodyFromCache,
      loadAttachmentsForThread: loadAttachmentsForThread,
      formatAttachmentSize: formatAttachmentSize,
      attachmentIcon: attachmentIcon,
      downloadMailAttachment: downloadMailAttachment,
      openAttachmentPreview: openAttachmentPreview,
      _fvShowXlsFallback: _fvShowXlsFallback,
      _fvShowLoading: window.BandejaHelpers._fvShowLoading,
      _fvShowError: window.BandejaHelpers._fvShowError,
      openFileViewerFromFile: openFileViewerFromFile,
      openWithFileViewerFromPath: openWithFileViewerFromPath,
      wireFileViewerDemo: wireFileViewerDemo,
      getElectronAPI: getElectronAPI
    };
})();
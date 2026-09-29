/* ============================================================
 * K+AIR Bandeja Integrada — Compose Modal
 * ============================================================ */

(function () {
  "use strict";

  const H = window.BandejaHelpers;
  const S = window.BandejaState;
  const D = window.KairData;

  var pendingAttachments = [];

  function getMailDisplayContact(mail) {
    var isSentFolder = S.mailFolder === "SENT";
    var contact = mail.to_list && mail.to_list.length > 0 ? mail.to_list[0] : (mail.cc_list && mail.cc_list.length > 0 ? mail.cc_list[0] : { name: mail.sender || "", email: mail.senderEmail || "" });
    if (isSentFolder) return contact;
    return { name: mail.sender || mail.senderEmail || "", email: mail.senderEmail || "" };
  }

  function initials(name) { return window.BandejaHelpers.initials(name); }
  function escapeHtml(s) { return String(s || "").replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, """).replace(/'/g, "'"); }
  function formatGmailDate(dateVal) { return window.BandejaHelpers.formatGmailDate(dateVal); }

  window.BandejaComposeModal = {
    open: function (mode, mail) {
      mail = mail || null;
      var isReply = mode === "reply" || mode === "replyAll";
      var isForward = mode === "forward";

      // Build quote
      var quoteHtml = "";
      if (mail && (isReply || isForward)) {
        var senderDisplay = (mail.sender || mail.senderEmail || "(remitente)");
        var senderEmail = mail.senderEmail || "";
        var quoteDate = mail.date ? window.BandejaHelpers.formatGmailDate(mail.date) : "";
        var quoteSubject = (mail.subject || "").replace(/^(\s*(Re|Fwd|RE|FW)\s*:\s*)+/i, "");
        var quoteBody = (mail.body || "");
        var quoteBodyEscaped = quoteBody.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");

        if (isForward) {
          quoteHtml = '<div class="compose-panel__quote">' +
            '<div class="compose-panel__quote-separator">---------- Forwarded message ----------</div>' +
            '<div class="compose-panel__quote-headers">' +
              '<div class="compose-panel__quote-header-row"><span class="kair-mail-quote__label">De:</span> ' + escapeHtml(senderDisplay) + (senderEmail ? " <" + escapeHtml(senderEmail) + ">" : "") + "</div>" +
              '<div class="compose-panel__quote-header-row"><span class="kair-mail-quote__label">Date:</span> ' + escapeHtml(quoteDate) + "</div>" +
              '<div class="compose-panel__quote-header-row"><span class="kair-mail-quote__label">Subject:</span> ' + escapeHtml(quoteSubject) + "</div>" +
              '<div class="compose-panel__quote-header-row"><span class="kair-mail-quote__label">To:</span> ' + escapeHtml(S.gmailEmail || "") + "</div>" +
            "</div>" +
            '<blockquote class="compose-panel__quote-body">' + quoteBodyEscaped.replace(/\n/g, "<br>") + "</blockquote>" +
          "</div>";
        } else {
          var quotedBody = quoteBody.split("\n").map(function (l) { return "> " + l; }).join("<br>");
          var wroteOn = "El " + quoteDate + ", " + senderDisplay + " escribió:";
          quoteHtml = '<div class="compose-panel__quote">' +
            '<div class="compose-panel__quote-separator">' + escapeHtml(wroteOn) + "</div>" +
            '<blockquote class="compose-panel__quote-body">' + quotedBody + "</blockquote>" +
          "</div>";
        }
      }

      // Recipients
      var toValue = "", ccValue = "", bccValue = "";
      if (isReply && mail) {
        var replyContact = window.BandejaDetailOps.getMailDisplayContact(mail);
        toValue = replyContact.email || replyContact.name || "";
        if (mode === "replyAll") {
          var toList = (mail.thread && mail.thread.participants) || [];
          var otherRecipients = toList.map(function (p) { return p.email; }).filter(function (e) { return e && e !== toValue && e !== S.gmailEmail; });
          ccValue = otherRecipients.join(", ");
        }
      } else if (isForward) { toValue = ""; }

      // Subject
      var subjectValue = "";
      if (isReply) { var originalSubject = (mail && mail.subject) || ""; subjectValue = /^Re:/i.test(originalSubject) ? originalSubject : "Re: " + originalSubject; }
      else if (isForward) { var originalSubjectFwd = (mail && mail.subject) || ""; subjectValue = /^Fwd:/i.test(originalSubjectFwd) ? originalSubjectFwd : "Fwd: " + originalSubjectFwd; }

      // Modal
      var modal = H.el("div", { class: "compose-panel-overlay" });
      modal.innerHTML = '<div class="compose-panel" role="dialog" aria-modal="true" aria-labelledby="compose-panel-title">' +
        '<div class="compose-panel__resize-grip" aria-label="Redimensionar" title="Arrastrá para redimensionar"></div>' +
        '<div class="compose-panel__titlebar">' +
          '<h3 class="compose-panel__title" id="compose-panel-title">' + (isReply ? (mode === "replyAll" ? "Responder a todos" : "Responder") : isForward ? "Reenviar" : "Nuevo correo") + '</h3>' +
          '<div class="compose-panel__actions">' +
            '<button class="compose-panel__btn compose-panel__btn--minimize" type="button" aria-label="Minimizar" title="Minimizar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>' +
            '<button class="compose-panel__btn compose-panel__btn--maximize" type="button" aria-label="Maximizar" title="Restaurar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="1"></rect></svg></button>' +
            '<button class="compose-panel__btn compose-panel__btn--close" aria-label="Cerrar" title="Cerrar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>' +
          '</div>' +
        '</div>' +
        '<div class="compose-panel__body">' +
          '<div class="compose-panel__recipients" id="compose-to-recipients" data-target="compose-to">' +
            (toValue ? toValue.split(",").map(function (e) { e = e.trim(); if (!e) return ""; var display = e.replace(/[<>]/g, ""); return '<span class="compose-panel__chip" data-email="' + display.replace(/"/g, """) + '"><span class="compose-panel__chip-avatar">' + (display.charAt(0) || "?").toUpperCase() + '</span><span class="compose-panel__chip-name">' + display.replace(/</g, "<") + '</span><span class="compose-panel__chip-remove" role="button" aria-label="Quitar">&times;</span></span>'; }).join("") : "") +
            '<input type="text" class="compose-panel__chip-input" id="compose-to" placeholder="Para" autocomplete="off" />' +
          '</div>' +
          '<div class="compose-panel__autocomplete" id="compose-to-autocomplete" hidden></div>' +
          (mode === "replyAll" ? '<div class="compose-panel__recipients" id="compose-cc-recipients" data-target="compose-cc">' +
            (ccValue ? ccValue.split(",").map(function (e) { e = e.trim(); if (!e) return ""; var display = e.replace(/[<>]/g, ""); return '<span class="compose-panel__chip" data-email="' + display.replace(/"/g, """) + '"><span class="compose-panel__chip-avatar">' + (display.charAt(0) || "?").toUpperCase() + '</span><span class="compose-panel__chip-name">' + display.replace(/</g, "<") + '</span><span class="compose-panel__chip-remove" role="button" aria-label="Quitar">&times;</span></span>'; }).join("") : "") +
            '<input type="text" class="compose-panel__chip-input" id="compose-cc" placeholder="CC" autocomplete="off" />' +
          '</div><div class="compose-panel__autocomplete" id="compose-cc-autocomplete" hidden></div>' : "") +
          '<input type="text" class="compose-panel__input" id="compose-subject" value="' + subjectValue.replace(/"/g, """) + '" placeholder="Asunto" autocomplete="off" />' +
          '<div class="compose-panel__field compose-panel__field--body" id="compose-body-field">' +
            quoteHtml +
            '<textarea class="compose-panel__textarea" id="compose-body"></textarea>' +
            '<div class="compose-panel__dropzone" id="compose-dropzone"><div class="compose-panel__dropzone-hint">Soltá los archivos para adjuntar</div></div>' +
            '<div class="compose-panel__attachments" id="compose-attachments"></div>' +
          '</div>' +
        '</div>' +
        '<div class="compose-panel__toolbar">' +
          '<button class="compose-panel__toolbar__btn" type="button" title="Adjuntar archivo" id="compose-attach-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg></button>' +
          '<input type="file" id="compose-attachments-input" multiple hidden />' +
          '<button class="compose-panel__toolbar__btn" type="button" title="Insertar link" disabled><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></button>' +
          '<button class="compose-panel__toolbar__btn" type="button" title="Emoji" disabled><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg></button>' +
          '<span class="compose-panel__toolbar__sep"></span>' +
          '<button class="compose-panel__toolbar__btn" type="button" title="Firma" disabled><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17c0-1.66 3.58-3 8-3s8 1.34 8 3v3H3v-3z"></path><circle cx="12" cy="7" r="4"></circle></svg></button>' +
        '</div>' +
        '<div class="compose-panel__footer">' +
          '<button class="compose-panel__send" type="button" id="compose-send-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Enviar</button>' +
          '<span class="compose-panel__hint">Ctrl+Enter para enviar · ESC para cerrar</span>' +
        '</div>' +
      '</div>';

      document.body.appendChild(modal);

      // Wire events
      var closeModal = function () { if (modal.parentNode) modal.parentNode.removeChild(modal); };
      var panel = modal.querySelector(".compose-panel");
      var minimizeBtn = modal.querySelector(".compose-panel__btn--minimize");
      var maximizeBtn = modal.querySelector(".compose-panel__btn--maximize");
      var closeBtn = modal.querySelector(".compose-panel__btn--close");
      var titlebar = modal.querySelector(".compose-panel__titlebar");

      // Resize grip
      (function () {
        var grip = panel.querySelector(".compose-panel__resize-grip");
        if (!grip) return;
        var minW = 400, minH = 360;
        var dragging = false, startX, startY, startW, startH;
        grip.addEventListener("mousedown", function (e) { dragging = true; startX = e.clientX; startY = e.clientY; startW = panel.offsetWidth; startH = panel.offsetHeight; e.preventDefault(); });
        document.addEventListener("mousemove", function (e) { if (!dragging) return; var w = Math.max(400, startW + (e.clientX - startX)); var h = Math.max(360, startH + (e.clientY - startY)); panel.style.width = w + "px"; panel.style.height = h + "px"; });
        document.addEventListener("mouseup", function () { dragging = false; });
      })();

      // Minimize / maximize / close
      minimizeBtn.addEventListener("click", function () { panel.classList.add("compose-panel--minimized"); modal.classList.add("compose-panel-overlay--hidden"); });
      maximizeBtn.addEventListener("click", function () { panel.classList.remove("compose-panel--minimized"); modal.classList.remove("compose-panel-overlay--hidden"); });
      closeBtn.addEventListener("click", closeModal);

      // Drag to move
      (function () {
        var dragging = false, offsetX, offsetY;
        titlebar.addEventListener("mousedown", function (e) { if (e.target === titlebar || e.target === panel) { dragging = true; offsetX = e.clientX - panel.offsetLeft; offsetY = e.clientY - panel.offsetTop; e.preventDefault(); } });
        document.addEventListener("mousemove", function (e) { if (!dragging) return; panel.style.left = (e.clientX - offsetX) + "px"; panel.style.top = (e.clientY - offsetY) + "px"; });
        document.addEventListener("mouseup", function () { dragging = false; });
      })();

      // Keyboard
      document.addEventListener("keydown", function (e) {
        if (panel.classList.contains("compose-panel--minimized") && !e.target.closest(".compose-panel__btn")) { return; }
        if (e.key === "Escape" && !panel.classList.contains("compose-panel--minimized")) { closeModal(); }
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { modal.querySelector("#compose-send-btn").click(); }
      });

      // Focus body
      setTimeout(function () {
        var textarea = modal.querySelector("#compose-body");
        if (textarea) { textarea.focus(); var len = textarea.value.length; textarea.setSelectionRange(len, len); }
      }, 50);

      // Attachments
      pendingAttachments = [];
      var bodyField = modal.querySelector("#compose-body-field");
      var dropzone = modal.querySelector("#compose-dropzone");
      var attachBtn = modal.querySelector("#compose-attach-btn");
      var fileInput = modal.querySelector("#compose-attachments-input");
      var bodyField = modal.querySelector("#compose-body-field");
      var dropzone = modal.querySelector("#compose-dropzone");

      if (attachBtn && fileInput) {
        attachBtn.addEventListener("click", function () { fileInput.click(); });
        fileInput.addEventListener("change", function (e) { var files = e.target.files; if (files && files.length > 0) addAttachments(files); fileInput.value = ""; });
      }
      if (bodyField) {
        bodyField.addEventListener("dragenter", function (e) { e.preventDefault(); e.stopPropagation(); dropzone.classList.add("compose-panel__dropzone--active"); });
        bodyField.addEventListener("dragover", function (e) { e.preventDefault(); e.stopPropagation(); dropzone.classList.add("compose-panel__dropzone--active"); });
        bodyField.addEventListener("dragleave", function (e) { e.preventDefault(); e.stopPropagation(); if (!e.relatedTarget || !bodyField.contains(e.relatedTarget)) dropzone.classList.remove("compose-panel__dropzone--active"); });
        bodyField.addEventListener("drop", function (e) { e.preventDefault(); e.stopPropagation(); dropzone.classList.remove("compose-panel__dropzone--active"); var files = e.dataTransfer ? e.dataTransfer.files : null; if (files && files.length > 0) addAttachments(files); });
      }

      function addAttachments(files) {
        for (var i = 0; i < files.length; i++) {
          var file = files[i];
          if (file.size > 25 * 1024 * 1024) { window.BandejaHelpers.toast("Archivo demasiado grande", file.name + " (" + (file.size / 1024 / 1024).toFixed(1) + " MB) excede el límite de Gmail (25 MB)", "error"); return; }
          pendingAttachments.push(file);
          var container = document.getElementById("compose-attachments");
          var attEl = H.el("div", { class: "compose-panel__attachment", "data-idx": pendingAttachments.length - 1 });
          attEl.innerHTML = '<span class="compose-panel__attachment-icon">📎</span><span class="compose-panel__attachment-name">' + H.esc(file.name) + '</span><span class="compose-panel__attachment-size">' + formatAttachmentSize(file.size) + '</span><button class="compose-panel__attachment-remove" type="button" data-idx="' + (pendingAttachments.length - 1) + '" title="Quitar">×</button>';
          container.appendChild(attEl);
          attEl.querySelector(".compose-panel__attachment-remove").addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); var idx = parseInt(this.getAttribute("data-idx"), 10); pendingAttachments.splice(idx, 1); renderAttachments(); });
        }
      }

      function renderAttachments() {
        var container = document.getElementById("compose-attachments");
        container.innerHTML = "";
        pendingAttachments.forEach(function (file, i) {
          var attEl = H.el("div", { class: "compose-panel__attachment", "data-idx": i });
          attEl.innerHTML = '<span class="compose-panel__attachment-icon">📎</span><span class="compose-panel__attachment-name">' + H.esc(file.name) + '</span><span class="compose-panel__attachment-size">' + window.BandejaHelpers.formatAttachmentSize(file.size) + '</span><button class="compose-panel__attachment-remove" type="button" data-idx="' + i + '" title="Quitar">×</button>';
          container.appendChild(attEl);
          attEl.querySelector(".compose-panel__attachment-remove").addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); pendingAttachments.splice(i, 1); renderAttachments(); });
        });
      }

      function formatAttachmentSize(bytes) {
        if (!bytes || bytes < 0) return "—";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
        if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
        return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
      }

      // Autocomplete
      var contactIndex = {}, subjectIndex = {};
      (function () { if (!Array.isArray(S.mails)) return; S.mails.forEach(function (m) { if (m.senderEmail) { var k = m.senderEmail.toLowerCase(); if (!contactIndex[k]) contactIndex[k] = { name: m.sender || m.senderEmail, count: 0 }; contactIndex[k].count++; } [["to_list", "to"], ["cc_list", "cc"]].forEach(function (pair) { var arr = m[pair[0]]; if (!Array.isArray(arr)) return; arr.forEach(function (a) { var email = typeof a === "string" ? a : (a && a.email); var name = typeof a === "string" ? null : (a && a.name); if (!email) return; var k = email.toLowerCase(); if (!contactIndex[k]) contactIndex[k] = { name: name || email, count: 0 }; contactIndex[k].count++; if (name && (!contactIndex[k].name || contactIndex[k].name === email)) contactIndex[k].name = name; }); }); if (m.subject) { var s = m.subject.replace(/^(\s*(Re|Fwd|RE|FW)\s*:\s*)+/i, "").trim(); if (s && s.length > 3) { if (!subjectIndex[s]) subjectIndex[s] = { count: 0 }; subjectIndex[s].count++; } } }); })();

      function renderAutocomplete(inputEl, dropdownEl, type) {
        var query = (inputEl.value || "").split(",").pop().trim().toLowerCase();
        dropdownEl.innerHTML = "";
        if (query.length < 2) { dropdownEl.hidden = true; return; }
        var suggestions = [];
        if (type === "contact") {
          Object.keys(contactIndex).forEach(function (k) { if (k.indexOf(query) >= 0 || (contactIndex[k].name && contactIndex[k].name.toLowerCase().indexOf(query) >= 0)) suggestions.push({ email: k, name: contactIndex[k].name, count: contactIndex[k].count }); });
          suggestions.sort(function (a, b) { return b.count - a.count; });
          suggestions = suggestions.slice(0, 5);
          if (suggestions.length === 0) { dropdownEl.hidden = true; return; }
          dropdownEl.innerHTML = suggestions.map(function (s) { return '<div class="compose-panel__autocomplete-item" data-email="' + H.esc(s.email) + '"><div class="compose-panel__autocomplete-avatar">' + H.esc((s.name || s.email).substring(0, 1).toUpperCase()) + '</div><div class="compose-panel__autocomplete-info"><div class="compose-panel__autocomplete-name">' + H.esc(s.name || s.email) + '</div><div class="compose-panel__autocomplete-email">' + H.esc(s.email) + '</div></div><div class="compose-panel__autocomplete-count">' + s.count + "×</div>"; }).join("");
        }
        var items = dropdownEl.querySelectorAll(".compose-panel__autocomplete-item");
        items.forEach(function (item) { item.addEventListener("mousedown", function (e) { e.preventDefault(); if (type === "contact") { var email = item.getAttribute("data-email"); var nameEl = item.querySelector(".compose-panel__autocomplete-name"); var displayName = nameEl ? nameEl.textContent : email; inputEl.value = ""; addChip(inputEl, email, displayName); } dropdownEl.hidden = true; inputEl.focus(); }); });
        dropdownEl.hidden = false;
      }

      function updateContainerHasChips(container) { if (!container) return; if (container.querySelectorAll(".compose-panel__chip").length > 0) container.classList.add("has-chips"); else container.classList.remove("has-chips"); }
      function addChip(inputEl, email, displayName) {
        var container = inputEl.parentElement; if (!container || !container.classList.contains("compose-panel__recipients")) return;
        var exists = false; container.querySelectorAll(".compose-panel__chip").forEach(function (c) { if (c.getAttribute("data-email") === email) exists = true; }); if (exists) { inputEl.value = ""; return; }
        var chip = document.createElement("span"); chip.className = "compose-panel__chip"; chip.setAttribute("data-email", email); var initial = (displayName || email).charAt(0).toUpperCase(); chip.innerHTML = '<span class="compose-panel__chip-avatar">' + H.esc(initial) + '</span><span class="compose-panel__chip-name">' + H.esc(displayName || email) + '</span><span class="compose-panel__chip-remove" role="button" aria-label="Quitar">&times;</span>'; container.insertBefore(chip, inputEl); updateContainerHasChips(container); chip.querySelector(".compose-panel__chip-remove").addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); chip.remove(); updateContainerHasChips(container); });
      }
      function wireBackspaceRemoval(inputEl) { inputEl.addEventListener("keydown", function (e) { if (e.key === "Backspace" && inputEl.value === "") { var container = inputEl.parentElement; if (!container) return; var chips = container.querySelectorAll(".compose-panel__chip"); if (chips.length > 0) { chips[chips.length - 1].remove(); e.preventDefault(); } } }); }
      function wireCommitOnSeparator(inputEl) { inputEl.addEventListener("keydown", function (e) { if (e.key === "," || e.key === "Enter") { var text = inputEl.value.trim(); if (text) { var m = text.match(/<([^>]+)>/); var email = m ? m[1] : text; var name = m ? text.replace(/<[^>]+>/, "").trim() : email; addChip(inputEl, email, name); inputEl.value = ""; e.preventDefault(); } } }); inputEl.addEventListener("blur", function () { var text = inputEl.value.trim(); if (text) { var m = text.match(/<([^>]+)>/); var email = m ? m[1] : text; var name = m ? text.replace(/<[^>]+>/, "").trim() : email; addChip(inputEl, email, name); inputEl.value = ""; } }); }

      var toInput = modal.querySelector("#compose-to");
      var toDropdown = modal.querySelector("#compose-to-autocomplete");
      var ccInput = modal.querySelector("#compose-cc");
      var ccDropdown = modal.querySelector("#compose-cc-autocomplete");
      var toContainer = modal.querySelector("#compose-to-recipients");
      if (toContainer) { updateContainerHasChips(toContainer); toContainer.querySelectorAll(".compose-panel__chip-remove").forEach(function (btn) { btn.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); btn.closest(".compose-panel__chip").remove(); updateContainerHasChips(toContainer); }); }); }
      var ccContainer = modal.querySelector("#compose-cc-recipients");
      if (ccContainer) { updateContainerHasChips(ccContainer); ccContainer.querySelectorAll(".compose-panel__chip-remove").forEach(function (btn) { btn.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); btn.closest(".compose-panel__chip").remove(); updateContainerHasChips(ccContainer); }); }); }
      if (toInput && toDropdown) { toInput.addEventListener("input", function () { renderAutocomplete(toInput, toDropdown, "contact"); }); toInput.addEventListener("blur", function () { setTimeout(function () { toDropdown.hidden = true; }, 200); }); toInput.addEventListener("focus", function () { renderAutocomplete(toInput, toDropdown, "contact"); }); toInput.addEventListener("keydown", function (e) { if (e.key === "Tab") { var first = toDropdown.querySelector(".compose-panel__autocomplete-item"); if (first) { e.preventDefault(); first.dispatchEvent(new MouseEvent("mousedown")); } } if (e.key === "Enter") { if (!toDropdown.hidden) { var firstEnter = toDropdown.querySelector(".compose-panel__autocomplete-item"); if (firstEnter) { e.preventDefault(); firstEnter.dispatchEvent(new MouseEvent("mousedown")); } } } }); wireCommitOnSeparator(toInput); wireBackspaceRemoval(toInput); }
      if (ccInput && ccDropdown) { ccInput.addEventListener("input", function () { renderAutocomplete(ccInput, ccDropdown, "contact"); }); ccInput.addEventListener("blur", function () { setTimeout(function () { ccDropdown.hidden = true; }, 200); }); ccInput.addEventListener("focus", function () { renderAutocomplete(ccInput, ccDropdown, "contact"); }); wireCommitOnSeparator(ccInput); wireBackspaceRemoval(ccInput); }

      // Send
      modal.querySelector("#compose-send-btn").addEventListener("click", function () {
        function gatherEmails(containerId, inputId) {
          var container = modal.querySelector("#" + containerId);
          var input = modal.querySelector("#" + inputId);
          var emails = [];
          if (container) container.querySelectorAll(".compose-panel__chip").forEach(function (chip) { var e = chip.getAttribute("data-email"); if (e) emails.push(e); });
          if (input && input.value.trim()) input.value.split(",").forEach(function (e) { var t = e.trim(); if (t && emails.indexOf(t) === -1) emails.push(t); });
          return emails.join(", ");
        }
        sendComposedMail({
          to: gatherEmails("compose-to-recipients", "compose-to"),
          cc: mode === "replyAll" ? gatherEmails("compose-cc-recipients", "compose-cc") : "",
          subject: modal.querySelector("#compose-subject").value,
          body: modal.querySelector("#compose-body").value,
          replyToMail: mail,
          isReply: isReply,
          isForward: isForward,
          threadId: mail ? mail.threadId : null,
          attachments: pendingAttachments,
          closeModal: closeModal
        });
      });

      window.BandejaComposeModal.open = window.BandejaComposeModal.open || function () { };
    }
  };

  function sendComposedMail(opts) {
    var api = window.BandejaHelpers.getElectronAPI();
    if (!api || !api.googleGmail || !api.googleGmail.sendMessage) { window.BandejaHelpers.toast("Error", "Gmail no está conectado", "error"); return; }
    if (!opts.to || !opts.to.trim()) { window.BandejaHelpers.toast("Error", "Falta el destinatario", "error"); return; }

    var sendBtn = document.querySelector("#compose-send-btn");
    var originalText = sendBtn ? sendBtn.innerHTML : "";
    if (sendBtn) { sendBtn.disabled = true; sendBtn.innerHTML = "Enviando..."; }

    try {
      var attachmentsPayload = [];
      if (opts.attachments && opts.attachments.length > 0) {
        for (var i = 0; i < opts.attachments.length; i++) {
          var file = opts.attachments[i];
          if (file.size > 25 * 1024 * 1024) { window.BandejaHelpers.toast("Archivo demasiado grande", file.name + " (" + (file.size / 1024 / 1024).toFixed(1) + " MB) excede el límite de Gmail (25 MB)", "error"); if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = originalText; } return; }
          var base64Data = new Promise(function (resolve, reject) { var reader = new FileReader(); reader.onload = function () { var result = reader.result; var parts = result.split(","); resolve(parts.length > 1 ? parts[1] : result); }; reader.onerror = function () { reject(reader.error || new Error("Error leyendo archivo")); }; reader.readAsDataURL(file); });
          attachmentsPayload.push({ name: file.name, mimeType: file.type || "application/octet-stream", data: await base64Data });
        }
      }

      var inReplyTo = "", references = "";
      if (opts.isReply && opts.replyToMail) {
        var lastMsg = null;
        if (opts.replyToMail.messages && opts.replyToMail.messages.length > 0) lastMsg = opts.replyToMail.messages[opts.replyToMail.messages.length - 1];
        else if (opts.replyToMail.thread && opts.replyToMail.thread.messages && opts.replyToMail.thread.messages.length > 0) lastMsg = opts.replyToMail.thread.messages[opts.replyToMail.thread.messages.length - 1];
        if (lastMsg && lastMsg.id) { inReplyTo = lastMsg.id; var refs = (lastMsg.references_header || "").trim(); references = refs ? refs + " " + lastMsg.id : lastMsg.id; }
      }

      var signature = localStorage.getItem("kair.emailSignature") || "";
      var quotedText = "";
      if (opts.isReply && opts.replyToMail && opts.replyToMail.body) {
        var originalBody = opts.replyToMail.body;
        quotedText = "\n\n" + originalBody.split("\n").map(function (line) { return "> " + line; }).join("\n");
      } else if (opts.isForward && opts.replyToMail && opts.replyToMail.body) {
        var fwdSender = (opts.replyToMail.sender || "") + (opts.replyToMail.senderEmail ? " <" + opts.replyToMail.senderEmail + ">" : "");
        var fwdDate = opts.replyToMail.date ? window.BandejaHelpers.formatGmailDate(opts.replyToMail.date) : "";
        quotedText = "\n\n-------- Mensaje original --------\nDe: " + fwdSender + "\nFecha: " + fwdDate + "\nAsunto: " + (opts.replyToMail.subject || "") + "\n\n" + opts.replyToMail.body;
      }

      var bodyWithQuoteAndSignature = opts.body + quotedText;
      if (signature && !opts.isForward) { bodyWithQuoteAndSignature = bodyWithQuoteAndSignature + "\n\n--\n" + signature; }

      api.googleGmail.sendMessage({
        from: S.gmailEmail || undefined,
        to: opts.to.trim(),
        cc: opts.cc ? opts.cc.trim() : undefined,
        subject: opts.subject || "(sin asunto)",
        body: bodyWithQuoteAndSignature,
        inReplyTo: inReplyTo,
        references: references,
        threadId: opts.threadId || undefined,
        attachments: attachmentsPayload
      }).then(function (result) {
        if (result && result.success) {
          window.BandejaHelpers.showUndoToast("Mensaje enviado", function () { window.BandejaHelpers.toast("Para deshacer", "Abrí Gmail → Enviados y eliminá el mensaje manualmente", "info"); });
          opts.closeModal();
          if (api.emailCache && api.emailCache.syncInbox) {
            api.emailCache.syncInbox({ folder: "INBOX", maxResults: 25 }).then(function () { return api.emailCache.getThreads({ folder: "INBOX", maxResults: 25 }); }).then(function (cacheResult) { if (cacheResult && cacheResult.success && Array.isArray(cacheResult.data)) { if (S.mails && S.mails.length > 0) { var __oldMailsById = {}; for (var __mi = 0; __mi < S.mails.length; __mi++) __oldMailsById[S.mails[__mi].id] = S.mails[__mi]; S.mails = cacheResult.data.map(function (thread) { var __newMail = window.BandejaMailOps.threadToMail(thread); var __oldMail = __oldMailsById[__newMail.id]; if (__oldMail) { if (__oldMail.unread === false && __newMail.unread === true) __newMail.unread = false; if (__oldMail.flagged === true && __newMail.flagged === false) __newMail.flagged = true; } return __newMail; }); } else { S.mails = cacheResult.data.map(window.BandejaMailOps.threadToMail); } window.BandejaRenderMailList.render(document.getElementById("mail-list-container")); } }).catch(function (e) { console.warn("[BandejaIntegrada] Error refrescando cache post-envío:", e.message); });
          } catch (e) {
            console.error("[BandejaIntegrada] Error en sendComposedMail:", e);
            window.BandejaHelpers.toast("Error al enviar", e.message || "Error desconocido", "error");
            if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = originalText; sendBtn.style.display = ""; }
          }
    }
  })();
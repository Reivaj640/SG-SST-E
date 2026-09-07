/* ============================================================
 * K+AIR Bandeja Integrada — Render Mail Detail
 * ============================================================ */

(function () {
  "use strict";

  const H = window.BandejaHelpers;
  const S = window.BandejaState;
  const D = window.KairData;

  function isThreadSnoozed(threadId) {
    return S.snoozedThreads && S.snoozedThreads.has(threadId);
  }

  function unsnoozeThread(threadId) {
    if (S.snoozedThreads) S.snoozedThreads.delete(threadId);
  }

  function showSnoozeToast(threadId) {
    var node = H.el("div", { class: "kair-snooze-toast", style: { position: "fixed", bottom: "20px", right: "20px", zIndex: 9999, background: "var(--kair-bg-card)", border: "1px solid var(--kair-border)", borderRadius: "8px", padding: "12px 16px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", minWidth: "280px" } });
    node.innerHTML = '<div style="font-weight:600;margin-bottom:8px;">Posponer correo</div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">' +
      '<button data-later class="kair-btn kair-btn--ghost" style="font-size:0.8125rem;">Más tarde</button>' +
      '<button data-tomorrow class="kair-btn kair-btn--ghost" style="font-size:0.8125rem;">Mañana 9am</button>' +
      '<button data-week class="kair-btn kair-btn--ghost" style="font-size:0.8125rem;">Próxima semana</button>' +
      '</div>';
    document.body.appendChild(node);
    node.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var wakeTime = Date.now();
        if (btn.hasAttribute("data-later")) wakeTime += 3 * 60 * 60 * 1000;
        else if (btn.hasAttribute("data-tomorrow")) { var tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0); wakeTime = tomorrow.getTime(); }
        else if (btn.hasAttribute("data-week")) wakeTime += 7 * 24 * 60 * 60 * 1000;
        window.BandejaMailOps.snoozeThread(S.selectedMailId, wakeTime);
        if (node.parentNode) node.parentNode.removeChild(node);
        window.BandejaHelpers.toast("Correo pospuesto", "Vuelve " + window.BandejaHelpers.getSnoozeRemainingLabel(wakeTime), "success");
      });
    });
    setTimeout(function () {
      document.addEventListener("click", function closeOnOutside(e) {
        if (!node.contains(e.target)) { if (node.parentNode) node.parentNode.removeChild(node); document.removeEventListener("click", closeOnOutside); }
      });
    }, 100);
  }

  function getMailDisplayContact(mail) {
    var isSentFolder = S.mailFolder === "SENT";
    var contact = mail.to_list && mail.to_list.length > 0 ? mail.to_list[0] : (mail.cc_list && mail.cc_list.length > 0 ? mail.cc_list[0] : { name: mail.sender || "", email: mail.senderEmail || "" });
    if (isSentFolder) return contact;
    return { name: mail.sender || mail.senderEmail || "", email: mail.senderEmail || "" };
  }

  function initials(name) {
    if (!name) return "?";
    return name.split(" ").map(function (p) { return p[0]; }).filter(function (c) { return c; }).slice(0, 2).join("").toUpperCase() || "?";
  }

  function escapeHtml(s) { return String(s || "").replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, """).replace(/'/g, "'"); }

  function formatGmailDate(dateVal, withTime) {
    return window.BandejaHelpers.formatGmailDate(dateVal, withTime);
  }

  function formatGmailLongDate(dateVal) {
    return window.BandejaHelpers.formatGmailLongDate(dateVal);
  }

  function formatRelativeTime(dateVal) {
    return window.BandejaHelpers.formatRelativeTime(dateVal);
  }

  function renderMailSecurityStatus(security) {
    if (!security) return '<span style="color:var(--kair-text-muted);">—</span>';
    var parts = [];
    if (security.spf) parts.push('<span class="kair-badge kair-badge--' + (security.spf === "pass" ? "success" : security.spf === "fail" ? "danger" : "neutral") + '">SPF ' + security.spf + '</span>');
    if (security.dkim) parts.push('<span class="kair-badge kair-badge--' + (security.dkim === "pass" ? "success" : security.dkim === "fail" ? "danger" : "neutral") + '">DKIM ' + security.dkim + '</span>');
    if (security.dmarc) parts.push('<span class="kair-badge kair-badge--' + (security.dmarc === "pass" ? "success" : security.dmarc === "fail" ? "danger" : "neutral") + '">DMARC ' + security.dmarc + '</span>');
    if (security.arc) parts.push('<span class="kair-badge kair-badge--' + (security.arc === "pass" ? "success" : security.arc === "fail" ? "danger" : "neutral") + '">ARC ' + security.arc + '</span>');
    if (security.encryptedWith) parts.push('<span class="kair-badge kair-badge--info">TLS: ' + security.encryptedWith + '</span>');
    return parts.join(" ");
  }

  window.BandejaRenderMailDetail = {
    render: function (container) {
      var S = window.BandejaState;
      var api = window.BandejaHelpers.getElectronAPI();
      container.innerHTML = "";
      var mail = S.mails.find(function (m) { return m.id === S.selectedMailId; });

      if (mail && !mail.body && !mail.messages && !mail._loadingBody) {
        mail._loadingBody = true;
        window.BandejaMailOps.loadMailBodyFromCache(mail).then(function () { if (mail) mail._loadingBody = false; });
      }

      if (!mail) {
        var empty = H.el("div", { class: "kair-mail-empty", style: { height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" } });
        empty.innerHTML = '<div class="kair-mail-empty__icon">' + D.ICONS.mailOpen.replace(/width="\d+" height="\d+"/, 'width="28" height="28"') + '</div>' +
          '<p style="font-size:0.875rem;font-weight:600;color:var(--kair-text-muted);margin:0 0 4px;">Seleccione un mensaje para leerlo</p>' +
          '<p style="font-size:0.75rem;color:var(--kair-text-light);margin:0;">La conversación aparecerá aquí</p>';
        container.appendChild(empty);
        return;
      }

      var detail = H.el("div", { class: "kair-mail-detail" });

      // Toolbar
      var toolbar = H.el("div", { class: "kair-mail-detail__toolbar" });
      var iconBtn = function (icon, title, handler) {
        var b = H.el("button", { class: "kair-icon-btn", title: title, "aria-label": title });
        b.innerHTML = icon;
        if (handler) b.addEventListener("click", handler);
        return b;
      };
      toolbar.appendChild(iconBtn(D.ICONS.archive, "Archivar", function () {
        var api = window.BandejaHelpers.getElectronAPI();
        if (api && api.googleGmail && api.googleGmail.archiveThread) {
          api.googleGmail.archiveThread({ threadId: mail.id }).then(function (r) {
            if (r && r.success) { S.mails = S.mails.filter(function (m) { return m.id !== mail.id; }); S.selectedMailId = null; window.BandejaRenderMailList.render(document.getElementById("mail-list-container")); window.BandejaHelpers.toast("Archivado", "El correo fue movido a Archivados en Gmail", "success"); }
            else { window.BandejaHelpers.toast("Error al archivar", (r && r.error) || "Error desconocido", "error"); }
          }).catch(function (e) { window.BandejaHelpers.toast("Error al archivar", e.message, "error"); });
        }));
      toolbar.appendChild(iconBtn(D.ICONS.mailOpen, "Marcar como no leído", function () { mail.unread = !mail.unread; window.BandejaRenderMailDetail.render(document.getElementById("mail-detail-container")); }));
      toolbar.appendChild(iconBtn(D.ICONS.trash, "Eliminar"));
      var isAlreadySnoozed = isThreadSnoozed(S.selectedMailId);
      toolbar.appendChild(iconBtn(D.ICONS.clock || '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>', isAlreadySnoozed ? "Desnoozear" : "Posponer", function () {
        if (isAlreadySnoozed) { unsnoozeThread(S.selectedMailId); window.BandejaRenderMailDetail.render(document.getElementById("mail-detail-container")); window.BandejaHelpers.toast("Desnoozeado", "El correo volvió a la bandeja", "info"); }
        else { showSnoozeToast(S.selectedMailId); }
      }));
      toolbar.appendChild(H.el("span", { class: "kair-header__divider", style: { margin: "0 4px" } }));
      toolbar.appendChild(iconBtn(D.ICONS.reply, "Responder", function () { window.BandejaComposeModal.open("reply", mail); }));
      toolbar.appendChild(iconBtn(D.ICONS.forward, "Reenviar", function () { window.BandejaComposeModal.open("forward", mail); }));
      toolbar.appendChild(H.el("span", { class: "kair-header__divider", style: { margin: "0 4px" } }));
      toolbar.appendChild(iconBtn(D.ICONS.more, "Más opciones"));

      var nav = H.el("div", { class: "ml-auto", style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px" } });
      nav.appendChild(iconBtn(D.ICONS.chevronUp, "Más reciente"));
      nav.appendChild(iconBtn(D.ICONS.chevronRight.replace(/polyline points="9 18 15 12 9 6"/, 'polyline points="6 9 12 15 18 9"'), "Más antiguo"));
      toolbar.appendChild(nav);
      detail.appendChild(toolbar);

      // Scroll area
      var scroll = H.el("div", { class: "overflow-y-auto kair-scroll", style: { overflowY: "auto", minHeight: "0" } });

      // Header
      var header = H.el("div", { class: "kair-mail-detail__header" });
      var tag = mail.category === "meeting" ? '<span class="kair-mail-tag kair-mail-tag--meeting">Reunión</span>' : mail.category === "urgent" ? '<span class="kair-mail-tag kair-mail-tag--urgent">Urgente</span>' : "";

      var labelsHtml = "";
      if (mail.label_ids && mail.label_ids.length > 0) {
        var userLabels = mail.label_ids.map(function (lid) {
          var lbl = S.labels.find(function (l) { return l.id === lid; });
          if (!lbl) return null;
          if (lbl.type === "user" || lbl.id === "STARRED" || lbl.id === "IMPORTANT") {
            return '<span class="kair-mail-label-chip" style="background:' + lbl.color_background + ";color:" + lbl.color_text + ';">' + lbl.name + '</span>';
          }
          return null;
        }).filter(function (x) { return x; }).join(" ");
        labelsHtml = userLabels ? '<div class="kair-mail-detail__labels" style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap;">' + userLabels + '</div>' : "";
      }

      var folderLabel = (S.mailFolder === "SENT") ? "Enviados" : (S.mailFolder === "DRAFT") ? "Borradores" : "Recibidos";
      var folderChipHtml = '<span class="kair-mail-detail__folder-label" title="Click para quitar el filtro de carpeta">' + folderLabel +
        '<button class="kair-mail-detail__folder-remove" type="button" aria-label="Quitar filtro" title="Quitar"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></span>';

      var recipientsHtml = "";
      if (mail.to_list && mail.to_list.length > 0) {
        var toText = mail.to_list.map(function (a) { return a.name || a.email; }).join(", ");
        recipientsHtml += '<div class="kair-mail-detail__recipient-row"><span class="kair-mail-detail__recipient-label">Para:</span> <span class="kair-mail-detail__recipient-value">' + H.esc(toText) + '</span></div>';
      }
      if (mail.cc_list && mail.cc_list.length > 0) {
        var ccText = mail.cc_list.map(function (a) { return a.name || a.email; }).join(", ");
        recipientsHtml += '<div class="kair-mail-detail__recipient-row"><span class="kair-mail-detail__recipient-label">CC:</span> <span class="kair-mail-detail__recipient-value">' + H.esc(ccText) + '</span></div>';
      }

      var detailDisplayContact = window.BandejaHelpers.getMailDisplayContact(mail);
      var isSentFolder = S.mailFolder === "SENT";
      var senderSecondaryLine = "";
      if (isSentFolder && mail.sender) {
        senderSecondaryLine = '<p class="kair-mail-detail__sender-meta" style="margin:2px 0 0;font-size:0.7rem;color:var(--kair-text-light);">de: ' + H.esc(mail.sender) + (mail.senderEmail ? " <" + H.esc(mail.senderEmail) + ">" : "") + "</p>";
      }

      header.innerHTML = '<h2 class="kair-mail-detail__subject"><span style="flex:1;">' + mail.subject + '</span>' + folderChipHtml + '<span class="kair-mail-detail__tags">' + tag + '</span></h2>' +
        '<div class="kair-mail-detail__sender-row">' +
          '<div class="kair-mail-detail__avatar" style="background:' + mail.avatarColor + ';">' + initials(detailDisplayContact.name || detailDisplayContact.email) + '</div>' +
          '<div class="kair-mail-detail__sender-info">' +
            '<p class="kair-mail-detail__sender-name">' + H.esc(detailDisplayContact.name || detailDisplayContact.email || "") + ' <span style="font-weight:400;color:var(--kair-text-muted);"><' + H.esc(detailDisplayContact.email || "") + '></span></p>' +
            senderSecondaryLine +
            '<div class="kair-mail-detail__recipients">' + recipientsHtml + '</div>' +
            '<button class="kair-mail-detail__show-details" type="button" aria-label="Mostrar detalles" aria-expanded="false" data-action="toggle-details">Mostrar detalles</button>' +
            '<div class="kair-mail-detail__details-panel" id="mail-details-panel" hidden>' +
              '<dl class="kair-mail-detail__details-list">' +
                (isSentFolder
                  ? (mail.to_list && mail.to_list.length > 0 ? '<dt>para</dt><dd>' + mail.to_list.map(function (a) { return H.esc((a.name ? a.name + " <" + a.email + ">" : a.email)); }).join(", ") + "</dd>" : "") +
                    (mail.cc_list && mail.cc_list.length > 0 ? '<dt>cc</dt><dd>' + mail.cc_list.map(function (a) { return H.esc((a.name ? a.name + " <" + a.email + ">" : a.email)); }).join(", ") + "</dd>" : "") +
                    '<dt>de</dt><dd>' + H.esc(mail.sender || "") + " <" + H.esc(mail.senderEmail || "") + "></dd>"
                  : '<dt>de</dt><dd>' + H.esc(mail.sender || "") + " <" + H.esc(mail.senderEmail || "") + "></dd>" +
                    (mail.to_list && mail.to_list.length > 0 ? '<dt>para</dt><dd>' + mail.to_list.map(function (a) { return H.esc((a.name ? a.name + " <" + a.email + ">" : a.email)); }).join(", ") + "</dd>" : "") +
                    (mail.cc_list && mail.cc_list.length > 0 ? '<dt>cc</dt><dd>' + mail.cc_list.map(function (a) { return H.esc((a.name ? a.name + " <" + a.email + ">" : a.email)); }).join(", ") + "</dd>" : '')
                ) +
                '<dt>fecha</dt><dd>' + H.esc(formatGmailLongDate(mail.date)) + '</dd>' +
                '<dt>asunto</dt><dd>' + H.esc(mail.subject || "(sin asunto)") + '</dd>' +
                (mail.mailSecurity && (mail.mailSecurity.sentBy || mail.mailSecurity.signedBy) ? '<dt>enviado por</dt><dd class="kair-mail-detail__details-domain">' + H.esc(mail.mailSecurity.sentBy || "—") + '</dd>' : '') +
                (mail.mailSecurity && mail.mailSecurity.signedBy ? '<dt>firmado por</dt><dd class="kair-mail-detail__details-domain">' + H.esc(mail.mailSecurity.signedBy) + '</dd>' : '') +
                (mail.mailSecurity ? '<dt>seguridad</dt><dd>' + renderMailSecurityStatus(mail.mailSecurity) + '</dd>' : '') +
                '<dt>id del mensaje</dt><dd style="font-family:monospace;font-size:0.7rem;color:var(--kair-text-muted);word-break:break-all;">' + H.esc(mail.id || "") + '</dd>' +
              '</dl>' +
              '<p class="kair-mail-detail__details-hint" data-role="details-hint">' + (mail.mailSecurity ? "Detalles de seguridad provistos por Gmail (SPF/DKIM/DMARC/TLS)." : "Cargando detalles de seguridad desde Gmail…") + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="kair-mail-detail__time">' +
            '<div class="kair-mail-detail__time-main">' + formatGmailLongDate(mail.date) + '</div>' +
            '<div class="kair-mail-detail__time-relative">' + formatRelativeTime(mail.date) + '</div>' +
          '</div>' +
        '</div>';
      detail.appendChild(header);
      detail.appendChild(scroll);

      // Body
      if (mail.messages && mail.messages.length > 1) {
        mail.messages.forEach(function (msg, idx) {
          var isOwn = msg.from_email === S.userEmail;
          var msgHtml = '<div class="kair-mail-message' + (idx === 0 ? " kair-mail-message--first" : "") + '" data-msg-id="' + msg.id + '">' +
            '<div class="kair-mail-message__header">' +
              '<div class="kair-mail-message__avatar" style="background:' + (msg.avatarColor || "#888") + ';">' + initials(msg.from_name || msg.from_email) + '</div>' +
              '<div class="kair-mail-message__meta">' +
                '<p class="kair-mail-message__sender">' + H.esc(msg.from_name || "") + ' <span style="font-weight:400;color:var(--kair-text-muted);"><' + H.esc(msg.from_email || "") + "></span></p>" +
                '<div class="kair-mail-message__recipients">' +
                  (msg.to_list && msg.to_list.length > 0 ? '<div class="kair-mail-detail__recipient-row"><span class="kair-mail-detail__recipient-label">Para:</span> <span class="kair-mail-detail__recipient-value">' + H.esc(msg.to_list.map(function (a) { return a.name || a.email; }).join(", ")) + '</span></div>' : "") +
                  (msg.cc_list && msg.cc_list.length > 0 ? '<div class="kair-mail-detail__recipient-row"><span class="kair-mail-detail__recipient-label">CC:</span> <span class="kair-mail-detail__recipient-value">' + H.esc(msg.cc_list.map(function (a) { return a.name || a.email; }).join(", ")) + '</span></div>' : "") +
                '</div>' +
                '<div class="kair-mail-message__time">' + formatGmailLongDate(msg.date) + '</div>' +
              '</div>' +
              '<div class="kair-mail-message__body">' + (msg.body_html || msg.body_plain || "") + '</div>' +
              (msg.attachments && msg.attachments.length > 0 ? '<div class="kair-mail-message__attachments">' + msg.attachments.map(function (att) {
                return '<div class="kair-mail-attachment" data-msg-id="' + msg.id + '" data-att-id="' + att.attachmentId + '">' +
                  '<span class="kair-mail-attachment__icon">' + window.BandejaHelpers.attachmentIcon(att.filename) + '</span>' +
                  '<span class="kair-mail-attachment__name">' + H.esc(att.filename) + '</span>' +
                  '<span class="kair-mail-attachment__size">' + window.BandejaHelpers.formatAttachmentSize(att.size) + '</span>' +
                  '<button class="kair-mail-attachment__download" title="Descargar">↓</button>' +
                '</div>';
              }).join("") + '</div>' : "") +
            '</div>';
          scroll.innerHTML += msgHtml;
        });
      } else if (mail.body_html) {
        scroll.innerHTML = '<div class="kair-mail-body-rich">' + mail.body_html + '</div>';
      } else {
        scroll.innerHTML = '<div class="kair-mail-body-plain" style="white-space:pre-wrap;font-family:inherit;line-height:1.6;">' + H.esc(mail.body || "") + "</div>";
      }

      // Attachments
      if (mail.hasAttachment && mail.messages && mail.messages[mail.messages.length - 1] && mail.messages[mail.messages.length - 1].attachments) {
        var lastMsg = mail.messages[mail.messages.length - 1];
        if (lastMsg.attachments && lastMsg.attachments.length > 0) {
          var attHtml = '<div class="kair-mail-attachments-bar"><span class="kair-mail-attachments-bar__label">Adjuntos</span>' +
            lastMsg.attachments.map(function (att) {
              return '<div class="kair-mail-attachment" data-msg-id="' + lastMsg.id + '" data-att-id="' + att.attachmentId + '">' +
                '<span class="kair-mail-attachment__icon">' + window.BandejaHelpers.attachmentIcon(att.filename) + '</span>' +
                '<span class="kair-mail-attachment__name">' + H.esc(att.filename) + '</span>' +
                '<span class="kair-mail-attachment__size">' + window.BandejaHelpers.formatAttachmentSize(att.size) + '</span>' +
                '<button class="kair-mail-attachment__download" title="Descargar">↓</button>' +
              '</div>';
            }).join("") + "</div>";
          scroll.innerHTML += attHtml;
        }
      }

      container.appendChild(detail);
      container.appendChild(scroll);

      // Bind events
      setTimeout(function () {
        var detailsBtn = container.querySelector("[data-action=toggle-details]");
        if (detailsBtn) detailsBtn.addEventListener("click", function () {
          var panel = container.querySelector("#mail-details-panel");
          var expanded = panel.hasAttribute("hidden") === false;
          panel.hidden = expanded;
          detailsBtn.setAttribute("aria-expanded", !expanded);
        });
        container.querySelectorAll(".kair-mail-attachment__download").forEach(function (btn) {
          btn.addEventListener("click", function (e) {
            e.stopPropagation();
            var msgId = btn.closest(".kair-mail-attachment").dataset.msgId;
            var attId = btn.closest(".kair-mail-attachment").dataset.attId;
            var fileName = btn.closest(".kair-mail-attachment").querySelector(".kair-mail-attachment__name").textContent;
            window.BandejaMailOps.downloadMailAttachment(msgId, attId, fileName);
          });
        });
        container.querySelectorAll(".kair-mail-attachment").forEach(function (att) {
          att.addEventListener("click", function (e) {
            if (e.target.classList.contains("kair-mail-attachment__download")) return;
            var msgId = att.dataset.msgId;
            var attId = att.dataset.attId;
            var fileName = att.querySelector(".kair-mail-attachment__name").textContent;
            window.BandejaMailOps.downloadMailAttachment(msgId, attId, fileName, false, true).then(function (data) {
              if (data) window.BandejaHelpers.openFileViewerFromBytes(data);
            });
          });
        });
      }, 0);
    }
  };

  // Expose helpers
  window.BandejaDetailOps = {
    isThreadSnoozed: isThreadSnoozed,
    unsnoozeThread: unsnoozeThread,
    showSnoozeToast: showSnoozeToast,
    getMailDisplayContact: function (mail) { return { name: mail.to_list && mail.to_list.length > 0 ? mail.to_list[0].name : "", email: mail.to_list && mail.to_list.length > 0 ? mail.to_list[0].email : "" }; },
    formatGmailDate: formatGmailDate,
    formatGmailLongDate: formatGmailLongDate,
    formatRelativeTime: formatRelativeTime,
    renderMailSecurityStatus: renderMailSecurityStatus,
    initials: initials
  };
})();
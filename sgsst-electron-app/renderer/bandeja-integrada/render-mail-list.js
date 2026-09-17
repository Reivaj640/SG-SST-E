/* ============================================================
 * K+AIR Bandeja Integrada — Render Mail List
 * ============================================================ */

(function () {
  "use strict";

  const H = window.BandejaHelpers;
  const S = window.BandejaState;

  window.BandejaRenderMailList = {
    render: function (container) {
      var state = S;
      container.innerHTML = "";

      var composeBar = H.el("div", { class: "kair-mail-compose-bar" });
      var sortBy = state.mailSortBy || "recent";
      var sortLabel = sortBy === "oldest" ? "Más antiguos" : sortBy === "unread" ? "No leídos" : "Reciente";
      composeBar.innerHTML = '<button class="kair-mail-compose-bar__btn" id="mail-compose-btn" title="Redactar correo nuevo (Ctrl+N)">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>' +
        '<span>Redactar</span></button>' +
        '<button class="kair-mail-compose-bar__btn" id="mail-refresh" title="Sincronizar correos">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>' +
        '<span>Sincronizar</span></button>' +
        '<button class="kair-mail-compose-bar__btn" id="mail-sort-toggle" data-active="' + (sortBy === "recent" ? "false" : "true") + '" title="Cambiar orden">' +
        '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="15" y2="12"></line><line x1="3" y1="18" x2="9" y2="18"></line></svg>' +
        '<span>' + sortLabel + '</span>' +
        '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
        '</button>';
      container.appendChild(composeBar);

      // Search
      var searchContainer = H.el("div", { class: "kair-mail-search", style: { padding: "8px 14px", borderBottom: "1px solid var(--kair-border-soft, #e9ecef)" } });
      var searchInput = H.el("input", {
        type: "text", class: "kair-mail-search__input", id: "mail-search-input",
        placeholder: "Buscar en remitente, asunto o contenido...",
        value: S.searchQuery || "",
        style: { width: "100%", padding: "7px 10px 7px 36px", border: "1px solid var(--kair-border, #dee2e6)", borderRadius: "6px", fontSize: "0.8125rem", outline: "none", background: "var(--kair-bg-card, #fff)", color: "var(--kair-text-body, #333)", boxSizing: "border-box" }
      });
      var searchIcon = H.el("span", {
        style: { position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--kair-text-light, #5f6368)", pointerEvents: "none" }
      });
      searchIcon.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
      var searchWrapper = H.el("div", { style: { position: "relative" } });
      searchWrapper.appendChild(searchIcon);
      searchWrapper.appendChild(searchInput);
      if (S.searchQuery) {
        var clearBtn = H.el("button", {
          class: "kair-mail-search__clear", title: "Limpiar búsqueda",
          style: { position: "absolute", right: "18px", top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: "var(--kair-text-light, #5f6368)", padding: "2px", display: "inline-flex", alignItems: "center", justifyContent: "center" }
        });
        clearBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        clearBtn.addEventListener("click", function () {
          S.searchQuery = "";
          searchInput.value = "";
          var existingChips = searchContainer.querySelector(".kair-mail-search__chips");
          if (existingChips && existingChips.parentNode) existingChips.parentNode.removeChild(existingChips);
          window.BandejaRenderMailList.applySearchFilter();
        });
        searchWrapper.appendChild(clearBtn);
      }
      searchContainer.appendChild(searchWrapper);
      container.appendChild(searchContainer);

      // Filters
      var filters = H.el("div", { class: "kair-mail-list-filters" });
      var filtered = S.mails.slice().filter(function (m) {
        if (S.mailFilter !== "sent" && window.BandejaHelpers.isThreadSnoozed && window.BandejaHelpers.isThreadSnoozed(m.id)) return false;
        if (S.mailFilter === "unread") return m.unread;
        if (S.mailFilter === "flagged") return m.flagged;
        if (S.mailFilter === "meeting") return m.category === "meeting";
        if (S.mailFilter === "sent") return true;
        return true;
      });
      var counts = {
        all: S.mails.length,
        unread: S.mails.filter(function (m) { return m.unread; }).length,
        flagged: S.mails.filter(function (m) { return m.flagged; }).length,
        meeting: S.mails.filter(function (m) { return m.category === "meeting"; }).length,
        sent: S.mails.filter(function (m) { return m.mailFolder === "SENT"; }).length,
        drafts: S.mails.filter(function (m) { return m.mailFolder === "DRAFT"; }).length,
        trash: S.mails.filter(function (m) { return m.mailFolder === "TRASH"; }).length,
        spam: S.mails.filter(function (m) { return m.mailFolder === "SPAM"; }).length,
        starred: S.mails.filter(function (m) { return m.star; }).length,
        important: S.mails.filter(function (m) { return m.important; }).length,
        archive: S.mails.filter(function (m) { return m.mailFolder === "ARCHIVE"; }).length,
      };
      var D = window.KairData;
      var filterDefs = [
        { id: "all", label: "Bandeja de entrada", icon: D.ICONS.inbox, isFolder: true, folder: "INBOX" },
        { id: "unread", label: "No leídos", icon: D.ICONS.mailOpen },
        { id: "flagged", label: "Marcados", icon: D.ICONS.star },
        { id: "meeting", label: "Reuniones", icon: D.ICONS.calendarPlus },
        { id: "sent", label: "Enviados", icon: D.ICONS.send, isFolder: true, folder: "SENT" },
        { id: "drafts", label: "Borradores", icon: D.ICONS.folder, isFolder: true, folder: "DRAFT" },
        { id: "trash", label: "Papelera", icon: D.ICONS.trash, isFolder: true, folder: "TRASH" },
        { id: "spam", label: "Spam", icon: D.ICONS.alertTriangle, isFolder: true, folder: "SPAM" },
        { id: "starred", label: "Destacados", icon: D.ICONS.star, isFolder: true, folder: "STARRED" },
        { id: "important", label: "Importantes", icon: D.ICONS.alertTriangle, isFolder: true, folder: "IMPORTANT" },
        { id: "archive", label: "Archivados", icon: D.ICONS.archive, isFolder: true, folder: "ARCHIVE" },
      ];
      filterDefs.forEach(function (f) {
        var isActive = S.mailFilter === f.id;
        var count = counts[f.id];
        var btn = H.el("button", { class: "kair-mail-list-filter", "data-active": isActive });
        btn.innerHTML = (f.icon.replace(/width="\d+" height="\d+"/, 'width="11" height="11"')) + ' ' + f.label + (count > 0 ? '<span class="kair-mail-list-filter__badge">' + count + '</span>' : "");
        btn.addEventListener("click", function () {
          S.mailFilter = f.id;
          S._resetMailListScroll = true;
          if (f.isFolder) {
            S.mailFolder = f.folder;
            window.BandejaMailOps.loadMailsFromCache({ folder: f.folder, forceSync: true });
          } else {
            if (S.mailFolder !== "INBOX") {
              S.mailFolder = "INBOX";
              window.BandejaMailOps.loadMailsFromCache({ folder: "INBOX", forceSync: true });
            } else {
              window.BandejaRenderMailList.render(document.getElementById("mail-list-container"));
            }
          }
        });
        filters.appendChild(btn);
      });
      container.appendChild(filters);

      // Search filter
      filtered = filtered.filter(function (m) {
        if (!S.searchQuery) return true;
        var q = S.searchQuery.toLowerCase();
        var toList = (m.to_list || []).map(function (a) { return (a.name || a.email || "").toLowerCase(); }).join(" ");
        return m.sender.toLowerCase().includes(q) || toList.includes(q) || m.subject.toLowerCase().includes(q) || m.preview.toLowerCase().includes(q);
      });
      if (S.activeLabelIds && S.activeLabelIds.size > 0) {
        filtered = filtered.filter(function (m) {
          var mailLabelIds = m.label_ids || [];
          return Array.from(S.activeLabelIds).some(function (lid) { return mailLabelIds.indexOf(lid) >= 0; });
        });
      }

      // Sort
      var sortBy = S.mailSortBy || "recent";
      filtered.sort(function (a, b) {
        var dateA = a.date || 0, dateB = b.date || 0;
        if (sortBy === "oldest") return dateA - dateB;
        if (sortBy === "unread") {
          if (a.unread && !b.unread) return -1;
          if (!a.unread && b.unread) return 1;
          return dateB - dateA;
        }
        return dateB - dateA;
      });

      // List
      var list = H.el("div", { class: "kair-scroll overflow-y-auto overflow-x-hidden flex-1 min-h-0", style: { flex: "1", overflowY: "auto", overflowX: "hidden", minHeight: "0" } });

      if (S.mailLoading) {
        for (var i = 0; i < 6; i++) {
          list.appendChild(H.el("div", { class: "h-12 rounded-md kair-pulse", style: { height: "48px", borderRadius: "6px", background: "var(--kair-bg-hover)", margin: "8px 12px" } }));
        }
      } else if (filtered.length === 0) {
        var empty = H.el("div", { class: "kair-mail-empty" });
        empty.innerHTML = '<div class="kair-mail-empty__icon">' + D.ICONS.inbox.replace(/width="\d+" height="\d+"/, 'width="26" height="26"') + '</div>' +
          '<p style="font-size:0.875rem;font-weight:600;color:var(--kair-text-muted);margin:0 0 4px;">No hay mensajes</p>' +
          '<p style="font-size:0.75rem;color:var(--kair-text-light);margin:0;">No se encontraron mensajes con este filtro.</p>';
        list.appendChild(empty);
      } else {
        filtered.forEach(function (m) {
          var isSelected = S.selectedMailId === m.id;
          var row = H.el("div", { class: "email-row kair-mail-row", "data-selected": isSelected, "data-mail-id": m.id, "data-unread": m.unread, "data-has-attachment": m.hasAttachment, "data-subject": m.subject, "data-sender": m.sender, "data-preview": m.preview, style: { cursor: "pointer" } });
          row.innerHTML = '<div class="kair-mail-row__checkbox"><input type="checkbox" ' + (S.checkedIds.has(m.id) ? "checked" : "") + '></div>' +
            '<div class="kair-mail-row__avatar" style="background:' + m.avatarColor + ';">' + m.avatarInitials + '</div>' +
            '<div class="kair-mail-row__content">' +
              '<div class="kair-mail-row__header">' +
                '<span class="kair-mail-row__sender">' + H.esc(m.sender) + '</span>' +
                '<span class="kair-mail-row__time">' + (m.time || "") + '</span>' +
              '</div>' +
              '<div class="kair-mail-row__subject-row">' +
                '<span class="kair-mail-row__subject">' + H.esc(m.subject) + '</span>' +
                (m.flagged ? '<span class="kair-mail-row__star">' + D.ICONS.star.replace(/width="\d+" height="\d+"/, 'width="11" height="11"') + '</span>' : '') +
                (m.hasAttachment ? '<span class="kair-mail-row__attachment">' + D.ICONS.paperclip.replace(/width="\d+" height="\d+"/, 'width="12" height="12"') + '</span>' : '') +
              '</div>' +
              '<div class="kair-mail-row__preview">' + H.esc(m.preview || "") + '</div>' +
            '</div>';
          row.addEventListener("click", function (e) {
            if (e.target.type === "checkbox") return;
            S.selectedMailId = m.id;
            window.BandejaRenderMailDetail.render(document.getElementById("mail-detail-container"));
          });
          row.querySelector("input[type=checkbox]").addEventListener("click", function (e) {
            e.stopPropagation();
            if (S.checkedIds.has(m.id)) S.checkedIds.delete(m.id); else S.checkedIds.add(m.id);
            row.setAttribute("data-selected", S.checkedIds.has(m.id));
          });
          list.appendChild(row);
        });
      }
      container.appendChild(list);

      // Labels section
      var userLabelsSection = H.el("div", { class: "kair-labels-section", style: { padding: "8px 14px", borderTop: "1px solid var(--kair-border-soft, #e9ecef)" } });
      var userLabels = S.labels.filter(function (l) { return l.type === "user"; });
      if (userLabels.length > 0) {
        var lblTitle = H.el("div", { html: "<span style='font-size:0.75rem;font-weight:600;color:var(--kair-text-light);text-transform:uppercase;letter-spacing:0.5px;'>Etiquetas</span>" });
        userLabelsSection.appendChild(lblTitle);
        S.labels.filter(function (l) { return l.type === "user"; }).forEach(function (lbl) {
          var isActive = S.activeLabelIds && S.activeLabelIds.has(lbl.id);
          var btn = H.el("button", {
            class: "kair-label-chip-btn",
            style: { display: "flex", alignItems: "center", gap: "6px", width: "100%", padding: "4px 8px", borderRadius: "4px", border: "none", background: "transparent", fontSize: "0.8125rem", cursor: "pointer", textAlign: "left", color: S.activeLabelIds && S.activeLabelIds.has(lbl.id) ? lbl.color_text : "var(--kair-text-muted)" }
          });
          btn.innerHTML = '<span class="kair-label-dot" style="width:8px;height:8px;border-radius:50%;background:' + lbl.color_background + ';flex-shrink:0;"></span>' +
            '<span class="kair-label-name" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + lbl.name + '</span>' +
            (lbl.unread_count > 0 ? '<span class="kair-label-badge" style="font-size:0.6875rem;background:var(--kair-bg-hover);padding:1px 5px;border-radius:9px;">' + lbl.unread_count + '</span>' : '');
          btn.addEventListener("click", function () {
            if (S.activeLabelIds && S.activeLabelIds.has(lbl.id)) S.activeLabelIds.delete(lbl.id); else { if (!S.activeLabelIds) S.activeLabelIds = new Set(); S.activeLabelIds.add(lbl.id); }
            S._resetMailListScroll = true;
            window.BandejaRenderMailList.render(document.getElementById("mail-list-container"));
          });
          userLabelsSection.appendChild(btn);
        });
      }
      container.appendChild(userLabelsSection);
    },

    // Search filter
    applySearchFilter: function () {
      var list = document.getElementById("mail-list-container");
      if (list) this.render(list);
    }
  };
})();
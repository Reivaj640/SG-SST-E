/* ============================================================
 * K+AIR · Inspecciones — Motor de exportación PDF/Excel
 * Depende de window.jspdf (jsPDF UMD), window.XLSX (SheetJS),
 * y window.KairInspectionTypes. Se expone en window.KairExport.
 * ============================================================ */
(function (global) {
  "use strict";

  var T = global.KairInspectionTypes;
  var COLOR_PRIMARY = [23, 78, 166];
  var COLOR_BORDER = [222, 226, 230];
  var COLOR_TEXT = [26, 26, 46];
  var COLOR_MUTED = [90, 99, 120];

  function fmtDate(d) {
    try {
      var date = typeof d === "string" ? new Date(d) : d;
      var dd = String(date.getDate()).padStart(2, "0");
      var mm = String(date.getMonth() + 1).padStart(2, "0");
      var yyyy = date.getFullYear();
      return dd + "/" + mm + "/" + yyyy;
    } catch (e) { return String(d); }
  }

  function getJsPDF() {
    var w = global.jspdf || (global.jsPDF ? { jsPDF: global.jsPDF } : null);
    if (!w || !w.jsPDF) throw new Error("jsPDF no está cargado");
    return w.jsPDF;
  }

  function drawOfficialHeader(doc, code, title, revision) {
    var pageW = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, COLOR_TEXT);
    doc.text("PROCESO DE GESTIÓN INTEGRAL", 14, 14);
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, COLOR_MUTED);
    doc.text("CÓDIGO: " + code, pageW - 14, 14, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor.apply(doc, COLOR_PRIMARY);
    doc.text(title, pageW / 2, 26, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, COLOR_MUTED);
    doc.text(revision, pageW - 14, 31, { align: "right" });

    doc.setDrawColor.apply(doc, COLOR_BORDER);
    doc.setLineWidth(0.5);
    doc.line(14, 36, pageW - 14, 36);
  }

  function drawFooter(doc) {
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor.apply(doc, COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(14, pageH - 16, pageW - 14, pageH - 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, COLOR_MUTED);
    doc.text("K+AIR · SG-SST · Documento controlado", 14, pageH - 10);
    doc.text("Generado: " + fmtDate(new Date()), pageW - 14, pageH - 10, { align: "right" });
  }

  function ensureSpace(doc, y, needed) {
    var pageH = doc.internal.pageSize.getHeight();
    if (y + needed > pageH - 24) {
      doc.addPage();
      return 20;
    }
    return y;
  }

  function autoTable(doc, opts) {
    if (typeof doc.autoTable !== "function") throw new Error("jspdf-autotable no está cargado");
    doc.autoTable(opts);
    return doc.lastAutoTable.finalY;
  }

  /* ---------- BOTIQUÍN PDF ---------- */
  function pdfBotiquin(doc, insp) {
    var meta = T.INSPECTION_TYPES.botiquin;
    drawOfficialHeader(doc, meta.code, meta.title, meta.revision);
    var pageW = doc.internal.pageSize.getWidth();
    var y = 46;
    var data = insp.data || {};
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, COLOR_TEXT);
    doc.text("FECHA: " + fmtDate(insp.date), 14, y);
    doc.text("REALIZADO POR: " + insp.performedBy, pageW / 2 + 14, y);
    y += 6;
    if (insp.site) doc.text("SEDE: " + insp.site, 14, y);
    doc.text("EMPRESA: " + insp.companyName, pageW / 2 + 14, y);
    y += 8;

    y = autoTable(doc, {
      startY: y,
      head: [["ITEM", "ELEMENTOS", "CANTIDAD", "FECHA DE VENCIMIENTO", "ESTADO / OBSERVACIÓN"]],
      body: (data.items || []).map(function (it) { return [it.item || "", it.elemento || "", it.cantidad || "", it.fechaVencimiento || "", it.estado || ""]; }),
      theme: "grid",
      headStyles: { fillColor: COLOR_PRIMARY, textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: COLOR_TEXT },
      styles: { cellPadding: 2, lineColor: COLOR_BORDER, lineWidth: 0.1 },
      margin: { left: 14, right: 14 }
    }) + 8;

    if ((data.checks || []).length > 0) {
      y = autoTable(doc, {
        startY: y,
        head: [["VERIFICACIÓN", "ESTADO"]],
        body: (data.checks || []).map(function (c) { return [c.label || "", c.value || ""]; }),
        theme: "grid",
        headStyles: { fillColor: COLOR_PRIMARY, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: COLOR_TEXT },
        styles: { cellPadding: 2, lineColor: COLOR_BORDER, lineWidth: 0.1 },
        margin: { left: 14, right: 14 }
      }) + 8;
    }

    if (data.observaciones || insp.observations) {
      y = ensureSpace(doc, y, 24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("OBSERVACIONES:", 14, y);
      doc.setFont("helvetica", "normal");
      var text = data.observaciones || insp.observations || "";
      var lines = doc.splitTextToSize(text, pageW - 28);
      doc.text(lines, 14, y + 5);
      y += 5 + lines.length * 4 + 6;
    }

    y = ensureSpace(doc, y, 30) + 10;
    doc.setDrawColor.apply(doc, COLOR_TEXT);
    doc.setLineWidth(0.3);
    doc.line(14, y, 90, y);
    doc.line(pageW - 90, y, pageW - 14, y);
    doc.setFontSize(8);
    doc.text("REALIZADO POR", 14, y + 5);
    doc.text("FIRMA", pageW - 90, y + 5);
    drawFooter(doc);
  }

  /* ---------- EXTINTORES PDF (landscape) ---------- */
  function pdfExtintores(doc, insp) {
    var meta = T.INSPECTION_TYPES.extintores;
    drawOfficialHeader(doc, meta.code, meta.title, meta.revision);
    var pageW = doc.internal.pageSize.getWidth();
    var y = 46;
    var data = insp.data || {};
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, COLOR_TEXT);
    doc.text("Fecha de realización de inspección: " + fmtDate(insp.date), 14, y);
    y += 6;
    doc.text("Realizada por: " + insp.performedBy, 14, y);
    if (insp.role) doc.text("Cargo: " + insp.role, pageW / 2, y);
    y += 6;
    if (insp.site) { doc.text("Sede: " + insp.site, 14, y); y += 6; }
    doc.text("Empresa: " + insp.companyName, 14, y);
    y += 8;

    y = autoTable(doc, {
      startY: y,
      head: [["UBICACIÓN", "# EXTINTOR", "TIPO", "CAPACIDAD", "F. RECARGA", "F. VENCIMIENTO", "PRESIÓN MANÓMETRO", "ESTADO CILINDRO", "PASADOR", "ANILLO VERIFICACIÓN", "BASE SOPORTE", "OBSERVACIONES"]],
      body: (data.rows || []).map(function (r) { return [r.ubicacion || "", r.numero || "", r.tipo || "", r.capacidad || "", r.fechaRecarga || "", r.fechaVencimiento || "", r.presion || "", r.estadoCilindro || "", r.pasador || "", r.anillo || "", r.base || "", r.observaciones || ""]; }),
      theme: "grid",
      headStyles: { fillColor: COLOR_PRIMARY, textColor: 255, fontSize: 6.5 },
      bodyStyles: { fontSize: 6.5, textColor: COLOR_TEXT, valign: "middle" },
      styles: { cellPadding: 1.5, lineColor: COLOR_BORDER, lineWidth: 0.1, overflow: "linebreak" },
      margin: { left: 14, right: 14 },
      columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 18 }, 2: { cellWidth: 16 }, 3: { cellWidth: 18 }, 4: { cellWidth: 22 }, 5: { cellWidth: 22 }, 6: { cellWidth: 22 }, 7: { cellWidth: 22 }, 8: { cellWidth: 18 }, 9: { cellWidth: 20 }, 10: { cellWidth: 20 }, 11: { cellWidth: "auto" } }
    }) + 8;

    if (data.observaciones || insp.observations) {
      y = ensureSpace(doc, y, 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("OBSERVACIONES:", 14, y);
      doc.setFont("helvetica", "normal");
      var text = data.observaciones || insp.observations || "";
      var lines = doc.splitTextToSize(text, pageW - 28);
      doc.text(lines, 14, y + 5);
      y += 5 + lines.length * 4 + 6;
    }
    y = ensureSpace(doc, y, 30) + 10;
    doc.setDrawColor.apply(doc, COLOR_TEXT);
    doc.setLineWidth(0.3);
    doc.line(14, y, 90, y);
    doc.line(pageW - 90, y, pageW - 14, y);
    doc.setFontSize(8);
    doc.text("REALIZADO POR", 14, y + 5);
    doc.text("FIRMA", pageW - 90, y + 5);
    drawFooter(doc);
  }

  /* ---------- INSTALACIONES PDF ---------- */
  function pdfInstalaciones(doc, insp) {
    var meta = T.INSPECTION_TYPES.instalaciones;
    drawOfficialHeader(doc, meta.code, meta.title, meta.revision);
    var pageW = doc.internal.pageSize.getWidth();
    var y = 46;
    var data = insp.data || {};
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, COLOR_TEXT);
    doc.text("FECHA: " + fmtDate(insp.date), 14, y);
    if (insp.site) doc.text("LUGAR: " + insp.site, pageW / 2, y);
    y += 6;
    doc.text("EMPRESA: " + insp.companyName, 14, y);
    y += 8;

    y = autoTable(doc, {
      startY: y,
      head: [["ITEM REVISIÓN", "SI", "NO", "N/A", "OBSERVACIONES", "COMPROMISOS", "RESPONSABLE - FECHAS", "SEGUIMIENTO - ESTADO"]],
      body: (data.items || []).map(function (it) { return [it.item || "", it.respuesta === "SI" ? "X" : "", it.respuesta === "NO" ? "X" : "", it.respuesta === "N/A" ? "X" : "", it.observaciones || "", it.compromisos || "", it.responsable || "", it.seguimiento || ""]; }),
      theme: "grid",
      headStyles: { fillColor: COLOR_PRIMARY, textColor: 255, fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5, textColor: COLOR_TEXT, valign: "middle" },
      styles: { cellPadding: 2, lineColor: COLOR_BORDER, lineWidth: 0.1, overflow: "linebreak" },
      margin: { left: 14, right: 14 },
      columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 10, halign: "center" }, 2: { cellWidth: 10, halign: "center" }, 3: { cellWidth: 12, halign: "center" }, 4: { cellWidth: 35 }, 5: { cellWidth: 35 }, 6: { cellWidth: 30 }, 7: { cellWidth: 30 } }
    }) + 10;

    y = ensureSpace(doc, y, 30);
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, COLOR_TEXT);
    doc.text("INSPECCIONADO POR: " + (data.inspeccionadoPor || insp.performedBy || ""), 14, y);
    y += 6;
    doc.text("CARGO: " + (data.cargo || insp.role || ""), 14, y);
    y += 10;
    doc.setDrawColor.apply(doc, COLOR_TEXT);
    doc.setLineWidth(0.3);
    doc.line(14, y, 90, y);
    doc.setFontSize(8);
    doc.text("FIRMA", 14, y + 5);
    drawFooter(doc);
  }

  /* ---------- EQUIPOS DE EMERGENCIA PDF ---------- */
  function pdfEmergencia(doc, insp) {
    var meta = T.INSPECTION_TYPES.equipos_emergencia;
    drawOfficialHeader(doc, meta.code, meta.title, meta.revision);
    var pageW = doc.internal.pageSize.getWidth();
    var y = 46;
    var data = insp.data || {};
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, COLOR_TEXT);
    doc.text("FECHA: " + fmtDate(insp.date), 14, y);
    y += 6;
    doc.text("SITIO DE INSPECCIÓN: " + (insp.site || ""), 14, y);
    y += 6;
    doc.text("EMPRESA: " + insp.companyName, 14, y);
    y += 8;

    y = autoTable(doc, {
      startY: y,
      head: [["ITEMS PARA REVISAR", "BUENO", "MALO", "N/A", "RECOMENDACIONES / COMPROMISOS", "RESPONSABLES / FECHAS", "SEGUIMIENTO / ESTATUS"]],
      body: (data.items || []).map(function (it) { return [it.item || "", it.estado === "BUENO" ? "X" : "", it.estado === "MALO" ? "X" : "", it.estado === "N/A" ? "X" : "", it.recomendaciones || "", it.responsables || "", it.seguimiento || ""]; }),
      theme: "grid",
      headStyles: { fillColor: COLOR_PRIMARY, textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: COLOR_TEXT, valign: "middle" },
      styles: { cellPadding: 2, lineColor: COLOR_BORDER, lineWidth: 0.1, overflow: "linebreak" },
      margin: { left: 14, right: 14 },
      columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 14, halign: "center" }, 2: { cellWidth: 14, halign: "center" }, 3: { cellWidth: 14, halign: "center" }, 4: { cellWidth: 45 }, 5: { cellWidth: 35 }, 6: { cellWidth: 35 } }
    }) + 10;

    var participantes = data.participantes || [];
    if (participantes.length > 0) {
      y = ensureSpace(doc, y, 20 + participantes.length * 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("NOMBRE COMPLETO DE PARTICIPANTES", 14, y);
      doc.text("CARGO", pageW / 2 + 14, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      participantes.forEach(function (p) {
        y += 5;
        doc.text(p.nombre || "", 14, y);
        doc.text(p.cargo || "", pageW / 2 + 14, y);
      });
      y += 8;
    }

    y = ensureSpace(doc, y, 30) + 8;
    doc.setDrawColor.apply(doc, COLOR_TEXT);
    doc.setLineWidth(0.3);
    doc.line(14, y, 90, y);
    doc.line(pageW - 90, y, pageW - 14, y);
    doc.setFontSize(8);
    doc.text("REALIZADO POR", 14, y + 5);
    doc.text("FIRMA", pageW - 90, y + 5);
    drawFooter(doc);
  }

  function exportInspectionToPdfBlob(insp) {
    var JsPDF = getJsPDF();
    var doc = new JsPDF({ orientation: insp.type === "extintores" ? "landscape" : "portrait", unit: "mm", format: "a4" });
    switch (insp.type) {
      case "botiquin": pdfBotiquin(doc, insp); break;
      case "extintores": pdfExtintores(doc, insp); break;
      case "instalaciones": pdfInstalaciones(doc, insp); break;
      case "equipos_emergencia": pdfEmergencia(doc, insp); break;
    }
    return doc.output("blob");
  }

  /* ---------- XLSX ---------- */
  function buildOfficialAoa(code, title, revision) {
    return [
      ["", "", "PROCESO DE GESTIÓN INTEGRAL", "", "", "", "", "CÓDIGO: " + code],
      ["", "", "", "", "", "", "", ""],
      ["", "", title, "", "", "", "", revision],
      ["", "", "", "", "", "", "", ""]
    ];
  }

  function aoaToXlsxBuffer(aoa, sheetName, cols, merges) {
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    if (cols) ws["!cols"] = cols;
    if (merges) ws["!merges"] = merges;
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: "array", bookType: "xlsx" });
  }

  function exportBotiquinXlsx(insp) {
    var meta = T.INSPECTION_TYPES.botiquin;
    var aoa = buildOfficialAoa(meta.code, meta.title, meta.revision);
    aoa.push(["FECHA:", fmtDate(insp.date), "", "", "REALIZADO POR:", insp.performedBy, "", ""]);
    aoa.push([insp.site ? "SEDE:" : "", insp.site || "", "", "", "EMPRESA:", insp.companyName, "", ""]);
    aoa.push([]);
    aoa.push(["ITEM", "ELEMENTOS", "CANTIDAD", "FECHA DE VENCIMIENTO", "ESTADO / OBSERVACIÓN"]);
    var data = insp.data || {};
    (data.items || []).forEach(function (it) {
      aoa.push([it.item || "", it.elemento || "", it.cantidad || "", it.fechaVencimiento || "", it.estado || ""]);
    });
    if ((data.checks || []).length > 0) {
      aoa.push([]);
      aoa.push(["VERIFICACIÓN", "ESTADO"]);
      (data.checks || []).forEach(function (c) { aoa.push([c.label || "", c.value || ""]); });
    }
    if (data.observaciones || insp.observations) {
      aoa.push([]);
      aoa.push(["OBSERVACIONES:", data.observaciones || insp.observations || ""]);
    }
    aoa.push([]);
    aoa.push(["REALIZADO POR:", insp.performedBy, "", "FIRMA:", ""]);
    aoa.push(["CARGO:", insp.role || "", "", "", ""]);
    return aoaToXlsxBuffer(aoa, "Botiquín", [{ wch: 10 }, { wch: 32 }, { wch: 12 }, { wch: 22 }, { wch: 36 }], [
      { s: { r: 0, c: 2 }, e: { r: 0, c: 6 } },
      { s: { r: 2, c: 2 }, e: { r: 2, c: 6 } }
    ]);
  }

  function exportExtintoresXlsx(insp) {
    var meta = T.INSPECTION_TYPES.extintores;
    var aoa = buildOfficialAoa(meta.code, meta.title, meta.revision);
    aoa.push(["Fecha de realización de inspección:", fmtDate(insp.date), "", "", "", "", "", ""]);
    aoa.push(["Realizada por:", insp.performedBy, "", "Cargo:", insp.role || "", "", "", ""]);
    aoa.push([insp.site ? "Sede:" : "", insp.site || "", "", "Empresa:", insp.companyName, "", "", ""]);
    aoa.push([]);
    aoa.push(["UBICACIÓN", "# DE EXTINTOR", "TIPO", "CAPACIDAD", "FECHA DE RECARGA", "FECHA DE VENCIMIENTO", "PRESIÓN MANÓMETRO", "ESTADO CILINDRO", "PASADOR", "ANILLO VERIFICACIÓN", "BASE SOPORTE", "OBSERVACIONES"]);
    var data = insp.data || {};
    (data.rows || []).forEach(function (r) {
      aoa.push([r.ubicacion || "", r.numero || "", r.tipo || "", r.capacidad || "", r.fechaRecarga || "", r.fechaVencimiento || "", r.presion || "", r.estadoCilindro || "", r.pasador || "", r.anillo || "", r.base || "", r.observaciones || ""]);
    });
    if (data.observaciones || insp.observations) {
      aoa.push([]);
      aoa.push(["OBSERVACIONES:", data.observaciones || insp.observations || ""]);
    }
    aoa.push([]);
    aoa.push(["REALIZADO POR:", insp.performedBy, "", "FIRMA:", ""]);
    return aoaToXlsxBuffer(aoa, "Extintores", [{ wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 32 }], [
      { s: { r: 0, c: 2 }, e: { r: 0, c: 6 } },
      { s: { r: 2, c: 2 }, e: { r: 2, c: 6 } }
    ]);
  }

  function exportInstalacionesXlsx(insp) {
    var meta = T.INSPECTION_TYPES.instalaciones;
    var aoa = buildOfficialAoa(meta.code, meta.title, meta.revision);
    aoa.push(["FECHA:", fmtDate(insp.date), "", "LUGAR:", insp.site || "", "", "", ""]);
    aoa.push(["EMPRESA:", insp.companyName, "", "", "", "", "", ""]);
    aoa.push([]);
    aoa.push(["ITEM REVISIÓN", "SI", "NO", "N/A", "OBSERVACIONES", "COMPROMISOS", "RESPONSABLE - FECHAS", "SEGUIMIENTO - ESTADO"]);
    var data = insp.data || {};
    var currentCat = "";
    (data.items || []).forEach(function (it) {
      if (it.categoria && it.categoria !== currentCat) {
        currentCat = it.categoria;
        aoa.push([currentCat, "", "", "", "", "", "", ""]);
      }
      aoa.push([it.item || "", it.respuesta === "SI" ? "X" : "", it.respuesta === "NO" ? "X" : "", it.respuesta === "N/A" ? "X" : "", it.observaciones || "", it.compromisos || "", it.responsable || "", it.seguimiento || ""]);
    });
    aoa.push([]);
    aoa.push(["INSPECCIONADO POR:", data.inspeccionadoPor || insp.performedBy, "", "", "", "", "", ""]);
    aoa.push(["CARGO:", data.cargo || insp.role || "", "", "", "", "", ""]);
    aoa.push(["FIRMA:", "", "", "", "", "", "", ""]);
    return aoaToXlsxBuffer(aoa, "Instalaciones", [{ wch: 60 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 30 }, { wch: 30 }, { wch: 25 }, { wch: 25 }], [
      { s: { r: 0, c: 2 }, e: { r: 0, c: 6 } },
      { s: { r: 2, c: 2 }, e: { r: 2, c: 6 } }
    ]);
  }

  function exportEmergenciaXlsx(insp) {
    var meta = T.INSPECTION_TYPES.equipos_emergencia;
    var aoa = buildOfficialAoa(meta.code, meta.title, meta.revision);
    aoa.push(["FECHA:", fmtDate(insp.date), "", "", "", "", "", ""]);
    aoa.push(["SITIO DE INSPECCIÓN:", insp.site || "", "", "EMPRESA:", insp.companyName, "", "", ""]);
    aoa.push([]);
    aoa.push(["ITEMS PARA REVISAR", "BUENO", "MALO", "N/A", "RECOMENDACIONES / COMPROMISOS", "RESPONSABLES / FECHAS", "SEGUIMIENTO / ESTATUS"]);
    var data = insp.data || {};
    (data.items || []).forEach(function (it) {
      aoa.push([it.item || "", it.estado === "BUENO" ? "X" : "", it.estado === "MALO" ? "X" : "", it.estado === "N/A" ? "X" : "", it.recomendaciones || "", it.responsables || "", it.seguimiento || ""]);
    });
    var participantes = data.participantes || [];
    if (participantes.length > 0) {
      aoa.push([]);
      aoa.push(["NOMBRE COMPLETO DE PARTICIPANTES", "", "CARGO"]);
      participantes.forEach(function (p) { aoa.push([p.nombre || "", "", p.cargo || ""]); });
    }
    aoa.push([]);
    aoa.push(["REALIZADO POR:", insp.performedBy, "", "FIRMA:", ""]);
    return aoaToXlsxBuffer(aoa, "Equipos Emergencia", [{ wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 35 }, { wch: 25 }, { wch: 25 }], [
      { s: { r: 0, c: 2 }, e: { r: 0, c: 6 } },
      { s: { r: 2, c: 2 }, e: { r: 2, c: 6 } }
    ]);
  }

  function exportInspectionToXlsxBlob(insp) {
    var buf;
    switch (insp.type) {
      case "botiquin": buf = exportBotiquinXlsx(insp); break;
      case "extintores": buf = exportExtintoresXlsx(insp); break;
      case "instalaciones": buf = exportInstalacionesXlsx(insp); break;
      case "equipos_emergencia": buf = exportEmergenciaXlsx(insp); break;
      default: buf = exportBotiquinXlsx(insp);
    }
    return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  /* ---------- PROGRAMA XLSX ---------- */
  function exportProgramToXlsxBlob(program) {
    var aoa = [];
    aoa.push(["", "", "", "", "PROCESO DE GESTIÓN INTEGRAL", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "REV. 01. DICIEMBRE 20 DE 2020"]);
    aoa.push(["", "", "", "", "PROGRAMA DE INSPECCIONES DE SEGURIDAD", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    aoa.push([]);

    var activities = program.activities || [];
    var programmed = 0, completed = 0;
    activities.forEach(function (a) {
      T.MONTHS.forEach(function (m) {
        var v = (a.monthlySchedule || {})[m];
        if (v === "p" || v === "c") programmed++;
        if (v === "c") completed++;
      });
    });
    var pending = programmed - completed;
    var indicator = programmed > 0 ? Math.round((completed / programmed) * 10000) / 100 : 0;

    aoa.push(["", "", "Indicador", indicator + "%", "", "Inspecciones Realizadas", completed, "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    aoa.push(["", "", "", "En Proceso", "", "Inspecciones Sin Realizar", pending, "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    aoa.push([]);
    aoa.push(["", "", "", "", "", "", "PROGRAMACIÓN ANUAL", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    aoa.push(["", "", "OBJETIVO GENERAL", "OBJETIVOS ESPECÍFICOS", "ACTIVIDADES", "RESPONSABLE", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic", "%", "ESTADO", "OBSERVACIONES Y SEGUIMIENTO"]);

    activities.forEach(function (a) {
      var row = ["", "", program.generalObjective || "", a.specificObjective || "", a.activity || "", a.responsible || ""];
      T.MONTHS.forEach(function (m) { row.push((a.monthlySchedule || {})[m] || ""); });
      row.push(Math.round((a.percentage || 0) * 100) + "%");
      row.push(a.status || "Sin Iniciar");
      row.push(a.observations || "");
      aoa.push(row);
    });

    aoa.push([]);
    aoa.push(["", "", "", "FIRMA DEL RESPONSABLE / TÉCNICO DE SEGURIDAD EN EL TRABAJO", "", "", "FIRMA REPRESENTANTE LEGAL", "", "", "", "", "", "", "", "", "", "", "", "", ""]);

    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 3 }, { wch: 3 }, { wch: 40 }, { wch: 40 }, { wch: 35 }, { wch: 22 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 8 }, { wch: 14 }, { wch: 30 }];
    ws["!merges"] = [
      { s: { r: 0, c: 4 }, e: { r: 0, c: 18 } },
      { s: { r: 1, c: 4 }, e: { r: 1, c: 18 } },
      { s: { r: 2, c: 2 }, e: { r: 2, c: 20 } }
    ];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PROGRAMA");
    var buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function safeFileName(insp) {
    var meta = T.INSPECTION_TYPES[insp.type];
    var safeDate = new Date(insp.date).toISOString().slice(0, 10);
    var safeWho = (insp.performedBy || "inspector").replace(/\s+/g, "_");
    return "K+AIR_" + meta.code + "_" + safeWho + "_" + safeDate;
  }

  global.KairExport = {
    exportInspectionToPdfBlob: exportInspectionToPdfBlob,
    exportInspectionToXlsxBlob: exportInspectionToXlsxBlob,
    exportProgramToXlsxBlob: exportProgramToXlsxBlob,
    downloadBlob: downloadBlob,
    safeFileName: safeFileName
  };
})(typeof window !== "undefined" ? window : this);
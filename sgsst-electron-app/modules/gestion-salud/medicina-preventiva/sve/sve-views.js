/* ============================================================
 * K+AIR · SVE — Vistas (UI premium) — NUEVO
 * Vanilla JS. Sin dependencias (usa SveUI / SveStore).
 * Se expone en window.SveViews
 *
 * Vistas: Dashboard, Seguimiento (lista CRUD), Caso (detalle),
 *         FormCaso (nuevo/editar), Plan (PHVA AP/AE),
 *         Indicadores, Areas.
 *
 * Estructura adaptada de la herramienta Excel de gestión SVE
 * covid19 (hojas: "SVE covid", "Seguimiento", "Áreas Expuestas").
 * ============================================================ */
(function (global) {
  "use strict";

  var U = global.SveUI;
  var V = {};

  function el(tag, attrs, children) { return U.el(tag, attrs, children); }
  function icon(name, size) { return U.icon(name, size); }
  function icons() { U.refreshIcons(); }
  function toast(title, msg, type) { U.toast(title, msg, type); }
  function fmtDate(d) { return U.fmtDate(d); }

  /* ================= Header / navegación ================= */
  function buildHeader(ctx, opts) {
    opts = opts || {};
    var st = global.SveStore.getState();
    /* 📦827 — 'sqlite' = los datos viven en la base y viajan con el .kairsync.
       'local' = prototipo suelto en un navegador. La vista solo pregunta. */
    var modo = (typeof global.SveStore.modo === 'function') ? global.SveStore.modo() : 'local';
    var tabs = [
      { label: "Dashboard", icon: "layout-dashboard", active: opts.active === "dashboard", onClick: function () { ctx.go({ name: "dashboard" }); } },
      { label: "Seguimiento", icon: "users", active: opts.active === "seguimiento", onClick: function () { ctx.go({ name: "seguimiento" }); } },
      { label: "Plan PHVA", icon: "calendar-check-2", active: opts.active === "plan", onClick: function () { ctx.go({ name: "plan" }); } },
      { label: "Indicadores", icon: "line-chart", active: opts.active === "indicadores", onClick: function () { ctx.go({ name: "indicadores" }); } },
      { label: "Áreas", icon: "map-pin", active: opts.active === "areas", onClick: function () { ctx.go({ name: "areas" }); } }
    ];
    var header = el("header", { className: "sve-header" }, [
      el("div", { className: "sve-header__left" }, [
        opts.onBack
          ? el("button", {
              className: "sve-header__crumb", title: "Volver", style: { gap: "7px" },
              onClick: opts.onBack
            }, [icon("arrow-left", 13), opts.backLabel || "Volver"])
          : el("div", { className: "sve-header__brand" }, icon("activity", 20)),
        el("div", { className: "sve-header__titles" }, [
          el("div", { className: "sve-header__title", textContent: opts.title || "SVE COVID-19" }),
          el("div", { className: "sve-header__sub" }, [
            icon("shield-check", 12),
            el("span", {}, [opts.breadcrumb || "Salud Ocupacional · ", el("b", { textContent: opts.activeLabel || "Vigilancia Epidemiológica" })])
          ])
        ])
      ]),
      el("div", { className: "sve-header__center" }, el("div", { className: "sve-tabs" }, tabs.map(function (t) {
        return el("button", { className: "sve-tab" + (t.active ? " is-active" : ""), onClick: t.onClick }, [
          icon(t.icon, 14), t.label
        ]);
      }))),
      el("div", { className: "sve-header__right" }, [
        // 📦827 — El chip refleja DÓNDE viven los datos de verdad, preguntándoselo
        // al store (que es la caché de la vista) y no a la base: las vistas no
        // saben qué hay detrás. Antes decía siempre "Solo en este equipo",
        // que era falso dentro de la app —lo que no viajaba era al revés, la
        // etiqueta mentía sobre lo que SÍ se sincronizaba— y cierto solo en el
        // prototipo abierto en un navegador.
        modo === "sqlite"
          ? el("span", { className: "sve-sync sve-sync--ok", title: "Estos datos están guardados en la base de la aplicación y viajan con la sincronización (.kairsync)." }, [
            el("span", { className: "sve-sync__dot" }), "Sincronizado"
          ])
          : el("span", { className: "sve-sync", title: "Este prototipo se está viendo fuera de la aplicación: los datos se guardan en este navegador y no viajan entre equipos." }, [
            el("span", { className: "sve-sync__dot" }), "Solo en este equipo"
          ]),
        el("span", { className: "sve-header__crumb", textContent: st.meta.empresa || "Empresa" })
      ])
    ]);
    return header;
  }

  function page(root, headerFragment) {
    var pageEl = el("div", { className: "sve-page" });
    pageEl.appendChild(headerFragment);
    var body = el("div", { className: "sve-body" });
    pageEl.appendChild(body);
    root.appendChild(pageEl);
    return body;
  }

  function sectionTitle(icoName, text, hint) {
    return el("div", { className: "sve-sec-head" }, [
      el("div", { className: "sve-sec-title" }, [icon(icoName, 16), text]),
      hint ? el("div", { className: "sve-sec-hint", textContent: hint }) : null
    ]);
  }

  /* ================= Cálculos compartidos ================= */
  /* cumplimiento actividad: Σ AE (donde AP=1) / Σ AP */
  function cumplDeMeses(meses) {
    var ap = 0, ae = 0;
    for (var i = 0; i < 12; i++) {
      if (meses[i] && meses[i][0] === 1) { ap++; if (meses[i][1] === 1) ae++; }
    }
    return ap ? ae / ap : null;
  }
  function cumplPlan(plan, faseId) {
    var ap = 0, ae = 0;
    plan.forEach(function (a) {
      if (faseId && a.fase !== faseId) return;
      for (var i = 0; i < 12; i++) {
        if (a.meses[i] && a.meses[i][0] === 1) { ap++; if (a.meses[i][1] === 1) ae++; }
      }
    });
    return ap ? ae / ap : null;
  }
  function cumplTrimestre(plan, t) { /* t: 0..3 */
    var ap = 0, ae = 0;
    plan.forEach(function (a) {
      for (var i = t * 3; i < t * 3 + 3; i++) {
        if (a.meses[i] && a.meses[i][0] === 1) { ap++; if (a.meses[i][1] === 1) ae++; }
      }
    });
    return ap ? ae / ap : null;
  }
  function isConfirmado(s) { return s.estado === "confirmado" || String(s.pcr).toUpperCase() === "SI" || String(s.pruebaRapida).toUpperCase() === "SI"; }

  /* 📦827-fix-2 (2026-09-30) — Un indicador sin serie no puede romper la vista.

     Lo que pasaba: las definiciones de indicadores guardadas sin años ni medidas
     dejan `anios.length - 1` en -1, y `ind.prevalencia.promedio[-1]` reventaba
     con "Cannot read properties of undefined (reading '-1')". El router lo
     atrapaba y el programa entero se quedaba en "Error al cargar la vista" — que
     es justo lo que el dueño reportó como "la app quedó congelada".

     Aquí se normaliza la forma (toda medida es un arreglo) y se deja que un
     indicador sin años se muestre en cero, que es lo honesto: no hay nada
     registrado. La forma la define el dato, no una lista fija en la vista. */
  var IND_MEDIDAS = {
    prevalencia: ['casos', 'promedio'],
    incidencia: ['casosNuevos', 'promedio'],
    ausentismo: ['diasIncapacidad', 'diasProgramados'],
    eficacia: ['sugeridas', 'implementadas']
  };
  /* 📦830 — etiquetas de cada medida (para el formulario de edición) y
     defaults editoriales por indicador. Los defaults se usan cuando la base
     todavía no trae los extras (columna extra_json recién agregada): así una
     BD vieja muestra la MISMA meta y el MISMO umbral que antes del cambio. */
  var IND_MEDIDAS_TXT = {
    casos: "Casos (nuevos y antiguos)",
    promedio: "Promedio trabajadores expuestos",
    casosNuevos: "Casos nuevos",
    diasIncapacidad: "Días de ausencia (incapacidad)",
    diasProgramados: "Días de trabajo programados",
    sugeridas: "No. mejoras sugeridas",
    implementadas: "No. mejoras implementadas"
  };
  var IND_META_CORTA_DEF = {
    prevalencia: "< 10%",
    incidencia: "< 10%",
    ausentismo: "disminuir 10%",
    eficacia: "≥ 70%"
  };
  var IND_UMBRAL_DEF = { prevalencia: 0.1, incidencia: 0.1, ausentismo: null, eficacia: 0.7 };
  function _umbralDe(o, clave) {
    var u = o ? o.umbral : null;
    if (u === undefined || u === null || u === "") return IND_UMBRAL_DEF[clave];
    var n = Number(u);
    return isNaN(n) ? IND_UMBRAL_DEF[clave] : n;
  }
  /* Semáforo: sin umbral definido todo queda "verde" (era el comportamiento
     de ausentismo y sigue siendolo; una BD vieja sin extra_json conserva sus
     umbrales 0.1/0.7 vía IND_UMBRAL_DEF). */
  function _bienMenor(x, val) { return (x.umbral === null || x.umbral === undefined) ? true : val < x.umbral; }
  function _bienMayor(x, val) { return (x.umbral === null || x.umbral === undefined) ? true : val >= x.umbral; }
  function _indSeguro(ind, clave) {
    var o = (ind && typeof ind === 'object' && ind[clave]) || {};
    var salida = {
      nombre: o.nombre || clave,
      meta: o.meta || '',
      metaCorta: o.metaCorta || IND_META_CORTA_DEF[clave] || '',
      umbral: _umbralDe(o, clave),
      formulacion: o.formulacion || '',
      periodicidad: o.periodicidad || '',
      anios: Array.isArray(o.anios) ? o.anios : []
    };
    (IND_MEDIDAS[clave] || []).forEach(function (m) {
      /* Rellena con null hasta alcanzar la cantidad de años: una serie a medias
         no puede dejar filas cortas en la tabla. */
      var arr = Array.isArray(o[m]) ? o[m].slice() : [];
      while (arr.length < salida.anios.length) arr.push(null);
      salida[m] = arr;
    });
    return salida;
  }
  function _conjuntoSeguro(ind) {
    return {
      prevalencia: _indSeguro(ind, 'prevalencia'),
      incidencia: _indSeguro(ind, 'incidencia'),
      ausentismo: _indSeguro(ind, 'ausentismo'),
      eficacia: _indSeguro(ind, 'eficacia')
    };
  }

  /* ================= DASHBOARD ================= */
  V.Dashboard = function (root, ctx) {
    var st = global.SveStore.getState();
    var anio = st.ui.anioDash || st.meta.anio || new Date().getFullYear();
    var segsAnio = st.seguimientos.filter(function (s) { return Number(s.anio) === Number(anio); });
    var confirmados = segsAnio.filter(isConfirmado).length;
    var aislamiento = segsAnio.filter(function (s) { return s.estado === "aislamiento"; }).length;
    var vulnerables = segsAnio.filter(function (s) { return String(s.vulnerable).toUpperCase() === "SI"; }).length;
    var activos = segsAnio.filter(function (s) { return s.estado === "sospechoso" || s.estado === "confirmado" || s.estado === "aislamiento"; }).length;
    var areas = {};
    segsAnio.forEach(function (s) { if (s.area) areas[s.area] = (areas[s.area] || 0) + 1; });
    var nAreas = Object.keys(areas).length;
    var cumpl = cumplPlan(st.plan);

    /* --- hero --- */
    var heroSel = el("select", { className: "sve-select", style: { background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.25)", color: "#fff", backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }, onChange: function (ev) {
      global.SveStore.setUi({ anioDash: Number(ev.target.value) });
      global.SveApp.refresh();
    } });
    aniosDisponibles(st).forEach(function (y) {
      var o = el("option", { value: y, textContent: "Año " + y });
      if (y === anio) o.selected = true;
      heroSel.appendChild(o);
    });

    var hero = el("section", { className: "sve-hero" }, [
      el("div", { className: "sve-hero__grid" }, [
        el("div", {}, [
          el("div", { className: "sve-hero__eyebrow" }, [icon("shield-plus", 13), "SG-SST · SALUD OCUPACIONAL"]),
          el("h1", { className: "sve-hero__title", textContent: "Sistema de Vigilancia Epidemiológica COVID-19" }),
          el("p", { className: "sve-hero__desc", textContent: st.meta.objetivo }),
          el("div", { className: "sve-hero__meta" }, [
            el("span", { className: "sve-hero__chip" }, [icon("calendar", 12), "Año ejecución " + st.meta.anio]),
            el("span", { className: "sve-hero__chip" }, [icon("file-badge", 12), (st.meta.codigo || "") + " · v" + (st.meta.version || "1")]),
            el("span", { className: "sve-hero__chip" }, [icon("map-pin", 12), nAreas + " áreas vigiladas"]),
            heroSel
          ])
        ]),
        el("div", { className: "sve-hero__ring" }, U.ringDark(cumpl || 0, "PLAN PHVA"))
      ])
    ]);

    /* --- KPIs --- */
    function kpi(icoName, bg, fg, val, lbl, delay) {
      return el("div", { className: "sve-kpi", style: { animationDelay: delay + "ms" } }, [
        el("div", { className: "sve-kpi__ico", style: { background: bg, color: fg } }, icon(icoName, 17)),
        el("div", {}, [
          el("div", { className: "sve-kpi__val", textContent: String(val) }),
          el("div", { className: "sve-kpi__lbl", textContent: lbl })
        ])
      ]);
    }
    var kpis = el("section", { className: "sve-kpis" }, [
      kpi("users", "var(--sve-teal-soft)", "var(--sve-teal)", segsAnio.length, "Seguimientos " + anio, 0),
      kpi("thermometer", "var(--sve-danger-soft)", "var(--sve-danger)", confirmados, "Casos confirmados", 60),
      kpi("house", "var(--sve-info-soft)", "var(--sve-info)", aislamiento, "En aislamiento", 120),
      kpi("heart-pulse", "var(--sve-warning-soft)", "var(--sve-warning)", vulnerables, "Población vulnerable", 180),
      kpi("activity", "var(--sve-primary-soft)", "var(--sve-primary-strong)", activos, "Casos activos", 240)
    ]);

    /* --- casos por mes --- */
    var porMes = [];
    for (var mi = 0; mi < 12; mi++) {
      var n = segsAnio.filter(function (s) { return U.MONTHS.indexOf(String(s.mes || "").toUpperCase()) === mi; }).length;
      porMes.push({ label: U.MONTHS_SHORT[mi], value: n, color: n ? "teal" : undefined });
    }
    var cardMeses = el("div", { className: "sve-card" }, [
      el("div", { className: "sve-card__head" }, [
        el("div", { className: "sve-card__title" }, [icon("bar-chart-3", 15), "Seguimientos por mes · " + anio]),
        el("span", { className: "sve-pill sve-pill--teal" }, [el("span", { className: "sve-pill__dot" }), segsAnio.length + " registros"])
      ]),
      el("div", { className: "sve-card__body" }, U.bars(porMes))
    ]);

    /* --- PHVA --- */
    var fasesCards = el("div", { className: "sve-phva" }, st.fases.map(function (f, i) {
      var p = cumplPlan(st.plan, f.id) || 0;
      return el("div", { className: "sve-phva__item", style: { animationDelay: i * 70 + "ms" }, onClick: function () { ctx.go({ name: "plan" }); }, title: "Ver plan de trabajo" }, [
        el("div", { className: "sve-phva__top" }, [
          el("div", { className: "sve-phva__letter", style: { background: f.color }, textContent: String(f.n) }),
          el("div", { className: "sve-phva__pct", textContent: Math.round(p * 100) + "%" })
        ]),
        el("div", { className: "sve-phva__name", textContent: f.name }),
        el("div", { className: "sve-phva__meta", textContent: st.plan.filter(function (a) { return a.fase === f.id; }).length + " actividades" }),
        el("div", { style: { marginTop: "10px" } }, U.pctBar(p))
      ]);
    }));
    var cardPhva = el("div", { className: "sve-card" }, [
      el("div", { className: "sve-card__head" }, [
        el("div", { className: "sve-card__title" }, [icon("rotate-ccw", 15), "Gestión en ciclo PHVA"]),
        el("span", { className: "sve-pill sve-pill--teal" }, [el("span", { className: "sve-pill__dot" }), "Cumplimiento " + Math.round((cumpl || 0) * 100) + "%"])
      ]),
      el("div", { className: "sve-card__body" }, fasesCards)
    ]);

    /* --- áreas expuestas --- */
    var areasArr = Object.keys(areas).map(function (a) { return { name: a, n: areas[a] }; }).sort(function (x, y) { return y.n - x.n; });
    var maxA = areasArr.length ? areasArr[0].n : 1;
    var cardAreas = el("div", { className: "sve-card" }, [
      el("div", { className: "sve-card__head" }, [
        el("div", { className: "sve-card__title" }, [icon("map-pin", 15), "Áreas expuestas"]),
        el("button", { className: "sve-btn sve-btn--sm sve-btn--soft", onClick: function () { ctx.go({ name: "areas" }); }, textContent: "Ver análisis" })
      ]),
      el("div", { className: "sve-card__body" }, areasArr.length
        ? areasArr.map(function (a) { return U.hbar(a.name, a.n, maxA); })
        : el("div", { className: "sve-empty" }, el("div", { className: "sve-empty__msg", textContent: "Sin seguimientos registrados en " + anio })))
    ]);

    /* --- indicadores resultado --- */
    function indRow(nombre, valor, metaTxt, good) {
      return el("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 0", borderBottom: "1px solid var(--sve-border)" } }, [
        el("div", {}, [
          el("div", { style: { fontSize: "13px", fontWeight: "700" }, textContent: nombre }),
          el("div", { style: { fontSize: "11px", color: "var(--sve-muted)", fontWeight: "600", marginTop: "2px" }, textContent: metaTxt })
        ]),
        el("span", { className: "sve-pill " + (good ? "sve-pill--green" : "sve-pill--red"), textContent: valor })
      ]);
    }
    var ind = _conjuntoSeguro(st.indicadores);
    /* 📦830 — el dashboard toma SIEMPRE el último año de la serie (antes estaba
       clampado a la posición 4, así que con más de 5 años seguía mostrando 2024).
       Sin espina de años el índice queda en -1 y TODA medida devuelve un
       arreglo, así que `[i]` no revienta: sale undefined, los KPI quedan en
       cero y la vista sigue viva. */
    var anioInd = ind.prevalencia.anios.length ? ind.prevalencia.anios.length - 1 : -1;
    function _v(obj, medida, i) { var a = obj[medida]; return Array.isArray(a) ? a[i] : undefined; }
    function prevPct(i) { var p = _v(ind.prevalencia, 'promedio', i) || 0; var c = _v(ind.prevalencia, 'casos', i) || 0; return p ? c / p * 100 : 0; }
    function incPct(i) { var p = _v(ind.incidencia, 'promedio', i) || 0; var c = _v(ind.incidencia, 'casosNuevos', i) || 0; return p ? c / p * 100 : 0; }
    function ausPct(i) { var d = _v(ind.ausentismo, 'diasProgramados', i) || 0; var x = _v(ind.ausentismo, 'diasIncapacidad', i) || 0; return d ? x / d * 100 : 0; }
    function efiPct(i) { var s = _v(ind.eficacia, 'sugeridas', i) || 0; var m = _v(ind.eficacia, 'implementadas', i) || 0; return s ? m / s : 0; }
    var cardInd = el("div", { className: "sve-card" }, [
      el("div", { className: "sve-card__head" }, [
        el("div", { className: "sve-card__title" }, [icon("line-chart", 15), "Indicadores de resultado " + (ind.prevalencia.anios[anioInd] || "sin años registrados")]),
        el("button", { className: "sve-btn sve-btn--sm sve-btn--soft", onClick: function () { ctx.go({ name: "indicadores" }); }, textContent: "Ver todos" })
      ]),
      el("div", { className: "sve-card__body" }, [
        indRow("Prevalencia COVID-19", U.fmtPct(prevPct(anioInd) / 100), "Meta: " + ind.prevalencia.metaCorta, _bienMenor(ind.prevalencia, prevPct(anioInd) / 100)),
        indRow("Incidencia COVID-19", U.fmtPct(incPct(anioInd) / 100), "Meta: " + ind.incidencia.metaCorta, _bienMenor(ind.incidencia, incPct(anioInd) / 100)),
        indRow("Ausentismo por COVID-19", U.fmtPct(ausPct(anioInd), 2), "Meta: " + ind.ausentismo.metaCorta, _bienMenor(ind.ausentismo, ausPct(anioInd) / 100)),
        indRow("Eficacia del programa", U.fmtPct(efiPct(anioInd), 0), "Meta: " + ind.eficacia.metaCorta, _bienMayor(ind.eficacia, efiPct(anioInd)))
      ])
    ]);

    /* --- últimos seguimientos --- */
    var recientes = st.seguimientos.slice().sort(function (a, b) { return String(b.fechaIngreso).localeCompare(String(a.fechaIngreso)); }).slice(0, 6);
    var cardRec = el("div", { className: "sve-card" }, [
      el("div", { className: "sve-card__head" }, [
        el("div", { className: "sve-card__title" }, [icon("history", 15), "Últimos seguimientos"]),
        el("button", { className: "sve-btn sve-btn--sm sve-btn--soft", onClick: function () { ctx.go({ name: "seguimiento" }); }, textContent: "Ver todos" })
      ]),
      el("div", { className: "sve-table-wrap", style: { maxHeight: "none", border: "0", borderRadius: "0" } }, el("table", { className: "sve-table" }, [
        el("thead", {}, el("tr", {}, [
          el("th", { textContent: "Trabajador" }), el("th", { textContent: "Ingreso" }),
          el("th", { textContent: "Área" }), el("th", { textContent: "Estado" }), el("th", {})
        ])),
        el("tbody", {}, recientes.map(function (s) {
          return el("tr", { className: "is-clickable", onClick: function () { ctx.go({ name: "caso", id: s.id }); } }, [
            el("td", {}, [
              el("div", { className: "sve-table__name", textContent: s.trabajador }),
              el("div", { className: "sve-table__sub", textContent: (s.cargo || "") + " · " + (s.empresa || "") })
            ]),
            el("td", { textContent: fmtDate(s.fechaIngreso) }),
            el("td", { textContent: s.area || "—" }),
            el("td", {}, U.estadoPill(s.estado, true)),
            el("td", { style: { textAlign: "right" } }, el("button", {
              className: "sve-btn sve-btn--sm sve-btn--ghost", title: "Ver caso",
              onClick: function (ev) { ev.stopPropagation(); ctx.go({ name: "caso", id: s.id }); }
            }, [icon("chevron-right", 13)]))
          ]);
        })
      )]))
    ]);

    var body = page(root, buildHeader(ctx, { active: "dashboard" }));
    body.appendChild(hero);
    body.appendChild(kpis);
    body.appendChild(el("section", { className: "sve-section sve-grid-31" }, [cardMeses, cardPhva]));
    body.appendChild(el("section", { className: "sve-section sve-grid-13" }, [cardAreas, cardInd]));
    body.appendChild(el("section", { className: "sve-section" }, cardRec));
    icons();
  };

  function aniosDisponibles(st) {
    var set = {};
    st.seguimientos.forEach(function (s) { set[s.anio] = true; });
    set[st.meta.anio] = true;
    return Object.keys(set).map(Number).sort(function (a, b) { return b - a; });
  }

  /* ================= SEGUIMIENTO (lista) ================= */
  V.Seguimiento = function (root, ctx) {
    var st = global.SveStore.getState();
    var f = { q: "", anio: "todos", estado: "todos", area: "todos" };

    var searchIn = el("input", { type: "text", placeholder: "Buscar por nombre, documento, cargo…", onInput: function (ev) { f.q = ev.target.value.toLowerCase(); paintRows(); } });
    var selAnio = el("select", { className: "sve-select", onChange: function (ev) { f.anio = ev.target.value; paintRows(); } }, [
      el("option", { value: "todos", textContent: "Todos los años" })
    ].concat(aniosDisponibles(st).map(function (y) { return el("option", { value: y, textContent: y }); })));
    var selEstado = el("select", { className: "sve-select", onChange: function (ev) { f.estado = ev.target.value; paintRows(); } }, [
      el("option", { value: "todos", textContent: "Todos los estados" })
    ].concat(Object.keys(U.ESTADOS).map(function (k) { return el("option", { value: k, textContent: U.ESTADOS[k].label }); })));
    var selArea = el("select", { className: "sve-select", onChange: function (ev) { f.area = ev.target.value; paintRows(); } }, [
      el("option", { value: "todos", textContent: "Todas las áreas" })
    ].concat(st.catalogos.areas.map(function (a) { return el("option", { value: a, textContent: a }); })));

    var exportBtn = el("button", { className: "sve-btn sve-btn--ghost", onClick: exportXlsx }, [icon("file-spreadsheet", 15), "Exportar XLSX"]);
    var nuevoBtn = el("button", { className: "sve-btn sve-btn--primary", onClick: function () { ctx.go({ name: "nuevo" }); } }, [icon("user-plus", 15), "Nuevo seguimiento"]);

    var countPill = el("span", { className: "sve-pill sve-pill--teal" }, [el("span", { className: "sve-pill__dot" }), ""]);
    var tbody = el("tbody", {});
    var table = el("div", { className: "sve-table-wrap" }, el("table", { className: "sve-table" }, [
      el("thead", {}, el("tr", {}, [
        el("th", { textContent: "Trabajador" }), el("th", { textContent: "Ingreso" }),
        el("th", { textContent: "Cargo / Área" }), el("th", { textContent: "EPS" }),
        el("th", { textContent: "Riesgo" }), el("th", { textContent: "Estado" }), el("th", {})
      ])),
      tbody
    ]));

    function riesgoChips(s) {
      var out = [];
      if (String(s.sintomas).toUpperCase() === "SI") out.push(el("span", { className: "sve-pill sve-pill--amber", title: "Síntomas: " + (s.cualesSintomas || "") }, [el("span", { className: "sve-pill__dot" }), "Sint."]));
      if (String(s.contactoPositivo).toUpperCase() === "SI") out.push(el("span", { className: "sve-pill sve-pill--amber", title: "Contacto estrecho de positivo" }, [el("span", { className: "sve-pill__dot" }), "Contacto"]));
      if (String(s.vulnerable).toUpperCase() === "SI") out.push(el("span", { className: "sve-pill sve-pill--violet", title: "Población vulnerable" }, [el("span", { className: "sve-pill__dot" }), "Vuln."]));
      if (String(s.antecedentes).toUpperCase() === "SI") out.push(el("span", { className: "sve-pill sve-pill--gray", title: "Antecedentes: " + (s.tipoAntecedente || "") }, [el("span", { className: "sve-pill__dot" }), "Antec."]));
      if (isConfirmado(s) && s.estado !== "descartado") out.push(el("span", { className: "sve-pill sve-pill--red", title: "Prueba positiva" }, [el("span", { className: "sve-pill__dot" }), "P+"]));
      return out.length ? out : [el("span", { className: "sve-table__sub", textContent: "Sin marcadores" })];
    }

    function filtered() {
      return st.seguimientos.filter(function (s) {
        if (f.anio !== "todos" && Number(s.anio) !== Number(f.anio)) return false;
        if (f.estado !== "todos" && s.estado !== f.estado) return false;
        if (f.area !== "todos" && s.area !== f.area) return false;
        if (f.q) {
          var blob = [s.trabajador, s.documento, s.cargo, s.area, s.eps, s.email, s.ciudad].join(" ").toLowerCase();
          if (blob.indexOf(f.q) === -1) return false;
        }
        return true;
      }).sort(function (a, b) { return String(b.fechaIngreso).localeCompare(String(a.fechaIngreso)); });
    }

    function paintRows() {
      var rows = filtered();
      countPill.textContent = rows.length + " registros";
      tbody.innerHTML = "";
      if (!rows.length) {
        tbody.appendChild(el("tr", {}, el("td", { colSpan: "7" }, el("div", { className: "sve-empty" }, [
          el("div", { className: "sve-empty__ico" }, icon("users", 22)),
          el("div", { className: "sve-empty__ttl", textContent: "Sin resultados" }),
          el("div", { className: "sve-empty__msg", textContent: "Ajusta los filtros o registra un nuevo seguimiento epidemiológico." })
        ]))));
        icons();
        return;
      }
      rows.forEach(function (s) {
        tbody.appendChild(el("tr", { className: "is-clickable", onClick: function () { ctx.go({ name: "caso", id: s.id }); } }, [
          el("td", {}, [
            el("div", { className: "sve-table__name", textContent: s.trabajador }),
            el("div", { className: "sve-table__sub", textContent: "CC " + (s.documento || "—") + (s.ciudad ? " · " + s.ciudad : "") })
          ]),
          el("td", {}, [
            el("div", { className: "sve-table__num", textContent: fmtDate(s.fechaIngreso) }),
            el("div", { className: "sve-table__sub", textContent: s.mes ? String(s.mes).toUpperCase() : "—" })
          ]),
          el("td", {}, [
            el("div", { style: { fontWeight: "600" }, textContent: s.cargo || "—" }),
            el("div", { className: "sve-table__sub", textContent: s.area || "—" })
          ]),
          el("td", { textContent: s.eps || "—" }),
          el("td", {}, el("div", { style: { display: "flex", gap: "4px", flexWrap: "wrap", maxWidth: "230px" } }, riesgoChips(s))),
          el("td", {}, U.estadoPill(s.estado, true)),
          el("td", { style: { textAlign: "right", whiteSpace: "nowrap" } }, [
            el("button", { className: "sve-btn sve-btn--sm sve-btn--ghost", title: "Ver caso", onClick: function (ev) { ev.stopPropagation(); ctx.go({ name: "caso", id: s.id }); } }, [icon("eye", 13)]),
            " ",
            el("button", { className: "sve-btn sve-btn--sm sve-btn--ghost", title: "Editar", onClick: function (ev) { ev.stopPropagation(); ctx.go({ name: "caso", id: s.id, editar: true }); } }, [icon("pencil", 13)]),
            " ",
            el("button", { className: "sve-btn sve-btn--sm sve-btn--danger", title: "Eliminar", onClick: function (ev) { ev.stopPropagation(); deleteSeg(s); } }, [icon("trash-2", 13)])
          ])
        ]));
      });
      icons();
    }

    function deleteSeg(s) {
      U.confirm({
        title: "Eliminar seguimiento",
        msg: "¿Eliminar el seguimiento de " + s.trabajador + "? Esta acción no se puede deshacer.",
        okLabel: "Eliminar", danger: true,
        onOk: function () {
          global.SveStore.removeSeguimiento(s.id);
          toast("Seguimiento eliminado", "El registro de " + s.trabajador + " fue eliminado.", "success");
          paintRows();
        }
      });
    }

    function exportXlsx() {
      try {
        var X = global.XLSX;
        if (!X) throw new Error("SheetJS no disponible");
        var rows = filtered().map(function (s, i) {
          var o = { "ITEM": i + 1, "FECHA DE INGRESO A SEGUIMIENTO": s.fechaIngreso, "MES": s.mes, "AÑO": s.anio, "NOMBRE EMPRESA": s.empresa, "NOMBRE TRABAJADOR": s.trabajador, "DOCUMENTO DE IDENTIDAD": s.documento, "TELÉFONO": s.telefono, "MAIL": s.email, "GÉNERO": s.genero, "FECHA NACIMIENTO": s.fechaNacimiento, "EDAD": U.edad(s.fechaNacimiento), "EPS": s.eps, "AFP": s.afp, "SECTOR": s.sector, "CARGO": s.cargo, "AREA DE TRABAJO": s.area, "CIUDAD RESIDENCIA": s.ciudad, "ANTECEDENTES POSITIVOS": s.antecedentes, "POBLACIÓN VULNERABLE?": s.vulnerable, "TIPO DE ANTECEDENTE": s.tipoAntecedente, "SINTOMAS COVID": s.sintomas, "CUALES SINTOMAS": s.cualesSintomas, "CONTACTO ESTRECHO COVID POSITIVO": s.contactoPositivo, "CONTACTO CON SINTOMÁTICO": s.contactoSintomatico, "PRUEBA RÁPIDA POSITIVA": s.pruebaRapida, "FECHA PRUEBA RAPIDA": s.fechaPruebaRapida, "PCR CONFIRMATORIA POSITIVA": s.pcr, "FECHA PCR POSITIVA": s.fechaPcr, "MODALIDAD LABORAL": s.modalidad, "FECHA INICIO AISLAMIENTO": s.fechaAislamiento, "ESTADO": s.estado, "OBSERVACIONES": s.observaciones };
          return o;
        });
        var ws = X.utils.json_to_sheet(rows);
        var wb = X.utils.book_new();
        X.utils.book_append_sheet(wb, ws, "Seguimiento");
        X.writeFile(wb, "SVE_Seguimiento_COVID19.xlsx");
        toast("Exportación lista", "Se descargó SVE_Seguimiento_COVID19.xlsx con " + rows.length + " registros.", "success");
      } catch (e) {
        toast("No se pudo exportar", String(e && e.message || e), "error");
      }
    }

    var toolbar = el("div", { className: "sve-toolbar" }, [
      el("div", { className: "sve-toolbar__left" }, [
        el("div", { className: "sve-search" }, [icon("search", 14), searchIn]),
        selAnio, selEstado, selArea
      ]),
      el("div", { className: "sve-toolbar__right" }, [countPill, exportBtn, nuevoBtn])
    ]);

    var body = page(root, buildHeader(ctx, { active: "seguimiento", title: "Seguimiento epidemiológico" }));
    body.appendChild(el("section", { className: "sve-section" }, [toolbar, table]));
    paintRows();
    icons();
  };

  /* ================= CASO (detalle) ================= */
  V.Caso = function (root, ctx, id) {
    var st = global.SveStore.getState();
    var s = st.seguimientos.filter(function (x) { return String(x.id) === String(id); })[0];
    var body = page(root, buildHeader(ctx, { active: "seguimiento", title: "Detalle del caso", onBack: function () { ctx.go({ name: "seguimiento" }); }, backLabel: "Seguimiento" }));
    if (!s) {
      body.appendChild(el("div", { className: "sve-card" }, el("div", { className: "sve-empty" }, [
        el("div", { className: "sve-empty__ico" }, icon("user-x", 22)),
        el("div", { className: "sve-empty__ttl", textContent: "Caso no encontrado" }),
        el("div", { className: "sve-empty__msg", textContent: "El seguimiento solicitado no existe o fue eliminado." })
      ])));
      icons();
      return;
    }

    /* hero compacto */
    var hero = el("section", { className: "sve-hero sve-hero--compact" }, el("div", { className: "sve-hero__grid" }, [
      el("div", {}, [
        el("div", { className: "sve-hero__eyebrow" }, [icon("folder-open", 13), "CASO N.º " + s.id + " · " + String(s.anio)]),
        el("h1", { className: "sve-hero__title", textContent: s.trabajador }),
        el("div", { className: "sve-hero__meta" }, [
          el("span", { className: "sve-hero__chip" }, [icon("id-card", 12), "CC " + (s.documento || "—")]),
          el("span", { className: "sve-hero__chip" }, [icon("hard-hat", 12), s.cargo || "—"]),
          el("span", { className: "sve-hero__chip" }, [icon("map-pin", 12), s.area || "—"]),
          el("span", { className: "sve-hero__chip" }, [icon("building", 12), s.empresa || "—"]),
          el("span", { className: "sve-hero__chip" }, [icon("calendar", 12), "Ingreso " + fmtDate(s.fechaIngreso)])
        ])
      ]),
      el("div", { className: "sve-hero__ring" }, el("div", { style: { display: "flex", alignItems: "center", gap: "12px" } }, [
        U.estadoPill(s.estado),
        el("button", { className: "sve-btn sve-btn--primary", onClick: function () { ctx.go({ name: "caso", id: s.id, editar: true }); } }, [icon("pencil", 14), "Editar caso"])
      ]))
    ]));

    /* facts trabajador */
    function fact(lbl, val, cls) {
      return el("div", { className: "sve-fact" }, [
        el("div", { className: "sve-fact__lbl", textContent: lbl }),
        el("div", { className: "sve-fact__val" + (cls ? " " + cls : ""), textContent: val === undefined || val === null || val === "" ? "—" : String(val) })
      ]);
    }
    var edad = U.edad(s.fechaNacimiento);
    var facts = el("div", { className: "sve-card" }, [
      el("div", { className: "sve-card__head" }, el("div", { className: "sve-card__title" }, [icon("user-round", 15), "Datos del trabajador"])),
      el("div", { className: "sve-card__body" }, el("div", { className: "sve-facts" }, [
        fact("Documento", s.documento), fact("Género", s.genero), fact("Edad", edad ? edad + " años" : "—"),
        fact("Fecha nacimiento", fmtDate(s.fechaNacimiento)),
        fact("Teléfono", s.telefono || "—"), fact("Correo", s.email || "—"), fact("EPS", s.eps), fact("AFP", s.afp),
        fact("Sector", s.sector), fact("Cargo", s.cargo), fact("Área de trabajo", s.area), fact("Ciudad", s.ciudad)
      ]))
    ]);

    /* riesgo */
    function riskItem(lbl, yes, extra, valueLabel) {
      var right = valueLabel
        ? el("span", { className: "sve-pill sve-pill--teal", textContent: valueLabel })
        : U.ynPill(yes ? "SI" : "NO");
      return el("div", { className: "sve-risk" }, [
        el("div", {}, [
          el("div", { className: "sve-risk__lbl", textContent: lbl }),
          extra ? el("div", { className: "sve-risk__extra", textContent: extra }) : null
        ]),
        right
      ]);
    }
    var riesgo = el("div", { className: "sve-card" }, [
      el("div", { className: "sve-card__head" }, el("div", { className: "sve-card__title" }, [icon("stethoscope", 15), "Evaluación epidemiológica"])),
      el("div", { className: "sve-card__body" }, el("div", { className: "sve-riskgrid" }, [
        riskItem("Síntomas COVID", String(s.sintomas).toUpperCase() === "SI", s.cualesSintomas && s.cualesSintomas !== "N/A" ? s.cualesSintomas : null),
        riskItem("Contacto estrecho (positivo)", String(s.contactoPositivo).toUpperCase() === "SI"),
        riskItem("Contacto con sintomático", String(s.contactoSintomatico).toUpperCase() === "SI"),
        riskItem("Antecedentes positivos", String(s.antecedentes).toUpperCase() === "SI", s.tipoAntecedente && s.tipoAntecedente !== "N/A" ? s.tipoAntecedente : null),
        riskItem("Población vulnerable", String(s.vulnerable).toUpperCase() === "SI"),
        riskItem("Prueba rápida positiva", String(s.pruebaRapida).toUpperCase() === "SI", s.fechaPruebaRapida ? fmtDate(s.fechaPruebaRapida) : null),
        riskItem("PCR confirmatoria positiva", String(s.pcr).toUpperCase() === "SI", s.fechaPcr ? fmtDate(s.fechaPcr) : null),
        riskItem("Modalidad laboral", false, null, s.modalidad || "Presencial")
      ]))
    ]);

    /* timeline */
    var tl = [];
    tl.push(el("div", { className: "sve-tl__item" }, [
      el("div", { className: "sve-tl__dot" }),
      el("div", { className: "sve-tl__date", textContent: fmtDate(s.fechaIngreso) }),
      el("div", { className: "sve-tl__txt", textContent: "Ingreso al sistema de seguimiento" }),
      s.mes ? el("div", { className: "sve-tl__sub", textContent: "Mes de corte: " + s.mes + " · Año " + s.anio }) : null
    ]));
    if (String(s.sintomas).toUpperCase() === "SI") {
      tl.push(el("div", { className: "sve-tl__item" }, [
        el("div", { className: "sve-tl__dot sve-tl__dot--amber" }),
        el("div", { className: "sve-tl__date", textContent: "Identificación" }),
        el("div", { className: "sve-tl__txt", textContent: "Síntomas reportados" }),
        el("div", { className: "sve-tl__sub", textContent: s.cualesSintomas || "—" })
      ]));
    }
    if (String(s.pruebaRapida).toUpperCase() === "SI") {
      tl.push(el("div", { className: "sve-tl__item" }, [
        el("div", { className: "sve-tl__dot sve-tl__dot--red" }),
        el("div", { className: "sve-tl__date", textContent: fmtDate(s.fechaPruebaRapida) }),
        el("div", { className: "sve-tl__txt", textContent: "Prueba rápida positiva" })
      ]));
    }
    if (String(s.pcr).toUpperCase() === "SI") {
      tl.push(el("div", { className: "sve-tl__item" }, [
        el("div", { className: "sve-tl__dot sve-tl__dot--red" }),
        el("div", { className: "sve-tl__date", textContent: fmtDate(s.fechaPcr) }),
        el("div", { className: "sve-tl__txt", textContent: "PCR confirmatoria positiva" })
      ]));
    }
    if (s.fechaAislamiento) {
      tl.push(el("div", { className: "sve-tl__item" }, [
        el("div", { className: "sve-tl__dot" }),
        el("div", { className: "sve-tl__date", textContent: fmtDate(s.fechaAislamiento) }),
        el("div", { className: "sve-tl__txt", textContent: "Inicio de aislamiento" + (s.modalidad && s.modalidad !== "Presencial" ? " (" + s.modalidad + ")" : "") })
      ]));
    }
    if (s.estado === "alta") {
      tl.push(el("div", { className: "sve-tl__item" }, [
        el("div", { className: "sve-tl__dot sve-tl__dot--green" }),
        el("div", { className: "sve-tl__date", textContent: "Cierre" }),
        el("div", { className: "sve-tl__txt", textContent: "Alta epidemiológica" })
      ]));
    }
    if (s.estado === "descartado") {
      tl.push(el("div", { className: "sve-tl__item" }, [
        el("div", { className: "sve-tl__dot sve-tl__dot--green" }),
        el("div", { className: "sve-tl__date", textContent: "Cierre" }),
        el("div", { className: "sve-tl__txt", textContent: "Caso descartado" })
      ]));
    }
    var cardTl = el("div", { className: "sve-card" }, [
      el("div", { className: "sve-card__head" }, el("div", { className: "sve-card__title" }, [icon("git-commit-horizontal", 15), "Línea de tiempo del caso"])),
      el("div", { className: "sve-card__body" }, el("div", { className: "sve-tl" }, tl))
    ]);

    /* observaciones + acciones */
    var cardObs = el("div", { className: "sve-card" }, [
      el("div", { className: "sve-card__head" }, [
        el("div", { className: "sve-card__title" }, [icon("notebook-pen", 15), "Observaciones y acciones"]),
        el("button", { className: "sve-btn sve-btn--sm sve-btn--danger", onClick: delCase }, [icon("trash-2", 13), "Eliminar caso"])
      ]),
      el("div", { className: "sve-card__body" }, [
        el("p", { style: { fontSize: "13px", lineHeight: "1.6", color: "var(--sve-text-2)", whiteSpace: "pre-wrap" }, textContent: s.observaciones || "Sin observaciones registradas." })
      ])
    ]);

    function delCase() {
      U.confirm({
        title: "Eliminar caso",
        msg: "¿Eliminar el seguimiento de " + s.trabajador + "? Esta acción no se puede deshacer.",
        okLabel: "Eliminar", danger: true,
        onOk: function () {
          global.SveStore.removeSeguimiento(s.id);
          toast("Caso eliminado", "El registro fue eliminado correctamente.", "success");
          ctx.go({ name: "seguimiento" });
        }
      });
    }

    body.appendChild(hero);
    body.appendChild(el("section", { className: "sve-section sve-grid-2" }, [facts, riesgo]));
    body.appendChild(el("section", { className: "sve-section sve-grid-2" }, [cardTl, cardObs]));
    icons();
  };

  /* ================= FORM CASO (nuevo / editar) ================= */
  V.FormCaso = function (root, ctx, mode, id) {
    var st = global.SveStore.getState();
    var editing = mode === "editar";
    var s = editing
      ? JSON.parse(JSON.stringify(st.seguimientos.filter(function (x) { return String(x.id) === String(id); })[0] || {}))
      : {
          id: null, fechaIngreso: new Date().toISOString().slice(0, 10),
          mes: U.MES_LABEL[U.MONTHS[new Date().getMonth()]] || "", anio: new Date().getFullYear(),
          empresa: st.meta.empresa, trabajador: "", documento: "", telefono: "", email: "",
          genero: "Masculino", fechaNacimiento: "", eps: "", afp: "", sector: "Salud",
          cargo: "", area: "", ciudad: "", antecedentes: "NO", tipoAntecedente: "N/A",
          vulnerable: "NO", sintomas: "NO", cualesSintomas: "N/A", contactoPositivo: "NO",
          contactoSintomatico: "NO", pruebaRapida: "NO", fechaPruebaRapida: "", pcr: "NO",
          fechaPcr: "", modalidad: "Presencial", fechaAislamiento: "", estado: "sospechoso",
          observaciones: ""
        };

    var body = page(root, buildHeader(ctx, {
      active: "seguimiento", title: editing ? "Editar caso" : "Nuevo seguimiento",
      onBack: function () { ctx.go(editing ? { name: "caso", id: id } : { name: "seguimiento" }); },
      backLabel: "Cancelar"
    }));

    var titleCard = el("section", { className: "sve-hero sve-hero--compact", style: { marginBottom: "18px" } }, el("div", {}, [
      el("div", { className: "sve-hero__eyebrow" }, [icon(editing ? "pencil" : "user-plus", 13), editing ? "EDITANDO CASO N.º " + id : "REGISTRO NUEVO"]),
      el("h1", { className: "sve-hero__title", textContent: editing ? s.trabajador || "Caso" : "Nuevo seguimiento epidemiológico" }),
      el("p", { className: "sve-hero__desc", textContent: "Diligencia la información con la misma estructura de la herramienta SVE: datos del seguimiento, del trabajador, evaluación epidemiológica y clasificación." })
    ]));

    /* inputs */
    var inp = {};
    function txt(key, label, opts) {
      opts = opts || {};
      var i = el("input", {
        type: opts.type || "text", className: "sve-input", value: s[key] === undefined || s[key] === null ? "" : s[key],
        placeholder: opts.ph || "", readonly: !!opts.ro
      });
      if (opts.onInput) i.addEventListener("input", opts.onInput);
      inp[key] = i;
      return U.field(label, i, { full: opts.full, span2: opts.span2, required: opts.required, err: opts.err });
    }
    function sel(key, label, options, opts) {
      opts = opts || {};
      var i = el("select", { className: "sve-select", style: { width: "100%" } });
      options.forEach(function (o) {
        var opt = el("option", { value: o.v, textContent: o.t });
        if (String(s[key]) === String(o.v)) opt.selected = true;
        i.appendChild(opt);
      });
      inp[key] = i;
      return U.field(label, i, { full: opts.full, span2: opts.span2, required: opts.required });
    }
    function yn(key, label, onChange) {
      var c = U.yesNo(s[key], function (v) { if (onChange) onChange(v); });
      inp[key] = c;
      return U.field(label, c, {});
    }

    /* Sección 1: datos del seguimiento */
    var fechaIn = el("input", { type: "date", className: "sve-input", value: s.fechaIngreso || "" });
    fechaIn.addEventListener("change", function () {
      var v = fechaIn.value;
      if (v) {
        var p = v.split("-");
        inp.mesR.value = U.MES_LABEL[U.MONTHS[parseInt(p[1], 10) - 1]] || "";
        inp.anioR.value = p[0];
      }
    });
    inp.mesR = el("input", { type: "text", className: "sve-input", value: s.mes || "", readonly: true });
    inp.anioR = el("input", { type: "text", className: "sve-input", value: String(s.anio || ""), readonly: true });
    var sec1 = U.formSection(1, "Datos del seguimiento", el("div", { className: "sve-fgrid sve-fgrid--4" }, [
      U.field("Fecha de ingreso a seguimiento *", fechaIn, {}),
      U.field("Mes (automático)", inp.mesR, {}),
      U.field("Año (automático)", inp.anioR, {}),
      txt("empresa", "Nombre de la empresa", { required: false }),
      sel("modalidad", "Modalidad laboral", [
        { v: "Presencial", t: "Presencial" }, { v: "Remota", t: "Remota" },
        { v: "Incapacidad", t: "Incapacidad" }, { v: "Aislamiento", t: "Aislamiento" }
      ])
    ]));

    /* Sección 2: datos del trabajador */
    var fnac = el("input", { type: "date", className: "sve-input", value: s.fechaNacimiento || "" });
    var edadIn = el("input", { type: "text", className: "sve-input", readonly: true, value: s.fechaNacimiento ? (U.edad(s.fechaNacimiento) + " años") : "" });
    fnac.addEventListener("change", function () { edadIn.value = fnac.value ? (U.edad(fnac.value) + " años") : ""; });
    inp.fechaNacimiento = fnac;
    var sec2 = U.formSection(2, "Datos del trabajador", el("div", { className: "sve-fgrid" }, [
      txt("trabajador", "Nombre completo del trabajador", { required: true, span2: true, ph: "Ej: MARÍA PÉREZ GÓMEZ" }),
      txt("documento", "Documento de identidad", { required: true }),
      txt("telefono", "Teléfono"),
      txt("email", "Correo electrónico", { full: false }),
      sel("genero", "Género", [{ v: "Masculino", t: "Masculino" }, { v: "Femenino", t: "Femenino" }, { v: "Otro", t: "Otro" }]),
      U.field("Fecha de nacimiento", fnac),
      U.field("Edad (automática)", edadIn),
      sel("eps", "EPS", st.catalogos.eps.map(function (e) { return { v: e, t: e }; })),
      sel("afp", "AFP", st.catalogos.afp.map(function (e) { return { v: e, t: e }; })),
      txt("sector", "Sector"),
      sel("cargo", "Cargo", st.catalogos.cargos.map(function (e) { return { v: e, t: e }; })),
      sel("area", "Área de trabajo", st.catalogos.areas.map(function (e) { return { v: e, t: e }; })),
      txt("ciudad", "Ciudad de residencia")
    ]));

    /* Sección 3: evaluación epidemiológica */
    var sec3 = U.formSection(3, "Evaluación epidemiológica", el("div", { className: "sve-fgrid" }, [
      yn("antecedentes", "¿Antecedentes positivos?"),
      txt("tipoAntecedente", "Tipo de antecedente"),
      yn("vulnerable", "¿Población vulnerable?"),
      yn("sintomas", "¿Síntomas COVID?", function (v) {
        inp.cualesSintomas.closest(".sve-field").style.opacity = v === "SI" ? "1" : "0.55";
      }),
      txt("cualesSintomas", "¿Cuáles síntomas?", { span2: true, ph: "Ej: fiebre, tos, pérdida del olfato" }),
      yn("contactoPositivo", "¿Contacto estrecho de positivo?"),
      yn("contactoSintomatico", "¿Contacto con sintomático?"),
      yn("pruebaRapida", "¿Prueba rápida positiva?", function (v) {
        inp.fechaPruebaRapida.closest(".sve-field").style.opacity = v === "SI" ? "1" : "0.55";
      }),
      txt("fechaPruebaRapida", "Fecha prueba rápida", { type: "date" }),
      yn("pcr", "¿PCR confirmatoria positiva?", function (v) {
        inp.fechaPcr.closest(".sve-field").style.opacity = v === "SI" ? "1" : "0.55";
      }),
      txt("fechaPcr", "Fecha PCR positiva", { type: "date" })
    ]));

    /* Sección 4: clasificación y cierre */
    var sec4 = U.formSection(4, "Clasificación y cierre del caso", el("div", { className: "sve-fgrid" }, [
      sel("estado", "Estado del caso *", Object.keys(U.ESTADOS).map(function (k) { return { v: k, t: U.ESTADOS[k].label }; }), { required: true }),
      txt("fechaAislamiento", "Fecha inicio aislamiento", { type: "date" }),
      (function () {
        var ta = el("textarea", { className: "sve-textarea", textContent: s.observaciones || "", placeholder: "Hallazgos, acciones tomadas, seguimiento realizado…" });
        inp.observaciones = ta;
        return U.field("Observaciones", ta, { span2: true, full: true });
      })()
    ]));

    /* savebar */
    var dirty = false;
    function markDirty() { if (!dirty) { dirty = true; saveInfo.textContent = "Cambios sin guardar"; } }
    body.addEventListener("input", markDirty);
    body.addEventListener("change", markDirty);

    var saveInfo = el("span", { textContent: editing ? "Editando registro existente" : "Registro nuevo" });
    var savebar = el("div", { className: "sve-savebar" }, [
      el("div", { className: "sve-savebar__info" }, [icon("save", 15), saveInfo]),
      el("div", { className: "sve-savebar__actions" }, [
        el("button", { className: "sve-btn sve-btn--ghost", onClick: function () { ctx.go(editing ? { name: "caso", id: id } : { name: "seguimiento" }); }, textContent: "Cancelar" }),
        el("button", { className: "sve-btn sve-btn--primary", onClick: save }, [icon("check", 15), "Guardar caso"])
      ])
    ]);

    function val(key) {
      var n = inp[key];
      if (!n) return s[key];
      if (n.getValue) return n.getValue();
      return typeof n.value === "string" ? n.value.trim() : n.value;
    }

    function save() {
      var errs = [];
      ["trabajador", "documento"].forEach(function (k) {
        var f = inp[k] && inp[k].closest(".sve-field");
        if (!val(k)) {
          errs.push(k);
          if (f) f.classList.add("has-err");
        } else if (f) f.classList.remove("has-err");
      });
      if (errs.length) {
        toast("Faltan campos obligatorios", "Nombre del trabajador y documento son obligatorios.", "error");
        return;
      }
      var data = {
        fechaIngreso: val("fechaIngreso") || fechaIn.value || s.fechaIngreso,
        mes: inp.mesR.value, anio: Number(inp.anioR.value) || s.anio,
        empresa: val("empresa"), modalidad: val("modalidad"),
        trabajador: val("trabajador").toUpperCase(), documento: val("documento"),
        telefono: val("telefono"), email: val("email"), genero: val("genero"),
        fechaNacimiento: fnac.value, eps: val("eps"), afp: val("afp"), sector: val("sector"),
        cargo: val("cargo"), area: val("area"), ciudad: val("ciudad"),
        antecedentes: val("antecedentes"), tipoAntecedente: val("tipoAntecedente") || "N/A",
        vulnerable: val("vulnerable"), sintomas: val("sintomas"),
        cualesSintomas: val("cualesSintomas") || "N/A",
        contactoPositivo: val("contactoPositivo"), contactoSintomatico: val("contactoSintomatico"),
        pruebaRapida: val("pruebaRapida"), fechaPruebaRapida: val("fechaPruebaRapida"),
        pcr: val("pcr"), fechaPcr: val("fechaPcr"),
        fechaAislamiento: val("fechaAislamiento"), estado: val("estado"),
        observaciones: inp.observaciones.value.trim()
      };
      if (editing) {
        global.SveStore.updateSeguimiento(id, data);
        toast("Caso actualizado", "Los datos de " + data.trabajador + " se guardaron correctamente.", "success");
        ctx.go({ name: "caso", id: id });
      } else {
        var newId = global.SveStore.addSeguimiento(data);
        /* 📦827 — El número que se muestra es la posición del caso en la lista,
           NO el id. Desde 📦827 los ids son de TEXTO ('msc-…'): sirven para
           que dos máquinas no se pisen al sincronizar, pero no significan
           nada para el usuario — mostrar "N.º msc-muod41h8-abc123" sería
           más confuso que útil. El id se sigue usando para navegar. */
        var numero = global.SveStore.getState().seguimientos.length;
        toast("Seguimiento creado", "Se registró el caso de " + data.trabajador + " (N.º " + numero + ").", "success");
        ctx.go({ name: "caso", id: newId });
      }
    }

    body.appendChild(titleCard);
    body.appendChild(sec1);
    body.appendChild(sec2);
    body.appendChild(sec3);
    body.appendChild(sec4);
    body.appendChild(savebar);
    icons();
  };

  /* ================= PLAN DE TRABAJO (PHVA) ================= */
  V.Plan = function (root, ctx) {
    var st = global.SveStore.getState();
    var body = page(root, buildHeader(ctx, { active: "plan", title: "Plan de trabajo SVE" }));

    /* 📦826 — Indicadores del plan: TODOS se repintan desde `pintarIndicadores()`.
       Antes se calculaban una sola vez al montar la vista, y el repintado de
       una celda AP/AE solo rehecía el `tbody`: la fila TOTALES se actualizaba
       pero el anillo, el chip "Actual", las tarjetas de fase y los trimestres
       se quedaban en el valor viejo. De ahí que el anillo marcara 54% mientras
       la tabla cerraba en 49%: los dos eran correctos en su momento, pero uno
       ya no lo estaba. */
    var chipN = el("span", { textContent: st.plan.length + " actividades" });
    var chipActual = el("span", { textContent: "" });
    var ringHost = el("div", { className: "sve-hero__ring" });
    var fasesCards = el("div", { className: "sve-phva", style: { marginBottom: "18px" } });
    var trimestre = el("div", { className: "sve-legend", style: { marginBottom: "10px" } });

    var hero = el("section", { className: "sve-hero sve-hero--compact" }, el("div", { className: "sve-hero__grid" }, [
      el("div", {}, [
        el("div", { className: "sve-hero__eyebrow" }, [icon("calendar-check-2", 13), "PLAN DE TRABAJO · ACTIVIDADES SEGÚN DIAGNÓSTICO"]),
        el("h1", { className: "sve-hero__title", textContent: "Programa anual " + st.meta.anio + " — ciclo PHVA" }),
        el("p", { className: "sve-hero__desc", textContent: "Escribe sobre una actividad o un responsable para editarlos, y usa «+ Actividad» o el botón de eliminar para agregar o quitar filas. Haz clic en las celdas para programar (AP) y registrar la ejecución (AE). El cumplimiento se calcula como actividades ejecutadas / programadas." }),
        el("div", { className: "sve-hero__meta" }, [
          el("span", { className: "sve-hero__chip" }, [icon("list-checks", 12), chipN]),
          el("span", { className: "sve-hero__chip" }, [icon("target", 12), "Meta de cumplimiento: 85%"]),
          el("span", { className: "sve-hero__chip" }, [icon("trophy", 12), chipActual])
        ])
      ]),
      ringHost
    ]));

    /* Tarjeta de una fase. Cuenta AP/AE sobre las actividades de esa fase; si
       la fase queda sin nada programado muestra 0% en vez de "—", que es lo
       que se ve al agregar la primera actividad de una fase vacía. */
    function tarjetaFase(f, plan) {
      var acts = plan.filter(function (a) { return a.fase === f.id; });
      var ap = 0, ae = 0;
      acts.forEach(function (a) {
        for (var i = 0; i < 12; i++) if (a.meses[i] && a.meses[i][0] === 1) { ap++; if (a.meses[i][1] === 1) ae++; }
      });
      var p = ap ? ae / ap : 0;
      return el("div", { className: "sve-phva__item" }, [
        el("div", { className: "sve-phva__top" }, [
          el("div", { className: "sve-phva__letter", style: { background: f.color }, textContent: String(f.n) }),
          el("div", { className: "sve-phva__pct", textContent: Math.round(p * 100) + "%" })
        ]),
        el("div", { className: "sve-phva__name", textContent: f.name }),
        el("div", { className: "sve-phva__meta", textContent: acts.length + " actividades · " + ae + "/" + ap + " ejecutadas" }),
        el("div", { style: { marginTop: "10px" } }, U.pctBar(p))
      ]);
    }

    function pintarIndicadores() {
      var plan = st.plan;
      var total = cumplPlan(plan) || 0;
      chipN.textContent = plan.length + " actividades";
      chipActual.textContent = "Actual: " + Math.round(total * 100) + "%";
      ringHost.innerHTML = "";
      ringHost.appendChild(U.ringDark(total, "CUMPLIMIENTO"));
      fasesCards.innerHTML = "";
      st.fases.forEach(function (f) { fasesCards.appendChild(tarjetaFase(f, plan)); });
      trimestre.innerHTML = "";
      trimestre.appendChild(el("span", { style: { fontWeight: "800", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }, textContent: "Cumplimiento por trimestre" }));
      trimestre.appendChild(triChip("T1", cumplTrimestre(plan, 0)));
      trimestre.appendChild(triChip("T2", cumplTrimestre(plan, 1)));
      trimestre.appendChild(triChip("T3", cumplTrimestre(plan, 2)));
      trimestre.appendChild(triChip("T4", cumplTrimestre(plan, 3)));
      trimestre.appendChild(triChip("Total", total));
    }

    /* grid */
    var table = el("table", {});
    var thead = el("thead", {}, el("tr", {}, (function () {
      var ths = [el("th", { textContent: "Actividad" }), el("th", { textContent: "Responsable" })];
      U.MONTHS.forEach(function (mo) {
        ths.push(el("th", {}, [el("span", { textContent: mo.slice(0, 3) }), el("span", { className: "sve-apl" }, "AP | AE")]));
      });
      ths.push(el("th", { textContent: "Cumplimiento" }));
      return ths;
    })()));
    var tbody = el("tbody", {});

    function cell(activity, mi, which) {
      var v = activity.meses[mi][which];
      var ap = activity.meses[mi][0];
      var cls = which === 0
        ? (v === 1 ? "sve-cell--1" : "sve-cell--0")
        : (ap === 0 ? "sve-cell--na" : (v === 1 ? "sve-cell--2" : (ap === 1 ? "sve-cell--1 is-pending" : "sve-cell--0")));
      var lbl = which === 0 ? (v === 1 ? "P" : "·") : (ap === 0 ? "—" : (v === 1 ? "E" : "·"));
      return el("button", {
        className: "sve-cell " + cls,
        title: U.MONTHS[mi] + " · " + (which === 0 ? "Programada (AP): " + (v ? "sí" : "no") : "Ejecutada (AE): " + (v ? "sí" : "no")),
        onClick: function () {
          if (which === 0) {
            activity.meses[mi][0] = v ? 0 : 1;
            if (!activity.meses[mi][0]) activity.meses[mi][1] = 0;
          } else {
            if (ap === 0) return;
            activity.meses[mi][1] = v ? 0 : 1;
          }
          global.SveStore.save();
          repaint();
        }
      }, lbl);
    }

    /* Agrega una fila y le deja el foco en el nombre, para escribir de una.
       La fila se localiza por `data-act`, no por posición: el array del store
       ya tiene la actividad nueva, pero el input solo existe después del
       repintado. */
    function agregarActividad(faseId) {
      var id = global.SveStore.addActividad(faseId, {});
      repaint();
      var foco = tbody.querySelector('[data-act="' + id + '"]');
      if (foco) { foco.focus(); foco.select(); }
      toast("Actividad agregada", "Escribe el nombre y asigna el responsable.", "success");
    }

    function eliminarActividad(a) {
      U.confirm({
        title: "Eliminar actividad",
        msg: "Se quitará «" + (a.actividad || "actividad sin nombre") + "» del plan de trabajo. Esta acción no se puede deshacer.",
        okLabel: "Eliminar",
        danger: true,
        onOk: function () {
          global.SveStore.removeActividad(a.id);
          repaint();
          toast("Actividad eliminada", "El plan y el cumplimiento se recalcularon.", "info");
        }
      });
    }

    /* El nombre de una actividad ocupa varias lineas. Con un <input> —de una
       sola— el texto se recortaba ("Definir objetivo, alcance y responsabl...")
       y se perdía justo el dato que hay que leer. Un textarea que se ajusta al
       contenido vuelve a mostrarlo completo.

       El ajuste suma padding y borde a propósito: el prototipo declara
       `box-sizing: border-box` en `.kair-app-sve *`, así que poner
       `height = scrollHeight` deja la caja MÁS CHICA que el texto y el campo
       termina con scrollbar. Sumando el cromado, el alto es el mismo con
       cualquiera de los dos modelos de caja. */
    function ajustarAlto(ta) {
      ta.style.height = "auto";
      var cs = global.getComputedStyle(ta);
      var cromo = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) +
        parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      ta.style.height = Math.max(ta.scrollHeight + (cromo || 0), 22) + "px";
    }

    /* Celda de texto editable en línea. Se ve como texto plano hasta que toma
       el foco: la fila se sigue leyendo como tabla, pero la actividad y el
       responsable se editan escribiendo encima, sin modal ni columna aparte.
       Guarda con `change` (dispara al salir del campo), que es lo que permite
       escribir sin que se repinte la grilla en cada tecla. */
    function celdaTexto(a, campo, clase, placeholder) {
      var ta = el("textarea", {
        className: "sve-inp-celda " + clase,
        rows: 1,
        value: a[campo] || "",
        placeholder: placeholder,
        title: a[campo] || placeholder,
        onInput: function () { ajustarAlto(ta); },
        onChange: function (ev) {
          var v = ev.target.value.trim();
          var patch = {};
          patch[campo] = v;
          global.SveStore.updateActividad(a.id, patch);
        }
      });
      /* La actividad lleva su id en el DOM: sirve para enfocar la fila recién
         creada y para que una prueba pueda localizarla sin depender del
         orden, que cambia al eliminar. */
      if (campo === "actividad") ta.setAttribute("data-act", a.id);
      return ta;
    }

    function repaint() {
      pintarIndicadores();
      tbody.innerHTML = "";
      st.fases.forEach(function (f) {
        tbody.appendChild(el("tr", { className: "sve-phase-row" }, (function () {
          var tds = [
            el("td", { colSpan: "2" }, el("div", { className: "sve-phase-row__head" }, [
              el("span", { className: "sve-fbadge", style: { background: f.color }, textContent: String(f.n) }),
              el("span", { className: "sve-phase-row__name", textContent: f.name }),
              el("button", {
                className: "sve-btn sve-btn--ghost sve-btn--xs",
                title: "Agregar una actividad a la fase " + f.name,
                onClick: function () { agregarActividad(f.id); }
              }, [icon("plus", 12), "Actividad"])
            ]))
          ];
          for (var i = 0; i < 12; i++) tds.push(el("td", { textContent: "" }));
          var p = cumplPlan(st.plan, f.id) || 0;
          tds.push(el("td", { className: "sve-mgrid__cumpl", textContent: Math.round(p * 100) + "%" }));
          return tds;
        })()));
        st.plan.filter(function (a) { return a.fase === f.id; }).forEach(function (a) {
          var tds = [
            el("td", { className: "sve-mgrid__act" }, [
              celdaTexto(a, "actividad", "", "Nombre de la actividad"),
              el("button", {
                className: "sve-rowdel",
                title: "Eliminar esta actividad",
                onClick: function () { eliminarActividad(a); }
              }, icon("trash-2", 13))
            ]),
            el("td", { className: "sve-mgrid__resp" },
              celdaTexto(a, "responsable", "sve-inp-celda--resp", "Responsable"))
          ];
          for (var mi = 0; mi < 12; mi++) {
            tds.push(el("td", {}, el("div", { style: { display: "flex" } }, [cell(a, mi, 0), cell(a, mi, 1)])));
          }
          var p = cumplDeMeses(a.meses);
          var pb = U.pctBar(p === null ? 0 : p);
          tds.push(el("td", { className: "sve-mgrid__cumpl" }, [
            el("span", { textContent: p === null ? "—" : Math.round(p * 100) + "%" }),
            pb
          ]));
          tbody.appendChild(el("tr", {}, tds));
        });
      });
      /* totales */
      var totRow = [el("td", { textContent: "TOTALES" }), el("td", { textContent: "" })];
      var totalAp = 0, totalAe = 0;
      for (var mi = 0; mi < 12; mi++) {
        var apm = 0, aem = 0;
        st.plan.forEach(function (a) {
          if (a.meses[mi] && a.meses[mi][0] === 1) { apm++; if (a.meses[mi][1] === 1) aem++; }
        });
        totalAp += apm; totalAe += aem;
        totRow.push(el("td", { style: { padding: "9px 4px", fontSize: "11px", fontWeight: "800", color: "var(--sve-text-2)" }, textContent: aem + "/" + apm }));
      }
      totRow.push(el("td", { className: "sve-mgrid__cumpl", textContent: totalAp ? Math.round(totalAe / totalAp * 100) + "%" : "—" }));
      tbody.appendChild(el("tr", { className: "sve-total-row", style: { background: "var(--sve-surface-2)" } }, totRow));
      /* El alto de los textarea se mide YA en el DOM: antes de insertarlos,
         `scrollHeight` es 0 y todos quedarían con una sola línea. */
      Array.prototype.forEach.call(tbody.querySelectorAll(".sve-inp-celda"), ajustarAlto);
      icons();
    }

    /* trimestres */
    function triChip(label, p) {
      var good = p >= 0.85, warn = p >= 0.6;
      return el("div", { className: "sve-hero__chip", style: { background: "var(--sve-surface-2)", border: "1px solid var(--sve-border)", color: "var(--sve-text-2)" } }, [
        el("span", { textContent: label + ": " }),
        el("b", { style: { color: good ? "var(--sve-success)" : warn ? "var(--sve-warning)" : "var(--sve-danger)", marginLeft: "2px" }, textContent: Math.round(p * 100) + "%" })
      ]);
    }

    function exportPlan() {
      try {
        var X = global.XLSX;
        if (!X) throw new Error("SheetJS no disponible");
        var rows = [];
        st.fases.forEach(function (f) {
          rows.push({ "FASE": f.n + ". " + f.name, "ACTIVIDAD": "", "RESPONSABLE": "" });
          st.plan.filter(function (a) { return a.fase === f.id; }).forEach(function (a) {
            var o = { "FASE": "", "ACTIVIDAD": a.actividad, "RESPONSABLE": a.responsable };
            for (var i = 0; i < 12; i++) {
              o[U.MONTHS[i] + " AP"] = a.meses[i][0];
              o[U.MONTHS[i] + " AE"] = a.meses[i][1];
            }
            var p = cumplDeMeses(a.meses);
            o["CUMPLIMIENTO"] = p === null ? "" : Math.round(p * 100) + "%";
            rows.push(o);
          });
        });
        var ws = X.utils.json_to_sheet(rows);
        var wb = X.utils.book_new();
        X.utils.book_append_sheet(wb, ws, "Plan SVE");
        X.writeFile(wb, "SVE_Plan_PHVA_" + st.meta.anio + ".xlsx");
        toast("Exportación lista", "Se descargó el plan de trabajo en XLSX.", "success");
      } catch (e) {
        toast("No se pudo exportar", String(e && e.message || e), "error");
      }
    }

    var toolbar = el("div", { className: "sve-toolbar" }, [
      el("div", { className: "sve-toolbar__left" }, el("div", { className: "sve-legend" }, [
        el("span", {}, [el("span", { className: "sve-legend__swatch", style: { background: "linear-gradient(135deg,#185abd,#4da6ff)" } }), "Programado (AP)"]),
        el("span", {}, [el("span", { className: "sve-legend__swatch", style: { background: "linear-gradient(135deg,#218838,#28a745)" } }), "Ejecutado (AE)"]),
        el("span", {}, [el("span", { className: "sve-legend__swatch", style: { background: "var(--sve-warning-soft)" } }), "Pendiente"]),
        el("span", {}, [el("span", { className: "sve-legend__swatch", style: { background: "var(--sve-surface-2)", border: "1px solid var(--sve-border)" } }), "No programado"])
      ])),
      el("div", { className: "sve-toolbar__right" }, [
        el("button", { className: "sve-btn sve-btn--ghost", onClick: exportPlan }, [icon("file-spreadsheet", 15), "Exportar XLSX"])
      ])
    ]);

    body.appendChild(hero);
    body.appendChild(fasesCards);
    body.appendChild(el("section", { className: "sve-section" }, [toolbar, trimestre, el("div", { className: "sve-mgrid" }, el("table", {}, [thead, tbody]))]));
    repaint();
    icons();
  };

  /* ================= INDICADORES ================= */
  V.Indicadores = function (root, ctx) {
    var st = global.SveStore.getState();
    var ind = _conjuntoSeguro(st.indicadores);
    var body = page(root, buildHeader(ctx, { active: "indicadores", title: "Indicadores SVE" }));

    var hero = el("section", { className: "sve-hero sve-hero--compact" }, el("div", {}, [
      el("div", { className: "sve-hero__eyebrow" }, [icon("line-chart", 13), "INDICADORES SUGERIDOS · PROCESO, ESTRUCTURA Y RESULTADO"]),
      el("h1", { className: "sve-hero__title", textContent: "Medición anual de indicadores" }),
      el("p", { className: "sve-hero__desc", textContent: "Serie histórica de prevalencia, incidencia, ausentismo y eficacia del programa, con las metas y la formulación definidas en la herramienta de gestión." })
    ]));

    function yearTable(cfg, rowsFn) {
      var ths = [el("th", { textContent: "Concepto" })];
      cfg.anios.forEach(function (y) { ths.push(el("th", { textContent: String(y) })); });
      var head = el("tr", {}, ths);
      var bodyRows = [];
      rowsFn.forEach(function (r) {
        var tds = [el("td", { textContent: r.label })];
        /* 📦830 — la fila se arma por COLUMNA (año), no por el largo del arreglo:
           una serie desalineada no puede dejar filas con celdas de más. */
        cfg.anios.forEach(function (y, i) {
          var v = Array.isArray(r.vals) ? r.vals[i] : undefined;
          var txt = (v === null || v === undefined) ? "—" : String(v);
          var cls = "is-val";
          if (r.good !== undefined) cls += r.good(i) ? " is-good" : " is-bad";
          tds.push(el("td", { className: cls, textContent: txt }));
        });
        bodyRows.push(el("tr", {}, tds));
      });
      return el("table", { className: "sve-ytable" }, [el("thead", {}, head), el("tbody", {}, bodyRows)]);
    }

    /* 📦830 — botón Editar por card (patrón "Análisis por periodos"). Vive en el
       head de AMBAS ramas de indCard: con y sin serie anual. */
    function editBtn(clave) {
      return el("button", {
        className: "sve-btn sve-btn--sm sve-btn--ghost", title: "Editar indicador",
        onClick: function () { editIndicador(clave); }
      }, [icon("pencil", 12), "Editar"]);
    }
    function headDerecha(cfg) {
      return el("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
        el("span", { className: "sve-pill sve-pill--gray", textContent: cfg.periodicidad }),
        editBtn(cfg.clave)
      ]);
    }

    function indCard(cfg) {
      var i = cfg.anios.length - 1;
      /* Sin serie anual no hay "año actual" que mirar: antes salía
         "undefined · Meta: ..." y la vista se rompía al calcular sobre [-1]. */
      if (!cfg.anios.length) {
        return el("div", { className: "sve-card" }, [
          el("div", { className: "sve-card__head" }, [
            el("div", { className: "sve-card__title" }, [icon(cfg.icon, 15), cfg.nombre]),
            headDerecha(cfg)
          ]),
          el("div", { className: "sve-card__body" }, [
            el("div", { className: "sve-ind__formul", textContent: cfg.formulacion }),
            el("div", { className: "sve-empty" },
              el("div", { className: "sve-empty__msg", textContent: "Sin serie anual registrada para este indicador." }))
          ])
        ]);
      }
      return el("div", { className: "sve-card" }, [
        el("div", { className: "sve-card__head" }, [
          el("div", { className: "sve-card__title" }, [icon(cfg.icon, 15), cfg.nombre]),
          headDerecha(cfg)
        ]),
        el("div", { className: "sve-card__body" }, [
          el("div", { className: "sve-ind__formul", textContent: cfg.formulacion }),
          el("div", { className: "sve-ind__cur" }, [
            el("div", { className: "sve-ind__curval " + (cfg.good(i) ? "is-good" : "is-bad"), textContent: cfg.current(i) }),
            el("div", { className: "sve-ind__curvs", textContent: cfg.anios[i] + " · Meta: " + cfg.meta })
          ]),
          cfg.table
        ])
      ]);
    }

    function pctOf(casos, prom) { return prom ? (casos / prom) : 0; }
    function tasaOf(ratio) { return ratio * 100000; }

    var prevalencia = ind.prevalencia, incidencia = ind.incidencia, ausentismo = ind.ausentismo, eficacia = ind.eficacia;
    var lastP = prevalencia.anios.length - 1;

    var cardPrev = indCard({
      clave: "prevalencia",
      nombre: prevalencia.nombre, icon: "thermometer", meta: prevalencia.metaCorta, periodicidad: prevalencia.periodicidad,
      anios: prevalencia.anios,
      formulacion: prevalencia.formulacion,
      current: function (i) { return U.fmtPct(pctOf(prevalencia.casos[i], prevalencia.promedio[i])); },
      good: function (i) { return _bienMenor(prevalencia, pctOf(prevalencia.casos[i], prevalencia.promedio[i])); },
      table: yearTable(prevalencia, [
        { label: "Casos (nuevos y antiguos)", vals: prevalencia.casos },
        { label: "Promedio trabajadores expuestos", vals: prevalencia.promedio.map(function (n) { return U.fmtNum(n); }) },
        { label: "% Prevalencia", vals: prevalencia.promedio.map(function (p, i) { return U.fmtPct(pctOf(prevalencia.casos[i], p)); }) },
        {
          label: "Tasa (Res. 0312/2019)", vals: prevalencia.promedio.map(function (p, i) {
            var t = tasaOf(pctOf(prevalencia.casos[i], p));
            return t ? t.toFixed(1) : "0";
          })
        }
      ])
    });

    var cardInc = indCard({
      clave: "incidencia",
      nombre: incidencia.nombre, icon: "trending-up", meta: incidencia.metaCorta, periodicidad: incidencia.periodicidad,
      anios: incidencia.anios,
      formulacion: incidencia.formulacion,
      current: function (i) { return U.fmtPct(pctOf(incidencia.casosNuevos[i], incidencia.promedio[i])); },
      good: function (i) { return _bienMenor(incidencia, pctOf(incidencia.casosNuevos[i], incidencia.promedio[i])); },
      table: yearTable(incidencia, [
        { label: "Casos nuevos", vals: incidencia.casosNuevos },
        { label: "Promedio trabajadores expuestos", vals: incidencia.promedio.map(function (n) { return U.fmtNum(n); }) },
        { label: "% Incidencia", vals: incidencia.promedio.map(function (p, i) { return U.fmtPct(pctOf(incidencia.casosNuevos[i], p)); }) },
        {
          label: "Tasa (Res. 0312/2019)", vals: incidencia.promedio.map(function (p, i) {
            var t = tasaOf(pctOf(incidencia.casosNuevos[i], p));
            return t ? t.toFixed(1) : "0";
          })
        }
      ])
    });

    var cardAus = indCard({
      clave: "ausentismo",
      nombre: ausentismo.nombre, icon: "calendar-x-2", meta: ausentismo.metaCorta, periodicidad: ausentismo.periodicidad,
      anios: ausentismo.anios,
      formulacion: ausentismo.formulacion,
      current: function (i) { return U.fmtPct(pctOf(ausentismo.diasIncapacidad[i], ausentismo.diasProgramados[i]), 2); },
      /* Sin umbral cargado (default) queda verde, como siempre; si alguien pone
         umbral en el editor, ahí sí se empieza a pintar en rojo. */
      good: function (i) { return _bienMenor(ausentismo, pctOf(ausentismo.diasIncapacidad[i], ausentismo.diasProgramados[i])); },
      table: yearTable(ausentismo, [
        { label: "Días de ausencia (incapacidad)", vals: ausentismo.diasIncapacidad },
        { label: "Días de trabajo programados", vals: ausentismo.diasProgramados.map(function (n) { return U.fmtNum(n); }) },
        { label: "% Ausentismo", vals: ausentismo.diasProgramados.map(function (d, i) { return U.fmtPct(pctOf(ausentismo.diasIncapacidad[i], d), 2); }) },
        {
          label: "Tasa (Res. 0312/2019)", vals: ausentismo.diasProgramados.map(function (d, i) {
            var t = tasaOf(pctOf(ausentismo.diasIncapacidad[i], d));
            return t ? t.toFixed(1) : "0";
          })
        }
      ])
    });

    var cardEfi = indCard({
      clave: "eficacia",
      nombre: eficacia.nombre, icon: "award", meta: eficacia.metaCorta, periodicidad: eficacia.periodicidad,
      anios: eficacia.anios,
      formulacion: eficacia.formulacion,
      current: function (i) { return U.fmtPct(eficacia.implementadas[i] / (eficacia.sugeridas[i] || 1), 0); },
      good: function (i) { return _bienMayor(eficacia, eficacia.implementadas[i] / (eficacia.sugeridas[i] || 1)); },
      table: yearTable(eficacia, [
        { label: "No. mejoras sugeridas", vals: eficacia.sugeridas },
        { label: "No. mejoras implementadas", vals: eficacia.implementadas },
        { label: "% Eficacia", vals: eficacia.sugeridas.map(function (s, i) { return U.fmtPct(eficacia.implementadas[i] / (s || 1), 0); }) }
      ])
    });

    /* 📦832 — Casos SVE por año (reemplaza "Registros de morbilidad").
       El programa es de vigilancia COVID-19 (sus indicadores son prevalencia,
       incidencia y ausentismo POR COVID), así que la tarjeta resume SUS
       seguimientos por año en vez de traer morbilidad laboral general
       (accidentes/ENFERMEDADES comunes), que ya cubren los submódulos
       3.3.4/3.3.5 de Gestión de la Salud. Los datos de morbilidad NO se
       borran: siguen en mp_sve_morbilidad y su puente queda intacto. */
    var cardCasos = (function () {
      var segs = Array.isArray(st.seguimientos) ? st.seguimientos : [];
      var anios = [];
      segs.forEach(function (s) {
        var y = Number(s && s.anio);
        if (y && anios.indexOf(y) === -1) anios.push(y);
      });
      anios.sort(function (a, b) { return a - b; });

      function esPositivo(s) {
        return String(s && s.pcr).toUpperCase() === "SI" ||
          String(s && s.pruebaRapida).toUpperCase() === "SI";
      }
      function cuenta(fn) {
        return anios.map(function (y) {
          var n = 0;
          segs.forEach(function (s) { if (Number(s && s.anio) === y && fn(s)) n++; });
          return n;
        });
      }
      var rows = [
        { label: "Seguimientos (total)", vals: cuenta(function () { return true; }) },
        { label: "Positivos (PCR / prueba rápida)", vals: cuenta(esPositivo) },
        { label: "En aislamiento", vals: cuenta(function (s) { return s && s.estado === "aislamiento"; }) },
        { label: "Altas", vals: cuenta(function (s) { return s && s.estado === "alta"; }) },
        { label: "Descartados", vals: cuenta(function (s) { return s && s.estado === "descartado"; }) }
      ];

      return el("div", { className: "sve-card" }, [
        el("div", { className: "sve-card__head" }, [
          el("div", { className: "sve-card__title" }, [icon("activity", 15), "Casos SVE por año"]),
          el("span", { className: "sve-pill sve-pill--teal", textContent: "COVID · seguimientos" })
        ]),
        el("div", { className: "sve-card__body", style: { overflowX: "auto" } },
          anios.length
            ? yearTable({ anios: anios }, rows)
            : el("div", { className: "sve-empty" }, [
                el("div", { className: "sve-empty__ico" }, icon("activity", 22)),
                el("div", { className: "sve-empty__ttl", textContent: "Sin seguimientos" }),
                el("div", { className: "sve-empty__msg", textContent: "Registra un seguimiento epidemiológico para ver el resumen anual de casos." })
              ]))
      ]);
    })();

    /* análisis por periodos */
    var cardAn = el("div", { className: "sve-card" }, [
      el("div", { className: "sve-card__head" }, [
        el("div", { className: "sve-card__title" }, [icon("search-check", 15), "Análisis de indicadores por periodos"]),
        el("button", { className: "sve-btn sve-btn--sm sve-btn--soft", onClick: function () { nuevoAnalisis(); } }, [icon("plus", 12), "Nuevo período"])
      ]),
      el("div", { className: "sve-card__body" }, st.analisis.length ? st.analisis.map(function (a, idx) {
        return el("div", { style: { padding: idx ? "16px 0 4px" : "0", borderTop: idx ? "1px solid var(--sve-border)" : "none" } }, [
          el("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" } }, [
            el("div", { style: { fontSize: "13.5px", fontWeight: "800" }, textContent: a.periodo }),
            el("button", { className: "sve-btn sve-btn--sm sve-btn--ghost", onClick: function () { editAnalisis(idx); } }, [icon("pencil", 12), "Editar"])
          ]),
          el("div", { style: { marginTop: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" } }, [
            el("div", { style: { padding: "11px 13px", background: "var(--sve-surface-2)", borderRadius: "9px", borderLeft: "3px solid var(--sve-teal)" } }, [
              el("div", { style: { fontSize: "10.5px", fontWeight: "800", color: "var(--sve-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "4px" }, textContent: "Hallazgos" }),
              el("div", { style: { fontSize: "12.5px", lineHeight: "1.55", color: "var(--sve-text-2)" }, textContent: a.hallazgos || "—" })
            ]),
            el("div", { style: { padding: "11px 13px", background: "var(--sve-surface-2)", borderRadius: "9px", borderLeft: "3px solid var(--sve-primary)" } }, [
              el("div", { style: { fontSize: "10.5px", fontWeight: "800", color: "var(--sve-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "4px" }, textContent: "Propuestas de mejora" }),
              el("div", { style: { fontSize: "12.5px", lineHeight: "1.55", color: "var(--sve-text-2)" }, textContent: a.propuestas || "—" })
            ])
          ]),
          el("div", { style: { marginTop: "8px", fontSize: "11.5px", fontWeight: "700", color: "var(--sve-muted)" }, textContent: "Responsable: " + (a.responsable || "—") })
        ]);
      }) : el("div", { className: "sve-empty" }, [
        el("div", { className: "sve-empty__ico" }, icon("search-check", 22)),
        el("div", { className: "sve-empty__ttl", textContent: "Sin análisis por periodos" }),
        el("div", { className: "sve-empty__msg", textContent: "Crea el primer análisis con el botón \"Nuevo período\"." })
      ]))
    ]);

    function editAnalisis(idx) {
      var a = st.analisis[idx];
      var h = el("textarea", { className: "sve-textarea", style: { minHeight: "90px" }, textContent: a.hallazgos || "" });
      var p = el("textarea", { className: "sve-textarea", style: { minHeight: "90px" }, textContent: a.propuestas || "" });
      var r = el("input", { className: "sve-input", value: a.responsable || "" });
      U.confirm({
        title: "Editar análisis · " + a.periodo,
        wide: true,
        body: el("div", {}, [
          U.field("Hallazgos", h, { full: true }),
          el("div", { style: { height: "12px" } }),
          U.field("Propuestas de mejora", p, { full: true }),
          el("div", { style: { height: "12px" } }),
          U.field("Responsable", r, { full: true })
        ]),
        okLabel: "Guardar",
        onOk: function () {
          global.SveStore.updateAnalisis(idx, { hallazgos: h.value.trim(), propuestas: p.value.trim(), responsable: r.value.trim() });
          toast("Análisis actualizado", "El periodo " + a.periodo + " fue actualizado.", "success");
          global.SveApp.refresh();
        }
      });
    }

    /* 📦833 — alta de un análisis nuevo: mismo formulario y misma
       reapertura-con-errores que editIndicador (U.confirm cierra ANTES de
       llamar onOk, sve-core.js:178, así que un dato inválido no puede
       "retener" la ventana: se avisa con toast y se reabre con lo escrito). */
    function nuevoAnalisis(preset, errs) {
      errs = errs || {};
      var s = preset || {};
      var periodo = (s.periodo !== undefined) ? s.periodo : "";
      var hall = (s.hallazgos !== undefined) ? s.hallazgos : "";
      var prop = (s.propuestas !== undefined) ? s.propuestas : "";
      var resp = (s.responsable !== undefined) ? s.responsable : "";
      var siguiente = st.analisis.length + 1;

      var fPer = el("input", { className: "sve-input", value: periodo, placeholder: "Ej.: " + siguiente + ". ENERO - JUNIO" });
      var fHal = el("textarea", { className: "sve-textarea", style: { minHeight: "90px" }, textContent: hall });
      var fPro = el("textarea", { className: "sve-textarea", style: { minHeight: "90px" }, textContent: prop });
      var fRes = el("input", { className: "sve-input", value: resp });

      function campo(label, input, o) {
        o = o || {};
        var f = U.field(label, input, { full: o.full, required: o.required, err: o.err });
        if (o.err) f.classList.add("has-err");
        return f;
      }

      function capturar() {
        return {
          periodo: fPer.value, hallazgos: fHal.value, propuestas: fPro.value,
          responsable: fRes.value
        };
      }
      function guardar() {
        var errores = [];
        var errs2 = {};
        var per = String(fPer.value || "").trim();
        if (!per) {
          errores.push("el periodo no puede quedar vacío");
          errs2.periodo = "Escribe el nombre del periodo (ej.: " + siguiente + ". ENERO - JUNIO).";
        } else {
          var dup = st.analisis.some(function (a) {
            return String(a && a.periodo || "").trim().toLowerCase() === per.toLowerCase();
          });
          if (dup) {
            errores.push('ya existe un análisis para el periodo "' + per + '"');
            errs2.periodo = "Ese periodo ya existe: edita el existente en su tarjeta.";
          }
        }
        if (errores.length) {
          toast("Revisa el formulario", errores.join(" · "), "error");
          nuevoAnalisis(capturar(), errs2);
          return;
        }
        global.SveStore.addAnalisis({
          periodo: per,
          hallazgos: String(fHal.value || "").trim(),
          propuestas: String(fPro.value || "").trim(),
          responsable: String(fRes.value || "").trim()
        });
        toast("Análisis creado", "El periodo " + per + " se agregó a la lista.", "success");
        global.SveApp.refresh();
      }

      U.confirm({
        title: "Nuevo análisis por periodo",
        wide: true,
        body: el("div", {}, [
          campo("Periodo", fPer, { full: true, required: true, err: errs.periodo }),
          el("div", { style: { height: "12px" } }),
          campo("Hallazgos", fHal, { full: true }),
          el("div", { style: { height: "12px" } }),
          campo("Propuestas de mejora", fPro, { full: true }),
          el("div", { style: { height: "12px" } }),
          campo("Responsable", fRes, { full: true })
        ]),
        okLabel: "Crear análisis",
        onOk: guardar
      });
      /* al reabrir con error, el foco va al periodo inválido */
      setTimeout(function () { if (errs.periodo && fPer && fPer.focus) fPer.focus(); }, 40);
    }

    /* 📦830 — editor completo de un indicador: definición (nombre, metas,
       periodicidad, formulación, umbral) + serie anual (años y valores).
       OJO: U.confirm cierra el modal ANTES de llamar onOk (sve-core.js:171),
       así que una validación fallida no puede "retener" la ventana: se avisa
       con toast y se vuelve a abrir el formulario con lo ya escrito (capturar). */
    var IND_PERIODICIDADES = ["ANUAL", "TRIMESTRAL", "SEMESTRAL", "CUATRIMESTRAL"];

    /* 📦831: errs = { nombre?, umbral?, serie?, anios? } son los errores del intento
       anterior de guardado; el formulario se repinte con el detalle en CADA campo
       (antes solo salía un toast genérico y había que adivinar qué falló). */
    function editIndicador(clave, preset, errs) {
      errs = errs || {};
      var def = ind[clave];
      if (!def) return;
      var medidas = IND_MEDIDAS[clave] || [];
      var s = preset || {};
      var nombre = (s.nombre !== undefined) ? s.nombre : (def.nombre || "");
      var meta = (s.meta !== undefined) ? s.meta : (def.meta || "");
      var metaCorta = (s.metaCorta !== undefined) ? s.metaCorta : (def.metaCorta || "");
      var formulacion = (s.formulacion !== undefined) ? s.formulacion : (def.formulacion || "");
      var periodicidad = (s.periodicidad !== undefined) ? s.periodicidad : (def.periodicidad || "");
      var umbral = (s.umbral !== undefined) ? s.umbral : def.umbral;
      /* ausentismo no tiene umbral: su semáforo queda verde (default null). */
      var conUmbral = clave !== "ausentismo";
      var aniosVals = ((s.anios !== undefined ? s.anios : def.anios) || []).map(function (y) { return String(y); });
      var datos = {};
      medidas.forEach(function (m) {
        var base = (s.datos && s.datos[m] !== undefined) ? s.datos[m] : def[m];
        var arr = Array.isArray(base) ? base.slice() : [];
        while (arr.length < aniosVals.length) arr.push(null);
        datos[m] = arr.map(function (v) { return (v === null || v === undefined) ? "" : String(v); });
      });

      /* --- campos de definición --- */
      var fName = el("input", { className: "sve-input", value: nombre });
      var fMetaCorta = el("input", { className: "sve-input", value: metaCorta });
      var fMeta = el("input", { className: "sve-input", value: meta });
      var fPeriod = el("select", { className: "sve-select" });
      var opciones = IND_PERIODICIDADES.slice();
      if (periodicidad && opciones.indexOf(periodicidad) === -1) opciones.push(periodicidad);
      opciones.forEach(function (p) {
        var opt = el("option", { value: p, textContent: p });
        if (p === (periodicidad || "ANUAL")) opt.selected = true;
        fPeriod.appendChild(opt);
      });
      var fForm = el("textarea", { className: "sve-textarea", style: { minHeight: "70px" }, textContent: formulacion });
      var fUmbral = el("input", {
        className: "sve-input", type: "number", min: "0", max: "1", step: "0.01",
        value: (umbral === null || umbral === undefined) ? "" : String(umbral)
      });

      /* --- helpers de maquetación del formulario (📦831) --- */
      function campo(label, input, o) {
        o = o || {};
        var f = U.field(label, input, { full: o.full, required: o.required, err: o.err });
        if (o.err) f.classList.add("has-err");
        if (o.hint) f.insertBefore(el("div", { className: "sve-field__hint", textContent: o.hint }), f.querySelector(".sve-field__err"));
        return f;
      }
      function seccion(titulo, ayuda, accion) {
        return el("div", { className: "sve-edit-sec" }, [
          el("div", { className: "sve-edit-sec__t", textContent: titulo }),
          ayuda ? el("div", { className: "sve-edit-sec__a", textContent: ayuda }) : null,
          accion ? el("div", { className: "sve-edit-sec__r" }, [accion]) : null
        ]);
      }
      function grid2(a, b) { return el("div", { className: "sve-edit-grid2" }, [a, b]); }

      /* --- editor de la serie anual (se repinta al agregar/quitar año) ---
         📦831: filas en REJILLA con la MISMA plantilla de columnas
         (220px + N columnas de año) para que la cabecera de años y cada fila de
         valores queden alineados columna a columna; el contenedor con scroll
         horizontal evita que las filas se estiren al ancho de la ventana.
         La columna de etiquetas mide 220px porque la más larga
         ("Promedio trabajadores expuestos") a 12px negrita necesita ~205px:
         con 170px salía cortada con puntos. */
      var serieBox = el("div", {});
      var inpAnios = [];
      function quitarAnio(i) {
        aniosVals.splice(i, 1);
        medidas.forEach(function (m) { datos[m].splice(i, 1); });
        pintarSerie();
      }
      function agregarAnio() {
        var ult = aniosVals.length ? parseInt(aniosVals[aniosVals.length - 1], 10) : NaN;
        aniosVals.push(isNaN(ult) ? "" : String(ult + 1));
        medidas.forEach(function (m) { datos[m].push(""); });
        pintarSerie();
      }
      function pintarSerie() {
        serieBox.textContent = "";
        inpAnios = [];
        var n = Math.max(aniosVals.length, 1);
        var cols = "220px repeat(" + n + ", minmax(92px, 1fr))";
        var inner = el("div", { className: "sve-serie__in", style: { minWidth: (220 + n * 98) + "px" } });
        function fila(hijos) {
          return el("div", { className: "sve-serie__row", style: { "grid-template-columns": cols } }, hijos);
        }
        var filaAnio = fila([el("div", { className: "sve-serie__lbl sve-serie__lbl--head", textContent: "Año" })]);
        /* 📦831: la fila de años es la CABECERA de la tabla (tinte + línea),
           no una fila de datos más: así se distingue de un vistazo. */
        filaAnio.classList.add("sve-serie__row--head");
        aniosVals.forEach(function (y, i) {
          var errAnio = errs.anios && errs.anios[i];
          var inp = el("input", {
            className: "sve-input sve-serie__inp" + (errAnio ? " is-err" : ""),
            maxLength: 4, inputMode: "numeric", value: y,
            placeholder: "AAAA",
            "aria-label": "Año " + (i + 1) + (y ? " · " + y : ""),
            title: errAnio || (y ? "" : "Ej.: 2024"),
            onInput: function (ev) { aniosVals[i] = ev.target.value; }
          });
          inpAnios[i] = inp;
          /* 📦831: el botón × va posicionado ABSOLUTO adentro de la celda (clase
             .sve-serie__del): si vive en el flujo resta ancho al input y la
             columna de años queda más angosta que las de valores (se desalineaban
             los bordes). El input reserva su espacio con padding-right. */
          filaAnio.appendChild(el("div", { className: "sve-serie__cell sve-serie__cell--anio" }, [
            inp,
            el("button", {
              className: "sve-btn sve-btn--sm sve-btn--ghost sve-serie__del",
              title: "Quitar año " + (y || ""),
              "aria-label": "Quitar año " + (y || String(i + 1)),
              onClick: function () { quitarAnio(i); }
            }, [icon("x", 12)])
          ]));
        });
        inner.appendChild(filaAnio);
        medidas.forEach(function (m) {
          var txtM = IND_MEDIDAS_TXT[m] || m;
          var filaM = fila([el("div", { className: "sve-serie__lbl", textContent: txtM, title: txtM })]);
          aniosVals.forEach(function (y, i) {
            filaM.appendChild(el("div", { className: "sve-serie__cell" }, [
              el("input", {
                className: "sve-input sve-serie__inp", inputMode: "decimal",
                value: datos[m][i] || "",
                placeholder: "—",
                "aria-label": txtM + (y ? " · año " + y : " · columna " + (i + 1)),
                onInput: function (ev) { datos[m][i] = ev.target.value; }
              })
            ]));
          });
          inner.appendChild(filaM);
        });
        serieBox.appendChild(el("div", { className: "sve-serie" }, [inner]));
        serieBox.appendChild(el("div", { className: "sve-field__hint", style: { marginTop: "6px" }, textContent: "Escribe el valor de cada medida en su año. Deja vacío un año sin dato: los porcentajes y las tasas se calculan solos en la tarjeta." }));
        U.refreshIcons();
      }
      pintarSerie();
      var btnAnio = el("button", { className: "sve-btn sve-btn--sm sve-btn--soft", onClick: agregarAnio }, [icon("plus", 12), " Agregar año"]);

      /* --- guardar / reabrir --- */
      function _num(v) {
        if (v === null || v === undefined) return null;
        var t = String(v).trim().replace(/\s/g, "").replace(",", ".");
        if (t === "") return null;
        var n = Number(t);
        return isNaN(n) ? null : n;
      }
      function capturar() {
        var d = {};
        medidas.forEach(function (m) { d[m] = datos[m].slice(); });
        return {
          nombre: fName.value, meta: fMeta.value, metaCorta: fMetaCorta.value,
          formulacion: fForm.value, periodicidad: fPeriod.value,
          umbral: conUmbral ? fUmbral.value : null,
          anios: aniosVals.slice(), datos: d
        };
      }
      function guardar() {
        var errores = [];
        /* 📦831: además del mensaje global, cada error queda asociado a su campo
           para repintar el formulario con el detalle en el lugar correcto. */
        var errs = { anios: {} };
        var nom = String(fName.value || "").trim();
        if (!nom) { errores.push("el nombre no puede quedar vacío"); errs.nombre = "Escribe un nombre para el indicador."; }
        var anios = [], vistos = {};
        aniosVals.forEach(function (crudo, i) {
          var t = String(crudo === null || crudo === undefined ? "" : crudo).trim();
          if (!/^\d{4}$/.test(t)) {
            errores.push('el año "' + (t || "en blanco") + '" debe tener 4 cifras (ej. 2024)');
            errs.anios[i] = "Debe tener 4 cifras (ej. 2024).";
            return;
          }
          if (vistos[t]) { errores.push("el año " + t + " está repetido"); errs.anios[i] = "Año repetido."; return; }
          vistos[t] = true;
          anios.push(parseInt(t, 10));
        });
        if (!aniosVals.length) { errores.push("agrega al menos un año a la serie"); errs.serie = "Agrega al menos un año a la serie."; }
        var umb = null;
        if (conUmbral) {
          var raw = String(fUmbral.value || "").trim();
          if (raw !== "") {
            var nu = Number(raw.replace(",", "."));
            if (isNaN(nu) || nu < 0 || nu > 1) {
              errores.push("el umbral debe estar entre 0 y 1");
              errs.umbral = "Debe estar entre 0 y 1 (ej. 0,75 = 75%).";
            }
            else umb = nu;
          }
        }
        if (errores.length) {
          toast("Revisa el formulario", errores.join(" · "), "error");
          editIndicador(clave, capturar(), errs);
          return;
        }
        var patch = {
          nombre: nom,
          meta: String(fMeta.value || "").trim(),
          metaCorta: String(fMetaCorta.value || "").trim(),
          formulacion: String(fForm.value || "").trim(),
          periodicidad: fPeriod.value,
          umbral: umb,
          anios: anios
        };
        medidas.forEach(function (m) {
          var arr = [];
          for (var k = 0; k < anios.length; k++) arr.push(_num(datos[m][k]));
          patch[m] = arr;
        });
        global.SveStore.updateIndicador(clave, patch);
        toast("Indicador actualizado", "Se guardaron los datos de " + nom + ".", "success");
        global.SveApp.refresh();
      }

      U.confirm({
        title: "Editar indicador · " + (String(nombre || "").trim() || def.nombre),
        wide: true,
        body: el("div", {}, [
          seccion("Definición del indicador", "Nombre, metas, periodicidad y umbral del semáforo."),
          el("div", { className: "sve-edit-fields" }, [
            campo("Nombre del indicador", fName, { full: true, required: true, err: errs.nombre }),
            grid2(
              campo("Meta corta (tarjeta)", fMetaCorta, { hint: "Texto corto que se muestra en la tarjeta compacta." }),
              campo("Periodicidad", fPeriod)
            ),
            grid2(
              campo("Meta completa", fMeta),
              conUmbral ? campo("Umbral (0 a 1)", fUmbral, { err: errs.umbral, hint: "Vacío = sin umbral (semáforo verde). Ej.: 0,75 = 75%." }) : null
            ),
            campo("Fórmula", fForm, { full: true, hint: "Ej.: (Casos ÷ Trabajadores expuestos) × 100." }),
            conUmbral ? null : el("div", { className: "sve-field__hint", textContent: "Este indicador no usa umbral: su semáforo queda en verde." })
          ]),
          seccion("Serie anual (valores por año)", "Años y cifras de cada medida.", btnAnio),
          errs.serie ? el("div", { className: "sve-edit-alert", textContent: errs.serie }) : null,
          serieBox
        ]),
        okLabel: "Guardar",
        onOk: guardar
      });
      /* 📦831: al reabrir con errores, el foco va al primer campo inválido
         (antes solo salía un toast y había que buscar a mano qué falló). */
      setTimeout(function () {
        var alvo = null;
        if (errs.nombre) alvo = fName;
        else if (errs.umbral) alvo = fUmbral;
        else if (errs.anios) {
          var ks = Object.keys(errs.anios);
          if (ks.length) alvo = inpAnios[parseInt(ks[0], 10)];
        }
        if (alvo && typeof alvo.focus === "function") alvo.focus();
      }, 40);
    }

    body.appendChild(hero);
    body.appendChild(el("section", { className: "sve-section sve-ind" }, [cardPrev, cardInc]));
    body.appendChild(el("section", { className: "sve-section sve-ind" }, [cardAus, cardEfi]));
    body.appendChild(el("section", { className: "sve-section sve-grid-2" }, [cardCasos, cardAn]));
    icons();
  };

  /* ================= ÁREAS EXPUESTAS ================= */
  V.Areas = function (root, ctx) {
    var st = global.SveStore.getState();
    var body = page(root, buildHeader(ctx, { active: "areas", title: "Áreas expuestas" }));

    var hero = el("section", { className: "sve-hero sve-hero--compact" }, el("div", {}, [
      el("div", { className: "sve-hero__eyebrow" }, [icon("map-pin", 13), "ANÁLISIS DE ÁREAS EXPUESTAS"]),
      el("h1", { className: "sve-hero__title", textContent: "Distribución de la población vigilada" }),
      el("p", { className: "sve-hero__desc", textContent: "Análisis dinámico de los seguimientos registrados según área de trabajo, género y cargo — equivalente a la tabla dinámica de áreas expuestas de la herramienta." })
    ]));

    var total = st.seguimientos.length;
    var confirmados = st.seguimientos.filter(isConfirmado).length;

    function groupBy(key) {
      var map = {};
      st.seguimientos.forEach(function (s) {
        var k = s[key] || "Sin asignar";
        if (!map[k]) map[k] = { n: 0, conf: 0 };
        map[k].n++;
        if (isConfirmado(s)) map[k].conf++;
      });
      return Object.keys(map).map(function (k) { return { name: k, n: map[k].n, conf: map[k].conf }; })
        .sort(function (a, b) { return b.n - a.n; });
    }

    var porArea = groupBy("area");
    var top = porArea.slice(0, 4);
    while (top.length < 4) top.push({ name: "—", n: 0, conf: 0 });
    var areaCards = el("div", { className: "sve-area-cards", style: { marginBottom: "18px" } }, top.map(function (a, i) {
      var icos = ["building-2", "warehouse", "utensils", "syringe"];
      return el("div", { className: "sve-areacard", style: { animationDelay: i * 60 + "ms" } }, [
        el("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } }, [
          el("div", { className: "sve-areacard__name", textContent: a.name }),
          el("span", { className: "sve-kpi__ico", style: { width: "30px", height: "30px", background: "var(--sve-primary-soft)", color: "var(--sve-primary)" } }, icon(icos[i % 4], 14))
        ]),
        el("div", { className: "sve-areacard__val", textContent: String(a.n) }),
        el("div", { className: "sve-areacard__sub", textContent: a.conf + " confirmados · " + Math.round(a.n / (total || 1) * 100) + "% del total" })
      ]);
    }));

    /* hbars por área */
    var maxA = porArea.length ? porArea[0].n : 1;
    var cardArea = el("div", { className: "sve-card" }, [
      el("div", { className: "sve-card__head" }, el("div", { className: "sve-card__title" }, [icon("bar-chart-horizontal", 15), "Seguimientos por área de trabajo"])),
      el("div", { className: "sve-card__body" }, porArea.map(function (a) {
        return U.hbar(a.name, a.n, maxA, a.conf ? "linear-gradient(90deg,#dc2626,#f87171)" : "var(--sve-grad-brand)");
      }))
    ]);

    /* género */
    var genero = groupBy("genero");
    var maxG = genero.length ? genero[0].n : 1;
    var cardGen = el("div", { className: "sve-card" }, [
      el("div", { className: "sve-card__head" }, el("div", { className: "sve-card__title" }, [icon("users", 15), "Distribución por género"])),
      el("div", { className: "sve-card__body" }, genero.map(function (g) {
        return U.hbar(g.name, g.n, maxG, g.name === "Femenino" ? "linear-gradient(90deg,#c026d3,#e879f9)" : "linear-gradient(90deg,#174ea6,#4da6ff)");
      }))
    ]);

    /* pivot cargo × área */
    var cargos = groupBy("cargo");
    var areasList = st.catalogos.areas;
    var pivot = (function () {
      var ths = [el("th", { textContent: "Cargo", style: { textAlign: "left", paddingLeft: "10px" } })];
      areasList.forEach(function (a) { ths.push(el("th", { textContent: a })); });
      ths.push(el("th", { textContent: "Total" }));
      var rows = [];
      cargos.forEach(function (c) {
        var tds = [el("td", { textContent: c.name })];
        var sum = 0;
        areasList.forEach(function (a) {
          var n = st.seguimientos.filter(function (s) { return (s.cargo || "Sin asignar") === c.name && s.area === a; }).length;
          sum += n;
          tds.push(el("td", { textContent: n ? String(n) : "·", style: n ? { fontWeight: "800" } : { color: "var(--sve-muted)" } }));
        });
        tds.push(el("td", { className: "is-val", textContent: String(sum) }));
        rows.push(el("tr", {}, tds));
      });
      var trow = [el("td", { textContent: "Total general" })];
      var grand = 0;
      areasList.forEach(function (a) {
        var n = st.seguimientos.filter(function (s) { return s.area === a; }).length;
        grand += n;
        trow.push(el("td", { className: "is-val", textContent: String(n) }));
      });
      trow.push(el("td", { className: "is-val", textContent: String(grand) }));
      rows.push(el("tr", { style: { background: "var(--sve-surface-2)" } }, trow));
      return el("table", { className: "sve-ytable", style: { minWidth: "560px" } }, [
        el("thead", {}, el("tr", {}, ths)),
        el("tbody", {}, rows)
      ]);
    })();
    var cardPivot = el("div", { className: "sve-card" }, [
      el("div", { className: "sve-card__head" }, [
        el("div", { className: "sve-card__title" }, [icon("table-2", 15), "Casos por cargo y área"]),
        el("span", { className: "sve-pill sve-pill--teal" }, [el("span", { className: "sve-pill__dot" }), total + " vigilados · " + confirmados + " confirmados"])
      ]),
      el("div", { className: "sve-card__body", style: { overflowX: "auto" } }, pivot)
    ]);

    body.appendChild(hero);
    body.appendChild(areaCards);
    body.appendChild(el("section", { className: "sve-section sve-grid-2" }, [cardArea, cardGen]));
    body.appendChild(el("section", { className: "sve-section" }, cardPivot));
    icons();
  };

  global.SveViews = V;
})(typeof window !== "undefined" ? window : this);

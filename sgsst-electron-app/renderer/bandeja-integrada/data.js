/* ============================================================
 * K+AIR Bandeja Integrada — Datos Mock (vanilla JS)
 * ============================================================
 * En producción estos datos provendrían de electronAPI:
 *   window.kairAPI.mail.list()           → Promise<{success, data: KairMail[]}>
 *   window.kairAPI.calendar.listEvents() → Promise<{success, data: KairEvent[]}>
 * El renderer NO calcula reglas de negocio; solo renderiza.
 * ============================================================ */

window.KairData = (function () {

  // ====== Categorías oficiales K+AIR ======
  const EVENT_CATEGORIES = {
    plan:          { id: "plan",          label: "Plan de Trabajo",  color: "#174ea6", bg: "#e8f0fe", border: "#c5d9f5" },
    capacitacion:  { id: "capacitacion",  label: "Capacitación",     color: "#28a745", bg: "#e6f7ec", border: "#b8e6c5" },
    auditoria:     { id: "auditoria",     label: "Auditoría",        color: "#b8860b", bg: "#fff8e1", border: "#ffe69b" },
    actualizacion: { id: "actualizacion", label: "Actualización",    color: "#6c757d", bg: "#eef0f3", border: "#d6dae0" },
    formacion:     { id: "formacion",     label: "Formación",        color: "#185abd", bg: "#eaf2fc", border: "#c2d8f3" },
    critico:       { id: "critico",       label: "Crítico / Vence",  color: "#dc3545", bg: "#fdeaea", border: "#f5c2c7" },
  };

  // ====== Configuración del mes vigente =====
  // 📦594 — Inicializar dinámicamente desde la fecha actual del sistema.
  // Antes estaba hardcoded a 2026-07-21 → la app siempre mostraba ese día
  // aunque pasaran los días. Ahora se recalcula cada vez que se carga el módulo.
  // El campo `label` se asigna más abajo, después de que MONTH_LABELS_ES exista.
  const _now594 = new Date();
  const _todayIso594 = _now594.getFullYear() + "-" +
    String(_now594.getMonth() + 1).padStart(2, "0") + "-" +
    String(_now594.getDate()).padStart(2, "0");
  const MONTH_VIEW = {
    year: _now594.getFullYear(),
    month: _now594.getMonth(), // 0-indexed
    label: "", // se asigna después de MONTH_LABELS_ES
    todayIso: _todayIso594,
    firstDayOfWeek: 1, // Lunes
  };

  const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // ====== Helper: generar grilla mensual (6×7 = 42 celdas) ======
  function isoDate(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function buildMonthGrid(year, month) {
    // F4 — buildMonthGrid ahora acepta (year, month) opcionales. Si no se pasan,
    // usa MONTH_VIEW (default = mes actual hardcoded). Permite navegar entre
    // meses desde el mini-cal (botones chevron del header).
    var y = (year !== undefined) ? year : MONTH_VIEW.year;
    var m = (month !== undefined) ? month : MONTH_VIEW.month;
    var firstOfMonth = new Date(y, m, 1);
    var startWeekday = firstOfMonth.getDay();
    startWeekday = (startWeekday - MONTH_VIEW.firstDayOfWeek + 7) % 7;

    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var daysInPrevMonth = new Date(y, m, 0).getDate();

    var cells = [];
    for (var i = startWeekday - 1; i >= 0; i--) {
      var d = daysInPrevMonth - i;
      var prevMonth = m - 1 < 0 ? 11 : m - 1;
      var prevYear = m - 1 < 0 ? y - 1 : y;
      cells.push({ iso: isoDate(prevYear, prevMonth, d), day: d, inMonth: false, isToday: false });
    }
    for (var dd = 1; dd <= daysInMonth; dd++) {
      var iso = isoDate(y, m, dd);
      cells.push({ iso: iso, day: dd, inMonth: true, isToday: iso === MONTH_VIEW.todayIso });
    }
    var nextDay = 1;
    while (cells.length < 42) {
      var nextMonth = m + 1 > 11 ? 0 : m + 1;
      var nextYear = m + 1 > 11 ? y + 1 : y;
      cells.push({ iso: isoDate(nextYear, nextMonth, nextDay), day: nextDay, inMonth: false, isToday: false });
      nextDay++;
    }
    var grid = [];
    for (var row = 0; row < 6; row++) {
      grid.push(cells.slice(row * 7, row * 7 + 7));
    }
    return grid;
  }

  const MONTH_GRID = buildMonthGrid();

  // F4 — Label dinámico del mes para el header del mini-cal
  const MONTH_LABELS_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  // 📦594 — Asignar label del mes vigente ahora que MONTH_LABELS_ES existe
  MONTH_VIEW.label = MONTH_LABELS_ES[_now594.getMonth()] + " " + _now594.getFullYear();
  function buildMonthLabel(year, month) {
    return MONTH_LABELS_ES[month] + " " + year;
  }

  // ====== Correos ======
  const MAILS = [
    {
      id: "m1",
      sender: "María Camila Reyes",
      senderEmail: "mreyes@kair-sst.co",
      avatarColor: "#174ea6",
      subject: "Invitación: Reunión Comité de Convivencia — Julio 22",
      preview: "Se convoca al Comité de Convivencia para revisar los casos de acoso laboral reportados en el segundo trimestre…",
      body: "Estimado equipo,\n\nSe convoca al Comité de Convivencia Laboral para el próximo martes 22 de julio a las 10:00 a.m. en la sala de juntas del piso 4.\n\nAgenda propuesta:\n1. Revisión de casos reportados durante el segundo trimestre (3 casos).\n2. Estado de los planes de acción derivados del trimestre anterior.\n3. Capacitación obligatoria sobre protocolo de acoso laboral (Resolución 652 de 2012).\n4. Definición de responsables y próximos seguimientos.\n\nSe solicita confirmación de asistencia antes del lunes 21 de julio. Los documentos de soporte se adjuntan al correo.\n\nCordialmente,\nMaría Camila Reyes\nCoordinadora SG-SST",
      time: "09:42",
      timeMinutes: 582,
      unread: true,
      flagged: true,
      category: "meeting",
      hasAttachment: true,
      meetingSuggestion: {
        title: "Comité de Convivencia Laboral Q2",
        date: "2026-07-22",
        startHour: 10,
        durationHours: 1.5,
        location: "Sala de Juntas P4 — Sede Norte",
        attendees: ["mreyes@kair-sst.co", "jrobles@kair-sst.co", "daponte@kair-sst.co"],
        eventCategory: "plan",
      },
    },
    {
      id: "m2",
      sender: "Sistema ARL",
      senderEmail: "notificaciones@arl.com.co",
      avatarColor: "#dc3545",
      subject: "URGENTE: Vence informe de accidentalidad — 24 horas",
      preview: "El informe mensual de accidentalidad debe radicarse antes del 19 de julio. Registro pendiente: 3 eventos…",
      body: "Se le notifica que el Informe Mensual de Accidentalidad correspondiente al mes de junio vence en 24 horas.\n\nResumen de eventos pendientes de radicar:\n- 1 accidente con baja médica (caso AC-2026-014)\n- 2 incidentes sin consecuencias (INC-2026-031, INC-2026-032)\n\nDebe completar el formulario FURAT antes de las 23:59 del 19 de julio. Pasado este plazo, la empresa será reportada con inconsistencia ante el Ministerio del Trabajo.\n\nPara iniciar el radicación ingrese al portal de la ARL con sus credenciales corporativas.",
      time: "08:15",
      timeMinutes: 495,
      unread: true,
      flagged: true,
      category: "urgent",
      hasAttachment: false,
      meetingSuggestion: {
        title: "Radicación FURAT — Junio 2026",
        date: "2026-07-19",
        startHour: 16,
        durationHours: 2,
        location: "Oficina SG-SST",
        attendees: ["jrobles@kair-sst.co"],
        eventCategory: "critico",
      },
    },
    {
      id: "m3",
      sender: "Javier Robles",
      senderEmail: "jrobles@kair-sst.co",
      avatarColor: "#28a745",
      subject: "Re: Plan anual de capacitación 2026 — Aprobación",
      preview: "Adjunto el plan definitivo con los ajustes solicitados por auditoría. Quedo atento a sus comentarios…",
      body: "Buen día,\n\nAdjunto el Plan Anual de Capacitación 2026 con los ajustes solicitados por la auditoría interna:\n- Reorganización de prioridades por nivel de riesgo.\n- Inclusión de 2 capacitaciones adicionales sobre trabajo en alturas.\n- Cronograma redistribuido para los meses de septiembre y noviembre.\n\nQuedo atento a sus comentarios para proceder con la firma y radicación ante el Ministerio del Trabajo.",
      time: "Ayer",
      timeMinutes: -60,
      unread: false,
      flagged: false,
      category: "normal",
      hasAttachment: true,
    },
    {
      id: "m4",
      sender: "Diana Aponte (RRHH)",
      senderEmail: "daponte@kair-sst.co",
      avatarColor: "#6c757d",
      subject: "Invitación: Entrevista de reincorporación — Caso PRI-045",
      preview: "Programamos la entrevista de reincorporación del trabajador del caso PRI-045 para el 23 de julio…",
      body: "Se programa la entrevista de reincorporación laboral correspondiente al caso PRI-045 (trabajador en proceso de reintegro post-incapacidad).\n\nFecha: 23 de julio, 9:00 a.m.\nLugar: Oficina de Talento Humano\nParticipantes: trabajador, médico laboral, coordinadora SG-SST, líder de RRHH.\n\nSe solicita traer el formato PI-FO-076 actualizado y el concepto de rehabilitación.",
      time: "Ayer",
      timeMinutes: -120,
      unread: false,
      flagged: false,
      category: "meeting",
      hasAttachment: false,
      meetingSuggestion: {
        title: "Entrevista Reincorporación PRI-045",
        date: "2026-07-23",
        startHour: 9,
        durationHours: 1,
        location: "Oficina Talento Humano",
        attendees: ["daponte@kair-sst.co", "jrobles@kair-sst.co"],
        eventCategory: "auditoria",
      },
    },
    {
      id: "m5",
      sender: "Auditoría Externa",
      senderEmail: "auditoria@externa.co",
      avatarColor: "#dc3545",
      subject: "Recordatorio: Sesión de cierre de auditoría — 25 de julio",
      preview: "Le recordamos la sesión de cierre de la auditoría externa SG-SST programada para el 25 de julio…",
      body: "Cordial saludo,\n\nLe recordamos que la sesión de cierre de la auditoría externa SG-SST está programada para el 25 de julio a las 14:00 horas.\n\nEn esta sesión se presentarán los hallazgos, las no conformidades y el plan de mejora propuesto. Su asistencia es obligatoria como representante legal de la empresa.\n\nDuración estimada: 2 horas.",
      time: "Lun",
      timeMinutes: -1440,
      unread: true,
      flagged: false,
      category: "meeting",
      hasAttachment: true,
      meetingSuggestion: {
        title: "Cierre Auditoría Externa SG-SST",
        date: "2026-07-25",
        startHour: 14,
        durationHours: 2,
        location: "Sala de Juntas P3 — Sede Centro",
        attendees: ["auditoria@externa.co", "jrobles@kair-sst.co"],
        eventCategory: "critico",
      },
    },
    {
      id: "m6",
      sender: "Plataforma K+AIR",
      senderEmail: "no-reply@kair-sst.co",
      avatarColor: "#174ea6",
      subject: "Resumen semanal — Indicadores SG-SST",
      preview: "Cumplimiento global: 87% · Capacitaciones realizadas: 12/15 · Pendientes: 3 · Vencidos: 1…",
      body: "Resumen semanal de indicadores K+AIR:\n\n- Cumplimiento global SG-SST: 87%\n- Capacitaciones programadas: 15\n- Capacitaciones realizadas: 12\n- Pendientes: 3\n- Vencidas: 1\n- Accidentes del periodo: 1\n- Incidentes del periodo: 2\n- Casos PRI activos: 4\n\nPuede revisar el detalle en el módulo de Indicadores.",
      time: "Lun",
      timeMinutes: -1560,
      unread: false,
      flagged: false,
      category: "normal",
      hasAttachment: false,
    },
    {
      id: "m7",
      sender: "Carlos Mejía",
      senderEmail: "cmejia@kair-sst.co",
      avatarColor: "#28a745",
      subject: "Inspección de seguridad — Zona de producción",
      preview: "Programemos la inspección de seguridad de la zona de producción para esta semana. Disponibilidad:…",
      body: "Hola,\n\nNecesitamos programar la inspección de seguridad de la zona de producción antes del cierre de mes.\n\nMi disponibilidad:\n- Miércoles 23: 8:00 - 10:00 a.m.\n- Jueves 24: 2:00 - 4:00 p.m.\n\nConfírmame cuál opción te funciona para agendarla en el calendario.",
      time: "Dom",
      timeMinutes: -2880,
      unread: false,
      flagged: false,
      category: "normal",
      hasAttachment: false,
    },
  ];

  // ====== Eventos del mes ======
  const EVENTS = [
    { id: "e1",  title: "Realizar Actividad 01",                date: "2026-07-01", startHour: 9,  durationHours: 1,   category: "plan",          location: "Oficina SG-SST" },
    { id: "e2",  title: "Inspección preliminar",                date: "2026-07-02", startHour: 10, durationHours: 2,   category: "auditoria",     location: "Planta" },
    { id: "e3",  title: "Capacitación Riesgo Eléctrico",        date: "2026-07-03", startHour: 8,  durationHours: 3,   category: "capacitacion",  location: "Sala P2" },
    { id: "e4",  title: "Actualización matriz legal",           date: "2026-07-04", startHour: 14, durationHours: 2,   category: "actualizacion", location: "Oficina" },
    { id: "e5",  title: "Formación brigadas",                   date: "2026-07-04", startHour: 16, durationHours: 1,   category: "formacion" },
    { id: "e6",  title: "Plan Trabajo Semana 2",                date: "2026-07-07", startHour: 8,  durationHours: 1,   category: "plan" },
    { id: "e7",  title: "Auditoría interna SG-SST",             date: "2026-07-08", startHour: 9,  durationHours: 4,   category: "auditoria",     location: "Sala Juntas P3" },
    { id: "e8",  title: "Capacitación Alturas",                 date: "2026-07-09", startHour: 8,  durationHours: 4,   category: "capacitacion",  location: "Sala P2" },
    { id: "e9",  title: "Vence FURAT Junio",                    date: "2026-07-09", startHour: 23, durationHours: 1,   category: "critico" },
    { id: "e10", title: "Reunión Comité Convivencia",           date: "2026-07-10", startHour: 10, durationHours: 1.5, category: "plan" },
    { id: "e11", title: "Inspección seguridad — Planta",        date: "2026-07-21", startHour: 9,  durationHours: 1.5, category: "plan",          location: "Zona Producción", attendees: ["cmejia@kair-sst.co"] },
    { id: "e12", title: "Capacitación: Trabajo en Alturas",     date: "2026-07-21", startHour: 14, durationHours: 2,   category: "capacitacion",  location: "Sala Capacitación P2", attendees: ["12 trabajadores"] },
    { id: "e13", title: "Comité Convivencia Q2",                date: "2026-07-22", startHour: 10, durationHours: 1.5, category: "plan",          location: "Sala Juntas P4", linkedMailId: "m1", attendees: ["mreyes@kair-sst.co"] },
    { id: "e14", title: "Entrevista Reincorporación PRI-045",   date: "2026-07-23", startHour: 9,  durationHours: 1,   category: "auditoria",     location: "Talento Humano", linkedMailId: "m4" },
    { id: "e15", title: "Reunión equipos SST",                  date: "2026-07-23", startHour: 15, durationHours: 1,   category: "actualizacion", location: "Sala P1" },
    { id: "e16", title: "Revisión PAE — Plan Anual",            date: "2026-07-24", startHour: 11, durationHours: 1,   category: "plan" },
    { id: "e17", title: "Cierre Auditoría Externa",             date: "2026-07-25", startHour: 14, durationHours: 2,   category: "critico",       location: "Sala Juntas P3", linkedMailId: "m5", attendees: ["auditoria@externa.co"] },
    { id: "e18", title: "Formación primeros auxilios",          date: "2026-07-25", startHour: 8,  durationHours: 3,   category: "formacion" },
    { id: "e19", title: "Plan Trabajo Semana 4",                date: "2026-07-28", startHour: 8,  durationHours: 1,   category: "plan" },
    { id: "e20", title: "Capacitación Riesgo Biológico",        date: "2026-07-29", startHour: 9,  durationHours: 2,   category: "capacitacion" },
    { id: "e21", title: "Actualización matriz de riesgo",       date: "2026-07-30", startHour: 14, durationHours: 3,   category: "actualizacion" },
    { id: "e22", title: "Formación extintores",                 date: "2026-07-31", startHour: 10, durationHours: 2,   category: "formacion" },
    { id: "e23", title: "Seguimiento caso PRI-040",             date: "2026-07-14", startHour: 11, durationHours: 1,   category: "auditoria" },
    { id: "e24", title: "Vence Plan de Emergencia",             date: "2026-07-15", startHour: 23, durationHours: 1,   category: "critico" },
    { id: "e25", title: "Inspección mensual extintores",        date: "2026-07-16", startHour: 9,  durationHours: 2,   category: "auditoria" },
    { id: "e26", title: "Capacitación inducción nuevo personal",date: "2026-07-17", startHour: 8,  durationHours: 4,   category: "capacitacion" },
    { id: "e27", title: "Plan trabajo semanal",                 date: "2026-07-18", startHour: 7,  durationHours: 1,   category: "plan" },
  ];

  // ====== Iconos SVG inline (reemplazan a lucide-react) ======
  const ICONS = {
    back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>',
    panelClose: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><path d="M14 8l-2 2 2 2"/></svg>',
    panelOpen: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><path d="M13 8l2 2-2 2"/></svg>',
    calendar: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    mail: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    bell: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    settings: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    building: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>',
    chevronDown: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    refresh: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    inbox: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
    star: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    mailOpen: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7l10 6 10-6"/><path d="M2 7v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7"/><path d="M2 7l5-3h10l5 3"/></svg>',
    paperclip: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
    calendarPlus: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 17h.01M12 17h.01M16 17h.01M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7z"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="9" y1="11" x2="15" y2="11"/></svg>',
    reply: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>',
    replyAll: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 17 2 12 7 7"/><path d="M12 18v-2a4 4 0 0 0-4-4H2"/><polyline points="17 17 22 12 17 7"/></svg>',
    forward: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>',
    archive: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
    trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    folder: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    printer: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    more: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
    alertTriangle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    send: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    clock: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    mapPin: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    users: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    save: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    checkCircle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    mouseClick: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 9l5 12 1.8-5.2L21 14z"/></svg>',
    chevronLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    chevronRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    chevronUp: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
  };

  return {
    EVENT_CATEGORIES,
    MONTH_VIEW,
    WEEKDAY_LABELS,
    MONTH_GRID,
    MONTH_LABELS_ES,
    MAILS,
    EVENTS,
    ICONS,
    buildMonthGrid,
    buildMonthLabel,
  };
})();

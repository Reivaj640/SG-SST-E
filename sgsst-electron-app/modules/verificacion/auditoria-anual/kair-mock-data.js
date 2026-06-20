/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Mock data (reducido, 4 auditorías)
   v3.0 · 2026-06-19

   Datos demo basados en Tempoactiva 2024. En F9 se reemplaza por
   el AuditoriaService real (cargarTodo, guardarAuditoria, etc.).
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  function uid(prefix, n) {
    return prefix + '-' + String(n).padStart(3, '0');
  }

  /* ─── Empresa activa ──────────────────────────────────── */
  var ACTIVE_COMPANY = {
    id: 'tempoactiva',
    nombre: 'Tempoactiva EST S.A.S.',
    nit: '900.567.890-1',
    direccion: 'Cra 45 # 67-89, Bogotá D.C.',
    ciudad: 'Bogotá D.C.',
    telefono: '+57 (1) 345 6789',
    actividadEconomica: 'Servicios temporales de personal',
    numEmpleados: 110,
    gerente: 'Freddy Torres',
    encargadoSgsst: 'Javier Robles',
    encargadoSgsstEmail: 'sg-sst@tempoactiva.com.co',
    auditorLider: 'Elayne Margarita Bolívar Domínguez'
  };

  /* ─── 4 auditorías (1 por estado principal) ─────────── */
  var audits = [
    {
      id: 'AUD-2025-001',
      code: 'AUD-2025-001',
      year: 2025,
      process: 'Auditoría interna anual — Decreto 1072 de 2015',
      auditType: 'interna',
      status: 'vencida',
      empresa: ACTIVE_COMPANY.nombre,
      nit: ACTIVE_COMPANY.nit,
      actividadEconomica: ACTIVE_COMPANY.actividadEconomica,
      direccion: ACTIVE_COMPANY.direccion,
      ciudad: ACTIVE_COMPANY.ciudad,
      telefono: ACTIVE_COMPANY.telefono,
      numEmpleados: ACTIVE_COMPANY.numEmpleados,
      gerente: ACTIVE_COMPANY.gerente,
      encargadoSgsst: ACTIVE_COMPANY.encargadoSgsst,
      encargadoSgsstEmail: ACTIVE_COMPANY.encargadoSgsstEmail,
      auditorLider: ACTIVE_COMPANY.auditorLider,
      auditores: ['Elaine Bolívar', 'Carlos Ruiz'],
      auditados: ['Javier Robles', 'Ana Martínez'],
      objective: 'Verificar el cumplimiento del SG-SST conforme al Decreto 1072 de 2015, Sección 2.2.4.6',
      alcance: 'Todos los procesos del SG-SST de Tempoactiva EST S.A.S.',
      criterio: 'Decreto 1072 de 2015, Resolución 0312 de 2019',
      metodologia: 'Verificación documental + visita de campo',
      participacionCopasst: 'Sí — entrevista con presidente del COPASST',
      procesos: [],
      cronograma: [],
      tipoVerificacion: 'documental_campo',
      fechaProgramada: '2025-12-09',
      fechaEntrega: '2025-12-15',
      fechaVisitaDocumental: '2025-12-09',
      fechaVisitaCampo: '2025-12-10',
      entrevistados: [],
      desempenoEtapas: [],
      desempenoComponentes: [],
      indicadoresSgsst: [],
      hallazgos: [],
      planAccion: [],
      firmas: [],
      createdAt: '2025-12-01T10:00:00.000Z',
      updatedAt: '2025-12-01T10:00:00.000Z'
    },
    {
      id: 'AUD-2025-002',
      code: 'AUD-2025-002',
      year: 2025,
      process: 'Auditoría de seguimiento — Plan de acción 2024',
      auditType: 'seguimiento',
      status: 'en_curso',
      empresa: ACTIVE_COMPANY.nombre,
      nit: ACTIVE_COMPANY.nit,
      actividadEconomica: ACTIVE_COMPANY.actividadEconomica,
      direccion: ACTIVE_COMPANY.direccion,
      ciudad: ACTIVE_COMPANY.ciudad,
      telefono: ACTIVE_COMPANY.telefono,
      numEmpleados: ACTIVE_COMPANY.numEmpleados,
      gerente: ACTIVE_COMPANY.gerente,
      encargadoSgsst: ACTIVE_COMPANY.encargadoSgsst,
      encargadoSgsstEmail: ACTIVE_COMPANY.encargadoSgsstEmail,
      auditorLider: ACTIVE_COMPANY.auditorLider,
      auditores: ['Elaine Bolívar'],
      auditados: ['Javier Robles'],
      objective: 'Verificar el cierre de los hallazgos de la auditoría 2024',
      alcance: 'Plan de acción derivado de hallazgos 2024',
      criterio: 'Decreto 1072 de 2015',
      metodologia: 'Verificación documental',
      participacionCopasst: 'No aplica',
      procesos: [],
      cronograma: [],
      tipoVerificacion: 'documental',
      fechaProgramada: '2025-06-15',
      fechaVisitaDocumental: '2025-06-15',
      entrevistados: [],
      desempenoEtapas: [],
      desempenoComponentes: [],
      indicadoresSgsst: [],
      hallazgos: [],
      planAccion: [],
      firmas: [],
      createdAt: '2025-06-01T10:00:00.000Z',
      updatedAt: '2025-06-15T14:30:00.000Z'
    },
    {
      id: 'AUD-2024-001',
      code: 'AUD-2024-001',
      year: 2024,
      process: 'Auditoría interna anual 2024',
      auditType: 'interna',
      status: 'realizada',
      empresa: ACTIVE_COMPANY.nombre,
      nit: ACTIVE_COMPANY.nit,
      actividadEconomica: ACTIVE_COMPANY.actividadEconomica,
      direccion: ACTIVE_COMPANY.direccion,
      ciudad: ACTIVE_COMPANY.ciudad,
      telefono: ACTIVE_COMPANY.telefono,
      numEmpleados: ACTIVE_COMPANY.numEmpleados,
      gerente: ACTIVE_COMPANY.gerente,
      encargadoSgsst: ACTIVE_COMPANY.encargadoSgsst,
      encargadoSgsstEmail: ACTIVE_COMPANY.encargadoSgsstEmail,
      auditorLider: ACTIVE_COMPANY.auditorLider,
      auditores: ['Elaine Bolívar', 'Carlos Ruiz', 'Ana Martínez'],
      auditados: ['Javier Robles', 'Equipo SG-SST'],
      objective: 'Verificar el cumplimiento del SG-SST conforme al Decreto 1072 de 2015',
      alcance: 'Todos los procesos del SG-SST',
      criterio: 'Decreto 1072 de 2015, Resolución 0312 de 2019',
      metodologia: 'Verificación documental + visita de campo',
      participacionCopasst: 'Sí',
      procesos: [],
      cronograma: [],
      tipoVerificacion: 'documental_campo',
      fechaProgramada: '2024-12-09',
      fechaEntrega: '2024-12-20',
      fechaVisitaDocumental: '2024-12-09',
      fechaVisitaCampo: '2024-12-10',
      entrevistados: [],
      desempenoEtapas: [],
      desempenoComponentes: [],
      indicadoresSgsst: [],
      hallazgos: [],
      planAccion: [],
      firmas: [],
      createdAt: '2024-12-01T08:00:00.000Z',
      updatedAt: '2024-12-20T17:00:00.000Z'
    },
    {
      id: 'AUD-2026-001',
      code: 'AUD-2026-001',
      year: 2026,
      process: 'Auditoría interna anual Decreto 1072 de 2015',
      auditType: 'interna',
      status: 'programada',
      empresa: ACTIVE_COMPANY.nombre,
      nit: ACTIVE_COMPANY.nit,
      actividadEconomica: ACTIVE_COMPANY.actividadEconomica,
      direccion: ACTIVE_COMPANY.direccion,
      ciudad: ACTIVE_COMPANY.ciudad,
      telefono: ACTIVE_COMPANY.telefono,
      numEmpleados: ACTIVE_COMPANY.numEmpleados,
      gerente: ACTIVE_COMPANY.gerente,
      encargadoSgsst: ACTIVE_COMPANY.encargadoSgsst,
      encargadoSgsstEmail: ACTIVE_COMPANY.encargadoSgsstEmail,
      auditorLider: ACTIVE_COMPANY.auditorLider,
      auditores: ['Elaine Bolívar'],
      auditados: ['Javier Robles'],
      objective: 'Verificar el cumplimiento del SG-SST conforme al Decreto 1072 de 2015',
      alcance: 'Todos los procesos del SG-SST',
      criterio: 'Decreto 1072 de 2015, Resolución 0312 de 2019',
      metodologia: 'Verificación documental + visita de campo',
      participacionCopasst: 'Sí',
      procesos: [],
      cronograma: [],
      tipoVerificacion: 'documental_campo',
      fechaProgramada: '2026-12-09',
      entrevistados: [],
      desempenoEtapas: [],
      desempenoComponentes: [],
      indicadoresSgsst: [],
      hallazgos: [],
      planAccion: [],
      firmas: [],
      createdAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-01-15T10:00:00.000Z'
    }
  ];

  /* ─── 9 Hallazgos (mezcla de estados) ──────────────────── */
  var hallazgos = [
    {
      id: 'HAL-2024-001',
      auditId: 'AUD-2024-001',
      componente: 'RESPONSABILIDADES',
      tipo: 'NC',
      criticidad: 'alta',
      descripcion: 'No se evidencia en perfiles de cargo de Asesor SST que se incluyan las responsabilidades como: procurar el cuidado integral de su salud, suministrar información clara, veraz y completa sobre su estado de salud, entre otras.',
      evidencia: 'Manual de funciones, perfiles de cargo 2024',
      fechaDeteccion: '2024-12-09',
      estado: 'cerrada',
      fechaCompromisoCierre: '2025-03-15',
      fechaCierreReal: '2025-02-20'
    },
    {
      id: 'HAL-2024-002',
      auditId: 'AUD-2024-001',
      componente: 'NORMATIVIDAD',
      tipo: 'NC',
      criticidad: 'media',
      descripcion: 'Se tiene un aplicativo a través de la ARL Colmena que permite descargar matrices legales y de normas, aplicable al sector económico de la empresa y al sector correspondiente a la actividad económica.',
      evidencia: 'Reporte ARL Colmena 2024-Q3',
      fechaDeteccion: '2024-12-10',
      estado: 'verificada',
      fechaCompromisoCierre: '2025-04-30'
    },
    {
      id: 'HAL-2024-003',
      auditId: 'AUD-2024-001',
      componente: 'RESPUESTA A EMERGENCIAS',
      tipo: 'NC',
      criticidad: 'critica',
      descripcion: 'No se ha realizado simulacro de emergencia y no se ha realizado plan de ayuda mutua.',
      evidencia: 'Acta COPASST 2024, registros brigada',
      fechaDeteccion: '2024-12-10',
      estado: 'vencida',
      fechaCompromisoCierre: '2025-02-28'
    },
    {
      id: 'HAL-2024-004',
      auditId: 'AUD-2024-001',
      componente: 'INVESTIGACIÓN DE INCIDENTES',
      tipo: 'OM',
      criticidad: 'media',
      descripcion: 'Los informes de investigación de accidentes no incluyen todas las variables exigidas por la Resolución 1401 de 2007.',
      evidencia: 'Investigación AT-2024-003',
      fechaDeteccion: '2024-12-11',
      estado: 'en_tratamiento',
      fechaCompromisoCierre: '2025-05-30'
    },
    {
      id: 'HAL-2024-005',
      auditId: 'AUD-2024-001',
      componente: 'CAPACITACIÓN',
      tipo: 'NC',
      criticidad: 'media',
      descripcion: 'No se documentó la evaluación de eficacia de las capacitaciones del primer semestre 2024.',
      evidencia: 'Registros capacitación 2024-S1',
      fechaDeteccion: '2024-12-11',
      estado: 'cerrada',
      fechaCompromisoCierre: '2025-03-30',
      fechaCierreReal: '2025-03-25'
    },
    {
      id: 'HAL-2025-001',
      auditId: 'AUD-2025-002',
      componente: 'PLAN DE ACCIÓN 2024',
      tipo: 'OM',
      criticidad: 'baja',
      descripcion: '3 de 10 acciones del plan 2024 están pendientes de cierre. Avance global: 70%.',
      evidencia: 'Plan acción AUD-2024-001',
      fechaDeteccion: '2025-06-15',
      estado: 'en_tratamiento',
      fechaCompromisoCierre: '2025-12-31'
    },
    {
      id: 'HAL-2025-002',
      auditId: 'AUD-2025-002',
      componente: 'DOCUMENTACIÓN',
      tipo: 'OE',
      criticidad: 'baja',
      descripcion: 'Oportunidad de mejora: centralizar la documentación del SG-SST en un repositorio único digital.',
      evidencia: 'Inventario documental 2025-Q2',
      fechaDeteccion: '2025-06-16',
      estado: 'abierta',
      fechaCompromisoCierre: '2025-09-30'
    },
    {
      id: 'HAL-2025-003',
      auditId: 'AUD-2025-001',
      componente: 'GESTIÓN DEL CAMBIO',
      tipo: 'OM',
      criticidad: 'media',
      descripcion: 'No se documentó la evaluación de impacto SST ante el cambio de proveedor de EPP en mayo 2025.',
      evidencia: 'Contrato proveedor EPP',
      fechaDeteccion: '2025-12-10',
      estado: 'abierta',
      fechaCompromisoCierre: '2026-02-15'
    },
    {
      id: 'HAL-2025-004',
      auditId: 'AUD-2025-001',
      componente: 'COMUNICACIÓN',
      tipo: 'OM',
      criticidad: 'baja',
      descripcion: 'El plan de comunicaciones del SG-SST no incluye canales digitales (redes sociales corporativas).',
      evidencia: 'Plan comunicaciones 2025',
      fechaDeteccion: '2025-12-10',
      estado: 'en_tratamiento',
      fechaCompromisoCierre: '2026-01-31'
    }
  ];

  /* ─── 4 Planes de acción ─────────────────────────────────── */
  var planAccion = [
    {
      id: 'PLA-2024-001',
      hallazgoId: 'HAL-2024-001',
      auditId: 'AUD-2024-001',
      accion: 'Actualizar perfiles de cargo de Asesor SST incluyendo las 7 responsabilidades del Decreto 1072',
      responsable: 'Ana Martínez — Gestión Humana',
      fechaCompromiso: '2025-03-15',
      fechaRealizacion: '2025-02-20',
      estado: 'cerrada',
      evidencia: 'Perfiles actualizados y firmados 2025-02-19',
      verificadoPor: 'Elaine Bolívar'
    },
    {
      id: 'PLA-2024-003',
      hallazgoId: 'HAL-2024-003',
      auditId: 'AUD-2024-001',
      accion: 'Realizar simulacro de emergencia con plan de ayuda mutua con empresa vecina',
      responsable: 'Javier Robles — SG-SST',
      fechaCompromiso: '2025-02-28',
      estado: 'en_progreso',
      evidencia: 'En planificación. Coordinaciones con empresa vecina en curso.'
    },
    {
      id: 'PLA-2024-004',
      hallazgoId: 'HAL-2024-004',
      auditId: 'AUD-2024-001',
      accion: 'Actualizar formato de investigación de accidentes conforme a Resolución 1401/2007',
      responsable: 'Ana Martínez — Gestión Humana',
      fechaCompromiso: '2025-05-30',
      estado: 'en_progreso',
      evidencia: 'Borrador de nuevo formato en revisión'
    },
    {
      id: 'PLA-2025-001',
      hallazgoId: 'HAL-2025-001',
      auditId: 'AUD-2025-002',
      accion: 'Cerrar 3 acciones pendientes del plan 2024 antes de 2025-12-31',
      responsable: 'Javier Robles — SG-SST',
      fechaCompromiso: '2025-12-31',
      estado: 'en_progreso',
      evidencia: 'Avance: 70% (7/10 cerradas)'
    }
  ];

  /* ─── Asignar hallazgos y planes a auditorías ────────── */
  audits.forEach(function (a) {
    a.hallazgos = hallazgos.filter(function (h) { return h.auditId === a.id; });
    a.planAccion = planAccion.filter(function (p) { return p.auditId === a.id; });
  });

  /* ─── EXPORT ───────────────────────────────────────────── */
  window.KairMockData = {
    ACTIVE_COMPANY: ACTIVE_COMPANY,
    audits: audits,
    hallazgos: hallazgos,
    planAccion: planAccion,
    /* Cuando se reemplace con el service real, estos quedan como fallback */
    uid: uid
  };
})();

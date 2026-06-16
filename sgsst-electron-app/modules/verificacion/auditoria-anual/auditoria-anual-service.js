/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Submódulo 6.1.2 — Auditoría Anual
   Service Layer — Mock Data & Helpers
   ═══════════════════════════════════════════════════════════════════ */

var AuditoriaService = (function () {
  'use strict';

  var AUDITORIAS = [
    {
      id: 'AUD-2026-001',
      nombre: 'Auditoría Interna SG-SST - Q1',
      tipo: 'Interna',
      alcance: 'Todos los departamentos',
      fechaInicio: '2026-01-15',
      fechaFin: '2026-01-17',
      estado: 'completada',
      auditorLider: 'María García López',
      equipo: ['Carlos Ruiz', 'Ana Martínez'],
      hallazgos: 5,
      hallazgosCriticos: 1,
      trimestre: 'Q1',
      calificacion: 85
    },
    {
      id: 'AUD-2026-002',
      nombre: 'Auditoría Seguridad Electricidad',
      tipo: 'Especializada',
      alcance: 'Planta Industrial',
      fechaInicio: '2026-02-10',
      fechaFin: '2026-02-11',
      estado: 'completada',
      auditorLider: 'Pedro Sánchez',
      equipo: ['Laura Díaz'],
      hallazgos: 3,
      hallazgosCriticos: 0,
      trimestre: 'Q1',
      calificacion: 92
    },
    {
      id: 'AUD-2026-003',
      nombre: 'Auditoría Interna SG-SST - Q2',
      tipo: 'Interna',
      alcance: 'Todos los departamentos',
      fechaInicio: '2026-04-20',
      fechaFin: '2026-04-22',
      estado: 'completada',
      auditorLider: 'María García López',
      equipo: ['Carlos Ruiz', 'Roberto Díaz'],
      hallazgos: 7,
      hallazgosCriticos: 2,
      trimestre: 'Q2',
      calificacion: 78
    },
    {
      id: 'AUD-2026-004',
      nombre: 'Auditoría Extincora de Incendios',
      tipo: 'Especializada',
      alcance: 'Edificio Central',
      fechaInicio: '2026-05-05',
      fechaFin: '2026-05-05',
      estado: 'completada',
      auditorLider: 'Carlos Ruiz',
      equipo: [],
      hallazgos: 2,
      hallazgosCriticos: 0,
      trimestre: 'Q2',
      calificacion: 95
    },
    {
      id: 'AUD-2026-005',
      nombre: 'Auditoría Interna SG-SST - Q3',
      tipo: 'Interna',
      alcance: 'Todos los departamentos',
      fechaInicio: '2026-07-14',
      fechaFin: '2026-07-16',
      estado: 'en-progreso',
      auditorLider: 'María García López',
      equipo: ['Ana Martínez', 'Laura Díaz'],
      hallazgos: 0,
      hallazgosCriticos: 0,
      trimestre: 'Q3',
      calificacion: null
    },
    {
      id: 'AUD-2026-006',
      nombre: 'Auditoría Maquinaria Pesada',
      tipo: 'Especializada',
      alcance: 'Zona Industrial',
      fechaInicio: '2026-08-18',
      fechaFin: '2026-08-19',
      estado: 'programada',
      auditorLider: 'Pedro Sánchez',
      equipo: ['Carlos Ruiz'],
      hallazgos: 0,
      hallazgosCriticos: 0,
      trimestre: 'Q3',
      calificacion: null
    },
    {
      id: 'AUD-2026-007',
      nombre: 'Auditoría Interna SG-SST - Q4',
      tipo: 'Interna',
      alcance: 'Todos los departamentos',
      fechaInicio: '2026-10-12',
      fechaFin: '2026-10-14',
      estado: 'programada',
      auditorLider: 'María García López',
      equipo: ['Carlos Ruiz', 'Ana Martínez'],
      hallazgos: 0,
      hallazgosCriticos: 0,
      trimestre: 'Q4',
      calificacion: null
    },
    {
      id: 'AUD-2026-008',
      nombre: 'Auditoría Final Año SG-SST',
      tipo: 'Interna',
      alcance: 'Todos los departamentos',
      fechaInicio: '2026-12-07',
      fechaFin: '2026-12-09',
      estado: 'programada',
      auditorLider: 'María García López',
      equipo: ['Todo el equipo'],
      hallazgos: 0,
      hallazgosCriticos: 0,
      trimestre: 'Q4',
      calificacion: null
    }
  ];

  var HALLAZGOS = [
    {
      id: 'HJ-001',
      auditoriaId: 'AUD-2026-001',
      codigo: 'HJ-2026-001',
      descripcion: 'Falta de señalización en zona de riesgo eléctrico',
      severidad: 'critico',
      estado: 'cerrado',
      responsable: 'Juan Pérez',
      fechaDeteccion: '2026-01-15',
      fechaCierre: '2026-02-28',
      accionCorrectiva: 'Instalar señalización de peligro y barandillas'
    },
    {
      id: 'HJ-002',
      auditoriaId: 'AUD-2026-001',
      codigo: 'HJ-2026-002',
      descripcion: 'EPP dañado en área de soldadura',
      severidad: 'mayor',
      estado: 'cerrado',
      responsable: 'Carlos López',
      fechaDeteccion: '2026-01-16',
      fechaCierre: '2026-03-15',
      accionCorrectiva: 'Reposición de EPP y capacitación al personal'
    },
    {
      id: 'HJ-003',
      auditoriaId: 'AUD-2026-001',
      codigo: 'HJ-2026-003',
      descripcion: 'Extintor vencido en piso 3',
      severidad: 'mayor',
      estado: 'cerrado',
      responsable: 'Roberto Díaz',
      fechaDeteccion: '2026-01-17',
      fechaCierre: '2026-02-10',
      accionCorrectiva: 'Recarga y reubicación de extintores'
    },
    {
      id: 'HJ-004',
      auditoriaId: 'AUD-2026-003',
      codigo: 'HJ-2026-004',
      descripcion: 'Capacitación pendiente para nuevos operarios',
      severidad: 'critico',
      estado: 'en-progreso',
      responsable: 'Ana Martínez',
      fechaDeteccion: '2026-04-21',
      fechaCierre: null,
      accionCorrectiva: 'Programar y ejecutar capacitación en SST'
    },
    {
      id: 'HJ-005',
      auditoriaId: 'AUD-2026-003',
      codigo: 'HJ-2026-005',
      descripcion: 'Documentación desactualizada en brigada de emergencia',
      severidad: 'mayor',
      estado: 'en-progreso',
      responsable: 'Laura Díaz',
      fechaDeteccion: '2026-04-22',
      fechaCierre: null,
      accionCorrectiva: 'Actualizar plan de emergencia y simulacros'
    },
    {
      id: 'HJ-006',
      auditoriaId: 'AUD-2026-003',
      codigo: 'HJ-2026-006',
      descripcion: 'Falta de mantenimiento a sistema de ventilación',
      severidad: 'menor',
      estado: 'cerrado',
      responsable: 'Pedro Sánchez',
      fechaDeteccion: '2026-04-22',
      fechaCierre: '2026-05-20',
      accionCorrectiva: 'Programar mantenimiento preventivo mensual'
    },
    {
      id: 'HJ-007',
      auditoriaId: 'AUD-2026-003',
      codigo: 'HJ-2026-007',
      descripcion: 'Rutas de evacuación obstruidas',
      severidad: 'critico',
      estado: 'cerrado',
      responsable: 'Carlos Ruiz',
      fechaDeteccion: '2026-04-20',
      fechaCierre: '2026-05-01',
      accionCorrectiva: 'Desobstruir rutas y señalizar correctamente'
    }
  ];

  function getAuditorias() {
    return AUDITORIAS.slice();
  }

  function getAuditoriaById(id) {
    return AUDITORIAS.find(function (a) { return a.id === id; }) || null;
  }

  function getAuditoriasByTrimestre(trimestre) {
    return AUDITORIAS.filter(function (a) { return a.trimestre === trimestre; });
  }

  function getAuditoriasByEstado(estado) {
    return AUDITORIAS.filter(function (a) { return a.estado === estado; });
  }

  function getHallazgos() {
    return HALLAZGOS.slice();
  }

  function getHallazgosByAuditoria(auditoriaId) {
    return HALLAZGOS.filter(function (h) { return h.auditoriaId === auditoriaId; });
  }

  function getHallazgosByEstado(estado) {
    return HALLAZGOS.filter(function (h) { return h.estado === estado; });
  }

  function getKpiStats() {
    var total = AUDITORIAS.length;
    var completadas = getAuditoriasByEstado('completada').length;
    var enProgreso = getAuditoriasByEstado('en-progreso').length;
    var programadas = getAuditoriasByEstado('programada').length;
    var totalHallazgos = HALLAZGOS.length;
    var hallazgosCriticos = HALLAZGOS.filter(function (h) { return h.severidad === 'critico'; }).length;
    var hallazgosAbiertos = HALLAZGOS.filter(function (h) { return h.estado !== 'cerrado'; }).length;
    var calificacionProm = 0;
    var auditCalificadas = AUDITORIAS.filter(function (a) { return a.calificacion !== null; });
    if (auditCalificadas.length > 0) {
      var sum = auditCalificadas.reduce(function (s, a) { return s + a.calificacion; }, 0);
      calificacionProm = Math.round(sum / auditCalificadas.length);
    }

    return {
      total: total,
      completadas: completadas,
      enProgreso: enProgreso,
      programadas: programadas,
      totalHallazgos: totalHallazgos,
      hallazgosCriticos: hallazgosCriticos,
      hallazgosAbiertos: hallazgosAbiertos,
      calificacionProm: calificacionProm
    };
  }

  function getCronogramaData() {
    var meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    var data = meses.map(function (mes, idx) {
      var mesNum = idx + 1;
      var auditoriasMes = AUDITORIAS.filter(function (a) {
        var inicio = new Date(a.fechaInicio);
        var fin = new Date(a.fechaFin);
        return (inicio.getMonth() + 1 === mesNum) || (fin.getMonth() + 1 === mesNum);
      });
      return {
        mes: mes,
        mesNum: mesNum,
        auditorias: auditoriasMes.length,
        completadas: auditoriasMes.filter(function (a) { return a.estado === 'completada'; }).length,
        programadas: auditoriasMes.filter(function (a) { return a.estado === 'programada'; }).length,
        enProgreso: auditoriasMes.filter(function (a) { return a.estado === 'en-progreso'; }).length
      };
    });
    return data;
  }

  return {
    getAuditorias: getAuditorias,
    getAuditoriaById: getAuditoriaById,
    getAuditoriasByTrimestre: getAuditoriasByTrimestre,
    getAuditoriasByEstado: getAuditoriasByEstado,
    getHallazgos: getHallazgos,
    getHallazgosByAuditoria: getHallazgosByAuditoria,
    getHallazgosByEstado: getHallazgosByEstado,
    getKpiStats: getKpiStats,
    getCronogramaData: getCronogramaData
  };
})();

window.AuditoriaService = AuditoriaService;

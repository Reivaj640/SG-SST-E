/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Submódulo 6.1.1 — Definición de Indicadores
   Service Layer — Datos mock + utilidades
   Fuente: INDICADORES 2026.xlsx
   ═══════════════════════════════════════════════════════════════════ */

var IndicadoresService = (function () {
  'use strict';

  var MONTHS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

  // ── RESULTADO (9 indicadores) ─────────────────────────────────
  var resultadoIndicators = [
    {
      id: 'res-01', type: 'RESULTADO', name: 'Índice de Frecuencia',
      definition: 'Frecuencia de los accidentes en la organización en un periodo dado',
      howToMeasure: '(N° de accidentes de trabajo × 200) / N° de horas hombre trabajadas',
      formula: '(AT × 200) / HHT', source: 'Página Web ARL Sura y Gestión Humana',
      responsible: 'Responsable SGSST', frequency: 'Mensual', unit: 'Tasa',
      interpretation: 'Frecuencia de los accidentes en la organización. Un valor menor indica mejor desempeño.',
      target: 0.03, disclosure: 'Comité SST, Gerencia', status: 'en_progreso', currentValue: 0.71,
      monthlyData: [
        {month:'ENE',numerator:0,denominator:140,value:0},
        {month:'FEB',numerator:1,denominator:140,value:0.71},
        {month:'MAR',numerator:0,denominator:148,value:0},
        {month:'ABR',numerator:0,denominator:189,value:0},
        {month:'MAY',numerator:0,denominator:198,value:0},
        {month:'JUN',numerator:1,denominator:198,value:0.51},
        {month:'JUL',numerator:1,denominator:225,value:0.44},
        {month:'AGO',numerator:0,denominator:225,value:0},
        {month:'SEP',numerator:0,denominator:141,value:0},
        {month:'OCT',numerator:1,denominator:141,value:0.89},
        {month:'NOV',numerator:1,denominator:128,value:1.42},
        {month:'DIC',numerator:0,denominator:0,value:null}
      ]
    },
    {
      id: 'res-02', type: 'RESULTADO', name: 'Índice de Severidad',
      definition: 'Días perdidos por accidente laboral',
      howToMeasure: '(Días perdidos por AT × 200) / N° de horas hombre trabajadas',
      formula: '(DP × 200) / HHT', source: 'Página Web ARL Sura y Gestión Humana',
      responsible: 'Responsable SGSST', frequency: 'Mensual', unit: 'Días',
      interpretation: 'Días perdidos por accidente laboral. Un valor menor indica menor gravedad.',
      target: 0.1, disclosure: 'Comité SST, Gerencia', status: 'critico', currentValue: 4.29,
      monthlyData: [
        {month:'ENE',numerator:0,denominator:140,value:0},
        {month:'FEB',numerator:1,denominator:140,value:4.29},
        {month:'MAR',numerator:0,denominator:148,value:0},
        {month:'ABR',numerator:0,denominator:189,value:0},
        {month:'MAY',numerator:5,denominator:198,value:2.02},
        {month:'JUN',numerator:0,denominator:198,value:0.44},
        {month:'JUL',numerator:0,denominator:225,value:0},
        {month:'AGO',numerator:0,denominator:225,value:1.78},
        {month:'SEP',numerator:0,denominator:141,value:0},
        {month:'OCT',numerator:1,denominator:141,value:8.51},
        {month:'NOV',numerator:0,denominator:128,value:5.48},
        {month:'DIC',numerator:0,denominator:0,value:null}
      ]
    },
    {
      id: 'res-03', type: 'RESULTADO', name: 'Índice de Mortalidad',
      definition: 'Accidentes mortales presentados en un periodo determinado',
      howToMeasure: 'N° de accidentes mortales en el periodo',
      formula: 'N° Accidentes Mortales', source: 'SST',
      responsible: 'Responsable SGSST', frequency: 'Anual', unit: 'Eventos',
      interpretation: 'Accidentes mortales. La meta es cero eventos mortales.',
      target: 0, disclosure: 'Comité SST, Gerencia, ARL', status: 'critico', currentValue: 1,
      monthlyData: MONTHS.map(function(m,i){return{month:m,numerator:i===0?1:0,denominator:12,value:i===0?1:0};})
    },
    {
      id: 'res-04', type: 'RESULTADO', name: 'Tasa de Prevalencia General de Enfermedad Laboral',
      definition: 'Enfermedades laborales existentes y nuevas calificadas por ARL',
      howToMeasure: '(Casos existentes + Casos nuevos de EL) / N° total de trabajadores × 100',
      formula: '(CE + CN) / TT × 100', source: 'SST',
      responsible: 'Responsable SGSST', frequency: 'Anual', unit: 'Porcentaje',
      interpretation: 'Carga total de enfermedad laboral en la organización.',
      target: 0, disclosure: 'Comité SST, ARL', status: 'cumplido', currentValue: 0,
      monthlyData: MONTHS.map(function(m){return{month:m,numerator:0,denominator:155,value:0};})
    },
    {
      id: 'res-05', type: 'RESULTADO', name: 'Tasa de Incidencia General de Enfermedad Laboral',
      definition: 'Casos nuevos de enfermedades laborales calificadas por ARL',
      howToMeasure: 'Casos nuevos de EL / N° total de trabajadores × 100',
      formula: 'CN / TT × 100', source: 'SST',
      responsible: 'Responsable SGSST', frequency: 'Anual', unit: 'Porcentaje',
      interpretation: 'Mide la aparición de nuevos casos de enfermedad laboral.',
      target: 0, disclosure: 'Comité SST, ARL', status: 'cumplido', currentValue: 0,
      monthlyData: MONTHS.map(function(m){return{month:m,numerator:0,denominator:155,value:0};})
    },
    {
      id: 'res-06', type: 'RESULTADO', name: 'Ausentismo por Enfermedad General',
      definition: 'Días de incapacidad por enfermedad común y/o enfermedad laboral',
      howToMeasure: '(Días de incapacidad / Días programados × N° empleados) × 100',
      formula: 'DI / (DP × NE) × 100', source: 'SST',
      responsible: 'Coordinador de Gestión Humana', frequency: 'Mensual', unit: 'Porcentaje',
      interpretation: 'Días de incapacidad por enfermedad en un periodo determinado.',
      target: 0.03, disclosure: 'Gestión Humana, Gerencia', status: 'en_progreso', currentValue: 2.07,
      monthlyData: [
        {month:'ENE',numerator:0,denominator:0,value:0},
        {month:'FEB',numerator:1,denominator:140,value:2.07},
        {month:'MAR',numerator:1,denominator:148,value:1.64},
        {month:'ABR',numerator:1,denominator:189,value:1.55},
        {month:'MAY',numerator:0,denominator:198,value:0},
        {month:'JUN',numerator:1,denominator:198,value:0.40},
        {month:'JUL',numerator:1,denominator:225,value:0.93},
        {month:'AGO',numerator:1,denominator:225,value:1.16},
        {month:'SEP',numerator:1,denominator:141,value:1.24},
        {month:'OCT',numerator:1,denominator:128,value:0.78},
        {month:'NOV',numerator:1,denominator:146,value:1.30},
        {month:'DIC',numerator:0,denominator:0,value:null}
      ]
    },
    {
      id: 'res-07', type: 'RESULTADO', name: 'Cobertura Inducción',
      definition: 'Porcentaje de personas que reciben la inducción',
      howToMeasure: '(Personas que asistieron a inducción / Personas nuevas en el periodo) × 100',
      formula: 'AI / IP × 100', source: 'SST',
      responsible: 'Responsable SGSST', frequency: 'Mensual', unit: 'Porcentaje',
      interpretation: 'Porcentaje de personas nuevas que asistieron a la inducción.',
      target: 0.8, disclosure: 'Gestión Humana', status: 'cumplido', currentValue: 100,
      monthlyData: [
        {month:'ENE',numerator:4,denominator:4,value:100},
        {month:'FEB',numerator:14,denominator:14,value:100},
        {month:'MAR',numerator:40,denominator:40,value:100},
        {month:'ABR',numerator:9,denominator:9,value:100},
        {month:'MAY',numerator:5,denominator:5,value:100},
        {month:'JUN',numerator:9,denominator:9,value:100},
        {month:'JUL',numerator:9,denominator:9,value:100},
        {month:'AGO',numerator:10,denominator:10,value:100},
        {month:'SEP',numerator:36,denominator:36,value:100},
        {month:'OCT',numerator:11,denominator:11,value:100},
        {month:'NOV',numerator:0,denominator:4,value:0},
        {month:'DIC',numerator:0,denominator:0,value:null}
      ]
    },
    {
      id: 'res-08', type: 'RESULTADO', name: '% Inspecciones Realizadas',
      definition: 'Porcentaje de inspecciones realizadas frente a las programadas',
      howToMeasure: '(Inspecciones realizadas / Inspecciones planeadas) × 100',
      formula: 'IR / IP × 100', source: 'SST',
      responsible: 'Coordinador de Gestión Humana', frequency: 'Mensual', unit: 'Porcentaje',
      interpretation: 'Porcentaje de inspecciones planeadas que se realizaron.',
      target: 1, disclosure: 'Comité SST', status: 'cumplido', currentValue: 100,
      monthlyData: MONTHS.map(function(m){return{month:m,numerator:6,denominator:6,value:100};})
    },
    {
      id: 'res-09', type: 'RESULTADO', name: 'Acciones Correctivas',
      definition: 'Acciones correctivas realizadas frente a las no conformidades',
      howToMeasure: '(Acciones correctivas realizadas / N° de no conformidades) × 100',
      formula: 'ACR / NC × 100', source: 'SST',
      responsible: 'Responsable SGSST', frequency: 'Anual', unit: 'Porcentaje',
      interpretation: 'Porcentaje de no conformidades con acciones correctivas.',
      target: 0.9, disclosure: 'Comité SST, Auditoría', status: 'pendiente', currentValue: 0,
      monthlyData: MONTHS.map(function(m){return{month:m,numerator:0,denominator:2,value:0};})
    }
  ];

  // ── ESTRUCTURA (5 indicadores) ────────────────────────────────
  var estructuraIndicators = [
    {
      id: 'est-01', type: 'ESTRUCTURA', name: 'Política de SST',
      definition: 'Divulgación de la política de SST',
      howToMeasure: 'Verificación de documento firmado, divulgado y fechado',
      formula: 'Cumple / No cumple', source: 'SST',
      responsible: 'Responsable SGSST', frequency: 'Anual', unit: 'Cumplimiento',
      interpretation: 'Documento de la Política de SST firmada, divulgada y fechada.',
      target: 1, disclosure: 'Todo el personal', status: 'cumplido', currentValue: 1,
      monthlyData: MONTHS.map(function(m){return{month:m,numerator:1,denominator:1,value:1};})
    },
    {
      id: 'est-02', type: 'ESTRUCTURA', name: 'Objetivos y Metas',
      definition: 'Objetivos y metas de seguridad divulgados',
      howToMeasure: 'Objetivos y metas de seguridad escritos y divulgados',
      formula: 'Cumple / No cumple', source: 'SST',
      responsible: 'Director Coordinador de Gestión Humana', frequency: 'Mensual', unit: 'Cumplimiento',
      interpretation: 'Los objetivos y metas de seguridad se encuentran escritos y divulgados.',
      target: 1, disclosure: 'Todo el personal', status: 'cumplido', currentValue: 1,
      monthlyData: MONTHS.map(function(m){return{month:m,numerator:1,denominator:1,value:1};})
    },
    {
      id: 'est-03', type: 'ESTRUCTURA', name: 'Plan de Trabajo Anual / Capacitaciones SST',
      definition: 'N° de Capacitaciones y Actividades Programadas vs. Planeadas',
      howToMeasure: '(Capacitaciones y Actividades Programadas / Capacitaciones y Actividades Planeadas) × 100',
      formula: 'CAP / CAPL × 100', source: 'SST',
      responsible: 'Responsable SGSST', frequency: 'Semestral', unit: 'Porcentaje',
      interpretation: 'Número de actividades del plan anual de trabajo cumplidos.',
      target: 1, disclosure: 'Comité SST, Gerencia', status: 'pendiente', currentValue: 0,
      monthlyData: MONTHS.map(function(m){return{month:m,numerator:0,denominator:1,value:0};})
    },
    {
      id: 'est-04', type: 'ESTRUCTURA', name: 'Identificación de Peligros y Riesgos',
      definition: 'Método definido para la identificación de peligros',
      howToMeasure: 'Método definido para la identificación de peligros',
      formula: 'Cumple / No cumple', source: 'SST',
      responsible: 'Coordinador de Gestión Humana', frequency: 'Anual', unit: 'Cumplimiento',
      interpretation: 'Identificación de peligros realizado. Verificación del método y su aplicación.',
      target: 1, disclosure: 'Comité SST', status: 'cumplido', currentValue: 1,
      monthlyData: MONTHS.map(function(m){return{month:m,numerator:1,denominator:1,value:1};})
    },
    {
      id: 'est-05', type: 'ESTRUCTURA', name: 'Funcionamiento del COPASST',
      definition: 'Funcionamiento del COPASST',
      howToMeasure: '(N° reuniones COPASST realizadas / N° reuniones COPASST programadas) × 100',
      formula: 'NCR / NCP × 100', source: 'SST',
      responsible: 'Responsable SGSST', frequency: 'Semestral', unit: 'Porcentaje',
      interpretation: 'Número de reuniones anuales del COPASST. Mide la activación del comité paritario.',
      target: 1, disclosure: 'COPASST, Gerencia', status: 'en_progreso', currentValue: 0.75,
      monthlyData: [
        {month:'ENE',numerator:0,denominator:1,value:0},
        {month:'FEB',numerator:1,denominator:1,value:1},
        {month:'MAR',numerator:0,denominator:2,value:0},
        {month:'ABR',numerator:1,denominator:1,value:1},
        {month:'MAY',numerator:0,denominator:1,value:0},
        {month:'JUN',numerator:2,denominator:2,value:1},
        {month:'JUL',numerator:0,denominator:2,value:0},
        {month:'AGO',numerator:2,denominator:2,value:1},
        {month:'SEP',numerator:0,denominator:1,value:0},
        {month:'OCT',numerator:1,denominator:1,value:1},
        {month:'NOV',numerator:0,denominator:1,value:0},
        {month:'DIC',numerator:1,denominator:1,value:1}
      ]
    }
  ];

  // ── PROCESO (4 indicadores) ───────────────────────────────────
  var procesoIndicators = [
    {
      id: 'pro-01', type: 'PROCESO', name: 'Autoevaluación',
      definition: 'Evaluación inicial del SG-SST',
      howToMeasure: 'Sumatoria de porcentaje por cada uno de los ítems evaluados',
      formula: 'Σ(%) / N° Items', source: 'EVALUACIÓN INICIAL DEL SGSST',
      responsible: 'Responsable SGSST', frequency: 'Semestral', unit: 'Porcentaje',
      interpretation: 'Porcentaje de cumplimiento del SG-SST. Mide el grado de implementación.',
      target: 0.86, disclosure: 'Comité SST, Gerencia', status: 'pendiente', currentValue: 0,
      monthlyData: MONTHS.map(function(m){return{month:m,numerator:0,denominator:60,value:0};})
    },
    {
      id: 'pro-02', type: 'PROCESO', name: 'Ejecución del Plan de Trabajo',
      definition: 'Ejecución del plan de trabajo en el SGSST',
      howToMeasure: '(N° actividades desarrolladas / N° actividades propuestas) × 100',
      formula: '(AD / AP) × 100', source: 'PLAN ANUAL DE TRABAJO EN SST',
      responsible: 'Coordinador de Gestión Humana', frequency: 'Semestral', unit: 'Porcentaje',
      interpretation: 'Porcentaje de actividades cumplidas del plan de trabajo.',
      target: 0.8, disclosure: 'Comité SST, Gerencia', status: 'en_progreso', currentValue: 0.71,
      monthlyData: [
        {month:'ENE',numerator:0,denominator:5,value:0},
        {month:'FEB',numerator:10,denominator:11,value:90.9},
        {month:'MAR',numerator:0,denominator:10,value:0},
        {month:'ABR',numerator:7,denominator:7,value:100},
        {month:'MAY',numerator:0,denominator:7,value:0},
        {month:'JUN',numerator:4,denominator:5,value:80},
        {month:'JUL',numerator:0,denominator:5,value:0},
        {month:'AGO',numerator:5,denominator:5,value:100},
        {month:'SEP',numerator:0,denominator:4,value:0},
        {month:'OCT',numerator:5,denominator:5,value:100},
        {month:'NOV',numerator:0,denominator:6,value:0},
        {month:'DIC',numerator:7,denominator:9,value:77.8}
      ]
    },
    {
      id: 'pro-03', type: 'PROCESO', name: 'Investigación de Accidentes e Incidentes',
      definition: 'Porcentaje de accidentes/incidentes investigados',
      howToMeasure: '(N° accidentes investigados / N° accidentes reportados) × 100',
      formula: '(AI / AR) × 100', source: 'REPORTE DE ACCIDENTES/INCIDENTES',
      responsible: 'Responsable SGSST', frequency: 'Mensual', unit: 'Porcentaje',
      interpretation: 'Porcentaje de investigaciones realizadas. Mide la tasa de respuesta.',
      target: 1, disclosure: 'Comité SST, ARL', status: 'en_progreso', currentValue: 0.78,
      monthlyData: [
        {month:'ENE',numerator:0,denominator:1,value:0},
        {month:'FEB',numerator:0,denominator:0,value:0},
        {month:'MAR',numerator:0,denominator:0,value:0},
        {month:'ABR',numerator:0,denominator:0,value:0},
        {month:'MAY',numerator:0,denominator:0,value:0},
        {month:'JUN',numerator:1,denominator:1,value:100},
        {month:'JUL',numerator:0,denominator:1,value:0},
        {month:'AGO',numerator:1,denominator:1,value:100},
        {month:'SEP',numerator:0,denominator:1,value:0},
        {month:'OCT',numerator:2,denominator:2,value:100},
        {month:'NOV',numerator:0,denominator:2,value:0},
        {month:'DIC',numerator:2,denominator:2,value:100}
      ]
    },
    {
      id: 'pro-04', type: 'PROCESO', name: 'Simulacros',
      definition: 'Porcentaje de simulacros realizados por sede',
      howToMeasure: '(N° simulacros realizados / N° simulacros programados) × 100',
      formula: '(SR / SP) × 100', source: 'PLAN ANUAL DE TRABAJO EN SST',
      responsible: 'Director, Coordinadores, COPASST, Área de Gestión Humana',
      frequency: 'Semestral', unit: 'Porcentaje',
      interpretation: 'Porcentaje de simulacros ejecutados. Mide la preparación ante emergencias.',
      target: 1, disclosure: 'Comité SST, Gerencia', status: 'pendiente', currentValue: 0,
      monthlyData: MONTHS.map(function(m){return{month:m,numerator:0,denominator:1,value:0};})
    }
  ];

  var ALL_INDICATORS = resultadoIndicators.concat(estructuraIndicators, procesoIndicators);

  // ── Helpers ───────────────────────────────────────────────────
  function getKpiStats() {
    var total = ALL_INDICATORS.length;
    var cumplidos = ALL_INDICATORS.filter(function(i){return i.status==='cumplido';}).length;
    var enProgreso = ALL_INDICATORS.filter(function(i){return i.status==='en_progreso';}).length;
    var pendientes = ALL_INDICATORS.filter(function(i){return i.status==='pendiente';}).length;
    var criticos = ALL_INDICATORS.filter(function(i){return i.status==='critico';}).length;
    var tasa = total > 0 ? Math.round((cumplidos / total) * 100) : 0;
    return { total:total, cumplidos:cumplidos, enProgreso:enProgreso, pendientes:pendientes, criticos:criticos, tasaCumplimiento:tasa };
  }

  function getIndicadoresByType(type) {
    return ALL_INDICATORS.filter(function(i){return i.type===type;});
  }

  function getIndicadorById(id) {
    return ALL_INDICATORS.find(function(i){return i.id===id;}) || null;
  }

  function getStatusLabel(status) {
    var labels = { cumplido:'Cumplido', en_progreso:'En Progreso', pendiente:'Pendiente', critico:'Crítico' };
    return labels[status] || status;
  }

  function getStatusColor(status) {
    var colors = { cumplido:'#28a745', en_progreso:'#174ea6', pendiente:'#ffc107', critico:'#dc3545' };
    return colors[status] || '#6c757d';
  }

  function getStatusBg(status) {
    var bgs = { cumplido:'#e8f5e9', en_progreso:'#e8f0fe', pendiente:'#fff8e1', critico:'#fde8e8' };
    return bgs[status] || '#f8f9fa';
  }

  function getTypeColor(type) {
    var colors = { RESULTADO:'#174ea6', ESTRUCTURA:'#28a745', PROCESO:'#e65100' };
    return colors[type] || '#6c757d';
  }

  function getTypeBg(type) {
    var bgs = { RESULTADO:'#e8f0fe', ESTRUCTURA:'#e8f5e9', PROCESO:'#fff3e0' };
    return bgs[type] || '#f8f9fa';
  }

  function getFreqColor(freq) {
    var colors = { Mensual:'#174ea6', Semestral:'#7b61ff', Anual:'#6c757d' };
    return colors[freq] || '#6c757d';
  }

  function formatTarget(indicator) {
    if (indicator.unit === 'Cumplimiento') {
      return indicator.target === 1 ? '100%' : Math.round(indicator.target * 100) + '%';
    }
    if (indicator.unit === 'Porcentaje') {
      return Math.round(indicator.target * 100) + '%';
    }
    return String(indicator.target);
  }

  function formatValue(indicator) {
    if (indicator.currentValue === null) return '—';
    if (indicator.unit === 'Cumplimiento') {
      return indicator.currentValue === 1 ? '100%' : (indicator.currentValue * 100).toFixed(1) + '%';
    }
    if (indicator.unit === 'Porcentaje') {
      return indicator.currentValue.toFixed(1) + '%';
    }
    return String(indicator.currentValue);
  }

  return {
    MONTHS: MONTHS,
    ALL_INDICATORS: ALL_INDICATORS,
    resultadoIndicators: resultadoIndicators,
    estructuraIndicators: estructuraIndicators,
    procesoIndicators: procesoIndicators,
    getKpiStats: getKpiStats,
    getIndicadoresByType: getIndicadoresByType,
    getIndicadorById: getIndicadorById,
    getStatusLabel: getStatusLabel,
    getStatusColor: getStatusColor,
    getStatusBg: getStatusBg,
    getTypeColor: getTypeColor,
    getTypeBg: getTypeBg,
    getFreqColor: getFreqColor,
    formatTarget: formatTarget,
    formatValue: formatValue
  };
})();

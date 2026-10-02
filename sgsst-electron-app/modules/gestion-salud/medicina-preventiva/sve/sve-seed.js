/* ============================================================
 * K+AIR · SVE — Datos demo (estructura de la herramienta
 * "Tempoactiva — Herramienta de gestión SVE covid19 2024")
 * Vanilla JS. Solo para demo: se carga si no hay datos guardados.
 * Se expone en window.SveSeed
 *
 * Estructura adaptada del Excel:
 *  · Hoja "SVE covid"      → plan (PHVA AP/AE por mes) + meta + análisis
 *  · Hoja "Seguimiento"    → seguimientos de trabajadores (31 campos)
 *  · Hoja "Áreas Expuestas"→ se deriva en vivo de seguimientos
 * ============================================================ */
(function (global) {
  "use strict";

  var SEED_VERSION = "sve-seed.v1";

  /* ---------- Plan de trabajo (hoja "SVE covid", filas 25-47) ---------- */
  /* meses: arreglo de 12 pares [AP, AE] con 0/1; null = no aplica */
  var PHASES = [
    { id: "planear", n: 1, name: "PLANEAR", color: "#0d9488" },
    { id: "hacer", n: 2, name: "HACER", color: "#2f6fd6" },
    { id: "verificar", n: 3, name: "VERIFICAR", color: "#b45309" },
    { id: "actuar", n: 4, name: "ACTUAR", color: "#7c3aed" }
  ];

  function m() {
    var out = [];
    for (var i = 0; i < 12; i++) out.push([1, 1]); /* programado + ejecutado */
    return out;
  }
  function mPartial(execIdx) { /* ejecuta solo los meses 1..execIdx */
    var out = [];
    for (var i = 0; i < 12; i++) out.push([1, i < execIdx ? 1 : 0]);
    return out;
  }
  function mSparse() { /* programa y ejecuta meses alternos */
    var out = [];
    for (var i = 0; i < 12; i++) out.push([i % 2 === 0 ? 1 : 0, i % 2 === 0 ? 1 : 0]);
    return out;
  }

  var PLAN = [
    { fase: "planear", actividad: "Actualización de la Matriz de Peligros incluyendo el riesgo biológico por COVID-19", responsable: "Empresa", meses: mPartial(9) },
    { fase: "planear", actividad: "Definir objetivo, alcance y responsables del SVE COVID-19", responsable: "Empresa", meses: mSparse() },
    { fase: "planear", actividad: "Revisión y actualización de protocolos de bioseguridad (Resolución 777 de 2021)", responsable: "SG-SST", meses: mPartial(7) },
    { fase: "planear", actividad: "Reuniones con asesor para programación y control de actividades", responsable: "SG-SST", meses: mSparse() },
    { fase: "planear", actividad: "Actualizar documento de vigilancia epidemiológica para prevención y atención de COVID-19", responsable: "Empresa", meses: mPartial(5) },
    { fase: "planear", actividad: "Identificar áreas expuestas y priorizar medidas en áreas críticas", responsable: "Empresa", meses: mPartial(4) },
    { fase: "planear", actividad: "Mantener líneas de comunicación directa entre trabajadores y empresa para el reporte de síntomas", responsable: "Empresa", meses: mPartial(6) },

    { fase: "hacer", actividad: "Capacitaciones en protocolo de bioseguridad COVID-19", responsable: "SG-SST", meses: m() },
    { fase: "hacer", actividad: "Identificación de casos COVID-19 sospechosos y/o positivos", responsable: "Empresa", meses: mPartial(10) },
    { fase: "hacer", actividad: "Seguimiento al aislamiento preventivo de trabajadores sospechosos o confirmados", responsable: "Empresa", meses: mPartial(9) },
    { fase: "hacer", actividad: "Seguimiento de casos sospechosos o positivos confirmados", responsable: "Empresa", meses: mPartial(8) },
    { fase: "hacer", actividad: "Seguimiento a personal con síntomas respiratorios", responsable: "Empresa", meses: mPartial(7) },
    { fase: "hacer", actividad: "Reforzar los protocolos de lavado de manos de los trabajadores", responsable: "Empresa", meses: mPartial(8) },
    { fase: "hacer", actividad: "Implementación de medidas de ingeniería para modificación de puestos de trabajo", responsable: "Empresa", meses: mPartial(6) },

    { fase: "verificar", actividad: "Realizar investigación de eventos ATEL por COVID-19", responsable: "Empresa", meses: mPartial(4) },
    { fase: "verificar", actividad: "Medición de indicadores", responsable: "SG-SST", meses: mPartial(3) },
    { fase: "verificar", actividad: "Verificación de cierre de actividades del programa", responsable: "Empresa", meses: mPartial(3) },

    { fase: "actuar", actividad: "Informe de gestión y resultado de indicadores (lecciones aprendidas y aspectos de mejora)", responsable: "SG-SST", meses: mPartial(2) },
    { fase: "actuar", actividad: "Retroalimentación al Sistema de Vigilancia Epidemiológica para la prevención de COVID-19", responsable: "Empresa", meses: mPartial(2) }
  ];

  /* ---------- Seguimientos (hoja "Seguimiento") ---------- */
  /* Campos = columnas del Excel. estado: sospechoso | confirmado | aislamiento | alta | descartado */
  function seg(id, o) {
    return Object.assign({
      id: id,
      fechaIngreso: "", mes: "", anio: 2024, empresa: "Tempoactiva",
      trabajador: "", documento: "", telefono: "", email: "",
      genero: "Masculino", fechaNacimiento: "", eps: "", afp: "",
      sector: "Salud", cargo: "", area: "", ciudad: "",
      antecedentes: "NO", tipoAntecedente: "N/A", vulnerable: "NO",
      sintomas: "NO", cualesSintomas: "N/A",
      contactoPositivo: "NO", contactoSintomatico: "NO",
      pruebaRapida: "NO", fechaPruebaRapida: "",
      pcr: "NO", fechaPcr: "",
      modalidad: "Presencial", fechaAislamiento: "",
      estado: "sospechoso", observaciones: ""
    }, o);
  }

  var SEGUIMIENTOS = [
    seg(1, { fechaIngreso: "2024-01-19", mes: "enero", anio: 2024, trabajador: "JHONATAN MOLINA REYES", documento: "1044390709", telefono: "3005219977", email: "honluz21@hotmail.com", genero: "Masculino", fechaNacimiento: "1992-03-14", eps: "Sanitas", afp: "Porvenir", cargo: "AUXILIAR", area: "SEDE NORTE", ciudad: "Barranquilla", sintomas: "SI", cualesSintomas: "Tos, fiebre leve", contactoSintomatico: "SI", pcr: "SI", fechaPcr: "2024-01-24", estado: "confirmado", observaciones: "Prueba PCR confirmatoria positiva. Aislamiento de 7 días en domicilio." }),
    seg(2, { fechaIngreso: "2024-02-06", mes: "febrero", anio: 2024, trabajador: "GREIDY DE JESUS ACOSTA CONRADO", documento: "1044428902", telefono: "3003628161", email: "greidyelmono10a@hotmail.com", genero: "Femenino", fechaNacimiento: "1996-07-22", eps: "Sura", afp: "Protección", cargo: "AUXILIAR", area: "TURIPANA", ciudad: "Turipana", sintomas: "SI", cualesSintomas: "Congestión nasal, dolor de garganta", pruebaRapida: "SI", fechaPruebaRapida: "2024-02-08", estado: "aislamiento", fechaAislamiento: "2024-02-09", modalidad: "Remota", observaciones: "Prueba rápida positiva; en aislamiento preventivo día 4 de 7." }),
    seg(3, { fechaIngreso: "2024-03-14", mes: "marzo", anio: 2024, trabajador: "LUIS RODRIGUEZ ZAMBRANO", documento: "72.170.498", telefono: "", email: "N/A", genero: "Masculino", fechaNacimiento: "1970-12-05", eps: "Nueva EPS", afp: "Colfondos", cargo: "SUBCHEF", area: "COOTRACOM", ciudad: "Barranquilla", vulnerable: "SI", sintomas: "NO", estado: "alta", observaciones: "Seguimiento completado sin complicaciones. Retorna a labores el 21/03." }),
    seg(4, { fechaIngreso: "2024-04-03", mes: "abril", anio: 2024, trabajador: "LUIS BARRIOS RIOS", documento: "1104248984", telefono: "", email: "N/A", genero: "Masculino", fechaNacimiento: "1987-11-06", eps: "Sura", afp: "Protección", cargo: "SUPERNUMERARIO", area: "C.ATENCION C48", ciudad: "Barranquilla", contactoPositivo: "SI", pruebaRapida: "NO", pcr: "NO", estado: "descartado", observaciones: "Contacto estrecho; PCR negativa. Vigilancia de síntomas por 7 días sin novedad." }),
    seg(5, { fechaIngreso: "2024-05-21", mes: "mayo", anio: 2024, trabajador: "MICHAEL DAVID MARTINEZ CONTRERAS", documento: "1047216134", telefono: "3145348744", email: "maicolmartinz86@hotmail.com", genero: "Masculino", fechaNacimiento: "1986-05-17", eps: "Sanitas", afp: "Porvenir", cargo: "AYUDANTE", area: "SALGARITO", ciudad: "Salgarito", sintomas: "SI", cualesSintomas: "Fiebre 38.2°C, malestar general", pruebaRapida: "SI", fechaPruebaRapida: "2024-05-23", pcr: "SI", fechaPcr: "2024-05-25", estado: "confirmado", observaciones: "PCR positiva. Inicio aislamiento el 25/05. Empresa entregó kit de bioseguridad." }),
    seg(6, { fechaIngreso: "2024-06-12", mes: "junio", anio: 2024, trabajador: "LILIBETH PEREZ PEREZ", documento: "1.143.151.743", telefono: "3015052510", email: "lilibethperez95@hotmail.com", genero: "Femenino", fechaNacimiento: "1995-09-30", eps: "Sura", afp: "Protección", cargo: "AUXILIAR", area: "SEDE NORTE", ciudad: "Barranquilla", antecedentes: "NO", sintomas: "NO", estado: "sospechoso", observaciones: "Reportada por compañero positivo. Sin síntomas a la fecha." }),
    seg(7, { fechaIngreso: "2024-07-08", mes: "julio", anio: 2024, trabajador: "MONICA CECILA CARDENAS PEDROZA", documento: "1046812955", telefono: "1046812955", email: "monycecy87@gmail.com", genero: "Femenino", fechaNacimiento: "1987-02-11", eps: "Nueva EPS", afp: "Colfondos", cargo: "AYUDANTE DE COCINA", area: "COOTRACOM", ciudad: "Barranquilla", vulnerable: "SI", sintomas: "NO", contactoPositivo: "SI", estado: "aislamiento", fechaAislamiento: "2024-07-09", modalidad: "Remota", observaciones: "Aislamiento preventivo de 7 días por contacto estrecho." }),
    seg(8, { fechaIngreso: "2024-08-15", mes: "agosto", anio: 2024, trabajador: "LISBETH MARIA CANTILLO MURIEL", documento: "44205186", telefono: "3013427863", email: "lisbethcantillo27@gmail.com", genero: "Femenino", fechaNacimiento: "1991-04-19", eps: "Sanitas", afp: "Porvenir", cargo: "AUXILIAR", area: "TURIPANA", ciudad: "Turipana", sintomas: "SI", cualesSintomas: "Pérdida del olfato y del gusto", pruebaRapida: "SI", fechaPruebaRapida: "2024-08-17", pcr: "SI", fechaPcr: "2024-08-18", estado: "confirmado", observaciones: "Cuadro leve. Seguimiento telefónico diario por parte del SG-SST." }),
    seg(9, { fechaIngreso: "2024-09-02", mes: "septiembre", anio: 2024, trabajador: "LAURA VANESSA FLOREZ LOPEZ", documento: "1.143.119.086", telefono: "3016262273", email: "N/A", genero: "Femenino", fechaNacimiento: "1999-01-25", eps: "Sura", afp: "Protección", cargo: "AUXILIAR", area: "SEDE NORTE", ciudad: "Barranquilla", sintomas: "NO", estado: "sospechoso", observaciones: "En vigilancia activa: conviviente con síntomas respiratorios." }),
    seg(10, { fechaIngreso: "2024-09-27", mes: "septiembre", anio: 2024, trabajador: "ALBERTO JULIO GUTIERREZ PERTUZ", documento: "8.486.407", telefono: "3016856339", email: "albertojulio2013@hotmail.com", genero: "Masculino", fechaNacimiento: "1983-08-22", eps: "Sura", afp: "Protección", cargo: "AYUDANTE DE COCINA", area: "SALGARITO", ciudad: "Puerto Colombia", vulnerable: "SI", sintomas: "SI", cualesSintomas: "Dolor de cabeza, congestión", pruebaRapida: "SI", fechaPruebaRapida: "2024-09-29", estado: "aislamiento", fechaAislamiento: "2024-09-30", modalidad: "Incapacidad", observaciones: "Prueba rápida positiva. Incapacidad médica por 5 días." }),
    seg(11, { fechaIngreso: "2023-06-02", mes: "junio", anio: 2023, trabajador: "ALBERTO JULIO GUTIERREZ PERTUZ", documento: "8.486.407", telefono: "3016856339", email: "albertojulio2013@hotmail.com", genero: "Masculino", fechaNacimiento: "1983-08-22", eps: "Sura", afp: "Protección", cargo: "AYUDANTE DE COCINA", area: "SALGARITO", ciudad: "Puerto Colombia", sintomas: "NO", pcr: "NO", estado: "alta", modalidad: "Incapacidad", observaciones: "Caso 2023: seguimiento finalizado y cerrado sin complicaciones." }),
    seg(12, { fechaIngreso: "2023-03-14", mes: "marzo", anio: 2023, trabajador: "LUIS RODRIGUEZ ZAMBRANO", documento: "72.170.498", telefono: "", email: "N/A", genero: "Masculino", fechaNacimiento: "1970-12-05", eps: "Nueva EPS", afp: "Colfondos", cargo: "SUBCHEF", area: "COOTRACOM", ciudad: "Barranquilla", vulnerable: "SI", estado: "alta", observaciones: "Caso 2023 cerrado: alta médica otorgada." }),
    seg(13, { fechaIngreso: "2022-01-21", mes: "enero", anio: 2022, trabajador: "LAURA VANESSA FLOREZ LOPEZ", documento: "1.143.119.086", telefono: "3016262273", email: "N/A", genero: "Femenino", fechaNacimiento: "1999-01-25", eps: "Sura", afp: "Protección", cargo: "AUXILIAR", area: "SEDE NORTE", ciudad: "Barranquilla", estado: "alta", observaciones: "Registro histórico 2022 cerrado." }),
    seg(14, { fechaIngreso: "2022-06-12", mes: "junio", anio: 2022, trabajador: "LILIBETH PEREZ PEREZ", documento: "1.143.151.743", telefono: "3015052510", email: "lilibethperez95@hotmail.com", genero: "Femenino", fechaNacimiento: "1995-09-30", eps: "Sura", afp: "Protección", cargo: "AUXILIAR", area: "SEDE NORTE", ciudad: "Barranquilla", estado: "alta", observaciones: "Registro histórico 2022 cerrado." })
  ];

  /* ---------- Indicadores (hoja "SVE covid", filas 73-124) ---------- */
  var INDICADORES = {
    prevalencia: {
      nombre: "Prevalencia COVID-19",
      meta: "Mantener la prevalencia menor al 10%",
      metaCorta: "< 10%",
      umbral: 0.1,
      formulacion: "Número de casos (nuevos y antiguos) de enfermedad laboral / Promedio de trabajadores expuestos × 100",
      periodicidad: "ANUAL",
      anios: [2020, 2021, 2022, 2023, 2024],
      casos: [4, 6, 3, 2, 2],
      promedio: [159.5, 136, 160.2, 170, 148]
    },
    incidencia: {
      nombre: "Incidencia COVID-19",
      meta: "Mantener la incidencia menor al 10%",
      metaCorta: "< 10%",
      umbral: 0.1,
      formulacion: "Número de casos nuevos de enfermedad laboral / Promedio de trabajadores expuestos × 100",
      periodicidad: "TRIMESTRAL",
      anios: [2020, 2021, 2022, 2023, 2024],
      casosNuevos: [4, 5, 2, 1, 2],
      promedio: [159.5, 136, 160.2, 170, 148]
    },
    ausentismo: {
      nombre: "Ausentismo por COVID-19",
      meta: "Disminuir los días de ausencia en 10%",
      metaCorta: "disminuir 10%",
      /* Sin umbral: como hasta hoy el semáforo de ausentismo siempre queda
         verde (no hay cota de "mal" definida para días de ausencia). El campo
         va null para que el formulario NO ofrezca el input de umbral. */
      umbral: null,
      formulacion: "Días de ausencia por incapacidad (laboral o común) / Días de trabajo programados × 100",
      periodicidad: "SEMESTRAL",
      anios: [2020, 2021, 2022, 2023, 2024],
      diasIncapacidad: [18, 54, 7, 5, 6],
      diasProgramados: [45936, 39168, 46128, 48960, 42150]
    },
    eficacia: {
      nombre: "Eficacia del programa",
      meta: "Implementar el 70% de las mejoras sugeridas (Gerencia)",
      metaCorta: "≥ 70%",
      umbral: 0.7,
      formulacion: "No. mejoras implementadas / No. mejoras sugeridas × 100",
      periodicidad: "CUATRIMESTRAL",
      anios: [2020, 2021, 2022, 2023, 2024],
      sugeridas: [0, 108, 36, 12, 14],
      implementadas: [0, 108, 36, 12, 11]
    }
  };

  /* ---------- Registros de morbilidad (hoja "SVE covid", filas 51-56) ---------- */
  var MORBILIDAD = {
    anios: [2020, 2021, 2022, 2023, 2024],
    filas: [
      { tipo: "Accidentes de trabajo", casos: [2, 3, 2, 1, 1], diasIt: [12, 20, 9, 5, 4] },
      { tipo: "Enfermedades laborales", casos: [4, 6, 3, 2, 2], diasIt: [45, 78, 30, 14, 12] },
      { tipo: "Accidentes de origen común", casos: [5, 4, 3, 3, 2], diasIt: [18, 15, 11, 9, 7] },
      { tipo: "Enfermedades comunes", casos: [9, 12, 8, 6, 5], diasIt: [60, 88, 42, 31, 24] }
    ]
  };

  /* ---------- Análisis por periodos (hoja "SVE covid", filas 127-130) ---------- */
  var ANALISIS = [
    {
      periodo: "1. ENERO - JUNIO",
      hallazgos: "Se observa cumplimiento de los indicadores propuestos para el periodo de enero a junio. La cobertura de capacitaciones alcanzó el 92% de la población expuesta y no se presentaron casos críticos de COVID-19.",
      propuestas: "Dar continuidad a la revisión del programa para el siguiente periodo y reforzar la vigilancia en las áreas con mayor concentración de personal.",
      responsable: "Responsable del SG-SST"
    },
    {
      periodo: "2. JULIO - DICIEMBRE",
      hallazgos: "Aumento de seguimientos por síntomas respiratorios en el segundo semestre (temporada de lluvias). El 100% de los casos confirmados recibió seguimiento hasta el alta epidemiológica.",
      propuestas: "Reponer insumos de bioseguridad en las áreas críticas y actualizar el documento de vigilancia con las lecciones aprendidas del periodo.",
      responsable: "Responsable del SG-SST"
    }
  ];

  /* ---------- Áreas y catálogos (derivados del Excel) ---------- */
  var AREAS = ["C.ATENCION C48", "COOTRACOM", "SALGARITO", "SEDE NORTE", "TURIPANA"];
  var CARGOS = ["AUXILIAR", "AYUDANTE", "AYUDANTE DE COCINA", "SUBCHEF", "SUPERNUMERARIO"];
  var EPS_LIST = ["Sanitas", "Sura", "Nueva EPS", "Compensar", "Coomeva"];
  var AFP_LIST = ["Porvenir", "Protección", "Colfondos", "Porvenir"];

  global.SveSeed = {
    version: SEED_VERSION,
    meta: {
      empresa: "Tempoactiva",
      programa: "Sistema de Vigilancia Epidemiológica para la prevención de COVID-19",
      anio: 2024,
      codigo: "F-XX-SST-024",
      version: "04",
      fechaVersion: "Enero 2024",
      objetivo: "Vigilar la población trabajadora expuesta a COVID-19, identificar oportunamente casos sospechosos y confirmados, y definir las acciones de prevención, control y seguimiento para evitar la propagación dentro de la organización.",
      alcance: "Aplica para todos los trabajadores (directos, en misión y supernumerarios) de todas las sedes y áreas operativas de la empresa, incluyendo contratistas que ejecuten actividades en las instalaciones.",
      responsable: "Grupo interdisciplinario: SG-SST (planificación y seguimiento), Gerencia (recursos y toma de decisiones), talento humano en colaboración con el ARL y el área médica."
    },
    fases: PHASES,
    plan: PLAN,
    seguimientos: SEGUIMIENTOS,
    indicadores: INDICADORES,
    morbilidad: MORBILIDAD,
    analisis: ANALISIS,
    catalogos: { areas: AREAS, cargos: CARGOS, eps: EPS_LIST, afp: AFP_LIST }
  };
})(typeof window !== "undefined" ? window : this);

/* ============================================================
 * K+AIR · Inspecciones — Tipos del dominio (datos puros)
 * Vanilla JS. Sin dependencias. Se expone en window.KairInspectionTypes
 * ============================================================ */
(function (global) {
  "use strict";

  var INSPECTION_TYPES = {
    botiquin: {
      type: "botiquin",
      code: "GI-FO-031",
      title: "Inspección de Botiquín de Primeros Auxilios",
      shortTitle: "Botiquines",
      revision: "REV. 01 DICIEMBRE 19 DEL 2016",
      description: "Verificación de insumos básicos, fechas de vencimiento y estado general del botiquín.",
      icon: "kit",
      accent: "#dc3545"
    },
    extintores: {
      type: "extintores",
      code: "GI-FO-026",
      title: "Inspección de Extintores",
      shortTitle: "Extintores",
      revision: "REV. 01 DICIEMBRE 20 DEL 2016",
      description: "Revisión de extintores: presión, cilindro, pasador, anillo, base de soporte y fechas.",
      icon: "flame",
      accent: "#dc3545"
    },
    instalaciones: {
      type: "instalaciones",
      code: "GI-FO-025",
      title: "Inspección de Instalaciones",
      shortTitle: "Instalaciones",
      revision: "REV.01 DICIEMBRE 19 DEL 2016",
      description: "Verificación de instalaciones sanitarias, eléctricas, orden, ergonomía y planta física.",
      icon: "building",
      accent: "#174ea6"
    },
    equipos_emergencia: {
      type: "equipos_emergencia",
      code: "GI-FO-023",
      title: "Inspección de Equipos de Emergencia",
      shortTitle: "Equipos de Emergencia",
      revision: "REV. 01 DICIEMBRE 19 DEL 2016",
      description: "Revisión de camillas, vías de evacuación, alarmas, señalizaciones y brigadistas.",
      icon: "siren",
      accent: "#ffc107"
    }
  };

  var INSPECTION_TYPE_LIST = Object.values(INSPECTION_TYPES);

  var MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  var BOTIQUIN_DEFAULT_ITEMS = [
    { item: "1.0",  elemento: "BAJA LENGUAS" },
    { item: "2.0",  elemento: "ESPARADRAPOS" },
    { item: "3.0",  elemento: "GASA" },
    { item: "4.0",  elemento: "SUERO FISIOLOGICO" },
    { item: "5.0",  elemento: "ISODINE ESPUMA Y SOLUCION" },
    { item: "6.0",  elemento: "TIJERAS" },
    { item: "7.0",  elemento: "VENDAS ELÁSTICAS" },
    { item: "8.0",  elemento: "LINTERNA" },
    { item: "9.0",  elemento: "TAPABOCAS" },
    { item: "10.0", elemento: "GUANTES QUIRURGICOS" },
    { item: "11.0", elemento: "CURITAS" },
    { item: "12.0", elemento: "ALGODÓN" },
    { item: "13.0", elemento: "TERMOMETRO" },
    { item: "14.0", elemento: "COPITOS" },
    { item: "15.0", elemento: "AGUA OXIGENADA" },
    { item: "16.0", elemento: "ALCOHOL ANTISEPTICO" }
  ];

  var BOTIQUIN_CHECK_ITEMS = [
    "Botiquín en buen estado",
    "Higiene adecuada del botiquín"
  ];

  var INSTALACIONES_CATEGORIAS = [
    {
      categoria: "INSTALACIONES SANITARIAS",
      items: [
        "EXISTEN SERVICIOS HIGIENICOS DE USO DEL PERSONAL",
        "PERIODICAMENTE SE REALIZA HIGIENIZACION Y DESINFECCION DE LOS SERVICIOS HIGIENICOS",
        "LOS SERVICIOS HIGIENICOS DE USO PERSONAL ESTAN ABASTECIDOS CON ELEMENTOS DE ASEO (JABON, PAPEL HIGIENICO, PAPELERO)"
      ]
    },
    {
      categoria: "INSTALACIONES ELECTRICAS",
      items: [
        "LA CANALIZACION DEL SISTEMA ELECTRICO SE MANTIENE EN BUEN ESTADO",
        "EXISTE FUENTE ALTERNA DE ENERGIA"
      ]
    },
    {
      categoria: "ORDEN Y LIMPIEZA",
      items: [
        "SE MANTIENE LOS LUGARES DE TRANSITO DE PERSONAS, LIBRE DE OBSTACULOS",
        "LOS PUESTOS DE TRABAJO SE ENCUENTRAN LIBRES DE CABLES QUE OBSTRUYAN EL NORMAL DESPLAZAMIENTO DE LOS TRABAJADORES"
      ]
    },
    {
      categoria: "ERGONOMIA E HIGIENE",
      items: [
        "MOBILIARIO DE OFICINA (SILLAS Y ESCRITORIO) SATISFACE LAS NECESIDADES DE LA TAREA",
        "EXISTE SUFICIENTE ILUMINACION EN LOS PLANOS DE TRABAJO",
        "EL NIVEL DE RUIDO PERMITE REALIZAR TAREAS SIN INCONVENIENTES",
        "SE CUENTA CON EQUIPO DE AIRE ACONDICIONADO PARA CONTRARESTAR EL CALOR DEL VERANO",
        "LA VENTILACION PERMITE LA RENOVACION DEL AIRE DEL RECINTO",
        "LAS ESTACIONES DE TRABAJO CUENTAN CON EL ESPACIO SUFICIENTE PARA DESARROLLAR LA TAREA ASIGNADA"
      ]
    },
    {
      categoria: "PLANTA FISICA",
      items: [
        "SE ENCUENTRAN DELIMITADAS LAS AREAS DE CADA TRABAJADOR",
        "LOS MUROS Y PAREDES SE ENCUENTRAN EN BUEN ESTADO",
        "LOS CIELOS DEL ESTABLECIMIENTO ESTAN EN BUEN ESTADO",
        "LOS PISOS DEL ESTABLECIMIENTO ESTAN EN BUEN ESTADO",
        "LAS PUERTAS SE ENCUENTRAN EN BUEN ESTADO",
        "EL ESPACIO GENERAL ES SUFICIENTE PARA EL PERSONAL",
        "LA ESCALERA DE ACCESO SE ENCUENTRA EN BUEN ESTADO, POSEE SUPERFICIE ANTIDESLIZANTES Y CUENTA CON PASAMANO"
      ]
    }
  ];

  var EMERGENCIA_ITEMS = [
    "CAMILLAS",
    "VIA DE EVACUACION (Salida de emergencia)",
    "ALARMAS DE EMERGENCIA",
    "SEÑALIZACIONES",
    "EXTINTORES DE FACIL ACCESO Y SEÑALIZADOS",
    "PLANOS DE EMERGENCIA",
    "INMOVILIZADORES, BOTIQUINES DE FACIL ACCESO",
    "IDENTIFICACION DE BRIGADISTAS",
    "OTROS ITEMS"
  ];

  var GENERAL_OBJECTIVE =
    "Garantizar la identificación, evaluación y control de los riesgos laborales en los lugares de trabajo asignados al personal en misión, promoviendo condiciones seguras y saludables que cumplan con las normativas legales y las políticas de seguridad y salud en el trabajo (SST) establecidas por la empresa.";

  var PROGRAM_ACTIVITIES_DEFAULT = [
    { specificObjective: "Identificar condiciones inseguras: Realizar inspecciones periódicas en los lugares de trabajo asignados al personal para detectar posibles riesgos físicos, químicos, ergonómicos, biológicos o psicosociales.", activity: "1. Inspección gerencial", responsible: "Gerencia", inspectionType: "gerencial" },
    { specificObjective: "Identificar condiciones inseguras: Realizar inspecciones periódicas en los lugares de trabajo asignados al personal para detectar posibles riesgos físicos, químicos, ergonómicos, biológicos o psicosociales.", activity: "3. Inspecciones de elementos de protección personal", responsible: "Responsable del SG-SST", inspectionType: "epp" },
    { specificObjective: "Evaluar el cumplimiento normativo: Verificar que las empresas usuarias cumplan con las normativas aplicables de seguridad y salud en el trabajo, incluyendo lo estipulado en el Decreto 1072 de 2015.", activity: "2. Inspecciones de extintores", responsible: "Gerencia", inspectionType: "extintores" },
    { specificObjective: "Evaluar el cumplimiento normativo: Verificar que las empresas usuarias cumplan con las normativas aplicables de seguridad y salud en el trabajo, incluyendo lo estipulado en el Decreto 1072 de 2015.", activity: "3. Inspecciones de botiquines", responsible: "Responsable del SG-SST", inspectionType: "botiquin" },
    { specificObjective: "Proponer mejoras: Generar informes con hallazgos y recomendaciones específicas para la mejora de las condiciones laborales.", activity: "1. Inspección gerencial", responsible: "Gerencia", inspectionType: "gerencial" },
    { specificObjective: "Proponer mejoras: Generar informes con hallazgos y recomendaciones específicas para la mejora de las condiciones laborales.", activity: "2. Inspecciones de instalaciones", responsible: "Responsable del SG-SST", inspectionType: "instalaciones" },
    { specificObjective: "Promover la prevención: Fomentar una cultura de prevención mediante la sensibilización de los trabajadores en misión y de las empresas usuarias sobre la importancia de la seguridad laboral.", activity: "1. Inspección gerencial", responsible: "Gerencia", inspectionType: "gerencial" },
    { specificObjective: "Promover la prevención: Fomentar una cultura de prevención mediante la sensibilización de los trabajadores en misión y de las empresas usuarias sobre la importancia de la seguridad laboral.", activity: "2. Inspecciones equipos de emergencias.", responsible: "Responsable del SG-SST", inspectionType: "equipos_emergencia" },
    { specificObjective: "Promover la prevención: Fomentar una cultura de prevención mediante la sensibilización de los trabajadores en misión y de las empresas usuarias sobre la importancia de la seguridad laboral.", activity: "3. Inspecciones de elementos de protección personal", responsible: "Responsable del SG-SST", inspectionType: "epp" }
  ];

  function emptyBotiquinData() {
    return {
      items: BOTIQUIN_DEFAULT_ITEMS.map(function (it) {
        return { item: it.item, elemento: it.elemento, cantidad: "", fechaVencimiento: "", estado: "" };
      }),
      checks: BOTIQUIN_CHECK_ITEMS.map(function (label) { return { label: label, value: "NA" }; }),
      observaciones: ""
    };
  }

  function emptyExtintoresData() {
    return {
      rows: [{
        ubicacion: "", numero: "", tipo: "", capacidad: "",
        fechaRecarga: "", fechaVencimiento: "",
        presion: "", estadoCilindro: "",
        pasador: "", anillo: "", base: "",
        observaciones: ""
      }],
      observaciones: ""
    };
  }

  function emptyInstalacionesData() {
    return {
      items: INSTALACIONES_CATEGORIAS.flatMap(function (c) {
        return c.items.map(function (it) {
          return {
            categoria: c.categoria,
            item: it,
            respuesta: "",
            observaciones: "",
            compromisos: "",
            responsable: "",
            seguimiento: ""
          };
        });
      }),
      inspeccionadoPor: "",
      cargo: "",
      firma: ""
    };
  }

  function emptyEmergenciaData() {
    return {
      items: EMERGENCIA_ITEMS.map(function (it) {
        return { item: it, estado: "", recomendaciones: "", responsables: "", seguimiento: "" };
      }),
      participantes: [{ nombre: "", cargo: "" }]
    };
  }

  global.KairInspectionTypes = {
    INSPECTION_TYPES: INSPECTION_TYPES,
    INSPECTION_TYPE_LIST: INSPECTION_TYPE_LIST,
    MONTHS: MONTHS,
    BOTIQUIN_DEFAULT_ITEMS: BOTIQUIN_DEFAULT_ITEMS,
    BOTIQUIN_CHECK_ITEMS: BOTIQUIN_CHECK_ITEMS,
    INSTALACIONES_CATEGORIAS: INSTALACIONES_CATEGORIAS,
    EMERGENCIA_ITEMS: EMERGENCIA_ITEMS,
    GENERAL_OBJECTIVE: GENERAL_OBJECTIVE,
    PROGRAM_ACTIVITIES_DEFAULT: PROGRAM_ACTIVITIES_DEFAULT,
    emptyBotiquinData: emptyBotiquinData,
    emptyExtintoresData: emptyExtintoresData,
    emptyInstalacionesData: emptyInstalacionesData,
    emptyEmergenciaData: emptyEmergenciaData
  };
})(typeof window !== "undefined" ? window : this);
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FM-HSE-022 STANDALONE PDF GENERATOR
 * ─────────────────────────────────────────────────────────────────────────────
 * Este módulo contiene el motor de renderizado de PDF para el formato FM-HSE-022.
 * Está completamente aislado de la interfaz gráfica y de la persistencia de la PWA.
 * 
 * Requisitos:
 * - Librería jsPDF (umd) cargada en el entorno (navegador o Node.js).
 * 
 * Uso en Navegador:
 *   <script src="libs/jspdf.umd.min.js"></script>
 *   <script src="pdf-generator-standalone.js"></script>
 *   <script>
 *     const doc = await generarDocumentoPDF(state, {
 *       logoBase64: 'data:image/png;base64,...', // Opcional
 *       arialNarrowBase64: '...', // Opcional, base64 del .ttf regular
 *       arialNarrowBoldBase64: '...' // Opcional, base64 del .ttf bold
 *     });
 *     doc.save('FM-HSE-022.pdf');
 *   </script>
 * 
 * Uso en Node.js:
 *   const { generarDocumentoPDF } = require('./pdf-generator-standalone');
 *   // Requiere haber instalado jspdf vía npm: npm install jspdf
 * ─────────────────────────────────────────────────────────────────────────────
 */

// --- Base de Datos Estática (Catálogos Predeterminados de FM-HSE-022) ---

const DEFAULT_SENALES = [
  { "id": "sp01", "texto": "Cambio en el alcance de la tarea",  "tipo": "checkbox" },
  { "id": "sp02", "texto": "Requerir EPP adicional",            "tipo": "checkbox" },
  { "id": "sp03", "texto": "Herramienta adicional",             "tipo": "checkbox" },
  { "id": "sp04", "texto": "Dificultad de movimientos",         "tipo": "checkbox" },
  { "id": "sp05", "texto": "Molestias y dolores",               "tipo": "checkbox" },
  { "id": "sp06", "texto": "Prisa / Afán",                      "tipo": "checkbox" },
  { "id": "sp07", "texto": "Distracción / Frustración",         "tipo": "checkbox" },
  { "id": "sp08", "texto": "Situaciones inesperadas",           "tipo": "checkbox" },
  { "id": "sp09", "texto": "Inundación o exceso de agua",       "tipo": "checkbox" },
  { "id": "sp10", "texto": "Escape/fuga producto",              "tipo": "checkbox" },
  { "id": "sp11", "texto": "Material atascado",                 "tipo": "checkbox" },
  { "id": "sp12", "texto": "Presencia de vectores/Insectos",    "tipo": "checkbox" },
  { "id": "sp13", "texto": "Cambio de lugar trabajo",           "tipo": "checkbox" },
  { "id": "sp14", "texto": "Otros",                             "tipo": "texto" },
  { "id": "sp15", "texto": "Otros",                             "tipo": "texto" },
  { "id": "sp16", "texto": "Otros",                             "tipo": "texto" }
];

const DEFAULT_PELIGROS = [
  {
    "categoria": "FÍSICOS",
    "peligros": [
      { "codigo": "F1",  "descripcion": "Ruido de Impacto",                             "categoria": "FÍSICOS", "criticidad": "MEDIA" },
      { "codigo": "F2",  "descripcion": "Ruido Intermitente o Continuo",                "categoria": "FÍSICOS", "criticidad": "MEDIA" },
      { "codigo": "F3",  "descripcion": "Vibración",                                    "categoria": "FÍSICOS", "criticidad": "MEDIA" },
      { "codigo": "F4",  "descripcion": "Exposición a rayos x, gamma, beta o alfa",     "categoria": "FÍSICOS", "criticidad": "ALTA"  },
      { "codigo": "F5",  "descripcion": "Exposición al Sol",                            "categoria": "FÍSICOS", "criticidad": "BAJA"  },
      { "codigo": "F6",  "descripcion": "Exposición a rayos de soldadura",              "categoria": "FÍSICOS", "criticidad": "ALTA"  },
      { "codigo": "F7",  "descripcion": "Disconfort Térmico",                           "categoria": "FÍSICOS", "criticidad": "MEDIA" }
    ]
  },
  {
    "categoria": "QUÍMICOS",
    "peligros": [
      { "codigo": "Q8",  "descripcion": "Gases y/o vapores",                            "categoria": "QUÍMICOS", "criticidad": "ALTA"  },
      { "codigo": "Q9",  "descripcion": "Deficiencia de oxígeno",                       "categoria": "QUÍMICOS", "criticidad": "ALTA"  },
      { "codigo": "Q10", "descripcion": "Contacto con productos químicos peligrosos",   "categoria": "QUÍMICOS", "criticidad": "ALTA"  },
      { "codigo": "Q11", "descripcion": "Humos Metálicos",                              "categoria": "QUÍMICOS", "criticidad": "ALTA"  },
      { "codigo": "Q12", "descripcion": "Material Particulado",                         "categoria": "QUÍMICOS", "criticidad": "MEDIA" },
      { "codigo": "Q13", "descripcion": "Salpicaduras de químicos",                     "categoria": "QUÍMICOS", "criticidad": "ALTA"  }
    ]
  },
  {
    "categoria": "MECÁNICOS",
    "peligros": [
      { "codigo": "M14", "descripcion": "Manipulación de equipos y herramientas",       "categoria": "MECÁNICOS", "criticidad": "MEDIA" },
      { "codigo": "M15", "descripcion": "Equipos rotativos",                            "categoria": "MECÁNICOS", "criticidad": "ALTA"  },
      { "codigo": "M16", "descripcion": "Material proyectado (Sólido y Fluidos)",       "categoria": "MECÁNICOS", "criticidad": "ALTA"  },
      { "codigo": "M17", "descripcion": "Objetos cortantes o filosos",                  "categoria": "MECÁNICOS", "criticidad": "MEDIA" },
      { "codigo": "M19", "descripcion": "Uso de Herramientas manuales",                 "categoria": "MECÁNICOS", "criticidad": "MEDIA" },
      { "codigo": "M20", "descripcion": "Objetos en movimiento (Atrapamientos)",        "categoria": "MECÁNICOS", "criticidad": "ALTA"  },
      { "codigo": "M21", "descripcion": "Fluidos a Alta/Baja Presión",                  "categoria": "MECÁNICOS", "criticidad": "ALTA"  },
      { "codigo": "M22", "descripcion": "Superficies Calientes",                        "categoria": "MECÁNICOS", "criticidad": "MEDIA" }
    ]
  },
  {
    "categoria": "LOCATIVOS",
    "peligros": [
      { "codigo": "L22", "descripcion": "Tránsito por escaleras",                       "categoria": "LOCATIVOS", "criticidad": "MEDIA" },
      { "codigo": "L23", "descripcion": "Líneas eléctricas enterradas o aéreas",        "categoria": "LOCATIVOS", "criticidad": "ALTA"  },
      { "codigo": "L24", "descripcion": "Superficies deslizantes",                      "categoria": "LOCATIVOS", "criticidad": "MEDIA" },
      { "codigo": "L25", "descripcion": "Objetos suspendidos o elevados",               "categoria": "LOCATIVOS", "criticidad": "ALTA"  },
      { "codigo": "L26", "descripcion": "Área de trabajo fuera de la línea de visión",  "categoria": "LOCATIVOS", "criticidad": "MEDIA" },
      { "codigo": "L27", "descripcion": "Diferencia de nivel",                          "categoria": "LOCATIVOS", "criticidad": "ALTA"  },
      { "codigo": "L28", "descripcion": "Deficiencias de orden y aseo",                 "categoria": "LOCATIVOS", "criticidad": "BAJA"  },
      { "codigo": "L29", "descripcion": "Iluminación Insuficiente",                     "categoria": "LOCATIVOS", "criticidad": "MEDIA" },
      { "codigo": "L30", "descripcion": "Estructuras en el sitio de trabajo",           "categoria": "LOCATIVOS", "criticidad": "MEDIA" },
      { "codigo": "L31", "descripcion": "Almacenamiento de inflamables/combustibles",   "categoria": "LOCATIVOS", "criticidad": "ALTA"  }
    ]
  },
  {
    "categoria": "TIPO DE TRABAJO",
    "peligros": [
      { "codigo": "TT32", "descripcion": "Trabajo en alturas",                          "categoria": "TIPO DE TRABAJO", "criticidad": "ALTA" },
      { "codigo": "TT33", "descripcion": "Trabajo en Espacio Confinado",                "categoria": "TIPO DE TRABAJO", "criticidad": "ALTA" },
      { "codigo": "TT34", "descripcion": "Trabajo en Caliente",                         "categoria": "TIPO DE TRABAJO", "criticidad": "ALTA" },
      { "codigo": "TT35", "descripcion": "Izaje de Cargas",                             "categoria": "TIPO DE TRABAJO", "criticidad": "ALTA" }
    ]
  },
  {
    "categoria": "ELÉCTRICOS",
    "peligros": [
      { "codigo": "TT36", "descripcion": "Trabajo con Equipo energizado",               "categoria": "ELÉCTRICOS", "criticidad": "ALTA"  },
      { "codigo": "TT37", "descripcion": "Estática",                                    "categoria": "ELÉCTRICOS", "criticidad": "MEDIA" },
      { "codigo": "TT38", "descripcion": "Uso de Herramientas eléctricas",              "categoria": "ELÉCTRICOS", "criticidad": "MEDIA" },
      { "codigo": "TT39", "descripcion": "Baja/media tensión",                          "categoria": "ELÉCTRICOS", "criticidad": "ALTA"  }
    ]
  },
  {
    "categoria": "TECNOLÓGICO",
    "peligros": [
      { "codigo": "T40", "descripcion": "Presencia de vapores o gases inflamables",     "categoria": "TECNOLÓGICO", "criticidad": "ALTA" },
      { "codigo": "T41", "descripcion": "Elementos sometidos a presión",                "categoria": "TECNOLÓGICO", "criticidad": "ALTA" },
      { "codigo": "T42", "descripcion": "Uso de gases a presión",                       "categoria": "TECNOLÓGICO", "criticidad": "ALTA" }
    ]
  },
  {
    "categoria": "TRÁNSITO O CONDUCCIÓN",
    "peligros": [
      { "codigo": "TC43", "descripcion": "Tránsito de Vehículos pesados",               "categoria": "TRÁNSITO O CONDUCCIÓN", "criticidad": "ALTA"  },
      { "codigo": "TC44", "descripcion": "Vías irregulares",                            "categoria": "TRÁNSITO O CONDUCCIÓN", "criticidad": "MEDIA" },
      { "codigo": "TC45", "descripcion": "Tránsito de Montacargas",                     "categoria": "TRÁNSITO O CONDUCCIÓN", "criticidad": "ALTA"  },
      { "codigo": "TC46", "descripcion": "Animales en zonas de tránsito",               "categoria": "TRÁNSITO O CONDUCCIÓN", "criticidad": "BAJA"  }
    ]
  },
  {
    "categoria": "BIOMECÁNICOS",
    "peligros": [
      { "codigo": "B47", "descripcion": "Postura prolongada",                           "categoria": "BIOMECÁNICOS", "criticidad": "MEDIA" },
      { "codigo": "B48", "descripcion": "Manipulación manual de cargas",                "categoria": "BIOMECÁNICOS", "criticidad": "MEDIA" },
      { "codigo": "B49", "descripcion": "Sobreesfuerzo",                                "categoria": "BIOMECÁNICOS", "criticidad": "MEDIA" },
      { "codigo": "B50", "descripcion": "Movimientos repetitivos",                      "categoria": "BIOMECÁNICOS", "criticidad": "BAJA"  }
    ]
  },
  {
    "categoria": "BIOLÓGICOS",
    "peligros": [
      { "codigo": "BG51", "descripcion": "Fluidos o excrementos",                       "categoria": "BIOLÓGICOS", "criticidad": "ALTA"  },
      { "codigo": "BG52", "descripcion": "Vectores o insectos",                         "categoria": "BIOLÓGICOS", "criticidad": "MEDIA" },
      { "codigo": "BG53", "descripcion": "Animales",                                    "categoria": "BIOLÓGICOS", "criticidad": "MEDIA" }
    ]
  },
  {
    "categoria": "CONDICIONES CLIMÁTICAS",
    "peligros": [
      { "codigo": "CL54", "descripcion": "Vientos fuertes",                             "categoria": "CONDICIONES CLIMÁTICAS", "criticidad": "ALTA"  },
      { "codigo": "CL55", "descripcion": "Tormenta eléctrica",                          "categoria": "CONDICIONES CLIMÁTICAS", "criticidad": "ALTA"  },
      { "codigo": "CL56", "descripcion": "Lluvia",                                      "categoria": "CONDICIONES CLIMÁTICAS", "criticidad": "MEDIA" },
      { "codigo": "CL57", "descripcion": "Vendaval",                                    "categoria": "CONDICIONES CLIMÁTICAS", "criticidad": "ALTA"  }
    ]
  },
  {
    "categoria": "PSICOSOCIAL",
    "peligros": [
      { "codigo": "P58", "descripcion": "Trabajo repetitivo o monótono",                "categoria": "PSICOSOCIAL", "criticidad": "BAJA"  },
      { "codigo": "P59", "descripcion": "Horario adicional",                            "categoria": "PSICOSOCIAL", "criticidad": "MEDIA" },
      { "codigo": "P60", "descripcion": "Alta Concentración",                           "categoria": "PSICOSOCIAL", "criticidad": "MEDIA" },
      { "codigo": "P61", "descripcion": "Olores ofensivos",                             "categoria": "PSICOSOCIAL", "criticidad": "MEDIA" }
    ]
  }
];

const DEFAULT_CONTROLES = [
  {
    "grupo": "Permisos y Autorizaciones",
    "controles": [
      { "codigo": "1",  "descripcion": "Permiso de trabajo en caliente",                                                              "grupo": "Permisos y Autorizaciones" },
      { "codigo": "2",  "descripcion": "Permiso de entrada a espacio confinado",                                                      "grupo": "Permisos y Autorizaciones" }
    ]
  },
  {
    "grupo": "Procedimientos y Gestión Operativa",
    "controles": [
      { "codigo": "3",  "descripcion": "Procedimientos de trabajo / plan de emergencia específico",                                   "grupo": "Procedimientos y Gestión Operativa" },
      { "codigo": "4",  "descripcion": "No ejecutar trabajos en paralelo o simultáneos en la misma área",                             "grupo": "Procedimientos y Gestión Operativa" },
      { "codigo": "5",  "descripcion": "Equipos de comunicación (radios) entre los ejecutores",                                       "grupo": "Procedimientos y Gestión Operativa" },
      { "codigo": "6",  "descripcion": "Instalación de avisos de prevención",                                                         "grupo": "Procedimientos y Gestión Operativa" },
      { "codigo": "7",  "descripcion": "Uso de guardas y barreras",                                                                   "grupo": "Procedimientos y Gestión Operativa" },
      { "codigo": "8",  "descripcion": "Inspección del área de trabajo para revisar materiales y/o sustancias inflamables",           "grupo": "Procedimientos y Gestión Operativa" }
    ]
  },
  {
    "grupo": "Prevención y Control de Incendios",
    "controles": [
      { "codigo": "9",  "descripcion": "Disponibilidad de extintores",                                                                "grupo": "Prevención y Control de Incendios" },
      { "codigo": "10", "descripcion": "Vigía de fuego durante el trabajo",                                                           "grupo": "Prevención y Control de Incendios" },
      { "codigo": "40", "descripcion": "Disponibilidad de extintores en el área",                                                     "grupo": "Prevención y Control de Incendios" }
    ]
  },
  {
    "grupo": "Aislamiento y Control de Energías",
    "controles": [
      { "codigo": "13", "descripcion": "Bloqueado y etiquetado de energías peligrosas",                                               "grupo": "Aislamiento y Control de Energías" },
      { "codigo": "14", "descripcion": "Control de atmósferas peligrosas",                                                            "grupo": "Aislamiento y Control de Energías" }
    ]
  },
  {
    "grupo": "Espacios Confinados y Rescate",
    "controles": [
      { "codigo": "11", "descripcion": "Vigía externo permanente",                                                                    "grupo": "Espacios Confinados y Rescate" },
      { "codigo": "12", "descripcion": "Plan de rescate y de emergencia",                                                             "grupo": "Espacios Confinados y Rescate" },
      { "codigo": "15", "descripcion": "Evaluación de ventilación antes del ingreso",                                                  "grupo": "Espacios Confinados y Rescate" },
      { "codigo": "16", "descripcion": "Instalación de extractores y/o ventiladores",                                                  "grupo": "Espacios Confinados y Rescate" },
      { "codigo": "17", "descripcion": "Iluminación segura para espacios confinados",                                                  "grupo": "Espacios Confinados y Rescate" }
    ]
  },
  {
    "grupo": "Equipos, Herramientas y Sistemas Presurizados",
    "controles": [
      { "codigo": "18", "descripcion": "Inspección preoperacional de equipos",                                                        "grupo": "Equipos, Herramientas y Sistemas Presurizados" },
      { "codigo": "19", "descripcion": "Herramientas apropiadas para la tarea",                                                       "grupo": "Equipos, Herramientas y Sistemas Presurizados" },
      { "codigo": "20", "descripcion": "Cables de herramientas eléctricas en buen estado",                                            "grupo": "Equipos, Herramientas y Sistemas Presurizados" },
      { "codigo": "21", "descripcion": "Suministro de tensión adecuado para los equipos",                                             "grupo": "Equipos, Herramientas y Sistemas Presurizados" },
      { "codigo": "22", "descripcion": "Mangueras, conexiones y accesorios con fluidos a presión en buen estado",                     "grupo": "Equipos, Herramientas y Sistemas Presurizados" },
      { "codigo": "39", "descripcion": "Lavado y purga del tanque antes de intervenir",                                               "grupo": "Equipos, Herramientas y Sistemas Presurizados" },
      { "codigo": "42", "descripcion": "Equipos eléctricos a prueba de explosión",                                                    "grupo": "Equipos, Herramientas y Sistemas Presurizados" }
    ]
  },
  {
    "grupo": "Izaje, Caída de Objetos y Manipulación de Cargas",
    "controles": [
      { "codigo": "23", "descripcion": "Asegurar o retirar objetos que están encima",                                                 "grupo": "Izaje, Caída de Objetos y Manipulación de Cargas" },
      { "codigo": "24", "descripcion": "Prohibición de movimiento de cargas por encima del personal",                                 "grupo": "Izaje, Caída de Objetos y Manipulación de Cargas" },
      { "codigo": "25", "descripcion": "Manipulación de cargas entre dos o más personas",                                             "grupo": "Izaje, Caída de Objetos y Manipulación de Cargas" },
      { "codigo": "26", "descripcion": "Uso de ayudas mecánicas (zorras, carretillas, montacargas)",                                  "grupo": "Izaje, Caída de Objetos y Manipulación de Cargas" }
    ]
  },
  {
    "grupo": "Factores Humanos y Ergonomía",
    "controles": [
      { "codigo": "27", "descripcion": "Rotaciones de personal",                                                                      "grupo": "Factores Humanos y Ergonomía" },
      { "codigo": "28", "descripcion": "Límites en tiempo de exposición (descansos, pausas)",                                         "grupo": "Factores Humanos y Ergonomía" },
      { "codigo": "29", "descripcion": "Hidratación periódica",                                                                       "grupo": "Factores Humanos y Ergonomía" }
    ]
  },
  {
    "grupo": "Elementos de Protección Personal (EPP)",
    "controles": [
      { "codigo": "30", "descripcion": "Uso de EPP básicos: casco, gafas de seguridad, guantes adecuados al riesgo, botas de seguridad y ropa de trabajo", "grupo": "Elementos de Protección Personal (EPP)" },
      { "codigo": "31", "descripcion": "Uso de protección respiratoria: media cara o full face",                                      "grupo": "Elementos de Protección Personal (EPP)" },
      { "codigo": "32", "descripcion": "Uso de protección auditiva",                                                                  "grupo": "Elementos de Protección Personal (EPP)" },
      { "codigo": "33", "descripcion": "Uso de arnés y eslinga en Y",                                                                 "grupo": "Elementos de Protección Personal (EPP)" },
      { "codigo": "34", "descripcion": "Uso de eslinga de posicionamiento",                                                           "grupo": "Elementos de Protección Personal (EPP)" },
      { "codigo": "35", "descripcion": "Sistema de línea retráctil",                                                                  "grupo": "Elementos de Protección Personal (EPP)" },
      { "codigo": "36", "descripcion": "Uso de equipo con sistema de autocontenido",                                                  "grupo": "Elementos de Protección Personal (EPP)" },
      { "codigo": "37", "descripcion": "Uso ropa de trabajo impermeable",                                                             "grupo": "Elementos de Protección Personal (EPP)" },
      { "codigo": "41", "descripcion": "Inspección de arnés y equipos contra caída",                                                  "grupo": "Elementos de Protección Personal (EPP)" }
    ]
  },
  {
    "grupo": "Emergencias y Atención Ambiental",
    "controles": [
      { "codigo": "38", "descripcion": "Kit para control de derrames",                                                                "grupo": "Emergencias y Atención Ambiental" },
      { "codigo": "43", "descripcion": "Suspensión de la tarea por condiciones climáticas",                                           "grupo": "Emergencias y Atención Ambiental" }
    ]
  }
];

// --- Motor de Renderizado (Aislado) ---

/**
 * Función principal para generar el documento PDF FM-HSE-022.
 * 
 * @param {Object} state - Datos ingresados por el usuario.
 * @param {Object} [options] - Opciones de personalización y assets.
 * @returns {Promise<Object>} Promesa que resuelve al objeto jsPDF listo.
 */
async function generarDocumentoPDF(state, options = {}) {
  // 1. Obtener clase jsPDF
  let jsPDFClass = null;
  if (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) {
    jsPDFClass = window.jspdf.jsPDF;
  } else if (typeof require !== 'undefined') {
    try {
      jsPDFClass = require('jspdf').jsPDF;
    } catch (e) {}
  }
  if (!jsPDFClass && typeof jsPDF !== 'undefined') {
    jsPDFClass = jsPDF;
  }

  if (!jsPDFClass) {
    throw new Error("jsPDF no está cargado. Asegúrate de incluir la librería jsPDF en el proyecto.");
  }

  // 2. Definir Layout y Estilos Exactos
  const L = {
    // Página — Letter Landscape
    pw: 279.4, ph: 215.9,
    ml: 12.7,  mr: 12.7, mt: 12.7, mb: 12.7,
    footerH: 7.0,
    get aw()      { return this.pw - this.ml - this.mr; },
    get contentH(){ return this.ph - this.mt - this.mb; },

    // Columnas Pág 1
    p1ColW: 76.3411,
    tblW:   79.00,
    tblGap: 3.53,
    ctlNumColW: 4.0,
    ctlNumGap:  0.8,
    ctlHang:    6.297,
    ctlLeft:    12.594,
    szCtlNum:   8,
    ctlEmptyPara: 1.94,
    p1Gap:  12.4883,
    get p1C2X(){ return this.ml + this.p1ColW + this.p1Gap; },
    get p1C3X(){ return this.ml + this.p1ColW*2 + this.p1Gap*2; },

    // Encabezado
    hdrH:       15.52,
    hdrRowH:     3.8806,
    logoCol:    15.6104,
    titleCol:   34.1313,
    metaLblCol: 12.4354,
    metaValCol: 14.5521,

    // Logo dimensiones exactas
    logoW: 13.0969,
    logoH:  8.9958,

    // Responsables
    rNomW: 31.9969, rCedW: 23.0011, rFirW: 24.0065,
    rRowH:  4.9918,
    rRow8:  4.2333,
    rRow9:  3.9688,
    rRows:  8,

    // Punto encuentro / Ducha
    ptLblH: 2.9986,
    ptValH: 4.992,
    dlValH: 4.992,

    // Señales
    spColL:  39.5288,
    spColR:  39.4758,
    spHdrH:   2.9986,
    spInstrH: 8.9958,
    spRowH:   4.9918,
    spLastH:  3.3514,

    padL: 1.9, padR: 1.9, padT: 0.0, padB: 0.0,

    // Catálogo peligros
    pelSubL: 39.4935,
    pelSubR: 39.5111,
    pelHdrH:  7.0026,
    pelRowH:  3.792,
    pelItemH: 3.493,

    // Guía controles
    ctlNumW:  9.9131,
    ctlDescW: 69.0915,
    ctlHdrH:  3.4396,
    ctlRowH:  2.9986,

    // Página 2
    get p2B1X(){ return this.ml; },
    get p2B2X(){ return this.p1C2X; },
    get p2B3X(){ return this.p1C3X; },
    p2BW:   76.3411,
    p2ItmW:  9.5,
    get p2ContW(){ return this.p2BW - this.p2ItmW; },
    p2HdrH:  5.997,
    p2RowH: 19.403,
    p2Rows:  9,

    // Tipografías (en puntos pt)
    szEncHdr:    10,
    szMetaLbl:    7,
    szMetaVal:    6.5,
    szCampo:      10,
    szComp:       9,
    szResp:       10,
    szPtEnc:      10,
    szSenHdr:     10,
    szSenInstr:   9,
    szSenTxt:     8.5,
    szPelTitulo:  8.5,
    szPelCat:     7.5,
    szPelItem:    7,
    szPelDesc:    7,
    szCtlHdr:     8,
    szCtlDesc:    7.5,
    szFooter:     8,
    szFooterPag:  7,
    szTblHdr:     10,
    szTblItem:    8,
    szTblCont:    9,

    // Leading exacto (font_pt * 1.2 * 0.352778mm)
    lh7:   2.963,
    lh75:  3.175,
    lh8:   3.387,
    lh9:   3.810,
    lh10:  4.233,

    // Bordes
    lwExt: 0.5,
    lwInt: 0.3,
    cbSize: 2.0, cbLine: 0.2, cbCheck: 0.35, cbRise: 0.55,
    capFactor: 0.72,
    cellPadV: 0.5,

    // Colores RGB
    cHdrBg:  [0, 48, 87],
    cHdrFg:  [255, 255, 255],
    cSecBg:  [173, 198, 222],
    cBorder: [0, 0, 0],
    cText:   [0, 0, 0],
    cFooter: [80, 80, 80],
    cLine:   [170, 170, 170],
    cWhite:  [255, 255, 255],

    get footerY(){ return this.ph - this.mb + 1.5; }
  };

  // Crear documento
  const doc = new jsPDFClass({ unit: 'mm', format: 'letter', orientation: 'landscape' });
  let _arialNarrowLoaded = false;
  let _genTimestamp = options.genTimestamp || new Date().toLocaleString('es-CO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  // 3. Registrar Fuentes si se proveen en base64
  if (options.arialNarrowBase64) {
    try {
      doc.addFileToVFS('arial-narrow.ttf', options.arialNarrowBase64.trim());
      doc.addFont('arial-narrow.ttf', 'ArialNarrow', 'normal');
      _arialNarrowLoaded = true;
    } catch (e) {
      console.warn("No se pudo cargar ArialNarrow Regular:", e);
    }
  }
  if (options.arialNarrowBoldBase64) {
    try {
      doc.addFileToVFS('arial-narrow-bold.ttf', options.arialNarrowBoldBase64.trim());
      doc.addFont('arial-narrow-bold.ttf', 'ArialNarrow', 'bold');
      _arialNarrowLoaded = true;
    } catch (e) {
      console.warn("No se pudo cargar ArialNarrow Bold:", e);
    }
  }

  // Si no se proporcionaron base64 pero se definió una callback de carga o urls
  if (!_arialNarrowLoaded && options.fontsUrlPrefix && typeof fetch !== 'undefined') {
    const fuentes = [
      { file: 'arial-narrow.b64.txt',      style: 'normal' },
      { file: 'arial-narrow-bold.b64.txt', style: 'bold'   },
    ];
    for (const { file, style } of fuentes) {
      try {
        const resp = await fetch(`${options.fontsUrlPrefix}${file}`);
        if (resp.ok) {
          const b64 = (await resp.text()).trim();
          if (b64 && b64.length > 100) {
            const ttfName = file.replace('.b64.txt', '.ttf');
            doc.addFileToVFS(ttfName, b64);
            doc.addFont(ttfName, 'ArialNarrow', style);
            _arialNarrowLoaded = true;
          }
        }
      } catch(e) {}
    }
  }

  // Verificar si quedó registrada Arial Narrow
  try {
    const fontList = doc.getFontList();
    _arialNarrowLoaded = 'ArialNarrow' in fontList;
  } catch(e) {
    _arialNarrowLoaded = false;
  }

  // --- Sub-Funciones de Dibujo Conectadas a la Instancia Local `doc` ---

  function _setFont(style, size, color, useNarrow = false) {
    if (useNarrow && _arialNarrowLoaded) {
      doc.setFont('ArialNarrow', style || 'normal');
    } else {
      doc.setFont('helvetica', style || 'normal');
    }
    if (size)  doc.setFontSize(size);
    if (color) doc.setTextColor(...color);
  }

  function _setFontNarrow(style, size, color) {
    _setFont(style, size, color, true);
  }

  function _rect(x, y, w, h, fillColor, strokeColor) {
    if (fillColor) {
      doc.setFillColor(...fillColor);
      doc.rect(x, y, w, h, strokeColor ? 'FD' : 'F');
    } else {
      doc.setDrawColor(...(strokeColor || L.cBorder));
      doc.rect(x, y, w, h, 'S');
    }
    doc.setDrawColor(...L.cBorder);
  }

  function _text(txt, x, y, opts) {
    doc.text(String(txt || ''), x, y, opts || {});
  }

  function _vbase(topCelda, altoCelda, fontPt) {
    const capH = fontPt * 0.352778 * L.capFactor;
    return topCelda + altoCelda / 2 + capH / 2;
  }

  function _hline(x, y, w, color) {
    doc.setDrawColor(...(color || L.cBorder));
    doc.line(x, y, x + w, y);
    doc.setDrawColor(...L.cBorder);
  }

  function _checkbox(x, yBaseline, sel) {
    const s = L.cbSize;
    const top = yBaseline - s + L.cbRise;
    doc.setLineWidth(L.cbLine);
    doc.setDrawColor(...L.cBorder);
    doc.rect(x, top, s, s, 'S');
    if (sel) {
      doc.setLineWidth(L.cbCheck);
      const x1 = x + s * 0.18, y1 = top + s * 0.52;
      const x2 = x + s * 0.42, y2 = top + s * 0.78;
      const x3 = x + s * 0.84, y3 = top + s * 0.20;
      doc.line(x1, y1, x2, y2);
      doc.line(x2, y2, x3, y3);
    }
    doc.setLineWidth(L.lwInt);
  }

  function _x0() { return L.ml; }

  // Encabezado
  function _dibujarEncabezado(logoData) {
    const x = L.ml, y = L.mt, w = L.p1ColW, h = L.hdrH;
    doc.setLineWidth(L.lwExt); doc.setDrawColor(...L.cBorder);
    doc.rect(x, y, w, h, 'S');

    if (logoData && logoData.uri) {
      try {
        const fmt = logoData.mime || 'PNG';
        const offX = x + (L.logoCol - L.logoW) / 2;
        const offY = y + (h - L.logoH) / 2;
        doc.addImage(logoData.uri, fmt, offX, offY, L.logoW, L.logoH, undefined, 'FAST');
      } catch(e) {
        console.warn("No se pudo dibujar el logo en la cabecera:", e);
      }
    }
    doc.setLineWidth(L.lwInt); doc.setDrawColor(...L.cBorder);
    doc.line(x + L.logoCol, y, x + L.logoCol, y + h);

    const titX = x + L.logoCol, titW = L.titleCol;
    _setFontNarrow('bold', L.szEncHdr, L.cText);
    const TITULO = ['ANÁLISIS CONTINUO', 'DE PELIGROS POR', 'LA TAREA'];
    const totalHT = TITULO.length * L.lh10;
    const y0 = y + (h - totalHT) / 2 + L.lh10 * 0.78;
    TITULO.forEach((ln, i) => _text(ln, titX + titW / 2, y0 + i * L.lh10, { align: 'center' }));

    const mx = x + L.logoCol + L.titleCol;
    doc.setLineWidth(L.lwInt);
    doc.line(mx, y, mx, y + h);

    const valX = mx + L.metaLblCol;
    doc.line(valX, y, valX, y + h);

    const docCfg = options.empresa || {
      documentoCodigo: "FM-HSE-022",
      documentoRevision: "1",
      documentoFecha: "11-mar-2026"
    };
    const metas = [
      ['Código:',   docCfg.documentoCodigo   || 'FM-HSE-022'],
      ['Página:',   'Pie de pág.'],
      ['Revisión:', docCfg.documentoRevision || '1'],
      ['Fecha:',    docCfg.documentoFecha    || '11-mar-2026'],
    ];
    const capH7 = L.szMetaLbl * 0.352778 * 0.72;
    const vOff  = L.hdrRowH / 2 + capH7 / 2;

    metas.forEach(([lbl, val], i) => {
      const rowY = y + i * L.hdrRowH;
      if (i > 0) { doc.setLineWidth(L.lwInt); doc.line(mx, rowY, x + w, rowY); }
      _setFontNarrow('bold',   L.szMetaLbl, L.cText);
      _text(lbl, mx + L.padL, rowY + vOff);
      _setFontNarrow('normal', L.szMetaVal, L.cText);
      _text(val, valX + L.metaValCol / 2, rowY + vOff, { align: 'center' });
    });
  }

  // Información General
  function _dibujarInfoGeneral(general, yStart) {
    const x = L.ml; let y = yStart;
    [['Lugar', general.lugar], ['Fecha', general.fecha], ['Tarea', general.tarea]]
    .forEach(([lbl, val]) => {
      _setFontNarrow('bold',   L.szCampo, L.cText);
      _text(`${lbl}:`, x + L.padL, _vbase(y, L.lh9 + 1.5, L.szCampo));
      _setFontNarrow('normal', L.szCampo, L.cText);
      const lines = doc.splitTextToSize(val || '', L.p1ColW - 16);
      _text(lines[0] || '', x + 16, _vbase(y, L.lh9 + 1.5, L.szCampo));
      doc.setDrawColor(...L.cLine); doc.setLineWidth(0.2);
      doc.line(x + 16, y + L.lh9 + 0.5, x + L.p1ColW - L.padL, y + L.lh9 + 0.5);
      doc.setDrawColor(...L.cBorder);
      y += L.lh9 + 1.5;
    });
    _setFontNarrow('italic', L.szComp, L.cText);
    const compL = doc.splitTextToSize(
      'Identificar continuamente los peligros generados por la tarea y tomaré las medidas de control para prevenir accidentes',
      L.p1ColW - L.padL * 2);
    compL.slice(0, 4).forEach((ln, i) => _text(ln, x + L.padL, y + (i + 1) * L.lh9));
    return y + Math.min(compL.length, 4) * L.lh9 + 1.5;
  }

  // Responsables
  function _dibujarResponsables(responsables, yStart) {
    const x = L.ml; let y = yStart; const w = L.tblW;
    const NW = L.rNomW, CW = L.rCedW, FW = L.rFirW;

    _rect(x, y, w, L.lh9 + 2, L.cHdrBg);
    _setFontNarrow('bold', L.szResp, L.cHdrFg);
    _text('Responsables de la Tarea', x + w / 2, _vbase(y, L.lh9 + 2, L.szResp), { align: 'center' });
    y += L.lh9 + 2;

    _rect(x, y, w, L.lh9 + 1.5, L.cSecBg);
    doc.setLineWidth(L.lwInt); doc.setDrawColor(...L.cBorder);
    doc.rect(x, y, w, L.lh9 + 1.5, 'S');
    _setFontNarrow('bold', L.szResp, L.cText);
    _text('Nombre', x + NW / 2, _vbase(y, L.lh9 + 1.5, L.szResp), { align: 'center' });
    doc.line(x + NW, y, x + NW, y + L.lh9 + 1.5);
    _text('Cédula', x + NW + CW / 2, _vbase(y, L.lh9 + 1.5, L.szResp), { align: 'center' });
    doc.line(x + NW + CW, y, x + NW + CW, y + L.lh9 + 1.5);
    _text('Firma', x + NW + CW + FW / 2, _vbase(y, L.lh9 + 1.5, L.szResp), { align: 'center' });
    y += L.lh9 + 1.5;

    const lista = (responsables || []).slice(0, L.rRows);
    for (let i = 0; i < L.rRows; i++) {
      const rh = i < 6 ? L.rRowH : (i === 6 ? L.rRow8 : L.rRow9);
      const r  = lista[i] || { nombre: '', cedula: '' };
      doc.setLineWidth(L.lwInt); doc.setDrawColor(...L.cBorder);
      doc.rect(x, y, w, rh, 'S');
      doc.line(x + NW, y, x + NW, y + rh);
      doc.line(x + NW + CW, y, x + NW + CW, y + rh);
      _setFontNarrow('normal', 9, L.cText);
      if (r.nombre) _text(r.nombre.substring(0, 26), x + L.padL, _vbase(y, rh, 9));
      if (r.cedula) _text(r.cedula, x + NW + L.padL, _vbase(y, rh, 9));
      y += rh;
    }
    return y;
  }

  // Punto de Encuentro y Ducha cercano
  function _dibujarUbicacion(pe, dl, yStart) {
    const x = L.ml; let y = yStart; const w = L.tblW;
    const pairs = [
      ['Punto de encuentro cercano:', pe, L.ptLblH, L.ptValH],
      ['Ducha y lavaojos cercano:',  dl, L.ptLblH, L.dlValH],
    ];
    pairs.forEach(([lbl, val, lblH, valH]) => {
      const lblHE = Math.max(lblH, L.szPtEnc * 0.352778 + L.cellPadV);
      _rect(x, y, w, lblHE, L.cSecBg);
      doc.setLineWidth(L.lwExt); doc.setDrawColor(...L.cBorder);
      doc.rect(x, y, w, lblHE, 'S');
      _setFontNarrow('bold', L.szPtEnc, L.cText);
      _text(lbl, x + L.padL, _vbase(y, lblHE, L.szPtEnc));
      y += lblHE;
      doc.setLineWidth(L.lwInt); doc.rect(x, y, w, valH, 'S');
      _setFontNarrow('normal', L.szPtEnc, L.cText);
      _text(val || '', x + L.padL, _vbase(y, valH, L.szPtEnc));
      y += valH;
    });
    return y;
  }

  // Señales para detener la tarea
  function _dibujarSenales(senalesParada, yStart) {
    const x = L.ml; let y = yStart; const w = L.tblW;
    const botY   = L.mt + L.contentH;
    const totalH = botY - y;
    doc.setLineWidth(L.lwExt); doc.setDrawColor(...L.cBorder);
    doc.rect(x, y, w, totalH, 'S');

    const spHdrHE = Math.max(L.spHdrH, L.szSenHdr * 0.352778 + L.cellPadV);
    _rect(x, y, w, spHdrHE, L.cHdrBg);
    _setFontNarrow('bold', L.szSenHdr, L.cHdrFg);
    _text('SEÑALES PARA DETENER LA TAREA', x + w / 2, _vbase(y, spHdrHE, L.szSenHdr), { align: 'center' });
    y += spHdrHE;

    _setFontNarrow('normal', L.szSenInstr, L.cText);
    const instrW = w - L.padL * 2;
    const instrL = doc.splitTextToSize(
      'Escoja dos o más situaciones que podrían ocurrir o que le hayan ocurrido.',
      instrW);
    const instrLh = L.szSenInstr * 0.352778 * 1.0;
    instrL.slice(0, 2).forEach((ln, i) =>
      _text(ln, x + L.padL, y + L.szSenInstr * 0.352778 * L.capFactor + 0.6 + i * instrLh,
        { maxWidth: instrW, align: 'justify' }));
    y += L.spInstrH;

    const catalogo = options.senalesParada || DEFAULT_SENALES;
    const selIds   = (senalesParada && senalesParada.seleccionadas) || [];
    const textos   = (senalesParada && senalesParada.textos) || {};
    const checks   = catalogo.filter(s => s.tipo === 'checkbox');
    const otros    = catalogo.filter(s => s.tipo === 'texto');

    const nFilas = 8;
    const colIzq = checks.slice(0, nFilas);
    const colDer = checks.slice(nFilas).concat(otros);

    const rowH = (totalH - spHdrHE - L.spInstrH) / nFilas;

    for (let i = 0; i < nFilas; i++) {
      [colIzq[i], colDer[i]].forEach((s, ci) => {
        if (!s) return;
        const sel = selIds.includes(s.id);
        const cx  = x + ci * (w / 2) + L.padL;
        _setFontNarrow('normal', L.szSenTxt, L.cText);
        const yBaseline = _vbase(y, rowH, L.szSenTxt);
        _checkbox(cx, yBaseline, sel);
        const tx = cx + L.cbSize + 1;
        const tw = w / 2 - (L.cbSize + 1) - L.padL * 2;
        const lh = L.szSenTxt * 0.352778 * 1.15;
        if (s.tipo === 'texto') {
          const tv = textos[s.id] || '';
          _text("Otros: ", tx, yBaseline);
          const labelW = doc.getTextWidth("Otros: ");
          const lineX = tx + labelW;
          const cellRight = x + (ci + 1) * (w / 2) - L.padR;
          _hline(lineX, yBaseline + 0.5, cellRight - lineX, [170, 170, 170]);
          if (tv) {
            _text(tv, lineX + 1, yBaseline);
          }
        } else {
          const lns = doc.splitTextToSize(s.texto, tw).slice(0, 2);
          lns.forEach((ln, li) => _text(ln, tx, yBaseline + li * lh));
        }
      });
      y += rowH;
    }
  }

  // Catálogo peligros
  function _dibujarCatalogoPeligros(xCol, yTop) {
    const categorias = options.peligros || DEFAULT_PELIGROS;
    let y = yTop; const w = L.tblW;
    doc.setLineWidth(L.lwExt); doc.setDrawColor(...L.cBorder);
    doc.rect(xCol, yTop, w, L.contentH, 'S');

    _setFontNarrow('normal', L.szPelTitulo, L.cText);
    const titL = doc.splitTextToSize(
      'Seleccione los peligros identificados antes del desarrollo de la tarea',
      w - L.padL * 2).slice(0, 2);
    const titLh = L.szPelTitulo * 0.352778 * 1.05;
    const titY0 = y + L.pelHdrH / 2 - ((titL.length - 1) * titLh) / 2
                  + (L.szPelTitulo * 0.352778 * L.capFactor) / 2;
    titL.forEach((ln, i) => _text(ln, xCol + L.padL, titY0 + i * titLh));
    y += L.pelHdrH;

    const SL = L.pelSubL;
    const maxW = SL - L.padL - 6.5;
    const itemLh = L.szPelDesc * 0.352778 * 1.0;

    const preprocessedCat = [];
    let H_unscaled = 0;
    categorias.forEach(cat => {
      const p   = cat.peligros || [];
      const mid = Math.ceil(p.length / 2);
      const s1  = p.slice(0, mid), s2 = p.slice(mid);
      const rowHeights = [];
      const rowLines = [];
      for (let i = 0; i < Math.max(s1.length, s2.length); i++) {
        const lns = [s1[i], s2[i]].map(pp =>
          pp ? doc.splitTextToSize(pp.descripcion, maxW).slice(0, 2) : []);
        const nMax = Math.max(1, lns[0].length, lns[1].length);
        const rowH = Math.max(L.pelItemH, nMax * itemLh + 0.6);
        rowHeights.push(rowH);
        rowLines.push(lns);
      }
      preprocessedCat.push({ cat, s1, s2, rowHeights, rowLines });
      H_unscaled += L.pelRowH;
      rowHeights.forEach(h => { H_unscaled += h; });
      H_unscaled += 0.4;
    });

    const bottomPadding = 1.0;
    const availableH = L.contentH - L.pelHdrH - bottomPadding;
    const scale = H_unscaled > availableH ? (availableH / H_unscaled) : 1.0;

    preprocessedCat.forEach(({ cat, s1, s2, rowHeights, rowLines }) => {
      const catH = L.pelRowH * scale;
      _rect(xCol, y, w, catH, L.cSecBg);
      doc.setLineWidth(L.lwInt); doc.setDrawColor(...L.cBorder);
      doc.rect(xCol, y, w, catH, 'S');
      _setFontNarrow('bold', L.szPelCat, L.cText);
      _text(cat.categoria, xCol + w / 2, _vbase(y, catH, L.szPelCat), { align: 'center' });
      y += catH;

      for (let i = 0; i < rowHeights.length; i++) {
        const rowH = rowHeights[i] * scale;
        const lns = rowLines[i];
        [s1[i], s2[i]].forEach((pp, ci) => {
          if (!pp) return;
          const px = xCol + ci * SL + L.padL;
          const nl = lns[ci].length;
          const y0 = y + rowH / 2 - ((nl - 1) * itemLh * scale) / 2
                     + (L.szPelItem * 0.352778 * L.capFactor) / 2;
          _setFontNarrow('bold',   L.szPelItem, L.cText);
          _text(`${pp.codigo}.`, px, y0);
          _setFontNarrow('normal', L.szPelDesc, L.cText);
          lns[ci].forEach((ln, li) => _text(ln, px + 6.5, y0 + li * itemLh * scale));
        });
        y += rowH;
      }
      y += 0.4 * scale;
    });
  }

  // Guía Controles
  function _dibujarGuiaControles(xCol, yTop) {
    const rawControles = options.controles || DEFAULT_CONTROLES;
    const flatControles = rawControles.flatMap(grp =>
      (grp.controles || []).map(c => ({ ...c }))
    );
    const controles = flatControles
      .slice().sort((a, b) => parseInt(a.codigo) - parseInt(b.codigo));

    let y = yTop; const w = 76.02;
    doc.setLineWidth(L.lwExt); doc.setDrawColor(...L.cBorder);
    doc.rect(xCol, yTop, w, L.contentH, 'S');

    _rect(xCol, y, w, L.ctlHdrH, L.cHdrBg);
    doc.setLineWidth(L.lwInt); doc.setDrawColor(...L.cBorder);
    doc.rect(xCol, y, w, L.ctlHdrH, 'S');
    _setFontNarrow('bold', L.szCtlHdr, L.cHdrFg);
    _text('GUÍA MEDIDAS PREVENTIVAS Y DE CONTROL',
      xCol + w / 2, _vbase(y, L.ctlHdrH, L.szCtlHdr), { align: 'center' });
    y += L.ctlHdrH;

    const cellL  = xCol + L.padL;
    const numX   = cellL + L.ctlHang;
    const descX  = cellL + L.ctlLeft;
    const descW  = w - L.padL - L.ctlLeft - L.padL;

    y += L.ctlEmptyPara;

    const blankParaH = 5 * 0.352778 * 1.15;
    const availableH = L.contentH - L.ctlHdrH - L.ctlEmptyPara - blankParaH;
    let totalLines = 0;
    const preprocessed = [];
    controles.forEach(ctrl => {
      const lines = doc.splitTextToSize(ctrl.descripcion, descW);
      const count = Math.max(1, lines.length);
      preprocessed.push({ ctrl, lines, count });
      totalLines += count;
    });

    const ctlLh = availableH / (totalLines || 1);

    preprocessed.forEach(({ ctrl, lines, count }) => {
      const baseY = y + L.szCtlDesc * 0.352778 * L.capFactor + 0.4;
      _setFontNarrow('normal', L.szCtlNum, L.cText);
      _text(`${ctrl.codigo}.`, numX, baseY);
      _setFontNarrow('normal', L.szCtlDesc, L.cText);
      lines.forEach((ln, li) => _text(ln, descX, baseY + li * ctlLh));
      y += count * ctlLh;
    });
  }

  // Footer
  function _dibujarFooter(pageNum, stateData) {
    const x = L.ml, y = L.footerY;
    const nombre = (stateData.identificacion || {}).nombreArchivo || 'FM-HSE-022';
    _setFontNarrow('normal', L.szFooter, L.cFooter);
    _text(`${nombre} | ${_genTimestamp}`, x, y + 2);
    _text('Copia no Controlada', x + L.aw / 2, y + 2, { align: 'center' });
  }

  // Página 2 Header
  function _dibujarHeaderTabla(yTop) {
    const blqs = [
      [L.p2B1X, 'Pasos de la Tarea'],
      [L.p2B2X, 'Peligros Identificados'],
      [L.p2B3X, 'Medidas Preventivas y de Control'],
    ];
    blqs.forEach(([bx, lbl]) => {
      _rect(bx, yTop, L.p2BW, L.p2HdrH, L.cSecBg);
      doc.setLineWidth(L.lwInt); doc.setDrawColor(...L.cBorder);
      doc.rect(bx, yTop, L.p2BW, L.p2HdrH, 'S');
      doc.line(bx + L.p2ItmW, yTop, bx + L.p2ItmW, yTop + L.p2HdrH);
      _setFontNarrow('bold', L.szTblHdr, L.cText);
      _text('Ítem', bx + L.p2ItmW / 2, yTop + L.p2HdrH / 2 + 1.5, { align: 'center' });
      _text(lbl, bx + L.p2ItmW + L.p2ContW / 2, yTop + L.p2HdrH / 2 + 1.5, { align: 'center' });
    });
    return yTop + L.p2HdrH;
  }

  // Página 2 Fila
  function _dibujarFilaPaso(paso, yTop, contenidos) {
    [L.p2B1X, L.p2B2X, L.p2B3X].forEach((bx, bi) => {
      doc.setLineWidth(L.lwInt); doc.setDrawColor(...L.cBorder);
      doc.rect(bx, yTop, L.p2BW, L.p2RowH, 'S');
      doc.line(bx + L.p2ItmW, yTop, bx + L.p2ItmW, yTop + L.p2RowH);
      _setFontNarrow('bold',   L.szTblItem, L.cText);
      _text(String(paso.numero), bx + L.p2ItmW / 2, yTop + L.p2RowH / 2 + 1.5, { align: 'center' });
      _setFontNarrow('normal', L.szTblCont, L.cText);
      const lines = doc.splitTextToSize(contenidos[bi], L.p2ContW - L.padL * 2);
      lines.slice(0, 3).forEach((ln, li) =>
        _text(ln, bx + L.p2ItmW + L.padL, yTop + 4.5 + li * 4.5));
    });
    return yTop + L.p2RowH;
  }

  // --- Orquestadores de Página ---

  function _generarPagina1(stateData, logoData) {
    doc.setPage(1);
    const xC2 = L.p1C2X, xC3 = L.p1C3X;
    _dibujarEncabezado(logoData);
    const yInfo  = L.mt + L.hdrH + 2.0;
    const yResp  = _dibujarInfoGeneral(stateData.general || {}, yInfo);
    const yUbic  = _dibujarResponsables(stateData.responsables || [], yResp) + L.tblGap;
    const ySenal = _dibujarUbicacion(
      stateData.puntoEncuentro || '', stateData.duchaLavaojos || '', yUbic) + L.tblGap;
    _dibujarSenales(stateData.senalesParada || {}, ySenal);
    _dibujarCatalogoPeligros(xC2, L.mt);
    _dibujarGuiaControles(xC3, L.mt);
    _dibujarFooter(1, stateData);
  }

  function _generarPaginasPasos(pasos, stateData) {
    doc.addPage();
    const curPage = 2;
    let curY = L.mt;
    curY = _dibujarHeaderTabla(curY);
    const totalH = L.p2HdrH + L.p2Rows * L.p2RowH;
    [L.p2B1X, L.p2B2X, L.p2B3X].forEach(bx => {
      doc.setLineWidth(L.lwExt); doc.setDrawColor(...L.cBorder);
      doc.rect(bx, L.mt, L.p2BW, totalH, 'S');
    });
    for (let i = 0; i < L.p2Rows; i++) {
      if (i < pasos.length) {
        const p = pasos[i];
        const contenidos = [
          p.descripcion || '',
          (p.peligros || []).join(', '),
          (p.controles || []).join(', '),
        ];
        curY = _dibujarFilaPaso(p, curY, contenidos);
      } else {
        [L.p2B1X, L.p2B2X, L.p2B3X].forEach(bx => {
          doc.setLineWidth(L.lwInt); doc.setDrawColor(...L.cBorder);
          doc.rect(bx, curY, L.p2BW, L.p2RowH, 'S');
          doc.line(bx + L.p2ItmW, curY, bx + L.p2ItmW, curY + L.p2RowH);
        });
        curY += L.p2RowH;
      }
    }
    _dibujarFooter(curPage, stateData);
    return curPage;
  }

  function _actualizarTotalPaginas(totalPages, stateData) {
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      const x = _x0() + L.aw - 20;
      const y = L.footerY - 1;
      doc.setFillColor(...L.cWhite);
      doc.rect(x, y, 22, 5, 'F');
      _setFontNarrow('normal', L.szFooterPag, L.cFooter);
      const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
      doc.text(`${pageNum}/${totalPages}`, _x0() + L.aw, L.footerY + 2, { align: 'right' });
    }
  }

  // --- Orquestación Principal ---

  // A. Preparar Logo
  let logoData = null;
  if (options.logoBase64) {
    const mime = options.logoBase64.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
    logoData = { uri: options.logoBase64, mime };
  } else if (options.logoUrl && typeof fetch !== 'undefined') {
    try {
      const respPng = await fetch(options.logoUrl);
      if (respPng.ok) {
        const blob = await respPng.blob();
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const mime = (bytes[0] === 0xFF && bytes[1] === 0xD8) ? 'image/jpeg' : 'image/png';
        const b64 = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
        logoData = {
          uri: `data:${mime};base64,${b64}`,
          mime: mime === 'image/jpeg' ? 'JPEG' : 'PNG'
        };
      }
    } catch(e) {}
  }

  // B. Generar Página 1
  _generarPagina1(state, logoData);

  // C. Generar Páginas de Pasos (Pág 2+)
  _generarPaginasPasos(state.pasos || [], state);

  // D. Actualizar totales en footers (Second-pass)
  const totalPages = doc.internal.getNumberOfPages();
  _actualizarTotalPaginas(totalPages, state);

  // E. Retornar instancia lista para guardar o extraer blob
  return doc;
}

// Exportar para CommonJS si está disponible (entorno Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generarDocumentoPDF,
    DEFAULT_SENALES,
    DEFAULT_PELIGROS,
    DEFAULT_CONTROLES
  };
}

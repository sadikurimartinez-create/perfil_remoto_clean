export type TagStrategyCluster = "CLUSTER_1" | "CLUSTER_2" | "CLUSTER_3" | "CLUSTER_4" | "CLUSTER_5";

export type TagStrategy = {
  cluster: TagStrategyCluster;
  descripcionCluster: string;
  bibliografia: string;
  csvFoco: string;
  apiEnfasis: string;
  geminiInstruccion: string;
};

const baseCluster1 =
  "Priorizar teorías de Ventanas Rotas y Elección Racional, enfatizando deterioro físico, ausencia de guardianes y decisiones de rutas de escape.";
const baseCluster2 =
  "Priorizar la teoría de Actividades Rutinarias, analizando convergencia de infractor motivado, víctima adecuada y ausencia de guardián.";
const baseCluster3 =
  "Priorizar la teoría de Elección Racional aplicada a mercados de bienes robados y economía informal.";
const baseCluster4 =
  "Priorizar la teoría de Patrón Delictivo, identificando nodos, rutas y polígonos de concentración.";
const baseCluster5 =
  "Utilizar el texto libre del investigador y la lectura cruda de Vision API como insumo principal.";

export const TAG_STRATEGIES: Record<string, TagStrategy> = {
  "Terrenos baldíos / Caminos sobre terrenos en breña": {
    cluster: "CLUSTER_1",
    descripcionCluster: "Espacios de vulnerabilidad física y decadencia.",
    bibliografia: "Ventanas Rotas y Elección Racional.",
    csvFoco:
      "Delitos patrimoniales con énfasis en horarios nocturnos en un radio de 500 m.",
    apiEnfasis:
      "Vision API debe medir densidad de maleza, basura y nivel de iluminación; Geocoding y Elevation deben apoyar el análisis de si funciona como ruta de escape o atajo.",
    geminiInstruccion:
      "Analiza el terreno baldío o camino en breña como punto de vulnerabilidad física, identificando cómo la falta de mantenimiento y la baja visibilidad facilitan la elección racional del infractor para ocultamiento y rutas de escape.",
  },
  "Viviendas deshabitadas y paracaidistas / Viviendas quemadas": {
    cluster: "CLUSTER_1",
    descripcionCluster: "Viviendas en abandono y escenarios de paracaidismo.",
    bibliografia: "Ventanas Rotas y Elección Racional.",
    csvFoco:
      "Delitos patrimoniales (robo a casa habitación, daños) y hechos violentos en 500 m.",
    apiEnfasis:
      "Vision API debe buscar escombro, grafitis, ventanas rotas y signos de vandalismo continuo; Street View debe revisar el tiempo de abandono.",
    geminiInstruccion:
      "Evalúa la vivienda deshabitada como foco de deterioro simbólico y físico, analizando cómo favorece ocupaciones ilegales, refugio de infractores y percepción de desorden.",
  },
  "Escuelas / Templos de culto": {
    cluster: "CLUSTER_2",
    descripcionCluster: "Nodos de reunión lícita con riesgo por giros antagónicos cercanos.",
    bibliografia: "Actividades Rutinarias.",
    csvFoco:
      "Cristalazos, robo a transeúnte y robo de autopartes, cruzados con horarios de entrada y salida.",
    apiEnfasis:
      "Places API debe trazar una geovalla de 200 m para buscar expendios de alcohol, bares, maquinitas y otros giros antagónicos; marcar convergencia de riesgo si se detectan.",
    geminiInstruccion:
      "Analiza la vulnerabilidad de población escolar o feligreses cuando coexisten actividades incompatibles (alcohol, juego) en su entorno inmediato.",
  },
  "Bancos y/o cajeros automáticos / Casas de cambio": {
    cluster: "CLUSTER_2",
    descripcionCluster: "Nodos financieros y puntos críticos de manejo de efectivo.",
    bibliografia: "Actividades Rutinarias.",
    csvFoco:
      "Robo a transeúnte y robo con violencia en torno a horarios de apertura y cierre.",
    apiEnfasis:
      "Vision API debe identificar obstáculos visuales (árboles, puestos, vehículos) que faciliten acecho y ocultamiento.",
    geminiInstruccion:
      "Evalúa cómo la configuración física y visual del entorno permite o limita el acecho, selección de víctimas y rutas de huida.",
  },
  "Gasolineras / Oxxo / Farmacias 24 hrs. / Moteles": {
    cluster: "CLUSTER_2",
    descripcionCluster: "Atractores nocturnos y puntos de alta movilidad de personas.",
    bibliografia: "Actividades Rutinarias.",
    csvFoco:
      "Filtrar ilícitos ocurridos entre 00:00 y 05:00 hrs en el radio analizado.",
    apiEnfasis:
      "Places API debe confirmar giros 24 horas; el cruce con CSV debe priorizar incidentes nocturnos.",
    geminiInstruccion:
      "Analiza estos giros como nodos donde se reconfiguran rutinas nocturnas y se incrementa la exposición de víctimas potenciales.",
  },
  "Expendios de alcohol / Bares, antros y merenderos / Billares": {
    cluster: "CLUSTER_2",
    descripcionCluster: "Nodos generadores de conflicto asociados al consumo de alcohol.",
    bibliografia: "Actividades Rutinarias.",
    csvFoco:
      "Violencia interpersonal, riñas y delitos patrimoniales asociados a horarios de operación nocturnos.",
    apiEnfasis:
      "Places API y DENUE deben cruzarse para validar permisos y formalidad del giro; marcar discrepancias.",
    geminiInstruccion:
      "Perfila el lugar como generador de oportunidades delictivas y deterioro del control informal, describiendo patrones horarios de riesgo.",
  },
  "Terminales de transporte público": {
    cluster: "CLUSTER_2",
    descripcionCluster: "Nodos generadores principales de flujo peatonal.",
    bibliografia: "Actividades Rutinarias.",
    csvFoco:
      "Delitos de oportunidad (carterismo, robo a transeúnte) en horarios pico de movilidad.",
    apiEnfasis:
      "Places API debe confirmar concentración de rutas; CSV debe revisar densidad de incidentes alrededor de las terminales.",
    geminiInstruccion:
      "Analiza la terminal como punto de confluencia de víctimas potenciales y describe cómo la saturación y el desorden facilitan el delito de oportunidad.",
  },
  "Gimnasios": {
    cluster: "CLUSTER_2",
    descripcionCluster: "Nodos de rutina diaria con concentración de vehículos estacionados.",
    bibliografia: "Actividades Rutinarias.",
    csvFoco: "Robo de autopartes en los horarios de mayor afluencia del gimnasio.",
    apiEnfasis:
      "CSV debe correlacionar incidentes de autopartes con horarios de operación; Vision API puede evaluar visibilidad del estacionamiento.",
    geminiInstruccion:
      "Evalúa la vulnerabilidad de los vehículos asociados a estancias prolongadas y horarios previsibles de asistencia.",
  },
  "Chatarreras / Casa de empeño / Compra y venta de celulares": {
    cluster: "CLUSTER_3",
    descripcionCluster: "Nodos posibles de recepción y circulación de bienes robados.",
    bibliografia: "Elección Racional aplicada a mercados ilícitos.",
    csvFoco:
      "Robo de autopartes y robo a casa habitación en la periferia de estos giros.",
    apiEnfasis:
      "Cruce obligatorio Places API vs DENUE; si no hay registro en DENUE, etiquetar como posible receptor de objetos ilícitos.",
    geminiInstruccion:
      "Analiza estos puntos como mercados facilitadores de colocación de objetos robados, evaluando cómo modifican el cálculo de costo-beneficio del infractor.",
  },
  "Locales de máquinas tragamonedas": {
    cluster: "CLUSTER_3",
    descripcionCluster: "Focos de reunión de infractores motivados y economía informal.",
    bibliografia: "Elección Racional y Actividades Rutinarias.",
    csvFoco:
      "Delitos patrimoniales y violencia asociada, especialmente en horarios de operación de las máquinas.",
    apiEnfasis:
      "Places API debe validar cercanía a escuelas y otros nodos vulnerables.",
    geminiInstruccion:
      "Evalúa el lugar como punto de concentración de infractores motivados y su impacto en corredores peatonales cercanos.",
  },
  "Negocios no registrados (Talleres, Barberías, Venta de ropa tipo cholo, Gestorías)": {
    cluster: "CLUSTER_3",
    descripcionCluster: "Economía informal instalada en espacios residenciales o mixtos.",
    bibliografia: "Elección Racional y mercados ilegales.",
    csvFoco:
      "Robo de autopartes, robo a casa habitación y daños a la propiedad en el entorno inmediato.",
    apiEnfasis:
      "Cruce estricto Places vs DENUE; pedir a Vision API que identifique obstrucciones, vehículos desarmados y uso de la vía pública como extensión del taller.",
    geminiInstruccion:
      "Analiza cómo la informalidad y la falta de regulación del giro alteran el control social y pueden facilitar actividades ilícitas.",
  },
  "Tianguis / Puestos ambulantes / Puestos de bebidas preparadas / Ventas de dulces / Negocios de suplementos": {
    cluster: "CLUSTER_3",
    descripcionCluster: "Comercio ambulante y tianguis como generadores de cuellos de botella.",
    bibliografia: "Elección Racional y Actividades Rutinarias.",
    csvFoco:
      "Delitos de oportunidad en días y horarios de instalación, con énfasis en carterismo y robo simple.",
    apiEnfasis:
      "Vision API debe evaluar si la instalación bloquea visibilidad o genera puntos ciegos; Places/CSV deben correlacionar incidentes con días de tianguis.",
    geminiInstruccion:
      "Describe cómo la ocupación temporal del espacio público modifica rutas y visibilidad, creando oportunidades delictivas.",
  },
  "Picaderos / Anexos y centros de rehabilitación": {
    cluster: "CLUSTER_4",
    descripcionCluster: "Puntos de alta tensión comunitaria y consumo problemático.",
    bibliografia: "Patrón Delictivo.",
    csvFoco:
      "Evaluar si actúan como epicentro de clúster delictivo en el entorno barrial.",
    apiEnfasis:
      "Cruzar CSV en 500 m para ver si hay concentración de delitos violentos o patrimoniales vinculados a la dinámica del lugar.",
    geminiInstruccion:
      "Perfila el impacto de estos nodos en la percepción de seguridad, cohesión social y patrones de reporte ciudadano.",
  },
  "Alojamiento de personas en situación de calle / Loncherías (cachimbas)": {
    cluster: "CLUSTER_4",
    descripcionCluster: "Espacios asociados a marginación extrema y refugio temporal.",
    bibliografia: "Patrón Delictivo y Ventanas Rotas.",
    csvFoco:
      "Revisar si existe clúster de delitos de oportunidad o conflictos recurrentes en el entorno cercano.",
    apiEnfasis:
      "Vision API debe detectar estructuras improvisadas (lonas, cartón, madera) y condiciones de deterioro.",
    geminiInstruccion:
      "Analiza la relación entre marginación, uso informal del espacio y percepción de riesgo en la comunidad.",
  },
  "Autobuses y transporte pesado en calles": {
    cluster: "CLUSTER_4",
    descripcionCluster: "Barreras físicas móviles que generan puntos ciegos.",
    bibliografia: "Patrón Delictivo y Elección Racional.",
    csvFoco:
      "Revisar si la presencia de transporte pesado coincide con incidentes en rutas específicas.",
    apiEnfasis:
      "Vision API debe valorar el grado en que los vehículos bloquean visibilidad y facilitan acecho u ocultamiento.",
    geminiInstruccion:
      "Evalúa cómo estas barreras modifican la geometría del espacio y las oportunidades para el delito.",
  },
  "Otro; ventana para contextualizar": {
    cluster: "CLUSTER_5",
    descripcionCluster: "Caso comodín definido por el investigador.",
    bibliografia:
      "Contexto libre; apoyarse en los cuatro marcos teóricos según corresponda.",
    csvFoco:
      "Sin filtro específico: usar estadística general del radio analizado.",
    apiEnfasis:
      "Uso estándar de Vision, Places, DENUE y CSV sin ponderaciones especiales.",
    geminiInstruccion:
      "Da un peso central al texto libre proporcionado por el investigador y a las detecciones de Vision API, integrando la teoría que mejor se ajuste al contexto descrito.",
  },
};

export function buildStrategiesSummaryForTags(tags: string[]): string {
  const uniqueTags = Array.from(new Set(tags));
  const relevantes = uniqueTags
    .map((tag) => ({ tag, strategy: TAG_STRATEGIES[tag] }))
    .filter((t) => t.strategy);

  if (relevantes.length === 0) {
    return "";
  }

  const partes = relevantes.map(({ tag, strategy }, idx) => {
    const s = strategy as TagStrategy;
    return `${idx + 1}. Etiqueta: ${tag}
   - Clúster: ${s.cluster} – ${s.descripcionCluster}
   - Bibliografía prioritaria: ${s.bibliografia}
   - Cruce estadístico sugerido: ${s.csvFoco}
   - Enfoque de APIs (Vision/Places/DENUE/Street View): ${s.apiEnfasis}
   - Instrucción a la IA: ${s.geminiInstruccion}`;
  });

  return `ESTRATEGIA ANALÍTICA POR TIPO DE PUNTO:
${partes.join("\n\n")}`;
}


import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  ExternalLink,
  House,
  Search,
  Sparkles,
} from 'lucide-react';

type ManualArticle = {
  slug: string;
  section: string;
  title: string;
  summary: string;
  sections: Array<{
    heading: string;
    items: string[];
  }>;
  note?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageCaption?: string;
  images?: Array<{
    url: string;
    alt: string;
    caption: string;
  }>;
};

const MANUAL_ARTICLES: ManualArticle[] = [
  {
    slug: 'inicio',
    section: 'Primeros pasos',
    title: 'Primeros pasos',
    summary: 'Recorrido rápido para entender la plataforma y la ayuda del manual.',
    sections: [
      {
        heading: 'Qué es este manual',
        items: [
          'Es una guía de consulta para el prototipo Centinela Orinoco y ayuda a reconocer cada vista sin depender de explicaciones del equipo.',
          'Cada sección explica qué permite hacer la herramienta, cómo se usa y qué límites tiene el resultado.',
          'La información del manual se presenta como ayuda local; no reemplaza la validación del dato en la propia pantalla de la aplicación.',
        ],
      },
      {
        heading: 'Recorrido recomendado',
        items: [
          '1. Abre Sala GIS para ver la cuenca, las capas base y los focos térmicos.',
          '2. Consulta Incidentes o Veeduría comunitaria para revisar reportes y estados.',
          '3. Usa IA, Corpus científico o Boletín para interpretar contexto y exportar resultados.',
        ],
      },
      {
        heading: 'Cómo leer esta ayuda',
        items: [
          'Usa el buscador para encontrar una tarea o palabra visible en la interfaz.',
          'En cada artículo hay una síntesis, una explicación de flujo y una lista de advertencias.',
          'Si un dato no está disponible, lo indicado en la pantalla es la fuente más fiable.',
        ],
      },
    ],
    note: 'Si buscas una opción concreta, escribe su nombre en el buscador o elígela en el índice de la izquierda.',
  },
  {
    slug: 'interfaz-y-apariencia',
    section: 'Primeros pasos',
    title: 'Interfaz y apariencia',
    summary: 'Comprende la barra superior, el menú lateral, los indicadores y los modos de color.',
    sections: [
      {
        heading: 'Menú lateral',
        items: [
          'Usa Operación para el mapa, los incidentes, las denuncias, el radar y la telemetría.',
          'Usa Análisis para las funciones de IA, el Corpus científico y el Boletín oficial. Plataforma reúne las herramientas de ingesta y Postgres.',
          'La marca al lado de un nombre indica qué sección está abierta. En un teléfono, abre el menú con el botón de menú de la barra superior.',
        ],
      },
      {
        heading: 'Barra superior',
        items: [
          'La barra muestra el nombre de la sección abierta, la conexión indicada y la hora local y UTC.',
          'Usa Nueva denuncia, Registrar alerta y Asistente IA para abrir esos flujos desde otras secciones.',
          'Abre el icono de sol/luna para elegir Día, Noche o Sistema y uno de los colores de acento. La preferencia se guarda en este navegador.',
        ],
      },
      {
        heading: 'Qué significan los indicadores',
        items: [
          'El indicador superior describe la fuente configurada; por sí solo no confirma que todos los datos estén actualizados.',
          'El contador de focos térmicos muestra cuántos focos presenta el mapa. La hora local y UTC son dos formas de mostrar la hora actual.',
        ],
      },
    ],
    images: [
      {
        url: '/manual/images/interfaz-general.png',
        alt: 'Pantalla de Sala GIS con menú lateral, barra superior, estado de conexión, hora y accesos principales.',
        caption: 'El menú lateral organiza las secciones; la barra superior muestra el contexto y accesos rápidos.',
      },
    ],
  },
  {
    slug: 'sala-gis',
    section: 'Operación',
    title: 'Sala GIS',
    summary: 'Mapa táctico con capas, focos térmicos, estaciones e inspección de elementos.',
    imageUrl: '/manual/images/sala-gis-menu.jpg',
    imageAlt: 'Sala GIS con menú principal, selector del mapa, filtro de capas, leyenda de focos y mapa de la cuenca.',
    imageCaption: 'El menú queda a la izquierda y las herramientas del mapa, encima del mapa.',
    sections: [
      {
        heading: 'Qué permite',
        items: [
          'Cambiar el mapa de fondo entre Satelital, Táctico y Topo, o pulsar Venezuela para centrar el mapa en el país.',
          'Abrir Filtro de Capas para mostrar u ocultar focos FIRMS, estaciones, incidentes, denuncias y referencias geográficas.',
          'Seleccionar un elemento del mapa para ver sus detalles y, cuando aparezca la opción, continuar con un análisis o una acción relacionada.',
        ],
      },
      {
        heading: 'Flujo principal',
        items: [
          'Abre Sala GIS desde Operación y elige el mapa de fondo que te ayude a orientarte.',
          'Selecciona Filtro de Capas y activa las capas que quieras consultar. El contador indica los elementos cargados; una capa activada puede no tener datos disponibles.',
          'Haz clic en un punto o área del mapa para abrir su inspector. Revisa fuente, fecha y ubicación antes de usar otras acciones del panel.',
          'GeoJSON descarga los datos que permite exportar la vista; no equivale a descargar todas las capas visibles.',
        ],
      },
      {
        heading: 'Límites',
        items: [
          'Las capas no son evidencia legal ni ambiental concluyente por sí mismas.',
          'Si un punto o foco aparece con información incompleta, la validación visual de la pantalla debe acompañarse de una revisión del contexto.',
        ],
      },
    ],
  },
  {
    slug: 'capas-y-focos',
    section: 'Operación',
    title: 'Capas y focos',
    summary: 'Identifica capas, filtros y cómo interpretar focos térmicos y alertas de la cuenca.',
    imageUrl: '/manual/images/capas-y-focos.jpg',
    imageAlt: 'Sala GIS con el panel Capas y Vectores Geoespaciales abierto, focos de calor agrupados en hexágonos sobre la cuenca y la leyenda Focos NASA FIRMS con el período de 7 días.',
    imageCaption: 'A la derecha, el Filtro de Capas con su contador por capa; abajo a la izquierda, la leyenda de focos con el período y la distribución de prioridades.',
    sections: [
      {
        heading: 'Capas principales',
        items: [
          'En Filtro de Capas, selecciona las opciones que quieres mostrar, como Focos de Calor (NASA FIRMS), Estaciones Hidrométricas INAMEH, Incidentes, Denuncias, Áreas Protegidas y ríos.',
          'Activa Todas muestra todas las opciones; Desactivar las oculta. La selección de capas no cambia el mapa de fondo.',
          'Un contador muestra los elementos cargados para algunas capas. Si el contador es cero, puede que la fuente todavía no tenga registros.',
        ],
      },
      {
        heading: 'Focos de calor',
        items: [
          'En la leyenda Focos NASA FIRMS, elige 24 h, 3 días o 7 días para cambiar el período.',
          'Al alejar el mapa, los focos se agrupan en hexágonos; al acercarte aparecen puntos individuales. Activa Mostrar prioridad baja para incluir esos focos.',
          'La leyenda muestra cómo se distribuyen las prioridades. Un foco indica calor detectado por satélite; por sí solo no confirma minería ni su causa.',
        ],
      },
    ],
  },
  {
    slug: 'incidentes',
    section: 'Operación',
    title: 'Incidentes',
    summary: 'Consulta, registra y actualiza alertas con estados y exportación de datos.',
    imageUrl: '/manual/images/incidentes.png',
    imageAlt: 'Vista de Incidentes con búsqueda, filtros por severidad y categoría, exportación CSV y lista de alertas con sus estados.',
    imageCaption: 'Usa la búsqueda y los filtros para encontrar alertas. Registrar alerta, en la barra superior, abre el formulario de registro.',
    sections: [
      {
        heading: 'Qué permite',
        items: [
          'Buscar por código, sector o palabra clave y filtrar por severidad o categoría.',
          'Registrar una alerta desde Registrar alerta en la barra superior. Completa título, categoría, severidad, ubicación y descripción.',
          'Exportar CSV descarga la lista que estás viendo, incluidos los filtros seleccionados.',
        ],
      },
      {
        heading: 'Flujo útil',
        items: [
          'En el formulario, completa título, categoría, nivel de severidad, ubicación, descripción y los datos adicionales que correspondan. Envía y revisa el mensaje recibido.',
          'Después de registrar, busca el incidente por su título o código y revisa el estado que aparece en su tarjeta.',
          'La lista permite cambiar el estado que se muestra. Si necesitas conservar ese cambio, verifica que se haya guardado antes de recargar.',
          'Si la alerta no aparece, revisa el mensaje recibido y vuelve a consultar la lista.',
        ],
      },
    ],
  },
  {
    slug: 'denuncias',
    section: 'Operación',
    title: 'Veeduría comunitaria',
    summary: 'Registra denuncias, ubica el punto, adjunta evidencias y sigue su estado.',
    imageUrl: '/manual/images/formulario-denuncia.jpg',
    imageAlt: 'Formulario de registro de denuncia con opción anónima, categoría, gravedad, título, georreferenciación GPS, sectores sugeridos, descripción y evidencias multimedia.',
    imageCaption: 'El formulario reúne en una sola vista la protección de identidad, la ubicación del punto, la descripción y los adjuntos.',
    sections: [
      {
        heading: 'Qué permite',
        items: [
          'Iniciar un reporte desde Nueva denuncia en la barra superior o Registrar Nueva Denuncia en esta sección.',
          'Completar título, categoría, severidad, ubicación y descripción; usar GPS, coordenadas manuales, sector preseleccionado y adjuntar fotos o videos.',
          'Guardar el código que aparece tras el envío. En la lista puedes buscar, filtrar, abrir adjuntos y usar las acciones disponibles para ese reporte.',
        ],
      },
      {
        heading: 'Flujo principal',
        items: [
          'Activa Denuncia Anónima si no quieres proporcionar nombre o contacto. Esto oculta esos datos, pero la denuncia sigue incluyendo su descripción y ubicación.',
          'Para ubicar el reporte, permite el GPS, introduce coordenadas o elige un sector sugerido. Si el GPS falla, usa una de las otras dos opciones.',
          'Adjunta fotos o videos y revísalos antes de enviar. Anota el código mostrado en la confirmación para localizar el reporte en la lista.',
          'Ver en Mapa Táctico cierra la confirmación. Si sigues en la misma vista, abre Sala GIS o selecciona el botón de mapa en la tarjeta del reporte.',
        ],
      },
      {
        heading: 'Sugerencia',
        items: [
          'Pendiente de validación significa que falta revisar el reporte; Confirmada en terreno indica validación; Operativo enviado indica elevación; Desestimada indica que se descartó.',
          'Al enviar, espera la confirmación y el código. Un cambio visual de estado por sí solo no confirma que una actualización posterior se haya guardado.',
        ],
      },
    ],
  },
  {
    slug: 'evidencias',
    section: 'Operación',
    title: 'Evidencias y visor',
    summary: 'Revisa fotos, videos y adjuntos asociados a una denuncia.',
    imageUrl: '/manual/images/visor-evidencias.jpg',
    imageAlt: 'Visor de evidencias con la foto de un incendio forestal, el código de la denuncia, controles de zoom, giro, descarga y cierre.',
    imageCaption: 'Arriba se ven el archivo, el código de la denuncia y los controles; abajo, la posición del adjunto y los atajos de teclado.',
    sections: [
      {
        heading: 'Qué hace',
        items: [
          'Selecciona una foto o un video adjunto para abrir el visor.',
          'Usa los botones para ir al adjunto anterior o siguiente, acercar, alejar, girar y restablecer el tamaño.',
          'El botón de descarga abre o guarda el archivo original. Cierra con X o Escape.',
        ],
      },
      {
        heading: 'Recomendación',
        items: [
          'En el formulario, las acciones de muestra agregan medios demostrativos. Comprueba los adjuntos antes de enviar la denuncia y retira con el icono de papelera los que no correspondan.',
          'Una foto o video aporta contexto; no confirma por sí solo lo ocurrido.',
        ],
      },
    ],
  },
  {
    slug: 'radar-sar',
    section: 'Operación',
    title: 'Radar SAR',
    summary: 'Consulta escena Sentinel-1 y entiende la condición de análisis pendiente.',
    sections: [
      {
        heading: 'Qué permite',
        items: [
          'La vista muestra escenas Sentinel-1 disponibles, con satélite, fecha de adquisición, modo, polarización y órbita.',
          'Selecciona STAC para abrir la ficha de esa escena en el catálogo de origen.',
          'Cuando la pantalla dice que el Nivel 2 está pendiente, hay catálogo de escenas, pero todavía no perturbaciones medidas por este procesamiento.',
        ],
      },
      {
        heading: 'Importante',
        items: [
          'La falta de anomalías mostradas no demuestra que no exista actividad. Indica que esta pantalla no dispone de perturbaciones procesadas para mostrar.',
        ],
      },
    ],
  },
  {
    slug: 'telemetria',
    section: 'Operación',
    title: 'Telemetría hidrológica',
    summary: 'Revisa estaciones, niveles y series de tiempo para interpretar condiciones del cauce.',
    sections: [
      {
        heading: 'Qué permite',
        items: [
          'Selecciona una estación para consultar su río, nivel actual en msnm, fecha del boletín y estado.',
          'Variación diaria muestra el cambio en metros; Margen al desborde indica cuánto falta para la cota publicada. La barra compara el nivel con los extremos históricos.',
          'Usa la tabla Historial de lecturas para comparar fechas. Ver en Sala GIS localiza la estación en el mapa y Actualizar vuelve a consultar los datos disponibles.',
        ],
      },
      {
        heading: 'Cómo interpretarlo',
        items: [
          'Normal significa más de 2 m bajo la cota de desborde; A menos de 2 m del desborde indica un nivel elevado; Sobre la cota de desborde indica que alcanzó o superó esa referencia. Sin cota de referencia significa que no hay una cota publicada para comparar.',
          'Revisa la fecha del boletín para saber cuándo se publicó la lectura y usa Actualizar para volver a consultar los datos disponibles.',
          's/d significa que el valor no está disponible. Esta vista muestra nivel del río; no mide directamente mercurio ni calidad del agua.',
        ],
      },
    ],
    imageUrl: '/manual/images/telemetria.jpg',
    imageAlt: 'Estaciones hidrométricas, nivel, variación diaria, margen al desborde e historial de lecturas.',
    imageCaption: 'La fecha del boletín ayuda a interpretar si la lectura de cada estación es reciente.',
  },
  {
    slug: 'inteligencia-ia',
    section: 'Análisis',
    title: 'Inteligencia IA',
    summary: 'Analiza zonas, contexto y documentos con ayuda de un asistente de IA.',
    sections: [
      {
        heading: 'Qué permite',
        items: [
          'Elige una zona en la lista y solicita un análisis o una Analítica de la Zona más detallada.',
          'Si llegaste desde un elemento del mapa, revisa el contexto de ese elemento antes de generar el análisis.',
          'Lee el resultado y usa las opciones disponibles para copiar, descargar o volver a la ubicación en el mapa.',
        ],
      },
      {
        heading: 'Cómo usarlo',
        items: [
          'En el panel de conversación escribe una pregunta concreta sobre una zona, estación, foco o incidente y envíala.',
          'La IA interpreta el contexto y los datos disponibles; no realiza una verificación de campo. Contrasta sus respuestas con las fechas, fuentes y lecturas visibles.',
          'Si aparece un error o no llega respuesta, vuelve a intentarlo más tarde. El servicio puede estar temporalmente no disponible.',
        ],
      },
    ],
  },
  {
    slug: 'asistente-ia',
    section: 'Análisis',
    title: 'Asistente IA lateral',
    summary: 'Panel lateral con sugerencias, interacciones y manejo de errores.',
    sections: [
      {
        heading: 'Qué permite',
        items: [
          'Abre Asistente IA desde la barra superior. Las sugerencias temáticas rellenan el cuadro para que puedas empezar rápido.',
          'Escribe una pregunta en el cuadro inferior y pulsa enviar. Las respuestas aparecen en el hilo de conversación.',
          'El asistente recibe información resumida de la vista activa. Puede ayudar a explicar datos, pero sus respuestas se deben contrastar con las pantallas y fuentes.',
        ],
      },
      {
        heading: 'Qué revisar si falla',
        items: [
          'Si aparece un mensaje de error, comprueba la conexión y vuelve a enviar una pregunta concreta.',
          'Las conversaciones del panel pertenecen a esa sesión de la página; al recargar no se garantiza que sigan disponibles.',
        ],
      },
    ],
  },
  {
    slug: 'corpus-cientifico',
    section: 'Análisis',
    title: 'Corpus científico',
    summary: 'Consulta documentos, clasifica resultados y revisa colecciones científicas.',
    sections: [
      {
        heading: 'Qué permite',
        items: [
          'Busca por autor, cuenca, tipo de documento o clasificación con el campo de búsqueda.',
          'Abre un resultado para revisar su ficha y el documento disponible.',
          'Usa Ingresar Documento Científico para añadir un PDF, una URL o un DOI y revisar el resultado del procesamiento.',
        ],
      },
      {
        heading: 'Qué revisar',
        items: [
          'Comprueba título, autor, tipo de documento, clasificación y sitio de estudio antes de usar una lectura como contexto.',
          'Si el ingreso indica duplicado o rechazado, revisa el mensaje: no todos los documentos quedan incorporados.',
        ],
      },
    ],
    imageUrl: '/manual/images/corpus-cientifico.jpg',
    imageAlt: 'Corpus científico con búsqueda, listado de documentos y datos de clasificación.',
    imageCaption: 'La búsqueda permite localizar documentos por sus datos y clasificación visibles.',
  },
  {
    slug: 'incorporar-documentos',
    section: 'Análisis',
    title: 'Incorporar documentos',
    summary: 'Añade PDF, links o DOI, y revisa el resultado del procesamiento.',
    sections: [
      {
        heading: 'Flujo',
        items: [
          'Usa la acción de agregar documento desde la vista del corpus.',
          'Elige la fuente: PDF, URL o DOI, y revisa si el sistema identifica metadatos o duplicados.',
          'Confirma si el documento quedó integrado en la colección y si puede ser usado en el análisis.',
        ],
      },
      {
        heading: 'Advertencia',
        items: [
          'No todo documento que se ingrese se vuelve automáticamente evidencia operativa; revisa si el contenido y su contexto cumplen con el alcance del proyecto.',
        ],
      },
    ],
  },
  {
    slug: 'boletin-oficial',
    section: 'Análisis',
    title: 'Boletín oficial',
    summary: 'Genera un resumen de la situación con texto y descarga en Markdown.',
    sections: [
      {
        heading: 'Qué permite',
        items: [
          'Editar el título, el período descriptivo y el contenido que acompañará el boletín.',
          'Pulsa Compilar Boletín Oficial para generar un borrador con los datos disponibles en la vista.',
          'Lee el resultado y usa las opciones para copiar o descargar el archivo Markdown.',
        ],
      },
      {
        heading: 'Uso recomendado',
        items: [
          'Usa el boletín para cerrar un cuadro de situación y no como sustituto de la revisión técnica del mapa, la telemetría o los informes de la zona.',
        ],
      },
    ],
  },
  {
    slug: 'ingesta',
    section: 'Plataforma',
    title: 'Ingesta y RAG PostGIS',
    summary: 'Revisa la ingestación de datos, tareas programadas y la base documental de apoyo.',
    sections: [
      {
        heading: 'Qué permite',
        items: [
          'Usa Actualizar datos para volver a consultar el pipeline o Registrar minuta de campo para abrir ese formulario.',
          'Recorre las pestañas Tareas programadas, Conectores, APIs satelitales, Búsqueda en documentos, Feed reciente y Migraciones SQL. El catálogo Sentinel-2 aparece en su propia vista.',
          'En Tareas programadas, revisa el estado y el resultado más reciente. Si ejecutas una tarea manualmente, espera a que termine antes de volver a intentarlo.',
        ],
      },
      {
        heading: 'Regla de uso',
        items: [
          'La parte “Plataforma” es una vista técnica; se usa para diagnosticar flujo y no para declarar una detección final como si fuera una alerta operativa.',
        ],
      },
    ],
  },
  {
    slug: 'conectores-y-apis',
    section: 'Plataforma',
    title: 'Conectores y APIs',
    summary: 'Diagnostica fuentes satelitales y enlaces de datos externos.',
    sections: [
      {
        heading: 'Qué permite',
        items: [
          'Abrir el directorio de APIs, enlaces y diagnósticos de conexión.',
          'Revisar si la fuente de datos está disponible y si el acceso a la API está operativo.',
          'Verificar la configuración de una fuente antes de depender de ella en una tarea o en un informe.',
        ],
      },
      {
        heading: 'Sugerencia',
        items: [
          'Si una fuente no responde, revisa la conexión, la configuración y el calendario de actualización antes de repetir la tarea.',
        ],
      },
    ],
  },
  {
    slug: 'postgres-rpcs',
    section: 'Plataforma',
    title: 'Postgres RPCs',
    summary: 'Selecciona funciones, ejecuta JSON y revisa resultados de la capa de datos.',
    sections: [
      {
        heading: 'Qué permite',
        items: [
          'Elegir funciones de lectura o escritura con parámetros JSON.',
          'Ver el resultado de la ejecución y la respuesta del backend.',
          'Usar la consola como diagnóstico técnico para comprender qué está llegando y qué está devolviendo la base de datos.',
        ],
      },
      {
        heading: 'Norma de uso',
        items: [
          'No ejecutes funciones de escritura sin entender lo que se está registrando.',
          'Si la operación requiere datos sensibles o información personal, no la compartas ni la muestres en textos de ayuda.',
        ],
      },
    ],
  },
  {
    slug: 'fuentes-y-limitaciones',
    section: 'Primeros pasos',
    title: 'Fuentes y limitaciones',
    summary: 'Conoce el origen de los datos, el alcance del prototipo y qué no debe tomarse como evidencia operacional.',
    sections: [
      {
        heading: 'Qué distinguir',
        items: [
          'Datos de ejemplo, datos generados localmente y referencia cartográfica.',
          'Conectores reales o fuentes externas con distinta calidad y disponibilidad.',
          'Eventos de análisis o tareas pendientes que todavía no son evidencia concluyente.',
        ],
      },
      {
        heading: 'Regla práctica',
        items: [
          'Si una vista menciona un dato procedente de fuentes externas o de un proceso condicionado, la interpretación debe quedarse en el contexto de la aplicación y nunca reemplazar la validación del operador.',
        ],
      },
    ],
    note: 'Este prototipo académico ayuda a las decisiones de análisis y comprensión, pero no pretende sustituir la evidencia de campo ni las verificaciones de seguridad o legalidad.',
  },
];

const MANUAL_NAV_GROUPS = [
  {
    title: 'Primeros pasos',
    sections: [
      { title: 'Primeros pasos', articleSlugs: ['inicio', 'interfaz-y-apariencia', 'fuentes-y-limitaciones'] },
    ],
  },
  {
    title: 'Operación',
    sections: [
      { title: 'Sala GIS', articleSlugs: ['sala-gis', 'capas-y-focos'] },
      { title: 'Incidentes', articleSlugs: ['incidentes'] },
      { title: 'Veeduría comunitaria', articleSlugs: ['denuncias', 'evidencias'] },
      { title: 'Radar SAR', articleSlugs: ['radar-sar'] },
      { title: 'Telemetría hidrológica', articleSlugs: ['telemetria'] },
    ],
  },
  {
    title: 'Análisis',
    sections: [
      { title: 'Inteligencia IA', articleSlugs: ['inteligencia-ia', 'asistente-ia'] },
      { title: 'Corpus científico', articleSlugs: ['corpus-cientifico', 'incorporar-documentos'] },
      { title: 'Boletín oficial', articleSlugs: ['boletin-oficial'] },
    ],
  },
  {
    title: 'Plataforma',
    sections: [
      { title: 'Ingesta y RAG PostGIS', articleSlugs: ['ingesta', 'conectores-y-apis'] },
      { title: 'Postgres RPCs', articleSlugs: ['postgres-rpcs'] },
    ],
  },
];

function getCurrentSlugFromHash(): string {
  if (typeof window === 'undefined') return 'inicio';
  const hash = window.location.hash || '#/manual/inicio';
  const match = hash.match(/\/manual\/([^/?#]+)/);
  return match ? match[1] : 'inicio';
}

export default function ManualApp() {
  const [currentSlug, setCurrentSlug] = useState<string>(() => getCurrentSlugFromHash());
  const [query, setQuery] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const handleHashChange = () => setCurrentSlug(getCurrentSlugFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MANUAL_ARTICLES;
    return MANUAL_ARTICLES.filter((article) =>
      `${article.title} ${article.summary} ${article.section} ${article.note ?? ''} ${article.imageAlt ?? ''} ${article.imageCaption ?? ''} ${article.images?.map((image) => `${image.alt} ${image.caption}`).join(' ') ?? ''} ${article.sections
        .map((section) => section.items.join(' '))
        .join(' ')}`
        .toLowerCase()
        .includes(q)
    );
  }, [query]);

  const currentArticle =
    MANUAL_ARTICLES.find((article) => article.slug === currentSlug) ?? MANUAL_ARTICLES[0];
  const visibleArticle = filteredArticles.find((article) => article.slug === currentArticle.slug)
    ?? filteredArticles[0]
    ?? currentArticle;
  const currentIndex = MANUAL_ARTICLES.findIndex((article) => article.slug === visibleArticle.slug);
  const visibleIndex = filteredArticles.findIndex((article) => article.slug === visibleArticle.slug);
  const previousArticle = query.trim()
    ? filteredArticles[visibleIndex - 1] ?? null
    : currentIndex > 0 ? MANUAL_ARTICLES[currentIndex - 1] : null;
  const nextArticle = query.trim()
    ? filteredArticles[visibleIndex + 1] ?? null
    : currentIndex < MANUAL_ARTICLES.length - 1 ? MANUAL_ARTICLES[currentIndex + 1] : null;

  const navigateTo = (slug: string) => {
    window.location.hash = `/manual/${slug}`;
    setMobileNavOpen(false);
  };

  const manualBaseUrl = import.meta.env.BASE_URL || '/';
  const appUrl = `${window.location.origin}${manualBaseUrl}`;
  const openManualHref = `${appUrl}#/manual/inicio`;

  return (
    <div className="min-h-screen bg-canvas text-slate-200">
      <div className="flex min-h-screen">
        <aside id="manual-navigation" className={`${mobileNavOpen ? 'flex' : 'hidden'} w-full border-b border-line bg-surface/95 p-4 md:flex md:w-[280px] md:max-w-[280px] md:flex-col md:border-b-0 md:border-r md:bg-surface/80`}>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-500/20">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-base font-semibold text-white">Manual</p>
              <p className="text-[11px] text-slate-400">Centinela Orinoco</p>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-line bg-canvas/60 p-2">
            <button
              type="button"
              onClick={() => { window.location.href = appUrl; }}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-300 hover:bg-raised hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              <span className="inline-flex items-center gap-2">
                <House className="h-4 w-4" />
                Abrir aplicación
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
            </button>
          </div>

          <nav className="max-h-[45vh] space-y-5 overflow-y-auto pr-1 md:max-h-none md:flex-1" aria-label="Secciones del manual">
            {MANUAL_NAV_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                  {group.title}
                </p>
                <div className="space-y-3">
                  {group.sections.map((section) => {
                    const articles = section.articleSlugs
                      .map((slug) => MANUAL_ARTICLES.find((article) => article.slug === slug))
                      .filter((article): article is ManualArticle => Boolean(article));
                    const [mainArticle, ...relatedArticles] = articles;
                    if (!mainArticle) return null;

                    return (
                      <div key={section.title}>
                        <button
                          type="button"
                          onClick={() => navigateTo(mainArticle.slug)}
                          aria-current={articles.some((article) => article.slug === currentArticle.slug) ? 'page' : undefined}
                          className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${
                            articles.some((article) => article.slug === currentArticle.slug)
                              ? 'bg-sky-500/10 text-white ring-1 ring-inset ring-sky-500/20'
                              : 'text-slate-300 hover:bg-raised hover:text-white'
                          }`}
                        >
                          <span className="truncate">{section.title}</span>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                        </button>
                        {relatedArticles.length > 0 && (
                          <ul className="ml-3 mt-1 space-y-0.5 border-l border-line pl-2">
                            {relatedArticles.map((article) => (
                              <li key={article.slug}>
                                <button
                                  type="button"
                                  onClick={() => navigateTo(article.slug)}
                                  aria-current={article.slug === currentArticle.slug ? 'page' : undefined}
                                  className={`w-full truncate rounded-md px-2 py-1 text-left text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${
                                    article.slug === currentArticle.slug
                                      ? 'text-sky-300'
                                      : 'text-slate-500 hover:bg-raised hover:text-slate-200'
                                  }`}
                                >
                                  {article.title}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 border-b border-line bg-canvas/80 backdrop-blur-sm">
            <div className="flex flex-col gap-3 px-4 py-3 md:px-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-slate-400 md:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen((open) => !open)}
                    aria-expanded={mobileNavOpen}
                    aria-controls="manual-navigation"
                    className="inline-flex items-center gap-2 rounded-md border border-line px-2 py-1.5 text-xs text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Índice
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <BookOpen className="h-4 w-4" />
                  <span>Manual de usuario</span>
                </div>
                <a
                  href={openManualHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-slate-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                >
                  Abrir en pestaña
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full max-w-xl">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar en el manual…"
                    className="w-full rounded-lg border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/50 focus:outline focus:outline-2 focus:outline-sky-400"
                    aria-label="Buscar en el manual"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Sparkles className="h-3.5 w-3.5 text-sky-300" />
                  {query.trim() ? `${filteredArticles.length} resultado${filteredArticles.length === 1 ? '' : 's'}` : '18 artículos'}
                </div>
              </div>
              <a
                href={appUrl}
                className="inline-flex w-fit items-center gap-1 text-xs text-slate-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 md:hidden"
              >
                <House className="h-3.5 w-3.5" /> Volver a la aplicación
              </a>
            </div>
          </header>

          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
            <div className="mb-6 rounded-2xl border border-line bg-surface/70 p-4 shadow-2xl shadow-black/10">
              <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-sky-300">
                <BookOpen className="h-3.5 w-3.5" />
                {visibleArticle.section}
              </div>
              <h1 className="font-display text-3xl font-semibold text-white md:text-4xl">
                {visibleArticle.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{visibleArticle.summary}</p>
            </div>

            {filteredArticles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-8 text-center">
                <p className="text-lg font-medium text-white">No encontramos resultados para “{query}”.</p>
                <p className="mt-2 text-sm text-slate-400">Prueba con una palabra visible en la interfaz, como “incidente”, “telemetría”, “IA” o “corpus”.</p>
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="mt-4 rounded-md border border-line bg-canvas px-3 py-2 text-sm text-slate-200 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),260px]">
                <article className="space-y-6 rounded-2xl border border-line bg-surface/60 p-5 md:p-6">
                  {filteredArticles
                  .filter((article) => article.slug === visibleArticle.slug)
                    .map((article) => {
                      const articleImages = article.images ?? (article.imageUrl ? [{
                        url: article.imageUrl,
                        alt: article.imageAlt || article.title,
                        caption: article.imageCaption || '',
                      }] : []);
                      return (
                      <React.Fragment key={article.slug}>
                      {articleImages.map((image) => (
                        <figure key={image.url} className="overflow-hidden rounded-xl border border-line bg-canvas">
                          <img src={image.url} alt={image.alt} className="h-auto w-full object-cover" />
                          {image.caption && <figcaption className="border-t border-line px-3 py-2 text-xs leading-5 text-slate-400">{image.caption}</figcaption>}
                        </figure>
                      ))}
                      {article.sections.map((section) => (
                        <section key={section.heading} className="space-y-3">
                            <h2 className="font-display text-xl font-semibold text-white">{section.heading}</h2>
                            <ul className="space-y-2 text-sm leading-6 text-slate-300">
                              {section.items.map((item) => (
                                <li key={item} className="flex gap-2">
                                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </section>
                        ))}

                        {article.note && (
                          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-sm leading-6 text-sky-100">
                            <span className="font-semibold text-white">Nota:</span> {article.note}
                          </div>
                        )}
                      </React.Fragment>
                    );
                    })}
                </article>

                <aside className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-2xl border border-line bg-surface/60 p-4">
                    <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                      En este artículo
                    </p>
                    <ul className="space-y-2 text-sm text-slate-300">
                      {visibleArticle.sections.map((section) => (
                        <li key={section.heading} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                          {section.heading}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-line bg-surface/60 p-4">
                    <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                      Navegación
                    </p>
                    <div className="grid gap-2">
                      {previousArticle && (
                        <button
                          type="button"
                          onClick={() => navigateTo(previousArticle.slug)}
                          className="flex items-center justify-between gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-left text-sm text-slate-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                        >
                          <span className="inline-flex items-center gap-2">
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Anterior
                          </span>
                          <span className="truncate">{previousArticle.title}</span>
                        </button>
                      )}

                      {nextArticle && (
                        <button
                          type="button"
                          onClick={() => navigateTo(nextArticle.slug)}
                          className="flex items-center justify-between gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-left text-sm text-slate-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                        >
                          <span className="inline-flex items-center gap-2">
                            Siguiente
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                          <span className="truncate">{nextArticle.title}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </aside>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

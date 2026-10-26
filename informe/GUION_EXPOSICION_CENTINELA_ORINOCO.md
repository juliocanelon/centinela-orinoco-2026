# Guion de exposición: Centinela Orinoco

**Proyecto:** Arquitectura de datos inteligentes para la detección temprana y el monitoreo de la minería ilegal en el Arco Minero del Orinoco  
**Duración total:** 18 minutos, sin incluir preguntas  
**Participantes:** Julio Cesar Canelón Rangel, José Francisco Escalante Rosales y Miguel Damián Mota Garrido  
**Distribución:** 6 minutos por participante

## Secuencia general

| Tiempo | Participante | Contenido |
| --- | --- | --- |
| 00:00–06:00 | Julio Cesar Canelón Rangel | Presentación, problema, fuentes de datos, objetivo y aportes |
| 06:00–12:00 | José Francisco Escalante Rosales | Antecedentes y brecha, arquitectura, ingesta con datos reales |
| 12:00–18:00 | Miguel Damián Mota Garrido | Persistencia, memoria semántica, flujo dinámico, despliegue y conclusiones |

> Los tiempos suponen unas 100–110 palabras por minuto, con breves pausas para señalar las láminas. Los textos entre corchetes son indicaciones escénicas y no se leen en voz alta.

---

# 1. Julio Cesar Canelón Rangel

**Duración asignada: 6 minutos**  
**Láminas sugeridas:** portada, mapa del territorio, fuentes de datos, objetivo y aportes.

### 00:00–01:00 | Apertura

Buenos días. Somos Julio Cesar Canelón Rangel, José Francisco Escalante Rosales y Miguel Damián Mota Garrido, de la Maestría en Tecnologías de la Información de la UNEG. Presentamos Centinela Orinoco, una arquitectura de datos inteligente para apoyar la detección temprana y el monitoreo de la minería ilegal en el Arco Minero del Orinoco.

Es un prototipo: integra información y facilita su consulta, pero no confirma por sí solo que exista minería ilegal. Esa decisión sigue en manos de personas responsables.

*[Apoyo visual: portada.]*

### 01:00–02:45 | Territorio y problema

El Arco Minero del Orinoco se creó en 2016 mediante el Decreto 2.248, sobre 111.843 kilómetros cuadrados, cerca del 12 % del territorio nacional. Se superpone con las cuencas del Caroní, el Caura y el Cuyuní, con áreas protegidas y con territorios de pueblos indígenas. En Amazonas, la minería opera incluso dentro del Parque Nacional Yapacana.

La literatura muestra los efectos: deforestación que se extiende hasta 70 kilómetros más allá de las minas, mercurio acumulado en el bosque y sedimentos en los ríos que alimentan el embalse de Guri.

Pero el problema central que abordamos es informacional. Los datos existen: satélites, boletines hidrológicos, denuncias y estudios científicos. Sin embargo, se consultan por separado y con días de retraso. Un foco de calor aislado puede ser una quema agrícola; solo al cruzarlo con otras fuentes se convierte en evidencia. A eso lo llamamos asimetría de información.

*[Apoyo visual: mapa con los tres estados y el Arco Minero.]*

### 02:45–04:15 | Fuentes de datos

El prototipo ingiere cinco fuentes reales de forma automática. NASA FIRMS aporta focos térmicos cada tres horas. Copernicus aporta los catálogos de Sentinel-1, de radar, y de Sentinel-2 y Sentinel-3, ópticos. El INAMEH aporta el nivel del Orinoco desde sus boletines en PDF.

A eso se suman denuncias comunitarias con fotos y coordenadas, formularios de patrullaje y un corpus de estudios científicos.

Una precisión importante: de Sentinel guardamos el catálogo de escenas, no analizamos todavía sus píxeles. Y el INAMEH publica niveles de agua, no turbidez ni mercurio.

*[Apoyo visual: tabla de fuentes del artículo.]*

### 04:15–05:30 | Objetivo y aportes

El objetivo es diseñar y prototipar una arquitectura que integre esas señales y reportes para apoyar la revisión humana. El proyecto se inscribe en la iniciativa AmazonIA 4.0 y en la estrategia de reservas de biosfera de la UNESCO.

Los aportes son cinco: una arquitectura por capas que combina varias bases de datos manteniendo su consistencia; una memoria semántica que busca por significado y por ubicación a la vez; un filtro que rechaza documentos ajenos a la Amazonía venezolana; una estrategia de resiliencia y de protección de datos indígenas; y un prototipo funcionando en producción con datos reales.

### 05:30–06:00 | Transición

José presentará ahora en qué se apoya científicamente el proyecto y cómo está construida la arquitectura.

---

# 2. José Francisco Escalante Rosales

**Duración asignada: 6 minutos**  
**Láminas sugeridas:** antecedentes y brecha, diagrama de arquitectura, panel de ingesta.

### 06:00–08:15 | Antecedentes y brecha

Gracias, Julio. Partimos de las cinco referencias de la propuesta, que identificamos con sus autores, revistas y DOI: trabajan inteligencia artificial para ecosistemas regionales, resiliencia climática, decisiones sostenibles, Big Data y gemelos digitales.

Agregamos literatura específica. Sobre teledetección de minería en la Amazonía, Camalan y coautores usan Sentinel-2 y Pereira y coautores detectan dragas con el radar de Sentinel-1, que no depende de las nubes. Sobre impactos, Sonter, Gerson y García-Sánchez documentan deforestación y mercurio, este último en Venezuela. Para el contexto nacional usamos a Colmenares, sobre el Arco Minero, y a Rodríguez y Aguilar, sobre Canaima. En total, el artículo reúne 23 referencias en formato IEEE.

La comparación muestra el vacío: ningún antecedente cruza satélite, campo, comunidad y literatura científica; ninguno tiene memoria semántica con ubicación ni opera con conectividad intermitente. Y la literatura sobre la Amazonía venezolana es escasa, lo que refuerza la pertinencia del caso.

*[Apoyo visual: tabla comparativa de antecedentes.]*

### 08:15–09:45 | Arquitectura

La arquitectura tiene cuatro capas. La ingesta recibe las fuentes. El almacenamiento combina PostgreSQL con extensiones espaciales y vectoriales, MongoDB para las evidencias y un almacén de archivos. La inteligencia reúne la memoria semántica, el filtro territorial y los modelos de lenguaje. Y el consumo es la aplicación web, con mapa, incidentes, boletines y chat. La gobernanza de datos atraviesa todas las capas.

En el diagrama, los bloques con borde continuo ya funcionan; los de borde discontinuo, como Kafka, el Lakehouse o los nodos de campo, son el diseño objetivo.

*[Apoyo visual: Fig. 1 del artículo.]*

### 09:45–11:30 | Ingesta con datos reales

Un planificador consulta cada fuente con su propia cadencia e inserta solo los registros nuevos. Si una ejecución falla, la siguiente recupera lo que faltó sin duplicar.

Esto funciona en producción. Al 25 de octubre de 2026 el sistema había almacenado 2.890 focos de calor, 52 escenas de radar, 139 productos de Sentinel-2, 105 de Sentinel-3 y 8 lecturas del INAMEH. En una sola ejecución de FIRMS llegaron 1.493 focos: 1.412 ya estaban registrados y solo se insertaron los 81 nuevos.

En el mapa, los focos se agrupan en hexágonos de 25 kilómetros. Un foco recibe prioridad alta si se repite en el mismo punto en días distintos, lo que es más propio de una mina que de una quema, o si está dentro de una zona minera o cerca de ella.

*[Apoyo visual: Sala GIS y panel de ingesta.]*

### 11:30–12:00 | Transición

Miguel explicará cómo se guardan y consultan estos datos, y hacia dónde evoluciona la solución.

---

# 3. Miguel Damián Mota Garrido

**Duración asignada: 6 minutos**  
**Láminas sugeridas:** memoria semántica, reglas de alerta, arquitectura en AWS, conclusiones.

### 12:00–13:00 | Persistencia de denuncias e incidentes

Gracias, José. Cuando una denuncia confirmada en terreno se eleva a incidente, el sistema escribe en dos bases: PostgreSQL y MongoDB. Para que no quede a medias, usamos el patrón saga: si falla MongoDB, una acción compensatoria cancela el incidente y devuelve la denuncia a su estado anterior. Una clave de idempotencia evita duplicados si alguien reintenta. Y las denuncias son anónimas por defecto: la base de datos impide guardar el nombre del denunciante.

### 13:00–14:45 | Memoria semántica

Este es el núcleo inteligente. Cada documento, sea un foco de calor, una lectura del río o un estudio científico, se convierte con Gemini en un vector de 768 números que representa su significado, y se guarda con pgvector junto a su ubicación. Al consultar, la pregunta también se vectoriza, y una sola consulta busca los documentos más parecidos dentro de un radio geográfico. Luego se reordenan según similitud, cercanía, antigüedad, revisión por pares y severidad.

Un ejemplo real: "crecida del Orinoco" encuentra las lecturas del INAMEH aunque ninguna contiene la palabra "crecida". Los 1.216 documentos de la memoria están vectorizados.

El umbral de similitud se fijó en 0,65 con un criterio de precisión: mostrar un documento irrelevante es más costoso que omitir uno, y si nada alcanza el umbral, el sistema busca por palabras. Proponemos calibrarlo con consultas que especialistas marquen como pertinentes o no.

*[Apoyo visual: búsqueda en documentos y panel del corpus.]*

### 14:45–15:45 | Flujo dinámico y resiliencia

El flujo automático ya opera: el planificador ingiere, reintenta y dispara la vectorización de lo nuevo, y la inteligencia artificial decide qué documentos son pertinentes y qué modelo usar según la cuota.

En el diseño, las alertas exigen que coincidan dos sensores. La regla central pide un foco térmico de confianza alta y, a menos de dos kilómetros, una caída en la señal del radar, en un área protegida o cerca de un territorio indígena. Estas reglas requieren analizar los píxeles y se ejecutarían en Apache Airflow. Para los puestos de Guardería sin conexión, el diseño propone nodos de campo con almacenamiento local que reenvían por MQTT cuando hay enlace.

### 15:45–16:45 | Despliegue

Hoy la aplicación corre en Google Cloud Run, Supabase y MongoDB Atlas. Para una operación institucional proponemos una arquitectura en AWS: la API en contenedores, los conectores como funciones programadas y Aurora PostgreSQL, que mantiene juntas la búsqueda espacial y la vectorial. El primer paso es contenedorizar la API.

*[Apoyo visual: tabla de correspondencia con AWS.]*

### 16:45–18:00 | Conclusiones y cierre

En síntesis, Centinela Orinoco integra hoy cinco fuentes reales, denuncias anónimas y un corpus científico en una memoria semántica con ubicación, con datos consistentes y respuestas de respaldo cuando falla la red, la base de datos o la inteligencia artificial.

Los siguientes pasos son analizar los píxeles satelitales para activar las reglas de alerta, calibrar la búsqueda, ampliar las pruebas automatizadas y validar el sistema en campo con la Guardería Ambiental y las comunidades.

La plataforma no reemplaza la verificación humana: la hace más rápida y mejor informada. Muchas gracias. Quedamos atentos a sus preguntas.

---

## Recomendaciones para el ensayo

- Usar de 8 a 10 láminas y no leer las tablas completas: señalarlas y resumirlas.
- Ensayar con cronómetro. Si alguien supera los 6 minutos, recortar ejemplos en lugar de acelerar la lectura.
- Tener a mano el artículo IEEE con sus 23 referencias por si preguntan por una fuente.
- Preguntas probables: por qué se eligió el umbral 0,65 (sección V-B del artículo), qué parte de la arquitectura está implementada (Tabla V, estado de los componentes) y cómo se protege a los denunciantes.

# Guion de exposición: Centinela Orinoco

**Proyecto:** Arquitectura de datos inteligentes para la detección temprana y el monitoreo de la minería ilegal en el Arco Minero del Orinoco  
**Duración total:** 36 minutos, sin incluir preguntas  
**Participantes:** Julio Cesar Canelón Rangel, José Francisco Escalante Rosales y Miguel Damián Mota Garrido  
**Distribución:** 12 minutos por participante

## Secuencia general

| Tiempo | Participante | Contenido |
| --- | --- | --- |
| 00:00–12:00 | Julio Cesar Canelón Rangel | Presentación, diagnóstico territorial, problema, datos y objetivos |
| 12:00–24:00 | José Francisco Escalante Rosales | Sustento científico, brecha metodológica, arquitectura e ingesta |
| 24:00–36:00 | Miguel Damián Mota Garrido | Persistencia, análisis e IA, arquitectura objetivo, gobernanza y conclusiones |

> Los tiempos son una guía para una exposición pausada, cercana a 100–110 palabras por minuto, con breves pausas para señalar las láminas. Los textos entre corchetes son indicaciones escénicas y no se leen en voz alta.

---

# 1. Julio Cesar Canelón Rangel

**Duración asignada: 12 minutos**  
**Láminas sugeridas:** portada, mapa del territorio, problema y fuentes de datos, objetivo y aporte.

### 00:00–01:30 | Apertura y presentación

Buenos días. Somos Julio Cesar Canelón Rangel, José Francisco Escalante Rosales y Miguel Damián Mota Garrido, estudiantes de la Maestría en Tecnologías de la Información de la Universidad Nacional Experimental de Guayana. En esta exposición presentamos Centinela Orinoco, un proyecto de arquitectura de datos inteligente orientado a apoyar la detección temprana y el monitoreo de la minería ilegal en el Arco Minero del Orinoco.

La exposición se organiza en tres partes. En primer lugar, se explicarán el problema territorial, las fuentes de información consideradas y los objetivos del proyecto. Luego se revisarán el sustento científico, la brecha que se busca atender y la arquitectura del prototipo. Finalmente, se presentarán las limitaciones, las líneas de evolución y las conclusiones.

Es importante precisar desde el inicio el alcance del trabajo. Centinela Orinoco se encuentra en fase de prototipo. Su propósito es integrar información y facilitar su consulta; no constituye todavía un sistema de vigilancia operacional ni una herramienta capaz de confirmar por sí sola la existencia de minería ilegal.

*[Apoyo visual: mostrar la portada y señalar en el mapa la cuenca del Orinoco.]*

### 01:30–03:30 | Contextualización territorial

El área de interés se relaciona con la Amazonía venezolana y la cuenca del Orinoco, particularmente con Amazonas, Bolívar y Delta Amacuro. En esta región convergen territorios de gran relevancia ambiental, asentamientos humanos, áreas protegidas y actividades económicas que ejercen diferentes presiones sobre los ecosistemas.

En el caso de Bolívar, el proyecto presta atención al Arco Minero del Orinoco y a los posibles efectos de las actividades mineras sobre la cobertura vegetal, los cursos de agua y los sedimentos. En Amazonas, el aislamiento geográfico y la conectividad limitada plantean dificultades para reunir observaciones oportunas. Delta Amacuro aporta otra dimensión territorial, asociada a la conexión hidrológica y a la vulnerabilidad de sus ecosistemas y comunidades.

El informe no plantea que todos estos efectos puedan medirse actualmente desde la plataforma. Más bien, los presenta como parte del contexto que justifica una arquitectura capaz de relacionar fuentes distintas, registrar su procedencia y apoyar la evaluación por especialistas. Esta precisión evita confundir la importancia del problema ambiental con las capacidades ya demostradas por el prototipo.

*[Apoyo visual: ubicar los tres estados y el Arco Minero en el mapa, sin atribuir cifras no documentadas.]*

### 03:30–05:30 | Planteamiento del problema

El problema abordado tiene una dimensión ambiental y otra informacional. La primera se refiere a las posibles consecuencias de la minería no regulada: pérdida de cobertura vegetal, alteración de ríos y sedimentos, riesgo de contaminación por metales y exposición de comunidades o áreas protegidas. La segunda se refiere a la fragmentación de la información necesaria para estudiar esas situaciones.

Las imágenes y catálogos satelitales, los boletines hidrológicos, las publicaciones científicas y los reportes comunitarios presentan formatos, frecuencias y niveles de detalle diferentes. Si cada fuente se consulta de manera aislada, resulta más difícil contextualizar una señal, conocer su fecha y procedencia, o contrastarla con observaciones de otras fuentes.

Una anomalía térmica, por ejemplo, puede tener causas distintas. Un registro de un satélite no demuestra por sí mismo que exista actividad minera. Del mismo modo, una escena incluida en un catálogo satelital informa que existe un producto disponible, pero no constituye un análisis de sus píxeles ni una detección de cambio sobre el terreno.

Por ello, el problema específico del proyecto no consiste en prometer una clasificación automática definitiva. Consiste en diseñar una plataforma que reúna señales y reportes, preserve su contexto y facilite una revisión humana más informada.


### 05:30–07:45 | Fuentes de información y alcance

El prototipo considera varias fuentes. La primera es NASA FIRMS, que proporciona focos térmicos provenientes de sensores VIIRS y MODIS. La integración consulta registros, los normaliza y los filtra de acuerdo con el ámbito territorial definido. La disponibilidad de este proceso depende de credenciales y conectividad.

La segunda fuente corresponde a los catálogos de Copernicus. Para Sentinel-1, Sentinel-2 y Sentinel-3 se consultan metadatos de productos y escenas. La solución actual no descarga ni procesa las bandas para calcular retrodispersión, coherencia o anomalías ópticas. En consecuencia, el informe distingue entre disponibilidad de metadatos e interpretación científica de imágenes.

La tercera fuente son los boletines del INAMEH. El sistema procesa documentos publicados para obtener niveles de agua, fechas, variaciones y estados de alerta cuando existe una cota de referencia. No se trata de sensores conectados en tiempo real, y estos boletines no aportan mediciones de pH, turbidez, conductividad o mercurio para esta integración.

También se contemplan denuncias comunitarias con ubicación y evidencias, formularios de campo y documentos científicos en PDF, texto o con DOI. La presencia de estos medios en la arquitectura no significa que todos estén conectados a actores externos en operación. Cada fuente requiere validación de actualidad, calidad, procedencia y condiciones de acceso.

La heterogeneidad también afecta el modo de interpretar los registros. Una coordenada puede representar un punto de detección, el centro de una escena o la ubicación reportada por una persona; esas geometrías no tienen el mismo significado. Del mismo modo, una fecha de adquisición satelital no es necesariamente la fecha en que el dato quedó disponible para el análisis. Por eso, la arquitectura considera metadatos de fuente y tiempo como parte del contexto necesario para comparar observaciones.

*[Apoyo visual: mostrar la tabla de fuentes y destacar qué se ingiere y qué permanece pendiente.]*

### 07:45–09:45 | Objetivo y objetivos específicos

El objetivo general consiste en diseñar y prototipar una arquitectura de datos inteligente que apoye la integración y el análisis contextual de señales ambientales y reportes comunitarios relacionados con la minería ilegal en el Arco Minero del Orinoco.

Para avanzar hacia ese objetivo se plantearon cinco objetivos específicos. Primero, integrar en una interfaz geoespacial capas de alertas, estaciones, áreas protegidas, incidentes y denuncias. Segundo, implementar conectores para fuentes satelitales, boletines hidrológicos y documentos científicos, procurando conservar la procedencia de los registros. Tercero, definir persistencia híbrida para denuncias, incidentes y evidencias asociadas.

El cuarto objetivo es explorar análisis asistido por modelos de inteligencia artificial y síntesis contextual para apoyar la revisión humana. El quinto es identificar las brechas científicas, técnicas y de gobernanza que deben atenderse antes de evolucionar hacia una solución que pueda validarse en campo.

Estos objetivos combinan el desarrollo de un prototipo con una evaluación de sus límites. El alcance no incluye afirmar que se ha construido un modelo predictivo validado ni que el sistema determina automáticamente la legalidad de una actividad.


### 09:45–11:15 | Justificación y aporte

La justificación se vincula con el enfoque de AmazonIA 4.0, que propone combinar tecnologías de datos e inteligencia artificial con necesidades de sostenibilidad y conocimiento territorial. En ese marco, la contribución del proyecto es integrar fuentes heterogéneas en una vista geoespacial y explorar cómo la información ambiental y comunitaria puede presentarse de forma contextualizada.

Un aporte técnico concreto es el flujo para promover una denuncia que ha sido confirmada en terreno a un incidente. Ese proceso contempla control de idempotencia, persistencia relacional y almacenamiento documental de evidencias. La idempotencia permite que un reintento de la misma operación no genere incidentes duplicados; la persistencia separa los datos estructurados de los documentos asociados.

La contribución debe describirse con cautela. El proyecto no presenta una técnica nueva de teledetección, no demuestra precisión de detección de minería y no dispone de una evaluación de aceptación comunitaria. Su valor reside en la arquitectura inicial y en los mecanismos de integración que podrán someterse a pruebas futuras.

### 11:15–12:00 | Cierre y transición

En síntesis, la región presenta un problema ambiental complejo y una necesidad de integrar información que hoy está distribuida en fuentes diferentes. Centinela Orinoco ofrece una primera plataforma de consulta, pero distingue expresamente los registros reales, los metadatos de catálogo y las capacidades que aún deben desarrollarse.

A continuación, José Francisco presentará el sustento científico disponible, la brecha metodológica y la forma en que se organiza la arquitectura de ingesta y análisis.

---

# 2. José Francisco Escalante Rosales

**Duración asignada: 12 minutos**  
**Láminas sugeridas:** antecedentes, brecha científica, diagrama arquitectónico, flujo de ingesta.

### 12:00–13:15 | Continuidad y propósito de esta sección

Gracias, Julio. En esta segunda parte se abordarán tres preguntas: qué antecedentes se consideran pertinentes, cuál es la brecha metodológica que orienta el proyecto y cómo se relacionan las fuentes con los componentes de ingesta, procesamiento y consumo.

La arquitectura se analiza a partir de las capacidades del prototipo y de los requerimientos establecidos para el proyecto integrador. Por eso, en el diagrama distinguimos los flujos que ya están contemplados de las funciones propuestas como evolución. La presencia de una tecnología en la arquitectura objetivo no significa que esté desplegada ni que se haya probado en condiciones de campo.

### 13:15–15:15 | Líneas del estado del arte

La propuesta académica reúne cinco líneas que ayudan a ordenar la revisión: inteligencia artificial aplicada al monitoreo de ecosistemas; tecnologías inteligentes para resiliencia climática; sistemas de soporte a decisiones de sostenibilidad; analítica de Big Data; y gemelos digitales con sincronización de observaciones de campo.

Estas líneas son pertinentes porque el proyecto no se limita a mostrar un mapa. Su intención es relacionar datos de diversa naturaleza, desde registros geoespaciales hasta documentos y reportes narrativos, y hacerlos útiles para el análisis territorial. La literatura sobre analítica de datos puede orientar la gestión de variedad y calidad; los estudios de teledetección pueden fundamentar el uso de datos satelitales; y los trabajos sobre resiliencia y sistemas de soporte a decisiones pueden aportar criterios para interpretar resultados en contextos con conectividad limitada.

Sin embargo, una línea temática no sustituye una revisión bibliográfica. Para establecer el estado del arte es necesario identificar qué métodos emplearon otros estudios, qué datos utilizaron, qué resultados obtuvieron y cuáles fueron sus limitaciones. Esa comparación permite justificar la innovación y evita presentar como novedoso un componente que ya haya sido abordado de forma equivalente.

### 15:15–17:30 | Calidad y suficiencia de los antecedentes

La propuesta incluye cinco referencias declaradas mediante títulos y plataformas. En el documento de evaluación se señala que varias no incluyen autores, revista específica, volumen, páginas o DOI. Además, mencionar MDPI, ScienceDirect o ResearchGate no basta para demostrar que un trabajo particular se publicó en una revista arbitrada o se encuentra indexado en una base académica.

Las directrices científicas del proyecto y la estructura del informe final establecen un mínimo de diez fuentes indexadas o de nivel equivalente. Por esa razón, las cinco entradas disponibles no satisfacen el requisito. Esta conclusión no equivale a afirmar que los títulos sean necesariamente inexistentes; indica que, con los metadatos aportados, no es posible comprobar su identidad bibliográfica, arbitraje ni indexación.

La tarea pendiente consiste en verificar cada referencia en fuentes editoriales o académicas, completar sus citas APA y analizar al menos diez artículos. Para cada artículo se deben registrar autoría, año, revista, DOI o URL editorial, método, datos, resultados y limitaciones. También conviene incluir estudios directamente relacionados con minería en la Amazonía, observación satelital, monitoreo hidrológico y arquitecturas inteligentes.

El análisis no debería limitarse a resumir cada publicación por separado. Conviene compararlas mediante preguntas comunes: qué variable ambiental observaron, qué resolución espacial y temporal utilizaron, cómo validaron sus resultados, qué errores reconocieron y qué condiciones de conectividad o gobernanza asumieron. Esa matriz comparativa ayudaría a justificar la selección de tecnologías y a identificar con mayor precisión el vacío que el prototipo pretende abordar. También permitiría distinguir entre la pertinencia general de la inteligencia artificial y la evidencia concreta de que una técnica funciona para el territorio y el problema considerados.

Es importante reconocer esta brecha durante la exposición. La rigurosidad académica se fortalece cuando se distingue lo que está sustentado de aquello que todavía debe comprobarse, en lugar de completar una bibliografía con información no verificada.

### 17:30–19:15 | Brecha metodológica y contribución

La brecha que el proyecto busca atender es la falta de una vista integrada para consultar anomalías ambientales junto con reportes comunitarios, registros hidrológicos y documentos científicos. La propuesta plantea relacionar información geoespacial y narrativa y ofrecer una síntesis contextual que facilite la revisión.

La solución actual cubre solo una parte de esa brecha. Las fuentes llegan a través de conectores distintos y pueden consultarse en una interfaz común, pero todavía no existe un sistema completo de procesamiento distribuido ni un modelo de detección validado. La contribución es, por tanto, arquitectónica e integradora: muestra cómo se pueden organizar ciertos flujos y cómo registrar denuncias e incidentes sin perder el vínculo con sus evidencias.

Esta distinción define la originalidad que puede sostenerse hoy. No se afirma que la plataforma descubra automáticamente actividades ilícitas. Se propone una infraestructura de apoyo a investigación que podría evolucionar mediante validación científica, incorporación de datos de campo y pruebas con usuarios responsables.

### 19:15–21:15 | Lectura del diagrama de arquitectura

*[Apoyo visual: mostrar el diagrama de arquitectura incluido en el informe. Recorrer los componentes de izquierda a derecha o de arriba hacia abajo.]*

En el diagrama se observa primero la capa de canales y fuentes. Allí se sitúan los usuarios y equipos que revisan la información, las denuncias comunitarias, los productos y catálogos satelitales, los boletines del INAMEH y el corpus científico. Cada fuente tiene una naturaleza y una frecuencia de actualización diferente.

En la capa de consumo se ubica la aplicación web cartográfica. Esta reúne el mapa, los módulos de consulta de telemetría, denuncias, incidentes, corpus y análisis asistido. La interfaz es el punto común de interacción, pero no sustituye la validación de los datos que presenta.

La capa de API y lógica recibe solicitudes y coordina operaciones. La ingesta automatizada consulta las fuentes; la lógica de denuncias controla estados y promueve reportes confirmados; el procesamiento del corpus extrae texto y metadatos; y la analítica contextual combina los registros con una síntesis generada por un modelo cuando está disponible.

Finalmente, la arquitectura incluye persistencia relacional y espacial, almacenamiento de evidencias y una base documental. El diagrama permite distinguir los servicios externos opcionales de la lógica que se ejecuta en el prototipo. También hace visible qué componentes dependen de credenciales, conectividad y configuración de infraestructura.

### 21:15–23:15 | Ingesta y procesamiento actual

El planificador organiza consultas periódicas a FIRMS, Sentinel-1, Sentinel-2, Sentinel-3 y los boletines hidrológicos. Cuando una fuente responde, el sistema normaliza sus registros y aplica reglas para evitar duplicados. Además, se conservan datos de ejecución como estado, cantidad de registros recibidos o insertados y mensajes de error.

En FIRMS se consultan productos VIIRS y MODIS y se filtran los focos según el ámbito territorial definido. En Copernicus se recuperan metadatos STAC u OData de escenas y productos. En la integración hidrológica se procesan boletines PDF publicados por el INAMEH para obtener niveles, fechas y variaciones. Estos procesos aportan información verificable desde las fuentes consultadas, sujetos a su disponibilidad.

Pero es fundamental diferenciar ingesta de interpretación. Las escenas Sentinel no se descargan ni se procesan como imágenes para detectar cambios de cobertura. Los focos térmicos no se clasifican automáticamente como minería. Las lecturas hidrológicas no equivalen a una red de sensores en tiempo real. En todos los casos, el sistema requiere controles de calidad, verificación de fecha y análisis humano.

### 23:15–24:00 | Transición

En esta parte se ha explicado que la arquitectura integra datos y procesos, pero que su alcance científico depende de la verificación bibliográfica y de la validación de cada fuente. Miguel Damián desarrollará ahora la persistencia de denuncias, la búsqueda documental, las limitaciones de inteligencia artificial y las recomendaciones para evolucionar el prototipo.

---

# 3. Miguel Damián Mota Garrido

**Duración asignada: 12 minutos**  
**Láminas sugeridas:** capas de persistencia, RAG y analítica, brechas técnicas, usuarios, conclusiones.

### 24:00–25:45 | Persistencia y gestión de evidencias

Gracias, José. Para completar la arquitectura, esta sección se concentra en cómo se organizan los datos, cómo se utilizan para la consulta y qué condiciones serían necesarias para llevar la solución a un escenario de prueba en campo.

La persistencia actual combina una base relacional y espacial con una base documental. Supabase utiliza PostgreSQL y PostGIS para almacenar información estructurada, coordenadas, estados de denuncias, incidentes y operaciones de integración. Supabase Storage conserva los archivos de evidencia. MongoDB almacena documentos con metadatos y referencias vinculadas a los incidentes.

La promoción de una denuncia a incidente es el flujo transaccional más concreto. Antes de promoverla, la denuncia debe encontrarse confirmada en terreno. Se utiliza una clave de idempotencia para reconocer reintentos de una misma operación. PostgreSQL conserva el estado relacional y MongoDB el documento de evidencia; si una parte de la operación falla, se contempla una compensación para mantener la consistencia y la trazabilidad.

Este diseño es híbrido, pero no debe confundirse con un Lakehouse. No existe aún una organización de datos crudos, validados y analíticos a gran escala, ni una estrategia general con almacenamiento de objetos y formatos tabulares de Lakehouse. La persistencia actual resuelve necesidades específicas del prototipo.

### 25:45–27:45 | Recuperación documental e inteligencia artificial

El sistema también incorpora un flujo de recuperación aumentada por generación, conocido como RAG. Cada documento se convierte en un vector de 768 dimensiones con el modelo de embeddings de Gemini y se guarda en PostgreSQL con la extensión pgvector. Al consultar, la pregunta también se vectoriza y la base busca los documentos más parecidos por significado; si se indica una ubicación, la misma consulta limita la búsqueda a un radio con PostGIS. Luego los resultados se reordenan según similitud, cercanía, antigüedad, si la fuente es arbitrada y severidad.

Después, Gemini puede redactar una síntesis a partir de los documentos recuperados. Si no es posible vectorizar la consulta, la búsqueda vuelve a la coincidencia de palabras con distancia geográfica, y si el modelo de síntesis no está disponible, se presentan los documentos sin resumen. Un ejemplo con datos reales: la consulta "crecida del Orinoco" recupera las lecturas del INAMEH aunque ninguna contiene la palabra "crecida"; esa es la diferencia con una búsqueda por palabras.

Hay que señalar sus límites. El umbral de similitud, fijado en 0,65, y los pesos del reordenamiento son valores iniciales que aún no se calibran con consultas y documentos etiquetados; de hecho, una consulta sobre incendios cerca del río Atabapo no superó el umbral y se resolvió por palabras. Además, la cuota gratuita de Gemini permite vectorizar 1.000 textos por día: la primera carga de 1.216 documentos se reparte en dos días, sin detener la ingesta, porque la vectorización se ejecuta aparte y retoma lo pendiente.

También debe limitarse el papel de la inteligencia artificial. Gemini puede organizar y resumir evidencias, pero no verifica de manera independiente la verdad de los datos, no confirma minería ilegal y no debe activar operativos. Cualquier interpretación que pueda afectar personas o territorios requiere corroboración de fuentes y revisión humana.

### 27:45–29:30 | Analítica y criterios de seguridad

La analítica por zona combina registros disponibles con reglas deterministas y puede solicitar una síntesis a un modelo de lenguaje. Algunas clasificaciones de zonas se apoyan en listas de nombres y palabras clave; por ello no representan una evaluación jurídica exhaustiva ni un modelo predictivo validado.

El informe establece tres precauciones. Primero, un foco térmico puede corresponder a quema agrícola, incendio u otra causa y no confirma actividad minera. Segundo, la presencia de una escena satelital en un catálogo no demuestra que se haya detectado una perturbación. Tercero, no se deben inferir valores de contaminantes que no hayan sido medidos o publicados.

La decisión sobre una alerta debe permanecer en manos de personas responsables. La plataforma puede proporcionar indicios, ubicación, procedencia y contexto para orientar una revisión; no puede sustituir inspecciones, mediciones de campo ni protocolos institucionales. Esta condición debe reflejarse en el diseño de la interfaz, en los mensajes de salida y en las reglas de acceso.

### 29:30–31:45 | Evolución de la arquitectura

El informe plantea varias líneas de evolución. La primera es fortalecer la procedencia y la calidad: cada registro debería conservar fuente, hora de adquisición, versión, licencia, transformaciones aplicadas y una valoración de calidad. Además, se deben separar claramente observaciones reales, capas de referencia y contenidos demostrativos.

La segunda es procesar productos satelitales. Para detectar cambios es necesario descargar imágenes, definir algoritmos reproducibles, seleccionar ventanas temporales y comparar resultados con referencias de campo. Solo después de medir precisión y falsos positivos sería razonable presentar perturbaciones como detecciones.

La tercera es construir una arquitectura analítica escalable con Lakehouse y una herramienta de orquestación, como Apache Airflow o una alternativa equivalente. Kafka o NiFi podrían incorporarse si el volumen y los requisitos de tiempo real lo justifican. El procesamiento distribuido con Spark también debe vincularse con necesidades concretas, no agregarse solo por cumplir una lista tecnológica.

La cuarta línea es completar el enfoque offline-first. Para una región con conectividad irregular se requiere almacenamiento local durable, sincronización diferida, reintentos, manejo de conflictos y protección de los datos en el dispositivo. MQTT o LoRaWAN pueden evaluarse en función de los sensores disponibles, su cobertura y el consumo energético.

*[Apoyo visual: señalar las brechas como evolución y no como servicios presentes.]*

### 31:45–33:30 | Gobernanza, despliegue y usuarios

La protección de datos resulta especialmente importante para reportes comunitarios. El sistema contempla controles en la base de datos y una regla básica para proteger la identidad cuando una denuncia es anónima. No obstante, aún se requiere un esquema integral de acceso por roles, consentimiento, retención, anonimización espacial y protección del conocimiento biocultural.

En el despliegue, la solución se plantea actualmente como una aplicación web apoyada en servicios externos. No se presenta una arquitectura de alta disponibilidad basada en contenedores. Una fase futura deberá definir cómo empaquetar los componentes, administrar credenciales, monitorear los servicios, respaldar la información y recuperar la operación ante fallos.

Los usuarios previstos incluyen analistas ambientales, investigadores, equipos de monitoreo y personas que reciben o verifican reportes. La interfaz puede facilitar la consulta conjunta de datos, pero el informe no presenta todavía pruebas de usabilidad con estos grupos ni un piloto de campo. Por ello, los beneficios descritos son resultados esperados, no resultados medidos.

### 33:30–35:15 | Conclusiones y recomendaciones

Como conclusiones principales, Centinela Orinoco integra conectores para consultar NASA FIRMS, catálogos Copernicus y boletines del INAMEH, pero el funcionamiento continuo depende de credenciales y servicios externos. Sentinel aporta actualmente metadatos de productos, no análisis de imágenes. La fuente hidrológica aporta niveles de boletines, no mediciones de calidad de agua ni telemetría directa.

La persistencia de denuncias e incidentes es el flujo más desarrollado y contempla idempotencia, evidencias y compensación entre bases de datos. La recuperación documental es vectorial y geográfica, con respaldo textual, aunque sus umbrales aún deben calibrarse; la síntesis de Gemini puede asistir el análisis, pero no sustituye validación ni revisión humana.

Las recomendaciones prioritarias son configurar y probar las fuentes en un entorno controlado; completar el procesamiento de imágenes; calibrar y evaluar la búsqueda vectorial con consultas etiquetadas; verificar al menos diez artículos indexados con referencias APA; y ampliar las pruebas automatizadas, hoy limitadas a la memoria semántica, junto con RBAC, privacidad, almacenamiento offline y despliegue reproducible.

En consecuencia, la factibilidad a mediano plazo es razonable como herramienta de apoyo a la investigación, siempre que se atiendan estas brechas antes de cualquier piloto con instituciones o comunidades.

### 35:15–36:00 | Cierre

Para cerrar, Centinela Orinoco propone una forma de integrar información territorial y ambiental que suele encontrarse dispersa. El prototipo ya permite observar cómo podrían relacionarse algunas fuentes y procesos, y ya cuenta con búsqueda semántica sobre su memoria documental; la detección de minería, la operación offline y la evaluación de impacto permanecen como trabajo futuro.

El valor académico del proyecto está tanto en la arquitectura propuesta como en la delimitación honesta de sus capacidades. La siguiente etapa debe basarse en literatura verificable, datos de calidad, protocolos de privacidad y validación con usuarios. Muchas gracias. Quedamos atentos a sus preguntas.

---

## Recomendaciones para el ensayo

- Usar una presentación de 8 a 10 láminas y evitar leer las tablas completas; resumirlas oralmente.
- Mantener a la vista el diagrama de arquitectura durante la intervención de José y volver a él al explicar las brechas.
- Ensayar con cronómetro. Si una intervención supera los 12 minutos, reducir ejemplos y no acelerar la lectura.
- Dejar las preguntas para después de los 36 minutos o acordar previamente si se descontarán del tiempo de exposición.
- Verificar los nombres de los productos y las referencias antes de la presentación. No afirmar que las cinco referencias académicas están indexadas mientras esa verificación siga pendiente.

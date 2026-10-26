# Universidad Nacional Experimental de Guayana (UNEG)

**Maestría en Tecnologías de la Información**  
**Arquitecturas de Datos Inteligentes**

## Proyecto Integrador

Aplicaciones de Arquitectura de Datos Inteligente para la Amazónica

**Carácter:** Evaluativo  
**Fecha tope de entrega de la Propuesta:** jueves 13/08/26

Para garantizar el rigor académico y la claridad metodológica, el documento del proyecto integrador se dividirá formalmente en las siguientes fases:

- Fase I: ELABORACIÓN Y ACEPTACIÓN DE LA PROPUESTA:

  - Introducción y Contextualización del Problema: descripción de la problemática ambiental y social observada, desglosando sus causas y efectos; anclada al estado del arte del objeto de estudio, con rigor científico, teórico y metodológico, enmarcando la solución general en el ecosistema AmazonIA 4.0.

  - Justificación y Antecedentes Internacionales: Respaldo institucional (UNESCO) y pertinencia científica, metodológica y tecnológica.

  - Arquitectura de Datos Propuesta (Solución Esperada): Estructura técnica general del flujo de datos inteligentes, investigación aplicada con innovación.

  - Cronograma, Hitos de Entrega y Criterios de Evaluación: Fechas y rúbrica detallada

## Rúbrica para la Aceptación

Esta evaluación preliminar determina si el proyecto cuenta con el sustento necesario para iniciar su desarrollo.

| Criterio | Excelente (Aprobado) | Deficiente (Rechazado) |
| --- | --- | --- |
| Sustento Científico | Presenta un problema real de la Amazonía venezolana avalado claramente por literatura indexada (Scopus/SciELO). Coherencia entre la problemática, la propuesta y la metodología relacionada al tema | El problema es genérico, inventado o no cuenta con soporte de investigaciones previas. |
| Viabilidad Tecnológica | El problema se puede resolver utilizando datos y las herramientas del curso (Vectores, RAG, Airflow). | El problema se resuelve con software tradicional; no requiere inteligencia ni flujos dinámicos. |
| Aporte | | |

## PLANTILLA DE PROPUESTA PARA EL PROYECTO INTEGRADOR

### 1. IDENTIFICACIÓN

Es la sección de información básica del proyecto y del equipo de investigadores.

- Nombre del proyecto

- Equipo: CI, nombres, apellidos y emails de todos los integrantes del equipo.

### 2. PLANTEAMIENTO DEL PROBLEMA (AMAZONÍA VENEZOLANA)

En esta sección se describe de manera específica el problema abordado en la región amazónica de Venezuela:

- Cuál es la situación problemática actual

- Qué datos se generan en esa zona

- Por qué los sistemas tradicionales no funcionan bien con esos datos

Ejemplo: Si tu proyecto es sobre minería ilegal, explicarías cómo se detecta actualmente y por qué es insuficiente.

### 3. SUSTENTO CIENTÍFICO (ANTECEDENTES INDEXADOS)

Necesitas presentar cinco (5) artículos científicos de fuentes confiables (Scopus, SciELO u otros índices). Para cada uno debes incluir:

- Título, autores, año y revista

- Una breve explicación de cómo ese estudio aporta a tu proyecto. Esto valida que tu proyecto tiene base científica real, no es solo una idea.

- Estado del arte del objeto en estudio

- Solución innovadora que integre varias técnicas en una solución creativa, inédita y novedosa

- En este documento, se anexa en la sección de recursos, un conjunto de artículos para su procesamiento, se espera que incorpore otros a su corpus de investigación, al menos cinco (5) adicionales.

### 4. DISEÑO PRELIMINAR DE LA SOLUCIÓN

Aquí describes cómo tu sistema funcionará técnicamente:

- Arquitectura de alta disponibilidad y persistencia políglota que se ajuste a la situación

- Datos a ingestar: fuentes y tipos de datos disponibles (audios, videos, imágenes satelitales, PDFs, etc.)

- Diseño de tuberías y de contenedores para abordar la problemática

- Memoria semántica (RAG): ¿Qué conocimiento almacenarás en una base de datos vectorial para que el sistema "entienda" el contexto? En esta capa de procesamiento y semántica, describir el motor analítico que limpia los datos y les da un significado real utilizando modelos de lenguaje (LLMs) y grafos de conocimiento.

- Acción del flujo dinámico: Qué decisión automatizada tomará el sistema cuando detecte un peligro

- Capa de Consumo: Las aplicaciones, tableros de control o agentes de IA que usan esos datos listos para resolver problemas

### 5. RESULTADO ESPERADO PARA EL USUARIO FINAL

Explicar quién usará la aplicación (guardabosques, científicos, comunidades) y qué beneficios concretos les trae.

Conclusión: Esta guía estructurada ayuda al proceso de planificación del proyecto de arquitectura de datos que resuelva un problema real en la Amazonía venezolana, usando técnicas modernas como IA semántica e interfaces de usuario (Streamlit).

## Directrices Científicas y Metodológicas

Para validar que la problemática elegida y la solución propuesta sean viables y científicamente pertinentes, se requiere fundamentar la propuesta con antecedentes teóricos y metodológicos arbitrados y publicados en comunidades académicas y científicas relacionadas con la temática. El maestrante debe analizar críticamente el estado del arte y justificar la innovación tecnológica de su solución citando y contrastando como mínimo diez (10) artículos indexados. Toda propuesta de arquitectura debe estar respaldada por investigaciones científicas y académicas recientes, de al menos cinco años o con vigencia en sus propuestas y de alto impacto (Scopus/Web of Science o equivalente).

- Requisito Obligatorio: El proyecto debe citar y basarse en antecedentes de investigación publicados en revistas indexadas (Scopus, Web of Science, SciELO o Google Académico).

- Enfoque: Estos artículos deben validar técnicamente un problema justificable, demostrando un vacío de conocimiento o una necesidad de optimización en un entorno real; la importancia de la problemática abordada en la Amazonía (venezolana o de la cuenca amazónica en general), así como justificar el uso de las tecnologías de IA y arquitecturas propuestas.

- Aporte: originalidad en la propuesta, demostrando la aplicación tecnológica de forma innovadora o en un contexto nuevo

## Directrices Técnicas de la Asignación

Se espera que los proyectos diseñados sigan con las especificaciones técnicas de ingeniería de las clases:

- Pila Tecnológica Permitida (Open Source Preferred): Ingesta mediante Apache Kafka/NiFi. Almacenamiento en esquemas Lakehouse (Delta Lake/MinIO). Procesamiento en Apache Spark (Python/Scala). Consumo analítico mediante librerías de Python (Scikit-Learn, TensorFlow, Streamlit) o herramientas de BI abiertas.

- Arquitectura de Resiliencia de Red (Offline-First): Toda solución orientada a Amazonas, Bolívar o Delta Amacuro debe incluir una estrategia explícita para lidiar con la latencia extrema o cortes de energía, implementando almacenamiento en caché local (Edge storage) y protocolos de comunicación livianos (MQTT, LoRaWAN).

- Gobernanza y Privacidad: incluir políticas de anonimización de datos sensibles de comunidades indígenas y control de accesos basado en roles (RBAC) para el resguardo de la propiedad intelectual biocultural de la región venezolana.

## Requisitos Técnicos de la Solución

La propuesta debe incorporar las metodologías desarrolladas a lo largo del seminario o sus equivalentes:

- Estrategia de Ingesta en el Borde (Edge Computing): Mecanismos para capturar datos heterogéneos y mitigar problemas de baja conectividad satelital.

- Memoria Semántica (RAG): Uso de embeddings y una base de datos vectorial para procesar datos no estructurados de la selva.

- Flujo Dinámico Automatizado: Implementación de un orquestador (ej. Apache Airflow o similar) con agentes de IA para el enrutamiento inteligente de datos.

- Interfaz de Consumo: Un tablero o herramienta visual interactiva (ej. Streamlit).

- Calidad de Software: Pruebas unitarias básicas para asegurar la tolerancia a fallos del sistema ante datos corruptos o vacíos.

## Estructura de la Solución Esperada (Fase Técnica)

Para este proyecto integrador, los maestrantes deberán diseñar e implementar conceptualmente una infraestructura capaz de recopilar, procesar y analizar grandes volúmenes de datos heterogéneos de la Amazonía. Las partes que compondrán la solución técnica son:

**Flujo de datos:** Fuentes de Datos → Capa de Ingesta → Almacenamiento/Procesamiento → Capa Analítica/IA.

| Fuentes de Datos | Capa de Ingesta | Almacenamiento/Procesamiento | Capa Analítica/IA |
| --- | --- | --- | --- |
| IoT, Satélites, Comunidades | Batch / Streaming | Data Lakehouse | Predicciones / BI |

1. Capa de Ingesta de Datos (Data Ingestion): Mecanismos para capturar datos en tiempo real (sensores IoT en bosques, datos geoespaciales satelitales) y datos en lote (registros de producción comunitaria, catálogos biológicos).

2. Capa de Almacenamiento y Procesamiento (Data Lakehouse): Repositorios híbridos escalables para estructurar datos ambientales complejos y no estructurados, asegurando la consistencia y la integridad del pipeline de datos.

3. Capa de Inteligencia y Analítica Avanzada (Data Intelligence): Modelos de Aprendizaje Automático (Machine Learning) o Inteligencia Artificial aplicados a la predicción, optimización y analítica descriptiva, predictiva y prospectiva.

4. Capa de Consumo y Gobernanza (Socio-Bioeconomía): Paneles de visualización inteligente (Business Intelligence) y contratos inteligentes (Blockchain) para asegurar la transparencia y el comercio justo de los productos generados por comunidades originarias.

## Estructura del Informe Técnico Final

El informe final debe entregarse en formato PDF, redactado con lenguaje técnico pero directo, bajo la siguiente estructura estándar:

1. Portada y Resumen Ejecutivo (máximo 1 página).

2. Introducción y Justificación: Planteamiento del problema específico en la Amazonía venezolana respaldado por los antecedentes científicos indexados.

3. Diseño Conceptual de la Arquitectura: Diagrama de bloques que muestre las capas de datos, desde la captura en campo hasta el consumo.

4. Desarrollo Técnico de la Solución:

  - Explicación de la Memoria Semántica y base de datos vectorial elegida.

  - Lógica del Flujo Dinámico y criterios del orquestador automatizado.

  - Código fuente del filtro/Reranker e interfaz visual desarrollada.

5. Plan de Despliegue en la Nube: Diagrama y explicación de la estrategia de contenedorización (Docker/Kubernetes).

6. Conclusiones y Trabajo Futuro.

7. Referencias Bibliográficas: Listado formal de los artículos indexados utilizados (Formato APA).

## Plantilla de Entregables (Estructura del Informe Técnico)

El estudiante consignará un único documento en formato PDF y un repositorio de código fuente estructurado bajo el siguiente índice formal:

1. Páginas Preliminares

- Portada institucional (UNEG, Maestría en TI).

- Resumen ejecutivo (máximo 250 palabras).

2. Capítulo I: Diagnóstico Territorial y Planteamiento del Problema

- Contextualización de la problemática en el estado seleccionado (Amazonas, Bolívar o Delta Amacuro).

- Justificación del proyecto bajo el enfoque de la AmazonIA 4.0.

3. Capítulo II: Estado del Arte y Marco Científico

- Revisión bibliográfica indexada (mínimo 10 fuentes de Scopus o de similar nivel analizadas en profundidad).

- Análisis de brechas metodológicas (qué han hecho otros y cuál es la innovación de la propuesta).

4. Capítulo III: Diseño de la Arquitectura de Datos Inteligente

- Diagrama formal de componentes e interacciones de datos (uso de notación estándar C4 o diagramas de bloques funcionales).

- Especificación detallada por capa: Ingesta, Almacenamiento (Lakehouse), Procesamiento y Analítica/IA.

- Estrategia de despliegue ante las restricciones de infraestructura del entorno del sur de Venezuela.

5. Capítulo IV: Conclusiones, Recomendaciones y Repositorio Técnico

- Factibilidad del proyecto a mediano plazo.

- Enlace al repositorio (GitHub/GitLab) que contenga scripts conceptuales de configuración (p. ej., archivos Docker Compose, esquemas de bases de datos o pipelines iniciales).

## Recursos fundamentales

Se incorporan los siguientes cinco antecedentes que validen la pertinencia global de la propuesta:

1. Monitoreo de ecosistemas a través de IA regional:

  - Referencia: The Impact of Artificial Intelligence on the Sustainability of Regional Ecosystems (MDPI, 2025).

  - Validación de Pertinencia: Consolida una revisión exhaustiva sobre despliegues reales de IA en entornos locales de Latinoamérica para el monitoreo de bosques, agua y agricultura de precisión, delineando los retos institucionales y socioeconómicos.

2. Tecnologías inteligentes y resiliencia climática:

  - Referencia: Are smart technologies enough to build climate-resilient cities and regions? (ScienceDirect, 2026).

  - Validación de Pertinencia: Analiza la integración sistemática de Big Data, IoT e Inteligencia Artificial dentro de los esquemas de gobernanza ambiental necesarios para mitigar el cambio climático.

3. Sistemas de soporte para la descarbonización y sostenibilidad:

  - Referencia: Applications of AI to low carbon decision support systems in global networks (ScienceDirect, 2025).

  - Validación de Pertinencia: Demuestra formalmente cómo el uso de analítica predictiva en tiempo real previene brechas normativas ambientales y optimiza la sostenibilidad operativa de cadenas de valor.

4. Estructura y evolución de los Big Data Analytics (BDA):

  - Referencia: Big Data Analytics in Information Systems Research: Current Landscape and Future Prospects (ResearchGate, 2025).

  - Validación de Pertinencia: Provee el marco de diseño técnico de ingeniería de datos bajo las propiedades de las 5Vs (volumen, velocidad, variedad, veracidad y valor), clave para estructurar las capas de ingesta en la Amazonía.

5. Gemelos Digitales e Infraestructura de Sincronización:

  - Referencia: Digital twins for regional and supply chain systems: Literature review and conceptual frameworks (ResearchGate, 2024).

  - Validación de Pertinencia: Valida técnicamente cómo sincronizar datos capturados en campo mediante IoT con un modelo digital en la nube

## El Problema de la Amazonía

La cuenca amazónica atraviesa una crisis ecológica sin precedentes que amenaza su estabilidad como el principal regulador climático de Sudamérica. La persistencia de modelos económicos de extracción lineal — como la ganadería extensiva, la tala comercial y la minería no regulada— destruye el ecosistema a un ritmo superior a su capacidad de regeneración.

Esta degradación fragmenta el hábitat, reduce la biodiversidad y acelera las emisiones de carbono globales. El verdadero desafío radica en la asimetría de información: los tomadores de decisiones carecen de infraestructuras tecnológicas integradas para procesar masivamente variables ambientales, económicas y sociales en tiempo real. Sin datos inteligentes, es imposible transitar hacia el modelo de la AmazonIA 4.0.

## El Ecosistema Amazónico Venezolano

En Venezuela, la región sur-oriental abarca una compleja red ecológica y sociocultural distribuida en tres estados clave que enfrentan retos y dinámicas particulares:

- Estado Amazonas: Caracterizado por selvas prístinas de alta fragilidad ecológica y una densa presencia de comunidades indígenas ancestrales. Sus principales desafíos son el aislamiento geográfico, la conectividad limitada y la vulnerabilidad de la biodiversidad ante actividades antrópicas no controladas.

- Estado Bolívar: El epicentro de la cuenca del río Caroní y del Escudo Guayanés. Enfrenta una presión masiva debido al Arco Minero del Orinoco, lo que genera deforestación crítica, colmatación de ríos por sedimentos y contaminación por mercurio, afectando los embalses hidroeléctricos estratégicos del país.

- Estado Delta Amacuro: Un ecosistema estuarino y de manglares único en el Atlántico, habitado mayoritariamente por el pueblo Warao. Sus debilidades críticas incluyen la vulnerabilidad al cambio climático (ascenso del nivel del mar), la intrusión salina en sistemas fluviales agrícolas y la falta de cadenas de valor justas para sus recursos hidrobiológicos y artesanales. La cuenca amazónica, genera entre el 16% y el 20% del agua dulce del planeta y alberga más del 25% de la biodiversidad terrestre. Sin embargo, la región enfrenta una degradación alarmante debido a modelos económicos extractivistas tradicionales, que priorizan la deforestación para la expansión agrícola, la minería ilegal y la explotación maderera no regulada. Estos factores están acelerando el punto de no retorno climático del bioma, rompiendo el equilibrio ecológico global. La Amazonía venezolana, no se escapa de este escenario, enfrenta desafíos ambientales, ecológicos y sociales críticos, tales como la minería ilegal, la deforestación acelerada, la pérdida de biodiversidad y la desconexión de comunidades remotas. Este proyecto final consiste en diseñar, fundamentar y prototipar una Arquitectura de Datos Inteligente orientada a resolver una problemática real y específica de esta región, integrando los componentes avanzados Frente a este escenario, surge la iniciativa científica AmazonIA 4.0, de la Profa. Livia Borjas de Venezuela, quien propone el desarrollo sostenible de la Amazonia a través de proyectos de tecnología con IA, combinando la riqueza ecológica de la biodiversidad y el saber de las comunidades indígenas con las tecnologías disruptivas de la Cuarta Revolución Industrial (Inteligencia Artificial, Big Data, Blockchain e Internet de las Cosas). El objetivo es generar productos de alto valor agregado mediante procesos. El despliegue de tecnologías emergentes en este territorio se alinea de forma directa con las directrices globales de sostenibilidad. La UNESCO promueve activamente el uso de la ciencia y la tecnología frente a los desafíos globales. A través de iniciativas clave como el Proyecto de las Reservas de Biosfera en la Amazonía, la organización busca reconciliar la conservación biológica con soluciones de desarrollo sostenible locales e innovadoras. Asimismo, los programas de la UNESCO justifican la necesidad de crear capacidades científicas de alto nivel. Una arquitectura de datos inteligente es el habilitador tecnológico indispensable para soportar el

monitoreo ambiental, la inteligencia territorial y el reparto equitativo de beneficios socioeconómicos derivados de la naturaleza.

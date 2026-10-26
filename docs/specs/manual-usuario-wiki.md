# Manual de usuario de Centinela Orinoco

**Propósito:** ayudar a las personas a recorrer la interfaz, realizar sus tareas habituales y entender la información que aparece en pantalla.
**Formato:** wiki sencilla, en español, con artículos breves y capturas de la aplicación.
**Estado:** índice principal y artículos de usuario ampliados; capturas específicas añadidas para Sala GIS, Telemetría y Corpus científico. La navegación por teclado y el índice móvil están implementados; falta la revisión visual en navegador.

## Qué debe encontrar el usuario

Al seleccionar **Manual de usuario** en el menú izquierdo, el manual se abre en otra pestaña. Así la aplicación queda abierta y conserva la vista en la que estaba trabajando.

El manual tiene un índice fácil de recorrer y un buscador. Su organización sigue los mismos tres grupos y diez secciones del menú de la aplicación. Las instrucciones usan los nombres que aparecen en pantalla; las capturas ayudan a localizar los controles.

```text
Manual de usuario
├── Primeros pasos
├── Operación
│   ├── Sala GIS
│   ├── Incidentes
│   ├── Veeduría comunitaria
│   ├── Radar SAR
│   └── Telemetría hidrológica
├── Análisis
│   ├── Inteligencia IA y asistente
│   ├── Corpus científico
│   └── Boletín oficial
└── Plataforma
    ├── Ingesta y RAG PostGIS
    └── Postgres RPCs
```

**Primeros pasos** presenta la barra superior, el menú lateral y el selector de apariencia. Si alguna sección contiene demasiadas instrucciones, podrá tener páginas secundarias propias, conservando este índice principal.

## Cómo se escribe cada artículo

Cada artículo responde las preguntas que una persona tendría al abrir esa pantalla:

1. **¿Para qué sirve esta sección?** Una explicación corta y sin jerga.
2. **¿Cómo llego?** La opción exacta del menú o el botón que hay que seleccionar.
3. **¿Cómo la uso?** Pasos concretos para las tareas que permite la pantalla.
4. **¿Qué estoy viendo?** Significado de los nombres, colores, estados, unidades y resultados.
5. **¿Qué hago si no funciona?** Una recomendación sencilla para los problemas comunes.

Se agrega una captura cuando ayude a ubicar un control o entender el resultado. Una imagen debe corresponder a la interfaz real y tener un pie y una descripción para quien no pueda verla. Los pasos también deben entenderse sin la imagen.

## Contenido del índice

| Grupo del menú | Artículo | Temas que incluye |
|---|---|---|
| Inicio | Primeros pasos | Cómo está organizada la aplicación, barra superior, menú, navegación en móvil y apariencia Día/Noche/Sistema |
| Operación | Sala GIS | Mapas base, acercamiento, capas y filtros, leyenda de focos, inspección de elementos, botones de APIs y exportación GeoJSON |
| Operación | Incidentes | Búsqueda, filtros, registro mediante el acceso disponible, categoría, severidad, estado y exportación CSV |
| Operación | Veeduría comunitaria | Formulario de denuncia, ubicación GPS/manual, anonimato, fotos y videos, confirmación, código, seguimiento y acciones disponibles |
| Operación | Radar SAR | Escenas Sentinel-1 y sus datos; explicación del procesamiento pendiente si aparece en pantalla |
| Operación | Telemetría hidrológica | Estaciones, nivel, variación, fecha, tendencia, cota de desborde, estados, historial y mapa |
| Análisis | Inteligencia IA y asistente | Consultas, zonas, contexto, resultados, informes y cuándo contrastar una respuesta |
| Análisis | Corpus científico | Búsqueda, lectura, metadatos, sitios en el mapa, añadir PDF/URL/DOI y mensajes de procesamiento |
| Análisis | Boletín oficial | Campos, generación, revisión, copia y descarga Markdown |
| Plataforma | Ingesta y RAG PostGIS | Tareas, conectores y APIs, búsqueda documental, registros recientes, migraciones SQL, catálogo Sentinel-2 y minuta de campo |
| Plataforma | Postgres RPCs | Para qué sirve la consola y orientación básica sobre sus funciones y resultados |

El artículo **Ingesta y RAG PostGIS** describe sus siete pestañas con el nombre visible en la interfaz. No hace falta convertir cada pestaña en un artículo separado. Un glosario breve puede explicar siglas directamente donde aparecen o en una página común de ayuda.

## Explicar lo que muestran los datos

El manual debe ayudar a distinguir entre datos cargados desde fuentes externas, datos de ejemplo, referencias geográficas y resultados de análisis. Una capa visible o un resultado generado por IA no equivale por sí mismo a una confirmación en terreno.

Explicar solo las mediciones que aparecen realmente en la interfaz. Por ejemplo, la pantalla de telemetría presenta niveles hidrológicos; no debe describirse como medición directa de mercurio o calidad del agua. Si Radar SAR muestra que falta procesamiento, no afirmar que ya detecta perturbaciones medidas.

Cuando una acción confirma un registro en pantalla, decir lo que el usuario verá. No prometer almacenamiento duradero o envío exitoso si la interfaz no lo confirma. Usar como referencia los nombres, las etiquetas y los mensajes actuales del producto.

## Capturas

Preparar capturas representativas de la interfaz para estas áreas: menú y apariencia, Sala GIS, incidentes, denuncia, Radar SAR, telemetría, Inteligencia IA, Corpus, Boletín e Ingesta. Se pueden incluir varios controles en una misma imagen si se entienden con claridad.

Usar datos de demostración. No incluir credenciales ni información personal. Añadir flechas o números solo cuando faciliten relacionar la captura con los pasos. No reutilizar una imagen genérica como si mostrara otra sección.

## Fases del plan

1. **Definir estructura y navegación:** completada. El índice lateral agrupa artículos y el buscador ayuda a encontrarlos.
2. **Completar las guías y sus imágenes:** completada para las secciones documentadas. Los artículos explican controles y límites observados; Interfaz y apariencia incluye capturas del menú/barra y del selector; Sala GIS, Telemetría y Corpus tienen capturas propias. Las otras páginas no muestran imágenes que no correspondan a su contenido.
3. **Revisar el recorrido completo:** parcialmente completada. El enlace del menú abre el manual en otra pestaña; el índice móvil se puede desplegar, hay enlace de regreso a la app, los artículos se pueden recorrer con teclado y el buscador mantiene título, contenido y navegación alineados. La compilación de Vite pasó y, con el servidor local activo, el manual respondió `200 text/html` y las tres capturas `200 image/jpeg`. La inspección visual en navegador y distintos tamaños de pantalla sigue pendiente.
4. **Mantener la guía al día:** pauta documentada abajo; aplicar cada vez que cambie una pantalla o flujo.

## Mantenimiento del manual

Cuando se modifique una sección de la aplicación, actualizar su artículo en `src/manual/ManualApp.tsx` dentro del mismo cambio. Seguir esta lista breve:

- [ ] Revisar nombres, botones, campos, etiquetas y estados en el componente de la pantalla modificada.
- [ ] Corregir el artículo relacionado para describir solo acciones y resultados que la interfaz confirma.
- [ ] Si cambia la disposición de controles, actualizar la captura correspondiente en `public/manual/images/`; mantener su `imageAlt` y `imageCaption` descriptivos.
- [ ] Si se añade o renombra una sección del menú, actualizar también `MANUAL_NAV_GROUPS` y la tabla de contenido de este documento.
- [ ] Abrir el manual en local y comprobar el artículo afectado, la búsqueda y la navegación anterior/siguiente.
- [ ] Revisar que la imagen cargue desde su ruta `/manual/images/...` y que no sea una captura de otra pantalla.

Si la modificación solo cambia datos o lógica interna y no altera lo que ve o hace el usuario, no hace falta cambiar el manual. Evitar describir como disponible una función que esté incompleta o dependa de una fuente desconectada.

## Alcance

El objetivo es una guía de consulta para las personas que usan la aplicación. No se necesita crear una enciclopedia técnica, una guía de instalación, un sistema de edición pública o un portal nuevo. La wiki organiza instrucciones de uso, explica los elementos de la pantalla y enlaza artículos relacionados cuando eso facilite la navegación.

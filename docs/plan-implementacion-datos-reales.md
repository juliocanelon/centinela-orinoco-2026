# Plan de implementación: datos reales, correcciones y eliminación de datos simulados

**Proyecto:** Centinela Orinoco 2026
**Fecha:** 24/10/2026
**Base:** directorio `satelliteApiDirectory.ts` aportado por Miguel, diagnóstico de Supabase y revisión de los modelos de mercurio y conductividad.

---

## 1. Objetivo

Que la plataforma muestre **solo datos reales y defendibles**:

- Ingesta automática desde NASA FIRMS, Copernicus (Sentinel-1, 2 y 3) e INAMEH.
- Las URLs de consumo salen del directorio de Miguel.
- En Supabase se insertan **solo registros nuevos**; los repetidos se omiten.
- Se eliminan los datos simulados y las variables que **no se pueden medir desde satélite** (pH, conductividad, mercurio en ppm).
- Cobertura: **Venezuela + Guayana Esequiba** (`-73.5, 0.6, -57.0, 12.2`).

## 2. Ya realizado (24/10/2026)

| Tarea | Resultado |
|---|---|
| Diagnóstico de Supabase | Una app externa insertaba FIRMS fila por fila cada ~3 h sin deduplicar. Era la causa del Disk IO agotado |
| Limpieza de duplicados | Base: **1.090 MB → 28 MB**. FIRMS: 310.920 → 1.693 filas. RAG: 308.367 → 1.770 filas |
| Protección antiduplicados | Índices únicos `uq_firms_detection`, `uq_rag_document` e índice `idx_firms_created_at` |
| Apps que inyectaban datos | Despublicadas |
| Respaldo | `~/git/centinela/supabase-backups/2026-10-24/` |
| `.env` local | Recreado. MongoDB verificado. Clave de FIRMS verificada (5000 consultas / 10 min) |
| Fuentes verificadas | FIRMS ✅, STAC Sentinel-1/2 ✅, OData Sentinel-3 ✅, INAMEH (PDF) ✅ |

## 3. Decisiones tomadas

1. **Mercurio, pH y conductividad no se miden desde satélite.** Se quitan como "telemetría". El mercurio pasa a ser un **índice de riesgo** (Nivel 2). pH y conductividad se muestran como "requiere medición de campo".
2. **Copernicus Nivel 1 = catálogo real de escenas.** Las detecciones (perturbaciones SAR, turbidez) llegan en el Nivel 2, con credenciales de Copernicus.
3. **FIRMS:** se guardan todos los focos en `nasa_firms_hotspots`. Al índice RAG y a las alertas solo van los de confianza alta o FRP significativo.
4. **Alcance de la limpieza de simulados:** datos satelitales, hidrológicos y variables de calidad de agua inventadas. **No se tocan** en esta etapa: reportes Kobo, denuncias comunitarias, incidentes y corpus científico.
5. **Las zonas del mapa** (áreas protegidas y sectores mineros) se mantienen como **zonas de vigilancia** de referencia. Se les quitan las métricas inventadas (hectáreas, dragas, % de pérdida).
6. **Escritura eficiente** por el límite de Disk IO del plan gratuito: inserciones por lote, filtro previo de existentes y nada de `count(*)` repetitivos.

---

## 4. Plan por fases (Nivel 1, sin credenciales nuevas)

### Fase 1: Directorio de conexiones

Archivo: `src/data/satelliteApiDirectory.ts`

- [ ] Integrar el archivo de Miguel.
- [ ] Quitar la `MAP_KEY` de FIRMS del código (va solo en `.env` / Secrets de AI Studio).
- [ ] Constante única de cobertura con el Esequibo y usarla en todas las entradas.
- [ ] Catálogos de Copernicus (STAC, OData) marcados como **públicos**; token solo para Sentinel Hub.
- [ ] Dominio STAC nuevo `stac.dataspace.copernicus.eu/v1`. Sentinel-2 coherente (URL, plantilla y documentación en STAC).
- [ ] INAMEH: endpoint de la página + PDF de cada estación; quitar `curl.exe`.
- [ ] Sentinel-3: descripción corregida (sin "proxy de pH" ni conductividad) y ejemplo `curl` con la URL codificada (hoy lleva espacios sin codificar).
- [ ] INPE Queimadas: la URL `queimadas.dgi.inpe.br/api/focos` redirige a `terrabrasilis.dpi.inpe.br/queimadasapi/focos` y responde **404** (verificado 24/10/2026). Buscar el endpoint vigente o marcar la conexión como "no disponible".
- [ ] Global Forest Watch: requiere clave de API propia. Queda como referencia en el directorio (sin ingesta en el Nivel 1).
- [ ] Entrada `CENTINELA_INTERNAL_INGESTION_PROXY`: la descripción menciona embeddings pgvector con Gemini, pero `environmental_rag_documents` **no tiene columna `embedding`** en Supabase. Corregir la descripción o dejarlo como trabajo pendiente.
- [ ] `TASK_TO_API_CONNECTION_MAP` y `getApiConnectionForTask()` del archivo de Miguel pasan a ser la fuente de URLs del planificador (hoy nadie las usa).
- [ ] `.env.example`: agregar `FIRMS_MAP_KEY`, `COPERNICUS_CLIENT_ID`, `COPERNICUS_CLIENT_SECRET`, `INGESTION_TRIGGER_TOKEN`.

### Fase 2: Esquema de Supabase (migración nueva en `supabase/migrations/`)

| Tabla | Cambio | Clave única (no duplicar) |
|---|---|---|
| `nasa_firms_hotspots` | Ya protegida | satélite + lat + lon + fecha + hora |
| `sentinel1_scenes` | **Nueva** | id de escena STAC |
| `s2_product_tile` | Clave pasa de `tile_id` a **id de producto**; columna de nubosidad real | id de producto |
| `sentinel3_products` | **Nueva** (OLCI WFR y SLSTR) | id de producto OData |
| `hydrological_telemetry_readings` | Columnas reales de INAMEH: nivel (msnm), nivel anterior, variación, cota de desborde, fuente. **Se eliminan** turbidez, mercurio y pH inventados | código de estación + fecha |
| `environmental_rag_documents` | Columna `content_hash` para upsert desde la API (reemplaza el índice por expresión) | tipo + id de origen + hash |
| `copernicus_sar_disturbances` | Se vacía (7 filas inventadas). Queda para el Nivel 2 | — |

- [ ] Script **aparte** de limpieza de simulados en Supabase: los 35 focos FIRMS sin fuente, las lecturas hidrológicas inventadas, las 7 perturbaciones SAR, los 4 cuadrantes S2 fijos y sus documentos RAG. Con respaldo previo y simulación antes de aplicar.

### Fase 3: Conectores reales (`server/ingestion/`)

Cada conector toma su URL de `getApiConnectionForTask()` y devuelve registros normalizados.

| Conector | Fuente | Frecuencia | Notas |
|---|---|---|---|
| `firms.ts` | CSV área, sensores VIIRS NOAA-20, VIIRS S-NPP, MODIS | cada 3 h | ~2.200 focos/día. Lote único por ejecución |
| `sentinel1.ts` | STAC `sentinel-1-grd` | cada 12 h | ~80 escenas/semana. Paginación |
| `sentinel2.ts` | STAC `sentinel-2-l2a` | cada 24 h | >100 escenas/semana. Paginación. Guarda nubosidad |
| `sentinel3.ts` | OData `OL_2_WFR` y `SL_2_WST` | cada 24 h | Solo metadatos (no descarga productos de 37–116 MB) |
| `inameh.ts` | Página PHP → PDF → `pdf-parse` | cada 6 h | 4 estaciones. Detectar PDF desactualizado (Ciudad Bolívar sigue en 18/03/2025) |

Reglas comunes:

- [ ] Consultar en Supabase los ids ya existentes del periodo y enviar **solo los nuevos**, en un único lote.
- [ ] `upsert` con `ignoreDuplicates` como segunda barrera (los índices únicos lo garantizan).
- [ ] Registrar por ejecución: **N nuevos, M omitidos por repetidos, errores**.
- [ ] Tiempo máximo y reintentos limitados por fuente; si una fuente falla, no bloquea a las demás.

### Fase 4: Planificador y disparadores

Archivos: `server/satelliteScheduler.ts`, `server.ts`

- [ ] Reescribir `executeTask` para que use los conectores. **Cero `Math.random()`.**
- [ ] Agregar la tarea `SENTINEL_3_OLCI` (también en `src/types.ts` y en los íconos y colores de `SupabaseAutomationSchedulerView.tsx`). Ajustar la frecuencia de INAMEH a 6 h.
- [ ] Estaciones hidrológicas: reemplazar las actuales (Atabapo, Puerto Ayacucho, Aripao) por las 4 reales de INAMEH (Puerto Ayacucho, Caicara, Ciudad Bolívar, Palúa), con las coordenadas que publica cada PDF.
- [ ] `server.ts:1184`: la URL de FIRMS por país (`/country/.../VEN`) se reemplaza por la del directorio (por área).
- [ ] Eliminar el modo "demo acelerado".
- [ ] Contadores reales: conteo inicial desde Supabase al arrancar y luego incrementos en memoria.
- [ ] Rutas manuales `/api/ingestion/*/fetch` y `/api/telemetry/*` → disparan la tarea real (sin datos inventados).
- [ ] Al arrancar, el servidor carga los registros recientes desde Supabase (no datos de ejemplo).
- [ ] **Disparador externo:** AI Studio corre en Cloud Run, que **apaga la instancia sin tráfico**, y entonces el `setInterval` no corre. Se agrega `POST /api/scheduler/run-due` protegido con `INGESTION_TRIGGER_TOKEN`, llamado cada hora por un cron externo (GitHub Actions o pg_cron + pg_net de Supabase).
- [ ] Proteger los disparadores manuales con ese token, para que nadie externo pueda forzar ingestas.

### Fase 5: Eliminación de datos simulados

**Backend**

| Archivo | Qué se elimina |
|---|---|
| `server/satelliteScheduler.ts` | Generación aleatoria de FIRMS, SAR, S2 e hidrología; contadores fijos (48, 19, 5, 36) |
| `server.ts` | Semillas `liveHydroTelemetryStore`, `s2TilesStore`, `orbitSchedulesStore`, estaciones fijas de `/api/telemetry/stations`, generadores en `/api/ingestion/*` y textos de respaldo inventados del RAG |
| `server/zoneAnalyticsEngine.ts` | Valores por defecto inventados (p. ej. FRP 28,4 MW) cuando no hay datos → "sin datos" |
| SQL de automatización (RPC) | `COALESCE` con valores inventados (mercurio 0,048, turbidez 88,5, riesgo 84,2) → nulos / "sin datos" |

**Frontend**

| Archivo | Qué se elimina o cambia |
|---|---|
| `src/components/SyntheticTelemetryGenerator.tsx` | Se elimina el componente y su entrada en `App.tsx` |
| `src/data/mockGeoJSON.ts` | `INITIAL_HEAT_ANOMALIES` e `INITIAL_HYDROLOGICAL_STATIONS` → reemplazados por datos de la API. `INITIAL_MINING_CLUSTERS` e `INITIAL_PROTECTED_AREAS` → zonas de vigilancia sin métricas inventadas |
| `src/data/scientificAndSarData.ts` | `INITIAL_SAR_RADAR_ANOMALIES` → se elimina (vuelve en el Nivel 2 con datos reales) |
| `src/services/liveDataPipelineService.ts` | `INITIAL_LIVE_FIRMS_HOTSPOTS`, `INITIAL_LIVE_COPERNICUS_DISTURBANCES`, `INITIAL_S2_*`, `INITIAL_ORBIT_SCHEDULES` |
| `src/lib/supabaseClient.ts` | Respuestas aleatorias de respaldo cuando falla Supabase → mostrar error / "sin conexión" |
| `src/components/TelemetryView.tsx`, `TacticalMap.tsx`, `LiveIngestionPipelineView.tsx` | Leen datos reales; estados vacíos claros cuando no hay datos |

### Fase 6: Variables no medibles (mercurio, pH, conductividad)

- [ ] Quitar de tipos, tablas, vistas, RAG y prompts de IA: `estimatedMercuryPpm`, `ph`, `dissolvedOxygenMgL`, conductividad y `turbidityNtu` inventada.
- [ ] En su lugar, en el panel de cada estación: "Calidad del agua: **requiere medición de campo**", con explicación breve.
- [ ] Revisar `AIChatDrawer`, `AIIntelligenceView`, `zoneAnalyticsEngine` y el generador de boletines para que la IA **no afirme valores de mercurio** inexistentes.
- [ ] El estado de la estación (`OPTIMAL`, `ELEVATED`, `ALERT_CRECIDA`) se calcula con el **nivel real de INAMEH frente a su cota de desborde**.

### Fase 7: Pantallas

- [ ] Modal de conexiones (`SatelliteApiConnectionsModal.tsx`): pestañas Óptico, Alertas de bosque y Telemetría fluvial (hoy las conexiones nuevas solo se ven en "Todas"); área tomada de `conn.amazonBoundingBox` en vez del texto fijo `[-68.5°, 0.5° a -58.5°, 10.2°]`; el "ping" deja de ser simulado y consulta el backend.
- [ ] `LiveIngestionPipelineView.tsx:745`: mismo texto de área fijo → tomarlo del directorio.
- [ ] Mapa: agregar la capa WMS pública de NASA GIBS (focos térmicos VIIRS) del directorio de Miguel. No necesita clave y se superpone en Leaflet.
- [ ] Tareas programadas: URL real, Sentinel-3, nuevos / omitidos por ejecución, próxima ejecución.
- [ ] Telemetría: nivel, variación, cota de desborde y aviso de PDF desactualizado (INAMEH).
- [ ] Mapa: focos FIRMS reales (filtrables por confianza), huellas de pasadas Sentinel, zonas de vigilancia.

### Fase 8: Verificación y publicación

- [ ] `npm run lint` sin errores.
- [ ] Ejecutar cada tarea **dos veces**: la segunda debe dar **0 nuevos**.
- [ ] Revisar Disk IO y tamaño de la base en Supabase tras 24 h de ingesta real.
- [ ] Revisar las pantallas en el navegador.
- [ ] Secrets de AI Studio: `FIRMS_MAP_KEY`, `INGESTION_TRIGGER_TOKEN` y `MONGODB_URI` corregida.
- [ ] Push a `main`, sincronizar AI Studio y **volver a publicar Centinela** (hoy responde 404).
- [ ] Configurar el cron externo.

---

## 5. Nivel 2 (requiere cuenta de Copernicus Data Space)

Requisito: crear un cliente OAuth en `shapps.dataspace.copernicus.eu` → `COPERNICUS_CLIENT_ID` / `COPERNICUS_CLIENT_SECRET`.

| Producto | Método | Resultado |
|---|---|---|
| **Turbidez / sedimentos** | Sentinel-2 + algoritmo de Nechad et al. (2010), Statistical API por tramo de río | SPM en mg/L (sin calibración local, se indica) |
| **Perturbación SAR** | Sentinel-1, cambio de retrodispersión VV/VH por zona de vigilancia | `copernicus_sar_disturbances` con mediciones reales |
| **Pérdida de vegetación** | Sentinel-2, caída de NDVI con máscara de nubes (SCL) | Alertas de desmonte |
| **Agua / inundación** | Sentinel-1 | Extensión del agua |
| **Índice de riesgo de mercurio** | Actividad minera (FIRMS + SAR) + turbidez + posición aguas abajo | Alto / medio / bajo, con sus componentes |

## 6. Nivel 3 (a evaluar)

- Nivel de ríos por altimetría de Sentinel-3 (estaciones virtuales, Copernicus Land).
- Caudal y pronóstico de crecidas con GloFAS (Copernicus Emergency).
- Calibración propia con **muestras de campo** (mercurio, pH, conductividad) cargadas por KoboToolbox.

## 7. Documento académico

- Reescribir la metodología de mercurio y conductividad: Nechad para turbidez, TDS = k·CE con mediciones de campo, mercurio como índice de riesgo y trabajo futuro.
- Eliminar las afirmaciones de "telemetría" para variables no medidas.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Disk IO del plan gratuito | Lotes, filtro previo, índices; vigilar tras 24 h |
| Cloud Run sin tráfico no ejecuta el planificador | Cron externo + endpoint con token |
| INAMEH cambia el formato del PDF o deja de publicar | El conector valida el formato; si falla, registra error y marca la estación como "sin datos" |
| Ciudad Bolívar desactualizado | Mostrar fecha real del dato y aviso |
| Volumen de FIRMS (~2.200/día, muchas quemas agrícolas) | Todo a la tabla; solo alta confianza / FRP alto a RAG y alertas |
| La clave de FIRMS es de Miguel | Opcional: clave propia (gratis) |

## 9. Orden de ejecución propuesto

1. Fases 1 → 2 → 3 → 4 (backend con datos reales).
2. Fases 5 → 6 → 7 (limpieza de simulados y pantallas).
3. Fase 8 (verificación y publicación).
4. Nivel 2 cuando estén las credenciales de Copernicus.

---

## 10. Estado de implementación (24-25/10/2026)

Fases 1 a 7 implementadas y Fase 8 verificada en local. Pendiente: publicar.

### Migraciones aplicadas en Supabase

| Archivo | Contenido |
|---|---|
| `202610250001_real_satellite_ingestion.sql` | RLS de solo lectura pública; tablas `sentinel1_scenes`, `sentinel3_products`; `s2_product_tile` por producto; hidrología INAMEH real; `content_hash` en RAG; RPCs sin valores inventados; borrado de simulados |
| `202610250002_ingestion_runs.sql` | Historial de ejecuciones del planificador |
| `202610250003_firms_outside_monitored_states.sql` | Etiqueta "Fuera de los estados monitoreados" y RAG solo de estados monitoreados |
| `202610250004_heat_anomalies_monitored_states.sql` | El mapa recibe solo focos de estados monitoreados |

Respaldo de todo lo borrado: `~/git/centinela/supabase-backups/2026-10-24/` y `2026-10-25/`.

### Verificación realizada

- `npm run lint` y `npm run build` sin errores. La clave de FIRMS no aparece en el bundle ni en el código.
- Cada tarea ejecutada dos veces contra Supabase: la segunda dio **0 nuevos** (FIRMS 4.392 omitidos, S1 41, S2 508, S3 81, INAMEH 8). También por la API real (supabase-js).
- Base: 0 duplicados, 0 registros sintéticos, 35 MB.
- Pantallas revisadas en el navegador (mapa, telemetría, radar, ingesta) sin errores de consola.

### Cambios respecto al plan

- **Focos fuera de Venezuela:** el recuadro incluye franjas de Colombia, Brasil y Guyana. Los focos se guardan todos, pero el mapa, la IA y el RAG usan solo los que caen en los 9 estados con límites cargados.
- **Ejecución manual sin token:** el navegador no puede guardar secretos, así que la ejecución manual se permite con una espera mínima de 15 min por tarea; el token solo es obligatorio para `run-due` (cron).
- **Paginación:** la API de Supabase devuelve máx. 1.000 filas; las lecturas del servidor se paginan.
- **Archivo `satelliteScheduler.ts` de Miguel:** no se integró. Insertaba fila por fila sin deduplicar y tenía perturbaciones SAR y calidad de agua escritas a mano.
- **Referencias bibliográficas:** se eliminaron del análisis de zonas dos referencias no verificables (Bermúdez et al. 2023; Veiga & Angeloci 2021) y un "hash SHA256" ficticio.

### Pendiente (requiere acción del usuario)

1. Secrets de AI Studio: `FIRMS_MAP_KEY`, `INGESTION_TRIGGER_TOKEN` y `MONGODB_URI` corregida.
2. Push a `main`, sincronizar AI Studio y volver a publicar Centinela.
3. Cron externo cada hora: `POST https://<dominio>/api/scheduler/run-due` con encabezado `x-ingestion-token`.
4. Nivel 2: cuenta de Copernicus Data Space (cliente OAuth).

## 11. Alcance territorial y densidad de focos (25/10/2026)

- **Estados monitoreados:** Amazonas, Bolívar, Delta Amacuro y Guayana Esequiba (`MONITORED_STATES`). Recuadro de consulta: `-68.0,0.6,-57.8,10.1`. FIRMS descarta en la ingesta los focos de otros estados (migración `202610250005`).
- **Mapa de densidad:** hexágonos de 25 km de lado (≈1.624 km²), calculados en el servidor (`GET /api/firms/density?days=1|3|7`). El color indica focos prioritarios por 1.000 km² (niveles <1, 1-3, 3-6, ≥6); el borde claro indica focos de prioridad alta. Desde el zoom 9 se muestran los focos individuales.
- **Prioridad de cada foco:** alta = fuego repetido en el mismo punto (~1 km) en 2 o más días, o foco relevante dentro de un área protegida o a ≤25 km de una zona minera; media = confianza alta o FRP ≥ 10 MW; baja = el resto (oculta por defecto).
- **Limitación:** las áreas protegidas son polígonos aproximados, y en la Gran Sabana el fuego repetido suele ser quema tradicional de sabana, no minería: la prioridad alta indica dónde mirar primero, no confirma actividad minera.

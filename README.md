# Centinela Orinoco

**Arquitectura de Datos Inteligentes para la Detección Temprana y el Monitoreo de la Minería Ilegal en el Arco Minero del Orinoco**

Plataforma web de monitoreo geoespacial, ambiental y de seguridad territorial para la cuenca del Orinoco. Integra un mapa táctico, ingesta satelital programada, telemetría hidrométrica, denuncias comunitarias, un corpus científico con búsqueda semántica y análisis asistido por IA (Gemini).

> **Estado:** prototipo académico. Los registros satelitales y de telemetría son **sintéticos** y la búsqueda semántica aún no usa vectores generados. No debe interpretarse como evidencia ambiental ni usarse operativamente.

- **Producción:** [centinela-orinoco-2026.ai.studio](https://centinela-orinoco-2026.ai.studio/)

![Sala GIS de Centinela Orinoco: mapa táctico de Venezuela con capas satelitales, ríos, sectores estratégicos y focos térmicos](public/captura-sala-gis.png)

## Acerca del proyecto

<p align="center">
  <img src="public/logo-uneg.png" alt="Logo UNEG" width="120">
</p>

<p align="center">
  República Bolivariana de Venezuela<br>
  Universidad Nacional Experimental de Guayana<br>
  Vicerrectorado Académico<br>
  Coordinación General de Investigación y Postgrado<br>
  Maestría Tecnologías de la Información
</p>

**Proyecto:** Centinela Orinoco: Arquitectura de Datos Inteligentes para la Detección Temprana y el Monitoreo de la Minería Ilegal en el Arco Minero del Orinoco.

**Objetivo:** Diseñar una arquitectura de datos inteligente que permita detectar de forma temprana y monitorear la minería ilegal en el Arco Minero del Orinoco.

| Dato | Valor |
|---|---|
| Sede | Puerto Ordaz |
| Cohorte | IX |
| Período | Trimestre III, 2026 |
| Materia | Seminario I: Arquitectura de Datos Inteligentes |
| Profesora | PhD. Livia Carolina Borjas Medina |

**Integrantes:**

- Julio Cesar Canelón Rangel
- José Francisco Escalante Rosales
- Miguel Damián Mota Garrido

La misma ficha se muestra en la aplicación desde el modal "Acerca del proyecto" y se define en [src/data/academicInfo.ts](src/data/academicInfo.ts).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19, Vite 6, Tailwind CSS 4, Leaflet, Turf.js |
| Backend | Node.js + Express (`server.ts`), servido junto con Vite en desarrollo |
| Base relacional / espacial | Supabase (PostgreSQL + PostGIS + pgvector) |
| Base documental | MongoDB Atlas (evidencias de incidentes) |
| IA (en la aplicación) | Google Gemini (`@google/genai`) |
| Despliegue | Google AI Studio: [centinela-orinoco-2026.ai.studio](https://centinela-orinoco-2026.ai.studio/) |
| Desarrollo asistido | Claude Code, Codex y Gemini |

## Estructura

```
server.ts                 API Express + middleware de Vite (puerto 3000)
server/
  aiModelManager.ts       Pool de modelos Gemini
  satelliteScheduler.ts   Planificador de ingesta (FIRMS, Sentinel-1/2, telemetría)
  zoneAnalyticsEngine.ts  Analítica predictiva por zona
  services/               Denuncias comunitarias y persistencia híbrida (saga PostgreSQL ↔ MongoDB)
  db/mongoClient.ts       Cliente MongoDB
  scripts/                Utilidades mongo:ping / init / verify
src/
  components/             Vistas: mapa táctico, telemetría, corpus, denuncias, IA, etc.
  components/AppShell.tsx Barra lateral, barra superior y selector de apariencia
  index.css               Tokens de diseño (tipografía, superficies, Leaflet)
  theme.css               Modos día/noche y acentos (generado por scripts/generate-theme-css.mjs)
  data/academicInfo.ts    Ficha académica (modal "Acerca del proyecto")
supabase/migrations/      Esquema y RPC de persistencia híbrida
```

## Apariencia

El botón de sol/luna de la barra superior cambia el modo (**Día**, **Noche** o **Sistema**) y el color de acento (Caudal, Señal, Jade, Oro u Orquídea). La elección se guarda en el navegador.

Los componentes usan las clases de Tailwind de siempre (`slate-*`, `sky-*`, `bg-surface`…). El modo y el acento cambian las variables CSS de esas rampas según los atributos `data-mode` y `data-accent` de `<html>`. En modo día las rampas se invierten (50 ↔ 950), así que una clase pensada para el modo oscuro mantiene el contraste sin reescribir el componente. Para ajustar colores o agregar un acento, edita `scripts/generate-theme-css.mjs` y ejecuta `npm run theme`.

## Puesta en marcha local

Requisitos: Node.js 20+ y acceso a un proyecto de Supabase y a un clúster de MongoDB Atlas.

```bash
npm install
cp .env.example .env      # completar las variables (ver abajo)
npm run dev               # http://localhost:3000
```

### Variables de entorno

Definidas en [.env.example](.env.example):

| Variable | Uso |
|---|---|
| `GEMINI_API_KEY` | Llamadas a Gemini (en AI Studio se inyecta desde Secrets) |
| `APP_URL` | URL pública de la aplicación |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Cliente Supabase en el navegador |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Cliente Supabase en el servidor |
| `SUPABASE_EVIDENCE_BUCKET` | Bucket privado para evidencias de denuncias |
| `MONGODB_URI`, `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_DATABASE` | Conexión a MongoDB (solo servidor; nunca con prefijo `VITE_`) |
| `MONGODB_INCIDENT_EVIDENCE_COLLECTION` | Colección de evidencias |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS`, `HYBRID_WRITE_MAX_RETRIES`, `HYBRID_WRITE_TIMEOUT_MS` | Ajustes de la escritura híbrida |

### Base de datos

1. Aplicar las migraciones de [supabase/migrations/](supabase/migrations/) en el proyecto de Supabase.
2. Preparar MongoDB:

```bash
npm run mongo:ping     # comprueba la conexión
npm run mongo:init     # crea colecciones e índices
npm run mongo:verify   # valida la configuración
```

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo (Express + Vite) |
| `npm run build` | Compila el frontend y empaqueta el servidor en `dist/server.cjs` |
| `npm start` | Ejecuta la compilación de producción |
| `npm run lint` | Verificación de tipos con TypeScript |
| `npm run clean` | Elimina artefactos de compilación |
| `npm run theme` | Regenera `src/theme.css` (modos y acentos) |

## API principal

Todas las rutas están en [server.ts](server.ts) bajo el prefijo `/api`:

- `GET /api/health`: estado del servicio
- `/api/community-reports`: listado, alta, cambio de estado y elevación a incidente (persistencia híbrida)
- `/api/scheduler/*`: estado, disparo manual y modo del planificador satelital
- `/api/ingestion/*`, `/api/s2/*`, `/api/telemetry/*`: ingesta NASA FIRMS, Copernicus Sentinel-1/2 y telemetría
- `/api/webhooks/kobo`, `/api/webhooks/odk`: recepción de formularios de campo
- `/api/corpus/*`: ingesta (PDF, URL, DOI, texto), auditoría y deduplicación del corpus científico
- `/api/rag/vector-search`: búsqueda semántica
- `/api/ai/*`: pool de modelos y analítica predictiva por zona

## Despliegue

Producción corre en **Google AI Studio** en [https://centinela-orinoco-2026.ai.studio/](https://centinela-orinoco-2026.ai.studio/). El flujo es:

1. Commit y push a `main` en GitHub.
2. Sincronizar manualmente el proyecto de AI Studio con `main` y volver a publicar.

Los secretos (`SUPABASE_SERVICE_ROLE_KEY`, `MONGODB_*`, etc.) se configuran únicamente en el panel **Secrets** de AI Studio.

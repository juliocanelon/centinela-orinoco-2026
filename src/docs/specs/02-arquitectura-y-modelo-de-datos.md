# Arquitectura y modelo de datos

## Vista de componentes

```text
React
  |
  | HTTPS + Idempotency-Key
  v
Express API
  |
  +-- HybridIncidentService
       |-- PostgresIncidentRepository --> Supabase/PostgreSQL/PostGIS
       |-- MongoEvidenceRepository ----> MongoDB Atlas
       `-- IntegrationOperationRepository --> PostgreSQL

Supabase Storage <--- archivos binarios
MongoDB ----------> URL, hash y metadatos de esos archivos
```

Ningun componente del navegador debe conocer `MONGODB_URI` ni `SUPABASE_SERVICE_ROLE_KEY`.

## Justificacion de los motores

### PostgreSQL/Supabase

Responsabilidades:

- identidad y ciclo de vida del incidente;
- relaciones entre denuncia, incidente, operador y unidad asignada;
- restricciones, unicidad e integridad referencial;
- geometria PostGIS y consultas territoriales;
- bitacora de las operaciones de integracion.

Propiedades buscadas:

- ACID para cambios operacionales;
- esquema normalizado y restricciones fuertes;
- consistencia inmediata dentro del motor;
- indices B-tree y GiST segun el tipo de consulta.

### MongoDB

Responsabilidades:

- evidencia heterogenea;
- metadatos variables por dispositivo o fuente;
- resultados de modelos y analisis satelital;
- historial de enriquecimientos del documento;
- campos opcionales que evolucionan sin migraciones relacionales frecuentes.

Propiedades buscadas:

- modelo documental con objetos y arreglos anidados;
- lectura de la evidencia de un incidente en un solo documento;
- evolucion controlada mediante `schema_version`.

### CAP y consistencia entre motores

Cada motor mantiene consistencia local. Entre ambos existe una ventana de consistencia eventual durante la operacion y sus reintentos. Ante una particion o indisponibilidad de MongoDB, el sistema prioriza no confirmar una operacion incompleta: registra el fallo y aplica compensacion en PostgreSQL. La disponibilidad total de escritura se sacrifica temporalmente para proteger la consistencia del flujo de negocio.

## Modelo relacional propuesto

Los nombres pueden adaptarse a tablas existentes durante la migracion, pero las restricciones son obligatorias.

### `community_reports`

Campos relevantes:

- `id uuid primary key`
- `code text unique not null`
- `title text not null`
- `category text not null`
- `severity text not null`
- `status text not null`
- `latitude double precision not null`
- `longitude double precision not null`
- `geom geometry(Point, 4326) not null`
- `location_name text not null`
- `community_name text null`
- `description text not null`
- `is_anonymous boolean not null`
- `reporter_name text null`
- `reporter_contact text null`
- `created_at timestamptz not null default now()`
- `linked_incident_id uuid null`

La columna `media_json` existente debe considerarse transitoria. Despues de la migracion, PostgreSQL puede conservar solamente `evidence_count`; el detalle pertenece a MongoDB.

### `incidents`

- `id uuid primary key`
- `code text unique not null`
- `source_report_id uuid unique null references community_reports(id)`
- `title text not null`
- `category text not null`
- `severity text not null`
- `status text not null`
- `latitude double precision not null`
- `longitude double precision not null`
- `geom geometry(Point, 4326) not null`
- `location_name text not null`
- `description text not null`
- `reported_by text not null`
- `assigned_unit text null`
- `evidence_count integer not null default 0 check (evidence_count >= 0)`
- `created_at timestamptz not null default now()`
- `cancelled_at timestamptz null`
- `cancellation_reason text null`

Estados minimos: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CANCELLED`.

### `integration_operations`

- `id uuid primary key`
- `operation_type text not null`
- `idempotency_key text unique not null`
- `request_hash text not null`
- `source_report_id uuid null`
- `incident_id uuid null`
- `status text not null`
- `current_step text not null`
- `attempt_count integer not null default 1`
- `error_code text null`
- `error_summary text null`
- `response_snapshot jsonb null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `completed_at timestamptz null`

Estados permitidos:

- `PENDING`
- `POSTGRES_COMMITTED`
- `COMPLETED`
- `COMPENSATING`
- `COMPENSATED`
- `FAILED_RETRYABLE`
- `FAILED_FINAL`

## Modelo documental propuesto

Coleccion: `incident_evidence`

```json
{
  "_id": "ObjectId",
  "incident_id": "uuid",
  "source_report_id": "uuid",
  "schema_version": 1,
  "created_at": "ISODate",
  "updated_at": "ISODate",
  "evidence": [
    {
      "evidence_id": "uuid",
      "type": "image",
      "storage": {
        "provider": "supabase-storage",
        "bucket": "community-evidence",
        "object_path": "reports/...",
        "content_type": "image/jpeg",
        "size_bytes": 123456,
        "sha256": "hexadecimal"
      },
      "capture": {
        "captured_at": "ISODate",
        "device": "optional",
        "latitude": 4.5,
        "longitude": -66.1
      },
      "tags": ["agua", "mineria"]
    }
  ],
  "satellite_analysis": {
    "mission": "SENTINEL_1_SAR",
    "detections": [],
    "model": {
      "name": "optional",
      "version": "optional",
      "confidence": 0.91
    }
  },
  "ai_enrichments": [
    {
      "type": "classification",
      "generated_at": "ISODate",
      "model": "optional",
      "result": {}
    }
  ],
  "audit": {
    "created_by": "backend",
    "correlation_id": "uuid"
  }
}
```

Restricciones logicas:

- `incident_id` es obligatorio y unico.
- `source_report_id` es obligatorio para el flujo comunitario.
- `schema_version` comienza en `1`.
- No se permiten URI `data:` ni contenido base64 en `evidence.storage.object_path`.
- Fechas se almacenan como tipo fecha, no como texto.

## Indices

PostgreSQL:

```sql
create unique index if not exists incidents_source_report_uq
  on public.incidents (source_report_id)
  where source_report_id is not null;

create index if not exists incidents_created_at_idx
  on public.incidents (created_at desc);

create index if not exists incidents_severity_category_idx
  on public.incidents (severity, category);

create index if not exists incidents_geom_gix
  on public.incidents using gist (geom);

create index if not exists integration_operations_status_updated_idx
  on public.integration_operations (status, updated_at);
```

MongoDB:

```javascript
db.incident_evidence.createIndex({ incident_id: 1 }, { unique: true });
db.incident_evidence.createIndex({ source_report_id: 1 }, { unique: true });
db.incident_evidence.createIndex({ created_at: -1 });
db.incident_evidence.createIndex({ "evidence.type": 1, created_at: -1 });
```

## Variables de entorno

Variables existentes que deben seguir siendo exclusivas del servidor:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Variables nuevas:

- `MONGODB_URI`
- `MONGODB_USERNAME`
- `MONGODB_PASSWORD`
- `MONGODB_DATABASE=centinela_orinoco`
- `MONGODB_INCIDENT_EVIDENCE_COLLECTION=incident_evidence`
- `MONGODB_SERVER_SELECTION_TIMEOUT_MS=15000`
- `HYBRID_WRITE_MAX_RETRIES=3`
- `HYBRID_WRITE_TIMEOUT_MS=5000`

`.env.example` debe contener nombres y valores de ejemplo, nunca secretos reales.

La URI configurada no contiene credenciales. El backend incorpora
`MONGODB_USERNAME` y `MONGODB_PASSWORD` solamente en memoria, codifica los
caracteres reservados y autentica contra `admin`, siguiendo el formato SRV
recomendado por Atlas. La URI autenticada nunca se registra ni se devuelve al
cliente.

## Privacidad y seguridad

- Los datos de contacto del denunciante permanecen en PostgreSQL con acceso restringido y no se copian a MongoDB.
- Los reportes anonimos no deben conservar nombre ni contacto.
- Los logs usan `correlation_id`, `operation_id` e identificadores tecnicos; no incluyen claves, URI completas ni datos personales.
- El usuario de MongoDB debe limitarse a la base y coleccion requeridas.
- Las URLs de objetos privados deben generarse con expiracion al momento de lectura; no se almacenan URLs firmadas permanentes.


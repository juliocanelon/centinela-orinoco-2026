# Plan de implementacion y pruebas

## Fase 0: decisiones bloqueantes

- Confirmar MongoDB Atlas como segundo motor.
- Crear cluster, base de datos y usuario de minimo privilegio.
- Confirmar politica de compensacion logica `CANCELLED`.
- Confirmar si `PENDIENTE_VALIDACION` puede elevarse o requiere validacion previa.

Salida: decisiones registradas en estas especificaciones.

## Fase 1: infraestructura y migraciones

Tareas:

- Agregar el driver oficial `mongodb`.
- Agregar variables nuevas a `.env.example`.
- Crear cliente MongoDB singleton con conexion diferida y cierre ordenado.
- Crear migracion SQL para `incidents` e `integration_operations`, o adaptar las tablas existentes conservando las restricciones requeridas.
- Crear indices MongoDB de forma idempotente.
- Agregar health checks separados por motor.

Criterios de salida:

- El servidor inicia sin MongoDB solo si funciona en modo de desarrollo degradado expresamente configurado.
- El endpoint de salud distingue `postgres`, `mongodb` y el estado global.
- Las migraciones pueden ejecutarse mas de una vez sin duplicar objetos.

## Fase 2: capa de repositorios

Archivos sugeridos:

```text
server/db/mongoClient.ts
server/repositories/postgresIncidentRepository.ts
server/repositories/mongoEvidenceRepository.ts
server/repositories/integrationOperationRepository.ts
server/services/hybridIncidentService.ts
server/types/persistence.ts
```

Tareas:

- Extraer la persistencia fuera de `server.ts`.
- Implementar interfaces y errores tipados.
- Validar documentos antes de insertarlos.
- Implementar consultas por lote para reportes.

Criterios de salida:

- Los servicios no importan el cliente React.
- Los repositorios pueden probarse de forma aislada.
- Ningun repositorio absorbe errores silenciosamente.

## Fase 3: saga de elevacion

Tareas:

- Implementar la maquina de estados de `integration_operations`.
- Implementar transaccion PostgreSQL para denuncia, incidente y operacion.
- Implementar escritura idempotente en MongoDB.
- Implementar reintentos clasificados y compensacion.
- Reemplazar el endpoint actual de elevacion.
- Hacer que React espere la respuesta antes de mutar su estado local.

Criterios de salida:

- La interfaz no crea localmente un incidente antes de la confirmacion del backend.
- Los errores presentan un mensaje recuperable y no alteran el estado visual como si hubiese exito.
- Todos los escenarios P0 tienen pruebas automatizadas.

## Fase 4: consulta y reconciliacion

Tareas:

- Implementar detalle enriquecido.
- Implementar reporte consolidado paginado.
- Implementar diagnostico de reconciliacion por lotes.
- Agregar mediciones de tiempo por motor.

Criterios de salida:

- No existe patron N+1 hacia MongoDB.
- El reporte indica datos faltantes en vez de ocultarlos.
- La reconciliacion no modifica datos.

## Fase 5: notebook y documentacion

Tareas:

- Crear notebook Colab segun la especificacion.
- Incluir datos sinteticos y limpieza acotada.
- Ejecutar todas las celdas en una sesion limpia.
- Exportar una copia sin secretos.
- Actualizar el informe tecnico para que coincida con el codigo real.

Criterios de salida:

- El notebook conserva las salidas necesarias para evaluacion.
- No contiene claves ni valores de `.env.local`.
- Las afirmaciones sobre modelos, reintentos y motores coinciden con la implementacion.

## Estrategia de pruebas

### Pruebas unitarias

- Canonicalizacion y hash de solicitudes.
- Validacion de transiciones de estado.
- Clasificacion de errores transitorios y permanentes.
- Construccion del documento MongoDB.
- Sanitizacion de errores y logs.
- Union lineal de resultados del reporte.

### Pruebas de integracion

- Crear incidente y documento asociados.
- Repetir la misma solicitud.
- Reutilizar una clave con otro cuerpo.
- Fallar PostgreSQL antes del commit.
- Fallar MongoDB despues del commit PostgreSQL.
- Fallar durante la compensacion.
- Ejecutar dos solicitudes concurrentes para la misma denuncia.
- Consultar reporte con incidentes sin evidencia.
- Detectar documento huerfano.

### Matriz minima

| Escenario | Incidente SQL | Documento Mongo | Operacion final | HTTP |
|---|---|---|---|---|
| Exito | IN_PROGRESS | existe | COMPLETED | 201 |
| Repeticion identica | uno | uno | COMPLETED | 200 |
| Clave conflictiva | sin cambio | sin cambio | sin cambio | 409 |
| Falla PostgreSQL | ausente | ausente | FAILED_RETRYABLE o FAILED_FINAL | 503/500 |
| Falla MongoDB compensada | CANCELLED | ausente | COMPENSATED | 503 |
| Falla compensacion | estado verificable | ausente | FAILED_FINAL | 500 |
| Solicitudes concurrentes | uno | uno | una operacion efectiva | 200/201/409 |

## Criterios no funcionales

- Timeout configurable por dependencia.
- Ninguna respuesta expone detalles de conexion.
- El servicio se recupera de una desconexion temporal de MongoDB sin reiniciar el proceso.
- Las consultas de reporte usan indices verificables mediante planes de ejecucion durante la prueba tecnica.
- Cobertura obligatoria del servicio de saga y sus ramas de compensacion.

## Riesgos y mitigaciones

### Cliente Supabase sin transaccion multioperacion

Riesgo: varias llamadas REST independientes no ofrecen una transaccion unica.

Mitigacion: implementar una funcion PostgreSQL/RPC que ejecute atomicamente el paso relacional, o utilizar una conexion PostgreSQL de servidor exclusivamente para esta operacion.

### Codigos generados por conteo o tiempo

Riesgo: colisiones bajo concurrencia.

Mitigacion: UUID como identidad y secuencia o funcion SQL para el codigo legible.

### Evidencia actual en URL `data:`

Riesgo: documentos demasiado grandes y duplicacion de binarios.

Mitigacion: migrar los binarios a Supabase Storage antes de persistir el documento MongoDB.

### Divergencia entre documentacion y codigo

Riesgo: el informe declare comportamientos que no existen.

Mitigacion: generar la demostracion desde pruebas ejecutables y actualizar el informe al cerrar cada fase.

## Definicion de terminado

La funcionalidad se considera terminada cuando:

- todas las decisiones bloqueantes estan resueltas;
- migraciones e indices estan versionados;
- el flujo de elevacion usa ambos motores;
- idempotencia y compensacion estan probadas;
- reconciliacion y reporte funcionan por lotes;
- secretos no aparecen en Git ni en el notebook;
- el notebook se ejecuta de principio a fin;
- lint, build y pruebas pasan;
- la documentacion coincide con el comportamiento observado.


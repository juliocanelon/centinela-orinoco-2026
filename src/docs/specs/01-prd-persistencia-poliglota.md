# PRD: persistencia poliglota para incidentes comunitarios

## Resumen

Centinela Orinoco utiliza Supabase/PostgreSQL para informacion relacional, espacial y vectorial, pero actualmente no demuestra persistencia en motores distintos. Los reportes comunitarios se mantienen en memoria y su sincronizacion con Supabase no controla de forma verificable los fallos; la elevacion a incidente construye una respuesta, pero no garantiza una escritura durable.

La primera version agregara MongoDB como almacenamiento documental y convertira la elevacion de una denuncia comunitaria en una operacion hibrida trazable entre PostgreSQL y MongoDB.

## Problema

El sistema recibe denuncias y evidencias cuya estructura puede cambiar por fuente, dispositivo o tipo de analisis. Forzar todo ese contenido a tablas relacionales aumenta la rigidez, mientras que almacenar en memoria no ofrece durabilidad ni consistencia. Sin un mecanismo de coordinacion entre motores, un fallo parcial puede dejar incidentes sin evidencia o documentos sin incidente asociado.

## Usuarios objetivo

- Operador ambiental que valida denuncias y las convierte en incidentes.
- Analista que consulta evidencia y resultados consolidados.
- Equipo tecnico o evaluador que necesita comprobar la separacion de motores, los fallos controlados y la trazabilidad.

## Objetivos

1. Persistir el 100 % de los incidentes confirmados en PostgreSQL y su documento asociado en MongoDB, o dejar una operacion fallida y compensada que pueda auditarse.
2. Evitar duplicados cuando una solicitud se reintente con la misma clave de idempotencia.
3. Detectar automaticamente documentos huerfanos o incidentes sin documento asociado.
4. Generar un reporte consolidado por rango de fechas sin descargar colecciones completas.
5. Proporcionar un notebook Colab ejecutable de inicio a fin que demuestre el caso exitoso y los fallos parciales.

## No objetivos de la version 1

- Migrar telemetria, limites territoriales o catalogos completos a MongoDB.
- Guardar imagenes, videos o PDF como base64 en MongoDB.
- Implementar una transaccion distribuida de dos fases entre PostgreSQL y MongoDB.
- Reemplazar PostGIS, pgvector o las RPC existentes de Supabase.
- Implementar Kafka, RabbitMQ u otra infraestructura de mensajeria externa.
- Exponer MongoDB directamente al navegador.

## Historias de usuario

### Operador ambiental

- Como operador, quiero elevar una denuncia validada a incidente para que el evento quede registrado con su evidencia completa.
- Como operador, quiero recibir un resultado inequívoco cuando falle una parte de la operacion para no asumir que el incidente fue publicado.
- Como operador, quiero poder reintentar una solicitud sin crear duplicados.

### Analista

- Como analista, quiero consultar incidentes con sus tipos y cantidad de evidencias para elaborar reportes por zona y severidad.
- Como analista, quiero identificar registros incompletos para solicitar su reparacion.

### Evaluador tecnico

- Como evaluador, quiero ejecutar pruebas controladas de exito y fallo para comprobar la compensacion entre motores.
- Como evaluador, quiero ver una justificacion CAP/ACID/BASE y modelos de datos propios de cada motor.

## Requisitos P0

### P0.1 Separacion real de persistencia

PostgreSQL debe almacenar el estado operacional y MongoDB debe almacenar el documento de evidencia enriquecida.

Criterios de aceptacion:

- Dado un incidente creado correctamente, cuando se inspeccionan ambos motores, existe el mismo `incident_id` en los dos.
- El documento MongoDB contiene objetos o arreglos anidados que no duplican el modelo tabular completo.
- La aplicacion funciona sin entregar credenciales de MongoDB al cliente React.

### P0.2 Operacion hibrida compensable

La elevacion de denuncia debe ser orquestada por el backend como una saga corta.

Criterios de aceptacion:

- Si ambas escrituras funcionan, la operacion termina en `COMPLETED`.
- Si MongoDB falla despues de crear el incidente, el incidente se elimina o queda marcado como `CANCELLED` de acuerdo con la politica definida en la especificacion tecnica.
- Si PostgreSQL falla, MongoDB no recibe el documento.
- Todo fallo genera un registro de operacion sin incluir secretos ni datos personales completos.

### P0.3 Idempotencia

Criterios de aceptacion:

- Dos solicitudes con la misma clave y el mismo cuerpo devuelven el mismo resultado.
- La misma clave con un cuerpo diferente devuelve HTTP `409`.
- No existe mas de un incidente ni mas de un documento por clave logica.

### P0.4 Reconciliacion

Criterios de aceptacion:

- Existe una operacion de diagnostico que detecta incidentes sin documento y documentos sin incidente.
- La consulta trabaja por lotes y por ventana temporal.
- La reparacion automatica no se ejecuta como efecto secundario de una consulta de lectura.

### P0.5 Reporte consolidado

Criterios de aceptacion:

- Acepta fechas `from` y `to` validas.
- Devuelve totales por severidad, categoria, ubicacion y tipo de evidencia.
- Consulta MongoDB solamente por los identificadores obtenidos en PostgreSQL y no mediante un escaneo completo.

## Requisitos P1

- Reintentos automaticos con espera exponencial para fallos transitorios de MongoDB.
- Panel administrativo para visualizar operaciones incompletas.
- Exportacion CSV del reporte consolidado.
- Metrica de latencia por motor y contador de compensaciones.

## Consideraciones P2

- Patron transactional outbox y worker independiente.
- Cola de mensajes durable para alto volumen.
- Change streams de MongoDB para analitica reactiva.
- Replica de lectura o almacen analitico dedicado.

## Metricas de exito

### Indicadores inmediatos

- 100 % de las pruebas del camino exitoso conservan correlacion entre motores.
- 0 duplicados en 100 reintentos con la misma clave de idempotencia.
- 100 % de los fallos inyectados terminan en un estado auditable.
- Reporte de demostracion generado en menos de 5 segundos con 10 000 incidentes sinteticos.

### Indicadores posteriores

- Menos de 0,1 % de operaciones en estado incompleto por mas de 15 minutos.
- 100 % de discrepancias detectadas por el proceso de reconciliacion diario.

## Dependencias

- Proyecto Supabase existente y migraciones habilitadas.
- Cluster MongoDB Atlas y cadena de conexion disponible como secreto.
- Politica CORS y acceso de red de Atlas configurados para el entorno del backend.
- Datos sinteticos sin informacion personal real para las pruebas y el notebook.

## Preguntas abiertas

- Bloqueante, equipo: ¿la compensacion debe borrar fisicamente el incidente o conservarlo como `CANCELLED` para auditoria? La recomendacion es conservarlo como `CANCELLED`.
- Bloqueante, equipo: ¿se utilizara el plan gratuito de MongoDB Atlas o una instancia institucional?
- No bloqueante, producto: ¿el reporte consolidado se mostrara en la interfaz o solo en Colab durante la primera entrega?
- No bloqueante, seguridad: ¿por cuanto tiempo deben conservarse los datos de contacto del denunciante?


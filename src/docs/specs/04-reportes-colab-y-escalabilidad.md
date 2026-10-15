# Reportes, Google Colab y escalabilidad

## Objetivo del reporte consolidado

Demostrar que los datos operacionales de PostgreSQL pueden combinarse con la evidencia documental de MongoDB sin realizar una referencia manual ni un escaneo completo. La clave de union es `incident_id`.

## Estrategia de consulta

1. PostgreSQL filtra el rango temporal, estado y atributos relacionales.
2. El servicio extrae los identificadores de la pagina actual.
3. MongoDB recibe una consulta `{ incident_id: { $in: ids } }` con proyeccion limitada.
4. El backend construye un mapa por `incident_id` y une los resultados en tiempo lineal.
5. Las agregaciones documentales por tipo de evidencia se realizan en MongoDB con pipeline `$match`, `$unwind` y `$group`.

No permitido:

- descargar toda la coleccion MongoDB;
- ejecutar una consulta MongoDB por cada incidente;
- cruzar por titulo, fecha aproximada o texto libre;
- usar capturas de pantalla como unica evidencia del reporte.

## Escalabilidad

### Version inicial

- paginacion por cursor;
- lotes maximos de 1000 identificadores;
- proyecciones de campos;
- indices definidos en el modelo de datos;
- timeout por consulta;
- limite maximo del rango temporal.

### Evolucion para millones de registros

- tabla de resumen diario o vista materializada en PostgreSQL;
- agregados documentales incrementales por fecha y tipo;
- transactional outbox para desacoplar enriquecimientos;
- cola durable con consumidor idempotente;
- cache de reportes cerrados;
- almacen analitico dedicado si las consultas dejan de ser operacionales.

La aplicacion no debe introducir una cola externa en la primera version; basta con documentar la ruta de evolucion.

## Especificacion del notebook Colab

Nombre sugerido:

`Centinela_Orinoco_Persistencia_Poliglota.ipynb`

Ubicacion en el repositorio:

`notebooks/Centinela_Orinoco_Persistencia_Poliglota.ipynb`

### Requisitos de calidad

- Ejecutable de arriba abajo en una sesion limpia.
- Python conforme con PEP 8.
- Funciones pequenas, docstrings y tipos cuando aporten claridad.
- Configuracion centralizada.
- Markdown antes de cada bloque tecnico.
- Salidas breves y reproducibles.
- Ningun secreto, URI o token dentro del archivo versionado.

### Secretos de Colab

El notebook leera mediante `google.colab.userdata.get`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MONGODB_URI`
- `MONGODB_DATABASE`

Si no se ejecuta dentro de Colab, podra usar variables de entorno con los mismos nombres. Nunca debe leer ni subir `.env.local` desde el equipo del estudiante.

### Secciones obligatorias

1. Portada, autores, asignatura y objetivo.
2. Arquitectura de persistencia poliglota.
3. Justificacion CAP, ACID y BASE.
4. Instalacion e importaciones.
5. Carga segura de configuracion.
6. Verificacion de conexiones sin revelar secretos.
7. Presentacion del modelo relacional normalizado.
8. Presentacion del documento MongoDB.
9. Generacion de datos sinteticos identificables por `demo_run_id`.
10. Demostracion del camino exitoso.
11. Repeticion idempotente.
12. Fallo antes de PostgreSQL.
13. Fallo simulado de MongoDB y verificacion de compensacion.
14. Deteccion de huerfanos.
15. Reporte consolidado con `pandas`.
16. Grafico por severidad y tipo de evidencia.
17. Analisis de escalabilidad.
18. Limpieza opcional de los datos de demostracion.
19. Conclusiones y bibliografia APA.

## Inyeccion segura de fallos

El backend aceptara inyeccion de fallos solamente cuando:

- `NODE_ENV` no sea `production`;
- `ENABLE_FAILURE_INJECTION=true`;
- la solicitud incluya un secreto de prueba o se ejecute en pruebas automatizadas.

Modos minimos:

- `before_postgres`
- `after_postgres_before_mongo`
- `mongo_timeout`
- `during_compensation`

La interfaz publica nunca mostrara controles de inyeccion de fallos.

## Datos sinteticos y limpieza

- Cada fila y documento de demostracion incluye `demo_run_id`.
- Los datos no contienen nombres, telefonos ni ubicaciones personales reales.
- La limpieza filtra por `demo_run_id`; nunca elimina tablas, colecciones ni rangos generales.
- La celda de limpieza pide confirmacion explicita dentro del notebook y muestra el numero de registros objetivo antes de borrarlos.

## Resultados esperados del notebook

Al terminar, debe mostrar una tabla de verificacion semejante a:

| Prueba | PostgreSQL | MongoDB | Operacion | Resultado |
|---|---|---|---|---|
| Camino exitoso | activo | documento | COMPLETED | aprobado |
| Reintento | uno | uno | COMPLETED | sin duplicados |
| Fallo MongoDB | CANCELLED | ausente | COMPENSATED | aprobado |
| Reconciliacion | evaluado | evaluado | n/a | discrepancias listadas |

## Bibliografia y citas

El informe y el notebook deben citar documentacion oficial de PostgreSQL, MongoDB, Supabase y Google Colab. Las referencias se presentaran en formato APA y toda afirmacion sobre garantias transaccionales o consistencia debe vincularse con su fuente.


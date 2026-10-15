# Especificaciones de persistencia poliglota

Estado: propuesta para implementacion  
Fecha: 2026-10-14  
Proyecto: Centinela Orinoco

## Proposito

Esta carpeta define la incorporacion de MongoDB como segundo motor de persistencia junto con Supabase/PostgreSQL. El objetivo es demostrar una separacion justificable de responsabilidades, una operacion hibrida robusta y un reporte que combine ambos motores.

## Decisiones principales

- PostgreSQL/Supabase sera la fuente de verdad de los datos operacionales y geoespaciales.
- MongoDB almacenara documentos variables: evidencia, metadatos de captura, analisis satelital y resultados de IA.
- Los archivos binarios permaneceran en Supabase Storage; MongoDB guardara referencias y metadatos, no archivos en base64.
- Ambos motores compartiran identificadores UUID generados por el backend.
- No se intentara una transaccion distribuida ACID. Se utilizara una saga con compensacion, idempotencia y reconciliacion.
- La primera implementacion cubrira el flujo de elevacion de una denuncia comunitaria a incidente.

## Documentos

1. [01-prd-persistencia-poliglota.md](./01-prd-persistencia-poliglota.md): problema, alcance, historias y resultados esperados.
2. [02-arquitectura-y-modelo-de-datos.md](./02-arquitectura-y-modelo-de-datos.md): responsabilidades de cada motor, esquemas e indices.
3. [03-api-y-orquestacion-hibrida.md](./03-api-y-orquestacion-hibrida.md): contratos HTTP, estados, compensacion e idempotencia.
4. [04-reportes-colab-y-escalabilidad.md](./04-reportes-colab-y-escalabilidad.md): reporte consolidado y evidencia para Google Colab.
5. [05-plan-de-implementacion-y-pruebas.md](./05-plan-de-implementacion-y-pruebas.md): fases, tareas, pruebas y definicion de terminado.

## Orden recomendado de implementacion

1. Configuracion, clientes de base de datos y migraciones.
2. Repositorios PostgreSQL y MongoDB.
3. Servicio de saga e idempotencia.
4. Endpoints y adaptacion de la interfaz.
5. Reconciliacion y reporte consolidado.
6. Pruebas de fallos.
7. Notebook de Google Colab e informe tecnico.

## Supuestos

- Las credenciales actuales de Supabase permanecen en `.env.local` y no se versionan.
- Se creara una instancia MongoDB Atlas para desarrollo y demostracion.
- La primera version es academica y de alcance controlado; no pretende migrar todos los modulos existentes a MongoDB.
- Los nombres fisicos definitivos de tablas existentes se validaran durante la migracion inicial.


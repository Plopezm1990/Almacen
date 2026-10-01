# F2.7 — estado del paquete de preparación

Fecha: 2026-10-01  
Estado: `PREPARADO_BLOQUEADO_POR_HERRAMIENTA_LOCAL`  
Base: `origin/release` `7859508`

## Subpuntos completados

| Subpunto | Resultado |
|---|---|
| F2.1 contrato transaccional | preparado y validado estáticamente |
| F2.2 dependencias de release | inventariadas sobre la base exacta |
| F2.3 verificación local | contrato preparado; PGlite auxiliar PASS |
| F2.4 precheck de migración | bloqueado honestamente por CLI/Docker/psql |
| F2.5 puerta de revisión | checklist preparado y bloqueado |
| F2.6 manifiesto/recuperación | plantilla preparada, candidato aún inexistente |

## Validaciones realizadas

- Contratos F2 pasan.
- PGlite pasa la regresión auxiliar disponible.
- Docker CLI no está disponible.
- `psql` no está disponible.
- Supabase CLI no está disponible.
- No se ejecutó SQL remoto.
- QA y PROD no se contactaron.
- No se creó migración candidata inventada.
- No se hizo merge ni deploy.

## Bloqueo exacto

Para cerrar F2.7 como candidato aplicable faltan:

1. Supabase CLI para generar la migración con nombre válido.
2. PostgreSQL local para PG01–PG12 y dos conexiones reales.
3. Revisión de advisors, RLS, ACL y Data API.
4. SHA/hash del candidato y manifest final.
5. Autorización específica del entorno cuando todo lo anterior esté verde.

## Decisión de avance

El paquete puede permanecer preparado mientras se decide cómo habilitar las
herramientas locales. No se debe saltar directamente a QA/PROD ni presentar
PGlite como prueba PostgreSQL. B12 continúa separado y bloqueado por proveedor;
no impide conservar este estado de F2.

## Resultado de F2.7

F2 queda preparado documentalmente, no cerrado para aplicación. El siguiente
paso operativo es habilitar CLI/PostgreSQL local y repetir PG01–PG12; después se
podrá generar y revisar la migración candidata.

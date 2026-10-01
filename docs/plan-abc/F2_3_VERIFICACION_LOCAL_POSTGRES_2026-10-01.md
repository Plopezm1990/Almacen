# F2.3 — contrato de verificación local PostgreSQL

Fecha: 2026-10-01  
Estado: `PREPARADO_NO_EJECUTADO`  
Base: F2.1–F2.2 y `origin/release` `7859508`

Este contrato define cómo verificar el candidato en una base local desechable.
No autoriza conexiones ni escrituras en QA/PROD.

## Preparación aislada

1. Usar PostgreSQL local compatible con las versiones soportadas por el
   proyecto y una base UTF-8 creada desde `template0`.
2. Usar un puerto/base/usuario de prueba dedicados y datos ficticios.
3. Aplicar únicamente la cadena de migraciones del candidato en orden.
4. Registrar versión de PostgreSQL, SHA del repositorio y lista de migraciones.
5. Destruir o aislar la base temporal al terminar, conservando solo logs sin
   secretos.

Variables esperadas: `F2_PG_PORT`, `F2_PG_DATABASE`, `F2_PG_USER` y
`F2_PG_PASSWORD` en el entorno local, nunca en el repositorio ni en el chat.

## Verificaciones mínimas

| ID | Verificación | Resultado exigido | Estado |
|---|---|---|---|
| PG01 | migraciones en orden | todas aplican una vez | `PENDIENTE` |
| PG02 | tablas y columnas | coinciden con dependencias | `PENDIENTE` |
| PG03 | funciones y firmas | RPC esperadas presentes | `PENDIENTE` |
| PG04 | RLS | tablas expuestas protegidas | `PENDIENTE` |
| PG05 | ACL | `anon`/`authenticated`/`service_role` según contrato | `PENDIENTE` |
| PG06 | aislamiento | otra empresa/local no es visible | `PENDIENTE` |
| PG07 | idempotencia | replay igual devuelve resultado original | `PENDIENTE` |
| PG08 | conflicto | replay distinto no muta ni duplica | `PENDIENTE` |
| PG09 | concurrencia | dos conexiones tienen un único ganador | `PENDIENTE` |
| PG10 | resultado desconocido | reserva e incidencia permanecen | `PENDIENTE` |
| PG11 | rollback | fallo no deja efectos parciales | `PENDIENTE` |
| PG12 | reconstrucción | repetir desde base vacía produce mismo esquema | `PENDIENTE` |

## Seguridad y observabilidad

- Revisar `search_path`, `SECURITY DEFINER`, grants y funciones expuestas.
- No usar `service_role` desde cliente ni guardar secretos en logs.
- Comprobar `WITH CHECK` en actualizaciones RLS y la pertenencia a empresa/local.
- Registrar errores técnicos sin payloads sensibles.
- Si una verificación falla, conservar el resultado y detener la promoción; no
  compensar con cambios manuales en QA/PROD.

## Evidencia requerida

La acta debe contener SHA, versión PG, migraciones, consultas, datos ficticios,
resultado por PG01–PG12, logs sanitizados y decisión de continuar. Un contrato
estático o un build verde no sustituye esta evidencia.

## Resultado de F2.3

La verificación local queda preparada. La ejecución real requiere un entorno
PostgreSQL local disponible y una orden explícita para gastar recursos locales;
continúa prohibido aplicar cambios en QA/PROD o hacer deploy de Netlify.

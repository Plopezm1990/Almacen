# F2.4 — precheck de migración candidata

Fecha: 2026-10-01  
Estado: `BLOQUEADO_HERRAMIENTA_LOCAL`  
Base: `origin/release` `7859508`

## Diagnóstico

- Supabase CLI no está disponible en el PATH de este entorno.
- Docker CLI y `psql` tampoco están disponibles.
- No se ha creado una migración nueva con nombre inventado.
- No se ha ejecutado `supabase db push`, `apply_migration` ni ninguna escritura
  remota.

## Precheck requerido cuando la herramienta esté disponible

| Paso | Comprobación | Estado |
|---|---|---|
| 1 | `supabase --version` y compatibilidad | `BLOQUEADO` |
| 2 | `supabase migration new <nombre-descriptivo>` | `BLOQUEADO` |
| 3 | revisar dependencias y SQL generado | `PENDIENTE` |
| 4 | prueba local UTF-8 | `BLOQUEADO` |
| 5 | advisors y revisión RLS/ACL | `PENDIENTE` |
| 6 | contrato PG01–PG12 | `BLOQUEADO` |
| 7 | hash, manifiesto y plan de reversión | `PENDIENTE` |
| 8 | autorización separada de QA/PROD | `PENDIENTE` |

El nombre de la migración debe describir el alcance real y generarse mediante la
CLI, no escribirse a mano. Si el cambio no está definido, el resultado correcto
es seguir en precheck y no crear SQL vacío.

## Condiciones de seguridad

- La migración debe ser aditiva y compatible con clientes existentes.
- Debe conservar hechos históricos; nunca borrar o reescribir pagos, documentos
  o movimientos como mecanismo de corrección.
- Toda tabla `public` nueva necesita RLS, políticas, grants y revisión de Data
  API explícitos.
- Toda función privilegiada debe justificar su modo de seguridad, `search_path`
  y ACL; no se añade `SECURITY DEFINER` para ocultar un fallo de permisos.
- La reversión se diseña como compensación segura y no como borrado ciego.

## Resultado de F2.4

El precheck queda documentado y honestamente bloqueado por herramientas locales.
La preparación puede continuar con revisión documental, pero no corresponde
crear ni aplicar una migración hasta disponer de la CLI, PostgreSQL local y una
autorización específica para el entorno destino.

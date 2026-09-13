# PM27 — C11 Aislamiento multilocal

Fecha: 2026-09-13

Candidato auditado: `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`
Rama de evidencia: `claude/pm27-auditoria-25-casos`

## Objetivo

Certificar que un usuario con autorización limitada a un local puede operar en ese local, pero no en otro local de la misma empresa; y que una autorización explícita `todos_locales=true` sí permite operar en varios locales de la empresa.

## Estado vivo verificado en producción — solo lectura

Se consultaron únicamente metadatos y agregados, sin crear ni modificar filas.

- Las políticas actuales de `prefiltros_candidatos` para SELECT/INSERT/DELETE exigen `private.la_tiene_local(empresa_id, local_id)` además del rol Propietario activo.
- `movimientos_stock`, `stock_operaciones` y `stock_ubicacion` también restringen lectura mediante `private.la_tiene_local(empresa_id, local_id)`.
- El helper real `private.la_tiene_local` exige identidad activa, empresa y local no vacíos, rechaza `TODOS` como local concreto y requiere una membresía activa de la misma empresa que tenga `todos_locales=true` o exactamente `local_id=p_local`.
- Hoy ninguna empresa de producción tiene dos o más locales activos; el máximo observado es 1. Por tanto no existe un par de locales reales de la misma empresa sobre el que ejecutar honestamente una negativa multilocal sin fabricar datos. No se fabricaron usuarios, membresías ni locales.

## Prueba aislada del candidato exacto

El candidato contiene una batería PostgreSQL totalmente sintética:

- Usuario `111...`: Propietario de `EMPRESA_A` con `todos_locales=true`.
- Usuario `222...`: Propietario de `EMPRESA_A` limitado exclusivamente a `LOCAL_A1`.
- Existen `LOCAL_A1` y `LOCAL_A2` dentro de la misma empresa sintética.

Casos relevantes de `tests/pm26/p08-defecto-l-produccion/comportamiento.sql`:

1. `P2`: el propietario con `todos_locales=true` puede crear en `LOCAL_A2` — autorización amplia válida.
2. `P3`: el propietario limitado a `LOCAL_A1` puede crear en su propio local — positivo de alcance.
3. `N4`: ese mismo propietario intenta crear en `LOCAL_A2` de la misma empresa y el INSERT debe ser rechazado por RLS.
4. `P11`: el propietario limitado puede borrar su propia fila en `LOCAL_A1`.
5. `N12`: intenta borrar una fila de `LOCAL_A2`; RLS hace que afecte 0 filas.
6. `N12_SIN_RESIDUO_BORRADO`: confirma después, con una identidad autorizada, que la fila de `LOCAL_A2` sigue existiendo.

`tests/pm26/p08-defecto-l-produccion/validar.sh` exige explícitamente que pasen todos esos marcadores (`P2`, `P3`, `N4`, `P11`, `N12`, `N12_SIN_RESIDUO_BORRADO`) y falla si aparece cualquier `=FAIL`.

El gate remoto final del candidato, run `34765942761`, job `103746795855`, ejecutó el contrato P08b sobre PostgreSQL local aislado y terminó con:

`PM26_P08_BATERIA_CASOS=PASS`

El mismo gate terminó `SUCCESS` sobre el SHA exacto del candidato.

## Conclusión

La autorización distingue correctamente entre:

- mismo local autorizado -> permitido;
- otro local de la misma empresa sin permiso -> bloqueado;
- membresía explícita `todos_locales=true` -> acceso multilocal permitido.

No hubo escrituras en Supabase, no se tocaron usuarios reales, `main`, `release`, PR #38 ni Netlify.

PM27_C11_LOCAL_PROPIO_PERMITIDO=PASS
PM27_C11_LOCAL_MISMA_EMPRESA_NO_AUTORIZADO_BLOQUEADO=PASS
PM27_C11_TODOS_LOCALES_EXPLICITO_PERMITIDO=PASS
PM27_C11_SIN_RESIDUO_EN_NEGATIVA=PASS
PM27_C11_RESULTADO=PASS

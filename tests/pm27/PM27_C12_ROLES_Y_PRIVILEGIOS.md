# PM27 — C12 Roles y privilegios

Estado: **PASS**

Candidato auditado e inmutable: `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`.

## Objetivo

Comprobar que estar autenticado no basta para operar: las superficies protegidas deben aplicar rol efectivo, perfil activo y, cuando corresponde, contexto empresa/local; una identidad con rol insuficiente o inactiva no debe heredar privilegios de gestión.

## Evidencia viva de producción — solo lectura

Se consultó el proyecto de producción real `flqercbgpgmmfaakrwkc` sin realizar escrituras.

- `public.perfiles` tiene actualmente perfiles activos de los roles `Propietario` y `Encargado`; no se modificó ninguno.
- Las políticas RLS reales de `public.almacen_kv` no son un simple `TO authenticated`: discriminan por `perfiles.user_id = auth.uid()`, `p.activo = true` y por rol según la clave.
- La matriz real distingue al menos:
  - claves básicas accesibles a cualquier perfil activo;
  - claves de gestión para `Propietario`/`Encargado`;
  - claves de caja para `Cajero/a`;
  - claves operativas para `Churrero/a`;
  - claves sensibles exclusivas de `Propietario`.
- La política UPDATE de `almacen_kv` aplica la misma matriz tanto en `USING` como en `WITH CHECK`, evitando que una fila autorizada pueda convertirse mediante UPDATE en una clave fuera del rol permitido.
- `fichajes_registro` diferencia privilegios: corrección para `Propietario`/`Encargado`, borrado solo `Propietario`, y lectura/inserción propia para el empleado cuando coincide su `empleado_id`.
- `prefiltros_candidatos` en producción exige explícitamente perfil activo `Propietario` además de `private.la_tiene_local(empresa_id, local_id)` para SELECT/INSERT/DELETE.
- Los helpers reales `private.la_usuario_activo()` y `private.la_tiene_local()` exigen identidad no nula, membresía activa y bloquean perfiles inactivos; `la_tiene_local` exige además empresa/local y membresía correspondiente.

No se fabricaron perfiles `Cajero/a` ni `Churrero/a` en producción para obtener positivos conductuales: eso habría violado la regla de no alterar usuarios/datos reales. Su presencia en la matriz RLS se verificó por definición de política real.

## Evidencia reversible del candidato

El candidato contiene la batería aislada `tests/pm26/p06h-f-aislado/comportamiento.sql`, ejecutada como rol PostgreSQL `authenticated`, con fixtures totalmente sintéticos.

Casos relevantes:

- P1/P2: `Propietario` autorizado.
- P3/P11: `Encargado` autorizado en su propio contexto.
- N4: `Encargado` bloqueado fuera de su local.
- N5: `Propietario` bloqueado fuera de su empresa.
- N6: rol `Básico` bloqueado para operación de gestión.
- N7: identidad ausente bloqueada.
- N14/N15: INSERT/DELETE directo bloqueado; la mutación QA queda obligada a pasar por las RPC autorizativas.

El contrato `tests/pm26/p06h-contract.mjs` exige que la batería contenga los 15 casos, que se ejecute realmente como `authenticated` y que `validar.sh` termine con los marcadores de permisos y ACL en PASS. El run remoto exacto del candidato `34765942761` / job `103746795855` terminó `SUCCESS` y reejecutó P06h en verde.

La variante de producción del Defecto L tiene una política distinta y deliberadamente más restrictiva: `prefiltros_candidatos` permite únicamente `Propietario`, y la batería P08 confirma que un `Encargado` no puede crear allí. No se confunde ese contrato de producción con la variante QA basada en `Propietario/Encargado`.

## Conclusión

La autorización observada no depende solo de autenticación. Existe separación efectiva por rol, estado activo e, cuando aplica, empresa/local, con controles negativos reproducibles para rol insuficiente y bypass directo.

No se detectó en C12 una elevación de privilegios por rol.

Marcadores:

`PM27_C12_MATRIZ_ROLES_PRODUCCION=PASS`

`PM27_C12_PERFIL_ACTIVO_REQUERIDO=PASS`

`PM27_C12_ROL_INSUFICIENTE_BLOQUEADO=PASS`

`PM27_C12_BYPASS_DIRECTO_BLOQUEADO_QA=PASS`

`PM27_C12_RESULTADO=PASS`

## Límites

C12 no certifica todavía la seguridad interna de todas las funciones `SECURITY DEFINER`; eso corresponde a C13. Tampoco crea usuarios o datos reales para probar roles hoy ausentes en producción.

No se modificaron `main`, `release`, PR #38, Netlify, Supabase ni datos reales.
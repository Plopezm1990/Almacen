# PM27 — C10: RLS multiempresa

Fecha: 2026-09-13
Repositorio: `Plopezm1990/Almacen`
Candidato auditado: `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`

## Resultado

**PASS**

C10 verifica el aislamiento multiempresa combinando tres capas independientes: estado vivo de RLS en producción en solo lectura, definición viva del helper de autorización empresa/local y control negativo reversible ejecutado sobre el SHA exacto del candidato en PostgreSQL aislado.

No se creó ni modificó ningún usuario, membresía, empresa, local ni fila de negocio en producción.

## 1. Candidato congelado

Antes de la comprobación se releyó la referencia remota `claude/pm27-reauditoria-candidato` y continuaba exactamente en:

`8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`

No se modificó el candidato.

## 2. Estado vivo de RLS en producción — solo lectura

La inspección del catálogo PostgreSQL confirmó `relrowsecurity = true` en las tablas públicas relevantes.

En las superficies con contexto explícito `empresa_id` / `local_id`:

- `movimientos_stock`: política SELECT `pm12_prod_movimientos_select` con `USING private.la_tiene_local(empresa_id, local_id)`.
- `stock_operaciones`: política SELECT `pm12_prod_operaciones_select` con el mismo predicado.
- `stock_ubicacion`: política SELECT `pm12_prod_stock_select` con el mismo predicado.
- `prefiltros_candidatos`:
  - SELECT: exige propietario activo y `private.la_tiene_local(empresa_id, local_id)`.
  - DELETE: exige propietario activo y el mismo helper.
  - INSERT: `WITH CHECK` exige propietario activo y el mismo helper.

Las políticas anteriores están dirigidas a `authenticated`; por tanto, `TO authenticated` no es la única barrera: cada acceso tenant relevante incorpora el predicado de pertenencia empresa/local.

`empresas`, `locales` y `membresias_usuario` tienen RLS habilitado y no exponen políticas directas para lectura/escritura ordinaria desde Data API; las membresías se consumen desde helpers privados de autorización.

## 3. Helper real empresa/local

La función viva `private.la_tiene_local(p_empresa, p_local)` comprobada en producción exige simultáneamente:

1. usuario activo y sesión válida;
2. empresa no vacía;
3. local no vacío y distinto de `TODOS`;
4. una membresía activa cuyo `user_id = auth.uid()`;
5. coincidencia exacta `m.empresa_id = p_empresa`;
6. y `m.todos_locales = true` o coincidencia exacta de `m.local_id = p_local`.

Por construcción, una identidad que solo tenga membresía en empresa A no satisface el helper para empresa B. Las políticas de lectura y escritura descritas arriba delegan precisamente en este predicado.

La función auxiliar viva `private.la_usuario_activo()` también exige `auth.uid()` no nulo, al menos una membresía activa y ausencia de perfil explícitamente inactivo.

## 4. Control negativo aislado del SHA exacto

El candidato contiene `tests/pm26/p09f-qa-aislado/ensayo-auditoria-transaccional.sql`, que crea únicamente en PostgreSQL aislado dos identidades sintéticas independientes y dos contextos separados:

- usuario A → empresa A / local A;
- usuario B → empresa B / local B.

El ensayo comprueba:

- operación propia A/A permitida;
- usuario A contra empresa B/local B rechazado;
- usuario B contra empresa A/local A rechazado;
- sesión ausente rechazada;
- cierre mediante `ROLLBACK`.

El gate remoto del candidato exacto `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad` ejecutó PostgreSQL local y dejó en verde:

- `PM26_P09F_A_TRANSACCION_REVERSIBLE=PASS`
- `PM26_P09F_A_CASOS_AUTORIZACION=PASS`
- `PM26_P09F_A_ALCANCE_HONESTO=PASS`

Esto aporta el control negativo conductual con dos identidades realmente separadas sin tocar producción.

## 5. Límite honesto de la comprobación viva

La producción actual no ofrece un fixture válido para repetir directamente A contra B sin escribir datos:

- hay 2 membresías activas;
- pertenecen a 2 empresas;
- pero corresponden a **una sola identidad**, que legítimamente pertenece a ambas empresas;
- `prefiltros_candidatos`, `movimientos_stock`, `stock_ubicacion` y `stock_operaciones` no contienen filas actuales sobre las que hacer una prueba cruzada de visibilidad.

Un sondeo inicial devolvió permitido para ambas empresas precisamente por esa doble membresía legítima. Se comprobó la causa antes de interpretar el resultado; no constituye una fuga multiempresa.

No se creó una segunda identidad real ni se insertaron filas de prueba en producción para forzar el caso negativo, porque eso violaría el alcance autorizado.

Por tanto, C10 no afirma que se haya hecho una escritura cruzada real en producción. Certifica el aislamiento mediante: (a) políticas RLS vivas, (b) predicado de membresía vivo ligado a `auth.uid()` y empresa/local exactos y (c) prueba negativa reversible con identidades separadas en el gate del SHA candidato.

## Marcadores

`PM27_C10_RLS_HABILITADO=PASS`

`PM27_C10_PREDICADO_EMPRESA_LOCAL=PASS`

`PM27_C10_LECTURA_MULTIEMPRESA=PASS`

`PM27_C10_ESCRITURA_MULTIEMPRESA=PASS`

`PM27_C10_CONTROL_NEGATIVO_AISLADO=PASS`

`PM27_C10_PRODUCCION_SOLO_LECTURA=PASS`

`PM27_C10_RESULTADO=PASS`

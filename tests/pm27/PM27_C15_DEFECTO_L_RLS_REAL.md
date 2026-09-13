# PM27 — C15 Defecto L: RLS real

Fecha: 2026-09-13
Baseline técnico corregido: `b3d37a4cf2fdc37f66d862948a5894dfbc66b0be`
Rama de auditoría: `claude/pm27-c15-defecto-l-rls-real`

## 1. Objetivo

C15 verifica que el backend real de `public.prefiltros_candidatos` siga siendo la autoridad de seguridad aunque el cliente complete `empresa_id` y `local_id` durante C14. El cliente puede aportar contexto; nunca autoriza ese contexto.

## 2. Evidencia viva de producción — solo lectura

La inspección del proyecto de producción confirmó:

- `public.prefiltros_candidatos` tiene RLS activada (`relrowsecurity=true`);
- la tabla es propiedad de `postgres`, no de `authenticated`;
- `empresa_id` y `local_id` existen, son `text` y ambos son `NOT NULL`;
- `authenticated` tiene únicamente `SELECT`, `INSERT` y `DELETE` sobre esta tabla; no se observó grant de tabla para `anon`;
- existen tres políticas dirigidas a `authenticated`: lectura, creación y borrado;
- las tres políticas exigen simultáneamente un perfil activo con rol `Propietario` y `private.la_tiene_local(empresa_id, local_id)`;
- la política de `INSERT` aplica esa condición mediante `WITH CHECK`; las de `SELECT` y `DELETE`, mediante `USING`.

El helper vivo `private.la_tiene_local(text,text)` es `SECURITY DEFINER` con `search_path=''` y exige:

1. usuario activo mediante `private.la_usuario_activo()`;
2. empresa no vacía;
3. local no vacío y distinto de `TODOS`;
4. una membresía activa del `auth.uid()` en esa empresa y, dentro de ella, `todos_locales=true` o coincidencia exacta de `local_id`.

Por tanto, un valor de empresa/local enviado por el navegador no basta para autorizar la operación: debe superar el helper de pertenencia del servidor.

## 3. Limitación honesta de la prueba viva negativa

En el momento de la auditoría:

- `prefiltros_candidatos` contiene 0 filas;
- existe 1 usuario representado por membresías activas;
- sus 2 membresías activas son `todos_locales=true`;
- no existe un par empresa/local real ajeno disponible para ese usuario que permita ejecutar un negativo foreign-tenant sin crear datos nuevos o inventar identidades.

Por las reglas del proyecto, C15 no crea filas, usuarios, membresías ni locales en producción. Por ello, el negativo empresa/local ajeno se reproduce en PostgreSQL local aislado usando fixtures efímeros generados en runtime y copiando la semántica exacta observada en las políticas y helpers vivos.

## 4. Reproducción aislada obligatoria

`tests/pm27/c15-prefiltros-rls-contract.mjs` crea una base PostgreSQL temporal y reproduce:

- `auth.uid()`;
- `perfiles`;
- `membresias_usuario`;
- `prefiltros_candidatos` con `empresa_id/local_id NOT NULL`;
- `private.la_usuario_activo()`;
- `private.la_tiene_local(text,text)`;
- las tres políticas RLS observadas en producción;
- los grants de tabla mínimos para `authenticated`.

La batería exige PASS en:

- Propietario con membresía propia puede crear y leer su fila;
- empresa ajena no supera `WITH CHECK`;
- local ajeno de la misma empresa no supera `WITH CHECK` cuando no existe membresía concreta;
- empresa/local vacíos fallan cerrado;
- sin sesión falla;
- rol no Propietario falla aunque tenga membresía;
- una fila ajena sembrada por el owner de la base es invisible por `SELECT`;
- `DELETE` no afecta fila ajena y sí permite borrar la propia;
- `todos_locales` solo amplía dentro de la misma empresa y no cruza empresas;
- `anon` no tiene acceso de tabla;
- los negativos no dejan efectos parciales.

Todos los UUID, empresas y locales de esa reproducción son efímeros y no corresponden a QA ni producción.

## 5. Criterio de cierre

C15 solo puede quedar en PASS cuando el gate remoto del SHA exacto de esta rama confirme:

1. que el delta sobre el baseline contiene únicamente evidencia, prueba y workflow de C15;
2. sintaxis del contrato;
3. PostgreSQL local disponible;
4. `node tests/pm27/c15-prefiltros-rls-contract.mjs` en PASS;
5. árbol limpio al terminar.

## 6. Estado

Resultado actual: **PENDIENTE DE GATE REMOTO**.

No se ha escrito en Supabase QA/producción, no se ha desplegado Netlify y no se han modificado `main`, `release` ni PR #38.

Marcador provisional:

`PM27_C15_RESULTADO=PENDIENTE`

# PM27 — C14 Defecto L: caché/contexto

Fecha: 2026-09-13
Baseline técnico corregido: `b3d37a4cf2fdc37f66d862948a5894dfbc66b0be`
Rama de auditoría: `claude/pm27-c14-defecto-l-cache-contexto`

## 1. Objetivo

C14 verifica el contrato cliente del hotfix del Defecto L: un alta de `prefiltros_candidatos` solo puede completar `empresa_id` y `local_id` cuando el contexto almacenado es inequívoco y comprobable desde la caché local ya existente. El cliente no debe inventar tenant/local ni sustituir identificadores que ya vengan en el payload.

Este caso no certifica RLS/backend; eso corresponde a C15. Aquí solo se audita la lógica de caché/contexto del cliente.

## 2. Superficie auditada

- `pm11-compra-mobile-loader.js`
- `tests/pm27/defecto-l-context-hotfix.test.mjs`

El loader instala una única envoltura de `fetch` y solo actúa sobre `POST /rest/v1/prefiltros_candidatos`, respetando `NUBE_URL` cuando existe.

## 3. Positivo obligatorio

Con exactamente un local activo y operable, asociado a una empresa válida en la caché:

- el resolver obtiene un contexto inequívoco;
- repara `localActivoId` si falta;
- incorpora la empresa a la caché si falta;
- el POST a `prefiltros_candidatos` completa únicamente los IDs ausentes;
- el loader PM11 continúa cargándose una sola vez.

Resultado: **PASS**.

## 4. Negativos obligatorios

La prueba automatizada exige comportamiento fail-closed en:

- varios locales activos sin selección inequívoca;
- `local_id` explícito desconocido;
- caché corrupta o con forma inesperada;
- local inactivo;
- local fusionado;
- host distinto cuando `NUBE_URL` está definido.

También exige que:

- si `empresa_id` y `local_id` ya vienen presentes, nunca se sustituyan aunque contradigan la caché;
- no se modifiquen POSTs de otras tablas;
- una segunda ejecución del loader no duplique wrapper ni script PM11;
- el hotfix universal permanezca fuera de `reset-pruebas-preview.js`.

Resultado: **PASS**.

## 5. Evidencia ejecutada

El gate C14 ejecutó sobre la rama trazable:

- verificación de que `b3d37a4cf2fdc37f66d862948a5894dfbc66b0be` es ancestro del HEAD;
- control de alcance para permitir únicamente este documento y el workflow C14 sobre el baseline;
- `node --check pm11-compra-mobile-loader.js`;
- `node --check tests/pm27/defecto-l-context-hotfix.test.mjs`;
- `node tests/pm27/defecto-l-context-hotfix.test.mjs`;
- comprobación final de árbol limpio.

La primera ejecución de preparación, run `34781766625`, terminó en **SUCCESS** sobre `5613ce2babf34eb50da378b36a349df012e2aae0`. El commit de cierre vuelve a disparar el mismo gate para certificar el SHA final que contiene esta evidencia.

## 6. Conclusión

C14 queda formalmente **CERRADO / PASS**: el cliente completa contexto únicamente cuando puede resolverlo sin ambigüedad, conserva cualquier ID ya presente y falla cerrado frente a caché corrupta, múltiples locales, local explícito desconocido o local no operable.

No se realizan escrituras en Supabase QA/producción, no se despliega Netlify y no se modifican `main`, `release` ni PR #38.

El siguiente caso habilitado es **C15 — Defecto L: RLS real**, que debe comprobar que el backend de `prefiltros_candidatos` exige empresa/local válidos y que la RLS sigue siendo la autoridad aunque el cliente complete contexto.

Marcadores:

`PM27_C14_POS_CONTEXTO_INEQUIVOCO=PASS`

`PM27_C14_PRESERVA_IDS_EXISTENTES=PASS`

`PM27_C14_FAIL_CLOSED_CACHE_AMBIGUA=PASS`

`PM27_C14_RESULTADO=PASS`

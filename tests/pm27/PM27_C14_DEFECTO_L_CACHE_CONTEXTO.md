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

## 5. Criterio de PASS

C14 solo puede cerrar en PASS si el gate remoto del SHA exacto de esta rama ejecuta con éxito:

1. sintaxis del loader y de la prueba;
2. `node tests/pm27/defecto-l-context-hotfix.test.mjs`;
3. control de que el delta respecto al baseline contiene solo evidencia/workflow de C14;
4. árbol limpio al terminar.

## 6. Estado

Resultado actual: **PENDIENTE DE GATE REMOTO**.

No se realizan escrituras en Supabase QA/producción, no se despliega Netlify y no se modifican `main`, `release` ni PR #38.

Marcador provisional:

`PM27_C14_RESULTADO=PENDIENTE`

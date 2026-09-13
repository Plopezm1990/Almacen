# PM27 — C06 Frontera QA / producción del cliente

Fecha de corte: 2026-09-13
Candidato auditado: `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`
Resultado: `PASS`

## 1. Estado vivo del candidato

La rama `claude/pm27-reauditoria-candidato` continúa exactamente en el SHA congelado `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`.

## 2. Separación universal vs QA-only

En `index.html` el orden es explícito:

1. `pm11-compra-mobile-loader.js`
2. `reset-pruebas-preview.js`
3. posteriormente el bundle principal

El loader universal no contiene un guard por hostname de Deploy Preview para el layout móvil. Su bloque PM11 inyecta `pm11-compra-mobile-layout-v1.js` en cualquier entorno de navegador y es idempotente mediante `window.__pm11CompraMobileLoaderV1`.

`reset-pruebas-preview.js`, en cambio, conserva el guard:

`HOST_PREVIEW = /^(?:deploy-preview-\d+|[a-f0-9]{24})--chic-entremet-9107cf\.netlify\.app$/i`

y retorna inmediatamente fuera de ese host. Su configuración de Supabase QA, bloqueo/redirección de producción y bootstrap de datos QA permanecen confinados a Deploy Preview.

## 3. Hotfix PM27 del Defecto L no se mezcla con QA-only

`tests/pm27/defecto-l-context-hotfix.test.mjs` comprueba estructuralmente que:

- el loader universal se ejecuta antes de `reset-pruebas-preview.js` y antes del bundle;
- `reset-pruebas-preview.js` NO contiene `__pm26PrefiltroHotfixVersion`;
- el reset conserva `HOST_PREVIEW`.

Por tanto el hotfix de contexto del Defecto L permanece en la superficie universal y no vuelve a depender de un script exclusivo de preview.

## 4. Control negativo real

`tests/pm26/p04b-contract.mjs` muta únicamente una copia en memoria del loader y reintroduce deliberadamente un guard `deploy-preview`. Sobre hostname de producción, esa copia deja de inyectar el layout móvil; el contrato exige exactamente ese fallo para demostrar que la regresión sería detectada.

En el run remoto exacto del candidato (`34765942761`, job `103746795855`) pasaron, entre otros, los siguientes marcadores:

- `PM27_DEFECTO_L_CONTEXT_HOTFIX=PASS`
- `PM26_P04B_DEFECTO_D_RESET_PREVIEW_REDUCIDO_CORRECTAMENTE=PASS`
- `PM26_P04B_LOADER_MOVIL_UNIVERSAL_PRODUCCION=PASS`
- `PM26_P04B_LOADER_MOVIL_IDEMPOTENTE=PASS`
- `PM26_P04B_NEGATIVA_GUARD_HOST_REINTRODUCIDO=PASS`
- `PM26_P04B_INDEX_HTML_VERIFICADO=PASS`
- `PM26_P04B_TESTS_VIVOS_PASAN=PASS`
- `PM26_P04B_SIN_SECRETOS_NI_IDENTIFICADORES_QA_COPIADOS=PASS`

## 5. Alcance de la conclusión

C06 certifica la frontera de cliente entre código universal y código QA-only para el candidato congelado. No implica despliegue, cambio de Netlify ni escritura en Supabase. No se modificó `main`, `release`, PR #38 ni ninguna superficie de producción.

Marcadores:

`PM27_C06_LOADER_UNIVERSAL_PRODUCCION=PASS`
`PM27_C06_RESET_PREVIEW_QA_ONLY=PASS`
`PM27_C06_HOTFIX_L_NO_MEZCLADO_EN_RESET=PASS`
`PM27_C06_NEGATIVA_GUARD_HOST_DETECTADA=PASS`
`PM27_C06=PASS`

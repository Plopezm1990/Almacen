# PM27 — C08 Auth/JWT de Edge Functions

Fecha de corte: 2026-09-13
Candidato auditado: `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`
Resultado: `PASS`.

## 1. Evidencia estructural

El adaptador `edge-auth-patch.js` del candidato intercepta exclusivamente cuatro Edge Functions privadas:

- `importar-albaran`
- `importar-nomina`
- `enviar-notificacion`
- `entrevista-personal`

Para esas rutas:

- obtiene la sesión mediante `getSupabaseClient().auth.getSession()`;
- si no existe sesión devuelve respuesta 401 local y no llama a `fetchOriginal`;
- si existe sesión y no hay cabecera `Authorization`, añade `Bearer <access_token>`;
- si el llamador ya proporcionó `Authorization`, la conserva;
- cualquier Edge Function no incluida en la lista protegida pasa directamente por el `fetch` original.

La autorización efectiva sigue perteneciendo a cada Edge Function/backend; el adaptador solo transporta el JWT.

## 2. Contrato P09c

`tests/pm26/p09c-edge-jwt-contract.mjs` usa tokens, respuestas y fetch sintéticos; no toca red real ni usuarios reales.

Comprueba expresamente:

1. que las cuatro rutas protegidas reciben `Authorization: Bearer token-sintetico`;
2. que una cabecera `Authorization` preexistente no se sustituye;
3. que sin sesión la respuesta es 401 y el contador de peticiones reales queda en cero;
4. que `prefiltro-candidato` se trata como ruta pública: la petición continúa y no se consulta la sesión.

## 3. Ejecución sobre el SHA congelado

El workflow del candidato recorre `tests/pm26/*-contract.mjs`, por lo que incluye `p09c-edge-jwt-contract.mjs`.

Run remoto exacto:

- Run ID: `34765942761`
- Job ID: `103746795855`
- `head_sha`: `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`
- conclusión global: `SUCCESS`

El log del job contiene, inmediatamente tras ejecutar `tests/pm26/p09c-edge-jwt-contract.mjs`:

- `PM26_P09C_ADAPTADOR_EXTRAIDO_DE_RELEASE=PASS`
- `PM26_P09C_CUATRO_RUTAS_LLEVAN_JWT=PASS`
- `PM26_P09C_CABECERA_EXISTENTE_SE_CONSERVA=PASS`
- `PM26_P09C_SIN_SESION_NO_ENVIA_PETICION=PASS`
- `PM26_P09C_RUTA_PUBLICA_NO_SE_INTERCEPTA=PASS`

## 4. Control negativo / fail closed

El caso sin sesión es el control negativo principal: el adaptador devuelve 401 y el contrato exige `llamadas.length === 0`, demostrando que una ruta privada no se envía sin JWT.

También se protege frente a una regresión de sobreintercepción: `prefiltro-candidato` debe seguir pasando como ruta pública y `lecturasSesion() === 0`.

## 5. Alcance

C08 certifica transporte correcto de JWT en el cliente para las cuatro rutas privadas incluidas y preservación de la ruta pública.

No certifica por sí solo autorización multiempresa/multilocal dentro del backend; eso corresponde a C09–C13.

No se modificaron `main`, `release`, PR #38, Netlify, Supabase producción, usuarios reales ni el candidato congelado.

Marcadores:

`PM27_C08_CUATRO_RUTAS_PRIVADAS_JWT=PASS`
`PM27_C08_AUTH_EXISTENTE_PRESERVADA=PASS`
`PM27_C08_SIN_SESION_SIN_PETICION=PASS`
`PM27_C08_RUTA_PUBLICA_NO_INTERCEPTADA=PASS`
`PM27_C08_GATE_SHA_EXACTO=PASS`
`PM27_C08_RESULTADO=PASS`

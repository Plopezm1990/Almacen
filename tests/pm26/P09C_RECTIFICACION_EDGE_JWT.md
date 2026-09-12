# PM26 P09c — Rectificación del diagnóstico Edge JWT

**Estado: CORRECCIÓN DE DIAGNÓSTICO, SIN CAMBIO FUNCIONAL.**

P09b concluyó erróneamente que cuatro llamadas del cliente publicado carecían
de JWT porque inspeccionó sus `fetch` directos. La inspección posterior del
artefacto que Netlify publica realmente, `fuente.js` en el SHA exacto de
`release`, muestra un adaptador global previo que intercepta esas rutas.

El adaptador:

1. Limita su alcance a `entrevista-personal`, `enviar-notificacion`,
   `importar-albaran` e `importar-nomina`.
2. Obtiene el `access_token` de la sesión con `getSupabaseClient().auth.getSession()`.
3. Añade `Authorization: Bearer <JWT>` únicamente si el llamador no lo aportó.
4. Devuelve 401 local y no envía la petición si no existe sesión.
5. Deja intacta la función pública `prefiltro-candidato` y cualquier URL ajena.

El contrato P09c extrae ese adaptador del `fuente.js` de `release` mediante
`git show`, lo ejecuta en un contexto de navegador simulado y verifica sus
cinco comportamientos. No usa una sesión real, claves, red, QA ni producción.

La documentación y el contrato P09b se han rectificado para informar de **0 de
6 integraciones Edge incompatibles por JWT**. Esto no altera los restantes
hallazgos de P09b: producción continúa sin 11 relaciones requeridas y con 13
RPC incompatibles respecto del cliente publicado.

## Límites respetados

- Cliente publicado, `main` y `release`: **NO MODIFICADOS**.
- Supabase QA, producción y TPV: **SIN ESCRITURAS**.
- Edge Functions y Netlify: **SIN DESPLIEGUES**.
- PR #38: **NO FUSIONADA NI CERRADA**.

`PM26_P09C_EDGE_JWT_EXISTENTE=PASS`

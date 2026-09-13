# PM27 — C07 Configuración de endpoints

Fecha de corte: 2026-09-13
Candidato auditado: `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`
Resultado: `PASS`

## 1. Objetivo

Verificar que las rutas cuyo destino debe depender del entorno deriven el origen desde la configuración activa y no desde un endpoint productivo incrustado dentro del módulo; comprobar además que QA no pueda desviarse silenciosamente a producción ni producción a QA.

## 2. Estado real del candidato

El candidato mantiene la corrección de PM26 P07b sobre el Defecto K:

- `PrefiltroPublico` ya no contiene una URL literal `https://<proyecto>.supabase.co/functions/v1/prefiltro-candidato`.
- El adaptador `origenSupabasePublicoPM26` / `invocarFuncionPublicaPM26` deriva el origen desde `NUBE_URL`.
- Solo admite el slug `prefiltro-candidato` y las acciones públicas previstas.
- Rechaza URLs que no sean HTTP(S) absolutas de origen limpio: sin credenciales, path, query ni fragmento.
- En modo QA exige coherencia entre `NUBE_URL` y `__qaNubeUrl`.
- El modo local sin backend falla cerrado.
- La validación se ejecuta antes de cualquier `fetch`.

El contrato P07b aplica estas comprobaciones a tres artefactos del candidato: fuente canónica, build canónico y bundle servido.

## 3. Separación de configuración legítima y hardcode funcional

`index.html` conserva una configuración base de producción en `NUBE_URL` y, después de ejecutar `reset-pruebas-preview.js`, la sustituye por la configuración QA cuando `__modoPruebasQA` está activo. Esto es la ubicación de configuración del entorno, no una URL funcional incrustada dentro de `PrefiltroPublico`.

`reset-pruebas-preview.js` contiene los datos de QA dentro de un script protegido por `HOST_PREVIEW`; su función es impedir que Deploy Preview salga a producción. C06 ya verificó que este script sigue siendo QA-only.

El patrón prohibido en C07 es un endpoint productivo literal dentro de una ruta funcional que debería derivarse de la configuración activa. P07b exige expresamente que ese patrón no exista en los tres artefactos validados.

## 4. Pruebas positivas

El contrato P07b ejecuta en memoria, sin red real:

- producción simulada con `NUBE_URL=https://prod.example.invalid` y exige que la llamada resultante use ese origen;
- QA simulada con `NUBE_URL=https://qa.example.invalid`, `__modoPruebasQA=true` y `__qaNubeUrl` coincidente, y exige el origen QA;
- una referencia QA residual con `__modoPruebasQA=false` no puede desviar una ejecución de producción;
- `comprobar` y `enviar` pasan por el mismo adaptador;
- el payload no puede sustituir la acción autoritativa;
- la ruta pública no añade `Authorization` ni `apikey` por accidente.

En el gate remoto exacto del candidato, run `34765942761`, los contratos `p07a-contract.mjs` y `p07b-contract.mjs` terminaron en PASS, incluidos:

- `PM26_P07A_ORDEN_CONFIGURACION_Y_BARRERA_QA=PASS`
- `PM26_P07A_PRUEBAS_NEGATIVAS_EN_MEMORIA=PASS`
- `PM26_P07B_CANONICA_CONSTRUIDA_SERVIDA=PASS`
- `PM26_P07B_K_PROD_QA_INVALIDO_SIN_RED_REAL=PASS`
- `PM26_P07B_PRUEBAS_NEGATIVAS_EN_MEMORIA=PASS`
- `PM26_P07B_PETICIONES_REALES=0`

## 5. Controles negativos

El mismo contrato rechaza antes de `fetch`:

- entorno nulo o `NUBE_URL` ausente;
- protocolo no HTTP(S);
- URL con usuario/contraseña;
- query, fragmento o path inesperado;
- modo local sin backend;
- QA con origen activo distinto de `__qaNubeUrl`;
- QA sin `__qaNubeUrl`;
- slug o acción pública no permitidos.

P07b también contiene mutaciones deliberadas en memoria para detectar la pérdida de selección QA, la pérdida de derivación desde `NUBE_URL` y otras garantías. P07a conserva además el diagnóstico histórico que demuestra que el contrato detecta el antiguo estado con URL productiva literal.

## 6. Alcance honesto

C07 certifica la configuración de endpoints cubierta por los contratos P07a/P07b, especialmente la ruta pública de prefiltro y la separación de origen producción/QA. No declara que cualquier cadena URL del repositorio sea un defecto: la configuración base en `index.html`, el bloqueo explícito de producción en el script QA y otros identificadores públicos auditados tienen funciones de configuración o protección documentadas.

No se realizó ninguna petición real, escritura Supabase, despliegue Netlify ni modificación funcional del candidato.

Marcadores:

`PM27_C07_CANDIDATO_EXACTO=PASS`
`PM27_C07_ENDPOINT_PUBLICO_DERIVADO_DE_CONFIG=PASS`
`PM27_C07_QA_PRODUCCION_SEPARADOS=PASS`
`PM27_C07_CONFIG_INVALIDA_FAIL_CLOSED=PASS`
`PM27_C07_HARDCODE_FUNCIONAL_DETECTABLE=PASS`
`PM27_C07_PETICIONES_REALES=0`
`PM27_C07_RESULTADO=PASS`

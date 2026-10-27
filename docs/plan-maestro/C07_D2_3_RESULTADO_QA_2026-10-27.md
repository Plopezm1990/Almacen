# C07-D.2.3 — estado de configuración fiscal reflejado en TPV

Fecha: 27/10/2026  
Entorno de base de datos: Supabase QA `qjqorixtkilwsndqayyx`  
Producción: no modificada  
AEAT: no contactada

## Resultado

**C07-D.2.3 queda implementada y verificada en QA.** El TPV ya consulta al
servidor la configuración fiscal efectiva del local y muestra tres estados
visuales inequívocos:

- `loading`: comprobación en curso;
- `ready`: configuración `VALIDADA` o `ACTIVA`, con serie, adaptador y entorno;
- `blocked`: no configurada, inválida, no disponible o no autorizada.

La ausencia de configuración no cancela el cobro comercial. Sí bloquea la
emisión fiscal C07-D: la función frontend hace un preflight de estado y la RPC
de emisión sigue siendo la autoridad final antes de reservar cualquier número
C05.

## Cambios de servidor en QA

Se aplicó la migración:

`20261027163000_abc_f7_c07d_d2_3_frontend_config_status.sql`

La nueva RPC autenticada es:

`public.abc_c07d_estado_configuracion_emision(text, text, text)`

Responsabilidades:

1. valida sesión y capacidad `ABC_EMISOR_CAMBIAR`;
2. resuelve la entidad fiscal activa del local en servidor;
3. busca la configuración persistente de `FACTURA` u otro tipo permitido;
4. comprueba que la serie pertenezca al mismo ámbito y esté activa;
5. devuelve estado, serie, adaptador, entorno y versión;
6. nunca devuelve `credential_ref` ni secretos; solo un booleano
   `credential_configured`;
7. queda ejecutable por `authenticated`, no por `anon`, y no concede acceso
   directo a tablas privadas.

## Evidencia funcional autenticada

Fixture: empresa `QA-EMP-A`, local `QA-A1`, entidad fiscal
`a0000000-0000-0000-0000-0000000000a2`.

### Configuración vigente

Para `FACTURA`, la RPC devolvió:

- `ok: true`;
- `configurada: true`;
- estado `VALIDADA`;
- serie `TPV`;
- adaptador `SIMULADOR_C07D`;
- entorno `QA`;
- versión `1`;
- `credential_configured: false`.

### Tipo sin configuración

Para `RECTIFICATIVA`, la RPC devolvió:

- `ok: true`;
- `configurada: false`;
- estado `NO_CONFIGURADA`;
- la entidad fiscal resuelta del local;
- sin crear documentos, números, registros C07-D ni elementos de cola.

## Cambios de frontend

En `fuente.js`:

- se expone `leerConfiguracionEmisionC07D` desde la lógica de venta;
- `VentaRapida` consulta el estado al cambiar de empresa/local;
- el panel del cobro muestra el estado fiscal resuelto por servidor;
- se elimina el uso efectivo de la serie local del navegador: el flujo de
  cobro descarta `codigoSerie` antes de enviarlo al servidor y el emisor
  transmite `p_codigo_serie: null`;
- el servidor conserva la autoridad sobre empresa, local, entidad, serie,
  adaptador y entorno;
- el preflight de emisión evita llamar a la mutación fiscal cuando la
  configuración no es válida, y el backend vuelve a comprobarla como segunda
  barrera.

## Contratos y verificaciones

Pasaron:

- `node tests/f5/c07/c07d-d2-3-frontend-config-contract.mjs`;
- `node tests/f5/c07/c07d-d2-emission-wiring-contract.mjs`;
- `node tests/f5/c07/c07d-d2-emission-config-contract.mjs`;
- `node tests/f5/c07/c07d-checkout-emit-contract.mjs`;
- `node tests/f5/c07/c07d-migration-contract.mjs`;
- `node tests/f5/c07/c07d-preflight-contract.mjs`;
- `node tests/f5/c07/c07-fiscal-gate-contract.mjs`;
- `node --check fuente.js`;
- `git diff --check`.

Los asesores de Supabase se volvieron a ejecutar en QA. Los avisos sobre
tablas privadas con RLS sin políticas y funciones `SECURITY DEFINER` ejecutables
por `authenticated` corresponden al patrón RPC controlado que ya utiliza esta
cadena; la nueva RPC no tiene grants a `anon` ni acceso directo a tablas.
Los avisos de rendimiento históricos y los índices todavía no usados son
informativos.

## Control de cambios

Commit enviado a la rama `codex/fiscal-multiempresa-config`:

`91b83b9 feat(fiscal): bloquear emision sin configuracion validada`

PR: [#182](https://github.com/Plopezm1990/Almacen/pull/182)

En esta comprobación todavía no había aparecido un resultado nuevo de GitHub
Actions para el commit recién enviado; la validación local y QA sí están
completas. Producción permanece intacta.

## Límite y siguiente paso

La cadena todavía mantiene una entidad fiscal activa por local y sigue usando
transporte `DISABLED`/simulador QA. No es una integración real con AEAT ni una
habilitación de producción.

El siguiente trabajo recomendado es **C07-D.2.4: prueba de aceptación del
flujo TPV completo en el deploy de preview**, verificando visualmente los tres
estados (`loading`, `ready`, `blocked`) y una venta QA con emisión simulada.
Después se debe cerrar la revisión funcional de asesoría por empresa y definir
el contrato real del proveedor/sandbox antes de preparar cualquier activación
AEAT.

# Corrección TPV: conservación del local operativo

Fecha: 2026-11-02  
Rama: `codex/ventas-mejoras`  
Commit: `881e6d7 fix(tpv): conservar local operativo al cambiar contexto`

## Hallazgo reproducido

En el preview QA existente, con la cuenta de smoke autorizada y sin crear ventas:

1. El TPV abría correctamente con `Local A1`.
2. Al seleccionar `Local A2`, el selector visual mostraba `Local A2`, pero el encabezado y el contexto operativo seguían en `Local A1`.
3. El TPV quedaba bloqueado con el mensaje de selección de local.

La causa confirmada en código era que el efecto de sincronización dependía de `localActivoId` y, en cada cambio de local, volvía a hidratar ese estado desde `almacen_kv`. El valor remoto antiguo podía sobrescribir la selección recién realizada.

## Corrección aplicada

- La hidratación de `empresas`, `locales`, `localActivoId` y productos se ejecuta una sola vez cuando la aplicación está lista y la nube está activa.
- El refresco de stock, conteos y caja conserva la dependencia de `localActivoId`, por lo que cambiar de local sigue actualizando los datos acotados al nuevo contexto.
- Se mantiene la materialización canónica `source-recovery/fuente-recuperado.js` → `fuente.js`.
- No se han creado ventas, cobros, intentos de pago, migraciones ni cambios en producción.

## Comprobaciones ejecutadas

- `node --check source-recovery/fuente-recuperado.js`: correcto.
- `node --check fuente.js`: correcto.
- `node tests/pm07/frontend-contract.mjs`: correcto, incluidos los nuevos contratos de hidratación única y refresco por cambio de local.
- `node tests/f4/b05/b05-phase1-regression.mjs`: correcto.
- `node tests/f4/b05/b05-ui-contract.mjs`: correcto.
- `node tests/f4/b04/b04-ui-contract.mjs`: correcto.
- `node tests/post-reset-schema-contract.mjs`: correcto.
- `node .github/scripts/build-netlify-publish.mjs`: correcto; Tailwind generado con 17.774 bytes.
- `node tests/netlify-publish-boundary.mjs`: correcto; 57 entradas publicables.

## Estado QA

La URL QA utilizada para reproducir el defecto corresponde al preview anterior y todavía no contiene este commit. La build local no puede autenticar la cuenta QA porque el entorno local no recibe las variables/configuración de autenticación que Netlify inyecta en el preview. Por tanto, la corrección no se marca como verificada visualmente en QA hasta publicar un preview nuevo y repetir:

- entrar en QA;
- abrir TPV con `Todos los locales` y confirmar el bloqueo esperado;
- seleccionar `Local A2`;
- comprobar que el encabezado, el contexto operativo y el catálogo pasan a `Local A2`;
- volver a `Local A1` y comprobar el retorno;
- no pulsar productos, enviar pedidos ni iniciar cobros.

## Siguiente paso recomendado

Publicar únicamente la rama aislada como preview QA, sin tocar `main`/`release`, y repetir el smoke anterior. Si pasa, incorporar el resultado a la evidencia de fase 1; si falla, recoger consola y red antes de cambiar el código.

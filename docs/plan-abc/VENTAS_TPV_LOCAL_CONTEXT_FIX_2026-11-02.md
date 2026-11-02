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

Se publicó el preview aislado `6ae81e0f970b2b780a97508a` en estado `ready`:

`https://6ae81e0f970b2b780a97508a--chic-entremet-9107cf.netlify.app`

La URL anterior ya no se utiliza como evidencia de la corrección. En el preview nuevo, con la cuenta de smoke autorizada y sin crear ventas:

- entrar en QA: correcto;
- seleccionar `Local A2`: el encabezado pasó a `Local A2` y el selector mostró `Mostrando solo Local A2.`;
- abrir TPV en `Local A2`: correcto; se mostró el catálogo y el histórico del local, sin bloqueo ni error;
- volver a `Local A1`: el encabezado pasó a `Local A1`;
- abrir TPV en `Local A1`: correcto; se mostró de nuevo el catálogo y el histórico existente;
- no se pulsaron productos, no se enviaron pedidos y no se iniciaron cobros.

La prueba QA se considera aprobada para este defecto concreto. La build local sigue sin poder autenticar por falta de configuración local, pero no es necesaria para esta conclusión porque el preview QA sí se verificó con la cuenta autorizada.

## Siguiente paso recomendado

Publicar únicamente la rama aislada como preview QA, sin tocar `main`/`release`, y repetir el smoke anterior. Si pasa, incorporar el resultado a la evidencia de fase 1; si falla, recoger consola y red antes de cambiar el código.

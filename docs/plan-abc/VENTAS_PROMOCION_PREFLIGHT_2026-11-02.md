# Ventas — preflight de promoción QA → producción

Fecha: 2026-11-02  
Rama verificada: `codex/ventas-mejoras`  
Commit verificado: `ddd69ce1f77b48c260c2c857ef689559bcaa6713`

## Resultado

El código de fase 1 está listo para una revisión de promoción, pero esta hoja no autoriza ni ejecuta un despliegue de producción. El intento de tarjeta de QA se conserva pendiente y no se ha creado ningún cobro adicional.

## Actualización posterior — preview QA de la corrección multilocal

El sitio QA fue identificado de forma explícita mediante la conexión autorizada de Netlify: `chic-entremet-9107cf` (`472295da-601a-43df-a4bc-8171f2fc668b`). Se publicó un preview manual, sin `--prod`, usando el artefacto local ya validado:

- Deploy: `6ae81e0f970b2b780a97508a`.
- Estado: `ready`.
- URL: `https://6ae81e0f970b2b780a97508a--chic-entremet-9107cf.netlify.app`.
- Contexto: `deploy-preview`.

El smoke autenticado confirmó el cambio de `Local A1` a `Local A2` y el retorno a A1 con TPV operativo y catálogo visible. No se pulsaron productos, no se creó otra venta y no se inició ningún cobro.

La corrección se considera aprobada en QA para el defecto multilocal. Sigue sin autorizarse el despliegue de producción mientras no exista una decisión explícita sobre la promoción del candidato completo y el intento de tarjeta pendiente se mantiene intacto.

## Preflight ejecutado

- El fix F4 está presente en `30d29e2` y quedó conectado entre `crearLogicaVenta` y `GestionAlmacen`.
- La UI obtiene los intentos mediante `abc_estado_pago_mixto_cuenta`; no consulta directamente `pago_intentos`.
- Contratos específicos ejecutados con resultado `PASS`:
  - `tests/f4/b05/b05-phase1-regression.mjs`
  - `tests/f4/b05/b05-ui-contract.mjs`
  - `tests/f4/b04/b04-ui-contract.mjs`
  - `tests/f4/b08/b08-ui-contract.mjs`
  - `tests/f4/b09/b09-schema-contract.mjs`
  - `tests/f4/b09/b09-rpc-contract.mjs`
- El build determinista de Netlify se ejecutó en el repositorio real:
  - Tailwind generado: `17774` bytes.
  - `NETLIFY_PUBLISH_BOUNDARY_PASS entries=57 tailwind_bytes=17774`.
- El preview QA corregido abrió el TPV en `QA-A1` sin el error `iniciarCobroCuentaF4 is not defined`.

## Estado QA que no debe mutarse durante la promoción

- Cuenta: `92e6c4b8-1e71-4b17-87e9-6c1fd6d25ce2`.
- Estado: `ABIERTA`.
- Total: `1,32 €`.
- Confirmado: `1,00 €`.
- Pendiente/reservado: `0,32 €`.
- Pago de tarjeta: `PENDIENTE`.
- Checkout: `EN_COBRO`.
- Cobro adicional permitido por la autoridad: `0`.

No se debe confirmar, cancelar, reintentar ni resolver este intento sin una respuesta autorizada del proveedor simulado y una evidencia asociada. No se debe usar este registro para validar un cobro real de producción.

## Bloqueos de promoción

1. No se usó una instalación global de la CLI; el preview se publicó con `npx` contra el site ID identificado explícitamente.
2. No existe `.netlify/state.json` en el repositorio; no se creó ni se vinculó ningún sitio local.
3. La rama actual no es `main` ni `release`; el preview se mantuvo aislado.
4. El caso de QA conserva un pago de tarjeta pendiente; no es un motivo para modificarlo artificialmente y queda fuera de cualquier prueba económica de producción.

## Criterios para autorizar la promoción

- Identificar el sitio de producción mediante la conexión autorizada de Netlify, sin seleccionar un sitio por nombre supuesto.
- Confirmar que el commit que se va a publicar es exactamente el commit revisado y que no incluye los cambios locales preexistentes sin revisar.
- Ejecutar de nuevo el build de producción en el contexto correcto y conservar el resultado del guard de publicación.
- Verificar después del despliegue solo navegación, autenticación y carga del TPV; no iniciar cobros en producción.
- Mantener el intento QA pendiente sin confirmarlo, cancelarlo ni duplicarlo.

## Próximo paso autorizado

Resolver primero el acceso/identificación del sitio de producción en Netlify. Una vez identificado, hacer una revisión final de commit y contexto de despliegue; solo después se podrá solicitar la publicación controlada. Este documento no ejecuta ningún despliegue.

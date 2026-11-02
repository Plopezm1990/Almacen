# Ventas — preflight de promoción QA → producción

Fecha: 2026-11-02  
Rama verificada: `codex/ventas-mejoras`  
Commit verificado: `ddd69ce1f77b48c260c2c857ef689559bcaa6713`

## Resultado

El código de fase 1 está listo para una revisión de promoción, pero esta hoja no autoriza ni ejecuta un despliegue de producción. El intento de tarjeta de QA se conserva pendiente y no se ha creado ningún cobro adicional.

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

1. La CLI de Netlify no está instalada en el equipo actual.
2. No existe `.netlify/state.json` en el repositorio, por lo que no hay un sitio de Netlify vinculado localmente que se pueda identificar sin riesgo de elegir el proyecto equivocado.
3. La rama actual no es `main` ni `release`.
4. El caso de QA conserva un pago de tarjeta pendiente; no es un motivo para modificarlo artificialmente, pero sí debe quedar fuera de cualquier prueba económica de producción.

## Criterios para autorizar la promoción

- Identificar el sitio de producción mediante la conexión autorizada de Netlify, sin seleccionar un sitio por nombre supuesto.
- Confirmar que el commit que se va a publicar es exactamente el commit revisado y que no incluye los cambios locales preexistentes sin revisar.
- Ejecutar de nuevo el build de producción en el contexto correcto y conservar el resultado del guard de publicación.
- Verificar después del despliegue solo navegación, autenticación y carga del TPV; no iniciar cobros en producción.
- Mantener el intento QA pendiente sin confirmarlo, cancelarlo ni duplicarlo.

## Próximo paso autorizado

Resolver primero el acceso/identificación del sitio de producción en Netlify. Una vez identificado, hacer una revisión final de commit y contexto de despliegue; solo después se podrá solicitar la publicación controlada. Este documento no ejecuta ningún despliegue.

# F5 — corrección del aviso de `locales` en QA

Fecha: 2026-10-02
Entorno: Supabase QA `qjqorixtkilwsndqayyx` (solo QA; sin producción, sin deploy)
SHA de código: `a5a4321` (sin cambios de código ni de migraciones)
Estado: `CORREGIDO_EN_QA_DATOS_VERIFICADO_EN_BD_PENDIENTE_VERIFICAR_EN_NAVEGADOR`

## Causa

El cliente no guarda `locales` en `almacen_kv`. `ui-context-bridge.js` intercepta
las claves `empresas`, `locales` y `localActivoId` y las envía a la RPC
`guardar_contexto_instalacion_ui`. Pero `sincronizarContextoPm07` (`fuente.js`)
primero lee esas tres claves de `almacen_kv` y las vuelca en el estado de la
pantalla, y el efecto `saveKey("locales", locales)` las reenvía por el puente a la
RPC. Esa lectura está exigida por `tests/pm07/frontend-contract.mjs`: es diseño,
no un descuido.

En QA la fila heredada `almacen_kv.locales` (sembrada el 6/9, nunca actualizada)
tenía 3 locales con nombres antiguos y un cuarto, `QA-A-CERRADO`, inactivo y
**inexistente** en la tabla `locales`. La RPC lo rechaza con
`22023 Un local nuevo debe crearse activo`, de modo que ese guardado fallaba de
forma determinista para los dos propietarios de la empresa A.

Comprobaciones en transacciones revertidas (actores: Propietario A+B y
Propietario solo A):

- Reenviar a la RPC el contexto que entrega el servidor, con y sin cambio de
  nombre: OK, `state: ready`.
- Reenviar la fila heredada antigua de `locales`: `22023`. `empresas` y
  `localActivoId` heredadas: OK.

## Corrección aplicada en QA

`UPDATE` de una sola fila de `public.almacen_kv` (`key = 'locales'`, empresa
`QA-EMP-A`), con guarda sobre el valor anterior exacto. Se ejecutó como cambio
confirmado, no revertido. El trigger solo actúa sobre la clave `productos`, por lo
que no hay efectos secundarios.

Valor nuevo (la forma que devuelve `obtener_contexto_instalacion_ui` para la
empresa A):

```json
[{"id":"QA-A1","activo":true,"nombre":"Local A1","empresaId":"QA-EMP-A"},
 {"id":"QA-A2","activo":true,"nombre":"Local A2","empresaId":"QA-EMP-A"}]
```

Valor anterior (`updated_at` `2026-09-06 15:25:19.324787+00`), para revertir:

```json
[{"id":"QA-A1","activo":true,"nombre":"QA Local A1","direccion":"QA A1","empresaId":"QA-EMP-A"},
 {"id":"QA-A2","activo":true,"nombre":"QA Local A2","direccion":"QA A2","empresaId":"QA-EMP-A"},
 {"id":"QA-A-CERRADO","activo":false,"nombre":"QA Local A Cerrado","direccion":"QA Cerrado","empresaId":"QA-EMP-A"}]
```

Para revertir: `update public.almacen_kv set value = '<valor anterior>'::jsonb,
updated_at = now() where key = 'locales' and empresa_id = 'QA-EMP-A';`

## Verificación posterior (sobre el estado confirmado)

- Ciclo del cliente (leer las tres filas como cada propietario y guardarlas por la
  RPC): `empresas`, `locales` y `localActivoId` OK, `state: ready`, para ambos.
- Solo cambió la fila `locales` (24 filas en `almacen_kv`). Las tablas `locales` y
  `empresas`, `caja_sesiones` y el catálogo no cambiaron.

## Límites

- **No verificado en navegador.** No hay usuario de prueba ni acceso al preview
  privado. La verificación es en base de datos, sobre el mismo camino que sigue el
  cliente. Falta confirmar que el aviso desaparece al recargar el preview.
- «Subiendo N…» cuenta claves pendientes guardadas en el navegador
  (`almacen__pendientes`). Este arreglo no las vacía; se esperan reintentos, pero
  no se ha comprobado qué claves contiene ese contador.
- La fila heredada es global por clave (clave primaria solo `key`) en un sistema
  multiempresa. Un propietario de otra empresa no la lee (RLS) y el propietario
  solo de B no obtiene contexto (`Contexto empresarial incompleto`: B y sus locales
  están inactivos). Es una limitación de diseño, no tratada aquí.
- El defecto de fondo, que la pantalla se hidrate de una fila heredada que puede
  quedar desfasada del servidor y falle sin mostrar la causa, **no está corregido
  en código**. Un cambio de código exige actualizar el contrato PM07, la
  reconstrucción de `fuente.js` y un deploy; requiere autorización aparte. No se
  sabe si producción tiene filas heredadas desfasadas.

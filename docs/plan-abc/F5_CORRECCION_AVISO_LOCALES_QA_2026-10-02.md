# F5 — corrección del aviso de `locales` en QA

Fecha: 2026-10-02
Entorno: Supabase QA `qjqorixtkilwsndqayyx` (solo QA; sin producción, sin deploy)
SHA de código: `a5a4321` (sin cambios de código ni de migraciones)
Estado: `LOCALES_CORREGIDO_Y_VERIFICADO_EN_NAVEGADOR_Y_REGISTROS_OTRAS_5_COLECCIONES_RLS_SIN_CORREGIR`

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

## Segunda copia de la lista defectuosa (hallazgo posterior)

`reset-pruebas-preview.js` siembra, una vez por navegador (marcador
`la_suite_reset_total_20260904_v6_qa`), `almacen:locales` en `localStorage` con la
misma lista antigua que incluye `QA-A-CERRADO`. La pantalla arranca desde esa
copia local (el puente lee del `localStorage` para estas claves), por lo que el
arreglo de la fila de `almacen_kv` **puede no ser suficiente** en navegadores que
ya la tengan. Es una hipótesis: se comprobó que un navegador nuevo la trae
sembrada, no que provoque el aviso tras iniciar sesión.

Prueba en seco, sin iniciar sesión (Chromium, código de `a5a4321` servido bajo el
host `deploy-preview-117--chic-entremet-9107cf.netlify.app` mediante
interceptación de red): modo QA activo, bloqueo de producción activo y 0 intentos
hacia producción. Un perfil nuevo trae `almacen:locales` =
`QA-A1, QA-A2, QA-A-CERRADO (inactivo)`.

Método seguro para la prueba con sesión: servir los ficheros del repositorio bajo
ese host, abortar cualquier petición a `flqercbgpgmmfaakrwkc` (HTTP y WebSocket),
dejar pasar solo `qjqorixtkilwsndqayyx` y registrar consola, red y
`localStorage`. Requiere un usuario Propietario de QA y su contraseña, entregados
como variables del entorno y nunca por chat. No es el alojamiento de Netlify (sin
sus cabeceras ni CSP) y los WebSocket no pasan por el proxy del entorno.

## Evidencia de los registros de QA (sesión real en el preview, 11:10 UTC)

Lectura de los registros de la API de QA (solo lectura), sesión del Propietario
A+B (`16c79749…`) con `referer` del preview `deploy-preview-117`:

- `rpc/guardar_contexto_instalacion_ui`, antes del arreglo (1/10 22:00 a 2/10
  08:30 UTC): 8 respuestas `400` con código `22023`. Es coherente con la
  validación `Un local nuevo debe crearse activo`, aunque los registros no
  muestran el mensaje.
- Después del arreglo (desde 10:53 UTC): solo `200`. En el inicio de sesión de las
  11:10 el cliente guardó el contexto dos veces con éxito (cargas de 45 y 175
  bytes: `localActivoId` y una lista de locales de dos elementos, por tamaño).
- **Siguen fallando otras escrituras**, con `403` y error PostgREST `42501`
  (`new row violates row-level security policy`): `POST /rest/v1/almacen_kv` con
  `resolution=merge-duplicates` y `POST /rest/v1/movimientos_registro`. Se repiten
  desde la noche anterior (más de 100 y unas 30 respectivamente) y reaparecen en
  cada carga, también en las 11:10. En la sesión de las 11:10 hubo 6 `almacen_kv`
  con 4 tamaños de carga distintos (30, 33, 5269 y 255717 bytes), lo que concuerda
  con «Subiendo 4». Uno de 33 bytes cuadra con `{"key":"temaOscuro","value":true}`.
- Esas escrituras son el mecanismo que se describió por error como causa del aviso
  de `locales` (RLS que exige `empresa_id` no nulo sobre un valor sin `empresaId`).
  Ocurre en otras claves del bloque genérico y en `movimientos_registro`, no en
  `locales`. **No se ha corregido** y no depende del arreglo de `locales`.

## Verificación en navegador (Propietario A+B, preview, ~11:50 UTC)

Resultado del fragmento de diagnóstico (solo lectura) en Firefox, con la sesión ya
iniciada en `deploy-preview-117`:

- `modoQA: true`, `nubeActiva: true`, `syncPermitida: true`.
- `almacen:locales` del navegador = `QA-A1, QA-B1 (inactivo), QA-B2 (inactivo),
  QA-A2`, idéntica a la que devuelve `obtener_contexto_instalacion_ui`. **Ya no
  contiene `QA-A-CERRADO`**: la semilla antigua del navegador fue sustituida por
  el contexto del servidor. Igual en `empresas`, `localActivoId` (`QA-A1`) y la
  generación (`17aac47e` en ambos lados).
- `almacen__pendientes` = `historialRespaldos`, `productos`, `movimientos`,
  `conteos`, `temaOscuro`. **Ninguna es `locales`, `empresas` ni `localActivoId`.**
- Ninguna de esas cinco claves existe en `almacen_kv` de QA (las 24 filas son las
  sembradas el 4 y el 6 de septiembre): nunca se han guardado.

Conclusión: el defecto de `locales` está corregido en QA y comprobado en una
sesión real. Queda abierto, y sin relación con `locales`, que cinco colecciones no
se puedan guardar en la nube por la RLS (`almacen_kv` y `movimientos_registro`,
`403`/`42501`), lo que mantiene el indicador «Subiendo N…». Por tamaño solo se
puede asociar con seguridad `temaOscuro` (33 bytes exactos); la asociación de la
carga de 255 KB con `productos` que figuraba aquí era errónea (ver
`F5_ANALISIS_CLAVES_PENDIENTES_QA_2026-10-02.md`). No se sabe si afecta a
producción: no se ha consultado.
Pendiente de que Pedro confirme que no ve ningún aviso de locales en pantalla.

## Límites

- **El aviso no se ha visto en pantalla.** Los registros muestran que el guardado
  de `locales` por la RPC ya funciona en una sesión real, pero no que el aviso
  haya desaparecido: eso se confirma con la pantalla y el contenido de
  `almacen__pendientes` del navegador.
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

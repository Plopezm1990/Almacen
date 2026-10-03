# F6 · A09 · historial de descuentos del TPV («permission denied for table abc_eventos») — resultado

Fecha: 2026-10-03
Autorización: Pedro eligió «Arreglar el historial de descuentos del TPV» como siguiente pieza (3/10/2026). **Solo QA** (proyecto `qjqorixtkilwsndqayyx`). Producción no consultada ni tocada.
Estado: `ARREGLADO_SERVIDOR_APLICADO_EN_QA_Y_VERIFICADO_CON_PRUEBAS_LOCALES_PENDIENTE_COMPROBAR_EN_PANTALLA`
Origen del hallazgo: `F6_COBRO_LECTURA_INTENTOS_RESULTADO_2026-10-03.md`, sección «Hallazgo relacionado».

## Qué fallaba

El historial de descuentos del TPV («Descuento / cortesía» → «Abrir» → «Auditoría A09 · historial») leía la tabla **`abc_eventos` directamente desde el navegador**, pero la migración `20260924004000` (ACL parity) **quita al navegador todo acceso directo a esa tabla** (guarda los eventos de todo el sistema, con sus cargas). Comprobado en QA el 3/10/2026 con `has_table_privilege`: el navegador no puede leerla.

Además, al revisarlo apareció un **segundo fallo, peor y anterior** (A09, 28/9): los cargadores del panel de descuentos devolvían el error **como un objeto** (`{ ok:false, error: respuestaErrorA06(error) }`, y esa función devuelve a su vez `{ ok:false, error:"texto", conflict… }`), y la pantalla guarda ese valor y lo **dibuja tal cual** (`"⚠ ", errorAuditoriaDescuentosA09`). Dibujar un objeto en React lanza «Objects are not valid as a React child» y **rompe la pantalla**. Es decir: con el permiso que faltaba, abrir el historial no mostraba un aviso: **rompía el TPV**; y cualquier otro error de esos cargadores (sin conexión, sin permiso…) haría lo mismo.

## Qué se ha hecho

| Parte | Qué es | Dónde |
|---|---|---|
| Servidor | Función nueva de solo lectura **`abc_listar_eventos_descuento_cuenta(empresa, local, cuenta)`**: devuelve **solo** los eventos `CUENTA_DESCUENTO_APLICADO` de esa cuenta, de esa empresa y ese local (los 100 más recientes, del más reciente al más antiguo) con las mismas seis columnas que pedía la pantalla (`operation_id`, `event_type`, `payload`, `actor_user_id`, `occurred_at`, `operating_day`); lista vacía si no hay. Exige poder operar cuentas en el local (`ABC_CUENTA_OPERAR`: los cuatro roles por plantilla, como `abc_recuperar_cuenta` o `abc_estado_cobro_cuenta`); sin sesión o sin esa capacidad: `descuento_eventos_no_autorizado`; sin cuenta: `descuento_eventos_parametros_invalidos`. SECURITY DEFINER, `search_path` vacío, permisos solo de `authenticated`. **Más estrecha que el acceso directo que había antes** (no expone otros tipos de evento ni otras cuentas). Migración aditiva (una función nueva, ni una tabla ni una función existente tocada) | `20261003120000_abc_a09_eventos_descuento_cuenta.sql` (en QA se registró como `20261003103727`) |
| Pantalla | El historial pide los eventos a esa función (parámetros exactos) en lugar de leer la tabla. Los **seis cargadores del panel** (`listarAutorizacionesDescuentoA09`, `listarDescuentosAplicadosA09`, `listarAuditoriaDescuentosA09`, `listarEfectosCajaA09`, `listarEfectosStockA09`, `listarFiscalizacionA09`) devuelven el error **como texto** (`respuestaErrorA06(error).error`). Dos errores nuevos traducidos al español: «Tu perfil no tiene permiso para ver el historial de descuentos de esta cuenta.» y «No se pudo identificar la cuenta para mostrar su historial de descuentos.» | `fuente.js` y `source-recovery/fuente-recuperado.js` (idénticos) |

## Contrato anterior que tuve que actualizar (a la vista)

`tests/f3/a09/discount-command.test.mjs`, caso A09.2.5, **exigía la lectura directa** (`.from("abc_eventos")…CUENTA_DESCUENTO_APLICADO`), es decir, exigía justo el fallo. Lo he sustituido por: el historial llama a `abc_listar_eventos_descuento_cuenta` con esos parámetros y **no** lee `abc_eventos` directamente. El resto del contrato A09 queda igual (20/20). Es el único contrato anterior modificado.

## Pruebas hechas

| Prueba | Resultado |
|---|---|
| Contrato vivo del servidor `tests/cfg/a09-eventos-contract.sql` en réplica local (PostgreSQL 16, cadena completa): permisos, los cuatro roles, no se mezclan locales ni empresas ni agregados ni otros tipos de evento, orden, seis columnas, límite de 100 con 105 eventos, lista vacía, rechazos (sin sesión, otra empresa, membresía desactivada, empresa/local nulos, sin cuenta, `anon` y `service_role`), no escribe | **40/40** |
| El mismo contrato **en QA** (con `ROLLBACK`, sin residuos; migración registrada; el cuerpo de la función en QA coincide con el de la réplica, md5 `b767187e…`; permisos solo de `authenticated`, ninguna concesión a PUBLIC) | **40/40** |
| Averías provocadas del servidor (22: sin comprobar capacidad, otra capacidad, sin cada filtro, orden, límite, volátil, invoker, sin `search_path`, concesiones a anon y public, sin revoke, columnas de más y de menos, nulo si vacío, cuenta nula, sin sesión, mensajes, prefijo) | **22 detectadas**: 20 por el contrato vivo y las otras 2 (quitar el `revoke` y quitar la comprobación `auth.uid() is null`: la réplica no reproduce los permisos por defecto de Supabase y la segunda comprobación es redundante con la capacidad) **por el contrato estático** |
| Prueba de ejecución `tests/cfg/a09-eventos-ui-runtime.mjs` (las funciones **reales** de la aplicación, tal cual están escritas, contra un servidor falso que reproduce los permisos de QA) | **22/22** con el arreglo. **Contra la versión anterior fallan 19** |
| Contrato estático `tests/cfg/a09-eventos-static-contract.mjs` (cargadores idénticos en `fuente.js` y el fuente recuperado; parámetros exactos frente a la firma de la migración; ninguna lectura directa de `abc_eventos`; errores como texto en los seis cargadores; traducciones; migración: STABLE, SECURITY DEFINER, `search_path`, capacidad, filtros, límite, columnas, permisos, aditiva) | OK |
| Averías provocadas de la pantalla (17) y de la migración sobre el contrato estático (6) | **23/23 detectadas, ninguna sobrevive a las dos pruebas**: de las 17 de pantalla, 16 las detecta la prueba de ejecución y 14 el contrato estático (la que cambia el error de `listarAutorizacionesDescuentoA09` solo la detecta el estático, porque esa función está fuera del bloque que carga la prueba de ejecución); las 6 de la migración las detecta el estático |
| Contrato `tests/cfg/cobro-lectura-static-contract.mjs` | actualizado: la lista de lecturas directas conocidas pasa a estar **vacía** |
| Regresión: `cfg1`…`cfg5` y `cfg6`, `cfg6d`, `cfg6e`, `d13`, `cobro-lectura` y `a09-eventos` (estáticos y de ejecución); contratos Node activos del manifiesto contra la versión anterior (170 ejecutados) | OK / resultados **idénticos** (el único que falla, `tests/netlify-publish-boundary.mjs`, falla igual antes del cambio) |
| Paridad de la fuente recuperada (`recuperar_candidato.py --check`) y `git diff --check` | PASS / limpio |

## Hallazgo relacionado, sin arreglar (a decidir por Pedro)

Las otras dos funciones del mismo panel, **`aplicarDescuentoCuentaA09`** (aplicar un descuento) y **`resolverAutorizacionDescuentoA09`** (aprobar o rechazar una autorización), siguen devolviendo el error **como objeto** y la pantalla lo dibuja igual: si fallan (por ejemplo, un perfil sin permiso para aplicar un descuento), **la pantalla se rompería en lugar de mostrar «Tu perfil no tiene permiso…»**. No las he tocado porque son acciones de escritura, no el historial; es el mismo cambio de una línea cada una.

## Límites

- **Nunca se ha visto el historial con descuentos reales**: QA no tiene ninguno aplicado. La lista de eventos con datos solo está comprobada con el contrato vivo del servidor y con la prueba de ejecución del cliente; en pantalla solo se puede ver que el panel abre sin romperse y sin cartel rojo.
- La ruta de aplicar y resolver descuentos **no se ha probado en pantalla**.
- Producción: no autorizada. Antes: registrar `a09-eventos-*` (y `cobro-lectura-*`) en la puerta de CI general, revisar si la migración `20260924004000` está allí (si lo está, el historial de descuentos se rompe igual) y aplicar la función nueva solo después.

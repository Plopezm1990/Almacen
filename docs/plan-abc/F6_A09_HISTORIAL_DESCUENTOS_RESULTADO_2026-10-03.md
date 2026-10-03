# F6 · A09 · historial de descuentos del TPV («permission denied for table abc_eventos») — resultado

Fecha: 2026-10-03
Autorización: Pedro eligió «Arreglar el historial de descuentos del TPV» como siguiente pieza (3/10/2026). **Solo QA** (proyecto `qjqorixtkilwsndqayyx`). Producción no consultada ni tocada.
Estado: `ARREGLADO_SERVIDOR_APLICADO_EN_QA_Y_VERIFICADO_CON_PRUEBAS_LOCALES_PENDIENTE_COMPROBAR_DE_NUEVO_EN_PANTALLA` (la primera comprobación con Cowork encontró el segundo fallo, ya arreglado)
Origen del hallazgo: `F6_COBRO_LECTURA_INTENTOS_RESULTADO_2026-10-03.md`, sección «Hallazgo relacionado».

## Qué fallaba

El historial de descuentos del TPV («Descuento / cortesía» → «Abrir» → «Auditoría A09 · historial») leía la tabla **`abc_eventos` directamente desde el navegador**, pero la migración `20260924004000` (ACL parity) **quita al navegador todo acceso directo a esa tabla** (guarda los eventos de todo el sistema, con sus cargas). Comprobado en QA el 3/10/2026 con `has_table_privilege`: el navegador no puede leerla.

Además, al revisarlo apareció un **segundo fallo, peor y anterior** (A09, 28/9): los cargadores del panel de descuentos devolvían el error **como un objeto** (`{ ok:false, error: respuestaErrorA06(error) }`, y esa función devuelve a su vez `{ ok:false, error:"texto", conflict… }`), y la pantalla guarda ese valor y lo **dibuja tal cual** (`"⚠ ", errorAuditoriaDescuentosA09`). Dibujar un objeto en React lanza «Objects are not valid as a React child» y **rompe la pantalla**. Es decir: con el permiso que faltaba, abrir el historial no mostraba un aviso: **rompía el TPV**; y cualquier otro error de esos cargadores (sin conexión, sin permiso…) haría lo mismo.

## Qué se ha hecho

| Parte | Qué es | Dónde |
|---|---|---|
| Servidor | Función nueva de solo lectura **`abc_listar_eventos_descuento_cuenta(empresa, local, cuenta)`**: devuelve **solo** los eventos `CUENTA_DESCUENTO_APLICADO` de esa cuenta, de esa empresa y ese local (los 100 más recientes, del más reciente al más antiguo) con las mismas seis columnas que pedía la pantalla (`operation_id`, `event_type`, `payload`, `actor_user_id`, `occurred_at`, `operating_day`); lista vacía si no hay. Exige poder operar cuentas en el local (`ABC_CUENTA_OPERAR`: los cuatro roles por plantilla, como `abc_recuperar_cuenta` o `abc_estado_cobro_cuenta`); sin sesión o sin esa capacidad: `descuento_eventos_no_autorizado`; sin cuenta: `descuento_eventos_parametros_invalidos`. SECURITY DEFINER, `search_path` vacío, permisos solo de `authenticated`. **Más estrecha que el acceso directo que había antes** (no expone otros tipos de evento ni otras cuentas). Migración aditiva (una función nueva, ni una tabla ni una función existente tocada) | `20261003120000_abc_a09_eventos_descuento_cuenta.sql` (en QA se registró como `20261003103727`) |
| Pantalla | El historial pide los eventos a esa función (parámetros exactos) en lugar de leer la tabla. Los **seis cargadores del panel** (`listarAutorizacionesDescuentoA09`, `listarDescuentosAplicadosA09`, `listarAuditoriaDescuentosA09`, `listarEfectosCajaA09`, `listarEfectosStockA09`, `listarFiscalizacionA09`) **y las dos acciones del mismo panel** (`aplicarDescuentoCuentaA09` y `resolverAutorizacionDescuentoA09`, ampliación que autorizó Pedro el mismo día) devuelven el error **como texto** (`respuestaErrorA06(error).error`): las diez salidas de error del panel. Dos errores nuevos traducidos al español: «Tu perfil no tiene permiso para ver el historial de descuentos de esta cuenta.» y «No se pudo identificar la cuenta para mostrar su historial de descuentos.» | `fuente.js` y `source-recovery/fuente-recuperado.js` (idénticos) |

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

## Ampliación autorizada por Pedro: «aplicar descuento» y «aprobar o rechazar una autorización»

Las otras dos funciones del mismo panel, `aplicarDescuentoCuentaA09` (aplicar un descuento) y `resolverAutorizacionDescuentoA09` (aprobar o rechazar una autorización), tenían el mismo defecto (error como objeto, que la pantalla dibuja y se rompe): por ejemplo, un perfil sin permiso para aplicar un descuento veía la pantalla rota en lugar de «Tu perfil no tiene permiso…». Pedro decidió arreglarlas también: es el mismo cambio de una línea en cada una de sus cuatro salidas de error (dos por función), solo cliente.

| Prueba | Resultado |
|---|---|
| Prueba de ejecución `tests/cfg/a09-acciones-ui-runtime.mjs` (lógica real `crearLogicaVenta` con React 18 en un navegador simulado y un servidor falso): sin permiso para aplicar y para autorizar, código de error dentro de la respuesta, error cualquiera, conflicto de versión (sigue marcándose), descuento aplicado, solicitud pendiente de autorización, validaciones previas, parámetros exactos de las dos llamadas | **15/15** con el arreglo. **Contra la versión anterior fallan 7** |
| Contrato estático (ampliado): las cuatro salidas de las dos funciones y una **guarda general**: ninguna salida de error de la aplicación puede volver a meter el objeto en el campo «error» (contra la versión anterior falla) | OK |
| Averías provocadas (8: cada una de las cuatro salidas, el conflicto siempre falso, aplicado sin marcar, resolver sin estado, resolver sin motivo) | **8/8 detectadas** por la ejecución (4 también por el estático) |

## Segundo fallo, encontrado en el preview con Cowork: el panel se quedaba colgado

**Qué vio Cowork** (con la versión que ya traía la función nueva): el panel «Descuento / cortesía» se abría sin cartel rojo, pero «Actualizando…» y «Cargando autorizaciones…» se quedaban fijos más de 20 segundos y no salía ningún dato: decía «Sin movimientos de caja asociados» aunque QA tiene el movimiento de caja del cobro de esa cuenta (la carga no había terminado).

**Diagnóstico** (Cowork, consola y lista de peticiones, solo mirar): un único rechazo de promesa, `ReferenceError: respuestaErrorA06 is not defined` en `listarDescuentosAplicadosA09 ← cargarAutorizacionesA09 ← abrirDescuentoCuentaA09`; todas las peticiones al servidor habían dado 200 o 201.

**Causa:** cinco de los cargadores del panel (`listarDescuentosAplicadosA09`, `listarAuditoriaDescuentosA09`, `listarEfectosCajaA09`, `listarEfectosStockA09`, `listarFiscalizacionA09`) viven dentro de `VentaRapida` (el TPV), pero usan dos ayudas, `leerContextoCuentaA02` (cinco usos) y `respuestaErrorA06` (cinco usos), que **solo existen dentro de `crearLogicaVenta`** y no llegaban al TPV ni como propiedades ni como funciones del módulo. En el navegador, `leerContextoCuentaA02` daba «not defined» dentro del `try`, el `catch` llamaba a `respuestaErrorA06` (tampoco definida) y el error escapaba: la carga de los seis cargadores (`Promise.all`) se rechazaba y la bandera de «cargando» no se bajaba nunca. **El historial de descuentos del TPV no ha funcionado nunca en el navegador** (desde A09, 28/9); el permiso de `abc_eventos` era solo el primero de los fallos.

**Por qué no lo vieron mis pruebas** (reconocimiento): la prueba de ejecución `a09-eventos-ui-runtime.mjs` que escribí antes extraía esas funciones sueltas y **les inyectaba las dos ayudas como parámetros**, así que ocultaba justo este fallo. La mantengo (prueba bien el trato de los datos y de los errores), pero ya no es la que da por bueno el panel.

**Arreglo** (solo cliente; no cambia el servidor): la lógica entrega las dos ayudas (`return` de `crearLogicaVenta`), la aplicación las recibe de la lógica y se las pasa al TPV, y el TPV las declara entre sus propiedades. Posiciones: en la lista que obtiene la aplicación van **al principio** (junto a `listarModalidadesA02`) porque el contrato A08.1 fija el final de esa lista; en las demás, al final.

**Contrato anterior ajustado (mío, de la pieza 6e):** `tests/cfg/cfg6e-ui-contract.mjs` fijaba cuatro cadenas exactas de esas listas (la firma del TPV, el elemento del TPV, el principio de la lista de la aplicación y el `return` de la lógica); las he actualizado con las dos ayudas nuevas. Ningún contrato anterior de otras piezas tuvo que cambiar por esto.

| Prueba | Resultado |
|---|---|
| Prueba de ejecución del panel **montado de verdad** `tests/cfg/a09-panel-ui-runtime.mjs` (la lógica real, el TPV real con React 18 en un navegador simulado, un servidor falso con los permisos de QA; se abre la cuenta, se pulsa «Abrir» en «Descuento / cortesía»): termina de cargar, el botón vuelve a «Actualizar», historial con título, eventos de descuento, efectos de caja, sin cartel rojo, parámetros exactos de la llamada, ninguna tabla sin permiso, «Cerrar», sin descuentos, errores que salen como texto y la carga termina, «Actualizar» repite la carga. Un rechazo que nadie recoge cuenta como fallo | **16/16** con el arreglo. **Contra la versión anterior fallan 15** y reproduce exactamente lo que vio Cowork (`ReferenceError: respuestaErrorA06 is not defined`) |
| Contrato de **alcance** `tests/cfg/alcance-static-contract.mjs` (analiza todo el código con un analizador de JavaScript y exige que **ningún identificador se use sin estar declarado**; solo admite el entorno, las librerías empaquetadas, los alias del recuperador y los fallos anotados) | OK. **Contra la versión anterior falla** y nombra las dos ayudas (líneas 120932 y 120948 del bundle) |
| Averías provocadas del cableado (10: la lógica sin cada ayuda, la aplicación sin recibir o sin pasar cada ayuda, el TPV sin declarar cada ayuda, el cargador de vuelta a la lectura directa, el error de vuelta a objeto) | **10/10 detectadas**. Las dos de «la aplicación no pasa la ayuda al TPV» solo las detecta el contrato estático (la aplicación entera no se puede montar en el navegador simulado) |

**Hallazgo del escaneo, sin arreglar (otro módulo):** el mismo análisis encuentra **un único identificador más de la aplicación sin declarar: `money`**, usado dos veces en el registro de **movimientos manuales de caja (PM-08)** (``registrarAuditoria?.("MOVIMIENTO_CAJA", `… ${money(imp)} …`)``). Después de guardar el movimiento en el servidor, esa línea lanza «money is not defined»: en la rama de la nube cae en el `catch` y la pantalla dice «No se pudo confirmar si el servidor recibió el movimiento. Reintenta…» **aunque el movimiento ya se guardó** (el reintento es idempotente, pero el aviso es falso); en la rama local, el error se propaga. No lo he tocado (otra pantalla, no autorizada); queda anotado en el contrato de alcance como fallo conocido, y el contrato falla si aparece otro identificador nuevo sin declarar o si `money` se arregla y no se quita de la lista.

## Límites

- **Nunca se ha visto el historial con descuentos reales**: QA no tiene ninguno aplicado. La lista de eventos con datos solo está comprobada con el contrato vivo del servidor y con la prueba de ejecución del cliente; en pantalla solo se puede ver que el panel abre sin romperse y sin cartel rojo.
- La ruta de aplicar y resolver descuentos **no se ha probado en pantalla** (solo con las pruebas de ejecución).
- Producción: no autorizada. Antes: registrar `a09-eventos-*` (y `cobro-lectura-*`) en la puerta de CI general, revisar si la migración `20260924004000` está allí (si lo está, el historial de descuentos se rompe igual) y aplicar la función nueva solo después.

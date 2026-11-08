# F6 · Arreglo de la lectura del cobro del TPV («permission denied for table pago_intentos») — resultado

Fecha: 2026-10-03
Autorización: Pedro eligió «Arreglar el error de la pantalla de cobro» como siguiente pieza (3/10/2026), tras terminar la prueba de devoluciones. **Solo QA.** Producción no consultada ni tocada.
Estado: `ARREGLADO_VERIFICADO_Y_COMPROBADO_EN_PANTALLA_CON_COWORK`
Origen del hallazgo: `F6_D13_DEVOLUCIONES_RESULTADO_2026-10-03.md`, sección «Hallazgo durante la prueba con Cowork».

## Qué fallaba

Tras cobrar en efectivo en el TPV (QA, 3/10/2026 08:46 UTC) salió el cartel rojo **«permission denied for table pago_intentos»**, aunque el cobro se había guardado bien (pago `CONFIRMADO` de 3,85 €, cobro `COMPLETADO`, entrada de caja). La causa estaba en la **lectura del estado del cobro** (`leerEstadoCobroF4`), que se ejecuta al cobrar y cada vez que se muestra la cuenta:

- consultaba **directamente la tabla `pago_intentos`** desde el navegador (desde `a5bca07`, 29/9, F4 B02-B03);
- pero la migración `20260924004000_abc_f2_m04d_acl_parity` (24/9) **quita al navegador el acceso directo** a esa tabla (y a `reservas_saldo`, `pago_aplicaciones`, `reembolso_aplicaciones`…); el navegador solo puede leer `checkouts`, `pagos` y `reembolsos` de ese bloque;
- esa consulta solo se ejecutaba cuando la cuenta **ya tenía algún pago** y QA no había tenido ninguno hasta hoy, por eso no se había visto.

**Efecto:** con cualquier pago en la cuenta, el panel de cobro del TPV mostraba ese error rojo cada vez que se leía su estado (sin impedir que el cobro se guardara).

## Qué se ha hecho

Solo cambio en la pantalla (no hay migración ni cambio de servidor): `leerEstadoCobroF4` **deja de consultar `pago_intentos`**. Los intentos ya llegaban por la función del servidor `abc_estado_pago_mixto_cuenta`, que la propia lectura llamaba justo antes y cuyos datos ya usaba para sustituir el resultado de la consulta directa; devuelve **exactamente los mismos 14 campos** (`id`, `pago_id`, `estado`, `provider_code`, `provider_reference`, `requested_amount`, `authorized_amount`, `captured_amount`, `settled_amount`, `authorization_status`, `capture_status`, `settlement_status`, `started_at`, `resolved_at`) y siempre como lista (vacía si no hay). Se quitaron 11 líneas por archivo (`fuente.js` y `source-recovery/fuente-recuperado.js`, idénticos). El resto de la lectura (resumen, checkouts, pagos, incidencias, cobro incierto, intento pendiente guardado en el navegador) no cambia.

## Pruebas hechas

| Prueba | Resultado |
|---|---|
| Prueba de ejecución `tests/cfg/cobro-lectura-runtime.mjs` (lógica real `crearLogicaVenta` con React 18 en un navegador simulado y un servidor falso que **reproduce los permisos de QA**: las 28 tablas sin lectura para el navegador devuelven «permission denied» y se anota quién las consulta) | **25/25** con el arreglo. **Contra la versión anterior fallan 16** (la que reproduce el error de QA) |
| Contrato estático `tests/cfg/cobro-lectura-static-contract.mjs` (función idéntica en `fuente.js` y en el fuente recuperado; sin lectura directa de `pago_intentos`; los intentos y el cobro incierto salen del servidor; `abc_estado_pago_mixto_cuenta` devuelve los 14 campos y el navegador puede llamarla; la migración de permisos quita la lectura; **ninguna lectura directa de la aplicación apunta a una tabla sin permiso salvo la anotada abajo**; lista de casos exigidos) | OK (contra la versión anterior falla) |
| Averías provocadas (17: volver la consulta directa, quitar los intentos del servidor, cada estado de cobro incierto, solo el primer intento, error del servidor ignorado, respaldo directo, leer otra tabla sin permiso, sin comprobar la conexión, estado fijo, resumen viejo, errores de pagos y de resumen ignorados, cuenta ausente como error) | **17/17 detectadas**: 17 por la ejecución y 12 también por el estático (las otras 5, de comportamiento, solo por la ejecución) |
| Regresión: `cfg1`…`cfg5` estáticos, `cfg6`, `cfg6d`, `cfg6e` y `d13` (estáticos y de ejecución) | OK |
| Regresión de los contratos Node activos del manifiesto contra la versión anterior (170 ejecutados) | resultados **idénticos** (el único que falla, `tests/netlify-publish-boundary.mjs`, falla igual antes del cambio) |
| Paridad de la fuente recuperada (`recuperar_candidato.py --check`) y `git diff --check` | PASS / limpio |

Lista de tablas sin lectura para el navegador (comprobada en QA con `has_table_privilege`, solo lectura, 3/10/2026): `tests/cfg/lib/tablas-sin-acceso-qa.mjs`.

## Hallazgo relacionado (arreglado después, ver `F6_A09_HISTORIAL_DESCUENTOS_RESULTADO_2026-10-03.md`)

Consultando todas las lecturas directas de la aplicación contra los permisos de QA aparece **una más de la misma clase**: el **historial de descuentos del TPV** (`abc_descuento_*`, pieza A09) lee **`abc_eventos`** directamente y recibiría «permission denied for table abc_eventos»; como la carga hace `Promise.all` y lanza si cualquiera falla, **el panel de auditoría de descuentos no cargaría**. No lo arreglé en esta pieza (otra pantalla, no autorizada); Pedro lo eligió como siguiente pieza y quedó arreglado el mismo día con una función del servidor. Queda anotado en `tests/cfg/lib/tablas-sin-acceso-qa.mjs` (`LECTURAS_DIRECTAS_CONOCIDAS`): el contrato estático falla si aparece **otra** lectura directa nueva o si esa se arregla y no se quita de la lista. Hace falta decidir cómo se leerían esos eventos (una función del servidor que devuelva los eventos de descuento de la cuenta).

## Comprobación en pantalla con Cowork (3/10/2026)

- **Primer intento (12:12 hora local, 10:12 UTC): el cartel seguía saliendo.** Cowork miró en la pestaña que ya tenía abierta, un minuto después de que Netlify diera por terminado el preview con el arreglo (10:11:11 UTC); navegar dentro de la aplicación no vuelve a descargar el código. Comprobación de que no era un fallo del servidor (QA, solo lectura, en una transacción que se revierte, con la identidad del Propietario): `abc_estado_cobro_cuenta`, `abc_estado_pago_mixto_cuenta` y `abc_listar_incidencias_cobro` responden sin error de permisos sobre la cuenta pagada (`PAGADO`, confirmado 3,85, saldo 0; el intento llega con los mismos campos).
- **Segundo intento (12:24–12:25 hora local), en una pestaña nueva con recarga completa:** en la página cargada **ningún archivo `.js` contiene `from("pago_intentos")`** (comprobado desde la consola con una lectura de todos los scripts cargados). TPV → cuenta «Porción de tarta (QA)» (SERVIDA): **Total €3,85, Confirmado €3,85, Pendiente €0,00, «Cuenta: PAGADO · Último intento: Confirmado»**; **el cartel «permission denied for table pago_intentos» ya no aparece** (0 coincidencias), y tampoco los botones «Cobrar efectivo» ni «Iniciar tarjeta simulada» porque la cuenta está pagada. Antes salía «Confirmado €0,00 / Pendiente €3,85», que es lo que enseña la pantalla cuando la lectura falla.
- **Límite:** no se hizo un cobro nuevo con la versión nueva; la lectura que falla se ejecuta igual en cada cobro (al terminar de cobrar y al mostrar la cuenta), y se probó aquí sobre la cuenta con pagos.

## Para promocionar a producción (no autorizado)

Registrar `cobro-lectura-*` en la puerta de CI general junto con las demás pruebas nuevas; revisar si en producción está aplicada la migración `20260924004000` (si lo está, el cobro con pagos falla igual en producción hasta publicar este arreglo).

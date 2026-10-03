# F6 · D13 devoluciones: nada sale sin aprobar — resultado

Fecha: 2026-10-03
Autorización: «D13: devoluciones» con las decisiones **A · Servidor, permiso y pantalla**, **B · Encargado y Propietario aprueban**, **C · Lo que solicita un Encargado o el Propietario se aprueba en el acto** y **D · El Cajero/a no puede solicitar por defecto; lo activa el Propietario en Configuración → Permisos**, Pedro, 3/10/2026.
**Solo QA** (proyecto `qjqorixtkilwsndqayyx`). Producción no consultada ni tocada; su promoción **no está autorizada**.
Estado: `IMPLEMENTADA_PROBADA_EN_PANTALLA_CON_COWORK_Y_VERIFICADA_EN_QA` (queda sin probar en pantalla lo que necesita otro usuario o un proveedor: ver «Límites»)
Plan de partida: `F6_D13_DEVOLUCIONES_HALLAZGOS_Y_PLAN_2026-10-03.md`. Guía de prueba: `F6_PRUEBA_PREVIEW_DEVOLUCIONES_2026-10-03.md`.

## Qué se ha hecho

| Paso | Qué es | Dónde |
|---|---|---|
| D13-1 · Servidor: nada sale sin aprobar | `abc_solicitar_reembolso` **ya no encola el envío al proveedor** cuando quien solicita no puede confirmar: deja la solicitud `PENDIENTE` **sin aprobar** y no sale nada. Quien sí puede confirmar (Encargado y Propietario) queda **aprobado en el acto** y, si el pago no es en efectivo, se encola el envío como hasta ahora. Función nueva **`abc_aprobar_reembolso`** (capacidad `ABC_REEMBOLSO_CONFIRMAR`): la solicitud tiene que estar `PENDIENTE` y sin aprobar, **nadie aprueba lo que solicitó él mismo**, deja constancia de quién y cuándo y **entonces** encola el envío si no es efectivo. Rechazar sigue siendo `abc_cancelar_reembolso` (con motivo). `abc_confirmar_reembolso_efectivo` exige que esté aprobado. Dos columnas nuevas (`aprobado_por`, `aprobado_at`, las dos o ninguna) en lugar de un estado nuevo: **la máquina de estados no cambia**. Eventos de auditoría `REEMBOLSO_SOLICITADO` (con `requiere_aprobacion`) y `REEMBOLSO_APROBADO` (automática o manual) | Migración aditiva `20261003100000_abc_config_d13_reembolsos_aprobacion.sql` (comprobaciones de huella md5 de las cinco funciones que reemplaza, `create or replace`, permisos solo de `authenticated`) |
| D13-2 · Permiso | `ABC_REEMBOLSO_SOLICITAR` pasa a poder darse al **Cajero/a** (techo nuevo «CAJERO»); `ABC_REEMBOLSO_CONFIRMAR` **sigue con techo Encargado**. Por defecto el cajero **no** lo tiene: lo activa el Propietario en la matriz de Configuración → Permisos | Catálogo de capacidades de la pieza 5 (`abc_cap_catalogo`, `abc_cap_techo_permite`) |
| D13-3 · Pantalla | En «Devoluciones → Reembolso económico»: lo solicitado por quien necesita aprobación sale **«Pendiente de aprobación»**, con el texto «Esperando a que la apruebe un Encargado o el Propietario. Hasta entonces no sale dinero.». Quien puede aprobar ve **Aprobar** y **Rechazar solicitud** (con motivo); no se le ofrece Aprobar lo que solicitó él mismo («Tiene que aprobarla otra persona…»). El efectivo **no ofrece «Confirmar efectivo» hasta que esté aprobado**. Una solicitud ya aprobada se cancela como siempre y muestra «Aprobada el …». Avisos antes de solicitar: sin permiso («Tu usuario no tiene permiso para solicitar reembolsos. El Propietario puede activarlo en Sistema → Configuración → Permisos.», botón desactivado) o con aprobación («Lo que solicites quedará pendiente de aprobación: no sale dinero hasta que un Encargado o el Propietario lo apruebe.»). Los permisos se **leen del servidor** (`abc_obtener_capacidades_rol`); si no se pueden leer, la pantalla se comporta como antes y decide el servidor. Cinco errores nuevos traducidos al español. Las etiquetas de la matriz de permisos pasan a «Solicitar devoluciones (el Cajero/a necesita aprobación)» y «Aprobar y confirmar devoluciones» | `ReembolsosEconomicosB08`, `mensajeErrorReembolsoB08`, `Devoluciones` y la matriz de «Configuración» (en `fuente.js` y en `source-recovery/fuente-recuperado.js`, idénticos) |

## Qué no cambia

- El saldo reembolsable (cobrado − devuelto − reservado), el bloqueo ordenado contra solicitudes simultáneas, la guarda de moneda, el movimiento negativo de caja del efectivo, `abc_cancelar_reembolso`, `abc_resolver_reembolso` (sigue siendo solo del sistema) y el stock (un reembolso económico no devuelve stock).
- La vista «De cliente» (sistema anterior) queda fuera de D13, como se dijo en el plan.
- Las solicitudes que ya existían en la base se dan por **aprobadas al solicitarse** (así funcionaban y, si no eran en efectivo, ya estaban encoladas). QA no tenía ninguna.
- Los contratos históricos de reembolsos (`tests/f2/m03c`, `m04c`, `m04d`, `tests/f4/b08`) **no se han modificado**: usan listas fijas de migraciones que no incluyen D13.

## Contratos anteriores que tuve que actualizar (a la vista)

- `tests/cfg/cfg5-contract.sql` y `cfg5-static-contract.mjs` (pieza 5) fijaban que el cajero **no podía recibir** `ABC_REEMBOLSO_SOLICITAR` (techo Encargado), que es justo lo que cambia D13. Los he adaptado: ahora la comprobación es sobre `ABC_REEMBOLSO_CONFIRMAR` (techo Encargado, el cajero sigue sin poder) y sobre el techo «CAJERO» de solicitar. El resto de la pieza 5 queda igual (154/154).
- Ningún otro contrato anterior se ha modificado.

## Pruebas hechas

| Prueba | Resultado |
|---|---|
| Contrato vivo del servidor `tests/cfg/d13-contract.sql` en réplica local (PostgreSQL 16, cadena completa de migraciones, roles suplantados): solicita cajero/encargado/propietario, el cajero no aprueba, nadie aprueba lo suyo, aprobar encola una sola vez, rechazar libera saldo, efectivo sin aprobar no se confirma, idempotencia, errores, eventos, permisos | **85/85** |
| El mismo contrato **en QA** (con `ROLLBACK`, sin residuos; migración registrada; dos columnas nuevas; función con permisos solo de `authenticated`) | **85/85** |
| Prueba de actualización `tests/cfg/d13-upgrade.sh` (base de la pieza 5 con reembolsos antiguos → migración → las filas antiguas quedan aprobadas por quien las solicitó y a la hora de la solicitud) | **20/20** (12 + 8) |
| Contrato estático del servidor `tests/cfg/d13-static-contract.mjs` | OK |
| Averías provocadas del servidor | **32 en el contrato vivo y la actualización y 29 en el estático: todas detectadas** |
| Contrato estático de pantalla `tests/cfg/d13-ui-contract.mjs` (bloque idéntico en `fuente.js` y en el fuente recuperado; nombres y orden de parámetros frente a las migraciones; solo lectura; permisos; filas; mensajes; errores; el rol llega desde la aplicación; lista de casos de ejecución exigidos) | OK |
| Prueba de ejecución `tests/cfg/d13-ui-runtime.mjs` (pantalla real con React 18 en un navegador simulado y un servidor falso `tests/cfg/lib/servidor-reembolsos-falso.mjs` que imita las reglas de la migración): cajero con y sin permiso, encargado que aprueba, rechaza y confirma efectivo, propietario, permisos desconocidos, errores, cambio de rol, pestaña Devoluciones, doble disparo de «Aprobar» | **50/50** |
| Averías provocadas de la pantalla (40: textos, permisos, estados, botones, parámetros, columnas, traducciones, recarga, rol, doble disparo) | **40/40 detectadas** por la ejecución o por el estático; **37 por la ejecución y las 3 restantes** (el rol que pasa la aplicación y las dos etiquetas de la matriz, que están fuera del módulo que se carga en la prueba de ejecución) **por el estático** |
| Regresión de las pruebas anteriores: `cfg1`…`cfg5` y `cfg6d` estáticos, `cfg6` y `cfg6d` y `cfg6e` de pantalla (contrato y ejecución); contratos vivos `cfg1` 102/102, `cfg2` 201/201, `cfg3` 79/79, `cfg4` 72/72, `cfg5` 154/154, `cfg6d` 56/56 sobre la cadena completa | OK |
| Regresión de los contratos Node activos del manifiesto contra la versión anterior (170 ejecutados) | resultados **idénticos** (el único que falla, `tests/netlify-publish-boundary.mjs`, falla igual antes del cambio) |
| Paridad de la fuente recuperada (`recuperar_candidato.py --check`) y `git diff --check` | PASS / limpio |

Las primeras averías de pantalla dejaron **7 supervivientes de ejecución** (y uno, el doble disparo de «Aprobar», sobrevivió también al estático): eran huecos de la prueba. Se añadieron cinco casos de ejecución (D3b, D7 a D10) y una comprobación estática, y ahora ninguna sobrevive a ambas.

## Estado de QA (solo lectura, 3/10/2026)

0 pagos y 0 reembolsos; 2 sesiones de caja abiertas; columnas `aprobado_por` y `aprobado_at` presentes; función `abc_aprobar_reembolso` presente. **No hay ningún reembolso real** con el que probar en pantalla: hace falta un cobro de prueba (ver la guía).

## Límites (dichos tal cual)

- **Nunca se ha visto la pantalla con un reembolso real**: QA no tiene pagos. La guía explica cómo generar un cobro **en efectivo** desde el TPV. Un cobro con tarjeta simulada **se queda pendiente** (no hay proveedor), así que la devolución de un pago con tarjeta **solo se prueba con las pruebas automáticas** (aprobar encola el envío una sola vez).
- **Un Cajero/a no se puede probar en pantalla** (no hay otro usuario de QA); está cubierto por las pruebas automáticas.
- **Sin proveedor conectado:** aprobar una devolución que no es en efectivo solo deja el envío en la cola; nadie la consume todavía (es lo previsto).
- La vista «De cliente» y los reembolsos antiguos no pasan por este flujo.
- No he capturado la pantalla en Chromium con el estilo real (en 6d y 6e sí): lo puedo hacer si Pedro lo pide.

## Hallazgo durante la prueba con Cowork (3/10/2026): la pantalla de cobro falla al leer tras cobrar (no es de D13)

Al generar el cobro de prueba en efectivo desde el TPV, Cowork vio el cartel rojo «permission denied for table pago_intentos» justo después de pulsar «Cobrar efectivo» y paró. En QA (solo lectura) **el cobro sí se había guardado**: un pago EFECTIVO `CONFIRMADO` de 3,85 € (08:46:57 UTC), su intento `CONFIRMADO` y su cobro `COMPLETADO`.

- **Causa:** `leerEstadoCobroF4` (introducida el 29/9 en `a5bca07`, F4 B02-B03) consulta directamente la tabla `pago_intentos`, pero la migración `20260924004000_abc_f2_m04d_acl_parity` (24/9) quita al navegador todo acceso directo a esa tabla (las mutaciones y las lecturas sensibles van por funciones del servidor). La consulta directa solo se ejecuta cuando la cuenta ya tiene algún pago, y QA no tenía ninguno, por eso no se había visto.
- **Efecto:** mientras una cuenta tenga pagos, el panel de cobro del TPV muestra ese error cada vez que lee su estado, aunque el cobro haya salido bien.
- **Arreglo previsto (no hecho, pendiente de autorización de Pedro):** dejar de consultar `pago_intentos` desde el navegador y usar los intentos que ya devuelve la función `abc_estado_pago_mixto_cuenta` (la pantalla ya los usa para sustituir el resultado de la consulta directa). Cambio pequeño en la pantalla, con contrato de ejecución con servidor falso que reproduzca la ACL.
- **Decisión de Pedro (3/10/2026):** terminar primero la prueba de devoluciones y arreglar el cobro después, como pieza aparte.
- **Arreglado el mismo día (solo QA) y comprobado en pantalla con Cowork:** `F6_COBRO_LECTURA_INTENTOS_RESULTADO_2026-10-03.md`. Allí se anota además otra lectura directa de la misma clase (`abc_eventos`, historial de descuentos) que no se ha tocado.
- **No impide probar devoluciones:** la pantalla de devoluciones solo lee `pagos`, que sí es legible; Cowork sigue desde el paso 2 con ese cobro de 3,85 €.
- **Producción:** es un bloqueo a revisar antes de promocionar (si la migración m04d ya está allí, el cobro con pagos fallaría igual).

## Prueba en pantalla con Cowork (3/10/2026) y comprobación independiente en QA (solo lectura)

Pedro pasó a Cowork (agente que maneja el navegador con la sesión de Pedro) el guion `F6_PROMPT_COWORK_DEVOLUCIONES_2026-10-03.md` en el preview 118 (Propietario, Local A1). Lo que hizo y lo que dice QA:

| Paso | Qué vio Cowork | Qué dice QA |
|---|---|---|
| 0 · Versión nueva | Las filas «Solicitar devoluciones (el Cajero/a necesita aprobación)» (Cajero/a sin marcar y **sin candado**) y «Aprobar y confirmar devoluciones» (Cajero/a **con candado**) con el texto nuevo, tras recargar (la primera carga era de caché) | — |
| 1 · Cobro en efectivo de 3,85 € | Para que saliera el panel de cobro hizo falta avanzar el pedido (iniciar preparación, marcar preparada, servir): el guion no lo decía. Al cobrar salió «permission denied for table pago_intentos» | Pago EFECTIVO `CONFIRMADO` de 3,85 €, cobro `COMPLETADO`, entrada de caja de 3,85 € (ver «Hallazgo» más arriba) |
| 2 · Solicitar 1 € como Propietario | Sin avisos de permiso. «Solicitud creada como PENDIENTE. El simulador no envía dinero a un proveedor real.» Fila «Pendiente» con «Aprobada el …» y los botones «Confirmar efectivo» y «Cancelar solicitud» (sin «Aprobar» ni «Rechazar solicitud») | `REEMBOLSO_SOLICITADO` con `requiere_aprobacion = false` y `REEMBOLSO_APROBADO` con `automatica = true` en el mismo instante; `aprobado_por` = `created_by` = el Propietario |
| 3 · Cancelar | «Solicitud cancelada y saldo liberado.»; la fila «Cancelado»; el disponible vuelve a 3,85 | `REEMBOLSO_CANCELADO` con el motivo; estado `CANCELADO` |
| 4 · Solicitar 1 € y confirmar efectivo | «Reembolso en efectivo confirmado. Se ha creado un único movimiento negativo de caja.»; la fila «Confirmado»; disponible 2,85 | `REEMBOLSO_EFECTIVO_CONFIRMADO`; movimiento negativo de 1,00 € en la sesión de caja |
| 5 · Resto | Se solicitó y confirmó 1,85 € (disponible 1,00 €) | Movimiento negativo de 1,85 €. Saldo de la sesión de caja: 3,85 − 1,00 − 1,85 = **1,00 €** |
| 6 · Permiso del Cajero/a | Se pudo marcar «Solicitar devoluciones» (sin candado) con «1 cambio guardado en el servidor.»; «Aprobar y confirmar devoluciones» siguió con candado | Evento `CAPACIDAD_ROL_CONFIGURADA` (`ABC_REEMBOLSO_SOLICITAR`, Cajero/a, QA-A1, `efectivo_antes = false`, `efectivo_despues = true`) |

- **Ninguna cola de proveedor:** 0 efectos `PROVIDER_REEMBOLSO` (el pago era en efectivo). Los tres reembolsos tienen `aprobado_por` y `aprobado_at`.
- **Error mío en un importe:** el mensaje que di a Cowork decía que el último importe era 1,85 y era 2,85 (lo cancelado no resta), por eso quedó 1,00 € disponible y la caja con 1,00 € de más. No es un fallo de la aplicación.
- **Incidente de Cowork en el paso 6 (revertido):** al deshacer el permiso, un clic por coordenadas cayó en otra celda y guardó una decisión que **quitó «Cobrar en efectivo» al Cajero/a** del Local A1 (evento a las 09:08:04 UTC; Cowork lo había descrito como «Encargado», pero QA dice Cajero/a). Con instrucciones por nombre accesible y comprobación previa («Guardar 2 cambios»), Cowork pulsó «volver a lo normal» en las dos celdas (`ABC_COBRO_EFECTIVO` y `ABC_REEMBOLSO_SOLICITAR`, Cajero/a) a las 09:14:13 UTC. QA lo confirma: las dos filas de `abc_capacidades_rol` quedan con `permitido = null` (versión 2) y hay dos eventos de auditoría (efectivo_despues = true para el cobro y = false para solicitar devoluciones). Es solo QA, Local A1, rol Cajero/a, y no se tocó el Encargado.
- **Reembolso sin confirmar (cerrado después):** Cowork hizo el paso opcional de dejar la caja a cero, solicitó el 1,00 € restante (09:15:10 UTC, aprobado en el acto) y no pudo confirmarlo por un fallo transitorio de su propio sistema de seguridad. Lo reintentó y quedó **confirmado a las 10:04:17 UTC**. Estado final en QA: cuatro reembolsos (uno `CANCELADO` de 1,00 € y tres `CONFIRMADO` de 1,00, 1,85 y 1,00 €, que suman los 3,85 € cobrados), pago en `REEMBOLSADO`, saldo de la sesión de caja de A1 **0,00 €**, 0 envíos pendientes y ninguna decisión de permisos guardada.

## Para promocionar a producción (no autorizado)

Además de lo ya anotado en piezas anteriores (registrar las pruebas `cfg1`…`cfg6e` y `d13` en la puerta de CI general, comprobaciones de huella md5, titulares de los roles, contratos históricos):

1. Aplicar `20261003100000` solo si las cinco funciones coinciden con las de QA (la migración se niega a aplicarse si no).
2. Revisar que ningún proveedor consuma `PROVIDER_REEMBOLSO` antes de dar `ABC_REEMBOLSO_SOLICITAR` a cajeros.
3. Decidir qué se hace con los contratos históricos F2/F4 de reembolsos cuando la cadena de CI incluya D13.

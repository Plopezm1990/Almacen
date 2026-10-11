# F6 · pieza 6e: modalidad al abrir cuenta en el TPV — resultado

Fecha: 2026-10-02
Autorización: «6e: modalidad al abrir cuenta» con las decisiones **A · Automática y selector** y **B · Todas las habilitadas (incluidas Mesa y Terraza)**, Pedro, 2/10/2026.
**Solo QA.** Producción no consultada ni tocada. **Esta pieza no toca el servidor ni QA**: no hay migración nueva ni se ha escrito ni leído nada en QA (el servidor ya tenía todo desde la pieza 3).
Estado: `IMPLEMENTADA_VERIFICADA_Y_PROBADA_POR_PEDRO_EN_PANTALLA`
Plan de partida: `F6_PIEZA6E_MODALIDAD_AL_ABRIR_CUENTA_PLAN_2026-10-02.md`. Guía de prueba: `F6_PRUEBA_PREVIEW_MODALIDAD_CUENTA_2026-10-02.md`.

## Qué se ha hecho

| Paso | Qué es | Dónde |
|---|---|---|
| 6e-1 · Modalidad automática | Al **crear** un pedido nuevo, `venderCarritoA02` lee las modalidades habilitadas del local (`abc_obtener_modalidades_local`) y abre la cuenta en **Barra si está habilitada** (como hasta ahora) y, si no, en **la primera habilitada** que da el servidor. Si no se puede leer la lista (sin conexión, error, lista vacía o lanza una excepción), **se queda en Barra como antes** y decide el servidor. Un pedido pendiente (uno que falló o se cortó a medias) **conserva su modalidad y su identificador de operación** aunque el cajero cambie de idea al reintentar | `venderCarritoA02` y tres ayudas nuevas (`leerModalidadesHabilitadasA02`, `resolverModalidadAperturaA02`, `listarModalidadesA02`) |
| 6e-2 · Selector en el carrito | Encima de «Guardar pedido», **«Tipo de cuenta»** con botones (Barra, Mesa, Terraza, Para llevar, Otro; solo las habilitadas). **Solo aparece si hay más de una habilitada y el carrito tiene productos**; Barra viene elegida (o la primera si Barra no está habilitada); no recuerda la última elección; no se puede cambiar mientras se guarda. La confirmación dice «Modalidad: …». Si el servidor la rechaza porque cambió mientras tanto, se explica, **se recarga la lista** y se puede elegir otra | `VentaRapida` (carrito y confirmación) |
| 6e-3 · Configuración y mensajes | **Barra ya se puede deshabilitar** en «Configuración → Modalidades» (el servidor sigue exigiendo que quede al menos una); el texto explica cómo decide el TPV. `modalidad_no_habilitada:<X>` se traduce: «La modalidad «Mesa» no está habilitada en este local. Elige otra o pide al Propietario que la habilite en Configuración.» (también en la sala, que cambia la modalidad al asignar mesa) | `errorRpcA02`, pantalla «Configuración» |

Reglas de decisión (por este orden): la modalidad **elegida**, si existe y está habilitada (si no lo está, no se llama al servidor: se rechaza con el mensaje de arriba); **Barra** si está habilitada; **la primera** habilitada; **Barra** si no hay lista.

## Hallazgo extra (arreglado)

**Los errores de «Guardar pedido» no se veían nunca.** El texto del error solo se pintaba dentro de la ventana de cobro antigua, que está desactivada (`false && showCobro`). Con Barra deshabilitada y el código anterior, el cajero habría pulsado «Guardar pedido» y **no habría pasado nada visible**. Ahora hay un aviso (`role="alert"`) en el propio carrito, justo encima del selector, con los colores del tema (legible en claro y en oscuro). Vale también para los demás errores de guardar (sin stock, red, etc.).

## Qué no cambia

- El servidor, las cuentas ya abiertas (si una modalidad se deshabilita, sus cuentas siguen funcionando), el cobro, el envío a cocina ni el cierre de caja.
- La modalidad es una **etiqueta**: «Para llevar» y «Otro» no activan ningún flujo propio (ni fiscal ni de cocina). Lo único que cambia el servidor es poner Mesa o Terraza al asignar una mesa en la sala.
- El orden de las propiedades y de las listas que ya comprobaban contratos antiguos (A05.2, A06.1, A08.1, P07): las piezas nuevas se han colocado **al final** o delante sin alterar lo que esos contratos exigen.

## Comprobación antigua que tuve que actualizar (a la vista)

`tests/f3/a02/a02-1-contract.mjs` exigía literalmente `modalidad: "BARRA"` en el adaptador («VentaRapida debe mapearse explícitamente a BARRA»). Eso es justo lo que cambia D02, así que **la he sustituido** por cuatro comprobaciones equivalentes en espíritu: el registro pendiente lleva la modalidad decidida, se decide con `resolverModalidadAperturaA02`, sin lista se abre en Barra y por defecto gana Barra cuando está habilitada. El resto del contrato A02.1 queda igual. Es el único contrato anterior modificado.

## Pruebas hechas (todas locales: esta pieza no toca QA)

| Prueba | Resultado |
|---|---|
| Contrato estático `tests/cfg/cfg6e-ui-contract.mjs` (paridad exacta entre `fuente.js` y el fuente recuperado; nombres y **valores** de parámetros frente a las migraciones; la modalidad no sale de una constante; el registro pendiente la conserva; traducciones; aviso del carrito; selector; Barra desbloqueada; lista de los casos de ejecución exigidos) | OK |
| Prueba de ejecución `tests/cfg/cfg6e-ui-runtime.mjs` (lógica real `crearLogicaVenta` y TPV real `VentaRapida` con React 18 en un navegador simulado y un servidor falso con la guarda de modalidades de la pieza 3, que ahora también simula excepciones, respuestas a medias y respuestas lentas) | **77/77** (con la primera versión de la prueba, 58 casos, el código anterior a la pieza fallaba 20 de los 32 que se podían ejecutar contra él) |
| Averías provocadas (52: lectura de la lista, filtrado, orden, elección, rechazo, pedido pendiente, descarte con cuenta abierta, parámetros, traducciones, marca de error, selector, estado, recarga, cambio de local, bloqueo mientras guarda, confirmación, aviso del carrito, Configuración) | **52/52 detectadas**: 50 por la prueba de ejecución, 51 por el contrato estático; las 2 restantes (Barra bloqueada y texto antiguo de Configuración) por los contratos de la pieza 6 |
| Regresión de la pantalla «Configuración» y piezas anteriores (`cfg1`…`cfg5` estáticos, `cfg6` contrato y ejecución, `cfg6d` estático, contrato y ejecución) | OK (se ajustó el caso «Barra se puede deshabilitar» de la pieza 6, que antes comprobaba que estaba bloqueada) |
| Regresión de los contratos Node activos del manifiesto contra la versión anterior (170 ejecutados) | resultados **idénticos** (el único que falla, `netlify-publish-boundary.mjs`, falla igual antes del cambio) |
| Paridad de la fuente recuperada (`recuperar_candidato.py --check`) y `git diff --check` | PASS / limpio |
| Capturas en Chromium con la hoja de estilos real (escritorio claro y móvil oscuro): todas habilitadas, «Para llevar» elegida, sin Barra, error de modalidad, solo Mesa (sin selector) | selector y aviso legibles; sin desborde |

Las primeras averías provocadas dejaron **11 supervivientes** de ejecución que en realidad eran huecos de la prueba (Barra gana aunque la lista llegue en otro orden; una lectura que lanza una excepción o contesta con error y datos; descartar un pedido pendiente cuando la cuenta ya estaba abierta; reiniciar al cambiar de local; desactivar el selector mientras guarda; título y tamaño táctil del selector). Se añadieron 19 casos y ahora no sobrevive ninguna.

## Prueba de Pedro en el preview 118 (3/10/2026) y comprobación en QA (solo lectura)

Pedro probó con la guía `F6_PRUEBA_PREVIEW_MODALIDAD_CUENTA_2026-10-02.md` (pruebas 1 a 3; la 4, opcional, no) y dijo «hecho». Lo registrado en QA (sesión de caja `8d1397b9`, QA-A1):

| Prueba | Qué dice QA |
|---|---|
| 1 · Elegir «Para llevar» y guardar | Cuenta `f655f75c` con `modalidad = TAKEAWAY` (07:16:41 UTC). El pedido se envió a cocina y se canceló después: `PEDIDO_CANCELADO` y comanda de cancelación; pedido y línea en `CANCELADO/CANCELADA` |
| 2 · Deshabilitar Barra | `MODALIDAD_LOCAL_CONFIGURADA` 07:20:09, BARRA de `true` a `false`, motivo «NO HAY BARRA». Ya se pudo desmarcar (antes estaba bloqueada) |
| 2 · Guardar con Barra deshabilitada | Cuenta `2d84933b` con `modalidad = MESA` (la primera habilitada, como dice la regla automática; 07:21:07). Sin error. Pedido cancelado |
| 3 · Volver a habilitar Barra | `MODALIDAD_LOCAL_CONFIGURADA` 07:22:22, BARRA a `true`, motivo «ACTIVAMOS BARRA». **Ninguna modalidad deshabilitada** (las cinco habilitadas: Barra y Terraza con fila propia, el resto por defecto) |

- **Todo coincide con lo esperado.** La regla automática (Barra, o la primera habilitada) y la modalidad elegida llegan a `cuentas_comerciales.modalidad`; el día operativo de los eventos es 2026-10-03.
- **Quedan dos cuentas abiertas y vacías** (`f655f75c` y `2d84933b`) con sus pedidos cancelados, como avisaba la guía. **No bloquean el próximo cierre de caja:** los bloqueos del cierre son solo pagos y efectos pendientes y no hay ninguno.
- La sesión de caja de QA-A1 queda **abierta** (`8d1397b9`, desde las 07:15 UTC del 3/10). La sesión antigua de QA-A2 (25/9) sigue abierta; no se ha tocado.
- Lo que la base de datos no enseña (que el selector se vea bien, los textos y los colores) depende de lo que Pedro vio: no avisó de nada raro. La prueba opcional 4 (la modalidad cambia mientras tanto) se hizo después con Cowork: ver la sección siguiente.

## Prueba opcional 4 con dos pestañas (3/10/2026, agente de navegador Cowork) y comprobación en QA

Cowork siguió el guion con la sesión de Pedro (todos los pasos en OK; los textos de pantalla coinciden con los previstos, incluido el aviso rojo dentro del carrito). Lo registrado en QA, de forma independiente:

| Paso | Qué dice QA |
|---|---|
| Pestaña 2: desmarcar Mesa (motivo «prueba 6e dos pestañas») | `MODALIDAD_LOCAL_CONFIGURADA` 07:48:36 UTC: MESA de `true` a `false`, versión 1 |
| Pestaña 1: «Guardar pedido» con Mesa elegida (rechazo) | **No se creó ninguna cuenta** con ese intento: entre 07:48:36 y la siguiente apertura no hay `CUENTA_ABIERTA` |
| Pestaña 1: guardar de nuevo, ya en Barra | `CUENTA_ABIERTA` 07:49:10, cuenta `ea9b1d2b` con `modalidad = BARRA`; pedido creado y, a 07:49:56, `PEDIDO_CANCELADO` con motivo «prueba» |
| Restaurar Mesa (motivo «prueba 6e restaurar») | `MODALIDAD_LOCAL_CONFIGURADA` 07:50:46: MESA a `true`, versión 2 |

- **Estado final:** ninguna modalidad deshabilitada (Barra, Mesa y Terraza con fila propia; Para llevar y Otro por defecto). Cinco habilitadas.
- **Cuentas de prueba:** quedan tres cuentas abiertas y vacías (`f655f75c` Para llevar, `2d84933b` Mesa, `ea9b1d2b` Barra) con sus pedidos cancelados. No bloquean el cierre (solo lo bloquean pagos y efectos pendientes, y no hay ninguno).
- **Caja:** la sesión actual de A1 es `6be7b6af` (`ABIERTA`, desde 07:46 UTC). La sesión antigua de QA-A2 (25/9) sigue abierta; no se ha tocado.
- Con esto, **las cuatro pruebas de la guía de la 6e están hechas en pantalla y comprobadas en QA.**

## Límites

- **Sin credenciales de QA no he podido ver la pantalla funcionando**: la primera vez real será en el navegador de Pedro (guía de prueba).
- El Cajero/a solo se prueba con las pruebas automáticas (no hay otro usuario de QA).
- Si dos terminales cambian la configuración a la vez, el rechazo del servidor se explica y se recarga la lista, pero el pedido en el carrito no se mueve solo: hay que volver a elegir.
- La cadena de reconstrucción exacta del bundle (`CURRENT_RELEASE.patch`) la regenera la integración continua.

## Producción

**No autorizada.** Antes de promocionar: registrar las pruebas nuevas (`cfg1`…`cfg6e`) en la puerta de CI general (hoy en rojo por esa causa conocida), comprobaciones de huella (md5) en las migraciones, titulares de los roles y los contratos históricos A05–A08. Sigue abierto D13 (flujo de devoluciones).

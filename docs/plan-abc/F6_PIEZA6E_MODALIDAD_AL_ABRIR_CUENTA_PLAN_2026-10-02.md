# F6 · pieza 6e: modalidad al abrir cuenta en el TPV — hallazgos y plan

Fecha: 2026-10-02
Alcance de este documento: **solo lectura** del código de la aplicación y de las migraciones (piezas 3 y A07), y este plan. **Ningún cambio de pantalla, de base de datos ni de
despliegue.** Producción no consultada. QA no consultada para esta pieza.
Autorización: «6e: elegir modalidad al abrir cuenta» elegida por Pedro el 2/10/2026 (solo QA). El plan se presenta antes de implementar y las decisiones de la última sección esperan su respuesta.
Estado: `PLAN_PRESENTADO_SIN_IMPLEMENTAR`

## Qué se pidió (D02)

«Todas las modalidades que se puedan seleccionar; cada empresa o cada local en específico usa las suyas.» El servidor ya lo permite desde la pieza 3 (`abc_local_modalidades`,
`abc_configurar_modalidad_local`, `abc_obtener_modalidades_local` y una guarda en `cuentas_comerciales`). **Falta el TPV**: hoy abre siempre la cuenta en `BARRA`.

## Hallazgos al leer el código

| Nº | Hallazgo | Consecuencia |
|---|---|---|
| H1 | La única apertura de cuentas del cliente es `venderCarritoA02` (botón «Guardar pedido» del carrito). Escribe `modalidad: "BARRA"` fija en el **registro pendiente** (el que se guarda en el navegador para reintentar sin duplicar) y en el contexto de la cuenta | Un local que **deshabilite Barra no podría abrir ninguna cuenta**: `modalidad_no_habilitada:BARRA`. Por eso la pantalla «Configuración» tiene Barra bloqueada |
| H2 | El registro pendiente conserva la modalidad y el identificador de la operación de apertura. Si una apertura falló o se cortó, el reintento **debe ir con los mismos datos**; cambiar la modalidad a mitad podría chocar con la operación ya enviada (`operation_id_conflict`) o dejar una cuenta abierta sin que el navegador lo sepa | La modalidad se decide **al crear el registro pendiente** y se conserva mientras ese pedido no se resuelva |
| H3 | Asignar una cuenta a una mesa o a la terraza (sala, A07) **cambia su modalidad en el servidor** (`MESA` o `TERRAZA`, según la zona). Si esa modalidad está deshabilitada, da `modalidad_no_habilitada:<X>` y hoy la pantalla mostraría ese código tal cual | Hay que traducir el error y no tocar el resto de la sala |
| H4 | El servidor ya expone `abc_obtener_modalidades_local(empresa, local)` → `{ modalidades: [...], habilitadas: ["BARRA", …] }` en orden fijo (Barra, Mesa, Terraza, Para llevar, Otro) para cualquier miembro del local | **No hace falta ninguna función nueva ni migración** |
| H5 | Las cuentas ya abiertas no cambian al deshabilitar una modalidad | Sin migración de datos |

## Plan por pasos (todo solo en QA; cada paso con sus pruebas)

| Paso | Qué incluye | Toca | Riesgo |
|---|---|---|---|
| 6e-1 · Modalidad automática | Al **crear** un pedido nuevo, `venderCarritoA02` lee las modalidades habilitadas del local y abre la cuenta en **Barra si está habilitada** (igual que hoy) y, si no, en la **primera habilitada** (Mesa, Terraza, Para llevar, Otro). Si no se puede leer la lista, **se queda en Barra como hoy** (decide el servidor). Un pedido pendiente conserva su modalidad (H2). Sin cambios visibles en el TPV | `venderCarritoA02` | Bajo a medio |
| 6e-2 · Selector en el carrito | En el carrito, encima de «Guardar pedido», «Tipo de cuenta» con las modalidades habilitadas (botones). **Solo si hay más de una habilitada**; por defecto Barra o la primera. La confirmación dice «Cuenta abierta en <modalidad>». Si el servidor la rechaza (cambió mientras tanto), se explica, se recarga la lista y se puede elegir otra | `VentaRapida` (carrito y confirmación) y `venderCarritoA02` | Medio |
| 6e-3 · Configuración y mensajes | Se **desbloquea Barra** en «Configuración → Modalidades» (el servidor sigue exigiendo que quede al menos una). Se traduce `modalidad_no_habilitada` en el TPV y en la sala | Pantalla «Configuración» y `errorRpcA02` | Bajo |

No cambia: el servidor, las cuentas ya abiertas, el cobro, el envío a cocina ni el cierre de caja.

## Decisiones que necesito de Pedro

**A · Alcance.**
- **Automática y selector (6e-1, 6e-2 y 6e-3)** (recomendada): lo que pide D02, «que se puedan seleccionar».
- **Solo automática (6e-1 y 6e-3)**: sin selector; el TPV abre en Barra o, si está deshabilitada, en la primera habilitada. Menos cambios en la pantalla de venta, pero el cajero **no puede elegir** «Para llevar» u «Otro».

**B · Qué modalidades aparecen en el selector.**
- **Todas las habilitadas, incluidas Mesa y Terraza** (recomendada): sencillo y coherente. Elegir Mesa o Terraza solo etiqueta la cuenta; la mesa concreta se asigna después en la sala, que fija la modalidad según su zona.
- **Solo las que no son de mesa (Barra, Para llevar, Otro)**: Mesa y Terraza solo vendrían de asignar una mesa. Un local con **solo** Mesa habilitada abriría igualmente en Mesa (automática).

Por defecto, y sin preguntar: el selector **solo aparece si hay más de una modalidad habilitada**; no se recuerda la última elegida.

## Pruebas previstas

- Contrato estático de pantalla: paridad exacta entre `fuente.js` y `fuente-recuperado.js`; la llamada a `abc_obtener_modalidades_local` y a `abc_abrir_cuenta` con los nombres y parámetros exactos de las migraciones;
  la modalidad no sale de una constante; el registro pendiente la conserva; las traducciones; el desbloqueo de Barra.
- Prueba de ejecución con la lógica real (`crearLogicaVenta`) y el servidor falso ampliado (apertura de cuenta con la guarda de la pieza 3, pedido y líneas): Barra habilitada → Barra; Barra deshabilitada → primera habilitada;
  lista ilegible → Barra; solo Mesa habilitada; modalidad elegida; reintento de un pedido pendiente con la selección cambiada (conserva la original); modalidad que se deshabilita entre la lectura y la apertura; y el selector (con 1 y con varias).
- Averías provocadas sobre ambas pruebas, como en las piezas anteriores.
- Regresión: paridad de la fuente recuperada, los contratos Node activos del manifiesto (iguales antes y después) y los contratos `cfg1`…`cfg6d`.
- **Prueba en pantalla por Pedro** en el preview 118 con una guía: deshabilitar Barra (dejando Mesa u otra habilitada), guardar un pedido de prueba y ver la modalidad; volver a habilitar Barra. Dejará una cuenta y un pedido de prueba en QA (hay que cancelarlos al terminar).

## Límites

- Sin credenciales de QA no puedo ver la pantalla funcionando: la primera vez real será en el navegador de Pedro.
- La modalidad de una cuenta es una **etiqueta**: Para llevar y Otro no activan ningún flujo propio (ni fiscal ni de cocina); lo único que cambia el servidor es la mesa o la terraza al asignar una mesa.
- Una cuenta abierta en una modalidad que luego se deshabilita **sigue funcionando** (pieza 3).
- La cadena de reconstrucción exacta del bundle (`CURRENT_RELEASE.patch`) la regenera la integración continua.
- Producción: no autorizada; antes habría que registrar las pruebas nuevas en la puerta de CI.

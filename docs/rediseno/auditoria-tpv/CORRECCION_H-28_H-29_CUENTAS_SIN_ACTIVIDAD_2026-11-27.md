# Corrección de H-28 y H-29 · cuentas abiertas sin actividad · 27/11/2026

Estado: **migración aplicada en QA, pantalla y contratos hechos, y probado desde la pantalla con sesión real de QA (27/11/2026, vista previa del PR #227): se cerraron 7 cuentas.**
Rama `correccion/ola0-tpv-2026-11-26`. Producción no se ha tocado.

- **H-28:** «85 cuentas abiertas en el local, 83 de días ya cerrados. Desde aquí no se retoman y tampoco se cierran solas.»
- **H-29:** una recarga a mitad de «Guardar pedido» deja una cuenta ABIERTA sin pedido ni línea.

## Lo que dicen los datos (por qué no se cierran «todas»)

Las 90 cuentas abiertas de QA (27/11, mediodía): **81 tienen un pedido vivo sin cobrar** (de días anteriores), 8 tienen el pedido cancelado y sin cobro, 1 es la de la prueba de H-31
(pedido cancelado con un cobro sin dinero). Cerrar las 81 «automáticamente» **tiraría pedidos sin cobrar**: en un local real son dinero pendiente. Por eso la decisión es cerrar solo
lo que no tiene actividad y dejar el resto a una persona.

## Qué se hizo

**Servidor.** `public.abc_cerrar_cuentas_sin_actividad(p_operation_id, p_empresa_id, p_local_id, p_sin_pedido_minutos = 60)` (migración `20261128140000`). Solo Propietario y Encargado del local
(capacidad `ABC_PEDIDO_CANCELAR` en ese local, por `abc_tiene_capacidad`; la primera versión usaba un rol global y se corrigió tras la revisión de código de #226). Cierra una cuenta ABIERTA **solo si** se cumplen todas:

- no tiene ningún **pedido vivo** (distinto de CANCELADO);
- no tiene **dinero en juego**: ningún checkout COMPLETADO, ningún pago que no sea RECHAZADO o CANCELADO, ninguna incidencia de cobro ABIERTA (mismo criterio que H-49);
- su venta fiscal, si la hay, es solo la **foto del cobro** (ABIERTA, sin bloquear y enlazada a un checkout) o está CANCELADA;
- no tiene **repartos ni cuotas por importe** vivos (ni como origen ni como destino);
- y está **sin actividad**: es de un **día operativo ya cerrado** (anterior al actual, que lo decide el servidor) o **no tiene ningún pedido ni cobro** y lleva más de N minutos (mínimo 15; es H-29).

Al cerrarla cancela sus checkouts ABIERTO/EN_COBRO y la foto fiscal (como H-49) y deja el evento `CUENTA_CERRADA_SIN_ACTIVIDAD` con el motivo. Cada llamada lleva su identificador de operación: **repetirla devuelve el mismo
resultado sin volver a tocar nada**. Devuelve `{cerradas, omitidas, cuentas, dia_operativo}`. Solo la ejecuta `authenticated`.

**Pantalla.** En «Cuentas abiertas y aparcadas», botón **«Cerrar cuentas sin actividad»** (solo con la nube activa y para Propietario o Encargado, con la lista cargada): pide **confirmación** (qué se cierra y que las demás no se
tocan), no deja pulsar dos veces, recarga la lista y cuenta lo que quedó abierto y por qué. El aviso de «días ya cerrados» deja de decir que «lo hace el servidor» y explica qué se puede cerrar y qué hay que resolver una a una.

## Pruebas

- **PGlite** `tests/rediseno/h28-h29-cerrar-cuentas-sin-actividad-pglite-contract.mjs`: cierra los cuatro casos sin actividad (día cerrado, caso H-49, sin pedido con más de una hora, pedido cancelado) con su evento, su checkout y foto cancelados;
  **no toca** 17 casos que no debe (pedido vivo enviado o abierto, cada estado de pago con dinero, checkout completado, incidencia abierta, venta fiscal bloqueada o cerrada o sin enlazar, reparto, cuota, cuenta del día
  actual joven, con pedido o con un cobro iniciado) ni las de otro local o empresa; rechaza a quien no es Propietario ni Encargado y a otro local; es idempotente y detecta el reuso del identificador con otros parámetros; mínimo de 15 minutos;
  `SECURITY DEFINER` con `search_path` vacío y solo `authenticated`.
- **Pantalla** `tests/rediseno/h28-h29-cerrar-cuentas-ui-contract.mjs` (falla con el código anterior): ejecuta la llamada real con dependencias falsas (parámetros, sin local, sin nube, sin permiso, sin red, respuesta inválida) y fija el cableado y la confirmación.
- **QA, datos reales, transacción deshecha** (con las filas de PM07 reactivadas dentro de ella): **cerraría 7 cuentas** (día operativo cerrado) y **dejaría 83**: las 81 con pedido sin cobrar, una con un reparto activo y la de hoy de la prueba de H-31 (con pedido, mañana ya será de un día cerrado). Todas las cerradas habrían dejado su evento.
- Prueba de humo en el navegador (modo local, con productos): carga, abre el TPV y el panel de cuentas abiertas; en modo local el botón no aparece (sin nube).

## Qué NO está hecho

- **Las 81 cuentas con un pedido sin cobrar no se cierran solas.** Resolverlas (cobrarlas o anular el pedido, que con H-21 y H-49 ya cierra la cuenta) es de una persona. Falta, si se quiere, una pantalla que las enseñe una a una con esas dos acciones; hoy es la limpieza de QA (acta §11).
- **Probado desde la pantalla con sesión de QA (27/11/2026):** el botón salió solo para Propietario con la lista cargada, pidió confirmación y cerró **7 cuentas** (todas por `DIA_OPERATIVO_CERRADO`, cada una con su evento `CUENTA_CERRADA_SIN_ACTIVIDAD`). Quedaron **83 abiertas** (CERRADA 52→59, ABIERTA 90→83), justo lo que había previsto la transacción deshecha. Una segunda pulsación no cerró nada («No había ninguna cuenta que cerrar de forma segura»). Pendiente: comprobar el botón ausente para un Cajero/a (sus contraseñas están pendientes de cambio, H-36).
- No se programa un cierre **automático** (por horario): se deja la acción manual con permiso y confirmación. Si se quiere automático, es una decisión aparte.
- H-29 no elimina la causa (crear cuenta y pedido en una sola operación del servidor); recoge sus restos.

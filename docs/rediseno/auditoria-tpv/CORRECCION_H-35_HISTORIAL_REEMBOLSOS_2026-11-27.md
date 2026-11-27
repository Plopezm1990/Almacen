# Corrección de H-35 · el historial no refleja los reembolsos económicos · 27/11/2026

Estado: **migración (función de lectura) aplicada en QA, pantalla y contratos hechos; probado desde la pantalla con sesión real de QA el 27/11/2026 (vista previa del PR #227).**
Rama `correccion/ola0-tpv-2026-11-26`. Producción no se ha tocado.

- **H-35 (P3):** una venta con un reembolso B08 confirmado figuraba ACTIVA, su ticket no lo mencionaba y su importe seguía en «Total vigente»; la caja y el historial daban cifras distintas.

## De dónde salen los reembolsos (la decisión pendiente de la Ola 5)

Los reembolsos económicos viven en el servidor: `reembolsos` (estado, motivo, importe solicitado) y `reembolso_aplicaciones` (cada reembolso aplicado a una **venta fiscal**, con `importe_venta`).
`reembolsos` es legible por el navegador, pero **`reembolso_aplicaciones` no** (la migración de paridad de permisos le quitó el acceso al navegador, como a `pago_intentos`). Una primera versión que la leía directamente
habría fallado en silencio y el historial no habría mostrado nada: **lo detectó el contrato estático `cobro-lectura-static-contract`** (lecturas directas a tablas sin permiso). Por eso se añadió una **función de servidor de solo lectura**
(migración `20261128160000_abc_f6_reembolsos_por_venta.sql`), que es el patrón del resto del cobro.
En QA hay 8 reembolsos CONFIRMADOS (8,35 €) sobre 6 ventas, y 3 cancelados (que no cuentan); la función, llamada como PM07 en una transacción deshecha, devuelve esas 6 ventas y 8,35 €.

La venta del historial se enlaza con su venta fiscal por `ventaFiscalId` (o por su propio identificador, que en las ventas de la nube es el de la venta fiscal).

## Qué se hizo

- **Servidor:** `public.abc_reembolsos_por_venta(p_empresa_id, p_local_id)` devuelve `{ ok, ventas: { <venta_fiscal_id>: importe } }` sumando `importe_venta` de reembolsos **CONFIRMADOS** (no cuenta cancelados, solicitados, aplicaciones sin venta ni con importe 0).
  Solo para quien pertenece al local; `SECURITY DEFINER` con `search_path` vacío; solo `authenticated`; no escribe nada.
- El historial llama a esa función (solo con la nube activa; en modo local no cambia nada) y usa lo devuelto por venta fiscal.
- La lista de ventas y el detalle marcan **«Reembolsada 1,00 €»** (si se devolvió todo) o **«Reembolso parcial X €»**; el detalle enseña «Reembolsado (dinero devuelto)» y el **neto de gestión**; el ticket lleva el mismo aviso.
- El **«Total vigente»** descuenta lo devuelto (el total sigue saliendo del neto de gestión) y el **ticket medio** no cuenta las ventas reembolsadas del todo.
- La venta **no cambia de estado** (sigue ACTIVA): un reembolso económico no anula la venta ni devuelve stock, como dice el propio aviso de B08.

**Decisión de diseño — sin doble descuento:** una devolución de producto con reembolso ya reduce el neto (`importeAsociadoDevuelto`); si además existe un reembolso económico del mismo dinero, descontar los dos contaría dos veces.
Por eso se resta el **mayor** de los dos (`max(devuelto por devolución, reembolsado económico)`). Si una venta tuviera a la vez una devolución y un reembolso económico **independientes**, el neto quedaría algo más alto de lo real; es el error prudente (no oculta ingresos).

## Pruebas

`tests/rediseno/h35-reembolsos-por-venta-pglite-contract.mjs` (PGlite: suma solo confirmados, no mezcla locales ni empresas, rechaza a quien no es del local o no tiene sesión, permisos y forma) y `tests/rediseno/h35-historial-refleja-reembolsos-contract.mjs` (falla con el código anterior): ejecuta el código real de los ayudantes (lectura de la respuesta del servidor, etiquetas total y parcial, entradas inválidas)
y fija el cableado (consulta a las dos tablas con empresa y local, solo con nube activa, sin bucles de render, descuento sin doble conteo, lista, detalle, ticket, total vigente y ticket medio). El contrato de PM09 del historial sigue pasando.

## Qué NO está hecho

## Prueba en QA con sesión (27/11/2026)

- Cinco de las seis ventas con reembolso confirmado salen marcadas en el historial: cuatro «Reembolsada 1,00 €» y una «Reembolso parcial 0,50 €».
- **La venta del hallazgo** (`V-20261125-B44A86`, TPV-000045, 1,00 € en efectivo): ahora «Reembolsada 1,00 €», con «Reembolsado (dinero devuelto) 1,00 €» y **neto de gestión 0,00 €**; en la lista figura con 0,00 €; su **ticket** lleva «Reembolsada 1,00 €». Filtrada sola, el resumen da 0 ventas vigentes y total 0,00 €.
- **Reembolso parcial** (`V-20261125-380644`): «Reembolso parcial 0,50 €», neto 0,50 €; filtrada sola, 1 venta vigente y total 0,50 €.
- La sexta venta con reembolso (`B8428C`, 3,85 €) **no aparece en el historial**: no tiene movimientos de stock de venta, que es de donde sale el historial, así que no se puede ver desde ahí (limitación anterior a H-35).
- Sesión cerrada y filas de QA apagadas al terminar.
- Una consulta por el local entero (sin filtrar por fechas): con miles de reembolsos habría que paginar o filtrar por el periodo del historial (el servidor limita a 1000 filas por consulta).
- No hay desglose de cada reembolso (fecha, motivo, medio) en el ticket; solo el importe total devuelto de esa venta.
- La caja (arqueo) y su esperado no se tocan: hoy sus reembolsos ya salen del servidor (H-24).

# PM10 · Punto 4 · LA-011 Productos

Fecha: 2026-09-05
Estado: **VALIDADO**

## Hallazgo reproducido

Antes de PM10, `addProducto()` y `updateProducto()` aceptaban metadatos numéricos sin una barrera común de dominio. El formulario principal y el alta rápida desde Pedidos convertían además entradas mediante patrones `Number(...) || 0/1`, de modo que valores no numéricos podían degradarse silenciosamente a valores aparentemente válidos.

Durante la validación del punto se detectó además que, aunque la primera corrección protegía `addProducto/updateProducto`, el formulario principal seguía normalizando el payload antes de llegar a la barrera. Se corrigió también esa ruta para que la lógica reciba el valor original y pueda rechazarlo.

## Corrección funcional

Se añadieron las funciones comunes PM10:

- `errorValidacionPM10`
- `numeroPM10`
- `validarProductoPM10`

Reglas aplicadas en alta/edición:

- nombre obligatorio y con `trim`;
- coste finito y `>= 0`;
- PVP, si se informa, finito y `>= 0`;
- stock mínimo finito y `>= 0`;
- unidades por caja, si se informa, finitas y `> 0`;
- IVA compra/venta, si se informan, finitos y entre 0 y 100;
- stock inicial/edición, si se informa, finito y `>= 0`;
- ningún `NaN`, `Infinity`, negativo o texto no numérico se convierte silenciosamente a cero/default.

`addProducto()` valida antes de `setProductos` y antes de crear el movimiento de stock inicial. `updateProducto()` valida antes de modificar metadatos o de invocar el motor de stock. El stock editado continúa modificándose a través del motor/ledger de inventario, no mediante sobrescritura directa.

El formulario principal de alta y edición envía ahora el payload sin los antiguos fallbacks `Number(...) || ...`, muestra el error de dominio y no cierra el formulario si la validación falla.

El alta rápida de producto desde Pedidos también envía el coste original y muestra el error; ya no convierte un coste inválido en cero.

## Casos de contrato ejecutados

Validados como correctos:

- alta válida;
- nombre vacío rechazado;
- coste texto no numérico rechazado;
- coste negativo rechazado;
- stock mínimo negativo rechazado;
- PVP negativo rechazado;
- `udsPorCaja = 0` rechazado;
- stock negativo rechazado;
- IVA >100 o <0 rechazado;
- `Infinity` / `NaN` rechazados;
- edición parcial válida;
- edición con PVP o stock negativo rechazada;
- campos opcionales vacíos no se transforman en errores económicos ficticios;
- alta/edición UI no pre-normalizan valores inválidos;
- alta rápida desde Pedidos conserva la barrera común.

## Automatización y regresión

Workflow final: `33968688237` — **success**.

Incluyó:

- aplicación idempotente del parche;
- `node --check fuente.js`;
- `tests/pm10/p04-productos-contract.mjs`;
- inspección de llamadas a `addProducto`;
- regresiones disponibles de PM09: P17, P16, P15, P12, P11, P10, P09, LA-007 y LA-008.

Commit funcional consolidado de `fuente.js`: `dcb82fb` (SHA completo verificable en el historial de la rama), mensaje `PM10: corregir LA-011 validaciones de productos`.

## QA / producción

No fue necesaria ninguna escritura de datos en Supabase QA para este punto: LA-011 afecta el contrato de objetos de producto/persistencia frontend y el stock ya permanece protegido por el motor/ledger heredado. No se creó ni aplicó migración.

No se tocó `main`, producción ni Netlify.

## Resultado

**LA-011 queda VALIDADA y cerrada para PM10**, sujeta a la regresión global del punto 15 y al cierre del paquete en el punto 16.

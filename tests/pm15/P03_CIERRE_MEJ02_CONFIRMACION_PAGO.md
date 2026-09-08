# PM15 P03 — MEJ-02: confirmación de pago con importe y destino

Tercer punto de PM15, siguiente en la secuencia acordada tras P01 (LA-022/NR-08) y P02
(MEJ-01).

## Lo que ya estaba resuelto (PM06/PM14, no se toca)

"Corrección mediante reverso trazable, no borrado silencioso": `marcarPagada` y
`marcarPagadaFacturaDirecta` ya usan `registrarPagoPM06`/`revertirUltimoPagoPM06` — un
ledger real (`pagosFacturas`), nunca borrado físico del pago. Esta parte de MEJ-02 estaba
cerrada desde PM06 y se ha verificado que sigue así sin cambiar nada.

## Problema real encontrado (inspección de código)

La confirmación de "marcar factura como pagada" (`CuentasPorPagar.marcar()`) usaba:

```js
window.prompt(`Importe a pagar (máximo €${pendiente.toFixed(2)})`, pendiente.toFixed(2));
```

Solo mostraba el **importe**, nunca el **destino** (a qué proveedor o factura se está
pagando). Con varias facturas pendientes en pantalla — cada una con su propio botón de
"Marcar pagada" — un clic en la fila equivocada dispara un `window.prompt` genérico que no
dice a quién se le está pagando. Es exactamente el hueco que describe MEJ-02: "confirmar
pago con importe **y destino**".

## Solución (cambio mínimo, un helper puro + una línea de wiring)

```js
function mensajeConfirmacionPagoPM15(factura, pendiente) {
  const proveedor = factura?.proveedor?.nombre || (factura?.origen === "directa" ? "Sin proveedor" : "Proveedor eliminado");
  const documento = factura?.numeroFactura ? `Factura ${factura.numeroFactura}` : factura?.concepto || "esta factura";
  return `Importe a pagar a ${proveedor} · ${documento} (máximo €${pendiente.toFixed(2)})`;
}
```

Reutiliza exactamente los mismos campos (`proveedor.nombre`, `numeroFactura`, `concepto`,
`origen`) que ya se muestran en la fila de la lista — no se inventa ningún dato nuevo, solo
se repite en la confirmación lo que el usuario ya vio al hacer clic.

`window.prompt` (limitado a texto plano, no permite HTML/formato) sigue siendo el mecanismo
de confirmación: no se ha rediseñado a un modal propio de la app porque eso sería un cambio
mayor fuera del alcance mínimo de este punto — la corrección de MEJ-02 es que el texto del
propio prompt incluya el destino, no cambiar el mecanismo de confirmación en sí.

## Archivos

- `fuente.js`: nueva función `mensajeConfirmacionPagoPM15`; `CuentasPorPagar.marcar()`
  actualizada para usarla en el `window.prompt`.
- `tests/pm15/p03-mej02-confirmacion-pago-destino-contract.mjs` (nuevo): factura de
  mercancía con proveedor y número, factura directa sin proveedor (usa el concepto),
  proveedor eliminado (nunca finge un nombre), y prueba de conexión real de que el prompt
  efectivo usa el mensaje con destino (no el texto genérico anterior).

## Regresión

Suite completa: `tests/g1`, `tests/pm04`, `tests/pm05`, `tests/pm07`, `tests/pm08`,
`tests/pm09`, `tests/pm10`, `tests/pm11-compra`, `tests/pm12`, `tests/pm13`, `tests/pm14`,
`tests/pm15` (P01, P02, P03) — sin regresiones.

## Estado de main/producción

`main` = `767a2c3163f924b7599338785fe4331f78f0e1ac`, sin tocar directamente — este trabajo
vive en `claude/pm15-contexto-borradores-errores`. Sin migraciones nuevas (cambio de
frontend puro). `L&A Suite` (producción) y `TPV` no se han tocado.

## Estado de PM15

- P01 (LA-022 + NR-08 alcance literal): cerrado, gate verde.
- P02 (MEJ-01): cerrado, gate verde.
- P03 (MEJ-02): este punto.
- Pendiente explícito, no resuelto (registrado en P01): pérdida general de borradores al
  cambiar de pestaña, más amplio que el alcance literal de NR-08.

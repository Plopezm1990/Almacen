# F3.1 — contrato de TPV y autoridad del servidor

Fecha: 2026-10-01  
Estado: `CONTRATO_PREPARADO_NO_APLICADO`  
Base: F1 preparado, F2 en preparación y `origin/release` `7859508`

Este contrato define la frontera entre interfaz y servidor para el TPV. No
implementa todavía una pantalla nueva ni cambia el esquema.

## Recorrido de venta

| Paso | Interfaz | Servidor | Regla |
|---|---|---|---|
| 1 | muestra empresa, local, usuario y sesión | devuelve contexto autorizado | no se puede operar sin contexto |
| 2 | busca producto/categoría | devuelve catálogo permitido | no acepta precio del cliente como autoridad |
| 3 | añade o edita línea | valida producto, variante, cantidad y versión | identidad estable por línea |
| 4 | presenta desglose | calcula precio, impuestos, descuentos y total | servidor es la fuente del total |
| 5 | confirma pedido | crea operación idempotente | doble clic no duplica |
| 6 | envía a preparación | registra estación, versión y actor | reenvío se distingue de alta |
| 7 | inicia cobro | crea intento y reserva saldo | resultado desconocido queda pendiente |
| 8 | muestra resultado | confirma/rechaza/consulta | nunca realiza segundo cargo ciego |

Navegar atrás, recargar o cerrar una pantalla no confirma venta, cobro,
preparación ni documento.

## Contrato de línea

Cada línea conservará, como mínimo, identidad de producto, variante,
suplementos, cantidad, unidad, precio autorizado, impuestos, descuento,
comensal/estación cuando aplique, versión y referencia de la operación. Dos
selecciones diferentes no se agregan en una línea indistinguible aunque su
consumo de stock pueda agregarse de forma controlada.

## Respuestas y errores

Las respuestas deben distinguir `OK`, `CONFLICTO_VERSION`, `DENEGADO`,
`PENDIENTE`, `DESCONOCIDO`, `RECHAZADO` y `ERROR_REINTENTABLE`. El cliente no
interpreta un timeout como rechazo ni como confirmación.

Cada mutación incluye `operation_id`; repetir el mismo cuerpo devuelve el
resultado original y repetirlo con otro cuerpo devuelve conflicto. Los errores
no deben incluir datos de otra empresa/local ni secretos del proveedor.

## Fuera de alcance de F3.1

- No se decide todavía el proveedor de pagos.
- No se activa offline real; solo se podrá diseñar un borrador visible y
  caducable.
- No se emiten documentos fiscales reales.
- No se escribe directamente desde el navegador en tablas económicas.
- No se hace migración remota, merge ni deploy de Netlify.

## Criterios de aceptación F3.1

1. El TPV siempre muestra contexto y sesión antes de permitir mutaciones.
2. El servidor rechaza precio, impuesto, cantidad o contexto manipulados.
3. Las líneas conservan identidad y versión.
4. Doble clic, replay y conflicto producen un único resultado trazable.
5. Un cobro desconocido queda consultable y no genera segundo cargo.

## Resultado de F3.1

La frontera TPV-servidor queda preparada para implementar A02/A03/A05/A06 con
los contratos de F1 y sin depender todavía de un proveedor real.

# PM11 · Compra, recepción y pago E2E · P02 — Contrato de identidad y estados

Fecha: 2026-09-07  
Rama: `pm11-compra-recepcion-pago-e2e`  
P01: `tests/pm11-compra/P01_CHECKPOINT_INVENTARIO.md`  
Producción/main: **NO TOCAR**

## 1. Objetivo

Congelar antes de modificar lógica el contrato funcional de extremo a extremo para:

**Pedido → recepción → albarán → factura → pago/reverso → conciliación.**

P02 define qué identidad debe sobrevivir, qué transiciones son válidas, qué estados NO equivalen entre sí y qué condiciones deben cumplirse antes de avanzar al siguiente tramo.

P02 no escribe en Supabase ni modifica `fuente.js`.

## 2. Principios obligatorios

1. **Una operación física no puede producir dos efectos.** Un reintento, doble clic, recarga o replay exacto no puede volver a sumar stock, recepción ni deuda.
2. **La identidad no puede saltar de contexto.** Empresa, local, proveedor y documento origen deben permanecer coherentes en toda la cadena.
3. **Los hechos mandan sobre los booleanos.** Recepción se deriva de cantidades realmente recibidas; pago se deriva del ledger de pagos/reversos.
4. **Fallo cerrado.** Si una validación o confirmación de nube falla, el paso no se considera confirmado y el siguiente estado no puede adelantarse.
5. **No se confunde documento logístico con documento financiero.** Un albarán simple no crea por sí solo obligación de pago.
6. **No se inventa atomicidad.** Mientras parte del circuito siga en persistencia genérica `almacen_kv`, solo se afirmarán las garantías que puedan demostrarse.

## 3. Identidad canónica del circuito

### 3.1 Pedido

Identidad mínima:

- `pedido.id` inmutable;
- `pedido.localId` concreto e inmutable durante el ciclo;
- empresa resoluble de forma inequívoca desde el local autorizado, o almacenada explícitamente cuando se endurezca el dominio;
- `pedido.proveedorId` resoluble y perteneciente a la misma empresa efectiva;
- cada línea conserva `productoId`, `cantidad` y `cantidadRecibida` acumulada.

Un cambio de proveedor/local después de existir recepción no puede reinterpretar el histórico ya recibido.

### 3.2 Evento de recepción

Cada efecto real de recepción debe poder distinguirse de otro efecto real y, al mismo tiempo, reconocer un replay del mismo intento.

Contrato:

- identidad estable de operación/reintento;
- referencia al pedido origen;
- referencia al documento origen (`pedido` directo o `albarán`);
- local efectivo idéntico al pedido;
- producto perteneciente al mismo local;
- unidades efectivamente entradas como autoridad para actualizar `cantidadRecibida`.

Usar únicamente `pedidoId` como identidad de todas las recepciones parciales **no es suficiente**, porque un mismo pedido puede tener varias recepciones reales.

### 3.3 Albarán

Identidad mínima:

- `albaran.id` inmutable;
- `albaran.pedidoId` cuando nace de un pedido;
- `empresaId` y `localId` coherentes con el pedido/local;
- `proveedorId` coherente con el pedido cuando exista enlace;
- `proveedorSnapshot` conserva la identidad histórica del proveedor;
- líneas y unidades que realmente entran en stock;
- estado documental diferenciado de la condición de factura.

Confirmar dos veces el mismo albarán no puede duplicar recepción ni stock.

## 4. Estados del pedido

Estados cuantitativos canónicos:

- **Pendiente:** ninguna unidad válida recibida.
- **Parcial:** existe al menos una unidad recibida y queda cantidad pendiente.
- **Recibido:** para todas las líneas, `cantidadRecibida == cantidad` dentro de la tolerancia numérica definida.

Transición normal:

`Pendiente → Parcial → Recibido`

También es válida:

`Pendiente → Recibido`

si la primera recepción cubre exactamente todo lo pendiente.

Reglas:

- nunca `cantidadRecibida > cantidad`;
- una recepción fallida no cambia estado;
- una recarga no cambia por sí misma cantidades ni estado;
- un replay exacto no vuelve a incrementar cantidades;
- cualquier estado manual/legado de cierre no sustituye la reconciliación cuantitativa: para afirmar "recibido" deben cuadrar las cantidades.

## 5. Estados del albarán

Contrato mínimo:

- **no confirmado/borrador:** todavía no puede considerarse recepción definitiva;
- **confirmado:** las líneas aceptadas son hechos logísticos y ya no pueden volver a aplicarse por una segunda confirmación del mismo documento.

La transición crítica es:

`NO_CONFIRMADO → CONFIRMADO`

Debe ser idempotente frente a repetición del mismo documento/operación.

## 6. Separación albarán ↔ factura

Para documentos nuevos de PM11 se congela la semántica explícita:

### Albarán simple

- `esFactura === false`;
- puede confirmar recepción logística;
- **NO** crea obligación en Cuentas por pagar;
- no requiere número/fecha de factura.

### Albarán que contiene factura del proveedor

- `esFactura === true`;
- debe estar confirmado;
- debe tener `numeroFactura` no vacío;
- debe tener `fechaFactura` válida;
- el total financiero se calcula desde las mismas líneas/cargos autoritativos del documento confirmado;
- genera una única obligación financiera identificada por el propio `albaran.id` con `origenFactura = "albaran"`.

### Datos legados ambiguos

El comportamiento histórico `esFactura !== false` acepta `undefined` como factura. PM11 **no lo adopta como contrato para nuevas escrituras**.

Regla congelada:

- nuevos documentos: `esFactura` debe ser explícito;
- `undefined/null` legado puede leerse con una estrategia de compatibilidad documentada, pero no debe crear silenciosamente una nueva obligación financiera por una escritura PM11 sin resolver antes su semántica;
- P05 debe comprobar la implementación real y endurecerla si el flujo nuevo permite ambigüedad.

## 7. Identidad de la obligación financiera

Para una factura procedente de albarán:

- `facturaId = albaran.id`;
- `origenFactura = "albaran"`;
- `empresaId = albaran.empresaId`;
- `localId = albaran.localId`;
- proveedor histórico = `proveedorSnapshot` del documento;
- total = cálculo autoritativo del albarán confirmado;
- no existe una segunda obligación por recarga, relectura o reconfirmación del mismo documento.

Para factura directa se conserva el contrato PM06 existente y queda fuera de la conversión Pedido→Albarán de PM11, aunque participa en la regresión financiera.

## 8. Estados financieros

La factura no usa `pagada` como hecho primario. El estado se deriva de:

`pagado = Σ CONFIRMADO - Σ REVERSO`

`pendiente = max(0, total - pagado)`

Estados derivados:

- **Pendiente:** `pagado = 0` y `pendiente = total`.
- **Parcialmente pagada:** `0 < pagado < total`.
- **Pagada:** `pendiente = 0` y `total > 0`.

Reglas:

- pago `<= 0` rechazado;
- sobrepago rechazado;
- replay exacto del mismo pago no duplica importe;
- mismo `operationId` con contenido distinto produce conflicto;
- reverso referencia al pago original y solo reabre exactamente su importe;
- un pago ya revertido no se vuelve a revertir como un segundo hecho;
- factura con pagos no puede cambiar su total de forma incompatible con el histórico financiero.

## 9. Conciliaciones obligatorias

Al completar el caso E2E de prueba deben cumplirse simultáneamente:

1. por cada línea del pedido: `pedido = recibido acumulado + pendiente de recibir`;
2. al quedar Recibido: `cantidad == cantidadRecibida` para todas las líneas;
3. stock neto incrementado = suma de unidades de recepciones confirmadas únicas;
4. albarán confirmado enlazado conserva `pedidoId` y contexto;
5. si es factura explícita: `total factura = base + IVA + cargos/impuestos aplicables`;
6. `total factura = pagado + pendiente`;
7. después de un reverso: `nuevo pendiente = pendiente anterior + importe reversado`;
8. ningún paso del caso A1 puede aparecer como escritura válida en A2/B1/`Todos los locales`.

## 10. Matriz de transiciones permitidas

| Origen | Evento | Destino | Condición |
|---|---|---|---|
| Pedido Pendiente | recepción parcial válida | Pedido Parcial | recibido > 0 y queda pendiente |
| Pedido Pendiente | recepción total válida | Pedido Recibido | recibido acumulado = pedido |
| Pedido Parcial | nueva recepción válida | Pedido Parcial | todavía queda pendiente |
| Pedido Parcial | recepción exacta del resto | Pedido Recibido | pendiente final = 0 |
| Pedido cualquiera | recepción inválida/exceso | sin cambio | todo-o-nada |
| Albarán no confirmado | confirmar válido | Confirmado | efecto logístico único |
| Albarán confirmado | replay exacto | Confirmado sin nuevo efecto | idempotencia |
| Albarán confirmado simple | lectura financiera | sin obligación | `esFactura === false` |
| Albarán confirmado factura | alta obligación | Factura pendiente | `esFactura === true`, nº/fecha válidos |
| Factura pendiente | pago parcial | Parcialmente pagada | 0 < pago < pendiente |
| Factura pendiente/parcial | pago exacto del resto | Pagada | pendiente final = 0 |
| Factura con pago | reverso válido | saldo reabierto | reverso trazable |
| Cualquier paso | error de validación/nube | sin avance falso | fallo cerrado |

## 11. Casos prohibidos

P02 congela como inválidos:

- recibir más que lo pendiente;
- aplicar dos veces el mismo evento logístico;
- usar una misma identidad de operación para dos recepciones reales diferentes;
- confirmar dos veces un albarán y duplicar stock;
- cambiar local/empresa/proveedor histórico para reinterpretar un documento ya confirmado;
- convertir un albarán simple en deuda por omisión ambigua de `esFactura` en una escritura nueva;
- crear dos obligaciones financieras para el mismo albarán confirmado;
- pagar una factura de otro contexto;
- sobrepagar;
- reusar `operationId` financiero con contenido distinto;
- avanzar a estado confirmado cuando el servidor no confirmó el efecto.

## 12. Responsabilidad de los siguientes puntos

- **P03:** demostrar/enduracer identidad de recepciones múltiples y replay logístico.
- **P04:** demostrar que albarán enlazado conserva trazabilidad y confirmación única.
- **P05:** implementar/probar semántica explícita de factura, número/fecha y unicidad de obligación.
- **P06:** pago parcial/total/reverso sobre la factura exacta del circuito.
- **P07:** aislamiento y permisos E2E.
- **P08:** fallos, concurrencia, doble clic, recarga y replay.
- **P09:** conciliación numérica final.
- **P10:** regresión, Deploy Preview, smoke y cierre.

## 13. Criterio de salida P02

P02 queda cerrado cuando este contrato es verificable por test documental versionado y no contradice las garantías heredadas de PM10/G1.

**PM11_COMPRA_P02_CONTRATO_E2E_ESTADOS=PASS**

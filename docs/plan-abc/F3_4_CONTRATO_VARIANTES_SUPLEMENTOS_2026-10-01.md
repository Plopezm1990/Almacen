# F3.4 — contrato de variantes y suplementos

Fecha: 2026-10-01  
Estado: `CONTRATO_VARIANTES_PREPARADO_NO_APLICADO`  
Base: F3.1–F3.3 y `origin/release` `7859508`

Este contrato define la identidad de una línea cuando un producto admite
tamaño, extra, menú o combinación de opciones.

## Modelo de selección

| Elemento | Regla |
|---|---|
| Producto base | identidad estable del catálogo |
| Variante | identidad propia, unidad y precio autorizado |
| Grupo | mínimo/máximo de selecciones y compatibilidades |
| Suplemento | identidad, precio, impuesto y efecto de stock |
| Línea | fotografía completa de la selección y versión |
| Preparación | estación y notas vinculadas a la línea |

Una selección inválida debe rechazarse en servidor aunque la interfaz la haya
ocultado. Cambiar el catálogo después de vender no modifica la fotografía de la
línea existente.

## Casos mínimos

| Caso | Resultado exigido |
|---|---|
| Mismo producto, dos tamaños | líneas distintas y precios históricos |
| Mismo producto, extras distintos | selección y preparación distinguibles |
| Grupo fuera de mínimo/máximo | rechazo sin mutación |
| Extra incompatible | rechazo en servidor |
| Precio enviado por cliente alterado | se recalcula o se rechaza |
| Variante retirada del catálogo | líneas históricas siguen legibles |
| Repetición de la misma selección | idempotencia según operación, no duplicación accidental |
| Consumo compartido | agregación solo después de conservar identidad |

## Preparación y stock

La comanda conserva la selección concreta para la estación. El consumo puede
agregarse por producto/unidad solo en el motor de stock y con una regla
determinista. Preparar dos selecciones no se convierte en una única línea
indistinguible; cancelar una línea preparada requiere decidir merma o retorno.

## Criterios de aceptación F3.4

1. Se rechazan combinaciones inválidas en cliente y servidor.
2. Dos líneas del mismo producto con variantes distintas se conservan separadas.
3. Precio, impuesto, descuento, preparación y stock usan la misma identidad.
4. Un cambio posterior del catálogo no reescribe una venta histórica.
5. Replay y doble clic no crean una selección duplicada.

## Resultado de F3.4

El contrato de variantes y suplementos queda preparado para A04. No cambia
catálogo, stock, base de datos, merge ni deploy de Netlify.

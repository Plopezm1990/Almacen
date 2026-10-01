# F0.5 — matriz de ejecución A01–C12

Fecha: 2026-10-01  
Estado: `PENDIENTE_ESTIMACION_Y_DECISION`  
Base: F0.1–F0.4 sobre `origin/release` `7859508`

Esta matriz convierte el inventario en una lista ejecutable. No significa que
un requisito esté aceptado: coste, decisión de negocio y evidencia deben
completarse antes de cerrar cada fila.

| ID | Reutilización inicial | Cambio mínimo previsto | Dependencia | Prueba de aceptación | Coste | Decisión |
|---|---|---|---|---|---|---|
| A01 | `PENDIENTE` | recorrido por modalidad | local piloto | acta de recorrido | `PENDIENTE` | `PENDIENTE` |
| A02 | catálogo y venta existentes | controles del TPV | A01, equipos | recorrido táctil/teclado | `PENDIENTE` | `PENDIENTE` |
| A03 | cálculo y líneas existentes | autoridad de precio | motor monetario | vectores y manipulación | `PENDIENTE` | `PENDIENTE` |
| A04 | catálogo existente | identidad de variante | H | dos variantes separadas | `PENDIENTE` | `PENDIENTE` |
| A05 | estados actuales | matriz de transiciones | B02, C04, G | positivos y negativos | `PENDIENTE` | `PENDIENTE` |
| A06 | persistencia actual | versión y conflicto | X | dos sesiones y reinicio | `PENDIENTE` | `PENDIENTE` |
| A07 | contexto de local | mesas y responsables | A05/A06, U | traslado sin pérdida | `PENDIENTE` | `PENDIENTE` |
| A08 | cobro y reparto existentes | división determinista | B03–B05, C05 | unión y pago parcial | `PENDIENTE` | `PENDIENTE` |
| A09 | entrega A09 existente | aceptación operativa | roles, fiscalidad | límites y auditoría | `PENDIENTE` | `PENDIENTE` |
| A10 | contratos de preparación | notificación versionada | G, I | cambio y cancelación | `PENDIENTE` | `PENDIENTE` |
| A11 | sesiones y fechas | día operativo por local | C01/C04 | medianoche y horario | `PENDIENTE` | `PENDIENTE` |
| A12 | recorrido integrado | aceptación del TPV | A01–A11, B/C | ensayo integral | `PENDIENTE` | `PENDIENTE` |
| B01 | medios actuales | inventario de medios | proveedor/fiscalidad | cobro por medio | `PENDIENTE` | `PENDIENTE` |
| B02 | bridge F4 | aceptación de cobro | caja y estados | cobro y replay | `PENDIENTE` | `PENDIENTE` |
| B03 | pagos y cuotas | reserva de saldo | concurrencia | dos cajas | `PENDIENTE` | `PENDIENTE` |
| B04 | contrato de resultado incierto | consulta segura | proveedor/conciliación | pérdida de respuesta | `PENDIENTE` | `PENDIENTE` |
| B05 | pagos mixtos | reparto y caja | cálculo monetario | efectivo + otro medio | `PENDIENTE` | `PENDIENTE` |
| B06 | anticipos y conceptos | saldo trazable | política operativa | anticipo y propina | `PENDIENTE` | `PENDIENTE` |
| B07 | adaptador genérico | integración contratada | proveedor sandbox | webhook firmado | `PENDIENTE` | `PENDIENTE` |
| B08 | reembolso económico | liquidación externa | proveedor sandbox | reembolso parcial | `PENDIENTE` | `PENDIENTE` |
| B09 | no identificado en release | contrato de liquidación | proveedor y disputas | conciliación | `PENDIENTE` | `PENDIENTE` |
| B10 | frontera de datos preparada | revisión PCI | adquirente | no almacenar tarjeta | `PENDIENTE` | `PENDIENTE` |
| B11 | contingencia documentada | procedimiento operativo | decisión offline | corte y recuperación | `PENDIENTE` | `PENDIENTE` |
| B12 | matriz y simuladores | sandbox del proveedor | cuenta sandbox | T01–T12 de pagos | `PENDIENTE` | `PENDIENTE` |
| C01 | caja existente | saldo por movimientos | sesiones | apertura y arqueo | `PENDIENTE` | `PENDIENTE` |
| C02 | base transaccional | cierre y replay | permisos/concurrencia | sesión cerrada | `PENDIENTE` | `PENDIENTE` |
| C03 | emisión a definir | régimen y emisor | asesoría | documento válido | `PENDIENTE` | `PENDIENTE` |
| C04 | estados de documento | contrato de emisión | A05 | emisión/reintento | `PENDIENTE` | `PENDIENTE` |
| C05 | reparto monetario | céntimos e impuestos | A08 | suma exacta | `PENDIENTE` | `PENDIENTE` |
| C06 | A09 y permisos | efecto fiscal | asesoría | cortesía auditada | `PENDIENTE` | `PENDIENTE` |
| C07 | numeración a definir | serie y huecos | C03 | reintento único | `PENDIENTE` | `PENDIENTE` |
| C08 | documentos existentes | rectificación y vínculo | C03–C07 | factura y rectificación | `PENDIENTE` | `PENDIENTE` |
| C09 | descargas existentes | entrega protegida | W/U | enlace cruzado denegado | `PENDIENTE` | `PENDIENTE` |
| C10 | impresión a verificar | agente o integración | V | ticket y fallo | `PENDIENTE` | `PENDIENTE` |
| C11 | informes existentes | conciliación integral | B, C01–C04 | diferencia explicable | `PENDIENTE` | `PENDIENTE` |
| C12 | ensayo integral futuro | acta de aceptación | F5 y T11–T24 | candidato completo | `PENDIENTE` | `PENDIENTE` |

## Regla de actualización

Una fila solo puede pasar de `PENDIENTE` cuando exista evidencia fechada y
reproducible, se haya identificado el entorno y se haya anotado quién acepta
el resultado. La disponibilidad de código o un contrato estático no sustituye
la prueba del recorrido.

Los costes se separarán en desarrollo, pruebas, proveedor, hardware,
alojamiento y soporte. No se presume ninguna tarifa, compra o ampliación de
plan. Netlify permanece en cero despliegues durante esta iteración.

## Resultado de F0.5

La matriz ejecutable queda preparada para estimación y decisión. B12 puede
permanecer pendiente sin impedir este trabajo; ninguna fila autoriza merge,
migración remota, activación de proveedor o deploy.

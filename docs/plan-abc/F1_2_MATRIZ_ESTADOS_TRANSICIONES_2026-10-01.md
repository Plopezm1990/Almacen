# F1.2 — matriz de estados y transiciones

Fecha: 2026-10-01  
Estado: `PENDIENTE_APROBACION_DE_NEGOCIO`  
Base: F1.1 y `origin/release` `7859508`

La matriz separa el ciclo operativo de pedido, pago, documento, caja y stock.
Cada transición debe validarse en servidor, registrar actor y contexto, y ser
idempotente cuando tenga efectos externos o económicos.

## Sesión de caja y día operativo

| Objeto | Transición | Actor | Condición previa | Efecto esperado |
|---|---|---|---|---|
| Día operativo | abrir | propietario/encargado | no existe sesión abierta incompatible | crea sesión con zona horaria del local |
| Caja | abrir | cajero autorizado | día operativo válido | registra fondo inicial y actor |
| Caja | movimiento | cajero autorizado | sesión abierta | añade movimiento con origen y referencia |
| Caja | cerrar | encargado autorizado | arqueo preparado | congela nuevos movimientos de esa sesión |
| Día operativo | cerrar | encargado autorizado | cajas cerradas y diferencias revisadas | conserva saldo y acta |
| Caja | reabrir | permiso explícito | sesión cerrada | crea incidencia o versión nueva, nunca reescribe el cierre |

## Pedido y cuenta

| Desde | Acción | Hasta | Condición o rechazo |
|---|---|---|---|
| borrador | confirmar | abierto | líneas válidas y contexto autorizado |
| abierto | enviar | enviado | versión esperada coincide |
| enviado | servir | servido | estación acepta la versión |
| abierto/servido | cerrar | cerrado | saldo cobrado o decisión autorizada |
| borrador/abierto | cancelar | cancelado | motivo y permisos; preparado puede exigir merma |
| cualquier estado | editar | mismo estado o versión nueva | conflicto si otra sesión cambió la versión |

Una cuenta no se considera cerrada por navegar atrás, recargar o mostrar un
total. El estado de preparación permanece separado del saldo y del documento.

## Pago y resultado externo

| Desde | Acción | Hasta | Regla |
|---|---|---|---|
| pendiente | autorizar | autorizado | importe y moneda validados |
| autorizado | confirmar | confirmado | referencia externa o efectivo reconciliado |
| pendiente/autorizado | rechazar | rechazado | no crea aplicación económica |
| pendiente/autorizado | consultar | confirmado/rechazado/desconocido | nunca realiza cargo ciego |
| desconocido | conciliar | confirmado/rechazado | conserva incidencia y referencia |
| confirmado | solicitar reembolso | reembolso pendiente | saldo disponible y permiso |
| reembolso pendiente | resolver | reembolsado/parcial/rechazado | aplicación idempotente |

Un timeout no libera automáticamente un saldo reservado ni permite un segundo
cargo. Un evento duplicado debe devolver el resultado existente sin duplicar
pago, caja, stock o documento.

## Documento y stock

| Objeto | Transición | Regla |
|---|---|---|
| Documento | emitir | conserva serie, número, contenido y actor |
| Documento | rechazar | crea incidencia recuperable sin duplicar emisión |
| Documento | rectificar | vincula al original; no reescribe lo emitido |
| Stock | reservar | operación y versión válidas |
| Stock | consumir | ocurre una sola vez por línea y regla de flujo |
| Stock | devolver | solo cantidad físicamente recuperable |
| Stock | merma | registra causa; no inventa reposición |

Un reembolso económico de comida consumida no crea unidades vendibles. Las
reglas exactas de reserva, consumo y retorno se confirmarán con el flujo de
barra/sala del piloto.

## Criterios de aceptación F1.2

1. Cada transición rechaza estado previo incompatible sin efectos parciales.
2. Cada operación valida actor, empresa, local y versión esperada.
3. Pedido, pago, documento, caja y stock conservan estados independientes.
4. Repetir una operación no duplica el efecto económico ni externo.
5. Cierre, reapertura, resultado desconocido y devolución quedan auditados.

## Resultado de F1.2

La matriz queda lista para revisión del negocio y para contratos de F2/F3/F4.
No decide aún el proveedor, la fiscalidad ni la política exacta de stock; no
requiere secrets, migración remota, merge ni deploy de Netlify.

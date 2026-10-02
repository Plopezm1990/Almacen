# F5 — ensayo integral controlado en QA (venta, cobro simulado, devolución, reversión, cierre)

Fecha: 2026-10-02
Entorno autorizado: Supabase QA `qjqorixtkilwsndqayyx` (solo QA)
SHA de trabajo: `a5a4321f0d05d9d952358ada81d6ee80f19f89c0`
Estado: `EJECUTADO_BACKEND_QA_TRANSACCIONES_REVERTIDAS_ALCANCE_PARCIAL`

Este documento no cierra A12, C12 ni ningún requisito. Es un ensayo del backend
de QA con una muestra reducida y sin interfaz.

## Método y entorno

- Identidad del proyecto: URL `qjqorixtkilwsndqayyx.supabase.co` y huella de
  migraciones solo presentes en QA (`abc_f5_pm09_security_hardening`, C04–C12,
  `pm10_cierre_sesion_caja`). El conector de Supabase de la sesión no estaba
  limitado a QA (veía también producción); todas las llamadas llevaron el ID de
  QA y ninguna el de producción.
- Cada ejecución fue una única transacción `BEGIN … ROLLBACK`. Los actores son
  usuarios ya existentes de QA, suplantados a nivel de base de datos con
  `set local role` y claims JWT. No hubo inicio de sesión real, ni capa
  PostgREST/Auth, ni navegador.
- Datos ficticios solo dentro de la transacción: producto `ZZ-ENSAYO-CAFE`
  (10,00 + 10 % de impuesto), stock 10+10, terminal, caja, vínculo fiscal del
  Local A1 y regla de día operativo. Identificadores `ee000000-…` y `ZZ-ENS-*`.
- Ajuste del banco de pruebas: `now()` está congelado dentro de una transacción y
  `caja_sesion_terminales` exige `hasta > desde`. Se retrasó 3 h la apertura de
  la sesión de prueba. No es un defecto del sistema.
- Sin proveedor real, sin emisión fiscal, sin documentos (C05–C10), sin deploy.

## Resultados

Casos positivos (todos como Propietario, Local A1):

| Tramo | Resultado observado |
|---|---|
| Apertura de caja, fondo 100 | OK; +100 en el libro de caja |
| Cuenta → pedido → línea → envío → checkout | OK; el servidor calculó base 20, impuestos 2, total 22 sin recibir precio |
| Cobro efectivo (recibido 25, cambio 3) | Intento PENDIENTE con reserva de 22; confirmación OK; cuenta PAGADA; efecto en caja +22 (el cambio no cuenta) |
| Replay de la confirmación | Mismo resultado, sin segundo movimiento de caja |
| Reembolso parcial 11 (efectivo) | Solicitud PENDIENTE y confirmación OK; caja 111 |
| Tarjeta simulada | Identidad de intento, 1 reserva activa y 1 efecto en outbox sin PAN/CVV; el replay no duplica nada |
| Resultado incierto | Incidencia ABIERTA mantiene el saldo bloqueado; resolución CONFIRMADO libera la reserva, confirma el pago y no toca el efectivo |
| Cierre: iniciar → conteo provisional → ensayo C12 → finalizar | OK; sesión `CERRADA_FINAL` |
| PM09: venta de carrito (2 ud) | Stock piso 10→8 |
| PM09: devolución (1 ud, 11 EFECTIVO) | Stock 8→9 y −11 en caja |
| PM09: venta y reversión del carrito | Stock restituido; la repetición con el mismo `operation_id` es replay |

Casos negativos (rechazados con el motivo esperado):

| Caso | Resultado |
|---|---|
| Segunda caja sobre el mismo saldo con intento pendiente o incidencia abierta | `saldo_insuficiente` (secuencial; no es una prueba de concurrencia real) |
| Mismo `operation_id` con importe o cantidad distintos | `operation_id_conflict` (cobro y venta PM09) |
| Cobro con la cuenta ya pagada | `checkout_no_cobrable` |
| Reembolso 50 sobre 22, y 12 con 11 ya reservado | `saldo_reembolsable_insuficiente` |
| Evidencia con PAN | `evidencia_datos_tarjeta_prohibidos` |
| Propietario de otra empresa; Encargado de otro local | `abc_cobro_no_autorizado`, `estado_cobro_no_autorizado`, `contexto_no_autorizado` |
| `anon` y `service_role` sobre wrappers PM09 y ABC | `42501 permission denied` |
| `service_role` sobre la RPC base (conserva `EXECUTE`) | `stock_no_autorizado` (guarda interna con `auth.uid()`) |
| Camarero: reembolsar (ABC), devolver (PM09) o resolver incidencia | Denegado |
| Fecha nula; stock insuficiente; devolución mayor que lo vendido; revertir dos veces | `fecha_requerida`, `stock_insuficiente`, `devolucion_supera_cantidad_pendiente`, `venta_stock_ya_revertida` |
| Cierre directo desde `ABIERTA`; finalizar sin conteo provisional | `cierre_definitivo_requiere_provisional`, `cierre_provisional_no_encontrado` |
| Cierre final con un cobro pendiente | `cierre_definitivo_bloqueado: PAGOS_PENDIENTES` |
| Abrir cuenta en una sesión cerrada | `terminal_sesion_no_operativa` |

## Hallazgos (requieren decisión o autorización; nada se ha corregido)

1. **Aviso de `locales` (defecto reproducido en base de datos).** El cliente
   guarda el bloque `locales` con `upsert({key, value})` en `almacen_kv`. El
   valor es un array sin `empresaId`, el trigger `pm05_scope_almacen_kv` deja
   `empresa_id` a `NULL` y la política INSERT exige `empresa_id IS NOT NULL`.
   Resultado: `42501 new row violates row-level security policy` para los cuatro
   actores probados, incluidos los propietarios de la empresa dueña de la fila.
   Controles: `UPDATE` directo como Propietario A funciona (1 fila); como
   Propietario B 0 filas; `INSERT` con `empresaId` funciona para A y falla para B;
   `INSERT` de un array sin `empresaId` falla. La clave primaria es solo `key`
   (global entre empresas). El valor guardado tiene 3 locales y la tabla `locales`
   tiene 4. El cliente traga el error (`catch` → `marcarPendiente`), por lo que
   solo se ve «Subiendo N…». **No reproducido en navegador:** no se localizó el
   texto exacto del aviso en el código ni se capturó la petición de red.
2. **Sin regla de día operativo (A11) en QA.** `private.abc_operating_day_reglas`
   está vacía en todos los locales, así que `abc_abrir_cuenta` falla con
   `operating_day_configuracion_ausente`. Es una precondición de datos.
3. **Los circuitos ABC y PM09 no están conectados.** La venta y el cobro ABC
   (efectivo y tarjeta) no movieron stock (`movimientos_stock` 0, piso 10). La
   devolución PM09 escribe en el libro de caja con `session_id = NULL`: dentro de
   una sesión ABC el cierre calculó esperado 111 frente a 100 de efectivo físico
   y reportó −11 sin poder explicarlo.
4. **La devolución PM09 repone stock vendible sin condición** (piso 8→9). No hay
   forma de indicar comida consumida o merma (B08, T11).
5. **El cierre final acepta una diferencia de efectivo sin tratamiento.** El
   ensayo C12 la marcó `DIFERENCIA_EFECTIVO` (resultado `PENDIENTE`), pero
   `abc_finalizar_cierre_sesion_caja` cerró con −11 y sin motivo ni aprobación.
   C03 figura como contrato no aplicado en QA, por lo que es una brecha esperable.
6. Observaciones menores: tras un reembolso confirmado de 11, el estado de cobro
   sigue `PAGADO` con `confirmado 22` (no es neto). Reabrir una sesión
   `CERRADA_FINAL` responde `cierre_provisional_no_encontrado`, poco explícito.

## Limpieza

Todas las ejecuciones terminaron en `ROLLBACK`. Verificación posterior: 0 filas
con `ZZ-ENS*`, `ZZ-ENSAYO-CAFE` o `ee000000-…` en las tablas afectadas (caja,
sesiones, cierres, cuentas, pedidos, checkouts, pagos, intentos, reservas,
reembolsos, incidencias, outbox, stock, movimientos, devoluciones, catálogo,
reglas de día operativo, identificadores globales y `almacen_kv`). Los recuentos
coinciden con la línea base (`almacen_kv` 24, `stock_ubicacion` 53, `caja_sesiones`
1, `cuentas_comerciales` 2, `pedidos_tpv` 2, catálogo 0). `pedido_lineas` (2) y
`abc_eventos` (10) son de septiembre y no son del ensayo.

Efecto no reversible: la secuencia de `movimientos_stock` avanzó (último valor
1538 frente a un `id` máximo de 1524), con huecos sin consecuencia. No se
inventariaron otras secuencias. Los textos de las sentencias quedan en los
registros de Supabase.

## No cubierto

Interfaz y preview, dos navegadores o sesiones reales, dispositivos, concurrencia
real (dos conexiones simultáneas), tiempo real (medianoche, cambio horario,
reloj desajustado), documentos y fiscalidad (C05–C10), proveedor y webhooks
(B07, B12), cierre simultáneo con cobro (T14), restauración y carga. Por eso este
ensayo no cierra A12 ni C12.

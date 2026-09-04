# PM-07 · Stock y reversos por ubicación — EN CURSO

Rama: `pm07-stock-reversos-ubicacion`
Base exacta: PM-06 cerrado `972d1f022659eac21d223929e08805d537872125`
Backend de pruebas: L&A Suite QA `qjqorixtkilwsndqayyx`
Producción: NO modificada
Main: NO modificada

## Alcance
Resolver LA-005 / LA-006 / LA-015 conforme a DEC-02:
- stock físico por empresa/local/producto;
- total = almacén + piso;
- no stock negativo;
- venta bloqueada antes de mutar si la disponibilidad es insuficiente;
- movimiento registra deltas exactos por ubicación;
- reverso vinculado e idempotente restaura exactamente las ubicaciones originales;
- traslado almacén<->piso con efecto neto 0;
- unidades indivisibles enteras y fraccionables con precisión explícita;
- alerta de mínimo coherente por local;
- operación ordinaria bloqueada para local inactivo.

## Migraciones aplicadas solo en QA
1. `pm07_stock_ubicacion_y_reversos`
2. `pm07_ajustar_roles_venta`
3. `pm07_bloqueo_local_inactivo_v2`

## Estructura QA creada
- `public.stock_ubicacion`
- `public.stock_operaciones`
- `public.movimientos_stock`
- `public.stock_estado` (security_invoker)
- RPC `registrar_venta_stock`
- RPC `revertir_venta_stock`
- RPC `trasladar_stock_interno`

RLS está habilitado en las tres tablas. Escrituras directas de `anon/authenticated` revocadas; lectura autorizada por `private.la_tiene_local`. Mutaciones sensibles se realizan mediante RPC con `auth.uid()`, rol y contexto empresa/local.

## Evidencia inicial ejecutada
### LA-005 · venta / reverso por ubicación
Fixture A1: almacén 18, piso 5, total 23.
- Venta 24 con 23: rechazo `stock_insuficiente`.
- Tras el rechazo: total permanece 23 y `operation_id=PM07-QA-VENTA-24` deja 0 operaciones.
- Venta válida 6: descuenta exactamente piso -5 y almacén -1; saldo 17.
- Reverso: piso +5 y almacén +1; restaura exactamente 18+5=23.

### LA-006 · traslado interno
- Traslado 5 almacén -> piso: almacén 13, piso 10, total 23.
- Movimiento: `delta_almacen=-5`, `delta_piso=+5`, `delta_total=0`.
- Replay con el mismo `operation_id` y payload: `replayed=true`.
- Mismo `operation_id` con cantidad distinta: `operation_id_conflict`.

### LA-015 · mínimo
Con mínimo=3:
- total 0 -> `bajo_minimo=true`
- total 1 -> `bajo_minimo=true`
- total 2 -> `bajo_minimo=true`
- total 3 -> `bajo_minimo=false`
Fixtures temporales de alerta eliminados (0 residuos).

### Roles / empresa / local
- El rol real QA es `Cajero/a`; se corrigió el literal backend que inicialmente usaba `Cajero`.
- Cajero/a A1 puede vender en A1.
- Cajero/a A1 no puede ejecutar traslado interno: `traslado_no_autorizado`.
- Propietario B intentando vender en A1: `contexto_no_autorizado`.
- Usuario inactivo: `stock_no_autorizado`.
- Propietario A intentando venta ordinaria en A-CERRADO: `local_inactivo`.

## Baseline permanente PM-07 en QA
- A1 / QA-PROD-A-AGUA: almacén 18, piso 5, total 23, mínimo 3.
- A2 / QA-PROD-A-AGUA: almacén 8, piso 2, total 10, mínimo 3.
- A-CERRADO / QA-PROD-A-AGUA: almacén 4, piso 0, total 4, `local_operable=false`.
- B1 / QA-PROD-B-CAFE: almacén 5, piso 2, total 7, mínimo 3.
Las operaciones `PM07-QA-*` usadas en el primer bloque fueron eliminadas antes de fijar el baseline.

## Security Advisor
Sin avisos de RLS ausente para las tablas PM-07. El advisor marca las RPC SECURITY DEFINER expuestas a `authenticated`; es intencional y requiere mantener las comprobaciones internas de `auth.uid()`, rol y contexto. Existen avisos preexistentes fuera de PM-07 (p. ej. leaked-password protection y tablas internas sin policies) que no se corrigen dentro de este paquete.

## Pendiente antes de cierre
- Guardar en GitHub la migración SQL reproducible completa.
- Probar lectura/RLS por A1/A2/B/inactivo con credenciales normales o arnés seguro.
- Probar unidades fraccionables e indivisibles.
- Probar sobre-traslado por ubicación sin mutación.
- Probar reverso duplicado y `operation_id` conflictivo de venta/reverso.
- Probar carrera por última unidad / concurrencia razonable (NR-06) sin usar producción.
- Revisar transferencia interlocal contra DEC-02 y conservar compatibilidad con el flujo ya validado previamente.
- Conectar frontend actual a la autoridad PM-07 sin reescribir módulos cerrados.
- Build, Deploy Preview, smoke móvil/TPV, regresión dependiente y limpieza final.
- Crear PR de cierre solo cuando la evidencia final esté verde. NO MERGE / NO PRODUCCIÓN.

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
1. `20260904135838 pm07_stock_ubicacion_y_reversos`
2. `20260904140200 pm07_ajustar_roles_venta`
3. `20260904140526 pm07_bloqueo_local_inactivo_v2`
4. `pm07_validacion_cantidad_semantica`

Las migraciones están versionadas en `supabase/migrations/` en la rama PM-07. No se han aplicado a producción.

## Estructura QA creada
- `public.stock_ubicacion`
- `public.stock_operaciones`
- `public.movimientos_stock`
- `public.stock_estado`
- RPC `registrar_venta_stock`
- RPC `revertir_venta_stock`
- RPC `trasladar_stock_interno`

RLS está habilitado en las tres tablas. Escrituras directas de `authenticated` revocadas; lectura autorizada por `private.la_tiene_local`. Mutaciones sensibles se realizan mediante RPC con `auth.uid()`, rol y contexto empresa/local. `movimientos_stock` fuerza `delta_total = delta_almacen + delta_piso` y un índice único impide más de un REVERSO por movimiento original.

## Evidencia ejecutada
### LA-005 · venta / reverso por ubicación
Fixture A1: almacén 18, piso 5, total 23.
- Venta 24 con 23: rechazo `stock_insuficiente`.
- Tras el rechazo: total permanece 23 y no queda operación huérfana.
- Venta válida 6: descuenta exactamente piso -5 y almacén -1; saldo 17.
- Reverso: piso +5 y almacén +1; restaura exactamente 18+5=23.
- Replay del mismo reverso: `replayed=true` y no duplica efecto.
- Segundo reverso con otro `operation_id`: rechazo `venta_stock_ya_revertida`.

### LA-006 · traslado interno
- Traslado 5 almacén -> piso: almacén 13, piso 10, total 23.
- Movimiento: `delta_almacen=-5`, `delta_piso=+5`, `delta_total=0`.
- Replay con el mismo `operation_id` y payload: `replayed=true`.
- Mismo `operation_id` con cantidad distinta: `operation_id_conflict`.
- Sobre-traslado 11 con solo 10 disponibles en almacén: rechazo `stock_insuficiente_ubicacion`.
- Tras el rechazo el saldo del fixture permanece 10+0=10, sin mutación.

### Unidades / precisión
- Producto indivisible, cantidad 1.5: rechazo semántico `unidad_indivisible`.
- Producto fraccionable con precisión 2, cantidad 1.25: venta válida; saldo 10 -> 8.75.
- Mismo producto, cantidad 1.234: rechazo `precision_cantidad_excedida`.
- Se corrigió un defecto detectado durante QA: inicialmente 1.5 indivisible devolvía `precision_cantidad_excedida`; ahora la validación comprueba indivisibilidad antes de redondear.

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
- Cajero/a A1 no puede vender en A2: `contexto_no_autorizado`.
- Cajero/a A1 no puede ejecutar traslado interno: `traslado_no_autorizado`.
- Propietario B intentando vender en A1: `contexto_no_autorizado`.
- Usuario inactivo: `stock_no_autorizado`.
- Propietario A intentando venta ordinaria en A-CERRADO: `local_inactivo`.
- A-CERRADO conserva su stock histórico y `local_operable=false`.

### Idempotencia / última unidad / concurrencia estructural
- Operaciones sensibles usan `operation_id` durable y payload normalizado.
- Mismo `operation_id` + mismo payload -> replay sin doble efecto.
- Mismo `operation_id` + payload distinto -> `operation_id_conflict`.
- Fixture de última unidad: saldo inicial 1.
- Primera venta con `PM07-LAST-1`: éxito y saldo 0.
- Segunda venta con `PM07-LAST-2`: `stock_insuficiente`.
- Resultado: exactamente 1 operación, 1 movimiento y saldo 0; nunca -1.
- `registrar_venta_stock` obtiene la fila `stock_ubicacion ... FOR UPDATE` antes de comprobar saldo y mutar, por lo que las sesiones concurrentes quedan serializadas sobre empresa/local/producto.
- Pendiente para cierre: stress real desde dos sesiones cliente simultáneas si se habilita un arnés seguro; no se instalaron extensiones de concurrencia permanentes solo para el test.

## Baseline permanente PM-07 en QA tras limpieza
- A1 / QA-PROD-A-AGUA: almacén 18, piso 5, total 23, mínimo 3, operable.
- A2 / QA-PROD-A-AGUA: almacén 8, piso 2, total 10, mínimo 3, operable.
- A-CERRADO / QA-PROD-A-AGUA: almacén 4, piso 0, total 4, `local_operable=false`.
- B1 / QA-PROD-B-CAFE: almacén 5, piso 2, total 7, mínimo 3, operable.
Todos los fixtures `PM07-TEST-*` fueron eliminados: 0 movimientos, 0 operaciones y 0 filas de stock residuales.

## Security Advisor
Sin avisos de RLS ausente para las tablas PM-07. El advisor marca las RPC SECURITY DEFINER expuestas a `authenticated`; es intencional y exige mantener las comprobaciones internas de `auth.uid()`, rol y contexto. Existen avisos preexistentes fuera de PM-07 (p. ej. leaked-password protection y tablas internas sin policies) que no se corrigen dentro de este paquete.

## Pendiente antes de cierre
- Probar lectura RLS efectiva por A1/A2/B/inactivo mediante cliente authenticated o arnés seguro; policies ya inspeccionadas y restringen por `private.la_tiene_local`.
- Ejecutar stress real de última unidad con dos sesiones simultáneas si el entorno permite un arnés seguro.
- Revisar transferencia interlocal contra DEC-02 y conservar compatibilidad con el flujo ya validado previamente.
- Conectar frontend/TPV actual a la autoridad PM-07 sin reescribir módulos cerrados.
- Conectar Dashboard/avisos/Kardex a la misma autoridad `stock_estado`/`movimientos_stock` para LA-015.
- Build, Deploy Preview, smoke móvil/TPV, regresión dependiente y limpieza final.
- Crear PR de cierre solo cuando la evidencia final esté verde. NO MERGE / NO PRODUCCIÓN.

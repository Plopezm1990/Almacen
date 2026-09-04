# PM-07 · Stock y reversos por ubicación — VALIDACIÓN FINAL

Rama: `pm07-stock-reversos-ubicacion`
Base exacta: PM-06 cerrado `972d1f022659eac21d223929e08805d537872125`
Backend de pruebas: L&A Suite QA `qjqorixtkilwsndqayyx`
Producción: NO modificada
Main: NO modificada

## Alcance
Resolver LA-005 / LA-006 / LA-015 conforme a DEC-02:
- stock físico autoritativo por empresa/local/producto y ubicación;
- total = almacén + piso;
- no stock negativo;
- venta bloqueada antes de mutar si disponibilidad insuficiente;
- deltas exactos por ubicación;
- reverso vinculado e idempotente que restaura las ubicaciones originales;
- traslado almacén<->piso con efecto neto 0;
- traslado interlocal atómico con efecto neto empresa 0;
- unidades indivisibles enteras y fraccionables con precisión explícita;
- alerta de mínimo con regla estricta `total < minimo`;
- operación ordinaria bloqueada para local inactivo.

## Backend QA implementado
Tablas/vista principales:
- `public.stock_ubicacion`
- `public.stock_operaciones`
- `public.movimientos_stock`
- `public.stock_estado` con `security_invoker=true`

RPC principales:
- `registrar_venta_stock`
- `revertir_venta_stock`
- `trasladar_stock_interno`
- `registrar_venta_stock_carrito`
- `revertir_venta_stock_carrito`
- `trasladar_stock_entre_locales`

RLS está habilitado en las tablas PM-07. Las escrituras directas de `authenticated` están revocadas; lectura autorizada por `private.la_tiene_local`. Las mutaciones sensibles pasan por RPC con `auth.uid()`, rol y contexto empresa/local. El ledger exige `delta_total = delta_almacen + delta_piso` y protege frente a reversos duplicados.

## Evidencia backend
### LA-005 · venta / reverso por ubicación
Baseline A1 original: almacén 18, piso 5, total 23.
- Venta 24 con 23: rechazo `stock_insuficiente`, sin operación huérfana ni mutación.
- Venta válida 6: piso -5 y almacén -1; total 17.
- Reverso: piso +5 y almacén +1; restaura exactamente 23.
- Replay del mismo reverso: sin doble efecto.
- Segundo reverso distinto: `venta_stock_ya_revertida`.

### Carrito atómico
- Carrito válido con varias líneas: todas decrementan juntas.
- Replay del mismo `operation_id`: idempotente.
- Mismo ID con payload diferente: `operation_id_conflict`.
- Si una línea es insuficiente: 0 operación, 0 movimientos y 0 mutaciones en todas las líneas.
- Reverso del carrito restaura todas las líneas conjuntamente y conserva metadatos económicos para Kardex/informes.

### LA-006 · traslados
Interno almacén -> piso:
- movimiento exacto `delta_almacen=-5`, `delta_piso=+5`, `delta_total=0`;
- total físico permanece invariable;
- replay idempotente;
- sobretraslado rechazado sin mutación.

Entre locales:
- origen y destino se modifican en una sola operación atómica con dos patas de movimiento;
- efecto neto empresa = 0;
- sobretraslado: `stock_insuficiente_ubicacion`, sin escrituras parciales;
- destino cerrado: `local_inactivo`, sin escrituras parciales;
- replay idempotente y conflicto de payload protegido.

### Unidades / precisión
- Indivisible 1.5: `unidad_indivisible`.
- Fraccionable precisión 2 acepta 1.25.
- 1.234 con precisión 2: `precision_cantidad_excedida`.

### LA-015 · mínimo
Con mínimo=3:
- total 0 -> alerta
- total 1 -> alerta
- total 2 -> alerta
- total 3 -> no alerta
Regla validada: `total < minimo`.

### Roles / aislamiento / local cerrado
- Cajero/a A1 vende en A1 pero no en A2.
- Cajero/a no gestiona traslados de stock.
- Propietario B no accede al contexto de empresa A.
- Usuario inactivo rechazado.
- Venta ordinaria en A-CERRADO rechazada con `local_inactivo`.
- El local cerrado conserva historia/stock histórico.

### Idempotencia y concurrencia
- Mismo `operation_id` + mismo payload -> replay sin doble efecto.
- Mismo `operation_id` + payload distinto -> conflicto.
- Prueba determinista de última unidad: primera operación 1 -> 0; segunda operación distinta falla por stock insuficiente; nunca existe saldo negativo.
- Las RPC bloquean las filas de stock con `SELECT ... FOR UPDATE` antes de validar saldo y mutar.
- Limitación explícita: no se ha ejecutado un stress real desde dos sesiones cliente simultáneas; la garantía se apoya en prueba determinista + bloqueo transaccional estructural.

## Frontend PM-07
Integración realizada sin reescribir módulos cerrados:
- sincronización de `stock_estado` y `movimientos_stock` al cargar/cambiar local;
- TPV cloud usa `registrar_venta_stock_carrito`;
- no existe fallback local de stock cuando falla servidor en nube;
- fallback local reservado al modo offline y sin déficit;
- anulación cloud usa `revertir_venta_stock_carrito`;
- traslado interno usa `trasladar_stock_interno`;
- traslado interlocal usa `trasladar_stock_entre_locales`;
- TPV y alertas consumen stock autoritativo cuando está disponible;
- alerta corregida a `< minimo` y corregida precedencia de expresiones JS.

## Regresión automatizada
Existe `tests/pm07/frontend-contract.mjs` y `.github/workflows/pm07-regresion.yml`.
En el HEAD previo a esta actualización documental, las ejecuciones PM-07 y PM-05 asociadas al PR estaban en SUCCESS. La actualización de este documento debe volver a pasar los checks antes del cierre formal.

## Deploy Preview y smoke runtime móvil
Se generó Deploy Preview seguro mediante el PR temporal #22, sin merge a `main` y sin modificar producción.

Smoke ejecutado manualmente en móvil Android sobre el Deploy Preview con identidad QA temporal. Evidencia observada durante la sesión:
- selector multilocal muestra QA Local A1 y QA Local A2 para la empresa QA;
- traslado interno almacén -> piso de venta registrado y visible en historial;
- traslado A1 -> A2 de 3 ud completado y visible en historial;
- intento de trasladar 11 ud con solo 10 disponibles bloqueado antes de confirmar, mostrando disponibilidad real;
- Dashboard inicialmente detectó descuadres de caché frente al histórico durante la preparación de fixtures;
- tras sincronización/corrección QA, `Descuadres de stock` pasó a 0;
- Productos mostró el stock autoritativo por almacén/piso;
- TPV mostró producto sin stock de venta cuando correspondía y evitó disponibilidad ficticia;
- venta runtime descontó stock y actualizó Dashboard;
- anulación/reverso runtime restauró stock, quedando Dashboard y Productos sincronizados;
- regla LA-015 comprobada visualmente: con total=3 y mínimo=3 no aparece alerta; al quedar total=2 aparece `1 producto en stock bajo` y detalle `2,00 / mín. 3,00`;
- no se observó error fatal de React/hooks durante el recorrido móvil.

## Fixtures temporales de smoke
Para permitir el smoke de una sesión cloud nueva se crearon exclusivamente en QA:
- usuario Auth temporal `pm07.smoke@qa.invalid` con perfil/membresía Propietario de QA-EMP-A;
- bootstrap funcional temporal en `almacen_kv` para empresa/locales/productos/movimientos;
- producto/stock temporal diferenciado para QA Local A2 cuando fue necesario para evitar ambigüedad de IDs en el modelo frontend.

Estos elementos son datos de prueba y deben eliminarse al terminar el cierre. La eliminación del usuario Auth puede requerir acción manual si la herramienta conectada no expone Auth Admin delete-user.

## Observación arquitectónica fuera de alcance
Durante el bootstrap se observó que `almacen_kv.key` parece actuar como identidad global aunque la tabla contiene `empresa_id/local_id`. Las claves funcionales canónicas podrían no poder coexistir por empresa si la unicidad es solo global. No se modifica este diseño dentro de PM-07: debe tratarse como deuda/arquitectura en un paquete posterior si se confirma.

## Estado de cierre
PM-07 permanece en VALIDACIÓN FINAL hasta completar:
1. checks verdes del HEAD documental final;
2. limpieza de fixtures temporales QA y operaciones de smoke que no deban conservarse;
3. actualización del PR canónico #21 con esta evidencia;
4. cierre sin merge del PR temporal #22;
5. cierre formal del PR canónico según el patrón del proyecto, siempre sin merge a `main` salvo autorización expresa.

NO MERGE A `main`. NO PRODUCCIÓN. NO iniciar PM-08 hasta declarar PM-07 CERRADO.

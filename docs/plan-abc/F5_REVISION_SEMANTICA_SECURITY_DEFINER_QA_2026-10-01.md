# F5 revisión semántica de SECURITY DEFINER en QA

Fecha: 2026-10-01  
Proyecto: `qjqorixtkilwsndqayyx` — L&A Suite QA  
Estado: `REVISION_SEMANTICA_COMPLETADA_CAMBIOS_PENDIENTES`

## Resultado A10

Las seis RPC A10 que activan el aviso del advisor son wrappers SQL con
`SET search_path TO ''` y delegan en helpers privados:

| RPC pública | Helper | Resultado |
| --- | --- | --- |
| `abc_agregar_linea_pedido_configurada` | `private.abc_mutar_linea_configurada` | guardia delegada verificada |
| `abc_actualizar_linea_pedido_configurada` | `private.abc_mutar_linea_configurada` | guardia delegada verificada |
| `abc_confirmar_linea_pedido_configurada` | `private.abc_mutar_linea_configurada` | guardia delegada verificada |
| `abc_iniciar_preparacion_linea` | `private.abc_transicionar_linea_operativa` | guardia delegada verificada |
| `abc_marcar_linea_preparada` | `private.abc_transicionar_linea_operativa` | guardia delegada verificada |
| `abc_servir_linea` | `private.abc_transicionar_linea_operativa` | guardia delegada verificada |

Los helpers comprueban `auth.uid()`, capacidad por empresa/local, parámetros
obligatorios, terminal y sesión operativa. También validan versiones esperadas,
estado de pedido/línea, día operativo, `operation_id` y replay antes de mutar.
La ausencia de `auth.uid()` en el wrapper no es un bypass en este caso porque
la función privada es la frontera de autorización.

## Resultado PM09

Las cinco RPC PM09 llaman a una función pública base que sí comprueba
autenticación, capacidad y contexto de empresa/local. También usan bloqueo de
`operation_id` y validan fecha. No se confirma un bypass de autorización en
esta lectura, pero quedan tres puntos concretos para una corrección separada:

1. `registrar_venta_stock_pm09`, `revertir_venta_stock_pm09` y el helper
   `private.pm09_bloquear_operation_id_stock` declaran
   `search_path TO 'public', 'auth', 'private', 'pg_temp'`; debe evaluarse el
   endurecimiento a `search_path TO ''` y la cualificación de nombres antes de
   cambiarlo.
2. Las cinco funciones PM09 tienen `EXECUTE` para `service_role` en QA; hay
   que confirmar si ese canal sigue siendo necesario o si debe revocarse en una
   migración compensatoria.
3. Los wrappers actualizan `movimientos_stock` después de delegar usando
   `operation_id`; aunque el identificador está tratado como único por el
   núcleo, la revisión de aislamiento debe confirmar que añadir
   `empresa_id`/`local_id` no rompe replay ni compatibilidad histórica.

Funciones PM09 revisadas:

- `registrar_devolucion_venta_pm09`
- `registrar_venta_stock_carrito_pm09`
- `registrar_venta_stock_pm09`
- `revertir_venta_stock_carrito_pm09`
- `revertir_venta_stock_pm09`

## Decisión

No se revocaron grants, no se reemplazó `SECURITY DEFINER`, no se cambió
`search_path` y no se modificó ninguna base. Los seis wrappers A10 quedan
clasificados como API intencionada con guardia delegada. Las cinco funciones
PM09 quedan clasificadas como `REVISAR_Y_ENDURECER`, con cambios que requieren
pruebas de compatibilidad, preflight y rollback.

El siguiente subpunto aislado será preparar el candidato local de hardening
PM09 y sus pruebas negativas, sin aplicarlo en QA/PROD hasta validar el
impacto.

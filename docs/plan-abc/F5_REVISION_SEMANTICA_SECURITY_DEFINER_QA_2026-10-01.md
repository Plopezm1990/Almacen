# F5 revisión semántica de SECURITY DEFINER en QA

Fecha de actualización: 2026-10-02
Proyecto: `qjqorixtkilwsndqayyx` — L&A Suite QA
Estado: `REVISION_SEMANTICA_PM09_COMPLETADA_CANDIDATO_VALIDADO`

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
`operation_id` y validan fecha. La lectura de QA no confirma un bypass de
autorización, pero sí confirma una superficie de endurecimiento concreta:

1. En QA, `registrar_venta_stock_pm09` y `revertir_venta_stock_pm09` declaran
   `search_path TO 'public', 'auth', 'private', 'pg_temp'`; el wrapper de
   devolución y los dos wrappers de carrito ya tienen `search_path = ''`.
2. Las cinco funciones PM09 tienen `EXECUTE` para `service_role` en QA. El
   inventario local no encontró callers de esos wrappers desde Edge Functions
   ni desde código que use `SUPABASE_SERVICE_ROLE_KEY`.
3. Los wrappers actualizan `movimientos_stock` después de delegar usando
   `operation_id`; el candidato conserva las referencias cualificadas y las
   barreras de replay/fecha sin cambiar las funciones base PM07/PM08.

La autorización efectiva está en las funciones base: comprueban `auth.uid()`,
capacidad PM07/PM08 y pertenencia a empresa/local mediante helpers privados.
El helper privado `private.pm09_bloquear_operation_id_stock` no es ejecutable
por roles cliente.

Funciones PM09 revisadas:

- `registrar_devolucion_venta_pm09`
- `registrar_venta_stock_carrito_pm09`
- `registrar_venta_stock_pm09`
- `revertir_venta_stock_carrito_pm09`
- `revertir_venta_stock_pm09`

## Decisión

No se reemplazó `SECURITY DEFINER`. El hardening PM09 se aplicó únicamente en
QA: se fijó `search_path = ''` en los cinco wrappers, se retiró `EXECUTE` para
`service_role` y se mantuvo `authenticated` como único rol cliente. Los seis
wrappers A10 siguen clasificados como API intencionada con guardia delegada.
Producción queda pendiente de validación funcional y autorización separada.

El candidato local de hardening, sus pruebas negativas y la verificación QA ya
están completados. El siguiente subpunto será la validación funcional del
flujo PM09 contra QA antes de valorar producción.

# F5 inventario de funciones SECURITY DEFINER en QA

Fecha: 2026-10-01  
Proyecto: `qjqorixtkilwsndqayyx` — L&A Suite QA  
Estado: `INVENTARIO_LECTURA_COMPLETADO_REVISION_PRIORIZADA`

## Resultado agregado

La consulta de catálogo PostgreSQL fue de solo lectura y cubrió funciones
`SECURITY DEFINER` de los esquemas `public` y `private`.

| Medida | Resultado |
| --- | ---: |
| Funciones `SECURITY DEFINER` totales | 216 |
| En `public` | 117 |
| En `private` | 99 |
| Públicas ejecutables por `authenticated` | 106 |
| Públicas ejecutables por `anon` | 0 |
| Públicas ejecutables por `service_role` | 54 |
| Públicas sin configuración `search_path` detectada | 0 |

El contador del advisor de 106 funciones coincide con el inventario. El hecho
de que una RPC sea ejecutable por `authenticated` no demuestra por sí solo que
sea insegura: varias son la API prevista y además comprueban autenticación,
capacidad, tenant y estado de la operación.

## Cribado de revisión

Se inspeccionó la definición como filtro inicial, buscando marcadores directos
de `auth.uid()` y `abc_tiene_capacidad`. El filtro no sustituye la revisión
semántica de cada función ni sigue llamadas privadas indirectas.

- 94 funciones contienen un marcador directo de `auth.uid()`.
- 51 contienen un marcador directo de `tiene_capacidad`.
- 11 no contienen ninguno de esos dos marcadores y pasan a revisión prioritaria.

Funciones prioritarias identificadas:

- `abc_actualizar_linea_pedido_configurada`
- `abc_agregar_linea_pedido_configurada`
- `abc_confirmar_linea_pedido_configurada`
- `abc_iniciar_preparacion_linea`
- `abc_marcar_linea_preparada`
- `abc_servir_linea`
- `registrar_devolucion_venta_pm09`
- `registrar_venta_stock_carrito_pm09`
- `registrar_venta_stock_pm09`
- `revertir_venta_stock_carrito_pm09`
- `revertir_venta_stock_pm09`

Cinco de las once funciones `pm09` también tienen `EXECUTE` para
`service_role`; las seis funciones de línea configurada aparecen solo con
`authenticated` dentro de esta selección. Esta clasificación es una señal de
revisión, no una decisión automática de revocar permisos.

## Criterio de revisión siguiente

Para cada función prioritaria se comprobará en el código desplegado:

1. autenticación efectiva y autorización por empresa/local;
2. capacidad o helper privado equivalente, si la autorización está delegada;
3. `search_path` fijo y llamadas a helpers no expuestos;
4. idempotencia, validación de identificadores y límites de los parámetros;
5. necesidad real de `authenticated` y `service_role`.

Solo después de esa revisión se podrá preparar una migración compensatoria
pequeña. No se revocan grants, no se cambia `SECURITY DEFINER` y no se escribe
QA/PROD en este punto.

## Límites

El inventario se refiere al estado actual de QA. C03-C12 siguen siendo
candidatos locales; la RPC y la tabla C12 todavía no están aplicadas en QA ni
PROD. El mismo inventario de PROD queda pendiente de un subpunto separado.

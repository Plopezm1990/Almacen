# F5 inventario de funciones SECURITY DEFINER en QA

Fecha de actualización: 2026-10-02
Proyecto: `qjqorixtkilwsndqayyx` — L&A Suite QA
Estado: `INVENTARIO_LECTURA_COMPLETADO_CLASIFICACION_24_NO_ESTRICTAS`

## Resultado agregado

La consulta del catálogo PostgreSQL fue de solo lectura y cubrió funciones
`SECURITY DEFINER` de los esquemas `public` y `private`.

| Medida | Resultado |
| --- | ---: |
| Funciones `SECURITY DEFINER` totales | 247 |
| En `public` | 136 |
| En `private` | 111 |
| Públicas con `search_path = ''` | 112 |
| Públicas con `search_path` no estricto | 24 |
| Públicas ejecutables por `authenticated` | 125 |
| Públicas ejecutables por `anon` | 0 |
| Públicas ejecutables por `service_role` | 54 |

El contador actual del advisor de Supabase de 125 funciones públicas
ejecutables por `authenticated` coincide con el inventario. El hecho de que
una RPC sea ejecutable por `authenticated` no demuestra por sí solo que sea
insegura: varias son la API prevista y comprueban autenticación, capacidad,
empresa/local y estado de la operación, directamente o mediante helpers
privados.

## Clasificación de las 24 funciones públicas con `search_path` no estricto

La revisión combinó el catálogo desplegado de QA con las definiciones y los
grants versionados en el repositorio. El resultado es una clasificación de
riesgo y de intención, no una revocación automática de permisos.

### A. Puente de contexto e instalación — 5 funciones

- `guardar_contexto_instalacion_ui`
- `obtener_contexto_instalacion_ui`
- `obtener_contexto_operativo`
- `obtener_estado_instalacion`
- `obtener_generacion_instalacion`

Están expuestas a `authenticated` y `service_role`; las definiciones revisadas
contienen autenticación directa o delegan en helpers privados. Deben conservar
un `search_path` explícito y limitado cuando se prepare la corrección técnica.

### B. PM11 de cuentas de empleados — 6 funciones

- `pm11_anonimizar_empleado`
- `pm11_desvincular_cuenta_empleado`
- `pm11_finalizar_creacion_cuenta_empleado`
- `pm11_migrar_empleados_legacy`
- `pm11_previsualizar_migracion_empleados_legacy`
- `pm11_vincular_cuenta_empleado`

La mayoría comprueba `auth.uid()` directamente y todas delegan en la capa
privada de PM11. `pm11_finalizar_creacion_cuenta_empleado` queda marcada para
revisión específica porque no contiene el marcador directo de `auth.uid()` y
su seguridad depende del helper privado y del flujo de llamada.

### C. Operaciones de caja, encargos y stock — 12 funciones

- `registrar_encargo`
- `registrar_pago_encargo`
- `registrar_pago_factura`
- `registrar_venta_stock`
- `registrar_venta_stock_carrito`
- `registrar_venta_stock_pm09`
- `revertir_pago_encargo`
- `revertir_pago_factura`
- `revertir_venta_stock`
- `revertir_venta_stock_pm09`
- `trasladar_stock_entre_locales`
- `trasladar_stock_interno`

Las definiciones revisadas incluyen autenticación directa o un guard delegado
en helper privado. Las dos funciones PM09 (`registrar_venta_stock_pm09` y
`revertir_venta_stock_pm09`) no contienen el marcador directo de `auth.uid()`;
son la prioridad de revisión porque su autorización depende de la cadena
privada y además tienen exposición a `service_role`. Existe un candidato local
de endurecimiento PM09, pero todavía no se ha aplicado en QA ni en producción.

### D. Diagnóstico QA — 1 función

- `qa_ping`

Solo es ejecutable por `service_role`, no contiene autorización de usuario y
su uso es diagnóstico. Debe permanecer fuera de la API de usuario y quedar
documentada como función operativa de QA.

## Conclusión del subpunto

- No se detectaron grants `EXECUTE` para `anon` en las funciones públicas
  `SECURITY DEFINER` revisadas.
- 112 funciones públicas ya tienen `search_path = ''`.
- Las 24 restantes quedan clasificadas por intención y prioridad; no todas
  requieren la misma corrección ni deben revocarse en bloque.
- La prioridad técnica es revisar la cadena de autorización de PM09 y decidir
  el allowlist final de `authenticated`/`service_role` antes de preparar una
  migración compensatoria.

## Criterio de revisión siguiente

Para cada función prioritaria se comprobará en el código desplegado:

1. autenticación efectiva y autorización por empresa/local;
2. capacidad o helper privado equivalente, si la autorización está delegada;
3. `search_path` fijo y llamadas a helpers no expuestos;
4. idempotencia, validación de identificadores y límites de los parámetros;
5. necesidad real de `authenticated` y `service_role`.

Solo después de esa revisión se podrá preparar una migración compensatoria
pequeña. No se revocan grants, no se cambia `SECURITY DEFINER` y no se escribe
QA/PROD en este subpunto.

## Límites

El inventario se refiere al estado actual de QA. C03-C12 siguen siendo
candidatos locales; la RPC y la tabla C12 todavía no están aplicadas en QA ni
PROD. El mismo inventario de PROD queda pendiente de un subpunto separado.

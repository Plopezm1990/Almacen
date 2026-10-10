# F7 · B09 en QA — liquidaciones y disputas

Fecha: 2026-10-08  
Entorno: `L&A Suite QA` (`qjqorixtkilwsndqayyx`)  
Estado: `APLICADO_Y_VERIFICADO_EN_QA`  
Producción: no tocada

## 1. Fuente aplicada

La fuente de B09 ya formaba parte de `release` en el commit
`9ca58df6633da38edd259d215033a8f71802f587`.

Se aplicaron, en orden y sin modificar su contenido:

1. `20260930230000_abc_f4_b09_settlements_disputes.sql`;
2. `20260930233000_abc_f4_b09_import_resolution.sql`.

Los contratos locales pasaron antes de escribir en QA:

- `ABC_F4_B09_SCHEMA=PASS`;
- `ABC_F4_B09_RPC=PASS`;
- `node --check fuente.js` sin errores.

## 2. Comprobación previa

QA estaba activo y saludable sobre PostgreSQL 17. Antes de la aplicación se
confirmó que:

- existían `locales`, `pagos`, `pago_intentos`, `private.abc_request_hash` y
  `private.abc_lock_operation_id`;
- no existía ninguna de las cuatro tablas B09;
- no existía ninguna de las tres RPC B09;
- ninguna migración B09 estaba registrada.

## 3. Registro remoto

| Versión remota | Nombre |
|---|---|
| `20261008174006` | `20260930230000_abc_f4_b09_settlements_disputes` |
| `20261008174013` | `20260930233000_abc_f4_b09_import_resolution` |

## 4. Contrato estructural y permisos

QA contiene ahora:

- `abc_b09_liquidaciones`;
- `abc_b09_liquidacion_lineas`;
- `abc_b09_disputas`;
- `abc_b09_operaciones`;
- `abc_b09_importar_liquidacion`;
- `abc_b09_vincular_linea`;
- `abc_b09_resolver_disputa`.

Las cuatro tablas tienen RLS. `anon` y `authenticated` no tienen lectura ni
escritura directa. Las tres RPC solo pueden ejecutarse como `service_role` y
comprueban además el rol del JWT en servidor.

## 5. Simulador transaccional

El ensayo usó un pago y un intento existentes de QA, sin modificarlos, e importó
dentro de una transacción:

- una liquidación simulada de 1 EUR;
- una línea ya vinculada al pago y al intento;
- una segunda línea inicialmente no vinculada;
- una disputa abierta de 0,20 EUR.

Se verificó:

1. separación de vendido, cobrado, devuelto, comisión y neto liquidado;
2. replay exacto de la importación sin duplicados;
3. vinculación posterior de la línea pendiente;
4. replay exacto de la vinculación;
5. cierre de la disputa con responsable, nota y documentación;
6. replay exacto de la resolución;
7. tres operaciones idempotentes terminadas en `COMPLETADA`;
8. ninguna variación en los conteos de pagos, intentos, ventas, caja o stock.

El ensayo terminó con `B09_QA_SMOKE_PASS_ROLLBACK`.

Después de la reversión, las cuatro tablas B09 quedaron con cero filas.

## 6. Advisors

El asesor de seguridad informa `RLS Enabled No Policy` para las cuatro tablas.
Es el cierre previsto por B09: no hay acceso para usuarios anónimos o
autenticados y la entrada autorizada se realiza mediante RPC de servidor.

El asesor de rendimiento informa ocho claves foráneas sin índice de cobertura y
tres índices B09 todavía sin uso. Todos son avisos `INFO` sobre tablas vacías.
Conviene medirlos con volumen representativo antes de producción para decidir
qué índices adicionales aportan valor.

Referencias:

- <https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy>
- <https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys>
- <https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index>

## 7. Límite pendiente

La prueba usa datos de proveedor simulados. La importación real de
liquidaciones y contracargos continúa dependiendo de una cuenta de proveedor,
sandbox y credenciales de B07. El núcleo B09 queda disponible y verificado en
QA sin producir efectos automáticos sobre pagos, ventas, caja o stock.

# F5 / PM09 · Plan de reconciliación del baseline

Fecha: 2026-10-06
Estado: `PLAN_Y_PREFLIGHT_SOLO_LECTURA_PREPARADOS`
Rama base: `release` (`339ed81`)

## Decisión y alcance

El traspaso del Plan ABC (§7.B, B-3) acordó tratar PM09 después del primer
paquete y preparar primero el plan y las pruebas, sin aplicar de forma implícita
el hardening. Esta entrega contiene solo el plan y un preflight de lectura:
`F5_PM09_BASELINE_PREFLIGHT_SOLO_LECTURA_2026-10-06.sql`. No incluye una
migración de reparación ni una escritura remota.

## Foto de QA y producción

Consulta de catálogo y de historia de migraciones de solo lectura, 2026-10-06:

| Componente | QA | Producción | Decisión para el candidato |
| --- | --- | --- | --- |
| `registrar_venta_stock_pm09` | existe | falta | Crear solo tras verificar la RPC base |
| `revertir_venta_stock_pm09` | existe | falta | Crear después de restaurar la RPC base |
| `revertir_venta_stock` | existe | falta | Restaurar con contrato compatible con PM27 |
| `registrar_devolucion_venta_pm09`, `registrar_venta_stock_carrito_pm09`, `revertir_venta_stock_carrito_pm09` | existen | existen | Conservar hasta revisar diferencias de cuerpo; no reemplazar en bloque |
| `registrar_venta_stock`, `registrar_venta_stock_carrito` | existen | existen | Conservar implementaciones productivas PM27 |
| `revertir_venta_stock_carrito` | existe | existe | Conservar: misma huella de cuerpo observada |
| `private.pm09_bloquear_operation_id_stock` | existe | existe | Conservar hasta revisar diferencia de cuerpo |

Los cuerpos de las otras funciones presentes no son todos idénticos entre
entornos. Las huellas distintas no prueban por sí solas un defecto: producción
tiene restauraciones PM27/P2-R03A y QA tiene las migraciones PM09 históricas y
el hardening. Por ello **no** se copiará el esquema ni se ejecutarán las tres
migraciones PM09 históricas de QA sobre producción.

Las seis tablas de caja/stock consultadas tienen el mismo número de columnas
en ambos entornos. `movimientos_stock` difiere en la generación de `id`:
identidad `BY DEFAULT` en producción frente a secuencia como valor por
defecto en QA. Producción además conserva dos claves externas
`actor_user_id → auth.users` en `movimientos_stock` y `stock_operaciones`
que QA no tiene. El candidato debe respetar esas diferencias y no modificar
las tablas. En producción las funciones observadas no conceden ejecución a
`anon` ni a `service_role`; ese perfil se preservará.

QA registra `pm09_conciliacion_caja`,
`pm09_fecha_operacion_economica`,
`pm09_operation_id_global_hardening` y
`abc_f5_pm09_security_hardening`. Producción no registra ninguna de las
cuatro, aunque conserva tres wrappers PM09 restaurados por P2-R03A. No se
insertarán filas manualmente en `schema_migrations`.

Recuentos productivos actuales de `stock_operaciones` y
`movimientos_stock`: dos filas en cada tabla; **cero** `VENTA` y **cero**
`REVERSO`. Son recuentos, no datos de negocio. Si cambian antes de la
ventana, hay que revisar compatibilidad e idempotencia de las operaciones
existentes.

## Secuencia para el candidato técnico

1. Construir una migración **aditiva y acotada** que restaure
   `public.revertir_venta_stock(text,text,text)` con las comprobaciones de
   autenticación, pertenencia a empresa/local, validación de stock,
   `operation_id` global, replay y auditoría del patrón PM07/PM27. No
   reemplazar `registrar_venta_stock`, `registrar_venta_stock_carrito` ni
   `revertir_venta_stock_carrito`.
2. Crear los dos wrappers ausentes
   (`registrar_venta_stock_pm09` y `revertir_venta_stock_pm09`) con fecha
   económica explícita, bloqueo global de `operation_id` y
   `search_path = ''`. Conceder `EXECUTE` solo a `authenticated`;
   revocar `PUBLIC`, `anon` y `service_role`. El helper privado conserva
   sus permisos restringidos. No aplicar
   `20261001230000_abc_f5_pm09_security_hardening.sql` en bloque porque
   también reemplaza funciones productivas ya presentes.
3. Antes de cualquier DDL, repetir el preflight incluido. Solo avanzar con
   `ok=true`, copia manual fuera del repositorio y candidato exacto
   identificado. Una divergencia de función, tabla, historia o recuento de
   ventas/reversos detiene la ventana para revisar el plan.
4. Probar en PostgreSQL desechable con esquema de producción representativo:
   `id` de movimiento como identidad, las dos claves externas a
   `auth.users`, la implementación PM27 de venta y los wrappers P2-R03A.
   Verificar venta individual, reverso, replay, conflicto de identificador,
   fecha económica, permisos `anon`/`service_role`, contexto de otro local
   y `ROLLBACK` sin filas residuales.
5. Repetir la verificación de catálogo y el humo funcional autenticado en QA.
   Como QA ya tiene las tres funciones, el camino de actualización desde la
   foto productiva se prueba en la base desechable, sin borrar funciones QA.
6. Preparar una hoja de autorización productiva nueva con commit, huellas,
   resultado de CI, copia y condiciones de parada. Ejecutar en producción solo
   con la autorización expresa del paquete. Tras aplicar, comparar firmas,
   permisos y huellas, ejecutar humo transaccional con `ROLLBACK` y observar
   la aplicación. No fusionar ni desplegar la aplicación como efecto colateral.

## Verificación de esta entrega

Se ejecutó el SQL de preflight exacto contra producción mediante una consulta
de solo lectura. Resultado: `ok=true`, sin diferencias de funciones ni tablas,
historia esperada y 0 ventas/reversos. En una segunda ejecución de prueba se
cambió **solo en memoria** una huella esperada: devolvió `ok=false` y señaló
`registrar_venta_stock`. El archivo versionado conserva la huella correcta.
No se cambiaron datos, funciones, permisos ni configuración de QA o producción.

El 10/10/2026 se integró `release` `339ed81` sin conflictos. El preflight
continúa siendo de solo lectura y su SHA-256 es
`96efd09383febeb90622438a1c8bc15c25243b5544062f6c089b01d9196ccd17`.
La repetición contra producción queda reservada para la ventana y requiere
autorización separada.

## Puerta pendiente

Los pasos 1–2 se implementaron después en el
[PR borrador #125](https://github.com/Plopezm1990/Almacen/pull/125), con
prueba local y 17 comprobaciones remotas terminadas sobre `122b10a`; los cinco
trabajos de la puerta general quedaron en verde. La comprobación de solo lectura
se repitió el 6/10/2026 a las 04:45 UTC: `ok=true`, sin diferencias, historia
esperada y cero ventas/reversos. La reconciliación **no está aplicada** en QA
ni en producción. El humo funcional con sesión real en QA terminó con
`ROLLBACK` y sin residuos el 6/10/2026. Quedan una copia manual productiva
nueva, repetir este preflight y la autorización específica de Pedro para esa
ventana. El ejecutor de migración se ensayó con la CLI y PostgreSQL desechable;
véase la hoja de preparación del PR #125.

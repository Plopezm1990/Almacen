# F5 / PM09 · Preparación de la ventana productiva

Fecha: 2026-10-06
Estado: `PREPARADA_PARA_REVISION_SIN_VENTANA_AUTORIZADA`

## Alcance exacto

- Plan y preflight de solo lectura: [PR #124](https://github.com/Plopezm1990/Almacen/pull/124).
- Migración candidata y prueba local: [PR #125](https://github.com/Plopezm1990/Almacen/pull/125).
- Único SQL a ejecutar: `supabase/migrations/20261006040009_abc_f5_pm09_reconcile_prod_baseline.sql`.
- SHA-256 de ese archivo: `d59bf0ca0670dd22987b801558c1fa909ccbd025c9e9fbb32f94fa835c7c6af0`.
- Proyecto de destino: producción `flqercbgpgmmfaakrwkc`. QA `qjqorixtkilwsndqayyx` ya tiene las tres RPC; este SQL se niega a reaplicarse allí.

La migración crea tres funciones ausentes: `revertir_venta_stock`,
`registrar_venta_stock_pm09` y `revertir_venta_stock_pm09`. No cambia tablas,
datos existentes, funciones PM27, aplicación ni permisos de otras RPC. No
aplicar las migraciones históricas PM09 en bloque ni ejecutar `supabase db push`:
el historial remoto y los archivos del repositorio no representan la misma
secuencia lineal.

## Resultado de la revisión

1. **PR #124:** el preflight solo contiene una consulta `WITH`/`SELECT`; exige
   firmas, huellas y permisos de las funciones existentes, huellas de seis
   tablas, historia esperada y cero `VENTA`/`REVERSO`. Devuelve `ok=false`
   ante una huella alterada. Puerta final de CI en verde.
2. **PR #125:** el SQL tiene comprobaciones previas que abortan,
   `search_path=''`, privilegio `EXECUTE` solo para `authenticated`
   y comprobación posterior de las tres funciones. El reverso valida usuario,
   permiso, local, operación de venta individual, devolución previa,
   duplicados y replay. El fixture PostgreSQL cubre rutas positivas y
   negativas; `PM09_PROD_BASELINE_POSTGRES=PASS`. La CLI 2.39.2 aplicó el
   archivo en la base desechable y registró la versión exacta `20261006040009`.
   Al omitir del directorio aislado una versión ya registrada, se negó a
   avanzar. Puerta final de CI en verde antes de esta actualización; repetir.
3. **Límite de la evidencia:** el fixture usa helpers simplificados de
   autorización y huellas sustituidas solo en una copia temporal. No demuestra el flujo
   completo con sesión real, ni equivale a restaurar una copia productiva.
   Los contratos de CI pasan, pero no ejecutan ese fixture especializado.
4. **Lectura remota 6/10/2026, 04:45 UTC:** preflight productivo `ok=true`,
   `function_mismatches=[]`, `table_mismatches=[]`, historia esperada,
   `sale_operations=0` y `sale_movements=0`. En QA existen las tres RPC por
   consulta de catálogo. Fueron solo lecturas; repetirlas en la ventana.

## Condiciones de entrada de la ventana

1. Fijar día y hora, confirmar que producción no esté en uso y congelar el
   commit exacto del PR #125. Volver a comprobar su CI y el SHA-256 del SQL.
2. Pedro prepara **ese mismo día, justo antes de empezar**, una copia manual
   de producción con `roles.sql`, `schema.sql` y `data.sql` fuera del
   repositorio público y en dos ubicaciones. Anotar hora y tamaños no nulos;
   comprobar también que puede acceder a los tres archivos. La copia del
   4/10 fue de otra ventana y no sustituye esta condición.
3. Repetir el SQL exacto de preflight del PR #124 en producción, solo lectura.
   Exigir `ok=true`, listas de diferencias vacías, historia esperada y cero
   `VENTA`/`REVERSO`. Verificar que las tres RPC objetivo siguen ausentes.
4. Verificar en QA con sesión real el flujo PM09 que ya existe allí. El
   candidato se ensayó en PostgreSQL desechable y no se debe aplicar en QA
   porque las tres funciones ya existen.
5. Preparar un directorio temporal **fuera del repositorio** para la CLI.
   Copiar allí solo el candidato exacto y un archivo inerte (`select 1;`)
   por cada versión ya registrada en producción. Obtener de nuevo la lista
   de versiones en solo lectura y exigir correspondencia exacta con esos
   archivos; no añadir ninguna otra migración pendiente. La CLI exige que
   las versiones remotas ya aplicadas tengan archivo local, aunque sea
   inerte. Ensayado con una versión previa ficticia en PostgreSQL desechable.
   Usar `supabase migration up --db-url ... --workdir ...`, sin
   `--include-all`. Confirmar que la CLI va a ejecutar **solo**
   `20261006040009_abc_f5_pm09_reconcile_prod_baseline.sql` y que la
   conexión apunta al proyecto productivo. Si no se puede confirmar, parar.
6. Presentar a Pedro el commit, el hash, los resultados anteriores, la copia,
   el ejecutor y el plan de recuperación. Su autorización debe nombrar este
   paquete PM09 y esta ventana; la autorización para publicar PR no autoriza
   aplicarlo ni fusionar los PR.

## Secuencia prevista tras esa autorización

1. Aplicar una sola vez el SQL aprobado a producción con esa CLI y ese
   directorio temporal. Ante cualquier error,
   detener la ventana; no continuar con otras migraciones ni reintentar a
   ciegas. La transacción de la CLI debe dejar cero funciones nuevas y cero
   entrada de historia nueva si falla.
2. Consultar firmas, `SECURITY DEFINER`, `search_path` y permisos de las tres
   RPC; comprobar que las huellas de las funciones productivas previas no
   cambiaron. Verificar la entrada de historia producida por el ejecutor.
3. Hacer un humo autenticado y acotado en una transacción que termina con
   `ROLLBACK`, confirmando venta individual, reverso, fecha económica,
   aislamiento de local y ausencia de filas residuales. Si no puede
   realizarse con seguridad, detener y revisar antes de abrir el servicio.
4. Observar errores de la aplicación y el estado de stock. Mantener ambos PR
   sin fusionar hasta decidir por separado su incorporación a `release`;
   ninguna publicación de la aplicación forma parte de esta ventana.

## Parada y recuperación

Una diferencia en el preflight, copia ausente, commit o hash cambiado, CI
rojo, fallo de autorización o ejecutor no verificado impide empezar. Si falla
la migración, confirmar el `ROLLBACK` y comprobar que no quedaron funciones
ni registro parcial. Si falla el postflight o el humo, suspender operaciones
PM09 y decidir con Pedro a partir del estado observado. No borrar funciones
ni restaurar la copia automáticamente una vez que haya operaciones nuevas:
eso requiere un plan específico para esos datos.

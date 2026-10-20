# D01 P5 — reconstrucción de la migración de almacén/caja

Fecha: 20/10/2026  
Estado: **fuente versionada; no aplicada desde este commit**.

La migración registrada en las bases pero ausente de `release` era:

- QA: `20261016191528 plataforma_password_inicial_bloqueo_almacen_alta`
- PROD: `20261016192941 plataforma_password_inicial_bloqueo_almacen_alta_prod`

La comprobación fue solo de lectura. En QA y PROD se encontraron los cuatro
helpers con el guard `not private.plataforma_debe_cambiar_password()`:

- `private.pm07_puede_gestionar_stock()`
- `private.pm07_puede_vender()`
- `private.pm08_puede_operar_caja()`
- `private.pm08_puede_corregir_caja()`

Las huellas de las funciones protegidas coinciden por entorno dentro de sus
diferencias de formato. No se leyeron filas de clientes ni credenciales y no se
ejecutó ninguna escritura en QA o PROD.

La fuente reconstruida está en:

`supabase/migrations/20261020120000_plataforma_password_inicial_bloqueo_almacen_alta_reconstruida.sql`

Incluye preflight por huella, reemplazo de los cuatro helpers y postflight que
exige los cuatro guards. La aplicación en QA queda pendiente de autorización
escrita específica; la de PROD queda expresamente fuera de este paso.

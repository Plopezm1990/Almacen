# C07-D production migrations

Esta carpeta contiene material de preparación y preflight para la promoción de C07-D.

No forma parte de `supabase/migrations/` y no se aplica automáticamente. El preflight
`000_c07d_production_preflight.sql` es de solo lectura: no crea objetos, no modifica datos y
no activa fiscalidad.

El orden obligatorio antes de cualquier promoción es:

1. Ejecutar el preflight sobre la base destino.
2. Revisar el resultado con la matriz de promoción.
3. Aplicar únicamente la variante SQL productiva aprobada.
4. Volver a ejecutar RLS, contratos de secretos, idempotencia y bloqueo de emisión.
5. Mantener el transporte AEAT desactivado hasta que exista una empresa piloto real y un
   adaptador fiscal autorizado.

No se deben copiar aquí fixtures, configuraciones ni registros de QA.

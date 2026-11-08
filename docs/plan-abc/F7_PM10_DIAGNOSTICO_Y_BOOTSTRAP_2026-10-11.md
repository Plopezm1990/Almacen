# F7 · PM10: diagnóstico y bootstrap fiscal

Estado: **PREPARADO · NO PUBLICADO · NO APLICADO EN PRODUCCIÓN**  
Fecha: 2026-10-11

## Decisión de interfaz

PM10 es un diagnóstico técnico de datos legados y validaciones de altas. Es de
solo lectura y no pertenece a la operación diaria de empresas y locales.

La tarjeta **Diagnóstico de datos históricos** se mueve a **Errores del sistema →
Diagnósticos técnicos**. El código PM10 se conserva solo como identificador
interno en la documentación y en las migraciones. El usuario propietario conserva el acceso a la revisión,
pero la pantalla operativa deja de mezclar configuración con mantenimiento
técnico.

## Hallazgo productivo

La migración `20260928222000_pm10_bootstrap_tpv_catalogo.sql` filtraba por los
nombres exactos `Chocolateria San Gines` y `Chocoloyos S.L`. En producción los
registros existentes tienen otra capitalización y el local activo no recibió
contexto fiscal ni catálogo TPV. Los locales históricos inactivos se mantienen
sin reactivar.

## Corrección preparada

`20261011170000_pm10_bootstrap_scope_fix.sql`:

- selecciona empresas y locales por relación y estado `activo`;
- crea el contexto fiscal simulado solo si falta para una empresa activa;
- enlaza cada local activo con una entidad fiscal estable;
- crea EUR y la moneda del local de forma idempotente;
- proyecta productos del `almacen_kv` únicamente al local activo que les
  corresponde;
- no sobrescribe filas de catálogo existentes;
- no edita, reactiva ni borra locales o históricos.

## Evidencia y límites

La rama solo contiene código, contrato y documentación. Las comprobaciones
locales validan que el cambio no dependa de nombres concretos y que la UI ya no
muestre PM10 en Empresas y locales.

No se ha hecho `push`, despliegue, migración remota ni escritura SQL en
producción. Antes de aplicarlo hay que revisar la migración en una Preview y
ejecutar un `db push --dry-run`; la aplicación posterior requiere una
autorización separada.

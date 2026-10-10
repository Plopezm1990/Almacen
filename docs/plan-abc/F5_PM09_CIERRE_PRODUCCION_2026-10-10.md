# F5 / PM09 · Evidencia de ejecución y cierre técnico

Fecha: 2026-10-10

Estado: `VERIFICADO_EN_PRODUCCION_SIN_PUBLICACION_DE_APLICACION`

## Alcance

Esta nota registra la ejecución controlada del paquete PM09 en el proyecto
productivo `flqercbgpgmmfaakrwkc`. No autoriza ni realiza la fusión de PR ni
una publicación de la aplicación.

## Copia previa

Pedro creó la copia manual fuera del repositorio en
`C:\Users\pedro\Desktop\backup-p3c-20261010` y una copia adicional. Los tres
archivos canónicos no están vacíos:

| Archivo | Bytes | SHA-256 |
|---|---:|---|
| `roles.sql` | 370 | `168A95A9C745AF5ED4679751F90419AC9DC434240A213B03E32A06D5664C2308` |
| `schema.sql` | 1.272.762 | `C52C1B4CB079B32723DFCFB0C9DA0B83320D06D53A351F4CF34239155449AA45` |
| `data.sql` | 315.860 | `ADFE20F6C5B3DBB41211944D5D6F2357C91A6CFF5752D578CE41CDC80E2C0633` |

## Preflight y aplicación

El preflight de solo lectura devolvió `ok=true`, sin diferencias de funciones
ni de tablas y sin ventas o reversos PM09 residuales. La diferencia de hash de
`arqueos_caja` quedó explicada por las migraciones C03 ya presentes en
producción; se comprobó contra el hash C03 conocido antes de continuar.

Se aplicaron en el SQL Editor de Supabase, bajo la sesión administrativa de
la ventana, los dos cambios PM09 aprobados:

1. `20261006040009_abc_f5_pm09_reconcile_prod_baseline`.
2. `20261001230000_abc_f5_pm09_security_hardening`.

La aplicación fue transaccional por bloque. Al no disponer de la conexión CLI
con credenciales en esta sesión, la historia de migraciones se registró de
forma explícita en el SQL Editor y se verificó después; no se ejecutó
`supabase db push` ni se aplicaron migraciones históricas en bloque.

## Postflight de seguridad

- Las funciones PM09 objetivo existen.
- El helper privado no es ejecutable por roles cliente.
- Los wrappers públicos quedan ejecutables únicamente por `authenticated`.
- `anon`, `public` y `service_role` no tienen `EXECUTE` en los wrappers
  endurecidos.
- Resultado: `wrappers_ok=true`, `guard_ok=true`, `sale_operations=0`,
  `sale_movements=0`, `migrations=2`.

## Humo autenticado con rollback

En una transacción con contexto `authenticated` y un usuario Propietario se
ejecutó una venta individual y su reverso. Durante la transacción hubo 2
operaciones y 2 movimientos. Se terminó con `ROLLBACK` y la lectura posterior
confirmó 0 operaciones y 0 movimientos residuales. El stock volvió a 4
unidades de almacén y 1 de piso.

## Observación de la aplicación

La aplicación productiva cargó correctamente. En el TPV del local, el pedido
de control mostró total de 10 €, confirmado 10 €, pendiente 0 € y estado
`PAGADO`. El resumen de almacén mostró 0 productos bajo mínimo, 0 reposiciones
pendientes y 0 descuadres. El registro de errores solo mostró entradas
históricas anteriores; no apareció una entrada nueva durante esta comprobación.

## Cierre y límites

PM09 queda verificado técnicamente en producción sin datos de humo persistidos.
La fusión de los PR y la publicación de la aplicación siguen siendo una
decisión separada. La evidencia no implica que deba fusionarse ningún PR ni
que deba ejecutarse otra migración.

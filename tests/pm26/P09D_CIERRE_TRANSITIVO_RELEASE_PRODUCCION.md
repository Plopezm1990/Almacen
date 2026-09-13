# PM26 P09d — Cierre transitivo de compatibilidad `release` / producción

**Estado: DIAGNOSTICO AMPLIADO, SIN MIGRACION.**

P09b identificó once relaciones faltantes y trece RPC incompatibles. P09d
revisó en solo lectura las definiciones candidatas de QA y el catálogo real de
producción. No copia objetos de QA, no aplica SQL y no cambia el cliente.

## Hallazgo principal

Las once relaciones de P09b no son un paquete aislado. El cierre directo añade
la relación `arqueos_caja_anulaciones` y nueve helpers privados ausentes:

- Finanzas: `pm06_puede_gestionar_finanzas`, `pm06_total_factura`.
- Venta: `pm07_puede_vender`.
- Caja y arqueos: `pm08_local_operable`, `pm08_puede_corregir_caja`,
  `pm08_puede_operar_caja`, `pm08_validar_dinero`,
  `pm08_validar_json_objeto`, `pm09_resumen_caja_ventas`.

Por tanto, crear solamente las once relaciones dejaría las RPC fallando por
dependencias inexistentes. No es una corrección admisible.

## Deriva que impide copiar QA

Ocho helpers ya existen en ambos entornos, pero sus definiciones no coinciden:
`la_rol`, `la_usuario_activo`, `la_tiene_local`, `la_tiene_empresa`,
`pm07_puede_gestionar_stock`, `pm07_validar_cantidad`,
`pm08_bloquear_operation_id` y `pm08_validar_operation_id`.

Además, QA incorpora soporte que producción no tiene o no tiene con el mismo
esquema: `empleados`, `almacen_kv` y `stock_ubicacion`. Estas diferencias
afectan autorización, locales operables, cantidades y bloqueo de operaciones.
Un reemplazo ciego podría abrir accesos entre empresa/local o romper la
idempotencia.

## Riesgo y orden correcto

Los trece RPC candidatos son `SECURITY DEFINER` y ejecutables por usuarios
autenticados en QA. Antes de cualquier promoción hay que conservar controles
de identidad y rol; una función de este tipo no se habilita para resolver un
fallo de permisos.

El siguiente paso seguro es un diseño por dominios, todavía sin aplicar:

1. Catálogos, clientes, proveedores, albaranes, facturas, gastos y pagos.
2. Caja, arqueos, anulaciones y reversos.
3. Venta, stock, traspasos y devoluciones.
4. Auditoría y los contratos de llamada del cliente.

Para cada dominio deberá existir un preflight de producción, matriz de RLS y
grants, prueba de idempotencia/concurrencia, rollback que no destruya datos y
una prueba aislada antes de solicitar autorización para producción.

## Límites respetados

- Sin escrituras en Supabase, QA, producción o TPV.
- Sin despliegue de Edge Functions ni Netlify.
- Sin cambios en `main`, `release` ni en la PR #38.
- Sin modificación de `fuente.js`, `source-recovery/` ni `supabase/`.

`PM26_P09D_ESTADO=DIAGNOSTICO_AMPLIADO_SIN_MIGRACION`

`PM26_P09D_MIGRACION_PRODUCTIVA_LISTA=NO`

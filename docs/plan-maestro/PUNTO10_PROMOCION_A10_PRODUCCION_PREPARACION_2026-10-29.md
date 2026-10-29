# Punto 10 · preparación de promoción A10 a producción

Fecha: 29/10/2026  
Entorno de destino: Supabase producción `flqercbgpgmmfaakrwkc`  
Entorno validado: Supabase QA `qjqorixtkilwsndqayyx`

## Estado

**PREPARADO PARA REVISIÓN — NO APLICADO EN PRODUCCIÓN.**

El punto 9 demostró en QA que un artículo con
`requiere_preparacion=false` puede cobrarse, generar ticket y QR de QA sin
crear una comanda de cocina. El punto 10 prepara el paquete técnico para
llevar esa capacidad a producción, pero no cambia todavía la base productiva.

## Alcance técnico

La promoción debe incluir, como una unidad controlada:

1. columna `public.catalogo_tpv_productos.requiere_preparacion boolean not null
   default true`;
2. índice de consulta por empresa, local, preparación y actividad;
3. helper servidor `private.abc_a10_requiere_preparacion`;
4. actualización de `public.abc_catalogo_guardar_productos` para guardar y
   devolver el valor en alta, edición y snapshot;
5. actualización del trigger A10 para crear comandas únicamente para líneas
   cuyo catálogo indique preparación;
6. sincronización del valor desde la pantalla de Productos hasta el catálogo
   autoritativo.

La migración de referencia en esta rama es
`supabase/migrations/20261029190000_abc_f3_a10_preparation_mode.sql`, commit
`64f79bc`. No se debe aplicar a producción a ciegas con `db push`: antes hay
que comprobar la línea de migraciones y generar el archivo productivo final
con el nombre/versionado aceptado para la base de destino.

## Compatibilidad y seguridad

- El valor por defecto `true` conserva el comportamiento actual de productos
  existentes.
- Los payloads antiguos sin el campo siguen entrando por la ruta de
  preparación.
- La decisión se toma en servidor; no se confía en el navegador para evitar
  comandas.
- La modificación no activa AEAT, no cambia certificados y no habilita
  emisión fiscal real.
- No se debe cambiar la comanda histórica directamente ni borrarla.

## Producto afectado en producción

La consulta de solo lectura identificó:

- Producto: `CROIS. CURVO GOURMET 100 46 UD`.
- Código comercial: `101421`.
- Identificador: `pm10-recepcion-albaran:factura-albaran:mv5tixkxej43iu:0:8550916306:producto-auto:0`.
- Empresa/local: `empresa-034b3c08b4f4ae9b` /
  `local-6d0e54564e774506`.
- Comanda histórica: `20d1f90f-d461-4b99-b88d-d18d884bf38f`.
- Estado: `BLOQUEADA`, ruta `SIN_RUTA`.

La decisión pendiente es si ese producto se debe marcar como venta directa
(`false`) y cómo regularizar la comanda histórica mediante una operación
autorizada e idempotente. Esta decisión no se toma automáticamente.

## Preflight obligatorio

Ejecutar únicamente el SQL de solo lectura de
`PUNTO10_PROMOCION_A10_PRODUCCION_PREFLIGHT_2026-10-29.sql` y conservar su
salida. El resultado debe confirmar:

- migración y objetos base compatibles;
- ausencia o definición conocida de la columna nueva;
- trigger A10 y helper existentes;
- un único producto afectado y una única comanda histórica;
- cero efectos nuevos en `ERROR`;
- transporte fiscal real desactivado.

### Resultado del preflight de producción — 29/10/2026

La comprobación se ejecutó contra producción en modo exclusivamente lector:

| Control | Resultado |
|---|---:|
| Columna `requiere_preparacion` presente | `false` |
| Helper A10 nuevo presente | `false` |
| Trigger A10 nuevo presente | `false` |
| Filas del producto afectado | `1` |
| Comanda histórica `BLOQUEADA/SIN_RUTA` | `1` |
| Efectos actuales en `ERROR` | `0` |

El resultado es coherente con el diagnóstico: producción todavía no tiene la
corrección de A10 y mantiene exactamente una comanda histórica que requiere
decisión. El punto 10 queda **PREPARADO, CON NO-GO PARA APLICACIÓN AUTOMÁTICA**.
No se ejecutaron migraciones ni se modificaron filas productivas.

## Criterios de NO-GO

Se detiene el punto 10 si ocurre cualquiera de estos casos:

- la columna ya existe con tipo, default o nulabilidad diferentes;
- la RPC de catálogo tiene una firma incompatible;
- el trigger A10 no corresponde al contrato actual;
- hay más de una comanda histórica que requiere decisión;
- la migración productiva no puede ser idempotente;
- aparece un error nuevo o una comanda nueva bloqueada durante el smoke;
- se intenta modificar producción sin aprobación explícita;
- se mezclan los proyectos QA y producción.

## Orden siguiente

1. Revisar el preflight de producción.
2. Crear la migración productiva final a partir del código validado en QA.
3. Ejecutar contratos en una base desechable y revisión de seguridad.
4. Preparar snapshot y rollback.
5. Solicitar autorización separada para aplicar la migración en producción.
6. Solo después de esa autorización, corregir el producto afectado y
   regularizar la comanda histórica con trazabilidad.

Hasta entonces, producción permanece sin cambios.

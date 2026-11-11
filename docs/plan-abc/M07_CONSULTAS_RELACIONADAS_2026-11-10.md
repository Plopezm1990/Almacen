# M-07 — Consultas relacionadas sin pérdida de líneas

Fecha de revisión: 2026-11-10  
Rama integrada: `codex/fase4-remediacion-restante`  
Preview QA: PR #220, commit `e179b807`, deploy `6af3746d4210a5c82f09d07b`

## Estado

La corrección está versionada y el contrato estático pasa. El preview QA está listo, pero M-07 no queda cerrado completamente: aún falta observar una consulta real con más de 200 identificadores y la rama no se ha promovido a producción.

## Evidencia probada por código

El contrato `tests/m07/m07-related-query-pagination-contract.mjs` pasa y comprueba que las consultas relacionadas que recibían listas de identificadores usan paginación por lotes, conservan el orden y no mantienen el tope único de 200 que podía descartar líneas.

Resultado reproducido:

```text
M-07: contrato de paginación de consultas relacionadas OK
```

La corrección está integrada en `fuente.js` y `source-recovery/fuente-recuperado.js`, con los contadores del manifiesto y de la puerta CI ajustados.

## Evidencia del despliegue y límites

- Netlify midió el preview como `ready` en el deploy `6af3746d4210a5c82f09d07b` para el commit `e179b807`.
- La validación del deploy escaneó 1.479 archivos y no encontró coincidencias de secretos.
- No se creó ningún dato en QA para este punto.
- No se ejecutó ninguna operación de cobro, devolución, stock, cierre de caja o documento fiscal.
- No se observó todavía el flujo de usuario que fuerce más de un lote de 200 líneas.
- Producción no se modificó ni se certifica que contenga la corrección.

M-07 queda abierto para el cierre completo hasta reproducir la consulta paginada con una sesión QA autorizada y disponer de una promoción autorizada o de la evidencia efectiva correspondiente en producción.

## Revalidación de volumen QA — 2026-11-11

La lectura de solo lectura del proyecto QA no alcanza el umbral que fuerza una
segunda página en ninguna de las cinco relaciones corregidas:

| Relación | Filas | Identificadores distintos usados por la relación |
|---|---:|---:|
| `pagos` | 67 | 58 `checkout_id` |
| `caja_operaciones` | 65 | 61 `origen_id` |
| `pedido_lineas` | 116 | 108 `pedido_id` |
| `abc_descuentos_aplicados` | 6 | 4 `source_line_id` |
| `venta_fiscal_lineas` | 67 | 62 `venta_fiscal_id` |

Esto es **medido** sobre QA y explica por qué no se presenta como reproducción
funcional de una consulta con más de 200 filas: no se crearon filas
comerciales sintéticas para fabricar ese escenario. El contrato estático sigue
siendo **reproducido** y el preview sigue siendo evidencia de despliegue, pero
M-07 continúa abierto por la falta de una reproducción real de segunda página
y por la ausencia de la corrección en producción.

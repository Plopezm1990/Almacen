# B-01 — Tolerancia de 0,12 € en la importación de facturas

Fecha de revalidación: 2026-11-10  
Entornos: QA (`qjqorixtkilwsndqayyx`) y producción (`flqercbgpgmmfaakrwkc`)

## Corrección del diagnóstico anterior

La fotografía del 2026-11-08 decía que la tolerancia de `0.12` solo existía en el cliente. Esa afirmación queda corregida con la medición actual: la Edge Function `importar-factura` aplica la misma tolerancia server-side.

## Evidencia

### Probado por código

- El paquete cliente define `validarFacturaAgrupada(..., tolerancia = 0.12)` y aplica la tolerancia al total impreso de la factura y a la suma de albaranes.
- `supabase/functions/importar-factura/index.ts` valida server-side las mismas dos comparaciones con `0.12`.
- El contrato `tests/b01/b01-tolerance-server-contract.mjs` comprueba ambas fronteras y pasa:

```text
B01_TOLERANCE_CLIENT_SERVER_CONTRACT=PASS
```

### Medido en los despliegues

La función Edge `importar-factura` está activa en ambos proyectos y fue consultada en solo lectura:

| Entorno | Versión | `ezbr_sha256` desplegado |
|---|---:|---|
| QA | 4 | `5a5f576f5dd199d72747a7705af6383462a123c5473f42e78dbdd2509920ede8` |
| Producción | 2 | `5a5f576f5dd199d72747a7705af6383462a123c5473f42e78dbdd2509920ede8` |

La igualdad de la huella del bundle es evidencia de que la función desplegada es la misma en los dos entornos para este punto. No se ejecutó la función con una factura real ni se transmitió ningún documento.

## Alcance y límite

B-01 queda **cerrado técnicamente dentro del alcance auditado**: la tolerancia que existía en el cliente tiene equivalente server-side y la función desplegada coincide entre QA y producción.

Este cierre no certifica que `0,12 €` sea una regla fiscal general ni que deba aplicarse a otros flujos monetarios. El valor y su ámbito siguen siendo una decisión funcional/documental; lo demostrado es la paridad cliente-servidor del flujo de importación de facturas y albaranes.

No se creó ningún dato sintético y no se escribió en producción.

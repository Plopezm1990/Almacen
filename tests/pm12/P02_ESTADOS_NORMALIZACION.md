# PM12 · P02 — Contrato de estados y normalización

Fecha: 2026-09-07  
Rama: `pm12-conteo-estados-honestos`  
Entorno: contrato puro, sin escrituras en Supabase QA ni producción.

## Implementado

Se añade `pm12-conteo-estados-v1.js` como contrato aislado y verificable antes de integrarlo en el documento de conteo.

### Estados canónicos

- `BORRADOR`
- `EN_CURSO`
- `PARCIAL`
- `COMPLETADO`
- `CANCELADO`

### Semántica de cantidades

- vacío, espacios, `null` o ausente: no contado;
- `0`, `"0"`, `"0.00"` y `"0,00"`: contado válido en cero;
- negativo: inválido;
- no finito/no numérico: inválido;
- unidad indivisible con decimal: inválida;
- precisión superior a la autorizada: inválida.

### Cobertura

El resumen conserva total, contados, pendientes, inválidos, porcentaje y detalle por producto. Una cobertura del 100 % no se convierte por sí sola en documento completado: requiere cierre formal.

### Cierre

- sin productos: rechazado;
- ninguna línea contada: rechazado;
- cualquier línea inválida: rechazado;
- responsable vacío: rechazado;
- cobertura incompleta: requiere confirmación y motivo;
- cobertura parcial aceptada: `PARCIAL`;
- cobertura total aceptada: `COMPLETADO`.

### Compatibilidad

Los documentos legados con `completado: true` o `cancelado: true` pueden leerse sin inventar una migración silenciosa. P03 añadirá identidad y corte congelado al documento nuevo.

**PM12_P02_ESTADOS_NORMALIZACION=PASS**  
**PM12_P02_SUPABASE_WRITES=0**  
**PM12_P02_PRODUCTION_WRITES=0**

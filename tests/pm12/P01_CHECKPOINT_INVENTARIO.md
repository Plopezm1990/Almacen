# PM12 · Conteo útil y estados honestos · P01 — Checkpoint e inventario

Fecha: 2026-09-07  
Rama: `pm12-conteo-estados-honestos`  
Checkpoint de partida: PM11 Compra cerrado `e6000f221ea6d2984f5b3fd738a93ec9a465c5c9`  
Base funcional heredada: G1 `1e21458b48a11302c59911ef966ded0aca3eb639`  
Supabase QA: `qjqorixtkilwsndqayyx` — `ACTIVE_HEALTHY`  
`main` congelado: `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`  
Producción: **NO TOCAR**

## 1. Objetivo

Cerrar LA-020 sin reimplementar PM07 ni alterar los paquetes PM01–PM11:

> Vacío no equivale a completado; cero contado es un dato; responsable y cobertura deben quedar trazables.

PM12 debe convertir el conteo actual en un documento con estados honestos, corte temporal identificable y ajustes trazables sobre el stock autoritativo.

## 2. Diagnóstico del comportamiento actual

La lógica vigente está en `crearLogicaConteos` e interfaz `InventarioCiego`.

### Garantías existentes que se conservan

- Conteo ciego: durante la captura no se muestra la existencia teórica.
- Ámbitos: `total`, `almacen` y `piso_venta`.
- El conteo se limita al local activo.
- Cada ítem inicia con `conteo: ""`.
- El valor `0` puede llegar al cálculo como número y no debe confundirse con vacío.
- Se registran `contadoPor` y `revisor`, aunque hoy no gobiernan el cierre.
- Existen aplicación de ajustes, protección contra una segunda aplicación y reverso de una aplicación duplicada.
- Los movimientos conservan `documentoOrigenId`, `operationId`, motivo y tipo.
- PM07 mantiene stock por ubicación, sin negativos y con operaciones autoritativas.
- G1/PM11 conservan aislamiento, replay e idempotencia.

### Defectos confirmados en P01

1. `finalizarConteo(conteoId)` solo comprueba el local y escribe `completado: true`.
2. Un conteo con todos los campos vacíos puede presentarse como completado.
3. Un conteo parcialmente capturado no queda diferenciado de uno completo.
4. No existe estado canónico explícito; se depende del booleano `completado`.
5. No se registra cobertura: total de líneas, líneas contadas, líneas pendientes y porcentaje.
6. `contadoPor` puede estar vacío al finalizar.
7. El cierre no congela de forma explícita fecha/hora, actor, ámbito y conjunto cubierto.
8. El historial no distingue borrador, en curso, parcial, completado o cancelado.
9. La eliminación física del conteo puede borrar su identidad documental; PM12 debe separar cancelación trazable de limpieza de un borrador nunca cerrado.
10. Parte del conteo persiste en almacenamiento genérico; no debe afirmarse atomicidad backend inexistente.

## 3. Contrato de estados propuesto

| Estado | Significado | Puede ajustar stock |
|---|---|---:|
| `BORRADOR` | Creado, sin ninguna línea capturada | No |
| `EN_CURSO` | Al menos una línea capturada y quedan pendientes | No |
| `PARCIAL` | Cierre deliberado con cobertura incompleta, responsable y motivo | Solo líneas contadas, con confirmación explícita |
| `COMPLETADO` | Todas las líneas cubiertas, responsable y corte congelados | Sí |
| `CANCELADO` | Documento cerrado sin aplicar ajustes o anulado de forma trazable | No |

Reglas:

- `""`, `null` o campo ausente = no contado.
- `0` numérico o texto normalizable a cero = contado en cero.
- Valores negativos, no finitos o incompatibles con la precisión del producto = inválidos.
- El cierre vacío se rechaza siempre.
- El cierre completo exige responsable.
- El cierre parcial exige responsable, motivo y confirmación explícita.
- Después del cierre, cantidades, cobertura, responsable, ámbito y corte quedan congelados.
- Aplicar ajustes requiere estado `PARCIAL` o `COMPLETADO`, nunca `BORRADOR`/`EN_CURSO`/`CANCELADO`.
- La misma aplicación y payload se reproduce sin duplicar; payload distinto con el mismo ID es conflicto.
- `Todos los locales` nunca es destino de mutación.

## 4. Alcance de prueba LA-020

Casos mínimos obligatorios:

1. Cero productos en el ámbito: no crear un falso conteo completado.
2. Conteo con productos pero ninguna captura: cierre rechazado.
3. Una línea con `0`: línea contada válida.
4. Una línea vacía: línea pendiente.
5. Cobertura parcial: estado `EN_CURSO`; cierre parcial solo con responsable, motivo y confirmación.
6. Cobertura total: cierre `COMPLETADO`.
7. Responsable vacío: cierre rechazado.
8. Recarga: estado, cobertura, responsable, corte y cantidades se conservan.
9. A1/A2/B1/local inactivo/`Todos`: aislamiento y bloqueo correctos.
10. Doble pulsación, replay, payload conflictivo y concurrencia: sin doble ajuste.
11. Ajuste y reverso: stock, ubicación, movimientos, auditoría e historial concilian.
12. Datos legados: booleano `completado` se lee de forma compatible, sin inventar cobertura.

## 5. Secuencia PM12

- **P01 — Checkpoint e inventario:** estado vivo, garantías, defectos y alcance.
- **P02 — Contrato de estados y normalización:** vacío, cero, inválido y cobertura.
- **P03 — Documento de conteo y corte:** identidad, estado, responsables, ámbito y timestamps.
- **P04 — Cierre vacío/parcial/completo:** validaciones y UX.
- **P05 — Ajustes trazables:** aplicar solo cobertura válida y conciliar con PM07.
- **P06 — Cancelación, recarga y legados:** sin borrado silencioso de documentos cerrados.
- **P07 — Aislamiento y permisos:** A1/A2/B1/inactivo/`Todos`.
- **P08 — Replay, concurrencia y fallos:** idempotencia y ausencia de parciales.
- **P09 — Historial, informes y móvil:** estados visibles y consistentes.
- **P10 — Regresión integral, Deploy Preview, smoke y cierre.**

## 6. Límites

P01 es diagnóstico y contrato. No modifica `fuente.js`, no aplica migraciones, no escribe datos QA y no toca producción.

**PM12_P01_CHECKPOINT_INVENTARIO=PASS**

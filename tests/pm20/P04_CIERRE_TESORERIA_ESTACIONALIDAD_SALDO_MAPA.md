# PM20 P04 — Tesorería, Estacionalidad y Saldo/Mapa: métricas definidas y comprobadas

Cuarto punto de PM20. Ninguno de estos módulos de pantalla tenía ficha propia (P01).

## Defecto real encontrado y corregido: `MapaAlmacen` recalculaba "stock bajo" por su cuenta

`MapaAlmacen` traía su propia fórmula local para marcar productos como "stock bajo"
(`stock <= stockMinimo`), distinta de la fórmula única que ya usan Dashboard y Saldo
(`stock < stockMinimo`, excluyendo productos elaborados, respetando el indicador
autoritativo del servidor `_pm07Servidor`/`_pm07BajoMinimo` cuando existe). Efecto
observable: un producto con stock exactamente igual a su mínimo aparecía "bajo" en el
Mapa de almacén pero no en el Dashboard ni en Saldo para el mismo local — dos pantallas
del mismo negocio, mismo momento, contradiciéndose. Un producto elaborado también podía
aparecer marcado como bajo en el Mapa aunque el resto de la aplicación lo excluye de esa
clasificación a propósito (su reposición sigue una lógica de producción, no de pedido).

Corrección (siguiendo el mismo principio ya aplicado en PM19 P05: no crear una segunda
lógica paralela, reutilizar la única existente): `MapaAlmacen` ya no calcula nada — recibe
`stockBajoDelLocalActivo` (el mismo conjunto que ya reciben Dashboard y Saldo para el
local activo) y solo indexa por id (`idsStockBajo`). Por construcción, ya no puede volver
a divergir.

## Verificación real de las demás métricas (sin defecto, formalizada con prueba)

- **`Tesoreria`/`Estacionalidad` son de solo lectura**: sus firmas (`{ proyeccionTesoreria,
  promedioDiarioVentas }` / `{ ingresosPorMes }`) ni siquiera reciben `movimientos`,
  `pendientesPago` ni `encargos` — no pueden recalcular nada por su cuenta, solo
  formatean lo que ya se calculó una vez.
- **`proyeccionTesoreria`** (día a día, 30 días): `pagosDia` suma solo el importe
  *pendiente* de las facturas con vencimiento ese día (no el total ya cobrado);
  `encargosDia` descuenta la señal ya cobrada del encargo (`total - señal`), evitando
  contar dos veces el mismo ingreso; `ingresosDia = promedioDiarioVentas + encargosDia`;
  `netoDia = ingresosDia - pagosDia`. Verificado por inspección exacta de la fórmula.
- **Distinción intencional IVA**: `promedioDiarioVentas` (Tesorería, caja real) incluye
  el IVA aplicado a la venta; `ingresosPorMes` (Estacionalidad, rendimiento del negocio)
  usa el importe neto sin IVA. No es una inconsistencia — son medidas distintas con
  propósitos distintos (caja disponible vs. ingreso propio del negocio) — y queda fijado
  con prueba explícita para que nadie las "unifique" por error en el futuro pensando que
  divergían por accidente.

## Archivos

- `fuente.js`: `MapaAlmacen` recibe `stockBajo` en vez de recalcularlo; composición
  actualizada para pasar `stockBajoDelLocalActivo`.
- `tests/pm20/p04-tesoreria-estacionalidad-saldo-mapa-contract.mjs` (nuevo): confirma
  las fórmulas de `proyeccionTesoreria`/`ingresosPorMes`/`promedioDiarioVentas`, la
  ausencia de recálculo en las pantallas de solo lectura, y reproduce con un fixture
  límite (stock == mínimo, elaborado, indicador de servidor) que la fórmula antigua de
  `MapaAlmacen` divergía y que la corregida coincide siempre por construcción.

## Regresión

Suite completa del proyecto — 109/109 sin regresiones.

## Estado de main/producción

`main` = `bdf25591a1e986a04223b399d11d8fe81d41d82d`, sin tocar directamente. Frontend
puro, sin migraciones Supabase.

**PM20_P04_CIERRE_TESORERIA_ESTACIONALIDAD_SALDO_MAPA=PASS**

# PM19 P03 — Local cerrado bloquea traspasarStock

> **Corrección (P05):** la implementación original de este punto introdujo
> `localActivoEstaActivoPM19`, una función propia para esta comprobación. Al generalizar
> el mismo criterio a Productos/Producción/Fichas de coste/APPCC/Aceite en P05 se
> descubrió que ya existía `validarContextoEscrituraPM10` — función establecida y
> reutilizada en 7 puntos del proyecto, con más cobertura (local inexistente y
> empresa/local incompatibles, además de inactivo/"Todos"). `traspasarStock` se corrigió
> en P05 para usar esa única función, y `localActivoEstaActivoPM19` se retiró por
> completo. El resto de este documento describe el diagnóstico original, que sigue siendo
> válido; solo cambió la implementación técnica de la guarda — ver
> `tests/pm19/P05_CIERRE_CONTEXTO_ESCRITURA_UNICO.md`.

Tercer punto de PM19 (NR-07: "Crear operaciones antes de cerrar local; histórico
permanece, operaciones ordinarias bloqueadas y Todos no mezcla empresas").

## Diagnóstico

`crearLogicaTraspasos` tiene dos operaciones: `traspasarEntreLocales` (entre dos locales
distintos) ya comprobaba explícitamente que origen y destino estuvieran activos
(`l22.activo !== false && !l22.fusionadoEn`) antes de operar. `traspasarStock` (el
traspaso simple piso de venta ↔ almacén dentro del mismo local activo) **nunca comprobaba
el estado del local activo** — solo verificaba que el producto perteneciera a ese local,
no que el local siguiera admitiendo operativa ordinaria.

## Solución

- **`localActivoEstaActivoPM19(locales, localActivoId)`** (función pura): un local cuenta
  como activo solo si existe, `activo !== false` y no está fusionado en otro
  (`!fusionadoEn`) — mismo criterio que ya usaba `traspasarEntreLocales`.
- `traspasarStock` la comprueba como primer paso, antes de cualquier otra validación o
  efecto de stock.
- `traspasarEntreLocales` no se ha tocado — ya cumplía este criterio.

## Archivos

- `fuente.js`: `localActivoEstaActivoPM19` (nueva, antes de `crearLogicaTraspasos`);
  `traspasarStock` actualizada.
- `tests/pm19/p03-traspaso-local-cerrado-contract.mjs`: función pura,
  positivo/negativo/replay (incluye local desactivado, local fusionado, local inexistente
  y ausencia de local activo).
- `tests/pm19/p03-wiring-traspasos-contract.mjs`: por inspección estática, confirma que
  `traspasarStock` usa la comprobación real y que `traspasarEntreLocales` no ha
  regresionado.

## Regresión

Suite completa del proyecto — 101/101 sin regresiones (ver detalle en el commit de PM19).

## Estado de main/producción

`main` = `cc7cab7cc3781012ab3e7729dfa2af7476e19eae`, sin tocar directamente. Frontend
puro, sin migraciones Supabase.

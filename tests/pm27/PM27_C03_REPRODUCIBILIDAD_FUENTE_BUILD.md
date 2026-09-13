# PM27 C03 — Reproducibilidad de fuente/build

Fecha: 2026-09-13
Candidato auditado: `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`
Resultado: `PASS`

## Objetivo

Comprobar que la fuente canónica de `source-recovery/` se construye de forma reproducible bajo el gate vigente, que el resultado es JavaScript válido y conserva las anclas de negocio previstas, y que alteraciones controladas de ancla o sintaxis son detectadas sin dejar el árbol contaminado.

## Evidencia positiva sobre el SHA candidato

El workflow PM27 del candidato, run `34765942761`, hizo checkout exacto de `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`, instaló dependencias con `npm ci --prefix source-recovery` y ejecutó todos los contratos PM26 aplicables.

En esa ejecución:

- `tests/pm26/p03a-contract.mjs` terminó correctamente.
- `PM26_P03A_ARNES_DETECTOR=PASS` — 2 positivas + 4 negativas.
- `PM26_P03A_CLI_DETECTOR_OK_FUENTE_REAL=PASS`.
- `tests/pm26/p03b-contract.mjs` terminó correctamente.
- `PM26_P03B_GATE_POSITIVO=PASS` — build real y anclas verificadas.
- `PM26_P03B_ARBOL_RESTAURADO=PASS`.
- `PM26_P03B_DIST_RECONSTRUIDO_TRAS_NEGATIVAS=PASS`.

El gate permanente `source-recovery/verificar-build-canonico.mjs` ejecuta `npm run build`, comprueba `dist/fuente.js` con `node --check` y exige 11 anclas de negocio en el mismo orden. El build usa `esbuild` desde `entrada-recuperada.js` hacia `dist/fuente.js`.

## Controles negativos

El contrato P03b realiza dos sabotajes controlados sobre el árbol real y siempre restaura después:

1. Renombra/elimina la ancla `function ErroresSistema(`. El gate debe terminar con código distinto de cero y reportar `ancla_obligatoria_ausente`.
2. Añade un error de sintaxis a la fuente canónica. El gate debe terminar con código distinto de cero y reportar `VERIFICAR_BUILD_CANONICO=FALLO`.

Ambos controles fueron PASS en el run exacto del candidato. P03a, además, valida cuatro fallos del detector de límite: ancla ausente, duplicada, desplazada y orden alterado, todos con salida 1 real.

## Integridad/hash y alcance honesto

La evidencia P03b conserva igualdad SHA-256 del cuerpo de aplicación recuperado durante la recuperación canónica histórica (`sha256_cuerpo_bundle == sha256_cuerpo_recuperado`, valor `4f770d0494181b86a929907f2184e2c9db9b83ee9c02c3ff06a503f24792ec6f`).

No se exige ni se declara paridad byte a byte entre el build limpio actual y `fuente.js` committeado. El gate documenta expresamente que esa igualdad no es estable por transformaciones legítimas de esbuild (comentarios/renombrado de variables) y que imponerla produciría falsos fallos. La garantía vigente es: build correcto + sintaxis válida + anclas de negocio completas y ordenadas + controles negativos reales + restauración exacta del árbol.

## Conclusión

`PM27_C03_REPRODUCIBILIDAD_FUENTE_BUILD=PASS`

No se modificó código funcional, `main`, `release`, Netlify, Supabase ni datos reales para esta auditoría.
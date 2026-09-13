# PM27 — C02 Alcance y no arrastre

Fecha: 2026-09-13
Repositorio: `Plopezm1990/Almacen`
Base PM26: `f297be08708d0bbe566c21347123885cb3095a7c`
Candidato auditado: `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`

## Objetivo

Verificar que PM27 no arrastra cambios fuera de su alcance y que desde la base PM26 solo existen los cinco archivos previstos para el candidato.

## Prueba positiva

Comparación exacta `f297be08708d0bbe566c21347123885cb3095a7c...8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`:

- estado: `ahead`
- commits: 15
- behind: 0
- archivos cambiados: exactamente 5

Lista exacta:

1. `.github/workflows/pm27-candidato-contexto.yml`
2. `pm11-compra-mobile-loader.js`
3. `tests/pm27/defecto-l-context-hotfix.test.mjs`
4. `tests/pm27/p08c-post-p09f-compat.test.mjs`
5. `tests/pm27/release-hotfix-state.test.mjs`

No aparece ningún archivo bajo `supabase/`, ninguna migración nueva, ningún archivo de Netlify/despliegue adicional y ningún otro módulo funcional fuera del loader previsto.

El candidato seguía apuntando al SHA exacto `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad` inmediatamente antes de registrar esta evidencia.

## Prueba negativa

Se comparó deliberadamente la misma base PM26 contra la rama documental `claude/pm27-auditoria-25-casos`, cuyo HEAD previo era `003e123dc1ba52422e9e00ec0e34933d725ddf0c`.

Resultado esperado y obtenido:

- commits: 17
- archivos cambiados: 7
- aparecen dos archivos extra de auditoría:
  - `tests/pm27/PM27_P01_MATRIZ_25_CASOS.md`
  - `tests/pm27/PM27_C01_INTEGRIDAD_CANDIDATO.md`

Por tanto, el control de lista exacta detecta cualquier arrastre adicional y esa rama no podría confundirse con el candidato certificado.

## Límite de este caso

C02 certifica el alcance por archivos y la ausencia de arrastre estructural. No sustituye el escaneo de contenido sensible o secretos, que corresponde a C04.

## Resultado

`PM27_C02_ALCANCE_NO_ARRASTRE=PASS`

No se modificaron `main`, `release`, PR #38, Supabase producción ni Netlify.

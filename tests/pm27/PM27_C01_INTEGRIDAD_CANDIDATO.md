# PM27 — C01 Integridad del candidato

Fecha: 2026-09-13
Candidato auditado: `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`
Rama de evidencia: `claude/pm27-auditoria-25-casos`

## Resultado

`PASS`

## Prueba positiva

- La referencia remota `claude/pm27-reauditoria-candidato` apunta exactamente a `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`.
- El commit candidato tiene árbol `bfecf59180184fbebbfac4949cb46eadacc6590c`.
- La consulta de GitHub Actions filtrada por ese `head_sha` devuelve un único run de candidato: `34765942761`, workflow `PM27 candidato - contexto Defecto L`, evento `push`, estado `completed`, conclusión `success`.
- El propio run declara `head_sha=8256628d922fe0a8dbf18ca792f8b19e89f6d9ad` y `head_commit.tree_id=bfecf59180184fbebbfac4949cb46eadacc6590c`, por lo que commit y árbol del gate coinciden con el candidato auditado.
- El job `validar-contexto` (`103746795855`) terminó `success`; todos sus pasos ejecutados terminaron `success`, incluida la regresión PM27 y la regresión de contratos PM26 aplicables.
- La comparación del SHA candidato consigo mismo es `identical`, 0 commits y 0 archivos, confirmando ausencia de deriva en la referencia auditada durante C01.

## Prueba negativa

Se utilizó deliberadamente como SHA incorrecto el commit documental de la rama de auditoría `3db48cadacd46fa1499263e86a378803d1ce6c5f`.

- Ese SHA es distinto del candidato congelado.
- Está exactamente 1 commit por delante del candidato y solo añade `tests/pm27/PM27_P01_MATRIZ_25_CASOS.md`.
- La consulta de GitHub Actions filtrada por ese SHA devuelve `total_count=0`; no existe gate de candidato asociado.

Por tanto, una evidencia perteneciente a la rama documental no puede confundirse con la evidencia del candidato. El control detecta correctamente deriva de HEAD / gate de otro SHA.

## Observación

El commit candidato aparece como `unsigned` en la API de GitHub. C01 no exige firma criptográfica del commit; esta observación no invalida la correspondencia SHA/árbol/gate. Si se decide exigir firma de commits como política de release, deberá tratarse como requisito separado de gobernanza/supply chain.

## Marcadores

```text
PM27_C01_SHA_EXACTO=PASS
PM27_C01_ARBOL_EXACTO=PASS
PM27_C01_GATE_SHA_EXACTO=PASS
PM27_C01_GATE_SUCCESS=PASS
PM27_C01_CONTROL_NEGATIVO_DERIVA=PASS
PM27_C01_RESULTADO=PASS
```

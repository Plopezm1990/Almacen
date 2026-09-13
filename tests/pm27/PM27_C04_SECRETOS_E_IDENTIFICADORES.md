# PM27–C04 — Secretos e identificadores

Fecha de corte: 2026-09-13
Repositorio: `Plopezm1990/Almacen`
Candidato auditado: `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`
Resultado: `PASS`

## Objetivo

Reauditar que el candidato no introduce secretos reales ni nuevas apariciones no registradas de identificadores internos/QA, y demostrar mediante controles negativos que el escáner falla ante un secreto o identificador nuevo sin exponer su valor.

## Evidencia positiva

El contrato `tests/pm26/p02-contract.mjs` ejecutado en el gate remoto exacto del candidato invoca el escáner centralizado sobre TODO el árbol versionado y exige código de salida 0. En el run `34765942761`, job `103746795855`, quedaron en PASS, entre otros:

- `PM26_P02_PRUEBA_POSITIVA=PASS (código de salida 0 sobre el repositorio real completo)`
- `PM26_P02_SIN_IDENTIFICADORES_REALES_ESTRUCTURAL=PASS`
- `PM26_P02_DOC_VERIFICADO=PASS`
- `PM26_P02_LEDGERS_VERIFICADOS=PASS`

El escáner `tools/seguridad/verificar-secretos-e-identificadores.mjs` enumera el repositorio mediante `git ls-files`, lee el contenido versionado, detecta secretos por forma y clasifica candidatos a project ref/clave publicable según ubicación. La verificación compara en vivo archivo + categoría + cantidad + conjunto exacto de huellas contra los ledgers. Un secreto real bloquea siempre.

C04 NO afirma que no exista deuda histórica de identificadores ya registrada. Certifica que, sobre el candidato congelado, no existen secretos reales y no existe ninguna aparición nueva/reclasificación/cambio de cantidad fuera de los ledgers vigentes. Cualquier project ref QA nuevo copiado a un archivo no autorizado sería una aparición nueva y fallaría.

## Controles negativos ejecutados en el mismo SHA

El mismo contrato P02 ejecutó controles aislados en directorios temporales, sin tocar el repositorio:

1. Secreto sintético con forma de JWT: salida 2 y el valor no aparece en stdout/stderr.
2. Identificador sintético nuevo fuera del ledger: salida distinta de 0 con `aparicion_nueva_fuera_de_ledger`, sin imprimir el valor.
3. Segunda aparición del mismo identificador en el mismo archivo: detectada por `cantidad_distinta`.
4. Manipulación manual de cantidad del ledger: detectada.
5. Reclasificación manual de categoría del ledger: detectada.
6. Identificador envuelto en regex/comentario/assert: no se degrada a `termino_tecnico`.
7. Directorio limpio de control: salida 0.

Marcadores observados en el gate exacto:

- `PM26_P02_NEGATIVA_1_SECRETO_REAL=PASS (código 2, valor no impreso)`
- `PM26_P02_NEGATIVA_2_APARICION_NUEVA=PASS`
- `PM26_P02_NEGATIVA_3_REPETICION_MISMO_ARCHIVO=PASS`
- `PM26_P02_NEGATIVA_4A_CANTIDAD_MANIPULADA=PASS`
- `PM26_P02_NEGATIVA_4B_CATEGORIA_MANIPULADA=PASS`
- `PM26_P02_NEGATIVA_5_REGEX_NO_ES_TERMINO_TECNICO=PASS`
- `PM26_P02_PRUEBA_CONTROL=PASS`

## Privacidad de la evidencia

El escáner nunca imprime el valor detectado. Sus informes contienen únicamente archivo, categoría, cantidad y una huella SHA-256 truncada/no reversible. Los fixtures negativos usan valores sintéticos construidos para la prueba, no secretos ni identificadores reales.

## Integridad

La rama candidata continúa apuntando exactamente a `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`. Esta evidencia se añade únicamente a `claude/pm27-auditoria-25-casos`; no modifica candidato, `main`, `release`, PR #38, Netlify ni Supabase.

`PM27_C04_SECRETOS_E_IDENTIFICADORES=PASS`

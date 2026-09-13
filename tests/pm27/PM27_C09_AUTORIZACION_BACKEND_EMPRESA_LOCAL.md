# PM27 — C09 Autorización backend empresa/local

Fecha de corte: 2026-09-13
Candidato auditado: `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`
Gate remoto del candidato: run `34765942761`, job `103746795855`, conclusión `SUCCESS`.
Resultado: `PASS`.

## 1. Objetivo

Reauditar la autorización backend por empresa y local sin escribir en Supabase remoto ni reutilizar datos reales. El criterio C09 exige un caso positivo en contexto propio y negativos de empresa ajena, local no autorizado y ausencia de sesión.

## 2. Evidencia ejecutada

El contrato `tests/pm26/p09f-contract.mjs`, ejecutado por el gate remoto exacto del candidato, valida el ensayo reversible `tests/pm26/p09f-qa-aislado/ensayo-auditoria-transaccional.sql` y su informe `tests/pm26/P09F_QA_AUTORIZACION_AUDITORIA.md`.

El ensayo usa PostgreSQL local aislado, identidades/empresas/locales sintéticos y la misma forma de autorización empleada por `public.registrar_auditoria`: identidad mediante `auth.uid()`, autorización de empresa con helper privado y autorización del local dentro de esa empresa.

## 3. Casos comprobados

### Positivo — empresa y local propios

Con una identidad sintética autorizada para `QA-AUDITORIA-A / QA-AUDITORIA-A1`, la llamada a `public.registrar_auditoria` se acepta y dentro de la transacción aparece exactamente una fila correspondiente al actor/contexto esperado.

Resultado: `PASS`.

### Negativo — empresa ajena

La misma identidad intenta operar sobre `QA-AUDITORIA-B`. La función debe abortar con autorización denegada (`SQLSTATE 42501`) y no insertar fila.

Resultado: `BLOQUEADO` como se esperaba.

### Negativo — local ajeno dentro de la misma empresa

La identidad autorizada para A1 intenta operar sobre A2 sin permiso suficiente. La función debe abortar con `SQLSTATE 42501` y no insertar fila.

Resultado: `BLOQUEADO` como se esperaba.

### Negativo — sin sesión

Con el claim de usuario ausente, `auth.uid()` no aporta una identidad autorizable y la operación debe abortar con `SQLSTATE 42501` sin insertar fila.

Resultado: `BLOQUEADO` como se esperaba.

## 4. Atomicidad y residuos

Todo el ensayo se ejecuta entre `BEGIN` y `ROLLBACK`. El informe registra tabla de auditoría vacía antes y después y `PM26_P09F_A_RESIDUOS_QA=0`. No se escribieron datos en Supabase QA ni producción durante esta reauditoría.

El gate exacto del candidato volvió a ejecutar el contrato y publicó:

- `PM26_P09F_A_TRANSACCION_REVERSIBLE=PASS`
- `PM26_P09F_A_CASOS_AUTORIZACION=PASS`
- `PM26_P09F_A_ALCANCE_HONESTO=PASS`

## 5. Alcance honesto

C09 certifica el comportamiento de autorización empresa/local del backend ensayado sobre `registrar_auditoria` y sus guards, en PostgreSQL local aislado y reversible. No se presenta como una prueba de red PostgREST/JWT real ni como cobertura de todas las RPC del producto.

La cobertura transversal restante se audita por separado en C10 (RLS multiempresa), C11 (multilocal), C12 (roles/permisos) y C13 (`SECURITY DEFINER` y helpers privados).

## 6. Conclusión

El backend ensayado permite el contexto propio y rechaza empresa ajena, local no autorizado y ausencia de sesión sin dejar residuos. No se ha detectado un defecto C09 en el candidato congelado.

Marcadores:

`PM27_C09_CONTEXTO_PROPIO_PERMITIDO=PASS`
`PM27_C09_EMPRESA_AJENA_BLOQUEADA=PASS`
`PM27_C09_LOCAL_AJENO_BLOQUEADO=PASS`
`PM27_C09_SIN_SESION_BLOQUEADO=PASS`
`PM27_C09_ROLLBACK_SIN_RESIDUOS=PASS`
`PM27_C09_RESULTADO=PASS`

# PM27 — C16 Defecto L: E2E post-hotfix

Fecha: 2026-09-13
Baseline técnico corregido: `b3d37a4cf2fdc37f66d862948a5894dfbc66b0be`
Rama de auditoría: `claude/pm27-c16-e2e-post-hotfix`

## 1. Contrato del caso

C16 exige una operación real de prefiltro realizada desde la UI post-hotfix. Las pruebas estáticas de C14 y la validación RLS de C15 son necesarias pero no sustituyen el recorrido UI real -> petición real -> backend real -> persistencia observable.

## 2. Estado histórico: bloqueo correcto

Antes de recibir autorización específica no existía simultáneamente una UI post-hotfix exacta, un backend QA, una sesión QA utilizable y permiso para crear el Deploy Preview. Por eso C16 se clasificó correctamente como:

`BLOCKED_EXTERNAL / PENDIENTE_CONFIRMACION`

Ese estado histórico se conserva y no se reescribe como si el E2E se hubiera ejecutado antes.

## 3. Desbloqueo autorizado

El usuario autorizó explícitamente:

- crear un Deploy Preview exclusivo de C16;
- conectarlo exclusivamente a Supabase QA mediante el mecanismo versionado `reset-pruebas-preview.js`;
- ejecutar un único prefiltro sintético desde la UI real;
- verificar la persistencia en QA y limpiar después;
- comprobar cero escrituras en producción.

No se autorizó modificar `main`, `release`, producción ni PR #38.

## 4. UI exacta servida

Se creó el PR temporal #39 en estado draft/NO MERGE y el Deploy Preview exclusivo de C16.

- Deploy Netlify: `6aa7141d6347760008c7bd12`
- Contexto: `deploy-preview`
- Preview: `deploy-preview-39--chic-entremet-9107cf.netlify.app`
- Commit servido: `43b62653fa56f209664ee2002d7c6114446dae05`
- Árbol servido: `617d3a919f97bf710cd4d51c72ae08252e5ff5cb`
- Baseline corregido: `b3d37a4cf2fdc37f66d862948a5894dfbc66b0be`
- Árbol del baseline: `617d3a919f97bf710cd4d51c72ae08252e5ff5cb`

Los commits temporales del preview son commits vacíos: el árbol servido es byte a byte el mismo árbol del candidato corregido.

## 5. E2E real ejecutado desde la interfaz

La evidencia visual aportada durante la ejecución muestra la aplicación abierta en el dominio `deploy-preview-39`, dentro de Personal -> Selección de personal -> Prefiltro por WhatsApp, y el resultado real:

- candidato sintético: `PRUEBA PM26`;
- UI: `Enlace listo para PRUEBA PM26`;
- estado mostrado: `Pendiente de respuesta`;
- token sintético generado: `66c35a4b0bcae4679d63610d05c3792cf23064752a8b57c7f9da620e6e9f7109`.

No se sustituyó esta operación por `curl`, SQL manual de alta, integración simulada ni PostgreSQL local.

## 6. Persistencia verificada en Supabase QA

Antes de la operación:

- QA `public.prefiltros_candidatos`: 0 filas;
- producción `public.prefiltros_candidatos`: 0 filas.

Después de la creación desde la UI, la lectura directa en QA devolvió exactamente una fila correspondiente a la operación:

- `token`: `66c35a4b0bcae4679d63610d05c3792cf23064752a8b57c7f9da620e6e9f7109`;
- `creado_en`: `2026-09-13 21:29:48.645938+00`;
- `candidato_nombre`: `PRUEBA PM26`;
- `estado`: `pendiente`;
- `empresa_id`: `QA-EMP-A`;
- `local_id`: `QA-A1`.

La comprobación de membresía QA encontró exactamente 1 membresía activa compatible para `QA-EMP-A` / `QA-A1` (incluyendo semántica `todos_locales`). C15 ya había certificado que la RLS real es la autoridad final para empresa/local y los negativos de tenant ajeno; C16 no inventa un segundo sistema de autorización.

En producción, inmediatamente después del E2E, `public.prefiltros_candidatos` seguía en 0 filas.

## 7. Limpieza reversible

Se eliminó únicamente la fila sintética identificada simultáneamente por token y nombre `PRUEBA PM26`. El `DELETE ... RETURNING` devolvió esa fila con `empresa_id=QA-EMP-A` y `local_id=QA-A1`.

Estado final comprobado:

- QA `public.prefiltros_candidatos`: 0 filas;
- producción `public.prefiltros_candidatos`: 0 filas.

No quedó efecto residual del ensayo y no hubo ninguna escritura en Supabase producción.

## 8. Resultado C16

La condición que mantenía C16 bloqueado quedó resuelta con evidencia real y reversible.

`PM27_C16_E2E_REAL=EJECUTADO`

`PM27_C16_PREVIEW_DEPLOY=6aa7141d6347760008c7bd12`

`PM27_C16_PREVIEW_SHA=43b62653fa56f209664ee2002d7c6114446dae05`

`PM27_C16_PREVIEW_TREE=617d3a919f97bf710cd4d51c72ae08252e5ff5cb`

`PM27_C16_QA_FILA_CREADA=1`

`PM27_C16_QA_MEMBRESIA_COMPATIBLE=1`

`PM27_C16_QA_FILA_FINAL=0`

`PM27_C16_PRODUCCION_ESCRITURAS=0`

`PM27_C16_ESTADO_HISTORICO=PENDIENTE_CONFIRMACION`

`PM27_C16_RESULTADO=PASS`

C16 puede cerrarse únicamente si el gate remoto de esta evidencia termina en SUCCESS sobre el SHA exacto final de la rama.
# P2-R03B — reconstrucción de Auditoría tenant-aware sobre release actual

Estado: **candidato GitHub-only; no aplicado por este candidato a Supabase QA ni PROD**.

Baseline exacta:

- `release@899863a11cdac54fc68e472f1e1bb921a1bacbe3`
- rama: `claude/p2-r03b-release-current`

## Decisión de reconstrucción

El paquete histórico R03B fue validado en el commit `46d880f96701e1eb033b173646bad556d7472d2b`, pero ese historial está divergido respecto al release actual. No se hace merge ni rebase masivo.

Se recuperan únicamente los artefactos R03B históricamente validados:

- SQL: blob Git `bb05c3c5d960d5d0a67be44fd3a4a7cf25ce16eb`
- contrato estático: blob `2a8a0856502d1f90283fee21604e57af98754a4c`
- harness PostgreSQL: blob `68ea04715eac5bf89bb74a97b8ad7586cfd147aa`

Los tests se ubican bajo `.github/scripts/p2-r03b/` para no alterar el manifiesto congelado de 133 contratos activos del bloque 1–13.

## Preflight vivo — solo lectura

El preflight exacto del SQL R03B se ejecutó sin error tanto en PROD como en QA antes de preparar este candidato.

### PROD

`public.auditoria_registro` existe y está en uso histórico, pero mantiene el contrato anterior:

- columnas: `id`, `fecha`, `datos`, `creado_en`;
- no tiene `empresa_id`, `local_id`, `actor_user_id`;
- mantiene dos policies legacy;
- `authenticated` conserva SELECT, UPDATE y DELETE sobre la tabla;
- existen las firmas legacy de `registrar_auditoria` de 3 y 6 argumentos;
- no existe aún la firma de 8 argumentos del frontend actual;
- no existe `private.p2_r03b_puede_leer_auditoria(text,text)`.

No se leyó contenido de filas para este inventario.

### QA

QA está parcialmente adelantado:

- ya tiene `empresa_id`, `local_id`, `actor_user_id`;
- ya tiene la RPC de 8 argumentos;
- la tabla ya es append-only para `authenticated`;
- conserva la policy `auditoria_pm05_select`, con contrato distinto;
- todavía no existe `private.p2_r03b_puede_leer_auditoria(text,text)`.

R03B debe reconciliar esa política con el contrato final del paquete: lectura tenant-aware limitada a `Propietario`.

## Wiring del frontend actual

El `fuente.js` actual llama a `registrar_auditoria` con exactamente los ocho parámetros esperados:

- `p_id`
- `p_usuario`
- `p_accion`
- `p_detalle`
- `p_fecha`
- `p_hora`
- `p_empresa_id`
- `p_local_id`

El gate verifica este wiring sobre el SHA exacto del PR.

## Contrato funcional que restaura R03B

- contexto explícito `empresa_id`, `local_id`, `actor_user_id`;
- preservación de filas legacy sin inventar tenant;
- RLS fail-closed;
- una sola policy de lectura de auditoría para `Propietario` dentro de su alcance;
- tabla append-only para la aplicación;
- mutación solo a través de RPC;
- RPC de 8 argumentos compatible con frontend;
- captura de `auth.uid()`;
- replay exacto idempotente;
- conflicto explícito si se reutiliza el mismo ID con payload distinto;
- firmas legacy dejan de ser puntos de entrada;
- guardas para no reabrir las RPC legacy cerradas en P2-R02.

## Qué NO hace este candidato

- No aplica R03B en QA.
- No aplica R03B en PROD.
- No usa `db push`.
- No usa `migration repair`.
- No altera datos existentes.
- No toca `main` ni PR #38.
- No incorpora R03C, PM11, PM13 o P06.

## Criterio para siguiente fase

Antes de proponer aplicación remota deben quedar verdes sobre el SHA exacto:

1. gate específico `p2-r03b`;
2. contrato estático;
3. replay/conflict funcional en PostgreSQL efímero;
4. aislamiento RLS por empresa/local;
5. prohibición de lectura a usuario operativo no propietario;
6. regresión R03A;
7. `gate-final` general 133/133;
8. Deploy Preview sin errores relevantes.

La aplicación en QA y cualquier futura aplicación en PROD requieren autorizaciones separadas.

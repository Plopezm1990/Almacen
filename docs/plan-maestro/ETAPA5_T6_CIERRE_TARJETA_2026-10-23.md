# Plan Maestro L&A Suite — Etapa 5, T6: cierre del intento de tarjeta pendiente

Fecha: 23/10/2026
Entorno: QA `qjqorixtkilwsndqayyx` · Empresa `QA-EMP-A` · Local `QA-A1`
Autorización: Hoja QA-3 (Pedro, 23/10/2026, chat).

## 1. Punto de partida

Codex dejó abierto un intento de pago con tarjeta simulada sin ningún botón
para cerrarlo:

- Cuenta `e3724c02-bfd2-4a7d-aac3-70d97f8d00f4`.
- Pago `99e887c3-226d-4fa5-b125-4e7e83fddbf7`, checkout `a56fbd22-fe97-42c1-8e41-52ed2db3c8b4`.
- Intento `b690165e-4236-4819-b604-eac593f8224d`, 2,00 €, `PENDIENTE` desde
  el 23/10/2026 19:12:23 UTC.

Comprobado en QA, solo lectura, el 23/10/2026: ese intento seguía abierto.

## 2. Hallazgo: pieza ya construida y nunca conectada

El 11/10/2026, en la rama `codex/f9-c-qa-simulated-provider`
([PR #136](https://github.com/Plopezm1990/Almacen/pull/136), abierta, sin
fusionar), ya se construyó un resolvedor de tarjeta exclusivo de QA:

- Migración `supabase/migrations/20261011140000_abc_f4_b02b_qa_simulated_resolver.sql`,
  función `public.abc_qa_confirmar_pago_simulado(p_empresa_id, p_local_id, p_intento_id, p_importe)`.
- `SECURITY DEFINER`, fija `v_empresa := 'QA-EMP-A'` y `v_local := 'QA-A1'`
  como constantes (rechaza cualquier otra empresa/local).
- Exige que quien llama sea Propietario activo de esa empresa/local.
- Exige que el pago sea de medio `TARJETA` y que el importe coincida con el
  intento y con el pago.
- Delega la transición económica en `public.abc_resolver_intento` (la misma
  función que usaría un aviso real de un proveedor), con
  `provider_code='QA_SIMULADO'` y resultado `APROBADO`.
- Deja un evento `PAGO_CONFIRMADO` en `abc_eventos`, idempotente por
  `operation_id`.
- `grant execute` limitado a `authenticated`.

Esta función **ya estaba aplicada en el proyecto QA desde el 11/10/2026**.
Comprobado el 23/10/2026 leyendo su definición en vivo con
`pg_get_functiondef`: coincide letra por letra con el archivo de la rama. El
problema no era de base de datos: nunca se conectó el botón de pantalla.

## 3. Qué se ha hecho ahora

- `fuente.js` y `source-recovery/fuente-recuperado.js`: se añadió
  `resolverPagoSimuladoQAF4` (llama a `abc_qa_confirmar_pago_simulado`) y el
  manejador de pantalla `aprobarPagoSimuladoQAF4`, con el botón **"Aprobar
  pago simulado (solo QA)"** en `Cobro · F4`, visible únicamente cuando
  `configEmpresa.id === "QA-EMP-A"`, `local.id === "QA-A1"` y hay un intento
  de tarjeta pendiente.
- Se añadieron los 4 mensajes de error nuevos (`abc_qa_simulador_*`) al
  traductor de errores de cobro.
- Se incorporó al repositorio la migración
  `20261011140000_abc_f4_b02b_qa_simulated_resolver.sql` (documenta lo que
  ya estaba aplicado en QA; no ejecuta SQL nuevo).
- Prueba de contrato nueva:
  `tests/plan-maestro/etapa5-t6-tarjeta-qa-resolver-contract.mjs` — PASS.
- Se corrigió además un desajuste del manifiesto de CI anterior a este
  cambio: `tests/plan-maestro/etapa5-t6-bizum-qa-contract.mjs` (añadido por
  Codex) nunca se registró en `tests/ci/manifiesto_clasificacion.json`. Se
  registró junto con el archivo nuevo de esta pieza y se actualizaron los
  contadores (308→310 archivos, 291→293 contratos activos, 261→263 en
  Node) en el manifiesto, en el validador y en el comentario del workflow.

## 4. Límites respetados

- Solo QA. No se ha tocado PROD.
- No se ha creado ninguna migración nueva ni se ha escrito SQL directo.
- No se ha movido dinero real ni se ha contactado con ningún proveedor real.
- El botón no aparece fuera de `QA-EMP-A` / `QA-A1`.

## 5. Verificación hecha

- `node --check fuente.js` y `node --check source-recovery/fuente-recuperado.js`: OK.
- `node .github/scripts/build-netlify-publish.mjs` y `node --check .netlify-dist/fuente.js`: OK.
- Prueba nueva (`etapa5-t6-tarjeta-qa-resolver-contract.mjs`): PASS.
- Contratos existentes de la Etapa 5 (T5/T6) y de las Etapas 3-4: todos en
  verde, sin cambios de resultado.

## 6. Pendiente

- **El intento real del §1 sigue abierto.** Resolverlo con el botón nuevo
  requiere una sesión real del Propietario de QA en el preview publicado —
  por las reglas de este proyecto, esa sesión la abre Pedro, nunca con una
  contraseña entregada a Claude o a Codex. Pasos para Pedro: entrar en el
  preview de QA como Propietario de `QA-EMP-A` / local `QA-A1`, abrir
  `Cobro · F4` sobre esa cuenta y pulsar "Aprobar pago simulado (solo QA)".
  No mueve dinero real; solo cierra el intento de prueba.
- Esta migración solo se ha añadido a git; no se ha vuelto a aplicar en QA
  (ya estaba) ni se ha aplicado en PROD.
- Queda pendiente decidir con Pedro si se añade también un camino de
  "rechazar" el pago simulado (la pieza actual solo aprueba) — no estaba en
  el alcance de la Hoja QA-3 y se deja para una hoja aparte si hace falta.

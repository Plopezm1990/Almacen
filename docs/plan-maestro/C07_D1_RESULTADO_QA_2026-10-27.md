# ABC F7 C07-D.1 — resultado de integración en QA

Fecha: 2026-10-27  
Ámbito: Supabase QA `qjqorixtkilwsndqayyx` y Preview de la rama de trabajo.  
Producción: no modificada. AEAT: no conectada.

## Resultado

La emisión fiscal de una cuenta ya no termina en el cobro. Cuando F4 confirma el efectivo y el checkout queda `COMPLETADO`, el TPV invoca la RPC autenticada `abc_c07d_emitir_checkout`. La RPC realiza en una única transacción:

1. Comprueba que el checkout está completado y pertenece a la empresa, local y cuenta recibidos.
2. Reserva el número C05 usando la entidad fiscal activa del local y la serie configurable.
3. Resuelve el documento C05 a `EMITIDO` con metadatos QA explícitos.
4. Registra el documento en `abc_c07d_registros_fiscales`, calcula la secuencia y el hash encadenado.
5. Crea la entrada `PENDIENTE` en `abc_c07d_cola_fiscal`.
6. Devuelve al TPV el número, la secuencia, el hash, el identificador del registro y el estado de la cola.

El TPV también usa `abc_c07d_estado_cuenta` para refrescar el estado sin leer ni modificar directamente las tablas C07-D. El bloque visible indica `Fiscalización C07-D · QA`, número de serie, secuencia y estado de cola. El transporte AEAT permanece marcado como `DISABLED`.

## Evidencia QA

- Migración aplicada: `20261027143000_abc_f7_c07d_checkout_emit_qa.sql`.
- RPC de emisión disponible para `authenticated`: `abc_c07d_emitir_checkout(text,text,text,uuid,text,text)`.
- RPC de lectura disponible para `authenticated`: `abc_c07d_estado_cuenta(text,text,uuid)`.
- Smoke con usuario autenticado y checkout QA completado: devolvió C05 `EMITIDO`, serie `TPV`, número `5`, secuencia C07-D `1`, hash SHA-256 y cola `PENDIENTE`.
- El smoke se ejecutó dentro de `BEGIN … ROLLBACK`; no dejó datos de prueba.
- Conteo posterior: registros C07-D `0`, cola C07-D `0`; los 8 documentos C05 emitidos existentes permanecen intactos.
- No se llamó a AEAT, no se usaron certificados, claves ni secretos.

## Verificaciones locales

- `node tests/f5/c07/c07d-checkout-emit-contract.mjs` — PASS.
- `node tests/f5/c07/c07d-migration-contract.mjs` — PASS.
- `node tests/f5/c07/c07d-preflight-contract.mjs` — PASS.
- `node tests/f5/c05/c05-series-contract.mjs` — PASS.
- `node tests/f5/c07/c07-fiscal-gate-contract.mjs` — PASS_WITH_POSTGRES_PENDING.
- `node tests/f5/c07/c07-security-contract.mjs` — PASS_WITH_ADVISORS_PENDING.
- `node --check fuente.js` — PASS.
- `node --check source-recovery/fuente-recuperado.js` — PASS.
- `git diff --check` — PASS.

## Límites y siguiente trabajo

Esta pieza prueba la integración interna de cobro, C05 y cadena/cola C07-D en QA. La cola todavía no transporta datos a AEAT: su estado queda `PENDIENTE` hasta que se diseñe y autorice el adaptador fiscal por empresa/asesoría.

Sigue C07-D.2: completar la selección persistente de serie por entidad fiscal y definir el contrato del adaptador de cada empresa/asesoría —credenciales fuera del frontend, rotación, auditoría, reintentos y resolución `ACEPTADO/RECHAZADO/ERROR`— manteniendo QA aislada. Después habrá que repetir las pruebas con datos reales de QA y solo entonces preparar una promoción formal, sin aplicar nada en producción automáticamente.

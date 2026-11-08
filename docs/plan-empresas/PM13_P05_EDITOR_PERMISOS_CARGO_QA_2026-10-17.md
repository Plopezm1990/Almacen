# PM13 P05 — Editor de permisos de cargos personalizados en QA

Fecha: 2026-10-17  
Rama: `codex/fix-product-bootstrap-context-20261015`  
Alcance: Deploy Preview 150 y proyecto Supabase QA únicamente.

## Objetivo

Permitir que un Propietario configure permisos explícitos de un cargo personalizado sin escribir directamente en `public.abc_cargo_permisos`.

## Implementación

- La pantalla de Configuración carga el catálogo y el estado actual mediante `pm13_listar_cargo_permisos`.
- El editor ofrece `Permitido` y `Denegado` por acción; las reglas no configuradas se mantienen sin escritura.
- Solo se envían las filas que el Propietario cambió.
- Cada escritura llama a `pm13_configurar_cargo_permiso`, con alcance derivado del catálogo y motivo obligatorio.
- El RPC existente valida sesión, empresa, local, cargo, catálogo, alcance y auditoría.

## Límites

- No se modifica `main`, `release`, PR 38, producción ni el esquema de Supabase.
- No se permite falsear `auth.uid()` ni insertar filas directamente desde el cliente.
- El editor no borra reglas existentes; una revocación se expresa como `Denegado` y queda versionada.

## Verificación realizada

- `node --check fuente.js` — PASS.
- `node --check source-recovery/fuente-recuperado.js` — PASS.
- `node tests/pm13/p20-cargo-permissions-editor-contract.mjs` — PASS.
- `node tests/pm13/p08-cargos-permisos-ui-contract.mjs` — PASS.
- `node tests/pm13/p16-editor-pantallas-contract.mjs` — PASS.
- `node tests/pm13/p18-cargo-action-resolver-contract.mjs` — PASS.
- `python source-recovery/recuperar_candidato.py --check` — PASS.

La prueba autenticada de guardar una regla Permitida y otra Denegada queda pendiente de ejecutar en QA con la sesión de Propietario ya preparada.

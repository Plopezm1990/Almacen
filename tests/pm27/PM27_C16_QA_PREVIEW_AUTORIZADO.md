# PM27 — C16 QA Preview autorizado

Fecha: 2026-09-13

Autorización explícita recibida para:

- crear un Deploy Preview exclusivo de C16;
- conectar ese Preview únicamente a Supabase QA mediante el mecanismo ya versionado `reset-pruebas-preview.js`;
- ejecutar un prefiltro sintético en QA desde la UI real;
- verificar la fila y limpiar después;
- comprobar cero escrituras en producción.

Reglas:

- NO MERGE.
- No modificar main ni release.
- No cambiar Netlify producción.
- No escribir Supabase producción.
- PR/Preview exclusivamente no productivo.

Baseline funcional post-hotfix: `b3d37a4cf2fdc37f66d862948a5894dfbc66b0be`.

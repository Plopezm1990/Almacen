# Punto 6 — Certificación de publicación y recuperación de Netlify

**Fecha de preflight:** 2026-09-21  
**Estado:** Fase 6A en preparación; **Punto 6 aún no cerrado**  
**Rama de trabajo:** \`claude/punto6-netlify-publicacion-recuperacion\`  
**Base viva verificada antes de crear la rama:** \`release@21ee66bdb52e4d5ad0af2341543f53720a4cf027\`

## 1. Alcance y prohibiciones

Este punto certifica la ruta de publicación y recuperación de Netlify. La Fase 6A es de documentación, verificación y CI. No autoriza:

- cambios en \`release\` o \`main\`;
- apertura de PR que pueda generar Deploy Preview;
- deploy manual o promoción de un deploy;
- cambios de configuración en Netlify;
- escrituras o migraciones en Supabase QA/PROD;
- \`db push\`, \`migration repair\`, force-push o push directo a \`release\`.

## 2. Estado vivo verificado

### GitHub

- Repositorio: \`Plopezm1990/Almacen\`.
- \`release\`: \`21ee66bdb52e4d5ad0af2341543f53720a4cf027\`.
- \`release\` aparece protegida.
- Required status check observado en la lectura de rama: \`gate-final\`.
- PR #38: abierto, draft, base \`main\`; no se modifica.
- PRs abiertos con base \`release\`: 0 durante el preflight.

El endpoint administrativo específico de branch protection devuelve 403 al conector por permisos de integración; la lectura normal de la rama sí expone \`protected=true\` y \`required_status_checks.contexts=["gate-final"]\`.

### Netlify producción

- Proyecto: \`chic-entremet-9107cf\`.
- Site ID: \`472295da-601a-43df-a4bc-8171f2fc668b\`.
- Deploy actual: \`6ab0472a6242cb0008894ccd\`.
- Estado: \`ready\`.
- Contexto: \`production\`.
- Rama: \`release\`.
- \`commit_ref\`: \`21ee66bdb52e4d5ad0af2341543f53720a4cf027\`.
- \`manual_deploy=false\`.
- \`error_message=null\`.
- Secret scan del deploy: 693 archivos examinados, 0 coincidencias informadas.
- Resumen de Netlify: 7 reglas de headers procesadas, 0 redirect rules, 0 Functions y 0 Edge Functions.

El deploy productivo coincide exactamente con el SHA vivo de \`release\`.

## 3. Ruta versionada de publicación

\`netlify.toml\` fija:

\`\`\`toml
[build]
  command = "node .github/scripts/build-netlify-publish.mjs"
  publish = ".netlify-dist"
\`\`\`

El exportador reconstruye \`.netlify-dist\` desde cero y excluye del payload web:

- \`.git\`
- \`.github\`
- \`.netlify-dist\`
- \`tests\`
- \`supabase\`
- \`source-recovery\`
- \`docs\`
- \`tools\`
- \`netlify.toml\`

El contrato ya existente \`tests/netlify-publish-boundary.mjs\` comprueba por SHA-256 que cada ruta permitida del árbol fuente coincide con el artefacto publicado y rechaza rutas técnicas.

La puerta general de CI \`.github/workflows/puerta-ci-release.yml\` reconstruye \`.netlify-dist\` dentro de la batería activa y exige finalmente \`gate-final\`.

## 4. Contrato específico del Punto 6

Se añade:

\`.github/scripts/punto6-netlify-publicacion-recuperacion.mjs\`

El contrato:

1. exige que la rama derive de \`release@21ee66...\`;
2. rechaza cualquier cambio de Fase 6A fuera del documento y del propio contrato;
3. valida \`netlify.toml\`;
4. valida las exclusiones técnicas del exportador;
5. exige las 7 rutas actuales de \`_headers\`;
6. crea un worktree desechable del \`release\` base;
7. construye \`.netlify-dist\` tanto para el release base como para el candidato;
8. compara todos los archivos por SHA-256;
9. falla ante cualquier byte, archivo o ruta publicable diferente;
10. elimina los artefactos y el worktree temporales.

Por diseño, los dos archivos de Fase 6A viven en \`.github/\` y \`docs/\`, ambos excluidos de Netlify.

## 5. Ruta de recuperación

Hay que distinguir dos mecanismos.

### A. Rollback de Netlify

Conceptualmente consiste en volver a publicar un deploy productivo anterior ya construido. Eso revierte únicamente el contenido servido por Netlify. **No revierte Supabase ni ninguna migración de base de datos.**

Para considerar esta ruta certificada en L&A Suite falta identificar por lectura un deploy productivo anterior concreto y verificar su ID, commit, estado y disponibilidad.

### B. Reversión hacia delante por Git

Es la ruta controlada para un estado duradero:

1. identificar el commit conocido a recuperar;
2. crear rama aislada desde el \`release\` vivo;
3. revertir/restaurar en esa rama sin reescribir historia;
4. ejecutar contratos, batería completa y comparación del payload;
5. abrir PR hacia \`release\`;
6. exigir el \`gate-final\` del propio PR;
7. fusionar únicamente con autorización explícita;
8. supervisar el deploy automático;
9. ejecutar postflight de URL, bytes y cabeceras relevantes.

Quedan prohibidos force-push, reset de \`release\` y push directo.

## 6. Límite encontrado en el preflight

Los conectores disponibles permiten leer el proyecto Netlify y un deploy cuando se conoce su ID, pero **no exponen una operación para enumerar todo el historial de deploys**. GitHub tampoco expone deployments mediante el conector permitido.

Por tanto:

- el deploy actual sí está certificado;
- el mecanismo de publicación del repositorio sí puede certificarse reproduciblemente;
- **un deploy productivo anterior concreto todavía no está identificado con evidencia viva**;
- no se simula ni se inventa un ID de rollback.

Este límite impide declarar cerrado el criterio “ruta de reversión probada” hasta resolverlo o documentar formalmente que la recuperación se limita a la reversión hacia delante por Git.

## 7. Criterio para completar el Punto 6

Antes de cerrar el Punto 6 deben quedar satisfechos:

- contrato de repositorio PASS;
- batería activa y CI del SHA candidato en verde;
- evidencia de que el candidato no cambia el payload servido;
- PR a \`release\` solo después de autorización separada;
- \`gate-final\` del propio PR;
- identificación y validación de un deploy anterior de rollback **o** aceptación explícita de la limitación y uso de reversión hacia delante por Git;
- ninguna modificación de Supabase como parte del rollback Netlify.

## 8. Estado de P2

Los Puntos 14–18 / frente P2 permanecen independientes y no se mezclan con el cierre de Puntos 6–13.

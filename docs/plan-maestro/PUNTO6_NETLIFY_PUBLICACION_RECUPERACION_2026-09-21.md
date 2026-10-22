# Punto 6 — Certificación de publicación y recuperación de Netlify

**Fecha de preflight y revalidación:** 2026-09-21  
**Estado:** Fase 6A validada; **candidata técnica al cierre, pendiente de fusión/postflight autorizado**  
**Rama de trabajo:** `claude/punto6-netlify-publicacion-recuperacion`  
**PR:** #41 — draft, base `release`, no fusionado  
**Base viva verificada:** `release@21ee66bdb52e4d5ad0af2341543f53720a4cf027`

## 1. Alcance y prohibiciones

Este punto certifica la ruta de publicación y recuperación de Netlify. La Fase 6A se limita a documentación, verificación reproducible, CI y Deploy Preview no productivo.

No autoriza:

- cambios directos en `release` o `main`;
- merge del PR #41;
- deploy manual o promoción de un deploy a producción;
- cambios de configuración en Netlify;
- escrituras o migraciones en Supabase QA/PROD;
- `db push`, `migration repair`, force-push o reset de `release`;
- cambios sobre PR #38.

## 2. Estado vivo verificado

### GitHub

- Repositorio: `Plopezm1990/Almacen`.
- `release`: `21ee66bdb52e4d5ad0af2341543f53720a4cf027`.
- `release` aparece protegida.
- Required status check observado en la lectura de rama: `gate-final`.
- PR #38: abierto, draft, base `main`; fuera de alcance.
- PR #41: abierto, draft, base `release`, `mergeable=true`, no fusionado.
- HEAD validado inicialmente del PR #41: `b310fe18c5e44db24d190b39ddb81bfcf6ff2844`.

El endpoint administrativo específico de branch protection devuelve 403 al conector por permisos de integración; la lectura normal de la rama sí expone `protected=true` y `required_status_checks.contexts=["gate-final"]`.

### Netlify producción

Durante la revalidación previa a esta actualización documental:

- proyecto: `chic-entremet-9107cf`;
- deploy productivo actual: `6ab0472a6242cb0008894ccd`;
- estado: `ready`;
- contexto: `production`;
- rama: `release`;
- `commit_ref`: `21ee66bdb52e4d5ad0af2341543f53720a4cf027`;
- `manual_deploy=false`;
- `error_message=null`;
- secret scan del deploy: 0 coincidencias informadas;
- 7 reglas de headers procesadas;
- 0 redirect rules;
- 0 Functions;
- 0 Edge Functions.

El deploy productivo coincide con el SHA vivo de `release`.

## 3. Ruta versionada de publicación

`netlify.toml` fija:

```toml
[build]
  command = "node .github/scripts/build-netlify-publish.mjs"
  publish = ".netlify-dist"
```

El exportador reconstruye `.netlify-dist` desde cero y excluye del payload web:

- `.git`
- `.github`
- `.netlify-dist`
- `tests`
- `supabase`
- `source-recovery`
- `docs`
- `tools`
- `netlify.toml`

El contrato ya existente `tests/netlify-publish-boundary.mjs` comprueba por SHA-256 que cada ruta permitida del árbol fuente coincide con el artefacto publicado y rechaza rutas técnicas.

La puerta general de CI `.github/workflows/puerta-ci-release.yml` reconstruye `.netlify-dist` dentro de la batería activa y exige finalmente `gate-final`.

## 4. Contrato específico del Punto 6

Se añade:

`.github/scripts/punto6-netlify-publicacion-recuperacion.mjs`

El contrato:

1. exige que la rama derive de `release@21ee66...`;
2. rechaza cualquier cambio de Fase 6A fuera del documento y del propio contrato;
3. valida `netlify.toml`;
4. valida las exclusiones técnicas del exportador;
5. exige las 7 rutas actuales de `_headers`;
6. crea un worktree desechable del `release` base;
7. construye `.netlify-dist` tanto para el release base como para el candidato;
8. compara todos los archivos por SHA-256;
9. falla ante cualquier byte, archivo o ruta publicable diferente;
10. elimina artefactos y worktree temporales.

Por diseño, los dos archivos funcionales de la Fase 6A viven en `.github/` y `docs/`, ambos excluidos de Netlify.

## 5. Validación del PR #41

El primer HEAD validado del PR #41 fue:

`b310fe18c5e44db24d190b39ddb81bfcf6ff2844`

GitHub confirmó:

- base exacta: `release@21ee66bdb52e4d5ad0af2341543f53720a4cf027`;
- 2 commits;
- 2 archivos modificados;
- 0 archivos de runtime;
- `mergeable=true`.

Run del propio PR:

`35569334184`

Resultado calculado por el gate:

- `NODE_ACTIVE_PASS=121`;
- `NODE_ACTIVE_FAIL=0`;
- `POSTGRES_ACTIVE_PASS=9`;
- `POSTGRES_ACTIVE_FAIL=0`;
- 3 contratos full-stack completados con éxito;
- `CALCULO_TOTAL_ACTIVOS=133`;
- `CALCULO_ACTIVE_PASS=133`;
- `CALCULO_ACTIVE_FAIL=0`;
- `HISTORICAL_EXPECTED_FAIL=1`;
- `UTILITIES=3`;
- `DIAGNOSTICS=5`;
- `PUERTA_CI_RELEASE_GATE=PASS`;
- job `gate-final`: SUCCESS.

### Deploy Preview del PR

Netlify creó el Deploy Preview:

`6ab0d0d398aae3000889bb95`

Verificado:

- estado `ready`;
- contexto `deploy-preview`;
- PR #41;
- `commit_ref=b310fe18c5e44db24d190b39ddb81bfcf6ff2844`;
- rama `claude/punto6-netlify-publicacion-recuperacion`;
- `manual_deploy=false`;
- `error_message=null`;
- secret scan: 0 coincidencias;
- 7 reglas de headers;
- 0 Functions;
- 0 Edge Functions.

Netlify informó además: `All files already uploaded`, coherente con que los cambios del candidato están en rutas excluidas del payload.

## 6. Ruta de recuperación

Se distinguen dos mecanismos y se fija cuál queda soportado operativamente por este punto.

### A. Rollback nativo de Netlify — capacidad conocida, no certificada con ID histórico

Netlify permite conceptualmente volver a publicar un deploy productivo anterior ya construido. Esa acción revierte únicamente el contenido servido por Netlify; **no revierte Supabase ni ninguna migración de base de datos**.

La investigación read-only realizada para este punto comprobó:

- el conector autenticado de Netlify permite consultar un deploy cuando ya se conoce su ID;
- el conector no expone una operación para enumerar el historial completo de deploys;
- una llamada explícita a `list-deploys` no pertenece al esquema permitido;
- GitHub conserva checks de CI de commits anteriores, pero no proporciona desde los endpoints permitidos el ID del deploy productivo histórico de Netlify;
- las referencias de Netlify encontradas en PRs corresponden a Deploy Previews y no prueban cuál fue el deploy productivo inmediatamente anterior.

Por tanto, **no existe evidencia accesible suficiente para certificar un ID productivo anterior concreto**. No se inventa, infiere ni simula ese identificador.

Conclusión de esta vía: el rollback nativo de Netlify se reconoce como capacidad de plataforma, pero **no queda declarado como ruta operativa certificada de L&A Suite en este punto** mientras no pueda verificarse un deploy histórico concreto.

### B. Reversión hacia delante por Git — ruta soportada y certificada

La recuperación soportada de L&A Suite queda fijada como reversión hacia delante por Git:

1. identificar el commit o estado conocido a recuperar;
2. leer de nuevo el `release` vivo antes de actuar;
3. crear rama aislada desde ese `release`;
4. revertir/restaurar en la rama sin reescribir historia;
5. ejecutar contratos, batería completa y comparación del payload;
6. abrir PR hacia `release`;
7. exigir el `gate-final` del propio PR;
8. fusionar únicamente con autorización explícita;
9. supervisar el deploy automático de Netlify;
10. ejecutar postflight de commit, URL, estado, payload y cabeceras relevantes.

Quedan prohibidos:

- force-push;
- reset de `release`;
- push directo a `release`;
- usar un rollback Netlify como sustituto de un rollback de Supabase.

## 7. Estado recuperable conocido

El padre inmediato del `release` vigente es:

`8540bd06d5555cf260aa4599144ed6c64f3ca029`

La comparación real:

`8540bd06... -> 21ee66bd...`

muestra un único commit con cambios exclusivamente en:

- `.github/workflows/validate-source-recovery-release.yml`;
- `source-recovery/CURRENT_RELEASE.patch`;
- `source-recovery/CURRENT_RELEASE_EVIDENCE.json`;
- `source-recovery/CURRENT_RELEASE_MANIFEST.json`.

`.github/` y `source-recovery/` están excluidos del payload Netlify. Además, el Punto 4 ya había validado la paridad byte a byte del payload para esa promoción.

Por ello, `8540bd06...` es un estado Git conocido y recuperable, pero volver de `21ee66bd...` a `8540bd06...` **no produciría un cambio de aplicación visible**: la diferencia entre ambos estados es técnica y está fuera del payload publicado.

La utilidad de este dato es certificar que existe un ancla Git previa conocida; no se presenta como sustituto de un ID de deploy histórico de Netlify.

## 8. Decisión formal sobre el criterio de recuperación

Se acepta y documenta explícitamente la limitación observada:

- **rollback nativo Netlify:** no certificado con deploy histórico concreto desde los accesos disponibles;
- **reversión hacia delante por Git:** ruta soportada, reproducible y protegida por PR + `gate-final`;
- **rollback de base de datos:** fuera del rollback Netlify y sujeto a procedimiento separado de Supabase.

Con esta decisión, el requisito de recuperación queda **claramente limitado y operacionalmente definido**, sin afirmar una capacidad no demostrada.

## 9. Estado de cierre del Punto 6

A nivel técnico previo a promoción, quedan satisfechos:

- preflight vivo de `release`, protección, PRs y Netlify;
- publicación versionada y reproducible;
- contrato de frontera de publicación;
- contrato específico del Punto 6;
- evidencia de no alteración de runtime en el candidato;
- Deploy Preview no productivo verificado;
- batería activa `133/133 PASS`, `0 FAIL`;
- `gate-final` propio del PR en SUCCESS;
- ruta de recuperación soportada y limitación del rollback nativo documentadas.

**El Punto 6 no se marca todavía como cerrado en producción** porque el PR #41 permanece sin fusionar. El cierre final requiere autorización separada para merge/promoción y, después, postflight del deploy productivo resultante.

## 10. Estado de P2

Los Puntos 14–18 / frente P2 permanecen independientes y no se mezclan con el cierre de los Puntos 6–13.

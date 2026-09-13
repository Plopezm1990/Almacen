# PM26 P05c — Defecto E cerrado (producción publica desde `release`)

## Estado

**CERRADO.** Completa lo que P05b dejó parcial/bloqueado: la usuaria
realizó manualmente, en el panel de Netlify del sitio
`chic-entremet-9107cf`, el cambio de **Production branch** de `main` a
`release` (Project configuration → Build & deploy → Continuous
deployment → Branches and deploy contexts). Ninguna herramienta de esta
sesión tocó esa configuración — se guió paso a paso y se verificó
después, en solo lectura, con las herramientas de lectura de Netlify.

## 1. Qué hizo la usuaria (acción manual, no ejecutada por esta sesión)

1. Abrió `chic-entremet-9107cf` → Project configuration → Build & deploy
   → Continuous deployment.
2. En "Branches and deploy contexts", cambió el campo **Production
   branch** de `main` a `release`.
3. No tocó ningún otro campo de esa pantalla: "Branch deploys" siguió
   con `seguridad-edge-functions` como rama adicional (sin cambios), y
   "Deploy Previews" siguió en "Any pull request against your
   production branch / branch deploy branches" (sin cambios).
4. Guardó. La pantalla volvió a modo resumen mostrando **Production
   branch: release**, confirmando que el cambio quedó aplicado.

## 2. Verificación de solo lectura realizada después

Con `mcp__Netlify__netlify-project-services-reader` (`get-projects`,
`get-project`) y `mcp__Netlify__netlify-deploy-services-reader`
(`get-deploy-for-site`) sobre el sitio `chic-entremet-9107cf`:

- Deploy actual de producción: `state: "ready"`, sin `error_message`.
- `commit_ref`: `93a570badba1c5375febfbddc1dffdbcef003dcd` — el mismo
  commit congelado que `origin/main` y `origin/release` (verificado por
  separado con `git rev-parse`), porque ambas ramas apuntaban al mismo
  SHA en el momento del cambio. El contenido servido no varió.
- `context`: `production`.
- `available_functions`: `[]`; sin Edge Functions desplegadas.
- Resumen del deploy: 7 reglas de cabecera procesadas sin error, sin
  reglas de redirect, sin funciones ni edge functions.

**Matiz documentado con honestidad:** el registro de ese deploy
conserva internamente `"branch": "main"` como metadato histórico de
cuándo se *construyó* ese artefacto concreto (8 de septiembre, antes
del cambio); no es una prueba en sí misma de que el cambio de contexto
de producción no se aplicó. La confirmación directa y más fiable es la
propia pantalla de Netlify, ya en modo resumen, mostrando "Production
branch: release" tras guardar. Como `main` y `release` apuntaban al
mismo commit en el momento del cambio, Netlify no generó un deploy
nuevo que llevara ya la etiqueta `release` — esa confirmación adicional
llegará de forma natural la próxima vez que ambas ramas diverjan (un
futuro commit promovido específicamente a `release`), momento en el que
un nuevo build con `"branch": "release"` será la prueba definitiva. No
se fuerza esa divergencia aquí: haría falta autorización específica
para promover un commit a producción, y no es el objeto de este cierre.

## 3. Qué NO se hizo

- Ninguna herramienta de esta sesión cambió la configuración de
  Netlify — el cambio lo hizo la usuaria manualmente en su panel.
- No se tocó SSO, contraseñas, dominios, variables de entorno, "Branch
  deploys" ni "Deploy Previews".
- No se hizo push a `main` ni a `release`.
- No se escribió en Supabase (QA, producción ni TPV).
- No se forzó ninguna divergencia entre `main` y `release` para
  "demostrar" el cambio antes de tiempo.

## Qué queda igual

El flujo de publicación descrito en la sección 5 de
`P05B_PREPARACION_RAMA_RELEASE.md` pasa a estar vigente desde ahora:
`main` sigue siendo la única rama de integración, y publicar a
producción requiere además promover ese commit a `release` con
autorización específica para esa publicación concreta.

```
PM26_P05C_ESTADO=CERRADO
PM26_P05C_CAMBIO_NETLIFY_REALIZADO_POR=USUARIA_MANUALMENTE
PM26_P05C_CAMBIO_APLICADO_POR_HERRAMIENTA_DE_SESION=NO
PM26_P05C_PRODUCTION_BRANCH_CONFIRMADA_EN_PANEL=RELEASE
PM26_P05C_DEPLOY_ACTUAL_ESTADO=READY
PM26_P05C_DEPLOY_ACTUAL_COMMIT_REF=93a570badba1c5375febfbddc1dffdbcef003dcd
PM26_P05C_FUNCTIONS_DESPLEGADAS=NO
PM26_P05C_EDGE_FUNCTIONS_DESPLEGADAS=NO
PM26_P05C_OTROS_CAMPOS_NETLIFY_TOCADOS=NO
PM26_P05C_MAIN_RELEASE_TOCADOS_POR_SESION=NO
PM26_P05C_SUPABASE_QA_PRODUCCION_TPV_TOCADOS=NO
PM26_P05C_DEFECTO_E_RESUELTO=SI
```

Defecto E queda **CERRADO**. Quedan 3 puntos del traspaso: Aviso G
(bloqueado por plan Free), Defecto L (requiere autorización explícita
para escribir en producción) y PM25–P02 (bloqueado por falta de entorno
aislado). Ninguno se inicia por una instrucción genérica de continuar —
cada uno requiere que la usuaria nombre expresamente el objeto y el
riesgo.

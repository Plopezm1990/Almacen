# PM26 P05b — Preparación de la rama `release` (defecto E)

## Estado

**PARCIAL/BLOQUEADO.** El usuario autorizó P05b con la Opción 1 (rama de
contexto de producción dedicada) descrita en
`tests/pm26/P05A_DIAGNOSTICO_DEFECTO_E.md`. Esa opción tiene dos partes:

1. **Preparar la rama `release` en el repositorio** — hecho en este
   paquete, es una operación de Git normal sin tocar `main` ni ningún
   archivo.
2. **Cambiar en Netlify la rama de contexto `production` de `main` a
   `release`** — **no ejecutado, y no ejecutable con las herramientas
   disponibles en esta sesión.** Ver sección 2. Requiere una acción del
   usuario directamente en el panel de Netlify.

El defecto E **sigue sin resolverse** hasta que se complete el paso 2 y
se verifique. `main`, Supabase, QA, producción y TPV permanecen
intactos.

---

## 1. Qué se hizo — rama `release` creada y publicada

- Rama nueva `release`, creada localmente en el commit exacto de
  `origin/main` congelado (`93a570badba1c5375febfbddc1dffdbcef003dcd`),
  sin ningún commit adicional — es el mismo árbol, mismo contenido, byte
  a byte, que `main` en este momento.
- Publicada a `origin/release` con `git push -u origin release`.
- No se creó ningún commit nuevo, no se modificó ningún archivo, no se
  hizo push a `main`.

Verificación reproducible: `git rev-parse origin/main` y
`git rev-parse origin/release` deben devolver el mismo hash
(`93a570badba1c5375febfbddc1dffdbcef003dcd`) mientras este paquete siga
vigente y nadie haya promovido todavía un commit distinto a `release`.

## 2. Por qué se detiene aquí — límite real de la herramienta

La única herramienta de escritura de Netlify disponible en esta sesión,
`mcp__Netlify__netlify-project-services-updater`, expone exactamente
estas operaciones: `update-visitor-access-controls`, `update-forms`,
`manage-form-submissions`, `update-project-name`, `manage-env-vars`,
`create-new-project`. **Ninguna de ellas permite cambiar la rama de
contexto de producción de un sitio.** Ese ajuste vive en Site settings →
Build & deploy → Deploy contexts → "Production branch" del panel de
Netlify, y no está expuesto por ninguna herramienta de lectura ni de
escritura disponible aquí.

No se intentó ningún atajo para sortear esta limitación (API directa con
credenciales, scripts contra el panel, etc.) — hacerlo violaría la regla
del proyecto de no usar tokens/claves no autorizados y de no aplicar
cambios de producción sin una vía explícita y verificable.

## 3. Acción pendiente del usuario (paso a paso exacto)

En el panel de Netlify, sitio `chic-entremet-9107cf`:

1. Site settings → Build & deploy → Deploy contexts.
2. Cambiar "Production branch" de `main` a `release`.
3. Guardar. Netlify no debería disparar un build nuevo inmediatamente
   solo por el cambio de rama de contexto si `release` no tiene commits
   nuevos respecto al último despliegue ya publicado de `main` — pero si
   sí lo dispara, el resultado esperado es un despliegue idéntico al
   actual, porque `release` apunta exactamente al mismo commit que
   `main` ahora mismo.

No se requiere ninguna otra acción en el panel para esta opción (no hay
que tocar variables de entorno, dominios, ni SSO/contraseña — esos
ajustes quedan igual que en `PM26_P01`/`P05a`).

## 4. Verificación que se hará después (una vez el usuario complete el paso 3)

Con las mismas herramientas de solo lectura ya usadas en P05a
(`netlify-project-services-reader`, operación `get-project`), se
confirmará que el despliegue actual del contexto `production` sigue en
`state: "ready"` sin errores tras el cambio, y se pedirá al usuario que
confirme desde el propio panel que la rama de contexto quedó en
`release` (dato que las herramientas de lectura disponibles no exponen
directamente). Solo entonces se documentará el cierre real de P05b y
del defecto E.

## 5. Flujo de publicación una vez completado el paso 3

1. `main` sigue siendo la única rama de integración — el usuario sigue
   fusionando o autorizando push contra ella exactamente igual que
   ahora.
2. Publicar a producción deja de ser automático al llegar a `main`: pasa
   a requerir, además, promover el commit ya validado de `main` hacia
   `release` (fast-forward o merge), cada vez con autorización
   específica del usuario para esa publicación concreta.
3. Solo un push/merge a `release` dispara el despliegue a producción.

## Qué NO se hizo

- No se cambió ninguna configuración de Netlify (ni la rama de contexto,
  ni SSO, ni contraseña, ni variables de entorno).
- No se hizo push a `main`.
- No se tocó Supabase, QA, producción como datos, ni TPV.
- No se promovió ningún commit distinto a `release` — apunta exactamente
  al mismo commit que `main` en este momento.
- No se declara el defecto E resuelto.

```
PM26_P05B_ESTADO=PARCIAL_BLOQUEADO
PM26_P05B_RAMA_RELEASE_CREADA=SI
PM26_P05B_RAMA_RELEASE_APUNTA_A_MAIN_CONGELADO=SI
PM26_P05B_NETLIFY_CONTEXTO_PRODUCCION_CAMBIADO=NO
PM26_P05B_MOTIVO_BLOQUEO=HERRAMIENTA_DE_ESCRITURA_NETLIFY_SIN_OPERACION_PARA_RAMA_DE_PRODUCCION
PM26_P05B_ACCION_PENDIENTE=USUARIO_DEBE_CAMBIAR_PRODUCTION_BRANCH_EN_PANEL_NETLIFY
PM26_P05B_MAIN_TOCADO=NO
PM26_P05B_SUPABASE_QA_PRODUCCION_TOCADO=NO
PM26_P05B_TPV_TOCADO=NO
PM26_P05B_DEFECTO_E_RESUELTO=NO
```

PM25 P02 continúa PARCIAL/BLOQUEADO. Defecto E queda PARCIAL/BLOQUEADO —
rama `release` lista, cambio de contexto en Netlify pendiente de acción
del usuario. Avisos F–H no se tratan en este paquete.

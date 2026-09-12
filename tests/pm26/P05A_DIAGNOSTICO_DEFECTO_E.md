# PM26 P05a — Diagnóstico de solo lectura del defecto E

## Estado

**Solo lectura. No se aplicó ningún cambio.** Este paquete documenta el
flujo real de publicación a producción y presenta las opciones técnicas
para separarlo de la integración en `main`, sin aplicar ninguna. Ninguna
configuración de Netlify fue modificada para producir este documento. No
se toca `main`, Supabase, QA, producción ni TPV. No se mezclan aquí los
avisos F–H.

---

## 1. Qué es el defecto E

Registrado en `tests/pm26/P01_INVENTARIO_DIAGNOSTICO.md` (sección 10 y
tabla de defectos, fila E):

> Publicación a producción acoplada automáticamente a cada push/merge a
> `main`, sin aprobación manual intermedia.

Severidad allí asignada: *"Ya registrada y ya mitigada operativamente
(congelación de `main` decidida por el usuario); pendiente de decisión
sobre la propuesta técnica siguiente."*

A diferencia de los defectos B, C y D, este no es un archivo del
repositorio: es una configuración de la plataforma Netlify. Ningún commit
puede "cerrarlo" — cualquier corrección real cambia configuración de
despliegue, lo que exige autorización específica y explícita del usuario
antes de aplicarse (regla permanente del proyecto sobre producción).

## 2. Reverificación en vivo de la configuración real (solo lectura)

Herramienta usada: `mcp__Netlify__netlify-project-services-reader`,
operación `get-project` sobre el sitio ya conocido en el repositorio
(su nombre y URL pública ya aparecen, sin ser secretos, en
`reset-pruebas-preview.js` y en varios workflows/documentos existentes,
donde se usan para distinguir producción de Deploy Preview por
`hostname`). Ninguna operación de escritura (`netlify-project-services-updater`
u otra) fue invocada.

Hechos confirmados en vivo en esta ronda (coinciden con los ya
registrados en P01, sin cambios desde entonces):

- Plan del sitio: `nf_team_dev`.
- `requiresSSOTeamLogin`: `true`, con alcance
  `"non_production"` — es decir, los contextos que **no** son producción
  (Deploy Previews, branch deploys) ya exigen inicio de sesión SSO del
  equipo Netlify para verse; el contexto `production` **no** tiene esa
  exigencia y es visible públicamente sin autenticación.
- `requiresPassword`: `false` — ningún contexto, incluida producción,
  tiene protección por contraseña.
- Despliegue actual: `state: "current"`, `currentDeploy.state: "ready"`
  — no hay ningún despliegue en curso ni fallido en este momento.
- No existe `netlify.toml` en el repositorio (reconfirmado por
  inspección del árbol) que module contextos de rama o reglas de
  publicación.

**Hecho nuevo respecto a P01** (no estaba explícitamente contrastado
antes): la exigencia de SSO ya presente para los contextos no-producción
significa que un Deploy Preview de una rama de trabajo (`claude/...`) ya
está protegido de acceso público — el problema del defecto E es
exclusivamente que `main` publica directamente al contexto `production`,
que es el único sin esa barrera, y no hay ningún paso adicional entre
"push a `main`" y "visible públicamente sin autenticación".

## 3. Flujo de publicación actual, paso a paso

1. Un commit llega a la rama `main` del repositorio (push o merge).
2. Netlify detecta el push vía su integración con GitHub (sin archivo
   `netlify.toml`, la configuración de "rama de producción" vive
   exclusivamente en el panel del sitio, no versionada).
3. Se dispara automáticamente un build y despliegue al contexto
   `production` del sitio `chic-entremet-9107cf`.
4. El despliegue queda publicado en la URL pública primaria
   (`chic-entremet-9107cf.netlify.app`) sin ningún paso de aprobación
   manual ni ventana de espera entre el build y la publicación.
5. No existen variables de entorno configuradas en el sitio (0, ya
   confirmado en P01 punto 2) que puedan condicionar o bloquear ese
   despliegue.

No hay, en ningún punto de este flujo, un paso que un humano deba
aprobar explícitamente antes de que el contenido quede público.

## 4. Opciones técnicas (ninguna aplicada)

### Opción 1 — Rama de contexto de producción dedicada

Cambiar en la configuración del sitio Netlify la rama de contexto
`production` de `main` a una rama nueva dedicada (p. ej. `release`).
`main` sigue siendo la única rama de integración (como ya exige el
usuario) pero deja de publicar por sí sola. Publicar pasa a requerir un
paso explícito y separado: fusionar (fast-forward o merge) el commit ya
validado de `main` hacia `release`, cada vez con autorización específica
del usuario para *esa publicación concreta* — no para la fusión a
`main`.

- **Disponibilidad**: los contextos de rama son una función estándar de
  Netlify disponible en cualquier plan, incluido `nf_team_dev` — no
  depende de ninguna característica adicional no confirmada.
- **Riesgo principal**: si se olvida promover `release`, producción
  queda desactualizada respecto a `main` de forma silenciosa si nadie lo
  vigila; necesitaría un aviso o comprobación periódica.
- **Reversión**: trivial — devolver la rama de contexto `production` a
  `main` en la configuración del sitio. Sin migración de datos ni cambio
  de esquema.

### Opción 2 — Aprobación manual de despliegue sobre `main`

Mantener `main → production` pero exigir aprobación manual antes de que
el build se publique (si el plan del sitio lo soporta). **No confirmado
en esta ronda**: la lectura de solo lectura disponible
(`netlify-project-services-reader`) no expone si `nf_team_dev` incluye
esta función; requeriría o bien una comprobación adicional (que podría
no ser posible solo con herramientas de lectura) o confirmarlo
directamente en el panel de Netlify antes de poder elegir esta opción
con la misma certeza que la Opción 1.
- **Riesgo principal**: un despliegue mal aprobado (aprobar por error)
  sigue siendo posible — el mecanismo separa la decisión, no la elimina
  como fuente de error humano; y su disponibilidad real en este plan
  queda pendiente de confirmar.
- **Reversión**: si existe, previsiblemente tan trivial como desactivar
  la exigencia de aprobación en la configuración del sitio.

### Opción 3 — Combinación

Aplicar la Opción 1 (rama `release` dedicada) y, si se confirma que el
plan la soporta, añadir además la aprobación manual de la Opción 2 sobre
la propia rama `release`, como segunda barrera. Estrictamente opcional
y no necesaria para resolver el defecto E — lo resuelve ya la Opción 1
por sí sola.

## 5. Lectura preliminar (sin decidir nada)

La Opción 1 es la única de las tres cuya disponibilidad está confirmada
sin ninguna duda en el plan actual del sitio, y es la que exige el
cambio de configuración más pequeño y más fácil de revertir (una única
rama de contexto). La Opción 2 podría ser preferible si se confirma que
el plan la soporta, porque no requiere que nadie recuerde promover una
rama — pero esa confirmación no se ha hecho todavía. Esta lectura es
preliminar y no sustituye una decisión del usuario.

## 6. Qué tocaría una eventual P05b, y qué necesitaría antes de tocarlo

- El único cambio real es de **configuración de la plataforma Netlify**
  (contexto de producción del sitio, y opcionalmente una regla de
  aprobación) — ningún archivo del repositorio necesita cambiar para la
  Opción 1. Si se quisiera además versionar esa decisión, cabría añadir
  un `netlify.toml` documentando el contexto `release`, pero no es
  necesario para que el mecanismo funcione (Netlify no exige que la
  rama de contexto esté en `netlify.toml`).
- Antes de ejecutar cualquier cambio real: autorización específica y
  explícita del usuario que nombre exactamente el ajuste a cambiar (por
  ejemplo: "cambia la rama de contexto `production` de `main` a
  `release`"), no una autorización genérica de "aplica la opción que
  prefieras".
- Inmediatamente después de aplicar el cambio: una ventana de
  verificación de solo lectura confirmando que el primer despliegue en
  el nuevo contexto coincide exactamente con el commit esperado, antes
  de considerar el defecto E cerrado.

## Qué NO se hizo

- No se cambió ninguna configuración de Netlify (rama de contexto,
  aprobación manual, SSO, contraseña, variables de entorno).
- No se creó ni se modificó ningún `netlify.toml`.
- No se tocó `main`, ni se hizo push a `main`.
- No se tocó Supabase, QA, producción como datos, ni TPV.
- No se aplicó ninguna de las tres opciones.
- No se mezclaron aquí los avisos F–H.

```
PM26_P05A_ESTADO=DIAGNOSTICO_SOLO_LECTURA_COMPLETO
PM26_P05A_CAMBIOS_APLICADOS=NO
PM26_P05A_NETLIFY_MODIFICADO=NO
PM26_P05A_NETLIFY_TOML_CREADO=NO
PM26_P05A_MAIN_TOCADO=NO
PM26_P05A_SUPABASE_QA_PRODUCCION_TOCADO=NO
PM26_P05A_TPV_TOCADO=NO
PM26_P05A_OPCION_ELEGIDA=NINGUNA_PENDIENTE_DE_DECISION_DEL_USUARIO
```

PM25 P02 continúa PARCIAL/BLOQUEADO. Defecto E sigue sin corregir —
pendiente de que el usuario autorice P05b y nombre la opción exacta.
Avisos F–H no se tratan en este paquete.

# PM26 P06b — Corrección del aviso G (protección de contraseñas filtradas)

## Estado

**Corrección de diagnóstico. Ningún cambio aplicado, ninguna facturación
generada.** `tests/pm26/P06A_DIAGNOSTICO_AVISOS_FGH.md` (sección 4)
explicó el bloqueo del aviso G únicamente como ausencia de una
herramienta de escritura para la configuración de Auth. Esa causa es
real pero incompleta: el usuario indicó que la protección de
contraseñas filtradas (HaveIBeenPwned) solo está disponible en
Supabase Pro o superior, y la organización actual está en el plan
Free. Esta ronda verifica ese dato de forma independiente.

## Verificación en vivo

`mcp__Supabase__get_organization` sobre la organización del proyecto
(la misma que contiene `L&A Suite`, `L&A Suite QA` y `TPV`) devuelve
`"plan":"free"`. Confirmado: la organización está en el plan Free, tal
como indicó el usuario.

La combinación de ambos hechos —el plan actual no incluye esta función,
y ninguna herramienta de escritura disponible en esta sesión expone la
configuración de Auth de todos modos— hace irrelevante en la práctica
cuál de las dos causas se resuelva primero: aunque existiera la
herramienta, el ajuste no se podría activar en un proyecto Free.

## Corrección del estado del aviso G

- **No se pide al usuario activarlo en el panel** — hoy no es posible
  hacerlo, esté donde esté el ajuste, porque el plan no lo incluye.
- **No se cambia el plan de la organización ni se genera ninguna
  facturación.** No se llamó a ninguna herramienta de escritura sobre
  el plan, la organización ni la facturación.
- **No se sustituye este control por ningún otro** declarándolo
  equivalente. La verificación de contraseñas filtradas
  (HaveIBeenPwned) no tiene un sustituto funcionalmente equivalente
  dentro del proyecto; no se propone ninguno.

## Qué NO se hizo

- No se cambió el plan de la organización.
- No se generó ninguna facturación ni se llamó a ninguna herramienta de
  creación de proyecto o branch.
- No se activó ni se intentó activar la protección de contraseñas
  filtradas.
- No se tocó producción, TPV, ni `main`.

```
PM26_P06B_AVISO_G_ESTADO=BLOQUEADO_POR_PLAN
PM26_P06B_AVISO_G_PLAN_ORGANIZACION_VERIFICADO=free
PM26_P06B_AVISO_G_CAMBIO_DE_PLAN_APLICADO=NO
PM26_P06B_AVISO_G_FACTURACION_GENERADA=NO
PM26_P06B_AVISO_G_CONTROL_SUSTITUTO_DECLARADO_EQUIVALENTE=NO
PM26_P06B_AVISO_G_ACTIVABLE_HOY=NO
```

Podrá activarse únicamente tras una decisión separada de actualizar el
plan de la organización (Free → Pro o superior), decisión que esta
sesión no toma por sí sola y que requeriría su propia autorización
explícita del usuario, al implicar facturación real.

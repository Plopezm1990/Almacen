# PM17 P01 — Lote 1: rollback nativo de suscripción push

Primer lote de PM17 (Integrar seguridad y notificaciones), según la matriz propuesta en
`docs/plan-maestro/PM17_DIAGNOSTICO_PARCHES.md` (punto 6) y el alcance literal pedido:
"Portar después únicamente lo que falte, en lotes pequeños con pruebas específicas."

## Diagnóstico (confirmado en el turno anterior)

`Notificaciones.activar()` creaba la suscripción push del navegador (`pushManager.subscribe`)
**antes** de dar de alta el endpoint en `suscripciones_push`. Si ese alta fallaba
(`errInsert`), el código simplemente hacía `throw` sin deshacer la suscripción ya creada —
dejaba un "activado" falso en el navegador sin fila real en Supabase.

Ese hueco ya lo cubría `seleccion-neutral-patch.js` (envoltura global de
`PushManager.prototype.subscribe`/`PushSubscription.prototype.unsubscribe`, con
verificación por temporizador a 45s), pero es un archivo externo cargado por red en
runtime, con ventana de carrera frente al montaje de React y sin ningún aviso si falla en
desplegarse (ver diagnóstico completo). Este lote **no toca ni retira ese parche** — solo
añade la protección directamente en el código nativo, que es donde realmente se decide el
flujo (alcance de "portar lo que falte" del punto 4, no del punto 4 completo: aquí solo el
lote 1 de 3).

## Solución

- **`activarSuscripcionPushPM17({ suscribir, guardarSuscripcion, deshacerSuscripcion })`**
  (función nueva, con inyección de las tres operaciones para que sea comprobable de forma
  aislada, sin red real ni Service Worker real): crea la suscripción, intenta guardarla: si
  falla, deshace la suscripción recién creada y vuelve a lanzar el error original (nunca lo
  oculta, ni siquiera si el propio deshacer también falla) — si guardar funciona, nunca
  deshace nada.
- **`Notificaciones.activar()`** ahora delega en ese helper: `suscribir` sigue siendo
  `registro.pushManager.subscribe(...)` (idéntico a antes), `guardarSuscripcion` sigue
  siendo el mismo `upsert` a `suscripciones_push` (idéntico a antes, mismo payload),
  `deshacerSuscripcion` es `suscripcion.unsubscribe()` real del navegador. `desactivar()`
  no se toca — ya borraba primero en Supabase y desuscribía después, orden correcto.
- Convivencia con el parche externo: mientras `seleccion-neutral-patch.js` siga cargando
  (todavía no se retira en este lote), su envoltura de `PushManager.prototype.subscribe`/
  `unsubscribe` sigue activa por debajo — puede producir una verificación adicional
  redundante (una segunda comprobación contra Supabase al desuscribir), pero no un
  conflicto: ambas capas cooperan sin ocultarse errores entre sí. Se revisará al retirar el
  parche (lote 4 de la matriz).

## Archivos

- `fuente.js`: `activarSuscripcionPushPM17` (nueva, antes de `Notificaciones`);
  `Notificaciones.activar()` reescrita para delegar en ella. `desactivar()` sin cambios.
- `tests/pm17/p01-rollback-push-nativo-contract.mjs` (nuevo): positivo (alta correcta, sin
  rollback innecesario), negativo (alta falla, rollback con la suscripción exacta y error
  original propagado), negativo/replay (el propio rollback también falla, no oculta el
  error original), replay (dos intentos seguidos sin estado compartido entre ellos).
- `tests/pm17/p01-wiring-notificaciones-contract.mjs` (nuevo): confirma por inspección
  estática que `activar()` realmente usa el helper (no quedó la llamada directa antigua sin
  protección).

## Regresión

Suite completa: `tests/g1`, `pm04`, `pm05`, `pm07`, `pm08`, `pm09`, `pm10`,
`pm11-compra`, `pm12`, `pm13`, `pm14`, `pm15`, `pm16`, `pm17` — 86/86 sin regresiones.

## Estado de main/producción

`main` = `5db0b9ed03c8f8ecd700ff339edce1dff14ffde4` (release consolidado hasta PM16), sin
tocar directamente — este trabajo vive en `claude/pm17-seguridad-notificaciones`. Sin
migraciones nuevas (cambio de frontend puro). No se ha activado ningún envío real de
notificación ni se ha retirado ninguna función productiva. `L&A Suite` (producción) y
`TPV` no se han tocado.

## Pendiente (matriz completa en `docs/plan-maestro/PM17_DIAGNOSTICO_PARCHES.md`)

- Lote 2: portar la neutralización de Prefiltros/Entrevistas de forma nativa.
- Lote 3: portar auth UX (olvidar contraseña, logout Propietario) de forma nativa.
- Lote 4: retirar `seleccion-neutral-patch.js`/`auth-ux-patch.js` solo cuando 1-3 estén
  cerrados y verdes en remoto.
- NR-03/NR-04: seguimos sin su texto literal en el repo para contrastarlos contra este
  inventario.

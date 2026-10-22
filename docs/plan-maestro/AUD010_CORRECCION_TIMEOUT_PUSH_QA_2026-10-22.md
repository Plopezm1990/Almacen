# Plan Maestro L&A Suite — AUD-010 — Corrección de timeout push en QA

Fecha: 22/10/2026  
Entorno: QA (`qjqorixtkilwsndqayyx`)  
Función: `enviar-notificacion`  
Versión desplegada: 5

## Diagnóstico

Las llamadas con credenciales y alcance válidos llegaban a la fase de entrega a
Web Push, pero una entrega que no respondía mantenía abierta la Edge Function
hasta que la plataforma la terminaba con `EarlyDrop`. Las comprobaciones
negativas de autenticación, perfil, membresía y alcance seguían respondiendo,
por lo que el bloqueo no procedía de RLS ni de la autorización del tenant.

## Cambio aplicado

- Cada destinatario se envía de forma independiente y en paralelo.
- Cada entrega tiene un límite de espera de 12 segundos.
- Un timeout no bloquea al resto de destinatarios.
- La respuesta informa `enviados`, `caducados`, `errores` y `timeouts`.
- Si existe un fallo de proveedor, la función devuelve `ok: false` con HTTP 502.
- Las respuestas 404/410 siguen retirando únicamente las suscripciones caducadas.
- No se añadió reintento automático, para evitar duplicar avisos.

## Verificación

- Contrato nuevo: `tests/pm17/p05-edge-push-timeout-contract.mjs` — PASS.
- Contratos PM17 existentes P01–P04 — PASS.
- Lectura posterior del despliegue — PASS: versión 5 activa, `verify_jwt=false`,
  helper de timeout y respuesta observable presentes.
- No se ejecutó todavía un envío controlado de notificación; por tanto, la
  entrega real a un dispositivo queda pendiente de la prueba de aceptación.

## Límites

- Solo QA.
- No se modificaron RLS, grants, migraciones ni datos mediante SQL.
- No se tocó PROD.
- AUD-010 no se cierra aún: falta comprobar un envío controlado y observar una
  respuesta finita tanto en el caso normal como ante un proveedor que no responda.

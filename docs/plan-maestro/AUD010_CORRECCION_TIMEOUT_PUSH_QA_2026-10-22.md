# Plan Maestro L&A Suite — AUD-010 — Corrección de timeout push en QA

Fecha: 22/10/2026  
Entorno: QA (`qjqorixtkilwsndqayyx`)  
Función: `enviar-notificacion`  
Versión desplegada: 6

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
- Lectura posterior del despliegue — PASS: versión 6 activa, `verify_jwt=false`,
  helper de timeout y respuesta observable presentes.
- Despliegue QA del preview 172 — PASS: el build de Netlify quedó publicado con
  el commit `ff91046` en `codex/stage1-aud009-aud003`.
- Envío controlado desde `Más → Notificaciones` — PASS: sesión autenticada en
  `QA Empresa A, S.L. · Local A1`; resultado visible `1/1 destinatario(s), 0
  timeout(s)`.
- No se crearon ventas, cobros, movimientos, fixtures ni migraciones para la
  prueba. El aviso fue exclusivamente de tipo `Error en el programa` y el
  payload de prueba quedó restringido a QA mediante `aud010Prueba=true`.

## Límites

- Solo QA.
- No se modificaron RLS, grants, migraciones ni datos mediante SQL.
- No se tocó PROD.
- El caso normal de entrega real queda aceptado. La ruta de timeout queda
  cubierta por el contrato automatizado y por el límite de 12 segundos del
  helper; no se provocó deliberadamente una caída externa del proveedor para
  no generar una incidencia artificial ni duplicar avisos.

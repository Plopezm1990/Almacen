# AUD-010 · auditoría QA de notificaciones y membresías

Fecha: 2026-10-22  
Entorno: Supabase QA `qjqorixtkilwsndqayyx` · preview 172  
Estado: AUDITADO_QA; FUNCION_V2_ACTIVA; SUSCRIPCION_QA_PASS; BLOQUEADO_POR_CONFIGURACION_VAPID_QA; SIN_CAMBIOS_APLICADOS

## Alcance autorizado

Se autorizó la revisión de la Edge Function de notificaciones, sus membresías
y permisos. La ejecución quedó limitada a QA y a comprobaciones de lectura o
llamadas negativas. No se enviaron notificaciones reales, no se hicieron
migraciones, no se cambiaron grants/RLS/funciones y no se consultó PROD.

## Comprobaciones de la función

- `enviar-notificacion` está activa en QA, versión 2, con `verify_jwt=false`.
  La función implementa autenticación propia: valida el Bearer con
  `admin.auth.getUser`, exige perfil activo y exige al menos una membresía
  activa.
- La función usa `SUPABASE_SERVICE_ROLE_KEY` únicamente dentro de la Edge
  Function para leer perfiles, membresías y suscripciones; no se expone al
  navegador.
- El filtro de destinatarios comprueba perfil activo, empresa, local,
  `todos_locales` y rol mediante `supabase/functions/_shared/tenant-scope.js`.
- Un `empresaId` contradictorio con el local falla cerrado.
- Los avisos con local requieren un local concreto y activo.

## Pruebas negativas en vivo

Todas se ejecutaron contra el endpoint QA sin provocar envío push:

| Caso | Resultado |
|---|---|
| POST sin Authorization | `401` · `Debes iniciar sesión.` |
| `empresaId=QA-EMP-B` con `localId=QA-A1` | `403` · `El local no pertenece a la empresa indicada.` |
| Empresa fuera de las membresías (`QA-EMP-NOACCESS`) | `403` · `No tienes alcance sobre la empresa/local de esta notificación.` |
| Sesión válida sin empresa determinable | `400` · `No se puede determinar una empresa única para la notificación.` |

El endpoint registró las llamadas negativas en `function_edge_logs` con la
versión 2 y respuestas `400`; no se observó envío ni borrado de suscripciones.

## Estado de QA que explica el bloqueo

- Las tablas `perfiles`, `membresias_usuario`, `suscripciones_push` y `locales`
  tienen RLS activo.
- La política de membresías permite a un usuario autenticado leer únicamente
  sus membresías activas.
- Las políticas de `suscripciones_push` limitan lectura, alta, actualización
  y baja al propio usuario con perfil activo y contraseña inicial resuelta.
- QA tiene 20 perfiles activos y una sola suscripción push identificada.
- La sesión autenticada usada en la prueba tiene cero suscripciones push.
- El cálculo de destinatarios para `QA-EMP-A · QA-A1` devuelve cero tanto para
  propietarios como para los roles de `Stock bajo`.
- Los locales de QA-EMP-B están inactivos, por lo que no sirven como destino
  positivo de notificación.

Conclusión: el síntoma «no llegan las notificaciones» queda reproducido por
ausencia de suscripción push del usuario destinatario en QA. En esta pasada no
se reproduce un fallo de lectura de membresías ni una fuga entre empresas.

## Reintento autorizado del 22/10/2026

Se abrió el flujo normal `Más → Notificaciones → Activar en este dispositivo`
en la sesión autenticada de `QA-EMP-A · QA-A1`. La aplicación mostró
`Un momento…`, pero el navegador integrado de ChatGPT no presentó el diálogo
de permiso y la promesa de `Notification.requestPermission()` quedó pendiente.
La comprobación técnica posterior confirmó: `Notification.permission=default`,
Service Worker registrado, Push disponible y suscripción inexistente. No se
envió el aviso controlado porque no había destinatario push confirmado.

No se modificó la base de datos por vías directas, no se cambió el permiso del
navegador mediante herramientas externas y no se tocó PROD. Para cerrar
AUD-010 falta repetir exactamente este flujo en un navegador que permita
resolver el permiso de notificaciones para el preview QA; después se podrá
enviar una única notificación controlada y verificar `destinatarios=1`.

## Corrección del alta y reintento en preview 172

Se corrigió el cliente para obtener `supabase.auth.getUser()` y enviar
`user_id` junto con la suscripción. La corrección quedó en `fuente.js` y en
`source-recovery/fuente-recuperado.js`, con contrato PM17 actualizado. Commit:
`cafcdac fix(qa): associate push subscriptions with auth user`.

Tras el despliegue del preview 172, el flujo normal mostró `Activadas en este
dispositivo`. La lectura autenticada de QA confirmó una suscripción propia y
la comprobación agregada confirmó dos suscripciones totales, ambas con usuario,
una asociada a `QA-A1`.

Se intentó una única notificación controlada:
`Stock bajo` · `QA-AUD010-CONTROLADO-20261022` · `QA-EMP-A` · `QA-A1`.
La Edge Function respondió HTTP 500 con `Notificaciones push no configuradas.`
El envío no llegó a la fase de destinatarios porque QA no tiene configuradas
`VAPID_PUBLIC_KEY` y/o `VAPID_PRIVATE_KEY`. No se envió ninguna notificación.

Conclusión actual: el alta de suscripción y el RLS quedan corregidos y
verificados; AUD-010 sigue abierto hasta configurar las claves VAPID únicamente
en QA y repetir el envío controlado. No se deben relajar políticas ni insertar
suscripciones manualmente.

## Verificación local

El contrato existente pasó:

```text
P01_PM17_ACTIVAR_USA_HELPER_CON_ROLLBACK=PASS
PM17 P01 (wiring nativo) — Notificaciones.activar() conectado al rollback: contrato OK
```

## Decisión y siguiente prueba

No se justifica cambiar todavía la Edge Function, RLS ni grants. La siguiente
prueba segura es activar una suscripción push real desde la sesión QA mediante
el flujo normal del navegador y repetir un aviso controlado para un destinatario
de QA-EMP-A/QA-A1. Esa prueba sí generará una notificación y debe autorizarse o
confirmarse justo antes de ejecutarla.

AUD-010 queda `BLOQUEADO_POR_FIXTURE_DE_SUSCRIPCION`, no por un error demostrado
de membresías. PROD permanece fuera de alcance.

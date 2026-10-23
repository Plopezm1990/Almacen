# AUD-010 · auditoría QA de notificaciones y membresías

Fecha: 2026-10-22  
Entorno: Supabase QA `qjqorixtkilwsndqayyx` · preview 172  
Estado: AUDITADO_QA; FUNCION_V2_ACTIVA; SUSCRIPCION_QA_PASS; VAPID_QA_CONFIGURADO; BLOQUEADO_ENTREGA_PUSH; SIN_PROD

## Alcance autorizado

Se autorizó la revisión de la Edge Function de notificaciones, sus membresías
y permisos. La ejecución quedó limitada a QA. No se hicieron migraciones, no
se cambiaron grants/RLS/funciones y no se consultó PROD. Tras la autorización
expresa posterior se configuraron secretos VAPID únicamente en QA y se intentó
un único envío controlado; su entrega no quedó confirmada porque la función no
devolvió respuesta.

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

## Corrección del alta, configuración VAPID y reintento en preview 172

Se corrigió el cliente para obtener `supabase.auth.getUser()` y enviar
`user_id` junto con la suscripción. La corrección quedó en `fuente.js` y en
`source-recovery/fuente-recuperado.js`, con contrato PM17 actualizado. Commit:
`cafcdac fix(qa): associate push subscriptions with auth user`.

Tras el despliegue del preview 172, el flujo normal mostró `Activadas en este
dispositivo`. La lectura autenticada de QA confirmó una suscripción propia y
la comprobación agregada confirmó dos suscripciones totales, ambas con usuario,
una asociada a `QA-A1`.

Se intentó una primera notificación controlada:
`Stock bajo` · `QA-AUD010-CONTROLADO-20261022` · `QA-EMP-A` · `QA-A1`.
La Edge Function respondió HTTP 500 con `Notificaciones push no configuradas.`
El envío no llegó a la fase de destinatarios porque QA no tiene configuradas
`VAPID_PUBLIC_KEY` y/o `VAPID_PRIVATE_KEY`. No se envió ninguna notificación.

Con autorización expresa, se generó una pareja VAPID nueva y se guardó mediante
la CLI oficial en los secretos del proyecto Supabase QA. La clave pública
coincidente se actualizó en `fuente.js` y
`source-recovery/fuente-recuperado.js`; no se registró ninguna clave privada en
el repositorio ni en esta hoja. Se corrigió además el formato base64url del
punto público antes de publicar el preview 172.

La suscripción anterior se desactivó desde la interfaz y se volvió a activar
desde `Más → Notificaciones`, ya con la clave pública correcta. La pantalla
mostró `Activadas en este dispositivo` y no se hizo ninguna inserción manual.

Se realizó un único reintento controlado posterior a la configuración VAPID,
con el mismo payload QA. La Edge Function arrancó en la versión configurada,
pero la llamada desde el navegador quedó esperando a `webpush.sendNotification`
y terminó por tiempo de espera sin devolver `ok`, `enviados` ni una respuesta
HTTP verificable. Los logs muestran el arranque de la invocación, pero no una
respuesta de entrega. Por seguridad no se repitió el envío y no se certifica
que haya llegado ninguna notificación.

Conclusión actual: el alta de suscripción, el RLS, el aislamiento y la
configuración VAPID de QA quedan corregidos y verificados; AUD-010 sigue
abierto por falta de confirmación de entrega del proveedor push. No se deben
relajar políticas, insertar suscripciones manualmente ni repetir el envío hasta
resolver el tiempo de espera de la Edge Function.

## Verificación local

El contrato existente pasó:

```text
P01_PM17_ACTIVAR_USA_HELPER_CON_ROLLBACK=PASS
PM17 P01 (wiring nativo) — Notificaciones.activar() conectado al rollback: contrato OK
```

## Decisión y siguiente prueba

La siguiente acción segura es diagnosticar el tiempo de espera de
`webpush.sendNotification` en QA (proveedor push, salida de red y timeout de la
función) y añadir una prueba técnica que deje el fallo explícito sin duplicar
envíos. No se debe volver a pulsar el aviso controlado hasta disponer de una
respuesta acotada y observable.

AUD-010 queda `BLOQUEADO_ENTREGA_PUSH`, no por un error demostrado de
membresías, RLS o configuración VAPID. PROD permanece fuera de alcance.

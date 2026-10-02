# F5 — ensayo integral controlado en QA (venta, cobro simulado, devolución, reversión, cierre)

Fecha: 2026-10-02
Entorno autorizado: Supabase QA `qjqorixtkilwsndqayyx` (solo QA)
SHA de trabajo: `a5a4321f0d05d9d952358ada81d6ee80f19f89c0`
Estado: `NO_EJECUTADO_BLOQUEADO_POR_ACCESO_A_QA`

Este documento no cierra A12, C12 ni ningún requisito. No hay resultados de
ensayo: el ensayo no se ha ejecutado.

## Qué se hizo

- Rama de trabajo limpia; avanzada por fast-forward desde `93a570b` hasta
  `a5a4321` (sin reescribir historia; `codex/f5-c03-cash-reconciliation`,
  `release` y `main` no se tocan).
- Comprobación de acceso al backend QA (ver siguiente sección).
- Lectura estática del código para orientar el aviso de `locales` (hipótesis,
  no reproducción).

No se escribió nada en QA ni en producción, no se ejecutó ningún RPC, no se
hizo deploy y no se usaron datos reales ni proveedores reales.

## Bloqueo

El conector de Supabase de esta sesión devuelve «sin permiso» para
`qjqorixtkilwsndqayyx`. El único proyecto visible es ajeno a L&A Suite y no se
ha usado. El entorno no contiene credenciales ni variables de Supabase, y no se
han buscado vías alternativas (claves embebidas, usuarios de prueba, workflows
de CI contra el backend).

Consecuencias:

- No se pudo verificar la identidad del proyecto (nombre, URL, migraciones),
  ni consultar ACL, ni preparar datos ficticios, ni ejecutar flujo alguno.
- No se creó ningún dato de prueba, por lo que **no hay limpieza pendiente**.

## Aviso de `locales` — lectura estática (no es una reproducción)

- El indicador «Subiendo N…» se calcula en `index-storage-bootstrap.js` como el
  número de claves de `localStorage["almacen__pendientes"]`.
- En `set(key, value)` el valor se guarda primero en local y después se intenta
  subir con un límite de espera. Cualquier fallo de la subida (denegación RLS,
  esquema, tiempo de espera o nube inactiva) cae en `catch (e) { marcarPendiente(key); }`
  y **no se registra el error**. La interfaz solo muestra pendientes, sin causa.
- No se localizó en el código el texto exacto del aviso de `locales`, por lo que
  no está confirmado que nazca en esta ruta.
- Hipótesis a contrastar con la respuesta real de red en QA: denegación RLS de
  la escritura de `locales` para el rol de la sesión, discrepancia de esquema,
  o tiempo de espera. Ninguna está confirmada.
- Si se confirma, la ausencia de registro del error es un defecto de
  observabilidad separado de este ensayo; su corrección requiere autorización.

## Para reanudar

1. Acceso al proyecto QA desde la sesión, restringido a ese proyecto y sin
   acceso a producción (conector de Supabase con permiso sobre QA, conectado
   antes de iniciar la sesión).
2. Para la parte de interfaz del preview: usuario de prueba de QA y acceso al
   preview privado, entregados por el canal de secretos del entorno, no por chat.

## Plan del ensayo (pendiente)

Preflight: confirmar que el proyecto es QA (referencia, URL), la presencia de
`abc_f5_pm09_security_hardening` y C04–C12, y las ACL de los cinco wrappers PM09.

Datos: identificadores con prefijo `ZZ-ENSAYO-` y, siempre que sea posible,
dentro de transacciones con `ROLLBACK`. Lo que deba persistir (interfaz) se
limpia con borrado verificado y recuentos antes/después.

Flujo con simulador: venta de carrito → cobro simulado/mixto → devolución →
reversión → cierre de sesión de caja. Tras cada paso: stock, caja, pagos y
documento.

Negativas: `anon` denegado; usuario sin capacidad; otra empresa u otro local;
mismo `operation_id` con mismo contenido (replay) y con distinto contenido
(`operation_id_conflict`); `fecha_requerida`; importe o precio manipulado;
devolución por encima de lo cobrado.

Registro por caso: entorno, SHA, usuario y rol, datos, pasos, esperado,
observado y limpieza. Sin proveedores ni emisión fiscal reales.

Límites previstos: un ensayo reducido no acredita A12 ni C12 (dos navegadores,
dispositivos, recuperación, concurrencia, medianoche y restauración quedan
fuera).

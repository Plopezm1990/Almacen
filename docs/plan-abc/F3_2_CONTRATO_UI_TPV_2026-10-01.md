# F3.2 — contrato de interfaz TPV

Fecha: 2026-10-01  
Estado: `CONTRATO_UI_PREPARADO_NO_APLICADO`  
Base: F3.1 y `origin/release` `7859508`

Este contrato define el comportamiento visible del TPV antes de modificar
componentes. La interfaz presenta el resultado del servidor y no se convierte
en autoridad económica.

## Zonas de la pantalla

| Zona | Debe mostrar | Regla |
|---|---|---|
| Contexto | empresa, local, usuario y sesión | visible antes de operar |
| Catálogo | categorías, favoritos y búsqueda | resultados del catálogo autorizado |
| Línea activa | producto, variante, cantidad y precio | editar no confirma cobro |
| Desglose | base, impuesto, descuento, total y pendiente | valores devueltos por servidor |
| Preparación | estación, estado y versión | alta distinta de reimpresión |
| Cobro | medios, estado e incidencia | desconocido no se presenta como rechazado |
| Conexión | online, reconectando, offline y última sincronización | estado visible y comprensible |
| Acciones | confirmar, cancelar, devolver y resolver | habilitadas según permiso y estado |

## Interacciones obligatorias

- Buscar por texto, categoría y código sin perder la cuenta actual.
- Añadir dos variantes del mismo producto como líneas distinguibles.
- Editar cantidad, suplemento y nota con confirmación clara.
- Mostrar foco de teclado y controles táctiles con tamaño suficiente.
- Adaptar la cuenta a móvil/tableta sin ocultar total, estado o contexto.
- Confirmar acciones destructivas con motivo cuando corresponda.
- Evitar que abrir pantalla, volver atrás, recargar o pulsar dos veces confirme.
- Deshabilitar temporalmente una acción mientras su `operation_id` está en vuelo.
- Mostrar conflicto de versión con opción de recargar/revisar, no sobrescribir.

## Estados visibles

| Estado | Mensaje mínimo | Acción permitida |
|---|---|---|
| `PENDIENTE` | procesando, no repetir | esperar/consultar |
| `DESCONOCIDO` | resultado por confirmar | consultar incidencia |
| `CONFLICTO_VERSION` | otra sesión cambió la cuenta | revisar y recargar |
| `DENEGADO` | operación no autorizada | volver sin mutar |
| `RECHAZADO` | operación rechazada | corregir o cancelar |
| `ERROR_REINTENTABLE` | no confirmado | reintentar con el mismo ID |

La interfaz no muestra datos sensibles del proveedor ni solicita PAN/CVV. Las
credenciales y secretos permanecen fuera del navegador.

## Criterios de aceptación F3.2

1. Una persona localiza y añade un producto sin perder contexto ni cuenta.
2. Dos variantes se distinguen y conservan su precio histórico.
3. El total visible coincide con la respuesta autorizada del servidor.
4. Doble clic, volver atrás y recarga no crean cobro ni línea duplicada.
5. Conflicto, denegación, desconexión y resultado desconocido son comprensibles.
6. El recorrido funciona en los dispositivos definidos por el piloto.

## Resultado de F3.2

La interfaz TPV queda especificada para implementar A02/A03 sin tocar todavía
fuente publicada, base de datos, proveedor, merge ni deploy de Netlify.

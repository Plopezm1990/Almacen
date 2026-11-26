# Lote L4 · unir cuentas y repartir productos como Propietario · 26/11/2026

Autorizado por el usuario («Autorizo» y la aportación de las credenciales de la cuenta de
pruebas de QA `pm07.smoke@qa.invalid` y de su código de segundo factor para entrar). Actor:
Propietario con `aal2`, QA-EMP-A / QA-A1. Sin producción, sin `sis-13`, sin cambios de
configuración ni de permisos, sin llamadas a funciones de QA desde la consola. **La contraseña y
el código no se guardaron en ningún documento**; el usuario los escribió en la conversación.

## Cambios respecto del lote presentado

- Autorizado: enviar 1 pedido (1 agua). Se envió 1. Abrir y cerrar la caja se hizo como en los
  lotes anteriores, porque la sesión del L3 estaba cerrada y sin sesión el servidor no deja operar.
- **Descuento del Propietario: no se pudo probar.** El panel responde «La cuenta no tiene líneas
  aptas para aplicar el descuento»: la única línea apta (la enviada) había pasado por la unión y
  el reparto a otras cuentas, y la unidad de stock autorizada ya estaba usada.
- **Revertir el reparto: no se probó**, porque la opción está en la cuenta destino y esa cuenta
  (con el pedido cancelado en el L3) no se puede retomar.

## Línea de tiempo (UTC, 26/11)

| Hora | Acción | Resultado en servidor |
|---|---|---|
| 06:28 | Abrir caja con fondo 0,00 € | `4b1f2fc2-83d1-4512-9383-7f4b546e603d` ABIERTA |
| 06:2x | Cuenta X: 1 agua, guardar y enviar | Cuenta `40238d58…`, pedido `fdff2f62…` ENVIADO; stock del agua 69 → 68 |
| 06:2x | Retomar una cuenta vacía (pedido cancelado en el L3) | No queda activa: «Retomar» no tiene efecto (H-42) |
| 06:29 | Cuenta Y: 1 agua guardada sin enviar | `1e2cb925…`, pedido `2236fcbc…` ABIERTO, línea BORRADOR |
| 06:30 | Unir X en Y con X enviada y sin servir | Rechazado: «La cuenta que se funde tiene productos a medias en cocina. Espera a que se sirvan o cancélalos antes de unir» |
| 06:31 | Servir X (iniciar, preparada, servir) | Pedido SERVIDO |
| 06:32 | Unir X en Y | «Cuentas unidas. Barra se ha cerrado y sus productos están ahora en esta cuenta»; X CERRADA |
| 06:32 | Repartir 1 unidad de Y a la cuenta B con comensal «Comensal 1» | «Producto repartido correctamente»; reparto ACTIVO en B (`7b6e21ad…`) |
| 06:33 | Unir B en Y | «Cuentas unidas»; B CERRADA; Y recupera el reparto ACTIVO |
| 06:34 | Descuento del 10 % en Y | «La cuenta no tiene líneas aptas para aplicar el descuento»; ninguna fila nueva (H-43) |
| 06:35 | Cancelar el pedido de Y | Pedido CANCELADO; la cuenta Y sigue ABIERTA con el reparto ACTIVO de 1,00 € |
| 06:36 | Iniciar cierre, contado 0,00 € (esperado 0,00 €), provisional y finalizar | Sesión **CERRADA_FINAL** |

## Antes y después (QA-EMP-A / QA-A1)

| Dato | Antes (06:28 UTC) | Después (06:36 UTC) | Diferencia |
|---|---|---|---|
| `pagos` / `checkouts` / `reembolsos` | 82 / 72 / 11 | 82 / 72 / 11 | 0 |
| `caja_operaciones` | 86 | 86 | 0 (la sesión no tuvo movimientos) |
| `pedidos_tpv` / `cuentas_comerciales` | 125 / 125 | 127 / 127 | +2 |
| Cuentas abiertas | 86 | 86 | +2 nuevas (X, Y) y −2 cerradas (X, B) |
| Descuentos aplicados / autorizaciones | 6 / 3 | 6 / 3 | 0 |
| Repartos nuevos | — | 2 | 1 cerrado y 1 activo |
| Stock del agua QA-A1 (almacén / piso) | 69 / 0 | 68 / 0 | −1 |
| `productos` en `almacen_kv` | 21/11 20:22 | 21/11 20:22 | sin cambios |
| Sesiones de caja abiertas en A1 | 0 | 0 | 0 |

El «Subiendo 1…» que apareció al iniciar sesión (el pendiente local de `productos`) **no cambió el
servidor**: `almacen_kv.productos` conserva su última actualización del 21/11.

## Resultado

- **Unir cuentas (F-07): PASS.** Con reglas correctas y mensajes claros: la cuenta que se funde
  no puede tener un pedido sin enviar ni productos a medias en cocina; solo se ofrecen cuentas
  del mismo día; el aviso dice que la unión no se deshace desde ahí.
- **Repartir productos (F-07): PASS.** Mueve la cantidad elegida a otra cuenta con comensal y
  recarga ambas desde el servidor.
- **Descuento del Propietario (F-12): NO CONCLUYENTE** (H-43).
- **Revertir un reparto: NO PROBADO.**

## Reservas

- X y Y son cuentas de una sola unidad de agua, así que las pruebas de unión y reparto no cubren
  cantidades mayores, descuentos previos ni comensales.
- La cuenta Y queda ABIERTA con un reparto de 1,00 € sin cobrar. No se cobró para no salir de
  lo autorizado (sin pagos ni reembolsos).
- El Propietario sigue con la sesión abierta en el navegador de la auditoría.

# Matriz de permisos por rol en vivo · 26/11/2026

Autorizado por el usuario («te autorizo a crear las cuentas necesarias para que termines la
auditoría»). Entorno: Deploy Preview #225 apuntando a QA `qjqorixtkilwsndqayyx`, QA-EMP-A /
QA-A1. Sin producción, sin `sis-13`. **Ninguna contraseña, código ni token se guardó en este
documento, en archivos, en capturas ni en el chat**: las contraseñas se generaron al azar
dentro de la página y solo existieron en la sesión de esa pestaña.

## Cuentas creadas en QA (autorizadas)

Se crearon desde la propia aplicación (Equipo → Nuevo empleado y «Crear cuenta de acceso»), que
es también un recorrido de la auditoría.

| Empleado | Correo | Rol de la cuenta | Local | Comprobado en el servidor |
|---|---|---|---|---|
| QA Auditoria Encargado 20261125 | `qa-aud-encargado-20261125@qa.invalid` | Encargado | QA-A1 | `auth.users` y `membresias_usuario` activa |
| QA Auditoria Cajero 20261125 | `qa-aud-cajero-20261125@qa.invalid` | Cajero/a | QA-A1 | ídem |
| QA Auditoria Camarero 20261125 | `qa-aud-camarero-20261125@qa.invalid` | Camarero/a | QA-A1 | ídem |

Las tres cuentas pueden desactivarse desde Equipo cuando ya no hagan falta.

## 1. Capacidades efectivas por rol en QA-A1 (SERVIDOR)

Obtenidas con `private.abc_cap_efectiva` para cada capacidad del catálogo, incluidas las
excepciones guardadas en `abc_capacidades_rol`. «Sí» permite, «—» no.

| Capacidad | Propietario | Encargado | Cajero/a | Camarero/a |
|---|---|---|---|---|
| Ver sala, ver comandas, reimprimir comanda | Sí | Sí | Sí | Sí |
| Operar cuenta, repartir, unir, asignar mesa | Sí | Sí | Sí | Sí |
| Enviar pedido, servir, cancelar línea | Sí | Sí | Sí | Sí |
| Iniciar cobro | Sí | Sí | Sí | Sí |
| Cobro en efectivo | Sí | Sí | Sí | — |
| Operar caja | Sí | Sí | Sí | — |
| Cerrar pedido | Sí | Sí | Sí | — |
| Cancelar pedido | Sí | Sí | — | — |
| Cambiar comanda | Sí | Sí | — | Sí |
| Iniciar y completar preparación | Sí | Sí | — | Sí |
| Reasignar cuenta, revertir reparto, bloquear o reservar mesa, configurar sala | Sí | Sí | — | — |
| Resolver cobro incierto, cancelación sensible, cambiar emisor | Sí | Sí | — | — |
| Configurar comandas y decidir mermas | Sí | Sí | — | — |
| Confirmar reembolso | Sí | Sí | — | — |
| Solicitar reembolso | Sí | Sí | — | — |
| Reabrir cierre | Sí | — | — | — |

Excepciones activas en QA-A1: `ABC_COBRO_EFECTIVO`, `ABC_REEMBOLSO_SOLICITAR` y
`ABC_PEDIDO_CANCELAR` de Cajero/a están en «heredar» (valor nulo) tras pruebas del 02/10 y
03/10; `ABC_CUENTA_OPERAR` de Encargado está permitida.

## 2. Inicio de sesión en vivo (VIVO)

Los tres cargos entraron con correo y contraseña, **sin segundo factor y sin cambio de
contraseña obligatorio**, como fija la decisión E6 (solo el Propietario lo exige).

## 3. Menú visible por cargo (VIVO)

| Área | Propietario | Encargado | Cajero/a | Camarero/a |
|---|---|---|---|---|
| Inicio | 3 pestañas | sí | sí | — |
| Servicio | 4 (Punto de venta, Cocina, Encargos, Clientes) | 2 (Punto de venta, Cocina) | 2 | 2 |
| Caja y fiscalidad | 3 | 2 (sin Libro de IVA) | 2 | — |
| Compras | 7 | 4 | — | — |
| Inventario | 12 | 5 | — | — |
| Calidad | 2 | 2 | — | — |
| Equipo, Informes, Organización, Sistema | sí | — | — | — |

## 4. Rechazo del servidor con la sesión real (VIVO)

Llamadas con identificadores **inventados** que no pueden escribir: si el cargo no tiene
permiso, el servidor rechaza antes de buscar nada; si lo tiene, responde «no encontrado».

| Función | Encargado | Cajero/a | Camarero/a |
|---|---|---|---|
| `abc_reabrir_cierre_provisional` | rechaza (`abc_caja_no_autorizado`) | rechaza | rechaza |
| `abc_aprobar_reembolso` | pasa (`reembolso_no_encontrado`) | rechaza (`abc_aprobar_reembolso_no_autorizado`) | rechaza |
| `abc_solicitar_reembolso` | pasa (`pago_no_encontrado`) | rechaza (`abc_reembolso_no_autorizado`) | rechaza |
| `abc_cancelar_pedido` | pasa hasta la sesión de terminal | rechaza (`pedido_cancelar_no_autorizado`) | rechaza |
| `abc_finalizar_cierre_sesion_caja` | pasa (`cierre_provisional_no_encontrado`) | pasa | rechaza (`abc_caja_no_autorizado`) |
| `revertir_venta_stock_carrito_pm09` (Anular venta) | no probado | no probado | rechaza (`reverso_no_autorizado`) |
| `abc_aplicar_descuento_cuenta`, `abc_cancelar_linea` | **no concluyente**: validan parámetros o sesión de terminal antes que el permiso | ídem | ídem |

## 5. Escrituras directas y aislamiento, como Camarero/a (VIVO)

- `insert` en `pagos`, `caja_operaciones`, `pedidos_tpv` y `reembolsos`: **42501 permission
  denied**. `update` y `delete` en `pagos`: 42501.
- Aislamiento: de los 122 pedidos de QA-A1 ve 122; de los 2 pedidos del local QA-A2 ve **0**;
  de los 3 pedidos de otras empresas ve **0**; pagos y movimientos de caja de QA-A2: 0.

## 6. Otros casos de esta ronda

- **V-16 escaneo con capa abierta (FAIL, VIVO):** en modo caja, con la capa «Terminal» abierta,
  se escribió «Agua 50 cl» y Intro en el buscador oculto, que conservaba el foco: el ticket
  pasó de 0 a 1 línea. Confirma H-03.
- **F-02 editar cantidades y quitar líneas (PASS, VIVO):** +1, +1, −1, fijar 5 y quitar dan
  1, 2, 3, 2 y 5 unidades y los totales correctos; todo es local hasta «Guardar pedido».
- **F-19 ticket y reimpresión (PASS parcial, VIVO):** el ticket de la venta TPV-000045 se
  abre desde el historial con empresa, local, número, IVA (0,91 + 0,09 = 1,00 €), importe
  entregado y cambio. **No se imprimió**: no se probó el cuadro de impresión ni el PDF.
- **Cuentas creadas por la aplicación:** el servidor no obliga a cambiar la contraseña inicial
  que fija quien crea la cuenta (el aviso de la propia pantalla dice que el empleado «podrá
  cambiarla»).

## Reservas

- La matriz no probó con la sesión real las operaciones que escriben de verdad (descuentos,
  aparcar, unir y repartir cuentas, cobro con cada cargo): se necesita el lote L3.
- No se inició sesión como Propietario en esta ronda (exige segundo factor del usuario); su
  columna sale de la matriz del servidor y del menú recogido antes de cerrar su sesión.
- Una cuenta de empleado se creó con la contraseña generada dentro de la página; el aviso
  «Cuenta creada para QA Auditoria Cajero» apareció una vez antes de que existiera la cuenta
  en el servidor y no se pudo reproducir; se anota como observación, no como defecto.

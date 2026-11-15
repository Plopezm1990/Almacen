# Evidencia del punto 1 · TPV, sala y caja

Entorno `qjqorixtkilwsndqayyx`, QA-EMP-A / QA-A1, [Deploy Preview #225](https://deploy-preview-225--chic-entremet-9107cf.netlify.app/). El PR está en borrador y sigue sin fusionar. El modo de emisión mostrado por el TPV es `SIMULADOR_C07D`, entorno QA.

## Evidencia funcional

| Prueba | Evidencia |
| --- | --- |
| Albarán `SIM-0001` | **Anular entrada y editar** abre el diálogo, con aviso del efecto sobre stock y costes. **Cancelar** deja el albarán registrado. |
| Encargo `QA-P1-ANT-1115` | Encargo de 3,00 € con señal de 1,00 € en efectivo simulado. En el servidor consta una fila `CONFIRMADO` y un único `REVERSO` de 1,00 € vinculado a esa señal. El encargo consta una sola vez con estado `Cancelado`. En el preview de `1566cc38` aparece solo en el historial. |
| Terminales y caja | Dos terminales activos vinculados a la misma sesión de caja abierta. El TPV del primer perfil muestra **QA terminal A1 (siembra etapa 1)**. El selector permite elegir el terminal activo de un navegador todavía sin asignar. |
| Q07, plano y filtros | Pase verifica Interior y Terraza libres, enlace exacto a la mesa, cuenta abierta y pedido guardado. El filtro de zona vacía activado con Enter muestra «Esta zona no tiene mesas activas». **Cuentas** responde a Enter. La comanda de Terraza, lista para servir, se priorizó y el botón llevó a Cocina filtrada por ese pedido. A 390 px con movimiento reducido, la selección de mesa siguió operativa y el ancho no desbordó. |
| Q08, Terraza | Mesa `QA-P1-T01`, cuenta `b834c033-2443-4217-931f-7d57e3e08d9c`, pedido `a59e9788-06ad-4842-8447-fe4a483c7e90`. Dos Croissant (QA), 2,64 €. Recorrido `ENVIADO` → `EN_PREPARACION` → `PREPARADO` desde A1. La cuenta sigue `ABIERTA` y la línea `PREPARADA` para continuar el ensayo desde A2. Cocina muestra la comanda original en `Cocina QA-A1`. |
| Q08, Interior | Mesa `QA-P1-I01`, cuenta `609e3af6-b95b-4669-88d5-be2888775dee`, pedido `c0b7ec8c-e5a4-4397-9b59-57afd6a3b8ca`. El servidor confirma `ABIERTO`, un Café con leche (QA) de 1,54 €, variante Pequeño, modificador Leche de avena y nota «QA punto 1: modificador avena, sin servicio real». Pase lo muestra como «Pedido guardado». Sigue disponible para recuperarlo desde el otro terminal. |

Las mesas de ensayo y la zona vacía se cargaron como fixtures de QA. Las dos mesas y cuentas anteriores a esta tanda se dejaron disponibles para su propio ensayo.

## Comprobaciones en el servidor de QA

Transacciones de solo lectura en `QA-EMP-A / QA-A1` con el rol SQL `authenticated` y el contexto de las cuentas sintéticas con membresía efectiva. Se usaron los RPC del producto. La prueba no inició sesión en el navegador ni registró cobros, reembolsos o movimientos de caja.

| Cargo y contexto del ensayo | Consulta de caja | Inicio de efectivo | Solicitud de reembolso | Aprobación de reembolso |
| --- | --- | --- | --- | --- |
| Camarero/a | Denegada | `abc_efectivo_no_autorizado` | Denegada | Denegada |
| Cajero/a sin segundo factor | Denegada | `abc_cobro_no_autorizado` | Denegada | Denegada |
| Cajero/a con contexto de segundo factor | Permitida | Supera la guarda y rechaza los identificadores vacíos con `cobro_parametros_requeridos` | Denegada | Denegada |

`abc_recuperar_cuenta` devolvió las dos cuentas y sus pedidos como reanudables al utilizar los contextos de A1 y A2. Coincidieron la cuenta, el pedido y la revisión de cada mesa entre terminales. Interior quedó `ABIERTO` y Terraza `PREPARADO`. La ejecución del traspaso en dos perfiles independientes sigue pendiente.

En un ensayo revertido, Camarero/a marcó Terraza como servida desde A2 y A1 recuperó el mismo pedido en `SERVIDO`. Cajero/a con contexto de segundo factor cobró 2,64 € desde A2, con 5,00 € recibidos y 2,36 € de cambio. La repetición de la misma confirmación devolvió el mismo pago. Hubo un pago, un asiento de caja y una instantánea de venta, con saldo 0 y cierre de cuenta confirmado. El stock conservó su único movimiento de consumo y el servidor denegó al Cajero/a la solicitud de reembolso del pago del ensayo. No se solicitó emisión fiscal.

Una consulta posterior confirmó que Terraza volvió a `PREPARADO`, con cuenta `ABIERTA`, cero checkouts y cero asientos persistidos del ensayo. Esta prueba ejercitó los contratos reales del servidor y deja disponible el mismo pedido para el recorrido del navegador.

## Verificaciones que siguen abiertas

- Q07 y Q08 con los dos perfiles a la vez. En A2 hay que recuperar el pedido guardado de Interior, observar las mismas mesas y cuentas, y seguir por Cocina, servido y cobro simulado. Conservar los identificadores y contrastar el ticket, cambio y movimientos de stock con el servidor. Forzar el reintento sin duplicar efectos.
- Q07 con un cargo de acceso limitado y entrada táctil en dispositivo. El modelo comercial persiste los pedidos guardados como `ABIERTO`. El proyecto carece de un estado independiente de cuenta aparcada; la aceptación debe contrastar esto con la especificación que pide usar el modelo real.
- Acceso desde un navegador con una cuenta restringida de QA-A1. La cuenta sintética de Cajero/a empleada en la prueba de servidor tiene membresía activa en el local y segundo factor registrado. Falta completar la autenticación en el segundo perfil y contrastar los controles y las operaciones de caja, cobro y reembolso en la suite.

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

## Traspaso comprobado en Chrome

En el perfil de Chrome, el TPV se asignó al terminal **QA terminal A2 (ensayo punto 2)**. En Pase se vieron la zona vacía, Interior como «Pedido guardado» y Terraza como «Listo para servir» en la cola. Desde la ficha de Interior, el TPV recuperó la cuenta guardada previamente en A1 y se pulsó «Enviar pedido a preparación». El servidor registró la transición desde A2 sobre el mismo pedido `c0b7ec8c-e5a4-4397-9b59-57afd6a3b8ca`, con una comanda `2f9ae55b-78b7-4e7e-aebd-078760f52731` en Cocina QA-A1. Se conservaron cantidad 1, total 1,54 €, variante Pequeño, modificador Leche de avena y la nota de ensayo. El stock de esa línea quedó reservado. La sesión de A1 en el navegador de ChatGPT pidió iniciar sesión nuevamente.

## Recorrido en dos navegadores del 16/11

- A1 en el navegador integrado y A2 en Chrome operaron el mismo local y sesión de caja. Ambas sesiones eran de Propietario. Los pedidos del 15/11 quedaron abiertos y el TPV los indicó como de día cerrado. Para el nuevo ensayo se añadieron las mesas `QA-P1-I02` y `QA-P1-T02` como datos de prueba de QA.
- Q07 mostró Interior y Terraza libres en Pase. A1 abrió `QA-P1-I02` desde Pase y la asignó a la cuenta `afe3a901-3c7c-4d97-89a4-7401cbe581bc` con dos comensales. A2 recuperó esa misma mesa, cuenta y pedido `12455871-81ff-455b-bd25-5c90436c9e01` desde **Cuentas abiertas y aparcadas**.
- Q08 guardó un café con leche de 1,54 €, variante Pequeño, modificador Leche de avena y nota «QA Q08 A1-A2 · prueba sin servicio real». El configurador mostraba «Alérgenos: sin declarar». A2 envió una única comanda `6b330c07-9856-47e2-9644-e7c9c924ff69` a Cocina QA-A1. A1 verificó la nota en Cocina y completó En preparación → Listo para servir → Servido.
- A2 cobró 1,54 € en `SIMULADOR_C07D`, con 5,00 € recibidos y 3,46 € de cambio. A1 aún mostraba el saldo anterior. Al pulsar cobrar desde A1, la interfaz recuperó el resultado confirmado y mostró la cuenta cerrada y el mismo ticket `TPV-36`, secuencia 32. Tras el reintento el servidor confirmó un checkout `272395a6-cbf2-4de2-8410-426b4c95256d`, un pago `0176f247-645e-4de6-88dc-f99fcdd2503d`, un asiento de 1,54 € a nombre de A2, un documento fiscal simulado y un movimiento de consumo de stock.
- La vista del ticket de sala mostraba efectivo entregado y cambio con valores fijos. Además, el resumen operativo recuperado omitía base e IVA. La comprobación con la venta fiscal cerrada confirmó base de 1,40 € e IVA de 0,14 € para el ticket del ensayo. La corrección usa las líneas fiscales emitidas y los pagos del checkout para construir el ticket.
- Reabierto `TPV-36` en el preview con `9d4e6d74`, sin otra venta. El recibo indicó mesa Interior 2, Sala QA-A1, base 1,40 €, IVA 10 % de 0,14 €, total 1,54 €, entregado 5,00 € y cambio 3,46 €. El plano volvió a marcar la mesa libre. La puerta general del PR pasó en el mismo commit.

## Verificaciones que siguen abiertas

Consultar la [continuación del 17 de noviembre](TRASPASO_QA_CLAUDE_2026-11-17.md) para el estado del alta de Camarero/a y el orden de verificación.

- Q07 con un cargo de acceso limitado y entrada táctil en dispositivo. El modelo comercial persiste los pedidos guardados como `ABIERTO`. El proyecto carece de un estado independiente de cuenta aparcada; la aceptación debe contrastar esto con la especificación que pide usar el modelo real.
- Acceso desde un navegador con una cuenta restringida de QA-A1. La cuenta sintética de Cajero/a empleada en la prueba de servidor tiene membresía activa en el local y segundo factor registrado. Falta completar la autenticación en el segundo perfil y contrastar los controles y las operaciones de caja, cobro y reembolso en la suite.

## Resultado Q08 · 17/11/2026 · recorrido completo en QA

En el Deploy Preview #225 se repitió el ensayo con dos perfiles de navegador
en QA-A1, usando los terminales `QA terminal A1 (siembra etapa 1)` y
`QA terminal A2 (ensayo punto 2)`. Pase abrió la mesa libre `QA-P1-I02` y el
TPV recuperó la misma cuenta en el terminal activo, sin reutilizar una cuenta
previa del navegador.

La cuenta `a8549e71-534b-4ba7-a2e8-96f5ba79febf` quedó con un Café con leche
(QA), variante Pequeño, extra Leche de avena y la nota `QA Q08 A1-A2 · ensayo
selector terminal`. Su pedido `d1a47ffa-f5c6-4fd8-b458-7996993f67e7` produjo una
sola comanda y recorrió `Enviado a cocina` → `En preparación` → `Listo para
servir` → `Servido`.

Con autorización puntual del propietario se cobró **1,54 € en efectivo
simulado** (`SIMULADOR_C07D`). El servidor confirmó pendiente `0,00 €`, generó
el ticket `TPV-37` (secuencia 33) y dejó preparado el QR fiscal de QA; AEAT real
permaneció desactivada. El cierre formal de la cuenta se completó y la cuenta
dejó de aparecer en «Cuentas abiertas y aparcadas». No se usó tarjeta, no se
solicitó reembolso y no se cerró la caja.

Este recorrido cierra Q08 en el perfil de propietario. Siguen abiertas las
pruebas de denegación/autorización con la cuenta Camarero/a efectiva en QA-A1,
las comprobaciones explícitas de caja, cobro y reembolso y la repetición de los
tres enlaces Pase → TPV con una cuenta distinta ya activa en cada terminal.

## Tanda Codex · 17/11/2026 · membresía y enlace Pase → TPV

La cuenta `qa.permisos.20261116@qa.invalid` ya tiene una membresía efectiva y
operativa en QA: empresa `QA-EMP-A`, `local_id='QA-A1'`,
`todos_locales=false`, rol `Camarero/a`, activa. Se verificó por consulta de
solo lectura en el proyecto `qjqorixtkilwsndqayyx`; no se hizo una escritura
redundante. El ensayo de navegador queda pendiente para confirmar que el
selector refleja ese registro y no fabrica «Local principal».

Se aisló y corrigió el defecto del enlace de Pase. El panel enviaba únicamente
la mesa, por lo que el TPV podía conservar la cuenta activa del terminal. En
`88bb28ac`, los accesos de prioridad, ficha de mesa y cola de cuentas envían
`mesaId`, `cuentaId` y `operatingDay`. El TPV valida la cuenta contra el mapa
real, recupera la cuenta exacta y muestra un aviso explícito si el destino ya
no pertenece a la mesa. La corrección se mantiene idéntica en
`fuente.js`/`source-recovery/fuente-recuperado.js` y el contrato A06 cubre el
transporte y el caso obsoleto.

Regresión que queda para QA tras el despliegue: con otra cuenta ya activa en el
terminal, repetir los tres casos documentados (dos filas de Cuentas y «Lleva
más tiempo abierta») y comprobar que cada uno abre su cuenta/pedido, no la
cuenta previa, y que un destino desaparecido ya no falla en silencio.

Verificación local de esta tanda: paridad de `fuente.js` PASS; contratos A06-1,
A06-2, A06-3, CFG6E, A09 y P08 PASS. La batería completa no se pudo lanzar en
este Windows por el runner Bash/MSYS; el entorno de batería debe incluir
`fake-indexeddb` desde `be0b722a`.

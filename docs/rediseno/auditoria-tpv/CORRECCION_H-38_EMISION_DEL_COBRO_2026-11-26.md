# Corrección H-38 · documento fiscal del cobro del Cajero/a · 26/11/2026

Estado: **implementada y verificada en QA** (`qjqorixtkilwsndqayyx`). Producción no se ha tocado.
Rama `correccion/ola0-tpv-2026-11-26`, sin enviar al remoto. La PR #225 sigue en borrador.

## Qué fallaba

Un cobro hecho con la cuenta de Cajero/a se cerraba sin documento fiscal. La emisión no es una
función, son cuatro capas, y todas exigían `ABC_EMISOR_CAMBIAR` (solo Propietario y Encargado):

1. `abc_c07d_estado_configuracion_emision` (lectura del estado, la primera llamada del cliente).
2. `abc_c07d_emitir_checkout` (entrada).
3. `abc_preparar_ticket_fiscal_qa` (solo QA).
4. Tres primitivos de numeración llamados por la entrada: `abc_reservar_numero_documental`,
   `abc_resolver_emision_documental`, `abc_c07d_registrar_documento_fiscal`.

## Qué se cambió (dos migraciones)

| Migración | Efecto |
|---|---|
| `20261126120000_abc_f7_c07d_emision_por_capacidad_de_cobro.sql` | Las capas 1 a 3 aceptan `ABC_COBRO_INICIAR` además de `ABC_EMISOR_CAMBIAR`. |
| `20261126130000_abc_f7_c07d_emision_cobro_acceso_interno.sql` | La entrada marca su transacción (`app.c07d_emision_cobro` = id de transacción) y los tres primitivos aceptan `ABC_EMISOR_CAMBIAR` **o** esa marca. |

Los primitivos **no** se abren a quien cobra: llamados directamente, un Cajero/a sigue recibiendo
`abc_documento_no_autorizado`. La marca no sobrevive al commit y un valor falseado no la activa.
La administración fiscal (guardar configuración, series, adaptadores…) no cambia.

Las dos migraciones parchean la definición viva de cada función, son idempotentes y fallan en voz
alta si la guarda esperada no está. La segunda es una sola transacción: si un primitivo no se puede
parchear, la entrada tampoco queda marcada.

## Lección del primer intento

Con solo la primera migración, el contrato PGlite salía en verde (34 comprobaciones) porque sus
funciones de prueba tenían una sola capa, y en QA el Cajero/a seguía sin poder emitir. El contrato
`tests/rediseno/c07d-emision-cobro-pglite-contract.mjs` modela ahora la cadena entera (66
comprobaciones), incluye el estado parcial («solo la primera migración») como caso que debe seguir
fallando, y comprueba primitivos cerrados, marca falseada, marca que no sobrevive y rollback.

## Verificación

- Contrato PGlite: 66/66. Preflight F7: OK (70 migraciones). Batería sin base de datos: 336 contratos
  activos, 0 fallos, manifiesto 393 entradas.
- QA, con la identidad real del Cajero/a (`aal1`):
  - llamada directa a `abc_reservar_numero_documental`: **rechazada** (`abc_documento_no_autorizado`);
  - `abc_c07d_estado_configuracion_emision`: `ok`;
  - `abc_c07d_emitir_checkout` del cobro `df894a12…` (cuenta `7721798a…`): **FACTURA serie TPV n.º 46,
    EMITIDO**, cola PENDIENTE, transporte AEAT desactivado (QA). Es el documento que faltaba a la venta
    del Cajero/a de la auditoría; la operación tiene un único documento.

## H-38b · el cierre de caja detecta las ventas sin documento

Migración `20261126140000_abc_f5_c04_bloqueo_ventas_sin_documento.sql`, aplicada en QA.
`private.abc_c04_bloqueos_cierre` es el punto único de bloqueos del cierre (ensayo C12, cierre
provisional, cierre definitivo y el disparador de `CERRADA_FINAL`). Ahora añade el bloqueo
`VENTAS_SIN_DOCUMENTO`: hay un cobro completado con importe, del mismo local, dentro de la ventana
de la sesión (apertura a cierre) y sin documento **EMITIDO** (uno solo reservado sigue contando).
El ensayo C12 lo clasifica como BLOQUEADO. El cierre provisional lo anota en su foto sin impedirse;
el definitivo se rechaza hasta emitir el documento.

- Contrato `tests/rediseno/c04-bloqueo-ventas-sin-documento-pglite-contract.mjs`: 25 comprobaciones
  (reproduce el defecto, qué no bloquea, conviven pagos y efectos, idempotencia, fallo en voz alta).
- Manifiesto de CI: 394 entradas, 377 activas.
- QA, con datos reales: la sesión del 25/11 (`14d01b2f…`) queda marcada por la venta de 1,00 € del
  Camarero/a/Cajero/a sin documento (`a4543959…`); las sesiones del 26/11 salen limpias. También
  salen marcadas tres sesiones antiguas (octubre y noviembre) por ventas anteriores a esta
  corrección: es historia ya cerrada, el bloqueo solo actúa al pasar a cierre definitivo.
- No se emitió el documento de la venta del 25/11: la autorización del usuario cubría solo la venta
  del Cajero/a del 26/11.

## H-38b · botón «Emitir documento pendiente» en el cierre

Migración `20261126150000_abc_f5_c04_listar_ventas_sin_documento.sql`, aplicada en QA. La función
`abc_c04_listar_ventas_sin_documento` (solo lectura, para quien opera la caja o inicia cobros) devuelve
exactamente las ventas que producen el bloqueo: checkout, cuenta, venta fiscal e importe. El contrato PGlite
comprueba que la lista y el bloqueo coinciden (38 comprobaciones en total).

En la pantalla de cierre (Servicio → Cocina y comandas → gestión avanzada) aparece el panel «Ventas
cobradas sin documento fiscal (n)», con una fila por venta y el botón **Emitir documento pendiente**. Usa la
emisión de siempre con el checkout de esa venta: si el documento ya existía no se duplica. Al emitir recarga
la lista y descarta el ensayo anterior. Los bloqueos del ensayo C12 y del cierre provisional dicen ahora
«Hay ventas cobradas sin documento fiscal. Emite los documentos pendientes.» en lugar de «Pendiente operativo».

Comprobado en QA con la identidad del Cajero/a: la sesión del 25/11 devuelve la venta de 1,00 € sin documento
(`a4543959…`) y las del 26/11 devuelven lista vacía. Contrato de pantalla:
`tests/rediseno/h38b-emitir-documento-pendiente-contract.mjs`. Batería sin base de datos: 339 contratos
activos, 0 fallos; manifiesto 397 entradas.

## Prueba de ejecución del panel

`tests/cfg/h38b-h24-ui-runtime.mjs` monta la pantalla de cierre real con un servidor falso: con dos ventas sin
documento aparece «Ventas cobradas sin documento fiscal (2)» con un botón por venta; pulsar uno emite el documento
de ESA venta (cuenta y operación `f7.c07d.checkout.emit:<cuenta>:<checkout>`), confirma el número («TPV n.º 101») y la
saca del panel; al emitir la última el panel desaparece. Si el servidor rechaza la emisión la venta sigue pendiente
y se muestra el error; si no se puede leer la lista no se pinta ningún panel. Contra el código anterior falla.

## Qué falta de H-38

- Pulsar el botón en el navegador de QA (en un navegador simulado con servidor falso ya funciona). La sesión del 25/11 está cerrada, así que el botón no aparece sobre
  ella; hace falta una sesión abierta con una venta sin documento (o emitir esa venta por otra vía).
- El botón no prepara el QR fiscal del ticket (el cobro normal sí lo hace en QA); el documento queda emitido
  pero sin QR hasta que se prepare aparte.
- No se emitió el documento de la venta del 25/11: la autorización cubría solo la del Cajero/a del 26/11.

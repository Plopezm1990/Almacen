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

## Pendiente de H-38

**H-38b**: el cierre de caja (`abc_c04_bloqueos_cierre`, C12) no detecta ventas cobradas sin documento y
no hay botón «Emitir documento pendiente». Es una pieza aparte, aún no empezada.

# Etapa 02 — Emisión del ticket fiscal QR en QA

Fecha: 2026-10-26  
Proyecto: L&A Suite / TPV puesto único  
Entorno trabajado: Supabase QA `qjqorixtkilwsndqayyx` y preview QA  
Producción: fuera de alcance y sin cambios

## Resultado

La Etapa 02 queda implementada en QA mediante la migración:

`supabase/migrations/20261026160000_abc_p18_qa_fiscal_qr_ticket.sql`

La migración crea el contrato servidor para preparar, de forma idempotente, un ticket fiscal simplificado asociado a una venta cobrada:

`public.abc_preparar_ticket_fiscal_qa(text,text,text,uuid,uuid,date)`

La RPC está limitada por código a:

- empresa `QA-EMP-A`;
- local `QA-A1`;
- entidad fiscal simulada;
- modalidad fiscal en estado `SIMULADOR`;
- numeración interna `FACTURA` / serie `TPV`;
- estado resultante `PREPARADO_SIMULADOR`.

Si se invoca con otra empresa o local, la barrera `qr_fiscal_qa_only` rechaza la operación. No existe una vía de esta RPC para operar sobre producción.

## Flujo implementado

La RPC valida sesión y capacidad `ABC_EMISOR_CAMBIAR`, comprueba que la venta pertenece al tenant, que el checkout está `COMPLETADO`, que el importe coincide y que existe pago confirmado suficiente. Después encadena las piezas fiscales ya existentes:

1. C05 reserva el número documental de la serie `TPV`.
2. C06 clasifica el documento interno como `FACTURA_SIMPLIFICADA`.
3. C07 evalúa la modalidad fiscal en modo simulado.
4. C05 resuelve el documento como `EMITIDO` dentro del simulador.
5. Se guarda el contrato QR, el payload y una huella SHA-256.

La serie se registra como tipo interno `FACTURA`, no como `FACTURA_SIMPLIFICADA`, porque C06 exige que la clasificación simplificada parta de un documento C05 de tipo `FACTURA`. Esta decisión mantiene coherencia con las validaciones existentes y evita una serie que no pudiera emitirse.

## Contrato QR

El payload guardado incluye `nif`, `numserie`, `fecha`, `importe`, `url`, `entorno` y `simulador`. La URL usa el endpoint de pruebas externas de AEAT:

`https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?`

Incluye únicamente los parámetros `nif`, `numserie`, `fecha` e `importe`, con fecha `DD-MM-YYYY`, importe decimal con punto y sin `formato=json`. La presentación a AEAT queda expresamente marcada como `false`.

El QR de esta etapa todavía no debe presentarse al cliente como un QR fiscal real: la identidad fiscal de QA es simulada y no hay presentación de registros a AEAT. El objetivo de la etapa es probar el contrato de datos, la numeración, la trazabilidad y la idempotencia.

## Idempotencia y recuperación

La operación principal y sus suboperaciones tienen identificadores estables. Si se repite la misma operación, se devuelve el resultado guardado. Si una ejecución falla después de reservar el número C05, un reintento busca la reserva existente por `documento_origen_id` y no quema una segunda numeración para la misma venta.

La tabla `abc_fiscal_qr_documentos` tiene unicidad por operación, venta y documento, RLS de lectura por local y escritura exclusivamente a través de la RPC `SECURITY DEFINER`.

## Verificaciones realizadas

- Migración aplicada con éxito en Supabase QA `qjqorixtkilwsndqayyx`.
- Tabla QR creada con las columnas de trazabilidad, payload, URL, importe, número y huella.
- Serie `TPV` creada/reactivada para `QA-EMP-A` / `QA-A1` sin reiniciar numeración existente.
- RPC creada y ejecutable por `authenticated`.
- Contrato estático `tests/pm18/p03-qr-fiscal-qa-contract.mjs`: PASS.
- `node --check fuente.js`: PASS.
- `node --check source-recovery/fuente-recuperado.js`: PASS.
- `git diff --check`: PASS.

La prueba end-to-end de una venta desde la pantalla del TPV queda deliberadamente para la Etapa 03, porque el renderer actual todavía no llama a esta RPC ni incorpora el QR al ticket mostrado o imprimible. Ejecutar la RPC como administrador mediante SQL no sería una prueba válida de la autorización del usuario del TPV.

## Decisión de cierre

**Etapa 02: TERMINADA en QA.**

No se declara emisión fiscal productiva ni validación real ante AEAT. La migración y la RPC quedan preparadas para que la siguiente etapa conecte el cobro completado con el renderer del ticket y muestre el QR con la leyenda fiscal correspondiente.

## Qué sigue

La Etapa 03 debe integrar el flujo de cobro del TPV con `abc_preparar_ticket_fiscal_qa`, recuperar `qr_url` y `qr_payload`, renderizar un QR real en pantalla/impresión y conservar el ticket interno como fallback solo cuando la emisión simulada esté bloqueada. Después habrá que probar en QA una venta nueva completa y verificar idempotencia, reintento y el QR visible antes de plantear cualquier conversación sobre activación productiva.

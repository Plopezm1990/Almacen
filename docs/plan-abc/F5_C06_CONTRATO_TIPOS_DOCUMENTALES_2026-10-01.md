# F5 C06 Contrato de tipos documentales

Fecha: 2026-10-01  
Estado: `IMPLEMENTADO_Y_VERIFICADO_EN_QA; REGLAS_FISCALES_Y_UI_PENDIENTES`

## Alcance

C06 distingue la clase de documento que acompaña al recorrido de venta y
cobro. La clasificación queda vinculada a la identidad documental de C05 y no
se puede cambiar silenciosamente. Se preparan seis tipos:

- `PEDIDO`;
- `PRECUENTA`;
- `JUSTIFICANTE_PAGO`;
- `FACTURA_SIMPLIFICADA`;
- `FACTURA_COMPLETA`;
- `FACTURA_RECTIFICATIVA`.

Una factura completa exige en este candidato nombre e identificador fiscal del
receptor. Una rectificativa exige una referencia a una factura ya emitida y
conserva ese vínculo. Las demás clases no admiten modalidad fiscal ni
referencia de rectificación.

## Límites explícitos

Este paquete no decide el régimen fiscal, el territorio, el emisor definitivo,
los campos exigibles por cada caso, el SIF, Veri*Factu, la factura electrónica
B2B ni la validez legal de una factura. Tampoco genera PDF ni conecta un
proveedor. Es una frontera técnica para que C07 pueda aplicar esas decisiones
sin mezclar pedido, precuenta, justificante y factura.

## Contrato técnico

- `abc_clasificar_documento` exige autenticación, empresa/local y capacidad de
  emisor.
- La clase debe coincidir con el tipo de serie C05: los tres documentos
  operativos usan su propia serie y las tres facturas usan la serie `FACTURA`.
- La clasificación es idempotente por `operation_id` y única por documento.
- Una clasificación existente no puede sustituirse por otra con una nueva
  petición.
- Una rectificativa solo puede referir una factura simplificada o completa que
  ya esté `EMITIDO`; no puede referirse a sí misma.
- La tabla no tiene acceso directo del cliente y conserva evento auditable.

## Evidencia

La prueba PostgreSQL 16 cubre clasificación completa, simplificada y
rectificativa, replay de la misma operación, rechazo de datos incompletos y
protección contra reclasificación directa. El run 1 del workflow C06 pasó en
28 segundos.

El ensayo conectado en QA del 9/10/2026 cubrió además un pedido, la coherencia
entre tipo y serie, inmutabilidad y rechazo del Camarero/a. Terminó con
`ROLLBACK` y cero residuos. La tabla no concede acceso directo al cliente; la
RPC concede ejecución a `authenticated` y valida la capacidad internamente.

## Pendiente para cerrar C06

1. Revisar con asesoría los campos y modalidades de cada tipo.
2. Esperar C07 para la decisión fiscal y de proveedor.
3. Conectar la clasificación a la pantalla y obtener aceptación funcional.

Producción no se ha modificado. Evidencia consolidada:
`F7_C06_QA_RESULTADO_2026-10-09.md`.

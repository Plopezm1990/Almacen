# F4 B09 Liquidaciones y disputas

Fecha: 30/09/2026.

## Estado

B09.1 queda preparado como modelo aislado de conciliación. Se añaden el
resumen de liquidación, sus líneas vinculables a un pago e intento existentes y
las disputas/contracargos con responsable, estado y documentación. No se
importan datos reales, no se modifica `pagos`, no se crea otra venta y no se
aplican efectos automáticos sobre caja o stock.

La integración real con el proveedor sigue pendiente de B07. Este subpunto se
puede validar con el simulador y con fixtures controlados sin proveedor real.

B09.2 queda implementado en una migración separada. Añade RPC servidor-servidor
idempotentes para importar liquidaciones, vincular una línea con un pago y un
intento existentes y resolver disputas conservando responsable y documentación.
Las RPC solo se conceden a `service_role`; los clientes no escriben las tablas.

## Alcance de B09.1

- Separar vendido, cobrado, devuelto, comisión y neto liquidado.
- Conservar proveedor, cuenta comercial, referencia de liquidación y moneda.
- Permitir líneas sin vincular mientras la conciliación no haya resuelto el
  pago, pero impedir enlaces fuera de empresa/local o con moneda distinta.
- Relacionar una línea vinculada con el pago y el intento existentes; nunca
  crear una venta para explicar una liquidación.
- Registrar una disputa o contracargo como incidencia independiente, con
  referencia, importe, estado, responsable, vencimiento y documentación.
- Mantener el estado de disputa separado del estado de reembolso y del retorno
  físico.

## Límites

- No consulta aún una API bancaria o de proveedor.
- No configura una cuenta comercial real ni secretos.
- B09.2 no activa efectos automáticos sobre pagos, ventas, caja o stock.
- B09.2 no sustituye la integración real del proveedor, que sigue dependiendo
  de B07 y de una cuenta sandbox o productiva autorizada.
- No escribe Supabase remoto y no requiere deploy de Netlify.

## Evidencia

El contrato `tests/f4/b09/b09-schema-contract.mjs` comprueba la separación de
importes, las relaciones de pago/intento, el aislamiento RLS y la ausencia de
efectos directos sobre ventas, caja o stock. La migración es aditiva y concede
acceso directo únicamente a `service_role` hasta que exista una RPC autorizada.
El contrato `tests/f4/b09/b09-rpc-contract.mjs` comprueba las RPC B09.2, su
idempotencia técnica, sus privilegios y que solo vinculan registros existentes.

## Criterios de aceptación de B09.1

- Una liquidación puede conservar todos los importes por separado.
- Una línea puede quedar `NO_VINCULADA` sin inventar una venta.
- Una línea vinculada exige el mismo contexto y moneda del pago/intento.
- Una disputa conserva su evidencia y responsable sin convertirse en devolución
  física automática.
- Los clientes no reciben escritura directa sobre las tablas nuevas.

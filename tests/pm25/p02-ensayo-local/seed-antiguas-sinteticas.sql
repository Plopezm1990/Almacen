-- PM25 P02 -- fixtures antiguas SINTETICAS (un solo digito/patron
-- repetido, ninguna identidad real), sembradas identicas en pm25_base
-- y pm25_ensayo. Incluye, a proposito, el MISMO operation_id repetido
-- entre dos libros distintos (pagos_factura y caja_operaciones) --
-- el escenario de datos antiguos exigido explicitamente por el diseno.

insert into public.pagos_factura (id, operation_id) values
  ('PF-0001', 'OP-1111111111'),
  ('PF-0002', 'OP-2222222222'),
  ('PF-0003', 'OP-DUPLICADO00');

insert into public.caja_operaciones (id, operation_id) values
  ('CO-0001', 'OP-3333333333'),
  ('CO-0002', 'OP-DUPLICADO00');

insert into public.stock_operaciones (id, operation_id) values
  ('SO-0001', 'OP-4444444444');

insert into public.arqueos_caja (id, operation_id) values
  ('AC-0001', 'OP-5555555555');

insert into public.arqueos_caja_anulaciones (id, operation_id) values
  ('AA-0001', 'OP-6666666666');

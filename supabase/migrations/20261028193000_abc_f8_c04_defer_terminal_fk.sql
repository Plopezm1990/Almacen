-- ABC · F8 C04 · permitir el alta atómica de un terminal con su operación.
--
-- abc_configurar_terminal_tpv registra primero la operación idempotente y,
-- dentro de la misma transacción, inserta el terminal nuevo. La FK inmediata
-- impedía ese flujo legítimo aunque el terminal quedara creado antes del
-- commit. Se mantiene la misma integridad referencial, pero se comprueba al
-- finalizar la transacción.

do $$
begin
  if to_regclass('public.abc_operaciones') is null
     or to_regclass('public.terminales_tpv') is null then
    raise exception 'ABC_F8_C04_PREFLIGHT_FALLO:abc_operaciones,terminales_tpv';
  end if;
end $$;

alter table public.abc_operaciones
  drop constraint if exists abc_operacion_terminal_fk;

alter table public.abc_operaciones
  add constraint abc_operacion_terminal_fk
  foreign key (empresa_id,local_id,terminal_id)
  references public.terminales_tpv(empresa_id,local_id,id)
  on delete restrict
  deferrable initially deferred;

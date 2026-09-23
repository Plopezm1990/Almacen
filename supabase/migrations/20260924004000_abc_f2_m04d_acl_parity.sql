-- ABC F2 M04D — paridad ACL y DEFAULT PRIVILEGES fail-closed.
-- Aditiva; no modifica datos ni RLS. Endurece únicamente grants de objetos ABC
-- y evita que futuros objetos creados por postgres hereden exposición implícita.

do $$
declare
  v_missing text[]:=array[]::text[];
  v_table text;
begin
  foreach v_table in array array[
    'terminales_tpv','abc_operaciones','abc_eventos','cajas_fisicas','caja_sesiones',
    'caja_sesion_terminales','caja_sesion_responsables','caja_cierres','caja_conteos',
    'efectos_pendientes','entidades_fiscales','entidad_fiscal_monedas','entidad_fiscal_locales',
    'entidad_fiscal_local_monedas','cuentas_comerciales','pedidos_tpv','pedido_lineas',
    'ventas_fiscales','venta_fiscal_lineas','checkouts','checkout_ventas','pagos',
    'pago_intentos','reservas_saldo','pago_aplicaciones','reembolsos','reembolso_aplicaciones'
  ]
  loop
    if to_regclass(format('public.%I',v_table)) is null then
      v_missing:=array_append(v_missing,v_table);
    end if;
  end loop;

  if to_regclass('public.abc_eventos_id_seq') is null then
    v_missing:=array_append(v_missing,'abc_eventos_id_seq');
  end if;

  if to_regprocedure('public.abc_reclamar_efectos(text,integer,integer)') is null then
    v_missing:=array_append(v_missing,'abc_reclamar_efectos');
  end if;
  if to_regprocedure('public.abc_reprogramar_efecto(uuid,text,timestamptz)') is null then
    v_missing:=array_append(v_missing,'abc_reprogramar_efecto');
  end if;
  if to_regprocedure('public.abc_registrar_error_efecto(uuid,text,jsonb,timestamptz)') is null then
    v_missing:=array_append(v_missing,'abc_registrar_error_efecto');
  end if;
  if to_regprocedure('public.abc_completar_efecto(uuid,text)') is null then
    v_missing:=array_append(v_missing,'abc_completar_efecto');
  end if;
  if to_regprocedure('public.abc_abandonar_efecto(uuid,text,jsonb)') is null then
    v_missing:=array_append(v_missing,'abc_abandonar_efecto');
  end if;
  if to_regprocedure('public.abc_resolver_intento(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb)') is null then
    v_missing:=array_append(v_missing,'abc_resolver_intento');
  end if;
  if to_regprocedure('public.abc_resolver_reembolso(text,text,text,uuid,text,text,text,jsonb,date)') is null then
    v_missing:=array_append(v_missing,'abc_resolver_reembolso');
  end if;

  if cardinality(v_missing)>0 then
    raise exception 'ABC_F2_M04D_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
end $$;

-- Contrato actual: ningún rol Data API muta tablas ABC directamente.
revoke all privileges
on table
  public.terminales_tpv,
  public.abc_operaciones,
  public.abc_eventos,
  public.cajas_fisicas,
  public.caja_sesiones,
  public.caja_sesion_terminales,
  public.caja_sesion_responsables,
  public.caja_cierres,
  public.caja_conteos,
  public.efectos_pendientes,
  public.entidades_fiscales,
  public.entidad_fiscal_monedas,
  public.entidad_fiscal_locales,
  public.entidad_fiscal_local_monedas,
  public.cuentas_comerciales,
  public.pedidos_tpv,
  public.pedido_lineas,
  public.ventas_fiscales,
  public.venta_fiscal_lineas,
  public.checkouts,
  public.checkout_ventas,
  public.pagos,
  public.pago_intentos,
  public.reservas_saldo,
  public.pago_aplicaciones,
  public.reembolsos,
  public.reembolso_aplicaciones
from anon, authenticated, service_role;

-- Lectura explícita del cliente autenticado. Las mutaciones se hacen por RPC.
grant select
on table
  public.terminales_tpv,
  public.cajas_fisicas,
  public.caja_sesiones,
  public.caja_sesion_terminales,
  public.caja_sesion_responsables,
  public.caja_cierres,
  public.caja_conteos,
  public.entidades_fiscales,
  public.entidad_fiscal_monedas,
  public.entidad_fiscal_locales,
  public.entidad_fiscal_local_monedas,
  public.cuentas_comerciales,
  public.pedidos_tpv,
  public.pedido_lineas,
  public.ventas_fiscales,
  public.venta_fiscal_lineas,
  public.checkouts,
  public.checkout_ventas,
  public.pagos,
  public.reembolsos
to authenticated;

-- El worker puede inspeccionar el outbox, pero lo muta únicamente por RPC SECURITY DEFINER.
grant select on table public.efectos_pendientes to service_role;

-- La secuencia de eventos no se consume directamente desde roles Data API.
revoke all privileges
on sequence public.abc_eventos_id_seq
from anon, authenticated, service_role;

-- Fail-closed para objetos futuros creados por postgres en public.
-- Cada migración futura debe declarar explícitamente sus GRANT.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated, service_role;

-- PostgreSQL concede EXECUTE a PUBLIC globalmente en funciones nuevas.
-- Ese default solo puede retirarse en el nivel global, no con IN SCHEMA.
alter default privileges for role postgres
  revoke execute on functions from public;

-- Revierte además cualquier GRANT por-schema heredado por los roles Data API.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;

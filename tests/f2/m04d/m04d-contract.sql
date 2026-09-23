\set ON_ERROR_STOP on

-- M04D — contrato exacto de grants de las 27 tablas ABC.
do $$
declare
  v_table text;
  v_priv text;
  v_expected_select boolean;
  v_read_tables text[]:=array[
    'terminales_tpv','cajas_fisicas','caja_sesiones','caja_sesion_terminales',
    'caja_sesion_responsables','caja_cierres','caja_conteos',
    'entidades_fiscales','entidad_fiscal_monedas','entidad_fiscal_locales',
    'entidad_fiscal_local_monedas','cuentas_comerciales','pedidos_tpv','pedido_lineas',
    'ventas_fiscales','venta_fiscal_lineas','checkouts','checkout_ventas','pagos','reembolsos'
  ];
  v_tables text[]:=array[
    'terminales_tpv','abc_operaciones','abc_eventos','cajas_fisicas','caja_sesiones',
    'caja_sesion_terminales','caja_sesion_responsables','caja_cierres','caja_conteos',
    'efectos_pendientes','entidades_fiscales','entidad_fiscal_monedas','entidad_fiscal_locales',
    'entidad_fiscal_local_monedas','cuentas_comerciales','pedidos_tpv','pedido_lineas',
    'ventas_fiscales','venta_fiscal_lineas','checkouts','checkout_ventas','pagos',
    'pago_intentos','reservas_saldo','pago_aplicaciones','reembolsos','reembolso_aplicaciones'
  ];
  v_privs text[]:=array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'];
begin
  foreach v_table in array v_tables loop
    if has_table_privilege('anon',format('public.%I',v_table),'SELECT') then
      raise exception 'M04D_FAIL: anon conserva SELECT sobre %',v_table;
    end if;

    foreach v_priv in array v_privs loop
      if has_table_privilege('anon',format('public.%I',v_table),v_priv) then
        raise exception 'M04D_FAIL: anon conserva % sobre %',v_priv,v_table;
      end if;
      if has_table_privilege('authenticated',format('public.%I',v_table),v_priv) then
        raise exception 'M04D_FAIL: authenticated conserva % sobre %',v_priv,v_table;
      end if;
      if has_table_privilege('service_role',format('public.%I',v_table),v_priv) then
        raise exception 'M04D_FAIL: service_role conserva % sobre %',v_priv,v_table;
      end if;
    end loop;

    v_expected_select:=v_table=any(v_read_tables);
    if has_table_privilege('authenticated',format('public.%I',v_table),'SELECT') is distinct from v_expected_select then
      raise exception 'M04D_FAIL: SELECT authenticated inesperado sobre % esperado=%',v_table,v_expected_select;
    end if;

    if has_table_privilege('service_role',format('public.%I',v_table),'SELECT')
       is distinct from (v_table='efectos_pendientes') then
      raise exception 'M04D_FAIL: SELECT service_role inesperado sobre %',v_table;
    end if;
  end loop;
end $$;

-- La secuencia ABC no queda expuesta directamente.
do $$
declare v_priv text;
begin
  foreach v_priv in array array['USAGE','SELECT','UPDATE'] loop
    if has_sequence_privilege('anon','public.abc_eventos_id_seq',v_priv)
       or has_sequence_privilege('authenticated','public.abc_eventos_id_seq',v_priv)
       or has_sequence_privilege('service_role','public.abc_eventos_id_seq',v_priv) then
      raise exception 'M04D_FAIL: privilegio % residual en abc_eventos_id_seq',v_priv;
    end if;
  end loop;
end $$;

-- RPC de sistema: solo service_role. Todas son SECURITY DEFINER y propiedad de postgres.
do $$
declare
  v_sig text;
  v_oid oid;
  v_system_rpcs text[]:=array[
    'public.abc_abandonar_efecto(uuid,text,jsonb)',
    'public.abc_completar_efecto(uuid,text)',
    'public.abc_reclamar_efectos(text,integer,integer)',
    'public.abc_registrar_error_efecto(uuid,text,jsonb,timestamptz)',
    'public.abc_reprogramar_efecto(uuid,text,timestamptz)',
    'public.abc_resolver_intento(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb)',
    'public.abc_resolver_reembolso(text,text,text,uuid,text,text,text,jsonb,date)'
  ];
begin
  foreach v_sig in array v_system_rpcs loop
    v_oid:=to_regprocedure(v_sig);
    if v_oid is null then raise exception 'M04D_FAIL: RPC sistema ausente %',v_sig; end if;

    if not exists(select 1 from pg_proc where oid=v_oid and prosecdef and pg_get_userbyid(proowner)='postgres') then
      raise exception 'M04D_FAIL: RPC sistema no es SECURITY DEFINER postgres %',v_sig;
    end if;

    if not has_function_privilege('service_role',v_oid,'EXECUTE')
       or has_function_privilege('authenticated',v_oid,'EXECUTE')
       or has_function_privilege('anon',v_oid,'EXECUTE') then
      raise exception 'M04D_FAIL: ACL RPC sistema incorrecta %',v_sig;
    end if;
  end loop;
end $$;

-- RPC de usuario: authenticated sí; anon y service_role no.
do $$
declare
  v_sig text;
  v_oid oid;
  v_user_rpcs text[]:=array[
    'public.abc_abrir_checkout(text,text,text,uuid,uuid,uuid[],date)',
    'public.abc_abrir_sesion_caja(text,text,text,uuid,uuid,uuid,uuid,text,numeric,date)',
    'public.abc_cambiar_responsable_caja(text,text,text,uuid,uuid,text,uuid,date)',
    'public.abc_cancelar_apertura_caja(text,text,text,uuid,text,uuid,date)',
    'public.abc_cancelar_reembolso(text,text,text,uuid,text,uuid,date)',
    'public.abc_confirmar_efectivo(text,text,text,uuid,uuid,uuid,uuid,date)',
    'public.abc_confirmar_reembolso_efectivo(text,text,text,uuid,uuid,uuid,uuid,date)',
    'public.abc_desvincular_terminal_caja(text,text,text,uuid,uuid,text,date)',
    'public.abc_iniciar_cobro(text,text,text,uuid,uuid,uuid,text,numeric,text,uuid,numeric,numeric)',
    'public.abc_registrar_movimiento_caja(text,text,text,uuid,uuid,uuid,text,text,numeric,text,text,date)',
    'public.abc_revertir_movimiento_caja(text,text,text,text,uuid,text,date)',
    'public.abc_solicitar_reembolso(text,text,text,uuid,uuid,numeric,text,uuid,date)',
    'public.abc_vincular_terminal_caja(text,text,text,uuid,uuid,date)'
  ];
begin
  foreach v_sig in array v_user_rpcs loop
    v_oid:=to_regprocedure(v_sig);
    if v_oid is null then raise exception 'M04D_FAIL: RPC usuario ausente %',v_sig; end if;

    if not has_function_privilege('authenticated',v_oid,'EXECUTE')
       or has_function_privilege('anon',v_oid,'EXECUTE')
       or has_function_privilege('service_role',v_oid,'EXECUTE') then
      raise exception 'M04D_FAIL: ACL RPC usuario incorrecta %',v_sig;
    end if;
  end loop;
end $$;

-- Helpers privados ABC nunca son API directa.
do $$
declare r record;
begin
  for r in
    select p.oid,n.nspname,p.proname
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='private'
       and p.proname like 'abc_%'
       and p.prokind in ('f','p')
  loop
    if has_function_privilege('anon',r.oid,'EXECUTE')
       or has_function_privilege('authenticated',r.oid,'EXECUTE')
       or has_function_privilege('service_role',r.oid,'EXECUTE') then
      raise exception 'M04D_FAIL: helper privado expuesto %.%',r.nspname,r.proname;
    end if;
  end loop;
end $$;

-- DEFAULT PRIVILEGES futuros: comprobar fail-closed con objetos efímeros.
begin;
create table public.abc_m04d_acl_probe_table(id integer);
create sequence public.abc_m04d_acl_probe_sequence;
create function public.abc_m04d_acl_probe_function()
returns integer
language sql
as $$ select 1 $$;

do $$
declare
  v_role text;
  v_priv text;
begin
  foreach v_role in array array['anon','authenticated','service_role'] loop
    foreach v_priv in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
      if has_table_privilege(v_role,'public.abc_m04d_acl_probe_table',v_priv) then
        raise exception 'M04D_FAIL: default table % para %',v_priv,v_role;
      end if;
    end loop;

    foreach v_priv in array array['USAGE','SELECT','UPDATE'] loop
      if has_sequence_privilege(v_role,'public.abc_m04d_acl_probe_sequence',v_priv) then
        raise exception 'M04D_FAIL: default sequence % para %',v_priv,v_role;
      end if;
    end loop;

    if has_function_privilege(v_role,'public.abc_m04d_acl_probe_function()','EXECUTE') then
      raise exception 'M04D_FAIL: default EXECUTE function para %',v_role;
    end if;
  end loop;
end $$;
rollback;

select 'ABC_F2_M04D_CONTRACT=PASS' as resultado;

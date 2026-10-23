-- ABC F5: notas TPV -> pedido_lineas -> comanda_lineas.
-- Se deja preparada para QA; esta etapa no aplica migraciones remotas por sí sola.

do $$
begin
  if to_regclass('public.pedido_lineas') is null then
    raise exception 'abc_f5_dependencia_ausente: pedido_lineas';
  end if;
  if to_regclass('public.pedidos_tpv') is null then
    raise exception 'abc_f5_dependencia_ausente: pedidos_tpv';
  end if;
  if to_regclass('public.comanda_lineas') is null then
    raise exception 'abc_f5_dependencia_ausente: comanda_lineas';
  end if;
end $$;

alter table public.pedido_lineas
  add column if not exists nota text not null default '';

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname='abc_linea_nota'
       and conrelid='public.pedido_lineas'::regclass
  ) then
    alter table public.pedido_lineas
      add constraint abc_linea_nota check (char_length(nota) <= 500);
  end if;
end $$;

create or replace function public.abc_actualizar_nota_linea(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid,
  p_nota text,
  p_expected_linea_version bigint,
  p_expected_pedido_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_pedido_id uuid;
  v_pedido public.pedidos_tpv%rowtype;
  v_linea public.pedido_lineas%rowtype;
  v_nota text := left(btrim(coalesce(p_nota,'')),500);
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
  v_new_pedido_version bigint;
  v_new_linea_version bigint;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'abc_linea_no_autorizada';
  end if;
  if p_linea_id is null or p_expected_linea_version is null or p_expected_pedido_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'linea_nota_parametros_requeridos';
  end if;
  if not private.abc_terminal_sesion_operativa(p_empresa_id,p_local_id,p_terminal_id,p_session_id) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  v_request:=jsonb_build_object(
    'linea_id',p_linea_id,'nota',v_nota,
    'expected_linea_version',p_expected_linea_version,
    'expected_pedido_version',p_expected_pedido_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_ACTUALIZAR_NOTA_LINEA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select pedido_id into v_pedido_id
    from public.pedido_lineas
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id;
  if not found then raise exception 'linea_no_encontrada'; end if;

  select * into v_pedido
    from public.pedidos_tpv
   where empresa_id=p_empresa_id and local_id=p_local_id and id=v_pedido_id
     and estado in ('BORRADOR','ABIERTO')
   for update;
  if not found then raise exception 'pedido_no_editable'; end if;
  if v_pedido.version<>p_expected_pedido_version then raise exception 'pedido_version_conflict'; end if;
  if v_pedido.created_operating_day<>p_operating_day then raise exception 'operating_day_pedido_inconsistente'; end if;

  select * into v_linea
    from public.pedido_lineas
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id
   for update;
  if not found then raise exception 'linea_no_encontrada'; end if;
  if v_linea.estado<>'BORRADOR' then raise exception 'linea_no_editable'; end if;
  if v_linea.version<>p_expected_linea_version then raise exception 'linea_version_conflict'; end if;

  update public.pedido_lineas
     set nota=v_nota, version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id
  returning version into v_new_linea_version;

  update public.pedidos_tpv
     set version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=v_pedido_id
  returning version into v_new_pedido_version;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'PEDIDO_LINEA',p_linea_id::text,
    'PEDIDO_LINEA_NOTA_ACTUALIZADA',
    jsonb_build_object(
      'pedido_id',v_pedido_id,'nota',v_nota,
      'linea_version',v_new_linea_version,'pedido_version',v_new_pedido_version,
      'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'linea_id',p_linea_id,'linea_version',v_new_linea_version,
    'pedido_id',v_pedido_id,'pedido_version',v_new_pedido_version,'nota',v_nota
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

revoke all on function public.abc_actualizar_nota_linea(
  text,text,text,uuid,text,bigint,bigint,uuid,uuid,date
) from public,anon,service_role;
grant execute on function public.abc_actualizar_nota_linea(
  text,text,text,uuid,text,bigint,bigint,uuid,uuid,date
) to authenticated;

create or replace function private.abc_f5_copiar_nota_comanda()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_nota text;
begin
  if nullif(btrim(coalesce(new.nota,'')),'') is not null then
    return new;
  end if;
  select nullif(btrim(pl.nota),'') into v_nota
    from public.pedido_lineas pl
   where pl.id=new.linea_id
     and pl.empresa_id=new.empresa_id
     and pl.local_id=new.local_id;
  if v_nota is not null then
    update public.comanda_lineas set nota=v_nota where id=new.id;
  end if;
  return new;
end $$;

revoke all on function private.abc_f5_copiar_nota_comanda() from public,anon,authenticated,service_role;
drop trigger if exists abc_f5_comanda_linea_copia_nota on public.comanda_lineas;
create trigger abc_f5_comanda_linea_copia_nota
after insert on public.comanda_lineas
for each row execute function private.abc_f5_copiar_nota_comanda();

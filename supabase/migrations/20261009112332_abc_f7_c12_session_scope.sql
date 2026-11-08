-- ABC F7 C12. Vincula documentos C05 a una sesion y limita el ensayo a ella.

do $$
declare
  v_reserva text;
  v_ensayo text;
begin
  if to_regclass('public.abc_c05_documentos_emitidos') is null then
    raise exception 'ABC_F7_C12_SESSION_PREFLIGHT_FALLO:falta_tabla_C05';
  end if;
  if to_regclass('public.caja_sesiones') is null then
    raise exception 'ABC_F7_C12_SESSION_PREFLIGHT_FALLO:falta_tabla_sesiones';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='abc_c05_documentos_emitidos'
       and column_name='session_id'
  ) then
    raise exception 'ABC_F7_C12_SESSION_PREFLIGHT_FALLO:session_id_ya_existe';
  end if;

  select pg_get_functiondef(
    'public.abc_reservar_numero_documental(text,text,text,text,text,text,jsonb)'::regprocedure
  ) into v_reserva;
  if position('v_numero bigint;' in v_reserva)=0
     or position('operation_id,documento_origen_id,resultado' in v_reserva)=0 then
    raise exception 'ABC_F7_C12_SESSION_PREFLIGHT_FALLO:definicion_C05_inesperada';
  end if;

  select pg_get_functiondef(
    'public.abc_ensayar_cierre_sesion_caja(text,text,text,uuid,uuid,date)'::regprocedure
  ) into v_ensayo;
  if position('order by r.documento_id,r.revision desc' in v_ensayo)=0 then
    raise exception 'ABC_F7_C12_SESSION_PREFLIGHT_FALLO:definicion_C12_inesperada';
  end if;
end $$;

alter table public.abc_c05_documentos_emitidos
  add column session_id uuid;

alter table public.abc_c05_documentos_emitidos
  add constraint abc_c05_documento_session_fk
  foreign key (empresa_id,local_id,session_id)
  references public.caja_sesiones(empresa_id,local_id,id)
  on delete restrict;

create index abc_c05_documento_session_idx
  on public.abc_c05_documentos_emitidos(empresa_id,local_id,session_id,created_at desc)
  where session_id is not null;

create or replace function private.abc_c05_guard_documento()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.empresa_id<>new.empresa_id
     or old.local_id<>new.local_id
     or old.serie_id<>new.serie_id
     or old.tipo_documento<>new.tipo_documento
     or old.codigo_serie<>new.codigo_serie
     or old.numero<>new.numero
     or old.operation_id<>new.operation_id
     or old.session_id is distinct from new.session_id then
    raise exception 'documento_identidad_inmutable';
  end if;
  if old.estado='EMITIDO' and (new.estado<>old.estado or new.resultado<>old.resultado) then
    raise exception 'documento_emitido_inmutable';
  end if;
  return new;
end $$;

revoke all on function private.abc_c05_guard_documento()
  from public,anon,authenticated,service_role;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.abc_reservar_numero_documental(text,text,text,text,text,text,jsonb)'::regprocedure
  ) into v_definition;

  v_definition:=replace(
    v_definition,
    E'  v_numero bigint;\nbegin',
    E'  v_numero bigint;\n  v_session_id uuid;\nbegin'
  );
  v_definition:=replace(
    v_definition,
    E'  v_request:=jsonb_build_object(',
    E'  if coalesce(p_metadata,''{}''::jsonb) ? ''session_id'' then\n'
      || E'    begin\n'
      || E'      v_session_id:=nullif(p_metadata->>''session_id'','''')::uuid;\n'
      || E'    exception when invalid_text_representation then\n'
      || E'      raise exception ''sesion_documental_invalida'';\n'
      || E'    end;\n'
      || E'    if v_session_id is null or not exists (\n'
      || E'      select 1 from public.caja_sesiones s\n'
      || E'       where s.empresa_id=p_empresa_id and s.local_id=p_local_id\n'
      || E'         and s.id=v_session_id\n'
      || E'    ) then\n'
      || E'      raise exception ''sesion_documental_no_encontrada'';\n'
      || E'    end if;\n'
      || E'  end if;\n\n'
      || E'  v_request:=jsonb_build_object('
  );
  v_definition:=replace(
    v_definition,
    'operation_id,documento_origen_id,resultado',
    'operation_id,documento_origen_id,session_id,resultado'
  );
  v_definition:=replace(
    v_definition,
    'p_operation_id,p_documento_origen_id,v_request',
    'p_operation_id,p_documento_origen_id,v_session_id,v_request'
  );
  v_definition:=replace(
    v_definition,
    E'      ''documento_origen_id'',p_documento_origen_id\n    )',
    E'      ''documento_origen_id'',p_documento_origen_id,''session_id'',v_session_id\n    )'
  );
  v_definition:=replace(
    v_definition,
    E'    ''autoridad'',v_serie.autoridad\n  );',
    E'    ''autoridad'',v_serie.autoridad,''session_id'',v_session_id\n  );'
  );
  execute v_definition;

  select pg_get_functiondef(
    'public.abc_reservar_numero_documental(text,text,text,text,text,text,jsonb)'::regprocedure
  ) into v_definition;
  if position('v_session_id uuid;' in v_definition)=0
     or position('sesion_documental_no_encontrada' in v_definition)=0
     or position('operation_id,documento_origen_id,session_id,resultado' in v_definition)=0 then
    raise exception 'ABC_F7_C12_SESSION_POSTFLIGHT_FALLO:reserva_no_actualizada';
  end if;
end $$;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.abc_ensayar_cierre_sesion_caja(text,text,text,uuid,uuid,date)'::regprocedure
  ) into v_definition;

  v_definition:=replace(
    v_definition,
    E'       order by r.documento_id,r.revision desc\n    ) latest;',
    E'       order by r.documento_id,r.revision desc\n'
      || E'    ) latest\n'
      || E'    join public.abc_c05_documentos_emitidos d\n'
      || E'      on d.empresa_id=p_empresa_id and d.local_id=p_local_id\n'
      || E'     and d.id=latest.documento_id\n'
      || E'   where d.session_id=p_session_id;'
  );
  execute v_definition;

  select pg_get_functiondef(
    'public.abc_ensayar_cierre_sesion_caja(text,text,text,uuid,uuid,date)'::regprocedure
  ) into v_definition;
  if position('where d.session_id=p_session_id' in v_definition)=0 then
    raise exception 'ABC_F7_C12_SESSION_POSTFLIGHT_FALLO:ensayo_no_acotado';
  end if;
end $$;

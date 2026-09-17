-- P2 · PM13 · fichajes seguros post-reset
-- Restaura el contrato de PM13-P03 sobre el sustrato PM11 reconciliado.
-- Endurece aislamiento tenant/local, replay, concurrencia y ACL/RLS.

begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $preflight$
declare v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.fichajes_registro') is null then v_missing:=array_append(v_missing,'fichajes_registro'); end if;
  if to_regclass('public.empleados') is null then v_missing:=array_append(v_missing,'empleados'); end if;
  if to_regclass('public.perfiles') is null then v_missing:=array_append(v_missing,'perfiles'); end if;
  if to_regclass('public.membresias_usuario') is null then v_missing:=array_append(v_missing,'membresias_usuario'); end if;
  if to_regprocedure('auth.uid()') is null then v_missing:=array_append(v_missing,'auth.uid'); end if;
  if to_regprocedure('private.la_usuario_activo()') is null then v_missing:=array_append(v_missing,'la_usuario_activo'); end if;
  if to_regprocedure('private.pm11_local_activo(text,text)') is null then v_missing:=array_append(v_missing,'pm11_local_activo'); end if;
  if to_regprocedure('private.pm11_puede_mutar_personal(text,text)') is null then v_missing:=array_append(v_missing,'pm11_puede_mutar_personal'); end if;
  if to_regprocedure('private.pm11_puede_ver_personal(text,text)') is null then v_missing:=array_append(v_missing,'pm11_puede_ver_personal'); end if;
  if to_regprocedure('private.pm11_auditar_empleado(text,text,text,text,jsonb)') is null then v_missing:=array_append(v_missing,'pm11_auditar_empleado'); end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then v_missing:=array_append(v_missing,'authenticated'); end if;
  if not exists(select 1 from pg_roles where rolname='anon') then v_missing:=array_append(v_missing,'anon'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'P2_PM13_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if exists(
    select 1 from (values
      ('fichajes_registro','id','text'),('fichajes_registro','fecha','date'),('fichajes_registro','datos','jsonb'),('fichajes_registro','creado_en','timestamp with time zone'),
      ('empleados','id','text'),('empleados','empresa_id','text'),('empleados','local_id','text'),('empleados','estado','text'),
      ('perfiles','user_id','uuid'),('perfiles','empleado_id','text'),('perfiles','activo','boolean'),
      ('membresias_usuario','user_id','uuid'),('membresias_usuario','empresa_id','text'),('membresias_usuario','local_id','text'),('membresias_usuario','todos_locales','boolean'),('membresias_usuario','activo','boolean')
    ) r(t,c,d)
    where not exists(
      select 1 from information_schema.columns x
      where x.table_schema='public' and x.table_name=r.t and x.column_name=r.c and x.data_type=r.d
    )
  ) then raise exception 'P2_PM13_PREFLIGHT_FALLO:contrato_incompatible'; end if;
end $preflight$;

create or replace function private.pm13_fichaje_actor_es_empleado(p_empleado_id text)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select private.la_usuario_activo()
     and exists (
       select 1
         from public.perfiles p
         join public.empleados e on e.id=p.empleado_id
        where p.user_id=(select auth.uid())
          and p.activo=true
          and p.empleado_id=p_empleado_id
          and e.estado='activo'
          and private.pm11_local_activo(e.empresa_id,e.local_id)
          and exists (
            select 1
              from public.membresias_usuario m
             where m.user_id=p.user_id
               and m.empresa_id=e.empresa_id
               and m.activo=true
               and (m.todos_locales=true or m.local_id=e.local_id)
          )
     );
$function$;

create or replace function private.pm13_fichaje_secuencia_valida(
  p_empleado_id text,
  p_local_id text,
  p_ignorar_id text default null,
  p_candidato jsonb default null
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  with eventos as (
    select f.id,
           f.fecha::text as fecha,
           f.datos->>'hora' as hora,
           f.datos->>'tipo' as tipo
      from public.fichajes_registro f
     where f.datos->>'empleadoId'=p_empleado_id
       and f.datos->>'localId'=p_local_id
       and (p_ignorar_id is null or f.id<>p_ignorar_id)
       and coalesce(lower(f.datos->>'anulado'),'false')<>'true'
    union all
    select '__pm13_candidato__',
           p_candidato->>'fecha',
           p_candidato->>'hora',
           p_candidato->>'tipo'
     where p_candidato is not null
  ), ordenados as (
    select e.*,
           row_number() over(order by e.fecha,e.hora,e.id) as rn,
           lag(e.tipo) over(order by e.fecha,e.hora,e.id) as tipo_anterior,
           count(*) over(partition by e.fecha,e.hora) as mismos_minuto
      from eventos e
  )
  select not exists(
    select 1 from ordenados o
     where o.fecha is null
        or o.fecha !~ '^\d{4}-\d{2}-\d{2}$'
        or o.hora is null
        or o.hora !~ '^([01]\d|2[0-3]):[0-5]\d$'
        or o.tipo not in('entrada','salida')
        or o.mismos_minuto>1
        or (o.rn=1 and o.tipo<>'entrada')
        or (o.rn>1 and o.tipo=o.tipo_anterior)
  );
$function$;

create or replace function public.pm13_fichar(
  p_empleado_id text,
  p_local_id text,
  p_tipo text,
  p_operation_id text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_emp public.empleados%rowtype;
  v_existente public.fichajes_registro%rowtype;
  v_id text;
  v_ahora timestamptz;
  v_fecha date;
  v_hora text;
  v_datos jsonb;
begin
  if (select auth.uid()) is null or not private.la_usuario_activo() then raise exception 'fichaje_sesion_no_autorizada'; end if;
  if nullif(btrim(coalesce(p_operation_id,'')),'') is null then raise exception 'fichaje_operation_id_requerido'; end if;
  if p_tipo not in('entrada','salida') then raise exception 'fichaje_tipo_invalido'; end if;
  if nullif(btrim(coalesce(p_local_id,'')),'') is null or upper(btrim(p_local_id)) in('TODOS','TODOS LOS LOCALES') then
    raise exception 'fichaje_local_concreto_requerido';
  end if;

  select * into v_emp from public.empleados e where e.id=p_empleado_id for share;
  if not found or v_emp.local_id<>p_local_id or v_emp.estado<>'activo' or not private.pm11_local_activo(v_emp.empresa_id,v_emp.local_id) then
    raise exception 'fichaje_empleado_no_activo_o_fuera_de_local';
  end if;
  if not private.pm13_fichaje_actor_es_empleado(v_emp.id) and not private.pm11_puede_mutar_personal(v_emp.empresa_id,v_emp.local_id) then
    raise exception 'fichaje_actor_no_autorizado';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:fichaje-op:'||p_operation_id,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:fichaje:'||v_emp.id,0));

  select * into v_existente
    from public.fichajes_registro f
   where f.datos->>'operationId'=p_operation_id
   order by f.creado_en desc limit 1;
  if found then
    if v_existente.datos->>'empleadoId'=v_emp.id
       and v_existente.datos->>'localId'=v_emp.local_id
       and v_existente.datos->>'tipo'=p_tipo
       and coalesce(lower(v_existente.datos->>'manual'),'false')='false' then
      return jsonb_build_object('ok',true,'replay',true,'fichaje',v_existente.datos);
    end if;
    raise exception 'fichaje_operation_id_conflicto';
  end if;

  v_ahora:=pg_catalog.clock_timestamp();
  v_fecha:=current_date;
  v_hora:=to_char(v_ahora,'HH24:MI');
  v_id:='fichaje-'||pg_catalog.gen_random_uuid()::text;
  v_datos:=jsonb_build_object('id',v_id,'empleadoId',v_emp.id,'localId',v_emp.local_id,'fecha',v_fecha::text,'hora',v_hora,'tipo',p_tipo,'timestamp',v_ahora,'operationId',p_operation_id,'manual',false,'anulado',false);

  if not private.pm13_fichaje_secuencia_valida(v_emp.id,v_emp.local_id,null,v_datos) then
    return jsonb_build_object('ok',false,'codigo',case when p_tipo='entrada' then 'FICHAJE_YA_ABIERTO' else 'FICHAJE_SIN_ENTRADA_ABIERTA' end);
  end if;

  insert into public.fichajes_registro(id,fecha,datos) values(v_id,v_fecha,v_datos);
  perform private.pm11_auditar_empleado('Personal · fichaje '||p_tipo,v_emp.id,v_emp.empresa_id,v_emp.local_id,jsonb_build_object('fichajeId',v_id,'operationIdInformado',true));
  return jsonb_build_object('ok',true,'replay',false,'fichaje',v_datos);
end;
$function$;

create or replace function public.pm13_fichaje_manual(
  p_empleado_id text,
  p_local_id text,
  p_fecha date,
  p_hora text,
  p_tipo text,
  p_operation_id text,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_emp public.empleados%rowtype;
  v_existente public.fichajes_registro%rowtype;
  v_id text;
  v_datos jsonb;
begin
  if (select auth.uid()) is null or not private.la_usuario_activo() then raise exception 'fichaje_sesion_no_autorizada'; end if;
  if nullif(btrim(coalesce(p_operation_id,'')),'') is null then raise exception 'fichaje_operation_id_requerido'; end if;
  if p_tipo not in('entrada','salida') or p_hora !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception 'fichaje_manual_datos_invalidos'; end if;
  if p_fecha is null or p_fecha>current_date then raise exception 'fichaje_manual_fecha_invalida'; end if;

  select * into v_emp from public.empleados e where e.id=p_empleado_id for share;
  if not found or v_emp.local_id<>p_local_id or v_emp.estado<>'activo' or not private.pm11_local_activo(v_emp.empresa_id,v_emp.local_id) then
    raise exception 'fichaje_empleado_no_activo_o_fuera_de_local';
  end if;
  if not private.pm11_puede_mutar_personal(v_emp.empresa_id,v_emp.local_id) then raise exception 'fichaje_manual_no_autorizado'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:fichaje-op:'||p_operation_id,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:fichaje:'||v_emp.id,0));

  select * into v_existente from public.fichajes_registro f where f.datos->>'operationId'=p_operation_id order by f.creado_en desc limit 1;
  if found then
    if v_existente.datos->>'empleadoId'=v_emp.id
       and v_existente.datos->>'localId'=v_emp.local_id
       and v_existente.datos->>'tipo'=p_tipo
       and v_existente.fecha=p_fecha
       and v_existente.datos->>'hora'=p_hora
       and coalesce(lower(v_existente.datos->>'manual'),'false')='true' then
      return jsonb_build_object('ok',true,'replay',true,'fichaje',v_existente.datos);
    end if;
    raise exception 'fichaje_operation_id_conflicto';
  end if;

  v_id:='fichaje-'||pg_catalog.gen_random_uuid()::text;
  v_datos:=jsonb_build_object('id',v_id,'empleadoId',v_emp.id,'localId',v_emp.local_id,'fecha',p_fecha::text,'hora',p_hora,'tipo',p_tipo,'timestamp',p_fecha::text||'T'||p_hora||':00','operationId',p_operation_id,'manual',true,'motivoManual',nullif(btrim(coalesce(p_motivo,'')),''),'anulado',false);
  if not private.pm13_fichaje_secuencia_valida(v_emp.id,v_emp.local_id,null,v_datos) then return jsonb_build_object('ok',false,'codigo','FICHAJE_SECUENCIA_INVALIDA'); end if;

  insert into public.fichajes_registro(id,fecha,datos) values(v_id,p_fecha,v_datos);
  perform private.pm11_auditar_empleado('Personal · fichaje manual',v_emp.id,v_emp.empresa_id,v_emp.local_id,jsonb_build_object('fichajeId',v_id,'tipo',p_tipo,'fecha',p_fecha,'hora',p_hora));
  return jsonb_build_object('ok',true,'replay',false,'fichaje',v_datos);
end;
$function$;

create or replace function public.pm13_corregir_fichaje(
  p_fichaje_id text,
  p_fecha date,
  p_hora text,
  p_tipo text,
  p_operation_id text,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_reg public.fichajes_registro%rowtype;
  v_emp public.empleados%rowtype;
  v_datos jsonb;
  v_original jsonb;
  v_historial jsonb;
  v_op_fichaje_id text;
  v_op_entry jsonb;
begin
  if (select auth.uid()) is null or not private.la_usuario_activo() then raise exception 'fichaje_sesion_no_autorizada'; end if;
  if nullif(btrim(coalesce(p_operation_id,'')),'') is null or nullif(btrim(coalesce(p_motivo,'')),'') is null then raise exception 'fichaje_correccion_operacion_y_motivo_requeridos'; end if;
  if p_tipo not in('entrada','salida') or p_hora !~ '^([01]\d|2[0-3]):[0-5]\d$' or p_fecha is null or p_fecha>current_date then raise exception 'fichaje_correccion_datos_invalidos'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:correccion-op:'||p_operation_id,0));

  select f.id,h.elem into v_op_fichaje_id,v_op_entry
    from public.fichajes_registro f
    cross join lateral jsonb_array_elements(case when jsonb_typeof(f.datos->'historialCorrecciones')='array' then f.datos->'historialCorrecciones' else '[]'::jsonb end) h(elem)
   where h.elem->>'operationId'=p_operation_id
   limit 1;
  if found then
    if v_op_fichaje_id=p_fichaje_id
       and v_op_entry->'despues'=jsonb_build_object('fecha',p_fecha::text,'hora',p_hora,'tipo',p_tipo)
       and v_op_entry->>'motivo'=btrim(p_motivo) then
      select * into v_reg from public.fichajes_registro f where f.id=p_fichaje_id;
      return jsonb_build_object('ok',true,'replay',true,'fichaje',v_reg.datos);
    end if;
    raise exception 'fichaje_correccion_operation_id_conflicto';
  end if;

  select * into v_reg from public.fichajes_registro f where f.id=p_fichaje_id for update;
  if not found then raise exception 'fichaje_no_encontrado'; end if;
  if coalesce(lower(v_reg.datos->>'anulado'),'false')='true' then raise exception 'fichaje_anulado_no_editable'; end if;

  select * into v_emp from public.empleados e where e.id=v_reg.datos->>'empleadoId' for share;
  if not found or v_emp.local_id<>v_reg.datos->>'localId' or not private.pm11_local_activo(v_emp.empresa_id,v_emp.local_id) then raise exception 'fichaje_contexto_invalido'; end if;
  if not private.pm11_puede_mutar_personal(v_emp.empresa_id,v_emp.local_id) then raise exception 'fichaje_correccion_no_autorizada'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:fichaje:'||v_emp.id,0));

  v_datos:=v_reg.datos||jsonb_build_object('fecha',p_fecha::text,'hora',p_hora,'tipo',p_tipo,'timestamp',p_fecha::text||'T'||p_hora||':00','corregido',true,'corregidoAt',pg_catalog.clock_timestamp(),'motivoCorreccion',btrim(p_motivo),'ultimaCorreccionOperationId',p_operation_id);
  if not private.pm13_fichaje_secuencia_valida(v_emp.id,v_emp.local_id,v_reg.id,v_datos) then return jsonb_build_object('ok',false,'codigo','FICHAJE_SECUENCIA_INVALIDA'); end if;

  v_original:=coalesce(v_reg.datos->'original',jsonb_build_object('fecha',v_reg.datos->>'fecha','hora',v_reg.datos->>'hora','tipo',v_reg.datos->>'tipo','timestamp',v_reg.datos->>'timestamp'));
  v_historial:=coalesce(case when jsonb_typeof(v_reg.datos->'historialCorrecciones')='array' then v_reg.datos->'historialCorrecciones' else '[]'::jsonb end,'[]'::jsonb)
    || jsonb_build_array(jsonb_build_object(
      'operationId',p_operation_id,
      'antes',jsonb_build_object('fecha',v_reg.datos->>'fecha','hora',v_reg.datos->>'hora','tipo',v_reg.datos->>'tipo'),
      'despues',jsonb_build_object('fecha',p_fecha::text,'hora',p_hora,'tipo',p_tipo),
      'motivo',btrim(p_motivo),
      'corregidoAt',pg_catalog.clock_timestamp()
    ));
  v_datos:=v_datos||jsonb_build_object('original',v_original,'historialCorrecciones',v_historial);

  update public.fichajes_registro set fecha=p_fecha,datos=v_datos where id=v_reg.id;
  perform private.pm11_auditar_empleado('Personal · corregir fichaje',v_emp.id,v_emp.empresa_id,v_emp.local_id,jsonb_build_object('fichajeId',v_reg.id,'operationId',p_operation_id,'motivoInformado',true));
  return jsonb_build_object('ok',true,'replay',false,'fichaje',v_datos);
end;
$function$;

create or replace function public.pm13_anular_fichaje(
  p_fichaje_id text,
  p_operation_id text,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_reg public.fichajes_registro%rowtype;
  v_emp public.empleados%rowtype;
  v_datos jsonb;
  v_op_reg public.fichajes_registro%rowtype;
begin
  if (select auth.uid()) is null or not private.la_usuario_activo() then raise exception 'fichaje_sesion_no_autorizada'; end if;
  if nullif(btrim(coalesce(p_operation_id,'')),'') is null or nullif(btrim(coalesce(p_motivo,'')),'') is null then raise exception 'fichaje_anulacion_operacion_y_motivo_requeridos'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:anulacion-op:'||p_operation_id,0));
  select * into v_op_reg from public.fichajes_registro f where f.datos->>'anulacionOperationId'=p_operation_id order by f.creado_en desc limit 1;
  if found then
    if v_op_reg.id=p_fichaje_id and v_op_reg.datos->>'motivoAnulacion'=btrim(p_motivo) then
      return jsonb_build_object('ok',true,'replay',true,'fichaje',v_op_reg.datos);
    end if;
    raise exception 'fichaje_anulacion_operation_id_conflicto';
  end if;

  select * into v_reg from public.fichajes_registro f where f.id=p_fichaje_id for update;
  if not found then raise exception 'fichaje_no_encontrado'; end if;

  select * into v_emp from public.empleados e where e.id=v_reg.datos->>'empleadoId' for share;
  if not found or v_emp.local_id<>v_reg.datos->>'localId' or not private.pm11_local_activo(v_emp.empresa_id,v_emp.local_id) then raise exception 'fichaje_contexto_invalido'; end if;
  if not private.pm11_puede_mutar_personal(v_emp.empresa_id,v_emp.local_id) then raise exception 'fichaje_anulacion_no_autorizada'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:fichaje:'||v_emp.id,0));

  if coalesce(lower(v_reg.datos->>'anulado'),'false')='true' then raise exception 'fichaje_ya_anulado'; end if;
  if not private.pm13_fichaje_secuencia_valida(v_emp.id,v_emp.local_id,v_reg.id,null) then return jsonb_build_object('ok',false,'codigo','FICHAJE_ANULACION_ROMPE_SECUENCIA'); end if;

  v_datos:=v_reg.datos||jsonb_build_object('anulado',true,'anuladoAt',pg_catalog.clock_timestamp(),'motivoAnulacion',btrim(p_motivo),'anulacionOperationId',p_operation_id);
  update public.fichajes_registro set datos=v_datos where id=v_reg.id;
  perform private.pm11_auditar_empleado('Personal · anular fichaje',v_emp.id,v_emp.empresa_id,v_emp.local_id,jsonb_build_object('fichajeId',v_reg.id,'operationId',p_operation_id,'motivoInformado',true));
  return jsonb_build_object('ok',true,'replay',false,'fichaje',v_datos);
end;
$function$;

-- operationId de alta de fichaje es global: evita doble escritura y carreras entre empleados.
drop index if exists public.pm13_fichajes_operation_id_empleado_uq;
create unique index if not exists pm13_fichajes_operation_id_uq
  on public.fichajes_registro((datos->>'operationId'))
  where nullif(btrim(datos->>'operationId'),'') is not null;
create index if not exists pm13_fichajes_empleado_local_fecha_idx
  on public.fichajes_registro((datos->>'empleadoId'),(datos->>'localId'),fecha,id);

alter table public.fichajes_registro enable row level security;
do $policies$
declare v record;
begin
  for v in select policyname from pg_policies where schemaname='public' and tablename='fichajes_registro' loop
    execute format('drop policy %I on public.fichajes_registro',v.policyname);
  end loop;
end $policies$;

create policy pm13_fichajes_select_scope
on public.fichajes_registro
for select
to authenticated
using (
  exists (
    select 1 from public.empleados e
     where e.id=fichajes_registro.datos->>'empleadoId'
       and e.local_id=fichajes_registro.datos->>'localId'
       and (private.pm11_puede_ver_personal(e.empresa_id,e.local_id) or private.pm13_fichaje_actor_es_empleado(e.id))
  )
);

revoke all privileges on table public.fichajes_registro from public,anon,authenticated;
grant select on table public.fichajes_registro to authenticated;

revoke all on function private.pm13_fichaje_actor_es_empleado(text) from public,anon,authenticated;
revoke all on function private.pm13_fichaje_secuencia_valida(text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.pm13_fichar(text,text,text,text) from public,anon,authenticated;
revoke all on function public.pm13_fichaje_manual(text,text,date,text,text,text,text) from public,anon,authenticated;
revoke all on function public.pm13_corregir_fichaje(text,date,text,text,text,text) from public,anon,authenticated;
revoke all on function public.pm13_anular_fichaje(text,text,text) from public,anon,authenticated;

grant execute on function private.pm13_fichaje_actor_es_empleado(text) to authenticated;
grant execute on function public.pm13_fichar(text,text,text,text) to authenticated;
grant execute on function public.pm13_fichaje_manual(text,text,date,text,text,text,text) to authenticated;
grant execute on function public.pm13_corregir_fichaje(text,date,text,text,text,text) to authenticated;
grant execute on function public.pm13_anular_fichaje(text,text,text) to authenticated;

commit;

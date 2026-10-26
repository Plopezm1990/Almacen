-- Plan Maestro L&A Suite — Etapa 5, T6, punto 3: factura a empresa (NIF).
-- Hoja QA-5 (Pedro, 24/10/2026).
--
-- El sistema de documentos fiscales (series C05, clasificación C06, puerta
-- fiscal C07) ya existe y ya está aplicado en QA, pero nunca se conectó a
-- pantalla y, sobre todo, nunca hubo forma de crear una serie documental —
-- solo de reservar un número de una serie ya existente. Esta migración
-- añade esa única pieza que faltaba; todo lo demás (abc_reservar_numero_
-- documental, abc_clasificar_documento, abc_configurar_modalidad_fiscal,
-- abc_evaluar_documento_fiscal, abc_resolver_emision_documental) ya existe
-- y no se toca.
--
-- No activa nada fiscal de verdad: abc_configurar_modalidad_fiscal (ya
-- existente) rechaza por código pasar a estado ACTIVO sin validación de
-- asesoría; aquí solo se usa en modo SIMULADOR.

do $$
begin
  if to_regclass('public.abc_c05_series_documentales') is null then
    raise exception 'T6_FACTURA_PREFLIGHT_FALLO: falta abc_c05_series_documentales';
  end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null
     or to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null
     or to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null
     or to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then
    raise exception 'T6_FACTURA_PREFLIGHT_FALLO: helpers ausentes';
  end if;
  if to_regprocedure('public.abc_configurar_serie_documental(text,text,text,text,text,text)') is not null then
    raise exception 'T6_FACTURA_PREFLIGHT_FALLO: RPC ya existe';
  end if;
end $$;

create or replace function public.abc_configurar_serie_documental(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_tipo_documento text,
  p_codigo_serie text,
  p_nombre text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_cmd jsonb;
  v_result jsonb;
  v_request jsonb;
  v_tipo text:=upper(btrim(coalesce(p_tipo_documento,'')));
  v_codigo text:=upper(btrim(coalesce(p_codigo_serie,'')));
  v_nombre text:=nullif(btrim(coalesce(p_nombre,'')),'');
  v_serie public.abc_c05_series_documentales%rowtype;
  v_nueva boolean;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_EMISOR_CAMBIAR') then
    raise exception 'abc_serie_no_autorizada';
  end if;
  if p_operation_id is null or v_tipo !~ '^[A-Z][A-Z0-9_]{1,39}$'
     or v_codigo !~ '^[A-Z0-9][A-Z0-9._/-]{0,19}$' then
    raise exception 'serie_documental_parametros_invalidos';
  end if;

  v_request:=jsonb_build_object('tipo_documento',v_tipo,'codigo_serie',v_codigo,'nombre',v_nombre);
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIGURAR_SERIE_DOCUMENTAL',v_request,null
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_serie
    from public.abc_c05_series_documentales s
   where s.empresa_id=p_empresa_id and s.local_id=p_local_id
     and s.tipo_documento=v_tipo and s.codigo_serie=v_codigo
   for update;
  v_nueva:=not found;
  if v_nueva then
    insert into public.abc_c05_series_documentales(
      empresa_id,local_id,tipo_documento,codigo_serie,nombre,autoridad,siguiente_numero,activa
    ) values (
      p_empresa_id,p_local_id,v_tipo,v_codigo,v_nombre,'INTERNA',1,true
    ) returning * into v_serie;
  elsif not v_serie.activa then
    -- Reactivar una serie existente nunca reinicia su numeración: eso
    -- rompería la correlatividad legal del número. Solo cambia "activa".
    update public.abc_c05_series_documentales
       set activa=true, updated_at=now()
     where id=v_serie.id
     returning * into v_serie;
  end if;

  v_result:=jsonb_build_object(
    'ok',true,'serie_id',v_serie.id,'nueva',v_nueva,
    'tipo_documento',v_serie.tipo_documento,'codigo_serie',v_serie.codigo_serie,
    'siguiente_numero',v_serie.siguiente_numero,'activa',v_serie.activa
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

comment on function public.abc_configurar_serie_documental is
  'T6 Hoja QA-5: crea (o reactiva, sin reiniciar su numeración) una serie documental. Pieza que faltaba en C05: antes solo se podía reservar número de una serie ya existente, nunca crear una.';

revoke all on function public.abc_configurar_serie_documental(text,text,text,text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.abc_configurar_serie_documental(text,text,text,text,text,text)
  to authenticated;

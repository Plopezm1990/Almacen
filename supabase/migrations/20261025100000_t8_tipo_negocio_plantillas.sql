-- Plan Maestro L&A Suite — Etapa 6, T8 (pieza 4): tipo de negocio + biblioteca de ejemplo.
--
-- Fecha: 25/10/2026. Autorización: Pedro (chat, 24-25/10/2026), alcance elegido entre tres
-- opciones: "tipo + biblioteca de opciones de ejemplo".
--
-- Qué hace (aditiva; no toca ninguna fila existente de empresas, no crea ninguna tabla nueva):
--  1. `empresas.tipo_negocio` (nullable): BAR, RESTAURANTE, CAFETERIA, PASTELERIA, TIENDA u
--     OTRO. Solo una etiqueta informativa para ofrecer plantillas de ejemplo; no condiciona
--     ningún comportamiento fiscal ni operativo.
--  2. `abc_guardar_tipo_negocio`: guarda el tipo (exige ser Propietario de toda la empresa,
--     igual que ya exige la gestión de cargos: `abc_config_puede_configurar_empresa`) y, si
--     se pide, siembra en la biblioteca de opciones de este local (T8 pieza 1) unos grupos de
--     ejemplo típicos de ese tipo de negocio — sin tocar ningún producto ni enlazarlos a
--     nada. Nunca duplica: si ya existe un grupo con ese nombre en este local (de cualquier
--     origen), no lo vuelve a crear.
--  3. `abc_obtener_tipo_negocio`: cualquier miembro del local puede ver el tipo actual.
--
-- Límite deliberado: la biblioteca de ejemplo se siembra solo en el local desde el que se
-- guarda, con precios de ejemplo en EUR; en una empresa con varios locales, hay que repetirlo
-- en cada uno. "Otro" no siembra ningún ejemplo (no hay nada genérico que suponer).

set local lock_timeout = '10s';

do $$
declare v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.empresas') is null then v_missing:=array_append(v_missing,'empresas'); end if;
  if to_regclass('public.catalogo_tpv_grupos_opciones') is null then v_missing:=array_append(v_missing,'catalogo_tpv_grupos_opciones'); end if;
  if to_regclass('public.catalogo_tpv_opciones') is null then v_missing:=array_append(v_missing,'catalogo_tpv_opciones'); end if;
  if to_regprocedure('private.abc_config_puede_configurar_empresa(text,text)') is null then v_missing:=array_append(v_missing,'abc_config_puede_configurar_empresa'); end if;
  if to_regprocedure('private.la_tiene_local(text,text)') is null then v_missing:=array_append(v_missing,'la_tiene_local'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_fallar'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_T8_P4_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if exists(
    select 1 from information_schema.columns
     where table_schema='public' and table_name='empresas' and column_name='tipo_negocio'
  )
  or to_regprocedure('public.abc_guardar_tipo_negocio(text,text,text,text,boolean,text)') is not null
  or to_regprocedure('public.abc_obtener_tipo_negocio(text,text)') is not null then
    raise exception 'ABC_T8_P4_PREFLIGHT_FALLO: objetos ya existen';
  end if;
end $$;

alter table public.empresas add column tipo_negocio text;
alter table public.empresas add constraint abc_empresa_tipo_negocio check (
  tipo_negocio is null or tipo_negocio in ('BAR','RESTAURANTE','CAFETERIA','PASTELERIA','TIENDA','OTRO')
);
comment on column public.empresas.tipo_negocio is
  'T8 pieza 4: tipo de negocio declarado por el propietario, solo para ofrecer plantillas de ejemplo. No condiciona ningún comportamiento fiscal ni operativo.';

-- 1. Ver el tipo actual (cualquier miembro del local).
create function public.abc_obtener_tipo_negocio(
  p_empresa_id text,
  p_local_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_tipo text;
begin
  if auth.uid() is null or not coalesce(private.la_tiene_local(p_empresa_id,p_local_id),false) then
    raise exception 'abc_config_no_autorizado';
  end if;
  select e.tipo_negocio into v_tipo from public.empresas e where e.id=p_empresa_id;
  return jsonb_build_object('tipo_negocio',v_tipo);
end $$;

-- 2. Guardar el tipo y, si se pide, sembrar la biblioteca de ejemplo de este local.
create function public.abc_guardar_tipo_negocio(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_tipo_negocio text,
  p_crear_opciones_ejemplo boolean,
  p_motivo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_tipo text:=upper(btrim(coalesce(p_tipo_negocio,'')));
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_request jsonb;
  v_cmd jsonb;
  v_plantilla jsonb;
  v_grupo jsonb;
  v_opcion jsonb;
  v_grupo_id uuid;
  v_creados integer:=0;
  v_result jsonb;
begin
  if auth.uid() is null or not private.abc_config_puede_configurar_empresa(p_empresa_id,p_local_id) then
    raise exception 'tipo_negocio_no_autorizado';
  end if;
  if v_tipo not in ('BAR','RESTAURANTE','CAFETERIA','PASTELERIA','TIENDA','OTRO') then
    raise exception 'tipo_negocio_invalido';
  end if;
  if v_motivo is null then raise exception 'tipo_negocio_motivo_requerido'; end if;

  v_request:=jsonb_build_object(
    'tipo_negocio',v_tipo,'crear_opciones_ejemplo',coalesce(p_crear_opciones_ejemplo,false),'motivo',v_motivo
  );
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_GUARDAR_TIPO_NEGOCIO',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  if not exists(select 1 from public.empresas e where e.id=p_empresa_id) then
    raise exception 'tipo_negocio_empresa_no_encontrada';
  end if;

  update public.empresas set tipo_negocio=v_tipo where id=p_empresa_id;

  if coalesce(p_crear_opciones_ejemplo,false) then
    perform pg_advisory_xact_lock(hashtext('abc_grupos_opciones:'||p_empresa_id||'/'||p_local_id));

    v_plantilla:=case v_tipo
      when 'BAR' then '[
        {"nombre":"Hielo","tipo_grupo":"MODIFICADOR","opciones":[
          {"nombre":"Con hielo","tipo_opcion":"EXTRA","delta":0},
          {"nombre":"Sin hielo","tipo_opcion":"RETIRADA","delta":0}
        ]}
      ]'::jsonb
      when 'RESTAURANTE' then '[
        {"nombre":"Punto de la carne","tipo_grupo":"VARIANTE","opciones":[
          {"nombre":"Poco hecho","tipo_opcion":"VARIANTE","delta":0},
          {"nombre":"Al punto","tipo_opcion":"VARIANTE","delta":0},
          {"nombre":"Muy hecho","tipo_opcion":"VARIANTE","delta":0}
        ]}
      ]'::jsonb
      when 'CAFETERIA' then '[
        {"nombre":"Tamaño","tipo_grupo":"VARIANTE","opciones":[
          {"nombre":"Pequeño","tipo_opcion":"VARIANTE","delta":0},
          {"nombre":"Mediano","tipo_opcion":"VARIANTE","delta":0.30},
          {"nombre":"Grande","tipo_opcion":"VARIANTE","delta":0.60}
        ]},
        {"nombre":"Tipo de leche","tipo_grupo":"VARIANTE","opciones":[
          {"nombre":"Entera","tipo_opcion":"VARIANTE","delta":0},
          {"nombre":"Desnatada","tipo_opcion":"VARIANTE","delta":0},
          {"nombre":"Sin lactosa","tipo_opcion":"VARIANTE","delta":0.20},
          {"nombre":"Avena","tipo_opcion":"VARIANTE","delta":0.30}
        ]}
      ]'::jsonb
      when 'PASTELERIA' then '[
        {"nombre":"Relleno","tipo_grupo":"MODIFICADOR","opciones":[
          {"nombre":"Nata","tipo_opcion":"EXTRA","delta":0},
          {"nombre":"Chocolate","tipo_opcion":"EXTRA","delta":0},
          {"nombre":"Fruta","tipo_opcion":"EXTRA","delta":0}
        ]}
      ]'::jsonb
      when 'TIENDA' then '[
        {"nombre":"Talla","tipo_grupo":"VARIANTE","opciones":[
          {"nombre":"S","tipo_opcion":"VARIANTE","delta":0},
          {"nombre":"M","tipo_opcion":"VARIANTE","delta":0},
          {"nombre":"L","tipo_opcion":"VARIANTE","delta":0},
          {"nombre":"XL","tipo_opcion":"VARIANTE","delta":0}
        ]}
      ]'::jsonb
      else '[]'::jsonb
    end;

    for v_grupo in select * from jsonb_array_elements(v_plantilla)
    loop
      if not exists(
        select 1 from public.catalogo_tpv_grupos_opciones g
         where g.empresa_id=p_empresa_id and g.local_id=p_local_id
           and lower(btrim(g.nombre))=lower(v_grupo->>'nombre')
      ) then
        v_grupo_id:=gen_random_uuid();
        insert into public.catalogo_tpv_grupos_opciones(id,empresa_id,local_id,nombre,tipo_grupo,orden,activo,version)
        values (v_grupo_id,p_empresa_id,p_local_id,v_grupo->>'nombre',v_grupo->>'tipo_grupo',0,true,1);
        v_creados:=v_creados+1;
        for v_opcion in select * from jsonb_array_elements(v_grupo->'opciones')
        loop
          if not exists(
            select 1 from public.catalogo_tpv_opciones o
             where o.empresa_id=p_empresa_id and o.local_id=p_local_id and o.grupo_id=v_grupo_id
               and lower(btrim(o.nombre))=lower(v_opcion->>'nombre')
          ) then
            insert into public.catalogo_tpv_opciones(
              id,empresa_id,local_id,grupo_id,currency_code,nombre,tipo_opcion,delta_precio,
              hereda_impuesto,impuesto_pct,max_cantidad,orden,activo,version
            ) values (
              gen_random_uuid(),p_empresa_id,p_local_id,v_grupo_id,'EUR',v_opcion->>'nombre',v_opcion->>'tipo_opcion',
              coalesce((v_opcion->>'delta')::numeric,0),true,null,1,0,true,1
            );
          end if;
        end loop;
      end if;
    end loop;
  end if;

  v_result:=jsonb_build_object('ok',true,'tipo_negocio',v_tipo,'grupos_ejemplo_creados',v_creados);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

revoke all on function public.abc_obtener_tipo_negocio(text,text)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_guardar_tipo_negocio(text,text,text,text,boolean,text)
  from public,anon,authenticated,service_role;
grant execute on function public.abc_obtener_tipo_negocio(text,text) to authenticated;
grant execute on function public.abc_guardar_tipo_negocio(text,text,text,text,boolean,text) to authenticated;

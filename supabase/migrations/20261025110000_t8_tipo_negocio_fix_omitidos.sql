-- Plan Maestro L&A Suite — Etapa 6, T8 (pieza 4): corrige la transparencia de la siembra.
--
-- Hallazgo Cowork (prueba en vivo, 25/10/2026): al elegir "Cafetería" en un local QA que ya
-- tenía un grupo llamado "Tamaño" de una prueba anterior, la siembra se saltó ese grupo de la
-- plantilla en silencio (correcto: nunca duplica) pero el mensaje de confirmación solo decía
-- "se añadieron 1 grupo(s)", sin explicar que "Tamaño" se había omitido por nombre duplicado
-- — dejaba la impresión de que faltaba algo, no de que ya existía.
--
-- Corregido: abc_guardar_tipo_negocio (create or replace, misma firma) ahora también
-- devuelve `grupos_ejemplo_omitidos`, la lista de nombres de grupo de la plantilla que ya
-- existían en este local y por eso no se tocaron. Sin cambios de comportamiento: sigue sin
-- duplicar nada; solo deja constancia de qué se omitió y por qué.

set local lock_timeout = '10s';

do $$
begin
  if to_regprocedure('public.abc_guardar_tipo_negocio(text,text,text,text,boolean,text)') is null then
    raise exception 'ABC_T8_P4_FIX_PREFLIGHT_FALLO: falta abc_guardar_tipo_negocio (aplicar la pieza 4 antes)';
  end if;
  if pg_get_functiondef('public.abc_guardar_tipo_negocio(text,text,text,text,boolean,text)'::regprocedure)
       like '%grupos_ejemplo_omitidos%' then
    raise exception 'ABC_T8_P4_FIX_PREFLIGHT_FALLO: ya aplicada';
  end if;
end $$;

create or replace function public.abc_guardar_tipo_negocio(
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
  v_omitidos text[]:=array[]::text[];
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
      else
        v_omitidos:=array_append(v_omitidos,v_grupo->>'nombre');
      end if;
    end loop;
  end if;

  v_result:=jsonb_build_object(
    'ok',true,'tipo_negocio',v_tipo,'grupos_ejemplo_creados',v_creados,
    'grupos_ejemplo_omitidos',to_jsonb(v_omitidos)
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

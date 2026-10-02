-- ============================================================================================
-- PIEZA 2 (diferencia de caja) · PARA PEGAR EN EL EDITOR SQL DE SUPABASE **DE QA** (proyecto qjqorixtkilwsndqayyx)
-- Todo va dentro de una sola transacción: si algo falla, no se aplica nada.
-- La primera parte comprueba que estás en QA; si no lo estás, se detiene sin tocar nada.
-- ============================================================================================
begin;

do $$
begin
  if not exists (select 1 from public.empresas where id = 'QA-EMP-A') then
    raise exception 'ESTE NO ES EL PROYECTO DE QA: no se aplica nada';
  end if;
end $$;

-- ABC · capa de configuración por empresa y local, PIEZA 2 (solo QA hasta que Pedro autorice otra cosa).
--
-- Decisión de Pedro (2/10/2026, hoja F1): D15 «toda diferencia de caja se registra en la auditoría, exige
-- motivo y, sobre un umbral configurable por el propietario, requiere su aprobación; nunca se inventa un
-- ingreso para cuadrar». D19: el cajero cierra caja; si hay diferencia sobre el umbral, aprueba el propietario.
-- Inventario y diseño en docs/plan-abc/F6_INVENTARIO_CAPA_CONFIGURACION_2026-10-02.md.
--
-- Qué hace (aditiva; no cambia ninguna función de cierre de C04 ni de C12):
--  1. Nuevo ajuste por local `caja_diferencia_umbral` (importe, 0 a 10000 con hasta 2 decimales; 0 por defecto:
--     cualquier diferencia exige aprobación del propietario). Se configura con `abc_configurar_ajuste` y se lee
--     con `abc_obtener_ajustes` (ambas se amplían aquí: son las de la pieza 1 con el segundo ajuste).
--  2. Tabla `caja_cierre_diferencias` (sin acceso directo): una fila por cierre con diferencia, con el motivo,
--     quién lo dio y, si hizo falta, la decisión del propietario (aprobada o rechazada) y su motivo.
--  3. `abc_registrar_diferencia_caja`: con la sesión en CIERRE_PROVISIONAL y diferencia distinta de cero,
--     quien opera la caja registra el motivo (obligatorio). La diferencia se recalcula en el servidor.
--  4. `abc_decidir_diferencia_caja`: solo el Propietario aprueba o rechaza, y solo si la diferencia supera el
--     umbral. Rechazar bloquea el cierre definitivo de ese cierre (hay que reabrir y recontar).
--  5. `abc_obtener_diferencia_caja`: estado de la diferencia y de sus bloqueos (para la pantalla).
--  6. Guarda en `caja_sesiones` (trigger): el paso a CERRADA_FINAL se rechaza con
--     `cierre_definitivo_diferencia_pendiente:[…]` mientras falte el motivo (DIFERENCIA_SIN_MOTIVO), falte la
--     aprobación (DIFERENCIA_PENDIENTE_APROBACION), se haya rechazado (DIFERENCIA_RECHAZADA) o la diferencia
--     haya cambiado desde que se registró (DIFERENCIA_CAMBIADA). Vale para cualquier camino de cierre.
--  Cada paso deja un evento en `abc_eventos` (CAJA_DIFERENCIA_REGISTRADA / _APROBADA / _RECHAZADA).
--
-- Efecto conocido: la pantalla actual (cierre en tres pasos) no pide motivo, así que finalizar un cierre con
-- diferencia dará `cierre_definitivo_diferencia_pendiente` hasta que la pantalla use las funciones nuevas. Con
-- diferencia 0 no cambia nada. Suposición actual: una sola moneda (EUR); el umbral se aplica al importe de la
-- moneda de la sesión.

-- Falla rápido si otra transacción retiene los bloqueos de tabla que necesita (en lugar de quedarse esperando).
set local lock_timeout = '10s';

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.caja_sesiones') is null then v_missing:=array_append(v_missing,'caja_sesiones'); end if;
  if to_regclass('public.caja_cierres') is null then v_missing:=array_append(v_missing,'caja_cierres'); end if;
  if to_regclass('public.caja_conteos') is null then v_missing:=array_append(v_missing,'caja_conteos'); end if;
  if to_regclass('public.caja_operaciones') is null then v_missing:=array_append(v_missing,'caja_operaciones'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regclass('public.abc_config_ajustes') is null then v_missing:=array_append(v_missing,'abc_config_ajustes (pieza 1)'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_config_puede_configurar(text,text)') is null then v_missing:=array_append(v_missing,'abc_config_puede_configurar (pieza 1)'); end if;
  if to_regprocedure('private.abc_config_dia_evento(text,text)') is null then v_missing:=array_append(v_missing,'abc_config_dia_evento (pieza 1)'); end if;
  if to_regprocedure('private.abc_c04_guard_final_session()') is null then v_missing:=array_append(v_missing,'abc_c04_guard_final_session (C04)'); end if;
  if to_regprocedure('public.abc_finalizar_cierre_sesion_caja(text,text,text,uuid,uuid,text,date)') is null then v_missing:=array_append(v_missing,'abc_finalizar_cierre_sesion_caja (C04)'); end if;
  if to_regprocedure('public.abc_configurar_ajuste(text,text,text,text,jsonb,text)') is null then v_missing:=array_append(v_missing,'abc_configurar_ajuste (pieza 1)'); end if;
  if to_regprocedure('public.abc_obtener_ajustes(text,text)') is null then v_missing:=array_append(v_missing,'abc_obtener_ajustes (pieza 1)'); end if;

  if cardinality(v_missing)>0 then
    raise exception 'ABC_CFG2_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  -- Solo se reemplazan las dos funciones de la pieza 1 tal y como quedaron (mismo texto, comprobado por hash).
  if (select md5(p.prosrc) from pg_proc p
       where p.oid='public.abc_configurar_ajuste(text,text,text,text,jsonb,text)'::regprocedure)
     <> '21e043efa2354d64518f2606ef642dd8' then
    raise exception 'ABC_CFG2_PREFLIGHT_FALLO: abc_configurar_ajuste no coincide con la versión de la pieza 1';
  end if;
  if (select md5(p.prosrc) from pg_proc p
       where p.oid='public.abc_obtener_ajustes(text,text)'::regprocedure)
     <> '05722887fbdcab94e149b844020960e3' then
    raise exception 'ABC_CFG2_PREFLIGHT_FALLO: abc_obtener_ajustes no coincide con la versión de la pieza 1';
  end if;

  if to_regclass('public.caja_cierre_diferencias') is not null
     or to_regprocedure('public.abc_registrar_diferencia_caja(text,text,text,uuid,text)') is not null
     or to_regprocedure('public.abc_decidir_diferencia_caja(text,text,text,uuid,text,text)') is not null
     or to_regprocedure('public.abc_obtener_diferencia_caja(text,text,uuid)') is not null then
    raise exception 'ABC_CFG2_PREFLIGHT_FALLO: objetos de la pieza 2 ya existen';
  end if;
end $$;

-- 1. Segundo ajuste por local: umbral de diferencia de caja.
alter table public.abc_config_ajustes
  drop constraint abc_config_ajuste_clave,
  drop constraint abc_config_ajuste_valor,
  add constraint abc_config_ajuste_clave check (clave in ('cajas_abiertas_max','caja_diferencia_umbral')),
  add constraint abc_config_ajuste_valor check (
    case clave
      when 'cajas_abiertas_max' then
        case when jsonb_typeof(valor)='number'
          then (valor#>>'{}')::numeric between 1 and 10
               and (valor#>>'{}')::numeric=trunc((valor#>>'{}')::numeric)
          else false end
      when 'caja_diferencia_umbral' then
        case when jsonb_typeof(valor)='number'
          then (valor#>>'{}')::numeric between 0 and 10000
               and (valor#>>'{}')::numeric=round((valor#>>'{}')::numeric,2)
          else false end
      else false
    end
  );

create function private.abc_ajuste_caja_umbral(
  p_empresa_id text,
  p_local_id text
)
returns numeric
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(
    (select (a.valor#>>'{}')::numeric
       from public.abc_config_ajustes a
      where a.empresa_id=p_empresa_id
        and a.local_id=p_local_id
        and a.clave='caja_diferencia_umbral'),
    0
  )
$$;

-- Configurar un ajuste de un local (pieza 1 + umbral de diferencia).
create or replace function public.abc_configurar_ajuste(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_clave text,
  p_valor jsonb,
  p_motivo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_clave text:=btrim(coalesce(p_clave,''));
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_valor numeric;
  v_valor_json jsonb;
  v_request jsonb;
  v_cmd jsonb;
  v_prev public.abc_config_ajustes%rowtype;
  v_found boolean;
  v_version bigint;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_config_puede_configurar(p_empresa_id,p_local_id) then
    raise exception 'abc_config_no_autorizado';
  end if;
  if v_clave not in ('cajas_abiertas_max','caja_diferencia_umbral') then raise exception 'ajuste_clave_invalida'; end if;
  if p_valor is null or jsonb_typeof(p_valor)<>'number' then raise exception 'ajuste_valor_invalido'; end if;
  v_valor:=(p_valor#>>'{}')::numeric;
  if v_clave='cajas_abiertas_max' then
    if v_valor<>trunc(v_valor) or v_valor<1 or v_valor>10 then raise exception 'ajuste_valor_fuera_de_rango'; end if;
    v_valor:=v_valor::integer;
    v_valor_json:=to_jsonb(v_valor::integer);
  else
    if v_valor<0 or v_valor>10000 or v_valor<>round(v_valor,2) then raise exception 'ajuste_valor_fuera_de_rango'; end if;
    v_valor:=round(v_valor,2);
    v_valor_json:=to_jsonb(v_valor);
  end if;
  if v_motivo is null then raise exception 'ajuste_motivo_requerido'; end if;

  v_request:=jsonb_build_object('clave',v_clave,'valor',v_valor,'motivo',v_motivo);
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIGURAR_AJUSTE',v_request,null
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  perform pg_advisory_xact_lock(hashtext('abc_ajuste:'||p_empresa_id||'/'||p_local_id||'/'||v_clave));

  select * into v_prev
    from public.abc_config_ajustes a
   where a.empresa_id=p_empresa_id and a.local_id=p_local_id and a.clave=v_clave
   for update;
  v_found:=found;

  if v_found and (v_prev.valor#>>'{}')::numeric=v_valor then
    v_result:=jsonb_build_object('ok',true,'clave',v_clave,'valor',v_valor_json,
      'version',v_prev.version,'cambio',false,'origen','local');
  else
    if v_found then
      update public.abc_config_ajustes
         set valor=v_valor_json, version=version+1, motivo=v_motivo,
             updated_by=auth.uid(), updated_at=now()
       where id=v_prev.id
      returning version into v_version;
    else
      insert into public.abc_config_ajustes(empresa_id,local_id,clave,valor,version,motivo,updated_by)
      values (p_empresa_id,p_local_id,v_clave,v_valor_json,1,v_motivo,auth.uid());
      v_version:=1;
    end if;

    insert into public.abc_eventos(
      empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
      payload,actor_user_id,terminal_id,occurred_at,operating_day
    ) values (
      p_empresa_id,p_local_id,p_operation_id,'LOCAL_CONFIG',v_clave,'AJUSTE_CONFIGURADO',
      jsonb_build_object(
        'clave',v_clave,
        'anterior',case when v_found then v_prev.valor else null end,
        'nuevo',v_valor_json,
        'version',v_version,
        'motivo',v_motivo
      ),
      auth.uid(),null,now(),private.abc_config_dia_evento(p_empresa_id,p_local_id)
    );

    v_result:=jsonb_build_object('ok',true,'clave',v_clave,'valor',v_valor_json,
      'version',v_version,'cambio',true,'origen','local');
  end if;

  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

-- Leer los ajustes efectivos de un local (pieza 1 + umbral de diferencia).
create or replace function public.abc_obtener_ajustes(
  p_empresa_id text,
  p_local_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.uid() is null
     or nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null
     or not coalesce(private.la_tiene_local(p_empresa_id,p_local_id),false) then
    raise exception 'abc_config_no_autorizado';
  end if;

  return jsonb_build_object(
    'cajas_abiertas_max',
    coalesce(
      (select jsonb_build_object('valor',a.valor,'origen','local','version',a.version)
         from public.abc_config_ajustes a
        where a.empresa_id=p_empresa_id and a.local_id=p_local_id and a.clave='cajas_abiertas_max'),
      jsonb_build_object('valor',10,'origen','defecto','version',0)
    ),
    'caja_diferencia_umbral',
    coalesce(
      (select jsonb_build_object('valor',a.valor,'origen','local','version',a.version)
         from public.abc_config_ajustes a
        where a.empresa_id=p_empresa_id and a.local_id=p_local_id and a.clave='caja_diferencia_umbral'),
      jsonb_build_object('valor',0,'origen','defecto','version',0)
    ),
    'dia_operativo',
    (select jsonb_build_object(
              'timezone_name',r.timezone_name,'cutoff_time',r.cutoff_time,
              'vigente_desde',r.vigente_desde,'version',r.version)
       from private.abc_operating_day_reglas r
      where r.empresa_id=p_empresa_id and r.local_id=p_local_id and r.vigente_hasta is null)
  );
end $$;

-- 2. Registro de la diferencia de cada cierre (sin acceso directo).
create table public.caja_cierre_diferencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  session_id uuid not null,
  cierre_id uuid not null references public.caja_cierres(id) on delete restrict,
  currency_code text not null,
  expected_amount numeric(24,8) not null,
  counted_amount numeric(24,8) not null,
  difference numeric(24,8) not null,
  umbral_aplicado numeric(24,8) not null,
  requiere_aprobacion boolean not null,
  motivo text not null,
  motivo_por uuid not null references auth.users(id) on delete restrict,
  motivo_at timestamp with time zone not null default now(),
  estado text not null default 'REGISTRADA',
  decidido_por uuid references auth.users(id) on delete restrict,
  decidido_at timestamp with time zone,
  decision_motivo text,
  version bigint not null default 1,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint abc_cierre_dif_sesion_fk foreign key (empresa_id,local_id,session_id)
    references public.caja_sesiones(empresa_id,local_id,id) on delete restrict,
  constraint abc_cierre_dif_uq unique (cierre_id),
  constraint abc_cierre_dif_moneda check (currency_code ~ '^[A-Z]{3}$'),
  constraint abc_cierre_dif_importe check (difference<>0 and umbral_aplicado>=0),
  constraint abc_cierre_dif_motivo check (char_length(btrim(motivo)) between 1 and 500),
  constraint abc_cierre_dif_estado check (estado in ('REGISTRADA','APROBADA','RECHAZADA')),
  constraint abc_cierre_dif_decision check (
    (estado='REGISTRADA' and decidido_por is null and decidido_at is null and decision_motivo is null)
    or (estado in ('APROBADA','RECHAZADA') and requiere_aprobacion
        and decidido_por is not null and decidido_at is not null
        and char_length(btrim(coalesce(decision_motivo,''))) between 1 and 500)
  ),
  constraint abc_cierre_dif_version check (version>=1)
);

alter table public.caja_cierre_diferencias enable row level security;
revoke all on table public.caja_cierre_diferencias from public,anon,authenticated,service_role;

comment on table public.caja_cierre_diferencias is
  'Diferencia de caja de cada cierre con su motivo y, si superó el umbral, la decisión del propietario (capa de configuración, pieza 2). Sin acceso directo: abc_registrar_diferencia_caja, abc_decidir_diferencia_caja y abc_obtener_diferencia_caja.';

-- 3. Estado de la diferencia de la sesión: se recalcula siempre en el servidor (mismo cálculo que el cierre).
create function private.abc_cfg2_diferencia_estado(
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_cierre public.caja_cierres%rowtype;
  v_currency text;
  v_counted numeric(24,8);
  v_expected numeric(24,8);
  v_diff numeric(24,8);
  v_umbral numeric;
  v_req boolean;
  v_reg public.caja_cierre_diferencias%rowtype;
  v_found boolean;
  v_bloq jsonb:='[]'::jsonb;
begin
  select * into v_cierre
    from public.caja_cierres c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.session_id=p_session_id
     and c.estado in ('PROVISIONAL','FINAL')
   order by c.started_at desc, c.created_at desc
   limit 1;
  if not found then
    return jsonb_build_object('cierre_id',null,'difference',null,'bloqueos','[]'::jsonb);
  end if;

  v_currency:=nullif(upper(btrim(coalesce(v_cierre.expected_snapshot->>'currency_code',''))),'');
  if v_currency is null then
    return jsonb_build_object('cierre_id',v_cierre.id,'cierre_estado',v_cierre.estado,'difference',null,'bloqueos','[]'::jsonb);
  end if;
  select cc.counted_amount into v_counted
    from public.caja_conteos cc
   where cc.cierre_id=v_cierre.id and cc.currency_code=v_currency
   order by cc.numero desc
   limit 1;
  if v_counted is null then
    return jsonb_build_object('cierre_id',v_cierre.id,'cierre_estado',v_cierre.estado,'difference',null,'bloqueos','[]'::jsonb);
  end if;

  v_expected:=round(coalesce((
    select sum(coalesce(co.efecto_efectivo,0)) from public.caja_operaciones co
     where co.empresa_id=p_empresa_id and co.local_id=p_local_id and co.session_id=p_session_id
       and upper(coalesce(co.currency_code,v_currency))=v_currency),0),8)::numeric(24,8);
  v_diff:=(v_counted-v_expected)::numeric(24,8);
  v_umbral:=private.abc_ajuste_caja_umbral(p_empresa_id,p_local_id);
  v_req:=abs(v_diff)>v_umbral;

  select * into v_reg from public.caja_cierre_diferencias d where d.cierre_id=v_cierre.id;
  v_found:=found;

  if v_diff<>0 then
    if not v_found then
      v_bloq:=jsonb_build_array('DIFERENCIA_SIN_MOTIVO');
    elsif v_reg.difference<>v_diff then
      v_bloq:=jsonb_build_array('DIFERENCIA_CAMBIADA');
    elsif v_reg.estado='RECHAZADA' then
      v_bloq:=jsonb_build_array('DIFERENCIA_RECHAZADA');
    elsif v_reg.estado='REGISTRADA' and v_req then
      v_bloq:=jsonb_build_array('DIFERENCIA_PENDIENTE_APROBACION');
    end if;
  end if;

  return jsonb_build_object(
    'cierre_id',v_cierre.id,
    'cierre_estado',v_cierre.estado,
    'currency_code',v_currency,
    'expected_amount',v_expected,
    'counted_amount',v_counted,
    'difference',v_diff,
    'umbral',v_umbral,
    'requiere_aprobacion',v_diff<>0 and v_req,
    'registro',case when v_found then jsonb_build_object(
      'estado',v_reg.estado,'motivo',v_reg.motivo,'motivo_por',v_reg.motivo_por,'motivo_at',v_reg.motivo_at,
      'difference',v_reg.difference,'umbral_aplicado',v_reg.umbral_aplicado,
      'requiere_aprobacion',v_reg.requiere_aprobacion,'version',v_reg.version,
      'decidido_por',v_reg.decidido_por,'decidido_at',v_reg.decidido_at,'decision_motivo',v_reg.decision_motivo
    ) else null end,
    'bloqueos',v_bloq
  );
end $$;

-- 4. Guarda: no se cierra definitivamente una sesión con una diferencia sin tratar.
create function private.abc_cfg2_guard_diferencia_caja()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_bloq jsonb;
begin
  if new.estado='CERRADA_FINAL' and old.estado='CIERRE_PROVISIONAL' then
    v_bloq:=private.abc_cfg2_diferencia_estado(new.empresa_id,new.local_id,new.id)->'bloqueos';
    if jsonb_array_length(v_bloq)>0 then
      raise exception 'cierre_definitivo_diferencia_pendiente:%',v_bloq::text;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists abc_f6_cfg2_guard_diferencia_caja on public.caja_sesiones;
create trigger abc_f6_cfg2_guard_diferencia_caja
before update of estado on public.caja_sesiones
for each row execute function private.abc_cfg2_guard_diferencia_caja();

-- 5. Registrar el motivo de la diferencia (quien opera la caja).
create function public.abc_registrar_diferencia_caja(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_cmd jsonb;
  v_cierre public.caja_cierres%rowtype;
  v_est jsonb;
  v_diff numeric(24,8);
  v_umbral numeric;
  v_req boolean;
  v_prev public.caja_cierre_diferencias%rowtype;
  v_found boolean;
  v_version bigint;
  v_dia date;
  v_result jsonb;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR') then
    raise exception 'abc_caja_no_autorizado';
  end if;
  if p_session_id is null then raise exception 'diferencia_caja_parametros_requeridos'; end if;
  if v_motivo is null then raise exception 'diferencia_caja_motivo_requerido'; end if;
  if char_length(v_motivo)>500 then raise exception 'diferencia_caja_motivo_invalido'; end if;

  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_REGISTRAR_DIFERENCIA_CAJA',
    jsonb_build_object('session_id',p_session_id,'motivo',v_motivo),null
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  -- Mismo orden de bloqueo que C04: primero el cierre, luego la sesión.
  select * into v_cierre from public.caja_cierres c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.session_id=p_session_id
     and c.estado='PROVISIONAL' for update;
  if not found then raise exception 'cierre_provisional_no_encontrado'; end if;
  perform 1 from public.caja_sesiones s
   where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.id=p_session_id
     and s.estado='CIERRE_PROVISIONAL' for update;
  if not found then raise exception 'sesion_no_provisional'; end if;

  v_est:=private.abc_cfg2_diferencia_estado(p_empresa_id,p_local_id,p_session_id);
  v_diff:=(v_est->>'difference')::numeric(24,8);
  if v_diff is null or v_diff=0 then raise exception 'diferencia_caja_inexistente'; end if;
  v_umbral:=(v_est->>'umbral')::numeric;
  v_req:=abs(v_diff)>v_umbral;

  select * into v_prev from public.caja_cierre_diferencias d where d.cierre_id=v_cierre.id for update;
  v_found:=found;
  if v_found and v_prev.estado in ('APROBADA','RECHAZADA') then raise exception 'diferencia_caja_ya_decidida'; end if;

  if v_found then
    update public.caja_cierre_diferencias
       set expected_amount=(v_est->>'expected_amount')::numeric,
           counted_amount=(v_est->>'counted_amount')::numeric,
           difference=v_diff,umbral_aplicado=v_umbral,requiere_aprobacion=v_req,
           motivo=v_motivo,motivo_por=auth.uid(),motivo_at=now(),
           version=version+1,updated_at=now()
     where id=v_prev.id
    returning version into v_version;
  else
    insert into public.caja_cierre_diferencias(
      empresa_id,local_id,session_id,cierre_id,currency_code,
      expected_amount,counted_amount,difference,umbral_aplicado,requiere_aprobacion,
      motivo,motivo_por
    ) values (
      p_empresa_id,p_local_id,p_session_id,v_cierre.id,v_est->>'currency_code',
      (v_est->>'expected_amount')::numeric,(v_est->>'counted_amount')::numeric,v_diff,v_umbral,v_req,
      v_motivo,auth.uid()
    );
    v_version:=1;
  end if;

  v_dia:=coalesce((v_cierre.expected_snapshot->>'operating_day')::date,
                  private.abc_config_dia_evento(p_empresa_id,p_local_id));
  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CAJA_SESION',p_session_id::text,
    'CAJA_DIFERENCIA_REGISTRADA',
    jsonb_build_object(
      'cierre_id',v_cierre.id,
      'currency_code',v_est->>'currency_code',
      'expected_amount',(v_est->>'expected_amount')::numeric,
      'counted_amount',(v_est->>'counted_amount')::numeric,
      'difference',v_diff,
      'umbral',v_umbral,
      'requiere_aprobacion',v_req,
      'motivo',v_motivo,
      'version',v_version
    ),
    auth.uid(),null,now(),v_dia
  );

  v_result:=jsonb_build_object(
    'ok',true,'session_id',p_session_id,'cierre_id',v_cierre.id,'estado','REGISTRADA',
    'difference',v_diff,'umbral',v_umbral,'requiere_aprobacion',v_req,'version',v_version,
    'bloqueos',private.abc_cfg2_diferencia_estado(p_empresa_id,p_local_id,p_session_id)->'bloqueos'
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

-- 6. Decidir (aprobar o rechazar) una diferencia sobre el umbral: solo el Propietario.
create function public.abc_decidir_diferencia_caja(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid,
  p_decision text,
  p_motivo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_decision text:=upper(btrim(coalesce(p_decision,'')));
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_cmd jsonb;
  v_cierre public.caja_cierres%rowtype;
  v_est jsonb;
  v_diff numeric(24,8);
  v_umbral numeric;
  v_reg public.caja_cierre_diferencias%rowtype;
  v_estado text;
  v_version bigint;
  v_dia date;
  v_result jsonb;
begin
  if auth.uid() is null or not private.abc_config_puede_configurar(p_empresa_id,p_local_id) then
    raise exception 'abc_diferencia_caja_no_autorizada';
  end if;
  if p_session_id is null then raise exception 'diferencia_caja_parametros_requeridos'; end if;
  if v_decision not in ('APROBAR','RECHAZAR') then raise exception 'diferencia_caja_decision_invalida'; end if;
  if v_motivo is null then raise exception 'diferencia_caja_motivo_requerido'; end if;
  if char_length(v_motivo)>500 then raise exception 'diferencia_caja_motivo_invalido'; end if;

  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_DECIDIR_DIFERENCIA_CAJA',
    jsonb_build_object('session_id',p_session_id,'decision',v_decision,'motivo',v_motivo),null
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select * into v_cierre from public.caja_cierres c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.session_id=p_session_id
     and c.estado='PROVISIONAL' for update;
  if not found then raise exception 'cierre_provisional_no_encontrado'; end if;
  perform 1 from public.caja_sesiones s
   where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.id=p_session_id
     and s.estado='CIERRE_PROVISIONAL' for update;
  if not found then raise exception 'sesion_no_provisional'; end if;

  select * into v_reg from public.caja_cierre_diferencias d where d.cierre_id=v_cierre.id for update;
  if not found then raise exception 'diferencia_caja_sin_registro'; end if;
  if v_reg.estado<>'REGISTRADA' then raise exception 'diferencia_caja_ya_decidida'; end if;

  v_est:=private.abc_cfg2_diferencia_estado(p_empresa_id,p_local_id,p_session_id);
  v_diff:=(v_est->>'difference')::numeric(24,8);
  if v_diff is null or v_diff<>v_reg.difference then raise exception 'diferencia_caja_cambiada'; end if;
  v_umbral:=(v_est->>'umbral')::numeric;
  if not (abs(v_diff)>v_umbral) then raise exception 'diferencia_caja_no_requiere_aprobacion'; end if;

  v_estado:=case v_decision when 'APROBAR' then 'APROBADA' else 'RECHAZADA' end;
  update public.caja_cierre_diferencias
     set estado=v_estado,requiere_aprobacion=true,umbral_aplicado=v_umbral,
         decidido_por=auth.uid(),decidido_at=now(),decision_motivo=v_motivo,
         version=version+1,updated_at=now()
   where id=v_reg.id
  returning version into v_version;

  v_dia:=coalesce((v_cierre.expected_snapshot->>'operating_day')::date,
                  private.abc_config_dia_evento(p_empresa_id,p_local_id));
  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CAJA_SESION',p_session_id::text,
    case v_decision when 'APROBAR' then 'CAJA_DIFERENCIA_APROBADA' else 'CAJA_DIFERENCIA_RECHAZADA' end,
    jsonb_build_object(
      'cierre_id',v_cierre.id,
      'difference',v_diff,
      'umbral',v_umbral,
      'motivo_diferencia',v_reg.motivo,
      'motivo_decision',v_motivo,
      'version',v_version
    ),
    auth.uid(),null,now(),v_dia
  );

  v_result:=jsonb_build_object(
    'ok',true,'session_id',p_session_id,'cierre_id',v_cierre.id,'estado',v_estado,
    'difference',v_diff,'umbral',v_umbral,'version',v_version,
    'bloqueos',private.abc_cfg2_diferencia_estado(p_empresa_id,p_local_id,p_session_id)->'bloqueos'
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

-- 7. Leer el estado de la diferencia de una sesión (para la pantalla).
create function public.abc_obtener_diferencia_caja(
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR') then
    raise exception 'abc_caja_no_autorizado';
  end if;
  if p_session_id is null then raise exception 'diferencia_caja_parametros_requeridos'; end if;

  return private.abc_cfg2_diferencia_estado(p_empresa_id,p_local_id,p_session_id)
    || jsonb_build_object('session_estado',
         (select s.estado from public.caja_sesiones s
           where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.id=p_session_id));
end $$;

revoke all on function private.abc_ajuste_caja_umbral(text,text) from public,anon,authenticated,service_role;
revoke all on function private.abc_cfg2_diferencia_estado(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.abc_cfg2_guard_diferencia_caja() from public,anon,authenticated,service_role;
revoke all on function public.abc_configurar_ajuste(text,text,text,text,jsonb,text)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_obtener_ajustes(text,text)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_registrar_diferencia_caja(text,text,text,uuid,text)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_decidir_diferencia_caja(text,text,text,uuid,text,text)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_obtener_diferencia_caja(text,text,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.abc_configurar_ajuste(text,text,text,text,jsonb,text) to authenticated;
grant execute on function public.abc_obtener_ajustes(text,text) to authenticated;
grant execute on function public.abc_registrar_diferencia_caja(text,text,text,uuid,text) to authenticated;
grant execute on function public.abc_decidir_diferencia_caja(text,text,text,uuid,text,text) to authenticated;
grant execute on function public.abc_obtener_diferencia_caja(text,text,uuid) to authenticated;

commit;

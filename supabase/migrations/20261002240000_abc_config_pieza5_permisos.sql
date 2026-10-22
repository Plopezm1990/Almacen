-- ABC · capa de configuración por empresa y local, PIEZA 5 (solo QA hasta que Pedro autorice otra cosa).
--
-- Decisiones de Pedro (2/10/2026, hoja F1 y respuestas del 2/10/2026): D03/D19 «permisos configurables por empresa o
-- local sobre una plantilla por defecto», D14 «reabrir un cierre: solo el propietario» y «retirar los roles
-- Churrero/a, Básico y Estándar». Elegido en la pieza 5: con techo en lo delicado, nivel empresa y local (el local
-- manda), retirar roles bloqueando altas nuevas y quitando sus permisos, y devoluciones del cajero sin permiso.
-- Diseño en docs/plan-abc/F6_INVENTARIO_CAPA_CONFIGURACION_2026-10-02.md y F6_PIEZA5_PERMISOS_2026-10-02.md.
--
-- Qué hace:
--  1. Catálogo único de capacidades (`private.abc_cap_catalogo`): para cada capacidad ABC, el valor por defecto de
--     cada rol (la plantilla = lo que ya hacía `abc_tiene_capacidad` y `abc_a10_tiene_capacidad`, sin cambiar nada
--     salvo la capacidad nueva ABC_CIERRE_REABRIR y la retirada de roles) y su «techo» (hasta qué rol se puede dar).
--  2. Tabla `abc_capacidades_rol` (sin acceso directo): decisiones del propietario por empresa o por local, para
--     Encargado, Cajero/a y Camarero/a. El Propietario no se puede tocar. Una decisión nula significa «heredar».
--  3. `abc_tiene_capacidad` y `abc_a10_tiene_capacidad` se reemplazan conservando EXACTAMENTE su inicio (login,
--     local, membresía) y cambiando solo el final: ahora resuelven local -> empresa -> plantilla con el techo. Las
--     ~70 funciones que las llaman no se tocan.
--  4. D14: `abc_reabrir_cierre_provisional` se reemplaza cambiando solo la capacidad exigida (de ABC_CAJA_OPERAR a
--     la nueva ABC_CIERRE_REABRIR, por defecto solo Propietario).
--  5. `abc_configurar_capacidad_rol` (solo el Propietario; el de empresa necesita acceso a todos los locales),
--     `abc_obtener_capacidades_rol` (cualquier miembro del local) y `abc_listar_roles_retirados` (Propietario).
--  6. Retirada de roles: un trigger impide asignar (o reactivar) Churrero/a, Básico y Estándar en `membresias_usuario`.
--     Quien ya los tiene no se toca (aparece en `abc_listar_roles_retirados`), pero pierde todos los permisos ABC.
--
-- Límites deliberados: no cubre los permisos de personal, finanzas, stock, catálogo ni descuentos (otros módulos,
-- con sus propias reglas); `perfiles.rol` no se toca; no hay pantalla.

set local lock_timeout = '10s';

do $$
declare
  v_missing text[] := array[]::text[];
  v_h text;
begin
  if to_regclass('public.empresas') is null then v_missing:=array_append(v_missing,'empresas'); end if;
  if to_regclass('public.locales') is null then v_missing:=array_append(v_missing,'locales'); end if;
  if to_regclass('public.membresias_usuario') is null then v_missing:=array_append(v_missing,'membresias_usuario'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.la_tiene_local(text,text)') is null then v_missing:=array_append(v_missing,'la_tiene_local'); end if;
  if to_regprocedure('private.abc_config_puede_configurar(text,text)') is null then v_missing:=array_append(v_missing,'abc_config_puede_configurar (pieza 1)'); end if;
  if to_regprocedure('private.abc_config_dia_evento(text,text)') is null then v_missing:=array_append(v_missing,'abc_config_dia_evento (pieza 1)'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_a10_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_a10_tiene_capacidad'); end if;
  if to_regprocedure('public.abc_reabrir_cierre_provisional(text,text,text,uuid,uuid,text,date)') is null then v_missing:=array_append(v_missing,'abc_reabrir_cierre_provisional'); end if;
  if to_regprocedure('auth.uid()') is null then v_missing:=array_append(v_missing,'auth.uid'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_CFG5_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  -- Las tres funciones que se reemplazan tienen que ser exactamente las conocidas (sin el retorno de carro de Windows).
  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid='private.abc_tiene_capacidad(text,text,text)'::regprocedure;
  if v_h is distinct from '130b601fe56233b852feb8caa3f4d0fc' then
    raise exception 'ABC_CFG5_PREFLIGHT_FALLO:funcion_distinta:abc_tiene_capacidad:%',v_h;
  end if;
  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid='private.abc_a10_tiene_capacidad(text,text,text)'::regprocedure;
  if v_h is distinct from '998071080dee9187ea4d571b6f4fac51' then
    raise exception 'ABC_CFG5_PREFLIGHT_FALLO:funcion_distinta:abc_a10_tiene_capacidad:%',v_h;
  end if;
  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid='public.abc_reabrir_cierre_provisional(text,text,text,uuid,uuid,text,date)'::regprocedure;
  if v_h is distinct from 'd19658296237a9b05814a35a72096914' then
    raise exception 'ABC_CFG5_PREFLIGHT_FALLO:funcion_distinta:abc_reabrir_cierre_provisional:%',v_h;
  end if;

  if to_regclass('public.abc_capacidades_rol') is not null
     or to_regprocedure('private.abc_cap_catalogo()') is not null
     or to_regprocedure('private.abc_cap_efectiva(text,text,text,text,text)') is not null
     or to_regprocedure('public.abc_configurar_capacidad_rol(text,text,text,text,text,text,boolean,text)') is not null
     or to_regprocedure('public.abc_obtener_capacidades_rol(text,text)') is not null
     or to_regprocedure('public.abc_listar_roles_retirados(text,text)') is not null
     or exists(select 1 from pg_trigger t where t.tgrelid='public.membresias_usuario'::regclass and t.tgname='abc_f6_cfg5_guard_rol_retirado') then
    raise exception 'ABC_CFG5_PREFLIGHT_FALLO: objetos de la pieza 5 ya existen';
  end if;
end $$;

-- 1. Catálogo de capacidades: plantilla por defecto de cada rol y techo.
--    techo: TODOS = hasta Camarero/a; ENCARGADO = nunca por debajo de Encargado (lo delicado: dinero, documentos
--    fiscales y reabrir cierres); PROPIETARIO = solo el Propietario. El Propietario tiene siempre todas.
create function private.abc_cap_catalogo()
returns table(capacidad text, familia text, propietario boolean, encargado boolean, cajero boolean, camarero boolean, techo text)
language sql
immutable
security definer
set search_path=''
as $$
  select v.capacidad,v.familia,v.propietario,v.encargado,v.cajero,v.camarero,v.techo
    from (values
      ('ABC_CUENTA_OPERAR','GENERAL',true,true,true,true,'TODOS'),
      ('ABC_CUENTA_REASIGNAR','GENERAL',true,true,false,false,'TODOS'),
      ('ABC_COBRO_INICIAR','GENERAL',true,true,true,true,'TODOS'),
      ('ABC_COBRO_EFECTIVO','GENERAL',true,true,true,false,'TODOS'),
      ('ABC_COBRO_RESOLVER_INCIERTO','GENERAL',true,true,false,false,'ENCARGADO'),
      ('ABC_REEMBOLSO_SOLICITAR','GENERAL',true,true,false,false,'ENCARGADO'),
      ('ABC_REEMBOLSO_CONFIRMAR','GENERAL',true,true,false,false,'ENCARGADO'),
      ('ABC_CAJA_OPERAR','GENERAL',true,true,true,false,'TODOS'),
      ('ABC_CIERRE_REABRIR','GENERAL',true,false,false,false,'ENCARGADO'),
      ('ABC_EMISOR_CAMBIAR','GENERAL',true,true,false,false,'ENCARGADO'),
      ('ABC_PEDIDO_ENVIAR','GENERAL',true,true,true,true,'TODOS'),
      ('ABC_PREPARACION_INICIAR','GENERAL',true,true,false,true,'TODOS'),
      ('ABC_PREPARACION_COMPLETAR','GENERAL',true,true,false,true,'TODOS'),
      ('ABC_PEDIDO_SERVIR','GENERAL',true,true,true,true,'TODOS'),
      ('ABC_LINEA_CANCELAR','GENERAL',true,true,true,true,'TODOS'),
      ('ABC_CANCELACION_SENSIBLE','GENERAL',true,true,false,false,'ENCARGADO'),
      ('ABC_PEDIDO_CANCELAR','GENERAL',true,true,false,false,'TODOS'),
      ('ABC_PEDIDO_CERRAR','GENERAL',true,true,true,false,'TODOS'),
      ('ABC_SALA_VER','GENERAL',true,true,true,true,'TODOS'),
      ('ABC_SALA_CONFIGURAR','GENERAL',true,true,false,false,'TODOS'),
      ('ABC_MESA_ASIGNAR','GENERAL',true,true,true,true,'TODOS'),
      ('ABC_MESA_RESERVAR','GENERAL',true,true,false,false,'TODOS'),
      ('ABC_MESA_BLOQUEAR','GENERAL',true,true,false,false,'TODOS'),
      ('ABC_CUENTA_REPARTIR','GENERAL',true,true,true,true,'TODOS'),
      ('ABC_CUENTA_UNIR','GENERAL',true,true,true,true,'TODOS'),
      ('ABC_REPARTO_REVERTIR','GENERAL',true,true,false,false,'TODOS'),
      ('ABC_COMANDA_VER','COMANDA',true,true,true,true,'TODOS'),
      ('ABC_COMANDA_CONFIGURAR','COMANDA',true,true,false,false,'TODOS'),
      ('ABC_COMANDA_CAMBIAR','COMANDA',true,true,false,true,'TODOS'),
      ('ABC_COMANDA_REIMPRIMIR','COMANDA',true,true,true,true,'TODOS'),
      ('ABC_COMANDA_MERMA_DECIDIR','COMANDA',true,true,false,false,'TODOS')
    ) as v(capacidad,familia,propietario,encargado,cajero,camarero,techo)
$$;

create function private.abc_cap_techo_permite(p_techo text, p_rol text)
returns boolean
language sql
immutable
security definer
set search_path=''
as $$
  select case p_techo
    when 'TODOS' then p_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ENCARGADO' then p_rol in ('Propietario','Encargado')
    when 'PROPIETARIO' then p_rol='Propietario'
    else false
  end
$$;

-- Los tres roles sobre los que el propietario puede decidir (el Propietario es fijo y los retirados no cuentan).
create function private.abc_cap_rol_configurable(p_rol text)
returns boolean
language sql
immutable
security definer
set search_path=''
as $$
  select coalesce(p_rol in ('Encargado','Cajero/a','Camarero/a'),false)
$$;

create function private.abc_cap_rol_retirado(p_rol text)
returns boolean
language sql
immutable
security definer
set search_path=''
as $$
  select coalesce(p_rol in ('Churrero/a','Básico','Estándar'),false)
$$;

-- 2. Decisiones del propietario (sin acceso directo). local_id nulo = toda la empresa; permitido nulo = heredar.
create table public.abc_capacidades_rol (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text,
  rol text not null,
  capacidad text not null,
  permitido boolean,
  version bigint not null default 1,
  motivo text not null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint abc_cap_rol_empresa_fk foreign key (empresa_id)
    references public.empresas(id) on delete restrict,
  constraint abc_cap_rol_local_fk foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint abc_cap_rol_rol check (rol in ('Encargado','Cajero/a','Camarero/a')),
  constraint abc_cap_rol_capacidad check (capacidad ~ '^ABC_[A-Z_]{3,60}$'),
  constraint abc_cap_rol_motivo check (nullif(btrim(motivo),'') is not null),
  constraint abc_cap_rol_version check (version>=1)
);

create unique index abc_cap_rol_uq
  on public.abc_capacidades_rol(empresa_id,coalesce(local_id,''),rol,capacidad);
create index abc_cap_rol_busqueda_idx
  on public.abc_capacidades_rol(empresa_id,rol,capacidad);

alter table public.abc_capacidades_rol enable row level security;
revoke all on table public.abc_capacidades_rol from public,anon,authenticated,service_role;

comment on table public.abc_capacidades_rol is
  'Decisiones del propietario sobre permisos (capa de configuración, pieza 5): por empresa (local_id nulo) o por local, para Encargado, Cajero/a y Camarero/a. permitido nulo = heredar. Sin acceso directo: abc_configurar_capacidad_rol y abc_obtener_capacidades_rol.';

-- 3. Resolución local -> empresa -> plantilla, con techo. Propietario: siempre la plantilla (todas).
create function private.abc_cap_efectiva(
  p_empresa_id text,
  p_local_id text,
  p_rol text,
  p_capacidad text,
  p_familia text
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_cat record;
  v_base boolean;
  v_dec boolean;
begin
  select * into v_cat
    from private.abc_cap_catalogo() c
   where c.capacidad=p_capacidad and c.familia=p_familia;
  if not found then return false; end if;

  v_base:=case p_rol
    when 'Propietario' then v_cat.propietario
    when 'Encargado' then v_cat.encargado
    when 'Cajero/a' then v_cat.cajero
    when 'Camarero/a' then v_cat.camarero
    else false
  end;
  if not private.abc_cap_rol_configurable(p_rol) then
    return v_base;
  end if;

  select r.permitido into v_dec
    from public.abc_capacidades_rol r
   where r.empresa_id=p_empresa_id and r.local_id=p_local_id
     and r.rol=p_rol and r.capacidad=p_capacidad and r.permitido is not null;
  if v_dec is null then
    select r.permitido into v_dec
      from public.abc_capacidades_rol r
     where r.empresa_id=p_empresa_id and r.local_id is null
       and r.rol=p_rol and r.capacidad=p_capacidad and r.permitido is not null;
  end if;

  return coalesce(v_dec,v_base) and private.abc_cap_techo_permite(v_cat.techo,p_rol);
end $$;

-- Quién puede decidir para toda la empresa: el Propietario con acceso a todos sus locales (y al local indicado).
create function private.abc_config_puede_configurar_empresa(p_empresa_id text, p_local_id text)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then return false; end if;
  if not coalesce(private.abc_config_puede_configurar(p_empresa_id,p_local_id),false) then return false; end if;
  return exists(
    select 1
      from public.membresias_usuario m
     where m.user_id=auth.uid()
       and m.empresa_id=p_empresa_id
       and m.activo=true
       and m.todos_locales=true
       and m.local_id is null
       and m.rol='Propietario'
  );
end $$;

-- 4. Reemplazo de `abc_tiene_capacidad`: mismo inicio que la versión de B04, final nuevo.
create or replace function private.abc_tiene_capacidad(
  p_empresa_id text,
  p_local_id text,
  p_capacidad text
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_rol text;
  v_capacidad text := upper(btrim(coalesce(p_capacidad,'')));
begin
  if auth.uid() is null then return false; end if;
  if nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null
     or v_capacidad='' then
    return false;
  end if;
  if not private.la_tiene_local(p_empresa_id,p_local_id) then return false; end if;

  select m.rol into v_rol
    from public.membresias_usuario m
   where m.user_id=auth.uid()
     and m.empresa_id=p_empresa_id
     and m.activo=true
     and ((m.todos_locales=false and m.local_id=p_local_id)
       or (m.todos_locales=true and m.local_id is null))
   order by case when m.todos_locales=false and m.local_id=p_local_id then 0 else 1 end,m.id desc
   limit 1;

  if v_rol is null then return false; end if;

  return private.abc_cap_efectiva(p_empresa_id,p_local_id,v_rol,v_capacidad,'GENERAL');
end $$;

-- Reemplazo de `abc_a10_tiene_capacidad`: mismo inicio que la versión de A10, final nuevo.
create or replace function private.abc_a10_tiene_capacidad(
  p_empresa_id text,
  p_local_id text,
  p_capacidad text
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_rol text;
  v_cap text:=upper(btrim(coalesce(p_capacidad,'')));
begin
  if auth.uid() is null or v_cap='' or not private.la_tiene_local(p_empresa_id,p_local_id) then
    return false;
  end if;

  select m.rol into v_rol
    from public.membresias_usuario m
   where m.user_id=auth.uid()
     and m.empresa_id=p_empresa_id
     and m.activo=true
     and (
       (m.todos_locales=false and m.local_id=p_local_id)
       or (m.todos_locales=true and m.local_id is null)
     )
   order by case when m.todos_locales=false and m.local_id=p_local_id then 0 else 1 end,m.id desc
   limit 1;

  if v_rol is null then
    return false;
  end if;

  return private.abc_cap_efectiva(p_empresa_id,p_local_id,v_rol,v_cap,'COMANDA');
end $$;

-- 5. D14: reabrir un cierre provisional exige la capacidad nueva (por defecto solo Propietario).
create or replace function public.abc_reabrir_cierre_provisional(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid,
  p_terminal_id uuid,
  p_motivo text,
  p_operating_day date
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
  v_cierre public.caja_cierres%rowtype;
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CIERRE_REABRIR') then raise exception 'abc_caja_no_autorizado'; end if;
  if v_motivo is null or p_session_id is null or p_terminal_id is null or p_operating_day is null then raise exception 'reapertura_motivo_requerido'; end if;
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_REABRIR_CIERRE_PROVISIONAL',jsonb_build_object('session_id',p_session_id,'terminal_id',p_terminal_id,'motivo',v_motivo,'operating_day',p_operating_day),p_terminal_id);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;
  select * into v_cierre from public.caja_cierres c where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.session_id=p_session_id and c.estado='PROVISIONAL' for update;
  if not found then raise exception 'cierre_provisional_no_encontrado'; end if;
  perform 1 from public.caja_sesiones s where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.id=p_session_id and s.estado='CIERRE_PROVISIONAL' for update;
  if not found then raise exception 'sesion_no_provisional'; end if;
  update public.caja_cierres set estado='CANCELADO',version=version+1,finalizado_por=auth.uid(),completed_at=now(),expected_snapshot=expected_snapshot||jsonb_build_object('reopened',true,'reopen_reason',v_motivo,'reopened_at',now()) where id=v_cierre.id;
  update public.caja_sesiones set estado='ABIERTA',version=version+1 where empresa_id=p_empresa_id and local_id=p_local_id and id=p_session_id;
  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
  values(p_empresa_id,p_local_id,p_operation_id,'CAJA_SESION',p_session_id::text,'CAJA_SESION_REABIERTA',jsonb_build_object('cierre_id',v_cierre.id,'motivo',v_motivo),auth.uid(),p_terminal_id,now(),p_operating_day);
  v_result:=jsonb_build_object('ok',true,'session_id',p_session_id,'cierre_id',v_cierre.id,'estado','ABIERTA','motivo',v_motivo);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

-- 6. Decidir un permiso (solo el Propietario).
--    p_ambito = 'LOCAL' (la decisión vale para p_local_id) o 'EMPRESA' (vale para todos los locales de la empresa;
--    p_local_id es el local desde el que se hace y donde queda la operación y la auditoría).
--    p_permitido: true = permitir (hasta el techo), false = quitar, null = heredar.
create function public.abc_configurar_capacidad_rol(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_ambito text,
  p_rol text,
  p_capacidad text,
  p_permitido boolean,
  p_motivo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_ambito text:=upper(btrim(coalesce(p_ambito,'')));
  v_rol text:=btrim(coalesce(p_rol,''));
  v_cap text:=upper(btrim(coalesce(p_capacidad,'')));
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_cat record;
  v_autorizado boolean;
  v_destino text;
  v_request jsonb;
  v_cmd jsonb;
  v_prev public.abc_capacidades_rol%rowtype;
  v_found boolean;
  v_antes boolean;
  v_cambio boolean;
  v_version bigint;
  v_ef_antes boolean;
  v_ef_despues boolean;
  v_result jsonb;
begin
  if v_ambito='EMPRESA' then
    v_autorizado:=coalesce(private.abc_config_puede_configurar_empresa(p_empresa_id,p_local_id),false);
  else
    v_autorizado:=coalesce(private.abc_config_puede_configurar(p_empresa_id,p_local_id),false);
  end if;
  if auth.uid() is null or not v_autorizado then
    raise exception 'abc_config_no_autorizado';
  end if;
  if v_ambito not in ('LOCAL','EMPRESA') then raise exception 'capacidad_ambito_invalido'; end if;
  if not private.abc_cap_rol_configurable(v_rol) then raise exception 'capacidad_rol_invalido'; end if;
  select * into v_cat from private.abc_cap_catalogo() c where c.capacidad=v_cap;
  if not found then raise exception 'capacidad_invalida'; end if;
  if p_permitido is true and not private.abc_cap_techo_permite(v_cat.techo,v_rol) then
    raise exception 'capacidad_fuera_de_techo';
  end if;
  if v_motivo is null then raise exception 'capacidad_motivo_requerido'; end if;
  if not exists(
    select 1 from public.locales l
     where l.empresa_id=p_empresa_id and l.id=p_local_id and l.activo=true
  ) then
    raise exception 'capacidad_local_no_disponible';
  end if;

  v_destino:=case when v_ambito='EMPRESA' then null else p_local_id end;
  v_request:=jsonb_build_object(
    'ambito',v_ambito,'local_id',p_local_id,'rol',v_rol,'capacidad',v_cap,'permitido',p_permitido,'motivo',v_motivo
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIGURAR_CAPACIDAD_ROL',v_request,null
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  perform pg_advisory_xact_lock(hashtext('abc_capacidades:'||p_empresa_id));

  select * into v_prev
    from public.abc_capacidades_rol r
   where r.empresa_id=p_empresa_id and r.rol=v_rol and r.capacidad=v_cap
     and r.local_id is not distinct from v_destino
   for update;
  v_found:=found;
  v_antes:=case when v_found then v_prev.permitido else null end;
  v_ef_antes:=private.abc_cap_efectiva(p_empresa_id,p_local_id,v_rol,v_cap,v_cat.familia);
  v_cambio:=v_antes is distinct from p_permitido;

  if not v_cambio then
    v_version:=case when v_found then v_prev.version else 0 end;
  else
    if v_found then
      update public.abc_capacidades_rol
         set permitido=p_permitido,version=version+1,motivo=v_motivo,updated_by=auth.uid(),updated_at=now()
       where id=v_prev.id
      returning version into v_version;
    else
      insert into public.abc_capacidades_rol(
        empresa_id,local_id,rol,capacidad,permitido,version,motivo,created_by,updated_by
      ) values (
        p_empresa_id,v_destino,v_rol,v_cap,p_permitido,1,v_motivo,auth.uid(),auth.uid()
      );
      v_version:=1;
    end if;
    v_ef_despues:=private.abc_cap_efectiva(p_empresa_id,p_local_id,v_rol,v_cap,v_cat.familia);
    insert into public.abc_eventos(
      empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
      payload,actor_user_id,terminal_id,occurred_at,operating_day
    ) values (
      p_empresa_id,p_local_id,p_operation_id,'CAPACIDAD_ROL',
      coalesce(v_destino,'*')||'/'||v_rol||'/'||v_cap,'CAPACIDAD_ROL_CONFIGURADA',
      jsonb_build_object(
        'ambito',v_ambito,'local_destino',v_destino,'rol',v_rol,'capacidad',v_cap,
        'anterior',v_antes,'nuevo',p_permitido,'version',v_version,'motivo',v_motivo,
        'efectivo_antes',v_ef_antes,'efectivo_despues',v_ef_despues
      ),
      auth.uid(),null,now(),private.abc_config_dia_evento(p_empresa_id,p_local_id)
    );
  end if;

  v_result:=jsonb_build_object(
    'ok',true,'ambito',v_ambito,'local_id',v_destino,'rol',v_rol,'capacidad',v_cap,
    'permitido',p_permitido,'cambio',v_cambio,'version',v_version,
    'efectivo_en_local',private.abc_cap_efectiva(p_empresa_id,p_local_id,v_rol,v_cap,v_cat.familia)
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

-- 7. Ver los permisos de un local (cualquier miembro del local): efectivos, plantilla, de dónde vienen y el techo.
create function public.abc_obtener_capacidades_rol(
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
  v_caps jsonb;
begin
  if auth.uid() is null
     or nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null
     or not coalesce(private.la_tiene_local(p_empresa_id,p_local_id),false) then
    raise exception 'abc_config_no_autorizado';
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'capacidad',c.capacidad,'familia',c.familia,'techo',c.techo,
             'roles',(
               select jsonb_agg(
                        jsonb_build_object(
                          'rol',r.rol,
                          'efectivo',private.abc_cap_efectiva(p_empresa_id,p_local_id,r.rol,c.capacidad,c.familia),
                          'plantilla',case r.rol when 'Propietario' then c.propietario when 'Encargado' then c.encargado
                                                 when 'Cajero/a' then c.cajero else c.camarero end,
                          'origen',case when r.rol='Propietario' then 'fijo'
                                        when lo.permitido is not null then 'local'
                                        when em.permitido is not null then 'empresa'
                                        else 'plantilla' end,
                          'decision_local',lo.permitido,
                          'decision_empresa',em.permitido,
                          'puede_dar',(r.rol<>'Propietario' and private.abc_cap_techo_permite(c.techo,r.rol))
                        ) order by r.ord)
                 from (values (1,'Propietario'),(2,'Encargado'),(3,'Cajero/a'),(4,'Camarero/a')) as r(ord,rol)
                 left join public.abc_capacidades_rol lo
                   on lo.empresa_id=p_empresa_id and lo.local_id=p_local_id and lo.rol=r.rol and lo.capacidad=c.capacidad
                 left join public.abc_capacidades_rol em
                   on em.empresa_id=p_empresa_id and em.local_id is null and em.rol=r.rol and em.capacidad=c.capacidad
             )
           ) order by c.familia,c.capacidad)
    into v_caps
    from private.abc_cap_catalogo() c;

  return jsonb_build_object(
    'ok',true,'empresa_id',p_empresa_id,'local_id',p_local_id,
    'puede_configurar_local',coalesce(private.abc_config_puede_configurar(p_empresa_id,p_local_id),false),
    'puede_configurar_empresa',coalesce(private.abc_config_puede_configurar_empresa(p_empresa_id,p_local_id),false),
    'roles_configurables',jsonb_build_array('Encargado','Cajero/a','Camarero/a'),
    'roles_retirados',jsonb_build_array('Churrero/a','Básico','Estándar'),
    'capacidades',coalesce(v_caps,'[]'::jsonb)
  );
end $$;

-- 8. Personas que aún tienen un rol retirado en un local (solo el Propietario), para reasignarlas.
create function public.abc_listar_roles_retirados(
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
     or not coalesce(private.abc_config_puede_configurar(p_empresa_id,p_local_id),false) then
    raise exception 'abc_config_no_autorizado';
  end if;

  return jsonb_build_object(
    'ok',true,'empresa_id',p_empresa_id,'local_id',p_local_id,
    'roles_retirados',jsonb_build_array('Churrero/a','Básico','Estándar'),
    'personas',coalesce(
      (select jsonb_agg(
                jsonb_build_object(
                  'user_id',m.user_id,
                  'nombre',(select pf.nombre from public.perfiles pf where pf.user_id=m.user_id order by pf.updated_at desc limit 1),
                  'rol',m.rol,'activo',m.activo,'todos_locales',m.todos_locales,'local_id',m.local_id
                ) order by m.rol,m.id)
         from public.membresias_usuario m
        where m.empresa_id=p_empresa_id
          and private.abc_cap_rol_retirado(m.rol)
          and (m.local_id=p_local_id or (m.todos_locales=true and m.local_id is null))),
      '[]'::jsonb
    )
  );
end $$;

-- 9. Retirada de roles: nadie recibe (ni recupera) Churrero/a, Básico o Estándar. Quien ya los tiene no se toca.
create function private.abc_cfg5_guard_rol_retirado()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if private.abc_cap_rol_retirado(new.rol) then
    if tg_op='INSERT'
       or new.rol is distinct from old.rol
       or (new.activo=true and old.activo is distinct from true) then
      raise exception 'rol_retirado:%',new.rol;
    end if;
  end if;
  return new;
end $$;

create trigger abc_f6_cfg5_guard_rol_retirado
  before insert or update of rol,activo on public.membresias_usuario
  for each row execute function private.abc_cfg5_guard_rol_retirado();

-- 10. Permisos de ejecución: lo privado, solo para el dueño; lo público, solo para authenticated.
revoke all on function private.abc_cap_catalogo() from public,anon,authenticated,service_role;
revoke all on function private.abc_cap_techo_permite(text,text) from public,anon,authenticated,service_role;
revoke all on function private.abc_cap_rol_configurable(text) from public,anon,authenticated,service_role;
revoke all on function private.abc_cap_rol_retirado(text) from public,anon,authenticated,service_role;
revoke all on function private.abc_cap_efectiva(text,text,text,text,text) from public,anon,authenticated,service_role;
revoke all on function private.abc_config_puede_configurar_empresa(text,text) from public,anon,authenticated,service_role;
revoke all on function private.abc_cfg5_guard_rol_retirado() from public,anon,authenticated,service_role;
revoke all on function private.abc_tiene_capacidad(text,text,text) from public,anon,authenticated,service_role;
revoke all on function private.abc_a10_tiene_capacidad(text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.abc_reabrir_cierre_provisional(text,text,text,uuid,uuid,text,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_configurar_capacidad_rol(text,text,text,text,text,text,boolean,text) from public,anon,authenticated,service_role;
revoke all on function public.abc_obtener_capacidades_rol(text,text) from public,anon,authenticated,service_role;
revoke all on function public.abc_listar_roles_retirados(text,text) from public,anon,authenticated,service_role;
grant execute on function public.abc_reabrir_cierre_provisional(text,text,text,uuid,uuid,text,date) to authenticated;
grant execute on function public.abc_configurar_capacidad_rol(text,text,text,text,text,text,boolean,text) to authenticated;
grant execute on function public.abc_obtener_capacidades_rol(text,text) to authenticated;
grant execute on function public.abc_listar_roles_retirados(text,text) to authenticated;

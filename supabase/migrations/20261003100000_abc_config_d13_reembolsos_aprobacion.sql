-- ABC · D13 devoluciones: nada sale sin aprobación (solo QA hasta que Pedro autorice otra cosa).
--
-- Decisión de Pedro (3/10/2026, plan F6_D13_DEVOLUCIONES_HALLAZGOS_Y_PLAN_2026-10-03.md): «Propietario y encargado; el cajero solo con
-- aprobación». A: servidor, permiso y pantalla. B: aprueban Encargado y Propietario. C: lo que solicita un Encargado o el Propietario se
-- aprueba en el acto. D: el Cajero/a no puede solicitar devoluciones por defecto; lo activa el Propietario en Configuración → Permisos.
--
-- Hallazgo que corrige: `abc_solicitar_reembolso` encolaba el envío al proveedor (`PROVIDER_REEMBOLSO`) en el momento de SOLICITAR cuando
-- el pago no es en efectivo; con un proveedor real, quien pudiera solicitar movería dinero sin aprobación.
--
-- Qué hace (solo un cambio de comportamiento: el momento en que sale el envío, y quién puede pedir):
--  1. `reembolsos.aprobado_por` / `aprobado_at` (las dos o ninguna). Las filas que ya existían se dan por aprobadas al solicitarse (así
--     funcionaba antes y, si no eran en efectivo, ya estaban encoladas). Sin estado nuevo: la máquina de estados no cambia.
--  2. `abc_solicitar_reembolso`: quien tiene la capacidad de confirmar aprueba su solicitud en el acto y, como hasta ahora, se encola el
--     envío si no es efectivo. Quien no la tiene deja la solicitud PENDIENTE sin aprobar y NO se encola nada. Eventos REEMBOLSO_SOLICITADO
--     (con `requiere_aprobacion`) y REEMBOLSO_APROBADO (automática).
--  3. `abc_aprobar_reembolso` (nueva): capacidad ABC_REEMBOLSO_CONFIRMAR; la solicitud debe estar PENDIENTE y sin aprobar; **nadie
--     aprueba lo que solicitó él mismo**; deja constancia de quién y cuándo y encola el envío si no es efectivo. Rechazar sigue siendo
--     `abc_cancelar_reembolso` (con motivo, ya exigía ABC_REEMBOLSO_CONFIRMAR).
--  4. `abc_confirmar_reembolso_efectivo`: exige que esté aprobado (`reembolso_pendiente_aprobacion`).
--  5. Permiso: `ABC_REEMBOLSO_SOLICITAR` pasa a poder darse al Cajero/a (techo nuevo CAJERO); `ABC_REEMBOLSO_CONFIRMAR` sigue con techo
--     Encargado. La plantilla no cambia: el Cajero/a no la tiene hasta que el Propietario se la dé.
--
-- No cambia: el saldo reembolsable, el bloqueo ordenado de aplicaciones, la guarda de moneda, `abc_cancelar_reembolso`,
-- `abc_resolver_reembolso` (solo el sistema), el movimiento negativo de caja del efectivo ni el stock.

set local lock_timeout = '10s';

do $$
declare
  v_missing text[] := array[]::text[];
  v_h text;
begin
  if to_regclass('public.reembolsos') is null then v_missing:=array_append(v_missing,'reembolsos'); end if;
  if to_regclass('public.pagos') is null then v_missing:=array_append(v_missing,'pagos'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regprocedure('private.abc_cap_catalogo()') is null then v_missing:=array_append(v_missing,'abc_cap_catalogo (pieza 5)'); end if;
  if to_regprocedure('private.abc_cap_techo_permite(text,text)') is null then v_missing:=array_append(v_missing,'abc_cap_techo_permite (pieza 5)'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_encolar_efecto(text,text,text,text,text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_encolar_efecto (M04C)'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('auth.uid()') is null then v_missing:=array_append(v_missing,'auth.uid'); end if;
  if to_regprocedure('public.abc_solicitar_reembolso(text,text,text,uuid,uuid,numeric,text,uuid,date)') is null then v_missing:=array_append(v_missing,'abc_solicitar_reembolso'); end if;
  if to_regprocedure('public.abc_confirmar_reembolso_efectivo(text,text,text,uuid,uuid,uuid,uuid,date)') is null then v_missing:=array_append(v_missing,'abc_confirmar_reembolso_efectivo'); end if;
  if to_regprocedure('public.abc_cancelar_reembolso(text,text,text,uuid,text,uuid,date)') is null then v_missing:=array_append(v_missing,'abc_cancelar_reembolso'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_D13_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  -- Las cinco funciones que se reemplazan (o que no se tocan y se asumen) tienen que ser exactamente las conocidas.
  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid='public.abc_solicitar_reembolso(text,text,text,uuid,uuid,numeric,text,uuid,date)'::regprocedure;
  if v_h is distinct from '3b7f35bdfe8a753aa479290fa99001e9' then raise exception 'ABC_D13_PREFLIGHT_FALLO:funcion_distinta:abc_solicitar_reembolso:%',v_h; end if;
  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid='public.abc_confirmar_reembolso_efectivo(text,text,text,uuid,uuid,uuid,uuid,date)'::regprocedure;
  if v_h is distinct from '760a2afd8a0049bae6d7ed927eaffe95' then raise exception 'ABC_D13_PREFLIGHT_FALLO:funcion_distinta:abc_confirmar_reembolso_efectivo:%',v_h; end if;
  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid='public.abc_cancelar_reembolso(text,text,text,uuid,text,uuid,date)'::regprocedure;
  if v_h is distinct from 'd7cb66acc9cc9514f4ecc572f10d7334' then raise exception 'ABC_D13_PREFLIGHT_FALLO:funcion_distinta:abc_cancelar_reembolso:%',v_h; end if;
  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid='private.abc_cap_catalogo()'::regprocedure;
  if v_h is distinct from '071f31a0df29ded3b2d7346b1f4344aa' then raise exception 'ABC_D13_PREFLIGHT_FALLO:funcion_distinta:abc_cap_catalogo:%',v_h; end if;
  select md5(replace(p.prosrc,chr(13),'')) into v_h from pg_proc p where p.oid='private.abc_cap_techo_permite(text,text)'::regprocedure;
  if v_h is distinct from '210fcaa1f84cd6c953dd499ab51b10c0' then raise exception 'ABC_D13_PREFLIGHT_FALLO:funcion_distinta:abc_cap_techo_permite:%',v_h; end if;

  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='reembolsos' and column_name in ('aprobado_por','aprobado_at'))
     or to_regprocedure('public.abc_aprobar_reembolso(text,text,text,uuid,uuid,date)') is not null then
    raise exception 'ABC_D13_PREFLIGHT_FALLO: objetos de D13 ya existen';
  end if;
end $$;

-- 1. Aprobación: las dos columnas o ninguna. Lo que ya existía se da por aprobado al solicitarse (regla anterior).
alter table public.reembolsos
  add column aprobado_por uuid references auth.users(id) on delete restrict,
  add column aprobado_at timestamptz,
  add constraint abc_d13_reembolso_aprobacion_par check ((aprobado_por is null) = (aprobado_at is null));

update public.reembolsos
   set aprobado_por=created_by,
       aprobado_at=created_at
 where aprobado_at is null;

-- 2. Catálogo de capacidades: ABC_REEMBOLSO_SOLICITAR se puede dar hasta el Cajero/a.
create or replace function private.abc_cap_catalogo()
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
      ('ABC_REEMBOLSO_SOLICITAR','GENERAL',true,true,false,false,'CAJERO'),
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

-- (techo nuevo CAJERO: Propietario, Encargado y Cajero/a)
create or replace function private.abc_cap_techo_permite(p_techo text, p_rol text)
returns boolean
language sql
immutable
security definer
set search_path=''
as $$
  select case p_techo
    when 'TODOS' then p_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'CAJERO' then p_rol in ('Propietario','Encargado','Cajero/a')
    when 'ENCARGADO' then p_rol in ('Propietario','Encargado')
    when 'PROPIETARIO' then p_rol='Propietario'
    else false
  end
$$;

-- 2b. Solicitar: la aprobación decide si sale el envío.
create or replace function public.abc_solicitar_reembolso(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_reembolso_id uuid,
  p_pago_id uuid,
  p_importe_solicitado numeric,
  p_motivo text,
  p_terminal_id uuid,
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
  v_request jsonb;
  v_pago public.pagos%rowtype;
  v_importe numeric(24,8);
  v_motivo text:=btrim(coalesce(p_motivo,''));
  v_ids uuid[];
  v_total_disponible numeric(24,8):=0;
  v_restante numeric(24,8);
  v_disp_pago numeric(24,8);
  v_disp_venta numeric(24,8);
  v_asignado numeric(24,8);
  r record;
  v_result jsonb;
  v_auto boolean;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(
       p_empresa_id,p_local_id,'ABC_REEMBOLSO_SOLICITAR'
     ) then
    raise exception 'abc_reembolso_no_autorizado';
  end if;

  if p_reembolso_id is null or p_pago_id is null or p_operating_day is null then
    raise exception 'reembolso_parametros_requeridos';
  end if;
  if p_importe_solicitado is null or p_importe_solicitado<=0 then
    raise exception 'importe_reembolso_invalido';
  end if;
  if p_importe_solicitado<>round(p_importe_solicitado,8) then
    raise exception 'importe_reembolso_precision_invalida';
  end if;
  if v_motivo='' then raise exception 'motivo_reembolso_requerido'; end if;

  v_importe:=p_importe_solicitado::numeric(24,8);
  v_request:=jsonb_build_object(
    'reembolso_id',p_reembolso_id,
    'pago_id',p_pago_id,
    'importe_solicitado',v_importe,
    'motivo',v_motivo,
    'terminal_id',p_terminal_id,
    'operating_day',p_operating_day
  );

  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_SOLICITAR_REEMBOLSO',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select *
    into v_pago
    from public.pagos
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_pago_id
   for update;

  if not found then raise exception 'pago_no_encontrado'; end if;
  if v_pago.estado<>'CONFIRMADO' then raise exception 'pago_no_reembolsable'; end if;
  if v_pago.payment_currency_code<>v_pago.sale_currency_code then
    raise exception 'conversion_reembolso_no_habilitada';
  end if;

  select array_agg(a.id order by a.id)
    into v_ids
    from public.pago_aplicaciones a
   where a.empresa_id=p_empresa_id
     and a.local_id=p_local_id
     and a.pago_id=p_pago_id;

  if v_ids is null or cardinality(v_ids)=0 then
    raise exception 'pago_sin_aplicaciones_confirmadas';
  end if;

  perform private.abc_bloquear_aplicaciones(
    p_empresa_id,p_local_id,v_ids
  );

  for r in
    select a.*
      from public.pago_aplicaciones a
     where a.empresa_id=p_empresa_id
       and a.local_id=p_local_id
       and a.pago_id=p_pago_id
     order by a.confirmed_at,a.id
  loop
    if r.payment_currency_code<>r.sale_currency_code
       or r.payment_amount<>r.sale_amount then
      raise exception 'conversion_reembolso_no_habilitada';
    end if;
    v_disp_pago:=private.abc_max_reembolsable_pago(
      p_empresa_id,p_local_id,r.id
    );
    v_disp_venta:=private.abc_max_reembolsable_venta(
      p_empresa_id,p_local_id,r.id
    );
    v_total_disponible:=v_total_disponible+least(v_disp_pago,v_disp_venta);
  end loop;

  if v_importe>v_total_disponible then
    raise exception 'saldo_reembolsable_insuficiente';
  end if;

  -- D13: quien ya puede confirmar devoluciones (Propietario y Encargado) aprueba su propia solicitud en el acto; quien solo
  -- puede solicitarlas (Cajero/a, si el Propietario se lo da) deja la solicitud pendiente de que OTRA persona la apruebe.
  v_auto:=private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_REEMBOLSO_CONFIRMAR');
  insert into public.reembolsos(
    id,empresa_id,local_id,pago_id,abc_command_id,estado,
    payment_currency_code,importe_solicitado,motivo,created_by,
    aprobado_por,aprobado_at
  ) values (
    p_reembolso_id,p_empresa_id,p_local_id,p_pago_id,p_operation_id,'PENDIENTE',
    v_pago.payment_currency_code,v_importe,v_motivo,auth.uid(),
    case when v_auto then auth.uid() end,case when v_auto then now() end
  );

  v_restante:=v_importe;
  for r in
    select a.*
      from public.pago_aplicaciones a
     where a.empresa_id=p_empresa_id
       and a.local_id=p_local_id
       and a.pago_id=p_pago_id
     order by a.confirmed_at,a.id
  loop
    exit when v_restante<=0;

    v_disp_pago:=private.abc_max_reembolsable_pago(
      p_empresa_id,p_local_id,r.id
    );
    v_disp_venta:=private.abc_max_reembolsable_venta(
      p_empresa_id,p_local_id,r.id
    );
    v_asignado:=least(v_restante,v_disp_pago,v_disp_venta);

    if v_asignado>0 then
      insert into public.reembolso_aplicaciones(
        id,empresa_id,local_id,reembolso_id,pago_aplicacion_id,
        venta_fiscal_id,importe_venta,sale_currency_code,
        importe_pago,payment_currency_code
      ) values (
        gen_random_uuid(),p_empresa_id,p_local_id,p_reembolso_id,r.id,
        r.venta_fiscal_id,v_asignado,r.sale_currency_code,
        v_asignado,r.payment_currency_code
      );
      v_restante:=v_restante-v_asignado;
    end if;
  end loop;

  if v_restante<>0 then raise exception 'reembolso_reserva_incompleta'; end if;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'REEMBOLSO',p_reembolso_id::text,
    'REEMBOLSO_SOLICITADO',
    jsonb_build_object(
      'pago_id',p_pago_id,
      'importe',v_importe,
      'currency_code',v_pago.payment_currency_code,
      'motivo',v_motivo,
      'requiere_aprobacion',not v_auto
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );
  if v_auto then
    insert into public.abc_eventos(
      empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
      payload,actor_user_id,terminal_id,occurred_at,operating_day
    ) values (
      p_empresa_id,p_local_id,p_operation_id,'REEMBOLSO',p_reembolso_id::text,
      'REEMBOLSO_APROBADO',
      jsonb_build_object(
        'pago_id',p_pago_id,
        'importe',v_importe,
        'automatica',true
      ),
      auth.uid(),p_terminal_id,now(),p_operating_day
    );
  end if;
  -- D13: nada sale hacia el proveedor hasta que el reembolso esté aprobado.
  if v_auto and v_pago.medio<>'EFECTIVO' then
    perform private.abc_encolar_efecto(
      p_empresa_id,p_local_id,p_operation_id,
      'PROVIDER_REEMBOLSO',
      'reembolso:'||p_reembolso_id::text,
      jsonb_build_object(
        'reembolso_id',p_reembolso_id,
        'pago_id',p_pago_id,
        'importe',v_importe,
        'currency_code',v_pago.payment_currency_code,
        'motivo',v_motivo,
        'terminal_id',p_terminal_id,
        'operating_day',p_operating_day
      )
    );
  end if;

  v_result:=jsonb_build_object(
    'ok',true,
    'reembolso_id',p_reembolso_id,
    'pago_id',p_pago_id,
    'estado','PENDIENTE',
    'importe_comprometido',v_importe,
    'currency_code',v_pago.payment_currency_code,
    'requiere_aprobacion',not v_auto,
    'aprobado',v_auto
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

-- 3. Aprobar una solicitud pendiente (nueva).
create function public.abc_aprobar_reembolso(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_reembolso_id uuid,
  p_terminal_id uuid,
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
  v_request jsonb;
  v_reembolso public.reembolsos%rowtype;
  v_pago public.pagos%rowtype;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(
       p_empresa_id,p_local_id,'ABC_REEMBOLSO_CONFIRMAR'
     ) then
    raise exception 'abc_aprobar_reembolso_no_autorizado';
  end if;
  if p_reembolso_id is null or p_operating_day is null then
    raise exception 'aprobacion_reembolso_parametros_requeridos';
  end if;
  v_request:=jsonb_build_object(
    'reembolso_id',p_reembolso_id,
    'terminal_id',p_terminal_id,
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_APROBAR_REEMBOLSO',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select *
    into v_reembolso
    from public.reembolsos
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_reembolso_id
   for update;
  if not found then raise exception 'reembolso_no_encontrado'; end if;
  if v_reembolso.estado<>'PENDIENTE' then raise exception 'reembolso_no_aprobable'; end if;
  if v_reembolso.aprobado_at is not null then raise exception 'reembolso_ya_aprobado'; end if;
  -- Separación de funciones: nadie aprueba lo que solicitó él mismo.
  if v_reembolso.created_by=auth.uid() then
    raise exception 'reembolso_aprobador_distinto_solicitante';
  end if;

  select *
    into v_pago
    from public.pagos
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=v_reembolso.pago_id
   for update;
  if not found then raise exception 'pago_no_encontrado'; end if;

  update public.reembolsos
     set aprobado_por=auth.uid(),
         aprobado_at=now()
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_reembolso_id;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'REEMBOLSO',p_reembolso_id::text,
    'REEMBOLSO_APROBADO',
    jsonb_build_object(
      'pago_id',v_reembolso.pago_id,
      'importe',v_reembolso.importe_solicitado,
      'automatica',false,
      'solicitado_por',v_reembolso.created_by
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  -- Solo ahora puede salir el envío al proveedor (si no es efectivo).
  if v_pago.medio<>'EFECTIVO' then
    perform private.abc_encolar_efecto(
      p_empresa_id,p_local_id,p_operation_id,
      'PROVIDER_REEMBOLSO',
      'reembolso:'||p_reembolso_id::text,
      jsonb_build_object(
        'reembolso_id',p_reembolso_id,
        'pago_id',v_reembolso.pago_id,
        'importe',v_reembolso.importe_solicitado,
        'currency_code',v_pago.payment_currency_code,
        'motivo',v_reembolso.motivo,
        'terminal_id',p_terminal_id,
        'operating_day',p_operating_day
      )
    );
  end if;

  v_result:=jsonb_build_object(
    'ok',true,
    'reembolso_id',p_reembolso_id,
    'estado','PENDIENTE',
    'aprobado',true,
    'aprobado_por',auth.uid()
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

revoke all on function public.abc_aprobar_reembolso(text,text,text,uuid,uuid,date)
  from public,anon,authenticated,service_role;
grant execute on function public.abc_aprobar_reembolso(text,text,text,uuid,uuid,date) to authenticated;

-- 4. Confirmar en efectivo: exige aprobación.
create or replace function public.abc_confirmar_reembolso_efectivo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_reembolso_id uuid,
  p_caja_id uuid,
  p_session_id uuid,
  p_terminal_id uuid,
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
  v_request jsonb;
  v_reembolso public.reembolsos%rowtype;
  v_pago public.pagos%rowtype;
  v_ids uuid[];
  v_cash_operation_id text;
  v_pago_estado text;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(
       p_empresa_id,p_local_id,'ABC_REEMBOLSO_CONFIRMAR'
     ) then
    raise exception 'abc_confirmar_reembolso_no_autorizado';
  end if;
  if p_reembolso_id is null or p_caja_id is null or p_session_id is null
     or p_terminal_id is null or p_operating_day is null then
    raise exception 'reembolso_efectivo_parametros_requeridos';
  end if;

  v_request:=jsonb_build_object(
    'reembolso_id',p_reembolso_id,
    'caja_id',p_caja_id,
    'session_id',p_session_id,
    'terminal_id',p_terminal_id,
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_CONFIRMAR_REEMBOLSO_EFECTIVO',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select *
    into v_reembolso
    from public.reembolsos
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_reembolso_id
   for update;

  if not found then raise exception 'reembolso_no_encontrado'; end if;

  select *
    into v_pago
    from public.pagos
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=v_reembolso.pago_id
   for update;

  if not found then raise exception 'pago_no_encontrado'; end if;
  if v_reembolso.estado<>'PENDIENTE' then
    raise exception 'reembolso_efectivo_no_confirmable';
  end if;
  -- D13: el dinero no sale de la caja hasta que el reembolso esté aprobado.
  if v_reembolso.aprobado_at is null then
    raise exception 'reembolso_pendiente_aprobacion';
  end if;
  if v_pago.medio<>'EFECTIVO' then raise exception 'reembolso_no_efectivo'; end if;
  if v_reembolso.provider_code is not null
     or v_reembolso.provider_reference is not null then
    raise exception 'reembolso_efectivo_con_proveedor';
  end if;

  perform 1
    from public.caja_sesiones s
   where s.empresa_id=p_empresa_id
     and s.local_id=p_local_id
     and s.id=p_session_id
     and s.caja_id=p_caja_id
     and s.estado='ABIERTA'
   for update;
  if not found then raise exception 'sesion_caja_no_abierta'; end if;

  if not exists(
    select 1
      from public.caja_sesion_terminales st
     where st.empresa_id=p_empresa_id
       and st.local_id=p_local_id
       and st.session_id=p_session_id
       and st.terminal_id=p_terminal_id
       and st.hasta is null
       and st.desde<=now()
  ) then
    raise exception 'terminal_no_vinculado_sesion';
  end if;

  select array_agg(ra.pago_aplicacion_id order by ra.pago_aplicacion_id)
    into v_ids
    from public.reembolso_aplicaciones ra
   where ra.empresa_id=p_empresa_id
     and ra.local_id=p_local_id
     and ra.reembolso_id=p_reembolso_id;

  if v_ids is null then raise exception 'reembolso_sin_aplicaciones'; end if;
  perform private.abc_bloquear_aplicaciones(
    p_empresa_id,p_local_id,v_ids
  );

  update public.reembolsos
     set estado='CONFIRMADO',
         resolved_at=now()
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_reembolso_id;

  v_cash_operation_id:='abc.refund.cash.'||
    private.abc_request_hash(
      jsonb_build_object(
        'command',p_operation_id,
        'reembolso_id',p_reembolso_id
      )
    );

  insert into public.caja_operaciones(
    operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
    medio_pago,concepto,origen_tipo,origen_id,payload,actor_user_id,
    abc_command_id,caja_id,session_id,terminal_id,currency_code,
    operating_day,occurred_at,categoria
  ) values (
    v_cash_operation_id,'REEMBOLSO',p_empresa_id,p_local_id,p_operating_day,
    v_reembolso.importe_solicitado,-v_reembolso.importe_solicitado,
    'EFECTIVO','Reembolso ABC en efectivo','ABC_REEMBOLSO',
    p_reembolso_id::text,
    jsonb_build_object(
      'reembolso_id',p_reembolso_id,
      'pago_id',v_reembolso.pago_id,
      'motivo',v_reembolso.motivo
    ),
    auth.uid(),p_operation_id,p_caja_id,p_session_id,p_terminal_id,
    v_reembolso.payment_currency_code,p_operating_day,now(),
    'REEMBOLSO_VENTA'
  );

  v_pago_estado:=private.abc_actualizar_pago_reembolso_estado(
    p_empresa_id,p_local_id,v_reembolso.pago_id
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'REEMBOLSO',p_reembolso_id::text,
    'REEMBOLSO_EFECTIVO_CONFIRMADO',
    jsonb_build_object(
      'pago_id',v_reembolso.pago_id,
      'importe',v_reembolso.importe_solicitado,
      'caja_operation_id',v_cash_operation_id,
      'pago_estado',v_pago_estado
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,
    'reembolso_id',p_reembolso_id,
    'estado','CONFIRMADO',
    'pago_estado',v_pago_estado,
    'caja_operation_id',v_cash_operation_id
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

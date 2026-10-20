-- PM13 P05: pantallas configurables para roles técnicos fijos.
-- El Propietario sigue siendo siempre completo; Encargado, Cajero/a y Camarero/a
-- pueden recibir o revocar pantallas de consulta por empresa o por local.

create table if not exists public.abc_pantallas_rol (
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint abc_pantallas_rol_empresa_fk foreign key (empresa_id)
    references public.empresas(id) on delete restrict,
  constraint abc_pantallas_rol_local_fk foreign key (empresa_id, local_id)
    references public.locales(empresa_id, id) on delete restrict,
  constraint abc_pantallas_rol_rol_ck check (rol in ('Encargado','Cajero/a','Camarero/a')),
  constraint abc_pantallas_rol_capacidad_ck check (capacidad ~ '^ABC_PANTALLA_[A-Z0-9_]+_CONSULTAR$'),
  constraint abc_pantallas_rol_motivo_ck check (nullif(btrim(motivo),'') is not null),
  constraint abc_pantallas_rol_version_ck check (version >= 1)
);

create unique index if not exists abc_pantallas_rol_uq
  on public.abc_pantallas_rol(empresa_id, coalesce(local_id,''), rol, capacidad);
create index if not exists abc_pantallas_rol_lookup_idx
  on public.abc_pantallas_rol(empresa_id, rol, capacidad);

alter table public.abc_pantallas_rol enable row level security;
revoke all on table public.abc_pantallas_rol from public, anon, authenticated, service_role;

create or replace function private.abc_rol_pantalla_catalogo()
returns table(capacidad text, id text, etiqueta text, propietario boolean, encargado boolean, cajero boolean, camarero boolean)
language sql
immutable
security definer
set search_path=''
as $$
  select * from (values
    ('ABC_PANTALLA_DASHBOARD_CONSULTAR','dashboard','Panel general',true,true,true,true),
    ('ABC_PANTALLA_DIRECCION_CONSULTAR','direccion','Panel de dirección',true,false,false,false),
    ('ABC_PANTALLA_BUSCAR_CONSULTAR','buscar','Buscar',true,false,false,false),
    ('ABC_PANTALLA_PROVEEDORES_CONSULTAR','proveedores','Proveedores',true,true,false,false),
    ('ABC_PANTALLA_PEDIDOS_CONSULTAR','pedidos','Pedidos',true,true,false,false),
    ('ABC_PANTALLA_RECEPCION_CONSULTAR','recepcion','Recepción',true,true,false,false),
    ('ABC_PANTALLA_ALBARANES_CONSULTAR','albaranes','Albaranes',true,false,false,false),
    ('ABC_PANTALLA_FACTURAS_CONSULTAR','facturas','Facturas',true,false,false,false),
    ('ABC_PANTALLA_RESUMEN_ALMACEN_CONSULTAR','resumen_almacen','Resumen de almacén',true,false,false,false),
    ('ABC_PANTALLA_PRODUCTOS_CONSULTAR','productos','Productos',true,true,false,false),
    ('ABC_PANTALLA_HISTORIAL_PRODUCTO_CONSULTAR','historial_producto','Historial de producto',true,false,false,false),
    ('ABC_PANTALLA_CONTEO_CONSULTAR','conteo','Inventario ciego',true,true,false,false),
    ('ABC_PANTALLA_SALDO_CONSULTAR','saldo','Saldo de almacén',true,false,false,false),
    ('ABC_PANTALLA_MAPA_CONSULTAR','mapa','Mapa de almacén',true,true,false,false),
    ('ABC_PANTALLA_TRASPASOS_CONSULTAR','traspasos','Traspasos',true,true,false,false),
    ('ABC_PANTALLA_DIAGNOSTICO_CONSULTAR','diagnostico','Reconciliación de stock',true,false,false,false),
    ('ABC_PANTALLA_ETIQUETAS_CONSULTAR','etiquetas','Etiquetas y catálogo',true,false,false,false),
    ('ABC_PANTALLA_VENTA_CONSULTAR','venta','TPV',true,true,true,true),
    ('ABC_PANTALLA_COCINA_CONSULTAR','cocina','Cocina A10',true,true,true,true),
    ('ABC_PANTALLA_ENCARGOS_CONSULTAR','encargos','Encargos',true,false,false,false),
    ('ABC_PANTALLA_CLIENTES_CONSULTAR','clientes','Clientes',true,false,false,false),
    ('ABC_PANTALLA_DEVOLUCIONES_CONSULTAR','devoluciones','Devoluciones',true,true,true,false),
    ('ABC_PANTALLA_DESCUENTOS_CONSULTAR','descuentos','Descuentos y cortesías',true,false,false,false),
    ('ABC_PANTALLA_FICHAS_CONSULTAR','fichas','Fichas de costo',true,false,false,false),
    ('ABC_PANTALLA_PRODUCCION_CONSULTAR','produccion','Producción',true,true,false,false),
    ('ABC_PANTALLA_MERMAS_CONSULTAR','mermas','Mermas',true,false,false,false),
    ('ABC_PANTALLA_PAGOS_CONSULTAR','pagos','Cuentas por pagar',true,false,false,false),
    ('ABC_PANTALLA_RESULTADOS_CONSULTAR','resultados','Resultados',true,false,false,false),
    ('ABC_PANTALLA_REPORTES_CONSULTAR','reportes','Reportes y rotación',true,false,false,false),
    ('ABC_PANTALLA_LIBROIVA_CONSULTAR','libroiva','Libro de IVA',true,false,false,false),
    ('ABC_PANTALLA_CAJA_CONSULTAR','caja','Arqueo de caja',true,true,true,false),
    ('ABC_PANTALLA_TESORERIA_CONSULTAR','tesoreria','Tesorería',true,false,false,false),
    ('ABC_PANTALLA_ESTACIONALIDAD_CONSULTAR','estacionalidad','Estacionalidad',true,false,false,false),
    ('ABC_PANTALLA_PERSONAL_CONSULTAR','personal','Personal',true,false,false,false),
    ('ABC_PANTALLA_FICHAJE_CONSULTAR','fichaje','Registro horario',true,true,true,true),
    ('ABC_PANTALLA_TURNOS_CONSULTAR','turnos','Cuadrante de turnos',true,false,false,false),
    ('ABC_PANTALLA_NOMINAS_CONSULTAR','nominas','Coste de personal',true,false,false,false),
    ('ABC_PANTALLA_APPCC_CONSULTAR','appcc','Control sanitario',true,true,false,false),
    ('ABC_PANTALLA_ACEITE_CONSULTAR','aceite','Aceite de freidoras',true,true,false,false),
    ('ABC_PANTALLA_AUDITORIA_CONSULTAR','auditoria','Auditoría',true,false,false,false),
    ('ABC_PANTALLA_RESPALDOS_CONSULTAR','respaldos','Respaldos',true,false,false,false),
    ('ABC_PANTALLA_NOTIFICACIONES_CONSULTAR','notificaciones','Notificaciones',true,false,false,false),
    ('ABC_PANTALLA_LOCALES_CONSULTAR','locales','Locales',true,false,false,false),
    ('ABC_PANTALLA_CONFIGURACION_CONSULTAR','configuracion','Configuración',true,false,false,false),
    ('ABC_PANTALLA_ERRORES_SISTEMA_CONSULTAR','errores_sistema','Errores del sistema',true,false,false,false)
  ) as v(capacidad,id,etiqueta,propietario,encargado,cajero,camarero)
$$;

create or replace function public.abc_obtener_pantallas_rol(p_empresa_id text, p_local_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_pantallas jsonb;
begin
  if auth.uid() is null
     or nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null
     or not coalesce(private.la_tiene_local(p_empresa_id,p_local_id),false) then
    raise exception 'abc_config_no_autorizado';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'capacidad',c.capacidad,'id',c.id,'etiqueta',c.etiqueta,
      'roles',(
        select jsonb_agg(jsonb_build_object(
          'rol',r.rol,
          'efectivo',case r.rol when 'Encargado' then coalesce(lo.permitido,em.permitido,c.encargado)
                                 when 'Cajero/a' then coalesce(lo.permitido,em.permitido,c.cajero)
                                 when 'Camarero/a' then coalesce(lo.permitido,em.permitido,c.camarero)
                                 else c.propietario end,
          'plantilla',case r.rol when 'Encargado' then c.encargado when 'Cajero/a' then c.cajero when 'Camarero/a' then c.camarero else c.propietario end,
          'origen',case when r.rol='Propietario' then 'fijo' when lo.permitido is not null then 'local' when em.permitido is not null then 'empresa' else 'plantilla' end,
          'decision_local',lo.permitido,'decision_empresa',em.permitido,
          'puede_dar',r.rol <> 'Propietario'
        ) order by r.orden)
        from (values (1,'Propietario'),(2,'Encargado'),(3,'Cajero/a'),(4,'Camarero/a')) as r(orden,rol)
        left join public.abc_pantallas_rol lo
          on lo.empresa_id=p_empresa_id and lo.local_id=p_local_id and lo.rol=r.rol and lo.capacidad=c.capacidad
        left join public.abc_pantallas_rol em
          on em.empresa_id=p_empresa_id and em.local_id is null and em.rol=r.rol and em.capacidad=c.capacidad
      )
    ) order by c.id
  ) into v_pantallas
  from private.abc_rol_pantalla_catalogo() c;

  return jsonb_build_object('ok',true,'empresa_id',p_empresa_id,'local_id',p_local_id,
    'puede_configurar_local',coalesce(private.abc_config_puede_configurar(p_empresa_id,p_local_id),false),
    'puede_configurar_empresa',coalesce(private.abc_config_puede_configurar_empresa(p_empresa_id,p_local_id),false),
    'pantallas',coalesce(v_pantallas,'[]'::jsonb));
end $$;

create or replace function public.abc_configurar_pantalla_rol(
  p_operation_id text, p_empresa_id text, p_local_id text, p_ambito text,
  p_rol text, p_capacidad text, p_permitido boolean, p_motivo text
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
  v_destino text;
  v_prev public.abc_pantallas_rol%rowtype;
  v_antes boolean;
  v_version bigint;
  v_ef_antes boolean;
  v_ef_despues boolean;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'abc_config_no_autorizado'; end if;
  if v_ambito not in ('LOCAL','EMPRESA') then raise exception 'capacidad_ambito_invalido'; end if;
  if v_rol not in ('Encargado','Cajero/a','Camarero/a') then raise exception 'capacidad_rol_invalido'; end if;
  if v_motivo is null then raise exception 'capacidad_motivo_requerido'; end if;
  if v_ambito='EMPRESA' then
    if not coalesce(private.abc_config_puede_configurar_empresa(p_empresa_id,p_local_id),false) then raise exception 'abc_config_no_autorizado'; end if;
  elsif not coalesce(private.abc_config_puede_configurar(p_empresa_id,p_local_id),false) then
    raise exception 'abc_config_no_autorizado';
  end if;
  select * into v_cat from private.abc_rol_pantalla_catalogo() where capacidad=v_cap;
  if not found then raise exception 'capacidad_invalida'; end if;
  if not exists(select 1 from public.locales where empresa_id=p_empresa_id and id=p_local_id and activo=true) then
    raise exception 'capacidad_local_no_disponible';
  end if;
  v_destino:=case when v_ambito='EMPRESA' then null else p_local_id end;
  perform pg_advisory_xact_lock(hashtext('abc_pantallas_rol:'||p_empresa_id));
  select * into v_prev from public.abc_pantallas_rol
   where empresa_id=p_empresa_id and local_id is not distinct from v_destino and rol=v_rol and capacidad=v_cap for update;
  v_antes:=case when found then v_prev.permitido else null end;
  v_ef_antes:=case when v_rol='Encargado' then coalesce((select permitido from public.abc_pantallas_rol where empresa_id=p_empresa_id and local_id=p_local_id and rol=v_rol and capacidad=v_cap),(select permitido from public.abc_pantallas_rol where empresa_id=p_empresa_id and local_id is null and rol=v_rol and capacidad=v_cap),v_cat.encargado) when v_rol='Cajero/a' then coalesce((select permitido from public.abc_pantallas_rol where empresa_id=p_empresa_id and local_id=p_local_id and rol=v_rol and capacidad=v_cap),(select permitido from public.abc_pantallas_rol where empresa_id=p_empresa_id and local_id is null and rol=v_rol and capacidad=v_cap),v_cat.cajero) else coalesce((select permitido from public.abc_pantallas_rol where empresa_id=p_empresa_id and local_id=p_local_id and rol=v_rol and capacidad=v_cap),(select permitido from public.abc_pantallas_rol where empresa_id=p_empresa_id and local_id is null and rol=v_rol and capacidad=v_cap),v_cat.camarero) end;
  if found then
    update public.abc_pantallas_rol set permitido=p_permitido,version=version+1,motivo=v_motivo,updated_by=auth.uid(),updated_at=now() where id=v_prev.id returning version into v_version;
  else
    insert into public.abc_pantallas_rol(empresa_id,local_id,rol,capacidad,permitido,version,motivo,created_by,updated_by)
      values(p_empresa_id,v_destino,v_rol,v_cap,p_permitido,1,v_motivo,auth.uid(),auth.uid()) returning version into v_version;
  end if;
  v_ef_despues:=case when p_permitido is null then case when v_rol='Encargado' then v_cat.encargado when v_rol='Cajero/a' then v_cat.cajero else v_cat.camarero end else p_permitido end;
  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
    values(p_empresa_id,p_local_id,p_operation_id,'PANTALLA_ROL',coalesce(v_destino,'*')||'/'||v_rol||'/'||v_cap,'PANTALLA_ROL_CONFIGURADA',jsonb_build_object('ambito',v_ambito,'local_destino',v_destino,'rol',v_rol,'capacidad',v_cap,'anterior',v_antes,'nuevo',p_permitido,'version',v_version,'motivo',v_motivo,'efectivo_antes',v_ef_antes,'efectivo_despues',v_ef_despues),auth.uid(),null,now(),private.abc_config_dia_evento(p_empresa_id,p_local_id));
  v_result:=jsonb_build_object('ok',true,'ambito',v_ambito,'local_id',v_destino,'rol',v_rol,'capacidad',v_cap,'permitido',p_permitido,'version',v_version,'efectivo_en_local',v_ef_despues);
  return v_result;
end $$;

revoke all on function public.abc_obtener_pantallas_rol(text,text) from public, anon;
grant execute on function public.abc_obtener_pantallas_rol(text,text) to authenticated;
revoke all on function public.abc_configurar_pantalla_rol(text,text,text,text,text,text,boolean,text) from public, anon;
grant execute on function public.abc_configurar_pantalla_rol(text,text,text,text,text,text,boolean,text) to authenticated;

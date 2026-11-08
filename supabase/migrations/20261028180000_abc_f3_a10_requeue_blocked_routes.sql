-- ABC F3 A10 — reencolar comandas bloqueadas cuando se completa su ruta.
-- Una comanda puede nacer BLOQUEADA/SIN_RUTA si el producto aún no tiene
-- estación. Al configurar después una ruta, solo se libera si todas sus líneas
-- resuelven a una única estación; los casos mixtos permanecen bloqueados para
-- revisión explícita y no se enrutan de forma ambigua.

do $$
begin
  if to_regclass('public.tpv_producto_estaciones') is null
     or to_regclass('public.comandas_preparacion') is null
     or to_regclass('public.comanda_lineas') is null then
    raise exception 'abc_f3_a10_requeue_requires_kitchen_tables';
  end if;
end $$;

create or replace function private.abc_a10_reencolar_bloqueadas_por_producto(
  p_empresa_id text,
  p_local_id text,
  p_producto_id text
)
returns integer
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_comanda record;
  v_reencoladas integer := 0;
begin
  for v_comanda in
    select c.id,
           min(private.abc_a10_estacion_producto(c.empresa_id,c.local_id,cl.producto_id)) as estacion_id
      from public.comandas_preparacion c
      join public.comanda_lineas cl
        on cl.empresa_id=c.empresa_id
       and cl.local_id=c.local_id
       and cl.comanda_id=c.id
     where c.empresa_id=p_empresa_id
       and c.local_id=p_local_id
       and c.estado='BLOQUEADA'
       and c.estacion_id is null
       and cl.producto_id=p_producto_id
     group by c.id,c.empresa_id,c.local_id
    having count(*) = count(private.abc_a10_estacion_producto(c.empresa_id,c.local_id,cl.producto_id))
       and count(distinct private.abc_a10_estacion_producto(c.empresa_id,c.local_id,cl.producto_id)) = 1
  loop
    update public.comandas_preparacion
       set estacion_id=v_comanda.estacion_id,
           route_key=v_comanda.estacion_id::text,
           estado='PENDIENTE',
           version=version+1
     where id=v_comanda.id
       and estado='BLOQUEADA'
       and estacion_id is null;

    if found then
      perform private.abc_a10_encolar_comanda(v_comanda.id);
      v_reencoladas := v_reencoladas + 1;
    end if;
  end loop;

  return v_reencoladas;
end $$;

revoke all on function private.abc_a10_reencolar_bloqueadas_por_producto(text,text,text)
  from public,anon,authenticated,service_role;

create or replace function private.abc_a10_reencolar_bloqueadas_route()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.activo then
    perform private.abc_a10_reencolar_bloqueadas_por_producto(
      new.empresa_id,new.local_id,new.producto_id
    );
  end if;
  return new;
end $$;

revoke all on function private.abc_a10_reencolar_bloqueadas_route()
  from public,anon,authenticated,service_role;

drop trigger if exists a10_requeue_blocked_routes on public.tpv_producto_estaciones;
create trigger a10_requeue_blocked_routes
after insert or update of activo,estacion_id,prioridad
on public.tpv_producto_estaciones
for each row
execute function private.abc_a10_reencolar_bloqueadas_route();

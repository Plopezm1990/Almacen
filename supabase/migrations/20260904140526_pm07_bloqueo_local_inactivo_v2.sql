-- PM-07 · Mantener stock histórico legible pero bloquear operación ordinaria en local inactivo.
alter table public.stock_ubicacion
  add column if not exists local_operable boolean not null default true;

update public.stock_ubicacion s
   set local_operable = coalesce((k.value->>'activo')::boolean,true)
  from public.almacen_kv k
 where k.empresa_id=s.empresa_id
   and k.local_id=s.local_id
   and k.key like 'qa_pm04:local:%';

drop view if exists public.stock_estado;
create view public.stock_estado as
select empresa_id,
       local_id,
       producto_id,
       almacen,
       piso,
       round(almacen+piso,6) as total,
       minimo,
       round(almacen+piso,6) < minimo as bajo_minimo,
       fraccionable,
       precision_cantidad,
       updated_at,
       local_operable
from public.stock_ubicacion;

grant select on public.stock_estado to authenticated;

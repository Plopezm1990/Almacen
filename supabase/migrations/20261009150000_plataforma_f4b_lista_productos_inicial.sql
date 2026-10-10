-- PLATAFORMA F4b — cada empresa nace con su lista de productos (almacen_kv.productos) vacía.
--
-- Problema que resuelve
--   Con P3c la lista `productos` solo se escribe por la RPC abc_productos_guardar_lista, y esa RPC
--   exige que la fila de la empresa ya exista (si no responde `abc_productos_lista_nube_ausente`).
--   Una empresa dada de alta por la plataforma no tenía fila: el cliente trataba la respuesta como
--   un fallo que reintenta sin parar («cambios sin confirmar» y aviso rojo) y la lista de productos
--   no llegaba nunca a la nube. El disparador de abc_productos_solo_rpc impide crearla desde la API.
--
-- Qué hace
--   1. Disparador AFTER INSERT en public.empresas: crea (empresa, 'productos', []) si no existe.
--      Corre con los permisos del propietario de la función, así que la protección de «productos solo
--      por RPC» sigue intacta para la API.
--   2. Rellena las empresas que ya existen y no tienen esa fila. No toca ninguna fila existente.
--
-- No crea nada que no sea una lista vacía de la propia empresa. Usa `create or replace` y
-- `on conflict do nothing`: no borra ni cambia datos existentes.
--
-- Este archivo NO se aplica automáticamente a producción desde esta rama.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $f4b$
begin
  if to_regclass('public.almacen_kv') is null or to_regclass('public.empresas') is null then
    raise exception 'PLATAFORMA_F4B_PREVIO:tablas_ausentes';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.almacen_kv'::regclass and contype = 'p'
       and pg_get_constraintdef(oid) = 'PRIMARY KEY (empresa_id, key)'
  ) then
    raise exception 'PLATAFORMA_F4B_PREVIO:falta_F4_clave_primaria_empresa_key';
  end if;
end
$f4b$;

create or replace function private.plataforma_f4b_lista_productos_inicial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.almacen_kv (empresa_id, key, value)
  values (new.id, 'productos', '[]'::jsonb)
  on conflict (empresa_id, key) do nothing;
  return new;
end
$$;

revoke all on function private.plataforma_f4b_lista_productos_inicial() from public, anon, authenticated;

create or replace trigger plataforma_f4b_lista_productos_inicial_trg
  after insert on public.empresas
  for each row execute function private.plataforma_f4b_lista_productos_inicial();

insert into public.almacen_kv (empresa_id, key, value)
select e.id, 'productos', '[]'::jsonb
  from public.empresas e
 where not exists (
   select 1 from public.almacen_kv k where k.empresa_id = e.id and k.key = 'productos'
 )
on conflict (empresa_id, key) do nothing;

do $f4b$
begin
  if exists (
    select 1 from public.empresas e
     where not exists (select 1 from public.almacen_kv k where k.empresa_id = e.id and k.key = 'productos')
  ) then
    raise exception 'PLATAFORMA_F4B_FINAL:hay_empresas_sin_lista_de_productos';
  end if;
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.empresas'::regclass
       and tgname = 'plataforma_f4b_lista_productos_inicial_trg' and not tgisinternal
  ) then
    raise exception 'PLATAFORMA_F4B_FINAL:disparador';
  end if;
end
$f4b$;

commit;

-- PM-07 · Semántica de cantidad: indivisible primero, precisión después.
create or replace function private.pm07_validar_cantidad(
  p_cantidad numeric,
  p_fraccionable boolean,
  p_precision smallint
) returns numeric
language plpgsql
immutable
set search_path='pg_catalog','pg_temp'
as $$
declare v numeric;
begin
  if coalesce(p_cantidad,0)<=0 then raise exception 'cantidad_invalida'; end if;
  if not coalesce(p_fraccionable,false) and p_cantidad<>trunc(p_cantidad) then raise exception 'unidad_indivisible'; end if;
  v:=round(p_cantidad,greatest(0,least(6,coalesce(p_precision,0))));
  if p_cantidad<>v then raise exception 'precision_cantidad_excedida'; end if;
  return v;
end;
$$;

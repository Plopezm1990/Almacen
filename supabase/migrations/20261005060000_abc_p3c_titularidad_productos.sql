-- ABC P3c · titularidad de la lista heredada antes de publicar el cliente nuevo.
-- Aplicar solo después de P3/P3b/P3c y con autorización específica.
-- La fila productiva puede tener empresa_id NULL aunque cada artículo tenga empresaId.
-- P3b necesita empresa_id en la fila para reflejar cambios comerciales.

do $p3c_titularidad$
declare
  v_empresa_fila text;
  v_lista jsonb;
  v_empresa_productos text;
  v_total integer;
begin
  if to_regprocedure('public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb)') is null
     or to_regprocedure('public.abc_catalogo_guardar_productos(text,text,text,text,jsonb)') is null
     or not exists (
       select 1 from pg_proc p
        where p.oid=to_regprocedure(
          'public.abc_catalogo_guardar_productos(text,text,text,text,jsonb)')
          and p.prosrc like '%lista_nube%'
     ) then
    raise exception 'ABC_P3C_TITULARIDAD: faltan P3/P3b/P3c';
  end if;

  select k.empresa_id,k.value into v_empresa_fila,v_lista
    from public.almacen_kv k
   where k.key='productos'
   for update;
  if not found or jsonb_typeof(v_lista)<>'array'
     or jsonb_array_length(v_lista)=0
     or (v_empresa_fila is not null and btrim(v_empresa_fila)='') then
    raise exception 'ABC_P3C_TITULARIDAD: lista ausente, vacía o inválida';
  end if;

  select count(*) into v_total from jsonb_array_elements(v_lista);
  if exists (
    select 1 from jsonb_array_elements(v_lista) e
    where jsonb_typeof(e)<>'object'
       or nullif(btrim(e->>'id'),'') is null
       or nullif(btrim(e->>'localId'),'') is null
       or (v_empresa_fila is null and nullif(btrim(e->>'empresaId'),'') is null)
       or (v_empresa_fila is not null
           and nullif(btrim(e->>'empresaId'),'') is not null
           and e->>'empresaId'<>v_empresa_fila)
  ) or v_total<>(
    select count(distinct e->>'id') from jsonb_array_elements(v_lista) e
  ) then
    raise exception 'ABC_P3C_TITULARIDAD: artículos sin identidad o de otra empresa';
  end if;

  if v_empresa_fila is null then
    select min(e->>'empresaId') into v_empresa_productos
      from jsonb_array_elements(v_lista) e;
    if (select count(distinct e->>'empresaId')
          from jsonb_array_elements(v_lista) e)<>1 then
      raise exception 'ABC_P3C_TITULARIDAD: varias empresas en la lista';
    end if;
  else
    v_empresa_productos:=v_empresa_fila;
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_lista) e
    where not exists (
      select 1 from public.locales l
       where l.empresa_id=v_empresa_productos
         and l.id=e->>'localId' and l.activo=true
    )
  ) then
    raise exception 'ABC_P3C_TITULARIDAD: local inexistente o inactivo';
  end if;

  if v_empresa_fila is null then
    update public.almacen_kv
       set empresa_id=v_empresa_productos
     where key='productos' and empresa_id is null;
    if not found then
      raise exception 'ABC_P3C_TITULARIDAD: fila cambió durante la normalización';
    end if;
  end if;
end
$p3c_titularidad$;

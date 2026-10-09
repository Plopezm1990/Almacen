# Fase 4 · Aplicar en QA con Cowork (editor SQL de Supabase)

**Solo QA. No toca producción.** El propio texto lleva una comprobación: si se ejecutara en
producción se detiene sin cambiar nada (`NO_ES_QA`).

Por qué hace falta Cowork: la herramienta que uso para tocar la base de datos cancela sola las
instrucciones que cambian la clave de una tabla o sus reglas de acceso (aunque Pedro las haya
autorizado en el chat). La parte inofensiva de la Fase 4 (las funciones nuevas y la corrección de
las dos funciones de productos) ya está puesta en QA; esto es lo que falta.

Qué hace este texto (todo o nada, en una sola operación):

1. Comprueba que es el proyecto de pruebas y que la tabla está como se espera.
2. Las siete filas antiguas «sin empresa» se **conservan**, con la etiqueta `__sin_empresa__`.
3. La tabla de colecciones comunes pasa a tener la llave `(empresa, clave)` en lugar de solo `clave`.
4. Se pone el disparador que rellena la empresa de cada fila nueva.
5. Se sustituyen las reglas de acceso: cada persona ve y escribe solo lo de su empresa y solo las
   colecciones que su cargo puede tocar (la misma tabla de cargos de producción).
6. Comprueba el resultado y, si algo no cuadra, deshace todo.

## Texto para pegar a Cowork

```
Tarea: ejecutar UN script SQL en el proyecto de PRUEBAS (QA) de Supabase. No hagas nada más.

1. Abre https://supabase.com/dashboard/project/qjqorixtkilwsndqayyx/sql/new
   Comprueba que en la barra de direcciones aparece EXACTAMENTE qjqorixtkilwsndqayyx
   (proyecto de pruebas). Si aparece flqercbgpgmmfaakrwkc, PARA y avísame sin ejecutar nada.
2. Borra lo que haya en el editor y pega el script de abajo COMPLETO, sin cambiar nada.
3. Pulsa «Run». Si Supabase avisa de operaciones destructivas (DROP / ALTER), pulsa
   «Run this query» / confirmar: es lo esperado.
4. Cuéntame exactamente lo que dice el resultado: «Success. No rows returned» o el texto
   completo del error (copiado tal cual). No reintentes ni modifiques el script.

--- INICIO DEL SCRIPT ---
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $f4$
begin
  if not exists (select 1 from public.empresas where id = 'QA-EMP-A') then
    raise exception 'NO_ES_QA: este no es el proyecto de pruebas';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.almacen_kv'::regclass and contype = 'p' and pg_get_constraintdef(oid) in ('PRIMARY KEY (key)', 'PRIMARY KEY (empresa_id, key)')) then
    raise exception 'PLATAFORMA_F4_PREVIO:clave_primaria_inesperada';
  end if;
  if exists (select 1 from public.empresas where id = '__sin_empresa__') then
    raise exception 'PLATAFORMA_F4_PREVIO:la_empresa_ficticia_ya_existe';
  end if;
end
$f4$;

update public.almacen_kv set empresa_id = '__sin_empresa__' where empresa_id is null or btrim(empresa_id) = '';

alter table public.almacen_kv alter column empresa_id set not null;
alter table public.almacen_kv drop constraint almacen_kv_pkey;
alter table public.almacen_kv add constraint almacen_kv_pkey primary key (empresa_id, key);

drop trigger if exists pm05_zz_plataforma_f4_kv_empresa_trg on public.almacen_kv;
create trigger pm05_zz_plataforma_f4_kv_empresa_trg
  before insert or update on public.almacen_kv
  for each row execute function private.plataforma_f4_kv_empresa();

drop policy if exists pm05_almacen_select on public.almacen_kv;
drop policy if exists pm05_almacen_insert on public.almacen_kv;
drop policy if exists pm05_almacen_update on public.almacen_kv;
drop policy if exists pm05_almacen_delete on public.almacen_kv;
drop policy if exists "acceso por rol y clave - select" on public.almacen_kv;
drop policy if exists "acceso por rol y clave - insert" on public.almacen_kv;
drop policy if exists "acceso por rol y clave - update" on public.almacen_kv;
drop policy if exists "acceso por rol y clave - delete" on public.almacen_kv;
drop policy if exists plataforma_kv_select on public.almacen_kv;
drop policy if exists plataforma_kv_insert on public.almacen_kv;
drop policy if exists plataforma_kv_update on public.almacen_kv;
drop policy if exists plataforma_kv_delete on public.almacen_kv;

do $f4$
begin
  if exists (select 1 from pg_policy where polrelid = 'public.almacen_kv'::regclass) then
    raise exception 'PLATAFORMA_F4_POLITICA_DESCONOCIDA: quedan políticas en almacen_kv que esta migración no conoce';
  end if;
end
$f4$;

alter table public.almacen_kv enable row level security;

create policy plataforma_kv_select on public.almacen_kv
  for select to authenticated
  using (private.plataforma_kv_permitido(empresa_id, local_id, key, 'leer'));
create policy plataforma_kv_insert on public.almacen_kv
  for insert to authenticated
  with check (private.plataforma_kv_permitido(empresa_id, local_id, key, 'escribir'));
create policy plataforma_kv_update on public.almacen_kv
  for update to authenticated
  using (private.plataforma_kv_permitido(empresa_id, local_id, key, 'escribir'))
  with check (private.plataforma_kv_permitido(empresa_id, local_id, key, 'escribir'));
create policy plataforma_kv_delete on public.almacen_kv
  for delete to authenticated
  using (private.plataforma_kv_permitido(empresa_id, local_id, key, 'borrar'));

do $f4$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.almacen_kv'::regclass and contype = 'p' and pg_get_constraintdef(oid) = 'PRIMARY KEY (empresa_id, key)') then
    raise exception 'PLATAFORMA_F4_FINAL:clave_primaria';
  end if;
  if (select count(*) from pg_policy where polrelid = 'public.almacen_kv'::regclass) <> 4 then
    raise exception 'PLATAFORMA_F4_FINAL:politicas';
  end if;
  if exists (select 1 from public.almacen_kv where empresa_id is null) then
    raise exception 'PLATAFORMA_F4_FINAL:filas_sin_empresa';
  end if;
end
$f4$;
--- FIN DEL SCRIPT ---
```

## Después (lo hago yo, sin Cowork)

Compruebo en QA, solo leyendo: la llave `(empresa_id, key)`, las cuatro reglas nuevas, el
disparador, las huellas de las funciones y que las siete filas antiguas siguen ahí con la
etiqueta `__sin_empresa__`.

## Cómo deshacerlo (si hiciera falta)

Texto guardado fuera del repositorio. Resumen: borrar las cuatro reglas nuevas y el disparador,
volver a la llave `(key)`, quitar la etiqueta `__sin_empresa__`, y recrear las cuatro reglas
`pm05_almacen_*`. Solo es posible mientras ninguna otra empresa tenga una colección con el mismo
nombre que otra.

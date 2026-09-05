create or replace function private.la_tiene_local(p_empresa text, p_local text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth', 'private', 'pg_temp'
as $$
  select private.la_usuario_activo()
     and nullif(btrim(p_local), '') is not null
     and upper(btrim(p_local)) <> 'TODOS'
     and exists(
       select 1
         from public.membresias_usuario m
        where m.user_id = auth.uid()
          and m.empresa_id = p_empresa
          and m.activo = true
          and (m.todos_locales = true or m.local_id = p_local)
     );
$$;

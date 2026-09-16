-- P2-R03B · prueba funcional PostgreSQL 16 efímera
\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;

create schema auth;
create schema private;

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('app.current_uid',true),'')::uuid;
$$;

create table public.empresas(
  id text primary key
);

create table public.locales(
  id text primary key,
  empresa_id text not null,
  activo boolean not null default true
);

create table public.membresias_usuario(
  user_id uuid not null,
  empresa_id text not null,
  local_id text,
  todos_locales boolean not null default false,
  rol text not null,
  activo boolean not null default true
);

create table public.auditoria_registro(
  id text primary key,
  fecha date not null,
  datos jsonb not null,
  creado_en timestamptz not null default now()
);

create function private.la_usuario_activo() returns boolean
language sql stable security definer
set search_path=''
as $$
  select (select auth.uid()) is not null
     and exists(
       select 1 from public.membresias_usuario m
        where m.user_id=(select auth.uid()) and m.activo=true
     );
$$;

create function private.la_tiene_empresa(p_empresa text) returns boolean
language sql stable security definer
set search_path=''
as $$
  select private.la_usuario_activo()
     and exists(
       select 1 from public.membresias_usuario m
        where m.user_id=(select auth.uid())
          and m.empresa_id=p_empresa
          and m.activo=true
     );
$$;

create function private.la_tiene_local(p_empresa text,p_local text) returns boolean
language sql stable security definer
set search_path=''
as $$
  select private.la_usuario_activo()
     and exists(
       select 1
         from public.membresias_usuario m
         join public.locales l
           on l.id=p_local and l.empresa_id=p_empresa
        where m.user_id=(select auth.uid())
          and m.empresa_id=p_empresa
          and m.activo=true
          and (m.todos_locales=true or m.local_id=p_local)
     );
$$;

-- Estado legacy equivalente al observado en PROD.
alter table public.auditoria_registro enable row level security;
create policy "auditoria - insertar" on public.auditoria_registro
  for insert to authenticated with check (true);
create policy "auditoria - leer solo propietario" on public.auditoria_registro
  for select to authenticated using (true);
grant select,update,delete on public.auditoria_registro to authenticated;

create function public.registrar_auditoria(text,text,text)
returns void language plpgsql security definer set search_path=public
as $$ begin null; end; $$;
create function public.registrar_auditoria(text,text,text,text,text,text)
returns void language plpgsql security definer set search_path=public
as $$ begin null; end; $$;
grant execute on function public.registrar_auditoria(text,text,text) to authenticated;
grant execute on function public.registrar_auditoria(text,text,text,text,text,text) to authenticated;

-- RPC P2-R02 ficticias para certificar que el nuevo paquete las deja cerradas.
create function public.anular_venta_tpv(text,text) returns void language sql as $$ select; $$;
create function public.descontar_stock(text,numeric,text,jsonb) returns void language sql as $$ select; $$;
create function public.descontar_stock_carrito(jsonb,text) returns void language sql as $$ select; $$;
grant execute on function public.anular_venta_tpv(text,text) to authenticated;
grant execute on function public.descontar_stock(text,numeric,text,jsonb) to authenticated;
grant execute on function public.descontar_stock_carrito(jsonb,text) to authenticated;

insert into public.empresas(id) values ('e1'),('e2');
insert into public.locales(id,empresa_id) values ('l1','e1'),('l2','e2'),('l3','e1');

insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo) values
('11111111-1111-1111-1111-111111111111','e1',null,true,'Propietario',true),
('22222222-2222-2222-2222-222222222222','e2',null,true,'Propietario',true),
('33333333-3333-3333-3333-333333333333','e1','l1',false,'Camarero',true);

\ir ../../supabase/migrations/20260916203000_p2_r03b_auditoria_tenant_post_reset.sql

-- Catálogo y privilegios.
select case when
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='auditoria_registro' and column_name='empresa_id' and data_type='text')
  and exists(select 1 from information_schema.columns where table_schema='public' and table_name='auditoria_registro' and column_name='local_id' and data_type='text')
  and exists(select 1 from information_schema.columns where table_schema='public' and table_name='auditoria_registro' and column_name='actor_user_id' and data_type='uuid')
then 1 else 1/0 end as tenant_columns_ok;

select case when
  (select count(*) from pg_policies where schemaname='public' and tablename='auditoria_registro')=1
  and exists(select 1 from pg_policies where schemaname='public' and tablename='auditoria_registro' and policyname='auditoria_p2_r03b_select' and cmd='SELECT')
then 1 else 1/0 end as rls_policy_ok;

select case when
  has_table_privilege('authenticated','public.auditoria_registro','SELECT')
  and not has_table_privilege('authenticated','public.auditoria_registro','INSERT')
  and not has_table_privilege('authenticated','public.auditoria_registro','UPDATE')
  and not has_table_privilege('authenticated','public.auditoria_registro','DELETE')
then 1 else 1/0 end as append_only_ok;

select case when
  has_function_privilege('authenticated','public.registrar_auditoria(text,text,text,text,date,text,text,text)','EXECUTE')
  and not has_function_privilege('anon','public.registrar_auditoria(text,text,text,text,date,text,text,text)','EXECUTE')
  and not has_function_privilege('authenticated','public.registrar_auditoria(text,text,text)','EXECUTE')
  and not has_function_privilege('authenticated','public.registrar_auditoria(text,text,text,text,text,text)','EXECUTE')
then 1 else 1/0 end as audit_rpc_acl_ok;

select case when
  not has_function_privilege('authenticated','public.anular_venta_tpv(text,text)','EXECUTE')
  and not has_function_privilege('authenticated','public.descontar_stock(text,numeric,text,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated','public.descontar_stock_carrito(jsonb,text)','EXECUTE')
then 1 else 1/0 end as p2_r02_stays_revoked_ok;

-- Escritura válida por RPC + replay exacto.
set role authenticated;
set app.current_uid='11111111-1111-1111-1111-111111111111';

select case when
  (public.registrar_auditoria(
    'audit-0001','Propietario','PRUEBA','detalle','2026-09-16','20:30','e1','l1'
  )->>'replayed')='false'
then 1 else 1/0 end as first_insert_ok;

select case when
  (public.registrar_auditoria(
    'audit-0001','Propietario','PRUEBA','detalle','2026-09-16','20:30','e1','l1'
  )->>'replayed')='true'
then 1 else 1/0 end as exact_replay_ok;

do $$
begin
  begin
    perform public.registrar_auditoria(
      'audit-0001','Propietario','PRUEBA','detalle cambiado','2026-09-16','20:30','e1','l1'
    );
    raise exception 'P2_R03B_EXPECTED_CONFLICT_NOT_RAISED';
  exception
    when others then
      if sqlerrm='P2_R03B_EXPECTED_CONFLICT_NOT_RAISED'
         or position('auditoria_id_conflict' in sqlerrm)=0 then
        raise;
      end if;
  end;
end;
$$;

do $$
begin
  begin
    perform public.registrar_auditoria(
      'audit-0002','Propietario','PRUEBA','detalle','2026-09-16','20:31','e1','l2'
    );
    raise exception 'P2_R03B_EXPECTED_LOCAL_MISMATCH_NOT_RAISED';
  exception
    when others then
      if sqlerrm='P2_R03B_EXPECTED_LOCAL_MISMATCH_NOT_RAISED'
         or position('local_empresa_incompatible' in sqlerrm)=0 then
        raise;
      end if;
  end;
end;
$$;

do $$
begin
  begin
    perform public.registrar_auditoria(
      'audit-0003','Propietario','PRUEBA','detalle','2026-09-16','20:32','e2','l2'
    );
    raise exception 'P2_R03B_EXPECTED_CROSS_TENANT_NOT_RAISED';
  exception
    when others then
      if sqlerrm='P2_R03B_EXPECTED_CROSS_TENANT_NOT_RAISED'
         or position('empresa_no_autorizada' in sqlerrm)=0 then
        raise;
      end if;
  end;
end;
$$;

-- El propietario de e1 ve su auditoría y no la de e2.
reset role;
insert into public.auditoria_registro(id,fecha,datos,empresa_id,local_id,actor_user_id)
values (
  'audit-e2','2026-09-16','{}','e2','l2','22222222-2222-2222-2222-222222222222'
);

set role authenticated;
set app.current_uid='11111111-1111-1111-1111-111111111111';
select case when
  (select count(*) from public.auditoria_registro)=1
  and (select count(*) from public.auditoria_registro where empresa_id='e2')=0
then 1 else 1/0 end as owner_tenant_rls_ok;

-- Un usuario operativo puede registrar su acción, pero no leer Auditoría.
set app.current_uid='33333333-3333-3333-3333-333333333333';
select case when
  (public.registrar_auditoria(
    'audit-staff','Camarero','PRUEBA_STAFF','detalle','2026-09-16','20:33','e1','l1'
  )->>'ok')='true'
then 1 else 1/0 end as staff_can_log_ok;

select case when
  (select count(*) from public.auditoria_registro)=0
then 1 else 1/0 end as staff_cannot_read_audit_ok;

reset role;
select 'P2_R03B_EPHEMERAL_OK=1' as result;

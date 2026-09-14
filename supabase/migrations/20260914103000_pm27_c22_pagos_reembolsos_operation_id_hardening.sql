-- PM27-C22: pagos/reembolsos + ledger global operation_id.
--
-- Alcance deliberadamente estrecho:
--   * NO crea un segundo motor de idempotencia.
--   * Conserva private.g1_operation_ids_global + private.g1_claim_operation_id().
--   * Cierra invariantes estructurales de public.pagos_encargo que hasta ahora
--     dependian exclusivamente de revertir_pago_encargo().
--   * Convierte pagos_encargo en ledger append-only: los reversos son filas nuevas.
--   * Reduce privilegios directos de escritura de anon/authenticated; SELECT y RPC
--     siguen siendo los caminos de lectura/escritura previstos.
--
-- Esta migracion se prepara/certifica en GitHub. C22 no la aplica remotamente.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Preflight de objetos autoritativos. Una instalacion incompleta debe fallar de forma
-- explicita, no degradarse a un segundo mecanismo paralelo.
do $preflight_objects$
begin
  if to_regclass('public.pagos_encargo') is null then
    raise exception 'PM27_C22_PREFLIGHT_FALLO: falta public.pagos_encargo';
  end if;
  if to_regclass('private.g1_operation_ids_global') is null then
    raise exception 'PM27_C22_PREFLIGHT_FALLO: falta private.g1_operation_ids_global';
  end if;
  if to_regprocedure('private.g1_claim_operation_id()') is null then
    raise exception 'PM27_C22_PREFLIGHT_FALLO: falta private.g1_claim_operation_id()';
  end if;
  if to_regprocedure('public.registrar_pago_encargo(text,text,text,text,text,text,numeric,date,text,jsonb)') is null then
    raise exception 'PM27_C22_PREFLIGHT_FALLO: falta registrar_pago_encargo esperado';
  end if;
  if to_regprocedure('public.revertir_pago_encargo(text,text,text,text)') is null then
    raise exception 'PM27_C22_PREFLIGHT_FALLO: falta revertir_pago_encargo esperado';
  end if;
end
$preflight_objects$;

-- Evita que cambie el conjunto auditado mientras se validan datos y se instalan
-- restricciones. El timeout superior evita esperas indefinidas en despliegue.
lock table public.pagos_encargo in share row exclusive mode;
lock table private.g1_operation_ids_global in share row exclusive mode;

-- Preflight de datos historicos. C22 no repara silenciosamente un ledger economico:
-- cualquier incoherencia preexistente exige investigacion antes de aplicar DDL.
do $preflight_data$
begin
  if exists (
    select 1
      from public.pagos_encargo
     where (estado = 'REVERSO' and revierte_pago_id is null)
        or (estado = 'CONFIRMADO' and revierte_pago_id is not null)
  ) then
    raise exception 'PM27_C22_PREFLIGHT_FALLO: estado/revierte_pago_id incoherente';
  end if;

  if exists (
    select 1
      from public.pagos_encargo
     where revierte_pago_id = id
  ) then
    raise exception 'PM27_C22_PREFLIGHT_FALLO: pago que se revierte a si mismo';
  end if;

  if exists (
    select revierte_pago_id
      from public.pagos_encargo
     where revierte_pago_id is not null
     group by revierte_pago_id
    having count(*) > 1
  ) then
    raise exception 'PM27_C22_PREFLIGHT_FALLO: un pago tiene mas de un reverso';
  end if;

  if exists (
    select 1
      from public.pagos_encargo r
      left join public.pagos_encargo o on o.id = r.revierte_pago_id
     where r.estado = 'REVERSO'
       and (
         o.id is null
         or o.estado <> 'CONFIRMADO'
         or o.revierte_pago_id is not null
         or r.empresa_id is distinct from o.empresa_id
         or r.local_id is distinct from o.local_id
         or r.encargo_id is distinct from o.encargo_id
         or r.importe is distinct from o.importe
         or r.concepto is distinct from o.concepto
         or r.medio_pago is distinct from o.medio_pago
       )
  ) then
    raise exception 'PM27_C22_PREFLIGHT_FALLO: reverso no conserva el pago original';
  end if;

  if exists (
    select 1
      from public.pagos_encargo p
      left join private.g1_operation_ids_global g on g.operation_id = p.operation_id
     where g.operation_id is null
        or g.ledger is distinct from 'pagos_encargo'
  ) then
    raise exception 'PM27_C22_PREFLIGHT_FALLO: pago sin claim global correcto';
  end if;

  if exists (
    select 1
      from private.g1_operation_ids_global g
      left join public.pagos_encargo p on p.operation_id = g.operation_id
     where g.ledger = 'pagos_encargo'
       and p.operation_id is null
  ) then
    raise exception 'PM27_C22_PREFLIGHT_FALLO: claim pagos_encargo sin fila de pago';
  end if;
end
$preflight_data$;

-- D1/D2: el estado del asiento y el enlace de reverso quedan unidos por constraint;
-- cada pago confirmado admite como maximo una fila de reverso.
alter table public.pagos_encargo
  add constraint pm27_c22_pagos_encargo_estado_reverso_ck
  check (
    (estado = 'CONFIRMADO' and revierte_pago_id is null)
    or
    (estado = 'REVERSO' and revierte_pago_id is not null)
  ) not valid;

alter table public.pagos_encargo
  validate constraint pm27_c22_pagos_encargo_estado_reverso_ck;

create unique index pm27_c22_pagos_encargo_un_reverso_por_pago
  on public.pagos_encargo (revierte_pago_id)
  where revierte_pago_id is not null;

-- D3: defensa estructural de la relacion economica. El RPC ya construye el reverso
-- copiando estos campos; el trigger hace que la misma regla sobreviva a cualquier
-- escritor privilegiado y a futuros caminos de codigo.
create or replace function private.pm27_c22_validar_pago_encargo_integridad()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth', 'private', 'pg_temp'
as $function$
declare
  original public.pagos_encargo%rowtype;
begin
  if tg_op = 'TRUNCATE' then
    raise exception 'pagos_encargo_append_only';
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'pagos_encargo_append_only';
  end if;

  if new.estado = 'REVERSO' then
    if new.revierte_pago_id is null or new.revierte_pago_id = new.id then
      raise exception 'reverso_pago_invalido';
    end if;

    select * into original
      from public.pagos_encargo
     where id = new.revierte_pago_id
     for key share;

    if not found then
      raise exception 'pago_original_no_encontrado';
    end if;

    if original.estado <> 'CONFIRMADO'
       or original.revierte_pago_id is not null
       or new.empresa_id is distinct from original.empresa_id
       or new.local_id is distinct from original.local_id
       or new.encargo_id is distinct from original.encargo_id
       or new.importe is distinct from original.importe
       or new.concepto is distinct from original.concepto
       or new.medio_pago is distinct from original.medio_pago then
      raise exception 'reverso_no_coincide_con_pago_original';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.pm27_c22_validar_pago_encargo_integridad() from public, anon, authenticated;

create trigger pm27_c22_pagos_encargo_integridad
before insert or update or delete on public.pagos_encargo
for each row execute function private.pm27_c22_validar_pago_encargo_integridad();

create trigger pm27_c22_pagos_encargo_no_truncate
before truncate on public.pagos_encargo
for each statement execute function private.pm27_c22_validar_pago_encargo_integridad();

-- El acceso economico directo se reduce a minimo privilegio. RLS ya bloqueaba DML
-- ordinario sin politicas de escritura; este REVOKE elimina ademas grants innecesarios
-- (incluido TRUNCATE). La escritura legitima sigue entrando por los RPC SECURITY DEFINER.
revoke insert, update, delete, truncate, references, trigger
  on table public.pagos_encargo
  from anon, authenticated;

-- Postcondiciones: conservar exactamente el ledger global existente y verificar que el
-- hardening no ha sustituido ni duplicado el mecanismo de operation_id.
do $postconditions$
declare
  n_global_trigger integer;
  n_integrity_trigger integer;
  n_truncate_trigger integer;
begin
  select count(*) into n_global_trigger
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace pn on pn.oid = p.pronamespace
   where n.nspname = 'public'
     and c.relname = 'pagos_encargo'
     and not t.tgisinternal
     and t.tgname = 'g1_operation_id_global'
     and pn.nspname = 'private'
     and p.proname = 'g1_claim_operation_id';

  if n_global_trigger <> 1 then
    raise exception 'PM27_C22_POSTCONDICION_FALLO: trigger global operation_id esperado una vez, encontrado %', n_global_trigger;
  end if;

  select count(*) into n_integrity_trigger
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'pagos_encargo'
     and not t.tgisinternal
     and t.tgname = 'pm27_c22_pagos_encargo_integridad';

  select count(*) into n_truncate_trigger
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'pagos_encargo'
     and not t.tgisinternal
     and t.tgname = 'pm27_c22_pagos_encargo_no_truncate';

  if n_integrity_trigger <> 1 or n_truncate_trigger <> 1 then
    raise exception 'PM27_C22_POSTCONDICION_FALLO: triggers de integridad incompletos';
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.pagos_encargo'::regclass
       and conname = 'pm27_c22_pagos_encargo_estado_reverso_ck'
       and contype = 'c'
       and convalidated
  ) then
    raise exception 'PM27_C22_POSTCONDICION_FALLO: CHECK estado/reverso ausente';
  end if;

  if to_regclass('public.pm27_c22_pagos_encargo_un_reverso_por_pago') is null then
    raise exception 'PM27_C22_POSTCONDICION_FALLO: indice unico de reverso ausente';
  end if;

  if exists (
    select 1
      from information_schema.role_table_grants
     where table_schema = 'public'
       and table_name = 'pagos_encargo'
       and grantee in ('anon', 'authenticated')
       and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
  ) then
    raise exception 'PM27_C22_POSTCONDICION_FALLO: persisten grants directos de escritura';
  end if;

  if not has_function_privilege('authenticated', 'public.registrar_pago_encargo(text,text,text,text,text,text,numeric,date,text,jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.revertir_pago_encargo(text,text,text,text)', 'EXECUTE') then
    raise exception 'PM27_C22_POSTCONDICION_FALLO: RPC de pago/reverso no ejecutables por authenticated';
  end if;
end
$postconditions$;

commit;

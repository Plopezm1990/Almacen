-- Plataforma · Blindaje en servidor de la contraseña inicial obligatoria (D01, decisión 3).
-- Diseño: docs/plan-empresas/D01_BLINDAJE_PASSWORD_INICIAL_DISENO_2026-10-16.md
--
-- Hoy el indicador «debe_cambiar_contrasena» vive en auth.users.user_metadata,
-- que el propio usuario puede escribir desde el cliente sin contraseña, y
-- ningún RPC lo comprueba. Esta migración crea un indicador que el usuario no
-- puede tocar y lo liga a un cambio REAL de contraseña detectado por el
-- propio motor de autenticación, nunca por lo que diga el cliente.
--
-- Aditiva: solo crea piezas nuevas (una tabla, un disparador, tres
-- funciones). NO sustituye todavía private.abc_tiene_capacidad ni la
-- familia plataforma_kv_permitido/plataforma_mov_permitido/plataforma_push_*
-- ni plataforma_asignar_propietario: esas sustituciones de funciones que ya
-- existen en producción necesitan su propia comprobación de huella contra
-- el texto real (patrón del informe de traspaso, §8.4) y se preparan en un
-- subpunto de migración aparte, después de este contrato local.
--
-- No aplicar en QA ni en PROD sin autorización expresa para ese entorno.

do $$
begin
  if to_regclass('private.plataforma_password_pendiente') is not null then
    raise exception 'PLATAFORMA_PASSWORD_PREFLIGHT_FALLO:tabla_ya_existe';
  end if;
  if to_regprocedure('private.plataforma_debe_cambiar_password(uuid)') is not null then
    raise exception 'PLATAFORMA_PASSWORD_PREFLIGHT_FALLO:funcion_ya_existe';
  end if;
end $$;

-- 1. Indicador que el usuario no puede leer ni escribir directamente.
create table private.plataforma_password_pendiente (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  creado_en timestamptz not null default now(),
  motivo    text not null default 'alta_propietario'
);

alter table private.plataforma_password_pendiente enable row level security;
revoke all on table private.plataforma_password_pendiente from public, anon, authenticated;
comment on table private.plataforma_password_pendiente is
  'D01 decisión 3: cuentas con la contraseña inicial pendiente de cambiar. Sin políticas: solo accesible desde funciones SECURITY DEFINER. La fila se borra sola cuando auth.users.encrypted_password cambia de verdad (ver el disparador plataforma_password_cambiada_trg).';

-- 2. Detección real del cambio de contraseña: reacciona a auth.users, no a
--    lo que diga el cliente. Mismo patrón que usan las guías oficiales de
--    Supabase para crear un perfil al alta (trigger sobre auth.users).
create or replace function private.plataforma_password_cambiada_trg()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.plataforma_password_pendiente where user_id = new.id;
  return new;
end;
$$;

drop trigger if exists plataforma_password_cambiada_trg on auth.users;
create trigger plataforma_password_cambiada_trg
after update of encrypted_password on auth.users
for each row
when (new.encrypted_password is distinct from old.encrypted_password)
execute function private.plataforma_password_cambiada_trg();

-- 3. Función de comprobación, para usar dentro de otras funciones
--    SECURITY DEFINER (abc_tiene_capacidad, plataforma_kv_permitido...).
--    Revocada a authenticated/anon a propósito: no es un punto de entrada
--    público, y el valor por defecto (auth.uid()) nunca permite consultar
--    la cuenta de otra persona desde fuera.
create or replace function private.plataforma_debe_cambiar_password(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.plataforma_password_pendiente where user_id = p_user
  )
$$;

revoke all on function private.plataforma_debe_cambiar_password(uuid) from public, anon, authenticated;

-- 4. Único punto de entrada público: siempre consulta la propia cuenta de
--    quien llama (auth.uid()), nunca acepta un identificador ajeno. Sirve
--    para que la pantalla sepa si debe bloquear, sin fiarse de user_metadata.
create or replace function public.plataforma_mi_estado_password()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ok', true,
    'pendiente', private.plataforma_debe_cambiar_password(auth.uid())
  )
$$;

revoke all on function public.plataforma_mi_estado_password() from public, anon;
grant execute on function public.plataforma_mi_estado_password() to authenticated;

-- 5. Marcar una cuenta como pendiente. Pensada para usarse dentro de
--    plataforma_asignar_propietario en el subpunto de migración real (misma
--    transacción que crea la membresía); aquí se deja como pieza aditiva
--    independiente para no tocar todavía esa función existente.
create or replace function private.plataforma_marcar_password_pendiente(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.plataforma_password_pendiente(user_id)
  values (p_user)
  on conflict (user_id) do nothing
$$;

revoke all on function private.plataforma_marcar_password_pendiente(uuid) from public, anon, authenticated;

do $$
begin
  if to_regclass('private.plataforma_password_pendiente') is null
     or to_regprocedure('private.plataforma_debe_cambiar_password(uuid)') is null
     or to_regprocedure('public.plataforma_mi_estado_password()') is null
     or to_regprocedure('private.plataforma_marcar_password_pendiente(uuid)') is null
  then
    raise exception 'PLATAFORMA_PASSWORD_POSTFLIGHT_FALLO:piezas_incompletas';
  end if;
end $$;

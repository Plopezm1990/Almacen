-- D01 · blindaje server-side de la contraseña inicial · almacén/caja.
--
-- Reconstrucción de la migración registrada en QA como
-- 20261016191528_plataforma_password_inicial_bloqueo_almacen_alta y en PROD
-- como 20261016192941_plataforma_password_inicial_bloqueo_almacen_alta_prod.
-- La fuente histórica no está en release. La reconstrucción se hizo solo con
-- lectura de pg_proc en QA y PROD (20/10/2026): ambos entornos contienen el
-- mismo guard lógico en los cuatro helpers, con diferencias de formato que no
-- cambian el contrato.
--
-- No aplica cambios retroactivos a ninguna base ya migrada: acepta tanto el
-- cuerpo previo sin guard como el cuerpo ya protegido y deja siempre el estado
-- protegido. Si una función fue modificada de otra manera, se detiene antes de
-- reemplazarla.

do $$
declare
  v_h text;
begin
  if to_regprocedure('private.plataforma_debe_cambiar_password(uuid)') is null then
    raise exception 'PLATAFORMA_PASSWORD_ALMACEN_PREFLIGHT_FALLO:falta_guard_base';
  end if;

  select md5(replace(p.prosrc, chr(13), '')) into v_h
    from pg_proc p where p.oid = 'private.pm07_puede_gestionar_stock()'::regprocedure;
  if not coalesce(v_h = any(array[
    '5347940840c537d0ad2abf6db928c3f1',
    'f77ca13ac76a75e905cea4c364283dce',
    '029907a548df9d143b506b6883041a24'
  ]::text[]), false) then
    raise exception 'PLATAFORMA_PASSWORD_ALMACEN_PREFLIGHT_FALLO:pm07_puede_gestionar_stock:%', v_h;
  end if;

  select md5(replace(p.prosrc, chr(13), '')) into v_h
    from pg_proc p where p.oid = 'private.pm07_puede_vender()'::regprocedure;
  if not coalesce(v_h = any(array[
    '5e0162f33865a5d9691743b7c3ad4564',
    '0730ebd4a27d5621c4c713d0853adb03',
    'bd7cd3101e721326554bde145ed35038'
  ]::text[]), false) then
    raise exception 'PLATAFORMA_PASSWORD_ALMACEN_PREFLIGHT_FALLO:pm07_puede_vender:%', v_h;
  end if;

  select md5(replace(p.prosrc, chr(13), '')) into v_h
    from pg_proc p where p.oid = 'private.pm08_puede_operar_caja()'::regprocedure;
  if not coalesce(v_h = any(array[
    'ce7b8bc1b2bc789e1e8a236d588874c2',
    '9809345971ffe801dd7cbc79dcf8ddab'
  ]::text[]), false) then
    raise exception 'PLATAFORMA_PASSWORD_ALMACEN_PREFLIGHT_FALLO:pm08_puede_operar_caja:%', v_h;
  end if;

  select md5(replace(p.prosrc, chr(13), '')) into v_h
    from pg_proc p where p.oid = 'private.pm08_puede_corregir_caja()'::regprocedure;
  if not coalesce(v_h = any(array[
    '5347940840c537d0ad2abf6db928c3f1',
    'f77ca13ac76a75e905cea4c364283dce'
  ]::text[]), false) then
    raise exception 'PLATAFORMA_PASSWORD_ALMACEN_PREFLIGHT_FALLO:pm08_puede_corregir_caja:%', v_h;
  end if;
end $$;

create or replace function private.pm07_puede_gestionar_stock()
returns boolean
language sql
stable security definer
set search_path = 'public','auth','private','pg_temp'
as $$
  select private.la_usuario_activo() and not private.plataforma_debe_cambiar_password()
     and coalesce(private.la_rol(),'') in ('Propietario','Encargado');
$$;

create or replace function private.pm07_puede_vender()
returns boolean
language sql
stable security definer
set search_path = 'public','auth','private','pg_temp'
as $$
  select private.la_usuario_activo() and not private.plataforma_debe_cambiar_password()
     and coalesce(private.la_rol(),'') in ('Propietario','Encargado','Cajero/a','Camarero/a','Churrero/a');
$$;

create or replace function private.pm08_puede_operar_caja()
returns boolean
language sql
stable security definer
set search_path = 'public','auth','private','pg_temp'
as $$
  select private.la_usuario_activo() and not private.plataforma_debe_cambiar_password()
     and coalesce(private.la_rol(),'') in ('Propietario','Encargado','Cajero/a');
$$;

create or replace function private.pm08_puede_corregir_caja()
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select private.la_usuario_activo() and not private.plataforma_debe_cambiar_password()
     and coalesce(private.la_rol(),'') in ('Propietario','Encargado');
$$;

do $$
declare
  v_n integer;
begin
  select count(*) into v_n
    from pg_proc p
   where p.oid in (
     'private.pm07_puede_gestionar_stock()'::regprocedure,
     'private.pm07_puede_vender()'::regprocedure,
     'private.pm08_puede_operar_caja()'::regprocedure,
     'private.pm08_puede_corregir_caja()'::regprocedure
   )
   and position('plataforma_debe_cambiar_password' in p.prosrc) > 0;
  if v_n <> 4 then
    raise exception 'PLATAFORMA_PASSWORD_ALMACEN_POSTFLIGHT_FALLO:helpers_sin_guard:%', v_n;
  end if;
end $$;
